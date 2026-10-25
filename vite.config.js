import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const PARTIALS = resolve(root, 'src/partials');
const IMG_DIR = resolve(root, 'public/img');
const IMG_WIDTHS = [480, 960, 1600];

/** Parse `key="value"` pairs from an @img directive. */
function parseAttrs(src) {
  const out = {};
  for (const m of src.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function readManifest() {
  const file = resolve(IMG_DIR, 'manifest.json');
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; }
}

/**
 * <!-- @img slot="glacons" alt="…" sizes="(min-width: 900px) 40vw, 100vw" class="…" eager -->
 * expands to a responsive <picture> using public/img/<slot>-<w>.(avif|webp).
 * The photo pipeline writes public/img/manifest.json: { slot: { w, h, widths: [...] } }.
 */
function picture(a, base) {
  const manifest = readManifest();
  const meta = manifest[a.slot] || {};
  const widths = meta.widths || IMG_WIDTHS;
  const set = (ext) => widths.map((w) => `${base}img/${a.slot}-${w}.${ext} ${w}w`).join(', ');
  const fallbackW = widths.includes(960) ? 960 : widths[widths.length - 1];
  const sizes = a.sizes || '100vw';
  const eager = 'eager' in a || a.loading === 'eager';
  const dims = meta.w && meta.h ? ` width="${meta.w}" height="${meta.h}"` : '';
  const cls = a.class ? ` class="${a.class}"` : '';
  const pcls = a['picture-class'] ? ` class="${a['picture-class']}"` : '';
  return `<picture${pcls}><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="${base}img/${a.slot}-${fallbackW}.webp" alt="${a.alt ?? ''}"${dims}${cls} loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}></picture>`;
}

/** Build-time HTML composition: @include partials, @img pictures, {{base}} token. */
function htmlComposer() {
  let base = '/';
  const expand = (html, depth = 0) => {
    if (depth > 10) throw new Error('[html-composer] include depth exceeded');
    html = html.replace(/<!--\s*@include\s+([\w./-]+)\s*-->/g, (_, p) => {
      const file = resolve(PARTIALS, p);
      if (!existsSync(file)) {
        console.warn(`[html-composer] missing partial: ${p}`);
        return `<!-- missing partial: ${p} -->`;
      }
      return expand(readFileSync(file, 'utf8'), depth + 1);
    });
    html = html.replace(/<!--\s*@img\s+([\s\S]+?)\s*-->/g, (_, attrs) => {
      const a = parseAttrs(attrs);
      if (/(^|\s)eager(\s|$)/.test(attrs)) a.eager = '';
      return picture(a, base);
    });
    return html.replaceAll('{{base}}', base);
  };
  return {
    name: 'html-composer',
    enforce: 'pre',
    configResolved(config) { base = config.base; },
    transformIndexHtml: { order: 'pre', handler: (html) => expand(html) },
    handleHotUpdate({ file, server }) {
      if (file.includes('/src/partials/') || file.endsWith('manifest.json')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  // BASE_PATH is set by the GitHub Pages workflow ("/<repo>/" without a custom domain, "/" with one).
  base: process.env.BASE_PATH || '/',
  plugins: [htmlComposer()],
  optimizeDeps: { include: ['jspdf', 'jspdf-autotable', 'qrcode', 'exceljs'] },
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        devis: resolve(root, 'devis.html'),
        guide: resolve(root, 'guide.html'),
        mentions: resolve(root, 'mentions-legales.html'),
        notfound: resolve(root, '404.html'),
        admin: resolve(root, 'admin.html'),
      },
    },
  },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
