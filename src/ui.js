/* ==========================================================================
   UI SCREENS
   One persistent board stage; the panel beside it changes with the route.
   Routes are plain hash names: home, play, online, learn, puzzles, progress,
   about, and t-<code> for a shared table.
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG, E = window.IgisoroEngine, U = IG.util, G = IG.game, B = IG.board, V = IG.view, P = IG.progress, S = IG.settings, N = IG.net, L = IG.learn, Z = IG.puzzle;
  var esc = U.esc;

  var UI = IG.ui = { full: false, mode: 'menu', route: 'home', sel: { table: 't1', level: 'beginner' }, last: null, score: [0, 0], confirm: null, board: null };

  var HORN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 3.5C2.5 10 6 13 12 13s9.5-3 9.5-9.5c-1 4-4 6.3-6.9 6.5H9.4C6.5 9.800 3.500 7.500 2.500 3.500z"/><path d="M8.600 12.2h6.8l-1.700 7.300c-.7 1.500-2.700 1.500-3.400 0z"/></svg>';
  var ICON = {
    gear: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7zm8.300 5.200.1-1.700-.1-1.700 2-1.500-2-3.500-2.400 1a8 8 0 0 0-2.900-1.700L14.600 2h-5.200l-.4 2.600A8 8 0 0 0 6.100 6.300l-2.400-1-2 3.500 2 1.500-.1 1.700.1 1.700-2 1.500 2 3.500 2.400-1a8 8 0 0 0 2.900 1.700l.4 2.600h5.200l.4-2.600a8 8 0 0 0 2.900-1.700l2.400 1 2-3.500z" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linejoin="round"/></svg>',
    lock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V7.500a6 6 0 0 1 12 0V10h1.500v11h-15V10zm2.500 0h7V7.500a3.500 3.500 0 0 0-7 0z"/></svg>',
    check: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.500 9.500 18 20 6.500" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    expand: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shrink: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flame: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5.500 5 11a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500.2 2 1 3 2 3.500C10.500 9 11 5 12 2z"/></svg>'
  };

  /* Imigongo-inspired glyphs for badges: diamonds, chevrons, triangles */
  function badgeSvg(n) {
    var a = '', k;
    switch (n % 6) {
      case 0: for (k = 0; k < 3; k++) a += '<path class="g' + (k % 3) + '" d="M20 ' + (3 + k * 6) + 'L' + (37 - k * 6) + ' 20 20 ' + (37 - k * 6) + ' ' + (3 + k * 6) + ' 20z"/>'; break;
      case 1: for (k = 0; k < 4; k++) a += '<path class="g' + (k % 3) + '" d="M4 ' + (6 + k * 8) + 'l16 8 16-8v5l-16 8-16-8z"/>'; break;
      case 2: for (k = 0; k < 3; k++) a += '<path class="g' + (k % 3) + '" d="M2 ' + (12 + k * 10) + 'l6-8 6 8 6-8 6 8 6-8 6 8v4l-6-8-6 8-6-8-6 8-6-8-6 8z"/>'; break;
      case 3: for (k = 0; k < 4; k++) a += '<path class="g' + (k % 3) + '" d="M' + (2 + k * 9) + ' 34l4.500-9 4.500 9zM' + (2 + k * 9) + ' 22l4.500-9 4.500 9zM' + (2 + k * 9) + ' 10l4.500-7 4.500 7z"/>'; break;
      case 4: a += '<path class="g0" d="M4 4h32v32H4z"/><path class="g2" d="M9 9h22v22H9z"/><path class="g1" d="M14 14h12v12H14z"/><path class="g0" d="M18 18h4v4h-4z"/>'; break;
      case 5: a += '<path class="g0" d="M2 2l18 14L38 2v8L20 24 2 10z"/><path class="g1" d="M2 18l18 14 18-14v8L20 38 2 26z"/>'; break;
    }
    return '<svg class="badge-art" viewBox="0 0 40 40" aria-hidden="true">' + a + '</svg>';
  }

  /* ---- routing and modes ---------------------------------------------------- */
  var ROUTES = ['home', 'play', 'online', 'learn', 'puzzles', 'progress', 'about'];
  function routeFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (/^t-[a-z0-9]{4,8}$/.test(h)) return h;
    return ROUTES.indexOf(h) >= 0 ? h : 'home';
  }
  UI.go = function (name) {
    if (('#' + name) !== location.hash) { try { location.hash = name; } catch (e) { } }
    UI.route = name; UI.render();
    window.scrollTo(0, 0);
  };
  UI.setMode = function (mode) {
    UI.mode = mode; UI.confirm = null;
    document.body.dataset.mode = mode;
    UI.render();
  };

  /* leave whatever is running and return to the menus */
  UI.leave = function () {
    UI.confirm = null;
    UI.setFull(false);
    IG.audio.ambience(null);
    if (UI.mode === 'lesson') L.exit();
    else if (UI.mode === 'puzzle') Z.exit();
    else if (UI.mode === 'online') { if (N.phase === 'playing' && !G.over) N.resign(); N.leave(true); G.stop(); }
    else if (UI.mode === 'game') {
      var cfg = G.cfg;
      if (cfg && !G.over && cfg.stake) IG.toast('You left the table. The entry fee stays with the house.');
      G.stop();
    }
    UI.mode = 'menu'; document.body.dataset.mode = 'menu';
    UI.idleBoard();
  };
  /* does leaving cost something? then ask first, inside the page */
  function needsConfirm() {
    if (UI.mode === 'game' && G.cfg && !G.over && G.moves.length > 0) return G.cfg.stake ? 'Leave this table? Your entry fee of ' + G.cfg.stake.fee + ' cows is lost.' : 'Leave this game? It will not be saved.';
    if (UI.mode === 'online' && N.phase === 'playing' && !G.over) return 'Leave the table? That resigns this game.';
    return null;
  }
  UI.navigate = function (to) {
    var q = needsConfirm();
    if (q) { UI.confirm = { text: q, to: to }; UI.render(); return; }
    if (UI.mode !== 'menu') UI.leave();
    UI.go(to);
  };

  UI.idleBoard = function () {
    var s = E.newGame(E.makeRules());
    V.setFlip(false); V.setPits(s.pits); V.rest(0); V.rest(1);
    B.layout(); B.sync(s.pits); B.clearFx(); B.glow = {}; B.marks = {}; B.setHeld(0, 0);
    U.$('#board').classList.remove('no-counts');
    U.$('#veil').hidden = true;
    U.$$('.pit').forEach(function (b) { b.className = 'pit'; b.removeAttribute('title'); b.setAttribute('aria-label', 'Pit, 0 seeds'); });
    for (var p = 0; p < 2; p++) for (var i = 0; i < 16; i++) B.btn[p][i].setAttribute('aria-label', (p === 0 ? 'Bottom' : 'Top') + ' ' + (i >= 8 ? 'inner' : 'outer') + ' pit ' + E.pitNumber(i) + ', ' + U.plural(s.pits[p][i], 'seed'));
    P.applyLook();
    G.say('');
    renderStage();
  };

  /* ---- starting games --------------------------------------------------------- */
  var LEVEL_NAMES = { beginner: 'Beginner', intermediate: 'Intermediate', strong: 'Strong', master: 'Master' };
  UI.startGame = function (o) {
    var cfg, tone = IG.TONES[S.get('tone')], tone2 = IG.TONES[S.get('tone2')];
    UI.last = o;
    if (!o.rematch) UI.score = [0, 0];
    var first = o.first !== undefined ? o.first : (Math.random() < 0.5 ? 0 : 1);
    if (o.kind === 'local') {
      cfg = { mode: 'local', rules: S.rules(), first: first, bottom: 0, title: 'Pass and play', eyebrow: 'Two players, one device',
        seats: [{ kind: 'human', name: 'Bottom', tone: tone }, { kind: 'human', name: 'Top', tone: tone2 }], labels: ['Bottom', 'Top'] };
    } else if (o.kind === 'table') {
      var v = P.TABLES.filter(function (x) { return x.id === o.table; })[0];
      if (!o.restored && !P.enterTable(v)) { IG.toast('You need ' + v.fee + ' cows to sit at ' + esc(v.name) + '.'); return; }
      // every table is played the way masters play: guteba and kugarama on, no counts, no preview, no coach
      cfg = { mode: 'ai', rules: E.makeRules({ reverseSowing: true }), first: first, bottom: 0, stake: v, table: v.id,
        title: v.name, eyebrow: v.fee + ' cows each · ' + v.strength + ' computer',
        seats: [{ kind: 'human', name: 'You', tone: tone }, { kind: 'ai', name: 'Computer', ai: v.ai, tone: tone2 }], labels: ['Your', 'Computer’s'],
        coached: false, noPreview: true, noCounts: true };
    } else {
      cfg = { mode: 'ai', rules: o.rules || S.rules(), first: first, bottom: 0, level: o.level, title: 'Practice', eyebrow: LEVEL_NAMES[o.level] + ' computer · no stake',
        seats: [{ kind: 'human', name: 'You', tone: tone }, { kind: 'ai', name: 'Computer', ai: o.level, tone: tone2 }], labels: ['Your', 'Computer’s'],
        coached: o.level === 'beginner' || o.level === 'intermediate', lesson: !!o.lesson };
    }
    cfg.hooks = {
      onEnd: function (res) {
        var human = cfg.mode === 'ai', won = human && res.winner === 0, draw = res.winner === 'draw';
        if (res.winner === 0 || res.winner === 1) UI.score[res.winner]++;
        if (cfg.stake) P.settleTable(cfg.stake, draw ? 'draw' : won ? 'win' : 'loss');
        P.event('gameEnd', { mode: cfg.mode, won: won, table: cfg.table });
        if (won || cfg.mode === 'local') IG.audio.win();
        IG.audio.ambience(null);
        if (o.onEnd) o.onEnd(res);
      }
    };
    V.setTone(0, cfg.seats[0].tone); V.setTone(1, cfg.seats[1].tone);
    P.applyLook(cfg.stake ? cfg.stake.tint : null);
    U.$('#stage').dataset.venue = cfg.stake ? cfg.stake.hue : '';
    if (cfg.stake && S.get('sound')) IG.audio.ambience(cfg.stake.air);
    if (!o.lesson) UI.mode = 'game';
    document.body.dataset.mode = UI.mode; UI.confirm = null;
    G.start(cfg);
    if (o.restored && o.moves && o.moves.length) { try { G.loadMoves(o.moves); } catch (e) { } }
  };
  UI.rematch = function () {
    var o = UI.last; if (!o) return;
    var w = G.result ? G.result.winner : null;
    // gutanga inganji: the winner of the last game starts the next
    UI.startGame(Object.assign({}, o, { rematch: true, restored: false, moves: null, first: w === 0 || w === 1 ? w : undefined }));
  };

  /* ========================================================================
     STAGE: player plates and controls
     ======================================================================== */
  function plate(seat) {
    var cfg = G.cfg, st = G.state; if (!cfg || !st) return '';
    var s = cfg.seats[seat], total = 0;
    for (var i = 0; i < 16; i++) total += st.pits[seat][i];
    var turn = !G.over && st.turn === seat && !cfg.solo;
    var ava = cfg.mode === 'online' && s.uid && N.avatars[s.uid] ? '<img class="ava" alt="" src="' + esc(N.avatars[s.uid]) + '">' :
      cfg.mode === 'online' && seat === N.seat && N.avatars[IG.caps.uid] ? '<img class="ava" alt="" src="' + esc(N.avatars[IG.caps.uid]) + '">' :
      '<i class="dot" style="background:' + esc(s.tone || IG.TONES[seat === 0 ? S.get('tone') : S.get('tone2')]) + '"></i>';
    var win = G.over && st.winner === seat;
    return '<span class="who">' + ava + '<b>' + esc(s.name || (seat === 0 ? 'Bottom' : 'Top')) + '</b></span>' +
      (turn ? '<span class="turn">' + (s.kind === 'ai' ? 'thinking' : s.kind === 'remote' ? 'their move' : cfg.mode === 'local' ? 'to move' : 'your move') + '</span>' : '') +
      (win ? '<span class="turn won">winner</span>' : '') +
      '<span class="stat"><b>' + total + '</b> seeds</span>' +
      '<span class="stat">' + HORN + '<b>' + st.captured[seat] + '</b> captured</span>';
  }
  function renderStage() {
    var cfg = G.cfg, active = UI.mode !== 'menu' && cfg && G.state;
    var top = U.$('#plate-top'), bot = U.$('#plate-bottom'), ctl = U.$('#controls');
    var showPlates = active && (cfg.mode === 'ai' || cfg.mode === 'local' || cfg.mode === 'online' || cfg.mode === 'demo');
    top.hidden = bot.hidden = !showPlates;
    if (showPlates) { bot.innerHTML = plate(cfg.bottom); top.innerHTML = plate(1 - cfg.bottom); }
    ctl.hidden = !active;
    if (!active) { U.$('#stage-note').hidden = true; return; }
    var sp = S.get('speed'), h = '';
    h += '<div class="seg" role="group" aria-label="Animation speed">';
    [1, 2, 4].forEach(function (v) { h += '<button type="button" data-act="speed" data-v="' + v + '" aria-pressed="' + (sp === v) + '">' + v + '×</button>'; });
    h += '</div>';
    h += '<button type="button" class="btn btn-small" data-act="skip"' + (G.busy ? '' : ' disabled') + '>Skip</button>';
    var humanTurn = !G.over && !G.busy && cfg.seats[G.state.turn].kind === 'human';
    if ((cfg.mode === 'ai' || cfg.mode === 'local') && !cfg.noPreview) h += '<button type="button" class="btn btn-small" data-act="hint"' + (humanTurn ? '' : ' disabled') + '>Hint</button>';
    if (cfg.coached && !cfg.solo) h += '<button type="button" class="btn btn-small" data-act="undo"' + (G.canUndo() && !G.over ? '' : ' disabled') + '>Undo</button>';
    if ((cfg.mode === 'ai' || cfg.mode === 'local' || cfg.mode === 'online') && !G.over) h += '<button type="button" class="btn btn-small btn-quiet" data-act="resign">Resign</button>';
    if (canFull()) h += '<button type="button" class="btn btn-small" data-act="full" aria-pressed="' + UI.full + '">' + (UI.full ? ICON.shrink + 'Exit full screen' : ICON.expand + 'Full screen') + '</button>';
    ctl.innerHTML = h;
    renderStageNote();
  }

  /* ---- full screen: the board, plates and controls fill the screen -------------- */
  function canFull() { return (UI.mode === 'game' || UI.mode === 'online') && G.cfg && !G.cfg.lesson; }
  /* While full, the panel is out of sight, so anything that needs an answer shows inside the stage. */
  function renderStageNote() {
    var box = U.$('#stage-note'), h = '';
    if (UI.full && G.cfg) {
      h = confirmBox() + nudgeBlock();
      if (G.over && G.result) {
        var w = G.result.winner, me = UI.mode === 'online' ? N.seat : 0, two = G.cfg.mode === 'local';
        var title = w === 'draw' ? 'Game annulled.' : two ? (w === 0 ? 'Bottom wins.' : 'Top wins.') : (w === me ? 'You won.' : 'You lost.');
        h += '<div class="notice"><p><b>' + title + '</b></p><div class="row">' +
          (UI.mode === 'online' ? '<button class="btn btn-small btn-primary" data-act="net-rematch"' + (N.wantsRematch(true) ? ' disabled' : '') + '>' + (N.wantsRematch(true) ? 'Waiting…' : N.wantsRematch(false) ? 'Accept rematch' : 'Rematch') + '</button>'
            : '<button class="btn btn-small btn-primary" data-act="rematch">' + (G.cfg.stake ? 'Play again · ' + G.cfg.stake.fee + ' cows' : 'Rematch') + '</button>') +
          '<button class="btn btn-small" data-act="full">Exit full screen</button></div></div>';
      }
    }
    box.innerHTML = h; box.hidden = !h;
  }
  function markFull(on) {
    var stage = U.$('#stage'), toasts = U.$('#toasts');
    UI.full = !!on;
    stage.classList.toggle('full', UI.full);
    document.body.classList.toggle('stage-full', UI.full);
    // toasts must sit inside the element that is full screen, or they are not drawn
    if (UI.full) stage.appendChild(toasts); else document.body.appendChild(toasts);
    renderStage();
  }
  UI.setFull = function (on) {
    var stage = U.$('#stage'), doc = document;
    var realEl = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (on) {
      if (UI.full) return;
      var req = stage.requestFullscreen || stage.webkitRequestFullscreen;
      markFull(true);                       // the page-level fallback applies at once; real full screen is added where the browser allows it
      if (req) { try { var pr = req.call(stage); if (pr && pr.catch) pr.catch(function () { }); } catch (e) { } }
    } else {
      if (!UI.full && !realEl) return;
      if (realEl) { try { (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); } catch (e) { } }
      markFull(false);
    }
  };
  UI.toggleFull = function () { UI.setFull(!UI.full); };

  /* ========================================================================
     PANELS
     ======================================================================== */
  function head(eyebrow, title, lead) {
    return (eyebrow ? '<p class="eyebrow">' + eyebrow + '</p>' : '') + '<h2>' + title + '</h2>' + (lead ? '<p class="lead">' + lead + '</p>' : '');
  }
  function confirmBox() {
    if (!UI.confirm) return '';
    return '<div class="notice notice-warn" role="alertdialog" aria-label="Confirm"><p>' + esc(UI.confirm.text) + '</p><div class="row"><button class="btn btn-small btn-primary" data-act="confirm-yes">Leave</button><button class="btn btn-small" data-act="confirm-no">Stay</button></div></div>';
  }

  function todayBlock() {
    var d = P.data, h = '<section class="block"><h3>Today</h3>';
    h += '<div class="track" aria-label="Seven-day reward track">';
    var idx = d.login.idx % 7, can = P.canClaimLogin();
    P.LOGIN_TRACK.forEach(function (n, k) {
      var got = k < idx || (!can && k === idx - 1 + (idx === 0 ? 7 : 0));
      if (idx === 0 && !can) got = true;
      h += '<span class="day' + (got ? ' got' : '') + (can && k === idx ? ' now' : '') + '"><small>Day ' + (k + 1) + '</small><b>' + n + '</b>' + HORN + '</span>';
    });
    h += '</div>';
    h += can ? '<button class="btn btn-small btn-primary" data-act="claim">Collect day ' + (idx + 1) + ': ' + P.LOGIN_TRACK[idx] + ' cows</button>' : '<p class="muted">Today’s cows are collected. The next day opens tomorrow.</p>';
    h += '<ul class="missions">';
    d.missions.items.forEach(function (m) {
      var def = P.MISSIONS[m.id];
      h += '<li class="' + (m.done ? 'done' : '') + '"><span class="tick">' + (m.done ? ICON.check : '') + '</span><span class="grow">' + esc(def.text) + (def.goal > 1 ? ' <small>' + m.n + ' / ' + def.goal + '</small>' : '') + '</span><span class="reward">+' + def.cows + HORN + '</span></li>';
    });
    h += '</ul></section>';
    return h;
  }

  function panelHome() {
    var next = L.nextUp(), doneN = Object.keys(P.data.lessons).length, num = U.dailyNumber(), solved = P.data.daily[num];
    var h = '<div class="hero">';
    h += '<p class="eyebrow">Rwanda · four rows · sixty-four seeds</p>';
    h += '<h1>Igisoro</h1>';
    h += '<p class="lead">The Rwandan game of seeds and cows. Sow around your two rows, land in the right pit, and take what faces it.</p>';
    h += '<button class="btn btn-primary btn-big" data-act="learn-continue"><span>' + (doneN === 0 ? 'Learn to play' : next ? 'Continue learning' : 'Review the lessons') + '</span><small>' + (doneN === 0 ? 'About ten minutes, on the board' : next ? 'Next: ' + esc(next.title) : 'All seven levels done') + '</small></button>';
    h += '</div>';
    h += '<div class="tiles">';
    h += '<button class="tile" data-act="nav" data-to="play"><b>Play the computer</b><span>Six tables, played for cows</span></button>';
    h += '<button class="tile" data-act="nav" data-to="online"><b>Play a friend online</b><span>Open a table and share its code</span></button>';
    h += '<button class="tile" data-act="local"><b>Pass and play</b><span>Two players on this device</span></button>';
    h += '<button class="tile" data-act="daily"><b>Daily puzzle #' + num + '</b><span>' + (solved ? 'Solved in ' + U.plural(solved, 'try', 'tries') : 'The same puzzle for everyone today') + '</span></button>';
    h += '</div>';
    h += todayBlock();
    return h;
  }

  function panelPlay() {
    var d = P.data, next = P.nextTable();
    var h = head('Play', 'Choose a table', 'At the tables you play for cows: both sides put in the entry fee and the winner takes both.');
    h += '<section class="block"><h3>Tables</h3>';
    h += '<p class="muted">Table games are played the way masters play: guteba and kugarama on, no seed counts, no move preview, no coach. New to the game? Learn it or practise first.</p>';
    var pick = P.TABLES.filter(function (v) { return v.id === UI.sel.table && P.tableOpen(v); })[0];
    if (!pick) P.TABLES.forEach(function (v) { if (P.tableOpen(v)) pick = v; });
    h += '<ol class="ladder">';
    P.TABLES.forEach(function (v, n) {
      var open = P.tableOpen(v), sel = open && pick === v, wins = d.tables[v.id] || 0;
      h += '<li class="venue' + (open ? '' : ' locked') + (sel ? ' sel' : '') + '">';
      h += '<button class="venue-head" data-act="venue" data-v="' + v.id + '"' + (open ? '' : ' disabled') + ' aria-expanded="' + sel + '">';
      h += '<span class="venue-n">' + (n + 1) + '</span>';
      h += '<span class="venue-name"><b>' + esc(v.name) + '</b><small>Opponent: ' + esc(v.strength) + '.' + (wins ? ' ' + U.plural(wins, 'win') + '.' : '') + '</small></span>';
      h += '<span class="venue-fee">' + (open ? v.fee + HORN : ICON.lock + 'Opens at ' + v.need + ' won') + '</span></button>';
      if (!open && v === next) h += '<div class="venue-body"><div class="xp" role="img" aria-label="' + d.won + ' of ' + v.need + ' cows won"><i style="width:' + Math.round(100 * d.won / v.need) + '%"></i></div><p class="muted">' + d.won + ' of ' + v.need + ' cows won at the tables.</p></div>';
      if (sel) {
        var can = d.cows >= v.fee;
        h += '<div class="venue-body"><button class="btn btn-primary" data-act="enter"' + (can ? '' : ' disabled') + '>Take a seat · ' + v.fee + ' cows</button>';
        if (!can) h += '<p class="muted">You have ' + d.cows + ' cows. Earn more from lessons, puzzles and missions, or come back tomorrow for the daily top-up.</p>';
        h += '</div>';
      }
      h += '</li>';
    });
    h += '</ol></section>';
    h += '<section class="block"><h3>Practice</h3><div class="seg seg-wide" role="group" aria-label="Computer level">';
    Object.keys(LEVEL_NAMES).forEach(function (k) { h += '<button type="button" data-act="level" data-v="' + k + '" aria-pressed="' + (UI.sel.level === k) + '">' + LEVEL_NAMES[k] + '</button>'; });
    h += '</div><p class="muted">Free, with seed counts and move previews, by your rules from Settings. ' + (UI.sel.level === 'beginner' || UI.sel.level === 'intermediate' ? 'Coached: you get a warning when a move leaves cows exposed, and you can undo.' : 'No coaching and no undo at this level.') + '</p>';
    h += '<button class="btn" data-act="practice">Start a practice game</button></section>';
    h += '<section class="block"><h3>With people</h3><div class="row"><button class="btn" data-act="local">Pass and play</button><button class="btn" data-act="nav" data-to="online">Play a friend online</button></div></section>';
    return h;
  }

  function panelOnline() {
    var h = head('Online', 'Play a friend', 'One of you opens a table and sends the code. The other enters it. Moves travel live.');
    if (N.error) h += '<div class="notice notice-warn"><p>' + esc(N.error) + '</p></div>';
    if (N.phase === 'checking') h += '<p class="muted">Checking whether online play is available here…</p>';
    else if (N.phase === 'unavailable') h += '<div class="notice"><p>' + esc(N.why) + '</p><p class="muted">Playing the computer and pass and play work without it.</p></div><div class="row"><button class="btn" data-act="nav" data-to="play">Play the computer</button><button class="btn" data-act="local">Pass and play</button></div>';
    else if (N.phase === 'idle') {
      h += '<section class="block"><h3>Open a table</h3><p class="muted">Uses your rules from Settings. Rated: both players start at 1200.</p><button class="btn btn-primary" data-act="net-create"' + (N.busy ? ' disabled' : '') + '>Open a table</button></section>';
      h += '<section class="block"><h3>Join a table</h3><form class="row" id="join-form" novalidate><label class="sr" for="join-code">Table code</label><input id="join-code" class="input code" inputmode="latin" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" placeholder="CODE" value="' + esc(UI.joinCode || '') + '"><button class="btn" type="submit"' + (N.busy ? ' disabled' : '') + '>Join</button></form></section>';
    }
    return h;
  }

  function panelTable() {
    var d = N.doc, h = '';
    if (N.phase === 'waiting' || !d || d.status === 'waiting') {
      h += head('Table open', 'Waiting for your friend', 'Send them this code. They open Igisoro, choose Play a friend online, and enter it.');
      h += '<p class="bigcode" aria-label="Table code">' + esc(N.code.toUpperCase()) + '</p>';
      h += '<div class="row"><button class="btn btn-primary" data-act="net-invite">Challenge a friend</button><button class="btn" data-act="net-leave">Close the table</button></div>';
      h += '<p class="muted">The invitation is copied or shared with the code in it. Your friend needs contributor access to this game.</p>';
      return h;
    }
    var opp = N.oppId(), nm = N.names[opp] || 'Your friend';
    h += confirmBox();
    h += head('Table ' + esc(N.code.toUpperCase()), 'You and ' + esc(nm), '');
    if (N.error) h += '<div class="notice notice-warn"><p>' + esc(N.error) + '</p></div>';
    if (N.oppLeft && !G.over) h += '<div class="notice"><p>' + esc(nm) + ' has left the table. It stays open: they can come back with the same code.</p></div>';
    h += '<p class="score"><span>Points (igitego)</span><b>' + d.score[N.seat] + '</b><i>:</i><b>' + d.score[1 - N.seat] + '</b></p>';
    if (G.over && G.result) {
      var won = G.result.winner === N.seat, draw = G.result.winner === 'draw';
      h += '<div class="result"><h3>' + (draw ? 'Game annulled' : won ? 'You won' : 'You lost') + '</h3><p>' + (G.result.reason === 'resign' ? (won ? esc(nm) + ' resigned.' : 'You resigned.') : draw ? 'The only moves left would never end.' : (won ? esc(nm) + ' has' : 'You have') + ' no pit left to sow.') + '</p>';
      if (typeof N.delta === 'number') h += '<p class="muted">Rating ' + (N.delta >= 0 ? '+' : '') + N.delta + ' → ' + P.data.rating + '</p>';
      var mine = N.wantsRematch(true), theirs = N.wantsRematch(false);
      h += '<div class="row"><button class="btn btn-primary" data-act="net-rematch"' + (mine ? ' disabled' : '') + '>' + (mine ? 'Waiting for ' + esc(nm) + '…' : theirs ? 'Accept rematch' : 'Rematch') + '</button><button class="btn" data-act="net-leave">Leave the table</button></div>';
      if (theirs && !mine) h += '<p class="muted">' + esc(nm) + ' wants a rematch. The winner starts.</p>';
      h += '</div>';
    }
    h += logBlock();
    return h;
  }

  function panelLearn() {
    var done = P.data.lessons, next = L.nextUp(), h = head('Learn', 'From first seed to full game', 'Seven short levels on the real board. Each teaches one idea, then lets you try it.');
    h += '<ol class="lessons">';
    L.list().forEach(function (les, n) {
      var isDone = !!done[les.id], isNext = next && next.id === les.id;
      h += '<li><button class="lesson-row' + (isDone ? ' done' : '') + (isNext ? ' next' : '') + '" data-act="lesson" data-id="' + les.id + '">';
      h += '<span class="lesson-n">' + (isDone ? ICON.check : n) + '</span>';
      h += '<span class="grow"><b>' + esc(les.title) + '</b><small>' + esc(les.blurb) + '</small></span>';
      h += '<span class="lesson-meta">' + (isNext ? 'Start' : isDone ? 'Again' : les.minutes + ' min') + '</span></button></li>';
    });
    h += '</ol>';
    return h;
  }

  function dots(n, at) {
    var h = '<div class="dots" aria-label="Step ' + (at + 1) + ' of ' + n + '">';
    for (var k = 0; k < n; k++) h += '<i class="' + (k < at ? 'past' : k === at ? 'now' : '') + '"></i>';
    return h + '</div>';
  }
  function panelLesson() {
    var les = L.lesson; if (!les) return '';
    var n = L.list().indexOf(les), h = '<button class="back" data-act="lesson-exit">← All levels</button>';
    if (les.kind === 'watch') {
      h += head('Level 0', 'Watch', '');
      if (!L.watchDone) h += '<p class="coach">Two hands, one board. Just watch.</p><div class="row"><button class="btn" data-act="watch-end">I have seen enough</button></div>';
      else h += '<p class="coach">That was Igisoro. In ten minutes you will know what every one of those moves was doing.</p><div class="row"><button class="btn btn-primary" data-act="lesson" data-id="L1">Start level 1: Sowing</button></div>';
      return h;
    }
    var step = L.step;
    h += head('Level ' + n + ' of 6', esc(les.title), '');
    if (!step) return h;
    h += dots(les.steps.length, L.idx);
    if (step.type === 'recap') {
      h += '<div class="recap"><h3>What you now know</h3><ul>';
      step.points.forEach(function (p) { h += '<li>' + esc(p) + '</li>'; });
      h += '</ul><p class="muted">+' + L.gained + ' XP</p></div>';
      var nx = L.list()[n + 1];
      h += '<div class="row">' + (nx ? '<button class="btn btn-primary" data-act="lesson" data-id="' + nx.id + '">Next: ' + esc(nx.title) + '</button>' : '<button class="btn btn-primary" data-act="nav" data-to="play">Go and play</button>') + '<button class="btn" data-act="lesson-exit">All levels</button></div>';
      return h;
    }
    h += '<p class="coach">' + esc(step.text) + '</p>';
    if (L.msg) h += '<p class="feedback ' + (L.status || 'note') + '" role="status">' + esc(L.msg) + '</p>';
    h += '<div class="row">';
    if (step.type === 'play') {
      if (L.canNext) h += '<button class="btn btn-primary" data-act="lesson-next">Finish the level</button>';
      else if (G.cfg && G.cfg.lesson && !G.over) h += '';
      else h += '<button class="btn btn-primary" data-act="lesson-play">Start the game</button>';
    } else if (L.canNext) h += '<button class="btn btn-primary" data-act="lesson-next">Next</button>';
    else if (step.type === 'demo') h += '<span class="muted">Watch the board.</span>';
    if ((step.type === 'do' || step.type === 'two') && L.tries >= 2 && !L.canNext && !L.showAnswer) h += '<button class="btn" data-act="lesson-show">Show me</button>';
    h += '</div>';
    if (step.type === 'play' && G.cfg && G.cfg.lesson) h += nudgeBlock() + logBlock();
    return h;
  }

  function panelPuzzles() {
    var num = U.dailyNumber(), solved = P.data.daily[num];
    var h = head('Puzzles', 'Find the capture', 'Positions from real play, checked by the engine. Preview moves by tapping a pit once.');
    h += '<section class="block card"><p class="eyebrow">Daily puzzle #' + num + '</p><h3>' + (num % 3 === 0 ? 'Win cows in two moves' : 'Capture in one move') + '</h3><p class="muted">' + (solved ? 'Solved in ' + U.plural(solved, 'try', 'tries') + '. A new one arrives tomorrow.' : 'The same position for everyone today.') + '</p><button class="btn btn-primary" data-act="daily">' + (solved ? 'See it again' : 'Solve it') + '</button></section>';
    h += '<section class="block"><h3>Practice</h3><div class="row"><button class="btn" data-act="puzzle" data-v="one">One-move puzzle</button><button class="btn" data-act="puzzle" data-v="two">Two-move puzzle</button></div><p class="muted">' + U.plural(P.data.stats.puzzles, 'puzzle') + ' solved so far.</p></section>';
    return h;
  }
  function panelPuzzle() {
    var p = Z.cur, h = '<button class="back" data-act="puzzle-exit">← Puzzles</button>';
    if (!p) return h + '<p class="coach">' + esc(Z.msg) + '</p><div class="row"><button class="btn" data-act="puzzle" data-v="one">Try another</button></div>';
    h += head(Z.daily ? 'Daily puzzle #' + Z.number : 'Practice puzzle', p.kind === 'one' ? 'Capture ' + p.need + ' cows in one move' : 'Win ' + p.need + ' cows or more in two moves', '');
    if (!Z.solved) h += '<p class="coach">' + (p.kind === 'one' ? 'You sit at the bottom. One of your moves takes ' + p.need + ' cows. Tap a pit to preview it, tap again to sow.' : 'You sit at the bottom. No capture is on yet. Set one up, your opponent answers, then take the cows.') + '</p>';
    if (Z.msg) h += '<p class="feedback ' + (Z.status || 'note') + '" role="status">' + esc(Z.msg) + '</p>';
    h += '<div class="row">';
    if (Z.solved) {
      if (Z.daily) h += '<button class="btn btn-primary" data-act="puzzle-share">Share result</button>';
      h += '<button class="btn' + (Z.daily ? '' : ' btn-primary') + '" data-act="puzzle" data-v="' + (p.kind === 'two' ? 'two' : 'one') + '">' + (Z.daily ? 'Practice puzzle' : 'Next puzzle') + '</button>';
    } else {
      h += '<span class="muted">' + U.plural(Z.tries, 'try', 'tries') + ' so far</span>';
      if (Z.tries >= 3) h += '<button class="btn btn-small" data-act="puzzle-show">Show the first move</button>';
    }
    h += '</div>';
    if (Z.solved && Z.daily) h += '<pre class="sharecard" aria-label="Share card">' + esc(Z.shareText()) + '</pre>';
    return h;
  }

  function panelProgress() {
    var d = P.data, lv = P.level(), h = head('Progress', 'Level ' + lv.n + ': ' + esc(lv.name), '');
    h += '<div class="xp" role="img" aria-label="' + d.xp + ' XP"><i style="width:' + Math.round(lv.frac * 100) + '%"></i></div><p class="muted">' + d.xp + ' XP' + (lv.next ? ' · ' + (lv.next - d.xp) + ' to level ' + (lv.n + 1) : ' · top level') + '</p>';
    h += '<dl class="stats"><div><dt>Herd</dt><dd>' + d.cows + HORN + '</dd></div><div><dt>Streak</dt><dd>' + U.plural(P.streak(), 'day') + '</dd></div><div><dt>Online rating</dt><dd>' + d.rating + '</dd></div><div><dt>Won at tables</dt><dd>' + d.won + HORN + '</dd></div><div><dt>Wins</dt><dd>' + d.stats.wins + ' of ' + d.stats.games + '</dd></div><div><dt>Cows captured</dt><dd>' + d.stats.captures + '</dd></div><div><dt>Puzzles</dt><dd>' + d.stats.puzzles + '</dd></div></dl>';
    h += todayBlock();
    h += '<section class="block"><h3>Badges</h3><ul class="badges">';
    P.BADGES.forEach(function (b, n) { h += '<li class="' + (d.badges[b.id] ? 'got' : '') + '" title="' + esc(b.text) + '">' + badgeSvg(n) + '<b>' + esc(b.name) + '</b><small>' + esc(b.text) + '</small></li>'; });
    h += '</ul></section>';
    h += '<section class="block"><h3>Board and seeds</h3><p class="muted">Earned by levelling up. They change how the game looks, never how it plays.</p><ul class="looks">';
    P.COSMETICS.forEach(function (c) {
      var own = P.owns(c), on = P.wearing(c);
      h += '<li><button class="look' + (on ? ' on' : '') + '" data-act="wear" data-id="' + c.id + '"' + (own ? '' : ' disabled') + ' aria-pressed="' + on + '"><b>' + esc(c.name) + '</b><small>' + (own ? (on ? 'In use' : 'Use') : ICON.lock + 'Level ' + c.level) + '</small></button></li>';
    });
    h += '</ul></section>';
    h += '<section class="block"><h3>Online leaderboard</h3><div id="lb"><p class="muted">Loading…</p></div></section>';
    return h;
  }
  function fillLeaderboard() {
    var box = U.$('#lb'); if (!box) return;
    P.leaderboard().then(function (rows) {
      box = U.$('#lb'); if (!box) return;
      if (rows === null) { box.innerHTML = '<p class="muted">The leaderboard appears when this game is opened on claude.ai by a signed-in player.</p>'; return; }
      if (!rows.length) { box.innerHTML = '<p class="muted">Nobody has finished a rated online game yet. Be the first.</p>'; return; }
      var ol = document.createElement('ol'); ol.className = 'board-list';
      rows.forEach(function (r, n) {
        var li = document.createElement('li'); if (r.me) li.className = 'me';
        var a = document.createElement('span'); a.className = 'rank'; a.textContent = n + 1;
        var b = document.createElement('span'); b.className = 'grow'; b.textContent = (r.name || 'Someone') + (r.me ? ' (you)' : '');
        var c = document.createElement('b'); c.textContent = r.rating;
        li.appendChild(a); li.appendChild(b); li.appendChild(c); ol.appendChild(li);
      });
      box.innerHTML = ''; box.appendChild(ol);
    });
  }

  function panelAbout() {
    var h = head('About', 'About Igisoro', '');
    h += '<ul class="facts"><li>Igisoro is played on a board of 4 rows of 8 pits, with 64 seeds.</li><li>It has been played in Rwanda for centuries, and is related to Omweso in Uganda and Bao in East Africa.</li><li>Boards carved into rock across the country are attributed in tradition to King Ruganzu (1510–1543).</li><li>The seeds are called cows.</li><li>Masters are known for never counting seeds.</li><li>Since 2023 it has been part of the Umurenge Kagame Cup.</li></ul>';
    h += '<p class="muted">Rules vary by region. This edition uses one documented set, with settings for common variants. Find them under Settings, Rules.</p>';
    h += '<section class="block"><h3>Words used in this game</h3><dl class="glossary">';
    [['Igisoro / Ikibuguzo', 'The game and the board'], ['Kubuguza', 'Playing the game; the main phase'], ['Icyuba (ibyuba)', 'Pit (pits)'], ['Ubusoro', 'Seeds'], ['Inka', 'Cows; the seeds you capture'],
      ['Urunyana', 'Line of calves; a row of single seeds'], ['Kugereka', 'Placing the seeds at setup'], ['Guca umuvuno', 'The opening'], ['Kuvuna / Kwivunura', 'First move / second move of the opening'],
      ['Kurasa', 'To capture'], ['Nteba', 'Your two special pits on the left: the outer corner pit and the second inner pit'], ['Guteba', 'Sowing clockwise from a Nteba pit, to capture'],
      ['Ngarama', 'Your two special pits on the right: the outer corner pit and the second inner pit'], ['Kugarama', 'Sowing clockwise from an Ngarama pit, to capture'],
      ['Ndahise', 'I pass; declining a capture'], ['Ndakubye', 'I retreat; the opponent’s protective reply'], ['Gutanga inganji', 'The winner starts the next game'], ['Igitego', 'A point, one per game won']
    ].forEach(function (g) { h += '<div><dt>' + g[0] + '</dt><dd>' + g[1] + '</dd></div>'; });
    h += '</dl></section>';
    return h;
  }

  function nudgeBlock() {
    if (!G.nudge) return '';
    return '<div class="notice notice-coach" role="status"><p><b>Coach.</b> ' + esc(G.nudge.text) + '</p><div class="row"><button class="btn btn-small btn-primary" data-act="undo">Undo</button><button class="btn btn-small" data-act="nudge-ok">Carry on</button></div></div>';
  }
  function logBlock() {
    if (!G.log.length) return '';
    var h = '<section class="block"><h3>Moves</h3><ol class="log" start="' + Math.max(1, G.log.length - 5) + '">';
    G.log.slice(-6).forEach(function (m) { h += '<li' + (m.captured ? ' class="cap"' : '') + '>' + esc(m.text) + '</li>'; });
    return h + '</ol></section>';
  }
  function panelGame() {
    var cfg = G.cfg; if (!cfg) return '';
    var h = confirmBox() + head(esc(cfg.eyebrow || ''), esc(cfg.title || 'Game'), '');
    if (UI.score[0] + UI.score[1] > 0) h += '<p class="score"><span>Points (igitego)</span><b>' + UI.score[0] + '</b><i>:</i><b>' + UI.score[1] + '</b></p>';
    if (!G.over && G.moves.length < 2 && cfg.rules.openingNoCaptureMoves) h += '<p class="muted">Opening: the first move of each player cannot capture.</p>';
    h += nudgeBlock();
    if (G.over && G.result) {
      var w = G.result.winner, ai = cfg.mode === 'ai';
      h += '<div class="result"><h3>' + (w === 'draw' ? 'Game annulled' : ai ? (w === 0 ? 'You won' : 'You lost') : (w === 0 ? 'Bottom wins' : 'Top wins')) + '</h3>';
      h += '<p>' + (G.result.reason === 'resign' ? 'By resignation.' : w === 'draw' ? 'The only moves left would never end, so nobody takes the point.' : 'The other side has no pit of 2 or more seeds left to sow.') + '</p>';
      h += '<div class="row"><button class="btn btn-primary" data-act="rematch">' + (cfg.stake ? 'Play again · ' + cfg.stake.fee + ' cows' : 'Rematch') + '</button><button class="btn" data-act="nav" data-to="play">Change table</button>';
      if (ai && w === 0) h += '<button class="btn" data-act="challenge">Challenge a friend</button>';
      h += '</div><p class="muted">The winner starts the next game (gutanga inganji).</p></div>';
    }
    h += logBlock();
    return h;
  }

  UI.render = function () {
    var panel = U.$('#panel'), html, keep = document.activeElement && document.activeElement.id === 'join-code' ? U.$('#join-code').value : null;
    if (keep !== null) UI.joinCode = keep;
    if (UI.mode === 'lesson') html = (G.cfg && G.cfg.lesson ? confirmBox() : '') + panelLesson();
    else if (UI.mode === 'puzzle') html = panelPuzzle();
    else if (UI.mode === 'online') html = panelTable();
    else if (UI.mode === 'game') html = panelGame();
    else {
      var r = UI.route;
      html = r === 'play' ? panelPlay() : r === 'online' || /^t-/.test(r) ? panelOnline() : r === 'learn' ? panelLearn() : r === 'puzzles' ? panelPuzzles() : r === 'progress' ? panelProgress() : r === 'about' ? panelAbout() : panelHome();
    }
    panel.innerHTML = html;
    if (keep !== null && U.$('#join-code')) { var el = U.$('#join-code'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    if (UI.mode === 'menu' && UI.route === 'progress') fillLeaderboard();
    U.$$('.nav a').forEach(function (a) {
      var on = UI.mode === 'menu' ? a.dataset.to === UI.route || (a.dataset.to === 'play' && (UI.route === 'online' || /^t-/.test(UI.route))) :
        (a.dataset.to === 'learn' && UI.mode === 'lesson') || (a.dataset.to === 'puzzles' && UI.mode === 'puzzle') || (a.dataset.to === 'play' && (UI.mode === 'game' || UI.mode === 'online'));
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    U.$('#chip-cows b').textContent = P.data.cows;
    var st = P.streak(); U.$('#chip-streak').hidden = st < 1; U.$('#chip-streak b').textContent = st;
    renderStage();
  };

  /* ---- settings dialog ---------------------------------------------------------- */
  function settingsHtml() {
    var d = S.data, h = '<form method="dialog" class="dlg-head"><h2>Settings</h2><button class="btn btn-small" value="close">Done</button></form><div class="dlg-body">';
    function seg(key, opts, cur, label) {
      var s = '<div class="seg seg-wide" role="group" aria-label="' + label + '">';
      opts.forEach(function (o) { s += '<button type="button" data-set="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + '</button>'; });
      return s + '</div>';
    }
    function toggle(key, label, on, note) {
      return '<label class="switch"><input type="checkbox" id="set-' + key + '" data-check="' + key + '"' + (on ? ' checked' : '') + '><span><b>' + label + '</b>' + (note ? '<small>' + note + '</small>' : '') + '</span></label>';
    }
    h += '<section><h3>Rules</h3>' + seg('rulesMode', [['learn', 'Learn'], ['traditional', 'Traditional']], d.rulesMode, 'Rules mode');
    h += '<p class="muted">' + (d.rulesMode === 'learn' ? 'Forced capture, no clockwise moves. Best while you are learning.' : 'Forced capture, with guteba and kugarama: clockwise moves from your Nteba and Ngarama pits.') + '</p>';
    h += '<details' + (UI.advOpen ? ' open' : '') + ' id="adv"><summary>Advanced rules</summary>';
    h += toggle('reverseSowing', 'Guteba and kugarama', d.reverseSowing, 'Sow clockwise from a Nteba or Ngarama pit, only when that lap captures.');
    h += toggle('optional', 'Optional capture', d.captureMode === 'optional', 'You may decline a capture by saying ndahise (I pass) and relay instead.');
    h += toggle('origin', 'Captured cows start in the origin pit', d.captureSowStart === 'origin', 'Off: the first cow goes into the pit after the one where the move began.');
    h += '</details><p class="muted">Rule changes apply to the next game you start.</p></section>';
    h += '<section><h3>Board</h3><p class="lbl">Animation speed</p>' + seg('speed', [[1, '1×'], [2, '2×'], [4, '4×']], d.speed, 'Animation speed');
    h += toggle('showCounts', 'Show counts', d.showCounts, 'Switch off for Master mode: masters never count seeds.');
    h += toggle('tilt', 'Tilted view', d.tilt, 'Look at the board from a slight angle instead of straight down.') + '</section>';
    h += '<section><h3>Hands</h3><p class="lbl">Your hand</p><div class="tones" role="group" aria-label="Your hand tone">';
    IG.TONES.forEach(function (t, k) { h += '<button type="button" class="tone" data-set="tone" data-v="' + k + '" aria-pressed="' + (d.tone === k) + '" aria-label="Tone ' + (k + 1) + '" style="background:' + t + '"></button>'; });
    h += '</div><p class="lbl">Other hand</p><div class="tones" role="group" aria-label="Other hand tone">';
    IG.TONES.forEach(function (t, k) { h += '<button type="button" class="tone" data-set="tone2" data-v="' + k + '" aria-pressed="' + (d.tone2 === k) + '" aria-label="Tone ' + (k + 1) + '" style="background:' + t + '"></button>'; });
    h += '</div></section>';
    h += '<section><h3>Sound and theme</h3>' + toggle('sound', 'Sound', d.sound, 'Seed clicks and a wooden knock on captures.') + '<p class="lbl">Theme</p>' + seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], d.theme, 'Theme') + '</section>';
    return h + '</div>';
  }
  function openSettings() {
    var dlg = U.$('#dlg'); dlg.innerHTML = settingsHtml();
    try { if (!dlg.open) dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
  }
  function onDialogClick(e) {
    var t = e.target.closest('[data-set]'), dlg = U.$('#dlg');
    if (e.target === dlg) { dlg.close(); return; }
    if (!t) return;
    var key = t.dataset.set, v = t.dataset.v;
    if (key === 'speed' || key === 'tone' || key === 'tone2') v = +v;
    UI.advOpen = !!(U.$('#adv') && U.$('#adv').open);
    S.set(key, v);
    if (key === 'tone' || key === 'tone2') applyTones();
    dlg.innerHTML = settingsHtml();
    UI.render();
  }
  function onDialogChange(e) {
    var t = e.target.closest('[data-check]'); if (!t) return;
    var k = t.dataset.check, on = t.checked;
    UI.advOpen = !!(U.$('#adv') && U.$('#adv').open);
    if (k === 'optional') S.set('captureMode', on ? 'optional' : 'forced');
    else if (k === 'origin') S.set('captureSowStart', on ? 'origin' : 'afterOrigin');
    else S.set(k, on);
    if (k === 'tilt') setTimeout(function () { B.layout(); if (G.selected !== null) G.cancelSelect(); }, 0);
    U.$('#dlg').innerHTML = settingsHtml();
    var again = U.$('#set-' + k); if (again) again.focus();
    UI.render();
  }
  function applyTones() {
    if (G.cfg && UI.mode !== 'menu' && G.cfg.mode !== 'online') { G.cfg.seats[0].tone = IG.TONES[S.get('tone')]; G.cfg.seats[1].tone = IG.TONES[S.get('tone2')]; }
    var mine = IG.TONES[S.get('tone')], other = IG.TONES[S.get('tone2')], bottom = G.cfg && UI.mode !== 'menu' ? G.cfg.bottom : 0;
    V.setTone(bottom, mine); V.setTone(1 - bottom, other);
  }

  /* ---- actions -------------------------------------------------------------------- */
  function act(name, t) {
    switch (name) {
      case 'nav': UI.navigate(t.dataset.to); break;
      case 'confirm-yes': var to = UI.confirm ? UI.confirm.to : 'home'; UI.confirm = null; UI.leave(); UI.go(to); break;
      case 'confirm-no': UI.confirm = null; UI.render(); break;
      case 'learn-continue': var nx = L.nextUp(); if (nx) L.open(nx.id); else UI.navigate('learn'); break;
      case 'lesson': if (UI.mode !== 'menu') UI.leave(); L.open(t.dataset.id); break;
      case 'lesson-next': L.next(); break;
      case 'lesson-show': L.showMe(); break;
      case 'lesson-play': L.startPlay(); UI.render(); break;
      case 'lesson-exit': UI.leave(); UI.go('learn'); break;
      case 'watch-end': L.endWatch(); break;
      case 'daily': if (UI.mode !== 'menu') UI.leave(); Z.open('daily'); break;
      case 'puzzle': if (UI.mode !== 'menu') UI.leave(); Z.open(t.dataset.v); break;
      case 'puzzle-exit': UI.leave(); UI.go('puzzles'); break;
      case 'puzzle-show': Z.showSolution(); break;
      case 'puzzle-share': U.share(Z.shareText()).then(function (r) { IG.toast(r === 'failed' ? 'Could not copy. Select the card text below and copy it.' : r === 'shared' ? 'Shared.' : 'Result copied. Paste it anywhere.'); }); break;
      case 'venue': UI.sel.table = t.dataset.v; UI.render(); break;
      case 'level': UI.sel.level = t.dataset.v; UI.render(); break;
      case 'enter': var tb = P.TABLES.filter(function (v) { return v.id === UI.sel.table && P.tableOpen(v); })[0]; if (!tb) P.TABLES.forEach(function (v) { if (P.tableOpen(v)) tb = v; }); UI.startGame({ kind: 'table', table: tb.id }); break;
      case 'practice': UI.startGame({ kind: 'practice', level: UI.sel.level }); break;
      case 'local': if (UI.mode !== 'menu') UI.leave(); UI.startGame({ kind: 'local' }); break;
      case 'rematch': UI.rematch(); break;
      case 'challenge': U.share('I just won a game of Igisoro, the Rwandan game of seeds and cows. Can you beat me?' + (IG.ARTIFACT_URL ? '\n' + IG.ARTIFACT_URL : '')).then(function (r) { IG.toast(r === 'failed' ? 'Could not copy the challenge.' : r === 'shared' ? 'Shared.' : 'Challenge copied. Paste it into a chat.'); }); break;
      case 'claim': P.claimLogin(); break;
      case 'wear': P.wear(t.dataset.id); break;
      case 'speed': S.set('speed', +t.dataset.v); if (UI.mode === 'online') V.setSpeed(Math.max(2, +t.dataset.v)); renderStage(); break;
      case 'skip': G.skipAnim(); break;
      case 'hint': G.hint(); break;
      case 'undo': G.undo(); break;
      case 'nudge-ok': G.dismissNudge(); break;
      case 'resign':
        if (UI.mode === 'online') { UI.confirm = { text: 'Resign this game?', to: null, resign: true }; UI.render(); }
        else if (G.cfg) G.resign(G.cfg.mode === 'local' ? G.state.turn : 0);
        break;
      case 'net-create': N.create(); break;
      case 'net-leave': if (N.phase === 'playing' && !G.over) { UI.confirm = { text: 'Leave the table? That resigns this game.', to: 'online' }; UI.render(); } else { UI.leave(); UI.go('online'); } break;
      case 'net-rematch': N.rematch(); break;
      case 'net-invite': U.share(N.inviteText()).then(function (r) { IG.toast(r === 'failed' ? 'Could not copy. The code is ' + esc(N.code.toUpperCase()) + '.' : r === 'shared' ? 'Invitation shared.' : 'Invitation copied. Paste it into a chat.'); }); break;
      case 'settings': openSettings(); break;
      case 'full': UI.toggleFull(); break;
    }
  }

  function boot(hot) {
    S.apply();
    V.init(U.$('#board'), U.$('#gl'));
    if (V.isFlat()) document.body.classList.add('flat');
    B.build();
    S.apply();
    applyTones();
    P.ensureDay();

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
      if (t.tagName === 'A') e.preventDefault();
      IG.audio.unlock();
      if (t.dataset.act === 'confirm-yes' && UI.confirm && UI.confirm.resign) { UI.confirm = null; N.resign(); UI.render(); return; }
      act(t.dataset.act, t);
    });
    document.addEventListener('submit', function (e) {
      if (e.target.id !== 'join-form') return;
      e.preventDefault();
      UI.joinCode = U.$('#join-code').value;
      N.join(UI.joinCode);
    });
    var dlg = U.$('#dlg');
    dlg.addEventListener('click', onDialogClick);
    dlg.addEventListener('change', onDialogChange);
    window.addEventListener('hashchange', function () {
      var r = routeFromHash();
      if (/^t-/.test(r)) { if (N.code && r === 't-' + N.code) return; if (UI.mode !== 'menu') UI.leave(); UI.route = r; UI.joinCode = r.slice(2).toUpperCase(); UI.render(); N.join(r.slice(2)); return; }
      if (r === UI.route && UI.mode === 'menu') return;
      if (UI.mode !== 'menu') UI.leave();
      UI.route = r; UI.render();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (UI.confirm) { UI.confirm = null; UI.render(); }
      else if (UI.full && U.$('#prompt').hidden) UI.setFull(false);
    });
    // Escape or the browser's own control ended real full screen: follow it
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
      document.addEventListener(ev, function () { if (!(document.fullscreenElement || document.webkitFullscreenElement) && UI.full) markFull(false); });
    });

    ['game:start', 'game:update', 'game:end', 'panel', 'progress', 'plates'].forEach(function (ev) { IG.bus.on(ev, function () { UI.render(); }); });
    IG.bus.on('settings', function (k) { if (k === 'tilt') B.layout(); });

    UI.route = routeFromHash();
    document.body.dataset.mode = 'menu';
    UI.idleBoard();
    UI.render();
    if (/^t-/.test(UI.route)) { UI.joinCode = UI.route.slice(2).toUpperCase(); N.join(UI.route.slice(2)); }

    // carry a game in progress across a republish of this page
    if (hot && hot.game && hot.game.o) { try { UI.startGame(Object.assign({}, hot.game.o, { restored: true, first: hot.game.first, moves: hot.game.moves })); UI.score = hot.game.score || [0, 0]; } catch (e) { } }
    try {
      if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(function () {
        if (UI.mode !== 'game' || !G.cfg || G.over || !UI.last) return {};
        var o = Object.assign({}, UI.last); delete o.onEnd;
        return { game: { o: o, first: G.initial.turn, moves: G.moves, score: UI.score } };
      });
    } catch (e) { }
  }
  UI.boot = boot;
})();
