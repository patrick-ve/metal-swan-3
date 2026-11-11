# The canal look — scenery standard for new levels (2026-11-10)

A style contract and a build guide for one agent (Opus 5.5, effort high) who makes the scenery of a new level.
The user approved this look on four scenes and wants new levels in **this exact design and fidelity**.

**Prompt to hand over** (fill the slots; the long form is in §8):
"Read `docs/design/canal-look.md`. Build the scenery of `<place>`, `<hour>`, in the canal look. Follow its steps
and gates. Scenery only. Do not commit, push or deploy."

## 0. What the user approved

One private page, "Four Canal Scenes", https://claude.ai/artifact/D2yiixFNDFL6ovUVAUoQii (version 6). The user:
"I like this a lot! … the best result of texture generation so far. I like the style and art direction."

The agent cannot open the page. **The kit and the `ref/` frames are the reference.**

| What | Where |
|---|---|
| The paint kit (Python 3, numpy, Pillow; the code of every number in this file) | `docs/design/canal-look/kit/` |
| Reference frames, taken from the page, with the hero | `docs/design/canal-look/ref/<scene>-u<tier>.png` |

`ref/<scene>-u2.png` shows three camera positions (0, 288, 576) side by side. `-u4.png` and `-u1.png` show the
camera position where the set piece is in view.

| Scene | Place and hour | Key hue | Set piece | File |
|---|---|---|---|---|
| a | Grachtengordel, clear morning | sky blue | arch bridge, side canal | `scene1.py` |
| b | Museumplein, autumn, overcast | olive sepia | the museum and its mirror image in the pond | `scene2.py` |
| c | Amstel, sunset | orange | big sky, small far bank, sailing barge, sun glitter | `scene3.py` |
| d | De Wallen, night | night blue, red lights | red rooms at street level, swans | `scene4.py` |

Scene b holds the user's favourite atmosphere ("I like the look, feel and atmosphere of this scene a lot"). For
a grey day, start from its sky, key and air.

## 1. Decisions

| # | Decision | By |
|---|---|---|
| 1 | The look of the page is approved as shown. The numbers of §3 are the contract | user |
| 2 | Scenery only. Figures, enemies, pickups, fx, hitboxes, scripts and sound stay as they are | user |
| 3 | Three art tiers: 1× (384 × 216), 2×, 4×. Each tier is painted for its grid. The user found 1× alone "too pixelated", so 4× is the tier to judge | user |
| 4 | "Do not enlarge Vincent." A figure keeps its size on the screen and its pixels are never resampled. Only the scenery gets the finer grid | user |
| 5 | Depth that runs away from the viewer (a side canal, an avenue) is drawn in true perspective and turns when the camera moves. The user rejected a flat painted view that slides with the far bank | user |
| 6 | Solid things are closed. A bridge spans the water only; the quay wall runs up to it. The user rejected sky that showed under a bridge | user |
| 7 | De Wallen: red light sits inside the ground floor. Rooms above are dark or warm | user |
| 8 | De Wallen: the scene has no signs with the words BAR, CAFE or LIVE | user |
| 9 | Amsterdammertjes stand on kerbstones | user (standing rule) |
| 10 | Never name a reference game in code, ids, comments or docs. Write "the arcade reference" (`docs/ORIGINALITY.md`) | standing |
| 11 | No commit, no push, no deploy. Work on `main` in the working tree and leave the uncommitted work of other waves as it is | standing |
| 12 | Any helper agent: model opus, effort high | user (standing rule) |
| 13 | A new scene is designed and approved in the kit first. Game code comes after that, by its own plan (§7) | lead |
| 14 | This look is its own style contract. It has no ink outline, light from the upper left, and dither in air. Where that differs from `docs/design/ams2.md` §1.1 or `docs/ART_GUIDE.md` §1, this file wins for scenery built in this look and changes nothing else | lead |

## 2. The words

- **Logical pixel**: one pixel of the 384 × 216 layout. Every position and size in this file and in the kit.
- **Tier** (`U`): how many real pixels one logical pixel has: 1, 2 or 4.
- **Plane**: one layer of the scene with one scroll speed.
- **Ramp**: the 7 tones of one material, dark to light. The shade end is cooler, the light end warmer.
- **Daylight first**: every part is painted in its daylight colour. The hour comes later, from two colour tables.
- **Key**: the colour table of the hour (the light). **Air**: the colour table of distance (the haze).
- **Emitter**: a colour that gives light (a lamp, a lit room). It skips the key and the air.
- **Set piece**: the one thing that tells the player where they are.

## 3. The look contract

### 3.1 Grid and tiers (`kit.py`)

