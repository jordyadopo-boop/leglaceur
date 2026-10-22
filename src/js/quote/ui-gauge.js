/**
 * Devis · jauge « livraison offerte » (agent quote-ui).
 * DELIVERY.freeFrom glaçons qui se remplissent un à un avec la quantité totale ;
 * au seuil : célébration givrée « Livraison offerte ! » (éclats, reflet qui balaie les glaçons).
 */
import { DELIVERY } from '../config.js';
import { gsap, reducedMotion } from '../core/motion.js';
import { burst, pulse } from './ui-fx.js';

const NBSP = ' ';

/** Texte commun (jauge, récapitulatif, barre basse). */
export function freeText(count) {
  const goal = DELIVERY.freeFrom;
  const left = Math.max(0, goal - count);
  if (count <= 0) return `Livraison offerte dès ${goal}${NBSP}articles`;
  if (left === 0) return `Livraison offerte${NBSP}!`;
  if (left === 1) return 'Plus qu’un article pour la livraison offerte';
  return `Plus que ${left}${NBSP}articles pour la livraison offerte`;
}

export function initGauge(root) {
  const el = root.querySelector('[data-gauge]');
  if (!el) return { render() {} };
  const goal = DELIVERY.freeFrom;
  const cellsWrap = el.querySelector('[data-gauge-cells]');
  const track = el.querySelector('[data-gauge-track]');
  const text = el.querySelector('[data-gauge-text]');
  const countEl = el.querySelector('[data-gauge-count]');
  el.querySelector('[data-gauge-goal]').textContent = String(goal);
  track.setAttribute('aria-valuemax', String(goal));

  const cells = [];
  cellsWrap.style.setProperty('--n', goal);
  for (let i = 0; i < goal; i++) {
    const c = document.createElement('span');
    c.className = 'quote-gauge__cell';
    c.style.setProperty('--i', i);
    cellsWrap.append(c);
    cells.push(c);
  }

  let prev = -1;
  let celebrated = false;

  function setText(count) {
    const left = Math.max(0, goal - count);
    if (count > 0 && left > 0) {
      text.innerHTML = left === 1
        ? 'Plus qu’<b>un</b> article pour la livraison offerte'
        : `Plus que <b>${left}</b>${NBSP}articles pour la livraison offerte`;
    } else {
      text.textContent = freeText(count);
    }
  }

  function render(t, { initial = false } = {}) {
    const count = t.count;
    if (count === prev) return;
    const filled = Math.min(goal, count);
    const was = Math.min(goal, Math.max(0, prev));
    cells.forEach((c, i) => c.classList.toggle('is-on', i < filled));
    countEl.textContent = String(count);
    track.setAttribute('aria-valuenow', String(filled));
    track.setAttribute('aria-valuetext', freeText(count));
    setText(count);
    const reached = count >= goal;
    el.classList.toggle('is-free', reached);

    if (!initial && !reducedMotion) {
      if (filled > was) {
        const fresh = cells.slice(was, filled);
        gsap.fromTo(fresh, { scale: 0.2, rotate: -25, opacity: 0.2 }, {
          scale: 1, rotate: 0, opacity: 1, duration: 0.55, ease: 'back.out(2.4)', stagger: Math.min(0.04, 0.4 / fresh.length), clearProps: 'all',
        });
      } else if (filled < was) {
        gsap.fromTo(cells.slice(filled, was), { scale: 1.15 }, { scale: 1, duration: 0.35, ease: 'power2.out', clearProps: 'all' });
      }
      pulse(countEl, 1.25);
    }

    if (reached && !celebrated) {
      celebrated = true;
      if (!initial && !reducedMotion) {
        el.classList.remove('is-celebrating');
        void el.offsetWidth;
        el.classList.add('is-celebrating');
        setTimeout(() => el.classList.remove('is-celebrating'), 1800);
        gsap.fromTo(text, { y: 10, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'ice', clearProps: 'all' });
        const last = cells[goal - 1];
        burst(last, { count: 22, radius: 120 });
      }
    } else if (!reached && celebrated) {
      celebrated = false;
    }
    prev = count;
  }

  return { render };
}
