/**
 * Le Glaceur — devis PDF (A4 portrait), chargé à la demande par documents.js.
 *
 * Plan de mise en page (mm) :
 *  1. Bandeau « nuit polaire » peint sur canvas (dégradé marine, gemme de glace facettée, givre, cristaux, reflet)
 *     terminé par la vague bleue de la marque ; logo blanc officiel + « DEVIS », n°, date et validité en vectoriel.
 *  2. Deux cartes givrées : Client (Nom, Structure, WhatsApp, E-mail) et Livraison / Retrait (+ pastille d'état).
 *  3. Tableau autotable : en-tête marine liseré glace, lignes alternées, désignation sur deux niveaux, saut de page
 *     propre avec bandeau compact « suite » et en-tête de tableau répété.
 *  4. Totaux : sous-total, transport (offerte / hors frais / retrait), barre TOTAL marine facettée ; à gauche
 *     articles, poids indicatif et état de la livraison offerte (jauge « plus que N articles »).
 *  5. Appel à l'action : gros bouton WhatsApp cliquable (wa.me + message) et QR code vectoriel vers le même lien.
 *  6. Mentions (paiement, livraison, validité, « ne constitue pas une facture ») ; pied de page sur chaque page
 *     (téléphones et e-mail cliquables, adresse, signature SDLSIT Group, pagination).
 * Polices Barlow / Barlow Condensed (OFL) si chargées, sinon Helvetica avec texte ramené en Latin-1.
 */
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import QRCode from 'qrcode';
import { BRAND, QUOTE, DELIVERY, mapsUrl } from '../config.js';
import {
  NBSP, money, num, cleanSpaces, formatQuoteDate, formatCell, qtyCell, productAlias, clientRows, deliveryRows,
  isPickup, isFree, excludesDelivery, freeFrom, transportText, remainingForFree, whatsappMessage,
  shortWhatsappMessage, whatsappUrl,
} from './message.js';

/* ---------- Palette (tokens.css) ---------- */
const C = {
  ink: [10, 31, 68],
  ink800: [15, 44, 94],
  blue: [21, 99, 214],
  blue400: [77, 155, 255],
  ice300: [142, 207, 255],
  ice200: [191, 228, 255],
  ice100: [227, 243, 255],
  ice50: [243, 250, 255],
  white: [255, 255, 255],
  muted: [69, 89, 124],
  soft: [107, 127, 159],
  wa: [14, 122, 63],
  waDeep: [10, 96, 49],
  okBg: [231, 247, 238],
  okLine: [163, 219, 189],
  ok: [21, 112, 70],
  warnBg: [255, 246, 228],
  warnLine: [240, 205, 140],
  warn: [138, 88, 12],
};

const PW = 210;
const PH = 297;
const M = 14;
const CW = PW - 2 * M;
const LIMIT = 272; // bas de la zone de contenu (le pied de page commence à 278)
const CONT_TOP = 31; // haut du contenu sur les pages « suite »

/* ---------- Polices ---------- */
function setupFonts(doc, fonts) {
  if (fonts) {
    try {
      const reg = (key, family, style) => {
        doc.addFileToVFS(fonts[key].file, fonts[key].data);
        doc.addFont(fonts[key].file, family, style);
      };
      reg('regular', 'Barlow', 'normal');
      reg('bold', 'Barlow', 'bold');
      reg('semibold', 'BarlowSemiBold', 'normal');
      reg('condSemi', 'BarlowCondensed', 'normal');
      reg('condBlack', 'BarlowCondensed', 'bold');
      return {
        latin1: false,
        regular: ['Barlow', 'normal'],
        semibold: ['BarlowSemiBold', 'normal'],
        bold: ['Barlow', 'bold'],
        cond: ['BarlowCondensed', 'normal'],
        black: ['BarlowCondensed', 'bold'],
      };
    } catch (err) {
      console.warn('[devis] polices Barlow refusées par jsPDF, repli sur Helvetica.', err);
    }
  }
  return {
    latin1: true,
    regular: ['helvetica', 'normal'],
    semibold: ['helvetica', 'bold'],
    bold: ['helvetica', 'bold'],
    cond: ['helvetica', 'bold'],
    black: ['helvetica', 'bold'],
  };
}

/** Texte sûr pour la police active (Helvetica : Latin-1 uniquement). */
function makeT(latin1) {
  const map = { '—': '-', '–': '-', '‑': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '•': '·', '…': '...', 'œ': 'oe', 'Œ': 'OE', '€': 'EUR', '№': 'N°' };
  return (s) => {
    const v = cleanSpaces(s);
    if (!latin1) return v;
    return v.replace(/[^\x00-\xff]/g, (ch) => map[ch] ?? '');
  };
}

/* ---------- PRNG déterministe (même devis = même givre) ---------- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/* ---------- Bandeau « nuit polaire » peint sur canvas ---------- */
/**
 * wave = [y0, c1x, c1y, c2x, c2y, y3] en mm : bord inférieur du marine (Bézier de x=0 à x=PW).
 * Retourne un JPEG (data URL) couvrant PW × hMm.
 */
