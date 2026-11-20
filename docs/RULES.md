# Rules as implemented

`src/engine.js` is the source of truth. This file describes what it does, which parts are settings, and which parts still need confirming with elders and the Rwanda Cultural Heritage Academy.

## Board and coordinates

- 4 rows × 8 columns, 32 pits, 64 seeds. Two seats: `0` bottom, `1` top.
- Each player owns 16 pits addressed by a **loop index 0 to 15**, running anticlockwise from that player's own seat: `0..7` along the outer row left to right, `8..15` back along the inner row right to left. Both seats use the same loop, so the board is symmetric under a half turn.
- For my inner pit `i` (8 to 15): the opponent's facing inner pit is `23 - i`, their facing outer pit is `i - 8`, and my own outer pit behind it is `15 - i`.
- Pit numbers shown to players count 1 to 8 from the owner's own left: outer `i + 1`, inner `16 - i`.

## A turn

1. Pick one of your pits with at least `minSeedsToSow` seeds (2).
2. Lift them all and sow one per pit around your own loop, anticlockwise (guteba). Seeds never enter the opponent's rows by sowing.
3. Look at where the last seed fell:
   - **empty before the drop**: the turn ends.
   - **occupied, inner row, and both facing opponent pits occupied**: capture (kurasa).
   - **occupied otherwise**: relay. Lift everything in that pit, the last seed included, and sow on from the next pit.

## Capture

- Take all seeds from both facing pits. Sow them on your own side as if you had just picked them up from **the pit you last lifted**: the start pit, or the last pit a relay lifted. Confirmed by the founder on 20 November 2026; the first builds used the start pit of the turn. With `captureSowStart: "afterOrigin"` (default) the first seed goes into the pit after that one; with `"origin"` it goes into that pit itself.
- Example: 2 seeds from pit A land in pit B, which held 4. The 5 seeds of B relay and the last one captures. The cows are sown from B, not from A.
- After the capture-sow, the pit last lifted does not change unless another relay lifts a pit.
- Then step 3 applies again to where the last captured seed fell, so captures chain.
- `captureMode: "forced"` (default) or `"optional"`. In optional mode a capture can be declined (ndahise) and the move relays instead.

## Guteba and kugarama (the only clockwise moves)

Sowing has one direction: anticlockwise. Four pits per player are the exception. Corrected by the founder on 15 November 2026; the first build had these wrong.

| Pits | Loop indices | Where, from the player's own seat | Clockwise move from them |
|---|---|---|---|
| **Nteba** | `0`, `14` | outer left corner pit, and the second inner pit from the left | **guteba** |
| **Ngarama** | `7`, `9` | outer right corner pit, and the second inner pit from the right | **kugarama** |

- When a lap is about to be lifted from one of these pits (the start of a move, or a relay that ended there), the player may sow that lap clockwise, **only if that lap ends in a direct capture**. The engine offers the choice only when that is true, and names it (`pending.name` is `guteba` or `kugarama`).
- The normal anticlockwise direction has no Kinyarwanda name in this build.
- Captured seeds go the normal way, anticlockwise, whatever direction made the capture. The one exception is the same as for a lift: if the pit last lifted is a Nteba or Ngarama pit and sowing the cows clockwise from it would capture directly, the player may choose clockwise. So after guteba from a Nteba pit, the cows go the normal way from that Nteba pit unless guteba with the cows would capture again.
- A clockwise lap always captures, so in optional mode its capture cannot be declined.
- Relays after a clockwise lap go back to anticlockwise.
- Off in the Learn rules preset, on in Traditional and at the tables.

A consequence of "direct capture": guteba works with two or three seeds, because clockwise from a Nteba pit runs straight along the inner row. Kugarama needs a big pit, because clockwise from an Ngarama pit runs along the outer row first: at least 8 seeds from pit 7, at least 10 from pit 9. If kugarama is played with small pits in real games, the condition is not "this lap captures" but "this move goes on to capture", and the engine needs changing (question 1 below).

## Opening

The first move of each player (kuvuna, then kwivunura) cannot capture: `openingNoCaptureMoves: 2`. A lap that would capture relays instead. Reverse sowing is not offered while captures are off. Opening moves alternate.

## End of game

- A player with no pit of 2 or more seeds at the start of their turn loses. A win is one point (igitego).
- In a rematch the winner of the previous game starts (gutanga inganji).
- If a player has pits to lift but every option is endless (see below), the game is annulled (`winner: "draw"`). This did not occur in 2,100 random games.

