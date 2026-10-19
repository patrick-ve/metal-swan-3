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
| Palette only | Every pixel is a colour of `PAL` (64 colours). Tests check this (`tests/art/sprites.test.ts`). No alpha-blended pixels inside sprites; translucency is a renderer effect. |
| Outline | 1-px `INK` outline around the silhouette (4-connected). Internal lines between overlapping parts use the **darkest shade of the part behind** (a cast-shadow edge), not black. The `Composer` in `paint.ts` does both. |
| Light | From the **top-left**. Lit edges one shade lighter, bottom/right edges one shade darker, the ramp's darkest colour for creases and internal lines. Far limbs are one shade darker than near limbs. Flipped sprites keep the same pixels (the light then comes from the top-right — accepted). |
| Tones | 3–4 tones per material: base, highlight, shadow, deepest. Glints (one extra-light pixel) only on metal, boots and helmets. |
| Clean clusters | No single-pixel noise. Texture comes from 2×2 clusters, seams, rivets, strata. Dither only with the ordered Bayer pattern and only at band borders (skies, explosions, smoke). `despeckle()` removes stray pixels from shaded parts. |
| Readability | Big heads (10–12 px), big boots and gloves, exaggerated poses, faces never hidden by the near arm (the rig moves a face-crossing arm behind the head). |
| Bloodless | Deaths are cartoon: stagger and fall, scorch-black tumble, soot statue that crumbles to ash, dizzy stars. Never blood. (One dated exception: the first-person mode, section 10.) |
| Originality | Our own designs only (see `docs/ORIGINALITY.md` §Art). No look-alikes of any existing game's characters, vehicles, crates or HUD. |

