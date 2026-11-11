# Atmospheric perspective for Amsterdam — port plan (2026-11-09)

Hand-over plan for one agent (Opus 5.5, effort high). It ports an approved look from a Python spike into the game.
Part A covers the whole of mission `ams2` (the level with the painted floor). Part B covers mission `ams` (level 1,
the WebGL floor). The parts are independent: Part A must be finished and reported before Part B starts, and the
user may hand over Part A alone.

**Prompt to hand over:** "Read `docs/design/atmosphere.md` and carry out Part A (then Part B). Follow its gates. Do
not commit, push or deploy."

## 0. What the user approved

Two private pages show the look. The user said "I like this a lot" (ams2) and "I like the changes" (level 1).

| Page | Shows | Source of truth in the repo |
|---|---|---|
| Amsterdam in Depth, https://claude.ai/artifact/NQ4eSnTmBH31mmdzcvLrnM | `ams2` stages a, b, c, d, now against proposed, with motion | `docs/design/ams2/spike/atmo/` (`atmo.py`, `scenes.py`, `export2.py`), frames in `ref/{a,b,c,d}-{now,new}-u4.png` |
| Level 1 in Depth, https://claude.ai/artifact/2xueGNg3ipfNLMWFEeybrQ | seven real `ams` frames, now against proposed, stills | `tmp/ams-atmo/` (`capture.ts`, `compose_ams.py`; git-ignored) |

