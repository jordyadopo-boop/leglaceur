/**
 * Questions fréquentes (agent convert-b).
 * - Accordéon accessible : <button aria-expanded> + panneau role="region" ; hauteur animée (GSAP, height auto),
 *   l'icône « + » cristallise en flocon à l'ouverture. Panneaux fermés en hidden="until-found" quand le navigateur
 *   le permet (Ctrl+F retrouve et ouvre la réponse).
 * - Prix, numéros, lien WhatsApp et adresse revérifiés contre config.js.
 * - Entrée : les questions « gèlent » en cascade ; la grande « ? » de givre dérive au défilement.
 * Sans JS : toutes les réponses restent visibles.
 */
import { BRAND, SKUS, mapsUrl } from '../config.js';
import { gsap, ScrollTrigger, reducedMotion } from '../core/motion.js';
import { waLink } from '../core/whatsapp.js';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const NBSP = ' ';
const UNTIL_FOUND = 'onbeforematch' in document.body;

export default function init(root) {
  syncData(root);

  const items = [...root.querySelectorAll('[data-faq-item]')].map((el) => ({
    el,
    btn: el.querySelector('.faq__btn'),
    panel: el.querySelector('.faq__panel'),
    answer: el.querySelector('.faq__answer'),
  }));
  if (!items.length) return;
  root.classList.add('is-enhanced');

  let refreshTimer = 0;
  const refresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 120);
  };

  const hide = (p) => (UNTIL_FOUND ? p.setAttribute('hidden', 'until-found') : (p.hidden = true));

  const set = (it, open, animate = true) => {
    it.btn.setAttribute('aria-expanded', String(open));
    it.el.classList.toggle('is-open', open);
    gsap.killTweensOf([it.panel, it.answer]);
    if (open) {
      it.panel.removeAttribute('hidden');
      if (!animate || reducedMotion) { gsap.set(it.panel, { clearProps: 'height' }); refresh(); return; }
      gsap.fromTo(it.panel, { height: it.panel.offsetHeight && it.panel.style.height ? it.panel.offsetHeight : 0 },
        { height: 'auto', duration: 0.65, ease: 'ice', onComplete: () => { gsap.set(it.panel, { clearProps: 'height' }); refresh(); } });
      gsap.fromTo(it.answer.children, { y: 14, opacity: 0, filter: 'blur(4px)' },
        { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, stagger: 0.06, delay: 0.08, ease: 'ice', clearProps: 'filter,transform,opacity' });
    } else {
      if (!animate || reducedMotion) { hide(it.panel); gsap.set(it.panel, { clearProps: 'height' }); refresh(); return; }
      gsap.fromTo(it.panel, { height: it.panel.offsetHeight }, { height: 0, duration: 0.45, ease: 'power3.inOut',
        onComplete: () => { hide(it.panel); gsap.set(it.panel, { clearProps: 'height' }); refresh(); } });
    }
  };

  items.forEach((it, i) => {
    set(it, i === 0, false);
    it.btn.addEventListener('click', () => set(it, it.btn.getAttribute('aria-expanded') !== 'true'));
    it.panel.addEventListener('beforematch', () => set(it, true, false));
    it.btn.addEventListener('keydown', (e) => {
      const map = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      items[(map[e.key] + items.length) % items.length].btn.focus();
    });
  });

  // Lien direct vers une réponse (#faq-a-03).
  const target = location.hash && items.find((it) => `#${it.panel.id}` === location.hash);
  if (target) set(target, true, false);

  if (reducedMotion) return;
  gsap.from(items.map((it) => it.el), {
    y: 36, opacity: 0, filter: 'blur(6px)', duration: 0.9, stagger: 0.06, ease: 'ice', clearProps: 'filter',
    scrollTrigger: { trigger: root.querySelector('.faq__list-wrap'), start: 'top 85%', once: true },
  });
  gsap.from(root.querySelector('.faq__help'), {
    y: 40, opacity: 0, rotateX: -12, transformPerspective: 900, duration: 1.1, ease: 'ice',
    scrollTrigger: { trigger: root.querySelector('.faq__help'), start: 'top 90%', once: true },
  });
  const q = root.querySelector('.faq__qmark');
  if (q) {
    gsap.fromTo(q, { yPercent: -18, rotate: -10 }, { yPercent: 18, rotate: 8, ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1 } });
  }
}

/** Prix, téléphones, WhatsApp et adresse depuis config.js. */
function syncData(root) {
  root.querySelectorAll('[data-price]').forEach((el) => {
    const v = SKUS[el.dataset.price];
    if (v) el.textContent = `${nf.format(v.price)}${NBSP}F`;
  });
  root.querySelectorAll('[data-tel]').forEach((el) => {
    const p = BRAND.phones[Number(el.dataset.tel)];
    if (!p) return;
    el.href = `tel:${p.tel}`;
    if (!el.classList.contains('btn')) el.textContent = p.display.replace(/ /g, NBSP);
  });
  root.querySelectorAll('[data-wa]').forEach((el) => { el.href = waLink(el.dataset.wa); });
  root.querySelectorAll('[data-maps]').forEach((el) => { el.href = mapsUrl; });
  root.querySelectorAll('[data-address]').forEach((el) => { el.textContent = `${BRAND.address.street}, ${BRAND.address.city}`; });
}
