// S03 · gradient-word-sweep (adapté de GradientWordSweep v3, 9:16).
// Tagline « La fraîcheur sous toutes ses formes » : le mot chargé « fraîcheur » se remplit d'un
// dégradé glace (bleus de la marque) d'un balayage rapide, avec traîne lumineuse au front d'onde,
// puis quelques arcs de givre fins (bleu glacier, ≤ 1 à l'écran) — 4 éclairs programmés, pas aléatoires.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { EASE, FONT, Grain, Vignette, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, type } from '../_fixtures/Look';

const L = LOOKS.glaceur;
const WORD = 'fraîcheur';
const mulberry32 = (a: number) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Dégradé « glace » de la marque : bleu → bleu clair → givre → blanc.
const GRAD = 'linear-gradient(92deg, #2f8cf2 0%, #6db3ff 30%, #8ecfff 58%, #e6f6ff 100%)';

const FILL_START = 6;
const FILL_END = 22; // balayage rapide, ~0,5 s
const LIGHT_START = FILL_END + 3;

// ---------- 种子化噪声与闪电 ----------
const rand = mulberry32(20261022);
const FLICKER: number[] = Array.from({ length: 160 }, () => rand());

type Bolt = { d: string; long: boolean };
const makeLongBolt = (r: () => number): Bolt => {
  // 词上方勾连长弧：横跨若干字符，锯齿折线
  const x0 = 30 + r() * 220;
  const x1 = x0 + 160 + r() * 320;
  const yBase = 38 + r() * 42;
  const n = 7 + Math.floor(r() * 4);
  let d = `M ${x0.toFixed(1)} ${(yBase + 26 + r() * 20).toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n + (r() - 0.5) * 22;
    const arch = Math.sin((i / n) * Math.PI) * -22; // 中段拱起
    const y = yBase + arch + (r() - 0.5) * 30 + (i === n ? 30 + r() * 18 : 0);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return { d, long: true };
};
const makeShortBolt = (r: () => number): Bolt => {
  // 字符之间的短勾连：竖向小锯齿
  const x = 60 + r() * 540;
  const y0 = 72 + r() * 24;
  const y1 = y0 + 55 + r() * 45;
  const n = 4 + Math.floor(r() * 3);
  let d = `M ${x.toFixed(1)} ${y0.toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    const xx = x + (r() - 0.5) * 30;
    d += ` L ${xx.toFixed(1)} ${y.toFixed(1)}`;
  }
  return { d, long: false };
};

const BOLTS: Bolt[] = Array.from({ length: 16 }, (_, i) =>
  i % 3 === 0 ? makeShortBolt(rand) : makeLongBolt(rand),
);
// 闪烁事件：排期而非随机——稀疏零星（同屏 ≤1 道、间隔 ≥9f），末次约 92f 熄灭，留出落定呼吸
type Flash = { at: number; life: number; bolt: number };
const FLASH_AT = [1, 9, 17, 25];
const FLASHES: Flash[] = FLASH_AT.map((d, k) => ({
  at: LIGHT_START + d,
  life: k === FLASH_AT.length - 1 ? 3 : 3 + Math.floor(rand() * 2),
  bolt: (k * 5 + 1) % BOLTS.length,
}));

// 外扩盒：带模糊的辉光层放进四周外扩 PAD 的盒子，mask 不再把溢出的光切成矩形
const PAD = 90;
// 文字坐标里的百分比 x → 外扩盒里的 mask 色标
const at = (x: number) => `calc(${PAD}px + (100% - ${PAD * 2}px) * ${(Math.max(-20, Math.min(120, x)) / 100).toFixed(4)})`;
const Halo: React.FC<{ mask?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ mask, style, children }) => (
  <span
    aria-hidden
    style={{
      position: 'absolute',
      left: -PAD,
      top: -PAD,
      right: -PAD,
      bottom: -PAD,
      padding: PAD,
      ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : {}),
      ...style,
    }}
  >
    <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>{children}</span>
  </span>
);

const alpha2 = 'rgba(243,250,255,0.18)'; // mot non chargé : contour fantôme avant le balayage

