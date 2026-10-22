// S04 · word-relay-geometry (adapté de WordRelayGeometry, 9:16, 89 images = 6 temps).
// Les trois piliers en relais, un mot toutes les 2 mesures de temps (L12 / L14 / L16) :
//   Pureté  — anneau pointillé + couronne graduée qui tournent, une comète file sur l'anneau ;
//   Hygiène — trois cercles empilés (format vertical) se tracent puis se resserrent et s'emboîtent ;
//   Qualité — pas de géométrie : reflet métal glacé balayé une fois (Q4), puis blanc + halo.
// Chaque mot : entrée 10 i. (1,06 → 1, défloutage), contour puis remplissage, sous-titre de preuve.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, TextReveal, alpha, type } from '../_fixtures/Look';
import { GlaceurMark } from '../_fixtures/Brand';

const L = LOOKS.glaceur;
const W = 1080;
const H = 1920;
const CX = W / 2;
const CY = 860;
const WORD_SIZE = 230;
const GEO = 'rgba(198,232,255,0.42)';
const ICE = L.accent2;

type Slot = { word: string; sub: string; in0: number; out0: number | null };
// bornes locales : temps 0 / 2 / 4 du plan = images 0 / 29 / 59
const SLOTS: Slot[] = [
  { word: 'Pureté', sub: 'Une eau traitée et contrôlée', in0: -2, out0: 24 },
  { word: 'Hygiène', sub: 'Hygiénique & sûr', in0: 27, out0: 54 },
  { word: 'Qualité', sub: 'Froid maîtrisé en continu', in0: 57, out0: null },
];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// 一个词的进出场包络：入 14f（snappy，1.06→1 去虚）、出 10f（exit，1→0.86 退焦）
const envelope = (f: number, s: Slot) => {
  const tin = ramp(f, s.in0, 10, EASE.snappy);
  const tout = s.out0 === null ? 0 : ramp(f, s.out0, 8, EASE.exit);
  return { tin, tout, alive: f >= s.in0 - 1 && tout < 1 };
};

// ───────────── Faster：虚线环 + 刻度环 + 彗星弧 ─────────────
const PureteGeo: React.FC<{ f: number; fade: number }> = ({ f, fade }) => {
  const grow = ramp(f, 0, 16, EASE.snappy);
  const s = mix(0.4, 1, grow);
  // 自转：入场时多转 160° 并减速（像飞轮刹住），之后匀速慢转永不停
  const spin = -90 - 160 * (1 - grow) + f * 0.9;
  const spinTicks = 40 * (1 - grow) - f * 0.35; // 刻度环反向慢转，两层相对运动读出"转速"
  const R = 400;
  const RT = 452;
  // 彗星：沿 r=400 飞跑的亮弧（头亮尾淡），角速度比环快得多
  const head = -90 + f * 7.5 - 220 * (1 - grow);
  const comet = Array.from({ length: 16 }, (_, k) => {
    const a0 = ((head - k * 4) * Math.PI) / 180;
    const a1 = ((head - (k + 1) * 4) * Math.PI) / 180;
    return { d: `M ${R * Math.cos(a0)} ${R * Math.sin(a0)} A ${R} ${R} 0 0 0 ${R * Math.cos(a1)} ${R * Math.sin(a1)}`, o: (1 - k / 16) ** 1.6 };
  });
  return (
    <g opacity={fade * mix(0.35, 1, grow)} transform={`translate(${CX} ${CY}) scale(${s})`}>
      <circle r={R} fill="none" stroke={GEO} strokeWidth={2} strokeDasharray="10 16" transform={`rotate(${spin})`} />
      <g transform={`rotate(${spinTicks})`}>
        {Array.from({ length: 120 }, (_, k) => {
          const a = (k / 120) * Math.PI * 2;
          const long = k % 10 === 0;
          const r0 = RT - (long ? 18 : 8);
          return (
            <line key={k} x1={r0 * Math.cos(a)} y1={r0 * Math.sin(a)} x2={RT * Math.cos(a)} y2={RT * Math.sin(a)}
              stroke={long ? 'rgba(198,232,255,0.55)' : 'rgba(198,232,255,0.2)'} strokeWidth={long ? 2 : 1.4} />
          );
        })}
      </g>
      <circle r={R - 58} fill="none" stroke="rgba(198,232,255,0.08)" strokeWidth={1.4} />
      <g opacity={grow} style={{ filter: `drop-shadow(0 0 10px ${alpha('#ffffff', 0.6)})` }}>
        {comet.map((c, k) => (
          <path key={k} d={c.d} fill="none" stroke="#ffffff" strokeOpacity={c.o} strokeWidth={4 - k * 0.15} strokeLinecap="round" />
        ))}
      </g>
    </g>
  );
};

