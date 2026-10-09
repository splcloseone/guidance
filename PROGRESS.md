# The Source — continuation checkpoint

Updated 2026-10-09. Read README.md, AGENTS.md, docs/ARCHITECTURE.md, and
DESIGN.md before continuing. Prototype 0.2.1 is published and ready for player
feedback. Preserve the release and test evidence below when extending it.

## Ball-shaping fix (0.2.1, published)

The user reported that the ball could not be shaped. The old orb editor changed
only ellipsoid bounds, while the stretch button substituted a finished preset.
The fix adds actual stroke-to-curve authoring through both the preview and editor.
Choosing Ball opens the editor; its traced outline becomes the saved tether path.
The keyboard/controller stretch button supplies an unbent strand to edit.

Added src/shaping.js with bounded arc-length resampling, tests/shaping.test.js,
and the core browser "sculpt" suite. All 46 unit tests pass. The sculpt browser
suite passed actual preview/editor drawing, geometry autosave/reload, catching a
world anchor with the drawn creation, and keyboard bending of a blank strand.
Creation regression and standalone package checks also passed, with no browser
errors or extra runtime asset requests. ZIP integrity and HTML equality passed.
The fix is committed on source-prototype at 57c65a7. GitHub Pages reports built
for a2bf8c857cd516ac954adfff3b76b671761dbdd4, and the public HTML matches the
tested release exactly. No schema migration or clearing browser data is needed.

## Current work

The user approved developing the creation system with editable presets, optional
shaping assistance, description assistance, and physical hook/lasso interactions
against practice characters. They requested a difficult repeated-press breakout,
friendly rescues, autosave, and a codebase another developer can continue.

Implemented and released:

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

## Previous release verification (0.2.0)

- All 43 unit tests pass, including legacy save migration, library capacity,
  custom geometry, impact damage, tether breakout and near-face rescue catches.
- Both core browser suites pass: creation editing/library/reload and actual
  capture/drag/lift/slam/rescue, controller slam, and repeated controller escape.
  The escape check needed 31 deliberate taps; holding counted only once.
- Rescue is fixed: character tethers reel down to 1 m; world/prop tethers retain
  2 m. The ally must physically reach the safe area; the success criterion remains.
- Build/package succeeded. ZIP integrity and HTML equality were checked using
  Python's independent ZIP reader. Vite's >500 kB advisory is not a build failure.
- After restarting Vite, all original browser suites passed: functional, hook,
  and controller. No browser errors were reported.
- The standalone release passed at the /guidance/ subpath: rendered scene,
  keyboard movement, guide, autosave/reload, no extra asset requests, and offline
  gameplay. Managed Chromium blocks file URLs, so this used an isolated server.
- GitHub Pages reports built for c0683e78b75c320d43adbc1c97d30f0b6fa53e83.
  An HTTPS request with certificate verification retrieved HTML exactly matching
  the tested release (SHA-256 below).
- Direct public-site Chromium navigation was blocked by the cloud proxy's
  certificate trust (ERR_CERT_AUTHORITY_INVALID). No TLS verification was disabled.
  Public delivery was verified by curl; game behavior by the identical local
  artifact. Physical controller hardware remains untested.

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

Prototype 0.2.1 is live:
https://splcloseone.github.io/guidance/?v=0.2.1

GitHub Pages uses gh-pages, root folder. Published commit:
a2bf8c857cd516ac954adfff3b76b671761dbdd4
HTML SHA-256:
664e753bdaea8ec83781b7d8a65bbfeb5ebb51fbd67f0cb751aad9815e08d433

Complete editable source, tests and handoff are on source-prototype:
https://github.com/splcloseone/guidance/tree/source-prototype
The implementation commit is ad12aa0; subsequent documentation commits record
release verification. Main retains the original README. No force push was used.
Generated files stay in ignored releases/; rerun npm run package:play to reproduce.
The old hook-only release is retained in gh-pages history at b0fd5ff7.

Network access is working. Do not request the earlier api.github.com or
splcloseone.github.io additions again. Future publishing needs the existing
repository access and the explicit --publish flag, not a new Pages setup.

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

## Next step

Let the user test this release. Prioritize their feedback about shaping, catching,
rescue, slam motion, and breakout effort before adding another large system.
Do not repeat completed checks unless relevant code changes or a new failure
warrants it. Keep the hosted build and source branch clearly distinguished.
