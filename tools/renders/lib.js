/*
 * Le Glaceur — studio de rendu produit (Three.js, hors site).
 *
 * Plan :
 *  1. Studio « nuit polaire » : mur de fond en dégradé marine avec halo froid, sol noir-bleu mouillé.
 *  2. Environnement PMREM sur mesure (boîtes à lumière : plafond, bandes latérales, contre-jour cyan)
 *     → longs reflets nets sur les arêtes de glace, comme une prise de vue packshot.
 *  3. Glace = MeshPhysicalMaterial (transmission, ior 1,31, atténuation cyan, cartes procédurales
 *     de givre : normal/rugosité/transmission).
 *  4. Three.js ne voit pas un objet transmissif à travers un autre : on rend la scène en COUCHES
 *     (de l'arrière vers l'avant). Chaque couche réutilise l'image + la profondeur de la précédente
 *     (quad plein écran qui réécrit gl_FragDepth), donc la réfraction voit tout ce qui est derrière.
 *  5. Sol mouillé : réflexion par caméra miroir (même rendu en couches), floutée et ondulée.
 *  6. Finition : bloom doux, vignette, grain, ACES. Rendu à 2× puis réduction lanczos (sharp).
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ utilitaires */

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit de valeur périodique (tuilable), fbm. Renvoie Float32Array w*h dans ~[0,1]. */
export function fbm(w, h, { cells = 8, cellsY, octaves = 5, gain = 0.5, seed = 1, ridged = false } = {}) {
  const out = new Float32Array(w * h);
  const r = rng(seed);
  let amp = 1, total = 0;
  let cx = cells, cy = cellsY ?? cells;
  for (let o = 0; o < octaves; o++) {
    const lat = new Float32Array(cx * cy);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * cy;
      const y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = y0 % cy, yb = (y0 + 1) % cy;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * cx;
        const x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cx, xb = (x0 + 1) % cx;
        const a = lat[ya * cx + xa], b = lat[ya * cx + xb];
        const c = lat[yb * cx + xa], d = lat[yb * cx + xb];
        let v = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
        if (ridged) v = 1 - Math.abs(v * 2 - 1);
        out[y * w + x] += v * amp;
      }
    }
    total += amp;
    amp *= gain;
    cx *= 2; cy *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function normalizeArr(a) {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const k = 1 / (hi - lo || 1);
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) * k;
  return a;
}

/** Carte de hauteur → normal map tangentielle (RGBA8, répétable). */
export function heightToNormal(hgt, w, h, strength = 2, wrap = true) {
  const data = new Uint8Array(w * h * 4);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y)); }
    return hgt[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return dataTex(data, w, h);
}

export function dataTex(data, w, h, { srgb = false, repeat = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Empaquette jusqu'à 4 canaux (Float32Array 0..1) dans une texture RGBA8. */
export function packTex(w, h, r, g, b, a, opts) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r ? Math.max(0, Math.min(255, r[i] * 255)) : 255;
    data[i * 4 + 1] = g ? Math.max(0, Math.min(255, g[i] * 255)) : 255;
    data[i * 4 + 2] = b ? Math.max(0, Math.min(255, b[i] * 255)) : 255;
    data[i * 4 + 3] = a ? Math.max(0, Math.min(255, a[i] * 255)) : 255;
  }
  return dataTex(data, w, h, opts);
}

export function canvasTex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  return t;
}

/* ------------------------------------------------------------------ environnement */

