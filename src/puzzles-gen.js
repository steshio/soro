/* ==========================================================================
   PUZZLE GENERATOR
   Deterministic: the same seed gives the same puzzle on every device, which
   is what makes the daily puzzle the same for everyone. Positions come from
   seeded random self-play and every puzzle is verified with the engine.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root.IgisoroEngine || (typeof require === 'function' ? require('./engine.js') : null),
                    root.IgisoroAI || (typeof require === 'function' ? require('./ai.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IgisoroPuzzles = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (E, AI) {
  'use strict';

  var REPLY = { depth: 1, time: 2000, blunder: 0, noise: 0 };   // the opponent's fixed, quick answer
  var NEED_TWO = 4;

  function prng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0; var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sum(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }

  /* the opponent's answer in a two-move puzzle: always the same for the same position */
  function replyTo(state) {
    var r = AI.search(state, REPLY, function () { return 0.5; });
    return r ? r.move : null;
  }

  function tryOne(s) {
    var c = E.enumerate(s), best = null, second = 0, ties = 0, k;
    for (k = 0; k < c.length; k++) {
      if (!best || c[k].captured > best.captured) { if (best) second = Math.max(second, best.captured); best = c[k]; ties = 1; }
      else if (c[k].captured === best.captured) ties++;
      else second = Math.max(second, c[k].captured);
    }
    if (!best || c.length < 4 || best.captured < 4 || ties !== 1 || second > best.captured - 2 || best.drops > 40) return null;
    return { kind: 'one', need: best.captured, solution: [{ start: best.start, decisions: best.decisions }] };
  }

  function tryTwo(s) {
    var c = E.enumerate(s), k, winners = [];
    if (c.length < 4) return null;
    for (k = 0; k < c.length; k++) if (c[k].captured > 0 || c[k].drops > 30) return null;
    for (k = 0; k < c.length; k++) {
      var a = E.childState(s, c[k]);
      var rep = replyTo(a); if (!rep) return null;                 // an instant win is not a puzzle
      var b = E.applyMove(a, rep).state;
      if (b.winner !== null) continue;
      var mine = E.enumerate(b), top = null;
      for (var j = 0; j < mine.length; j++) if (!top || mine[j].captured > top.captured) top = mine[j];
      if (top && top.captured >= NEED_TWO) winners.push({ first: c[k], second: top });
    }
    if (winners.length < 1 || winners.length > 2) return null;
    var w = winners[0];
    return { kind: 'two', need: NEED_TWO, solution: [{ start: w.first.start, decisions: w.first.decisions }, { start: w.second.start, decisions: w.second.decisions }] };
  }

  /** kind: 'one' (capture in one move) | 'two' (set up, opponent answers, capture) */
  function generate(seed, kind) {
    var rnd = prng(seed), rules = E.makeRules({ reverseSowing: false });
    for (var attempt = 0; attempt < 900; attempt++) {
      var s = E.newGame(rules, { first: rnd() < 0.5 ? 0 : 1 });
      var plies = 6 + Math.floor(rnd() * 20), k, dead = false;
      for (k = 0; k < plies; k++) {
        var c = E.enumerate(s);
        if (!c.length) { dead = true; break; }
        s = E.childState(s, c[Math.floor(rnd() * c.length)]);
      }
      if (dead || !E.enumerate(s).length) continue;
      if (s.turn === 1) s = E.mirror(s);               // the solver always sits at the bottom
      if (sum(s.pits[0]) < 14 || sum(s.pits[1]) < 14) continue;
      var p = kind === 'two' ? tryTwo(s) : tryOne(s);
      if (!p) continue;
      p.pits = [s.pits[0].slice(), s.pits[1].slice()];
      p.ply = Math.max(2, s.ply);
      p.seed = seed; p.attempts = attempt + 1;
      return p;
    }
    return null;
  }

  function daily(number) {
    var kind = number % 3 === 0 ? 'two' : 'one';
    return generate(number * 7919 + 17, kind) || generate(number * 7919 + 18, 'one');
  }

  /* emoji grid for the share card, seen from the solver's seat; captured pits are marked */
  function shareGrid(puzzle, capturedPits) {
    var rows = [], hit = {};
    (capturedPits || []).forEach(function (i) { hit[i] = 1; });
    for (var r = 0; r < 4; r++) {
      var line = '';
      for (var col = 0; col < 8; col++) {
        var p = r < 2 ? 1 : 0, i = E.indexAt(p, r === 1 || r === 2, col), n = puzzle.pits[p][i];
        line += p === 1 && hit[i] ? '🐄' : n > 0 ? '🟤' : '⚫';
      }
      rows.push(line);
    }
    return rows.join('\n');
  }

  return { generate: generate, daily: daily, replyTo: replyTo, shareGrid: shareGrid, NEED_TWO: NEED_TWO };
});
