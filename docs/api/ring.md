# Mission `ring` — runtime API

The A10 ring road, level 2 (spec: `docs/design/ring.md`). This file documents the core runtime
(`src/game/ring/`) that the builders extend. The ring runs on the **unchanged** engine `World`:
nothing in `src/engine/`, `mission/runner.ts`, `Player`, `Vehicle`, `Enemy` or `Boss` changes at
run time, so `ams` and m0–m5 stay byte-identical (spec §13). `ring` is **not** registered with
`defineMission`.

## R. Revision R — the short drive, the ZWAAN truck, the hand-over, the foot part (CORE, 2026-10-22; FROZEN)

Spec: `docs/design/ring.md` §R (it wins over every older section of this file and of the spec). The
older sections below still describe the drive's machinery; where they say "the ring ends at the exit"
or "the lorry in westpoort", read this part. Every interface named here is **frozen** at the end of the
CORE stage: the builders add, never rename. New engine / game features are **additive opt-ins**
(off by default); `ams`, m0–m5, the fps floors and `oldenzaal` stay byte-identical (`tmp/ring-r/id.sh`).

### R.1 The level and its URLs

```
boarding (S113) → oost → amstel → zuid (rai, zuidas, road) → [boss chunk: the ZWAAN train]
  → [final-jam chunk] → RING_HOOKS.alight → RingRunner.handOver() → 'handover'
  → ring-route.ringHandover → GameplayScene({ handover }) → rf-a DE FILE → rf-b DE BLOKKADE
  → missionComplete → ringFinalDone → ONE MissionCompleteScene (ringFinalTally) → GlitchBridgeScene
```

