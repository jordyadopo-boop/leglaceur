import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { BRAND, GlaceurLogo, GlaceurMark } from '../_fixtures/Brand';
import { EASE, FONT, ramp } from '../_fixtures/Polish';
import targets from '../../public/tuto/targets.json';

// Tutoriel 16:9 « Comment commander sur leglaceur.ci », monté à partir des captures
// Playwright du vrai site (public/tuto, coordonnées des zones cliquées dans targets.json).

export const TW = 1920;
export const TH = 1080;
const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);

type Shot = keyof typeof targets;
type Pt = { x: number; y: number };
const T = targets as unknown as Record<Shot, Record<string, Pt>>;
const at = (shot: Shot, k: string): Pt => T[shot][k];

type Cam = { t: number; x: number; y: number; z: number };
type Click = { t: number; shot: Shot; k: string; sfx?: string };
type Scene = {
  dur: number;
  imgs: { at: number; shot: Shot }[];
  cam: Cam[];
  clicks: Click[];
  captions: { t: number; text: string }[];
  step?: number; // première scène d'une étape : carte « Étape n » au début
};

const STEPS = ['Choisissez vos glaces', 'Livraison ou retrait', 'Vos coordonnées', 'Envoyez votre devis'];
const CARD = 1.4; // durée (s) de la carte d'étape en début de scène

