/**
 * fx-frost-wipe — vitre givrée / embuée posée sur le visuel d'un conteneur, que l'on essuie
 * à la souris (survol) ou au doigt ; des gouttelettes se forment au bord du tracé, certaines
 * glissent, puis le givre repousse lentement, par plaques (grain de givre), jusqu'à recouvrir la vitre.
 *
 * Texture de la vitre (générée une fois) : l'image du conteneur floutée et blanchie (verre dépoli),
 * grain de givre, cristaux en fougère qui partent des bords, micro-buée, vignettage froid.
 * À l'apparition, la vitre s'embue ; avec data-wipe-hint, une main fantôme essuie une première
 * bande et une étiquette invite à essuyer (texte de l'attribut, « Essuyez la buée » s'il est vide).
 *
 * Options : data-wipe-hint["=texte"], data-wipe-brush="44" (rayon du pinceau, px),
 *           data-wipe-regrow="9" (durée de repousse, s), data-wipe-opacity="1".
 * Calque canvas pointer-events: none : les liens et boutons du conteneur restent utilisables.
 * Désactivé en mouvement réduit (l'image reste nette).
 */
import { claim, reducedMotion, isMobile, gsap, clamp, numAttr, rng, seedFrom, idle } from '../fx/env.js';
import { createLayer, findImage, imageReady, drawImageAsDisplayed, radiusOf } from '../fx/layer.js';
import { createTask } from '../fx/loop.js';
import { onceInView, watchVisibility } from '../fx/visibility.js';
import { brush, droplet, grain, makeCanvas } from '../fx/sprites.js';
import { growFrost, strokeSegments } from '../fx/crystals.js';

const HAND = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g class="fx-wipe-hint__hand" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V7.5a1.8 1.8 0 0 1 3.6 0V15m0-6.5V6a1.8 1.8 0 0 1 3.6 0v9m0-7a1.8 1.8 0 0 1 3.6 0v8.5m0-5a1.8 1.8 0 0 1 3.6 0V20a8.5 8.5 0 0 1-8.5 8.5h-1.2a8.5 8.5 0 0 1-6.8-3.4L6 20.3a2 2 0 0 1 3.1-2.5L12 21"/></g><path d="M3 9c2-2 4-2 6 0M3 13c1.2-1.2 2.4-1.2 3.6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55"/></svg>`;

