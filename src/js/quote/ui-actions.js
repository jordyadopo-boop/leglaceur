/**
 * Devis · actions (agent quote-ui) : Envoyer sur WhatsApp, Partager le PDF (mobile, Web Share niveau 2),
 * Télécharger le PDF, Télécharger Excel, Recommencer (confirmation dans la page).
 * Les documents viennent de src/js/quote/documents.js (agent quote-docs), chargé à la demande :
 *   createPdf(q) → Blob · createXlsx(q) → Blob · whatsappMessage(q) → string · quoteFileName(q, ext) → string
 * Validation avant export : ≥ 1 article, nom, WhatsApp (et e-mail s'il est rempli).
 * Webhook facultatif (BRAND.quoteWebhook) : POST no-cors, sans bloquer, une fois par version du devis.
 */
import { BRAND, DELIVERY, QUOTE } from '../config.js';
import { fcfaPlain, plainNumber } from '../core/format.js';
import { waLink } from '../core/whatsapp.js';
import { toast } from '../core/toast.js';
import { gsap, reducedMotion, getLenis, DrawSVGPlugin } from '../core/motion.js';
import * as store from '../core/quote-store.js';
import { burst, shake, reveal } from './ui-fx.js';
import { DEFAULT_SLOT } from './ui-delivery.js';

// import.meta.glob : le build ne casse pas si documents.js n'existe pas encore (développement en parallèle).
const docLoaders = import.meta.glob('./documents.js');
let docsModule = null;
let docsPromise = null;

export function loadDocs() {
  if (docsModule) return Promise.resolve(docsModule);
  if (!docsPromise) {
    const load = docLoaders['./documents.js'];
    docsPromise = (load ? load() : Promise.reject(new Error('documents.js indisponible')))
      .then((m) => (docsModule = m))
      .catch((err) => { docsPromise = null; throw err; });
  }
  return docsPromise;
}

/** Message WhatsApp de secours si documents.js est indisponible. */
function fallbackMessage(q) {
  const L = [`Bonjour ${BRAND.name}, voici ma demande de devis n° ${q.number} :`, ''];
  for (const l of q.lines) L.push(`- ${l.qty} x ${l.name} (${l.label}) : ${fcfaPlain(l.total)}`);
  L.push('', `Sous-total : ${fcfaPlain(q.subtotal)}`);
  if (q.delivery.mode === 'retrait') L.push(`Retrait sur place (${BRAND.address.street}) : gratuit`);
  else L.push(`Livraison${q.delivery.commune ? ` à ${q.delivery.commune}` : ''} : ${q.delivery.free ? 'offerte' : DELIVERY.paidLabel.toLowerCase()}`);
  L.push(`${q.delivery.excludesDelivery ? 'TOTAL (hors frais de livraison)' : 'TOTAL'} : ${fcfaPlain(q.total)}`, '');
  L.push(`Nom : ${q.client.name}`);
  if (q.client.company) L.push(`Structure : ${q.client.company}`);
  L.push(`WhatsApp : ${q.client.phone}`);
  if (q.client.email) L.push(`E-mail : ${q.client.email}`);
  return L.join('\n');
}

