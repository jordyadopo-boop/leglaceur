/**
 * Scène WebGL du hero : « vitrine de glace » sur fond CLAIR (blanc-bleuté lumineux, comme les affiches).
 * - Fond plein écran (shader) : blanc givré, halo bleu glacier, caustiques douces, ombres caustiques des glaçons
 *   et le très grand mot « GLACEUR ». Il est OPAQUE : il est donc capturé par la passe de transmission et
 *   RÉFRACTÉ par les glaçons (le mot se tord et se dédouble à travers la glace).
 * - 4 à 7 glaçons : RoundedBoxGeometry légèrement irrégulière, MeshPhysicalMaterial (transmission 1, ior 1.31,
 *   dispersion, normal map procédurale, cœur laiteux, arêtes givrées), environnement PMREM froid.
 * - Givre en suspension (Points), éclats de lumière (sprites), éclats de glace et onde de choc au clic.
 * Chargée en import() dynamique par src/js/modules/hero.js.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap } from '../core/motion.js';
import { mulberry32, makeIceMaps, makeWordTexture, makeGlintTexture, makeRingTexture } from './textures.js';

const FOV = 30;
const CAM_Z = 14;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const R0 = 0.5; // rugosité de base (modulée par la carte de détails)

/* Points d'ancrage des glaçons, exprimés dans la « zone libre » (u, v ∈ [0, 1], v vers le bas).
   z : profondeur (vers la caméra si > 0), s : taille relative. */
const ANCHORS = {
  // Bureau : la zone libre est la colonne de droite (portrait). Les glaçons du bas chevauchent le mot géant.
  side: [
    { u: 0.5, v: 0.5, z: 0.9, s: 1.12 },
    { u: 0.84, v: 0.2, z: -0.8, s: 0.78 },
    { u: 0.8, v: 0.82, z: 1.5, s: 0.74 },
    { u: 0.14, v: 0.26, z: -1.6, s: 0.66 },
    { u: 0.2, v: 0.86, z: 0.4, s: 0.58 },
    { u: 0.46, v: 0.13, z: -3.4, s: 0.48 },
    { u: 1.06, v: 0.56, z: -3.8, s: 0.56 },
  ],
  // Mobile / tablette : bande libre sous le texte (paysage).
  band: [
    { u: 0.3, v: 0.52, z: 0.6, s: 1 },
    { u: 0.77, v: 0.36, z: -0.8, s: 0.84 },
    { u: 0.94, v: 0.86, z: 1.4, s: 0.54 },
    { u: 0.03, v: 0.16, z: -1.8, s: 0.56 },
    { u: 0.56, v: 0.94, z: 1.9, s: 0.42 },
    { u: 0.52, v: 0.02, z: -3.2, s: 0.44 },
    { u: -0.06, v: 0.9, z: 0.4, s: 0.48 },
  ],
};

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */
const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

const NSH = 7; // ombres caustiques (une par glaçon au maximum)
const BG_FRAG = /* glsl */ `
#define NSH ${NSH}
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uHalo;
uniform vec2 uPar;
uniform sampler2D uWord;
uniform vec4 uWordRect;
uniform float uWordAlpha;
uniform float uWordLift;
uniform float uFade;
uniform float uCaustic;
uniform vec4 uShadow[NSH];
uniform vec3 cTop;
uniform vec3 cBottom;
uniform vec3 cHalo;
uniform vec3 cLine;
uniform vec3 cShadow;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// Caustiques (lumière traversant l'eau / la glace)
float caustic(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

void main() {
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - 0.5) * asp, uv.y - 0.5);

  // Blanc givré, légèrement bleuté vers le bas (comme les affiches)
  vec3 col = mix(cBottom, cTop, smoothstep(-0.05, 0.72, uv.y));

  // Halo bleu glacier derrière les glaçons + source de lumière blanche en haut
  vec2 h = vec2((uv.x - uHalo.x) * asp, uv.y - uHalo.y) + uPar * 0.35;
  float halo = exp(-dot(h, h) * 2.1);
  col = mix(col, cHalo, halo * 0.62);

  // Caustiques bleutées, surtout dans le halo
  float c = clamp(caustic(p * 3.0 + uPar * 0.8 - 250.0, uTime * 0.3), 0.0, 1.0);
  col = mix(col, cLine, c * uCaustic * (0.22 + halo * 0.9));

  // Ombres caustiques des glaçons : pénombre bleue + cœur de lumière concentrée
  for (int k = 0; k < NSH; k++) {
    vec4 s = uShadow[k];
    if (s.w <= 0.001) continue;
    vec2 d = (uv - s.xy) * vec2(asp, 1.0) / s.z;
    float r2 = dot(d, d);
    col = mix(col, cShadow, exp(-r2 * 2.6) * s.w * 0.2);
    col = mix(col, cLine, exp(-r2 * 7.0) * s.w * 0.16);
    col = mix(col, vec3(1.0), exp(-r2 * 26.0) * s.w * 0.55);
  }

  // Le très grand mot
  vec2 w = (uv - uWordRect.xy - vec2(0.0, uWordLift)) / uWordRect.zw + 0.5 + uPar * 0.02;
  if (w.x > 0.0 && w.x < 1.0 && w.y > 0.0 && w.y < 1.0) {
    vec4 t = texture2D(uWord, w);
    col = mix(col, t.rgb, t.a * uWordAlpha);
  }

  // Coins à peine bleutés (profondeur douce)
  float v = smoothstep(1.25, 0.25, length(p * vec2(0.8, 1.1)));
  col = mix(cBottom * 0.94, col, mix(0.55, 1.0, v));
  col = mix(vec3(1.0), col, uFade);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
}`;

