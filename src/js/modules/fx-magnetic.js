/**
 * fx-magnetic — le bouton est attiré par le pointeur quand il s'en approche,
 * son icône un peu plus que lui (parallaxe), puis revient avec un léger rebond.
 * Options : data-magnetic="0.35" (force), data-magnetic-radius="60" (zone d'attraction en px autour du bouton).
 * Pointeur fin uniquement ; désactivé en mouvement réduit.
 */
import { claim, reducedMotion, finePointer, gsap, numAttr } from '../fx/env.js';
import { createTask } from '../fx/loop.js';
import { watchVisibility } from '../fx/visibility.js';

const items = new Set();
const visible = new Set();
const pointer = { x: -1e4, y: -1e4, moved: false };
let quiet = 0;
let listening = false;

const task = createTask('magnetic', (dt) => {
  quiet += dt;
  if (pointer.moved) {
    pointer.moved = false;
    quiet = 0;
    for (const it of visible) update(it);
  }
  if (quiet > 0.25) task.stop();
});

function update(it) {
  const b = it.el.getBoundingClientRect();
  // Position de repos (sans le décalage magnétique en cours).
  const cx = b.left + b.width / 2 - it.x;
  const cy = b.top + b.height / 2 - it.y;
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  const inX = Math.abs(dx) < b.width / 2 + it.radius;
  const inY = Math.abs(dy) < b.height / 2 + it.radius;
  if (inX && inY) {
    it.x = dx * it.strength;
    it.y = dy * it.strength;
    it.active = true;
    it.qx(it.x);
    it.qy(it.y);
    it.icons.forEach((q) => {
      q.qx(dx * it.strength * 0.45);
      q.qy(dy * it.strength * 0.45);
    });
  } else if (it.active) release(it);
}

function release(it) {
  it.active = false;
  it.x = 0;
  it.y = 0;
  gsap.to(it.el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
  it.icons.forEach((q) => gsap.to(q.el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' }));
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.moved = true;
      if (visible.size) task.start();
    },
    { passive: true },
  );
  // Le défilement déplace les boutons sous un pointeur immobile.
  window.addEventListener(
    'scroll',
    () => {
      if (!visible.size || pointer.x < -1e3) return;
      pointer.moved = true;
      task.start();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.x = -1e4;
    pointer.moved = true;
    task.start();
  });
}

export default function init(el) {
  if (!claim(el, 'fx-magnetic')) return;
  if (reducedMotion || !finePointer) return;
  const it = {
    el,
    x: 0,
    y: 0,
    active: false,
    strength: numAttr(el, 'magnetic', 0.32),
    radius: numAttr(el, 'magneticRadius', 56),
    qx: gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3.out' }),
    qy: gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3.out' }),
    icons: [...el.querySelectorAll(':scope > svg, :scope > .icon, [data-magnetic-inner]')].map((n) => ({
      el: n,
      qx: gsap.quickTo(n, 'x', { duration: 0.6, ease: 'power3.out' }),
      qy: gsap.quickTo(n, 'y', { duration: 0.6, ease: 'power3.out' }),
    })),
  };
  items.add(it);
  listen();
  watchVisibility(
    el,
    (on) => {
      if (on) visible.add(it);
      else {
        visible.delete(it);
        if (it.active) release(it);
      }
    },
    { margin: '0px' },
  );
  el.addEventListener('blur', () => it.active && release(it));
}
