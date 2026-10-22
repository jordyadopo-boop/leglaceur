// S10 · scanline-assemble-flyin (adapté de ScanlineAssembleFlyin, 9:16) — la page d'accueil mobile de
// leglaceur.ci s'assemble sous une ligne de balayage (L40–L44) : chaque bloc (en-tête, badge, titre, texte,
// photo, bouton, livraison) part du hors-champ et se cale dans son emplacement au passage de la ligne,
// avec coins d'accroche. L'adresse « leglaceur.ci » est tenue tout le plan (≥ 1 s, R1).
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, SpeedBlur, mix, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha, glow } from '../_fixtures/Look';
import { GlaceurLogo, GlaceurMark } from '../_fixtures/Brand';

const L = LOOKS.glaceur;
const AX = 80;
const AY = 300;
const AW = 920;
const AH = 1420;
const SCAN0 = 3;
const SCAN1 = 36;
const Y0 = -20;
const Y1 = AH + 10;
const scanY = (f: number) => Y0 + (Y1 - Y0) * Math.min(1, Math.max(0, (f - SCAN0) / (SCAN1 - SCAN0)));
const frameAtY = (y: number) => SCAN0 + ((y - Y0) / (Y1 - Y0)) * (SCAN1 - SCAN0);
const FLIGHT = 10;

type Plan = { key: string; box: [number, number, number, number]; from: [number, number]; rot: number; land: number };
const PLAN: Plan[] = (() => {
  const ps: Plan[] = [
    { key: 'nav', box: [0, 0, AW, 130], from: [0, -300], rot: 0, land: 0 },
    { key: 'badge', box: [56, 180, 640, 72], from: [-700, -40], rot: -6, land: 0 },
    { key: 'h1', box: [56, 280, 808, 290], from: [-980, 80], rot: -4, land: 0 },
    { key: 'body', box: [56, 600, 808, 150], from: [900, 120], rot: 3, land: 0 },
    { key: 'media', box: [56, 790, 808, 360], from: [960, 60], rot: 6, land: 0 },
    { key: 'cta', box: [56, 1190, 808, 112], from: [-160, 520], rot: 3, land: 0 },
    { key: 'stats', box: [56, 1324, 808, 76], from: [180, 460], rot: -2, land: 0 },
  ];
  let prev = -99;
  for (const p of ps) {
    p.land = Math.max(frameAtY(p.box[1] + p.box[3]), prev + 3);
    prev = p.land;
  }
  return ps;
})();
const P = Object.fromEntries(PLAN.map((p) => [p.key, p])) as Record<string, Plan>;
const LAST_LAND = Math.max(...PLAN.map((p) => p.land));

const poseAt = (p: Plan, f: number) => {
  const a = ramp(f, p.land - FLIGHT, FLIGHT, EASE.overshoot);
  return { x: mix(p.from[0], 0, a), y: mix(p.from[1], 0, a), r: mix(p.rot, 0, a) };
};

const cond = (size: number, weight: number) => ({ fontFamily: FONT.display, fontSize: size, fontWeight: weight, lineHeight: 1 });

