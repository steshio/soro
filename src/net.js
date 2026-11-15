/* ==========================================================================
   NETWORKING: online play with a friend
   - db   tables/<code>: the durable record (players, move list, status,
          result, score). Survives a refresh and a late join.
   - room table-<code>: live moves {seq, move, hashAfter} and presence
          (which pit the other player is hovering).
   - user ids only are stored; names and avatars are resolved at render time.
   Everything received is untrusted: shapes are checked and every move is
   validated by the engine before it is applied.
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG, E = window.IgisoroEngine, U = IG.util, G = IG.game, V = IG.view;

  var N = IG.net = {
    phase: 'checking',        // checking | unavailable | idle | waiting | playing
    why: '', error: '', code: '', seat: null, doc: null, gameNo: 0, names: {}, avatars: {},
    oppHere: false, oppLeft: false, ref: null, room: null, expect: {}, busy: false
  };
  var unsub = null, roomUnsubs = [], writing = false, writeAgain = false, leftTimer = null, lastHover;
  var CONTRIB = 'Ask the owner to share this game with you as a contributor to play online.';

  function redraw() { IG.bus.emit('panel'); IG.bus.emit('plates'); }

  IG.caps.ready.then(function (c) {
    if (c.db && c.room && c.uid && c.canWrite !== false) { N.phase = 'idle'; }
    else {
      N.phase = 'unavailable';
      if (!window.claude) N.why = 'Online play works when this game is opened on claude.ai. Everything else works here.';
      else if (c.canWrite === false) N.why = CONTRIB;
      else if (!c.uid) N.why = 'Online play needs you to be signed in to claude.ai. ' + CONTRIB;
      else N.why = 'Online play is not available in this view. ' + CONTRIB;
    }
    redraw();
    if (N.phase === 'idle' && N.pendingCode) { var code = N.pendingCode; N.pendingCode = null; N.join(code); }
  });

  /* ---- untrusted data -> known shapes -------------------------------------- */
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 80) : ''; }
  function int(v) { return typeof v === 'number' && isFinite(v) ? Math.max(0, Math.floor(v)) : 0; }
  var DECISIONS = { ccw: 1, cw: 1, take: 1, pass: 1 };
  function toMove(m) {
    if (!m || typeof m !== 'object' || typeof m.s !== 'number' || m.s < 0 || m.s > 15 || m.s !== Math.floor(m.s)) return null;
    var d = Array.isArray(m.d) ? m.d : [];
    if (d.length > 64) return null;
    for (var k = 0; k < d.length; k++) if (!DECISIONS[d[k]]) return null;
    return { start: m.s, decisions: d.slice() };
  }
  function pack(m) { return { s: m.start, d: m.decisions.slice() }; }
  function clean(d) {
    if (!d || typeof d !== 'object') return null;
    var o = { host: str(d.host), guest: str(d.guest) };
    if (!o.host) return null;
    o.first = d.first === 1 ? 1 : 0;
    o.game = int(d.game) || 1;
    var r = d.rules && typeof d.rules === 'object' ? d.rules : {};
    o.rules = { captureMode: r.captureMode === 'optional' ? 'optional' : 'forced', reverseSowing: !!r.reverseSowing, captureSowStart: r.captureSowStart === 'origin' ? 'origin' : 'afterOrigin' };
    o.moves = [];
    var mv = Array.isArray(d.moves) ? d.moves : [];
    if (mv.length > 3000) return null;
    for (var k = 0; k < mv.length; k++) { var m = toMove(mv[k]); if (!m) return null; o.moves.push(m); }
    o.hash = str(d.hash, 200);
    o.status = d.status === 'playing' || d.status === 'finished' ? d.status : 'waiting';
    o.result = d.result && typeof d.result === 'object' ? { winner: d.result.winner === 0 || d.result.winner === 1 ? d.result.winner : 'draw', reason: d.result.reason === 'resign' ? 'resign' : 'moves' } : null;
    var sc = Array.isArray(d.score) ? d.score : [];
    o.score = [int(sc[0]), int(sc[1])];
    o.rematch = { h: !!(d.rematch && d.rematch.h), g: !!(d.rematch && d.rematch.g) };
    var ra = d.ratings && typeof d.ratings === 'object' ? d.ratings : {};
    o.ratings = { h: int(ra.h) || 1200, g: int(ra.g) || 1200 };
    return o;
  }
  function cleanCode(c) { return String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8); }
  function newCode() {
    var a = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    for (var k = 0; k < 5; k++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function failText(e) {
    if (e && (e.code === 'invalid_argument' || e.code === 'not_permitted' || e.code === 'not_granted' || e.code === 'revoked')) return CONTRIB;
    if (e && e.code === 'quota_exceeded') return 'This game’s table store is full. Ask the owner to clear old tables.';
    return 'The table could not be reached. Check your connection and try again.';
  }

  /* ---- create / join --------------------------------------------------------- */
  N.create = async function () {
    if (N.phase !== 'idle' || N.busy) return;
    N.busy = true; N.error = ''; redraw();
    var db = IG.caps.db, uid = IG.caps.uid, S = IG.settings.data;
    try {
      var code, ref, tries = 0;
      do { code = newCode(); ref = db.doc('tables/' + code); tries++; } while ((await ref.get()).exists && tries < 6);
      await ref.set({ v: 1, code: code, host: uid, guest: '', first: Math.random() < 0.5 ? 0 : 1,
        rules: { captureMode: S.captureMode, reverseSowing: S.reverseSowing, captureSowStart: S.captureSowStart },
        game: 1, moves: [], hash: '', status: 'waiting', result: null, score: [0, 0], rematch: { h: false, g: false },
        ratings: { h: IG.progress.data.rating, g: 1200 }, createdAt: Date.now(), updatedAt: Date.now() });
      N.busy = false;
      attach(code, ref, 0);
    } catch (e) { N.busy = false; N.error = failText(e); redraw(); }
  };

  N.join = async function (raw) {
    var code = cleanCode(raw);
    if (N.phase === 'checking') { N.pendingCode = code; return; }
    if (N.phase !== 'idle' || N.busy) return;
    if (code.length < 4) { N.error = 'Enter the table code your friend sent you.'; redraw(); return; }
    N.busy = true; N.error = ''; redraw();
    var db = IG.caps.db, uid = IG.caps.uid;
    try {
      var ref = db.doc('tables/' + code), snap = await ref.get(), d = snap.exists ? clean(snap.data()) : null;
      if (!d) { N.busy = false; N.error = snap.exists ? 'That table cannot be read.' : 'No table with that code. Check it with your friend.'; redraw(); return; }
      if (d.host === uid) { N.busy = false; return attach(code, ref, 0); }
      if (d.guest === uid) { N.busy = false; return attach(code, ref, 1); }
      if (d.guest) { N.busy = false; N.error = 'That table already has two players.'; redraw(); return; }
      // claim the empty seat under a short lease so two people cannot both take it
      var lease = await ref.acquire({ holder: uid, ttlMs: 5000 });
      if (!lease.acquired) { N.busy = false; N.error = 'Someone else is sitting down at that table. Try again in a moment.'; redraw(); return; }
      d = clean((await ref.get()).data());
      if (!d || (d.guest && d.guest !== uid)) { N.busy = false; N.error = 'That table already has two players.'; redraw(); return; }
      await ref.update({ guest: uid, status: 'playing', ratings: { g: IG.progress.data.rating }, updatedAt: Date.now() });
      N.busy = false;
      attach(code, ref, 1);
    } catch (e) { N.busy = false; N.error = failText(e); redraw(); }
  };

  function attach(code, ref, seat) {
    N.code = code; N.ref = ref; N.seat = seat; N.gameNo = 0; N.doc = null; N.expect = {}; N.error = '';
    N.oppHere = false; N.oppLeft = false; N.phase = 'waiting';
    try { if (location.hash !== '#t-' + code) location.hash = 't-' + code; } catch (e) { }   // the table code travels in the link
    unsub = ref.onSnapshot(onDoc, function (e) { N.error = failText(e); N.leave(true); });
    IG.caps.room.join('table-' + code).then(function (r) {
      if (N.code !== code) { r.leave(); return; }
      N.room = r;
      roomUnsubs.push(r.on('move', onMoveEvent));
      roomUnsubs.push(r.on('ctl', onCtl));
      roomUnsubs.push(r.onPeers(onPeers));
      r.presence({ seat: seat, hover: null }).catch(function () { });
    }, function () { /* the table still works through the stored record, only slower */ });
    IG.ui.setMode('online');
    redraw();
  }

  N.leave = function (silent) {
    var ref = N.ref, d = N.doc, wasWaiting = N.phase === 'waiting' && N.seat === 0 && d && !d.guest;
    if (unsub) { try { unsub(); } catch (e) { } unsub = null; }
    roomUnsubs.forEach(function (u) { try { u(); } catch (e) { } }); roomUnsubs = [];
    if (N.room) { try { N.room.leave(); } catch (e) { } N.room = null; }
    clearTimeout(leftTimer);
    if (wasWaiting && ref) ref.delete().catch(function () { });
    N.ref = null; N.code = ''; N.seat = null; N.doc = null; N.gameNo = 0;
    if (N.phase !== 'unavailable' && N.phase !== 'checking') N.phase = 'idle';
    V.setSpeed(IG.settings.get('speed'));
    try { if (/^#t-/.test(location.hash)) location.hash = 'online'; } catch (e) { }
    if (!silent) redraw();
  };

  /* ---- the stored record ------------------------------------------------------ */
  function onDoc(snap) {
    if (!snap.exists) { if (N.phase !== 'waiting' || N.doc) { N.error = 'That table was closed.'; G.stop(); N.leave(); IG.ui.go('online'); } return; }
    var d = clean(snap.data());
    if (!d) { N.error = 'That table’s record is damaged and cannot be played.'; G.stop(); N.leave(); IG.ui.go('online'); return; }
    N.doc = d;
    resolveNames(d);
    if (d.status === 'waiting') { N.phase = 'waiting'; redraw(); return; }
    N.phase = 'playing';
    if (N.gameNo !== d.game) return startGame(d);
    // moves we have not seen through the room (a dropped event, or a late join)
    for (var k = G.moves.length; k < d.moves.length; k++) if (!G.queue.some(function (q) { return q.seq === k; })) G.queue.push({ seq: k, move: d.moves[k] });
    G.flushQueue();
    if (!G.busy && !G.over && d.moves.length === G.moves.length && d.hash && d.hash !== E.hash(G.state)) resync();
    if (d.result && d.result.reason === 'resign' && !G.over) G.resign(1 - d.result.winner);
    if (d.status === 'finished' && d.rematch.h && d.rematch.g && N.seat === 0) nextGame(d);
    redraw();
  }

  function startGame(d) {
    N.gameNo = d.game; N.expect = {}; N.rated = false;
    var opp = N.seat === 0 ? d.guest : d.host;
    V.setSpeed(Math.max(2, IG.settings.get('speed')));
    G.start({
      mode: 'online', rules: E.makeRules(d.rules), first: d.first, bottom: N.seat, title: 'Table ' + N.code.toUpperCase(),
      seats: [0, 1].map(function (s) { return s === N.seat ? { kind: 'human', name: 'You' } : { kind: 'remote', name: N.names[opp] || 'Your friend', uid: opp }; }),
      labels: N.seat === 0 ? ['Your', 'Opponent’s'] : ['Opponent’s', 'Your'],
      hooks: { onMove: afterMove, onEnd: afterEnd, onHover: sendHover, onDesync: resync }
    });
    if (d.moves.length) {
      try { G.loadMoves(d.moves); } catch (e) { N.error = 'That table’s moves could not be replayed.'; G.stop(); N.leave(); IG.ui.go('online'); return; }
    }
    if (d.result && d.result.reason === 'resign') setTimeout(function () { if (!G.over) G.resign(1 - d.result.winner); }, 120);
    redraw();
  }

  function resync() {
    if (!N.ref) return;
    N.ref.get().then(function (snap) {
      var d = snap.exists ? clean(snap.data()) : null;
      if (!d || d.game !== N.gameNo) return;
      try { G.loadMoves(d.moves); IG.toast('Board resynced with the table.'); }
      catch (e) { N.error = 'That table’s moves could not be replayed.'; G.stop(); N.leave(); IG.ui.go('online'); }
    }, function () { });
  }

  function write(extra) {
    if (!N.ref) return;
    N.pendingExtra = Object.assign(N.pendingExtra || {}, extra || {});
    if (writing) { writeAgain = true; return; }
    writing = true;
    var data = Object.assign({ moves: G.moves.map(pack), hash: E.hash(G.state), updatedAt: Date.now() }, N.pendingExtra);
    N.pendingExtra = null;
    var game = N.gameNo;
    N.ref.update(data).then(function () { }, function (e) { N.error = failText(e); redraw(); })
      .then(function () { writing = false; if (writeAgain && N.gameNo === game) { writeAgain = false; write(); } else writeAgain = false; });
  }

  /* ---- moves ------------------------------------------------------------------ */
  function afterMove(info) {
    var seq = G.moves.length - 1;
    if (info.seat === N.seat) {
      if (N.room) N.room.emit('move', { g: N.gameNo, seq: seq, move: pack(info.move), hashAfter: E.hash(G.state) }).catch(function (e) {
        if (e && e.code === 'not_permitted') { N.error = CONTRIB; redraw(); }
      });
      write();
    } else if (N.expect[seq] && N.expect[seq] !== E.hash(G.state)) {
      resync();
    }
  }
  function onMoveEvent(msg) {
    if (!msg || msg.isMe) return;
    var d = msg.data; if (!d || typeof d !== 'object' || d.g !== N.gameNo) return;
    var seq = d.seq, mv = toMove(d.move);
    if (typeof seq !== 'number' || seq !== Math.floor(seq) || seq < 0 || seq > 3000 || !mv) return;
    if (seq < G.moves.length) return;
    if (typeof d.hashAfter === 'string') N.expect[seq] = d.hashAfter.slice(0, 200);
    if (!G.queue.some(function (q) { return q.seq === seq; })) G.remoteMove(seq, mv);
  }
  function onCtl(msg) {
    if (!msg || msg.isMe || !msg.data || msg.data.g !== N.gameNo) return;
    if (msg.data.type === 'resign' && !G.over) G.resign(1 - N.seat);
  }

  function afterEnd(result) {
    var d = N.doc; if (!d) return;
    var iEnded = result.reason === 'resign' ? N.resigning : (G.moves.length && G.history.length && G.history[G.history.length - 1].turn === N.seat);
    N.resigning = false;
    if (iEnded) {
      var score = d.score.slice();
      if (result.winner === 0 || result.winner === 1) score[result.winner]++;
      write({ status: 'finished', result: { winner: result.winner, reason: result.reason }, score: score, rematch: { h: false, g: false } });
    }
    var won = result.winner === N.seat, draw = result.winner === 'draw';
    if (!N.rated) {
      N.rated = true;
      var oppRating = N.seat === 0 ? d.ratings.g : d.ratings.h;
      N.delta = IG.progress.applyRating(N.code + ':' + N.gameNo, oppRating, draw ? 0.5 : won ? 1 : 0);
      IG.progress.event('gameEnd', { mode: 'online', won: won });
    }
    redraw();
  }

  N.resign = function () {
    if (N.phase !== 'playing' || G.over) return;
    N.resigning = true;
    if (N.room) N.room.emit('ctl', { g: N.gameNo, type: 'resign' }).catch(function () { });
    G.resign(N.seat);
  };

  N.rematch = function () {
    if (!N.ref || !N.doc || !G.over) return;
    var patch = { rematch: {}, ratings: {}, updatedAt: Date.now() };
    patch.rematch[N.seat === 0 ? 'h' : 'g'] = true;
    patch.ratings[N.seat === 0 ? 'h' : 'g'] = IG.progress.data.rating;
    N.ref.update(patch).catch(function (e) { N.error = failText(e); redraw(); });
  };
  /* gutanga inganji: the winner of the last game starts the next one */
  function nextGame(d) {
    if (N.advancing === d.game) return;
    N.advancing = d.game;
    var first = d.result && (d.result.winner === 0 || d.result.winner === 1) ? d.result.winner : (Math.random() < 0.5 ? 0 : 1);
    N.ref.update({ game: d.game + 1, moves: [], hash: '', status: 'playing', result: null, first: first, rematch: { h: false, g: false }, updatedAt: Date.now() })
      .catch(function (e) { N.advancing = 0; N.error = failText(e); redraw(); });
  }
  N.wantsRematch = function (mine) {
    var d = N.doc; if (!d) return false;
    var key = (N.seat === 0) === mine ? 'h' : 'g';
    return d.rematch[key];
  };

  /* ---- presence: who is at the table, and the ghost hand ----------------------- */
  function onPeers(change) {
    var opp = null, other = 1 - N.seat;
    (change.peers || []).forEach(function (p) {
      if (p.isMe || p.kind !== 'viewer' || !p.presence) return;
      if (p.presence.seat === other) opp = p;
    });
    if (opp) {
      clearTimeout(leftTimer); leftTimer = null;
      if (!N.oppHere || N.oppLeft) { N.oppHere = true; N.oppLeft = false; redraw(); }
      var h = opp.presence.hover;
      if (G.cfg && G.cfg.mode === 'online' && !G.over && G.state.turn === other && !G.busy) V.ghost(other, typeof h === 'number' && h >= 0 && h < 16 && h === Math.floor(h) ? h : null);
    } else if (N.oppHere && !leftTimer) {
      leftTimer = setTimeout(function () { leftTimer = null; N.oppHere = false; N.oppLeft = true; V.ghost(other, null); redraw(); }, 4000);
    }
  }
  function sendHover(i) {
    if (!N.room || i === lastHover) return;
    lastHover = i;
    N.room.presence({ seat: N.seat, hover: i }).catch(function () { });
  }

  /* ---- names and avatars: resolved every render, never stored ------------------ */
  function resolveNames(d) {
    var user = IG.caps.user; if (!user) return;
    var ids = [d.host, d.guest].filter(Boolean);
    user.profiles(ids).then(function (ps) {
      var changed = false;
      ids.forEach(function (id) {
        var p = ps[id]; if (!p) return;
        var nm = p.name || '';
        if (N.names[id] !== nm || N.avatars[id] !== p.avatarUrl) { N.names[id] = nm; N.avatars[id] = p.avatarUrl; changed = true; }
      });
      if (changed) {
        if (G.cfg && G.cfg.mode === 'online') G.cfg.seats.forEach(function (s) { if (s.uid && N.names[s.uid]) s.name = N.names[s.uid]; });
        redraw();
      }
    });
  }
  N.oppId = function () { var d = N.doc; return d ? (N.seat === 0 ? d.guest : d.host) : ''; };

  N.inviteText = function () {
    var lines = ['Play Igisoro with me: the Rwandan game of seeds and cows.'];
    if (IG.ARTIFACT_URL) lines.push('Open ' + IG.ARTIFACT_URL + '#t-' + N.code);
    lines.push('Table code: ' + N.code.toUpperCase());
    return lines.join('\n');
  };
})();
