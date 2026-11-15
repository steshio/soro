/* ==========================================================================
   PROGRESSION: XP, levels, cows, streaks, badges, venues, missions, cosmetics
   Personal progress is private to the viewer (db: data/users/<id>/profile,
   with browser storage as the fallback). Nothing here can be bought.
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG, U = IG.util;

  /* TODO(kinyarwanda): level names. English for now; drop Kinyarwanda names into `name`. */
  var LEVELS = [
    { xp: 0, name: 'Newcomer' }, { xp: 60, name: 'Learner' }, { xp: 160, name: 'Herder' }, { xp: 320, name: 'Player' },
    { xp: 560, name: 'Tactician' }, { xp: 900, name: 'Strategist' }, { xp: 1400, name: 'Expert' }, { xp: 2100, name: 'Master' }
  ];

  /* The venue ladder. TODO(founder): confirm the names; only Huye and Nyanza carry a description from the brief. */
  var VENUES = [
    { id: 'village', name: 'Home village', blurb: 'Where everyone starts.', fee: 5, level: 1, strength: 'Beginner', coached: true,
      ai: { depth: 1, time: 120, blunder: 0.38, noise: 14 }, tint: '#ffffff', air: 700, hue: 'a' },
    { id: 'kigali', name: 'Kigali', blurb: '', fee: 15, level: 2, strength: 'Intermediate', coached: true,
      ai: { depth: 2, time: 300, blunder: 0.12, noise: 6 }, tint: '#fff4ea', air: 1500, hue: 'b' },
    { id: 'musanze', name: 'Musanze', blurb: '', fee: 30, level: 3, strength: 'Intermediate, fewer slips',
      ai: { depth: 2, time: 350, blunder: 0.03, noise: 3 }, tint: '#f1f5ee', air: 500, hue: 'c' },
    { id: 'rubavu', name: 'Rubavu', blurb: '', fee: 60, level: 4, strength: 'Strong',
      ai: { depth: 3, time: 600, blunder: 0, noise: 2 }, tint: '#eef3f7', air: 1100, hue: 'd' },
    { id: 'huye', name: 'Huye', blurb: 'Where the 2023 national final was held.', fee: 120, level: 5, strength: 'Strong, looks further ahead',
      ai: { depth: 4, time: 900, blunder: 0, noise: 1 }, tint: '#fbefe2', air: 900, hue: 'e' },
    { id: 'nyanza', name: 'Nyanza', blurb: 'The old royal capital. The King’s court.', fee: 250, level: 6, strength: 'Master',
      ai: { depth: 12, time: 2400, blunder: 0, noise: 0 }, tint: '#f3e7d8', air: 380, hue: 'f' }
  ];

  var BADGES = [
    { id: 'firstCapture', name: 'First capture', text: 'Capture cows for the first time.' },
    { id: 'firstWin', name: 'First win', text: 'Win a game.' },
    { id: 'chain3', name: 'Three in a row', text: 'Make three captures in one turn.' },
    { id: 'firstReverse', name: 'Against the flow', text: 'Capture with guteba or kugarama.' },
    { id: 'masterWin', name: 'Master table', text: 'Win with counts and previews switched off.' },
    { id: 'streak7', name: 'Seven days', text: 'Play seven days in a row.' }
  ].concat(VENUES.map(function (v) { return { id: 'venue_' + v.id, name: v.name, text: 'Take a seat at ' + v.name + '.' }; }));

  var COSMETICS = [
    { id: 'wood:walnut', kind: 'wood', name: 'Walnut board', level: 1 },
    { id: 'seed:black', kind: 'seed', name: 'Black seeds', level: 1 },
    { id: 'seed:stone', kind: 'seed', name: 'River-stone seeds', level: 2 },
    { id: 'wood:umber', kind: 'wood', name: 'Dark umber board', level: 3 },
    { id: 'bracelet:beads', kind: 'bracelet', name: 'Bead bracelet', level: 3 },
    { id: 'seed:ivory', kind: 'seed', name: 'Ivory seeds', level: 4 },
    { id: 'carve:on', kind: 'carve', name: 'Imigongo rim carving', level: 4 },
    { id: 'wood:honey', kind: 'wood', name: 'Honey board', level: 5 },
    { id: 'bracelet:brass', kind: 'bracelet', name: 'Brass bracelet', level: 6 }
  ];

  var LOGIN_TRACK = [5, 5, 10, 10, 15, 15, 30];

  var MISSIONS = {
    daily:   { text: 'Solve the daily puzzle', goal: 1, cows: 10, xp: 20 },
    cap10:   { text: 'Capture 10 cows', goal: 10, cows: 10, xp: 20 },
    win:     { text: 'Win a game against the computer', goal: 1, cows: 15, xp: 25 },
    relay3:  { text: 'Make a move that relays 3 times or more', goal: 1, cows: 5, xp: 15 },
    puzzles: { text: 'Solve 3 puzzles', goal: 3, cows: 10, xp: 20 },
    lesson:  { text: 'Finish a lesson', goal: 1, cows: 10, xp: 20 },
    games2:  { text: 'Play 2 games', goal: 2, cows: 8, xp: 15 }
  };

  function fresh() {
    return { v: 1, xp: 0, cows: 50, rating: 1200, rated: 0, streak: { n: 0, day: '' }, best: 0, badges: {}, lessons: {},
      stats: { games: 0, wins: 0, captures: 0, puzzles: 0 }, venues: {}, missions: { day: '', items: [] },
      login: { day: '', idx: 0 }, topup: '', daily: {}, look: { wood: 'walnut', seed: 'black', carve: false, bracelet: '' },
      ratedKeys: [], updatedAt: 0 };
  }
  function adopt(raw) {       // stored data is untrusted: copy known fields with type checks
    var d = fresh(); if (!raw || typeof raw !== 'object') return d;
    ['xp', 'cows', 'rating', 'rated', 'best', 'updatedAt'].forEach(function (k) { if (typeof raw[k] === 'number' && isFinite(raw[k])) d[k] = Math.max(0, Math.round(raw[k])); });
    if (typeof raw.topup === 'string') d.topup = raw.topup.slice(0, 10);
    ['badges', 'lessons', 'venues', 'daily', 'stats'].forEach(function (k) {
      if (raw[k] && typeof raw[k] === 'object') for (var x in raw[k]) if (/^[\w:.-]{1,40}$/.test(x) && (typeof raw[k][x] === 'number' || typeof raw[k][x] === 'boolean')) d[k][x] = raw[k][x];
    });
    if (raw.streak && typeof raw.streak.n === 'number') d.streak = { n: Math.max(0, raw.streak.n | 0), day: String(raw.streak.day || '').slice(0, 10) };
    if (raw.login && typeof raw.login.idx === 'number') d.login = { day: String(raw.login.day || '').slice(0, 10), idx: Math.max(0, raw.login.idx | 0) };
    if (raw.missions && Array.isArray(raw.missions.items)) {
      d.missions = { day: String(raw.missions.day || '').slice(0, 10), items: raw.missions.items.filter(function (m) { return m && MISSIONS[m.id]; }).slice(0, 3).map(function (m) { return { id: m.id, n: Math.max(0, m.n | 0), done: !!m.done }; }) };
    }
    if (raw.look && typeof raw.look === 'object') {
      d.look = { wood: IG.models.WOODS[raw.look.wood] ? raw.look.wood : 'walnut', seed: IG.models.SEEDS[raw.look.seed] ? raw.look.seed : 'black',
        carve: !!raw.look.carve, bracelet: raw.look.bracelet === 'beads' || raw.look.bracelet === 'brass' ? raw.look.bracelet : '' };
    }
    if (Array.isArray(raw.ratedKeys)) d.ratedKeys = raw.ratedKeys.filter(function (k) { return typeof k === 'string'; }).slice(-30);
    return d;
  }

  var P = IG.progress = { LEVELS: LEVELS, VENUES: VENUES, BADGES: BADGES, COSMETICS: COSMETICS, LOGIN_TRACK: LOGIN_TRACK, MISSIONS: MISSIONS };
  P.data = adopt(U.lsGet('igisoro.profile.v1', null));

  /* ---- storage ----------------------------------------------------------- */
  var remote = null, remoteOff = false, pushTimer = null, pushing = false, pushAgain = false;
  function save() {
    P.data.updatedAt = Date.now();
    U.lsSet('igisoro.profile.v1', P.data);
    if (remote && !remoteOff) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 2000); }
    IG.bus.emit('progress');
  }
  function push() {
    if (!remote || remoteOff) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true;
    remote.set(JSON.parse(JSON.stringify(P.data))).then(function () { }, function (e) {
      if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted' || e.code === 'quota_exceeded')) remoteOff = true;
    }).then(function () { pushing = false; if (pushAgain) { pushAgain = false; push(); } });
  }
  IG.caps.ready.then(function (c) {
    if (!c.db || !c.uid) return;
    try { remote = c.db.doc('data/users/' + c.uid + '/profile'); } catch (e) { remote = null; return; }
    remote.get().then(function (snap) {
      var r = snap.exists ? snap.data() : null;
      if (r && typeof r.updatedAt === 'number' && r.updatedAt > P.data.updatedAt) {
        P.data = adopt(r); U.lsSet('igisoro.profile.v1', P.data); P.applyLook(); IG.bus.emit('progress');
      } else if (P.data.updatedAt > 0) push();
    }, function () { });
  });

  /* ---- levels, cows -------------------------------------------------------- */
  P.level = function (xp) {
    xp = xp === undefined ? P.data.xp : xp;
    var n = 0; for (var k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].xp) n = k;
    var nextXp = n + 1 < LEVELS.length ? LEVELS[n + 1].xp : null;
    return { n: n + 1, name: LEVELS[n].name, floor: LEVELS[n].xp, next: nextXp, frac: nextXp ? (xp - LEVELS[n].xp) / (nextXp - LEVELS[n].xp) : 1 };
  };
  function addXp(n) {
    var before = P.level().n; P.data.xp += n;
    var after = P.level();
    if (after.n > before) {
      var unlocked = COSMETICS.filter(function (c) { return c.level === after.n; }).map(function (c) { return c.name; })
        .concat(VENUES.filter(function (v) { return v.level === after.n; }).map(function (v) { return v.name + ' venue'; }));
      IG.toast('<b>Level ' + after.n + ': ' + U.esc(after.name) + '</b>' + (unlocked.length ? '<span>Unlocked: ' + U.esc(unlocked.join(', ')) + '</span>' : ''), 'good');
      IG.audio.good();
    }
  }
  function addCows(n) { P.data.cows = Math.max(0, P.data.cows + n); }
  function badge(id) {
    if (P.data.badges[id]) return;
    var b = BADGES.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    P.data.badges[id] = Date.now();
    IG.toast('<b>Badge: ' + U.esc(b.name) + '</b><span>' + U.esc(b.text) + '</span>', 'good');
  }
  function touchStreak() {
    var today = U.dayKey(), s = P.data.streak;
    if (s.day === today) return;
    s.n = s.day && U.dayDiff(s.day, today) === 1 ? s.n + 1 : 1;
    s.day = today;
    if (s.n > P.data.best) P.data.best = s.n;
    if (s.n >= 7) badge('streak7');
  }
  P.streak = function () {
    var s = P.data.streak; if (!s.day) return 0;
    return U.dayDiff(s.day, U.dayKey()) <= 1 ? s.n : 0;
  };

  /* ---- daily missions, login track, top-up -------------------------------- */
  P.ensureDay = function () {
    var today = U.dayKey(), d = P.data, changed = false;
    if (d.missions.day !== today) {
      var pool = ['cap10', 'win', 'relay3', 'puzzles', 'games2'];
      if (Object.keys(d.lessons).length < 7) pool.push('lesson');
      var rnd = IG.prng(parseInt(today.replace(/-/g, ''), 10)), picks = ['daily'];
      while (picks.length < 3) { var c = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; picks.push(c); }
      d.missions = { day: today, items: picks.map(function (id) { return { id: id, n: 0, done: false }; }) };
      changed = true;
    }
    if (d.cows < VENUES[0].fee && d.topup !== today) {
      d.cows = 20; d.topup = today; changed = true;
      IG.toast('<b>Your herd was low.</b><span>Here are 20 cows to start again. One top-up a day.</span>');
    }
    if (changed) save();
  };
  function mission(id, n) {
    P.data.missions.items.forEach(function (m) {
      if (m.id !== id || m.done) return;
      var def = MISSIONS[id];
      m.n = Math.min(def.goal, m.n + n);
      if (m.n >= def.goal) {
        m.done = true; addCows(def.cows); addXp(def.xp);
        IG.toast('<b>Mission done: ' + U.esc(def.text) + '</b><span>+' + def.cows + ' cows, +' + def.xp + ' XP</span>', 'good');
      }
    });
  }
  P.canClaimLogin = function () { return P.data.login.day !== U.dayKey(); };
  P.claimLogin = function () {
    if (!P.canClaimLogin()) return;
    var l = P.data.login, n = LOGIN_TRACK[l.idx % 7];
    addCows(n); l.idx++; l.day = U.dayKey();
    IG.toast('<b>Day ' + ((l.idx - 1) % 7 + 1) + ' collected</b><span>+' + n + ' cows</span>', 'good');
    save();
  };

  /* ---- events from play ----------------------------------------------------- */
  P.event = function (type, d) {
    var D = P.data;
    P.ensureDay();
    if (type === 'move') {
      if (d.captured) { D.stats.captures += d.captured; badge('firstCapture'); mission('cap10', d.captured); }
      if (d.captures >= 3) badge('chain3');
      if (d.reverse) badge('firstReverse');
      if (d.relays >= 3) mission('relay3', 1);
      if (!d.captured && d.relays < 3 && !d.reverse) return;      // nothing changed: no write
    } else if (type === 'gameEnd') {
      touchStreak();
      D.stats.games++; mission('games2', 1);
      if (d.mode !== 'local') addXp(10);
      if (d.won) {
        D.stats.wins++; badge('firstWin'); addXp(25);
        if (d.mode === 'ai') mission('win', 1);
        if (d.venue) D.venues[d.venue] = (D.venues[d.venue] || 0) + 1;
        if (d.table === 'master') badge('masterWin');
      }
    } else if (type === 'lesson') {
      touchStreak();
      if (!D.lessons[d.id]) { D.lessons[d.id] = true; addXp(40); } else addXp(5);
      mission('lesson', 1);
    } else if (type === 'puzzle') {
      touchStreak();
      D.stats.puzzles++; addXp(d.daily ? 30 : 15); mission('puzzles', 1);
      if (d.daily) { mission('daily', 1); if (!D.daily[d.number]) D.daily[d.number] = d.tries; }
    }
    save();
  };

  /* ---- venues and stakes ---------------------------------------------------- */
  P.venueOpen = function (v) { return P.level().n >= v.level; };
  P.enterVenue = function (v) {
    if (!P.venueOpen(v) || P.data.cows < v.fee) return false;
    addCows(-v.fee); badge('venue_' + v.id); save();
    return true;
  };
  P.settleVenue = function (v, result) {       // 'win' | 'loss' | 'draw'
    if (result === 'win') { addCows(v.fee * 2); IG.toast('<b>You take both entry fees</b><span>+' + (v.fee * 2) + ' cows</span>', 'good'); }
    else if (result === 'draw') addCows(v.fee);
    save();
  };

  /* ---- online rating (Elo) -------------------------------------------------- */
  P.applyRating = function (key, oppRating, score) {
    var D = P.data;
    if (D.ratedKeys.indexOf(key) >= 0) return null;
    D.ratedKeys.push(key); if (D.ratedKeys.length > 30) D.ratedKeys.shift();
    var exp = 1 / (1 + Math.pow(10, ((oppRating || 1200) - D.rating) / 400));
    var delta = Math.round(24 * (score - exp));
    D.rating = Math.max(100, D.rating + delta); D.rated++;
    save(); P.publishRow();
    return delta;
  };
  P.publishRow = function () {
    var c = IG.caps; if (!c.db || !c.uid) return;
    try {
      c.db.doc('players/' + c.uid).set({ rating: P.data.rating, games: P.data.rated, wins: P.data.stats.wins, level: P.level().n, t: Date.now() }).catch(function () { });
    } catch (e) { }
  };
  P.leaderboard = function () {
    var c = IG.caps; if (!c.db) return Promise.resolve(null);
    return c.db.collection('players').orderBy('rating', 'desc').limit(20).get().then(function (snap) {
      var rows = snap.docs.map(function (d) { var x = d.data() || {}; return { id: d.id, rating: typeof x.rating === 'number' ? Math.round(x.rating) : 1200, games: typeof x.games === 'number' ? x.games | 0 : 0 }; });
      if (!c.user || !rows.length) return rows;
      return c.user.profiles(rows.map(function (r) { return r.id; })).then(function (ps) {
        rows.forEach(function (r) { var p = ps[r.id]; r.name = (p && p.name) || 'Someone'; r.me = !!(p && p.isMe); r.avatar = p ? p.avatarUrl : ''; });
        return rows;
      });
    }, function () { return null; });
  };

  /* ---- cosmetics ------------------------------------------------------------ */
  P.owns = function (c) { return P.level().n >= c.level; };
  P.wear = function (id) {
    var c = COSMETICS.filter(function (x) { return x.id === id; })[0]; if (!c || !P.owns(c)) return;
    var val = id.split(':')[1], L = P.data.look;
    if (c.kind === 'wood') L.wood = val;
    else if (c.kind === 'seed') L.seed = val;
    else if (c.kind === 'carve') L.carve = !L.carve;
    else if (c.kind === 'bracelet') L.bracelet = L.bracelet === val ? '' : val;
    save(); P.applyLook();
  };
  P.wearing = function (c) {
    var val = c.id.split(':')[1], L = P.data.look;
    return c.kind === 'wood' ? L.wood === val : c.kind === 'seed' ? L.seed === val : c.kind === 'carve' ? L.carve : L.bracelet === val;
  };
  P.applyLook = function (tint) {
    var L = P.data.look;
    IG.view.setLook({ wood: L.wood, seed: L.seed, carve: L.carve, tint: tint || null });
    var seat = IG.game && IG.game.cfg ? IG.game.cfg.bottom : 0;
    IG.view.setBracelet(seat, L.bracelet); IG.view.setBracelet(1 - seat, '');
  };
})();
