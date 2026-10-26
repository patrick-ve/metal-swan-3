# The perspective floor — API (faux-3D streets for `ams` and `oldenzaal`)

Spec: `docs/design/floor.md` (the user's plan; §0 the decisions, §1 the model, §2 smooth, §3 the
engine, §4 Amsterdam, §5 Oldenzaal, §8 the gates). Built in wave A by CORE (this API), GL (the
WebGL2 program), AMS-A and OZ-A (the kits and the first sections), joined by INTEGRATE (the
section-start prefetch, the GL warm-up, the floor's lift, the mist hook, the budgets).

A section opts in with `SectionDef.floor: FloorDef`. Without it the section draws byte-identically
to before (the ring, m0–m5, the tower, the menus). The floor is ART ONLY: it reads the terrain and
the entities and never writes them; physics, collision, spawns, hitboxes, scripts and the sims do
not change (`tmp/floor-lead/id.sh` proves it).

## 1. Files and owners

| Part | Files |
|---|---|
| Engine (pure, headless-safe) | `src/engine/floor/`: `cam.ts` (the camera maths), `mesh.ts` (height field + mesh), `tex-layout.ts` (texture layout and sampling rules), `tex.ts` (texture store, art jobs, memory), `raster.ts` (the CPU raster), `quad.ts` (small textured quads: `QuadCanvas`, anti-aliased, on the 1/res grid; the canvas pool `QuadCanvasPool`), `gpu.ts` (the GPU contract, `NullFloorGpu`) |
| Game | `src/game/mission/floor/`: `types.ts` (`FloorDef`), `registry.ts` (painters, tiles, props, the tools' override, the GPU slot, the overlay flag), `section-floor.ts` (`SectionFloor`: one section's floor and all its passes), `faces.ts` (the face groups' geometry helpers, §8.1), `hooks.ts` (light hooks), `checks.ts` (gates 4 and 5), `debug.ts` (the debug floor), `builtin.ts` (built-in tiles), `scale.ts` (one-time frame scaling, in slices: `ScaleJob`), `place.ts` (`FramePlacer`: draws at sub-pixel positions without boxing a double) |
| Wiring | `SectionView` (view.ts) builds and draws it; `MissionRunner` passes the GPU, calls `drawShadows`, sets `World.depthDraw`, binds the world to the floor; `Entity.drawDepth`, `World.depthDraw` (render-only opt-ins); `AppOptions.floorGpu` |
| GL (wave A) | `src/engine/gl-floor.browser.ts` implements `FloorGpu`, created in `main.ts`, passed as `createApp({ …, floorGpu })` |
| Kits | `src/game/content/missions/ams/floor/`, `src/game/content/missions/oldenzaal/floor/` register painters, tiles and props and export each section's `FloorDef` |

## 2. Units, the camera, depth

Logical view 384 × 216, walk line `yw` = 176 (= G). World `u` = world x, `v` = depth (negative
behind the walk line, positive in front), `h` = height over the walk plane (`yw − world y`).

A real pinhole camera (spec §1.1, `cam.ts`): s(y) = (y − yh)/(yw − yh), v(y) = f·(1 − 1/s), y(v) =
yh + (yw − yh)·f/(f − v); a point projects to s = f/(f − v), x′ = 192 + (u − camX − 192)·s,
y′ = yh − camY + (yw − yh − h)·s. At v = 0 it is the plain 2D world: the walk line scrolls with the
world and the feet never slide. `camX`, `camY` are the RENDERER's camera (snapped to 1/res): the
one camera of the picture.

**DEPTH (the kits' unit):** screen px behind the walk line on FLAT ground — the spec's "shop fronts
at 14 px". A thing at depth D stands on the floor row at screen y `yw − D` and scrolls at
`s = 1 − D/(yw − yh)`. D 0 = the walk plane; D < 0 = in front (front rows). Convert with
`vAtDepth(cam, D)` / `depthAtV(cam, v)`; `sAtDepth(cam, D)`.

Drawing at a depth ("the shift and speed of that depth, no scaling", spec §1.3): renderer world x =
`shiftX(cam, x, D, r.camX)` = x·s + (camX + 192)·(1 − s), y − D − lift. The **lift**
(`SectionFloor.liftAt(x, D)` = s·(h(x, v) − h(x, 0)), screen px) puts the base ON the floor there:
a kerb-raised pavement (a `kerb` feature `from` the back edge) lifts the facades, lamps and wavers
on it by its height at their scale, so their feet stay on its rows and never slide. It is 0 on flat
ground, under the cylinder rule (a hump runs across the band: the 2D art already stands on it) and
over a gap of the ground. Decor (made once per item), `drawDepth` entities, the overhangs' back
edges and the light's `floorShift` all use it, so things at one depth stay together. Rows place
each prop on the floor's exact height already.

## 3. `FloorDef` (types.ts)

```ts
import type { FloorDef } from '../../../mission/floor/types';

export const A_FLOOR: FloorDef = {
  camera: { yh: 60, f: 210, back: 146 },                 // spec §1.1 (back: screen y of the back edge)
  painter: { id: 'ams/floor', params: { light: 'morning', layout: A_LAYOUT }, seed: 7 },
  features: [                                            // later features win
    { kind: 'kerb', to: 20, dh: 1.5, face: 'ams/kerb-face' },            // the far pavement (back edge → depth 20)
    { kind: 'kerb', from: -16.5, dh: 1.5, face: 'ams/kerb-face' },       // the near pavement (depth −16.5 → front)
    { kind: 'kerb', u0: 1904, u1: 2600, from: [[1904, 14], [2600, 14]], to: 7, dh: 1.5 }, // a bending line: [u, depth] points
    { kind: 'cut', u0: 1060, u1: 1340, level: -4, face: 'ams/quay-wall',              // the side canal
      surface: { tile: 'ams/water', du: 0.1, over: { tile: 'ams/water-glint', du: -0.07, alpha: 0.35 } } },
    { kind: 'deck', u0: 60, u1: 860, from: 9, to: -9, face: 'ams/deck-side' },          // a deck over a cut (put it AFTER the cut)
  ],
  baseFace: 'ams/kerb-face',                             // faces of profile steps; default face
  rows: [
    { name: 'back poles', sprite: 'decor/ams/bollard', depth: 19.4, spacing: 34, offset: 10,
      gaps: [[700, 900], [1040, 1360]] },
    { name: 'front poles', prop: 'ams/pole', depth: -16.5, spacing: 68, offset: 30, gaps: [[700, 900]] },
  ],
  overhangs: [
    { kind: 'awning', x0: 1980, x1: 2036, y: 132, depth: 14, colors: [0xd03030ff, 0xf0f0e8ff], stripe: 4 },
    { kind: 'slab', x0: 2296, x1: 2326, y: 96, depth: 14, tile: 'ams/ledge' },
    { kind: 'roof', x0: 600, x1: 640, y: 120, depth: 14, rise: 6, tile: 'oz/bay-roof' },
  ],
  tops: [{ x0: 1094, x1: 1176, y: 164, depth: 10, tile: 'ams/deck' }],   // a houseboat deck's top face
  faces: [{ name: 'house side', x: 1933, y: 176, depth: 14,              // side faces (§8.1): a row end's side wall
            faces: [wallFace(-27.5, 0, 89, 14, 30, -1, wallTile, 40)] }],
  openings: [{ x0: 1960, x1: 1984, from: 6, to: -6, tile: 'oz/manhole', ellipse: true }],
  decorDepth: (d) => (d.sprite.startsWith('decor/ams/house-') ? 14 : undefined),   // null = hide
  hideDecor: ['decor/ams/water-'],                       // sprite id prefixes to hide (old water pieces)
  shadow: 0.3,
  keepClear: [340, 1078, 2016, 3330],                    // spawn points, pickups, hostages, doors (front-row rule)
};
```

- `features` (spec §1.2): `kerb` / `step` / `raise` = the walk profile + `dh` over u0…u1 and the
  depths `from` (far edge, default the back edge) … `to` (near edge, default the front); `deck` the
  same with `dh` 0 by default; `cut` the absolute height `level` (water: `G − WATER_Y` = −4). A
  depth line is a number or `[u, depth]` points (straight in the WORLD between the points, constant
  beyond: a kerb bends over ≥ 32 px between stretches). Over a gap of the ground only a `level`
  feature applies (a `dh` feature has no profile to stand on); a gap without a cut is a pit
  (`pit`: 48 px deep, the built-in dark `floor/pit` tiles). **Never put a kerb across depth 0**:
  the walk-line test fails.
- `surface`: `'chunk'` (default: the painter), a tile id, or an animated tile `{ tile, du, dv,
  over: { tile, du, dv, alpha } }` (world-anchored drift in px per tick; two layers = a shimmer).
- Faces: wherever two neighbouring cells differ in height, a vertical face in the `face` tile of the
  LATER feature of the two (a pit's walls are always the pit's). Along a depth line only the faces
  that look at the camera are built (a kerb's front, a deck's near side, a pool's far wall); at a
  u breakpoint both directions are built and the renderers cull the one that looks away from the eye.
- `decorDepth(item, index)` (or `DecorDef.depth` per item, which wins): the depth of a decor item;
  `null` hides it; `undefined` = `defaultDepth` (back decor, default 0) or 0 (front decor).
  Back decor with depth > 0 is drawn far → near at its depth together with the back rows; decor at
  depth ≤ 0 is the walk plane (after the canopies). Parallax decor keeps its parallax x and moves up
  by its depth.
- `skyLayers`: background generator ids that are NOT lifted (default `sky-gradient`, `clouds`,
  `oz-sky`). Every other back layer is lifted by `yw − back` (the floor's depth behind the feet);
  its `factorX` must stay below s(back edge) (the factor test).

## 4. Registries (registry.ts) — the looks are the kits'

```ts
import { defineFloorPainter, defineFloorTile, defineFloorProp } from '../../../mission/floor/registry';

// The chunk painter: called once per density, returns the texel function. PURE in (u, v) (world px,
// texel centres), the density, the params and the seed — never screen coordinates or time.
defineFloorPainter('ams/floor', (c) => {
  const lane = c.vAt(20), near = c.vAt(-16.5);                // depths → world v
  return (u, v) => {
    if (c.featureAt(u, v) === 3) return CUT_EDGE;            // which feature wins here (-1 base, -2 pit)
    if (v < lane) return tiles(u, v, c.d, c.seed);           // the far pavement
    if (v >= near) return tiles(u, v, c.d, c.seed);
    return bikeLane(u, v, c.d, c.params);
  };
});

// A tile (faces, water, slabs, roofs, awnings without colours): repeats in both axes, h % 4 === 0.
// Tops: (a, b) = (u, v); faces: a along the face, b px below its top edge; quads: a = u, b across.
defineFloorTile('ams/kerb-face', { w: 16, h: 4, paint: (a, b, d) => (b < 1 ? GRANITE_LIT : GRANITE) });

// A procedural prop for rows: its frame at the final scale and density (feet anchor; point 'chain'
// for a row's `link`).
defineFloorProp('oz/post', (scale, d) => postFrame(scale, d));
```

The painter context: `d`, `params`, `seed`, `cam`, `heightAt(u, v)`, `featureAt(u, v)` (index in
`FloorDef.features`), `vAt(depth)`, `depthAt(v)`. The store box-filters far rows in v (§6), so a
painter paints plain pixel art at its density: no dither by screen position, no mip work.
Built-in tiles: `floor/pit`, `floor/pit-wall`, `floor/slab`, the awning stripes
(`ensureAwningTile(colors, stripe)`), and the debug set (`floor/debug-face`, `floor/debug-quay`,
`floor/debug-water`, `floor/debug-water2`, prop `floor/debug-post`, painter `floor/debug`).

## 5. Draw order (`SectionView` with a floor, spec §3.4)

1. background layers (non-sky ones lifted) → `backHook` (the light pass's far fog);
2. **the band** (`drawBand`): the GPU's image (`Renderer.surface`) or the CPU raster's
   (`Renderer.frame`, a streamed buffer), from `bandTop` (the floor's highest point at the back edge,
   minus a shake margin) to y 216;
3. flat openings (`openings`);
4. back decor and back rows (depth > 0), far → near;
5. canopies, slabs, roofs and top faces (`overhangs`, `tops`), then the walk-plane decor;
6. terrain chunks: platforms and solids only (the ground cells are EMPTY with a floor; no pit
   shafts — the floor's pits and cuts are in its mesh);
   then `floorHook` (`SectionView.floorHook`, opt-in: the light pass lays its ground mist here,
   under the entities, `MissionLight.drawGround`);
7. contact shadows (`MissionRunner.draw` calls `view.drawShadows(r, world)`), then `world.draw`
   (an entity with `drawDepth` ≠ 0 through `World.depthDraw`);
8. `drawFront`: front decor and front rows far → near (a front row over the walk-plane front
   decor), the front layers, the debug overlay (`setFloorOverlay(true)`); then the light pass.

## 6. Textures and sampling (tex-layout.ts, tex.ts) — the ONE rule for both renderers

- **Chunks** ("rows" textures): the painter's top surface per 256 u (`CHUNK_U`), (256·d + 2
  apron columns) × `rowsOf(cam, d)` texels at density d ∈ {1, 2, 4}. Row j IS the flat floor's
  screen row between y `back + j/d` and `back + (j+1)/d`, box-filtered in v when baked (the painter is
  sampled ⌈Δv·d⌉ times per texel, ≤ 8): far rows are pre-filtered for exactly their footprint, so no
  shimmer and no mips; on flat ground a band row is one texture row (crisp). Sample (u, v):
  `tu = (u − u0)·d + 1 − ½`, `tv = rowOf(cam, d, v) = d·(y(v) − back) − ½` (texel centres at integers;
  y(v) computed per pixel from the perspective-correct v); rows and columns clamp.
- **Tiles**: (W·d) × (H·d) level 0 plus its v-mips (rows halved, the foreshortened axis) down to ONE
  row: the mean along b of every column (`bakeTile`; an odd level's last row takes three rows).
  Sample `tu = a·d − ½`, `tv = b·d·(rows_L / rows_0) − ½` (= b·d/2^L for L ≤ 2), wrapping. The BAND
  (both renderers) uses the first `BAND_TILE_LEVELS` (3) levels, `L = round(log2(fb))` clamped to
  0…2 (the GL atlas uploads only those); the quads and face groups use the whole chain
  (`chainLevel`), the level from the real footprint: per column of a constant-u face (a side wall:
  b is constant down a column), per row of a level top, else per pixel — a side seen almost
  edge-on shows its calm mean colour, never noise (spec §2.3). An animated layer samples
  (u − du·tick, v − dv·tick).
- **Sharp bilinear** per axis: weight `clamp((t − ½)·max(1, m) + ½, 0, 1)` with m = output px per
  texel: crisp texels, a soft edge one output px wide, plain bilinear when minified.
- **Store** (`FloorTextureStore`): `chunk(k, want)` / `tile(i, want)` give the best texture ready at a
  density ≤ want (4 → 2 → 1) and make sure `want` is coming: built at once headless; queued as art
  jobs in the browser (`queueArtJob`, run by the budgeted preload or SectionView's `runArtJobs`): a
  2× chunk in 4 slices of 64 u, a 4× chunk in 32 slices of 8 u (`sliceU(d)`; a 1× chunk is built
  whole), a tile in jobs of `TILE_SLICE_TEXELS` level-0 texels (its mips with the last) — every
  floor job under ~5 ms, so a frame that runs jobs stays inside its 8 ms job budget plus one small
  job; nothing ready at all → the small 1× texture on the spot. A denser chunk replaces its
  stand-ins (the lower densities are released when it is published). `prefetch` (the next chunk
  ahead; below 4× also the one behind; none past the mesh), `evict` (≥ `FLOOR_EVICT_BEHIND` = 2
  chunks left of the view, a 4× one `FLOOR_EVICT_BEHIND_4X` = 1 chunk once the view is
  `EVICT_MARGIN_U` past it), `prefetchTile` / `releaseTile`, `bytes(d)`, `pendingBytes()` (chunks
  being painted), `capped`: over `FLOOR_BUDGET_BYTES` (16 MB of 4× textures with the ones being
  painted) the store builds no NEW 4× texture — a resident one still draws (never a step down: no
  pop, no seam) — and the cap clears again once the eviction has made room for `CAP_CLEAR_CHUNKS`
  (3) chunks. With the windows below the cap is a guard: no wave-A section reaches it.
- **Tile windows** (`SectionFloor`, every frame in `maintain`): a tile is built while something that
  draws it (a mesh quad of its material, a canopy / top / opening, a face group) lies within
  `TILE_AHEAD_U` (384) past the view's right edge, at the density it draws at: the band's materials
  and the openings at the band density, every other tile (canopies, tops, faces) at ≤
  `QUAD_MAX_DENSITY` (2×) — a 4× face tile would never be drawn. Its textures are released once
  everything that draws it is `TILE_BEHIND_U` (128) left of the view.
- **Section start** (`SectionView.prepare` → `SectionFloor.prepare(camX, want)`, spec §2.6). Both
  flows — a direct `?mission=` start and the menu (the intro card) — prepare the same way: the
  gameplay scene's `preloadMissionArt` turns on the deferred dense art before `runner.start()`, so
  at art tier ≥ 2 `want` is the view's density (4 at tier 4), measured in the browser for both
  flows (`prepare camX 0 want 4 deferred true tier 4`). The load tick builds the visible chunks at
  1× and the windowed tiles at 1× on the spot, and the rows' prop frames at 1×; it queues as art
  jobs the dense visible chunks and the next one, the windowed tiles' dense textures, and the rows'
  dense frames (scaled in slices, `ScaleJob`); and it sizes the canvas pool (§8). Before any floor
  has drawn, a GPU that will not draw (`live()` false: `?floorgl=0`, no WebGL2, a lost context)
  caps the dense set at its `cpuCap` (2); after that the band density the last floor drew at caps
  it. The first frames of play draw the 1× floor and upgrade as the jobs finish (a still camera
  shows the swap in frames 2–4 of a direct 4K start); no frame of play waits for a bake or scales a
  prop. The mission preload warms the GPU floor (§7).

## 7. The GPU contract (gpu.ts) — for GL

```ts
export interface FloorGpu {
  readonly cpuCap: number;                  // the CPU fallback's highest density here (browser 2; headless 4)
  render(frame: FloorFrame): unknown | null; // the band image (any size, drawn over the band's logical rectangle), or null → the CPU raster
  release?(meshId: number): void;           // the section's floor is gone
  warm?(): void;                            // make the context, start the compile (no blocking); idempotent
  live?(): boolean;                         // will render() draw (on, not failed, not lost; true while unknown)?
}
```

The browser's GPU (`src/engine/gl-floor.browser.ts`, GL):

```ts
const floorGl = createGlFloor({ enabled: q.get('floorgl') !== '0', res: () => renderer.res }); // main.ts
createApp({ …, floorGpu: floorGl });
floorGl.warm();        // the mission preload does it (registry `warmFloorGpu(mission.sections)`, gameplay.ts
                       // `preloadMissionArt`, at every tier) when a section of the mission has a floor
floorGl.ok / .reason;  // the feature check (reading them makes the context and finishes the compile)
floorGl.stats();       // { cpuMs, avgCpuMs, frames, res, density, w, h, quads, uploads, texBytes, bufBytes, initMs, … }
floorGl.atArtDensity;  // debug knob: draw at the band's density instead of the backbuffer res
```

It draws the band at the BACKBUFFER res R = k (the band lands 1:1 in `Renderer.surface`; "sharp
bilinear" has its soft edge one backbuffer px wide) with the art tier's textures; the program
compiles in the background (KHR_parallel_shader_compile; the CPU raster draws the frames until it
is linked). In the page: `window.__ms3.floorGl.stats()`.

`FloorFrame` (one reused object per floor): `cam`, `mesh` (static per section; upload once per
`mesh.id`), `materials` (tile layers with du, dv, the `over` layer and its alpha), `camX`, `camY`,
`eyeU` (camX + 192), `tick`, `density`, `bandTop`, `bandH`, the visible quads `q0 … q1 − 1`,
`storeVersion`, `chunk(k)` and `tile(i)` (the best ready texture: upload each `key` once; textures
never change after they are published). The mesh (mesh.ts): quads of 4 vertices (triangles 0-1-2,
0-2-3), positions `pu, pv, ph` (world), texture coordinates `ta, tb` (world px), `quadMat` (−1 =
the chunk `quadChunk`, else a material), `quadKind` (`QUAD_TOP`, `QUAD_FACE_V`, `QUAD_FACE_UP`:
draw only while eyeU > its u, `QUAD_FACE_UN`: only while eyeU < its u). Depth test: larger
s = f/(f − v) is nearer. The CPU raster (`FloorRaster`) is the reference picture.

Wiring (main.ts, GL's): `createApp({ …, floorGpu: createGlFloor(…) })` registers it
(`setFloorGpu`); every `MissionRunner` takes it (`RunnerOptions.floorGpu` overrides). Without
WebGL2, after a lost context or with `?floorgl=0` the GPU returns null and the CPU raster draws at
most `cpuCap` (2).

## 8. Rows, quads, shadows, depth steps (section-floor.ts)

- **Rows** (spec §3.6): placed once (`spacing` / `offset` / `at`, `gaps`, `u0 … u1`), each prop on
  the floor's height at its (u, depth); the frame is scaled ONCE per row and density (`scaleFrame`;
  in the browser a dense one as art jobs of a few ms, `ScaleJob` slices, the 1× frame drawing
  meanwhile; rebuilt the same way when a finer source frame arrives — a row never makes a sprite's
  dense art itself), drawn at 1/res positions with its row's speed. `link` hangs a chain frame
  (made with the row's frame, one per span length) between neighbours. Front rows (depth < 0) are
  drawn over the world. Rules: `frontRowViolations(section)`, gate 5 (§10).
- **Overhangs** (spec §3.5): a quad from the facade (back edge at its depth's shift and lift,
  `rise` higher for a roof; with `anchorX` exactly on the unscaled facade art) to the platform line
  (v = 0, world y `y`); awnings in two stripe colours, slabs and roofs in a tile. **Top faces**:
  from the top edge (v = 0) back to `depth`, true perspective (`y1` slopes it). **Openings**: flat on
  the floor's surface at v = 0 (`ellipse` for round covers). Overhangs and top faces draw at ≤ 2×
  (`QUAD_MAX_DENSITY`: they are rasterised and streamed per frame; the 4K budget), openings at the
  band's density; a still camera redraws none.
- **Canvases** (quad.ts): the quads and the face groups share ONE pool (`SectionFloor.pool`,
  `QuadCanvasPool`): a thing on screen holds a canvas of the power-of-two width class its box needs
  (and of its height class), gives it back when it leaves the view; `prepare` makes the canvases
  for the most of each size that ever show at once (`planCanvases`: every camera of the section,
  every 2 px, made once per floor def), so the frame path makes none. A canvas sits on the
  renderer's grid, not on whole logical px: its origin is aligned to the sprite the quad joins (a
  facade, a valance, a prop's top edge, a face group's anchor: the joined edges meet it exactly)
  and it is drawn in world space (1/res steps); its silhouette is anti-aliased (coverage → alpha;
  the `aa` edge mask of `QuadCanvas.quad`; edges shared by two faces of a group and a side's front
  edge on its facade stay hard, no seam), so every edge moves with the world in backbuffer px.
- **Contact shadows** (spec §3.7): a dithered oval under every live entity tagged `player`, `enemy`
  or `npc` whose feet are ≤ 48 px over the surface below it (`terrain.surfaceY`), smaller and
  fainter with height, at `FloorDef.shadow` (default 0.3). Entities with `drawDepth` get none, and
  so do entities that are not drawn now: `Entity.castsShadow` (render only, default true) — a
  zombie hidden under the ground or behind the boards (`DeadSoldier`: `!hidden`), a pigeon flock
  that flew off. A blinking hero and a hero on a vehicle (drawn by it) keep theirs.
- **Depth steps**: `entity.drawDepth = 14` (render only) draws it at that depth's shift, speed and
  lift, no scaling (`World.depthDraw` → `SectionFloor.drawAtDepth`). Rule (spec §3.7): only while it
  can neither hit nor be hit (an intro, an emergence ≤ 30 ticks) or for cosmetic entities, and fx
  (they can neither hit nor be hit). Wave A uses: the window wavers (14) and the baker (7) in `ams`
  a; the boarded openings (14) in oz-a. The dead who burst out of an opening are hittable from their
  first tick out of hiding, so they are drawn in the walk plane from then on (art and hitbox
  together); the step-out shows in the fx instead: the dust of the tell at the opening's depth, the
  planks thrown out of the drawn opening toward the street (14 → 0 over 24 ticks). The fx are
  spawned at their walk-plane spots exactly as without a floor (the sims never see the floor) and
  get only a render-only `drawDepth` (oldenzaal kit `FxDepths`, flat.ts, which also sets it back to
  0 before a pooled fx entity is reused; the entity pool, `src/game/pool.ts`, resets `drawDepth` to 0
  for every reuse too). What a hittable entity sits on (a lamp a gull sleeps on,
  the elm with the secret bike) stays in the walk plane with it, on a pavement bulb or a square
  (street logic, spec §11 R2: the `ams` kit's `Bulb`, layout.ts).

### 8.1 Face groups: side faces in perspective (spec §11 R1)

A prop's flat 2D edge shows its side: `FloorDef.faces` is a list of `FaceGroupDef` — an anchor (a
decor item's `x`, `y`, `depth`: its sprite px are the corners' units; it stands on the floor there,
`liftAt`), an optional `order` (the depth it is drawn at among the decor and rows; default `depth`),
`front` (drawn over the world with the front decor) and `faces`. Each `FaceDef` has four corners
`[x, y, depth]` (x right of the anchor, y UP from its base, in the anchor depth's sprite px) or
`[x, y, depth, 1]` (world px: x right of the anchor, y over the walk plane), the tile px of each
corner and a tile id. The engine resolves a sprite-px corner to the world point the anchor's decor
draws there (u = x_a + x / s_a, h = (y_w − y_a + lift + y) / s_a), so a side's front edge lies exactly on
its sprite's edge for every camera and the side recedes in true perspective; it shows a face only
while its corners run clockwise on screen (it faces the eye; `both: true` for a thin panel), so a
side narrows to nothing as its prop crosses the screen's centre column and then the other side
shows. Groups draw far → near with the decor and rows, BEFORE every decor item and row at their
`order` (a facade covers its own edge; a nearer neighbour covers the side behind it); back groups go
with the deep list (a walk-plane box's sides before its top faces and its sprite).

```ts
import { capFace, quadFace, slopeFace, topFace, wallFace } from '../../../mission/floor/faces';
// A side wall at x (constant u) from y0 to y1, from depth `front` (the NEARER one) to `back`; side −1 =
// the left side (faces −u), +1 the right; l = the tile px of the depth span (b), a0 = the tile's a at the top.
wallFace(kx, 0, eave, 14, 30, -1, wallTile, l);
slopeFace(kx, eave, ridgeX, ridgeY, 14, 30, -1, roofTile, l);   // a pitched roof's side (eave → ridge)
capFace(0, 15, 0, 140, -13.5, endTile, true);                   // a face toward the camera at one depth
topFace(-1, 1, 12.6, 18, 1.7, armTile, l, true);                // a level top (seen from above)
quadFace([nt, ft, fb, nb], tex, tile);                           // any quad (a triangle repeats a corner)
```

Tiles: `defineFloorTile` as for faces, with a = down the face (along the profile) and b = back in
depth from its front edge (the foreshortened direction: tiles mip along b, down to the one-row mean).
Drawing: a pooled canvas per group on screen (above), its faces perspective-correct from their tiles
at ≤ 2× (`QUAD_MAX_DENSITY`); a face of one u (a side wall) is rasterised in columns (one texture row
and one mip level per column: exact and cheap), the others in rows with the level per pixel; a still
camera re-rasterises nothing. The kits' builders: `ams` `houseSides` (row ends, alleys,
a house taller than its neighbour; wall + slate roof side), `boatSides`, `boxSides`, `railPostSides`,
`drawbridgeFloor` (the raised leaf, the barrier arms; `drawbridge.ts`); oldenzaal `shopSides`,
`carSides`, `wallSides`, `overhangSides` (awning cheeks, balcony ends). `tests/game/floor-faces.test.ts`
holds the rules (facing, narrowing, the front edge on the sprite, the draw order, the canvases, a
narrowing striped side that keeps its colour steady — the wave-A sampling fails it).

A MOVING entity's faces belong in the entity's own draw, not in `FloorDef.faces` (a face group is
static): the `ams` kit's `RowboatFaces` / `withRowboatFaces(entity)` (`ams/floor/boat.ts`: the
rowing boat's open hull and the end toward the centre column, per frame at its x and bob; a
render-only draw decoration where section a's script spawns it). Wave B: put it in the entity's
`draw` (`worldFloor(this.world)` → the faces before the sprite), so section c's boats get it too.

## 9. Light hooks (hooks.ts) — for OZ-A's light pass

```ts
import { worldFloor, floorShift, floorPool, floorProject, decorDepthOf } from '../floor/hooks';
const floor = worldFloor(this.world);                    // null: no floor in this section
if (floor) {
  floorShift(floor, lamp.x, lamp.y, 14, r.camX, pt);       // a lamp glow at its lamp's depth and lift (renderer world coords)
  floorPool(floor, lamp.x, 14, 40, r.camX, pool);          // its pool: centre (renderer world coords), rx, ry (screen px)
  decorDepthOf(floor, item, index);                        // the depth the floor draws a decor item at
  floorProject(floor, u, v, h, r.camX, r.camY, pt);        // any world point on screen
}
```

## 10. Checks and tests a section joins automatically

`tests/game/floor-sections.test.ts` runs, for EVERY registered section with a `floor` (wave B joins
by itself; `EXPECTED_FLOORS` lists the ones that must be there, so a floor that disappears fails):
- `walkLineErrors` (gate 4: the DRAWN mesh at v = 0 vs `yw − groundY`, every px, ±0.5),
  `overhangErrors` (front edges on platform lines), `factorViolations` (lifted layers' factorX <
  s(back edge)), `frontRowViolations` (front props ≥ 34 px apart, ≤ 8 px wide, top below G − 14,
  ≥ 24 px from the player start, the exits and `keepClear`);
- GATE 5 over a bot run: `frontCoverHits(floor, world)` — everything drawn over the world (front
  decor, front rows' props, front face groups: `SectionFloor.frontBoxes`, their opaque pixels) vs
  every hero's head (the top 10 px of its hitbox, at most 40 %) and gun (its muzzle ± 3 px);
- no contact shadow where nothing is drawn (the same bot run);
- THE PAN TEST (0.5 and 2 px/tick, res 1 and 2, every flat row of its real floor moves s(y)·Δ
  within 1/res) and THE STILL TEST on its real floor;
- the face groups' sampling: the footprint left after the mip level ≤ √2 for every group over a pan
  (the cause of M2's shimmer; the wave-A sampling reached 860–1200);
- the edges of a side wall and of a canopy at res 4 and 8: each step within about one backbuffer px
  of the even motion (the wave-A ½-px grid fails it);
- the ground mist's rows (a section with a mist) move at s(y)·Δ within 1/res;
- THE MEMORY TEST: `cpuBytes()` ≤ 16 MB over a walk at tier 4 in the browser's flow (deferred jobs,
  the band on a GPU), the store never caps, the frame path makes no canvas;
- the frame path allocates nothing: 600 frames of every pass, heap-sampled (< 64 B per frame in the
  floor's code; no object, array, closure or boxed double).
It also builds the debug floor on every horizontal `ams` / `oldenzaal` section (the mesh against
every real profile). `tests/game/floor-raster.test.ts`: the walk-line rows, a closed band, THE PAN
TEST and THE STILL TEST on the debug floor, the animated material, the band buffer reused.
`tests/engine/floor-math.test.ts`: the camera, the mesh against the field, the textures and the mip
chain. `tests/game/floor-faces.test.ts`: §8.1. `tests/media/browser-floor.test.ts`: GL = CPU on
every kit's own floor (a missing one fails) and THE PAN TEST on the GL path (R = 4).

The kits' own (FIX-STREET, wave A): `tests/game/floor-street.test.ts` — the generic street guard for
EVERY floor section: nothing but traffic stands in the bike lane or on the cobbled roadway at its u
(`ams`: `roadwayAt(layout, u, vAt)`, layout.ts, the lane or the roadway between the kerb lines, a
deck between its granite edges, a raised leaf's hinge pit; oldenzaal: `townGutter(params, vAt)`,
the gutter), computed from the kits' layout data and the sections' own decor, rows, face groups
and the props, pickups and hostages a bot run meets (a section on a new painter fails until its kit
gives a keep-free map); `tests/game/oz-floor.test.ts`: nothing reads as blood — EVERY registered
`oz/` floor tile (kit tiles, awnings, the face tiles) and the whole painted band, at d 1 / 2 / 4 and
every light level (no dark wine: lum < 50 with redness ≥ 30).

## 11. Tools

- `npm run shot -- --mission ams --section a --x 800 --res 2 --floor-debug [--floor-overlay]
  [--floor-off]`: the debug floor (checker of 16 px cells, u labels behind the walk line, v labels,
  the red v = 0 line, features tinted, kerb faces orange, a debug-water cut with brick quay walls on
  every water hazard, post rows) on ANY section; the overlay draws the depth lines every 10 px, the
  back edge, the band top, the row lines and the walk line; `--floor-off` draws a floor section
  without its floor.
- `npm run floor-clip -- --mission ams --section a --x 60 --ticks 150 --hold right,fire --every 1
  --count 150 --res 2 --out tmp/floor-lead/clips/x` → `x/f0000.png …` + `x.mp4` (60 fps at --every
  1, ffmpeg when installed). `--pan v`: a render-only camera pan (v px per frame, the floor's clock
  runs). `--bench`: frame and band times (avg / p95 / max) and the floor's texture memory.
- In the browser: `?debug=floor` draws the overlay (main.ts), `?floorgl=0` keeps the GL floor off.

The light pass (`light/pass.ts`, `light/floor.ts`) with a floor: lamp glows at their lamps' depth,
pools on the floor, the far fog lifted, and the GROUND MIST drawn through the view's `floorHook`
(`MissionLight.drawGround`, under the entities; `mistUnder`), at most 2× (a soft noise).

## 12. Budgets (spec §2.6, §3.2, §8)

The floor's whole CPU memory is ONE number, `SectionFloor.cpuBytes()`: the texture store (resident
and being painted), the canvas pool, the rows' frames and chains, the shadow ovals and the CPU
band (released once the GPU draws). The measured numbers of wave A (node and Chromium on an Apple
M5, `ams` a and oz-a) are in `docs/ARCHITECTURE.md` §10 (the floor tables): the CPU raster, the GL
path's CPU time, render + present at k = 8, the CPU fallback, memory (CPU and GPU), the art jobs and
the section start.

## 13. The kits' street API (FIX-STREET, wave A; for wave B)

```ts
// ams layout (layout.ts): pavement bulbs (`bulb(u0, u1, u2, u3, far0, near0, near?, far?)`, flush;
// bends ≥ 32 world px; a bulb under every walk-plane thing the script keeps: lamps with gulls, the elm,
// stalls, carts, racks, the pickup crates at their script x — bulb A from 372, the herring bulb to bridge 2)
const layout: StreetLayout = { …, bulbs, stops, landings, hingePits: [{ u0: 1045, u1: 1060, far: leafNearDepth }] };
roadwayAt(layout, u, (depth) => floor.vAt(depth));          // [far v, near v] of the lane / roadway at u, or null
laneMidV(vF, vN, cam.f, cam.yw - cam.yh);                    // the painter's centre line (world v)
withRowboatFaces(ctx.spawn('ams-boat-platform', 640, 172, { range: 300 }));   // a moving boat in perspective
// fail soft while a section module loads: a kit that throws logs once; the section has no floor
floor: kitFloor('ams/b', () => bFloor(decor)), …kitDecor('ams/b', () => [frontRailDecor(B_BRIDGE)])
export const OZ_B_FLOOR = ozKitFloor('oldenzaal/oz-b', () => ({ … }));
// oldenzaal: the gutter (nothing stands in it); the town painter's flush stone strip under the front posts
townGutter(params, vAt);
painter: { id: 'oz/town', params: { …, stripFar: -16.6, stripNear: -19.6 } }
// a burst's fx at the front's depth, render only (spawned at their walk-plane spots; reset before reuse)
const fxd = new FxDepths(); fxd.add(dustAt(w, x, y, 1), frontDepth, 1 << 20, 1); // tick() each update, clear() in onRemove
```

The raised drawbridge leaf stands over the lane's far half only (far kerb → the lane's centre line,
behind the heroes' feet); the bank in front of it is the hinge pit's steel plate (`hingePits`, the
painter); the near half of the lane ends at its stop line.
