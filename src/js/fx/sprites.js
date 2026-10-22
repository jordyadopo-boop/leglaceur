/**
 * Textures procédurales mises en cache (générées une seule fois, puis réutilisées par drawImage) :
 * scintillement, goutte d'eau, pinceau doux, nappes et bouffées de brume, grain de givre.
 */
import { createNoise } from './noise.js';
import { rng, smoothstep } from './env.js';

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * Cristal scintillant : halo bleu glacier + cœur blanc (+ éclat en croix pour 'star').
 * Lisible sur fond clair (halo bleu) comme sur fond marine (cœur blanc).
 */
export function sparkle(kind = 'dot') {
  return memo(`sparkle:${kind}`, () => {
    const S = 64;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const m = S / 2;
    const halo = g.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, 'rgba(255,255,255,1)');
    halo.addColorStop(0.12, 'rgba(235,247,255,0.95)');
    halo.addColorStop(0.3, 'rgba(142,207,255,0.55)');
    halo.addColorStop(0.6, 'rgba(77,155,255,0.16)');
    halo.addColorStop(1, 'rgba(77,155,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, S, S);
    if (kind === 'star') {
      g.globalCompositeOperation = 'lighter';
      for (const [len, wid, rot] of [
        [m, 1.6, 0],
        [m, 1.6, Math.PI / 2],
        [m * 0.55, 1.1, Math.PI / 4],
        [m * 0.55, 1.1, -Math.PI / 4],
      ]) {
        g.save();
        g.translate(m, m);
        g.rotate(rot);
        const lg = g.createLinearGradient(-len, 0, len, 0);
        lg.addColorStop(0, 'rgba(191,228,255,0)');
        lg.addColorStop(0.5, 'rgba(255,255,255,0.95)');
        lg.addColorStop(1, 'rgba(191,228,255,0)');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(-len, 0);
        g.quadraticCurveTo(0, -wid, len, 0);
        g.quadraticCurveTo(0, wid, -len, 0);
        g.fill();
        g.restore();
      }
    }
    return c;
  });
}

/**
 * Goutte d'eau sur une vitre : ombre portée, liseré sombre (réfraction), caustique claire
 * en bas, reflet spéculaire en haut à gauche. Rayon de référence R = 40 px.
 */
export function droplet() {
  return memo('droplet', () => {
    const R = 40;
    const S = 112;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const m = S / 2;
    // ombre de contact
    const sh = g.createRadialGradient(m + 2, m + R * 0.22, R * 0.5, m + 2, m + R * 0.22, R * 1.12);
    sh.addColorStop(0, 'rgba(4,14,36,0.22)');
    sh.addColorStop(1, 'rgba(4,14,36,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.ellipse(m + 2, m + R * 0.22, R * 1.12, R * 1.02, 0, 0, Math.PI * 2);
    g.fill();
    // corps : centre presque transparent, bord assombri (la goutte inverse le décor)
    g.save();
    g.beginPath();
    g.arc(m, m, R, 0, Math.PI * 2);
    g.clip();
    const body = g.createRadialGradient(m, m - R * 0.18, R * 0.1, m, m, R);
    body.addColorStop(0, 'rgba(255,255,255,0.10)');
    body.addColorStop(0.55, 'rgba(214,236,255,0.10)');
    body.addColorStop(0.82, 'rgba(15,44,94,0.24)');
    body.addColorStop(1, 'rgba(10,31,68,0.46)');
    g.fillStyle = body;
    g.fillRect(0, 0, S, S);
    // caustique : la lumière se concentre en bas de la goutte
    const ca = g.createRadialGradient(m, m + R * 0.62, 0, m, m + R * 0.62, R * 0.75);
    ca.addColorStop(0, 'rgba(255,255,255,0.75)');
    ca.addColorStop(0.5, 'rgba(227,243,255,0.28)');
    ca.addColorStop(1, 'rgba(227,243,255,0)');
    g.fillStyle = ca;
    g.fillRect(0, 0, S, S);
    g.restore();
    // liseré lumineux, plus intense en bas
    const rim = g.createLinearGradient(0, m - R, 0, m + R);
    rim.addColorStop(0, 'rgba(255,255,255,0.18)');
    rim.addColorStop(0.55, 'rgba(255,255,255,0.08)');
    rim.addColorStop(1, 'rgba(255,255,255,0.8)');
    g.strokeStyle = rim;
    g.lineWidth = R * 0.07;
    g.beginPath();
    g.arc(m, m, R * 0.965, 0, Math.PI * 2);
    g.stroke();
    // reflet spéculaire
    g.save();
    g.translate(m - R * 0.36, m - R * 0.42);
    g.rotate(-0.65);
    const sp = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.26);
    sp.addColorStop(0, 'rgba(255,255,255,1)');
    sp.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sp;
    g.scale(1, 0.58);
    g.beginPath();
    g.arc(0, 0, R * 0.26, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(m + R * 0.32, m + R * 0.38, R * 0.06, 0, Math.PI * 2);
    g.fill();
    return { canvas: c, R, S };
  });
}

/** Trace mouillée claire laissée par une goutte qui glisse (bande verticale douce). */
export function streak() {
  return memo('streak', () => {
    const c = makeCanvas(32, 32);
    const g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 32, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, 32, 32);
    return c;
  });
}

/** Pinceau doux (disque à bord progressif) pour essuyer / effacer. */
export function brush() {
  return memo('brush', () => {
    const S = 128;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(0.45, 'rgba(0,0,0,0.92)');
    rg.addColorStop(0.75, 'rgba(0,0,0,0.45)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, S, S);
    return c;
  });
}

/** Grain de givre raccordable (taches claires irrégulières). */
export function grain() {
  return memo('grain', () => {
    const S = 160;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const { fbm } = createNoise(23);
    const r = rng(5);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const n = fbm((x / S) * 8, (y / S) * 8, 3, 8, 8);
        const speck = r() ** 6;
        const a = Math.min(1, smoothstep(0.42, 0.78, n) * 0.55 + speck * 0.65);
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** Bouffées de brume (4 variantes) : nuages de bruit à bord très doux. */
export function fogPuffs() {
  return memo('fogPuffs', () => {
    const out = [];
    const S = 128;
    for (let v = 0; v < 4; v++) {
      const c = makeCanvas(S, S);
      const g = c.getContext('2d');
      const img = g.createImageData(S, S);
      const { fbm } = createNoise(101 + v * 17);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const nx = x / S - 0.5;
          const ny = y / S - 0.5;
          const d = Math.hypot(nx, ny * 1.15) * 2;
          const fall = smoothstep(1, 0.15, d);
          const n = fbm(x / 34 + v * 3.1, y / 34, 4);
          const a = fall * fall * smoothstep(0.3, 0.75, n);
          const i = (y * S + x) * 4;
          img.data[i] = 255;
          img.data[i + 1] = 255;
          img.data[i + 2] = 255;
          img.data[i + 3] = a * 255;
        }
      }
      g.putImageData(img, 0, 0);
      out.push(c);
    }
    return out;
  });
}

/** Nappe de brume raccordable horizontalement (dense en bas, effilochée en haut). */
export function fogBank(seed = 1) {
  return memo(`fogBank:${seed}`, () => {
    const W = 512;
    const H = 128;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const { fbm } = createNoise(300 + seed);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const n = fbm((x / W) * 6, v * 2.2 + seed, 5, 6, 0);
        const edge = n * 0.9 + 0.35 - (1 - v) * 1.05; // plus dense vers le bas
        const a = smoothstep(0, 0.55, edge) * smoothstep(0, 0.35, v);
        const i = (y * W + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}
