/* Content tests: every Learn position and the puzzle generator, checked with the engine.
   Run: node test/content.test.js */
'use strict';
const E = require('../src/engine.js');
const L = require('../src/lessons-data.js');
const PZ = require('../src/puzzles-gen.js');
const log = console.log;
let passed = 0, failed = 0;
function ok(c, name, extra) { if (c) passed++; else { failed++; log('  FAIL  ' + name + (extra ? '  ' + extra : '')); } }
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = log; } };

function state(lesson, step) {
  const rules = E.makeRules(lesson.rules);
  const ply = lesson.rules.openingNoCaptureMoves ? 0 : 2;
  return E.newGame(rules, { pits: [L.toPits(step.pos.my), L.toPits(step.pos.op)], first: 0, ply });
}
/* mirrors what game.js reports to the lesson after a move */
function infoFor(s, move) {
  const out = quiet(() => E.applyMove(s, move));
  return { move, captured: out.captured, captures: out.captures, drops: out.drops, laps: out.laps,
    relays: out.events.filter(e => e.t === 'relay').length, end: out.end, won: out.state.winner === 0, after: out.state, events: out.events };
}

log('Learn positions');
for (const lesson of L.LESSONS) {
  if (!lesson.steps) continue;
  lesson.steps.forEach((step, n) => {
    const tag = lesson.id + ' step ' + (n + 1) + ' (' + step.type + ')';
    if (step.type === 'demo') {
      const s = state(lesson, step);
      const info = infoFor(s, step.move);
      ok(true, tag);
      if (lesson.id === 'L2') ok(info.relays === 1 && info.captured === 0, tag + ': shows exactly one relay');
      if (lesson.id === 'L3') ok(info.captures === 1 && info.captured === 5 && info.relays === 0, tag + ': shows one clean capture', JSON.stringify([info.captures, info.captured, info.relays]));
    }
    if (step.type === 'free') {
      const s = state(lesson, step);
      ok(quiet(() => E.legalMoves(s)).length >= 5, tag + ': several pits can be sown');
    }
    if (step.type === 'do') {
      const s = state(lesson, step);
      const legal = quiet(() => E.legalMoves(s)).filter(m => !step.only || step.only.indexOf(m.start) >= 0);
      const good = legal.filter(m => L.checkGoal(step.goal, infoFor(s, m), E));
      ok(good.length >= 1, tag + ': has a solution');
      ok(good.some(m => m.start === step.answer && (!step.answerDecisions || m.decisions.join() === step.answerDecisions.join())), tag + ': the recorded answer solves it', JSON.stringify(good));
      if (!step.only) {
        ok(legal.length >= 3, tag + ': offers a real choice (' + legal.length + ' moves)');
        ok(good.length < legal.length, tag + ': not every move solves it');
        if (step.goal.type !== 'safe') ok(new Set(good.map(m => m.start)).size === 1, tag + ': exactly one pit solves it', JSON.stringify(good));
      }
      if (step.glow && step.goal.type === 'endAt') ok(step.glow[0] === step.goal.pit, tag + ': glow marks the target');
      if (step.marks && step.goal.type === 'safe') {
        // the marked pits are exactly what the opponent threatens
        const pass = E.cloneState(s); pass.turn = 1;
        const threats = E.enumerate(pass).filter(c => c.captured > 0);
        ok(threats.length === 1, tag + ': one threat on the board');
        const ev = E.playTurn(pass, threats[0].start, threats[0].decisions, true).events.find(e => e.t === 'capture');
        ok(JSON.stringify(step.marks) === JSON.stringify([[0, ev.a], [0, ev.b]]), tag + ': marks match the threatened pits');
        ok(threats[0].captured === 4, tag + ': text says 4 cows');
      }
    }
    if (step.type === 'two') {
      const s = state(lesson, step);
      const legal = quiet(() => E.legalMoves(s));
      ok(!legal.some(m => infoFor(s, m).captured > 0), tag + ': no capture on the first move');
      let winners = [];
      for (const m of legal) {
        const a = quiet(() => E.applyMove(s, m)).state;
        let b; try { b = quiet(() => E.applyMove(a, step.reply)).state; } catch (e) { ok(false, tag + ': scripted reply is legal after ' + m.start); continue; }
        const replyInfo = E.playTurn(a, step.reply.start, step.reply.decisions, true);
        ok(replyInfo.captured === 0, tag + ': scripted reply takes nothing after ' + m.start);
        const caps = quiet(() => E.legalMoves(b)).filter(x => infoFor(b, x).captured > 0);
        if (caps.length) winners.push({ m, caps });
      }
      ok(winners.length === 1 && winners[0].m.start === step.first, tag + ': exactly one set-up move works', JSON.stringify(winners.map(w => w.m)));
      ok(winners[0] && winners[0].caps.some(x => x.start === step.answer), tag + ': the recorded second move captures');
    }
    if (step.marks && step.type === 'say' && lesson.id === 'L5') ok(JSON.stringify(step.marks.map(m => m[1]).sort((a, b) => a - b)) === JSON.stringify(E.RULES.reversePits), tag + ': marks are the reverse pits');
  });
}

log('Puzzles');
{
  let t0 = Date.now(), n = 0, slowest = 0, attempts = 0;
  for (let day = 1; day <= 40; day++) {
    const t = Date.now();
    const p = quiet(() => PZ.daily(day));
    slowest = Math.max(slowest, Date.now() - t);
    ok(!!p, 'daily #' + day + ' exists');
    if (!p) continue;
    n++; attempts += p.attempts;
    const again = quiet(() => PZ.daily(day));
    ok(JSON.stringify(again) === JSON.stringify(p), 'daily #' + day + ' is deterministic');
    const s = E.newGame(E.makeRules({ reverseSowing: false }), { pits: p.pits, first: 0, ply: p.ply });
    ok(E.totalSeeds(s) === 64, 'daily #' + day + ' has 64 seeds');
    if (p.kind === 'one') {
      const info = infoFor(s, p.solution[0]);
      ok(info.captured === p.need, 'daily #' + day + ' solution captures ' + p.need);
      const others = quiet(() => E.legalMoves(s)).filter(m => !E.sameMove(m, p.solution[0])).map(m => infoFor(s, m).captured);
      ok(Math.max(0, ...others) <= p.need - 2, 'daily #' + day + ' has a single best move');
    } else {
      const a = quiet(() => E.applyMove(s, p.solution[0])).state;
      const b = quiet(() => E.applyMove(a, PZ.replyTo(a))).state;
      ok(infoFor(b, p.solution[1]).captured >= p.need, 'daily #' + day + ' two-move line wins ' + p.need + '+ cows');
    }
  }
  log('  ' + n + ' daily puzzles in ' + (Date.now() - t0) + ' ms (two passes), slowest ' + slowest + ' ms, average ' + (attempts / n).toFixed(1) + ' positions tried');
  const grid = PZ.shareGrid(quiet(() => PZ.daily(1)), [3, 12]);
  ok(grid.split('\n').length === 4 && Array.from(grid.split('\n')[0]).length === 8, 'share grid is 4 rows of 8');
}

log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
