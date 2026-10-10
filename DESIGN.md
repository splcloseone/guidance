# The Source — agreed direction

This records the user's design, not a claim that these systems are implemented.
The current implementation is the meditation/hook prototype described in README.md.

## Foundation

- Third-person multiplayer open-world action game, approximately 50 players/server.
- No classes. Players choose and change roles, equipment, and fighting styles.
- Player-driven goals, optional NPC tasks, life skills, exploration, trade, and PvP.
- Keyboard/mouse and controller support in the first test; more platforms later.
- Meditation creation and testing is the highest development priority.

## The Source

- Always call it **the Source**. It originates in every living thing.
- Humans learn control; some animals use it instinctively. Physical objects can
  hold the Source when someone infuses them.
- People begin with different reserves; everyone can expand theirs.
- Imagination guides manifestations: elements, objects, creatures, and techniques.
  Beginners practice; mastery makes manifestation immediate if reserve permits.
- Aura is the purest form and has greatest raw strength, but strategy and other
  applications can overcome it. Aura color is customizable (supersedes white-only).
- Deliberately spiking aura signals readiness to fight.
- Creation has a substantial initial cost and smaller continuous upkeep. More
  powerful/complex work costs more. Destroyed creations can be replaced if affordable.
- Death, logout, or exhaustion dismisses active creations; saved designs persist.
- Combat, meditation, and exhaustion train reserves. Complete exhaustion gives
  the most noticeable/efficient growth, followed by rest.
- Sitting, sleeping, and relaxing restore reserves. No natural combat recovery;
  food, water, and potions can replenish them.
- Empty reserves cause weakness but do not prevent physical movement/fighting.
- Healing is a trainable application that spends reserve to restore health.

## Combat and movement

- Blocking has guard durability. Repeated direct hits wear it down; unblockable
  attacks bypass it. Damage over time does not wear guard down that way.
- Parries require last-second timing. Healing can be interrupted.
- Combat pace emerges from equipment and the Source, rather than one fixed style.
- Climbing costs stamina, trained through physical activities. Fall damage exists.
- The Source can reinforce legs for faster movement/higher jumps. Boats travel seas.
- Weapons: one-handed sword, greatsword, daggers, spear, hammer, mace, gauntlets/
  unarmed, staff, chain blade, bow, crossbow, shield. No poleaxe. Describe mace on
  its own terms, without using hammer comparisons.

## Races and starting worlds

| Race | Home / starting world | Starting city | Agreed traits |
| --- | --- | --- | --- |
| Humans | Zoophaus | Harthaven | Harder early training, potential for precise efficient control |
| Dwarfs | Zoophaus | Keldrum | Smaller, short reach, strong grip/balance, sensitivity to infused objects |
| Dog people | Velora | Darroway | Tracking/hearing/endurance; vulnerable to elemental attacks |
| Cat people | Ilyra | Sivelle | Balance, low-light vision, agility; vulnerable to elemental attacks |
| Giants | Orrun | Orrath | Strength/reach; larger body and hitbox |
| Nerai | Nerith | Nacreth | Air/water breathing, swimming/underwater sensing; dry conditions weaken stamina |

All races can learn every use of the Source. Dwarfs are smaller, giants larger;
others use standard scale. Race selects starting world. Friends meet via dungeons.

## Cities

Each world has cities founded by each race, open to all races.

| Founding race | Zoophaus | Velora | Ilyra | Orrun | Nerith |
| --- | --- | --- | --- | --- | --- |
| Humans | Harthaven | Bellwick | Asterport | Dunmere | Saltmere |
| Dwarfs | Keldrum | Vardek | Tesselhold | Brondal | Peldrum |
| Dog people | Rookford | Darroway | Keswick | Valden | Brinlow |
| Cat people | Lysenne | Miravel | Sivelle | Elaris | Iridel |
| Giants | Torvann | Haldrun | Veyrath | Orrath | Moruun |
| Nerai | Ossara | Lethai | Nimora | Uldren | Nacreth |

Nerai cities are underwater, with air-filled visitor areas proposed.

## Geography and dungeons

