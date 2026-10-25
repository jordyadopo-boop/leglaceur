/**
 * fx-tilt — inclinaison 3D douce + reflet glacé qui suit le pointeur.
 * La carte pivote vers le pointeur comme un bloc de glace qu'on tourne dans la lumière ;
 * un reflet spéculaire (tache + arête) glisse à sa surface et un liseré s'allume du côté éclairé.
 * Options : data-tilt="7" (angle maximal en degrés), data-tilt-scale="1.015",
 *           data-tilt-glare="0" (sans reflet), data-fx-tone="dark" (reflet en mode écran).
 * Pointeur fin uniquement (rien au tactile) ; désactivé en mouvement réduit.
 */
import { claim, reducedMotion, finePointer, gsap, numAttr, clamp, ensurePositioned, toneOf } from '../fx/env.js';

export default function init(el) {
  if (!claim(el, 'fx-tilt')) return;
  if (reducedMotion || !finePointer) return;

  ensurePositioned(el);
  el.classList.add('fx-tilt-host');
  if (toneOf(el) === 'dark') el.classList.add('fx-tilt-host--dark');

  const max = numAttr(el, 'tilt', 7);
  const lift = numAttr(el, 'tiltScale', 1.015);
  const withGlare = el.dataset.tiltGlare !== '0';

  let glare = null;
  let spot = null;
  if (withGlare) {
    glare = document.createElement('span');
    glare.className = 'fx-tilt__glare';
    glare.setAttribute('aria-hidden', 'true');
    spot = document.createElement('span');
    spot.className = 'fx-tilt__glare-spot';
    const edge = document.createElement('span');
    edge.className = 'fx-tilt__glare-edge';
    glare.append(spot, edge);
    el.append(glare);
  }

  gsap.set(el, { transformPerspective: 1000, transformOrigin: '50% 50%' });
  const rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3.out' });
  const ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3.out' });
  const sc = (v) => gsap.to(el, { scale: v, duration: 0.7, ease: 'power3.out', overwrite: false });
  const gx = spot && gsap.quickTo(spot, 'xPercent', { duration: 0.5, ease: 'power3.out' });
  const gy = spot && gsap.quickTo(spot, 'yPercent', { duration: 0.5, ease: 'power3.out' });

  let box = null;
  let raf = 0;
  let last = null;

  const apply = () => {
    raf = 0;
    if (!last || !box) return;
    const nx = clamp((last.x - box.left) / box.width) * 2 - 1;
    const ny = clamp((last.y - box.top) / box.height) * 2 - 1;
    // Grande carte = angle plus faible (une dalle large ne doit pas « basculer »).
    const k = clamp(420 / Math.max(box.width, box.height), 0.45, 1);
    ry(nx * max * k);
    rx(-ny * max * k);
    if (spot) {
      gx(nx * 25);
      gy(ny * 25);
      el.style.setProperty('--fx-glare-a', `${Math.round(Math.atan2(ny, nx) * (180 / Math.PI) + 90)}deg`);
      el.style.setProperty('--fx-glare-k', (0.35 + 0.65 * Math.min(1, Math.hypot(nx, ny))).toFixed(3));
    }
  };

  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    box = el.getBoundingClientRect();
    el.classList.add('is-tilting');
    sc(lift);
  });
  el.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      if (!box) box = el.getBoundingClientRect();
      last = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    },
    { passive: true },
  );
  const reset = () => {
    box = null;
    last = null;
    el.classList.remove('is-tilting');
    rx(0);
    ry(0);
    sc(1);
    if (spot) {
      gx(0);
      gy(0);
    }
  };
  el.addEventListener('pointerleave', reset);
  // La page défile sous un pointeur immobile : on remesure au prochain mouvement.
  window.addEventListener('scroll', () => (box = null), { passive: true });
}
