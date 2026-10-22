/**
 * fx-cursor — compagnon du curseur (le curseur natif reste affiché).
 *  - un petit cristal facetté qui suit le pointeur et s'incline dans le sens du mouvement ;
 *  - un anneau fin (blanc + bleu, lisible sur tous les fonds) qui grossit sur les éléments
 *    interactifs, épouse les boutons (.btn, fx-magnetic) et affiche un libellé (data-cursor="Voir") ;
 *  - une traînée de poussière de glace qui retombe et s'éteint.
 * Pointeur fin uniquement ; désactivé en mouvement réduit. Ne tourne que quand le pointeur bouge.
 */
import { claim, reducedMotion, finePointer, dprCap, damp, rng, clamp } from '../fx/env.js';
import { createTask } from '../fx/loop.js';
import { sparkle } from '../fx/sprites.js';
import { radiusOf } from '../fx/layer.js';

const INTERACTIVE = 'a[href], button, [role="button"], label, summary, select, [data-cursor], .btn, input[type="checkbox"], input[type="radio"], input[type="range"], input[type="submit"], [tabindex]:not([tabindex="-1"])';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]';
const STICKY = '.btn, [data-module~="fx-magnetic"], [data-cursor-stick]';

const CRYSTAL = `<svg viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="fxc-a" x1="0" y1="-10" x2="0" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#bfe4ff"/><stop offset="1" stop-color="#4d9bff"/>
    </linearGradient>
    <linearGradient id="fxc-b" x1="-6" y1="0" x2="6" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8ecfff"/><stop offset="1" stop-color="#1563d6"/>
    </linearGradient>
  </defs>
  <path d="M0-9 L5 0 L0 9 L-5 0Z" fill="url(#fxc-a)" stroke="#1563d6" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M0-9 L5 0 L0 1.5Z" fill="#ffffff" opacity="0.85"/>
  <path d="M0 9 L5 0 L0 1.5Z" fill="url(#fxc-b)" opacity="0.9"/>
  <path d="M-5 0 L0 1.5 L0 9Z" fill="#8ecfff" opacity="0.55"/>
  <circle cx="-1.4" cy="-3.8" r="0.9" fill="#fff"/>
</svg>`;

