# Architecture

One HTML page, no framework, no bundler. `tools/build.js` pastes the files of `src/` into `src/page.html` at four markers and writes `dist/igisoro.html`.

## How the page is assembled

```
<style>            app.css
<script src>       Three.js 0.160.0 from cdn.jsdelivr.net (UMD build, global THREE)
<script id=src-engine>   engine.js      -> window.IgisoroEngine
<script id=src-ai>       ai.js          -> window.IgisoroAI
<script>           lessons-data, puzzles-gen, render, audio, core, progress, game, learn, net, ui, then boot
```

The engine and AI sit in their own script tags because the AI Web Worker is built at run time from the text of those two tags (`core.js`, `IG.ai`). The same source therefore runs on the main thread, in the worker and in Node.

Everything else hangs off one global, `window.IG`.

## Data flow

```
tap -> IG.game -> IgisoroEngine.playTurn / applyMove -> event log -> IG.view.playEvents -> hands and seeds
                                   |
                                   +-> next state -> IG.board (counts, labels), IG.ui (plates, panel)
```

- **The engine is pure.** State in, state and events out. It knows nothing about the page.
- **The renderer never derives rules.** It animates the event log. After each move the controller compares the view's seed counts with the engine state and snaps the view if they ever differ.
- **A move can pause for a decision.** `playTurn` returns `pending` with the options; the controller animates the events so far, asks, appends the choice and runs it again. Events are deterministic, so the already animated prefix is skipped.

## Modules

| File | Owns |
|---|---|
| `engine.js` | rules, `RULES`, `legalMoves`, `applyMove`, `hash`, `mirror` |
| `ai.js` | static evaluation, iterative-deepening alpha-beta over complete turns, level parameters |
| `render.js` | `IG.DIM` (board dimensions), `IG.models` (all meshes), `IG.view` (scene, camera, seed slots, tweens, hand choreography) |
| `game.js` | `IG.board` (32 pit buttons, counts, SVG preview, decision prompt) and `IG.game` (turn loop for every mode, coach, undo, hint) |
| `learn.js` | `IG.learn` (lesson steps on the real board) and `IG.puzzle` |
| `net.js` | `IG.net` (tables, live moves, presence, resync, rematch, rating) |
| `progress.js` | `IG.progress` (profile, XP, cows, tables, missions, badges, cosmetics) |
| `ui.js` | `IG.ui` (routes, panels, settings dialog, starting games, boot) |
| `core.js` | `IG.util`, `IG.bus`, `IG.settings`, `IG.caps`, `IG.ai`, `IG.toast` |

## Art swap point

`IG.models` in `render.js` is the only place that builds geometry: `createBoard`, `createSeeds`, `createHand`. To move to Blender-made glTF (uploaded through the `assets` capability), reimplement those three functions and keep their return shapes. `IG.DIM` carries the dimensions the rest of the code relies on (pit pitch, pit radius, bowl depth, seed radius). Game logic is untouched.

Seed positions inside a pit come from `makeSlots`: a greedy heap in which slot `k` never depends on later seeds, so seeds do not jump when another lands.

## Game modes

`IG.game.start(cfg)` takes one config for every mode. `cfg.seats[n].kind` is `human`, `ai`, `remote` or `none`.

| Mode | Notes |
|---|---|
| `ai` | practice (free, coached for Beginner and Intermediate) or a table (staked, played master-style: no counts, no preview, no coach) |
| `local` | two humans, fixed board |
| `online` | one human, one remote seat; the view flips so your rows are at the bottom |
| `lesson`, `puzzle` | `solo`: the learner keeps the move, the runner decides what happens next |
| `demo` | two computer hands (Learn level 0) |

## Storage

| What | Where | Shape |
|---|---|---|
| Settings | browser storage `igisoro.settings.v1` | rules mode and toggles, speed, counts, sound, theme, tilt, hand tones |
| Profile | browser storage `igisoro.profile.v1`, mirrored to db `data/users/<id>/profile` (private to the viewer) | `xp, cows, won, rating, streak, badges, lessons, stats, tables, missions, login, daily, look, updatedAt` |
| Public row | db `players/<id>` (all read, each writes their own) | `rating, games, wins, level, t` |
| Table | db `tables/<code>` | `host, guest, first, rules, game, moves[{s,d}], hash, status, result, score, rematch, ratings` |

The newer of the local and remote profile wins on load. Only user ids are stored; names and avatars are resolved with `user.profiles()` at render time.

## Online play

- The **table document** is the durable record. It is what a refresh or a late join rebuilds from (`IG.game.loadMoves` replays the move list through the engine).
- The **named room** `table-<code>` carries live moves `{ g, seq, move, hashAfter }` on the `move` topic, resignations on `ctl`, and presence `{ seat, hover }` for the ghost hand.
- Both paths deliver moves; they are deduplicated by sequence number. If a hash disagrees, the client resyncs from the document.
- Everything received is validated: shapes are checked in `net.js`, and every move goes through `applyMove` before it is shown.
- The player who ends a game writes the result and the score. Each client updates only its own rating.
- With any capability missing, the lobby says so plainly and every other mode keeps working.

## Testing

| Layer | How |
|---|---|
| Rules | `test/engine.test.js`: hand-built positions, loop guard, 2,100 random games checking conservation, legality, replay and seat symmetry |
| Content | `test/content.test.js`: every Learn position has exactly the intended solution; daily puzzles exist, are deterministic and solvable |
| AI | `test/ai.smoke.js`: stronger settings beat weaker ones |
| Page | `tools/preview.js` with `tools/preview-scenarios.js`: headless Chromium plays a game, walks all lessons, solves the daily puzzle, plays by keyboard, and runs two pages against an in-memory stand-in for the claude.ai runtime |

The sandbox used for the first build renders WebGL in software, so scenarios run the animation at a high test speed and use real speed only for screenshots.
