# Mission `oldenzaal` — the API of the waves

Level 4, `MISSION 4` "A HAUNTING IN OTOWN" (spec: `docs/design/oldenzaal.md`, sections 0–16).
This file is the contract between the builders of wave A (CORE, LIGHT, TOWN, POSSESSED, WUGHOST,
AUDIO, then INTEGRATE, REVIEW, FIX) and wave B (STATUE, NAVE, TOWER, FINALE, AUDIO-GEN).

`oldenzaal` is a normal `defineMission` 2D mission on the **unchanged** `MissionRunner`. New
engine features are **additive opt-ins** (off by default): ams (lower / upper), m0, m2, the ring
(god seeds 1–5, 2P seed 1) and the fps floors 1 / 2 keep their sims byte-identical, and every
existing sprite id keeps its pixels at 1×, 2× and 4×.

## 1. Files and owners

| File | Contents | Owner |
|---|---|---|
| `src/game/content/missions/oldenzaal/ids.ts` | every id of the waves (below); pure data | CORE (add only) |
| `…/oldenzaal/lines.ts` | ALL the text: story card, Wu, the meal, Winkel, townspeople, signs | CORE (builders may add lines; keep the limits) |
| `…/oldenzaal/index.ts` | `OLDENZAAL` (`defineMission`), `OZ_NAME`; `preloadFirst`, `art`, `audioGroup`, `denseReserve` | CORE → INTEGRATE |
| `…/oldenzaal/helpers.ts` | wave notation helpers (§6) | CORE (add only) |
| `…/oldenzaal/terrain.ts` | placeholder terrain + sizes, `G = 176` | TOWN for oz-a / oz-b; wave B the rest |
| `…/oldenzaal/backgrounds.ts` | placeholder `BG_OZ_A` … `BG_OZ_E` | TOWN (oz-a / oz-b); wave B the rest |
| `…/oldenzaal/section-oz-a.ts`, `section-oz-b.ts` | the sections + their light configs | TOWN: terrain, background, decor, `lamps`; INTEGRATE: `script`, `art`, `ambience`, the fog |
| `…/oldenzaal/script-oz-a.ts`, `script-oz-b.ts`, `script-kit.ts` | the wave-A scripts of oz-a / oz-b and their helpers (§6) | INTEGRATE |
| `…/oldenzaal/section-oz-{c,d,e}.ts` | placeholder sections (playable, with exits) | wave B (STATUE, NAVE, TOWER / FINALE) |
| new `…/oldenzaal/art-*.ts`, `backgrounds.ts` | the town's art (shopping street, De Smulhoek, the basilica exterior) | TOWN |
| `src/game/content/oldenzaal/kit/light-api.ts` | THE LIGHT CONTRACT (§3) | CORE (LIGHT may add fields, never rename) |
| `src/game/content/oldenzaal/kit/ghost-draw.ts` | `drawGhost` (§4) | CORE (LIGHT / POSSESSED may tune values) |
| `src/game/content/oldenzaal/kit/index.ts`, `kit/art.ts`, new `kit/*.ts` | the light pass's content side: `oz-light-point`, fog / rain layers, `fx/oz/light/`, `fx/oz/weather/` | LIGHT |
| `src/game/content/oldenzaal/possessed/{index,art}.ts` (+ new files there) | hosts, souls, eject, townspeople, `oz/possessed/` sfx | POSSESSED |
| `src/game/content/oldenzaal/npcs/{index,art}.ts` (+ new files) | Meneer Wu, Mevrouw Winkel, `oz/wu/`, `oz/ghost/` sfx | WUGHOST |
| `src/game/content/oldenzaal/items/{index,art}.ts` (+ new files) | the meal, snack power, the frikandel bomb, the blast, the splat, `oz/meal/` sfx, the HUD icon | WUGHOST |
| `src/game/content/music/oldenzaal.ts` | synth fallbacks of the four songs | AUDIO |
| `src/game/content/sfx/oldenzaal.ts` | `oz/env/…` synth sfx (thunder, rain, wind, bells, doors, candles, ambience loops) | AUDIO |
| engine opt-ins (`src/game/mission/…`, `src/engine/…`): the light pass, weather, y eviction | additive only, documented in their own headers | LIGHT |
| `src/game/scenes/story-card.ts`, `to-be-continued.ts`, the flow (§7) | the story card, the TO BE CONTINUED card | CORE (wave B FINALE: `ToBeContinuedScene.drawExtra`) |
| `src/engine/palette-hd.ts` (`PAL_HD_OZ`, §5) | the five new ramps | CORE |

Manifest (`src/game/content/index.ts`, not lazy): `missions/oldenzaal`, `oldenzaal/kit`,
`oldenzaal/kit/art`, `oldenzaal/possessed`, `oldenzaal/possessed/art`, `oldenzaal/npcs`,
`oldenzaal/npcs/art`, `oldenzaal/items`, `oldenzaal/items/art`, `music/oldenzaal`,
`sfx/oldenzaal`. Every module registers at import time. **Sprites go in the `art.ts` modules**
(the sprites tool loads only `…/art`, `missions/…` and `bosses/…` entries). A builder who needs a
new manifest entry asks INTEGRATE (exact id + path).

Spec §13 names `characters/snack-power.ts` and `content/items/` for the meal: in this wave they
live in `content/oldenzaal/items/` (one owner per folder). The statue (wave B) goes in
`src/game/content/bosses/oldenzaal/` with a manifest entry `bosses/oldenzaal`.

## 2. Ids (`ids.ts`)

