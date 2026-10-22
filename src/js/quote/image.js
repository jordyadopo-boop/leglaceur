/**
 * Devis en image (PNG 1080 px de large) dessiné au canvas 2D, pratique à partager sur WhatsApp.
 * Même contenu que le PDF : bandeau marine, client, livraison, lignes, total, mentions.
 */
import { BRAND, QUOTE } from '../config.js';
import { money, clientRows, deliveryRows, transportText, totalLabel, formatQuoteDate, formatCell, qtyCell } from './message.js';

const BASE = import.meta.env.BASE_URL || '/';
const W = 1080;
const PAD = 64;
const INK = '#0a1f44';
const BLUE = '#1e7bd8';
const ICE = '#e3f3ff';
const MUTED = '#5b6b85';
const LINE = '#d6e4f3';

const FACES = [
  ['GlcBody', 'Barlow-Regular.ttf', '400'],
  ['GlcBody', 'Barlow-SemiBold.ttf', '600'],
  ['GlcBody', 'Barlow-Bold.ttf', '700'],
  ['GlcCond', 'BarlowCondensed-ExtraBold.ttf', '800'],
];
let fontsReady = null;

/** Polices Barlow chargées dans le document (repli système si indisponibles). */
function loadFonts() {
  fontsReady ??= Promise.all(FACES.map(async ([family, file, weight]) => {
    const face = new FontFace(family, `url(${BASE}fonts/${file})`, { weight });
    document.fonts.add(await face.load());
  })).catch(() => {});
  return fontsReady;
}

const font = (size, weight = 400, cond = false) => `${weight} ${size}px ${cond ? 'GlcCond' : 'GlcBody'}, Arial, sans-serif`;

