# Mission `ring` — runtime API

The A10 ring road, level 2 (spec: `docs/design/ring.md`). This file documents the core runtime
(`src/game/ring/`) that the builders extend. The ring runs on the **unchanged** engine `World`:
nothing in `src/engine/`, `mission/runner.ts`, `Player`, `Vehicle`, `Enemy` or `Boss` changes at
run time, so `ams` and m0–m5 stay byte-identical (spec §13). `ring` is **not** registered with
`defineMission`.

## 1. Files and shared ids

| File | Contents | Owner after the core stage |
|---|---|---|
| `ring/ids.ts` | `RING_ID`, `RING_LANDMARKS`, `RING_ENTITY` (wave A), `RING_ENTITY_B` (wave B), `RING_CAR_MODELS`, `RING_ART` prefixes, `landmarkDecor(id)` | add only |
| `ring/types.ts` | `RingPlan` and its parts, `RingViewHost`, the tuning `RING` | GEN may only add fields |
| `ring/lanes.ts` | the screen layout, lanes, slabs, the 8 aims | core |
| `ring/entity.ts` | `RingEntity`, slab helpers, `RingHost` / `ringOf(world)`, lift, shadows | core |
| `ring/runner.ts` | `RingRunner` | core |
| `ring/continue.ts` | `RingContinue` (the in-world continue) | core |
| `ring/hooks.ts` | `RING_HOOKS` (boarding, plan end) | core |
| `ring/hero.ts`, `ring/wagon.ts`, `ring/boarding.ts` | `RingHero`, `Wagon`, `spawnWagon`, the boarding scene and the exit (§5) | WAGON |
| `ring/view.ts`, `ring/light.ts` | `RingView` (layers, streaming, set pieces, road marks), `RingLight` (§8) | SCENERY |
| `ring/plan.ts`, `ring/director.ts`, `ring/landmarks.ts` | the generator: `planRing(seed, difficulty)`, `checkPlan`, the grammar, the ten landmarks (§15) | GEN |
| `ring/art-def.ts` | `ringArtDef(plan, drivers)`, `defineRingArt(id, prefixes)` | core |
| `ring/mission.ts` | `ringMission(plan)`, `ringSong(id)`, `freshSeed()`, `ringSeed(given)` | core |
| `content/ring/{wagon,scenery,traffic,hazards,items,scooter}/` | `index.ts` + `art.ts` per area (manifest `ring/<area>`, `ring/<area>/art`) | the area's builder |
| `content/sfx/ring-{wagon,road,scenery}.ts` | `RING_WAGON`, `RING_ROAD`, `RING_SCENERY` recipes (spread into `SFX`) | sound |

Entity ids, wave A: `ring-wagon` (registered by `content/ring/wagon`), `ring-car` (params `model`
hatch | estate | van | taxi | camper | box-truck, `colour`, `hostage?`), `ring-gantry`,
`ring-closure`, `ring-speedcam`, `ring-avgzone`, `ring-jam`, `ring-crate`, `ring-hostage`,
`ring-scooter`. Wave B: `ring-parcel-van`, `ring-caravan`, `ring-scan-car`, `ring-tow-truck`,
`ring-handhaver-moto`, `ring-roadworks`, `ring-lorry`. Landmarks in order: `oost`, `amstel`,
`zuid`, `nieuwe-meer`, `west`, `westpoort` (mid-boss slot), `coentunnel`, `noord`, `zeeburg`,
`exit` (end-boss marker). Sprite prefixes: `ring/wagon/`, `ring/car/`, `ring/hazard/`,
`ring/item/`, `ring/scooter/`, `fx/ring/`, `decor/ring/<landmark>/`; bg generators `ring-*`;
ring boss art under `boss/ring-<name>/` (the lorry: `boss/ring-lorry/`).

## 2. The plan (`types.ts`, frozen)

`planRing(seed: number, difficulty?: Difficulty): RingPlan` is pure (`new Rng(seed).fork('ring/plan')`).

```ts
interface RingPlan {
  seed; difficulty; length;                 // px; reaching `length` ends the ring
  landmarks: RingLandmark[];               // { id, district, start, length, lanes: 3|4, tunnel?, exits? }
  stretches: RingStretch[];                // { id (= landmark id), index, start, end } covering [0, length)
  chunks: RingChunk[];                     // { type, start, length, stretch, lanes?, closed?, budget? }
  spawns: RingSpawn[];                     // { at, id, lane? | y?, from?: 'road' | 'behind', params? }
  bosses: RingBossSlot[];                  // { at, id, landmark, lane?, params? }
  drivers: string[];                       // squad hero ids, shuffled by the plan rng
  goldenRecord: number;                    // plan distance of the one golden record (-1 none)
  hostages: Record<string, number>;        // per stretch id (the tally)
}
```

- **Plan distance** `planDist` = the plan coordinate of the view's left edge. It advances with the
  camera, except while the plan is **locked** (a boss) or **held** (every player out).
- **Spawns.** `from: 'road'` (default): the entity belongs at road point `at`; it spawns when that
  point is `RING.spawnAhead` (64) px beyond the right edge, at the world x of `at`.
  `from: 'behind'`: it spawns `RING.spawnBehind` (48) px left of the view when the view's left
  edge reaches `at`. `lane` 1 (far) … 4 (near) or an exact plane `y`; `params` go to `world.spawn`
  unchanged. **Unregistered ids are skipped** and counted (`report().skipped`), one console
  warning per id, never an error.
- **Boss slots.** At `at` a registered boss spawns just off the right edge in `lane` (default 1)
  and locks the plan until it is dead or removed; the road keeps scrolling. An unknown id (the end
  marker) is skipped.
- **Start at a landmark** (`?section=`): `planDist` = landmark start − `RING.runIn` (384); entries
  before it are skipped, road entries already in or ahead of the view come in.
- **Drivers**: each slot gets the first `plan.drivers` id that no joined player plays and the
  other slot does not drive, for the whole level (`runner.drivers`). A P2 join never changes the plan.

## 3. Lanes and the layout (`lanes.ts`)

