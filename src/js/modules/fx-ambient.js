/**
 * fx-ambient — ambiance globale (élément .fx-ambient présent dans chaque page).
 *  1. Poussière de givre : de très fines particules de glace dérivent et scintillent
 *     (trois profondeurs, parallaxe au défilement, s'écartent doucement du pointeur).
 *  2. Voile de givre : quand on défile vite, des cristaux poussent depuis les bords de l'écran ;
 *     dès qu'on s'arrête, ils fondent (WebGL chargé à la demande, repli 2D).
 * API : window.dispatchEvent(new CustomEvent('fx:frost', { detail: { level: 0.8, hold: 0.6 } }))
 * déclenche un coup de givre (ex. célébration « Livraison offerte ! »).
 * Désactivé en mouvement réduit.
 */
import { claim, reducedMotion, finePointer, isMobile, lowPower, dprCap, clamp, damp, rng, idle } from '../fx/env.js';
import { createTask } from '../fx/loop.js';
import { sparkle } from '../fx/sprites.js';

export default function init(el) {
  if (!claim(el, 'fx-ambient')) return;
  if (reducedMotion) {
    el.classList.add('is-off');
    return;
  }

  const dust = createDust(el);
  let veil = null;
  let veilCanvas = null;

  // Voile WebGL : chargé après l'affichage, quand le navigateur est disponible.
  idle(async () => {
    try {
      const { createVeil } = await import('../fx/frost-veil.js');
      veilCanvas = document.createElement('canvas');
      veilCanvas.className = 'fx-ambient__veil';
      veilCanvas.setAttribute('aria-hidden', 'true');
      veilCanvas.style.visibility = 'hidden';
      el.append(veilCanvas);
      veil = createVeil(veilCanvas);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[fx-ambient]', err);
    }
  }, 1200);

  // Niveau de givre : monte vite avec la vitesse de défilement, fond lentement à l'arrêt.
  let level = 0;
  let hold = 0;
  let lastY = window.scrollY;
  const MAX = 0.92;

  const onFrost = (e) => {
    const d = e.detail ?? {};
    level = Math.max(level, clamp(Number(d.level ?? 0.75), 0, MAX));
    hold = Math.max(hold, Number(d.hold ?? 0.4));
  };
  window.addEventListener('fx:frost', onFrost);
  // Arrivée sur la page : l'écran est encore givré, puis il dégèle.
  window.addEventListener('app:ready', () => setTimeout(() => onFrost({ detail: { level: 0.62, hold: 0.35 } }), 250), { once: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      dust.resize();
      veil?.resize();
    }, 220);
  });

  const task = createTask('ambient', (dt, t) => {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    const v = Math.abs(dy) / Math.max(dt * 60, 0.25); // px par image à 60 i/s
    const target = clamp((v - 7) / 42) ** 0.8 * MAX;
    if (hold > 0) hold -= dt;
    else if (target > level) level = damp(level, target, 4.2, dt);
    else level = Math.max(target, level - dt * (0.22 + level * 0.18));
    dust.update(dt, t, dy);
    veil?.render(level, t);
  });
  task.start();
}

/** Poussière de givre plein écran (canvas 2D, quelques dizaines de sprites). */
function createDust(root) {
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-ambient__dust';
  canvas.setAttribute('aria-hidden', 'true');
  root.append(canvas);
  const ctx = canvas.getContext('2d');
  const dot = sparkle('dot');
  const star = sparkle('star');
  const r = rng(77);
  let W = 0;
  let H = 0;
  let ratio = 1;
  let parts = [];
  const pointer = { x: -9999, y: -9999, on: false };

  if (finePointer) {
    window.addEventListener(
      'pointermove',
      (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.on = true;
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => (pointer.on = false));
  }

  function spawn(p, anywhere) {
    const z = r() ** 1.6; // beaucoup de particules lointaines, peu de proches
    p.z = z;
    p.x = r() * W;
    p.y = anywhere ? r() * H : -12;
    p.size = 1 + z * z * 4.2;
    p.vy = (3 + r() * 9) * (0.45 + z);
    p.vx = r.range(-2, 2);
    p.amp = r.range(4, 16) * (0.4 + z);
    p.sw = r.range(0.15, 0.5);
    p.ph = r() * Math.PI * 2;
    p.tw = r.range(0.8, 2.6);
    p.a = (0.22 + z * 0.55) * (isMobile ? 0.85 : 1);
    p.kind = z > 0.72 ? 'star' : 'dot';
    p.rot = r() * Math.PI;
    p.ox = 0;
    p.oy = 0;
    return p;
  }

  function resize() {
    W = innerWidth;
    H = innerHeight;
    ratio = dprCap(1.5);
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    const n = clamp(Math.round((W * H) / (lowPower ? 32000 : 22000)), 14, isMobile ? 26 : 64);
    parts = Array.from({ length: n }, () => spawn({}, true));
  }
  resize();

  function update(dt, t, dy) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y += p.vy * dt - dy * (0.1 + p.z * 0.5);
      p.x += (p.vx + Math.cos(t * p.sw + p.ph) * p.amp * 0.6) * dt;
      if (pointer.on && p.z > 0.25) {
        const dx = p.x + p.ox - pointer.x;
        const dyp = p.y + p.oy - pointer.y;
        const d2 = dx * dx + dyp * dyp;
        if (d2 < 120 * 120) {
          const f = (1 - Math.sqrt(d2) / 120) * 90 * p.z * dt;
          const inv = 1 / (Math.sqrt(d2) + 0.001);
          p.ox += dx * inv * f;
          p.oy += dyp * inv * f;
        }
      }
      p.ox = damp(p.ox, 0, 0.8, dt);
      p.oy = damp(p.oy, 0, 0.8, dt);
      if (p.y > H + 16) spawn(p, false);
      else if (p.y < -16) {
        spawn(p, false);
        p.y = H + 12;
      }
      if (p.x < -16) p.x += W + 32;
      else if (p.x > W + 16) p.x -= W + 32;
      const tw = 0.55 + 0.45 * Math.sin(t * p.tw + p.ph);
      const a = p.a * tw;
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      const s = p.size * (p.kind === 'star' ? 7 : 5);
      const x = p.x + p.ox;
      const y = p.y + p.oy;
      if (p.kind === 'star') {
        const rot = p.rot + t * 0.25;
        const c = Math.cos(rot) * ratio;
        const sn = Math.sin(rot) * ratio;
        ctx.setTransform(c, sn, -sn, c, x * ratio, y * ratio);
        ctx.drawImage(star, -s / 2, -s / 2, s, s);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      } else {
        ctx.drawImage(dot, x - s / 2, y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  return { update, resize };
}