**High-resolution displays** (`docs/ARCHITECTURE.md` §3): art is authored at 1× — every
size, anchor, point and rule here is in logical pixels — plus optional 2× versions for mission
ams (next section). On a large display the browser draws a k-times backbuffer: sprites are
filtered once by the GRAPHICS mode (`pixel`, the default: none; `smooth`: a palette-exact
scaler that rounds stairs and diagonals; `xbr`: smoother curves with blended edge colours),
everything else is enlarged as crisp blocks. Never filtered: backgrounds and
terrain chunks, `image()` buffers, the font, sprite ids under `UNFILTERED_PREFIXES` in
`render-common.ts` (`ui/`, except the character art in `FILTERED_UI_PREFIXES`) and the exact ids
in `UNFILTERED_IDS` (the large explosions' dithered fire, the `Fabel` script sign). In `xbr`
mode, `decor/` sprites use `smooth` (xBR rounds bricks and windows and seams tiled strips). A
scaler adds no detail; it only reshapes edges, so 1-px details, dither and tiny text read best
kept crisp — add an exact id (or a prefix) for art that suffers, or better, fix the art: 2 × 2
checker crossings between a light stroke and a dark ground become small rings in `smooth`;
letters on a plain band do not (so the STADHUIS lettering on `decor/ams/stopera` sits on a
plain dark plaque). Check the
look headless: `npm run shot -- … --res 5 --gfx smooth`.

### 2x art (mission ams)

Mission ams (`MissionDef.artDensity: 2`) can draw a 2× version of any sprite id, shared ones
included (players, the Swan, fx, items …): register it with `defineHiSprite(id, gen2x)` (or
`defineSprite(id, gen, { hi: gen2x })`). Only ams draws it; m0–m5, the title, the attract demo
and all game logic keep the 1× frames. The engine contract is in `docs/ARCHITECTURE.md` §3 and
`docs/api/media.md` §5. Rules:

| Rule | Detail |
|---|---|
| Same logical geometry | The same number of frames as the 1× strip; each frame the same logical size, anchor and named points as its 1× frame. Points and anchors stay in LOGICAL px (the game reads them for muzzles, hands, seats, hitboxes). The registry enforces it: a 2× frame is re-framed to the 1× rectangle (pixels outside it are cut, with a warning); a wrong frame count, an odd buffer size or different points make the id fall back to its 1× frames (`npm run sprites` reports `id@2x`). |
| Buffer = 2× | Each buffer is exactly twice the 1× buffer in both directions: one logical pixel = a 2 × 2 block. Draw on the 2× grid; a 1× part can be placed with `blitFrame(f, x, y, o, 2)` (doubled), a 2× part with `getFrames(part, 2)`. Rotations: `rotated(a, { align: 2 })`. |
| Crisp | Hand-placed pixels at double density: no filter, no smoothing, no anti-aliasing or blended edge colours. The GRAPHICS filters never touch 2× frames. |
| Palette only | Every pixel opaque and from `PAL` (as for 1× art); use the extra density for detail (rivets, seams, eyes, folds, highlights), not for new colours. |
| Light top-left | The same light as the 1× art: highlights up-left, shadows down-right; the 2× frame must read as the 1× frame seen closer, never as a different design. |
| Outline width | **DECIDED (user, 2026-10-13): 2 px at 2×** (= 1 logical px, the weight of the 1× art), for the silhouette and for the inner rings between parts, with the 2× grid used for the details inside (eyes, seams, grain, crescents) as 1-px lines. This is what the pilot (seagull, supply crate) registers. The pilot compared a 1-px outline (variant A, only a scratch render): it looked softer and weaker next to the 1× sprites and lost small gaps (the gull's legs merged). Compare `tmp/hires/g2-pilot/gull-poses-k5.png` and `crate-k5.png` (rows 1×, 2×-A, 2×-B). |
| Helpers | `src/game/art/hi.ts`: `HiSketch` (the 2× `Sketch`: logical body space, `line` = outline width), `HiPen` (logical coordinates, half steps reach single 2× pixels: `dot`, `fine`), `asHi` / `fitHi` (match a 2× buffer to its 1× frame), `liftHi` (a 1× effect frame such as flames or crumbling, on 2× source art), `squashedHi`, `outlineHi`. Examples: `locals/seagull.art.ts` (`gullHi`, `gullStripHi`), `items/crate.art.ts` (`crateStripHi`). |
| Human rig at 2× | `renderHuman(style, pose, part, 2)` draws the figure as 2× art: the joints are found on the 1× grid (so every part sits where the 1× frame has it), limbs, torso and gear are drawn on the 2× grid with the true shape at half-pixel steps, bands (`shadeLayer({ density: 2 })`), specks (`despeckle(l, keep, 2)`), rings and the outline (`new Composer(w, h, 2)`) at the 1× weight, and the result is the 1× frame's rectangle doubled (same logical size, anchor and points; 1× geometry is cached, so a 2× render of a figure already drawn at 1× draws only the 2× canvas). Gear has hand-drawn 2× twins (`gunArtHi`, `knifeArtHi`, `propArtHi`, `heldArtHi`, 2× hands in `drawHand(…, density)`). `poseFrames`, `burnFrames`, `blastFrames` and `portrait` take a density; `definePlayerSprites` registers 2× art for every `char/<id>/…` strip. Heads go through ONE hook, `headLayerHi(style, expr)` in `humanoid.ts`: it uses `renderHeadHi(s: HeadStyle, expr: Expression): PixelBuffer` from `humanoid-head.ts` (hand-drawn templates in `humanoid-head-hi.ts`; a 36 × 38 buffer, the 18 × 19 head on the 2× grid, NECK / HEAD_CENTER the same logical pixels; a tilted head is drawn with `{ glint: false }`, so the 1-px eye highlight `W` cannot drift off the pupil). Without that export the 1× head would be copied at 2×. The gun-grip fist (`'grip'`) is 1 logical px smaller at 2×, so the gun's grip shows round it. |
| Amsterdam cast at 2× | Riders (`locals/rider.art.ts`: `drawBikeHi`, `fatWheelHi` / `cityWheelHi`, `cubePackHi`, `capFramesHi`; 2× bikes are cached per look, and a pair set reuses the 2× death strips of the solo set with the same rider via `RiderSetOpts.same`), the handhaver (`bookHi`, `ticketFramesHi`: no letters on the ticket or the vest, both are drawn mirrored when facing left), the tourist hostage's chair / sack flow (`items/hostage.art.ts` `HI_STRIPS` for `HI_KINDS`, `binds.art.ts` `chairPieceHi`, `sackPieceHi`, `ropeBitFramesHi`), the NPCs (`missions/ams/npc.art.ts`: aprons, scoop, salute forearm, counter, omafiets, window), the ambient life (`missions/ams/npc-hi.art.ts`: pigeons, ducks, the tour boat, the window cat). Crush strips at 2×: `art/hi-strips.ts` `crushStripHi` (with `fitBounds` for trimmed 1× frames). `tests/art/cast-hi.test.ts` lists the ids. |
| Fx at 2× | `fx/explosion-*` (`explosionFramesHi`: the same puffs sampled on the 2× grid, dither and embers on whole geometry cells, `rimHi` keeps the 1× rim weight and pattern), `fx/impact`, `fx/hit`, `fx/dust`, `fx/splash`, `fx/debris-<dirt|metal|plant|wood>`, `fx/poof`, `fx/confetti(-bit)` and `fx/music-note` (`content/fx/hi.art.ts`). `tests/art/fx-hi.test.ts` lists the ids. |
| Items at 2× | Weapon medallions (`weaponStripHi`, every alias id), bombs, food and treasure (`PICKUP_HI`) in `content/items/pickups-hi.art.ts`, registered from pickups.art.ts. `item/pickup-1up` and `item/pickup-repair` stay 1× (ams never drops them). `tests/art/items-hi.test.ts` lists the ids; `tests/art/hi-dither.test.ts` checks every 2× fx, weapon and pickup id for single-pixel checker dither. |
| Density-blind helpers | Some shared 1× helpers mix buffer px and logical px and give wrong anchors on a 2× frame: the quarter turns in `weapons/shots.art.ts` (`ringStrip`, `turnFlash`) and `creatures/draw.ts` (`squashed`, `reground`). Use the `hi.ts` helpers (`squashedHi`, `turnFrame(f, q)` for exact quarter turns with the anchor in logical px, `turnHi(src2, angle, base1, { outline })` for any turn of a 2× source fitted to its turned 1× frame, `rotated(a, { align: 2 })` and `asHi` / `fitHi` for the anchor) on 2× frames; the weapons art (`weapons/art.ts`, `shots.art.ts`) uses them for every shot and flash, or compute anchors with `frameW` / `frameH`. `mirrored()` (characters/pieces.ts), `withPieces` / `decorateFrames` (pieces at logical offsets; a 1× piece is doubled unless a hand-drawn 2× twin is registered for it with `setHiTwin` (the characters/pieces.ts `piece(…, hiRows)` does this), a piece with `density: 2` is placed as it is), `sootify`, `scorch` and `speckle` handle 2× frames; `withFlames` and `crumble` are 1× recipes, lifted with `liftHi` (see `burnFrames`). The registry re-frames a misplaced result and only warns, so a mistake here shows as misplaced art, not as a logic change. |
| Uneven pixels at odd k | A 2× pixel is k/2 screen px: exact at k = 2, 4, 6; at k = 3 and k = 5 (1080p) the columns alternate 2/1 and 3/2 px. The pattern is fixed to the sprite (no shimmer when it moves; a flip swaps which columns are wide). Do not rely on single 2× px lines having one even width. |
| Res 1 | On a 1× backbuffer the game draws the 2× frame reduced to the top-left pixel of every 2 × 2 block; keep that reduction readable (or close to the 1× frame). |

Check it: `npm run sprites -- <prefix> --density 2 --marks` (2× sheet, points where the game
reads them), `npm run shot -- --mission ams --res 2` (or `--res 5`) for the game look, `--art 1`
for the 1× look. `tests/engine/hires-density.test.ts` checks the geometry of every 2× sprite.

**Spike: half-pixel joints (`HALF_PX_JOINTS`, default OFF; plan Phase 4, user A/B).** In
`humanoid.ts`, `setHalfPxJoints(on)` makes `cp()` round joints to 0.5 on the 1× grid at density 2,
so the 2× drawers (which place by `v * 2`) can move a limb by one 2× pixel. Frame size, anchor
and points stay the 1× geometry (`tests/engine/hires.test.ts` checks the fixture with the flag on
and off). Try it with `npm run sprites -- <prefix> --density 2 --half-px` and
`npm run anim-bench -- --half-px`. The user decides whether it goes on.

### 2x backgrounds and terrain (mission ams)

Parallax layers and terrain can have 2× art too; the rules of the table above apply (same
design, crisp, palette only, light top-left, outlines 2 px at 2×). Only a section view of
density 2 (ams) draws it, and only on a backbuffer of res ≥ 2 (at res 1 the 1× art is the exact
image); layers and materials without 2× art stay 1× next to it.

| Part | How |
|---|---|
| Background layer | `defineHiBgGenerator(id, gen2x)` (or `defineBgGenerator(id, gen, { hi: gen2x })`, `art-registry.ts`). `gen2x(w, h, params, seed)` gets the SAME logical arguments as the 1× generator and returns exactly (2·w) × (2·h): same shapes at the same logical places (use the same hashes and loops, in logical px, and draw each shape on the 2× grid), seamless at 2·w. Offsets, factors, drift and tiling stay logical. A wrong size or a throw falls back to the 1× layer (`hiSceneryErrors()` lists `bg:<id>@2x`). Every ams layer has one: `missions/ams/art-hi-bg.ts` (`ams-skyline`), `backgrounds-hi.ts` (`ams-canal-houses`, `ams-elms`, `ams-plein`) and `art-hi-sky.ts` (the shared `sky-gradient` and `clouds`; only density-2 views draw them, so other missions keep their 1× skies). Far rows keep the 1× haze remap; trees use staggered 3 × 3 leaf clumps; reflections keep the 1× wobble in whole logical px (finer steps shear them). |
| Terrain material | `defineHiTerrainMaterial(kind, id, paint)` (`terrain-art.ts`; kind `ground`, `edge`, `platform` or `solid`). `paint(p, sx, sy)` gets the same `Px` as the 1× material and the sub-pixel (sx, sy) ∈ {0, 1}² of the logical pixel; hi-res coordinates are `2·p.x + sx` and `2·p.up + sy` (or `2·p.y + sy`). The painter classifies every pixel as at 1× (cells, bands, cliff shading, the INK underside), so geometry and collision cannot change; only the material's colours get finer. Materials without 2× art are enlarged 2 × 2. The hangers under a platform band get 2× colours with `defineHiTerrainHang(platform, (x, k, seed, sx, sy) => Color)`, painted only where the 1× `hang` paints (else enlarged 2 × 2). Example: `missions/ams/art-hi-terrain.ts` (every ams material: ground `klinker`, edges `bikepath` and `kerb`, platforms `wood` and `whitewood` with the `whitewood` cross-beam hangers, solid `brick`). |
| Files | New generators go in new files (`missions/ams/art-hi-*.ts`) imported from the ams module. |
| Cost | A 2× layer is 4× the pixels of its layer (ams-skyline 768 × 216: 2.5 MB, about 1.4 ms in node; the ams layers of one section together about 13 MB; the near `ams-canal-houses` row is the slowest at about 7–11 ms warm, up to about 17 ms on a cold first call). A 2× chunk of 256 × 256 logical px is 512 × 512 (1 MB, cropped to its opaque part, about 6 ms, at most 14 ms in node); section a keeps about 19 MB of 2× chunks next to 7 MB of 1× chunks. Keep each 2× layer or chunk well under 16 ms: the browser builds them as art jobs within the 8 ms per frame 2× budget (docs/ARCHITECTURE.md §3), drawing the 1× art until they are ready. |

Check it: `npm run shot -- --mission ams --section a --god --bot --ticks 120 --res 5` (2×) and
the same with `--art 1` (1×). `tests/art/ams-bg-hi.test.ts` checks every ams layer (2× version present, size, footprint, palette,
determinism, seam, 2× detail). `tests/art/scenery-hi.test.ts` checks size, footprint, palette and
the 1× geometry of the 2× terrain, lists the 2× layers, and keeps the 1× scenery of every mission
byte-identical (fixtures/scenery-1x.json).

### UHD art (2× and 4×, mission ams flow)

The UHD wave replaces the ams 2× art with NEW art at arcade-level fidelity, drawn natively at
2× (1080p / 1440p) and 4× (4K, backbuffer k = 8) by ONE density-generic drawer per id. It is
never the 1× or old 2× art scaled (no MMPX / xBR / nearest look). The 1× art keeps `PAL` and stays
byte-identical; the old 2× drawers are retired group by group. Fidelity of the arcade era, never
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
| Materials | `c.material({ ramp, spec?, shine?, rim?, amb?, gain?, wrap?, bounce?, lo?, hi?, dither?, flat? })` → id. Diffuse light uses ramp indices `lo`..`hi` (default 1..n−2: index 0 is kept for separations, crevices and outline C, the top tone for speculars and rims). `dither` = ordered dither at band borders (backgrounds only); `flat` = no light, the tone alone picks the band (glass, water, lamps, fire). |
| Primitives | `ellipsoid(cx, cy, rx, ry, o)`, `capsule(x0, y0, x1, y1, r0, r1, o)` (tapered: limbs, necks, barrels), `stroke(points, r0, r1, o)`, `box(x, y, w, h, { r, bevel, n })`, `cylinder(x, y, w, h, { axis, cap })`, `poly(points, { n })`, `plane(x, y, w, h, { mask, normal, height })`, `heightField(x, y, w, h, hf)` (the portrait-kit painter generalised: faces, rocks, cushions; normals by central differences one art px apart). Options `o`: `{ mat, part?, z?, tone?, tex?, round? }` — parts with one `part` id form one surface (no line where they meet); `z` is the base depth (larger = nearer). |
| Paint and compose | `shade(x, y, w, h, fn, part?)` (folds, stains, painted shadows), `paint(x, y, w, h, fn)` / `dot(x, y, c)` (fixed colours: pupils, catchlights, signs; unlit, kept by the clean-up), `image(buf, x, y, { z })` (a finished buffer of the same density, e.g. a head or a gun, joins the silhouette), `erase(…)`. |
| Light | `light.ts`: `KEY` (upper left, in front), `BOUNCE` (lower right), `diffuse(…)` with a contrast curve (a plane facing the viewer is a mid tone; only planes facing the light reach the top bands), `specular` (Blinn-Phong). |
| Render | `render({ outline: 'A' | 'B' | 'C' | 'none', ao = 0.35, clean = true, sep = true, sepZ = 0.5, sepW = 1, shadow = 0, shadowMax = 3 })`: ambient occlusion where a part meets a nearer one, cast shadows from the key light (`shadow` > 0: a part dz logical px in front throws a shadow about dz px down-right; façades, sills, an arm on the torso), quantise (hard bands; dither only for `dither` materials), cluster clean-up (an art px with no same-tone 4-neighbour in its part takes the common neighbour tone; speculars and fixed px are kept), interior separations (1 art px in the deepest tone of the part BEHIND), outline. |
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

**Outline variants** (CHOICE PENDING — the lead decides at the style gate and writes it into the
plan's "Style decisions"): **A** ink, 1 logical px (d art px; the weight of the 1× art, as the
old 2× art), **B** ink, ½ logical px (1 art px at 2×, 2 at 4×), **C** selective, ½ logical px:
the deepest tone of the material on the lit side (up / left), ink only on the shadow side
(right / bottom). Interior separations are the same in all three.

**Rig contracts** (working prototypes; the rig group replaces their bodies, the signatures,
sizes and points stay):

| Contract | Rule |
|---|---|
| `renderHeadHd(s: HeadStyle, expr: Expression, d: 2 | 4, opts?: { glint?: boolean }): PixelBuffer` (`hd/head.ts`) | Exactly HEAD_W·d × HEAD_H·d, the logical layout of `renderHead` (facing right; NECK and HEAD_CENTER at d times them); no outline (the rig outlines the figure); `glint: false` for tilted heads. |
| `gunArtHd(kind, d)`, `heldArtHd('grenade' | 'snack' | 'gift', d)`, `knifeArtHd(d)`, `propArtHd(kind, d)` (`hd/gear.ts`) | Exactly d × the 1× size of `gunArt(kind).buf` / `grenadeArt()` / `snackArt()` / `giftArt()` / `knifeArt()` / `propArt(kind).buf`; the logical points (grip, grip2, muzzle, tip) are the 1× ones; no outline. `propArtHd` is a stand-in (re-lit from the 1× silhouette) until the GEAR builder draws each prop. |

**Style spike**: `npm run uhd-spike -- [--out tmp/uhd-style] [--palette] [--only hero|swan|street|gear]`
renders a hero (recruit colours: idle, run, shoot), the Swan's head and neck, a 128 × 96 street
crop and the gear / head contracts at 2× and 4×, each next to today's 2× art, in outline variants
A / B / C, plus the PAL_HD sheet; `tmp/uhd-style/index.md` lists the PNGs and generation times
(node, one thread: a 40 × 42 hero frame about 2–5 ms at 4×, the 128 × 96 street about 50 ms
at 4×). Nothing in it is registered in the game. Tests: `tests/art/palette-hd.test.ts`,
`tests/art/hd-kit.test.ts`.

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
| `src/game/art/terrain-art.ts` | the terrain painter |
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

2× layers (mission ams): `defineHiBgGenerator`, see "2x backgrounds and terrain (mission ams)".

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

Amsterdam materials: ground `klinker`, edges `bikepath` and `kerb`, platform `whitewood`. 2×
materials (mission ams): `defineHiTerrainMaterial`, see "2x backgrounds and terrain (mission ams)".

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
11. 2× art (mission ams only): same frames, sizes, anchors and points as the 1× strip, buffer
    twice the size, crisp, palette only, light top-left (section 1, "2x art (mission ams)");
    check with `npm run sprites -- <prefix> --density 2 --marks`.

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
  damage marks. The recruit uses the 2× head rig (`renderHeadHi`).
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
  preload and come last in the 2× preload; first use makes them.
- `npm run anim-bench` (baseline `tmp/anim-baseline.json`, budget `tmp/anim-budget.md`) and
  `npm run geometry-fixture -- <ids>` (verifiers only, for strips changed on purpose).
