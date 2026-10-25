/**
 * Le Glaceur — registre des devis (Google Apps Script, gratuit).
 *
 * - doPost : le site envoie chaque devis (PDF, Excel ou WhatsApp) ; une ligne par n° de devis,
 *   mise à jour si le client modifie puis renvoie le même devis.
 * - doGet  : la page /admin lit les devis (avec leur encaissement éventuel) et les mouvements (dépenses, autres recettes) d'une période,
 *            uniquement avec le bon code administrateur.
 * - doPost avec { code, action } : la page /admin enregistre ou supprime une dépense / une autre recette,
 *            supprime un devis ou une ligne de devis (actions « supprimer-devis », « supprimer-ligne »)
 *            (feuille « Mouvements »), ou le budget mensuel (feuille « Budget », action « budget »).
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

const FEUILLE_MV = 'Mouvements';
const ENTETES_MV = ['ID', 'Type', 'Date', 'Catégorie', 'Libellé', 'Montant (F CFA)', 'Note', 'Saisi le', 'Devis'];
const TYPES_MV = ['depense', 'recette'];

const FEUILLE_BUD = 'Budget';
const ENTETES_BUD = ['Mois', 'Budget ventes (F CFA)', 'Budget dépenses (F CFA)', 'Mis à jour le'];

function feuilleBud_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FEUILLE_BUD) || ss.insertSheet(FEUILLE_BUD);
  if (sh.getLastRow() === 0) {
    sh.appendRow(ENTETES_BUD);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, ENTETES_BUD.length).setFontWeight('bold');
    sh.getRange('A:A').setNumberFormat('@'); // mois gardé en texte AAAA-MM
  }
  return sh;
}

function lireBud_() {
  const sh = feuilleBud_();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, 3).getValues().map(function (r) {
    return { mois: String(r[0]), ventes: Number(r[1]) || 0, depenses: Number(r[2]) || 0 };
  });
}

/** { mois: [{ mois: 'AAAA-MM', ventes, depenses }] } : ligne créée ou mise à jour, supprimée si les deux montants sont à 0. */
function budget_(p) {
  const sh = feuilleBud_();
  const liste = Array.isArray(p.mois) ? p.mois : [];
  for (let k = 0; k < liste.length; k++) {
    const b = liste[k] || {};
    if (!/^\d{4}-\d{2}$/.test(b.mois || '')) continue;
    const v = Math.max(0, Math.round(Number(b.ventes) || 0));
    const d = Math.max(0, Math.round(Number(b.depenses) || 0));
    const n = sh.getLastRow() - 1;
    const mois = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    const i = mois.indexOf(b.mois);
    if (!v && !d) { if (i >= 0) sh.deleteRow(i + 2); continue; }
    const ligne = [b.mois, v, d, new Date()];
    if (i >= 0) sh.getRange(i + 2, 1, 1, ligne.length).setValues([ligne]);
    else sh.appendRow(ligne);
  }
  return sortie_({ ok: true });
}

function feuilleMv_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FEUILLE_MV) || ss.insertSheet(FEUILLE_MV);
  if (sh.getLastRow() === 0) {
    sh.appendRow(ENTETES_MV);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, ENTETES_MV.length).setFontWeight('bold');
    sh.getRange('C:C').setNumberFormat('@'); // dates gardées en texte AAAA-MM-JJ
  }
  // Colonne « Devis » (n° du devis encaissé) ajoutée aux feuilles créées avant elle.
  if (sh.getRange(1, ENTETES_MV.length).getValue() === '') sh.getRange(1, ENTETES_MV.length).setValue('Devis').setFontWeight('bold');
  return sh;
}

function lireMv_() {
  const sh = feuilleMv_();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, ENTETES_MV.length).getValues().map(function (r) {
    const d = r[2] instanceof Date ? Utilities.formatDate(r[2], 'UTC', 'yyyy-MM-dd') : String(r[2]);
    return { id: String(r[0]), type: String(r[1]), date: d, categorie: String(r[3]), libelle: String(r[4]), montant: Number(r[5]) || 0, note: String(r[6]), devis: String(r[8] || '') };
  });
}

