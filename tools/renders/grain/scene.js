/*
 * Le Glaceur — rendu produit « Glace en grain » (nugget ice), Three.js 0.186, hors site.
 *
 * Plan :
 *  1. Unités en centimètres. Un gobelet en verre épais (LatheGeometry, transmission) déborde de grains de glace
 *     qui se répandent en tas sur un sol noir-bleu mouillé, avec quelques grains isolés vers l'objectif.
 *  2. Grains = 8 variantes de « pépites » (capsule écrasée, bouts cassés en biais, bosses de bruit 3D),
 *     instanciées ; matière MeshPhysicalMaterial blanche bleutée + pores procéduraux (bump sur bruit 3D en
 *     espace objet, rugosité plus forte dans les pores), vernis humide (clearcoat lisse), diffusion interne
 *     simulée (lueur bleue pâle au cœur + translucidité en contre-jour).
 *  3. Disposition physique : dépôt séquentiel (chaque grain tombe et s'arrête au premier contact : sol, verre,
 *     autres grains — 5 sphères par grain) dans des formes cibles : verre plein + dôme, coulée en tas, grains isolés.
 *  4. Studio « nuit polaire » : mur marine + halo froid, sol mouillé à réflexion miroir floutée et ondulée,
 *     gouttes d'eau sur le sol et buée/condensation sur le verre, environnement PMREM à boîtes à lumière.
 *  5. Éclairage trois points (clé douce, contre-jour cyan, débouchage), ombres PCF douces.
 *  6. Finition : profondeur de champ légère, bloom doux, vignette, grain photo, ACES. Rendu 2× puis lanczos.
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ utilitaires */

const T0 = performance.now();
const mark = (l) => console.info(`${l} ${Math.round(performance.now() - T0)} ms`);
const tick = () => new Promise((res) => setTimeout(res, 0));

function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit de valeur 3D lissé (JS) pour déformer les géométries. */
function makeNoise3(seed) {
  const r = rng(seed);
  const P = new Uint8Array(512);
  const V = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = r() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const h = (x, y, z) => V[P[P[P[x & 255] + (y & 255)] + (z & 255)]];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = s(x - xi), yf = s(y - yi), zf = s(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf),
      zf,
    );
  };
}

/* GLSL : bruit simplexe 3D (Ashima / Stefan Gustavson, MIT) + bump résolution-indépendant. */
const GLSL_NOISE = /* glsl */ `
vec3 g_mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 g_mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 g_perm(vec4 x){ return g_mod289(((x*34.0)+10.0)*x); }
vec4 g_tis(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = g_mod289(i);
  vec4 p = g_perm(g_perm(g_perm(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = g_tis(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
vec3 g_bump(vec3 pos, vec3 n, float h, float k){
  vec3 dpx = dFdx(pos), dpy = dFdy(pos);
  float dhx = dFdx(h) * k, dhy = dFdy(h) * k;
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad);
}
`;

/* ------------------------------------------------------------------ paramètres de scène */

const GLASS = { x: -3.0, z: -3.2, h: 10.4, rBot: 3.05, rTop: 3.75, wall: 0.24, base: 1.05 };
const rOut = (y) => GLASS.rBot + (GLASS.rTop - GLASS.rBot) * THREE.MathUtils.clamp(y / GLASS.h, 0, 1);
const rIn = (y) => rOut(y) - GLASS.wall;

/* ------------------------------------------------------------------ géométrie des grains */

function pelletGeometry(seed) {
  const r = rng(seed * 7 + 3);
  const n3 = makeNoise3(seed * 13 + 1);
  const radius = 0.37 + r() * 0.09;
  const half = 0.15 + r() * 0.36; // demi-longueur de la partie cylindrique
  const capFlat = 0.28 + r() * 0.26; // bouts à peine arrondis : le grain est coupé à la sortie de l'extrudeuse
  const g = new THREE.CapsuleGeometry(radius, half * 2, 8, 28, 10);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  // bouts cassés en biais
  const tiltA = new THREE.Vector2(r() - 0.5, r() - 0.5).multiplyScalar(0.7);
  const tiltB = new THREE.Vector2(r() - 0.5, r() - 0.5).multiplyScalar(0.7);
  const ovalX = 1 + (r() - 0.5) * 0.26, ovalZ = 1 + (r() - 0.5) * 0.26;
  // éclat : une face cassée nette près d'un bout (un grain sur deux)
  const chips = [];
  const nChips = r() < 0.55 ? 1 + (r() < 0.3 ? 1 : 0) : 0;
  for (let c = 0; c < nChips; c++) {
    const n = new THREE.Vector3((r() - 0.5) * 1.6, r() < 0.5 ? 1 : -1, (r() - 0.5) * 1.6).normalize();
    chips.push({ n, d: (half + radius * capFlat) * (0.55 + r() * 0.25) * Math.abs(n.y) + radius * 0.35 * Math.hypot(n.x, n.z) });
  }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > half) v.y = half + (v.y - half) * capFlat + (v.x * tiltA.x + v.z * tiltA.y) * 0.5;
    else if (v.y < -half) v.y = -half + (v.y + half) * capFlat + (v.x * tiltB.x + v.z * tiltB.y) * 0.5;
    v.x *= ovalX; v.z *= ovalZ;
    for (const c of chips) { const k = v.dot(c.n) - c.d; if (k > 0) v.addScaledVector(c.n, -k); }
    // bosses : basse fréquence (forme), moyenne (grumeaux), quelques creux
    const len = v.length() || 1;
    const nx = v.x / len, ny = v.y / len, nz = v.z / len;
    const lo = n3(v.x * 1.6 + 5, v.y * 1.6, v.z * 1.6) * 0.15;
    const mid = n3(v.x * 4.2, v.y * 4.2 + 11, v.z * 4.2) * 0.065;
    const pit = Math.min(0, n3(v.x * 6.5 + 3, v.y * 6.5, v.z * 6.5 + 7) + 0.25) * 0.08;
    const d = lo + mid + pit;
    v.x += nx * d; v.y += ny * d * 0.8; v.z += nz * d;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return { geo: g, radius: radius * Math.max(ovalX, ovalZ) * 0.95, half: half + radius * capFlat * 0.35 };
}

