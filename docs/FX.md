# Effets « glace » — API (agent fx)

Bibliothèque d'effets qui rend le site « fait de glace ». Tout est **déclaratif** : on pose un attribut
`data-module` sur un élément, `main.js` charge le module à la demande et appelle `init(el)`.
Chaque module est **idempotent** (deux appels sur le même élément ne font rien de plus) et **décoratif**
(calques `aria-hidden`, `pointer-events: none` : les liens et boutons restent utilisables).

```html
<div class="ma-carte" data-module="fx-tilt fx-droplets">…</div>
```

| Module | Où le poser | Effet | Options (`data-*`) |
|---|---|---|---|
| `fx-ambient` | `.fx-ambient` (déjà dans chaque page) | Poussière de givre qui dérive et scintille (canvas plein écran, très discret) + **voile de givre** WebGL sur les bords de l'écran : il pousse le long de cristaux en fougère quand on défile vite, fond quand on s'arrête. Givre léger à l'arrivée sur la page. | — |
| `fx-cursor` | `.fx-cursor` (déjà dans chaque page) | Petit cristal + anneau fin qui grossit sur les éléments interactifs et épouse les boutons, traînée de poussière de glace. Pointeur fin seulement. | `data-cursor="Voir"` sur n'importe quel élément : l'anneau affiche ce libellé. `data-cursor-stick` : l'anneau épouse l'élément. |
| `fx-frost-wipe` | Conteneur **positionné** contenant une image (`<picture>`/`<img>`) | Vitre givrée et embuée (image floutée, grain, cristaux depuis les bords, micro-buée) qu'on **essuie** à la souris (survol) ou au doigt ; gouttelettes au bord du tracé, puis le givre repousse lentement par plaques. | `data-wipe-hint` (étiquette + main fantôme qui essuie une première bande ; texte libre, « Essuyez la buée » si vide), `data-wipe-brush="44"` (rayon px), `data-wipe-regrow="9"` (s), `data-wipe-opacity="1"` |
| `fx-droplets` | Visuel (image) ou carte | Condensation : tapis de micro-gouttelettes + gouttes qui **réfractent** l'image (lentille inversée), perlent, puis glissent par à-coups en laissant une traînée claire ; la buée se reforme. Frôler une goutte mûre la fait partir. | `data-droplets-density="1"` (0,3 → 2, ou `low` / `high`), `data-droplets-haze="0"` (sans buée) |
| `fx-fog` | Visuel ou carte (carboglace) | Brume qui rampe au bas du conteneur (3 nappes en parallaxe + bouffées), s'écarte du pointeur / du doigt, ondule au défilement. | `data-fog-height="0.5"`, `data-fog-density="1"`, `data-fog-layer="over\|under"` (auto : au-dessus d'une image qui remplit le conteneur, sinon **derrière** le texte) |
| `fx-tilt` | Carte | Inclinaison 3D douce vers le pointeur + reflet spéculaire et liseré lumineux du côté de la lumière. Rien au tactile. | `data-tilt="7"` (degrés max), `data-tilt-scale="1.015"`, `data-tilt-glare="0"` |
| `fx-magnetic` | Bouton / lien | Attraction magnétique (l'icône `svg` enfant suit un peu plus), retour élastique. | `data-magnetic="0.32"`, `data-magnetic-radius="56"`, `data-magnetic-inner` sur un enfant |
| `fx-frost-border` | Carte / panneau | À l'apparition, givre fractal (croissance dendritique) depuis les coins et les bords, qui se retire en partie ; un liseré cristallin fait le tour de l'élément. Ensuite plus rien ne tourne. | `data-frost-depth="70"` (px), `data-frost-delay="0.2"` (s), `data-frost-edges="top left"`, `data-frost-final="0.6"` |
| `fx-shatter` | Bouton (« Ajouter au devis »…) | Au clic (souris, doigt, clavier) : éclats de glace translucides avec reflets, rotation et gravité + onde de choc ; le bouton encaisse le choc. | `data-shatter="1"` (puissance), `data-shatter-count="26"` |

Ton clair / sombre : détecté automatiquement (`.section--dark`, `.frost--dark`, `.is-dark`, toute classe
`…--night` ou `…--dark` d'un ancêtre). Forcer avec `data-fx-tone="dark|light"` sur l'élément ou un ancêtre.

## Intégration dans une section (z-index)

- Les calques sont des `<canvas class="fx-layer …">` en `position: absolute; inset: 0` ajoutés **dans** l'élément
  (qui devient `position: relative` s'il était `static`), avec `border-radius: inherit`.
- `fx-frost-border` : `z-index: 1`. Placez votre contenu au-dessus :
  `.ma-carte > :not(.fx-layer) { position: relative; z-index: 3; }`.
- `fx-droplets`, `fx-fog` (mode `over`), `fx-frost-wipe` : `z-index: 2` → au-dessus de l'image, sous vos éléments à `z-index ≥ 3`.
- `fx-fog` en mode `under` : `z-index: -1` dans l'élément (qui reçoit `isolation: isolate`) → sous le texte.
- `fx-tilt` ajoute `.fx-tilt__glare` (`z-index: 3`) et pilote `rotationX/Y` + `scale` **via GSAP** : n'animez pas
  `transform` de cet élément en CSS (animez plutôt un parent ou un enfant).
- `fx-frost-wipe` ajoute `.fx-wipe-host` (utile pour masquer un décor de secours, voir `.cta__fog`) et `.fx-wipe-hint`.
- `fx-frost-border` ajoute `.fx-frost-border-host`, puis `.is-frosting` / `.is-frosted`.

## API JavaScript

```js
// Coup de givre sur tout l'écran (ex. célébration « Livraison offerte ! ») :
window.dispatchEvent(new CustomEvent('fx:frost', { detail: { level: 0.7, hold: 0.5 } }));

// Éclats de glace en un point de l'écran (coordonnées clientX/clientY) :
window.dispatchEvent(new CustomEvent('fx:shatter', { detail: { x, y, count: 30, power: 1.2 } }));
// ou, depuis un module : import { shatterAt } from '../fx/shatter-engine.js';
```
L'événement `fx:shatter` est écouté dès qu'un élément `fx-shatter` existe sur la page ; `shatterAt` fonctionne partout.

## Architecture (`src/js/fx/`)

| Fichier | Rôle |
|---|---|
| `env.js` | Préférences (`reducedMotion`, `finePointer`, `isMobile`, `lowPower`), DPR plafonné, maths (`damp`, `clamp`…), hasard reproductible, `claim()` (idempotence), `toneOf()` |
| `loop.js` | **Une seule boucle** greffée sur le ticker GSAP (même rAF que GSAP et Lenis) ; tâches `createTask(name, fn)` démarrées/arrêtées à la demande ; détachée quand l'onglet est caché. En dev : `__fxStats()` (ms par image et par effet), `__fxActive()` |
| `visibility.js` | IntersectionObserver partagé : `watchVisibility(el, cb)`, `onceInView(el, cb)` |
| `layer.js` | Calque canvas auto-dimensionné (ResizeObserver, DPR plafonné), dessin d'une image telle qu'affichée (`object-fit`) |
| `sprites.js` | Textures procédurales en cache : scintillement, goutte (lentille), micro-gouttelette, pinceau, grain de givre, nappes et bouffées de brume |
| `crystals.js` | Croissance dendritique du givre (tiges + barbes à 60°, étoiles à six branches) avec temps d'apparition par segment |
| `frost-veil.js` | Voile de givre WebGL (carte de temps de gel + shader : relief, voile laiteux, grain, éclats), repli 2D |
| `shatter-engine.js` | Canvas global des éclats, créé au premier usage |

## Performance

- Aucune boucle hors écran ni onglet caché ; les effets « posés » (bordure givrée, vitre au repos) ne tournent plus du tout.
- Textures générées une fois et mises en cache ; à chaque image, on ne redessine que ce qui bouge
  (zones des grosses gouttes, éclats vivants, masque d'essuyage).
- DPR ≤ 2 (≤ 1,5 sur mobile ; brume en demi-résolution ; vitre ≤ 1,5).
- Le voile WebGL ne dessine que des bandes le long des bords. **Régulateur** : si plusieurs images d'affilée sont lentes
  pendant qu'il est affiché, sa résolution baisse, puis il passe au repli 2D (simple opacité). En dev, `?fx-hq` désactive le régulateur.
- Mesuré (lab, Chromium logiciel) : moins de 1 ms de JavaScript par image pour l'ensemble des effets visibles.

## Accessibilité

- `prefers-reduced-motion` : ambiance, curseur, vitre, brume, inclinaison, magnétisme et éclats sont désactivés ;
  la bordure givrée est posée d'emblée et la condensation reste affichée, immobile.
- Sans JavaScript, rien n'est masqué : les calques n'existent pas.
- Tous les calques sont `aria-hidden` ; l'étiquette « Essuyez la buée » est décorative (le contenu reste lisible sans essuyer).
- Impression : tous les calques sont masqués.
