/**
 * Panier du devis, partagé entre toutes les pages (localStorage).
 * Événement global : window 'quote:change' (detail = state).
 */
import { SKUS, DELIVERY, QUOTE } from '../config.js';

const empty = () => ({
  lines: {}, // { sku: qty }
  delivery: { mode: 'livraison', zone: 'z1', address: '', date: '', slot: '' },
  client: { name: '', phone: '', email: '', company: '', type: 'particulier', note: '' },
  guests: null,
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
  let deliveryFee = 0;
  let deliveryLabel = DELIVERY.pickup.label;
  if (s.delivery.mode === 'livraison') {
    const z = DELIVERY.zones.find((z) => z.id === s.delivery.zone) || DELIVERY.zones[0];
    deliveryFee = z.price; // null → sur devis
    deliveryLabel = `Livraison · ${z.name}`;
  }
  const total = subtotal + (deliveryFee || 0);
  return { lines, subtotal, totalKg, count, deliveryFee, deliveryLabel, total };
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
  const zone = DELIVERY.zones.find((z) => z.id === s.delivery.zone) || DELIVERY.zones[0];
  return {
    number: s.number || ensureNumber(),
    date: created.toISOString(),
    validUntil: valid.toISOString(),
    client: { ...s.client },
    delivery: {
      mode: s.delivery.mode, // 'livraison' | 'retrait'
      zoneId: s.delivery.mode === 'livraison' ? zone.id : null,
      zoneName: s.delivery.mode === 'livraison' ? zone.name : null,
      label: t.deliveryLabel,
      fee: t.deliveryFee, // null = sur devis
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
    guests: s.guests,
  };
}
