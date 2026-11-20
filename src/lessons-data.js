/* ==========================================================================
   LEARN PATH CONTENT
   Pure data plus a goal checker, so the positions can be verified in Node
   (test/content.test.js). The learner is always seat 0 (bottom).
   Positions are sparse maps of loop index -> seeds. 'std' is the normal setup.
   Kinyarwanda terms: only those in the brief's glossary, used as given.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IgisoroLessons = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var NO_CAPTURE = 9999;
  var R1 = { relaySowing: false, reverseSowing: false, openingNoCaptureMoves: NO_CAPTURE };
  var R2 = { reverseSowing: false, openingNoCaptureMoves: NO_CAPTURE };
  var LEARN = { reverseSowing: false };
  var TRAD = { reverseSowing: true };

  var LESSONS = [
    { id: 'L0', title: 'Watch', blurb: 'Thirty seconds of a real game. No explanation.', minutes: 1, kind: 'watch' },

    { id: 'L1', title: 'Sowing', blurb: 'One seed per pit, around your own two rows.', minutes: 2, rules: R1, veil: true, steps: [
      { type: 'say', text: 'The two rows nearest you are yours. Each hollow is a pit (icyuba). The small balls are seeds (ubusoro).' },
      { type: 'free', n: 5, pos: { my: 'std', op: 'std' },
        text: 'Tap one of your pits that holds at least 2 seeds. Tap it again to sow. Your hand drops one seed in each pit, anticlockwise.',
        each: 'One seed per pit, anticlockwise.',
        done: 'Good. That is sowing.' },
      { type: 'do', pos: { my: { 2: 3, 9: 5, 12: 2 }, op: 'std' }, goal: { type: 'endAt', pit: 5 }, glow: [5], answer: 2,
        text: 'Now aim. End your move in the glowing pit.',
        wrong: 'That ended in a different pit. Count one pit for each seed, starting from the pit after yours.',
        right: 'Right. Three seeds, three pits.' },
      { type: 'do', pos: { my: { 6: 4, 3: 4, 12: 3 }, op: 'std' }, goal: { type: 'endAt', pit: 10 }, glow: [10], answer: 6,
        text: 'Your path turns the corner: along your outer row, then back along your inner row. End in the glowing pit.',
        wrong: 'Not that one. Follow the path round the right-hand corner.',
        right: 'Yes. Round the corner and back.' },
      { type: 'do', pos: { my: { 14: 3, 0: 1, 5: 2, 10: 2 }, op: 'std' }, goal: { type: 'endAt', pit: 1 }, glow: [1], answer: 14,
        text: 'The loop never leaves your side. From the end of the inner row it carries on into the outer row. End in the glowing pit. A pit with one seed cannot be sown.',
        wrong: 'Not there. Which pit has enough seeds to reach the glow?',
        right: 'That is the whole loop: sixteen pits, round and round.' },
      { type: 'recap', points: ['Sow from a pit with at least 2 seeds.', 'One seed per pit, anticlockwise around your own two rows.', 'Sowing never puts seeds on your opponent’s side.'] }
    ] },

    { id: 'L2', title: 'Relay', blurb: 'Land on seeds, lift them all, keep going.', minutes: 2, rules: R2, veil: true, steps: [
      { type: 'say', text: 'A move does not always stop after one lap. If your last seed lands in a pit that already holds seeds, you lift them all and keep sowing. That is a relay.' },
      { type: 'demo', pos: { my: { 0: 2, 2: 2, 9: 3 }, op: 'std' }, move: { start: 0, decisions: [] }, expect: { relays: 1, captures: 0 },
        text: 'Watch. Two seeds from the left-hand pit. The second lands on a full pit, so the hand lifts everything there and carries on.',
        after: 'The last seed fell in an empty pit, so the move ended.' },
      { type: 'do', pos: { my: { 0: 2, 2: 2, 9: 3 }, op: 'std' }, goal: { type: 'from', start: 0 }, glow: [0], only: [0], answer: 0,
        text: 'Your turn. Sow from the glowing pit and watch it relay.',
        right: 'One relay. The last seed you drop is lifted again with the rest.' },
      { type: 'do', pos: { my: { 1: 2, 4: 3, 8: 2, 11: 1, 12: 3, 13: 4 }, op: 'std' }, goal: { type: 'minDrops', n: 12 }, answer: 13,
        text: 'A good relay travels far. Find the move that drops at least 12 seeds. Tap a pit to preview where it ends.',
        wrong: 'That one stopped after {drops} seeds. Look for a move whose last seed keeps landing on full pits.',
        right: '{drops} seeds from one move. Relays are how a small pit reaches the far side.' },
      { type: 'do', pos: { my: { 6: 2, 9: 1, 10: 3, 11: 2, 13: 2, 15: 1 }, op: 'std' }, goal: { type: 'noRelay' }, answer: 6,
        text: 'Sometimes you want to stop. Find the move that ends straight away in an empty pit, with no relay.',
        wrong: 'That one relayed. The last seed has to land in an empty pit.',
        right: 'Stopped on purpose. Choosing where a move ends is half the game.' },
      { type: 'recap', points: ['Last seed in an empty pit: your move ends.', 'Last seed in a full pit: lift them all, that seed included, and keep sowing.', 'Tap a pit once to preview where the whole move will end.'] }
    ] },

    { id: 'L3', title: 'Capturing cows', blurb: 'Land in the right pit and take what faces it.', minutes: 2, rules: LEARN, steps: [
      { type: 'say', text: 'Now the far side matters. Your opponent’s seeds are cows (inka), and you win by taking them. To capture is kurasa.' },
      { type: 'demo', pos: { my: { 8: 2, 10: 1, 3: 2 }, op: { 13: 3, 2: 2, 9: 2, 6: 1 } }, move: { start: 8, decisions: [] }, expect: { relays: 0, captures: 1, captured: 5, sowFrom: 8 },
        text: 'Watch. The last seed lands in a full pit of your inner row. Both pits facing it hold cows, so you take them both.',
        after: 'The captured cows were sown on your side, starting just after the pit you picked up from.' },
      { type: 'demo', pos: { my: { 4: 2, 6: 4, 11: 1 }, op: { 12: 3, 3: 2, 9: 2, 6: 1 } }, move: { start: 4, decisions: [] }, expect: { captures: 1, captured: 5, sowFrom: 6 }, marks: [[0, 6, 'alt']],
        text: 'One more. This move relays from the marked pit, then captures. Watch where the cows start.',
        after: 'The cows started just after the marked pit: the last pit the hand picked up from, not the first.' },
      { type: 'do', pos: { my: { 3: 1, 5: 2, 6: 2, 8: 3, 11: 1, 14: 3, 15: 3 }, op: { 0: 2, 3: 3, 4: 3, 8: 2, 9: 3, 10: 1, 15: 2 } },
        goal: { type: 'capture', min: 1 }, answer: 6,
        text: 'Your turn. One of your moves captures. Find it. The preview circles the pits a move would take.',
        wrong: 'No capture there. You need to land in a full inner pit that faces two full pits.',
        right: 'Captured. {captured} cows are yours.' },
      { type: 'two', pos: { my: { 4: 1, 8: 2, 12: 3, 13: 3 }, op: { 1: 1, 2: 2, 5: 2, 7: 1, 8: 3, 11: 2 } },
        first: 13, reply: { start: 2, decisions: [] }, goal: { type: 'capture', min: 1 }, answer: 12,
        text: 'No capture yet. Make a move that sets one up. Your opponent will answer, then you take the cows.',
        wrongFirst: 'That does not set up a capture. Try again: after your move, a single seed should be able to land on a full inner pit.',
        mid: 'Your opponent has moved. Now capture.',
        wrong: 'That missed the capture. Start again.',
        right: 'Planned and taken. {captured} cows.' },
      { type: 'recap', points: ['Land your last seed in a full pit of your inner row.', 'If both pits facing it hold seeds, you capture both.', 'Sow the captured cows on your own side, starting just after the last pit you picked up from.', 'A capture can lead to another capture in the same turn.'] }
    ] },

    { id: 'L4', title: 'Defence', blurb: 'See what is exposed. Move it, or lose it.', minutes: 2, rules: LEARN, steps: [
      { type: 'say', pos: { my: { 1: 2, 3: 2, 5: 1, 6: 3, 13: 1, 14: 2 }, op: { 1: 3, 5: 2, 6: 3, 8: 3, 9: 1, 10: 1, 15: 3 } }, marks: [[0, 14], [0, 1]],
        text: 'Look at your two marked pits. They sit in the same column, both hold seeds, and the pit facing them is full. One move from your opponent takes all 4.' },
      { type: 'do', pos: { my: { 1: 2, 3: 2, 5: 1, 6: 3, 13: 1, 14: 2 }, op: { 1: 3, 5: 2, 6: 3, 8: 3, 9: 1, 10: 1, 15: 3 } }, marks: [[0, 14], [0, 1]],
        goal: { type: 'safe' }, answer: 1,
        text: 'Save them. Make a move that leaves your opponent with no capture.',
        wrong: 'They can still capture. Empty one of the two marked pits.',
        right: 'Safe. A capture needs both of your pits in that column to hold seeds.' },
      { type: 'say', text: 'A pit with a single seed cannot be sown. A row of single seeds is called urunyana, the line of calves. A player left with only calves has no move, and loses.' },
      { type: 'do', pos: { my: { 1: 1, 2: 3, 3: 1, 5: 2, 8: 2, 10: 1 }, op: { 2: 1, 4: 1, 9: 1, 10: 1, 12: 1, 13: 3 } }, goal: { type: 'win' }, answer: 8,
        text: 'Your opponent has one pit they can still sow. Capture it and only calves are left.',
        wrong: 'They can still move. Capture the pit that holds more than one seed.',
        right: 'They cannot sow. That is how a game is won.' },
      { type: 'recap', points: ['A column is exposed when both your pits in it hold seeds and the pit facing them is full.', 'Empty one of the two and the capture is off.', 'A player with no pit of 2 or more seeds loses.'] }
    ] },

    { id: 'L5', title: 'Guteba and kugarama', blurb: 'Four special pits may sow the other way.', minutes: 3, rules: TRAD, steps: [
      { type: 'say', pos: { my: { 14: 2, 12: 1, 4: 2, 6: 1 }, op: { 11: 2, 4: 2, 13: 1, 1: 2 } }, marks: [[0, 0, 'warn'], [0, 14, 'warn'], [0, 7, 'alt'], [0, 9, 'alt']],
        text: 'Sowing goes anticlockwise. Four of your pits are the exception. On your left, the outer corner pit and the second inner pit are Nteba. On your right, the outer corner pit and the second inner pit are Ngarama.' },
      { type: 'say', pos: { my: { 14: 2, 12: 1, 4: 2, 6: 1 }, op: { 11: 2, 4: 2, 13: 1, 1: 2 } }, marks: [[0, 0, 'warn'], [0, 14, 'warn'], [0, 7, 'alt'], [0, 9, 'alt']],
        text: 'From a Nteba pit you may play guteba: sow clockwise instead. From an Ngarama pit the same move is called kugarama. Either is allowed only when that clockwise lap captures.' },
      { type: 'do', pos: { my: { 14: 2, 12: 1, 4: 2, 6: 1 }, op: { 11: 2, 4: 2, 13: 1, 1: 2 } }, goal: { type: 'cw' }, glow: [14], only: [14], answer: 14, answerDecisions: ['cw'],
        text: 'Sow from the glowing Nteba pit. When the hand stops and asks, choose guteba.',
        wrong: 'That was the normal direction. Try again and choose guteba.',
        right: 'Guteba. Then the cows went the normal way, starting from the Nteba pit you picked up from.' },
      { type: 'do', pos: { my: { 7: 9, 14: 1, 3: 2 }, op: { 9: 2, 6: 2, 12: 1, 0: 3 } }, goal: { type: 'cw' }, glow: [7], only: [7], answer: 7, answerDecisions: ['cw'],
        text: 'Now the other side. This Ngarama pit holds 9 seeds: enough to travel back along your outer row and round into your inner row. Sow from it and choose kugarama.',
        wrong: 'That was the normal direction. Try again and choose kugarama.',
        right: 'Kugarama. Nine seeds went backwards and the last one captured.' },
      { type: 'do', pos: { my: { 0: 3, 2: 3, 3: 3, 6: 3, 8: 2, 13: 2, 14: 3 }, op: { 1: 2, 4: 1, 5: 1, 6: 3, 10: 2, 13: 1, 14: 3 } },
        goal: { type: 'minCaptured', n: 3 }, answer: 0, answerDecisions: ['cw'],
        text: 'Find the reverse capture yourself. Only one of your special pits offers it.',
        wrong: 'No capture there. Try your Nteba pits, and choose guteba when it is offered.',
        right: 'Found it. {captured} cows.' },
      { type: 'do', pos: { my: { 3: 3, 7: 8, 11: 2, 15: 3 }, op: { 2: 3, 3: 2, 5: 2, 7: 1, 8: 3, 11: 2, 12: 1 } },
        goal: { type: 'minCaptured', n: 7 }, answer: 7, answerDecisions: ['ccw'],
        text: 'A reverse move is a choice, not a duty. Your big Ngarama pit offers kugarama here, but sowing it the normal way wins more. Take the bigger herd.',
        wrong: 'That took {captured} cows. Sowing the big pit the normal way takes 7.',
        right: '{captured} cows. Always compare both directions before you choose.' },
      { type: 'recap', points: ['Nteba: your outer left corner pit and your second inner pit from the left. Clockwise from them is guteba.', 'Ngarama: your outer right corner pit and your second inner pit from the right. Clockwise from them is kugarama.', 'Both are allowed only when that clockwise lap captures.', 'They are offered at the start of a move, and when a relay ends in one of these pits.', 'Compare both directions before you choose.'] }
    ] },

    { id: 'L6', title: 'The full game', blurb: 'Opening, main phase, and your first win.', minutes: 5, rules: TRAD, steps: [
      { type: 'say', pos: { my: 'std', op: 'std' }, text: 'A game opens with one move each: kuvuna, then kwivunura. Together they are the opening (guca umuvuno). These two moves cannot capture.' },
      { type: 'say', pos: { my: 'std', op: 'std' }, text: 'Then comes the main phase, kubuguza. Captures are live. You win when your opponent has no pit of 2 or more seeds left. A win is one point (igitego).' },
      { type: 'say', pos: { my: 'std', op: 'std' }, text: 'Masters are known for never counting seeds. When you feel ready, switch off Show counts in Settings. That is Master mode.' },
      { type: 'play', text: 'Play a full game against the Beginner computer. The coach warns you when a move leaves cows exposed, and you can take moves back.' },
      { type: 'recap', points: ['Two opening moves without captures, then kubuguza.', 'Win by leaving your opponent nothing to sow.', 'Next: sit down at the tables, or try the daily puzzle.'] }
    ] }
  ];

  function toPits(spec) {
    var a = [], i;
    for (i = 0; i < 16; i++) a[i] = 0;
    if (spec === 'std') { for (i = 8; i < 16; i++) a[i] = 4; return a; }
    for (var k in spec) a[+k] = spec[k];
    return a;
  }

  /* info: what G.commit reports for the learner's move (see game.js). E: the engine. */
  function checkGoal(goal, info, E) {
    switch (goal.type) {
      case 'endAt': return info.end === goal.pit;
      case 'from': return info.move.start === goal.start;
      case 'minDrops': return info.drops >= goal.n;
      case 'noRelay': return info.relays === 0;
      case 'capture': return info.captured >= (goal.min || 1);
      case 'minCaptured': return info.captured >= goal.n;
      case 'cw': return info.move.decisions.indexOf('cw') >= 0 && info.captured > 0;
      case 'win': return !!info.won;
      case 'safe':
        if (info.after.winner !== null) return true;
        return !E.enumerate(info.after).some(function (c) { return c.captured > 0; });
    }
    return false;
  }

  return { LESSONS: LESSONS, toPits: toPits, checkGoal: checkGoal };
});
