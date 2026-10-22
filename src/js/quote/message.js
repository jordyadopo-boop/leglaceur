/**
 * Le Glaceur — textes du devis (message WhatsApp + libellés partagés par le PDF et l'Excel).
 *
 * Module léger, chargé avec la page : aucune dépendance lourde ici.
 * Les espaces insécables sont des U+00A0 (jamais U+202F : jsPDF, Excel et WhatsApp l'affichent mal).
 */
import { BRAND, DELIVERY, QUOTE, SKUS } from '../config.js';
import { plainNumber, dateFr } from '../core/format.js';
import { waLink } from '../core/whatsapp.js';

export const NBSP = ' ';

/** « 3 000 FCFA » avec espaces insécables (le montant ne se coupe jamais en fin de ligne). */
export const money = (n) => `${plainNumber(n).replace(/ /g, NBSP)}${NBSP}${QUOTE.currency}`;

/** « 1 250 » avec espaces insécables. */
export const num = (n) => plainNumber(n).replace(/ /g, NBSP);

/** Remplace les espaces fines (U+202F, U+2009…) par des insécables classiques. */
export const cleanSpaces = (s) => String(s ?? '').replace(/[    ]/g, NBSP);

const trim = (s) => cleanSpaces(s).trim();

const capitalize = (s) => (s ? s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1) : s);

