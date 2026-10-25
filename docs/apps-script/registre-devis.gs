/**
 * Le Glaceur — registre des devis (Google Apps Script, gratuit).
 *
 * - doPost : le site envoie chaque devis (PDF, Excel ou WhatsApp) ; une ligne par n° de devis,
 *   mise à jour si le client modifie puis renvoie le même devis.
 * - doGet  : la page /admin lit les devis d'une période, uniquement avec le bon code administrateur.
 *
 * Installation : voir docs/DEPLOIEMENT.md § « Espace administrateur ».
 */

// ⚠️ Remplacez par votre propre code (gardez-le secret : il ouvre la page /admin).
const CODE_ADMIN = 'A-CHANGER';

const FEUILLE = 'Devis';
const ENTETES = [
  'Reçu le', 'N° devis', 'Date du devis', 'Client', 'WhatsApp', 'Structure', 'E-mail',
  'Livraison', 'Commune', 'Adresse', 'Date souhaitée', 'Créneau', 'Articles', 'Kg', 'Total (F CFA)', 'Détail', 'Données',
];

function feuille_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FEUILLE) || ss.insertSheet(FEUILLE);
  if (sh.getLastRow() === 0) {
    sh.appendRow(ENTETES);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, ENTETES.length).setFontWeight('bold');
  }
  return sh;
}

function sortie_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let q;
  try { q = JSON.parse(e.postData.contents); } catch (err) { return sortie_({ ok: false }); }
  if (!q || !/^GLC-[\w-]+$/.test(q.number || '') || !Array.isArray(q.lines) || !q.lines.length) return sortie_({ ok: false });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = feuille_();
    const c = q.client || {};
    const d = q.delivery || {};
    const ligne = [
      new Date(), q.number, new Date(q.date), c.name || '', c.phone ? "'" + c.phone : '', c.company || '', c.email || '',
      d.label || '', d.commune || '', d.address || '', d.date || '', d.slot || '',
      q.count || 0, q.totalKg || 0, q.total || 0,
      q.lines.map(function (l) { return l.qty + ' × ' + l.name + ' (' + l.label + ')'; }).join(' ; '),
      JSON.stringify(q),
    ];
    const n = sh.getLastRow() - 1;
    const nums = n > 0 ? sh.getRange(2, 2, n, 1).getValues().map(function (r) { return r[0]; }) : [];
    const i = nums.indexOf(q.number);
    if (i >= 0) sh.getRange(i + 2, 1, 1, ligne.length).setValues([ligne]);
    else sh.appendRow(ligne);
    return sortie_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (CODE_ADMIN === 'A-CHANGER' || p.code !== CODE_ADMIN) return sortie_({ ok: false, erreur: 'code' });

  // Abidjan est à UTC+0 : les bornes de la période sont en UTC.
  const du = /^\d{4}-\d{2}-\d{2}$/.test(p.du || '') ? new Date(p.du + 'T00:00:00Z') : new Date(0);
  const au = /^\d{4}-\d{2}-\d{2}$/.test(p.au || '') ? new Date(p.au + 'T23:59:59.999Z') : new Date(8.64e15);

  const sh = feuille_();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, ENTETES.length).getValues() : [];
  const devis = [];
  rows.forEach(function (r) {
    let q;
    try { q = JSON.parse(r[16]); } catch (err) { return; }
    const t = new Date(q.date || r[2]);
    if (t >= du && t <= au) {
      q.receivedAt = r[0] instanceof Date ? r[0].toISOString() : String(r[0]);
      devis.push(q);
    }
  });
  devis.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return sortie_({ ok: true, devis: devis });
}
