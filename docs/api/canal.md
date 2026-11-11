# Canal scenes — API (the baked scenery of mission `ams`)

A section's scenery can be the canal paint kit's layer stack (`tools/levelkit/`, its README), baked to PNG files at
1×, 2× and 4× and drawn by the game with the kit's own maths (user decision 2026-11-11; the brief:
`docs/design/level-guide/briefs/4-port-engine.md`). All six sections of `ams` (a, b, c, c1, c2, d) draw their scenes;
section a was the pilot.

## 1. Opt in (one line per section)

```ts
import { amsCanal } from './canal/index';            // src/game/content/missions/ams/canal/index.ts
export const sectionB: SectionDef = {
  // … the old scenery stays as it is (background, floor, decor, terrainStyle): `?canal=0` draws it
  canal: amsCanal('b', undefined, { depth: LAMP_GULLS, hideFaces: ['ams-tulip-stall', 'ams-herring-cart'] }),
  // canal: amsCanal('d'),                             // the scene alone: 'ams/d' of the manifest
  // canal: amsCanal('x', ['boat']),                   // skip stack layers an entity draws instead
};
```

`CanalDef` (`src/game/mission/canal/types.ts`): every field but `scene` is optional, and every one
is RENDER ONLY: with the scene off (`?canal=0`, no source, a failed file) none applies.

| Field | What |
|---|---|
| `scene` | `<manifest id>/<section id>`, e.g. `'ams/a'` |
| `skip` | layer ids of the stack not drawn and never loaded (an entity draws that thing instead) |
| `art` | the tier-4 working set's prefixes while the scene draws; default `drawnArt`: the section's `art` without its decor sprites, but with the scene's canal sprite ids (§7, §8) |
| `depth` | depth rules by entity kind while the scene draws (§9), wrapped over the floor's own `entityDepth` |
| `hideFaces` | entity kinds whose floor faces (`FloorDef.entityFaces`) are left out while the scene draws, because the kit paints that thing in depth itself (a stall, a cart, a rack, the cruise boat's deck and roof, a low bridge's deck). A list of kinds: always. A record `kind → true \| (e) => boolean`: `true` always, a rule only for the entities it holds for (c2: `'ams-magere-brug': (e) => e.state === 'closed'`). `SectionView` registers each kind with `SectionFloor.hideEntityFaces(kind, hidden)`; the face pass (`entityFacePass`) skips an entity whose `hidden(e)` holds; `hidden` is false as soon as the scene is not live (failed) |
| `show` | layers drawn only while a rule holds: `layer-id prefix → (world) => boolean` (the first matching prefix wins for a layer). c2: `{ mb: (w) => every 'magere-brug' entity is closed }`, so the kit's closed deck (layers `mb…`) goes when the bascule lifts and the bridge's faces draw the leaves. The rule reads the world of the LAST frame drawn: `SectionView.drawShadows(r, world)` stores it in `CanalView.world`, the next back pass asks every rule once and the front pass reuses those answers. No world yet (a headless scenery frame without entities: `tools/shot.ts` scenery passes, the fidelity test, the first frame of a section): every layer draws. The simulation never asks a rule |

The opt-ins of the six sections:

| Section | `amsCanal(…)` extras |
|---|---|
| a | `depth: { seagull: A_GULLS }` (kerbside lamps at 7.5 and bridge 2's lantern at depth 5) |
| b | `depth: LAMP_GULLS`, `hideFaces: ['ams-tulip-stall', 'ams-herring-cart']` |
| c | `depth: { seagull: e.x > 1200 ? kerbside lamp : 0 }` |
| c1 | `depth: LAMP_GULLS` |
| c2 | `hideFaces` (cruise boat, low bridges, the Magere Brug while closed), `show: { mb }`, `depth: { seagull: gullOnLamp(C2_PORTAL_TOP, 10) }` |
| d | `hideFaces: ['ams-market-stall', 'ams-bike-rack']` |

With the scene on, `SectionView`:
- `prepare`: loads the scene's first packs (no background layer, terrain chunk, floor chunk or
  floor tile, row frame or quad canvas is built); the floor gets its entity face tiles only
  (`SectionFloor.prepareEntities`).
- `drawBack`: the stack's non-`over` layers, `backHook`, the floor's frame (`canalFrame`),
  `floorHook`. `drawShadows` as before (contact shadows, entity faces). `drawFront`: the floor's
  front entity faces, then the `over` layers. The floor stays the entities' GEOMETRY:
  `drawAtDepth`, depth steps, `liftAt` work as before.
- Without `canal` (or with the switch off, no source, or a failed file) every line of the old
  path runs unchanged.