- Zoophaus: Avenor (starting region Larkreach), Serevin, and dark continent Umber.
- Seas/oceans: Vastmere Ocean, Orison Ocean, Copper Sea, Stillglass Sea.
- Umber is four times the regular starting region's size, offers double gains,
  and has monsters twice as large and twice as dangerous. Territory is valuable.
- Dungeons are the only route between worlds. No bed/respawn loopholes.
- Each of five worlds has four travel dungeon locations, one connection to each
  other world per day. Zoophaus has an additional Umber dungeon: 21 total locations.
- One game day = four real hours. Routes stay fixed within a day, change at reset,
  and eventually repeat so players can learn the pattern.
- Dungeon structures remain. Players inside at reset are ejected to their entrance
  in the world they entered from; only routes change.
- Umber's fifth dungeon never leads to another world. Interior layout, monsters,
  bosses, challenges, and loot randomize every four-hour reset.
- Dungeon names must never describe their monsters. Proposed names: The Ninth
  Archive, The Sunken Meridian, The House of Still Hours, The Sevenfold Stair,
  The Hollow Observatory; Umber dungeon: The Unfinished Palace.

## Territories, houses, death, economy

- Territories are remote villages producing regional resources (plains wheat/bread,
  forest materials, mountain ore, etc.). Monopolies are possible.
- Owners protect territories themselves. No automatic protective systems or offline
  immunity. Players or hired NPCs can transport goods; NPCs are weak at PvP.
- Flags can be anywhere within the village radius. Grab and burn an owner's flag
  to leave the village unclaimed; plant a new flag to claim it.
- Residential land is separate, in a roughly 2,000m belt around major cities.
- Buy houses or buy land/build highly customizable mansions; persistent storage,
  furniture, workshops, gardens, racial scale options, and access permissions.
- Death permits respawn. Ordinary carried bags are lost; special storage-space
  bags/rings protect contents. Equipped-item drops were not settled.
- Choose a valid bed or nearest city teleporter in the current world only.
- Currency: **change**. Anchor prices: apple 1; bronze sword 100. Every item has
  a reference value; actual value also depends on usefulness, quality, supply, etc.
- Income: quests, discoveries, selling, crafting, deliveries, and territories.
- Cooking, brewing, fishing, mining, gathering/farming, smithing/construction.
  Equipment also comes from dungeons.

## Rarity and UI

- Common Runebone: weathered ivory/dark bronze, carved runes.
- Uncommon Embersteel: copper/burnt orange, embers.
- Rare Soulrose: deep rose/spectral pink, wisps/crystals.
- Epic Riftglass: midnight teal/seafoam, fractured swirling energy.
- Legendary Bloodstorm: black/red with red lightning effects.
- Mythic Eclipse: matte black/silver fractures and eclipse halo.
- Rarity labels/patterns accompany colors; these do not restrict aura appearance.
- Visible minimap with player indicator, expanding to large map in the menu.
  No supplied dungeon route schedules or automatic hidden flag markers.
- Hotbar, health/the Source/stamina indicators, contextual guard bar, party UI.
- Quest journal/tracker for optional NPC, personal, and shared party goals.
- House permissions menu; creation workshop in meditation with saved designs.

## Next design questions

The free-form creation editor, full behaviors, multiplayer/network persistence,
precise progression/economy balance, and many combat values remain to be designed
and tested. Preserve the user's freedom principle without claiming an unbounded
simulation is already technically solved.


## Prototype 3 decisions (2026-10-09)

Presets lead creation; cosmetic clay tools remain optional. A visible orb of the
Source floats directly in front of the seated character during meditation.
Prepare and save creations before battle; meditation/editing is forbidden in
combat. Four slots support quick keyboard, controller and touch selection.
Armor may persist while using another weapon, with independent reserve upkeep.

Combat hooks pull the opponent toward the caster automatically. Outside combat,
reeling is a press-to-toggle action. Escaping is easier but still requires
repeated deliberate presses. Sword attacks chain through four inputs, with a
heavy fourth. White spiking aura must visibly cover both body and weapon.

Mobile-friendly controls are a priority before expanding the catalog. Sword,
armor and tool presets have explicit behaviors; geometry alone does not identify
an arbitrary object. Fantasy animals can later gain distinct abilities through
new capabilities. Tool life skills, story/stages and the larger open world remain
planned. See PROGRESS.md for what is actually built and verified.
