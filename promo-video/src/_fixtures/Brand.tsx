// Le Glaceur — remplace le Brand de video-shotcraft. Logos officiels du site (public/brand),
// couleurs des tokens CSS du site (src/styles/tokens.css), textes vérifiés dans src/js/config.js.
import React from 'react';
import { Img, staticFile } from 'remotion';

export const BRAND = {
  name: 'Le Glaceur',
  site: 'leglaceur.ci',
  tagline: 'La fraîcheur sous toutes ses formes',
  whatsapp: '+225 07 89 85 16 86',
  blue: '#2f8cf2',
  blue2: '#6db3ff',
  ice: '#8ecfff',
  ice2: '#c6e8ff',
  night: '#0a1f44',
  deep: '#040e24',
  paper: '#f3faff',
  font: '"Barlow Condensed", "Barlow", Arial, sans-serif',
  body: '"Barlow", Arial, sans-serif',
} as const;

// Pictogramme (512×512) — version fond sombre par défaut.
export const GlaceurMark: React.FC<{ size?: number; tone?: 'dark' | 'white'; style?: React.CSSProperties }> = ({ size = 96, tone = 'dark', style }) => (
  <Img src={staticFile(tone === 'white' ? 'brand/logo-mark-white.svg' : 'brand/logo-mark-on-dark.svg')} style={{ width: size, height: size, display: 'block', ...style }} />
);

// Logo complet blanc (ratio 693.63 × 214.86).
export const GlaceurLogo: React.FC<{ width?: number; style?: React.CSSProperties }> = ({ width = 600, style }) => (
  <Img src={staticFile('brand/logo-full-white.svg')} style={{ width, height: (width * 214.86) / 693.63, display: 'block', ...style }} />
);

// Logo empilé (ratio 478.92 × 459.41) — couleurs d'origine.
export const GlaceurStacked: React.FC<{ width?: number; style?: React.CSSProperties }> = ({ width = 480, style }) => (
  <Img src={staticFile('brand/logo-stacked.svg')} style={{ width, height: (width * 459.41) / 478.92, display: 'block', ...style }} />
);

export const PRODUCTS = [
  { key: 'glacons', name: 'Glace cubique', unit: 'pack 5 kg', price: '750', img: 'img/glacons.webp' },
  { key: 'grain', name: 'Glace en grain', unit: 'pack 5 kg', price: '750', img: 'img/texture-glace.webp' },
  { key: 'pilee', name: 'Glace pilée', unit: 'sac 50 kg', price: '3 000', img: 'img/pilee.webp' },
  { key: 'carbo', name: 'Carboglace', unit: 'le kilo', price: '7 500', img: 'img/carboglace.webp' },
  { key: 'cup', name: 'Ice Cup', unit: 'le gobelet', price: '250', img: 'img/gobelet.webp' },
  { key: 'barre5', name: 'Barre 5 kg', unit: 'la barre', price: '350', img: 'img/barres.webp' },
  { key: 'barre10', name: 'Barre 10 kg', unit: 'la barre', price: '650', img: 'img/barres.webp' },
] as const;
