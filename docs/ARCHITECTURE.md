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
  form: 'hook', // hook | lasso | claw | orb | clay
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

Construct `SourceSimulation({ obstacles, dynamicObjects, actors, loadout })` with stable,
unique body IDs and descriptor positions/sizes. The player's collision shape is
a sphere; practice characters use upright boxes. The current local physics step
is 1/120 second with capped frame accumulation. This is not a verified
cross-machine deterministic lockstep simulation.

Key methods:

- `setCreation(definition)` normalizes the working design outside combat. Prepared slots remain separate.
- `attach(bodyId, worldPointArray, capturedDefinition)` validates the target, range, reserve, form,
  and friendly-hook setting, then creates a tether. The application supplies the
  raycast point; physics also checks that the point belongs near the body bounds.
- `release(reason)` dismisses the outgoing tether while retaining momentum.
- `step(dt, input)` advances movement, vitals, costs, actor behavior, and physics.
- `startPractice('rival' | 'rescue' | 'breakout' | 'melee' | 'combo')`, `resetPractice()`, and `reset()`
  manage lab scenarios. These are practice tools, not production respawn rules.
- `slam(directionArray)` lifts a caught rival on one activation and directs the
  subsequent slam toward a surface. The reserve of the Source is charged for each
  step.
- `getSnapshot()` exposes plain state for rendering/HUDs. `events` is a bounded
  queue drained by the application for feedback.

Tethers are unilateral constraints: slack produces no pushing force, while
tension pulls both movable ends according to their mass outside hostile combat.
Hostile pulls anchor the caster and bring the opponent toward them, braking
inward velocity on arrival so the opponent does not push the caster away.
Reeling changes allowed
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
Button presses alone do not deduct target health. General contact damage, parrying, guard, and PvP balance remain outside this lab.

Rescue success checks physical progress toward safety, such as arresting a fall
or pulling the ally onto the ledge. There is a reset/retry path. A practice reset
does not stand in for the full game's progression or death consequences.

## Saves and restoration

| Key | Contents |
| --- | --- |
| `the-source.creation.v1` | Active normalized version 2 design; historical key preserved. |
| `the-source.library.v2` | Up to 20 named designs. |
| `the-source.session.v1` | Safe grounded position, vitals, dynamic crate transforms, objectives, timestamp, remaining combat lock. |
| `the-source.loadout.v1` | Version 1 envelope with four normalized slot copies. |
| `the-source.controls.v1` | Touch button size/side and graphics preference. |
| `the-source.practice-settings.v1` | Friendly-hook preference. |

The application debounces design saves by 600 ms and checkpoints the session
every three seconds plus lifecycle events. Reload enters meditation only if its saved combat lock is zero. Live
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


## Solid clay and combat

`clay.js` owns a 28³ scalar density grid encoded as a bounded hex string. Optional
`solid: { data, purpose, kind? }` is present when `form: 'clay'`; existing version-2
records and storage keys remain compatible. No renderer objects enter the saved
definition. `clay-mesh.js` extracts the surface with Three.js MarchingCubes and
releases temporary geometry. `clay-workshop.js` owns a separate meditation dialog,
raycast brushes, symmetry, 24-state undo/redo, fitting guides and controller brush
controls. Every mutation uses the ordinary creation callback and autosave/library.
Drawing a tether and sculpting a solid are separate editors; choosing a purpose
never infers behavior from appearance. The grid is coarse and volume is not conserved.

`combat.js` owns deliberate aura activation/upkeep, selected equipment, timed
four-hit melee, stamina costs, one-hit-per-target-per-swing tracking, target
range/facing/height and intervening-solid checks, created equipment lifecycle,
protection and practice counters. It runs inside the fixed simulation step. Melee
uses a forward volume during its active window, not exact animated blade collision.
Armor reduction depends on saved strength, independent of coverage or shape.
Solid manifestations and aura consume the same reserve as tethers. They are never
serialized as active state. Physical sword selection is session-only; new loads
start in meditation unless combat-locked. Library data remains the durable design record.

`combat-view.js` consumes combat snapshots/events. It renders a physical sword,
procedural shoulder/torso/leg animation, white aura and blade trail, moving solid
leg armor, equipped solid sword, short synthesized sounds and bounded floating
damage numbers. It cannot award damage. Armor deformation is a basic leg bend,
not cloth simulation or an automatically generated skeleton. `practice-view.js`
shows the rival counter windup; actual counter damage belongs to `combat.js`.

## Prototype 3: prepared creations, combat state and touch

`loadout.js` normalizes four slots containing empty, fists, physical sword, or a
complete creation copy. It supplies defaults, catalog presets and bounded storage.
`loadout-ui.js` adapts meditation assignment and field selection/hold-to-dismiss.
Normalization assigns a fresh ID to duplicate slot identities, including older
persisted same-ID variants. Non-colliding IDs remain stable. Slot copies are
independent of the working editor and library: editing a saved
ID does not mutate a live creation. `setLoadout` requires meditation outside combat.

`selectSlot` equips a prepared weapon or manifests its definition. Armor and
weapon definitions are separately captured by Combat, independently sustained,
and never inferred from the current editor. Re-selecting an active ID is free.
Dismissing a slot checks identity and cannot dismiss another slot's creation.
Tether projectiles capture their definition on launch; attach validates/costs
that copy even if another slot has since been selected.

`combat.js` defines four timed swings with one buffered input, combo expiry, and a
heavy fourth strike with knockback. Tool profiles tune speed, damage, reach and
hit width; saved strength/scale tune power and reach/cost. `clay.js` supplies tool
silhouettes. Mining/farming/harvesting behaviors are not implemented. Older solids
without a tool kind keep their purpose and default weapon profile.

Combat begins on hostile catch, melee intent or incoming damage/counter. It lasts
8 seconds after the last hostile action, and remains active during capture/attack.
`setMeditation`, `setLoadout`, practice/reset operations and rest recovery enforce
this in the simulation. Blur clears controls and checkpoints without resting.
`session.js` bounds and persists remaining lock time. This prevents local menu/rest
loopholes; it is not trusted multiplayer persistence or anti-cheat.

Hostile hooks automatically reel opponents toward the caster. Friendly and world
hooks outside combat store a reel toggle; another tap stops it. Stronger hooks
still take more presses to escape, but standard capture is about six deliberate
taps, with slow decay and a minimum 0.11-second accepted press interval.

`summoning-view.js` owns the world-space white orb in front of the seated avatar
and brief manifestation flashes. `aura-view.js` owns animated white back-face
extrusion shells on body and complete weapon meshes; it observes aura state.
Replaced models detach shells before disposing their geometry/materials. These
visuals do not modify power or infer a behavior from a silhouette.

`controls.js` unifies keyboard, standard Gamepad and touch intent. Pointer IDs keep
the movement stick and camera drag independent; pointer cancellation and blur
clear held controls. Touch attacks/struggle are discrete actions. D-pad selects
slots in the field and navigates meditation controls in the workshop. See README
and the in-game guide for current mappings. Touch graphics default to no shadows
and capped device pixel ratio; saved quality settings are bounded on load.

Extension points: add normalized catalog data, geometry, an explicit simulation
capability, its input/visual adapters and behavior tests. A new animal requires
locomotion/rigging and its own abilities; adding a preset silhouette is insufficient.
