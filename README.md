# Igisoro

A digital Igisoro, the Rwandan 4×8 mancala game of seeds and cows, built by SteshLabs as a web-first teaching game. The thesis: **the learning curve is the product.** A complete beginner should go from "what is this?" to "I just captured your cows" in under ten minutes.

Published build: https://claude.ai/artifact/E1JdrUasHHNkDWnuyDFAaW (a claude.ai Artifact, private until shared from its Share menu).

It ships as **one self-contained HTML page** (`dist/igisoro.html`). There is no framework and no bundler; `tools/build.js` concatenates the files in `src/`.

## What is in it

| Area | State |
|---|---|
| Rules engine (pure, deterministic, tested in Node) | done |
| 3D top-down board, seeds and animated hands (Three.js, all art made in code) | done |
| Play the computer: Beginner, Intermediate, Strong, Master, in a Web Worker | done |
| Pass and play on one device | done |
| Full-screen toggle while playing | done |
| Online with a friend: table codes, live moves, resync, resign, rematch | done, see "Not yet tested" |
| Learn path: levels 0 to 6 on the real board, including guteba and kugarama | done |
| Puzzles: generated, verified, daily puzzle, share card | done |
| XP, levels, streaks, badges, cows, six staked tables that open by cows won, daily missions, 7-day track, cosmetics | done |
| Online rating (Elo) and a small leaderboard, ghost hand presence, challenge links | done |
| Move timer and clocks, weekly leagues, spectating, free setup (kugereka), ndakubye, replay | **not built** |

## Run it

Requires Node 20 or newer. The only dependency is a local copy of Three.js, used for offline preview; the published page loads Three.js from a CDN.

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run preview -- shots
```

`npm test` runs the engine suite (68 checks, 2,100 random self-play games) and the content suite (every Learn position and 40 daily puzzles verified by the engine). `npm run preview -- <scenario>` drives the built page in headless Chromium and writes screenshots to `.preview/`. Scenarios: `shots`, `play`, `learn`, `more`, `flat`, `online`, `full`.

## Publish

The page is published with the Claude Code **Artifact** tool from `dist/igisoro.html`, with these capabilities:

```json
{
  "db": { "rules": [
    { "path": "players", "read": "view", "write": "owner" },
    { "path": "players/{self}", "write": "interact" }
  ] },
  "room": { "topics": { "move": "interact", "ctl": "interact" } },
  "user": { "scopes": ["profile"] }
}
```

`tools/artifact-url.txt` holds the artifact's link; the build writes it into invitations. To update the live page, rebuild and publish the same file to the same URL.

## Layout

```
src/
  engine.js        rules engine: the source of truth (also runs in Node and in the worker)
  ai.js            alpha-beta over complete turns (also runs in Node and in the worker)
  lessons-data.js  Learn path content and goal checker (verified in Node)
  puzzles-gen.js   deterministic puzzle generator (verified in Node)
  render.js        Three.js scene, IG.models (the art swap point), animation from the event log
  audio.js         synthesised sound
  core.js          utilities, settings, capability access, AI worker bridge
  progress.js      XP, cows, tables, missions, badges, cosmetics, rating
  game.js          board overlay (pit buttons, previews, prompts) and the turn controller
  learn.js         lesson runner and puzzle runner
  net.js           online tables over the db, room and user capabilities
  ui.js            screens, routing, settings dialog, boot
  page.html        page shell with build markers
  app.css          design tokens and styles
test/              engine, content and AI checks (plain Node, no test framework)
tools/             build, headless preview, scripted scenarios
docs/              rules as implemented, architecture, decisions and open questions
dist/igisoro.html  the built page, as published
```

Read next: [docs/RULES.md](docs/RULES.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DECISIONS.md](docs/DECISIONS.md).

## Ground rules for this project

- **The engine decides.** Rendering, AI, lessons, puzzles and networking all call `src/engine.js`. Regional rule variants are fields of its `RULES` object, never branches elsewhere.
- **Kinyarwanda is used carefully.** Only the terms in the glossary in `docs/RULES.md`, as given. Where a Kinyarwanda name would be nice but is not in that list, use English and leave `/* TODO(kinyarwanda): ... */`.
- **Nothing gambling-shaped.** No real-money purchases, random rewards, pay-to-skip timers, energy systems or nagging. Cows are earned only.
- **Heritage facts are limited** to the six on the About screen. Add none without a source the founder has approved.
- British English in all copy. Short sentences. One idea each.

## Working on it

The first import landed on `main` as a layered history: one commit per module, each message recording what the module does and the calls made in it. From here on, give each feature its own branch off `main` (for example `feat/move-timer`, `fix/coach-wording`) and open a pull request, so every change can be reviewed and referenced on its own.

A change is ready when `npm test` passes, `npm run build` succeeds, and the scenario that covers it passes in `npm run preview`.

No licence has been chosen yet; until one is added, all rights are reserved by SteshLabs Ltd.
