/**
 * Bandeau défilant « rubans de glace » (agent products).
 * - Textes revérifiés contre config.js (SECTORS, PRODUCTS, DELIVERY.freeLabel) : le HTML statique reste la version sans JS.
 * - Boucle infinie : le groupe d'origine est dupliqué autant que nécessaire ; les copies sont aria-hidden.
 * - La vitesse et l'inclinaison (skewX) réagissent à la vitesse de défilement ; le sens s'inverse quand on remonte.
 * - Ticker GSAP actif seulement quand le bandeau est à l'écran ; aucun mouvement en prefers-reduced-motion.
 */
import { SECTORS, PRODUCTS, DELIVERY } from '../config.js';
import { gsap, ScrollTrigger, reducedMotion, finePointer } from '../core/motion.js';

const nbsp = (s) => String(s).replace(/(\d) (?=\S)/g, '$1 ');
const norm = (s) => String(s).replace(/[\s  ]+/g, ' ').trim();

/** Remet la liste en phase avec la config (sans toucher au DOM si tout est déjà juste). */
function syncGroup(group, labels, outlineEvery = 0) {
  if (!group) return;
  const items = [...group.children];
  const current = items.map((li) => norm(li.querySelector('.marquee__word')?.textContent || ''));
  if (current.length === labels.length && current.every((t, i) => t === norm(labels[i]))) return;
  const tpl = items[0];
  if (!tpl) return;
  group.replaceChildren(
    ...labels.map((label, i) => {
      const li = tpl.cloneNode(true);
      const word = li.querySelector('.marquee__word');
      word.textContent = nbsp(label);
      if (outlineEvery) word.classList.toggle('marquee__word--outline', i % outlineEvery === 1);
      return li;
    }),
  );
}

export default function init(root) {
  root.style.setProperty('--mq-tex', `url("${import.meta.env.BASE_URL}img/texture-glace-960.webp")`);

  syncGroup(root.querySelector('[data-marquee-sectors]'), SECTORS.map((s) => s.label));
  syncGroup(
    root.querySelector('[data-marquee-products]'),
    [...PRODUCTS.filter((p) => p.available).map((p) => p.name), DELIVERY.freeLabel],
    2,
  );

  const rows = [...root.querySelectorAll('[data-marquee-row]')].map((band) => ({
    band,
    track: band.querySelector('.marquee__track'),
    group: band.querySelector('.marquee__group'),
    speed: Number(band.dataset.speed) || 50,
    dir: Number(band.dataset.dir) || -1,
    x: 0,
    w: 1,
    hover: 1,
    hoverTarget: 1,
  }));

  const fill = () => {
    for (const r of rows) {
      r.track.querySelectorAll('[data-clone]').forEach((n) => n.remove());
      r.w = Math.max(1, r.group.offsetWidth);
      const copies = Math.ceil(r.band.offsetWidth / r.w) + 1;
      for (let i = 0; i < copies; i++) {
        const c = r.group.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.removeAttribute('aria-label');
        for (const a of ['data-marquee-sectors', 'data-marquee-products']) c.removeAttribute(a);
        c.dataset.clone = '';
        r.track.append(c);
      }
      r.x = ((r.x % r.w) - r.w) % r.w; // reste dans ]-w, 0]
    }
  };
  fill();
  // Les polices peuvent changer la largeur des mots : on recalcule une fois chargées.
  document.fonts?.ready.then(fill).catch(() => {});

  let visible = false;
  let running = false;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    root.classList.toggle('is-visible', visible);
    sync();
  }, { rootMargin: '80px 0px' });
  io.observe(root);

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fill, 150);
  }).observe(root);

  if (reducedMotion) return;

  // Vitesse de défilement (px/s) : rafraîchie pendant le défilement, amortie ensuite.
  let vel = 0;
  let scrollDir = 1;
  let boost = 0;
  let skew = 0;
  let rot = 0;
  ScrollTrigger.create({
    trigger: root,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => { vel = self.getVelocity(); },
  });

  if (finePointer) {
    for (const r of rows) {
      r.band.addEventListener('pointerenter', () => { r.hoverTarget = 0.3; });
      r.band.addEventListener('pointerleave', () => { r.hoverTarget = 1; });
    }
  }

  const clamp = gsap.utils.clamp(-11, 11);
  function tick(_time, deltaMs) {
    const dt = Math.min(deltaMs, 64) / 1000;
    vel *= 0.9;
    if (Math.abs(vel) > 40) scrollDir = vel > 0 ? 1 : -1;
    boost += (Math.min(Math.abs(vel) / 420, 6) - boost) * 0.1;
    skew += (clamp(vel / 170) - skew) * 0.12;
    for (const r of rows) {
      r.hover += (r.hoverTarget - r.hover) * 0.08;
      r.x += r.speed * r.hover * (1 + boost) * r.dir * scrollDir * dt;
      if (r.x <= -r.w) r.x += r.w;
      else if (r.x > 0) r.x -= r.w;
      // Les lettres « traînent » dans le sens du mouvement, comme des blocs qui glissent.
      r.track.style.transform = `translate3d(${r.x.toFixed(2)}px,0,0) skewX(${(skew * r.dir * scrollDir * -1).toFixed(2)}deg)`;
    }
    rot += (40 + boost * 160) * dt * scrollDir;
    root.style.setProperty('--mq-rot', `${(rot % 360).toFixed(1)}deg`);
  }

  function sync() {
    if (reducedMotion) return;
    const shouldRun = visible && !document.hidden;
    if (shouldRun && !running) gsap.ticker.add(tick);
    if (!shouldRun && running) gsap.ticker.remove(tick);
    running = shouldRun;
  }
  document.addEventListener('visibilitychange', sync);
  sync();
}
