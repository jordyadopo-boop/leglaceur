/**
 * Fabrication (#fabrication) — « De l'eau pure à votre verre ».
 * Grand écran (≥ 1024 px, hauteur ≥ 680 px) : scène collante en CSS (position: sticky, aucune pin GSAP),
 *   le tracé se dessine au scrub (DrawSVG), une goutte le parcourt (MotionPath) et gèle à l'étape 2
 *   (MorphSVG goutte → glaçon, givre, couleur qui se refroidit), est emballée, stockée, puis tombe dans le verre.
 * Grand écran bas : même tracé, scrubbé pendant son passage à l'écran (sans scène collante).
 * Mobile / tablette : rail vertical qui se remplit, le même voyageur descend et se transforme.
 * Mouvement réduit / sans JS : toutes les étapes sont visibles, tracé complet.
 */
import { gsap, ScrollTrigger, reducedMotion } from '../core/motion.js';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { BRAND, DELIVERY } from '../config.js';

gsap.registerPlugin(MorphSVGPlugin);

const DROP = 'M0-30C-5-21-20-6-20 8A20 20 0 0 0 20 8C20-6 5-21 0-30Z';
const HEX = 'M0-26L24-13L24 13L0 26L-24 13L-24-13Z';
let uid = 0;

function travellerMarkup(id) {
  return `
  <defs>
    <radialGradient id="${id}-glow"><stop offset="0" stop-color="#8ecfff" stop-opacity="0.7"/><stop offset="0.55" stop-color="#4d9bff" stop-opacity="0.18"/><stop offset="1" stop-color="#4d9bff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" class="pt__stop-a" style="stop-color:#8ecfff"/>
      <stop offset="1" class="pt__stop-b" style="stop-color:#1563d6"/>
    </linearGradient>
  </defs>
  <g class="pt">
    <circle class="pt__glow" r="46" fill="url(#${id}-glow)"/>
    <rect class="pt__pack" x="-35" y="-35" width="70" height="70" rx="14"/>
    <path class="pt__body" d="${DROP}" fill="url(#${id}-body)"/>
    <g class="pt__cube">
      <path class="pt__face" d="M0-26 24-13 0 0-24-13Z" fill="#ffffff"/>
      <path class="pt__face" d="M-24-13 0 0V26L-24 13Z" fill="#a3d2f6"/>
      <path class="pt__face" d="M24-13 0 0V26L24 13Z" fill="#d4ecfd"/>
      <path class="pt__edge" d="M0-26 24-13 0 0-24-13ZM0 0V26"/>
    </g>
    <g class="pt__frost">
      <path d="M-18-6l5 2.6M-15.5-7.3l.6 4M-20 4l6 2.5M10 6l7-3.6M13.5 4.6l.8 4M8 15l6-3M-6-20l6 3 6-3M0-17v4M-12 16l5 2.5"/>
    </g>
    <ellipse class="pt__shine" cx="-8" cy="2" rx="3" ry="7"/>
  </g>`;
}

function syncContent(root) {
  const street = root.querySelector('[data-street]');
  if (street) street.textContent = BRAND.address.street;
  const free = root.querySelector('[data-free-text]');
  if (free) free.textContent = `offerte dès ${DELIVERY.freeFrom} articles`;
}

/** Fractions (0-1) de la longueur du tracé les plus proches de chaque nœud. */
function nodeFractions(path, nodes) {
  const len = path.getTotalLength();
  const samples = 400;
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(path.getPointAtLength((len * i) / samples));
  return nodes.map((n) => {
    const m = n.transform.baseVal.consolidate()?.matrix;
    const x = m ? m.e : 0;
    const y = m ? m.f : 0;
    let best = 0;
    let bestD = Infinity;
    pts.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best / samples;
  });
}