function pelletMaterial(o, trans = 0) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(o.iceColor ?? '#c8d8ea'),
    roughness: o.iceRough ?? 0.34,
    metalness: 0,
    clearcoat: o.coat ?? 1.0,
    clearcoatRoughness: o.coatR ?? 0.03,
    specularIntensity: 0.9,
    ior: 1.31,
    sheen: 0.25, sheenColor: new THREE.Color('#cfe6ff'), sheenRoughness: 0.5,
    envMapIntensity: o.iceEnv ?? 1.25,
    transmission: trans,
    thickness: 0.9,
    side: trans > 0 ? THREE.DoubleSide : THREE.FrontSide,
    attenuationColor: new THREE.Color(o.att ?? '#8fbdeb'), attenuationDistance: o.attD ?? 1.2,
  });
  const u = {
    uSss: { value: new THREE.Color(o.sssColor ?? '#a8ccf0') },
    uSssAmb: { value: o.sssAmb ?? 0.06 },
    uSssBack: { value: o.sssBack ?? 0.35 },
    uBackDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    uPore: { value: o.pore ?? 0.3 },
    uEdge: { value: o.edge ?? 1.6 },
    uStri: { value: o.stri ?? 0.1 },
    uBump: { value: o.bump ?? 0.055 },
    uCloud: { value: o.cloud ?? 0.8 },
    uVar: { value: o.var ?? 1.0 },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj; varying vec3 vLoc; varying float vInst;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 seedOff = vec3(0.0);
        #ifdef USE_INSTANCING
          seedOff = instanceMatrix[3].xyz * 1.37;
        #endif
        vObj = position * 1.0 + seedOff;
        vLoc = position;
        vInst = fract(sin(dot(seedOff, vec3(12.9898, 78.233, 37.719))) * 43758.5453);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; varying vec3 vLoc; varying float vInst; uniform vec3 uSss; uniform float uSssAmb, uSssBack, uPore, uEdge, uStri, uVar, uBump, uCloud; uniform vec3 uBackDir;
        ${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // pores (bulles d'air ouvertes) + grain de glace compactée
        float pN = snoise(vObj * 5.5);
        float pits = smoothstep(0.38, 0.78, pN) * uPore;
        float pits2 = smoothstep(0.55, 0.9, snoise(vObj * 13.0 + 4.0)) * uPore;
        float fineH = snoise(vObj * 31.0) * 0.5 + snoise(vObj * 70.0) * 0.25;
        float blot = snoise(vObj * 1.8 + 9.0) * 0.5 + 0.5; // zones plus « laiteuses »
        float cloud = snoise(vObj * 3.4 + 2.0) * 0.6 + snoise(vObj * 8.0) * 0.4; // nuages internes
        float ang = atan(vLoc.x, vLoc.z);
        // stries d'extrusion dans la longueur du grain
        float stri = snoise(vec3(cos(ang) * 3.2, sin(ang) * 3.2, vLoc.y * 0.9 + vInst * 20.0)) * 0.6
                   + snoise(vec3(cos(ang) * 7.0, sin(ang) * 7.0, vLoc.y * 1.6 + vInst * 9.0)) * 0.3;
        float iceH = -pits * 0.55 - pits2 * 0.3 + fineH * 0.08 + snoise(vObj * 2.6) * 0.12 + stri * uStri;
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.80, 0.88, 0.97), clamp(pits * 0.9 + pits2 * 0.6, 0.0, 1.0));
        diffuseColor.rgb *= 0.93 + 0.07 * blot;
        diffuseColor.rgb *= mix(vec3(0.8, 0.88, 0.97), vec3(1.06), smoothstep(-0.5, 0.6, cloud) * uCloud + (1.0 - uCloud) * 0.6);
        // chaque grain a sa propre opacité : certains plus laiteux, d'autres plus translucides (gris bleuté)
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.86, 0.96), smoothstep(0.35, 1.0, vInst) * uVar);
        diffuseColor.rgb *= 1.0 - 0.06 * smoothstep(0.2, 0.7, stri);
        {
          float ndvC = clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
          // bords plus minces = plus transparents : la glace y paraît plus sombre et plus bleue
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.42, 0.58, 0.8), pow(1.0 - ndvC, 1.6) * uEdge);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + pits * 0.3 + pits2 * 0.15 - (1.0 - blot) * 0.12, 0.08, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = g_bump(-vViewPosition, normal, iceH, uBump);`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 Vv = normalize(vViewPosition);
          float ndv = clamp(dot(normal, Vv), 0.0, 1.0);
          float core = 0.35 + 0.65 * pow(ndv, 1.3);
          vec3 Lb = normalize(uBackDir);
          float tr = pow(clamp(dot(Vv, -normalize(Lb + normal * 0.45)), 0.0, 1.0), 3.0);
          float thinEdge = pow(1.0 - ndv, 2.0);
          outgoingLight += uSss * (uSssAmb * core * (1.0 - pits * 0.35) + uSssBack * (tr * 0.8 + thinEdge * 0.25));
        }
        #include <opaque_fragment>`);
  };
  return mat;
}