export default function init(el) {
  if (!claim(el, 'fx-frost-wipe')) return;
  if (reducedMotion) return;

  el.classList.add('fx-wipe-host');
  const seed = seedFrom(el.className + (el.id || ''));
  const r = rng(seed);
  const regrow = clamp(numAttr(el, 'wipeRegrow', 9), 3, 30);
  const maxOpacity = clamp(numAttr(el, 'wipeOpacity', 1));
  const hintText = el.hasAttribute('data-wipe-hint') ? el.dataset.wipeHint.trim() || 'Essuyez la buée' : '';

  const ratio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);
  const layer = createLayer(el, { className: 'fx-wipe', dpr: ratio, onResize: () => revealed && rebuild() });
  const { canvas, ctx } = layer;
  canvas.style.opacity = '0';

  const MS = 0.35; // résolution du masque d'essuyage (fraction des px CSS)
  const mask = makeCanvas(1, 1);
  const mctx = mask.getContext('2d');
  let frost = null; // texture de la vitre (canvas hors écran)
  let img = findImage(el);
  let brushR = 40;
  let lastWipe = -1e9;
  let clock = 0;
  let decayT = 0;
  let masked = false; // le masque contient de l'essuyage
  let wiped = 0; // distance essuyée par l'utilisateur (px)
  let revealed = false;
  let hint = null;
  const drops = [];
  const dropSpr = droplet();
  const soft = brush();
  const grainPattern = mctx.createPattern(grain(), 'repeat');

  /* ---------- Texture de la vitre ---------- */
  function buildFrost() {
    const W = layer.w;
    const H = layer.h;
    if (!W || !H) return;
    const c = makeCanvas(W * ratio, H * ratio);
    const g = c.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);

    // 1) Verre dépoli : l'image floutée par réductions successives (rapide, partout).
    if (img && img.naturalWidth) {
      const k = 14;
      const tiny = makeCanvas(Math.max(2, W / k), Math.max(2, H / k));
      const t = tiny.getContext('2d');
      t.setTransform(1 / k, 0, 0, 1 / k, 0, 0);
      drawImageAsDisplayed(t, img, el);
      const mid = makeCanvas(Math.max(2, W / 4), Math.max(2, H / 4));
      const m = mid.getContext('2d');
      m.imageSmoothingQuality = 'high';
      m.drawImage(tiny, 0, 0, mid.width, mid.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(mid, 0, 0, W, H);
      // Blanchiment laiteux (le givre diffuse la lumière).
      g.fillStyle = 'rgba(226, 241, 255, 0.5)';
      g.fillRect(0, 0, W, H);
    } else {
      const lg = g.createLinearGradient(0, 0, W, H);
      lg.addColorStop(0, 'rgba(243,250,255,0.92)');
      lg.addColorStop(1, 'rgba(191,228,255,0.85)');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
    }

    // 2) Vignettage froid : plus opaque sur les bords.
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    vg.addColorStop(0, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(240,248,255,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    // 3) Grain de givre.
    g.globalAlpha = 0.5;
    g.fillStyle = g.createPattern(grain(), 'repeat');
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;

    // 4) Micro-buée : gouttelettes minuscules.
    const n = Math.round(clamp((W * H) / 380, 120, 1400));
    for (let i = 0; i < n; i++) {
      const rad = 0.6 + 1.9 * r() ** 3;
      const s = (dropSpr.S * rad) / dropSpr.R;
      g.globalAlpha = 0.55;
      g.drawImage(dropSpr.canvas, r() * W - s / 2, r() * H - s / 2, s, s);
    }
    g.globalAlpha = 1;

    // 5) Cristaux en fougère depuis les bords (relief : ombre bleutée + arête blanche).
    const depth = clamp(Math.min(W, H) * 0.34, 60, 220);
    const segs = growFrost({ w: W, h: H, depth, seed, spacing: 34, step: 4, maxGen: 2, corner: 1.4, stars: 7, pair: 0.45, edgeReach: [0.2, 0.9] });
    g.lineCap = 'round';
    strokeSegments(g, segs, 0, segs.length, [2.2, 1.5, 1], () => 'rgba(15,60,130,0.16)', 0.8, 1);
    strokeSegments(g, segs, 0, segs.length, [1.7, 1.15, 0.8], (k) => `rgba(255,255,255,${0.9 - k * 0.18})`);
    strokeSegments(g, segs, 0, segs.length, [0.7, 0.45, 0.3], () => 'rgba(255,255,255,1)', -0.4, -0.4);

    // 6) Coins arrondis du conteneur.
    const rad = radiusOf(el);
    if (rad > 0) {
      g.globalCompositeOperation = 'destination-in';
      g.beginPath();
      if (g.roundRect) g.roundRect(0, 0, W, H, rad);
      else g.rect(0, 0, W, H);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    frost = c;
  }

  function rebuild() {
    if (!layer.w) return;
    brushR = numAttr(el, 'wipeBrush', clamp(Math.min(layer.w, layer.h) * 0.1, 26, 58));
    mask.width = Math.max(1, Math.round(layer.w * MS));
    mask.height = Math.max(1, Math.round(layer.h * MS));
    masked = false;
    drops.length = 0;
    buildFrost();
    render();
  }

  /* ---------- Rendu ---------- */
  function render() {
    if (!frost) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = maxOpacity;
    ctx.drawImage(frost, 0, 0);
    ctx.globalAlpha = 1;
    if (masked) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (drops.length) {
      ctx.setTransform(layer.ratio, 0, 0, layer.ratio, 0, 0);
      for (const d of drops) {
        const k = d.life / d.max;
        ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
        const s = (dropSpr.S * d.rad) / dropSpr.R;
        const st = d.vy > 4 ? 1.18 : 1;
        ctx.drawImage(dropSpr.canvas, d.x - s / 2, d.y - (s * st) / 2, s, s * st);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Essuyage ---------- */
  let prev = null;
  function stamp(x, y) {
    const d = brushR * 2 * MS;
    mctx.globalAlpha = 0.55;
    mctx.drawImage(soft, x * MS - d / 2, y * MS - d / 2, d, d);
  }

  function wipeTo(x, y, user = true) {
    if (!frost) return;
    const p = { x, y };
    if (!prev) {
      stamp(x, y);
      prev = p;
    } else {
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1.5) return;
      const steps = Math.ceil(dist / (brushR * 0.28));
      const nx = -dy / dist;
      const ny = dx / dist;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const sx = prev.x + dx * t;
        const sy = prev.y + dy * t;
        stamp(sx, sy);
        // Gouttelettes repoussées au bord du tracé.
        if (drops.length < 240 && r() < 0.55) {
          const side = r.sign();
          const off = brushR * r.range(0.72, 0.98);
          const big = r() < 0.12;
          drops.push({
            x: sx + nx * off * side + r.range(-3, 3),
            y: sy + ny * off * side + r.range(-3, 3),
            rad: big ? r.range(3.2, 5.2) : r.range(1, 2.8),
            vy: 0,
            slide: big && r() < 0.6 ? r.range(0.4, 1.4) : -1,
            life: 0,
            max: regrow * r.range(0.55, 0.95),
          });
        }
      }
      if (user) wiped += dist;
      prev = p;
    }
    masked = true;
    lastWipe = clock;
    if (user && hint && wiped > 160) hideHint();
    task.start();
  }

  /* ---------- Repousse ---------- */
  const task = createTask('frost-wipe', (dt) => {
    clock += dt;
    const since = clock - lastWipe;
    if (masked && since > 0.6) {
      decayT += dt;
      if (decayT > 1 / 15) {
        // Le givre repousse par plaques (grain) puis partout.
        const step = decayT / regrow;
        decayT = 0;
        mctx.save();
        mctx.globalCompositeOperation = 'destination-out';
        mctx.globalAlpha = clamp(step * 5.5);
        mctx.fillStyle = grainPattern;
        mctx.fillRect(0, 0, mask.width, mask.height);
        mctx.globalAlpha = clamp(step * 3.2);
        mctx.fillStyle = '#000';
        mctx.fillRect(0, 0, mask.width, mask.height);
        mctx.restore();
      }
      if (since > regrow * 1.25) {
        mctx.clearRect(0, 0, mask.width, mask.height);
        masked = false;
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life += dt;
      if (d.life >= d.max) {
        drops.splice(i, 1);
        continue;
      }
      if (d.slide >= 0 && d.life > d.slide) {
        d.vy = Math.min(d.vy + 30 * dt, 26 + d.rad * 4);
        d.y += d.vy * dt;
      }
    }
    render();
    if (!masked && !drops.length) task.stop();
  });

  /* ---------- Entrées ---------- */
  const local = (cx, cy) => {
    const b = el.getBoundingClientRect();
    return [cx - b.left, cy - b.top];
  };
  let usingTouch = false;
  el.addEventListener(
    'pointermove',
    (e) => {
      if (!revealed) return;
      if (e.pointerType === 'touch' && usingTouch) return;
      const [x, y] = local(e.clientX, e.clientY);
      wipeTo(x, y);
    },
    { passive: true },
  );
  el.addEventListener('pointerleave', () => (prev = null));
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') prev = null;
  }, { passive: true });
  el.addEventListener(
    'touchstart',
    () => {
      usingTouch = true;
      prev = null;
    },
    { passive: true },
  );
  el.addEventListener(
    'touchmove',
    (e) => {
      if (!revealed) return;
      const t = e.touches[0];
      if (!t) return;
      const [x, y] = local(t.clientX, t.clientY);
      wipeTo(x, y);
    },
    { passive: true },
  );
  el.addEventListener('touchend', () => (prev = null), { passive: true });

  /* ---------- Indice + main fantôme ---------- */
  function showHint() {
    if (!hintText || hint) return;
    hint = document.createElement('span');
    hint.className = 'fx-wipe-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = `${HAND}<span>${hintText.replace(/[<>&]/g, '')}</span>`;
    el.append(hint);
    gsap.from(hint, { opacity: 0, y: 14, scale: 0.9, filter: 'blur(6px)', duration: 0.9, ease: 'ice', clearProps: 'filter' });
  }
  function hideHint() {
    const h = hint;
    if (!h || h.classList.contains('is-gone')) return;
    h.classList.add('is-gone');
    setTimeout(() => h.remove(), 700);
  }

  function ghostWipe() {
    // Une bande essuyée en S au centre : on comprend tout de suite que la vitre s'essuie.
    const W = layer.w;
    const H = layer.h;
    const o = { t: 0 };
    prev = null;
    gsap.to(o, {
      t: 1,
      duration: 1.3,
      ease: 'power1.inOut',
      onUpdate: () => {
        const x = W * (0.16 + 0.68 * o.t);
        const y = H * (0.55 + 0.12 * Math.sin(o.t * Math.PI * 2));
        wipeTo(x, y, false);
      },
      onComplete: () => (prev = null),
    });
  }

  async function reveal() {
    img = findImage(el);
    await imageReady(img);
    if (!layer.ready) layer.measure();
    rebuild();
    revealed = true;
    // La vitre s'embue.
    gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' });
    if (hintText) {
      gsap.delayedCall(0.9, showHint);
      gsap.delayedCall(1.4, ghostWipe);
    }
  }

  // L'image peut changer de source (srcset) : on reconstruit la vitre.
  img?.addEventListener('load', () => revealed && idle(rebuild));

  // Apparition quand le conteneur entre dans la vue.
  onceInView(el, reveal, { ratio: 0.3 });
  watchVisibility(el, (on) => {
    if (!on) task.stop();
    else if (masked || drops.length) task.start();
  });
}
