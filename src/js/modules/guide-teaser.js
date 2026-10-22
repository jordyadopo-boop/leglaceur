/**
 * « Chaque glace a son usage » (agent convert-b) — sélecteur « Quelle glace pour… ? ».
 * - Les 6 usages (USAGES) relient un besoin à une glace du guide (ICE_TYPES) et à un produit Le Glaceur (PRODUCTS).
 *   Le HTML statique du partiel est produit par renderBody() (même gabarit) ; au chargement, chaque fiche est
 *   re-rendue depuis config.js pour rester exacte (prix, noms, textes).
 * - Onglets accessibles : liens → role="tab" (flèches, Début/Fin), panneaux role="tabpanel" empilés dans la même
 *   cellule de grille (aucun saut de mise en page), transition « gel » (clip-path + flou + lettres qui gèlent).
 * - Jauge « Vitesse de fonte » (role="meter") : le liquide monte, le glaçon fond, une goutte tombe ; carboglace : vapeur.
 * - « Ajouter au devis » → quote-store (addQty), cristal qui vole jusqu'au badge du devis, toast.
 * - Décor : grand cristal hexagonal tracé au défilement (DrawSVG, scrub).
 * Ce module n'importe au niveau supérieur que config.js et format.js : il est importable sous Node par le générateur.
 */
import { PRODUCTS, ICE_TYPES, SKUS } from '../config.js';

