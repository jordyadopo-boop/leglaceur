/**
 * Le Glaceur — devis Excel (ExcelJS), chargé à la demande par documents.js.
 *
 * Feuille « Devis » : bandeau marine + logo, toutes les variantes du catalogue (quantité du devis, 0 sinon),
 * prix unitaires / formules / libellés VERROUILLÉS, quantités + coordonnées DÉVERROUILLÉES (cases bleues),
 * transport et libellé du total en FORMULES (seuil de livraison offerte), validation des quantités,
 * en-têtes figés, impression A4 ajustée à la largeur.
 * Feuille « Infos » : contacts, adresse, règle de livraison, comment renvoyer le devis sur WhatsApp.
 */
import ExcelJS from 'exceljs';
import { BRAND, DELIVERY, PRODUCTS, QUOTE, mapsUrl } from '../config.js';
import {
  NBSP, cleanSpaces, formatQuoteDate, formatPhone, formatSlot, formatCell, isPickup, shortWhatsappMessage, whatsappUrl,
} from './message.js';

/*
 * Mot de passe de protection des feuilles (empêche la modification des prix unitaires et des formules).
 * Ce n'est pas une sécurité forte (le fichier reste chez le client) : il évite les erreurs de saisie.
 * À communiquer uniquement à l'équipe Le Glaceur.
 */
const SHEET_PASSWORD = 'LeGlaceur-SDLSIT';

const COL = {
  ink: 'FF0A1F44',
  ink800: 'FF0F2C5E',
  blue: 'FF1563D6',
  blue400: 'FF4D9BFF',
  ice300: 'FF8ECFFF',
  ice200: 'FFBFE4FF',
  ice100: 'FFE3F3FF',
  ice50: 'FFF3FAFF',
  white: 'FFFFFFFF',
  muted: 'FF45597C',
  soft: 'FF6B7F9F',
  wa: 'FF0E7A3F',
  ok: 'FF157046',
  okBg: 'FFE7F7EE',
  warn: 'FF8A580C',
  warnBg: 'FFFFF6E4',
};
const FONT = 'Arial';
const MONEY = '#,##0 "F CFA"';
const PICKUP = 'Retrait sur place';
const DELIVER = 'Livraison';

const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const f = (o = {}) => ({ name: FONT, size: 10, color: { argb: COL.ink }, ...o, color: { argb: o.color || COL.ink } });
const thin = (argb = COL.ice200) => ({ style: 'thin', color: { argb } });
const edit = (argb = COL.blue) => ({ top: thin(argb), left: thin(argb), bottom: thin(argb), right: thin(argb) });

/** Date ISO « 2026-10-25 » → Date UTC (pas de décalage de fuseau dans Excel), sinon texte. */
function excelDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : cleanSpaces(value || '');
}

