/**
 * Devis · récapitulatif (agent quote-ui) : n° de devis, lignes (entrée / sortie animées), sous-total,
 * livraison (« Offerte » / « Hors frais de livraison » / « Retrait — gratuit »), TOTAL qui « gèle »,
 * nombre d'articles, poids ; mini-jauge ; barre basse mobile ; annonce aria-live (différée).
 */
import { DELIVERY, SKUS } from '../config.js';

const ORDER = Object.keys(SKUS);
import { fcfa, fcfaShort } from '../core/format.js';
import { gsap, reducedMotion } from '../core/motion.js';
import { tweenNumber, setNumber, freeze, pulse } from './ui-fx.js';
import { freeText } from './ui-gauge.js';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const NBSP = ' ';
const plural = (n, one, many) => `${nf.format(n)}${NBSP}${n > 1 ? many : one}`;

export function initSummary(root) {
  const $ = (s) => root.querySelector(s);
  const el = {
    number: $('[data-number]'),
    empty: $('[data-empty]'),
    lines: $('[data-lines]'),
    subtotal: $('[data-subtotal]'),
    delivery: $('[data-delivery]'),
    deliveryRow: $('[data-delivery-row]'),
    deliveryLabel: $('[data-delivery-label]'),
    totalLabel: $('[data-total-label]'),
    total: $('[data-total]'),
    count: $('[data-count]'),
    weight: $('[data-weight]'),
    feeNote: $('[data-fee-note]'),
    mini: $('[data-mini]'),
    miniFill: $('[data-mini-fill]'),
    miniText: $('[data-mini-text]'),
    live: $('[data-live]'),
    mbLabel: $('[data-mb-label]'),
    mbCount: $('[data-mb-count]'),
    mbTotal: $('[data-mb-total]'),
    mbFill: $('[data-mb-fill]'),
    sheet: $('.quote-summary__sheet'),
  };
  let prevSig = '';
  let prevDeliv = '';
  let liveTimer;

  const lineNodes = new Map();

  function lineNode(l) {
    const li = document.createElement('li');
    li.className = 'quote-summary__line';
    li.dataset.sku = l.sku;
    li.innerHTML = `<span class="quote-summary__qty" data-q></span><span class="quote-summary__name"><span data-n></span><small data-f></small></span><span class="quote-summary__amount" data-a></span>`;
    return li;
  }

  function renderLines(rawLines, initial) {
    const lines = [...rawLines].sort((a, b) => ORDER.indexOf(a.sku) - ORDER.indexOf(b.sku));
    const keep = new Set(lines.map((l) => l.sku));
    // Sorties
    for (const [sku, node] of lineNodes) {
      if (keep.has(sku)) continue;
      lineNodes.delete(sku);
      if (initial || reducedMotion) { node.remove(); continue; }
      node.classList.add('is-leaving');
      gsap.to(node, {
        height: 0, opacity: 0, x: 24, paddingTop: 0, paddingBottom: 0, marginTop: 0, filter: 'blur(4px)',
        duration: 0.45, ease: 'power2.inOut', onComplete: () => node.remove(),
      });
    }
    // Entrées et mises à jour, dans l'ordre du catalogue
    let prev = null;
    for (const l of lines) {
      let node = lineNodes.get(l.sku);
      const fresh = !node;
      if (fresh) {
        node = lineNode(l);
        lineNodes.set(l.sku, node);
      }
      const anchor = prev ? prev.nextSibling : el.lines.firstChild;
      if (node !== anchor) el.lines.insertBefore(node, anchor);
      prev = node;
      node.querySelector('[data-n]').textContent = l.name;
      node.querySelector('[data-f]').textContent = `${l.label} · ${fcfaShort(l.price)}${NBSP}/${NBSP}${l.unit}`;
      const q = node.querySelector('[data-q]');
      const qText = `${nf.format(l.qty)}${NBSP}×`;
      const qChanged = q.textContent !== qText;
      q.textContent = qText;
      const a = node.querySelector('[data-a]');
      if (fresh) setNumber(a, l.total, fcfaShort);
      else tweenNumber(a, l.total, fcfaShort, { duration: 0.5 });
      if (fresh && !initial && !reducedMotion) {
        gsap.from(node, { height: 0, opacity: 0, x: -18, filter: 'blur(6px)', duration: 0.55, ease: 'ice', clearProps: 'all' });
      } else if (!fresh && qChanged && !initial) {
        pulse(q, 1.2);
      }
    }
  }

  function deliveryView(s, t) {
    if (s.delivery.mode === 'retrait') return { label: 'Retrait sur place', value: `Retrait${NBSP}— gratuit`, cls: 'is-pickup' };
    if (t.freeDelivery) return { label: 'Livraison', value: 'Offerte', cls: 'is-free' };
    return { label: 'Livraison', value: DELIVERY.paidLabel, cls: 'is-excluded' };
  }

  function render(s, t, { initial = false } = {}) {
    const empty = t.lines.length === 0;
    el.empty.hidden = !empty;
    el.number.textContent = s.number || 'attribué au premier article';
    el.number.classList.toggle('is-pending', !s.number);
    renderLines(t.lines, initial);

    // Livraison
    const dv = deliveryView(s, t);
    el.deliveryLabel.textContent = dv.label;
    el.delivery.textContent = dv.value;
    el.deliveryRow.classList.remove('is-pickup', 'is-free', 'is-excluded');
    el.deliveryRow.classList.add(dv.cls);
    if (!initial && dv.cls !== prevDeliv && prevDeliv) {
      freeze(el.deliveryRow);
      if (dv.cls === 'is-free') pulse(el.delivery, 1.15);
    }
    prevDeliv = dv.cls;
    el.feeNote.hidden = !t.excludesDelivery || empty;

    // Total
    el.totalLabel.textContent = t.excludesDelivery ? 'Total (hors frais de livraison)' : 'Total';
    const sig = `${t.subtotal}|${t.count}`;
    if (initial) {
      setNumber(el.subtotal, t.subtotal, fcfaShort);
      setNumber(el.total, t.total, fcfa);
      setNumber(el.mbTotal, t.total, fcfaShort);
    } else if (sig !== prevSig) {
      tweenNumber(el.subtotal, t.subtotal, fcfaShort, { duration: 0.6 });
      tweenNumber(el.total, t.total, fcfa, { duration: 0.85, freezeOnEnd: true });
      tweenNumber(el.mbTotal, t.total, fcfaShort, { duration: 0.6, freezeOnEnd: true });
    }
    el.count.textContent = plural(t.count, 'article', 'articles');
    const hasCups = t.lines.some((l) => !l.kg);
    el.weight.textContent = t.totalKg > 0
      ? `${nf.format(t.totalKg)}${NBSP}kg${hasCups ? ' (hors Ice Cups)' : ''}`
      : hasCups ? 'Ice Cups à l’unité' : `0${NBSP}kg`;
    el.sheet.classList.toggle('is-empty', empty);

    // Mini-jauge (récapitulatif + barre basse)
    const p = Math.min(1, t.count / DELIVERY.freeFrom);
    el.mini.classList.toggle('is-free', t.freeEligible);
    el.mini.hidden = s.delivery.mode === 'retrait';
    el.miniText.textContent = freeText(t.count);
    if (reducedMotion || initial) {
      el.miniFill.style.transform = `scaleX(${p})`;
      el.mbFill.style.transform = `scaleX(${p})`;
    } else {
      gsap.to([el.miniFill, el.mbFill], { scaleX: p, duration: 0.7, ease: 'ice', overwrite: 'auto' });
    }
    el.mbLabel.textContent = t.excludesDelivery ? 'Total hors livraison' : 'Total';
    el.mbCount.textContent = plural(t.count, 'article', 'articles');

    // Annonce aux lecteurs d'écran (différée pour ne pas bavarder pendant un appui long).
    if (!initial && sig !== prevSig) {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        const free = s.delivery.mode === 'livraison' ? ` ${freeText(t.count)}.` : '';
        el.live.textContent = `${plural(t.count, 'article', 'articles')}, total ${fcfa(t.total)}${t.excludesDelivery ? ' hors frais de livraison' : ''}.${free}`;
      }, 900);
    }
    prevSig = sig;
  }

  return { render, totalEl: el.total, mbTotalEl: el.mbTotal };
}
