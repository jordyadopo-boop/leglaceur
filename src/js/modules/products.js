/**
 * Vitrine des produits + catalogue (agent products).
 * - Textes et prix revérifiés contre config.js (PRODUCTS, SKUS, DELIVERY) ; produits ajoutés/retirés/réordonnés au besoin.
 * - « Ajouter au devis » → quote-store (addQty), glaçon qui vole jusqu'au badge [data-quote-badge], toast, sélecteur de quantité libre.
 * - Jauge « Livraison offerte dès N articles » reliée au quote-store (quote:change).
 * - Grand écran : scène épinglée, rail horizontal scrubé (numéros qui gèlent, parallaxe interne, vitres qui pivotent).
 *   Sinon : carrousel tactile scroll-snap (flèches, repères, barre de progression).
 * - Catalogue : <details> natifs animés (ouverture / fermeture), ouverture depuis « Fiche détaillée » ou l'ancre.
 * Tout reste lisible sans JS ; les animations partent d'un état visible (gsap.from) et sont coupées en mouvement réduit.
 */
import { PRODUCTS, SKUS, DELIVERY } from '../config.js';
import { gsap, ScrollTrigger, reducedMotion, getLenis } from '../core/motion.js';
import { getState, addQty, setQty, computeTotals } from '../core/quote-store.js';
import { toast } from '../core/toast.js';

const fxModules = import.meta.glob('./fx-*.js');
const HAS_SHATTER = './fx-shatter.js' in fxModules;

