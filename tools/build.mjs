// Assemble une page autonome : node tools/build.mjs [--seed fichier.json] [--out chemin]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const core = ['geom', 'ortho', 'solver', 'layout', 'vector', 'pdfvec', 'dxf', 'raster', 'library'].map((f) => read(`src/core/${f}.js`));
const app = ['store', 'view', 'input', 'ui', 'importer', 'features', 'openings', 'walls', 'context', 'guides', 'sketch', 'main'].filter((f) => fs.existsSync(path.join(root, `src/app/${f}.js`))).map((f) => read(`src/app/${f}.js`));
const css = read('src/app/style.css'); const body = read('src/app/body.html');
let seed = '';
if (opt('--seed')) seed = `<script>globalThis.CALEPIN_SEED=${fs.readFileSync(opt('--seed'), 'utf8').replace(/</g, '\\u003c')};</script>`;
const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Calepin — plan et parquet</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
${body}
${seed}
<script>
${core.join('\n')}
${app.join('\n')}
</script>
</body></html>`;
const out = opt('--out') || path.join(root, 'index.html');
fs.writeFileSync(out, html); console.log('écrit', out, (html.length / 1024).toFixed(0) + ' Ko');
