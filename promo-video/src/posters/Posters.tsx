// Visuels fixes 4:5 (1080×1350) et story 9:16 (1080×1920, marges hautes/basses pour l'interface) pour les réseaux et la pub, dans la charte de la vidéo.
// Une composition par visuel (voir Root) ; rendu : npm run posters.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { FONT } from '../_fixtures/Polish';
import { LOOKS, alpha } from '../_fixtures/Look';
import { GlaceurLogo, GlaceurMark } from '../_fixtures/Brand';

const L = LOOKS.glaceur;
export const PW = 1080;
export const PH = 1350;
export const SH = 1920;
// En story : décalage des blocs hors des zones couvertes par l'interface (haut / bas)
const Story = React.createContext(false);
const useOff = () => (React.useContext(Story) ? { t: 250, b: 290 } : { t: 0, b: 0 });
const GREEN = '#25d366';

const WaIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <circle cx={32} cy={32} r={30} fill={GREEN} />
    <path d="M22 18c2-1 4 0 5 2l2 5c0 2-1 3-2 4 1 3 4 6 7 7 1-1 2-2 4-2l5 2c2 1 3 3 2 5-2 4-6 5-10 3-8-3-14-9-17-17-1-4 0-7 4-9z" fill="#fff" />
  </svg>
);

// Bandeau bas commun : site + WhatsApp
const Footer: React.FC = () => {
  const { b } = useOff();
  return (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: b, height: 120, padding: '0 60px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: b ? 'none' : alpha('#020817', 0.82), borderTop: b ? 'none' : `2px solid ${alpha(L.accent2, 0.35)}`,
    fontFamily: FONT.display, fontWeight: 700, fontSize: 44, color: L.ink, letterSpacing: '0.02em',
  }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}><GlaceurMark size={56} />leglaceur.ci</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}><WaIcon size={48} />+225 07 89 85 16 86</span>
  </div>
  );
};

// En story : fond qui fonce sous le pied (zone de l'interface), placé derrière le contenu
const StoryShade: React.FC = () => {
  const { b } = useOff();
  return b > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: b + 360, background: `linear-gradient(180deg, ${alpha(L.bg[2], 0)} 0%, ${alpha(L.bg[2], 0.8)} 40%, ${L.bg[2]} 100%)` }} /> : null;
};

// Fond photo plein cadre + dégradé de lisibilité
const Photo: React.FC<{ src: string; pos?: string; shade?: number; top?: boolean }> = ({ src, pos = '50% 50%', shade = 0.9, top }) => (
  <>
    <Img src={staticFile(`img/${src}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos }} />
    <div style={{
      position: 'absolute', inset: 0,
      background: top
        ? `linear-gradient(180deg, ${alpha(L.bg[2], shade)} 0%, ${alpha(L.bg[2], shade * 0.55)} 38%, ${alpha(L.bg[2], 0)} 60%, ${alpha(L.bg[2], 0.5)} 100%)`
        : `linear-gradient(180deg, ${alpha(L.bg[2], 0.35)} 0%, ${alpha(L.bg[2], 0)} 30%, ${alpha(L.bg[2], shade * 0.7)} 58%, ${alpha(L.bg[2], shade)} 80%)`,
    }} />
    <StoryShade />
  </>
);

const Gradient: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 90% 60% at 50% 30%, ${L.bg[0]} 0%, ${L.bg[1]} 50%, ${L.bg[2]} 100%)` }}><StoryShade /></div>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 40, letterSpacing: '0.22em', textTransform: 'uppercase', color: L.accent2, textShadow: `0 2px 18px ${alpha('#000', 0.7)}` }}>{children}</div>
);
const Title: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 150 }) => (
  <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: size, lineHeight: 0.92, textTransform: 'uppercase', color: L.ink, marginTop: 10, textShadow: `0 6px 40px ${alpha('#000', 0.45)}` }}>{children}</div>
);
const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 40, lineHeight: 1.3, color: L.ink2, marginTop: 22 }}>{children}</div>
);
const Price: React.FC<{ value: string; unit: string }> = ({ value, unit }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 26 }}>
    <span style={{
      fontFamily: FONT.display, fontWeight: 800, fontSize: 110, lineHeight: 1, color: L.onAccent,
      background: `linear-gradient(180deg, ${L.ink} 0%, ${L.accent2} 100%)`, padding: '8px 30px 4px', borderRadius: 24,
    }}>{value} F</span>
    <span style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 42, color: L.ink }}>{unit}</span>
  </div>
);
const Block: React.FC<{ children: React.ReactNode; bottom?: number; top?: number }> = ({ children, bottom = 180, top }) => {
  const { t, b } = useOff();
  return <div style={{ position: 'absolute', left: 70, right: 70, ...(top !== undefined ? { top: top + t } : { bottom: bottom + b }) }}>{children}</div>;
};

