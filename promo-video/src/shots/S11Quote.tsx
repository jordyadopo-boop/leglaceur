// S11 · glitch-cycle (adapté de GlitchCycle, 9:16) — le devis en ligne en quatre étapes (L44–L50) : une
// ligne à cases fixes fait défiler QUANTITÉS / LIVRAISON / PDF·EXCEL / WHATSAPP, un temps chacune, avec
// brouillage, séparation RVB et déchirure aux transitions ; chaque étape se coche dans la liste du dessous
// (texte qui reste à l'écran, R1). À L48, « EN 1 MIN » se pose proprement avec l'unique halo (Q4).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, ramp } from '../_fixtures/Polish';
import { LOOKS, Stage, alpha } from '../_fixtures/Look';
import { GlaceurMark } from '../_fixtures/Brand';
import { rand } from '../_fixtures/Motion';
import { beatF } from '../beat';

const L = LOOKS.glaceur;
const A = 44;
const at = (k: number) => beatF(A + k) - beatF(A);
const PHRASES = ['QUANTITÉS', 'LIVRAISON', 'PDF·EXCEL', 'WHATSAPP', 'EN 1 MIN'];
const CHECKS = ['Quantités libres', 'Livraison ou retrait', 'PDF ou Excel', 'Envoi sur WhatsApp'];
const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&<>/';
const KF = [1, 0, 0, 0, 0.6];
const KF_LAST = [1, 0, 0, 0, 0];
const MAXCH = 9;
const SIZE = 156;
const CELL = 0.56;
const SPLIT_A = '#ff4fa3';
const SPLIT_B = '#6fd8ff';
const BAR_W = 860;
const DONE = at(4);

const glitchAt = (kf: number[], p: number) => {
  const segs = kf.length - 1;
  const x = Math.min(segs - 1e-6, Math.max(0, p * segs));
  const i = Math.floor(x);
  return kf[i] + (kf[i + 1] - kf[i]) * (x - i);
};
const padCenter = (s: string) => {
  const left = Math.floor((MAXCH - s.length) / 2);
  return ' '.repeat(left) + s + ' '.repeat(MAXCH - s.length - left);
};

