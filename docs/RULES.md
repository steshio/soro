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

- Take all seeds from both facing pits. Sow them on your own side starting from the **origin pit** of the turn. With `captureSowStart: "afterOrigin"` (default) the first seed goes into the pit after the origin; with `"origin"` it goes into the origin pit itself.
- Then step 3 applies again to where the last captured seed fell, so captures chain.
- `captureMode: "forced"` (default) or `"optional"`. In optional mode a capture can be declined (ndahise) and the move relays instead.

## Reverse sowing (kugarama)

- Reverse pits are loop indices `0, 1, 14, 15`: the player's four leftmost pits (ugutwi in the outer row, nteba in the inner row).
- When a lap is about to be lifted from a reverse pit (the start of a move, or a relay that ended there), the player may sow that lap clockwise, **only if that lap ends in a direct capture**. The engine offers the choice only when that is true.
- Captured seeds are sown in the direction of the lap that made the capture. If the capturing lap was anticlockwise and the origin is a reverse pit, a clockwise capture-sow is offered when it would capture directly.
- A clockwise lap always captures, so in optional mode its capture cannot be declined.
- Off in the Learn rules preset, on in Traditional.

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
| `captureSowStart` | `afterOrigin` | or `origin` |
| `reverseSowing` | `true` | `false` in the Learn preset |
| `reversePits` | `[0, 1, 14, 15]` | |
| `openingNoCaptureMoves` | 2 | set very high to switch captures off (Learn levels 1 and 2) |
| `relaySowing` | `true` | `false` only in Learn level 1 |
| `maxDropsPerMove` | 3000 | endless-move cap |
| `maxVariantsPerPit` | 24 | cap on decision sequences enumerated per start pit |

## Moves and the event log

A move is `{ start, decisions }`. `decisions` holds one entry per real choice, in order: `"ccw"` or `"cw"` for a direction, `"take"` or `"pass"` for an optional capture. Moves replay exactly, travel over the network and are stored as they are.

`applyMove(state, move)` returns the next state and an ordered event log that the renderer animates: `lift`, `drop`, `relay`, `capture`, `capsow`, `pass`, `blocked` (a capture suppressed in the opening) and `end`.

## To confirm with elders and the Academy

1. **Reverse pits.** Are they the four leftmost pits (two inner, two outer) from the player's own seat?
2. **Where captured seeds start.** Into the pit after the origin, or into the origin pit itself?
3. **Opening.** Are the first two moves barred from capturing? Tradition plays them simultaneously; this build alternates them.
4. **Endless moves.** Tradition annuls the game. This build refuses to offer the move. Is that acceptable for casual play?
5. **Direction after a reverse capture.** Here every relay lap goes back to anticlockwise unless it starts from a reverse pit and captures directly. Some players may keep sowing clockwise.
6. **Direction of the capture-sow.** Here it follows the capturing lap. Confirm, and confirm whether a reverse choice exists for it at a reverse origin.
7. **Declining a reverse capture** in optional mode: not allowed here.
8. **Forced or optional capture** as the default in Rwanda today.
9. **Stalemate by endless options**: annulled here.
10. **Urunyana.** The lesson describes it only as a row of single seeds that cannot be sown. Any further meaning should come from a player.

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
| Guteba | Sowing anticlockwise, the normal direction |
| Kugarama | Sowing clockwise from a reverse pit, for a capture |
| Nteba / Ugutwi | Reverse pits in the inner row / outer row |
| Ndahise | I pass; declining a capture |
| Ndakubye | I retreat; the opponent's protective reply (not built) |
| Gutanga inganji | The winner starts the next game |
| Igitego | A point, one per game won |
