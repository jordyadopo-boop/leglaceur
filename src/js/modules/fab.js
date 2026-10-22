/**
 * Bouton flottant WhatsApp (agent chrome).
 *  - lien wa.me prérempli depuis config.js ;
 *  - entrée « glaçon qui se pose » après le préchargeur, puis pulsation ;
 *  - le libellé se déploie une fois tout seul (une fois par session), puis au survol / focus ;
 *  - se retire derrière la barre récapitulative de la page devis (.quote-mobilebar.is-visible).
 */
import { gsap, reducedMotion } from '../core/motion.js';
import { waLink } from '../core/whatsapp.js';

const PEEK_KEY = 'lg:fab-peek';

export default function init(fab, ctx) {
  fab.href = waLink(fab.dataset.waText || '');

  // Page devis : ne jamais masquer la barre récapitulative mobile (repli si :has() n'est pas pris en charge).
  if ((ctx?.page || document.body.dataset.page) === 'devis') watchQuoteBar(fab);

  const start = () => {
    if (!reducedMotion) {
      gsap.from(fab.querySelector('.fab__btn'), {
        scale: 0, rotation: -140, opacity: 0, duration: 1.2, ease: 'elastic.out(1, 0.55)', delay: 0.6, clearProps: 'all',
        onComplete: () => fab.classList.add('is-live'),
      });
    } else fab.classList.add('is-live');
    peekOnce(fab);
  };
  whenPreloaderDone(start);

  // Libellé ouvert au toucher long / clavier : géré en CSS (:hover, :focus-visible). Sur mobile, un tap ouvre WhatsApp directement.
}

function peekOnce(fab) {
  let seen = false;
  try { seen = !!sessionStorage.getItem(PEEK_KEY); } catch { /* stockage indisponible */ }
  if (seen) return;
  const open = () => {
    try { sessionStorage.setItem(PEEK_KEY, '1'); } catch { /* idem */ }
    fab.classList.add('is-open');
    setTimeout(() => fab.classList.remove('is-open'), 3600);
  };
  // après un premier défilement (le visiteur est engagé) ou au bout de 6 s
  let timer = setTimeout(go, 6000);
  function go() {
    clearTimeout(timer);
    window.removeEventListener('scroll', onScroll);
    if (!document.hidden) open();
  }
  function onScroll() { if (window.scrollY > window.innerHeight * 0.6) { timer = setTimeout(go, 400); window.removeEventListener('scroll', onScroll); } }
  window.addEventListener('scroll', onScroll, { passive: true });
}

function watchQuoteBar(fab) {
  if (CSS.supports?.('selector(:has(a))')) return;
  const sync = () => {
    const bar = document.querySelector('.quote-mobilebar');
    fab.classList.toggle('is-away', !!bar && bar.classList.contains('is-visible') && !bar.hidden);
  };
  const attach = () => {
    const bar = document.querySelector('.quote-mobilebar');
    if (!bar) return;
    new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ['class', 'hidden'] });
    sync();
  };
  if (document.documentElement.classList.contains('is-ready')) attach();
  else window.addEventListener('app:ready', attach, { once: true });
}

function whenPreloaderDone(cb) {
  const html = document.documentElement;
  if (window.__lgPreloaderDone || !html.classList.contains('preload') || html.classList.contains('preloader-done')) {
    if (html.classList.contains('is-ready')) cb();
    else window.addEventListener('app:ready', cb, { once: true });
    return;
  }
  let called = false;
  const go = () => { if (!called) { called = true; cb(); } };
  window.addEventListener('preloader:done', go, { once: true });
  setTimeout(go, 5000);
}
