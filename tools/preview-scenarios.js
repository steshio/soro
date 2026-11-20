/* Scripted checks for tools/preview.js. Each drives the real page the way a player would. */
'use strict';
const wait = (pg, ms) => pg.waitForTimeout(ms);
const idle = pg => pg.waitForFunction('!window.IG.game.busy', null, { timeout: 300000 });
const G = (pg, expr) => pg.evaluate('(function(){var G=window.IG.game,E=window.IgisoroEngine,V=window.IG.view,L=window.IG.learn,Z=window.IG.puzzle,P=window.IG.progress;return ' + expr + ';})()');

async function humanMove(pg, pit, decision) {
  const sel = pit === undefined ? '.pit.playable' : '#pit-' + (await G(pg, 'G.state.turn')) + '-' + pit;
  await pg.click(sel); await wait(pg, 60);
  await pg.click(pit === undefined ? '.pit.sel' : sel);
  for (let k = 0; k < 6000; k++) {
    await wait(pg, 50);
    if (await pg.isVisible('#prompt')) { await pg.click('#prompt [data-choice="' + (decision || 'ccw') + '"]').catch(() => pg.click('#prompt [data-choice]')); continue; }
    if (!(await G(pg, 'G.busy'))) break;
  }
}
async function consistent(pg, label) {
  const r = await G(pg, '{t:E.totalSeeds(G.state), v:V.counts().map(function(a){return a.join()}).join("|"), s:G.state.pits.map(function(a){return a.join()}).join("|"), dom:[].map.call(document.querySelectorAll(".cnt"),function(c){return c.textContent}).join(",")}');
  const dom = r.s.replace('|', ',');
  const good = r.v === r.s && r.dom === dom;
  console.log('  ' + (good ? 'ok  ' : 'BAD ') + label + ': seeds ' + r.t + ', view ' + (r.v === r.s ? 'matches' : 'DIFFERS') + ', labels ' + (r.dom === dom ? 'match' : 'DIFFER'));
  return good;
}

