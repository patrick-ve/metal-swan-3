# Metal Swan 3 — Art Guide

Owner: art director. This guide explains the house style and the procedural art rigs in
`src/game/art/`. Read it before you draw anything. The media toolkit itself (PixelBuffer,
palette, sprite registry, renderers) is documented in `docs/api/media.md`; the IP rules are in
`docs/ORIGINALITY.md` (mandatory).

**Look at your work.** `npm run sprites -- <prefix> [--marks]` writes contact sheets to
`tmp/sprites/` (3× zoom; `--marks` shows anchors in cyan and points in magenta). Open the PNG
with the Read tool and judge it at 1× size too. `npm run sprites -- demo` shows the background
stacks (`demo/bg`), every background generator (`demo/bg-layers`) and every terrain style
(`demo/terrain`).

---

## 1. Style rules

| Rule | Detail |
|---|---|
| Palette only | Every pixel is a colour of `PAL` (64 colours; 2× and 4× art uses `PAL_HD`, "UHD art"). Tests check this (`tests/art/sprites.test.ts`). No alpha-blended pixels inside sprites; translucency is a renderer effect. |
| Outline | 1-px `INK` outline around the silhouette (4-connected). Internal lines between overlapping parts use the **darkest shade of the part behind** (a cast-shadow edge), not black. The `Composer` in `paint.ts` does both. |
| Light | From the **top-left**. Lit edges one shade lighter, bottom/right edges one shade darker, the ramp's darkest colour for creases and internal lines. Far limbs are one shade darker than near limbs. Flipped sprites keep the same pixels (the light then comes from the top-right — accepted). |
| Tones | 3–4 tones per material: base, highlight, shadow, deepest. Glints (one extra-light pixel) only on metal, boots and helmets. |
| Clean clusters | No single-pixel noise. Texture comes from 2×2 clusters, seams, rivets, strata. Dither only with the ordered Bayer pattern and only at band borders (skies, explosions, smoke). `despeckle()` removes stray pixels from shaded parts. |
| Readability | Big heads (10–12 px), big boots and gloves, exaggerated poses, faces never hidden by the near arm (the rig moves a face-crossing arm behind the head). |
| Bloodless | Deaths are cartoon: stagger and fall, scorch-black tumble, soot statue that crumbles to ash, dizzy stars. Never blood. (One dated exception: the first-person mode, section 10.) |
| Originality | Our own designs only (see `docs/ORIGINALITY.md` §Art). No look-alikes of any existing game's characters, vehicles, crates or HUD. |

**High-resolution displays** (`docs/ARCHITECTURE.md` §3): art is authored at 1× — every
size, anchor, point and rule here is in logical pixels — plus 2× and 4× versions for the mission
ams flow, drawn natively as new art (the next sections; the rules of this section are the 1×
rules). On a large display the browser draws a k-times backbuffer: sprites are
filtered once by the GRAPHICS mode (`pixel`, the default: none; `smooth`: a palette-exact
scaler that rounds stairs and diagonals; `xbr`: smoother curves with blended edge colours),
everything else is enlarged as crisp blocks. Never filtered: every 2× and 4× frame, backgrounds
and terrain chunks, `image()` buffers, the font, sprite ids under `UNFILTERED_PREFIXES` in
`render-common.ts` (`ui/`, except the character art in `FILTERED_UI_PREFIXES`) and the exact ids
in `UNFILTERED_IDS` (the large explosions' dithered fire, the `Fabel` script sign). In `xbr`
mode, `decor/` sprites use `smooth` (xBR rounds bricks and windows and seams tiled strips). A
scaler adds no detail; it only reshapes edges, so 1-px details, dither and tiny text read best
kept crisp — add an exact id (or a prefix) for art that suffers, or better, fix the art: 2 × 2
checker crossings between a light stroke and a dark ground become small rings in `smooth`;
letters on a plain band do not (so the STADHUIS lettering on `decor/ams/stopera` sits on a
plain dark plaque). Check the
look headless: `npm run shot -- … --res 5 --gfx smooth`.

### 2x art (mission ams): the dense art contract

Mission ams (`MissionDef.artDensity: 4`) and the screens of its flow can draw a 2× or 4× version
of any sprite id, shared ones included (players, the Swan, fx, items …). It is NEW art drawn
natively by ONE density-generic generator per id: `defineHdSprite(id, (d) => frames)` (or
`defineSprite(id, gen, { hd })`; d ∈ {2, 4}, `densities` default `[4, 2]`). A 2×-only id
(`{ hi }` / `defineHiSprite(id, gen)`, e.g. the select portraits) shows its 2× frames at tier 4.
Only the ams flow draws dense art; m0–m5, the attract demo and all game logic keep the 1× frames.
The look is "UHD art" below; the engine contract is in `docs/ARCHITECTURE.md` §3 and
`docs/api/media.md` §5. Rules at every density d:

| Rule | Detail |
|---|---|
| Same logical geometry | The same number of frames as the 1× strip; each frame the same logical size, anchor and named points as its 1× frame. Points and anchors stay in LOGICAL px (the game reads them for muzzles, hands, seats, hitboxes). The registry enforces it: a dense frame is re-framed to the 1× rectangle (pixels outside it are cut, with a warning); a wrong frame count, a buffer size not divisible by d or different points make the id fall back to its next lower frames (`npm run sprites` reports `id@<d>x`). |
| Buffer = d× | Each buffer is exactly d times the 1× buffer in both directions: one logical px = a d × d block of art px. A dense part is taken with `getFrames(part, d)` and placed with `blitFrame(f, x, y, o, d)`; rotations `rotated(a, { align: d })`. |
| New art, crisp | Drawn natively with the HD kit (`src/game/art/hd/`), never the 1× or old 2× art scaled (no MMPX / xBR / nearest look). No filter, no anti-aliasing or blended edge colours; the GRAPHICS filters never touch dense frames. |
| HD palette | Every px opaque and from `PAL_HD` (`inHdPalette`; `tests/art/palette-hd.test.ts`). The 1× art keeps `PAL` and stays byte-identical. |
| Same design | The same key light (top-left), outline A (1 logical px = d art px) and identity as the 1× frame: the dense frame reads as the 1× frame seen closer, with more tones, form, texture and wear (the targets below). |
| Identical art | A strip whose dense art would be the same picture as another id's (a pair set's rider-only strips, a bike per skin, a second name of a shot or pickup) registers `defineDenseAlias(id, target)`: it shows the target's frames, built and held once. |
| Density-aware helpers | Helpers that mix buffer px and logical px give wrong anchors on a dense frame. Use the dense ones: `crushStripHi(f1, fd, lo)` (`art/hi-strips.ts`, crush strips at any d), `withFlamesDense`, `crumbleDense`, `liftDense` (`human-fx.ts`), `turnFrame(f, q)` and `turnHi(src, angle, base1, { outline })` (`art/hi.ts`), `rotated(a, { align: d })`; `mirrored()`, `withPieces` / `decorateFrames` (pieces at logical offsets; `pieceHd(lo, d)` draws each piece natively), `sootify`, `scorch` and `speckle` handle any density; else compute anchors with `frameW` / `frameH`. The registry re-frames a misplaced result and only warns, so a mistake shows as misplaced art, not as a logic change. |
| Uneven pixels at odd k | A 2× art px is k/2 screen px: exact at k = 2, 4, 6, 8; at k = 3 and k = 5 (1080p) the columns alternate 2/1 and 3/2 px (fixed to the sprite: no shimmer when it moves; a flip swaps which columns are wide). Tier 4 needs 4 \| k (k 4 or 8: exact 1 × 1 or 2 × 2 blocks); else the tier is 2. Do not rely on single art px lines having one even width. |
| Lower res | On a backbuffer below the density the renderers draw a reduction (`drawDensity`: a 4× frame at k 2 or 3 shows its 2× image, at k 1 its 1× image); keep it readable. |

**Retired in the UHD wave** (deleted; do not bring back): the hand-drawn 2× art and its helpers
— `HiSketch`, `HiPen`, `liftHi`, `squashedHi` (`art/hi.ts` keeps only `outlineHi`, `asHi`,
`fitHi`, `turnFrame` and `turnHi`), the 2× gear twins `gunArtHi` / `heldArtHi` / `knifeArtHi` /
`propArtHi`, `HANDS_HI`, the pieces' `hiRows` / `setHiTwin`, `warmBlush` and the `*Hi` drawers of
the riders, the handhaver, the hostages, the fx and the items. One exception: the 1×
first-person recruit face keeps the template head `renderHeadHi` (`humanoid-head-hi.ts`), so its
1× pixels stay byte-identical; `headLayerHi` (humanoid.ts) only serves its tests. The
half-pixel joint spike (`setHalfPxJoints`) is a no-op: the HD body places joints at 1 / d px.

Check it: `npm run sprites -- <prefix> --density 4 --marks` (and `--density 2`; `--density 1`
shows that 1× is unchanged), `npm run shot -- --mission ams --section <s> --res 8 --art 4` (4K),
`--res 4 --art 2` (1440p), `--art 1` for the 1× look. `tests/engine/hires-density.test.ts` and
`tests/engine/density4.test.ts` check the dense registry; the fixture
`tests/engine/fixtures/sprite-geometry.json` pins the geometry of every 2× and 4× sprite.

### UHD backgrounds and terrain (mission ams)

