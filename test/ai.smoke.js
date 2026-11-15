/* AI smoke test: stronger levels should beat weaker ones. Run: node test/ai.smoke.js */
'use strict';
const E = require('../src/engine.js');
const AI = require('../src/ai.js');
const log = console.log;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function play(a, b, games, rules) {
  const R = rng(99); let wa = 0, wb = 0, dr = 0, plies = 0, maxMs = 0;
  for (let g = 0; g < games; g++) {
    let s = E.newGame(E.makeRules(rules), { first: g % 2 });
    const seatA = g % 4 < 2 ? 0 : 1;
    while (s.winner === null && s.ply < 300) {
      const lvl = s.turn === seatA ? a : b;
      const t0 = Date.now();
      console.log = () => {};
      const r = AI.think(s, lvl, R);
      s = E.applyMove(s, r.move).state;
      console.log = log;
      maxMs = Math.max(maxMs, Date.now() - t0);
    }
    plies += s.ply;
    if (s.winner === seatA) wa++; else if (s.winner === 1 - seatA) wb++; else dr++;
  }
  log(`${JSON.stringify(a)} vs ${JSON.stringify(b)}: ${wa}-${wb} (${dr} unfinished), avg ${Math.round(plies / games)} plies, slowest move ${maxMs} ms`);
  return [wa, wb];
}
const fast = { depth: 3, time: 150, blunder: 0, noise: 1 };
let bad = 0;
let r = play('intermediate', 'beginner', 30, { reverseSowing: false }); if (r[0] <= r[1]) bad++;
r = play(fast, 'intermediate', 20, { reverseSowing: true }); if (r[0] <= r[1]) bad++;
r = play(fast, 'beginner', 20, { reverseSowing: true }); if (r[0] <= r[1]) bad++;
log(bad ? 'FAIL' : 'ok: stronger settings win more');
process.exit(bad ? 1 : 0);
