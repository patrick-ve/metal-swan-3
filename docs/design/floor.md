# The perspective floor — faux-3D streets for `ams` and `oldenzaal` (spec, 2026-10-25)

The user (2026-10-25) is not happy with the flat 2D floor: today the feet stand on the top edge of
a thin ground strip, and a wall face fills the space below it. The user wants the reference game's
faux-3D walking area: the ground's top surface seen from a high angle, the feet inside a floor
band with floor behind and in front of them, props in front that overlap the feet, props with top
faces, and a walk line that follows the ground's contours.

A mock-up round came first (the private page "Swan Floor Bench": three directions per level, each
with a still, a zoom and a motion clip, made from scratch tools over real game frames). The user
picked **line scroll** for both levels and asked for the changes in §0. The mock-up's code and
frames are kept for the builders in `tmp/floor-mock/` (git-ignored; `README.md` there).

This file is THE SPEC for the floor waves. Detail values (horizons, row depths, spacings, tones)
are start values from the mock-up; the builders may tune them when the frames show a better value,
and the report says what changed and why.

Originality: `docs/ORIGINALITY.md` applies in full. Never name a reference game in code, ids,
comments, docs, prompts or commit messages. Real place names stay allowed (the existing `ams` and
`oldenzaal` exceptions).

## 0. Decisions

| # | Item | Decided by |
|---|---|---|
| 1 | **Art only.** No depth movement (no belt-scroller walking up and down). Physics, collision, spawn points, hitboxes, scripts and the sims do not change | user |
| 2 | **All 2D levels:** every section of `ams` (a, b, c, c1, c2, d) and of `oldenzaal` (oz-a … oz-e). The ring is dormant; `rally` and the first-person floors are 3D; m0–m5 will be scrapped | user |
| 3 | **Line scroll** for both levels: every floor row scrolls at its own depth speed (true perspective), and so do the prop rows | user |
| 4 | **Smooth:** no jitter, no shimmer, no stepping rows, 60 fps at every art tier (§2) | user |
| 5 | Amsterdam: the hero walks between **two rows of Amsterdammertjes**, one behind (far kerb) and one in front (near kerb, it covers the legs) | user |
| 6 | Amsterdam: the **bike lane alternates with the cobblestone street**. The change is a **kerb crossing**: the red lane ends with white shark teeth and a low sloped kerb, a granite band crosses the floor at an angle (in perspective), then the cobbles start (§4.2) | user |
| 7 | The **bike symbol is painted for the cyclist**, like the real Dutch marking: a rider who rides along the lane reads it upright. Each half of the lane has its own symbol for its riding direction (keep right). From the camera it lies turned 90° and the perspective squashes it (§4.3) | user |
| 8 | Oldenzaal: the line-scroll direction of the mock-up: sandstone pavement, kerb, a gutter of dark setts, the red-brown herringbone street, iron posts with chains in two rows | user |
| 9 | Inside the Plechelmus church: **the nave (oz-d) and the crypt (oz-e)** get the floor. The tower (oz-f) stays as it is (a vertical climb on landings) | user |
| 10 | **A look stop after wave A** (the engine + `ams` a + oz-a): the user looks and plays, then wave B builds the rest | user |
| 11 | Every worker agent at effort **xhigh**, never max | user (standing rule) |
| 12 | Floor depth as shown in the mock-up: about 30 px of floor behind the feet in open views, 14 px where the heroes climb on shop fronts, 40 px in front (to the screen bottom) | lead (shown, not objected) |
| 13 | **Contact shadows on** (a soft oval under every hero, enemy and npc near the floor), as in the line-scroll frames | lead (shown, not objected) |
| 14 | Front-row rules: thin props only; at least 34 px apart; never over a spawn point, a pickup or a hostage; a front prop covers legs, never heads, guns or bullets (§3.6) | lead |
| 15 | The materials stay as clean as the line-scroll mock-up. The extra grit of the other directions (puddles, leaves, rubble, newspapers) comes only when the user asks for it at the look stop | lead |

## 1. The model

### 1.1 The camera

The screen is the logical 384 × 216 view. The walk line is the physics surface, `G` = 176 on flat
ground. Line scroll is a real pinhole camera that moves with `camX`:

- the horizon `yh` (screen y), the focal length `f` (world px), the walk line `YW` = 176;
- a floor row at screen y has the scale `s(y) = (y − yh) / (YW − yh)` (1 at the walk line);
- its depth is `v(y) = f · (1 − 1/s(y))` (world px: negative behind the walk line, positive in
  front), and back: `y(v) = yh + (YW − yh) · f / (f − v)`;
- a world point (u along the street, v depth, h height over the walk plane) projects to
  `s = f / (f − v)`, `x' = 192 + (u − camX − 192) · s`, `y' = yh + (YW − yh − h) · s`.

At v = 0 this is the normal 2D world: `x' = u − camX`, `y' = YW − h`. So the walk line row scrolls
exactly with the world and the feet never slide. Rows behind it scroll slower, rows in front
faster. `camY` (shake) moves the whole picture as today.

Start values (tuned in wave A against the mock-up; one camera per section):

