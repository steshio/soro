/* ==========================================================================
   INPUT AND GAME CONTROLLER
   IG.board: the DOM layer over the canvas (pit buttons, counts, previews,
   prompts). IG.game: turn flow for every mode, all through the engine.
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG, E = window.IgisoroEngine, V = IG.view, U = IG.util;
  var VW = 870, VH = 702;

  /* ========================================================================
     BOARD OVERLAY
     ======================================================================== */
  var B = IG.board = { btn: [[], []], cnt: [[], []], counts: [[], []], glow: {}, marks: {}, held: 0, heldSeat: 0 };

  B.build = function () {
    B.wrap = U.$('#board'); B.pits = U.$('#pits'); B.fx = U.$('#fx'); B.prompt = U.$('#prompt'); B.chip = U.$('#handchip');
    for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pit'; b.id = 'pit-' + p + '-' + i;
      b.dataset.p = p; b.dataset.i = i; b.tabIndex = -1;
      var c = document.createElement('span'); c.className = 'cnt'; c.textContent = '0';
      b.appendChild(c);
      B.pits.appendChild(b);
      B.btn[p][i] = b; B.cnt[p][i] = c; B.counts[p][i] = 0;
    }
    B.btn[0][0].tabIndex = 0;
    B.pits.addEventListener('click', function (e) {
      var t = e.target.closest('.pit'); if (!t) return;
      IG.audio.unlock();
      IG.game.tap(+t.dataset.p, +t.dataset.i);
    });
    B.pits.addEventListener('pointerover', function (e) {
      var t = e.target.closest('.pit'); if (t) IG.game.hoverPit(+t.dataset.p, +t.dataset.i);
    });
    B.pits.addEventListener('pointerleave', function () { IG.game.hoverPit(null, null); });
    B.pits.addEventListener('focusin', function (e) {
      var t = e.target.closest('.pit'); if (!t) return;
      U.$$('.pit', B.pits).forEach(function (x) { x.tabIndex = -1; }); t.tabIndex = 0;
    });
    B.pits.addEventListener('keydown', function (e) {
      var t = e.target.closest('.pit'); if (!t) return;
      var k = e.key, d = k === 'ArrowLeft' ? [0, -1] : k === 'ArrowRight' ? [0, 1] : k === 'ArrowUp' ? [-1, 0] : k === 'ArrowDown' ? [1, 0] : null;
      if (k === 'Escape') { IG.game.cancelSelect(); return; }
      if (!d) return;
      e.preventDefault();
      var p = +t.dataset.p, i = +t.dataset.i, fl = V.isFlipped();
      var r = E.rowOf(p, i), c = E.colOf(p, i);
      if (fl) { r = 3 - r; c = 7 - c; }
      r = U.clamp(r + d[0], 0, 3); c = U.clamp(c + d[1], 0, 7);
      if (fl) { r = 3 - r; c = 7 - c; }
      var np = r < 2 ? 1 : 0, ni = E.indexAt(np, r === 1 || r === 2, c);
      B.btn[np][ni].focus();
    });
    V.onFrame(B.followHand);
    B.layout();
  };

  B.xy = function (p, i) { var q = V.projectPit(p, i); return { x: q.u * VW, y: q.v * VH, u: q.u, v: q.v }; };

  B.layout = function () {
    var d = IG.DIM, w = 2 * (d.pitR + 0.045) / d.viewW * 100, h = 2 * (d.pitR + 0.045) / d.viewH * 100;
    for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) {
      var q = V.projectPit(p, i), s = B.btn[p][i].style;
      s.left = (q.u * 100) + '%'; s.top = (q.v * 100) + '%'; s.width = w + '%'; s.height = h + '%';
    }
  };

  B.setCount = function (p, i, n) {
    B.counts[p][i] = n;
    var c = B.cnt[p][i];
    c.textContent = n; c.classList.toggle('zero', n === 0);
  };
  B.sync = function (pits) { for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) B.setCount(p, i, pits[p][i]); };

  B.setHeld = function (seat, n) {
    B.held = n; B.heldSeat = seat;
    B.chip.hidden = !(n > 0) || V.isFlat();
    B.chip.textContent = n;
    B.followHand();
  };
  B.followHand = function () {
    if (B.chip.hidden) return;
    var q = V.handScreen(B.heldSeat); if (!q) return;
    B.chip.style.left = (q.u * 100) + '%'; B.chip.style.top = (q.v * 100) + '%';
  };

  /* classes and labels for the current position and turn */
  B.refresh = function () {
    var G = IG.game, st = G.state, cfg = G.cfg; if (!st || !cfg) return;
    var turn = st.turn, human = !G.over && cfg.seats[turn].kind === 'human' && !G.busy;
    for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) {
      var b = B.btn[p][i], n = st.pits[p][i], mine = p === turn;
      var why = human && mine ? G.whyNot(i) : null;
      var playable = human && mine && !why;
      b.classList.toggle('playable', playable);
      b.classList.toggle('dim', human && mine && !!why && n > 0);
      b.classList.toggle('sel', human && mine && G.selected === i);
      b.classList.toggle('glow', !!B.glow[p + '-' + i]);
      b.classList.toggle('mark', !!B.marks[p + '-' + i]);
      b.classList.toggle('mark-warn', B.marks[p + '-' + i] === 'warn');
      b.classList.toggle('mark-alt', B.marks[p + '-' + i] === 'alt');
      var owner = cfg.labels ? cfg.labels[p] : (p === 0 ? 'Bottom' : 'Top');
      var label = owner + ' ' + (i >= 8 ? 'inner' : 'outer') + ' pit ' + E.pitNumber(i) + ', ' + U.plural(n, 'seed');
      if (human && mine) label += playable ? ', can be sown' : ', ' + (why || 'cannot be sown').replace(/\.$/, '').toLowerCase();
      b.setAttribute('aria-label', label);
      if (why && n > 0) b.title = why; else b.removeAttribute('title');
    }
  };

  B.setGlow = function (list) {           // list of [p, i]
    B.glow = {}; (list || []).forEach(function (x) { B.glow[x[0] + '-' + x[1]] = 1; }); B.refresh();
  };
  B.setMarks = function (list, kind) {
    B.marks = {}; (list || []).forEach(function (x) { B.marks[x[0] + '-' + x[1]] = x[2] || kind || 'on'; }); B.refresh();   // x = [seat, pit, kind?]
  };

  B.clearFx = function () { B.fx.innerHTML = ''; };
  function svg(tag, attrs) {
    var s = '<' + tag;
    for (var k in attrs) s += ' ' + k + '="' + attrs[k] + '"';
    return s + '/>';
  }
  /* path of the first lap, where the whole move ends, and what it captures */
  B.preview = function (info) {
    var out = '', r = IG.DIM.pitR / IG.DIM.viewW * VW, seat = info.seat, pts = [B.xy(seat, info.start)], k;
    for (k = 0; k < info.firstLap.length; k++) pts.push(B.xy(seat, info.firstLap[k]));
    var d = '';
    for (k = 0; k < pts.length; k++) d += (k ? ' L' : 'M') + pts[k].x.toFixed(1) + ' ' + pts[k].y.toFixed(1);
    out += svg('path', { d: d, 'class': 'fx-path' });
    for (k = 1; k < pts.length; k++) out += svg('circle', { cx: pts[k].x.toFixed(1), cy: pts[k].y.toFixed(1), r: 5, 'class': 'fx-dot' });
    var s0 = pts[0];
    out += svg('circle', { cx: s0.x.toFixed(1), cy: s0.y.toFixed(1), r: (r + 3).toFixed(1), 'class': 'fx-start' });
    var e = B.xy(seat, info.end);
    out += svg('circle', { cx: e.x.toFixed(1), cy: e.y.toFixed(1), r: (r - 5).toFixed(1), 'class': 'fx-end' });
    out += svg('circle', { cx: e.x.toFixed(1), cy: e.y.toFixed(1), r: (r - 12).toFixed(1), 'class': 'fx-end' });
    info.captures.forEach(function (c) {
      [c.a, c.b].forEach(function (i) {
        var q = B.xy(1 - seat, i);
        out += svg('circle', { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (r + 2).toFixed(1), 'class': 'fx-cap' });
      });
    });
    B.fx.innerHTML = out;
  };
  B.flashCapture = function (seat, ev) {
    var out = '', r = IG.DIM.pitR / IG.DIM.viewW * VW;
    [[1 - seat, ev.a], [1 - seat, ev.b], [seat, ev.pit]].forEach(function (x, n) {
      var q = B.xy(x[0], x[1]);
      out += svg('circle', { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (r + 2).toFixed(1), 'class': n < 2 ? 'fx-cap fx-pulse' : 'fx-end fx-pulse' });
    });
    B.fx.innerHTML = out;
    setTimeout(function () { if (B.fx.innerHTML === out) B.fx.innerHTML = ''; }, 1500);
  };

  /* a choice in the middle of a move: the hand hovers, the options sit beside it */
  B.ask = function (pending, seat, options) {
    return new Promise(function (resolve) {
      var q = V.projectPit(seat, pending.pit), html = '';
      // clockwise from a Nteba pit is guteba, from an Ngarama pit kugarama; the normal direction has no special name
      var rev = pending.name === 'kugarama' ? 'Kugarama' : 'Guteba';
      var TEXT = {
        ccw: ['Normal way', 'anticlockwise'], cw: [rev, 'clockwise, to capture'],
        take: ['Kurasa', 'capture the cows'], pass: ['Ndahise', 'I pass, and relay']
      };
      html += '<p class="prompt-q">' + (pending.type === 'capture' ? 'Capture here?' : pending.kind === 'capsow' ? 'Sow the cows which way?' : 'Which way?') + '</p>';
      options.forEach(function (o) {
        html += '<button type="button" class="btn btn-small" data-choice="' + o + '"><b>' + TEXT[o][0] + '</b><span>' + TEXT[o][1] + '</span></button>';
      });
      B.prompt.innerHTML = html;
      B.prompt.hidden = false;
      var below = q.v < 0.5;
      B.prompt.style.left = U.clamp(q.u * 100, 22, 78) + '%';
      B.prompt.style.top = (q.v * 100) + '%';
      B.prompt.classList.toggle('below', below);
      var first = U.$('button', B.prompt); if (first && document.activeElement && document.activeElement.closest && document.activeElement.closest('#pits')) first.focus();
      B.prompt.onclick = function (e) {
        var t = e.target.closest('[data-choice]'); if (!t) return;
        B.prompt.hidden = true; B.prompt.onclick = null;
        resolve(t.dataset.choice);
      };
      B.cancelAsk = function () { B.prompt.hidden = true; B.prompt.onclick = null; B.cancelAsk = null; resolve(null); };
    });
  };

  /* ========================================================================
     GAME CONTROLLER
     ======================================================================== */
  var G = IG.game = { cfg: null, state: null, moves: [], history: [], busy: false, over: true, gen: 0, selected: null, legal: [], log: [], nudge: null, analysis: null, queue: [] };

  function seatName(seat) { return G.cfg.seats[seat].name || (seat === 0 ? 'Bottom' : 'Top'); }
  function say(text) { var el = U.$('#say'); if (el) el.textContent = text || ''; }
  G.say = say;

  /**
   * cfg: { mode, rules, seats:[{kind:'human'|'ai'|'remote'|'none', name, ai}], first, pits, ply, bottom,
   *        solo, coached, noPreview, noCounts, hooks:{onMove,onEnd,onTurn,filterStart}, labels, title, stake, table }
   */
  G.start = function (cfg) {
    G.gen++;
    if (B.cancelAsk) B.cancelAsk();
    cfg.hooks = cfg.hooks || {};
    cfg.bottom = cfg.bottom === 1 ? 1 : 0;
    G.cfg = cfg;
    G.state = E.newGame(cfg.rules, { pits: cfg.pits, first: cfg.first, ply: cfg.ply });
    G.initial = E.cloneState(G.state);
    G.moves = []; G.history = []; G.log = []; G.queue = [];
    G.over = false; G.busy = false; G.selected = null; G.nudge = null; G.analysis = null; G.result = null;
    V.skip(false);
    V.setFlip(cfg.bottom === 1);
    V.setPits(G.state.pits); V.rest(0); V.rest(1);
    B.layout(); B.clearFx(); B.glow = {}; B.marks = {}; B.setHeld(0, 0); B.sync(G.state.pits);
    U.$('#board').classList.toggle('no-counts', !!cfg.noCounts);
    say('');
    IG.bus.emit('game:start', cfg);
    next();
  };

  G.stop = function () {
    G.gen++;
    if (B.cancelAsk) B.cancelAsk();
    G.over = true; G.busy = false; G.selected = null; G.nudge = null;
    V.skip(true);
    setTimeout(function () { V.skip(false); V.rest(0); V.rest(1); }, 40);
    B.clearFx(); B.setHeld(0, 0);
  };

  G.whyNot = function (i) {
    var st = G.state, R = st.rules, n = st.pits[st.turn][i];
    if (n < R.minSeedsToSow) return n === 0 ? 'This pit is empty.' : 'Needs at least ' + R.minSeedsToSow + ' seeds.';
    if (G.cfg.hooks.filterStart) { var w = G.cfg.hooks.filterStart(st.turn, i); if (w) return w; }
    for (var k = 0; k < G.legal.length; k++) if (G.legal[k].start === i) return null;
    return 'This move would never end, so it is not offered.';
  };

  function computeLegal() { G.legal = E.legalMoves(G.state); }   // logs any endless move it withholds

  /* what a move from `start` does with the default choice at every decision */
  G.previewInfo = function (start) {
    var dec = [], r, guard = 0;
    for (;;) {
      r = E.playTurn(G.state, start, dec, true);
      if (r.status !== 'pending' || ++guard > 40) break;
      dec = dec.concat(r.pending.options[0]);
    }
    if (r.status !== 'done') return null;
    var first = [], caps = [], relays = 0, lapOpen = true;
    r.events.forEach(function (e, n) {
      if (e.t === 'drop' && lapOpen) first.push(e.pit);
      if (n > 0 && (e.t === 'relay' || e.t === 'capture' || e.t === 'end' || e.t === 'lift')) lapOpen = false;
      if (e.t === 'capture') caps.push({ a: e.a, b: e.b });
      if (e.t === 'relay') relays++;
    });
    return { seat: G.state.turn, start: start, firstLap: first, end: r.end, captures: caps, relays: relays, captured: r.captured, drops: r.drops, seeds: G.state.pits[G.state.turn][start], choice: dec.length > 0 };
  };
  function previewText(info) {
    var s = U.plural(info.seeds, 'seed') + '. ';
    if (info.relays) s += 'Relays ' + U.times(info.relays) + '. ';
    if (info.captured) s += 'Captures ' + U.plural(info.captured, 'cow') + '. ';
    s += 'Ends in ' + (info.end >= 8 ? 'inner' : 'outer') + ' pit ' + E.pitNumber(info.end) + '.';
    if (info.choice) s += ' You will be asked which way to sow.';
    return s + ' Tap again to sow.';
  }

  G.cancelSelect = function () { if (G.selected !== null) { G.selected = null; B.clearFx(); B.refresh(); say(''); } };

  G.tap = function (p, i) {
    var st = G.state, cfg = G.cfg;
    if (!st || G.over) return;
    if (G.busy) return;
    var seat = st.turn, S = cfg.seats[seat];
    if (S.kind !== 'human') { say('Wait for your turn.'); return; }
    if (p !== seat) { G.cancelSelect(); say(cfg.mode === 'local' ? 'That pit belongs to the other player.' : 'That pit belongs to your opponent.'); return; }
    var why = G.whyNot(i);
    if (why) { G.cancelSelect(); say(why); IG.audio.tick(); return; }
    if (G.selected === i) { G.humanMove(i); return; }
    G.selected = i; IG.audio.tick();
    if (cfg.noPreview) { B.clearFx(); say('Tap again to sow.'); }
    else {
      var info = G.previewInfo(i);
      if (info) { B.preview(info); say(previewText(info)); }
    }
    B.refresh();
  };

  var hoverTimer = null;
  G.hoverPit = function (p, i) {
    if (!G.cfg || !G.cfg.hooks.onHover) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      if (G.over || !G.state) return;
      var mine = p !== null && G.cfg.seats[p] && G.cfg.seats[p].kind === 'human' && G.state.turn === p && !G.busy;
      G.cfg.hooks.onHover(mine ? i : null);
    }, 60);
  };

  function animCtx(seat) {
    return {
      onPit: B.setCount,
      onHeld: B.setHeld,
      onEvent: function (ev) {
        if (ev.t === 'capture') { B.flashCapture(seat, ev); if (G.cfg.hooks.onCapture) G.cfg.hooks.onCapture(ev, seat); }
        if (G.cfg.hooks.onEvent) G.cfg.hooks.onEvent(ev, seat);
      }
    };
  }

  /* a human move: animate as far as each decision, ask, continue */
  G.humanMove = async function (start) {
    var gen = G.gen, before = G.state, seat = before.turn, dec = [], done = 0, r;
    G.busy = true; G.selected = null; B.clearFx(); B.refresh(); say('');
    if (G.cfg.hooks.onHover) G.cfg.hooks.onHover(null);
    var mine = G.legal.filter(function (m) { return m.start === start; });
    for (;;) {
      r = E.playTurn(before, start, dec, true);
      if (r.status === 'pending') {
        await V.playEvents(seat, r.events.slice(done), animCtx(seat));
        if (gen !== G.gen) return;
        done = r.events.length;
        // only offer choices that lead to a legal, finite move
        var opts = r.pending.options.filter(function (o) {
          return mine.some(function (m) {
            if (m.decisions.length <= dec.length || m.decisions[dec.length] !== o) return false;
            for (var k = 0; k < dec.length; k++) if (m.decisions[k] !== dec[k]) return false;
            return true;
          });
        });
        if (!opts.length) break;
        var choice = opts[0];
        if (opts.length > 1) {
          V.hover(seat, seat, r.pending.pit);
          if (r.pending.type === 'capture') B.setMarks([[1 - seat, 23 - r.pending.pit], [1 - seat, r.pending.pit - 8]], 'warn');
          choice = await B.ask(r.pending, seat, opts);
          B.marks = {};
          if (gen !== G.gen || choice === null) return;
        }
        dec = dec.concat(choice);
      } else if (r.status === 'done') {
        await V.playEvents(seat, r.events.slice(done), animCtx(seat));
        if (gen !== G.gen) return;
        break;
      } else break;
    }
    if (!r || r.status !== 'done') { V.setPits(before.pits); B.sync(before.pits); G.busy = false; B.refresh(); return; }
    commit({ start: start, decisions: dec }, seat);
  };

  /* a move that needs no input: computer, remote player, demo, scripted reply */
  G.perform = async function (move, forceSeat) {
    var gen = G.gen;
    if (forceSeat !== undefined) G.state.turn = forceSeat;
    var seat = G.state.turn, out;
    try { out = E.applyMove(G.state, move); } catch (e) { console.warn('[igisoro] refused move', e.message); return false; }
    G.busy = true; G.selected = null; B.clearFx(); B.refresh();
    await V.playEvents(seat, out.events, animCtx(seat));
    if (gen !== G.gen) return false;
    commit(move, seat, out);
    return true;
  };

  function describe(seat, out) {
    var first = out.events[0], relays = 0, cw = null;
    out.events.forEach(function (e) {
      if (e.t === 'relay') relays++;
      if (cw === null && (e.t === 'lift' || e.t === 'capsow') && e.dir === -1) cw = E.reverseKind(G.cfg.rules, e.t === 'lift' ? e.pit : e.from) || 'a clockwise lap';
    });
    var s = seatName(seat) + ' sowed ' + U.plural(first.n, 'seed') + ' from ' + (first.pit >= 8 ? 'inner' : 'outer') + ' pit ' + E.pitNumber(first.pit);
    if (cw) s += ', played ' + cw;
    if (relays) s += ', relayed ' + U.times(relays);
    if (out.captured) s += ', captured ' + U.plural(out.captured, 'cow');
    return s + '.';
  }

  function commit(move, seat, out) {
    var before = G.state, cfg = G.cfg;
    if (!out) out = E.applyMove(before, move);
    G.history.push(before); G.moves.push(move);
    var relays = out.events.filter(function (e) { return e.t === 'relay'; }).length;
    var info = { seat: seat, move: move, captured: out.captured, captures: out.captures, drops: out.drops, laps: out.laps, relays: relays,
      reverse: move.decisions.indexOf('cw') >= 0 && out.captured > 0, end: out.end, events: out.events, won: out.state.winner === seat, before: before };
    G.state = out.state;
    if (cfg.solo) {             // lessons and puzzles: the learner keeps the move
      info.after = E.cloneState(out.state);
      G.state.turn = cfg.soloSeat || 0; G.state.winner = null; G.state.ply = before.ply;
    }
    // the view was animated from the event log; make sure it agrees with the engine
    var vc = V.counts();
    if (vc[0].join() !== G.state.pits[0].join() || vc[1].join() !== G.state.pits[1].join()) V.setPits(G.state.pits);
    B.sync(G.state.pits); B.setHeld(seat, 0);
    V.skip(false);
    var text = describe(seat, out);
    G.log.push({ seat: seat, text: text, captured: out.captured });
    say(text);
    G.busy = false;
    var human = cfg.seats[seat].kind === 'human';
    if (human && IG.progress && cfg.mode !== 'local' && cfg.mode !== 'demo') IG.progress.event('move', { captured: out.captured, captures: out.captures, relays: relays, reverse: info.reverse, mode: cfg.mode });
    if (human && cfg.coached && !cfg.solo) coachCheck(info);
    if (cfg.hooks.onMove) cfg.hooks.onMove(info);
    if (G.cfg !== cfg) return;          // a hook started something else
    next();
  }

  function next() {
    var gen = G.gen, cfg = G.cfg, st = G.state;
    if (cfg.solo) { computeLegal(); B.refresh(); IG.bus.emit('game:update'); return; }
    if (st.winner !== null) return finish();
    computeLegal();
    B.refresh();
    IG.bus.emit('game:update');
    if (G.nudge) return;                 // wait for the player to answer the coach
    var seat = st.turn, S = cfg.seats[seat];
    if (S.kind === 'ai') {
      G.busy = true; B.refresh();
      var t0 = Date.now();
      IG.ai.request(st, S.ai).then(function (res) {
        if (gen !== G.gen || G.state !== st) return;
        if (!res) { G.busy = false; return; }
        setTimeout(function () { if (gen === G.gen && G.state === st) G.perform(res.move); }, Math.max(0, (cfg.mode === 'demo' ? 120 : 520) - (Date.now() - t0)));
      });
    } else if (S.kind === 'human') {
      if (cfg.coached) {
        G.analysis = null;
        IG.ai.request(st, 'coach').then(function (res) { if (gen === G.gen && G.state === st && res) G.analysis = { state: st, scores: res.scores }; });
      }
      if (cfg.hooks.onTurn) cfg.hooks.onTurn(seat);
    } else if (S.kind === 'remote') {
      G.flushQueue();
    }
  }
  G.next = next;

  /* remote moves can arrive while an animation runs: queue by sequence number */
  G.remoteMove = function (seq, move) {
    G.queue.push({ seq: seq, move: move });
    G.flushQueue();
  };
  G.flushQueue = function () {
    if (G.busy || G.over || !G.cfg || G.cfg.mode !== 'online') return;
    var st = G.state; if (G.cfg.seats[st.turn].kind !== 'remote') return;
    for (var k = 0; k < G.queue.length; k++) {
      var q = G.queue[k];
      if (q.seq === G.moves.length) {
        G.queue.splice(k, 1);
        G.perform(q.move).then(function (okm) { if (okm === false && G.cfg.hooks.onDesync) G.cfg.hooks.onDesync(); });
        return;
      }
    }
    G.queue = G.queue.filter(function (q) { return q.seq > G.moves.length; });
  };

  /* jump to a position rebuilt from a move list (refresh, late join, resync) */
  G.loadMoves = function (moves) {
    var s = E.cloneState(G.initial), hist = [], k;
    for (k = 0; k < moves.length; k++) { hist.push(s); s = E.applyMove(s, moves[k]).state; }   // throws on bad data
    G.gen++;
    var gen = G.gen;
    V.skip(true);
    G.state = s; G.history = hist; G.moves = moves.slice(); G.queue = []; G.selected = null; G.busy = true;
    setTimeout(function () {
      if (gen !== G.gen) return;
      V.skip(false); V.setPits(s.pits); V.rest(0); V.rest(1); B.sync(s.pits); B.setHeld(0, 0); B.clearFx();
      G.busy = false; G.over = false;
      next();
    }, 50);
  };

  function finish() {
    var st = G.state, cfg = G.cfg;
    G.over = true; G.busy = false; G.selected = null; G.nudge = null;
    B.clearFx(); B.refresh();
    G.result = { winner: st.winner, reason: G.resigned !== undefined && G.resigned !== null ? 'resign' : 'moves' };
    G.resigned = null;
    if (st.winner === 'draw') say('This game is annulled: the only moves left would never end.');
    else say(seatName(st.winner) + (seatName(st.winner) === 'You' ? ' win.' : ' wins.') + ' ' + seatName(1 - st.winner) + (seatName(1 - st.winner) === 'You' ? ' have' : ' has') + ' no pit left to sow.');
    if (cfg.hooks.onEnd) cfg.hooks.onEnd(G.result);
    IG.bus.emit('game:end', G.result);
  }

  G.resign = function (seat) {
    if (G.over || !G.cfg || G.cfg.solo) return;
    G.gen++;
    if (B.cancelAsk) B.cancelAsk();
    V.skip(true);
    var gen = G.gen;
    setTimeout(function () {
      if (gen !== G.gen) return;
      V.skip(false); V.setPits(G.state.pits); B.sync(G.state.pits); B.setHeld(0, 0); V.rest(0); V.rest(1);
      G.state.winner = 1 - seat; G.resigned = seat;
      G.over = true; G.busy = false; G.selected = null; G.nudge = null;
      B.clearFx(); B.refresh();
      G.result = { winner: 1 - seat, reason: 'resign' };
      say(seatName(seat) + (seatName(seat) === 'You' ? ' resigned.' : ' resigned.'));
      if (G.cfg.hooks.onEnd) G.cfg.hooks.onEnd(G.result);
      IG.bus.emit('game:end', G.result);
    }, 50);
  };

  /* ---- coaching (Beginner and Intermediate games) -------------------------- */
  function coachCheck(info) {
    var a = G.analysis; G.analysis = null;
    if (!a || a.state !== info.before || G.state.winner !== null) return;
    var best = -Infinity, played = null;
    a.scores.forEach(function (s) { if (s.score > best) best = s.score; if (E.sameMove(s, info.move)) played = s.score; });
    if (played === null || best - played < 45) return;
    // what can the opponent take now?
    var worst = null;
    E.enumerate(G.state).forEach(function (c) { if (c.captured > 0 && (!worst || c.captured > worst.captured)) worst = c; });
    var text;
    if (worst) {
      var r = E.playTurn(G.state, worst.start, worst.decisions, true), cap = null;
      if (r.status === 'done') r.events.forEach(function (e) { if (e.t === 'capture' && !cap) cap = e; });
      // cap.a is the opponent's index of our inner pit... from their side: their landing pit is cap.pit, ours are a (inner) and b (outer)
      var col = cap ? E.pitNumber(cap.a) : null;
      text = col ? 'Your inner pit ' + col + ' is now exposed to capture. Your opponent can take ' + U.plural(worst.captured, 'cow') + ' this turn.' : 'That move leaves ' + U.plural(worst.captured, 'cow') + ' open to capture.';
      if (cap) B.setMarks([[info.seat, cap.a], [info.seat, cap.b]], 'warn');
    } else {
      text = 'That move gave ground. There was a stronger one.';
    }
    G.nudge = { text: text };
  }
  G.dismissNudge = function () { if (!G.nudge) return; G.nudge = null; B.setMarks([]); next(); };

  G.canUndo = function () {
    if (!G.cfg || !G.cfg.coached || G.cfg.solo || G.over) return false;
    for (var k = G.history.length - 1; k >= 0; k--) if (G.cfg.seats[G.history[k].turn].kind === 'human') return true;
    return false;
  };
  G.undo = function () {
    if (!G.canUndo()) return;
    G.gen++;
    var gen = G.gen;
    if (B.cancelAsk) B.cancelAsk();
    while (G.history.length) {
      var st = G.history.pop(); G.moves.pop(); G.log.pop();
      if (G.cfg.seats[st.turn].kind === 'human') { G.state = st; break; }
    }
    G.nudge = null; G.selected = null; G.busy = true; B.marks = {};
    V.skip(true);
    setTimeout(function () {
      if (gen !== G.gen) return;
      V.skip(false); V.setPits(G.state.pits); V.rest(0); V.rest(1); B.sync(G.state.pits); B.setHeld(0, 0); B.clearFx();
      G.busy = false; say('Move taken back. Try another.');
      next();
    }, 50);
  };

  G.hint = function () {
    if (G.over || G.busy || !G.cfg || G.cfg.seats[G.state.turn].kind !== 'human') return;
    var st = G.state, gen = G.gen;
    say('Thinking of a good move…');
    IG.ai.request(st, 'hint').then(function (res) {
      if (gen !== G.gen || G.state !== st || !res) return;
      B.setGlow([[st.turn, res.move.start]]);
      say('Try the glowing pit: ' + (res.move.start >= 8 ? 'inner' : 'outer') + ' pit ' + E.pitNumber(res.move.start) + '.');
      setTimeout(function () { if (G.state === st) B.setGlow([]); }, 4000);
    });
  };

  G.skipAnim = function () { if (G.busy) V.skip(true); };
})();
