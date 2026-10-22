/**
 * Hero de l'accueil (agent hero) — « La fraîcheur sous toutes ses formes ».
 * 1. Contenu relu depuis config.js (lien WhatsApp, engagements, livraison offerte + jauge du panier).
 * 2. Intro orchestrée : le titre « gèle » lettre par lettre (SplitText), puis accroche, CTA, confiance.
 *    Démarre à 'preloader:done' (ou seule après 2,5 s) ; sans préchargeur, dès que la scène est prête (1,2 s au plus).
 * 3. Scène WebGL (src/js/hero/scene.js) chargée en import() dynamique après le premier rendu :
 *    glaçons en verre qui tombent et se figent, mot « GLACEUR » réfracté, givre, éclats au clic.
 *    Repli : glaçons en verre CSS + mot géant CSS (sans WebGL, ou avant que la scène ne soit prête).
 * 4. Défilement : les glaçons s'écartent et la scène se dissout ; pause hors écran / onglet caché.
 * Tout le texte est du HTML visible sans JS ; mouvement réduit : rendu statique, aucune animation.
 */
import { gsap, SplitText, reducedMotion, finePointer, isMobile } from '../core/motion.js';
import { BRAND, DELIVERY } from '../config.js';
import { waLink } from '../core/whatsapp.js';
import { computeTotals } from '../core/quote-store.js';

const WA_TEXT = 'Bonjour Le Glaceur, je souhaite passer une commande de glace.';
const NB = ' ';

/* ------------------------------------------------------------------ */
/* Contenu                                                             */
/* ------------------------------------------------------------------ */
function fillContent(el) {
  const wa = el.querySelector('[data-hero-wa]');
  if (wa) wa.href = waLink(WA_TEXT);

  const values = el.querySelectorAll('[data-hero-values] li');
  BRAND.values.forEach((v, i) => { if (values[i]) values[i].textContent = v.label; });

  const pill = el.querySelector('[data-hero-free]');
  const label = el.querySelector('[data-hero-free-label]');
  if (!pill || !label) return () => {};
  const base = DELIVERY.freeLabel.replace(/ (\d+) /g, ` $1${NB}`);
  const render = () => {
    let t = base;
    let state = 'idle';
    try {
      const { count, remainingForFree, freeEligible } = computeTotals();
      if (count > 0 && freeEligible) { t = `Livraison offerte sur votre commande`; state = 'free'; }
      else if (count > 0) { t = `Plus que ${remainingForFree}${NB}article${remainingForFree > 1 ? 's' : ''} pour la livraison offerte`; state = 'progress'; }
    } catch { /* panier indisponible : libellé par défaut */ }
    if (label.textContent !== t) label.textContent = t;
    pill.dataset.state = state;
  };
  render();
  window.addEventListener('quote:change', render);
  return () => window.removeEventListener('quote:change', render);
}

/* ------------------------------------------------------------------ */
/* Titre : découpage en lettres + reflet glacé continu par lettre      */
/* ------------------------------------------------------------------ */
function splitTitle(title) {
  const lines = [...title.querySelectorAll('[data-hero-line]')];
  // Lecteurs d'écran : une seule phrase propre, les lettres découpées sont masquées.
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = lines.map((l) => l.textContent.trim()).join(' ');
  title.prepend(sr);
  lines.forEach((l) => l.setAttribute('aria-hidden', 'true'));

  const splits = lines.map((l) => SplitText.create(l, { type: 'words,chars', tag: 'span', wordsClass: 'hero__w', charsClass: 'hero__ch', aria: 'none' }));
  const ice = title.querySelector('[data-hero-ice]');
  const iceChars = splits[lines.indexOf(ice)]?.chars || [];

  // Le dégradé .ice-text est rejoué lettre par lettre, aligné sur chaque ligne visuelle :
  // les lettres peuvent bouger indépendamment sans casser le reflet.
  const measure = () => {
    if (!iceChars.length) return;
    const rows = new Map();
    for (const c of iceChars) {
      const r = c.getBoundingClientRect();
      const key = Math.round(r.top / 8);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push([c, r]);
    }
    for (const row of rows.values()) {
      const left = Math.min(...row.map(([, r]) => r.left));
      const right = Math.max(...row.map(([, r]) => r.right));
      const L = Math.max(1, right - left);
      for (const [c, r] of row) {
        c.style.setProperty('--L', `${L.toFixed(1)}px`);
        c.style.setProperty('--ox', `${(r.left - left).toFixed(1)}px`);
      }
    }
  };
  if (ice) ice.classList.add('is-split');
  measure();
  return { splits, chars: splits.map((s) => s.chars), measure };
}

