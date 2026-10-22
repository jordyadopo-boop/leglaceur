/**
 * Guide — sommaire collant (agent guide).
 * Rail fixe à gauche (bureau large) : apparaît après l'ouverture, disparaît sur le pied de page,
 * indique la section en cours (aria-current) et la progression de lecture (jauge givrée).
 * Fonctionne aussi en mouvement réduit (aucune animation, simple mise à jour d'état).
 */
import { ScrollTrigger } from '../core/motion.js';

export default function init(el) {
  const links = [...el.querySelectorAll('[data-g-rail]')];
  const sections = links.map((a) => document.getElementById(a.dataset.gRail));
  if (sections.some((s) => !s)) return;
  const fill = el.querySelector('[data-g-rail-fill]');
  const first = sections[0];
  const last = sections[sections.length - 1];

  let current = -1;
  const setActive = (i) => {
    if (i === current) return;
    current = i;
    links.forEach((a, j) => {
      a.classList.toggle('is-active', j === i);
      a.classList.toggle('is-past', j < i);
      if (j === i) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };

  sections.forEach((sec, i) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => { if (self.isActive) setActive(i); },
    });
  });

  ScrollTrigger.create({
    trigger: first, start: 'top 75%', endTrigger: last, end: 'bottom 40%',
    onToggle: (self) => {
      el.classList.toggle('is-visible', self.isActive);
      if (!self.isActive && self.direction < 0) setActive(-1);
    },
    onUpdate: (self) => { if (fill) fill.style.transform = `scaleY(${self.progress.toFixed(4)})`; },
  });
  el.classList.add('is-ready');
}
