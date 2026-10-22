/**
 * Voile de givre plein écran (fx-ambient) — WebGL, chargé à la demande.
 *
 * Principe « After Effects » : une carte de temps de gel est générée une fois (les cristaux en
 * fougère poussent des bords vers l'intérieur ; chaque pixel stocke l'instant où il gèle).
 * Le shader révèle les pixels dont le temps est inférieur au niveau de givre courant :
 * le givre POUSSE réellement le long des dendrites quand on défile vite, et RECULE (fond)
 * quand on s'arrête. Relief par estampage (reflet en haut à gauche, ombre bleutée en bas
 * à droite), voile laiteux et grain générés dans le shader, éclats qui scintillent.
 * Seule une bande le long des bords est dessinée (le centre de l'écran ne coûte rien).
 * Sans WebGL : repli 2D (image de givre figée dont l'opacité suit le niveau).
 */
import { growFrost, indexAt, strokeSegments } from './crystals.js';
import { makeCanvas } from './sprites.js';
import { clamp } from './env.js';

// Même précision pour uRes dans les deux shaders (sinon l'édition de liens échoue).
const PREC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define P highp
#else
#define P mediump
#endif
`;

const VERT = `${PREC}
attribute vec2 aPos;
uniform P vec2 uRes;
varying vec2 vUv;
void main() {
  vUv = aPos / uRes;
  gl_Position = vec4(vUv.x * 2.0 - 1.0, 1.0 - vUv.y * 2.0, 0.0, 1.0);
}`;

const FRAG = `${PREC}
precision P float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform P vec2 uRes;
uniform float uScale;
uniform float uLevel;
uniform float uTime;
uniform float uDepth;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float cr(vec2 uv) {
  float t = texture2D(uMap, uv).r;
  return smoothstep(t, t + 0.05, uLevel) * (1.0 - step(0.975, t));
}
vec4 over(vec4 top, vec4 base) { return top + base * (1.0 - top.a); }

