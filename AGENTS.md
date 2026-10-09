# Working on The Source

Read `README.md`, `PROGRESS.md`, and `docs/ARCHITECTURE.md` before changing the
prototype. `docs/CONTINUING.md` gives the reproducible workflow. `DESIGN.md`
records the broader game concept; distinguish planned features from implemented
ones when explaining or documenting work.

## Preserve the direction

- Call the power **the Source**. It comes from life, consumes a finite reserve,
  can be trained, and should support creative use. All races can use it; there
  are no classes.
- Meditation is the creation workshop. Presets, manual shaping, optional shaping
  assistance, and description assistance should lead into the same editable
  saved definition.
- Preserve the established UI layout and support keyboard/mouse and standard
  controller input for the first playable tests.
- Current character practice is local. Do not describe it as multiplayer or
  claim arbitrary text-to-object generation, mesh collision, or finished combat.
- Saved designs persist; active manifestations do not survive reload, death, or
  reserve exhaustion. Preserve existing browser saves when changing schemas.

## Implementation contracts

- Keep serializable creation data in `src/creation.js`; normalize data at loading
  and editing boundaries. Do not put DOM, Three.js, or Cannon instances in saves.
- Keep physics rules in `src/simulation.js` and actor state in `src/actors.js`.
  DOM controls and rendered appearance must not become authorities for damage,
  reserve costs, friendly-hook rules, or escape success.
- Share the same creation definition between preview, world rendering, and the
  simulation. Dispose replaced Three.js geometry and materials.
- Keep keyboard and controller mappings together in `src/controls.js`; update
  the in-game Guide and README when mappings change.
- Preserve user changes and existing work. Check the working tree before editing;
  do not overwrite unrelated files or reset saves to make a test pass.
- Use focused tests for changed behavior, then the relevant browser scenarios.
  Run software WebGL suites sequentially. Never report tests as passed without
  their actual results; physical controller checks are separate from synthetic
  Gamepad tests.
- Keep `PROGRESS.md` current with completed work, test outcomes, limitations, and
  the next concrete step. Update architecture/continuation docs when contracts or
  workflow change so another developer can resume from repository files.

No new framework or networking stack is required for the current local lab.
Introduce abstractions for a demonstrated need; avoid claiming the code is
"future-proof" or already suitable as a trusted multiplayer server.