- Mission `OLDENZAAL_ID = 'oldenzaal'`. Sections `OZ_SECTION.a … e` = `'oz-a' … 'oz-e'`
  (`OZ_SECTIONS`); the art packs are keyed by section id (never `a` … `e`: those are ams's).
- POSSESSED `OZ_POSSESSED`: `oz-shambler`, `oz-gunner`, `oz-brute` (category 'enemy'), `oz-soul`
  (a flyer, `body: false`, 'enemy'), `oz-townsperson` ('npc'), `oz-soul-eject` ('fx'),
  `oz-ghost-shot` (projectile).
- WUGHOST `OZ_WUGHOST`: `oz-wu`, `oz-winkel` ('npc'; Winkel is never a target), `pickup-oz-meal`
  ('item'), `oz-frikandel` (the bomb-button weapon id AND its projectile entity), `oz-frikandel-blast`
  and `oz-mayo-splat` ('fx'); the status `OZ_STATUS_SNACK = 'snack-power'`.
- LIGHT `OZ_LIGHT`: the tag `oz-light`, the entity `oz-light-point` (an invisible point light:
  params `r`, `color`, `flicker`), the layer generators `oz-fog`, `oz-rain`.
- Wave B (reserved): `oz-statue`, `oz-swan-jet`.
- Sprite prefixes `OZ_SPRITES` (a builder defines sprites only under its own):
  POSSESSED `enemy/oz-shambler/`, `enemy/oz-gunner/`, `enemy/oz-brute/`, `enemy/oz-soul/`,
  `enemy/oz-ghost-shot/`, `npc/oz-town/`, `fx/oz/soul/`; WUGHOST `npc/oz-wu/`, `npc/oz-winkel/`,
  `item/pickup-oz-meal`, `weapon/oz-frikandel`, `fx/oz/mayo/`, `ui/icon-oz-`; LIGHT `fx/oz/light/`,
  `fx/oz/weather/`; TOWN `decor/oz/`; wave B `boss/oz-statue/`, `vehicle/oz-swan-jet/`.
  TOWN's background generators and terrain materials start with `oz-` (`oz-street`, `oz-pavers` …).
- Sfx prefixes `OZ_SFX`: `oz/possessed/` (POSSESSED), `oz/wu/`, `oz/ghost/`, `oz/meal/`
  (WUGHOST), `oz/env/` (AUDIO; LIGHT plays `oz/env/thunder`), wave B `oz/statue/`, `oz/swan/`.
  Each owner registers its own synth recipes in its own folder (`defineSfx` at import time);
  AUDIO lists every id in the ElevenLabs spec and checks the loudness of all of them.
- Songs `OZ_SONG`: `oldenzaal`, `oldenzaal-boss`, `oldenzaal-tower`, `oldenzaal-tbc`. Ambience
  `OZ_AMBIENCE`: `oz/env/street`, `oz/env/nave`, `oz/env/storm`.
- Voice speakers `OZ_SPEAKER`: `wu`, `winkel`, `plechelmus`. Sample group `OZ_AUDIO_GROUP =
  'mission:oldenzaal'` (AUDIO plumbs it; `index.ts` sets `audioGroup`).

## 3. The light contract (`kit/light-api.ts`)

```ts
defineSectionLight(sectionId: string, cfg: SectionLight): SectionLight   // a section opts in
sectionLight(sectionId: string): SectionLight | undefined               // the pass reads it
interface SectionLight { darkness: number /* 0..1, keep ≤ 0.7 */; tint: Color; lamps?: readonly StaticLight[];
  fog?: FogConfig; rain?: RainConfig; lightning?: LightningConfig; heroLight?: number }
interface StaticLight { x; y; r; color; intensity?; flicker? }            // world px
interface FogConfig { density; color; top /* screen y */; drift? }  interface RainConfig { density; slant?; color? }
interface LightningConfig { every: [min, max] /* ticks, fxRng */; strength?; double? }
const LIGHT_TAG = 'oz-light'
interface LightSpot { x; y; r; color; intensity; flicker }               // one reused record
interface LightSource { lightOf(out: LightSpot, tick: number): boolean }  // false = dark this frame
isLightSource(e: Entity): e is Entity & LightSource                     // the tag and the method
interface LightControl { flash(strength?): void; setDarkness(d, fadeTicks?): void }
bindLightControl(world, ctl | null)    // LIGHT binds its pass to the world it lights
lightControl(world) → LightControl | null
lightning(world, strength = 1)         // scripts: no-op without a pass
setDarkness(world, d, fadeTicks = 60)  // scripts: no-op without a pass
```

- Optional fields (LIGHT, wave A): `StaticLight.glow?` (the additive colour glow of a lamp,
  default 0.4) and `SectionLight.wind?` (0..1, the gusts that push the rain; default 0.5 when the
  section has rain). Nothing was renamed.
- A section without a config draws exactly as today. The stubs register: oz-a darkness 0.4
  (dusk violet, fog 0.75), oz-b 0.48 (fog 0.8), oz-c 0.5 (moon), oz-d 0.6 (lightning 420–900 ticks),
  oz-e 0.55 (rain 0.8, lightning 240–600, doubles); `heroLight` 24–32 px.
- Drawing order (LIGHT decides the details): background → terrain / decor → entities → front
  decor → fog → the darkness overlay with the lights cut in (additive glows) → rain → lightning
  flash → HUD. The HUD and the readability of heroes and pickups come first (spec §10.1).
- An entity that glows (a soul's eyes, Winkel's lantern, a muzzle flash, Wu's door light) adds
  the tag and `lightOf`; TOWN lists the street lamps and De Smulhoek's windows as `lamps` of its
  sections. Everything is cosmetic: `world.fxRng` or a tick hash only; no allocation per frame.

### The pass (LIGHT: `src/game/mission/light/`)

- `MissionLight.forSection(def, world, seed, flashScale = 1): MissionLight | null` — null when
  `sectionLight(def.id)` is undefined (no pass, no cost). The runner makes it in `loadSection`
  (field `light`, null by default), calls `light.update(tick)` once per tick and `light.draw(r,
  tick, density)` after the front decor (before the fade and the HUD); the view calls
  `drawBack` through `view.backHook` after the background layers (the far fog bands, the flash
  behind the town). The pass binds itself with `bindLightControl`.
- Order of `draw`: the near fog over the feet → the darkness map (a 385×217 buffer with the lights
  cut in) → the additive colour glow → two rain sheets → the view flash. Darkness is capped at
  `MAX_DARKNESS` = 0.75. With the settings' reduced flashes the lightning draws at
  `REDUCED_FLASH` = 0.3. The lightning schedule uses its own `Rng` from the section seed (never
  `world.rng` / `world.fxRng`); the thunder `THUNDER_SFX` (`oz/env/thunder`) follows 20–70 ticks
  after a flash when that sfx exists. Nothing is allocated per frame.
- The lights: the config's `lamps` (flicker from a tick hash), entities with `LIGHT_TAG` +
  `lightOf` (one reused `LightSpot`), the players (`heroLight`, no colour), pickups (a faint
  pool), `fx/muzzle*` and `fx/explosion*` (a short warm flash).
- `oz-light-point` (`kit/light-point.ts`): an invisible point light. Params `r` (40), `color`
  (`PAL_HD_OZ.candle[5]`), `flicker` (0), `intensity` (1), `dy` (0); code may set `.follow = e`
  (it sticks to that entity). No body, no hitbox, never despawns; `remove()` puts it out.
- Glow sprites (`kit/art.ts`, additive, no ink): `fx/oz/light/glow` (ghost green, 32×32; the
  default glow of `drawGhost`), `fx/oz/light/glow-warm` (amber, 32×32), `fx/oz/light/glow-s`
  (12×12, takes any tint).
- Weather (`src/game/content/oldenzaal/weather/`): the background generators `oz-fog` (a tiling
  band of fog wisps, `FOG_GEN`) and `oz-rain` (a tile that wraps in x and y, `RAIN_GEN`), 1×, 2×,
  4× from one drawer; the pass draws them, and a section may also use them as normal layers.
- View opt-ins (`src/game/mission/view.ts`, both off by default): `backHook(r, tick)` (called
  after the back layers) and `evictRows` (vertical sections of a dense mission: dense chunks
  `EVICT_ROWS_AWAY` = 2 or more chunk rows above or below the view are released, their queued
  jobs cancelled, the next row prefetched; the runner sets it for oz-e).

## 4. The ghost draw (`kit/ghost-draw.ts`)

```ts
drawGhost(r: Renderer, sprite: string, frame: number, x: number, y: number, opts?: GhostOpts): void
interface GhostOpts { alpha? /* 0.5 */; tint? /* GHOST_TINT; null = none */; tintAlpha? /* 0.35 */;
  glow? /* sprite id, skipped when undefined */; glowFrame?; glowAlpha? /* 0.6 */; glowDx?; glowDy?;
  flipX?; t? /* tick: shimmer ±12 % */; screen? }
GHOST_TINT = PAL_HD_OZ.ghost[4], GHOST_GLOW = PAL_HD_OZ.ghost[5], ghostShimmer(t)
```

Passes: (glow, additive) → body at alpha → the same frame as an additive green silhouette
(`DrawOpts.tint` + `blend: 'add'`). The souls over the hosts, the free and ejected souls and
Mevrouw Winkel all use it (one shared look). Alpha 0 draws nothing (a full fade).

## 5. Palette (`src/engine/palette-hd.ts`)

`PAL_HD_OZ` (additive, 37 new colours; PAL_HD 209 + 37 = 246 of 256): `sandstone` (Bentheimer
grey-brown, 8), `dusk` (violet → purple-red → the low sun, 8), `ghost` (cold green glow, 7),
`candle` (amber, 7), `night` (cold desaturated blue, 7). Also `HD_OZ_RAMP_NAMES`, `HD_OZ_PALETTE`,
`HD_FULL_PALETTE` (PAL_HD + PAL_HD_OZ). They are kept **apart from `PAL_HD` / `HD_PALETTE` on
purpose**: the nearest-colour searches of the particles, the fps effects and the ams / ring
backdrop quantiser (`nearestLab`) run over `HD_PALETTE`, so a new colour there would change
existing pixels. Use `PAL_HD_OZ.<ramp>` by name; a quantiser for the oldenzaal art searches
`HD_FULL_PALETTE` (write your own small nearest over it; never change `nearestLab`).
`inHdPalette(c)` accepts both palettes (art tests). At 1× everything snaps to the 64-colour `PAL`.

## 6. Sections and helpers

| Section | Size (placeholder) | Scroll | Checkpoints | Exit (placeholder) |
|---|---|---|---|---|
| `oz-a` | 3,072 × 216 (TOWN's street) | right | 1,024, 2,048 | after the last lock: player x ≥ w − 64 → `exitTo('oz-b')` |
| `oz-b` | 1,792 × 216 (TOWN's corner) | right | 896 | after the square's lock → `oz-c` |
| `oz-c` | 768 × 216 (`bossStart`, `bossSection`) | right | — | → `oz-d` |
| `oz-d` | 1,152 × 216 | right | 768 | → `oz-e` |
| `oz-e` | 384 × 648 (16 ledges, 36 px apart) | up | y 324 | top rect → `'complete'` |

`playerStart` (48, 176) on the floor; oz-e (192, 624). Terrain style `OZ_STREET_STYLE`
(`oz-pavers` / `oz-ledge` / `oz-brick`, TOWN's materials; oz-c and oz-d share it until wave B;
oz-e keeps the ams materials). Section `art` (the tier-4 working set): oz-a and oz-b list their
decor (`decorArt`), `OZ_STREET_ART` and `OZ_WUGHOST_ART` (`script-kit.ts`); oz-c … oz-e are
empty until wave B. Rules (the mission tests): checkpoints ≤ 1,400 px apart,
`playerStart` on the floor, exits inside the section, the bot can finish every section (vertical:
goals > 20 px up).

Helpers (`helpers.ts`): `VIEW_W`, `VIEW_H`, `normalUp(ctx)` `[N]`, `hardOnly(ctx)` `[H]`,
`twoPlayers(ctx)` `[2P]`, `fromRight(ctx, id, params?, margin = 16, tag?)` `R+16`,
`fromLeft(…)` `L-16`, `fromTop(ctx, id, x, params?, tag?)` `TOP`, `at(ctx, id, x, params?, y =
'ground', tag?)` `@x`, `waitBoss(boss)`, `anyAlive(ctx, tag)`, `prewarm(...prefixes)`,
`stageY(ctx, y, fn, lead = 32)` (vertical staging, like m3's).

### The wave-A scripts (INTEGRATE: `script-oz-a.ts`, `script-oz-b.ts`, `script-kit.ts`)

- **oz-a** (`scriptOzA`): the golden record on `OZ_A_LEDGE` (`pickup-gem` kind `golden-record` at
  `OZ_A_RECORD`); nine townspeople (idle ones flee, others hide); THE DROP: `winkelAppear` on
  `OZ_A_WINKEL_ROOF` at tick 0 (hold 130: she raises the lantern, says `WINKEL_LINES.roof`, laughs,
  vanishes); waves on the way (shamblers, gunners, souls from the drains and chimneys); three
  locks (`OZ_A_ARENAS` first / middle / end, tags `oz-a1` … `oz-a3`, each with a second wave when
  at most 1–2 are left; the butcher brute in the end lock); `setDarkness` 0.44 after the first
  lock and 0.48 before the last (the lamps come on). `[N]` / `[H]` / `[2P]` add hosts.
- **oz-b** (`scriptOzB`): Meneer Wu stands in De Smulhoek's door from the start (`mode: 'wipe'`);
  the approach lock (`OZ_B_ARENAS.approach`, `oz-b1`); the corner lock (`OZ_B_WU_ARENA`, `oz-b2`),
  then every enemy cleared, then `wuScene(ctx, { doorX: OZ_B_DOOR_X, wu })`; the theme rises
  (`ctx.music(OZ_SONG.theme, 30, { from: OZ_THEME_RISE_SLOT, restart: true })`, darkness 0.5);
  packs of 3–5 shamblers (targets for the frikandels) on the way; the square's lock
  (`OZ_B_ARENAS.square`, `oz-b3`: a pack, the bouncer brute, souls); `exitTo('oz-c')`.
- Helpers (`script-kit.ts`): `streetRight(ctx, id, params?, margin = 16, tag?)` /
  `streetLeft(…)` (enter on the pavement at G, never on a platform; a low wall in the way swaps
  the side), `drainSoul(ctx, tag?)` (a soul out of an on-screen drain ≥ 72 px from every hero,
  else out of the air), `chimneySoul(ctx, [x, y], tag?)`, `townsfolk(ctx, list)`,
  `waitArena(ctx, tag)` (waits for the wave; a member more than 24 px outside the locked view for
  `ARENA_STRAY_TICKS` = 420 is removed, so a lock never hangs), `OZ_STREET_ART` (the street looks
  of the possessed, no churchgoer sets), `OZ_WUGHOST_ART` (WUGHOST's and LIGHT's prefixes).
- Pacing (GDD 1.5) and fairness (GDD 4.11) are measured with the bot
  (`tests/content/oldenzaal-integrate.test.ts`): at most 240 ticks without an enemy on screen in
  oz-a and oz-b outside the scene; no hit on a player from an off-screen source.
- The mission def: `preloadFirst` = the common fx, weapons, HUD icons, pickups, `OZ_STREET_ART`,
  `OZ_WUGHOST_ART` (no `decor/oz/`: section art); `denseReserve: OZ_SCENERY_RESERVE` (52 MB, the
  town's 4× scenery; `MissionDef.denseReserve`, an additive field the tier-4 run subtracts from
  `DENSE_BUDGET_BYTES`); `audioGroup: OZ_AUDIO_GROUP`; songs: `oldenzaal` (oz-a … oz-d),
  `oldenzaal-tower` (oz-e); ambience `oz/env/street` (oz-a … oz-c), `oz/env/nave` (oz-d),
  `oz/env/storm` (oz-e).
- The bot (`src/sim/bot.ts`): it throws a status bomb (the frikandels) like a bomb, also at two
  enemies close together ahead (`packAhead`); without a status bomb nothing changes.

What the scripts need from the builders (INTEGRATE calls them; builders export them, never edit
the section files themselves):
- WUGHOST: `export function* wuScene(ctx: SectionContext, o: { doorX: number }): ScriptGen` (the
  input lock, the lines, the toss of one meal per living hero, skippable after 20 ticks, the meal
  given even when skipped) and `export function winkelAppear(ctx, x, y, o?): Entity` (the roof
  moment of oz-a: raise the lantern, vanish).
- POSSESSED: the spawn params of each kind (`look`, `facing`, `tag`, `entry`) documented in
  `possessed/index.ts`; townspeople with `{ flee: true }` and a scripted `possess` hook for §3.4.
- TOWN: `OZ_A_*` / `OZ_B_*` layout constants (the corner of De Smulhoek: `OZ_B_DOOR_X`, the
  arena ranges) exported from `terrain.ts`.

## 7. The flow (CORE)

```
fps-2 tally → fpsTallyDone → StoryCardScene (STORY_CARD_LINES, typed; releases the fps dense art)
  → MissionIntroScene('oldenzaal') (MISSION 4 / A HAUNTING IN OTOWN / OLDENZAAL, TWENTE)
  → GameplayScene (introDrop: the parachute) → MISSION COMPLETE tally (MissionCompleteScene)
  → missionDone → ToBeContinuedScene (TBC_TICKS 300, skippable after 60; releases the mission's 4×)
  → EndingScene({ variant: 'fps' }) → FinalTallyScene → name entry / high scores
```

- `FPS_ROUTE = ['ams', 'ring', 'fps-1', 'fps-2', 'oldenzaal']`; `missionNumber` counts the fps
  floors as one level: ams 1, ring 2, oldenzaal **4** (`MISSION 4`, high-score column `M4`).
  ALL GOLDEN RECORDS on the route now needs oldenzaal's golden record too: **a builder must place
  one** (`pickup-gem` kind `golden-record`; INTEGRATE in oz-a or oz-b).
- If `oldenzaal` is not registered (a broken module), the last floor goes straight to the fps
  ending as before.
- The m5 trap: `listMissions` sorts ids, so `MissionRunner.nextMission()` of m5 returns
  `'oldenzaal'`; `missionDone` ignores it unless the finished mission's def says
  `next: 'oldenzaal'`. m0–m5 are unchanged.
- P2 after the one-slot fps mode: the session's slots are untouched by the fps mode, so both
  active slots spawn in oz-a; a slot that went out in the fps mode stays out (it may continue in
  the 2D runner). `input.fpsMode` is off again (FpsScene.exit).
- Direct starts: `?mission=oldenzaal` (+ `section=oz-a … oz-e`, `players`, `char`, `god`, `debug`,
  `art`, `res`, `difficulty`); `&boss=1` starts at oz-c.
- Wave B: `ToBeContinuedScene.drawExtra(r)` (the jet trail, the ghost's face; a subclass or an
  edit by FINALE), `OZ_SONG.tbc` plays when it exists; stage 2 plugs in through `TbcOpts.next`.

## 8. Rules every builder keeps

- Originality (`docs/ORIGINALITY.md`, `docs/research/mechanics.md` §23): never name a reference
  game; **no Nazi symbol** anywhere (souls: greatcoat and helmet silhouettes, no insignia);
  bloodless (pale mist); no hero transformation, no vomit attack, no cure item; no laughing or
  pointing at a player's death, no mass scream; **respect for the church** (nothing mocked,
  broken or burned; the saint is a victim and is freed). **Meneer Wu**: our own design, no
  stereotype in look, sound or text (no slit-line eyes, no buck teeth, no conical hat, no
  "Chinese-style" lettering, no accent, no broken language, no joke about his origin; his joke is
  his work ethic). Mevrouw Winkel is fictional. Real names only: Oldenzaal, Plechelmus Basilica /
  Plechelmusplein / St. Plechelmus, De Smulhoek (friendly), Museum, Stadhuis, Ganzenmarkt; other
  shop names are made up.
- The user's reference photos (the lead gives their location in each task): likeness only; never copy, trace or sample them, never
  put them or their path in `src/`, `public/`, `docs/` or `tests/`; never draw a person from one.
- Art: 1× (`PAL`) + 2× / 4× from ONE density-generic drawer per id (`PAL_HD` + `PAL_HD_OZ`);
  geometry is law (same logical size, anchor and points at every density); outline rule A (1
  logical px ink) for anything that moves, can be hit or picked up; backgrounds without ink;
  static decor outline C; `defer: true` for rare strips; our own pixel lettering. Fidelity target:
  the ams and ring 4× art (`docs/ART_GUIDE.md` "UHD art", "Motion").
- Text from `lines.ts` only; bubbles ≤ 24 characters × 2 lines.
- Determinism: `world.rng` (gameplay), `world.fxRng` (cosmetic), seeded hashes in art; no
  `Math.random` / `Date`; no per-tick allocation in hot paths. Tells ≥ 18 ticks; attacks only on
  screen; bosses use no attack tokens.
- Byte identity: engine changes are opt-ins, off by default; run the identity sims (below).
- No audio generation in wave A (synth only); never read `.env.local`.

## 9. Run and test

```
npm run sim -- --mission oldenzaal --god --expect-complete [--players 2] [--section oz-b]
npm run shot -- --mission oldenzaal --section oz-a [--bot --god] [--every 60 --count 6] [--res 8 --art 4] --out tmp/<label>/x.png
npm run sprites -- <prefix> --density 1|2|4 --out tmp/<label>/
npm run smoke -- --port <your port> --query "mission=oldenzaal&god=1"
npx vitest run tests/content/mission-oldenzaal.test.ts tests/content/oldenzaal-integrate.test.ts tests/game/oldenzaal-flow.test.ts --maxWorkers=2
npm run smoke -- --port <your port> --query "mission=ams&boss=1&debug=1"   # the route: … fps-2 → story card → MISSION 4 → TO BE CONTINUED → ending
```

Identity sims (`diff <(jq 'del(.timing)' tmp/oz-baseline/X.json) <(jq 'del(.timing)' new.json)`
must be empty): `ams-god-lower` (`--mission ams --god --expect-complete --route lower`, 21,443
ticks), `ams-god-upper` (23,088), `m0-god` (5,679), `m2-god` (31,036), `ring-god-1..5`
(`--mission ring --god --expect-complete --seed n`), `ring-god2p-1` (`--players 2 --seed 1`),
`fps-1-god` / `fps-2-god` (`--mode fps --floor 1|2 --god`).

Tests: `tests/content/mission-oldenzaal.test.ts` (registration, card, stubs, light configs, ids,
lines, palette, ghost draw, light control, the bot 1P / 2P and per-section starts) and
`tests/game/oldenzaal-flow.test.ts` (the route, the TBC card, P2 rejoin, P1 out, the m5 trap,
the direct start). Builders add `tests/content/oz-<area>*.test.ts`. Fixture tests
(`tests/engine/fixtures`, `tests/art/fixtures`) that fail only for ids added on purpose: list the
ids in the report; the fixer updates them.

## 10. Audio (AUDIO)

- **Sample group** `OZ_AUDIO_GROUP = 'mission:oldenzaal'` is in `SAMPLE_GROUPS`
  (`src/engine/samples.ts`) and in the audio tools (`tools/audio/lib.ts` `GROUP_DIRS`: files under
  `public/audio/oldenzaal/`; `LAZY_GROUPS`: the manifest lists it only once something of it is
  picked). Until then `loadSamples('mission:oldenzaal')` resolves at once and the synth plays
  everything. `missions/oldenzaal/index.ts` sets `audioGroup: OZ_AUDIO_GROUP`.
- **Songs** (`content/music/oldenzaal.ts`, synth fallbacks, `OZ_SONGS`): `oldenzaal` (the theme;
  `OZ_THEME_RISE_SLOT` = the order index of its rising part for `ctx.music(…, { from })`),
  `oldenzaal-boss`, `oldenzaal-tower`, `oldenzaal-tbc` (played once by ToBeContinuedScene).
- **The town sfx** (`content/sfx/oldenzaal.ts`, AUDIO; `OZ_ENV_SFX` lists them):
  `oz/env/thunder`, `oz/env/thunder-far`, `oz/env/rain` (loop), `oz/env/wind` (loop),
  `oz/env/street`, `oz/env/nave`, `oz/env/storm` (the `OZ_AMBIENCE` loops), `oz/env/bell` (a big
  toll), `oz/env/bell-creak` (a swinging bell's headstock), `oz/env/door-slam`, `oz/env/door-creak`,
  `oz/env/candle-flare`, `oz/env/candles-out`, `oz/env/lamp-flicker`, `oz/env/crow`.
- **The other owners' sfx ids** the ElevenLabs spec (`tools/audio/spec.ts`) lists. Each owner
  registers the synth recipe of its ids; an id without a recipe plays nothing. A builder who adds
  or renames an `oz/` id adds it to `tools/audio/spec.ts` too (or asks AUDIO / FIX):
  `tests/tools/audio-spec.test.ts` fails for a registered `oz/` id that the spec does not list.
  - POSSESSED `oz/possessed/` (`content/sfx/oldenzaal-possessed.ts`): `groan`, `grab-tell`,
    `claw`, `flinch`, `rifle-tell`, `rifle`, `brute-tell`, `brute-charge`, `brute-thud`, `wail`,
    `eject`, `soul-burst`, `emerge`, `swoop`, `circle`, `dive`, `possess`.
  - WUGHOST (`content/sfx/oldenzaal-wu.ts`) `oz/wu/`: `fryer`, `paper`, `toss`; `oz/meal/`:
    `catch`, `eat`, `throw`, `splat`, `blast`; `oz/ghost/`: `whisper`, `shriek`, `laugh`,
    `appear`, `vanish`.
  - Wave B (planned names, no recipe yet) `oz/statue/`: `wake`, `crack`, `crozier-tell`,
    `crozier-sweep`, `throw`, `shatter`, `orb`, `step`, `slam`, `hook`, `chip`, `freed`;
    `oz/swan/`: `jet` (loop), `flyby`. Wave B may rename them: the spec follows the recipes.
- **Voices** (designed from text, never a clone): `wu`, `winkel`, `plechelmus`; the voiced lines are
  `lines.ts` `voicedLines()` plus the announcer's mission line (`index.ts` `announce`) and
  `SNACK_POWER_CALLOUT` (voiced only when the catch calls `audio.voice(SNACK_POWER_CALLOUT)`). A bubble is voiced when it shows with
  `BubbleOpts.speaker` set to the `OZ_SPEAKER` id and the exact `lines.ts` text.
- **Generation**: none in wave A. The credit estimate is `tmp/oz-audio-estimate.md`; wave B
  (AUDIO-GEN) generates the `mission:oldenzaal` items after the user's OK (`lib.ts`
  `selectItems(all, kinds, only, ['mission:oldenzaal'])` / `itemsOfGroups`; `npm run audio:gen --
  plan --group mission:oldenzaal`, then `gen --group mission:oldenzaal`; docs/api/audio-pipeline.md).

## 11. The possessed (POSSESSED)

Files: `src/game/content/oldenzaal/possessed/` — `index.ts` (registrations, re-exports), `api.ts`
(the holy tag, `ejectSoul`, re-possession), `host.ts` (`PossessedHost`, `Shambler`, `Gunner`,
`Brute`), `soul.ts` (`FreeSoul`, `SoulEject`), `townsperson.ts`, `shot.ts` (`GhostShot`), `mist.ts`,
`looks.ts`, `numbers.ts` (every tunable number), `art.ts`; sfx `src/game/content/sfx/oldenzaal-possessed.ts`
(`oz/possessed/…`); tests `tests/content/oldenzaal-possessed.test.ts`.

| id | category | spawn params (+ `hp`, `drop`, `tag`, `facing`) |
|---|---|---|
| `oz-shambler` | enemy, 30 HP, 200 | `look` (shopper jogger student vendor pensioner churchgoer churchgoer-b; default a street look), `entry` ('left' / 'right': walks in; 'rise': the spasm of a fresh possession, no attack until it stands), `repossessed` |
| `oz-gunner` | enemy, 30 HP, 300 | `look`, `entry`, `hold` (px it stands from the player, 170) |
| `oz-brute` | enemy, 80 HP (big), 800 | `look` ('butcher' / 'bouncer'), `entry` |
| `oz-soul` | enemy flyer, 20 HP, 150 | `from`: 'drain' (y = the drain: it rises out), 'chimney' (y = the chimney top), 'chandelier' (it drops), 'air' (fades in) |
| `oz-townsperson` | npc, neutral | `look`, `mode` ('idle' / 'run' / 'hide' / 'freed'), `flee` (true), `dirX` |
| `oz-soul-eject` | fx | spawned by a host's death; shootable for +50 while it rises (~40 ticks) |
| `oz-ghost-shot` | projectile | `facing`, `arc`, `floor` (normally fired by the gunner) |

Script / weapon API (`import … from '…/oldenzaal/possessed/index'`):

```ts
OZ_HOLY_TAG = 'oz-holy'                       // a Damage tag: a hit with it ejects a host's soul at once (any HP), bursts a free soul
ejectSoul(e: Entity, owner = -1, dirX = 0): boolean            // one host / free soul now
ejectSoulsInArea(world, x, y, r, owner = -1): number           // every host and free soul whose hitbox touches the circle
holyDamage(owner = -1, dirX = 0, source?): Damage              // { amount 1, kind 'explosion', tags [OZ_HOLY_TAG] }
possessTownsperson(e: Entity, count = false): boolean          // the spasm, then he rises as a host (count: toward the cap)
canRepossess(world): boolean; repossessionsOnScreen(world): number   // the cap MAX_REPOSSESS = 2 (spec §3.4)
OZ_HOST_TAG 'oz-host', OZ_SOUL_TAG 'oz-soul', OZ_TOWN_TAG 'oz-town' // e.g. anyAlive(ctx, OZ_HOST_TAG)
```

- WUGHOST's frikandel blast: call `ejectSoulsInArea(world, x, y, r, owner)` where it lands (or put
  `OZ_HOLY_TAG` in the `Damage.tags` of its `damageArea`). Townspeople are never hurt (neutral).
- The soul out (spec §3.3): any death of a host (shot, knife, grenade, holy) spawns `oz-soul-eject`
  at its soul and an `oz-townsperson` `{ mode: 'freed', look }` at its feet (fall → sit dazed 60 →
  getup, a `FREED_LINES` bubble now and then → leaves the view); it scores as a kill. No death strip,
  no blood: a pale mist puff (`mistAt`). Freed people leave against the scroll (left; right only
  when a wall or a drop blocks the left) at `FREED.run` 2.2, fade out (`FREED.fade` 24 ticks)
  `FREED.leaveTicks` 240 after they get up, and never more than `FREED.maxShown` 3 are on the
  street: a new one makes the oldest fade. A fading person cannot be possessed again.
- Re-possession (spec §3.4): a free soul circles a possessable townsperson (any mode but fall /
  seized) for 30 ticks (the tell), then dives; he spasms (`seized`, 24) and rises as `oz-shambler`
  (`oz-brute` for the brute looks) with `entry: 'rise'`, `repossessed: true`. Never more than 2 on
  screen (circling / diving souls and re-possessed hosts).
- Fairness: tells ≥ 18 ticks on screen (`tele()`), attack tokens, no attack outside the view; the
  shambler's claw box is live only in the strike's first 7 ticks; the brute's touch only in the
  charge; the soul's touch only in the swoop. The gunner's shot is slow (1.25 px/tick), glowing, and
  can be shot down (+50). The gunner walks on until he is inside the view before he holds (he
  never stands off screen).
- Light: hosts (the eyes), free souls, ejected souls and ghost shots carry `LIGHT_TAG` + `lightOf`.
- Continue: gloat — the hosts sway and groan, their souls rise and circle, the free souls circle
  above the spot (no pointing, no laughing); cower — the souls pull back (into the hosts / away),
  the hosts flinch (`cower` strip).
- Art prefixes (for `SectionDef.art` / `preloadFirst`): `OZ_SPRITES.possessed`. The churchgoer
  sets (`npc/oz-town/churchgoer*`, `enemy/oz-shambler/churchgoer*`) are `defer: true` (the nave).

## 12. Meneer Wu, the meal and Mevrouw Winkel (WUGHOST)

Files: `src/game/content/oldenzaal/npcs/{index,art}.ts`, `src/game/content/oldenzaal/items/{index,art}.ts`,
`src/game/content/characters/snack-power.ts` (the statuses; imported by `characters/index.ts`),
`src/game/content/sfx/oldenzaal-wu.ts` (`OZ_WU_SFX`, spread into `SFX`). Tests:
`tests/content/oldenzaal-wu.test.ts`.

### The scene (INTEGRATE calls it in oz-b's script)

```ts
import { wuScene, winkelAppear } from '../../oldenzaal/npcs/index';
yield* wuScene(ctx, { doorX: OZ_B_DOOR_X, wu?: Entity /* else a new 'oz-wu' at doorX */, y?: number });
const w = winkelAppear(ctx, roofX, roofY, { hold?: 150, line?: true, facing?: -1 });   // oz-a; a background script
```

`wuScene`: the timer pauses, enemy shots are erased, the input locks (`OzInputLock`, also a P2 who
joins); Wu waves them in (`WU_CALL`), the heroes walk to 34 / 56 px left of him; `WU_LINES` as hint
bubbles (speaker `wu`, 150 ticks each, FIRE skips a line after 20 ticks) while he talks, wipes and
scoops; he tosses each living hero a `pickup-oz-meal` (`tossTo`); afterwards every living hero
without snack power gets the meal anyway (`eatMeal`) and trays left lying are removed; a firm nod;
the pads and the timer come back. About 1,100 ticks in full, about 250 with every line skipped.
Clear the arena first (the scene does not wait for enemies).

### Entities

| id | API |
|---|---|
| `oz-wu` (`OzWu`, npc) | params `facing` (−1), `mode`, `speed`. `setMode`, `idle`, `wave(t)`, `talk(t)`, `wipe(t)`, `scoop(t)` (fryer sfx), `nod()`, `walkTo(x)` / `arrived`, `face(x)`, `say(text, ticks, kind)`, `toss(spec, target)` / `tossed` / `thrown` |
| `oz-winkel` (`OzWinkel`, npc, NEVER a target: no hurt boxes, no shootable / enemy tag, team neutral) | params `facing` (1), `visible` (false). `appear(t)`, `vanish(t, remove)`, `stand()`, `raiseLantern()`, `glideTo(x, y, speed, then)`, `glidePath(pts, speed, then)` / `arrived`, `shriek(t)` (a pale green screen flash + a short shake) / `shrieking`, `possessInto(x, y, speed)` (wave B: the statue; `possessed` turns true, she is removed), `flee(dx, speed)`, `laugh()`, `whisper()`, `say(text)` (speaker `winkel`); `fade` 0..1. A light (`LIGHT_TAG`: her lantern) |
| `pickup-oz-meal` (item) | the tray; `eatMeal` on touch; a hero who has snack power leaves it lying (one meal per hero) |
| `oz-frikandel` (weapon kind 'bomb' + its projectile) | high arc (vx 1.7, vy −3.6; up: 0.8 / −4.4), flies through people, pops on the first floor contact, on a host / free soul, or after 150 ticks |
| `oz-frikandel-blast` (fx) | params `owner`, `r` (48): `holyMayoBlast` on its first tick, the burst, a warm light |
| `oz-mayo-splat` (fx) | the splash when the mayo takes a hit |

### Statuses (`characters/snack-power.ts`)

- `snack-power`: 1,200 ticks (Patrick 1,800), `fireRate: 1.5`, one hit absorbed (crushers still
  kill; 60 invulnerable ticks, `oz-mayo-splat`, `SPLAT!`), a warm tint pulse, the HUD icon
  `ui/icon-oz-meal` with a countdown ring (no bar). `eatMeal(p)`, `snackTicks(p)`, `splatReady(p)`.
- `snack-frikandel` (`OZ_STATUS_FRIKANDEL`): `bomb` = the frikandel, 2 throws (`frikandelsLeft(p)`);
  the HUD bomb slot shows `ui/icon-oz-frikandel xN`; then the grenades are back.
- Both `carry: true` (they survive a section change) and end with a death (a continue gives no new meal).

### The soul contract (POSSESSED and wave B implement it; duck-typed)

```ts
interface SoulHost { ejectSoul(cause: SoulEjectCause): boolean }   // drive the soul out NOW, score for cause.owner; false = no soul
interface SoulEjectCause { owner: number; weapon: string /* 'oz-frikandel' */; source: Entity | null; x: number; y: number }
holyMayoBlast(world, x, y, owner = -1, r = 48, source = null): number   // items/index.ts
```

The possessed hosts implement it (`PossessedHost.ejectSoul(cause)`: the soul out at once, credited
to `cause.owner`, pushed away from the blast; false when no soul is left). The blast calls
`ejectSoul` on every live entity that has it within r, kills the free souls (type
`oz-soul`: `world.damage`, kind 'explosion', weapon `oz-frikandel`), removes ghost shots
(`oz-ghost-shot`) and hurts nobody else.

### Engine opt-ins (additive, off by default; all identity sims unchanged)

- `StatusEffectDef.fireRate` → `StatusEffects.fireRate` → `Gun.rate` (weapons.ts: the cooldown and
  the hold-repeat shrink by it; `rate === 1` keeps the old code path).
- `StatusEffectDef.bomb: StatusBomb { weapon, icon?, left(p), onThrow(p) }` → `StatusEffects.bomb`;
  `Player.updateArms` / `throwBomb` use it instead of the slot's bombs while `left(p) > 0`.
- `StatusEffectDef.iconFrame(p, ticksLeft)` and `hudBar: false` (hud.ts status slot).
- `StatusEffectDef.carry` (status.ts: a per-slot WeakMap; the next section's Player picks it up).
- The rig (FIX, additive; no existing sprite changes): `Expression` `'smile'` (open eyes as
  `normal`, the `happy` mouth and brow; at 1×, 2× and 4×) for Meneer Wu (spec §4.2: never the
  closed `happy` squint), and `Build` `'brute'` (thigh 8, shin 7, torso 12, wide shoulders: about
  40 px tall) for the brute looks (butcher, bouncer).
- hud.ts: the bomb slot shows a status' bomb icon and count while it has throws left.