Parallax layers and terrain have dense art too, by the same rules (same design, `PAL_HD`, light
top-left) and the style decisions below: **no ink outline**, painted, separated by tone, light
and haze. Only a section view of density ≥ 2 (ams) draws it, at the highest density ≤ min(its
density, the tier) that has art and that k can show; at res 1 the 1× art is the exact image.
Layers and materials without dense art stay 1× next to it.

| Part | How |
|---|---|
| Background layer | `defineHdBgGenerator(id, (w, h, params, seed, d) => buf)` (or `defineBgGenerator(id, gen, { hd })`, `art-registry.ts`) gets the SAME logical arguments as the 1× generator plus d and returns exactly (d·w) × (d·h): the same shapes at the same logical places (the same hashes and loops in logical px), seamless at d·w. Offsets, factors, drift and tiling stay logical. A wrong size or a throw falls back to the next lower layer (`hiSceneryErrors()`: `bg:<id>@<d>x`). ams: `ams-skyline`, `ams-canal-houses`, `ams-elms`, `ams-plein` (`missions/ams/art-hd-bg-*.ts`) and the shared `sky-gradient` and `clouds` (`art-hd-sky.ts`; only dense views draw them, so other missions keep their 1× skies). |
| Layer kit | A layer is up to 4096 × 864 art px at 4×, too big for the `HdCanvas` G-buffer, so the ams layers paint with `BgCanvas(w, h, d)` (`art-hd-bg-kit.ts`): palette INDICES with span fills that wrap in x, logical-px rects, scan-line polygons and shaded discs, `finish()` = one table look-up per px (so reflections and haze are look-ups too). `airOf(light, air)` applies the section's light and the atmospheric perspective (far layers lighter, cooler, lower contrast) to the colours once per layer. Ordered dither (`dq`, Bayer 8 × 8) only at band borders of sky, clouds, walls and water. Trees: `leafMass(c, bx, by, br, leaf, seed, crown, lift?, ry?)` paints each 1× leaf mass as a lit clump, `trunk(…)` the bark (`art-hd-bg-trees.ts`). |
| Terrain material | `defineHdTerrainMaterial(kind, id, paint)` (`terrain-art.ts`; kind `ground`, `edge`, `platform` or `solid`): `paint(p, d, out, i, stride)` fills the d × d art px of logical px `p` (the same `Px` as the 1× material) with opaque `PAL_HD` colours, `out[i]` the block's top-left art px, `out[i + stride]` the next art row; world art coordinates `d·p.x + sx`, `d·p.y + sy` (or `d·p.up + sy`) join chunks without seams. `paintTerrainHd` (registered with `setHdTerrainPainter`) classifies every px as the 1× painter does (cells, bands, cliff faces, undersides, hangers), so geometry and collision cannot change. No ink outline: the lit left cliff face is one HD tone lighter, the right face and the underside three darker (`hdShift(c, n)`). A material without HD art fills its 1× colour. Hangers: `defineHdTerrainHang(platform, (x, k, seed, d, out, i, stride) => void)`, painted only where the 1× `hang` paints. ams (`art-hd-terrain.ts`): ground `klinker`, edges `bikepath` and `kerb`, platforms `wood` and `whitewood` (with its cross-beam hangers), solid `brick`. |
| Canal water | Sprites, not terrain: `decor/ams/water-<w>x<h>` (surface line), `-back` (the canal body behind the actors), `-tint` (in front at alpha 0.45), one HD drawer each (`art-hd-terrain-water.ts`). |
| Decor | Façade decor and props (`decor/ams/…`) are sprites: `art-hd-ab-*.ts` (sections a and b, registered by `art-hi-ab.ts`: houses in four lights with `lightHd(buf, light)`, `outlineC(buf, d)`) and `art-hd-cd*.ts` (c and d: `Facade(w, h, d)`, breakables with outline A and wrecks, stalls, bridges, the Stopera, boats). **Decor is section art, never `preloadFirst`**: each `SectionDef.art` lists the decor it draws (its decor list plus the breakables and boat platforms its script spawns), so the tier-4 working set holds only the current and next section's decor (`tests/art/ams-ab-hd.test.ts`). |
| Cost | Measured in node: the layers of one section are 49–53 MB at 4× (12–13 MB at 2×), median 1.1–13.2 ms per 4× layer, a cold first build up to 18–21 ms (the near canal row, the plein); a 4× terrain chunk median 5.8–8.4 ms, at most 13.6 ms, 14–25 MB resident per section (chunks `EVICT_BEHIND_CHUNKS` = 2 or more behind the view are released). Keep each dense layer or chunk under 16 ms: the browser builds them as art jobs within the 8 ms per frame budget (docs/ARCHITECTURE.md §3) and draws the lower art until they are ready. Big 4× decor (the Rijksmuseum about 257 ms, the Stopera 48 ms) builds once in a worker. |

Check it: `npm run shot -- --mission ams --section a --god --bot --ticks 120 --res 8 --art 4`
(4×), `--res 4 --art 2` (2×) and `--art 1` (1×). Tests: `tests/art/ams-bg-hd.test.ts` (every ams
layer: 2× and 4× versions, size, footprint, palette, determinism, seam, painted tones, haze, one
art job per 4× layer), `ams-terrain-hd.test.ts` (every material and chunk at 2× and 4×, seams, the
water ids), `ams-ab-hd.test.ts` and `ams-cd-hd.test.ts` (decor geometry, palette, outlines, light),
`scenery-hi.test.ts` (dense layers and terrain; the 1× scenery of every mission byte-identical,
fixtures/scenery-1x.json).

### UHD art (2× and 4×, mission ams flow)

The UHD wave replaces the ams 2× art with NEW art at arcade-level fidelity, drawn natively at
2× (1080p / 1440p) and 4× (4K, backbuffer k = 8) by ONE density-generic drawer per id. It is
never the 1× or old 2× art scaled (no MMPX / xBR / nearest look). The 1× art keeps `PAL` and stays
byte-identical; the old 2× drawers are retired (the contract above). Fidelity of the arcade era, never
its looks: our characters, Amsterdam, outfits, colour families and the squad's likenesses stay
ours (docs/ORIGINALITY.md).

**Fidelity targets** (every UHD builder):

| Target | Rule |
|---|---|
| Tones | Sprites 5–6 tones per lit material (deep shade, shade, mid, light, highlight + a specular or rim where the material has one); backgrounds and big props 6–8. |
| Light | One key light from the upper left and in front, a cool bounce on the shadow side, highlights near white on metal / skin / water / glass, deep shade near ink. |
| Form | Limbs, torso, heads, the Swan and the boss read as volumes (cylinder / sphere / box shading), not flat fills; cloth folds at bends; at 4×: knuckles, laces, stitching, rivets, screws, buckles, seams. |
| Clusters | Clean tone clusters, no orphan px except speculars, no pillow shading, no noise dither on sprites; ordered dither only on backgrounds, sky, water and large gradients. |
| Outline | The variant chosen at the style gate (below); interior separations in the deepest tone of the part behind. |
| Texture, wear, depth | Brick and mortar, plaster cracks and stains, moss near water, wood grain, rust, cobbles with lit edges, canal water with ripples and reflections; far layers lighter, cooler, lower contrast. |
| Geometry is law | Every 2× / 4× frame has exactly its 1× frame's logical size, anchor and points; terrain cells and collision never change; logic never reads art px; 1× px stay byte-identical. |
| Readability | Judge every frame at its real size (1 logical px = 2 or 4 art px) on the real background. |

**HD palette** (`src/engine/palette-hd.ts`): `PAL_HD`, 209 unique colours in 36 named ramps
of 6–8 tones (ink: 2), dark → light with rising luma, hue-shifted (shadows lean purple / blue,
highlights warm yellow / cream, saturation peaks mid-ramp). Every `PAL` swatch sits in the HD ramp
of its material; the extra tones are Oklab steps between those swatches plus a designed cool
deep shade and a warm near-white highlight. It has every material family of `PAL` (ink, steel,
stone, olive, sand, brown, rust, red, orange, gold, fire, green, teal, sky, navy, purple, pink,
snow, skinA–C, hairA–C, black, cloth, slate) plus `brick`, `brickDark` (old canal-house brick),
`canal`, `plaster`, `gable` (white trim), `glass`, `denim`, `wood` (warm painted / oiled), `moss`.
API: `hdRampOf(PAL.olive | 'olive' | customRamp)` → the HD ramp, `hdHome(colour)` → `{ ramp, i }`
for a `PAL` colour, `hdTone(ramp, t)`, `inHdPalette(c)`, `HD_PALETTE`. ALL 2× and 4× px are
`PAL_HD` colours (`tests/art/palette-hd.test.ts`). Sheet: `npm run uhd-spike -- --palette`.

**The kit** (`src/game/art/hd/`, import from `src/game/art/hd/index`):