const FROST_VERT = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uScroll;
uniform float uIntro;
uniform vec3 uPointer;
uniform vec3 uBox;
attribute float aSeed;
attribute float aSize;
varying float vA;
varying float vSpark;
void main() {
  vec3 p = position;
  float sp = 0.1 + aSeed * 0.2;
  p.y = mod(p.y + uTime * sp * (1.0 + uScroll * 6.0) + uBox.y * 0.5, uBox.y) - uBox.y * 0.5;
  p.x += sin(uTime * 0.33 + aSeed * 31.0) * 0.32 + uScroll * (aSeed - 0.5) * 7.0;
  p.z += cos(uTime * 0.27 + aSeed * 17.0) * 0.25;
  vec2 d = p.xy - uPointer.xy;
  float dl = length(d);
  p.xy += (d / max(dl, 0.001)) * smoothstep(1.9, 0.0, dl) * 0.9 * uPointer.z;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float spark = step(0.88, aSeed);
  gl_PointSize = max(1.0, aSize * (1.0 + spark * 1.6) * uScale / -mv.z);
  float tw = 0.5 + 0.5 * sin(uTime * (1.1 + aSeed * 2.6) + aSeed * 50.0);
  float edge = smoothstep(uBox.y * 0.5, uBox.y * 0.34, abs(p.y));
  vA = (0.22 + 0.78 * tw) * edge * uIntro * (0.5 + 0.5 * smoothstep(-8.0, 2.0, p.z));
  vSpark = spark * tw;
}`;

const BURST_VERT = /* glsl */ `
uniform float uScale;
attribute float aAlpha;
attribute float aSize;
varying float vA;
varying float vSpark;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize * uScale / -mv.z);
  vA = aAlpha;
  vSpark = step(0.6, fract(aSize * 97.0)) * aAlpha;
}`;

const POINT_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
varying float vSpark;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  // Sur fond clair : paillette de givre (cœur blanc, frange bleutée) ou étoile à 4 branches pour les éclats.
  float disc = smoothstep(0.5, 0.0, d);
  float star = (smoothstep(0.06, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)) + smoothstep(0.06, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)));
  float a = mix(pow(disc, 1.6), max(star, pow(disc, 6.0)), vSpark) * vA;
  if (a < 0.004) discard;
  vec3 col = mix(uColor, vec3(1.0), smoothstep(0.32, 0.0, d) * 0.85);
  gl_FragColor = vec4(col, a);
}`;

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */
function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(30, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#ffffff') },
        mid: { value: new THREE.Color('#bfe0ff') },
        bottom: { value: new THREE.Color('#0d2a5c') },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bottom; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.75)) : mix(mid, bottom, pow(-y, 0.5)); gl_FragColor = vec4(c, 1.0); }',
    }),
  );
  env.add(sky);
  // Panneaux lumineux : longs reflets froids sur les arêtes des glaçons.
  const panel = (w, h, pos, color, k) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(16, 3.2, [0, 13, 5], '#ffffff', 8);
  panel(2.2, 18, [-13, 2, 5], '#e6f4ff', 5);
  panel(1.4, 15, [13, 1, -1], '#ffffff', 9);
  panel(3, 20, [-12, 0, -6], '#0a1f44', 1); // bandes marines : arêtes nettes sur fond blanc
  panel(2, 16, [11, -2, 8], '#0f2c5e', 1);
  panel(12, 4, [0, -1, -15], '#2a7deb', 2.5);
  panel(7, 7, [7, -11, 8], '#1563d6', 1.6);
  panel(3, 3, [6, 6, 12], '#ffffff', 6);
  // Derrière la caméra : bandes marines et réglettes blanches → reflets nets et contrastés sur les faces avant.
  panel(26, 5, [0, -6, 16], '#071a3d', 1);
  panel(1.2, 10, [-5, 3, 15], '#ffffff', 9);
  panel(0.8, 9, [4.5, 2, 15], '#ffffff', 7);
  panel(10, 1.2, [0, 8, 13], '#dff0ff', 6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();
  return rt;
}

