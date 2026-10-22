/**
 * Guide — matrice comparative + « course de fonte » (agent guide).
 * - Les jauges de la matrice se remplissent à l'apparition.
 * - Course : les sept glaces plongées en même temps ; la glace restante diminue selon meltScore (config.js),
 *   l'eau de fonte monte dans chaque couloir, la carboglace se sublime (vapeur, aucune eau).
 *   Échelle illustrative : la glace la plus rapide garde 10 % en fin de course.
 * - Boutons Lancer / Rejouer ; départ automatique au premier passage ; résultat annoncé (role="status").
 * - Mouvement réduit : la course passe directement à l'état final.
 */
import { gsap, ScrollTrigger, reducedMotion } from '../core/motion.js';
import { ICE_TYPES } from '../config.js';

const DURATION = 7;
const ICE = Object.fromEntries(ICE_TYPES.map((i) => [i.id, i]));
const MAX = Math.max(...ICE_TYPES.map((i) => i.meltScore));
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const article = (name) => (/^glaçon/i.test(name) ? 'le ' : 'la ') + lower(name);
const listFr = (arr) => (arr.length < 2 ? arr.join('') : `${arr.slice(0, -1).join(', ')} et ${arr[arr.length - 1]}`);

export default function init(el) {
  // Jauges de la matrice
  if (!reducedMotion) {
    gsap.from(el.querySelectorAll('.g-mx__bar > span'), {
      scaleX: 0, duration: 1.3, stagger: 0.07, ease: 'power3.out',
      scrollTrigger: { trigger: el.querySelector('.g-mx'), start: 'top 75%', once: true },
    });
    gsap.from(el.querySelectorAll('.g-mx__table tbody tr'), {
      opacity: 0, x: -24, duration: 0.9, stagger: 0.06,
      scrollTrigger: { trigger: el.querySelector('.g-mx'), start: 'top 78%', once: true },
    });
  }

  const race = el.querySelector('[data-g-race]');
  if (!race) return;
  const btn = race.querySelector('[data-g-race-btn]');
  const label = race.querySelector('[data-g-race-label]');
  const ico = race.querySelector('[data-g-race-ico]');
  const prog = race.querySelector('[data-g-race-prog]');
  const status = race.querySelector('[data-g-race-status]');
  const lanes = [...race.querySelectorAll('[data-g-lane]')].map((li) => {
    const it = ICE[li.dataset.gLane];
    return {
      li, it,
      carbo: it?.id === 'carbo',
      score: it ? it.meltScore : Number(li.dataset.melt) || 0,
      ice: li.querySelector('[data-g-ice]'),
      water: li.querySelector('[data-g-water]'),
      pct: li.querySelector('[data-g-pct]'),
    };
  }).filter((l) => l.it);

  const remaining = (l, p) => (l.carbo ? 1 : 1 - 0.9 * (l.score / MAX) * p);
  const state = { p: 0 };
  let tween = null;

  function render() {
    const p = state.p;
    if (prog) prog.style.transform = `scaleX(${p.toFixed(4)})`;
    for (const l of lanes) {
      if (l.carbo) {
        l.ice.style.transform = `scale(${(1 - 0.12 * p).toFixed(3)})`;
        continue;
      }
      const r = remaining(l, p);
      l.ice.style.transform = `scale(${Math.cbrt(r).toFixed(3)})`;
      l.water.style.transform = `scaleX(${(1 - r).toFixed(4)})`;
      l.pct.textContent = `${Math.round(r * 100)} %`;
    }
  }

  function result() {
    const melting = lanes.filter((l) => !l.carbo);
    const min = Math.min(...melting.map((l) => l.score));
    const max = Math.max(...melting.map((l) => l.score));
    const best = melting.filter((l) => l.score === min);
    const worst = melting.filter((l) => l.score === max);
    lanes.forEach((l) => {
      l.li.classList.toggle('is-best', best.includes(l));
      l.li.classList.toggle('is-worst', worst.includes(l));
    });
    const b = listFr(best.map((l) => article(l.it.name)));
    const w = listFr(worst.map((l) => article(l.it.name)));
    status.textContent = `Résultat : ${b} ${best.length > 1 ? 'résistent' : 'résiste'} le mieux ; ${w} ${worst.length > 1 ? 'fondent' : 'fond'} le plus vite. La carboglace, elle, se sublime sans laisser d’eau.`;
  }

  function setBtn(mode) {
    label.textContent = mode === 'replay' ? 'Rejouer la course' : mode === 'running' ? 'Course en cours…' : 'Lancer la course';
    ico?.setAttribute('d', mode === 'replay' ? 'M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5' : 'M7 5v14l11-7z');
    btn.classList.toggle('is-replay', mode === 'replay');
  }

  function run() {
    tween?.kill();
    lanes.forEach((l) => l.li.classList.remove('is-best', 'is-worst'));
    status.textContent = '';
    if (reducedMotion) {
      state.p = 1; render(); result(); setBtn('replay');
      return;
    }
    race.classList.add('is-running');
    setBtn('running');
    state.p = 0;
    render();
    tween = gsap.to(state, {
      p: 1, duration: DURATION, ease: 'none', onUpdate: render,
      onComplete: () => { race.classList.remove('is-running'); result(); setBtn('replay'); },
    });
  }

  btn.hidden = false;
  race.classList.add('is-live');
  btn.addEventListener('click', run);
  render();

  if (!reducedMotion) {
    ScrollTrigger.create({ trigger: race.querySelector('[data-g-lanes]'), start: 'top 72%', once: true, onEnter: run });
    // Si la course quitte l'écran en route, on la met en pause (et on la reprend au retour).
    ScrollTrigger.create({
      trigger: race, start: 'top bottom', end: 'bottom top',
      onToggle: (s) => { if (tween && tween.progress() < 1) tween.paused(!s.isActive); },
    });
  }
}
