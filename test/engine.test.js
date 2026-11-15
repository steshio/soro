/* Engine tests (brief section 3.10). Run: node test/engine.test.js */
'use strict';
const E = require('../src/engine.js');

let passed = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL  ' + name + (extra ? '  ' + extra : '')); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name, JSON.stringify(a) + ' != ' + JSON.stringify(b)); }

/* Deterministic PRNG so failures reproduce. */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Build a position from sparse maps; leftover seeds are parked so the total is 64. */
function pos(my, op, o) {
  o = o || {};
  const a = new Array(16).fill(0), b = new Array(16).fill(0);
  for (const k in my) a[k] = my[k];
  for (const k in op) b[k] = op[k];
  const rules = E.makeRules(o.rules || { reverseSowing: false });
  const s = E.newGame(rules, { pits: [a, b], first: 0, ply: o.ply === undefined ? 2 : o.ply });
  return s;
}
function run(s, start, dec) { return E.playTurn(s, start, dec || [], true); }
function kinds(r) { return r.events.map(e => e.t).join(' '); }

console.log('Hand-built positions');

/* 1. Simple relay: 2 seeds from pit 0 land on pit 2 (occupied, outer) -> lift 2, sow 3 and 4, stop. */
{
  const s = pos({ 0: 2, 2: 1 }, { 8: 30, 9: 31 });
  const r = run(s, 0);
  eq(r.status, 'done', 'relay: completes');
  eq(r.my.slice(0, 6), [0, 1, 0, 1, 1, 0], 'relay: final pits');
  eq(kinds(r), 'lift drop drop relay lift drop drop end', 'relay: event order');
  eq(r.laps, 2, 'relay: two laps');
  eq(r.captured, 0, 'relay: no capture');
}

/* 2. Single capture: 2 seeds from inner pit 8 land on inner pit 10 (occupied).
      Opposite pits are opponent 13 (inner) and 2 (outer). Captured seeds are sown after the origin. */
{
  const s = pos({ 8: 2, 10: 1 }, { 13: 3, 2: 2, 0: 56 });
  const r = run(s, 8);
  eq(r.status, 'done', 'capture: completes');
  eq(r.captured, 5, 'capture: takes both opposite pits');
  eq([r.op[13], r.op[2]], [0, 0], 'capture: opposite pits emptied');
  eq(r.my.slice(8, 15), [0, 2, 3, 1, 1, 1, 0], 'capture: cows sown from the pit after the origin');
  ok(kinds(r).indexOf('capture capsow') > 0, 'capture: capture then capsow events');
  const cap = r.events.find(e => e.t === 'capture');
  eq([cap.pit, cap.a, cap.b, cap.na, cap.nb], [10, 13, 2, 3, 2], 'capture: event names the pits');

  /* Same position with captureSowStart = origin: first cow goes into the origin pit itself. */
  const s2 = pos({ 8: 2, 10: 1 }, { 13: 3, 2: 2, 0: 56 }, { rules: { reverseSowing: false, captureSowStart: 'origin' } });
  const r2 = run(s2, 8);
  eq(r2.my.slice(8, 14), [1, 2, 3, 1, 1, 0], 'capture: origin variant sows into the origin first');
}

/* 3. Chained capture: the captured lap itself ends on an occupied inner pit with both opposite pits full. */
{
  // First capture at 10 takes 1+1 = 2 cows; they are sown into 9 and 10 -> 10 is occupied, inner,
  // but its opposite pits are now empty, so design the second capture at pit 12 instead:
  // capture 4 cows (3+1) -> sown into 9,10,11,12; pit 12 holds 1 and faces opponent 11 and 4.
  const s = pos({ 8: 2, 10: 1, 12: 1 }, { 13: 3, 2: 1, 11: 2, 4: 2, 0: 52 });
  const r = run(s, 8);
  eq(r.status, 'done', 'chain: completes');
  eq(r.captures, 2, 'chain: two captures in one turn');
  eq(r.captured, 8, 'chain: 4 + 4 cows');
  eq([r.op[13], r.op[2], r.op[11], r.op[4]], [0, 0, 0, 0], 'chain: all four pits emptied');
}

/* 4. Capture blocked by one empty opposite pit: relay instead. */
{
  const s = pos({ 8: 2, 10: 1 }, { 13: 3, 2: 0, 0: 58 });
  const r = run(s, 8);
  eq(r.captured, 0, 'blocked: no capture with an empty opposite pit');
  ok(kinds(r).indexOf('relay') > 0, 'blocked: relays');
  eq(r.op[13], 3, 'blocked: opponent untouched');
}