/* ---------- Typographie & formats (identiques au générateur du HTML statique) ---------- */
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const NBSP = ' ';
const NNBSP = ' ';
const money = (n) => `${nf.format(Math.round(n || 0))}${NBSP}F`;
const pad = (i) => String(i + 1).padStart(2, '0');
const typo = (s) => String(s ?? '')
  .replace(/'/g, '’')
  .replace(/(^|\s)-(\d)/g, '$1−$2')
  .replace(/(\d) (kg|°C|%|F\b)/g, `$1${NBSP}$2`)
  .replace(/ ([;:!?»])/g, `${NNBSP}$1`)
  .replace(/« /g, `«${NNBSP}`);
const FEM = new Set(['barre']);
/** « le pack de 5 kg », « la barre de 10 kg », « le kilo », « l’Ice Cup ». */
export function perLabel(v) {
  const l = String(v.label).trim();
  if (/^(le|la)\s/i.test(l)) return l[0].toLowerCase() + l.slice(1);
  const one = l.match(/^1\s+(.*)$/);
  if (one) return /^[aeiouyh]/i.test(one[1]) ? `l’${one[1]}` : `${FEM.has(v.unit) ? 'la' : 'le'} ${one[1]}`;
  return `${FEM.has(v.unit) ? 'la' : 'le'} ${l[0].toLowerCase()}${l.slice(1)}`;
}
const unitWord = (v, q) => (q > 1 ? v.units : v.unit);
const articles = (n) => `${n}${NBSP}article${n > 1 ? 's' : ''}`;
const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

export default function init(root) {
  const track = root.querySelector('[data-track]');
  const catalogue = root.querySelector('[data-catalogue]');
  syncProducts(root, track, catalogue);
  syncTicks(root);
  watchImages(root);

  const ui = wireQuote(root);
  ui.render(false);
  window.addEventListener('quote:change', () => ui.render(true));

  wireFormats(root, ui);
  wireCatalogue(root);
  setupLayout(root);
  if (!reducedMotion) entrance(root);
}

/* ==========================================================================
   1. Synchronisation avec config.js
   ========================================================================== */
function fillProduct(el, p, i) {
  el.style.setProperty('--i', i);
  el.querySelectorAll('[data-f]').forEach((node) => {
    const f = node.dataset.f;
    if (f === 'uses') return syncList(node, p.uses || []);
    if (p[f] == null) return;
    setText(node, typo(p[f]));
  });
  el.querySelectorAll('[data-num] > span, .cat__num').forEach((n) => setText(n, pad(i)));
  const avail = el.querySelector('[data-avail]');
  if (avail) {
    setText(avail, p.available ? 'Disponible' : 'Bientôt disponible');
    avail.classList.toggle('is-soon', !p.available);
  }
  const isNew = p.isNew ?? p.id === 'grain';
  el.querySelector('[data-new]')?.toggleAttribute('hidden', !isNew);
  el.querySelectorAll('[data-add]').forEach((b) => {
    b.disabled = !p.available;
    if (!p.available) setText(b.querySelector('span'), 'Bientôt disponible');
  });
}

function syncList(ul, items) {
  const cur = [...ul.children].map((li) => li.textContent);
  const want = items.map(typo);
  if (cur.length === want.length && cur.every((t, k) => t === want[k])) return;
  ul.replaceChildren(...want.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
}

/** Remplace l'identité d'un produit modèle par celle d'un nouveau produit (clonage). */
function cloneFor(tpl, from, p) {
  const fromP = PRODUCTS.find((x) => x.id === from) || { variants: [], img: from };
  let html = tpl.outerHTML;
  fromP.variants.forEach((v, k) => { html = html.replaceAll(`"${v.sku}"`, `"${(p.variants[k] || p.variants[0]).sku}"`); });
  html = html.replaceAll(`img/${fromP.img}-`, `img/${p.img}-`).replaceAll(`-${from}`, `-${p.id}`).replaceAll(`"${from}"`, `"${p.id}"`);
  const box = document.createElement('div');
  box.innerHTML = html;
  const el = box.firstElementChild;
  el.querySelector('[data-new]')?.remove();
  el.querySelector('[data-formats]')?.remove();
  el.querySelectorAll('[data-module]').forEach((n) => n.removeAttribute('data-module'));
  // Catalogue : une ligne par variante.
  const list = el.querySelector('.cat__variants');
  if (list && list.firstElementChild) {
    const row = list.firstElementChild;
    list.replaceChildren(...p.variants.map((v) => {
      const r = row.cloneNode(true);
      r.querySelectorAll('[data-sku],[data-price],[data-per]').forEach((n) => {
        for (const a of ['data-sku', 'data-price', 'data-per']) if (n.hasAttribute(a)) n.setAttribute(a, v.sku);
      });
      setText(r.querySelector('.cat__vname'), typo(v.label));
      return r;
    }));
  }
  return el;
}

function syncContainer(container, ids) {
  if (!container) return;
  const byId = new Map([...container.children].map((c) => [c.dataset.product, c]));
  const tpl = container.firstElementChild;
  PRODUCTS.forEach((p, i) => {
    let el = byId.get(p.id);
    if (!el && tpl) el = cloneFor(tpl, tpl.dataset.product, p);
    if (!el) return;
    fillProduct(el, p, i);
    container.append(el); // remet dans l'ordre de config.js
  });
  [...container.children].forEach((c) => { if (!ids.has(c.dataset.product)) c.remove(); });
}

function syncProducts(root, track, catalogue) {
  const ids = new Set(PRODUCTS.map((p) => p.id));
  syncContainer(track, ids);
  syncContainer(catalogue, ids);
  // Prix et libellés d'unité, partout dans la section.
  root.querySelectorAll('[data-price]').forEach((el) => {
    const v = SKUS[el.dataset.price];
    if (v) setText(el, money(v.price));
  });
  root.querySelectorAll('[data-per]').forEach((el) => {
    const v = SKUS[el.dataset.per];
    if (v) setText(el, perLabel(v));
  });
  root.querySelectorAll('[data-unit]').forEach((el) => {
    const v = SKUS[el.closest('[data-cta]')?.dataset.sku];
    if (v) setText(el, v.units);
  });
  root.querySelectorAll('[data-free-label]').forEach((el) => setText(el, typo(DELIVERY.freeLabel)));
}

function syncTicks(root) {
  const list = root.querySelector('.products__ticks');
  if (!list) return;
  const want = PRODUCTS.map((p) => p.id);
  const cur = [...list.querySelectorAll('[data-tick]')].map((a) => a.getAttribute('href').replace('#produit-', ''));
  if (cur.length === want.length && cur.every((id, k) => id === want[k])) return;
  const tpl = list.firstElementChild;
  list.replaceChildren(...PRODUCTS.map((p, i) => {
    const li = tpl.cloneNode(true);
    const a = li.querySelector('a');
    a.href = `#produit-${p.id}`;
    a.dataset.tick = String(i);
    setText(a.querySelector('.products__tick-num'), pad(i));
    setText(a.querySelector('.sr-only'), p.name);
    return li;
  }));
}

/** Créneau d'image absent (ex. « grain » pas encore livré) : texture de glace CSS à la place d'une image cassée. */
function watchImages(root) {
  root.querySelectorAll('[data-media] img').forEach((img) => {
    const media = img.closest('[data-media]');
    const fail = () => media.classList.add('is-missing');
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) fail();
    else img.addEventListener('error', fail, { once: true });
  });
}

/* ==========================================================================
   2. Devis : boutons, quantités, jauge
   ========================================================================== */
function wireQuote(root) {
  let prevCount = computeTotals().count;

  function renderCta(cta, lines, animate) {
    const sku = cta.dataset.sku;
    const v = SKUS[sku];
    if (!v) return;
    const q = lines[sku] || 0;
    const add = cta.querySelector('[data-add]');
    const box = cta.querySelector('[data-qty]');
    const input = cta.querySelector('[data-qty-input]');
    const has = q > 0;
    if (input && document.activeElement !== input) input.value = String(q);
    setText(cta.querySelector('[data-unit]'), unitWord(v, Math.max(q, 2)));
    if (!add || !box || box.hidden === !has) return;
    const show = has ? box : add;
    const hide = has ? add : box;
    const hadFocus = hide.contains(document.activeElement);
    hide.hidden = true;
    show.hidden = false;
    if (hadFocus) (has ? box.querySelector('[data-step="1"]') : add)?.focus({ preventScroll: true });
    if (animate && !reducedMotion) gsap.from(show, { scale: 0.86, opacity: 0, filter: 'blur(6px)', duration: 0.55, ease: 'back.out(2)', clearProps: 'filter,scale,opacity' });
  }

  function render(animate) {
    const s = getState();
    const t = computeTotals(s);
    root.querySelectorAll('[data-cta]').forEach((cta) => renderCta(cta, s.lines, animate));

    // « Dans votre devis : … » par produit
    root.querySelectorAll('[data-inquote]').forEach((el) => {
      const p = PRODUCTS.find((x) => x.id === el.dataset.inquote);
      if (!p) return;
      const parts = p.variants.filter((v) => s.lines[v.sku] > 0).map((v) => {
        const q = s.lines[v.sku];
        return p.variants.length > 1 ? `${q}${NBSP}×${NBSP}${v.label.toLowerCase()}` : `${q}${NBSP}${unitWord(v, q)}`;
      });
      const sum = p.variants.reduce((a, v) => a + (s.lines[v.sku] || 0) * v.price, 0);
      el.hidden = parts.length === 0;
      if (parts.length) setText(el, `Dans votre devis${NNBSP}: ${parts.join(', ')} · ${money(sum)}`);
    });

    // Jauges « Livraison offerte »
    const N = DELIVERY.freeFrom;
    const free = t.count >= N;
    root.querySelectorAll('[data-gauge]').forEach((g) => {
      const r = t.remainingForFree;
      setText(g.querySelector('[data-gauge-title]'), free ? `Livraison offerte${NNBSP}!` : typo(DELIVERY.freeLabel));
      const status = free
        ? `${articles(t.count)} dans votre devis`
        : r === 1 ? `Plus qu’un article pour l’obtenir` : `Plus que ${r}${NBSP}articles`;
      setText(g.querySelector('[data-gauge-status]'), status);
      g.style.setProperty('--g', Math.min(1, t.count / N).toFixed(3));
      g.classList.toggle('is-free', free);
      const bar = g.querySelector('[data-gauge-bar]');
      if (bar) {
        bar.setAttribute('aria-valuenow', String(Math.min(t.count, N)));
        bar.setAttribute('aria-valuetext', free ? 'Livraison offerte' : `${articles(t.count)} sur ${N}, plus que ${r}`);
      }
    });
    if (animate && free && prevCount < N) celebrate(root);
    prevCount = t.count;

    root.querySelectorAll('[data-pq-count]').forEach((el) => {
      const n = el.firstChild;
      if (n && n.nodeType === 3) n.nodeValue = String(t.count);
      const sr = el.querySelector('.sr-only');
      if (sr) sr.textContent = ` article${t.count > 1 ? 's' : ''} dans le devis`;
    });
    const sumEl = root.querySelector('[data-outro-sum]');
    if (sumEl) {
      setText(sumEl, t.count
        ? `${articles(t.count)} · ${money(t.subtotal)}${t.freeEligible ? ' · livraison offerte' : ''}`
        : `Votre devis est encore vide${NNBSP}: ajoutez vos articles.`);
    }
  }

  // Clics (délégués) : ajout, +/−
  root.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const step = e.target.closest('[data-step]');
    const cta = (add || step)?.closest('[data-cta]');
    if (!cta) return;
    const sku = cta.dataset.sku;
    const v = SKUS[sku];
    if (!v || !v.product.available) return;
    if (add) {
      addQty(sku, 1);
      flyToQuote(add, 1);
      if (!HAS_SHATTER) burst(add);
      toast(`Ajouté à votre devis${NNBSP}: ${v.product.name}, ${perLabel(v)}`);
    } else {
      const d = Number(step.dataset.step) || 0;
      addQty(sku, d);
      if (d > 0) flyToQuote(step, 0.6);
    }
  });
  // Saisie libre de la quantité
  root.addEventListener('change', (e) => {
    const input = e.target.closest('[data-qty-input]');
    if (!input) return;
    const sku = input.closest('[data-cta]')?.dataset.sku;
    setQty(sku, input.value);
    if (!(Number(input.value) > 0)) input.closest('[data-cta]')?.querySelector('[data-add]')?.focus();
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-qty-input]')) { e.preventDefault(); e.target.blur(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  return { render };
}