function paintBand({ hMm, wave, seed, compact = false }) {
  const s = 8; // px par mm (≈ 203 dpi)
  const W = Math.round(PW * s);
  const H = Math.round(hMm * s);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const r = rng(seed);
  const [y0, c1x, c1y, c2x, c2y, y3] = wave.map((v) => v * s);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Forme marine (bord inférieur en vague)
  const navy = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, y3);
    ctx.bezierCurveTo(c2x, c2y, c1x, c1y, 0, y0);
    ctx.closePath();
  };

  ctx.save();
  navy();
  ctx.clip();

  // 1. Nuit polaire
  let g = ctx.createRadialGradient(W * 0.78, -H * 0.35, 0, W * 0.78, -H * 0.35, W * 0.95);
  g.addColorStop(0, '#24579f');
  g.addColorStop(0.28, '#143a78');
  g.addColorStop(0.62, '#0a1f44');
  g.addColorStop(1, '#050f27');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  g = ctx.createRadialGradient(W * 0.06, H * 1.05, 0, W * 0.06, H * 1.05, W * 0.45);
  g.addColorStop(0, 'rgba(42,125,235,0.38)');
  g.addColorStop(1, 'rgba(42,125,235,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 2. Gemme de glace facettée (reflet derrière « DEVIS »)
  const gem = (cx, cy, R, rot, strength) => {
    const outer = [];
    const inner = [];
    for (let i = 0; i < 6; i++) {
      const a = rot + (Math.PI / 3) * i;
      outer.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
      const b = a + Math.PI / 6;
      inner.push([cx + Math.cos(b) * R * 0.46, cy + Math.sin(b) * R * 0.46]);
    }
    const facet = (pts, alpha) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      const lg = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
      lg.addColorStop(0, `rgba(227,243,255,${alpha})`);
      lg.addColorStop(1, `rgba(142,207,255,${alpha * 0.25})`);
      ctx.fillStyle = lg;
      ctx.fill();
      ctx.strokeStyle = `rgba(191,228,255,${0.16 * strength})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    };
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      facet([outer[i], outer[j], inner[i]], (0.02 + r() * 0.07) * strength);
      facet([inner[i], outer[j], inner[j]], (0.015 + r() * 0.05) * strength);
      facet([[cx, cy], inner[i], inner[j]], (0.03 + r() * 0.06) * strength);
    }
  };
  if (compact) {
    gem(W * 0.86, H * 0.2, H * 1.6, 0.18, 0.8);
  } else {
    gem(W * 0.83, H * 0.36, H * 0.86, 0.12, 1);
    gem(W * 0.6, H * 0.02, H * 0.42, 0.5, 0.55);
  }

  // 3. Reflet diagonal (vitrine)
  ctx.save();
  ctx.translate(W * 0.47, 0);
  ctx.rotate(0.38);
  g = ctx.createLinearGradient(-W * 0.08, 0, W * 0.08, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.075)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-W * 0.08, -H, W * 0.16, H * 3);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(W * 0.1, -H, W * 0.012, H * 3);
  ctx.restore();

  // 4. Givre sur le bord supérieur
  g = ctx.createLinearGradient(0, 0, 0, H * 0.22);
  g.addColorStop(0, 'rgba(191,228,255,0.16)');
  g.addColorStop(1, 'rgba(191,228,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.22);

  // 5. Cristaux de neige (étoiles à six branches)
  const flake = (x, y, R, rot, alpha, lw) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = `rgba(227,243,255,${alpha})`;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -R);
      for (const k of [0.42, 0.68]) {
        const b = R * (k === 0.42 ? 0.3 : 0.22);
        ctx.moveTo(0, -R * k);
        ctx.lineTo(-b * 0.8, -R * k - b);
        ctx.moveTo(0, -R * k);
        ctx.lineTo(b * 0.8, -R * k - b);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  const flakes = compact
    ? [[0.57, 0.38, 3.2], [0.71, 0.72, 2.2], [0.36, 0.3, 1.8]]
    : [[0.585, 0.33, 7.5], [0.47, 0.72, 4.2], [0.72, 0.84, 3.4], [0.965, 0.15, 5.2], [0.4, 0.16, 2.6], [0.66, 0.12, 2.4]];
  for (const [fx, fy, fr] of flakes) flake(fx * W, fy * H, fr * s, r() * Math.PI, 0.1 + r() * 0.12, Math.max(1.2, fr * 0.22));

  // 6. Particules de givre (quelques-unes avec halo)
  const count = compact ? 160 : 420;
  for (let i = 0; i < count; i++) {
    const x = Math.pow(r(), 0.85) * W;
    const y = Math.pow(r(), 1.35) * H;
    const rad = 0.35 + Math.pow(r(), 3) * 2.3;
    const a = 0.12 + r() * 0.5;
    if (r() < 0.1) {
      const hg = ctx.createRadialGradient(x, y, 0, x, y, rad * 5);
      hg.addColorStop(0, `rgba(191,228,255,${a * 0.5})`);
      hg.addColorStop(1, 'rgba(191,228,255,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(x - rad * 5, y - rad * 5, rad * 10, rad * 10);
    }
    ctx.fillStyle = `rgba(243,250,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore(); // fin du clip marine

  // 7. Vague bleue de la marque sous le marine (ruban effilé + liseré glace)
  const ribbon = (offA, offB, offC, colors, alpha) => {
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, W, y3);
    ctx.lineTo(W, y3 + offC * s);
    ctx.bezierCurveTo(c2x, c2y + offB * s, c1x, c1y + offA * s, 0, y0 + 0.2 * s);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, 0, W, 0);
    colors.forEach(([stop, col]) => lg.addColorStop(stop, col));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  const k = compact ? 0.55 : 1;
  ribbon(6.2 * k, 4.2 * k, 2.2 * k, [[0, '#bfe4ff'], [0.25, '#8ecfff'], [1, '#bfe4ff']], 0.55);
  ribbon(3.6 * k, 2.6 * k, 1.1 * k, [[0, '#0f4fb3'], [0.45, '#1563d6'], [0.8, '#2a7deb'], [1, '#4d9bff']], 1);

  // liseré lumineux sur l'arête du marine
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, W, y3);
  ctx.strokeStyle = 'rgba(142,207,255,0.85)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  return c.toDataURL('image/jpeg', 0.9);
}