| Sections | `yh` | `f` | back edge of the floor | front |
|---|---|---|---|---|
| `ams` a, b, c, c1, c2, d | 60 | 210 | y 146 (30 px behind the feet) | to y 216 |
| oz-a, oz-b | 56 | 200 | y 162 (14 px: climbable shop fronts) | to y 216 |
| oz-c (the open square) | 56 | 200 | y 150 (26 px) | to y 216 |
| oz-d (the nave) | 58 | 200 | y 148 (28 px) | to y 216 |
| oz-e (the crypt) | 64 | 190 | y 160 (16 px: low and cramped) | to y 216 |

### 1.2 The floor is a height field

The floor is a height field `h(u, v)` with a material map, in world px:

- On the walk line (`v = 0`) the height is the physics walk surface: `h(u, 0) = G − walkY(u)`, for
  the ground polyline (bridges' humps, slopes, steps). A test holds this for every u (§7, gate 4).
- Away from the walk line the default is the **cylinder rule**: every depth row has the same
  height profile as the walk line (a bridge's hump runs across the whole band).
- Features break the rule on purpose: **kerbs** (a 1–2 px step with a lit face), **water cuts**
  (the surface drops to the water level and quay walls rise at the cut's ends, receding in
  depth), **bridge decks over water** (a raised strip around v = 0 with water before and behind
  it), **steps** and **the choir's steps** in the nave (behind the walk line only).
- Vertical faces (kerb faces, quay walls, deck sides, steps) come out of the height field with
  their own wall materials.

A raised walk surface with walkable ground under it (the ramp of `ams` c, the pew barricades of
the nave, coffins on trestles) is NOT in the height field: it is a walk-plane prop with a top face
(§3.5), because two walk surfaces cannot share one (u, 0).

### 1.3 Depth for everything else

| Thing | Where it goes |
|---|---|
| Sky layers (gradient, clouds, sun) | as today |
| Other background layers | lifted by the floor's depth behind the feet (`YW − back edge`); their `factorX` must stay below `s(back edge)` (a test checks every section) |
| Back decor (houses, lamps, trees, benches) | at a depth: its base sits on the floor row of that depth, and it scrolls with that row (`x' = 192 + (x − camX − 192) · s`); drawn at its own size |
| Shop fronts you climb on | at 14 px (`ams` shopping street, oz-a, oz-b) |
| Platforms on those fronts (awnings, balconies, bay roofs, gable ledges) | the platform stays where physics has it; its art becomes a canopy or slab that sticks out of the front (back edge on the facade, front edge on the platform line) (§3.5) |
| Walk-plane props (cars, low walls, houseboats, market stalls, pews, coffins, the hot-dog stand) | at v = 0 as today, plus a top face |
| The back prop row | on the far kerb, scaled and scrolled by its row depth |
| Entities | at v = 0 (physics); a few get a render-only depth step (§3.7) |
| The front prop row | on the near kerb, scaled and scrolled by its row depth, drawn over the world |

## 2. Smooth (the user's must)

The mock-up shimmered in motion for known reasons: it dithered in screen space, it point-sampled
far rows that are smaller than the texture, and it rounded the camera to half pixels. The build
fixes all of them:

1. **One camera.** The floor, the rows and the decor use the renderer's camera (snapped to 1/res,
   like the world). Nothing snaps to whole logical pixels.
2. **Texture space only.** Every floor detail (dither, noise, joints, symbols, stains) lives in
   world (u, v) space, baked into the floor textures. No floor code reads the screen x or y.
3. **Filtered sampling.** The floor samples with "sharp bilinear" (crisp texels with a soft edge
   one backbuffer pixel wide) and mip levels, so far rows (smaller than the texture) do not
   shimmer and near rows (up to 1.35× larger) do not stair-step.
4. **Continuous speeds.** Each row moves at `s(y)`, continuous over the band; no row stands still
   while the camera moves.
5. **Prop rows** are scaled once per row (not per frame) and drawn at 1/res positions.
6. **Frame time.** The browser path costs ≤ 0.5 ms CPU per frame at every tier for the floor's own
   code, and ≤ 1.2 ms at 4K with the Canvas 2D draws it hands the renderer (decor, prop rows, face
   and quad canvases; lead decision after the wave-A fixes); no bake on the
   frame path (floor textures are prefetched as art jobs ahead of the camera; a texture that is
   not ready draws its lower density).
7. **Proof.** (a) A headless pan test: for camera speeds 0.25, 0.5, 1, 2 and 3 px/tick, the phase of
   every floor row (measured by cross-correlation between frames) moves `s(y) · Δ` within 1/res.
   (b) With the camera still, two frames of the floor are equal. (c) A browser capture at 60 fps
   of a pan in every section, for the lead and for the user's look stop.

## 3. Engine (wave A, group CORE, unless another group is named)

### 3.1 Data

`SectionDef.floor?: FloorDef` is an opt-in. A section without it draws byte-identically to today
(the ring, m0–m5, the tower, the menus).

`FloorDef` holds: the camera (`yh`, `f`, the back edge); the height-field features (kerbs, cuts,
decks, steps) on top of the walk profile that CORE derives from the terrain; the **floor painter**
(a pure function of world (u, v) → colour at density d, written per mission, with its materials
and decals); the prop rows (§3.6); the depth of each decor item (by sprite id or by item, with a
default); the shadow strength; the light hooks (§3.8).

### 3.2 Floor textures

- Chunks of 256 world px along u × the full depth range, at density 1, 2 and 4, painted by the
  floor painter, with two mip levels (and anisotropic filtering on the GPU where the device has
  it: the depth axis is foreshortened).
- Built as art jobs (the pool at tier 4, like the dense terrain chunks), prefetched ahead of the
  camera, released behind it (`EVICT_BEHIND_CHUNKS`).
- Budget at tier 4: ≤ 16 MB of floor textures on the CPU side and ≤ 16 MB on the GPU. The tier-4
  sprite budget (`DENSE_BUDGET_BYTES` 256 MB) is already full; the floor stays outside it, and
  the ground parts of the old terrain chunks (no longer built, §3.4) give memory back. Over
  budget, the floor uses 2× textures at tier 4.
- One 4× chunk is one art job ≤ 16 ms (the existing job limit).

### 3.3 Two renderers, one picture

- **Browser:** a small WebGL2 program (GL group) draws the floor mesh: the height field as a grid
  (finer near the camera), its vertical faces and the decks, with perspective-correct texture
  mapping, sharp bilinear sampling and mips. It renders at the art density into its own canvas;
  `Renderer.surface` puts it into the frame in draw order (the rally's path). It is NOT the
  rally's PS1 program: no vertex snap, no affine warp, no 15-bit cut. File:
  `src/engine/gl-floor.browser.ts`, created by `main.ts` and injected through `AppOptions`
  (Hard Rule 3). Context loss, no WebGL2, or `?floorgl=0`: the CPU path takes over.
- **CPU raster:** pure TypeScript (`src/engine/floor/`), the reference for node tools, tests and
  CI, and the browser fallback (capped at density 2 there). Same mesh, same textures, same
  sampling rules; a z-buffered triangle raster with perspective-correct coordinates.
- A browser test renders the same frame both ways (SwiftShader) and compares them: mean
  difference ≤ 3/255, 99th percentile ≤ 24/255.
- If the wave-A perf gate shows that the CPU raster alone holds ≤ 1 ms per frame at 4K, the lead
  may drop the GL path to keep one path; the report says so.

### 3.4 Draw order (`SectionView` with a floor)

1. Background layers (lifted, §1.3) and `backHook`.
2. **The floor** (the band from the back edge, or higher where a hump or deck rises, to y 216).
3. Back decor, far to near (each at its depth); the back prop row.
4. Canopies, slabs and top faces (§3.5); walk-plane decor.
5. Terrain chunks: platforms and solids only. With a floor, the terrain painter leaves the ground
   cells empty (the wall face under the walk line is gone), the pit shafts are off where the
   floor shows water, and the old water pieces (`waterDecor`) are hidden.
6. Contact shadows (§3.7), then `world.draw` as today.
7. The front prop row and the front decor (the old front bollards are replaced by the row), the
   front layers, then the light pass (oldenzaal).

### 3.5 Canopies, slabs and top faces

A platform on a lifted front keeps its physics line. Its art is a quad from the facade (its back
edge, at the facade's depth and speed) to the platform line (its front edge, at v = 0), with the
old sprite (valance, rail) at the front edge as today. In motion the quad skews with the
perspective: that is correct, and the feet always stand on the drawn front edge.

- awnings: a striped canopy in the awning's colours; balconies and gable ledges: a stone or iron
  slab; the oldenzaal bay roofs: a sloped roof top over the bay (the mock-up did not show them).
- Walk-plane props (cars, low walls, houseboat decks and cabin roofs, market stalls, pews,
  coffins, the hot-dog stand, the ramp of `ams` c) get a top face: a quad from their top edge back
  into depth, in their own material.
- The quads are built per frame from small cached textures (no allocation per frame).

### 3.6 Prop rows

A row is a list of props along u at one depth: a sprite (or a procedural prop, e.g. the iron post
with its chain), a spacing, an offset, a scale (× the row's `s`), gaps and exclusion ranges. Rows
follow the street layout of each stretch (§4.4, §5): they stop at crossings, over water, on
bridges (the railings replace them), at doors and at the stretch ends, and they may bend with a
kerb between stretches (§4.4). The front row:

- props at least 34 px apart, thin (≤ 8 px wide at the row's scale);
- the top of a front prop stays below `G − 14` on screen (legs only, never heads or guns);
- never within 24 px of a spawn point, a pickup, a hostage or a door that a script uses;
- an option kept off: fade a front prop to half while a hero stands behind it (the user can ask
  for it at the look stop).

### 3.7 Entities: shadows and depth steps

- **Contact shadows:** a soft dithered oval under every hero, enemy and npc whose feet are ≤ 48 px
  over the floor: on the floor surface at its x, smaller and fainter with height. Strength per
  section (`ams` about 0.3, oldenzaal 0.35, the church and the crypt 0.45). Flyers high up get
  none.
- **Depth steps (render only):** a few entities come out of the lifted back plane: zombies
  bursting from boarded openings (oz-a), Meneer Wu at his door (oz-b), window wavers and the baker
  at Fabel Friet (`ams` a), MECHA HASLEMA stepping out of the Stopera's doors (`ams` d). They get
  `drawDepth` (px behind the walk line), which the world draw projects (shift and speed of that
  depth; no scaling). It is read only in drawing, so the sims cannot change. Rule: an entity is
  drawn at a depth only while it cannot be hit and cannot hurt (an intro, an emergence of ≤ 30
  ticks), or it is cosmetic (npcs, wavers). Otherwise art and hitbox agree at v = 0.
- **Openings in the floor** (the `oz-manhole` covers, the nave's `oz-slab` grave slabs, the
  crypt's tombs where they lie in the floor) draw flat in perspective at v = 0, and the floor
  painter leaves their outline free.

### 3.8 Light (oldenzaal; CORE gives the hooks, OZ groups use them)

The lamp glows of the light pass move up with their lamps (the lift). A lamp also lights the
floor: an elliptical pool on the floor at the lamp's depth. The fog becomes a ground mist that
lies on the floor (thin over the walk lane, thicker toward the back edge), so the floor stays
readable (the mock-up's fog hid it). Moonlight shafts and lightning light the floor of the nave.

### 3.9 Tools and docs

- `npm run shot` and a clip tool show the floor at any x, tick, density and pan speed; a debug
  overlay (`?debug=floor`) draws the depth grid, the walk line and the row lines.
- The pan test and the still test of §2.7; a GL-vs-CPU browser test.
- `docs/api/floor.md`: the contracts (`FloorDef`, the painter, rows, depth, `drawDepth`, the
  light hooks); `docs/ARCHITECTURE.md` §3/§6/§10: the floor pass and its budget.

## 4. Amsterdam

### 4.1 Materials (the `ams` floor kit, `content/missions/ams/floor/`)

Red asphalt (the fietspad, with polished tyre lanes), white road paint (edge lines, the dashed
centre line, shark teeth, the bike symbol), klinkers (red-brown bricks, stretcher bond on streets,
herringbone on the Pleintje), kinderkopjes (domed cobbles, for the cobblestone street and the
squares), grey pavement tiles, granite kerbs and the quay coping, the bridge decks (bricks), the
white wooden bridge's planks, gravel and grass (Museumplein), water (canal and river, with a
world-anchored ripple that moves with time, and the sky's reflection). Light: the section's time
of day (morning, noon, golden, sunset), lit kerb tops, darker far rows.

### 4.2 The kerb crossing (the change between the bike lane and the cobblestone street)

Where the lane meets the cobblestone street:

1. The lane's white edge lines stop. A row of white **shark teeth** crosses the lane, the points
   toward the riders who must give way.
2. A low **sloped kerb** (a granite band 3–4 px wide, with a lit top and a short face) crosses
   the floor **at an angle**: in world space about 30° from the depth axis, so on screen it is a
   slanted line that turns with the perspective as the camera moves.
3. The **cobbles** start behind it. The joint where cobbles meet the kerb is cut along the kerb
   line (no zigzag of whole cells).
4. The pavements and their kerbs on both sides go on unchanged; the pole rows have a gap of about
   24 px around the crossing.

The same crossing, mirrored, leads from the cobbles back onto the lane. A bridge or the Pleintje
are the usual places for the cobbles; the lane is on the open quays (§4.4).

### 4.3 The bike symbol

The symbol is painted in world space as Dutch markings are: for a rider on the lane. Its top
(saddle and bars) points in the riding direction; its two wheels lie one behind the other in
depth (across the lane); it is stretched about 1.5× along the lane. The near half of the lane
carries the symbols for riders going right (top toward +u), the far half those for riders going
left (top toward −u), about every 220 px, the two halves 110 px apart. The perspective squashes
them on screen, as on a real street seen from the pavement. Each symbol is about 14 px across the
lane (wheel to wheel) and 15 px along it (world): on screen about 8 px high and 15 px wide, so it
stays readable.

### 4.4 Sections and stretches

Every stretch has a street layout from back to front. The open quay (start values, screen y at
the walk-line scale): quay coping at the back edge (146) · pavement tiles · far kerb (156) with the
back pole row (156.6) · the lane or the cobbles (159 – 186.5, walk line 176) · near kerb with the
front pole row (192.5) · pavement to the bottom. A house stretch: facades at 14 px (base y 162) ·
a narrow pavement · far kerb with the back row (about 169) · the lane or the cobbles · near kerb
with the front row (about 197) · pavement. Between stretches the kerbs bend over ≥ 32 world px
(never a hard jump).

| Section | Stretch | Floor |
|---|---|---|
| a (3584) | quay street 0–700 | open quay, lane, two pole rows; the canal behind the coping |
| | bridge 1, 720–880 (hump 14) | crossing to cobbles before it; brick deck; railings back and front replace the rows; the side canal runs under it in the background |
| | 900–1060, 1340–1500 | lane |
| | the side canal 1060–1340 | water cut with quay walls; the raised drawbridge stands at the back; the houseboats in the walk plane with deck and roof top faces |
| | the Pleintje 1520–1904 | cobbles in a fan pattern; benches, the elm and the flag at the back; the bike rack in the front row |
| | shopping street 1904–2600 | house stretch, cobbles; awnings and gable ledges stick out (§3.5); window wavers at the facade's depth |
| | bridge 2, 2600–2760 | as bridge 1 |
| | arrival 2790–3584 | house stretch, lane; Fabel Friet at 14 px, its counter in the walk plane, the baker between them (depth step) |
| b (3072) | street 0–380 | house stretch, lane |
| | the passage 400–720 | the cycle passage: red lane, tiled sides, the passage's back wall at 14 px, no pole rows, darker inside, bright at both ends |
| | Museumplein 720–2200 | gravel and grass; the long pool as a water strip behind the walk line; the hot-dog stand with a top face; no pole rows on the lawn (low lawn chains as the front row) |
| | the canal road 2200–3072 | open quay, lane, two pole rows |
| c (2608) | quay street 0–600 | open quay, lane |
| | the canal 600–1400 | water over the whole band, quay walls at both ends; six houseboats with top faces; the Swan swims on it |
| | the shop quay 1400–2448 | house stretch, cobbles; the scan-car arena |
| | the fork 2400–2608 | the ramp up (a walk-plane prop with a top face, ground under it) and the jetty steps down to the pontoon over the basin (steps and water in the height field) |
| c1 (1388) | the white bridge 60–860 | the deck of planks as a raised strip around v = 0 over the Amstel; white railings back and front; the slope up (0–60) and the ramp down (760–860) |
| | the quay and the Blauwbrug 860–1388 | lane to a crossing; the Blauwbrug's hump (16) in cobbles, its lamps on the railings; the market at Waterlooplein in cobbles |
| c2 (2632) | the river 60–2492 | water over the whole band (the boat carries the camera); the far bank lifted. The low bridges and the Magere Brug span the band from the back edge to the front (their art projects in depth; their hitboxes stay); quays at both ends |
| d (1280) | the flea market 0–896 | cobbles; stalls at the back and in the walk plane with top faces; the front row: poles at the market's edge |
| | the Stopera arena 896–1280 | the big pale stone tiles of the forecourt; MECHA HASLEMA steps out of the glass doors (depth step); no front row in the arena |

## 5. Oldenzaal

### 5.1 The town (oz-a, oz-b, oz-c; `content/missions/oldenzaal/floor/`)

- Materials: Bentheimer sandstone pavement, a sandstone kerb, a gutter of dark slate setts, the
  red-brown herringbone street (as the mock-up's line-scroll direction), the square's setts, wear
  and moss at the edges. No red pools and no pink rubble: nothing on the floor may read as blood
  (the level's no-blood rule).
- Iron posts with chains in two rows: the back row on the far kerb, the front row on the near
  side.
- oz-a: shop fronts at 14 px; awnings, balconies and bay roofs stick out (§3.5); cars and low walls
  in the walk plane with top faces; the RUIN openings with depth steps for the zombies that burst
  out; the rise spots (`OZ_A_RISE`) as cracked pavers; the manholes flat in the floor.
- oz-b: the corner at De Smulhoek: a side street opens into depth (the floor goes on behind the
  corner, between the facades); Meneer Wu at his door (depth step); the warm window light lies on
  the pavement.
- oz-c: the open square in front of the basilica (26 px): large setts, the statue's plinth and its
  arena; the moonlight and the one burning lamp make pools on the floor; benches and bins at the
  back; a front row of low posts outside the arena only.
- The light: lamp pools on the floor, the ground mist (§3.8), tuned per section so that the
  floor reads and the dusk and night stay grim.

### 5.2 The nave (oz-d)

- The hero walks the **centre aisle**. The north pew block is the back row: pew ends along the
  aisle's far edge, the pews receding toward the arcade; the south pew block is the front row:
  low pew ends that cover the legs (§3.6 rules).
- The pew blocks that are platforms (`NAVE_PEWS`) stand in the aisle as a barricade of pews pulled
  into it during the weeks of abandonment, with a top face.
- The floor: worn stone tiles, the grave slabs (`NAVE_SLABS`, `oz-slab` openings) flat in the
  aisle, the choir's two steps behind the walk line from `CHOIR_X`, the stair down to the crypt as
  steps going down into the floor at the east end.
- The pillars stand on the floor's back edge; the moon shafts (`NAVE_MOON_SHAFTS`), the candles and
  the lightning light the floor; the sanctuary lamp's pool is amber, never red on the floor.
- **Respect** (oldenzaal spec §7): nothing mocked, broken or burned on purpose; grave slabs carry
  made-up names and dates (no real people); the altar, the crucifix, the statues and the images
  stay decor.

### 5.3 The crypt (oz-e)

- Big worn slabs with grave slabs among them; a low floor (16 px behind the feet).
- The back row: the squat columns on the back edge. The front row: low iron grave rails and
  candle stands (no tall columns in front: they would hide the heroes).
- Coffins on trestles: walk-plane props with top faces. The tombs: in the floor at v = 0 where
  they are openings; the dead rise in place.
- Candles and lanterns make small pools of light on the floor.

## 6. Not in scope

The tower (oz-f), the dormant ring, the rally, the first-person floors, m0–m5, the menus. Depth
movement. New enemies, scripts or layouts. The grit of the other mock-up directions (until the
user asks).

## 7. Build: two waves (every worker at effort xhigh)

Rules for every wave: one workflow per wave; every agent at effort `xhigh` (never max), set
explicitly; the builders own separate folders (Hard Rule 6); each agent has its own preview port;
a snapshot `.claude/snapshots/floor-pre-<wave>.tgz` before each wave; after each wave the lead
gates (§8), a local commit (no push), and an updated private demo page.

### Wave A — the engine, `ams` a and oz-a (then the LOOK STOP)

| Agent | Owns | Delivers |
|---|---|---|
| CORE | `src/engine/floor/`, `src/game/mission/floor/`, `view.ts`, `types.ts`, the terrain painter switch, the world-draw hooks, tools | §1–§3 except the GL program: the model, `FloorDef`, the height field from the terrain, the texture chunks and jobs, the CPU raster, the draw order, decor depth, prop rows, canopies and top faces, contact shadows, `drawDepth`, the light hooks, the pan and still tests, the tools, `docs/api/floor.md`. First the contracts, so the others can start |
| GL | `src/engine/gl-floor.browser.ts`, its wiring in `main.ts` | §3.3: the WebGL2 floor program, context loss, the fallback, the governor link, the GL-vs-CPU browser test |
| AMS-A | `content/missions/ams/floor/`, the floor part of `section-a.ts` | §4.1–§4.4 for section a: the kit, the crossing, the bike symbol, the pole rows, both bridges, the side canal, the Pleintje, the shopping street's fronts, the arrival |
| OZ-A | `content/missions/oldenzaal/floor/`, the floor part of `section-oz-a.ts`, the light pass changes | §5.1 for oz-a: the kit, the post rows, the overhangs and bay roofs, the top faces, the openings and their depth steps, rise spots and manholes, the lamp pools and the mist |
| INTEGRATE | the preloads, the budgets, the smoke | the floor jobs in the section preloads, the memory and frame budgets, the CI smoke route |
| REVIEW → FIX | | three lenses (smooth + perf; the look against this spec and the mock-up; regressions + determinism), then the fixes |

CORE starts alone and publishes the contracts; GL, AMS-A and OZ-A then run in parallel.

**The look stop:** the lead gates wave A, commits it locally, rebuilds the preview, and updates the
demo page with 60 fps browser clips of both sections. The user plays `ams` a and oz-a and gives
feedback. The feedback goes into this spec (§11) before wave B.

### Wave B — every other section

| Agent | Owns | Delivers |
|---|---|---|
| FEEDBACK | the two kits and CORE files named in §11 | the user's look-stop changes, first |
| AMS-B | the floor of section b | §4.4 b: the passage, Museumplein, the pool, the canal road |
| AMS-C | the floor of section c | the long canal, the shop quay, the fork (ramp, steps, pontoon) |
| AMS-RIVER | the floors of c1 and c2 | the white bridge deck, the Blauwbrug, Waterlooplein; the river, the spanning bridges, the quays |
| AMS-D | the floor of section d | the market, the arena, the boss's depth step |
| OZ-TOWN | the floors of oz-b and oz-c | §5.1 b and c |
| OZ-CHURCH | the floors of oz-d and oz-e | §5.2, §5.3 |
| INTEGRATE → REVIEW → FIX | | as in wave A |

## 8. Gates (the lead, after each wave)

1. `npm run typecheck` and the full `npx vitest run`.
2. **Identity:** every mission's sims stay byte-identical (`jq 'del(.timing)'`), `ams` and
   `oldenzaal` included: the floor is art only. Frames of missions and sections without a floor
   stay byte-identical; the `ams` and `oldenzaal` frame goldens change on purpose, and the report
   lists them.
3. **Smooth:** the pan test and the still test (§2.7) pass in every floor section; the lead looks
   at the 60 fps browser clips.
4. **Walk line:** for every u, the drawn floor at v = 0 is on the physics surface (a test samples
   the height field against the terrain, ±0.5 px); platforms stay on their drawn edges.
5. **Readability:** front props never cover a head or a gun (a test runs the bot through each
   section and checks the front row's rectangles against the heroes' head and gun boxes); the
   factor rule of §1.3 holds in every section.
6. **Perf** (`npm run perf`, Apple M5, 4K): the floor's own code ≤ 0.5 ms CPU per frame on the GL
   path (≤ 1.2 ms with the draws it hands the renderer), render + present ≤ 2 ms at k = 8 on the GPU; the CPU fallback ≤ 4 ms per frame at density 2;
   no frame over 16.7 ms when a section starts (the floor jobs are prefetched).
7. **Memory:** the floor's share ≤ 16 MB CPU + 16 MB GPU at tier 4; `DENSE_BUDGET_BYTES` holds;
   boot@1x ≤ 4.0 s; the `ams` 2× preload ≤ 8.65 s.
8. `npx vite build`, `npm run smoke` on the CI route, `?floorgl=0` (the CPU fallback),
   `npm run cache-check`.
9. The lead looks at stills and clips of every floor section at 1×, 2× and 4× against §4 and §5.
10. Scans: no reference game name; nothing that reads as blood in oldenzaal; the church's
    respect rules.

## 9. Risks

1. **The GPU path** is the second GL program in the game: context loss, drivers, precision. Keep
   it small; the CPU raster is the reference and the fallback; the GL-vs-CPU test guards drift.
2. **Memory at tier 4** has almost no margin today. The floor chunks are evicted behind the
   camera; the ground parts of the old terrain chunks are no longer built; 2× floor textures at
   tier 4 are the fallback.
3. **Bridges, cuts and decks** are the hardest geometry; wave A includes both bridges and the side
   canal of section a on purpose, so the look stop shows them.
4. **Things that come out of the back plane** (openings, doors, the boss) need depth steps; the
   §3.7 rule keeps the art and the hitboxes honest.
5. **Front rows** can hide action; the §3.6 rules and gate 5 guard it.
6. **Background layers** that scroll faster than the floor's back edge would break the
   perspective; the factor test guards it.
7. **The dark oldenzaal sections** can hide the floor; the ground mist and the lamp pools are
   tuned per section, and the lead checks the frames at 1×.
8. **Scope:** about 11 sections. The look stop after wave A limits the risk: the rest copies a
   look that the user has played.

## 10. What changes for the player

Nothing in play. The heroes run, jump and shoot exactly as before. The street now has depth: floor
behind and in front of the feet, two rows of posts that slide by at their own speeds, shadows
under every character, and canopies and decks with tops.

## 11. Look-stop feedback

The user played an early build of wave A (2026-10-26, ams a and oz-a: "I like it a lot!") and asked
for two changes. They are part of wave A (group LOOK-1, after INTEGRATE, before REVIEW):

| # | The user | What we do |
|---|---|---|
| R1 | "The edges of houses that are not bordered by two other houses look a bit off as 2D asset. Can we make these edge/corner houses (and canal boats and other elements) more 3D like?" | **Side faces in perspective.** A house at the end of a row (no neighbour on that side), on both sides of an alley, shows its side wall receding in depth (the same brick or plaster, a plain wall with at most a few small windows, the cornice line and the roof's side). Houseboats become boxes: the hull and the cabin show their end faces (bow, stern) besides the deck and roof tops. The same for other box-like props (the drawbridge, the FABEL FRIET counter, cars and low walls in oz-a, the bridges' parapet ends, and in wave B the stalls, the hot-dog stand, the boats of c and c2). Line-scroll rule: only the side that faces the screen's centre column shows, and it narrows to nothing as the prop passes the centre. Drawn from cached textures, inside the 4K frame budget |
| R2 | "Some street elements make no sense: I saw a tree in the middle of a bike lane and a bike lane that ends before we jump over canal boat houses. Can you check this?" | **A street-logic audit.** Nothing stands in the lane or on the cobbled roadway except traffic: trees, lamps, benches, bins, flags, parked bikes and flowers stand on the pavements (behind or in front). Every lane connects: to a crossing, to a bridge deck, or to a reason to stop. At the side canal of ams a the lane leads to the **raised drawbridge** (back in the walk path at the left bank, spanning the band in depth): a stop line, barrier arms down across the lane and red lights, on both banks; the heroes cross on the houseboats as before. The audit covers every stretch of ams a and oz-a now, and every section in wave B |

## 12. Wave B for Amsterdam (the user, 2026-10-27)

The user played wave A (b362c2b): "Looks good. Can you plan and build the remainder of the 3D work
for the segments in Amsterdam that have not had this 3D transformation before?" Wave B is now
**`ams` only**: sections b, c, c1, c2 and d. The Oldenzaal groups of §7 (OZ-TOWN, OZ-CHURCH) wait
for a later wave; every oldenzaal frame stays byte-identical in this wave.

### 12.1 What wave A taught (binding for every section)

1. **Side faces (§11 R1)** wherever a box shows a side: row ends, both sides of every alley or gap,
   a front taller than its neighbour, boats, stalls, stands, ramps, pontoons, bridge parapet ends,
   the passage's mouths. Helpers: `houseSides`, `boatSides`, `boxSides`, `railPostSides`,
   `wallFace` / `capFace` (look-1-report.md §3, §9; docs/api/floor.md §8.1, §13).
2. **Street logic (§11 R2)** from the start: nothing in the lane or on the cobbled roadway but
   traffic; what the script keeps in the walk plane (a lamp with a gull, a tree with a secret, a
   stall, a cart, a rack, a pickup) stands on a pavement bulb, a square or a quay, never moved in
   depth; every lane connects (a crossing, a deck, a ramp, or a reason to stop); pole rows stop at
   crossings, bridges, water, bulbs and barriers. The guard test `tests/game/floor-street.test.ts`
   enrols every floor section.
3. **§3.7 has no exceptions:** an entity that can be hit or can hurt draws at depth 0 (its art with
   its hitbox). Depth steps only for intros that cannot be hit and for cosmetic actors; fx may have
   a depth. MECHA HASLEMA's step out of the Stopera doors is a depth step only while the boss cannot
   be hit.
4. **Moving and breakable things get their faces in their own draw** (render-only, on a floor only):
   the rowing boat's faces move from section a's spawn into its entity; the breakables (the racks,
   the tulip stall, the herring cart, the market stalls), the pickup crates, the boats of c and c2
   (the tour boat, the party boat, the cruise boat; the houseboats where they are entities) and the
   Magere Brug's bascule show their sides and tops, before and after they break. A floor opts in
   per entity kind (the oldenzaal floors do not opt in during this wave, so oz-a stays identical).
5. Smooth, memory and speed rules as fixed in wave A: world-space textures with full mips, column
   raster for walls, sub-pixel AA quads, one canvas pool, ONE memory number per section ≤ 16 MB at
   tier 4, 4K render + present ≤ 2 ms (goal 1.8), the floor's code ≤ 0.5 ms (≤ 1.2 ms with its
   draws).

### 12.2 The sections (§4.4 stays the base; these are the additions)

| Section | Stretch | Floor and 3D |
|---|---|---|
| b | street 0–380 | house stretch, lane; the row's end before the museum shows its side; the museum's corner wing a box |
| | the passage 400–720 | the museum's cycle passage: the lane runs THROUGH it (it connects at both mouths); tiled side walls in perspective inside (the passage is a tunnel in depth: its far wall, its ceiling's underside above the heroes as a perspective slab, its arches' side faces at both mouths); darker inside, bright at both ends; no pole rows inside; the roof the heroes walk on stays the platform it is |
| | Museumplein 720–2200 | gravel paths and grass; the long pool a water strip behind the walk line with stone rims (top and inner faces); the hot-dog stand (decor, the vendor in its hatch) a box with its side and roof top; lawn chains as the low front row; trees and flags on the grass, not on the path |
| | the canal road 2200–3072 | open quay, lane, two pole rows, the crossing before any cobbles |
| c | quay street 0–600 | open quay, lane |
| | the canal 600–1400 | water over the whole band, quay walls with their coping at both ends (faces), six houseboats as boxes (their own draw if they are entities), the Swan on the water at its depth (cosmetic) |
| | the shop quay 1400–2448 | house stretch, cobbles, row ends and alleys with sides; the scan-car arena: the car at the kerb, cobbles under the fight |
| | the fork 2400–2608 | the ramp up to the bridge (a walk-plane prop with a top face and side faces, ground under it), the jetty steps down to the pontoon (steps in the height field, the pontoon a box on the water), the tour boat at the pontoon a box; the signs BRUG ↑ / RONDVAART ↓ on posts on the pavement |
| c1 | the white bridge 60–860 | the plank deck as a raised strip around v = 0 over the Amstel, white railings back and front with post sides, the white drawbridge's gallows spanning the deck in depth (the heroes walk under them), the slope up and the ramp down; the river under the deck with the tour boat |
| | the quay and the Blauwbrug 860–1388 | lane to a crossing; the Blauwbrug's hump (16) in cobbles with its lamp posts on the parapets and the parapet ends' sides; the Waterlooplein market stalls as boxes on the cobbles at the back and on bulbs |
| c2 | the river 60–2492 | water over the whole band; the cruise boat carries the camera (a box: hull sides, the cabin's end faces, the roof top); the far bank's quay lifted with its coping; the two low bridges span the band from the back edge to the front (the parapet, the far arch, the near slab face in front as today; their piers' sides); the Magere Brug spans the band (portals, the bascule entity with its sides); the party boat and the houseboats as boxes; the jetties at both ends with steps; ducks at their depth |
| d | the flea market 0–896 | cobbles; the stalls (breakables) as boxes with awning tops in the walk plane on the square, more stalls at the back; the front row: poles at the market's edge, never in front of a stall a hero fights at |
| | the Stopera arena 896–1280 | the pale stone tiles of the forecourt in a grid; the Stopera's curved glass front and the Stadhuis wing with their sides; the glass doors in depth; MECHA HASLEMA's depth step only while not hittable; no front row in the arena |

### 12.3 Build (agents at effort xhigh, Agent tool; snapshot `.claude/snapshots/floor-pre-b.tgz`)

| Agent | Owns | Delivers |
|---|---|---|
| CORE-B (alone, first) | the floor engine, the SHARED ams kit files (`ams/floor/*.ts` except `section-a.ts`), the entity files of the breakables, boats, crates and the bascule (`ams/breakables.ts`, `ams/ambient.ts`, `ams/cruise.ts`, `content/items/crate.ts`), the floor tools and tests | §12.1 item 4 (entity faces: one render-only API for moving / breakable entities); the §4.1 materials the wave needs (gravel, grass, planks, river water over the whole band, the Stopera tiles, the passage tiles, stone rims, lawn chains) in the kit; one sub-folder per section (`ams/floor/<b|c|c1|c2|d>/`) that the builders fill, registered so a builder never edits a shared file; the shot / floor-clip support for c2 (the camera on the boat: frames by tick); `frames-b.sh` cameras |
| AMS-B, AMS-C, AMS-RIVER (c1 + c2), AMS-D (in parallel) | `ams/floor/<section>/`, the floor part of `section-<section>.ts`, their own test file | §12.2 for their sections; a need in a shared file goes into the report (INTEGRATE applies it) or a local workaround |
| INTEGRATE-B | every file the wave touched, for integration | the builders' needs, the section preloads (floor jobs prefetched), the budgets per section, the CI smoke, the scenery fixture, docs |
| REVIEW (smooth, look, risk) → FIX | | as in wave A, over all five sections |

Gates (§8) per section; frames with `tmp/floor-lead/frames-b.sh` against `base-b-frames` (from
b362c2b): DIFF only in `ams` sections; every oldenzaal, m0 and m2 frame SAME. Then a local commit, a
play build and a LOOK STOP: the user plays `ams` b, c, c1, c2 and d.
