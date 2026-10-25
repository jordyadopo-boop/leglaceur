# Crédits photo — Le Glaceur

Toutes les photographies du site proviennent de banques d'images libres de droits pour un usage commercial
(**Unsplash** et **Pexels**), à l'exception du sac siglé (extrait de l'affiche officielle), de la glace pilée (photo fournie par Le Glaceur) et des rendus 3D réalisés pour le site.
Les fichiers publiés sont dans `public/img/` ; leurs dimensions, textes alternatifs et crédits sont décrits
dans `public/img/manifest.json` (lu par la directive `<!-- @img slot="…" -->`).

## Tableau des crédits

| Créneau | Sujet | Photographe | Banque | Page source |
|---|---|---|---|---|
| `glacons` | Glaçons cubiques sur fond bleu profond | Ting lee | Unsplash | [unsplash.com/photos/…-YBTEMvm85qI](https://unsplash.com/photos/clear-ice-cubes-casting-shadows-on-a-deep-blue-background-YBTEMvm85qI) |
| `gobelet` | Ice Cup : gobelet PET à dôme rempli de glaçons creux, condensation | Le Glaceur | Rendu 3D (Three.js) réalisé pour le site | `tools/renders/scene-gobelet.js` |
| `barres` | Barres de glace de 5 et 10 kg, glaçons, sol mouillé | Le Glaceur | Rendu 3D (Three.js) réalisé pour le site | `tools/renders/scene-barres.js` |
| `grain` | Glace en grain (nugget ice) : verre qui déborde de grains, coulée sur sol mouillé | Le Glaceur | Rendu 3D (Three.js) réalisé pour le site | `tools/renders/grain/scene.js` |
| `pilee` | Glace pilée Le Glaceur, fine et neigeuse | Le Glaceur | Photo fournie par le client | `tools/source/glace-pilee-le-glaceur.jpg` |
| `carboglace` | Glace carbonique et brume blanche | cottonbro studio | Pexels | [pexels.com/photo/…-9694195](https://www.pexels.com/photo/white-smoke-in-a-glass-container-against-black-background-9694195/) |
| `sac-glaceur` | Sac de glaçons siglé « Le Glaceur » | Le Glaceur | Affiche officielle (client) | Visuel de marque fourni par le client |
| `usage-cocktail` | Mojito sur glace pilée | Aram Diseño | Pexels | [pexels.com/photo/…-7259044](https://www.pexels.com/photo/close-up-shot-of-ice-in-the-drinking-glass-7259044/) |
| `usage-whisky` | Whisky versé sur un gros glaçon | Adam Jaime | Unsplash | [unsplash.com/photos/…-dmkmrNptMpw](https://unsplash.com/photos/amber-cocktail-pouring-over-ice-dmkmrNptMpw) |
| `usage-poisson` | Poissons frais sur lit de glace | Engin Akyurt | Pexels | [pexels.com/photo/…-19789770](https://www.pexels.com/photo/fish-in-a-refrigerator-19789770/) |
| `usage-event` | Seau à champagne et glaçons en réception | Sven Mieke | Unsplash | [unsplash.com/photos/…-fhiLkn5jjCk](https://unsplash.com/photos/gray-steel-tray-with-bottles-fhiLkn5jjCk) |
| `usage-jus` | Boissons aux fruits avec glaçons | Roman Odintsov | Pexels | [pexels.com/photo/…-5836845](https://www.pexels.com/photo/cold-drinks-on-glass-5836845/) |
| `usage-restaurant` | Barman, boisson sur glace au comptoir | Yuri Barreto | Pexels | [pexels.com/photo/…-9319210](https://www.pexels.com/photo/a-person-stirring-a-cocktail-drink-9319210/) |
| `eau-pure` | Goutte d'eau et ondes concentriques | David Becker | Unsplash | [unsplash.com/photos/…-rrfdqjJWwmU](https://unsplash.com/photos/water-ripple-effect-rrfdqjJWwmU) |
| `texture-glace` | Glace bleue fissurée, bulles d'air | Justin Kauffman | Unsplash | [unsplash.com/photos/…-kBO-sBhf_I8](https://unsplash.com/photos/cracked-blue-ice-texture-kBO-sBhf_I8) |
| `abidjan` | Le Plateau vu depuis la lagune Ébrié | Shane Ryan Herilalaina | Unsplash | [unsplash.com/photos/…-ir5PK5Itae0](https://unsplash.com/photos/distant-cityscape-across-water-under-a-blue-sky-ir5PK5Itae0) |

## Licences

- **Licence Unsplash** ([unsplash.com/license](https://unsplash.com/license)) : utilisation gratuite, y compris commerciale,
  sans autorisation préalable ; l'attribution n'est pas obligatoire mais appréciée. Interdit : vendre les photos telles quelles
  ou les compiler pour reproduire un service concurrent. Aucune image **Unsplash+** (sous abonnement) n'a été retenue.
- **Licence Pexels** ([pexels.com/license](https://www.pexels.com/license/)) : utilisation gratuite, y compris commerciale,
  modification autorisée ; attribution facultative. Interdit : revendre les photos non modifiées, laisser entendre qu'une personne
  ou une marque visible cautionne le produit, redistribuer les photos sur une autre banque d'images.
- **Sac siglé** : recadré dans l'affiche officielle de Le Glaceur (propriété du client), nettoyé (le grand logo de l'affiche qui
  débordait dans l'angle a été effacé) et agrandi à 960 px de large au maximum.

Aucune photo ne montre de visage identifiable en gros plan ni de marque tierce lisible.

## Traitement

Recadrage au ratio du créneau (portrait 4:5 pour les produits, paysage 3:2 pour les usages, 16:9 pour les ambiances),
léger étalonnage de deux images pour la cohérence froide (glace pilée moins cyan, pains de glace un peu plus lumineux),
puis déclinaisons `480`, `960` et `1600` px en **AVIF** (qualité 52) et **WebP** (qualité 80), métadonnées supprimées.
Nommage : `public/img/<créneau>-<largeur>.avif|webp`.
