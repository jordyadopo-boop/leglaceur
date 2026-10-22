/**
 * Géométrie procédurale du givre : croissance dendritique « en fougère » (tiges + barbes à 60°,
 * comme les cristaux de glace hexagonaux sur une vitre), étoiles à six branches, semis sur les bords.
 * Chaque segment porte un temps d'apparition t ∈ [0, 1] : on peut animer la croissance, la
 * figer dans une texture (temps de gel par pixel) ou n'en garder que la partie proche des bords.
 */
import { rng as makeRng } from './env.js';

const TAU = Math.PI * 2;
const SIXTY = Math.PI / 3;

/**
 * Tige principale avec barbes alternées (récursif).
 * @param {Array} out segments {x1,y1,x2,y2,t,g}
 */
export function fern(out, x, y, angle, len, gen, t0, o) {
  const { r, step, tPerPx, maxGen, bounds } = o;
  const steps = Math.max(2, Math.round(len / step));
  const curl = r.range(-0.035, 0.035);
  let a = angle;
  let t = t0;
  const every = gen === 0 ? r.int(2, 3) : r.int(2, 4);
  let side = r.sign();
  for (let i = 0; i < steps; i++) {
    a += curl + r.range(-o.wander, o.wander);
    const nx = x + Math.cos(a) * step;
    const ny = y + Math.sin(a) * step;
    if (bounds && (nx < -2 || ny < -2 || nx > bounds.w + 2 || ny > bounds.h + 2)) break;
    const nt = t + step * tPerPx;
    out.push({ x1: x, y1: y, x2: nx, y2: ny, t: Math.min(nt, 0.97), g: gen });
    x = nx;
    y = ny;
    t = nt;
    if (gen < maxGen && i > 0 && i % every === 0 && i < steps - 1) {
      const remaining = (steps - i) * step;
      const sub = remaining * r.range(0.32, 0.62) * (gen === 0 ? 1 : 0.8);
      if (sub > step * 1.5) {
        fern(out, x, y, a + side * (SIXTY + r.range(-0.18, 0.18)), sub, gen + 1, t, o);
        // barbe symétrique occasionnelle (plume complète)
        if (r() < o.pair) fern(out, x, y, a - side * (SIXTY + r.range(-0.18, 0.18)), sub * r.range(0.7, 1), gen + 1, t, o);
      }
      side = -side;
    }
  }
}

/** Étoile de glace à six branches. */
export function star(out, cx, cy, radius, t0, o) {
  const rot = o.r() * SIXTY;
  const sub = { ...o, maxGen: Math.min(o.maxGen, 1), wander: 0.02, pair: 1 };
  for (let k = 0; k < 6; k++) {
    fern(out, cx, cy, rot + k * SIXTY, radius, 1, t0, sub);
  }
}

/**
 * Givre qui pousse depuis les bords et les coins d'un rectangle w × h.
 * @param {object} p
 * @param {number} p.w
 * @param {number} p.h
 * @param {number} p.depth     profondeur maximale de pénétration (px)
 * @param {number} [p.seed]
 * @param {number} [p.spacing] écart moyen entre deux départs le long d'un bord (px)
 * @param {number} [p.step]    longueur d'un segment (px)
 * @param {number} [p.maxGen]  profondeur de ramification (0 à 3)
 * @param {number} [p.corner]  renfort des coins (0 = aucun)
 * @param {number} [p.edgeReach] longueur des tiges de bord, en fraction de depth
 * @param {number} [p.stars]   nombre d'étoiles par 1000 px de périmètre
 * @param {Array<'top'|'right'|'bottom'|'left'>} [p.edges]
 * @returns {Array<{x1,y1,x2,y2,t,g}>} segments triés par t croissant
 */
export function growFrost(p) {
  const r = makeRng(p.seed ?? 11);
  const { w, h, depth } = p;
  const step = p.step ?? 5;
  const spacing = p.spacing ?? 46;
  const corner = p.corner ?? 1;
  const reach = p.edgeReach ?? [0.22, 0.85];
  const edges = p.edges ?? ['top', 'right', 'bottom', 'left'];
  const o = {
    r,
    step,
    tPerPx: 0.82 / depth,
    maxGen: p.maxGen ?? 2,
    wander: p.wander ?? 0.07,
    pair: p.pair ?? 0.35,
    bounds: { w, h },
  };
  const out = [];
  const cornerDist = (x, y) => Math.min(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
  const boost = (x, y) => 1 + corner * 0.9 * Math.exp(-cornerDist(x, y) / (depth * 0.9));

  const defs = {
    top: { len: w, at: (s) => [s, 0], normal: Math.PI / 2 },
    bottom: { len: w, at: (s) => [s, h], normal: -Math.PI / 2 },
    left: { len: h, at: (s) => [0, s], normal: 0 },
    right: { len: h, at: (s) => [w, s], normal: Math.PI },
  };
  for (const name of edges) {
    const e = defs[name];
    let s = r.range(0, spacing * 0.6);
    while (s < e.len) {
      const [x, y] = e.at(s);
      const b = boost(x, y);
      const len = depth * r.range(reach[0], reach[1]) * Math.min(b, 1.6);
      const a = e.normal + r.range(-0.62, 0.62);
      fern(out, x, y, a, len, 0, r.range(0, 0.1), o);
      s += r.range(spacing * 0.55, spacing * 1.45) / Math.min(b, 1.5);
    }
  }

  if (corner > 0) {
    const corners = [
      [0, 0, 0],
      [w, 0, Math.PI / 2],
      [w, h, Math.PI],
      [0, h, -Math.PI / 2],
    ];
    for (const [cx, cy, base] of corners) {
      const n = Math.round(3 + corner * 3);
      for (let k = 0; k < n; k++) {
        const a = base + ((k + r.range(0.2, 0.8)) / n) * (Math.PI / 2);
        fern(out, cx, cy, a, depth * r.range(0.7, 1.15) * Math.min(corner, 1.3), 0, r.range(0, 0.05), o);
      }
    }
  }

  const starCount = Math.round(((2 * (w + h)) / 1000) * (p.stars ?? 6));
  for (let i = 0; i < starCount; i++) {
    const name = r.pick(edges);
    const e = defs[name];
    const [ex, ey] = e.at(r() * e.len);
    const d = depth * r.range(0.12, 0.75);
    const x = ex + Math.cos(e.normal) * d;
    const y = ey + Math.sin(e.normal) * d;
    if (x < 0 || y < 0 || x > w || y > h) continue;
    star(out, x, y, r.range(4, 11), (d / depth) * 0.8 + r.range(0, 0.08), o);
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Index du premier segment dont t ≥ value (segments triés). */
export function indexAt(segs, value) {
  let lo = 0;
  let hi = segs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].t < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Trace les segments [from, to[ par génération (un stroke par génération : rapide).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} widths largeur par génération
 * @param {(g:number)=>string} [color] couleur par génération
 */
export function strokeSegments(ctx, segs, from, to, widths, color, offsetX = 0, offsetY = 0) {
  const maxG = widths.length - 1;
  for (let g = 0; g <= maxG; g++) {
    ctx.beginPath();
    let any = false;
    for (let i = from; i < to; i++) {
      const s = segs[i];
      if (Math.min(s.g, maxG) !== g) continue;
      ctx.moveTo(s.x1 + offsetX, s.y1 + offsetY);
      ctx.lineTo(s.x2 + offsetX, s.y2 + offsetY);
      any = true;
    }
    if (!any) continue;
    ctx.lineWidth = widths[g];
    if (color) ctx.strokeStyle = color(g);
    ctx.stroke();
  }
}

export { TAU, SIXTY };