/** Sélecteur de format (barres 5 kg / 10 kg) : change la variante pilotée par la dalle. */
function wireFormats(root, ui) {
  root.querySelectorAll('[data-formats]').forEach((fs) => {
    const card = fs.closest('.slab');
    fs.addEventListener('change', (e) => {
      const sku = e.target.value;
      const v = SKUS[sku];
      if (!v) return;
      const cta = card.querySelector('[data-cta]');
      cta.dataset.sku = sku;
      const what = `${v.product.name}, ${perLabel(v)}`;
      cta.querySelector('[data-add]')?.setAttribute('aria-label', `Ajouter au devis${NNBSP}: ${what}`);
      cta.querySelector('[data-step="-1"]')?.setAttribute('aria-label', `Retirer 1${NNBSP}: ${what}`);
      cta.querySelector('[data-step="1"]')?.setAttribute('aria-label', `Ajouter 1${NNBSP}: ${what}`);
      cta.querySelector('[data-qty-input]')?.setAttribute('aria-label', `Quantité dans le devis${NNBSP}: ${what}`);
      const amount = card.querySelector('[data-main-price]');
      const per = card.querySelector('[data-main-per]');
      amount.dataset.price = sku;
      per.dataset.per = sku;
      setText(amount, money(v.price));
      setText(per, perLabel(v));
      ui.render(false);
      if (!reducedMotion) {
        gsap.fromTo(amount, { rotationX: -80, opacity: 0.2, filter: 'blur(4px)' }, { rotationX: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'back.out(1.8)', clearProps: 'filter' });
      }
    });
  });
}

