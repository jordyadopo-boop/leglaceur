/*
 * Rendu « barres » : barres de glace de bloc (5 kg et 10 kg) sur sol mouillé, studio nuit polaire.
 * Unité : 1 = 1 dm (10 cm). Dimensions crédibles (densité de la glace ≈ 0,92) :
 *   10 kg ≈ 1,35 × 1,35 × 6,0 dm (10,9 L) ; 5 kg ≈ 1,1 × 1,1 × 4,9 dm (5,9 L).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  Studio, rng, mark, buildEnvironment, buildBackdrop, buildFloor, iceMaps, iceMaterial, canvasTex, tick,
} from './lib.js';

/** Texture du cœur blanc (plumes de givre + voile laiteux) d'une glace de bloc. */
function coreTexture(seed, { w = 1024, h = 256, density = 1 } = {}) {
  const r = rng(seed);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  // voile laiteux central
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(240,248,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.filter = 'blur(10px)';
  g.beginPath();
  g.ellipse(w / 2, h / 2, w * 0.46, h * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  // plumes : traits fins partant de l'axe vers l'extérieur
  g.filter = 'blur(1.4px)';
  g.lineCap = 'round';
  const n = Math.round(260 * density);
  for (let i = 0; i < n; i++) {
    const x = w * (0.08 + r() * 0.84);
    const up = r() < 0.5 ? -1 : 1;
    const len = h * (0.1 + r() * 0.32);
    const ang = (r() - 0.5) * 0.9;
    const edge = Math.min(1, Math.min(x, w - x) / (w * 0.12));
    g.strokeStyle = `rgba(255,255,255,${(0.12 + r() * 0.35) * edge})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    g.moveTo(x, h / 2 + (r() - 0.5) * h * 0.08);
    g.quadraticCurveTo(x + ang * len * 0.5, h / 2 + up * len * 0.5, x + ang * len, h / 2 + up * len);
    g.stroke();
  }
  // filaments d'air le long de l'axe
  g.filter = 'blur(0.8px)';
  for (let i = 0; i < 40 * density; i++) {
    const y = h / 2 + (r() - 0.5) * h * 0.12;
    const x = w * (0.1 + r() * 0.6);
    g.strokeStyle = `rgba(255,255,255,${0.2 + r() * 0.4})`;
    g.lineWidth = 0.8 + r() * 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * (0.05 + r() * 0.25), y + (r() - 0.5) * 6); g.stroke();
  }
  return canvasTex(c, { srgb: true });
}

function bar({ L, S, seed, frost = 0.45 }) {
  const geo = new RoundedBoxGeometry(L, S, S, 6, 0.07);
  const maps = iceMaps({ seed, size: 768, frost, aspect: L / S });
  const mat = iceMaterial({ maps, thickness: S * 0.9, normalScale: 0.55, attenuationDistance: 5.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

/** Intérieur d'une barre (couche précédant la barre) : cœur blanc + bulles + traînées d'air. */
function internals({ L, S, seed }) {
  const r = rng(seed * 13 + 1);
  const grp = new THREE.Group();
  const tex = coreTexture(seed);
  const coreMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    color: new THREE.Color(0.8, 0.88, 1.0), opacity: 0.5,
  });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.86, S * 0.78), coreMat);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.86, S * 0.7), coreMat.clone());
  p2.material.map = coreTexture(seed + 50, { density: 0.7 });
  p2.rotation.x = Math.PI / 2;
  grp.add(p1, p2);
  // bulles
  const nB = 420;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.85, 0.93, 1.0), transparent: true, opacity: 0.32, depthWrite: false,
  }), nB);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < nB; i++) {
    const trail = i < nB * 0.55;
    // distance à l'axe : concentrées au cœur, traînées radiales
    const ang = r() * Math.PI * 2;
    const rad = trail ? (0.12 + r() * 0.3) * S : Math.pow(r(), 2.2) * 0.22 * S;
    p.set((r() - 0.5) * L * 0.9, Math.sin(ang) * rad, Math.cos(ang) * rad);
    const size = trail ? 0.0025 + r() * 0.0035 : 0.002 + Math.pow(r(), 3) * 0.014;
    if (trail) {
      // ellipsoïde allongé orienté vers l'axe
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, Math.sin(ang), Math.cos(ang)));
      s.set(size, size * (3 + r() * 6), size);
    } else {
      q.identity(); s.setScalar(size);
    }
    m.compose(p, q, s);
    bubbles.setMatrixAt(i, m);
  }
  grp.add(bubbles);
  return grp;
}

/** Gouttes d'eau posées sur une face (repère local de la barre). */
function surfaceDrops({ L, S, seed, count = 26 }) {
  const r = rng(seed * 7 + 3);
  const grp = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.04, ior: 1.33,
    specularIntensity: 1, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0,
  });
  const geo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < count; i++) {
    const d = new THREE.Mesh(geo, mat);
    const rad = 0.012 + Math.pow(r(), 2.5) * 0.05;
    d.scale.set(rad * (1 + r() * 0.4), rad * 0.55, rad);
    d.rotation.y = r() * Math.PI;
    d.position.set((r() - 0.5) * (L - 0.25), S / 2 - 0.004, (r() - 0.5) * (S - 0.22));
    grp.add(d);
  }
  return grp;
}

function floorDrops(seed, area) {
  const r = rng(seed);
  const grp = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.05, ior: 1.33,
    specularIntensity: 1, envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0,
  });
  const geo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const a of area) {
    for (let i = 0; i < a.n; i++) {
      const d = new THREE.Mesh(geo, mat);
      const rad = a.r0 + Math.pow(r(), 2.2) * a.r1;
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * a.spread;
      d.position.set(a.x + Math.cos(ang) * dist, 0, a.z + Math.sin(ang) * dist * 0.8);
      d.scale.set(rad * (1 + r() * 0.8), rad * 0.32, rad * (1 + r() * 0.3));
      d.rotation.y = r() * Math.PI;
      grp.add(d);
    }
  }
  return grp;
}

function cube(size, seed) {
  const maps = iceMaps({ seed, size: 256, frost: 0.4 });
  const m = new THREE.Mesh(new RoundedBoxGeometry(size, size, size, 5, size * 0.12), iceMaterial({ maps, thickness: size * 0.8, normalScale: 0.6 }));
  m.castShadow = true;
  return m;
}

const VARIANTS = [
  // 0 : une barre debout à l'arrière, deux couchées en diagonale
  { cam: [4.2, 6.2, 17.0], target: [0.1, 2.3, 0], fov: 28 },
  { cam: [-2.6, 3.4, 12.6], target: [0.1, 1.5, 0], fov: 28 },
  { cam: [4.5, 6.4, 10.8], target: [0.0, 1.2, 0.2], fov: 30 },
];

export default async function render({ w, h, variant = 0 }) {
  const V = VARIANTS[variant] || VARIANTS[0];
  const studio = new Studio({ width: w, height: h, exposure: 1.05 });
  const { scene, renderer } = studio;
  scene.environment = buildEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(V.fov, w / h, 0.5, 120);
  camera.position.set(...V.cam);
  camera.lookAt(...V.target);
  camera.updateMatrixWorld();

  mark('env');
  // décor
  const backdrop = buildBackdrop({ haloPos: [0.5, 0.26], haloSize: 0.2, glow: 0.7 });
  backdrop.scale.set(160, 80, 1);
  backdrop.position.set(0, 24, -45);
  studio.addBase(backdrop);
  const floor = buildFloor({ size: 80, seed: 5 });
  studio.addBase(floor);

  // lumières
  const key = new THREE.DirectionalLight(0xeef6ff, 2.4);
  key.position.set(-6, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.radius = 10; key.shadow.blurSamples = 20;
  key.shadow.intensity = 0.55;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.SpotLight(0x8fd2ff, 260, 40, 0.5, 0.8, 1.6);
  rim.position.set(5, 6, -9); rim.target.position.set(0, 1, 0);
  scene.add(rim, rim.target);
  const rim2 = new THREE.SpotLight(0x5b9bff, 160, 40, 0.5, 0.9, 1.6);
  rim2.position.set(-7, 4, -7); rim2.target.position.set(0, 1, 0);
  scene.add(rim2, rim2.target);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x061224, 0.25));

  // barres
  const defs = [
    { id: 'A', L: 6.0, S: 1.35, seed: 11, pos: [-1.45, 3.0, -1.6], rot: [0, 0.62, Math.PI / 2], frost: 0.5 }, // 10 kg debout
    { id: 'B', L: 6.0, S: 1.35, seed: 23, pos: [0.85, 0.675, -0.75], rot: [0, -0.52, 0], frost: 0.42 }, // 10 kg couchée
    { id: 'C', L: 4.9, S: 1.1, seed: 37, pos: [-0.25, 0.55, 1.35], rot: [0, -0.28, 0], frost: 0.38 }, // 5 kg devant
  ];
  const camPos = camera.position;
  const items = defs.map((d) => {
    const g = new THREE.Group();
    g.position.set(...d.pos);
    g.rotation.set(...d.rot);
    g.updateMatrixWorld();
    return { d, g, dist: g.position.distanceTo(camPos) };
  }).sort((a, b) => b.dist - a.dist);

  // gouttes au sol (avant les barres : la profondeur gère l'occlusion)
  const drops = floorDrops(91, [
    { x: 1.8, z: 2.6, n: 40, spread: 1.5, r0: 0.02, r1: 0.12 },
    { x: -1.9, z: 2.3, n: 26, spread: 1.2, r0: 0.02, r1: 0.09 },
    { x: 0.3, z: 0.4, n: 30, spread: 3.2, r0: 0.015, r1: 0.06 },
  ]);
  studio.addLayer([drops], { reflect: false, name: 'gouttes sol' });

  for (const { d, g } of items) {
    const inner = internals(d);
    inner.position.copy(g.position); inner.rotation.copy(g.rotation);
    const b = bar(d);
    b.position.copy(g.position); b.rotation.copy(g.rotation);
    studio.addLayer([inner], { name: `cœur ${d.id}` });
    studio.addLayer([b], { name: `barre ${d.id}` });
    const sd = surfaceDrops({ ...d, count: d.id === 'A' ? 10 : 28 });
    sd.position.copy(g.position); sd.rotation.copy(g.rotation);
    studio.addLayer([sd], { reflect: false, name: `gouttes ${d.id}` });
  }

  // glaçons au premier plan
  const c1 = cube(0.42, 101); c1.position.set(2.25, 0.21, 2.55); c1.rotation.set(0, 0.5, 0);
  const c2 = cube(0.36, 102); c2.position.set(2.85, 0.18, 1.85); c2.rotation.set(0, -0.3, 0);
  const c3 = cube(0.34, 103); c3.position.set(-2.35, 0.17, 2.75); c3.rotation.set(0, 0.9, 0);
  studio.addLayer([c2], { name: 'glaçon 2' });
  studio.addLayer([c1, c3], { name: 'glaçons' });

  mark('scène construite');
  floor.userData.uniforms.fadeRadius.value = 14;
  floor.userData.uniforms.fogFar.value = 42;
  await tick();
  await studio.render(camera, { floor, post: { bloom: 0.28, threshold: 1.0, vignette: 0.4, grain: 0.01 } });
}
