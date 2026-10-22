/**
 * Devis · étape 1 « Vos glaces » (agent quote-ui).
 * Une ligne par variante (sku) : prix revérifiés depuis config.js, stepper accessible (boutons + saisie libre,
 * appui long = répétition accélérée), montant de ligne animé, carte « givrée » quand elle est choisie.
 * Les variantes ajoutées plus tard dans config.js et absentes du HTML sont créées automatiquement.
 */
import { PRODUCTS, SKUS } from '../config.js';
import { fcfaShort } from '../core/format.js';
import * as store from '../core/quote-store.js';
import { tweenNumber, setNumber, jump, flyTo, pulse } from './ui-fx.js';

const nf = new Intl.NumberFormat('fr-FR');
const NBSP = ' ';

/** « / paquet », « / kg »… */
const perLabel = (v) => `/ ${v.unit}`;
/** Pastille sur la vignette : poids du conditionnement ou « 1 u. ». */
const tagLabel = (v) => (v.kg ? `${nf.format(v.kg)}${NBSP}kg` : `1${NBSP}u.`);
/** Article défini pour les libellés des boutons : « un paquet », « une barre »… */
const FEMININE = new Set(['barre']);
const one = (v) => (v.unit === 'kg' ? 'un kilo' : `${FEMININE.has(v.unit) ? 'une' : 'un'} ${v.unit}`);

function rowTemplate(v) {
  const p = v.product;
  const li = document.createElement('li');
  li.className = 'quote-item';
  li.dataset.sku = v.sku;
  const img = `${import.meta.env.BASE_URL}img/${p.img}-480.webp`;
  li.innerHTML = `
    <div class="quote-item__media"><img class="quote-item__img" src="${img}" alt="" width="480" height="600" loading="lazy" decoding="async"><span class="quote-item__tag" data-tag></span></div>
    <div class="quote-item__info">
      <h3 class="quote-item__name" id="q-name-${v.sku}" data-name></h3>
      <p class="quote-item__format" data-format></p>
      <p class="quote-item__price"><span data-price="${v.sku}"></span> <span class="quote-item__per" data-per></span></p>
    </div>
    <div class="quote-item__qty"><div class="stepper quote-stepper">
      <button type="button" data-step="-1" aria-controls="q-qty-${v.sku}"><svg class="icon" aria-hidden="true"><use href="#q-i-minus"/></svg></button>
      <input type="number" id="q-qty-${v.sku}" inputmode="numeric" min="0" max="99999" step="1" value="0" data-qty>
      <button type="button" data-step="1" aria-controls="q-qty-${v.sku}"><svg class="icon" aria-hidden="true"><use href="#q-i-plus"/></svg></button>
    </div></div>
    <p class="quote-item__total"><span class="sr-only">Montant : </span><span data-line-total></span></p>`;
  const [minus, plus] = li.querySelectorAll('[data-step]');
  minus.setAttribute('aria-label', `Retirer ${one(v)} – ${p.name}`);
  plus.setAttribute('aria-label', `Ajouter ${one(v)} – ${p.name}`);
  li.querySelector('[data-qty]').setAttribute('aria-label', `Quantité – ${p.name}, ${v.label}`);
  return li;
}

