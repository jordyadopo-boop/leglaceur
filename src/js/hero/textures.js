/**
 * Textures procédurales de la scène du hero, dessinées sur canvas (aucun fichier image à charger).
 *  - makeIceMaps()     : normal map (micro-rayures, bulles d'air, craquelures, ondulations de fonte)
 *                        + carte de détails (R = transmission : cœur laiteux ; G = rugosité : arêtes givrées).
 *  - makeWordTexture() : le très grand mot « GLACEUR » en verre givré (Barlow Condensed 800).
 *  - makeGlintTexture(): éclat de lumière en étoile à 4 branches.
 *  - makeRingTexture() : onde de choc givrée (clic sur un glaçon).
 */
import * as THREE from 'three';

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas2d = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};

/* ------------------------------------------------------------------ */
/* Glaçon : relief (hauteur) → normal map                              */
/* ------------------------------------------------------------------ */
function paintHeight(N, rand) {
  const [c, g] = canvas2d(N);
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, N, N);

  // 1. Ondulations de fonte : grandes taches très douces.
  for (let i = 0; i < 46; i++) {
    const x = rand() * N, y = rand() * N, r = N * (0.06 + rand() * 0.26);
    const v = rand() < 0.5 ? 0 : 255;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v},${v},${v},0.09)`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  g.lineCap = 'round';
  // 2. Micro-rayures, regroupées par familles de directions (comme sur un vrai glaçon manipulé).
  const families = [rand() * Math.PI, rand() * Math.PI, rand() * Math.PI];
  for (let i = 0; i < 110; i++) {
    const a = families[i % 3] + (rand() - 0.5) * 0.35;
    const x = rand() * N, y = rand() * N, l = N * (0.02 + rand() * rand() * 0.24);
    const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
    g.strokeStyle = `rgba(0,0,0,${0.1 + rand() * 0.28})`;
    g.lineWidth = 0.5 + rand() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + dx + 1, y + dy + 1); g.stroke();
  }

  // 3. Craquelures internes : lignes brisées avec ramifications (forte réfraction).
  const crack = (x, y, a, len, depth) => {
    let px = x, py = y;
    const steps = 6 + Math.floor(rand() * 8);
    for (let s = 0; s < steps; s++) {
      a += (rand() - 0.5) * 0.9;
      const nx = px + Math.cos(a) * (len / steps), ny = py + Math.sin(a) * (len / steps);
      g.strokeStyle = `rgba(255,255,255,${0.35 + rand() * 0.3})`;
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(px + 1.2, py + 0.8); g.lineTo(nx + 1.2, ny + 0.8); g.stroke();
      if (depth > 0 && rand() < 0.25) crack(nx, ny, a + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.6), len * 0.45, depth - 1);
      px = nx; py = ny;
    }
  };
  for (let i = 0; i < 4; i++) crack(rand() * N, rand() * N, rand() * Math.PI * 2, N * (0.2 + rand() * 0.3), 2);

  // 4. Bulles d'air : petits dômes (centre clair, bord sombre).
  for (let i = 0; i < 150; i++) {
    const cx = N / 2 + (rand() + rand() + rand() - 1.5) * N * 0.42;
    const cy = N / 2 + (rand() + rand() + rand() - 1.5) * N * 0.42;
    const r = 0.8 + Math.pow(rand(), 3) * N * 0.012;
    const grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.7, 'rgba(160,160,160,0.25)');
    grd.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function heightToNormal(src, strength) {
  const N = src.width;
  const d = src.getContext('2d').getImageData(0, 0, N, N).data;
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) h[i] = d[i * 4] / 255;
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    const yu = ((y - 1 + N) % N) * N, yd = ((y + 1) % N) * N, yc = y * N;
    for (let x = 0; x < N; x++) {
      const xl = (x - 1 + N) % N, xr = (x + 1) % N;
      // Sobel
      const dx = (h[yu + xr] + 2 * h[yc + xr] + h[yd + xr]) - (h[yu + xl] + 2 * h[yc + xl] + h[yd + xl]);
      const dy = (h[yd + xl] + 2 * h[yd + x] + h[yd + xr]) - (h[yu + xl] + 2 * h[yu + x] + h[yu + xr]);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const o = (yc + x) * 4;
      out[o] = (nx * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * 0.5 + 0.5) * 255;
      out[o + 2] = (nz * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Glaçon : carte de détails (R = transmission, G = rugosité)          */
/* ------------------------------------------------------------------ */
function paintDetail(N, rand) {
  // Cœur laiteux (blanc = air piégé)
  const [cloud, cg] = canvas2d(N);
  cg.fillStyle = '#000';
  cg.fillRect(0, 0, N, N);
  for (let i = 0; i < 7; i++) {
    const x = N * (0.5 + (rand() - 0.5) * 0.22), y = N * (0.5 + (rand() - 0.5) * 0.22), r = N * (0.1 + rand() * 0.16);
    const grd = cg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = grd;
    cg.fillRect(0, 0, N, N);
  }
  // Traînées plumeuses qui rayonnent du cœur
  cg.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let a = rand() * Math.PI * 2;
    let x = N / 2 + Math.cos(a) * N * 0.05, y = N / 2 + Math.sin(a) * N * 0.05;
    const steps = 10;
    const len = N * (0.08 + rand() * 0.2);
    for (let s = 0; s < steps; s++) {
      a += (rand() - 0.5) * 0.4;
      const nx = x + Math.cos(a) * (len / steps), ny = y + Math.sin(a) * (len / steps);
      cg.strokeStyle = `rgba(255,255,255,${0.14 * (1 - s / steps)})`;
      cg.lineWidth = 1 + (1 - s / steps) * 2.4;
      cg.beginPath(); cg.moveTo(x, y); cg.lineTo(nx, ny); cg.stroke();
      x = nx; y = ny;
    }
  }
  // Micro-bulles
  for (let i = 0; i < 90; i++) {
    const x = N / 2 + (rand() + rand() - 1) * N * 0.3, y = N / 2 + (rand() + rand() - 1) * N * 0.3;
    cg.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.4})`;
    cg.beginPath(); cg.arc(x, y, 0.6 + rand() * 1.4, 0, Math.PI * 2); cg.fill();
  }

  // Rugosité (blanc = givré)
  const [rough, rg] = canvas2d(N);
  rg.fillStyle = 'rgb(40,40,40)';
  rg.fillRect(0, 0, N, N);
  // Arêtes givrées : bordure de chaque face (les bords UV tombent sur les arrondis)
  const edge = N * 0.11;
  [[0, 0, N, edge, 0, 0, 0, edge], [0, N - edge, N, edge, 0, N, 0, N - edge], [0, 0, edge, N, 0, 0, edge, 0], [N - edge, 0, edge, N, N, 0, N - edge, 0]]
    .forEach(([x, y, w, h, x0, y0, x1, y1]) => {
      const grd = rg.createLinearGradient(x0, y0, x1, y1);
      grd.addColorStop(0, 'rgba(255,255,255,0.75)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      rg.fillStyle = grd;
      rg.fillRect(x, y, w, h);
    });
  // Plaques de givre et rayures plus mates
  for (let i = 0; i < 16; i++) {
    const x = rand() * N, y = rand() * N, r = N * (0.03 + rand() * 0.1);
    const grd = rg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.32)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    rg.fillStyle = grd;
    rg.fillRect(x - r, y - r, r * 2, r * 2);
  }
  rg.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI, x = rand() * N, y = rand() * N, l = N * (0.02 + rand() * 0.12);
    rg.strokeStyle = `rgba(255,255,255,${0.12 + rand() * 0.3})`;
    rg.lineWidth = 0.6 + rand();
    rg.beginPath(); rg.moveTo(x, y); rg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); rg.stroke();
  }

  // Assemblage RG
  const cd = cg.getImageData(0, 0, N, N).data;
  const rd = rg.getImageData(0, 0, N, N).data;
  const out = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const o = i * 4;
    out[o] = 255 - Math.min(255, cd[o] * 0.75); // transmission (1 = cristallin)
    out[o + 1] = rd[o]; // rugosité
    out[o + 2] = 0;
    out[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function makeIceMaps(size = 512, seed = 7) {
  const rand = mulberry32(seed);
  const normal = heightToNormal(paintHeight(size, rand), size >= 512 ? 2.4 : 1.6);
  const detail = paintDetail(size, rand);
  return { normal, detail };
}

/* ------------------------------------------------------------------ */
/* Le très grand mot « GLACEUR » (verre givré)                         */
/* ------------------------------------------------------------------ */
export async function makeWordTexture(renderer, text = 'GLACEUR', width = 2048) {
  const font = (px) => `800 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  try {
    await Promise.race([
      document.fonts.load(font(200), text).then(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* police système de repli */ }

  const [probe, pg] = canvas2d(16);
  pg.font = font(400);
  const m = pg.measureText(text);
  const pad = Math.round(width * 0.02);
  const fs = Math.floor((400 * (width - pad * 2)) / m.width);
  pg.font = font(fs);
  const mm = pg.measureText(text);
  const asc = mm.actualBoundingBoxAscent || fs * 0.72;
  const desc = mm.actualBoundingBoxDescent || fs * 0.02;
  const height = Math.ceil(asc + desc + pad * 2);
  probe.width = probe.height = 1;

  const [c, g] = canvas2d(width, height);
  g.font = font(fs);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'center';
  const x = width / 2, y = pad + asc;

  // 1. Matière : verre givré, plus lumineux en haut.
  const fill = g.createLinearGradient(0, pad, 0, height - pad);
  fill.addColorStop(0, 'rgba(226,244,255,0.46)');
  fill.addColorStop(0.45, 'rgba(150,204,255,0.24)');
  fill.addColorStop(1, 'rgba(77,155,255,0.10)');
  g.fillStyle = fill;
  g.fillText(text, x, y);

  // 2. Givre et reflets à l'intérieur des lettres uniquement.
  g.globalCompositeOperation = 'source-atop';
  const rand = mulberry32(31);
  for (let i = 0; i < 5200; i++) {
    const px = rand() * width, py = rand() * height, r = 0.6 + rand() * rand() * 3.2;
    g.fillStyle = `rgba(235,247,255,${0.04 + rand() * 0.22})`;
    g.fillRect(px, py, r, r);
  }
  for (let i = 0; i < 5; i++) { // reflets diagonaux
    const bx = width * (0.08 + i * 0.2 + rand() * 0.06);
    const grd = g.createLinearGradient(bx - 120, 0, bx + 120, height);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, width, height);
  }
  // Arête supérieure lumineuse (épaisseur du verre)
  const top = g.createLinearGradient(0, pad, 0, pad + asc * 0.12);
  top.addColorStop(0, 'rgba(255,255,255,0.55)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, width, height);

  // 3. Contour net : la tranche du verre.
  g.globalCompositeOperation = 'source-over';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, width / 700);
  g.strokeStyle = 'rgba(205,234,255,0.72)';
  g.strokeText(text, x, y);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return { texture: tex, aspect: width / height };
}

/* ------------------------------------------------------------------ */
/* Sprites : éclat de lumière et onde de choc                          */
/* ------------------------------------------------------------------ */
export function makeGlintTexture(N = 128) {
  const [c, g] = canvas2d(N);
  const h = N / 2;
  const glow = g.createRadialGradient(h, h, 0, h, h, h);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.08, 'rgba(225,244,255,0.85)');
  glow.addColorStop(0.25, 'rgba(142,207,255,0.22)');
  glow.addColorStop(1, 'rgba(142,207,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, N, N);
  const spike = (angle, sx, sy, alpha) => {
    g.save();
    g.translate(h, h);
    g.rotate(angle);
    g.scale(sx, sy);
    const s = g.createRadialGradient(0, 0, 0, 0, 0, h);
    s.addColorStop(0, `rgba(255,255,255,${alpha})`);
    s.addColorStop(0.4, `rgba(200,232,255,${alpha * 0.35})`);
    s.addColorStop(1, 'rgba(200,232,255,0)');
    g.fillStyle = s;
    g.beginPath(); g.arc(0, 0, h, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  spike(0, 1, 0.045, 1);
  spike(Math.PI / 2, 1, 0.045, 1);
  spike(Math.PI / 4, 0.5, 0.03, 0.6);
  spike(-Math.PI / 4, 0.5, 0.03, 0.6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeRingTexture(N = 256) {
  const [c, g] = canvas2d(N);
  const h = N / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  grd.addColorStop(0, 'rgba(191,228,255,0)');
  grd.addColorStop(0.55, 'rgba(191,228,255,0)');
  grd.addColorStop(0.78, 'rgba(225,244,255,0.85)');
  grd.addColorStop(0.86, 'rgba(142,207,255,0.25)');
  grd.addColorStop(1, 'rgba(142,207,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  // Petits cristaux sur l'anneau
  const rand = mulberry32(5);
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2, r = h * (0.72 + rand() * 0.12);
    g.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.6})`;
    g.fillRect(h + Math.cos(a) * r, h + Math.sin(a) * r, 1.5 + rand() * 2, 1.5 + rand() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
