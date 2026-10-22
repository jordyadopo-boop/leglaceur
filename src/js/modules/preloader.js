/**
 * Préchargeur de l'accueil (agent chrome) : 32 °C → −18 °C, le givre gagne, le symbole se dessine, la vitre se brise.
 * ≈ 2 s, une fois par session (sessionStorage 'lg:intro'). Émet window 'preloader:done' dès que la vitre cède
 * (le hero peut lancer son intro pendant la chute des éclats) — immédiatement s'il est sauté.
 */
import { gsap, reducedMotion, stopScroll, startScroll } from '../core/motion.js';

const NS = 'http://www.w3.org/2000/svg';
const KEY = 'lg:intro';
const FROM = 32;
const TO = -18;

export default function init(el) {
  const html = document.documentElement;
  let finished = false;

  const done = () => {
    if (finished) return;
    finished = true;
    html.classList.add('preloader-done');
    html.classList.remove('preload-lock');
    startScroll();
    if (!window.__lgPreloaderDone) {
      window.__lgPreloaderDone = true;
      window.dispatchEvent(new Event('preloader:done'));
    }
  };
  const remove = () => { done(); html.classList.remove('preload', 'preload-running'); el.remove(); };

  if (reducedMotion || !html.classList.contains('preload') || window.__lgPreloaderDone) { remove(); return; }
  try { sessionStorage.setItem(KEY, '1'); } catch { /* stockage indisponible */ }
  clearTimeout(window.__lgPreTimer); // la séquence prend le relais du filet de sécurité
  html.classList.add('preload-running');

  html.classList.add('preload-lock');
  stopScroll();
  if (window.scrollY) window.scrollTo(0, 0);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const C = { x: W * 0.5, y: Math.min(H * 0.42, H * 0.5 - 40) };
  const q = (s) => el.querySelector(s);

  const crystals = q('[data-pre-crystals]');
  const cracks = q('[data-pre-cracks]');
  const temp = q('[data-pre-temp]');
  const tempWrap = q('.preloader__temp');
  const cursor = q('[data-pre-fill]');
  const content = q('.preloader__content');
  const mark = q('.preloader__mark .brand-mark');

  const crystalPaths = growFrost(crystals, W, H);
  const geo = fracture(W, H, C);
  drawCracks(cracks, geo, W, H);
  const crackPaths = cracks.querySelectorAll('path');

  /* ---------- Symbole ---------- */
  const gPaths = mark ? mark.querySelectorAll('.lg-g path') : [];
  gsap.set(gPaths, { stroke: 'currentColor', strokeWidth: 6, fillOpacity: 0, color: '#0a1f44' });

  /* ---------- Séquence ---------- */
  const t = { v: FROM };
  const warm = '#b9531a';
  const cold = '#1563d6';
  const mix = gsap.utils.interpolate(warm, cold);
  const tl = gsap.timeline({ defaults: { ease: 'ice' } });

  tl.from(content, { opacity: 0, y: 18, scale: 0.96, duration: 0.5 }, 0)
    // le froid gagne
    .to(t, {
      v: TO, duration: 1.3, ease: 'power2.inOut',
      onUpdate() {
        const r = Math.round(t.v);
        temp.textContent = r < 0 ? `−${Math.abs(r)}` : String(r);
        const p = (FROM - t.v) / (FROM - TO);
        tempWrap.style.setProperty('--pre-c', mix(p));
        cursor.style.left = `${(1 - p) * 100}%`;
      },
    }, 0.05)
    .to(q('.preloader__cold'), { opacity: 1, duration: 1.1, ease: 'power1.inOut' }, 0.15)
    .to(q('.preloader__heat'), { opacity: 0, duration: 1, ease: 'power1.in' }, 0.35)
    .fromTo(q('.preloader__frost'), { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 0.3)
    .fromTo(crystalPaths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'power2.out', stagger: { amount: 0.55, from: 'random' } }, 0.2)
    // le symbole se dessine
    .fromTo(gPaths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.8, ease: 'power2.inOut', stagger: 0.1 }, 0.1)
    .to(gPaths, { fillOpacity: 1, strokeOpacity: 0, duration: 0.45, ease: 'power1.out' }, 0.75)
    .from(mark ? mark.querySelectorAll('.lg-cube') : [], { y: -60, rotation: -10, opacity: 0, transformOrigin: '50% 100%', duration: 0.7, ease: 'back.out(2)' }, 0.55)
    .from(mark ? mark.querySelectorAll('.lg-wave') : [], { x: -50, opacity: 0, duration: 0.6 }, 0.7)
    .from(mark ? mark.querySelectorAll('.lg-leaf') : [], { scale: 0, rotation: -40, transformOrigin: '0% 100%', duration: 0.6, ease: 'back.out(2.4)' }, 0.9)
    .fromTo(mark ? mark.querySelectorAll('.lg-glint') : [], { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1.3, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }, 1.1)
    // impact : la vitre se fissure
    .to(content, { scale: 1.04, duration: 0.12, ease: 'power2.out' }, 1.36)
    .fromTo(crackPaths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.2, ease: 'power3.out', stagger: 0.003 }, 1.36)
    .to(el, { x: 3, duration: 0.04, yoyo: true, repeat: 3, ease: 'none' }, 1.38)
    .add(() => shatter(), 1.56);

  function shatter() {
    const svg = buildShards(el, geo, W, H);
    const flash = q('.preloader__flash');
    gsap.set(q('.preloader__pane'), { opacity: 0 });
    gsap.timeline()
      .fromTo(flash, { opacity: 0.85 }, { opacity: 0, duration: 0.35, ease: 'power2.out' }, 0)
      .to(content, { opacity: 0, scale: 1.12, filter: 'blur(10px)', duration: 0.35, ease: 'power2.in' }, 0);
    el.style.background = 'transparent';
    done();
    const groups = [...svg.querySelectorAll('g[data-shard]')];
    let last = 0;
    groups.forEach((g) => {
      const ring = Number(g.dataset.ring);
      const cx = Number(g.dataset.cx);
      const cy = Number(g.dataset.cy);
      const dx = cx - C.x;
      const dy = cy - C.y;
      const len = Math.hypot(dx, dy) || 1;
      const push = gsap.utils.random(40, 140) / (ring + 1);
      const delay = ring * 0.045 + gsap.utils.random(0, 0.06);
      const dur = gsap.utils.random(0.75, 1.05);
      last = Math.max(last, delay + dur);
      gsap.set(g, { svgOrigin: `${cx} ${cy}` });
      gsap.to(g, { x: (dx / len) * push * 2.2 + gsap.utils.random(-20, 20), duration: dur, delay, ease: 'power1.out' });
      gsap.to(g, { y: (dy / len) * push + H * gsap.utils.random(0.7, 1.15), duration: dur, delay, ease: 'power2.in' });
      gsap.to(g, { rotation: gsap.utils.random(-70, 70), scale: gsap.utils.random(0.82, 0.98), duration: dur, delay, ease: 'power1.in' });
      gsap.to(g, { opacity: 0, duration: 0.3, delay: delay + dur - 0.3, ease: 'none' });
    });
    gsap.delayedCall(last + 0.05, remove);
  }

  // sécurité : jamais plus de 3 s
  gsap.delayedCall(3, () => { if (!finished) { tl.progress(1); } });
  window.addEventListener('pagehide', remove, { once: true });
}