/* 5. Reverse sowing is offered only when the clockwise lap captures. */
{
  const T = { reverseSowing: true };
  // Pit 15 (nteba) holds 2. Clockwise: 14, 13. Pit 13 is occupied and faces opponent 10 and 5.
  const s = pos({ 15: 2, 13: 1 }, { 10: 2, 5: 2, 0: 57 }, { rules: T });
  const r = run(s, 15);
  eq(r.status, 'pending', 'reverse: a choice is offered');
  eq(r.pending.options, ['ccw', 'cw'], 'reverse: both directions listed');
  const cw = run(s, 15, ['cw']);
  eq(cw.status, 'done', 'reverse: clockwise completes');
  eq(cw.captured, 4, 'reverse: clockwise lap captures');
  eq(cw.events[0].dir, -1, 'reverse: lift is clockwise');
  const sow = cw.events.find(e => e.t === 'capsow');
  eq(sow.dir, -1, 'reverse: cows are sown in the direction of the capturing lap');
  const ccw = run(s, 15, ['ccw']);
  eq(ccw.status, 'done', 'reverse: anticlockwise still allowed');
  eq(ccw.captured, 0, 'reverse: anticlockwise does not capture here');
  const mv = E.legalMoves(s).filter(m => m.start === 15).map(m => m.decisions.join(''));
  eq(mv, ['ccw', 'cw'], 'reverse: legalMoves lists both sequences');

  // Same shape but the clockwise lap would not capture (opposite outer pit empty): no choice.
  const s2 = pos({ 15: 2, 13: 1 }, { 10: 2, 5: 0, 0: 59 }, { rules: T });
  const r2 = run(s2, 15);
  eq(r2.status, 'done', 'reverse: no choice when clockwise would not capture');
  eq(r2.events[0].dir, 1, 'reverse: plays anticlockwise');
  // Not from a non-reverse pit, even if a clockwise lap would capture.
  const s3 = pos({ 12: 2, 10: 1 }, { 13: 2, 2: 2, 0: 57 }, { rules: T });
  eq(run(s3, 12).status, 'done', 'reverse: only the four reverse pits offer it');
  // Rule switched off: never offered.
  const s4 = pos({ 15: 2, 13: 1 }, { 10: 2, 5: 2, 0: 57 }, { rules: { reverseSowing: false } });
  eq(run(s4, 15).status, 'done', 'reverse: off in Learn rules');
  // A relay that ends in a reverse pit also gets the choice.
  // 2 seeds from 12 -> 13, 14. Pit 14 (nteba) holds 2 -> relay with 3: clockwise 13, 12, 11. Pit 11 holds 1 and faces 12 and 3.
  const s5 = pos({ 12: 2, 14: 2, 11: 1 }, { 12: 2, 3: 2, 0: 55 }, { rules: T });
  const r5 = run(s5, 12);
  eq(r5.status, 'pending', 'reverse: offered when a relay lap ends in a reverse pit');
  eq(r5.pending.pit, 14, 'reverse: the choice is at the relay pit');
}

/* 6. Opening moves cannot capture. */
{
  const s = pos({ 8: 2, 10: 1 }, { 13: 3, 2: 2, 0: 56 }, { ply: 0 });
  const r = run(s, 8);
  eq(r.captured, 0, 'opening: first move does not capture');
  ok(kinds(r).indexOf('blocked relay') > 0, 'opening: it relays instead');
  const s1 = pos({ 8: 2, 10: 1 }, { 13: 3, 2: 2, 0: 56 }, { ply: 1 });
  eq(run(s1, 8).captured, 0, 'opening: second move does not capture');
  const s2 = pos({ 8: 2, 10: 1 }, { 13: 3, 2: 2, 0: 56 }, { ply: 2 });
  eq(run(s2, 8).captured, 5, 'opening: third move captures');
  // Clockwise sowing is never offered while captures are off.
  const s3 = pos({ 15: 2, 13: 1 }, { 10: 2, 5: 2, 0: 57 }, { ply: 0, rules: { reverseSowing: true } });
  eq(run(s3, 15).status, 'done', 'opening: no reverse choice');
}

/* 7. Optional capture: ndahise relays instead. */
{
  const O = { reverseSowing: false, captureMode: 'optional' };
  const s = pos({ 8: 2, 10: 1 }, { 13: 3, 2: 2, 0: 56 }, { rules: O });
  const r = run(s, 8);
  eq(r.status, 'pending', 'optional: capture is a decision');
  eq(r.pending.options, ['take', 'pass'], 'optional: take or pass');
  eq(run(s, 8, ['take']).captured, 5, 'optional: take captures');
  const p = run(s, 8, ['pass']);
  eq(p.captured, 0, 'optional: pass does not capture');
  ok(kinds(p).indexOf('pass relay') > 0, 'optional: pass relays');
}

