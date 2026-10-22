/**
 * Devis · en-tête (agent quote-ui).
 * Orchestration d'entrée façon générique After Effects :
 *  1. le givre se dessine depuis les coins (dendrites SVG générées, DrawSVG) ;
 *  2. le titre « gèle » lettre à lettre (flou → net, léger éclat) ;
 *  3. textes, avantages et bouton glissent en cascade ; les 3 étapes se posent comme des plaques de glace ;
 *  4. les glaçons flottent (dérive lente, parallaxe au défilement et au pointeur), en pause hors écran.
 * Tout part d'un état visible (gsap.from) : sans JS ou en mouvement réduit, l'en-tête est complet.
 */
import { BRAND, DELIVERY } from '../config.js';
import { gsap, ScrollTrigger, SplitText, reducedMotion, finePointer, isMobile } from '../core/motion.js';
import { fcfa } from '../core/format.js';
import * as store from '../core/quote-store.js';

const NBSP = ' ';
const SVGNS = 'http://www.w3.org/2000/svg';

/** Pseudo-aléatoire déterministe (le givre a toujours la même forme). */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Dendrite de givre : une tige qui se ramifie en aiguilles de plus en plus fines. */
function dendrite(paths, rand, x, y, ang, len, depth) {
  if (depth <= 0 || len < 6) return;
  const segs = 3 + Math.floor(rand() * 2);
  let cx = x;
  let cy = y;
  let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
  const pts = [];
  for (let i = 0; i < segs; i++) {
    const a = ang + (rand() - 0.5) * 0.35;
    const l = len / segs;
    cx += Math.cos(a) * l;
    cy += Math.sin(a) * l;
    d += `L${cx.toFixed(1)} ${cy.toFixed(1)}`;
    pts.push([cx, cy]);
  }
  paths.push({ d, depth });
  pts.forEach(([px, py], i) => {
    if (i === pts.length - 1 && depth < 2) return;
    const side = i % 2 ? 1 : -1;
    const branchLen = len * (0.32 + rand() * 0.22);
    dendrite(paths, rand, px, py, ang + side * (0.75 + rand() * 0.35), branchLen, depth - 1);
    if (rand() > 0.55) dendrite(paths, rand, px, py, ang - side * (0.7 + rand() * 0.3), branchLen * 0.7, depth - 1);
  });
}

function buildFrost(svg) {
  if (!svg || svg.childElementCount) return [];
  const rand = rng(20261022);
  const paths = [];
  // Germes : les coins et le bord supérieur (comme une vitre qui givre).
  const seeds = [
    [-10, -10, 0.55, 360, 4], [1450, -10, 2.55, 380, 4], [-10, 730, -0.6, 300, 4],
    [1450, 730, -2.5, 280, 3], [720, -10, 1.45, 170, 3], [300, -10, 1.2, 150, 3], [1110, -10, 1.9, 160, 3],
  ];
  for (const [x, y, a, l, dpt] of seeds) dendrite(paths, rand, x, y, a, l, dpt);
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke-linecap', 'round');
  g.setAttribute('stroke-linejoin', 'round');
  const out = [];
  for (const p of paths) {
    const el = document.createElementNS(SVGNS, 'path');
    el.setAttribute('d', p.d);
    el.setAttribute('class', `quote-intro__frost-p quote-intro__frost-p--${Math.min(4, p.depth)}`);
    g.append(el);
    out.push(el);
  }
  svg.append(g);
  return out;
}

