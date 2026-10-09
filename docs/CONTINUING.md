# Continue development

Start with `README.md` for the player loop, `PROGRESS.md` for the latest checkpoint,
and `docs/ARCHITECTURE.md` for code contracts. `DESIGN.md` contains the larger game
plan; its planned features are not a checklist of already implemented mechanics.

## Resume safely

1. Inspect `git status --short` and the recent history. Preserve existing changes,
   including another developer's unfinished work.
2. Read the latest checkpoint before repeating installation, tests, or deployment.
   Processes do not survive every cloud environment restoration even when files do.
3. Install exact locked dependencies if needed:

   ```sh
   npm ci --cache /tmp/source-npm-cache --no-audit --no-fund
   ```

4. Check whether a Vite process already serves port 5173 before starting another.
   When needed, run:

   ```sh
   npm run dev -- --port 5173
   ```

The development server supports internal HTTP and browser validation. A cloud
loopback URL is not a usable public link for the player. The published game is at
`https://splcloseone.github.io/guidance/`; source edits and a successful local build
do not update that website by themselves.

Node 20.19+ or 22.12+ is required by Vite; this workspace uses Node 24. Runtime
dependencies are `three` and `cannon-es`; no new service or API key is needed.

## Verify behavior

For domain or simulation changes, run the relevant Node tests first, then the full
Node suite and build before a release:

```sh
npm test
npm run build
```

Tests live in `tests/`. Creation tests cover normalization, old-save compatibility,
presets/library behavior, descriptions, and renderable geometry. Simulation and
actor tests cover the tether, costs, motion, capture, struggle, slams, rescue,
friendly-hook handling, and restoration contracts. Keep tests centered on
observable behavior rather than duplicating the implementation.

With Vite running, the new browser scenarios are:

```sh
npm run test:core
```

Run only one when investigating a specific failure:

```sh
BROWSER_SUITE=creation npm run test:core
BROWSER_SUITE=practice npm run test:core
BROWSER_SUITE=sculpt npm run test:core
```

The original browser suites remain useful regression coverage:

```sh
npm run test:browser
```

Its `BROWSER_SUITE` values are `functional`, `hook`, or `controller`; these are a
different runner from the core suites. Both accept `CHROMIUM_PATH` and `APP_URL`.
By default they use `/usr/bin/chromium` and the internal Vite server on port 5173.
Run the suites sequentially: multiple software WebGL renderers can distort input
and physics timing on small cloud machines. Inspect `test-results/` for JSON
reports, errors, and screenshots. Do not mistake an old report for a new run.

Browser tests verify rendered output and real UI interaction. Development-only
`window.__SOURCE_DEBUG__` provides snapshots and lab helpers for assertions; it
is excluded from the production build. Do not make product features depend on it.

Controller automation uses the standard Gamepad API with synthetic input. Test
real hardware separately before asserting compatibility with specific devices.
The text/color fields use native browser inputs, and touch gameplay is absent.

Record exact outcomes, known failures, and any environmental limitation in
`PROGRESS.md`. Documentation commands are instructions, not evidence of a pass.

## Make an extension

Trace the smallest complete path through the system. For example, a new editable
creation property usually touches normalization/storage, workshop controls,
renderer or simulation behavior, then its validation and docs.

Preserve these contracts:

- The historical active-design key contains the newer schema. Add a migration or
  normalization path before changing field meanings or keys, and retain fixtures
  from earlier saves.
- One normalized definition feeds both preview and manifestation. Keep scene
  objects and physics bodies out of JSON definitions.
- The simulation owns reserve costs, damage, attachment permission, and escape.
  UI adapters display these results rather than computing competing rules.
- If a property is only visual, say so. New curved appearance does not imply
  physical snagging, rope wrapping, articulation, or new capabilities.
- When adding an action, update keyboard/controller input, on-screen help, README,
  and a meaningful behavior test together.
- Dispose replaced geometries/materials and detach listeners when introducing
  re-created views. Preserve the workshop's layout and existing play loop.
- Keep saved designs and active manifestations separate. Scenario actors and
  tethers must not be half-restored into an inconsistent session.

The next architectural decisions should follow the next agreed feature. Useful
future boundaries include data-driven capabilities, articulated part graphs, and
trusted multiplayer commands, but they should not be presented as implemented.

## Package and publish

```sh
npm run package:play
node scripts/playable-check.mjs
```

The Node packager builds the static app and writes the standalone HTML,
instructions, licenses, and a new ZIP under `releases/`. It also prepares
`releases/web/` for hosting. Check that the ZIP's HTML matches the newly generated
`The-Source.html` before sharing a release. A stale archive can otherwise serve
older code even when the working tree is correct.

`playable-check.mjs` serves the bundled HTML in isolation and checks it without
runtime network access. The cloud browser blocks direct `file://` navigation, so
that test does not establish desktop file-launch behavior in every browser.
The standalone game needs WebGL2 and uses browser storage subject to browser policy.

Keep editable source, tests, docs, and the lockfile together in version control.
The `gh-pages` branch holds published static output. Follow
`docs/PLAY-ONLINE.md` for the current hosting workflow; avoid replacing a source
branch with distribution files. The publisher previews its prepared files by
default:

```sh
npm run publish:pages
```

When publishing the verified release within the authorized task, use:

```sh
npm run publish:pages -- --publish
```

This performs a normal fast-forward push to `origin/gh-pages` without changing
the current checkout or index. A conflicting remote update fails rather than
being force-pushed away. GitHub Pages uses that branch as its configured source.
After publication, verify the actual public URL and updated content before
telling the player that new features are online.

Before handing work off, update `PROGRESS.md` with what changed, what was tested,
what is still local versus published, and the next concrete task. Include any
unfinished problem and its reproduction so another developer can continue from
repository files without needing the entire conversation.
