/* ==========================================================================
   SOUND  (synthesised with Web Audio, no audio files)
   ========================================================================== */
(function () {
  'use strict';
  var IG = window.IG = window.IG || {};
  var ctx = null, master = null, noiseBuf = null, enabled = true, bed = null, lastClick = 0;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(freq, t, dur, peak, type, slideTo) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.003, peak, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, peak, freq, q) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1.2;
    env(g, t, 0.002, peak, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.05);
  }

  IG.audio = {
    setEnabled: function (on) { enabled = !!on; if (!enabled) IG.audio.ambience(null); },
    unlock: function () { ensure(); },
    /* one seed landing on wood or on other seeds */
    click: function (onSeeds) {
      if (!ensure()) return;
      var now = ctx.currentTime; if (now - lastClick < 0.012) return; lastClick = now;
      var f = (onSeeds ? 1500 : 980) * (0.86 + Math.random() * 0.3);
      tone(f, now, 0.035, 0.11, 'triangle', f * 0.72);
      noise(now, 0.03, 0.09, onSeeds ? 3400 : 2100, 1.4);
    },
    scoop: function (n) {
      if (!ensure()) return;
      var now = ctx.currentTime, k = Math.min(5, Math.max(2, n));
      for (var i = 0; i < k; i++) noise(now + i * 0.022 + Math.random() * 0.01, 0.028, 0.045, 2600 + Math.random() * 1400, 1.1);
    },
    /* soft wooden knock on a capture */
    knock: function () {
      if (!ensure()) return;
      var now = ctx.currentTime;
      tone(190, now, 0.16, 0.5, 'sine', 92);
      tone(410, now, 0.07, 0.12, 'triangle', 300);
      noise(now, 0.05, 0.12, 700, 0.8);
    },
    tick: function () { if (!ensure()) return; tone(820, ctx.currentTime, 0.03, 0.05, 'triangle', 700); },
    good: function () {
      if (!ensure()) return;
      var now = ctx.currentTime;
      [392, 494, 587].forEach(function (f, i) { tone(f, now + i * 0.09, 0.22, 0.16, 'triangle'); });
    },
    bad: function () { if (!ensure()) return; tone(196, ctx.currentTime, 0.2, 0.14, 'triangle', 165); },
    win: function () {
      if (!ensure()) return;
      var now = ctx.currentTime;
      [294, 370, 440, 587].forEach(function (f, i) { tone(f, now + i * 0.11, 0.3, 0.17, 'triangle'); tone(f * 2, now + i * 0.11, 0.12, 0.04, 'sine'); });
    },
    /* a quiet bed of air, coloured per venue. null stops it. */
    ambience: function (colour) {
      if (bed) { try { bed.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6); bed.s.stop(ctx.currentTime + 0.7); } catch (e) {} bed = null; }
      if (!colour || !ensure()) return;
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = colour; f.Q.value = 0.4;
      g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 1.5);
      l.frequency.value = 0.07; lg.gain.value = colour * 0.3; l.connect(lg); lg.connect(f.frequency);
      s.connect(f); f.connect(g); g.connect(master); s.start(); l.start();
      bed = { s: s, g: g, l: l };
    }
  };
})();
