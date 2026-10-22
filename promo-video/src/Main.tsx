// Promo Le Glaceur · 9:16 · 30 fps. Source de vérité du montage : SHOTS (bornes en temps de beat).
import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion';
import { beatF } from './beat';
import { TempChart } from './shots/S01TempChart';
import { FractureReveal } from './shots/S02Fracture';
import { TaglineSweep } from './shots/S03Tagline';
import { PillarsRelay } from './shots/S04Pillars';
import { CardsFlourish } from './shots/S05Cards';
import { PriceList } from './shots/S06PriceList';
import { CarboFlip } from './shots/S07Carbo';
import { SectorsCuts } from './shots/S08Sectors';
import { SectorWords } from './shots/S09Words';
import { SiteAssemble } from './shots/S10Site';
import { QuoteGlitch } from './shots/S11Quote';
import { ClonerTwenty } from './shots/S12Cloner';
import { NeonHours } from './shots/S13Neon';
import { InkCta } from './shots/S14Cta';

type Shot = { key: string; a: number; b: number; C: React.FC };
const PLAN: Shot[] = [
  { key: 'chart', a: 0, b: 4, C: TempChart },
  { key: 'fracture', a: 4, b: 8, C: FractureReveal },
  { key: 'tagline', a: 8, b: 12, C: TaglineSweep },
  { key: 'pillars', a: 12, b: 18, C: PillarsRelay },
  { key: 'cards', a: 18, b: 22, C: CardsFlourish },
  { key: 'prices', a: 22, b: 28, C: PriceList },
  { key: 'carbo', a: 28, b: 32, C: CarboFlip },
  { key: 'sectors', a: 32, b: 36, C: SectorsCuts },
  { key: 'words', a: 36, b: 40, C: SectorWords },
  { key: 'site', a: 40, b: 44, C: SiteAssemble },
  { key: 'quote', a: 44, b: 50, C: QuoteGlitch },
  { key: 'cloner', a: 50, b: 54, C: ClonerTwenty },
  { key: 'neon', a: 54, b: 58, C: NeonHours },
  { key: 'cta', a: 58, b: Infinity, C: InkCta }, // jusqu'à TOTAL
];
export const TOTAL = 964;
const endOf = (s: Shot) => (Number.isFinite(s.b) ? beatF(s.b) : TOTAL);
export const SHOTS = Object.fromEntries(PLAN.map((s) => [s.key, { from: beatF(s.a), dur: endOf(s) - beatF(s.a) }]));

// SFX : `at` = image où le pic doit tomber ; `pk` = délai du pic dans le fichier (s, mesuré) ;
// départ = at − pk·30 − 1,28 (latence AAC, S5). `len` tronque le son (images), `v` = volume.
type Cue = { f: string; at: number; pk: number; v: number; len?: number };
const L = beatF;
const SFX: Cue[] = [
  { f: 'data-scan', at: 2, pk: 0.12, v: 0.5, len: 50 }, // courbe qui démarre
  { f: 'transition-tech', at: L(4) - 4, pk: 0.55, v: 0.45, len: 24 }, // montée vers −18 °C
  { f: 'glass-break-hammer', at: L(4), pk: 0.02, v: 0.5 }, // impact 1 : fracture
  { f: 'impact-cine-big', at: L(4), pk: 2.17, v: 0.45, len: 90 },
  { f: 'light-sweep-magic', at: L(8) + 10, pk: 1.55, v: 0.5, len: 60 }, // balayage tagline
  ...[12, 14, 16].map((n) => ({ f: 'transition-tech-slide', at: L(n), pk: 0.12, v: 0.45, len: 30 })), // piliers
  { f: 'wind-woosh-throw', at: L(18), pk: 0.16, v: 0.6 }, // cartes
  ...[23, 24, 25, 26, 27].map((n) => ({ f: 'switch-tap', at: L(n), pk: 0.01, v: 0.55, len: 20 })), // tarifs
  { f: 'impact-transition', at: L(28), pk: 0.98, v: 0.45, len: 60 }, // impact 2 : carboglace
  { f: 'bass-hit-short', at: L(28), pk: 0.09, v: 0.4 },
  { f: 'whoosh-swirl', at: L(29), pk: 1.97, v: 0.45, len: 70 }, // retournement
  ...[32, 33, 34, 35].map((n) => ({ f: 'camera-lens-shutter', at: L(n), pk: 0.03, v: 0.6, len: 25 })), // coupes secteurs
  { f: 'air-zoom-vacuum', at: L(36), pk: 0.45, v: 0.5 }, // tunnel de mots
  { f: 'transition-tech-slide', at: L(40), pk: 0.12, v: 0.5, len: 40 }, // site
  { f: 'ui-confirm-tone', at: L(40) + 36, pk: 0.2, v: 0.45, len: 30 }, // « EN LIGNE »
  ...[44, 45, 46, 47].map((n) => ({ f: 'glitch-electric-small', at: L(n), pk: 0.3, v: 0.4, len: 20 })), // devis
  { f: 'ui-success-soft', at: L(48), pk: 0.26, v: 0.55, len: 40 }, // « EN 1 MIN »
  { f: 'clock-knob-spin', at: L(50) + 6, pk: 0.21, v: 0.9 }, // clones
  { f: 'bass-hit-short', at: L(50) + 36, pk: 0.09, v: 0.55 }, // ×20
  { f: 'power-up-static', at: L(54), pk: 0.72, v: 0.4, len: 40 }, // néon
  ...[55, 56].map((n) => ({ f: 'switch-light', at: L(n), pk: 0.07, v: 0.6 })),
  { f: 'power-up-electronic', at: L(57), pk: 0.35, v: 0.4, len: 40 },
  { f: 'water-drop-cave', at: L(58) + 2, pk: 0.07, v: 0.6, len: 40 }, // goutte d'encre
  { f: 'riser-cine', at: L(60) - 35, pk: 1.17, v: 0.35, len: 70 }, // montée vers l'impact final
  { f: 'impact-deep-whoosh', at: L(60), pk: 0.63, v: 0.75, len: 70 }, // impact 3 : CTA
  { f: 'sparkle', at: L(58) + 54, pk: 1.38, v: 0.45, len: 60 }, // éclat du logo
];
const startOf = (c: Cue) => Math.max(0, Math.round(c.at - c.pk * 30 - 1.28));
const BGM_FROM = Math.round(61.069 * 30);
const BGM_VOL = 0.34;

export const Main: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <AbsoluteFill style={{ background: '#040e24' }}>
    {PLAN.map((s) => (
      <Sequence key={s.key} from={beatF(s.a)} durationInFrames={endOf(s) - beatF(s.a)} name={s.key}>
        <s.C />
      </Sequence>
    ))}
    {bgm && (
      <Audio src={staticFile('audio/house-vibez.mp3')} startFrom={BGM_FROM}
        volume={(f) => BGM_VOL * interpolate(f, [0, 6, TOTAL - 30, TOTAL], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
    )}
    {SFX.map((c, i) => (
      <Sequence key={i} from={startOf(c)} durationInFrames={c.len ? c.len + Math.round(c.pk * 30) : undefined} name={`sfx:${c.f}`}>
        <Audio src={staticFile(`audio/sfx/${c.f}.mp3`)} volume={c.v} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
