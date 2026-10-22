/**
 * Devis en image : le PDF du devis converti en PNG (pdf.js, chargé à la demande),
 * donc strictement identique au PDF. Pratique à partager sur WhatsApp.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.min.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const WIDTH = 1600; // px : net sur téléphone, poids raisonnable

/** PDF (Blob) → PNG (Blob) ; plusieurs pages sont empilées verticalement. */
export async function pdfToImage(pdfBlob) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: WIDTH / page.getViewport({ scale: 1 }).width });
      const c = document.createElement('canvas');
      c.width = Math.round(viewport.width);
      c.height = Math.round(viewport.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvas: c, canvasContext: ctx, viewport }).promise;
      pages.push(c);
    }
    const out = document.createElement('canvas');
    out.width = WIDTH;
    out.height = pages.reduce((h, c) => h + c.height, 0);
    const ctx = out.getContext('2d');
    pages.reduce((y, c) => { ctx.drawImage(c, 0, y); return y + c.height; }, 0);
    return await new Promise((ok, ko) => out.toBlob((b) => (b ? ok(b) : ko(new Error('image du devis : échec'))), 'image/png'));
  } finally {
    task.destroy();
  }
}