module.exports = {
  /* a practice game against the computer: moves, a capture, undo, hint, resign */
  async play(b, t) {
    const pg = await t.open(b);
    await pg.click('.tile[data-to="play"]'); await wait(pg, 200);
    await pg.click('[data-act="practice"]'); await wait(pg, 400);
    await pg.evaluate('window.IG.view.setSpeed(40)');
    console.log('  started: mode ' + await G(pg, 'G.cfg.mode') + ', coached ' + await G(pg, 'G.cfg.coached') + ', first ' + await G(pg, 'G.state.turn'));
    let shotHand = false, shotCapture = false, moves = 0, okAll = true;
    for (let k = 0; k < 60 && !(await G(pg, 'G.over')); k++) {
      await pg.waitForFunction('window.IG.game.over || window.IG.game.nudge || (!window.IG.game.busy && window.IG.game.cfg.seats[window.IG.game.state.turn].kind === "human")', null, { timeout: 60000 });
      if (await G(pg, 'G.over')) break;
      if (await G(pg, '!!G.nudge')) { console.log('  coach: ' + await pg.textContent('.notice-coach p')); if (!shotCapture) await t.shot(pg, 'game-coach'); await pg.click('[data-act="nudge-ok"]'); continue; }
      // prefer a capturing move when there is one, so a capture gets animated
      const pick = await G(pg, '(function(){var c=E.enumerate(G.state),b=null;c.forEach(function(m){if(G.whyNot(m.start)===null&&(!b||m.captured>b.captured))b=m;});return b?{start:b.start,cap:b.captured,dec:b.decisions}:null;})()');
      if (!pick) break;
      await pg.click('#pit-0-' + pick.start); await wait(pg, 80);
      if (!shotHand) { await t.shot(pg, 'game-preview'); }
      await pg.click('#pit-0-' + pick.start);
      if (!shotHand) { await pg.evaluate('window.IG.view.setSpeed(1)'); await wait(pg, 1500); await t.shot(pg, 'game-hand'); await pg.evaluate('window.IG.view.setSpeed(40)'); shotHand = true; }
      if (pick.cap && !shotCapture) {
        await pg.evaluate('window.IG.view.setSpeed(1)');
        await pg.waitForFunction('document.querySelector("#fx .fx-cap")', null, { timeout: 30000 }).catch(() => {});
        await wait(pg, 900); await t.shot(pg, 'game-capture'); shotCapture = true;
        await pg.evaluate('window.IG.view.setSpeed(40)');
      }
      for (let i = 0; i < 6000 && await G(pg, 'G.busy && G.cfg.seats[G.state.turn].kind === "human"'); i++) { if (await pg.isVisible('#prompt')) await pg.click('#prompt [data-choice]'); await wait(pg, 50); }
      moves++;
      await pg.waitForFunction('!window.IG.game.busy', null, { timeout: 300000 });
      okAll = (await consistent(pg, 'after move ' + moves + (pick.cap ? ' (captured ' + pick.cap + ')' : ''))) && okAll;
      if (moves === 2) {
        const before = await G(pg, 'G.moves.length');
        await pg.waitForFunction('window.IG.game.nudge || (!window.IG.game.busy && window.IG.game.cfg.seats[window.IG.game.state.turn].kind === "human") || window.IG.game.over', null, { timeout: 60000 });
        if (!(await G(pg, 'G.over'))) {
          if (await G(pg, '!!G.nudge')) await pg.click('[data-act="nudge-ok"]').catch(() => {});
          await pg.waitForFunction('!window.IG.game.busy && window.IG.game.cfg.seats[window.IG.game.state.turn].kind === "human" || window.IG.game.over', null, { timeout: 60000 });
          await pg.click('[data-act="undo"]'); await wait(pg, 300);
          console.log('  undo: moves ' + before + ' -> ' + await G(pg, 'G.moves.length'));
          okAll = (await consistent(pg, 'after undo')) && okAll;
          await pg.click('[data-act="hint"]'); await wait(pg, 1200);
          console.log('  hint: ' + await pg.textContent('#say'));
        }
      }
    }
    console.log('  log: ' + JSON.stringify(await G(pg, 'G.log.slice(-3).map(function(m){return m.text})')));
    console.log('  over ' + await G(pg, 'G.over') + ', winner ' + await G(pg, 'G.state.winner') + ', captured ' + await G(pg, 'G.state.captured.join("/")') + ', moves ' + await G(pg, 'G.moves.length'));
    await t.shot(pg, 'game-end');
    if (!(await G(pg, 'G.over'))) { await pg.click('[data-act="resign"]'); await wait(pg, 300); console.log('  resigned: over ' + await G(pg, 'G.over') + ', ' + await pg.textContent('.result h3')); }
    console.log('  progress: ' + JSON.stringify(await G(pg, '({xp:P.data.xp,cows:P.data.cows,stats:P.data.stats,badges:Object.keys(P.data.badges)})')));
    console.log(okAll && !pg.errors.length ? '  PLAY OK' : '  PLAY HAD PROBLEMS ' + JSON.stringify(pg.errors));
    await pg.close();
  },

  /* every Learn level, played with the recorded answers */
  async learn(b, t) {
    const pg = await t.open(b);
    await pg.click('.nav a[data-to="learn"]'); await wait(pg, 200);
    await t.shot(pg, 'learn-list');
    await pg.evaluate('window.IG.settings.set("speed", 4); window.IG.view.setSpeed(40); window.IG.view.setSpeed = function () {};');
    // level 0
    await pg.click('[data-act="lesson"][data-id="L0"]'); await wait(pg, 2500); await t.shot(pg, 'learn-watch');
    await pg.click('[data-act="watch-end"]'); await wait(pg, 300);
    console.log('  L0 watched: ' + (await pg.textContent('.coach')).slice(0, 60));
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5']) {
      await pg.click('[data-act="lesson"][data-id="' + id + '"]'); await wait(pg, 300);
      const n = await G(pg, 'L.lesson.steps.length');
      for (let s = 0; s < n; s++) {
        const step = await G(pg, '({type:L.step.type,answer:L.step.answer,first:L.step.first,n:L.step.n,dec:L.step.answerDecisions})');
        if (s === 1) await t.shot(pg, 'lesson-' + id);
        if (step.type === 'free') { for (let k = 0; k < step.n; k++) { await humanMove(pg); await idle(pg); } }
        else if (step.type === 'do') {
          if (id === 'L3' || id === 'L5') { // one deliberate mistake to exercise the retry path
            const wrong = await G(pg, '(function(){var r=null;G.legal.forEach(function(m){if(m.start!==L.step.answer&&G.whyNot(m.start)===null)r=m.start;});return r;})()');
            if (wrong !== null) { await humanMove(pg, wrong, 'ccw'); await wait(pg, 1900); console.log('    wrong try -> "' + (await pg.textContent('.feedback')).slice(0, 70) + '"'); }
          }
          await humanMove(pg, step.answer, step.dec ? step.dec[0] : 'ccw'); await idle(pg);
          if (id === 'L3' && s === 2) await t.shot(pg, 'lesson-L3-right');
        }
        else if (step.type === 'two') { await humanMove(pg, step.first); await wait(pg, 900); await idle(pg); await wait(pg, 300); await humanMove(pg, step.answer); await idle(pg); }
        else if (step.type === 'demo') { await pg.waitForFunction('window.IG.learn.canNext', null, { timeout: 30000 }); }
        if (step.type === 'recap') { console.log('  ' + id + ' complete: ' + (await pg.textContent('.recap .muted'))); break; }
        const can = await G(pg, 'L.canNext');
        if (!can) { console.log('  ' + id + ' step ' + (s + 1) + ' (' + step.type + ') NOT SOLVED: ' + (await pg.textContent('.feedback').catch(() => ''))); await t.shot(pg, 'lesson-stuck-' + id + '-' + s); break; }
        await pg.click('[data-act="lesson-next"]'); await wait(pg, 250);
      }
    }
    await t.shot(pg, 'lesson-recap');
    console.log('  lessons done: ' + JSON.stringify(await G(pg, 'Object.keys(P.data.lessons)')) + ', xp ' + await G(pg, 'P.data.xp') + ', rules mode now ' + await pg.evaluate('window.IG.settings.get("rulesMode")'));
    // level 6 opens and starts its game
    await pg.click('[data-act="lesson"][data-id="L6"]'); await wait(pg, 200);
    for (let k = 0; k < 3; k++) { await pg.click('[data-act="lesson-next"]'); await wait(pg, 150); }
    await pg.click('[data-act="lesson-play"]'); await wait(pg, 600);
    console.log('  L6 game: mode ' + await G(pg, 'G.cfg.mode') + ', coached ' + await G(pg, 'G.cfg.coached') + ', reverse ' + await G(pg, 'G.cfg.rules.reverseSowing'));
    await t.shot(pg, 'lesson-L6-game');
    console.log(pg.errors.length ? '  LEARN ERRORS ' + JSON.stringify(pg.errors) : '  LEARN OK');
    await pg.close();
  },

  /* daily puzzle solved with one miss, then pass and play, settings, tilt, dark */
  async more(b, t) {
    let pg = await t.open(b);
    await pg.evaluate('window.IG.settings.set("speed", 4); window.IG.view.setSpeed(40); window.IG.view.setSpeed = function () {};');
    await pg.click('.tile[data-act="daily"]'); await wait(pg, 400);
    const pz = await G(pg, '({kind:Z.cur.kind,need:Z.cur.need,sol:Z.cur.solution})');
    console.log('  daily #' + await G(pg, 'Z.number') + ': ' + pz.kind + ', need ' + pz.need);
    await t.shot(pg, 'puzzle');
    const wrong = await G(pg, '(function(){var r=null;G.legal.forEach(function(m){if(m.start!==Z.cur.solution[0].start)r=m.start;});return r;})()');
    await humanMove(pg, wrong); await wait(pg, 1900);
    console.log('    miss -> "' + await pg.textContent('.feedback') + '"');
    for (const m of pz.sol) { await humanMove(pg, m.start); await wait(pg, 900); await idle(pg); await wait(pg, 200); }
    console.log('    solved ' + await G(pg, 'Z.solved') + ' in ' + await G(pg, 'Z.tries') + ' tries');
    await t.shot(pg, 'puzzle-solved');
    console.log('    share card:\n' + (await pg.textContent('.sharecard')).split('\n').map(l => '      ' + l).join('\n'));
    await pg.click('[data-act="puzzle"][data-v="one"]').catch(() => {}); await wait(pg, 300);
    console.log('    practice puzzle: ' + await G(pg, 'Z.cur && Z.cur.kind'));
    // pass and play
    await pg.click('.brand'); await wait(pg, 200);
    await pg.click('.tile[data-act="local"]'); await wait(pg, 300);
    for (let k = 0; k < 4; k++) { const seat = await G(pg, 'G.state.turn'); const pit = await G(pg, 'G.legal[0].start'); await pg.click('#pit-' + seat + '-' + pit); await wait(pg, 60); await pg.click('#pit-' + seat + '-' + pit); await wait(pg, 300); await idle(pg); }
    console.log('  local: moves ' + await G(pg, 'G.moves.length') + ', turn ' + await G(pg, 'G.state.turn'));
    await consistent(pg, 'local after 4 moves');
    // keyboard: arrows + Enter
    const seat = await G(pg, 'G.state.turn'), kp = await G(pg, 'G.legal[0].start');
    await pg.focus('#pit-' + seat + '-' + kp); await pg.keyboard.press('Enter'); await wait(pg, 80);
    const sel = await G(pg, 'G.selected'); await pg.keyboard.press('Escape'); await wait(pg, 50);
    const sel2 = await G(pg, 'G.selected'); await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); await wait(pg, 300); await idle(pg);
    await pg.keyboard.press('ArrowRight');
    console.log('  keyboard: Enter selects ' + (sel === kp) + ', Escape cancels ' + (sel2 === null) + ', Enter twice plays ' + (await G(pg, 'G.moves.length') === 5) + ', arrow moves focus to ' + await pg.evaluate('document.activeElement.id') + ', label "' + await pg.evaluate('document.activeElement.getAttribute("aria-label")') + '"');
    console.log('  live region: "' + await pg.textContent('#say') + '"');
    await pg.click('#btn-settings'); await wait(pg, 300); await t.shot(pg, 'settings');
    await pg.click('[data-check="tilt"]'); await wait(pg, 200); await pg.click('.dlg-head button'); await wait(pg, 500); await t.shot(pg, 'tilt');
    await pg.click('#btn-settings'); await wait(pg, 200); await pg.click('[data-check="tilt"]'); await pg.click('[data-set="theme"][data-v="dark"]'); await wait(pg, 200); await pg.click('.dlg-head button'); await wait(pg, 400);
    await t.shot(pg, 'game-dark');
    console.log(pg.errors.length ? '  MORE ERRORS ' + JSON.stringify(pg.errors) : '  MORE OK');
    await pg.close();
    // a table game on a phone
    pg = await t.open(b, { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await pg.tap('.nav a[data-to="play"]'); await wait(pg, 300); await t.shot(pg, 'play-phone');
    await pg.evaluate('window.IG.view.setSpeed(40); window.IG.view.setSpeed = function () {};');
    await pg.tap('[data-act="enter"]'); await wait(pg, 600);
    console.log('  table: ' + await G(pg, 'G.cfg.title') + ', counts off ' + await G(pg, 'G.cfg.noCounts') + ', preview off ' + await G(pg, 'G.cfg.noPreview') + ', reverse on ' + await G(pg, 'G.cfg.rules.reverseSowing') + ', cows now ' + await G(pg, 'P.data.cows') + ', badges ' + JSON.stringify(await G(pg, 'Object.keys(P.data.badges)')));
    await pg.waitForFunction('!window.IG.game.busy && window.IG.game.cfg.seats[window.IG.game.state.turn].kind === "human"', null, { timeout: 60000 });
    await pg.tap('.pit.playable'); await wait(pg, 200); await t.shot(pg, 'game-phone');
    const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log('  phone in game: scrollWidth ' + ov.sw + ' clientWidth ' + ov.cw + (pg.errors.length ? ' ERRORS ' + JSON.stringify(pg.errors) : ''));
    await pg.close();
  },

  /* no Three.js at all: the flat fallback must still be playable */
  async flat(b, t) {
    const pg = await t.open(b, { noThree: true });
    console.log('  flat mode: ' + await pg.evaluate('window.IG.view.isFlat()'));
    await pg.click('.tile[data-to="play"]'); await wait(pg, 200);
    await pg.click('[data-act="practice"]'); await wait(pg, 400);
    for (let k = 0; k < 3; k++) {
      await pg.waitForFunction('window.IG.game.over || (!window.IG.game.busy && !window.IG.game.nudge && window.IG.game.cfg.seats[window.IG.game.state.turn].kind === "human") || window.IG.game.nudge', null, { timeout: 60000 });
      if (await G(pg, '!!G.nudge')) { await pg.click('[data-act="nudge-ok"]'); continue; }
      if (await G(pg, 'G.over')) break;
      await pg.click('.pit.playable'); await wait(pg, 60); await pg.click('.pit.sel'); await wait(pg, 400); await idle(pg);
    }
    await consistent(pg, 'flat after moves');
    await t.shot(pg, 'flat');
    console.log(pg.errors.length ? '  FLAT ERRORS ' + JSON.stringify(pg.errors) : '  FLAT OK');
    await pg.close();
  }
};

