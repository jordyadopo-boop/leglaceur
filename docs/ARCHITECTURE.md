# Le Glaceur — contrat d'architecture

Site vitrine + devis en ligne de **Le Glaceur** (glace alimentaire, Abidjan, marque de SDLSIT Group).
Site statique (Vite multi-pages, JS natif, GSAP, Three.js, Lenis) déployé sur GitHub Pages.
Langue : **français** (Côte d'Ivoire). Monnaie : **F CFA**.

## Le parti pris : un site « fait de glace »

Le client veut un site captivant où **tout évoque la glace** : verre dépoli et givre, réfraction 3D,
condensation et gouttes, brume de carboglace, cristaux, reflets qui passent, froid qui gagne l'écran.
Le motion design est central (GSAP ScrollTrigger, SplitText, Flip, DrawSVG, MotionPath, Lenis).

- Fond clair givré (`--bg`, `--grad-ice`) alterné avec des sections « nuit polaire » marine (`.section--dark`, `--grad-polar`).
- Matières : `.frost` (verre dépoli + grain + reflet), `.ice-edge` (bordure lumineuse), `.ice-text` (texte glacé + reflet).
- Typo : **Barlow Condensed** 700/800 en capitales pour les titres (comme les affiches), **Barlow** pour le texte.
- Couleurs de la marque : marine `--ink-900` #0a1f44, bleu `--blue-600` #1563d6, glace `--ice-*`, feuille `--leaf` (rare).
- Une idée forte par section. Pas d'emoji, pas de faux témoignages, pas de chiffres inventés.
- Le contenu doit rester lisible sans JS et en `prefers-reduced-motion` (on anime **depuis** un état visible : `gsap.from`).

## Arborescence et propriété des fichiers

**Règle d'or : ne modifiez que les fichiers dont vous êtes propriétaire.** Plusieurs agents travaillent en même temps
dans ce dépôt. Si un fichier partagé doit changer, écrivez la demande dans `docs/requests/<votre-nom>.md`.

Fichiers partagés (propriétaire : intégrateur, ne pas modifier) :
`index.html`, `devis.html`, `guide.html`, `mentions-legales.html`, `404.html`, `vite.config.js`, `package.json`,
`src/js/main.js`, `src/js/config.js`, `src/js/core/*`, `src/styles/{tokens,base,components,main}.css`, `docs/ARCHITECTURE.md`,
`src/partials/seo/*`, `src/partials/layout/head-common.html`.

Ajouter une dépendance npm : interdit sans demande (déjà installées : gsap, three, lenis, jspdf, jspdf-autotable, exceljs, qrcode, sharp, playwright).

### Composition HTML (plugin Vite `html-composer`)
- `<!-- @include chemin/partiel.html -->` insère `src/partials/chemin/partiel.html` (récursif). Un partiel manquant n'empêche pas le build.
- `<!-- @img slot="glacons" alt="Glaçons alimentaires" sizes="(min-width: 900px) 40vw, 100vw" class="…" picture-class="…" eager -->`
  produit un `<picture>` AVIF/WebP responsive depuis `public/img/<slot>-<480|960|1600>.(avif|webp)` (dimensions lues dans `public/img/manifest.json`).
- `{{base}}` est remplacé par la base de déploiement (ex. `/` ou `/leglaceur/`). Liens internes entre pages : **relatifs** (`devis.html`, `guide.html#types`, `index.html#produits`), sauf dans `404.html` où l'on utilise `{{base}}`.
- Fichiers statiques depuis JS : `import.meta.env.BASE_URL + 'img/…'`.

### Modules JS (chargement à la demande)
Tout élément `data-module="nom autre"` charge `src/js/modules/<nom>.js` et appelle `export default function init(el, ctx)` (peut être async).
`ctx.page` vaut `home | devis | guide | mentions | notfound`. Tous les fichiers `src/styles/modules/*.css` sont chargés globalement :
**préfixez vos sélecteurs** par la classe racine de votre section (`.products …`) pour éviter les collisions.

Après l'initialisation de tous les modules, `main.js` exécute `initReveals()` (animations déclaratives, voir `src/js/core/reveal.js`) :
`data-reveal[="up|fade|scale|left|right"]`, `data-reveal-delay`, `data-reveal-stagger` (enfants en cascade), `data-split` (titre qui « gèle » lettre par lettre),
`data-parallax="0.2"`, `data-count="334"` (+ `data-count-suffix`, `data-count-decimals`). Événement `app:ready` sur `window` à la fin.

Import des outils d'animation : `import { gsap, ScrollTrigger, SplitText, Flip, DrawSVGPlugin, MotionPathPlugin, reducedMotion, finePointer, isMobile, getLenis } from '../core/motion.js'`
(ne jamais réenregistrer les plugins ni créer une seconde instance Lenis).

Autres utilitaires : `core/format.js` (`fcfa`, `fcfaShort`, `fcfaPlain`, `plainNumber`, `dateFr`), `core/whatsapp.js` (`waLink(text)`, `telLink`),
`core/toast.js` (`toast(msg)`), `core/quote-store.js` (panier du devis), `config.js` (**toutes** les données : produits, prix, contacts, zones, estimateur, contenu du guide).
**Aucun prix, numéro ou texte commercial en dur dans le JS** : lisez `config.js`. Dans le HTML statique, les prix doivent correspondre exactement à `config.js`
(et de préférence être remplis/vérifiés par le module au chargement via `data-price="sku"`).

### Plans (z-index) et en-tête
En-tête fixe de hauteur `--header-h` (76px). Utilisez les variables `--z-*`. Le badge du devis dans l'en-tête porte `data-quote-badge` (cible des animations « vers le devis »).

## Effets « glace » réutilisables (agent fx)
API déclarative (modules `fx-*.js`, styles `src/styles/modules/fx.css`). Les autres agents peuvent poser ces attributs **dès maintenant** :

| Attribut | Effet |
|---|---|
| `data-module="fx-ambient"` (déjà dans chaque page) | Ambiance globale : fines particules de givre, voile de givre sur les bords quand on défile vite |
| `data-module="fx-cursor"` (déjà dans chaque page) | Curseur cristal + traînée de givre (pointeur fin uniquement) |
| `data-module="fx-frost-wipe"` sur un conteneur positionné | Vitre embuée/givrée que l'on essuie au doigt/à la souris, qui se regivre lentement |
| `data-module="fx-droplets"` | Gouttes de condensation qui perlent et glissent sur la surface |
| `data-module="fx-fog"` | Brume de carboglace qui rampe au bas du conteneur |
| `data-module="fx-tilt"` | Inclinaison 3D + reflet glacé qui suit le pointeur |
| `data-module="fx-magnetic"` | Bouton magnétique |
| `data-module="fx-frost-border"` | Le givre se dessine sur les bords de l'élément à l'apparition |
| `data-module="fx-shatter"` | Éclats de glace au clic (petite explosion de cristaux) |

Plusieurs modules sur un même élément : `data-module="fx-tilt fx-droplets"`.

## Médias
Créneaux d'images (`public/img/<slot>-<w>.avif|webp`, agent photos) :
`glacons`, `gobelet`, `barres`, `pilee`, `carboglace`, `sac-glaceur`, `usage-cocktail`, `usage-whisky`, `usage-poisson`, `usage-event`,
`usage-jus`, `usage-restaurant`, `eau-pure`, `texture-glace`, `abidjan`.
Logo (agent brand) : partiels `src/partials/brand/logo-full.html` (logo horizontal, SVG inline, `currentColor`-friendly ou couleurs marque),
`src/partials/brand/logo-mark.html` (symbole G seul), `src/partials/brand/logo-full-white.html`, `src/partials/brand/sdlsit.html` ;
fichiers `public/brand/logo-full.svg`, `logo-mark.svg`, `logo-quote.png` (pour le PDF, 600px de large), favicons, `og-image.jpg` (1200×630).

## Devis (rubrique prioritaire)
Exigences du client (notes vocales) :
1. Le visiteur choisit **lui-même** les quantités (paquets, sacs, barres, gobelets). Un estimateur « nombre d'invités → paquets de glaçons »
   propose une quantité (`estimateBags()` dans `config.js`, règle du client : 30 → 5, 100 → 20, 400 → 40, 1 000 → 100) que le visiteur peut modifier.
2. **Aucun paiement en ligne.** Le calcul est automatique (sous-total, frais de transport, total).
3. **Transport** : livraison par zone (tarifs indicatifs **négociables**) **ou retrait sur place** à Abatta – Carrefour Drogba (adresse + itinéraire).
4. Le devis se télécharge en **PDF** et en **Excel** ; dans l'Excel, **les prix unitaires sont verrouillés**, seules les quantités (et les infos client/dates) sont modifiables, les totaux sont des formules.
5. Bouton **Envoyer sur WhatsApp** (message prérempli vers `BRAND.whatsapp`), présent sur le site **et** cliquable dans le PDF. Cela ouvre la discussion avec le client.
6. Mention : « Ce document est un devis et ne constitue pas une facture » (pas une FNE).

Interface documents (`src/js/quote/documents.js`, agent quote-docs) :
```js
export async function createPdf(q)  // → Promise<Blob>  (jsPDF + autotable, chargés à la demande)
export async function createXlsx(q) // → Promise<Blob>  (ExcelJS, chargé à la demande, feuille protégée)
export function whatsappMessage(q)  // → string (texte du message WhatsApp)
export function quoteFileName(q, ext) // → 'Devis-Le-Glaceur-GLC-261022-AB12.pdf'
```
`q` = `toQuoteData()` de `core/quote-store.js` :
`{ number, date, validUntil, client:{name,phone,email,company,type,note}, delivery:{mode,zoneId,zoneName,label,fee,address,date,slot}, lines:[{sku,name,label,unit,units,qty,price,total,kg}], subtotal, deliveryFee, total, totalKg, count, guests }`
(`fee`/`deliveryFee` = `null` → « sur devis »). jsPDF ne sait pas afficher U+202F : utilisez `fcfaPlain`/`plainNumber`.

Panier (`core/quote-store.js`) : `getState()`, `setQty(sku,q)`, `addQty(sku,d)`, `update(patch)`, `reset()`, `ensureNumber()`, `computeTotals()`, `toQuoteData()` ;
événement `window` `quote:change`. Persisté en `localStorage`, partagé entre pages (le bouton « Ajouter au devis » de l'accueil remplit le même panier).

## Qualité attendue
- Mobile d'abord (360 px) jusqu'au grand écran (1920 px). Aucun défilement horizontal. Cibles tactiles ≥ 44 px.
- Accessibilité : HTML sémantique, `alt` pertinents, contrastes AA, focus visible, `aria-*` corrects, navigation clavier, `prefers-reduced-motion` respecté.
- Performance : Three.js et ExcelJS/jsPDF chargés à la demande ; pauser les boucles `requestAnimationFrame` hors écran (IntersectionObserver) et quand l'onglet est caché ;
  limiter le `devicePixelRatio` des canvas (≤ 2, ≤ 1.5 sur mobile) ; pas de layout thrashing.
- Zéro erreur console. Le build (`npx vite build`) doit passer.

## Protocole de test pour les agents
- Serveur de dev : `npx vite --port <votre port> --strictPort` en arrière-plan (port attribué dans votre consigne) ; arrêtez-le à la fin.
- Build de contrôle : `npx vite build --outDir <scratchpad>/build-<nom> --emptyOutDir` (jamais dans `dist/`).
- Captures Playwright (Node, `import { chromium } from 'playwright'`) :
  `chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })`.
  Testez au moins 390×844 (mobile) et 1440×900 (bureau). Écoutez `page.on('console')` / `pageerror`.
  Scripts et captures dans le dossier scratchpad indiqué dans votre consigne, jamais dans le dépôt.
