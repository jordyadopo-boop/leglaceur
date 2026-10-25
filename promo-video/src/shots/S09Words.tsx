// S09 · flying-words (adapté de FlyingWords, 9:16) — tunnel de mots d'usage qui foncent vers la caméra
// (L36–L40) : anneaux de tunnel, flux de poussière en traits, mots en profondeur avec traînée directionnelle.
// Au premier plan, tenu ≥ 1,5 s : « ET AUSSI · MÉNAGES & USAGES PROS » — complète la liste des secteurs.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha, springAt } from '../_fixtures/Look';
import { GlaceurMark } from '../_fixtures/Brand';
import { rand } from '../_fixtures/Motion';

const L = LOOKS.glaceur;
const WORDS = ['Restaurants', 'Cocktails', 'Bars', 'Fêtes', 'Poissonneries', 'Sodas', 'Jus frais', 'Lounges',
  'Événements', 'Mariages', 'Boissons', 'Glace en grain', 'Glaçons', 'Fraîcheur', 'Whisky', 'Concerts', 'Apéros', 'Glace pilée'];
const N = WORDS.length;
const ACCENT = new Set([5, 11, 13]);
const INKS = [L.ink, L.ink2, L.ink3];
const SPEED = 1 / 46; // une traversée ≈ 46 images
const P = 4400;
const Z0 = -7000;
const Z1 = 3200;
const CX = 540;
const CY = 860;

const ITEMS = WORDS.map((w, i) => {
  const a = i * 2.39996 + rand(i * 7 + 1) * 0.8;
  const r = 260 + rand(i * 13 + 2) * 420;
  const accent = ACCENT.has(i);
  return {
    text: w, accent, size: 70 + rand(i + 3) * 50,
    color: accent ? L.accent2 : INKS[Math.floor(rand(i + 5) * 3)],
    x: Math.cos(a) * r * 0.75, y: Math.sin(a) * r * 1.25, rz: (rand(i + 21) - 0.5) * 10, ph: i / N,
  };
});
const DUST = Array.from({ length: 60 }, (_, i) => {
  const a = i * 2.39996 + rand(i * 5 + 77) * 1.2;
  const r = 140 + rand(i * 3 + 91) * 1300;
  return { x: Math.cos(a) * r * 0.6, y: Math.sin(a) * r, ph: rand(i * 9 + 13), w: 1 + rand(i + 50) * 1.6 };
});
const RINGS = Array.from({ length: 8 }, (_, k) => ({ ph: k / 8 }));

const OP = [0, 1, 0.55, 0.25, 0];
const OT = [0, 0.25, 0.6, 0.85, 1];
const curve = (u: number) => {
  for (let k = 0; k < 4; k++) if (u <= OT[k + 1]) return OP[k] + ((OP[k + 1] - OP[k]) * (u - OT[k])) / (OT[k + 1] - OT[k]);
  return 0;
};
const project = (x: number, y: number, u: number, roll: number, drift = true) => {
  const z = Z0 + (Z1 - Z0) * u;
  const d = drift ? 0.5 + u * 1.35 : 1;
  const s = P / (P - z);
  const c = Math.cos(roll), sn = Math.sin(roll);
  const rx = x * c - y * sn, ry = x * sn + y * c;
  return { sx: CX + rx * d * s, sy: CY + ry * d * s, s };
};

