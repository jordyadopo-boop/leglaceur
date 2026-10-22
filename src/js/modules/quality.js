/**
 * Qualité (#qualite) — valeurs, fait scientifique (334 J/g) et engagements.
 * - Textes vérifiés contre config.js (BRAND.values, PILLARS, SCIENCE) au chargement.
 * - Icônes au trait qui se tracent (DrawSVG), cartes qui « gèlent » à l'apparition.
 * - Vitrine scientifique : le glaçon fond pendant que le compteur data-count (core/reveal.js) monte.
 * Tout part d'un état visible (gsap.from) ; rien n'est animé en mouvement réduit.
 */
import { gsap, reducedMotion, finePointer } from '../core/motion.js';
import { BRAND, PILLARS, SCIENCE } from '../config.js';

const nf = new Intl.NumberFormat('fr-FR');

function syncContent(root) {
  for (const v of BRAND.values) {
    const card = root.querySelector(`.qv[data-value="${v.id}"]`);
    if (!card) continue;
    const label = card.querySelector('.qv__label');
    const text = card.querySelector('.qv__text');
    if (label && label.textContent.trim() !== v.label) label.textContent = v.label;
    if (text && text.textContent.trim() !== v.text) text.textContent = v.text;
  }
  for (const p of PILLARS) {
    const label = root.querySelector(`.qp[data-pillar="${p.id}"] .qp__label`);
    if (label && label.textContent.trim() !== p.label) label.textContent = p.label;
  }
  const latent = SCIENCE?.latentHeat;
  if (latent) {
    const count = root.querySelector('[data-latent]');
    if (count) {
      count.dataset.count = String(latent);
      count.textContent = nf.format(latent);
    }
    const tag = root.querySelector('.qs__tag--j');
    if (tag) tag.textContent = `+ ${nf.format(latent)} J`;
  }
}

function animateValues(root) {
  const cards = [...root.querySelectorAll('.qv__card')];
  if (!cards.length) return;
  const list = root.querySelector('.quality__values');
  const tl = gsap.timeline({ scrollTrigger: { trigger: list, start: 'top 82%', once: true } });
  tl.from(cards, {
    y: 80, rotationX: -16, opacity: 0, filter: 'blur(10px)', transformOrigin: '50% 100%',
    duration: 1.3, stagger: 0.14, clearProps: 'transform,filter,opacity',
  }, 0);
  cards.forEach((card, i) => {
    const paths = card.querySelectorAll('.qv__draw');
    const at = 0.35 + i * 0.14;
    tl.from(paths, { drawSVG: '0%', duration: 1.4, stagger: 0.12, ease: 'power2.inOut' }, at)
      .from(card.querySelector('.qv__num'), { yPercent: 60, opacity: 0, duration: 1.1 }, at)
      .fromTo(card.querySelector('.qv__sheen'),
        { opacity: 0, xPercent: -30 },
        { keyframes: [{ opacity: 1, duration: 0.15 }, { xPercent: 420, opacity: 0, duration: 1.1, ease: 'power2.inOut' }] }, at + 0.5);
    // Survol : l'icône se redessine (pointeur fin uniquement).
    if (finePointer) {
      let busy = false;
      card.addEventListener('pointerenter', () => {
        if (busy || tl.isActive()) return;
        busy = true;
        gsap.fromTo(paths, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.9, stagger: 0.08, ease: 'power2.inOut', onComplete: () => { busy = false; } });
      });
    }
  });
}

function animateScience(root) {
  const fig = root.querySelector('.quality__science');
  const count = root.querySelector('[data-latent]');
  if (!fig || !count) return;
  const cube = fig.querySelector('.qs__cube');
  const puddle = fig.querySelector('.qs__puddle');
  const heat = fig.querySelectorAll('.qs__heat path');
  const drips = fig.querySelectorAll('.qs__drip');
  const tags = fig.querySelectorAll('.qs__tag');

  gsap.from(fig, { y: 60, opacity: 0, duration: 1.2, scrollTrigger: { trigger: fig, start: 'top 88%', once: true }, clearProps: 'transform,opacity' });

  // Même déclencheur et même durée (2 s) que le compteur de core/reveal.js : le glaçon fond au rythme des joules.
  const tl = gsap.timeline({ scrollTrigger: { trigger: count, start: 'top 90%', once: true } });
  tl.from(tags[0], { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, 0)
    .from(heat, { drawSVG: '0%', opacity: 0, duration: 1, stagger: 0.1 }, 0)
    .fromTo(cube, { scaleY: 1, scaleX: 1, transformOrigin: '50% 100%' }, { scaleY: 0.62, scaleX: 1.06, duration: 2, ease: 'power3.out' }, 0)
    .fromTo(puddle, { scale: 0.35, transformOrigin: '50% 50%' }, { scale: 1.12, duration: 2, ease: 'power3.out' }, 0)
    .from(tags[1], { scale: 0.4, opacity: 0, y: 10, duration: 0.8, ease: 'back.out(2.4)' }, 1.5);
  drips.forEach((d, i) => {
    gsap.timeline({ repeat: 3, delay: 0.3 + i * 0.45, scrollTrigger: { trigger: count, start: 'top 90%', once: true } })
      .fromTo(d, { y: -14, opacity: 0, scale: 0.5, transformOrigin: '50% 0%' }, { y: 0, opacity: 0.9, scale: 1, duration: 0.35, ease: 'power1.in' })
      .to(d, { y: 22, scaleY: 0.4, opacity: 0, duration: 0.35, ease: 'power2.in' });
  });
}

function animatePledges(root) {
  const items = root.querySelectorAll('.qp');
  if (!items.length) return;
  const tl = gsap.timeline({ scrollTrigger: { trigger: root.querySelector('.quality__pledges'), start: 'top 85%', once: true } });
  tl.from(root.querySelector('.quality__pledges-title'), { x: -30, opacity: 0, duration: 1 }, 0)
    .from(items, { y: 40, scale: 0.94, opacity: 0, duration: 1.1, stagger: 0.1, clearProps: 'transform,opacity' }, 0.1);
  items.forEach((it, i) => {
    tl.from(it.querySelector('.qp__icon'), { rotate: -45, scale: 0.4, duration: 0.9, ease: 'back.out(2)' }, 0.2 + i * 0.1)
      .from(it.querySelectorAll('.qp__draw'), { drawSVG: '0%', duration: 1.1, stagger: 0.1, ease: 'power2.inOut' }, 0.35 + i * 0.1);
  });
}

function animateDecor(root) {
  root.querySelectorAll('.quality__flake').forEach((f, i) => {
    gsap.fromTo(f, { rotate: -20 - i * 10, yPercent: -10 }, {
      rotate: 40 + i * 15, yPercent: 20, ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 },
    });
  });
}

export default function init(root) {
  syncContent(root);

  // Met en pause les ondes de chaleur (animation CSS) hors écran.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => root.classList.toggle('is-offscreen', !e.isIntersecting), { rootMargin: '100px' });
    io.observe(root);
  }

  if (reducedMotion) return;
  animateValues(root);
  animateScience(root);
  animatePledges(root);
  animateDecor(root);
}
