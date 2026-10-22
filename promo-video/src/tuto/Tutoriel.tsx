import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND, GlaceurLogo, GlaceurMark } from '../_fixtures/Brand';
import { Dust, LOOKS, Sheen, Stage, TextReveal } from '../_fixtures/Look';
import { EASE, FONT, mix, ramp } from '../_fixtures/Polish';
import { BEAT_INT, SOURCE_BEAT0 } from '../beat';
import targets from '../../public/tuto/targets.json';

// Tutoriel motion design « Comment commander sur leglaceur.ci » (60 s), en 16:9 et 9:16.
// Captures Playwright du vrai site (public/tuto) posées dans un navigateur 3D lumineux,
// caméra qui pousse sur chaque zone cliquée, curseur + onde de clic, pastilles d'info, HUD de progression.

export const TW = 1920;
export const TH = 1080;
const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);
const look = LOOKS.glaceur;

type Shot = keyof typeof targets;
type Pt = { x: number; y: number };
const T = targets as unknown as Record<Shot, Record<string, Pt>>;
const at = (shot: Shot, k: string): Pt => T[shot][k];

type Cam = { t: number; x: number; y: number; z: number };
type Click = { t: number; shot: Shot; k: string; sfx?: string };
type Act = {
  n: number; title: string; dur: number;
  imgs: { at: number; shot: Shot }[];
  cam: Cam[];
  clicks: Click[];
  pills: { t: number; label: string; value: string }[];
  captions: { t: number; text: string }[];
};

const CARD = 1.5; // carte « Étape » plein écran en début d'acte
const W = { x: 960, y: 540, z: 1 };
const ACTS: Act[] = [
  {
    n: 1, title: 'Choisissez vos glaces', dur: 12.5,
    imgs: [{ at: 0, shot: '01-accueil' }, { at: 4.4, shot: '02-commande' }, { at: 6.9, shot: '03-quantite1' }, { at: 8.1, shot: '03b-quantite1b' }, { at: 9.2, shot: '04-quantite2' }],
    cam: [{ t: 0, ...W }, { t: 2.1, ...W }, { t: 3.1, x: 560, y: 690, z: 1.7 }, { t: 4.3, x: 600, y: 650, z: 1.9 }, { t: 4.4, x: 900, y: 420, z: 1.25 }, { t: 5.2, x: 960, y: 330, z: 1.75 }, { t: 6.9, x: 960, y: 420, z: 1.6 }, { t: 7.4, x: 960, y: 560, z: 1.7 }, { t: 9.1, x: 960, y: 560, z: 1.7 }, { t: 9.2, x: 1100, y: 600, z: 1.2 }, { t: 10.4, x: 1300, y: 740, z: 1.9 }],
    clicks: [
      { t: 3.7, shot: '01-accueil', k: 'cta' },
      ...[5.6, 6.0, 6.4, 6.8].map((t) => ({ t, shot: '02-commande' as Shot, k: 'plus1' })),
      { t: 7.7, shot: '03-quantite1', k: 'plus3' }, { t: 8.1, shot: '03-quantite1', k: 'plus3' },
      { t: 11.1, shot: '04-quantite2', k: 'gen', sfx: 'ui-confirm-tone' },
    ],
    pills: [{ t: 5.7, label: 'Glace cubique ×4', value: '3 000 F' }, { t: 7.8, label: 'Glace pilée ×2', value: '6 000 F' }, { t: 9.6, label: 'Total en direct', value: '9 000 F CFA' }],
    captions: [{ t: 1.7, text: 'Ouvrez leglaceur.ci' }, { t: 2.9, text: 'Cliquez sur « Composer ma commande »' }, { t: 4.8, text: 'Ajoutez vos glaces avec le bouton +' }, { t: 9.4, text: 'Puis « Générer mon devis »' }],
  },
  {
    n: 2, title: 'Livraison ou retrait', dur: 9,
    imgs: [{ at: 0, shot: '05-mode' }, { at: 5.6, shot: '06-livraison' }],
    cam: [{ t: 0, ...W }, { t: 1.9, ...W }, { t: 2.7, x: 700, y: 400, z: 1.75 }, { t: 4.0, x: 680, y: 500, z: 1.75 }, { t: 5.6, x: 760, y: 560, z: 1.55 }, { t: 6.5, x: 820, y: 630, z: 1.9 }],
    clicks: [{ t: 3.1, shot: '05-mode', k: 'liv' }, { t: 4.7, shot: '05-mode', k: 'commune' }, { t: 7.2, shot: '06-livraison', k: 'matin' }],
    pills: [{ t: 3.2, label: 'Livraison', value: 'partout à Abidjan' }, { t: 4.9, label: 'Commune', value: 'Cocody' }, { t: 7.3, label: 'Créneau', value: 'Matin' }],
    captions: [{ t: 1.7, text: 'Livraison ou retrait gratuit à Abatta' }, { t: 4.4, text: 'Commune, adresse, date et créneau' }],
  },
  {
    n: 3, title: 'Vos coordonnées', dur: 8,
    imgs: [{ at: 0, shot: '07-coordonnees' }, { at: 4.4, shot: '08-coordonnees-ok' }],
    cam: [{ t: 0, ...W }, { t: 1.9, ...W }, { t: 2.6, x: 730, y: 380, z: 1.8 }, { t: 4.6, x: 730, y: 400, z: 1.8 }, { t: 5.4, x: 640, y: 640, z: 1.35 }, { t: 6.2, x: 560, y: 820, z: 1.9 }],
    clicks: [{ t: 2.9, shot: '07-coordonnees', k: 'name' }, { t: 4.0, shot: '07-coordonnees', k: 'phone' }, { t: 6.7, shot: '08-coordonnees-ok', k: 'submit', sfx: 'ui-confirm-tone' }],
    pills: [{ t: 3.0, label: 'Nom', value: 'Awa Koné' }, { t: 4.1, label: 'WhatsApp', value: '07 00 00 00 00' }, { t: 6.8, label: 'Devis', value: 'généré ✓' }],
    captions: [{ t: 1.7, text: 'Votre nom et votre numéro WhatsApp' }, { t: 5.2, text: '« Vérifier et envoyer mon devis »' }],
  },
  {
    n: 4, title: 'Envoyez votre devis', dur: 11,
    imgs: [{ at: 0, shot: '09-recap' }],
    cam: [{ t: 0, ...W }, { t: 1.9, ...W }, { t: 2.8, x: 1340, y: 760, z: 1.8 }, { t: 5.2, x: 1390, y: 780, z: 1.85 }, { t: 6.2, x: 1390, y: 740, z: 2.0 }],
    clicks: [{ t: 3.3, shot: '09-recap', k: 'pdf', sfx: 'camera-lens-shutter' }, { t: 4.5, shot: '09-recap', k: 'xls', sfx: 'camera-lens-shutter' }, { t: 6.6, shot: '09-recap', k: 'wa', sfx: 'ui-success-soft' }],
    pills: [{ t: 2.2, label: 'Votre devis', value: '9 000 F CFA' }],
    captions: [{ t: 1.7, text: 'Votre devis est prêt' }, { t: 3.0, text: 'Téléchargez-le en PDF ou Excel' }, { t: 6.2, text: 'Envoyez-le sur WhatsApp en un clic' }, { t: 8.6, text: 'Nous confirmons et livrons' }],
  },
];

