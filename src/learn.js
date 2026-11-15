/* ==========================================================================
   LEARN PATH AND PUZZLES
   IG.learn runs a lesson step by step on the real board with the real engine.
   IG.puzzle runs generated puzzles, including the daily one.
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG, E = window.IgisoroEngine, U = IG.util, G = IG.game, B = IG.board, V = IG.view;
  var LD = window.IgisoroLessons, PZ = window.IgisoroPuzzles;

  function fmt(text, info) {
    return String(text || '').replace(/\{(\w+)\}/g, function (m, k) { return info && info[k] !== undefined ? info[k] : m; });
  }
  function veil(on) { U.$('#veil').hidden = !on; }

  /* ========================================================================
     LESSONS
     ======================================================================== */
  var L = IG.learn = { lesson: null, idx: 0, step: null, msg: '', status: null, tries: 0, count: 0, phase: 0, canNext: false, watching: false, timer: null };

  L.list = function () { return LD.LESSONS; };
  L.nextUp = function () {
    var done = IG.progress.data.lessons;
    for (var k = 0; k < LD.LESSONS.length; k++) if (!done[LD.LESSONS[k].id]) return LD.LESSONS[k];
    return null;
  };

  function setup(step, interactive) {
    var les = L.lesson, pos = step.pos || { my: 'std', op: 'std' };
    G.start({
      mode: 'lesson', solo: true, soloSeat: 0, rules: E.makeRules(les.rules), first: 0,
      pits: [LD.toPits(pos.my), LD.toPits(pos.op)], ply: les.rules.openingNoCaptureMoves ? 0 : 2,
      seats: [{ kind: interactive ? 'human' : 'none', name: 'You' }, { kind: 'none', name: 'Your opponent' }],
      labels: ['Your', 'Opponent’s'], bottom: 0, title: les.title,
      hooks: {
        filterStart: step.only ? function (seat, i) { return step.only.indexOf(i) >= 0 ? null : 'For this step, use the glowing pit.'; } : null,
        onMove: onMove
      }
    });
    B.setGlow((step.glow || []).map(function (i) { return [0, i]; }));
    B.setMarks(step.marks || [], step.markKind || 'warn');
    veil(!!les.veil);
  }
  function lock(on) { if (G.cfg && G.cfg.mode === 'lesson') { G.cfg.seats[0].kind = on ? 'none' : 'human'; B.refresh(); } }
  function redraw() { IG.bus.emit('panel'); }

  L.open = function (id) {
    var les = LD.LESSONS.filter(function (x) { return x.id === id; })[0]; if (!les) return;
    clearTimeout(L.timer);
    L.lesson = les; L.idx = 0; L.step = null; L.watching = false;
    IG.ui.mode = 'lesson'; IG.ui.confirm = null; document.body.dataset.mode = 'lesson';
    if (les.kind === 'watch') return L.watch();
    enter();
  };

  function enter() {
    var step = L.step = L.lesson.steps[L.idx];
    clearTimeout(L.timer);
    L.msg = ''; L.status = null; L.tries = 0; L.count = 0; L.phase = 0; L.canNext = false; L.showAnswer = false;
    switch (step.type) {
      case 'say':
        if (step.pos || L.idx === 0 || !G.cfg || G.cfg.mode !== 'lesson') setup(step, false); else { lock(true); B.setGlow([]); B.setMarks(step.marks || [], step.markKind || 'warn'); }
        L.canNext = true; break;
      case 'free': case 'do': case 'two':
        setup(step, true); break;
      case 'demo':
        setup(step, false);
        L.timer = setTimeout(function () {
          G.perform(step.move, 0).then(function () { if (L.step === step) { L.msg = step.after || ''; L.status = 'note'; L.canNext = true; redraw(); } });
        }, 900);
        break;
      case 'play':
        L.canNext = false; break;
      case 'recap':
        veil(false); B.setGlow([]); B.setMarks([]);
        if (G.cfg && G.cfg.mode === 'lesson') lock(true);
        L.gained = IG.progress.data.lessons[L.lesson.id] ? 5 : 40;
        IG.progress.event('lesson', { id: L.lesson.id });
        IG.audio.good();
        if (L.lesson.id === 'L5' && IG.settings.get('rulesMode') === 'learn') {
          IG.settings.set('rulesMode', 'traditional');
          IG.toast('<b>Rules mode: Traditional</b><span>Guteba and kugarama are now on in your games. Change it in Settings.</span>');
        }
        break;
    }
    redraw();
  }

  function onMove(info) {
    var step = L.step; if (!step) return;
    if (step.type === 'free') {
      L.count++;
      if (L.count >= step.n) { L.status = 'right'; L.msg = step.done; L.canNext = true; lock(true); IG.audio.good(); }
      else { L.status = 'note'; L.msg = step.each + ' ' + L.count + ' of ' + step.n + '.'; }
      if (!G.legal.length && L.count < step.n) setTimeout(function () { if (L.step === step) setup(step, true); }, 600);
      redraw(); return;
    }
    if (step.type === 'two') {
      if (info.seat === 1) { L.msg = step.mid; L.status = 'note'; lock(false); redraw(); return; }
      if (L.phase === 0) {
        if (info.move.start === step.first) {
          L.phase = 1; lock(true); L.msg = ''; redraw();
          L.timer = setTimeout(function () { if (L.step === step) G.perform(step.reply, 1); }, 700);
        } else fail(step, step.wrongFirst, info);
        return;
      }
      if (LD.checkGoal(step.goal, info, E)) pass(step, info); else { L.phase = 0; fail(step, step.wrong, info); }
      return;
    }
    if (step.type === 'do') {
      if (LD.checkGoal(step.goal, info, E)) pass(step, info); else fail(step, step.wrong, info);
    }
  }
  function pass(step, info) {
    L.status = 'right'; L.msg = fmt(step.right, info); L.canNext = true; lock(true); B.setGlow([]); B.setMarks([]);
    IG.audio.good(); redraw();
  }
  function fail(step, text, info) {
    L.tries++; L.status = 'wrong'; L.msg = fmt(text, info); lock(true); IG.audio.bad(); redraw();
    L.timer = setTimeout(function () {
      if (L.step !== step) return;
      var keep = { msg: L.msg, status: L.status, tries: L.tries, show: L.showAnswer };
      setup(step, true);
      L.msg = keep.msg; L.status = keep.status; L.tries = keep.tries; L.phase = 0;
      if (keep.show) B.setGlow([[0, step.type === 'two' ? step.first : step.answer]]);
      redraw();
    }, 1500);
  }

  L.next = function () {
    if (!L.lesson) return;
    if (L.idx + 1 < L.lesson.steps.length) { L.idx++; enter(); }
  };
  L.showMe = function () {
    var step = L.step; if (!step) return;
    L.showAnswer = true;
    B.setGlow([[0, step.type === 'two' && L.phase === 0 ? step.first : step.answer]]);
    L.msg = 'The glowing pit is the one.' + (step.answerDecisions ? ' Choose ' + (step.answerDecisions[0] === 'cw' ? (E.reverseKind(G.cfg.rules, step.answer) || 'the clockwise way') : 'the normal way') + ' when asked.' : '');
    L.status = 'note'; redraw();
  };
  L.exit = function () {
    clearTimeout(L.timer);
    if (L.watching) { V.setSpeed(IG.settings.get('speed')); L.watching = false; }
    L.lesson = null; L.step = null; veil(false);
    G.stop(); B.setGlow([]); B.setMarks([]);
  };

  /* Level 6 ends with a real, coached game */
  L.startPlay = function () {
    var step = L.step, les = L.lesson;
    veil(false);
    IG.ui.startGame({ kind: 'practice', level: 'beginner', rules: E.makeRules(les.rules), lesson: true, onEnd: function () {
      if (L.lesson === les && L.step === step) { L.canNext = true; L.msg = 'That was a full game.'; L.status = 'note'; redraw(); }
    } });
  };

  /* Level 0: a short, fast game between two computer hands, no explanation */
  L.watch = function () {
    L.watching = true; L.watchDone = false; veil(false);
    V.setSpeed(Math.max(4, IG.settings.get('speed')));
    var ai = { depth: 2, time: 150, blunder: 0.12, noise: 9 };
    function begin() {
      G.start({ mode: 'demo', rules: E.makeRules({ reverseSowing: false }), first: Math.random() < 0.5 ? 0 : 1, bottom: 0,
        seats: [{ kind: 'ai', name: 'Bottom', ai: ai }, { kind: 'ai', name: 'Top', ai: ai }], labels: ['Bottom', 'Top'],
        hooks: { onEnd: function () { if (L.watching && !L.watchDone) L.timer2 = setTimeout(function () { if (L.watching && !L.watchDone) begin(); }, 1200); } } });
    }
    begin();
    clearTimeout(L.timer);
    L.timer = setTimeout(L.endWatch, 30000);
    redraw();
  };
  L.endWatch = function () {
    if (!L.watching || L.watchDone) return;
    clearTimeout(L.timer); clearTimeout(L.timer2);
    L.watchDone = true;
    G.stop();
    V.setSpeed(IG.settings.get('speed'));
    if (!IG.progress.data.lessons.L0) IG.progress.event('lesson', { id: 'L0' });
    redraw();
  };

  /* ========================================================================
     PUZZLES
     ======================================================================== */
  var Z = IG.puzzle = { cur: null, tries: 0, phase: 0, solved: false, daily: false, number: 0, msg: '', status: null, capturedPits: [], timer: null };

  /* the opponent pits the solution takes, for the share card */
  function solutionCaptures(p) {
    var out = [], log = console.log; console.log = function () {};
    try {
      var s = E.newGame(E.makeRules({ reverseSowing: false }), { pits: p.pits, first: 0, ply: p.ply });
      if (p.kind === 'two') { s = E.applyMove(s, p.solution[0]).state; s = E.applyMove(s, PZ.replyTo(s)).state; }
      E.applyMove(s, p.solution[p.solution.length - 1]).events.forEach(function (e) { if (e.t === 'capture') out.push(e.a, e.b); });
    } catch (e) { } finally { console.log = log; }
    return out;
  }

  Z.open = function (what) {
    clearTimeout(Z.timer);
    var log = console.log; console.log = function () {};
    try {
      if (what === 'daily') { Z.daily = true; Z.number = U.dailyNumber(); Z.cur = PZ.daily(Z.number); }
      else { Z.daily = false; Z.number = 0; Z.cur = PZ.generate(Math.floor(Math.random() * 1e9), what === 'two' ? 'two' : 'one'); }
    } finally { console.log = log; }
    Z.tries = 0; Z.solved = false; Z.msg = ''; Z.status = null; Z.capturedPits = [];
    if (Z.daily && Z.cur && IG.progress.data.daily[Z.number]) {
      Z.solved = true; Z.replay = true; Z.tries = IG.progress.data.daily[Z.number]; Z.status = 'right';
      Z.msg = 'You solved today’s puzzle in ' + U.plural(Z.tries, 'try', 'tries') + '.';
      Z.capturedPits = solutionCaptures(Z.cur);
    } else Z.replay = false;
    IG.ui.setMode('puzzle');
    if (!Z.cur) { Z.msg = 'No puzzle could be made just now. Try another.'; IG.bus.emit('panel'); return; }
    Z.reset();
  };
  Z.reset = function () {
    var p = Z.cur; Z.phase = 0;
    G.start({ mode: 'puzzle', solo: true, soloSeat: 0, rules: E.makeRules({ reverseSowing: false }), first: 0, pits: p.pits, ply: p.ply, bottom: 0,
      seats: [{ kind: Z.solved ? 'none' : 'human', name: 'You' }, { kind: 'none', name: 'Your opponent' }], labels: ['Your', 'Opponent’s'],
      hooks: { onMove: Z.onMove } });
    veil(false);
    IG.bus.emit('panel');
  };
  function zlock(on) { if (G.cfg && G.cfg.mode === 'puzzle') { G.cfg.seats[0].kind = on ? 'none' : 'human'; B.refresh(); } }
  Z.onMove = function (info) {
    var p = Z.cur;
    if (info.seat === 1) { Z.msg = 'Your opponent has answered. Now take the cows.'; Z.status = 'note'; zlock(false); IG.bus.emit('panel'); return; }
    if (p.kind === 'two' && Z.phase === 0) {
      var rep = null, log = console.log; console.log = function () {};
      try { rep = info.after.winner === null ? PZ.replyTo(info.after) : null; } finally { console.log = log; }
      if (!rep) return Z.miss('That is not the line. Start again.');
      Z.phase = 1; zlock(true); Z.msg = ''; IG.bus.emit('panel');
      Z.timer = setTimeout(function () { if (Z.cur === p && !Z.solved) G.perform(rep, 1); }, 650);
      return;
    }
    if (info.captured >= p.need) {
      Z.solved = true; Z.tries++; Z.status = 'right'; zlock(true);
      Z.capturedPits = [];
      info.events.forEach(function (e) { if (e.t === 'capture') { Z.capturedPits.push(e.a, e.b); } });
      Z.msg = 'Solved in ' + U.plural(Z.tries, 'try', 'tries') + '. ' + U.plural(info.captured, 'cow') + ' captured.';
      IG.audio.good();
      IG.progress.event('puzzle', { daily: Z.daily && !Z.replay, number: Z.number, tries: Z.tries });
      IG.bus.emit('panel');
    } else {
      Z.miss(p.kind === 'one' ? (info.captured ? 'That took ' + info.captured + '. One move takes ' + p.need + '.' : 'No capture there. One move takes ' + p.need + ' cows.')
        : 'That line wins fewer than ' + p.need + ' cows. Start again.');
    }
  };
  Z.miss = function (text) {
    var p = Z.cur;
    Z.tries++; Z.msg = text; Z.status = 'wrong'; zlock(true); IG.audio.bad(); IG.bus.emit('panel');
    Z.timer = setTimeout(function () { if (Z.cur === p && !Z.solved) { var keep = Z.msg; Z.reset(); Z.msg = keep; Z.status = 'wrong'; IG.bus.emit('panel'); } }, 1500);
  };
  Z.showSolution = function () {
    var p = Z.cur; if (!p) return;
    B.setGlow([[0, p.solution[Z.phase === 1 ? 1 : 0].start]]);
  };
  Z.shareText = function () {
    var lines = ['Igisoro daily #' + Z.number, 'Solved in ' + U.plural(Z.tries, 'try', 'tries'), PZ.shareGrid(Z.cur, Z.capturedPits)];
    if (IG.ARTIFACT_URL) lines.push(IG.ARTIFACT_URL + '#puzzles');
    return lines.join('\n');
  };
  Z.exit = function () { clearTimeout(Z.timer); Z.cur = null; G.stop(); B.setGlow([]); };
})();
