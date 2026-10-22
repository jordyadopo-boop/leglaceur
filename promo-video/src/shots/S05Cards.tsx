// S05 · magician-card-flourish (adapté, 9:16) — un éclat bleu glacier, la carte « Glace cubique »
// en jaillit, file en spirale vers la caméra et se fige net ; deux cartes (grain, pilée) s'ouvrent
// en éventail derrière elle, puis le titre de la gamme monte en bas. 59 images (L18–L22).
import React, { useId } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { EASE, FONT, Grain, Vignette, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, TextReveal, alpha, type } from '../_fixtures/Look';
import { GlaceurMark, PRODUCTS } from '../_fixtures/Brand';

const L = LOOKS.glaceur;
const CARD_W = 420;
const CARD_H = 600;
const AX = CARD_W / Math.hypot(CARD_W, CARD_H);
const AY = CARD_H / Math.hypot(CARD_W, CARD_H);
const TAKEOFF = 5;
const FLASH_END = 8;
const FLIGHT = 20;
const LAND = TAKEOFF + FLIGHT; // 25 : définitif
const TURNS = 6; // nombre entier → la carte se fige de face
const FS = 1.45; // carte finale 609×870
const CX = 540;
const CY = 800;

type P = (typeof PRODUCTS)[number];

const CardFace: React.FC<{ p: P }> = ({ p }) => (
  <div style={{
    width: CARD_W, height: CARD_H, borderRadius: 26, overflow: 'hidden', position: 'relative', fontFamily: FONT.sans, color: L.ink,
    background: 'linear-gradient(165deg, #14396f 0%, #0b2552 50%, #061636 100%)',
    boxShadow: 'inset 0 0 0 1.5px rgba(142,207,255,0.28), inset 0 1px 0 rgba(255,255,255,0.3)', display: 'flex', flexDirection: 'column',
  }}>
    <div style={{ position: 'relative', height: 330, margin: 14, borderRadius: 16, overflow: 'hidden' }}>
      <Img src={staticFile(p.img)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,14,36,0) 55%, rgba(4,14,36,0.55) 100%)' }} />
      <div style={{ position: 'absolute', left: 14, top: 14 }}><GlaceurMark size={44} tone="dark" /></div>
    </div>
    <div style={{ padding: '6px 24px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 60, lineHeight: 1, textTransform: 'uppercase' }}>{p.name}</div>
      <div style={{ fontSize: 58, fontWeight: 600, color: L.ink2, marginTop: 6 }}>{p.unit}</div>
      <div style={{ marginTop: 'auto', marginBottom: 22, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 84, lineHeight: 1, color: L.accent2 }}>{p.price}</span>
        <span style={{ fontSize: 58, fontWeight: 700, color: L.accent }}>F CFA</span>
      </div>
    </div>
  </div>
);

const CardBack: React.FC = () => (
  <div style={{
    position: 'absolute', inset: 0, borderRadius: 26, overflow: 'hidden',
    background: 'linear-gradient(160deg, #1d4d92 0%, #0f2c5e 55%, #071a3d 100%)',
    boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.16)',
  }}>
    <div style={{
      position: 'absolute', inset: 0,
      background: 'repeating-linear-gradient(45deg, rgba(142,207,255,0.08) 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, rgba(142,207,255,0.08) 0 1px, transparent 1px 14px)',
    }} />
    <div style={{ position: 'absolute', inset: 24, borderRadius: 16, boxShadow: 'inset 0 0 0 1.5px rgba(191,228,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <GlaceurMark size={150} tone="dark" />
    </div>
  </div>
);

// Éclat d'apparition : croix d'aiguilles bleu glacier + point blanc, 8 images, tourne de 90°.
const SpawnFlash: React.FC<{ f: number }> = ({ f }) => {
  const id = `s05n${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (f > FLASH_END) return null;
  const s = interpolate(f, [0, 2], [0.2, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) })
    * interpolate(f, [4, TAKEOFF, FLASH_END], [1, 0.3, 0.05], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  const op = interpolate(f, [0, 1, 4, FLASH_END], [0.4, 1, 1, 0], { extrapolateRight: 'clamp' });
  const rot = interpolate(f, [0, FLASH_END], [0, 90], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const needle = (deg: number, len: number, w: number) => (
    <g transform={`rotate(${deg})`}>
      <path d={`M 0 ${-w / 2} L ${len} 0 L 0 ${w / 2} Z`} fill={`url(#${id})`} />
      <path d={`M 0 ${-w / 2} L ${len} 0 L 0 ${w / 2} Z`} fill={`url(#${id})`} transform="scale(-1,1)" />
    </g>
  );
  return (
    <div style={{ position: 'absolute', left: CX, top: CY, transform: `scale(${s})`, opacity: op }}>
      <div style={{ position: 'absolute', left: -16, top: -16, width: 32, height: 32, borderRadius: 16, background: 'radial-gradient(circle, #fff 0%, rgba(225,245,255,0.95) 45%, rgba(140,215,255,0) 80%)' }} />
      <div style={{ position: 'absolute', left: -90, top: -90, width: 180, height: 180, borderRadius: 90, background: 'radial-gradient(circle, rgba(109,179,255,0.8) 0%, rgba(47,140,242,0.3) 45%, rgba(47,140,242,0) 75%)', filter: 'blur(4px)' }} />
      <svg width={2400} height={2400} viewBox="-1200 -1200 2400 2400" style={{ position: 'absolute', left: -1200, top: -1200, transform: `rotate(${rot}deg)` }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#eaf6ff" />
            <stop offset="0.3" stopColor="#6db3ff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#2f8cf2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g filter="blur(6px)" opacity={0.75}>{needle(-52, 900, 26)}</g>
        {needle(-52, 900, 4)}
        <g filter="blur(4px)" opacity={0.75}>{needle(38, 460, 20)}</g>
        {needle(38, 460, 3)}
      </svg>
    </div>
  );
};

const flight = (f: number) => {
  const t = Math.min(1, Math.max(0, (f - TAKEOFF) / FLIGHT));
  const spin = t < 0.4 ? t * 1.55 : 0.62 + 0.38 * (1 - Math.pow(1 - (t - 0.4) / 0.6, 2.4));
  const theta = TURNS * 360 * Math.min(1, spin);
  const tp = t < 0.14 ? 0.06 * (t / 0.14) ** 2 : 0.06 + 0.94 * (1 - Math.pow(1 - (t - 0.14) / 0.86, 3));
  const arc = Math.sin(tp * Math.PI);
  const z = 9000 * (1 - tp);
  return { theta, cx: CX + arc * 260, cy: CY - arc * 420, scale: FS * (900 / (900 + z)) };
};

const HeroCard: React.FC = () => {
  const f = useCurrentFrame();
  const { theta, cx, cy, scale } = flight(f);
  const back = Math.cos((theta * Math.PI) / 180) < 0;
  const W = CARD_W * FS;
  const H = CARD_H * FS;
  const landed = f >= LAND;
  const sheenOn = f >= LAND + 6 && f <= LAND + 26;
  const sheenP = ramp(f, LAND + 6, 20, EASE.smooth);
  return (
    <div style={{ position: 'absolute', left: cx - W / 2, top: cy - H / 2, width: W, height: H, transform: `scale(${scale / FS})`, opacity: f >= TAKEOFF ? 1 : 0 }}>
      <div style={{
        width: '100%', height: '100%', position: 'relative', borderRadius: 26 * FS,
        transform: `perspective(${1300 * FS}px) rotate3d(${AX}, ${AY}, 0, ${theta}deg)`,
        boxShadow: landed
          ? `0 50px 100px -20px rgba(1,5,15,0.9), 0 0 0 1px rgba(142,207,255,0.22), 0 0 90px ${alpha(L.light, 0.3)}`
          : `0 0 70px ${alpha(L.accent, 0.6)}`,
      }}>
        <div style={{ position: 'absolute', inset: 0, zoom: FS }}>
          <CardFace p={PRODUCTS[0]} />
          {back && <CardBack />}
        </div>
        {sheenOn && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 26 * FS, overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: '-45%', bottom: '-45%', left: `${-70 + sheenP * 215}%`, width: '34%', transform: 'rotate(16deg)', mixBlendMode: 'screen',
              background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(220,240,255,0.12) 35%, rgba(240,250,255,0.38) 50%, rgba(220,240,255,0.12) 65%, rgba(255,255,255,0) 100%)',
            }} />
          </div>
        )}
      </div>
    </div>
  );
};

