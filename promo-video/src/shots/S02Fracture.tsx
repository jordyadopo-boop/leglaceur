// S02 · fracture (adapté de Fracture, 9:16) — moitié « sortie » de la démo, utilisée en transition.
// Au drop (impact 1), le graphique figé de S01 (rendu à l'image 58 → public/img/chart-freeze.jpg)
// se fend en 5×8 tuiles qui partent en 3D depuis le point d'impact (la lecture −18 °C) ;
// derrière, le logo Le Glaceur se révèle et tient jusqu'à la fin du plan (≥ 1 s, R1).
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { E, rand } from '../_fixtures/Motion';
import { EASE, FONT, Grain, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha, springAt, type } from '../_fixtures/Look';
import { GlaceurLogo } from '../_fixtures/Brand';

const L = LOOKS.glaceur;
const W = 1080;
const H = 1920;
const NC = 5;
const NR = 8;
const TW = W / NC; // 216
const TH = H / NR; // 240
const IC = 2; // point d'impact : la grande lecture (colonne 2, ligne 1)
const IR = 1;
const BLUR_END = 26;
const FREEZE = staticFile('img/chart-freeze.jpg'); // flou de bougé seulement pendant l'éclatement

const TILES = Array.from({ length: NC * NR }, (_, i) => {
  const r = Math.floor(i / NC);
  const c = i % NC;
  const ang = Math.atan2(r - IR + (rand(i + 310) - 0.5) * 0.9, c - IC + (rand(i + 320) - 0.5) * 0.9);
  const dist = Math.hypot(c - IC, r - IR);
  return {
    r,
    c,
    delay: dist * 0.55,
    exX: Math.cos(ang) * (1300 + rand(i + 330) * 500),
    exY: Math.sin(ang) * (1500 + rand(i + 340) * 500) + 300,
    exZ: 300 + rand(i + 350) * 600,
    rx: (rand(i + 150) - 0.5) * 320,
    ry: (rand(i + 200) - 0.5) * 320,
    rz: (rand(i + 250) - 0.5) * 260,
  };
});

const Tiles: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame > BLUR_END) return null;
  // fissures : les joints s'allument une image avant l'éclatement
  const crack = 1 - ramp(frame, 1, 4, EASE.out);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 1400, perspectiveOrigin: `${(IC + 0.5) * TW}px ${(IR + 0.5) * TH}px` }}>
      {/* garantit le chargement de l'image avant capture (les tuiles l'utilisent en fond) */}
      <Img src={FREEZE} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      {TILES.map((tl, i) => {
        const p = Math.min(1, Math.max(0, (frame - 1 - tl.delay) / 20));
        const k = E.outQuad(p) * 0.35 + E.inQuad(p) * 0.65; // coup sec puis accélération hors champ
        const rx = tl.rx * k;
        const ry = tl.ry * k;
        const facing = Math.abs(Math.cos((rx * Math.PI) / 180) * Math.cos((ry * Math.PI) / 180));
        const shade = (1 - facing) * 0.6;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: tl.c * TW, top: tl.r * TH, width: TW, height: TH, overflow: 'hidden',
              transform: `translate3d(${(tl.exX * k).toFixed(1)}px,${(tl.exY * k).toFixed(1)}px,${(tl.exZ * k).toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${(tl.rz * k).toFixed(2)}deg)`,
              boxShadow: `inset 0 0 0 ${p > 0 ? 1.5 : 1}px ${alpha('#dff2ff', p > 0 ? 0.35 : 0.9 * crack)}`,
            }}
          >
            <div style={{
              position: 'absolute', inset: 0, backgroundImage: `url(${FREEZE})`,
              backgroundSize: `${W}px ${H}px`, backgroundPosition: `${-tl.c * TW}px ${-tl.r * TH}px`,
            }} />
            {shade > 0.004 && <div style={{ position: 'absolute', inset: 0, background: `rgba(1,5,15,${shade.toFixed(3)})` }} />}
          </div>
        );
      })}
    </div>
  );
};

const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const s = springAt(frame, 2, { damping: 14, stiffness: 140 });
  const push = 1 + 0.04 * ramp(frame, 2, 56, EASE.smooth);
  const blur = 14 * (1 - ramp(frame, 2, 9, EASE.out));
  const halo = ramp(frame, 2, 8, EASE.out) * (0.85 + 0.15 * Math.sin(frame / 7));
  const sub = ramp(frame, 12, 12, EASE.out);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${push.toFixed(4)})` }}>
      <div style={{
        position: 'absolute', left: '50%', top: '47%', width: 1200, height: 900, marginLeft: -600, marginTop: -450, opacity: halo,
        background: `radial-gradient(ellipse 50% 42% at 50% 50%, ${alpha(L.light, 0.55)} 0%, ${alpha(L.light, 0)} 70%)`,
      }} />
      <div style={{ transform: `translateY(-60px) scale(${(0.8 + 0.2 * s).toFixed(4)})`, filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined, opacity: Math.min(1, s * 1.6) }}>
        <GlaceurLogo width={900} />
      </div>
      <div style={{
        position: 'absolute', top: 1150, width: '100%', textAlign: 'center', ...type(64, 600, { caps: true }), fontFamily: FONT.display,
        letterSpacing: '0.18em', color: L.ink2, opacity: sub, transform: `translateY(${(1 - sub) * 24}px)`,
      }}>
        Glace alimentaire · Abidjan
      </div>
    </AbsoluteFill>
  );
};

export const FractureReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = 0.55 * (1 - ramp(frame, 0, 7, EASE.out));
  const scene = (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.45 }} fill={{ x: 0.5, y: 1 }} intensity={0.9} breathe={0.4} grain={0}>
        <Reveal />
      </Stage>
      <Tiles />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ background: L.bg[2] }}>
      {frame <= BLUR_END ? <CameraMotionBlur shutterAngle={170} samples={6}>{scene}</CameraMotionBlur> : scene}
      {flash > 0.01 && <AbsoluteFill style={{ background: '#e8f6ff', opacity: flash, mixBlendMode: 'screen' }} />}
      <Grain opacity={0.08} blend="soft-light" />
    </AbsoluteFill>
  );
};
