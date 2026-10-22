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

## 3. (Facultatif) Recevoir chaque devis dans un tableur Google Sheets

Le site n'a pas de serveur : un devis n'est transmis que lorsque le client l'envoie sur WhatsApp.
Pour garder aussi une trace de chaque devis (fichier clients, relances), créez un script Google Apps Script :

1. Dans un Google Sheets : **Extensions → Apps Script**, collez :
   ```js
   function doPost(e) {
     const q = JSON.parse(e.postData.contents);
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
     sheet.appendRow([new Date(), q.number, q.client.name, q.client.phone, q.client.type,
       q.delivery.label, q.delivery.address, q.delivery.date, q.delivery.slot,
       q.lines.map(l => `${l.qty} × ${l.name} (${l.label})`).join(' ; '), q.subtotal, q.delivery.free ? 'Offerte' : (q.delivery.mode === 'retrait' ? 'Retrait' : 'Hors frais'), q.total]);
     return ContentService.createTextOutput('ok');
   }
   ```
2. **Déployer → Nouveau déploiement → Application Web**, accès : « Tout le monde ». Copiez l'URL.
3. Dans `src/js/config.js`, renseignez `BRAND.quoteWebhook` avec cette URL et poussez.