const INTRO = s(5.5);
const OVERVIEW = s(4);
const OUTRO = s(10);
const actStart: number[] = [];
let acc = INTRO + OVERVIEW;
for (const a of ACTS) { actStart.push(acc); acc += s(a.dur); }
const OUTRO_AT = acc;
export const TUTO_TOTAL = acc + OUTRO;

// ───────────────────── mise en page selon le format ─────────────────────
const useLayout = () => {
  const { width, height } = useVideoConfig();
  const v = height > width;
  return {
    v, width, height,
    frame: v ? { cx: 540, cy: 880, w: 980, h: 1160 } : { cx: 960, cy: 560, w: 1400, h: 800 },
    k: v ? 1.04 : 1, // échelle typographique
  };
};

const glass = (r = 26): React.CSSProperties => ({
  background: 'linear-gradient(135deg, rgba(20,52,102,0.78), rgba(4,14,36,0.82))',
  border: '1.5px solid rgba(142,207,255,0.35)', borderRadius: r,
  boxShadow: '0 0 40px rgba(47,140,242,0.25), 0 24px 60px rgba(1,5,15,0.55), inset 0 1px 0 rgba(198,232,255,0.25)',
});
const glowText = (c: string = BRAND.blue, k = 1) => `0 0 ${18 * k}px ${c}, 0 0 ${48 * k}px rgba(47,140,242,0.6)`;

// ───────────────────── caméra dans la page ─────────────────────
const kf = (keys: Cam[], sec: number) => {
  let a = keys[0], b = keys[0];
  for (let i = 0; i < keys.length; i++) if (keys[i].t <= sec) { a = keys[i]; b = keys[i + 1] ?? keys[i]; }
  const p = b === a ? 0 : EASE.smooth(Math.min(1, Math.max(0, (sec - a.t) / (b.t - a.t))));
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), z: mix(a.z, b.z, p) };
};
const view = (c: { x: number; y: number; z: number }, cw: number, ch: number) => {
  const sc = Math.max(cw / TW, ch / TH) * c.z;
  const hw = cw / (2 * sc), hh = ch / (2 * sc);
  const x = Math.min(TW - hw, Math.max(hw, c.x)), y = Math.min(TH - hh, Math.max(hh, c.y));
  return { sc, x, y, map: (p: Pt) => ({ x: cw / 2 + (p.x - x) * sc, y: ch / 2 + (p.y - y) * sc }) };
};

// ───────────────────── éléments ─────────────────────
const Cursor: React.FC<{ x: number; y: number; press: number; o: number }> = ({ x, y, press, o }) => (
  <svg width={60} height={60} viewBox="0 0 28 28" style={{ position: 'absolute', left: x - 6, top: y - 3, opacity: o, transform: `scale(${1 - 0.2 * press})`, transformOrigin: '6px 3px', filter: 'drop-shadow(0 0 10px rgba(142,207,255,0.9)) drop-shadow(0 6px 10px rgba(4,14,36,0.6))' }}>
    <path d="M3 1.5 L3 21 L8.2 16.4 L11.6 24.5 L15 23 L11.7 15.2 L18.5 15 Z" fill="#fff" stroke={BRAND.deep} strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

const Burst: React.FC<{ x: number; y: number; t: number }> = ({ x, y, t }) => {
  if (t < 0 || t > 1) return null;
  const r1 = 10 + 90 * EASE.out(t), r2 = 6 + 150 * EASE.out(Math.max(0, t - 0.12) / 0.88);
  return (
    <>
      <div style={{ position: 'absolute', left: x - 70, top: y - 70, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(198,232,255,0.9), rgba(47,140,242,0) 65%)', opacity: (1 - t) * 0.9, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', left: x - r1, top: y - r1, width: r1 * 2, height: r1 * 2, borderRadius: '50%', border: `4px solid ${BRAND.ice}`, boxShadow: `0 0 24px ${BRAND.blue}`, opacity: 1 - t }} />
      <div style={{ position: 'absolute', left: x - r2, top: y - r2, width: r2 * 2, height: r2 * 2, borderRadius: '50%', border: `2px solid ${BRAND.ice2}`, opacity: (1 - t) * 0.6 }} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3, d = 30 + 80 * EASE.out(t);
        return <div key={i} style={{ position: 'absolute', left: x + Math.cos(a) * d - 4, top: y + Math.sin(a) * d - 4, width: 8, height: 8, borderRadius: 4, background: BRAND.ice2, boxShadow: `0 0 12px ${BRAND.blue}`, opacity: 1 - t }} />;
      })}
    </>
  );
};

