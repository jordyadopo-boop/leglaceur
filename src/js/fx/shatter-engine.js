/**
 * Moteur d'éclats de glace (canvas global partagé, créé au premier usage).
 * Chaque éclat est un petit polygone translucide qui tourne sur lui-même (aplatissement = rotation 3D),
 * s'allume quand sa face prend la lumière, et retombe sous la gravité. Onde de choc givrée + poussière.
 *
 *   import { shatterAt } from '../fx/shatter-engine.js';
 *   shatterAt(x, y, { count: 28, power: 1, tone: 'light' });   // coordonnées écran (clientX/Y)
 *
 * La boucle ne tourne que tant qu'il reste des éclats.
 */
import { reducedMotion, dprCap, rng, clamp } from './env.js';
import { createTask } from './loop.js';
import { sparkle } from './sprites.js';

let canvas = null;
let ctx = null;
let W = 0;
let H = 0;
let ratio = 1;
const shards = [];
const dust = [];
const rings = [];
const r = rng(4242);
const MAX_SHARDS = 140;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-shatter-layer';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  W = innerWidth;
  H = innerHeight;
  ratio = dprCap(2);
  canvas.width = Math.round(W * ratio);
  canvas.height = Math.round(H * ratio);
}

/** Polygone convexe irrégulier (éclat), sommets autour de l'origine. */
function shardShape(size) {
  const n = r.int(3, 5);
  const pts = [];
  const base = r() * Math.PI * 2;
  const stretch = r.range(1, 2.2); // éclats effilés
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * Math.PI * 2 + r.range(-0.35, 0.35);
    const d = size * r.range(0.55, 1);
    pts.push([Math.cos(a) * d * stretch, Math.sin(a) * d]);
  }
  return pts;
}

/**
 * Explosion d'éclats en (x, y), coordonnées du viewport.
 * @param {number} x
 * @param {number} y
 * @param {{count?:number, power?:number, size?:number, tone?:'light'|'dark', ring?:boolean}} [o]
 */
export function shatterAt(x, y, o = {}) {
  if (reducedMotion) return;
  ensureCanvas();
  const power = o.power ?? 1;
  const count = Math.min(o.count ?? 26, MAX_SHARDS - shards.length);
  const size = o.size ?? 1;
  const dark = o.tone === 'dark';
  for (let i = 0; i < count; i++) {
    // Éventail orienté vers le haut (la glace « saute »), quelques éclats partent en bas.
    const a = -Math.PI / 2 + r.range(-1.45, 1.45) * (r() < 0.85 ? 1 : 2.1);
    const sp = r.range(180, 620) * power * (0.6 + r() * 0.5);
    const s = r.range(3, 9.5) * size * (r() < 0.15 ? 1.6 : 1);
    shards.push({
      x: x + r.range(-6, 6),
      y: y + r.range(-6, 6),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      rot: r() * Math.PI * 2,
      vr: r.range(-9, 9),
      flip: r() * Math.PI * 2,
      vf: r.range(5, 16) * r.sign(),
      pts: shardShape(s),
      s,
      life: 0,
      max: r.range(0.75, 1.25),
      hue: r() < 0.35 ? 1 : 0,
      dark,
    });
  }
  const nd = Math.round(14 * power);
  for (let i = 0; i < nd && dust.length < 160; i++) {
    const a = r() * Math.PI * 2;
    const sp = r.range(40, 260) * power;
    dust.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: r.range(0.4, 0.9), s: r.range(3, 8) });
  }
  if (o.ring !== false) rings.push({ x, y, life: 0, max: 0.55, r0: 6, r1: 70 * Math.sqrt(power) * size, dark });
  task.start();
}

const task = createTask('shatter', (dt, t) => {
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Onde de choc : anneau de givre qui s'ouvre et s'efface.
  for (let i = rings.length - 1; i >= 0; i--) {
    const q = rings[i];
    q.life += dt;
    const k = q.life / q.max;
    if (k >= 1) {
      rings.splice(i, 1);
      continue;
    }
    const e = 1 - (1 - k) ** 3;
    const rad = q.r0 + (q.r1 - q.r0) * e;
    ctx.globalAlpha = (1 - k) ** 1.5;
    ctx.lineWidth = 2.4 * (1 - k) + 0.4;
    ctx.strokeStyle = q.dark ? 'rgba(227,243,255,0.95)' : 'rgba(77,155,255,0.85)';
    ctx.beginPath();
    ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(q.x, q.y, rad * 0.82, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Éclats.
  for (let i = shards.length - 1; i >= 0; i--) {
    const p = shards[i];
    p.life += dt;
    if (p.life >= p.max || p.y > H + 40) {
      shards.splice(i, 1);
      continue;
    }
    p.vy += 1500 * dt;
    p.vx *= Math.exp(-1.2 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.flip += p.vf * dt;
    const k = p.life / p.max;
    const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const sx = Math.cos(p.flip); // rotation 3D simulée : la face s'aplatit puis se retourne
    const glint = Math.max(0, sx) ** 6; // la face prend la lumière
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    ctx.setTransform(c * sx * ratio, s * sx * ratio, -s * ratio, c * ratio, p.x * ratio, p.y * ratio);
    ctx.globalAlpha = fade;
    ctx.beginPath();
    const pts = p.pts;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.closePath();
    // Corps translucide (bleu glacier sur fond clair, presque blanc sur fond sombre).
    const a = 0.32 + 0.4 * glint;
    ctx.fillStyle = p.dark
      ? `rgba(${200 + 55 * glint | 0},${230 + 25 * glint | 0},255,${a + 0.15})`
      : p.hue
        ? `rgba(${120 + 135 * glint | 0},${190 + 65 * glint | 0},255,${a + 0.2})`
        : `rgba(${190 + 65 * glint | 0},${225 + 30 * glint | 0},255,${a + 0.25})`;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = p.dark ? 'rgba(255,255,255,0.85)' : `rgba(21,99,214,${0.45 + 0.3 * (1 - glint)})`;
    ctx.stroke();
    // Arête lumineuse.
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * glint})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  // Poussière de glace scintillante.
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const spr = sparkle('dot');
  for (let i = dust.length - 1; i >= 0; i--) {
    const q = dust[i];
    q.life += dt;
    if (q.life >= q.max) {
      dust.splice(i, 1);
      continue;
    }
    q.vx *= Math.exp(-3 * dt);
    q.vy = q.vy * Math.exp(-2 * dt) + 260 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    const k = q.life / q.max;
    ctx.globalAlpha = clamp((1 - k) * (0.6 + 0.4 * Math.sin(t * 18 + i)));
    ctx.drawImage(spr, q.x - q.s, q.y - q.s, q.s * 2, q.s * 2);
  }
  ctx.globalAlpha = 1;

  if (!shards.length && !dust.length && !rings.length) {
    ctx.clearRect(0, 0, W, H);
    task.stop();
  }
});