const NBSP = ' ';
const NNBSP = ' ';
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const money = (n) => `${nf.format(Math.round(n || 0))}${NBSP}F`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const typo = (s) => String(s ?? '')
  .replace(/'/g, '’')
  .replace(/(^|[\s(])-(\d)/g, '$1−$2')
  .replace(/(\d) (kg|°C|%|F\b|mm|minutes)/g, `$1${NBSP}$2`)
  .replace(/ ([;:!?»])/g, `${NNBSP}$1`)
  .replace(/« /g, `«${NNBSP}`);
const t = (s) => esc(typo(s));

const P = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const ICE = Object.fromEntries(ICE_TYPES.map((i) => [i.id, i]));
const MAX_MELT = Math.max(...ICE_TYPES.map((i) => i.meltScore));

/** Usages → glace du guide + produit Le Glaceur (+ alternative). Toutes les données viennent de config.js. */
export const USAGES = [
  { id: 'whisky', label: 'Whisky & spiritueux', photo: 'usage-whisky', photoAlt: 'Whisky versé sur un gros glaçon dans un verre bas', ice: 'plein', product: 'glacons', also: null },
  { id: 'cocktails', label: 'Cocktails', photo: 'usage-cocktail', photoAlt: 'Mojito servi sur glace pilée, avec citron vert et menthe', ice: 'pilee', product: 'pilee', also: 'grain' },
  { id: 'sodas', label: 'Sodas & jus', photo: 'usage-jus', photoAlt: 'Boissons fraîches aux fruits servies avec des glaçons', ice: 'creux', product: 'gobelet', also: 'grain' },
  { id: 'poisson', label: 'Poissonnerie', photo: 'usage-poisson', photoAlt: 'Poissons frais disposés sur un lit de glace', ice: 'pilee', product: 'pilee', also: 'barres',
    ideal: () => [...P.pilee.uses.filter((u) => /fruits de mer|poisson/i.test(u)), ...P.barres.uses.filter((u) => /pêche|marchés/i.test(u))] },
  { id: 'evenement', label: 'Événement & effets de fumée', photo: 'carboglace', photoAlt: 'Glace carbonique dégageant une épaisse brume blanche', ice: 'carbo', product: 'carboglace', also: 'glacons', danger: true },
  { id: 'conservation', label: 'Conservation & transport', photo: 'barres', photoAlt: 'Pains de glace rectangulaires empilés', ice: null, product: 'barres', also: 'carboglace',
    ideal: () => P.barres.uses },
];

/* ---------- Icônes (traits, 24×24) ---------- */
const svg = (d, cls = 'gt-ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
export const USAGE_ICONS = {
  whisky: svg('<path d="M5 6h14l-1.4 13.2a1.6 1.6 0 0 1-1.6 1.4H8a1.6 1.6 0 0 1-1.6-1.4L5 6Z"/><path d="M6 11.5h12"/><rect x="8.6" y="12.6" width="5.2" height="5.2" rx="1" transform="rotate(-8 11.2 15.2)"/>'),
  cocktails: svg('<path d="M4 4.5h16L12 13v6.5M8.5 20.5h7"/><path d="m15.5 2.5-2.6 6.4"/><circle cx="17.6" cy="6.9" r="1.6"/>'),
  sodas: svg('<path d="M6.5 7.5h11l-1.3 12.4a1.5 1.5 0 0 1-1.5 1.3H9.3a1.5 1.5 0 0 1-1.5-1.3L6.5 7.5Z"/><path d="M6 7.5h12M13 7.5l1.6-5h3"/><path d="M8.6 12.5h3.2v3.2H8.6zM12.6 14.6h2.6v2.6h-2.6z"/>'),
  poisson: svg('<path d="M2.8 12c2.4-3.6 5.6-5.4 9.2-5.4 3.2 0 5.7 1.6 7.4 3.4l2-2.2v8.4l-2-2.2c-1.7 1.8-4.2 3.4-7.4 3.4-3.6 0-6.8-1.8-9.2-5.4Z"/><circle cx="7.6" cy="11" r=".9"/><path d="M12.5 8.8c.9 1 .9 5.4 0 6.4"/>'),
  evenement: svg('<path d="M7 13.5c-2 0-3.5-1.4-3.5-3.2S5 7 7 7.2C7.6 5 9.6 3.6 12 3.6s4.4 1.4 5 3.6c2 0 3.5 1.4 3.5 3.2s-1.5 3.1-3.5 3.1"/><path d="M5 17.2c2.3 0 2.3 1.6 4.6 1.6s2.3-1.6 4.6-1.6 2.3 1.6 4.6 1.6M7.8 21c1.4 0 1.4-1 2.8-1s1.4 1 2.8 1"/>'),
  conservation: svg('<path d="M3.5 9.5h17v9.8a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4V9.5Z"/><path d="M2.6 6.2h18.8v3.3H2.6zM9 6.2V4.6a1.2 1.2 0 0 1 1.2-1.2h3.6A1.2 1.2 0 0 1 15 4.6v1.6"/><path d="M12 12.6v5.2M9.8 13.8l4.4 2.8M14.2 13.8l-4.4 2.8"/>'),
};
const ICONS = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check: svg('<path d="m5 12.5 4.2 4.2L19 7"/>'),
  warn: svg('<path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 10v4.4M12 17.2v.1"/>'),
  drop: svg('<path d="M12 3.2s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z"/>'),
};

/* ---------- Modèle d'une fiche ---------- */
export function model(u) {
  const p = P[u.product];
  const ice = u.ice ? ICE[u.ice] : null;
  const melt = ice
    ? { label: ice.melt, score: ice.meltScore }
    : { label: 'Lente et homogène', score: ICE.plein.meltScore }; // barres : « fonte lente et homogène » (config.js)
  const stats = ice
    ? [{ k: 'Température', v: ice.temp }, { k: 'Dilution', v: ice.dilution }]
    : [{ k: 'Formats', v: p.variants.map((v) => `${v.kg}${NBSP}kg`).join(' · ') }, { k: 'Fonte', v: 'Lente et homogène' }];
  const ideal = u.ideal ? u.ideal().join(', ') + '.' : ice.uses;
  return {
    ...u,
    p,
    ice,
    name: ice ? ice.name : p.name,
    alt: ice ? ice.alt : p.alias,
    lede: ice ? ice.speed : p.description,
    ideal,
    melt,
    stats,
    tip: p.safety,
    alsoP: u.also ? P[u.also] : null,
  };
}

const variantButtons = (p, small = false) => p.variants.map((v) => {
  const can = p.available;
  return `<div class="gt-buy${small ? ' gt-buy--small' : ''}">
          <p class="gt-buy__line"><span class="gt-buy__label">${t(v.label)}</span> <span class="gt-buy__price price" data-price="${v.sku}">${money(v.price)}</span></p>
          ${can ? `<button type="button" class="gt-add" data-add="${v.sku}" aria-label="Ajouter au devis : ${esc(p.name)}, ${esc(v.label)}"><span class="gt-add__ico">${ICONS.plus}</span><span class="gt-add__txt">Ajouter</span><span class="gt-add__count" data-count-for="${v.sku}" hidden></span></button>` : '<span class="badge badge--soon">Bientôt disponible</span>'}
        </div>`;
}).join('');

/** Corps HTML d'une fiche (hors photo). */
export function renderBody(u) {
  const m = model(u);
  const pct = m.melt.score === 0 ? 0 : Math.round((m.melt.score / MAX_MELT) * 100);
  const isSub = m.melt.score === 0;
  return `<p class="gt-card__kicker">Glace recommandée</p>
      <h3 class="gt-card__name"><span class="gt-card__name-main" data-gt-name>${t(m.name)}</span> <span class="gt-card__alt">${t(m.alt)}</span></h3>
      <p class="gt-card__lede">${t(m.lede)}</p>
      <div class="gt-melt${isSub ? ' gt-melt--sub' : ''}" style="--melt:${pct / 100}">
        <div class="gt-melt__head"><span class="gt-melt__k">Vitesse de fonte</span><strong class="gt-melt__v">${t(m.melt.label)}</strong></div>
        <div class="gt-melt__track" role="meter" aria-label="Vitesse de fonte" aria-valuemin="0" aria-valuemax="${MAX_MELT}" aria-valuenow="${m.melt.score}" aria-valuetext="${esc(typo(m.melt.label))}">
          <span class="gt-melt__cube" aria-hidden="true"></span>
          <span class="gt-melt__fill" aria-hidden="true"><span class="gt-melt__wave"></span></span>
          ${isSub ? '<span class="gt-melt__vapor" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : '<span class="gt-melt__drop" aria-hidden="true"></span>'}
        </div>
        <div class="gt-melt__scale" aria-hidden="true"><span>${isSub ? 'Aucune fonte' : 'Ultra-lente'}</span><span>${isSub ? 'Passe de solide à gaz' : 'Rapide'}</span></div>
      </div>
      <dl class="gt-stats">
        ${m.stats.map((s) => `<div class="gt-stat"><dt>${t(s.k)}</dt><dd>${t(s.v)}</dd></div>`).join('')}
      </dl>
      <p class="gt-card__ideal"><strong>Idéal pour${NNBSP}:</strong> ${t(m.ideal)}</p>
      <p class="gt-card__tip${m.danger ? ' gt-card__tip--danger' : ''}">${m.danger ? ICONS.warn : ICONS.drop}<span><strong>${m.danger ? 'Sécurité' : 'Conseil'}${NNBSP}:</strong> ${t(m.tip)}</span></p>
      <div class="gt-product">
        <p class="gt-product__kicker">Chez Le Glaceur</p>
        <div class="gt-product__head">
          <p class="gt-product__name">${t(m.p.name)}</p>
          <a class="gt-product__link" href="#produit-${m.p.id}">Voir le produit<span class="sr-only"> ${esc(m.p.name)}</span> ${ICONS.arrow}</a>
        </div>
        <div class="gt-product__buys">${variantButtons(m.p)}</div>
        ${m.alsoP ? `<div class="gt-also"><p class="gt-also__k">Aussi adapté${NNBSP}: <a href="#produit-${m.alsoP.id}">${t(m.alsoP.name)}</a></p>${variantButtons(m.alsoP, true)}</div>` : ''}
      </div>`;
}

/* ==========================================================================
   Comportement (navigateur uniquement)
   ========================================================================== */
export default async function init(root) {
  const [{ gsap, ScrollTrigger, SplitText, reducedMotion }, store, { toast }] = await Promise.all([
    import('../core/motion.js'),
    import('../core/quote-store.js'),
    import('../core/toast.js'),
  ]);

  const tabs = [...root.querySelectorAll('[data-gt-tab]')];
  const panels = [...root.querySelectorAll('[data-gt-panel]')];
  if (!tabs.length || tabs.length !== panels.length) return;

  // 1. Fiches re-rendues depuis config.js (au cas où les données auraient changé depuis la génération du HTML).
  for (const panel of panels) {
    const u = USAGES.find((x) => x.id === panel.dataset.gtPanel);
    const body = panel.querySelector('[data-gt-body]');
    if (u && body) body.innerHTML = renderBody(u);
  }

  // 2. Onglets accessibles.
  const list = root.querySelector('[data-gt-tabs]');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', 'Quelle glace pour… ?');
  tabs.forEach((tab, i) => {
    const panel = panels[i];
    tab.setAttribute('role', 'tab');
    tab.id ||= `gt-tab-${panel.dataset.gtPanel}`;
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.setAttribute('tabindex', '0');
  });
  root.classList.add('is-tabs');

  let current = -1;
  const puck = root.querySelector('[data-gt-puck]');

  const movePuck = (tab, instant) => {
    if (!puck) return;
    const lr = list.getBoundingClientRect();
    const r = tab.getBoundingClientRect();
    const to = { x: r.left - lr.left, y: r.top - lr.top, width: r.width, height: r.height };
    if (instant || reducedMotion) gsap.set(puck, { ...to, opacity: 1 });
    else gsap.to(puck, { ...to, opacity: 1, duration: 0.7, ease: 'ice' });
  };

  const animateMeter = (panel) => {
    const fill = panel.querySelector('.gt-melt__fill');
    const cube = panel.querySelector('.gt-melt__cube');
    const drop = panel.querySelector('.gt-melt__drop');
    const melt = parseFloat(getComputedStyle(panel.querySelector('.gt-melt')).getPropertyValue('--melt')) || 0;
    if (reducedMotion) return;
    gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'power2.out', delay: 0.25 });
    gsap.fromTo(cube, { scale: 1 }, { scale: 1 - melt * 0.45, duration: 1.4, ease: 'power2.out', delay: 0.25 });
    if (drop) gsap.fromTo(drop, { y: -6, opacity: 0 }, { y: 10, opacity: 1, duration: 0.9, ease: 'power2.in', delay: 1.2, repeat: 2, repeatDelay: 0.4,
      onComplete: () => gsap.to(drop, { opacity: 0, duration: 0.3 }) });
  };

  const activate = (i, { focus = false, instant = false } = {}) => {
    if (i === current) return;
    const prev = current;
    current = i;
    tabs.forEach((tab, k) => {
      const on = k === i;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle('is-active', on);
    });
    const inP = panels[i];
    const outP = prev >= 0 ? panels[prev] : null;
    panels.forEach((p, k) => {
      p.classList.toggle('is-active', k === i);
      if (k !== i && k !== prev) p.classList.remove('is-leaving');
    });
    if (focus) tabs[i].focus();
    movePuck(tabs[i], instant);
    if (instant || reducedMotion) {
      if (outP) outP.classList.remove('is-leaving');
      if (!instant) animateMeter(inP);
      return;
    }
    if (outP) {
      outP.classList.add('is-leaving');
      gsap.killTweensOf(outP);
      gsap.to(outP, { opacity: 0, filter: 'blur(10px)', y: -10, duration: 0.35, ease: 'power2.in',
        onComplete: () => { outP.classList.remove('is-leaving'); gsap.set(outP, { clearProps: 'opacity,filter,transform' }); } });
    }
    const media = inP.querySelector('.gt-card__media');
    const body = inP.querySelectorAll('.gt-card__body > *');
    gsap.killTweensOf([inP, media, ...body]);
    inP.classList.remove('is-leaving');
    gsap.set(inP, { clearProps: 'filter,transform' });
    const tl = gsap.timeline({ delay: outP ? 0.18 : 0 });
    tl.fromTo(inP, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out', clearProps: 'opacity' })
      .fromTo(media, { clipPath: 'inset(100% 0% 0% 0% round 28px)', filter: 'blur(14px) saturate(0.4) brightness(1.4)' },
        { clipPath: 'inset(0% 0% 0% 0% round 28px)', filter: 'blur(0px) saturate(1) brightness(1)', duration: 1.1, ease: 'ice', clearProps: 'clipPath,filter' }, 0)
      .fromTo(body, { y: 22, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, stagger: 0.05, ease: 'ice', clearProps: 'filter,transform,opacity' }, 0.1);
    const name = inP.querySelector('[data-gt-name]');
    if (name && SplitText) {
      const split = SplitText.create(name, { type: 'chars', charsClass: 'gt-char' });
      tl.from(split.chars, { yPercent: 60, opacity: 0, rotate: 8, filter: 'blur(5px)', duration: 0.8, stagger: 0.022, ease: 'ice',
        onComplete: () => split.revert() }, 0.15);
    }
    animateMeter(inP);
  };

  // Lien d'ancre (#gt-…) ou premier usage.
  const fromHash = panels.findIndex((p) => `#${p.id}` === location.hash);
  activate(fromHash >= 0 ? fromHash : 0, { instant: true });

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', (e) => { e.preventDefault(); activate(i); });
    tab.addEventListener('keydown', (e) => {
      const n = tabs.length;
      const map = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      activate((map[e.key] + n) % n, { focus: true });
    });
  });

  const ro = new ResizeObserver(() => movePuck(tabs[current], true));
  ro.observe(list);

  // 3. Ajout au devis (délégation).
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const v = SKUS[btn.dataset.add];
    if (!v) return;
    store.addQty(v.sku, 1);
    btn.classList.remove('is-added');
    void btn.offsetWidth;
    btn.classList.add('is-added');
    flyToQuote(btn, gsap, reducedMotion);
    toast(`Ajouté à votre devis${NNBSP}: ${v.product.name}, ${v.label.toLowerCase()}`);
  });
  const syncCounts = () => {
    const lines = store.getState().lines;
    root.querySelectorAll('[data-count-for]').forEach((el) => {
      const q = lines[el.dataset.countFor] || 0;
      el.hidden = q === 0;
      el.textContent = q ? `×${q}` : '';
      el.closest('.gt-add')?.classList.toggle('has-qty', q > 0);
    });
  };
  syncCounts();
  window.addEventListener('quote:change', syncCounts);

  // 4. Entrée en scène + décor.
  if (reducedMotion) return;
  const stage = root.querySelector('.gt-stage');
  gsap.from(tabs, { y: 30, opacity: 0, filter: 'blur(6px)', duration: 0.9, stagger: 0.07, ease: 'ice', clearProps: 'filter',
    scrollTrigger: { trigger: list, start: 'top 88%', once: true }, onComplete: () => movePuck(tabs[current], true) });
  if (puck) gsap.from(puck, { scale: 0.6, opacity: 0, duration: 0.8, delay: 0.5, ease: 'back.out(2)', scrollTrigger: { trigger: list, start: 'top 88%', once: true } });
  const card = panels[current];
  gsap.from(card.querySelector('.gt-card__media'), { clipPath: 'inset(100% 0% 0% 0% round 28px)', duration: 1.4, ease: 'ice', clearProps: 'clipPath',
    scrollTrigger: { trigger: stage, start: 'top 80%', once: true, onEnter: () => animateMeter(panels[current]) } });

  const crystal = root.querySelector('[data-gt-crystal]');
  if (crystal) {
    const paths = crystal.querySelectorAll('path, line, polyline');
    gsap.set(paths, { drawSVG: '0%' });
    gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 85%', end: 'bottom 30%', scrub: 1.2 } })
      .to(paths, { drawSVG: '100%', stagger: 0.04, ease: 'none', duration: 1 })
      .fromTo(crystal, { rotate: -25 }, { rotate: 20, ease: 'none', duration: 1.6 }, 0);
  }
  window.addEventListener('app:ready', () => ScrollTrigger.refresh(), { once: true });
}

