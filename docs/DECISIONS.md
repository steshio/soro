# Decisions, assumptions and gaps

A record of the calls made in the first build (version 0.1.0, 15 November 2026), so later work can question them one at a time. Rule questions for elders are in [RULES.md](RULES.md).

## Product and scope

- **Built:** every P0 item and every P1 item in the brief. **Not built:** all of P2 (move timer and clocks, weekly leagues and the country board, spectating, free setup, ndakubye, move history replay) and the friends list. Nothing unbuilt appears in a menu.
- **Practice is separate from the tables.** Practice games against the four computer levels are free, coached at the two lower levels, and always available, so nobody is ever locked out.
- **Tables** (changed on the founder's review of the first build). Six numbered steps against the computer, with entry fees 5, 15, 30, 60, 120, 250 cows and rising strength. A table opens when the player has **won** enough cows at the tables: 0, 15, 60, 150, 330, 690, which is three wins at the table below. XP levels no longer gate play; they only unlock cosmetics.
- **One kind of table.** The Standard, Traditional and Master variants are gone. Every table is played the way masters play: guteba and kugarama on, no seed counts, no move preview, no coach, no hint. Beginners are pointed to Learn and Practice.
- **Names.** The place names of the first build (Home village, Kigali, Musanze, Rubavu, Huye, Nyanza) are removed. Tables are numbered until the founder names them from research with players (`TODO(founder)` in `src/progress.js`).
- **Cows.** Start with 50. A herd below 5 is topped up to 20, once a day. The 7-day track pays 5, 5, 10, 10, 15, 15, 30 and does not reset when a day is missed.
- **Rules mode** starts on Learn and switches itself to Traditional when level 5 (reverse captures) is completed.
- **Online games default to 2× animation.** Friend games are untimed.
- **Level names** are English placeholders, marked `TODO(kinyarwanda)` in `src/progress.js`.

## Teaching

- Level 5 teaches guteba from a Nteba pit with two seeds, and kugarama from an Ngarama pit holding nine, because under the direct-capture rule kugarama needs a big pit.
- Level 1 switches relays off and levels 1 and 2 switch captures off, through `RULES`, so each level adds exactly one idea. The copy never says a rule does not exist; it says what happens now.
- Every challenge position was found by search and is verified by test to have exactly the intended solution.
- "Capture in two" uses a fixed, quiet opponent reply rather than a searched one, so the lesson cannot be derailed.
- Coaching compares the move played with a depth-2 search made before the move; a drop of about four seeds' worth triggers the nudge. Undo exists only in coached games.

## Engine and AI

- **Guteba and kugarama** follow the founder's correction of 15 November 2026: Nteba pits are loop indices 0 and 14, Ngarama pits are 7 and 9, and clockwise sowing exists only from them. The first build used the four leftmost pits and called the normal direction guteba; both were wrong. Still an assumption: the clockwise lap must itself capture (see RULES.md, question 1).
- Clockwise sowing never persists: after a clockwise capture, relays return to anticlockwise.
- A position where every liftable pit is endless is annulled rather than lost.
- At most 24 decision sequences are enumerated per start pit (only matters in optional-capture mode with long chains).
- The AI evaluates seed difference, mobility, exposed seeds and threats held, and searches complete turns. Beginner plays a casual move about 38% of the time and prefers ones that miss a capture.
- Captures swing hard under these rules: random games average about 40 plies, and one move can take 20 cows or more. If real play feels slower than this, the capture-sow rule (question 2 in RULES.md) is the first place to look.
- **Where cows are sown** changed on 20 November 2026, from the founder's play: from the pit last lifted, the normal way, as if just picked up there. Daily puzzles generated after this date differ from what the old rule would have produced; puzzles already solved keep their recorded tries. A table opened online on the old version will not stay in sync with the new one.

## Design

- **Pits are round and seeds are identical spheres**, on the founder's correction; the brief's rounded-square pits and per-seed size variation were dropped.
- The board is drawn on a transparent canvas over a CSS backdrop, so the surface follows the theme; the board's ground shadow is a soft texture plus the real shadow map for hands and seeds.
- Counts are small chips at the lower right of each pit; an empty pit shows none.
- Without WebGL the page falls back to a flat CSS board with counts and instant moves.
- **Full screen** is offered in games against the computer, pass and play and online, not in lessons or puzzles, whose instructions live in the side panel. It uses the browser's full-screen mode where allowed and an in-page overlay otherwise (iPhone browsers, some app views). While full, the coach's note, leave confirmations and the result appear inside the stage.
- Type: Young Serif for headings, Instrument Sans for the interface. One Imigongo zigzag rule under the header, triangles as step markers and bullets, geometric badge glyphs.

## Where the board does not match the reference photo

- The photo's pits are slightly taller than wide; here they are true circles on a 1 : 1.08 grid.
- Hinges are plain brass bars without screws or leaf detail.
- Wood grain is procedural and reads more uniform than real walnut; there is no figure, knot or end grain.
- Bowl shading is softer than the photo's deep carved shadow.
- The photo itself is not in this repository and is not used in the game.

## Not yet tested

- **Two real people online.** The netcode was exercised between two browser pages against an in-memory stand-in for the claude.ai runtime (`npm run preview -- online`). The real `db`, `room` and `user` services, access levels for a Contributor, and reconnect behaviour have not been exercised by a second person.
- **Real phones.** Layout and tap targets (43 px pits at 390 px wide) were checked in an emulated viewport. Frame rate on a mid-range phone has not been measured.
- **Web fonts and the Three.js CDN** load only on the published page; the sandbox blocked both, so local screenshots show fallback fonts.
- **Screen readers.** Labels, the live region and keyboard play are in place and were driven by script, not by a screen reader.
- **Sound** was not listened to.

## Known limitations

- Ratings are self-reported: each client writes its own row. Fine among friends, not tamper-proof.
- Leaving an online table while waiting deletes it; finished tables are never cleaned up.
- Web Share is refused inside the artifact frame, so "Challenge a friend" usually falls back to copying the message.
- The daily puzzle is the same for everyone only while everyone runs the same generator code; changing `puzzles-gen.js` changes future puzzles.
