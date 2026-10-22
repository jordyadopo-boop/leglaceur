/**
 * Pied de page « nuit polaire » (agent chrome).
 *  - complète / vérifie le HTML statique depuis config.js (produits, numéros, e-mail, adresse, horaires, livraison) ;
 *  - année automatique ; lien « Haut de page » en défilement fluide ;
 *  - décor animé (stalactites qui fondent, aurores) seulement quand le pied de page est visible et l'onglet actif ;
 *  - entrée orchestrée : colonnes qui se posent, signature géante qui « gèle » lettre par lettre, reflet qui suit le pointeur.
 */
import { gsap, SplitText, reducedMotion, finePointer, getLenis } from '../core/motion.js';
import { BRAND, PRODUCTS, DELIVERY, mapsUrl } from '../config.js';
import { waLink, telLink } from '../core/whatsapp.js';

export default function init(footer) {
  fillFromConfig(footer);
  setupTopLink(footer);
  watchVisibility(footer);
  if (reducedMotion) return;
  intro(footer);
  if (finePointer) pointerLight(footer);
}

function fillFromConfig(footer) {
  footer.querySelectorAll('[data-sf-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // Produits : ordre, noms et disponibilité lus dans PRODUCTS (le HTML statique sert de repli).
  const list = footer.querySelector('[data-sf-products]');
  if (list) {
    const existing = new Map([...list.querySelectorAll('a[data-sku-product]')].map((a) => [a.dataset.skuProduct, a.closest('li')]));
    const frag = document.createDocumentFragment();
    for (const p of PRODUCTS) {
      let li = existing.get(p.id);
      if (!li) {
        li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `${document.body.dataset.page === 'home' ? '' : 'index.html'}#produit-${p.id}`;
        a.dataset.skuProduct = p.id;
        li.append(a);
      }
      const a = li.querySelector('a');
      const badge = a.querySelector('.site-footer__new');
      const label = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (label) label.textContent = `${p.name}${badge ? ' ' : ''}`;
      else a.prepend(document.createTextNode(`${p.name}${badge ? ' ' : ''}`));
      if (!p.available && !a.querySelector('.site-footer__new--soon')) {
        badge?.remove();
        a.append(' ');
        const s = document.createElement('span');
        s.className = 'site-footer__new site-footer__new--soon';
        s.textContent = 'Bientôt';
        a.append(s);
      }
      frag.append(li);
    }
    list.replaceChildren(frag);
  }

  // Téléphones
  const phones = footer.querySelector('[data-sf-phones]');
  if (phones && BRAND.phones?.length) {
    const items = [...phones.querySelectorAll('li')];
    BRAND.phones.forEach((ph, i) => {
      let li = items[i];
      if (!li) {
        li = items[0].cloneNode(true);
        phones.append(li);
      }
      const a = li.querySelector('a');
      a.href = telLink(ph.tel);
      a.querySelector('small').textContent = ph.label;
      a.querySelector('span').textContent = ph.display;
    });
    items.slice(BRAND.phones.length).forEach((li) => li.remove());
  }

  const mail = footer.querySelector('[data-sf-mail]');
  if (mail && BRAND.email) { mail.href = `mailto:${BRAND.email}`; mail.textContent = BRAND.email; }
  const maps = footer.querySelector('[data-sf-maps]');
  if (maps) maps.href = mapsUrl;
  const street = footer.querySelector('[data-sf-street]');
  if (street) street.textContent = BRAND.address.street;
  const hours = footer.querySelector('[data-sf-hours]');
  if (hours) hours.textContent = BRAND.hours;
  const free = footer.querySelector('[data-sf-free]');
  if (free) free.textContent = DELIVERY.freeLabel.replace(/ (\d+) /, ' $1 ');
  footer.querySelectorAll('[data-wa-text]').forEach((a) => { a.href = waLink(a.dataset.waText); });
}

function setupTopLink(footer) {
  const link = footer.querySelector('[data-sf-top]');
  if (!link) return;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0, { force: true, duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    const target = document.querySelector('.site-header__brand') || document.querySelector('#contenu');
    target?.focus({ preventScroll: true });
  });
}

/** Les animations CSS du décor ne tournent que si le pied de page est à l'écran et l'onglet visible. */
function watchVisibility(footer) {
  let inView = false;
  const apply = () => footer.classList.toggle('is-inview', inView && !document.hidden);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; apply(); }, { rootMargin: '120px 0px' }).observe(footer);
  } else { inView = true; }
  document.addEventListener('visibilitychange', apply);
  apply();
}

function intro(footer) {
  const st = { trigger: footer, start: 'top 82%', once: true };
  const tl = gsap.timeline({ scrollTrigger: st, defaults: { ease: 'ice' } });

  tl.from(footer.querySelectorAll('.site-footer__icicle'), {
    scaleY: 0.2, opacity: 0, duration: 1.4, stagger: { each: 0.008, from: 'random' }, clearProps: 'transform,opacity',
  }, 0);

  const blocks = footer.querySelectorAll('[data-sf-reveal]');
  blocks.forEach((b, i) => {
    const kids = b.matches('nav') ? b.querySelectorAll('.site-footer__title, .site-footer__list li') : b.children;
    tl.from(kids, { y: 34, opacity: 0, filter: 'blur(6px)', duration: 1.1, stagger: 0.045, clearProps: 'filter,transform,opacity' }, 0.15 + i * 0.12);
  });

  const word = footer.querySelector('[data-sf-word]');
  if (word) {
    const inner = word.firstElementChild;
    const split = SplitText.create(inner, { type: 'chars', charsClass: 'sf-char' });
    word.classList.add('is-split');
    gsap.from(split.chars, {
      yPercent: 70, opacity: 0, scaleY: 1.25, filter: 'blur(14px)', transformOrigin: '50% 100%',
      duration: 1.6, ease: 'ice', stagger: { each: 0.06, from: 'center' }, clearProps: 'filter',
      scrollTrigger: { trigger: word, start: 'top 95%', once: true },
    });
  }
}

/** Reflet glacé qui suit le pointeur sur la signature géante. */
function pointerLight(footer) {
  const word = footer.querySelector('[data-sf-word]');
  if (!word) return;
  let raf = 0;
  let px = 0;
  let py = 0;
  footer.addEventListener('pointermove', (e) => {
    px = e.clientX;
    py = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = word.getBoundingClientRect();
      for (const el of word.querySelectorAll('.sf-char, :scope > span')) {
        const cr = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${px - cr.left}px`);
        el.style.setProperty('--my', `${py - cr.top}px`);
      }
      word.style.setProperty('--hover', r.top < window.innerHeight ? '1' : '0');
    });
  }, { passive: true });
}