/** Petits cristaux qui scintillent au moment où les lettres gèlent. */
function makeSparkles(title, chars, n) {
  const out = [];
  const pool = chars.filter((c) => c.textContent.trim());
  for (let i = 0; i < n && pool.length; i++) {
    const c = pool[Math.floor(((i + 0.5) / n) * pool.length)];
    const s = document.createElement('span');
    s.className = 'hero__spark';
    s.setAttribute('aria-hidden', 'true');
    title.append(s);
    out.push({ s, c });
  }
  const place = () => {
    const tr = title.getBoundingClientRect();
    out.forEach(({ s, c }, i) => {
      const r = c.getBoundingClientRect();
      s.style.left = `${(r.left - tr.left + r.width * (i % 2 ? 0.85 : 0.2)).toFixed(1)}px`;
      s.style.top = `${(r.top - tr.top + r.height * (i % 3 === 0 ? 0.18 : 0.62)).toFixed(1)}px`;
    });
  };
  place();
  return { els: out.map((o) => o.s), place };
}

const webglOk = () => {
  try {
    const c = document.createElement('canvas');
    const gl = window.WebGL2RenderingContext && c.getContext('webgl2');
    if (!gl) return false;
    // Rendu logiciel (pas de vraie carte graphique) : la scène serait saccadée, on garde la version statique.
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|softpipe/i.test(renderer);
  } catch { return false; }
};