export default function init(el) {
  if (!claim(el, 'fx-cursor')) return;
  if (reducedMotion || !finePointer) return;

  const ring = document.createElement('div');
  ring.className = 'fx-cursor__ring';
  const label = document.createElement('span');
  label.className = 'fx-cursor__label';
  ring.append(label);
  const dot = document.createElement('div');
  dot.className = 'fx-cursor__dot';
  dot.innerHTML = CRYSTAL;
  const trail = document.createElement('canvas');
  trail.className = 'fx-cursor__trail';
  el.append(trail, ring, dot);

  const ctx = trail.getContext('2d');
  const spr = sparkle('dot');
  const r = rng(9);
  let ratio = 1;
  let W = 0;
  let H = 0;
  const resize = () => {
    W = innerWidth;
    H = innerHeight;
    ratio = dprCap(2);
    trail.width = Math.round(W * ratio);
    trail.height = Math.round(H * ratio);
  };
  resize();
  window.addEventListener('resize', resize);

  const p = { x: -100, y: -100 }; // pointeur
  const d = { x: -100, y: -100, rot: 0 }; // cristal
  const g = { x: -100, y: -100 }; // anneau
  let last = { x: 0, y: 0 };
  let visible = false;
  let stuck = null; // élément épousé par l'anneau
  let idleFor = 0;
  const dust = [];
  let lastRingSize = '';

  const setState = (name, on) => el.classList.toggle(name, on);

  function emit(n, vx, vy, burst = false) {
    for (let i = 0; i < n && dust.length < 90; i++) {
      const a = r() * Math.PI * 2;
      const s = burst ? r.range(60, 180) : r.range(4, 26);
      dust.push({
        x: p.x + r.range(-3, 3),
        y: p.y + r.range(-3, 3),
        vx: Math.cos(a) * s + vx * 0.06,
        vy: Math.sin(a) * s + vy * 0.06 - (burst ? 30 : 0),
        life: 0,
        max: r.range(0.45, burst ? 0.8 : 1.05),
        size: r.range(2.6, burst ? 7 : 6),
        tw: r.range(6, 14),
      });
    }
  }

  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!visible) {
      visible = true;
      d.x = g.x = last.x = p.x;
      d.y = g.y = last.y = p.y;
      setState('is-visible', true);
    }
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist > 7) {
      emit(Math.min(3, Math.floor(dist / 9)), (p.x - last.x) * 60, (p.y - last.y) * 60);
      last = { x: p.x, y: p.y };
    }
    idleFor = 0;
    task.start();
  }

  function setRing(w, h, rad) {
    const key = `${w}|${h}|${rad}`;
    if (key === lastRingSize) return;
    lastRingSize = key;
    if (w == null) {
      ring.style.removeProperty('--ring-w');
      ring.style.removeProperty('--ring-h');
      ring.style.removeProperty('--ring-r');
    } else {
      ring.style.setProperty('--ring-w', `${w}px`);
      ring.style.setProperty('--ring-h', `${h}px`);
      ring.style.setProperty('--ring-r', `${rad}px`);
    }
  }

  function onOver(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const text = t.closest(TEXT);
    const inter = !text && t.closest(INTERACTIVE);
    const lab = t.closest('[data-cursor]');
    const labelText = lab?.dataset.cursor?.trim() || '';
    setState('is-text', !!text);
    setState('is-hover', !!inter || !!labelText);
    setState('is-label', !!labelText);
    if (labelText) label.textContent = labelText;
    const stick = inter && !labelText ? inter.closest(STICKY) : null;
    stuck = stick && stick.getBoundingClientRect().width < 420 ? stick : null;
    setState('is-stuck', !!stuck);
    if (!stuck) setRing(null);
    task.start();
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      setState('is-down', true);
      emit(8, 0, 0, true);
      task.start();
    },
    { passive: true },
  );
  document.addEventListener('pointerup', () => setState('is-down', false), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    setState('is-hidden', true);
  });
  document.documentElement.addEventListener('pointerenter', () => setState('is-hidden', false));
  window.addEventListener('blur', () => setState('is-hidden', true));
  window.addEventListener('focus', () => setState('is-hidden', false));
  // Au-dessus d'une iframe (carte), le document ne reçoit plus le pointeur : on masque.
  document.addEventListener('pointerout', (e) => {
    if (e.relatedTarget?.tagName === 'IFRAME') setState('is-hidden', true);
  });
  document.addEventListener('pointerover', (e) => {
    if (e.target?.tagName !== 'IFRAME') setState('is-hidden', false);
  });

  const task = createTask('cursor', (dt, t) => {
    idleFor += dt;
    // Cristal : suit vite, décalé en bas à droite du curseur natif, s'incline selon la vitesse.
    const px = d.x;
    d.x = damp(d.x, p.x + 16, 26, dt);
    d.y = damp(d.y, p.y + 18, 26, dt);
    const vx = (d.x - px) / Math.max(dt, 0.001);
    d.rot = damp(d.rot, clamp(vx * 0.03, -35, 35), 10, dt);
    dot.style.transform = `translate3d(${d.x}px, ${d.y}px, 0) rotate(${d.rot}deg)`;

    // Anneau : plus de retard ; épouse le bouton survolé (centre + léger décalage vers le pointeur).
    let tx = p.x;
    let ty = p.y;
    if (stuck && stuck.isConnected) {
      const b = stuck.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      tx = cx + (p.x - cx) * 0.12;
      ty = cy + (p.y - cy) * 0.12;
      setRing(Math.round(b.width + 12), Math.round(b.height + 12), Math.round(Math.min(radiusOf(stuck) + 6, (b.height + 12) / 2)));
      const inside = p.x > b.left - 24 && p.x < b.right + 24 && p.y > b.top - 24 && p.y < b.bottom + 24;
      if (!inside) {
        stuck = null;
        setState('is-stuck', false);
        setRing(null);
      }
    }
    g.x = damp(g.x, tx, stuck ? 16 : 11, dt);
    g.y = damp(g.y, ty, stuck ? 16 : 11, dt);
    ring.style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`;

    // Traînée de poussière de glace.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = dust.length - 1; i >= 0; i--) {
      const q = dust[i];
      q.life += dt;
      if (q.life >= q.max) {
        dust.splice(i, 1);
        continue;
      }
      q.vx *= Math.exp(-3 * dt);
      q.vy = q.vy * Math.exp(-2.4 * dt) + 70 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const k = q.life / q.max;
      const a = (1 - k) ** 1.4 * (0.6 + 0.4 * Math.sin(t * q.tw + i));
      const s = q.size * (1 - k * 0.5);
      ctx.globalAlpha = a;
      ctx.drawImage(spr, q.x - s, q.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;

    const settled = Math.abs(g.x - tx) < 0.2 && Math.abs(g.y - ty) < 0.2 && Math.abs(d.x - p.x - 16) < 0.2;
    if (!dust.length && settled && !stuck && idleFor > 0.3) task.stop();
  });
}