/* ==========================================================================
   3. Effets : glaçon volant, éclats, célébration
   ========================================================================== */
function quoteTarget() {
  const badge = document.querySelector('[data-quote-badge]');
  const link = document.querySelector('[data-header-quote]') || badge?.closest('a');
  const ok = (r) => r && r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight;
  const rb = badge?.getBoundingClientRect();
  if (ok(rb)) return { x: rb.left + rb.width / 2, y: rb.top + rb.height / 2 };
  const rl = link?.getBoundingClientRect();
  if (ok(rl)) return { x: rl.right - 6, y: rl.top + 6 };
  const burger = document.querySelector('.site-header__burger:not([hidden])')?.getBoundingClientRect();
  if (ok(burger)) return { x: burger.left + burger.width / 2, y: burger.top + burger.height / 2 };
  return { x: innerWidth - 40, y: 36 };
}

function flyToQuote(from, scale = 1) {
  if (reducedMotion || document.hidden) return;
  const r = from.getBoundingClientRect();
  const sx = r.left + r.width / 2;
  const sy = r.top + r.height / 2;
  const { x: ex, y: ey } = quoteTarget();
  const cx = sx + (ex - sx) * 0.45 - Math.min(180, Math.abs(ex - sx) * 0.25);
  const cy = Math.min(sy, ey) - Math.max(120, Math.abs(sy - ey) * 0.25);
  const bez = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const make = (cls) => {
    const d = document.createElement('div');
    d.className = cls;
    d.setAttribute('aria-hidden', 'true');
    document.body.append(d);
    return d;
  };
  const pieces = [make('pq-fly'), ...Array.from({ length: Math.round(4 * scale) }, () => make('pq-fly pq-fly--crumb'))];
  pieces.forEach((el, k) => {
    const lead = k === 0;
    const o = { t: 0 };
    const spin = (lead ? 540 : 300) * (Math.random() > 0.5 ? 1 : -1);
    gsap.set(el, { xPercent: -50, yPercent: -50, x: sx, y: sy, scale: lead ? 0 : 0.2, opacity: lead ? 1 : 0.9 });
    const tl = gsap.timeline({ delay: lead ? 0 : 0.05 + k * 0.045, onComplete: () => el.remove() });
    if (lead) tl.to(el, { scale: 1.15 * scale, duration: 0.18, ease: 'back.out(3)' });
    tl.to(o, {
      t: 1, duration: lead ? 0.85 : 0.8, ease: 'power2.inOut',
      onUpdate: () => {
        const t = o.t;
        gsap.set(el, {
          x: bez(t, sx, cx, ex), y: bez(t, sy, cy, ey), rotation: spin * t,
          scale: (lead ? 1.15 * scale : 0.9) * (1 - t * 0.6),
        });
      },
    }, lead ? '<0.06' : 0);
    tl.to(el, { opacity: 0, scale: 0.1, duration: 0.18, ease: 'power1.in' });
    if (lead) tl.add(() => ring(ex, ey), '<');
  });
}

