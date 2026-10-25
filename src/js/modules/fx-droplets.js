/**
 * fx-droplets — condensation réaliste sur une surface froide.
 *  - Micro-gouttes : un semis dense de gouttelettes (tailles en loi de puissance, ombre, liseré,
 *    reflet) + une buée légère sur les bords, rendu une seule fois dans un canvas statique.
 *  - Grosses gouttes : elles perlent (grossissent lentement), puis glissent par à-coups, absorbent
 *    les gouttes sur leur passage et laissent une traînée claire (la buée est essuyée) semée de
 *    petites perles ; la condensation se reforme lentement dans la traînée.
 *  - Au pointeur : frôler une goutte mûre la fait partir.
 * Options : data-droplets-density="1" (0,3 à 2 ; ou low | high), data-droplets-haze="0" (sans buée).
 * Coût : le semis est statique ; à chaque image on n'efface et ne redessine que les petites zones
 * des grosses gouttes. Boucle active seulement à l'écran ; désactivé en mouvement réduit
 * (la condensation reste alors affichée, immobile).
 */
import { claim, reducedMotion, finePointer, isMobile, lowPower, clamp, numAttr, rng, seedFrom } from '../fx/env.js';
import { createLayer, findImage, imageReady, drawImageAsDisplayed } from '../fx/layer.js';
import { createTask } from '../fx/loop.js';
import { watchVisibility } from '../fx/visibility.js';
import { droplet, microDrop, brush, makeCanvas } from '../fx/sprites.js';

let uid = 0;

