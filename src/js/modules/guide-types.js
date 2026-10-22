/**
 * Guide — les 7 types de glace (agent guide).
 * - Prix et libellés des produits Le Glaceur relus depuis config.js (SKUS) : la page reste exacte si un prix change.
 * - « Ajouter au devis » : panier partagé (core/quote-store), cristal qui vole jusqu'au badge du devis, notification.
 * - Bureau (≥ 1000 px de large, ≥ 760 px de haut) : fiches empilées en sticky ; la fiche recouverte recule et se givre.
 * - Apparition : le spécimen « cristallise », la jauge de fonte se remplit.
 */
import { gsap, ScrollTrigger, reducedMotion } from '../core/motion.js';
import { SKUS } from '../config.js';
import { addQty } from '../core/quote-store.js';
import { toast } from '../core/toast.js';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const money = (n) => `${nf.format(n).replace(/[  ]/g, ' ')} F`;

function flyToBadge(from) {
  const badge = [...document.querySelectorAll('[data-quote-badge]')].find((b) => b.getClientRects().length && b.offsetParent !== null);
  if (!badge || reducedMotion) return;
  const a = from.getBoundingClientRect();
  const b = badge.getBoundingClientRect();
  const gem = document.createElement('span');
  gem.className = 'g-gem';
  gem.setAttribute('aria-hidden', 'true');
  document.body.append(gem);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  gsap.set(gem, { x: x0, y: y0, xPercent: -50, yPercent: -50 });
  gsap.timeline({ onComplete: () => gem.remove() })
    .to(gem, {
      duration: 0.9, ease: 'power2.inOut',
      motionPath: { path: [{ x: x0, y: y0 }, { x: (x0 + x1) / 2 + 60, y: Math.min(y0, y1) - 120 }, { x: x1, y: y1 }], curviness: 1.2 },
      rotation: 540,
    })
    .to(gem, { scale: 0.2, opacity: 0, duration: 0.25 }, '-=0.15');
}

export default function init(el) {
  // 1. Prix et libellés depuis config.js
  el.querySelectorAll('[data-g-price]').forEach((n) => {
    const v = SKUS[n.dataset.gPrice];
    if (v) n.textContent = money(v.price);
  });
  el.querySelectorAll('[data-g-label]').forEach((n) => {
    const v = SKUS[n.dataset.gLabel];
    if (v) n.textContent = v.label;
  });

  // 2. Ajout au devis
  el.querySelectorAll('[data-g-add]').forEach((btn) => {
    const v = SKUS[btn.dataset.gAdd];
    if (!v || !v.product.available) { btn.disabled = true; return; }
    btn.addEventListener('click', () => {
      addQty(v.sku, 1);
      flyToBadge(btn);
      toast(`${v.product.name} (${v.label.toLowerCase()}) ajouté à votre devis.`);
      btn.classList.remove('is-added');
      void btn.offsetWidth;
      btn.classList.add('is-added');
    });
  });

  if (reducedMotion) return;

  // 3. Apparitions
  el.querySelectorAll('[data-g-type]').forEach((card) => {
    const spec = card.querySelector('.g-type__specimen svg');
    const halo = card.querySelector('.g-type__halo');
    const fill = card.querySelector('[data-g-melt]');
    const facts = card.querySelectorAll('.g-type__fact, .g-offer, .g-safety');
    const tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 78%', once: true } });
    tl.from(spec, { scale: 0.55, rotation: -14, y: 40, opacity: 0, filter: 'blur(10px)', duration: 1.4, ease: 'back.out(1.3)' })
      .from(halo, { scale: 0.4, opacity: 0, duration: 1.6 }, 0)
      .from(fill, { scaleX: 0, duration: 1.4, ease: 'power3.out' }, 0.3)
      .from(facts, { y: 26, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.2);
  });

  // 4. Pile de fiches (bureau) : la fiche recouverte recule et se voile de givre.
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1000px) and (min-height: 760px)', () => {
    const cards = [...el.querySelectorAll('[data-g-type]')];
    cards.slice(0, -1).forEach((card, i) => {
      const inner = card.querySelector('.g-type__card');
      gsap.to(inner, {
        scale: 0.94, '--veil': 1, ease: 'none',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 30%', scrub: true },
      });
    });
    ScrollTrigger.refresh();
  });

  // Flottement doux du spécimen (pausé hors écran)
  el.querySelectorAll('.g-type__specimen svg').forEach((svg, i) => {
    const t = gsap.to(svg, { y: -8, rotation: i % 2 ? 2.5 : -2.5, duration: 3 + (i % 3) * 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut', paused: true });
    ScrollTrigger.create({ trigger: svg, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? t.play() : t.pause()) });
  });
}
