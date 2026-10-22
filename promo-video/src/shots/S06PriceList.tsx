// S06 · beat-step-list-theme-cycle (adapté, 9:16) — la liste des produits monte d'une ligne par temps,
// la capsule centrale « attrape » chaque produit et change de teinte glacée ; le fond et le prix
// suivent la même horloge. 6 lignes, 5 pas sur les temps L23–L27, tenue sur le dernier.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, SpeedBlur, Vignette, mix, ramp, velocity } from '../_fixtures/Polish';
import { TextReveal, alpha } from '../_fixtures/Look';
import { GlaceurMark } from '../_fixtures/Brand';
import { beatF } from '../beat';

const A = 22; // premier temps du plan
const bt = (k: number) => beatF(A + k) - beatF(A); // image locale du temps k
const ROW_H = 168;
const FS = 112;
const CY = 720;
const PILL_X = 80;
const PILL_W = 920;
const PILL_H = 150;
const PAD = 56;
const JUMP = 6;

type Row = { name: string; price: string; unit: string; pill: string; bg: string; ink: string };
const ROWS: Row[] = [
  { name: 'Glace cubique', price: '750', unit: 'le pack 5 kg', pill: '#e6f6ff', bg: '#06142e', ink: '#04122b' },
  { name: 'Glace en grain', price: '750', unit: 'le pack 5 kg', pill: '#8ecfff', bg: '#071a3a', ink: '#04122b' },
  { name: 'Glace pilée', price: '3 000', unit: 'le sac 50 kg', pill: '#6db3ff', bg: '#0a1f44', ink: '#03102a' },
  { name: 'Carboglace', price: '7 500', unit: 'le kilo · −78,5 °C', pill: '#ffffff', bg: '#020812', ink: '#020812' },
  { name: 'Ice Cup', price: '250', unit: 'le gobelet', pill: '#5ee3e0', bg: '#03182a', ink: '#022426' },
  { name: 'Barres 5 · 10 kg', price: '350 · 650', unit: 'la barre', pill: '#2f8cf2', bg: '#0f2c5e', ink: '#f3faff' },
];
const N = ROWS.length - 1; // 5 pas
const PAD_ROWS = 2; // lignes vides au-dessus pour l'entrée

const snap = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3.2);
const hex = (a: string) => [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
const mixRgb = (a: string, b: string, t: number) => hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t));
const css = (c: number[], a = 1) => `rgba(${c.join(',')},${a.toFixed(3)})`;
const lighten = (c: number[], k: number) => c.map((v) => Math.round(v + (255 - v) * k));
const darken = (c: number[], k: number) => c.map((v) => Math.round(v * (1 - k)));

const clock = (f: number) => {
  let beat = 0;
  for (let k = 1; k <= N; k++) if (f >= bt(k)) beat = k;
  const t = beat === 0 ? 1 : snap((f - bt(beat)) / JUMP);
  return { beat, t, step: beat === 0 ? 0 : beat - 1 + t, since: beat === 0 ? 99 : f - bt(beat) };
};

