/* Assembles src/ into the single published page: dist/igisoro.html
   Run: node tools/build.js
   The published artifact's own link (used in invitations) is read from tools/artifact-url.txt when present. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const APP = ['lessons-data.js', 'puzzles-gen.js', 'render.js', 'audio.js', 'core.js', 'progress.js', 'game.js', 'learn.js', 'net.js', 'ui.js'];
let url = '';
try { url = fs.readFileSync(path.join(__dirname, 'artifact-url.txt'), 'utf8').trim(); } catch (e) { }

let app = APP.map(f => '/* ===== ' + f + ' ===== */\n' + read(f)).join('\n');
app = app.replace('%%ARTIFACT_URL%%', url);

let html = read('page.html');
const put = (mark, text) => {
  if (!html.includes(mark)) throw new Error('missing marker ' + mark);
  if (/<\/script/i.test(text)) throw new Error('source for ' + mark + ' contains a closing script tag');
  html = html.split(mark).join(text);
};
put('/*%%CSS%%*/', read('app.css'));
put('/*%%ENGINE%%*/', read('engine.js'));
put('/*%%AI%%*/', read('ai.js'));
put('/*%%APP%%*/', app);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'igisoro.html'), html);
console.log('dist/igisoro.html  ' + (html.length / 1024).toFixed(0) + ' KB' + (url ? '  link: ' + url : '  (no artifact link yet)'));