const W = { x: 960, y: 540, z: 1 };
const SCENES: Scene[] = [
  {
    step: 1, dur: 6, imgs: [{ at: 0, shot: '01-accueil' }],
    cam: [{ t: 0, ...W }, { t: CARD + 0.6, ...W }, { t: CARD + 2.2, x: 620, y: 600, z: 1.35 }],
    clicks: [{ t: CARD + 3.2, shot: '01-accueil', k: 'cta' }],
    captions: [{ t: CARD, text: 'Rendez-vous sur leglaceur.ci' }, { t: CARD + 2.4, text: 'Cliquez sur « Composer ma commande »' }],
  },
  {
    dur: 5.2, imgs: [{ at: 0, shot: '02-commande' }, { at: 3.4, shot: '03-quantite1' }],
    cam: [{ t: 0, x: 860, y: 420, z: 1.15 }, { t: 1.4, x: 880, y: 300, z: 1.55 }, { t: 3.4, x: 880, y: 330, z: 1.55 }, { t: 4.6, x: 900, y: 480, z: 1.3 }],
    clicks: [1.6, 2.1, 2.6, 3.1].map((t) => ({ t, shot: '02-commande' as Shot, k: 'plus1' })),
    captions: [{ t: 0.2, text: 'Ajoutez vos quantités avec le bouton +' }],
  },
  {
    dur: 3.4, imgs: [{ at: 0, shot: '03-quantite1' }, { at: 2, shot: '03b-quantite1b' }],
    cam: [{ t: 0, x: 900, y: 480, z: 1.3 }, { t: 1, x: 900, y: 620, z: 1.5 }],
    clicks: [{ t: 1.3, shot: '03-quantite1', k: 'plus3' }, { t: 1.8, shot: '03-quantite1', k: 'plus3' }],
    captions: [{ t: 0, text: 'Mélangez les produits : cubique, pilée, carboglace…' }],
  },
  {
    dur: 5, imgs: [{ at: 0, shot: '04-quantite2' }],
    cam: [{ t: 0, x: 960, y: 540, z: 1.1 }, { t: 1, x: 1340, y: 560, z: 1.55 }, { t: 3.6, x: 1340, y: 640, z: 1.5 }],
    clicks: [{ t: 3.4, shot: '04-quantite2', k: 'gen', sfx: 'ui-confirm-tone' }],
    captions: [{ t: 0.2, text: 'Le total se calcule en direct' }, { t: 2.2, text: 'Puis cliquez sur « Générer mon devis »' }],
  },
  {
    step: 2, dur: 6.4, imgs: [{ at: 0, shot: '05-mode' }, { at: CARD + 4.2, shot: '06-livraison' }],
    cam: [{ t: 0, ...W }, { t: CARD + 0.4, ...W }, { t: CARD + 1.4, x: 740, y: 400, z: 1.45 }, { t: CARD + 3, x: 740, y: 520, z: 1.45 }],
    clicks: [{ t: CARD + 1.5, shot: '05-mode', k: 'liv' }, { t: CARD + 3.4, shot: '05-mode', k: 'commune' }],
    captions: [{ t: CARD, text: 'Livraison partout à Abidjan, ou retrait gratuit à Abatta' }, { t: CARD + 2.8, text: 'Choisissez votre commune et votre adresse' }],
  },
  {
    dur: 3.6, imgs: [{ at: 0, shot: '06-livraison' }],
    cam: [{ t: 0, x: 740, y: 520, z: 1.45 }, { t: 1, x: 760, y: 600, z: 1.5 }],
    clicks: [{ t: 1.6, shot: '06-livraison', k: 'matin' }],
    captions: [{ t: 0, text: 'Indiquez la date et le créneau souhaités' }],
  },
  {
    step: 3, dur: 5.4, imgs: [{ at: 0, shot: '07-coordonnees' }, { at: CARD + 2.2, shot: '08-coordonnees-ok' }],
    cam: [{ t: 0, ...W }, { t: CARD + 0.4, ...W }, { t: CARD + 1.4, x: 740, y: 400, z: 1.5 }],
    clicks: [{ t: CARD + 1.6, shot: '07-coordonnees', k: 'name' }, { t: CARD + 3.2, shot: '07-coordonnees', k: 'phone' }],
    captions: [{ t: CARD, text: 'Saisissez votre nom et votre numéro WhatsApp' }],
  },
  {
    dur: 3.6, imgs: [{ at: 0, shot: '08-coordonnees-ok' }],
    cam: [{ t: 0, x: 740, y: 400, z: 1.5 }, { t: 1.2, x: 760, y: 720, z: 1.4 }],
    clicks: [{ t: 2, shot: '08-coordonnees-ok', k: 'submit', sfx: 'ui-confirm-tone' }],
    captions: [{ t: 0.4, text: 'Cliquez sur « Vérifier et envoyer mon devis »' }],
  },
  {
    step: 4, dur: 9, imgs: [{ at: 0, shot: '09-recap' }],
    cam: [{ t: 0, ...W }, { t: CARD + 0.4, ...W }, { t: CARD + 1.6, x: 1390, y: 520, z: 1.45 }, { t: CARD + 3, x: 1390, y: 760, z: 1.6 }, { t: CARD + 5.6, x: 1390, y: 700, z: 1.75 }],
    clicks: [{ t: CARD + 3.4, shot: '09-recap', k: 'pdf' }, { t: CARD + 5.6, shot: '09-recap', k: 'wa', sfx: 'ui-success-soft' }],
    captions: [
      { t: CARD, text: 'Votre devis récapitulatif est prêt' },
      { t: CARD + 2.4, text: 'Téléchargez-le en PDF ou Excel' },
      { t: CARD + 4.6, text: 'Et envoyez-le sur WhatsApp en un clic !' },
    ],
  },
];

const INTRO = s(4);
const OUTRO = s(6.5);
const XF = 10; // fondu entre scènes (images)
const starts: number[] = [];
let acc = INTRO;
for (const sc of SCENES) { starts.push(acc); acc += s(sc.dur); }
export const TUTO_TOTAL = acc + OUTRO;

