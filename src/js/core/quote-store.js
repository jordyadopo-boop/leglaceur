/**
 * Panier du devis, partagé entre toutes les pages (localStorage).
 * Événement global : window 'quote:change' (detail = state).
 */
import { SKUS, DELIVERY, QUOTE } from '../config.js';

const empty = () => ({
  lines: {}, // { sku: qty }
  delivery: { mode: 'livraison', commune: '', address: '', date: '', slot: '' },
  // name* = personne qui commande, phone* = numéro WhatsApp du client, company/email facultatifs.
  client: { name: '', phone: '', email: '', company: '', type: 'particulier', note: '' },
  number: null,
  createdAt: null,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(QUOTE.storageKey);
    if (!raw) return empty();
    const s = { ...empty(), ...JSON.parse(raw) };
    // Ne garder que des références encore valides et commandables.
    s.lines = Object.fromEntries(
      Object.entries(s.lines || {}).filter(([sku, q]) => SKUS[sku]?.product.available && q > 0),
    );
    return s;
  } catch {
    return empty();
  }
}

function save() {
  try { localStorage.setItem(QUOTE.storageKey, JSON.stringify(state)); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new CustomEvent('quote:change', { detail: getState() }));
}

export const getState = () => structuredClone(state);

export function setQty(sku, qty) {
  if (!SKUS[sku] || !SKUS[sku].product.available) return;
  const q = Math.max(0, Math.min(99999, Math.round(Number(qty) || 0)));
  if (q === 0) delete state.lines[sku];
  else state.lines[sku] = q;
  save();
}

export const addQty = (sku, delta = 1) => setQty(sku, (state.lines[sku] || 0) + delta);

export function update(patch) {
  for (const [k, v] of Object.entries(patch)) {
    state[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...state[k], ...v } : v;
  }
  save();
}

export function reset() {
  state = empty();
  save();
}

export function ensureNumber() {
  if (!state.number) {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    state.number = `${QUOTE.prefix}-${ymd}-${rnd}`;
    state.createdAt = d.toISOString();
    save();
  }
  return state.number;
}

/** Lignes détaillées + totaux. deliveryFee = null si « sur devis ». */
export function computeTotals(s = state) {
  const lines = Object.entries(s.lines)
    .filter(([sku]) => SKUS[sku])
    .map(([sku, qty]) => {
      const v = SKUS[sku];
      return { sku, qty, name: v.product.name, label: v.label, unit: v.unit, units: v.units, price: v.price, kg: v.kg, total: v.price * qty };
    });
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const totalKg = lines.reduce((a, l) => a + (l.kg ? l.kg * l.qty : 0), 0);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  // Règle client : livraison offerte dès DELIVERY.freeFrom articles ; en dessous, devis hors frais de livraison
  // (tarif communiqué ensuite par Le Glaceur, jamais chiffré ici). Retrait sur place gratuit.
  const freeEligible = count >= DELIVERY.freeFrom;
  const remainingForFree = Math.max(0, DELIVERY.freeFrom - count);
  const delivering = s.delivery.mode === 'livraison';
  const freeDelivery = delivering && freeEligible;
  const excludesDelivery = delivering && !freeEligible;
  const deliveryFee = excludesDelivery ? null : 0; // null = hors frais de livraison
  const deliveryLabel = !delivering ? DELIVERY.pickup.label : freeDelivery ? 'Livraison offerte' : `Livraison · ${DELIVERY.paidLabel.toLowerCase()}`;
  const total = subtotal;
  return { lines, subtotal, totalKg, count, deliveryFee, deliveryLabel, freeDelivery, freeEligible, excludesDelivery, remainingForFree, total };
}

// Synchronisation entre onglets.
window.addEventListener('storage', (e) => {
  if (e.key === QUOTE.storageKey) {
    state = load();
    window.dispatchEvent(new CustomEvent('quote:change', { detail: getState() }));
  }
});

/**
 * Données figées d'un devis, pour les documents (PDF, Excel, WhatsApp).
 * Voir docs/ARCHITECTURE.md § Devis.
 */
export function toQuoteData(s = state) {
  const t = computeTotals(s);
  const created = s.createdAt ? new Date(s.createdAt) : new Date();
  const valid = new Date(created.getTime() + QUOTE.validityDays * 86400000);
  return {
    number: s.number || ensureNumber(),
    date: created.toISOString(),
    validUntil: valid.toISOString(),
    client: { ...s.client },
    delivery: {
      mode: s.delivery.mode, // 'livraison' | 'retrait'
      commune: s.delivery.mode === 'livraison' ? s.delivery.commune : null,
      label: t.deliveryLabel,
      fee: t.deliveryFee, // 0 (offerte / retrait) ou null (hors frais de livraison)
      free: t.freeDelivery, // livraison offerte (≥ DELIVERY.freeFrom articles)
      excludesDelivery: t.excludesDelivery, // devis hors frais de livraison
      freeFrom: DELIVERY.freeFrom,
      address: s.delivery.address,
      date: s.delivery.date,
      slot: s.delivery.slot,
    },
    lines: t.lines,
    subtotal: t.subtotal,
    deliveryFee: t.deliveryFee,
    total: t.total,
    totalKg: t.totalKg,
    count: t.count,
  };
}
