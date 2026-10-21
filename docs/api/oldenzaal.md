# Mission `oldenzaal` — the API of the waves

Level 4, `MISSION 4` "A HAUNTING IN OTOWN" (spec: `docs/design/oldenzaal.md`, sections 0–16).
This file is the contract between the builders of wave A (CORE, LIGHT, TOWN, POSSESSED, WUGHOST,
AUDIO, then INTEGRATE, REVIEW, FIX) and wave B (PREP, then ZOMBIES, RUIN, STATUE, CHURCH, TOWER,
then INTEGRATE, REVIEW, FIX).

**Part R2 (revision 2, wave B) comes first and wins** over the wave-A parts (§1 … §12) below it,
which stay as the record of what wave A built. Wave B is DONE (2026-10-21): INTEGRATE switched
oz-a / oz-b to the dead soldiers and REMOVED the possessed, the souls, the townspeople and the roof
ghost (§11 and the soul contract in §12 below are history only).

`oldenzaal` is a normal `defineMission` 2D mission on the **unchanged** `MissionRunner`. New
engine features are **additive opt-ins** (off by default): ams (lower / upper), m0, m2, the ring
(god seeds 1–5, 2P seed 1) and the fps floors 1 / 2 keep their sims byte-identical, and every
existing sprite id keeps its pixels at 1×, 2× and 4×.

## R2. Revision 2 (wave B; the user's feedback after playing wave A, spec §0 R2-1 … R2-12)

In short: real, high-fidelity **Nazi zombies that are tanks** (grunt, rifleman, MG gunner,
crawler; four entrances), an **abandoned, worn-down** Oldenzaal (only De Smulhoek is open), **no
more ghosts** (no souls, no possession, no townspeople; Mevrouw Winkel once, on the square, where
she wakes the statue), the **church interior** before the tower (the nave, the crypt), St.
Plechelmus as a **2-phase mini-boss**. The mood: spooky, dark and grim (dusk → night → candle
light → storm); heroes and pickups stay readable.

### R2.0 Rules that changed (docs/ORIGINALITY.md, the oldenzaal exception, revision 2)

