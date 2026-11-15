# Igisoro: notes for AI sessions

Single-page Igisoro (Rwandan mancala) game for SteshLabs. Read `README.md` first, then `docs/RULES.md`, `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.

## Commands

- `npm test`: engine and content suites. Must pass before any commit.
- `npm run test:ai`: AI strength smoke test.
- `npm run build`: writes `dist/igisoro.html`.
- `npm run preview -- <scenario>`: headless Chromium against the built page. Scenarios: `shots`, `play`, `learn`, `more`, `flat`, `online`. Screenshots land in `.preview/` (ignored by git).

## Rules of the house

- `src/engine.js` is the only place game rules live. Variants are fields of `RULES`. If a rule changes, change the engine, add a hand-built test, then check `test/content.test.js` still passes, because lesson positions depend on the rules.
- The renderer animates the engine's event log. Do not re-derive rules in `render.js` or `game.js`.
- All meshes are created in `IG.models` (`src/render.js`). Keep it that way so glTF models can replace them.
- Kinyarwanda: use only the glossary in `docs/RULES.md`, exactly as given. Never invent words, names, proverbs or titles. Missing term: English plus `/* TODO(kinyarwanda): ... */`.
- Heritage claims: only the six facts on the About screen.
- No monetisation or gambling patterns of any kind. Cows are earned only.
- Copy is British English, second person, short, one idea per sentence.
- Everything from the network or from storage is untrusted: validate shapes, and pass every move through `applyMove`.
- The page must work with every claude.ai capability absent. Online play is the only feature allowed to switch off.
- Colours are CSS tokens defined for light and dark in `src/app.css`.

## Publishing

`dist/igisoro.html` is published as a claude.ai Artifact at the URL in `tools/artifact-url.txt`, with the capability declaration shown in `README.md`. Publish the same file to the same URL to update it. Load the `artifact-design` and `artifact-capabilities` skills before changing page structure or capability code.

## Workflow

One feature or fix per branch off `main`, small commits, a message that says what changed and why. Do not commit `.preview/` or `node_modules/`. Commit `dist/igisoro.html` only when it matches what was published.