// ───────────────────── caméra : zoom doux, cadre toujours couvert ─────────────────────
const camAt = (keys: Cam[], sec: number) => {
  let a = keys[0], b = keys[0];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].t <= sec) { a = keys[i]; b = keys[i + 1] ?? keys[i]; }
  }
  const p = b === a ? 0 : EASE.smooth(Math.min(1, Math.max(0, (sec - a.t) / (b.t - a.t))));
  const z = a.z + (b.z - a.z) * p;
  const clampC = (c: number, size: number) => Math.min(size - size / (2 * z), Math.max(size / (2 * z), c));
  return { z, x: clampC(a.x + (b.x - a.x) * p, TW), y: clampC(a.y + (b.y - a.y) * p, TH) };
};
const toScreen = (cam: { x: number; y: number; z: number }, p: Pt) => ({ x: (p.x - cam.x) * cam.z + TW / 2, y: (p.y - cam.y) * cam.z + TH / 2 });

// ───────────────────── curseur ─────────────────────
const Cursor: React.FC<{ x: number; y: number; press: number }> = ({ x, y, press }) => (
  <svg width={56} height={56} viewBox="0 0 28 28" style={{ position: 'absolute', left: x - 6, top: y - 3, transform: `scale(${1 - 0.18 * press})`, transformOrigin: '6px 3px', filter: 'drop-shadow(0 4px 8px rgba(4,14,36,0.45))' }}>
    <path d="M3 1.5 L3 21 L8.2 16.4 L11.6 24.5 L15 23 L11.7 15.2 L18.5 15 Z" fill="#fff" stroke={BRAND.deep} strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

const Ripple: React.FC<{ x: number; y: number; t: number }> = ({ x, y, t }) => {
  if (t < 0 || t > 1) return null;
  const r = 14 + 70 * EASE.out(t);
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `5px solid ${BRAND.blue}`, background: 'rgba(47,140,242,0.18)', opacity: 1 - t }} />;
};

// ───────────────────── habillage ─────────────────────
const Caption: React.FC<{ text: string; local: number; end: number }> = ({ text, local, end }) => {
  const inn = ramp(local, 0, 10);
  const out = 1 - ramp(local, end - 8, 8, EASE.exit);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 64, display: 'flex', justifyContent: 'center', opacity: Math.min(inn, out), transform: `translateY(${(1 - inn) * 24}px)` }}>
      <div style={{ maxWidth: 1500, padding: '20px 40px', borderRadius: 22, background: 'rgba(4,14,36,0.86)', color: BRAND.paper, fontFamily: FONT.sans, fontWeight: 600, fontSize: 48, lineHeight: 1.2, textAlign: 'center', boxShadow: '0 18px 50px rgba(4,14,36,0.35)', border: '1px solid rgba(142,207,255,0.25)' }}>
        {text}
      </div>
    </div>
  );
};

