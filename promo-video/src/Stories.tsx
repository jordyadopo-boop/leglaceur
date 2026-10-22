// Stories 9:16 de 10 s environ : extraits de la promo (images + SFX d'origine) recollés sur les temps,
// fin commune sur le CTA (L58 → fin). BGM continue posée par-dessus, alignée sur la grille de beats.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion';
import { beatF } from './beat';
import { BGM_FROM, BGM_VOL, Main, TOTAL } from './Main';

// segments en temps de beat [a, b) ; Infinity = jusqu'à la fin (CTA)
const CTA: [number, number] = [58, Infinity];
export const STORIES: Record<string, [number, number][]> = {
  marque: [[4, 8], [8, 12], [12, 18], CTA], // fracture, slogan, piliers
  prix: [[18, 22], [22, 28], [28, 32], CTA], // cartes, tarifs, carboglace
  froid: [[0, 4], [4, 8], [28, 32], CTA], // courbe −18 °C, fracture, carboglace
  pros: [[32, 36], [36, 40], [50, 54], CTA], // secteurs, mots, livraison offerte
  commande: [[40, 44], [44, 50], [54, 58], CTA], // site, devis, 24h/24
};
const end = (b: number) => (Number.isFinite(b) ? beatF(b) : TOTAL);
const lenOf = (s: [number, number]) => end(s[1]) - beatF(s[0]);
export const storyDuration = (id: string) => STORIES[id].reduce((t, s) => t + lenOf(s), 0);

export const Story: React.FC<{ id: string; bgm: boolean }> = ({ id, bgm }) => {
  const segs = STORIES[id];
  const total = storyDuration(id);
  let at = 0;
  return (
    <AbsoluteFill style={{ background: '#040e24' }}>
      {segs.map((s, i) => {
        const from = at;
        at += lenOf(s);
        return (
          <Sequence key={i} from={from} durationInFrames={lenOf(s)} name={`seg ${s[0]}`}>
            <Sequence from={-beatF(s[0])}><Main bgm={false} /></Sequence>
          </Sequence>
        );
      })}
      {bgm && (
        <Audio src={staticFile('audio/house-vibez.mp3')} startFrom={BGM_FROM + beatF(segs[0][0])}
          volume={(f) => BGM_VOL * interpolate(f, [0, 6, total - 30, total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      )}
    </AbsoluteFill>
  );
};
