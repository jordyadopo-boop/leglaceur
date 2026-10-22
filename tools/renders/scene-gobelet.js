/*
 * Rendu « gobelet » (Ice Cup) : gobelet PET transparent à couvercle dôme, rempli de glaçons creux,
 * condensation sur la paroi (buée + gouttes + coulures), sol mouillé, studio nuit polaire.
 * Unité : 1 = 1 dm. Gobelet ≈ 12,5 cm de haut, Ø 9 cm en haut ; dôme ≈ 4,5 cm.
 */
import * as THREE from 'three';
import {
  Studio, rng, mark, fbm, normalizeArr, heightToNormal, packTex, dataTex,
  buildEnvironment, buildBackdrop, backdropUniforms, buildFloor, iceMaps, iceMaterial, tick,
} from './lib.js';

const H = 1.25; // hauteur du gobelet
const RB = 0.3, RT = 0.455; // rayons bas / haut (extérieur)
const radiusAt = (y) => RB + (RT - RB) * Math.min(1, Math.max(0, (y - 0.02) / (H - 0.03)));

/** Profil du gobelet (une seule surface, paroi fine). */
function cupGeometry() {
  const pts = [
    [0.0, 0.035], [0.16, 0.035], [0.215, 0.03], [0.245, 0.012], [0.262, 0.0], [0.288, 0.0], [0.299, 0.012],
    [RB, 0.03],
  ];
  const n = 40;
  for (let i = 1; i <= n; i++) {
    const y = 0.03 + (H - 0.04 - 0.03) * (i / n);
    pts.push([radiusAt(y), y]);
  }
  // bourrelet du bord
  pts.push([RT + 0.004, H - 0.03], [RT + 0.012, H - 0.018], [RT + 0.014, H - 0.006], [RT + 0.008, H + 0.002], [RT - 0.002, H - 0.004]);
  const geo = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 160);
  // UV : u autour, v = hauteur
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    uv.setXY(i, uv.getX(i), p.getY(i) / H);
    void a;
  }
  uv.needsUpdate = true;
  return geo;
}

/** Couvercle dôme : collerette + dôme ellipsoïdal + petit col percé. */
function lidGeometry() {
  const y0 = H - 0.006;
  const pts = [
    [RT - 0.012, y0 - 0.02], [RT + 0.016, y0 - 0.012], [RT + 0.03, y0 + 0.004], [RT + 0.026, y0 + 0.022],
    [RT + 0.004, y0 + 0.03], [RT - 0.008, y0 + 0.036],
  ];
  const R = RT - 0.01, DH = 0.43;
  const n = 36;
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * (Math.PI / 2 - 0.08);
    pts.push([R * Math.cos(t), y0 + 0.036 + DH * Math.sin(t)]);
  }
  const top = y0 + 0.036 + DH * Math.sin(Math.PI / 2 - 0.08);
  const rTop = R * Math.cos(Math.PI / 2 - 0.08);
  pts.push([rTop * 0.7, top + 0.012], [0.05, top + 0.014], [0.042, top + 0.004], [0.04, top - 0.01]);
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 160);
}