| Band | y |
|---|---|
| HUD (over the sky) | 0–50 |
| skyline | 40–96 |
| median + oncoming traffic (scenery) | `MEDIAN_TOP` 96 – `MEDIAN_BOTTOM` 112 |
| lane 1 … 4 feet lines | `LANE_Y` = 124, 145, 167, 190 (bands split at 134 / 156 / 178) |
| road band | `ROAD_TOP` 113 – `ROAD_BOTTOM` 200 |
| hard shoulder | `SHOULDER_TOP` 200 – `SHOULDER_BOTTOM` 208 (= `GROUND_Y`, the particles' ground) |
| near crash barrier (front layer) | `BARRIER_TOP` 206 – 216 |

`laneY(lane)`, `nearestLane(y, first?, last?)`, `laneAt(y)` (0 off the road), `clampLane(lane, open)`,
`lastLane(open)`, `inRoadBand(y, margin)`, `laneSlab(x0, w, y, out, half?)`. `DEPTH_HALF` = 8:
slabs of neighbouring lanes never touch. Tunnels: 3 open lanes = lane 4 closed.

Aims (`Aim8`): `forward`, `forward-far`, `far`, `back-far`, `back`, `back-near`, `near`,
`forward-near`; `aimOf(ax, ay)` (ay −1 = up on the pad = far), `planeAngle(aim)` (diagonals
±`DIAG_ANGLE` = 20°: one lane per about 60 px; far / near straight across), `aimsBack(aim)`.

## 4. Ring entities (`entity.ts`)

- **Depth slabs.** `hitbox` stays the VISUAL box (bubbles, popups, despawn). `hurtboxes()` and
  `contactBoxes()` return a slab ±`DEPTH_HALF` around the plane y over the hitbox's x range; the
  World's shot pass, `damageArea` and the contact pass then need overlap in x and depth.
  `RingEntity` does this; subclasses of `Enemy` / `Vehicle` / `Boss` override with
  `slabBoxes(this, cache)` (`slabCache()` makes the cache; `slabRect(e, out, half)` one box).
- **Civilian cover.** A civilian car is a `SolidBox` over its **depth slab** (not its visual box)
  on the neutral team: the shot pass stops both teams' shots at it, only in its lane.
- **Lift** (`lift`, drawn only): an entity draws itself at `y - lift`; the runner's shadow pass
  draws `shadowW` wide at the plane y, smaller and lighter with lift (`drawRingShadow`).
- **Shot lift.** A shot whose `shooter` has a numeric `shotLift` is drawn that much higher
  (`shotLiftOf(e)`, `setShotLift(e, lift)`); the hero's is `RING.heroGunLift` (30).
- **Motion.** World x is road distance; the camera moves at the road speed. An entity's world `vx`
  is its own road speed; on screen it moves at `vx - roadSpeed` (`RingEntity.screenVx`);
  `keepPace(rel)` holds a screen speed. A thing lying on the road (vx 0) drifts left.
- **`ringOf(world): RingHost | null`** (null outside the ring: the content tests spawn every
  entity in a plain world, so fail soft): `roadSpeed`, `planDist`, `ticks`, `held`,
  `planLocked`, `lanesOpenAt(worldX)`, `planX(worldX)`, `worldX(planX)`,
  `fine(slot, reason?, points?)`, `limitSpeed(key, max | null)`, `lockPlan(key)`, `unlockPlan(key)`.
  `roadSpeedOf(world)`.

## 5. The wagon, the hero in the window, the drivers, the boarding and the exit (WAGON)

Files: `ring/wagon.ts` (`Wagon`, `spawnWagon`, `bodyStateOf`), `ring/hero.ts` (`RingHero`),
`ring/boarding.ts` (the boarding scene and the exit; installs both `RING_HOOKS` on import),
`content/ring/wagon/` (`geometry.ts` numbers and sprite ids, `shape.ts` the shared samples,
`font.ts` our own lettering, `art.ts` 1× + registration, `art-hd.ts` 2× / 4×, `lines.ts` the
drivers' lines, `lob.ts` the lob, `index.ts` the entities), `content/sfx/ring-wagon.ts`.

**The two wagons** (spec §3; likeness of the boxy 1993–96 Swedish estate, no badge, made-up plates,
no rally plaque or numbers): 93 × 28 px, wheelbase 52, wheels r 6.6 at x −24.6 / +27.4; P2
`green` (bottle green, dark-green / black camouflage, silver five-spoke alloys, a silver rack with
two round spot lamps at the front, a spare tyre lying flat and a red jerrycan; right side
`ARTISANAL` / `GRAPE` in yellow with a pink grape bunch, left side `MAJOR` / `COCKTAILS` in pink
with a cocktail glass), 1P and P1 `white` (the orange / yellow / orange waist band, `619` on the
front wing, `ROZZERS` on a navy box on both front doors, silver wheel covers, black rails, a black
push bar with two round black lamps; at 4× a St George cross and a script line). `liveryOf(slot)`:
slot 0 → `white`, slot 1 → `green` (spec §3, the user's decision; a P2 who joins drives in green).

**Sprites** (`geometry.ts` `ID`; every strip at 1×, 2×, 4×; anchor = the road point under the
car's middle; the glass of the body frames is a HOLE):

| id | frames |
|---|---|
| `ring/wagon/<green\|white>/body-<0..3>` | 5 poses `level, up, down, far, near` (cruise; accelerate: nose up; brake: dip; lane change: the car yaws ±8° and shows a sliver of its tailgate / nose) × damage state 0 clean, 1 dents, 2 + cracked glass, 3 + buckled bonnet, soot, hanging bumper |
| `ring/wagon/<livery>/left` | the left side facing left, never mirrored: 0 clean, 1 wrecked |
| `ring/wagon/<livery>/spin-<0\|3>` | deferred; 8 yaw steps of 45° (0 right side, 2 nose, 4 left side, 6 tailgate) with the wheels and opaque glass: the handbrake turn (0) and the wreck (3) |
| `ring/wagon/cabin` | the interior through the glass and the wheel wells: the 5 poses + 5 facing left |
| `ring/wagon/wheel-alloy`, `wheel-cover` | 4 turn frames, centre anchor |
| `ring/wagon/flame` | 4 frames, fire on the bonnet (≤ 1.5 cells) |

The art samples one car model (`shape.ts`: a side profile extruded across the width, turned by a
`View` {yaw, pitch}) per art px at every density (`sampleGrid(look, box, d)`), so the 1× and the HD
frames are the same car; the HD art lights one height field per part (outline A).

**Draw order of a wagon** (`Wagon.draw`): cabin → wheels → the driver (his `char/<id>/ride-*`
strip clipped to the front door glass) → the body → the hero in the rear door window → the flame.
`SEAT` (geometry.ts): the hero's hip on the sill at (−13, −17), the driver's hip at (9, −10) (his
face from the eyes to the chin and his shoulders fill the glass; at −7 it showed only his hair and
one eye). The hero's torso is drawn down to the row above his hip (the door hides the hip row; it
covered the top row of `ARTISANAL`), except when he leans out to aim low.

**`Wagon extends Vehicle`** — public members: `slot`, `driverId`, `livery`, `laneTarget`,
`sideV`, `screenX`, `arriving`, `swerveT`, `swerveCool`, `bodyState`, `pose`, `view`
(`'right' | 'left' | 'spin'`), `spinFrame`, `scripted`, `autopilot`, `shells` (mirror the
hero's grenades for the HUD). Methods:
- `driveIn(screenX)`; `swerve(dir: −1 | 0 | 1): boolean` (JUMP; 0 = away from the nearest enemy
  shot in the lane, else toward the middle); `wreck()`; `repair(cells)`.
- `bump(o: { dx?, dy?, cost?, source? })` — **for traffic and road things**: a side shove (dx,
  px/tick of screen speed), a lane bounce (dy −1 far / +1 near), the cost in cells (default 1;
  ½ → tag `bump-light`, ≥ 2 → tag `ram`; 0 = a free push), a driver line.
- `say(event: DriverEvent): boolean` — a bubble over the front glass (`lines.ts`: `board`, `bump`,
  `flash`, `hostage`, `low`, `tunnel`, `boss`, `exit`, `arrive`; ≤ 24 characters × 2 lines; a
  driver keeps quiet `LINE_GAP` ticks, except for `board`, `boss`, `exit`; in 2P the drivers take
  turns: while one bubble shows, the other driver's line waits and comes 6 ticks after it, or is
  dropped after 120 ticks, 240 for `board` / `boss` / `exit`). Built in: `board`,
  `bump`, `low` (≤ 3 cells), `arrive` (a fresh wagon), `exit`; `wireDriverTalk(runner)`
  (boarding.ts, at every start) adds `flash` (the runner's `fine` event), `tunnel` (the
  `coentunnel` / `zeeburg` stretches), `boss` (a spawned boss slot) and `hostage` (the world's
  `hostageRescued` for that slot).
- `driverMood('hold' | 'brace' | 'duck' | 'cheer', ticks)`.
- Armour (`cellDamage`): a bullet ½, an impact / explosion / bump 1, tag `bump-light` ½, tag `ram`
  2, crush or tag `hazard` all; `RING.wagonHitInvuln` after a hit; god mode, a scripted wagon and
  the victory drive cost nothing. `bodyStateOf(cells)`: > 7.5 clean, > 5 dents, > 2.5 glass, else
  smoke (+ fire ≤ 1.5).
- **Side ram**: a swerve into an enemy tagged `ring-small` (or `ring-scooter`,
  `ring-handhaver-moto`) in the lane it moves into deals `SIDE_RAM` (120) `impact` damage tagged
  `ram` + `side-ram` (owner = the slot); the wagon pays nothing. ROAD: tag the scooters
  `ring-small` and knock the rider off on `side-ram`.
- 2P: two driven wagons in one lane that overlap push apart in x (no damage, `ring/wagon-bump`).
- The wreck: 30 ticks of a decelerating spin (`spin-3`, 1⅝ turns, resting turned 225°: the left
  side and the tailgate), then the driver and the hero tumble onto the hard shoulder (no harm
  shown: the driver's `ride-duck` / `ride-sit`, the hero's `flip` then standing); the hero's life
  goes at once; `RING.respawnTicks` later a fresh wagon with the same driver drives in.
- Sounds (`RING_WAGON`): `ring/wagon-engine` (loop under the key `ring-wagon-<slot>`; pitch
  0.6 … 1.4 follows the speed on screen), `ring/wagon-swerve`, `ring/wagon-screech`,
  `ring/wagon-horn`, `ring/wagon-hit`, `ring/wagon-crunch`, `ring/wagon-glass`,
  `ring/wagon-bump`, `ring/wagon-wreck`.

**`RingHero extends Player`** — never on foot. States `mounted`, `spawn` (a drive-in, or the
boarding: `boarding` + `foot`), `dead` (wrecked), `out`. Members: `aim8`, `lift`, `shotLift`
(set per shot: the muzzle's height), `driverId`, `lane`, `shootT`, `knifeT`, `throwT`,
`boarding`, `foot`, `wagon`, `wrecked(w)`, `arrive()`, `respawn(mode)`, `continueGame(gift)`,
`drawInWindow(r, hipX, hipY, carFlip)`.
- FIRE held: the D-pad sets the 8-way aim; a tap fires along the last aim (default forward). The
  torso strip per aim: forward `idle` / `shoot`, forward-far `diag-up`, far `up`, near `down`,
  forward-near `diag-down` (pistol: the new `torso-pistol-diag-down`), back aims flip the forward
  ones. A shot leaves at the strip's `muzzle` x on the wagon's plane line and is drawn at the
  muzzle's height (forward 24 px over the road).
- FIRE with a soft enemy on the bonnet (the wagon's own slab, window → nose) or at the window (the
  near lane next to him) is the knife (`torso-<w>-knife` / `knife-b`, the melee weapon's damage).
- BOMB lobs (`content/ring/wagon/lob.ts`, entity `ring-lob`, tag `ring-lob`): an arc of `LOB.ticks`
  (34) drawn in lift over the road (it hits nothing in the air: over traffic and the other wagon),
  landing `LOB.ahead` (112) px ahead (back aims `LOB.behind` 72 behind, far / near straight across)
  in the aimed lane (far aims one lane toward the median, near aims one toward the shoulder); the
  blast is a box `LOB.w` × `LOB.h` (56 × 14: one lane), `LOB.damage` 100, plus the explosion fx;
  costs a grenade; at most `TUNING.grenade.inAir` in the air.
- `spawnWagon(hero, mode: 'start' | 'respawn' | 'continue' | 'join')`: 'start' stands in the start
  lane; the others drive in from the left with `RING.driveInBlink` blinking ticks.

**The boarding** (`boarding.ts`, spec §10; `RING_HOOKS.boarding`): the road held still
(`limitSpeed('boarding', 0)`), each hero on the hard shoulder (`BOARDING.heroX`), his wagon comes
down the ramp facing left (`view 'left'`), the handbrake turn (`spin` 4 → 0, the screech), the
driver's `STAP IN!` line and the horn, the hero's somersault into the window, the road rolls and the
wagon merges into lane 4 on autopilot. About 150 ticks. 2P: the seats `BOARDING.heroX2` (200, 92:
a wagon length + 16 px apart) and P2's wagon (the left seat) comes first (`delay2` 12, P1 44), so
the wagons neither overlap nor drive through each other. `setBoardingSeen(v)` /
`boardingSeen()`; START skips it after the first play. `ringBoarding(world)` is true while it runs
(**the scene must not take that START as its pause**). Not played for a `?section=` start.

**The exit** (`RING_HOOKS.planEnd`): the drivers' exit line, autopilot into lane 4, then the
off-ramp (down behind the near barrier and off the right edge); `completeMission()` when every
wagon is gone (or after `EXIT.maxTicks` 260).

## 6. Hooks (`hooks.ts`)

`RING_HOOKS.boarding(runner): boolean` — the start scene (return true when it placed the wagons).
`RING_HOOKS.planEnd(runner)` — the exit (default `runner.completeMission()` at once). Set them from
your own module at import time.

## 7. The continue (`continue.ts`, GDD §4.6)

The rules of `MissionRunner`'s continue: a countdown per out slot (`continueTicks`); every joined
player out → **held**: no plan movement, no spawns, the road speed eases to 0, boss adds held,
on-screen enemies **gloat** at the last hero's spot every `TUNING.continues.gloatEvery` ticks;
START → a credit, a fresh wagon drives in; its arrival emits `continueLanded` → every non-boss
enemy on screen **cowers**, bosses **stagger**, the hold ends. Every countdown out → `gameOver`.

## 8. The view, the scenery and the light (SCENERY; `view.ts`, `light.ts`, `content/ring/scenery/`)

The runner's contract is unchanged: `new RingView(plan, seed, density)`, `sky`, `update(host)` per
tick, `drawBack(r, host)`, `drawFront(r, host)`, `drawLight(r, host)`, `dispose()`; `host:
RingViewHost` = the runner. Drawing order (runner): `drawBack` → shadow pass → entities sorted by
`y · 100 + z` (shots raised) → particles → `drawFront` → `drawLight`; the scene draws the HUD.

**Layers** (`RING_LAYERS`, far → near; screen y; parallax f; bg generator):

| Key | y, h | f | Generator | What |
|---|---|---|---|---|
| sky | 0, 104 (one 512 px tile) | 0.04 | `ring-sky` | summer day, cumulus |
| `far` | 20, 80 | 0.2 | `ring-far` | hazy skyline: kinds `city`, `towers`, `woods`, `port`, `polder`, `water` |
| `city` | 8, 92 | 0.35 | `ring-city` | the district: `flats`, `slabs`, `zuidas`, `river`, `lake`, `port`, `polder`, `water` |
| `verge` | 36, 64 | 0.75 | `ring-verge` | far side of the oncoming carriageway: `trees`, `screens`, `fence`, `reeds`, `plain`; bridge parapets, tunnel approach walls, signs |
| `farroad` | 64, 44 | 0.9 | `ring-farroad` | the oncoming carriageway (`road`) or the railway in the median (`rail`) |
| `tunnel` | 0, 113 | 1 | `ring-tunnel` | tube interior / covered stretch between its portals |
| `road` | 85, 123 | 1 | `ring-road` | hectometre boards, the median, 4 lanes (3 + walkway in a tube), the shoulder |
| `front` | 194, 22 | 1.25 | `ring-front` | near crash barrier; concrete barrier in tubes; bridge parapet; the exit opening |

**Streaming.** A layer is cut into chunks of `CHUNK_W` (256) layer px. Chunk i is made when it
comes within one chunk of the right edge. Its params describe what it shows: `kind` (the look),
`x0` (its layer x), `rs` (run seed) and its features in local x. Its seed is `mixSeed(seed, layer, i)`.
- The plan distance a layer point L shows is `planOf(L, f, o) = (L − 192) / f − o + 192`, with
  `o = camX − planDist`. This is the plan point under the screen middle when L passes it.
- Textures and repeating furniture hash GLOBAL x, so chunks of one look join seamlessly.
- The 1× buffer is built at once.
- The dense buffer (min(4, art tier), never above the renderer res) is built in the ring's
  scenery worker in the browser (`src/game/ring/scenery-job.ts` + `scenery-worker.ts`: one module
  worker per page; the pixels come back as a transferred ArrayBuffer and are installed a few frames
  later, while the chunk draws its lower density). Without Worker, or after the worker failed (one
  console.warn), it is a main-thread art job as before. Tools and tests build it on first draw.
  It is cropped to its opaque box (`trimmedFrame`; the worker crops too). The dense sky goes the
  same way (not cropped). The worker's build is byte-identical to the main thread's (a test).
- Chunks behind the view are evicted at once: the one just behind keeps only its pieces. A chunk
  more than 2 ahead (a jump) is dropped.
- `RING_SCENERY_RESERVE` = 32 MB. The test peak is about 22 MB plus 3.6 MB of road base and grain.
  The ring's dense budget test subtracts this reserve.
- 4× chunk builds take about 5 ms each (the road; up to 14 ms): in the worker since the fix of
  2026-10-21, so no frame waits for one (it dropped frames at 4K when they ran in the frame).

**The scenery table** (`defineRingScenery(def)`, filled by `content/ring/scenery/index.ts`):
- `districts`: looks by the plan chunk's `district`. `parts`: overrides by the set-piece `part`
  (`rozenoordbrug` → river, `zuidas`, …); a parallax chunk takes a part when it fills ≥ 40 %.
- `landmarks[id]`: `look`, `pieces`, `features`, `tunnelName`.
  - A piece is `{ id, layer, of, at, dx?, y, frame?, tpf?, vx?, flipX? }`. `of` is
    `'landmark'`, `'stretch'` or `'part:<plan part>'`. Pieces with `vx` move (the trains) and
    outlive their chunk.
  - A feature is `{ kind: 'covered' | 'exit' | 'bridge' | 'cut', of, at, len }`.
- `bridgeNames` (name plates), `lamp` (median lamp posts every 192 px), `oncoming` (car ids),
  `portals`, `overbuild`.
- Tunnels come from `landmark.tunnel`, with a 360 px open cut before each. Bridges come from the
  plan's `bridge` chunks (inset 32 px). Hectometre boards use GEN's `ringKmAt` / `formatKm`, one
  per tenth. Signs come from `plan.exitSigns`: a named exit gets an exit sign plus a RING A10 sign
  420 px before it; an unnamed exit gets a RING A10 sign with the S-shield.

**Members** (tests, tools, other builders):
- `spans`: resolved features, in plan px.
- `portals`: world x of each painted portal.
- `lookAt(p)`, `lookFor(p0, p1)`, `stretchAt(p)`, `planOf`, `layerOf`.
- `prepare(host, d)`: makes the chunks of the current view without drawing.
- `residentBytes(d)`, `peakBytes`, `chunkCount(key?)`, `chunkIndices(key)`, `chunkInfo(key, i)`.
- `made`, `hiMade`, `evicted`.
- `ambience`: `'ring/tunnel-bed'` in tubes and covered stretches, `'ring/bridge-rumble'` on
  bridges, else null. On a change, `update` calls the host's `setAmbience` (audio key `'ambience'`).
- `light: RingLight`.

**Road marks (for ROAD).** `markRoad(host, { x0, x1, lane })` paints yellow temporary lines along
lane `lane` (1 far … 4 near) between world x0 and x1, with a taper across the lane at x0 and
hatching. `host` is `ringOf(world)`. Marks behind the view are dropped. The plan's chunks with
`closed` lanes paint the same lines (`view.planMarks = false` turns that off). `roadMarks(host)`
lists the marks.

**Light (`light.ts`, `RingLight`).**
- Darkness: a deep navy rect between each tunnel's portals (`TUNNEL_DARK` 0.5, a 64 px ramp at
  each portal, 1 px steps). Under a covered stretch, `COVER_DARK` 0.32 below `COVER_TOP` y 56;
  the building's sunlit facade stays lit. The darkness falls over the sprites inside.
- Additive sprites, only where it is dark:
  - `fx/ring/light/band`: the ceiling LED fixtures, every `LAMP_STEP` 64 px, centred on the
    painted segments;
  - `fx/ring/light/pool`: the lamp's sheen on the asphalt;
  - `fx/ring/light/beam`: a headlight ahead of every wagon and car (`hitRect` front, `facing`);
  - `fx/ring/light/glow-s`: round every `fx/muzzle…` effect;
  - `fx/ring/light/glow-l`: round every `fx/explosion…` effect (fades over 24 ticks).
- `darkAt(host, x)` and `intervals(host)` are for the tests. There is no state and no allocation
  per frame.

**Art** (one density-generic drawer per id, `content/ring/scenery/kit.ts`):
- `Pen(w, h, d)` paints at d 1 (PAL), 2 and 4 (PAL_HD) with the same logical shapes.
- Colour helpers: `tone`, `toneI`, `haze`, `mix`, `shift`.
- `dq` / `bay`: ordered dither, used only on big gradients.
- `tinyText`: our 3 × 5 lettering.
- `outlineA` (moving pieces: the oncoming cars, the train) and `outlineC` (static furniture).
- Backgrounds have no ink outline.

Set pieces (`RING_PIECES_BY_LANDMARK`, all at 1×, 2× and 4×):
- oost: `rembrandt-tower`, `amstel-station`.
- amstel: `flyover` (A2), `barge`.
- zuid: `rai-hall`, `tower-a|b|c`, `train`.
- nieuwe-meer: `schinkelbrug` (the bascule tower), `sailboat` (3 frames), `flyover` (A4).
- west: `overbuild` (Bos en Lommer, 224 px), `sloterdijk`, `office`.
- westpoort: `crane`, `turbine`.
- coentunnel: `portal` (frame 0 entry with the plate, frame 1 exit), `flyover` (A8, Coenplein).
- noord: `turbine`, `windmill`.
- zeeburg: `portal`, `ijburg`.
- exit: `exit-sign`.

Shared furniture: `decor/ring/road/lamp` and `decor/ring/road/oncoming-0…6`.

## 9. Mission definition and seeds (`mission.ts`)

`ringMission(plan)`: `{ id: 'ring', name: 'DE RING', subtitle: 'A10', label: 'MISSION 2', music:
'ring', bossMusic: 'ring-boss', artDensity: 4, hostages: plan.hostages, … }`. `ringSong(id)` falls
back to the ams songs until the ring's exist. `freshSeed()` (crypto when present, once per play)
and `ringSeed(given)` (the URL / tool seed wins).

## 10. Tier-4 art (`art-def.ts`)

`ringArtDef(plan, drivers): MissionArtDef & { extraChar, denseReserve }`: sections = stretches
(landmark decor + every family the plan uses in that stretch, `defineRingArt(id, prefixes)`; a
family on many stretches stays in the set on each of them), `preloadFirst` = `RING_PRELOAD_FIRST`
(wagon, civilians, scooters, ring items / fx, the road furniture `decor/ring/road/` (lamp posts,
oncoming cars), shared fx / items / weapons / icons), `preloadLast` = the bosses' art,
`bossSection` = the first boss slot's stretch, `extraChar` = the drivers' `char/<id>/ride-` and
`char/<id>/mount` prefixes (gameplay.ts lets them through the hero filter; missions without the
field are unchanged), `denseReserve` = `RING_SCENERY_RESERVE` (32 MB, view.ts): the tier-4 run
keeps the sprites inside `DENSE_BUDGET_BYTES` minus it (gameplay.ts `runBudget`; missions without
the field use the full budget), so sprites and the streamed scenery share the 256 MB.

Budget (`tests/content/ring-dense-budget.test.ts`, the method of the ams test: 4× bytes from the
1× frames): seeds 1-20 × every squad hero 1P (with its driver) and five hero pairs 2P (two
drivers) × every stretch ≤ 256 MB − 2 MB − the scenery reserve (222 MB). Measured 2026-10-20:
peak 1P 75.5 MB (bob, driver thom, coentunnel), 2P 99.5 MB (dirk + bob, drivers patrick + thom);
the heroes take about 25 MB each, the wagons 18.6, the scooters 8.1, the cars 5.8.

## 11. `RingRunner`

```ts
new RingRunner({ session, pads, audio?, seed?, difficulty?, plan?, section?, settings?, artDensity? })
```

Lifecycle: `start()`, `update()` (per tick), `draw(r)`, `dispose()`. State: `'playing' | 'victory'
| 'complete' | 'gameover'`. Members the HUD / tally / scenes read (as on MissionRunner): `world`,
`hud`, `session`, `mission`, `players`, `player(slot)`, `continueTicks`, `countdownHeld`,
`countdownNumber`, `timeLeft` (Infinity), `section` (`{ id }` = the stretch), `ticks`, `seed`,
`sky`, `fadeAlpha` (0), `artDensity`, `maxArtDensity`, `nextMission()`, `continuePlayer(slot)`,
`joinPlayer(slot, character)`, `completeMission()`, `skip()` (F4), `jumpTo(d)`, `stopLoops()`,
`playMusic()`, `resumeMusic()`, `currentMusic`, `setAmbience()`. Ring members: `plan`,
`planDist`, `roadSpeed`, `stretchIndex`, `stretch`, `drivers`, `driverFor(slot)`, `view`,
`lanesOpenAtPlan(d)`, `closedLanesAtPlan(d)` (a binary search over the chunks, `chunkIndexAt`),
`spawnEntry(s)` and the `RingHost` members (§4). With `ring-closure` registered the view's own
plan marks are off (`view.planMarks = false`): each closure draws its yellow lines itself (one
set of lines).

Events (`runner.events`): `complete`, `gameOver`, `playerOut`, `allOut`, `stretch { id, index }`
(also at the start; tier 4: `missionArtSection(id)`), `sectionLoaded { id }` (the same),
`planEnd`, `fine { slot, points, reason }`, `bossSlot { id, at, spawned }`.

`report(): RingReport` — `ticks`, `distance` (plan px driven), `roadDistance`, `planLength`,
`landmarks` (stretches entered), `kills`, `deaths`, `wrecks`, `fines`, `hostages`, `continues`,
`score`, `complete`, `gameOver`, `spawned`, `skipped { id: n }`, `bosses`, `errors`, `maxEntities`.

## 12. Tests

`tests/game/ring/`: `lanes` (layout, aims, slabs; a forward shot stays in its lane, a diagonal
crosses, a civilian SolidBox stops shots both ways only in its lane), `armour`, `continue`,
`determinism`, `hero-states`, `runner`, `plan` (GEN), `wagon`, `two-player`, `boarding` (WAGON),
`flow` (WIRING). `ring-helpers.ts` has `RingRig`, `tinyPlan` and plane test entities.
`tests/content/`: `ring-scenery` (SCENERY), `ring-traffic`, `ring-hazards`, `ring-items`,
`ring-scooter` (ROAD), `ring-dense-budget` (§10).

## 13. Flow (WIRING; `scenes/{ring,ring-route,play-host}.ts`)

The normal route (spec §1, §13.1; GDD §13.1): ams → `MissionCompleteScene` (the ams tally) →
`missionDone` (`AMS.next = 'ring'`) → `MissionIntroScene('ring')` → `RingScene` → `complete` →
`GlitchBridgeScene` (the ring's silent tally) → the fps floors (level 3) → the ending.

- **The card** (`content/ui/cards.ts`): `MISSION 2`, `DE RING`, `A10 RING ROAD, AMSTERDAM - 1400
  HOURS`, Gusto's two lines, an A10 line map (the dot on the on-ramp at A10 Oost). On enter it calls
  `prepareRing(app)` (the seed and the plan) and `preloadRing(app, start)` (2× / 4× art via
  `preloadMissionArt(app, ringArtFor(start, session), 4, session, startStretch(start))`, the 1×
  `RING_ART` in 4 ms slices, the reused `mission:ams` sample group); START → `RingScene({ start })`.
- **Seeds**: `prepareRing` takes the given seed, else `?seed=` (`app.params.seed`), else
  `freshSeed()` — a new ring each play. The seed shows in the debug overlay (`SEED n <STRETCH>`) and
  in the floor-1 tally's footer (`RING SEED n`).
- **`RingScene(app, { start?, section?, seed?, session? })`**: `new RingRunner({ session, pads, audio,
  seed, plan, section, settings })`; events: `complete` → `ringDone` (the bridge, `fade: 0`: the
  bridge snapshots the last ring frame), `allOut` → `CONTINUE?` (the announcer; banners and GO go),
  `gameOver` → `GameOverScene`, `stretch` → `missionArtSection(id)`. Tier 4: `preloadArtNow()` =
  `preloadMissionArt(app, ringArtDef(plan, runner.drivers), runner.artDensity, session,
  runner.section.id)` at the start, after a join and on a rise to tier 4; `stopDense('ring')` and
  `runner.dispose()` on exit. The start banner (MISSION 2 / DE RING) is held to 120 ticks (GDD
  §13.6). `?weapon=` gives the weapon; F4 = `runner.skip()`; F5 = the weapons cycle.
- **Play controls** (`play-host.ts`, shared with GameplayScene): the pause (Esc / P / START of a
  player in play / a lost focus), the lost-pad pause, the key-split notice and joins — START on a
  free pad or the key 2 makes player 2 join (a credit; `joinCharacter`); `RingRunner.joinPlayer`
  gives P2 its own wagon and a driver nobody plays (it drives in from the left).
- **The HUD** (`drawHud` with the runner as `HudRunner`): the wagon's armour in the vehicle panel
  (`WAGON` + `RING.wagonCells` cells), the bombs as the wagon's `shells` (WAGON mirrors them), the
  in-world continue countdown.
- **The end** (`ringDone`): `GlitchBridgeScene({ from, runner })` records the clear
  (`recordMissionClear`: `campaign.missions` gets `ring`, the golden record per slot) and stores
  `{ mission: 'ring', totals, seed }` under `AMS_BONUS_KEY`; its story card opens with
  `BRIDGE_OPENING` (one neutral line). The floor-1 tally shows `MISSION 2 BONUS`.
- **`?mission=ring`** (boot): `startRing(app, { section, players })` — a fresh session, no card.
  `bootArt` for it: the start screens, `?char=` and the select roster (the drivers), `RING_ART`
  (`ring/`, `decor/ring/`, `item/`, `weapon/`, `fx/`, `boss/ring-`). Params: `section` (a landmark
  id), `seed`, `players`, `char`, `god`, `debug`, `art`, `res`, `difficulty`.
- **Numbering**: `FPS_ROUTE = ['ams', 'ring', 'fps-1', 'fps-2']`, `missionLabel('ring')` =
  `MISSION 2`, high-score column `M2`, ALL GOLDEN RECORDS over that route.

## 14. Tools (WIRING; docs/api/sim.md §12)

- `npm run sim -- --mission ring [--god] [--seed n] [--players 2] [--section <landmark>]
  [--difficulty d] [--max-ticks n] [--expect-complete] [--expect-ticks min-max] [--out f] [--trace N]
  [--quiet]`: the ring bot (`src/sim/bot-ring.ts`) in a headless RingScene
  (`src/sim/headless-ring.ts`); the report is `runner.report()` plus god, seconds, gameOvers, errors
  with stacks, warnings, missing sfx / songs and timing; a one-line summary on stderr.
- `npm run shot -- --mission ring [--seed n] [--section id] [--bot --god] [--players 2] [--ticks n]
  [--every N --count M] [--res 8 --art 4] [--spawn "<id>@+<dx>:<lane>[?k=v&k=v]"]`: LOOK at the ring
  and at single entities (`--spawn` after the first tick, `dx` from the view's centre, lane 1 … 4).
- `npm run smoke -- --port <yours> --query "mission=ring&god=1"`: drive, shoot, lanes, the steer
  lock, a swerve, a lob, pause / resume, player 2's join (key 2).
- The bot (`RingBot`, integrated 2026-10-20): a lane safety map per tick — closed lanes up to 384
  px ahead (`CLOSURE_DANGER`), enemy shots coming at the wagon, civilian cars (a car beside the
  wagon blocks its lane for a lane change, `BLOCKED`; a car ahead or behind adds danger by its time
  to contact), bottles in flight (`ring-bottle` `landX` / `landY` / `ticksLeft`: their landing
  lane), pickups ahead (a pull). A lane change counts every lane on the way and never crosses a
  blocked one unless the lane it leaves is worse (a closure right ahead). A bottle that lands on it
  with no lane free: forward or back on screen away from it (`bottleDodge`); too late for a lane
  change: a swerve. Aim (`planeAim(dx, dy, rv, hw)`): it predicts where the straight-across and the
  ±20° shot meet the target's lane (with the target's speed) and fires the aim that hits, else it
  lines up forward / back on screen (never into the fine third, never into a car). Hostage doors
  come first. BOMB at a boss, the rear third of the screen at rest, START to continue. With
  `--players 2` each slot has its own bot.
- The sim's watch (`RingSimReport.watch`, `RingWatchReport`, headless-ring.ts): pacing
  (`longestGap`, `gaps` over 240 ticks outside rests, scenes, the boarding, holds and the victory
  drive, `enemyShare`), fairness (`outsideShots`: enemy shots and bottles that appear off screen,
  `offscreenHits`: wagon hits whose attacker is off screen, `attacks`, `minTell`, `minTellInView`:
  the shortest `tell-x` → `x`, `minOpenLanes` at the view's right edge) and armour (`cellsLost`
  per source, e.g. `ring-scooter/bottle:thrown`, `ring-car:bump+bump-light`).

## 15. The generator (GEN; `plan.ts`, `director.ts`, `landmarks.ts`)

`planRing(seed, difficulty = 'normal', { wave? }): RingPlan` is a **pure** function: its own
stream `new Rng(seed).fork('ring/plan')`, never `world.rng`, never the players. The same seed
and difficulty give a deep-equal plan; a P2 join never changes it (the runner picks drivers from
`plan.drivers`, the whole `ROSTER` shuffled by the plan rng, so slot 1 always finds one). It takes
about 2 ms. `checkPlan(plan): string[]` lists every broken invariant (empty = good); the tests run
it over 50 seeds × 3 difficulties.

Helpers: `chunkAt(plan, d)`, `planTicks(plan, d)` (plan.ts); `chunkIndexAt(chunks, d)` (binary
search), `planTicksAt(chunks, d)`, `chunkTicks(c)`, `chunkSpeed(c)`, `totalTicks(chunks)`,
`appearTicks(chunks, spawn)`, `enemyGaps(plan)`, `repairGaps(plan)`, `weaponGaps(plan)`,
`isRingEnemy(id)` (director.ts); `RING_LANDMARK_DEFS`, `landmarkDef(id)`, `EXIT_NAMES`,
`ringKmAt(plan, d)` (the hectometre km, 0 … 32.3), `formatKm(km)` (`'12,3'`) (landmarks.ts).

### 15.1 Additive plan fields (`types.ts`; all optional)

| Type | Fields |
|---|---|
| `RingPlan` | `ticks` (planned ticks), `exitSigns` (`{ at, exit, name, stretch }`: S-shield spots), `wave` ('A' / 'B') |
| `RingLandmark` | `name`, `roadDistrict`, `km`, `limit` (80 / 100), `junction` ('A2' / 'A4' / 'A8'), `bridge`, `tunnelName` |
| `RingStretch` | `district` (of its road), `ticks` |
| `RingChunk` | `speed` (planned px/tick; a jam crawls), `hold` / `holdAt` (a jam's stop: ticks, px into the chunk), `part`, `setPiece`, `scene`, `peak`, `tier`, `district`, `limit` |

**The chunks cover [0, length) without gaps**, set pieces included (`setPiece: true`). Use
`chunkAt` / `chunkIndexAt` instead of a linear search.

### 15.2 The landmarks (fixed set pieces, real clockwise order)

| id | set piece (`part`, px) | after the landmark | lanes | exits | km | district → road |
|---|---|---|---|---|---|---|
| `oost` | `boarding` (merge, scene) 640, `on-ramp` 384 | | 4 | S113 S112 S111 | 13.0 | oost |
| `amstel` | `interchange` 512 (A2), `rozenoordbrug` (bridge) 512 | | 4 | S110 | 15.6 | amstel |
| `zuid` | `rai` 512, `zuidas` 512 | | 4 | S109 S108 | 17.5 | zuid → zuidas |
| `nieuwe-meer` | `schinkelbrug` (bridge) 512, `interchange` 512 (A4) | | 4 | – | 20.4 | lake |
| `west` | `limit-80` 512 (the 80 gantry) | | 4 | S107 … S102 | 21.5 | west (80 km/h, the zone) |
| `westpoort` | `boss` 768: slot `ring-lorry` at +192, lane 1 | | 4 | S101 | 28.6 | port |
| `coentunnel` | `coentunnel` (tunnel) 1280 | `coenplein` 512 (A8; km wraps 32.3 → 0) | 3 | – | 31.0 | tunnel → noord |
| `noord` | `noise-screens` 384, `kanaal` (bridge) 512 | | 4 | S118 S117 S116 S115 | 1.2 | noord |
| `zeeburg` | `zeeburgertunnel` (tunnel) 1024 | `ijburg` 256, `zeeburgerbrug` (bridge) 512 | 3 | S114 | 8.6 | tunnel → zeeburg |
| `exit` | `boss` 512: marker `ring-end-boss` at +64; `offramp` (merge, scene) 512 | | 4 | S113 | 12.4 | oost |

Skyline districts (`RingChunk.district`): `oost`, `amstel`, `zuid`, `zuidas`, `lake`, `west`,
`port`, `tunnel`, `coenplein`, `noord`, `zeeburg`. Set-piece parts (`RingChunk.part`): `boarding`,
`on-ramp`, `interchange`, `rozenoordbrug`, `rai`, `zuidas`, `schinkelbrug`, `limit-80`, `boss`,
`coentunnel`, `coenplein`, `noise-screens`, `kanaal`, `zeeburgertunnel`, `ijburg`, `zeeburgerbrug`,
`offramp`; generated parts: `warn` / `closure` (a gantry), `jam-warn`, `run-in`.

A tunnel landmark is only the tube (its `start` / `length` = the dark, 3-lane part); `after`
chunks are fixed but outside the landmark's range. Each stretch's generated road takes a share of
the time (the real distance to the next landmark, compressed: half real, half equal; West and
Noord are the longest). The jams may fall in `zuid`, `west`, `coentunnel`, `noord`, `zeeburg`.

### 15.3 The director (layers, each on its own fork of the plan rng)

1. **Structure** (`'structure'`): a target of 32,400 ticks × (1 ± 0.02); per stretch a cumulative
   time target; PHRASES of 3–5 chunks whose budget rises to a PEAK (`peak: true`), then a `rest`;
   fillers and a `run-in` cruise chunk (≥ `RING.runIn`, no closure) end each stretch, so
   `?section=` always starts on calm road. Forced: 1–2 jams (in two stretches that are not
   neighbours; each behind a `gantry` chunk `part: 'jam-warn'` with the 50s, a spacer when a
   closure came before), the average-speed zone in `west`.
2. **Hazards** (`'hazards'`), **hostages** (`'hostages'`), **traffic** (`'traffic'`), **enemies**
   (`'enemies'`), **items** (`'items'`), **golden** (`'golden'`): see the params below.

The grammar (`CHUNK_RULES`; lengths in px, cost = threat taken from the bank):

| type | length | cost | min tier | weight | wave | traffic | rules |
|---|---|---|---|---|---|---|---|
| `cruise` | 384–640 | 0 | 0 | 3 | A | 2.5 | |
| `traffic` | 512–768 | 0.05 | 0 | 3 | A | 7.5 | |
| `merge` | 512–640 | 0.1 | 0 | 1.2 | A | 3 | no repeat; cars and a gang join from the near side |
| `gantry` | 896–1152 | 0.1 | 0 | 1.2 | A | 3 | = `warn` 384 + `closure` (closed lanes); ≤ 2 per stretch; not before 15 s |
| `roadworks` | 640–1024 | 0.15 | 1 | 1 | A | 3 | closes lane 4 (tier 3: maybe 3–4); ≤ 1 per stretch |
| `speedcam` | 384–512 | 0.05 | 0 | 1 | A | 2.5 | ≤ 2 per stretch; not before 10 s |
| `avgzone` | 1536–2048 | 0.05 | – | forced | A | 3.5 | only `west`, once |
| `jam` | 640–896 | 0.2 | – | forced | A | queue | speed 1.2, hold 150 ticks at 35–60 %; 1–2 per ring |
| `rest` | 384–512 | 0 | – | inserted | A | 1.5 | after every peak; no enemies; 1–2 crates |
| `parcel` / `caravan` / `convoy` | 512–768 / 512–768 / 768–1024 | 0.4 / 0.5 / 0.8 | 0 / 1 / 2 | 1.5 / 1 / 1 | **B** | 2.5 / 2.5 / 2 | their fixed template at the start |
| `bridge`, `tunnel` | set pieces only | | | | | 3 / 3.5 | |

Neighbour rules: a closure never follows a closure, a jam or its 50 gantry; a `noRepeat` type
never twice in a row; `maxPerStretch`; `minTier`; wave-B types only in wave-B plans.
**Budget curve:** `baseBudget(p) = 0.2 + 0.8 p` (p = planned-time progress); chunk k of a phrase
of n gets `base × (0.75 + 0.35 k / (n − 1))`, clamped to 0.1 … 1.0; tiers 0 (< 0.35), 1 (< 0.55),
2 (< 0.8), 3. Set pieces get 0.9 × base (a boss part 0.6 ×, a scene 0).

**Enemies:** a bank earns `budget × 0.45` threat points per 512 px (above the floor) and buys the
next wave template (`WAVE_TEMPLATES`, picked by tier and chunk type) when it can pay and the last
wave is 224 px back (never 160 px before a rest or a scene, never before a boss slot in its
chunk). The **4-second floor** (GDD §1.5 rule 1) is free: when the estimate (each base member on
screen `ENEMY_PRESENCE` ticks from its appearance: scooter 150, the measured median) passes
`gapPlace` = 120 ticks without an enemy outside rests and scenes, a wave goes in anyway (the plan
check `enemyGaps` still uses the 240-tick limit). **A jam chunk** gets no voluntary waves and the
floor only at `gapJam` = 120 ticks (its stand's wave counts through the stand) (the stopped cars are cover: gangs there stay long); its own wave is the
jam controller's `waves` param (wave A: one scooter gang from behind that filters in between the
stopped cars during the stand, rows `'' '' N H`, a fork of the hazards rng so the other draws stay;
`enemyGaps` counts it from the stand on). Integrator tuning 2026-10-20 (threat 0.55 → 0.45, scooter
presence 240 → 150, `gapPlace`, `gapJam`, the jam's wave; the scooters' stay and crowd rule, §16):
with the bot on seeds 1–5 the longest time without an enemy on screen is 199–256 ticks (a few
single gaps over 240 by at most 16 ticks) and scooters on screen are p50 3, p90 7 (it was gaps of
5–10 s and piles of up to 20 scooters). Fixer 2026-10-21 (normal, the bot, seeds 1–6): 1P 217–243
ticks, 2P 243–254 ticks (two players clear waves faster; the plan never depends on the player
count). `tests/game/ring/watch.test.ts` runs seeds 1–3 in 1P and 2P and holds `longestGap` ≤ 270,
no off-screen shot or hit, tells ≥ 18, at least one open lane. A jam's stand no longer waits for
a wave member that has been off screen for 60 ticks (`JAM.offscreenHold`): a scooter stuck behind
a wagon kept a 2P stand 960 ticks (gap 662).

Wave templates (members: `side`, `dx`, lane offset, row): wave A — `gang-behind` (3 + N + H),
`gang-ahead` (3 + N + H), `gang-weave` (tier ≥ 1: 4 + H, `weave: 'wide'`), `gang-pincer` (tier ≥ 2:
2 + N behind, 2 + H ahead), `gang-merge` (merge chunks: 3 + N from the near side). Wave B —
`moto-pair`, and the fixed `parcel-van`, `caravan`, `convoy` (scan car, tow truck, motos),
`roadworks-crew`. **Difficulty** changes only the rows (GDD §4.10): `N` spawns on NORMAL and
HARD, `H` on HARD; every draw happens on every difficulty, so the road, traffic, hazards and
items of a seed are the same on all three.

**Items:** the first weapon crate on the on-ramp (≈ 3 s); a rest holds a crate (a repair when 25 s
passed without one, else weapon / bombs / repair) and half the time a treat; a repair crate when
44 s passed without a repair chance (a crate or a hostage whose `item` is `repair`); a weapon
crate when 44 s passed without one. Weapons on the ring: `M S R L H T` (no flame shot, no bounce
mine). **Golden record:** one `ring-crate` `{ kind: 'golden-record' }` in a plain chunk of a
mid-ring stretch (zuid … noord), on the farthest open lane; `plan.goldenRecord` = its `at`.
**Hostages:** 1 per stretch (2 in stretches ≥ 12,000 px), spread over the stretch, lanes 3–4,
after a boss slot; `plan.hostages` counts them by `at`.

### 15.4 Spawn params (the contract with the content)

| id | from / lane / y | params |
|---|---|---|
| `ring-car` | lanes 1–2 `from: 'behind'` (rel > 0), lanes 3–4 road (rel < 0); campers and box trucks only in 3–4 | `model`, `colour` 0–7, `rel` (screen speed at cruise: lane 0.7 / 0.3 / −0.35 / −0.75 ± model), `merge?` (joins up the on-ramp into lane 4) |
| `ring-car` (hostage) | lane 3–4, road | `model: 'van'`, `colour`, `rel`, `hostage: true`, `item` (a drop value) |
| `ring-car` (jam queue) | every lane, road at the jam start + 448 + k · 120 | `model`, `colour`, `rel: -0.5`, `stopAt` (screen x it stands at while the jam holds), `jam: true` |
| `ring-scooter` | `behind` / road; lane from the template | `gang`, `size`, `index`, `side` ('behind', 'ahead', 'near' = up the on-ramp), `pillion` ('bottle' / 'pistol'), `lead`, `weave?`, `pincer?`, `merge?` |
| `ring-crate` | road, an open lane | `kind`: a drop value (`repair`, `bombs`, `M` … `T`, a treat, `golden-record`) |
| `ring-gantry` | road, `y` 204 | `purpose` ('warn', 'close', 'end', 'jam', 'limit', 'exit'), `signs` (lane 1 … 4: '80', '100', '50', 'x', 'arrow-near', 'arrow-far', 'end', 'blank'), `exit?` |
| `ring-closure` | road, the closed lane | `kind` ('gantry', 'roadworks'), `length` (px), `truck` (the crash-absorber truck at its start: first lane only) |
| `ring-speedcam` | road, `y` 204 | `kind` ('post', 'gantry') |
| `ring-avgzone` | road, `y` 204 | `part` ('start' with `length`, 'end'), `zone` |
| `ring-jam` | `behind` at the jam start, `y` 204 | `length`, `crawl` (px/tick), `hold` (ticks), `holdAt` (px into the jam), `seed` |

**The jam's planned time** (the plan's 9:00 counts on it): from the jam start the road crawls at
`crawl` for `length` px and stands still `hold` ticks at `holdAt` (`limitSpeed`). `RING_PLAN.jamCars
= false` leaves the queue to the jam controller (expanded from `seed`).

### 15.5 Invariants (`checkPlan`)

All ten landmarks in order; stretches and chunks contiguous over [0, length); bridges and tunnels
only in set pieces, tunnels 3 lanes, no gantry inside a tunnel; planned time 9:00 ± 5 %
(32,400 ± 1,620 ticks; seeds 1–200 land in 31,750–33,050); an open lane everywhere; 1–2 jams,
each behind its 50 gantry, no closure in or next to one; exactly one golden record; ≥ 1 hostage per
stretch and `plan.hostages` matching; a repair chance at least every 3,600 ticks; no enemy gap over
240 ticks outside rests and scenes (estimate); the boss slots (`ring-lorry` in westpoort, the
end marker in exit); the drivers = the roster; a rest after every peak; a run-in before every
landmark; spawns inside the plan, cars / crates / scooters on open lanes.

### 15.6 Adding a chunk type or a wave template

- **A chunk type:** add it to `RingChunkType` (types.ts), a `CHUNK_RULES` row (length, cost, tier,
  weight, wave, traffic, `closes` / `maxPerStretch` / `noRepeat` / `minTicks`), its fixed spawns in
  `Director.hazards` (or a fixed template with `only: [type]`), and a check in `checkPlan` when it
  carries a rule. A type that needs new ids gets `wave: 'B'` (or later) until they are registered.
- **A wave template:** a `WAVE_TEMPLATES` entry: `id`, `wave`, `minTier`, `cost` (NORMAL rows),
  `weight` per tier, optional `only` (a chunk's fixed template) or `prefer`, and `build(rng, tier)`
  returning members (`id`, `side`, `dx`, lane offset or `fixedLane`, row `''` / `'N'` / `'H'`,
  `params`). Give a new enemy id its `ENEMY_PRESENCE` (ticks on screen) so the 4-second estimate
  counts it.
- **Wave B:** set `RING_CONTENT_WAVE = 'B'` in director.ts when the wave-B ids exist (the tests
  already check wave-B plans); hostages then ride in parcel vans and caravans.

## 16. Entities (ROAD; `content/ring/{traffic,hazards,items,scooter}/`, `sfx/ring-road.ts`)

Every road thing stands on the plane (x = road distance, y = its lane's feet line) and hurts / is
hurt through its depth slab (§4). World `vx` is its own road speed: a thing lying still on the road
has vx 0 and drifts back at the road speed. Each one also runs (inertly) in a plain world without
the ring (`ringOf(world)` null). Shared helpers: `traffic/road-kit.ts` — `drivenWagons(world)`,
`nearestWagon`, `slabsTouch`, `RingLayer` (a child that draws one layer of its owner at another
depth), `PlaneTumbler` / `tumbleOff` (a thing knocked into the air over the plane: lift arc, bounce,
lie, fade; `restSprite` for a rider who sits up), `jamOf(world)` (the jam level 0 … 1 the cars brake
with), `ringRng(seed, salt)`; our sign lettering: `traffic/lettering.ts` (`glyphHit`, a 3 × 5 face at
any size).

| id | file | what it does | params |
|---|---|---|---|
| `ring-car` | traffic/car.ts | civilian traffic: a neutral `SolidBox` over its slab (stops both teams' shots, only in its lane); dents (5 / 14 shots ending on it: `dents` 1 / 2, glass cracked), never destroyed; keeps a gap to what is ahead, never backs into a wagon that holds back, merges out of a lane closed ahead (a closure, a tunnel's lane 4), brakes with the jam; a wagon that drives into it is pushed out and gets `Wagon.bump` (½ cell light, 1 cell over `BUMP_HARD` 1.4 px/tick or a swerve; slow contact blocks for free); a wagon beside it whose own lane closes (a tunnel's lane 4) is never held between the lanes: the car yields along its lane (`WEDGE_YIELD` 2 px/tick) and the wagon slips in behind or in front, for free | `model` (hatch, estate, van, taxi, camper, box-truck), `colour` (index or name), `rel` (screen speed; default by lane 0.7 / 0.3 / −0.35 / −0.75), `hostage`, `item`, `stopAt` + `jam` (a jam queue car) |
| `ring-hostage` | items/hostage.ts | a tied hostage riding on a carrier (below); without `carrier` the factory makes a hostage van | `carrier`, `item` (a drop value; default the gift roll), `doorHp` (60), `art` (tourist) |
| `ring-crate` | items/crate.ts | the road crate (the ring's pickup): lies still, picked up by a driven wagon whose slab overlaps it (no magnet); shots pass it; the item floats over it; applied through the pickup's own `collect(hero)` | `contains` / `kind` / `item` (a drop value; default `ringCrateRoll`), `dropped` + `vx` / `lift` / `vlift` (falls off a vehicle) |
| `ring-gantry` | hazards/gantry.ts | the matrix-sign gantry across the road (drawn oblique: far post behind lane 1, beam, signs and near post in front); signs switch on with a click as it comes into view; amber flashers on x / arrows / 50 | `signs` (4 faces: '', 'blank', 'x', 'arrow-far', 'arrow-near', '50', '80', '100', 'end'; numbers work), or `closed` (array, number or '3,4') + `stage` ('warn' / 'close') + `limit`; `jam: true` = 50 |
| `ring-closure` | hazards/closure.ts | a closed lane: yellow lines (a `RingLayer` on the road), a cone taper, the arrow trailer and the crash-absorber truck (the head: `HEAD_COST` 2 cells, a stop, a bounce to the open lane), cones along it (`CONE_COST` 1, knocked flying) | `length`, `toward` ('far' / 'near'), `truck` (false: cones only), `kind` |
| `ring-speedcam` | hazards/camera.ts | a camera post: passing a wagon in the front third (screen x ≥ `FRONT_X` 256) → flash, `ring.fine(slot)`; its red LED warns while a wagon it has not passed is there | `side` ('far') or `kind` ('gantry' stands on the median) |
| `ring-avgzone` | hazards/camera.ts | the average-speed zone: start and end signs; the average screen x between them in the front third → one fine at the end; a gauge under the HUD while it runs | `length`; `part: 'end'` entries are empty |
| `ring-jam` | hazards/jam.ts | the jam controller (invisible): the plan's jam (`length`) crawls at `crawl`, stands `hold` ticks at `holdAt` (waves then), clears after `length`; without `length`: its own 50 gantry, its own queue (`cars`, from `seed`), a hold until its waves are gone or `ticks` | `length`, `crawl`, `hold`, `holdAt`, `seed`, `ticks`, `cars`, `waves` |
| `ring-scooter` | scooter/scooter.ts | the scooter gang (`Enemy`, `body: false`, 20 hp, 200 points, tags `ring-scooter`, `ring-small`): weaves in front of the wagons, the pillion turns round and lobs a bottle into the target's lane (`RingBottle`: flies over everything, smashes where it lands, 1 cell) or fires a pistol back along the lane (½ cell); tells ≥ 18 ticks (`telegraphTicks`), only with its middle 22 px inside the view (`ATTACK_INSET`: the bottle and the muzzle start on screen), with an attack token; after its stay (`SCOOTER_AI.stay` 300 + 30 per gang index ticks in 'ride'), or when more than `crowd` = 5 are in play (riding, attacking, or entering on screen) and it is among the surplus in play longest, it speeds off ahead (`leave`, 3 px/tick on screen, no score; it dodges a car ahead as a rider does) so unshot gangs never pile up; one that enters while 5 scooters are on screen (or an earlier one waits) waits off screen at the road's pace and comes in when one has gone; in a standing jam (jam level > ½) it filters between the lanes (on the 2 \| 3 or 3 \| 4 lane split, a ±12 hurt slab so shots along both lanes beside it hit; it passes the wagons in the lanes beside it, only a wagon on its line touches it); the side ram (tags `ram` + `side-ram`) or any kill knocks both riders onto the hard shoulder (bloodless); gloat = a slow wheelie in place, cower | `look` (0–2), `gang`, `count` (an entry that spawns its group), `index`, `pillion` ('bottle' / 'pistol'), `hp`, `drop` (falls as a `ring-crate`) |

**The hostage carrier hook** (`items/carrier.ts`): `HostageCarrier` = `hostageSeat(out)`, `hostageDoor(out)`
(the door's x range on the carrier's plane y), `hostageDoorState?(0 | 1)`, `hostageOpened(slot)`,
`drawHostageDoor?(r)`; `isCarrier(e)`. The hostage owns the door: while tied it is an enemy-team
`shootable` whose only hurt box is the door slab (player shots and blasts open it; the carrier keeps
its cover off that slab). Opened: +500, the tally (`slot.rescued`, `stats.hostages`,
`mission.hostagesFreed`, 'hostageFreed', 'hostageRescued'), the door tumbles off, the hostage leaps
onto the rescuer's wagon roof (else the nearest; none: the hard shoulder), takes a curtain-call bow
(hostages never salute: docs/ORIGINALITY.md), drops its gift into the window (`giveItem`: applied at
once; on the shoulder a `ring-crate` in lane 4), hops down and runs off. Wave B's parcel vans and
caravans implement the same five members and spawn `ring-hostage` with `{ carrier: this, item }`.

**Events** (world): `ringFlash { slot, kind: 'speedcam' | 'avgzone', wagon, x, y }` (driver lines);
`hostageGift` (as on foot). **For the bot:** `RingBottle.landX`, `landY`, `ticksLeft` (where a lob
lands); cars are tagged `ring-car`, `solid`, `cover`; crates `item` + `ring-crate`; the hostage door
is a `shootable` on the enemy team.

**Sprites** (1×, 2×, 4×, one drawer each): `ring/car/<model>-<colour>`, `ring/car/wheel-<s|m|l>`,
`ring/car/dent`, `ring/car/van-open-<colour>`, `ring/car/cage`, `ring/car/cage-fall` (deferred);
`ring/item/crate`, `ring/item/glow`; `ring/hazard/{gantry-truss, gantry-post, sign, flasher, cone,
arrow-trailer, arrow-board, absorber, speedcam, flash, avg-sign, avg-icon}`;
`ring/scooter/<0|1|2>/{ride, tell-throw, throw, tell-shoot, shoot, wobble, gloat*, cower*, down,
driver-tumble, pillion-tumble, driver-sit, pillion-sit}` (* deferred), `ring/scooter/bottle`. The
hostage reuses `item/hostage/tourist/…`. **Sounds** (`RING_ROAD`): `ring/matrix-click`, `flash`,
`cam-beep`, `horns`, `cone`, `crash`, `dent`, `crate`, `cage-hit`, `hop`, `scooter-whine`,
`scooter-honk`, `pistol-cock`, `bottle-tell`, `throw`, `bottle`, `scooter-crash`, `scooter-down`.

**Tests:** `tests/content/ring-{traffic,hazards,items,scooter}.test.ts`.

## 17. Integration of wave A (2026-10-20)

Gates and measures of the merged wave (tmp/ring-a-integrate-report.md has the full numbers):

- Sims (`--mission ring --god --expect-complete --expect-ticks 28800-39600`): seeds 1–5 complete in
  32,777–33,562 ticks, 0.4 s wall, 0.011 ms per tick, at most 40–48 entities, 0 errors; 2P god
  and normal complete; every `--section` start completes. NORMAL (no god, the bot): 6–8 wrecks a
  run (bottles most, then car bumps and closures), 8–12 of the 12 hostages, 0–2 fines.
- The 4-second watch and the fairness watch (§14) on those runs: no enemy shot or bottle starts
  off screen, no hit from off screen, every tell ≥ 26 ticks on screen, at least 2 lanes open.
- The scooter (§16): it leaves after its stay or when more than 6 ride (`SCOOTER_AI.crowd`; the
  one in play longest goes), so even an idle player sees about 5 riding scooters. (Fixer
  2026-10-21: `crowd` = 5 counts the entering ones too, the surplus leaves at once and new ones
  wait off screen: an idle player sees 5–6, at most 7–8 while some leave; it was 8–12.)
- Liveries: 1P and P1 drive the white wagon, P2 the green one (`liveryOf`, spec §3).
- The boarding owns START: `PlayHost.startReserved()` (RingScene: `ringBoarding(world)`) keeps a
  player's START from pausing while it runs (Esc / P still pause), so START can skip it.

