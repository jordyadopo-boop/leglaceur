/**
 * Bruit de valeur 2D lissé (+ fBm), éventuellement périodique (textures raccordables).
 * Volontairement simple et rapide : il sert à générer des textures une seule fois.
 */
import { rng } from './env.js';

export function createNoise(seed = 7) {
  const r = rng(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const vals = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    perm[i] = i;
    vals[i] = r();
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i];

  const lattice = (ix, iy) => vals[perm[(ix & 255) + perm[iy & 255]]];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  /** Bruit dans [0, 1]. `px`/`py` : périodes entières (0 = non périodique). */
  function noise(x, y, px = 0, py = 0) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    let x1 = x0 + 1;
    let y1 = y0 + 1;
    let a0 = x0;
    let b0 = y0;
    if (px) {
      a0 = ((x0 % px) + px) % px;
      x1 = ((x1 % px) + px) % px;
    }
    if (py) {
      b0 = ((y0 % py) + py) % py;
      y1 = ((y1 % py) + py) % py;
    }
    const v00 = lattice(a0, b0);
    const v10 = lattice(x1, b0);
    const v01 = lattice(a0, y1);
    const v11 = lattice(x1, y1);
    const top = v00 + (v10 - v00) * fx;
    const bot = v01 + (v11 - v01) * fx;
    return top + (bot - top) * fy;
  }

  /** fBm : somme d'octaves, résultat normalisé dans [0, 1]. */
  function fbm(x, y, octaves = 4, px = 0, py = 0) {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * f, y * f, px ? px * f : 0, py ? py * f : 0);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }

  return { noise, fbm };
}
