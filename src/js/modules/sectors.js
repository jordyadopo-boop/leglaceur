/**
 * Secteurs (#secteurs) — « Pour tous vos usages ».
 * - Recommandations générées depuis config.js (SKUS) : nom, variante, prix, ajout direct au devis (addQty).
 * - Grand écran : accordéon horizontal de blocs de glace (survol, focus clavier, clic) ; mobile : cartes empilées.
 * - Jauge « livraison offerte dès N articles » reliée au panier (événement quote:change).
 */
import { gsap, ScrollTrigger, reducedMotion, finePointer } from '../core/motion.js';
import { SKUS, DELIVERY } from '../config.js';
import { addQty, computeTotals, getState } from '../core/quote-store.js';
import { fcfaShort } from '../core/format.js';
import { toast } from '../core/toast.js';

const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const NNBSP = ' ';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function buildRecos(root) {
  root.querySelectorAll('[data-skus]').forEach((ul) => {
    const skus = ul.dataset.skus.split(/\s+/).filter((s) => SKUS[s]?.product.available);
    if (!skus.length) return;
    const frag = document.createDocumentFragment();
    for (const sku of skus) {
      const v = SKUS[sku];
      const li = document.createElement('li');
      li.className = 'reco';
      li.dataset.sku = sku;
      li.innerHTML = `
        <span class="reco__info"><span class="reco__name"></span><span class="reco__variant"></span></span>
        <span class="reco__price"></span>
        <button type="button" class="reco__add" data-add>${PLUS}<span class="reco__qty" data-qty hidden></span></button>`;
      li.querySelector('.reco__name').textContent = v.product.name;
      li.querySelector('.reco__variant').textContent = v.label;
      li.querySelector('.reco__price').textContent = fcfaShort(v.price).replace('\u202f' + 'F', '\u00a0F');
      li.querySelector('[data-add]').setAttribute('aria-label', `Ajouter au devis : ${v.product.name}, ${v.label.toLowerCase()} (${fcfaShort(v.price)})`);
      frag.append(li);
    }
    ul.replaceChildren(frag);
    ul.classList.add('is-rich');
  });
}

function flyToBadge(from) {
  if (reducedMotion) return;
  const badge = document.querySelector('[data-quote-badge]');
  if (!badge) return;
  const b = badge.getBoundingClientRect();
  if (!b.width || b.bottom < 0) return;
  const a = from.getBoundingClientRect();
  const dot = document.createElement('span');
  dot.className = 'story-fly';
  dot.setAttribute('aria-hidden', 'true');
  document.body.append(dot);
  const x0 = a.left + a.width / 2 - 11;
  const y0 = a.top + a.height / 2 - 11;
  const x1 = b.left + b.width / 2 - 11;
  const y1 = b.top + b.height / 2 - 11;
  const mid = { x: (x0 + x1) / 2 + (x1 > x0 ? -80 : 80), y: Math.min(y0, y1) - 120 };
  gsap.timeline({ onComplete: () => dot.remove() })
    .set(dot, { x: x0, y: y0, rotation: 45, scale: 0.2 })
    .to(dot, { scale: 1.2, duration: 0.18, ease: 'back.out(3)' })
    .to(dot, { motionPath: { path: [{ x: x0, y: y0 }, mid, { x: x1, y: y1 }], curviness: 1.4 }, rotation: 405, duration: 0.8, ease: 'power2.in' }, 0.08)
    .to(dot, { scale: 0.3, opacity: 0, duration: 0.18, ease: 'power2.in' }, 0.75);
}

function wireAdd(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn || !root.contains(btn)) return;
    const sku = btn.closest('.reco')?.dataset.sku;
    const v = SKUS[sku];
    if (!v) return;
    addQty(sku, 1);
    const qty = getState().lines[sku] || 0;
    toast(`Devis${NNBSP}: ${v.product.name}, ${v.label.toLowerCase()} — ${plural(qty, v.unit, v.units)}`);
    flyToBadge(btn);
    if (!reducedMotion) gsap.fromTo(btn, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.4)', clearProps: 'transform' });
  });
}

