/**
 * Devis · étape 2 « Livraison ou retrait » (agent quote-ui).
 * Contrôle segmenté (radios natifs), commune / adresse, date (min = aujourd'hui), créneau ;
 * message dynamique « Livraison offerte » / « hors frais de livraison » (aucun tarif affiché) ;
 * retrait : adresse, horaires, itinéraire, carte Google chargée seulement au clic.
 */
import { BRAND, DELIVERY, mapsUrl, mapsEmbedUrl } from '../config.js';
import { gsap, reducedMotion } from '../core/motion.js';
import * as store from '../core/quote-store.js';
import { reveal } from './ui-fx.js';

const NBSP = ' ';
export const DEFAULT_SLOT = 'Dès que possible';

/** Date locale AAAA-MM-JJ (et non UTC). */
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function initDelivery(root) {
  const group = root.querySelector('[data-mode-group]');
  const radios = [...group.querySelectorAll('input[name="mode"]')];
  const panelsWrap = root.querySelector('[data-panels]');
  const panels = Object.fromEntries([...root.querySelectorAll('[data-panel]')].map((p) => [p.dataset.panel, p]));
  const commune = root.querySelector('[data-commune]');
  const address = root.querySelector('[data-address]');
  const date = root.querySelector('[data-date]');
  const dateLabel = root.querySelector('[data-date-label]');
  const slots = [...root.querySelectorAll('[data-slots] input[name="slot"]')];
  const note = root.querySelector('[data-delivery-note]');
  const noteTitle = root.querySelector('[data-delivery-note-title]');
  const noteText = root.querySelector('[data-delivery-note-text]');
  const segSub = root.querySelector('[data-seg-sub]');

  // Données de config (source unique).
  const current = commune.value;
  commune.innerHTML = '';
  commune.append(new Option('Choisissez votre commune', ''));
  for (const c of DELIVERY.communes) commune.append(new Option(c, c));
  commune.value = current;
  segSub.textContent = DELIVERY.freeLabel.replace(/^Livraison o/, 'O').replace(/ (\d+) articles/, ` $1${NBSP}articles`);
  root.querySelector('[data-pickup-street]').textContent = BRAND.address.street;
  root.querySelector('[data-pickup-city]').textContent = `${BRAND.address.city}, ${BRAND.address.country}`;
  root.querySelector('[data-pickup-hours]').textContent = BRAND.hours;
  root.querySelector('[data-maps-link]').href = mapsUrl;

  const setMin = () => { date.min = todayISO(); };
  setMin();
  date.addEventListener('focus', setMin);

  // Saisies → panier.
  let mode = store.getState().delivery.mode;
  group.addEventListener('change', (e) => {
    if (e.target.name !== 'mode') return;
    store.update({ delivery: { mode: e.target.value } });
  });
  commune.addEventListener('change', () => store.update({ delivery: { commune: commune.value } }));
  let tAddr;
  address.addEventListener('input', () => {
    clearTimeout(tAddr);
    tAddr = setTimeout(() => store.update({ delivery: { address: address.value.trim() } }), 250);
  });
  address.addEventListener('change', () => { clearTimeout(tAddr); store.update({ delivery: { address: address.value.trim() } }); });
  date.addEventListener('change', () => {
    let v = date.value;
    if (v && v < todayISO()) { v = todayISO(); date.value = v; }
    store.update({ delivery: { date: v } });
  });
  root.querySelector('[data-slots]').addEventListener('change', (e) => {
    if (e.target.name === 'slot') store.update({ delivery: { slot: e.target.value } });
  });

  // Carte Google, chargée au clic seulement (respect de la vie privée et des performances).
  const map = root.querySelector('[data-map]');
  map.querySelector('[data-map-load]').addEventListener('click', () => {
    if (map.classList.contains('is-loaded')) return;
    const frame = document.createElement('iframe');
    frame.className = 'quote-pickup__iframe';
    frame.src = mapsEmbedUrl;
    frame.loading = 'lazy';
    frame.title = `Carte : ${BRAND.name}, ${BRAND.address.street}, ${BRAND.address.city}`;
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.allowFullscreen = true;
    frame.addEventListener('load', () => map.classList.add('is-ready'), { once: true });
    map.append(frame);
    map.classList.add('is-loaded');
    frame.focus?.();
  });

  function showPanel(next, animate) {
    const prevH = panelsWrap.offsetHeight;
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== next;
    group.dataset.mode = next;
    dateLabel.textContent = next === 'retrait' ? 'Date de retrait souhaitée' : 'Date de livraison souhaitée';
    if (!animate || reducedMotion) return;
    const nextH = panelsWrap.offsetHeight;
    gsap.fromTo(panelsWrap, { height: prevH }, { height: nextH, duration: 0.55, ease: 'ice', clearProps: 'height' });
    reveal(panels[next], { y: 18, duration: 0.7 });
  }

  let lastFree = null;
  function render(s, t, { initial = false } = {}) {
    const d = s.delivery;
    if (d.mode !== mode || initial) {
      const animate = !initial && d.mode !== mode;
      mode = d.mode;
      for (const r of radios) r.checked = r.value === mode;
      showPanel(mode, animate);
    }
    if (document.activeElement !== commune && commune.value !== (d.commune || '')) commune.value = d.commune || '';
    if (document.activeElement !== address && address.value.trim() !== (d.address || '')) address.value = d.address || '';
    if (document.activeElement !== date && date.value !== (d.date || '')) date.value = d.date || '';
    const slot = d.slot || DEFAULT_SLOT;
    for (const r of slots) r.checked = r.value === slot;

    // Message livraison (aucun prix affiché).
    const free = t.freeEligible;
    if (free !== lastFree) {
      note.classList.toggle('is-free', free);
      noteTitle.textContent = free ? `Livraison offerte${NBSP}!` : DELIVERY.paidLabel;
      noteText.textContent = free
        ? `Dès ${DELIVERY.freeFrom}${NBSP}articles, Le Glaceur vous livre gratuitement partout à ${BRAND.address.city}.`
        : DELIVERY.paidNote.replace(/ : /g, `${NBSP}: `);
      if (!initial && lastFree !== null) reveal(note, { y: 0, scale: 0.98, duration: 0.5 });
      lastFree = free;
    }
  }

  return { render };
}