const Nav: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 48px', borderBottom: `1px solid ${alpha(L.ink, 0.12)}` }}>
    <GlaceurLogo width={300} />
    <div style={{ marginLeft: 'auto', height: 70, padding: '0 26px', borderRadius: 35, display: 'flex', alignItems: 'center', gap: 12, background: alpha(L.ink, 0.08), border: `1px solid ${alpha(L.ink, 0.18)}`, ...cond(40, 600), color: L.ink }}>
      Mon devis
      <span style={{ width: 40, height: 40, borderRadius: 20, background: L.accent, color: L.bg[2], display: 'flex', alignItems: 'center', justifyContent: 'center', ...cond(28, 700) }}>0</span>
    </div>
  </div>
);
const Badge: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 0, height: 72, padding: '0 28px', borderRadius: 36, display: 'flex', alignItems: 'center', background: alpha(L.accent2, 0.12), border: `1px solid ${alpha(L.accent2, 0.4)}`, ...cond(42, 600), letterSpacing: '0.08em', textTransform: 'uppercase', color: L.ink2, whiteSpace: 'nowrap' }}>
    Glace alimentaire · Abidjan
  </div>
);
const H1: React.FC = () => (
  <div style={{ position: 'absolute', left: -4, top: 0, ...cond(150, 800), lineHeight: 0.95, textTransform: 'uppercase', color: L.ink, whiteSpace: 'nowrap' }}>
    La fraîcheur
    <br />
    <span style={{ fontSize: 86, backgroundImage: `linear-gradient(90deg, ${L.accent} 0%, ${L.accent2} 60%, #ffffff 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>sous toutes ses formes</span>
  </div>
);
const Body: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 808, fontFamily: FONT.sans, fontSize: 58, fontWeight: 500, lineHeight: 1.18, color: L.ink2 }}>
    Livrée partout à Abidjan,<br />24h/24 · 7j/7.
  </div>
);
const Media: React.FC<{ lit: number }> = ({ lit }) => (
  <div style={{ position: 'absolute', inset: 0, borderRadius: 30, overflow: 'hidden', boxShadow: `0 30px 80px -30px ${alpha('#000208', 0.95)}, 0 0 ${(60 * lit).toFixed(1)}px ${alpha(L.accent, 0.25 * lit)}, inset 0 0 0 1px ${alpha('#dff2ff', 0.18)}` }}>
    <Img src={staticFile('img/glacons.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: `brightness(${(0.8 + 0.2 * lit).toFixed(3)})` }} />
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha(L.bg[2], 0)} 45%, ${alpha(L.bg[2], 0.75)} 100%)` }} />
    <div style={{ position: 'absolute', left: 30, right: 30, bottom: 26, display: 'flex', gap: 16 }}>
      {['Pureté', 'Hygiène', 'Qualité'].map((t) => (
        <span key={t} style={{ padding: '10px 22px', borderRadius: 30, background: alpha(L.bg[2], 0.6), border: `1px solid ${alpha('#dff2ff', 0.3)}`, ...cond(44, 600), color: L.ink }}>{t}</span>
      ))}
    </div>
  </div>
);
const Cta: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, borderRadius: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${L.accent2} 0%, ${L.light} 100%)`, color: L.bg[2], ...cond(60, 700), textTransform: 'uppercase', letterSpacing: '0.02em', boxShadow: `0 16px 40px -14px ${alpha(L.light, 0.9)}, inset 0 1px 0 rgba(255,255,255,0.5)` }}>
    Composer ma commande
  </div>
);
const Stats: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, ...cond(58, 600), color: L.ink }}>
    <span style={{ color: L.accent2 }}>✓</span> Livraison offerte dès 20 articles
  </div>
);

const SnapTicks: React.FC<{ w: number; h: number; o: number; g: number }> = ({ w, h, o, g }) => {
  if (o <= 0.01) return null;
  const a = 26;
  const d = [
    `M${-g} ${-g + a}V${-g}H${-g + a}`,
    `M${w + g - a} ${-g}H${w + g}V${-g + a}`,
    `M${w + g} ${h + g - a}V${h + g}H${w + g - a}`,
    `M${-g + a} ${h + g}H${-g}V${h + g - a}`,
  ].join('');
  return (
    <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: o, filter: `drop-shadow(0 0 6px ${alpha(L.accent, 0.9)})` }}>
      <path d={d} fill="none" stroke="#cfe8ff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SiteAssemble: React.FC = () => {
  const frame = useCurrentFrame();
  const ly = scanY(frame);
  const lineOn = ramp(frame, SCAN0 - 3, 4, EASE.out) * (1 - ramp(frame, SCAN1, 6, EASE.exit));
  const done = ramp(frame, LAST_LAND + 2, 8, EASE.out);
  const push = 1 + 0.035 * ramp(frame, 0, 59, EASE.swift);
  const lit = ramp(frame, LAST_LAND + 1, 12, EASE.out);
  const blueprint = mix(1, 0.3, done);

  const Fly: React.FC<{ p: Plan; children: React.ReactNode }> = ({ p, children }) => {
    const pose = poseAt(p, frame);
    const start = p.land - FLIGHT;
    if (frame < start) return null;
    const v0 = poseAt(p, frame - 0.5);
    const v1 = poseAt(p, frame + 0.5);
    const moving = frame < p.land + 3;
    const [bx, by, bw, bh] = p.box;
    const tick = ramp(frame, p.land + 1, 2, EASE.out) * (1 - ramp(frame, p.land + 4, 7, EASE.out));
    const tickGap = 10 + 10 * (1 - ramp(frame, p.land + 1, 5, EASE.snappy));
    return (
      <SpeedBlur vx={moving ? v1.x - v0.x : 0} vy={moving ? v1.y - v0.y : 0} amount={0.3} max={18}>
        <div style={{
          position: 'absolute', left: bx, top: by, width: bw, height: bh, opacity: ramp(frame, start, 3, EASE.out),
          transform: `translate(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px) rotate(${pose.r.toFixed(3)}deg)`,
        }}>
          {children}
          {p.key !== 'nav' && <SnapTicks w={bw} h={bh} o={tick} g={tickGap} />}
        </div>
      </SpeedBlur>
    );
  };

  const grid = (c: string, cm: string) =>
    `repeating-linear-gradient(0deg, ${cm} 0 1.5px, transparent 1.5px 120px), repeating-linear-gradient(90deg, ${cm} 0 1.5px, transparent 1.5px 120px), ` +
    `repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, ${c} 0 1px, transparent 1px 24px)`;
  const lyF = AY + ly;

  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.62, y: 0.0 }} fill={{ x: 0.1, y: 0.95 }} intensity={0.85} grain={0} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: '50% 55%' }}>
        <div style={{ position: 'absolute', inset: -40, opacity: blueprint, background: grid(alpha('#9fd0ff', 0.05), alpha('#9fd0ff', 0.09)), backgroundPosition: '20px 30px' }} />
        {lineOn > 0.01 && (
          <div style={{
            position: 'absolute', inset: -40, opacity: lineOn, background: grid(alpha(L.accent, 0.22), alpha('#cfe8ff', 0.4)), backgroundPosition: '20px 30px',
            WebkitMaskImage: `linear-gradient(180deg, transparent ${lyF - 180 + 40}px, #000 ${lyF + 40}px, transparent ${lyF + 42}px)`,
            maskImage: `linear-gradient(180deg, transparent ${lyF - 180 + 40}px, #000 ${lyF + 40}px, transparent ${lyF + 42}px)`,
          }} />
        )}

        {/* barre d'adresse : tenue tout le plan */}
        <div style={{ position: 'absolute', left: AX, top: 150, width: AW, height: 100, borderRadius: 50, display: 'flex', alignItems: 'center', gap: 18, padding: '0 36px', background: alpha('#020817', 0.55), border: `1px solid ${alpha('#cfe8ff', 0.22)}`, opacity: ramp(frame, 0, 6, EASE.out) }}>
          <GlaceurMark size={58} tone="dark" />
          <span style={{ ...cond(64, 700), color: L.ink, letterSpacing: '0.01em' }}>leglaceur.ci</span>
          <span style={{ marginLeft: 'auto', ...cond(44, 600), letterSpacing: '0.08em', color: done > 0.5 ? L.accent2 : L.ink3, textShadow: done > 0.5 ? glow(L.accent2, 0.5) : 'none' }}>
            {done > 0.5 ? '✓ EN LIGNE' : 'CHARGEMENT'}
          </span>
        </div>

        <div style={{ position: 'absolute', left: AX, top: AY, width: AW, height: AH }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 40,
            background: `linear-gradient(180deg, ${alpha('#0f2c5e', 0.97)} 0%, ${alpha('#071733', 0.97)} 100%)`,
            boxShadow: `0 40px 120px -40px ${alpha('#000208', 0.9)}, inset 0 0 0 1px ${alpha('#cfe8ff', 0.14)}, inset 0 1px 0 ${alpha('#ffffff', 0.1)}`,
            WebkitMaskImage: `linear-gradient(180deg, #000 ${ly - 30}px, transparent ${ly + 2}px)`,
            maskImage: `linear-gradient(180deg, #000 ${ly - 30}px, transparent ${ly + 2}px)`,
          }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 40, border: `1.5px dashed ${alpha('#cfe8ff', 0.3)}`, opacity: blueprint }} />
          {PLAN.map((p) => {
            const [bx, by, bw, bh] = p.box;
            const o = (1 - ramp(frame, p.land - 2, 3, EASE.out)) * blueprint;
            if (o <= 0.01) return null;
            return <div key={p.key} style={{ position: 'absolute', left: bx, top: by, width: bw, height: bh, opacity: o, borderRadius: 14, border: `1.5px dashed ${alpha('#cfe8ff', 0.5)}`, background: alpha(L.light, 0.07) }} />;
          })}

          <Fly p={P.nav}><Nav /></Fly>
          <Fly p={P.badge}><Badge /></Fly>
          <Fly p={P.h1}><H1 /></Fly>
          <Fly p={P.body}><Body /></Fly>
          <Fly p={P.media}><Media lit={lit} /></Fly>
          <Fly p={P.cta}><Cta /></Fly>
          <Fly p={P.stats}><Stats /></Fly>

          {lineOn > 0.01 && (
            <div style={{
              position: 'absolute', left: -60, width: AW + 120, top: ly - 2, height: 4, opacity: lineOn,
              background: 'linear-gradient(90deg, transparent 0%, #dff2ff 8%, #ffffff 50%, #dff2ff 92%, transparent 100%)',
              boxShadow: `0 0 12px ${alpha(L.accent, 0.95)}, 0 0 36px ${alpha(L.accent, 0.6)}, 0 0 90px ${alpha(L.accent, 0.35)}`,
            }} />
          )}
        </div>
      </div>
      <Grain opacity={0.07} blend="soft-light" />
    </AbsoluteFill>
  );
};