// Éventail : les deux cartes glissent de derrière la carte principale après le figé.
const FanCard: React.FC<{ p: P; side: -1 | 1 }> = ({ p, side }) => {
  const f = useCurrentFrame();
  const k = ramp(f, LAND + 1, 12, EASE.snappy);
  if (k <= 0) return null;
  const W = CARD_W * FS;
  const H = CARD_H * FS;
  return (
    <div style={{
      position: 'absolute', left: CX - W / 2, top: CY - H / 2, width: W, height: H, transformOrigin: '50% 120%',
      transform: `translateX(${side * 340 * k}px) translateY(${40 * k}px) rotate(${side * 13 * k}deg) scale(${1 - 0.2 * k})`,
      filter: `brightness(${1 - 0.3 * k})`, borderRadius: 26 * FS, boxShadow: '0 40px 80px -20px rgba(1,5,15,0.9)',
    }}>
      <div style={{ zoom: FS }}><CardFace p={p} /></div>
    </div>
  );
};

const Pulse: React.FC = () => {
  const f = useCurrentFrame();
  if (f < LAND || f > LAND + 20) return null;
  const p = ramp(f, LAND, 18, EASE.out);
  const W = CARD_W * FS;
  const H = CARD_H * FS;
  return (
    <div style={{
      position: 'absolute', left: CX - W / 2, top: CY - H / 2, width: W, height: H, borderRadius: 26 * FS,
      transform: `scale(${1 + p * 0.14})`, opacity: (1 - p) * 0.9,
      boxShadow: `0 0 0 ${(3 - p * 2).toFixed(2)}px ${alpha('#bfe4ff', 0.9)}, 0 0 50px ${alpha(L.light, 0.7)}`,
    }} />
  );
};

