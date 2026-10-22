/**
 * Devis · récapitulatif en tiroir sur mobile / tablette (< 64rem) et barre basse .quote-mobilebar (agent quote-ui).
 * Bureau : le récapitulatif est une colonne collante, rien à faire.
 * Mobile : tiroir = boîte de dialogue modale (focus piégé, Échap, voile, glisser vers le bas pour fermer),
 * la barre basse n'apparaît que lorsque le configurateur est à l'écran.
 */
import { gsap, reducedMotion, stopScroll, startScroll } from '../core/motion.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function initDrawer(root) {
  const summary = root.querySelector('[data-summary]');
  const sheet = summary.querySelector('.quote-summary__sheet');
  const bar = root.querySelector('[data-mobilebar]');
  const scrim = root.querySelector('[data-scrim]');
  const openBtn = bar.querySelector('[data-drawer-open]');
  const closeBtn = summary.querySelector('[data-drawer-close]');
  const mq = window.matchMedia('(min-width: 64rem)');
  let open = false;
  let inView = false;
  let opener = null;

  sheet.setAttribute('data-lenis-prevent', '');

  const isDrawer = () => !mq.matches;

  function applyMode() {
    if (isDrawer()) {
      summary.classList.add('is-drawer');
      if (!open) summary.inert = true;
      bar.hidden = false;
    } else {
      if (open) close({ restore: false });
      summary.classList.remove('is-drawer', 'is-open');
      summary.inert = false;
      summary.removeAttribute('role');
      summary.removeAttribute('aria-modal');
      bar.hidden = true;
    }
    syncBar();
  }

  function syncBar() {
    const show = isDrawer() && inView && !open;
    bar.classList.toggle('is-visible', show);
    document.documentElement.classList.toggle('has-quote-bar', isDrawer() && inView);
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...summary.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openDrawer(from) {
    if (!isDrawer() || open) return;
    open = true;
    opener = from || document.activeElement;
    summary.inert = false;
    summary.setAttribute('role', 'dialog');
    summary.setAttribute('aria-modal', 'true');
    summary.classList.add('is-open');
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('is-visible'));
    openBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('quote-lock');
    stopScroll();
    document.addEventListener('keydown', onKey);
    syncBar();
    sheet.scrollTop = 0;
    setTimeout(() => closeBtn.focus({ preventScroll: true }), reducedMotion ? 0 : 80);
  }

  function close({ restore = true } = {}) {
    if (!open) return;
    open = false;
    summary.classList.remove('is-open');
    summary.removeAttribute('role');
    summary.removeAttribute('aria-modal');
    scrim.classList.remove('is-visible');
    setTimeout(() => { if (!open) scrim.hidden = true; }, reducedMotion ? 0 : 380);
    openBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('quote-lock');
    startScroll();
    document.removeEventListener('keydown', onKey);
    gsap.set(sheet, { clearProps: 'transform' });
    if (isDrawer()) setTimeout(() => { if (!open) summary.inert = true; }, reducedMotion ? 0 : 420);
    syncBar();
    if (restore && opener && opener.isConnected) opener.focus({ preventScroll: true });
  }

  openBtn.addEventListener('click', () => openDrawer(openBtn));
  closeBtn.addEventListener('click', () => close());
  scrim.addEventListener('click', () => close());

  // Glisser vers le bas pour fermer (poignée et en-tête).
  const handle = summary.querySelector('.quote-summary__head');
  const grip = summary.querySelector('.quote-summary__grip');
  let drag = null;
  const startDrag = (e) => {
    if (!open || e.target.closest('button, a')) return;
    drag = { y0: e.clientY, dy: 0, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    sheet.classList.add('is-dragging');
  };
  const moveDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = Math.max(0, e.clientY - drag.y0);
    sheet.style.transform = `translateY(${drag.dy}px)`;
  };
  const endDrag = () => {
    if (!drag) return;
    const { dy } = drag;
    drag = null;
    sheet.classList.remove('is-dragging');
    if (dy > 90) close();
    else gsap.to(sheet, { y: 0, duration: 0.35, ease: 'ice', clearProps: 'transform' });
  };
  for (const h of [handle, grip]) {
    h.addEventListener('pointerdown', startDrag);
    h.addEventListener('pointermove', moveDrag);
    h.addEventListener('pointerup', endDrag);
    h.addEventListener('pointercancel', endDrag);
  }

  // La barre basse n'apparaît qu'avec le configurateur à l'écran.
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) inView = en.isIntersecting;
    syncBar();
  }, { rootMargin: '-35% 0px -10% 0px' });
  io.observe(root.querySelector('.quote__layout'));

  mq.addEventListener('change', applyMode);
  applyMode();

  return { open: openDrawer, close, isDrawer, isOpen: () => open, bar };
}