const Flash: React.FC<{ at: number; dur?: number; max?: number }> = ({ at: a, dur = 10, max = 0.8 }) => {
  const f = useCurrentFrame();
  const t = (f - a) / dur;
  if (t < 0 || t > 1) return null;
  return <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, #ffffff, #8ecfff 60%, #2f8cf2)', opacity: max * (1 - EASE.out(t)), mixBlendMode: 'screen' }} />;
};

const Streak: React.FC<{ p: number; y: number }> = ({ p, y }) => {
  const { width } = useLayout();
  if (p <= 0 || p >= 1) return null;
  return <div style={{ position: 'absolute', top: y, left: mix(-width, width, EASE.smooth(p)), width, height: 3, background: `linear-gradient(90deg, transparent, ${BRAND.ice2}, #fff, transparent)`, boxShadow: `0 0 30px 6px ${BRAND.blue}`, opacity: Math.sin(p * Math.PI) }} />;
};

const BrowserChrome: React.FC<{ w: number }> = ({ w }) => (
  <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', background: 'linear-gradient(180deg, #143466, #0d2550)', borderBottom: '1px solid rgba(142,207,255,0.25)' }}>
    {['#ff6b6b', '#ffc24b', '#4cd28a'].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, opacity: 0.85 }} />)}
    <div style={{ marginLeft: 18, flex: 1, maxWidth: w * 0.55, height: 28, borderRadius: 14, background: 'rgba(4,14,36,0.6)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', color: BRAND.ice2, fontFamily: FONT.sans, fontWeight: 600, fontSize: 17 }}>
      <span style={{ fontSize: 13 }}>🔒</span> leglaceur.ci
    </div>
  </div>
);

// Navigateur 3D lumineux : la page vit dedans, la caméra pousse sur les zones cliquées
const Browser: React.FC<{
  w: number; h: number; imgs: { at: number; shot: Shot }[]; cam: Cam[]; clicks: Click[]; sec: number; sheen?: number;
}> = ({ w, h, imgs, cam, clicks, sec, sheen = 0 }) => {
  const ch = h - 46;
  // petit « punch » de caméra à chaque clic
  let punch = 0;
  for (const c of clicks) { const d = sec - c.t; if (d >= 0 && d < 0.5) punch += 0.035 * Math.exp(-d * 8); }
  const c0 = kf(cam, sec);
  const vw = view({ ...c0, z: c0.z * (1 + punch) }, w, ch);
  // image courante + précédente (fondu 0.2 s)
  let cur = 0;
  imgs.forEach((im, i) => { if (im.at <= sec) cur = i; });
  const fade = Math.min(1, (sec - imgs[cur].at) / 0.2);
  // curseur : glisse d'une cible à l'autre, appuie au clic
  const pts = clicks.map((c) => ({ t: c.t, p: vw.map(at(c.shot, c.k)) }));
  let cx = w * 0.75, cy = ch * 0.95, press = 0, co = 0;
  if (pts.length) {
    const first = pts[0];
    const appear = first.t - 1.1;
    co = Math.min(1, Math.max(0, (sec - appear) / 0.3));
    if (sec <= first.t - 0.15) {
      const p = EASE.swift(Math.min(1, Math.max(0, (sec - appear) / 0.95)));
      cx = mix(first.p.x + 260, first.p.x, p); cy = mix(first.p.y + 220, first.p.y, p);
    } else {
      let i = 0;
      while (i + 1 < pts.length && sec > pts[i + 1].t - 0.15) i++;
      const a = pts[i], b = pts[i + 1];
      if (!b || sec <= a.t + 0.12) { cx = a.p.x; cy = a.p.y; } else {
        const p = EASE.smooth(Math.min(1, Math.max(0, (sec - a.t - 0.12) / (b.t - 0.15 - a.t - 0.12))));
        cx = mix(a.p.x, b.p.x, p); cy = mix(a.p.y, b.p.y, p);
      }
    }
    for (const q of pts) { const d = sec - q.t; if (d > -0.08 && d < 0.14) press = 1 - Math.abs(d - 0.03) / 0.11; }
  }
  return (
    <div style={{ width: w, height: h, borderRadius: 22, overflow: 'hidden', position: 'relative', background: BRAND.deep, border: '1.5px solid rgba(142,207,255,0.6)', boxShadow: `0 0 0 1px rgba(47,140,242,0.4), 0 0 70px rgba(47,140,242,0.55), 0 0 160px rgba(47,140,242,0.25), 0 60px 120px rgba(1,5,15,0.7)` }}>
      <BrowserChrome w={w} />
      <div style={{ position: 'relative', width: w, height: ch, overflow: 'hidden' }}>
        {imgs.map((im, i) => (i === cur || i === cur - 1) && (
          <Img key={im.shot} src={staticFile(`tuto/${im.shot}.jpg`)} style={{
            position: 'absolute', left: 0, top: 0, width: TW, height: TH, maxWidth: 'none', transformOrigin: '0 0',
            transform: `translate(${w / 2 - vw.x * vw.sc}px, ${ch / 2 - vw.y * vw.sc}px) scale(${vw.sc})`,
            opacity: i === cur ? fade : 1, zIndex: i === cur ? 2 : 1,
          }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
          {pts.map((q, i) => <Burst key={i} x={q.p.x} y={q.p.y} t={(sec - q.t) / 0.55} />)}
          {co > 0 && <Cursor x={cx} y={cy} press={Math.max(0, press)} o={co} />}
          <Sheen progress={sheen} strength={0.45} />
        </div>
      </div>
    </div>
  );
};

const InfoPill: React.FC<{ label: string; value: string; local: number; end: number; k: number }> = ({ label, value, local, end, k }) => {
  const inn = ramp(local, 0, 14, EASE.overshoot);
  const out = 1 - ramp(local, end - 8, 8, EASE.exit);
  const o = Math.min(Math.min(1, local / 6), out);
  if (o <= 0) return null;
  return (
    <div style={{ ...glass(999), display: 'inline-flex', alignItems: 'center', gap: 16 * k, padding: `${14 * k}px ${30 * k}px ${14 * k}px ${16 * k}px`, opacity: o, transform: `translateX(${(1 - inn) * 80}px) scale(${0.8 + 0.2 * inn})`, whiteSpace: 'nowrap' }}>
      <div style={{ width: 40 * k, height: 40 * k, borderRadius: 999, background: `radial-gradient(circle at 35% 30%, ${BRAND.ice2}, ${BRAND.blue})`, boxShadow: `0 0 20px ${BRAND.blue}` }} />
      <span style={{ fontFamily: FONT.sans, fontWeight: 500, fontSize: 30 * k, color: BRAND.ice2 }}>{label}</span>
      <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 40 * k, color: '#fff', textShadow: glowText(BRAND.blue, 0.6) }}>{value}</span>
    </div>
  );
};

const Caption: React.FC<{ text: string; local: number; end: number }> = ({ text, local, end }) => {
  const { v, k } = useLayout();
  const inn = ramp(local, 0, 12);
  const out = 1 - ramp(local, end - 8, 8, EASE.exit);
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, ...(v ? { top: 1640 } : { bottom: 42 }), display: 'flex', justifyContent: 'center', opacity: Math.min(inn, out), transform: `translateY(${(1 - inn) * 30}px)` }}>
      <div style={{ ...glass(22), padding: v ? '22px 36px' : '16px 38px', color: BRAND.paper, fontFamily: FONT.sans, fontWeight: 600, fontSize: (v ? 50 : 44) * k, lineHeight: 1.2, textAlign: 'center', maxWidth: v ? 980 : 1500 }}>
        <TextReveal text={text} by="word" variant="blur" start={0} each={12} gap={2} style={{ whiteSpace: 'normal' }} />
      </div>
    </div>
  );
};