/** Studio froid : pièce marine + boîtes à lumière. `flip` pour la passe miroir (non utilisé). */
export function buildEnvironment(renderer, opts = {}) {
  const {
    room = 0x081833, top = 6, left = 3.2, right = 4.2, back = 2.4, front = 1.2,
    tint = 0xeaf4ff, cyan = 0x9fdcff, blue = 0x4d8dff,
  } = opts;
  const env = new THREE.Scene();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(20, 12, 20),
    new THREE.MeshBasicMaterial({ color: room, side: THREE.BackSide }),
  );
  box.position.y = 4;
  env.add(box);
  // Sol de la pièce un peu plus sombre
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x030a18 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.9;
  env.add(floor);
  const panel = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look);
    env.add(m);
  };
  panel(7, 3.4, tint, top, [0, 9.5, 0.5], [0, 0, 0]); // grande boîte au plafond
  panel(1.1, 7, tint, left, [-9.5, 4, 2.5], [0, 2, 0]); // bande verticale gauche
  panel(0.9, 7, cyan, right, [9.5, 4, -1], [0, 2, 0]); // bande verticale droite, cyan
  panel(9, 1.4, blue, back, [0, 3, -9.5], [0, 2, 0]); // contre-jour bleu
  panel(5, 2, tint, front, [2, 3, 9.5], [0, 1, 0]); // débouchage face
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return rt.texture;
}

/* ------------------------------------------------------------------ décor */