/* 8. Minimum seeds, and a lap of 16 that comes back to its own (now empty) pit. */
{
  const s = pos({ 3: 1, 5: 16 }, { 0: 47 });
  eq(run(s, 3).status, 'illegal', 'min seeds: a single seed cannot be sown');
  eq(run(s, 4).status, 'illegal', 'min seeds: an empty pit cannot be sown');
  const r = run(s, 5);
  eq(r.status, 'done', 'full lap: completes');
  eq(r.my[5], 1, 'full lap: last seed lands in the emptied origin and the turn ends');
  eq(r.laps, 1, 'full lap: one lap only');
}

/* 9. Game end: a player with no pit of 2 or more loses. */
{
  // After my capture the opponent holds only single seeds.
  const s = pos({ 8: 2, 10: 1, 0: 55 }, { 13: 3, 2: 1, 5: 1, 6: 1 });
  const out = E.applyMove(s, { start: 8, decisions: [] });
  eq(out.state.winner, 0, 'end: opponent left without a move loses');
  eq(E.legalMoves(out.state).length, 0, 'end: no moves once the game is over');
}

/* 10. Loop guard: find an endless move by search, then check it is rejected. */
console.log('Loop guard');
{
  const R = rng(20261115);
  let found = null, tried = 0;
  const rules = E.makeRules({ reverseSowing: false, openingNoCaptureMoves: 0 });
  while (!found && tried < 400000) {
    tried++;
    // scatter a random number of seeds over my 16 pits; the opponent holds the rest in one pit
    const a = new Array(16).fill(0), b = new Array(16).fill(0);
    const mine = 20 + Math.floor(R() * 40);
    for (let k = 0; k < mine; k++) a[Math.floor(R() * 16)]++;
    b[0] = 64 - mine;
    const s = E.newGame(rules, { pits: [a, b], first: 0, ply: 2 });
    for (let st = 0; st < 16 && !found; st++) {
      if (a[st] < 2) continue;
      const r = E.playTurn(s, st, [], false);
      if (r.status === 'endless') found = { a, b, st, reason: r.reason };
    }
  }
  ok(!!found, 'loop guard: an endless move exists (searched ' + tried + ' positions)');
  if (found) {
    console.log('  endless fixture: my=' + JSON.stringify(found.a) + ' start=' + found.st + ' (' + found.reason + ')');
    const s = E.newGame(rules, { pits: [found.a, found.b], first: 0, ply: 2 });
    const log = console.log; console.log = () => {};
    const legal = E.legalMoves(s);
    console.log = log;
    ok(!legal.some(m => m.start === found.st), 'loop guard: the endless move is not offered');
    let threw = false;
    try { E.applyMove(s, { start: found.st, decisions: [] }); } catch (e) { threw = true; }
    ok(threw, 'loop guard: applying it throws');
  }
  /* The drop cap on its own: with a tiny cap a long but finite move is refused. */
  const s2 = E.newGame(E.makeRules({ reverseSowing: false, maxDropsPerMove: 5 }), { first: 0 });
  eq(E.playTurn(s2, 8, [], false).status, 'endless', 'loop guard: drop cap refuses a move longer than the cap');
}

/* 11. Frozen endless fixture (found by the search above, kept so the test does not depend on the search). */
{
  const rules = E.makeRules({ reverseSowing: false, openingNoCaptureMoves: 0 });
  const FIX = require('./endless-fixture.json');
  const s = E.newGame(rules, { pits: [FIX.my, FIX.op], first: 0, ply: 2 });
  eq(E.totalSeeds(s), 64, 'fixture: 64 seeds');
  const r = E.playTurn(s, FIX.start, [], false);
  eq(r.status, 'endless', 'fixture: move is endless');
  eq(r.reason, 'repeat', 'fixture: detected by a repeated board state within the turn');
}