const StepChip: React.FC<{ n: number; local: number }> = ({ n, local }) => {
  // grande carte centrée, puis rétrécie en pastille en haut à gauche
  const p = ramp(local, s(CARD) - 14, 18, EASE.smooth);
  const inn = ramp(local, 0, 14, EASE.overshoot);
  const scale = (1 - p) * (0.6 + 0.4 * inn) + p * 0.42;
  const x = (1 - p) * TW / 2 + p * 70;
  const y = (1 - p) * TH / 2 + p * 60;
  const dim = (1 - p) * Math.min(1, local / 8) * 0.55;
  return (
    <>
      <AbsoluteFill style={{ background: `rgba(4,14,36,${dim})` }} />
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${-50 * (1 - p)}%, ${-50 * (1 - p)}%) scale(${scale})`, transformOrigin: p > 0.5 ? '0 0' : 'center', opacity: Math.min(1, local / 6) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, padding: '34px 56px 34px 34px', borderRadius: 40, background: `linear-gradient(135deg, ${BRAND.blue}, ${BRAND.night})`, boxShadow: '0 30px 80px rgba(4,14,36,0.45)', whiteSpace: 'nowrap' }}>
          <div style={{ width: 150, height: 150, borderRadius: 32, background: BRAND.paper, color: BRAND.night, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.display, fontWeight: 800, fontSize: 120 }}>{n}</div>
          <div>
            <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 46, letterSpacing: '0.18em', color: BRAND.ice2 }}>ÉTAPE {n}/{STEPS.length}</div>
            <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 104, lineHeight: 1, color: '#fff', textTransform: 'uppercase' }}>{STEPS[n - 1]}</div>
          </div>
        </div>
      </div>
    </>
  );
};

const SceneView: React.FC<{ sc: Scene; dur: number }> = ({ sc, dur }) => {
  const f = useCurrentFrame();
  const sec = f / FPS;
  const cam = camAt(sc.cam, sec);
  // curseur : glisse vers chaque cible, appuie au moment du clic
  const pts = sc.clicks.map((c) => ({ ...c, p: toScreen(cam, at(c.shot, c.k)) }));
  let cur = { x: TW * 0.62, y: TH * 0.9 };
  let press = 0;
  if (pts.length) {
    const startT = Math.max(0, pts[0].t - 1.1);
    cur = sec < startT ? { x: pts[0].p.x + 260, y: pts[0].p.y + 220 } : cur;
    for (let i = 0; i < pts.length; i++) {
      const from = i === 0 ? { x: pts[0].p.x + 260, y: pts[0].p.y + 220 } : pts[i - 1].p;
      const t0 = i === 0 ? startT : pts[i - 1].t + 0.15;
      const t1 = pts[i].t - 0.12;
      if (sec >= t0) {
        const k = EASE.swift(Math.min(1, Math.max(0, (sec - t0) / Math.max(0.1, t1 - t0))));
        cur = { x: from.x + (pts[i].p.x - from.x) * k, y: from.y + (pts[i].p.y - from.y) * k };
      }
      const d = sec - pts[i].t;
      if (d > -0.08 && d < 0.14) press = Math.max(press, 1 - Math.abs(d - 0.03) / 0.11);
    }
  }
  const cursorIn = pts.length ? interpolate(sec, [Math.max(0, pts[0].t - 1.4), Math.max(0.01, pts[0].t - 1.1)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const capEnds = sc.captions.map((c, i) => (sc.captions[i + 1]?.t ?? sc.dur) - c.t);
  return (
    <AbsoluteFill style={{ background: BRAND.paper }}>
      <AbsoluteFill style={{ transform: `scale(${cam.z}) translate(${TW / 2 - cam.x}px, ${TH / 2 - cam.y}px)`, transformOrigin: `${TW / 2}px ${TH / 2}px` }}>
        {sc.imgs.map((im, i) => {
          const op = i === 0 ? 1 : interpolate(f, [s(im.at), s(im.at) + XF], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return <Img key={im.shot} src={staticFile(`tuto/${im.shot}.jpg`)} style={{ position: 'absolute', inset: 0, width: TW, height: TH, opacity: op }} />;
        })}
      </AbsoluteFill>
      {pts.map((c, i) => <Ripple key={i} x={c.p.x} y={c.p.y} t={(sec - c.t) / 0.5} />)}
      {pts.length > 0 && <div style={{ opacity: cursorIn }}><Cursor x={cur.x} y={cur.y} press={press} /></div>}
      {sc.captions.map((c, i) => (
        <Sequence key={i} from={s(c.t)} durationInFrames={s(capEnds[i])} layout="none">
          <CaptionAt text={c.text} end={s(capEnds[i])} />
        </Sequence>
      ))}
      {sc.clicks.map((c, i) => (
        <Sequence key={`a${i}`} from={Math.max(0, s(c.t) - 1)} durationInFrames={s(1.5)} layout="none">
          <Audio src={staticFile(`audio/sfx/${c.sfx ?? 'switch-tap'}.mp3`)} volume={c.sfx ? 0.45 : 0.55} />
        </Sequence>
      ))}
      {/* léger fondu d'entrée/sortie de scène */}
      <AbsoluteFill style={{ background: BRAND.paper, opacity: interpolate(f, [0, 6, dur - 6, dur], [0.7, 0, 0, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

const CaptionAt: React.FC<{ text: string; end: number }> = ({ text, end }) => {
  const f = useCurrentFrame();
  return <Caption text={text} local={f} end={end} />;
};

const Chip: React.FC<{ n: number }> = ({ n }) => <StepChip n={n} local={useCurrentFrame()} />;

const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 30% 20%, ${BRAND.blue} 0%, ${BRAND.night} 55%, ${BRAND.deep} 100%)` }} />
);

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const a = ramp(f, 4, 22, EASE.overshoot);
  const b = ramp(f, 22, 18);
  const c = ramp(f, 34, 18);
  const out = 1 - ramp(f, INTRO - 10, 10, EASE.exit);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 48 }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * a})`, opacity: Math.min(1, a * 1.5) }}><GlaceurLogo width={760} /></div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 96, color: '#fff', textTransform: 'uppercase', opacity: b, transform: `translateY(${(1 - b) * 30}px)`, textAlign: 'center', lineHeight: 1.05 }}>
          Comment commander en ligne
        </div>
        <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 46, color: BRAND.ice2, opacity: c, transform: `translateY(${(1 - c) * 20}px)` }}>
          Votre devis glace en 4 étapes sur {BRAND.site}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const a = ramp(f, 0, 20, EASE.overshoot);
  const b = ramp(f, 14, 18);
  const c = ramp(f, 26, 18);
  const d = ramp(f, 40, 18);
  const out = 1 - ramp(f, OUTRO - 14, 14, EASE.exit);
  const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 22, padding: '22px 44px', borderRadius: 999, fontFamily: FONT.display, fontWeight: 800, fontSize: 64, color: '#fff' };
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 44 }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * a})`, opacity: Math.min(1, a * 1.5) }}><GlaceurMark size={170} /></div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 104, color: '#fff', textTransform: 'uppercase', opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>Commandez maintenant</div>
        <div style={{ display: 'flex', gap: 36, opacity: c, transform: `translateY(${(1 - c) * 24}px)` }}>
          <div style={{ ...pill, background: BRAND.blue }}>{BRAND.site}</div>
          <div style={{ ...pill, background: '#1f9d55' }}>
            <svg width={60} height={60} viewBox="0 0 24 24"><path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
            {BRAND.whatsapp}
          </div>
        </div>
        <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 42, color: BRAND.ice2, opacity: d }}>
          24h/24 · 7j/7 · Livraison offerte dès 20 articles · Aucun paiement en ligne
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Tutoriel: React.FC = () => {
  const f = useCurrentFrame();
  const musicVol = 0.14 * interpolate(f, [0, 20, TUTO_TOTAL - 45, TUTO_TOTAL], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: BRAND.deep }}>
      <Audio src={staticFile('audio/house-vibez.mp3')} startFrom={s(30)} volume={musicVol} />
      <Sequence durationInFrames={INTRO}><Intro /></Sequence>
      <Sequence from={0} durationInFrames={s(2)}><Audio src={staticFile('audio/sfx/light-sweep-magic.mp3')} volume={0.35} /></Sequence>
      {SCENES.map((sc, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={s(sc.dur)}>
          <SceneView sc={sc} dur={s(sc.dur)} />
        </Sequence>
      ))}
      {/* pastille d'étape : persiste jusqu'à la scène d'étape suivante */}
      {SCENES.map((sc, i) => {
        if (!sc.step) return null;
        const next = SCENES.findIndex((x, j) => j > i && x.step);
        const end = next < 0 ? TUTO_TOTAL - OUTRO : starts[next];
        return (
          <Sequence key={`st${i}`} from={starts[i]} durationInFrames={end - starts[i]}>
            <Chip n={sc.step} />
            <Audio src={staticFile('audio/sfx/transition-tech-slide.mp3')} volume={0.3} />
          </Sequence>
        );
      })}
      <Sequence from={TUTO_TOTAL - OUTRO} durationInFrames={OUTRO}>
        <Outro />
        <Audio src={staticFile('audio/sfx/ui-success-soft.mp3')} volume={0.35} />
      </Sequence>
    </AbsoluteFill>
  );
};