## Endless moves (house rule)

Every candidate move is simulated in full before it is offered. A move is refused if it exceeds `maxDropsPerMove` (3,000) or repeats a full board state within the same turn. Refused moves are logged to the console. Tradition annuls such games; that is not useful online.

## The `RULES` object

| Field | Default | Meaning |
|---|---|---|
| `minSeedsToSow` | 2 | seeds needed to play a pit |
| `seedsPerInnerPit` | 4 | standard setup: inner rows filled, outer rows empty |
| `captureMode` | `forced` | or `optional` |
| `captureSowStart` | `afterOrigin` | or `origin`; either way counted from the pit last lifted |
| `reverseSowing` | `true` | guteba and kugarama; `false` in the Learn preset |
| `ntebaPits` | `[0, 14]` | clockwise from these is guteba |
| `ngaramaPits` | `[7, 9]` | clockwise from these is kugarama |
| `openingNoCaptureMoves` | 2 | set very high to switch captures off (Learn levels 1 and 2) |
| `relaySowing` | `true` | `false` only in Learn level 1 |
| `maxDropsPerMove` | 3000 | endless-move cap |
| `maxVariantsPerPit` | 24 | cap on decision sequences enumerated per start pit |

## Moves and the event log

A move is `{ start, decisions }`. `decisions` holds one entry per real choice, in order: `"ccw"` or `"cw"` for a direction, `"take"` or `"pass"` for an optional capture. Moves replay exactly, travel over the network and are stored as they are.

`applyMove(state, move)` returns the next state and an ordered event log that the renderer animates: `lift`, `drop`, `relay`, `capture`, `capsow`, `pass`, `blocked` (a capture suppressed in the opening) and `end`.

## To confirm with elders and the Academy

1. **What "leads to a capture" means for guteba and kugarama.** Here the clockwise lap itself must end in a capture. The alternative is that the move may relay first and capture later. This decides whether kugarama is rare (big pits only) or common, and if relays are allowed, which way they go.
2. **Where captured seeds start.** Settled: from the pit last lifted. Still open: does the first cow go into the pit after it (this build) or into that pit itself?
3. **Opening.** Are the first two moves barred from capturing? Tradition plays them simultaneously; this build alternates them.
4. **Endless moves.** Tradition annuls the game. This build refuses to offer the move. Is that acceptable for casual play?
5. **Direction after a clockwise capture.** Here every relay lap goes back to anticlockwise unless it starts from one of the four pits and captures directly.
6. **Direction of the capture-sow.** Settled: the normal way, unless the pit last lifted is a Nteba or Ngarama pit and clockwise would capture again. Still open: after a chain of captures with no new relay, cows keep starting from the same pit; confirm.
7. **Declining a clockwise capture** in optional mode: not allowed here.
8. **Forced or optional capture** as the default in Rwanda today.
9. **Stalemate by endless options**: annulled here.
10. **Urunyana.** The lesson describes it only as a row of single seeds that cannot be sown. Any further meaning should come from a player.
11. **Ugutwi.** The original brief listed it as a name for reverse pits in the outer row. It is no longer used anywhere in the game; confirm whether it names anything.
12. **A name for the normal direction**, if players have one.

## Glossary (the only Kinyarwanda used)

| Term | Meaning |
|---|---|
| Igisoro / Ikibuguzo | The game and the board |
| Kubuguza | Playing the game; the main phase |
| Icyuba (ibyuba) | Pit (pits) |
| Ubusoro | Seeds |
| Inka | Cows; the seeds you capture |
| Urunyana | Line of calves; a row of single seeds |
| Kugereka | Placing the seeds at setup |
| Guca umuvuno | The opening |
| Kuvuna / Kwivunura | First move / second move of the opening |
| Kurasa | To capture |
| Nteba | The two special pits on a player's left: outer corner pit, second inner pit |
| Guteba | Sowing clockwise from a Nteba pit, to capture |
| Ngarama | The two special pits on a player's right: outer corner pit, second inner pit |
| Kugarama | Sowing clockwise from an Ngarama pit, to capture |
| Ndahise | I pass; declining a capture |
| Ndakubye | I retreat; the opponent's protective reply (not built) |
| Gutanga inganji | The winner starts the next game |
| Igitego | A point, one per game won |
