/**
 * « Composez votre commande » (agent convert-a) — section #commande (.order-express).
 * Quantité libre par variante (PRODUCTS / SKUS de config.js), panier partagé via core/quote-store
 * (événement window « quote:change »). Total qui « gèle » en direct, jauge vers la livraison offerte
 * (DELIVERY.freeFrom), bac à glace en canvas où les articles s'empilent, cristal qui saute à chaque +1.
 * Le HTML statique reste lisible et fonctionnel sans JS ; ce module le revérifie contre config.js.
 */
import { SKUS, DELIVERY, BRAND } from '../config.js';
import { getState, setQty, computeTotals } from '../core/quote-store.js';
import { gsap, ScrollTrigger, reducedMotion } from '../core/motion.js';
import { fcfaPlain, plainNumber } from '../core/format.js';
import { waLink } from '../core/whatsapp.js';

const NBSP = ' ';
const NNBSP = ' ';
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const money = (n) => nf.format(Math.round(n || 0));
const articles = (n) => `${nf.format(n)}${NBSP}article${n > 1 ? 's' : ''}`;
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const nbsp = (s) => String(s).replace(/ ([;:!?])/g, `${NNBSP}$1`);

export default function init(root) {
  const goal = DELIVERY.freeFrom;
  const list = root.querySelector('.order-express__list');
  const rows = new Map();

  /* ---------- 1. Vérifier / compléter les lignes depuis config.js ---------- */
  const template = list.querySelector('.oe-item');
  for (const el of [...list.querySelectorAll('.oe-item')]) {
    const v = SKUS[el.dataset.sku];
    if (!v || !v.product.available) el.remove();
  }
  let order = 0;
  for (const [sku, v] of Object.entries(SKUS)) {
    if (!v.product.available) continue;
    let el = list.querySelector(`.oe-item[data-sku="${CSS.escape(sku)}"]`);
    if (!el && template) {
      // Nouvelle variante ajoutée à config.js : on clone une ligne et on la remplit.
      el = template.cloneNode(true);
      el.dataset.sku = sku;
      el.dataset.product = v.product.id;
      el.classList.remove('oe-item--carbo');
      el.querySelector('.oe-item__warn')?.remove();
      el.querySelector('.oe-item__new')?.remove();
      el.querySelector('.oe-item__variant')?.remove();
      const h = el.querySelector('.oe-item__name');
      h.id = `oe-${sku}-nom`;
      el.querySelector('.oe-stepper').setAttribute('aria-labelledby', h.id);
      el.querySelector('.oe-thumb').innerHTML = '<span class="oe-thumb__gloss"></span>';
      el.querySelector('.oe-more').open = false;
    }
    if (!el) continue;
    list.append(el); // ordre de config.js
    el.style.setProperty('--i', order++);
    fillRow(el, v);
    rows.set(sku, {
      el,
      input: el.querySelector('[data-qty]'),
      minus: el.querySelector('[data-step="-1"]'),
      plus: el.querySelector('[data-step="1"]'),
      line: el.querySelector('[data-line]'),
      qty: -1,
    });
  }
  upgradeThumbs(root);

  /* ---------- 2. Références ---------- */
  const $ = (s) => root.querySelector(s);
  const totalEl = $('[data-total]');
  const countEl = $('[data-count-label]');
  const kgEl = $('[data-kg-label]');
  const gaugeBar = $('[data-gauge-bar]');
  const gaugeFill = $('[data-gauge-fill]');
  const gaugeText = $('[data-gauge-text]');
  const gaugeNote = $('[data-gauge-note]');
  const gaugeBurst = $('[data-gauge-burst]');
  const waBtn = $('[data-wa-link]');
  const clearBtn = $('[data-clear]');
  const tickerTotal = $('[data-ticker-total]');
  const tickerCount = $('[data-ticker-count]');
  const tickerFill = $('[data-ticker-fill]');
  const binWrap = $('[data-bin]');
  const binMore = $('[data-bin-more]');
  const freeLabel = $('[data-free-label]');
  const goalLabel = $('[data-goal-label]');
  if (freeLabel) freeLabel.textContent = DELIVERY.freeLabel;
  const notes = { paid: DELIVERY.paidNote, free: gaugeNote.dataset.noteFree || '' };

  const bin = createBin(binWrap, $('[data-bin-canvas]'), {
    skus: [...rows.keys()],
    goal,
    onLayout: ({ goalY }) => binWrap.style.setProperty('--goal-y', `${goalY}px`),
  });

  /* ---------- 3. Interactions ---------- */
  let pendingFrom = null; // bouton « + » à l'origine du dernier ajout (cristal qui saute)

  for (const [sku, r] of rows) {
    const step = (d, from) => {
      const cur = getState().lines[sku] || 0;
      if (d > 0) pendingFrom = from;
      setQty(sku, cur + d);
    };
    holdToRepeat(r.plus, () => step(1, r.plus));
    holdToRepeat(r.minus, () => step(-1, null));

    let t;
    r.input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => commitInput(sku, r), 350);
    });
    r.input.addEventListener('change', () => { clearTimeout(t); commitInput(sku, r); });
    r.input.addEventListener('blur', () => { clearTimeout(t); commitInput(sku, r, true); });
    r.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); r.input.blur(); }
    });
    r.input.addEventListener('focus', () => r.input.select());
  }

  function commitInput(sku, r, normalize = false) {
    const raw = r.input.value.trim();
    if (raw === '' && !normalize) return;
    const n = Math.max(0, Math.min(99999, Math.round(Number(raw.replace(/\s/g, '')) || 0)));
    const cur = getState().lines[sku] || 0;
    if (n > cur) pendingFrom = r.input;
    if (n !== cur) setQty(sku, n);
    else if (normalize) r.input.value = String(cur);
  }

  clearBtn?.addEventListener('click', () => {
    for (const sku of rows.keys()) setQty(sku, 0);
    const first = rows.values().next().value;
    first?.input.focus({ preventScroll: true });
  });

  /* ---------- 4. Rendu ---------- */
  const totalObj = { v: 0 };
  let prevCount = -1;
  let freezeTimer;

  function render({ initial = false } = {}) {
    const s = getState();
    const t = computeTotals(s);

    for (const [sku, r] of rows) {
      const q = s.lines[sku] || 0;
      const changed = q !== r.qty;
      r.qty = q;
      if (document.activeElement !== r.input) r.input.value = String(q);
      r.minus.disabled = q <= 0;
      r.el.classList.toggle('is-active', q > 0);
      r.line.textContent = q > 0 ? `${money(q * SKUS[sku].price)}${NBSP}F` : `0${NBSP}F`;
      if (changed && !initial && !reducedMotion && q > 0) {
        gsap.fromTo(r.line, { scale: 1.18, color: '#1563d6' }, { scale: 1, color: '', duration: 0.6, ease: 'ice', overwrite: true, clearProps: 'transform,color' });
      }
    }

    // Total qui gèle
    if (initial || reducedMotion) {
      totalObj.v = t.subtotal;
      totalEl.textContent = money(t.subtotal);
    } else if (Math.round(totalObj.v) !== t.subtotal) {
      gsap.to(totalObj, {
        v: t.subtotal, duration: 0.9, ease: 'power3.out', overwrite: true,
        onUpdate: () => { totalEl.textContent = money(totalObj.v); },
      });
      totalEl.classList.add('is-freezing');
      clearTimeout(freezeTimer);
      freezeTimer = setTimeout(() => totalEl.classList.remove('is-freezing'), 420);
    }
    countEl.textContent = articles(t.count);
    kgEl.textContent = kgText(t);
    kgEl.hidden = !kgEl.textContent;
    kgEl.previousElementSibling.hidden = !kgEl.textContent;

    // Jauge
    const p = Math.min(1, t.count / goal);
    gaugeFill.style.setProperty('--p', p);
    gaugeBar.setAttribute('aria-valuenow', String(Math.min(goal, t.count)));
    gaugeBar.setAttribute('aria-valuetext', freeText(t.count));
    setGaugeText(t.count);
    const free = t.count >= goal;
    root.classList.toggle('is-free', free);
    if (goalLabel) goalLabel.textContent = free ? `Livraison offerte${NNBSP}!` : `${goal}${NBSP}articles · livraison offerte`;
    gaugeNote.textContent = nbsp(free ? notes.free : notes.paid);

    // Bandeau mobile
    tickerTotal.textContent = `${money(t.subtotal)}${NBSP}F`;
    tickerCount.textContent = free ? `${articles(t.count)} · livraison offerte` : articles(t.count);
    tickerFill.style.setProperty('--p', p);

    // Actions
    waBtn.href = waLink(waMessage(s, t));
    clearBtn.hidden = t.count === 0;

    // Bac à glace
    const counts = Object.fromEntries([...rows.keys()].map((k) => [k, s.lines[k] || 0]));
    const shown = bin.set(counts, { animate: !initial && !reducedMotion });
    binWrap.classList.toggle('has-items', t.count > 0);
    if (t.count > shown) {
      binMore.hidden = false;
      binMore.textContent = `${nf.format(t.count)} articles · aperçu`;
    } else binMore.hidden = true;

    // Cristal qui saute + célébration
    if (!initial && !reducedMotion && pendingFrom && t.count > prevCount) flyCrystal(pendingFrom);
    pendingFrom = null;
    if (!initial && prevCount >= 0 && prevCount < goal && t.count >= goal) celebrate();
    prevCount = t.count;
  }

  function setGaugeText(count) {
    const left = Math.max(0, goal - count);
    if (count > 0 && left > 0) {
      gaugeText.innerHTML = left === 1
        ? 'Plus qu’<b>un</b> article pour la livraison offerte'
        : `Plus que <b>${left}</b>${NBSP}articles pour la livraison offerte`;
    } else gaugeText.textContent = freeText(count);
  }

  function freeText(count) {
    const left = Math.max(0, goal - count);
    if (count <= 0) return DELIVERY.freeLabel;
    if (left === 0) return `Livraison offerte${NNBSP}!`;
    return left === 1 ? 'Plus qu’un article pour la livraison offerte' : `Plus que ${left}${NBSP}articles pour la livraison offerte`;
  }

  /* ---------- 5. Effets ---------- */
  function flyCrystal(from) {
    const a = from.getBoundingClientRect();
    if (!a.width) return;
    // Cible : le bac s'il est visible, sinon le bandeau collant (mobile).
    const binRect = binWrap.getBoundingClientRect();
    const ticker = root.querySelector('[data-ticker]');
    let target = null;
    if (binRect.top < innerHeight - 40 && binRect.bottom > 40) {
      target = { x: binRect.left + binRect.width * (0.3 + Math.random() * 0.4), y: binRect.top + binRect.height * 0.25 };
    } else if (ticker && ticker.offsetParent) {
      const r = ticker.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) target = { x: r.left + 40, y: r.top + r.height / 2 };
    }
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const fl = document.createElement('span');
    fl.className = 'oe-flyer';
    fl.setAttribute('aria-hidden', 'true');
    document.body.append(fl);
    if (!target) {
      gsap.fromTo(fl, { x: x0, y: y0, scale: 0.4, opacity: 1 }, {
        y: y0 - 60, scale: 1.2, opacity: 0, rotation: 180, duration: 0.7, ease: 'power2.out', onComplete: () => fl.remove(),
      });
      return;
    }
    const midX = (x0 + target.x) / 2 + (Math.random() - 0.5) * 60;
    const midY = Math.min(y0, target.y) - Math.max(80, Math.abs(target.x - x0) * 0.35);
    gsap.set(fl, { x: x0, y: y0, scale: 0.5 });
    gsap.timeline({ onComplete: () => fl.remove() })
      .to(fl, {
        duration: 0.62, ease: 'power1.inOut', rotation: 300, scale: 1,
        motionPath: { path: [{ x: midX, y: midY }, { x: target.x, y: target.y }], curviness: 1.4 },
      })
      .to(fl, { scale: 0, opacity: 0, duration: 0.18, ease: 'power2.in' }, '-=0.08');
  }

  function celebrate() {
    if (reducedMotion) return;
    const n = 22;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'oe-gauge__spark';
      gaugeBurst.append(s);
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 60 + Math.random() * 90;
      gsap.fromTo(s, { x: 0, y: 0, scale: 0.4 + Math.random() * 0.8, opacity: 1, rotation: 45 }, {
        x: Math.cos(ang) * dist * 1.6, y: Math.sin(ang) * dist, rotation: 45 + (Math.random() - 0.5) * 360, opacity: 0,
        duration: 0.9 + Math.random() * 0.6, ease: 'power3.out', onComplete: () => s.remove(),
      });
    }
    gsap.fromTo(gaugeText, { scale: 0.86, filter: 'blur(6px)' }, { scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'back.out(2.2)', clearProps: 'transform,filter' });
    gsap.fromTo(root.querySelector('.oe-gauge'), { boxShadow: '0 0 0 0 rgba(47,174,107,0.6)' }, { boxShadow: '0 0 0 18px rgba(47,174,107,0)', duration: 1.1, ease: 'power2.out', clearProps: 'boxShadow' });
    bin.flash();
  }

  /* ---------- 6. Synchronisation ---------- */
  render({ initial: true });
  window.addEventListener('quote:change', () => render());

  /* ---------- 7. Entrée en scène ---------- */
  if (!reducedMotion) intro(root);
}

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */
function fillRow(el, v) {
  const p = v.product;
  const set = (sel, txt) => { const n = el.querySelector(sel); if (n && n.textContent !== txt) n.textContent = txt; };
  set('[data-name]', p.name);
  set('[data-price]', `${money(v.price)}${NBSP}F`);
  el.querySelector('[data-price]')?.setAttribute('data-price', v.sku);
  set('[data-label]', lowerFirst(v.label));
  const variant = el.querySelector('[data-variant]');
  if (variant) variant.textContent = v.label.replace(/^Barre de /, '');
  set('[data-howto]', nbsp(p.howto));
  set('[data-info="description"]', nbsp(p.description));
  set('[data-info="uses"]', nbsp((p.uses || []).join(' · ')));
  set('[data-info="howto"]', nbsp(p.howto || ''));
  set('[data-info="storage"]', nbsp(p.storage || ''));
  set('[data-info="safety"]', nbsp(p.safety || ''));
  const full = `${p.name}, ${v.label.toLowerCase()}`;
  el.querySelector('[data-step="-1"]')?.setAttribute('aria-label', `Retirer un article : ${full}`);
  el.querySelector('[data-step="1"]')?.setAttribute('aria-label', `Ajouter un article : ${full}`);
  el.querySelector('[data-qty]')?.setAttribute('aria-label', `Quantité : ${full}`);
}

