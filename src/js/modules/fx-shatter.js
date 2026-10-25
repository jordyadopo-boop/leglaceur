/**
 * fx-shatter — au clic (souris, doigt ou clavier), petite explosion d'éclats de glace translucides
 * (reflets, rotation, gravité) depuis le point de contact, et l'élément « encaisse » le choc.
 * Options : data-shatter="1.2" (puissance), data-shatter-count="30".
 * Canvas global partagé (src/js/fx/shatter-engine.js), créé au premier clic.
 * API programmatique : window.dispatchEvent(new CustomEvent('fx:shatter', { detail: { x, y, count, power } })).
 * Désactivé en mouvement réduit.
 */
import { claim, reducedMotion, gsap, numAttr, toneOf } from '../fx/env.js';
import { shatterAt } from '../fx/shatter-engine.js';

let globalListener = false;

export default function init(el) {
  if (!globalListener) {
    globalListener = true;
    window.addEventListener('fx:shatter', (e) => {
      const d = e.detail || {};
      if (Number.isFinite(d.x) && Number.isFinite(d.y)) shatterAt(d.x, d.y, d);
    });
  }
  if (!claim(el, 'fx-shatter')) return;
  if (reducedMotion) return;

  let lastDown = null;
  el.addEventListener(
    'pointerdown',
    (e) => {
      lastDown = { x: e.clientX, y: e.clientY, t: performance.now() };
    },
    { passive: true },
  );

  el.addEventListener('click', (e) => {
    if (el.matches(':disabled, [aria-disabled="true"]')) return;
    let x;
    let y;
    if (lastDown && performance.now() - lastDown.t < 1200 && e.detail !== 0) {
      ({ x, y } = lastDown);
    } else {
      // Activation au clavier : depuis le centre de l'élément.
      const b = el.getBoundingClientRect();
      x = b.left + b.width / 2;
      y = b.top + b.height / 2;
    }
    lastDown = null;
    shatterAt(x, y, {
      count: numAttr(el, 'shatterCount', 26),
      power: numAttr(el, 'shatter', 1),
      tone: toneOf(el),
    });
    // L'élément encaisse le choc (échelle seulement : compatible avec fx-magnetic qui pilote x/y).
    // Sans fx-magnetic, on rend la main au CSS (:hover) une fois le rebond terminé.
    const magnetic = el.matches('[data-module~="fx-magnetic"]');
    gsap.fromTo(el, { scale: 0.93 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.4)', overwrite: false, clearProps: magnetic ? '' : 'transform' });
  });
}
