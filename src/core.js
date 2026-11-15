/* ==========================================================================
   CORE: small utilities, settings, capability access, AI worker bridge
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG = window.IG || {};
  var E = window.IgisoroEngine;

  /* The published artifact's own link, used in invitations. Filled at build time. */
  IG.ARTIFACT_URL = '%%ARTIFACT_URL%%';
  if (IG.ARTIFACT_URL.indexOf('%%') === 0) IG.ARTIFACT_URL = '';
  IG.LAUNCH_DAY = '2026-11-15';        // daily puzzle #1

  /* ---- utilities --------------------------------------------------------- */
  var U = IG.util = {
    $: function (sel, root) { return (root || document).querySelector(sel); },
    $$: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
    esc: function (s) {
      return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    dayKey: function (d) {
      d = d || new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    },
    /* whole days between two YYYY-MM-DD keys */
    dayDiff: function (a, b) {
      var pa = a.split('-'), pb = b.split('-');
      return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
    },
    /* the daily puzzle number is the same everywhere: it follows the UTC date */
    dailyNumber: function () {
      var n = new Date(), k = n.getUTCFullYear() + '-' + ('0' + (n.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + n.getUTCDate()).slice(-2);
      return Math.max(1, U.dayDiff(IG.LAUNCH_DAY, k) + 1);
    },
    plural: function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); },
    times: function (n) { return n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'; },
    lsGet: function (k, fallback) {
      try { var v = window.localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    lsSet: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    copy: function (text) {
      return new Promise(function (resolve) {
        function fallback() {
          try {
            var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
            ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
            var okc = document.execCommand('copy'); document.body.removeChild(ta); resolve(!!okc);
          } catch (e) { resolve(false); }
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { resolve(true); }, fallback);
          else fallback();
        } catch (e) { fallback(); }
      });
    },
    /* system share sheet where the frame allows it, otherwise copy */
    share: function (text) {
      try {
        if (navigator.share) {
          return navigator.share({ text: text }).then(function () { return 'shared'; }, function () {
            return U.copy(text).then(function (c) { return c ? 'copied' : 'failed'; });
          });
        }
      } catch (e) {}
      return U.copy(text).then(function (c) { return c ? 'copied' : 'failed'; });
    }
  };

  /* ---- tiny event bus ---------------------------------------------------- */
  var subs = {};
  IG.bus = {
    on: function (name, fn) { (subs[name] = subs[name] || []).push(fn); },
    emit: function (name, data) { (subs[name] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
  };

  /* ---- toasts ------------------------------------------------------------ */
  IG.toast = function (html, kind) {
    var box = document.getElementById('toasts'); if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' toast-' + kind : '');
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, 3600);
  };

  /* ---- settings (per viewer, browser storage) ----------------------------- */
  var DEFAULTS = {
    rulesMode: 'learn',            // 'learn' | 'traditional'
    captureMode: 'forced', reverseSowing: false, captureSowStart: 'afterOrigin',
    speed: 1, showCounts: true, sound: true, theme: 'system', tilt: false,
    tone: 2, tone2: 3
  };
  var hostTheme = document.documentElement.getAttribute('data-theme');
  var S = IG.settings = {
    data: (function () {
      var d = U.lsGet('igisoro.settings.v1', {}) || {}, out = {}, k;
      for (k in DEFAULTS) out[k] = (k in d && typeof d[k] === typeof DEFAULTS[k]) ? d[k] : DEFAULTS[k];
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches && !('speed' in d)) out.speed = 4;
      return out;
    })(),
    get: function (k) { return S.data[k]; },
    set: function (k, v) {
      S.data[k] = v;
      if (k === 'rulesMode') {       // the mode resets the advanced toggles to its preset
        S.data.captureMode = 'forced'; S.data.captureSowStart = 'afterOrigin'; S.data.reverseSowing = v === 'traditional';
      }
      U.lsSet('igisoro.settings.v1', S.data);
      S.apply();
      IG.bus.emit('settings', k);
    },
    /* engine rules for free play, from the settings panel */
    rules: function (over) {
      var r = { captureMode: S.data.captureMode, reverseSowing: S.data.reverseSowing, captureSowStart: S.data.captureSowStart };
      if (over) for (var k in over) r[k] = over[k];
      return E.makeRules(r);
    },
    isDark: function () {
      var t = document.documentElement.getAttribute('data-theme');
      if (t === 'dark') return true; if (t === 'light') return false;
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    },
    apply: function () {
      var root = document.documentElement;
      if (S.data.theme === 'system') { if (hostTheme) root.setAttribute('data-theme', hostTheme); else root.removeAttribute('data-theme'); }
      else root.setAttribute('data-theme', S.data.theme);
      if (IG.view) {
        IG.view.setDark(S.isDark()); IG.view.setSpeed(S.data.speed); IG.view.setTilt(S.data.tilt);
      }
      if (IG.audio) IG.audio.setEnabled(S.data.sound);
      document.body.classList.toggle('hide-counts', !S.data.showCounts);
    }
  };
  if (window.matchMedia) {
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { S.apply(); }); } catch (e) {}
  }

  /* ---- runtime capabilities (all optional) -------------------------------- */
  IG.caps = { db: null, room: null, user: null, uid: null, canWrite: null, ready: null };
  IG.caps.ready = (function () {
    var use = window.claude && typeof window.claude.use === 'function' ? function (n) {
      try { return Promise.resolve(window.claude.use(n)).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); }
    } : function () { return Promise.resolve(null); };
    return Promise.all([use('db'), use('room'), use('user')]).then(function (r) {
      IG.caps.db = r[0]; IG.caps.room = r[1]; IG.caps.user = r[2];
      if (!r[2]) return IG.caps;
      return Promise.all([r[2].id(), r[2].can('data.write')]).then(function (x) {
        IG.caps.uid = typeof x[0] === 'string' ? x[0] : null; IG.caps.canWrite = x[1];
        return IG.caps;
      }, function () { return IG.caps; });
    }).then(function (c) { IG.bus.emit('caps', c); return c; });
  })();

  /* ---- AI bridge: Web Worker built from the inline engine and AI sources -- */
  IG.ai = (function () {
    var worker = null, seq = 0, waiting = {}, broken = false;
    function boot() {
      if (worker || broken) return;
      try {
        var src = document.getElementById('src-engine').textContent + '\n' + document.getElementById('src-ai').textContent +
          '\nself.onmessage=function(e){var d=e.data;try{self.postMessage({id:d.id,res:self.IgisoroAI.think(d.state,d.level)});}catch(err){self.postMessage({id:d.id,err:String(err)});}};';
        var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = function (e) {
          var w = waiting[e.data.id]; if (!w) return;
          delete waiting[e.data.id]; clearTimeout(w.timer);
          if (e.data.err) w.local(); else w.resolve(e.data.res);
        };
        worker.onerror = function () { broken = true; worker = null; Object.keys(waiting).forEach(function (k) { var w = waiting[k]; delete waiting[k]; clearTimeout(w.timer); w.local(); }); };
      } catch (e) { broken = true; worker = null; }
    }
    function plain(state) {
      return { pits: [state.pits[0].slice(), state.pits[1].slice()], turn: state.turn, ply: state.ply, captured: state.captured.slice(), winner: state.winner, rules: state.rules };
    }
    function request(state, level) {
      boot();
      var st = plain(state);
      return new Promise(function (resolve) {
        function local() {
          // main-thread fallback with a short budget so the page stays responsive
          setTimeout(function () {
            var p = typeof level === 'string' ? window.IgisoroAI.LEVELS[level] : level;
            var lite = { depth: Math.min(p.depth, 3), time: Math.min(p.time, 220), blunder: p.blunder, noise: p.noise };
            var log = console.log; console.log = function () {};
            var res; try { res = window.IgisoroAI.think(st, lite); } finally { console.log = log; }
            resolve(res);
          }, 0);
        }
        if (!worker) return local();
        var id = ++seq, budget = (typeof level === 'string' ? window.IgisoroAI.LEVELS[level].time : level.time) || 500;
        waiting[id] = { resolve: resolve, local: local, timer: setTimeout(function () { if (waiting[id]) { delete waiting[id]; local(); } }, budget + 4000) };
        worker.postMessage({ id: id, state: st, level: level });
      });
    }
    return { request: request };
  })();
})();
