/* Local preview of the built page in headless Chromium.
   Wraps dist/igisoro.html in the same skeleton the Artifact host adds, serves the Three.js
   CDN URL from node_modules (the sandbox has no CDN access), and runs a scenario.
   Run: node tools/preview.js <scenario> [outDir]     scenarios: shots | play | learn | flat */
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { chromium = require('/opt/node-tools/node_modules/playwright').chromium; }
const root = path.join(__dirname, '..');
const out = process.argv[3] || path.join(root, '.preview');
fs.mkdirSync(out, { recursive: true });
const page = fs.readFileSync(path.join(root, 'dist', 'igisoro.html'), 'utf8');
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
const html = SKELETON + page + '</body></html>';
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function open(browser, opts) {
  const co = Object.assign({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, opts || {});
  delete co.before; delete co.hash; delete co.noThree;
  const ctx = await browser.newContext(co);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('console', m => { const t = m.text(); if (m.type() === 'error' || /\[igisoro\]/.test(t)) { if (!/deprecated|ERR_|Failed to load resource/.test(t)) { errors.push(t); console.log('[console.' + m.type() + ']', t.slice(0, 240)); } } });
  pg.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')); });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://igisoro.test/')) return r.fulfill({ body: html, contentType: 'text/html' });
    if (u.includes('three@0.160.0/build/three.min.js') && !(opts && opts.noThree)) return r.fulfill({ path: path.join(root, 'node_modules/three/build/three.min.js'), contentType: 'text/javascript' });
    return r.abort();
  });
  if (opts && opts.before) await opts.before(pg);
  await pg.goto('http://igisoro.test/' + ((opts && opts.hash) || ''));
  await pg.waitForFunction('window.IG && window.IG.ui && document.querySelector("#panel").children.length > 0', null, { timeout: 15000 });
  await pg.waitForTimeout(700);
  pg.errors = errors;
  return pg;
}
const shot = (pg, name) => pg.screenshot({ path: path.join(out, name + '.png') }).then(() => console.log('  shot ' + name));

const scenarios = {
  async shots(b) {
    let pg = await open(b); await shot(pg, 'home-desktop');
    await pg.click('.nav a[data-to="play"]'); await pg.waitForTimeout(300); await shot(pg, 'play-desktop');
    await pg.click('.nav a[data-to="learn"]'); await pg.waitForTimeout(300); await shot(pg, 'learn-desktop');
    await pg.click('.nav a[data-to="progress"]'); await pg.waitForTimeout(300); await shot(pg, 'progress-desktop');
    await pg.close();
    pg = await open(b, { colorScheme: 'dark' }); await shot(pg, 'home-dark'); await pg.close();
    pg = await open(b, { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await shot(pg, 'home-phone');
    const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, pit: document.querySelector('.pit').getBoundingClientRect().width }));
    console.log('  phone: scrollWidth ' + ov.sw + ' clientWidth ' + ov.cw + ' pit target ' + ov.pit.toFixed(1) + 'px');
    await pg.close();
  }
};
module.exports = { open, shot, scenarios, out, GL, chromium };

if (require.main === module) (async () => {
  const name = process.argv[2] || 'shots';
  let extra = {};
  try { extra = require('./preview-scenarios.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  const fn = scenarios[name] || extra[name];
  if (!fn) { console.log('unknown scenario ' + name); process.exit(2); }
  const b = await chromium.launch({ args: GL });
  try { await fn(b, { open, shot, out }); } finally { await b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
