/**
 * Guide — ouverture (agent guide).
 * - Intro orchestrée : le titre « gèle » ligne à ligne, la plaque de cristal se trace (DrawSVG),
 *   les sept spécimens éclosent autour, le sommaire arrive en cascade.
 * - Flottement continu des spécimens + rotation lente du cristal, mis en pause hors écran.
 * - Parallaxe au pointeur (pointeur fin) et au défilement (la plaque s'éloigne).
 * Tout part d'un état visible (gsap.from) : sans JS ou en mouvement réduit, rien n'est caché.
 */
import { gsap, ScrollTrigger, reducedMotion, finePointer } from '../core/motion.js';

export default function init(el) {
  if (reducedMotion) return;
  const lines = el.querySelectorAll('[data-g-line]');
  const sub = el.querySelectorAll('[data-g-sub] > span');
  const fades = el.querySelectorAll('[data-g-fade]');
  const plate = el.querySelector('[data-g-plate]');
  const flake = el.querySelector('[data-g-flake]');
  const specs = [...el.querySelectorAll('[data-g-spec]')];
  const cards = el.querySelectorAll('[data-g-toc] > li');
  const stage = el.querySelector('.g-hero__stage');

  const intro = gsap.timeline({ delay: 0.1, defaults: { ease: 'ice' } });
  intro
    .from(lines, { yPercent: 60, opacity: 0, filter: 'blur(12px)', duration: 1.3, stagger: 0.14 })
    .from(sub, { y: 18, opacity: 0, duration: 0.9, stagger: 0.08 }, '-=0.95')
    .from(fades, { y: 26, opacity: 0, duration: 1, stagger: 0.09 }, '-=0.8')
    .from(plate, { scale: 0.82, opacity: 0, duration: 1.8 }, 0.05)
    .from(flake.querySelectorAll('path, polygon'), { drawSVG: '50% 50%', duration: 2.2, stagger: 0.05, ease: 'power2.inOut' }, 0.15)
    .from(specs, { scale: 0.2, opacity: 0, y: 30, rotation: (i) => (i % 2 ? 18 : -18), duration: 1.3, stagger: 0.08, ease: 'back.out(1.5)' }, 0.55)
    .from(cards, { y: 40, opacity: 0, duration: 1, stagger: 0.07 }, 0.9);

  // Flottement + rotation du cristal (boucles infinies, pausées hors écran).
  const loops = [];
  specs.forEach((s, i) => {
    const d = Number(getComputedStyle(s).getPropertyValue('--d')) || 1;
    const svg = s.querySelector('svg');
    loops.push(gsap.to(svg, { y: -8 - 6 * d, rotation: i % 2 ? 5 : -5, duration: 2.6 + d * 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.21 }));
  });
  loops.push(gsap.to(flake, { rotation: 360, duration: 140, ease: 'none', repeat: -1, transformOrigin: '50% 50%' }));
  ScrollTrigger.create({
    trigger: el, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => loops.forEach((t) => (self.isActive ? t.resume() : t.pause())),
  });

  // Parallaxe au défilement : la plaque recule et se givre légèrement.
  gsap.to(stage, { yPercent: 10, scale: 0.94, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } });

  // Parallaxe au pointeur (profondeur par spécimen).
  if (finePointer) {
    const movers = specs.map((s) => {
      const d = Number(getComputedStyle(s).getPropertyValue('--d')) || 1;
      return { d, x: gsap.quickTo(s, 'x', { duration: 1.2, ease: 'power3.out' }), y: gsap.quickTo(s, 'y', { duration: 1.2, ease: 'power3.out' }) };
    });
    const px = gsap.quickTo(plate, 'x', { duration: 1.6, ease: 'power3.out' });
    const py = gsap.quickTo(plate, 'y', { duration: 1.6, ease: 'power3.out' });
    let raf = 0;
    let last = null;
    el.addEventListener('pointermove', (e) => {
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const nx = (last.clientX - r.left) / r.width - 0.5;
        const ny = (last.clientY - r.top) / r.height - 0.5;
        movers.forEach((m) => { m.x(nx * 26 * m.d); m.y(ny * 20 * m.d); });
        px(nx * -10); py(ny * -8);
      });
    });
    el.addEventListener('pointerleave', () => { movers.forEach((m) => { m.x(0); m.y(0); }); px(0); py(0); });
  }
}