// ───────────── Tighter：三圆 trim 生长 → 收拢咬紧 ─────────────
const HygieneGeo: React.FC<{ f: number; fade: number; outF: number | null }> = ({ f, fade, outF }) => {
  const R = 218;
  const tight = ramp(f, 14, 10, EASE.swift); // 长满后向中心收拢
  const gap = mix(330, 290, tight);
  // 收拢落定时圆线一次提亮（咬合的"咔"）
  const click = Math.sin(clamp01((f - 20) / 10) * Math.PI);
  return (
    <g opacity={fade} transform={`translate(${CX} ${CY})`}>
      {[-1, 0, 1].map((k, i) => {
        const grow = ramp(f, i * 3, 14, EASE.out);
        const back = outF === null ? 0 : ramp(f, outF - 4, 12, EASE.exit);
        const tr = Math.max(0, grow - back);
        const y = k * gap;
        const a = -Math.PI / 2 + tr * Math.PI * 2;
        const tip = tr > 0.001 && grow < 1 ? 1 - clamp01((grow - 0.85) / 0.15) : 0;
        return (
          <g key={k}>
            <circle cx={0} cy={y} r={R} fill="none" stroke={alpha('#ffffff', 0.4 + 0.35 * click)} strokeWidth={2.2}
              pathLength={1} strokeDasharray="1" strokeDashoffset={1 - tr} transform={`rotate(-90 0 ${y})`} />
            {tip > 0 && (
              <circle cx={Math.cos(a) * R} cy={y + Math.sin(a) * R} r={6} fill="#ffffff" opacity={tip}
                style={{ filter: `drop-shadow(0 0 8px #ffffff) drop-shadow(0 0 22px ${alpha('#ffffff', 0.6)})` }} />
            )}
          </g>
        );
      })}
      {/* 相邻两圆的交点：收拢落定时亮起四枚铆钉光点，证明"咬住了" */}
      {[-1, 1].flatMap((k) => [-1, 1].map((sy) => {
        const h = Math.sqrt(Math.max(0, R * R - (gap / 2) ** 2));
        const on = ramp(f, 20 + (k + 1) * 1.5 + (sy + 1), 8, EASE.overshoot);
        return (
          <g key={`${k}${sy}`} transform={`translate(${sy * h} ${(k * gap) / 2}) rotate(45) scale(${on})`} opacity={clamp01(on)}>
            <rect x={-6} y={-6} width={12} height={12} fill="#ffffff" style={{ filter: `drop-shadow(0 0 10px ${alpha('#ffffff', 0.8)})` }} />
          </g>
        );
      }))}
    </g>
  );
};