const POSTERS: Record<string, React.FC> = {
  // 1 · marque
  marque: () => (
    <>
      <Photo src="texture-glace.webp" shade={0.75} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingBottom: 120 }}>
        <GlaceurLogo width={820} />
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 72, color: L.ink, marginTop: 50, textTransform: 'uppercase', letterSpacing: '0.03em' }}>La fraîcheur sous toutes ses formes</div>
        <div style={{ marginTop: 24 }}><Eyebrow>Glace alimentaire · Abidjan</Eyebrow></div>
      </AbsoluteFill>
      <Footer />
    </>
  ),
  // 2 · glaçons
  glacons: () => (
    <>
      <Photo src="glacons.webp" />
      <Block><Eyebrow>Glace cubique & en grain</Eyebrow><Title>Des glaçons<br />purs et nets</Title><Price value="750" unit="le pack de 5 kg" /></Block>
      <Footer />
    </>
  ),
  // 3 · carboglace
  carboglace: () => (
    <>
      <Photo src="carboglace.webp" />
      <Block><Eyebrow>Glace carbonique · −78,5 °C</Eyebrow><Title>Carboglace</Title><Body>Effets de fumée, transport et conservation au grand froid.</Body><Price value="7 500" unit="le kilo" /></Block>
      <Footer />
    </>
  ),
  // 4 · livraison offerte
  livraison: () => (
    <>
      <Photo src="sac-glaceur.webp" />
      <Block><Eyebrow>Partout à Abidjan</Eyebrow><Title size={170}>Livraison<br />offerte</Title>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 80, color: L.accent2, textTransform: 'uppercase', marginTop: 16 }}>dès 20 articles</div>
      </Block>
      <Footer />
    </>
  ),
  // 5 · 24h/24
  horaires: () => (
    <>
      <Photo src="abidjan.webp" shade={0.95} />
      <Block><Eyebrow>Commande en ligne</Eyebrow>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 230, lineHeight: 0.9, color: '#9fe8ff', textShadow: `0 0 40px ${alpha('#38d9ff', 0.55)}` }}>24H/24</div>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 230, lineHeight: 0.9, color: L.ink }}>7J/7</div>
        <Body>Commandez à toute heure sur leglaceur.ci ou sur WhatsApp.</Body>
      </Block>
      <Footer />
    </>
  ),
  // 6 · engagements
  piliers: () => (
    <>
      <Photo src="eau-pure.webp" shade={0.92} top />
      <Block top={90}><Eyebrow>Nos engagements</Eyebrow>
        {[['Pureté', 'Une eau traitée et contrôlée'], ['Hygiène', 'Des normes strictes'], ['Qualité', 'Conditionnement soigné']].map(([w, s]) => (
          <div key={w} style={{ marginTop: 26, display: 'flex', alignItems: 'baseline', gap: 26 }}>
            <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 120, lineHeight: 1, color: L.ink, textTransform: 'uppercase', width: 430 }}>{w}</span>
            <span style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 40, color: L.ink2 }}>{s}</span>
          </div>
        ))}
      </Block>
      <Footer />
    </>
  ),
  // 7 · professionnels
  pros: () => {
    const { t } = useOff();
    return (
    <>
      <Gradient />
      <div style={{ position: 'absolute', left: 70, right: 70, top: 280 + t, height: t ? 680 : 600, display: 'flex', gap: 18 }}>
        {[['usage-restaurant.webp', 'Restaurants'], ['usage-cocktail.webp', 'Bars'], ['usage-event.webp', 'Événements']].map(([src, label]) => (
          <div key={src} style={{ flex: 1, position: 'relative', borderRadius: 28, overflow: 'hidden', border: `2px solid ${alpha(L.accent2, 0.3)}` }}>
            <Img src={staticFile(`img/${src}`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '60px 0 22px', textAlign: 'center', background: `linear-gradient(180deg, transparent, ${alpha(L.bg[2], 0.9)})`, fontFamily: FONT.display, fontWeight: 800, fontSize: 46, color: L.ink, textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>
      <Block top={90}><Eyebrow>Pour les pros & particuliers</Eyebrow><Title size={96}>La glace qu'il vous faut</Title></Block>
      <Block bottom={170}><Body>Restaurants, bars, lounges, poissonneries, mariages, fêtes…<br />Devis en ligne en 1 minute sur leglaceur.ci.</Body></Block>
      <Footer />
    </>
    );
  },
  // 8 · grille tarifaire
  tarifs: () => {
    const { t } = useOff();
    return (
    <>
      <Gradient />
      <Block top={90}><Eyebrow>Nos prix</Eyebrow><Title size={130}>Toute la gamme</Title></Block>
      <div style={{ position: 'absolute', left: 70, right: 70, top: 340 + t * 0.9 }}>
        {[['Glace cubique', '750 F', 'pack 5 kg'], ['Glace en grain', '750 F', 'pack 5 kg'], ['Glace pilée', '3 000 F', 'sac 50 kg'],
          ['Carboglace', '7 500 F', 'le kilo'], ['Ice Cup', '250 F', 'le gobelet'], ['Barre 5 kg', '350 F', 'la barre'], ['Barre 10 kg', '650 F', 'la barre']].map(([n, p, u], i) => (
          <div key={n} style={{ height: t ? 122 : 112, display: 'flex', alignItems: 'center', borderBottom: i < 6 ? `2px solid ${L.line}` : undefined }}>
            <span style={{ flex: 1, fontFamily: FONT.display, fontWeight: 800, fontSize: 64, color: L.ink, textTransform: 'uppercase' }}>{n}</span>
            <span style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 34, color: L.ink3, marginRight: 30 }}>{u}</span>
            <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 64, color: L.accent2, width: 240, textAlign: 'right' }}>{p}</span>
          </div>
        ))}
      </div>
      <Footer />
    </>
    );
  },
  // 9 · Ice Cup
  icecup: () => (
    <>
      <Photo src="gobelet.webp" />
      <Block><Eyebrow>Prêt à servir</Eyebrow><Title>Ice Cup</Title><Body>Le gobelet de glace pour vos boissons, partout.</Body><Price value="250" unit="le gobelet" /></Block>
      <Footer />
    </>
  ),
  // 10 · glace pilée
  pilee: () => (
    <>
      <Photo src="pilee.webp" />
      <Block><Eyebrow>Poissonneries · cocktails · étals</Eyebrow><Title>Glace pilée</Title><Body>En grand volume pour garder vos produits au frais.</Body><Price value="3 000" unit="le sac de 50 kg" /></Block>
      <Footer />
    </>
  ),
};
export const POSTER_IDS = Object.keys(POSTERS);

export const Poster: React.FC<{ id: string; story?: boolean }> = ({ id, story = false }) => {
  const C = POSTERS[id];
  return (
    <AbsoluteFill style={{ background: L.bg[2], overflow: 'hidden' }}>
      <Story.Provider value={story}><C /></Story.Provider>
    </AbsoluteFill>
  );
};
