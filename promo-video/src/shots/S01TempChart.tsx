// S01 · chart-live-moves / oscilloscope-stream (adapté de OscilloscopeStreamV2, 9:16).
// La trace « écrit » la température en continu : 28 °C (eau traitée) → −18 °C (glace).
// Événement = passage à 0 °C (étiquette « GEL » épinglée sur la trace, qui file vers la gauche).
// Arrivée à −18 °C vers f30, freinage out-cubic f30→40, puis immobilité (R1 : −18 °C tenu ≥ 1 s,
// y compris dans les éclats du plan suivant qui reprend ce rendu figé).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, mix, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha, type } from '../_fixtures/Look';
import { BRAND, GlaceurMark } from '../_fixtures/Brand';

const L = LOOKS.glaceur;
const WARM = '#ffad66'; // eau à température ambiante (couleur d'événement chaude)
const ICE = '#8ecfff';

const PX = 60;
const PW = 960;
const PY = 800;
const PH = 760;
const HEAD = Math.round(PW * 0.84);

const SPEED = 16;
const FREEZE0 = 30;
const FREEZE1 = 40;
const OFFSET = 1200;
const worldAt = (f: number) => {
  if (f <= FREEZE0) return OFFSET + f * SPEED;
  const brake = (SPEED * (FREEZE1 - FREEZE0)) / 3;
  return OFFSET + FREEZE0 * SPEED + brake * ramp(f, FREEZE0, FREEZE1 - FREEZE0, (x) => 1 - Math.pow(1 - x, 3));
};

// Température (°C) en fonction de la position monde : palier 28 °C, chute en S, palier −18 °C.
const X0 = OFFSET + 1 * SPEED;
const X1 = OFFSET + 28 * SPEED;
const ripple = (x: number) => 0.6 * Math.sin(x * 0.045) + 0.35 * Math.sin(x * 0.11 + 1.3);
const tempOf = (x: number) => {
  const k = Math.min(1, Math.max(0, (x - X0) / (X1 - X0)));
  const s = k * k * (3 - 2 * k);
  const base = mix(28, -18, s);
  return base + ripple(x) * (1 - 0.85 * s) + 1.4 * Math.sin(k * Math.PI) * Math.sin(x * 0.03);
};
const TMAX = 34;
const TMIN = -24;
const yOfT = (t: number) => ((TMAX - t) / (TMAX - TMIN)) * PH;
const Y0 = yOfT(0);

// Point de passage à 0 °C (pour l'étiquette).
const ZERO_X = (() => {
  for (let x = X0; x < X1; x += 0.5) if (tempOf(x) <= 0) return x;
  return X1;
})();

const fmtT = (t: number) => {
  const r = Math.round(t * 10) / 10;
  const s = Math.abs(r).toFixed(1).replace('.', ',');
  return (r < 0 ? '−' : '') + s;
};
const hexMix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  const k = Math.min(1, Math.max(0, t));
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
};

