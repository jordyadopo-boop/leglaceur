/**
 * Livraison & retrait (agent convert-a) — section #livraison (.delivery).
 *  - État du panier en direct : « Plus que N articles pour la livraison offerte » / « Livraison offerte ! »
 *    (règle DELIVERY.freeFrom, aucun tarif affiché).
 *  - Schéma radial SVG depuis Abatta : trajets tracés au défilement (DrawSVG), camion frigorifique en tournée
 *    (MotionPath) mis en pause hors écran, survol / focus d'une commune → mise en avant.
 *  - Choix d'une commune → noté dans le devis (quote-store, delivery.commune).
 *  - Carte Google chargée uniquement au clic (mapsEmbedUrl).
 */
import { DELIVERY, BRAND, mapsUrl, mapsEmbedUrl } from '../config.js';
import { getState, update, computeTotals } from '../core/quote-store.js';
import { gsap, ScrollTrigger, reducedMotion } from '../core/motion.js';

const NBSP = ' ';
const NNBSP = ' ';
const nf = new Intl.NumberFormat('fr-FR');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export default function init(root) {
  const goal = DELIVERY.freeFrom;
  const $ = (s) => root.querySelector(s);

  /* ---------- Textes depuis config.js ---------- */
  const mapsLink = $('[data-maps-link]');
  if (mapsLink) mapsLink.href = mapsUrl;
  const addr = $('[data-address]');
  if (addr) addr.textContent = `${BRAND.address.street}, ${BRAND.address.city}`;

  /* ---------- État du panier ---------- */
  const status = $('[data-status]');
  const statusText = $('[data-status-text]');
  const statusFill = $('[data-status-fill]');
  const statusNote = $('[data-status-note]');
  let prevCount = -1;

  function renderStatus() {
    const s = getState();
    const t = computeTotals(s);
    const n = t.count;
    const left = Math.max(0, goal - n);
    const free = n >= goal;
    status.classList.toggle('is-free', free);
    statusFill.style.setProperty('--p', Math.min(1, n / goal));
    if (n === 0) {
      statusText.textContent = DELIVERY.freeLabel;
    } else if (free) {
      statusText.innerHTML = `Votre sélection&nbsp;: ${nf.format(n)}${NBSP}articles · <b>Livraison offerte${NNBSP}!</b>`;
    } else {
      statusText.innerHTML = `Votre sélection&nbsp;: ${nf.format(n)}${NBSP}article${n > 1 ? 's' : ''} · <b>plus que ${left}</b>${left > 1 ? `${NBSP}articles` : `${NBSP}article`} pour la livraison offerte`;
    }
    statusNote.hidden = free;
    if (prevCount >= 0 && prevCount < goal && free && !reducedMotion) {
      gsap.fromTo(status, { scale: 0.97 }, { scale: 1, duration: 0.9, ease: 'back.out(2.4)', clearProps: 'transform' });
    }
    prevCount = n;
    syncChosen(s.delivery.commune);
  }

  /* ---------- Schéma ---------- */
  const dmap = $('.dmap');
  const svg = $('[data-map-svg]');
  const routes = new Map([...svg.querySelectorAll('[data-route]')].map((el) => [el.dataset.route, el]));
  const nodes = new Map([...svg.querySelectorAll('[data-node]')].map((el) => [el.dataset.node, el]));
  const chips = new Map([...root.querySelectorAll('[data-commune]')].map((el) => [el.dataset.commune, el]));
  const hint = $('[data-commune-hint]');
  const hintDefault = hint?.textContent || '';
  const truck = $('[data-truck]');
  const truckBody = $('[data-truck-body]');
  const HUB = { x: 560, y: 290 };

  // Puces : vérifiées contre DELIVERY.communes (ajout des communes manquantes, retrait des obsolètes).
  const chipList = $('.dmap__chips');
  for (const [name, el] of chips) if (!DELIVERY.communes.includes(name)) { el.closest('li')?.remove(); chips.delete(name); }
  for (const name of DELIVERY.communes) {
    if (chips.has(name)) continue;
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="dchip dchip--other" data-commune="${esc(name)}" aria-pressed="false">${esc(name)}</button>`;
    chipList.append(li);
    chips.set(name, li.firstElementChild);
  }
  // remettre dans l'ordre de config.js
  for (const name of DELIVERY.communes) chipList.append(chips.get(name).closest('li'));

  let active = null;
  function highlight(name) {
    if (active === name) return;
    active = name;
    dmap.classList.toggle('has-active', !!name && routes.has(name));
    for (const [k, el] of routes) el.classList.toggle('is-active', k === name);
    for (const [k, el] of nodes) el.classList.toggle('is-active', k === name);
    for (const [k, el] of chips) el.classList.toggle('is-active', k === name);
  }

  function syncChosen(commune) {
    for (const [k, el] of chips) el.setAttribute('aria-pressed', String(k === commune));
    for (const [k, el] of nodes) el.classList.toggle('is-chosen', k === commune);
    if (hint) {
      hint.innerHTML = commune
        ? `Commune notée pour votre devis&nbsp;: <b>${esc(commune)}</b>.`
        : esc(hintDefault);
    }
  }

  /* ---------- Camion ---------- */
  let tour = null;
  let resumeTimer = null;
  let inView = false;
  const order = ['Cocody', 'Bingerville', 'Grand-Bassam', 'Port-Bouët', 'Koumassi', 'Marcory', 'Treichville', 'Plateau', 'Adjamé', 'Attécoubé', 'Yopougon', 'Songon', 'Abobo', 'Anyama']
    .filter((n) => routes.has(n));
  for (const n of routes.keys()) if (!order.includes(n)) order.push(n);

  function endPoint(name) {
    const p = routes.get(name);
    const len = p.getTotalLength();
    return p.getPointAtLength(len);
  }

  function drive(name, { duration = 1.6 } = {}) {
    const route = routes.get(name);
    if (!route) return gsap.timeline();
    const end = endPoint(name);
    const tl = gsap.timeline();
    tl.call(() => {
      highlight(name);
      gsap.set(truckBody, { scaleX: end.x < HUB.x ? -1 : 1, transformOrigin: '50% 50%' });
    })
      .set(truck, { opacity: 0 })
      .set(truck, { x: HUB.x, y: HUB.y })
      .to(truck, { opacity: 1, duration: 0.25, ease: 'power1.out' })
      .to(truck, {
        duration, ease: 'power2.inOut',
        motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5] },
      }, '<')
      .call(() => arrive(name))
      .to(truck, { opacity: 0, duration: 0.3, delay: 0.55 });
    return tl;
  }

  function arrive(name) {
    const node = nodes.get(name);
    if (!node) return;
    const halo = node.querySelector('.dmap__halo');
    gsap.fromTo(halo, { attr: { r: 16 } }, { attr: { r: 30 }, duration: 0.45, yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  function buildTour() {
    tour?.kill();
    tour = gsap.timeline({ repeat: -1, paused: !inView });
    for (const name of order) tour.add(drive(name, { duration: 1.5 }));
    return tour;
  }

  function focusCommune(name) {
    if (!routes.has(name)) { highlight(null); return; }
    clearTimeout(resumeTimer);
    if (reducedMotion) { highlight(name); return; }
    tour?.pause();
    gsap.killTweensOf(truck);
    drive(name, { duration: 1 }).eventCallback('onComplete', null);
  }
  function blurCommune() {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (reducedMotion) { highlight(null); return; }
      if (inView) buildTour().play();
      else highlight(null);
    }, 2200);
  }

  for (const [name, el] of chips) {
    el.addEventListener('pointerenter', () => focusCommune(name));
    el.addEventListener('focus', () => focusCommune(name));
    el.addEventListener('pointerleave', blurCommune);
    el.addEventListener('blur', blurCommune);
    el.addEventListener('click', () => {
      const cur = getState().delivery.commune;
      const next = cur === name ? '' : name;
      update({ delivery: { commune: next } });
      focusCommune(name);
    });
  }
  for (const [name, el] of nodes) {
    el.addEventListener('pointerenter', () => focusCommune(name));
    el.addEventListener('pointerleave', blurCommune);
    el.addEventListener('click', () => {
      update({ delivery: { commune: name } });
      focusCommune(name);
    });
  }

  /* ---------- Entrée en scène ---------- */
  const routeEls = [...routes.values()];
  if (!reducedMotion) {
    const st = { trigger: dmap, start: 'top 78%', once: true };
    const tl = gsap.timeline({ scrollTrigger: st });
    tl.from(dmap, { opacity: 0, y: 40, scale: 0.97, filter: 'blur(8px)', duration: 1.1, clearProps: 'transform,filter' })
      .from(svg.querySelector('.dmap__hub-core'), { scale: 0, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(2.5)' }, 0.25)
      .from(svg.querySelector('.dmap__hub-tag'), { opacity: 0, y: 10, duration: 0.6 }, 0.45)
      .from(routeEls, { drawSVG: '0%', duration: 1.3, stagger: 0.06, ease: 'power2.inOut' }, 0.4)
      .from(svg.querySelectorAll('.dmap__gem, .dmap__halo'), { scale: 0, transformOrigin: '50% 50%', duration: 0.6, stagger: 0.03, ease: 'back.out(2.2)' }, 0.9)
      .from(svg.querySelectorAll('.dmap__label'), { opacity: 0, duration: 0.6, stagger: 0.03, clearProps: 'opacity' }, 1.1)
      .from(svg.querySelectorAll('.dmap__lagoon, .dmap__ocean, .dmap__water-label'), { opacity: 0, duration: 1.2 }, 0.2)
      .call(() => {
        truck.classList.add('is-on');
        buildTour();
        if (inView) tour.play();
      });

    const intro = $('.delivery__intro');
    gsap.from(intro.children, { opacity: 0, y: 30, duration: 1, stagger: 0.08, scrollTrigger: { trigger: intro, start: 'top 82%', once: true } });
    gsap.from(root.querySelectorAll('.dmap__chips li'), { opacity: 0, y: 12, duration: 0.6, stagger: 0.025, scrollTrigger: { trigger: chipList, start: 'top 92%', once: true } });

    ScrollTrigger.create({
      trigger: dmap, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => {
        inView = self.isActive;
        if (!tour) return;
        if (inView && !document.hidden) tour.play(); else tour.pause();
      },
    });
    document.addEventListener('visibilitychange', () => {
      if (!tour) return;
      if (document.hidden) tour.pause(); else if (inView) tour.play();
    });
  }

  /* ---------- Carte Google au clic ---------- */
  const toggle = $('[data-map-toggle]');
  const frame = $('[data-mapframe]');
  const toggleLabel = $('[data-map-toggle-label]');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    if (open && !frame.firstElementChild) {
      const iframe = document.createElement('iframe');
      iframe.src = mapsEmbedUrl;
      iframe.title = `Carte : ${BRAND.name}, ${BRAND.address.street}, ${BRAND.address.city}`;
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      frame.append(iframe);
    }
    frame.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Masquer la carte' : 'Afficher la carte';
    if (open && !reducedMotion) gsap.from(frame, { opacity: 0, y: -8, duration: 0.6, clearProps: 'all' });
    ScrollTrigger.refresh();
  });

  renderStatus();
  window.addEventListener('quote:change', renderStatus);
}
