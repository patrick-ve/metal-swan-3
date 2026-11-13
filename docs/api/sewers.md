# Mission `sewers` — API (RATTENJONG MET DE RATTENITEMS, level 2)

Spec: `docs/design/sewers.md` (§1 the flow, §2 the sections, §3 the cast, §4 the bosses, §5 the mechanics, §7 the
sound, §9 the files). Originality: `docs/ORIGINALITY.md` "Exception: mission sewers". Level card:
`docs/design/sewers/brainstorm.md`. Shipped in 377c910 (2026-11-13).

This file is for the next builder who changes or extends the mission. It describes the code as it is; where the
code and the spec differ, the code is what plays (the list is at the end, §13).

`sewers` is a normal `defineMission` 2D mission on the unchanged `MissionRunner`: six sections (`sewers-a` …
`sewers-end`), 1P and 2P, the in-world continue, euros (`economy: 'euro'`, the newspaper tally). It is LAZY (§2).
Its scenery is the level kit's baked canal scenes (`docs/api/canal.md`), the sewer sections c, d, e as a lit pair
(§5). Route: ams (MISSION 1) → its tally → the MISSION 2 card → `sewers` → its tally → the MISSION 3 card of
`rally` (`ams.next = 'sewers'`, `SEWERS.next = 'rally'`; `flow-data.ts` `FPS_ROUTE`).

## 1. Module map

| Path | What |
|---|---|
| `src/game/content/missions/sewers/ids.ts` | EVERY id of the mission (sections, widths, banners, cast, bosses, set pieces, songs, sfx prefix, sample group, e's props). Pure data, no imports: tests, tools and the non-lazy flow code import it without the chunk. `isSewersSpriteId(id)` |
| `…/missions/sewers/index.ts` | `SEWERS: MissionDef` (`subtitle: 'MISSION 2'`, `bossSection` e, `bossSections` [a, e] for the BOSS SPEED BONUS, `hostages` per section, `introDrop`, `artDensity: 4`, `preloadFirst`, 1× `art`); imports `./light` and the six sections |
| `…/terrain.ts` | the walk line `G = 176` and one numbers record per section (`SEWERS_A` … `SEWERS_END`: locks, arenas, checkpoints, exits, crates, plinths, pipes, ledges); `flatTerrain`, `terrainC/D/E`. Art, decor, scripts and tests read these, so collision and art agree |
| `…/helpers.ts` | the GDD wave notation as calls (`fromRight`, `fromLeft`, `fromTop`, `at`, `hostage`, `crate`, `normalUp` `[N]`, `hardOnly` `[H]`, `twoPlayers` `[2P]`), `waitBoss`, `prewarm` (skips ids the canal scene paints), `placeBanner`; P0's `standInWave` / `lockedFight` (unused by the finished sections) |
| `…/section-{a,b,c,d,e,end}.ts` | one `SectionDef` + script each (§4) |
| `…/a-kit.ts`, `c-kit.ts`, `d-kit.ts` | grey STAND-IN decor drawn in code (`decor/sewers-a/…`, `decor/sewers-c-…`, `decor/sewers-d/…`); built and drawn only with `?canal=0`. `c-kit.ts` also holds `C_LAMPS` and `drawCEmitters` |
| `…/e-kit.ts` | the props of the dawn: `sewers-manhole` (`SewersManhole`), `sewers-wagon` (`SewersWagon`, `WAGON`), the status `sewers-slimed`, the stand-in `decor/sewers-e-junk` |
| `…/light.ts` | one `defineSectionLight` per section (§5) |
| `…/card.ts` | `SEWERS_CARD` (the line-map card, five stops). NOT lazy: `content/ui/cards.ts` lists it, so the ams tally can open it while the chunk loads |
| `…/placeholder.ts` | P0's grey backgrounds and terrain styles (`GREY_NIGHT`, `GREY_VAULT`, `GREY_DAWN`, `GREY_STREET`, `GREY_SEWER`): what `?canal=0` draws |
| `…/canal/` | `index.ts` (`defineCanalManifest('sewers', …)`, `sewersCanal(id)`), the generated `manifest.gen.ts` and `<section>.gen.ts` (`sewers-c-lit`, `-d-lit`, `-e-lit` are the lit stacks) |
| `src/game/content/sewers/street/` | dealer, pimp, bodyguard (`person.ts` base, `figure.ts`, `numbers.ts`), `streetFlee`, the mints pickup (`mints.ts`), the hostages (`hostages.ts`: kind `sewers-worker`, the banana `tourist` look) |
| `src/game/content/sewers/rats/` | the four rats (`base.ts`, `runner`, `leaper`, `spitter`, `brute`), `numbers.ts`, `helpers.ts` (`ratPack`, `spitterPlinths`) |
| `src/game/content/sewers/set-pieces/` | `grate.ts` (`sewers-grate`), `fatberg.ts` + `fatberg.art.ts` (`sewers-fatberg`) |
| `src/game/content/sewers/items/battery.ts` | `pickup-battery`, its status and HUD icon |
| `src/game/content/sewers/light-test.ts`, `eyes-emit.ts` | `isLit` (+ the test hook `setLitOverride`), `drawRatEyes` (the eye emitters) |
| `src/game/content/sewers/art40/` | the 40 px baked figure sets (`*.gen.ts`), registered by the `art.ts` files of street, rats and the bosses (`defineBakedSet`) |
| `src/game/content/bosses/sewers-gerrit/` | GOUDEN GERRIT: `limo.ts` (`GerritLimo`), `numbers.ts` (`GERRIT`), `art.ts` |
| `src/game/content/bosses/sewers-rattenjong/` | DE RATTENJONG: `king.ts` (`Rattenjong`, `SEWERS_HANG`), `numbers.ts` (`KING`), `props.ts` (`KingThrone`, `SewersFlood`), `shots.ts` (the throws), `art.ts` |
| `src/game/content/music/sewers.ts`, `sfx/sewers.ts` | synth fallbacks of the four songs and every `sewers/…` sfx |
| `src/game/content/samples/sewers.ts` | the sample group `mission:sewers` and `SEWERS_VOICE` (every bubble text) |
| `src/game/scenes/sewers-route.ts` | `isSewers`, `loadSewersContent`, `sewersLoadState` (the flow's lazy loader) |
| `src/game/mission/light/cone.ts`, `litmask.ts` | the hero flashlight geometry (`FLASHLIGHT`, `heroCone`, `litByHeroes`) and `LitMask` (§5) |
| `tools/levelkit/missions/sewers/`, `sewers-look/` | the paint kit of the six sections; the approved look sample (§9) |

## 2. Lazy loading and the art budget

- **The chunk.** `src/game/content/index.ts` lists the mission's manifest entries (`missions/sewers`,
  `music/sewers`, `sfx/sewers`, `samples/sewers`, `sewers/rats`, `sewers/street`, `sewers/items/battery`,
  `sewers/set-pieces/grate`, `sewers/set-pieces/fatberg`, `bosses/sewers-gerrit`, `bosses/sewers-rattenjong`).
  `isSewersContent(id)` accepts `missions/sewers[/…]`, `sewers[/…]`, `bosses/sewers-…`, `music/sewers`,
  `sfx/sewers…`, `samples/sewers`; `isLazyContent` includes it. A new owner folder needs a manifest entry whose id
  `isSewersContent` accepts, or it loads with the boot.
- **Who loads it.** The boot never does, except for a direct `?mission=sewers` (`boot.ts`: `isSewers(params.mission)`).
  The MISSION 2 card (`mission-intro.ts`) calls `loadSewersContent()`, then preloads the art and the sample group,
  and holds until `sewersLoadState().registered`; a failed chunk goes on to the rally's card (the run never
  dead-ends). The headless game loads it with `createHeadlessGame({ missionId: 'sewers' })` (`src/sim/headless.ts`);
  node tests may call `loadContent(isSewersContent)`. The art workers (`src/game/art-worker.ts`) load it once when a
  request names an id that `isSewersSpriteId` accepts.