export const TaglineSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const enter0 = ramp(frame, -5, 12, EASE.snappy);
  const enter1 = ramp(frame, -3, 12, EASE.snappy);
  const enter2 = ramp(frame, 3, 12, EASE.snappy);
  const enter3 = ramp(frame, 6, 12, EASE.snappy);
  const lineIn = (e: number): React.CSSProperties => ({
    opacity: e,
    transform: `translateY(${(1 - e) * 40}px)`,
    filter: e < 0.999 ? `blur(${((1 - e) * 10).toFixed(2)}px)` : undefined,
  });
  const push = 1 + 0.03 * ramp(frame, 0, 58, EASE.smooth);

  const p = interpolate(frame, [FILL_START, FILL_END], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad),
  });
  const pPct = p * 100;
  const filling = frame >= FILL_START && frame <= FILL_END + 4;
  const headFade = interpolate(frame, [FILL_END, FILL_END + 6], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const trailFade = interpolate(frame, [FILL_END, FILL_END + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const TRAIL = 34;
  const trailMask =
    `linear-gradient(90deg, transparent 0%, transparent ${at(pPct - TRAIL)}, ` +
    `rgba(0,0,0,0.9) ${at(pPct - 3)}, rgba(0,0,0,0.9) ${at(pPct + 1)}, transparent ${at(pPct + 6)})`;
  const headMask =
    `linear-gradient(90deg, transparent 0%, transparent ${at(pPct - 12)}, #000 ${at(pPct - 6)}, ` +
    `#000 ${at(pPct - 1)}, transparent ${at(pPct + 2)})`;
  const noise = FLICKER[Math.min(frame, FLICKER.length - 1)];
  const active = FLASHES.filter((f) => frame >= f.at && frame < f.at + f.life);
  const glowLvl =
    interpolate(frame, [FILL_START, FILL_END], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (0.82 + 0.18 * noise) +
    (active.length > 0 ? 0.3 : 0);
  const softMask = (soft: number): string | undefined =>
    p >= 1 ? undefined : `linear-gradient(90deg, #000 0%, #000 ${at(pPct - soft)}, transparent ${at(pPct + soft * 0.6)})`;

  const wordStyle: React.CSSProperties = {
    fontFamily: FONT.display, fontWeight: 800, fontSize: 220, letterSpacing: '-0.01em', lineHeight: 1.05,
    color: '#ffffff', whiteSpace: 'nowrap', textTransform: 'uppercase',
  };
  const small: React.CSSProperties = { ...type(118, 700), fontFamily: FONT.display, textTransform: 'uppercase', color: L.ink, lineHeight: 1.1, letterSpacing: '0.02em' };
  const gradText: React.CSSProperties = {
    position: 'absolute', inset: 0, backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  };

  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.42 }} fill={{ x: 0.2, y: 0.95 }} intensity={0.75} breathe={0.4} grain={0} vignette={0} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push})` }}>
        <div style={{
          position: 'absolute', left: 90, top: 700, width: 900, height: 420, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(110,180,255,0.6), rgba(142,207,255,0.22) 55%, transparent 78%)',
          filter: 'blur(40px)', opacity: 0.5 * glowLvl,
        }} />
      </div>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: `scale(${push})` }}>
        <div style={{ ...small, color: L.ink2, ...lineIn(enter0) }}>La</div>
        <div style={{ ...wordStyle, ...lineIn(enter1) }}>
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ color: alpha2 }}>{WORD}</span>
            <Halo mask={softMask(14)} style={{ opacity: 0.5 * glowLvl }}>
              <span style={{ ...gradText, filter: 'blur(46px) saturate(1.5)', transform: 'scale(1.05)' }}>{WORD}</span>
            </Halo>
            <Halo mask={softMask(10)} style={{ opacity: 0.58 * glowLvl }}>
              <span style={{ ...gradText, filter: 'blur(18px) saturate(1.3) brightness(1.15)' }}>{WORD}</span>
            </Halo>
            <Halo mask={softMask(7)} style={{ opacity: 0.68 * Math.min(1, glowLvl + 0.1) }}>
              <span style={{ ...gradText, filter: 'blur(6px) brightness(1.2)' }}>{WORD}</span>
            </Halo>
            <span aria-hidden style={{ ...gradText, clipPath: `inset(-25% ${100 - pPct}% -25% 0)` }}>{WORD}</span>
            {trailFade > 0.01 && (
              <Halo mask={trailMask} style={{ opacity: 0.95 * trailFade }}>
                <span style={{ ...gradText, filter: 'blur(9px) saturate(1.6) brightness(1.7)' }}>{WORD}</span>
              </Halo>
            )}
            {filling && p < 1 && (
              <Halo mask={headMask} style={{ opacity: 0.9 * headFade }}>
                <span style={{ position: 'absolute', inset: 0, color: '#fff', filter: 'blur(3px)', textShadow: '0 0 22px rgba(255,255,255,0.9), 0 0 55px rgba(142,207,255,0.85)' }}>{WORD}</span>
              </Halo>
            )}
            <svg aria-hidden viewBox="0 0 700 240" style={{ position: 'absolute', left: -20, top: -60, width: '104%', height: 340, overflow: 'visible', pointerEvents: 'none' }} preserveAspectRatio="none">
              {active.map((f, i) => {
                const b = BOLTS[f.bolt];
                const decay = 1 - (frame - f.at) / f.life;
                return (
                  <g key={`${f.at}-${i}`} opacity={Math.min(1, 1.1 * decay)}>
                    <path d={b.d} fill="none" stroke="rgba(60,150,255,0.6)" strokeWidth={b.long ? 6 : 4.5} style={{ filter: 'blur(6px)' }} />
                    <path d={b.d} fill="none" stroke="rgba(142,207,255,0.9)" strokeWidth={b.long ? 2.4 : 1.9} style={{ filter: 'blur(1.5px)' }} />
                    <path d={b.d} fill="none" stroke="#eef9ff" strokeWidth={b.long ? 1.4 : 1.1} />
                  </g>
                );
              })}
            </svg>
          </span>
        </div>
        <div style={{ ...small, ...lineIn(enter2) }}>sous toutes</div>
        <div style={{ ...small, ...lineIn(enter3) }}>ses formes</div>
      </AbsoluteFill>
      <Vignette strength={0.5} inner={0.45} color={L.shadow} />
      <Grain opacity={0.07} blend="soft-light" />
    </AbsoluteFill>
  );
};
