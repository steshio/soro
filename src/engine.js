/* ==========================================================================
   IGISORO RULES ENGINE
   Pure, deterministic logic. No rendering, no DOM, no timers.
   Runs in the page, in the AI Web Worker and in Node (tests).

   Coordinates
   - Two players: 0 = bottom, 1 = top (absolute seats).
   - Each player owns 16 pits addressed by a loop index 0..15 that runs
     anticlockwise from that player's own seat: 0..7 along the outer row left
     to right, 8..15 back along the inner row right to left.
   - Because both seats use the same loop, the geometry is identical for both:
       opposite inner pit of my inner pit i  -> opponent index 23 - i
       opposite outer pit of my inner pit i  -> opponent index i - 8
       my outer pit behind my inner pit i    -> my index 15 - i
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IgisoroEngine = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* Every rule that varies by region or by teaching stage lives here. */
  var RULES = {
    minSeedsToSow: 2,              // a pit needs this many seeds to be played
    seedsPerInnerPit: 4,           // default setup: inner rows filled, outer rows empty
    captureMode: 'forced',         // 'forced' | 'optional' (ndahise allowed)
    captureSowStart: 'afterOrigin',// 'afterOrigin' | 'origin': where the first captured seed goes
    reverseSowing: true,           // guteba and kugarama: clockwise laps from the four special pits
    ntebaPits: [0, 14],            // Nteba: outer leftmost, inner second from the left. Clockwise from here is guteba.
    ngaramaPits: [7, 9],           // Ngarama: outer rightmost, inner second from the right. Clockwise from here is kugarama.
    openingNoCaptureMoves: 2,      // kuvuna + kwivunura cannot capture
    relaySowing: true,             // false only in the first Learn level
    maxDropsPerMove: 3000,         // house rule: longer moves are treated as endless
    maxVariantsPerPit: 24          // cap on decision sequences enumerated per start pit
  };

  var PRESETS = {
    learn: { reverseSowing: false },
    traditional: { reverseSowing: true }
  };

  function makeRules(overrides) {
    var r = {}, k;
    for (k in RULES) r[k] = Array.isArray(RULES[k]) ? RULES[k].slice() : RULES[k];
    if (overrides) for (k in overrides) if (k in RULES && overrides[k] !== undefined) {
      r[k] = Array.isArray(overrides[k]) ? overrides[k].slice() : overrides[k];
    }
    return r;
  }

  /* ---- coordinates ------------------------------------------------------- */
  function isInner(i) { return i >= 8; }
  /** absolute column 0..7, left to right as seen by the bottom player */
  function colOf(p, i) { return p === 0 ? (i < 8 ? i : 15 - i) : (i < 8 ? 7 - i : i - 8); }
  /** absolute row 0..3, top to bottom on a bottom-seated screen */
  function rowOf(p, i) { return p === 0 ? (i < 8 ? 3 : 2) : (i < 8 ? 0 : 1); }
  function indexAt(p, inner, col) {
    if (p === 0) return inner ? 15 - col : col;
    return inner ? col + 8 : 7 - col;
  }
  /** pit number 1..8 counted from the owner's own left */
  function pitNumber(i) { return i < 8 ? i + 1 : 16 - i; }
  function mod16(n) { return ((n % 16) + 16) % 16; }
  /**
   * Sowing is anticlockwise. The only exception: a lap lifted from a Nteba pit
   * may be sown clockwise (guteba), and a lap lifted from an Ngarama pit may be
   * sown clockwise (kugarama), when that lap captures.
   * Returns 'guteba' | 'kugarama' | null for loop index i.
   */
  function reverseKind(rules, i) {
    if (rules.ntebaPits.indexOf(i) >= 0) return 'guteba';
    if (rules.ngaramaPits.indexOf(i) >= 0) return 'kugarama';
    return null;
  }

  /* ---- state ------------------------------------------------------------- */
  function newGame(rules, opts) {
    opts = opts || {};
    var R = rules || makeRules();
    var pits;
    if (opts.pits) {
      pits = [opts.pits[0].slice(), opts.pits[1].slice()];
    } else {
      pits = [[], []];
      for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) pits[p][i] = i >= 8 ? R.seedsPerInnerPit : 0;
    }
    return {
      pits: pits,
      turn: opts.first === 1 ? 1 : 0,
      ply: opts.ply || 0,
      captured: [0, 0],
      winner: null,          // null | 0 | 1 | 'draw'
      rules: R
    };
  }

  function cloneState(s) {
    return { pits: [s.pits[0].slice(), s.pits[1].slice()], turn: s.turn, ply: s.ply,
      captured: s.captured.slice(), winner: s.winner, rules: s.rules };
  }

  function totalSeeds(s) {
    var t = 0;
    for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) t += s.pits[p][i];
    return t;
  }

  /** 180 degree rotation of the board: seats swap, loop indices stay. */
  function mirror(s) {
    var m = cloneState(s);
    m.pits = [s.pits[1].slice(), s.pits[0].slice()];
    m.turn = 1 - s.turn;
    m.captured = [s.captured[1], s.captured[0]];
    if (s.winner === 0 || s.winner === 1) m.winner = 1 - s.winner;
    return m;
  }

  function hash(s) {
    return s.pits[0].join('.') + '|' + s.pits[1].join('.') + '|' + s.turn + '|' + s.ply;
  }

  /* ---- one turn ---------------------------------------------------------- */
  /**
   * Plays one turn from `start` following `decisions` (strings consumed in
   * order, only where a real choice exists):
   *   'ccw' | 'cw'    direction at a Nteba or Ngarama pit (normal | guteba or kugarama)
   *   'take' | 'pass' capture or ndahise, optional capture mode only
   *
   * Returns one of
   *   { status:'done', my, op, captured, drops, laps, events, used }
   *   { status:'pending', pending:{type, pit, options, kind}, my, op, events }
   *   { status:'endless', reason }  (house rule: not a legal move)
   *   { status:'illegal', reason }
   */
  function playTurn(state, start, decisions, wantLog) {
    var R = state.rules, p = state.turn, q = 1 - p;
    if (state.winner !== null) return { status: 'illegal', reason: 'game over' };
    if (!(start >= 0 && start < 16) || start !== Math.floor(start)) return { status: 'illegal', reason: 'no such pit' };
    var my = state.pits[p].slice(), op = state.pits[q].slice();
    if (my[start] < R.minSeedsToSow) return { status: 'illegal', reason: 'needs at least ' + R.minSeedsToSow + ' seeds' };
    decisions = decisions || [];

    var live = state.ply >= R.openingNoCaptureMoves;   // captures allowed?
    var rev = R.reverseSowing && live;
    var ev = wantLog ? [] : null;
    var di = 0, drops = 0, laps = 0, captured = 0, captures = 0;
    var seen = {};
    var origin = start;

    function isRev(i) { return reverseKind(R, i) !== null; }

    /* Would a lap of n seeds, first seed into `first`, direction d, end in a
       direct capture? Assumes any lifted pit is already zeroed in `my`. */
    function lapCaptures(first, n, d) {
      var end = mod16(first + d * (n - 1));
      var before = my[end] + Math.floor((n - 1) / 16);
      if (before === 0 || end < 8) return false;
      return op[23 - end] > 0 && op[end - 8] > 0;
    }

    function pending(type, pit, options, kind) {
      return { status: 'pending', pending: { type: type, pit: pit, options: options, kind: kind, index: di, name: type === 'direction' ? reverseKind(R, pit) : null },
        my: my, op: op, events: ev, captured: captured };
    }

    var cur = start;          // pit to lift from (start or relay)
    var liftKind = 'start';
    var n, dir, first, end, before, j, pit, choice;
    var capSow = null;        // {n, dir} when the next lap sows captured seeds

    for (;;) {
      if (capSow) {
        /* ---- lap that sows captured seeds from the origin pit ---- */
        n = capSow.n; dir = capSow.dir;
        if (dir === 1 && rev && isRev(origin)) {
          var cwFirst = R.captureSowStart === 'origin' ? origin : mod16(origin - 1);
          if (lapCaptures(cwFirst, n, -1)) {
            if (di >= decisions.length) return pending('direction', origin, ['ccw', 'cw'], 'capsow');
            choice = decisions[di++];
            if (choice !== 'ccw' && choice !== 'cw') return { status: 'illegal', reason: 'bad decision' };
            if (choice === 'cw') dir = -1;
          }
        }
        first = R.captureSowStart === 'origin' ? origin : mod16(origin + dir);
        if (ev) ev.push({ t: 'capsow', from: origin, n: n, dir: dir });
        capSow = null;
      } else {
        /* ---- lap that lifts a pit (start of the move, or a relay) ---- */
        var key = String.fromCharCode.apply(null, my) + cur;
        if (seen[key]) return { status: 'endless', reason: 'repeat' };
        seen[key] = 1;
        n = my[cur];
        my[cur] = 0;
        dir = 1;
        if (rev && isRev(cur) && lapCaptures(mod16(cur - 1), n, -1)) {
          if (di >= decisions.length) { my[cur] = n; return pending('direction', cur, ['ccw', 'cw'], liftKind); }
          choice = decisions[di++];
          if (choice !== 'ccw' && choice !== 'cw') return { status: 'illegal', reason: 'bad decision' };
          if (choice === 'cw') dir = -1;
        }
        first = mod16(cur + dir);
        if (ev) ev.push({ t: 'lift', pit: cur, n: n, dir: dir, kind: liftKind });
      }

      /* ---- sow ---- */
      laps++;
      drops += n;
      if (drops > R.maxDropsPerMove) return { status: 'endless', reason: 'cap' };
      pit = first; before = 0;
      for (j = 0; j < n; j++) {
        pit = mod16(first + dir * j);
        before = my[pit];
        my[pit] = before + 1;
        if (ev) ev.push({ t: 'drop', pit: pit, n: before + 1 });
      }
      end = pit;

      /* ---- where did the last seed fall? ---- */
      if (before === 0) { if (ev) ev.push({ t: 'end', pit: end }); break; }

      if (end >= 8 && op[23 - end] > 0 && op[end - 8] > 0) {
        if (!live) {
          if (ev) ev.push({ t: 'blocked', pit: end });      // opening: no capture, relay instead
        } else {
          var take = true;
          if (R.captureMode === 'optional' && dir === 1) {
            if (di >= decisions.length) return pending('capture', end, ['take', 'pass'], 'capture');
            choice = decisions[di++];
            if (choice !== 'take' && choice !== 'pass') return { status: 'illegal', reason: 'bad decision' };
            take = choice === 'take';
          }
          if (take) {
            var a = 23 - end, b = end - 8, na = op[a], nb = op[b];
            op[a] = 0; op[b] = 0;
            captured += na + nb; captures++;
            seen = {};                                       // opponent lost seeds: no earlier state can recur
            if (ev) ev.push({ t: 'capture', pit: end, a: a, b: b, na: na, nb: nb, n: na + nb });
            capSow = { n: na + nb, dir: dir };
            continue;
          }
          if (ev) ev.push({ t: 'pass', pit: end });
        }
      }

      if (!R.relaySowing) { if (ev) ev.push({ t: 'end', pit: end }); break; }
      if (ev) ev.push({ t: 'relay', pit: end });
      cur = end;
      liftKind = 'relay';
    }

    if (di < decisions.length) return { status: 'illegal', reason: 'too many decisions' };
    return { status: 'done', my: my, op: op, captured: captured, captures: captures,
      drops: drops, laps: laps, events: ev, used: di, end: end };
  }

  /* ---- enumeration ------------------------------------------------------- */
  /** Every complete legal decision sequence, with the resulting position. */
  function enumerate(state, onEndless) {
    var out = [];
    if (state.winner !== null) return out;
    var R = state.rules, my = state.pits[state.turn];
    for (var start = 0; start < 16; start++) {
      if (my[start] < R.minSeedsToSow) continue;
      var stack = [[]], found = 0;
      while (stack.length && found < R.maxVariantsPerPit) {
        var dec = stack.pop();
        var r = playTurn(state, start, dec, false);
        if (r.status === 'done') {
          found++;
          out.push({ start: start, decisions: dec, my: r.my, op: r.op, captured: r.captured,
            captures: r.captures, drops: r.drops, laps: r.laps, end: r.end });
        } else if (r.status === 'pending') {
          var o = r.pending.options;
          for (var k = o.length - 1; k >= 0; k--) stack.push(dec.concat(o[k]));
        } else if (r.status === 'endless' && onEndless) {
          onEndless(start, dec, r.reason);
        }
      }
    }
    return out;
  }

  function legalMoves(state) {
    return enumerate(state, function (start, dec, why) {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[igisoro] endless move not offered: pit ' + start + ' [' + dec.join(',') + '] (' + why + ')');
      }
    }).map(function (m) { return { start: m.start, decisions: m.decisions }; });
  }

  /** Position after a fully simulated candidate from enumerate(). */
  function childState(state, cand) {
    var p = state.turn, pits = [];
    pits[p] = cand.my; pits[1 - p] = cand.op;
    var cap = state.captured.slice(); cap[p] += cand.captured;
    return { pits: pits, turn: 1 - p, ply: state.ply + 1, captured: cap, winner: null, rules: state.rules };
  }

  /** Sets `winner` on a position whose side to move cannot play. */
  function settle(state) {
    if (state.winner !== null) return state;
    if (enumerate(state).length > 0) return state;
    var my = state.pits[state.turn], canLift = false;
    for (var i = 0; i < 16; i++) if (my[i] >= state.rules.minSeedsToSow) canLift = true;
    // Pits that can be lifted but only endlessly: tradition annuls the game.
    state.winner = canLift ? 'draw' : 1 - state.turn;
    return state;
  }

  /**
   * Applies a complete move. Returns { state, events, captured, captures, drops, laps }.
   * Throws on an illegal or incomplete move: callers validate remote input with this.
   */
  function applyMove(state, move) {
    if (!move || typeof move.start !== 'number' || !Array.isArray(move.decisions || [])) throw new Error('malformed move');
    var r = playTurn(state, move.start, move.decisions || [], true);
    if (r.status !== 'done') throw new Error('illegal move: ' + (r.reason || r.status));
    var next = settle(childState(state, r));
    return { state: next, events: r.events, captured: r.captured, captures: r.captures, drops: r.drops, laps: r.laps, end: r.end };
  }

  /** Replays a move list from a starting state; throws if any move is illegal. */
  function replay(state, moves) {
    var s = state;
    for (var i = 0; i < moves.length; i++) s = applyMove(s, moves[i]).state;
    return s;
  }

  function sameMove(a, b) {
    if (a.start !== b.start) return false;
    var x = a.decisions || [], y = b.decisions || [];
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  return {
    RULES: RULES, PRESETS: PRESETS, makeRules: makeRules,
    newGame: newGame, cloneState: cloneState, totalSeeds: totalSeeds, mirror: mirror, hash: hash,
    playTurn: playTurn, enumerate: enumerate, legalMoves: legalMoves, childState: childState,
    settle: settle, applyMove: applyMove, replay: replay, sameMove: sameMove,
    isInner: isInner, colOf: colOf, rowOf: rowOf, indexAt: indexAt, pitNumber: pitNumber, mod16: mod16, reverseKind: reverseKind
  };
});