## 2. The manifest and the bake

```sh
U=4 python3 tools/levelkit/lk.py ams bake l1a [l1b …] [--stats]
# defaults from tools/levelkit/missions/ams/mission.py: --out public/art/ams
#   --manifest-dir src/game/content/missions/ams/canal --fixtures tests/fixtures/canal
```

Run it for U = 1, 2 and 4 (one tier-4 build at a time: ~45–90 s and ~21 GB of virtual memory for
section a). The bake sets `L1_GAME=1` before it imports the kit (`level.GAME`: a section leaves
out what the game draws as an entity, §7). Deterministic.

- PARALLEL-SAFE: every section has its own files — `<sec>.gen.ts` (its manifest, all tiers),
  `tests/fixtures/canal/index-<sec>.json` (its fixtures), `public/art/ams/<sec>-u<U>-*.png`. The
  joining `manifest.gen.ts` (the loading policy and one import per section file present) is
  regenerated by every bake. All writes run under one file lock (`tools/levelkit/work/.bake.lock`), atomically
  (temp file + rename); the slow parts (the build, the packs, the fixture frames) run outside it.
  Nobody edits a generated file by hand. A run replaces its section's tier; when the section's layer
  or sprite list changes, its other tiers are dropped (re-bake them).
- Tiles: one per layer, frame and column of 128 logical px, cropped to the opaque box on whole
  logical px, alpha 0 / 255 only; empty tiles dropped.
- Packs: the tiles whose first camera falls in a window of 256 camera px, split into COLOUR GROUPS
  of ≤ 256 colours (greedy, deterministic), each group shelf-packed into 8-bit palette + tRNS PNGs
  (zlib 9; sheets ≤ 4096²); a tile with more than 256 colours goes to an 8-bit RGBA sheet:
  `<sec>-u<U>-w<window>-<i>.png`. Section a: 6.47 MB (one RGBA sheet per window, 300–400
  colours each) → 3.30 MB for three tiers, lossless (same kit state). Lossless WebP would save ~23 %
  more but needs a decoder in node (a dependency) and an exact-pixel decode path in the browser.
- `CanalManifest` (`types.ts`): `base`, `col`, the loading policy (`window`, `ahead`, `behind`),
  and per section the layers (`id`, `kind`, `over`, `n`, `drift`, `depth`, `front`) and per tier
  `files`, `fileCam` and per layer `rows`, `y0`, `pw`, `speed` / `s0` / `s1` (they come from the
  kit's real rows, so they differ a little by tier) and the tile table (8 ints a tile: frame, x, y,
  w, h, file, sx, sy; real px of the tier).
