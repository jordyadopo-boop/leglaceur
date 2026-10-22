# Mise en ligne sur GitHub Pages et domaine www.leglaceur.ci

## 1. Mise en ligne automatique

Chaque `push` sur `main` lance `.github/workflows/deploy.yml` (onglet **Actions**) : le site est construit puis publié
sur la branche **`gh-pages`**, servie par GitHub Pages à l'adresse `https://<compte>.github.io/<dépôt>/`.
Un commit dont le message contient `[wip]` est sauvegardé sans être mis en ligne.

Si l'adresse ne répond pas après le premier déploiement : **Settings → Pages → Build and deployment → Source :
« Deploy from a branch », branche `gh-pages`, dossier `/ (root)`**.

## 2. Brancher le domaine www.leglaceur.ci

1. Créez le fichier `public/CNAME` contenant uniquement :
   ```
   www.leglaceur.ci
   ```
   (le workflow construit alors le site pour la racine du domaine).
2. Chez le gestionnaire du domaine `.ci`, configurez le DNS :

   | Type  | Nom | Valeur |
   |-------|-----|--------|
   | CNAME | www | `<compte>.github.io.` |
   | A     | @   | 185.199.108.153 |
   | A     | @   | 185.199.109.153 |
   | A     | @   | 185.199.110.153 |
   | A     | @   | 185.199.111.153 |

3. Sur GitHub : **Settings → Pages → Custom domain : `www.leglaceur.ci`** (le fichier `public/CNAME` le renseigne aussi automatiquement), puis cochez **Enforce HTTPS** une fois le certificat émis
   (quelques minutes à quelques heures après la propagation DNS).

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
