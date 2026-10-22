/**
 * Devis · étape 3 « Vos coordonnées » (agent quote-ui) + validation avant export.
 * Nom et prénom* · Numéro WhatsApp* (10 chiffres CI, +225 / 00225 / espaces acceptés) ·
 * Structure (facultatif) · E-mail (facultatif, vérifié s'il est rempli) · type · précisions.
 * Erreurs en ligne accessibles (aria-invalid + aria-describedby), affichées après la première tentative
 * ou à la sortie d'un champ déjà touché.
 */
import * as store from '../core/quote-store.js';
import { shake } from './ui-fx.js';

/** « +225 07 89 85 16 86 » → « 0789851686 » ; null si invalide. */
export function normalizePhone(raw = '') {
  let d = String(raw).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 13 && d.startsWith('225')) d = d.slice(3);
  return /^\d{10}$/.test(d) ? d : null;
}

/** « 0789851686 » → « +225 07 89 85 16 86 » */
export const formatPhone = (d) => `+225 ${d.replace(/(\d{2})(?=\d)/g, '$1 ')}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MESSAGES = {
  name: { empty: 'Indiquez votre nom et votre prénom.' },
  phone: {
    empty: 'Indiquez votre numéro WhatsApp.',
    invalid: 'Numéro invalide\u00a0: 10\u00a0chiffres attendus, par exemple 07\u00a000\u00a000\u00a000\u00a000 (+225 accepté).',
  },
  email: { invalid: 'Adresse e-mail invalide (exemple\u00a0: nom@domaine.ci).' },
};

export function initClient(root) {
  const fields = Object.fromEntries([...root.querySelectorAll('[data-client]')].map((el) => [el.dataset.client, el]));
  const types = [...root.querySelectorAll('[data-types] input[name="type"]')];
  const errors = Object.fromEntries([...root.querySelectorAll('[data-error-for]')].map((el) => [el.dataset.errorFor, el]));
  const touched = new Set();
  let attempted = false;

  const write = (key, value) => store.update({ client: { [key]: value } });
  const timers = {};

  for (const [key, el] of Object.entries(fields)) {
    el.addEventListener('input', () => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => write(key, el.value.trim()), 220);
      if (attempted || touched.has(key)) check(key, { live: true });
    });
    el.addEventListener('blur', () => {
      clearTimeout(timers[key]);
      if (key === 'phone') {
        const n = normalizePhone(el.value);
        if (n) el.value = formatPhone(n);
      }
      write(key, el.value.trim());
      if (el.value.trim()) touched.add(key);
      if (attempted || touched.has(key)) check(key);
    });
  }
  root.querySelector('[data-types]').addEventListener('change', (e) => {
    if (e.target.name === 'type') write('type', e.target.value);
  });

  function setError(key, msg) {
    const input = fields[key];
    const err = errors[key];
    if (!input || !err) return;
    const had = !err.hidden;
    if (msg) {
      err.textContent = msg;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.closest('.field')?.classList.add('has-error');
      if (!had) shake(input.closest('.quote-phone') || input);
    } else {
      err.hidden = true;
      err.textContent = '';
      input.removeAttribute('aria-invalid');
      input.closest('.field')?.classList.remove('has-error');
    }
  }

  /** Valide un champ ; retourne le message d'erreur ou ''. */
  function check(key, { live = false } = {}) {
    const v = (fields[key]?.value || '').trim();
    let msg = '';
    if (key === 'name' && v.length < 2) msg = MESSAGES.name.empty;
    if (key === 'phone') {
      if (!v) msg = MESSAGES.phone.empty;
      else if (!normalizePhone(v)) msg = live && v.replace(/\D/g, '').length < 10 ? '' : MESSAGES.phone.invalid;
    }
    if (key === 'email' && v && !EMAIL_RE.test(v)) msg = live ? '' : MESSAGES.email.invalid;
    // En saisie : on n'affiche pas d'erreur tant que l'utilisateur tape, mais on efface dès que c'est correct.
    if (live && msg && errors[key]?.hidden) return msg;
    setError(key, msg);
    return msg;
  }

  /** Valide tout le bloc ; retourne la liste [{ key, el, message }]. */
  function validate() {
    attempted = true;
    for (const [key, el] of Object.entries(fields)) {
      clearTimeout(timers[key]);
      if (key === 'phone') {
        const n = normalizePhone(el.value);
        if (n) el.value = formatPhone(n);
      }
    }
    // Enregistre immédiatement les valeurs (les documents les impriment).
    store.update({ client: Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, el.value.trim()])) });
    const out = [];
    for (const key of ['name', 'phone', 'email']) {
      const m = check(key);
      if (m) out.push({ key, el: fields[key], message: m });
    }
    return out;
  }

  function render(s) {
    const c = s.client;
    for (const [key, el] of Object.entries(fields)) {
      if (document.activeElement === el) continue;
      const v = c[key] || '';
      if (el.value.trim() !== v) el.value = v;
    }
    for (const r of types) r.checked = r.value === (c.type || 'particulier');
  }

  function clearErrors() {
    attempted = false;
    touched.clear();
    for (const k of Object.keys(errors)) setError(k, '');
  }

  return { render, validate, clearErrors, fields };
}