| Part | API |
|---|---|
| Canvas | `new HdCanvas(w, h, d)`: w × h LOGICAL px at d ∈ {2, 4}, float logical coordinates (1 / d = one art px). Drawing is deferred: primitives write a G-buffer (material, part, depth, normal, tone) with a depth test, so parts can be drawn in any order; `render(opts)` returns the (w·d) × (h·d) PixelBuffer. |
| Materials | `c.material({ ramp, spec?, shine?, rim?, amb?, gain?, wrap?, bounce?, lo?, hi?, dither?, flat?, edge?, rimPx? })` → id. Diffuse light uses ramp indices `lo`..`hi` (default 1..n−2: index 0 is kept for separations, crevices and outline C, the top tone for speculars and rims). `dither` = ordered dither at band borders (backgrounds only); `flat` = no light, the tone alone picks the band (glass, water, lamps, fire). `edge: 'C'` = static façade decor in a painted scene: the px of the parts behind it along its silhouette take its deepest tone (lit side) or ink (shadow side), ½ logical px wide. `rimPx: false` = no rim px (soles). |
| Primitives | `ellipsoid(cx, cy, rx, ry, o)`, `capsule(x0, y0, x1, y1, r0, r1, o)` (tapered: limbs, necks, barrels), `stroke(points, r0, r1, o)`, `box(x, y, w, h, { r, bevel, n })`, `cylinder(x, y, w, h, { axis, cap })`, `poly(points, { n })`, `plane(x, y, w, h, { mask, normal, height })`, `heightField(x, y, w, h, hf)` (the portrait-kit painter generalised: faces, rocks, cushions; normals by central differences one art px apart; `hf` is called once per art px centre, plus a 1 art px border, so it must be pure), `blob(points, r, { bulge })` (a soft cloth / leather volume over a polygon: flat middle, the edge rolling away over r logical px — vests, sleeves, trouser legs, boots, fists; NOT tubes). Options `o`: `{ mat, part?, z?, tone?, tex?, round? }` — parts with one `part` id form one surface (no line where they meet); `z` is the base depth (larger = nearer). |
| Paint and compose | `shade(x, y, w, h, fn, part?)` (folds, stains, painted shadows), `paint(x, y, w, h, fn)` / `dot(x, y, c)` (fixed colours: pupils, catchlights, signs; unlit, kept by the clean-up), `image(buf, x, y, { z })` (a finished buffer of the same density, e.g. a head or a gun, joins the silhouette), `erase(…)`. |
| Shapes | `shape.ts`: `limb(joints, halfWidths, cap = 3)` → the outline polygon of a limb (shoulder → elbow → wrist, hip → knee → ankle; mitred bends; round or square ends) for `blob`; `along(p, deg, len)` (deg from straight down, + = forward), `lerpPt`. `polyDist(x, y, pts)` (canvas.ts). |
| Light | `light.ts`: `KEY` (upper left, in front), `BOUNCE` (lower right), `diffuse(…)` with a contrast curve (a plane facing the viewer is a mid tone; only planes facing the light reach the top bands), `specular` (Blinn-Phong). |
| Render | `render({ outline: 'A' | 'B' | 'C' | 'none', ao = 0.35, clean = true, sep = true, sepZ = 0.5, sepW = 1, shadow = 0, shadowMax = 3, rimLight = 0 })`: ambient occlusion where a part meets a nearer one, cast shadows from the key light (`shadow` > 0: a part dz logical px in front throws a shadow about dz px down-right; façades, sills, an arm on the torso), quantise (hard bands; dither only for `dither` materials), cluster clean-up (an art px with no same-tone 4-neighbour in its part takes the common neighbour tone; speculars and fixed px are kept), rim light (`rimLight` = n: a px in shade with an empty px to its right / lower right is lifted to the band lo + n — the thin cool rim of sprites; the low bands of every HD ramp lean cool), interior separations (1 art px in the deepest tone of the part BEHIND), `edge: 'C'` decor outlines, outline. |
| Textures | `Texture = (s: TexSample) => void` changes the normal, tone, height, material or cuts the px; sizes in logical px, finer detail only where s.d = 4. `brick({ mortar, bw, bh, joint, wear })`, `plaster({ cracks, stains })`, `wood({ dir, plank, seam })`, `cobbles({ gap, cw, ch })`, `folds({ angle, spacing, amp, cover })` (creases in patches, never stripes), `strands({ angle, width })` (hair), `leaves({ size, ragged })`, `ripples({ spacing, phase })`, `grime(seed, amount)`, `texAll(…)`. |

Example (a lit gun barrel with a wooden stock, the same code at 2× and 4×):

```ts
const c = new HdCanvas(19, 5, d);
const steel = c.material({ ramp: PAL_HD.steel, spec: 1, shine: 30 });
const wd = c.material({ ramp: PAL_HD.wood, spec: 0.3 });
c.poly([[0, 1], [6, 1], [6, 3], [0, 3.5]], { mat: wd, tex: wood({ seed: 5 }) });
c.box(6, 1, 6, 2, { mat: steel, z: 1, bevel: 0.45, r: 0.2 });
c.cylinder(12, 1.1, 7, 1.1, { mat: steel, z: 1, axis: 'h' });
const buf = c.render({ outline: 'none' }); // 38 × 10 at d = 2, 76 × 20 at d = 4
```

**Outline variants**: **A** ink, 1 logical px (d art px; the weight of the 1× art, as the old 2×
art), **B** ink, ½ logical px (1 art px at 2×, 2 at 4×), **C** selective, ½ logical px: the
deepest tone of the material on the lit side (up / left), ink only on the shadow side (right /
bottom).

**Style decisions** (style gate, 2026-10-19; the plan's "Style decisions"):

- **Outline A** for everything that moves or can be hit or picked up (heroes, enemies, NPCs, the
  Swan, the boss, vehicles, pickups, crates, breakables, shots, fx shapes): `render({ outline: 'A' })`.
- **No ink outline** on backgrounds, sky, far layers and terrain: `render({ outline: 'none', sep: false })`
  — painted, separated by tone, light, AO and cast shadows only (separation lines would read as
  outlines round every house).
- **C — selective** for static façade decor in the playfield (lamps, signs, trees, bollards, flower
  boxes, benches, parked bikes): give its materials `edge: 'C'` in the background canvas.
- **PAL_HD** unchanged. **Proportions**: today's arcade proportions (big head, chunky hands and
  boots); the HD art adds detail, never slims a figure.
