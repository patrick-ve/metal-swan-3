# Mission rally — level 2, BINNEN DE RING: a 3D race on the A10 (spec, 2026-10-22)

The user (2026-10-22), as an experiment "to see how well you are able to create 3D games": after
level 1 (`ams`) the game changes its art direction and becomes a **3D racing game on the A10 ring
of Amsterdam**, at the fidelity of a late-1990s Dutch motorway racer with the look of the 32-bit
console era (below: "the PS1 look"; the reference racer is never named in this repository). Four
AskUserQuestion rounds settled the design (§0).

The new mission `rally` replaces the **whole** 2D `ring` as level 2. The 2D `ring` stays in the
repository, dormant: out of the route, still reachable by URL.

This file is THE SPEC for the rally waves. Detail values (speeds, lap times, scores, triangle
counts) may be tuned by the builders when play shows a better value; the report says what changed
and why.

Originality: `docs/ORIGINALITY.md` (with the new dated `rally` paragraph, §11) and
`docs/research/mechanics.md` §23 apply in full. Never name any reference game in code, ids,
comments, docs, prompts or commit messages. Real A10 names are allowed (the `ring` exception,
extended).

## 0. Decisions

| # | Item | Decided by |
|---|---|---|
| 1 | Level 2 = a **3D racing level** on the A10 ring. It replaces the **whole** 2D `ring` in the route: ams → **rally** → glitch bridge → fps-1 / fps-2 → oldenzaal | user |
| 2 | The 2D `ring` stays **dormant**: code, art, audio and tests stay; out of the route; `?mission=ring` still opens it; its sims stay byte-identical | user |
| 3 | A **pure racer**: no guns, no shooting. Rivals, traffic, police and speed cameras | user |
| 4 | 2P: **split screen**, top P1, bottom P2 (each view 384×108 logical); 1P and P1 = the white estate, P2 = the green estate; 1P gets the full view | user |
| 5 | The **PS1 look** with all four traits: **affine texture warp**, **vertex wobble** (vertices snap to the 1× grid at every tier), **15-bit colour + 4×4 dither**, **short sight + fog** (pop-in) | user |
| 6 | **Sharper on big screens**: the 3D view renders at the art tier (1× 384×216, 2× 768×432, 4× 1536×864); polygon edges are sharp; **textures stay 1×** (low-res) at every tier | user |
| 7 | Renderer: **WebGL2** for the 3D view (the first GPU code of the game); the PS1 traits live in shaders | user |
| 8 | Track: **three laps** of a compressed ring (about 6–8 min in all) | user |
| 9 | Per lap: the **time of day** moves on (afternoon → sunset → dark), the **traffic builds up** (lap 3 = rush hour), and **one event per lap** (lap 2: road works; lap 3: the police join) | user |
| 10 | Rivals: **odd rally teams** in made-up junk cars, each with a team name and a livery | user |
| 11 | Hazards: **police + speed cameras**, **matrix signs + spitsstrook**, **road works**. Not picked: odd road users (no tractor, no scooter, no swaying caravan gag, no ZWAAN road-train) | user |
| 12 | Goal: **always go on**. The place and the time give the score and the MISSION COMPLETE tally; no retry loop | user |
| 13 | Transition: a **glitch into 3D** after ams (the glitch-bridge device); after the race the existing tally and glitch bridge lead into the FPS floors | user |
| 14 | Audio: a **car radio with a Dutch DJ** (a designed ElevenLabs voice, never a clone), jingles, A10 traffic news and our own driving songs; about 10,000–15,000 new credits approved | user |
| 15 | Name: **BINNEN DE RING** (the user's name, without a question mark) | user |
| 16 | **Spec, then all waves**, with no look stop between the waves; every worker agent at effort **xhigh**, never max | user |
| 17 | Mission id `rally` (not `a10`: the A10 already names the dormant ring); code in `src/engine/view3d.ts`, `src/engine/r3/`, `src/engine/gl3d*.browser.ts`, `src/game/rally/`, `src/game/content/rally/`, `src/sim/*-rally.ts` (§12.1) | lead proposal |
| 18 | The estates keep the ring's decisions 13 / 13a (likeness, no badge, the two liveries), now as low-poly 3D models | lead default |
| 19 | The compressed ring is about **6.5 km** (about 1:5 of the real 32 km); a lap takes about **2:00–2:40** at the bot's pace | lead proposal |
| 20 | **8 cars** on the grid: 1P = you + 7 rivals; 2P = the two estates + 6 rivals | lead proposal |
| 21 | Fines: every flash (speed camera, average-speed zone, a red X) is a fine; on lap 3 the police go first after the racers with the most fines (the rivals too) | lead proposal |
| 22 | The traits the user did not pick stay off: depth buffer on, correct near clipping, 60 fps | lead default |
| 23 | No WebGL2 on a device → a short card, then the tally with no race lines; the run never dead-ends | lead default |
| 24 | Story: the squad enters **DE RINGRALLY**; first prize: a **parking permit binnen de ring** | lead proposal |
| 25 | The radio station **FILE FM** ("WIJ STAAN ER ALTIJD") and its DJ (a name of our own) | lead proposal |
| 26 | Race physics is deterministic (fixed 60 Hz step; only + − × ÷ √ and our own tables); same seed = same race | lead (architect) |
| 27 | Three workflow waves, run back to back: A the foundation, B the race, C sound and polish (§13) | lead proposal |
| 28 | WebGL2 only, no software rasterizer (the user chose one renderer): node sims are logic only; every visual check runs in a browser (Playwright) | lead default |

Scope: the new mission `rally`, the WebGL2 3D view and the flow changes it needs. `ams`, the FPS
floors, `oldenzaal` and the dormant `ring` keep their sims byte-identical (only a route field may
change, §14); m0–m5 keep working passively.

"Binnen de ring" is the Amsterdam phrase for the city inside the A10: the popular, expensive
part of town. The race runs **on** the ring; the prize gets you **inside** it.

## 1. Flow and numbering

> **2026-10-31 (docs/design/oat.md §1):** the race is **level 3** now. Mission `oat` (OAT OF
> CONTROL, level 2) comes between `ams` and the race: ams → its tally → the oat card → oat → the
> kassabon → the **MISSION 3** card `BINNEN DE RING` (first line `TAXI PAID. NOW THE SQUAD RACES DE
> RINGRALLY: THREE LAPS OF THE A10.`, announce `MISSION THREE. VOL GAS!`) → the glitch into 3D → …
> The text below keeps the numbers of 2026-10-22.

ams boss → the ams MISSION COMPLETE tally → the MISSION 2 card `BINNEN DE RING` (Gusto voices
the briefing) → **the glitch into 3D** → the race intro (the camera flies over the grid, FILE FM
opens, the start gantry counts down) → three laps → the finish (the results in 3D) → the MISSION
COMPLETE tally (2D, with the race lines, §9) → the existing glitch bridge → fps-1.

- `rally` is `MISSION 2` and high-score label `M2`. The dormant `ring` keeps its own card for a
  URL start.
- URL: `?mission=rally` (a direct start skips the card, like every mission), `players=2`, `seed`,
  `difficulty=easy|normal|hard`, `art=1|2|4`, and two new test params: `lap=1|2|3` (start at that
  lap with its time of day, traffic and events) and `cam=chase|bumper`.
- `?mission=ring` opens the dormant 2D ring as before.

### 1.1 The card

English, like every mission card (the world and the radio are Dutch):

- Briefing: `FRIES SAFE. NOW THE SQUAD RACES DE RINGRALLY: THREE LAPS OF THE A10.` /
  `FIRST PRIZE: A PARKING PERMIT BINNEN DE RING. THE WAITING LIST IS 12 YEARS!`
- Headline after the race, by the best player's place: 1st `SQUAD WINS DE RINGRALLY! PERMIT
  SECURED!`; 2nd–3rd `PODIUM! BUT NO PERMIT. BACK ON THE LIST.`; 4th–8th `NO PERMIT. 12 MORE
  YEARS ON THE LIST.`
- Gusto voices the briefing (his existing designed voice; new takes); the card waits while he
  speaks (`INTRO_VOICE_HOLD`, as for the ring).

### 1.2 The glitch into 3D

When the card ends, the picture glitches: the 2D frame breaks into blocks, the blocks turn into
flat-shaded polygons, and the polygons fold into the 3D start grid (about one second). FILE FM
fades in under it. It uses the look and the sound of the existing glitch bridge (its code is the
model), so the player reads it as the same "the game changes" device. After the race the existing
glitch bridge leads into the FPS floors, unchanged.

## 2. The race

- **Format:** a standing start at the Zuidas; three laps clockwise (on the inner carriageway: we
  drive on the right); the finish under the same gantry.
- **The start:** 8 cars in a two-wide grid. The matrix signs on the start gantry count down `3`,
  `2`, `1`, then show green arrows. A jump start is not punished (the car only creeps).
- **Time:** about 2:00–2:40 per lap; the race about 6–8 min, plus about 30 s of intro and finish.
- **Place:** by lap, then by distance along the track; shown live.
- **Rivals' AI:** a racing line per section, a lane choice around traffic, overtaking, braking
  for jams, slipstream, and a mild catch-up that never teleports (up to +3 % top speed at the back
  of the field, −2 % in front; off on hard). Difficulty sets the rivals' pace (easy −6 %,
  normal 0, hard +4 %), the traffic density and the police count.
- **Collisions:** car–car bumps (by mass), scrapes on walls and barriers (sparks, speed loss),
  hits on traffic (a big speed loss and a short spin; the traffic car stops with its hazard lights
  on and then drives on). There is no damage model.
- **Recovery:** a car that faces the wrong way or stands still for 3 s is put back on the track
  (a short blink) with a small time loss.
- **Slipstream:** behind a lorry, a coach or a rival, the top speed rises a little.
- **Route choice (optional):** on the A10 Zuid, a parallel carriageway beside the main one: fewer
  cars, a slower merge. The track builder adds it only if it reads well.
- **The finish:** after lap 3. When the last player crosses the line, the rivals that are still
  racing get a projected time (from their pace) within a few seconds; the results never wait long.

## 3. The track: a compressed A10, clockwise from the Zuidas

| # | Section | Look (likeness, our own design) | Notes |
|---|---|---|---|
| 1 | ZUIDAS | glass and stone towers, the cranes of the endless works, the station | start and finish gantry |
| 2 | NIEUWE MEER | water, the bridge over the Schinkel, the trees of the woods | the A4 junction |
| 3 | RING WEST | 1960s blocks of flats in rows, noise barriers, a metro line beside the road | the average-speed zone |
| 4 | SLOTERDIJK | the station, office towers, a busy junction | |
| 5 | COENTUNNEL | the ramps and the tube with rows of orange lamps | radio static |
| 6 | NOORD | flat polder, sheds, wind turbines, a canal bridge | |
| 7 | ZEEBURGERTUNNEL | the tube under the IJ; towers of the new islands at the exit | radio static |
| 8 | OOST | the Watergraafsmeer, sports fields, a science park, a tall office tower near a station | |
| 9 | AMSTEL | the river with boats, the bridge | the A2 junction |
| 10 | RAI | the exhibition halls | back to the Zuidas |

- **Cross-section:** 3 lanes and a hard shoulder per direction (a spitsstrook in places), the
  central concrete barrier with the oncoming carriageway beside it (decor traffic only, with
  headlights at night), verges, ditches, embankments, viaducts, noise barriers, lamp posts,
  gantries about every 400 m, hectometre boards, flitspalen, and blue direction signs with the
  real S-exit names (the names the 2D ring already uses; our own lettering).
- **Data:** the track is a closed spline from a hand-made table: control points per section,
  width, lanes, elevation, tunnel and bridge flags, landmark anchors. The road mesh, the lanes,
  the AI lines and the segment list come from it. The same table always gives the same track; the
  seed only varies the traffic and the event details.
- **Streaming:** the track is cut into segments of about 20 m. A view draws the segments up to
  the fog distance; scenery pops in at the fog edge, as in the era.

## 4. Laps, time of day and events

| Lap | HUD clock | Light | Traffic | Event |
|---|---|---|---|---|
| 1 | about 16:15 | low autumn sun, warm light, long dark sides | light | speed cameras, matrix signs |
| 2 | about 17:00 | sunset; headlights and street lamps come on | medium | **road works** at 2–3 places: lanes close behind red X signs, yellow temporary lines, cones, barriers, arrow-board trucks, a 70 limit with a camera |
| 3 | about 17:45 | dark (in late October the evening rush hour is in the dark) | **rush hour**: dense, short jams; the **spitsstrook opens** (green arrows) | **the police join** |

The light blends smoothly along the race, not in steps: the sky gradient, the sun height, the fog
colour and distance, the ambient and key light, and the glow of lamps and windows. The HUD clock
runs fast to match.

## 5. Police, speed cameras and matrix signs

- **Speed cameras (flitspalen):** grey boxes on poles, about 3 per lap. A car that passes above
  the limit on the last matrix sign gets a flash (a white flash in that player's view) and a fine.
  Rivals get flashed too.
- **Average-speed zone (trajectcontrole):** one per lap, in Ring West, with a gantry at its start
  and its end. An average above the limit gives a fine at the end gantry.
- **Matrix signs:** gantries with one sign per lane: speed limits, a red X (the lane is closed
  ahead), green arrows (the spitsstrook is open), a merge arrow. Driving under a red X is a fine,
  as in real Dutch law.
- **The police (lap 3):** 2 / 3 / 4 police cars (easy / normal / hard) come from the on-ramps.
  Each picks the racer with the most fines who was not stopped yet, the rivals included. A police
  car comes alongside with blue lights and a `STOP POLITIE` display. When it stays beside and
  just ahead of a car for 2 s, that car is pulled over: 3 s on the hard shoulder (the DJ reports
  it), then it drives on. One police car stops one racer once. Speed and weaving through traffic
  can shake it off. The police are never hurt; bumps only.
- The fines are a joke column with a small score cost (§9). A player who brakes for the cameras
  loses time but meets fewer police on lap 3.

## 6. The cars

- **The estates (players):** the ring's likenesses (the boxy 1990s Swedish estate, no badge,
  made-up yellow plates) with the two liveries of ring decision 13a. Low poly: about 400–600
  triangles each; textures at 1× (about 128×48 texels per side). Both handle the same: heavy,
  front-wheel drive, understeer at high speed, a handbrake slide, a top speed of about 220 km/h.
- **The rally teams (rivals; 6 or 7 of this list, our own designs, no badges, made-up plates):**
  - `DE LAATSTE RIT`: a black 1980s hearse with flowers on the roof; fast and heavy.
  - `HUISJE OP WIELEN`: a 1970s camper van that leans in corners; slow on the straights.
  - `DE FRIETBAK`: a snack van with a giant cone of fries on the roof (a nod to ams).
  - `VRIJGEZELLEN`: a white stretch limousine with a bachelor party through the sunroof.
  - `DE IJSCOMAN`: an ice-cream van that plays its own tune when it is near.
  - `ACHTERUIT`: a small 1970s Dutch saloon with a belt drive, as fast backwards as forwards.
  - `OMA TRUUS`: a tiny 1990s hatchback, driven far too fast.

  Each has a team name on the doors and the roof, a livery, a horn sound, a DJ mention, and its
  own handling (mass, top speed, grip).
- **Traffic:** hatchbacks, saloons, estates, vans, parcel vans, lorries with trailers, coaches and
  taxis; 120–250 triangles; colour variants; indicators that blink before a lane change; brake
  lights; headlights at night.
- **Police:** our own estate design and livery, the word `POLITIE` in our lettering, blue lights,
  the `STOP POLITIE` display.

## 7. The PS1 look

### 7.1 The four traits (the user's choice)

1. **Affine texture warp:** textures interpolate linearly in screen space (no perspective
   correction), so big near polygons (the road, the tunnel walls) bend and swim. The mesh
   subdivision is tuned so that the warp shows but the road stays readable (the games of the era
   subdivided near polygons too).
2. **Vertex wobble:** after projection, every vertex snaps to the 1× pixel grid of its view
   (384×216, or 384×108 for a split view) at every tier. At 2× and 4× the edges are sharp, but the
   positions jump in whole 1× pixels, so models shimmer when they move.
3. **Colour:** the shaded colour is quantised to 15 bits (5:5:5) with the 4×4 ordered dither of
   the era, after shading and fog. The dither cell is one 1× pixel (d×d screen pixels at tier d).
   Textures are palettised: 4-bit (16 colours) or, where a gradient needs it, 8-bit.
4. **Short sight + fog:** linear fog to the sky colour at the horizon, a short draw distance
   (about 300–450 m, tuned for speed), and scenery that pops in at the fog edge.

### 7.2 Lead defaults (the traits not picked stay off)

A depth buffer (no sorting glitches); correct near clipping (no polygon drop-outs); 60 fps.
Nearest-neighbour texture sampling with no mipmaps (far textures shimmer a little; the fog hides
most of it). Gouraud shading per vertex. The semi-transparent blend modes of the era for glows,
lights and a blob shadow under each car.

### 7.3 Budgets (per view, at most)

About 6,000 triangles and 150 draw calls (batched per texture page); texture pages of 256×256
texels; all textures together ≤ 8 MB; the estates 400–600 triangles, the rivals 300–500, the
traffic 120–250, a landmark 200–1,500.

### 7.4 Textures

All textures are drawn by our code (no photo, no scan, no AI image): asphalt with lane lines
(white and dashed; the block marks at exits; yellow temporary lines at road works), concrete,
steel, glass, brick, grass, water, tree cards (crossed quads), the sky, the signs. A texture uses
at most 16 colours (its CLUT), taken from the PAL_HD ramps; an 8-bit texture only where a
gradient needs it (the sky).

### 7.5 Lights at night

Additive glows for street lamps, headlights (two glows and a pool of light on the road), tail and
brake lights, indicators, the matrix-sign LEDs, building windows and the blue police lights; rows
of sodium-orange lamps in the tunnels.

### 7.6 Camera, HUD and results

- A **chase camera** (default: a soft spring, a field of view of about 65°, a small look-ahead
  into corners) and a **bumper camera**. The switch is in the pause menu, and on a pad button if
  the input layer has a free one.
- The **HUD** (2D, the game's font, Dutch labels): `POSITIE 3/8`, `RONDE 2/3`, the lap time and
  `BESTE RONDE`, the speed in km/h (digits and a small dial), a ring mini-map (a loop with dots),
  the radio ticker (`FILE FM` and the song title), warnings (`FLITSER`, a red X ahead, `POLITIE`)
  and the clock. In split screen each view has a compact HUD.
- The **results:** the camera circles the player's estate; the standings, the lap times and the
  fines.

### 7.7 Controls

The 8-button pad works everywhere (keyboard, any pad, the bot): LEFT / RIGHT steer, FIRE or UP =
gas, JUMP or DOWN = brake and reverse, BOMB = handbrake, START = pause. A pad with a stick steers
analog; a pad with analog triggers gets analog gas and brake. The race reads a per-slot race
channel (both slots, for split screen), in the way the FPS mode reads its own channel for slot 0.

## 8. Sound and FILE FM (ElevenLabs, with synth fallbacks)

- **FILE FM**, "WIJ STAAN ER ALTIJD" (a pun: "we are always there" and "we always stand still").
- **The DJ:** `FREEK FLITS` (the lead's name for him), a designed Dutch voice (cheerful, fast, a
  bit too much). He names the players' estates by their liveries (`DE ROZZERS`,
  `MAJOR COCKTAILS`), never by the car's brand. About 40–60 short lines:
  station ids, the race start, lap calls, the time, the weather, traffic news from the race state
  (a flitser, road works, a red X, the police, a jam, the spitsstrook), the leader, a racer who is
  pulled over, the finish, the parking-permit gag. Lines queue by priority with cooldowns; the
  song ducks under the DJ.
- **Jingles:** 3–4 short station jingles.
- **Songs:** 3 driving songs of our own, one per lap (afternoon: upbeat; sunset: euphoric; dark:
  a night-drive synth), about 2:30 each, looping. ElevenLabs Music with genre-only prompts (never
  an artist, a song, a station or a game).
- **Tunnels:** the radio drops to static in the two tunnels and comes back at the exit.
- **Synth (no credits):** an engine per car (rpm harmonics, gear shifts, a turbo whine for the
  estates), tyre squeal, scrapes, bumps, the camera flash, the Dutch two-tone siren, horns, wind,
  doppler on passing cars, an echo in the tunnels.
- The heroes never talk in the car (the ring rule: the drivers say nothing). Gusto voices only
  the MISSION 2 card.
- 2P: one radio for both views; both engines in the mix.
- Credits: 10,000–15,000; the workflow cap is 20,000.

## 9. Score and the tally

| Line | Value (proposal) |
|---|---|
| `PLACE` | 1st 20,000 · 2nd 15,000 · 3rd 12,000 · 4th 9,000 · 5th 7,000 · 6th 5,000 · 7th 3,500 · 8th 2,000 |
| `TIME` | 50 per full second under the par time |
| `BEST LAP` | 2,000 for a lap under the lap par |
| `OVERTAKES` | 100 per overtake of a rival (once per rival per lap) |
| `NEAR MISSES` | 50 per near miss with traffic above 150 km/h |
| `FINES` | −250 per fine; the tally also shows the total in euros as a joke |
| `TEAM` (2P) | 5,000 each when both estates finish in the top 3 |

Each player has their own place and score. The tally is the existing MISSION COMPLETE page with
these lines (labels in the tally's language); the high-score label is `M2`.

## 10. Two players

- Split: top = P1, bottom = P2; each view 384×108 logical (384·d × 108·d at tier d). Each view
  snaps its vertices to its own 1× grid; the field of view is adapted to the wide view.
- P2 joins during the card or the race intro: the green estate takes the second grid slot. A join
  during the race puts the green estate on the track at the back of the field, at the next safe
  point.
- One world: the sim updates once per tick; each view culls and draws it.

## 11. Originality (a dated paragraph in `docs/ORIGINALITY.md`)

- The `ring` exception (real A10 names; the estates' likeness and liveries; our own lettering; no
  badges; no real plates) applies to `rally` in full.
- The look of an era is allowed, like pixel art: low-poly models, affine texture warp, vertex
  wobble, 15-bit colour with an ordered dither, fog. No console name, logo, boot screen, start-up
  sound, controller picture or system font of a real console appears in the game. In repository
  text, "PS1 look" only describes the look.
- The user's look reference is a late-1990s Dutch motorway racing game. It is never named in the
  repository (code, ids, comments, docs, prompts, commit messages). Genre conventions are allowed:
  racing through motorway traffic, rivals, police, speed cameras, an in-car radio with a DJ and
  traffic news, a race on a real road. Never its title, logo, menus, HUD, car models, liveries,
  track layout, radio station or DJ names, jingles, songs or lines; no screenshot is traced,
  sampled or copied.
- FILE FM and its DJ are our own. The DJ's voice is designed (never a clone, never an imitation
  of a real presenter). The songs and jingles are our own; their prompts never name an artist, a
  song, a station or a game. If a real station uses the name, ours is renamed.
- Buildings along the ring are likenesses without real company names or logos (our own blank or
  made-up signs). The police carry the generic words `POLITIE` and `STOP POLITIE` in our own
  lettering on our own livery, never a real force emblem or livery design.
- The parking-permit joke is about a situation (a long waiting list), never a real official or
  office.

## 12. Architecture (from the code maps, 2026-10-22)

### 12.1 Layers and files

| Layer | Where | Rules |
|---|---|---|
| 3D API (pure) | `src/engine/view3d.ts` | the `View3d` interface (resize to tier d, upload meshes and texture pages, draw lists per viewport, the frame), the scene types, `NullView3d` for node |
| 3D math (pure) | `src/engine/r3/` | vectors, matrices, projection, frustum culling, the spline, mesh builders, CLUT texture pages, the trig tables (§12.4); node-testable |
| WebGL2 | `src/engine/gl3d.browser.ts` (+ `gl3d-*.browser.ts`) | Hard Rule 3: GPU code only in `*.browser.ts`, reached from `main.ts`; injected through `AppOptions` (a new `view3d` slot), like `audio` and `artCache` |
| 2D bridge | a new `Renderer.surface(src, x, y, opts)` (render.ts); `CanvasRenderer` draws the GL canvas with `drawImage` next to its stream branch; `SoftRenderer` draws a flat placeholder (sky over road) | additive; the other modes are unchanged |
| Race sim (pure) | `src/game/rally/` | state, physics, cars, AI, traffic, police, events, score, cameras, the race input channel; deterministic (§12.4) |
| Scenes | `src/game/scenes/rally.ts`, `rally-route.ts`, `rally-glitch.ts` | the pattern of `ring.ts` / `ring-route.ts` |
| Content | `src/game/content/rally/` | the track table, sections, models, texture painters, liveries, signs, radio lines; **lazy** content (like `fps/*`), loaded by the card |
| Audio | `src/engine/radio.ts`, `AudioOut` opt-ins, `src/game/rally/radio.ts`, `content/sfx/rally-*.ts`, `content/music/rally-*.ts`, `content/samples/rally.ts` | cosmetic: `fxRng` only (§12.6) |
| Sim | `src/sim/headless-rally.ts`, `src/sim/bot-rally.ts`, a `tools/sim.ts` branch | §14 |
| Tools | `tools/shot3d.ts` | Playwright captures of the 3D view (lap, camera, tier, players) and orbit sheets of the models |

There is no software rasterizer. Node has no WebGL, so the sims are logic only, and every visual
check runs in a browser (Playwright; in CI on SwiftShader, which Playwright 1.64 enables by itself).

### 12.2 The 3D view in the frame

- One WebGL2 canvas (detached, or an `OffscreenCanvas`) of 384·d × 216·d at tier d. The split
  screen is two viewports in it.
- `RallyScene.draw`: `r.begin` → the view renders the frame → `r.surface(glCanvas, …)` (one
  `drawImage` into the 2D backbuffer, in the same task as the GL draw) → the 2D HUD on top →
  `r.end`. The HUD, the font, menus, fades, scanlines, `present()`, the smoke screenshots of
  `#game` and the `getImageData` checks keep working unchanged.
- d = `densityAtRes(min(artTier(), 4), r.res)`, as the FPS view picks its density but without its
  cap of 2. The GL canvas resizes only when d changes. `?art=` and the ART DETAIL option work as
  everywhere.
- The frame scales twice with nearest-neighbour (k/d, then s/k), as the FPS view does today.
- **The PS1 program** (one vertex and one fragment shader):
  - vertex: transform, project, **snap** x and y to the view's 1× grid (then multiply back by w),
    Gouraud light (sun, ambient, the time of day), the fog factor; the varyings `uv·w` and `w`;
  - fragment: `uv = (uv·w) / w` gives the **affine** (screen-linear) mapping (GLSL ES 3.00 has no
    `noperspective`); an R8 index texture with a CLUT row lookup (palette swaps give the traffic
    its colour variants); shade; fog; then the **15-bit cut with the 4×4 ordered dither of the
    era** (offsets −4…+3 on 8-bit values), with the dither cell at `floor(gl_FragCoord.xy / d)`;
  - the blend modes of the era: average, add, subtract, quarter-add (WebGL blend equations);
  - a depth buffer; opaque geometry first, then the transparent glows back to front.
- **Context loss:** handle `webglcontextlost` and `webglcontextrestored`. Meshes and textures
  come from pure code, so they are built and uploaded again. While the context is lost the race
  pauses; if it does not come back within 5 s, the no-WebGL2 path (§0 item 23) takes over.
- **Feature check:** the card's preload creates the context. No WebGL2, or a shader that fails to
  compile, sets the fallback flag. The flag is also written to `window.__ms3`, so smoke can fail
  on it (smoke does not fail on console errors).
- **Governor:** the current `FrameGovernor` times the CPU only and cannot see the GPU cost. The 3D
  view adds a frame-interval sample: a 2 s average above 20 ms at tier 4 caps the 3D view at tier
  2, and later at tier 1 (once per session each).
- **Memory:** the GL textures (≤ 8 MB) and buffers (≤ 16 MB) are reserved through `denseReserve`
  (gameplay.ts), because they fall outside the texture and dense budgets.

### 12.3 The runner, the scene and the flow

- `RallyRunner` (pure) owns the race. It steps at 60 Hz and emits events (`lap`, `place`,
  `flash`, `fine`, `pulledOver`, `overtake`, `nearMiss`, `tunnelIn` / `tunnelOut`,
  `roadworksAhead`, `policeActive`, `jam`, `finish`, …). Like `RingRunner` it calls
  `session.startMission('rally')`, fills the slot stats and `session.completed`, and has
  `report()`, `nextMission() → null`, and the `artDensity` and `hud.banner` that the bridge's
  `BridgeRunner` type needs.
- `rally` is **not** registered with `defineMission` (the sorted ids would pull it into
  `nextMission` and the high-score lists). It has its own scene, like the ring and the FPS mode.
- `RallyScene`: the race input channel for both slots, `PauseScene`, `LostPadScene`, the P2 join
  (`PlayHostRunner.joinPlayer`), the draw (§12.2), and the events to the radio director.
- The end: `rallyTally(runner)` → `MissionCompleteScene` with a new additive hook
  `TallyRunner.tallyLines?(slot)` for the race lines (§9) → `afterTally` →
  `GlitchBridgeScene({from: page, runner, tallied: true})` → fps-1 (a copy of the ring's
  `ringTally`). The bridge's opening line `SOMEWHERE ON THE RING…` still fits.
- The glitch into 3D: `RallyGlitchScene` takes the card's last frame, breaks it up and folds it
  into the 3D grid (§1.2). It reuses the look of the bridge's effect, but not the bridge scene
  (that scene loads the FPS content and starts the FPS run). Its sound is its own synth, because
  the bridge's sounds live in the lazy FPS content.

**Flow edits (every place that names `ring` as level 2):**
- `flow-data.ts`: `FPS_ROUTE = ['ams', 'rally', 'fps-1', 'fps-2', OLDENZAAL_ID]`;
  `goldenRecordRoute` checks `rally`.
- `ams/index.ts`: `next: 'rally'`. `flow.ts` (`missionDone`): accept `RALLY_ID`, as it accepts
  the ring now.
- `cards.ts`: a new `rally` card (`MISSION 2`). The ring card stays for a URL start.
- `mission-intro.ts`: `isRally` branches for the preload (the lazy content, the samples, the GL
  context) and for `go()` (→ `RallyGlitchScene` → `RallyScene`).
- `boot.ts` / `params.ts`: `isRally` → `startRally` (a direct start: a new session, no card);
  `bootArt` and `loadSamples` branches; the params `lap` and `cam`.
- High scores: `M2` follows from the route. A URL run of the dormant ring shows `RIN`.
- `fps-tally.ts` shows `RING SEED`: it shows the seed of the level 2 that the run passed.
- Tests that assert the old route move to `rally` (ring/flow, fps/flow, scenes, oldenzaal-flow,
  mission-ams, ams-art, ring-voice-fit, audio-spec). The ring's own tests keep testing the ring
  through its URL start.
- Tools: `tools/sim.ts` (a `rally` branch before the 2D fallback); `tools/smoke.ts` (`RallyScene`
  in `PLAY_SCENES`, a `playRally` branch, the GL flag check; in debug, F4 ends the race at once
  with projected times); `tools/shot.ts` (points to `shot3d` for `rally`).
- Docs: `docs/design/ring.md` §1 gets a "dormant since 2026-10-22" note; `docs/api/rally.md`
  (new); `docs/api/sim.md` (a rally section); `ARCHITECTURE.md` (the table, §9, §10);
  `GAME_DESIGN.md`; the `params.ts` header.

### 12.4 Determinism

- A fixed 60 Hz step; float64 physics.
- The sim code (`src/game/rally/`, `src/engine/r3/`) uses only + − × ÷, `Math.sqrt`, `floor`,
  `round`, `abs`, `min`, `max` and our own trig tables (finer than `fixed.ts`, with linear steps
  between the entries). No `Math.sin`, `cos`, `tan`, `atan2`, `exp`, `log`, `pow`, `hypot` or
  `random`, no `Date`, no `performance`. A vitest scans these folders for the banned names (today
  no test enforces the `Math.random` ban).
- `world.rng` for gameplay (traffic, events); `world.fxRng` for cosmetics (radio, sparks).
- The report carries a `stateHash`. Tests: the same seed twice gives the same hash, and drawing
  never changes it.
- The renderer and the audio may use any float math (they are cosmetic).

### 12.5 The race input channel

An additive opt-in like the FPS channel (`input.fpsMode`), but for **both slots**: per slot
`steer` (−127…127), `gas` and `brake` (0…127), `handbrake`, `camera` and `lookBack`. Sources: the
8-button pad (keyboard, any pad, `ScriptedSource`), a pad stick (analog steering) and analog
triggers (analog gas and brake). The bot drives through the same channel.

### 12.6 Audio (from the audio map)

- **The pipeline as it is:** a designed Dutch DJ voice (`VoiceSpec` with `radio: true`, so the
  car-speaker filter is baked into the takes), the DJ lines and news (`LineSpec`, `lang: 'nl'`),
  jingles and songs (`MusicSpec`); picks checked with Scribe (the git-ignored `tmp/ring-audio/`
  tools); `audio:ship` to `public/audio/rally/`. Each song id needs a synth fallback song (a test
  checks it). Gusto's two card lines go to group `boot`, like the ring's.
- **The group** `mission:rally` in `SAMPLE_GROUPS`, `GROUP_DIRS` and `LAZY_GROUPS`, with
  `content/samples/rally.ts`; the card loads it, and it is released after the race.
- **New and additive** (`AudioOut` opt-ins with no-ops in `NullAudio`):
  1. a song-end event, so the radio knows when a song ends (today a one-shot just stops);
  2. **streamed songs** (a media element source): decoded audio costs about 21 MB per minute of
     stereo, so three songs of 2:30 must not be decoded whole;
  3. a radio bus filter (the tunnel muffle) and a static loop;
  4. a **parametric engine voice** (oscillators at the firing frequency plus filtered noise,
     driven by rpm and load): a looped sample with only pitch is too thin for the rpm range;
  5. pan on loops (today `sfxLoop` ignores `pan`) and a doppler pitch for passing cars.
- **The radio scheduler** (`src/engine/radio.ts`, pure, node-testable): the playlist (one song
  per lap), jingles, DJ lines and news, with priorities, cooldowns and a longer queue than the
  `SpeechLane` (which drops a waiting line after 3 s). The DJ speaks through `say()`. The songs
  duck under him (the existing dialogue duck works when the songs play on the music bus).
- **The director** (`src/game/rally/radio.ts`) listens to the runner's events, like the ring's
  cues listener, and never touches the sim rng.

## 13. Build: three workflow waves (every worker at effort xhigh)

Rules for every wave: one workflow per wave; every agent at effort `xhigh` (never max); the
builders own separate folders; each agent gets its own port for previews and smoke; ElevenLabs
only in wave C, with a cap of 20,000 credits, and the key stays in `.env.local`. After each wave:
the lead gates (§14), an internal look check (the user chose no look stop), a local commit (no
push), then the next wave.

### Wave A — the foundation: a drivable ring

| Agent | Owns | Delivers |
|---|---|---|
| PREP | flow, stubs, docs | the route switch (§12.3); the contracts (`view3d.ts`, the `r3` API, the race state API, the scene and route skeletons, the tally hook); the sim harness skeleton and report; identity baselines; `docs/api/rally.md`; the `ORIGINALITY.md` paragraph |
| GL | `src/engine/gl3d*.browser.ts`, `Renderer.surface` | the PS1 program (§12.2), texture pages, buffers, viewports, tiers, context loss, the feature check, the frame-interval governor, `AppOptions.view3d`, `tools/shot3d.ts`, the browser test |
| TRACK | `content/rally/track/`, the `r3` spline and mesh builders | the table of the 10 sections, the road mesh, barriers, verges, tunnels, placeholder gantries, segments and culling, the AI lines, the grid |
| DRIVE | `src/game/rally/` (physics, input, cameras, race state), `src/sim/*-rally.ts` | deterministic physics, the estate, the race channel, the chase and bumper cameras, collisions, laps and place, the bot, `npm run sim -- --mission rally`, the determinism and scan tests |
| CARS | `content/rally/tex/`, `content/rally/models/` | the CLUT texture kit (PAL_HD ramps), the two estates, one rival, one traffic car, a police car, the blob shadow, orbit sheets |
| INTEGRATE | scenes, flow, HUD | `RallyScene`, the card, the glitch into 3D (first cut), the basic HUD, the tally and the bridge, the smoke branch; the CI smoke route goes through the race |
| REVIEW → FIX | | a review against this spec, then the fixes |

### Wave B — the race

| Agent | Owns | Delivers |
|---|---|---|
| WORLD | `content/rally/sections/`, the sky, the lights | the scenery of the 10 sections, the landmarks, the signs with the S-exits, the oncoming carriageway, the sky and the time of day (§4), the night lights (§7.5) |
| FIELD | `content/rally/teams/`, traffic, AI | the 6–7 rally teams, the traffic types, the traffic AI and the density per lap, the rival AI (racing line, overtakes, catch-up, difficulty), the countdown on the gantry, the finish and the results |
| RULES | police, cameras, matrix signs, events, score, 2P | §5; the road works of lap 2; the event director; the score and the tally lines (§9); the split screen and the join (§10); the full HUD |
| INTEGRATE → REVIEW → FIX | | |

### Wave C — sound and polish

| Agent | Owns | Delivers |
|---|---|---|
| RADIO | `src/engine/radio.ts`, the `AudioOut` opt-ins, `src/game/rally/radio.ts` | §12.6 items 1–5, the scheduler, the director, the tunnel static |
| AUDIO-GEN | the `tools/audio/` spec entries, `public/audio/rally/` | the DJ voice, about 50 lines, Gusto's card lines, the jingles, 3 songs and their synth fallbacks; Scribe checks; credits ≤ 20,000 |
| SFX | `content/sfx/rally-*.ts` | engines, tyres, scrapes, bumps, the flash, the siren, the team horns (and the ice-cream tune), wind, doppler, the tunnel echo, the mix |
| POLISH (look, play, perf) → FIX | | the look against §7; the balance, the readability and the lap times; the frame time at 4× in split screen; then the fixes |

## 14. Gates (the lead, after each wave)

1. `npm run typecheck` and the full `npx vitest run`.
2. Identity: the 10 sims of `tmp/ring-r/id.sh` and the dormant ring's sims
   (`tmp/ring-r/ring-b.sh`, `drive-same.sh`) stay byte-identical (`jq 'del(.timing)'`). A
   difference is allowed only where the route itself shows, and the report names it.
3. Rally sims: seeds 1–3 in 1P and seed 1 in 2P, at easy, normal and hard: complete, 0 errors,
   ticks in the expected range (about 23,000–31,000), and the same `stateHash` on a second run.
4. `npx vite build`, then `npm run smoke` on the CI route (ams → rally → bridge → fps → oldenzaal
   → name entry) and on `?mission=rally&players=2&art=4`; the GL flag must be OK.
5. The browser 3D tests (Playwright on SwiftShader): the shader compiles, the context lives,
   captures at 1×, 2× and 4×, the split screen, the dither and the fog are present, no page errors.
6. `npm run cache-check`; boot@1x stays ≤ 4.0 s (the rally content is lazy).
7. Perf (the lead, on a real GPU with `perf --gpu`): a 4K split screen in ≤ 16.7 ms per frame; the
   sim in ≤ 1 ms per tick.
8. The lead looks at `shot3d` captures (each lap, both cameras, 1×/2×/4×, 1P/2P) against §7 and
   the look reference: the traits visible, the road readable at speed, the estates recognisable,
   the landmarks clear.
9. Scans: no reference game name; no console name or logo in game text; no banned `Math` names in
   sim code; no keys, no `.env*`, no photos and no paths to the user's photos in `src/`,
   `public/`, `docs/` or `tests/` (tmp/ paths to sim baselines in docs are the project's practice).
10. Audio (wave C): every Dutch line passes the Scribe check; the credits stay within the cap.

## 15. Risks

1. **WebGL2 support:** old devices or blocked GPUs. The fallback path keeps the run going. CI runs
   on SwiftShader (Playwright adds the flag); smoke must check the GL flag, because it does not
   fail on console errors.
2. **The first GPU code:** context loss, driver bugs, precision (use `highp`). Keep the GL layer
   small and covered by the browser test.
3. **Determinism:** float physics is the same on every engine only under the §12.4 rules; the scan
   test and the `stateHash` tests guard them.
4. **Length (6–8 min) and momentum:** the per-lap changes and the radio carry the race. The lap
   length stays tunable (the three laps are the user's decision).
5. **Readability:** wobble and warp at 200 km/h can hurt the read of the road. Tune the
   subdivision of near polygons; the lane lines and the barriers must stay clear.
6. **GPU cost at 4K in split screen** is not seen by today's governor; the frame-interval sample
   covers it.
7. **CI time:** the pages job has a 30 min limit and took about 18 min on 2026-10-22. Keep the
   browser 3D tests short; the smoke ends the race with F4.
8. **Audio memory:** the songs stream; the decoded DJ lines are short.
9. **Scope:** the biggest new system since the FPS mode. Three waves, each committed only on green
   gates.
10. **No user look stop:** the lead's look check (§14 item 8) replaces it; the user can still ask
    for changes after any wave.

## 16. Settled after the brainstorm (the user, 2026-10-22)

- **The name** is `BINNEN DE RING`, without a question mark.
- **The ZWAAN road-train** stays out.
- **References:** no screenshots of the look reference. The estates use only the user's photos of
  the two rally estates (the ring's likeness photos, kept git-ignored and untracked): studied for
  likeness, never copied, traced, sampled or committed, and their paths never enter the repository.
- **Still proposals the user may rename later:** `FILE FM`, the DJ's name, the rally team list,
  the card text.
- **The run:** the user said "Go" and asked for an autonomous build of all waves (build, test,
  commit locally; no push) with the lead's best judgment.

## Status (wave A, 2026-10-23)

Wave A (the foundation, §13) is built and integrated; the decisions above are unchanged. What plays
now, end to end: the ams tally → the MISSION 2 card BINNEN DE RING (it loads the lazy content and
creates the WebGL2 context) → the glitch into 3D (§1.2: the card's frame breaks into blocks, the
blocks go flat, the flat tiles fold as 3D polygons into the start grid; its own synth crackle and
whoosh) → the race on the compressed A10 (6,801 m, ten sections, two tunnels, five decks; the
four PS1 traits; the chase and bumper cameras; DRIVE's deterministic physics) with the two estates
(1P white; 2P white on top, green below) and seven stub rivals (CARS' hearse) → the countdown
(beeps, GO!), three laps, the finish, the results (the camera circles the estate, UITSLAG with the
standings) → the tally (PLACE, TIME; the headline by the best place) → the glitch bridge → fps-1.
`?gl=0`, no WebGL2 or a context lost for 5 s take the no-WebGL2 path (§0 item 23).

- **HUD basics** (§7.6): POSITIE n/8, RONDE n/3, the lap time and the best lap, KM/H, the
  countdown; a compact HUD per view in split screen. The pause menu has the camera switch.
- **Gates:** the rally sims complete at 24,094 ticks (1P, every difficulty; 2P 24,195), the same
  hash twice; the 10 identity sims and the dormant ring's 6 + 4 sims are byte-identical; the browser
  3D test passes; at 4K split screen a real GPU holds 60 fps at 3D density 4 (16.7 ms frames,
  about 6,400–6,700 triangles in about 100 draws for both views).
- **Lead defaults taken in wave A:** the glitch's tiles are 16 logical px and fold in 54 ticks
  (the race's countdown starts after the fold); a near car (≤ 60 m) draws its body and spinning,
  steering wheels, a far one its low-poly model; brake lamps light when a car brakes; a debug
  autopilot and teleport serve the captures (never the game's input or the sims).
- **The wave-A fix (after the review):** two cars no longer lock together at a barrier (a slow
  contact adds no yaw; the drivers back off from a car beside; 3 s pressed on the car ahead below
  half the top speed → the recovery); a P2 join keeps the field at 8 (on the grid the green estate
  takes slot 2; during the race the last rival leaves) and times its partial first lap from the
  join (no lap record); the glitch fold draws its tiles in a few batched meshes (about 45 draws
  instead of 375); the no-WebGL2 tally judges nobody (3 stars, `RALLY CALLED OFF. THE SQUAD DRIVES
  ON.`); the near asphalt is calmer (cool greys) with two-texel lane dashes; the split view frames
  the whole car with a dark line between the views; a new sim gate starts the bot at the back
  (`--grid-back`: 24,524–25,034 ticks).
- **Not yet (waves B and C):** the scenery and landmarks, the time of day, the rally teams,
  traffic, police, speed cameras, matrix signs, road works, the full score and HUD (mini-map,
  radio ticker, warnings, clock), the countdown on the gantry, the camera fly-over intro, the radio,
  the engines and the other sounds. The seed changes nothing yet (no gameplay randomness before the
  traffic).

## Status (wave B, 2026-10-23)

Wave B (the race, §13) is built and integrated; the decisions above are unchanged. What plays now,
end to end, in 1P and 2P (and a P2 join during the race): the card → the glitch into 3D → **the
race intro** (the fold folds into a high view over the start gantry; the camera flies round the
grid and down behind the player's estate, 4 s, any button skips; `DE RINGRALLY`) → the countdown on
the start gantry's matrix signs → three laps with the time of day (16:15 → 18:30: the low sun, the
sunset, the dark with headlights, lamps, lit windows and sodium-lit tunnels), the ten sections with
their scenery and 26 landmarks, gantries, S-exit signs, hectometre boards and flitspalen → lap 1:
speed cameras and the average-speed zone → lap 2: road works at 2–3 places → lap 3: rush hour with
short jams, the spitsstrook open, the police → the finish → the results UITSLAG → the tally with
every §9 line → the glitch bridge → fps-1.

- **WORLD:** the scenery, landmarks and night lights of the ten sections (160 m cells, near and far
  levels), the road furniture and the 14 sign states, the sky with clouds and the sun, the time of
  day (`daylight`); the road, barrier and tunnel textures repainted (the lead's notes).
- **FIELD:** seven made-up rally teams (the hearse, the camper, the snack van, the limousine, the
  ice-cream van, the small saloon that also races backwards, the tiny hatchback) with their own
  handling and sizes (the physics takes each model's box, wheelbase and bumper camera); eight traffic
  types with indicators, brake and hazard lights; the traffic AI (5 / 8 / 12 cars per player window,
  lane speeds, making way, the works, the spitsstrook, jams); the rival AI (racing line, passing,
  slipstream, catch-up +3 % / −2 %, off on hard); oncoming decor traffic; the grid (1P starts 6th);
  the results.
- **RULES:** the event director, the signs director, the speed cameras, the average-speed zone, the
  red X, the road works, the police (2 / 3 / 4), the score values and the fines in euros, the full
  HUD (clock, warnings, BOETE, the flash, the mini-map, the dial), the 2P join at a safe point.
- **Lead defaults taken in wave B (integrator):**
  - the fly-over intro (4 s; only after the glitch's fold, so a sim never sees it);
  - the momentum (the bot's pace): jams of 110 m at about 60 km/h, the works' limit a little lower in
    the right lane for traffic, a deadlock breaker for traffic, the sim bot reads the red X like a
    player; the race is 26,000–29,200 ticks (7:14–8:07) and a lap 2:20–2:52 (lap 3, with rush hour
    and usually a pull-over of the bot, is the long one);
  - `PAR_SPEED` stays 46 m/s (race par 26,613 ticks): the TIME bonus rewards a race at or above the
    bot's level;
  - a sodium-orange light on the road and the cars inside the tunnels.
- **Gates:** typecheck clean; the full vitest suite; the 10 identity sims and the dormant ring's 6 + 4
  sims byte-identical; 16 rally sims complete with 0 errors and 0 recoveries, the same hash twice
  (`tmp/rally/base-b/`); the build; smoke on the CI route and the rally queries with 0 errors; on a
  real GPU a 4K split screen holds 16.7 ms frames at 3D density 4 (about 15,000 triangles in about
  260 draws for both views at the busiest point).
- **Final fixes (fixer, after the review; docs/api/rally.md B.X):** a police car ahead of its racer
  never brakes in its line; the AI keeps to the open lanes at the road works and off the hard
  shoulder under a red X (laps 1–2); a slow racer (released, spun) keeps its lane until up to speed;
  a fixed camera more than 300 m before standing works keeps the base limit, and the HUD shows the
  enforced limit (`FLITSER 100`) and the works warning from the arrow gantry; bolder, larger limit
  digits (1.7 m faces); a P2 join gets the 2P traffic; a longer, softer headlight pool; a calmer
  near asphalt. New baselines: races 26,320–29,317 ticks, 0 recoveries. Open for the lead (wave C
  POLISH): braking for the cameras still does not pay against the places (the fines are cheap).
- **Not yet (wave C):** FILE FM and its DJ, the songs, the jingles, the engines, the siren, the
  horns and the ice-cream tune (the teams carry their horn and DJ ids already).

## Status (wave C, 2026-10-23)

Wave C (sound and polish, §8, §12.6, §13) is built and integrated; the decisions above are
unchanged. The level now plays with its full sound, end to end, in 1P and 2P: the MISSION 2 card
(Gusto voices both briefing lines; the card waits for him) → the glitch (the announcer's
`MISSION TWO. VOL GAS!` as the frame freezes, the break on the shout, the crackle) → the fold and
the fly-over (FILE FM opens with its sting, FREEK FLITS welcomes the listeners) → the countdown
(the DJ counts with the beeps, GAAN on GO) → lap 1 (RONDJE RING; news on flashes and the zone) →
lap 2 (the sting, ZON OP DE ZUIDAS; the road works) → lap 3 (the sting, NACHTSPITS; the police with
the two-tone siren, the spitsstrook, jams, pull-overs) → the tunnels (the line cut by the static;
the echo) → the finish (the DJ, the sting) → the tally → the bridge (the radio, the engines and the
loops all stop at the tally). Details: docs/api/rally.md parts C, C.S, C.R and C.I.

- **PREP:** the lines table (46 DJ lines in 18 categories, Gusto's card lines, the announcer line),
  the sample group `mission:rally` (lazy; the songs stream), five additive `AudioOut` opt-ins
  (song end, streamed songs, the radio chain, the parametric engine voice, panned loops) with no-ops
  for the sims.
- **RADIO:** the pure scheduler (priorities, cooldowns, one voice at a time, an airtime cap,
  preemption, the tunnel cut, one song per lap with jingles), the director (every race moment and
  event to a line; one radio for both players; half / full static in 2P), the HUD ticker, the synth
  fallback songs and jingles. About one line every 15 s, the DJ on air 22–24 % of a race.
- **AUDIO-GEN:** the designed DJ voice `freek` (Dutch, cheerful, fast, a bit too much; never a
  clone), 46 lines, Gusto's two lines, the announcer line, 3 songs and 3 jingles of our own
  (genre-only prompts), all checked with Scribe and by measurement; 14,536 credits (cap 20,000).
- **SFX:** the engines (the estates' five-cylinder with a turbo, each team its own sound, ≤ 4
  voices, doppler and pan), tyres, scrapes, bumps, the crash, the horns (a horn per team), the Dutch
  two-tone siren, the flash, wind, the passing whoosh, the arrow truck, the ice-cream tune, the
  tunnel echo, the finish stings; the engines duck 3 dB under the DJ.
- **Lead polish (integrator):**
  - the headlight pool is a clean beam ahead in the car's lane; a view shows only the pools ahead of
    its car (no smear beside it);
  - debug F4 projects early times from each car's nominal pace (no 113-minute times);
  - the balance: on the open road a camera flashes above the limit + 10 km/h (the works keep + 3),
    so a lift for a FLITSER escapes the fine; racing flat out stays the main path (the bot 2nd–3rd)
    and braking is never required; new sim baselines `tmp/rally/base-c/` (2 of 16 changed);
  - the GL readback: none on a real GPU at 4K (0.3 ms per frame on the main thread, 16.67 ms frames,
    no stall messages); only SwiftShader logs it;
  - the boot: the race scene and its runner, physics, AI, radio and sound are a lazy chunk (the main
    chunk 872 → 785 KB); the first boot is the same (about 4.2 s on a loaded machine, as before the
    rally): the boot art dominates it.
- **The mix (measured live):** while the DJ speaks his voice is about 10 dB (median) over all the
  synth sound and about 16 dB over the song (after the dialogue duck); only the countdown beeps are
  louder, under his own count.
- **Final fixes (fixer, after the review):** the central lamps' road pools are cut into small cells
  (the affine warp spread one big quad over the lanes beside the car: now an oval on the left lanes);
  the zone's news goes through the AI filter like the cameras' (it played every lap); with no WebGL2
  the card does not load FILE FM's samples and the no-GL card releases them; the docs name the open
  road's + 10 km/h. The sims stay as `tmp/rally/base-c/`. The first boot (about 4.2–4.6 s on a loaded
  machine, budget 4.0 s) is the lead's decision. Details: docs/api/rally.md part C.X.
- **Not done:** no human play-test; the DJ's level follows the voice volume (the music volume 0
  switches the radio off); `tickerText` still spells `één` as `een` (the small font has no é); the
  sung jingle 1's words cannot be confirmed by Scribe (check by ear).