export const SectorWords: React.FC = () => {
  const frame = useCurrentFrame();
  const roll = (2 * Math.PI / 180) * Math.sin(frame / 30);
  const uOf = (ph: number, f = frame) => (((f * SPEED + ph) % 1) + 1) % 1;
  const glowB = 0.82 + 0.14 * Math.sin(frame / 5);
  const s1 = springAt(frame, 3, { damping: 13, stiffness: 150 });
  const s2 = springAt(frame, 9, { damping: 13, stiffness: 150 });
  const eyebrow = ramp(frame, 1, 8, EASE.out);

  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.45 }} fill={null} intensity={0.55} vignette={0.7} grain={0}>
        <div style={{
          position: 'absolute', left: CX - 420, top: CY - 560, width: 840, height: 1120, borderRadius: '50%', opacity: glowB,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(L.light, 0.42)} 0%, ${alpha(L.light, 0.12)} 38%, ${alpha(L.light, 0)} 70%)`,
        }} />
      </Stage>

      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {RINGS.map((rg, k) => {
          const u = uOf(rg.ph);
          const p = project(0, 0, u, roll, false);
          const ry = 1150 * p.s;
          const op = Math.min(1, u / 0.3) * (1 - Math.min(1, Math.max(0, (u - 0.55) / 0.3)));
          if (op <= 0.01) return null;
          return <ellipse key={`r${k}`} cx={CX} cy={CY} rx={ry * 0.6} ry={ry} fill="none" stroke={L.accent}
            strokeOpacity={op * 0.18} strokeWidth={1 + p.s * 0.8} transform={`rotate(${(roll * 180) / Math.PI} ${CX} ${CY})`} />;
        })}
        {DUST.map((d, i) => {
          const u = uOf(d.ph);
          const a = project(d.x, d.y, Math.max(0, u - SPEED * 2.6), roll);
          const b = project(d.x, d.y, u, roll);
          const op = curve(u) * 0.75;
          if (op <= 0.01) return null;
          return <line key={`d${i}`} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#dff2ff" strokeOpacity={op}
            strokeWidth={d.w * Math.min(2.4, b.s)} strokeLinecap="round" />;
        })}
      </svg>

      {ITEMS.map((it, i) => {
        const u = uOf(it.ph);
        const p = project(it.x, it.y, u, roll);
        const q = project(it.x, it.y, Math.max(0, u - SPEED), roll);
        const vx = p.sx - q.sx, vy = p.sy - q.sy;
        // zone du titre (ellipse) : les mots qui la traversent sont atténués
        const k = ((p.sx - CX) / 950) ** 2 + ((p.sy - (CY - 70)) / 330) ** 2;
        const occl = k < 1 ? k ** 4 : 1;
        const op = curve(u) * occl;
        if (op <= 0.005) return null;
        const blur = (u < 0.22 ? (1 - u / 0.22) * 2.2 : 0) + (u > 0.86 ? (u - 0.86) * 60 : 0);
        const trail = Math.hypot(vx, vy) > 6
          ? [1, 2, 3, 4, 5, 6].map((j) => {
            const kk = (j / 6) * 0.9 / p.s;
            return `${(-vx * kk).toFixed(1)}px ${(-vy * kk).toFixed(1)}px ${(j * 0.8).toFixed(1)}px ${alpha(it.color, 0.2 - j * 0.026)}`;
          }).join(', ')
          : '';
        const glowS = it.accent ? `0 0 18px ${alpha(L.accent, 0.55)}, 0 0 48px ${alpha(L.accent, 0.3)}` : '';
        return (
          <div key={i} style={{
            position: 'absolute', left: p.sx, top: p.sy, whiteSpace: 'nowrap', lineHeight: 1,
            transform: `translate(-50%,-50%) scale(${p.s.toFixed(4)}) rotate(${it.rz + (roll * 180) / Math.PI}deg)`,
            fontFamily: FONT.display, fontWeight: 700, fontSize: it.size, textTransform: 'uppercase', letterSpacing: '0.01em',
            color: it.color, opacity: op, textShadow: [glowS, trail].filter(Boolean).join(', ') || undefined,
            filter: blur > 0.05 ? `blur(${(blur / Math.max(0.6, p.s)).toFixed(2)}px)` : undefined,
          }}>
            {it.text}
          </div>
        );
      })}

      {/* Premier plan : tenu de l'image 3 à la fin (≈ 1,9 s) */}
      <div style={{
        position: 'absolute', left: CX - 560, top: CY - 330, width: 1120, height: 660, borderRadius: '50%',
        background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha('#020817', 0.75)} 0%, ${alpha('#020817', 0.4)} 45%, ${alpha('#020817', 0)} 72%)`,
      }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: CY - 230, textAlign: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, opacity: eyebrow,
          fontFamily: FONT.display, fontWeight: 600, fontSize: 60, letterSpacing: '0.24em', color: L.accent2,
        }}>
          <GlaceurMark size={56} tone="dark" />
          <span>ET AUSSI</span>
        </div>
        <div style={{
          marginTop: 22, fontFamily: FONT.display, fontWeight: 800, fontSize: 176, lineHeight: 0.95, textTransform: 'uppercase',
          color: L.ink, opacity: Math.min(1, s1 * 1.5), transform: `translateY(${((1 - s1) * 60).toFixed(1)}px) scale(${(0.9 + 0.1 * s1).toFixed(4)})`,
          textShadow: `0 4px 40px ${alpha('#000', 0.6)}`,
        }}>
          Ménages
        </div>
        <div style={{
          marginTop: 14, fontFamily: FONT.display, fontWeight: 700, fontSize: 100, lineHeight: 1, textTransform: 'uppercase',
          color: L.accent, opacity: Math.min(1, s2 * 1.5), transform: `translateY(${((1 - s2) * 50).toFixed(1)}px)`,
          textShadow: `0 0 30px ${alpha(L.accent, 0.45)}, 0 4px 30px ${alpha('#000', 0.6)}`,
        }}>
          & usages pros
        </div>
      </div>
      <Grain opacity={0.08} blend="soft-light" />
    </AbsoluteFill>
  );
};
