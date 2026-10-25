#!/usr/bin/env node
/*
 * Rendu « Glace en grain » (scene.js) avec Chromium headless (SwiftShader), puis réduction lanczos3 (sharp).
 *
 *   node tools/renders/grain/render.mjs                         → aperçu 800×1000 (PNG) dans ./renders-out/
 *   node tools/renders/grain/render.mjs --final --out <dossier> → rendu 3200×4000 réduit en 1600×2000 (PNG)
 *   node tools/renders/grain/render.mjs --final --publish       → + public/img/grain-{480,960,1600}.{avif,webp}
 *
 * Options : --variant N, --w W --h H (taille de sortie), --ss 2 (suréchantillonnage), --out dossier, --tag nom,
 *           --set clé=valeur (paramètre de scène, répétable : cam, key, exposure…).
 */
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const final = flag('final');
const ss = +opt('ss', final ? 2 : 1);
const outW = +opt('w', final ? 1600 : 800);
const outH = +opt('h', final ? 2000 : 1000);
const variant = +opt('variant', 0);
const outDir = resolve(opt('out', join(process.cwd(), 'renders-out')));
const tag = opt('tag', `grain-v${variant}${final ? '-final' : ''}`);
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = resolve(ROOT, '.' + p);
    if (!file.startsWith(ROOT)) throw new Error('hors racine');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'info') console.log('  ·', m.text());
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const rw = outW * ss, rh = outH * ss;
const t0 = Date.now();
const q = new URLSearchParams({ w: rw, h: rh, variant });
for (const s of sets) { const [k, v] = s.split('='); q.set(k, v); }
await page.goto(`http://127.0.0.1:${port}/tools/renders/grain/index.html?${q}`);
await page.waitForFunction(() => window.__status !== 'loading', null, { timeout: 0, polling: 1000 });
const status = await page.evaluate(() => window.__status);
if (status !== 'done') {
  console.error(status, errors.join('\n'));
  await browser.close(); server.close(); process.exit(1);
}
const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
await browser.close();
server.close();
if (errors.length) console.warn(errors.join('\n'));

await mkdir(outDir, { recursive: true });
const raw = Buffer.from(dataUrl.split(',')[1], 'base64');
const png = await sharp(raw).resize(outW, outH, { kernel: 'lanczos3' }).png().toBuffer();
const outPng = join(outDir, `${tag}.png`);
await writeFile(outPng, png);
console.log(`${outPng} (${rw}×${rh} → ${outW}×${outH}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);

if (flag('publish')) {
  const img = join(ROOT, 'public/img');
  for (const width of [480, 960, 1600]) {
    const base = sharp(png).resize(width, Math.round((width * outH) / outW), { kernel: 'lanczos3' });
    // sharp n'écrit aucune métadonnée (EXIF/XMP/ICC) sans .withMetadata()
    await base.clone().avif({ quality: 52, effort: 6 }).toFile(join(img, `grain-${width}.avif`));
    await base.clone().webp({ quality: 80 }).toFile(join(img, `grain-${width}.webp`));
  }
  console.log('publié : public/img/grain-{480,960,1600}.{avif,webp}');
}