- **Nazi symbols, this mission ONLY:** a red **swastika armband** on the zombies' **left upper
  arm**, and a **few torn, rotten swastika banners** in the town (RUIN). **Nothing else:** no SS
  runes, no eagle, no slogans, no real units or names, no other badges (collar tabs and shoulder
  straps plain); on the villains only, never in a positive light; no Holocaust imagery. Never in a
  menu, card, HUD, icon or the title. (This replaces wave A's "no Nazi symbol" rule in §8 below.)
- **Bloodless:** no red blood; rot, dust, cloth, bones. No hero transformation, no vomit attack,
  no cure item; no laughing or pointing at a player's death, no mass scream.
- **The church:** a real Catholic church (crucifix, altar, saints, Mary, the Stations of the
  Cross, confessionals, votive candles, the red sanctuary lamp); nothing mocked, broken or burned
  on purpose; shots never damage the altar, the crucifix, statues or images; no zombie wears a
  church vestment; the saint is a victim and is freed.
- **Meneer Wu** and **Mevrouw Winkel**: as in §8 below (no stereotype; fictional). Real names
  only as in §8. The reference photos: likeness only, never in `src/`, `public/`, `docs/`, `tests/`.
- Art: 1× + 2× / 4× from ONE density-generic drawer per id (`PAL_HD`, `PAL_HD_OZ`,
  `PAL_HD_OZ_R2`); geometry is law; outline A for what moves / can be hit / picked up; backgrounds
  without ink; static decor outline C; `defer: true` for rare strips; our own lettering; the 4×
  fidelity of the ams / ring art (5–6 tones per lit material, form shading, texture and wear).

### R2.1 Sections (six; `OZ_SECTIONS`)

| Section | Place | Size, checkpoints | Scroll | Light (`defineSectionLight`) | Song / ambience | Exit | Owner |
|---|---|---|---|---|---|---|---|
| `oz-a` | the drop, the abandoned shopping street | 3,072 × 216; 1,024, 2,048; locks [600, 1100], [1380, 1960], [2440, 3040] | right | dusk 0.4 → 0.44 → 0.48, fog | theme / street | → oz-b | RUIN (art, layout), INTEGRATE (script) |
| `oz-b` | De Smulhoek, Meneer Wu | 1,792 × 216; 896; locks [80, 520], Wu's corner, [1200, 1768] | right | late dusk 0.48 → 0.52, fog | theme (rises after the meal) / street | → oz-c | RUIN, WUGHOST (scene), INTEGRATE (script) |
| `oz-c` | Plechelmusplein: the wake, the mini-boss | 1,088 × 216; arena [704, 1088] | right | night 0.55, moon | theme; `oldenzaal-boss` in the fight / street | the red doors `oz-c-doors` → oz-d (on after the fight) | STATUE |
| `oz-d` | the nave | 1,664 × 216; 560, 1,120; three locks | right | candles 0.6, lightning | theme / nave | the crypt stair → oz-e | CHURCH |
| `oz-e` | the crypt | 1,536 × 216; 640, 1,120; the gate lock | right | almost dark 0.66, no rain, no lightning | theme / nave | the tower stair → oz-f | CHURCH |
| `oz-f` | the tower, the tide, the bells, the jet Swan | 384 × 1,800; y 1,200, 600 | **up** (y eviction) | storm; rain 0.35 inside, 0.9 on the roof | `oldenzaal-tower` / storm | the finale: `ctx.missionComplete()` (the top rect is a disabled fallback) | TOWER |

- `?mission=oldenzaal&section=oz-a … oz-f` works; `&boss=1` starts at oz-c. The m5 trap stays
  fixed (flow.ts; `OLDENZAAL.next` is undefined).
- Wave A's placeholders are gone (INTEGRATE): `OZ_C_W`, `OZ_D_W`, `OZ_E_*`, `ozELedgeY`,
  `terrainOzC/D/E` (terrain.ts) and `BG_OZ_C/D/E` (backgrounds.ts). Each section has its own
  terrain and background now (art-square.ts, church/layout.ts, section-oz-f.ts).
- Sections keep their rules (the mission tests): checkpoints ≤ 1,400 px apart, `playerStart` on
  the floor, exits inside, the bot finishes every section (vertical: goals > 20 px up).

### R2.2 Files and owners (wave B)

| Files | Owner |
|---|---|
| `missions/oldenzaal/{index,ids,lines,helpers}.ts`, the section stubs, `src/engine/palette-hd.ts` (`PAL_HD_OZ_R2`), `docs/ORIGINALITY.md` (the oldenzaal exception), this file, `tests/content/mission-oldenzaal.test.ts`, `tests/game/oldenzaal-flow.test.ts`, `tests/content/oldenzaal-zombie-api.test.ts` | PREP → INTEGRATE |
| `content/oldenzaal/zombies/` (`api.ts` THE CONTRACT: names and signatures stay; `numbers.ts`, `placeholder.ts` → the real zombies, `index.ts`, `art.ts`); the frikandel explosion (R2-11) | ZOMBIES |
| `content/oldenzaal/ruin/` (`index.ts`, `art.ts`: PREP's empty stubs, manifest entries `oldenzaal/ruin`, `oldenzaal/ruin/art`); the oz-a / oz-b town art (TOWN's wave-A files) as the lead's task says | RUIN |
| `content/bosses/oldenzaal/` (`index.ts`: PREP's empty stub, manifest entry `bosses/oldenzaal`), `section-oz-c.ts`; Meneer Wu's hair; the TO BE CONTINUED face (`ToBeContinuedScene.drawExtra`) | STATUE |
| `content/oldenzaal/church/` (`index.ts`, `art.ts`: stubs, manifest `oldenzaal/church`, `oldenzaal/church/art`), `section-oz-d.ts`, `section-oz-e.ts` | CHURCH |
| `content/oldenzaal/tower/` (`index.ts`, `art.ts`: stubs, manifest `oldenzaal/tower`, `oldenzaal/tower/art`), `section-oz-f.ts` | TOWER |

The manifest (`src/game/content/index.ts`) already lists every new folder: no builder needs a new
entry for these. **Sprites go in `art.ts` modules** (or `bosses/…` / `missions/…` entries): the
sprites tool loads only those. A builder who needs another entry asks INTEGRATE.

### R2.3 Ids (`ids.ts`)

| Table | Ids | Owner |
|---|---|---|
| `OZ_SECTION` | `a … f` = `'oz-a' … 'oz-f'` | PREP |
| `OZ_ZOMBIES` | `grunt` `oz-grunt`, `rifleman` `oz-rifleman`, `gunner` **`oz-mg`** (the id `oz-gunner` was the removed wave-A possessed gunner; never reused), `crawler` `oz-crawler`; shots `oz-rifleman-shot`, `oz-mg-shot` (`Enemy.shoot` names a shot `<type>-shot`); fx `oz-rise`, `oz-bones`, `oz-helmet` | ZOMBIES |
| `OZ_ZOMBIE_TAG` | `'oz-zombie'` (every dead soldier) | ZOMBIES |
| `OZ_RUIN` | `oz-boarded` (door / window), `oz-manhole` | RUIN |
| `OZ_STATUE` | `oz-plechelmus` (the mini-boss), `oz-plechelmus-stone`, `oz-plechelmus-bit`, `oz-plechelmus-wave` | STATUE |
| `OZ_CHURCH` | `oz-slab` (grave slab), `oz-tomb` | CHURCH |
| `OZ_TOWER` | `oz-tide`, `oz-bell`, `oz-swan-jet` | TOWER |

Sprite prefixes `OZ_SPRITES` (never overlapping; all in the mission's 1× `art`):
`zombies` `enemy/oz-grunt/`, `enemy/oz-rifleman/`, `enemy/oz-mg/`, `enemy/oz-crawler/`,
`enemy/oz-zshot/`, `fx/oz/zombie/` · `ruin` `decor/oz-ruin/`, `prop/oz-boarded/`, `prop/oz-manhole/`
(+ TOWN's `decor/oz/` for the town art) · `statue` `boss/oz-plechelmus/`, `fx/oz/statue/`,
`decor/oz-square/`, `ui/oz-tbc/` · `church` `decor/oz-nave/`, `decor/oz-crypt/`, `prop/oz-slab/`,
`prop/oz-tomb/`, `fx/oz/church/` · `tower` `decor/oz-tower/`, `enemy/oz-tide/`, `prop/oz-bell/`,
`vehicle/oz-swan-jet/`, `fx/oz/tower/`. Background generators and terrain materials: `oz-` plus
the owner's word (`oz-nave-…`, `oz-crypt-…`, `oz-tower-…`, `oz-square-…`, `oz-ruin-…`).

Sfx prefixes `OZ_SFX`: `oz/zombie/` ZOMBIES, `oz/ruin/` RUIN, `oz/statue/` STATUE (Winkel's
`oz/ghost/` recipes are WUGHOST's), `oz/church/` CHURCH, `oz/tower/` and `oz/swan/` TOWER; `oz/env/`
stays AUDIO's (thunder, rain, wind, bells, doors, candles, the ambience loops). Every owner
registers its synth recipes (`defineSfx`) and adds its ids to `tools/audio/spec.ts` (or asks
INTEGRATE): `tests/tools/audio-spec.test.ts` fails for a registered `oz/` id the spec does not
list. **No audio generation** in wave B (synth only).

Songs (unchanged): `oldenzaal` (oz-a … oz-e), `oldenzaal-boss` (the mini-boss), `oldenzaal-tower`
(oz-f), `oldenzaal-tbc`. Ambience: street (oz-a … oz-c), nave (oz-d, oz-e), storm (oz-f).

### R2.4 THE ZOMBIE API (`content/oldenzaal/zombies/api.ts`)

```ts
import { spawnZombie, marchColumn, … } from '../../oldenzaal/zombies/api';   // from a section file
type ZombieKind = 'grunt' | 'rifleman' | 'gunner' | 'crawler'
type EntranceKind = 'walk' | 'rise' | 'burst' | 'manhole' | 'march'
interface ZombieEntrance { kind; target?: Entity | null /* a ZombieOpening */; surface?: 'pavers' | 'earth' | 'slab' | 'tomb';
  delay?: number; slot?: number /* march */; breakAt?: number /* march */ }
interface ZombieSpawnOpts { tag?; hp?; drop?; facing?: 1 | -1; hold? /* rifleman / gunner */; params? }

spawnZombie(at: SectionContext | World, kind, x, y: number | 'ground', entrance: ZombieEntrance | EntranceKind = 'walk', o?): ZombieEntity
marchColumn(ctx, kinds: readonly ZombieKind[], o?: { from?: 'left' | 'right' /* 'right' */; x?; spacing? /* 26 */; tag?; breakAt? /* 150 */ }): ZombieEntity[]
isZombie(e): e is ZombieEntity      zombiesAlive(world, tag?): number      zombieKindOf(id)
staggerZombiesInArea(world, x, y, r, ticks = ZOMBIE_STAGGER /* 36 */): number   // a bell's toll, the statue's slam
clearRiseX(world, x, y): number     heroNear(world, x, y): number               // the spot rules
ZOMBIE_ID (kind → id), ZOMBIE_KINDS, ENTRANCE_KINDS, ENTRANCE { minTell 18, grace 18, clear 40, maxShift 96 }, MARCH { spacing 26, breakAt 150, speed 0.32 }

interface Zombie {                      // what every dead soldier exposes (ZombieEntity = Entity & Zombie)
  readonly zombieKind: ZombieKind
  readonly entering: boolean            // hidden, telling, climbing out or marching: no attacks
  readonly hidden: boolean              // fully under the ground / cover / behind the boards: no hurt boxes, not drawn
  stagger(ticks, dirX): void            // a heavy stagger (grenade, knife, blast, bell)
  blast(cause: ZombieBlastCause): boolean   // { owner, damage, x, y, weapon?, stagger? }: damage + stagger (the frikandel, R2-11)
}
```

- The entity params (also usable with `ctx.spawn(ZOMBIE_ID.grunt, x, y, params)`): `entrance`,
  `target`, `surface`, `delay`, `slot`, `breakAt`, `hold`, plus the Enemy params `hp`, `drop`,
  `tag`, `facing`.
- **Tell rules** (the implementation keeps them; `tests/content/oldenzaal-zombie-api.test.ts`
  checks them on whatever implementation is behind the API): every entrance shows a tell of
  ≥ 18 ticks; no attack during the entrance nor for `ENTRANCE.grace` after; invulnerable ONLY while
  `hidden` (from the first visible frame it can be hit); never on top of a hero (a 'rise' spot
  moves ≥ 40 px away, at most 96; a fixed opening waits until no hero is within 40 px); attacks
  only on screen with tells ≥ 18; attack tokens. Bloodless: dust, cloth, rot, bones; no red.
- **What a section provides**: 'walk' / 'march' a floor and room to walk in; 'rise' a floor at x
  (or a `target` slab / tomb opening); 'manhole' an `oz-manhole` `target` (or a bare x: the
  zombie's own fx); 'burst' an `oz-boarded` `target` (without one it staggers out of a dust cloud:
  a fallback, never the plan). Place rises and openings where the heroes can see the tell.
- A zombie spawned this tick joins the tag index (`world.byTag`, `zombiesAlive`, `waitClear`,
  `staggerZombiesInArea`) on the next tick (the engine's rule for every entity).
- The wave tag: `spawnZombie(…, { tag: 'oz-d1' })`, then `yield ctx.waitClear('oz-d1')` or
  INTEGRATE's `waitArena(ctx, tag)`. Every zombie also carries `OZ_ZOMBIE_TAG`.
- PREP's placeholder and its `ejectSoul` bridge are gone: ZOMBIES' dead soldiers implement the
  API (R2.Z); the frikandel's explosion is `frikandelExplosion` (R2-11).

### R2.5 The opening contract (`ZombieOpening`, zombies/api.ts)

RUIN implements `oz-boarded` (a boarded door or shop window) and `oz-manhole`; CHURCH `oz-slab`
(a grave slab) and `oz-tomb`. ZOMBIES' entrances call them. Duck-typed: the tag
`OZ_OPENING_TAG = 'oz-opening'` plus:

```ts
interface ZombieOpening {
  readonly openingKind: 'door' | 'window' | 'manhole' | 'slab' | 'tomb'
  readonly spotX: number; readonly floorY: number   // where the zombie's feet appear (the floor in front of a door / window)
  readonly outDir: -1 | 0 | 1                        // the way a zombie faces as it comes out (0 = any)
  readonly closed: boolean                          // false after open()
  busy: boolean                                     // reserved by a zombie that is coming out (the zombie sets / clears it)
  tell(ticks: number): void                         // the tell (≥ 18): planks bang, the cover rattles, the slab cracks, the lid grinds; sfx + dust are the owner's
  open(dirX: -1 | 0 | 1): void                      // NOW, idempotent: planks and glass fly and the frame stays broken / the cover slides away / the slab breaks / the lid slides off
}
isOpening(e): e is ZombieOpeningEntity     type Boarded = ZombieOpening & { openingKind: 'door' | 'window' }
```

- The opening is a static, neutral entity (never an enemy; no hurt boxes unless its owner wants
  shots to rattle it). A broken opening stays broken (`closed` false): no second zombie uses it
  unless its owner allows it (`spawnZombie` does not check `closed`; scripts pick closed ones).
- RUIN places them from layout constants (terrain.ts `OZ_A_OPENINGS`, `OZ_B_OPENINGS`) and the
  finders below; CHURCH places its slabs and tombs in oz-d / oz-e.

RUIN's API (`content/oldenzaal/ruin/index.ts`):

```ts
placeRuin(at: SectionContext | World, defs: readonly RuinOpeningDef[]): RuinOpeningEntity[]
withRuin(defs, script): SectionScript               // the section's `script`: places the openings, then runs the script
ruinOpenings(world, kind?: 'door' | 'window' | 'manhole', closedOnly = true): RuinOpeningEntity[]
openingNear(world, x, kind?, maxDx = Infinity): RuinOpeningEntity | null   // the closed, free one nearest x
ruinSpotX(def): number;  OZ_RUIN_ART  // ['prop/oz-boarded/', 'prop/oz-manhole/']
RuinOpeningDef { kind: 'door' | 'window' | 'manhole'; x; y; w?; outDir? }
```

Layout constants for the scripts (terrain.ts): `OZ_A_RISE` / `OZ_B_RISE` (clear paver spots to
rise from), `OZ_A_MARCH` / `OZ_B_MARCH` (the far end), `OZ_A_ARENAS`, `OZ_B_ARENAS`, `OZ_A_CARS`
(the car roofs are one-way platforms), `OZ_A_WALLS` / `OZ_B_WALLS` (16-px garden walls).

### R2.6 Mevrouw Winkel for the wake scene (WUGHOST's `oz-winkel`, npcs/index.ts; enough as is)

```ts
const w = ctx.spawn(OZ_WUGHOST.winkel, x, y, { facing: -1 }) as OzWinkel;   // invisible at first
w.appear(45); w.raiseLantern(); w.say(WINKEL_WAKE_LINES[i], 150);           // speaker 'winkel', voiced
w.laugh(); w.whisper(); w.glideTo(x, y, speed?, then?); w.glidePath(points, speed?, then?)
w.possessInto(statueHeadX, statueHeadY, 3.2);   // dives in; on arrival `possessed` = true and she is removed
// the end: torn out of the stone
const g = ctx.spawn(OZ_WUGHOST.winkel, headX, headY, { visible: true, facing: 1 }) as OzWinkel;
g.shriek(50); g.flee(220, 2.6);                 // flees with a shriek and vanishes on arrival (not seen again)
```

She is never a target (no hurt boxes, team neutral) and is a light (`LIGHT_TAG`, her lantern).
`winkelAppear` (the wave-A roof moment) and `WINKEL_LINES.roof` are removed (INTEGRATE). The
TO BE CONTINUED face: STATUE fills `ToBeContinuedScene.drawExtra(r)` (scenes/to-be-continued.ts).

### R2.7 Lines (`lines.ts`, revision 2)

- `STORY_CARD_LINES` (5): the ring is clean; a call from Oldenzaal; a ghost was seen, now the dead
  of the old war walk; the town has fled; the chutes open over the dark roofs.
- `WU_LINES` (6): the dead soldiers climb out since Mevrouw Winkel's ghost came back; the town
  fled, he stays, the fryer is still hot; `IK SLUIT PAS OM TIEN UUR.`; the meal. No souls, no
  possession (spec §4.2 rules).
- `WINKEL_LINES` `wake`, `call`, `statue` (= `WINKEL_WAKE_LINES`, in order) and `flee`;
  `PLECHELMUS_LINES` `wake` (`ZO... ZWAAR...`), `step` (`VERGEEF MIJ...`), `freed`
  (`DANK U, KINDEREN.`); `PLAQUE_TEXT`, `STATUE_BOSS_NAME`; `RUIN_NOTES` (`GESLOTEN`,
  `NIET BETREDEN`).
- Removed: Winkel's `doors`, `tower` and `roof` lines; the townspeople's `FREED_LINES` /
  `FRIGHT_LINES`. `voicedLines()` lists only revision-2 lines (all in `tools/audio/spec.ts`).
- Bubbles ≤ 24 characters × 2 lines; story lines ≤ 352 px (small font).

### R2.8 Palette (`PAL_HD_OZ_R2`, src/engine/palette-hd.ts)

`rot` (8: rotting skin, olive-black → grey-green → yellowed → bone), `fieldGrey` (7: WW2 wool),
`rust` (= `PAL_HD.rust`), `soot` (6: burnt → ash). Only 9 new colours (`HD_OZ_R2_NEW`); the rest
are `PAL_HD` colours. Additive: `HD_PALETTE` (209), `HD_OZ_PALETTE` (37) and `HD_FULL_PALETTE`
(246) are unchanged, so no existing nearest-colour search (and no wave-A oldenzaal `mx` snap)
changes a pixel; `HD_R2_FULL_PALETTE` (255 of 256) is everything; `inHdPalette` accepts the new
colours. Use the ramps by name. One slot is left in the 256.

### R2.9 What went (DONE, INTEGRATE, wave B)

- `content/oldenzaal/possessed/` (hosts, souls, eject, townspeople, ghost shot), its manifest
  entries, `OZ_POSSESSED`, `OZ_SPRITES.possessed`, `OZ_SFX.possessed`, `OZ_WAVE_B`,
  `content/sfx/oldenzaal-possessed.ts`, `tests/content/oldenzaal-possessed.test.ts`.
- The roof ghost in oz-a (`winkelAppear`, `OZ_A_WINKEL_ROOF`, `WINKEL_LINES.roof`), the
  townsfolk / drain-soul / chimney-soul helpers and `OZ_STREET_ART` (script-kit.ts),
  `OZ_A_SPOTS.chimneys`, `FREED_LINES`, `FRIGHT_LINES`.
- The soul contract of the frikandel blast (`SoulHost`, `isSoulHost`, `SoulEjectCause`,
  `FRIKANDEL.soulDamage`; `OzFrikandelBlast.souls` is now `hits`), and PREP's `ejectSoul` bridge.
- The audio spec's 17 `oz/possessed/*` sfx and the wave-A Wu / Winkel lines.

### R2.10 Tests and gates

- `tests/content/mission-oldenzaal.test.ts` (six sections, the crypt, the tower, the ids, the
  lines of revision 2, `PAL_HD_OZ_R2`, the bot 1P / 2P god through oz-a … oz-f, direct starts at
  oz-b … oz-f), `tests/game/oldenzaal-flow.test.ts` (+ `section=oz-f`, the boot art has the
  revision-2 prefixes), `tests/content/oldenzaal-zombie-api.test.ts` (the contract).
- Fixtures: `tests/art/fixtures/scenery-1x.json` keys `oldenzaal/oz-e/*` change (oz-e is the crypt
  now) and `oldenzaal/oz-f/*` are new: the fixer regenerates them (`UPDATE_SCENERY_FIXTURE=1`).
- Identity sims as in §9 below (all 12 unchanged after PREP).

### R2.11 STATUE: oz-c, the mini-boss St. Plechelmus, the TO BE CONTINUED card (wave B, STATUE)

Files: `content/bosses/oldenzaal/` (`geometry.ts` the numbers, `art.ts` the statue / crozier /
plinth / shots / fx, `tbc-art.ts` the card's art, `shots.ts`, `statue.ts`, `sfx.ts`, `index.ts`),
`missions/oldenzaal/art-square.ts` (layout, decor, backdrop, the doors), `script-oz-c.ts`,
`section-oz-c.ts`; `npcs/art.ts` (Meneer Wu's hair); `scenes/to-be-continued.ts` (`drawExtra`).

**The square (oz-c, 1,088 × 216, `OZ_C_W2`).** The approach x 0 … `ARENA_L` (704; a few zombies:
two rises, a walk-in, a crawler, a march pair, tag `oz-c1`, `waitArena`), the camera-lock arena
`ARENA_L … ARENA_R` (one view), the plinth's foot at `STATUE_X` (972), the doors at `DOOR_X` (1,046).
The backdrop `BG_OZ_C_SQUARE`: the night sky with the moon, the far town, and TOWN's `oz-basilica`
NEAR (s 7, `factorX: 1`, `offsetX: BASILICA_OFFSET`, so its red doors sit at `DOOR_X`; its tower
rises at the arena's left). Decor: TOWN's lamps (two of four burning), benches, a bin, bollards,
our `decor/oz-square/litter` (5) and `cracks` (3). Light `OZ_C_LIGHT`: darkness 0.55, the burning
lamps, the moonlight on the statue, fog. Checkpoint `ARENA_L + 40`; `bossStart` `ARENA_L + 48`
(`?boss=1` skips the approach). Exit `oz-c-doors` (`OZ_C_EXIT_ID`, disabled until the end) → oz-d.

**The doors.** `oz-square-doors` (`SquareDoors`, category 'prop', not in ids.ts): an overlay on the
backdrop's doors (`decor/oz-square/doors`, frame 0 draws nothing): `open()` — they creak open
(`oz/statue/doors`) over ~42 ticks, the nave's candle gloom lights the doorway (a LightSource).
`squareDoors(spawn)` places it.

**The boss `oz-plechelmus` (`Plechelmus extends Boss`).** Spawn at the plinth's foot on the floor.
```ts
const s = ctx.spawn(OZ_STATUE.boss, STATUE_X, G) as Plechelmus;   // dormant decor (neutral, not shootable)
s.armDecor();      // at the lock: shootable, shots chip dust and take nothing
s.awaken();        // after Winkel's dive: the intro (cracks, eyes, 'ZO... ZWAAR...', the bar fills), then the fight
yield () => s.defeated;   // the freed end has run: he sits on his plinth, whole (the boss stays, removeOnDeath false)
s.attacks          // AttackRecord[] { kind: 'sweep'|'throw'|'slam'|'hook', tell, onScreen, tick } (tests)
s.hooked / s.letGo(free) / s.crozierHead(out) / s.eyeX() / s.eyeY() / s.speak(text, ticks)  // speaker 'plechelmus'
```
- HP 3,000 (× difficulty × co-op; tuned with the bot: normal 44–52 s, hard 76 s; `hpScale` param for tests), pool model; parts `body`, `head`
  (× 1 seated, × 1.3 on foot), `crozier` (phase 2 only; 260 HP, shared). 5,000 points.
- Phase 1 SEATED (100 → 55 %): `sweep()` (glow + swing back, tell 30 → a low wave `oz-plechelmus-wave`
  `low` from the plinth's foot to the left, plus a short impact box), `throwStone()` (reach 14 +
  lift tell 34 → `oz-plechelmus-stone` lobbed at a hero; it shatters into 3 bits (HARD 4) on the
  floor, on a hero or when shot down: 24 HP, 50 points). Each throw tears a block off the plinth
  (`missing`, up to 3; whole again at the end).
- Phase 2 ON FOOT (55 → 0 %): `stepDown()` (invulnerable, `VERGEEF MIJ...`), then walks at the
  nearest hero (0.45 px/tick, inside the locked view) and alternates `groundSlam()` (tell 32 → the
  blow's box + waves both ways; HARD a second pair) and `hook()` (tell 30 → the head flies out at
  chest height (~27 px over the floor: crouch under it), 6 px/tick, reach 168; a caught hero is
  pulled in at 1.7 px/tick; FREE by jumping or by 36 damage on the crozier head (or the crozier
  broken); pulled all the way in, he is struck). A far hero draws the hook.
- Tells via `telegraphFor` (≥ 18), the arena keeps him on screen; contact damage on foot only.
  Stagger: `cutAttack` lets the hero go, the crozier comes back; not while stepping.
- THE END (`deathSequence`, ~6 s): the stone shakes, Mevrouw Winkel is torn out (`oz-winkel`
  spawned visible at his eyes: `shriek`, `THIS IS NOT OVER...`, then `flee` up-right and gone), the
  cracks close (`oz/statue/heal`), he walks back, climbs up, sits down (`oz/statue/sit`), the plinth
  whole, eyes dark, `DANK U, KINDEREN.` Then 'bossDefeated'. The script drops a weapon (`S`),
  calms the music, opens the doors, enables the exit, unlocks the camera.
- Sfx (`OZ_STATUE_SFX`, spread into SFX): `oz/statue/` crack, tell, sweep, wrench, throw, shatter,
  bit, step, slam, hook, caught, free, break, chip, tear, heal, sit, doors. Winkel's own sounds stay
  `oz/ghost/` (WUGHOST).
- Sprites: `boss/oz-plechelmus/` sit (7), stand (10), crozier / crozier-broken (12 angles,
  anchored at the grip), fist, shaft, plinth (4), stone (4), bit (3), wave (4), sweep (4);
  `fx/oz/statue/` crack (3), eyes (2), glow; `decor/oz-square/` litter, cracks, doors;
  `ui/oz-tbc/` face (2), jet (2), glow. All 1× / 2× / 4× from one drawer (HdCanvas at d 1, 2, 4).

**Mevrouw Winkel's wake** (script-oz-c.ts `wake`): appears beside the plinth (`WINKEL_AT`), raises
the lantern, says `WINKEL_WAKE_LINES` (3 bubbles, `WAKE.line` ticks each), laughs, a lightning
flash, `possessInto` the statue's eyes, then `statue.awaken()` and `bossIntro(STATUE_BOSS_NAME,
{ subtitle: 'MINI-BOSS', music: OZ_SONG.boss })`. The npcs API was enough (no change).

**Meneer Wu** (`npcs/art.ts`): `WU_STYLE.hairStyle 'short'` (straight), a blue-black ramp, and
`greyTemples` greys the hair above the ear (salt and pepper; one grey px at 1×). Nothing else.

**TO BE CONTINUED** (`to-be-continued.ts`): `TBC_TRAIL` — the Swan's jet trail streaks across the
night sky (ticks 10 … 160, then fades); `TBC_FACE` — Mevrouw Winkel's face fades in above the title
(`drawGhost`, alpha 0.45) from tick 60 and laughs once at 130 (`oz/ghost/laugh`, frame 1). Still
skippable after `TBC_SKIP_AFTER`.

### R2.12 TOWER: oz-f, the tower climb, the horde tide, the bells and the jet Swan (wave B, TOWER)

Spec §8, §9. This section supersedes the oz-f row of R2.1 where they differ (the ledges, the
exit, the light).

**Files** (TOWER): `content/oldenzaal/tower/` — `layout.ts` (numbers), `tide.ts`, `bell.ts`,
`swan-jet.ts`, `index.ts` (registers the 3 entities), `art.ts` (exports `TOWER_ART`,
`BG_OZ_TOWER`, `TOWER_FRAME_Y`, the id lists), `art-kit.ts`, `art-entities.ts`, `art-scene.ts`;
`missions/oldenzaal/section-oz-f.ts`, `script-oz-f.ts`; `content/sfx/oldenzaal-tower.ts`
(spread into `SFX`); `tests/content/oldenzaal-tower.test.ts`.

**Layout** (`layout.ts`): `TOWER { w 384, h 1800, floor 1776, wall 24, ledges 45, step 36,
ledgeW 176, roofY 120, parapetY 104 }`, `ledgeY(k) = 1776 − 36k`, `ledgeX(k)` (odd k left
24–200, even k right 184–360: every landing covers the climb column x 184–200). The roof is a
one-way floor at y 120 (= `ledgeY(46)`); above y 104 only the parapet. `section-oz-f.ts` keeps
`OZ_F_W/H`, `OZ_F_FLOOR`, `OZ_F_LEDGES` (now 45), `ozFLedgeY` (= `ledgeY`), `terrainOzF()`,
`OZ_F_LIGHT`; the exit `top` over the roof is DISABLED (a fallback): the finale completes the mission.

| y | zone |
|---|---|
| 1,776 … 1,330 | the foot: the door from the crypt stair, the first stairs, lanterns |
| 1,330 … 900 | the clock works (`decor/oz-tower/clock`, the pendulum) |
| 900 … 430 | the shaft: crossed braces, bell ropes |
| 430 … 120 | the bell chamber: the oak frame, louvres, 2 small bells |
| 120 … 0 | the roof: the spire with its clock, the big bell in the open lantern |

**`oz-tide`** (`Tide`; params `startY`, `speed`, `lag`, `stopY`): a terrain `'kill'` hazard
under `top`; rises `TIDE.speed` (0.4) px / tick; never more than `TIDE.lag` (−6: its heads are
always in view at the bottom) below the view's bottom; `hold(ticks)` (the script: 120 at the
checkpoint y 600); a hero's death (`playerDied`) makes it sink to the view's bottom + 16 and hold
200 ticks; it never rises past `stopY` (198, just under landing 44); `lastToll()` makes it recoil
and stop for good (`stopped`). A light source (a cold glow over its edge). Draws the rows of the
dead (`enemy/oz-tide/edge`, `back`, `mass`, `arm`). Started by the script when the view's top
passes `TIDE.startCamY` (1,110: about a third of the way up).

**`oz-bell`** (`Bell`; params `size` 'small' | 'big', `rest`, `phase`, `mode` 'auto' | 'script'):
`state` rest → tell (`BELL.tell` 36 ticks, a creak) → swing (`BELL.swings` × `BELL.period` 76
ticks, ±62°); at each end of a swing the toll (`tolls`++, `oz/env/bell`; the big bell
`oz/tower/toll-last`) stuns the dead within `BELL.stunR` (96; big × 2.5) for `ZOMBIE_STAGGER`.
A swinging bell hits a hero only while it moves toward him (an 'impact' hit, tags heavy + hazard;
god mode ignores it). At rest a small bell's crown is a one-way step. `toll(n)` rings it now.
`BELLS`: two small ones over the outer ends of landings 41 / 42 (off the climb column), the big
one in the lantern (mode 'script'). Art: `prop/oz-bell/{small,big}` (13 angle frames, −60° …
+60°, anchor = the pivot; `defer`), `fx/oz/tower/toll`.

**`oz-swan-jet`** (`SwanJet`, a cosmetic `Mountable`, not a `Vehicle`): spawned at its start
point (the script: view + `SWAN_JET.from…`), mode 'enter' (eases in, 120 ticks, nozzles swing
down) → 'hover' (beside the roof at `SWAN_JET.hover…`, facing left; a hero whose feet reach
`SWAN_JET_RIDE.zone` mounts: P1 in the `seat`, P2 on the tail `perch`) → `leave()` → 'turn'
(she faces right) → 'leave' (up and away; `gone` when out of view). `arrived`, `passengers`,
`canMount`, `mount`, `boardAll(players)`, `allAboard(players)`. Her look is her own
(`vehicle/swan/glide` + `-front` + `neck-relax`); new: `vehicle/oz-swan-jet/unit` (3 nozzle
angles), `fx/oz/tower/jet-flame` (9), `fx/oz/tower/trail` (4). A light source (the jets).
`boardSwan(ctx, swan, patience = 240)`: the pads are taken over (run, jump on); stragglers seated.

**The script** (`scriptOzF`): the bells, the dead on the landings (`OZ_F_POSTS`: riflemen on the
outer ends, a few grunts; `n` NORMAL+, `p2` 2P; staged above the view; tag `OZ_F_TAG` 'oz-f'),
wood creaks, the tide (+ the banner `OZ_F_TEXT.tide`), the checkpoint grace; on the roof
(`onRoof`): `clearTower` (the dead in the tower drop, their shots vanish), the big bell tolls 3 ×
→ `tide.lastToll()`, `OZ_F_TEXT.trapped`, wait ≤ 300 ticks for the other hero, lightning, the Swan,
`boardSwan`, `leave()`, `ctx.missionComplete()`. The rain is 0.35 inside and 0.9 once the view
reaches the roof (`OZ_F_RAIN`; the script sets `OZ_F_LIGHT.rain.density`).

**Art** (`TOWER_SPRITES`, `TOWER_BGS`): layers `oz-tower-storm` (screen-fixed) and `oz-tower-wall`
(world-locked, `repeatY`, tile 384 × 288, its lancets cut out); decor `decor/oz-tower/{top,
landing (3), stair, door, lantern (3), clock, pendulum (8), braces (2), rope, louvre, frame, roof,
wall (3, front over the wall solids), floor (front)}`. 1× PAL + 2× / 4× PAL_HD from one drawer each.

**Sfx** (`OZ_TOWER_SFX`): `oz/tower/tide` (loop), `oz/tower/tide-surge`, `oz/tower/tide-recoil`,
`oz/tower/toll-last`, `oz/tower/creak`, `oz/swan/ignite`, `oz/swan/jet` (loop), `oz/swan/flyby`.
The small bells reuse `oz/env/bell` / `oz/env/bell-creak`.

### R2.C THE CHURCH (CHURCH, wave B: oz-d the nave, oz-e the crypt; spec §7)

Files: `content/oldenzaal/church/` — `layout.ts` (every number, `terrainNave()`, `terrainCrypt()`,
`NAVE_STYLE`, `CRYPT_STYLE`), `decor.ts` (`NAVE_DECOR`, `NAVE_LAMPS`, `CRYPT_DECOR`, `CRYPT_LAMPS`,
`PREDELLA_Y`, `NAVE_STAIRWELL_X`, `decorIds`), `entities.ts`, `kit.ts` (the painter kit: `regC`,
`regCBg`, `ashlar`, `shaft`, `oak`, `lancet`, `flame`, `cobweb`; registries `OZ_CHURCH_SPRITES`,
`OZ_CHURCH_BGS`), `art-nave-arch.ts`, `art-nave-furn.ts`, `art-crypt.ts`, `art-terrain.ts`;
`missions/oldenzaal/section-oz-d.ts`, `section-oz-e.ts`, `script-oz-d.ts`, `script-oz-e.ts`;
sfx `content/sfx/oldenzaal-church.ts` (`OZ_CHURCH_SFX_RECIPES`, spread into SFX).

| Section | Size | Checkpoints | Light | Content |
|---|---|---|---|---|
| `oz-d` the nave | 1,664 × 216, flat floor `oz-nave-floor`, pews = one-way platforms at G − 14 (`oz-pew`) | 560, 1,120 | darkness 0.6, lightning 420–900; lamps: the votive rack, one lit chandelier, the altar candlesticks, the red sanctuary lamp, the chapel's red votive, two moon shafts; the open west doors are a light | locks `NAVE_ARENAS` doors [0, 384] (the doors slam; 2 slab rises + the MG zombie), chapel [528, 912] (a column out of the chapel's grille, in a lightning flash), choir [1,280, 1,664] (slab rises, the dead come up the crypt stair); the organ moans after the chapel; a column marches in under lightning; exit at x ≥ 1,624 → oz-e |
| `oz-e` the crypt | 1,536 × 216, flat floor `oz-crypt-floor`, coffins = one-way platforms at G − 14 | 640, 1,120 | darkness 0.66 (the darkest), no lightning, no rain; lamps: 5 candle groups, 4 lanterns, the nave's glow at the stair, a cold line at the tower door | 8 tombs (`CRYPT_TOMBS`); the chained gate at x 1,016 (a body wall) and the lock [640, 1,024] with two waves; then 3 more tombs; exit at x ≥ 1,496 → oz-f |

Entities (all neutral, no hurt boxes, `onHit` → false: the church is never damaged):

```ts
OZ_CHURCH_ENTITY = { slab: 'oz-slab', tomb: 'oz-tomb', chapelGate: 'oz-chapel-gate', stairwell: 'oz-crypt-stairwell',
                     doors: 'oz-nave-doors', cryptGate: 'oz-crypt-gate', ambient: 'oz-church-ambient' }
OzSlab, OzTomb            // ZombieOpening 'slab' / 'tomb' (spotX = x, floorY = y, outDir 0); one zombie each
OzChapelGate, OzStairwell // ZombieOpening 'door' (outDir −1) that stays open: use 'burst' + delay for a column
OzNaveDoors.slam(); .shut // the set piece (sfx, shake, dust); a cold light while open
OzCryptGate.swingOpen(); .isOpen
ctx.spawn(OZ_CHURCH_ENTITY.ambient, 0, G, { motes: 1, drip: 220 })   // dust motes in view, drips (sound)
placeNave(ctx) → NaveProps, placeCrypt(ctx) → CryptProps   // script-oz-d.ts / script-oz-e.ts
```

- The tomb draws in front of its zombie while the zombie is `busy` (+ 8 ticks): the dead climb out
  of the chest. The slab's tell cracks it (frames 1–2), `open()` breaks it (frame 3, stone debris).
- RESPECT: the altar, the crucifix, the saints, Mary, the Stations, the pulpit, the font, the
  candles and the sanctuary lamp are decor (`NAVE_DECOR`), never entities, so nothing can hit
  them; the zombies come from the graves, the chapel of the dead and the crypt, never from the
  altar, the pulpit or a statue; no vestments; no real church's artwork (our own drawings).
- Sprites (prefixes `OZ_SPRITES.church`): `decor/oz-nave/{pillar, west, apse, chapel, pews, confessional,
  font, pulpit, saint, mary, votive, station, altar, crucifix, candlestick, lamp, chandelier, shaft,
  hymn-board, stand, cobweb, doors, grille}`, `decor/oz-crypt/{vault, coffin, candles, lantern, stair-down,
  stair-up, gate}`, `prop/oz-slab/slab`, `prop/oz-tomb/tomb`; backgrounds `oz-nave-far`, `oz-crypt-far`;
  terrain materials `oz-nave-floor`, `oz-crypt-floor`, `oz-pew`, `oz-nave-step` (1× rows in
  `src/game/art/terrain-art.ts`, additive; `ozFlagAt` is shared by the 1× and HD painters).
- Sfx `oz/church/`: `doors-slam`, `organ-moan`, `candles`, `slab-crack`, `slab-break`, `lid-grind`,
  `lid-fall`, `grille-rattle`, `gate-creak`, `drip` (`OZ_CHURCH_SFX`).
- Tests: `tests/content/oldenzaal-church.test.ts`.

### R2.Z ZOMBIES: the dead soldiers (wave B; owner ZOMBIES)

The real implementation behind THE ZOMBIE API (R2.4): `content/oldenzaal/zombies/` — `api.ts` (the
contract, unchanged), `soldier.ts` (`DeadSoldier`: the four kinds, the entrances, the hold, the
overlays), `numbers.ts` (every tunable), `grab.ts` (the `oz-grabbed` status), `fx.ts` (`oz-bones`,
`oz-helmet`, `oz-rise`), `art.ts` + `art-kit.ts` + `art-head.ts` + `art-gear.ts` (the art), sfx
`content/sfx/oldenzaal-zombies.ts` (`OZ_ZOMBIE_SFX`, ids `oz/zombie/…`). PREP's `placeholder.ts` is gone
(its `ejectSoul` bridge with it).

| Kind (id) | HP (normal, 1P) | Behaviour (all: never run, attack tokens, tells ≥ 18 on screen, attacks only in view) |
|---|---|---|
| grunt (`oz-grunt`) | 110 | shambles in (0.4), winds the trench shovel (set `tunic`) or the rifle swung by its barrel (set `coat`) back over the shoulder (tell 28), swings (16 ticks; the box `GRUNT.swingBox` is live ticks 3–9 only), recovers 34 |
| rifleman (`oz-rifleman`) | 90 | walks until he is on screen and within `hold` 150; raises the rifle (tell 50), ONE slow glowing shot (1.5 px/tick, `oz-rifleman-shot`, sprite `enemy/oz-zshot/rifle`) at 25 px above his feet when the target is on his level (a crouch ducks it, a jump clears it; aimed otherwise), works the bolt (reload 130 ± 30) |
| gunner (`oz-mg`, big: × difficulty / co-op HP) | 260 | walks on screen within `hold` 160, kneels and plants the bipod (40, no attack), lowers the barrel (tell 40), a burst of 7 (every 6 ticks, 2.2 px/tick) sweeping from the target's chest to its knees (a timely jump clears it), cools 110 ± 30; gets up and moves when the target is out of his arc for 150 ticks. Helmet off at 60 % HP, barrel jacket shot off at 30 % (cosmetic; shots still come out) |
| crawler (`oz-crawler`) | 40 | drags itself along in pulls (0.36), rears up (tell 24), grabs (box live 6 ticks): a standing hero's feet are HELD (`oz-grabbed`: speed 0, no jump; shooting works; a `TAP JUMP!` pointer). 4 taps of JUMP / a direction or any hit on the crawler break the hold; held 110 ticks it bites (a 28-tick bite tell first). Low box 18 × 12 |

- Big hits stagger (`STAGGER`): explosion 40, knife 22, ≥ 50 damage in one hit 26; then `immune` 30 ticks
  (no stun-lock). Pistol hits never stagger. Hits knock off dust and chunks (`fx/oz/zombie/chunk`).
- Looks (params, optional): `set` ('tunic' / 'coat': grunts), `head` ('helm-a', 'helm-b', 'cap-a',
  'bare-a', 'bare-b'); default: picked from the entity id and the spawn x (no gameplay rng).
- Entrance effects: 'rise' and 'manhole' without a `target` spawn `oz-rise` (`look` pavers / earth /
  stone / manhole; `surface` 'earth' → earth, 'slab' / 'tomb' → stone) during the tell and break it open
  (`open()`); 'burst' without a target: dust and wood debris. A hero on a spot for `ENTRY.maxWait`
  (600) moves the spot `ENTRANCE.clear + 8` away from the hero (never on top of one; scripts never stall).
- Death: the zombie is removed at once; `oz-bones` (params `art`, `head`, `facing`, `kind`, `broken`,
  `vx`) plays the body set's `die` strip (sag, knees, fold, crumble into the bone pile), the helmet / cap
  rolls away (`oz-helmet`), the pile lies `COLLAPSE.lie` 150 ticks and blinks out. Bloodless.
- Gloat: they stop, sway and groan (`gloat` strip; a planted gunner stays at his gun), no pointing, no
  laughing; cower: a flinch and a step back (`cower`), sfx `oz/zombie/flinch`.
- **The frikandel explosion (R2-11, items/index.ts):** `frikandelExplosion(world, x, y, owner = -1,
  r = 60, source = null): number` (also exported as `holyMayoBlast`): every visible zombie within r
  takes 150 → 80 (centre → edge) and a 50-tick stagger (`Zombie.blast`); wave A's possessed / souls /
  ghost shots as before; nobody else (heroes, neutrals, other enemies: the statue is not a zombie).
  The thrown frikandel also pops on a visible zombie. The fx adds a medium explosion (no damage of its
  own), the cream burst and a bigger light. The meal and snack power are unchanged.
- Art (prefixes `OZ_SPRITES.zombies`): bodies `enemy/oz-grunt/tunic/…`, `enemy/oz-grunt/coat/…`,
  `enemy/oz-rifleman/tunic/…`, `enemy/oz-mg/coat/…`, `enemy/oz-crawler/tunic/…`; heads
  `enemy/oz-grunt/head/<name>` (one frame per tilt), the MG `enemy/oz-mg/gun-carry|gun-plant` (frames =
  `GUN_ANGLES` whole, then broken); shots `enemy/oz-zshot/rifle|mg`; fx `fx/oz/zombie/{eye, chunk, dust,
  helmet, cap, rise-pavers, rise-earth, rise-stone, rise-manhole}`. The heads and the MG are drawn at
  run time over the body (`ZTABLE`: per body frame the head tilt, the floor clip of a rise, the MG pivot /
  angle / planted). `rise`, `gloat`, `cower`, `dust` and `cap` are `defer: true`. About 14 MB of 4×
  bytes in all (the possessed' 14 MB go with possessed/).
- The ONLY symbol (R2-2): the red band on the near (left) upper arm; at 2× / 4× a white disc with the
  black symbol (4×: 5 × 5 art px; 2×: a dark dot); 1× a plain red band. Nothing on helmets, caps, collars
  or chests.
- Tests: `tests/content/oldenzaal-zombies.test.ts` (35), `tests/content/oldenzaal-zombie-api.test.ts`.

### R2.I INTEGRATE: the street scripts, the script kit, the whole mission (wave B)

**The script kit** (`missions/oldenzaal/script-kit.ts`): every entry is ON SCREEN (the tell is
always seen) and never behind a low wall from the heroes.

```ts
zRight(ctx, kind, o?: ZOpts, margin = 16): ZombieEntity    // walks in at the right view edge on the pavement (a wall in the way: from the left)
zLeft(ctx, kind, o?, margin = 16): ZombieEntity
zRise(ctx, kind, x, o?): ZombieEntity       // up through the pavers at the rise spot in view nearest x (OZ_A_RISE / OZ_B_RISE; none: x clamped into the view)
zBurst(ctx, kind, x, o?): ZombieEntity      // out of the closed boarded door / window IN VIEW nearest x (none: a rise)
zManhole(ctx, kind, x, o?): ZombieEntity    // out of the manhole in view nearest x (none: a rise)
zMarch(ctx, kinds, tag?): ZombieEntity[]    // a column out of the fog at the right view edge (marchColumn)
crateAt(ctx, x, contains): Entity          // a crate on the pavement ('M', 'S', …)
weaponDrop(weapon): { id: 'pickup-weapon', params: { weapon } }   // an enemy's `drop`
ZOpts { tag?; drop?; delay? }
waitArena(ctx, tag): ScriptGen              // waits 2 ticks (the tag index), then until the tag is cleared; a member off the locked view 420 ticks is removed
OZ_ZOMBIE_ART (= OZ_SPRITES.zombies), OZ_WUGHOST_ART
```

**The scripts.** oz-a: the drop, a burst and a manhole crawler at once, the machine-gun crate
(x 520) before the first lock; three locks (the shops burst; a column marches in out of the fog
before the middle and the last fight; one MG zombie in each of those, the middle one drops a
machine gun); a shotgun crate (x 2210) on the way. oz-b: the approach lock (window, door,
manhole), the corner (`waitArena(ctx, OZ_ZOMBIE_TAG)`, then `wuScene`, the meal, the theme
rises), a tight column for the frikandels, the square lock (a column, the shops, a manhole, the MG
zombie: drops a shotgun). Difficulty and 2P add one or two (`normalUp`, `hardOnly`, `twoPlayers`).

**Fixes in other owners' files (INTEGRATE, wave B):**
- zombies/soldier.ts: a zombie that waited `ENTRY.maxWait` for a hero to step off an opening's
  spot comes out BESIDE it (`beside`; before, it kept testing the opening's spot and never came
  out); `ENTRY.maxWait` 600 → 240 ticks (a camping bot stalled a lock for 10 s each time).
- zombies/soldier.ts `walkOn`: the dead **clamber over low walls** (≤ `CLAMBER.wall` 20 px; vy
  −2.5, ×2 push in the air) and step down off them (≤ 20 px): a march column stood stuck behind the
  16-px garden wall in oz-a's middle lock. Numbers: zombies/numbers.ts `CLAMBER`.
- zombies/soldier.ts: the hit flash is a pale bone-white overlay (alpha 0.3), not the white
  cut-out: under steady fire a tank zombie was white half the time and read as a ghost. The
  crawler's hidden entrance plays `drag` (it has no `idle` strip; a warning).
- bosses/oldenzaal/statue.ts: the hook's strike goes through `world.damage` (it called
  `p.onHit` and killed god-mode players).
- items/index.ts: the soul contract removed (R2.9).

# Wave A (the record; Part R2 above wins)

Revision 2 removed the possession system (R2-6): every `possessed/` file, the `OZ_POSSESSED` ids,
the `enemy/oz-shambler|gunner|brute|soul|ghost-shot`, `npc/oz-town/` and `fx/oz/soul/` sprites,
the `oz/possessed/` sfx and the townspeople's lines are GONE. The rows below that name them are
marked **(removed, R2-6)** and kept only as the record.

## 1. Files and owners

| File | Contents | Owner |
|---|---|---|
| `src/game/content/missions/oldenzaal/ids.ts` | every id of the waves (below); pure data | CORE (add only) |
| `…/oldenzaal/lines.ts` | ALL the text: story card, Wu, the meal, Winkel, signs (the townspeople's lines: removed, R2-6) | CORE (builders may add lines; keep the limits) |
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
| ~~`src/game/content/oldenzaal/possessed/{index,art}.ts`~~ **(removed, R2-6)** | ~~hosts, souls, eject, townspeople, `oz/possessed/` sfx~~ | — |
| `src/game/content/oldenzaal/npcs/{index,art}.ts` (+ new files) | Meneer Wu, Mevrouw Winkel, `oz/wu/`, `oz/ghost/` sfx | WUGHOST |
| `src/game/content/oldenzaal/items/{index,art}.ts` (+ new files) | the meal, snack power, the frikandel bomb, the blast, the splat, `oz/meal/` sfx, the HUD icon | WUGHOST |
| `src/game/content/music/oldenzaal.ts` | synth fallbacks of the four songs | AUDIO |
| `src/game/content/sfx/oldenzaal.ts` | `oz/env/…` synth sfx (thunder, rain, wind, bells, doors, candles, ambience loops) | AUDIO |
| engine opt-ins (`src/game/mission/…`, `src/engine/…`): the light pass, weather, y eviction | additive only, documented in their own headers | LIGHT |
| `src/game/scenes/story-card.ts`, `to-be-continued.ts`, the flow (§7) | the story card, the TO BE CONTINUED card | CORE (wave B FINALE: `ToBeContinuedScene.drawExtra`) |
| `src/engine/palette-hd.ts` (`PAL_HD_OZ`, §5) | the five new ramps | CORE |

Manifest (`src/game/content/index.ts`, not lazy): `missions/oldenzaal`, `oldenzaal/kit`,
`oldenzaal/kit/art`, ~~`oldenzaal/possessed`, `oldenzaal/possessed/art`~~ (removed, R2-6), `oldenzaal/npcs`,
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
- **(removed, R2-6)** POSSESSED `OZ_POSSESSED`: `oz-shambler`, `oz-gunner`, `oz-brute` (category 'enemy'), `oz-soul`
  (a flyer, `body: false`, 'enemy'), `oz-townsperson` ('npc'), `oz-soul-eject` ('fx'),
  `oz-ghost-shot` (projectile).
- WUGHOST `OZ_WUGHOST`: `oz-wu`, `oz-winkel` ('npc'; Winkel is never a target), `pickup-oz-meal`
  ('item'), `oz-frikandel` (the bomb-button weapon id AND its projectile entity), `oz-frikandel-blast`
  and `oz-mayo-splat` ('fx'); the status `OZ_STATUS_SNACK = 'snack-power'`.
- LIGHT `OZ_LIGHT`: the tag `oz-light`, the entity `oz-light-point` (an invisible point light:
  params `r`, `color`, `flicker`), the layer generators `oz-fog`, `oz-rain`.
- Wave B (reserved): `oz-statue`, `oz-swan-jet`.
- Sprite prefixes `OZ_SPRITES` (a builder defines sprites only under its own):
  POSSESSED (removed, R2-6) ~~`enemy/oz-shambler/`, `enemy/oz-gunner/`, `enemy/oz-brute/`, `enemy/oz-soul/`,
  `enemy/oz-ghost-shot/`, `npc/oz-town/`, `fx/oz/soul/`~~; WUGHOST `npc/oz-wu/`, `npc/oz-winkel/`,
  `item/pickup-oz-meal`, `weapon/oz-frikandel`, `fx/oz/mayo/`, `ui/icon-oz-`; LIGHT `fx/oz/light/`,
  `fx/oz/weather/`; TOWN `decor/oz/`; wave B `boss/oz-statue/`, `vehicle/oz-swan-jet/`.
  TOWN's background generators and terrain materials start with `oz-` (`oz-street`, `oz-pavers` …).
- Sfx prefixes `OZ_SFX`: ~~`oz/possessed/` (POSSESSED)~~ (removed, R2-6), `oz/wu/`, `oz/ghost/`, `oz/meal/`
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

## 11. The possessed (POSSESSED) — REMOVED in wave B (R2.9); history only

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
  kill; 60 invulnerable ticks, `oz-mayo-splat`, `PLETS!`), a warm tint pulse, the HUD icon
  `ui/icon-oz-meal` with a countdown ring (no bar). `eatMeal(p)`, `snackTicks(p)`, `splatReady(p)`.
- `snack-frikandel` (`OZ_STATUS_FRIKANDEL`): `bomb` = the frikandel, 2 throws (`frikandelsLeft(p)`);
  the HUD bomb slot shows `ui/icon-oz-frikandel xN`; then the grenades are back.
- Both `carry: true` (they survive a section change) and end with a death (a continue gives no new meal).

### The soul contract — REMOVED in wave B (R2.9); history only

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
