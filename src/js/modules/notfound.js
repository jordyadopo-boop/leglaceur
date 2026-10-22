/**
 * Page 404 « Cette page a fondu. » (agent chrome).
 * Un glaçon isométrique fond en flaque (géométrie recalculée à chaque image, reflet dans la flaque, gouttes, ondes),
 * puis se regèle dans un éclat de cristaux. Toucher / cliquer le glaçon le regèle tout de suite.
 * Boucle mise en pause hors écran et onglet caché. Mouvement réduit : image fixe.
 */
import { gsap, reducedMotion } from '../core/motion.js';

export default function init(root) {
  const q = (s) => root.querySelector(s);
  const qa = (s) => [...root.querySelectorAll(s)];
  const scene = q('[data-nf-scene]');
  const parts = {
    top: q('[data-nf-top]'), left: q('[data-nf-left]'), right: q('[data-nf-right]'),
    shine: q('[data-nf-shine]'), edge: q('[data-nf-edge]'),
    puddle: q('[data-nf-puddle]'), shadow: q('[data-nf-shadow]'), clip: q('[data-nf-clip]'), hi: q('[data-nf-hi]'),
  };
  if (!scene || !parts.top) return;

  const state = { m: 0.42 };
  const render = () => apply(parts, iceShape(state.m));

  // Intro du texte (depuis un état visible)
  if (!reducedMotion) {
    gsap.from(root.querySelectorAll('.page-404__text > *'), { y: 30, opacity: 0, filter: 'blur(6px)', duration: 1.1, stagger: 0.09, ease: 'ice', clearProps: 'filter' });
    gsap.from(q('.page-404__code'), { scale: 1.12, opacity: 0, filter: 'blur(18px)', duration: 1.6, ease: 'ice', clearProps: 'filter' });
  }
  if (reducedMotion) return;

  const drops = qa('[data-nf-drop]');
  const ripples = qa('[data-nf-ripple]');
  const sparks = qa('[data-nf-sparks] path');
  gsap.set(drops, { opacity: 0 });
  gsap.set(sparks, { opacity: 0, scale: 0, transformOrigin: '50% 50%' });
  gsap.set(ripples, { opacity: 0, transformOrigin: '160px 216px' });

  const ripple = (i) => gsap.fromTo(ripples[i % ripples.length], { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 4.5, duration: 1.4, ease: 'power2.out' });
  const drip = (el, x, i) => {
    const y0 = iceShape(state.m).ft[1] + 22;
    return gsap.timeline()
      .set(el, { attr: { cx: x, cy: y0 }, opacity: 0, scale: 0.2, transformOrigin: '50% 50%' })
      .to(el, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' })
      .to(el, { attr: { cy: 208 }, duration: 0.9, ease: 'power2.in' })
      .to(el, { opacity: 0, duration: 0.12 })
      .add(() => ripple(i));
  };

  const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.4, onUpdate: render });
  loop.to(state, { m: 0.88, duration: 6.5, ease: 'sine.inOut' }, 0)
    .add(drip(drops[0], 141, 0), 0.6)
    .add(drip(drops[1], 182, 1), 2.1)
    .add(drip(drops[0], 136, 0), 3.6)
    .add(drip(drops[1], 186, 1), 4.8)
    .to({}, { duration: 1.1 })
    .add('freeze')
    .to(state, { m: 0, duration: 1.3, ease: 'back.out(1.4)' }, 'freeze')
    .to(sparks, { opacity: 1, scale: 1.3, rotation: 90, duration: 0.35, stagger: 0.08, ease: 'back.out(3)' }, 'freeze+=0.6')
    .to(sparks, { opacity: 0, scale: 0, rotation: 180, duration: 0.4, stagger: 0.08, ease: 'power2.in' }, 'freeze+=1.05')
    .to({}, { duration: 1.2 });
  loop.time(2.9); // démarre là où le glaçon statique s'est arrêté (≈ 42 % fondu)
  render();

  // Toucher / cliquer : regel immédiat
  const hint = q('[data-nf-hint]');
  if (hint) hint.hidden = false;
  const svg = q('.page-404__svg');
  svg.setAttribute('tabindex', '0');
  svg.setAttribute('role', 'button');
  svg.setAttribute('aria-label', 'Regeler le glaçon');
  const refreeze = () => {
    if (loop.currentLabel() === 'freeze' && loop.time() > loop.labels.freeze) return;
    loop.seek('freeze');
  };
  svg.addEventListener('click', refreeze);
  svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); refreeze(); } });

  // Pause hors écran / onglet caché
  let inView = true;
  const sync = () => { (inView && !document.hidden) ? loop.resume() : loop.pause(); };
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(scene);
  document.addEventListener('visibilitychange', sync);

  // Parallaxe douce au pointeur
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const code = q('.page-404__code');
    const xTo = gsap.quickTo(code, 'x', { duration: 1.2, ease: 'power3.out' });
    const yTo = gsap.quickTo(code, 'y', { duration: 1.2, ease: 'power3.out' });
    root.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect();
      xTo(((e.clientX - r.left) / r.width - 0.5) * -24);
      yTo(((e.clientY - r.top) / r.height - 0.5) * -16);
    }, { passive: true });
  }
}

