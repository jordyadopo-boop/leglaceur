/**
 * Scène finale « Besoin de fraîcheur ? » (agent convert-b).
 * - Coordonnées (3 numéros, e-mail, adresse, itinéraire, horaires) et lien WhatsApp relus depuis config.js.
 * - Bouton principal sensible au panier : vide → « Composer ma commande » (#commande) ;
 *   rempli → « Finaliser mon devis » (devis.html) + ligne d'état (articles, livraison offerte ou non).
 * - Mise en scène : la vitre s'ouvre (clip-path) pendant que la photo recule (scrub), le givre se dessine
 *   dans les coins (DrawSVG), la devise gravée apparaît lettre par lettre, la carte de verre se pose, les
 *   coordonnées gèlent en cascade. La vitre à essuyer elle-même est fournie par fx-frost-wipe.
 */
import { BRAND, DELIVERY, mapsUrl } from '../config.js';
import { gsap, SplitText, reducedMotion } from '../core/motion.js';
import { getState, computeTotals } from '../core/quote-store.js';
import { waLink } from '../core/whatsapp.js';

const NBSP = ' ';
const NNBSP = ' ';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function init(root) {
  syncData(root);
  const renderCart = wireCart(root);
  renderCart();
  window.addEventListener('quote:change', renderCart);
  if (!reducedMotion) choreograph(root);
}

function syncData(root) {
  const wa = root.querySelector('[data-cta-wa]');
  if (wa) wa.href = waLink(wa.dataset.waText || '');
  const call = root.querySelector('[data-cta-call]');
  if (call) call.href = `tel:${BRAND.phones[0].tel}`;
  const phones = root.querySelector('[data-cta-phones]');
  if (phones) {
    phones.innerHTML = BRAND.phones.map((p) =>
      `<li><a href="tel:${esc(p.tel)}">${esc(p.display).replace(/ /g, NBSP)}</a> <span>${esc(p.label)}</span></li>`).join('');
  }
  const mail = root.querySelector('[data-cta-email]');
  if (mail) { mail.href = `mailto:${BRAND.email}`; mail.textContent = BRAND.email; }
  const addr = root.querySelector('[data-cta-address]');
  if (addr) addr.textContent = `${BRAND.address.street}, ${BRAND.address.city}`;
  const maps = root.querySelector('[data-cta-maps]');
  if (maps) maps.href = mapsUrl;
  const hours = root.querySelector('[data-cta-hours]');
  if (hours) hours.textContent = BRAND.hours;
  const free = root.querySelector('[data-cta-free]');
  if (free) free.textContent = DELIVERY.freeLabel.replace(/ (\d+) /, ` $1${NBSP}`);
}

function wireCart(root) {
  const primary = root.querySelector('[data-cta-primary]');
  const label = root.querySelector('[data-cta-primary-label]');
  const line = root.querySelector('[data-cta-cart]');
  return () => {
    const t = computeTotals(getState());
    const has = t.count > 0;
    if (primary) primary.setAttribute('href', has ? 'devis.html' : '#commande');
    if (label) label.textContent = has ? 'Finaliser mon devis' : 'Composer ma commande';
    if (!line) return;
    line.hidden = !has;
    if (!has) { line.textContent = ''; return; }
    const n = `${t.count}${NBSP}article${t.count > 1 ? 's' : ''}`;
    line.innerHTML = t.freeEligible
      ? `<span class="cta__cart-dot is-ok" aria-hidden="true"></span>Votre devis compte ${n}${NNBSP}: <strong>livraison offerte</strong>.`
      : `<span class="cta__cart-dot" aria-hidden="true"></span>Votre devis compte ${n}. Plus que <strong>${t.remainingForFree}${NBSP}article${t.remainingForFree > 1 ? 's' : ''}</strong> pour la livraison offerte.`;
  };
}

function choreograph(root) {
  const stage = root.querySelector('.cta__stage');
  const win = root.querySelector('.cta__window');
  const photo = root.querySelector('[data-cta-photo]');
  const card = root.querySelector('.cta__card');
  const etch = root.querySelector('.cta__etch');
  const rime = root.querySelectorAll('[data-cta-rime] path');
  const coords = root.querySelectorAll('.cta__coord');

  // La photo recule et la vitre s'ouvre pendant l'approche (scrub, réversible).
  gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 95%', end: 'top 45%', scrub: 0.8 } })
    .fromTo(win, { clipPath: 'inset(6% 5% 6% 5% round 48px)' }, { clipPath: 'inset(0% 0% 0% 0% round 40px)', ease: 'none' }, 0)
    .fromTo(photo, { scale: 1.28, yPercent: -4 }, { scale: 1.06, yPercent: 0, ease: 'none' }, 0);
  gsap.to(photo, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: stage, start: 'top 25%', end: 'bottom top', scrub: true } });

  if (rime.length) {
    gsap.from(rime, { drawSVG: '0%', duration: 2.4, stagger: 0.2, ease: 'power2.out', scrollTrigger: { trigger: stage, start: 'top 70%', once: true } });
  }

  if (etch && SplitText) {
    const split = SplitText.create(etch, { type: 'chars', charsClass: 'cta__etch-char' });
    gsap.from(split.chars, { opacity: 0, yPercent: 40, filter: 'blur(10px)', duration: 1.3, stagger: 0.03, ease: 'ice',
      scrollTrigger: { trigger: stage, start: 'top 65%', once: true } });
  }

  const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 85%', once: true } });
  tl.from(card, { y: 70, opacity: 0, rotateX: -10, transformPerspective: 1200, transformOrigin: '50% 100%', duration: 1.3, ease: 'ice' })
    .from(card.querySelectorAll('.eyebrow, .cta__title, .cta__lead'), { y: 26, opacity: 0, filter: 'blur(6px)', duration: 0.9, stagger: 0.08, ease: 'ice', clearProps: 'filter' }, 0.2)
    .from(card.querySelectorAll('.cta__perks li'), { x: -18, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'ice' }, 0.45)
    .from(card.querySelectorAll('.cta__actions > *'), { y: 22, opacity: 0, scale: 0.94, duration: 0.8, stagger: 0.08, ease: 'back.out(1.6)' }, 0.55);

  gsap.from(coords, { y: 40, opacity: 0, filter: 'blur(6px)', duration: 1, stagger: 0.09, ease: 'ice', clearProps: 'filter',
    scrollTrigger: { trigger: root.querySelector('.cta__coords'), start: 'top 90%', once: true } });

  // Souffle de buée qui traverse la vitre une fois, à l'arrivée.
  const fog = root.querySelector('.cta__shine');
  if (fog) gsap.fromTo(fog, { xPercent: -120, opacity: 0 }, { xPercent: 120, opacity: 1, duration: 2.6, ease: 'power2.inOut',
    scrollTrigger: { trigger: stage, start: 'top 55%', once: true }, onComplete: () => gsap.set(fog, { opacity: 0 }) });
}