- **Sprite shading**: 5–6 hard bands per material (`lo` / `hi` chosen so a face-on plane sits on
  the material's own mid tone: tan sleeves stay tan, not brown), the light cluster upper left, the
  deep core on the right, `rimLight: 2` for the thin cool rim; low `wrap` (0–0.1) for crisp
  terminators. No stripe textures on limbs or hair (`folds` / `strands` give banding at sprite
  size): model creases as a few `shade` clusters at bends, hair as locks (`hd/head.ts` short hair:
  lock domes meeting in grooves, one highlight cluster per lock). Fine detail (creases, stitching,
  studs, D-rings, laces, finger rows) only at 4×; at 2× the big shapes must read as well as the old
  2× art.

**The rig at 2× and 4×** (group rig; the 1× rig is section 3):

| Part | Rule |
|---|---|
| Body | `renderHuman(style, pose, part, d)` with d 2 or 4 solves the same skeleton as the 1× art (the ground contact unrounded) and hands it to `drawBodyHd(rig)` (`hd/body.ts`): every part on one `HdCanvas` — cloth and leather `blob`s over limb and panel outlines, folds at the bends, seams, pockets, belts, straps, boots with soles, laces at 4× — with joints at 1 / d px (motion in fine steps), the 1× pixel footprint of every part, outline A, a cool rim light and interior separations. The frame has exactly the 1× frame's logical size, anchor and points (the 1× geometry is cached, so a dense render of a figure already drawn at 1× paints only the HD canvas). A recent HD render of the same style, part, pose and density is copied (a small memo, `HD_MEMO`). |
| `fitFrame` | The HD joints sit up to ½ logical px from the 1× ones, and the 1× rectangle is the tight box of the 1× px. `fitFrame` (`hd/body.ts`) trims what reaches past the room inside the outline (the rectangle less d art px on every side) BEFORE the render, so the outline wraps a clean edge instead of being cut by the frame; the crop never moves (that would undo the sub-pixel motion). It trims at most ½ logical px, in about 60 % of HD frames (`HD_FIT` counts); no feet frame floats above its anchor row. |
| Head | `renderHeadHd(s: HeadStyle, expr, d: 2 \| 4 \| 8, opts?: { glint?: boolean })` (`hd/head.ts`): HEAD_W·d × HEAD_H·d, the logical layout of `renderHead` (facing right; NECK and HEAD_CENTER at d times them), no outline, `glint: false` for tilted heads. d 8 is the Helium Head (`headScale: 2`) at 4×, drawn natively twice as large instead of enlarging a 4× head. All hair styles, headgears, extras and expressions; the squad's cues come from their select portraits. |
| Gear | `gunArtHd` / `gunHd(kind, d)`, `heldArtHd('grenade' \| 'snack' \| 'gift', d)`, `knifeArtHd(d)`, `propArtHd` / `propHd(kind, d)` (every prop drawn natively), `drawHandHd` / `handArtHd` (`hd/gear.ts`): exactly d × the 1× size, the 1× logical points (grip, grip2, muzzle, tip), no outline. Pieces: `pieceHd(lo, d)` (`characters/pieces.ts`); `decorateFrames` draws the 24 pieces natively. Burn and crumble: `withFlamesDense`, `crumbleDense` (`human-fx.ts`). |
| Registration | Every `char/<hero>/…` strip (the Helium twins too) registers `hd: (d) => gen(d)` (`human-sprites.ts`). The art pool spreads a hero over 7 workers by strip family (`familyOf`: `legs`, `torso-pistol`, `torso-heavy`, `ride`, `helium`, `helium-wob` and the full-body rest), so a hero never builds serially on one worker. |
| Tight 1× region | The 1× render paints each layer on a tight region round the figure (origin a multiple of 8) instead of the full 112 × 112 canvas, and paints again on the full canvas when the figure comes within 4 px of the region's border: the same bytes, 2.4× faster (`TIGHT_1X` counts; `renderHumanFullCanvas` for tests). |
| Cost | About 1.9 ms per 4× hero frame (node, one thread), 22.5 MB per hero at 4×; one hero at 4× with 8 workers 0.3–0.4 s, ten heroes 2.2 s. |

**What draws dense art** (groups cast, city, screens; one drawer per id, d 2 and 4, `PAL_HD`):

| Part | Files and APIs |
|---|---|
| The Swan | `vehicles/swan/hd-*.art.ts`: `SwanCanvas(w, h, d, ox, oy)`, `renderBodyHd(style, pose, d, body, front)`, `renderNeckFrameHd(spec, colour, d, lo)` (the neck of stamped tin-feather plates, `docs/design/swan-mount/look.md` §5.6), extras `…Hd(d, lo)`. |
| The boss | `bosses/ams/art-hd.ts` (`bodyHd(s, d)`, `headHd(s, d)`, `wigHd(d)`), `layout.ts`, `HdPiece(geom, d, opts)`. |
| Locals and people | `locals/rider.hd.ts` (`wheelHd`, `bikeHd`; every rider and handhaver strip `hd: (d) => …`), the gull, the tickets; `npc/ams`, the tourist hostage (`HD4_KINDS = ['tourist']`: ams frees only tourists) and the binds. |
| FX, shots, pickups | `fx/hd/` (`hdStrip(id, d, draw)`, `paintBillows` — explosion smoke erodes along smooth turbulence, never into ink balls — `explosionFramesHd`, flashes, tracers, shells, grenades), the pickups and the crate. Particles: while a dense mission draws, 'pixel' and 'rect' particles are small HD frames in art px (`particles.ts`: a hot core with a glowing rim and a motion streak for sparks and embers, a round lit puff for smoke, dust and steam, a lit chunk for debris, drops and casings; `PAL_HD` tones of the particle's colour, cached per look, size, colour and density). |
| Amsterdam | decor, layers, terrain and water: "UHD backgrounds and terrain (mission ams)" above. |
| Screens | Menus (`ui/base/*`, `ui/mil/*`, the logo, Gusto, `ui/radio`, the gags), the HUD (37 icon ids, the weapon icons as aliases; widgets `hudPanelHd`, `hudBarHd`, `hudGemHd`, `bubbleBoxHd` in `game/hud.ts` at `hudDensity(r)`), the ending flow (`ui/ending-*`, `ui/score-head/*`, `paintSky` / `paintWater`; the glitch bridge at g = min(d, 2)) and HD text (designed glyph tables, `docs/api/media.md` §6). Screens draw at `screenTier(r)` through the screen art API (`scenes/base.ts`, media.md §7). Still 2× only: the select portraits (`char/<id>/select`, `select-grey`, `portrait`) and the gag privates. |
| First-person mode | Walls and doors at 128² and 256² (`fps/walls-hd.ts`), the figures, props and items through `fps/figure-hd.ts` (the `figure3d` rigs rasterised at d into an `HdCanvas`, outline A), weapon views, the HUD and the faces at the tier; the view itself at density 2 (`docs/design/fps.md` §3.4). |

**Style spike**: `npm run uhd-spike -- [--out tmp/uhd-style] [--palette] [--only hero|swan|street|gear]`
renders the prototypes of the style gate: today's recruit as an HD hero (idle, run, shoot: `blob`
cloth volumes over `limb` outlines), the Swan's head and neck, a 128 × 96 ams street crop and the
gear / head contracts, at 2× and 4×, in the decided outline (plus one hero A vs B sheet,
`hero-outline-ab.png`) and the PAL_HD sheet. Each sheet sets the spike next to the game's
registered art: `game 2x` (since the wave, the UHD art itself; the street is a shot of section a)
and, for the gear and head contracts, the 1× art. `tmp/uhd-style/index.md` lists the PNGs and
generation times (node, one thread, cold and warm median of 5: a 40 × 42 hero frame about 3 ms
warm at 4× and 1–2 ms at 2×, the 128 × 96 street about 80 ms at 4× and 18 ms at 2×). Nothing in
the spike is registered in the game. Tests: `tests/art/palette-hd.test.ts`, `tests/art/hd-kit.test.ts`,
`hd-body.test.ts`, `hd-head.test.ts`, `hd-gear.test.ts`.

### Palette ramps per material

| Material | Ramp (`PAL.*`) | Notes |
|---|---|---|
| Skin | `skinA` fair, `skinB` tan, `skinC` deep | face template uses all 4 tones |
| Hair | `hairA` black, `hairB` brown, `hairC` blond | 3 tones |
| Field cloth | `olive`, `sand` (khaki), `stone` (grey), `slate` (blue-grey) | `slate` added by the art agent |
| Uniform accents | `red`, `navy`, `brass` (= gold), `cloth` (warm white) | `brass`, `cloth` added by the art agent |
| Leather, boots, belts | `brown`, `black` | `black` (added) is lighter than the outline, so black boots still read |
| Metal | `steel` (cool), `stone` (warm concrete), `rust` | 5-tone steel for guns and armour |
| Wood | `brown` | crates, planks, stocks |
| Fire, flashes | `fire` (deep red → white), `gold`, `orange` | explosions use `fire` only, then greys |
| Smoke, soot | `ink`, `stone`, `steel[0]` | |
| Foliage | `green` (dark tone leans teal) | |
| Water, ice, sky | `sky`, `navy`, `teal`, `snow` | |

### Sizes per entity class

| Class | Size | Anchor |
|---|---|---|
| Standing human | 35–37 px tall (feet to head top); hats add 1–6 px (helmet 38, bobble hat 40, plumed shako 42) | feet |
| Crouching human | ~27 px (legs + torso stacked) | feet |
| Head | 10–12 px tall, 12 px wide (3/4 view facing right) | — |
| Torso frames | about 22–30 px above the hip, 2–3 px below it | hip |
| Pickups | 16×14 plates, 12–18 px items | feet (rest on the ground) |
| Crate | 20×18 (+ outline) | feet |
| Bullets | 5–12 px tracers, 16-direction strips | centre |
| Explosions | visible size s ≈ 23, m ≈ 35, l ≈ 60, xl ≈ 88 px | centre |
| Portrait | 32×32 | top-left |

### Anchors and points (contract: `docs/ARCHITECTURE.md` §6.1)

- **feet** anchor: the frame stands ON line y (its lowest row, the outline under the soles, is
  y − 1). Ground contact is automatic in the rig (`grounded`, default true).
- **hip** anchor (torso frames): the pelvis pixel. Legs frames carry a `hip` point; the game
  draws the torso at `legs.hip`. The hip bobs during runs.
- **centre** anchor: projectiles and fx.
- Points: `hip`, `muzzle` (first pixel past the barrel tip), `hand` (near hand, or the item it
  holds — the grenade spawn point on throw frames, the gift on give frames), `head` (head
  centre — put stun stars at `head` − 8 px).

### Frame counts and default timing (ticks at 60 Hz)

| Animation | Frames | Timing |
|---|---|---|
| player `legs-run` | 12 (`runPoses(style, run8)`: the 8 keys + eased in-betweens) | 3 per frame, scaled by `strideRate` |
| player `torso-<w>-run` | 12 (index synced to the legs) | follows the legs |
| enemy run | 8 (contact, down, passing, push-off ×2) | 4 per frame |
| walk | 8 | 6 |
| crouch-walk | 6 | 6 |
| player `legs-idle` / `torso-<w>-idle` | 4 / 4 (hand-keyed breathing, `idlePoses`) | 16 / 12 |
| enemy idle (breathing) | 2 | 20–24 |
| player `legs-jump` / `legs-fall` / `legs-land` | 4 / 2 loop / 3 | 3 / 8 / 2,3,4 (`LAND_TIMING`) |
| player `legs-crouch-in` / `legs-crouch-out` | 3 / 2 (draw-only `crouchT`) | 2 each |
| player `torso-<w>-crouch` (+ `-shoot`, `-throw`, `-knife`) | 4 (+ 2, 6, 6) | 12 |
| shoot | 2 (recoil, rest) | 3–4, no loop |
| player throw (`P.THROW6`) | 6 (wind-up, cock, release = index 2, follow-through, settle, recover) | `P.THROW6_TIMING` (23); the game starts at the release frame |
| enemy throw | 5 (wind-up, cock, release, follow-through, recover) | 5,4,3,5,6 |
| player knife / `knife-b` | 6 / 6 (anticipation first; a/b alternate by `knifeCount`) | `knifeTiming(6)`, sum 14 |
| enemy knife | 5 (raise, slash, follow-through ×2, recover) | 3,3,3,4,5 |
| player `flip` (running jump) | 14 (`rot` 0 → 360) | 2 |
| player `die` | 12 (DIE keys with `DIE12_BOUNCE` + eased in-betweens + hand-keyed settle) | `P.DIE12_TIMING` |
| player `die-blast` / `die-drown` / `die-flat` | 10 / 12 / 7 | — / `P.DROWN_TIMING` (60) / `CRUSH_TIMING` |
| enemy die | 6 (hit, fall back, airborne, land, bounce, still) | last frame long |
| die-burn | 7 (2 on fire, smoking statue, statue, crumble ×2, ash) | |
| player `victory` / `spawn` | 8 / 6 | 4 (8 with a hero table) / — |
| player `fidget-a` / `fidget-b` (deferred) | 10 defaults, 9–14 per squad hero | `P.FIDGET_A_TIMING` / hero tables |
| player `timeout-yawn` / `timeout-sleep` (deferred) | 8 / 4 loop | — |
| player `mount-hop` (deferred) / `legs-dangle` | 5 / 6 loop | 3,3,3,3,4 / 6 |
| `fx/chute` / `fx/chute-collapse` / `fx/snore` (deferred) | 6 loop / 8 / 6 | — / — / 8 |
| riders (`enemy/fatbike-youth*`, `delivery-rider*`) | ride 8, idle 4, turn 3, tell 4, kick 4; fatbike `die-seat` 6, `get-up` 5 (deferred) | `RIDE_DURATIONS` (20-tick crank), `KICK_DURATIONS` [2,1,3,30] |
| `enemy/seagull` | walk 6, idle 6, takeoff 3, pull-up 2, turn 2 | — |
| `enemy/handhaver*` | idle 4, walk (with swing), turn 2, throw 5 | 12 / `HANDHAVER_WALK_TPF` |
| ams people (baker, vendor, staff 0–2) | idle 4, clap 4, wave 4, `in-<mode>` 2, turn 2 | `PERSON_TR_TICKS` 3, `PERSON_TURN_TICKS` 2 |
| tourist hostage | bow 5, freed 7, turn 2, sack-turn 2 | — |
| ams ambient | pigeons takeoff 2, ducks paddle 4, waver cat-swish 4 / lean 3, tour boat turn 2 | — |
| `boss/ams-mayor` | stamp-arm-0/1/2 12 (6 poses × 2 facings), arm-back 13, legs 11, wig 8 | — |
| explosions | 7–12 | 3–4 |

Each sprite registers its own defaults (`ticksPerFrame`, `durations`, `loop`), so
`Animator.play(id)` plays it correctly.

---

## 2. Files

| File | What |
|---|---|
| `src/game/art/paint.ts` | ramps (`R`), hashes and seamless noise (`hash2`, `noise1`, `fbm1`, `noise2`, `noise2x`), `bayer`, `shadeLayer`, `despeckle`, `Composer` |
| `src/game/art/humanoid.ts` | the human rig: `HumanStyle`, `Pose`, `renderHuman`, `stackFrames` |
| `src/game/art/humanoid-head.ts` | head templates: skull/face, 11 hair styles, 12 headgear, 10 expressions, face extras |
| `src/game/art/humanoid-gear.ts` | guns (pistol, heavy, rifle), hands, held items (grenade, knife, snack, gift) |
| `src/game/art/poses.ts` | keyframed pose tables (run, walk, crouch, jump, throw, knife, deaths, panic, victory …) |
| `src/game/art/human-sprites.ts` | `definePlayerSprites`, `defineSoldierSprites`, `poseFrames`, `withSwing`, `burnFrames`, `blastFrames`, `portrait` |
| `src/game/art/human-fx.ts` | `withPieces`, `sootify`, `scorch`, `withFlames`, `crumble`, `speckle` |
| `src/game/art/machines.ts` | machines kit + `machine/demo-tank`, `machine/demo-heli` |
| `src/game/art/bg.ts` | 11 background generators |
| `src/game/art/terrain-art.ts` | the terrain painter (1×) and the HD terrain painter (`paintTerrainHd`, `defineHdTerrainMaterial`) |
| `src/engine/palette-hd.ts` | `PAL_HD` (the HD palette of all 2× and 4× art), `hdRampOf`, `hdHome`, `hdTone`, `inHdPalette` |
| `src/game/art/hd/` | the UHD kit: `canvas.ts` (`HdCanvas`), `light.ts`, `texture.ts`, `shape.ts`, and the HD rig parts `head.ts`, `gear.ts`, `body.ts` ("UHD art") |
| `src/game/art/demo-art.ts` | `demo/bg`, `demo/bg-layers`, `demo/terrain`; `renderBackground`, `paintTerrainArea`, `DEMO_BACKGROUNDS` |
| `src/game/content/characters/art.ts` | `char/recruit/*` (`RECRUIT_STYLE`) |
| `src/game/content/infantry/art.ts` | `enemy/rifleman/*` (`RIFLEMAN_STYLE`) |
| `src/game/content/items/*.art.ts` | hostage, crate, pickups |
| `src/game/content/weapons/art.ts` | projectiles, muzzle flashes, HUD icons |
| `src/game/content/fx/art.ts` | explosions and small fx; imports bg + terrain + demos |

---

## 3. The humanoid rig

A figure is **style + pose**. `renderHuman(style, pose, part, density?)` solves a skeleton, draws each
body part as a shaded layer (far arm, far leg, near leg, coat tails, torso, belt, accessories,
head, gun, near arm, hand), stacks them with internal lines and outlines the silhouette.

```ts
import { renderHuman } from '../../art/humanoid';
const f = renderHuman(MY_STYLE, { weapon: 'heavy', aim: 'up', expr: 'shout' }, 'upper');
// f.buf, f.ox/f.oy (hip anchor for 'upper'), f.pts.muzzle / hand / head
```

`part`: `'full'` (feet anchor, everything), `'lower'` (feet anchor, legs + pelvis, `hip`
point), `'upper'` (hip anchor, torso + arms + head + gun).

### HumanStyle

| Field | Values |
|---|---|
| `skin`, `hair` | ramps (`'skinA'`, `'hairB'` …) |
| `hairStyle` | `short`, `buzz`, `spiky`, `mohawk`, `bald`, `long`, `ponytail`, `bob`, `parted`, `curly`, `puffs` |
| `headgear` | `none`, `helmet`, `cap`, `beret`, `bandana`, `goggles`, `hood`, `shako`, `bobble`, `rainhat`, `headset`, `fur-hat` |
| `gear`, `accent` | headgear colour; accent for plumes, bands, armbands, scarves, buttons, pompoms |
| `top`, `topType` | ramp + `vest` (shirt shows at the neck and as short sleeves), `jacket`, `tank`, `coat` (tails), `tunic` (brass buttons, high collar), `sweater`, `shirt` |
| `shirt` | colour under a vest (default sand) |
| `pants`, `boots`, `belt` | ramps |
| `gloves` | ramp, or `null` for bare hands |
| `build` | `slim`, `normal`, `heavy` |
| `accessories` | `pouches`, `armband`, `scarf`, `backpack`, `radio`, `ammo-belt`, `cross-belt`, `bowtie`, `satchel`, `epaulettes` |
| `face` | `moustache`, `beard`, `glasses`, `shades`, `freckles`, `stubble`, `blush` |

### Pose

Body space: origin at the feet centre, x forward (sprites face right), y down; degrees.

| Field | Meaning |
|---|---|
| `legN`, `legF` | near / far leg `{ hip, knee, foot? }`: hip = thigh angle from straight down (+ forward), knee = bend (+ shin swings back), foot = boot angle (+ toe up) |
| `armN`, `armF` | `{ sh, el, hand? }` (upper arm from straight down, + forward, 180 = up; elbow + turns the forearm up) or `{ to: [x, y], bend? }` = hand target relative to the shoulder (two-bone IK) |
| `hand` (in an arm) | `fist`, `grip`, `open`, `point`, `thumb` |
| `weapon` | `pistol`, `heavy`, `rifle`, `none` — places the gun and both hands |
| `aim` | `fwd`, `up`, `down`, `diag-up` (45° up: pistol and heavy gun, the up + forward aim), `diag-down` (45° down, heavy gun only: the machine-gun sweep); `recoil` (px), `lowGun` (rifle at the hip), `gunAngle`, `gunHand: 'far'` (gun carried low while the near arm throws or stabs) |
| `held` | `grenade`, `knife` (`heldAngle`), `snack`, `gift` |
| `expr` | `normal`, `shout`, `panic`, `hurt`, `happy`, `blink`, `yawn`, `chew`, `dazed`, `soot` |
| `lean`, `hunch` | torso tilt (+ forward); shorten the torso (breathing) |
| `head` | `{ dx, dy, tilt }` (tilt ≥ 8° rotates the head) |
| `headScale` | `2` = Helium Head (GDD §4.13): head and headgear drawn at 2× with Scale2x; the neck stays put |
| `crouch`, `legScale` | blend toward a deep crouch; foreshorten folded legs |
| `grounded`, `bob`, `dx`, `dy`, `rot` | feet on the ground (default) or airborne; pelvis drop; whole-figure offset; whole-figure rotation about the pelvis (falls) |
| `flutter` | scarf / coat-tail phase (set it in running frames) |

Rules the rig applies for you: feet rest on the ground line (or a kneeling knee); the gun
follows the hand that holds it; a near arm whose hand or forearm crosses the face is drawn
behind the head; far limbs are a shade darker. A grounded pose with `rot` (falls, lying
corpses) is re-grounded after the turn: its lowest pixel rests on the ground line, then `dy`
applies — so death frames lie ON the floor. Use `grounded: false` for frames that must float
(blown into the air).

Every rig frame carries the points `hand` (near wrist, or the held item) and `head` (head
centre); gun frames also carry `muzzle`. Points are relative to the anchor.

Pistol aim-up frames hold the pistol two-handed at the chin (the face stays visible). Both guns
have 45° up frames (`torso-<w>-diag-up`, `torso-<w>-shoot-diag-up`: the pistol two-handed in
front of the chest, tilted up, the barrel clear of the face) for the up + forward aim; only the
heavy gun has the 45° down frames (`torso-heavy-diag-down` …) for the machine-gun sweep. A
status effect may swap a strip for `<art>/<infix>-<anim>` (`StatusDef.art`; e.g.
`char/<id>/helium-legs-run`). The Helium Head strips are not drawn yet: render them with
`headScale: 2` and register them under that infix — the player falls back to the normal
strip for every id that is missing.

### Pose tables (`poses.ts`)

`STAND`, `RUN` (8), `WALK` (8), `CROUCH`, `CROUCH_WALK` (6), `JUMP` (2), `FALL`, `LAND`,
`BREATH` (2), `THROW` (5), `KNIFE` (5), `DIE` (6), `DIE_BLAST` (5), `DIE_KNIFE` (5), `BURN` (2),
`PANIC_COWER` (4, hands up, knees knocking), `PANIC_FLAIL` (4, arm-flail run for civilians),
`VICTORY` (4), `SPAWN` (4), `MOUNT` (2). Animation wave (players): `BREATH4` (4), `CROUCH_TORSO`
(4), `JUMP4`, `FALL2`, `LAND3`, `THROW6` (+ `THROW6_TIMING`), `KNIFE_B` (6), `DIE12_BOUNCE`,
`DIE12_SETTLE` (+ `DIE12_TIMING`), `DROWN` (12, + `DROWN_TIMING`; the near arm swings up and back
so the face stays visible at 2×), `FLIP_KEYS`, `MOUNT_HOP`, `DANGLE_KEYS`, `FIDGET_A_KEYS` /
`FIDGET_B_KEYS` (+ `_PER`, `_TIMING`). Builders in `human-sprites.ts`: `runPoses`, `idlePoses`,
`knifePoses`, `diePoses`, `flipPoses`, `danglePoses`, `drownFrames`, `crouchOutPoses`.
Merge them over a base with `seq(base, frames)`;
`swapLegs(p)` mirrors a leg phase; `withSwing(poses, k, elbow)` adds arm swing to leg cycles.

### Adding a playable character (≈ 30 lines)

```ts
// src/game/content/characters/art.ts
import { definePlayerSprites, BORED_STRETCH } from '../../art/human-sprites';
import type { HumanStyle } from '../../art/humanoid';
import * as P from '../../art/poses';

export const SCOUT_STYLE: HumanStyle = {
  skin: 'skinC', hair: 'hairA', hairStyle: 'ponytail', headgear: 'goggles',
  gear: 'brown', accent: 'gold', top: 'teal', topType: 'jacket', pants: 'slate',
  boots: 'black', gloves: 'brown', build: 'slim', accessories: ['scarf', 'pouches'],
};

definePlayerSprites('scout', SCOUT_STYLE, {
  // Optional: own fidget and victory (full-body poses).
  bored: BORED_STRETCH,
  victory: P.seq(P.STAND, [
    { armN: { sh: 175, el: 10, hand: 'thumb' }, expr: 'happy' },
    { armN: { sh: 160, el: 40, hand: 'fist' }, expr: 'shout', bob: 1 },
  ]),
});
```

This registers the whole `char/scout/…` contract (legs, torsos for pistol and heavy, deaths,
victory, spawn, bored, mount, portrait).

### Adding an enemy soldier

```ts
// src/game/content/infantry/art.ts
defineSoldierSprites('sapper', { ...RIFLEMAN_STYLE, headgear: 'helmet', gear: 'steel', build: 'heavy',
  accessories: ['ammo-belt', 'backpack'] }, { gag: MY_GAG_POSES, panic: P.PANIC_FLAIL });
```

The default gag is `GAG_SNACK` (a sneaky sandwich); the default panic is `PANIC_COWER`.
For other weapons pass `weapon: 'heavy'`. Hostage-like civilians: see
`src/game/content/items/hostage.art.ts` (sitting pose, chair, ropes clipped to the
silhouette).

### Death helpers

`burnFrames(style)` (flames → soot statue → crumble → ash), `blastFrames(style)` (scorched
tumble), `scorch(frame, steps)`, `sootify(frame)`, `withFlames(frame, phase)`,
`crumble(frame, t)`, `withPieces(frame, pieces)` (add props: chairs, ropes, hats).

### Props and instruments (`withPieces`)

The rig draws only `held: 'grenade' | 'knife' | 'snack' | 'gift'`. Anything else a figure
holds or sits on — a tuba, a baton, a chair, a camera, a banner — is a **piece** stacked onto
a rig frame:

```ts
import { withPieces, type Piece } from '../../art/human-fx';
// 1. Pose the figure WITHOUT a gun; reach the near hand to where the prop is held.
const f = renderHuman(STYLE, { weapon: 'none', armN: { to: [9, -2], hand: 'grip' } }, 'full');
// 2. Draw the prop once (shaded, outlined on its own: withPieces does not outline).
const tuba = drawTuba(); // PixelBuffer, already buf.outline(INK)
// 3. Place it relative to the frame anchor; the rig's points are relative to it as well.
const [hx, hy] = f.pts!.hand;
const pieces: Piece[] = [{ buf: tuba, x: hx - 5, y: hy - 12 }];
const out = withPieces(f, pieces, { muzzle: [hx + 8, hy - 14] }); // the bell = where shots leave
```

- `behind: true` draws the piece behind the figure (chair backs, a cape, the far half of a
  drum); otherwise it is drawn in front (the near hand will be covered — draw the fingers on
  the piece, or re-draw the hand with a second piece).
- The frame grows to fit; the anchor and all points stay correct. Pass extra points (the
  `muzzle` of an instrument that fires, a `hand` for a throw) as the third argument.
- Build the prop buffer **once** per strip and reuse it in every frame; move it with the
  hand point so it follows the walk bob. Example in the code: `content/items/hostage.art.ts`
  (chair behind, ropes in front).

---

---

## 4. Weapons, projectiles, pickups

- Gun graphics: `gunArt('pistol' | 'heavy' | 'rifle')` with `grip`, `grip2`, `muzzle`. The
  heavy gun is ONE shared graphic for every special weapon.
- **Direction strips** (for `src/game/projectile.ts`, `look: 'angle'`): 16 frames, frame 0
  points right, clockwise. `weapon/bullet` (= `bullet-pistol`), `weapon/mg-bullet`
  (= `bullet-mg`), `weapon/vulcan-bullet`, `weapon/shell`, `weapon/rocket`.
- Round shots (any direction): `weapon/pellet`, `weapon/enemy-bullet` (alias `enemy/bullet`,
  2-frame pulse; high contrast: white core, hot ring, ink rim).
- Spinning strips (`look: 'anim'`): `weapon/grenade` (8), `weapon/enemy-grenade` (4, alias
  `enemy/grenade`).
- Muzzle flashes are anchored at their base: `fx/muzzle`, `fx/muzzle-heavy` point right,
  `fx/muzzle-up`, `fx/muzzle-heavy-up` point up, `fx/muzzle-diag`, `fx/muzzle-heavy-diag` point
  up-right at 45° (the game flips them for the other directions); also
  `weapon/muzzle-pistol`, `weapon/muzzle-heavy`.
- Pickups: `defineWeaponPickup(weaponId, letter, accent)` registers `item/pickup-<letter>` and
  `item/pickup-<weaponId>` (GDD §7.1: a round 17-px ivory band-uniform button, gold rim, navy
  letter, glint + bob). Letters: M machine-gun, R rocket-launcher, S shotgun, F flamethrower,
  L laser, H homing, T tuba, B bounce-mine (old ids `rocket`, `bouncer` still draw).
- HUD icons (top-left anchor): `ui/icon-<weaponId>`, `ui/icon-bomb`, `ui/icon-life`,
  `ui/icon-hostage`, `ui/icon-shell`.

## 5. FX

`explosionFrames({ radius, frames, seed, puffs, chunky })` — flash, billowing fireball of
seeded puffs (each lit from the top-left), cooling to smoke that frays with ordered dither.
`chunky: true` renders at half resolution and doubles the pixels (use for l / xl).
The 2× / 4× fx are separate drawers in `content/fx/hd/` ("UHD art").
`cloudFrames(radius, frames, ramp, outline)` — smoke, soot and dust puffs.
All fx are centre-anchored. Debris: `fx/debris-<kind>` has 4 frames = the piece turned in
quarter steps (random frame = random orientation; playing them = tumbling).

## 6. Machines kit (`machines.ts`)

Parts return shaded buffers **without** outlines; stack them in one buffer (leave a 1-px
margin) and outline once: `buf.outline(INK)`.

| Part | Use |
|---|---|
| `wheel(r, phase, { tyre, rim, bolts, steps })` | road wheels; bolts turn with the phase |
| `tread(len, h, phase, { period, wheels })` | track loop; `period` phases = one seamless loop (3 by default) |
| `plate(w, h, ramp, { bevel, rivets, spacing })` | armour plates; rivets `corners`, `edges`, `grid` |
| `hull(w, h, points, ramp)` | polygon plates with bevel |
| `barrel(len, thick, ramp)` | gun barrels (ring + muzzle brake), pointing right |
| `rotor(len, phase)`, `tailRotor(r, phase)` | 4-phase rotor blur |
| `glass(w, h, { bars })` | cockpit glass with a reflection streak |
| `hazard(w, h, { stripe })` | warning stripes |
| `damage(buf, amount, seed)` | bullet holes, scorch smudges, dents on a finished machine |

`demoTank(phase, damaged)` and `demoHeli(phase)` show how the parts combine.

## 7. Backgrounds (`bg.ts`)

`defineBgGenerator(id, (w, h, params, seed) => PixelBuffer)`. Rules for every generator:
exactly w × h; horizontally seamless (only use functions with period w — `noise1`, `fbm1`,
`noise2x`, `sin(2πkx/w)` with integer k — and draw shapes that cross the edge again at
x − w with `setW`); deterministic per seed; palette colours. Prefer widths that are a
multiple of 4 (the Bayer dither repeats every 4 px). Tests check the seam.

| Generator | Main params (all optional) |
|---|---|
| `sky-gradient` | `colors` (top → bottom) or `ramp` + `reverse` or `top` + `bottom`; `bands`, `dither`, `y0`, `y1`, `stars`, `sun: {x, y, r}`, `moon` |
| `clouds` | `ramp`, `y`, `spread`, `count`, `size` |
| `mountains` | `ramp`, `y`, `height`, `layers` (1–3), `scale`, `snow` (true / snow line), `snowRamp` |
| `hills` | `ramp`, `y`, `height`, `scale`, `bushes` |
| `treeline` | `ramp`, `y`, `height`, `size`, `trunks` |
| `jungle` | `ramp`, `y`, `height`, `vines`, `fronds` |
| `city` | `ramp`, `y`, `height`, `windows`, `lit`, `night` |
| `ruins` | `ramp`, `y`, `height`, `rebar` |
| `dunes` | `ramp`, `y`, `height`, `waves` |
| `ice-peaks` | `ramp`, `y`, `height`, `scale` |
| `sea` | `ramp`, `y` (horizon), `sparkle`, `foam` |

`y` and `height` accept px or fractions of h (≤ 1). Ready-made stacks: `DEMO_BACKGROUNDS`
in `demo-art.ts` (grassland, desert, snow, city at night, jungle, ruins at dusk, sea); copy and
adapt. Far layers get small `factorX` (0–0.15), near layers larger (0.3–0.5).

Layer fields (`BgLayerDef` in `art-registry.ts`): `gen`, `params`, `width` (default 512),
`height` (default 216), `factorX`, `factorY`, `offsetX`, `offsetY`, `repeatX` (default true),
`repeatY` (default false), `alpha` (0–1, e.g. 0.7 for front clouds), `driftX` / `driftY` (px
per tick on top of the parallax: clouds that move while the camera is locked), `front` (draw
in front of the entities).

**Tall sections** (`scroll: 'up'` / `'down'`): a layer that should not repeat vertically must
be `216 + (sectionHeight − 216) × factorY` px tall, or the view runs off its bottom (the clear
colour shows). Either size it so, or make it vertically seamless and set `repeatY: true`.
Keep `factorY` small for far layers (0–0.2) like `factorX`.

Dense layers (mission ams): `defineHdBgGenerator`, see "UHD backgrounds and terrain (mission ams)".

## 8. Terrain painter (`terrain-art.ts`)

Registered with `setTerrainPainter`. A `TerrainStyleDef` picks materials:

| Kind | Materials |
|---|---|
| `ground` | `dirt`, `sand`, `rock`, `snow`, `ice`, `mud`, `metal`, `concrete` (darker deeper underground) |
| `edge` | `grass` (tufts + overhanging lips), `snow`, `sand`, `moss`, `rust` (streaks), `tiles` |
| `platform` | `wood`, `metal` (grating + brackets), `rock` (drips), `ice` (icicles) |
| `solid` | `metal` (panels, rivets), `concrete`, `crate` (16-px crates from the block corner), `rock`, `brick` |

How it stays seamless: the painter samples `cellAt` over the chunk plus a margin (96 px left
and right, 52 above, 8 below) and measures for every pixel how far the region continues up,
down, left and right. The distances are clamped below the margins, so a pixel's colour depends
only on its world position, the terrain and the style. Painting in any chunk size gives the
same pixels (tested). Cost: about (w + 192) × (h + 60) samples per chunk — paint at load
time, not per frame.

Adding a material: add an entry to `GROUND`, `EDGE`, `PLATFORM` or `SOLID`. A material is a
function of `Px` (world x, y and the run lengths `up`, `down`, `left`, `right`). Use world
coordinates for patterns (`hash2(p.x, p.y, seed)`, `noise2`), never chunk coordinates.

Amsterdam materials: ground `klinker`, edges `bikepath` and `kerb`, platform `whitewood`. HD
materials (2× and 4×, mission ams): `defineHdTerrainMaterial`, see "UHD backgrounds and terrain
(mission ams)".

---

## 9. Checklist for art agents

1. Read `docs/ORIGINALITY.md`; invent your own shapes, names and emblems.
2. Use palette ramps only; add a ramp to `palette.ts` only from existing colours (dark → light).
3. 1-px INK silhouette outline; light from the top-left; 3–4 tones; no single-pixel noise.
4. Follow the sprite contract ids, frame counts, anchors and points (`ARCHITECTURE.md` §6.1);
   put a `muzzle` on every aim/shoot frame and a `hand` on throw/give frames.
5. Projectiles: direction strips (16 frames, frame 0 right, clockwise) or round shots.
6. Register timing defaults with `defineSprite` (`ticksPerFrame` / `durations`, `loop`).
7. Generators are deterministic: `hash2`, `noise*`, `seededRand` — never `Math.random`.
8. Run `npm run sprites -- <prefix> --marks` and look at the PNG at 1× and 3×; critique
   silhouette, readability against busy backgrounds, and motion between frames.
9. Add tests in `tests/art/` (frame counts, points, palette, seams for tiling art).
10. Keep generation fast (a whole character set builds in well under a second).
11. 2× and 4× art (mission ams flow only): one density-generic drawer per id, same frames, sizes,
    anchors and points as the 1× strip, buffer d times the size, crisp, `PAL_HD` only, the UHD
    style decisions (section 1, "2x art (mission ams): the dense art contract", "UHD art");
    check with `npm run sprites -- <prefix> --density 4 --marks` and `--density 2`, and in game
    with `npm run shot -- --mission ams --res 8 --art 4`.

---

## 10. First-person mode (after mission ams)

The spec is `docs/design/fps.md` (ids in its §8); the originality rules are in
`docs/ORIGINALITY.md`, "Exception: the first-person mode". This section adds the art rules of
the mode. Everything in section 1 still applies, except where this section says otherwise.

### Exception: red blood (user decision 2026-10-14)

- **Only in the first-person mode** (sprite and texture ids under `fps/`). Every other mission,
  the menus, the bridge's ams snapshot and the 2D cast stay bloodless (section 1).
- Allowed: blood pools on the floor (`fps/fx/blood-pool`), hit spurts (`fps/fx/spurt`), blood in
  the enemies' and MechaHitler's `die` and `dead` frames, a small red cut on the hero's face in
  the two lowest health bands, and the `blood-pool` pickup.
- Colours: `PAL.red[0..2]` only (no new colours, no gore: no severed parts, no exposed bones or
  organs). Deaths read as the classic genre: a fall with a red splash, then a still corpse.

### Raycaster art

| Rule | Detail |
|---|---|
| Wall and door textures | 64 × 64, opaque, palette-only, registered with `defineRayTexture`. They tile seamlessly left/right (a test checks the edge columns). Light still comes from the top-left inside the texture; the engine makes the darker side (north/south faces) itself with `stepShade(c, −1)` — never draw a second, darker copy. Keep strong vertical structure (seams, posts, banners): horizontal detail shimmers less at a distance. |
| Historical symbols | Allowed on banners and flags only (user decision 2026-10-14: "swastika banners and flags"): the `B` and `K` wall textures and the `banner-pole` prop. Not on uniforms (no armbands), not on the boss. Draw them in our own pixels on a red field with a white disc; no other text or slogans on walls. |
| Protected emblems | Never draw the Red Cross emblem (a red cross on white) or any cross on a first-aid item, wall, vehicle or uniform. The first aid is an olive pouch with a white band (spec §4.5). |
| Billboards | `defineRayBillboard`: 64 × 64 texels for people, props and items (96 × 96 for the mech), transparent background, the figure standing on the bottom row (its feet touch the floor line), centred on column 32 (48 for 96). A person fills about 52 of the 64 rows; items sit in the lower third. 1-px INK outline as everywhere. |
| Yaws | Moving actors have 8 yaws: render 0 (facing the viewer) to 4 (facing away) with the 3D joint rig (`src/game/art/figure3d.ts`); the engine mirrors 5–7 from 3–1. Tell, attack, pain and death frames have 1 yaw (they always face the viewer). Keep the silhouette readable at 16 px tall (a far enemy). |
| Frame sets | Exactly the frame counts of the spec's §8.2 table (people: `move` stand + 4 walk; `act` tell, shoot, pain, die 1–4, dead; the dog and both boss phases have their own counts, see the table). The tell pose must read at a glance (weapon raised to the eye), because it is the player's warning. |
| Screen sprites | Weapon views (112 × 80, anchor bottom-centre), the status bar (384 × 40), HUD icons and the face (32 × 32 in a round porthole) are normal sprites (`defineSprite`) with ids under `fps/`. |
| Originality | No traced or recreated sprite, texture, HUD layout, face portrait or treasure of the reference game. The setting is industrial (depot, rail yard, hangar), the treasures are our own (pocket watch, tuning fork, gold bars, music box, golden record), the 1UP is a tin toy swan. |
| Look | `npm run sprites -- fps/` (screen sprites) and `npm run sprites -- fps/ --ray` (textures and billboards, all yaws); `npm run shot -- --fps 1 --pose x,y,deg` for the game view. Look at 1× too: the view is 384 × 176. |


### Raycaster details (group art, 2026-10-16)

Where the art lives:

| File | What |
|---|---|
| `src/game/art/wall-tex.ts` | the §8.1 painters (`WALL_PAINTERS`, `paintWall`), wrap-x helpers (`wset`, `wrect`, `noiseFill`, `band`), `banner` and `hookedCross` (the symbol; used only by the two banner walls and the `banner-pole` prop) |
| `src/game/art/figure3d.ts` | the 3D joint rig: `Figure` (`cap` tapered capsule, `ball`, `ell` ellipsoid, `box`, `cyl` flat-capped cylinder, `dot`, `overlay`), `renderFigure` (orthographic, 8 yaws, depth buffer, top-left key light, banded shading, part seams, INK outline), `ik` (two-bone elbows / knees), rotations |
| `src/game/content/fps/textures.ts` | registers every §8.1 texture |
| `src/game/content/fps/billboards.ts` | soldiers (one builder, `SoldierKind` guard / officer / ss / boss on foot), dog, the mech suit, the wreck, blood fx |
| `src/game/content/fps/props.ts`, `pickups-art.ts` | §5.1 props and §4.5 items (the rig seen a little from above, `pose: rotX(tilt)`) |
| `src/game/content/fps/weapon-art.ts` | the four weapon views (the rig from behind, `yaw: 4`, the barrel tipped up the screen) |
| `src/game/content/fps/hud-art.ts`, `faces.ts` | the status bar pieces and the 24-frame faces |
| `tools/art/import-face.ts` → `src/game/content/fps/art/mecha-face.gen.ts` | the user-art import (§8.7) |

Rules learned while building it:

- **No pure white in textures.** The engine darkens the y-side faces with `stepShade(c, −1)` along
  the colour's HOME ramp; white's home ramp is `fire`, so white turns yellow on the dark side. Use
  `PAL.snow[2]` as the brightest texture colour (lamps and glints may stay white).
- **Flat bands, narrow dither.** Wide Bayer fields turn into a dotted checkerboard when a wall
  fills the view. `band(v, x, y)` (and the rig's shading) dithers only the middle 20–24 % between
  two ramp steps.
- **Everything wraps on x.** Draw texture features with `wset` / `wrect` so a banner or a crate
  that crosses the right edge continues on the left (the seam test compares column 63 with 0).
  Door slabs are framed on purpose (one per cell) and are not seam-tested.
- **Rig scale.** People: `scale 1.1` (about 56 of 64 rows), dogs `1.3`, the mech `1` in a 96
  canvas. The death fall lies the body on its side and turns it 0.75 rad away from the viewer so
  the corpse fits the 64 columns.
- **The mech face** is blitted after rendering, on the front yaw (`face34`) and the front
  diagonal (`face27`, shifted 3 px); the side and back yaws draw the head in 3D in the face's grey
  hair and skin colours. Effects on the imported pixels only: eye flare (tell), white flash
  (pain), cracks (break 1–4), dark eyes (break 4 and the wreck). Never paint over the face by
  hand; re-run `npm run art:import-face` after changing the PNG (a test fails when the module is
  stale).
- **HUD faces** reduce each friend's own select portrait (`selectPortrait(id, 2)`, box filter →
  `nearest`) around the eye line; the per-friend eye / mouth table `GEO` in `faces.ts` places the
  damage marks. The 1× recruit face keeps the old 2× template head (`renderHeadHi`), so its 1×
  pixels stay byte-identical; its 2× / 4× faces use the HD head (`renderHeadHd(RECRUIT_HEAD,
  expr, 2·d)`).
- **UHD (2× / 4×)**: the same designs drawn natively — walls and doors at 128² / 256²
  (`fps/walls-hd.ts`), figures, props and items through `fps/figure-hd.ts` (outline A), weapon
  views, HUD and faces at the tier; each ray asset has a carrier sprite `fps/ray/<id>`
  (`fps/ray-art.ts`) so the art pool builds it. Spec: `docs/design/fps.md` §3.4.
- **Look:** `npm run sprites -- fps/ --ray` writes `ray-tex-*` (each texture twice side by side
  plus its dark side) and `ray-bb-*` (one row per yaw; one-frame items and props share rows).

## Motion

Smooth animation with the 1990s arcade *fidelity* (frame counts, timing, anticipation,
follow-through, in-betweens), never its looks: every frame is our own rig, styles and palette.

### The 9 motion rules

1. **Own looks.** Existing styles, rig and 64-colour palette. Never copy a reference pose.
2. **Key, then tween.** Hand-key 3–6 poses; generate in-betweens with `tween` + an easing.
   Hand-key tiny motions (idle, breathing): a tween of a 1-px move only makes duplicate frames.
3. **One-shot actions:** anticipation (1–2 frames), fast action (1–2 ticks/frame), follow-through
   and settle (2–3 frames). Loops ease at the turning points.
4. **Control first.** Shoot, knife, throw, hit, jump, land, vehicle and victory cancel a cosmetic
   strip on the same tick. The player keeps instant turns. Hitboxes, muzzle origins, release
   frames and sim timing do not change.
5. **Transitions are draw-only timers.** Gameplay reads the steady-state strips.
6. **Smoothness gate:** no two consecutive frames identical; joint travel ≤ 3 px per displayed
   tick at 1× (after `rot`/`dx`/`dy`); at most 2 frames per strip marked smear.
7. **Determinism:** no `Math.random` / `Date`; variants by per-entity counters, never
   `world.rng` / `fxRng`.
8. **Budget:** report frames added and generation ms (`npm run anim-bench`); limits in
   `tmp/anim-budget.md`.
9. **Per-hero tables:** wrap them generically; rewrite a hero's own table only in its owner area.

### Tween API (`src/game/art/tween.ts`)

`inbetween(style, a, b, t, {hold?})` and `tween(style, keys, {counts | perKey, ease, loop, hold})`.
Numbers lerp (a missing side is neutral: 0, or `legScale` from `crouch`); angles take the
shortest arc; `rot` lerps literally (0 → 360 = one flip); `armN/armF`, `flutter`, `heldAngle`,
`gunAngle` are never invented (the nearer key holds); discrete fields switch at t ≥ 0.5 or by
`hold`; an FK arm against an IK arm converts the IK one with `poseJoints`; `head.tilt` snaps to
0 / ±8; a `grounded` change makes airborne in-betweens that lerp the pelvis height.
Easings: `EASE.linear | in | out | inOut | outBack`.

```ts
import { tween } from '../art/tween';
// Anticipation, strike, follow-through, settle: 4 keys, eased in-betweens.
const KEYS: Pose[] = [READY, WIND, STRIKE, SETTLE];
const poses = tween(style, KEYS, {
  perKey: [1, 0, 2],               // in-betweens per key pair
  ease: ['in', 'linear', 'outBack'],
});
defHi(pre + 'swing', full(poses), { durations: [4, 3, 2, 2, 3, 4, 6], loop: false });
// Loops: tween(style, RUN, { counts: 1, ease: 'linear', loop: true }) wraps last -> first.
```

### Smoothness gate (`tests/art/motion.ts`)

`poseJoints(style, pose)` (humanoid.ts) gives the solved joints in 1× px. `motionReport({style,
poses, durations, smear?, loop?})` gives the largest joint travel per displayed tick for each step;
`assertSmooth(opts, 3)` fails with the step index; `assertNoDuplicateFrames(id)` compares the
rendered frames of a sprite id at 1× and 2×. Today: `legs-run` worst 1.97 px/tick, `die` worst
2.56 px/tick (recruit).

### Creature turns

`turnSquash(frame, widths = [0.66, 0.33])` (`creatures/draw.ts`) squeezes a frame to each width,
ground-anchored on the same anchor column, despeckled and re-outlined (any density). `Turner`
(`creatures/common.ts`) times it: a turn starts only after the target was ≥ 12 px behind for ≥ 8
ticks; `frame()` narrows, `facing` flips at the midpoint, then it widens; `snap(f)` cancels.

### Engine hooks (docs/api/media.md §5, §8)

- `Animator.update(rate)` with `strideRate(speed, nominal)` (`math.ts`): a walk or run cycle that
  follows the speed (draw-side only). `easeOutBack` is the shared overshoot curve.
- `SpriteOpts.defer`: rare cosmetic strips (fidgets, timeout, drown, get-up) leave the boot
  preload and come last in the dense preload; first use makes them.
- `npm run anim-bench` (baseline `tmp/anim-baseline.json`, budget `tmp/anim-budget.md`) and
  `npm run geometry-fixture -- <ids>` (verifiers only, for strips changed on purpose).
