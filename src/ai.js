/* ==========================================================================
   IGISORO AI
   Alpha-beta over complete turns (decision sequences), iterative deepening
   with a time budget. Uses only the engine. Runs in a Web Worker (see the
   glue at the bottom) and on the main thread as a fallback.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root.IgisoroEngine || (typeof require === 'function' ? require('./engine.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IgisoroAI = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (E) {
  'use strict';

  var WIN = 100000;

  /* Named strengths. Tables pass their own parameter object instead. */
  var LEVELS = {
    beginner:     { depth: 1, time: 120,  blunder: 0.38, noise: 14 },
    intermediate: { depth: 2, time: 350,  blunder: 0.10, noise: 5 },
    strong:       { depth: 4, time: 900,  blunder: 0,    noise: 1 },
    master:       { depth: 12, time: 2400, blunder: 0,   noise: 0 },
    hint:         { depth: 4, time: 500,  blunder: 0,    noise: 0 },
    coach:        { depth: 2, time: 250,  blunder: 0,    noise: 0 }
  };

  var now = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };

  /* Static evaluation from the point of view of the side that owns `my`.
     Terms: seed difference, mobility, seeds exposed to capture, threats held. */
  function evaluate(my, op, myTurn) {
    var sm = 0, so = 0, mm = 0, mo = 0, em = 0, eo = 0, i;
    for (i = 0; i < 16; i++) {
      sm += my[i]; so += op[i];
      if (my[i] >= 2) mm++;
      if (op[i] >= 2) mo++;
    }
    for (i = 8; i < 16; i++) {
      // my column i is capturable when both my pits hold seeds and the facing inner pit is occupied
      if (my[i] > 0 && my[15 - i] > 0 && op[23 - i] > 0) em += my[i] + my[15 - i];
      if (op[i] > 0 && op[15 - i] > 0 && my[23 - i] > 0) eo += op[i] + op[15 - i];
    }
    // the side to move can act on its threats first
    return 10 * (sm - so) + 3 * (mm - mo) - (myTurn ? 1.2 : 2.2) * em + (myTurn ? 2.2 : 1.2) * eo;
  }

  function search(state, params, rand) {
    rand = rand || Math.random;
    var deadline = now() + (params.time || 300);
    var maxDepth = params.depth || 2;
    var nodes = 0, timeUp = false;

    function order(list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        c.key = c.captured * 100 + evaluate(c.my, c.op, false) * 0.1;
      }
      list.sort(function (a, b) { return b.key - a.key; });
      return list;
    }

    function negamax(s, depth, alpha, beta, ply) {
      nodes++;
      if ((nodes & 63) === 0 && now() > deadline) { timeUp = true; return 0; }
      var kids = E.enumerate(s);
      if (!kids.length) {
        var my = s.pits[s.turn], can = false;
        for (var i = 0; i < 16; i++) if (my[i] >= s.rules.minSeedsToSow) can = true;
        return can ? 0 : -WIN + ply;        // annulled game counts as level
      }
      if (depth <= 0) return evaluate(s.pits[s.turn], s.pits[1 - s.turn], true);
      order(kids);
      var best = -Infinity;
      for (var k = 0; k < kids.length; k++) {
        var v = -negamax(E.childState(s, kids[k]), depth - 1, -beta, -alpha, ply + 1);
        if (timeUp) return 0;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }

    var root = order(E.enumerate(state));
    if (!root.length) return null;
    var scored = root.map(function (c) { return { cand: c, score: evaluate(c.op, c.my, true) * -1 }; });
    var reached = 0;
    for (var d = 1; d <= maxDepth; d++) {
      var round = [], alpha = -Infinity;
      for (var k = 0; k < root.length; k++) {
        // full window at the root: every move gets a true score (needed for coaching and noise)
        var v = -negamax(E.childState(state, root[k]), d - 1, -Infinity, Infinity, 1);
        if (timeUp) break;
        round.push({ cand: root[k], score: v });
        if (v > alpha) alpha = v;
      }
      if (timeUp) break;
      scored = round; reached = d;
      // search the best line first on the next pass
      scored.sort(function (a, b) { return b.score - a.score; });
      root = scored.map(function (x) { return x.cand; });
      if (scored[0].score > WIN / 2 || scored[0].score < -WIN / 2) break;
      if (now() > deadline) break;
    }

    /* choose */
    var pick;
    if (params.blunder && rand() < params.blunder) {
      // a casual move: any legal move, leaning towards ones that miss a capture
      var quiet = scored.filter(function (x) { return x.cand.captured === 0; });
      var pool = quiet.length && rand() < 0.7 ? quiet : scored;
      pick = pool[Math.floor(rand() * pool.length)];
    } else {
      var bestV = -Infinity;
      for (var i = 0; i < scored.length; i++) {
        var n = scored[i].score + (params.noise ? (rand() - 0.5) * 2 * params.noise : 0);
        if (n > bestV) { bestV = n; pick = scored[i]; }
      }
    }
    return {
      move: { start: pick.cand.start, decisions: pick.cand.decisions },
      score: pick.score, depth: reached, nodes: nodes,
      scores: scored.map(function (x) { return { start: x.cand.start, decisions: x.cand.decisions, score: x.score, captured: x.cand.captured }; })
    };
  }

  function think(state, level, rand) {
    var params = typeof level === 'string' ? (LEVELS[level] || LEVELS.intermediate) : level;
    return search(state, params, rand);
  }

  return { LEVELS: LEVELS, evaluate: evaluate, search: search, think: think };
});