/* ---------- Générateur ---------- */
export async function buildPdf(q, { fonts = null, logo = null } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const F = setupFonts(doc, fonts);
  const T = makeT(F.latin1);
  const number = q.number || '';
  const lines = (q.lines || []).filter((l) => l && l.qty > 0);
  const waText = whatsappMessage(q);
  const waHref = whatsappUrl(waText);

  doc.setProperties({
    title: T(`Devis ${number} — ${BRAND.name}`),
    subject: T(`Devis glace alimentaire — ${BRAND.name}, ${BRAND.signature}`),
    author: T(`${BRAND.name} — ${BRAND.parent}`),
    keywords: 'devis, glace alimentaire, glaçons, Abidjan',
    creator: T(BRAND.name),
  });
  if (doc.setLanguage) doc.setLanguage('fr-FR');
  doc.setLineHeightFactor(1.2);

  /* -- petits outils de dessin -- */
  const font = (key, size, color = C.ink) => {
    doc.setFont(...F[key]);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const fill = (col) => doc.setFillColor(...col);
  const stroke = (col, w = 0.2) => {
    doc.setDrawColor(...col);
    doc.setLineWidth(w);
  };
  const width = (s) => doc.getTextWidth(T(s));
  /** Texte avec interlettrage (cs en mm) et alignement géré à la main. */
  const spaced = (s, x, y, { cs = 0, align = 'left' } = {}) => {
    const str = T(s);
    const w = doc.getTextWidth(str) + cs * Math.max(0, str.length - 1);
    const sx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    doc.text(str, sx, y, cs ? { charSpace: cs } : undefined);
    return w;
  };
  const text = (s, x, y, opts) => doc.text(T(s), x, y, opts);
  const wrap = (s, w) => doc.splitTextToSize(T(s), w);
  const withAlpha = (a, fn) => {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: a, 'stroke-opacity': a }));
    fn();
    doc.restoreGraphicsState();
  };
  const link = (x, y, w, h, url) => doc.link(x, y, w, h, { url });

  /* -- images -- */
  const fullBand = paintBand({ hMm: 64, wave: [51, 62, 59, 128, 38.5, 46], seed: `${number}-full` });
  let compactBand = null;
  const logoImg = logo?.dataUrl ? logo : null;

  const drawLogo = (x, y, w) => {
    if (logoImg) {
      doc.addImage(logoImg.dataUrl, 'PNG', x, y, w, w * logoImg.ratio, 'lg-logo-white', 'FAST');
      return w * logoImg.ratio;
    }
    // Repli texte
    font('black', w * 0.36, C.white);
    spaced('LE GLACEUR', x, y + w * 0.13, { cs: 0.2 });
    font('cond', w * 0.11, C.ice300);
    spaced(BRAND.signature.toUpperCase(), x, y + w * 0.2, { cs: 0.6 });
    return w * 0.22;
  };

  /* ---------------- 1. Bandeau ---------------- */
  doc.addImage(fullBand, 'JPEG', 0, 0, PW, 64, 'lg-band-full', 'NONE');
  drawLogo(M, 11.5, 70);
  font('cond', 7.6, C.ice300);
  spaced(BRAND.values.map((v) => v.label.toUpperCase()).join('  ·  '), M + 0.6, 41.2, { cs: 0.55 });

  font('black', 46, C.white);
  spaced('DEVIS', PW - M, 27.5, { cs: 1.2, align: 'right' });
  font('cond', 12.5, C.white);
  spaced(`N°${NBSP}${number}`, PW - M, 34.6, { cs: 0.35, align: 'right' });
  font('regular', 8.4, C.ice200);
  text(`Établi le ${formatQuoteDate(q.date)}  ·  valable jusqu’au ${formatQuoteDate(q.validUntil)}`, PW - M, 40.2, { align: 'right' });

  /* ---------------- 2. Accueil + cartes ---------------- */
  let y = 72;
  const name = cleanSpaces(q.client?.name || '').trim();
  {
    const parts = name
      ? [['regular', 'Merci '], ['semibold', name], ['regular', ` pour votre demande. Voici le détail de votre devis${NBSP}:`]]
      : [['regular', `Merci pour votre demande. Voici le détail de votre devis${NBSP}:`]];
    let total = 0;
    for (const [k, s] of parts) {
      font(k, 10.2);
      total += width(s);
    }
    if (total > CW) parts.splice(0, parts.length, ['regular', `Merci pour votre demande. Voici le détail de votre devis${NBSP}:`]);
    let x = M;
    for (const [k, s] of parts) {
      font(k, 10.2, k === 'semibold' ? C.ink : C.muted);
      text(s, x, y);
      x += width(s);
    }
  }
  y += 6;

  const cardW = (CW - 6) / 2;
  const icon = (kind, cx, cy) => {
    fill(C.blue);
    doc.circle(cx, cy, 3.4, 'F');
    withAlpha(0.35, () => {
      fill(C.ice300);
      doc.circle(cx - 0.9, cy - 1, 1.6, 'F');
    });
    fill(C.white);
    stroke(C.white, 0.35);
    if (kind === 'client') {
      doc.circle(cx, cy - 1, 0.95, 'F');
      doc.moveTo(cx - 1.75, cy + 1.95);
      doc.curveTo(cx - 1.75, cy + 0.25, cx + 1.75, cy + 0.25, cx + 1.75, cy + 1.95);
      doc.close();
      doc.fill();
    } else if (kind === 'truck') {
      doc.rect(cx - 2.1, cy - 1.25, 2.6, 2.05, 'F');
      doc.moveTo(cx + 0.75, cy - 0.55);
      doc.lineTo(cx + 1.55, cy - 0.55);
      doc.lineTo(cx + 2.2, cy + 0.15);
      doc.lineTo(cx + 2.2, cy + 0.8);
      doc.lineTo(cx + 0.75, cy + 0.8);
      doc.close();
      doc.fill();
      fill(C.blue);
      doc.circle(cx - 1.2, cy + 1.05, 0.62, 'F');
      doc.circle(cx + 1.35, cy + 1.05, 0.62, 'F');
      fill(C.white);
      doc.circle(cx - 1.2, cy + 1.05, 0.38, 'F');
      doc.circle(cx + 1.35, cy + 1.05, 0.38, 'F');
    } else {
      // repère (retrait)
      doc.moveTo(cx, cy + 2.3);
      doc.lineTo(cx - 1.35, cy - 0.15);
      doc.curveTo(cx - 2.05, cy - 2.2, cx + 2.05, cy - 2.2, cx + 1.35, cy - 0.15);
      doc.close();
      doc.fill();
      fill(C.blue);
      doc.circle(cx, cy - 0.75, 0.6, 'F');
    }
  };

  const layoutRows = (rows, valueW) => {
    font('semibold', 9.4);
    return rows.map(([label, value]) => {
      const ls = wrap(value, valueW).slice(0, 3);
      return { label, lines: ls, h: Math.max(1, ls.length) * 4.1 + 2.2 };
    });
  };
  const cardHeader = 14;
  const valueX = 25;
  const cRows = layoutRows(clientRows(q), cardW - valueX - 5);
  const dRows = layoutRows(deliveryRows(q), cardW - valueX - 5);
  const cardH = cardHeader + Math.max(cRows.reduce((a, r) => a + r.h, 0), dRows.reduce((a, r) => a + r.h, 0)) + 3.5;

  const card = (x, title, kind, rows, pill) => {
    fill(C.ice50);
    stroke(C.ice200, 0.3);
    doc.roundedRect(x, y, cardW, cardH, 3.2, 3.2, 'FD');
    // liseré glace en haut
    withAlpha(0.9, () => {
      fill(C.white);
      doc.roundedRect(x + 0.6, y + 0.6, cardW - 1.2, cardHeader - 2.4, 2.6, 2.6, 'F');
    });
    icon(kind, x + 8.2, y + 7);
    font('black', 11, C.ink);
    spaced(title, x + 14.4, y + 8.6, { cs: 0.45 });
    if (pill) {
      font('cond', 7.6, pill.color);
      const pw = width(pill.text) + 0.3 * (pill.text.length - 1) + 6;
      fill(pill.bg);
      stroke(pill.line, 0.25);
      doc.roundedRect(x + cardW - 5 - pw, y + 4, pw, 5.6, 2.8, 2.8, 'FD');
      spaced(pill.text, x + cardW - 5 - pw / 2, y + 7.75, { cs: 0.3, align: 'center' });
    }
    stroke(C.ice200, 0.25);
    doc.line(x + 4, y + cardHeader - 1.2, x + cardW - 4, y + cardHeader - 1.2);
    let ry = y + cardHeader + 3.4;
    for (const row of rows) {
      font('regular', 8, C.soft);
      text(row.label, x + 5, ry);
      font('semibold', 9.4, C.ink);
      row.lines.forEach((ln, i) => text(ln, x + valueX, ry + i * 4.1));
      ry += row.h;
    }
  };

  const pickup = isPickup(q);
  const free = isFree(q);
  const statusPill = pickup
    ? { text: 'GRATUIT', bg: C.ice100, line: C.ice300, color: C.blue }
    : free
      ? { text: 'LIVRAISON OFFERTE', bg: C.okBg, line: C.okLine, color: C.ok }
      : { text: 'HORS FRAIS', bg: C.warnBg, line: C.warnLine, color: C.warn };

  card(M, 'CLIENT', 'client', cRows, null);
  card(M + cardW + 6, pickup ? 'RETRAIT SUR PLACE' : 'LIVRAISON', pickup ? 'pin' : 'truck', dRows, statusPill);
  if (pickup) link(M + cardW + 6, y + cardHeader, cardW, cardH - cardHeader, mapsUrl);
  y += cardH + 9;

  /* ---------------- 3. Tableau ---------------- */
  const eyebrow = (s, x, yy, color = C.blue) => {
    font('cond', 8.2, color);
    fill(color);
    doc.rect(x, yy - 2.25, 4.5, 0.6, 'F');
    spaced(s, x + 6.5, yy, { cs: 0.6 });
  };

  const drawCompactHeader = () => {
    compactBand ??= paintBand({ hMm: 24, wave: [18.5, 62, 21.5, 128, 13.5, 16.5], seed: `${number}-compact`, compact: true });
    doc.addImage(compactBand, 'JPEG', 0, 0, PW, 24, 'lg-band-compact', 'NONE');
    drawLogo(M, 3.4, 37);
    font('cond', 10.5, C.white);
    spaced(`DEVIS N°${NBSP}${number}`, PW - M, 9.4, { cs: 0.35, align: 'right' });
    font('regular', 7.8, C.ice200);
    text('suite', PW - M, 13.6, { align: 'right' });
  };

  eyebrow(`VOTRE COMMANDE  ·  ${lines.length} ${lines.length > 1 ? 'RÉFÉRENCES' : 'RÉFÉRENCE'}`, M, y);
  y += 3.5;

  const head = ['Désignation', 'Format', 'Qté', 'Prix unitaire', 'Montant'];
  const aligns = ['left', 'left', 'center', 'right', 'right'];
  const body = lines.length
    ? lines.map((l) => [l.name, formatCell(l), qtyCell(l), money(l.price), money(l.total)])
    : [['Aucun article sélectionné', '', '', '', '']];

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: CONT_TOP + 3, bottom: PH - LIMIT + 2 },
    head: [head],
    body: body.map((r) => r.map((v) => T(v))),
    theme: 'plain',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: F.regular[0],
      fontStyle: F.regular[1],
      fontSize: 9.4,
      textColor: C.ink,
      cellPadding: { top: 2.6, bottom: 2.6, left: 3.2, right: 3.2 },
      lineColor: C.ice200,
      lineWidth: { bottom: 0.2 },
      valign: 'middle',
      minCellHeight: 11.2,
      overflow: 'ellipsize',
    },
    headStyles: { fillColor: C.ink, textColor: C.white, minCellHeight: 9, lineWidth: 0 },
    alternateRowStyles: { fillColor: C.ice50 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 36, textColor: C.muted },
      2: { cellWidth: 19, halign: 'center', font: F.semibold[0], fontStyle: F.semibold[1], fontSize: 10.2 },
      3: { cellWidth: 31, halign: 'right', textColor: C.muted },
      4: { cellWidth: 34, halign: 'right', font: F.semibold[0], fontStyle: F.semibold[1] },
    },
    didParseCell(data) {
      if (data.section === 'head') {
        data.cell.styles.halign = aligns[data.column.index];
        data.cell.text = ['']; // dessiné à la main (interlettrage)
      } else if (data.section === 'body' && data.column.index === 0) {
        data.cell.text = [''];
      }
    },
    didDrawCell(data) {
      const { cell } = data;
      const i = data.column.index;
      if (data.section === 'head') {
        font('cond', 8.4, C.white);
        const label = head[i].toUpperCase();
        const x = aligns[i] === 'right' ? cell.x + cell.width - 3.2 : aligns[i] === 'center' ? cell.x + cell.width / 2 : cell.x + 3.2;
        spaced(label, x, cell.y + cell.height / 2 + 1.05, { cs: 0.45, align: aligns[i] });
        fill(C.ice300);
        doc.rect(cell.x, cell.y + cell.height - 0.55, cell.width, 0.55, 'F');
      } else if (data.section === 'body' && i === 0) {
        const l = lines[data.row.index];
        const alias = l ? productAlias(l) : '';
        const maxW = cell.width - 6.4;
        const cy = cell.y + cell.height / 2;
        font('semibold', 9.6, l ? C.ink : C.soft);
        let nm = T(l ? l.name : body[0][0]);
        while (doc.getTextWidth(nm) > maxW && nm.length > 4) nm = `${nm.slice(0, -2)}…`;
        if (alias) {
          text(nm, cell.x + 3.2, cy - 0.45);
          font('regular', 7.4, C.soft);
          text(alias, cell.x + 3.2, cy + 3.15);
        } else {
          text(nm, cell.x + 3.2, cy + 1.2);
        }
      }
    },
    didDrawPage() {
      if (doc.internal.getCurrentPageInfo().pageNumber > 1) drawCompactHeader();
    },
  });

  y = doc.lastAutoTable.finalY;

  const newPage = () => {
    doc.addPage();
    drawCompactHeader();
    return CONT_TOP + 2;
  };

  /* ---------------- 4. Totaux ---------------- */
  const pending = excludesDelivery(q);
  const transport = transportText(q);
  const rightX = M + CW - 86;
  const rightW = 86;
  font('semibold', 9.2);
  const transportLines = wrap(transport, rightW - 31);
  const totalsH = 8 + 7.2 + 4.6 * transportLines.length + 4 + (pending ? 21 : 18);
  const leftH = 46;
  const blockH = Math.max(totalsH, leftH) + 6;
  if (y + blockH > LIMIT) y = newPage();
  else y += 7;

  // -- colonne droite : totaux
  {
    let ty = y + 5;
    font('regular', 9.4, C.muted);
    text('Sous-total', rightX + 4, ty);
    font('semibold', 10.4, C.ink);
    text(money(q.subtotal), rightX + rightW - 4, ty, { align: 'right' });
    ty += 7.2;
    font('regular', 9.4, C.muted);
    text('Transport', rightX + 4, ty);
    font('semibold', 9.2, pickup ? C.blue : free ? C.ok : C.warn);
    transportLines.forEach((ln, i) => text(ln, rightX + rightW - 4, ty + i * 4.4, { align: 'right' }));
    ty += 4.4 * (transportLines.length - 1) + 4.2;
    stroke(C.ice200, 0.3);
    doc.line(rightX + 4, ty, rightX + rightW - 4, ty);
    ty += 3.4;

    // barre TOTAL facettée
    const bh = pending ? 21 : 18;
    fill(C.ink);
    doc.roundedRect(rightX, ty, rightW, bh, 3.4, 3.4, 'F');
    withAlpha(0.07, () => {
      fill(C.white);
      doc.triangle(rightX + rightW * 0.52, ty, rightX + rightW - 3.4, ty, rightX + rightW * 0.74, ty + bh, 'F');
      doc.triangle(rightX + rightW * 0.3, ty, rightX + rightW * 0.52, ty, rightX + rightW * 0.42, ty + bh, 'F');
    });
    withAlpha(0.12, () => {
      fill(C.ice300);
      doc.triangle(rightX + rightW * 0.74, ty + bh, rightX + rightW, ty + bh * 0.35, rightX + rightW, ty + bh, 'F');
    });
    withAlpha(0.8, () => {
      stroke(C.ice300, 0.35);
      doc.line(rightX + 3.4, ty + 0.35, rightX + rightW - 3.4, ty + 0.35);
    });
    font('black', 15, C.white);
    spaced('TOTAL', rightX + 5.5, ty + (pending ? 9.4 : 11.2), { cs: 0.7 });
    if (pending) {
      font('regular', 7.6, C.ice300);
      text(`(${DELIVERY.paidLabel.toLowerCase()})`, rightX + 5.5, ty + 14.6);
    }
    font('black', 21, C.white);
    text(money(q.total), rightX + rightW - 5.5, ty + bh / 2 + 2.9, { align: 'right' });
  }

  // -- colonne gauche : articles, poids, état de la livraison
  {
    const lw = CW - rightW - 7;
    const tileW = (lw - 4) / 2;
    const stat = (x, label, value, sub) => {
      fill(C.white);
      stroke(C.ice200, 0.3);
      doc.roundedRect(x, y, tileW, 17, 2.6, 2.6, 'FD');
      font('cond', 7.4, C.soft);
      spaced(label, x + 4, y + 5.4, { cs: 0.45 });
      font('black', 16, C.ink);
      const vw = width(value);
      text(value, x + 4, y + 13.2);
      if (sub) {
        font('regular', 7, C.soft);
        text(sub, x + 4 + vw + 1.6, y + 13.2);
      }
    };
    const noWeight = lines.filter((l) => !l.kg).map((l) => l.units).filter(Boolean);
    stat(M, 'ARTICLES', num(q.count || 0), (q.count || 0) > 1 ? 'au total' : '');
    stat(M + tileW + 4, 'POIDS INDICATIF', q.totalKg > 0 ? `${num(q.totalKg)}${NBSP}kg` : '—', noWeight.length && q.totalKg > 0 ? `hors ${noWeight.join(', ')}` : '');

    // état livraison
    const by = y + 21;
    const bw = lw;
    let title;
    let sub;
    let palette;
    if (pickup) {
      title = `Retrait gratuit à ${BRAND.address.street}`;
      sub = `Ouvert ${BRAND.hours.replace(/\s*·\s*/, ' et ')} — voir l’itinéraire`;
      palette = { bg: C.ice50, line: C.ice200, color: C.blue };
    } else if (free) {
      title = 'Livraison offerte';
      sub = `Votre commande compte ${num(q.count)} articles : offerte dès ${freeFrom(q)} articles.`;
      palette = { bg: C.okBg, line: C.okLine, color: C.ok };
    } else {
      const n = remainingForFree(q);
      title = `Plus que ${n} article${n > 1 ? 's' : ''} pour la livraison offerte`;
      sub = DELIVERY.paidNote;
      palette = { bg: C.warnBg, line: C.warnLine, color: C.warn };
    }
    font('regular', 7.6);
    const subLines = wrap(sub, bw - 15).slice(0, 3);
    const bh = 9.6 + subLines.length * 3.6;
    fill(palette.bg);
    stroke(palette.line, 0.3);
    doc.roundedRect(M, by, bw, bh, 2.6, 2.6, 'FD');
    // pictogramme : coche (offerte) / repère / flocon
    const ix = M + 6.2;
    const iy = by + 6;
    fill(palette.color);
    doc.circle(ix, iy, 2.9, 'F');
    stroke(C.white, 0.55);
    doc.setLineCap('round');
    if (free) {
      doc.line(ix - 1.3, iy + 0.1, ix - 0.35, iy + 1.1);
      doc.line(ix - 0.35, iy + 1.1, ix + 1.45, iy - 0.95);
    } else {
      for (let a = 0; a < 3; a++) {
        const ang = (Math.PI / 3) * a + Math.PI / 6;
        doc.line(ix - Math.cos(ang) * 1.7, iy - Math.sin(ang) * 1.7, ix + Math.cos(ang) * 1.7, iy + Math.sin(ang) * 1.7);
      }
    }
    doc.setLineCap('butt');
    font('semibold', 9.2, palette.color);
    const tl = wrap(title, bw - 15)[0];
    text(tl, M + 11.5, by + 6.6);
    font('regular', 7.6, C.muted);
    subLines.forEach((ln, i) => text(ln, M + 11.5, by + 10.6 + i * 3.6));
    if (pickup) link(M, by, bw, bh, mapsUrl);
  }
  y += blockH;

  /* ---------------- 4 bis. Note du client ---------------- */
  const note = cleanSpaces(q.client?.note || '').trim();
  if (note) {
    font('regular', 8.6);
    const nl = wrap(note, CW - 10).slice(0, 6);
    const nh = 11 + nl.length * 4;
    if (y + nh > LIMIT) y = newPage();
    eyebrow('VOTRE NOTE', M, y + 2);
    font('regular', 8.6, C.muted);
    nl.forEach((ln, i) => text(ln, M + 6.5, y + 8 + i * 4));
    y += nh;
  }

  /* ---------------- 5. Appel à l'action WhatsApp ---------------- */
  const ctaH = 47;
  if (y + ctaH + 4 > LIMIT) y = newPage();
  else y += 2;
  {
    const x = M;
    fill(C.ice50);
    stroke(C.ice200, 0.3);
    doc.roundedRect(x, y, CW, ctaH, 4, 4, 'FD');
    // reflets givrés dans l'angle
    withAlpha(0.55, () => {
      fill(C.ice100);
      doc.triangle(x + CW - 62, y + 0.15, x + CW - 44, y + 0.15, x + CW - 70, y + ctaH - 0.15, 'F');
    });

    eyebrow('ÉTAPE SUIVANTE', x + 7, y + 8.6);
    font('black', 15.5, C.ink);
    text('Validez votre commande sur WhatsApp', x + 7, y + 16.4);
    font('regular', 8.5, C.muted);
    const desc = wrap(
      `Cliquez sur le bouton : la discussion s’ouvre avec votre devis prérempli. Joignez-y ce PDF, ${BRAND.name} vous confirme la commande et le transport.`,
      CW - 62,
    ).slice(0, 2);
    desc.forEach((ln, i) => text(ln, x + 7, y + 22 + i * 3.9));

    // Bouton
    const bx = x + 7;
    const by = y + 30.4;
    const bw = 104;
    const bh = 11.6;
    withAlpha(0.18, () => {
      fill(C.wa);
      doc.roundedRect(bx + 0.6, by + 1.2, bw, bh, bh / 2, bh / 2, 'F');
    });
    fill(C.wa);
    doc.roundedRect(bx, by, bw, bh, bh / 2, bh / 2, 'F');
    withAlpha(0.14, () => {
      fill(C.white);
      doc.roundedRect(bx + 1.2, by + 0.8, bw - 2.4, bh / 2 - 0.6, bh / 4, bh / 4, 'F');
    });
    // bulle de discussion
    const cx = bx + 8.2;
    const cy = by + bh / 2;
    stroke(C.white, 0.5);
    doc.circle(cx, cy, 3, 'S');
    fill(C.white);
    doc.triangle(cx - 2.6, cy + 1.3, cx - 3.4, cy + 3.5, cx - 0.9, cy + 2.75, 'F');
    fill(C.wa);
    doc.circle(cx, cy, 2.55, 'F');
    fill(C.white);
    [-1.15, 0, 1.15].forEach((d) => doc.circle(cx + d, cy, 0.42, 'F'));
    font('black', 12.6, C.white);
    spaced('ENVOYER CE DEVIS SUR WHATSAPP', bx + 14.6, cy + 1.6, { cs: 0.35 });
    // chevron
    stroke(C.white, 0.6);
    doc.setLineCap('round');
    doc.line(bx + bw - 7.4, cy - 1.8, bx + bw - 5.6, cy);
    doc.line(bx + bw - 5.6, cy, bx + bw - 7.4, cy + 1.8);
    doc.setLineCap('butt');
    link(bx, by, bw, bh, waHref);

    // QR code
    const qs = 33;
    const qx = x + CW - 7 - qs;
    const qy = y + 5.5;
    fill(C.white);
    stroke(C.ice200, 0.3);
    doc.roundedRect(qx, qy, qs, qs, 2.8, 2.8, 'FD');
    drawQr(doc, q, waText, qx + 2.5, qy + 2.5, qs - 5);
    font('regular', 7, C.soft);
    text('Scannez pour ouvrir WhatsApp', qx + qs / 2, qy + qs + 4.2, { align: 'center' });
    link(qx, qy, qs, qs, waHref);

    font('semibold', 7.8, C.muted);
    text(`WhatsApp ${BRAND.phones[0].display}`, bx + bw + 4, cy + 1.3);
  }
  y += ctaH + 7;

  /* ---------------- 6. Mentions ---------------- */
  const mentions = [
    QUOTE.payment,
    QUOTE.deliveryNote,
    `Devis valable ${QUOTE.validityDays}${NBSP}jours, jusqu’au ${formatQuoteDate(q.validUntil)}. Prix en ${QUOTE.currency}, poids indiqués à titre indicatif.`,
  ];
  font('regular', 7.8);
  const mLines = mentions.map((m) => wrap(m, CW - 6));
  const mh = mLines.reduce((a, l) => a + l.length * 3.6 + 1.2, 0) + 7;
  if (y + mh > LIMIT) y = newPage();
  mLines.forEach((ls) => {
    fill(C.ice300);
    doc.circle(M + 1.2, y - 1.1, 0.7, 'F');
    font('regular', 7.8, C.muted);
    ls.forEach((ln, i) => text(ln, M + 4.5, y + i * 3.6));
    y += ls.length * 3.6 + 1.2;
  });
  y += 1.6;
  font('semibold', 8.6, C.ink);
  text(QUOTE.disclaimer, M, y + 1);

  /* ---------------- Pied de page (toutes les pages) ---------------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawFooter(p, pages);
  }

  function drawFooter(p, total) {
    const fy = 279;
    stroke(C.ice200, 0.3);
    doc.line(M, fy, PW - M, fy);
    fill(C.blue);
    doc.rect(M, fy - 0.35, 18, 0.7, 'F');

    // Colonne 1 : signature + adresse
    font('black', 9, C.ink);
    spaced(`${BRAND.name.toUpperCase()}`, M, fy + 5.4, { cs: 0.35 });
    const sw = width(BRAND.name.toUpperCase()) + 0.35 * (BRAND.name.length - 1);
    font('cond', 8, C.blue);
    text(` — ${BRAND.signature}`, M + sw, fy + 5.4);
    font('regular', 7.2, C.muted);
    text(`${BRAND.address.street}, ${BRAND.address.city}  ·  ${BRAND.hours}`, M, fy + 9.4);
    link(M, fy + 6.6, 70, 3.6, mapsUrl);

    // Colonne 2 : téléphones et e-mail (cliquables)
    const cx = 104;
    const seg = (parts, yy) => {
      let x = cx;
      for (const [str, url, k = 'regular', col = C.muted] of parts) {
        font(k, 7.2, col);
        text(str, x, yy);
        const w = width(str);
        if (url) link(x, yy - 2.8, w, 3.6, url);
        x += w;
      }
    };
    const [p1, p2, p3] = BRAND.phones;
    seg([
      ['WhatsApp ', null],
      [p1.display, `https://wa.me/${BRAND.whatsapp}`, 'semibold', C.ink],
      ['  ·  ', null],
      [p2.display, `tel:${p2.tel}`, 'semibold', C.ink],
    ], fy + 5.4);
    seg([
      ['Fixe ', null],
      [p3.display, `tel:${p3.tel}`, 'semibold', C.ink],
      ['  ·  ', null],
      [BRAND.email, `mailto:${BRAND.email}?subject=${encodeURIComponent(`Devis ${number}`)}`, 'semibold', C.blue],
    ], fy + 9.4);

    // Colonne 3 : pagination
    font('semibold', 7.6, C.ink);
    text(`Page ${p} / ${total}`, PW - M, fy + 5.4, { align: 'right' });
    font('regular', 7.2, C.soft);
    text(`N°${NBSP}${number}`, PW - M, fy + 9.4, { align: 'right' });
  }

  return doc.output('blob');
}

/* ---------- QR code vectoriel ---------- */
function drawQr(doc, q, waText, x, y, size) {
  let qr;
  try {
    qr = QRCode.create(whatsappUrl(waText), { errorCorrectionLevel: 'M' });
    // Au-delà de la version 16 (81 modules), le code devient trop dense pour être scanné sur papier :
    // on encode alors un message court (n° de devis, total, nom) vers la même discussion WhatsApp.
    if (qr.version > 16) throw new Error('trop dense');
  } catch {
    qr = QRCode.create(whatsappUrl(shortWhatsappMessage(q)), { errorCorrectionLevel: 'M' });
  }
  const n = qr.modules.size;
  const data = qr.modules.data;
  const cell = size / n;
  const inFinder = (cx, cy) => (cx < 7 && cy < 7) || (cx >= n - 7 && cy < 7) || (cx < 7 && cy >= n - 7);
  doc.setFillColor(...C.ink);
  for (let row = 0; row < n; row++) {
    let col = 0;
    while (col < n) {
      if (data[row * n + col] && !inFinder(col, row)) {
        const start = col;
        while (col < n && data[row * n + col] && !inFinder(col, row)) col++;
        doc.rect(x + start * cell, y + row * cell, (col - start) * cell + 0.02, cell + 0.02, 'F');
      } else col++;
    }
  }
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    const ox = x + fx * cell;
    const oy = y + fy * cell;
    doc.setFillColor(...C.ink);
    doc.roundedRect(ox, oy, 7 * cell, 7 * cell, 1.8 * cell, 1.8 * cell, 'F');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(ox + cell, oy + cell, 5 * cell, 5 * cell, 1.2 * cell, 1.2 * cell, 'F');
    doc.setFillColor(...C.blue);
    doc.roundedRect(ox + 2 * cell, oy + 2 * cell, 3 * cell, 3 * cell, 0.9 * cell, 0.9 * cell, 'F');
  }
}