- **The `sewers-` segment rule.** Every sprite id of the mission has a path segment that starts with `sewers-`
  (`enemy/sewers-rat-runner/run`, `boss/sewers-gerrit/…`, `decor/sewers-grate/burst`, `item/hostage/sewers-worker`,
  `prop/sewers-fatberg/…`), and so does every new entity id that must stay in the chunk (`sewers-worker`, not
  `worker`). Without it the art worker does not load the chunk and the sprite shows the placeholder. Exceptions are
  shared ids the mission reuses: `pickup-battery`, `hostage`, the ams locals, the ring's wagon art.
- **The figure budget.** The 40 px sets of the mission live in `src/game/content/sewers/art40/` with their own lazy
  budget: at most 450 KB gzip for all of them (`tests/art/sewers-art40.test.ts`; 216 KB at ship). The shared folder
  `src/game/content/art40/` and its 1,300 KB budget stay untouched; that test also fails a `sewers-*` set in the
  shared folder.
- **Euros.** `src/game/budget/euro-table.ts` `EURO_BY_ID`: dealer € 5, pimp € 12, bodyguard € 8, runner € 2,
  leaper € 3, spitter € 4, brute € 15, Gerrit the mini-boss row, the Rattenjong the boss row, a fatberg € 1.

## 3. Sections overview

| Section | Name / banner | Width | Locks | Song / ambience | Exit |
|---|---|---|---|---|---|
| `sewers-a` | DE WALLEN - 23:00 | 3,072 | 1,664–2,048; arena 2,688–3,072 (Gerrit, `bossStart` 2,700) | `sewers-street` (`sewers-gerrit` in the fight) / `sewers/rain-bed` | `sewers-a-end` at 3,040 → b (enabled after the fight) |
| `sewers-b` | DE STEEGJES - 01:00 | 2,560 | 1,920–2,304 (the eruption) | `sewers-street` / `sewers/rain-bed` | `sewers-b-grate` 2,384–2,448 → c, transition `cut` |
| `sewers-c` | DE PUT - 01:30 | 1,920 | none | `sewers-sewer` / `sewers/drip-bed` | default exit at 1,880 → d |
| `sewers-d` | HET RIOOL - 02:30 | 2,816 | 2,432–2,816 (the fatberg) | `sewers-sewer` / `sewers/drip-bed` | `sewers-d-end` at 2,800 → e |
| `sewers-e` | DE AFVALHAL - 05:00 | 1,280 | arena 864–1,248 (`bossStart` 880) | `sewers-boss` / `sewers/drip-bed` | `ctx.exitTo('sewers-end', { transition: 'fade' })` after the boss |
| `sewers-end` | DAGERAAD - 07:15 | 384 | none (`timeLimit: 0`) | `sewers-boss`, faded out as the wagon leaves | `ctx.missionComplete()` |