export const CardsFlourish: React.FC = () => {
  const f = useCurrentFrame();
  const moving = f >= TAKEOFF && f <= LAND;
  const lit = ramp(f, LAND - 4, 20, EASE.out);
  return (
    <AbsoluteFill style={{ background: L.bg[2] }}>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.3 }} fill={null} intensity={0.3 + 0.7 * lit} vignette={0.6} grain={0}>
        <div style={{
          position: 'absolute', left: CX - 600, top: CY - 650, width: 1200, height: 1300, opacity: lit,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(L.light, 0.42)} 0%, ${alpha(L.light, 0.1)} 45%, ${alpha(L.light, 0)} 70%)`,
        }} />
      </Stage>
      <FanCard p={PRODUCTS[1]} side={-1} />
      <FanCard p={PRODUCTS[2]} side={1} />
      {moving ? <CameraMotionBlur shutterAngle={150} samples={7}><HeroCard /></CameraMotionBlur> : <HeroCard />}
      <Pulse />
      <div style={{ position: 'absolute', top: 1340, width: '100%', textAlign: 'center' }}>
        <TextReveal text="NOTRE GAMME" variant="track" start={LAND + 2} each={14} gap={0.8}
          style={{ ...type(58, 700, { caps: true }), fontFamily: FONT.display, letterSpacing: '0.24em', color: L.accent }} />
        <div style={{ ...type(140, 800, { caps: true }), fontFamily: FONT.display, color: L.ink, lineHeight: 1, marginTop: 18 }}>
          <TextReveal text="7 formats" by="word" variant="rise" start={LAND + 4} each={10} gap={4} />
        </div>
        <div style={{ ...type(64, 600), color: L.ink2, marginTop: 20 }}>
          <TextReveal text="du glaçon à la carboglace" by="word" variant="blur" start={LAND + 9} each={10} gap={1.5} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}><SpawnFlash f={f} /></div>
      <Vignette strength={0.35} />
      <Grain opacity={0.07} blend="soft-light" />
    </AbsoluteFill>
  );
};