function ring(x, y) {
  const el = document.createElement('div');
  el.className = 'pq-ring';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  gsap.fromTo(el, { x, y, xPercent: -50, yPercent: -50, scale: 0.2, opacity: 1 }, { scale: 1.9, opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => el.remove() });
}

/** Petite explosion de cristaux (repli si fx-shatter n'est pas disponible). */
function burst(host, n = 10) {
  if (reducedMotion) return;
  const pos = getComputedStyle(host).position;
  if (pos === 'static') host.style.position = 'relative';
  for (let k = 0; k < n; k++) {
    const s = document.createElement('span');
    s.className = 'pq-spark';
    s.setAttribute('aria-hidden', 'true');
    host.append(s);
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
    const d = 30 + Math.random() * 40;
    gsap.fromTo(s, { x: 0, y: 0, rotation: 45, scale: 1, opacity: 1 },
      { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7, rotation: 45 + (Math.random() - 0.5) * 240, scale: 0.2, opacity: 0, duration: 0.7 + Math.random() * 0.3, ease: 'power3.out', onComplete: () => s.remove() });
  }
}

function celebrate(root) {
  root.querySelectorAll('[data-gauge]').forEach((g) => {
    const bar = g.querySelector('[data-gauge-bar]');
    if (!reducedMotion && bar) {
      gsap.fromTo(bar, { scaleY: 1 }, { scaleY: 1.8, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
      const icon = g.querySelector('.pq-gauge__icon');
      if (icon) burst(icon, 12);
    }
  });
  toast(`Livraison offerte${NNBSP}! Votre commande atteint ${DELIVERY.freeFrom}${NBSP}articles.`);
}

/* ==========================================================================
   4. Catalogue : <details> animés
   ========================================================================== */
function wireCatalogue(root) {
  const items = [...root.querySelectorAll('.cat')];
  let refreshTimer;
  const refreshSoon = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 120); };

  const open = (d, animate = true) => {
    if (d.open) return;
    d.open = true;
    const panel = d.querySelector('[data-panel]');
    if (animate && !reducedMotion && panel) {
      gsap.fromTo(panel, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.7, ease: 'ice', clearProps: 'height,opacity', onComplete: refreshSoon });
      gsap.from(panel.querySelectorAll('.cat__desc, .cat__block, .cat__fact, .cat__safety, .cat__order'), { y: 24, opacity: 0, filter: 'blur(6px)', duration: 0.8, stagger: 0.06, delay: 0.08, ease: 'ice', clearProps: 'filter' });
    } else refreshSoon();
  };
  const close = (d) => {
    const panel = d.querySelector('[data-panel]');
    if (reducedMotion || !panel) { d.open = false; refreshSoon(); return; }
    gsap.to(panel, { height: 0, opacity: 0, duration: 0.45, ease: 'power2.inOut', onComplete: () => { d.open = false; gsap.set(panel, { clearProps: 'height,opacity' }); refreshSoon(); } });
  };

  items.forEach((d) => {
    d.querySelector('summary')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) close(d); else open(d);
    });
  });

  // « Fiche détaillée » : ouvre la fiche avant que le défilement fluide ne l'atteigne.
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-open-cat]');
    if (!a) return;
    const d = root.querySelector(`#catalogue-${a.dataset.openCat}`);
    if (d) open(d, false);
  }, true);

  const fromHash = () => {
    const d = location.hash.startsWith('#catalogue-') ? root.querySelector(location.hash) : null;
    if (d?.classList.contains('cat')) open(d, false);
  };
  fromHash();
  window.addEventListener('hashchange', fromHash);
}