/* ------------------------------------------------------------------ */
export default function init(el) {
  const title = el.querySelector('[data-hero-title]');
  const content = el.querySelector('[data-hero-content]');
  const canvas = el.querySelector('[data-hero-canvas]');
  const zoneEl = el.querySelector('[data-hero-zone]');
  const hint = el.querySelector('[data-hero-hint]');
  const scrollCue = el.querySelector('[data-hero-scroll]');
  const offContent = fillContent(el);

  const wideMq = window.matchMedia('(min-width: 900px)');
  let scene = null;
  let introPlayed = false;
  let inView = true;
  let disposed = false;

  if (hint) hint.textContent = finePointer ? 'Cliquez sur un glaçon' : 'Touchez un glaçon';
  const glSupported = !!(canvas && zoneEl && webglOk());
  el.classList.add(glSupported ? 'has-gl' : 'is-static');

  /* ---------- Scène 3D : construite (import + compilation) PUIS affichée ----------
     La compilation des shaders peut bloquer le fil principal : elle n'a jamais lieu pendant l'intro du texte. */
  let built = null;
  function buildScene() {
    if (!glSupported) return Promise.resolve(null);
    built ??= new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)))
      .then(() => import('../hero/scene.js'))
      .then(async ({ createIceScene }) => {
        if (disposed) return null;
        const s = await createIceScene({
          canvas, mobile: isMobile, reduced: reducedMotion,
          onLost: () => { el.classList.remove('is-webgl'); el.classList.add('is-static'); scene = null; },
        });
        const z = measureZone();
        s.resize(z.W, z.H, z);
        await s.warm();
        if (disposed) { s.dispose(); return null; }
        return s;
      })
      .catch((err) => {
        console.warn('[hero] scène 3D indisponible, rendu statique.', err);
        el.classList.add('is-static');
        return null;
      });
    return built;
  }
  function showScene(s) {
    if (!s || disposed || scene) return;
    s.renderOnce(); // premier rendu (compilation éventuelle) : hors intro
    scene = s;
    el.classList.add('is-webgl');
    if (reducedMotion) return;
    if (hint) gsap.delayedCall(3.2, () => hint.classList.add('is-on'));
    sync();
    watchFps(s);
  }
  /* Garde-fou : si la scène tourne sous ~20 images/s, on repasse en rendu statique. */
  function watchFps(s) {
    let n = 0;
    let t0 = 0;
    const tick = (t) => {
      if (disposed || scene !== s) return;
      if (!t0) t0 = t;
      n++;
      if (t - t0 < 2500) { requestAnimationFrame(tick); return; }
      if (!inView || document.hidden) return;
      if (n / ((t - t0) / 1000) < 20) {
        s.dispose();
        scene = null;
        el.classList.remove('is-webgl');
        el.classList.add('is-static');
      }
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Mouvement réduit : tout est visible, scène figée (rendue une fois) ---------- */
  if (reducedMotion) {
    el.dataset.intro = 'done';
    new ResizeObserver(() => { if (scene) { const m = measureZone(); scene.resize(m.W, m.H, m); } }).observe(el);
    buildScene().then(showScene);
    return;
  }

  /* ---------- Intro (préparée en pause : états de départ posés tout de suite) ---------- */
  const T = splitTitle(title);
  const [charsA = [], charsB = []] = T.chars;
  const sparks = makeSparkles(title, [...charsA, ...charsB], isMobile ? 5 : 8);
  const ctas = [...el.querySelectorAll('.hero__ctas > li')];
  const trustBits = [...el.querySelectorAll('.hero__values li, .hero__free')];
  const lead = el.querySelector('.hero__lead');
  const eyebrow = el.querySelector('.hero__eyebrow');
  const cubesWrap = el.querySelector('.hero__cubes');

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'ice' } });
  tl.from(eyebrow, { opacity: 0, x: -18, filter: 'blur(6px)', duration: 0.9 }, 0)
    .from(charsA, {
      opacity: 0, yPercent: 38, scaleY: 1.25, filter: 'blur(14px)', color: '#8ecfff',
      duration: 1.15, stagger: { each: 0.04 }, transformOrigin: '50% 100%',
    }, 0.08)
    .from(charsB, {
      opacity: 0, yPercent: 38, scaleY: 1.25, filter: 'blur(14px)',
      duration: 1.15, stagger: { each: 0.03 }, transformOrigin: '50% 100%',
    }, 0.42)
    .fromTo(sparks.els, { scale: 0, opacity: 0, rotate: -45 }, {
      keyframes: [{ scale: 1, opacity: 1, rotate: 0, duration: 0.35, ease: 'back.out(3)' }, { scale: 0, opacity: 0, rotate: 45, duration: 0.6, ease: 'power2.in' }],
      stagger: { each: 0.09, from: 'random' },
    }, 0.45)
    .from(lead, { opacity: 0, y: 24, filter: 'blur(6px)', duration: 1 }, 0.95)
    .from(ctas, { opacity: 0, y: 26, scale: 0.94, duration: 1, stagger: 0.09 }, 1.1)
    .from(trustBits, { opacity: 0, y: 14, duration: 0.8, stagger: 0.07 }, 1.3)
    .call(() => el.querySelector('[data-hero-free]')?.classList.add('is-shine'), null, 1.75)
    .from(scrollCue, { opacity: 0, y: -12, duration: 0.9 }, 1.6);
  tl.eventCallback('onComplete', () => {
    gsap.set([...charsA, ...charsB, eyebrow, lead], { clearProps: 'filter' });
    el.dataset.intro = 'done';
    T.measure();
  });
  el.dataset.intro = 'ready';
  // La police d'affichage peut arriver après le découpage : on réaligne reflets et cristaux.
  document.fonts?.ready.then(() => { if (!disposed) { T.measure(); sparks.place(); } });

  const playIntro = () => {
    if (introPlayed || disposed) return;
    introPlayed = true;
    el.dataset.intro = 'playing';
    sparks.place();
    tl.play(0);
    if (scene) scene.intro(); // les glaçons tombent pendant que le titre gèle
    else if (!glSupported && cubesWrap) {
      // Repli CSS : les glaçons en verre tombent (on anime le conteneur, jamais l'élément preserve-3d).
      gsap.from(cubesWrap, { y: () => -(el.offsetHeight * 0.8), duration: 1.4, ease: 'bounce.out', delay: 0.15 });
    }
  };

  // Scène prête : affichée tout de suite si l'intro n'a pas commencé (ou est finie), sinon juste après.
  const sceneShown = buildScene().then((s) => {
    if (!s) return;
    const reveal = () => { showScene(s); if (introPlayed) scene?.intro(); };
    if (el.dataset.intro === 'playing') tl.then(reveal);
    else reveal();
  });

  // Déclencheur : fin du préchargeur (ou 2,5 s) ; sans préchargeur, on attend la scène au plus 1,2 s.
  const html = document.documentElement;
  const hasPreloader = html.classList.contains('preload') && !window.__lgPreloaderDone && !!document.querySelector('.preloader');
  let introTimer = 0;
  const onPre = () => playIntro();
  if (hasPreloader) {
    window.addEventListener('preloader:done', onPre, { once: true });
    introTimer = setTimeout(playIntro, 2500);
  } else {
    Promise.race([sceneShown, new Promise((r) => { introTimer = setTimeout(r, 1200); })]).then(playIntro);
  }

  /* ---------- Défilement : contenu qui s'éloigne, scène qui se dissout ---------- */
  const scrollTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: el, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true,
      // Mobile : les glaçons sont sous le texte, la dissolution commence plus tard.
      onUpdate: (self) => scene?.setScroll(wideMq.matches ? self.progress : Math.max(0, (self.progress - 0.3) / 0.7)),
    },
  });
  // (les opacités pilotées ici portent sur des conteneurs : les fondus CSS .is-webgl restent libres)
  const stage = el.querySelector('.hero__stage');
  // (mobile : les boutons restent pleinement lisibles pendant qu'on fait défiler)
  scrollTl.to(content, { yPercent: () => (wideMq.matches ? -10 : -3), opacity: () => (wideMq.matches ? 0.2 : 1), duration: 1 }, 0)
    .to(stage, { yPercent: () => (wideMq.matches ? 16 : 6), duration: 1 }, 0)
    .to(stage, { opacity: 0, scale: 1.04, duration: 0.45 }, 0.55)
    .to(zoneEl, { opacity: 0, duration: 0.45 }, 0.5)
    .to(scrollCue, { opacity: 0, duration: 0.2 }, 0);

  /* ---------- Taille / zone libre ---------- */
  function measureZone() {
    // Le canevas couvre toute la section (la scène est mesurée sans les transformations du défilement).
    const er = el.getBoundingClientRect();
    const zr = zoneEl.getBoundingClientRect();
    return {
      mode: wideMq.matches ? 'side' : 'band',
      x: zr.left - er.left, y: zr.top - er.top, w: Math.max(1, zr.width), h: Math.max(1, zr.height),
      W: el.clientWidth, H: el.clientHeight,
    };
  }
  let resizeRaf = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      if (el.dataset.intro === 'done') T.measure();
      sparks.place();
      if (!scene) return;
      const z = measureZone();
      scene.resize(z.W, z.H, z);
    });
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(el);

  /* ---------- Pointeur : parallaxe, survol et clic sur les glaçons ---------- */
  let lastMove = null;
  let moveRaf = 0;
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    const k = (canvas.clientWidth || r.width) / (r.width || 1); // compense l'échelle appliquée au défilement
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, r: { width: r.width * k, height: r.height * k } };
  };
  const onMove = (e) => {
    lastMove = e;
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      if (!scene || !lastMove) return;
      const { x, y, r } = local(lastMove);
      scene.setPointer((x / r.width) * 2 - 1, -((y / r.height) * 2 - 1), true);
      if (!finePointer) return;
      const interactive = lastMove.target.closest('a, button, input, .hero__content');
      const h = interactive ? null : scene.pick(x, y);
      scene.setHover(h ? h.index : -1);
      el.classList.toggle('is-over-cube', !!h);
    });
  };
  const onLeave = () => { scene?.setPointer(0, 0, false); scene?.setHover(-1); el.classList.remove('is-over-cube'); };
  let hits = 0;
  const onClick = (e) => {
    if (!scene || e.target.closest('a, button, input, label')) return;
    const { x, y } = local(e);
    const h = scene.pick(x, y);
    if (!h) return;
    scene.hit(h);
    hits += 1;
    if (hits === 1 && hint) gsap.to(hint, { opacity: 0, y: 8, duration: 0.6, onComplete: () => hint.setAttribute('hidden', '') });
  };
  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('click', onClick);

  /* ---------- Visibilité : aucune boucle hors écran ou onglet caché ---------- */
  const sync = () => {
    if (!scene) return;
    if (inView && !document.hidden) scene.start();
    else scene.stop();
  };
  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0 });
  io.observe(el);
  document.addEventListener('visibilitychange', sync);

  // Nettoyage (si la section est retirée du document).
  el._heroDispose = () => {
    disposed = true;
    clearTimeout(introTimer);
    window.removeEventListener('preloader:done', onPre);
    offContent();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', sync);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('click', onClick);
    scrollTl.scrollTrigger?.kill();
    scrollTl.kill();
    tl.kill();
    T.splits.forEach((s) => s.revert());
    scene?.dispose();
    scene = null;
  };
}