export const TempChart: React.FC = () => {
  const frame = useCurrentFrame();
  const T = worldAt(frame);
  const worldOf = (px: number) => T - (HEAD - px);

  const pts: Array<[number, number]> = [];
  for (let px = 0; px <= HEAD; px += 4) pts.push([px, yOfT(tempOf(worldOf(px)))]);
  const lineD = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${HEAD},${PH} L0,${PH} Z`;
  const headT = tempOf(T);
  const headY = yOfT(headT);

  // Lecture : échantillonnée toutes les 2 images (rafraîchissement d'instrument), figée à −18 à l'arrivée.
  const heldT = frame >= FREEZE0 ? -18 : tempOf(worldAt(Math.floor(frame / 2) * 2));
  const cold = Math.min(1, Math.max(0, (28 - heldT) / 46)); // 0 = 28 °C, 1 = −18 °C
  const live = 1 - ramp(frame, FREEZE0, FREEZE1 - FREEZE0, EASE.out);
  const pulse = 0.5 + 0.5 * Math.cos((frame / 20) * Math.PI * 2);
  const landPop = frame >= FREEZE0 ? 1 + 0.05 * Math.exp(-(frame - FREEZE0) / 4) * Math.cos((frame - FREEZE0) * 0.9) : 1;

  const on = ramp(frame, 0, 12, EASE.snappy);
  const headIn = ramp(frame, 0, 10, EASE.out);

  // Étiquette GEL épinglée au passage 0 °C
  const zeroPx = HEAD - (T - ZERO_X);
  const passF = (ZERO_X - OFFSET) / SPEED;
  const tagIn = ramp(frame, passF + 1, 12, EASE.overshoot);

  const cam = mix(1, 1.03, ramp(frame, FREEZE0 - 4, 30, EASE.smooth));

  return (
    <AbsoluteFill style={{ background: L.bg[1], overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.7, y: 0.42 }} fill={{ x: 0.1, y: 0.92 }} intensity={0.8} breathe={0.4} />
      {/* givre qui gagne les bords à mesure que la température chute */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.75 * cold * cold,
        background: `radial-gradient(ellipse 70% 40% at 0% 0%, ${alpha('#dff2ff', 0.28)} 0%, ${alpha('#dff2ff', 0)} 70%),
          radial-gradient(ellipse 70% 40% at 100% 100%, ${alpha('#dff2ff', 0.24)} 0%, ${alpha('#dff2ff', 0)} 70%)`,
      }} />

      <div style={{ position: 'absolute', inset: 0, transform: `scale(${cam.toFixed(5)})`, transformOrigin: `${PX + HEAD}px ${PY + headY}px` }}>
        {/* en-tête */}
        <div style={{ position: 'absolute', left: PX, top: 150, display: 'flex', alignItems: 'center', gap: 20, opacity: headIn }}>
          <GlaceurMark size={72} />
          <span style={{ ...type(58, 800, { caps: true }), fontFamily: FONT.display, color: L.ink, letterSpacing: '0.04em' }}>{BRAND.name}</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 18px 6px 14px', borderRadius: 99, marginLeft: 8,
            background: live > 0.5 ? alpha(L.accent2, 0.14) : alpha('#ffffff', 0.08),
            border: `1px solid ${live > 0.5 ? alpha(L.accent2, 0.4) : alpha('#ffffff', 0.16)}`,
            ...type(58, 750, { caps: true }), color: live > 0.5 ? L.accent2 : L.ink2,
          }}>
            <span style={{ width: 14, height: 14, borderRadius: 7, background: live > 0.5 ? L.accent2 : L.ink2,
              boxShadow: live > 0.5 ? `0 0 0 ${(3 + 5 * pulse).toFixed(1)}px ${alpha(L.accent2, 0.25 * (1 - pulse))}` : 'none' }} />
            {live > 0.5 ? 'Live' : 'Stable'}
          </span>
        </div>

        {/* libellé + grosse lecture */}
        <div style={{ position: 'absolute', left: PX, top: 270, ...type(58, 600), color: L.ink2, opacity: headIn }}>
          {heldT > 0 ? 'Eau traitée' : 'Glace'}
        </div>
        <div style={{
          position: 'absolute', left: PX - 6, top: 330, display: 'flex', alignItems: 'baseline', gap: 18,
          transform: `scale(${landPop.toFixed(4)})`, transformOrigin: 'left bottom', opacity: headIn,
        }}>
          <span style={{
            ...type(330, 800), fontFamily: FONT.display, letterSpacing: '-0.01em',
            color: hexMix('#fff1e4', '#eaf6ff', cold),
            textShadow: `0 0 50px ${alpha(heldT > 0 ? WARM : ICE, 0.35)}`,
          }}>{fmtT(heldT)}</span>
          <span style={{ ...type(110, 700), fontFamily: FONT.display, color: hexMix(WARM, ICE, cold) }}>°C</span>
        </div>
        <div style={{ position: 'absolute', left: PX, top: 680, display: 'flex', gap: 28, opacity: ramp(frame, 4, 10, EASE.out), ...type(58, 600), color: L.ink2 }}>
          <span>Froid maîtrisé <b style={{ color: L.ink }}>en continu</b></span>
        </div>

        {/* écran oscilloscope */}
        <div style={{ position: 'absolute', left: PX, top: PY, width: PW, height: PH }}>
          <svg width={PW} height={PH + 90} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            <defs>
              <linearGradient id="tcStroke" x1="0" y1="0" x2="0" y2={PH} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={WARM} />
                <stop offset={(Y0 / PH - 0.04).toFixed(3)} stopColor="#ffd2a8" />
                <stop offset={(Y0 / PH + 0.04).toFixed(3)} stopColor="#cfeaff" />
                <stop offset="1" stopColor={ICE} />
              </linearGradient>
              <linearGradient id="tcArea" x1="0" y1="0" x2="0" y2={PH} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={L.accent} stopOpacity={0.3} />
                <stop offset="1" stopColor={L.accent} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="tcFade" x1="0" y1="0" x2={PW} y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff" stopOpacity={0} />
                <stop offset="0.16" stopColor="#fff" stopOpacity={1} />
                <stop offset="1" stopColor="#fff" stopOpacity={1} />
              </linearGradient>
              <mask id="tcMask" maskUnits="userSpaceOnUse" x={-20} y={-200} width={PW + 40} height={PH + 300}>
                <rect x={-20} y={-200} width={PW + 40} height={PH + 300} fill="url(#tcFade)" />
              </mask>
              <filter id="tcGlowA" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
              <filter id="tcGlowB" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="16" /></filter>
              <radialGradient id="tcHead">
                <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
                <stop offset="0.25" stopColor={hexMix(WARM, ICE, cold)} stopOpacity={0.8} />
                <stop offset="1" stopColor={hexMix(WARM, ICE, cold)} stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* grille d'oscilloscope (déploiement depuis le centre) */}
            <g opacity={on}>
              {Array.from({ length: 7 }, (_, i) => {
                const x = (i / 6) * PW;
                const reach = (PH / 2) * on;
                return <line key={`v${i}`} x1={x} x2={x} y1={PH / 2 - reach} y2={PH / 2 + reach} stroke={L.accent} strokeOpacity={i === 0 || i === 6 ? 0.24 : 0.1} strokeWidth={1.4} />;
              })}
              {[34, 24, 12, 0, -12, -24].map((t) => {
                const y = yOfT(t);
                const reach = (PW / 2) * on;
                return <line key={`h${t}`} x1={PW / 2 - reach} x2={PW / 2 + reach} y1={y} y2={y}
                  stroke={t === 0 ? L.accent2 : L.accent} strokeOpacity={t === 0 ? 0.5 : 0.1} strokeWidth={t === 0 ? 2 : 1.4} strokeDasharray={t === 0 ? '10 10' : undefined} />;
              })}
              {Array.from({ length: 31 }, (_, i) => (
                <line key={`tk${i}`} x1={(i / 30) * PW} x2={(i / 30) * PW} y1={Y0 - (i % 5 ? 6 : 12)} y2={Y0 + (i % 5 ? 6 : 12)} stroke={L.accent2} strokeOpacity={0.35} strokeWidth={1.4} />
              ))}
            </g>

            <g mask="url(#tcMask)">
              <path d={areaD} fill="url(#tcArea)" />
              <path d={lineD} fill="none" stroke="url(#tcStroke)" strokeWidth={12} opacity={0.5} filter="url(#tcGlowB)" />
              <path d={lineD} fill="none" stroke="url(#tcStroke)" strokeWidth={6} opacity={0.75} filter="url(#tcGlowA)" />
              <path d={lineD} fill="none" stroke="url(#tcStroke)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
            </g>

            {/* tête d'écriture */}
            <line x1={HEAD} x2={HEAD} y1={0} y2={PH} stroke={hexMix(WARM, ICE, cold)} strokeOpacity={0.45 * live + 0.12} strokeWidth={2} />
            <line x1={HEAD} x2={PW} y1={headY} y2={headY} stroke="#eaf6ff" strokeOpacity={0.4} strokeWidth={2} strokeDasharray="5 7" />
            <circle cx={HEAD} cy={headY} r={80} fill="url(#tcHead)" opacity={0.55 * live + 0.15} />
            <circle cx={HEAD} cy={headY} r={11} fill="#ffffff" stroke={L.bg[1]} strokeWidth={3} />

            {tagIn > 0 && zeroPx > 40 && (
              <g opacity={Math.min(1, tagIn * 1.5)}>
                <circle cx={zeroPx} cy={Y0} r={11 * tagIn} fill={ICE} stroke={L.bg[1]} strokeWidth={3} />
              </g>
            )}
          </svg>

          {/* graduations */}
          {[24, 12, 0, -12].map((t) => (
            <div key={t} style={{ position: 'absolute', right: 14, top: yOfT(t) - 66, ...type(58, 650), color: t === 0 ? L.accent2 : L.ink3, opacity: on }}>
              {t > 0 ? `+${t}` : t === 0 ? '0' : `−${-t}`}°
            </div>
          ))}

          {tagIn > 0 && zeroPx > 40 && (
            <div style={{
              position: 'absolute', left: zeroPx + 22, top: Y0 + 22, height: 76, padding: '0 26px 0 20px',
              display: 'flex', alignItems: 'center', gap: 14, borderRadius: 16, whiteSpace: 'nowrap',
              background: `linear-gradient(180deg, ${alpha(ICE, 0.24)}, ${alpha(ICE, 0.12)})`, border: `1px solid ${alpha(ICE, 0.6)}`,
              boxShadow: `0 16px 40px -10px ${alpha('#000000', 0.6)}`,
              transform: `scale(${tagIn.toFixed(4)})`, transformOrigin: '0% 0%', opacity: Math.min(1, tagIn * 1.5),
            }}>
              <span style={{ ...type(58, 800, { caps: true }), color: ICE }}>Gel</span>
              <span style={{ ...type(58, 600), color: '#e3f3ff' }}>0 °C</span>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
