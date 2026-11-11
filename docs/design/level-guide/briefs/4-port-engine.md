# Level 1 in the canal look — the port to the game (shared brief, 2026-11-11)

## 0. The request and the decisions

The user approved a repaint of mission `ams` (all six sections) that exists as a Python paint kit and a preview page
("Level 1 Repainted", v2). The user, 2026-11-11: "Port the new design to the first level. Ensure that the fidelity
and level of detail of the redesign you did is maintained. Also, I want you to fix the road/path that the player is
walking on from start to finish. There are elements that dont make any sense (bent bike path, light poles that
intersect the street, the drawbridge that doesnt make sense, etc.). Do a full audit".

| # | Decision | By |
|---|---|---|
| 1 | **Bake to image files.** The kit renders each layer at 1×, 2×, 4× to lossless image files; the game loads them per section. No TypeScript rewrite of the painters. This lifts "no image files at runtime" (`docs/ARCHITECTURE.md`) for the `ams` scenery only | user |
| 2 | **Straight street, hero on it.** Both kerbs are straight lines. The hero and the bike enemies move on the lane or the cobbles. Lamps, trees, benches, flags, planters stand on the pavements. The pavement "bulbs" of `docs/design/floor.md` §12.1 item 2 are rejected | user |
| 3 | The side canal of section a gets a clear open bridge (the form is being settled with the user; art work, lead + section agent) | user |
| 4 | **Art only, play unchanged.** Collision, terrain, spawns, scripts, timers, sound and every sim result stay the same. Hitbox objects keep their place | user |
| 5 | Scenery only. Figures, enemies, pickups and fx keep their art. Vincent is never scaled or resampled | user |
| 6 | Fidelity gate: a headless game frame of the scenery equals the kit's own composed frame at the same camera (§4) | lead |
| 7 | Every other mission (and `ams2`) draws byte-identically. `ams` changes on purpose | lead |
| 8 | No commit, no push, no deploy, no branch. Work on `main` in the working tree. The tree holds much uncommitted work of other waves (179 changed files): never revert, reformat or "clean up" it | standing |
| 9 | Never name a reference game in code, ids, comments or docs; write "the arcade reference" (`docs/ORIGINALITY.md`). Real Amsterdam names are fine | standing |
| 10 | Helper agents: none. Do the work yourself | lead |

## 1. Where things are

| What | Where |
|---|---|
| The kit (Python 3, numpy, Pillow): shared `level.py`, `parts_ams.py`, kit files; one `l1<id>.py` + `parts_l1<id>.py` per section (`build()` returns a `Sec`) | `tmp/l1/kit/` (git-ignored working copy; section agents may be editing section files while you work: only ADD files there, see your task) |
| How the page draws a section (the reference renderer, JavaScript) | `tmp/l1/kit/level.tpl.html` (`draw`, `blitRow`, the `rows` branch) and `level.py` `compose_level` (the same maths in Python) |
| The page's export (tiles + meta json per section and tier) | `tmp/l1/kit/export_l1.py`, `pack_l1.py`; output `tmp/l1/kit/site/l1/` |
| The look contract | `docs/design/canal-look.md` §3 |
| The game's layout dump the kit reads | `tmp/l1/kit/ams-layout.json` (made by `npx tsx tmp/l1/dump.ts`) |
| Baselines taken before this port | `tmp/l1/port/baseline-typecheck.txt`, `tmp/l1/port/baseline-tests.txt` |
| Engine facts gathered for this port | §5 of this file |

## 2. The architecture: the game draws the kit's layer stack

The approved picture is the kit's layer stack, drawn by the page. The port keeps that stack and draws it in the
game, in the same order and with the same maths. The game's perspective floor (`SectionFloor`) stays as GEOMETRY for
the entities (contact shadows, entity faces, `drawDepth`, depth steps); its own surface, faces, tops, overhangs,
prop rows and the old decor, background layers and terrain art are not drawn in a section that has a canal scene.

A section's stack (`Sec.layers`, in draw order; `over` layers are drawn after the entities):

| kind | What | Screen position of layer pixel (p, row j), camera x = cx |
|---|---|---|
| `img` | one image at one speed (sky, skyline, far bank, every plane `d<depth>` of things standing on the floor) | x = p − cx·speed, y = layer y + j |
| `tile` | wraps in x and drifts (clouds; `drift` in logical px per second) | x = p − cx·speed − drift·t, wrapped |
| `frames` | `n` frames at one speed (sun glitter), one step each 10 ticks at 60 Hz | as `img` |
| `rows` | each row has its own speed, linear from `s0` (first row) to `s1` (last row); `n` frames (the far water, the street floor, depth slices of decks, awnings, bridges) | x = p − cx·(s0 + (s1 − s0)·j/(rows − 1)) |

A plane of things at floor depth k has speed s = 1 − k/116 and holds a thing of world x at p = 192 + (x − 192)·s.
A `rows` layer is one affine shear of its image (x shifts linearly with the row), so it needs ONE draw call per
tile, not one per row.

All sections are 216 high: there is no vertical scroll in `ams`.

## 3. The bake contract (kit → game)

- Command (run from `tmp/l1/kit/`): `U=<1|2|4> python3 bake_game.py l1a [l1b …] --out <repo>/public/art/ams --manifest <repo>/src/game/content/missions/ams/canal/manifest.gen.ts`
  (the manifest holds all tiers; a run for one tier or section merges into it).
- Image files: lossless PNG, 8-bit RGBA (or 8-bit palette with tRNS when a file has ≤ 256 colours; the decoder
  must read both). Alpha is 0 or 255 only.
