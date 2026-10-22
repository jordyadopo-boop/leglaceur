/**
 * fx-fog — brume de carboglace qui rampe au bas du conteneur.
 * Trois nappes de bruit raccordables glissent à des vitesses différentes (parallaxe), des bouffées
 * naissent au sol, gonflent, montent un peu et se dissipent. Le pointeur écarte la brume
 * (les bouffées fuient, les nappes se creusent localement) et le défilement la fait onduler.
 * Options : data-fog-height="0.5" (fraction de la hauteur occupée), data-fog-density="1",
 *           data-fog-layer="over|under" (au-dessus du visuel ou derrière le texte ; automatique sinon),
 *           data-fx-tone="dark|light" (brume blanche sur fond sombre, bleutée sur fond clair).
 * Rendu en demi-résolution (la brume est floue par nature) ; boucle active seulement à l'écran.
 * Désactivé en mouvement réduit (le conteneur garde son propre décor CSS).
 */
import { claim, reducedMotion, finePointer, isMobile, lowPower, clamp, damp, numAttr, rng, toneOf, getLenis } from '../fx/env.js';
import { createLayer } from '../fx/layer.js';
import { createTask } from '../fx/loop.js';
import { watchVisibility } from '../fx/visibility.js';
import { fogBank, fogPuffs, makeCanvas } from '../fx/sprites.js';

/** Version teintée (bleu glacier) d'une texture blanche, pour les fonds clairs. */
const tinted = new Map();
function tint(src, color) {
  const key = src;
  let m = tinted.get(color);
  if (!m) tinted.set(color, (m = new Map()));
  if (m.has(key)) return m.get(key);
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  m.set(key, c);
  return c;
}

/** Le conteneur est-il surtout une image (brume au-dessus) ou une carte de texte (brume derrière) ? */
function autoLayer(el) {
  const b = el.getBoundingClientRect();
  const area = Math.max(1, b.width * b.height);
  for (const img of el.querySelectorAll('img, video')) {
    const r = img.getBoundingClientRect();
    if ((r.width * r.height) / area > 0.55) return 'over';
  }
  return 'under';
}