/** Condensation : buée + gouttes + coulures. R = transmission, G = rugosité ; normal map. */
function condensationMaps(seed) {
  const W = 2048, Hh = 1024;
  const r = rng(seed);
  const hgt = new Float32Array(W * Hh);
  const clear = new Float32Array(W * Hh); // 1 = surface nette (goutte / coulure)
  const fogN = normalizeArr(fbm(W, Hh, { cells: 6, cellsY: 3, octaves: 5, seed: seed + 1 }));
  const stamp = (cx, cy, rad, flat = 1) => {
    const x0 = Math.floor(cx - rad - 1), x1 = Math.ceil(cx + rad + 1);
    const y0 = Math.max(0, Math.floor(cy - rad * flat - 1)), y1 = Math.min(Hh - 1, Math.ceil(cy + rad * flat + 1));
    for (let y = y0; y <= y1; y++) {
      for (let xx = x0; xx <= x1; xx++) {
        const x = (xx + W) % W;
        const dx = (xx - cx) / rad, dy = (y - cy) / (rad * flat);
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const hh = Math.sqrt(1 - d2) * rad;
        const i = y * W + x;
        if (hh > hgt[i]) hgt[i] = hh;
        clear[i] = Math.max(clear[i], Math.min(1, (1 - d2) * 4));
      }
    }
  };
  // niveau de buée : sous le niveau de glace (v < 0.95), dégradé au-dessus
  const fillV = 0.93;
  // micro-gouttes
  for (let i = 0; i < 9000; i++) {
    const v = r() * fillV;
    stamp(r() * W, (1 - v) * Hh, 1.2 + r() * 2.6, 0.92);
  }
  // gouttes moyennes
  for (let i = 0; i < 1100; i++) {
    const v = Math.pow(r(), 0.8) * fillV;
    stamp(r() * W, (1 - v) * Hh, 3 + Math.pow(r(), 2) * 9, 0.9 + r() * 0.15);
  }
  // grosses gouttes + coulures
  for (let i = 0; i < 46; i++) {
    const x = r() * W;
    const v = 0.25 + r() * (fillV - 0.25);
    const rad = 9 + r() * 10;
    let y = (1 - v) * Hh;
    stamp(x, y, rad, 1.12);
    if (r() < 0.6) {
      const len = Hh * (0.08 + r() * 0.35);
      let xx = x;
      for (let k = 0; k < len; k += 2) {
        xx += (r() - 0.5) * 0.8;
        stamp(xx, y + k, rad * 0.36 * (1 - (k / len) * 0.4), 1);
      }
      stamp(xx, y + len, rad * 0.62, 1.1);
    }
  }
  // assemblage
  const tr = new Float32Array(W * Hh), ro = new Float32Array(W * Hh), H2 = new Float32Array(W * Hh);
  for (let y = 0; y < Hh; y++) {
    const v = 1 - y / Hh;
    const fogLevel = 1 - THREE.MathUtils.smoothstep(v, fillV - 0.06, fillV + 0.02);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const fog = fogLevel * THREE.MathUtils.smoothstep(fogN[i], 0.15, 0.95) * (1 - clear[i]);
      tr[i] = 1 - fog * 0.12;
      ro[i] = 0.02 + fog * 0.2;
      H2[i] = hgt[i] / 12;
    }
  }
  return {
    normal: heightToNormal(H2, W, Hh, 9, true),
    trRough: packTex(W, Hh, tr, ro, null, null),
  };
}

function petMaterial({ maps, side, rough = 1 }) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: rough, roughnessMap: maps?.trRough ?? null,
    transmission: 1, transmissionMap: maps?.trRough ?? null,
    ior: 1.5, thickness: 0.012,
    specularIntensity: 1,
    normalMap: maps?.normal ?? null, normalScale: new THREE.Vector2(1, -1),
    envMapIntensity: 1.25,
    side,
  });
}

/** Glaçon creux (cylindre arrondi percé) — géométrie par révolution. */
function hollowGeometry(ro, h, ri) {
  const k = 0.35;
  const pts = [
    [ri * 0.9, h * 0.62], [ri, h * 0.9], [ri + (ro - ri) * k, h], [ro - (ro - ri) * k, h], [ro, h * 0.86],
    [ro * 1.01, h * 0.5], [ro, h * 0.12], [ro * 0.82, 0.0], [0.0, 0.0],
  ];
  // fond du creux
  pts.unshift([0, h * 0.58]);
  const g = new THREE.LatheGeometry(pts.reverse().map(([x, y]) => new THREE.Vector2(x, y - h / 2)), 28);
  g.computeVertexNormals();
  return g;
}

function nuggetGeometry(seed) {
  const r = rng(seed);
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const a = [r() * 6, r() * 6, r() * 6];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const d = 1 + 0.14 * Math.sin(v.x * 2.6 + a[0]) * Math.sin(v.y * 3.1 + a[1]) + 0.08 * Math.sin(v.z * 5.3 + a[2]) + 0.05 * Math.sin((v.x + v.z) * 7 + a[1]);
    v.multiplyScalar(d);
    p.setXYZ(i, v.x * 1.05, v.y * 0.72, v.z * 0.9);
  }
  g.computeVertexNormals();
  return g;
}

