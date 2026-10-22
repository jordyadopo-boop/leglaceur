/**
 * Devis · configurateur (agent quote-ui) — chef d'orchestre.
 * Assemble les briques de src/js/quote/ui-*.js autour du panier partagé core/quote-store.js :
 *   ui-items (étape 1) · ui-gauge (livraison offerte) · ui-info (fiches produit) · ui-delivery (étape 2)
 *   ui-client (étape 3 + validation) · ui-summary (récapitulatif) · ui-drawer (tiroir mobile) · ui-actions (exports).
 * Un seul flux : toute saisie écrit dans le store → événement 'quote:change' → chaque brique se redessine.
 * Le panier rempli depuis l'accueil apparaît donc ici tel quel (et entre onglets).
 */
import { gsap, ScrollTrigger, reducedMotion, getLenis } from '../core/motion.js';
import * as store from '../core/quote-store.js';
import { initItems } from '../quote/ui-items.js';
import { initGauge } from '../quote/ui-gauge.js';
import { initInfo } from '../quote/ui-info.js';
import { initDelivery } from '../quote/ui-delivery.js';
import { initClient, normalizePhone } from '../quote/ui-client.js';
import { initSummary } from '../quote/ui-summary.js';
import { initDrawer } from '../quote/ui-drawer.js';
import { initActions } from '../quote/ui-actions.js';
import { pulse } from '../quote/ui-fx.js';

export default function init(root) {
  root.classList.add('is-live');

  const summary = initSummary(root);
  const drawer = initDrawer(root);
  const getFlyTarget = () => (drawer.isDrawer() ? summary.mbTotalEl : summary.totalEl);
  const items = initItems(root, { getFlyTarget });
  const gauge = initGauge(root);
  const delivery = initDelivery(root);
  const client = initClient(root);
  const actions = initActions(root, { client, drawer, items });
  initInfo(root, { onAdd: () => { const t = getFlyTarget(); if (t) pulse(t, 1.06); } });

  // Étapes « faites » : le numéro devient une coche givrée.
  const stepEls = [...root.querySelectorAll('[data-quote-step]')];
  const stepDone = [false, false, false];
  function renderSteps(s, t, initial) {
    const done = [
      t.count > 0,
      s.delivery.mode === 'retrait' || !!s.delivery.commune,
      (s.client.name || '').trim().length >= 2 && !!normalizePhone(s.client.phone || ''),
    ];
    done.forEach((d, i) => {
      const el = stepEls[i];
      if (!el || d === stepDone[i]) return;
      stepDone[i] = d;
      el.classList.toggle('is-done', d);
      if (d && !initial && !reducedMotion) {
        const num = el.querySelector('.quote-step__num');
        gsap.fromTo(num, { scale: 0.6, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(2.2)', clearProps: 'transform' });
      }
    });
  }

  function renderAll(initial = false) {
    const s = store.getState();
    const t = store.computeTotals(s);
    if (initial) items.initial(s); else items.render(s);
    gauge.render(t, { initial });
    delivery.render(s, t, { initial });
    client.render(s);
    summary.render(s, t, { initial });
    actions.render(s, t);
    renderSteps(s, t, initial);
  }

  renderAll(true);
  window.addEventListener('quote:change', () => renderAll(false));

  // Bouton final du formulaire : vérifie tout, puis mène au récapitulatif (tiroir sur mobile).
  const form = root.querySelector('#quote-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!actions.validate()) return;
    if (drawer.isDrawer()) { drawer.open(form.querySelector('[data-finish]')); return; }
    const wa = root.querySelector('.quote-summary [data-action="whatsapp"]');
    const lenis = getLenis();
    const sheet = root.querySelector('.quote-summary__sheet');
    const r = sheet.getBoundingClientRect();
    const focusWa = () => { wa.focus({ preventScroll: true }); pulse(wa, 1.05); };
    if (r.top >= 0 && r.bottom <= innerHeight) focusWa();
    else if (lenis) lenis.scrollTo(sheet, { offset: -100, onComplete: focusWa });
    else { sheet.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' }); setTimeout(focusWa, 500); }
  });

  // Entrées au défilement : depuis un état visible, une seule fois.
  if (!reducedMotion) {
    for (const step of stepEls) {
      const head = step.querySelector('.quote-step__head');
      gsap.from(head.children, {
        opacity: 0, y: 30, filter: 'blur(6px)', duration: 0.9, stagger: 0.08, ease: 'ice', clearProps: 'filter,transform,opacity',
        scrollTrigger: { trigger: step, start: 'top 85%', once: true },
      });
    }
    const cards = root.querySelectorAll('.quote-item');
    gsap.from(cards, {
      opacity: 0, y: 36, scale: 0.97, filter: 'blur(8px)', duration: 0.9, ease: 'ice', clearProps: 'filter,transform,opacity',
      stagger: { each: 0.06 },
      scrollTrigger: { trigger: root.querySelector('[data-items]'), start: 'top 88%', once: true },
    });
    const sheet = root.querySelector('.quote-summary__sheet');
    if (!drawer.isDrawer()) {
      gsap.from(sheet, {
        opacity: 0, x: 40, filter: 'blur(10px)', duration: 1.1, ease: 'ice', clearProps: 'filter,transform,opacity',
        scrollTrigger: { trigger: root, start: 'top 75%', once: true },
      });
    }
    gsap.from(root.querySelectorAll('.quote__floe'), {
      opacity: 0, scale: 0.7, duration: 1.6, stagger: 0.15, ease: 'ice',
      scrollTrigger: { trigger: root, start: 'top 80%', once: true },
    });
    gsap.to(root.querySelectorAll('.quote__floe'), {
      yPercent: (i) => [-30, 25, -18][i] || 0, ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
    });
  }

  // Les hauteurs changent (panneaux, lignes) : on garde ScrollTrigger juste.
  let rt;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 200); });
  ro.observe(form);
}
