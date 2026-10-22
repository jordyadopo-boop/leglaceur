/**
 * Guide — tracés au défilement (agent guide) : illustrations au trait des secteurs, fil des règles d'hygiène.
 * Les traits sont dessinés (DrawSVG) quand l'illustration entre à l'écran ; les glaçons « tombent » en place.
 * Le fil vertical des règles HACCP suit la lecture (scrub). Sans JS / mouvement réduit : tout est déjà tracé.
 */
import { gsap, reducedMotion } from '../core/motion.js';

export default function init(el) {
  if (reducedMotion) return;

  el.querySelectorAll('.g-sector__art svg, .g-cta__art').forEach((svg) => {
    const main = svg.querySelectorAll('.g-draw__main, .g-draw__soft');
    const ice = svg.querySelectorAll('.g-draw__ice');
    const accent = svg.querySelectorAll('.g-draw__accent');
    const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 82%', once: true } });
    if (main.length) tl.from(main, { drawSVG: 0, duration: 1.4, stagger: 0.12, ease: 'power2.inOut' });
    if (ice.length) tl.from(ice, { drawSVG: 0, y: -14, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'back.out(1.6)' }, 0.5);
    if (accent.length) tl.from(accent, { drawSVG: '50% 50%', duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.8);
  });

  const thread = el.querySelector('.g-draw__thread');
  const rules = el.querySelector('.g-rules');
  if (thread && rules) {
    gsap.from(thread, { drawSVG: 0, ease: 'none', scrollTrigger: { trigger: rules, start: 'top 70%', end: 'bottom 60%', scrub: true } });
    rules.querySelectorAll('.g-rule').forEach((rule) => {
      const ico = rule.querySelector('.g-rule__ico');
      gsap.timeline({ scrollTrigger: { trigger: rule, start: 'top 82%', once: true } })
        .from(ico, { scale: 0.3, rotation: -30, opacity: 0, duration: 1, ease: 'back.out(1.8)' })
        .from(rule.querySelector('.g-rule__txt'), { x: 30, opacity: 0, duration: 1 }, 0.12);
    });
  }

  const media = el.querySelector('.g-haccp__media');
  if (media) {
    gsap.from(media, { clipPath: 'inset(18% 12% 18% 12% round 28px)', duration: 1.6, ease: 'ice', scrollTrigger: { trigger: media, start: 'top 80%', once: true } });
    gsap.from(media.querySelectorAll('.g-haccp__values li'), { y: 20, opacity: 0, duration: 0.9, stagger: 0.1, delay: 0.5, scrollTrigger: { trigger: media, start: 'top 80%', once: true } });
    const img = media.querySelector('img');
    if (img) gsap.fromTo(img, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}