/** Remplissage : placement aléatoire séquentiel sans chevauchement fort. */
function packIce(seed, count = 420) {
  const r = rng(seed);
  const out = [];
  for (let tries = 0; tries < 200000 && out.length < count; tries++) {
    const rad = 0.072 + r() * 0.03;
    // privilégie le bas : gravité grossière
    const yMax = 1.36;
    const y = 0.05 + rad * 0.8 + Math.pow(r(), 0.85) * (yMax - 0.05);
    let lim = radiusAt(Math.min(y, H)) - 0.014 - rad * 0.8;
    if (y > H - 0.01) {
      // sous le dôme
      const dy = (y - H) / 0.43;
      if (dy > 0.75) continue;
      lim = (RT - 0.02) * Math.sqrt(Math.max(0, 1 - dy * dy)) - rad;
      if (r() > 0.55) continue;
    }
    if (lim <= 0) continue;
    const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * lim;
    const pos = new THREE.Vector3(Math.cos(ang) * d, y, Math.sin(ang) * d);
    let ok = true;
    for (const o of out) {
      if (o.pos.distanceTo(pos) < (o.rad + rad) * 0.8) { ok = false; break; }
    }
    if (ok) out.push({ pos, rad, rot: new THREE.Euler(r() * 6, r() * 6, r() * 6), hollow: r() < 0.8, seed: Math.floor(r() * 1e6) });
  }
  return out;
}

function floorDrops(seed) {
  const r = rng(seed);
  const grp = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.06, transmission: 1, thickness: 0.02, ior: 1.33,
    specularIntensity: 0.8, envMapIntensity: 1.4,
  });
  const geo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 70; i++) {
    const d = new THREE.Mesh(geo, mat);
    const rad = 0.006 + Math.pow(r(), 2.4) * 0.035;
    const ang = r() * Math.PI * 2, dist = 0.4 + Math.pow(r(), 0.7) * 1.4;
    d.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist * 0.9 + 0.2);
    d.scale.set(rad * (1 + r() * 0.6), rad * 0.24, rad);
    d.rotation.y = r() * Math.PI;
    grp.add(d);
  }
  // petite flaque au pied du gobelet
  const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.01, ior: 1.33, specularIntensity: 0.8, envMapIntensity: 1.2,
  }));
  pud.rotation.x = -Math.PI / 2;
  pud.position.set(0.05, 0.002, 0.1);
  pud.scale.set(0.5, 0.42, 1);
  grp.add(pud);
  return grp;
}

const VARIANTS = [
  { cam: [0.85, 1.05, 6.2], target: [0, 0.86, 0], fov: 22, haloLift: 0.12 },
  { cam: [0.0, 1.6, 6.0], target: [0, 0.82, 0], fov: 22, haloLift: 0.1 },
  { cam: [-1.0, 0.75, 6.0], target: [0, 0.9, 0], fov: 22, haloLift: 0.16 },
];