- `--fixtures` writes the fidelity frames (§6) from the SAME build: always bake art and fixtures
  together (the kit changes under the section agents). The cameras: the kit module's
  `GAME_CAMS = [(camera x, crop centre x), …]` (the tier-2 / tier-4 crops are 192 / 96 logical px
  wide around the centre); default five cameras from 0 to the end, centre 192 (section a keeps the
  first builder's seven in `missions/ams/mission.py` `FIXTURE_CAMS`, used only without `GAME_CAMS`).

## 3. Drawing (`CanalView`, `Renderer.rows`)

Per layer and visible column: the wanted tier's tile, else a lower tier's (tier 1 loads first),
else nothing. Each tile is ONE `Renderer.rows(img, d, x, y, RowsDraw)` call. Row j of an image
moves left by `floor((cam · s_j + add) · res)` backbuffer px, `s_j = s0 + ((s1 − s0) · (j0 + j)) /
max(rows − 1, 1)` — the kit's `int(cx * sp * U)` in its float order, so at an integer camera and
res = d the frame equals `compose_level` exactly. `img`/`frames`: s0 = s1 = speed; `tile`:
wrapped (`period`, two copies) and drifting (`add` = drift · ticks / 60); `rows`: sheared;
`frames`/`rows` with n > 1 step every 10 ticks.

- `SoftRenderer.rows`: a row copy (the reference). `CanvasRenderer.rows`: one `drawImage` (one
  speed), one sheared `drawImage` under `setTransform(1, 0, −B, 1, E, top)` (res = d), or at res ≠ d
  the same shear into a scratch strip (one strip row per image row) drawn k / d rows tall, so every
  image row stays rigid. `canvasTexture(buf)`: a texture the store owns (outside the LRU).
- Fractional cameras: the renderer's camera (1/res steps); every row moves by whole backbuffer px
  at its own speed, and every image px is a fixed k / d block, so nothing shimmers (as the floor's
  §2 "Smooth" rule 1: one camera, nothing snaps to logical px). Vertically the stack is fixed
  (no camY: ams has no vertical scroll; a screen shake moves the world, not the scenery's rows).

## 4. Loading (`store.ts`, `png.ts`, `registry.ts`)

- `decodePng(bytes)` (DecompressionStream) / `decodePngSync(bytes, inflateSync)`: RGBA 8, RGB 8,
  palette 1/2/4/8 + tRNS, non-interlaced; exact pixels (no premultiply, no colour management).
- `CanalSource` (`setCanalSource`): the browser's `fetchCanalSource(BASE_URL)` (main.ts); node's
  `nodeCanalSource()` (`tools/lib/canal-source.ts`: sync reads from `public/`). No source: the
  section draws its old scenery (headless tests and sims by default).
- `wantCanal(scene, d, camX)` (every back pass and `prepare`): loads each pack whose window
  starts ≤ camX + `ahead` and still has a tile the camera needs; frees tiles more than `behind`
  px behind their last camera, and every tier the scene no longer draws. Sync source: at once.
  Browser: one pack at a time (fetch, inflate, row filters in 4 ms slices), the drawn scene
  first, tier 1 first; every tile becomes a canvas texture and its pixels are dropped.
- `canalSections(sections, current, next)` (gameplay: mission preload, `sectionLoaded`):
  prefetches the next sections' first packs, frees the scenes behind.
- A file that fails: the scene fails, one `[canal]` warning, the section draws its old scenery.

## 5. Switch, tools, numbers

- `?canal=0` / `setCanal(false)` / `npm run shot -- … --canal 0`: the old scenery.
- `window.__ms3.canal`: `stats()` (CPU ms of the canal draws per frame, tiles drawn), `bytes()`
  (resident CPU buffers and textures), `scenes()` (the same by held scene id: the prefetch of the
  next section and the release of the last one), `reset()`.
- Numbers (2026-11-11, the six sections; the resident peak from a headless walk at tier 4, every
  16 camera px, `canalBytes().cpu`, the canal sprite sheet included):

  | Section | Tier-4 tiles (M px) | Resident peak (M px / MiB, at camera) | Files u1 / u2 / u4 (KB) |
  |---|---|---|---|
  | a | 28.19 | 13.86 / 52.9 (1024) | 355 / 852 / 2103 |
  | b | 20.12 | 10.49 / 40.0 (256) | 263 / 667 / 1683 |
  | c | 18.62 | 11.99 / 45.7 (1792) | 239 / 572 / 1432 |
  | c1 | 14.96 | 12.87 / 49.1 (256) | 116 / 281 / 661 |
  | c2 | 24.01 | 19.63 / 74.9 (1280) | 206 / 481 / 1141 |
  | d | 10.11 | 9.40 / 35.9 (256) | 123 / 284 / 683 |

  `public/art/ams/`: 253 files, 1.30 MB (u1) + 3.14 MB (u2) + 7.70 MB (u4) = 12.14 MB. In the
  browser the tiles are textures (the CPU copies are dropped). The canal tiles are not in
  `DENSE_BUDGET_BYTES` (4× sprite frames) nor in the canvas renderer's `TEXTURE_BUDGET_PX` LRU
  (the textures are the store's own).

## 6. Tests

- `tests/art/canal-fidelity.test.ts`: gate 3 — the headless frame equals the kit's frame at every
  fixture camera, tiers 1, 2, 4, for EVERY section with fixtures of EVERY mission (`ams` in
  `tests/fixtures/canal/`, any other mission in `tests/fixtures/canal/<mission>/`; a section baked
  but not opted in yet is drawn with `canal: { scene: '<mission>/<id>' }`); every baked tier of
  every section needs five cameras or more. One section: `npx vitest run
  tests/art/canal-fidelity.test.ts -t "ams b "`. A bake elsewhere: `CANAL_FIXTURES=<dir>
  CANAL_PUBLIC=<dir> CANAL_MANIFEST=<manifest dir or <sec>.gen.ts> CANAL_MISSION=<id> npx vitest run
  tests/art/canal-fidelity.test.ts`.
- `tests/game/canal-optin.test.ts`: all six ams sections opted in; sections without the opt-in
  (`ams2`, `oldenzaal`) unchanged; the switch; a missing file (old scenery, one warning); nothing
  old built and the resident window at tier 4; `drawnArt` (keeps a scene's canal sprite ids).
- `tests/game/canal-a.test.ts`, `tests/game/canal-c.test.ts`: section checks of a and c.
- `tests/content/ams-dense-budget.test.ts`: the tier-4 working set with the scenes on and off.
- `tests/engine/png.test.ts`: the decoder (every filter, colour type and bit depth, both inflates).
- `tests/game/canal-sprites.test.ts`: the canal sprites (§7), nothing old built (§8), the lamp
  gulls (§9), offline (§10).
- `tests/game/floor-wave-b.test.ts` (§3.7, no hittable entity at a depth): runs with the canal
  source on; ONE exception, a gull on its spawn lamp under a scene's `depth` rule (§9).

## 7. Canal sprites (kit paintings of entities)

A thing the game draws as an ENTITY (it moves, breaks or carries the player: a rack, a stall, a
cart, a boat) keeps its entity; the kit's painting replaces some of its sprite frames while the
section's scene draws.

- Kit (`tools/levelkit/core/game_sprites.py`): `entity(sec, '<sprite id>', painting, x, depth, frames=(0,),
  ax=None, grade=None, clip=False)` in place of `sec.put(painting, x, depth)`. Page and previews:
  painted as before. Game bake: left out (no contact shade either) and recorded; `sprites(sec)` (the
  hook the bake calls; `from game_sprites import entity, sprites` in the section module) returns
  the records graded as `Sec.flush` grades the plane (key + curve, 5-bit). A record may also be a
  dict / object with `id`, `frames`, `layer`, `ax`, `ay`, `clip`. The painting point (ax, ay)
  (default: the middle of the bottom edge, `put`'s convention) lands on the game frame's anchor
  pixel. ONE picture per id and frame: two racks of a section share one painting (the first).
- Geometry: the bake reads the game's 1× frames from the layout dump's `sprites` (every id under
  `decor/ams/`, `npc/ams/`, `vehicle/`; re-run `npx tsx tools/levelkit/dump.ts ams` (it writes
  `tools/levelkit/work/ams/layout.json`) after a game sprite changes) and puts each replaced
  frame on that box. It refuses an unknown id or frame, a frame offered twice, and an opaque
  painting pixel outside the box (`clip=True` crops, reported).
- Files: `<sec>-u<U>-s.png` per tier; manifest: section `sprites` (id, frame, w, h, ox, oy: the
  game's 1× geometry) and per tier `sprites` (file, xy).
- Store: the sheet loads with the tier (before its packs; sync at once), stays until the scene
  goes, counts in `canalBytes().cpu`; its frames stay pixel buffers.
- Game: `CanalView.sprites` (`CanalSprites`) is the frame overlay (`setFrameOverlay`,
  engine/sprites.ts) the runner sets around `drawScene` while the scene is live: `getFrames(id, d)`
  gives the id's own strip with the listed frames replaced by the best LOADED tier ≤ d (4 → 2 → 1;
  none loaded: the game's art), the game frame's points kept. Unlisted frames (a wreck) and every
  other id: the game's art. Game logic (outside `draw`) and generators (`runGen` clears the
  overlay) see the registry's frames; overlay frames are never in the registry, `denseBytes`
  (`DENSE_BUDGET_BYTES`), `generatedSprites` / `readyFrames` (the IndexedDB packs) or `spriteIdOf`
  (no upscaler filter: drawn like scenery). The id's old 1×/2×/4× frames are still built (the
  wreck needs them). A frame whose game geometry differs from the baked one: the game's art and one
  `[canal]` warning. Section changes: the overlay is the current view's, so another section may
  replace the same id with its own painting (another hour).
- Entity faces (`FloorDef.entityFaces`) do not sample sprites and keep drawing (the rack's end
  hoops); a section that wants them gone drops the kind from its floor's `entityFaces`.
- The canal sprites baked (painted frames / the id's frames):

  | Section | Canal sprites |
  |---|---|
  | a | `ams-bike-rack` 0/2, `ams-boat-platform` 0,1/2, `ams-herring-cart` 0/2, `ams-tulip-stall` 0/2 |
  | b | `ams-herring-cart` 0/2, `ams-tulip-stall` 0/2, `hotdog-front` 0/1 (the vendor draws it over himself) |
  | c | `ams-boat-platform` 0,1/2, `ams-herring-cart` 0/2, `ams-market-stall` 0/2 |
  | c1 | `npc/ams/ams-tour-boat` 0,1/2 |
  | c2 | `ams-boat-platform` 0,1/2, `ams-cruise-boat` 0,1,2/3, `magere-brug` 0–3/4 |
  | d | `ams-bike-rack` 0/2, `ams-market-stall` 0/2 |

  (ids under `decor/ams/` unless named in full.)

## 7a. Known old-look leftovers (the scene on)

- The wreck frames of the breakables (frame 1 of `ams-bike-rack`, `ams-tulip-stall`,
  `ams-herring-cart`, `ams-market-stall`): the game's art. (The boat platform, the cruise boat, the
  Magere Brug and the tour boat have every frame painted.)
- The tour boat's turn strip (`npc/ams/ams-tour-boat/turn`, c1): built from the GAME frame 0 by
  `turnSquash`, so the boat turns in its old look at both ends of its run.
- The Magere Brug's lifting leaves (c2): while the bascule is up, the kit's closed deck (`mb…`)
  is hidden (`show`) and the floor's entity faces draw the leaves in the old look.
- Entity faces kept in a and c (no `hideFaces` there): the rack's end hoops, the stall and cart
  faces, the boat platform's faces draw beside the kit's paintings.
- Every entity, figure, pickup and fx keeps its own art (decision 5 of the brief).

## 8. Nothing old is built for a canal section

`canalPaintedArt(sections)` (registry.ts): the decor sprites of the sections whose scene is on,
minus every id some section draws anyway (its `drawnArt`, every canal sprite id a live scene's
manifest lists under `sprites` — those entities still draw their unlisted frames, and b's vendor
draws `decor/ams/hotdog-front` — or the decor of a section without a live scene). Left out of the boot's 1× preload (`bootSkip`, `PreloadOpts.skip`), the 2× mission preload
(`preloadMissionArt`) and the scripts' `prewarm` (the runner sets `setCanalPaintedNow` at each
section start). Empty for every other mission, `ams2` (same scripts), `?canal=0` and without a
source. A scene that fails later builds its old decor on first draw (a hitch, no error).

With all six scenes on (2026-11-11) the set holds 71 ids: the houses (`house-morning|noon|golden|sunset`,
`neighbour-morning`), the trees, lamps, benches, bollards, flags, bikes, awnings, the water and
houseboat strips, the bridges' faces and rails (`drawbridge`, `white-bridge`, `low-bridge`,
`c2-magere-portals-*`, …), the landmarks (`rijksmuseum`, `stopera`, `carre`) and the stands
(`fabel-*`, `hotdog-stand`, `market-stall`). Their 1× frames are 0.82 M px (3.1 MB); the 2× and 4×
frames they would take: ~12.5 MB and ~50 MB. Still built: every entity sprite (the canal sprite
ids among them, for their wrecks and unlisted frames), every figure, pickup and fx, and the
floor's entity face tiles (`SectionFloor.prepareEntities`).

## 9. Gulls on kit lamps (render only)

The user's decision: "gull perches follow their lamp by a render-only shift". The kit's kerbside
lamps stand at depth 7.5 (`street.py` `LAMP_D`). `CanalDef.depth: LAMP_GULLS` (= `{ seagull:
gullOnLamp() }`, `ams/canal/index.ts`) draws a gull spawned perched at feet y `LAMP_PERCH_Y` (G − 70,
the scripts' `LAMP_TOP`) at depth 7.5 while it sits there (alive or dead), easing to 0 over its
take-off strip (`Seagull.spawnPerch`, 1 → 0); every other gull and every later perch (the gloat)
at 0. `gullOnLamp(perchY, depth)` for another perch. The rules apply only while the scene is live
(SectionView wraps them over the floor's `entityDepth`, `SectionFloor.wrapEntityDepth`); hitbox,
logic and sims unchanged. A flock spawned on a lamp shares the rule (its members sit 16 px apart).

## 10. Offline and first load

The canal files are `public/` files: the service worker (`tools/sw/plugin.ts`) lists them in
`FILES` but does not precache them; each is cached on its first fetch and served from the cache
while its hash holds. A file that cannot be fetched (offline, never cached; or an HTTP error): the
scene fails, one `[canal]` warning, the section plays on its old scenery
(`tests/game/canal-sprites.test.ts`). Nothing changed in the worker
(`tests/tools/offline-cache.test.ts` passes).

## 11. A section agent's recipe

1. Kit: every entity painting through `game_sprites.entity(...)` (§7); `from game_sprites import
   entity, sprites` at the top; `GAME_CAMS = [(cx, crop centre), …]` (five or more) at module level.
2. A changed game sprite or a new one: `npx tsx tools/levelkit/dump.ts ams`.
3. Bake (from the repo root), one tier-4 build at a time:
   `for U in 1 2 4; do U=$U python3 tools/levelkit/lk.py ams bake l1<id>; done`.
4. Opt in: `canal: amsCanal('<id>', undefined, { depth: LAMP_GULLS })` in `section-<id>.ts` (drop
   `depth` when no gull sits on a kerbside lamp).
5. Test: `npx vitest run tests/art/canal-fidelity.test.ts -t "ams <id> "` and the sims of the section.
