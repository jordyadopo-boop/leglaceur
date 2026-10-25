/**
 * Espace administrateur (/admin) : registre des devis sur une période choisie.
 * - Les devis sont lus dans le Google Sheet du registre (BRAND.quoteWebhook, script docs/apps-script/registre-devis.gs),
 *   avec le code administrateur saisi ici (gardé pour la session de l'onglet seulement).
 * - Récapitulatif (devis, articles, montant), tableau dépliable (+) et totaux par produit.
 * - Export Excel de la période : feuilles « Devis », « Lignes » et « Par produit ».
 */
import { BRAND } from '../config.js';
import { money, num, formatPhone, formatQuoteDate, formatDay, formatSlot } from '../quote/message.js';

const KEY = 'leglaceur:admin';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shortDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return `${day}<span class="admin-time"> ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>`;
};
const deliveryShort = (q) => (q.delivery?.mode === 'retrait' ? 'Retrait' : q.delivery?.free ? 'Offerte' : 'Hors frais');

export default function init(root) {
  const $ = (s) => document.querySelector(s);
  const login = $('[data-admin-login]');
  const app = $('[data-admin-app]');
  const err = $('[data-admin-error]');
  const status = $('[data-admin-status]');
  const result = $('[data-admin-result]');
  const logout = $('[data-admin-logout]');
  const period = $('[data-admin-period]');
  let code = '';
  let current = { du: '', au: '', devis: [] };
  try { code = sessionStorage.getItem(KEY) || ''; } catch { /* stockage indisponible */ }

  if (!BRAND.quoteWebhook) {
    showError('Le registre n’est pas encore branché : suivez docs/DEPLOIEMENT.md § « Espace administrateur ».');
    login.querySelector('form').querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
    return;
  }

  async function fetchDevis(du, au) {
    const url = new URL(BRAND.quoteWebhook);
    url.search = new URLSearchParams({ code, du, au }).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function showError(msg) { err.textContent = msg; err.hidden = !msg; }

  function open() {
    login.hidden = true;
    app.hidden = false;
    logout.hidden = false;
  }

  login.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    code = e.target.code.value.trim();
    showError('');
    btn.disabled = true;
    try {
      const r = await fetchDevis(ymd(new Date()), ymd(new Date()));
      if (!r.ok) { showError('Code incorrect.'); return; }
      try { sessionStorage.setItem(KEY, code); } catch { /* ignoré */ }
      open();
      preset('month');
      load();
    } catch {
      showError('Registre injoignable. Vérifiez la connexion et réessayez.');
    } finally {
      btn.disabled = false;
    }
  });

  logout.addEventListener('click', () => {
    try { sessionStorage.removeItem(KEY); } catch { /* ignoré */ }
    location.reload();
  });

  /* ---------- Période ---------- */
  function preset(p) {
    const now = new Date();
    let a = new Date(now);
    let b = new Date(now);
    if (p === '7') a.setDate(now.getDate() - 6);
    if (p === 'month') a = new Date(now.getFullYear(), now.getMonth(), 1);
    if (p === 'lastmonth') { a = new Date(now.getFullYear(), now.getMonth() - 1, 1); b = new Date(now.getFullYear(), now.getMonth(), 0); }
    if (p === 'year') a = new Date(now.getFullYear(), 0, 1);
    period.du.value = ymd(a);
    period.au.value = ymd(b);
    period.querySelectorAll('[data-preset]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.preset === p)));
  }
  period.querySelectorAll('[data-preset]').forEach((c) => c.addEventListener('click', () => { preset(c.dataset.preset); load(); }));
  period.addEventListener('input', () => period.querySelectorAll('[data-preset]').forEach((c) => c.setAttribute('aria-pressed', 'false')));
  period.addEventListener('submit', (e) => { e.preventDefault(); load(); });

  async function load() {
    const du = period.du.value;
    const au = period.au.value;
    if (!du || !au) return;
    if (du > au) { status.textContent = 'La date de début doit précéder la date de fin.'; return; }
    status.textContent = 'Chargement…';
    try {
      const r = await fetchDevis(du, au);
      if (!r.ok) { try { sessionStorage.removeItem(KEY); } catch { /* ignoré */ } location.reload(); return; }
      current = { du, au, devis: r.devis || [] };
      render();
    } catch {
      status.textContent = 'Registre injoignable. Réessayez dans un instant.';
    }
  }

  /* ---------- Affichage ---------- */
  function byProduct(devis) {
    const map = new Map();
    for (const q of devis) {
      for (const l of q.lines || []) {
        const k = l.sku || `${l.name}|${l.label}`;
        const p = map.get(k) || { name: l.name, label: l.label, unit: l.unit, qty: 0, total: 0 };
        p.qty += l.qty;
        p.total += l.total;
        map.set(k, p);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  function render() {
    const { devis, du, au } = current;
    const total = devis.reduce((a, q) => a + (q.total || 0), 0);
    const count = devis.reduce((a, q) => a + (q.count || 0), 0);
    const range = du === au ? formatDay(du) : `du ${formatDay(du)} au ${formatDay(au)}`;
    status.textContent = devis.length ? `${devis.length} devis ${range}.` : `Aucun devis ${range}.`;
    result.hidden = !devis.length;
    if (!devis.length) return;

    const kpis = [
      ['Devis', num(devis.length)],
      ['Articles', num(count)],
      ['Montant total', money(total)],
      ['Panier moyen', money(Math.round(total / devis.length))],
      ['Livraisons offertes', num(devis.filter((q) => q.delivery?.mode !== 'retrait' && q.delivery?.free).length)],
      ['Retraits sur place', num(devis.filter((q) => q.delivery?.mode === 'retrait').length)],
    ];
    $('[data-admin-kpis]').innerHTML = kpis.map(([k, v]) => `<div class="admin-kpi frost"><span>${k}</span><strong>${v}</strong></div>`).join('');

    $('[data-admin-rows]').innerHTML = devis.map((q, i) => `
      <tr class="admin-row">
        <td><button class="admin-plus" type="button" aria-expanded="false" aria-controls="admin-d${i}" data-i="${i}"><span class="sr-only">Voir le détail du devis ${esc(q.number)}</span></button></td>
        <td>${shortDate(q.date)}</td>
        <td class="mono">${esc(q.number)}</td>
        <td>${esc(q.client?.name)}${q.client?.company ? `<br><small>${esc(q.client.company)}</small>` : ''}</td>
        <td>${esc(deliveryShort(q))}${q.delivery?.commune ? `<br><small>${esc(q.delivery.commune)}</small>` : ''}</td>
        <td class="num">${num(q.count || 0)}</td>
        <td class="num"><strong>${money(q.total || 0)}</strong></td>
      </tr>
      <tr class="admin-detail" id="admin-d${i}" hidden><td colspan="7">${detail(q, i)}</td></tr>`).join('');

    $('[data-admin-products]').innerHTML = byProduct(devis).map((p) => `
      <tr><td>${esc(p.name)}</td><td>${esc(p.label)}</td><td class="num">${num(p.qty)}${p.unit === 'kg' ? ' kg' : ''}</td><td class="num">${money(p.total)}</td></tr>`).join('');
  }

  function detail(q, i) {
    const c = q.client || {};
    const d = q.delivery || {};
    const lines = (q.lines || []).map((l) => `<tr><td>${esc(l.name)} <small>${esc(l.label)}</small></td><td class="num">${num(l.qty)}${l.unit === 'kg' ? ' kg' : ''}</td><td class="num">${money(l.price)}</td><td class="num">${money(l.total)}</td></tr>`).join('');
    const info = [
      ['N° devis', q.number],
      ['Client', c.name],
      ['WhatsApp', c.phone && formatPhone(c.phone)],
      ['Structure', c.company],
      ['E-mail', c.email],
      ['Articles', num(q.count || 0)],
      ['Livraison', d.label],
      ['Adresse', [d.commune, d.address].filter(Boolean).join(' · ')],
      ['Date souhaitée', [d.date && formatDay(d.date), d.slot && formatSlot(d.slot)].filter(Boolean).join(' · ')],
      ['Devis du', formatQuoteDate(q.date)],
    ].filter(([, v]) => v);
    const wa = c.phone ? String(c.phone).replace(/\D/g, '') : '';
    return `
      <div class="admin-detail__in">
        <dl class="admin-dl">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <table class="admin-table admin-table--lines">
          <thead><tr><th scope="col">Produit</th><th scope="col" class="num">Qté</th><th scope="col" class="num">Prix unitaire</th><th scope="col" class="num">Montant</th></tr></thead>
          <tbody>${lines}</tbody>
          <tfoot><tr><th scope="row" colspan="3">Total${d.excludesDelivery ? ' (hors frais de livraison)' : ''}</th><td class="num"><strong>${money(q.total || 0)}</strong></td></tr></tfoot>
        </table>
        <div class="admin-detail__actions">
          <button class="btn btn--sm" type="button" data-pdf="${i}"><span data-label>PDF du devis</span></button>
          ${wa ? `<a class="btn btn--wa btn--sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">Écrire au client</a>` : ''}
        </div>
      </div>`;
  }

  root.addEventListener('click', async (e) => {
    const plus = e.target.closest('.admin-plus');
    if (plus) {
      const row = document.getElementById(plus.getAttribute('aria-controls'));
      const opened = plus.getAttribute('aria-expanded') !== 'true';
      plus.setAttribute('aria-expanded', String(opened));
      row.hidden = !opened;
      return;
    }
    const pdf = e.target.closest('[data-pdf]');
    if (pdf) {
      const q = current.devis[Number(pdf.dataset.pdf)];
      pdf.disabled = true;
      try {
        const docs = await import('../quote/documents.js');
        docs.downloadBlob(await docs.createPdf(q), docs.quoteFileName(q, 'pdf'));
      } finally { pdf.disabled = false; }
    }
  });

  $('[data-admin-export]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const { buildRegisterXlsx } = await import('../quote/register-xlsx.js');
      const blob = await buildRegisterXlsx(current, byProduct(current.devis));
      const docs = await import('../quote/documents.js');
      docs.downloadBlob(blob, `Registre-devis-Le-Glaceur-${current.du}-au-${current.au}.xlsx`);
    } finally { btn.disabled = false; }
  });

  if (code) {
    open();
    preset('month');
    load();
  }
}
