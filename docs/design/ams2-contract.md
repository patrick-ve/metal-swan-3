# Mission `ams2`: the contract for section builders

The spec is `docs/design/ams2.md`. This page tells how to build one section. Section `a` from x 0 to about 720
(`src/game/content/missions/ams2/section-a.ts`, `art-a.ts`) is the worked example: copy its shape.

## 1. Who owns what

Each section builder owns **two files and nothing else**: `section-<key>.ts` and `art-<key>.ts` (`c1` and `c2` share `art-c.ts` when
that helps; agree it in the brief). A section file exports `section<Key>: SectionDef` and keeps that name.

**Do not touch:**

| What | Why |
|---|---|
| Everything under `src/game/content/missions/ams/`, and all other missions | `ams` must keep its art, frames and sims |
| `src/game/mission/*`, `src/engine/*`, `src/game/scenes/*`, `src/sim/*`, `src/game/art-worker.ts`, `content/index.ts` | The hooks are done (§9). If a section really cannot be built without an engine change, stop and report it |
| `ams2/stage.ts`, `ams2/scene.ts`, `ams2/index.ts`, `ams2/ids.ts`, `ams2/scaffold.ts` | Shared by parallel builders. Only additive helpers at the end of `scene.ts` are allowed, and never a change to a signature |
| Existing functions of `src/game/art/herokit/*` | `tests/fixtures/herokit.json` locks them to the Python reference. A new part goes in your `art-<key>.ts` |
| `tmp/ams2-lead/baseline.*`, `tmp/ams2-lead/ams-before/` | The gates of the wave. Never write to them |
| Scripts, terrain, exits, timers, checkpoints, entities | Only what the player sees as scenery changes |

Never name a reference game in code, ids, comments or docs. Temporary files go under `tmp/ams2-lead/`. No commit, no push, no deploy.

## 2. The model in one screen

- Everything but the sky is a **sprite drawn as decor**. So it is generated in the art workers, cached and counted like every other sprite.
- A sprite is painted by **one `paint` function that runs once per art tier**. You draw the 1× design in palette ids; the kit makes the 2× and 4× art (§8).
- The **plane** of an item is its `parallax`, that is its speed. A band x `p` is drawn at screen x `p − camX · speed`.
- The **decor list order is the draw order**. `front: true` items draw after the figures, in list order.
- Long things are cut in **tiles of at most 256 px** (`TILE_W`), because the view culls decor by its anchor with a 256 px margin. `defineArt` throws on a wider canvas. Use `defineBand`.

```
sky layer → clouds, birds → far plane → bank, water, boats, far crowns → floor bands → water cut back
→ far posts, back props → hit-bound props → [terrain painter if paintedFloor: true] → figures
→ water cut front → near posts, other front props
```

## 3. The names (all in `ams2/stage.ts` unless noted)

| Name | Value | Meaning |
|---|---|---|
| `VW`, `VH` | 384, 216 | the view |
| `B0`, `B1`, `B2` | 146, 166, 190 | floor bands: far `[B0 − 3, B1)`, walk `[B1, B2)`, near `[B2, VH)` |
| `G`, `WATER_Y` | 176, 180 | the figures' ground line, the canal surface (as `ams`) |
| `S_SKY`, `S_FAR`, `S_MID`, `S_BACK`, `S_WALK`, `S_NEAR` | .03, .18, .42, .88, 1, 1.16 | the plane speeds |
| `FAR_FOOT`, `NEAR_FOOT` | 163, 191 | the post feet rows |
| `HIT_FOOT` | 169 | the foot row of what stands at speed 1 beside the street |
| `TILE_W`, `FLOOR_W` | 256, 768 | the longest tile, the width of a floor tile |
| `bandX(wx, s)`, `bandEnd(sectionW, s)` | | world x → band x (line-scroll rule: planes line up at screen centre); the highest band x a section shows |

## 4. The recipe of a section

