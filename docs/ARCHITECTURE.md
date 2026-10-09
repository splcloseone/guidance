# Prototype architecture

The application is a Vite ES-module web app using Three.js for rendering and
Cannon for physics. It runs locally in one browser. There is no backend, account,
remote inference service, or multiplayer transport. These boundaries make the
current work easier to extend and test; they are not a promise that new systems
will fit without further design.

## Modules and ownership

| Module | Owns / public entry points |
| --- | --- |
| `src/creation.js` | Serializable creation definitions, presets, normalization, description vocabulary, and active-design/library storage. `normalizeCreation`, `creationFromPreset`, `describeCreation`, `loadCreation`, `saveCreation`, `loadLibrary`, `saveLibrary`, `upsertLibrary`. |
| `src/shaping.js` | Converts a pointer stroke into evenly spaced bounded handles (`shapeFromStroke`); provides an unbent strand for keyboard/controller authoring (`stretchBall`). No UI or renderer state. |
| `src/workshop.js` | DOM and pointer adapter for presets, descriptions, point editing, shaping assistance, and library controls. `initWorkshop({ getCreation, onChange, storage, toast })` returns `sync`, `saveDesign`, `dispose`. |
| `src/simulation.js` | Physics world, bodies, player vitals/movement, tethers, costs, practice lifecycle, struggle, and collision damage. `SourceSimulation` is independent of the DOM and renderer. |
| `src/actors.js` | Local actor descriptors, mutable actor state, snapshots, and escape tuning. No scene or DOM objects. |
| `src/models.js` | Creation and avatar meshes. `createHook(creation)` retains its historic name but draws every supported form; returns `group`, `material`, and idempotent `dispose`. |
| `src/world.js` | Procedural scenery, physics descriptors, hook targets, and practice scene integration. `createWorld()`. |
| `src/practice-view.js` | Character meshes, labels, and tether/binding visuals. `createPracticeView(...)` consumes simulation snapshots and exposes update/disposal. |
| `src/practice-ui.js` | Practice buttons, status/meters, and the saved friendly-hook preference. `createPracticeUI(...)`, `practiceInstructions(...)`. |
| `src/controls.js` | Keyboard, pointer, and standard Gamepad mapping. `Controls.read(dt)` produces movement, look, reel, struggle, and action intent. |
| `src/session.js` | Safe session snapshots and validation. `loadSession`, `saveSession`, `restoreSession`. |
| `src/main.js` | Composition: frame loop, camera/raycast, UI integration, saving schedule, scene updates, and development-only debug hooks. |
| `index.html`, `src/style.css` | UI structure and presentation. |

The normal edit path is workshop input → normalized definition → application
state → preview/world renderer and simulation. The play path is input intent →
simulation step → snapshot/events → scene and HUD. Rendering observes gameplay
state; it does not decide damage or escape success.

## Creation definition and compatibility

The current definition has this shape:

```js
{
  version: 2,
  id: 'creation-...',
  form: 'hook', // hook | lasso | claw | orb
  name: 'Tethered Hook',
  color: '#8fdcc8',
  reach: 28,
  reelSpeed: 7,
  strength: 3,
  hookSize: 1,
  shape: {
    points: [[0, 0.55, 0], /* further finite [x, y, z] coordinates */],
    thickness: 0.055,
    assisted: true
  }
}
```

`normalizeCreation` returns a fresh, bounded definition. It limits names, checks
IDs/colors/forms, repairs invalid values, removes consecutive duplicate points,
and supplies a default path when fewer than three usable points remain. Paths
have at most 12 points with coordinates in [-1.5, 1.5]. Numeric property limits
live in this function; change it and its tests when extending the data contract.

The active-design storage key remains **`the-source.creation.v1`** deliberately.
Its contents normalize to version 2, including older definitions without shape,
form, or version fields. Renaming the key without a migration would strand
existing players' saved designs.

The library uses **`the-source.library.v2`** with a
`{ version: 2, creations: [...] }` envelope. IDs identify updates to existing
designs. A new preset receives a new ID; repeated saves of the same ID update it.
The library retains at most 20 designs. When full, it rejects an additional new
design with a visible message while still allowing updates to an existing ID.
Saving must not silently remove another design.

Active design edits autosave; adding/updating a library entry requires **Save
creation**. Do not imply that every unsaved library revision is a separate saved
design. Storage errors are surfaced, and in-memory editing can continue.

## Shape semantics

- **Hook:** an open path. **Lasso:** a closed path. **Claw:** three prongs rendered
  from one shared path. **Orb:** an ellipsoid defined by the handles' bounds.
- Assisted paths use a smooth centripetal curve; unassisted paths use straight
  segments between points. Assisted pointer dragging snaps to a small grid.
- The shape editor is a two-dimensional point view with a separate depth
  control. It is not voxel sculpting or unrestricted solid modeling.
- Dragging in the preview/editor while drawing converts a ball to the actual
  traced open path, resampled to at most 12 handles. Tiny drags leave it unchanged.
  **Stretch into a strand** seeds a straight editable path for keyboard/controller
  users; it does not substitute a completed hook preset. An orb cannot cast until
  converted to a path. This is curve drawing, not unrestricted solid sculpting.