/** Miniatures sans photo (ex. « grain ») : on bascule sur la photo dès qu'elle existe dans le manifeste. */
async function upgradeThumbs(root) {
  const holes = root.querySelectorAll('[data-thumb-slot]');
  if (!holes.length) return;
  try {
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}img/manifest.json`, { cache: 'force-cache' });
    if (!res.ok) return;
    const manifest = await res.json();
    for (const el of holes) {
      const slot = el.dataset.thumbSlot;
      const meta = manifest[slot];
      if (!meta) continue;
      const widths = meta.widths || [480];
      const w = widths[0];
      const img = new Image();
      img.className = 'oe-thumb__img';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.width = meta.w || 480;
      img.height = meta.h || 480;
      img.src = `${base}img/${slot}-${w}.webp`;
      img.onload = () => {
        el.querySelector('.oe-thumb__art')?.replaceWith(img);
      };
    }
  } catch { /* hors ligne : on garde l'illustration */ }
}

function kgText(t) {
  if (!t.totalKg) return '';
  const hasCups = t.lines.some((l) => !l.kg);
  return `≈${NNBSP}${plainNumber(t.totalKg).replace(/ /g, NNBSP)}${NBSP}kg${hasCups ? ' (hors Ice Cup)' : ''}`;
}

function waMessage(s, t) {
  if (!t.count) return 'Bonjour Le Glaceur, je souhaite passer une commande de glace.';
  const lines = t.lines.map((l) => `• ${l.qty} × ${l.name} (${l.label.toLowerCase()}) : ${fcfaPlain(l.total)}`);
  const kg = t.totalKg ? `, environ ${plainNumber(t.totalKg)} kg` : '';
  let delivery;
  if (s.delivery.mode === 'retrait') delivery = `Retrait sur place à ${BRAND.address.street}.`;
  else if (t.freeEligible) delivery = `Livraison offerte (${DELIVERY.freeFrom} articles et plus)${s.delivery.commune ? ` à ${s.delivery.commune}` : ''}.`;
  else delivery = `Livraison${s.delivery.commune ? ` à ${s.delivery.commune}` : ''} : devis hors frais de livraison, merci de me communiquer le tarif.`;
  const who = [s.client.name && `Nom : ${s.client.name}`, s.client.company && `Structure : ${s.client.company}`].filter(Boolean);
  return [
    'Bonjour Le Glaceur,',
    'Je souhaite commander :',
    ...lines,
    '',
    `Total : ${fcfaPlain(t.subtotal)} (${t.count} article${t.count > 1 ? 's' : ''}${kg})`,
    delivery,
    ...(who.length ? ['', ...who] : []),
    '',
    'Merci de me confirmer la commande.',
  ].join('\n');
}

/** Appui long sur + / − : répétition accélérée (pratique pour de grandes quantités). */
function holdToRepeat(btn, fn) {
  if (!btn) return;
  let timer = null;
  let fired = false;
  const stop = () => { clearTimeout(timer); timer = null; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    fired = false;
    let delay = 420;
    const loop = () => {
      if (btn.disabled) return stop();
      fired = true;
      fn();
      delay = Math.max(60, delay * 0.78);
      timer = setTimeout(loop, delay);
    };
    timer = setTimeout(loop, delay);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', (e) => {
    if (fired) { fired = false; e.preventDefault(); return; }
    fn();
  });
  btn.addEventListener('contextmenu', (e) => { if (timer || fired) e.preventDefault(); });
}

function intro(root) {
  const st = (trigger, start = 'top 85%') => ({ trigger, start, once: true });
  const head = root.querySelector('.order-express__head');
  const title = root.querySelector('.order-express__title');
  gsap.from(head.querySelector('.eyebrow'), { opacity: 0, y: 16, duration: 0.8, scrollTrigger: st(head) });
  gsap.from(title, { opacity: 0, yPercent: 30, filter: 'blur(10px)', duration: 1.2, scrollTrigger: st(head), clearProps: 'filter' });
  gsap.from([root.querySelector('.order-express__lead'), ...root.querySelectorAll('.oe-perk')], {
    opacity: 0, y: 22, duration: 0.9, stagger: 0.06, delay: 0.15, scrollTrigger: st(head),
  });
  gsap.from(root.querySelectorAll('.oe-item'), {
    opacity: 0, y: 36, rotateX: -12, transformPerspective: 900, transformOrigin: '50% 0%',
    duration: 1, stagger: 0.07, scrollTrigger: st(root.querySelector('.order-express__list')), clearProps: 'transform',
  });
  const panel = root.querySelector('.order-express__panel');
  gsap.from(panel, { opacity: 0, y: 40, scale: 0.97, filter: 'blur(8px)', duration: 1.2, scrollTrigger: st(panel, 'top 90%'), clearProps: 'transform,filter' });
  const wm = root.querySelector('.order-express__watermark');
  if (wm) {
    gsap.fromTo(wm, { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  root.querySelectorAll('.oe-shard').forEach((el, i) => {
    gsap.to(el, { yPercent: (i % 2 ? -1 : 1) * (40 + i * 15), rotation: `+=${(i % 2 ? -1 : 1) * 14}`, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  ScrollTrigger.refresh();
}

/* ===========================================================================
   Bac à glace (canvas 2D) : un article = une pièce qui tombe et s'empile.
   Au-delà de MAX pièces, aperçu proportionnel. Ne dessine que pendant les animations,
   et seulement si le bac est à l'écran et l'onglet visible.
   =========================================================================== */
const COLS = 5;
const ROWS = 6;
const MAX = COLS * ROWS;

function createBin(wrap, canvas, { skus, goal, onLayout }) {
  const ctx = canvas.getContext('2d');
  const dprCap = matchMedia('(max-width: 760px)').matches ? 1.5 : 2;
  let dpr = Math.min(devicePixelRatio || 1, dprCap);
  let W = 0, H = 0, cell = 0, rowH = 0, floorY = 0, baseX = 0;
  let sprites = {};
  const pieces = []; // ordre d'empilement (index = case)
  const leaving = [];
  const sparks = [];
  let seed = 1;
  let busy = 0;
  let running = false;
  let visible = false;

  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function slot(i) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const off = row % 2 ? cell * 0.5 : 0;
    return { x: baseX + off + col * cell + cell / 2, y: floorY - row * rowH - cell / 2 };
  }

  function layout() {
    const r = wrap.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height;
    dpr = Math.min(devicePixelRatio || 1, dprCap);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cell = Math.min((W * 0.88) / (COLS + 0.5), (H * 0.94) / (ROWS * 0.78 + 0.3));
    rowH = cell * 0.78;
    floorY = H - Math.max(10, cell * 0.16);
    baseX = (W - (COLS + 0.5) * cell) / 2;
    sprites = Object.fromEntries(skus.map((k) => [k, makeSprite(k, Math.ceil(cell * dpr))]));
    pieces.forEach((p, i) => { const s = slot(i); gsap.killTweensOf(p); Object.assign(p, s, { a: 1, s: 1 }); });
    const goalY = floorY - (goal / COLS - 1) * rowH - cell - 4;
    onLayout?.({ goalY });
    draw();
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // ombre au sol
    const g = ctx.createRadialGradient(W / 2, floorY, 4, W / 2, floorY, W * 0.5);
    g.addColorStop(0, 'rgba(21,99,214,0.18)');
    g.addColorStop(1, 'rgba(21,99,214,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, floorY - 18, W, 36);
    for (const p of pieces) drawPiece(p);
    for (const p of leaving) drawPiece(p);
    for (const s of sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4 + s.r);
      ctx.fillStyle = s.c;
      const z = s.size * (0.4 + s.life * 0.6);
      ctx.shadowColor = 'rgba(77,155,255,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillRect(-z / 2, -z / 2, z, z);
      ctx.restore();
    }
  }

  function drawPiece(p) {
    const img = sprites[p.sku];
    if (!img || p.a <= 0) return;
    const size = cell * p.s;
    ctx.save();
    ctx.globalAlpha = p.a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function tick() {
    const dt = gsap.ticker.deltaRatio(60) / 60;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vy += 420 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.6;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    draw();
    if (!sparks.length && !leaving.length && !pieces.some((p) => gsap.isTweening(p))) stop();
  }
  function start() {
    if (running || document.hidden) return;
    running = true;
    gsap.ticker.add(tick);
  }
  function stop() {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
    draw();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (busy || sparks.length) start(); });

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible) { stop(); return; }
    draw();
    if (busy || sparks.length) start();
  }, { rootMargin: '80px 0px' });
  io.observe(wrap);
  new ResizeObserver(() => layout()).observe(wrap);

  function tween(target, { done, ...vars }) {
    busy = 1;
    start();
    return gsap.to(target, { ...vars, onComplete: done });
  }

  function burst(x, y, n = 6, spread = 1) {
    for (let i = 0; i < n; i++) {
      sparks.push({
        x, y, vx: (rand() - 0.5) * 260 * spread, vy: -80 - rand() * 200 * spread, r: rand() * 1.5,
        size: 3 + rand() * 4, life: 1, c: rand() > 0.5 ? '#ffffff' : '#bfe4ff',
      });
    }
    start();
  }

  function targets(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total <= MAX) return { ...counts };
    const out = {};
    const rem = [];
    let used = 0;
    for (const [k, q] of Object.entries(counts)) {
      if (!q) { out[k] = 0; continue; }
      const exact = (q / total) * MAX;
      out[k] = Math.max(1, Math.floor(exact));
      used += out[k];
      rem.push([k, exact - Math.floor(exact)]);
    }
    rem.sort((a, b) => b[1] - a[1]);
    for (let i = 0; used < MAX && i < rem.length * 2; i++) { out[rem[i % rem.length][0]]++; used++; }
    while (used > MAX) { const k = rem[rem.length - 1][0]; if (out[k] > 1) { out[k]--; used--; } else rem.pop(); }
    return out;
  }

  function set(counts, { animate = true } = {}) {
    const want = targets(counts);
    const anim = animate && visible && !document.hidden && W > 0;
    // 1. retirer les pièces en trop (les plus hautes d'abord)
    for (const k of Object.keys(want)) {
      let extra = pieces.filter((p) => p.sku === k).length - want[k];
      for (let i = pieces.length - 1; i >= 0 && extra > 0; i--) {
        if (pieces[i].sku !== k) continue;
        const [p] = pieces.splice(i, 1);
        extra--;
        gsap.killTweensOf(p);
        if (anim && leaving.length < 24) {
          leaving.push(p);
          tween(p, { y: p.y - cell * 0.8, a: 0, s: 0.4, rot: p.rot + (rand() - 0.5) * 2, duration: 0.45, ease: 'power2.in',
            done: () => leaving.splice(leaving.indexOf(p), 1) });
          burst(p.x, p.y, 3, 0.6);
        }
      }
    }
    // 2. ajouter les nouvelles
    const added = [];
    for (const k of skus) {
      const have = pieces.filter((p) => p.sku === k).length;
      for (let i = have; i < (want[k] || 0); i++) {
        const p = { sku: k, x: 0, y: 0, rot: (rand() - 0.5) * 0.22, s: 1, a: 1 };
        pieces.push(p);
        added.push(p);
      }
    }
    // 3. placer / faire tomber
    const many = added.length > 8;
    pieces.forEach((p, i) => {
      const s = slot(i);
      const jx = ((i * 7919) % 13) / 13 - 0.5;
      s.x += jx * cell * 0.08;
      if (!anim || !W) { gsap.killTweensOf(p); Object.assign(p, s); p.a = 1; p.s = 1; return; }
      const isNew = added.includes(p);
      if (isNew) {
        const k = added.indexOf(p);
        p.x = s.x; p.y = -cell * (0.8 + (many ? rand() * 1.5 : 0)); p.a = 1; p.s = 1;
        tween(p, {
          y: s.y, duration: many ? 0.7 : 0.85, delay: Math.min(0.9, k * (many ? 0.025 : 0.06)), ease: 'bounce.out',
          done: () => { if (!many || k % 4 === 0) burst(p.x, p.y + cell * 0.35, many ? 3 : 7); },
        });
      } else if (Math.abs(p.x - s.x) > 0.5 || Math.abs(p.y - s.y) > 0.5) {
        tween(p, { x: s.x, y: s.y, duration: 0.55, ease: 'bounce.out', delay: 0.12 });
      }
    });
    if (!anim) draw();
    return pieces.length;
  }

  function flash() {
    if (!W) return;
    const y = floorY - (goal / COLS - 1) * rowH - cell - 4;
    for (let i = 0; i < 26; i++) {
      sparks.push({ x: W * (0.06 + rand() * 0.88), y, vx: (rand() - 0.5) * 120, vy: -120 - rand() * 220, r: rand(), size: 3 + rand() * 5, life: 1.2, c: rand() > 0.4 ? '#ffffff' : '#8fe0b0' });
    }
    start();
  }

  layout();
  return { set, flash };
}

/* ---------- Sprites (dessinés une fois par taille) ---------- */
function makeSprite(sku, size) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(8, size);
  const g = c.getContext('2d');
  const s = c.width;
  const id = SKUS[sku]?.product.id;
  if (id === 'glacons') isoBox(g, s, 1, 1, 1, ICE);
  else if (id === 'grain') nuggets(g, s);
  else if (id === 'pilee') sack(g, s);
  else if (id === 'carboglace') { fog(g, s); isoBox(g, s, 1.25, 1, 0.62, CARBO); }
  else if (id === 'gobelet') cup(g, s);
  else if (id === 'barres') {
    const big = (SKUS[sku].kg || 0) >= 10;
    isoBox(g, s, big ? 2.5 : 2.1, big ? 0.95 : 0.75, big ? 0.9 : 0.72, ICE, big ? 0.98 : 0.84);
  } else isoBox(g, s, 1, 1, 1, ICE);
  return c;
}

const ICE = {
  top: ['#ffffff', '#e6f4ff'], left: ['#b6dcfa', '#78b9f0'], right: ['#e2f2fe', '#a9d5f8'],
  edge: 'rgba(255,255,255,0.95)', outline: 'rgba(21,99,214,0.55)', alpha: 0.94, cracks: true,
};
const CARBO = {
  top: ['#ffffff', '#f4f7fa'], left: ['#d9e2ec', '#c3cfdc'], right: ['#f0f4f8', '#dde6ef'],
  edge: 'rgba(255,255,255,1)', outline: 'rgba(69,89,124,0.45)', alpha: 1, cracks: false,
};

function isoBox(g, s, lx, ly, lz, pal, fill = 0.86) {
  const P = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
  const minX = -ly * 0.866, maxX = lx * 0.866, minY = -lz, maxY = (lx + ly) * 0.5;
  const k = Math.min((s * fill) / (maxX - minX), (s * fill) / (maxY - minY));
  const ox = s / 2 - ((minX + maxX) / 2) * k;
  const oy = s / 2 - ((minY + maxY) / 2) * k;
  const p = (x, y, z) => { const [a, b] = P(x, y, z); return [ox + a * k, oy + b * k]; };
  const A = p(0, 0, lz), B = p(lx, 0, lz), C = p(lx, ly, lz), D = p(0, ly, lz);
  const E = p(0, ly, 0), F = p(lx, ly, 0), G = p(lx, 0, 0);
  const poly = (pts) => { g.beginPath(); g.moveTo(...pts[0]); for (const q of pts.slice(1)) g.lineTo(...q); g.closePath(); };
  const lin = (a, b, cols) => { const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); return gr; };
  g.save();
  g.globalAlpha = pal.alpha;
  g.lineJoin = 'round';
  // ombre portée
  g.save();
  g.globalAlpha = 0.25;
  g.fillStyle = '#0a1f44';
  g.filter = `blur(${Math.max(1, s * 0.03)}px)`;
  poly([E, F, G, [G[0], G[1] + s * 0.03], [F[0], F[1] + s * 0.05], [E[0], E[1] + s * 0.03]]);
  g.fill();
  g.restore();
  poly([D, C, F, E]); g.fillStyle = lin(D, F, pal.left); g.fill();
  poly([B, C, F, G]); g.fillStyle = lin(B, F, pal.right); g.fill();
  poly([A, B, C, D]); g.fillStyle = lin(A, C, pal.top); g.fill();
  if (pal.cracks) {
    // cœur givré + fêlures internes
    g.save();
    poly([D, C, F, E]); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1, s * 0.012);
    g.beginPath(); g.moveTo(D[0] + (C[0] - D[0]) * 0.3, D[1] + (E[1] - D[1]) * 0.2); g.lineTo(D[0] + (C[0] - D[0]) * 0.55, D[1] + (E[1] - D[1]) * 0.75); g.stroke();
    g.restore();
    g.save();
    poly([B, C, F, G]); g.clip();
    const rg = g.createRadialGradient((B[0] + F[0]) / 2, (B[1] + F[1]) / 2, 0, (B[0] + F[0]) / 2, (B[1] + F[1]) / 2, s * 0.25);
    rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
    g.restore();
  }
  // arêtes
  g.strokeStyle = pal.outline; g.lineWidth = Math.max(1, s * 0.016);
  poly([A, B, G, F, E, D]); g.stroke();
  g.strokeStyle = pal.edge; g.lineWidth = Math.max(1, s * 0.022);
  g.beginPath(); g.moveTo(...D); g.lineTo(...C); g.lineTo(...B); g.moveTo(...C); g.lineTo(...F); g.stroke();
  // reflet du dessus
  g.globalAlpha = 0.85;
  g.fillStyle = 'rgba(255,255,255,0.9)';
  const m = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  poly([m(A, C, 0.12), m(A, B, 0.45), m(A, C, 0.3), m(A, D, 0.45)]); g.fill();
  g.restore();
}

function nuggets(g, s) {
  const pts = [[0.3, 0.68, 0.15], [0.52, 0.7, 0.16], [0.72, 0.66, 0.14], [0.4, 0.5, 0.14], [0.62, 0.48, 0.15], [0.5, 0.32, 0.13], [0.22, 0.52, 0.11], [0.8, 0.5, 0.11]];
  g.save();
  g.globalAlpha = 0.3; g.fillStyle = '#0a1f44'; g.filter = `blur(${Math.max(1, s * 0.03)}px)`;
  g.beginPath(); g.ellipse(s * 0.5, s * 0.8, s * 0.36, s * 0.06, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  for (const [x, y, r] of pts.sort((a, b) => a[1] - b[1])) {
    const cx = x * s, cy = y * s, rr = r * s;
    const gr = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr * 1.1);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#e3f3ff'); gr.addColorStop(1, '#8ecfff');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.86, x * 3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(21,99,214,0.4)'; g.lineWidth = Math.max(1, s * 0.012); g.stroke();
  }
}

function sack(g, s) {
  const w = s * 0.7, h = s * 0.74, x = (s - w) / 2, y = s * 0.16;
  g.save();
  g.globalAlpha = 0.3; g.fillStyle = '#0a1f44'; g.filter = `blur(${Math.max(1, s * 0.03)}px)`;
  g.beginPath(); g.ellipse(s * 0.5, y + h, w * 0.5, s * 0.05, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // corps du sac
  g.beginPath();
  g.moveTo(x + w * 0.22, y + h * 0.08);
  g.quadraticCurveTo(x - w * 0.04, y + h * 0.2, x + w * 0.02, y + h * 0.6);
  g.quadraticCurveTo(x + w * 0.04, y + h, x + w * 0.5, y + h);
  g.quadraticCurveTo(x + w * 0.96, y + h, x + w * 0.98, y + h * 0.6);
  g.quadraticCurveTo(x + w * 1.04, y + h * 0.2, x + w * 0.78, y + h * 0.08);
  g.closePath();
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#eaf5ff'); gr.addColorStop(1, '#bfe4ff');
  g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(21,99,214,0.5)'; g.lineWidth = Math.max(1, s * 0.016); g.stroke();
  g.save(); g.clip();
  // grains de glace visibles à travers le sac
  for (let i = 0; i < 26; i++) {
    const px = x + w * (0.12 + ((i * 37) % 76) / 100), py = y + h * (0.25 + ((i * 53) % 70) / 100);
    g.fillStyle = i % 3 ? 'rgba(142,207,255,0.55)' : 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(px, py, s * (0.018 + (i % 4) * 0.006), 0, Math.PI * 2); g.fill();
  }
  // bandeau bleu
  g.fillStyle = '#1563d6';
  g.fillRect(x, y + h * 0.42, w, h * 0.17);
  g.fillStyle = '#4d9bff';
  g.beginPath();
  g.moveTo(x, y + h * 0.56);
  g.quadraticCurveTo(x + w * 0.5, y + h * 0.47, x + w, y + h * 0.56);
  g.lineTo(x + w, y + h * 0.59); g.lineTo(x, y + h * 0.59); g.closePath(); g.fill();
  g.restore();
  // col noué
  g.fillStyle = '#e3f3ff'; g.strokeStyle = 'rgba(21,99,214,0.5)';
  g.beginPath(); g.moveTo(x + w * 0.3, y + h * 0.1); g.lineTo(x + w * 0.4, y - h * 0.06); g.lineTo(x + w * 0.6, y - h * 0.06); g.lineTo(x + w * 0.7, y + h * 0.1); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#0f4fb3'; g.fillRect(x + w * 0.36, y + h * 0.03, w * 0.28, h * 0.05);
  // reflet
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = s * 0.03; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + w * 0.16, y + h * 0.3); g.quadraticCurveTo(x + w * 0.1, y + h * 0.55, x + w * 0.18, y + h * 0.8); g.stroke();
}

function cup(g, s) {
  const top = s * 0.3, bot = s * 0.9, wt = s * 0.62, wb = s * 0.44, cx = s / 2;
  g.save();
  g.globalAlpha = 0.3; g.fillStyle = '#0a1f44'; g.filter = `blur(${Math.max(1, s * 0.03)}px)`;
  g.beginPath(); g.ellipse(cx, bot, wb * 0.6, s * 0.045, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  const body = () => {
    g.beginPath(); g.moveTo(cx - wt / 2, top); g.lineTo(cx + wt / 2, top); g.lineTo(cx + wb / 2, bot); g.lineTo(cx - wb / 2, bot); g.closePath();
  };
  body();
  const gr = g.createLinearGradient(cx - wt / 2, 0, cx + wt / 2, 0);
  gr.addColorStop(0, 'rgba(191,228,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(142,207,255,0.9)');
  g.fillStyle = gr; g.fill();
  g.save(); body(); g.clip();
  for (let i = 0; i < 9; i++) {
    const r = s * 0.075, px = cx - wt * 0.3 + (i % 3) * wt * 0.3 + (Math.floor(i / 3) % 2) * s * 0.04, py = top + s * 0.12 + Math.floor(i / 3) * s * 0.16;
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = 'rgba(21,99,214,0.35)'; g.lineWidth = Math.max(1, s * 0.01);
    g.beginPath(); g.roundRect(px - r, py - r, r * 2, r * 2, r * 0.4); g.fill(); g.stroke();
  }
  g.restore();
  body(); g.strokeStyle = 'rgba(21,99,214,0.55)'; g.lineWidth = Math.max(1, s * 0.016); g.stroke();
  // couvercle dôme
  g.beginPath(); g.ellipse(cx, top, wt / 2 + s * 0.02, s * 0.035, 0, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(cx - wt / 2, top); g.quadraticCurveTo(cx, top - s * 0.3, cx + wt / 2, top);
  g.fillStyle = 'rgba(227,243,255,0.75)'; g.fill(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = s * 0.025; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - wt * 0.28, top - s * 0.06); g.quadraticCurveTo(cx - wt * 0.1, top - s * 0.16, cx + wt * 0.05, top - s * 0.15); g.stroke();
  g.beginPath(); g.moveTo(cx - wt * 0.36, top + s * 0.08); g.lineTo(cx - wb * 0.36, bot - s * 0.06); g.stroke();
}

function fog(g, s) {
  g.save();
  for (const [x, y, r] of [[0.3, 0.7, 0.26], [0.7, 0.72, 0.24], [0.5, 0.8, 0.3]]) {
    const gr = g.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
  g.restore();
}