export const PriceList: React.FC = () => {
  const frame = useCurrentFrame();
  const { beat, t, step, since } = clock(frame);
  const listY = -step * ROW_H;
  const vy = velocity((f) => -clock(f).step * ROW_H, frame);
  const prev = ROWS[Math.max(0, beat - 1)];
  const now = ROWS[beat];
  const m = beat === 0 ? 1 : t;
  const pill = mixRgb(prev.pill, now.pill, m);
  const bg = mixRgb(prev.bg, now.bg, m);
  const bgColor = css(bg);
  const sy = beat === 0 ? 1 : interpolate(t, [0, 0.6, 1], [1.14, 0.96, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sx = beat === 0 ? 1 : interpolate(t, [0, 0.6, 1], [0.97, 1.01, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hit = beat === 0 ? 0 : Math.exp(-since / 3.2);
  const open = ramp(frame, 0, 12, EASE.snappy);
  const listIn = ramp(frame, 0, 12, EASE.out);
  const pos = step; // ligne au centre
  const cam = mix(1, 1.03, ramp(frame, 0, 88, EASE.smooth));
  const listTop = CY - ROW_H / 2;

  const rowStyle: React.CSSProperties = {
    position: 'absolute', height: ROW_H, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
    fontFamily: FONT.display, fontWeight: 800, fontSize: FS, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.005em', transformOrigin: '0% 50%',
  };

  // Prix : roule d'une case par temps sous la capsule
  const priceRoll = -(beat - 1 + (beat === 0 ? 1 : t)) * 200;

  return (
    <AbsoluteFill style={{ background: bgColor, overflow: 'hidden', fontFamily: FONT.sans }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse 80% 45% at 50% ${(CY / 1920) * 100}%, ${css(pill, 0.2 + 0.08 * hit)} 0%, ${css(pill, 0.05)} 50%, ${css(pill, 0)} 78%),` +
          'radial-gradient(ellipse 70% 40% at 15% 0%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 70%)',
      }} />
      <AbsoluteFill style={{ transform: `scale(${cam})`, transformOrigin: `540px ${CY}px` }}>
        <SpeedBlur vx={0} vy={vy} amount={0.16} max={9}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: listTop, transform: `translateY(${(listY + (1 - listIn) * 60).toFixed(2)}px)` }}>
            {ROWS.map((r, i) => {
              const d = Math.abs(i - pos);
              const op = Math.max(0, 0.45 - 0.13 * Math.max(0, d - 1)) * listIn;
              const sc = 1 - Math.min(0.14, 0.05 * Math.max(0, d - 0.5));
              const blur = Math.max(0, d - 1.5) * 3;
              return (
                <span key={r.name} style={{
                  ...rowStyle, top: i * ROW_H, left: PILL_X + PAD, color: `rgba(243,250,255,${op.toFixed(3)})`,
                  transform: `scale(${sc.toFixed(4)})`, filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined,
                }}>{r.name}</span>
              );
            })}
          </div>
        </SpeedBlur>
        {/* capsule = lentille : copie découpée de la liste, encre foncée */}
        <div style={{
          position: 'absolute', left: PILL_X, top: CY - PILL_H / 2, width: PILL_W, height: PILL_H, borderRadius: PILL_H / 2, overflow: 'hidden',
          transformOrigin: '0% 50%', transform: `scale(${(sx * mix(0.4, 1, open)).toFixed(4)}, ${sy.toFixed(4)})`, opacity: Math.min(1, open * 2.5),
          background: `linear-gradient(180deg, ${css(lighten(pill, 0.16 + 0.07 * hit))} 0%, ${css(lighten(pill, 0.03 * hit))} 50%, ${css(darken(pill, 0.1))} 100%)`,
          boxShadow: `inset 0 2px 0 rgba(255,255,255,0.5), 0 3px 6px rgba(0,0,0,0.35), 0 30px 90px -20px ${css(pill, 0.5 + 0.25 * hit)}, 0 0 ${(40 + 60 * hit).toFixed(1)}px ${css(pill, 0.18 + 0.2 * hit)}`,
        }}>
          <SpeedBlur vx={0} vy={vy} amount={0.16} max={9}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: PILL_H / 2 - ROW_H / 2, transform: `translateY(${listY.toFixed(2)}px)` }}>
              {ROWS.map((r, i) => <span key={r.name} style={{ ...rowStyle, top: i * ROW_H, left: PAD, color: r.ink }}>{r.name}</span>)}
            </div>
          </SpeedBlur>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: PILL_H * 0.45, background: 'linear-gradient(rgba(255,255,255,0.18), rgba(255,255,255,0))' }} />
        </div>
      </AbsoluteFill>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 380, background: `linear-gradient(${bgColor} 40%, ${css(bg, 0)})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1000, bottom: 0, background: `linear-gradient(${css(bg, 0)}, ${bgColor} 22%)` }} />

      {/* en-tête */}
      <div style={{ position: 'absolute', left: 80, top: 150, display: 'flex', alignItems: 'center', gap: 22, opacity: ramp(frame, 0, 10, EASE.out) }}>
        <GlaceurMark size={84} tone="dark" />
        <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 64, letterSpacing: '0.16em', color: '#f3faff' }}>NOS PRIX</span>
      </div>
      <div style={{ position: 'absolute', right: 80, top: 162, display: 'flex', alignItems: 'baseline', gap: 12, fontFamily: FONT.display, fontWeight: 800, fontSize: 64, fontVariantNumeric: 'tabular-nums', opacity: ramp(frame, 0, 10, EASE.out) }}>
        <span style={{ display: 'inline-block', height: 70, overflow: 'hidden', color: '#fff' }}>
          <span style={{ display: 'block', transform: `translateY(${((priceRoll / 200) * 70).toFixed(2)}px)` }}>
            {ROWS.map((_, k) => <span key={k} style={{ display: 'block', height: 70, lineHeight: '70px' }}>{String(k + 1).padStart(2, '0')}</span>)}
          </span>
        </span>
        <span style={{ color: 'rgba(243,250,255,0.45)' }}>/ 06</span>
      </div>

      {/* prix : rouleau vertical synchronisé */}
      <div style={{ position: 'absolute', left: 80, right: 80, top: 1110, opacity: ramp(frame, 3, 10, EASE.out) }}>
        <div style={{ fontSize: 58, fontWeight: 600, color: 'rgba(191,228,255,0.8)', letterSpacing: '0.04em' }}>Prix</div>
        <div style={{ height: 200, overflow: 'hidden', marginTop: 6 }}>
          <div style={{ transform: `translateY(${priceRoll.toFixed(2)}px)` }}>
            {ROWS.map((r) => (
              <div key={r.name} style={{ height: 200, display: 'flex', alignItems: 'baseline', gap: 22 }}>
                <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 190, lineHeight: '200px', color: '#f3faff' }}>{r.price}</span>
                <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 84, color: css(lighten(pill, 0.2)) }}>F</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 76, overflow: 'hidden' }}>
          <div style={{ transform: `translateY(${((priceRoll / 200) * 76).toFixed(2)}px)` }}>
            {ROWS.map((r) => <div key={r.name} style={{ height: 76, fontSize: 64, fontWeight: 600, color: '#bfe4ff' }}>{r.unit}</div>)}
          </div>
        </div>
      </div>

      {/* pastilles de progression */}
      <div style={{ position: 'absolute', left: 80, top: 1560, display: 'flex', gap: 20 }}>
        {ROWS.map((r, k) => {
          const cur = k === beat;
          const pop = cur && beat > 0 ? interpolate(t, [0, 0.6, 1], [0.7, 1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
          return <div key={k} style={{
            width: 46, height: 46, borderRadius: 23, background: r.pill, transform: `scale(${((cur ? 1 : 0.62) * pop).toFixed(4)})`,
            opacity: cur ? 1 : k < beat ? 0.55 : 0.3, boxShadow: cur ? `0 0 0 5px ${bgColor}, 0 0 0 7px rgba(255,255,255,0.85), 0 0 30px ${alpha(r.pill, 0.6)}` : 'none',
          }} />;
        })}
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 1660, fontSize: 64, fontWeight: 700, color: '#f3faff' }}>
        <TextReveal text="Livraison ou retrait" by="word" variant="rise" start={bt(N) + 2} each={10} gap={2} />
      </div>
      <Vignette strength={0.45} inner={0.45} color="#020306" />
      <Grain opacity={0.08} blend="soft-light" />
    </AbsoluteFill>
  );
};
