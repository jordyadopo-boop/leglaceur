/**
 * Animations déclaratives communes (attributs HTML) :
 *  data-reveal            → apparition (glisse + fondu) ; data-reveal="up|fade|scale|left|right"
 *  data-reveal-stagger    → sur un parent : ses enfants directs apparaissent en cascade
 *  data-split             → titre découpé en lignes/caractères qui « gèlent » à l'apparition
 *  data-parallax="0.2"    → parallaxe verticale (fraction de la hauteur de l'élément)
 *  data-count="334"       → compteur animé (data-count-suffix, data-count-decimals)
 * Le contenu reste visible sans JS ou en mouvement réduit.
 */
import { gsap, ScrollTrigger, SplitText, reducedMotion } from './motion.js';

const nf = new Intl.NumberFormat('fr-FR');

export function initReveals(root = document) {
  if (reducedMotion) return;

  root.querySelectorAll('[data-split]:not([data-split-done])').forEach((el) => {
    el.setAttribute('data-split-done', '');
    const split = SplitText.create(el, { type: 'lines,words,chars', linesClass: 'split-line', mask: 'lines', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.chars, {
          yPercent: 110, rotate: 6, filter: 'blur(6px)', opacity: 0,
          duration: 1.1, stagger: { each: 0.018 }, ease: 'ice',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      } });
    el._split = split;
  });

  root.querySelectorAll('[data-reveal]:not([data-reveal-done])').forEach((el) => {
    el.setAttribute('data-reveal-done', '');
    const kind = el.dataset.reveal || 'up';
    const from = { opacity: 0, duration: 1.1, ease: 'ice' };
    if (kind === 'up') from.y = 48;
    if (kind === 'left') from.x = -60;
    if (kind === 'right') from.x = 60;
    if (kind === 'scale') Object.assign(from, { scale: 0.92, filter: 'blur(8px)' });
    gsap.from(el, { ...from, delay: Number(el.dataset.revealDelay || 0), scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  root.querySelectorAll('[data-reveal-stagger]:not([data-reveal-done])').forEach((el) => {
    el.setAttribute('data-reveal-done', '');
    gsap.from(el.children, {
      opacity: 0, y: 40, duration: 1, stagger: Number(el.dataset.revealStagger || 0.08), ease: 'ice',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  root.querySelectorAll('[data-parallax]').forEach((el) => {
    const f = Number(el.dataset.parallax || 0.15);
    gsap.fromTo(el, { yPercent: -f * 50 }, { yPercent: f * 50, ease: 'none',
      scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  root.querySelectorAll('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const dec = Number(el.dataset.countDecimals || 0);
    const suffix = el.dataset.countSuffix || '';
    const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => { el.textContent = fmt.format(o.v) + suffix; } });
  });
}

export const refresh = () => ScrollTrigger.refresh();
export { nf };