/** Mur de fond : dégradé marine + halo froid (émissif, non éclairé). */
export function buildBackdrop({ haloPos = [0.5, 0.42], haloSize = 0.55, top = '#01050f', mid = '#071a3e', halo = '#2a6cc0', glow = 0.5 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      cTop: { value: new THREE.Color(top) },
      cMid: { value: new THREE.Color(mid) },
      cHalo: { value: new THREE.Color(halo) },
      haloPos: { value: new THREE.Vector2(...haloPos) },
      haloSize: { value: haloSize },
      glow: { value: glow },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cTop, cMid, cHalo; uniform vec2 haloPos; uniform float haloSize, glow; varying vec2 vUv;
      void main(){
        vec3 c = mix(cMid, cTop, smoothstep(0.2, 0.9, vUv.y));
        vec2 d = (vUv - haloPos) * vec2(1.0, 1.25);
        float r = length(d) / haloSize;
        c += cHalo * glow * (exp(-r*r*2.2) * 0.9 + exp(-r*r*0.6) * 0.25);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  mat.toneMapped = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.userData.backdrop = true;
  return m;
}

/** Sol mouillé : PBR sombre + vernis + réflexion miroir injectée (floue, ondulée). */
export function buildFloor({ size = 200, color = '#030a19', seed = 3, puddle = 0.7 } = {}) {
  const N = 1024;
  // micro-relief + flaques
  const hFine = fbm(N, N, { cells: 48, octaves: 4, seed });
  const pud = normalizeArr(fbm(N, N, { cells: 3, octaves: 4, seed: seed + 7 }));
  const rough = new Float32Array(N * N);
  const ripple = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const wet = THREE.MathUtils.smoothstep(pud[i], 0.35, 0.6);
    rough[i] = THREE.MathUtils.lerp(0.2, 0.1, wet * puddle + (1 - puddle) * 0.4);
    ripple[i] = hFine[i] * (1 - wet * 0.85);
  }
  const normal = heightToNormal(ripple, N, N, 3.0);
  const rmap = packTex(N, N, null, rough, null, null);
  const ripTex = heightToNormal(fbm(512, 512, { cells: 6, octaves: 3, seed: seed + 11 }), 512, 512, 6.0);
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 1, roughnessMap: rmap,
    metalness: 0,
    normalMap: normal, normalScale: new THREE.Vector2(0.25, 0.25),
    specularIntensity: 0.5,
    envMapIntensity: 0.22,
  });
  [normal, rmap].forEach((t) => t.repeat.set(size / 6, size / 6));
  const uniforms = {
    tReflect: { value: null },
    reflMatrix: { value: new THREE.Matrix4() },
    tRipple: { value: ripTex },
    reflStrength: { value: 0.85 },
    reflBlur: { value: 0.006 },
    reflDistort: { value: 0.006 },
    fadeCenter: { value: new THREE.Vector2(0, 0) },
    fadeRadius: { value: 14 },
    fogColor: { value: new THREE.Color('#071a3e') },
    fogFar: { value: 30 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 reflMatrix; varying vec4 vReflCoord; varying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 wp_ = modelMatrix * vec4(transformed,1.0); vWPos = wp_.xyz; vReflCoord = reflMatrix * wp_;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tReflect; uniform sampler2D tRipple; uniform float reflStrength, reflBlur, reflDistort, fadeRadius, fogFar; uniform vec2 fadeCenter; uniform vec3 fogColor;
        varying vec4 vReflCoord; varying vec3 vWPos;`)
      .replace('#include <opaque_fragment>', `
        {
          vec2 ruv = vReflCoord.xy / vReflCoord.w;
          vec2 rip = texture2D(tRipple, vWPos.xz * 0.11).xy * 2.0 - 1.0;
          vec2 rip2 = texture2D(tRipple, vWPos.xz * 0.45 + 0.37).xy * 2.0 - 1.0;
          ruv += (rip * 0.7 + rip2 * 0.3) * reflDistort;
          vec3 acc = vec3(0.0); float wsum = 0.0;
          for (int i = 0; i < 16; i++) {
            float a = float(i) * 2.39996;
            float rr = sqrt((float(i) + 0.5) / 16.0);
            vec2 o = vec2(cos(a), sin(a)) * rr * reflBlur;
            float wgt = 1.0 - rr * 0.6;
            acc += texture2D(tReflect, ruv + o).rgb * wgt; wsum += wgt;
          }
          vec3 refl = acc / wsum;
          vec3 V = normalize(cameraPosition - vWPos);
          float ndv = clamp(V.y, 0.0, 1.0);
          float fres = 0.32 + 0.68 * pow(1.0 - ndv, 4.0);
          float fade = 1.0 - smoothstep(fadeRadius * 0.45, fadeRadius, length(vWPos.xz - fadeCenter));
          outgoingLight += refl * reflStrength * fres * fade;
          float fogK = smoothstep(fadeRadius * 0.5, fogFar, length(vWPos.xz - fadeCenter));
          outgoingLight = mix(outgoingLight, fogColor, fogK);
        }
        #include <opaque_fragment>`);
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.userData.floor = true;
  m.userData.uniforms = uniforms;
  return m;
}

/* ------------------------------------------------------------------ glace */

/** Cartes de surface de glace : normal (fonte + givre), R = transmission, G = rugosité. */
export function iceMaps({ seed = 1, size = 512, frost = 0.5, melt = 1, aspect = 1 } = {}) {
  const w = size, h = size;
  const meltH = fbm(w, h, { cells: 3, cellsY: Math.max(1, Math.round(3 / aspect)), octaves: 4, seed, ridged: false });
  const ridge = fbm(w, h, { cells: 5, octaves: 3, seed: seed + 3, ridged: true });
  const fine = fbm(w, h, { cells: 64, octaves: 3, seed: seed + 5 });
  const frostN = normalizeArr(fbm(w, h, { cells: 4, octaves: 5, seed: seed + 9 }));
  const hgt = new Float32Array(w * h), tr = new Float32Array(w * h), ro = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const f = THREE.MathUtils.smoothstep(frostN[i], 1 - frost * 0.9, 1.05 - frost * 0.35);
    hgt[i] = meltH[i] * 0.9 * melt + ridge[i] * 0.25 * melt + fine[i] * (0.08 + f * 0.25);
    tr[i] = 1 - f * 0.55;
    ro[i] = 0.05 + f * 0.33 + fine[i] * 0.03;
  }
  return {
    normal: heightToNormal(hgt, w, h, 6),
    trRough: packTex(w, h, tr, ro, null, null),
  };
}

export function iceMaterial({ maps, thickness = 1, ior = 1.31, normalScale = 0.5, envMapIntensity = 1.35, attenuation = '#bfe6ff', attenuationDistance = 4, side = THREE.FrontSide } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 1, roughnessMap: maps?.trRough ?? null,
    transmission: 1, transmissionMap: maps?.trRough ?? null,
    thickness, ior,
    attenuationColor: new THREE.Color(attenuation), attenuationDistance,
    specularIntensity: 1,
    clearcoat: 0.35, clearcoatRoughness: 0.06,
    normalMap: maps?.normal ?? null, normalScale: new THREE.Vector2(normalScale, normalScale),
    envMapIntensity,
    side,
  });
}

