/** Petites notifications accessibles (aria-live). */
let region;
export function toast(message, { duration = 3200 } = {}) {
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.append(el);
  el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' });
  setTimeout(() => {
    el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 240, fill: 'forwards' }).onfinish = () => el.remove();
  }, duration);
}