const sigOf = (q) => JSON.stringify([q.number, q.lines.map((l) => [l.sku, l.qty]), q.delivery, q.client]);

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function initActions(root, { client, drawer, items }) {
  const summary = root.querySelector('[data-summary]');
  const alertBox = summary.querySelector('[data-alert]');
  const itemsError = root.querySelector('[data-error-items]');
  const success = summary.querySelector('[data-success]');
  const successText = success.querySelector('[data-success-text]');
  const successTitle = success.querySelector('[data-success-title]');
  const successWa = success.querySelector('[data-success-wa]');
  const shareBtn = summary.querySelector('[data-action="share"]');
  const waTip = summary.querySelector('[data-wa-tip]');
  const resetBtn = summary.querySelector('[data-action="reset"]');
  const resetBox = summary.querySelector('#q-reset-confirm');
  let busy = false;
  let lastHook = '';
  const pdfCache = { sig: '', blob: null, name: '' };

  // Textes légaux depuis config.js.
  summary.querySelector('[data-legal-payment]').textContent = QUOTE.payment.replace(/ : /g, ' : ');
  summary.querySelector('[data-legal-disclaimer]').textContent = QUOTE.disclaimer;

  // Partage direct du fichier (mobile) si le navigateur sait partager des fichiers.
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let canShareFiles = false;
  try {
    canShareFiles = coarse && !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'test.pdf', { type: 'application/pdf' })] });
  } catch { canShareFiles = false; }
  shareBtn.hidden = !canShareFiles;

  // Préchargement discret du module documents (petit, il charge lui-même jsPDF / ExcelJS à la demande).
  const warm = () => loadDocs().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);
  summary.addEventListener('pointerenter', warm, { once: true });
  summary.addEventListener('focusin', warm, { once: true });

  /* ---------- Validation ---------- */
  function hideAlert() {
    alertBox.hidden = true;
    alertBox.innerHTML = '';
  }

  function validate() {
    const t = store.computeTotals();
    const problems = [];
    if (t.count === 0) {
      problems.push({ key: 'items', el: root.querySelector('#devis-glaces'), message: 'Ajoutez au moins un article.' });
      itemsError.hidden = false;
      shake(itemsError);
    } else {
      itemsError.hidden = true;
    }
    problems.push(...client.validate());
    if (!problems.length) { hideAlert(); return true; }

    // Bandeau récapitulatif dans le résumé (liens vers chaque champ).
    alertBox.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'quote-alert__title';
    p.textContent = problems.length > 1 ? `Il manque ${problems.length} informations pour générer votre devis :` : 'Il manque une information pour générer votre devis :';
    const ul = document.createElement('ul');
    for (const pb of problems) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = pb.key === 'items' ? 'Ajoutez au moins un article' : pb.message;
      b.addEventListener('click', () => goTo(pb));
      li.append(b);
      ul.append(li);
    }
    alertBox.append(p, ul);
    alertBox.hidden = false;
    if (!drawer.isDrawer()) shake(alertBox);
    // Défilement vers la première erreur (le tiroir se ferme sur mobile).
    goTo(problems[0]);
    return false;
  }

  function goTo(pb) {
    const target = pb.key === 'items' ? root.querySelector('#devis-glaces') : pb.el;
    const focusEl = pb.key === 'items' ? items.rows.values().next().value?.input : pb.el;
    const doScroll = () => {
      const lenis = getLenis();
      const y = target.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76) - 28;
      if (lenis) lenis.scrollTo(Math.max(0, y), { duration: reducedMotion ? 0 : 1.1, onComplete: () => focusEl?.focus({ preventScroll: true }) });
      else { window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion ? 'auto' : 'smooth' }); setTimeout(() => focusEl?.focus({ preventScroll: true }), reducedMotion ? 0 : 600); }
    };
    if (drawer.isOpen()) { drawer.close({ restore: false }); setTimeout(doScroll, reducedMotion ? 0 : 320); }
    else doScroll();
  }

  /* ---------- Données ---------- */
  function quoteData() {
    store.ensureNumber();
    const s = store.getState();
    if (!s.delivery.slot) store.update({ delivery: { slot: DEFAULT_SLOT } });
    const q = store.toQuoteData();
    if (!q.delivery.slot) q.delivery.slot = DEFAULT_SLOT;
    return q;
  }

  function webhook(q) {
    if (!BRAND.quoteWebhook) return;
    const sig = sigOf(q);
    if (sig === lastHook) return;
    lastHook = sig;
    try {
      fetch(BRAND.quoteWebhook, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(q),
      }).catch(() => {});
    } catch { /* jamais bloquant */ }
  }

  async function pdfFor(q) {
    const sig = sigOf(q);
    if (pdfCache.sig === sig && pdfCache.blob) return pdfCache;
    const docs = await loadDocs();
    const blob = await docs.createPdf(q);
    Object.assign(pdfCache, { sig, blob, name: docs.quoteFileName(q, 'pdf') });
    return pdfCache;
  }

  /* ---------- États de chargement ---------- */
  function setBusy(btn, label) {
    busy = true;
    const lab = btn.querySelector('[data-label]');
    btn._label = lab?.textContent;
    if (lab && label) lab.textContent = label;
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    summary.classList.add('is-busy');
  }
  function clearBusy(btn) {
    busy = false;
    const lab = btn.querySelector('[data-label]');
    if (lab && btn._label) lab.textContent = btn._label;
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    summary.classList.remove('is-busy');
  }

  function docsError(err) {
    console.warn('[devis] documents indisponibles', err);
    toast('Le document n’a pas pu être généré. Réessayez dans un instant ou écrivez-nous directement sur WhatsApp.', { duration: 5200 });
  }

  /* ---------- Succès ---------- */
  function showSuccess(q, { opened, fileName, shared }) {
    successTitle.textContent = shared ? 'Devis partagé !' : `Devis ${q.number} prêt !`;
    successText.textContent = shared
      ? 'Choisissez la discussion WhatsApp du Glaceur pour envoyer votre PDF. Le Glaceur vous confirme ensuite la commande.'
      : opened
        ? `WhatsApp s’ouvre avec votre message. Joignez-y le PDF téléchargé (${fileName}) puis envoyez : Le Glaceur vous confirme la commande.`
        : `Votre PDF (${fileName}) est téléchargé. Ouvrez WhatsApp avec le bouton ci-dessous pour nous envoyer votre devis.`;
    success.hidden = false;
    if (!reducedMotion) {
      const ring = success.querySelector('[data-success-ring]');
      const check = success.querySelector('[data-success-check]');
      gsap.timeline()
        .from(success, { opacity: 0, y: 12, scale: 0.97, filter: 'blur(6px)', duration: 0.6, ease: 'ice', clearProps: 'all' })
        .fromTo(ring, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.8, ease: 'power2.inOut' }, 0.1)
        .fromTo(check, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5, ease: 'power3.out' }, 0.6);
      burst(success.querySelector('.quote-success__icon'), { count: 16, radius: 90 });
    }
    success.focus({ preventScroll: false });
  }
  void DrawSVGPlugin; // plugin enregistré dans core/motion.js

  /* ---------- Actions ---------- */
  async function sendWhatsApp(btn) {
    if (busy || !validate()) return;
    const q = quoteData();
    webhook(q);
    // 1. Ouvrir WhatsApp tout de suite (geste utilisateur conservé → pas de blocage de fenêtre).
    let msg;
    if (docsModule) msg = docsModule.whatsappMessage(q);
    else {
      try { msg = (await loadDocs()).whatsappMessage(q); } catch { msg = fallbackMessage(q); }
    }
    const url = waLink(msg);
    successWa.href = url;
    let win = null;
    try { win = window.open(url, '_blank'); } catch { win = null; }
    if (win) { try { win.opener = null; } catch { /* inaccessible */ } }
    // 2. Télécharger le PDF pour qu'il le joigne.
    setBusy(btn, 'Préparation du PDF…');
    let fileName = '';
    try {
      const pdf = await pdfFor(q);
      fileName = pdf.name;
      download(pdf.blob, pdf.name);
    } catch (err) {
      docsError(err);
    } finally {
      clearBusy(btn);
    }
    if (drawer.isDrawer() && !drawer.isOpen()) drawer.open(btn);
    showSuccess(q, { opened: !!win, fileName: fileName || 'Devis-Le-Glaceur.pdf' });
    toast(win ? 'WhatsApp est ouvert : joignez votre PDF et envoyez.' : 'Touchez « Rouvrir WhatsApp » pour envoyer votre devis.');
  }

  async function sharePdf(btn) {
    if (busy || !validate()) return;
    const q = quoteData();
    webhook(q);
    const ready = pdfCache.sig === sigOf(q) && pdfCache.blob;
    if (!ready) setBusy(btn, 'Préparation du PDF…');
    let pdf;
    try { pdf = await pdfFor(q); } catch (err) { docsError(err); clearBusy(btn); return; }
    if (!ready) clearBusy(btn);
    const file = new File([pdf.blob], pdf.name, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], title: `Devis ${q.number} · ${BRAND.name}`, text: `Devis ${BRAND.name} n° ${q.number}` });
      showSuccess(q, { shared: true, fileName: pdf.name });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err?.name === 'NotAllowedError') {
        // Le délai d'activation a expiré pendant la génération : le PDF est prêt, un second appui suffit.
        btn.querySelector('[data-label]').textContent = 'Partager le PDF (prêt)';
        toast('Votre PDF est prêt : touchez à nouveau « Partager le PDF ».');
        return;
      }
      download(pdf.blob, pdf.name);
      toast('Partage indisponible : le PDF a été téléchargé.');
    }
  }

  async function downloadDoc(btn, kind) {
    if (busy || !validate()) return;
    const q = quoteData();
    webhook(q);
    setBusy(btn, kind === 'pdf' ? 'Génération du PDF…' : 'Génération de l’Excel…');
    try {
      if (kind === 'pdf') {
        const pdf = await pdfFor(q);
        download(pdf.blob, pdf.name);
        toast(`Devis PDF téléchargé : ${pdf.name}`);
      } else {
        const docs = await loadDocs();
        const blob = await docs.createXlsx(q);
        const name = docs.quoteFileName(q, 'xlsx');
        download(blob, name);
        toast(`Devis Excel téléchargé : ${name}`);
      }
    } catch (err) {
      docsError(err);
    } finally {
      clearBusy(btn);
    }
  }

  /* ---------- Recommencer (confirmation dans la page) ---------- */
  function toggleReset(show) {
    resetBox.hidden = !show;
    resetBtn.setAttribute('aria-expanded', String(show));
    if (show) {
      reveal(resetBox, { y: 8, duration: 0.45 });
      resetBox.querySelector('[data-action="reset-no"]').focus({ preventScroll: true });
    }
  }

  function doReset() {
    const lines = [...root.querySelectorAll('.quote-item.is-selected')];
    const apply = () => {
      store.reset();
      client.clearErrors();
      itemsError.hidden = true;
      hideAlert();
      success.hidden = true;
      Object.assign(pdfCache, { sig: '', blob: null, name: '' });
      lastHook = '';
      toggleReset(false);
      resetBtn.focus({ preventScroll: true });
      toast('Devis réinitialisé.');
    };
    if (reducedMotion || !lines.length) { apply(); return; }
    // Les cartes « fondent » brièvement avant la remise à zéro.
    gsap.timeline({ onComplete: apply })
      .to(lines, { filter: 'blur(3px) brightness(1.15)', opacity: 0.55, duration: 0.25, stagger: 0.03, ease: 'power1.in' })
      .to(lines, { filter: 'none', opacity: 1, duration: 0.35, ease: 'ice', clearProps: 'filter,opacity' });
  }

  /* ---------- Délégation ---------- */
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'whatsapp') sendWhatsApp(btn);
    else if (a === 'share') sharePdf(btn);
    else if (a === 'pdf') downloadDoc(btn, 'pdf');
    else if (a === 'xlsx') downloadDoc(btn, 'xlsx');
    else if (a === 'reset') toggleReset(resetBox.hidden);
    else if (a === 'reset-no') { toggleReset(false); resetBtn.focus({ preventScroll: true }); }
    else if (a === 'reset-yes') doReset();
    else if (a === 'success-close') { success.hidden = true; }
  });

  // Toute modification rend le PDF partagé obsolète et masque l'éventuel bandeau d'erreurs résolu.
  function render(s, t) {
    if (!alertBox.hidden) {
      const stillMissing = t.count === 0 || !s.client.name || !s.client.phone;
      if (!stillMissing) hideAlert();
    }
    if (t.count > 0 && !itemsError.hidden) itemsError.hidden = true;
    shareBtn.querySelector('[data-label]').textContent = 'Partager le PDF';
    waTip.hidden = t.count === 0;
  }

  return { render, validate };
}

export { plainNumber };
