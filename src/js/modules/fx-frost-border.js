/**
 * fx-frost-border — à l'apparition, du givre fractal pousse depuis les coins et les bords de l'élément
 * (croissance dendritique procédurale : tiges + barbes à 60°, étoiles de glace), puis il se retire
 * en partie et laisse une fine bordure cristalline qui se dessine autour de l'élément.
 * Options : data-frost-depth="70" (profondeur maximale en px), data-frost-delay="0.2" (s),
 *           data-frost-edges="top left" (bords concernés ; par défaut tous), data-frost-final="0.6"
 *           (opacité du givre une fois posé), data-fx-tone="dark|light".
 * En mouvement réduit : le givre est posé d'emblée, sans animation.
 * Coût : la croissance dessine seulement les nouveaux segments de chaque image ; ensuite plus rien ne tourne.
 */
import { claim, reducedMotion, gsap, clamp, numAttr, seedFrom, toneOf } from '../fx/env.js';
import { createLayer, radiusOf } from '../fx/layer.js';
import { createTask } from '../fx/loop.js';
import { onceInView } from '../fx/visibility.js';
import { growFrost, indexAt, strokeSegments } from '../fx/crystals.js';

let uid = 0;
const SVGNS = 'http://www.w3.org/2000/svg';

export default function init(el) {
  if (!claim(el, 'fx-frost-border')) return;
  el.classList.add('fx-frost-border-host');
  const id = ++uid;
  const tone = toneOf(el);
  const dark = tone === 'dark';
  const finalOpacity = clamp(numAttr(el, 'frostFinal', dark ? 0.7 : 0.62));
  const edges = el.dataset.frostEdges?.split(/\s+/).filter((e) => /^(top|right|bottom|left)$/.test(e));

  let segs = [];
  let state = 'idle'; // idle → growing → done
  let drawn = 0;
  let progress = 0;
  let radius = 0;

  const layer = createLayer(el, {
    className: `fx-frost-border fx-frost-border--${tone}`,
    dpr: undefined,
    onResize: () => {
      if (state === 'idle') return;
      build();
      paintAll();
      if (state === 'growing') finish(true);
      sizeLine();
    },
  });
  const { ctx, canvas } = layer;

  // Liseré cristallin final (SVG : tracé net à toutes les tailles, animé par stroke-dashoffset).
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', `fx-layer fx-frost-border__line fx-frost-border__line--${tone}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = `<defs><linearGradient id="fxfb-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="${dark ? '#bfe4ff' : '#8ecfff'}"/>
      <stop offset="0.62" stop-color="${dark ? '#4d9bff' : '#1563d6'}" stop-opacity="${dark ? 0.7 : 0.45}"/><stop offset="1" stop-color="#fff"/>
    </linearGradient></defs><rect pathLength="1" fill="none" stroke="url(#fxfb-${id})" stroke-width="1.25"/>`;
  el.append(svg);
  const rect = svg.querySelector('rect');
  rect.style.strokeDasharray = '1';
  rect.style.strokeDashoffset = reducedMotion ? '0' : '1';

  function sizeLine() {
    const w = layer.w;
    const h = layer.h;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    rect.setAttribute('x', '0.75');
    rect.setAttribute('y', '0.75');
    rect.setAttribute('width', String(Math.max(0, w - 1.5)));
    rect.setAttribute('height', String(Math.max(0, h - 1.5)));
    const r = Math.max(0, radius - 0.75);
    rect.setAttribute('rx', String(r));
    rect.setAttribute('ry', String(r));
  }

  function build() {
    const w = layer.w;
    const h = layer.h;
    radius = Math.min(radiusOf(el), w / 2, h / 2);
    const depth = numAttr(el, 'frostDepth', clamp(Math.min(w, h) * 0.24, 26, 92));
    segs = growFrost({
      w,
      h,
      depth,
      seed: seedFrom(el.className + (el.id || '') + id),
      spacing: clamp(depth * 0.9, 26, 60),
      step: depth < 50 ? 2.6 : 3.4,
      maxGen: 2,
      corner: 1.5,
      edgeReach: [0.12, 0.62],
      stars: 2.5,
      pair: 0.45,
      edges,
    });
  }

  function clip() {
    const w = layer.w;
    const h = layer.h;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0, 0, w, h, radius);
    else ctx.rect(0, 0, w, h);
    ctx.clip();
  }

  const W_LIGHT = [1.5, 1.0, 0.7];
  const W_SHADOW = [1.9, 1.3, 0.9];

  function paint(from, to) {
    if (from >= to) return;
    ctx.save();
    clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 1) ombre portée (relief), 2) corps du cristal, 3) arête lumineuse.
    strokeSegments(ctx, segs, from, to, W_SHADOW, () => (dark ? 'rgba(4,14,36,0.45)' : 'rgba(21,99,214,0.22)'), 0.7, 0.9);
    strokeSegments(ctx, segs, from, to, W_LIGHT, (g) => (dark ? `rgba(191,228,255,${0.85 - g * 0.15})` : `rgba(77,155,255,${0.62 - g * 0.12})`));
    strokeSegments(ctx, segs, from, to, [0.8, 0.55, 0.4], () => 'rgba(255,255,255,0.95)', -0.35, -0.45);
    ctx.restore();
  }

  function paintAll() {
    ctx.clearRect(0, 0, layer.w, layer.h);
    paint(0, segs.length);
    drawn = segs.length;
  }

  const DURATION = 1.9;
  const task = createTask('frost-border', (dt) => {
    progress = Math.min(1, progress + dt / DURATION);
    // Rapide au début, puis la croissance ralentit (comme le gel qui gagne une vitre).
    const e = 1 - (1 - progress) ** 2.4;
    const to = indexAt(segs, e);
    paint(drawn, to);
    drawn = Math.max(drawn, to);
    if (progress >= 1) finish(false);
  });

  function finish(instant) {
    task.stop();
    if (drawn < segs.length) paint(drawn, segs.length);
    drawn = segs.length;
    state = 'done';
    el.classList.add('is-frosted');
    if (instant || reducedMotion) {
      canvas.style.opacity = String(finalOpacity);
      rect.style.strokeDashoffset = '0';
      return;
    }
    // Le givre se retire en partie, le liseré cristallin fait le tour de l'élément.
    gsap.to(canvas, { opacity: finalOpacity, duration: 1.6, ease: 'power2.inOut' });
    gsap.to(rect, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' });
  }

  function start() {
    if (!layer.ready) layer.measure();
    if (!layer.w || !layer.h) return;
    build();
    sizeLine();
    state = 'growing';
    el.classList.add('is-frosting');
    if (reducedMotion) {
      paintAll();
      finish(true);
      return;
    }
    const delay = numAttr(el, 'frostDelay', 0);
    if (delay > 0) gsap.delayedCall(delay, () => task.start());
    else task.start();
  }

  if (reducedMotion) {
    // Pas d'animation : le givre est posé dès que la taille est connue.
    requestAnimationFrame(start);
    return;
  }
  onceInView(el, start, { ratio: 0.35 });
}