/* ------------------------------------------------------------------ disposition */

/*
 * Dépôt séquentiel : chaque grain tombe à la verticale d'un point tiré au hasard et s'arrête au premier contact
 * (sol, fond du verre, autre grain). Un grain n'est gardé que s'il reste sous la forme visée (verre rempli + dôme,
 * tas en coulée) : on obtient un empilement crédible, sans tassement ni grain en lévitation.
 */
function layout(variants, seed, o) {
  const r = rng(seed);
  const P = [];
  const cell = 1.6;
  const grid = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const insert = (p, i) => {
    const k = key(Math.floor(p.c.x / cell), Math.floor(p.c.y / cell), Math.floor(p.c.z / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  };
  const spheres = (c, a, h) => [-1, -0.5, 0, 0.5, 1].map((k) => c.clone().addScaledVector(a, k * h));
  const randAxis = () => new THREE.Vector3(r() * 2 - 1, (r() * 2 - 1) * 0.8, r() * 2 - 1).normalize();
  const flatAxis = () => { const a = r() * Math.PI * 2; return new THREE.Vector3(Math.cos(a), (r() - 0.5) * 0.3, Math.sin(a)).normalize(); };
  const slope = o.slope ?? 0.5; // pente de talus (~27°)
  const slopeIn = o.slopeIn ?? 0.2; // dans le verre, on secoue : tassement plus dense
  const TIGHT = o.tight ?? 0.88; // légère interpénétration : glace tassée, contacts francs

  /** Vrai si le grain (c, a, h, rad) touche quelque chose. */
  function hits(c, a, h, rad, zone) {
    const S = spheres(c, a, h);
    for (const s of S) {
      if (s.y - rad < 0) return true; // sol
      // verre = solide : paroi, fond, lèvre arrondie
      const rx = s.x - GLASS.x, rz = s.z - GLASS.z, d = Math.hypot(rx, rz);
      if (s.y < GLASS.h) {
        if (d > rIn(s.y) - rad && d < rOut(s.y) + rad) return true;
        if (d <= rIn(s.y) && s.y - rad < GLASS.base) return true;
      } else if (Math.hypot(d - (rIn(GLASS.h) + GLASS.wall / 2), s.y - GLASS.h) < rad + GLASS.wall / 2) return true;
    }
    const gx = Math.floor(c.x / cell), gy = Math.floor(c.y / cell), gz = Math.floor(c.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const L = grid.get(key(gx + dx, gy + dy, gz + dz));
      if (!L) continue;
      for (const j of L) {
        const q = P[j];
        const lim = h + q.h + rad + q.r;
        if (c.distanceToSquared(q.c) > lim * lim) continue;
        const Q = q.S;
        const min = (rad + q.r) * TIGHT;
        for (const s of S) for (const t of Q) if (s.distanceToSquared(t) < min * min) return true;
      }
    }
    return false;
  }

  /** Lâche un grain en (x, z) depuis yTop ; renvoie le centre d'arrêt ou null. */
  function drop(x, z, yTop, a, h, rad, zone) {
    const c = new THREE.Vector3(x, yTop, z);
    if (hits(c, a, h, rad, zone)) return null;
    let step = 0.4;
    while (step > 0.02) {
      c.y -= step;
      if (hits(c, a, h, rad, zone)) { c.y += step; step /= 2; }
      if (c.y < -1) return null;
    }
    return c;
  }

  function place(zone, sample, maxH, axisFn, n, maxTries, pref = 0) {
    let made = 0, tries = 0; const why = { nul: 0, high: 0 };
    while (made < n && tries++ < maxTries) {
      const [x, z, yTop] = sample();
      if (pref && r() * pref > maxH(x, z)) continue; // on tire plus souvent là où le tas est haut
      const vi = Math.floor(r() * variants.length);
      const s = 0.88 + r() * 0.24;
      const rad = variants[vi].radius * s, h = variants[vi].half * s;
      const a = axisFn();
      if (zone === 'in') {
        // le grain entier doit passer par l'ouverture du verre
        const ext = h * Math.hypot(a.x, a.z) + rad + 0.06;
        const lim = rIn(GLASS.h) - ext;
        if (Math.hypot(x - GLASS.x, z - GLASS.z) > lim) continue;
      }
      let c = drop(x, z, yTop, a, h, rad, zone);
      if (!c) { why.nul++; continue; }
      // roulement : le grain glisse vers le creux voisin le plus bas (sinon, empilement en colonnes)
      for (let k = 0; k < (o.roll ?? 12); k++) {
        let best = null;
        for (let m = 0; m < 8; m++) {
          const t = (m / 8) * Math.PI * 2 + r() * 0.6, d = 0.25 + r() * 0.35;
          const cand = drop(c.x + Math.cos(t) * d, c.z + Math.sin(t) * d, c.y + 0.25, a, h, rad, zone);
          if (cand && cand.y < c.y - (zone === 'in' ? slopeIn : slope) * d && (!best || cand.y < best.y)) best = cand;
        }
        if (!best) break;
        c = best;
      }
      if (c.y > maxH(c.x, c.z)) { why.high++; continue; } // forme cible évaluée là où le grain s'est arrêté
      const p = { c, a, vi, s, r: rad, h, zone, spin: r() * Math.PI * 2 };
      p.S = spheres(c, a, h);
      P.push(p); insert(p, P.length - 1);
      made++;
    }
    mark(`  ${zone} : ${made} grains (${tries} essais) ${JSON.stringify(why)}`);
  }

  // 2. coulée : du pied du verre vers l'avant-droite, en tas
  const pile = o.pile ?? { x: o.px ?? 1.8, z: o.pz ?? 2.6, sx: o.psx ?? 4.4, sz: o.psz ?? 3.3, hgt: o.ph ?? 4.0 };
  const dir = new THREE.Vector2(pile.x - GLASS.x, pile.z - GLASS.z).normalize();
  const heap = (x, z) => {
    const dx = (x - pile.x) / pile.sx, dz = (z - pile.z) / pile.sz;
    const main = pile.hgt * Math.exp(-(dx * dx + dz * dz) * 1.2);
    // traînée qui remonte contre le verre (grains tombés du bord)
    const vx = x - GLASS.x, vz = z - GLASS.z;
    const along = vx * dir.x + vz * dir.y, across = -vx * dir.y + vz * dir.x;
    const trail = along > -1 ? (o.trailH ?? 3.0) * Math.exp(-along / 3.2) * Math.exp(-(across * across) / 7) : 0;
    return Math.max(main, trail) + 0.5;
  };
  // 1. le verre, rempli à ras bord puis surmonté d'un dôme
  const ri = rIn(GLASS.h);
  const domeH = o.domeH ?? 2.6;
  place('in', () => {
    const rr = Math.sqrt(r()) * (ri - 0.4), t = r() * Math.PI * 2;
    return [GLASS.x + Math.cos(t) * rr, GLASS.z + Math.sin(t) * rr, GLASS.h + 6];
  }, (x, z) => {
    const dd = Math.hypot(x - GLASS.x, z - GLASS.z);
    if (dd > rOut(GLASS.h) + 0.2) return heap(x, z); // grain tombé du bord : il rejoint la coulée
    const d = dd / (ri + 0.4);
    return GLASS.h + 0.2 + domeH * Math.max(0, 1 - d * d);
  }, randAxis, o.nIn ?? 700, 14000);

  // 2. coulée : du pied du verre vers l'avant-droite, en tas
  place('pile', () => {
    const x = pile.x + (r() * 2 - 1) * pile.sx * 1.7 - 1.2;
    const z = pile.z + (r() * 2 - 1) * pile.sz * 1.7 - 0.8;
    return [x, z, 12];
  }, heap, randAxis, o.nPile ?? 520, 80000, 4.0);

  // 3. grains isolés, couchés, vers l'objectif et sur les côtés
  place('scatter', () => {
    const t = 0.15 + r() * 2.85; // vers l'objectif
    const d = 3.0 + Math.pow(r(), 1.2) * 7.5;
    return [pile.x * 0.4 + Math.cos(t) * d * 1.1, pile.z + 7.5 + Math.sin(t) * d * 0.5, 3];
  }, () => 1.3, flatAxis, o.nScatter ?? 16, 2000);
  return P;
}

/* ------------------------------------------------------------------ verre */

function glassGeometry() {
  const { h, rBot, rTop, wall, base } = GLASS;
  const pts = [];
  pts.push(new THREE.Vector2(0.001, 0));
  // dessous légèrement creusé + chanfrein
  pts.push(new THREE.Vector2(rBot - 0.45, 0.0));
  pts.push(new THREE.Vector2(rBot - 0.12, 0.04));
  pts.push(new THREE.Vector2(rBot, 0.22));
  for (let i = 1; i <= 24; i++) { const y = 0.22 + (h - 0.22 - 0.12) * (i / 24); pts.push(new THREE.Vector2(rOut(y), y)); }
  // lèvre arrondie
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    const cx = rTop - wall / 2, cy = h - 0.12;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * wall / 2, cy + Math.sin(a) * 0.14));
  }
  for (let i = 24; i >= 1; i--) { const y = base + 0.35 + (h - 0.12 - base - 0.35) * (i / 24); pts.push(new THREE.Vector2(rIn(y), y)); }
  // fond intérieur arrondi
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI / 2;
    pts.push(new THREE.Vector2(rIn(base) - 0.35 + Math.cos(a) * 0.35, base + 0.35 - Math.sin(a) * 0.35));
  }
  pts.push(new THREE.Vector2(0.001, base));
  const g = new THREE.LatheGeometry(pts, 128);
  g.computeVertexNormals();
  return g;
}

