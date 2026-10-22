#!/usr/bin/env node
/*
 * Rend une scène du studio (tools/renders/scene-<nom>.js) avec Chromium headless (SwiftShader),
 * puis réduit en lanczos3 (sharp) — suréchantillonnage 2× par défaut.
 *
 *   node tools/renders/render.mjs barres                       → aperçu 800×1000 dans ./renders-out/
 *   node tools/renders/render.mjs barres --final --out <dir>    → rendu 3200×4000 réduit en 1600×2000 (PNG)
 *   node tools/renders/render.mjs gobelet --final --publish     → + public/img/gobelet-{480,960,1600}.{avif,webp}
 *
 * Options : --variant N, --w W --h H (taille de rendu), --ss 2 (suréchantillonnage), --out dossier.
 */
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const scene = args.find((a) => !a.startsWith('--')) || 'barres';
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(`--${k}`);
const final = flag('final');
const ss = +opt('ss', final ? 2 : 1);
const outW = +opt('w', final ? 1600 : 800);
const outH = +opt('h', final ? 2000 : 1000);
const variant = +opt('variant', 0);
const outDir = resolve(opt('out', join(process.cwd(), 'renders-out')));
const tag = opt('tag', `${scene}-v${variant}${final ? '-final' : ''}`);

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
page.on('console', (m) => { if (m.type() === 'info') console.log('  ·', m.text()); if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const rw = outW * ss, rh = outH * ss;
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/tools/renders/index.html?scene=${scene}&w=${rw}&h=${rh}&variant=${variant}`);
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
  const slot = opt('slot', scene);
  const img = join(ROOT, 'public/img');
  for (const width of [480, 960, 1600]) {
    const base = sharp(png).resize(width, Math.round((width * outH) / outW), { kernel: 'lanczos3' });
    await base.clone().avif({ quality: 52, effort: 6 }).toFile(join(img, `${slot}-${width}.avif`));
    await base.clone().webp({ quality: 80 }).toFile(join(img, `${slot}-${width}.webp`));
  }
  console.log(`publié : public/img/${slot}-{480,960,1600}.{avif,webp}`);
}
