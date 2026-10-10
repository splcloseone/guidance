# The Source — Prototype 3

Prepare creations in meditation, save four battle slots, and try the hook-to-sword
combo in a third-person training ground. The Source appears as an orb in front
of your seated character. Spiking surrounds your body and weapon with white aura.

## Play

[Open The Source](https://splcloseone.github.io/guidance/?v=0.4.0) in a current
WebGL2 browser on a computer or phone. Landscape is recommended on phones.
The public site changes only when a build is published; see [PROGRESS.md](PROGRESS.md)
for the release verification record. These are local practice opponents, not online players.

For an offline copy, extract `releases/The-Source-Play.zip` and open
`The-Source.html`. Browser storage and file-launch policies vary; the public link
is the simplest way to play. Keep the same browser/site to retain saves.

## First test

1. Enter the proving ground and choose **Hook → 4-hit combo** in the Practice panel.
   On phones, tap **Practice** to open that panel.
2. Select slot **1**, aim at the rival, and attack to cast. Catching an opponent
   pulls **them toward you** automatically.
3. Select slot **2** for the physical sword. Tap attack four times, with a brief
   beat between presses: three strikes followed by a heavier fourth. Each press
   can queue one next swing; holding attack does not complete a combo for you.
4. **Spike** to reinforce attacks and surround your body and weapon with white aura.
   Actual hits show damage numbers. The rival can escape and counterattack.
5. Disengage and wait for the combat indicator to clear before meditating or
   resetting practice. Combat blocks creation editing and rest. Opening a menu,
   switching apps, or reloading does not grant free meditation.

Outside combat, catching a ring, crate, or friendly character leaves reeling in
your control. **Tap Reel** to start, then tap again to stop. Movement while hanging
lets you swing; release retains momentum. Try Rescue and Breakout practice too.
Escaping takes several deliberate taps; holding the button counts only once.

## Prepare creations

In meditation choose a hook/lasso/claw or a solid preset: sword, leg armor, axe,
pickaxe, hoe, sickle, or scythe. Customize its color, scale, strength, and relevant
parameters. Choose a destination and press **Assign & save slot**. Editing the
working design does not silently replace a prepared slot: assign it again to update it.

The four initial slots are hook, physical sword, leg armor, and sword of the Source.
Selecting an already active creation is free. Armor can remain active while you
use another weapon; each sustained creation draws from the same reserve. Tap a
slot to select it, or hold it to dismiss that creation. E / LB dismisses the
selected slot. Saved designs remain available after dismissal or exhaustion.

**Save creation** adds the working design to the separate library (up to 20).
Optional curve editing, offline description assistance, and the solid clay lab
remain available. Old designs and storage keys are preserved. Sculpted appearance
alone does not confer an unknown behavior: choose armor or weapon purpose explicitly.
The solid editor has a bounded 28³ grid, five brushes, symmetry, and undo/redo.

Tool presets have different combat speed, reach, damage and swing width. Sickle
is quick and close; scythe reaches farther with broad swings; axe hits harder;
pickaxe has a narrow forward hit area. Hoe has a broad, lower-damage swing.
**Mining, farming and harvesting are planned**, not functional life skills yet.
Animals, mounting and arbitrary object generation also need additional systems.

## Controls

Controller labels use the standard browser Gamepad layout.

| Action | Keyboard / mouse | Controller | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick | Movement stick |
| Look | Right mouse drag | Right stick | Drag the world |
| Select saved slot 1–4 | 1 / 2 / 3 / 4 | D-pad left / right / up / down | Tap a slot |
| Attack / cast with selected weapon | Left mouse | RT | Attack / Use |
| Dedicated tether cast | F | Select hook then RT | Select hook then Attack |
| Spike / calm aura | C | B in the field | Spike |
| Dismiss selected | E | LB | Dismiss / hold slot |
| Reel in / stop | Tap Q | Tap LT | Reel |
| Pay out / stop | Tap R | Tap RB | — |
| Jump / sprint | Space / Shift | A / L3 | Jump / — |
| Lift, then slam caught rival | T twice | X twice | Lift / Slam twice |
| Struggle free | Repeated B taps | Repeated R3 presses | Repeated Break Free taps |
| Meditation | M | Y | Meditate |
| Map / guide | G / H | View / Menu | Minimap / Guide |
| Close menu | Escape | B | Close button |
| Practice | Panel; 5 sword / 6 combo | Practice panel | Practice panel |
| Physical equipment cycle | V | Use prepared slots | Use prepared slots |
| Workshop navigation / activate | Tab / Enter | D-pad / A | Tap controls |
| Adjust focused slider | Arrows / drag | D-pad left/right | Drag |

In meditation the D-pad navigates the workshop. Native text and color inputs
remain browser controls. Phone button size, side, and graphics quality are
adjustable in meditation. Touch controls support simultaneous movement and look.
Specific phones, controllers, and consoles still require real hardware testing.

## Reserve, combat and saving

- Spiking costs 5 to activate plus 2/sec, increases melee damage by 50%, and
  reduces melee damage taken by 30%. Physical weapons use stamina. Exhaustion
  dismisses creations and weakens physical movement and damage.
- Solid creations cost `7 + strength` to activate and
  `(0.4 + strength × 0.2) × scale` per second. Strength influences damage or armor
  protection; weapon scale influences reach. The workshop shows current costs.
- Tether reach and reinforcement influence reserve cost. Thick tethers resist
  struggle better. Pulling, lifting and slamming consume additional reserve.
- Rest outside combat restores vitals. Armor and aura protect against melee, not
  falls; their combined reduction caps at 65%. Surface shape does not calculate
  sharpness or armor coverage. Hits use a forward volume, not exact blade contact.
- Working design autosave waits 600 ms after editing; slots save when assigned.
  Position, vitals, crates and progress checkpoint every three seconds and on exit.
- Reload normally begins in meditation. A saved combat lock instead resumes in
  the field until its remaining time expires. Active manifestations disappear and
  practice actors restart. This is local persistence, not a multiplayer logout rule.
- Saves belong to this browser and origin. Clearing storage removes them; storage
  failures are shown in the UI. There are no accounts or cloud saves.

## Develop and verify

Requires Node.js 20.19+ or 22.12+ (workspace: Node 24) and a WebGL2 browser.

```sh
npm ci --cache /tmp/source-npm-cache --no-audit --no-fund
npm test
npm run dev -- --port 5173
```

With one dev server running, run software WebGL suites **sequentially**:

```sh
npm run test:prototype3
npm run test:core
npm run test:browser
npm run package:play
PLAYABLE_FILE=releases/web/index.html PLAYABLE_PATH=/guidance/ node scripts/playable-check.mjs
```

`CHROMIUM_PATH` overrides `/usr/bin/chromium`; `APP_URL` overrides the internal
server. Reports and screenshots go in ignored `test-results/`. Cloud loopback
addresses are for development, not public play links. Packaging creates standalone
HTML, a ZIP and `releases/web/`; publishing is a separate step.

## Continue development

The simulation, saved definitions, input, visuals and UI have separate modules.
This provides extension points; it does not make every future mechanic automatic.
Full multiplayer, parrying/guard, creature behavior, worlds, dungeons, housing,
economy and progression remain future work.

- [ARCHITECTURE.md](docs/ARCHITECTURE.md): state ownership and extension points.
- [CONTINUING.md](docs/CONTINUING.md): resume, validate and publish.
- [DESIGN.md](DESIGN.md): broader game concept.
- [PROGRESS.md](PROGRESS.md): current checkpoint and release evidence.
- [PLAY-ONLINE.md](docs/PLAY-ONLINE.md): GitHub Pages delivery.