- Layers are cut into tiles of at most 256 logical px (in layer space), each cropped to its opaque box and aligned
  to whole logical pixels; empty tiles are dropped. Tiles are packed into few files per section and tier (sheets
  of at most 4096 × 4096 real px, or one pack file per camera window: your choice, see memory below).
- The manifest (generated TypeScript, typed): per section the layer list in draw order with `id`, `kind`, `speed` /
  `s0` / `s1`, `y`, `rows`, `n`, `drift`, `over`, the plane depth where the layer is a plane, and per tier the tiles
  (layer x, y offset, w, h, file, position in the file). Deterministic: two bakes of the same kit give the same bytes.
- 1×, 2× and 4× are three paintings of the same layout (never scaled from each other). The logical geometry of a
  layer is the same at every tier; the tile boxes may differ by tier.

## 4. Gates for every port agent

1. `npm run typecheck` clean. `npx vitest run`: no failure that is not in `tmp/l1/port/baseline-tests.txt`, except
   tests you changed on purpose (name each one and why in your report; never delete or loosen a test silently).
2. Sims of `ams` unchanged: `npm run sim -- --mission ams --section <k> --seed 7 --god --quiet` gives the same ticks
   and kills before and after, for every section you touch (record both).
3. **Fidelity:** for each ported section and tier, at five or more integer camera positions, the game's headless
   scenery frame (no entities, no HUD) equals the kit's `compose_level(sec, cx)` frame (no hero) pixel for pixel.
   A test holds this from files baked next to the art (`tests/fixtures/canal/…` reference frames, small crops are
   fine at tier 4). A difference must be explained and fixed, never tolerated by a fuzzy compare.
4. Other missions and `ams2`: frames byte-identical before and after (`npm run shot`; say which cameras you used).
5. No commit, push, deploy. Report: what changed (files), the gate numbers, what differs from this brief and why,
   what you did not check.

## 5. Engine facts (from a read-only survey, 2026-11-11; verify before you rely on a line number)

- Sprites: `src/engine/sprites.ts` (`defineSprite(id, gen, opts)`, `defineHdSprite`); a frame is
  `Frame { buf: PixelBuffer; ox; oy; … }`, `PixelBuffer` = packed `0xRRGGBBAA` in a `Uint32Array`
  (`src/engine/pixel.ts`, `PixelBuffer.fromRGBA`). No colour rule at run time (PAL / PAL_HD are checked by tests only).
- Tiers: `?art=1|2|4`; `artTier()`; a view's density `SectionView.drawDensity()` / `atRes` (4× needs renderer k % 4 == 0;
  res 1 always draws 1×). Mission `ams` has `artDensity` 4.
- Background layers: `BgLayerDef` (`src/game/art-registry.ts`), `SectionView.drawLayer` → `r.parallax(...)`; no frames.
- Decor at a floor depth: `SectionFloor.sortDecor` / `drawDecorAt` (`src/game/mission/floor/section-floor.ts`):
  x′ = x·s + (camX + 192)·(1 − s), y′ = y − depth − lift. Decor is culled when its anchor is > 256 px outside the view.
- Draw order with a floor: `docs/design/floor.md` §3.4; `SectionView.drawBack`, `drawBackFloor`, `drawShadows`,
  `drawFront` (`src/game/mission/view.ts`).
- Loading: generators are synchronous everywhere (main thread, art worker, node). The art worker has an async load
  hook (`createArtWorkerHandler(load, …)`, `src/game/art-pool.ts`). Sprite packs are cached in IndexedDB; background
  layers and terrain are not. Section start: `runner.ts` → `view.prepare(...)`, `enterDenseSection` (`gameplay.ts`).
- Memory: `DENSE_BUDGET_BYTES` 256 MB counts 4× sprite frames only (`tests/content/ams-dense-budget.test.ts`, worst
  case today 251.6 MB in a). The canvas renderer keeps one canvas per buffer in an LRU (`TEXTURE_BUDGET_PX` 48 M px,
  `render-canvas.browser.ts`).
- No image is loaded at run time today (only audio via `fetch`). Node-only PNG decoders exist in
  `tools/art/import-face.ts` and `tools/uhd-spike.ts` (`node:zlib`). `DecompressionStream` is used in
  `src/engine/sprite-pack.ts`. Headless drawing: `SoftRenderer` (`src/engine/render-soft.ts`), `tools/shot.ts`,
  `HeadlessGame.renderFrame`. Vitest runs in node.
- Service worker: `tools/sw/plugin.ts` precaches `index.html`, `assets/`, `audio/boot/`; other `public/` files are
  cached on first fetch. `tests/tools/offline-cache.test.ts` pins the precache list. CI: `.github/workflows/pages.yml`.
- Tests that pin the old `ams` scenery: `tests/art/ams-bg-hd.test.ts`, `tests/art/scenery-hi.test.ts` (+ fixture),
  `tests/art/ams-art.test.ts`, `tests/art/ams-ab-hd.test.ts`, `ams-cd-hd.test.ts`, `ams-terrain-hd.test.ts`,
  `tests/game/floor-street.test.ts`, `tests/game/ams-floor*.test.ts`, `tests/game/floor-sections.test.ts`,
  `tests/content/ams-dense-budget.test.ts`, `tests/game/boot-art.test.ts`, `tests/engine/hires.test.ts`.
- `ams2` reuses the `ams` section SCRIPTS (`src/game/content/missions/ams2/section-a.ts`): never change a script's
  x positions.
