/**
 * Export Excel du registre des devis (page /admin), chargé à la demande.
 * Feuilles : « Devis » (une ligne par devis + total), « Lignes » (une ligne par produit commandé), « Par produit ».
 */
import ExcelJS from 'exceljs';
import { formatPhone } from './message.js';

const INK = 'FF0A1F44';
const ICE = 'FFE3F3FF';
const MONEY = '#,##0" F"';

function sheet(wb, name, columns) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
  head.height = 22;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

function totalRow(ws, values) {
  const r = ws.addRow(values);
  r.font = { bold: true };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ICE } };
}

const delivery = (q) => (q.delivery?.mode === 'retrait' ? 'Retrait' : q.delivery?.free ? 'Livraison offerte' : 'Hors frais de livraison');

export async function buildRegisterXlsx({ du, au, devis }, products) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Le Glaceur';
  wb.title = `Registre des devis du ${du} au ${au}`;

  const d = sheet(wb, 'Devis', [
    { header: 'Date', key: 'date', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'N° devis', key: 'number', width: 20 },
    { header: 'Client', key: 'name', width: 24 },
    { header: 'WhatsApp', key: 'phone', width: 20 },
    { header: 'Structure', key: 'company', width: 22 },
    { header: 'E-mail', key: 'email', width: 26 },
    { header: 'Livraison', key: 'delivery', width: 22 },
    { header: 'Commune', key: 'commune', width: 16 },
    { header: 'Adresse', key: 'address', width: 28 },
    { header: 'Articles', key: 'count', width: 10 },
    { header: 'Total', key: 'total', width: 14, style: { numFmt: MONEY } },
  ]);
  for (const q of devis) {
    d.addRow({
      date: new Date(q.date), number: q.number, name: q.client?.name, phone: q.client?.phone ? formatPhone(q.client.phone) : '',
      company: q.client?.company, email: q.client?.email, delivery: delivery(q), commune: q.delivery?.commune || '',
      address: q.delivery?.address || '', count: q.count, total: q.total,
    });
  }
  const n = devis.length + 1;
  totalRow(d, { date: null, number: `${devis.length} devis`, count: { formula: `SUM(J2:J${n})` }, total: { formula: `SUM(K2:K${n})` } });

  const l = sheet(wb, 'Lignes', [
    { header: 'Date', key: 'date', width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
    { header: 'N° devis', key: 'number', width: 20 },
    { header: 'Client', key: 'name', width: 24 },
    { header: 'Produit', key: 'product', width: 20 },
    { header: 'Format', key: 'label', width: 16 },
    { header: 'Quantité', key: 'qty', width: 10 },
    { header: 'Prix unitaire', key: 'price', width: 14, style: { numFmt: MONEY } },
    { header: 'Montant', key: 'total', width: 14, style: { numFmt: MONEY } },
  ]);
  for (const q of devis) {
    for (const x of q.lines || []) {
      l.addRow({ date: new Date(q.date), number: q.number, name: q.client?.name, product: x.name, label: x.label, qty: x.qty, price: x.price, total: x.total });
    }
  }
  totalRow(l, { product: 'Total', total: { formula: `SUM(H2:H${l.rowCount})` } });

  const p = sheet(wb, 'Par produit', [
    { header: 'Produit', key: 'name', width: 22 },
    { header: 'Format', key: 'label', width: 16 },
    { header: 'Quantité', key: 'qty', width: 12 },
    { header: 'Montant', key: 'total', width: 16, style: { numFmt: MONEY } },
  ]);
  for (const x of products) p.addRow({ name: x.name, label: x.label, qty: x.qty, total: x.total });
  totalRow(p, { name: 'Total', total: { formula: `SUM(D2:D${products.length + 1})` } });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