```ts
import { sectionB as base } from '../ams/section-b';
const L = 'noon';                         // morning | noon | golden | sunset
const W = base.width;

const FLOOR = defineFloor({ light: L, name: 'b', seed: 161, walk: 'gravel', near: 'pave', farExtra: quayEdge });
const decor: DecorDef[] = [
  ...cloudsDecor(L, 162),
  ...birdsDecor(L, 100, 26, 0.12, W),
  ...farDecor(defineFarBand(L, 'b/far', 168, 100, [[92, 60]]), W),
  // … your bank, water, far props …
  ...bandTiles(FLOOR.far, W), ...bandTiles(FLOOR.walk, W), ...bandTiles(FLOOR.near, W),
  // … water cut back, far posts, back props, hit-bound props, water cut front, near posts …
];
export const sectionB: SectionDef = stageSection(base, {
  background: skyBackground(L, 162),
  decor,
  overrides: { 'decor/ams/ams-bike-rack': RACK_B },   // optional, §7
  // paintedFloor: 'all' is the default: the terrain painter draws nothing. §6
});
```

`stageSection(base, opts)` keeps `script`, `terrain`, `exits`, `playerStart`, `checkpoints`, `respawn` and the timers of the `ams` section. It sets
`floor: undefined`, `paintedFloor`, `spriteOverrides` and `art`. `art` is the tier-4 working set: every decor sprite and every twin join by themselves,
and the base's entries that scripts need stay. `opts.art` adds more. Never set `art` yourself.

The sprite name is `<section>/<thing>` (`artId(light, name)` makes the id `decor/ams2/<light>/<name>`). **Names must be unique per light**: `defineArt`
returns the existing id when the name is taken. Shared props exist in all four lights, by these names (use `artId(L, name)`): `post`, `post-far`, `lamp-38`, `lamp-72`,
`lamp-perch`, `bench`, `bike-navy`, `bike-dred`, `bike-dgreen`, `planter`, `tulips`, `flag-nl`, `flag-city`, `flag-pole-76`, `flag-pole-78`, `crate`,
`waste-bin`, `bike-rack`, `smoke`, `birds`, `far-cyclist-dred`, `far-cyclist-navy`, `far-cyclist-dgreen`, `tour-boat`.

### How to add a layer

| You want | Call | Then in the decor list |
|---|---|---|
| The sky | `skyBackground(L, seed, { ramp?, paintOver? })` | `background:` of `stageSection`. `paintOver: (s) => …` draws the sun on it |
| Clouds, birds | `cloudsDecor(L, seed)`, `birdsDecor(L, x0, y, v, W)` (`scene.ts`) | spread |
| The far city | `defineFarBand(L, name, seed, base, [[x, h], …])` | `...farDecor(band, W)` |
| A long tile that repeats | `defineBand({ light, name, speed, rows: [y0, y1], width, paint, anim?, tpf? })`. `paint` returns a canvas of `width` × at least `y1` rows, with `s.wrap = true` when it must tile; or `anim` canvases | `...bandTiles(band, W, { front?, from?, to? })` |
| A long drawing that stands once (museum, quay, long bridge) | the same `defineBand` | `...placeBand(band, x, { front? })` |
| A far bank with its water and reflection | `defineBank({ light, name, speed, width, rows, waterRows, paint, reflect?, seed? })` (`scene.ts`) returns `{ bank, water }` | `...bandTiles(bank, W), ...bandTiles(water, W)` |
| A painted floor | `defineFloor({ light, name, seed, far?, walk?, near?, farExtra?, walkExtra?, nearExtra? })` returns a `FloorPlan` with `far`, `walk`, `near` bands. `far`: `pave`, `none`. `walk`: `cobble`, `slab`, `gravel`, `none`. `near`: `lane`, `pave`, `water`. Draw grass and such in the `*Extra` hooks. A section may use more than one plan | `...bandTiles(plan.far, W, { from, to })` and so on; seams on kerbs or lane edges |