const Word: React.FC<{ f: number; slot: Slot; idx: number }> = ({ f, slot, idx }) => {
  const { tin, tout } = envelope(f, slot);
  const last = idx === SLOTS.length - 1;
  const scale = mix(1.06, 1, tin) * mix(1, 0.86, tout);
  const defocus = (1 - tin) * 10 + tout * 12;
  const fillp = ramp(f, slot.in0 + 3, 12, EASE.swift);
  const FE = 7;
  const edge = fillp * (100 + FE * 2) - FE;
  const mask = `linear-gradient(90deg, #000 ${(edge - FE).toFixed(2)}%, transparent ${(edge + FE).toFixed(2)}%)`;
  const t0 = slot.in0;
  const sh = ramp(f, t0 + 2, 6, EASE.out);
  const sweep = ramp(f, t0 + 4, 14, EASE.smooth);
  const white = ramp(f, t0 + 17, 8, EASE.out);
  const bloom = Math.sin(clamp01((f - t0 - 17) / 16) * Math.PI) * 0.9 + white * 0.35;
  const base: React.CSSProperties = {
    fontFamily: FONT.display, fontSize: WORD_SIZE, fontWeight: 800, letterSpacing: '0', lineHeight: 1, whiteSpace: 'nowrap',
    textTransform: 'uppercase', padding: '0.08em 0.1em 0.2em',
  };
  return (
    <div style={{
      position: 'absolute', left: CX, top: CY, transform: `translate(-50%, ${-0.6 * WORD_SIZE}px) scale(${scale.toFixed(4)})`, transformOrigin: `50% ${0.6 * WORD_SIZE}px`,
      opacity: clamp01(tin * 1.6) * (1 - tout), filter: defocus > 0.05 ? `blur(${defocus.toFixed(2)}px)` : undefined,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{ ...base, color: 'transparent', WebkitTextStroke: `2px ${alpha('#dff2ff', 0.6)}`, opacity: last ? 1 - sh * 0.85 : 1 - fillp * 0.8 }}>
          {slot.word}
        </div>
        {last ? (
          <>
            <div style={{
              ...base, position: 'absolute', inset: 0, color: 'transparent',
              backgroundImage: 'linear-gradient(180deg, #f3faff 8%, #a9d4f5 40%, #2a4f80 52%, #6f98c4 62%, #e6f4ff 88%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', opacity: sh * (1 - white),
            }}>{slot.word}</div>
            <div style={{
              ...base, position: 'absolute', inset: 0, color: 'transparent',
              backgroundImage: `linear-gradient(100deg, transparent 38%, ${alpha(ICE, 0.7)} 45%, #ffffff 50%, ${alpha(ICE, 0.7)} 55%, transparent 62%)`,
              backgroundSize: '300% 100%', backgroundPosition: `${mix(100, 0, sweep).toFixed(2)}% 0`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', opacity: sh * (1 - white) * (sweep > 0 && sweep < 1 ? 1 : 0),
            }}>{slot.word}</div>
            <div style={{
              ...base, position: 'absolute', inset: 0, color: L.ink, opacity: white,
              textShadow: `0 0 ${(30 * bloom).toFixed(1)}px ${alpha('#bfe4ff', 0.4 * bloom)}, 0 0 ${(90 * bloom).toFixed(1)}px ${alpha('#6db3ff', 0.3 * bloom)}`,
            }}>{slot.word}</div>
          </>
        ) : (
          fillp > 0 && (
            <div style={{ ...base, position: 'absolute', inset: 0, color: L.ink, WebkitMaskImage: mask, maskImage: mask }}>{slot.word}</div>
          )
        )}
      </div>
    </div>
  );
};

export const PillarsRelay: React.FC = () => {
  const f = useCurrentFrame();
  const cam = mix(1, 1.025, ramp(f, 0, 88, EASE.smooth));
  const e = SLOTS.map((s) => envelope(f, s));
  const active = f < SLOTS[1].in0 ? 0 : f < SLOTS[2].in0 ? 1 : 2;
  const flare = Math.sin(clamp01((f - SLOTS[2].in0 - 17) / 20) * Math.PI);
  const s1 = SLOTS[1];

  return (
    <AbsoluteFill style={{ background: L.bg[2] }}>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.42 }} fill={{ x: 0.5, y: 1.05 }} intensity={0.62 + flare * 0.3} breathe={0.4} />
      <AbsoluteFill style={{ transform: `scale(${cam.toFixed(4)})`, transformOrigin: `${CX}px ${CY}px` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {e[0].alive && <PureteGeo f={f - SLOTS[0].in0} fade={1 - e[0].tout} />}
          {e[1].alive && (
            <g transform={`translate(${CX} ${CY}) scale(${mix(1.04, 1, e[1].tin) * mix(1, 0.9, e[1].tout)}) translate(${-CX} ${-CY})`}>
              <HygieneGeo f={f - s1.in0} fade={clamp01(e[1].tin * 2) * (1 - e[1].tout)} outF={(s1.out0 as number) - s1.in0} />
            </g>
          )}
        </svg>
        <div style={{
          position: 'absolute', left: CX - 460, width: 920, top: CY + 150, height: 2,
          background: `linear-gradient(90deg, transparent, ${alpha('#dff2ff', 0.75)} 50%, transparent)`,
          opacity: ramp(f, SLOTS[2].in0 + 18, 10, EASE.out) * 0.8, transform: `scaleX(${mix(0.2, 1, ramp(f, SLOTS[2].in0 + 17, 16, EASE.snappy))})`,
          boxShadow: `0 0 24px ${alpha('#8ecfff', 0.5)}`,
        }} />
        {SLOTS.map((s, i) => (e[i].alive ? <Word key={s.word} f={f} slot={s} idx={i} /> : null))}
        {SLOTS.map((s, i) =>
          e[i].alive ? (
            <div key={`sub${i}`} style={{
              position: 'absolute', left: 0, right: 0, top: i === 1 ? CY + 560 : CY + 520, textAlign: 'center',
              ...type(64, 600), color: L.ink2, opacity: 1 - e[i].tout,
              filter: e[i].tout > 0.02 ? `blur(${(e[i].tout * 6).toFixed(2)}px)` : undefined,
            }}>
              <TextReveal text={s.sub} by="word" variant="rise" start={s.in0 + 5} each={10} gap={2} />
            </div>
          ) : null,
        )}
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 80, top: 150, ...type(64, 800), fontFamily: FONT.display, letterSpacing: '0.08em', color: L.ink3 }}>
        <span style={{ color: L.ink }}>{`0${active + 1}`}</span> / 03
      </div>
      <div style={{ position: 'absolute', right: 80, top: 146 }}>
        <GlaceurMark size={84} />
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 260, display: 'flex', gap: 20 }}>
        {SLOTS.map((s, i) => {
          const start = Math.max(0, s.in0);
          const end = s.out0 ?? 88;
          const p = ramp(f, start, end - start, EASE.linear);
          return (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: alpha('#ffffff', 0.12), position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: i === active ? L.accent2 : alpha('#ffffff', 0.45), transform: `scaleX(${p})`, transformOrigin: 'left' }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