/* ==========================================================================
   5. Mise en scène : épinglage horizontal (grand écran) ou carrousel
   ========================================================================== */
function setupLayout(root) {
  const mm = gsap.matchMedia();
  mm.add({
    pin: '(min-width: 1024px) and (min-height: 640px)',
    reduce: '(prefers-reduced-motion: reduce)',
  }, (ctx) => {
    const { pin, reduce } = ctx.conditions;
    return pin && !reduce ? setupPinned(root) : setupCarousel(root);
  });
}

function hud(root) {
  const slabs = [...root.querySelectorAll('.slab')];
  const ticks = [...root.querySelectorAll('[data-tick]')];
  const fill = root.querySelector('[data-bar-fill]');
  const num = root.querySelector('[data-now-num]');
  const name = root.querySelector('[data-now-name]');
  let current = -1;
  return {
    slabs,
    ticks,
    progress(p) { fill?.style.setProperty('--p', Math.max(0.02, Math.min(1, p)).toFixed(4)); },
    active(i) {
      if (i === current || i < 0) return;
      const dir = i > current ? 1 : -1;
      current = i;
      ticks.forEach((t, k) => t.setAttribute('aria-current', k === i ? 'true' : 'false'));
      const p = PRODUCTS[i];
      if (!p) return;
      setText(num, pad(i));
      setText(name, p.name);
      if (!reducedMotion && num && name) gsap.fromTo([num, name], { yPercent: 80 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'ice' });
    },
  };
}