- The view is 384 × 216. The walk plane is 960 wide, so the camera travels 576.
- A layer at speed `s` is `ceil(384 + 576·s) + 1` wide (`lw(s)` in `build.py`).
- The same drawing calls give all tiers. At tier 2 and 4: curves and slopes step by one real pixel (`sub`, `rq`);
  texture cells and the dither cell are half a logical pixel (`DET = min(U, 2)`); thin strokes (glazing bars,
  rails, rigging, joints) are half as wide (`TH`); noise gets 1 or 2 finer layers (`XO`); brick joints show at
  tier 4 only.
- Ramps, key, air, layout and plane speeds are the same at every tier. A tier is painted, never scaled from another.

### 3.2 Colour

- **5-bit grid.** Every colour of every layer sits on a grid of 5 bits per channel (`snap5`). `Scene.add` snaps
  each layer, and `check.py` tests it.
- **Ramps only.** A surface takes its tones from one ramp of `R` (`parts.py`, `parts3.py`). A new material is a
  new `ramp(7, L0, L1, C0, Cm, C1, h0, h1)` in OKLCH, with the hue turning from the shade hue to the light hue.
- **One key hue per scene.** The key pulls sky, water, stone and brick into one hue family.
- **The grade** (`grader` in `kit.py`), first with the key, then with the air:

```
lum = .30 r + .59 g + .11 b
tgt = dark + (light − dark) · lum^0.8        // per channel
c   = c + (tgt − c) · amount
c   = lum(c) + (c − lum(c)) · (1 − desat · amount)
```

| Scene | Key: dark, light, amount, desat | Air: dark, light |
|---|---|---|
| a clear morning | `(70,84,128)` `(255,248,226)` 0.10, 0 | `(122,160,205)` `(240,244,232)` |
| b overcast | `(44,44,48)` `(240,230,194)` 0.42, 0.30 | `(124,126,104)` `(228,222,188)` |
| c sunset | `(64,26,48)` `(255,198,112)` 0.64, 0.10 | `(122,54,70)` `(255,176,96)` |
| d night | `(8,8,34)` `(128,142,214)` 0.88, 0.15 | `(20,16,56)` `(112,76,150)` |

For a new hour: key dark = the colour of the shade, key light = the colour of the light, amount = how much the
hour owns the scene (0.10 clear noon … 0.88 night). Air light = the sky at the horizon, air dark = the far shade.

### 3.3 Planes

| Plane (layer id) | Speed | Holds | Air amount (desat) |
|---|---|---|---|
| `sky` | 0 | 12–18 tones, 150–160 rows | — |
| `clouds` | 0.02–0.03, drifts 0.8–1.6 px/s | cumulus, streaks or a cloud deck | horizon clouds 0.45 on a clear day |
| `skyline` | 0.10–0.18 | far roofs, towers, a tree band | 0.50 night, 0.70–0.74 day (0.2–0.5) |
| `far` | 0.30–0.50 | house row or landmark, street, trees, cars, quay wall, boats, bridge | 0.10 night, 0.22–0.34 day (0.1–0.3) |
| `vista` | the far speed | a side canal, drawn at run time (§3.8) | the far amount at the mouth, 0.86 at the far end |
| `water` | each row its own: far speed → 0.9 | §3.7 | — |
| `mid` | 0.55–0.72 | things on the water, on the row that has their speed | key only |
| `near` | 1 | the walk plane and its furniture | 0, then `curve(1.05–1.12)` |
| `fg` | 1.35 | three dark things at the lower edge, below y 176 | key toward near-black (0.42 clear day … 0.94 night) |

Every scene has the layer ids `sky`, `skyline`, `far`, `near` and `fg`; `check.py` and the page read them by name.

The far speed says how far the far side is: 0.5 for a canal of about 35 m, 0.4 for the pond, 0.3 for the river
(there the houses are painted at scale 0.62).

**Depth rules, from the measurements of the arcade reference:** a far plane takes the hue of the air and loses
contrast; the darkest tones are in the nearest planes only; figures are never graded with the scene.

### 3.4 Lines and scale

| Scene type | House foot `YH` | Quay top `YQ` | Water line `YW` |
|---|---|---|---|
| Canal, day (a) | 120 | 125 | 135 |
| Canal, tall houses (d) | 128 | 134 | 146 |
| Wide river (c) | 117 | 120 | 126 |
| Pond with a landmark (b) | 126 | 132 | 135 |

The near side is fixed (`ground` in `parts3.py`): stone edge at y 166, the strip where trees, lamps, bikes and
benches stand at y 172, kerbstones at y 185, **walk line at y 198**. The hero is 40 px, drawn at screen x 176.