function makeCubeGeometry(seed, segments) {
  const rand = mulberry32(seed);
  const g = new RoundedBoxGeometry(1, 1, 1, segments, 0.12);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const sx = 0.94 + rand() * 0.1, sy = 0.9 + rand() * 0.12, sz = 0.94 + rand() * 0.1;
  const k1 = rand() * 10, k2 = rand() * 10, k3 = rand() * 10;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    // Surface légèrement fondue, irrégulière
    const w = Math.sin(v.x * 3.1 + k1) * Math.cos(v.y * 2.7 + k2) * Math.sin(v.z * 2.3 + k3);
    v.addScaledVector(n, w * 0.024);
    const taper = 1 - (v.y + 0.5) * 0.05;
    v.set(v.x * sx * taper, v.y * sy, v.z * sz * taper);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * @param {{ canvas: HTMLCanvasElement, mobile: boolean, reduced: boolean, onLost?: () => void }} opts
 */
export async function createIceScene({ canvas, mobile, reduced, onLost }) {
  const rand = mulberry32(2026);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  let dprCap = mobile ? 1.25 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.transmissionResolutionScale = mobile ? 0.5 : 0.7;
  renderer.setClearColor('#ffffff', 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
  camera.position.set(0, 0, CAM_Z);

  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;

  // Lumières ponctuelles : petits points spéculaires très vifs.
  const key = new THREE.DirectionalLight('#ffffff', 2.6);
  key.position.set(6, 9, 8);
  scene.add(key);
  const rim = new THREE.PointLight('#4d9bff', 30, 0, 2);
  rim.position.set(3, -1, -4);
  scene.add(rim);

  /* ---------- Fond (halo + caustiques + mot) ---------- */
  const word = await makeWordTexture(renderer, 'GLACEUR', mobile ? 1536 : 2048);
  const U = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uHalo: { value: new THREE.Vector2(0.7, 0.55) },
    uPar: { value: new THREE.Vector2() },
    uWord: { value: word.texture },
    uWordRect: { value: new THREE.Vector4(0.5, 0.45, 1, 0.3) },
    uWordAlpha: { value: reduced ? 1 : 0 },
    uWordLift: { value: 0 },
    uFade: { value: reduced ? 1 : 0.4 },
    uCaustic: { value: mobile ? 0.3 : 0.36 },
    uShadow: { value: Array.from({ length: NSH }, () => new THREE.Vector4(0, 0, 1, 0)) },
    cTop: { value: new THREE.Color('#ffffff') },
    cBottom: { value: new THREE.Color('#e3f1ff') },
    cHalo: { value: new THREE.Color('#b3d9ff') },
    cLine: { value: new THREE.Color('#9fd0ff') },
    cShadow: { value: new THREE.Color('#2a6fcf') },
  };
  const bgMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthWrite: false, depthTest: false, toneMapped: false });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -1000;
  scene.add(bg);

  /* ---------- Glaçons ---------- */
  const maps = makeIceMaps(mobile ? 256 : 512, 11);
  const segs = mobile ? 3 : 5;
  const geos = [makeCubeGeometry(3, segs), makeCubeGeometry(17, segs), makeCubeGeometry(29, segs)];
  const count = mobile ? 4 : 7;
  const cubes = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: R0,
      roughnessMap: maps.detail,
      transmission: 1,
      transmissionMap: maps.detail,
      thickness: 1.4,
      ior: 1.31,
      attenuationColor: new THREE.Color('#b4dcff'),
      attenuationDistance: 5.5,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      normalMap: maps.normal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      envMapIntensity: 2,
      dispersion: mobile ? 0 : 0.22,
      emissive: new THREE.Color('#d9efff'),
      emissiveIntensity: 0,
      side: mobile ? THREE.FrontSide : THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geos[i % geos.length], mat);
    mesh.userData.index = i;
    scene.add(mesh);
    const sign = rand() < 0.5 ? -1 : 1;
    cubes.push({
      mesh,
      mat,
      base: new THREE.Vector3(),
      rot0: new THREE.Euler((0.35 + rand() * 0.4) * (rand() < 0.5 ? -1 : 1), (0.5 + rand() * 0.45) * sign, (rand() - 0.5) * 0.5),
      spin: { x: 0, y: 0, z: 0 },
      drop: { y: 0 },
      pop: { v: 1 },
      flash: { v: 0 },
      frost: { v: 0 },
      hover: 0,
      hoverTarget: 0,
      phase: rand() * Math.PI * 2,
      speed: 0.75 + rand() * 0.5,
      size: 1,
      amp: 0.08,
      sign,
      landed: reduced,
      dir: new THREE.Vector2(),
    });
  }

  /* ---------- Givre en suspension ---------- */
  const NP = mobile ? 110 : 260;
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(NP * 3);
  const fSeed = new Float32Array(NP);
  const fSize = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    fPos[i * 3] = (rand() - 0.5);
    fPos[i * 3 + 1] = (rand() - 0.5);
    fPos[i * 3 + 2] = -8 + rand() * 11;
    fSeed[i] = rand();
    fSize[i] = 0.02 + Math.pow(rand(), 3) * 0.07;
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('aSeed', new THREE.BufferAttribute(fSeed, 1));
  fGeo.setAttribute('aSize', new THREE.BufferAttribute(fSize, 1));
  const fU = {
    uTime: { value: 0 },
    uScale: { value: 400 },
    uScroll: { value: 0 },
    uIntro: { value: reduced ? 1 : 0 },
    uPointer: { value: new THREE.Vector3(0, 0, 0) },
    uBox: { value: new THREE.Vector3(10, 10, 11) },
    uColor: { value: new THREE.Color('#5ea6f2') },
  };
  const frost = new THREE.Points(fGeo, new THREE.ShaderMaterial({
    uniforms: fU, vertexShader: FROST_VERT, fragmentShader: POINT_FRAG,
    transparent: true, depthWrite: false,
  }));
  frost.frustumCulled = false;
  scene.add(frost);

  /* ---------- Paillettes d'impact ---------- */
  const NB = 160;
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(NB * 3);
  const bVel = new Float32Array(NB * 3);
  const bLife = new Float32Array(NB);
  const bMax = new Float32Array(NB).fill(1);
  const bAlpha = new Float32Array(NB);
  const bSize = new Float32Array(NB);
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3).setUsage(THREE.DynamicDrawUsage));
  bGeo.setAttribute('aAlpha', new THREE.BufferAttribute(bAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  bGeo.setAttribute('aSize', new THREE.BufferAttribute(bSize, 1).setUsage(THREE.DynamicDrawUsage));
  const bU = { uScale: fU.uScale, uColor: { value: new THREE.Color('#3f8fe6') } };
  const burst = new THREE.Points(bGeo, new THREE.ShaderMaterial({
    uniforms: bU, vertexShader: BURST_VERT, fragmentShader: POINT_FRAG,
    transparent: true, depthWrite: false,
  }));
  burst.frustumCulled = false;
  scene.add(burst);
  let bCursor = 0;
  let bActive = 0;

  /* ---------- Éclats de glace ---------- */
  const NS = 64;
  const shardGeo = new THREE.OctahedronGeometry(1, 0);
  const shardMat = new THREE.MeshStandardMaterial({ color: '#d6ecff', roughness: 0.04, metalness: 0.2, envMapIntensity: 2.4, transparent: true, opacity: 0.92, flatShading: true });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, NS);
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = false;
  scene.add(shards);
  const S = Array.from({ length: NS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), ang: 0, spin: 0, life: 0, max: 1, size: 0, scale: new THREE.Vector3() }));
  let sCursor = 0;
  let sActive = 0;
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < NS; i++) shards.setMatrixAt(i, zeroM);

  /* ---------- Éclats de lumière et ondes ---------- */
  const glintTex = makeGlintTexture();
  const ringTex = makeRingTexture();
  const glints = Array.from({ length: 3 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
    s.scale.setScalar(0.001);
    s.renderOrder = 10;
    scene.add(s);
    return s;
  });
  const rings = Array.from({ length: 2 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, depthWrite: false, transparent: true, opacity: 0 }));
    s.scale.setScalar(0.001);
    scene.add(s);
    return s;
  });
  let glintIdx = 0;
  let ringIdx = 0;

  /* ---------- État ---------- */
  let W = 1, H = 1, visH = 2 * CAM_Z * TAN, visW = visH, unitW = 1;
  let zoneCenter = new THREE.Vector2();
  let mode = 'side';
  let time = 0;
  let scroll = 0;
  let running = false;
  let raf = 0;
  let last = 0;
  let disposed = false;
  let introStarted = reduced;
  let glintTimer = 2.5;
  const shake = { v: 0 };
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let pointerActive = 0;
  let pointerActiveSmooth = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  let perf = { frames: 0, acc: 0, checked: false };

  function layout(zone) {
    const k = visH / H; // unités monde par pixel (plan z = 0)
    const toWorld = (px, py) => [(px - W / 2) * k, (H / 2 - py) * k];
    mode = zone.mode === 'band' ? 'band' : 'side';
    const anchors = ANCHORS[mode];
    const unitPx = mode === 'side'
      ? Math.min(zone.w * 0.36, zone.h * 0.3, 300)
      : Math.min(zone.h * 0.6, zone.w * 0.3, 210);
    unitW = unitPx * k;
    const [zx, zy] = toWorld(zone.x + zone.w / 2, zone.y + zone.h / 2);
    zoneCenter.set(zx, zy);
    cubes.forEach((c, i) => {
      const a = anchors[i % anchors.length];
      const [x0, y0] = toWorld(zone.x + a.u * zone.w, zone.y + a.v * zone.h);
      const depth = (CAM_Z - a.z) / CAM_Z;
      c.base.set(x0 * depth, y0 * depth, a.z);
      c.size = unitW * a.s;
      c.amp = c.size * 0.07;
      c.dir.set(c.base.x - zx, c.base.y - zy);
      if (c.dir.lengthSq() < 1e-4) c.dir.set(0.3, 1);
      c.dir.normalize();
    });
    // Halo centré sur la zone libre ; mot géant : toute la largeur, posé en bas (bureau) ou au cœur de la bande (mobile).
    U.uHalo.value.set((zone.x + zone.w * 0.5) / W, 1 - (zone.y + zone.h * 0.45) / H);
    const wordW = W * (mode === 'side' ? 0.985 : 1.04);
    const wordH = wordW / word.aspect;
    const cy = mode === 'side' ? H - wordH * 0.4 : zone.y + zone.h * 0.56;
    U.uWordRect.value.set(0.5, 1 - cy / H, wordW / W, wordH / H);
    fU.uBox.value.set(visW * 1.35, visH * 1.3, 11);
  }

  function resize(width, height, zone) {
    W = Math.max(1, Math.round(width));
    H = Math.max(1, Math.round(height));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    visH = 2 * CAM_Z * TAN;
    visW = visH * camera.aspect;
    U.uRes.value.set(W, H);
    fU.uScale.value = (H * renderer.getPixelRatio()) / (2 * TAN);
    layout(zone);
    if (!running) renderOnce();
  }

  /* ---------- Effets ---------- */
  function spawnBurst(center, n, size, up = 1) {
    for (let j = 0; j < n; j++) {
      const i = bCursor;
      bCursor = (bCursor + 1) % NB;
      tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      bPos[i * 3] = center.x + tmp.x * size * 0.35;
      bPos[i * 3 + 1] = center.y + tmp.y * size * 0.35;
      bPos[i * 3 + 2] = center.z + tmp.z * size * 0.35;
      const sp = (1.2 + rand() * 2.6) * size;
      bVel[i * 3] = tmp.x * sp;
      bVel[i * 3 + 1] = tmp.y * sp * 0.7 + up * size * (0.6 + rand());
      bVel[i * 3 + 2] = tmp.z * sp;
      bMax[i] = bLife[i] = 0.7 + rand() * 0.8;
      bSize[i] = (0.03 + rand() * rand() * 0.09) * Math.max(1, size * 0.8);
    }
    bActive = 2;
  }

  function spawnShards(center, normal, n, size) {
    for (let j = 0; j < n; j++) {
      const s = S[sCursor];
      sCursor = (sCursor + 1) % NS;
      s.p.copy(center);
      tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().addScaledVector(normal, 1.1).normalize();
      s.v.copy(tmp).multiplyScalar((2.4 + rand() * 3.4) * size);
      s.v.y += size * (1 + rand() * 1.5);
      s.axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      s.ang = rand() * Math.PI;
      s.spin = (rand() - 0.5) * 16;
      s.max = s.life = 0.9 + rand() * 0.7;
      s.size = size * (0.03 + rand() * 0.07);
      s.scale.set(s.size * (0.5 + rand() * 0.5), s.size * (1 + rand() * 1.2), s.size * (0.3 + rand() * 0.3));
    }
    sActive = 2;
  }

  function spawnRing(at, size) {
    const r = rings[ringIdx];
    ringIdx = (ringIdx + 1) % rings.length;
    r.position.copy(at);
    gsap.killTweensOf([r.scale, r.material]);
    r.scale.setScalar(size * 0.2);
    r.material.opacity = 0.95;
    gsap.to(r.scale, { x: size * 2.6, y: size * 2.6, duration: 0.9, ease: 'expo.out' });
    gsap.to(r.material, { opacity: 0, duration: 0.9, ease: 'power2.in' });
  }

  function spawnGlint(c) {
    if (!c) {
      const pool = cubes.filter((q) => q.landed);
      if (!pool.length) return;
      c = pool[Math.floor(rand() * pool.length)];
    }
    // Coin le plus tourné vers la lumière et la caméra.
    const m = c.mesh;
    m.updateMatrixWorld();
    tmp2.copy(key.position).normalize().add(tmp.set(0, 0, 1)).normalize();
    let best = null, bestD = -Infinity;
    const cand = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      cand.set(i & 1 ? 0.44 : -0.44, i & 2 ? 0.44 : -0.44, i & 4 ? 0.44 : -0.44).applyMatrix4(m.matrixWorld);
      const d = tmp.copy(cand).sub(m.position).normalize().dot(tmp2);
      if (d > bestD) { bestD = d; best = cand.clone(); }
    }
    const g = glints[glintIdx];
    glintIdx = (glintIdx + 1) % glints.length;
    g.position.copy(best).add(tmp.set(0, 0, 0.05));
    gsap.killTweensOf([g.scale, g.material]);
    const s = c.size * (0.55 + rand() * 0.35);
    g.material.rotation = rand() * 0.6;
    g.scale.setScalar(0.001);
    g.material.opacity = 1;
    gsap.timeline()
      .to(g.scale, { x: s, y: s, duration: 0.32, ease: 'power2.out' })
      .to(g.scale, { x: 0.001, y: 0.001, duration: 0.7, ease: 'power2.in' })
      .to(g.material, { rotation: g.material.rotation + 0.9, duration: 1.02, ease: 'none' }, 0);
  }

  function land(c) {
    c.landed = true;
    gsap.fromTo(c.flash, { v: 0.55 }, { v: 0, duration: 1.2, ease: 'power2.out' });
    gsap.fromTo(c.frost, { v: 0.9 }, { v: 0, duration: 1.6, ease: 'power2.out' });
    tmp.copy(c.mesh.position);
    tmp.y -= c.size * 0.45;
    spawnBurst(tmp, mobile ? 10 : 18, c.size, 0.6);
    shake.v = Math.max(shake.v, c.size * 0.035);
    gsap.delayedCall(0.25, () => spawnGlint(c));
  }

  /* ---------- Boucle ---------- */
  const cubeMeshes = cubes.map((c) => c.mesh);
  const _p = new THREE.Vector3();

  // Ombres caustiques projetées sur le fond (lumière en haut à droite → ombre en bas à gauche).
  function updateShadows(s) {
    const arr = U.uShadow.value;
    for (let i = 0; i < NSH; i++) {
      const c = cubes[i];
      if (!c) { arr[i].w = 0; continue; }
      const m = c.mesh.position;
      _p.set(m.x - c.size * 0.32, m.y - c.size * 0.62, m.z).project(camera);
      const near = 1 - Math.min(1, Math.max(0, c.drop.y) / (c.size * 4));
      const sh = (2 * (CAM_Z - m.z) * TAN) || 1;
      arr[i].set(_p.x * 0.5 + 0.5, _p.y * 0.5 + 0.5, (c.size * 0.95) / sh, near * near * (1 - s) * (0.75 + 0.25 * c.size / (unitW || 1)));
    }
  }

  function update(dt) {
    time += dt;
    U.uTime.value = time;
    fU.uTime.value = time;
    fU.uScroll.value = scroll;

    // Pointeur lissé (parallaxe)
    const ease = 1 - Math.pow(0.0015, dt);
    pointerSmooth.lerp(pointer, ease || 0);
    pointerActiveSmooth += (pointerActive - pointerActiveSmooth) * (ease || 0);
    const autoX = mode === 'band' ? Math.sin(time * 0.25) * 0.35 : 0;
    const autoY = mode === 'band' ? Math.cos(time * 0.2) * 0.25 : 0;
    const px = pointerSmooth.x + autoX, py = pointerSmooth.y + autoY;
    shake.v *= Math.pow(0.02, dt);
    camera.position.set(px * 0.55, py * 0.32 + Math.sin(time * 40) * shake.v, CAM_Z);
    camera.lookAt(px * 0.12, py * 0.08, 0);
    U.uPar.value.set(-px * 0.04, -py * 0.03);
    fU.uPointer.value.set(pointerSmooth.x * visW * 0.5, pointerSmooth.y * visH * 0.5, pointerActiveSmooth);

    // Dissolution au défilement
    const s = scroll * scroll * (3 - 2 * scroll);
    U.uWordLift.value = s * 0.14;

    for (const c of cubes) {
      const t = time * c.speed;
      c.hover += (c.hoverTarget - c.hover) * Math.min(1, dt * 8);
      const fy = Math.sin(t * 0.62 + c.phase) * c.amp;
      const fx = Math.cos(t * 0.41 + c.phase * 1.3) * c.amp * 0.5;
      const m = c.mesh;
      m.position.set(
        c.base.x + fx + c.dir.x * s * unitW * 2.6,
        c.base.y + fy + c.drop.y + c.dir.y * s * unitW * 1.8 + s * unitW * 1.1,
        c.base.z + s * 3.6,
      );
      m.rotation.set(
        c.rot0.x + Math.sin(t * 0.33 + c.phase) * 0.14 + c.spin.x + s * 1.2 * c.sign - py * 0.12,
        c.rot0.y + Math.cos(t * 0.27 + c.phase) * 0.18 + c.spin.y + s * 1.7 * c.sign + px * 0.18,
        c.rot0.z + Math.sin(t * 0.21 + c.phase * 2) * 0.06 + c.spin.z + s * 0.5,
      );
      m.scale.setScalar(c.size * c.pop.v * (1 + c.hover * 0.06));
      c.mat.emissiveIntensity = c.flash.v + c.hover * 0.1;
      c.mat.roughness = R0 + c.frost.v * (1 - R0);
    }
    updateShadows(s);

    // Paillettes
    if (bActive > 0) {
      let alive = false;
      for (let i = 0; i < NB; i++) {
        if (bLife[i] <= 0) { bAlpha[i] = 0; continue; }
        alive = true;
        bLife[i] -= dt;
        const k = Math.max(0, bLife[i] / bMax[i]);
        const drag = Math.pow(0.25, dt);
        bVel[i * 3] *= drag; bVel[i * 3 + 1] = bVel[i * 3 + 1] * drag - unitW * 0.9 * dt; bVel[i * 3 + 2] *= drag;
        bPos[i * 3] += bVel[i * 3] * dt; bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt; bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
        bAlpha[i] = k * k * (0.6 + 0.4 * Math.sin(time * 30 + i));
      }
      bGeo.attributes.position.needsUpdate = true;
      bGeo.attributes.aAlpha.needsUpdate = true;
      bGeo.attributes.aSize.needsUpdate = true;
      if (!alive) bActive -= 1;
    }

    // Éclats de glace
    if (sActive > 0) {
      let alive = false;
      for (let i = 0; i < NS; i++) {
        const sh = S[i];
        if (sh.life <= 0) { shards.setMatrixAt(i, zeroM); continue; }
        alive = true;
        sh.life -= dt;
        sh.v.y -= unitW * 7 * dt;
        sh.v.multiplyScalar(Math.pow(0.5, dt));
        sh.p.addScaledVector(sh.v, dt);
        sh.ang += sh.spin * dt;
        const k = Math.max(0, sh.life / sh.max);
        _q.setFromAxisAngle(sh.axis, sh.ang);
        tmp.copy(sh.scale).multiplyScalar(Math.min(1, k * 2.2));
        _m.compose(sh.p, _q, tmp);
        shards.setMatrixAt(i, _m);
      }
      shards.instanceMatrix.needsUpdate = true;
      if (!alive) sActive -= 1;
    }

    // Éclats de lumière réguliers
    if (introStarted && !reduced) {
      glintTimer -= dt;
      if (glintTimer <= 0) {
        spawnGlint();
        glintTimer = 1.4 + rand() * 2.2;
      }
    }
  }

  function adapt(dt) {
    // Qualité adaptative : si la machine peine (< ~35 i/s), on allège.
    if (perf.checked || !introStarted) return;
    perf.frames += 1;
    if (perf.frames > 30) perf.acc += dt;
    if (perf.frames === 150) {
      perf.checked = true;
      const avg = perf.acc / 120;
      if (avg > 0.029) {
        dprCap = 1;
        renderer.setPixelRatio(1);
        renderer.setSize(W, H, false);
        fU.uScale.value = H / (2 * TAN);
        renderer.transmissionResolutionScale = 0.45;
        for (const c of cubes) {
          if (c.mat.dispersion > 0) { c.mat.dispersion = 0; c.mat.needsUpdate = true; }
        }
      }
    }
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    adapt(dt);
    renderer.render(scene, camera);
  }

  function renderOnce() {
    if (disposed) return;
    update(0);
    renderer.render(scene, camera);
  }

  /* ---------- Contexte perdu ---------- */
  const onContextLost = (e) => {
    e.preventDefault();
    api.stop();
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // Avant l'intro, les glaçons attendent au-dessus du cadre.
  function hideAbove() {
    for (const c of cubes) {
      const half = (CAM_Z - c.base.z) * TAN;
      c.drop.y = half - c.base.y + c.size * 1.6;
    }
  }

  const api = {
    renderer,
    get running() { return running; },
    resize,
    start() {
      if (running || disposed || reduced) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    renderOnce,
    /** Compile les shaders sans bloquer (KHR_parallel_shader_compile si disponible). */
    async warm() {
      if (!renderer.extensions.has('KHR_parallel_shader_compile')) return; // sinon compileAsync bloque et prévient en console
      try { await renderer.compileAsync(scene, camera); } catch { /* compilation au premier rendu */ }
    },
    /** Entrée : les glaçons tombent et se figent avec un léger rebond. */
    intro() {
      if (introStarted || disposed) return;
      introStarted = true;
      gsap.to(U.uFade, { value: 1, duration: 1.8, ease: 'power2.out' });
      gsap.fromTo(U.uWordAlpha, { value: 0 }, { value: 1, duration: 2.4, ease: 'power2.out', delay: 0.15 });
      gsap.fromTo(U.uWordLift, { value: -0.05 }, { value: 0, duration: 2.6, ease: 'expo.out' });
      gsap.fromTo(fU.uIntro, { value: 0 }, { value: 1, duration: 2.5, ease: 'power1.out', delay: 0.4 });
      const order = cubes.map((c, i) => i).sort((a, b) => cubes[b].size - cubes[a].size);
      order.forEach((idx, j) => {
        const c = cubes[idx];
        const half = (CAM_Z - c.base.z) * TAN;
        const fall = half - c.base.y + c.size * 1.6;
        const d = 0.15 + j * 0.12;
        const dur = 0.55 + Math.min(0.35, fall * 0.04);
        c.drop.y = fall;
        c.spin.x = (rand() - 0.5) * 2.4;
        c.spin.y = (rand() - 0.5) * 3.2;
        c.spin.z = (rand() - 0.5) * 1.2;
        gsap.timeline({ delay: d })
          .to(c.drop, { y: -c.size * 0.1, duration: dur, ease: 'power3.in' })
          .call(() => land(c))
          .to(c.drop, { y: 0, duration: 1.1, ease: 'elastic.out(1, 0.42)' });
        gsap.to(c.spin, { x: 0, y: 0, z: 0, duration: dur + 0.25, delay: d, ease: 'power2.out' });
      });
    },
    setScroll(p) {
      scroll = Math.min(1, Math.max(0, p));
      if (!running) renderOnce();
    },
    setPointer(x, y, active) {
      pointer.set(x, y);
      pointerActive = active ? 1 : 0;
    },
    /** Glaçon sous le point (coordonnées en px dans le canvas), ou -1. */
    pick(x, y) {
      ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(cubeMeshes, false)[0];
      return hit ? { index: hit.object.userData.index, point: hit.point.clone(), normal: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 0, 1) } : null;
    },
    setHover(index) {
      cubes.forEach((c, i) => { c.hoverTarget = i === index ? 1 : 0; });
    },
    /** Clic / tap : le glaçon tourne et lâche des éclats. */
    hit(h) {
      const c = cubes[h.index];
      if (!c || reduced) return;
      const dirY = rand() < 0.5 ? -1 : 1;
      gsap.to(c.spin, {
        x: c.spin.x + (rand() - 0.5) * Math.PI,
        y: c.spin.y + dirY * Math.PI * (1 + Math.round(rand())),
        duration: 1.8,
        ease: 'expo.out',
      });
      gsap.fromTo(c.pop, { v: 0.9 }, { v: 1, duration: 1.1, ease: 'elastic.out(1, 0.38)' });
      gsap.fromTo(c.flash, { v: 0.45 }, { v: 0, duration: 0.9, ease: 'power2.out' });
      gsap.fromTo(c.frost, { v: 0.5 }, { v: 0, duration: 1.2, ease: 'power2.out' });
      spawnShards(h.point, h.normal, mobile ? 12 : 18, c.size);
      spawnBurst(h.point, mobile ? 18 : 30, c.size, 0.8);
      spawnRing(h.point, c.size);
      gsap.delayedCall(0.15, () => spawnGlint(c));
    },
    hideAbove,
    get introStarted() { return introStarted; },
    dispose() {
      if (disposed) return;
      disposed = true;
      api.stop();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gsap.killTweensOf([U.uFade, U.uWordAlpha, U.uWordLift, fU.uIntro]);
      cubes.forEach((c) => gsap.killTweensOf([c.spin, c.drop, c.pop, c.flash, c.frost]));
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          for (const k of Object.keys(o.material)) {
            const v = o.material[k];
            if (v && v.isTexture) v.dispose();
          }
          o.material.dispose();
        }
      });
      word.texture.dispose();
      maps.normal.dispose();
      maps.detail.dispose();
      glintTex.dispose();
      ringTex.dispose();
      envRT.dispose();
      renderer.dispose();
    },
  };

  if (!reduced) hideAbove();
  return api;
}
