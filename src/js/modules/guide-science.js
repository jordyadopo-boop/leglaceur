/**
 * Guide — démonstration « même volume, surface multipliée » (agent guide).
 * Un bloc de 4 cm de côté (64 cm³) est découpé en 1, 8 puis 64 cubes, dessinés en isométrie (SVG).
 * À chaque changement : les morceaux se resserrent, les lignes de coupe apparaissent, puis les cubes s'écartent.
 * Calcul exact : n morceaux par arête → n³ cubes d'arête 4/n → surface totale 6 × 4² × n = 96 n cm² ; S/V = 1,5 n cm⁻¹.
 * Le contrôle est un groupe de boutons radio natifs (clavier, lecteurs d'écran) ; lecture en direct via aria-live.
 * Mouvement réduit : changement d'état instantané, sans démonstration automatique.
 */
import { gsap, ScrollTrigger, reducedMotion } from '../core/motion.js';

const SIDE = 4; // cm
const K = 23; // pixels SVG par cm
const C30 = Math.cos(Math.PI / 6);
const GAP = { 1: 0, 2: 0.55, 4: 0.32 }; // écartement final (cm) selon le découpage
const NS = 'http://www.w3.org/2000/svg';
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

const iso = (x, y, z) => [(x - y) * C30 * K, (x + y) * 0.5 * K - z * K];
const pts = (arr) => arr.map((p) => iso(...p).map((v) => v.toFixed(2)).join(',')).join(' ');

function cubeGroup(x0, y0, z0, s) {
  const x1 = x0 + s, y1 = y0 + s, z1 = z0 + s;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'g-dil__cube');
  const faces = [
    ['g-dil__f g-dil__f--r', [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], 'url(#gi-r)'],
    ['g-dil__f g-dil__f--l', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 'url(#gi-l)'],
    ['g-dil__f g-dil__f--t', [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 'url(#gi-t)'],
  ];
  for (const [cls, p, fill] of faces) {
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('class', cls);
    poly.setAttribute('points', pts(p));
    poly.setAttribute('fill', fill);
    g.append(poly);
  }
  // petit reflet sur la face supérieure
  const hi = document.createElementNS(NS, 'polygon');
  hi.setAttribute('class', 'g-dil__hi');
  hi.setAttribute('points', pts([[x0 + s * 0.12, y0 + s * 0.1, z1], [x0 + s * 0.55, y0 + s * 0.1, z1], [x0 + s * 0.42, y0 + s * 0.22, z1], [x0 + s * 0.12, y0 + s * 0.22, z1]]));
  g.append(hi);
  return g;
}

export default function init(el) {
  const box = el.querySelector('[data-g-dil]');
  if (!box) return;
  const holder = box.querySelector('[data-g-dil-cubes]');
  const radios = [...box.querySelectorAll('input[name="g-dil"]')];
  const areaEl = box.querySelector('[data-g-dil-area]');
  const multEl = box.querySelector('[data-g-dil-mult]');
  const rows = [...box.querySelectorAll('[data-g-dil-row]')];
  const seg = box.querySelector('[data-g-seg]');
  const puck = box.querySelector('[data-g-seg-puck]');
  const svg = box.querySelector('[data-g-dil-svg]');
  // Cadre qui contient le cas le plus écarté (64 cubes) : rien ne bouge en changeant d'état.
  const ext = SIDE + 3 * GAP[4];
  const w = ext * C30 * K * 2 + 24;
  const h = ext * K * 2 + 24;
  svg.setAttribute('viewBox', `${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);

  let n = 1;
  let cubes = [];
  const gap = { v: 0 };
  let tl = null;
  const area = { v: 96 };

  function build(count) {
    holder.replaceChildren();
    const s = SIDE / count;
    const half = SIDE / 2;
    const list = [];
    for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) for (let l = 0; l < count; l++) list.push([i, j, l]);
    list.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
    cubes = list.map(([i, j, l]) => {
      const g = cubeGroup(i * s - half, j * s - half, l * s - half, s);
      holder.append(g);
      const c = (count - 1) / 2;
      return { g, di: i - c, dj: j - c, dl: l - c };
    });
    holder.dataset.count = count;
  }

  function applyGap() {
    for (const c of cubes) {
      const [dx, dy] = iso(c.di * gap.v, c.dj * gap.v, c.dl * gap.v);
      c.g.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    }
  }

  function readout(count, animate) {
    const total = 6 * SIDE * SIDE * count; // 96 n
    rows.forEach((r) => r.classList.toggle('is-active', r.dataset.gDilRow === String(count)));
    multEl.textContent = `×${count}`;
    if (!animate) { area.v = total; areaEl.textContent = nf.format(total); return; }
    gsap.to(area, { v: total, duration: 1.2, ease: 'power3.out', onUpdate: () => { areaEl.textContent = nf.format(Math.round(area.v)); } });
  }

  function movePuck(animate) {
    const lab = radios.find((r) => r.checked)?.closest('label');
    if (!lab || !puck) return;
    const x = lab.offsetLeft;
    const wdt = lab.offsetWidth;
    if (animate) gsap.to(puck, { x, width: wdt, duration: 0.6, ease: 'ice' });
    else gsap.set(puck, { x, width: wdt });
  }

  function go(count, animate = !reducedMotion) {
    if (count === n && cubes.length) return;
    n = count;
    tl?.kill();
    readout(count, animate);
    movePuck(animate);
    if (!animate) { build(count); gap.v = GAP[count]; applyGap(); return; }
    tl = gsap.timeline();
    tl.to(gap, { v: 0, duration: 0.45, ease: 'power2.in', onUpdate: applyGap })
      .add(() => {
        build(count);
        gap.v = 0;
        applyGap();
        holder.classList.add('is-cut');
      })
      .fromTo(holder, { scale: 1.04, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'power2.out' })
      .to(gap, { v: GAP[count], duration: 1.15, ease: 'back.out(1.35)', onUpdate: applyGap }, '+=0.12')
      .add(() => holder.classList.remove('is-cut'), '-=0.6');
  }

  build(1);
  box.classList.add('is-live');
  seg?.classList.add('is-live');
  movePuck(false);
  radios.forEach((r) => r.addEventListener('change', () => r.checked && go(Number(r.value))));
  window.addEventListener('resize', () => movePuck(false), { passive: true });

  // Démonstration automatique au premier passage (1 → 8 → 64), interrompue dès que l'on interagit.
  if (!reducedMotion) {
    let touched = false;
    radios.forEach((r) => r.addEventListener('pointerdown', () => { touched = true; }, { once: true }));
    ScrollTrigger.create({
      trigger: box.querySelector('.g-dil__stage'), start: 'top 70%', once: true,
      onEnter: () => {
        const step = (val, delay) => gsap.delayedCall(delay, () => {
          if (touched) return;
          const r = radios.find((x) => x.value === String(val));
          if (r) { r.checked = true; go(val); }
        });
        step(2, 0.7);
        step(4, 2.9);
      },
    });
  }
}