### How to add a prop at a band speed

1. Paint it: `const BENCH = defineArt(L, 'b/my-prop', () => { const s = new S(40, 20); …; const o = addMargin(s); o.finish(KM); return o; }, opts)`. Return one canvas or a list (animation frames). Near plane: `o.finish()` (hero outline `#140c0e`). Middle plane: `o.finish(KM)`. Far layers: no `finish`, flat tones.
2. `opts`: `anchor` (`'bl'` default: x is the left end and y the line it stands on, so its lowest row is `y − 1`; `'tl'`; `'bc'`), `ticksPerFrame`, `fine: true` (art at tier 2 and up only: empty at art 1), `bob: [0, 1, 0, -1]` (one drawing that bobs with no extra memory), `part` (detail seed).
3. Place it: `atBand(id, x, y, S_BACK, { animate?, frame?, front?, flipX? })` when x is a position on that plane's own layout; `atWorld(id, wx, y, S_BACK, …)` when it must stand at world x `wx` as `wx` passes the screen centre.
4. Things that travel: `mover(id, speed, x0, y, v, span, W, fps)`, far and small only.
5. Lights that blink, tulips, flags: frames with `animate: ticks`. For a blink give frames like `[lit, empty, empty]`.
6. Do not put figures on the far planes. Keep the walk band calmer than the figures.

### How to add a hitbox-bound prop at speed 1

Anything a hitbox touches has speed 1: platforms, ledges, awnings, boats, bridges, doors, the lamps a gull sleeps on, breakables.