| URL / tool | What starts |
|---|---|
| `?mission=ring` | the whole level (short route) |
| `&section=oost\|amstel\|zuid` | the drive from that landmark (a run-in of `RING.runIn`) |
| `&section=zwaan` or `&boss=1` | the drive from `RING.runIn` px before the truck's slot (`ringStartDist`) |
| `&section=rf-a\|rf-b` | on foot (`ringFootScene`; a fresh plan for the seed and the drive's hostages); `rf-b&boss=1` → `bossRush` (reserved for the boat, wave B) |
| `&route=full` | the old loop (tests, sims). An unused landmark in `section` (`west`, `exit` …) implies it |
| `npm run sim -- --mission ring [--route short\|full] [--section …\|zwaan\|rf-a\|rf-b] [--boss] [--players 2]` | the same; ONE merged report |
| `npm run shot -- --mission ring [--route …] [--section …] [--boss]` | the same frames (the foot part labels `ring/rf-a …`) |

`boot.ts ringRouteParam(params)` reads `route` (params.ts has no field yet: it falls back to the page
URL). `ring-route.ts`: `ringRouteFor(section, route?)`, `isFootSection(section)`, `prepareRing(app, { seed,
section, route })`, `startRing(app, { section, boss, route, … }): RingScene | GameplayScene`.

### R.2 The route option and the short plan (`ids.ts`, `landmarks.ts`, `director.ts`, `plan.ts`)

- `planRing(seed, difficulty, { route?: 'short' | 'full', wave? })` — default `RING_DEFAULT_ROUTE` =
  `'short'`. `RingPlan.route` records it (absent = `'full'`). `RING_ROUTES = { short: ['oost','amstel',
  'zuid'], full: RING_LANDMARKS }`.
- `routeDefs(route)` (landmarks.ts): the director's landmark defs. The short route's `zuid` has a
  **`tail`** (`RingLandmarkDef.tail`): fixed chunks after its generated road — the boss chunk
  (`part: 'boss'`, `SHORT_BOSS_CHUNK` 384 px; the slot `ZWAAN_SLOT_OFFSET` 64 px into it, boss id
  `'ring-zwaan'`, lane 1, `boss.inTail`) and the final jam (`type: 'jam'`, `part: 'final-jam'`,
  `scene`, `speed: FINAL_JAM_CRAWL` 1.2, `FINAL_JAM_CHUNK` 384 px). Tail chunks carry
  `RingChunk.tail = true`: no plan waves, hostages, items or direction signs in them; outside the
  4-second estimate.
- `RING_PLAN.short`: `ticks`/`target` 7,200 (2:00 of road up to the boss chunk; ± 5 % checked, ± 2 %
  jitter); `forced` = `{ amstel: ['gantry'], zuid: ['speedcam'] }`; `never` (the grammar never picks)
  `gantry, speedcam, jam, avgzone`; at most 1 road works. The budget curve rises over the 2 minutes.
- The hazards layer gives the final jam one `ring-jam` with params `{ final: true, length, crawl, hold: 0,
  holdAt: 0, cars: 8, seed }` (no `waves`; no plan queue cars: the controller's `cars` tail). JAM+FOOT
  makes `final` never clear and shows the `FILE` / `BLOKKADE` gantry (no plan gantry: it would spawn
  before the lock).
- The golden record: `amstel` or `zuid`. `ringKmAt` ends a short plan at the next landmark's km (≈ 20).
- `checkPlan` is route-aware (short: the three landmarks, 2:00 ± 5 %, no mid-drive jam, the final jam
  last, exactly 1 closure + 1 speed camera, ≤ 1 road works, the one `ring-zwaan` slot in zuid's boss
  chunk, ≥ 1 hostage per stretch, the repair and 4-second rules).
- The full route's mid-boss id is ONE constant: `ids.ts RING_FULL_ROUTE_BOSS` (`'ring-zwaan'` since
  TRAIN-1 retired the lorry; `RING_ENTITY_B.lorry` is the same id; `checkPlan` and the landmark follow).

### R.3 The runner (`runner.ts`, `hooks.ts`, `alight.ts`, `cues.ts`)

- `RingState` adds `'handover'`. **`RingRunner.handOver(): void`** — only from `'playing'`: no victory
  banner, no `completed.push`, no tally; NO SCRATCHES noted for a full wagon; the continue hold ends; the
  loops fade; **event `'handover': { mission }`** (once). `runner.handedOver: boolean`.
- Plan end: the short route calls **`RING_HOOKS.alight(runner)`** (default null → `handOver()` at once);
  the full route `RING_HOOKS.planEnd` as before. `ring/alight.ts` (stub, OWNER: JAM+FOOT):
  `ringAlight(runner)` (the road stops: `limitSpeed(ALIGHT_KEY, 0)`, `ALIGHT_STUB_TICKS` 40, then
  `handOver()`), `ringAlighting(world): boolean` (the sim's pacing watch and the scene's START
  reservation ask it). The hook registers at import (RingScene imports the module).
- `ringStartDist(plan, section)`: a landmark → a run-in before it; `'zwaan'` → a run-in before the
  truck's slot; else 0. `RingRunnerOptions.section` accepts `'zwaan'`.
- **The multi-part boss.** A world `'bossDefeated'` whose boss has the tag `RING_ZWAAN_PART_TAG`
  (`'ring-zwaan-part'`) is ignored by the runner and the cues. The new world events (types.ts
  augments `WorldEvents`): **`'ringTrainPart': { part, index, phase: 'start' | 'beaten' }`** and
  **`'ringTrainDone': { controller }`** (once, after the cab). `ringTrainDone` sets `bossEndTick`, the
  vehicle bonus and (cues.ts) the stage theme's return; the boss song plays from the slot's spawn to it.
  `bossStartTick` is the first part's first phase. `mission-complete.ts LONG_BOSS_LIMITS = { m5: 240,
  ring: 240 }` (BOSS SPEED BONUS over the whole train).
- `RingReport` adds `route`, `handedOver`, **`train: { parts: { id, ticks }[]; catchUps: number[];
  ticks; done } | null`** (a part's ticks = its fight start → beaten; a catch-up = beaten → the next
  part's fight start) — the momentum numbers.
- `skip()` (F4) on the short route: stretch by stretch, then to the plan end (the alight).

### R.4 The ZWAAN contract (`content/ring/zwaan/`: `api.ts`, `part.ts`, `controller.ts`, `index.ts`)

Ids (`ids.ts RING_ZWAAN`): controller `'ring-zwaan'`; parts `'ring-zwaan-container'`, `-autos`, `-tank`,
`-vee`, `-cab`; `RING_ZWAAN_ORDER` (rear → front, R-16). Bar names `ZWAAN_NAMES` (ZWAAN CONTAINER,
ZWAAN AUTOTRANSPORT, ZWAAN TANKWAGEN, ZWAAN VEETRANSPORT, ZWARE JONGEN). Art prefix `zwaanArt(id)` =
`boss/ring-zwaan/<part>` (never under the prefixes ams preloads). Tuning `ZWAAN` (anchor 150, catch-up
130–180 ticks at 1.3 px/tick, coupling 10, gain 0.15 / max rel 3, adds 2/2/3, score 2,000 / 10,000,
rate 2 HP/tick burst 150, the beaten timings).

**The controller `RingZwaan` (owns):** the plan lock (`ZWAAN_LOCK`) for the whole train; the order
(`params.order`, unknown ids skipped), the lane (`params.lane`, 1), `params.adds` (false: none); the
phases `'wait' → 'enter' → 'fight' → 'catchup' → … → 'done'`; spawning part *i* at its chain place
(`world.spawn(id, x, laneY(lane), { lane, index })`, then `part.train = this; part.index = i`); the
ANCHOR (`anchorScreenX`: eased during the entry and each catch-up, a ±10 px drift while fighting);
the catch-up gang (scooters from behind, lanes 3–4); pushing wagons out of the waiting parts' slab
(½ cell); drawing the waiting parts (`zwaanPartDef(id).drawWaiting`); `'ringTrainPart'` (`beaten`)
and, after the last part, `'ringTrainDone'`, the unlock and its own removal (the plan rolls on to the
final jam at once). Public: `order`, `index`, `phase`, `active`, `catchUps`, `addsSent`, `chainFront()`.

**`interface ZwaanTrain`** (what a part asks): `order`, `index`, `laneY`, `catchingUp`, `pips: { total,
left }`, `anchorWorldX(): number`, `ready(part): boolean`, `partBeaten(part): void`.

**`class ZwaanPart extends Boss`** (`super(world, x, y, p, { art, name, hp, score, length, height? })`):
- anchor `x` = the REAR end, `length` px forward = the FRONT; `y` = its lane's plane y (1 | 2);
  tags `ring-zwaan-part`, `ring-block`; `hitbox` = the visual box; `removeOnDeath` true;
- `keepPace()` from `think()` (call `super.think()`): road speed + a pull to `train.anchorWorldX()`;
- `*intro()`: invulnerable until `train.ready(this)`, then `'ringTrainPart'` `start` and the fight;
- `onHit`: the damage-rate bucket (`ZWAAN.rate`; params `rate` (0 = none), `hp`, `hpScale`, `lane`, `index`);
- `onDeathStart` → `train.partBeaten(this)`; `deathSequence()` → **`*beatenSequence()`** (default:
  uncouple → brake → swerve onto the hard shoulder → tip (blast, `dropItem()`) → drop back off the
  left edge; then 'bossDefeated' (ignored by the ring) and removal); `beaten` = the step;
- `dropItem()`: a repair for a wagon at ≤ 6 cells, else `ZWAAN_DROP_WEAPONS[index]` (no rng);
- `barPips` (hud.ts draws the pips under the bar); `brakeT`, `fought`, `dropped`, `screenX`, `rearX`, `frontX`;
- `draw(r)` default: `drawZwaanPlaceholder` (rects, 1× only; every real part overrides it).
- A part adds its own `addPart(name, { box: zwaanSlab(x0, x1), … })`, `phases` (tells ≥ 18 ticks),
  and registers `defineEntity(id, …)` **and** `defineZwaanPart(id, { length, drawWaiting(r, x, y, tick) })`.

`index.ts` registers the controller and imports the five real parts (`container.ts`, `autos.ts`,
`tank.ts`, `vee.ts`, `cab.ts`; the integrator removed the CORE placeholders, wave A). `ring/boss`
(boss/index.ts) loads it; the parts' sprites load through `ring/boss/art` (boss/art.ts imports
`zwaan/{art-kit,cab-art,autos-art,tank-art,vee-art}`). HUD: `hud.ts BossBarPips` — any Boss with a
`barPips: { total, left }` field gets the pip strip (y 213); others draw as before.

### R.5 The hand-over chain (`ring-route.ts`, `gameplay.ts`, `mission/runner.ts`)

- `ringHandover(app, from: RingScene, runner): GameplayScene` — sets `from.handingOver = true` (the
  RingScene's exit skips `stopDense`: one tier-4 run), replaces the scene with a 40-tick fade.
- `ringFootScene(app, start: { seed, plan }, drive | null, { section?, bossRush? }): GameplayScene` —
  `new GameplayScene(app, { mission: 'ring', section, bossRush, handover: { def: ringFootDefOf(plan),
  artDef: ringArtDef(plan, drivers), onComplete } })`.
- **`GameplayOpts.handover?: GameplayHandover = { def: MissionDef; artDef: MissionArtDef; onComplete(runner,
  scene) }`** (OPT-IN; absent = unchanged): runs `def` with `continueMission`, preloads `artDef`,
  `onComplete` replaces the tally hand-off.
- **`RunnerOptions.continueMission?: boolean`** (OPT-IN, default false): `start()` keeps the per-mission
  stats (no `session.startMission`; only `missionId`), no banner, no announcer, no intro drop; a joined
  slot that is out of lives gets a fresh continue countdown (all out: the hold + 'allOut').
- `ringFinalTally(foot, { seed, finesBySlot }): NextRunner` / `ringFinalDone(app, foot, drive)` — ONE
  MISSION COMPLETE page: the foot runner's mission (hostages of the drive's stretches + the foot
  sections), the drive's FINES, `RING SEED <n>`; `afterTally` → the glitch bridge (`tallied`).
- Kept across the hand-over (the same `GameSession`): lives, score, bombs, weapon / ammo, continues,
  credits, `slot.mission` (route, kills, deaths, the boss ticks, golden record, NO SCRATCHES),
  `rescued`, the fines (passed in `drive`). `session.completed` gets `'ring'` once, at the end.

### R.6 The foot def (`content/ring/foot/`: `ids.ts`, `index.ts`, `section-rf-a.ts`, `section-rf-b.ts`)

`ringFootDef(plan | null): MissionDef` — UNREGISTERED (never `defineMission`), id `'ring'`, start
`'rf-a'`, sections `rf-a` (OWNER after CORE: JAM+FOOT) and `rf-b` (wave B), `bossSections: ['zuid']`,
`hostages: { ...plan.hostages, ...RING_FOOT_HOSTAGES }` (`rf-a` 1, `rf-b` 0), `footsteps`, `audioGroup:
'mission:ring'`, `artDensity: 4`, music `ring` / `ring-boss` (synth until wave B), `denseReserve`
`RF_SCENERY_RESERVE` (40 MB, a PLACEHOLDER: JAM+FOOT measures it). `RING_FOOT` = the def without a
plan. Ids: `RF_SECTION`, `RF_ART` (`ring/foot/`, `npc/ring/`, `fx/ring/`), `RF_GROUND` 176,
`RF_CHECKPOINT_GAP` 1,400. The placeholders: flat concrete at y 176, the ring sky (`ring-sky`), a few
`handhaver`s, one tied hostage and two crates in rf-a, the exit `rf-a-end` → rf-b, rf-b →
`missionComplete`. Keep the exports `sectionRfA` / `sectionRfB` and the ids.

**The hook (integrator, wave A):** the scene modules never import `content/ring/foot/` (it registers
sprites and entities, and `ring-route.ts` / `art-def.ts` are in every mission's static import graph:
the foot sprites leaked into `art-pool-preload.test.ts`). `foot/index.ts` sets
`RING_HOOKS.footDef = ringFootDef` at import; the scenes call `hooks.ts ringFootDefOf(plan)` (throws
when the `ring/foot` content is not loaded) and `ringArtDef` uses `RING_HOOKS.footDef?.(plan)` (null:
the stretches only). `art-def.ts` reads `RF_SCENERY_RESERVE` from `foot/ids.ts` (no sprites). The
sprites tool reaches the foot art through the manifest entry `ring/foot/art` (`foot/art.ts`: `art-jam`
+ `gangs/art`).

### R.7 Tier 4 (`art-def.ts`, `gameplay.ts`)

`ringArtDef(plan, drivers)` sections, in order: the stretches; after the stretch of the truck's slot
the pseudo-sections **`zwaanArtSection(i)` = `'zwaan:<i>'`** (part *i−1*, part *i* and part *i+1*'s
prefixes from `defineRingArt`: the integrator added the part before, whose wreck and grazing animals
stay on screen; every part also lists the kit `boss/ring-zwaan/kit/`), then **`rf-a`, `rf-b`** (their `art`). The train's prefixes are never in
`preloadLast`. The RingScene enters `zwaan:0` at the slot's spawn and `zwaan:<i+1>` at each beaten
part. **`MissionArtDef.sectionReserve?: Record<section, bytes>`** (OPT-IN): the stretches and the train
`RING_SCENERY_RESERVE`, the foot sections `RF_SCENERY_RESERVE`. TRAIN-1/2: `defineRingArt(partId,
['boss/ring-zwaan/<part>/'])`; death / wreck strips `defer: true`. The budget test
(`tests/content/ring-dense-budget.test.ts`) holds every section to 256 MB − 2 MB − its own reserve.

### R.8 Sims and sound

- `src/sim/headless-ring.ts`: options `route`, `boss`, `footBot`; `section: 'rf-a' | 'rf-b'` starts on
  foot. Both bots are registered (`bots`: the ring bot; `footBots`: bot.ts; each idles while its runner
  is null). `runner` = the RingRunner while it drives (null after the hand-over), `footScene` /
  `footRunner`, `world` = the one being played. `complete` = the level's end (the foot part's
  MISSION COMPLETE; the full route: the ring's). The merged `RingSimReport`: `ticks` (every tick),
  `driveTicks`, `sectionsVisited`, `bossDefeated` (the train), `foot: { ticks, complete,
  sectionsVisited, finalSection, kills, deaths, hostages, bossDefeated, gameOvers, sectionTicks,
  longestGap, gapAt, sectionGaps, deathsAt } | null`, the totals (kills, deaths, hostages, score,
  continues) over both parts, `train` (R.3; the integrator added `startTick` / `endTick`: the road
  before the train, the jam and the alight after it). The sim's summary line prints `train … road <n>
  after <n>` and `foot … [rf-a <n>, rf-b <n>] gaps [rf-a <n>, …]`.
- Expected ticks: see R.I (the measured wave-A numbers). `tests/game/ring/watch.test.ts` holds the
  whole level to 28,800–36,000 at the bot's pace — PROJECTED while rf-b is the placeholder (the run with
  rf-b's own ticks replaced by the planned 9,000; wave B sets `RF_B_PLACEHOLDER` false) — plus rf-a's
  longest empty stretch ≤ the gap limit and every catch-up ≤ 180 ticks.
- Sound: empty synth tables `content/sfx/ring-zwaan-a.ts` (`RING_ZWAAN_A`, TRAIN-1),
  `ring-zwaan-b.ts` (`RING_ZWAAN_B`, TRAIN-2), `ring-foot.ts` (`RING_FOOT`, JAM+FOOT), spread into
  `SFX`. The placeholders reuse `ring/lorry-screech`, `ring/lorry-slam`.

### R.9 The card

`content/ui/cards.ts`: the ring map adds the short route (S113 → Zuidas, a second line inside the
ring: `RING_SHORT`) and the blockade cross at the Zuidas (`RING_BLOCKADE`); the card text is unchanged
(English; its briefing still says "ONE LAP" — wave B re-words and re-voices it).

### R.T1 ZWAAN train: controller, container, cab (TRAIN-1, 2026-10-22)

Files: `content/ring/zwaan/{kit.ts, art-kit.ts, controller.ts, part.ts, container.ts, cab-geo.ts,
cab.ts, cab-art.ts}`, `content/ring/boss/{adds.ts, geometry.ts, art-lorry.ts, art-adds.ts,
art-kit.ts, art.ts, index.ts}`, `content/sfx/ring-zwaan-a.ts`. **`ring-lorry` is retired** (§22 is
history): `boss/lorry.ts` is gone, the full route's westpoort slot spawns `ring-zwaan`
(`ids.ts RING_FULL_ROUTE_BOSS`), the lorry's container half is the container trailer and its cab
became ZWARE JONGEN. Loading: the manifest entry `ring/boss` imports `zwaan/index` FIRST, then
`zwaan/container` and `zwaan/cab` (the real parts replace CORE's placeholders under the same ids);
`ring/boss/art` imports `zwaan/art-kit` and `zwaan/cab-art`.

**Local coordinates of every part:** x 0 = its REAR (the anchor), `length` = its FRONT (where its
drawbar reaches into the part ahead), y 0 = the road (its lane's plane y), up negative. It faces
right; lettering never mirrors.

**The kit (logic, `kit.ts`) — for TRAIN-2:**

| export | what |
|---|---|
| `ZWAAN_PACE = { trailerHp: 2050, cabHp: 1650, tankHp: 1300, veeHp: 1360, floorTicks: 1800 }`, `zwaanRate(hp)` | THE MOMENTUM: pass `rate: zwaanRate(hp)` (`ZwaanPartOpts.rate`) = (hp − the bucket's burst 150) / `floorTicks`; a part then lasts ≥ 30 s with any gun (the machine gun and the laser: 30–33 s), the pistol 32–46 s (the bot). Fixer 2026-10-22; see "Momentum tuning" |
| `ZWAAN_KIT` | `hitchY` −12, `drawbarBack` 16, `drawbarEye` 3, `dollyBack` 26, `dollyAxles` [−7, 7], `wheelR` 7.5, `rimR` 6, `touchGap` 24 |
| `KIT_SPR`, `ZWAAN_KIT_ART` (`boss/ring-zwaan/kit/`) | `drawbar` (0 coupled, 1 loose; anchor: the part's FRONT on the road), `hitch` (anchor: the REAR), `dolly` (its middle), `rim` (4), `wheel` = the shared `ring/car/wheel-l`. **Add `ZWAAN_KIT_ART` to your `defineRingArt`.** |
| `ZWAAN_SFX` | `clank`, `snap`, `tip`, `horn`, `window`, `gunner`, `squeal` (ids `ring/zwaan-…`) |
| `drawZwaanShadow(r, x, y, length, alpha?)` | the shadow under the whole part (the runner's pass centres one on the anchor = the rear: `ZwaanPart.shadowW` is now 0) |
| `drawZwaanWheels(r, x, y, xs, roll, { rims?, flash? })` | wheels at local `xs` (or blown rims) |
| `drawZwaanDolly(r, front, y, roll, flash?)` | the converter dolly under a trailer's front (frame + 2 wheels) |
| `drawZwaanCoupling(r, front, y, loose?)` | the drawbar at the part's front (loose once `beaten !== null`) |
| `drawZwaanHitch(r, rear, y)` | the towing jaw at a part's rear (the cab draws it; trailers may) |
| `uncoupleFx(world, front, y, t)` | the clank (t 0), the snap (t 4), coupling sparks (the base's beaten sequence calls it) |
| `zwaanSmoke(world, x, y, state, t, pts)` | damage smoke from local points by damage state |
| `pushWagonsOut(part, x0, x1, touched, { cost?, rearCost?, rearGrace? })` | a driven wagon in the slab: behind → held behind the tailgate, beside → to the lane away (½ cell; one bump / 24 ticks) |
| `laneFreeBeside(world, self, lane, x0, x1)` | no car / closure / forklift / `ring-block` beside it (a weave never goes into a car) |
| `zwaanShot(owner, x, y, angle, speed, type)` | an enemy bullet (road speed added, the difficulty's bullet speed) |

**The kit (art, `art-kit.ts`):** `Pen`, `defStrip` (1× + one density-generic drawer, cropped to the
1× box), `turnPt`/`Turn` (tipping frames), `roll`, `frac`, `hash2`, `lineW`, `zwaanMats(c)` (the
old lorry's materials), the livery: `swanHit(u, v, wing?)` / `swanMark(p, cx, cy, h, ink, z?)` (the
ZWAAN swan, our own mark: an S-neck swan swimming right), `wideHit` / `wideWidth` / `WIDE` (our
block letters), `LINE_NAME` 'ZWAAN', `ZWAAN_PLATES`, `ZWAAN_BOX_CODES` (made up), `glyphHit(C)`,
`holes`, `soot`, `mat`, `top`, `bot`, `finishA`. The container's wall now carries the swan mark.

**`part.ts` — what TRAIN-1 changed (additive; the contract is kept):** `ZwaanPartOpts.rate?`
(the damage rate; param `rate` still wins); `shadowW = 0` (the part draws its own shadow; the base
`draw` does); `beatT` (ticks into the current `beaten` step: tip frames); the default
`beatenSequence` calls `uncoupleFx` and `ring/zwaan-tip`; `partSpot(i)` (public, overridable: the
blast of a broken part at its visual spot) with a `breakPart` override (the blast there, +1000);
`center()` / `randomPoint()` on the visual box (not the road slabs).

**The controller (`controller.ts`, the `ZwaanTrain` interface kept):** the catch-up surges
(`ZWAAN_CATCH.surge` 18 px) then eases back (130–180 ticks); the gang (2 / 2 / 3); TRAFFIC while
the train holds the plan: a civilian every 360–600 ticks from behind in lane 3 or 4, passing at
1.1–1.5 px/tick (its own rng fork `ring-zwaan/traffic`; param `traffic: false` = none; none while
held or jammed); `carsSent` (tests). Measured: catch-ups 131–149 ticks.

**`ring-zwaan-container` (`ZwaanContainer`, `ZWAAN CONTAINER`, 2,000; length 150, height 68):**
parts 0 `box` (x 56…136, × 1, the pool; the bot aims at it), 1 `doors` (x 0…18 / −26…18 open,
× 1.5, own 420), 2 `bogie` (x 18…56, × 1.25, own 340); the phase-1 floor (55 % until the panel is
down); phase 1 `cargo` (the lorry's dump: tell 32, a free lane always), phase 2 `forklift` (HP ≤
55 % or the doors broken: the panel drops, the forklift charges, cargo while the doors live);
beaten: the forklift leaves, the loader jumps, the trailer tips (`box-tip`), the drop. Members:
`mode` ('cruise' | 'tell-cargo' | 'cargo'), `trace`, `thrown`, `doorOpen` / `doorTarget` /
`doorsGone`, `panelT` / `panelDown`, `loader`, `bogieBroken`, `forklift`, `cargoLanes()`,
`pickCargoLanes(n)`, `target()`. `drawContainer(r, x, y, look)` (also the waiting look).
`CONTAINER_AI`, `CONTAINER_X`. Sprites `boss/ring-zwaan/container/…` (was `boss/ring-lorry/…`;
the cab strips moved to the cab).

**`ring-zwaan-cab` (`ZwaanCab`, `ZWARE JONGEN`, 10,000; length 100, height 80; `cab-geo.ts`):** a
high-roof cab-over with a sleeper (x 38…66), the chassis with the tandem axles and the fifth wheel
(0…38). Parts 0 `cab` (x 64…100, × 1.5, the pool), 1 `sleeper` (x 38…64, × 1.25, own 420; broken:
the window smashes, the gunner tumbles out dazed, no more shots), 2 `chassis` (x 0…38, × 1).
Attacks (`mode` tell → strike): WEAVE `tell-weave` (36) → `weave` (lane 1 ↔ 2 in 44 ticks, the air
horn; never into a car), BRAKE CHECK `tell-brake` (24, the brake lights; a wagon ≤ 150 px behind
in its lane) → `brake` (−2.8 px/tick for 22 ticks: a ram, 1 cell), THE GUNNER `tell-gun` (30: the
window opens, he leans out and aims) → `gun` (3 / HARD 4 shots, 9 ticks apart, never forward of
straight across). Phase 2 `rage` (≤ 50 %): `UIT MIJN SPIEGEL!`, brake checks first. Beaten: THE
JACKKNIFE (`MIJN VRACHT...!`, the yaw strip, onto the hard shoulder, the drop, the driver climbs
out and sits dazed). Members: `mode`, `trace`, `weaving`, `laneChanges`, `blinkT`, `hardBrake`,
`windowT`, `gunner`, `sleeperBroken`, `shots`, `yawF`, `driverOut`, `cabState`, `laneFree(to)`,
`wagonBehind()`, `target()`. `drawCab(r, x, y, look)` (also the waiting look). `CAB_AI`,
`CAB_LINES`, `CAB`, `CAB_X`, `CAB_SPR`. Sprites `boss/ring-zwaan/cab/`: `body-<0|1|2>`, `yaw` (4,
deferred), `window` (3), `gunner/<aim|fire>` (cut at the sill), `gunner/<tumble|sit>` and
`driver/<tumble|sit>` (deferred), `blink`, `brake`. `shotLift` 49.

**Measured (the ring bot, god, `--section zwaan`, normal, seeds 1–5):** the container 30–41 s and the
cab 32–37 s with the pistol, the machine gun or the shotgun (1P); 2P (pistol) 30–43 / 33–42 s.
Tests: `tests/content/ring-boss.test.ts` (the parts), `tests/content/ring-zwaan.test.ts` (the controller).

### R.T2 ZWAAN train: car transporter, tanker, livestock (TRAIN-2, 2026-10-22)

Spec §R.3 parts 2–4, on CORE's `ZwaanPart` and TRAIN-1's kit (`kit.ts`: `ZWAAN_PACE`, `pushWagonsOut`,
`uncoupleFx`, `drawZwaanShadow/Dolly/Wheels/Coupling/Hitch`). Files (`content/ring/zwaan/`): `autos.ts`,
`autos-geo.ts`, `autos-art.ts`, `autos-kit.ts` (TRAIN-2's shared kit), `tank.ts`, `tank-geo.ts`,
`tank-art.ts`, `vee.ts`, `vee-geo.ts`, `vee-art.ts`, `vee-animals.ts`, `vee-animals-art.ts`; sound
`sfx/ring-zwaan-b.ts` (`RING_ZWAAN_B`, ids `ring/zwaan/*`). REGISTRATION: the logic modules
(`autos`, `tank`, `vee`) register `defineEntity` + `defineZwaanPart` + `defineRingArt` and must load
AFTER `zwaan/index.ts` (it registers the placeholders); the art modules (`autos-art`, `tank-art`,
`vee-art`) are separate (the art manifest).

Every part: rear end = anchor, `index`, lanes 1–2; parts SIDE BY SIDE, never overlapping (a
straight-across shot takes the first box it meets, ties go to the lowest index): part 0 is a wide
body section that never breaks (the ring bot aims at part 0). Pace: HP `ZWAAN_PACE.trailerHp ×
0.8` (the car transporter), `ZWAAN_PACE.tankHp`, `ZWAAN_PACE.veeHp`; rate `zwaanRate(hp)` (see
"Momentum tuning"); 2,000 points. `mode` 'tell-X' → 'X' (the sim's
watch), `trace: { attack, tell, fire, seen, lane }[]` (tests), `resetAttack()` (a stagger, a new
phase). The big bodies never flash white (sparks and a clang instead); the weak points flash.

| Part (bar) | Parts (index: box, mul) | Attacks (tell base) | Beaten |
|---|---|---|---|
| `ring-zwaan-autos` ZWAAN AUTOTRANSPORT, 196 px | 0 `deck` 14…52, 1 `ram-r` −2…14 (own HP 380, × 1.5), 2 `ram-f` 52…68 (380, × 1.5), 3 `deck-front` 68…196 | ROLL-OFF `tell-roll` (32: the ramp lowers, hydraulic hiss) → the lower deck's rear car rolls down the ramp; SLIDE-DOWN `tell-slide` (32: the upper deck's rear section tilts 15°) → its car slides off, falls, bounces once. A broken ram snaps (dark oil): the ramp drags (tell: hazard lights + creak) / the deck sags (tell: the car shakes). Phase 2 (≤ 50 % or both rams) shorter pauses. Stock `stock` (4) cars per deck behind the 2 slots | uncouple → the decks fold → onto the shoulder, the cars SPILL onto the shoulder (not solid) → the drop |
| `ring-zwaan-tank` ZWAAN TANKWAGEN (`FRITUURVET`), 156 px | 0 `tank` 17…70, 1–3 `valve-a/b/c` (360, × 1.5; a = the dump valve −2…17), 4 `tank-mid`, 5 `tank-front` | SLICK `tell-slick` (30: the hose swings out) → `ring-zwaan-slick` sprayed into a lane for 44 ticks; FLAME `tell-flame` (34: a hot valve sparks and hisses, the `fuse` streak runs back along the lane) → `ring-zwaan-flame` runs back and burns (1 cell, fire). A valve flares when its `heat` (damage since its last flare) reaches 70 × HP scale (gap 200); phase 2 (≤ 55 % or a valve broken): a flare after every slick | uncouple → brake (small blasts) → the FIREBALL (`l` + 2 × `m`, bloodless) → the tank ROLLS onto the shoulder (`rollF` 0–3, `rollDy`) → the drop; the bare chassis and the tank drop back |
| `ring-zwaan-vee` ZWAAN VEETRANSPORT, 164 px | 0 `body` 12…102, 1 `gate` −2…12 (360, × 1.5), 2 `hatch` 102…126 (320, × 1.5), 3 `body-front` | THE HERD `tell-herd` (34: the gate drops, a moo) → 2 (HARD 3) animals walk down and trot to the shoulder, at most 2 (HARD 3) on the road; THE LOB `tell-lob` (30: the farmhand hoists a bale / a churn) → `ring-zwaan-lob` lands where the wagon will be (1 cell). Gate broken: it tumbles off, the animals hop out. Hatch broken: the farmhand ducks dazed (`IK ZIE STERRETJES...`), no lobs. Lines `VEE_LINES` (Dutch) | uncouple → brake (the gate drops) → onto the shoulder, it STOPS (no blast) → 3 animals wander out of its side and graze; the drop |

Things they drop (each removed off the left edge):
- `ring-zwaan-car` (`ZwaanCar`, params `colour`, `mode` roll|slide|fall|road|spill, `host`, `lx`, `lane`,
  `lift`): on the road a `ZwaanObstacle` that drifts back (−1.5 px/tick on screen) and veers into its
  lane (`busyLane()`).
- `ring-zwaan-cow` / `ring-zwaan-pig` (`ZwaanAnimal`, tag `ring-zwaan-animal`, params `mode`
  ramp|trot|graze|wander, `host`, `lx`, `look`): trot −0.8 / −1 px/tick on screen and 0.6 / 0.75 px/tick
  toward the shoulder, graze at y `SHOULDER_TOP + 4` (world-fixed, not solid). NEVER hurt: `onHit`
  false, no death; a shot that stops on one → a moo / an oink (rate-limited) and a hop.
- `ZwaanObstacle` (`autos-kit.ts`): a neutral `SolidBox` over the slab (stops both teams' shots in its
  lane), tags `ring-car`, `solid`, `cover`, `ring-zwaan-obstacle` (the bots, scooters and cargo treat
  it as a car); a wagon that drives into it pays 1 cell (`gangs/kit pushWagons`, rear cost 1; a side
  touch ½); `shots` counts the shots that ended on it; `solid` false in the air / on the shoulder.
- `ring-zwaan-slick` (`ZwaanSlick`, world-fixed `x0 … x1` in its lane, `grow(x)`, `slid`): a driven
  wagon whose slab touches it gets `Wagon.slip(40)`.
- `ring-zwaan-flame` (`ZwaanFlame`, params `ax` (screen x of its front), `len` 210, `fuse`): screen-fixed
  behind the tanker; states fuse → run (5 px/tick) → burn (50) → die (24); `burning`, `burned`.
- `ring-zwaan-lob` (`ZwaanLob`, params `kind` bale|churn, `ty`, `ticks`, `vx`, `lift`, `arc`): tagged
  `ring-bottle` (`landX`, `landY`, `ticksLeft` for the bot); 1 cell in a 22 × 14 spot.

Lanes: every attack picks its lane with `pickLanes` (the target wagon's lane first, never a lane with
one of our obstacles / slicks / flames / the cargo on screen, and at least one open lane left free).

**`Wagon.slip(ticks)` — ADDITIVE OPT-IN (`ring/wagon.ts`, off by default: `slipT` 0):** fields `slipT`,
`slipLane`; while `slipT > 0` a lane press is stored in `slipLane` and taken when the slide ends,
the stick changes the screen speed at 0.12 × the normal rate and a held FIRE no longer stops the
side speed (the swerve still works); `physics()` counts it down. Nothing else calls it.

Sprites (`defStrip`, 1× / 2× / 4×, one drawer each; `boss/ring-zwaan/<autos|tank|vee>/`): autos
`frame-<s>`, `head-<s>`, `updeck`, `updeck-broken` (deferred), `ramp`, `ramp-broken` (deferred),
`car-<red|sky|gold|gable|green>` (4 tilts), `lamps`; tank `body-<s>`, `valve`, `hose`, `blob`, `slick`,
`streak`, `flame`, `roll` / `chassis` (deferred), `lamps`; vee `body-<s>`, `gate`, `gate-fall` (deferred),
`hatch`, `farmhand-<stand|lift|lift-churn|throw|duck>` (duck deferred), `bale`, `churn`,
`cow-<walk|trot|graze>`, `pig-<walk|trot|graze>`, `lamps`. Wheels, the dolly, the drawbar and the hitch
are the kit's.

**Measured (the ring bot with the pistol, god, normal, `--section zwaan`, seeds 1–3, the full pool
before the × 0.88 / 0.83):** autos 37–40 s, tank 39–49 s, vee 39–42 s (the container 34–37 s); a part
alone behind a controller on amstel 32–41 s. Tests: `tests/content/ring-zwaan-parts.test.ts`.

### R.F Final jam, alight, rf-a (JAM+FOOT, 2026-10-22)

Spec §R.4, §R.5. Every change outside the new files is an ADDITIVE OPT-IN (off by default).

**The final jam** (`content/ring/hazards/jam.ts`): param `final: true` (OPT-IN) — on its first tick a
gantry comes in with `signs: ['x','x','x','x']` and `drip: 'file'`; its tail (`cars`) drives in and
stands; the road crawls at `crawl` to the chunk's `length`, then phase `'hold'` (cap 0, level 1) for
good: it never clears (`clear()` is a no-op), `waves` / `after` are emptied. `RingJam.final`.
**The gantry's text panel** (`hazards/gantry.ts` + `hazards/art-drip.ts`): param `drip` (OPT-IN) →
`RingGantry.drip` (frame; −1 none); `ring/hazard/drip` (2: dark, `FILE` / `BLOKKADE` amber LEDs, our
own lettering) clamped to the far post (`DRIP_AT`); `DRIP_TEXTS`, `dripFrame(key)`.

**The alight** (`ring/alight.ts`, `RING_HOOKS.alight = ringAlight`, CORE's signature kept):
`AlightDirector` (hidden entity) — every hero in a driven wagon (`mounted`, or `spawn` still driving
in: it arrives first) gets a seat; NO SCRATCHES is noted while he is still mounted; the wagons go
`scripted`, keep pace with the stopping road and settle in their lanes; then per seat `'stop' →
'wait'` (P2 later: `ALIGHT.delay`) `→ 'jump'` (the boarding somersault backwards from the sill, k 1 → 0,
`ring/foot/door`, `ring/foot/land` + dust) `→ 'land' → 'done'`; all done → `runner.handOver()`. The
drivers stay at the wheel, silent. No seat (all out / wrecked) → hand-over after `ALIGHT.stubTicks`.
START skips it after the first play (`setAlightSeen`, `alightSeen`); `ringAlighting(world)` as before.
`ALIGHT_KEY`, `ALIGHT_STUB_TICKS` kept.

**rf-a DE FILE** (`content/ring/foot/`):
- `layout-rf-a.ts`: `RF_SHIFT` 27 (the ring's road layers moved up: the feet line 176 on the hard
  shoulder), `CAR_Y` 171 (the near lane's wheel line), `FAR_LANE_Y`, `RF_A_W` 3,200, `RF_A_VEHICLES`
  (cars `ring/car/…`, the two wagons, the coach, the gang's parcel van, the police van),
  `RF_A_PLATFORMS` (their roofs, from the drive's geometry: one-way platforms), `RF_A_BLOCKS`
  (concrete blocks: solids, cover), `RF_A_SCOOTERS`, `RF_A_ARENAS` (locks at 700, 1,500, 2,320),
  `RF_A_CHECKPOINTS` (860, 1,700, 2,480), `RF_A_HOSTAGE_X`, `RF_A_CRATES` (M, S, F), `RF_A_POLICE_LINE_X`,
  `RF_A_EXIT`.
- `section-rf-a.ts`: `sectionRfA` (exports kept), `RF_BACKGROUND` = the drive's layers `ring-sky`,
  `ring-far` towers, `ring-city` zuidas, `ring-verge` plain, `ring-farroad` rail, `ring-road` (576 px
  tile: six lane dashes), `ring-front` (front) — rf-b uses it too; the far lanes' standing cars as back
  decor (`farCars(width)`, thinning toward the near lane). Terrain style hidden (collision only).
- `props.ts`: entity `ring-foot-scene` (`RfJamScene`, z −20, after the terrain, behind every actor)
  draws the shoulder / verge strip (`ring/foot/verge`), the near lane's vehicles, the PARKED WAGONS with
  their drivers (the drive's `Wagon` drawn as decor, never in the world; P2's only in 2P), the dumped
  scooters, the blocks, the police line (`policeLine`: 0 taut, 1 flutter, 2 snapped by a hero), the
  queue's horns. `spawnJamScene(world, def)`; the drivers: `rfPlanDrivers` (a WeakMap def → the plan's
  driver list, set by `ringFootDef(plan)`) and `footDrivers(planDrivers, slots)` (ring-route's rule).
- `script-rf-a.ts`: `scriptRfA`, `RF_A_FOES`; three locks, the NIET THUIS gags, couriers on roofs, the
  hostage van guarded by the crew; a pacing guard (`RF_A_TRICKLE` 150 ticks without a gang member in
  view → a rider walks in, until the police line).
- `art-jam.ts`: `ring/foot/verge` (2), `ring/foot/bus`, `ring/foot/police-van` (2), `ring/foot/police-line`
  (3), `ring/foot/kbarrier`; sizes `BUS`, `POLICE_VAN`, `KBARRIER`, `VERGE_W/H`.

**The ring gangs on foot** (`content/ring/foot/gangs/`): base `FootGang extends Creature` (kit.ts:
tokens, `tele` ≥ 18, hand-in-view rule, walk with a `Turner`, never off the own floor, hops low blocks,
`hit` strip; the bloodless end `endPhase` `'roll' → 'dazed' → 'flee'` (runs off out of view; `dead`
from the hit: never a target, `waitClear` does not wait); gloat / cower via the Enemy reactions);
hooks `choose(t, dist)`, `tellOf(kind)`, `strike(kind)`, `strikeOf(kind)`, `during(kind, t)`.
Entities (kinds.ts, `FOOT_GANG`): `ring-foot-rider` (20 HP; pistol tell 24, bottle lob tell 24; param
`look` a|b), `ring-foot-courier` (20 HP; parcel lob tell 26, `PAKKETJE!`; param `gag`: the NIET THUIS
card, the decal entity class `NietThuisCard`), `ring-foot-crew` (50 HP; crowbar swing tell 22 `OPZIJ!`,
shotgun 3 pellets tell 28). Gloat lines `MOOI WEER, HE?`, `HANDTEKENING, GRAAG.`, `PAUZE.` Art (art.ts,
fixed box `GANG_BOX` 44 × 48, the HD frames take the 1× points): `ring/foot/rider-a|rider-b|courier|crew/`
`idle walk run turn alert hit die* dazed* gloat* cower*` (* deferred) + the kind's `tell-…` / attack
strips (courier `stick*`). Thrown things reuse `ring/scooter/bottle`, `ring/parcel-van/parcel`.

**Sound** (`content/sfx/ring-foot.ts`, `RING_FOOT`): `ring/foot/door`, `land`, `honk`, `pistol`,
`pump`, `shotgun`, `crowbar-tell`, `crowbar`, `tumble`, `dazed`, `tape`.

**Tests**: `tests/content/ring-foot.test.ts`. Tier 4: rf-a's `art` lists `ring/foot/`, four
`ring/parcel-van/…` ids, the hostage and crate ids; the budget test (`ring-dense-budget.test.ts`) covers
rf-a with `RF_SCENERY_RESERVE` (the background layers at 4× + 2× ≈ 26.5 MB; 40 MB kept).

### R.I Integration of wave A (INTEGRATOR, 2026-10-22)

**Wiring.** `zwaan/index.ts` = the controller + the five real parts (the placeholders are gone);
`boss/art.ts` loads the TRAIN-2 art; the TRAIN-2 parts list `ZWAAN_KIT_ART` in `defineRingArt`; the
stale `boss/ring-lorry/` art entry is gone and `light.ts LIT_TYPES` lights `ring-zwaan-cab` (was
`ring-lorry`); `RING_HOOKS.footDef` / `ringFootDefOf` (R.6); manifest `ring/foot/art`;
`params.ts LaunchParams.route?: 'short' | 'full'` (absent unless `?route=` is set; `boot.ringRouteParam`
reads it, no page-URL fallback any more).

**One hit-flash rule for the train:** the big bodies never flash white (a white wall reads as a glitch);
a hit on a body sparks and dents (`autos-kit.ts bodySpark`, `ring/dent`); only the weak points flash
(the container's doors and bogie, the rams, the valves, the gate and the hatch, the cab's sleeper
window). The cab follows it now (`cab.ts onHit`; its `o.flash` is always false).

**The ring bot (`src/sim/bot-ring.ts`, keyed to the new ids only):**
- aims at a ZWAAN part's EXPOSED weak point (`aimAt`: no other live box between the hero and it — a
  shot stops at the first box in its lane — highest multiplier first, then the wider box; a broken
  part is skipped; a box no aim meets from here gives way to the next one);
- avoids `ring-zwaan-slick` (its lane over `x0 … x1`, worse on it) and `ring-zwaan-flame` (its lane over
  the screen span `ax − len … ax`, the tell included); the dropped cars and the animals are `ring-car`
  obstacles (neutral, solid) and the lobs `ring-bottle`s, which it already reads; the cab's brake check
  uses the `tell-brake` / `brake` modes it already swerves from;
- 2P: a line-up on a part that runs `STUCK_TICKS` (60) makes it leave its lane, twice that it fires
  the nearest aim anyway (the two wagons wanted each other's screen x: the car transporter took 66 s).

**Momentum tuning** (`zwaan/kit.ts ZWAAN_PACE`, `zwaanRate`; integrator, then the fixer
2026-10-22): HP container 0.9 × 2050 = 1,845, car transporter 0.8 × 2050 = 1,640, tanker 1,300,
livestock trailer 1,360, cab 1,650 (× difficulty × co-op); every part's damage rate = (HP − 150) /
1,800 ticks, so ANY gun needs ≥ 30 s (the full bucket's burst included). Before the fixer the flat
rate 1.1 let the machine gun beat the tanker, the livestock trailer and the cab in 22–23 s, and the
laser did NO damage on the ring (the beam read the ring hero's 'mounted' state as "not holding the
gun" and ended before its first zap: fixed with the additive `GunMount.gunReady`, weapons.ts, and
`RingHero.gunReady` / `muzzleWorld` / `aimAngle`; the beam is drawn at the gun's height like the
shots). Measured with `tmp/ring-r-fix/probe4.ts` (`--section zwaan`, god, normal; the start
weapon's ammo kept full; seconds per part, container / autos / tank / vee / cab):

| Run | Mean | Max |
|---|---|---|
| 1P machine gun (seeds 1–5) | 33.1 / 31.4 / 31.1 / 31.3 / 32.5 | 37.1 / 33.3 / 33.7 / 32.6 / 35.0 |
| 1P laser (seeds 1–5) | 30.4 / 30.3 / 30.2 / 30.1 / 30.0 | 31.4 / 31.1 / 30.5 / 30.3 / 30.0 |
| 1P pistol (seeds 1–5) | 39.7 / 35.8 / 36.1 / 40.1 / 35.7 | 42.1 / 46.1 / 39.3 / 45.2 / 39.4 |
| 2P machine gun (seeds 1–7) | 30.7 / 31.0 / 30.4 / 30.3 / 30.7 | 32.1 / 31.8 / 31.4 / 31.2 / 32.7 |
| 2P pistol (seeds 1–7) | 38.9 / 34.1 / 31.8 / 30.7 / 37.3 | 50.2 / 39.0 / 35.1 / 33.0 / 44.1 |

The 2P car transporter was 67 s mean (max 99 s) with two pistols: the two bot wagons sat in one lane
and pushed each other apart, one wanting forward, one back. The ring bot's player 2 now keeps out of
player 1's lane on a train part (`PARTNER_LANE` 150), and a weak point counts as hidden only by a box
on the last `HIDE_SPAN` (44) px of a diagonal shot's way (bot-ring.ts).

Catch-ups 131–169 ticks. The whole level (god, normal, seeds 1–5): 24,080–26,288 ticks with the
rf-b placeholder (850) → projected 32,230–34,438 with wave B's 9,000; 2P seed 1: 23,287 → 31,431.
The full route (`--route full`, the train in westpoort) completes in 44,527. The road before the
train ≈ 7,420–7,650 ticks (the boarding included), the final jam and the alight ≈ 500, rf-a
3,780–4,570 (1P) / 3,340–3,530 (2P). The longest empty stretch on the short drive: 164–218 ticks
(god seeds 1–10, 2P 1–3; the short route's forced-wave mark `RING_PLAN.short.gapPlace` 80, was 130
→ 243–266), rf-a 150 (its trickle guard). Baselines: `tmp/ring-r/base-a/` (refreshed by the fixer).

**Tier 4** (seeds 1–5, every hero, 1P / 2P pairs; the working set + the section's reserve):
the drive ≤ 130 / 154 MB, `zwaan:0..4` ≤ 129 / 153 MB, `rf-a` 140 / 164 MB, `rf-b` 137 / 161 MB (fixer: the placeholder now has a trickle of the ring gangs) —
all far under 256 MB.

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

Wave-B parts and adds (`RING_ENTITY_B_PARTS`; spawned by the wave-B entities or the jam
controller, never by the plan's cursor): `ring-parcel`, `ring-boarder`, `ring-forklift`,
`ring-barrel`.

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
  `flash`, `hostage`, `low`, `tunnel`, `boss`, `exit`, `arrive`; wave B: `scan` (SCAN LOCK),
  `tow` (hooked), `brake` (a brake check), `caravan` (it comes loose), `roadworks` (the truck in
  view), `boarder` (one on the bonnet), `sticker` (a fine on the glass), each said by the wave-B
  entity for the wagon it targets; ≤ 24 characters × 2 lines; a
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
'ring', bossMusic: 'ring-boss', artDensity: 4, hostages: plan.hostages, … }`. `ringSong(id)` returns
the id (wave B: the synth songs of `content/music/ring.ts`). `freshSeed()` (crypto when present, once per play)
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
drivers) × every stretch ≤ 256 MB − 2 MB − the scenery reserve (222 MB). Measured 2026-10-20 (wave A):
peak 1P 75.5 MB (bob, driver thom, coentunnel), 2P 99.5 MB (dirk + bob, drivers patrick + thom);
the heroes take about 25 MB each, the wagons 18.6, the scooters 8.1, the cars 5.8. Wave B
(2026-10-21, wave-B plans): peak **1P 108.0 MB** (seed 6, bob, driver thom, westpoort), **2P
132.0 MB** (seed 6, dirk + bob, drivers thom + patrick, westpoort: the boss stretch with the
lorry's 9.8 MB, the boarders 9.3, road works 3.3, vans 3.0, caravans 2.8, motos 2.8, scan car 0.9,
tow truck 0.8). The test also checks that each stretch holds the families of the wave-B enemies
it uses (the jam's stretch: `ring/boarder/`) and that the lorry is the boss art of `westpoort`.

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
`score`, `complete`, `gameOver`, `spawned`, `skipped { id: n }`, `bosses` (`{ id, spawned, ticks }`:
`ticks` = spawn → gone, the time to kill; −1 while it fights or never came), `errors`,
`maxEntities`. Wave B: `finesBySlot` (the tally page's FINES), `xray` (`RingXray`, below).

**The x-ray** (`ring/xray.ts`, `RingXray`; drawn last in `draw`, after the light): while more than
`XRAY.cover` (40 %) of a driven player wagon's body is behind nearer vehicles (tags `ring-car`,
`ring-block`, `ring-big`, `ring-wagon`, `boss`; drawn after it in the depth sort, their visual
boxes), the wagon draws itself once more into a private software renderer (`min(art density,
res, XRAY.maxDensity 2)`: fixer B, the 4× buffer cost about 1.3 ms per covered wagon per frame) and the x-ray goes on screen as a streamed frame, only over the covered rows of each column:
a faint fill of the hidden body (the player's hue at alpha 0x50), a line in the player's colour
(P1 `sky[1]`, P2 `gold[2]`; ½ logical px at 2×, 1 px at 1×) and a dark ink ring outside it.
Never for enemies; cosmetic only (no game state, no rng). `coverOf(wagon, entities)` (0 … 1),
`shown` (wagons outlined in the last draw). About 1.3 ms per covered wagon at 4× (node).

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
`MissionCompleteScene` (the ring's own tally page, wave B) → `GlitchBridgeScene` (it freezes the
page) → the fps floors (level 3) → the ending.

- **The card** (`content/ui/cards.ts`): `MISSION 2`, `DE RING`, `A10 RING ROAD, AMSTERDAM - 1400
  HOURS`, Gusto's two lines, an A10 line map (the dot on the on-ramp at A10 Oost). On enter it calls
  `prepareRing(app)` (the seed and the plan) and `preloadRing(app, start)` (2× / 4× art via
  `preloadMissionArt(app, ringArtFor(start, session), 4, session, startStretch(start))`, the 1×
  `RING_ART` in 4 ms slices, the ring's sample group `RING_AUDIO_GROUP` = `mission:ring`: the ams
  group's sound effects and voices without its two songs, the same entries so a file decodes once);
  START → `RingScene({ start })`.
- **Seeds**: `prepareRing` takes the given seed, else `?seed=` (`app.params.seed`), else
  `freshSeed()` — a new ring each play. The seed shows in the debug overlay (`SEED n <STRETCH>`) and
  in the footer of the ring's tally page (`RING SEED n`).
- **`RingScene(app, { start?, section?, seed?, session? })`**: `new RingRunner({ session, pads, audio,
  seed, plan, section, settings })` and `attachRingCues(runner)` (the music cues, §18; detached on
  exit); events: `complete` → `ringDone` (the ring's tally page, then the bridge), `allOut` → `CONTINUE?` (the announcer; banners and GO go),
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
- **The end** (`ringDone(app, from, runner)`, wave B): `MissionCompleteScene(app, ringTally(runner))`
  — the newspaper of the other missions (`tallyLines`: HOSTAGES of the ring's stretches, STANDING
  OVATION, FLAWLESS, BOSS SPEED, VEHICLE AT THE FINISH, NO SCRATCHES), plus the ring's info line
  `FINES n X 500` (`tallyNotes`; the fines were paid during the play, `runner.finesBySlot`), the
  footer `RING SEED n` (`tallyFooter`). The page pays the TOTAL. After it (`afterTally`):
  `GlitchBridgeScene({ from: page, runner, tallied: true })` — it freezes the page, records the
  clear (`recordMissionClear`: `campaign.missions` gets `ring`, the golden record per slot), pays
  nothing and stores no bonus record, so the floor-1 tally has no `MISSION 2 BONUS` line (dropped:
  the ring had its own page). Its story card opens with `BRIDGE_OPENING` (one neutral line). The
  optional `TallyRunner.tallyNotes` / `tallyFooter` and `NextRunner.afterTally` and
  `BridgeOpts.tallied` are additive (a MissionRunner has none: the ams page and a bridge from any
  other mission are unchanged).
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
  `offscreenHits`: landed wagon hits whose attacker is more than 8 px off screen, `attacks`, `minTell`, `minTellInView`:
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
floor only at `gapJam` = 100 ticks (fixer B: 120 → 100, jam gaps of 250 ticks; its stand's wave counts through the stand) (the stopped cars are cover: gangs there stay long); its own wave is the
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
| `ring-jam` | `behind` at the jam start, `y` 204 | `length`, `crawl` (px/tick), `hold` (ticks), `holdAt` (px into the jam), `waves`, `after` (EASY only: the gang when the stand ends), `seed` |

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
- **Wave B:** `RING_CONTENT_WAVE = 'B'` since 2026-10-21 (§23): `planRing(seed)` makes wave-B
  plans; `{ wave: 'A' }` still makes a wave-A plan (tests). Hostages ride in parcel vans and
  caravans (`{ hostage: true, item }`, lanes 3–4).

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
| `ring-car` | traffic/car.ts | civilian traffic: a neutral `SolidBox` over its slab (stops both teams' shots, only in its lane); dents (5 / 14 shots ending on it: `dents` 1 / 2, glass cracked), never destroyed; keeps a gap to what is ahead, never backs into a wagon that holds back, never pushes a wagon at the left end of its band
(`wagonBandEnd(w)`: `RING.screenMinX`, or queued in front of the other wagon there) off the screen (it
is shoved ahead of it instead, standing in a jam too; a push that would take the wagon past that end
takes it only down to it; fixer B, polish 2026-10-21), merges out of a lane closed ahead (a closure, a tunnel's lane 4), brakes with the jam; a wagon that drives into it is pushed out and gets `Wagon.bump` (½ cell light, 1 cell over `BUMP_HARD` 1.4 px/tick or a swerve; slow contact blocks for free); a wagon beside it whose own lane closes (a tunnel's lane 4) is never held between the lanes: the car yields along its lane (`WEDGE_YIELD` 2 px/tick) and the wagon slips in behind or in front, for free | `model` (hatch, estate, van, taxi, camper, box-truck), `colour` (index or name), `rel` (screen speed; default by lane 0.7 / 0.3 / −0.35 / −0.75), `hostage`, `item`, `stopAt` + `jam` (a jam queue car) |
| `ring-hostage` | items/hostage.ts | a tied hostage riding on a carrier (below); without `carrier` the factory makes a hostage van | `carrier`, `item` (a drop value; default the gift roll), `doorHp` (60), `art` (tourist) |
| `ring-crate` | items/crate.ts | the road crate (the ring's pickup): lies still, picked up by a driven wagon whose slab overlaps it (no magnet); shots pass it; the item floats over it; applied through the pickup's own `collect(hero)` | `contains` / `kind` / `item` (a drop value; default `ringCrateRoll`), `dropped` + `vx` / `lift` / `vlift` (falls off a vehicle) |
| `ring-gantry` | hazards/gantry.ts | the matrix-sign gantry across the road (drawn oblique: far post behind lane 1, beam, signs and near post in front); signs switch on with a click as it comes into view; amber flashers on x / arrows / 50 | `signs` (4 faces: '', 'blank', 'x', 'arrow-far', 'arrow-near', '50', '80', '100', 'end'; numbers work), or `closed` (array, number or '3,4') + `stage` ('warn' / 'close') + `limit`; `jam: true` = 50 |
| `ring-closure` | hazards/closure.ts | a closed lane: yellow lines (a `RingLayer` on the road), a cone taper, the arrow trailer and the crash-absorber truck (the head: `HEAD_COST` 2 cells, a stop, a bounce to the open lane), cones along it (`CONE_COST` 1, knocked flying) | `length`, `toward` ('far' / 'near'), `truck` (false: cones only), `kind` |
| `ring-speedcam` | hazards/camera.ts | a camera post: passing a wagon in the front third (screen x ≥ `FRONT_X` 256) → flash, `ring.fine(slot)`; its red LED warns while a wagon it has not passed is there | `side` ('far') or `kind` ('gantry' stands on the median) |
| `ring-avgzone` | hazards/camera.ts | the average-speed zone: start and end signs; the average screen x between them in the front third → one fine at the end; a gauge under the HUD while it runs | `length`; `part: 'end'` entries are empty |
| `ring-jam` | hazards/jam.ts | the jam controller (invisible): the plan's jam (`length`) crawls at `crawl`, stands `hold` ticks at `holdAt` (waves then), clears after `length`; without `length`: its own 50 gantry, its own queue (`cars`, from `seed`), a hold until its waves are gone or `ticks`; when the plan's stand ends it spawns `after` (the EASY floor) | `length`, `crawl`, `hold`, `holdAt`, `seed`, `ticks`, `cars`, `waves`, `after` |
| `ring-scooter` | scooter/scooter.ts | the scooter gang (`Enemy`, `body: false`, 20 hp, 200 points, tags `ring-scooter`, `ring-small`): weaves in front of the wagons, the pillion turns round and lobs a bottle into the target's lane (`RingBottle`: flies over everything, smashes where it lands, 1 cell) or fires a pistol back along the lane (½ cell); tells ≥ 18 ticks (`telegraphTicks`), only with its middle 22 px inside the view (`ATTACK_INSET`: the bottle and the muzzle start on screen), with an attack token; after its stay (`SCOOTER_AI.stay` 300 + 30 per gang index ticks in 'ride'), or when more than `crowd` = 5 are in play (riding, attacking, or entering on screen) and it is among the surplus in play longest, it speeds off ahead (`leave`, 3 px/tick on screen, no score; it dodges a car ahead as a rider does) so unshot gangs never pile up; one that enters while 5 scooters are on screen (or an earlier one waits) waits off screen at the road's pace and comes in when one has gone; in a standing jam (jam level > ½) it filters between the lanes (on the 2 \| 3 or 3 \| 4 lane split, a ±12 hurt slab so shots along both lanes beside it hit; it passes the wagons in the lanes beside it, only a wagon on its line touches it); the side ram (tags `ram` + `side-ram`) or any kill knocks both riders onto the hard shoulder (bloodless); gloat = a slow wheelie in place, cower | `look` (0–2), `gang`, `count` (an entry that spawns its group), `index`, `pillion` ('bottle' / 'pistol'), `hp`, `drop` (falls as a `ring-crate`) |

**The hostage carrier hook** (`items/carrier.ts`): `HostageCarrier` = `hostageSeat(out)`, `hostageDoor(out)`
(the door's x range on the carrier's plane y), `hostageDoorState?(0 | 1)`, `hostageOpened(slot)`,
`drawHostageDoor?(r)`, `hostageDoorFall?(out)` (the shot-off door's strip, its anchor `doorFallAnchor(box)` and
height; default the hostage van's cage door); `isCarrier(e)`. The hostage owns the door: while tied it is an enemy-team
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
`ring/car/dent`, `ring/car/van-open-<colour>`, `ring/car/cage`, `ring/car/cage-fall` (5, deferred: the door tips out of
the opening toward us and lands flat);
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


## 18. Sound (wave B, SOUND; `content/music/ring.ts`, `ring/cues.ts`, `wagon/lines.ts`)

**Songs** (`src/game/content/music/ring.ts`, imported by `content/music/index.ts`; it imports only
the engine, so there is no import cycle; GDD §12.2): `RING_SONGS` = `ring` (the stage theme: A
major, 140 bpm, a motorik pulse; intro 4 → A 16 call and response → B 16 night drive → C 8 the
lift `'C+2'` → D 8 breakdown → loop to A, 82.3 s) and `ring-boss` (the test mid-boss: F♯ minor,
152 bpm; intro 2 → A 8 → B 8 → C 8 → loop to A, 37.9 s). `RING_LIFT_SLOT` (3) is the theme's
order slot of the lift. `ringMission(plan).music` / `.bossMusic` name them; `ringSong(id)` is the
id itself since wave B (the ams fallback is gone; §9).

**Cues** (`src/game/ring/cues.ts`): `attachRingCues(runner): RingCues` (`lifts`, `detach()`), a
cosmetic listener (no entities, no rng):
- `runner.events` 'bossSlot' (spawned) → `runner.playMusic(mission.bossMusic, 30)`; world
  'bossDefeated' while the boss song plays → `playMusic(mission.music, 90, { from: 1 })` (the
  theme's A, no intro).
- A world script (`'ring-cues'`) checks each tick: the view's ambience turns to
  `TUNNEL_BED` (`'ring/tunnel-bed'`) inside a `tunnel` chunk (not the covered stretch) while the
  stage theme plays → `playMusic(mission.music, 8, { from: RING_LIFT_SLOT, restart: true })`, once
  per tunnel.
- The same script: while the ambience is `TUNNEL_BED` (a tunnel or the covered stretch) the sound
  effects echo (`runner.audio.setEcho?.(TUNNEL_ECHO)`: 0.11 s, feedback 0.3, mix 0.32; spec §7.3);
  `setEcho(null)` when the bed ends and on `detach()` (fixer B).
Attached once per runner after construction in `RingScene.enter` (the integrator, wave B) and
detached on exit; a run with or without it simulates the same ticks.

**Driver lines** (`content/ring/wagon/lines.ts`): every `DriverEvent` (the wave-A events and
`scan`, `tow`, `brake`, `caravan`, `roadworks`, `boarder`, `sticker`) has lines for `vincent`
(the consultant: billable, a plan), `thom` (the little emperor), `dirk` (the plumber), `bob` (the
climate saver who flies a lot), `patrick` (the AI nerd) and `default`; ≤ 24 characters × 2 lines;
two variants for most events (`say` picks with the fx rng); `flash` and `boss` keep one (a WAGON
test compares the bubble with variant 0). The wave-B lines name the way out (change lane, swerve,
shoot the cable, the knife). Builders call `wagon.say(event)` for the driver of the wagon they
target.

**Mix** (`sfx/ring-{wagon,road,scenery}.ts`, ids unchanged): docs/api/sfx.md §2.2 has the
before / after levels; `tests/content/ring-sound.test.ts` keeps the hum and the tunnel bed under
the shots and the telegraphs.

## 19. The crew (wave B, CREW; `content/ring/crew/`, `sfx/ring-crew.ts`)

Spec §5.5 (the road-works crew), §5 last paragraph and §7.2 (the jam boarders), §9 (their gloat).
Files: `geometry.ts` (numbers, looks, sprite ids), `art.ts` (registration; every frame cropped to
its 1× box at every density), `art-truck.ts`, `art-people.ts` (one density-generic drawer per
strip), `roadworks.ts`, `boarder.ts`, `index.ts`. Tests: `tests/content/ring-crew.test.ts`.

| id | class | what it does | params |
|---|---|---|---|
| `ring-roadworks` | `RingRoadworks` (Enemy, big, 500 HP, 1,500 points, tags `ring-roadworks`, `ring-big`) | a slow road-works truck towing the wave-A arrow trailer (the amber arrow flashes toward the open lane) in lane 4 or 3. `enter` from the right at `ROADWORKS.enterRel` (−1.6 px/tick on screen) to screen x 300, `work` 220 ticks crawling back (−0.3), `leave` (−2) off the left edge: no score, about 450 ticks on screen. Never backwards on the road (a jam stops it). Behind it a `RingConeLine` closes its lane (a cone every 22 px of road it covers), except where a `ring-closure` closes that lane already, and never the last open lane. A wagon that drives into it is held behind it (nose to tail) or sent back to its lane (alongside): ½ cell, 1 when hard (closing > 1.4 px/tick, a swerve, a lane change into it). At 0 HP: explosions, the crew bails, a crate (`drop`, else the ring roll), the wreck rolls to a stop, smokes and drifts back out of view (it still blocks). The driver of the nearest wagon says `roadworks` when it comes into view; `ring/crew-beeper` every 120 ticks on screen | `lane` (3 / 4; else the lane of a `ring-closure` in lane 3–4 within 640 px — the plan's road works: the crew works inside the closed lane —, else the spawn lane when 3–4, else 4; 3 in a tunnel), `crew` (0–3, default 3), `side` ('ahead' / 'behind'), `hp`, `drop`, `gang` |
| `ring-roadworker` | `RingRoadworker` (Enemy, soft, 20 HP, 200 points, tags `ring-roadworker`, `ring-crew`) | a worker on the deck (spawned by the truck): `tell-throw` (≥ 18 ticks: a cone off the stack and over his head; on screen with his middle 24 px inside, with an attack token) → `throw`: a `RingConeLob` into the target wagon's lane where the wagon will be → `recover`. Hurt slab ±10 (the truck's ±8: a shot that crosses into the lane at his x hits him; a shot along the lane hits the trailer first). Shot off or the truck wrecked: he tumbles onto the hard shoulder and sits up dazed (`bail()`: no score). Gloat: the coffee break (`KOFFIEPAUZE!`, one line per hold); cower | `truck`, `slot` (0–2), `look` (0–2), `hp`, `drop`; alone (`{}`) he stands on the road |
| — | `RingConeLob` (tags `ring-bottle`, `ring-cone`, type `ring-roadworks/cone`) | the lobbed cone: flies over everything, `landX` / `landY` / `ticksLeft` like the scooter's bottle (the bot and the sim watch read them); lands: 1 cell (`thrown`) to a wagon in that slab, bounces off; else it lies on the road (harmless) | `ConeLobOpts { lift, ty, vx, ticks, arc }` |
| — | `RingConeLine` (team neutral, tags `ring-closure`, `hazard`, `ring-cones`, type `ring-roadworks/cones`) | the cones behind the truck at the lane's edge toward the open lane (`coneY` = lane y − 6). `x` = the newest (front) cone, the box reaches back to the first (`x + hitbox.x` … `+ hitbox.w`, as a closure): civilian cars merge out, scooters avoid it. A wagon that reaches a standing cone knocks it flying, 1 cell (its hit invulnerability spaces them out). Up to `ROADWORKS.lineMax` (40) cones a line | `owner`, `lane`, `side`; `add(x)`, `stop()`, `count`, `xs`, `up`, `full` |
| `ring-boarder` | `RingBoarder` (Enemy, soft, 20 HP, 300 points, tags `ring-boarder`, `ring-small`) | only in a STANDING jam (`jamOf(world).level > ½`): ams handhavers (3 skins) and stag partiers (4 looks) on foot. `run` along the lane split beside the target wagon's lane (the near split; lane 4: the far one) to its bonnet; `tell-hop` (≥ 18 ticks, crouched, token) → `hop` (16 ticks) to where the bonnet was at the release: a lane change or a quick move makes him miss (he lands on the road and runs again); on the bonnet (`perch`, kneeling, facing the windscreen; `BONNET` x 33, lift 17) `tell-hit` (≥ 18 ticks, the fist / the bottle up) → `hit`: ½ cell (Damage tag `bump-light` + `melee`) → `recover`. One boarder per bonnet: the next waits in front of the nose. Off: the knife (the bonnet is in `RingHero`'s knife box: FIRE), a shot, a blast, or a swerve (a side-ram kill). The jam clears: on foot he runs for the hard shoulder and is left behind; on a bonnet he jumps off first (no score). A wrecked wagon throws him off (on foot). Gloat: the handhaver walks up, writes (`VLUCHTSTROOK?` / `BOETE!`), tears the page off and lets it flutter onto the spot; the partier takes a selfie with his back to it (`JAM SELFIE!` / `#A10`, a flash): the ams strips `enemy/<set>/gloat`; the cower: `enemy/<set>/cower`. Bloodless: he tumbles onto the hard shoulder and sits up dazed | `look` ('handhaver' / 'stag' / a set 0–6 of `BOARDER_SETS`; default by its id), `index` (the skin / look within the kind, and +23 ticks of first delay each), `hp`, `drop`, `wait` (ticks it may wait hidden for a standing jam, then walks in from the nearer edge; default 0: outside a standing jam it leaves at once) |

**From the jam** (hazards/jam.ts `waves`, the integrator): a wave entry
`{ id: 'ring-boarder', from: 'ahead' | 'behind', dx, lane, params: { look: 'handhaver' | 'stag', index } }`
— the jam spawns its waves during the stand, so the boarders are always in a standing jam.

**Tuning** (`ROADWORKS`, `BOARDER`; NORMAL): truck 500 HP, crew 20 HP, cone tell 26 (×difficulty,
never < 18), a cone every 170 ± 40 per worker, lob 36 ticks, arc 34; boarder 20 HP (one knife stab:
30), run 1.3 px/tick, hop tell 26, swing tell 24, a swing every 70 ± 20.

**Sprites** (1×, 2×, 4×; outline A): `ring/roadworks/truck` (5: beacons / hub phase ×2, battered ×2,
the wreck), `ring/roadworks/side` (3: the near drop side, drawn after the crew by a `RingLayer`),
`ring/roadworks/worker/<0|1|2>/{idle, tell, throw, gloat*, cower*, tumble, sit}`,
`ring/boarder/<set>/{idle, run, crouch, hop, perch, tell-hit, hit, tumble, sit}` (* deferred). The
trailer, its board and every cone are the wave-A hazard sprites (`ring/hazard/arrow-trailer`,
`arrow-board`, `cone`). 4× bytes (from the 1× frames): road works 3.9 MB, boarders 9.3 MB.
Art families: `ring-roadworks` → `ring/roadworks/`, `ring-boarder` → `ring/boarder/`, and
`ring-jam` → the hazards plus `ring/boarder/` (`defineRingArt` in `crew/index.ts`: the boarders come
from a jam's `waves`, not from plan spawns).

**Sounds** (`RING_CREW`): telegraphs `ring/crew-cone-lift`, `ring/crew-hop-tell`,
`ring/crew-swing-tell`; cues `ring/crew-beeper`, `ring/crew-cone-throw`, `ring/crew-cone-hit`,
`ring/crew-hop`, `ring/crew-boot`, `ring/crew-knocked`, `ring/crew-wreck`; the gloat reuses the ams
`ams/gloat-scribble`, `ams/gloat-tear`, `ams/ticket`. Driver lines: `roadworks` (the truck in view),
`boarder` (a boarder lands on that wagon's bonnet).

## 20. The enforcement convoy (wave B, CONVOY; `content/ring/convoy/`, `sfx/ring-convoy.ts`)

The city follows the squad out of ams (spec §5.3, §9). Files: `geometry.ts` (every number and sprite
id: `SCAN_AI`, `TOW_AI`, `MOTO_AI`, `STICKER`, `SCAN_BOX`, `TOW`, `MOTO`), `kit.ts` (`ConvoyEnemy`),
`scan-car.ts`, `tow-truck.ts`, `moto.ts`, `art-car.ts` + `art-moto.ts` (the drawers), `art.ts` (the
registration, `CONVOY_ART_IDS`), `index.ts` (imports all, `defineRingArt` for the three ids).

**`ConvoyEnemy extends Enemy`** (the scooter's pattern): `body: false`, it moves in the plane itself
(world `vx` = road speed + its screen speed; in a plain world it stands still), hurt only through its
depth slab, no contact boxes. Public: `mode` (the sim's watch reads `tell-<x>` → `<x>`), `modeT`,
`holdsToken`, `laneTarget`, `inPlay`, `sx`, `lane`. Attacks start only with the whole body on screen
(`wholeOnScreen`), an attack token and `telegraphTicks(base)` (≥ 18). Every one leaves after its
`stay` (speeds off ahead) so an unshot convoy never piles up. Big vehicles are tagged `ring-block`
(civilians keep a gap behind them; scooters do not change lanes into them) and push a wagon that
drives into them back out like a civilian car does: free when slow, ½ cell (`bump-light`) when it
rear-ends one faster than 1.4 px/tick or swerves into it. Each one is tagged with its own id.
Reactions: the continue's gloat (no pointing, no laughing) and the cower (a `!`, see below).
Drops: the scan car and the tow truck always drop a `ring-crate` (the `drop` param, else the ring
roll); the moto only with a `drop` param.

| id | params | what it does |
|---|---|---|
| `ring-scan-car` | `hp`, `drop` | the ams scan car (likeness, the ams drawers) with a SMALLER roof box. Rides in the lane next to its target wagon (the far side first), `SCAN_AI.ahead` (64–112) px ahead. **SCAN LOCK**: `tell-scan` (34 ticks NORMAL: the box glows and beeps, the strip's outline blinks on the target's lane, the scan line and a red beam sweep it from the car's front back to the view's left edge) → `scan`: the strip (`ScanStrip`) locks; a wagon inside it (that lane, settled within 5 px, over the strip) drifts back `SCAN_AI.drag` (0.75) px/tick down to the wagon band's left end and cannot push forward (`sideV` ≤ 0.15); its driver says `scan`, the HUD shows `SCAN LOCK!`. No wagon in it for `grace` (18) ticks (a lane change, a swerve) → it fades; else after `lockTicks` (210) or when the car is beaten. 300 HP (big), 1,000 points. Beaten it BREAKS DOWN: the airbag (cabin frame, `AIRBAG!`, `ams/airbag`), the roof box knocked askew (box frames 3, 4: the front foot torn, then slumped onto the windscreen with a loose cable), hazard lights, smoke, it veers onto the hard shoulder and falls back out of view (no contact). Gloat: it scans the spot (`KENTEKEN GESCAND.`); cower: the handhaver ducks (cabin `shock`), the car shakes, the hazards blink fast. |
| `ring-tow-truck` | `hp`, `drop` | the ams tow truck. Comes from behind beside the target, overtakes, `signal` (24 ticks: the indicator) and merges into the wagon's lane just ahead of it. **HOOK**: `tell-hook` (30: the hook swings out wider and wider on its cable, the beacon flashes) → `hook` (the cast, 8 ticks) → a wagon still in the lane with its nose within `reach` (46) px of the boom tip is hooked → `tow`: the truck brakes (`drag` −0.7 px/tick on screen) and the wagon follows at the cable (no lane change, no pulling away); pinned at the band's left end the winch hauls 1 cell every `haul` (60) ticks (tag `tow`, the truck on screen); the driver says `tow`, the HUD `TOWED!`. FREE: a swerve (any `swerveT`), the CABLE shot (`TowCable`: an enemy-team `shootable` slab in the lane from the wagon's nose to the bed while a wagon hangs on it, `cableHp` 30, player hits only, a blast snaps it; forward shots hit it before the truck), the truck lets go after `maxTow` (360), a lane closing ahead. 400 HP (big), 1,000 points. Beaten: a small blast, smoke, it veers onto the shoulder. Gloat: it brings its boom over the spot and lowers the hook onto the wreck (`WEGSLEPEN!`); cower: it shakes, the beacon flashes fast, the driver ducks below the sill (`ring/tow-truck/cower`: hands over his head, a tremble, a peek). |
| `ring-handhaver-moto` | `attack` ('baton' \| 'sticker', default baton), `hp`, `drop` | a handhaver (the ams look) on a white city motorbike. From behind (it holds back while still in the wagon's lane right behind it), to the hero's WINDOW (`x` = wagon x + `WINDOW_DX`) in the lane next to the wagon: slot 0 the near side (the camera side), slot 1 the far side, slots ≥ 2 hang back 64 px (`crowd` 3). **BATON**: `tell-baton` (26) → `baton`: still beside the window and not swerving → ½ cell (`impact`, tags `melee` + `bump-light`). **STICKER**: `tell-sticker` (30) → `sticker`: a `ring-fine-sticker` on the wagon's glass (a second slap refreshes it); the driver says `sticker`. Then it drops back (`peel`, 36 ticks) and comes again. 30 HP (`soft`: the knife at the window reaches it), 300 points, tags `ring-small` (the wagon's side ram knocks the rider off: he tumbles onto the hard shoulder and sits dazed, the bike slides over; bloodless). A wagon that touches it without a swerve makes it wobble away. Gloat: it rolls up beside the spot in the near lane and writes a fine (`PARKEREN OP DE` / `VLUCHTSTROOK? BOETE!`, `ams/gloat-scribble`); cower: the `cower` strip. |
| `ring-fine-sticker` | `wagon` (else the nearest driven wagon) | the fine card on the wagon's rear quarter glass (behind the hero; it flaps at every shot). It gives the hero the status `ring-fine-sticker` (`STICKER_DEF`: the HUD icon `ring/handhaver-moto/fine-icon` with the timer bar; `STICKER.ticks` 720): its status hook sets `RingHero.backAimBlock` every tick, so **the back aims (←, ↖, ↙) are blocked** (spec §5.3: the card covers the rear quarter glass; the hero cannot turn to aim back, a back aim he had turns to its forward mirror; forward, straight-across and fire still work). A swerve shakes it off (it flutters away behind the wagon, `ring/sticker-peel`); it falls off when the status runs out; a wreck takes it along. `RingSticker.on(world, wagon)`, `refresh()`, `end(fly)`. |

**For the bot** (the integrator): the strips are tagged `ring-scan-strip` (`ScanStrip`: `lane`, `state`
'tell' | 'lock' | 'fade', `x0` / `x1` (world x now), `ticksToLock`, `holds(wagon)`): leave that lane
during the tell, or change lanes when locked. The tow truck: `RingTowTruck.hooked` (the wagon on the
hook), `mode` 'signal' (it is about to merge in ahead), 'tell-hook' (swerve or change lanes now);
when hooked: swerve, or aim forward and fire (the cable). A moto in 'tell-baton' / 'tell-sticker'
beside the window: swerve away, or the knife (FIRE at close range). The sticker: tag `ring-sticker`
(`RingSticker.wagon`); a swerve removes it. Big convoy vehicles carry `ring-block` like the cars.

**Sprites** (1×, 2×, 4×): `ring/scan-car/{body-0,body-1,body-2, cabin (5), wheel (4), text (2:
PARKEERCONTROLE, Gemeente Amsterdam), blink}` — the ams scan car's own drawers at ring ids (the 1×
frames are copies of the ams 1× frames; the 2× / 4× come from `bodyHd`, `cabinHd`, …), so the tier-4
set holds them outside the ams boss section; `ring/scan-car/box` (5: idle, scanning, the lens
flares, askew, slumped) — the new smaller box (16 px instead of 29). `ring/tow-truck/{body (2: clean, damaged),
hook, wheel (4), blink}` — the ams truck's drawers; `ring/tow-truck/cower` (6, deferred: duck, tremble, peek ×
clean, damaged body; an overlay over the cab window, art-car.ts `towCower`). `ring/handhaver-moto/{ride (4), tell-baton (3),
baton (2), tell-sticker (3), sticker (2), wobble (2), gloat (5, deferred), cower (2, deferred), down
(3), rider-tumble (4), rider-sit (2), fine (2), fine-icon}` — one density-generic drawer
(`art-moto.ts`: the bike on an `HdCanvas`, the officer from the humanoid rig with the ams handhaver
style; outline A; our own `BOETE` lettering at 2× / 4×). The convoy vehicles always face right:
their lettering never needs a mirror frame. At 4× (from the 1× frames): scan car 0.87 MB, tow truck
0.83 MB, motorbike 2.78 MB (+ 0.98 MB deferred: the gloat and the cower).

**Sounds** (`RING_CONVOY`): telegraphs `ring/scan-beep` (repeated every 10 ticks of the sweep),
`ring/hook-swing`, `ring/baton-draw`, `ring/sticker-peel`; cues `ring/scan-lock`, `ring/indicator`,
`ring/hook-clank`, `ring/winch`, `ring/cable-snap`, `ring/moto-whine`, `ring/baton-swing`,
`ring/sticker-slap`. Reused: `ams/airbag`, `ams/gloat-scribble`, `ring/scooter-crash` /
`ring/scooter-down`. Driver lines: `scan` (a wagon locked), `tow` (hooked), `sticker` (stuck).

**Tests:** `tests/content/ring-convoy.test.ts`.

## 21. The gangs (wave B, GANGS; `content/ring/gangs/`, `sfx/ring-gangs.ts`)

Spec §5.2 (parcel vans), §5.4 (the caravan car), §8 (hostages in vans and caravans), §9 (their
gloat). Files: `geometry.ts` (the numbers the art and the entities share: `VAN`, `CARAVAN`,
`PARCEL`, `CARD`, `TOW_CARS`, `GANG_IDS`), `art.ts` (registration, the parcel and the card),
`art-kit.ts` (the painted-volume technique of the civilian cars for our own vehicles; our 3 × 5
sign face drawn as round strokes at 2× / 4×: `letterAt`), `art-van.ts`, `art-caravan.ts`,
`art-people.ts` (one density-generic drawer per strip; people from the humanoid rig, cropped to the
box they show through), `kit.ts` (lanes, the wagon contact, tumbles, drops), `van.ts`, `parcel.ts`,
`courier.ts`, `caravan.ts`, `index.ts`. Tests: `tests/content/ring-gangs.test.ts`.

| id | class | what it does | params |
|---|---|---|---|
| `ring-parcel-van` | `RingParcelVan` (Enemy, big, 300 HP, 1,500 points, not soft, tags `ring-parcel-van`, `ring-block`; a `HostageCarrier`) | a high-roof delivery van in our own `ZOEF!` / `PAKKETTEN` livery ahead of the wagons (its middle 126–176 px ahead of the nearest wagon, screen x 196–326). `enter` (from ahead −1.5 px/tick on screen, from behind into a lane no wagon drives in) → `ride`. The rear doors open first (`open`, 21 ticks on screen: the near door swings out, the hold shows its crew and a stack of parcels), then: crew `thrower` `tell-throw` (≥ 18, he lifts a parcel overhead) → `throw` (a `ring-parcel` into the target's lane, landing 24–70 px ahead of its nose); crew `gunner` only in the target's lane `tell-shoot` (≥ 18) → `shoot` (3 bullets back along the lane, 7 ticks apart, ½ cell each). `brakeCheck`: with a wagon in line behind it (gap ≤ 150 px, nothing between) `tell-brake` (24 ticks: the brake lights glow, the wagon's driver says `brake`) → `brake` (34 ticks at −2.8 px/tick on screen): a wagon still in line is rammed (`Wagon.bump` cost 2, `ram`), a swerve or a lane change dodges; cooldown 240. Attacks only with the van fully in view (the hold ≥ 12 px inside) and an attack token; a tell that leaves the view is dropped. Lanes: the gunner and a brake checker seek the target's lane, the thrower a lane beside it; only into free road. A wagon driving into its rear is pushed out behind (½ / 1 cell by the closing speed, slow contact free); from the side it bounces back (½). After 900 ticks in `ride` it leaves ahead (no score). Beaten: score, a crate (`drop`, else the ring roll), crew and driver tumble onto the hard shoulder (bloodless), a tied hostage is freed for the killer, the van limps onto the shoulder smoking and falls back off screen (no hurt box). Hostage (`hostage: true`): the rear door stands open, the tied hostage sits in the hold behind a barred grille (no crew), lanes 3–4; the van's hurt slab leaves the grille's slab to the hostage; 720 ticks in play, 150 after the rescue | `crew` ('thrower' default \| 'gunner' \| 'none'), `brakeCheck`, `hostage`, `item`, `side`, `gang`, `hp`, `drop` |
| `ring-parcel` | `RingParcel` (RingEntity, team enemy, 10 HP, 50 points, tags `ring-parcel`, `shootable`, `ring-obstacle`) | the thrown parcel: `fly` (over everything while lifted > 7 px; shadow on the road) → lands with a thud (on a wagon: 1 cell `thrown`, it bursts) → `tumble` back along the lane as its speed dies → `lie` (world vx 0: it drifts back at the road speed). A wagon that touches it: 1 cell (`thrown`), it bursts; a civilian car rolls it over (bursts, no harm). Shot: it breaks (cardboard and paper), one in four drops a `ring-crate` (the ring roll). `{}` = a parcel lying on the road. For the bot: `landX`, `landY`, `ticksLeft`, `lying`, `state` | `lift`, `ty`, `vx`, `ticks`, `arc` |
| `ring-caravan` | `RingCaravan` (Enemy, big, 260 HP, 1,500 points, not soft, tags `ring-caravan`, `ring-block`; a `HostageCarrier`) | a 1970s caravan (`TOERTJE`) towed by a civilian `hatch` / `estate` body (from `gang`), in lanes 3–4 (it moves there from a far spawn lane); the caravan's middle 116–156 px ahead of the nearest wagon (screen x 140–236), the rig 152–162 px long (`frontX`). Gunner in the roof hatch (`gunner`): with the target behind it `tell-shoot` (≥ 18) → `shoot` (2 bullets aimed at the target within ±24° of straight back, ½ cell). Loose: at half its hp or after `looseAfter` ticks in play, with the rig in view, `tell-loose` (30 ticks: the drawbar strains, sparks, a groan; the nearest wagon's driver says `caravan`) → `loose` (the hitch snaps, the tow car `RingTowCar` flees ahead and is gone; the caravan drops back at up to −1.1 px/tick and swerves one lane toward the median and back in 72 ticks) → `tip` (24 ticks, tipping away from us onto its far side: the livery stays in view, the underside with the axle and both wheels turns toward us, a dust puff as it lands; it drifts down toward the shoulder; the gunner tumbles off, a tied hostage is freed for the nearest wagon) → `slide` onto the hard shoulder (sparks off the chassis and the drawbar head, a dust trail) → `wreck` (lying on the shoulder, no hurt box, gone off the left edge). Contact: loose or tipping it rams (2 cells), sliding it only shoves; it never covers more than two lanes. Beaten: score, a crate, the gunner tumbles off, the car flees, it tips at once. Hostage (`hostage: true`): the door folded back, a barred grille over the doorway, the tied hostage inside, no gunner. 900 ticks in `ride`, then the rig leaves ahead | `gunner` (default true; false with `hostage`), `looseAfter` (0 = only after damage), `hostage`, `item`, `side`, `gang`, `hp`, `drop` |

**The hostage carriers** follow §16 (`items/carrier.ts`): `hostageSeat` (the van's hold floor at x −33,
lift 7.4; the caravan's doorway at x 8.2, lift 9.4), `hostageDoor` (the grille: van −45.5 … −20.5,
caravan 1 … 15.4), `hostageDoorState` (the grille dents), `hostageOpened`, `drawHostageDoor` (the
grille). When the grille is shot open its door falls as a door: it starts upright in the opening and tips
over toward us onto the road, clangs and scrapes to a stop (`hostageDoorFall` → `ring/parcel-van/grille-fall`,
`ring/caravan/grille-fall`; the hostage van: `ring/car/cage-fall`; traffic/art.ts `doorFallFrame`).

**The gloat and the cower** (spec §9; no pointing, no laughing): the van holds its place, its crew
scans parcels (`crew/gloat`) and once per hold its courier (`RingCourier`, drawn only) steps out of
the cab, walks to the wreck (a `ring-wagon` in state `wreck` near the spot), else to the near crash
barrier's rail at the spot (the wreck is removed after its spin-out, the hero who is out is not
drawn), sticks a `NIET THUIS` card (`RingCard`) on it with a slap, pats it and waits; when the hold
ends (or the van cowers) he ducks, then hurries back into his cab (or off along the shoulder) and the
card drops off. The caravan's gunner pours a coffee from his thermos and sips (`gunner/gloat`).
Cower: the crew ducks in the hold, the gunner into the hatch, the van rocks. A loose or crashing
caravan does not react. During a reaction both hold their screen place, backing off from traffic
that drifts into them.

**Tuning** (`VAN_AI`, `CARAVAN_AI`, `PARCEL_AI`; NORMAL): tells 26 (×difficulty, never < 18), the
brake tell 24, the hitch tell 30; an attack every 150 ± 30 (van) / 140 ± 30 (caravan); parcel flight
30 ticks, arc 22; bullets 3.2 px/tick. Measured with the bot on a wave-B plan (seeds 1–2, NORMAL),
alive on screen: parcel van p50 about 1,100 ticks, hostage van 370–540, caravan 400–620, hostage
caravan 300–500 (for `ENEMY_PRESENCE`).

**Sprites** (1×, 2×, 4×; outline A; * deferred): `ring/parcel-van/{body (2: the van, beaten), rear (3:
the door swinging out, the hold opening), brake (2: the lit lamps, their glow drawn additive),
grille (2), grille-fall* (5)}`, `ring/parcel-van/crew/{idle, tell-throw, throw, tell-shoot, shoot, gloat*, cower*,
tumble*, sit*}` (the crew strips are anchored at the van anchor, cropped to the hold), `ring/parcel-
van/driver/{tumble*, sit*}`, `ring/parcel-van/courier/{walk*, stick*, cower*}`, `ring/parcel-van/
parcel` (5: four tumble angles, lying), `ring/parcel-van/card*`; `ring/caravan/{body (4: hatch shut /
open × clean / battered), open, grille (2), grille-fall* (5), drawbar (3: hitched, strained, dropped), tip* (4: tipping away from
us 18° / 42° / 66°, lying on its far side 84°: the livery on top, the underside with both wheels)}`,
`ring/caravan/gunner/{ride, tell, shoot, gloat*, cower*, tumble*, sit*}` (anchored at the caravan
anchor, cropped at the roof line). Reused unchanged: `ring/car/<hatch|estate>-<colour>` and
`ring/car/wheel-s` (the tow car), `ring/car/wheel-m` (the van and the caravan), `ring/car/dent` (the
damage decals). Art families: the defaults of `art-def.ts` (`ring/parcel-van/`, `ring/caravan/`).

**Sounds** (`RING_GANGS`): telegraphs `ring/parcel-lift`, `ring/brake-tell`, `ring/hitch-creak`
(the gunners reuse `ring/pistol-cock`); cues `ring/van-door`, `ring/parcel-thud`, `ring/parcel-tear`,
`ring/brake-squeal`, `ring/van-limp`, `ring/hitch-snap`, `ring/caravan-scrape`, `ring/caravan-tip`,
`ring/card-slap`; the throw reuses `ring/throw`, the shots `enemy/shot`. Driver lines: `brake` (the
wagon that is brake-checked, at the tell), `caravan` (the nearest wagon, at the hitch's tell).

## 22. The test mid-boss (wave B, BOSS; `content/ring/boss/`, `sfx/ring-boss.ts`)

A temporary boss that proves the boss hook on a moving road (spec §6); the real bosses replace it.
Files: `geometry.ts` (ids, sprite ids `SPR`, `LORRY`, `PART_X`, `FORK`, `CARGO`), `lorry.ts`
(`RingLorry`, `RingLorryBox`, `LORRY_AI`), `adds.ts` (`RingCargo`, `RingForklift`, `CARGO_AI`,
`FORKLIFT_AI`), `art-kit.ts` (`Pen`: an `HdCanvas` in local coordinates, `defStrip`: 1× + one
`hd` drawer, cropped to the 1× box), `art-lorry.ts`, `art-adds.ts`, `art.ts` (registration).

| id | class | what | params |
|---|---|---|---|
| `ring-lorry` | `RingLorry extends Boss` | the container lorry `ZWARE JONGEN` (white cab with an orange band, a rust-red `ZWAAN` container with a made-up box code, a made-up plate `ZW-99`; no badge), ~184 px, lanes 1–2 only; tags `ring-lorry`, `ring-block` (cars follow behind it, scooters and the forklift keep out of its lane) | `hp` (base pool HP), `hpScale` (tests), `lane` (1 \| 2) |
| `ring-forklift` | `RingForklift extends Enemy` (`body: false`, `big`) | its add: out of the hold down the ramp, charges back along a wagon's lane | `lorry` (the owner), `hp`, `drop` |
| `ring-barrel` | `RingCargo extends RingEntity` | its cargo: a drum (`kind: 'barrel'`) or a crate thrown into a lane, rolling back along it | `kind`, `ty`, `ticks`, `lift`, `vx`, `arc`, `rel`, `drop` |

**The slot.** The westpoort boss slot (`ring-lorry`, lane 1) spawns it at `cam.right + 64`; the
runner locks the plan under its slot key until the lorry is no longer alive. The intro (invulnerable,
the HUD bar shows) drives it in at −2.2 px/tick on screen to its home (`LORRY_AI.homeX` 236, a
±14 px drift); on arrival the air horns and `ringOf(world).lockPlan('ring-lorry')`; it keeps pace
with the camera (world vx = road speed + a small screen speed). Its own lock ends when it dies
(`onDeathStart`), so the plan rolls on during the jackknife (the 4-second rule) — the runner's ends
at the same tick. The drivers' `boss` line comes from the runner's `bossSlot` event
(`wireDriverTalk`), once, when it spawns; the lorry does not call `say('boss')` again. Nothing in
the lorry ends the mission ('bossDefeated' only).

**HP (pool model).** The bar is the lorry's HP (`LORRY_AI.hp.pool` 2000 × difficulty × co-op).
Parts in index order (slabs ±`DEPTH_HALF` over an x range, `PART_X`): 0 `cab` (x 44…92, × 1.5,
own HP = the pool's, passed on; when it breaks the lorry dies; **the bot aims at part 0**), 1 `doors`
(x −92…−74, −118…−74 while open; 360, passed on), 2 `wheels` (the bogie, x −74…−36; 280, passed on),
3 `box` (the container x −92…44, × 0.5: it takes what reaches it behind the broken doors and over
the broken bogie). Each broken part: +1000 (Boss rule), an explosion at its visual spot
(`partSpot(i)`; the slabs lie on the road). `cabState` = the worse of the cab's own state and the
lorry's `damageState` (the cab art). The container never flashes white (only the cab, doors, wheels).

**Damage rate and the phase-1 floor** (fixer B, 2026-10-21: the shotgun killed it in 9–12 s and
phase 2 hardly showed). The pool loses at most `LORRY_AI.rate.perTick` (2) HP per tick from a bucket
of `rate.burst` (150; both × difficulty × co-op): a hit that wants more takes what the bucket holds
(the part's own HP too). Until the side panel is down (`panelDown`) the pool holds at the phase-2
line (`floor(maxHp × 0.55)`). The pistol (1.9 HP per tick at the cab with every shot on it) never
feels the rate; the shotgun, the machine gun and the laser do. Param `rate` (HP per tick of the base
pool; 0 = no limit: tests that break parts in one hit).

**Phase 1 `cargo`** — `cargoDump()`: needs a target and the door on screen. Tell
`telegraphFor(32)` (`mode` 'tell-cargo'): the rear door bangs open, the brake lights, the loader
hoists a drum (`loader` 'lift'); it is dropped (`endAttackLook`) if the door leaves the view. Then
`volleySize(2)` pieces, 10 ticks apart (`mode` 'cargo', every 3rd a crate; a crate holds an item 35 %
of the time), into `pickCargoLanes(n)`: only lanes with no cargo on screen, at most open − 1 of
them (**a free lane always stays**), the target's lane first. A piece flies 26 ticks from the door
(lift 26) and lands 44 px behind it, then rolls back at −1.7…−2.4 px/tick. The door shuts 30 ticks
later; the next dump `recoveryFor(150)` later.

**Phase 2 `forklift`** (HP ≤ 55 % or the doors broken; `resume` = the same pattern): `dropPanel()`
(40 ticks: the bay x −18…38 of the near wall tips down into a ramp onto the road, `ring/lorry-slam`,
sparks; the ramp drags and sparks from then on), then a loop: `releaseForklift()` (when the panel
is down, no forklift lives, `forkCool` (240 after one is wrecked) is over and `!holdAdds`),
`weave()` (`mode` 'tell-weave': the indicator blinks `telegraphFor(36)` with the cab on screen and the
target lane free of cars, closures and the forklift, a short horn near its end; then 'weave': a
44-tick S into lane 1 ↔ 2; never with the wheels broken), and a cargo dump while the doors live.

**Touch.** A driven wagon in its slab is pushed out: from behind it stays behind the tailgate
(½ cell), from the side it goes to the lane away from the lorry (½ cell; 1 cell while it weaves);
one bump per wagon per 24 ticks. Bullets of the hero hit the parts as above.

**Stagger (the continue).** `canStagger()` is false while it changes lanes or the panel drops
(they finish first); `cutAttack()` = `endAttackLook()` (mode 'cruise', indicator and brake lights off,
the loader stands, the door shuts) → true: the running pattern is cancelled and the phase's
`resume` runs when the stagger ends. `onStagger` shows `!` over the cab. While every player is out
it has no target, so no attack starts; the forklift (an Enemy) gloats.

**Death** (10,000): the forklift drives off ahead (`setLeave()`, no score), the loader jumps; the
script: 44 ticks of locked brakes (`ring/lorry-screech`), the cab turns toward the camera
(`cab-yaw` 0…3) and slides 14 px nearer, blasts; then `RingLorryBox` (the container) slides off
onto the hard shoulder, tips onto its side (`box-tip`), lands with a slam and drops a `ring-crate`
(`repair` when a driven wagon has ≤ 6 cells, else `H`, `R` or `L`; `lorry.dropped`); 70 more ticks
of the slowing wreck, then 'bossDefeated'. The wreck stays (`removeOnDeath` false), slows to a stop
on the road and is removed off the left edge.

**Members for tests and tools:** `lane`, `weaving`, `arrived`, `mode`, `trace` (`{ attack: 'cargo' |
'weave', tell, fire, seen, lanes? }`: `fire − tell` and `seen` are the tell ticks, `seen` on screen),
`thrown`, `doorOpen` / `doorTarget` / `doorsGone`, `panelT` / `panelDown`, `blinkT`, `brakeT`,
`loader`, `wheelsBroken`, `forklift`, `boxGone`, `dropped`, `screenX`, `target()`,
`cargoLanes()`, `pickCargoLanes(n)`, `laneFree(lane)`, `partSpot(i)`, `cabState`.

**RingForklift** (`FORKLIFT_AI`: hp 160 × difficulty × co-op, 500 points): modes `out` (down the
ramp from the hold, 44 ticks, into the lane next to the lorry) → `seek` (to a spot 150 px ahead of
the nearest wagon on screen, x 200…336, into that wagon's lane when it is free) → `tell-charge`
(`telegraphTicks(30)`, an attack token, its middle 26 px inside the view; the forks rise, the
beacon flashes, `ring/forklift-beep`) → `charge` (−3.4 px/tick on screen, forks first; a wagon it
reaches: `bump({ cost: 2 })` = a ram, and it brakes; a car ahead or x ≤ 26: it brakes) → `brake`
(18 ticks) → `return` (back up to its spot) → `seek` … `leave` when its lorry is gone. A wagon that
drives into it outside a charge is pushed (no cost). Gloat: forks down, a frikandel (no pointing,
no laughing); cower. Death: the driver tumbles onto the hard shoulder (`forklift/driver-tumble` →
`driver-sit`), the machine tips onto its forks (`forklift/down`). `holdsToken`, `laneTarget`,
`home`, `screenX`.

**RingCargo** (`CARGO_AI`: 20 / 12 HP, 100 points): `flying` (no hurt box, hurts nothing),
`landX` / `landY` / `ticksLeft` (as `RingBottle`, for the bot), `rolled`, `burst(owner)`. On the
road: a driven wagon whose slab it reaches (not while swerving) → `bump({ dx: −0.8, cost: 1 })`
and it bursts; a civilian car in its slab → it bursts; off the left edge → removed. Tags
`ring-barrel`, `ring-cargo`, `shootable` (enemy team).

**Sprites** (all under `boss/ring-lorry/`, 1× + 2× / 4× from one drawer; 32 ids, 87 frames; 4×:
10.6 MB, 6.9 MB without the deferred ones): `cab-<0|1|2>`, `cab-yaw` (4, deferred), `trailer`,
`container-<0|1|2>`, `hold` (3: by damage state; the bay open), `panel` (4), `doors` (4: shut,
ajar, open, hanging), `door-fall` (4, deferred), `rim` (4), `blink` (2), `brake`, `box-tip` (3,
deferred), `barrel` (8), `crate` (4), `loader/<stand|lift|throw|tumble|sit>`,
`forklift/<drive|tell|charge|gloat*|cower*|down|beacon|driver-tumble|driver-sit>` (* deferred).
The tractor and intact bogie wheels reuse `ring/car/wheel-l`. Draw order in `RingLorry.draw`:
trailer → container / hold → door → loader (flipped: he faces back) → cab (or `cab-yaw`) → wheels
(or `rim`) → the dropped panel (in front of the wheels) → indicator, brake lights.

**Sounds** (`RING_BOSS`): telegraphs `ring/lorry-door` + `ring/lorry-brake` (the cargo dump),
`ring/lorry-blink` (the weave), `ring/forklift-beep` (the charge); cues `ring/lorry-horn` (the air
horns), `ring/lorry-roll` (a drum lands), `ring/lorry-thud` (a crate / the forklift lands),
`ring/lorry-barrel`, `ring/lorry-crate` (they break), `ring/lorry-panel` (the bay lets go),
`ring/lorry-slam` (the panel / the container hits the road), `ring/lorry-scrape` (the rims),
`ring/lorry-screech` (the jackknife), `ring/forklift-whine`. Reused: `ring/throw`, `ring/dent`,
`ring/crash`, `ring/wagon-screech`, `boss/part-break`.

**Measured** (2026-10-21, the ring bot, `?section=westpoort`, the bot has the pistol there): time
to kill on NORMAL seeds 1–5: 62–79 s (phase 2 after 27–38 s; the bot hits the container ~90 %),
HARD 77 s, EASY 50 s, 2P 55 s; 1–2 wrecks in the fight. Whole rings (wave-A plans + the lorry):
god seeds 1–3 36,589 / 37,204 / 37,460 ticks, normal 37,257 / 38,367 / 37,197, 2P normal seed 1
35,538; longest gap 217–248, no off-screen shot or hit, shortest tell 26, ≥ 2 lanes open.
`tests/content/ring-boss.test.ts`.

## 23. Integration of wave B (INTEGRATOR, 2026-10-21)

Report: `tmp/ring-b-integrate-report.md`; the spec's tuning table: `docs/design/ring.md` §14.

- **On:** `RING_CONTENT_WAVE = 'B'` (director.ts). The chunk types `parcel`, `caravan`, `convoy`
  start with their fixed templates (`parcel-van`, `caravan` in lane 3 or 4, `convoy`), a
  `roadworks` chunk with `roadworks-crew` (the truck works inside the plan's closure),
  `moto-pair` joins the bank's templates from tier 1. The jam controller's `waves`: the scooter
  gang, then the boarders (`ring-boarder` `{ look, index }`: rows `'' '' N H`, from ahead / behind
  as the CREW table; the looks may swap). The `westpoort` slot spawns `ring-lorry`; the `exit`
  slot stays a marker.
- **The 4-second floor** (§15.3): `ENEMY_PRESENCE` from the wave-B bot (moto 90, van 240,
  caravan 200, scan car 240, tow truck 200, road works 450, boarder 120, lorry 600; hostage
  carriers `presenceOf(spawn)` count the same); `gapPlace` 90, `gapJam` 100; the estimate starts
  afresh after a rest or a scene; hostage carriers count; in a jam and in the chunk after it only
  the scooter gangs (they filter between the queued cars). A boss slot that locks the plan (not the
  `exit` marker) gets a forced wave at its first 32-px step after `at + 32`: it rolls in right after
  the fight (fixer B: a 260-tick gap after the lorry in 2P). The plan's target is 8:45
  (`RING_PLAN.target` 31,500 ± 2 %; the invariant stays 9:00 ± 5 %): the lorry's fight comes on top.
- **Off-screen entrants give up** (fixer B; `ENTER_GIVE_UP` 300 in traffic/road-kit.ts): a parcel
  van, caravan, scan car, tow truck or moto still in `enter` after 300 ticks while fully off screen
  is removed (no score; traffic had boxed it in), and a leaving one is removed past either edge. A
  van entering from off screen ignores a tailgater (the follower brakes for it).
- **Measured** (the bot, `npm run sim -- --mission ring`): god seeds 1–15 complete in
  32,881–38,290 ticks (seeds 1–5: 35,603 / 35,960 / 36,878 / 32,881 / 36,073; the plan part
  28,509–33,144), longest gap 184–232; normal 1P seeds 1–5 33,455–36,908 ticks, 6–9 wrecks,
  gap 176–196; 2P normal seeds 1–5 34,679–36,117, gap 185–260; 2P god seeds 1–3 complete, gap
  197–217. Every run: 0 errors, 0 off-screen shots or hits, shortest tell 24 ticks on screen,
  ≥ 2 lanes open, at most 40–60 entities. Every `--section` completes. The lorry (spawn → gone):
  normal 48–61 s, hard 64 s, easy 38 s, 2P 45 s.
- **Bot** (docs/api/sim.md §12): the wave-B threats (brake checks, loose caravans, SCAN LOCK,
  the tow hook, stickers, moto tells — the side ram —, parcels and cargo as lobs and obstacles,
  the forklift's charge, the big vehicles and cone lines as blocks, boarders — the knife), lobs at
  the boss, the target pull only when settled in a lane.
- **Fixes in the content:** the lorry pushes a wagon beside it onto the road (never over the
  median); civilian cars stand while every player is out; the wagon wreck stays while every player
  is out; scooters filter while a jam clears (level > 0.05).
- **The flow:** the ring's own MISSION COMPLETE page (§13), the music cues attached in the
  RingScene (§18), the ring's sample group without the ams songs (§13).
- **Art:** the green wagon's deep bottle green and darker, low-contrast camouflage (1× ramps and
  the HD `BOTTLE` ramp; colours only, no geometry changed, no fixture id); a real comma in the
  tiny sign lettering (`12,3` on the hectometre boards); the x-ray (§11).
