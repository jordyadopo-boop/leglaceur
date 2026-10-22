import React from 'react';
import { Composition, staticFile } from 'remotion';
import { Main, TOTAL } from './Main';
import { FPS } from './beat';
import { POSTER_IDS, PH, PW, Poster, SH } from './posters/Posters';

// Polices de la marque (Barlow / Barlow Condensed), chargées depuis public/fonts.
const faces: [string, string, number][] = [
  ['Barlow', 'Barlow-Regular.ttf', 400],
  ['Barlow', 'Barlow-SemiBold.ttf', 600],
  ['Barlow', 'Barlow-Bold.ttf', 700],
  ['Barlow Condensed', 'BarlowCondensed-SemiBold.ttf', 600],
  ['Barlow Condensed', 'BarlowCondensed-ExtraBold.ttf', 800],
];
const css = faces
  .map(([fam, file, w]) => `@font-face{font-family:"${fam}";src:url("${staticFile('fonts/' + file)}") format("truetype");font-weight:${w};font-display:block;}`)
  .join('\n');

export const RemotionRoot: React.FC = () => (
  <>
    <style>{css}</style>
    <Composition id="Promo" component={Main} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} defaultProps={{ bgm: true }} />
    {POSTER_IDS.map((id) => (
      <Composition key={id} id={`poster-${id}`} component={Poster} durationInFrames={1} fps={FPS} width={PW} height={PH} defaultProps={{ id }} />
    ))}
    {POSTER_IDS.map((id) => (
      <Composition key={`s-${id}`} id={`story-${id}`} component={Poster} durationInFrames={1} fps={FPS} width={PW} height={SH} defaultProps={{ id, story: true }} />
    ))}
  </>
);
