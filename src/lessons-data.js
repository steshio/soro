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
        each: 'One seed per pit, anticlockwise. This direction is called guteba.',
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
      { type: 'demo', pos: { my: { 0: 2, 2: 2, 9: 3 }, op: 'std' }, move: { start: 0, decisions: [] },
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
      { type: 'demo', pos: { my: { 8: 2, 10: 1, 3: 2 }, op: { 13: 3, 2: 2, 9: 2, 6: 1 } }, move: { start: 8, decisions: [] },
        text: 'Watch. The last seed lands in a full pit of your inner row. Both pits facing it hold cows, so you take them both.',
        after: 'The captured cows were sown on your side, starting from the pit after the one where the move began.' },
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
      { type: 'recap', points: ['Land your last seed in a full pit of your inner row.', 'If both pits facing it hold seeds, you capture both.', 'Sow the captured cows on your own side, starting where your move began.', 'A capture can lead to another capture in the same turn.'] }
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

    { id: 'L5', title: 'Reverse captures', blurb: 'Four pits can sow the other way.', minutes: 2, rules: TRAD, steps: [
      { type: 'say', pos: { my: { 15: 2, 13: 1, 4: 2, 6: 1 }, op: { 10: 2, 5: 2, 13: 1, 1: 2 } }, marks: [[0, 0], [0, 1], [0, 14], [0, 15]], markKind: 'on',
        text: 'Your four leftmost pits are special. The inner two are called nteba, the outer two ugutwi. From these you may sow the other way.' },
      { type: 'say', pos: { my: { 15: 2, 13: 1, 4: 2, 6: 1 }, op: { 10: 2, 5: 2, 13: 1, 1: 2 } }, marks: [[0, 0], [0, 1], [0, 14], [0, 15]], markKind: 'on',
        text: 'Sowing anticlockwise is guteba, the normal way. Sowing clockwise is kugarama. You may choose it only when that lap captures straight away.' },
      { type: 'do', pos: { my: { 15: 2, 13: 1, 4: 2, 6: 1 }, op: { 10: 2, 5: 2, 13: 1, 1: 2 } }, goal: { type: 'cw' }, glow: [15], only: [15], answer: 15, answerDecisions: ['cw'],
        text: 'Sow from the glowing pit. When the hand stops and asks, choose kugarama.',
        wrong: 'That was guteba. Try again and choose kugarama.',
        right: 'A reverse capture. The cows were sown clockwise too, following the lap that took them.' },
      { type: 'do', pos: { my: { 1: 1, 3: 1, 13: 3, 14: 3, 15: 2 }, op: { 0: 3, 2: 1, 3: 1, 4: 1, 7: 1, 8: 2, 9: 3, 11: 2, 12: 3, 14: 3 } },
        goal: { type: 'minCaptured', n: 3 }, answer: 14, answerDecisions: ['cw'],
        text: 'Find the reverse capture yourself. Only one of your pits offers it.',
        wrong: 'No capture there. Try your leftmost pits, and choose kugarama when it is offered.',
        right: 'Found it. {captured} cows.' },
      { type: 'do', pos: { my: { 1: 2, 3: 2, 6: 1, 8: 1, 12: 2, 13: 3, 15: 3 }, op: { 0: 3, 4: 3, 5: 1, 7: 1, 8: 1, 9: 3, 10: 1, 12: 3, 15: 2 } },
        goal: { type: 'minCaptured', n: 5 }, answer: 1, answerDecisions: ['ccw'],
        text: 'Kugarama is a choice, not a duty. One of your pits offers it here, but the normal direction wins more. Take the bigger herd.',
        wrong: 'That took {captured} cows. One of your reverse pits, sown the normal way, takes 5.',
        right: '{captured} cows. Always compare both directions before you choose.' },
      { type: 'recap', points: ['Reverse pits: your two leftmost inner pits (nteba) and outer pits (ugutwi).', 'Kugarama is allowed only when that lap captures at once.', 'It is offered at the start of a move, and when a relay ends in a reverse pit.', 'Compare both directions before you choose.'] }
    ] },

    { id: 'L6', title: 'The full game', blurb: 'Opening, main phase, and your first win.', minutes: 5, rules: TRAD, steps: [
      { type: 'say', pos: { my: 'std', op: 'std' }, text: 'A game opens with one move each: kuvuna, then kwivunura. Together they are the opening (guca umuvuno). These two moves cannot capture.' },
      { type: 'say', pos: { my: 'std', op: 'std' }, text: 'Then comes the main phase, kubuguza. Captures are live. You win when your opponent has no pit of 2 or more seeds left. A win is one point (igitego).' },
      { type: 'say', pos: { my: 'std', op: 'std' }, text: 'Masters are known for never counting seeds. When you feel ready, switch off Show counts in Settings. That is Master mode.' },
      { type: 'play', text: 'Play a full game against the Beginner computer. The coach warns you when a move leaves cows exposed, and you can take moves back.' },
      { type: 'recap', points: ['Two opening moves without captures, then kubuguza.', 'Win by leaving your opponent nothing to sow.', 'Next: climb the venues, or try the daily puzzle.'] }
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
