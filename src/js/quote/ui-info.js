/**
 * Devis · fiche produit (bouton « i » de chaque article) (agent quote-ui).
 * Boîte de dialogue modale native (<dialog>) remplie depuis PRODUCTS de config.js :
 * description, utilisations, mode d'emploi, conservation, sécurité, prix des variantes,
 * et raccourcis « Ajouter 1 … » qui alimentent le devis sans quitter le formulaire.
 * Bureau : panneau givré centré ; mobile : feuille qui monte du bas. Échap / voile / bouton pour fermer.
 */
import { PRODUCTS } from '../config.js';
import { fcfaShort } from '../core/format.js';
import { gsap, reducedMotion, stopScroll, startScroll } from '../core/motion.js';
import * as store from '../core/quote-store.js';
import { jump } from './ui-fx.js';

const NBSP = ' ';
const nbsp = (s) => String(s).replace(/ (:|;|!|\?)/g, `${NBSP}$1`).replace(/(\d) (kg)/g, `$1${NBSP}$2`);

export function initInfo(root, { onAdd } = {}) {
  const dlg = root.querySelector('[data-info-dialog]');
  if (!dlg || typeof dlg.showModal !== 'function') {
    // Navigateur ancien : on masque les boutons « i » plutôt que d'offrir un bouton inerte.
    root.querySelectorAll('[data-info]').forEach((b) => { b.hidden = true; });
    return { close() {} };
  }
  const sheet = dlg.querySelector('.quote-info__sheet');
  const $ = (s) => dlg.querySelector(s);
  const media = $('[data-info-media]');
  let opener = null;
  let current = null;

  function fill(p) {
    current = p;
    dlg.dataset.product = p.id;
    $('[data-info-alias]').textContent = p.alias || '';
    $('[data-info-title]').textContent = p.name;
    $('[data-info-tagline]').textContent = p.tagline || '';
    $('[data-info-prices]').innerHTML = '';
    for (const v of p.variants) {
      const chip = document.createElement('span');
      chip.className = 'quote-info__price';
      chip.innerHTML = `<b></b><small></small>`;
      chip.querySelector('b').textContent = fcfaShort(v.price);
      chip.querySelector('small').textContent = nbsp(v.label);
      $('[data-info-prices]').append(chip);
    }
    $('[data-info-desc]').textContent = nbsp(p.description || '');
    const uses = $('[data-info-uses]');
    uses.innerHTML = '';
    for (const u of p.uses || []) {
      const li = document.createElement('li');
      li.textContent = u;
      uses.append(li);
    }
    $('[data-info-howto]').textContent = nbsp(p.howto || '');
    $('[data-info-storage]').textContent = nbsp(p.storage || '');
    $('[data-info-safety]').textContent = nbsp(p.safety || '');
    $('[data-info-safety-box]').hidden = !p.safety;
    $('[data-info-safety-box]').classList.toggle('is-strong', p.id === 'carboglace');

    // Image : celle de la carte (déjà chargée), sinon le visuel givré de secours.
    media.querySelector('img')?.remove();
    const cardImg = root.querySelector(`.quote-item[data-product="${p.id}"] .quote-item__img`);
    media.classList.toggle('is-fallback', !cardImg || cardImg.dataset.broken === '1');
    if (cardImg && cardImg.dataset.broken !== '1') {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.src = cardImg.currentSrc || cardImg.src;
      img.className = 'quote-info__img';
      media.prepend(img);
    }

    // Raccourcis d'ajout (une action par variante).
    const actions = $('[data-info-actions]');
    actions.innerHTML = '';
    for (const v of p.variants) {
      if (!p.available) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn--sm quote-info__add';
      b.dataset.addSku = v.sku;
      b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#q-i-plus"/></svg><span></span>';
      b.querySelector('span').textContent = p.variants.length > 1 ? `Ajouter${NBSP}: ${nbsp(v.label)}` : 'Ajouter au devis';
      actions.append(b);
    }
    renderCounts();
  }

  function renderCounts() {
    if (!current) return;
    const lines = store.getState().lines;
    for (const b of dlg.querySelectorAll('[data-add-sku]')) {
      const q = lines[b.dataset.addSku] || 0;
      b.dataset.count = q;
      let badge = b.querySelector('.quote-info__count');
      if (q > 0) {
        if (!badge) {
          badge = document.createElement('b');
          badge.className = 'quote-info__count';
          b.append(badge);
        }
        badge.textContent = `${q}`;
        b.setAttribute('aria-description', `${q} dans le devis`);
      } else {
        badge?.remove();
        b.removeAttribute('aria-description');
      }
    }
  }

  function open(id, from) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    opener = from || document.activeElement;
    fill(p);
    dlg.showModal();
    stopScroll();
    sheet.scrollTop = 0;
    if (!reducedMotion) {
      const mobile = window.matchMedia('(max-width: 40rem)').matches;
      gsap.fromTo(sheet,
        mobile ? { yPercent: 100 } : { y: 30, scale: 0.94, opacity: 0, filter: 'blur(10px)' },
        { yPercent: 0, y: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: mobile ? 0.6 : 0.7, ease: 'ice', clearProps: 'transform,filter,opacity' });
      gsap.from(dlg.querySelectorAll('.quote-info__head > *, .quote-info__desc, .quote-info__block, .quote-info__safety, .quote-info__actions'), {
        opacity: 0, y: 14, duration: 0.6, stagger: 0.05, delay: 0.12, ease: 'ice', clearProps: 'all',
      });
    }
  }

  let closing = false;
  function close() {
    if (!dlg.open || closing) return;
    const done = () => {
      closing = false;
      dlg.close();
    };
    if (reducedMotion) { done(); return; }
    closing = true;
    const mobile = window.matchMedia('(max-width: 40rem)').matches;
    gsap.to(sheet, mobile ? { yPercent: 100, duration: 0.35, ease: 'power2.in', onComplete: done }
      : { y: 16, scale: 0.97, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: done });
  }

  dlg.addEventListener('close', () => {
    gsap.set(sheet, { clearProps: 'all' });
    startScroll();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) { close(); return; } // clic sur le voile
    if (e.target.closest('[data-info-close]')) { close(); return; }
    const add = e.target.closest('[data-add-sku]');
    if (add) {
      const before = store.computeTotals().count;
      store.addQty(add.dataset.addSku, 1);
      if (before === 0) store.ensureNumber();
      jump(add, { count: 3 });
      onAdd?.(add.dataset.addSku);
    }
  });

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-info]');
    if (b && !dlg.contains(b)) open(b.dataset.info, b);
  });

  window.addEventListener('quote:change', () => { if (dlg.open) renderCounts(); });

  return { open, close };
}
