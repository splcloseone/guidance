# The Source — continuation checkpoint

Updated 2026-10-09. Read README.md, AGENTS.md, docs/ARCHITECTURE.md, and
DESIGN.md before continuing. The active upgrade is still being verified; do not
assume the current working files have reached the public play site yet.

## Current work

The user approved developing the creation system with editable presets, optional
shaping assistance, description assistance, and physical hook/lasso interactions
against practice characters. They requested a difficult repeated-press breakout,
friendly rescues, autosave, and a codebase another developer can continue.

Implemented in working files:

- Version 2 creation records, legacy-save migration, stable design IDs.
- Ball/hook/lasso/claw presets; editable curve points in three axes; optional
  smoothing and snapping; live 3D geometry; bounded offline description helper.
- Local library up to 20 designs; a full library refuses new entries and never
  silently removes an existing saved design.
- Rival and ally characters, rescue ledge, impact wall, visible capture loops.
- Physical two-body pulling, staged lift/throw, damage from actual contacts.
- Rival struggles and player breakout with rising-edge presses, decay and rate
  limit. Holding a key does not auto-repeat. Keyboard B and controller R3.
- Thicker tethers cost more of the Source and resist pulling/breakout more.
- Keyboard/controller practice selection and lift/slam; friendly-hook preference.
- Active design/session autosaves; practice actors and active tethers restart.
- Packaging produces self-contained HTML, ZIP, and the static hosting directory.
- Publish helper defaults to a dry run; --publish updates only origin/gh-pages
  without changing the development checkout or forcing remote history.

## Verification during this upgrade

- All 43 unit tests pass, including legacy save migration, library capacity,
  custom geometry, impact damage, tether breakout and near-face rescue catches.
- Both core browser suites pass: creation editing/library/reload and actual
  capture/drag/lift/slam/rescue, controller slam, and repeated controller escape.
  The escape check needed 31 deliberate taps; holding counted only once.
- Rescue is fixed: character tethers reel down to 1 m; world/prop tethers retain
  2 m. The ally must physically reach the safe area; the success criterion remains.
- Build/package succeeded. ZIP integrity and HTML equality were checked using
  Python's independent ZIP reader. Vite's >500 kB advisory is not a build failure.
- Older browser suites initially lost the Vite server connection. Restarted Vite
  and rerunning those checks, followed by standalone-browser validation.
- Public deployment and source push are pending these last release checks.

## Running checks

```
npm ci --cache /tmp/source-npm-cache --no-audit --no-fund
npm test
npm run build
npm run dev -- --port 5173
npm run test:core
npm run test:browser
npm run package:play
PLAYABLE_FILE=releases/web/index.html PLAYABLE_PATH=/guidance/ node scripts/playable-check.mjs
```

Start only one dev server; it may already serve port 5173. Processes do not survive
an environment restart. Chromium is /usr/bin/chromium. Browser suites use software
WebGL and should run sequentially. Reports/screenshots are in ignored test-results/.

## Hosting and source preservation

Confirmed GitHub Pages is now enabled and built, branch gh-pages, root folder:
https://splcloseone.github.io/guidance/

That URL currently serves the previous hook prototype until this upgrade passes
and is pushed. API requests are allowed; do not request the old network change
again. The earlier static commit was b0fd5ff7fbe824eb37d48e4dbae38c934d0fc911.

Plan: commit the complete source and handoff on source-prototype, push that branch,
then publish the verified web artifact and check the deployed game. Main currently
contains the original README; avoid overwriting it or force-pushing any branch.
Local files are saved but the upgraded source is not yet committed or pushed.

The cloud environment configuration already stores tested install_script and
start_skill, plus api.github.com and splcloseone.github.io network additions.
An environment snapshot and the game's public website are separate publications.

## Deliberate limits

This is a local training lab, not multiplayer. Character bodies are upright boxes;
the player body is a sphere. Capture uses a raycast hit and physical tether, not
arbitrary curved-mesh snagging or rope wrapping. Path edits change rendered form;
thickness and strength affect tether physics. There is no arbitrary creature
rigging, free-form AI generation, full combat/parrying, world travel, economy,
housing or mobile touch input yet. Controller API is exercised synthetically;
physical hardware compatibility is not certified. Browser-local saves are not
cloud/account saves. Preserve these distinctions in handoffs and user messages.