function mouvement_(p) {
  if (CODE_ADMIN === 'A-CHANGER' || p.code !== CODE_ADMIN) return sortie_({ ok: false, erreur: 'code' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (p.action === 'budget') return budget_(p);
    if (p.action === 'supprimer-devis' || p.action === 'supprimer-ligne') return supprimerDevis_(p);
    const sh = feuilleMv_();
    const n = sh.getLastRow() - 1;
    const ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    const m = p.mouvement || {};
    const i = ids.indexOf(String(m.id || ''));
    if (p.action === 'supprimer') {
      if (i >= 0) sh.deleteRow(i + 2);
      return sortie_({ ok: true });
    }
    const montant = Math.round(Number(m.montant));
    if (TYPES_MV.indexOf(m.type) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(m.date || '') || !(montant > 0) || !String(m.categorie || '').trim()) {
      return sortie_({ ok: false, erreur: 'donnees' });
    }
    const id = i >= 0 ? ids[i] : Utilities.getUuid();
    const ligne = [id, m.type, m.date, String(m.categorie).trim().slice(0, 60), String(m.libelle || '').trim().slice(0, 120), montant, String(m.note || '').trim().slice(0, 300), new Date(), String(m.devis || '').slice(0, 40)];
    if (i >= 0) sh.getRange(i + 2, 1, 1, ligne.length).setValues([ligne]);
    else sh.appendRow(ligne);
    return sortie_({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
}

/** Supprime un devis entier ({ numero }) ou une de ses lignes ({ numero, ligne, sku }) ; totaux recalculés. */
function supprimerDevis_(p) {
  const sh = feuille_();
  const n = sh.getLastRow() - 1;
  const nums = n > 0 ? sh.getRange(2, 2, n, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  const i = nums.indexOf(String(p.numero || ''));
  if (i < 0) return sortie_({ ok: true });
  if (p.action === 'supprimer-devis') { sh.deleteRow(i + 2); return sortie_({ ok: true }); }
  let q;
  try { q = JSON.parse(sh.getRange(i + 2, 17).getValue()); } catch (err) { return sortie_({ ok: false, erreur: 'donnees' }); }
  const k = Number(p.ligne);
  if (!Array.isArray(q.lines) || !q.lines[k] || q.lines[k].sku !== p.sku) return sortie_({ ok: false, erreur: 'donnees' });
  q.lines.splice(k, 1);
  if (!q.lines.length) { sh.deleteRow(i + 2); return sortie_({ ok: true }); }
  q.count = q.lines.reduce(function (a, l) { return a + (Number(l.qty) || 0); }, 0);
  q.totalKg = q.lines.reduce(function (a, l) { return a + (l.kg ? l.kg * l.qty : 0); }, 0);
  q.subtotal = q.total = q.lines.reduce(function (a, l) { return a + (Number(l.total) || 0); }, 0);
  sh.getRange(i + 2, 13, 1, 5).setValues([[
    q.count, q.totalKg, q.total,
    q.lines.map(function (l) { return l.qty + ' × ' + l.name + ' (' + l.label + ')'; }).join(' ; '),
    JSON.stringify(q),
  ]]);
  return sortie_({ ok: true });
}

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
  if (q && q.action) return mouvement_(q);
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

  const tous = lireMv_();
  const encaisses = {}; // n° de devis → recette qui l'encaisse (quelle que soit sa date)
  tous.forEach(function (m) { if (m.devis && m.type === 'recette') encaisses[m.devis] = { id: m.id, date: m.date, montant: m.montant }; });

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
      q.encaisse = encaisses[q.number] || null;
      devis.push(q);
    }
  });
  devis.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

  const d1 = p.du || '0000-00-00';
  const d2 = p.au || '9999-99-99';
  const mouvements = tous.filter(function (m) { return m.date >= d1 && m.date <= d2; });
  mouvements.sort(function (a, b) { return b.date.localeCompare(a.date); });
  return sortie_({ ok: true, devis: devis, mouvements: mouvements, budgets: lireBud_() });
}
