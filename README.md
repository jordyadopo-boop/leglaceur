# Le Glaceur · site officiel

Site vitrine et devis en ligne de **Le Glaceur**, glace alimentaire à Abidjan, marque de SDLSIT Group.
Adresse cible : **https://www.leglaceur.ci**

- Accueil : hero 3D (glaçons en WebGL qui réfractent la lumière), produits et prix, commande express (quantités libres), qualité, fabrication, secteurs, livraison, FAQ, contact.
- **Devis en ligne** (`devis.html`) : le client choisit ses quantités, la livraison par zone ou le retrait sur place, puis télécharge son devis en **PDF** ou en **Excel** (prix unitaires verrouillés) et l'envoie sur **WhatsApp**. Aucun paiement en ligne.
- **Guide des glaces** (`guide.html`) : version interactive du guide pédagogique.

## Modifier les prix, numéros, règle de livraison

Tout est dans **`src/js/config.js`** : prix (`PRODUCTS`), numéros et WhatsApp (`BRAND`), règle de livraison offerte dès 20 articles et communes (`DELIVERY`),
validité du devis (`QUOTE`). Un produit passe de « Bientôt disponible » à « En vente »
avec `available: true`. Après modification, un `git push` sur `main` redéploie le site automatiquement.

## Développer

```bash
npm install
npm run dev       # http://127.0.0.1:5173
npm run build     # génère dist/
npm run preview   # sert dist/
```

Architecture, conventions et API des effets : `docs/ARCHITECTURE.md` et `docs/FX.md`. Crédits photo : `docs/CREDITS.md`.

## Mise en ligne (GitHub Pages)

Voir **`docs/DEPLOIEMENT.md`**.