export default async function render({ w, h, variant = 0 }) {
  const V = VARIANTS[variant] || VARIANTS[0];
  const studio = new Studio({ width: w, height: h, exposure: 1.05 });
  const { scene, renderer } = studio;
  scene.environment = buildEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(V.fov, w / h, 0.2, 200);
  camera.position.set(...V.cam);
  camera.lookAt(...V.target);
  camera.updateMatrixWorld();

  const bd = backdropUniforms({ haloSize: 0.42, glow: 0.6 });
  const backdrop = buildBackdrop(bd);
  const hz = new THREE.Vector3(camera.position.x, 0, camera.position.z - 1e4).project(camera);
  bd.horizon.value = hz.y * 0.5 + 0.5;
  bd.haloPos.value.set(0.5, bd.horizon.value + V.haloLift);
  backdrop.scale.set(160, 80, 1);
  backdrop.position.set(0, 24, -45);
  studio.addBase(backdrop);
  const floor = buildFloor({ seed: 8, bd });
  floor.userData.uniforms.fadeRadius.value = 6;
  floor.userData.uniforms.fogFar.value = 26;
  floor.userData.uniforms.reflBlur.value = 0.004;
  floor.userData.uniforms.poolCenter.value.set(0, -1.6);
  floor.userData.uniforms.poolRadius.value.set(2.2, 1.2);
  floor.userData.uniforms.poolColor.value.set('#3d6fae').multiplyScalar(0.8);
  studio.addBase(floor);
  mark('décor');

  // lumières
  const key = new THREE.DirectionalLight(0xeef6ff, 2.2);
  key.position.set(-6, 10, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2; key.shadow.camera.bottom = -2;
  key.shadow.radius = 8; key.shadow.blurSamples = 20;
  key.shadow.intensity = 0.4;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.SpotLight(0x8fd2ff, 90, 30, 0.5, 0.8, 1.6);
  rim.position.set(3, 3.5, -5); rim.target.position.set(0, 0.8, 0);
  scene.add(rim, rim.target);
  const rim2 = new THREE.SpotLight(0x5b9bff, 60, 30, 0.5, 0.9, 1.6);
  rim2.position.set(-4, 2.5, -4); rim2.target.position.set(0, 0.8, 0);
  scene.add(rim2, rim2.target);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x061224, 0.25));

  // gobelet + couvercle
  const cond = condensationMaps(7);
  mark('condensation');
  const cupGeo = cupGeometry();
  const lidGeo = lidGeometry();
  const lidMaps = (() => {
    const N = 512;
    const hh = fbm(N, N, { cells: 4, octaves: 3, seed: 77 });
    const ro = new Float32Array(N * N).fill(0.02);
    const tr = new Float32Array(N * N).fill(1);
    return { normal: heightToNormal(hh, N, N, 1.5), trRough: packTex(N, N, tr, ro, null, null) };
  })();
  const cupBack = new THREE.Mesh(cupGeo, petMaterial({ maps: cond, side: THREE.BackSide }));
  const cupFront = new THREE.Mesh(cupGeo, petMaterial({ maps: cond, side: THREE.FrontSide }));
  const lidBack = new THREE.Mesh(lidGeo, petMaterial({ maps: lidMaps, side: THREE.BackSide }));
  const lidFront = new THREE.Mesh(lidGeo, petMaterial({ maps: lidMaps, side: THREE.FrontSide }));
  cupFront.castShadow = true;

  studio.addLayer([floorDrops(31)], { reflect: false, name: 'gouttes sol' });
  studio.addLayer([cupBack, lidBack], { name: 'paroi arrière' });

  // glaçons creux
  const placed = packIce(5);
  const camPos = camera.position;
  placed.forEach((o) => { o.dist = o.pos.distanceTo(camPos); });
  placed.sort((a, b) => b.dist - a.dist);
  const maps = [iceMaps({ seed: 3, size: 256, frost: 0.45 }), iceMaps({ seed: 4, size: 256, frost: 0.35 })];
  const mats = maps.map((m) => iceMaterial({ maps: m, thickness: 0.12, normalScale: 0.4, attenuationDistance: 2, frostGlow: 0.07, envMapIntensity: 1.8 }));
  const hollowGeos = [hollowGeometry(0.1, 0.14, 0.042), hollowGeometry(0.09, 0.15, 0.036), hollowGeometry(0.105, 0.12, 0.048)];
  const nugGeos = [nuggetGeometry(1), nuggetGeometry(2), nuggetGeometry(3)];
  const buckets = 4;
  const per = Math.ceil(placed.length / buckets);
  for (let b = 0; b < buckets; b++) {
    const group = new THREE.Group();
    for (const o of placed.slice(b * per, (b + 1) * per)) {
      const geo = o.hollow ? hollowGeos[o.seed % 3] : nugGeos[o.seed % 3];
      const m = new THREE.Mesh(geo, mats[o.seed % 2]);
      m.position.copy(o.pos);
      m.rotation.copy(o.rot);
      m.scale.setScalar(o.hollow ? o.rad / 0.1 : o.rad);
      m.castShadow = true;
      group.add(m);
    }
    studio.addLayer([group], { name: `glace ${b}` });
  }
  studio.addLayer([cupFront, lidFront], { name: 'paroi avant' });
  mark(`scène : ${placed.length} glaçons`);

  await tick();
  await studio.render(camera, { floor, post: { bloom: 0.12, threshold: 1.3, vignette: 0.4, grain: 0.01 } });
}
