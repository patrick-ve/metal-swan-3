# Mission `ams2` — level 1 again, in the hero method (spec, 2026-11-06)

The user approved a new look for the scenery on the private page "Hero Method Backdrops"
(https://claude.ai/artifact/CrNhFq478BumgmGbkKgmpi) and asked: build the Amsterdam level 1 in this style as a
second level to test, and do not delete the first level.

Originality: `docs/ORIGINALITY.md` applies in full. Never name a reference game in code, ids, comments or docs.

## 0. Decisions

| # | Decision | By |
|---|---|---|
| 1 | New mission id **`ams2`**. Mission `ams` keeps working **exactly** as it does: same art, same floor, same sims | user |
| 2 | Same level: the same sections (`a`, `b`, `c`, `c1`, `c2`, `d`), route choice, terrain, scripts, waves, enemies, boss, hitboxes, timers. Only what the player sees as scenery changes | user |
| 3 | The look is the page's **POSTCARD CLEAN in the hero method**, §1. Reference frames: `tmp/ams2-lead/ref/{a,b,c,d}-u{1,2,4}.png`; hero sheet: `tmp/ams2-lead/ref/heroes8x.png` | user |
| 4 | Finer environment pixel with **art tiers**: 1× is the approved base, 2× and 4× come from the base by the method of §1.3. `artDensity: 4` | user |
| 5 | **No WebGL floor, no mesh, no `SectionDef.floor`.** The floor is painted, cut in three bands (speeds about 0.88 / 1 / 1.16), with seams on kerbs or lane edges | user |
| 6 | **Scenery motion** stays subtle: drifting clouds, water, crowns, tulips, flags, boats, smoke, small far figures, birds | user |
| 7 | **Amsterdammertjes stand on kerbstones, never on the bike lane or the road.** Enforced by a check in code and a test | user |
| 8 | Figures stay as they are: the 40 px sprites, unchanged. No character work in this wave | lead |
| 9 | Test access: `?mission=ams2` (and `&section=b`, `&boss=1`), like `?mission=oat`. Lazy chunk, like oat. Stand-alone: not on `FPS_ROUTE`, and `ams.next` does not change. After its tally it returns to the title | lead |
| 10 | Name `THE FRYING DUTCHMAN`, subtitle `MISSION 1 - NEW ART`, the same music, ambience, audio | lead |
| 11 | No commit, no push, no deploy. Stay on `main` in the working tree. The tree holds much uncommitted work of other waves (oat, ams40): never revert or reformat it | standing |
| 12 | Every agent: Opus 5.5, effort high | user |

## 1. The style contract

The full study is on the page. Reference code: `docs/design/ams2/spike/approved-1x/` (the approved 1× scenes) and
`docs/design/ams2/spike/hires/` (`hi.py`: 2× and 4×). The hero rig: `docs/design/squad40/rig.py`. Metrics:
`docs/design/ams2/spike/study/metrics.py`. **These Python files are the visual reference: port their results to
TypeScript, keep the look. The game has no Python at run time.**

### 1.1 What makes the heroes look like heroes

1. One near-black outline `#140c0e`, one hero pixel thick, closes every object. The middle plane uses `#2c1a26`.
2. Where two parts overlap, the far part's edge takes its dark tone (selout: part id + z, as in `rig.py` `finish`).
3. Ramps of about 4 tones, about 0.2 apart in lightness, hue-shifted. The ramps are in `spike/hires/kit.py`.
4. Hard clusters only. **No gradient, no dither, no grain, no alpha, no soft shadow, no glow.**
5. **Light from the upper right.** Lit edges on the top and the right, shade on the left and the foot.
6. Chunky forms at the heroes' scale: a post 7 × 26, a lamp 15 wide, a bike 40 long, a door 11 × 20.
7. Few colours per object (a hero uses about 26), but many small readable clusters.

### 1.2 Depth

- Far layers (sky, clouds, skyline): flat tones, no outline.
- Middle plane (houses across the water, museum, Stopera): full method with the softer outline.
- Near plane (props, floor, anything at the walk plane): full method with the hero's outline.
- Figures must stay easy to read: keep the walk band calmer than the figures (the setts' tones in `kit.py` were
  lowered for this reason).

### 1.3 The finer pixel (`spike/hires/hi.py`)

Draw at 1×, in palette ids, then per object:

1. EPX (twice for 4×). No new colours, rounded diagonals, crisp outlines. Outlines stay one hero pixel thick.
2. Longer ramps: 1 new tone between two tones at 2×, 2 new tones at 4×. A hard band of the new tone on the shaded
   side of a tone step inside one ramp. Linework stays as it is.
3. Detail by material, in whole tones: bricks and mortar in patches, slates, wood grain, bark, stone flecks, single
   leaf stamps, glazing bars in windows (a window mark per window), water strokes, grass blades.
4. Colour variants per house (`VARIANTS` in `kit.py`). Extra small things at 2× and up only: shutters, wall anchors,
   door lamp, number tile, hanging sign, street plate, pots, manhole covers, drains in the gutter, fallen leaves,
   city bins, bike racks.
5. Real game sprites never pass through this: they scale by a whole number.

### 1.4 Gates (the same metrics script, the hero scaled to the same pixel)

For a frame without figures at each tier: mean tone step at an edge at least 0.17 (hero 0.25); soft edges (tone step
under 0.04) at most 5 % (hero 0.3 %, last failed try 44 %); no pixel outside the section's palette; colours in a
1× frame at most about 200, more at higher tiers (the page shows 210–416 per part). Look at the frames next to
`tmp/ams2-lead/ref/`: **the frames are the real gate**.

## 2. How it fits in the engine (read the code first; these are start points)

- `SectionDef.background.layers` (`factorX`, `driftX`, `width`) with `defineBgGenerator(id, gen, { hi, hi4 })`: sky,
  clouds, skyline, far banks, floor bands. A generator returns a tileable `PixelBuffer`.
- `DecorDef` has `parallax`, `animate`, `front`: back props on the far band and front posts on the near band can use a
  parallax that matches their band. Use the line-scroll rule so that things line up at screen centre:
  screen x = 192 + (world x − camX − 192) × speed (see `strips/space.ts`, `floor/scale.ts`). If `parallax` means
  something else in `view.ts`, add a small opt-in; never change what existing missions draw.
- Anything a hitbox touches stays at speed 1: platforms, ledges, awnings, boats, bridges, doors, the lamps a gull sleeps
  on, breakables.
- `view.ts`: with `floor` the ground cells are `groundless`. `ams2` needs the same without a floor: an additive opt-in on
  `SectionDef` (for example `paintedFloor: true`) so that the terrain painter draws no ground cells while platforms and
  solids still draw. Every existing mission must draw byte-identical frames.
- Sections: build them from the `ams` section defs, `{ ...sectionA, background, decor, terrainStyle, floor: undefined,
  art, paintedFloor: true }`. Keep `script`, `terrain`, `exits`, `playerStart`, `checkpoints`, `respawn`. Read each `ams`
  section file: its decor list tells what stands where, and `terrain.ts` holds the numbers.
- Water, bridges, ramps, the passage and the jetty are world features: paint them from the same `terrain.ts` numbers, so
  art and collision line up. Pits and water hazards must read clearly.
- Entities that draw scenery with `decor/ams/...` or other shared sprite ids (breakables, boat platforms, the drawbridge,
  the cruise boat, low bridges, doors): they must not change in `ams`. Prefer a small mission-scoped sprite override (an id
  maps to its `ams2` twin while `ams2` runs) over copying entity code. Scripts that spawn them stay shared.
- Lazy chunk as for oat: `content/index.ts` (`isOatContent`), `scenes/oat-route.ts`, `scenes/boot.ts`, `scenes/flow.ts`, the
  art workers, `src/sim/headless.ts`. Read how `?mission=oat` boots and copy the pattern. Check the "m5 trap" in
  `flow.ts`: `listMissions` sorts ids, so `ams2` must never become someone's implicit next mission.
- Generation runs in the art workers and caches as other art does. Keep the 4× working set within the budgets the other
  missions meet. Tile layers instead of baking whole sections. Prefer sprites per object.

File layout: `src/game/art/herokit/` (the TS port: canvas, ramps, selout + outline, EPX, long ramps, detail, floors, sky,
water, foliage, shared props) and `src/game/content/missions/ams2/` (`index.ts`, `section-*.ts`, `art-*.ts`). New files only,
apart from the small additive hooks named above.

## 3. The sections

| Section | Light | Must show (from the `ams` section file and terrain) |
|---|---|---|
| `a` GRACHTENGORDEL | morning | quay street, canal behind, hump bridges, the raised drawbridge and side canal with two houseboats, PLEINTJE, the shopping street with awnings and gable ledges (golden record), FABEL FRIET with counter, sign and baker, the briefing |
| `b` MUSEUMPLEIN | noon | street to the museum, the Rijksmuseum passage with its ceiling, lawn, long pool, the hot-dog stand and vendor, the canal-side road |
| `c` AMSTEL | golden | quay street, the long stretch with six houseboats (decks y 164, roofs y 146), shop quay, scan car arena, the fork: bridge ramp and jetty steps with signs |
| `c1` BRUG | golden | the white bridge deck and ramp, Blauwbrug |
| `c2` RONDVAART | golden | the river cruise, tour boat, low brick bridges, party boat, Magere Brug, Carre, Waterlooplein jetty |
| `d` STOPERA | sunset | flea market, the curved theatre, city hall with the big glass doors the boss comes out of, sunset sky |

Far bank, sky and props follow the reference frames. Secrets stay findable: anything `secrets.ts` hides or reveals still reads.

## 4. Gates for the whole wave

1. `npm run typecheck` is clean. The test suite has no new failures against `tmp/ams2-lead/baseline.txt`.
2. Mission `ams` and every other mission: sims and frames unchanged (`tests/` sim baselines; compare `npm run shot` frames of
   `ams` before and after, byte for byte).
3. `?mission=ams2` boots in a browser at art 1, 2 and 4, with `&section=` for every section and `&boss=1`. The bot finishes
   each section in `npm run sim` with the same result as `ams` at the same seed.
4. Post rule: a check in code plus a test. A post on anything but a kerbstone fails.
5. No frame drops worth noting at 4× in a browser run (`npm run perf` or a Playwright run), first-load time reported.
6. Frames of every section at 2× and 4× with figures: `tmp/ams2-lead/frames/`, all looked at.

## 5. Status (2026-11-06)

Built and integrated: all sections, `?mission=ams2`. Not committed. API and hooks: `docs/api/ams2.md`. Numbers at seed 7 (god), frames in
`tmp/ams2-lead/frames/final/`.

| Gate | Result |
|---|---|
| Types and tests | Typecheck clean. 6977 tests: 6965 pass, 6 skipped, 6 fail, all 6 also in the baseline |
| `ams` and `oat` unchanged | 13 of 13 frames byte-identical (`ams` at res 1 and 2, `oat-a` at res 1). No baseline frames exist at art 4 |
| Sim, `ams2` against `ams` | The same except timing. a 20828 ticks / 165 kills, b 24337 / 123, c 19353 / 83, c1 8631 / 38, c2 17136 / 59, d 11520 / 29, lower route 21323 / 165, upper route 18782 / 153. All complete, boss down, 0 errors |
| Browser | Every section and `&boss=1` at art 1, 2, 4: 0 console errors. The bot goes both routes to `d`, then the tally, then the title |
| 4K, art 4, real speed | Play, 1 and 2 players: frame interval p99 and max 16.8 ms in every section, 0 frames over 25 ms. Render and present p99 1.1 to 4.8 ms, max 8.4 ms (`ams` p99 2 to 10.9 ms, max 27.3 ms). One entry frame per section from `b` on, 50 to 83 ms (`ams` 67 to 83 ms) |
| First load at 4K | Navigation to play: `ams2` 4.6 to 4.8 s cold, 3.8 s warm; `ams` 3.9 s cold, 3.5 s warm. 4x set of section `a` ready 5.6 to 6.3 s after that (`ams` 3.6 s); the art shows at a lower tier until then |

Known point: the look gate of §1.4 reads edge 0.169 and 0.170 (just under 0.17) in section `b` at art 4, cameras 0 and 240. The approved
reference `ref/b-u4.png` reads 0.160 by the same formula, and all other cameras pass.