// HUD : étape en cours + barre de progression
const Hud: React.FC<{ n: number; title: string; local: number }> = ({ n, title, local }) => {
  const { v } = useLayout();
  const inn = ramp(local, s(CARD) - 4, 16);
  const prog = mix((n - 1) / 4, n / 4, ramp(local, s(CARD), 24, EASE.smooth));
  return (
    <div style={{ position: 'absolute', ...(v ? { left: 50, right: 50, top: 110 } : { left: 56, top: 40 }), opacity: inn, transform: `translateY(${(1 - inn) * -30}px)` }}>
      <div style={{ ...glass(20), padding: '16px 26px', display: 'flex', alignItems: 'center', gap: 22, width: v ? undefined : 560 }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 64, lineHeight: 1, color: '#fff', textShadow: glowText() }}>{String(n).padStart(2, '0')}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.display, fontWeight: 600, fontSize: 22, letterSpacing: '0.16em', color: BRAND.ice }}>
            <span>PROGRESSION</span><span>ÉTAPE {n} SUR 4</span>
          </div>
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 36, color: '#fff', textTransform: 'uppercase', margin: '2px 0 8px' }}>{title}</div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(142,207,255,0.15)', overflow: 'hidden' }}>
            <div style={{ width: `${prog * 100}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${BRAND.blue}, ${BRAND.ice2})`, boxShadow: `0 0 16px ${BRAND.blue}` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Carte d'étape plein écran : énorme numéro lumineux + titre cinétique
const StepCard: React.FC<{ n: number; title: string; local: number }> = ({ n, title, local }) => {
  const { v } = useLayout();
  const end = s(CARD);
  if (local > end + 8) return null;
  const out = ramp(local, end - 8, 14, EASE.exit);
  const num = ramp(local, 0, 22, EASE.snappy);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - out, transform: `scale(${1 + out * 0.5})` }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(10,31,68,0.75), rgba(4,14,36,0.97) 70%)' }} />
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: v ? 520 : 440, lineHeight: 0.85, color: 'transparent', WebkitTextStroke: `3px ${BRAND.ice}`, textShadow: glowText(BRAND.blue, 1.4), transform: `scale(${mix(1.6, 1, num)}) translateY(${(1 - num) * 40}px)`, opacity: num }}>
          {String(n).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 34, letterSpacing: '0.5em', color: BRAND.ice, marginTop: 10, opacity: ramp(local, 6, 12) }}>ÉTAPE {n} SUR 4</div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: v ? 104 : 120, lineHeight: 1, color: '#fff', textTransform: 'uppercase', marginTop: 14, textShadow: glowText(BRAND.blue, 0.8), maxWidth: v ? 960 : undefined }}>
          <TextReveal text={title} by="word" variant="rise" start={8} each={14} gap={4} style={{ whiteSpace: 'normal' }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Faux mobile WhatsApp (aperçu animé, rien n'est envoyé)
const Phone: React.FC<{ local: number }> = ({ local }) => {
  const sec = local / FPS;
  const msg = 'Bonjour Le Glaceur ! Voici mon devis : 4 × glace cubique, 2 × glace pilée. Livraison Cocody, matin. Total : 9 000 F CFA';
  const typed = msg.slice(0, Math.floor(Math.max(0, sec - 0.6) * 60));
  const sent = sec > 2.9;
  const reply = ramp(local, s(3.6), 12, EASE.overshoot);
  return (
    <div style={{ width: 470, height: 940, borderRadius: 64, padding: 14, background: 'linear-gradient(145deg, #1d3c6e, #071630)', border: '2px solid rgba(142,207,255,0.6)', boxShadow: `0 0 80px rgba(47,140,242,0.6), 0 50px 100px rgba(1,5,15,0.8)` }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 52, overflow: 'hidden', background: '#0b141a', display: 'flex', flexDirection: 'column', fontFamily: FONT.sans }}>
        <div style={{ height: 130, background: '#1f2c33', display: 'flex', alignItems: 'flex-end', padding: '0 22px 18px', gap: 14 }}>
          <div style={{ width: 58, height: 58, borderRadius: 29, background: BRAND.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GlaceurMark size={42} tone="dark" /></div>
          <div>
            <div style={{ color: '#e9edef', fontWeight: 700, fontSize: 26 }}>Le Glaceur</div>
            <div style={{ color: '#8696a0', fontSize: 18 }}>{BRAND.whatsapp}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background: 'radial-gradient(circle at 30% 20%, #10202a, #0b141a)' }}>
          {sent && (
            <div style={{ alignSelf: 'flex-end', maxWidth: '86%', background: '#005c4b', color: '#e9edef', borderRadius: '18px 4px 18px 18px', padding: '14px 16px', fontSize: 22, lineHeight: 1.35, transform: `scale(${ramp(local, s(2.9), 10, EASE.overshoot)})`, transformOrigin: '100% 0' }}>
              <div style={{ background: 'rgba(0,0,0,0.22)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 40, height: 48, borderRadius: 6, background: '#e5484d', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>PDF</div>
                <div style={{ fontSize: 19 }}>Devis-Le-Glaceur.pdf</div>
              </div>
              {msg}
              <div style={{ textAlign: 'right', fontSize: 15, color: '#53bdeb', marginTop: 4 }}>08:12 ✓✓</div>
            </div>
          )}
          {reply > 0 && (
            <div style={{ alignSelf: 'flex-start', maxWidth: '80%', background: '#202c33', color: '#e9edef', borderRadius: '4px 18px 18px 18px', padding: '14px 16px', fontSize: 22, transform: `scale(${reply})`, transformOrigin: '0 0' }}>
              Merci ! Commande bien reçue 🧊
            </div>
          )}
        </div>
        <div style={{ height: 96, background: '#1f2c33', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
          <div style={{ flex: 1, height: 64, borderRadius: 28, background: '#2a3942', color: '#d1d7db', fontSize: 18, padding: '8px 20px', overflow: 'hidden', lineHeight: 1.3, display: 'flex', alignItems: 'flex-end' }}>
            {sent ? <span style={{ color: '#8696a0' }}>Message</span> : typed.slice(-60)}
          </div>
          <div style={{ width: 60, height: 60, borderRadius: 30, background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, transform: `scale(${1 - 0.15 * Math.max(0, 1 - Math.abs(sec - 2.85) / 0.12)})` }}>➤</div>
        </div>
      </div>
    </div>
  );
};

const DocCard: React.FC<{ kind: 'PDF' | 'XLS'; local: number; dx: number }> = ({ kind, local, dx }) => {
  if (local < 0 || local > s(1.6)) return null;
  const p = ramp(local, 0, 22, EASE.snappy);
  const o = 1 - ramp(local, s(1.2), 10, EASE.exit);
  const col = kind === 'PDF' ? '#e5484d' : '#1f9d55';
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 190, height: 240, marginLeft: -95, marginTop: -120, borderRadius: 18, background: '#f3faff', boxShadow: `0 0 50px ${col}, 0 30px 60px rgba(1,5,15,0.6)`, transform: `translate(${dx * p}px, ${-260 * p}px) rotate(${(dx > 0 ? 1 : -1) * 12 * p}deg) scale(${0.4 + 0.6 * p})`, opacity: o, padding: 18 }}>
      <div style={{ width: 70, height: 34, borderRadius: 8, background: col, color: '#fff', fontFamily: FONT.display, fontWeight: 800, fontSize: 24, textAlign: 'center', lineHeight: '34px' }}>{kind}</div>
      {[0.9, 0.7, 0.8, 0.5, 0.75].map((wd, i) => <div key={i} style={{ height: 10, width: `${wd * 100}%`, borderRadius: 5, background: 'rgba(10,31,68,0.18)', marginTop: 16 }} />)}
      <div style={{ marginTop: 18, fontFamily: FONT.display, fontWeight: 800, fontSize: 26, color: BRAND.night }}>9 000 F</div>
    </div>
  );
};

// ───────────────────── actes ─────────────────────
const ActView: React.FC<{ act: Act }> = ({ act }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const sec = f / FPS;
  const dur = s(act.dur);
  const { frame: fr, v, k } = L;
  // entrée 3D du navigateur, flottement, sortie en poussée
  const inn = ramp(f, s(CARD) - 8, 26, EASE.snappy);
  const out = ramp(f, dur - 10, 10, EASE.exit);
  let rotY = mix(v ? 0 : 40, v ? 0 : -5, inn) + Math.sin(f / 47) * 1.6;
  let rotX = mix(v ? 35 : 14, 4, inn) + Math.sin(f / 61) * 1.2;
  let sc = mix(0.55, 1, inn) * (1 + out * 0.25);
  let tx = 0, ty = mix(220, 0, inn) + Math.sin(f / 40) * 6, bo = 1;
  // acte 4 : le navigateur s'écarte pour laisser entrer le téléphone WhatsApp
  const waT = act.n === 4 ? act.clicks[2].t + 0.35 : 99;
  const ph = ramp(f, s(waT), 22, EASE.smooth);
  if (ph > 0) {
    if (v) { ty += -330 * ph; sc *= 1 - 0.38 * ph; bo = 1 - 0.55 * ph; rotX += 10 * ph; }
    else { tx -= 330 * ph; sc *= 1 - 0.2 * ph; rotY += 16 * ph; }
  }
  return (
    <AbsoluteFill>
      {/* numéro géant en fond (parallaxe) */}
      <div style={{ position: 'absolute', right: v ? -60 : -40, bottom: v ? 180 : -110, fontFamily: FONT.display, fontWeight: 800, fontSize: v ? 760 : 720, lineHeight: 1, color: 'transparent', WebkitTextStroke: '2px rgba(142,207,255,0.12)', transform: `translateX(${-f * 0.6}px)` }}>
        {String(act.n).padStart(2, '0')}
      </div>
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div style={{ position: 'absolute', left: fr.cx - fr.w / 2, top: fr.cy - fr.h / 2, width: fr.w, height: fr.h, opacity: Math.min(inn * 1.5, 1) * (1 - out) * bo, transform: `translate(${tx}px, ${ty}px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${sc})` }}>
          <Browser w={fr.w} h={fr.h} imgs={act.imgs} cam={act.cam} clicks={act.clicks} sec={sec} sheen={(f - s(CARD) - 6) / 24} />
        </div>
      </AbsoluteFill>
      {act.n === 4 && (
        <>
          <DocCard kind="PDF" local={f - s(act.clicks[0].t)} dx={v ? -200 : 380} />
          <DocCard kind="XLS" local={f - s(act.clicks[1].t)} dx={v ? 200 : 600} />
          {ph > 0 && (
            <div style={{ position: 'absolute', left: v ? 540 - 235 : 1290, top: v ? 700 : 70, opacity: ph * (1 - out), transform: `translateY(${(1 - ph) * 500}px) rotateZ(${(1 - ph) * 8}deg)`, transformOrigin: '50% 100%' }}>
              <Phone local={f - s(waT)} />
            </div>
          )}
        </>
      )}
      {act.pills.map((p, i) => {
        const st = s(p.t), en = i + 1 < act.pills.length ? s(act.pills[i + 1].t) : (act.n === 4 ? s(waT) : dur);
        const local = f - st;
        if (local < 0 || local > en - st) return null;
        return (
          <div key={i} style={v ? { position: 'absolute', left: 0, right: 0, top: 1520, display: 'flex', justifyContent: 'center' } : { position: 'absolute', right: 60, top: 250 }}>
            <InfoPill {...p} local={local} end={en - st} k={k} />
          </div>
        );
      })}
      {act.captions.map((c, i) => {
        const st = s(c.t), en = i + 1 < act.captions.length ? s(act.captions[i + 1].t) : dur - 6;
        return f >= st && f < en ? <Caption key={i} text={c.text} local={f - st} end={en - st} /> : null;
      })}
      <Hud n={act.n} title={act.title} local={f} />
      <StepCard n={act.n} title={act.title} local={f} />
      <Flash at={0} dur={12} max={0.9} />
      <Streak p={(f - 4) / 18} y={v ? 960 : 540} />
    </AbsoluteFill>
  );
};

// ───────────────────── intro ─────────────────────
const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  const mark = ramp(f, 8, 26, EASE.overshoot);
  const up = ramp(f, 40, 22, EASE.smooth);
  const out = ramp(f, INTRO - 12, 12, EASE.exit);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + out * 2.2})`, opacity: 1 - out }}>
      <div style={{ position: 'absolute', left: '50%', top: v ? 640 : 330, width: 900, height: 900, marginLeft: -450, marginTop: -450, borderRadius: '50%', background: `radial-gradient(circle, rgba(47,140,242,${0.55 * mark}), rgba(47,140,242,0) 65%)`, transform: `scale(${0.6 + 0.5 * mark + Math.sin(f / 20) * 0.03})` }} />
      <div style={{ position: 'absolute', left: '50%', top: mix(v ? 960 : 540, v ? 640 : 330, up), transform: `translate(-50%, -50%) scale(${mix(0.2, 1, mark) * mix(1, 0.62, up)}) rotate(${(1 - mark) * -40}deg)`, opacity: Math.min(1, mark * 2), filter: `drop-shadow(0 0 30px ${BRAND.blue}) drop-shadow(0 0 70px rgba(47,140,242,0.7))` }}>
        <GlaceurMark size={360} tone="white" />
      </div>
      <div style={{ position: 'absolute', top: v ? 860 : 500, left: 0, right: 0, textAlign: 'center', padding: '0 40px' }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: v ? 104 : 104, lineHeight: 1, color: '#fff', textTransform: 'uppercase' }}>
          <TextReveal text={v ? 'Commandez\nvotre glace' : 'Commandez votre glace'} by={v ? 'line' : 'word'} variant="rise" start={46} each={16} gap={5} />
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: v ? 190 : 200, lineHeight: 1.05, marginTop: 8, color: '#fff', textShadow: glowText(BRAND.blue, 1.2), textTransform: 'uppercase' }}>
          <TextReveal text="en 4 étapes." by="word" variant="scale" start={66} each={16} gap={6} />
        </div>
        <div style={{ display: 'inline-block', marginTop: 34, opacity: ramp(f, 100, 14), transform: `translateY(${(1 - ramp(f, 100, 14)) * 20}px)` }}>
          <div style={{ ...glass(999), padding: '14px 36px', fontFamily: FONT.sans, fontWeight: 600, fontSize: 40, color: BRAND.ice2, letterSpacing: '0.04em', position: 'relative', overflow: 'hidden' }}>
            {BRAND.site}
            <Sheen progress={(f - 108) / 26} strength={0.8} />
          </div>
        </div>
      </div>
      <Streak p={(f - 30) / 20} y={v ? 900 : 470} />
      <Flash at={30} dur={14} max={0.7} />
    </AbsoluteFill>
  );
};

// ───────────────────── vue d'ensemble : site + produits en orbite ─────────────────────
const PROD = ['glacons', 'pilee', 'carboglace', 'sac-glaceur', 'barres', 'gobelet'];
const Overview: React.FC = () => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  const inn = ramp(f, 0, 30, EASE.snappy);
  const push = f / OVERVIEW;
  const bw = v ? 900 : 1100, bh = v ? 720 : 640;
  const ccx = v ? 540 : 960, ccy = v ? 1020 : 620;
  return (
    <AbsoluteFill style={{ perspective: 2000 }}>
      {PROD.map((p, i) => {
        const a = (i / PROD.length) * Math.PI * 2 + f / 55;
        const z = Math.sin(a);
        const x = ccx + Math.cos(a) * (v ? 420 : 800), y = ccy + z * (v ? 520 : 150);
        const sz = (v ? 240 : 250) * (0.75 + 0.3 * (z + 1) / 2);
        const pi = ramp(f, 6 + i * 4, 18, EASE.overshoot);
        return (
          <div key={p} style={{ position: 'absolute', left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, borderRadius: 26, overflow: 'hidden', border: '1.5px solid rgba(142,207,255,0.6)', boxShadow: `0 0 40px rgba(47,140,242,0.5), 0 30px 60px rgba(1,5,15,0.6)`, transform: `scale(${pi}) rotate(${Math.cos(a) * 8}deg)`, zIndex: z > 0 ? 5 : 0, opacity: z > 0 ? 1 : 0.5 }}>
            <Img src={staticFile(`img/${p}.webp`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: ccx - bw / 2, top: ccy - bh / 2, width: bw, height: bh, zIndex: 2, transform: `rotateY(${mix(-35, -14, inn) + push * 6}deg) rotateX(${mix(20, 8, inn)}deg) scale(${mix(0.6, 0.95, inn) + push * 0.12})`, opacity: inn }}>
        <Browser w={bw} h={bh} imgs={[{ at: 0, shot: '01-accueil' }]} cam={[{ t: 0, x: 960, y: 540, z: 1 }, { t: 4, x: 900, y: 560, z: 1.12 }]} clicks={[]} sec={f / FPS} sheen={(f - 10) / 30} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: v ? 200 : 60, textAlign: 'center', zIndex: 10 }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 30, letterSpacing: '0.4em', color: BRAND.ice, opacity: ramp(f, 4, 14) }}>24H/24 · 7J/7 · ABIDJAN</div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: v ? 110 : 88, lineHeight: 1.05, color: '#fff', textTransform: 'uppercase', textShadow: glowText(BRAND.blue, 0.7), marginTop: 10 }}>
          <TextReveal text={v ? 'Tout se passe\nen ligne' : 'Tout se passe en ligne'} by={v ? 'line' : 'word'} variant="rise" start={8} each={14} gap={4} />
        </div>
      </div>
      <Flash at={0} dur={10} max={0.6} />
    </AbsoluteFill>
  );
};

// ───────────────────── outro ─────────────────────
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  const words = ['Simple.', 'Rapide.', 'Glacé.'];
  const wordsOut = ramp(f, s(2.6), 10, EASE.exit);
  const logo = ramp(f, s(2.9), 24, EASE.snappy);
  const cta = ramp(f, s(4.4), 18, EASE.snappy);
  const lift = mix(0, v ? -300 : -200, cta);
  const fade = ramp(f, OUTRO - 24, 24, EASE.smooth);
  return (
    <AbsoluteFill>
      {wordsOut < 1 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: 1 - wordsOut, transform: `scale(${1 + wordsOut * 0.4})` }}>
          {words.map((w, i) => {
            const p = ramp(f, 6 + i * 20, 14, EASE.snappy);
            return (
              <div key={w} style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: v ? 220 : 200, lineHeight: 0.95, textTransform: 'uppercase', color: i === 2 ? 'transparent' : '#fff', WebkitTextStroke: i === 2 ? `3px ${BRAND.ice2}` : undefined, textShadow: glowText(BRAND.blue, i === 2 ? 1.2 : 0.6), opacity: p, transform: `scale(${mix(1.8, 1, p)})` }}>{w}</div>
            );
          })}
        </AbsoluteFill>
      )}
      {logo > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', width: 1200, height: 1200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,140,242,0.45), rgba(47,140,242,0) 60%)', opacity: logo }} />
          <div style={{ position: 'relative', transform: `translateY(${lift}px) scale(${mix(1.4, 1, logo) * mix(1, 0.8, cta)})`, opacity: logo, filter: `drop-shadow(0 0 30px rgba(47,140,242,0.8))`, overflow: 'hidden', padding: 10 }}>
            <GlaceurLogo width={v ? 820 : 900} />
            <Sheen progress={(f - s(3.2)) / 30} strength={0.9} />
          </div>
          <div style={{ position: 'relative', fontFamily: FONT.display, fontWeight: 500, fontSize: v ? 50 : 48, letterSpacing: '0.12em', color: BRAND.ice2, textTransform: 'uppercase', marginTop: 10, transform: `translateY(${lift}px)`, textAlign: 'center', padding: '0 40px' }}>
            <TextReveal text={BRAND.tagline} by="word" variant="blur" start={s(3.4)} each={14} gap={3} style={{ whiteSpace: 'normal' }} />
          </div>
          <div style={{ position: 'absolute', top: v ? 1000 : 560, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: cta, transform: `translateY(${(1 - cta) * 60}px)` }}>
            <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: v ? 96 : 76, color: '#fff', textTransform: 'uppercase', textShadow: glowText(BRAND.blue, 0.7) }}>Commandez maintenant</div>
            <div style={{ display: 'flex', flexDirection: v ? 'column' : 'row', gap: 24, alignItems: 'center' }}>
              <div style={{ ...glass(999), padding: '18px 44px', fontFamily: FONT.sans, fontWeight: 700, fontSize: v ? 58 : 48, color: '#fff' }}>{BRAND.site}</div>
              <div style={{ padding: '18px 44px', borderRadius: 999, background: 'linear-gradient(135deg, #25d366, #128c7e)', boxShadow: '0 0 50px rgba(37,211,102,0.55)', fontFamily: FONT.sans, fontWeight: 700, fontSize: v ? 52 : 48, color: '#fff', transform: `scale(${1 + 0.03 * Math.sin(f / 6) * ramp(f, s(5.2), 10)})` }}>WhatsApp {BRAND.whatsapp}</div>
            </div>
            <div style={{ fontFamily: FONT.sans, fontWeight: 500, fontSize: v ? 36 : 30, color: BRAND.ice, opacity: ramp(f, s(5.2), 16), textAlign: 'center', padding: '0 60px', lineHeight: 1.4 }}>
              24h/24 · 7j/7 · Livraison offerte dès 20 articles · Aucun paiement en ligne
            </div>
          </div>
        </AbsoluteFill>
      )}
      <Flash at={0} dur={12} max={0.9} />
      <Flash at={s(2.9)} dur={14} max={0.8} />
      <AbsoluteFill style={{ background: '#01050f', opacity: fade }} />
    </AbsoluteFill>
  );
};

// ───────────────────── fond commun ─────────────────────
const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  return (
    <Stage look={look} keyLight={{ x: 0.5 + 0.12 * Math.sin(f / 90), y: v ? 0.35 : 0.2 }} fill={{ x: 0.85, y: 0.85 }} breathe={1} intensity={1.15}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 40% at 50% 110%, rgba(47,140,242,0.35), transparent 70%)` }} />
      <Dust look={look} count={v ? 50 : 60} seed={7} drift={0.5} opacity={0.75} color={BRAND.ice} />
    </Stage>
  );
};

