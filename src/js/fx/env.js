/**
 * Effets « glace » — environnement commun : préférences, DPR, maths, hasard reproductible.
 * Tous les modules fx-* importent d'ici (une seule source pour reducedMotion, finePointer…).
 */
import { gsap, ScrollTrigger, reducedMotion, finePointer, isMobile, getLenis } from '../core/motion.js';

export { gsap, ScrollTrigger, reducedMotion, finePointer, isMobile, getLenis };

/** Appareil modeste : on allège les effets (moins de particules, résolution réduite). */
export const lowPower = (() => {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const save = navigator.connection?.saveData === true;
  return save || cores <= 4 || mem <= 2;
})();

/** Ratio de pixels plafonné (≤ 2, ≤ 1,5 sur mobile, ou valeur fournie). */
export function dprCap(max) {
  const d = window.devicePixelRatio || 1;
  return Math.min(d, max ?? (isMobile ? 1.5 : 2));
}

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Amortissement indépendant de la cadence : lisse `a` vers `b` (k = vitesse en 1/s). */
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

/** Hachage d'une chaîne → graine (pour des rendus stables d'un chargement à l'autre). */
export function seedFrom(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Un module ne s'initialise qu'une fois par élément (idempotent).
 * @returns {boolean} true la première fois.
 */
const claims = new WeakMap();
export function claim(el, name) {
  let set = claims.get(el);
  if (!set) claims.set(el, (set = new Set()));
  if (set.has(name)) return false;
  set.add(name);
  return true;
}

/** Le conteneur doit être positionné pour accueillir un calque absolu. */
export function ensurePositioned(el) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
}

/** Palette claire ou sombre selon le contexte (section marine, verre sombre, data-fx-tone). */
export function toneOf(el) {
  const forced = el.closest('[data-fx-tone]')?.dataset.fxTone;
  if (forced === 'dark' || forced === 'light') return forced;
  return el.closest('.section--dark, .frost--dark, .is-dark') ? 'dark' : 'light';
}

/** Lecture d'un nombre dans un attribut data-*, avec mots-clés facultatifs. */
export function numAttr(el, name, fallback, words) {
  const raw = el.dataset[name];
  if (raw == null || raw === '') return fallback;
  if (words && raw in words) return words[raw];
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** requestIdleCallback avec repli. */
export const idle = (fn, timeout = 600) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 60);