function renderState(root, animate = true) {
  const lines = getState().lines;
  root.querySelectorAll('.reco').forEach((li) => {
    const q = lines[li.dataset.sku] || 0;
    const badge = li.querySelector('[data-qty]');
    li.classList.toggle('is-in', q > 0);
    if (badge) {
      badge.hidden = q === 0;
      badge.textContent = q > 99 ? '99+' : String(q);
    }
  });

  const basket = root.querySelector('[data-basket]');
  if (!basket) return;
  basket.hidden = false;
  const { count, remainingForFree, freeEligible } = computeTotals();
  basket.querySelector('[data-basket-count]').textContent = plural(count, 'article', 'articles');
  const msg = basket.querySelector('[data-basket-msg]');
  let text;
  if (count === 0) text = DELIVERY.freeLabel;
  else if (freeEligible) text = `Livraison offerte${NNBSP}!`;
  else text = `Plus que ${plural(remainingForFree, 'article', 'articles')} pour la livraison offerte`;
  if (msg.textContent !== text) msg.textContent = text;
  msg.classList.toggle('is-free', freeEligible);
  basket.classList.toggle('is-free', freeEligible);
  const ratio = Math.min(1, count / DELIVERY.freeFrom);
  const fill = basket.querySelector('[data-basket-fill]');
  if (animate && !reducedMotion) gsap.to(fill, { scaleX: ratio, duration: 0.9, ease: 'ice' });
  else gsap.set(fill, { scaleX: ratio });
  if (animate && !reducedMotion && freeEligible && !basket._wasFree) {
    gsap.fromTo(basket, { boxShadow: '0 0 0 0 rgba(57,168,91,0.6)' }, { boxShadow: '0 0 0 18px rgba(57,168,91,0)', duration: 1.2, ease: 'power2.out', clearProps: 'boxShadow' });
  }
  basket._wasFree = freeEligible;
}

/** Accordéon horizontal (grand écran). */
function setupAccordion(root) {
  const list = root.querySelector('[data-list]');
  const items = [...list.querySelectorAll('.sector')];
  list.classList.add('is-enhanced');
  let timer = 0;

  const activate = (li, { instant = false } = {}) => {
    if (!li || li.classList.contains('is-active')) return;
    items.forEach((x) => x.classList.toggle('is-active', x === li));
    if (!instant && !reducedMotion) {
      const body = li.querySelectorAll('.sector__num, .sector__name, .sector__text, .sector__recos > *, .reco');
      gsap.fromTo(body, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.035, delay: 0.22, ease: 'ice', overwrite: true, clearProps: 'transform,opacity' });
    }
  };

  const onEnter = (e) => {
    clearTimeout(timer);
    const li = e.currentTarget;
    timer = setTimeout(() => activate(li), 110);
  };
  const onLeave = () => clearTimeout(timer);
  const onFocus = (e) => activate(e.currentTarget, { instant: true });
  const onClick = (e) => {
    const li = e.currentTarget;
    if (!li.classList.contains('is-active')) { e.preventDefault(); activate(li); }
  };
  items.forEach((li) => {
    if (finePointer) {
      li.addEventListener('pointerenter', onEnter);
      li.addEventListener('pointerleave', onLeave);
    }
    li.addEventListener('focusin', onFocus);
    li.addEventListener('click', onClick, true);
  });

  let intro;
  if (!reducedMotion) {
    intro = gsap.timeline({ scrollTrigger: { trigger: list, start: 'top 80%', once: true } });
    intro.from(items, { y: 90, opacity: 0, duration: 1.2, stagger: 0.08, clearProps: 'transform,opacity' }, 0)
      .from(items.map((li) => li.querySelector('.sector__spine-label')), { yPercent: 30, opacity: 0, duration: 1, stagger: 0.08 }, 0.3);
  }

  return () => {
    clearTimeout(timer);
    intro?.kill();
    list.classList.remove('is-enhanced');
    items.forEach((li) => {
      li.removeEventListener('pointerenter', onEnter);
      li.removeEventListener('pointerleave', onLeave);
      li.removeEventListener('focusin', onFocus);
      li.removeEventListener('click', onClick, true);
    });
  };
}

/** Cartes empilées (mobile / tablette). */
function setupStack(root) {
  if (reducedMotion) return () => {};
  const tweens = [];
  root.querySelectorAll('.sector').forEach((li) => {
    const block = li.querySelector('.sector__block');
    const img = li.querySelector('.sector__img');
    tweens.push(gsap.from(block, {
      clipPath: 'inset(12% 6% 12% 6% round 28px)', y: 50, opacity: 0, duration: 1.2,
      scrollTrigger: { trigger: li, start: 'top 90%', once: true }, clearProps: 'clipPath,transform,opacity',
    }));
    if (img) {
      tweens.push(gsap.fromTo(img, { yPercent: -6, scale: 1.14 }, {
        yPercent: 6, scale: 1.14, ease: 'none',
        scrollTrigger: { trigger: li, start: 'top bottom', end: 'bottom top', scrub: true },
      }));
    }
  });
  return () => tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
}

export default function init(root) {
  buildRecos(root);
  wireAdd(root);
  renderState(root, false);
  window.addEventListener('quote:change', () => renderState(root));

  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 1024px)', narrow: '(max-width: 1023.98px)' }, (ctx) => {
    const cleanup = ctx.conditions.wide ? setupAccordion(root) : setupStack(root);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cleanup();
  });

  if (!reducedMotion) {
    const flake = root.querySelector('.sectors__flake');
    if (flake) gsap.fromTo(flake, { rotate: 0 }, { rotate: 120, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 } });
  }
}
