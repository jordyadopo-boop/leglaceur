// S14 · print-texture-transitions / ink-bleed (adapté de InkBleedReveal, 9:16) — L58 → fin.
// Ancienne scène : page givrée « Une envie de fraîcheur ? » ; une goutte d'encre bleu nuit tombe (image 4)
// et s'étale avec des bords en vrilles (feTurbulence + feDisplacementMap sur le masque seulement) ; elle
// recouvre l'écran pile au temps L60 (impact final) et révèle le CTA : logo, leglaceur.ci, WhatsApp.
// Scintillement unique sur le logo à +25 images (Q4) ; les 15 dernières images sont parfaitement fixes (R2).
import React, { useId } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, mix, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha, springAt } from '../_fixtures/Look';
import { GlaceurLogo } from '../_fixtures/Brand';
import { beatF } from '../beat';

const L = LOOKS.glaceur;
const W = 1080;
const H = 1920;
const PAPER = '#eef6ff';
const INK = '#0a1f44';
const HIT = beatF(60) - beatF(58); // impact final : l'encre a tout couvert
const SPARK = HIT + 25;
const STILL = 93; // tout est posé avant : 15 dernières images fixes

const FrostPage: React.FC = () => (
  <div style={{
    position: 'absolute', inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% 40%, #ffffff 0%, ${PAPER} 55%, #d9e9fa 100%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{ textAlign: 'center', color: INK }}>
      <div style={{ fontFamily: FONT.display, fontSize: 60, fontWeight: 600, letterSpacing: '0.3em', color: '#4c6c9c', marginBottom: 30 }}>LE GLACEUR</div>
      <div style={{ fontFamily: FONT.display, fontSize: 150, fontWeight: 800, lineHeight: 0.98, textTransform: 'uppercase' }}>
        Une envie<br />de fraîcheur ?
      </div>
    </div>
    <Grain opacity={0.07} step={100000} freq={0.9} blend="multiply" />
  </div>
);

const Cta: React.FC<{ f: number }> = ({ f }) => {
  const logo = springAt(f, 12, { damping: 13, stiffness: 160 });
  const hit = f >= HIT ? Math.max(0, 1 - (f - HIT) / 9) : 0; // coup sur l'impact L60
  const url = springAt(f, HIT + 6, { damping: 14, stiffness: 150 });
  const wa = springAt(f, HIT + 12, { damping: 14, stiffness: 150 });
  const tag = ramp(f, HIT + 18, 12, EASE.out);
  const fr = Math.min(f, STILL);
  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.36 }} fill={{ x: 0.5, y: 1 }} intensity={0.9} breathe={0} vignette={0.6} grain={0} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', justifyContent: 'center', opacity: Math.min(1, logo * 1.6), transform: `scale(${(0.82 + 0.18 * logo + 0.07 * hit * hit).toFixed(4)})` }}>
        <GlaceurLogo width={860} />
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 860, textAlign: 'center', fontFamily: FONT.display, fontWeight: 700, fontSize: 58,
        letterSpacing: '0.04em', color: L.ink2, opacity: tag, transform: `translateY(${((1 - tag) * 20).toFixed(1)}px)`,
      }}>
        La fraîcheur sous toutes ses formes
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 1060, textAlign: 'center', fontFamily: FONT.display, fontWeight: 800, fontSize: 150,
        lineHeight: 1, color: L.ink, opacity: Math.min(1, url * 1.5), transform: `translateY(${((1 - url) * 50).toFixed(1)}px)`,
      }}>
        leglaceur<span style={{ color: L.accent }}>.ci</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1300, display: 'flex', justifyContent: 'center', opacity: Math.min(1, wa * 1.5), transform: `translateY(${((1 - wa) * 40).toFixed(1)}px)` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 22, padding: '26px 46px', borderRadius: 999,
          background: alpha('#25d366', 0.14), border: `3px solid ${alpha('#25d366', 0.75)}`,
        }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle cx={32} cy={32} r={30} fill="#25d366" />
            <path d="M22 18c2-1 4 0 5 2l2 5c0 2-1 3-2 4 1 3 4 6 7 7 1-1 2-2 4-2l5 2c2 1 3 3 2 5-2 4-6 5-10 3-8-3-14-9-17-17-1-4 0-7 4-9z" fill="#fff" />
          </svg>
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 68, color: L.ink, letterSpacing: '0.02em' }}>+225 07 89 85 16 86</span>
        </div>
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 1490, textAlign: 'center', fontFamily: FONT.display, fontWeight: 600, fontSize: 58,
        letterSpacing: '0.12em', textTransform: 'uppercase', color: L.accent2, opacity: ramp(f, HIT + 22, 12, EASE.out),
      }}>
        Commande 24h/24 · 7j/7
      </div>
      {/* scintillement unique sur le logo (Q4) */}
      {fr >= SPARK && fr < SPARK + 16 && (() => {
        const p = (fr - SPARK) / 16;
        const s = Math.sin(p * Math.PI);
        return (
          <svg width={240} height={240} viewBox="-120 -120 240 240" style={{ position: 'absolute', left: 820 - 120, top: 500 - 120, opacity: s, transform: `rotate(${(p * 60).toFixed(1)}deg) scale(${(0.4 + 0.8 * s).toFixed(3)})` }}>
            <defs><radialGradient id="spk"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor={L.accent2} stopOpacity="0" /></radialGradient></defs>
            <circle r={60} fill="url(#spk)" />
            <path d="M0 -110 L8 -8 L110 0 L8 8 L0 110 L-8 8 L-110 0 L-8 -8 Z" fill="#fff" />
          </svg>
        );
      })()}
    </AbsoluteFill>
  );
};