export default function init(el) {
  if (!claim(el, 'fx-fog')) return;
  if (reducedMotion) return;

  const dark = toneOf(el) === 'dark';
  const heightFrac = clamp(numAttr(el, 'fogHeight', 0.5), 0.15, 1);
  const density = clamp(numAttr(el, 'fogDensity', 1, { low: 0.6, high: 1.4 }), 0.2, 2);
  const mode = el.dataset.fogLayer === 'over' || el.dataset.fogLayer === 'under' ? el.dataset.fogLayer : autoLayer(el);

  el.classList.add('fx-fog-host', `fx-fog-host--${mode}`);
  const layer = createLayer(el, {
    className: `fx-fog fx-fog--${mode}`,
    scale: 0.5,
    dpr: 1.5,
    prepend: mode === 'under',
    onResize: () => seed(),
  });
  const { ctx } = layer;

  const color = dark ? null : 'rgb(178, 214, 245)';
  const banks = [1, 2, 3].map((s) => (color ? tint(fogBank(s), color) : fogBank(s)));
  const puffsSrc = fogPuffs().map((p) => (color ? tint(p, color) : p));
  const r = rng(913);

  // Nappes : vitesse (px/s), hauteur relative, opacité, ondulation.
  const lanes = [
    { img: banks[0], speed: 9, h: 1, a: dark ? 0.55 : 0.5, y: 0.02, off: 0, bob: 0.9 },
    { img: banks[1], speed: -14, h: 0.78, a: dark ? 0.5 : 0.45, y: 0.0, off: 180, bob: 1.3 },
    { img: banks[2], speed: 22, h: 0.55, a: dark ? 0.62 : 0.55, y: -0.02, off: 320, bob: 1.7 },
  ];
  let puffs = [];
  const pointer = { x: -1e4, y: -1e4, on: false, sx: -1e4, sy: -1e4, k: 0 };
  let scrollV = 0;

  function spawnPuff(p, anywhere) {
    const W = layer.w;
    const H = layer.h;
    const fh = H * heightFrac;
    p.img = r.pick(puffsSrc);
    p.size = clamp(fh * r.range(0.55, 1.15), 70, 420);
    p.x = r() * (W + p.size) - p.size / 2;
    p.y = H - r.range(0, fh * 0.35);
    p.vx = r.range(-12, 12);
    p.vy = -r.range(3, 10);
    p.grow = r.range(0.04, 0.12);
    p.life = anywhere ? r() * 6 : 0;
    p.max = r.range(6, 11);
    p.a = r.range(0.35, 0.7);
    p.rot = r() * Math.PI * 2;
    p.vr = r.range(-0.08, 0.08);
    p.px = 0;
    p.py = 0;
    return p;
  }

  function seed() {
    if (!layer.w) return;
    const n = Math.round(clamp((layer.w / 90) * density, 4, isMobile || lowPower ? 9 : 16));
    puffs = Array.from({ length: n }, () => spawnPuff({}, true));
  }

  if (finePointer) {
    el.addEventListener(
      'pointermove',
      (e) => {
        const b = el.getBoundingClientRect();
        pointer.x = e.clientX - b.left;
        pointer.y = e.clientY - b.top;
        pointer.on = true;
      },
      { passive: true },
    );
    el.addEventListener('pointerleave', () => (pointer.on = false));
  }
  el.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      const b = el.getBoundingClientRect();
      pointer.x = t.clientX - b.left;
      pointer.y = t.clientY - b.top;
      pointer.on = true;
    },
    { passive: true },
  );
  el.addEventListener('touchend', () => (pointer.on = false), { passive: true });

  let t0 = 0;
  const task = createTask('fog', (dt, time) => {
    const W = layer.w;
    const H = layer.h;
    if (!W || !H) return;
    t0 += dt;
    const lenis = getLenis();
    const v = lenis ? lenis.velocity : 0;
    scrollV = damp(scrollV, clamp(v / 40, -1, 1), 3, dt);

    // Pointeur lissé (la brume réagit avec un peu d'inertie).
    pointer.k = damp(pointer.k, pointer.on ? 1 : 0, 3, dt);
    if (pointer.on) {
      pointer.sx = damp(pointer.sx < -1e3 ? pointer.x : pointer.sx, pointer.x, 6, dt);
      pointer.sy = damp(pointer.sy < -1e3 ? pointer.y : pointer.sy, pointer.y, 6, dt);
    }

    ctx.setTransform(layer.ratio, 0, 0, layer.ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const fh = H * heightFrac;

    // Nappes raccordables.
    for (const l of lanes) {
      const lh = fh * l.h * (1 + 0.06 * Math.sin(time * 0.4 * l.bob + l.off) + scrollV * 0.12);
      const tile = (l.img.width / l.img.height) * lh * 1.6;
      let x = (((l.off + t0 * l.speed * (1 + Math.abs(scrollV) * 2)) % tile) + tile) % tile;
      x -= tile;
      const y = H - lh + fh * l.y;
      ctx.globalAlpha = l.a * density;
      for (let xx = x; xx < W; xx += tile) ctx.drawImage(l.img, xx, y, tile + 1, lh);
    }

    // Le pointeur creuse la brume : on efface doucement autour de lui.
    if (pointer.k > 0.02) {
      const rad = clamp(fh * 0.55, 60, 180);
      const g = ctx.createRadialGradient(pointer.sx, pointer.sy, 0, pointer.sx, pointer.sy, rad);
      g.addColorStop(0, `rgba(0,0,0,${0.55 * pointer.k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(pointer.sx - rad, pointer.sy - rad, rad * 2, rad * 2);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Bouffées.
    for (const p of puffs) {
      p.life += dt;
      if (p.life > p.max) spawnPuff(p, false);
      const k = p.life / p.max;
      const fade = Math.sin(Math.PI * k); // naît, s'épanouit, se dissipe
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (pointer.k > 0.02) {
        const cx = p.x + p.px;
        const cy = p.y + p.py;
        const dx = cx - pointer.sx;
        const dy = cy - pointer.sy;
        const d = Math.hypot(dx, dy) + 0.001;
        const reach = p.size * 0.9;
        if (d < reach) {
          const f = (1 - d / reach) * 140 * pointer.k * dt;
          p.px += (dx / d) * f;
          p.py += (dy / d) * f * 0.6;
        }
      }
      p.px = damp(p.px, 0, 0.6, dt);
      p.py = damp(p.py, 0, 0.6, dt);
      const s = p.size * (1 + p.grow * p.life);
      ctx.globalAlpha = clamp(p.a * fade * density);
      const c = Math.cos(p.rot);
      const sn = Math.sin(p.rot);
      const x = p.x + p.px;
      const y = p.y + p.py;
      ctx.setTransform(c * layer.ratio, sn * layer.ratio, -sn * layer.ratio, c * layer.ratio, x * layer.ratio, y * layer.ratio);
      ctx.drawImage(p.img, -s / 2, -s / 2 * 0.62, s, s * 0.62);
    }
    ctx.globalAlpha = 1;
  });

  watchVisibility(el, (on) => (on ? task.start() : task.stop()), { margin: '80px 0px' });
}
