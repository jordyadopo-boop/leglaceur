/**
 * En-tête commun (agent chrome).
 *  - liens « index.html#x » → « #x » sur l'accueil (défilement fluide), liens absolus sur la page 404 ;
 *  - verre givré au défilement, ton clair / fumé selon la section située sous la barre, masquage directionnel ;
 *  - lien actif selon la section visible (accueil), aria-current sur Guide / Mon devis ;
 *  - pastille de glace qui suit le survol ; badge du devis (quote:change) avec rebond givré ;
 *  - menu mobile plein écran : piège du focus, Échap, inert, stopScroll/startScroll ;
 *  - émet 'preloader:done' sur les pages sans préchargeur.
 */
import { gsap, ScrollTrigger, reducedMotion, getLenis, stopScroll, startScroll } from '../core/motion.js';
import { computeTotals } from '../core/quote-store.js';
import { waLink, telLink } from '../core/whatsapp.js';
import { BRAND } from '../config.js';

const DESKTOP = window.matchMedia('(min-width: 1080px)');
const HOME_SECTIONS = ['produits', 'commande', 'qualite', 'livraison', 'contact'];
const BASE = import.meta.env.BASE_URL || '/';
const isRelative = (h) => !!h && !/^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(h);

export default function init(header, ctx) {
  const html = document.documentElement;
  const page = ctx?.page || document.body.dataset.page || 'home';
  const isHome = page === 'home';

  const nav = header.querySelector('.site-header__nav');
  const pill = header.querySelector('.site-header__pill');
  const burger = header.querySelector('.site-header__burger');
  const menu = header.querySelector('.site-header__menu');
  const quote = header.querySelector('[data-header-quote]');
  const navLinks = [...header.querySelectorAll('.site-header__link')];
  const menuLinks = [...header.querySelectorAll('.site-header__menu-link')];

  fillFromConfig(header);
  localizeLinks(header, page);

  /* ---------- État de la barre : verre, ton, compact, masquage ---------- */
  const state = { glass: null, tone: null, hidden: false, compact: null, menu: false, lastY: window.scrollY, acc: 0 };
  const toneCache = new WeakMap();
  let hoverLink = null; // lien survolé (pastille), déclaré tôt : setActive() peut appeler placePill() dès l'init

  function bgTone(el) {
    const cs = getComputedStyle(el);
    if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') return null;
    const opaque = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return true;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return (parts[3] ?? 1) >= 0.55;
    };
    let colors = [];
    const img = cs.backgroundImage;
    if (img && img !== 'none' && img.includes('gradient')) colors = (img.match(/rgba?\([^)]+\)|#[\da-f]{3,8}\b/gi) || []).filter(opaque);
    if (!colors.length && opaque(cs.backgroundColor) && cs.backgroundColor !== 'transparent') colors = [cs.backgroundColor];
    if (!colors.length) return null;
    const lum = colors.reduce((a, c) => a + luminance(c), 0) / colors.length;
    return lum < 0.3 ? 'dark' : 'light';
  }

  function toneOf(el) {
    for (let n = el; n && n !== document.body && n !== html; n = n.parentElement) {
      let t = toneCache.get(n);
      if (t === undefined) {
        const ds = n.dataset?.headerTone;
        if (ds === 'dark' || ds === 'light') t = ds;
        else if (n.classList.contains('section--dark') || n.classList.contains('site-footer')) t = 'dark';
        else t = bgTone(n);
        toneCache.set(n, t);
      }
      if (t) return t;
    }
    return bgTone(document.body) || 'light';
  }

  function detectTone() {
    const y = Math.round(header.offsetHeight / 2);
    const xs = [window.innerWidth * 0.5, window.innerWidth * 0.18];
    for (const x of xs) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (header.contains(el) || el.closest('.preloader, .fab, .toast-region')) continue;
        return toneOf(el);
      }
    }
    return 'light';
  }

  function set(cls, on) { header.classList.toggle(cls, on); }

  function update() {
    const y = Math.max(0, window.scrollY);
    const dy = y - state.lastY;
    state.lastY = y;

    let tone;
    let glass;
    if (state.menu) { tone = 'light'; glass = false; }
    else if (!isHome && y < 24) { tone = 'light'; glass = true; }
    else { tone = detectTone(); glass = y > 24; }
    if (tone !== state.tone) { state.tone = tone; header.dataset.tone = tone; }
    if (glass !== state.glass) { state.glass = glass; set('is-glass', glass); }

    const compact = y > 80;
    if (compact !== state.compact) { state.compact = compact; set('is-compact', compact); requestAnimationFrame(() => placePill(true)); }

    // masquage directionnel (en descendant) / retour (en remontant)
    const hideFrom = Math.max(window.innerHeight * 0.55, 320);
    if (Math.sign(dy) !== Math.sign(state.acc)) state.acc = 0;
    state.acc += dy;
    let hidden = state.hidden;
    if (state.menu || y < hideFrom || header.contains(document.activeElement) && document.activeElement !== document.body) hidden = false;
    else if (state.acc > 14) hidden = true;
    else if (state.acc < -10) hidden = false;
    if (hidden !== state.hidden) { state.hidden = hidden; set('is-hidden', hidden); }
  }

  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('app:ready', requestUpdate);
  window.addEventListener('preloader:done', requestUpdate);
  header.addEventListener('focusin', () => { if (state.hidden) { state.hidden = false; set('is-hidden', false); } });
  const reveal = () => { state.acc = 0; if (state.hidden) { state.hidden = false; set('is-hidden', false); } };
  update();

  /* ---------- Lien actif ---------- */
  let activeKey = null;
  function setActive(key) {
    if (key === activeKey) return;
    activeKey = key;
    for (const a of [...navLinks, ...menuLinks]) {
      if (a.dataset.nav === key) a.setAttribute('aria-current', isHome ? 'true' : 'page');
      else a.removeAttribute('aria-current');
    }
    placePill();
  }
  if (page === 'guide') requestAnimationFrame(() => setActive('guide')); // après la déclaration de DESKTOP plus bas
  if (page === 'devis' && quote) quote.setAttribute('aria-current', 'page');

  function watchSections() {
    if (!isHome || !('IntersectionObserver' in window)) return;
    const targets = HOME_SECTIONS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!targets.length) return;
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      const current = targets.filter((t) => visible.has(t)).pop();
      setActive(current ? current.id : null);
    }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });
    targets.forEach((t) => io.observe(t));
  }

  /* ---------- Pastille de glace (bureau) ---------- */
  function placePill(instant = false) {
    if (!pill || !nav) return;
    const link = hoverLink || navLinks.find((a) => a.dataset.nav === activeKey);
    if (!link || !DESKTOP.matches) {
      gsap.to(pill, { opacity: 0, duration: instant || reducedMotion ? 0 : 0.35, ease: 'ice', overwrite: 'auto' });
      return;
    }
    const nr = nav.getBoundingClientRect();
    const lr = link.getBoundingClientRect();
    const wasHidden = Number(gsap.getProperty(pill, 'opacity')) < 0.05;
    const dur = instant || reducedMotion ? 0 : 0.6;
    if (wasHidden) gsap.set(pill, { x: lr.left - nr.left, width: lr.width });
    gsap.to(pill, { x: lr.left - nr.left, width: lr.width, opacity: 1, duration: wasHidden ? Math.min(dur, 0.35) : dur, ease: 'ice', overwrite: 'auto' });
  }
  for (const a of navLinks) {
    a.addEventListener('pointerenter', () => { hoverLink = a; placePill(); });
    a.addEventListener('focus', () => { hoverLink = a; placePill(); });
    a.addEventListener('blur', () => { if (hoverLink === a) { hoverLink = null; placePill(); } });
  }
  nav?.addEventListener('pointerleave', () => { hoverLink = null; placePill(); });
  window.addEventListener('resize', () => placePill(true), { passive: true });
  document.fonts?.ready?.then(() => placePill(true));

  /* ---------- Badge du devis ---------- */
  setupBadge(header, { reveal });

  /* ---------- Menu mobile ---------- */
  if (burger && menu) {
    burger.hidden = false;
    let tl = null;
    let origin = { x: window.innerWidth - 40, y: 38 };

    const focusables = () => [...header.querySelectorAll('a[href], button:not([disabled])')]
      .filter((el) => el.getClientRects().length && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden');

    const setInert = (on) => {
      for (const el of document.body.children) {
        if (el === header || /^(SCRIPT|TEMPLATE|STYLE|LINK)$/.test(el.tagName)) continue;
        if (on && !el.inert) { el.inert = true; el.dataset.menuInert = ''; }
        if (!on && 'menuInert' in el.dataset) { el.inert = false; delete el.dataset.menuInert; }
      }
    };

    function open() {
      if (state.menu) return;
      state.menu = true;
      const r = burger.getBoundingClientRect();
      origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const R = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y)) + 24;
      menu.hidden = false;
      menu.scrollTop = 0;
      header.classList.add('is-menu-open');
      html.classList.add('menu-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Fermer le menu');
      stopScroll();
      setInert(true);
      reveal();
      update();
      tl?.kill();
      const items = menu.querySelectorAll('.site-header__menu-link');
      const lines = menu.querySelectorAll('.site-header__menu-list li');
      const cta = menu.querySelectorAll('.site-header__menu-cta > *');
      if (reducedMotion) {
        gsap.set(menu, { clipPath: 'none' });
      } else {
        tl = gsap.timeline({ defaults: { ease: 'ice' } })
          .fromTo(menu, { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }, { clipPath: `circle(${R}px at ${origin.x}px ${origin.y}px)`, duration: 0.95, ease: 'expo.inOut' })
          .fromTo(lines, { '--line': 0 }, { '--line': 1, duration: 1.1, stagger: 0.06 }, 0.3)
          .from(items, { yPercent: 70, opacity: 0, rotateX: -55, filter: 'blur(8px)', transformOrigin: '0 100%', duration: 1, stagger: 0.06, clearProps: 'filter' }, 0.28)
          .from(cta, { y: 26, opacity: 0, duration: 0.9, stagger: 0.07 }, 0.55);
      }
      requestAnimationFrame(() => menu.querySelector('.site-header__menu-link')?.focus({ preventScroll: true }));
    }

    function close({ focus = true } = {}) {
      if (!state.menu) return;
      state.menu = false;
      header.classList.remove('is-menu-open');
      html.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Ouvrir le menu');
      setInert(false);
      startScroll();
      tl?.kill();
      const inner = menu.querySelector('.site-header__menu-inner');
      const done = () => { menu.hidden = true; gsap.set(menu, { clearProps: 'clipPath' }); gsap.set(inner, { clearProps: 'opacity,transform' }); };
      if (reducedMotion) done();
      else tl = gsap.timeline({ onComplete: done })
        .to(inner, { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in' }, 0)
        .to(menu, { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`, duration: 0.6, ease: 'power3.inOut' }, 0.05);
      if (focus) burger.focus({ preventScroll: true });
      requestUpdate();
    }

    burger.addEventListener('click', () => (state.menu ? close() : open()));
    menu.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (a) close({ focus: false }); // startScroll() est appelé avant le défilement fluide vers l'ancre
    });
    document.addEventListener('keydown', (e) => {
      if (!state.menu) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !header.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !header.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    });
    DESKTOP.addEventListener?.('change', (e) => { if (e.matches) close({ focus: false }); placePill(true); });
    header.addEventListener('header:close-menu', () => close({ focus: false }));
  }

  /* ---------- Intro ---------- */
  playIntro(header, isHome);

  /* ---------- Après l'initialisation de tous les modules ---------- */
  const afterReady = () => {
    localizeLinks(document, page);
    watchSections();
    placePill(true);
    requestUpdate();
    // Arrivée sur l'accueil avec une ancre (depuis une autre page) : recaler après les épinglages.
    if (isHome && location.hash.length > 1) {
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) setTimeout(() => {
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(t, { offset: -80, immediate: true, force: true });
        else t.scrollIntoView();
        ScrollTrigger.update();
      }, 140);
    }
  };
  if (html.classList.contains('is-ready')) afterReady();
  else window.addEventListener('app:ready', afterReady, { once: true });

  if (isHome) delegateHomeAnchors();
  announcePreloaderIfAbsent(html);
}

/* ===================================================================== */

function luminance(color) {
  let r, g, b;
  if (color.startsWith('#')) {
    let h = color.slice(1);
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    [r, g, b] = color.match(/[\d.]+/g).map(Number);
  }
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Numéros, liens d'appel et WhatsApp lus dans config.js (le HTML statique reste juste sans JS). */
function fillFromConfig(header) {
  const main = BRAND.phones[0];
  if (main) {
    header.querySelectorAll('[data-header-call]').forEach((a) => {
      a.href = telLink(main.tel);
      if (a.hasAttribute('aria-label')) a.setAttribute('aria-label', `Appeler Le Glaceur au ${main.display}`);
      else a.textContent = main.display;
    });
    header.querySelectorAll('[data-header-call-number]').forEach((s) => { s.textContent = main.display.replace(/^\+225\s*/, ''); });
  }
  header.querySelectorAll('[data-wa-text]').forEach((a) => { a.href = waLink(a.dataset.waText); });
}

/** Accueil : « index.html#x » → « #x ». Page 404 : liens relatifs → absolus (base du déploiement). */
function localizeLinks(root, page) {
  if (page === 'home') {
    root.querySelectorAll('a[href^="index.html#"]').forEach((a) => { a.setAttribute('href', a.getAttribute('href').slice(10)); });
    root.querySelectorAll('a[href="index.html"]').forEach((a) => { a.setAttribute('href', '#'); a.dataset.toTop = ''; });
  } else if (page === 'notfound') {
    const scope = root === document ? document.querySelectorAll('.site-header, .site-footer') : [root];
    scope.forEach((s) => s.querySelectorAll('a[href]').forEach((a) => {
      const h = a.getAttribute('href');
      if (isRelative(h)) a.setAttribute('href', BASE + h);
    }));
  }
}

/** Liens ajoutés plus tard par d'autres modules : défilement fluide vers l'ancre, sans recharger l'accueil. */
function delegateHomeAnchors() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    const lenis = getLenis();
    if (href === '#' && 'toTop' in a.dataset) {
      e.preventDefault();
      if (lenis) lenis.scrollTo(0, { force: true }); else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    if (!href.startsWith('index.html#')) return;
    const id = href.slice(11);
    const t = id && document.getElementById(decodeURIComponent(id));
    if (!t) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { offset: -80, force: true }); else t.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    history.replaceState(null, '', `#${id}`);
  });
}

function announcePreloaderIfAbsent(html) {
  if (document.querySelector('[data-module~="preloader"]')) return;
  window.__lgPreloaderDone = true;
  html.classList.add('preloader-done');
  const fire = () => window.dispatchEvent(new Event('preloader:done'));
  if (html.classList.contains('is-ready')) fire();
  else window.addEventListener('app:ready', fire, { once: true });
}

/** Exécute cb quand le préchargeur a fini (ou tout de suite s'il est absent / sauté). */
function whenPreloaderDone(cb) {
  const html = document.documentElement;
  const pre = document.querySelector('.preloader');
  if (!pre || window.__lgPreloaderDone || !html.classList.contains('preload') || html.classList.contains('preloader-done')) { cb(); return; }
  let called = false;
  const go = () => { if (!called) { called = true; cb(); } };
  window.addEventListener('preloader:done', go, { once: true });
  setTimeout(go, 5000);
}

function playIntro(header, isHome) {
  if (reducedMotion) return;
  const q = (s) => [...header.querySelectorAll(s)];
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'ice' } });
  const word = q('.site-header__brand .brand-logo__word');
  const cube = q('.site-header__brand .lg-cube');
  const leaf = q('.site-header__brand .lg-leaf');
  const wave = q('.site-header__brand .lg-wave');
  const glint = q('.site-header__brand .lg-glint');
  const links = q('.site-header__list > li');
  const actions = q('.site-header__actions > :not([hidden])');
  tl.from(q('.site-header__brand'), { y: -20, opacity: 0, duration: 0.9, clearProps: 'transform,opacity' }, 0)
    .from(word, { x: -14, opacity: 0, duration: 1, clearProps: 'transform,opacity' }, 0.1)
    .from(cube, { y: -90, rotation: -12, opacity: 0, transformOrigin: '50% 100%', duration: 1, ease: 'back.out(2.2)', clearProps: 'transform,opacity' }, 0.15)
    .from(wave, { x: -40, opacity: 0, duration: 0.9, clearProps: 'transform,opacity' }, 0.3)
    .from(leaf, { scale: 0, rotation: -50, transformOrigin: '0% 100%', duration: 0.9, ease: 'back.out(2.6)', clearProps: 'transform' }, 0.5)
    .fromTo(glint, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1.2, transformOrigin: '50% 50%', duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1, clearProps: 'transform,opacity' }, 0.85)
    .from(links, { y: -16, opacity: 0, duration: 0.8, stagger: 0.05, clearProps: 'transform,opacity' }, 0.15)
    .from(actions, { y: -16, opacity: 0, scale: 0.9, duration: 0.8, stagger: 0.07, clearProps: 'transform,opacity' }, 0.3);
  if (isHome) whenPreloaderDone(() => tl.play());
  else tl.play();
}