- Preview and world manifestation consume the same definition. Geometry disposal
  matters because editing repeatedly replaces meshes.
- Point positions and overall scale affect appearance. Thickness also affects
  reinforcement. The curve is not a physical collision mesh, so an unusual
  shape does not yet acquire new contact behavior just from its outline.

`describeCreation` is a deterministic offline vocabulary parser. It accepts the
supported forms, named/hex colors, and a small set of size/reach/speed/strength/
thickness adjectives. It rejects unknown or conflicting input with a useful
message. No language model is called. A horse, creature behavior, and arbitrary
commands are unsupported rather than silently converted into hooks.

## Simulation contract

Construct `SourceSimulation({ obstacles, dynamicObjects, actors })` with stable,
unique body IDs and descriptor positions/sizes. The player's collision shape is
a sphere; practice characters use upright boxes. The current local physics step
is 1/120 second with capped frame accumulation. This is not a verified
cross-machine deterministic lockstep simulation.

Key methods:

- `setCreation(definition)` normalizes settings for the next manifestation.
- `attach(bodyId, worldPointArray)` validates the target, range, reserve, form,
  and friendly-hook setting, then creates a tether. The application supplies the
  raycast point; physics also checks that the point belongs near the body bounds.
- `release(reason)` dismisses the outgoing tether while retaining momentum.
- `step(dt, input)` advances movement, vitals, costs, actor behavior, and physics.
- `startPractice('rival' | 'rescue' | 'breakout')`, `resetPractice()`, and `reset()`
  manage lab scenarios. These are practice tools, not production respawn rules.
- `slam(directionArray)` lifts a caught rival on one activation and directs the
  subsequent slam toward a surface. The reserve of the Source is charged for each
  step.
- `getSnapshot()` exposes plain state for rendering/HUDs. `events` is a bounded
  queue drained by the application for feedback.

Tethers are unilateral constraints: slack produces no pushing force, while
tension pulls both movable ends according to their mass. Reeling changes allowed
length; releasing retains motion. Rope wrapping around obstacles, cutting a
rendered segment with a weapon, and mesh-to-mesh hook snagging are not implemented.

Reinforcement currently equals `strength * sqrt(thickness / 0.055)`. It increases
the force ceiling, escape difficulty, activation cost, and upkeep. The default
thickness preserves the original hook's costs. Settings needed during a tether's
lifetime are captured at attachment, so editing the next design does not change
an existing connection midway through use.

## Character practice

Rival and ally are local practice actors. They move and participate in the same
physical connection as objects; they are not remote players. The friendly-hook
preference defaults to enabled and applies to the ally. Disabling it releases an
existing friendly tether and blocks a new attachment.

The rival begins struggling after capture. Breakout reverses the situation: the
player is tethered and repeatedly presses the struggle control. The simulation
counts rising edges, rate-limits them, and decays escape progress between presses.
Holding one button is therefore different from repeated intentional presses.
`STRUGGLE_RULES` and `escapeThreshold` in `actors.js` define the tuning. Stronger
reinforcement requires more sustained effort. General weapon attacks on a tether
are a later combat extension.

The slam sequence stores a stage on the tether: held → lifted → slammed. A
deliberate slam arms a short collision window. Damage depends on relative impact
speed against an eligible surface, with a minimum speed, cooldown, and cap.
Button presses alone do not deduct target health. General contact damage, melee,
parrying, guard, and PvP balance remain outside this lab.

Rescue success checks physical progress toward safety, such as arresting a fall
or pulling the ally onto the ledge. There is a reset/retry path. A practice reset
does not stand in for the full game's progression or death consequences.

## Saves and restoration

| Key | Contents |
| --- | --- |
| `the-source.creation.v1` | Active normalized version 2 design; historical key preserved. |
| `the-source.library.v2` | Up to 20 named designs. |
| `the-source.session.v1` | Safe grounded position, vitals, dynamic crate transforms, objectives, timestamp. |
| `the-source.practice-settings.v1` | Friendly-hook preference. |

The application debounces design saves by 600 ms and checkpoints the session
every three seconds plus lifecycle events. Reload enters meditation. Live
tethers are never serialized, and practice actors restart rather than restoring
transforms without their health/capture/behavior state. Crates remain eligible
for safe restoration.

These are origin-scoped browser saves. Hosting and a downloaded file do not share
them automatically. No credentials or private server state belong in this data.

## Extension boundaries

Adding a form requires its normalized definition, preset/editor behavior,
renderer, capabilities, and meaningful tests. A new silhouette alone does not
implement its intended physical use. Keep capability rules in the simulation,
then expose them through UI/input adapters.

Articulated creatures need a representation of connected parts, joints,
locomotion, commands, and mounting. Multiplayer needs trusted simulation and
validation, replication, ownership, reconciliation, and save policy. The local
snapshot/input boundaries provide useful starting points; neither system is
implemented by those boundaries alone.
