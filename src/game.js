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
    U.$('#chooser').addEventListener('click', function (e) {
      var t = e.target.closest('[data-dir]'); if (t) IG.game.chooseDirection(t.dataset.dir);
    });
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

  /* a capture decision in optional mode: the hand hovers, the options sit beside it */
  B.ask = function (pending, seat, options) {
    return new Promise(function (resolve) {
      var TEXT = { take: ['Kurasa', 'capture the cows'], pass: ['Ndahise', 'I pass, and relay'] }, html = '';
      html += '<p class="prompt-q">Capture here?</p>';
      options.forEach(function (o) {
        html += '<button type="button" class="btn btn-small" data-choice="' + o + '"><b>' + TEXT[o][0] + '</b><span>' + TEXT[o][1] + '</span></button>';
      });
      placePrompt(seat, pending.pit, html, '');
      B.prompt.onclick = function (e) {
        var t = e.target.closest('[data-choice]'); if (!t) return;
        B.prompt.hidden = true; B.prompt.onclick = null; B.cancelAsk = null;
        resolve(t.dataset.choice);
      };
      B.cancelAsk = function () { B.prompt.hidden = true; B.prompt.onclick = null; B.cancelAsk = null; resolve(null); };
    });
  };
  function placePrompt(seat, pit, html, cls) {
    var q = V.projectPit(seat, pit);
    B.prompt.className = 'prompt' + (cls ? ' ' + cls : '');
    B.prompt.innerHTML = html;
    B.prompt.hidden = false;
    B.prompt.style.left = U.clamp(q.u * 100, 24, 76) + '%';
    B.prompt.style.top = (q.v * 100) + '%';
    B.prompt.classList.toggle('below', q.v < 0.5);
    var first = U.$('button', B.prompt);
    if (first && document.activeElement && document.activeElement.closest && document.activeElement.closest('#pits')) first.focus();
  }

  /* ---- Nteba and Ngarama: a one-time explainer, then a choice of two arrows ---- */
  var ICON_CCW = '<svg class="dir-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
  var ICON_CW = '<svg class="dir-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>';
  var KIND = {
    guteba: { pit: 'Nteba', article: 'a', side: 'left', move: 'guteba', Move: 'Guteba', mark: 'warn' },
    kugarama: { pit: 'Ngarama', article: 'an', side: 'right', move: 'kugarama', Move: 'Kugarama', mark: 'alt' }
  };
  B.kind = function (name) { return KIND[name]; };

  /* shown once per kind, the first time the move is really available to the player */
  B.explain = function (ch) {
    var K = KIND[ch.name], R = G.state.rules;
    var pits = (ch.name === 'guteba' ? R.ntebaPits : R.ngaramaPits).map(function (i) { return [ch.seat, i, K.mark]; });
    var title = ch.phase === 'relay' ? 'Your move has reached ' + K.article + ' ' + K.pit + ' pit' :
      ch.phase === 'capsow' ? 'Your cows start from ' + K.article + ' ' + K.pit + ' pit' : 'This is ' + K.article + ' ' + K.pit + ' pit';
    var html = '<p class="explain-kicker">Special pit</p><p class="explain-title">' + title + '</p>' +
      '<p>You have two ' + K.pit + ' pits: your outer ' + K.side + ' corner pit and your second inner pit from the ' + K.side + '. They are ringed on the board.</p>' +
      '<p>From here you may sow clockwise. That is called ' + K.move + '.</p>' +
      '<p>You may do it only when that lap captures. Right now it does.</p>' +
      '<button type="button" class="btn btn-small btn-primary" data-got="1">Got it</button>';
    var keep = B.marks;
    B.clearFx(); B.setMarks(pits);
    placePrompt(ch.seat, ch.pit, html, 'explain');
    return new Promise(function (resolve) {
      function close(v) { B.prompt.hidden = true; B.prompt.onclick = null; B.cancelExplain = null; B.marks = keep; B.refresh(); resolve(v); }
      B.prompt.onclick = function (e) { if (e.target.closest('[data-got]')) close(true); };
      B.cancelExplain = function () { close(false); };
    });
  };

  /* the paths of both laps, each ending in an arrowhead, with buttons under the board */
  function lapPath(seat, from, pits, cls, head) {
    var pts = [B.xy(seat, from)].concat(pits.map(function (i) { return B.xy(seat, i); })), d = '', k, out = '';
    for (k = 0; k < pts.length; k++) d += (k ? ' L' : 'M') + pts[k].x.toFixed(1) + ' ' + pts[k].y.toFixed(1);
    out += svg('path', { d: d, 'class': 'fx-path ' + cls });
    for (k = 1; k < pts.length - 1; k++) out += svg('circle', { cx: pts[k].x.toFixed(1), cy: pts[k].y.toFixed(1), r: 5, 'class': 'fx-dot ' + cls });
    if (pts.length > 1) {
      var a = pts[pts.length - 2], b = pts[pts.length - 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / L, uy = dy / L, tipx = b.x - ux * head, tipy = b.y - uy * head, w = 11, len = 20;
      var p1 = (tipx - ux * len + uy * w).toFixed(1) + ',' + (tipy - uy * len - ux * w).toFixed(1);
      var p2 = (tipx - ux * len - uy * w).toFixed(1) + ',' + (tipy - uy * len + ux * w).toFixed(1);
      out += '<polygon class="fx-head ' + cls + '" points="' + tipx.toFixed(1) + ',' + tipy.toFixed(1) + ' ' + p1 + ' ' + p2 + '"/>';
    }
    return out;
  }
  B.showChoice = function (ch, branches, full) {
    var r = IG.DIM.pitR / IG.DIM.viewW * VW, K = KIND[ch.name], out = '', s0 = B.xy(ch.seat, ch.pit);
    branches.forEach(function (b) {
      var cls = b.dir === 'cw' ? 'fx-' + ch.name : 'fx-normal';
      out += lapPath(ch.seat, ch.pit, full ? b.pits : b.pits.slice(0, 1), cls, full ? r * 0.42 : r * 0.1);
      if (full && b.capA !== undefined) [b.capA, b.capB].forEach(function (i) {
        var q = B.xy(1 - ch.seat, i);
        out += svg('circle', { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (r + 2).toFixed(1), 'class': 'fx-cap' });
      });
    });
    out += svg('circle', { cx: s0.x.toFixed(1), cy: s0.y.toFixed(1), r: (r + 3).toFixed(1), 'class': 'fx-start' });
    B.fx.innerHTML = out;
    var html = '';
    branches.forEach(function (b) {
      var cw = b.dir === 'cw', title = cw ? K.Move : 'Normal way', sub;
      if (!full) sub = cw ? 'clockwise' : 'anticlockwise';
      else if (b.after === 'capture') sub = (cw ? 'clockwise, ' : '') + 'captures ' + U.plural(b.caught, 'cow');
      else if (b.after === 'relay') sub = 'lands on seeds, keeps going';
      else if (b.after === 'choice') sub = 'reaches a capture you can take';
      else sub = 'ends in ' + (b.end >= 8 ? 'inner' : 'outer') + ' pit ' + E.pitNumber(b.end);
      html += '<button type="button" class="btn choice ' + (cw ? 'choice-' + ch.name : 'choice-normal') + '" data-dir="' + b.dir + '">' + (cw ? ICON_CW : ICON_CCW) +
        '<span><b>' + title + '</b><small>' + sub + '</small></span></button>';
    });
    var bar = U.$('#chooser');
    bar.innerHTML = html; bar.hidden = false;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#pits')) U.$('button', bar).focus();
  };
  B.hideChoice = function () { var bar = U.$('#chooser'); bar.hidden = true; bar.innerHTML = ''; B.clearFx(); };

  /* ========================================================================
     GAME CONTROLLER
     ======================================================================== */
  var G = IG.game = { cfg: null, state: null, moves: [], history: [], busy: false, over: true, gen: 0, selected: null, legal: [], log: [], nudge: null, analysis: null, queue: [], choosing: null };

  /* close any open question on the board: capture prompt, explainer, direction choice */
  function closeQuestions() {
    if (B.cancelAsk) B.cancelAsk();
    if (B.cancelExplain) B.cancelExplain();
    if (G.choosing) { var c = G.choosing; G.choosing = null; B.hideChoice(); if (c.resolve) c.resolve(null); }
  }
  G.closeQuestions = closeQuestions;
  /* is the board asking the player something right now? */
  G.asking = function () { return !!(G.choosing || B.cancelAsk || B.cancelExplain); };

  function seatName(seat) { return G.cfg.seats[seat].name || (seat === 0 ? 'Bottom' : 'Top'); }
  function say(text) { var el = U.$('#say'); if (el) el.textContent = text || ''; }
  G.say = say;

  /**
   * cfg: { mode, rules, seats:[{kind:'human'|'ai'|'remote'|'none', name, ai}], first, pits, ply, bottom,
   *        solo, coached, noPreview, noCounts, hooks:{onMove,onEnd,onTurn,filterStart}, labels, title, stake, table }
   */
  G.start = function (cfg) {
    G.gen++;
    closeQuestions();
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
    closeQuestions();
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
    if (info.choice) s += ' Partway through, you choose which way to sow.';
    return s + ' Tap again to sow.';
  }

  G.cancelSelect = function () {
    if (G.choosing && G.choosing.ch.phase !== 'start') return;          // a move in progress must be finished
    if (B.cancelExplain || G.choosing) closeQuestions();
    if (G.selected !== null) { G.selected = null; B.clearFx(); B.refresh(); say(''); }
  };

  /* both ways a direction decision can go: the pits of the lap it starts, and what its last seed does */
  function branches(state, start, prefix, from, options) {
    return options.map(function (o) {
      var r = E.playTurn(state, start, prefix.concat(o), true), evs = r.events || [], lap = [], k = from;
      while (k < evs.length && evs[k].t !== 'drop') k++;
      while (k < evs.length && evs[k].t === 'drop') lap.push(evs[k++].pit);
      var nx = evs[k] || null, b = { dir: o, pits: lap, end: lap.length ? lap[lap.length - 1] : null, caught: 0 };
      b.after = nx ? nx.t : r.status === 'pending' ? 'choice' : 'end';
      if (nx && nx.t === 'capture') { b.caught = nx.n; b.capA = nx.a; b.capB = nx.b; }
      return b;
    });
  }
  /* options at this decision that lead to a legal, finite move */
  function legalOptions(start, prefix, options) {
    return options.filter(function (o) {
      return G.legal.some(function (m) {
        if (m.start !== start || m.decisions.length <= prefix.length || m.decisions[prefix.length] !== o) return false;
        for (var k = 0; k < prefix.length; k++) if (m.decisions[k] !== prefix[k]) return false;
        return true;
      });
    });
  }
  /* a choice of direction when the move starts from this pit, or null */
  G.startChoice = function (i) {
    var st = G.state, r = E.playTurn(st, i, [], true);
    if (r.status !== 'pending' || r.pending.type !== 'direction' || r.pending.kind !== 'start') return null;
    var opts = legalOptions(i, [], r.pending.options);
    return opts.length > 1 ? { seat: st.turn, pit: i, name: r.pending.name, phase: 'start', start: i, prefix: [], done: 0, options: opts } : null;
  };
  /* explain the pit the first time, then ask; resolves 'ccw', 'cw', or null if it was closed */
  async function offerChoice(ch) {
    var gen = G.gen, K = B.kind(ch.name);
    var br = branches(G.state, ch.start, ch.prefix, ch.done, ch.options);
    if (G.cfg.mode !== 'lesson' && IG.progress && !IG.progress.hasSeen(ch.name)) {
      say('');
      var okd = await B.explain(ch);
      if (!okd || gen !== G.gen) return null;
      IG.progress.markSeen(ch.name);
    }
    return new Promise(function (resolve) {
      G.choosing = { ch: ch, br: br, resolve: resolve };
      B.showChoice(ch, br, !G.cfg.noPreview);
      say('Two ways to sow from this ' + K.pit + ' pit: the normal way, or ' + K.move + ' clockwise. Tap one of the buttons, or a pit on its arrow.');
    }).then(function (c) { if (G.choosing) { G.choosing = null; B.hideChoice(); } return c; });
  }
  /* a tap while the choice is open: a pit on exactly one of the two paths chooses that path */
  function tapWhileChoosing(p, i) {
    var C = G.choosing;
    if (p === C.ch.seat) {
      var hit = C.br.filter(function (b) { return (G.cfg.noPreview ? b.pits.slice(0, 1) : b.pits).indexOf(i) >= 0; });
      if (hit.length === 1) { C.resolve(hit[0].dir); return true; }
    }
    if (C.ch.phase !== 'start' || (p === C.ch.seat && i === C.ch.pit)) {
      say('Choose a direction to carry on: tap one of the two buttons under the board.');
      return true;
    }
    G.cancelSelect();                                                   // another pit: choose that one instead
    return false;
  }
  G.chooseDirection = function (dir) { if (G.choosing) G.choosing.resolve(dir); };

  G.tap = function (p, i) {
    var st = G.state, cfg = G.cfg;
    if (!st || G.over) return;
    if (B.cancelExplain) { say('Read the note, then tap Got it.'); return; }
    if (G.choosing && tapWhileChoosing(p, i)) return;
    if (G.busy) return;
    var seat = st.turn, S = cfg.seats[seat];
    if (S.kind !== 'human') { say('Wait for your turn.'); return; }
    if (p !== seat) { G.cancelSelect(); say(cfg.mode === 'local' ? 'That pit belongs to the other player.' : 'That pit belongs to your opponent.'); return; }
    var why = G.whyNot(i);
    if (why) { G.cancelSelect(); say(why); IG.audio.tick(); return; }
    if (G.selected === i) { G.humanMove(i); return; }
    G.selected = i; IG.audio.tick();
    var ch = G.startChoice(i);
    if (ch) {
      B.refresh();
      offerChoice(ch).then(function (dir) { if (dir && G.selected === i && G.state === st) G.humanMove(i, [dir]); });
      return;
    }
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
  G.humanMove = async function (start, preset) {
    var gen = G.gen, before = G.state, seat = before.turn, dec = (preset || []).slice(), done = 0, r;
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
          if (r.pending.type === 'capture') {
            B.setMarks([[1 - seat, 23 - r.pending.pit], [1 - seat, r.pending.pit - 8]], 'warn');
            choice = await B.ask(r.pending, seat, opts);
            B.marks = {};
          } else {
            choice = await offerChoice({ seat: seat, pit: r.pending.pit, name: r.pending.name, phase: r.pending.kind === 'capsow' ? 'capsow' : 'relay',
              start: start, prefix: dec, done: done, options: opts });
          }
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
    closeQuestions();
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
    closeQuestions();
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
      var rk = res.move.decisions[0] === 'cw' ? E.reverseKind(st.rules, res.move.start) : null;
      say('Try the glowing pit: ' + (res.move.start >= 8 ? 'inner' : 'outer') + ' pit ' + E.pitNumber(res.move.start) + (rk ? ', then choose ' + rk + '.' : '.'));
      setTimeout(function () { if (G.state === st) B.setGlow([]); }, 4000);
    });
  };

  G.skipAnim = function () { if (G.busy) V.skip(true); };
})();
