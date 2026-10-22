// S08 · beat-cut-moves (adapté de PaparazziFlash, 9:16) — quatre secteurs en photo, une coupe franche
// par temps (L32–L35) : flash blanc 4 images, surexposition qui retombe en 7, puis chaque photo a son
// propre mouvement de caméra (poussée, panoramique, bascule, recul). Cadre de mise au point + étiquette.
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, Grain, Vignette, mix, ramp } from '../_fixtures/Polish';
import { LOOKS, alpha } from '../_fixtures/Look';
import { GlaceurMark } from '../_fixtures/Brand';
import { beatF } from '../beat';

const L = LOOKS.glaceur;
const A = 32;
const cut = (k: number) => beatF(A + k) - beatF(A);
type Move = { s0: number; s1: number; x0: number; x1: number; y0: number; y1: number };
const SECTORS: { img: string; name: string; sub: string; mv: Move }[] = [
  { img: 'img/usage-restaurant.webp', name: 'Restaurants', sub: 'Cuisine & service', mv: { s0: 1.12, s1: 1.24, x0: 0, x1: 0, y0: 0, y1: -20 } },
  { img: 'img/usage-cocktail.webp', name: 'Bars & lounges', sub: 'Cocktails & boissons', mv: { s0: 1.25, s1: 1.25, x0: 60, x1: -60, y0: 0, y1: 0 } },
  { img: 'img/usage-event.webp', name: 'Événements', sub: 'Mariages, fêtes, concerts', mv: { s0: 1.22, s1: 1.22, x0: 0, x1: 0, y0: 70, y1: -50 } },
  { img: 'img/usage-poisson.webp', name: 'Poissonneries', sub: 'Fraîcheur des produits', mv: { s0: 1.3, s1: 1.12, x0: 0, x1: 0, y0: 0, y1: 0 } },
];
const SETTLE = 6;
const DECAY = 4;
const BLOOM = 7;

export const SectorsCuts: React.FC = () => {
  const f = useCurrentFrame();
  let seg = 0;
  for (let k = 1; k < SECTORS.length; k++) if (f >= cut(k)) seg = k;
  const s = SECTORS[seg];
  const a = cut(seg);
  const b = seg + 1 < SECTORS.length ? cut(seg + 1) : 59;
  const p = ramp(f, a, b - a, EASE.smooth);
  const settle = 1 - ramp(f, a, SETTLE, EASE.out);
  const bloom = seg === 0 ? 0 : 1 - ramp(f, a, BLOOM, EASE.out);
  const flash = seg === 0 ? 0 : f - a <= DECAY ? 0.95 * (1 - ramp(f, a, DECAY, EASE.out)) : 0;
  const sc = mix(s.mv.s0, s.mv.s1, p) * (1 + 0.03 * settle);
  const lab = ramp(f, a + 2, 7, EASE.snappy);
  const af = ramp(f, a, 5, EASE.out);
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden', fontFamily: FONT.sans }}>
      <Img src={staticFile(s.img)} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        transform: `translate(${mix(s.mv.x0, s.mv.x1, p).toFixed(1)}px, ${(mix(s.mv.y0, s.mv.y1, p) - 16 * settle).toFixed(1)}px) scale(${sc.toFixed(4)})`,
        filter: `brightness(${(1 + 0.9 * bloom).toFixed(3)}) contrast(${(1.05 - 0.2 * bloom).toFixed(3)}) saturate(1.05)`,
      }} />
      {/* étalonnage marque : ombres bleu nuit, bas assombri pour l'étiquette */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(4,14,36,0.45) 0%, rgba(4,14,36,0) 25%, rgba(4,14,36,0) 52%, rgba(4,14,36,0.92) 100%)' }} />
      <AbsoluteFill style={{ background: alpha(L.light, 0.12), mixBlendMode: 'soft-light' }} />
      {/* cadre de mise au point : se referme sur le centre à chaque coupe */}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: 0.85 * (1 - ramp(f, a + 8, 6, EASE.out)) }}>
        {(() => {
          const w = mix(760, 560, af);
          const h = mix(900, 660, af);
          const x = 540 - w / 2;
          const y = 820 - h / 2;
          const arm = 60;
          return <path d={`M${x} ${y + arm}V${y}H${x + arm} M${x + w - arm} ${y}H${x + w}V${y + arm} M${x + w} ${y + h - arm}V${y + h}H${x + w - arm} M${x + arm} ${y + h}H${x}V${y + h - arm}`}
            stroke="#e6f6ff" strokeWidth={5} fill="none" />;
        })()}
      </svg>
      {/* en-tête : compteur des secteurs */}
      <div style={{ position: 'absolute', left: 80, top: 150, display: 'flex', alignItems: 'center', gap: 20 }}>
        <GlaceurMark size={84} tone="dark" />
        <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 64, letterSpacing: '0.14em', color: '#f3faff' }}>POUR TOUS LES PROS</span>
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 420, opacity: lab, transform: `translateY(${((1 - lab) * 50).toFixed(1)}px)` }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 64, letterSpacing: '0.16em', color: '#8ecfff' }}>0{seg + 1} / 04</div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 168, lineHeight: 0.95, color: '#f3faff', textTransform: 'uppercase', marginTop: 8 }}>{s.name}</div>
        <div style={{ fontSize: 64, fontWeight: 600, color: '#bfe4ff', marginTop: 14 }}>{s.sub}</div>
      </div>
      {flash > 0.01 && <AbsoluteFill style={{ background: '#fff', opacity: flash }} />}
      <Vignette strength={0.4} color="#020812" />
      <Grain opacity={0.08} blend="soft-light" />
    </AbsoluteFill>
  );
};