// ───────────────────── son ─────────────────────
const Sfx: React.FC<{ at: number; name: string; vol?: number }> = ({ at: a, name, vol = 0.5 }) => (
  <Sequence from={Math.max(0, a)} durationInFrames={s(3)} layout="none">
    <Audio src={staticFile(`audio/sfx/${name}.mp3`)} volume={vol} />
  </Sequence>
);

// musique : 24 temps avant le « temps 0 » de la piste pour couvrir 60 s (drop vers 14 s)
const BGM_FROM = Math.round((SOURCE_BEAT0 - 24 * BEAT_INT) * FPS);

export const Tutoriel: React.FC = () => {
  const total = TUTO_TOTAL;
  return (
    <AbsoluteFill style={{ background: BRAND.deep }}>
      <Backdrop />
      <Sequence durationInFrames={INTRO}><Intro /></Sequence>
      <Sequence from={INTRO} durationInFrames={OVERVIEW}><Overview /></Sequence>
      {ACTS.map((a, i) => (
        <Sequence key={a.n} from={actStart[i]} durationInFrames={s(a.dur)}><ActView act={a} /></Sequence>
      ))}
      <Sequence from={OUTRO_AT} durationInFrames={OUTRO}><Outro /></Sequence>

      <Audio src={staticFile('audio/house-vibez.mp3')} startFrom={BGM_FROM}
        volume={(f) => interpolate(f, [0, 20, total - 60, total], [0, 0.32, 0.32, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      <Sfx at={0} name="riser-cine" vol={0.35} />
      <Sfx at={30} name="impact-cine-big" vol={0.45} />
      <Sfx at={66} name="whoosh-swirl" vol={0.35} />
      <Sfx at={104} name="light-sweep-magic" vol={0.4} />
      <Sfx at={INTRO - 12} name="impact-deep-whoosh" vol={0.45} />
      <Sfx at={INTRO + 6} name="sparkle" vol={0.3} />
      {ACTS.map((a, i) => (
        <React.Fragment key={a.n}>
          <Sfx at={actStart[i] - 8} name="transition-tech-slide" vol={0.45} />
          <Sfx at={actStart[i]} name="bass-hit-short" vol={0.5} />
          <Sfx at={actStart[i] + s(CARD) - 8} name="wind-woosh-throw" vol={0.3} />
          {a.clicks.map((c, j) => <Sfx key={j} at={actStart[i] + s(c.t)} name="switch-tap" vol={0.6} />)}
          {a.clicks.filter((c) => c.sfx).map((c, j) => <Sfx key={`x${j}`} at={actStart[i] + s(c.t) + 3} name={c.sfx!} vol={0.45} />)}
          {a.pills.map((p, j) => <Sfx key={`p${j}`} at={actStart[i] + s(p.t)} name="data-scan" vol={0.15} />)}
        </React.Fragment>
      ))}
      <Sfx at={OUTRO_AT} name="impact-cine-big" vol={0.45} />
      {[6, 26, 46].map((d) => <Sfx key={d} at={OUTRO_AT + d} name="bass-hit-short" vol={0.45} />)}
      <Sfx at={OUTRO_AT + s(2.9)} name="power-up-electronic" vol={0.35} />
      <Sfx at={OUTRO_AT + s(3.2)} name="light-sweep-magic" vol={0.35} />
      <Sfx at={OUTRO_AT + s(4.4)} name="ui-success-soft" vol={0.4} />
    </AbsoluteFill>
  );
};