export default function init(root) {
  // Données de config.
  const free = root.querySelector('[data-intro-free]');
  if (free) free.textContent = DELIVERY.freeLabel.replace(/ (\d+) articles/, ` $1${NBSP}articles`);
  const hours = root.querySelector('[data-intro-hours]');
  if (hours) hours.textContent = BRAND.hours;

  // Devis en cours (panier rempli depuis l'accueil) : on le signale et le bouton devient « Reprendre ».
  const resume = root.querySelector('[data-intro-resume]');
  const ctaLabel = root.querySelector('[data-intro-cta-label]');
  const syncResume = () => {
    const t = store.computeTotals();
    if (t.count > 0) {
      resume.hidden = false;
      resume.querySelector('[data-intro-resume-text]').textContent =
        `Devis en cours${NBSP}: ${t.count}${NBSP}article${t.count > 1 ? 's' : ''} · ${fcfa(t.total)}`;
      ctaLabel.textContent = 'Reprendre mon devis';
    } else {
      resume.hidden = true;
      ctaLabel.textContent = 'Composer mon devis';
    }
  };
  syncResume();
  window.addEventListener('quote:change', syncResume);

  const frostPaths = buildFrost(root.querySelector('[data-intro-frost]'));
  if (reducedMotion) return;

  const title = root.querySelector('[data-intro-title]');
  const items = root.querySelectorAll('[data-intro-item]');
  const steps = root.querySelectorAll('[data-intro-step]');
  const cubes = [...root.querySelectorAll('.quote-intro__cube')];
  const crumbs = root.querySelector('.quote-intro__crumbs');

  const tl = gsap.timeline({ defaults: { ease: 'ice' }, delay: 0.1 });
  if (frostPaths.length) {
    tl.from(frostPaths, { drawSVG: '0%', duration: 1.8, ease: 'power2.out', stagger: { each: 0.004, from: 'start' } }, 0);
  }
  tl.from(crumbs, { opacity: 0, y: -10, duration: 0.6 }, 0.05);
  let split = null;
  if (title) {
    split = SplitText.create(title, { type: 'lines,chars', linesClass: 'split-line', mask: 'lines' });
    tl.from(split.chars, {
      yPercent: 115, rotate: 7, filter: 'blur(8px)', opacity: 0,
      duration: 1.05, stagger: { each: 0.022 },
    }, 0.12);
  }
  tl.from(items, { opacity: 0, y: 26, filter: 'blur(6px)', duration: 0.9, stagger: 0.09, clearProps: 'filter' }, 0.45)
    .from(steps, {
      opacity: 0, y: 46, rotateX: -28, transformOrigin: '50% 0%', filter: 'blur(8px)',
      duration: 1.1, stagger: 0.12, clearProps: 'filter,transform',
    }, 0.6)
    .from(cubes, { opacity: 0, scale: 0.6, y: 60, rotate: -20, duration: 1.4, stagger: 0.1, ease: 'back.out(1.4)' }, 0.3);

  // Dérive lente des glaçons (en pause hors écran / onglet caché : GSAP s'arrête avec l'onglet).
  const floats = cubes.map((c, i) => gsap.to(c.firstElementChild, {
    y: i % 2 ? 14 : -16, rotate: i % 2 ? 6 : -5, duration: 4.2 + i * 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true,
  }));
  ScrollTrigger.create({
    trigger: root, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => floats.forEach((f) => (self.isActive ? f.play() : f.pause())),
  });

  // Parallaxe au défilement : les glaçons montent plus vite que le texte, le givre s'efface.
  gsap.to(cubes, {
    yPercent: (i) => -40 - i * 18, ease: 'none',
    scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 },
  });
  gsap.to(root.querySelector('[data-intro-frost]'), {
    opacity: 0.25, ease: 'none',
    scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
  });

  // Parallaxe au pointeur (bureau).
  if (finePointer && !isMobile) {
    const wrap = root.querySelector('[data-intro-cubes]');
    const qx = gsap.quickTo(wrap, 'x', { duration: 1.2, ease: 'power3.out' });
    const qy = gsap.quickTo(wrap, 'y', { duration: 1.2, ease: 'power3.out' });
    root.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect();
      qx(((e.clientX - r.left) / r.width - 0.5) * -26);
      qy(((e.clientY - r.top) / r.height - 0.5) * -18);
    });
  }
}
