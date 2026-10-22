// S13 · neon-triple-marquee (adapté de NeonTripleMarquee, 9:16) — L54–L58 : mur de néons en biais, trois
// rangées en sens opposés 24H/24 · 7J/7 · LIVRÉ ; chaque mot passe au centre quand sa rangée s'allume. Chaque rangée s'allume sur son temps (amorçage qui
// grésille puis enveloppe douce), et au 4e temps les trois s'allument ensemble jusqu'à la coupe.
// Tubes éteints toujours visibles : le message reste lisible tout le plan (≈ 2 s, R1). Palette glace.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT as F, Grain, Vignette, ramp, mix } from '../_fixtures/Polish';
import { alpha } from '../_fixtures/Look';
import { beatF } from '../beat';

const FONT = F.display;
const WEIGHT = 800;
const SIZE = 250;
const GAP = SIZE * 0.36;
const PLANE_W = 2100;
const FLOOR_Y = 900;
const ROW_Y = [40, 330, 620];
const WALL = '#050c1c';
const at = (k: number) => beatF(54 + k) - beatF(54);

const BRICK = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='120'>" +
  "<g stroke='rgba(190,225,255,0.05)' stroke-width='3'>" +
  "<line x1='0' y1='1.5' x2='300' y2='1.5'/><line x1='0' y1='61.5' x2='300' y2='61.5'/>" +
  "<line x1='1.5' y1='0' x2='1.5' y2='60'/><line x1='151.5' y1='0' x2='151.5' y2='60'/>" +
  "<line x1='76.5' y1='60' x2='76.5' y2='120'/><line x1='226.5' y1='60' x2='226.5' y2='120'/></g></svg>",
)}")`;

// largeur mesurée (sans cache : la police peut finir de charger après le premier appel)
const measure = (text: string) => {
  if (typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.font = `${WEIGHT} ${SIZE}px ${FONT}`;
      return ctx.measureText(text).width + text.length * SIZE * 0.02;
    }
  }
  return text.length * SIZE * 0.5;
};

type Row = { word: string; color: string; core: string; dir: 1 | -1; speed: number };
const ROWS: Row[] = [
  { word: '24H/24', color: '#38d9ff', core: '#e9fbff', dir: 1, speed: 9 },
  { word: '7J/7', color: '#4d8dff', core: '#e6efff', dir: -1, speed: 11 },
  { word: 'LIVRÉ', color: '#9fe8ff', core: '#ffffff', dir: 1, speed: 9 },
];

const IGNITE = [0, 1, 0.15, 0, 0.9, 0.6];
const ignite = (f: number, a: number) => {
  const k = Math.floor(f - a);
  if (k < 0) return 0;
  return k < IGNITE.length ? IGNITE[k] : 1;
};
// rangée i allumée de at(i) à at(i+1)+2 ; toutes ensemble à partir de at(3)
const pulse = (f: number, i: number) => {
  if (f >= at(3)) return ignite(f, at(3));
  const a = at(i), len = at(i + 1) - a + 2;
  const ph = f - a;
  if (ph < 0 || ph >= len) return 0;
  const up = ignite(f, a);
  const down = 1 - ramp(ph, len - 5, 5, EASE.exit);
  return up * down;
};

const MarqueeRow: React.FC<{ row: Row; f: number; mid: number; y: number; lit: number; glass: number; cheap?: boolean }> = ({ row, f, mid, y, lit, glass, cheap }) => {
  const wordW = measure(row.word);
  const dotW = SIZE * 0.42;
  const unitW = wordW + GAP + dotW + GAP;
  const copies = Math.ceil(PLANE_W / unitW) + 3;
  // phase calée pour qu'une copie soit centrée à l'écran au milieu de son temps
  const target = PLANE_W / 2 - wordW / 2;
  const m = (((row.dir * (f - mid) * row.speed + target) % unitW) + unitW) % unitW;
  const offset = m - unitW * 2;
  const base: React.CSSProperties = {
    position: 'absolute', top: y, left: 0, width: PLANE_W, height: SIZE * 1.05,
    transform: `translateX(${offset.toFixed(2)}px)`,
    fontFamily: FONT, fontWeight: WEIGHT, fontSize: SIZE, letterSpacing: '0.02em', lineHeight: 1, color: 'transparent',
  };
  const text = (sep: string, bw: number) => Array.from({ length: copies }).map((_, i) => (
    <span key={i} style={{ position: 'absolute', left: i * unitW, top: 0, whiteSpace: 'nowrap' }}>
      {row.word}
      <span style={{
        position: 'absolute', left: wordW + GAP + dotW * 0.2, top: SIZE * 0.34, width: dotW * 0.6, height: dotW * 0.6,
        transform: 'rotate(45deg)', boxSizing: 'border-box', border: `${bw.toFixed(2)}px solid ${sep}`, borderRadius: 6,
      }} />
    </span>
  ));
  const tube = 6 + lit * 4;
  const core = 2 + lit * 1.8;
  return (
    <>
      <div style={{ ...base, WebkitTextStroke: `6px ${alpha(row.color, 0.32 * glass)}` }}>{text(alpha(row.color, 0.32 * glass), 6)}</div>
      {lit > 0.02 && (
        <>
          <div style={{
            ...base, WebkitTextStroke: `${tube.toFixed(2)}px ${row.color}`, opacity: Math.min(1, lit * 1.1),
            filter: cheap ? undefined : `drop-shadow(0 0 ${(3 + lit * 6).toFixed(1)}px ${row.color}) drop-shadow(0 0 ${(14 + lit * 22).toFixed(1)}px ${row.color}) drop-shadow(0 0 ${(40 + lit * 50).toFixed(1)}px ${alpha(row.color, 0.9)})`,
          }}>{text(row.color, tube)}</div>
          <div style={{ ...base, WebkitTextStroke: `${core.toFixed(2)}px ${row.core}`, opacity: Math.min(1, lit * 1.3), filter: cheap ? undefined : `drop-shadow(0 0 2px ${alpha(row.core, 0.9)})` }}>
            {text(row.core, core)}
          </div>
        </>
      )}
    </>
  );
};