Every section: 216 px high, scroll right, flat ground at y 176 (plus one-way platforms in c, d, e), `canal:
sewersCanal(SEWERS_SECTION.<k>)`, checkpoints ascending and ≤ 1,400 px apart (`terrain.ts`). Each script calls
`placeBanner` first (a: 150 ticks after the MISSION 2 / START! banner) and `prewarm` with its art.

## 4. The sections

### 4.1 `sewers-a` DE WALLEN (`section-a.ts`)

- Script by camera-right triggers (`right(ctx, x)`): crate `H` at 420; two lurking dealers behind the krul at 300
  and the tree at 520; the pimp lesson at 900 (he whistles one bodyguard in); the banana tourist (`chair`) at
  1,150; riders both ways over bridge 1; `lockOne` (two waves tagged `A_TAG.lock1` / `lock1b`, crate `S`); the
  plain tourist (`cage`, `pickup-food`) at 2,200; the limo is spawned at 2,500 (`spawnLimo`, it waits);
  `gerritArena` (crate `R`, `limo.start()`, `bossIntro('GOUDEN GERRIT', { subtitle: 'MINI-BOSS' })`, then
  `streetFlee`, the street song, unlock, `enableExit`).
- `?boss=1&section=sewers-a` (or `ctx.bossRush` in a): only `gerritArena`.
- Numbers: `SEWERS_A` (terrain.ts). Stand-ins: `a-kit.ts` (`A_KRUL`, `A_TREE`, `A_BRIDGE`). The canal scene (kit
  `sw_a.py`) paints the quay, the krul, the elm and both bridges; the limo and Gerrit are figures, never scenery.

### 4.2 `sewers-b` DE STEEGJES (`section-b.ts`)

- Parallel threads `alleys` (three doorway dealers, crate `R`) and `backAlley` (pimp + bodyguard, the tourist in a
  `sack`, two dealers); then `square` (a rider, the idle crooks, a fatbike youth, `[2P]` a rider), `eruption`,
  `jumpIn`.
- THE RAT ERUPTION: the three `eruption` grates `rattle(60)` then `burst()`; `streetFlee(world)` makes every street
  person run off (untargetable, no score); three waves of runners via `ratPack(…, { hole: grate.hole })`, sized by
  `waveSize` (NORMAL 1P 5; −1 on EASY, +1 in 2P, +1 on HARD); a leaper waits in the middle grate in the last wave.
  The next wave comes when the last is clear + `clearGap`, never before `minGap`, at the latest after `maxGap`;
  the lock always opens after `lastWave` ticks (never a softlock).