function glassMaterial(o) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.5,
    ior: 1.5,
    attenuationColor: new THREE.Color('#d9f0ff'), attenuationDistance: 6,
    specularIntensity: 1,
    envMapIntensity: o.glassEnv ?? 2.2,
    side: THREE.FrontSide,
  });
    // le flou de transmission de three.js dépend de la taille du rendu (lod = log2(taille) × rugosité) :
  // on corrige la rugosité pour que la buée garde le même flou relatif en aperçu (800 px) et en final (3200 px).
  const m0 = o.mist ?? 0.22;
  const mist = 1 - (1 - m0) * Math.log(800) / Math.log(o.__w ?? 800);
  const u = { uCenter: { value: new THREE.Vector2(GLASS.x, GLASS.z) }, uMist: { value: mist } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vW; uniform vec2 uCenter; uniform float uMist;\n${GLSL_NOISE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        {
          // buée de condensation sur la paroi extérieure, avec coulures nettes
          vec2 rel = vW.xz - uCenter;
          float ang = atan(rel.y, rel.x);
          float band = smoothstep(${(GLASS.h - 0.2).toFixed(2)}, ${(GLASS.h - 1.6).toFixed(2)}, vW.y) * smoothstep(0.1, 0.9, vW.y);
          float streak = smoothstep(0.55, 0.75, snoise(vec3(ang * 9.0, vW.y * 0.08, 1.0)) * 0.6 + snoise(vec3(ang * 23.0, vW.y * 0.2, 4.0)) * 0.5);
          float patchy = 0.75 + 0.25 * snoise(vW * 0.6);
          roughnessFactor = max(roughnessFactor, uMist * band * patchy * (1.0 - streak * 0.85));
        }`);
  };
  return mat;
}

/* ------------------------------------------------------------------ gouttes */

function dropletMaterial(thickness = 0.15, env = 1.6) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness, ior: 1.33,
    specularIntensity: 1, envMapIntensity: env, clearcoat: 0, attenuationColor: new THREE.Color('#e8f6ff'), attenuationDistance: 3,
  });
}

function floorDroplets(P, seed, n) {
  const r = rng(seed);
  const geo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, dropletMaterial(0.12, 2.4), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const pile = P.filter((x) => x.zone !== 'in' && x.zone !== 'dome');
  let k = 0;
  while (k < n) {
    let x, z;
    if (r() < 0.45 && pile.length) {
      const b = pile[Math.floor(r() * pile.length)];
      const a = r() * Math.PI * 2, d = 1.2 + r() * 3;
      x = b.c.x + Math.cos(a) * d; z = b.c.z + Math.sin(a) * d;
    } else {
      x = -13 + r() * 28; z = 2 + r() * 16;
    }
    const rad = 0.07 + Math.pow(r(), 2.2) * 0.55;
    const ox = rad * (1 + r() * 0.5), oz = rad * (1 + r() * 0.5);
    p.set(x, 0, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28); s.set(ox, rad * (0.42 + r() * 0.16), oz);
    m.compose(p, q, s);
    mesh.setMatrixAt(k++, m);
  }
  mesh.userData.droplets = true;
  return mesh;
}

function glassDroplets(seed, n) {
  const r = rng(seed);
  const geo = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, dropletMaterial(0.01, 2.6), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < n; k++) {
    const y = 0.5 + Math.pow(r(), 0.8) * (GLASS.h - 1.8);
    const a = r() * Math.PI * 2;
    const ro = rOut(y);
    const nrm = new THREE.Vector3(Math.cos(a), (GLASS.rBot - GLASS.rTop) / GLASS.h, Math.sin(a)).normalize();
    p.set(GLASS.x + Math.cos(a) * ro, y, GLASS.z + Math.sin(a) * ro);
    q.setFromUnitVectors(up, nrm);
    const big = r() < 0.1;
    const rad = big ? 0.09 + r() * 0.1 : 0.025 + Math.pow(r(), 2) * 0.06;
    s.set(rad, rad * 0.45, rad * (big ? 1.5 : 1.05));
    m.compose(p, q, s);
    mesh.setMatrixAt(k, m);
  }
  return mesh;
}

/* ------------------------------------------------------------------ décor */

function buildEnvironment(renderer, o) {
  const env = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(200, 120, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(o.room ?? '#0a1626'), side: THREE.BackSide }));
  box.position.y = 40;
  env.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x020814 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5;
  env.add(floor);
  const panel = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  const L = o.envK ?? 1;
  panel(70, 34, '#eef6ff', 5 * L, [-10, 95, 20], [0, 0, 0]); // grande boîte au plafond
  panel(10, 70, '#eaf4ff', 3.5 * L, [-95, 40, 30], [0, 10, 0]); // bande gauche
  panel(9, 70, '#9fdcff', 4.5 * L, [95, 40, -10], [0, 10, 0]); // bande droite cyan
  panel(90, 14, '#3f86ff', 2.2 * L, [0, 30, -95], [0, 10, 0]); // contre-jour bleu
  panel(50, 20, '#eef6ff', 1.2 * L, [20, 30, 95], [0, 5, 0]); // débouchage face
  panel(12, 80, '#f4f9ff', 6 * L, [-62, 40, 70], [0, 10, 0]); // bandes avant : reflets verticaux sur le verre
  panel(10, 80, '#cfeaff', 4 * L, [66, 40, 62], [0, 10, 0]);
  // petites sources très vives : éclats nets sur la glace mouillée et les gouttes
  const G = o.glint ?? 1;
  panel(4, 4, '#ffffff', 70 * G, [-45, 75, 45], [0, 0, 0]);
  panel(3, 3, '#e8f4ff', 50 * G, [35, 85, 25], [0, 0, 0]);
  panel(3, 5, '#bfe4ff', 45 * G, [10, 60, -70], [0, 0, 0]);
  panel(2.5, 2.5, '#ffffff', 40 * G, [-15, 40, 90], [0, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  return rt.texture;
}

/* Mur de fond (partagé avec le sol pour un raccord sans ligne d'horizon). */
const WALL_GLSL = /* glsl */ `
  uniform vec3 cTop, cMid, cHalo; uniform vec2 haloPos; uniform float glow, horizon, wallX, wallW;
  vec3 wallColor(vec2 uv){
    vec3 c = mix(cMid, cTop, smoothstep(horizon, 0.78, uv.y));
    vec2 d = (uv - haloPos) * vec2(1.0, 1.15);
    float r = length(d);
    c += cHalo * glow * (exp(-r*r*30.0) * 0.9 + exp(-r*r*7.0) * 0.4);
    return c;
  }`;

function wallUniforms(o) {
  return {
    cTop: { value: new THREE.Color(o.bgTop ?? '#010612') },
    cMid: { value: new THREE.Color(o.bgMid ?? '#0a1c3a') },
    cHalo: { value: new THREE.Color(o.halo ?? '#4a77b0') },
    haloPos: { value: new THREE.Vector2(0.47, 0.3) },
    glow: { value: o.glow ?? 0.5 },
    horizon: { value: 0.0 },
    wallX: { value: 0 }, wallW: { value: 1 },
  };
}

function buildBackdrop(wu) {
  const mat = new THREE.ShaderMaterial({
    uniforms: wu,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `${WALL_GLSL}
      varying vec2 vUv;
      void main(){ gl_FragColor = vec4(wallColor(vUv), 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.userData.backdrop = true;
  return m;
}

function buildFloor(o, wu) {
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.floorColor ?? '#010409'), roughness: 0.25, metalness: 0, specularIntensity: 0.6, envMapIntensity: 0.25 });
  const uniforms = {
    tReflect: { value: null },
    reflMatrix: { value: new THREE.Matrix4() },
    reflStrength: { value: o.refl ?? 0.6 },
    reflBlur: { value: o.reflBlur ?? 0.0045 },
    ...wu,
    fogNear: { value: o.fogNear ?? -2 }, fogFar: { value: o.fogFar ?? -26 },
    wetC: { value: new THREE.Vector2(0, 0) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 reflMatrix; varying vec4 vReflCoord; varying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 wp_ = modelMatrix * vec4(transformed,1.0); vWPos = wp_.xyz; vReflCoord = reflMatrix * wp_;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tReflect; uniform float reflStrength, reflBlur, fogNear, fogFar; uniform vec2 wetC;
        ${WALL_GLSL}
        varying vec4 vReflCoord; varying vec3 vWPos;
        ${GLSL_NOISE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float wet = smoothstep(0.1, 0.6, snoise(vec3(vWPos.xz * 0.06, 2.0)) * 0.5 + 0.5 + 0.35);
        roughnessFactor = mix(0.32, 0.06, wet);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float hh = snoise(vec3(vWPos.xz * 0.9, 1.0)) * 0.6 + snoise(vec3(vWPos.xz * 3.1, 5.0)) * 0.3 + snoise(vec3(vWPos.xz * 11.0, 9.0)) * 0.1;
          normal = g_bump(-vViewPosition, normal, hh * (1.0 - wet * 0.85), 0.05);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec2 ruv = vReflCoord.xy / vReflCoord.w;
          vec2 rip = vec2(snoise(vec3(vWPos.xz * 0.35, 3.0)), snoise(vec3(vWPos.xz * 0.35, 7.0)));
          ruv += rip * 0.0025 * (1.0 - wet * 0.6);
          vec3 acc = vec3(0.0); float wsum = 0.0;
          float blur = reflBlur * mix(1.6, 0.6, wet);
          for (int i = 0; i < 24; i++) {
            float a = float(i) * 2.39996;
            float rr = sqrt((float(i) + 0.5) / 24.0);
            vec2 o = vec2(cos(a), sin(a)) * rr * blur;
            float wgt = 1.0 - rr * 0.6;
            acc += texture2D(tReflect, ruv + o).rgb * wgt; wsum += wgt;
          }
          vec3 refl = acc / wsum;
          vec3 V = normalize(cameraPosition - vWPos);
          float ndv = clamp(V.y, 0.0, 1.0);
          float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
          outgoingLight += refl * reflStrength * mix(0.35, 1.0, wet) * clamp(fres * 3.2 + 0.18, 0.0, 1.0);
          // le sol se fond dans le bas du mur (cyclorama sans ligne d'horizon)
          float fz = 1.0 - smoothstep(fogFar, fogNear, vWPos.z);
          outgoingLight = mix(outgoingLight, wallColor(vec2((vWPos.x - wallX) / wallW + 0.5, horizon)), fz);
        }
        #include <opaque_fragment>`);
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 160), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.z = -28 + 80;
  m.receiveShadow = true;
  m.userData.floor = true;
  m.userData.uniforms = uniforms;
  return m;
}

function mirrorCamera(camera, v) {
  const n = new THREE.Vector3(0, 1, 0);
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
  const view = camPos.clone().negate().reflect(n).negate();
  const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
  const target = look.clone().negate().reflect(n).negate();
  v.position.copy(view);
  v.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
  v.lookAt(target);
  v.updateMatrixWorld();
  v.projectionMatrix.copy(camera.projectionMatrix);
  v.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  const tm = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  tm.multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);
  return tm;
}