export function initItems(root, { getFlyTarget }) {
  const list = root.querySelector('[data-items]');
  const rows = new Map();

  // 1. Hydratation depuis config.js (source unique des prix et libellés).
  const wanted = PRODUCTS.flatMap((p) => p.variants.map((v) => SKUS[v.sku]));
  for (const li of list.querySelectorAll('.quote-item[data-sku]')) {
    const v = SKUS[li.dataset.sku];
    if (!v || !v.product.available) li.remove();
  }
  let prev = null;
  for (const v of wanted) {
    if (!v.product.available) continue;
    let li = list.querySelector(`.quote-item[data-sku="${v.sku}"]`);
    if (!li) {
      li = rowTemplate(v);
      if (prev) prev.after(li); else list.prepend(li);
    }
    prev = li;
    li.querySelector('[data-name]').textContent = v.product.name;
    li.querySelector('[data-format]').textContent = v.label.replace(/ (\d+) kg/, ` $1${NBSP}kg`);
    li.querySelector(`[data-price]`).textContent = fcfaShort(v.price);
    li.querySelector('[data-per]').textContent = perLabel(v);
    li.querySelector('[data-tag]').textContent = tagLabel(v);
    const input = li.querySelector('[data-qty]');
    const total = li.querySelector('[data-line-total]');
    setNumber(total, 0, fcfaShort);
    rows.set(v.sku, { li, v, input, total, minus: li.querySelector('[data-step="-1"]'), plus: li.querySelector('[data-step="1"]'), qty: 0 });
  }

  // 2. Changement de quantité (attribue le n° de devis au premier article).
  const change = (sku, qty, source) => {
    const before = store.computeTotals().count;
    store.setQty(sku, qty);
    if (before === 0 && store.computeTotals().count > 0) store.ensureNumber();
    if (source) {
      const row = rows.get(sku);
      const up = qty > row.qty;
      if (up && source === 'plus') {
        jump(row.plus);
        const target = getFlyTarget?.();
        if (target) flyTo(row.plus, target, { onArrive: () => pulse(target, 1.06) });
      }
    }
  };

  // Boutons +/- : clic, et appui long qui répète en accélérant.
  let hold = null;
  const stopHold = () => {
    if (!hold) return;
    clearTimeout(hold.t);
    hold = null;
  };
  const stepFrom = (btn, mode) => {
    const li = btn.closest('.quote-item');
    const r = rows.get(li?.dataset.sku);
    if (!r) return;
    const d = Number(btn.dataset.step);
    const cur = store.getState().lines[r.v.sku] || 0;
    if (d < 0 && cur === 0) return;
    change(r.v.sku, cur + d, d > 0 && mode !== 'repeat' ? 'plus' : mode === 'repeat' && d > 0 ? 'repeat' : null);
    if (mode === 'repeat' && d > 0 && Math.random() < 0.35) jump(btn, { count: 1 });
  };

  list.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn || e.button > 0) return;
    stopHold();
    const h = { btn, n: 0, repeated: false };
    const tick = () => {
      h.repeated = true;
      h.n++;
      stepFrom(btn, 'repeat');
      h.t = setTimeout(tick, Math.max(45, 140 - h.n * 8));
    };
    h.t = setTimeout(tick, 420);
    hold = h;
    btn.setPointerCapture?.(e.pointerId);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    list.addEventListener(ev, () => {
      if (hold?.repeated) hold.suppressClick = true;
      const h = hold;
      stopHold();
      if (h?.suppressClick) list._suppressClickUntil = performance.now() + 60;
    });
  }
  list.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-step]')) e.preventDefault(); });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    if (list._suppressClickUntil && performance.now() < list._suppressClickUntil) return;
    stepFrom(btn, 'click');
  });

  // Saisie libre.
  list.addEventListener('input', (e) => {
    const input = e.target.closest('[data-qty]');
    if (!input) return;
    const sku = input.closest('.quote-item').dataset.sku;
    const raw = input.value.trim();
    if (raw === '') return; // on attend la sortie du champ
    const n = Math.max(0, Math.min(99999, Math.floor(Number(raw)) || 0));
    change(sku, n);
  });
  list.addEventListener('focusin', (e) => { const i = e.target.closest('[data-qty]'); if (i) i.select?.(); });
  list.addEventListener('focusout', (e) => {
    const input = e.target.closest('[data-qty]');
    if (!input) return;
    const sku = input.closest('.quote-item').dataset.sku;
    const q = store.getState().lines[sku] || 0;
    if (input.value.trim() === '' || Number(input.value) !== q) input.value = String(q);
  });
  list.addEventListener('keydown', (e) => {
    const input = e.target.closest('[data-qty]');
    if (input && e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });

  // 3. Rendu.
  function render(s) {
    for (const r of rows.values()) {
      const q = s.lines[r.v.sku] || 0;
      const changed = q !== r.qty;
      r.qty = q;
      if (document.activeElement !== r.input || (r.input.value.trim() !== '' && Number(r.input.value) !== q)) {
        if (Number(r.input.value) !== q || r.input.value === '') r.input.value = String(q);
      }
      r.li.classList.toggle('is-selected', q > 0);
      r.minus.setAttribute('aria-disabled', q === 0 ? 'true' : 'false');
      if (changed) {
        tweenNumber(r.total, r.v.price * q, fcfaShort, { duration: 0.6 });
        if (q > 0) r.li.style.setProperty('--fill', Math.min(1, q / 20).toFixed(3));
      }
    }
  }

  function initial(s) {
    for (const r of rows.values()) {
      const q = s.lines[r.v.sku] || 0;
      r.qty = q;
      r.input.value = String(q);
      setNumber(r.total, r.v.price * q, fcfaShort);
      r.li.classList.toggle('is-selected', q > 0);
      r.minus.setAttribute('aria-disabled', q === 0 ? 'true' : 'false');
      r.li.style.setProperty('--fill', Math.min(1, q / 20).toFixed(3));
    }
  }

  return { rows, render, initial, list };
}