function setupBadge(header, { reveal }) {
  const quote = header.querySelector('[data-header-quote]');
  const badge = header.querySelector('[data-quote-badge]');
  const sr = header.querySelector('[data-quote-sr]');
  const menuCount = header.querySelector('[data-quote-count]');
  if (!badge) return;
  const label = (n) => (n > 99 ? '99+' : String(n));
  let current = safeCount();

  const render = (n) => {
    badge.dataset.count = String(n);
    if (sr) sr.textContent = n ? `, ${n} article${n > 1 ? 's' : ''}` : ', aucun article pour l’instant';
    if (menuCount) { menuCount.hidden = !n; menuCount.textContent = label(n); }
    quote?.setAttribute('title', n ? `Mon devis : ${n} article${n > 1 ? 's' : ''}` : 'Mon devis');
  };
  badge.querySelector('.site-header__badge-num').textContent = label(current);
  render(current);

  window.addEventListener('quote:change', () => {
    const n = safeCount();
    if (n === current) return;
    const prev = current;
    current = n;
    render(n);
    if (reducedMotion) { badge.querySelector('.site-header__badge-num').textContent = label(n); return; }
    reveal();
    odometer(badge, label(n), n > prev ? 1 : -1);
    if (n > 0) frostBurst(quote, badge, n > prev);
  });
}

