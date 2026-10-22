// S12 · cloner-depth-echo (adapté de ClonerDepthEcho, 9:16) — L50–L54 : le pack de glace se démultiplie en
// profondeur (7 échos qui s'étagent vers le point de fuite haut), le compteur grimpe jusqu'à ×20, puis les
// échos sont aspirés dans la carte (fusion + unique liseré, Q4). Titre « Livraison offerte · dès 20 articles »
// posé à l'image 8 et tenu jusqu'à la fin (≈ 1,7 s, R1).
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha, springAt } from '../_fixtures/Look';
import { GlaceurMark } from '../_fixtures/Brand';

const L = LOOKS.glaceur;
const CW = 580;
const CH = 700;
const CX = 540;
const CY = 730;
const CLONES = 7;
const GAP_Z = 240;
const STAGGER = 2.2;
const SPREAD_AT = 3;
const MERGE_AT = 26;
const MERGE_LEN = 10;
const FUSE = MERGE_AT + MERGE_LEN;

const spreadOf = (f: number, k: number) => springAt(f, SPREAD_AT + k * STAGGER, { damping: 15, stiffness: 160 });
const mergeOf = (f: number, k: number) => ramp(f, MERGE_AT + (CLONES - k) * 0.6, MERGE_LEN - 2, EASE.exit);

const Card: React.FC<{ shade: number; rim?: number }> = ({ shade, rim = 0 }) => (
  <div style={{
    width: CW, height: CH, borderRadius: 36, overflow: 'hidden', position: 'relative',
    background: `linear-gradient(180deg, ${L.bg[0]} 0%, ${L.bg[2]} 100%)`,
    boxShadow: `0 30px 80px ${alpha('#000', 0.5)}, inset 0 0 0 2px ${alpha(L.ink, 0.14 + 0.6 * rim)}${rim > 0.01 ? `, 0 0 ${(60 * rim).toFixed(0)}px ${alpha(L.accent, 0.7 * rim)}` : ''}`,
  }}>
    <Img src={staticFile('img/sac-glaceur.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, background: `linear-gradient(180deg, ${alpha(L.bg[2], 0)} 0%, ${alpha(L.bg[2], 0.92)} 70%)` }} />
    <div style={{ position: 'absolute', left: 36, bottom: 34, display: 'flex', alignItems: 'center', gap: 16 }}>
      <GlaceurMark size={52} tone="dark" />
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 60, letterSpacing: '0.06em', color: L.ink, textTransform: 'uppercase' }}>1 article</span>
    </div>
    {shade > 0.004 && <div style={{ position: 'absolute', inset: 0, background: alpha('#020817', shade) }} />}
  </div>
);

export const ClonerTwenty: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = springAt(frame, 0, { damping: 14, stiffness: 170 });
  // compteur : ×1 → ×20 en accéléré, dernière marche posée à la fusion
  const cp = ramp(frame, 4, MERGE_AT - 4, EASE.swift);
  const value = frame >= FUSE ? 20 : Math.min(19, 1 + Math.floor(cp * 19));
  const prev = frame - 1 >= FUSE ? 20 : Math.min(19, 1 + Math.floor(ramp(frame - 1, 4, MERGE_AT - 4, EASE.swift) * 19));
  const lastTick = frame >= FUSE ? FUSE : null;
  const punch = value !== prev ? 1 : 0;
  const fusePunch = lastTick !== null ? Math.max(0, 1 - (frame - FUSE) / 8) : 0;
  const pulse = frame >= FUSE ? 1 + 0.06 * Math.sin(Math.min(1, (frame - FUSE) / 8) * Math.PI) : 1;
  const rim = frame >= FUSE ? Math.max(0, 1 - (frame - FUSE) / 18) : 0;
  const title1 = springAt(frame, 8, { damping: 14, stiffness: 150 });
  const title2 = springAt(frame, 13, { damping: 14, stiffness: 150 });
  const push = 1 + 0.035 * ramp(frame, 0, 59, EASE.smooth);

  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.3 }} fill={{ x: 0.5, y: 1 }} intensity={0.85} breathe={0.4} vignette={0.65} grain={0} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: `${CX}px ${CY}px` }}>
        <div style={{ position: 'absolute', inset: 0, perspective: 1500, perspectiveOrigin: `${CX}px 180px` }}>
          {Array.from({ length: CLONES }, (_, i) => CLONES - i).map((k) => {
            const s = spreadOf(frame, k - 1) * (1 - mergeOf(frame, k));
            if (s <= 0.002) return null;
            const z = -k * GAP_Z * s;
            const side = (k % 2 ? 1 : -1) * (40 + k * 26) * s;
            return (
              <div key={k} style={{
                position: 'absolute', left: CX - CW / 2, top: CY - CH / 2,
                transform: `translate3d(${side.toFixed(1)}px,${(-k * 62 * s).toFixed(1)}px,${z.toFixed(1)}px)`,
                opacity: Math.min(1, s * 1.6) * (1 - k * 0.07),
              }}>
                <Card shade={0.25 + k * 0.08} />
              </div>
            );
          })}
          <div style={{
            position: 'absolute', left: CX - CW / 2, top: CY - CH / 2,
            transform: `translateY(${((1 - enter) * 120).toFixed(1)}px) scale(${((0.85 + 0.15 * enter) * pulse).toFixed(4)})`,
            opacity: Math.min(1, enter * 1.5),
          }}>
            <Card shade={0} rim={rim} />
          </div>
        </div>

        {/* compteur ×N, accroché au coin bas droit de la carte */}
        <div style={{
          position: 'absolute', left: CX + CW / 2 - 300, top: CY + CH / 2 - 70, width: 400, textAlign: 'right',
          fontFamily: FONT.display, fontWeight: 800, fontSize: 230, lineHeight: 1, color: L.ink,
          opacity: ramp(frame, 3, 5, EASE.out),
          transform: `scale(${(1 + 0.08 * punch + 0.22 * fusePunch).toFixed(4)})`, transformOrigin: '100% 100%',
          textShadow: `0 6px 40px ${alpha('#000', 0.6)}`,
        }}>
          <span style={{ fontSize: 150, color: L.accent2, marginRight: 6 }}>×</span>{value}
        </div>
      </div>

      {/* titre */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1340, textAlign: 'center' }}>
        <div style={{
          fontFamily: FONT.display, fontWeight: 800, fontSize: 132, lineHeight: 1, textTransform: 'uppercase', color: L.ink,
          opacity: Math.min(1, title1 * 1.5), transform: `translateY(${((1 - title1) * 60).toFixed(1)}px)`,
          textShadow: `0 4px 30px ${alpha('#000', 0.55)}`,
        }}>
          Livraison offerte
        </div>
        <div style={{
          marginTop: 24, fontFamily: FONT.display, fontWeight: 700, fontSize: 92, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: L.accent, opacity: Math.min(1, title2 * 1.5), transform: `translateY(${((1 - title2) * 40).toFixed(1)}px)`,
        }}>
          dès 20 articles
        </div>
      </div>
      <Grain opacity={0.08} blend="soft-light" />
    </AbsoluteFill>
  );
};