- `hitProp(id, wx, y, { animate?, frame?, front? })`: x and y are world numbers. Take them from the `ams` section file and `ams/terrain.ts`, so art and collision line up.
- `perchLamp(L, wx)` (`scene.ts`): a lamp at speed 1 with its top at `PERCH_TOP` (`G − 70`, the scripts' `LAMP_TOP`), its foot on `HIT_FOOT`. Gull lamps of `a`: 470, 920, 1360.
- Trees: `trunkArt(L, seed, tw?, height?)`, `crownArt(L, seed, w?, h?, mat?)` (`scene.ts`). The elm with the secret bike (`a`, x 620) is `hitProp(trunkArt(L, 620), 620 - 22, HIT_FOOT + 1)` and `hitProp(crownArt(L, 620), 620 - 60, 22, { animate: 20 })`. `stageSection` replaces a crown's step by a slow one of its own and gives every animated item a phase (`settleMotion`), so `animate` on a crown only says that it moves.

### How to add a water cut

```ts
const CUT = waterCut(FLOOR, L, 'side-canal', A_CANAL[0], A_CANAL[1]);   // world x0 … x1: the terrain's hazard numbers
// in the decor list:  ...CUT.back  right after the floor bands   ...CUT.front  after the hit-bound props
```

Water per floor band at the band's speed, with hard quay edges, plus a surface at speed 1 in front of the figures (a figure in the water sinks behind it). Call
`waterCut` **before** `postRow`: the row then skips the cut, and `kerbPosts` throws on a post inside it.

### How to put a post on a kerb

```ts
keepClear(FLOOR, A_BRIDGES[0][0], A_BRIDGES[0][1]);                     // optional: no posts on this world span (a bridge, a ramp, a jetty)
const farPosts  = kerbPosts(FLOOR, L, 'far',  postRow(FLOOR, 'far',  10, 44, W));
const nearPosts = kerbPosts(FLOOR, L, 'near', postRow(FLOOR, 'near', 60, 92, W));
```

The far row goes behind the figures, the near row in front. `kerbPosts` takes band xs and throws `PostOnWrongGround` on any other ground: a row off the kerb, a band
without one (`far: 'none'`, `near: 'water'`), a water cut. **Never place the `post` sprites any other way.** `tests/content/ams2.test.ts` checks every post sprite in every section's decor
list against the kerbstone ids of the painted band under its feet. So a `farExtra` that paints over the kerb fails there too.

## 5. Terrain numbers

`ams/terrain.ts` holds the world numbers: `A_BRIDGES`, `A_CANAL`, `A_BOATS`, `A_AWNINGS`, `A_LEDGES`, `A_FABEL_X`, `B_PASSAGE`, `B_CEILING_Y`, `C_CANAL`, `C_BOATS`, `C_RAMP`, `C_STEPS_X`, `C_BASIN`, `DECK_Y`, `ROOF_Y`, …
Import them; never type the numbers again. Each `ams` section file's decor list tells what stands where. `secrets.ts` tells what must stay findable.

## 6. The terrain painter

`paintedFloor` on `SectionDef`, set through `stageSection`:

- `'all'` (the default and the goal): the terrain painter draws nothing. Every platform and solid must be your sprite.
- `true`: no ground cells and no pit shafts; platforms and solids still draw. Only for a section under construction.

Pits and water hazards must read clearly. A finished section has `paintedFloor: 'all'` and no `...base.decor` left in its list.

## 7. How to override a shared sprite

An entity of a shared script draws a shared id (`decor/ams/ams-bike-rack`, `decor/ams/ams-boat-platform`, `decor/ams/ams-cruise-boat`, `decor/ams/magere-brug`, …). Do not copy the entity. Paint a twin:

```ts
export const RACK_TWIN = defineArt(L, 'a/rack-twin', () => [whole, wreck], { anchor: 'bc' });
stageSection(base, { …, overrides: { 'decor/ams/ams-bike-rack': RACK_TWIN } });
```

- The twin **keeps the frame order and the anchor rule** of the shared sprite. Read how the entity draws it: `grep -rn "sprite(" src/game/content/missions/ams/` and the shared sprite's `defineSprite`. A breakable's frame 0 is whole, frame 1 wrecked, the anchor is the bottom centre (`'bc'`).
- A foot row, a platform top: the shared sprite's numbers stay true for the twin. Hitboxes live in the entity and do not change.
- The map is per section (a twin has its section's light). It holds only while the runner draws that section: game logic, the HUD and every other mission see the shared id. The twin joins the working set by itself.
- Sprites a script spawns (fx, enemies, pickups, hostages, the swan) stay as they are: **figures do not change in this wave**.

## 8. How each tier gets its art

Your `paint` function runs once per tier (`kitTier()` returns 1, 2 or 4). `S` is a canvas of palette ids with a part id and a z per pixel. `renderBuffer` then does the method of spec §1.3 per object:
EPX (twice at 4×), the long ramps with hard bands, detail by material in whole tones, the window marks, and the light grade of the section. You draw 1× only.

- The kit (`src/game/art/herokit/`): `S` (`use(part, z)`, `rect`, `hl`, `vl`, `px`, `poly`, `ell`, `line`, `grid`, `retone`, `paste`, `finish`), `addMargin`, `text`; `house`, `window_`, `door`, `gablePts`, `brickHints`, `plasterHints`; `wallBlock`, `slateRoof`, `cornice`, `quoins` (big buildings); `crown`, `trunk`, `hedge`; `cobbles`, `pavers`, `kerb`, `lane`, `gravel`, `grass`, `manhole`, `drain`, `leaves`; `skyBands`, `cloudSprite`, `skyline`, `farTower`, `birdFrames`; `waterBand`; `post`, `lamp`, `bench`, `bike`, `planter`, `flagFrames`, `flagPole`, `crate`, `stand`, `stall`, `houseboat`, `smokeFrames`, `farCyclist`, `tourboat`, `wasteBin`, `bikeRack`; `R` (ramps), `VARIANTS`, `KM`, `K`, `rngf`. `scene.ts`: `houseRow`, `quayWall`, `quayEdge`, `repeatAlong`. Port what is left from `docs/design/ams2/spike/hires/scenes.py` into your art file.
- Colours come **only** from `R` ramps. No hex in your code, no alpha, no gradient. Add a ramp only through a reviewed change of `palette.ts`; ask first.
- Extras for the finer tiers only (shutters, anchors, door lamps, number tiles, drains): `if (kitTier() >= 2) …` inside `paint`, or `fine: true` on a sprite. Python `kit.U >= 2` means the same.
- Deterministic: seeds through `rngf(seed)`. Never `Math.random`, never a clock.
- A real game sprite never goes through `renderBuffer`. It scales by a whole number by itself.
- Keep to the 4× budget: 1× px × 64 bytes per frame. About 90 MB of kit art per section (`tests/content/ams2-dense-budget.test.ts`: section + next section + the rest ≤ 254 MB). A frame of water at 1024 × 33 costs 2.2 MB, a crown of 118 × 118 with 4 frames 3.8 MB. Reuse sprites; use `bob` over extra frames.

## 9. The engine hooks (done; do not change)

| Hook | Where | What |
|---|---|---|
| `SectionDef.paintedFloor` | `mission/types.ts`, `mission/view.ts` | §6 |
| `SectionDef.spriteOverrides`, `setSpriteOverrides` | `mission/types.ts`, `mission/runner.ts`, `engine/sprites.ts` | §7 |
| `DecorDef.animStep`, `moveX`, `moveSpan`, `moveFrom` | `mission/types.ts`, `mission/view.ts` | a band's tile keeps its tile while it animates; far movers. Set by `bandTiles`, `mover` |
| `MissionDef.standalone`, `seedAs` | `mission/types.ts`, `mission/runner.ts`, `scenes/flow.ts` | no next mission, back to the title after the tally; the same section seeds as `ams` |
| lazy chunk | `content/index.ts` `isAms2Content`, `scenes/boot.ts`, `sim/headless.ts`, `art-worker.ts` `isAms2SpriteId` | `?mission=ams2` loads it; workers load it when asked for a `decor/ams2/` id |

## 10. How to run frames

| What | Command |
|---|---|
| A game frame, figures, HUD, labels | `npm run shot -- --mission ams2 --section a --x 215 --ticks 40 --god --res 2 --art 2 --out tmp/ams2-lead/<you>/a.png`. `--res` and `--art` go together: 1 1, 2 2, 4 4 |
| A clean frame with no figures, no HUD | `npx tsx tools/herokit/frame.ts --section a --cam 60 --art 2 --out tmp/ams2-lead/<you>/a.png` |
| The same with figures | add `--figures --tick 40` |
| The look's gates (spec §1.4) | add `--gate`. It prints colours, the tone step at edges (≥ 0.17), soft edges (≤ 5 %) and pixels outside the palette (0). A stretch that still shows `ams` decor fails it, and that tells you what is left |
| The reference for the same place | `tmp/ams2-lead/ref/{a,b,c,d}-u{1,2,4}.png` are at camera 60, tick 0: `--cam 60 --tick 0`. The figures in them stand at screen x 150 and 250 |
| A browser | `npx tsx tools/smoke.ts --port <free port> --query "mission=ams2&section=b&god=1" --out tmp/ams2-lead/<you>/smoke`. At 4K use a production build: the dev server runs out of requests with many workers, for `ams` too |

**Look at every frame with the Read tool, next to the reference and the real figures. A look you did not view is not done.** Frames: `tmp/ams2-lead/frames/`.

## 11. The gates of a section

```
npm run typecheck                                       # your files clean
npx vitest run tests/content/ams2.test.ts tests/content/ams2-dense-budget.test.ts tests/art/herokit.test.ts
npm run sim -- --mission ams2 --section <key> --seed 7 --god --quiet   # compare with --mission ams: same ticks, kills, sections
npx tsx tools/herokit/frame.ts --section <key> --cam <x> --art 4 --gate   # no pixel outside the palette, on finished stretches
```

`tests/content/ams2.test.ts` also proves that the play is the same object as in `ams` (script, terrain, exits …) and that the bot plays both the same.
