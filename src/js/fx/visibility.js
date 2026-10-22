/**
 * Visibilité partagée (un IntersectionObserver par marge) : les effets ne tournent
 * que lorsque leur conteneur est à l'écran (ou presque).
 */
const groups = new Map(); // rootMargin → { io, callbacks: Map<Element, Set<fn>> }

function group(rootMargin) {
  let g = groups.get(rootMargin);
  if (g) return g;
  const callbacks = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) callbacks.get(e.target)?.forEach((fn) => fn(e.isIntersecting, e));
    },
    { rootMargin },
  );
  g = { io, callbacks };
  groups.set(rootMargin, g);
  return g;
}

/**
 * Appelle cb(visible) à chaque entrée / sortie de l'écran.
 * @returns {() => void} désabonnement
 */
export function watchVisibility(el, cb, { margin = '160px 0px' } = {}) {
  const g = group(margin);
  let set = g.callbacks.get(el);
  if (!set) {
    set = new Set();
    g.callbacks.set(el, set);
    g.io.observe(el);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
    if (!set.size) {
      g.callbacks.delete(el);
      g.io.unobserve(el);
    }
  };
}

/** Déclenche cb une seule fois quand `ratio` de l'élément est visible. */
export function onceInView(el, cb, { ratio = 0.3 } = {}) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        // Élément plus haut que l'écran : on se contente de 40 % de la hauteur de la fenêtre.
        if (e.isIntersecting && (e.intersectionRatio >= ratio - 0.01 || e.intersectionRect.height > innerHeight * 0.4)) {
          io.disconnect();
          cb(e);
        }
      }
    },
    { threshold: [0, 0.1, ratio] },
  );
  io.observe(el);
  return () => io.disconnect();
}
