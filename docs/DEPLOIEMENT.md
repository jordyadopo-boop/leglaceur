# Mise en ligne sur GitHub Pages et domaine www.leglaceur.ci

## 1. Mise en ligne automatique

Chaque `push` sur `main` lance `.github/workflows/deploy.yml` (onglet **Actions**) : le site est construit puis publié
sur la branche **`gh-pages`**, servie par GitHub Pages à l'adresse `https://<compte>.github.io/<dépôt>/`.
Un commit dont le message contient `[wip]` est sauvegardé sans être mis en ligne.

Si l'adresse ne répond pas après le premier déploiement : **Settings → Pages → Build and deployment → Source :
« Deploy from a branch », branche `gh-pages`, dossier `/ (root)`**.

## 2. Brancher le domaine www.leglaceur.ci

> Au 22/10/2026, **leglaceur.ci n'est pas enregistré** (le registre NIC.CI répond « domaine inexistant »).
> Il faut d'abord l'acheter.

1. **Enregistrer le domaine** `leglaceur.ci` auprès d'un bureau d'enregistrement agréé par NIC.CI
   (liste officielle sur https://www.nic.ci). Gardez l'accès à la gestion DNS du domaine.
2. **Configurer le DNS** chez ce bureau d'enregistrement :

   | Type  | Nom | Valeur |
   |-------|-----|--------|
   | CNAME | www | `jordyadopo-boop.github.io.` |
   | A     | @   | 185.199.108.153 |
   | A     | @   | 185.199.109.153 |
   | A     | @   | 185.199.110.153 |
   | A     | @   | 185.199.111.153 |
   | AAAA  | @   | 2606:50c0:8000::153 |
   | AAAA  | @   | 2606:50c0:8001::153 |
   | AAAA  | @   | 2606:50c0:8002::153 |
   | AAAA  | @   | 2606:50c0:8003::153 |

   Avec ces enregistrements, `leglaceur.ci` redirige automatiquement vers `www.leglaceur.ci`.
3. **Activer le domaine dans le site** : créez le fichier `public/CNAME` contenant uniquement `www.leglaceur.ci`, puis poussez sur `main`.
   Le workflow construit alors le site pour la racine du domaine et GitHub Pages l'adopte comme domaine personnalisé.
   (Ne le faites qu'une fois le DNS en place : sinon l'adresse github.io redirige vers un domaine qui ne répond pas encore.)
4. Sur GitHub : **Settings → Pages**, vérifiez que le domaine personnalisé est `www.leglaceur.ci` puis cochez **Enforce HTTPS**
   dès que le certificat est émis (quelques minutes à quelques heures après la propagation DNS).

## 3. Espace administrateur : registre de tous les devis (gratuit)

Chaque devis généré (PDF, Excel ou WhatsApp) est enregistré dans un Google Sheet ; la page privée
**www.leglaceur.ci/admin** (non liée, non indexée, protégée par un code) affiche les devis d'une période :
récapitulatif, liste avec « + » pour dérouler chaque devis, totaux par produit et export Excel.

Installation (une seule fois, ~5 min, avec le compte Google de Le Glaceur) :

1. Créez un Google Sheets vide nommé « Registre des devis Le Glaceur ».
2. **Extensions → Apps Script** : effacez le contenu, collez tout `docs/apps-script/registre-devis.gs`.
3. Ligne `const CODE_ADMIN = 'A-CHANGER';` : remplacez `A-CHANGER` par votre code secret. Enregistrez.
4. **Déployer → Nouveau déploiement → type « Application Web »** ; Exécuter en tant que : *Moi* ;
   Qui peut accéder : *Tout le monde*. Autorisez l'accès demandé par Google. Copiez l'URL (`…/exec`).
5. Dans `src/js/config.js`, mettez cette URL dans `BRAND.quoteWebhook` et poussez.

Si vous modifiez le script plus tard : **Déployer → Gérer les déploiements → modifier → Nouvelle version**
(l'URL reste la même). Les devis restent consultables directement dans le Google Sheet.

### Tableau de bord, dépenses, recettes et budget

L'espace administrateur s'ouvre sur un **tableau de bord** pour la période choisie (aujourd'hui, 7 jours,
ce mois, mois dernier, cette année, depuis le début, ou dates libres) :

- **Résultat** : seul l'argent encaissé compte. Recettes (ventes de glace = devis encaissés + glace vendue
  sans devis, + autres recettes) moins dépenses, marge,
  variations par rapport à la période précédente de même durée, graphique recettes / dépenses par jour,
  mois ou année, répartition des dépenses par catégorie et des recettes par activité.
- **Dépenses** et **Recettes** : saisie datée et catégorisée, modification,
  suppression avec la croix × en bout de ligne (feuille « Mouvements » du Google Sheet). Pour de la glace
  vendue sans devis, choisissez l'activité « Ventes de glace ».
- **Encaisser un devis** : un devis n'entre dans les recettes que lorsqu'il est payé. Le bouton
  « Encaisser » (onglet Devis) demande le montant reçu et l'ajoute aux recettes « Ventes de glace » à la
  date du jour ; le devis affiche alors « ✓ Encaissé ». Cliquer sur « ✓ Encaissé » annule l'encaissement.
- **Devis** : la croix × en bout de ligne supprime un devis du registre ; dans le détail d'un devis, la
  croix × d'une ligne supprime ce produit et recalcule le total (supprimer la dernière ligne supprime le devis).
  Une confirmation est demandée à chaque fois ; la suppression est définitive.
- **Budget** (facultatif) : objectifs mensuels de ventes et de dépenses (feuille « Budget »). Dès qu'un
  budget couvre la période, le tableau de bord affiche les jauges et les courbes budget / réel des ventes,
  des dépenses et du résultat (marge). Le budget d'un mois est réparti au prorata des jours.

**Mise à jour (obligatoire une fois pour activer ces saisies)** : dans Apps Script, remplacez tout le code
par la nouvelle version de `docs/apps-script/registre-devis.gs` en **gardant votre `CODE_ADMIN`**, enregistrez,
puis **Déployer → Gérer les déploiements → ✏️ modifier → Version : Nouvelle version → Déployer**. L'URL ne
change pas. Les feuilles « Mouvements » et « Budget » se créent seules à la première saisie. Tant que ce
n'est pas fait, le tableau de bord affiche les devis seuls et signale la mise à jour à faire.