/* ---------------------------------------------------------------------------
   Online play between two pages, against an in-memory stand-in for the
   claude.ai runtime (db, room, user). This exercises the page's own netcode:
   create, join, live moves, a dropped live event, refresh and resume,
   resign, rematch and ratings. It does not exercise the real platform.
   --------------------------------------------------------------------------- */
function mockRuntime() {
  const docs = new Map(), pages = [], rooms = new Map();
  const merge = (a, b) => { const o = Object.assign({}, a); for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], b[k]) : b[k]; return o; };
  const notify = path => pages.forEach(p => p.pg.evaluate(([path, d]) => window.__dbNotify && window.__dbNotify(path, d), [path, docs.has(path) ? docs.get(path) : null]).catch(() => {}));
  const peersOf = (name, forPeer) => [...(rooms.get(name) || new Map()).entries()].map(([peer, v]) => ({ peer, by: v.uid, isMe: peer === forPeer, sameTab: peer === forPeer, kind: 'viewer', guest: false, presence: v.presence, updatedAt: Date.now() }));
  const pushPeers = name => pages.forEach(p => { if ((rooms.get(name) || new Map()).has(p.peer)) p.pg.evaluate(([n, l]) => window.__roomPeers && window.__roomPeers(n, l), [name, peersOf(name, p.peer)]).catch(() => {}); });
  const state = { dropMoves: 0, docs, leases: new Map() };
  async function attach(pg, uid, name) {
    const peer = 'peer' + pages.length;
    pages.push({ pg, peer, uid });
    await pg.exposeFunction('__rt', async (op, a, b, c) => {
      if (op === 'get') return docs.has(a) ? docs.get(a) : null;
      if (op === 'set') { docs.set(a, JSON.parse(JSON.stringify(b))); notify(a); return true; }
      if (op === 'update') { if (!docs.has(a)) throw new Error('invalid_argument'); docs.set(a, merge(docs.get(a), JSON.parse(JSON.stringify(b)))); notify(a); return true; }
      if (op === 'delete') { docs.delete(a); notify(a); return true; }
      if (op === 'acquire') { const l = state.leases.get(a); if (l && l.until > Date.now() && l.holder !== b) return { acquired: false }; state.leases.set(a, { holder: b, until: Date.now() + 5000 }); return { acquired: true, holder: b }; }
      if (op === 'list') return [...docs.entries()].filter(([k]) => k.startsWith(a + '/') && k.split('/').length === a.split('/').length + 1).map(([k, v]) => ({ id: k.split('/').pop(), data: v }));
      if (op === 'join') { if (!rooms.has(a)) rooms.set(a, new Map()); rooms.get(a).set(peer, { uid, presence: {} }); setTimeout(() => pushPeers(a), 30); return true; }
      if (op === 'leave') { if (rooms.has(a)) rooms.get(a).delete(peer); pushPeers(a); return true; }
      if (op === 'presence') { const r = rooms.get(a); if (r && r.has(peer)) { r.get(peer).presence = merge(r.get(peer).presence, b); pushPeers(a); } return true; }
      if (op === 'emit') {
        if (b === 'move' && state.dropMoves > 0) { state.dropMoves--; return true; }       // a lost live event
        pages.forEach(p => { if ((rooms.get(a) || new Map()).has(p.peer)) p.pg.evaluate(([n, t, d, me, by]) => window.__roomEvent && window.__roomEvent(n, t, d, me, by), [a, b, c, p.peer === peer, uid]).catch(() => {}); });
        return true;
      }
    });
    await pg.addInitScript(([uid, name]) => {
      const snaps = {}, rooms = {};
      const snapOf = (path, d) => ({ id: path.split('/').pop(), exists: d !== null && d !== undefined, data: () => (d === null ? undefined : JSON.parse(JSON.stringify(d))), metadata: { fromCache: false, hasPendingWrites: false } });
      window.__dbNotify = (path, d) => (snaps[path] || []).forEach(fn => fn(snapOf(path, d)));
      window.__roomEvent = (n, topic, data, isMe, by) => ((rooms[n] || {}).on || []).forEach(h => { if (h.topic === topic) h.fn({ topic, data, isMe, sameTab: isMe, by, peer: by, kind: 'viewer', guest: false }); });
      window.__roomPeers = (n, list) => ((rooms[n] || {}).peers || []).forEach(fn => fn({ peers: list, joined: [], left: [], updated: [] }));
      const doc = path => ({ id: path.split('/').pop(), path,
        get: () => window.__rt('get', path).then(d => snapOf(path, d)),
        set: d => window.__rt('set', path, d).then(() => {}),
        update: d => window.__rt('update', path, d).then(() => {}, () => Promise.reject({ code: 'invalid_argument', message: 'missing' })),
        delete: () => window.__rt('delete', path).then(() => {}),
        acquire: o => window.__rt('acquire', path, o.holder),
        onSnapshot: (next) => { (snaps[path] = snaps[path] || []).push(next); window.__rt('get', path).then(d => next(snapOf(path, d))); return () => { snaps[path] = (snaps[path] || []).filter(f => f !== next); }; } });
      const coll = path => { const q = { _o: null, _l: 1000, orderBy(f, d) { q._o = [f, d]; return q; }, limit(n) { q._l = n; return q; }, where() { return q; }, doc: id => doc(path + '/' + id),
        get: () => window.__rt('list', path).then(rows => { if (q._o) rows.sort((a, b) => (q._o[1] === 'desc' ? -1 : 1) * ((a.data[q._o[0]] || 0) - (b.data[q._o[0]] || 0))); rows = rows.slice(0, q._l); return { docs: rows.map(r => snapOf(path + '/' + r.id, r.data)), size: rows.length, empty: !rows.length }; }) }; return q; };
      const NAMES = { u_host: 'Aline', u_guest: 'Bosco' };
      const caps = {
        db: { doc, collection: coll },
        room: { join: n => window.__rt('join', n).then(() => { rooms[n] = { on: [], peers: [] }; return { name: n,
          emit: (t, d) => window.__rt('emit', n, t, d).then(() => {}), on: (t, fn) => { rooms[n].on.push({ topic: t, fn }); return () => { rooms[n].on = rooms[n].on.filter(h => h.fn !== fn); }; },
          presence: p => window.__rt('presence', n, p).then(() => {}), onPeers: fn => { rooms[n].peers.push(fn); return () => {}; }, peers: () => [], connected: () => true, leave: () => window.__rt('leave', n) }; }) },
        user: { id: async () => uid, can: async () => true, isOwner: async () => uid === 'u_host', canEdit: async () => uid === 'u_host',
          profiles: async ids => { const o = {}; [].concat(ids).forEach(i => { o[i] = { id: i, name: NAMES[i] || '', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=', color: '#888', email: null, isMe: i === uid, guest: false }; }); return o; } }
      };
      window.claude = { use: async n => caps[n] || null };
    }, [uid, name]);
  }
  return { attach, state };
}

module.exports.online = async function (b, t) {
  const rt = mockRuntime();
  const mk = async (uid, hash) => { const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } }); const raw = await ctx.newPage(); await rt.attach(raw, uid); return raw; };
  // t.open builds its own page; reuse its routing by opening through it with an init hook
  const openWith = async (uid, hash) => t.open(b, { viewport: { width: 1100, height: 760 }, hash: hash || '', before: pg => rt.attach(pg, uid) });
  const A = await openWith('u_host'), B = await openWith('u_guest');
  for (const pg of [A, B]) await pg.evaluate('window.IG.view.setSpeed(40); window.IG.view.setSpeed = function () {};');
  const N = (pg, e) => pg.evaluate('(function(){var N=window.IG.net,G=window.IG.game,E=window.IgisoroEngine,P=window.IG.progress;return ' + e + ';})()');
  await A.click('.tile[data-to="online"]'); await wait(A, 300);
  console.log('  host lobby: phase ' + await N(A, 'N.phase'));
  await A.click('[data-act="net-create"]'); await A.waitForFunction('window.IG.net.phase === "waiting" && window.IG.net.code', null, { timeout: 10000 });
  const code = await N(A, 'N.code');
  console.log('  table opened: code ' + code.toUpperCase() + ', hash ' + await A.evaluate('location.hash') + ', invite: ' + JSON.stringify(await N(A, 'N.inviteText()')));
  await t.shot(A, 'online-waiting');
  await B.click('.tile[data-to="online"]'); await wait(B, 300);
  await B.fill('#join-code', 'zzzzz'); await B.click('#join-form button'); await wait(B, 400);
  console.log('  wrong code -> "' + await B.textContent('.notice-warn p') + '"');
  await B.fill('#join-code', code.toUpperCase()); await B.click('#join-form button');
  await A.waitForFunction('window.IG.net.phase === "playing" && window.IG.game.cfg && window.IG.game.cfg.mode === "online"', null, { timeout: 15000 });
  await B.waitForFunction('window.IG.net.phase === "playing" && window.IG.game.cfg && window.IG.game.cfg.mode === "online"', null, { timeout: 15000 });
  await wait(A, 600);
  console.log('  joined: host seat ' + await N(A, 'N.seat') + ' (bottom ' + await N(A, 'G.cfg.bottom') + '), guest seat ' + await N(B, 'N.seat') + ' (bottom ' + await N(B, 'G.cfg.bottom') + ', flipped ' + await B.evaluate('window.IG.view.isFlipped()') + '), first to move ' + await N(A, 'G.state.turn'));
  console.log('  names: host sees "' + await N(A, 'G.cfg.seats[1].name') + '", guest sees "' + await N(B, 'G.cfg.seats[0].name') + '"');
  const pages = [A, B];
  const sync = async label => {
    for (let k = 0; k < 400; k++) { const [a, c] = await Promise.all(pages.map(p => N(p, 'G.busy ? "busy" : E.hash(G.state)'))); if (a !== 'busy' && a === c) { return true; } await wait(A, 100); }
    const [a, c] = await Promise.all(pages.map(p => N(p, 'E.hash(G.state)'))); console.log('  DESYNC ' + label + '\n    A ' + a + '\n    B ' + c); return false;
  };
  const playOne = async () => {
    const turn = await N(A, 'G.state.turn'), pg = pages[turn];
    await pg.waitForFunction('!window.IG.game.busy', null, { timeout: 120000 });
    const pit = await N(pg, 'G.legal[Math.floor(G.legal.length / 2)].start');
    await pg.click('#pit-' + turn + '-' + pit); await wait(pg, 50); await pg.click('#pit-' + turn + '-' + pit);
    for (let k = 0; k < 2000; k++) { await wait(pg, 50); if (await pg.isVisible('#prompt')) await pg.click('#prompt [data-choice]'); if (!(await N(pg, 'G.busy'))) break; }
  };
  let good = true;
  for (let k = 0; k < 4; k++) { await playOne(); good = (await sync('after move ' + (k + 1))) && good; }
  console.log('  4 live moves: both boards agree ' + good + ', stored moves ' + rt.state.docs.get('tables/' + code).moves.length);
  await t.shot(B, 'online-guest');
  rt.state.dropMoves = 1;                                   // lose one live event: the stored record must cover it
  await playOne(); good = (await sync('after a dropped live event')) && good;
  console.log('  dropped live event recovered from the stored record: ' + good);
  // the guest refreshes mid-game and resumes from the table code in the link
  const B2 = await openWith('u_guest', '#t-' + code);
  await B2.evaluate('window.IG.view.setSpeed(40); window.IG.view.setSpeed = function () {};');
  await B2.waitForFunction('window.IG.net.phase === "playing" && window.IG.game.cfg && window.IG.game.cfg.mode === "online" && window.IG.game.moves.length === 5 && !window.IG.game.busy', null, { timeout: 20000 });
  await B.close(); pages[1] = B2;
  console.log('  guest reopened by link: resumed at move ' + await N(B2, 'G.moves.length') + ', boards agree ' + await sync('after resume'));
  await playOne(); good = (await sync('after resume + move')) && good;
  // an illegal move injected through the room must be refused
  await B2.evaluate('window.IG.net.room.emit("move", { g: window.IG.net.gameNo, seq: window.IG.game.moves.length, move: { s: 99, d: [] }, hashAfter: "x" })'); await wait(A, 400);
  console.log('  forged move ignored: host still at move ' + await N(A, 'G.moves.length') + ', in sync ' + await sync('after forged move'));
  // resign, result, rating, rematch
  const turn = await N(A, 'G.state.turn');
  await pages[turn].click('[data-act="resign"]'); await wait(pages[turn], 200); await pages[turn].click('[data-act="confirm-yes"]');
  await pages[1 - turn].waitForFunction('window.IG.game.over', null, { timeout: 15000 }); await wait(A, 600);
  console.log('  resign: ' + ['host', 'guest'][turn] + ' resigned; host sees "' + await A.textContent('.result h3') + '", guest sees "' + await pages[1].textContent('.result h3') + '"; score ' + JSON.stringify(rt.state.docs.get('tables/' + code).score));
  console.log('  ratings: host ' + await N(A, 'P.data.rating') + ', guest ' + await N(pages[1], 'P.data.rating') + '; shared rows ' + JSON.stringify([...rt.state.docs.entries()].filter(([k]) => k.startsWith('players/')).map(([k, v]) => [k, v.rating])));
  await t.shot(A, 'online-result');
  await A.click('[data-act="net-rematch"]'); await wait(A, 300);
  console.log('  rematch asked: guest sees "' + (await pages[1].textContent('[data-act="net-rematch"]')) + '"');
  await pages[1].click('[data-act="net-rematch"]');
  await A.waitForFunction('window.IG.net.gameNo === 2 && !window.IG.game.over', null, { timeout: 15000 });
  await pages[1].waitForFunction('window.IG.net.gameNo === 2 && !window.IG.game.over', null, { timeout: 15000 });
  console.log('  rematch: game 2 started, first to move seat ' + await N(A, 'G.state.turn') + ' (winner of game 1 was seat ' + (1 - turn) + ')');
  await playOne(); good = (await sync('game 2 move 1')) && good;
  const keys = [...rt.state.docs.keys()];
  console.log('  stored documents: ' + JSON.stringify(keys));
  const errs = A.errors.concat(pages[1].errors);
  console.log(good && !errs.length ? '  ONLINE OK' : '  ONLINE HAD PROBLEMS ' + JSON.stringify(errs));
};

/* the full-screen toggle: enter, play a move, the coach note inside the stage, leave by button and by Escape */
module.exports.full = async function (b, t) {
  for (const vp of [{ name: 'desktop', o: {} }, { name: 'phone', o: { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }]) {
    const pg = await t.open(b, vp.o);
    await pg.evaluate('window.IG.view.setSpeed(40); window.IG.view.setSpeed = function () {};');
    await pg.click('.nav a[data-to="play"]'); await wait(pg, 200);
    console.log('  ' + vp.name + ': toggle offered in the menus: ' + await pg.isVisible('[data-act="full"]'));
    await pg.click('[data-act="practice"]'); await wait(pg, 500);
    const before = await pg.evaluate('document.querySelector("#board").getBoundingClientRect().width');
    await pg.click('[data-act="full"]'); await wait(pg, 600);
    const st = await pg.evaluate('({ full: window.IG.ui.full, cls: document.querySelector("#stage").classList.contains("full"), real: !!document.fullscreenElement, w: document.querySelector("#board").getBoundingClientRect().width, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, label: document.querySelector(\'[data-act="full"]\').textContent, panelCovered: document.elementFromPoint(innerWidth - 20, innerHeight / 2).closest("#stage") !== null })');
    console.log('  ' + vp.name + ': full ' + st.full + ', real full screen ' + st.real + ', board ' + Math.round(before) + ' -> ' + Math.round(st.w) + ' px in a ' + st.vw + 'x' + st.vh + ' view, covers the panel ' + st.panelCovered + ', button "' + st.label + '"');
    await pg.waitForFunction('window.IG.game.nudge || (!window.IG.game.busy && window.IG.game.cfg.seats[window.IG.game.state.turn].kind === "human")', null, { timeout: 120000 });
    await pg.click('.pit.playable'); await wait(pg, 80);
    await t.shot(pg, 'full-' + vp.name);
    await pg.click('.pit.sel'); await wait(pg, 300);
    await pg.waitForFunction('!window.IG.game.busy || window.IG.game.nudge', null, { timeout: 300000 });
    console.log('  ' + vp.name + ': played in full screen, moves ' + await G(pg, 'G.moves.length') + ', seeds ' + await G(pg, 'E.totalSeeds(G.state)'));
    // a coach nudge must be answerable without leaving full screen
    await pg.evaluate('window.IG.game.nudge = { text: "Test note." }; window.IG.bus.emit("game:update")'); await wait(pg, 100);
    console.log('  ' + vp.name + ': coach note inside the stage: ' + await pg.isVisible('#stage-note .notice-coach'));
    await pg.click('#stage-note [data-act="nudge-ok"]'); await wait(pg, 200);
    await pg.click('[data-act="full"]'); await wait(pg, 400);
    const out1 = await pg.evaluate('({ full: window.IG.ui.full, cls: document.querySelector("#stage").classList.contains("full"), toasts: document.querySelector("#toasts").parentNode === document.body })');
    await pg.click('[data-act="full"]'); await wait(pg, 400);
    await pg.keyboard.press('Escape'); await wait(pg, 400);
    const out2 = await pg.evaluate('({ full: window.IG.ui.full, cls: document.querySelector("#stage").classList.contains("full") })');
    console.log('  ' + vp.name + ': button exits ' + (!out1.full && !out1.cls && out1.toasts) + ', Escape exits ' + (!out2.full && !out2.cls));
    if (!(await pg.evaluate('window.IG.ui.full'))) { await pg.click('[data-act="full"]'); await wait(pg, 300); }
    await pg.click('[data-act="resign"]'); await wait(pg, 400);
    console.log('  ' + vp.name + ': result shown in full screen: ' + await pg.isVisible('#stage-note [data-act="rematch"]') + ' ("' + (await pg.textContent('#stage-note .notice b')) + '")');
    await pg.click('#stage-note [data-act="full"]'); await wait(pg, 300);
    console.log('  ' + vp.name + ': back to the page: ' + !(await pg.evaluate('window.IG.ui.full')) + (pg.errors.length ? ' ERRORS ' + JSON.stringify(pg.errors) : ', no errors'));
    await pg.close();
  }
};

/* ---------------------------------------------------------------------------
   Hand motion, measured on a fake clock so the result does not depend on how
   fast this machine renders. Plays a relay that ends in a capture at 1x and
   samples the hand every frame. With MOTION_VIDEO=1 it also writes one
   screenshot per 1/30 s to .preview/motion/ for tools/motion-video.sh.
   --------------------------------------------------------------------------- */
module.exports.motion = async function (b, t) {
  const fs = require('fs'), path = require('path');
  const video = process.env.MOTION_VIDEO === '1';
  const dir = path.join(t.out, 'motion');
  if (video) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
  const pg = await t.open(b, { viewport: { width: 1000, height: 760 }, before: p => p.clock.install() });
  // a position with a relay that ends in a capture, then cows sown from the relay pit
  await pg.evaluate(() => {
    const E = window.IgisoroEngine, my = new Array(16).fill(0), op = new Array(16).fill(0);
    Object.assign(my, { 4: 2, 6: 4, 11: 1, 1: 3, 13: 2 }); Object.assign(op, { 12: 3, 3: 2, 9: 2, 6: 1, 0: 4, 14: 3 });
    let rest = 64 - my.reduce((a, c) => a + c, 0) - op.reduce((a, c) => a + c, 0); op[15] += rest;
    window.IG.ui.mode = 'game'; document.body.dataset.mode = 'game';
    window.IG.game.start({ mode: 'local', rules: E.makeRules({ reverseSowing: false }), first: 0, ply: 2, pits: [my, op], bottom: 0,
      seats: [{ kind: 'human', name: 'Bottom' }, { kind: 'human', name: 'Top' }], labels: ['Bottom', 'Top'] });
    window.IG.view.setSpeed(1);
    // a seed leaves the hand when the held count goes down
    window.__drops = []; let held = 0;
    const sh = window.IG.board.setHeld;
    window.IG.board.setHeld = function (seat, n) { if (seat === 0 && n < held) window.__drops.push({ t: performance.now(), p: 0, n: 1 }); held = n; return sh.apply(this, arguments); };
  });
  await pg.clock.runFor(1500);
  await pg.clock.pauseAt(Date.now() + 60000);
  await pg.evaluate(() => { window.__t0 = performance.now(); window.__drops = []; window.__done = false; window.IG.game.perform({ start: 4, decisions: [] }).then(() => { window.__done = true; }); });
  const samples = [];
  let frame = 0;
  for (let k = 0; k < 1200; k++) {
    await pg.clock.runFor(video ? 33 : 16);
    const s = await pg.evaluate('(function(){var h=window.IG.view.handState(0);return {t:performance.now()-window.__t0,x:h.x,y:h.y,z:h.z,held:h.held,busy:h.busy,done:window.__done}})()');
    samples.push(s);
    if (video) await pg.locator('#board').screenshot({ path: path.join(dir, String(frame++).padStart(4, '0') + '.png') });
    if (s.done && !s.busy && k > 10 && Math.abs(s.z - 4.9) < 0.05) break;
  }
  // the moments seeds leave the hand
  const drops = await pg.evaluate('window.__drops.map(function(d){return {t:d.t-window.__t0,p:d.p,n:d.n}})');
  // per-frame movement in the board plane
  let maxStep = 0, stops = 0;
  const v = [];
  for (let k = 1; k < samples.length; k++) {
    const a = samples[k - 1], c = samples[k], d = Math.hypot(c.x - a.x, c.z - a.z), dt = c.t - a.t;
    maxStep = Math.max(maxStep, d); v.push({ t: c.t, speed: d / dt * 1000 });
  }
  // a stop while sowing = a frame inside a lap where the hand does not move between two drops into consecutive pits
  const laps = [];
  let cur = [drops[0]];
  for (let k = 1; k < drops.length; k++) { if (drops[k].t - drops[k - 1].t > 520) { laps.push(cur); cur = []; } cur.push(drops[k]); }
  laps.push(cur);
  const gaps = [];
  for (const lap of laps) for (let k = 1; k < lap.length; k++) {
    gaps.push(lap[k].t - lap[k - 1].t);
    stops += v.filter(x => x.t > lap[k - 1].t + 20 && x.t < lap[k].t - 20 && x.speed < 0.05).length;
  }
  const mean = gaps.reduce((a, c) => a + c, 0) / gaps.length, sd = Math.sqrt(gaps.reduce((a, c) => a + (c - mean) * (c - mean), 0) / gaps.length);
  const total = samples[samples.length - 1].t;
  console.log('  move: relay, capture, cows sown from the relay pit, relay, end');
  console.log('  seeds released: ' + drops.length + ' in ' + laps.length + ' laps (' + laps.map(l => l.length).join(', ') + ')');
  console.log('  seed-to-seed within a lap at 1x: mean ' + Math.round(mean) + ' ms, spread ' + Math.round(sd) + ' ms, min ' + Math.round(Math.min(...gaps)) + ', max ' + Math.round(Math.max(...gaps)));
  console.log('  frames where the hand stood still mid-lap: ' + stops);
  console.log('  largest movement in one frame: ' + maxStep.toFixed(3) + ' board units (a pit is 1 unit)');
  console.log('  whole move, reach to rest: ' + (total / 1000).toFixed(1) + ' s over ' + samples.length + ' frames');
  console.log('  board agrees with the engine: ' + await pg.evaluate('window.IG.view.counts().map(function(a){return a.join()}).join("|") === window.IG.game.state.pits.map(function(a){return a.join()}).join("|")'));
  if (video) console.log('  wrote ' + frame + ' frames to ' + dir);
  console.log(pg.errors.length ? '  MOTION ERRORS ' + JSON.stringify(pg.errors) : '  MOTION OK');
  await pg.close();
};