/** Transformation du voyageur, posée sur une timeline normalisée (0 → 1) aux temps des étapes. */
function addTransformation(tl, host, t) {
  const q = (s) => host.querySelector(s);
  const qa = (s) => host.querySelectorAll(s);
  const body = q('.pt__body');
  const cube = q('.pt__cube');
  const frost = qa('.pt__frost path');
  const pack = q('.pt__pack');
  const glow = q('.pt__glow');
  const stopA = q('.pt__stop-a');
  const stopB = q('.pt__stop-b');
  const shine = q('.pt__shine');

  gsap.set(cube, { opacity: 0 });
  gsap.set(frost, { drawSVG: '0%', opacity: 0 });
  gsap.set(pack, { opacity: 0, scale: 1.5, transformOrigin: '50% 50%' });
  gsap.set(glow, { transformOrigin: '50% 50%', scale: 0.8 });

  // Congélation : la goutte devient glaçon, la couleur se refroidit.
  const f0 = Math.max(0, t[1] - 0.07);
  tl.to(body, { morphSVG: HEX, duration: 0.07, ease: 'power2.inOut' }, f0)
    .to(stopA, { stopColor: '#ffffff', duration: 0.07, ease: 'none' }, f0)
    .to(stopB, { stopColor: '#8ecfff', duration: 0.07, ease: 'none' }, f0)
    .to(cube, { opacity: 1, duration: 0.04, ease: 'none' }, t[1] - 0.02)
    .to(shine, { opacity: 0, duration: 0.04, ease: 'none' }, t[1] - 0.03)
    .to(glow, { scale: 1.25, duration: 0.05, ease: 'power2.out' }, t[1] - 0.02)
    .to(glow, { scale: 0.9, duration: 0.06, ease: 'power2.inOut' }, t[1] + 0.03)
    // Le givre gagne le glaçon.
    .to(frost, { opacity: 1, drawSVG: '100%', duration: Math.max(0.05, t[3] - t[1]) * 0.8, stagger: 0.008, ease: 'none' }, t[1])
    // Conditionnement : l'emballage se referme autour.
    .to(pack, { opacity: 1, scale: 1, duration: 0.05, ease: 'back.out(2)' }, t[2] - 0.04)
    // Stockage au froid : le halo s'intensifie.
    .to(glow, { scale: 1.35, duration: 0.05, ease: 'power2.out' }, t[3] - 0.03)
    // Livraison : l'emballage s'ouvre, le glaçon rejoint le verre.
    .to(pack, { opacity: 0, scale: 1.6, duration: 0.05, ease: 'power2.in' }, t[4] - 0.06)
    .to(glow, { scale: 1, duration: 0.05 }, t[4] - 0.04);
}

function setStep(root, steps, idx, readout) {
  if (root._step === idx) return;
  const prev = root._step ?? -1;
  root._step = idx;
  steps.forEach((s, i) => {
    s.classList.toggle('is-on', i <= idx);
    s.classList.toggle('is-current', i === idx);
  });
  if (readout?.num && idx >= 0) {
    const n = String(idx + 1).padStart(2, '0');
    const name = steps[idx].querySelector('.ps__title')?.textContent || '';
    const dir = idx > prev ? 1 : -1;
    root._readoutTl?.progress(1).kill();
    root._readoutTl = gsap.timeline()
      .to([readout.num, readout.name], { yPercent: -60 * dir, opacity: 0, duration: 0.18, ease: 'power2.in' })
      .add(() => { readout.num.textContent = n; readout.name.textContent = name; })
      .fromTo([readout.num, readout.name], { yPercent: 60 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.05 });
  }
  const icon = steps[idx]?.querySelectorAll('.ps__draw');
  if (icon?.length && idx > prev) gsap.fromTo(icon, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, stagger: 0.1, ease: 'power2.inOut' });
}