export async function buildXlsx(q, { logo = null } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${BRAND.name} — ${BRAND.parent}`;
  wb.lastModifiedBy = BRAND.name;
  wb.company = BRAND.parent;
  wb.title = `Devis ${q.number || ''} — ${BRAND.name}`;
  wb.subject = 'Devis glace alimentaire';
  wb.created = q.date ? new Date(q.date) : new Date();
  wb.modified = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const logoId = logo?.dataUrl ? wb.addImage({ base64: logo.dataUrl, extension: 'png' }) : null;
  const pickup = isPickup(q);
  const freeFrom = q.delivery?.freeFrom ?? DELIVERY.freeFrom;

  /* ===================================================================== Devis */
  const ws = wb.addWorksheet('Devis', {
    properties: { tabColor: { argb: COL.blue }, defaultRowHeight: 18 },
    views: [{ state: 'frozen', ySplit: 7, topLeftCell: 'A8', activeCell: 'D8', showGridLines: false, zoomScale: 100 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1, // le devis tient sur une seule page A4
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.45, bottom: 0.6, header: 0.2, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L&8${BRAND.name} — ${BRAND.signature}&C&8${BRAND.phones[0].display} · ${BRAND.email}&R&8Page &P / &N`,
    },
  });
  ws.columns = [
    { key: 'a', width: 32 },
    { key: 'b', width: 20 },
    { key: 'c', width: 22 },
    { key: 'd', width: 13 },
    { key: 'e', width: 24 },
  ];

  const band = (r1, r2, title, sub) => {
    for (let r = r1; r <= r2; r++) for (const c of 'ABCDE') ws.getCell(`${c}${r}`).fill = solid(COL.ink);
    ws.getRow(r1).height = 50;
    ws.getRow(r2).height = 20;
    if (logoId !== null) {
      ws.addImage(logoId, { tl: { col: 0.12, row: r1 - 1 + 0.1 }, ext: { width: 186, height: Math.round(186 * logo.ratio) }, editAs: 'oneCell' });
    } else {
      const c = ws.getCell(`A${r1}`);
      c.value = BRAND.name.toUpperCase();
      c.font = f({ size: 20, bold: true, color: COL.white });
      c.alignment = { vertical: 'middle', indent: 1 };
    }
    ws.mergeCells(`C${r1}:E${r1}`);
    const t = ws.getCell(`C${r1}`);
    t.value = title;
    t.font = f({ size: 26, bold: true, color: COL.white });
    t.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    const tag = ws.getCell(`A${r2}`);
    tag.value = BRAND.values.map((v) => v.label.toUpperCase()).join('  ·  ');
    tag.font = f({ size: 8, bold: true, color: COL.ice300 });
    tag.alignment = { vertical: 'middle', indent: 1 };
    ws.mergeCells(`C${r2}:E${r2}`);
    const s = ws.getCell(`C${r2}`);
    s.value = sub;
    s.font = f({ size: 11, bold: true, color: COL.ice100 });
    s.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    // vague / liseré glace
    ws.mergeCells(`A${r2 + 1}:E${r2 + 1}`);
    ws.getRow(r2 + 1).height = 5;
    ws.getCell(`A${r2 + 1}`).fill = {
      type: 'gradient',
      gradient: 'angle',
      degree: 0,
      stops: [
        { position: 0, color: { argb: COL.blue } },
        { position: 0.6, color: { argb: COL.blue400 } },
        { position: 1, color: { argb: COL.ice200 } },
      ],
    };
  };

  band(1, 2, 'DEVIS', `N°${NBSP}${q.number || ''}`);

  // Métadonnées
  const meta = (cell, value, label = false) => {
    const c = ws.getCell(cell);
    c.value = value;
    c.font = label ? f({ size: 9, color: COL.soft }) : f({ size: 10.5, bold: true });
    c.alignment = { vertical: 'middle', indent: label ? 1 : 0 };
  };
  ws.getRow(4).height = 21;
  ws.getRow(5).height = 21;
  meta('A4', 'Devis n°', true);
  meta('B4', q.number || '');
  meta('C4', 'Établi le', true);
  ws.mergeCells('D4:E4');
  meta('D4', formatQuoteDate(q.date));
  meta('A5', 'Valable jusqu’au', true);
  meta('B5', formatQuoteDate(q.validUntil));
  ws.mergeCells('C5:E5');
  const legend = ws.getCell('C5');
  legend.value = 'Les cases bleues sont modifiables';
  legend.font = f({ size: 9, bold: true, color: COL.blue });
  legend.fill = solid(COL.ice100);
  legend.border = edit();
  legend.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(6).height = 8;

  // En-tête du tableau (figé)
  const HEAD = ['Produit', 'Format', 'Prix unitaire (F CFA)', 'Quantité', 'Montant (F CFA)'];
  const hr = ws.getRow(7);
  hr.height = 26;
  HEAD.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h.toUpperCase();
    c.font = f({ size: 9, bold: true, color: COL.white });
    c.fill = solid(COL.ink);
    c.alignment = { vertical: 'middle', horizontal: i < 2 ? 'left' : i === 3 ? 'center' : 'right', indent: i < 2 ? 1 : 0, wrapText: true };
    c.border = { bottom: { style: 'medium', color: { argb: COL.ice300 } } };
  });

  // Lignes : toutes les variantes commandables du catalogue + lignes hors catalogue éventuelles
  const qtyBySku = new Map((q.lines || []).map((l) => [l.sku, l]));
  const items = [];
  for (const p of PRODUCTS) {
    if (!p.available) continue;
    for (const v of p.variants) {
      const l = qtyBySku.get(v.sku);
      items.push({ sku: v.sku, name: p.name, label: v.label, unit: v.unit, units: v.units, price: v.price, kg: v.kg, qty: l?.qty || 0 });
      qtyBySku.delete(v.sku);
    }
  }
  for (const l of qtyBySku.values()) items.push({ sku: l.sku, name: l.name, label: l.label, unit: l.unit, units: l.units, price: l.price, kg: l.kg, qty: l.qty || 0 });

  const first = 8;
  const last = first + items.length - 1;
  items.forEach((it, i) => {
    const r = first + i;
    const row = ws.getRow(r);
    row.height = 24;
    const zebra = i % 2 ? COL.ice50 : COL.white;
    const a = row.getCell(1);
    a.value = it.name;
    a.font = f({ bold: true });
    const b = row.getCell(2);
    b.value = formatCell(it);
    b.font = f({ color: COL.muted });
    const c = row.getCell(3);
    c.value = it.price;
    c.numFmt = MONEY;
    c.font = f({ color: COL.muted });
    const d = row.getCell(4);
    d.value = it.qty;
    d.numFmt = it.unit === 'kg' ? '0" kg"' : '0';
    d.font = f({ size: 11, bold: true, color: COL.blue });
    d.fill = solid(COL.ice100);
    d.border = edit();
    d.protection = { locked: false };
    d.dataValidation = {
      type: 'whole',
      operator: 'greaterThanOrEqual',
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Quantité',
      error: 'Saisissez un nombre entier positif ou nul.',
      showInputMessage: true,
      promptTitle: 'Quantité',
      prompt: it.unit === 'kg' ? 'Nombre de kilos souhaités (entier).' : `Nombre de ${it.units || 'articles'} souhaités.`,
    };
    const e = row.getCell(5);
    e.value = { formula: `C${r}*D${r}`, result: it.price * it.qty };
    e.numFmt = MONEY;
    e.font = f({ bold: true });
    for (const cell of [a, b, c, e]) cell.fill = solid(zebra);
    for (let k = 1; k <= 5; k++) {
      const cell = row.getCell(k);
      cell.alignment = { vertical: 'middle', horizontal: k < 3 ? 'left' : k === 4 ? 'center' : 'right', indent: k < 3 ? 1 : k === 4 ? 0 : 1 };
      if (k !== 4) cell.border = { bottom: thin() };
    }
  });
  // Ligne remplie : mise en évidence automatique
  ws.addConditionalFormatting({
    ref: `A${first}:C${last}`,
    rules: [{ type: 'expression', priority: 1, formulae: [`$D${first}>0`], style: { font: { color: { argb: COL.ink }, bold: true } } }],
  });

  // Coordonnées : placées après les totaux, mais référencées par les formules → on fixe d'abord les numéros de lignes.
  let r = last + 2;
  const R = {
    count: r,
    sub: r + 1,
    transport: r + 2,
    total: r + 3,
    hint: r + 4,
    weight: r + 5,
  };
  const clientStart = R.weight + 3;
  const FIELDS = [
    ['name', 'Nom et prénom'],
    ['company', 'Structure / entreprise'],
    ['phone', 'Numéro WhatsApp'],
    ['email', 'E-mail'],
    ['mode', 'Mode (livraison ou retrait)'],
    ['commune', 'Commune'],
    ['address', 'Adresse / quartier'],
    ['date', 'Date souhaitée'],
    ['slot', 'Créneau'],
    ['note', 'Note'],
  ];
  const fieldRow = Object.fromEntries(FIELDS.map(([k], i) => [k, clientStart + 1 + i]));
  const MODE = `$B$${fieldRow.mode}`;
  const COUNT = `$D$${R.count}`;

  const count = items.reduce((s, it) => s + it.qty, 0);
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const weight = items.reduce((s, it) => s + (it.kg ? it.kg * it.qty : 0), 0);
  const modeValue = pickup ? PICKUP : DELIVER;
  const transportResult = pickup ? `${PICKUP} — gratuit` : count >= freeFrom ? 'Offerte' : DELIVERY.paidLabel;
  const totalLabelResult = !pickup && count < freeFrom ? `TOTAL (${DELIVERY.paidLabel.toLowerCase()})` : 'TOTAL';
  const pickupHint = `Retrait gratuit à ${BRAND.address.street}, ${BRAND.hours}.`;
  const hintResult = pickup
    ? pickupHint
    : count >= freeFrom
      ? `Livraison offerte${NBSP}: votre commande compte ${count} articles.`
      : `Plus que ${freeFrom - count} article${freeFrom - count > 1 ? 's' : ''} pour la livraison offerte (dès ${freeFrom} articles).`;

  const labelCell = (row, text, from = 'A', to = 'D', opts = {}) => {
    ws.mergeCells(`${from}${row}:${to}${row}`);
    const c = ws.getCell(`${from}${row}`);
    c.value = text;
    c.font = f({ size: 10, color: COL.muted, ...opts.font });
    c.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    if (opts.fill) c.fill = solid(opts.fill);
    return c;
  };

  // Nombre d'articles (sous la colonne Quantité)
  ws.getRow(R.count).height = 22;
  labelCell(R.count, 'Nombre d’articles', 'A', 'C');
  const cnt = ws.getCell(`D${R.count}`);
  cnt.value = { formula: `SUM(D${first}:D${last})`, result: count };
  cnt.numFmt = '0';
  cnt.font = f({ size: 11, bold: true });
  cnt.alignment = { horizontal: 'center', vertical: 'middle' };
  cnt.border = { top: { style: 'medium', color: { argb: COL.ink } } };
  ws.getCell(`E${R.count}`).border = { top: { style: 'medium', color: { argb: COL.ink } } };
  for (const c of 'ABC') ws.getCell(`${c}${R.count}`).border = { top: { style: 'medium', color: { argb: COL.ink } } };

  // Sous-total
  ws.getRow(R.sub).height = 22;
  labelCell(R.sub, 'Sous-total');
  const sub = ws.getCell(`E${R.sub}`);
  sub.value = { formula: `SUM(E${first}:E${last})`, result: subtotal };
  sub.numFmt = MONEY;
  sub.font = f({ size: 11, bold: true });
  sub.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };

  // Transport (formule : seuil de livraison offerte, ou retrait)
  ws.getRow(R.transport).height = 22;
  labelCell(R.transport, 'Transport');
  const tr = ws.getCell(`E${R.transport}`);
  tr.value = {
    formula: `IF(${MODE}="${PICKUP}","${PICKUP} — gratuit",IF(${COUNT}>=${freeFrom},"Offerte","${DELIVERY.paidLabel}"))`,
    result: transportResult,
  };
  tr.font = f({ bold: true, color: COL.warn });
  tr.alignment = { horizontal: 'right', vertical: 'middle', indent: 1, shrinkToFit: true };
  ws.addConditionalFormatting({
    ref: `E${R.transport}`,
    rules: [
      { type: 'expression', priority: 2, formulae: [`$E$${R.transport}="Offerte"`], style: { font: { color: { argb: COL.ok }, bold: true } } },
      { type: 'expression', priority: 3, formulae: [`${MODE}="${PICKUP}"`], style: { font: { color: { argb: COL.blue }, bold: true } } },
    ],
  });

  // TOTAL (libellé en formule)
  ws.getRow(R.total).height = 32;
  const tl = labelCell(R.total, '', 'A', 'D', { fill: COL.ink });
  tl.value = {
    formula: `IF(AND(${MODE}<>"${PICKUP}",${COUNT}<${freeFrom}),"TOTAL (${DELIVERY.paidLabel.toLowerCase()})","TOTAL")`,
    result: totalLabelResult,
  };
  tl.font = f({ size: 13, bold: true, color: COL.white });
  const tot = ws.getCell(`E${R.total}`);
  tot.value = { formula: `E${R.sub}`, result: subtotal };
  tot.numFmt = MONEY;
  tot.font = f({ size: 15, bold: true, color: COL.white });
  tot.fill = solid(COL.ink);
  tot.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };

  // Jauge « livraison offerte » (formule)
  ws.getRow(R.hint).height = 22;
  ws.mergeCells(`A${R.hint}:E${R.hint}`);
  const hint = ws.getCell(`A${R.hint}`);
  hint.value = {
    formula: `IF(${MODE}="${PICKUP}","${pickupHint}",IF(${COUNT}>=${freeFrom},"Livraison offerte${NBSP}: votre commande compte "&${COUNT}&" articles.","Plus que "&(${freeFrom}-${COUNT})&" article"&IF(${freeFrom}-${COUNT}>1,"s","")&" pour la livraison offerte (dès ${freeFrom} articles)."))`,
    result: hintResult,
  };
  hint.font = f({ size: 10, italic: true, bold: true, color: COL.blue });
  hint.fill = solid(COL.ice50);
  hint.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };

  // Poids indicatif
  ws.getRow(R.weight).height = 20;
  labelCell(R.weight, 'Poids total indicatif', 'A', 'D', { font: { size: 9, color: COL.soft } });
  const wTerms = items.map((it, i) => (it.kg ? `D${first + i}*${it.kg}` : null)).filter(Boolean);
  const wc = ws.getCell(`E${R.weight}`);
  wc.value = { formula: wTerms.length ? wTerms.join('+') : '0', result: weight };
  wc.numFmt = '#,##0 "kg"';
  wc.font = f({ size: 9.5, color: COL.muted });
  wc.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };

  // ---- Coordonnées (déverrouillées)
  const section = (row, title, note) => {
    ws.mergeCells(`A${row}:E${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = {
      richText: [
        { text: title, font: f({ size: 11, bold: true, color: COL.white }) },
        ...(note ? [{ text: `   ${note}`, font: f({ size: 9, color: COL.ice200 }) }] : []),
      ],
    };
    c.fill = solid(COL.ink800);
    c.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(row).height = 24;
  };
  section(clientStart, 'VOS COORDONNÉES', 'modifiables (cases bleues)');
  const cl = q.client || {};
  const dl = q.delivery || {};
  const values = {
    name: cleanSpaces(cl.name || ''),
    company: cleanSpaces(cl.company || ''),
    phone: formatPhone(cl.phone),
    email: cleanSpaces(cl.email || ''),
    mode: modeValue,
    commune: pickup ? '' : cleanSpaces(dl.commune || ''),
    address: pickup ? `${BRAND.address.street}, ${BRAND.address.city} (retrait)` : cleanSpaces(dl.address || ''),
    date: excelDate(dl.date),
    slot: formatSlot(dl.slot),
    note: cleanSpaces(cl.note || ''),
  };
  FIELDS.forEach(([key, label]) => {
    const row = fieldRow[key];
    ws.getRow(row).height = key === 'note' ? 48 : 22;
    const a = ws.getCell(`A${row}`);
    a.value = label + (key === 'name' || key === 'phone' ? ' *' : '');
    a.font = f({ size: 9.5, bold: true, color: COL.ink });
    a.fill = solid(COL.ice50);
    a.alignment = { vertical: 'middle', indent: 1 };
    a.border = { bottom: thin() };
    ws.mergeCells(`B${row}:E${row}`);
    const v = ws.getCell(`B${row}`);
    v.value = values[key];
    v.font = f({ size: 10.5, bold: key === 'name', color: COL.ink });
    v.fill = solid(COL.ice100);
    v.border = edit();
    v.alignment = { horizontal: 'left', vertical: key === 'note' ? 'top' : 'middle', indent: 1, wrapText: key === 'note' || key === 'address' };
    for (const c of 'BCDE') ws.getCell(`${c}${row}`).protection = { locked: false };
    if (key === 'date' && values.date instanceof Date) v.numFmt = 'dd/mm/yyyy';
    if (key === 'mode') {
      v.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${DELIVER},${PICKUP}"`],
        showErrorMessage: true,
        errorTitle: 'Mode',
        error: `Choisissez « ${DELIVER} » ou « ${PICKUP} ».`,
        showInputMessage: true,
        promptTitle: 'Livraison ou retrait',
        prompt: `${DELIVERY.freeLabel}. Retrait gratuit à ${BRAND.address.street}.`,
      };
    }
    if (key === 'commune') {
      v.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${DELIVERY.communes.join(',')}"`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Commune',
        error: 'Commune hors liste : vérifiez l’orthographe ou choisissez « Autre localité ».',
      };
    }
    if (key === 'phone') {
      v.dataValidation = {
        type: 'textLength',
        operator: 'between',
        allowBlank: true,
        formulae: [10, 20],
        showInputMessage: true,
        promptTitle: 'Numéro WhatsApp',
        prompt: 'Pour recevoir la confirmation de votre commande (10 chiffres, +225 accepté).',
      };
    }
  });

  // ---- Mentions + lien WhatsApp
  let m = fieldRow.note + 2;
  section(m, 'BON À SAVOIR');
  const mentions = [
    [QUOTE.payment, false],
    [QUOTE.deliveryNote, false],
    [`Devis valable ${QUOTE.validityDays}${NBSP}jours, jusqu’au ${formatQuoteDate(q.validUntil)}. Les prix unitaires sont verrouillés ; seules les cases bleues sont modifiables.`, false],
    [QUOTE.disclaimer, true],
  ];
  for (const [txt, strong] of mentions) {
    m += 1;
    ws.mergeCells(`A${m}:E${m}`);
    const c = ws.getCell(`A${m}`);
    c.value = txt;
    c.font = f({ size: 9.5, bold: strong, color: strong ? COL.ink : COL.muted });
    c.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    ws.getRow(m).height = txt.length > 95 ? 30 : 19;
  }
  m += 2;
  ws.mergeCells(`A${m}:E${m}`);
  const wa = ws.getCell(`A${m}`);
  wa.value = {
    text: `ENVOYER CE DEVIS SUR WHATSAPP  ›  ${BRAND.phones[0].display}`,
    hyperlink: whatsappUrl(shortWhatsappMessage(q, 'Excel')),
    tooltip: 'Ouvrir la discussion WhatsApp avec Le Glaceur',
  };
  wa.font = f({ size: 12, bold: true, color: COL.white });
  wa.fill = solid(COL.wa);
  wa.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(m).height = 30;
  m += 1;
  ws.mergeCells(`A${m}:E${m}`);
  const ct = ws.getCell(`A${m}`);
  ct.value = `${BRAND.name} — ${BRAND.signature}  ·  ${BRAND.address.street}, ${BRAND.address.city}  ·  ${BRAND.hours}  ·  ${BRAND.email}`;
  ct.font = f({ size: 8.5, color: COL.soft });
  ct.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(m).height = 26;

  ws.pageSetup.printArea = `A1:E${m}`;
  ws.pageSetup.printTitlesRow = '7:7';

  await ws.protect(SHEET_PASSWORD, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    formatRows: true,
    spinCount: 1000,
  });

  /* ===================================================================== Infos */
  const wi = wb.addWorksheet('Infos', {
    properties: { tabColor: { argb: COL.ice300 } },
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
  });
  wi.columns = [{ width: 30 }, { width: 70 }];
  for (let rr = 1; rr <= 2; rr++) for (const c of 'AB') wi.getCell(`${c}${rr}`).fill = solid(COL.ink);
  wi.getRow(1).height = 50;
  wi.getRow(2).height = 20;
  if (logoId !== null) {
    wi.addImage(logoId, { tl: { col: 0.12, row: 0.1 }, ext: { width: 186, height: Math.round(186 * logo.ratio) }, editAs: 'oneCell' });
  } else {
    wi.getCell('A1').value = BRAND.name.toUpperCase();
    wi.getCell('A1').font = f({ size: 20, bold: true, color: COL.white });
  }
  const it = wi.getCell('B1');
  it.value = 'INFORMATIONS';
  it.font = f({ size: 22, bold: true, color: COL.white });
  it.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  const tg = wi.getCell('B2');
  tg.value = BRAND.tagline;
  tg.font = f({ size: 10, italic: true, color: COL.ice200 });
  tg.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  wi.mergeCells('A3:B3');
  wi.getRow(3).height = 5;
  wi.getCell('A3').fill = ws.getCell('A3').fill;

  let ir = 4;
  const iSection = (title) => {
    ir += 1;
    wi.mergeCells(`A${ir}:B${ir}`);
    const c = wi.getCell(`A${ir}`);
    c.value = title;
    c.font = f({ size: 11, bold: true, color: COL.white });
    c.fill = solid(COL.ink800);
    c.alignment = { vertical: 'middle', indent: 1 };
    wi.getRow(ir).height = 24;
    ir += 1;
  };
  const iRow = (label, value, link) => {
    const a = wi.getCell(`A${ir}`);
    a.value = label;
    a.font = f({ size: 9.5, bold: true, color: COL.muted });
    a.alignment = { vertical: 'middle', indent: 1, wrapText: true };
    a.border = { bottom: thin() };
    const b = wi.getCell(`B${ir}`);
    b.value = link ? { text: value, hyperlink: link } : value;
    b.font = f({ size: 10.5, bold: !!link, color: link ? COL.blue : COL.ink, underline: !!link });
    b.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    b.border = { bottom: thin() };
    wi.getRow(ir).height = value.length > 80 ? 32 : 21;
    ir += 1;
  };

  iSection('NOUS CONTACTER');
  BRAND.phones.forEach((p, i) => iRow(p.label, p.display, i === 0 ? `https://wa.me/${BRAND.whatsapp}` : `tel:${p.tel}`));
  iRow('E-mail', BRAND.email, `mailto:${BRAND.email}`);
  iRow('Adresse', `${BRAND.address.street}, ${BRAND.address.city}, ${BRAND.address.country}`, mapsUrl);
  iRow('Horaires', BRAND.hours);

  iSection('LIVRAISON ET RETRAIT');
  iRow('Livraison offerte', `${DELIVERY.freeLabel} (somme de toutes les quantités du devis).`);
  iRow('Moins de 20 articles', DELIVERY.paidNote);
  iRow(DELIVERY.pickup.label, `${DELIVERY.pickup.text} Gratuit.`);
  iRow('Communes desservies', DELIVERY.communes.join(', '));

  iSection('RENVOYER VOTRE DEVIS SUR WHATSAPP');
  [
    'Dans la feuille « Devis », ajustez vos quantités et vos coordonnées (cases bleues uniquement).',
    'Les montants, le transport et le total se recalculent automatiquement.',
    'Enregistrez le fichier.',
    `Ouvrez WhatsApp au ${BRAND.phones[0].display} (lien ci-dessous) et joignez ce fichier Excel à votre message.`,
    `${BRAND.name} vous confirme la commande, la date et, s’il y a lieu, le tarif de livraison.`,
  ].forEach((s, i) => iRow(`Étape ${i + 1}`, s));
  ir += 1;
  wi.mergeCells(`A${ir}:B${ir}`);
  const iw = wi.getCell(`A${ir}`);
  iw.value = { text: `OUVRIR WHATSAPP  ›  ${BRAND.phones[0].display}`, hyperlink: whatsappUrl(shortWhatsappMessage(q, 'Excel')) };
  iw.font = f({ size: 12, bold: true, color: COL.white });
  iw.fill = solid(COL.wa);
  iw.alignment = { horizontal: 'center', vertical: 'middle' };
  wi.getRow(ir).height = 30;
  ir += 2;
  wi.mergeCells(`A${ir}:B${ir}`);
  const disc = wi.getCell(`A${ir}`);
  disc.value = `${QUOTE.disclaimer} ${QUOTE.payment}`;
  disc.font = f({ size: 9.5, bold: true, color: COL.ink });
  disc.alignment = { wrapText: true, vertical: 'middle', indent: 1 };
  wi.getRow(ir).height = 30;
  ir += 1;
  wi.mergeCells(`A${ir}:B${ir}`);
  const sig = wi.getCell(`A${ir}`);
  sig.value = `${BRAND.name} — ${BRAND.signature}`;
  sig.font = f({ size: 9, color: COL.soft });
  sig.alignment = { indent: 1 };

  await wi.protect(SHEET_PASSWORD, { selectLockedCells: true, selectUnlockedCells: true, spinCount: 1000 });

  wb.views = [{ activeTab: 0, firstSheet: 0, visibility: 'visible' }];

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