/** Numéro ivoirien lisible : « +225 07 89 85 16 86 » (sinon la saisie telle quelle). */
export function formatPhone(raw) {
  const s = trim(raw);
  if (!s) return '';
  let d = s.replace(/[^\d]/g, '');
  if (d.startsWith('00225')) d = d.slice(5);
  else if (d.startsWith('225') && d.length === 13) d = d.slice(3);
  if (d.length === 10) return `+225 ${d.replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  return s;
}

/** Date ISO « 2026-10-25 » → « samedi 25 octobre 2026 » (sinon la saisie telle quelle). */
export function formatDay(value) {
  const s = trim(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return s;
  return cleanSpaces(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
}

/** Date d'un devis (ISO complet) → « 22 octobre 2026 ». */
export function formatQuoteDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  return cleanSpaces(dateFr(Number.isNaN(d.getTime()) ? new Date() : d));
}

/** Créneau : valeur libre ou identifiant (« apres-midi ») → « Après-midi ». */
export function formatSlot(value) {
  const s = trim(value);
  if (!s) return '';
  if (/^[a-z0-9-]+$/.test(s)) {
    const known = { matin: 'Matin', midi: 'Midi', 'apres-midi': 'Après-midi', 'fin-apres-midi': 'Fin d’après-midi', soir: 'Soir', nuit: 'Nuit', journee: 'Toute la journée', 'peu-importe': 'Peu importe' };
    return known[s] || capitalize(s.replace(/-/g, ' '));
  }
  return capitalize(s);
}

/** Libellé de format pour le tableau (« Paquet de 5 kg », « Gobelet », « Le kilo »). */
export function formatCell(line) {
  const label = trim(line.label);
  return capitalize(label.replace(/^1\s+/, ''));
}

/** Quantité pour le tableau : « 4 » ou « 3 kg ». */
export const qtyCell = (line) => (line.unit === 'kg' ? `${num(line.qty)}${NBSP}kg` : num(line.qty));

/** Nom secondaire du produit (« Glace cubique »), lu dans le catalogue. */
export const productAlias = (line) => trim(SKUS[line.sku]?.product?.alias || '');

/** « 4 × Glaçons alimentaires (paquet de 5 kg) — 3 000 FCFA » */
export function messageLine(line) {
  const name = trim(line.name);
  const qty = line.unit === 'kg' ? `${num(line.qty)}${NBSP}kg` : num(line.qty);
  let fmt = trim(line.label).replace(/^1\s+/, '');
  if (line.unit === 'kg' || !fmt || name.toLowerCase().includes(fmt.toLowerCase())) fmt = '';
  else fmt = fmt.charAt(0).toLowerCase() + fmt.slice(1);
  return `${qty}${NBSP}×${NBSP}${name}${fmt ? ` (${fmt})` : ''} — ${money(line.total)}`;
}

/* ---------------------------------------------------------------------------
   Transport (règle client : offerte dès DELIVERY.freeFrom articles, sinon hors frais ; retrait gratuit)
   --------------------------------------------------------------------------- */
export const isPickup = (q) => q?.delivery?.mode === 'retrait';
export const freeFrom = (q) => q?.delivery?.freeFrom ?? DELIVERY.freeFrom;
export const isFree = (q) => !isPickup(q) && (q?.delivery?.free ?? (q?.count || 0) >= freeFrom(q));
export const excludesDelivery = (q) => !isPickup(q) && (q?.delivery?.excludesDelivery ?? !isFree(q));

/** Valeur de la ligne « Transport » du PDF. */
export function transportText(q) {
  if (isPickup(q)) return `${DELIVERY.pickup.label} — gratuit`;
  if (isFree(q)) return `Offerte (${freeFrom(q)} articles et plus)`;
  return `${DELIVERY.paidLabel} — tarif communiqué par ${BRAND.name}`;
}

/** « TOTAL » ou « TOTAL (hors frais de livraison) ». */
export const totalLabel = (q) => (excludesDelivery(q) ? `TOTAL (${DELIVERY.paidLabel.toLowerCase()})` : 'TOTAL');

/** Nombre d'articles manquants pour la livraison offerte (0 si atteint ou retrait). */
export const remainingForFree = (q) => (isPickup(q) ? 0 : Math.max(0, freeFrom(q) - (q?.count || 0)));

/* ---------------------------------------------------------------------------
   Blocs « Client » et « Livraison / Retrait » (ordre imposé par le client)
   --------------------------------------------------------------------------- */
/** [[libellé, valeur]] : Nom, Structure (si renseignée), WhatsApp, E-mail (si renseigné). */
export function clientRows(q) {
  const c = q?.client || {};
  const rows = [['Nom', trim(c.name) || '—']];
  if (trim(c.company)) rows.push(['Structure', trim(c.company)]);
  rows.push(['WhatsApp', formatPhone(c.phone) || '—']);
  if (trim(c.email)) rows.push(['E-mail', trim(c.email)]);
  return rows;
}

/** [[libellé, valeur]] du bloc livraison ou retrait. */
export function deliveryRows(q) {
  const d = q?.delivery || {};
  const rows = [];
  if (isPickup(q)) {
    rows.push(['Lieu', `${BRAND.address.street}, ${BRAND.address.city}`]);
    rows.push(['Horaires', BRAND.hours]);
  } else {
    rows.push(['Commune', trim(d.commune) || 'À préciser']);
    rows.push(['Adresse', trim(d.address) || 'À préciser']);
  }
  rows.push(['Date', formatDay(d.date) ? capitalize(formatDay(d.date)) : 'À convenir']);
  rows.push(['Créneau', formatSlot(d.slot) || 'À convenir']);
  return rows;
}

/* ---------------------------------------------------------------------------
   Message WhatsApp
   --------------------------------------------------------------------------- */
const p = (label) => `${label}${NBSP}:`;

/** Texte du message WhatsApp prérempli (clair, structuré, prêt à envoyer). */
export function whatsappMessage(q = {}) {
  const lines = Array.isArray(q.lines) ? q.lines.filter((l) => l && l.qty > 0) : [];
  const c = q.client || {};
  const d = q.delivery || {};
  const out = [];

  out.push(`Bonjour ${BRAND.name},`, '');
  const ref = q.number ? ` *n°${NBSP}${q.number}*` : '';
  if (lines.length) {
    out.push(`Je souhaite passer commande. Voici mon devis${ref} du ${formatQuoteDate(q.date)}${NBSP}:`, '');
    out.push('*Ma commande*');
    for (const l of lines) out.push(`• ${messageLine(l)}`);
    out.push('');
    out.push(`${p('Sous-total')} ${money(q.subtotal)}`);
    if (isPickup(q)) out.push(`${p('Transport')} retrait sur place, gratuit`);
    else if (isFree(q)) out.push(`${p('Livraison')} offerte (${freeFrom(q)} articles et plus)`);
    else out.push(`${p('Livraison')} hors frais de livraison (tarif à me communiquer)`);
    out.push(`*${p(totalLabel(q))} ${money(q.total)}*`);
    const meta = [`${p('Articles')} ${num(q.count || 0)}`];
    if (q.totalKg > 0) meta.push(`${p('poids indicatif')} ${num(q.totalKg)}${NBSP}kg`);
    out.push(meta.join(' · '));
  } else {
    out.push(`Je souhaite obtenir un devis${ref}.`);
  }

  out.push('');
  if (isPickup(q)) {
    out.push('*Retrait sur place*');
    out.push(`${BRAND.address.street}, ${BRAND.address.city} (${BRAND.hours})`);
  } else {
    out.push('*Livraison*');
    if (trim(d.commune)) out.push(`${p('Commune')} ${trim(d.commune)}`);
    if (trim(d.address)) out.push(`${p('Adresse')} ${trim(d.address)}`);
  }
  if (formatDay(d.date)) out.push(`${p('Date souhaitée')} ${formatDay(d.date)}`);
  if (formatSlot(d.slot)) out.push(`${p('Créneau')} ${formatSlot(d.slot)}`);
  if (!isPickup(q) && !trim(d.commune) && !trim(d.address) && !formatDay(d.date) && !formatSlot(d.slot)) {
    out.push('Adresse et date à préciser ensemble.');
  }

  out.push('', '*Mes coordonnées*');
  out.push(`${p('Nom')} ${trim(c.name) || '—'}`);
  if (trim(c.company)) out.push(`${p('Structure')} ${trim(c.company)}`);
  out.push(`${p('WhatsApp')} ${formatPhone(c.phone) || '—'}`);
  if (trim(c.email)) out.push(`${p('E-mail')} ${trim(c.email)}`);

  if (trim(c.note)) out.push('', `${p('Note')} ${trim(c.note)}`);

  out.push('', lines.length ? 'Je joins mon devis PDF.' : 'Merci de me recontacter.', 'Merci !');
  return out.join('\n');
}

/** Message court (QR code, lien de l'Excel) : tient dans un QR code lisible. */
export function shortWhatsappMessage(q = {}, attachment = 'PDF') {
  const name = trim(q.client?.name);
  const total = q.lines?.length ? ` (${totalLabel(q).toLowerCase()}${NBSP}: ${money(q.total)})` : '';
  return `Bonjour ${BRAND.name}, je vous envoie mon devis${q.number ? ` n°${NBSP}${q.number}` : ''}${total}.${name ? ` ${name}.` : ''} Je joins le fichier ${attachment}.`;
}

/** Lien wa.me sûr pour un PDF/Excel (parenthèses et apostrophes encodées aussi). */
export const whatsappUrl = (text) =>
  waLink(text).replace(/[()'!*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);

/** 'Devis-Le-Glaceur-GLC-261022-AB12.pdf' */
export function quoteFileName(q = {}, ext = 'pdf') {
  const ref = String(q.number || '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
  const e = String(ext || 'pdf').replace(/^\./, '');
  return `Devis-Le-Glaceur${ref ? `-${ref}` : ''}.${e}`;
}