export const NeonHours: React.FC = () => {
  const f = useCurrentFrame();
  const glass = ROWS.map((_, i) => ignite(f, i * 3));
  const lit = ROWS.map((_, i) => pulse(f, i));
  const cam = ramp(f, 0, 59, EASE.smooth);
  const rotY = mix(-15, -9, cam);
  const scale = mix(1.0, 1.05, cam);
  const cap = ramp(f, 6, 10, EASE.out);

  return (
    <AbsoluteFill style={{ background: '#02060f', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, perspective: 1500, perspectiveOrigin: '50% 45%' }}>
        <div style={{
          position: 'absolute', left: (1080 - PLANE_W) / 2, top: 330, width: PLANE_W, height: 1200,
          transform: `rotateY(${rotY.toFixed(3)}deg) scale(${scale.toFixed(4)})`, transformOrigin: '50% 40%',
        }}>
          <div style={{ position: 'absolute', left: 0, top: -400, width: PLANE_W, height: FLOOR_Y + 400, background: WALL, backgroundImage: BRICK, backgroundSize: '300px 120px' }} />
          {ROWS.map((r, i) => (
            <div key={`spill${i}`} style={{
              position: 'absolute', left: 0, right: 0, top: ROW_Y[i] - 200, height: SIZE + 400, mixBlendMode: 'screen',
              background: `radial-gradient(ellipse 50% 44% at 50% 50%, ${alpha(r.color, 0.6)} 0%, ${alpha(r.color, 0.12)} 45%, ${alpha(r.color, 0)} 72%)`,
              opacity: 0.05 * glass[i] + lit[i] * 0.5,
            }} />
          ))}
          {ROWS.map((r, i) => <MarqueeRow key={r.word} row={r} f={f} mid={at(i) + 7} y={ROW_Y[i]} lit={lit[i]} glass={glass[i]} />)}
          <div style={{ position: 'absolute', left: 0, top: FLOOR_Y, width: PLANE_W, height: 340, background: 'linear-gradient(180deg, #040a18 0%, #02050c 100%)' }} />
          <div style={{
            position: 'absolute', left: 0, top: FLOOR_Y, width: PLANE_W, height: 300, overflow: 'hidden',
            WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(3px)',
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: PLANE_W, height: 600, transform: 'scaleY(-1)', transformOrigin: '50% 50%' }}>
              <MarqueeRow row={ROWS[2]} f={f} mid={at(2) + 7} y={ROW_Y[2] - 300} lit={lit[2]} glass={glass[2]} cheap />
            </div>
          </div>
          {ROWS.map((r, i) => (
            <div key={`pool${i}`} style={{
              position: 'absolute', left: 0, right: 0, top: FLOOR_Y - 40, height: 220, mixBlendMode: 'screen',
              background: `radial-gradient(ellipse 46% 40% at 50% 30%, ${alpha(r.color, 0.55)} 0%, ${alpha(r.color, 0)} 70%)`,
              opacity: lit[i] * [0.18, 0.28, 0.5][i],
            }} />
          ))}
          <div style={{ position: 'absolute', left: 0, top: FLOOR_Y, width: PLANE_W, height: 2, background: 'rgba(200,230,255,0.07)' }} />
        </div>
      </div>
      <Vignette strength={0.6} inner={0.4} color="#01040b" />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 1600, textAlign: 'center', opacity: cap, transform: `translateY(${((1 - cap) * 24).toFixed(1)}px)`,
        fontFamily: F.display, fontWeight: 600, fontSize: 60, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bfe4ff',
      }}>
        Commande en ligne, à toute heure
      </div>
      <Grain opacity={0.08} blend="soft-light" />
    </AbsoluteFill>
  );
};