Sizes: a far-bank house is 30–46 wide and 62–104 tall plus its gable, its windows are 7 wide, a far tree is about
48 × 65, a far lamp 27. On the walk plane a lamp is 98 tall, a street post 19, a bike 42 × 27, a bench 46 × 22.
A near tree is a trunk 12 wide whose crown leaves the screen at the top.

### 3.5 Surfaces

- **Brick** (`brickfill`): a mid tone, soft stains, single bricks one tone up or down, streaks under the cornice
  and at the plinth.
- **Glass** (`window`): light frame, dark glass, glazing bars, a sill with its shade. Five fillings: glint,
  curtain, sky, dark, blind.
- **Roofs**: rows of two tones, the left part one tone lighter. **Leaves** (`canopy`): a mass of spheres with a
  ragged edge, sky holes and clusters; dark edge below and right, a light rim on the sun side.
- **Ground** (`ground`): rows that get taller toward the viewer, stains, grit, puddles that take three sky tones,
  fallen leaves. Style `park` gives a lawn and a gravel path.
- **Edges are tones.** The edge of a thing is the dark tone of its own ramp on the shade side. Light comes from
  the upper left. Every surface has wear: stains, moss at the water, drainpipes, anchors.
- **Dither is for air.** The checker (`tones`, `chk`) sits between two tones of a sky, a cloud base, a halo,
  smoke, a light pool and the broken mirror of a thing on the water. Objects have clean clusters.
- **Cast shade** (`Props.shadows`): hard on a clear day, a contact shade under a cloud deck, long and toward the
  viewer against a low sun, none at night.

### 3.6 Night and low sun

Order: paint in daylight → `recolor(grader(...), keep=EM)` → the light pass.

- Lit rooms: `light_windows`, 12–36 % of the rooms. Lamps: a `glow` halo whose last tones are the night colour.
- Light on a surface: `tint` (walls) and `lightpool` (ground) step the pixels that are there toward the light
  colour in two tones. The detail of the surface stays. `glow` is for a light against air.
- Every light on the far side gets a streak in the water: `lights=[(x, colour, strength)]` in `water`.

### 3.7 Water

- **Canal and river** (`water` in `parts2.py`): 26–46 rows from the water line to the near edge. The rows mirror
  what stands above the line, squeezed by `k` 2.3–3.2, mixed into the body colour (0.30 far → 0.70 near), broken
  by ripples, cut to 26–34 colours, 3 frames. The two rows under the quay are shaded.
- **Still water with a landmark** (`mirror` + `ripples` in `parts4.py`): the mirror image is one layer that
  scrolls with the far side, so it stays under the landmark. The ripples and floating leaves are a second, partly
  clear layer that scrolls row by row over it.
- A thing on the water (`swan`, `duck`, `sailbarge`, `dolphin`) carries its own broken mirror.

### 3.8 Depth away from the viewer (`vista3d` in `sets.py`, `drawVista` in `page.tpl.html`)

Depth `z = 1` is the plane of the far side. A point of that plane at layout position `u`, moved to depth `z`, is at

```
x = 192 + (u − cx · speed − 192) / z        y = horizon + (y − horizon) / z
```

So a deep thing moves at `speed / z` and all lines along the canal meet at the centre of the screen. The kit makes
the data: two long strips of fronts (each house already has the air of its depth), the water seen from above,
trees as sprites, a far-end piece, 16 colour steps for quay and street. The page draws them for each frame, down
to `z = 5.2`. The Python frames show a flat copy; only the page shows the true view.

### 3.9 Motion

Water: 3 frames, one step each 10 ticks at 60 Hz. Clouds drift. The sun glitter stays under the sun (speed 0).
Cars, boats, birds and leaves stand still.

### 3.10 Place

- One set piece per scene, and five or more things that belong to that place and hour.
- A real building is an own impression, painted by the kit. Lettering is our own 3 × 5 font (`FONT`), with
  generic words.
- A rule of a place is a gate: write it as `checks(sc)` in the scene file (see `scene4.py`).

## 4. Build a scene

Work in `docs/design/canal-look/kit/`. A tier-4 build of one scene takes under 10 seconds, so build and look often.

1. **Scene card.** Write it at the top of the new scene file. Done when it names: the place, the hour, the key
   hue, the start values of key and air (from the nearest scene of §3.2), the set piece, the water type, every
   plane with its speed, five local things, and each rule the user gave for this place.