export const QuoteGlitch: React.FC = () => {
  const frame = useCurrentFrame();
  const N = PHRASES.length;
  let slot = 0;
  for (let k = 1; k < N; k++) if (frame >= at(k)) slot = k;
  const last = slot === N - 1;
  const len = last ? 14 : at(slot + 1) - at(slot);
  const p = Math.min(1, (frame - at(slot)) / len);
  const text = padCenter(PHRASES[slot]);
  const g = glitchAt(last ? KF_LAST : KF, p);
  const bucket = Math.floor(frame / 2);

  const jx = (rand(bucket * 5 + slot) - 0.5) * g * 36;
  const jy = (rand(bucket * 9 + slot + 40) - 0.5) * g * 10;
  const tear = g > 0.25;
  const bandTop = 12 + rand(bucket * 3 + 7) * 50;
  const bandH = 16 + rand(bucket * 11 + 3) * 24;
  const tearX = (rand(bucket * 13 + 5) - 0.5) * g * 160;
  const split = g * 12;

  const prog = Math.min(1, frame / DONE);
  const done = frame >= DONE;
  const bloom = last ? Math.max(0, 1 - (frame - DONE - 4) / 26) * ramp(frame, DONE + 2, 3, EASE.out) : 0;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 4);
  const push = 1 + 0.03 * ramp(frame, 0, 89, EASE.swift);

  const row = (dx: number, clip?: string, key?: string) => (
    <div key={key} style={{
      position: clip ? 'absolute' : 'relative', left: 0, top: 0, display: 'flex',
      transform: `translateX(${dx.toFixed(1)}px)`, clipPath: clip,
      textShadow: g > 0.04
        ? `${split.toFixed(1)}px 0 ${alpha(SPLIT_A, 0.8 * Math.min(1, g * 1.4))}, ${(-split).toFixed(1)}px 0 ${alpha(SPLIT_B, 0.8 * Math.min(1, g * 1.4))}`
        : `0 0 ${(20 + 50 * bloom).toFixed(0)}px ${alpha(L.accent, 0.3 + 0.5 * bloom)}`,
    }}>
      {Array.from({ length: MAXCH }, (_, i) => {
        const ch = text[i];
        let content = ch;
        let color: string = last ? L.ink : L.ink;
        if (ch !== ' ') {
          if (rand(i * 31 + bucket * 17 + slot * 97) < g) {
            content = POOL[Math.floor(rand(i * 131 + bucket * 7 + slot * 13) * POOL.length)];
            color = rand(i + bucket) > 0.5 ? L.accent2 : L.ink3;
          }
        }
        return <span key={i} style={{ width: `${CELL}em`, textAlign: 'center', color, display: 'inline-block' }}>{content}</span>;
      })}
    </div>
  );

  const blocks = g > 0.45
    ? Array.from({ length: 3 }, (_, k) => ({
      x: rand(bucket * 19 + k * 7) * 100, y: rand(bucket * 23 + k * 5) * 90,
      w: 4 + rand(bucket * 29 + k) * 14, h: 6 + rand(bucket * 31 + k) * 14, c: k % 2 ? SPLIT_B : SPLIT_A,
    }))
    : [];
  const slotW = MAXCH * CELL * SIZE;

  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.38 }} fill={{ x: 0.8, y: 0.95 }} breathe={0.4} vignette={0.65} grain={0}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 660, height: 420,
          background: `radial-gradient(ellipse 55% 50% at 50% 50%, ${alpha(L.light, 0.2 + 0.12 * g)} 0%, ${alpha(L.light, 0)} 70%)`,
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.45,
          background: `repeating-linear-gradient(180deg, ${alpha('#000000', 0)} 0px, ${alpha('#000000', 0)} 3px, ${alpha('#000000', 0.22)} 4px)`,
        }} />
      </Stage>

      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: '50% 45%' }}>
        {/* en-tête */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <GlaceurMark size={64} tone="dark" />
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 72, letterSpacing: '0.16em', color: L.ink }}>DEVIS EN LIGNE</span>
        </div>
        {/* statut au-dessus de la ligne */}
        <div style={{
          position: 'absolute', left: (1080 - slotW) / 2, width: slotW, top: 600, display: 'flex', alignItems: 'center', gap: 18,
          fontFamily: FONT.display, fontSize: 60, fontWeight: 600, letterSpacing: '0.1em', color: L.ink2,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 11, boxSizing: 'border-box', border: `3px solid ${L.accent2}`,
            background: done ? L.accent2 : alpha(L.accent2, pulse * 0.8), boxShadow: `0 0 ${done ? 18 : 12 * pulse}px ${alpha(L.accent2, 0.7)}`,
          }} />
          <span style={{ color: done ? L.ink : L.ink2 }}>{done ? 'DEVIS PRÊT' : `ÉTAPE ${slot + 1}/4`}</span>
        </div>

        {/* ligne à cases */}
        <div style={{ position: 'absolute', left: (1080 - slotW) / 2, width: slotW, top: 700, padding: '26px 0' }}>
          {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([rx, ry], k) => (
            <div key={k} style={{
              position: 'absolute', width: 36, height: 36, left: rx ? undefined : -30, right: rx ? -30 : undefined,
              top: ry ? undefined : 0, bottom: ry ? 0 : undefined,
              borderLeft: rx ? undefined : `3px solid ${alpha(L.ink, 0.4)}`, borderRight: rx ? `3px solid ${alpha(L.ink, 0.4)}` : undefined,
              borderTop: ry ? undefined : `3px solid ${alpha(L.ink, 0.4)}`, borderBottom: ry ? `3px solid ${alpha(L.ink, 0.4)}` : undefined,
            }} />
          ))}
          <div style={{
            position: 'relative', fontFamily: FONT.display, fontSize: SIZE, fontWeight: 800, lineHeight: 1.1,
            transform: `translate(${jx.toFixed(1)}px,${jy.toFixed(1)}px)`, whiteSpace: 'pre',
          }}>
            {tear ? (
              <>
                <div style={{ visibility: 'hidden' }}>{row(0)}</div>
                {row(0, `inset(0 -200px ${100 - bandTop}% -200px)`, 'a')}
                {row(tearX, `inset(${bandTop}% -200px ${Math.max(0, 100 - bandTop - bandH)}% -200px)`, 'b')}
                {row(0, `inset(${Math.min(100, bandTop + bandH)}% -200px 0 -200px)`, 'c')}
              </>
            ) : row(0)}
            {blocks.map((b, k) => (
              <div key={k} style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%`, width: b.w * 5, height: b.h * 2.5, background: alpha(b.c, 0.55), mixBlendMode: 'screen' }} />
            ))}
          </div>
        </div>

        {/* barre de progression : quatre crans, un par étape */}
        <div style={{ position: 'absolute', left: (1080 - BAR_W) / 2, width: BAR_W, top: 1020, height: 6, borderRadius: 3, background: alpha(L.ink, 0.12) }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, borderRadius: 3,
            background: `linear-gradient(90deg, ${alpha(L.accent, 0.3)} 0%, ${L.accent} 70%, ${L.accent2} 100%)`, boxShadow: `0 0 14px ${alpha(L.accent, 0.6)}`,
          }} />
          {[1, 2, 3].map((k) => {
            const x = at(k) / DONE;
            return <div key={k} style={{ position: 'absolute', left: `${x * 100}%`, top: -8, width: 3, height: 22, marginLeft: -1.5, background: prog >= x ? L.accent : alpha(L.ink, 0.25) }} />;
          })}
        </div>

        {/* liste cochée : chaque étape reste affichée */}
        <div style={{ position: 'absolute', left: 150, top: 1130 }}>
          {CHECKS.map((c, k) => {
            const a = ramp(frame, at(k) + 3, 6, EASE.out);
            const tick = ramp(frame, at(k) + 6, 5, EASE.snappy);
            return (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 26, height: 104, opacity: a, transform: `translateX(${((1 - a) * -40).toFixed(1)}px)` }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `3px solid ${alpha(L.accent2, 0.7)}`, background: alpha(L.accent, 0.18 * tick),
                }}>
                  <svg width={40} height={40} viewBox="0 0 40 40">
                    <path d="M8 21 L17 30 L33 11" fill="none" stroke={L.accent2} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray={40} strokeDashoffset={40 * (1 - tick)} />
                  </svg>
                </div>
                <span style={{ fontFamily: FONT.sans, fontSize: 64, fontWeight: 600, color: slot === k ? L.ink : L.ink2 }}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Grain opacity={0.08} blend="soft-light" />
    </AbsoluteFill>
  );
};