export const InkCta: React.FC = () => {
  const frame = useCurrentFrame();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bleed = `b${uid}`, feather = `f${uid}`, mNew = `mn${uid}`, mInk = `mi${uid}`;
  const cx = 540, cy = 820;
  const R0 = 6, R1 = HIT;
  const baseR = interpolate(frame, [R0, R1], [0, 1450], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const wob = interpolate(frame, [R1 - 8, R1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const r = Math.max(0, baseR * (1 + 0.08 * Math.sin(frame * 0.5) * wob));
  const lead = 20 + 26 * Math.sin(Math.PI * ramp(frame, R0, R1 - R0, EASE.linear));
  const rInk = r > 0.5 ? r + lead : 0;
  const disp = interpolate(frame, [R0, R1], [60, 170], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const drop = ramp(frame, 2, 6, EASE.overshoot);
  const develop = mix(1.04, 1, ramp(frame, R0, R1 - R0 + 4, EASE.out));
  const settled = frame >= R1 + 2;

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: 'hidden' }}>
      {settled ? <Cta f={frame} /> : (
        <>
          <FrostPage />
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <filter id={bleed} x="-40%" y="-40%" width="180%" height="180%">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale={disp} xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter id={feather} x="-40%" y="-40%" width="180%" height="180%">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale={disp * 1.08} xChannelSelector="R" yChannelSelector="G" result="d" />
                <feGaussianBlur in="d" stdDeviation="3" />
              </filter>
              <mask id={mInk} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <rect width={W} height={H} fill="black" />
                {rInk > 0 && <circle cx={cx} cy={cy} r={rInk} fill="white" filter={`url(#${feather})`} />}
                {drop > 0.01 && <circle cx={cx} cy={cy} r={18 * drop} fill="white" />}
              </mask>
              <mask id={mNew} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <rect width={W} height={H} fill="black" />
                {r > 0.5 && <circle cx={cx} cy={cy} r={r} fill="white" filter={`url(#${bleed})`} />}
              </mask>
            </defs>
            <rect width={W} height={H} fill={INK} opacity={0.9} mask={`url(#${mInk})`} />
            <g mask={`url(#${mNew})`}>
              <foreignObject x="0" y="0" width={W} height={H}>
                <div style={{ width: W, height: H, position: 'relative', transform: `scale(${develop})`, transformOrigin: `${cx}px ${cy}px` }}>
                  <Cta f={frame} />
                </div>
              </foreignObject>
            </g>
          </svg>
        </>
      )}
      {!settled || frame < STILL ? <Grain opacity={0.08} blend="soft-light" /> : <Grain opacity={0.08} step={100000} blend="soft-light" />}
    </AbsoluteFill>
  );
};