2. **Block the planes.** Copy the nearest reference scene to `scene<N>.py`. Set the lines of §3.4 and the plane
   speeds. Done when `U=1 python3 scene<N>.py` writes `out/s<N>-{0,1,2}-u1.png` and the set piece is in view at
   the middle camera.
3. **Paint the parts**, daylight first, ramps only. New parts go in a new `parts<N>.py`. Done when each new part
   was looked at alone at tier 1 and tier 4 on a plain ground.
4. **Grade** each plane with the key and its air amount (§3.3). Done when the far planes pass the depth gates.
5. **Light pass** for night and low sun (§3.6). Done when each emitter has its light on a surface or in air, and
   its streak in the water.
6. **Water** (§3.7), then the near side and three front things.
7. **Gates.** `for u in 1 2 4; do U=$u python3 check.py scene<N>; done`. Done at `ALL GATES PASS` three times.
8. **Look.** Open every frame with the Read tool: three cameras at each tier. Put each beside the `ref/` frame of
   the nearest scene. Write down every defect of §6 and every place that looks emptier, flatter or noisier than
   the reference. Fix and repeat. Done when one full pass over all nine frames finds nothing.
9. **Page** (when the user wants to see it move, or the scene has a side canal). Add the module to the import and
   the tuple in `export.py`, add a note under its scene key to `NOTE` in `page.tpl.html`, run
   `U=<tier> python3 export.py` for tiers 1, 2 and 4, then `python3 mkpage.py`. Serve `out/` on 127.0.0.1 and
   open `index.html`.
10. **Report**: the nine frames, the output of `check.py`, what differs from this file and why, what was not tested.

## 5. Gates (`check.py`)

| Gate | Value of the four scenes |
|---|---|
| Every pixel of every layer on the 5-bit grid | 1.0 |
| Key hue share ≥ 0.45 (colour pixels within 25° of the strongest hue) | 0.49 clear day, 0.68 overcast, 0.73 sunset, 0.85 night |
| Darkest tone: skyline > far ≥ near | a 0.57 / 0.22 / 0.11 · d 0.15 / 0.11 / 0.11 |
| Light range: skyline < far | b 0.13 / 0.55 |
| Colours in a frame ≤ 560 | 230–472 (the arcade reference: 122 at 304 px wide) |
| No hole in the far side at the water line | 0 pixels |
| Walk line at y 198 with ground under it; front things below y 176 | — |
| The rules of the place (`checks(sc)`) | d: 0 red pixels above the ground floor |

A scene with a strong hour should reach the key hue share of its neighbour in this table. A frame with many more
colours than its neighbour holds a gradient: find it.

## 6. Defects the user has rejected

Each line is a fix that is already in the kit. Keep it when you change a part.

- A flat painted view into depth → §3.8.
- Sky that shows through a solid thing → the bridge spans `WL..WR`, the quay wall closes the rest (`far_bank`).
- Scenery at 1× only → three tiers, judged at 4×.
- A figure made larger or resampled → the hero has its own 384 × 216 canvas.
- A mirror image that leans away from a landmark → §3.7, still water.
- Red light above the ground floor, and BAR, CAFE or LIVE signs, in De Wallen → `GF`, `NO_SIGN` in `scene4.py`.
- A street post off the kerb → posts are placed at `g['kerb']` only.

## 7. From the kit to the game

The game has no Python at run time. A port keeps the look and re-makes the method. Binding for a port: §3 and §5.

Three parts need a pass in the renderer, not a baked layer: the water rows (one speed per row), the still-water
mirror with its ripple layer, and the side canal in perspective.

Open decisions for the user, before a port is planned:

- **Colour path.** The look uses its own ramps and one colour table per plane (230–472 colours in a frame).
  `docs/ART_GUIDE.md` §1 asks for `PAL` / `PAL_HD`.
- **Which mission first**, and whether it replaces scenery or adds a test mission, as `ams2` did.

How scenery is built in the game today: `docs/design/ams2-contract.md`, `docs/api/ams2.md` and
`docs/design/atmosphere.md` §3.1.

## 8. The brief

```
Read docs/design/canal-look.md. Build the scenery of one new scene in the canal look, in its kit.

Place:        <name, what the player must recognise>
Hour:         <time and weather>; nearest reference scene: <a | b | c | d>
Set piece:    <the one thing>
Water:        <canal | river | still water with a mirror | none>
Local things: <five or more>
Rules:        <what the user said about this place, each as a gate>
Deliver:      scene<N>.py (+ parts<N>.py), nine frames in out/, the output of check.py at tiers 1, 2 and 4,
              a short report.
Limits:       scenery only; figures unchanged; no game code; no commit, push or deploy;
              helper agents: model opus, effort high.
```
