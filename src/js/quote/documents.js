/**
 * Le Glaceur — documents du devis (façade publique, voir docs/ARCHITECTURE.md § Devis).
 *
 *   createPdf(q)          → Promise<Blob>  PDF A4 premium (jsPDF + autotable + QR, chargés à la demande)
 *   createXlsx(q)         → Promise<Blob>  Classeur Excel protégé (ExcelJS, chargé à la demande)
 *   createImage(q)        → Promise<Blob>  Le PDF converti en image PNG (pdf.js)
 *   whatsappMessage(q)    → string         Message WhatsApp prérempli
 *   quoteFileName(q, ext) → 'Devis-Le-Glaceur-GLC-261022-AB12.pdf'
 *   + downloadBlob(blob, name), preloadDocuments()  (confort pour l'interface)
 *
 * q = toQuoteData() de core/quote-store.js.
 * Ce fichier reste léger : les bibliothèques (≈ 1 Mo) et les polices ne sont chargées qu'au clic.
 */
export { whatsappMessage, quoteFileName } from './message.js';

const BASE = import.meta.env.BASE_URL || '/';

/** Polices Barlow (OFL, sous-ensemble latin) servies depuis public/fonts/. */
const FONT_FILES = {
  regular: 'Barlow-Regular.ttf',
  semibold: 'Barlow-SemiBold.ttf',
  bold: 'Barlow-Bold.ttf',
  condSemi: 'BarlowCondensed-SemiBold.ttf',
  condBlack: 'BarlowCondensed-ExtraBold.ttf',
};

let fontsPromise = null;
let logoPromise = null;

/** ArrayBuffer → chaîne binaire (format attendu par le VFS de jsPDF). */
function toBinaryString(buf) {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return out;
}

/** { regular: { file, data } … } ou null si une police manque (le PDF bascule alors sur Helvetica). */
function loadFonts() {
  fontsPromise ??= Promise.all(
    Object.entries(FONT_FILES).map(async ([key, file]) => {
      const res = await fetch(`${BASE}fonts/${file}`);
      if (!res.ok) throw new Error(`police ${file} : HTTP ${res.status}`);
      return [key, { file, data: toBinaryString(await res.arrayBuffer()) }];
    }),
  )
    .then(Object.fromEntries)
    .catch((err) => {
      console.warn('[devis] polices Barlow indisponibles, repli sur Helvetica.', err);
      fontsPromise = null; // nouvel essai au prochain document
      return null;
    });
  return fontsPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image illisible : ${src}`));
    img.src = src;
  });
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

/** Logo blanc officiel (vectoriel) rastérisé en PNG haute définition pour le bandeau marine. */
async function whiteLogoFromSvg(width) {
  const res = await fetch(`${BASE}brand/logo-full-white.svg`);
  if (!res.ok) throw new Error(`logo SVG : HTTP ${res.status}`);
  const svg = await res.text();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const vb = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/[\s,]+/).map(Number);
    const ratio = vb && vb[2] > 0 && vb[3] > 0 ? vb[3] / vb[2] : img.naturalHeight / img.naturalWidth || 0.31;
    const c = canvasOf(width, width * ratio);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/png'), ratio };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Repli : logo-quote.png (marine sur transparent) recoloré en blanc pour le fond marine,
 * en conservant la vague bleue, le glaçon et la feuille.
 */
async function whiteLogoFromPng() {
  const img = await loadImage(`${BASE}brand/logo-quote.png`);
  const c = canvasOf(img.naturalWidth, img.naturalHeight);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // Proximité du marine #0a1f44 : on blanchit progressivement (les bleus vifs et le vert restent).
    const dist = Math.hypot(r - 10, g - 31, b - 68);
    const t = Math.max(0, Math.min(1, 1 - (dist - 40) / 90));
    if (t > 0) {
      d[i] = r + (255 - r) * t;
      d[i + 1] = g + (255 - g) * t;
      d[i + 2] = b + (255 - b) * t;
    } else if (b > 150 && r < 90) {
      // bleu marque un peu éclairci pour rester lisible sur marine
      d[i] = Math.min(255, r + 30); d[i + 1] = Math.min(255, g + 40); d[i + 2] = Math.min(255, b + 20);
    }
  }
  ctx.putImageData(px, 0, 0);
  return { dataUrl: c.toDataURL('image/png'), ratio: c.height / c.width };
}

/** { dataUrl, ratio } du logo blanc, ou null (repli texte dans les documents). */
function loadWhiteLogo() {
  logoPromise ??= whiteLogoFromSvg(1600)
    .catch(() => whiteLogoFromPng())
    .catch((err) => {
      console.warn('[devis] logo indisponible, repli texte.', err);
      logoPromise = null;
      return null;
    });
  return logoPromise;
}

/** Précharge bibliothèques et ressources (à appeler au survol / focus des boutons de téléchargement). */
export function preloadDocuments() {
  import('./pdf.js').catch(() => {});
  import('./xlsx.js').catch(() => {});
  loadFonts();
  loadWhiteLogo();
}

/** Devis PDF (Blob application/pdf). */
export async function createPdf(q) {
  const [{ buildPdf }, fonts, logo] = await Promise.all([import('./pdf.js'), loadFonts(), loadWhiteLogo()]);
  return buildPdf(q, { fonts, logo });
}

/** Devis Excel protégé (Blob .xlsx). */
export async function createXlsx(q) {
  const [{ buildXlsx }, logo] = await Promise.all([import('./xlsx.js'), loadWhiteLogo()]);
  return buildXlsx(q, { logo });
}

/** Devis en image PNG (Blob image/png) : le PDF converti, identique. pdf = Blob déjà généré (facultatif). */
export async function createImage(q, pdf) {
  const [{ pdfToImage }, blob] = await Promise.all([import('./image.js'), pdf || createPdf(q)]);
  return pdfToImage(blob);
}

/** Télécharge un Blob sous le nom donné (lien temporaire). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
