// S07 · card-flip-reveal (adapté, 9:16) — impact 2 sur L28 : la carte « Carboglace » claque à l'écran,
// puis se retourne sur L29 (anticipation 4 images, rotation 16, rebond ressort) pour révéler
// le verso givré : −78,5 °C et 7 500 F le kilo, tenus ≥ 1 s (R1). 59 images.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, Vignette, bezier, mix, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha, springAt } from '../_fixtures/Look';
import { GlaceurMark } from '../_fixtures/Brand';
import { beatF } from '../beat';

const L = LOOKS.glaceur;
const CW = 860;
const CH = 1240;
const CX = 540;
const CY = 900;
const FLIP0 = beatF(29) - beatF(28) - 4; // l'anticipation commence 4 images avant le temps
const PRE = 4;
const FLIP = 16;
const PEAK = 194;
const flipEase = bezier(0.55, 0, 0.3, 1);

const angleAt = (f: number) => {
  if (f < FLIP0 + PRE) return -10 * ramp(f, FLIP0, PRE, EASE.out);
  if (f < FLIP0 + PRE + FLIP) return mix(-10, PEAK, ramp(f, FLIP0 + PRE, FLIP, flipEase));
  return PEAK - (PEAK - 180) * springAt(f, FLIP0 + PRE + FLIP, { damping: 15, stiffness: 190 });
};

const FaceLight: React.FC<{ angle: number; dark: boolean }> = ({ angle, dark }) => {
  const c = Math.abs(Math.cos((angle * Math.PI) / 180));
  const band = Math.max(0, 1 - Math.abs(angle - 90) / 34);
  const pos = mix(-20, 120, Math.min(1, Math.max(0, (angle - 56) / 68)));
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: (1 - c) * (dark ? 0.55 : 0.4) }} />
      {band > 0.01 && <div style={{
        position: 'absolute', inset: 0, opacity: band * (dark ? 0.5 : 0.35),
        background: `linear-gradient(100deg, rgba(255,255,255,0) ${pos - 12}%, rgba(255,255,255,0.9) ${pos}%, rgba(255,255,255,0) ${pos + 12}%)`,
      }} />}
    </>
  );
};

export const CarboFlip: React.FC = () => {
  const f = useCurrentFrame();
  const angle = angleAt(f);
  const lift = Math.max(0, Math.sin((Math.min(180, Math.max(0, angle)) * Math.PI) / 180));
  const land = FLIP0 + PRE + FLIP;
  // impact d'entrée : la carte claque de 1.18 → 1 sur 7 images, flash glacier
  const slam = mix(1.18, 1, ramp(f, 0, 7, EASE.out));
  const flash = 0.6 * (1 - ramp(f, 0, 8, EASE.out));
  const num = springAt(f, land - 2, { damping: 18, stiffness: 160 });
  const price = ramp(f, land + 3, 12, EASE.snappy);
  const smoke = 0.5 + 0.5 * Math.sin(f / 9);
  return (
    <AbsoluteFill style={{ background: L.bg[2] }}>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.35 }} fill={{ x: 0.5, y: 1 }} intensity={0.9} grain={0}>
        <div style={{
          position: 'absolute', left: CX - 640, top: CY - 760, width: 1280, height: 1520, opacity: 0.4 + 0.6 * ramp(f, land - 6, 14, EASE.out),
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha('#bfe4ff', 0.32)} 0%, ${alpha(L.light, 0.1)} 45%, ${alpha(L.light, 0)} 70%)`,
        }} />
      </Stage>
      <div style={{ position: 'absolute', left: CX - CW / 2, top: CY - CH / 2, width: CW, height: CH, perspective: 2400, transform: `scale(${slam.toFixed(4)})` }}>
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${(lift * 90).toFixed(2)}px) rotateY(${angle.toFixed(3)}deg)` }}>
          {/* recto : la carboglace, sombre et fumante */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 48, overflow: 'hidden', fontFamily: FONT.sans,
            background: '#030a1a', boxShadow: `inset 0 0 0 2px ${alpha('#8ecfff', 0.25)}, 0 60px 120px -30px rgba(1,5,15,0.95)`,
          }}>
            <Img src={staticFile('img/carboglace.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${(1.08 + 0.02 * smoke).toFixed(4)})` }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(3,10,26,0.35) 0%, rgba(3,10,26,0.1) 40%, rgba(3,10,26,0.92) 100%)' }} />
            <div style={{ position: 'absolute', left: 60, top: 60, display: 'flex', alignItems: 'center', gap: 18 }}>
              <GlaceurMark size={84} tone="dark" />
              <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 58, letterSpacing: '0.16em', color: '#bfe4ff' }}>FROID EXTRÊME</span>
            </div>
            <div style={{ position: 'absolute', left: 60, right: 60, bottom: 70 }}>
              <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 170, lineHeight: 0.9, color: '#f3faff', textTransform: 'uppercase' }}>Carbo&shy;glace</div>
              <div style={{ fontSize: 64, fontWeight: 600, color: '#bfe4ff', marginTop: 18 }}>Glace carbonique</div>
            </div>
            <FaceLight angle={angle} dark />
          </div>
          {/* verso : givre blanc, la température et le prix */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 48, overflow: 'hidden', fontFamily: FONT.sans,
            background: 'linear-gradient(180deg, #ffffff 0%, #eaf6ff 55%, #cfe9ff 100%)', color: '#04122b',
            boxShadow: `inset 0 0 0 2px rgba(4,18,43,0.08), 0 60px 120px -30px rgba(1,5,15,0.95), 0 0 120px ${alpha('#bfe4ff', 0.35)}`,
          }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.5, background: 'radial-gradient(ellipse 60% 30% at 50% 0%, #fff 0%, rgba(255,255,255,0) 70%), repeating-linear-gradient(120deg, rgba(47,140,242,0.05) 0 2px, transparent 2px 18px)' }} />
            <div style={{ position: 'absolute', left: 60, top: 70, fontFamily: FONT.display, fontWeight: 800, fontSize: 64, letterSpacing: '0.18em', color: '#2f8cf2' }}>CARBOGLACE</div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', transform: `scale(${mix(0.85, 1, num).toFixed(4)})`, opacity: Math.min(1, num * 1.5) }}>
              <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 250, lineHeight: 1, letterSpacing: '-0.02em', color: '#04122b' }}>−78,5°C</div>
              <div style={{ fontSize: 64, fontWeight: 600, color: '#1d4d92', marginTop: 10 }}>glace carbonique</div>
            </div>
            <div style={{ position: 'absolute', left: 60, right: 60, top: 720, height: 3, background: 'rgba(4,18,43,0.12)', transform: `scaleX(${price})`, transformOrigin: '0 50%' }} />
            <div style={{ position: 'absolute', left: 60, right: 60, top: 780, opacity: price, transform: `translateY(${((1 - price) * 40).toFixed(1)}px)` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
                <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 210, lineHeight: 1, color: '#2f8cf2' }}>7 500</span>
                <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 100, color: '#2f8cf2' }}>F</span>
              </div>
              <div style={{ fontSize: 64, fontWeight: 700, color: '#04122b', marginTop: 4 }}>le kilo</div>
            </div>
            <FaceLight angle={180 - angle} dark={false} />
          </div>
        </div>
      </div>
      {flash > 0.01 && <AbsoluteFill style={{ background: '#e8f6ff', opacity: flash, mixBlendMode: 'screen' }} />}
      <Vignette strength={0.4} />
      <Grain opacity={0.07} blend="soft-light" />
    </AbsoluteFill>
  );
};
