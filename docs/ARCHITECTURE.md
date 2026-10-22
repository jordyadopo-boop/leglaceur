# Le Glaceur — contrat d'architecture

> ## ⚠️ CONSIGNES CLIENT PRIORITAIRES (22/10, elles REMPLACENT toute consigne contraire de ta mission)
> 1. **PAS D'ESTIMATEUR « nombre d'invités → nombre de sacs », nulle part sur le site.** Le client veut que le visiteur
>    choisisse **librement** la quantité de chaque article (paquets, sacs, barres, gobelets). C'est ce choix qui génère le devis.
>    `ESTIMATOR` et `estimateBags` ont été retirés de `config.js` : ne les recrée pas, n'affiche aucune règle d'invités.
> 2. **Agent convert-a** : la section `home/estimator.html` devient **« Composez votre commande »** (garde le fichier,
>    `id="commande"`, classe `.order-express`, module `estimator.js`) : tous les articles disponibles (une ligne par variante,
>    miniature, prix unitaire, sélecteur de quantité libre `.stepper` relié à `core/quote-store`), total qui s'anime en direct,
>    poids total, bouton « Générer mon devis » (devis.html, le panier est déjà rempli) + « Envoyer sur WhatsApp ».
>    Scénographie glace spectaculaire (section sombre, le total « gèle », un cristal saute à chaque +1, les glaçons s'empilent
>    visuellement selon la quantité totale) : c'est cette section qui doit donner envie de commander.
> 3. **Agent quote-ui** : pas d'estimateur d'invités dans la page devis ; seulement le choix libre des quantités par article.
> 4. **Agent chrome** : dans la navigation, remplace « Estimer » par **« Commander »** → `index.html#commande`.
> 5. **Agent convert-b** : pas de question FAQ sur le nombre d'invités ; à la place « Quelle quantité commander ? » →
>    vous choisissez librement vos quantités par article ; besoin d'un conseil ? écrivez-nous sur WhatsApp.
> 6. **E-mail officiel** : `BRAND.email` = sdlsitgroup@gmail.com — à afficher dans le pied de page, la section contact, les mentions légales, le PDF et l'Excel du devis (lien `mailto:`).
> 7. **CATALOGUE À JOUR (22/10, liste du client) — 6 produits, 7 variantes, TOUS DISPONIBLES, dans cet ordre :**
>    Glace cubique (pack de 5 kg, 750 F) · **Glace en grain** (NOUVEAU, pack de 5 kg, 750 F, créneau image `grain`) ·
>    Glace pilée (sac de 50 kg, 3 000 F) · **Carboglace** (le kg, 7 500 F, univers brume fx-fog + mention de sécurité) ·
>    **Ice Cup** (nouveau nom du gobelet, 250 F) · Barres de glace (5 kg 350 F / 10 kg 650 F).
>    Noms, prix, descriptions : toujours lus depuis `PRODUCTS` de `config.js` (ne rien coder en dur ; toute liste de produits se génère
>    depuis `PRODUCTS`/`SKUS` ou est vérifiée contre eux au chargement). Le badge `.badge--soon` reste pour de futurs produits `available: false`.
> 8. **LIVRAISON : AUCUN TARIF AFFICHÉ.** Quantité totale (somme de toutes les quantités) **≥ 20 → livraison OFFERTE** ;
>    **< 20 → devis « hors frais de livraison »**, le tarif est communiqué ensuite par Le Glaceur. Retrait sur place gratuit.
>    Il n'y a PLUS de zones ni de grille de prix (`DELIVERY.zones` n'existe plus) : on demande seulement la commune
>    (`DELIVERY.communes`, liste de choix) + l'adresse/quartier, la date et le créneau. Calcul déjà fait par `computeTotals()` :
>    `freeDelivery`, `freeEligible`, `excludesDelivery`, `remainingForFree`, `deliveryFee` (0 ou null), `total` = sous-total.
>    Textes : `DELIVERY.freeLabel`, `DELIVERY.paidLabel`, `DELIVERY.paidNote`, `QUOTE.deliveryNote`.
>    À mettre en valeur partout où l'on choisit des quantités (argument commercial fort) : jauge « Plus que N articles pour
>    la livraison offerte » qui se remplit, puis célébration givrée « Livraison offerte ! » ; récapitulatif du devis ; section
>    livraison ; produits ; FAQ. **PDF** : ligne transport « Offerte (20 articles et plus) » ou « Hors frais de livraison — tarif
>    communiqué par Le Glaceur » ; libellé du total « TOTAL » ou « TOTAL (hors frais de livraison) ». **Excel** : cellule transport
>    = FORMULE `IF(SUM(quantités)>=20,"Offerte","Hors frais de livraison")` et libellé du total en formule, pour suivre les
>    quantités modifiées par le client ; le total n'inclut jamais de frais de livraison.
>    **Agent convert-a, section livraison** : garde le schéma radial depuis Abatta avec les COMMUNES desservies (directions
>    approximatives, sans anneaux de prix ni tableau de tarifs) ; message central « Livraison offerte dès 20 articles,
>    partout à Abidjan, 24h/24 et 7j/7 » ; en dessous de 20 articles : « devis hors frais de livraison, tarif communiqué par
>    Le Glaceur » ; carte « Retrait sur place » gratuite à Abatta – Carrefour Drogba.
> 9. **FOND BLANC (consigne client, comme les affiches)** : le site est majoritairement BLANC / givré très clair avec les bleus
>    de la marque (marine #0a1f44, bleu #1563d6, glace #8ecfff…). Le hero est CLAIR (glaçons 3D sur fond blanc-bleuté, comme les
>    affiches). Les sections marines sont rares (pied de page, éventuellement un bandeau) ; préfère des fonds blancs, `--grad-ice`,
>    des panneaux `.frost` et des aplats bleus. Le site doit être dynamique et unique (aucun modèle reconnaissable).
> 10. **CATALOGUE** : chaque produit a dans config.js `description`, `uses`, `howto`, `storage` (conservation) et `safety`
>    (sécurité). Ces informations doivent être consultables : section « Catalogue » de l'accueil (fiches détaillées dépliables)
>    ET dans le configurateur de devis (bouton « i » / « En savoir plus » sur chaque article, sans quitter le formulaire).
> 11. **Logos** : utilise les logos officiels visibles sur les affiches (Le Glaceur et SDLSIT Group), recréés fidèlement par l'agent brand.

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
`core/toast.js` (`toast(msg)`), `core/quote-store.js` (panier du devis), `config.js` (**toutes** les données : produits, prix, contacts, e-mail, règle de livraison, communes, contenu du guide).
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
`glacons`, `grain`, `gobelet`, `barres`, `pilee`, `carboglace`, `sac-glaceur`, `usage-cocktail`, `usage-whisky`, `usage-poisson`, `usage-event`,
`usage-jus`, `usage-restaurant`, `eau-pure`, `texture-glace`, `abidjan`.
Logo (agent brand) : partiels `src/partials/brand/logo-full.html` (logo horizontal, SVG inline, `currentColor`-friendly ou couleurs marque),
`src/partials/brand/logo-mark.html` (symbole G seul), `src/partials/brand/logo-full-white.html`, `src/partials/brand/sdlsit.html` ;
fichiers `public/brand/logo-full.svg`, `logo-mark.svg`, `logo-quote.png` (pour le PDF, 600px de large), favicons, `og-image.jpg` (1200×630).