/* ===================================================================== */

const rand = (a, b) => a + Math.random() * (b - a);
const f = (n) => Math.round(n * 10) / 10;

/** Cristaux de givre dendritiques qui poussent depuis les coins et les bords. */
function growFrost(svg, W, H) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const D = Math.hypot(W, H);
  const seeds = [
    { x: 0, y: 0, a: Math.PI / 4 }, { x: W, y: 0, a: (3 * Math.PI) / 4 },
    { x: 0, y: H, a: -Math.PI / 4 }, { x: W, y: H, a: (-3 * Math.PI) / 4 },
  ];
  // frange de givre tout le long des bords
  const step = Math.max(110, Math.min(W, H) / 4);
  for (let x = step * 0.7; x < W - step * 0.4; x += step * rand(0.8, 1.2)) {
    seeds.push({ x, y: 0, a: Math.PI / 2, small: true }, { x: x + step * 0.4, y: H, a: -Math.PI / 2, small: true });
  }
  for (let y = step * 0.7; y < H - step * 0.4; y += step * rand(0.8, 1.2)) {
    seeds.push({ x: 0, y, a: 0, small: true }, { x: W, y: y + step * 0.4, a: Math.PI, small: true });
  }
  const glow = [];
  const main = [];
  const twigs = [];
  for (const s of seeds) {
    const n = s.small ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const a = s.a + rand(-0.75, 0.75);
      const L = s.small ? Math.min(D * rand(0.05, 0.09), 150) : D * rand(0.13, 0.24);
      let x = s.x;
      let y = s.y;
      let d = `M${f(x)} ${f(y)}`;
      const segs = 5;
      const pts = [];
      let ang = a;
      for (let k = 1; k <= segs; k++) {
        ang += rand(-0.18, 0.18);
        x += Math.cos(ang) * (L / segs);
        y += Math.sin(ang) * (L / segs);
        d += ` L${f(x)} ${f(y)}`;
        pts.push({ x, y, ang });
      }
      main.push(d);
      glow.push(d);
      // rameaux à 60° de part et d'autre (forme de cristal de givre)
      pts.slice(0, -1).forEach((p, k) => {
        const l = (L / segs) * rand(0.7, 1.4) * (1 - k / segs * 0.6);
        let t = '';
        for (const side of [-1, 1]) {
          if (Math.random() < 0.15) continue;
          const b = p.ang + side * Math.PI / 3;
          const ex = p.x + Math.cos(b) * l;
          const ey = p.y + Math.sin(b) * l;
          t += `M${f(p.x)} ${f(p.y)} L${f(ex)} ${f(ey)}`;
          const mx = p.x + Math.cos(b) * l * 0.55;
          const my = p.y + Math.sin(b) * l * 0.55;
          const bb = b + side * Math.PI / 3 * -1;
          t += ` M${f(mx)} ${f(my)} L${f(mx + Math.cos(bb) * l * 0.35)} ${f(my + Math.sin(bb) * l * 0.35)}`;
        }
        if (t) twigs.push(t);
      });
    }
  }
  const frag = document.createDocumentFragment();
  const add = (d, cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); frag.append(p); return p; };
  const out = [];
  glow.forEach((d) => out.push(add(d, 'c-glow')));
  main.forEach((d) => out.push(add(d, 'c-main')));
  twigs.forEach((d) => out.push(add(d, 'c-twig')));
  svg.append(frag);
  return out;
}

