/**
 * Guide — appel à l'action final (agent guide).
 * - Liens WhatsApp du guide ([data-g-wa]) reconstruits depuis BRAND.whatsapp (core/whatsapp) ; mention livraison depuis DELIVERY.
 * - Glaçons en lévitation (boucles pausées hors écran), panneau qui se « dégivre » à l'apparition,
 *   reflet qui suit le pointeur.
 */
import { gsap, ScrollTrigger, reducedMotion, finePointer } from '../core/motion.js';
import { DELIVERY } from '../config.js';
import { waLink } from '../core/whatsapp.js';

export default function init(el) {
  document.querySelectorAll('.guide [data-g-wa]').forEach((a) => { a.href = waLink(a.dataset.gWa); });
  const free = el.querySelector('[data-g-free]');
  if (free) free.textContent = DELIVERY.freeLabel;

  if (reducedMotion) return;
  const panel = el.querySelector('[data-g-cta-panel]');
  const ices = [...el.querySelectorAll('[data-g-float]')];

  gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top 80%', once: true } })
    .from(panel, { clipPath: 'inset(10% 6% 10% 6% round 40px)', duration: 1.4, ease: 'ice' })
    .from(ices, { y: 80, scale: 0.4, opacity: 0, rotation: (i) => (i % 2 ? 30 : -30), duration: 1.4, stagger: 0.1, ease: 'back.out(1.4)' }, 0.2)
    .from(el.querySelectorAll('.g-cta__perks li, .g-cta__actions > *'), { y: 24, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.5);

  const loops = ices.map((n, i) => gsap.to(n, { y: -14 - i * 3, rotation: i % 2 ? 6 : -6, duration: 3 + i * 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut', paused: true }));
  ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onToggle: (s) => loops.forEach((t) => (s.isActive ? t.play() : t.pause())) });

  if (finePointer) {
    const setX = gsap.quickSetter(panel, '--mx', '%');
    const setY = gsap.quickSetter(panel, '--my', '%');
    panel.addEventListener('pointermove', (e) => {
      const r = panel.getBoundingClientRect();
      setX(((e.clientX - r.left) / r.width) * 100);
      setY(((e.clientY - r.top) / r.height) * 100);
    });
  }
}