void main() {
  vec2 css = vUv * uRes / uScale;
  vec2 size = uRes / uScale;
  vec2 e = min(css, size - css);
  float d = min(e.x, e.y);
  float corner = (e.x * e.y) / (e.x + e.y + 1.0);
  float dist = min(d, corner * 1.6);
  float n1 = vnoise(css * 0.016);
  float n2 = vnoise(css * 0.065 + 13.0);
  float n = n1 * 0.65 + n2 * 0.35;

  // Voile : gèle du bord vers l'intérieur, front déchiqueté par le bruit.
  float tH = dist / uDepth * 0.95 + (n - 0.5) * 0.45;
  float haze = smoothstep(tH, tH + 0.2, uLevel * 0.97);
  float edge = 1.0 - smoothstep(0.0, uDepth * 0.6, dist);

  vec2 dd = vec2(1.0) / uRes * max(1.0, uScale);
  float c0 = cr(vUv);
  float cp = cr(vUv + dd);
  float cm = cr(vUv - dd);
  float lit = clamp(cp - cm, 0.0, 1.0);
  float shade = clamp(cm - cp, 0.0, 1.0);

  vec4 col = vec4(0.0);
  float hazeA = haze * (0.07 + 0.34 * edge * edge) * (0.7 + 0.6 * n2);
  col = over(vec4(vec3(0.84, 0.92, 1.0) * hazeA, hazeA), col);

  // Grain de givre (taches de cristaux microscopiques).
  float gr = hash(floor(css * 0.75));
  float g = smoothstep(0.78, 0.98, gr) * haze * (0.18 + 0.4 * edge) * (0.6 + 0.8 * n1);
  col = over(vec4(vec3(0.97, 0.99, 1.0) * g, g), col);

  // Cristaux en relief.
  float body = c0 * (0.3 + 0.22 * edge);
  col = over(vec4(vec3(0.82, 0.92, 1.0) * body, body), col);
  float sh = shade * 0.24;
  col = over(vec4(vec3(0.05, 0.2, 0.48) * sh, sh), col);
  float hi = lit * 0.9;
  col = over(vec4(vec3(1.0) * hi, hi), col);

  // Éclats qui scintillent.
  float sp = hash(floor(css * 0.42) + 7.0);
  float tw = step(0.9965, sp) * haze * (0.5 + 0.5 * sin(uTime * 2.6 + sp * 517.0));
  col = over(vec4(vec3(tw), tw), col);

  gl_FragColor = col * smoothstep(0.0, 0.1, uLevel);
}`;

/** Profondeur maximale du givre (px CSS) selon la taille de l'écran. */
export const depthFor = (w, h) => clamp(Math.min(w, h) * 0.2, 90, 200);

/** Carte de temps de gel (niveaux de gris : noir = gèle tout de suite, blanc = jamais). */
function buildMap(cw, ch, scale, depth) {
  const c = makeCanvas(cw, ch);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, cw, ch);
  const w = cw / scale;
  const h = ch / scale;
  const segs = growFrost({ w, h, depth, seed: 29, spacing: w < 600 ? 36 : 46, step: 5.5, maxGen: 2, corner: 1.25, stars: 5, pair: 0.35 });
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.lineCap = 'round';
  const B = 64;
  for (let b = B - 1; b >= 0; b--) {
    const from = indexAt(segs, b / B);
    const to = indexAt(segs, (b + 1) / B);
    if (from >= to) continue;
    const v = Math.round(((b + 0.5) / B) * 255);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    strokeSegments(g, segs, from, to, [1.8, 1.2, 0.85]);
  }
  return { canvas: c, segs };
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || 'shader');
  }
  return s;
}

/**
 * @param {HTMLCanvasElement} canvas  canvas plein écran (position: fixed)
 * @returns {{ render(level:number, time:number):void, resize():void, destroy():void, kind:string } | null}
 */
export function createVeil(canvas) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  } catch {
    gl = null;
  }
  if (gl) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const r = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|softpipe/i.test(r)) {
      // Rendu logiciel : le voile 2D est bien plus léger. Le canvas a déjà un contexte WebGL : on le remplace.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      return createVeil2D(fresh);
    }
  }
  if (!gl) return createVeil2D(canvas);

  let prog;
  let buf;
  let tex;
  let loc = {};
  let W = 0;
  let H = 0;
  let scale = 1;
  let depth = 200;
  let mapW = 0;
  let mapH = 0;
  let count = 0;
  let lost = false;
  let shown = false;
  let quality = 1; // abaissée par le régulateur de fx-ambient si l'appareil peine

  function setup() {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    gl.useProgram(prog);
    loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uScale: gl.getUniformLocation(prog, 'uScale'),
      uLevel: gl.getUniformLocation(prog, 'uLevel'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uDepth: gl.getUniformLocation(prog, 'uDepth'),
      uMap: gl.getUniformLocation(prog, 'uMap'),
    };
    buf = gl.createBuffer();
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    mapW = 0;
    mapH = 0;
  }

  function band() {
    // Quatre bandes le long des bords (px du canvas) : le centre n'est jamais dessiné.
    const D = Math.min(depth * 1.35 * scale, W / 2, H / 2);
    const rects = [
      [0, 0, W, D],
      [0, H - D, W, H],
      [0, D, D, H - D],
      [W - D, D, W, H - D],
    ];
    const v = [];
    for (const [x0, y0, x1, y1] of rects) v.push(x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 0, 0);
    count = v.length / 2;
  }

  function resize() {
    const cw = innerWidth;
    const ch = innerHeight;
    // Givre doux : résolution CSS 1:1 (1,25 max sur écran dense), moins sur très grand écran.
    const base = Math.min(window.devicePixelRatio || 1, cw > 1680 ? 1 : 1.25);
    scale = base * quality;
    W = Math.round(cw * scale);
    H = Math.round(ch * scale);
    canvas.width = W;
    canvas.height = H;
    depth = depthFor(cw, ch);
    if (lost) return;
    gl.viewport(0, 0, W, H);
    // La carte est construite à la résolution de base ; on ne la régénère que si l'écran change
    // franchement de taille (pas pour la barre d'adresse mobile ni une baisse de qualité).
    const mw = Math.round(cw * base);
    const mh = Math.round(ch * base);
    if (!mapW || Math.abs(mw - mapW) / mapW > 0.12 || Math.abs(mh - mapH) / mapH > 0.12) {
      const { canvas: map } = buildMap(mw, mh, base, depth);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
      mapW = mw;
      mapH = mh;
    }
    band();
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    try {
      setup();
      resize();
    } catch {
      /* repli silencieux : le voile reste masqué */
    }
  });

  try {
    setup();
    resize();
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[fx-ambient] voile WebGL indisponible', err);
    // Un canvas qui a déjà un contexte WebGL ne peut plus fournir de contexte 2D : on le remplace.
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    return createVeil2D(fresh);
  }

  return {
    kind: 'webgl',
    resize,
    /** Baisse la résolution du voile (0,5 = moitié) sans régénérer la carte. */
    setQuality(q) {
      quality = clamp(q, 0.3, 1);
      resize();
    },
    get quality() {
      return quality;
    },
    render(level, time) {
      const on = level > 0.004 && !lost;
      if (on !== shown) {
        shown = on;
        canvas.style.visibility = on ? 'visible' : 'hidden';
        if (!on) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      }
      if (!on) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(loc.uRes, W, H);
      gl.uniform1f(loc.uScale, scale);
      gl.uniform1f(loc.uLevel, level);
      gl.uniform1f(loc.uTime, time);
      gl.uniform1f(loc.uDepth, depth);
      gl.uniform1i(loc.uMap, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    },
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** Repli sans WebGL : givre figé, opacité pilotée par le niveau (coût quasi nul : opacité CSS). */
export function createVeil2D(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let shown = false;
  function resize() {
    const cw = innerWidth;
    const ch = innerHeight;
    canvas.width = cw;
    canvas.height = ch;
    const depth = depthFor(cw, ch);
    const segs = growFrost({ w: cw, h: ch, depth, seed: 29, spacing: 50, step: 6, maxGen: 1, corner: 1.25 });
    const to = indexAt(segs, 0.8);
    const fade = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.hypot(cw, ch) / 2);
    fade.addColorStop(0, 'rgba(227,243,255,0)');
    fade.addColorStop(1, 'rgba(227,243,255,0.55)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, cw, ch);
    ctx.lineCap = 'round';
    strokeSegments(ctx, segs, 0, to, [1.8, 1.2, 0.85], () => 'rgba(10,40,90,0.25)', 0.8, 0.8);
    strokeSegments(ctx, segs, 0, to, [1.8, 1.2, 0.85], () => 'rgba(255,255,255,0.85)');
  }
  resize();
  return {
    kind: '2d',
    resize,
    render(level) {
      const on = level > 0.01;
      if (on !== shown) {
        shown = on;
        canvas.style.visibility = on ? 'visible' : 'hidden';
      }
      if (on) canvas.style.opacity = String(Math.min(1, level * 1.15));
    },
    destroy() {},
  };
}