## Devis (rubrique prioritaire)
Exigences du client (notes vocales) :
1. Le visiteur choisit **lui-même** les quantités (paquets, sacs, barres, gobelets). **Aucun estimateur par nombre d'invités** (voir consignes prioritaires).
2. **Aucun paiement en ligne.** Le calcul est automatique (sous-total, frais de transport, total).
3. **Transport** : livraison (offerte dès 20 articles ; sinon devis hors frais de livraison, aucun tarif affiché) **ou retrait sur place** à Abatta – Carrefour Drogba (adresse + itinéraire).
4. Le devis se télécharge en **PDF** et en **Excel** ; dans l'Excel, **les prix unitaires sont verrouillés**, seules les quantités (et les infos client/dates) sont modifiables, les totaux sont des formules.
5. Bouton **Envoyer sur WhatsApp** (message prérempli vers `BRAND.whatsapp`), présent sur le site **et** cliquable dans le PDF. Cela ouvre la discussion avec le client.
6. Mention : « Ce document est un devis et ne constitue pas une facture » (pas une FNE).
7. **Coordonnées du client (consigne client du 22/10, prioritaire)** — elles figurent AUTOMATIQUEMENT sur le devis PDF, l'Excel et le message WhatsApp :
   - **Nom de la personne qui commande** — obligatoire (`client.name`, libellé « Nom et prénom »).
   - **Numéro WhatsApp** — obligatoire (`client.phone`, libellé « Numéro WhatsApp », aide « pour recevoir la confirmation de votre commande » ; validation numéro ivoirien à 10 chiffres, +225 accepté).
   - **Nom de la structure** — facultatif (`client.company`, libellé « Structure / entreprise (facultatif) »).
   - **Adresse e-mail** — facultative (`client.email`, libellé « E-mail (facultatif) »).
   Sur le PDF et l'Excel, le bloc « Client » affiche, dans cet ordre : Nom, Structure (si renseignée), WhatsApp, E-mail (si renseigné). Dans l'Excel, ces cellules restent modifiables.

Interface documents (`src/js/quote/documents.js`, agent quote-docs) :
```js
export async function createPdf(q)  // → Promise<Blob>  (jsPDF + autotable, chargés à la demande)
export async function createXlsx(q) // → Promise<Blob>  (ExcelJS, chargé à la demande, feuille protégée)
export function whatsappMessage(q)  // → string (texte du message WhatsApp)
export function quoteFileName(q, ext) // → 'Devis-Le-Glaceur-GLC-261022-AB12.pdf'
```
`q` = `toQuoteData()` de `core/quote-store.js` :
`{ number, date, validUntil, client:{name,phone,email,company,type,note}, delivery:{mode,commune,label,fee,free,excludesDelivery,freeFrom,address,date,slot}, lines:[{sku,name,label,unit,units,qty,price,total,kg}], subtotal, deliveryFee, total, totalKg, count }`
(`fee`/`deliveryFee` = `null` → « hors frais de livraison », `0` → offerte ou retrait). jsPDF ne sait pas afficher U+202F : utilisez `fcfaPlain`/`plainNumber`.

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