function setupPinned(root) {
  root.classList.add('is-pinned');
  const stage = root.querySelector('[data-stage]');
  const rail = root.querySelector('[data-rail]');
  const h = hud(root);
  const lenis = getLenis();
  const dist = () => Math.max(0, rail.scrollWidth - stage.clientWidth);
  let points = [];

  const computePoints = () => {
    const d = dist() || 1;
    const railLeft = rail.getBoundingClientRect().left - (gsap.getProperty(rail, 'x') || 0);
    points = h.slabs.map((s) => {
      const r = s.getBoundingClientRect();
      const center = r.left - railLeft + r.width / 2;
      return gsap.utils.clamp(0, 1, (center - stage.clientWidth / 2) / d);
    });
  };

  const tween = gsap.to(rail, { x: () => -dist(), ease: 'none' });
  const shards = [...root.querySelectorAll('.products__shard')];
  const mark = root.querySelector('[data-watermark]');
  const st = ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${dist()}`,
    pin: true,
    scrub: 0.9,
    animation: tween,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onRefresh: computePoints,
    onUpdate(self) {
      const p = tween.progress();
      h.progress(p);
      let best = 0;
      points.forEach((q, k) => { if (Math.abs(q - p) < Math.abs(points[best] - p)) best = k; });
      h.active(best);
      shards.forEach((s) => gsap.set(s, { x: -p * innerWidth * Number(s.dataset.depth || 0.3), rotation: p * 40 * Number(s.dataset.depth || 0.3) }));
      if (mark) gsap.set(mark, { xPercent: -p * 38 });
      void self;
    },
  });
  computePoints();
  h.active(0);
  h.progress(0);

  // Dalles : numéro qui gèle, parallaxe de l'image, contenu qui arrive, vitre qui pivote.
  const anims = [];
  h.slabs.forEach((slab) => {
    const base = { trigger: slab, containerAnimation: tween };
    const num = slab.querySelector('[data-num]');
    const img = slab.querySelector('.slab__img');
    const body = slab.querySelectorAll('.slab__kicker, .slab__name, .slab__tagline, .slab__offer, .slab__desc, .slab__uses, .slab__howto, .slab__actions');
    if (num) anims.push(gsap.fromTo(num, { '--freeze': 0, yPercent: 18 }, { '--freeze': 1, yPercent: 0, ease: 'none', scrollTrigger: { ...base, start: 'left 92%', end: 'left 30%', scrub: true } }));
    if (img) anims.push(gsap.fromTo(img, { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { ...base, start: 'left right', end: 'right left', scrub: true } }));
    anims.push(gsap.from(body, { x: 90, opacity: 0, stagger: 0.08, ease: 'none', scrollTrigger: { ...base, start: 'left 96%', end: 'left 40%', scrub: true } }));
    anims.push(gsap.fromTo(slab, { rotationY: -16, z: -80, transformOrigin: '0% 50%' }, { rotationY: 0, z: 0, ease: 'none', scrollTrigger: { ...base, start: 'left right', end: 'center 55%', scrub: true } }));
  });
  const intro = root.querySelector('[data-intro]');
  if (intro) anims.push(gsap.fromTo(intro, { opacity: 1 }, { opacity: 0.2, ease: 'none', scrollTrigger: { trigger: intro, containerAnimation: tween, start: 'right 60%', end: 'right 0%', scrub: true } }));

  // Repères 01–06 : saut vers la dalle (défilement fluide).
  const goTo = (i, immediate = false) => {
    const y = st.start + (st.end - st.start) * (points[i] ?? 0) + 1;
    if (lenis) lenis.scrollTo(y, immediate ? { immediate: true } : { duration: 1.3 });
    else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
  };
  const onTick = (e) => {
    const a = e.target.closest('[data-tick]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    goTo(Number(a.dataset.tick));
  };
  // Navigation au clavier : amener à l'écran la dalle qui reçoit le focus.
  const onFocus = (e) => {
    const slab = e.target.closest('.slab');
    if (!slab) return;
    const r = slab.getBoundingClientRect();
    if (r.left < 0 || r.right > innerWidth) goTo(h.slabs.indexOf(slab), true);
  };
  root.addEventListener('click', onTick, true);
  root.addEventListener('focusin', onFocus);

  return () => {
    root.removeEventListener('click', onTick, true);
    root.removeEventListener('focusin', onFocus);
    anims.forEach((a) => { a.scrollTrigger?.kill(); a.revert?.(); });
    st.kill();
    tween.revert();
    gsap.set([rail, ...shards, mark].filter(Boolean), { clearProps: 'transform' });
    root.classList.remove('is-pinned');
  };
}

function setupCarousel(root) {
  root.classList.add('is-carousel');
  const vp = root.querySelector('[data-viewport]');
  const h = hud(root);
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  [prev, next].forEach((b) => { if (b) b.hidden = false; });
  vp.setAttribute('tabindex', '0');
  vp.setAttribute('role', 'region');
  vp.setAttribute('aria-label', 'Carrousel des produits : faites glisser horizontalement');

  const padL = () => parseFloat(getComputedStyle(root.querySelector('[data-track]')).paddingLeft) || 0;
  const indexNow = () => {
    const x = vp.scrollLeft + padL() + 4;
    let best = 0;
    h.slabs.forEach((s, k) => { if (Math.abs(s.offsetLeft - x) < Math.abs(h.slabs[best].offsetLeft - x)) best = k; });
    return best;
  };
  let raf = 0;
  const update = () => {
    raf = 0;
    const max = vp.scrollWidth - vp.clientWidth;
    const p = max > 0 ? vp.scrollLeft / max : 0;
    h.progress((indexNow() + 1) / h.slabs.length * 0.35 + p * 0.65);
    h.active(indexNow());
    prev?.setAttribute('aria-disabled', String(vp.scrollLeft < 4));
    next?.setAttribute('aria-disabled', String(vp.scrollLeft > max - 4));
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  const goTo = (i) => {
    const s = h.slabs[Math.max(0, Math.min(h.slabs.length - 1, i))];
    if (s) vp.scrollTo({ left: s.offsetLeft - padL(), behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  const onPrev = () => goTo(indexNow() - 1);
  const onNext = () => goTo(indexNow() + 1);
  const onTick = (e) => {
    const a = e.target.closest('[data-tick]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    goTo(Number(a.dataset.tick));
    // Amener aussi la scène à l'écran (petit écran : le carrousel peut être partiellement visible).
    const r = vp.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) (getLenis()?.scrollTo(vp, { offset: -100 }) ?? vp.scrollIntoView({ block: 'center' }));
  };
  vp.addEventListener('scroll', onScroll, { passive: true });
  prev?.addEventListener('click', onPrev);
  next?.addEventListener('click', onNext);
  root.addEventListener('click', onTick, true);
  update();

  // Numéros qui gèlent quand la dalle entre dans le carrousel.
  let io;
  if (!reducedMotion) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const num = en.target.querySelector('[data-num]');
        if (num) gsap.fromTo(num, { '--freeze': 0, yPercent: 20 }, { '--freeze': 1, yPercent: 0, duration: 1.6, ease: 'power2.out', delay: 0.15 });
      });
    }, { root: null, threshold: 0.55 });
    h.slabs.forEach((s) => io.observe(s));
  }

  return () => {
    vp.removeEventListener('scroll', onScroll);
    prev?.removeEventListener('click', onPrev);
    next?.removeEventListener('click', onNext);
    root.removeEventListener('click', onTick, true);
    io?.disconnect();
    [prev, next].forEach((b) => { if (b) b.hidden = true; });
    vp.removeAttribute('tabindex');
    vp.removeAttribute('role');
    vp.removeAttribute('aria-label');
    root.classList.remove('is-carousel');
  };
}

/* ==========================================================================
   6. Entrées (depuis un état visible)
   ========================================================================== */
function entrance(root) {
  const intro = root.querySelector('[data-intro]');
  const titleParts = intro?.querySelectorAll('.products__title-a, .products__title-b');
  if (intro) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: intro, start: 'top 85%', once: true } });
    tl.from(intro.querySelector('.eyebrow'), { y: 20, opacity: 0, duration: 0.7 })
      .from(titleParts, { yPercent: 60, opacity: 0, filter: 'blur(10px)', duration: 1.1, stagger: 0.12, clearProps: 'filter' }, '<0.1')
      .from(intro.querySelectorAll('.products__lead, .products__perk, .products__hint'), { y: 24, opacity: 0, duration: 0.8, stagger: 0.07 }, '<0.35');
  }
  if (!root.classList.contains('is-pinned')) {
    const vp = root.querySelector('[data-viewport]');
    gsap.from(root.querySelectorAll('.slab'), {
      x: 80, opacity: 0, rotationY: -12, duration: 1.2, stagger: 0.1, ease: 'ice', clearProps: 'transform,opacity',
      scrollTrigger: { trigger: vp, start: 'top 85%', once: true },
    });
  }
  const list = root.querySelector('[data-catalogue]');
  if (list) {
    gsap.from(list.children, {
      y: 50, opacity: 0, filter: 'blur(8px)', duration: 1, stagger: 0.08, ease: 'ice', clearProps: 'filter,transform,opacity',
      scrollTrigger: { trigger: list, start: 'top 88%', once: true },
    });
    const head = root.querySelector('.catalogue__head');
    if (head) gsap.from(head.querySelectorAll('.eyebrow, .catalogue__title, .catalogue__lead, .catalogue__aside > *'), { y: 30, opacity: 0, duration: 0.9, stagger: 0.08, scrollTrigger: { trigger: head, start: 'top 85%', once: true } });
  }
}
