/**
 * Hero de l'accueil (agent hero) — « La fraîcheur sous toutes ses formes ».
 * 1. Contenu relu depuis config.js (lien WhatsApp, engagements, livraison offerte + jauge du panier).
 * 2. Intro orchestrée : le titre « gèle » lettre par lettre (SplitText), puis accroche, CTA, confiance.
 *    Démarre à 'preloader:done' (ou seule après 2,5 s, tout de suite sans préchargeur).
 * 3. Scène WebGL (src/js/hero/scene.js) chargée en import() dynamique après le premier rendu :
 *    glaçons en verre qui tombent et se figent, mot « GLACEUR » réfracté, givre, éclats au clic.
 *    Repli : glaçons en verre CSS + mot géant CSS (sans WebGL, ou avant que la scène ne soit prête).
 * 4. Défilement : les glaçons s'écartent et la scène se dissout ; pause hors écran / onglet caché.
 * Tout le texte est du HTML visible sans JS ; mouvement réduit : rendu statique, aucune animation.
 */
import { gsap, ScrollTrigger, SplitText, reducedMotion, finePointer, isMobile } from '../core/motion.js';
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

/* ------------------------------------------------------------------ */
/* Déclencheur de l'intro                                              */
/* ------------------------------------------------------------------ */
function whenIntro(cb) {
  const html = document.documentElement;
  const hasPreloader = html.classList.contains('preload') && !window.__lgPreloaderDone && !!document.querySelector('.preloader');
  if (!hasPreloader) { cb(); return () => {}; }
  let done = false;
  const go = () => { if (done) return; done = true; window.removeEventListener('preloader:done', go); clearTimeout(timer); cb(); };
  window.addEventListener('preloader:done', go);
  const timer = setTimeout(go, 2500);
  return go;
}

const webglOk = () => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
};

/* ------------------------------------------------------------------ */
export default function init(el) {
  const title = el.querySelector('[data-hero-title]');
  const content = el.querySelector('[data-hero-content]');
  const canvas = el.querySelector('[data-hero-canvas]');
  const zoneEl = el.querySelector('[data-hero-zone]');
  const hint = el.querySelector('[data-hero-hint]');
  const anims = [...el.querySelectorAll('[data-hero-anim]')];
  const scrollCue = el.querySelector('[data-hero-scroll]');
  const cssCubes = [...el.querySelectorAll('.hero__cube')];
  const offContent = fillContent(el);

  const wideMq = window.matchMedia('(min-width: 900px)');
  let scene = null;
  let introPlayed = false;
  let inView = true;
  let disposed = false;

  if (hint) hint.textContent = finePointer ? 'Cliquez sur un glaçon' : 'Touchez un glaçon';

  /* ---------- Mouvement réduit : tout est visible, scène figée (rendue une fois) ---------- */
  if (reducedMotion) {
    el.dataset.intro = 'done';
    const z = () => measureZone();
    let s0 = null;
    const ro0 = new ResizeObserver(() => { if (s0) { const m = z(); s0.resize(m.W, m.H, m); } });
    ro0.observe(el);
    loadScene((s) => { s0 = s; });
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

  const playIntro = () => {
    if (introPlayed || disposed) return;
    introPlayed = true;
    el.dataset.intro = 'playing';
    sparks.place();
    tl.play(0);
    if (scene) scene.intro();
    else if (cssCubes.length) {
      // La scène n'est pas encore là : les glaçons CSS tombent à sa place.
      gsap.from(cssCubes, { yPercent: -260, opacity: 0, rotate: () => gsap.utils.random(-40, 40), duration: 1.3, stagger: 0.12, ease: 'bounce.out', delay: 0.1 });
    }
  };
  const forceIntro = whenIntro(playIntro);

  /* ---------- Défilement : contenu qui s'éloigne, scène qui se dissout ---------- */
  const scrollTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: el, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (self) => scene?.setScroll(self.progress),
    },
  });
  // (les opacités pilotées ici portent sur des conteneurs : les fondus CSS .is-webgl restent libres)
  const stage = el.querySelector('.hero__stage');
  scrollTl.to(content, { yPercent: -10, opacity: 0.2, duration: 1 }, 0)
    .to(stage, { yPercent: 16, duration: 1 }, 0)
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

  /* ---------- Chargement de la scène après le premier rendu ---------- */
  loadScene();

  function loadScene(onReady) {
    if (!canvas || !zoneEl || !webglOk()) { el.classList.add('is-static'); return; }
    const kick = () => {
      import('../hero/scene.js')
        .then(async ({ createIceScene }) => {
          if (disposed) return;
          const s = await createIceScene({
            canvas, mobile: isMobile, reduced: reducedMotion,
            onLost: () => { el.classList.remove('is-webgl'); el.classList.add('is-static'); scene = null; },
          });
          if (disposed) { s.dispose(); return; }
          const z = measureZone();
          s.resize(z.W, z.H, z);
          await s.warm();
          if (disposed) { s.dispose(); return; }
          s.renderOnce();
          scene = s;
          el.classList.add('is-webgl');
          if (reducedMotion) { onReady?.(s); return; }
          if (hint && !isMobile) gsap.delayedCall(introPlayed ? 2.4 : 4, () => hint.classList.add('is-on'));
          else if (hint) gsap.delayedCall(4, () => hint.classList.add('is-on'));
          if (introPlayed) scene.intro();
          sync();
        })
        .catch((err) => {
          console.warn('[hero] scène 3D indisponible, rendu statique.', err);
          el.classList.add('is-static');
        });
    };
    // Après le premier rendu (le texte s'affiche d'abord), sans gêner le préchargeur.
    requestAnimationFrame(() => setTimeout(kick, 30));
  }

  // Nettoyage (si la section est retirée du document).
  el._heroDispose = () => {
    disposed = true;
    forceIntro?.();
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
  ScrollTrigger.refresh();
}