function safeCount() {
  try { return computeTotals().count || 0; } catch { return 0; }
}

function odometer(badge, text, dir) {
  const olds = [...badge.querySelectorAll('.site-header__badge-num')];
  const next = document.createElement('span');
  next.className = 'site-header__badge-num';
  next.textContent = text;
  badge.append(next);
  gsap.fromTo(next, { yPercent: 110 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, ease: 'back.out(2)' });
  olds.forEach((o) => gsap.to(o, { yPercent: -110 * dir, opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => o.remove() }));
}

/** Petit rebond givré : le badge saute, une onde de givre s'étend, des éclats de cristal jaillissent. */
function frostBurst(quote, badge, up) {
  gsap.timeline()
    .fromTo(badge, { scale: 1 }, { scale: up ? 1.55 : 0.75, duration: 0.16, ease: 'power2.out' })
    .to(badge, { scale: 1, duration: 0.9, ease: 'elastic.out(1.1, 0.35)' });
  if (!quote || !up) return;
  gsap.fromTo(quote, { filter: 'brightness(1)' }, { filter: 'brightness(1.25)', duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out', clearProps: 'filter' });
  const ring = document.createElement('span');
  ring.className = 'site-header__ring';
  ring.setAttribute('aria-hidden', 'true');
  quote.append(ring);
  gsap.fromTo(ring, { scale: 0.4, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.85, ease: 'power2.out', onComplete: () => ring.remove() });
  const n = 8;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'site-header__spark';
    s.setAttribute('aria-hidden', 'true');
    quote.append(s);
    const a = (-Math.PI / 2) + (i / n) * Math.PI * 2 + gsap.utils.random(-0.25, 0.25);
    const d = gsap.utils.random(20, 38);
    gsap.fromTo(s, { x: 0, y: 0, rotation: 45, scale: gsap.utils.random(0.6, 1.1), opacity: 1 }, {
      x: Math.cos(a) * d, y: Math.sin(a) * d, rotation: 45 + gsap.utils.random(-120, 120), scale: 0, opacity: 0,
      duration: gsap.utils.random(0.6, 0.9), ease: 'power3.out', onComplete: () => s.remove(),
    });
  }
}