/* 12. Random self-play: conservation, legality, replay, symmetry. */
console.log('Random self-play');
{
  const R = rng(7);
  const variants = [
    { name: 'learn', n: 900, rules: { reverseSowing: false } },
    { name: 'traditional', n: 900, rules: { reverseSowing: true } },
    { name: 'optional+origin', n: 300, rules: { reverseSowing: true, captureMode: 'optional', captureSowStart: 'origin' } }
  ];
  const log = console.log; let endlessSeen = 0;
  let games = 0, moves = 0, finished = 0, draws = 0, maxPly = 0, withDecisions = 0, maxDrops = 0, caps = 0;
  let bad64 = 0, badMin = 0, badReplay = 0, badMirror = 0, badEvents = 0;
  for (const v of variants) {
    for (let g = 0; g < v.n; g++) {
      games++;
      const rules = E.makeRules(v.rules);
      const first = R() < 0.5 ? 0 : 1;
      let s = E.newGame(rules, { first });
      const start = E.cloneState(s), list = [];
      while (s.winner === null && s.ply < 600) {
        console.log = () => { endlessSeen++; };
        const legal = E.legalMoves(s);
        console.log = log;
        if (!legal.length) { bad64++; break; }   // settle() should have ended the game
        for (const m of legal) if (s.pits[s.turn][m.start] < rules.minSeedsToSow) badMin++;
        const m = legal[Math.floor(R() * legal.length)];
        if (m.decisions.length) withDecisions++;
        // symmetry: the mirrored position, same move, gives the mirrored result
        if (g % 10 === 0) {
          const a = E.applyMove(s, m).state, b = E.applyMove(E.mirror(s), m).state;
          if (E.hash(E.mirror(a)) !== E.hash(b)) badMirror++;
        }
        const out = E.applyMove(s, m);
        // the event log replays to the same position
        if (g % 10 === 0) {
          const my = s.pits[s.turn].slice(), op = s.pits[1 - s.turn].slice();
          for (const e of out.events) {
            if (e.t === 'lift') { if (my[e.pit] !== e.n) badEvents++; my[e.pit] = 0; }
            else if (e.t === 'drop') { my[e.pit]++; if (my[e.pit] !== e.n) badEvents++; }
            else if (e.t === 'capture') { if (op[e.a] !== e.na || op[e.b] !== e.nb) badEvents++; op[e.a] = 0; op[e.b] = 0; }
          }
          if (my.join() !== out.state.pits[s.turn].join() || op.join() !== out.state.pits[1 - s.turn].join()) badEvents++;
        }
        s = out.state; list.push(m); moves++;
        if (out.drops > maxDrops) maxDrops = out.drops;
        caps += out.captures;
        if (E.totalSeeds(s) !== 64) bad64++;
      }
      if (s.winner !== null) { finished++; if (s.winner === 'draw') draws++; }
      if (s.ply > maxPly) maxPly = s.ply;
      console.log = () => {};
      const again = E.replay(start, list);
      console.log = log;
      if (E.hash(again) !== E.hash(s)) badReplay++;
    }
  }
  ok(games >= 2000, 'self-play: at least 2,000 games (' + games + ')');
  ok(bad64 === 0, 'self-play: 64 seeds after every move', bad64 + ' violations');
  ok(badMin === 0, 'self-play: no legal move starts from fewer than 2 seeds', badMin + ' violations');
  ok(badReplay === 0, 'self-play: replay from the move list gives the same hash', badReplay + ' mismatches');
  ok(badMirror === 0, 'self-play: both seats behave symmetrically', badMirror + ' mismatches');
  ok(badEvents === 0, 'self-play: event log reproduces the position', badEvents + ' mismatches');
  console.log('  ' + games + ' games, ' + moves + ' moves, ' + finished + ' finished (' + draws + ' annulled), longest ' + maxPly +
    ' plies, ' + caps + ' captures, ' + withDecisions + ' moves with decisions, longest move ' + maxDrops + ' drops, ' +
    endlessSeen + ' endless options withheld');
}

/* 13. Symmetry on hand-built positions, including captures and reverse choices. */
{
  const T = { reverseSowing: true };
  const s = pos({ 15: 2, 13: 1, 3: 4 }, { 10: 2, 5: 2, 0: 53 }, { rules: T });
  for (const m of E.legalMoves(s)) {
    const a = E.applyMove(s, m).state, b = E.applyMove(E.mirror(s), m).state;
    eq(E.hash(E.mirror(a)), E.hash(b), 'symmetry: move ' + m.start + ' [' + m.decisions.join(',') + ']');
  }
  // coordinates: a 180 degree turn maps (col,row) of seat 0 onto seat 1
  let coordOk = true;
  for (let i = 0; i < 16; i++) {
    if (E.colOf(1, i) !== 7 - E.colOf(0, i) || E.rowOf(1, i) !== 3 - E.rowOf(0, i)) coordOk = false;
    if (i >= 8) {
      // opposite pits share the absolute column
      if (E.colOf(1, 23 - i) !== E.colOf(0, i) || E.colOf(1, i - 8) !== E.colOf(0, i)) coordOk = false;
      if (!E.isInner(23 - i) || E.isInner(i - 8)) coordOk = false;
      if (E.colOf(0, 15 - i) !== E.colOf(0, i)) coordOk = false;
    }
    if (E.indexAt(0, i >= 8, E.colOf(0, i)) !== i || E.indexAt(1, i >= 8, E.colOf(1, i)) !== i) coordOk = false;
  }
  ok(coordOk, 'coordinates: loop indices, columns and opposite pits agree for both seats');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