- The jump in: the `big` grate bursts with `pour: true`, `hud.pointer(big, 'SPRING!')`; the exit opens when every
  living hero is at the grate, or `B_PLAY.follow` (120) ticks after the first (the runner's exit carries the rest).
- Tuning: `B_PLAY` (section-b.ts), `SEWERS_B` (terrain.ts), `GRATE` (`set-pieces/grate.ts`: widths, rattle,
  `pourTicks`, the lid arc, the open grate's glow via `LIGHT_TAG`). The grate is cosmetic only (`fxRng`).

### 4.3 `sewers-c` DE PUT (`section-c.ts`, `c-kit.ts`)

- THE FALL: `introDrop: { x: 64, fromY: -40, chute: false }` (`SectionDef.introDrop`, `mission/types.ts`); it runs
  on the entry from b and on a direct start, not on a respawn, a continue or a boss rush; the hero keeps the weapon.
- When no hero is `dropping` any more: `setFlashlights(world, true)`, the banner `FLASHLIGHTS ON` (90 ticks), the sfx
  `sewers/flash-click`. Then threads keyed to the camera: `lesson` (three runners one at a time), three leapers in
  pipe stubs (`SEWERS_C.pipes`, `LEAPER.pipeY` 150), two packs of 3, sewer worker 1 (`sack`, drops
  `pickup-battery`), the spitter lesson on its plinths (`spitterPlinths`), three packs of 4, a last pack of 3.
- Numbers: `SEWERS_C`, `C_TAG`. The stand-ins (`C_ART`) are prewarmed only while `cScenePainted()` is false.
  `drawCEmitters` draws the rat eyes always and the stand-in eye pairs only without the scene (the kit paints them).

### 4.4 `sewers-d` HET RIOOL (`section-d.ts`, `d-kit.ts`)

- `placeStanding` places ahead of the camera (`D_SCRIPT.ahead` 64 px): spitters on the plinths `SEWERS_D.plinths`
  (500, 800, 1,560; the second plinth `plinthGap` 96 right), the small secret fatberg at (1,200, y 148) that
  `reveal`s the golden record, sewer worker 2 (`float`, drop `F`, lines `PAK DIE PROPPEN AAN!` / `MET VUUR!`), three
  pipe leapers, crate `S`, the big fatberg at 2,700.
- The script: three runner packs of 4, the brute lesson (waits for the packs or `bruteWait`), `D_SCRIPT.mixed`
  packs from both sides, two packs among the leapers, the second brute from the right at camera centre
  `brute2At`, then the lock: `yield () => berg.broken`, `waitClear(D_TAG.berg)`, unlock, the exit.
- THE FATBERG (`set-pieces/fatberg.ts`, `FATBERG`): extends `BreakableWall` (solid, tags `shootable` / `prop` /
  `wall`, never `enemy`); hp 1,200 (small 150, not solid, tagged `secret`); fire × 2; stages at 75 / 50 / 25 %
  each release 4 runners and 1 spitter out of `FATBERG_HOLES`; at 0 it slumps (`slump` ticks) and `broken` is true.
  `dFatberg(ctx)` finds it for tests. With the scene on, both fatbergs draw the lit stack's canal sprites (§5).

### 4.5 `sewers-e` DE AFVALHAL (`section-e.ts`)

- The king is spawned at once at `SEWERS_E.throneX` 1,100 (dormant decor); `approach` (crate `H`, packs at
  camera-right 300 / 470 / 720, `[N]` two from behind, the spitter on plinths 640 / 736, `[2P]` a pack of 6; it waits
  ≤ 600 ticks for the approach to clear); `arena` (lock, crate `M`, `king.wake()`, `bossIntro('DE RATTENJONG',
  { subtitle: 'KONING VAN HET RIOOL' })`, wait `defeated`, fade to the end).
- Terrain: `terrainE()` (the trash ledges `SEWERS_E.ledges` at y 150, one-way; the spitter plinths). The lost
  things `decor/sewers-e-junk` are painted flat into the walkway when the scene is on.

### 4.6 `sewers-end` DAGERAAD (`section-end.ts`, `e-kit.ts`)

- Every hero in play is `mount`ed in the `sewers-manhole` (hidden); the lid opens; `release(p)` one by one, each
  gets `SEWERS_SLIMED` (a green tint, 900 ticks); `END_BEATS` times every beat.
- **The wagon** (`sewers-wagon`, `SewersWagon` in `e-kit.ts`): a thin wrapper that draws the ring's white wagon art
  (`src/game/content/ring/wagon/`: `art.ts` registers the strips at import, `geometry.ts` `ID`, `CAR`, `POSE`,
  `SEAT`, `CABIN_LEFT`; read only, its frames stay hash-equal). It comes from the right showing its left side
  (`WAGON.speed`), makes the ring's handbrake turn (spin frames 4 → 0, `turnFrame` ticks each) and stops facing
  right at `SEWERS_END.wagonX` 320 (`arrived`). `open = true`; every hero who `touches` the door box is `board`ed
  (a somersault, `hopPerPx` / `hopMin` / `hopMax`, into `WAGON.windows`: P1 the rear door, P2 the load space); after
  `END_BEATS.board` (420) ticks the rest are put in; `seated` → `leave()` → `gone` → `missionComplete()`. It is
  team `neutral`, tag `prop`, `canMount` false (only the script boards).
- **The driver:** `wagonDriver(ctx)` picks a squad hero that no joined slot plays (`ROSTER`, `hasCharacter`) with
  `ctx.rng.fork('sewers-wagon-driver').pick(free)`: the fork does not advance the gameplay rng; null when all five
  play. The driver sits behind the front door glass (`char/<id>/ride-sit`, `ride-hold` while talking; `WAGON.driverY`).
- **The lines (text only):** the driver's bubble `STAP IN, ZWAAN!` (`SEWERS_VOICE.hero.getIn`, `voice: false`),
  then `END_BEATS.smell` (104) ticks later Vincent, or the first hero in play: `IK RUIK NAAR RIOOL.`
- The section's `art` lists the wagon strips and every hero's `ride-sit` / `ride-hold` for the tier-4 working set.
  The sfx `sewers/taxi` (a generic car pulling up) plays at the arrival and the start. About 458 ticks.

## 5. The light: flashlights, the lit pair, entity-only darkness

The canal recipe (bake both stacks, the opt-in, the composite, memory, the porter's steps) is in
`docs/api/canal.md` §12; this section only names the parts and where the sewers tune them.

- **Per section** (`light.ts` `SEWERS_LIGHT`): a, b `streetNight` (darkness 0.35 / 0.42, navy tint, `warmLamp`s
  only on the PAINTED lamps: `A_LAMPS`, the b wall lamps and square lanterns, `glow: 0`, no pass rain or neon); c,
  d, e `sewerDark` (darkness 0.6, ink tint, `heroLight` 28, `cones`, c with `{ off: true }` until FLASHLIGHTS ON;
  `emissive` the rat eyes, `emitSprites` `fx/muzzle` and `fx/sewers-rat-slime`, `emitTags` `item`); c adds
  `C_LAMPS` (the shaft) and `drawCEmitters`; e adds `E_CRACK_LAMPS` and `drawEEmitters` (the king's eyes via
  `drawEyes`, his throws, so an attack out of the dark still reads); end: darkness 0.12. Every entry but the end
  uses `scope: 'entities'`.
- **`StaticLight.speed`**: a lamp on a kit plane of parallax speed s shows at `camX + 192 + (x − 192 − camX) · s`.
  The street helper `sD(d) = (116 − d) / 116` gives the plane speed at kit floor depth d.
- **The flashlight** (`mission/light/cone.ts`): `FLASHLIGHT` (length 210, half-angle 20°, tilt 5°, two 3° rim bands,
  the last 35 % fades, the muzzle `spill` 24; battery 280 / 28° for 1,200 ticks, icon warning 120). The cone starts
  at the gun's muzzle point and follows the aim. `LightMap.addCone` cuts it into the pass; `litByHeroes` is the
  same geometry for the sim side. `setFlashlights(world, on)` / `flashlightsOn(world)` (`light/api.ts`).
- **`isLit(world, x, y)`** (`content/sewers/light-test.ts`): true inside any living hero's cone or glow, and
  everywhere in a section without cones. The rats read it ONLY to choose their art (the whole rat, or the eyes);
  it never changes a hit, a speed, a timing or an rng draw. `setLitOverride(true | false | null)` is the test hook.
- **The battery** (`items/battery.ts`): `BATTERY_EFFECT` (status `BATTERY_STATUS`, `carry: true`, the HUD icon
  `ui/sewers-battery` blinks in the last 120 ticks), sfx `sewers/battery`, no score.
- **The lit pair:** c, d, e are baked twice; the lit stack's manifest names its ambient one (`litOf`); the view
  finds it with `canalLitOf` and draws it inside `LitMask` (`light/litmask.ts`: the heroes' cones, spill and glow
  at the canal's draw density, opaque at light ≥ 1, else a 4 × 4 ordered dither). The lit stack (layers and canal
  sprites) draws at tier 2 at most (`store.ts` `LIT_LAYER_TIER = 2`), though it is baked at 1, 2 and 4.
- **Entity-only darkness** (`SectionLight.scope: 'entities'`): with a live scene the pass darkens the entities'
  own pixels only (they draw into the renderer's layer, `LightControl.entitiesBegin` … `entitiesEnd`); emitters
  and additive draws skip it. Without a live scene (`?canal=0`, no source, a failed file, every sim) or a renderer
  without the layer, the pass darkens everything as in Phase 4.
- **`World.drawHook`** (`engine/world.ts`): `(r, e) => boolean`; the canal view sets it while a lit pair has canal
  sprites, so an entity that draws a canal sprite (the fatbergs, the throne pile, Gerrit's chain on it) is drawn
  like scenery: ambient frames, then lit frames through the mask (`entitiesFlush` / `entitiesReopen` keep the order).
- **The renderer layer API** (`engine/render.ts`, optional members): `layerBegin(box)`, `layerMask(mask, d, x, y,
  dirty)`, `layerShade(buf, x, y)`, `layerEnd()`; draws with `blend: 'add'` go to an additive twin. Both the canvas
  and the software renderer implement it; a renderer without it falls back as above.

## 6. The cast

All numbers are NORMAL; tells scale with the difficulty (`Creature.tele`, never below 18 ticks). Every attack has
a tell with a pose and a sound; standard shots are at chest height so a crouch dodges them; bloodless.

- **Street** (`street/numbers.ts`): `DEALER` (10 HP, tell 20, a knife jab `jabBox` 20 px; `lurk` steps out at
  `notice` 150 px; drops `sewers-mints`), `PIMP` (30 HP, tell 24, 3 shots at `chestY` 24; once `whistleTele` 30
  calls a bodyguard unless `whistle: false`), `BODYGUARD` (40 HP, tell 24, a 72 px shoulder charge, stunned 40 on a
  wall whiff), `FLEE` (`streetFlee`), `CRAWL`, `MINTS` (25 points / € 0.50, the bubble `NEP!`). Looks: param
  `look` (`DEALER_LOOKS` a–c, `PIMP_LOOKS` and `BODYGUARD_LOOKS` a–b), else one by `fxRng`.
- **Rats** (`rats/numbers.ts`): `RUNNER` (10 HP, 2.4 px/tick, tell 18, bite lunge), `LEAPER` (10 HP, waits in a
  pipe at `pipeY` 150 or a grate, wakes at 150 px, tell 24, an arc jump of peak 48, then runs), `SPITTER` (20 HP,
  on two `PLINTH`s y 148, 96 apart, a lob every 150, hops every 3rd), `BRUTE` (120 HP, a 96 px charge with a
  30 px high box, a stomp wave 48 px each way). Entries (param `entry` / `enter`): `left`, `right`, `hole`, `drop`,
  `pipe`, `grate`; `ratPack(ctx, n, { from | hole | drop, every, gap, tag })` spawns packs. The eyes flash white for
  `RAT.eyeFlash` ticks at every tell; in the dark only the eyes draw (`drawRatEyes`).
- **Hostages** (`street/hostages.ts`): kind `sewers-worker` (param `lines`: two bubbles; c's default `EINDELIJK
  LICHT!` / `HIER, EEN BATTERIJ!`; `WORKER_GAG`), and the `tourist` look `banana` (`DANK JE, MAN!`).
- **Returning:** `delivery-rider` and `fatbike-youth` from ams, unchanged.

## 7. The bosses

### 7.1 GOUDEN GERRIT (`sewers-gerrit`, `bosses/sewers-gerrit/limo.ts`, `GERRIT` in `numbers.ts`)

- `GerritLimo extends Boss`. Spawn at the limo's middle, facing −1; it waits (`autoStart` false) until the script
  calls `start()`. The limo is a dynamic `SolidBox` 120 × 28, its roof a platform at y 148; the wreck turns
  one-way. Parts (required): limo 900, Gerrit 500 (HP × difficulty × co-op). 10,000 points.
- `phases`: `shotgun` (at 1: rise, tell 24 `sewers/shotgun-pump`, 3 pellets at the chest line and ±10°, `up` 60,
  then he ducks, invulnerable, `down` 90) with THE BACK DOOR (`door`: first at 240, every 480, ≤ 2 alive, none while
  `holdAdds`); `horn` (`when: hornReady()`: the limo ≤ 50 % or Gerrit knocked out; the `roll` 64 px out and back,
  only the nose hurts on the way out; the gold `chain` lob, shootable 10 HP; volleys between).
- Boss states `fight` → `dying` → `done`: `death` (the wreck `MIJN LIMO!!`, he jumps out and flees into depth
  `DIT IS NIET VOORBIJ!`; the flee is drawn up the painted bridge 2 (`FLEE_DECK`, draw only)). The gloat (every hero
  out) and the stagger (a continued hero lands; never mid-roll) follow the shared boss rules. `trace:
  GerritAttackTrace[]` records every attack (its tell and fire ticks) for the tests.
- Tests: `tests/content/sewers-a.test.ts` (the solid and roof, the spread and the crouch dodge, the duck, the back
  door cap, phase 2, tells ≥ 18 on every difficulty, the stagger, the end, the boss rush).

### 7.2 DE RATTENJONG (`sewers-rattenjong`, `bosses/sewers-rattenjong/king.ts`, `KING` in `numbers.ts`)

- `Rattenjong extends Boss`, one pool `KING.hp` 4,000, 20,000 points. Spawned at the throne's centre; he places his
  `KingThrone` and sits DORMANT (no team, shots pass) until `wake()`; the intro (`introTicks` 70) is invulnerable.
- `phases`: `throne` (at 1: `throwNext` bike → cart → scooter, one beat every `throwEvery[0]` ticks; the bike
  tell 30, shootable 24 HP, 2 bouncing parts; the cart rolls at 2.5; the scooter bounces twice), `rats` (at
  `phase2At` 0.66: the squeak tell 40 lights every hall eye, then a wave of 6 runners + 1 spitter down the pile
  (`drop` entry, tag `KING_RAT_TAG`, `wave.cap`) every `wave.every` 480; throws every `throwEvery[1]` between; the
  pile lowers at `shrinkAt` to `tops`), `afoot` (at `phase3At` 0.33: the jump down tell 40, then walk, the charge
  tell 30 at 3.2 px/tick with the 24 px high `box.ram`, dazed `charge.daze` 60; the tail tell 24, the bite tell 20).
  Each phase has a `resume` for the stagger (`cutAttack`); waves hold while every hero is out (`holdAdds`).
- The end (`KING.end`): he staggers back, the vault cracks, `SewersFlood` (a cosmetic `RisingWater` to y 190 in
  120 ticks), the heroes get `SEWERS_HANG` (no control, no fire, hits absorbed, ≤ 120 ticks), the wave washes him
  and his rats away; the script then fades to the end.
- `attacks: KingAttackRecord[]` (kind, tell, on screen, tick) is what the tests read.
- Tests: `tests/content/sewers-e.test.ts` (dormant then phase 1 in order, the throws, phase 2 wave and shrink,
  phase 3 attacks and the daze, the end and the flood, the boss rush).

## 8. Audio

- **Group** `mission:sewers` (`samples/sewers.ts` `sewersSampleGroup`): the ams group's sfx and voices without its
  songs (the returning locals' takes), merged with the sewers takes from `SAMPLE_MANIFEST`; sewers wins on a
  shared id. Songs of `STREAM_MIN_SECONDS` or longer are STREAMED (`SampleSong.stream`), as the rally's. Files:
  `public/audio/sewers/{music,sfx,voice}/`. The synth recipes (`music/sewers.ts`, `sfx/sewers.ts`) stay the
  fallback for every id, so the mission plays without a file.
- **Songs** (`SEWERS_SONG`): `sewers-street` (a, b), `sewers-gerrit` (the mini-boss), `sewers-sewer` (c, d),
  `sewers-boss` (e and the end; no outro take, the end fades it).
- **Voices:** every bubble text lives in `SEWERS_VOICE` (verbatim; ≤ 24 characters × 2 lines, no diacritics); the
  runner voices a bubble by its text, so never inline a voiced text elsewhere. `sewersSayTicks(text)` is the bubble
  life (the longest allowed take, `sewersLineSeconds`, plus `SEWERS_SAY_PAUSE`); `tests/content/sewers-voice-fit.test.ts`
  checks that the scripted beats outlast the takes. Designed voices (`tools/audio/voices.json`, entries in
  `tools/audio/spec.ts`): `sewers-dealer`, `sewers-pimp`, `gerrit`, `stag-tourist` (the banana tourist), `sewer-worker`.
- **The squad heroes never get a designed voice** (they are real people): the `hero` speaker has no entry in
  `voices.json` and its lines (`STAP IN, ZWAAN!`, `IK RUIK NAAR RIOOL.`) are text bubbles with `voice: false`.
  `tests/tools/audio-spec.test.ts` pins this. The Rattenjong and the rats make creature sounds, no words. Gusto's
  card lines and the announce (`MISSIE TWEE. HOU JE NEUS DICHT!`) sit in group `boot` with the card.

## 9. The kit and the figures

- **Scenery** (`tools/levelkit/missions/sewers/`; its `mission.py` head lists every command). `mission.py`:
  `SECTIONS` (`sw_a` … `sw_end`), `HOURS`, `FLOOR` (the kit-side floor; the game sections have no `floor:`),
  `LIT` + `two_stacks` (the ambient and lit builds of c, d, e from one `paint(sid, hour, lit)`), the bake folders
  (`public/art/sewers`, `src/game/content/missions/sewers/canal`, `tests/fixtures/canal/sewers`). Painters:
  `parts_sewers.py` (the approved sewer parts, shared with `sewers-look/`: do not change their numbers),
  `parts_wallen.py` (the street), `parts_sw_<k>.py` per section; `checks_sewers.py` holds the rules of the place.
  `sewers-look/` is the approved look sample (section d in V2 BLACK); keep its frames byte-equal.
- **The layout dump** (the mission is lazy): `npx tsx tools/levelkit/missions/sewers/dump_lazy.mts sewers
  --prefix decor/sewers --prefix prop/sewers --prefix boss/sewers-gerrit/limo --prefix vehicle/`.
- **Re-bake a section** at every tier, from the repo root, ONE tier-4 build at a time (a tier-4 build can take
  ~21 GB of virtual memory):
  ```sh
  for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py sewers bake sw_d sw_d_lit; done   # lit pair: ambient first
  for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py sewers bake sw_a; done            # a, b, end
  ```
  The bake writes the PNGs, the `.gen.ts` files, the manifest and the fidelity fixtures; it refuses a lit stack that
  does not pair with its ambient one (`bake_game.py` `pair_faults`). Then run the fidelity test and the section's
  sims (§10); they must stay exact and equal.
- **Fidelity:** `npx vitest run tests/art/canal-fidelity.test.ts -t "sewers sewers-d"` (one case per stack and tier,
  e.g. `sewers sewers-d-lit at tier 4`): the game frame equals the kit frame at every fixture camera, exactly.
- **Figures** (40 px): `npm run art40 -- <slug>`; `tools/art40/art40.py` `canonical_out(slug)` writes `sewers-*`
  slugs to `src/game/content/sewers/art40/`. Check: `npm run art40-check -- --dir src/game/content/sewers/art40
  [<slug>…]`; gates and the 450 KB budget: `tests/art/sewers-art40.test.ts`.

## 10. Tests and sims

| Test | What it pins |
|---|---|
| `tests/content/mission-sewers.test.ts` | lazy registration, the MissionDef, the card, the six sections (widths, ground, checkpoints, exits, banners), light entries, sound ids, euro rows, 1,200-tick god scripts, the bot end to end 1P / 2P |
| `tests/content/sewers-a.test.ts` … `sewers-e.test.ts` | each section and its set piece or boss (§4, §7); `sewers-e` also the end and the wagon driver |
| `tests/content/sewers-cast-rats.test.ts`, `sewers-cast-street.test.ts` | the cast in test arenas: tells, attacks, dodges, deaths, euros, `isLit` forced on / off |
| `tests/content/sewers-dense-budget.test.ts` | the tier-4 working set per hero and per pair in every section |
| `tests/content/sewers-voice-fit.test.ts` | the beats outlast the voice takes |
| `tests/game/sewers-flow.test.ts` | route numbers, `next`, the m5 route guard, the golden-record route, the lazy loader, the headless route ams → sewers → rally |
| `tests/game/sewers-flashlight.test.ts` | `addCone`, the hero cone, `isLit`, the pass, sims of c, d, e equal with `isLit` normal / forced true / forced false, the cone's draw cost |
| `tests/game/canal-lit.test.ts` | the lit composite (exact) and the entity-only mode |
| `tests/art/sewers-art40.test.ts`, `tests/art/canal-fidelity.test.ts` | the figure gates and budget; the baked scenes |

Sims (`npm run sim -- …`; ticks/kills at ship, seed 1):

```sh
npm run sim -- --mission sewers --seed 1 --god --expect-complete             # 20,277 / 175
npm run sim -- --mission sewers --seed 1 --god --players 2 --expect-complete # 17,986
npm run sim -- --mission sewers --seed 1 --expect-complete                   # mortal 1P: 19,861
npm run sim -- --mission sewers --seed 1 --god --boss                        # the boss rush: 6,235
npm run sim -- --mission sewers --section sewers-d --seed 1 --god --quiet    # one section
```

A change that must not move play keeps these numbers (and kills) equal; the ams and rally sims must stay equal too.

## 11. Debug

- `?mission=sewers` (direct start; the chunk loads with the boot), `&section=sewers-a … sewers-end`, `&boss=1`
  (e's arena; with `section=sewers-a` Gerrit's), `&players=2`, `&god=1`, `&char=vincent`, `&difficulty=`,
  `&art=4&res=4`, `&canal=0` (the grey stand-ins and P0's placeholder scenery).
- The canal loader in the browser: `__ms3.canal.log(true)` logs every pack (bytes, queue wait, read, decode);
  `__ms3.canal.policy({ reads: 1, wholeFallback: false })` switches to the old loader; `__ms3.canal.stats()` /
  `bytes()` / `scenes()` for draw time and resident bytes (`src/main.ts`, `docs/api/canal.md` §4).
- Shots: `npm run shot -- --mission sewers --section sewers-d --res 4 --art 4 --char vincent` (`--bot --cam-x <x>`).

## 12. Known limits

- **Light pass cost:** 0.26–0.52 ms per frame while walking at res 4 (budget 0.2 ms; Phase 4 was 0.14–0.32);
  standing still is inside. Not met at ship.
- **Section c at tier 4** is not proven for streaming (the leading-edge load fix was measured on other sections).
- **`bake_game.py` fixture names** are `<section>-u<U>-c<cx>.png`: the `sw_end` cameras all have cx 0
  (`GAME_CAMS = [(0, 192)] * 5`), so their fixture files collide; the name should carry the crop x.
- **The fidelity sanity floor** (> 40 sampled colours per reference frame, `canal-fidelity.test.ts`) is tight for
  the dark ambient stacks (44–59 colours).
- **`mints.ts`** draws `item/sewers-mints` through an alias; it should use the baked id `item/sewers-mints/tin`.
- **Dev server:** the art workers' module flood (`engine/art-pool.ts`) fills the six connections per host; the
  canal packs load from the other loopback name to dodge it (`docs/api/canal.md` §4). The flood itself remains.
- **The rally's card line** `TAXI PAID. NOW THE SQUAD RACES DE RINGRALLY…` (`src/game/content/ui/cards.ts`,
  `src/game/content/rally/radio/lines.ts`, its take in `tools/audio/spec.ts`) no longer fits the wagon ending.
- **Watch:** Gerrit's open mouth reads as a red patch in some frames; it must never read as blood.
- `KING.tops`, the hall eyes and the pile box must stay in sync with `parts_sw_e.py`; the small fatberg's spot with
  the kit's standpipe in `parts_sw_d.py`.

## 13. Where the code and the spec differ

The code is what plays. The spec (`docs/design/sewers.md`) still says otherwise in these places:

1. **Rattenjong throws:** spec §4.2 one throw every 90 ticks (phase 1) and 120 (phase 2); code
   `KING.throwEvery` = [120, 140] (the doc comment in `numbers.ts` still says 90 / 120).
2. **Rattenjong on the throne:** spec hitbox y 96–140; code `KING.tops` 128 → 134, hitbox y 86–128 (the god bot's
   arena rule, explained in `numbers.ts`).
3. **The phase-3 charge:** spec "jump over his head at 52 px"; code `KING.box.ram` is 24 px high.
4. **The flood:** spec names `rising-water`; code spawns `sewers-flood` (`SewersFlood extends RisingWater`).
5. **Gerrit's phase 2:** spec "limo ≤ 50 %"; code `hornReady()` also opens it when Gerrit's part is knocked out.
6. **The limo's art:** spec §2.1 "the canal sprite of the limo, intact"; code draws the limo and Gerrit as the
   boss's own figure art (`bosses/sewers-gerrit/art.ts`), never scenery.
7. **The secret fatberg:** spec §2.4 "in the side-tunnel mouth at 1,200"; the kit paints it welling up out of a
   standpipe on the walk plane at 1,200 (lead decision, P4b); play is unchanged (x 1,200, feet y 148).
8. **d's side tunnels:** spec 640 / 1,200 / 1,980; the kit paints them on the bay grid at 660 / 1,176 / 2,001 (decor;
   `SEWERS_D.tunnels` keeps the spec numbers for the stand-ins).
9. **d's second brute:** spec "a brute at 2,250"; code: it enters from the right edge when the camera centre reaches
   `D_SCRIPT.brute2At` 2,150.
10. **The street light:** spec §6 uses the pass's rain, streaks, water and neon groups in a and b; code paints all of
    it and runs the entity-only mode with lamps on the painted lamps only (P6a).
11. **Files:** spec §9 lists `missions/sewers/floor.ts` (none: the floor is the kit's `FLOOR` in `mission.py`) and
    `tests/art/sewers-art40-budget.test.ts` (the test is `tests/art/sewers-art40.test.ts`).
12. **Designed voices:** the spec's Status (P3) counts six, with `taxi-driver`; the code uses five speakers. The
    `taxi-driver` entry stays in `tools/audio/voices.json` unused (spec §7 says so).