/* ------------------------------------------------------------------ finition */

const FS_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function finish(renderer, rt, camera, w, h, o) {
  const quad = (mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.frustumCulled = false; const s = new THREE.Scene(); s.add(m); return s; };
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // 1. profondeur de champ (gather, cercle de confusion selon la profondeur)
  const dofRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  const dof = new THREE.ShaderMaterial({
    uniforms: {
      t: { value: rt.texture }, tD: { value: rt.depthTexture },
      near: { value: camera.near }, far: { value: camera.far },
      focus: { value: o.focus ?? camera.position.distanceTo(new THREE.Vector3(GLASS.x + 2, 4, GLASS.z + 4)) }, aperture: { value: (o.aperture ?? 0.6) * (h / 2000) }, maxR: { value: 14 * (h / 2000) },
      px: { value: new THREE.Vector2(1 / w, 1 / h) },
    },
    vertexShader: FS_VS,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D t; uniform sampler2D tD; uniform float near, far, focus, aperture, maxR; uniform vec2 px; varying vec2 vUv;
      float coc(vec2 uv){ float z = -perspectiveDepthToViewZ(texture2D(tD, uv).r, near, far); return min(maxR, aperture * abs(z - focus) / z * 40.0); }
      void main(){
        float c0 = coc(vUv);
        vec3 acc = texture2D(t, vUv).rgb; float ws = 1.0;
        if (c0 > 0.6) {
          for (int i = 0; i < 40; i++) {
            float a = float(i) * 2.39996; float rr = sqrt((float(i) + 0.5) / 40.0) * c0;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * rr * px;
            float cs = coc(uv);
            float wgt = smoothstep(rr - 1.0, rr + 1.0, max(cs, c0 * 0.5));
            acc += texture2D(t, uv).rgb * wgt; ws += wgt;
          }
        }
        gl_FragColor = vec4(acc / ws, 1.0);
      }`,
    toneMapped: false,
  });
  renderer.setRenderTarget(dofRT); renderer.render(quad(dof), cam);
  mark('profondeur de champ');
  // 2. bloom
  const small = new THREE.WebGLRenderTarget(Math.round(w / 4), Math.round(h / 4), { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const bright = new THREE.ShaderMaterial({
    uniforms: { t: { value: dofRT.texture }, thr: { value: o.bloomThr ?? 0.9 }, px: { value: new THREE.Vector2(1 / w, 1 / h) } },
    vertexShader: FS_VS,
    fragmentShader: /* glsl */ `uniform sampler2D t; uniform float thr; uniform vec2 px; varying vec2 vUv;
      void main(){ vec3 c = vec3(0.0);
        for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) c += texture2D(t, vUv + vec2(x,y)*px*1.5).rgb;
        c /= 9.0; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * max(l - thr, 0.0) / max(l, 1e-4), 1.0); }`,
    toneMapped: false,
  });
  renderer.setRenderTarget(small); renderer.render(quad(bright), cam);
  const fin = new THREE.ShaderMaterial({
    uniforms: {
      t: { value: dofRT.texture }, tb: { value: small.texture },
      bloom: { value: o.bloom ?? 0.28 }, vig: { value: o.vig ?? 0.32 }, grain: { value: o.grain ?? 0.01 }, sat: { value: o.sat ?? 0.85 },
      res: { value: new THREE.Vector2(w, h) },
    },
    vertexShader: FS_VS,
    fragmentShader: /* glsl */ `uniform sampler2D t; uniform sampler2D tb; uniform float bloom, vig, grain, sat; uniform vec2 res; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      vec3 tap(float lod, float rad){ vec3 c = vec3(0.0); vec2 px = rad / res;
        for (int i=0;i<12;i++){ float a = float(i)*0.5236; c += textureLod(tb, vUv + vec2(cos(a),sin(a))*px, lod).rgb; }
        return c / 12.0; }
      void main(){
        vec3 c = texture2D(t, vUv).rgb;
        float s = res.y / 4000.0;
        vec3 b = tap(1.0, 10.0 * s) * 0.5 + tap(3.0, 36.0 * s) * 0.35 + tap(5.0, 110.0 * s) * 0.25;
        c += b * bloom;
        float l = dot(c, vec3(0.2126,0.7152,0.0722)); c = mix(vec3(l), c, sat);
        vec2 q = vUv - 0.5; q.x *= res.x / res.y;
        c *= 1.0 - vig * smoothstep(0.3, 0.95, length(q));
        c += (hash(vUv * res) - 0.5) * grain * (0.4 + l);
        gl_FragColor = vec4(max(c, 0.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(quad(fin), cam);
}

/* ------------------------------------------------------------------ scène */

export default async function render({ w, h, variant = 0, opts = {} }) {
  const o = { ...opts, __w: w };
  for (const k in o) if (typeof o[k] === 'string' && /^[0-9a-f]{6}$/i.test(o[k])) o[k] = '#' + o[k];
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 0.84;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer, o);
  scene.environmentIntensity = o.envI ?? 1.0;
  mark('environnement');

  // caméra
  const camera = new THREE.PerspectiveCamera(o.fov ?? 24, w / h, 5, 600);
  const dist = o.dist ?? 64, elev = THREE.MathUtils.degToRad(o.elev ?? 9), azim = THREE.MathUtils.degToRad(o.azim ?? 4);
  const target = new THREE.Vector3(o.tx ?? -0.4, o.ty ?? 5.4, o.tz ?? 0);
  camera.position.set(target.x + Math.sin(azim) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(azim) * Math.cos(elev) * dist);
  camera.lookAt(target);
  camera.updateMatrixWorld();

  // fond
  const wu = wallUniforms(o);
  const back = buildBackdrop(wu);
  const bz = -28;
  const bd = camera.position.z - bz;
  const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * bd * 1.6;
  back.scale.set(vh * camera.aspect * 1.6, vh, 1);
  back.position.set(camera.position.x, vh / 2 - 1, bz);
  const hz = 1 / vh;
  wu.horizon.value = hz;
  wu.haloPos.value.set(o.haloX ?? 0.47, o.haloY ?? 0.3);
  wu.wallX.value = back.position.x; wu.wallW.value = back.scale.x;
  scene.add(back);
  const floor = buildFloor(o, wu);
  scene.add(floor);

  // grains
  const variants = Array.from({ length: 12 }, (_, i) => pelletGeometry(i + 1 + variant * 31));
  // grains isolés : on écarte ceux que le cadre couperait (un grain à moitié hors champ fait accidentel)
  const P = layout(variants, 11 + variant * 101, o).filter((p) => {
    if (p.zone !== 'scatter') return true;
    const v = p.c.clone().project(camera);
    return Math.abs(v.x) < 0.86 && v.y > -0.9;
  });
  mark(`grains isolés gardés : ${P.filter((p) => p.zone === 'scatter').length}`);
  // grains visibles à travers le verre : opaques (la transmission du verre ne voit que les objets opaques) ;
  // tous les autres : transmission partielle, face arrière comprise, pour une vraie translucidité.
  const pmatO = pelletMaterial({ ...o, iceColor: o.iceColorIn ?? '#c4d5e7', edge: o.edgeIn ?? 1.5 }, 0);
  const pmatT = pelletMaterial(o, o.iceTrans ?? 0.45);
  const inGlass = (p) => p.c.y < GLASS.h + 0.6 && Math.hypot(p.c.x - GLASS.x, p.c.z - GLASS.z) < rOut(Math.min(p.c.y, GLASS.h)) + 0.3;
  const groups = [];
  variants.forEach(() => { groups.push([]); groups.push([]); });
  P.forEach((p) => groups[p.vi * 2 + (inGlass(p) ? 0 : 1)].push(p));
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qs = new THREE.Quaternion(), sc = new THREE.Vector3();
  groups.forEach((list, gi) => {
    if (!list.length) return;
    const vi = gi >> 1;
    const im = new THREE.InstancedMesh(variants[vi].geo, gi % 2 ? pmatT : pmatO, list.length);
    list.forEach((p, k) => {
      q.setFromUnitVectors(up, p.a);
      qs.setFromAxisAngle(up, p.spin);
      q.multiply(qs);
      sc.setScalar(p.s);
      m4.compose(p.c, q, sc);
      im.setMatrixAt(k, m4);
    });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
  });
  mark('grains');

  // verre + condensation
  const glass = new THREE.Mesh(glassGeometry(), glassMaterial(o));
  glass.position.set(GLASS.x, 0, GLASS.z);
  glass.castShadow = false; glass.receiveShadow = false;
  scene.add(glass);
  const gd = glassDroplets(77 + variant, o.nGlassDrops ?? 700);
  scene.add(gd);
  const fd = floorDroplets(P, 91 + variant, o.nFloorDrops ?? 420);
  scene.add(fd);

  // lumières
  const key = new THREE.SpotLight(new THREE.Color(o.keyColor ?? '#f3f8ff'), o.key ?? 3.8, 0, 0.42, 0.9, 0);
  key.position.set(o.kx ?? -38, o.ky ?? 62, o.kz ?? 34);
  key.target.position.set(0, 2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.near = 40; key.shadow.camera.far = 140;
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.03;
  key.shadow.radius = o.shadowR ?? 6;
  key.shadow.intensity = o.shadowI ?? 0.75;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(new THREE.Color(o.rimColor ?? '#9fd4ff'), o.rim ?? 4.5, 0, 0.5, 0.8, 0);
  rim.position.set(o.rx ?? 30, o.ry ?? 34, o.rz ?? -52);
  rim.target.position.set(-1, 3, 0);
  scene.add(rim, rim.target);
  // éclats : petites sources ponctuelles qui allument le vernis humide des grains
  for (const [x, y, z, k] of [[-30, 50, 40, 1], [24, 40, 36, 0.7], [-8, 30, 60, 0.5]]) {
    const pl = new THREE.PointLight(0xffffff, (o.glintL ?? 2.2) * k, 0, 0);
    pl.position.set(x, y, z);
    scene.add(pl);
  }
  const fill = new THREE.DirectionalLight(new THREE.Color('#cfe2ff'), o.fill ?? 0.45);
  fill.position.set(40, 14, 40);
  scene.add(fill);
  // direction du contre-jour, en repère vue, pour la translucidité des grains
  const bdir = rim.position.clone().sub(new THREE.Vector3(0, 3, 0)).normalize().transformDirection(camera.matrixWorldInverse);
  pmatO.userData.u.uBackDir.value.copy(bdir);
  pmatT.userData.u.uBackDir.value.copy(bdir);

  // passe 1 : réflexion du sol
  const rw = Math.round(w / 2), rh = Math.round(h / 2);
  const reflRT = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType });
  const vcam = camera.clone();
  const reflM = mirrorCamera(camera, vcam);
  floor.visible = false; fd.visible = false;
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.0)];
  renderer.setRenderTarget(reflRT);
  renderer.render(scene, vcam);
  renderer.getContext().finish();
  renderer.clippingPlanes = [];
  floor.visible = true; fd.visible = true;
  floor.userData.uniforms.tReflect.value = reflRT.texture;
  floor.userData.uniforms.reflMatrix.value.copy(reflM);
  mark('réflexion');
  await tick();

  // passe 2 : rendu principal (HDR + profondeur)
  const main = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  main.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
  renderer.setRenderTarget(main);
  renderer.render(scene, camera);
  renderer.getContext().finish();
  mark('principal');
  await tick();

  finish(renderer, main, camera, w, h, o);
  renderer.getContext().finish();
  mark('fini');
}
export { layout, pelletGeometry, GLASS };