function apply(p, s) {
  p.top.setAttribute('d', s.top);
  p.left.setAttribute('d', s.left);
  p.right.setAttribute('d', s.right);
  p.shine?.setAttribute('d', s.shine);
  p.edge?.setAttribute('d', s.edge);
  for (const el of [p.puddle, p.clip, p.shadow]) {
    if (!el) continue;
    el.setAttribute('rx', s.puddle.rx);
    el.setAttribute('ry', s.puddle.ry);
  }
  if (p.hi) {
    p.hi.setAttribute('cx', 160 - s.puddle.rx * 0.35);
    p.hi.setAttribute('rx', s.puddle.rx * 0.3);
    p.hi.setAttribute('ry', s.puddle.ry * 0.22);
  }
}

/** Géométrie du glaçon (0 = cube net, 1 = presque entièrement fondu). Coordonnées du viewBox 0 0 320 260. */
function iceShape(m) {
  const r = (n) => Math.round(n * 10) / 10;
  const cx = 160;
  const gy = 214;
  const a = 60 * (1 + 0.22 * m);
  const dy = 30 * (1 + 0.1 * m);
  const h = 84 * (1 - 0.74 * m);
  const bulge = 16 * m;
  const L = [cx - a, gy - dy];
  const F = [cx, gy];
  const R = [cx + a, gy - dy];
  const up = (p, k = 1) => [p[0], p[1] - h * k];
  // le haut s'affaisse et se resserre un peu en fondant
  const shrink = 1 - 0.12 * m;
  const top = (p) => [cx + (p[0] - cx) * shrink, p[1] - h];
  const Lt = top(L);
  const Ft = top(F);
  const Rt = top(R);
  const Bt = [cx, gy - 2 * dy * shrink - h];
  const t = 0.05 + 0.42 * m;
  const lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  // polygone aux coins arrondis (tc = facteur par sommet)
  const round = (pts, tc) => {
    let d = '';
    pts.forEach((V, i) => {
      const P = pts[(i - 1 + pts.length) % pts.length];
      const N = pts[(i + 1) % pts.length];
      const k = tc[i];
      const A = lerp(V, P, k);
      const B = lerp(V, N, k);
      d += `${i ? 'L' : 'M'}${r(A[0])} ${r(A[1])} Q${r(V[0])} ${r(V[1])} ${r(B[0])} ${r(B[1])} `;
    });
    return d + 'Z';
  };
  // faces latérales : bord extérieur bombé
  const side = (B1, B2, T2, T1, dir) => {
    const mid = lerp(B1, T1, 0.5);
    const c = [mid[0] + dir * bulge, mid[1]];
    const k = t;
    const T1a = lerp(T1, B1, k * 0.8);
    const T1b = lerp(T1, T2, k);
    const T2a = lerp(T2, T1, k);
    const T2b = lerp(T2, B2, k * 0.8);
    return `M${r(B1[0])} ${r(B1[1])} L${r(B2[0])} ${r(B2[1])} L${r(T2b[0])} ${r(T2b[1])} Q${r(T2[0])} ${r(T2[1])} ${r(T2a[0])} ${r(T2a[1])} L${r(T1b[0])} ${r(T1b[1])} Q${r(T1[0])} ${r(T1[1])} ${r(T1a[0])} ${r(T1a[1])} Q${r(c[0])} ${r(c[1])} ${r(B1[0])} ${r(B1[1])}Z`;
  };
  return {
    top: round([Lt, Ft, Rt, Bt], [t, t, t, t]),
    left: side(L, F, Ft, Lt, -1),
    right: side(R, F, Ft, Rt, 1),
    shine: `M${r(lerp(Lt, Bt, 0.3)[0])} ${r(lerp(Lt, Bt, 0.3)[1] + 4)} L${r(lerp(Bt, Rt, 0.25)[0])} ${r(lerp(Bt, Rt, 0.25)[1] + 6)}`,
    edge: `M${r(Ft[0])} ${r(Ft[1] + 3)} L${r(F[0])} ${r(F[1] - 3)}`,
    puddle: { rx: r(70 + 100 * m), ry: r(14 + 10 * m), cy: gy + 2 },
    ft: Ft,
  };
}
