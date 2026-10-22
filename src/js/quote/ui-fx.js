/**
 * Devis · micro-interactions « glace » (agent quote-ui).
 *  - tweenNumber : montant qui défile puis « gèle » (flash givré) ;
 *  - jump : un cristal saute du bouton +1 ;
 *  - flyTo : un cristal vole en arc vers le total (bureau) ou la barre basse (mobile) ;
 *  - burst : éclats de givre (célébration, succès) ;
 *  - pulse / shake : retours visuels discrets.
 * Tout est désactivé en prefers-reduced-motion (les valeurs sont posées directement).
 */
import { gsap, reducedMotion } from '../core/motion.js';

let layer = null;
const MAX_LIVE = 18;
let live = 0;

function getLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'quote-fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  return layer;
}

const CRYSTAL_KINDS = ['spark', 'cube', 'spark', 'shard'];

function makeCrystal(kind) {
  const el = document.createElement('span');
  el.className = `quote-crystal quote-crystal--${kind}`;
  if (kind === 'spark') el.innerHTML = '<svg viewBox="0 0 20 20"><use href="#q-i-crystal"/></svg>';
  return el;
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

const visible = (el) => {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
};

/** Montant animé. `format` reçoit la valeur courante. Retourne la valeur finale. */
export function tweenNumber(el, to, format, { duration = 0.75, freezeOnEnd = false } = {}) {
  if (!el) return to;
  const from = typeof el._qv === 'number' ? el._qv : to;
  el._qv = to;
  gsap.killTweensOf(el._qo || {});
  if (reducedMotion || from === to || document.hidden) {
    el.textContent = format(to);
    return to;
  }
  const o = (el._qo = { v: from });
  gsap.to(o, {
    v: to,
    duration,
    ease: 'power3.out',
    onUpdate: () => { el.textContent = format(Math.round(o.v)); },
    onComplete: () => {
      el.textContent = format(to);
      if (freezeOnEnd) freeze(el);
    },
  });
  return to;
}

/** Valeur posée sans animation (initialisation). */
export function setNumber(el, v, format) {
  if (!el) return;
  el._qv = v;
  el.textContent = format(v);
}

/** Flash « gel » : relance l'animation CSS .is-freezing. */
export function freeze(el) {
  if (!el || reducedMotion) return;
  el.classList.remove('is-freezing');
  void el.offsetWidth; // relance l'animation
  el.classList.add('is-freezing');
  clearTimeout(el._qft);
  el._qft = setTimeout(() => el.classList.remove('is-freezing'), 1200);
}

/** Petit cristal qui saute au-dessus d'un bouton. */
export function jump(fromEl, { count = 2, spread = 34 } = {}) {
  if (reducedMotion || !visible(fromEl) || live > MAX_LIVE) return;
  const L = getLayer();
  const { x, y } = center(fromEl);
  for (let i = 0; i < count; i++) {
    const kind = CRYSTAL_KINDS[(Math.random() * CRYSTAL_KINDS.length) | 0];
    const c = makeCrystal(kind);
    L.append(c);
    live++;
    const size = 8 + Math.random() * 9;
    gsap.set(c, { x: x - size / 2, y: y - size / 2, width: size, height: size, rotate: Math.random() * 90, scale: 0.3, opacity: 0 });
    const dx = (Math.random() - 0.5) * spread * 2;
    const peak = -(36 + Math.random() * 34);
    gsap.timeline({ onComplete: () => { c.remove(); live--; } })
      .to(c, { opacity: 1, scale: 1, duration: 0.16, ease: 'power2.out' })
      .to(c, { x: `+=${dx}`, duration: 0.75, ease: 'power1.out' }, 0)
      .to(c, { y: `+=${peak}`, duration: 0.36, ease: 'power2.out' }, 0)
      .to(c, { y: `+=${-peak * 0.75}`, duration: 0.39, ease: 'power2.in' }, 0.36)
      .to(c, { rotate: `+=${(Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 160)}`, duration: 0.75, ease: 'none' }, 0)
      .to(c, { opacity: 0, scale: 0.4, duration: 0.25, ease: 'power1.in' }, 0.5);
  }
}

/** Un cristal vole du bouton vers la cible (total), en arc ; la cible pulse à l'arrivée. */
export function flyTo(fromEl, toEl, { onArrive } = {}) {
  if (reducedMotion || !visible(fromEl) || !visible(toEl) || live > MAX_LIVE) { onArrive?.(); return; }
  const L = getLayer();
  const a = center(fromEl);
  const b = center(toEl);
  const c = makeCrystal('spark');
  c.classList.add('quote-crystal--flyer');
  L.append(c);
  live++;
  const s = 16;
  gsap.set(c, { x: a.x - s / 2, y: a.y - s / 2, width: s, height: s, opacity: 0, scale: 0.4 });
  const midX = (a.x + b.x) / 2 + (b.x > a.x ? -40 : 40);
  const midY = Math.min(a.y, b.y) - 120 - Math.random() * 60;
  gsap.timeline({ onComplete: () => { c.remove(); live--; onArrive?.(); } })
    .to(c, { opacity: 1, scale: 1.1, duration: 0.18 })
    .to(c, {
      duration: 0.78,
      ease: 'power2.inOut',
      rotate: 300,
      motionPath: { path: [{ x: a.x - s / 2, y: a.y - s / 2 }, { x: midX - s / 2, y: midY }, { x: b.x - s / 2, y: b.y - s / 2 }], curviness: 1.4 },
    }, 0.02)
    .to(c, { scale: 0.5, opacity: 0, duration: 0.18, ease: 'power1.in' }, '-=0.16');
}

/** Éclats de givre autour d'un élément (célébration). */
export function burst(el, { count = 18, radius = 110, from } = {}) {
  if (reducedMotion || !visible(el)) return;
  const L = getLayer();
  const p = from || center(el);
  for (let i = 0; i < count; i++) {
    const kind = i % 3 === 0 ? 'cube' : i % 3 === 1 ? 'spark' : 'shard';
    const c = makeCrystal(kind);
    L.append(c);
    const size = 6 + Math.random() * 12;
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = radius * (0.55 + Math.random() * 0.6);
    gsap.set(c, { x: p.x - size / 2, y: p.y - size / 2, width: size, height: size, scale: 0.2, opacity: 0, rotate: Math.random() * 180 });
    gsap.timeline({ onComplete: () => c.remove() })
      .to(c, { opacity: 1, scale: 1, duration: 0.12 })
      .to(c, { x: `+=${Math.cos(ang) * dist}`, y: `+=${Math.sin(ang) * dist - 20}`, rotate: `+=${200 + Math.random() * 200}`, duration: 0.95 + Math.random() * 0.35, ease: 'expo.out' }, 0)
      .to(c, { y: '+=36', opacity: 0, scale: 0.3, duration: 0.5, ease: 'power2.in' }, 0.7);
  }
}

/** Pulsation brève (cible d'un cristal, compteur). */
export function pulse(el, scale = 1.08) {
  if (!el || reducedMotion) return;
  gsap.fromTo(el, { scale }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)', overwrite: 'auto', clearProps: 'scale' });
}

/** Tremblement (erreur) — léger, 0,4 s. */
export function shake(el) {
  if (!el || reducedMotion) return;
  gsap.fromTo(el, { x: 0 }, { keyframes: { x: [-7, 6, -4, 3, -1, 0] }, duration: 0.45, ease: 'power2.out', clearProps: 'x' });
}

/** Apparition d'un bloc depuis un état visible (le bloc reste lisible si l'animation est coupée). */
export function reveal(el, vars = {}) {
  if (!el || reducedMotion) return;
  gsap.from(el, { opacity: 0, y: 14, filter: 'blur(6px)', duration: 0.6, ease: 'ice', clearProps: 'filter,transform,opacity', ...vars });
}