export default function init(el) {
  if (!claim(el, 'fx-droplets')) return;
  const density = clamp(numAttr(el, 'dropletsDensity', 1, { low: 0.55, high: 1.5 }), 0.3, 2);
  const haze = el.dataset.dropletsHaze !== '0';
  const r = rng(seedFrom(`${el.className}${++uid}`));
  const drop = droplet();
  const micro0 = microDrop();
  const soft = brush();
  const ratioMax = isMobile ? 1.5 : 2;

  // Calque 1 : semis statique ; calque 2 : grosses gouttes (petites zones redessinées).
  const micro = createLayer(el, { className: 'fx-droplets fx-droplets--micro', dpr: Math.min(ratioMax, window.devicePixelRatio || 1), onResize: () => prepRefraction().finally(paintMicro) });
  const live = reducedMotion ? null : createLayer(el, { className: 'fx-droplets fx-droplets--live', dpr: Math.min(ratioMax, window.devicePixelRatio || 1), onResize: () => resetLive() });
  const mctx = micro.ctx;

  /*
   * Réfraction : une goutte est une petite lentille qui montre le décor alentour, inversé.
   * On prépare une fois l'image du conteneur tournée de 180° (demi-résolution, éclaircie) ;
   * chaque goutte en affiche, dans son disque, une zone ~4× plus large que son rayon.
   */
  let refr = null;
  const RS = 0.5;
  const LENS = 4.2;
  async function prepRefraction() {
    const img = findImage(el);
    if (!img || !(await imageReady(img)) || !micro.w) return;
    const w = Math.max(2, Math.round(micro.w * RS));
    const h = Math.max(2, Math.round(micro.h * RS));
    const flat = makeCanvas(w, h);
    const f = flat.getContext('2d');
    f.setTransform(RS, 0, 0, RS, 0, 0);
    drawImageAsDisplayed(f, img, el);
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.translate(w, h);
    g.rotate(Math.PI);
    g.drawImage(flat, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(235,246,255,0.14)';
    g.fillRect(0, 0, w, h);
    refr = c;
  }

  function lens(ctx, x, y, rad, stretch) {
    const cy = y - (stretch - 1) * rad * 0.5;
    const src = rad * LENS * RS;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, cy, rad * 0.93, rad * 0.93 * stretch, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(refr, (micro.w - x) * RS - src / 2, (micro.h - y) * RS - src / 2, src, src, x - rad, cy - rad * stretch, rad * 2, rad * 2 * stretch);
    ctx.restore();
  }

  /** Dessine une goutte de rayon `rad` centrée en (x, y), éventuellement étirée (lentille + sprite). */
  function blit(ctx, x, y, rad, stretch = 1) {
    if (refr && rad >= 2) lens(ctx, x, y, rad, stretch);
    const k = rad / drop.R;
    const s = drop.S * k;
    ctx.drawImage(drop.canvas, x - s / 2, y - (s * stretch) / 2 - (stretch - 1) * rad * 0.5, s, s * stretch);
  }

  /** Micro-gouttelette (texture de buée), éventuellement ovale et inclinée (gouttes fusionnées). */
  function blitMicro(ctx, x, y, rad, ax = 1, rot = 0) {
    const s = (micro0.S * rad) / micro0.R;
    if (ax === 1) {
      ctx.drawImage(micro0.canvas, x - s / 2, y - s / 2, s, s);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(micro0.canvas, (-s * ax) / 2, -s / 2, s * ax, s);
    ctx.restore();
  }

  /** Taille en loi de puissance : beaucoup de minuscules, quelques grosses. */
  const microSize = () => 0.7 + 3.2 * r() ** 3.2;

  function paintMicro() {
    const W = micro.w;
    const H = micro.h;
    if (!W || !H) return;
    mctx.setTransform(micro.ratio, 0, 0, micro.ratio, 0, 0);
    mctx.clearRect(0, 0, W, H);
    if (haze) {
      // Buée : plus dense sur les bords (la surface est plus froide là où elle est exposée).
      const g = mctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.15, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, 'rgba(235,246,255,0.06)');
      g.addColorStop(1, 'rgba(235,246,255,0.34)');
      mctx.fillStyle = g;
      mctx.fillRect(0, 0, W, H);
    }
    const area = W * H;
    // 1) Buée : un tapis serré de micro-gouttelettes (zones plus denses, d'autres plus clairsemées).
    const n = Math.round(clamp((area / (lowPower ? 110 : 70)) * density, 200, isMobile ? 2600 : 4200));
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      const y = (1 - (1 - r()) ** 1.2) * H;
      // Plus dense sur les bords.
      const ex = Math.min(x, W - x) / (W / 2);
      const ey = Math.min(y, H - y) / (H / 2);
      if (r() < Math.min(ex, ey) * 0.45) continue;
      mctx.globalAlpha = 0.55 + r() * 0.45;
      blitMicro(mctx, x, y, 0.7 + 1.6 * r() ** 2);
    }
    // 2) Gouttelettes : tailles en loi de puissance, certaines ovales (deux gouttes qui ont fusionné).
    const m = Math.round(clamp((area / 900) * density, 20, 260));
    for (let i = 0; i < m; i++) {
      const rad = microSize();
      mctx.globalAlpha = 0.9;
      if (rad < 2.2) blitMicro(mctx, r() * W, r() * H, rad * 1.1, r() < 0.3 ? r.range(1.2, 1.7) : 1, r() * Math.PI);
      else blit(mctx, r() * W, r() * H, rad, r.range(1, 1.15));
    }
    // 3) Quelques gouttes moyennes posées.
    const k = Math.round(clamp((area / 9000) * density, 4, 40));
    for (let i = 0; i < k; i++) {
      mctx.globalAlpha = 0.95;
      blit(mctx, r() * W, r() * H, r.range(3.4, 5.8), r.range(1, 1.12));
    }
    mctx.globalAlpha = 1;
  }

  // Changement de source (srcset) : on recalcule la réfraction.
  findImage(el)?.addEventListener('load', () => prepRefraction().finally(paintMicro));

  if (reducedMotion) return; // condensation figée

  const lctx = live.ctx;
  let drops = [];
  const trail = []; // points de traînée {x, y, w, t}
  let clock = 0;
  let refogTimer = 0;

  function newDrop(d = {}, anywhere = true) {
    const W = live.w;
    const H = live.h;
    d.x = r.range(10, W - 10);
    d.y = anywhere ? r.range(8, H * 0.78) : r.range(8, H * 0.5);
    d.rad = r.range(2.2, 3.6);
    d.max = r.range(5.6, 8.6) * (isMobile ? 0.9 : 1);
    d.grow = r.range(0.25, 0.7); // px/s
    d.sliding = false;
    d.v = 0;
    d.pause = 0;
    d.wob = r() * 10;
    d.lastBead = 0;
    d.prev = null;
    d.box = null;
    // Démarrage échelonné : certaines gouttes sont déjà presque mûres.
    if (anywhere) d.rad = r.range(d.rad, d.max * 0.92);
    return d;
  }

  function resetLive() {
    if (!live.w) return;
    const n = Math.round(clamp((live.w * live.h) / 34000 * density, 2, isMobile ? 5 : 8));
    drops = Array.from({ length: n }, () => newDrop({}, true));
    lctx.setTransform(live.ratio, 0, 0, live.ratio, 0, 0);
    lctx.clearRect(0, 0, live.w, live.h);
  }

  /** Efface la buée le long de la traînée (et laisse quelques perles). */
  function wipeTrail(x0, y0, x1, y1, rad) {
    mctx.save();
    mctx.globalCompositeOperation = 'destination-out';
    const w = rad * 2.1;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (rad * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      mctx.globalAlpha = 0.9;
      mctx.drawImage(soft, x - w / 2, y - w / 2, w, w);
    }
    mctx.restore();
    const lastP = trail[trail.length - 1];
    if (!lastP || Math.abs(lastP.y - y1) + Math.abs(lastP.x - x1) > 10) trail.push({ x: x1, y: y1, w: rad, t: clock, n: 0 });
  }

  function release(d) {
    if (d.sliding) return;
    d.sliding = true;
    d.v = r.range(8, 20);
  }

  if (finePointer) {
    el.addEventListener(
      'pointermove',
      (e) => {
        const b = el.getBoundingClientRect();
        const x = e.clientX - b.left;
        const y = e.clientY - b.top;
        for (const d of drops) {
          if (!d.sliding && d.rad > d.max * 0.55 && Math.hypot(d.x - x, d.y - y) < d.rad + 16) release(d);
        }
      },
      { passive: true },
    );
  }

  const task = createTask('droplets', (dt) => {
    const W = live.w;
    const H = live.h;
    if (!W || !H) return;
    clock += dt;
    lctx.setTransform(live.ratio, 0, 0, live.ratio, 0, 0);

    // 1) Effacer les zones dessinées à l'image précédente.
    for (const d of drops) {
      if (d.box) lctx.clearRect(d.box[0], d.box[1], d.box[2], d.box[3]);
    }

    // 2) Physique.
    for (const d of drops) {
      if (!d.sliding) {
        d.rad = Math.min(d.max, d.rad + d.grow * dt);
        if (d.rad >= d.max) release(d);
      } else {
        // Glisse par à-coups : la goutte accroche la surface puis repart.
        if (d.pause > 0) {
          d.pause -= dt;
          d.v *= Math.exp(-10 * dt);
        } else {
          const target = 40 + d.rad * 16;
          d.v += (target - d.v) * (1 - Math.exp(-2.2 * dt));
          if (r() < dt * 0.9) d.pause = r.range(0.08, 0.45);
        }
        const px = d.x;
        const py = d.y;
        d.y += d.v * dt;
        d.x += Math.sin(clock * 2.2 + d.wob) * 6 * dt + r.range(-1, 1) * 6 * dt;
        d.x = clamp(d.x, 4, W - 4);
        wipeTrail(px, py, d.x, d.y, d.rad * 0.78);
        // Elle perd de l'eau en route (petites perles laissées derrière).
        d.lastBead += d.y - py;
        if (d.lastBead > r.range(10, 24)) {
          d.lastBead = 0;
          d.rad = Math.max(2.6, d.rad - 0.12);
          mctx.globalAlpha = 0.95;
          blitMicro(mctx, px + r.range(-1.5, 1.5), py - d.rad, r.range(1.2, 2.4));
          mctx.globalAlpha = 1;
        }
        // Absorbe les gouttes rencontrées.
        for (const o of drops) {
          if (o === d || o.sliding) continue;
          if (Math.abs(o.x - d.x) < d.rad + o.rad && Math.abs(o.y - d.y) < d.rad + o.rad) {
            d.rad = Math.min(11, Math.cbrt(d.rad ** 3 + o.rad ** 3));
            d.v += 20;
            o.box && lctx.clearRect(o.box[0], o.box[1], o.box[2], o.box[3]);
            newDrop(o, false);
            o.rad = 1.6;
          }
        }
        if (d.y - d.rad * 2 > H) {
          newDrop(d, false);
          d.rad = 1.4;
        }
      }
    }

    // 3) Dessin des grosses gouttes (étirées quand elles glissent vite).
    for (const d of drops) {
      const stretch = d.sliding ? 1 + clamp(d.v / 260, 0, 0.45) : 1;
      blit(lctx, d.x, d.y, d.rad, stretch);
      const s = (drop.S * d.rad) / drop.R;
      const pad = 2;
      d.box = [d.x - s / 2 - pad, d.y - (s * stretch) / 2 - (stretch - 1) * d.rad * 0.5 - pad, s + pad * 2, s * stretch + pad * 2];
    }

    // 4) La buée se reforme lentement dans les traînées.
    refogTimer += dt;
    if (refogTimer > 0.35 && trail.length) {
      refogTimer = 0;
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i];
        const age = clock - p.t;
        if (age > 22) {
          trail.splice(i, 1);
          continue;
        }
        if (age > 3 && p.n < 4 && r() < 0.12) {
          p.n++;
          if (haze) {
            // Un voile de buée revient par petites touches.
            const hx = p.x + r.range(-p.w, p.w);
            const hy = p.y + r.range(-8, 8);
            const hr = p.w * 2.4;
            const g = mctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
            g.addColorStop(0, 'rgba(235,246,255,0.06)');
            g.addColorStop(1, 'rgba(235,246,255,0)');
            mctx.fillStyle = g;
            mctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
          }
          mctx.globalAlpha = 0.85;
          for (let j = 0; j < 3; j++) blitMicro(mctx, p.x + r.range(-p.w * 1.2, p.w * 1.2), p.y + r.range(-8, 8), 0.7 + 1.4 * r() ** 2);
          mctx.globalAlpha = 1;
        }
      }
    }
  });

  watchVisibility(el, (on) => (on ? task.start() : task.stop()), { margin: '60px 0px' });
}