The agent cannot open the pages. **The Python files and the `ref/` frames are the reference.** `atmo.py` runs on
top of the approved ams2 spike: to run it, copy `docs/design/ams2/spike/{hires,study}` and `tmp/ams2-lead/sprites`
side by side into a scratch folder, copy the three `atmo/` Python files into `hires/` (its `scenes.py` replaces the
spike's: it only adds the `NEW` flag), then `BG_U=4 python3 atmo.py a,b,c,d 60` writes `out/<p>-new-u4.png`.

The principle: the farther a plane is, the more it fades into the air of its hour. Darks lift toward a cool haze
tone, lights lean toward a warm haze tone, colour strength drops, detail drops, and the nearest strip gets deeper
darks. Everything stays hard pixel clusters: the haze is a colour table, never alpha, never a shader blend over art.

## 1. Decisions

| # | Decision | By |
|---|---|---|
| 1 | The look of the two pages is approved as shown, with the haze numbers of §2 as the start setting | user |
| 2 | The sky, the mist bands and the ground fade use an ordered dither and a long ramp. This overrides rule 4 of `docs/design/ams2.md` §1.1 ("no gradient, no dither") **for these parts only**. Houses, props and floors keep the hero method | user (approved on the page) |
| 3 | The far bank is 15 % lower in ams2 `a` and 20 % smaller in ams2 `c` (art only; collision and scripts do not change) | user (approved on the page) |
| 4 | Scenery only. No figure, enemy, pickup, fx, hitbox, terrain, script, timer or sound changes | user |
| 5 | Play stays the same: every sim result of `ams` and `ams2` is unchanged at the same seed | lead |
| 6 | Part A changes nothing that `ams` or any other mission draws (byte-identical frames). Part B changes `ams` frames on purpose and no other mission | lead |
| 7 | Amsterdammertjes stand on kerbstones only; the existing check and test stay green | user (standing rule) |
| 8 | No commit, no push, no deploy. Work on `main` in the working tree. The tree holds much uncommitted work of other waves: never revert or reformat it | standing |
| 9 | Any helper agent: model opus, effort high, nothing else | user (standing rule) |
| 10 | Never name a reference game in code, ids, comments or docs (`docs/ORIGINALITY.md`) | standing |

## 2. The look contract (exact numbers; `atmo.py` is the code)

### 2.1 The haze grade (`atmo.py` `grade`)

Input: a colour after the section's light grade (`gradeColour`), channels 0..1. `m` is the depth amount 0..1.

```
lum  = .30 r + .59 g + .11 b
tgt  = dark + (light − dark) · lum^0.8          // per channel
out  = c + (tgt − c) · m
l2   = lum(out)
out  = l2 + (out − l2) · (1 − sat · m)          // sat = 0.4 (0.5 on the farthest skyline, 0.2 on the horizon clouds)
byte = floor(out · 255 + 0.5), clamped
```

The outline colours (`K`, `KM`) are graded like every other colour: far outlines become a coloured line.

| Light | `dark` (cool air) | `light` (warm air) |
|---|---|---|
| morning | `#9cbcda` | `#fbf2dc` |
| noon | `#a2c6ea` | `#f7f8ee` |
| golden | `#b79a94` | `#ffe4a8` |
| sunset | `#6c3c80` | `#ffb070` |

**Ground planes** (water, lawn) fade by row: `m(y) = near + (far − near) · clamp((y1 − y)/(y1 − y0))`, plus the
plane's base amount. `m` is then quantised to steps of 1/16 with a 4×4 Bayer matrix
(`[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]/16 + 1/32`), cell size `max(1, tier/2)` fine pixels. So a ground
plane uses at most 17 colour tables.

**The nearest strip** (`punch`): `c^1.14` per channel, then saturation × 1.08. Applies to the near floor band, the
front posts and the near water.

**The sunset key** (`dusk`, section `d` only, on every plane from speed 0.88 up):
`tint = (.50,.30,.56) + ((1.06,.90,.74) − (.50,.30,.56)) · lum`, `out = c · 0.66 + c · tint · 0.425`.

### 2.2 Depth by plane

Default rule by plane speed, with the overrides the spike uses (`PLAN` in `atmo.py`):

| Plane | Speed | morning (a) | noon (b) | golden (c, c1, c2) | sunset (d) |
|---|---|---|---|---|---|
| Farthest skyline (new, §2.5) | 0.09 | 0.80 | 0.80 | 0.80 | 0.80 |
| Far skyline (today's far band) | 0.18 | 0.60 | 0.62 | 0.66 | 0.52 |
| Middle plane: far bank, bridge, boats, far cyclists, tour boat, museum, hedges | 0.42 | 0.30 | 0.34 | 0.44 | 0.30 |
| Water under the far bank (top row → bottom row) | 0.42 | 0.43 → 0.03 | — | 0.60 → 0.14 | — |
| Buildings at 0.62, lawn trees at 0.66 | 0.62–0.66 | 0.17 | 0.16 | 0.17 | 0.17 |
| Lawn and pools (top → bottom) | 0.66 | — | 0.33 → 0.03 | — | — |
| River between bank and jetty (top → bottom) | 0.88 | — | — | 0.16 → 0.02 | — |
| Houseboats, their smoke | 0.88 | — | — | 0.05 | — |
| Everything else at 0.88, and the walk plane | 0.88, 1 | 0 | 0 | 0 | 0 (+ sunset key) |
| Near band, front posts, near water | 1.16 | punch | punch | punch | punch (+ sunset key) |

A plane that the spike does not have (sections `c1`, `c2`, and the parts of `a`–`d` beyond the spike's stretch)
takes the default of its speed and light. Anything a hitbox touches is at speed 1 and never fades.

### 2.3 The sky (`atmo.py` `sky`)

One ramp from the zenith (y 0) to the horizon (y 132), cut in 23 tones (`N = 22` bands + 1). Band position
`t = y/132 · 22 + 0.5 · (noise − 0.5) + glow`. Between two tones, the middle 60 % of a band is solid and the
borders dither with the Bayer matrix: `tone = floor(t) + (clamp((frac(t) − .2)/.6) > bayer)`.

| Light | Stops (y, colour) | Glow (x, y, rx, ry, amount) | Sun |
|---|---|---|---|
| morning | 0 `#2b63b8`, 34 `#3f80cc`, 66 `#6ea8de`, 92 `#a9cfe8`, 112 `#dde9e2`, 128 `#f6ecd2` | none | none |
| noon | 0 `#1f58b6`, 36 `#3078cc`, 68 `#5ea2e0`, 94 `#9ccaec`, 112 `#cfe6f2`, 128 `#eaf2ea` | none | none |
| golden | 0 `#3f6aa6`, 26 `#6486ae`, 50 `#94a2ae`, 72 `#c8b89c`, 92 `#eccd8e`, 110 `#fbe0a0`, 128 `#fff0c0` | −40, 104, 300, 70, 2.6 | none (below the left edge) |
| sunset | 0 `#1a1448`, 24 `#34195e`, 46 `#5c2472`, 66 `#92307a`, 84 `#cc5070`, 100 `#ee7c5c`, 116 `#fbb060`, 130 `#ffd27c` | 278, 92, 150, 70, 3.2 | centre 278, 44; discs r 15 `#fff0b0`, r 11 `#fffbe6`, ring r 18 `#ffd884`, a 50 % dither halo r 22 `#ffc874` |

`glow = amount · exp(−(((x − gx)/rx)² + ((y − gy)/ry)²))`: it bends the bands around the sun. The sky layer must
not wrap in view (a glow or a sun that repeats is a bug): the layer width must be at least `384 + 0.03 · section width`.

### 2.4 The clouds (`atmo.py` `cumulus`, `cloud_layers`)

Five tones per light, lit from the upper right, a lit rim, a flat base that dissolves in a dither.

| Light | Tones, light to deep |
|---|---|
| morning | `#ffffff` `#f1f5f6` `#d3e0ec` `#aec6e0` `#8eaed6` |
| noon | `#ffffff` `#f0f6fa` `#d0e0f0` `#a8c4e6` `#84a8da` |
| golden | `#fff8dc` `#fde2a6` `#ecb884` `#c08e80` `#94788c` |
| sunset | `#ffe6a6` `#fbaa68` `#de626c` `#983a78` `#58286a` |

Two sheets drift over the sky: big masses high (width 86–168, height 34–46 % of the width, top at y 2–26, drift
0.03 px per tick) and flat streaks at the horizon (width 44–100, height 9–15, base at y 80–97, drift 0.012, hazed
0.48 with `sat` 0.2). `cumulus` builds a height field from soft blobs plus two noise octaves, shades it by its
gradient against the light `(.52, −.72, .46)`, and cuts five tones at `.74 / .60 / .46 / .33`.

### 2.5 The farthest skyline and the mist (`roofline`, `tower_crown`, `church`, `dome`, `mill`, `mist`)

- A new plane at speed 0.09, behind today's far band: a low roof line (houses 9–18 wide, 8–20 high, gable 6, no
  windows) in the flat `far` / `farr` tones, plus landmarks per section (a tower with stacked lanterns and a crown,
  a church with a spire, a domed church, a windmill; positions in `PLAN[..]['far1']`). Graded 0.80, `sat` 0.5.
- Mist: a band of one colour (`0.45 · dark + 0.55 · light`), dense at its foot row and thinning upward, as a
  Bayer dither (`density = clamp(1 − (y0 − y + wobble)/height)^1.3 · peak`). One band at the foot of each of the two
  skylines (peak 0.7–0.85, height 20–30). One thin band at the foot of the far bank in `c` (peak 0.42, height 9)
  and of the museum in `b` (peak 0.3, height 5). None on the bank of `a`: it looked noisy on the bridge.

### 2.6 What is exact and what is judged by eye

- **Exact (a test holds it):** the haze grade, the punch, the sunset key, the Bayer quantisation, the sky's tone
  table. Make a fixture from the Python functions (`tests/fixtures/atmo.json`: every kit palette colour × the four
  lights × depths 0, 1/16 … 1) and compare in a test.
- **By eye against `ref/`:** the sky's noise wobble, the clouds, the mist wobble, the roof line. The Python uses a
  bicubic value noise from PIL; use the kit's `noise()` (`herokit/hi.ts`) and seeded `rngf`. The shapes will differ;
  the character must not: big soft masses, five clear tones, a dissolving base.

## 3. Part A — mission `ams2`

Read first: `docs/design/ams2.md` (the style contract), `docs/design/ams2-contract.md` (how a section is built,
who owns what, how to run frames), `docs/api/ams2.md`. The contract's "do not touch" list was for parallel section
builders; this plan lifts it for the files named below and nothing else.

### 3.1 How the code is built today (the seams)

- A sprite is a canvas of palette ids (`S`). `renderBuffer(o, light, u, seed)` in `src/game/art/herokit/hi.ts`
  makes the tier's pixels and maps ids to colours with **`lightTable(light, u)`**. This table is the seam for the haze.
- `defineArt` and `defineBand` in `src/game/content/missions/ams2/stage.ts` call `renderBuffer` / `renderFrames`.
  A plane is the item's `parallax` (its speed). Sprites are at most 256 px wide (`TILE_W`).
- The sky is the background generator `ams2-sky` (`stage.ts` `skyLayer`, `skyBackground`), 512 × 132.
- Clouds: `cloudsDecor` in `ams2/scene.ts` (seven sprites that move with `moveX`). Far band: `defineFarBand`.
  Bank and its water: `defineBank` (the water reads the bank's 1× image for its reflection).
- `tests/fixtures/herokit.json` locks the existing kit functions to the old Python reference. **Do not change what
  an existing kit function returns. Add new functions and optional arguments with the old behaviour as default.**

### 3.2 Steps

**A1. The kit (`src/game/art/herokit/`, new file `atmo.ts`, small additive edits in `hi.ts`).**
- `ATMO: Record<LightName, { dark, light, sky stops, cloud tones, glow }>` from §2.
- `hazeColour(c, light, m, sat = 0.4)`, `punchColour`, `duskColour`: pure functions on RGB.
- `hazeTable(light, u, m, opts?)`: `lightTable` passed through `hazeColour` (and optionally punch / dusk), cached
  by key. Depth 0 with no option returns `lightTable` itself.
- `renderBuffer` / `renderFrames` take an optional `tone` argument: `{ depth?, fade?: { y0, y1, far, near }, sat?,
  punch?, dusk? }`. With `fade`, pick the table per pixel from the quantised, dithered `m(y)` (y in logical rows of
  the canvas, the Bayer cell `max(1, u/2)` fine pixels, the pattern anchored at the tile's origin so tiles join).
- `skyRamp(w, h, light, seed, u, sun?)` → `PixelBuffer` (§2.3). `cumulus(w, h, seed, light, u, flat?)` →
  `PixelBuffer` (§2.4). `mistBand(w, light, u, y0, height, peak, seed)` → `PixelBuffer` that tiles in x.
  `roofline`, `towerCrown`, `church`, `dome`, `mill` draw on an `S` with the `far` / `farr` ramps.
- Tests in `tests/art/atmo.test.ts`: the fixture of §2.6; `hazeTable(…, 0)` equals `lightTable`; the fade pattern
  tiles; determinism (same seed, same bytes).

**A2. The stage API (`ams2/stage.ts`, `ams2/scene.ts`), additive.**
- `ArtOpts.tone` and `BandOpts.tone` (the same object as above), passed to the renderer. A toned sprite needs its
  own id: put the tone in the name (for example `tour-boat@30`), because `defineArt` returns an existing id when the
  name is taken. Shared props that stand on a hazed plane (far cyclists, tour boat, the lamps on the far bridge,
  far crowns, boats) need a toned variant per light; the near ones stay as they are.
- A helper `depthOf(light, speed)` with the table of §2.2, so sections do not repeat numbers.
- `skyBackground` uses a new generator `ams2-sky2` (`skyRamp`); keep `ams2-sky` registered. Give the layer the
  width that §2.3 asks for.
- `cloudsDecor2(light, seed)`: the two sheets as single cloud sprites (each ≤ 256 wide) with `moveX`, the horizon
  streaks first. `defineFar1Band(light, name, seed, base, landmarks)` at speed 0.09 and `defineMistBand(...)`.
- `defineBank`: tone the bank band; the water still takes its reflection from the **untoned** 1× bank image, then
  gets the row fade of §2.2.
- `defineFloor`: the near band and the near posts take `punch`. Check that the kerbstone ids the post rule reads
  are palette ids, so the rule and its test do not change.

**A3. The sections.** For each of `a`, `b`, `c`, `c1`, `c2`, `d` (`section-<k>.ts`, `art-<k>*.ts`):
1. List every decor item and band with its speed (one table per section in the report).
2. Swap the sky, the clouds; add the farthest skyline and its mist behind the far band; tone the far band; add
   its mist.
3. Tone every plane below speed 0.88 by §2.2. Ground planes get the row fade. `d`: the sunset key on the planes
   from 0.88 up, on the floor and on the scenery twins of `overrides` (never on a figure).
4. Staging (decision 3): in `a` the far row uses storey height 15, window height 10, ground floor 20, gable 19
   (was 18 / 12 / 22 / 22). In `c` it uses storey 13, window 7 × 9, ground floor 16, gable 15, house width 30–46
   (was 16, 8 × 10, 18, 18, 34–50). See `scenes.py` `NEW`. Where `c1` and `c2` show the same bank, keep them
   consistent with `c`.
5. Shoot frames at tiers 2 and 4 at five or more cameras per section and **look at each one** next to
   `ref/<p>-new-u4.png` (camera 60) and next to the frame before. Fix what reads wrong: a near thing that fades, a
   far thing that does not, a seam in the dither between tiles, a sun that repeats.

Do section `a` first, to the end, as the worked example. Then the others.

**A4. The look gate (`tools/herokit/frame.ts --gate`).** The gate's palette is `lightTable`; hazed colours are
outside it and haze lowers the edge step on purpose. Extend the gate: the allowed set is the union of the tables a
section uses plus the sky, cloud and mist colours; measure `edge` and `soft` on the rows from `B0` (146) down, where
nothing fades, and print the far rows' numbers as information. Say in the report what the numbers were before and
after.

### 3.3 Gates for Part A

1. `npm run typecheck` clean. The suite has no new failures against `tmp/ams2-lead/baseline.txt`.
2. `ams` and every other mission: byte-identical frames (`tmp/ams2-lead/shoot-ams.sh <dir>`, compare with
   `tmp/ams2-lead/ams-before/`) and the same sims.
3. `ams2`: `npm run sim -- --mission ams2 --section <k> --seed 7 --god --quiet` gives the same ticks and kills as
   before the change, for every section and both routes. `tests/content/ams2.test.ts` (same play as `ams`, the post
   rule) and `tests/art/herokit.test.ts` pass unchanged.
4. Memory: `tests/content/ams2-dense-budget.test.ts` passes. Report the 4× working set per section before and
   after. Toned variants and the new layers cost memory: reuse one variant per light, use `bob` over frames.
5. A production build, `?mission=ams2` at art 1, 2 and 4, every section and `&boss=1`: 0 console errors. At 4K and
   art 4 no frame over 25 ms in play (the method of `docs/design/ams2.md` §5; use a production build, the dev
   server fails at 4K).
6. Frames of every section at tiers 2 and 4 in `tmp/ams2-lead/atmo-frames/`, all looked at.
7. Update `docs/design/ams2.md` (§1.1 rule 4 exception, §1.2 depth, §5 status), `docs/design/ams2-contract.md`
   (the new calls) and `docs/api/ams2.md`.

Then stop and report (§5) before Part B.

## 4. Part B — mission `ams` (level 1, the WebGL floor)

Level 1 already has a haze: `airOf(light, air)` in `src/game/content/missions/ams/art-hd-bg-kit.ts` moves a colour
toward one haze colour in Oklab and snaps it to the HD palette. Today's amounts: skyline 0.48 (tower 0.2), far row
0.52, **middle row 0.08**, Amstel bank 0.12, plein 0.22 / 0.12 / 0.05, elms 0.03. The middle row at full contrast is
why the level looks flat. The seven reference frames used these amounts **on top of** today's art:

| Section (frame) | Skyline | Far row | Middle row | Trees (elms) | Middle-row water (quay line → 52 rows nearer) | Floor fog (amount, far rows) |
|---|---|---|---|---|---|---|
| a | 0.50 | 0.36 | 0.24 | 0.08 | 0.34 → 0.04 | 0.12, 16 |
| b | 0.52 | 0.38 | 0.30 | 0.10 | 0.40 → 0.04 | 0.16, 22 |
| c | 0.54 | 0.40 | 0.30 | 0.10 | 0.40 → 0.04 | 0.14, 16 |
| c1 | 0.54 | 0.40 | 0.30 | 0.10 | 0.40 → 0.04 | 0.22, 30 |
| c2 | 0.58 | 0.46 | 0.40 | — | 0.50 → 0.04 | 0.34, 46 |
| d | 0.46 | 0.34 | 0.22 | 0.08 | 0.32 → 0.04 | 0.10, 14 |

To see the reference: `npx tsx tmp/ams-atmo/capture.ts --section a --cam 300` writes cumulative passes to
`tmp/ams-atmo/cap/`; `compose_ams.py` (run like `atmo.py`, from the scratch `hires/` folder) writes
`ams-out/<frame>-{now,new}.png`. Frames: a 300, b 1400, c 300, c1 500, c2 700, d 800, d 200. If `tmp/ams-atmo/` is
gone, the table above and §2 are enough.

### 4.1 Steps

**B1. The background planes** (`ams/art-hd-bg-*.ts`, `ams/backgrounds.ts`, `ams/art-hd-sky.ts`).
- Give `airOf` the two-tone target and the saturation drop of §2.1 as a second transform (for example `air2Of`),
  so the old one stays for anything that must not move. Because the first haze stays in the art, the amounts above
  are *added* depth: find the single amount per layer that matches the reference frame by eye, starting from
  `1 − (1 − old) · (1 − added)`.
- The middle row's water (inside `ams-canal-houses`, `ams-amstel`) and the lawn (`ams-plein`) get the row fade.
- Colours here snap to the HD palette (`src/engine/palette-hd.ts`, `tests/art/palette-hd.test.ts`). Check that the
  hazed ramps do not collapse into two tones after the snap. If they do, say so in the report with a frame, and
  propose either new palette entries or an unsnapped path for background layers. Do not grow the palette without
  the user's word.

**B2. Sky, clouds, the farthest skyline, mist.** New `ams`-only generators (`ams-sky2`, `ams-clouds2`, `ams-far1`,
`ams-mist`) with 1×, 2× and 4× versions, and the six `BG_*` records of the section files point at them. **Do not
change `sky-gradient` or `clouds` in `src/game/art/bg.ts`: other missions use them.** Reuse the functions of A1
(move them to a shared place if Part A put them under `herokit/`; do not copy). Level 1 has a sun in `a` (54, 35,
r 8, glow 110 × 70, 1.6), in `c`, `c1`, `c2` (316, 62, r 9, glow 130 × 80, 2.4) and in `d` (307, 100, r 12,
glow 150 × 70, 3.2). Update `tests/art/ams-bg-hd.test.ts` (`AMS_BG`).

**B3. The floor fog** (`src/engine/gl-floor.browser.ts`, the CPU raster in `src/game/mission/floor/`,
`FloorDef` in `floor/types.ts`).
- An opt-in `FloorDef.fog: { amount, depth }`: the floor's far part fades toward the haze of the section's light,
  by the floor's own depth coordinate (not by screen row), full at the back edge and zero at `depth`. The reference
  gives rows; convert with the floor camera of each section.
- The same colour math as §2.1, quantised to 1/16 with the Bayer matrix at one output pixel of the art tier, in the
  fragment shader and in the CPU raster. Both paths must give the same pixels where they do today (find the
  existing GPU against CPU check and extend it).
- A floor without `fog` draws byte-identical: `oat`, `oldenzaal` and the ring must not change.
- Things that stand on the floor's far part (back rows, lifted layers) do not take the fog in this wave.

**B4. The sunset key in `d` (optional, last).** The near art of `d` is lit like day. The reference applied the key
of §2.1 to the floor and the near scenery. In level 1 that touches many sprites. Do it only for the floor (through
the fog's colour table) and for background layers; list what a full version would need and leave the rest.

### 4.2 Gates for Part B

1. `npm run typecheck` clean; no new test failures; `ams-dense-budget` and the `ams` art tests pass (updated where
   the art changed on purpose, never loosened without a reason in the report).
2. Sims of `ams` (every section, both routes) and of `ams2`: the same results as before.
3. Frames of every other mission, and of `ams2` after Part A: byte-identical before and after Part B.
4. `ams` frames change. Shoot before and after at `--res 1`, `2` and `4` for the seven reference cameras and five
   more per section; look at each one. A sub-pixel shift or a seam between a layer's water and the floor's water
   that got worse is a failure.
5. Browser: `?mission=ams` at art 1, 2, 4, with the WebGL floor and with `?floorgl=0`: 0 console errors, the same
   picture on both floor paths, no frame over 25 ms at 4K in play. A context loss still falls back cleanly.
6. Update `docs/api/floor.md` (the fog), `docs/ART_GUIDE.md` where it describes the `ams` background layers.

## 5. The report (after each part)

Write `tmp/atmosphere-report.md`: what changed (files), the plane table per section with the amounts used, the gate
numbers (tests, sims, memory, frame times, the look gate before and after), every place where the result differs from
the reference and why, and open questions. Put frames in `tmp/ams2-lead/atmo-frames/` (Part A) and
`tmp/ams-atmo/frames/` (Part B). State plainly what was not checked.

## 6. Risks

| Risk | What to do |
|---|---|
| The dither shimmers when a plane scrolls at a fractional speed | Anchor the Bayer pattern to the layer's own pixels, never to the screen. Check by a frame pair one camera pixel apart |
| Tile seams in the mist and the ground fade | The pattern and the noise must wrap at the tile width; test it |
| Memory: toned variants double some sprites | One variant per light and plane; drop frames before dropping the look; report the numbers |
| The palette gate or the edge gate fails by design | §3.2 A4; never switch a gate off silently |
| The HD palette snap flattens the haze in level 1 | §4.1 B1: report with a frame, ask before growing the palette |
| The clouds do not match the reference shapes | Shapes may differ (§2.6). The tones, the size range and the dissolving base may not |
| The walk band gets busier than the figures | Nothing at speed 0.88 or more takes dither or haze, except the sunset key |

## 7. Out of scope

Figures and every other sprite a script spawns. New scenery objects beyond §2.5. Other missions. Runtime weather.
A haze that changes over time. The `oat` level. Commit, push, deploy.