/** Coupe un texte en lignes tenant dans maxW. */
function wrap(ctx, text, maxW) {
  const words = String(text ?? '').split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

/** Bloc « libellé : valeur » sur colonne de largeur w ; renvoie la hauteur utilisée. */
function rowsBlock(ctx, title, rows, x, y, w, draw) {
  let h = 0;
  if (draw) { ctx.font = font(22, 800, true); ctx.fillStyle = BLUE; ctx.fillText(title.toUpperCase(), x, y + 22); }
  h += 40;
  for (const [k, v] of rows) {
    ctx.font = font(22, 400);
    const lines = wrap(ctx, v, w - 150);
    if (draw) {
      ctx.fillStyle = MUTED; ctx.fillText(k, x, y + h + 22);
      ctx.fillStyle = INK; ctx.font = font(22, 600);
      lines.forEach((l, i) => ctx.fillText(l, x + 150, y + h + 22 + i * 30));
    }
    h += lines.length * 30 + 8;
  }
  return h;
}

function layout(ctx, q, logo, draw) {
  let y = 0;
  // Bandeau
  const bandH = 230;
  if (draw) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, W, bandH);
    if (logo) { const lw = 330; ctx.drawImage(logo.img, PAD, (bandH - lw * logo.ratio) / 2, lw, lw * logo.ratio); }
    else { ctx.fillStyle = '#fff'; ctx.font = font(52, 800, true); ctx.fillText(BRAND.name.toUpperCase(), PAD, 130); }
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    ctx.font = font(64, 800, true); ctx.fillText('DEVIS', W - PAD, 96);
    ctx.font = font(24, 600); ctx.fillText(`N° ${q.number}`, W - PAD, 136);
    ctx.font = font(21, 400); ctx.fillStyle = '#bcd6f2';
    ctx.fillText(`Émis le ${formatQuoteDate(q.date)}`, W - PAD, 168);
    if (q.validUntil) ctx.fillText(`Valable jusqu’au ${formatQuoteDate(q.validUntil)}`, W - PAD, 196);
    ctx.textAlign = 'left';
  }
  y = bandH + 48;

  // Client | Livraison
  const colW = (W - PAD * 2 - 40) / 2;
  const isPickup = q.delivery?.mode === 'retrait';
  const h1 = rowsBlock(ctx, 'Client', clientRows(q), PAD, y, colW, draw);
  const h2 = rowsBlock(ctx, isPickup ? 'Retrait' : 'Livraison', deliveryRows(q), PAD + colW + 40, y, colW, draw);
  y += Math.max(h1, h2) + 32;

  // Tableau
  const cols = [PAD + 20, 620, 760, W - PAD - 20]; // produit | qté (droite) | PU (droite) | montant (droite)
  if (draw) {
    ctx.fillStyle = INK; ctx.fillRect(PAD, y, W - PAD * 2, 52);
    ctx.fillStyle = '#fff'; ctx.font = font(21, 800, true);
    ctx.fillText('PRODUIT', cols[0], y + 34);
    ctx.textAlign = 'right';
    ctx.fillText('QTÉ', cols[1], y + 34); ctx.fillText('PRIX UNIT.', cols[2] + 90, y + 34); ctx.fillText('MONTANT', cols[3], y + 34);
    ctx.textAlign = 'left';
  }
  y += 52;
  (q.lines || []).forEach((l, i) => {
    ctx.font = font(23, 600);
    const name = wrap(ctx, l.name, cols[1] - cols[0] - 120);
    const rowH = 30 + name.length * 30 + 28;
    if (draw) {
      if (i % 2) { ctx.fillStyle = '#f4f9fe'; ctx.fillRect(PAD, y, W - PAD * 2, rowH); }
      ctx.fillStyle = INK; ctx.font = font(23, 600);
      name.forEach((t, k) => ctx.fillText(t, cols[0], y + 36 + k * 30));
      ctx.fillStyle = MUTED; ctx.font = font(20, 400);
      ctx.fillText(formatCell(l), cols[0], y + 36 + name.length * 30);
      ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = font(23, 400);
      ctx.fillText(qtyCell(l), cols[1], y + 36);
      ctx.fillText(money(l.price), cols[2] + 90, y + 36);
      ctx.font = font(23, 700); ctx.fillText(money(l.total), cols[3], y + 36);
      ctx.textAlign = 'left';
      ctx.fillStyle = LINE; ctx.fillRect(PAD, y + rowH - 1, W - PAD * 2, 1);
    }
    y += rowH;
  });

  // Transport + total
  y += 20;
  if (draw) {
    ctx.font = font(22, 400); ctx.fillStyle = MUTED; ctx.fillText('Transport', PAD + 20, y + 28);
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = font(22, 600);
    ctx.fillText(transportText(q), W - PAD - 20, y + 28); ctx.textAlign = 'left';
  }
  y += 52;
  if (draw) {
    ctx.fillStyle = ICE; ctx.fillRect(PAD, y, W - PAD * 2, 84);
    ctx.fillStyle = BLUE; ctx.fillRect(PAD, y, 8, 84);
    ctx.fillStyle = INK; ctx.font = font(26, 800, true); ctx.fillText(totalLabel(q), PAD + 30, y + 52);
    ctx.textAlign = 'right'; ctx.font = font(40, 800, true); ctx.fillText(money(q.total), W - PAD - 24, y + 56); ctx.textAlign = 'left';
  }
  y += 84 + 36;

  // Mentions + pied
  ctx.font = font(20, 400);
  const notes = [QUOTE.disclaimer, `Devis valable ${QUOTE.validityDays} jours. Prix en F CFA.`].filter(Boolean);
  if (draw) { ctx.fillStyle = MUTED; notes.forEach((t, i) => ctx.fillText(t, PAD, y + 22 + i * 30)); }
  y += notes.length * 30 + 30;
  const foot = [
    `${BRAND.address.street}, ${BRAND.address.city} · ${BRAND.hours}`,
    BRAND.phones.map((p) => p.display).join('  ·  '),
    `${BRAND.url.replace(/^https?:\/\//, '')} · ${BRAND.email}`,
  ];
  const footH = 40 + foot.length * 32;
  if (draw) {
    ctx.fillStyle = INK; ctx.fillRect(0, y, W, footH);
    ctx.fillStyle = '#fff'; ctx.font = font(20, 400); ctx.textAlign = 'center';
    foot.forEach((t, i) => ctx.fillText(t, W / 2, y + 44 + i * 32));
    ctx.textAlign = 'left';
  }
  return y + footH;
}

async function loadLogo() {
  try {
    const res = await fetch(`${BASE}brand/logo-full-white.svg`);
    const svg = await res.text();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const vb = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/[\s,]+/).map(Number);
    return { img, ratio: vb?.[2] ? vb[3] / vb[2] : img.naturalHeight / img.naturalWidth };
  } catch {
    return null;
  }
}

/** Devis en image (Blob image/png). */
export async function buildImage(q) {
  const [logo] = await Promise.all([loadLogo(), loadFonts()]);
  const scale = 2; // net sur les écrans haute densité
  const measure = document.createElement('canvas').getContext('2d');
  const H = Math.ceil(layout(measure, q, logo, false));
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  layout(ctx, q, logo, true);
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('image du devis : échec'))), 'image/png'));
}