/** Géométrie de fracture radiale : rayons + anneaux autour du point d'impact. */
function fracture(W, H, C) {
  const n = W < 700 ? 9 : 12;
  const R = Math.hypot(Math.max(C.x, W - C.x), Math.max(C.y, H - C.y)) * 1.15;
  const radii = [0, R * 0.1, R * 0.26, R * 0.5, R];
  const start = rand(0, Math.PI * 2);
  const angles = Array.from({ length: n }, (_, i) => start + (i / n) * Math.PI * 2 + rand(-0.18, 0.18));
  // grille de points (anneau j, rayon i), avec un peu de désordre
  const P = radii.map((r, j) => angles.map((a) => {
    if (j === 0) return { x: C.x, y: C.y };
    const rr = j === radii.length - 1 ? r : r * rand(0.82, 1.18);
    return { x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr };
  }));
  const cells = [];
  for (let j = 0; j < radii.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      const pts = j === 0 ? [P[0][0], P[1][i], P[1][i2]] : [P[j][i], P[j + 1][i], P[j + 1][i2], P[j][i2]];
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      cells.push({ pts, ring: j, cx, cy });
    }
  }
  return { P, n, cells };
}

function drawCracks(svg, geo, W, H) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const { P, n } = geo;
  const frag = document.createDocumentFragment();
  const add = (d, cls = '') => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); if (cls) p.setAttribute('class', cls); frag.append(p); };
  // rayons (du centre vers l'extérieur, jusqu'au 3e anneau)
  for (let i = 0; i < n; i++) {
    let d = `M${f(P[0][0].x)} ${f(P[0][0].y)}`;
    for (let j = 1; j < P.length - 1; j++) d += ` L${f(P[j][i].x)} ${f(P[j][i].y)}`;
    add(d);
    add(d, 'k-dark');
  }
  // anneaux intérieurs
  for (let j = 1; j < P.length - 2; j++) {
    for (let i = 0; i < n; i++) {
      const a = P[j][i];
      const b = P[j][(i + 1) % n];
      add(`M${f(a.x)} ${f(a.y)} L${f(b.x)} ${f(b.y)}`);
    }
  }
  svg.append(frag);
}

function buildShards(host, geo, W, H) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'preloader__shards');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs>
    <radialGradient id="pre-glass" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${H * 0.42}" r="${Math.hypot(W, H) * 0.6}">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#eef7ff"/><stop offset="1" stop-color="#c9e7ff"/>
    </radialGradient>
    <linearGradient id="pre-sheen" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">
      <stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".6" stop-color="#bfe4ff" stop-opacity="0"/><stop offset="1" stop-color="#8ecfff" stop-opacity=".45"/>
    </linearGradient></defs>`;
  for (const c of geo.cells) {
    const g = document.createElementNS(NS, 'g');
    g.dataset.shard = '';
    g.dataset.ring = String(c.ring);
    g.dataset.cx = String(f(c.cx));
    g.dataset.cy = String(f(c.cy));
    const pts = c.pts.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
    g.innerHTML = `<polygon points="${pts}" fill="url(#pre-glass)"/><polygon points="${pts}" fill="url(#pre-sheen)" stroke="none"/><polygon class="s-edge" points="${pts}"/>`;
    svg.append(g);
  }
  host.append(svg);
  return svg;
}