/* ------------------------------------------------------------------ rendu en couches */

const LAYER_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Studio {
  constructor({ width, height, exposure = 1 }) {
    this.w = width; this.h = height;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    document.body.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.localClippingEnabled = false;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.layers = []; // [{ objects:[], reflect:true }]
    this.base = []; // décor (mur, sol)

    this.bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null } },
      vertexShader: LAYER_VS,
      fragmentShader: /* glsl */ `uniform sampler2D tColor; uniform sampler2D tDepth; varying vec2 vUv;
        void main(){ gl_FragColor = texture2D(tColor, vUv); gl_FragDepth = texture2D(tDepth, vUv).r; }`,
      depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
    }));
    this.bgQuad.frustumCulled = false;
    this.bgQuad.renderOrder = -1e6;
    this.scene.add(this.bgQuad);
  }

  makeRT(w = this.w, h = this.h, mips = false) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      generateMipmaps: mips,
      minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    rt.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
    return rt;
  }

  addBase(obj) { this.base.push(obj); this.scene.add(obj); return obj; }
  addLayer(objects, { reflect = true, name = '' } = {}) {
    objects.forEach((o) => this.scene.add(o));
    this.layers.push({ objects, reflect, name });
  }

  _show(predicate) {
    for (const o of this.base) o.visible = predicate('base', o);
    this.layers.forEach((L, i) => L.objects.forEach((o) => { o.visible = predicate(i, o, L); }));
  }

  /** Rend toutes les couches dans rtA/rtB, renvoie la cible finale. */
  renderLayered(camera, rtA, rtB, { reflection = false } = {}) {
    const r = this.renderer;
    let prev = null, cur = rtA;
    const list = this.layers.filter((L) => !reflection || L.reflect);
    for (let k = -1; k < list.length; k++) {
      const L = k >= 0 ? list[k] : null;
      this._show((i, o, LL) => {
        if (i === 'base') return k === -1 && !(reflection && o.userData.floor);
        return LL === L;
      });
      this.bgQuad.visible = prev !== null;
      if (prev) {
        this.bgQuad.material.uniforms.tColor.value = prev.texture;
        this.bgQuad.material.uniforms.tDepth.value = prev.depthTexture;
      }
      r.setRenderTarget(cur);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, true);
      r.render(this.scene, camera);
      r.getContext().finish(); mark('  couche ' + (L ? L.name : 'décor'));
      prev = cur;
      cur = cur === rtA ? rtB : rtA;
    }
    r.setRenderTarget(null);
    return prev;
  }

  /** Caméra miroir (plan y = 0) façon Reflector. */
  mirrorCamera(camera) {
    const v = this._vcam || (this._vcam = camera.clone());
    const n = new THREE.Vector3(0, 1, 0);
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const view = camPos.clone().negate().reflect(n).negate();
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = look.clone().negate().reflect(n).negate();
    v.position.copy(view);
    v.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    v.lookAt(target);
    v.near = camera.near; v.far = camera.far;
    v.updateMatrixWorld();
    v.projectionMatrix.copy(camera.projectionMatrix);
    v.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    const tm = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);
    return { cam: v, matrix: tm };
  }

  async render(camera, { floor, post = {} } = {}) {
    const r = this.renderer;
    camera.updateMatrixWorld();
    // 1. ombres : une passe avec tout visible
    this._show(() => true);
    this.bgQuad.visible = false;
    r.shadowMap.autoUpdate = true;
    const tmp = this.makeRT(64, 80);
    r.setRenderTarget(tmp); r.render(this.scene, camera);
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = false;
    tmp.dispose();
    mark('ombres');

    // 2. réflexion du sol (demi-résolution)
    if (floor) {
      const rw = Math.round(this.w / 2), rh = Math.round(this.h / 2);
      const ra = this.makeRT(rw, rh), rb = this.makeRT(rw, rh);
      const { cam, matrix } = this.mirrorCamera(camera);
      r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.0005)];
      const refl = this.renderLayered(cam, ra, rb, { reflection: true });
      r.clippingPlanes = [];
      floor.userData.uniforms.tReflect.value = refl.texture;
      floor.userData.uniforms.reflMatrix.value.copy(matrix);
      this._reflKeep = [ra, rb];
      await tick();
      mark('réflexion');
    }

    // 3. rendu principal en couches
    const a = this.makeRT(this.w, this.h), b = this.makeRT(this.w, this.h);
    const out = this.renderLayered(camera, a, b);
    await tick();
    mark('principal');

    // 4. finition
    this.finish(out, post);
  }

  finish(rt, { bloom = 0.22, threshold = 1.1, vignette = 0.35, grain = 0.012, saturation = 1.0 } = {}) {
    const r = this.renderer;
    // chaîne de flou pour le bloom : copie en mipmaps
    const w = this.w, h = this.h;
    const small = new THREE.WebGLRenderTarget(Math.round(w / 4), Math.round(h / 4), { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const quad = (mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.frustumCulled = false; const s = new THREE.Scene(); s.add(m); return s; };
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bright = new THREE.ShaderMaterial({
      uniforms: { t: { value: rt.texture }, thr: { value: threshold }, px: { value: new THREE.Vector2(1 / w, 1 / h) } },
      vertexShader: LAYER_VS,
      fragmentShader: /* glsl */ `uniform sampler2D t; uniform float thr; uniform vec2 px; varying vec2 vUv;
        void main(){ vec3 c = vec3(0.0);
          for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) c += texture2D(t, vUv + vec2(x,y)*px*1.5).rgb;
          c /= 9.0; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * max(l - thr, 0.0) / max(l, 1e-4), 1.0); }`,
      toneMapped: false,
    });
    r.setRenderTarget(small); r.render(quad(bright), cam);
    const fin = new THREE.ShaderMaterial({
      uniforms: {
        t: { value: rt.texture }, tb: { value: small.texture },
        bloom: { value: bloom }, vig: { value: vignette }, grain: { value: grain }, sat: { value: saturation },
        res: { value: new THREE.Vector2(w, h) },
      },
      vertexShader: LAYER_VS,
      fragmentShader: /* glsl */ `uniform sampler2D t; uniform sampler2D tb; uniform float bloom, vig, grain, sat; uniform vec2 res; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        vec3 tap(float lod, float rad){ vec3 c = vec3(0.0); vec2 px = rad / res;
          for (int i=0;i<12;i++){ float a = float(i)*0.5236; c += textureLod(tb, vUv + vec2(cos(a),sin(a))*px, lod).rgb; }
          return c / 12.0 + textureLod(tb, vUv, lod).rgb * 0.0; }
        void main(){
          vec3 c = texture2D(t, vUv).rgb;
          vec3 b = tap(1.0, 6.0) * 0.5 + tap(3.0, 22.0) * 0.35 + tap(5.0, 70.0) * 0.25;
          c += b * bloom;
          float l = dot(c, vec3(0.2126,0.7152,0.0722)); c = mix(vec3(l), c, sat);
          vec2 q = vUv - 0.5; q.x *= res.x / res.y;
          c *= 1.0 - vig * smoothstep(0.25, 0.95, length(q));
          c += (hash(vUv * res) - 0.5) * grain * (0.4 + l);
          gl_FragColor = vec4(max(c, 0.0), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    r.setRenderTarget(null);
    r.clear();
    r.render(quad(fin), cam);
  }
}

export const T0 = performance.now();
export const mark = (l) => console.info(`${l} ${Math.round(performance.now() - T0)} ms`);
export const tick = () => new Promise((res) => setTimeout(res, 0));