/* Cristal qui vole jusqu'au badge du devis (en-tête). */
function flyToQuote(from, gsap, reduced) {
  if (reduced || document.hidden) return;
  const badge = document.querySelector('[data-quote-badge]');
  const r = from.getBoundingClientRect();
  const sx = r.left + r.width / 2;
  const sy = r.top + r.height / 2;
  let ex = innerWidth - 40;
  let ey = 36;
  const rb = badge?.getBoundingClientRect();
  if (rb && rb.width > 2 && rb.bottom > 0 && rb.top < innerHeight) { ex = rb.left + rb.width / 2; ey = rb.top + rb.height / 2; }
  const el = document.createElement('div');
  el.className = 'gt-fly';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const cx = (sx + ex) / 2 - 80;
  const cy = Math.min(sy, ey) - 140;
  const o = { k: 0 };
  const bez = (k, a, b, c) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * b + k * k * c;
  gsap.set(el, { xPercent: -50, yPercent: -50, x: sx, y: sy, scale: 0 });
  gsap.timeline({ onComplete: () => el.remove() })
    .to(el, { scale: 1.2, duration: 0.18, ease: 'back.out(3)' })
    .to(o, { k: 1, duration: 0.85, ease: 'power2.inOut',
      onUpdate: () => gsap.set(el, { x: bez(o.k, sx, cx, ex), y: bez(o.k, sy, cy, ey), rotation: 420 * o.k, scale: 1.2 - o.k * 0.7 }) })
    .to(el, { opacity: 0, scale: 0.1, duration: 0.2 });
  if (badge) gsap.fromTo(badge, { scale: 1 }, { scale: 1.35, duration: 0.18, yoyo: true, repeat: 1, delay: 1, ease: 'power2.out' });
}
