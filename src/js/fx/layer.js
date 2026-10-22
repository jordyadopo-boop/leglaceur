/**
 * Calque <canvas> posé sur un conteneur (position absolue, pointer-events: none),
 * redimensionné automatiquement (ResizeObserver) avec un ratio de pixels plafonné.
 */
import { dprCap, ensurePositioned } from './env.js';

/**
 * @param {HTMLElement} host
 * @param {object} o
 * @param {string} [o.className]
 * @param {number} [o.dpr]      ratio maximal (défaut : 2, 1,5 sur mobile)
 * @param {number} [o.scale]    sous-échantillonnage (0,5 = moitié de résolution, pour la brume)
 * @param {(layer) => void} [o.onResize]
 * @param {boolean} [o.prepend] insérer en premier enfant (sous le contenu)
 * @param {'2d'|'webgl'} [o.context]
 */
export function createLayer(host, o = {}) {
  ensurePositioned(host);
  const canvas = document.createElement('canvas');
  canvas.className = `fx-layer ${o.className || ''}`.trim();
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  if (o.prepend) host.prepend(canvas);
  else host.append(canvas);
  const ctx = o.context === 'webgl' ? null : canvas.getContext('2d');
  const layer = { canvas, ctx, host, w: 0, h: 0, ratio: 1, ready: false };

  const resize = (w, h) => {
    w = Math.round(w);
    h = Math.round(h);
    if (!w || !h) return;
    if (w === layer.w && h === layer.h && layer.ready) return;
    const r = (o.dpr ?? dprCap()) * (o.scale ?? 1);
    layer.w = w;
    layer.h = h;
    layer.ratio = r;
    canvas.width = Math.max(1, Math.round(w * r));
    canvas.height = Math.max(1, Math.round(h * r));
    ctx?.setTransform(r, 0, 0, r, 0, 0);
    layer.ready = true;
    o.onResize?.(layer);
  };

  const ro = new ResizeObserver((entries) => {
    const box = entries[0].contentRect;
    resize(box.width, box.height);
  });
  ro.observe(canvas);
  layer.measure = () => resize(canvas.clientWidth, canvas.clientHeight);
  layer.destroy = () => {
    ro.disconnect();
    canvas.remove();
  };
  return layer;
}

/** Image de fond visible d'un conteneur (pour flouter ou réfracter). */
export function findImage(host) {
  const img = host.querySelector('img');
  if (!img) return null;
  return img;
}

/** Attend que l'image soit décodée (ou échoue sans bruit). */
export async function imageReady(img) {
  if (!img) return null;
  try {
    if (!img.complete || !img.naturalWidth) {
      await new Promise((res, rej) => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', rej, { once: true });
      });
    }
    await img.decode?.().catch(() => {});
    return img.naturalWidth ? img : null;
  } catch {
    return null;
  }
}

/**
 * Dessine `img` dans ctx comme il est affiché dans `host` (object-fit: cover|contain, object-position).
 * Les coordonnées sont celles du conteneur (px CSS).
 */
export function drawImageAsDisplayed(ctx, img, host) {
  const hr = host.getBoundingClientRect();
  const ir = img.getBoundingClientRect();
  const cs = getComputedStyle(img);
  const fit = cs.objectFit || 'fill';
  const [px, py] = (cs.objectPosition || '50% 50%').split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
  const bx = ir.left - hr.left;
  const by = ir.top - hr.top;
  const bw = ir.width;
  const bh = ir.height;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!bw || !bh || !nw || !nh) return;
  let dw = bw;
  let dh = bh;
  if (fit === 'cover' || fit === 'contain') {
    const s = fit === 'cover' ? Math.max(bw / nw, bh / nh) : Math.min(bw / nw, bh / nh);
    dw = nw * s;
    dh = nh * s;
  }
  const dx = bx + (bw - dw) * (Number.isFinite(px) ? px : 0.5);
  const dy = by + (bh - dh) * (Number.isFinite(py) ? py : 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Rayon de bordure (premier coin) d'un élément, en px. */
export function radiusOf(el) {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) ? r : 0;
}