/** Mode tracé horizontal (grand écran) ; sticky = scène collante sur toute la section. */
function setupTrack(root, steps, sticky) {
  const svg = root.querySelector('.process__svg');
  const line = root.querySelector('[data-line]');
  const slot = root.querySelector('[data-traveller-slot]');
  const nodes = [...root.querySelectorAll('.process__node')];
  if (!svg || !line || !slot || nodes.length !== steps.length) return () => {};

  const id = `pt${++uid}`;
  slot.innerHTML = travellerMarkup(id);
  const trav = slot.querySelector('.pt');
  const zero = root.querySelector('.process__zero');
  const glass = root.querySelectorAll('.process__glass path:not(.process__glass-water)');
  const water = root.querySelector('.process__glass-water');
  const readout = { num: root.querySelector('[data-readout]'), name: root.querySelector('[data-readout-name]') };

  root.classList.add('is-scrolly');
  if (sticky) root.classList.add('is-sticky');

  const frac = nodeFractions(line, nodes);
  const T0 = 0.05;
  const SPAN = 0.85;
  const t = frac.map((f) => T0 + f * SPAN);

  gsap.set(line, { drawSVG: '0%' });
  gsap.set(zero, { opacity: 0, scale: 0.5, transformOrigin: '50% 50%' });
  gsap.set(glass, { drawSVG: '0%' });
  gsap.set(water, { scaleY: 0, transformOrigin: '50% 100%' });
  nodes.forEach((n) => gsap.set(n.querySelector('.process__node-halo'), { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' }));

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.set({}, {}, 1)
    .to(line, { drawSVG: '100%', duration: SPAN }, T0)
    .fromTo(trav, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.04, ease: 'back.out(2)' }, T0 - 0.04)
    .to(slot, { motionPath: { path: line, start: 0, end: 1 }, duration: SPAN }, T0);
  nodes.forEach((n, i) => {
    tl.to(n.querySelector('.process__node-halo'), { scale: 1.5, opacity: 1, duration: 0.05, ease: 'power2.out' }, t[i] - 0.01)
      .to(n.querySelector('.process__node-halo'), { scale: 1, opacity: 0.6, duration: 0.06 }, t[i] + 0.04);
  });
  tl.to(zero, { opacity: 1, scale: 1, duration: 0.05, ease: 'back.out(2.2)' }, t[1] - 0.09);
  addTransformation(tl, slot, t);
  tl.to(glass, { drawSVG: '100%', duration: 0.08, ease: 'power2.out' }, t[4] - 0.1)
    .to(water, { scaleY: 1, duration: 0.06, ease: 'power2.out' }, t[4] - 0.02)
    .to(trav, { scale: 0.62, y: 2, duration: 0.05, ease: 'power2.in' }, t[4] - 0.03);

  const st = ScrollTrigger.create({
    trigger: sticky ? root : root.querySelector('.process__track'),
    start: sticky ? 'top top' : 'top 85%',
    end: sticky ? 'bottom bottom' : 'bottom 25%',
    scrub: sticky ? 0.8 : 0.6,
    animation: tl,
    refreshPriority: -1,
    invalidateOnRefresh: true,
  });
  // Les étapes suivent la timeline elle-même (le scrub lissé continue après le dernier événement de défilement) :
  // lecture à chaque image, uniquement tant que la scène est active.
  const sync = () => {
    const p = tl.time();
    let idx = 0;
    t.forEach((ti, i) => { if (p >= ti - 0.012) idx = i; });
    setStep(root, steps, idx, readout);
  };
  let ticking = false;
  const watch = (on) => {
    if (on && !ticking) { gsap.ticker.add(sync); ticking = true; }
    if (!on && ticking) { gsap.ticker.remove(sync); ticking = false; sync(); }
  };
  const io = new IntersectionObserver(([e]) => watch(e.isIntersecting));
  io.observe(root);
  setStep(root, steps, 0, null);

  // Entrée de la scène.
  const head = root.querySelectorAll('.process__head-main > *, .process__head-side > *');
  const intro = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 75%', once: true } });
  intro.from(head, { y: 40, opacity: 0, duration: 1, stagger: 0.08 }, 0)
    .from(steps, { y: 60, opacity: 0, duration: 1.1, stagger: 0.08, clearProps: 'transform,opacity' }, 0.15)
    .from(root.querySelector('.process__track'), { opacity: 0, duration: 1.2 }, 0.1);

  return () => {
    io.disconnect();
    watch(false);
    st.kill();
    tl.kill();
    intro.kill();
    slot.innerHTML = '';
    gsap.set(slot, { clearProps: 'all' });
    root.classList.remove('is-scrolly', 'is-sticky');
    steps.forEach((s) => s.classList.remove('is-on', 'is-current'));
    root._step = undefined;
  };
}

/** Mode rail vertical (mobile / tablette). */
function setupRail(root, steps) {
  const list = root.querySelector('.process__steps');
  const flow = root.querySelector('.process__flow');
  if (!list || !flow) return () => {};
  const fill = document.createElement('span');
  fill.className = 'process__rail-fill';
  fill.setAttribute('aria-hidden', 'true');
  const box = document.createElement('div');
  box.className = 'process__rail-traveller';
  box.setAttribute('aria-hidden', 'true');
  const id = `pt${++uid}`;
  box.innerHTML = `<svg viewBox="-40 -40 80 80" focusable="false">${travellerMarkup(id)}</svg>`;
  flow.append(fill, box);
  const trav = box.querySelector('.pt');
  root.classList.add('is-scrolly');

  // Positions des points de chaque étape le long du rail (fractions 0 → 1).
  let t = [0, 0.25, 0.5, 0.75, 1];
  const measure = () => {
    // offsetHeight / offsetTop : mesures sans la transformation scaleY du remplissage.
    const len = Math.max(1, fill.offsetHeight);
    const flowTop = flow.getBoundingClientRect().top;
    t = steps.map((s) => {
      const d = s.querySelector('.ps__dot').getBoundingClientRect();
      return Math.min(1, Math.max(0, (d.top + d.height / 2 - flowTop - fill.offsetTop) / len));
    });
    return len;
  };
  let len = measure();

  let tl;
  const build = () => {
    tl?.kill();
    gsap.set([box, trav], { clearProps: 'transform' });
    box.querySelector('.pt__body').setAttribute('d', DROP);
    box.querySelector('.pt__stop-a').style.stopColor = '#8ecfff';
    box.querySelector('.pt__stop-b').style.stopColor = '#1563d6';
    tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true });
    tl.set({}, {}, 1)
      .fromTo(fill, { scaleY: 0 }, { scaleY: 1, duration: 1 }, 0)
      .fromTo(box, { y: 0 }, { y: () => len, duration: 1 }, 0);
    addTransformation(tl, box, t);
  };
  build();

  let st = null;
  st = ScrollTrigger.create({
    trigger: list,
    start: 'top 62%',
    end: 'bottom 62%',
    refreshPriority: -1,
    onRefresh: (self) => { len = measure(); build(); tl.progress(self.progress); },
    onUpdate(self) {
      gsap.to(tl, { progress: self.progress, duration: 0.5, ease: 'power2.out', overwrite: true });
      let idx = -1;
      t.forEach((ti, i) => { if (self.progress >= ti - 0.01) idx = i; });
      setStep(root, steps, idx, null);
    },
  });
  setStep(root, steps, -1, null);

  steps.forEach((s) => {
    gsap.from(s, { x: 40, opacity: 0, duration: 1, scrollTrigger: { trigger: s, start: 'top 88%', once: true }, clearProps: 'transform,opacity' });
  });

  return () => {
    st.kill();
    tl?.kill();
    fill.remove();
    box.remove();
    root.classList.remove('is-scrolly');
    steps.forEach((s) => s.classList.remove('is-on', 'is-current'));
    root._step = undefined;
  };
}

export default function init(root) {
  syncContent(root);
  if (reducedMotion) return;
  const steps = [...root.querySelectorAll('.ps')];
  if (!steps.length) return;

  const mm = gsap.matchMedia();
  mm.add({
    sticky: '(min-width: 1024px) and (min-height: 680px)',
    wideShort: '(min-width: 1024px) and (max-height: 679.98px)',
    narrow: '(max-width: 1023.98px)',
  }, (ctx) => {
    const { sticky, wideShort } = ctx.conditions;
    let cleanup;
    if (sticky || wideShort) cleanup = setupTrack(root, steps, sticky);
    else cleanup = setupRail(root, steps);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cleanup?.();
  });

  // Les modules au-dessus (produits, commande) peuvent changer de hauteur après le chargement des images.
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}
