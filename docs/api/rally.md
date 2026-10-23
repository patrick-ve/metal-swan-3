# Mission `rally` — API (BINNEN DE RING, level 2, the 3D race on the A10)

Spec: `docs/design/rally.md` (final; §0 the decisions, §12 the architecture, §13 the waves, §14 the
gates). Originality: `docs/ORIGINALITY.md` "Exception: mission `rally`".

The 2D `ring` is dormant since 2026-10-22 (`docs/design/ring.md` §1): off the route, still on
`?mission=ring`, its sims byte-identical.

## A. Wave A contracts (PREP, 2026-10-22; FROZEN)

PREP built every contract below with WORKING STUBS: the stub race plays from the MISSION 2 card to
the glitch bridge in 1P and 2P, and the CI smoke route passes through it. The builders grow the
stubs behind these names. A name below changes only when the code demands it; the change is then
ADDITIVE (a new optional field or member) and the report says so.

**Status after the wave-A integration (2026-10-23):** every stub is replaced by the builders' real
parts (GL's PS1 view, TRACK's compressed A10, DRIVE's physics, race and cameras, CARS' models) and
INTEGRATE's scenes ("A.I" below). The text of A.1–A.13 is PREP's contract; where the integration
changed or superseded it, the paragraph says so ("**Wave A:**").

### A.1 Owners after PREP (wave A)

| Owner | Files |
|---|---|
| PREP (frozen; requests go to INTEGRATE) | `src/engine/view3d.ts`; `src/engine/r3/{index,vec,mat,trig,spline}.ts`; `Renderer.surface` (render.ts, render-canvas.browser.ts, render-soft.ts); `src/game/rally/{ids,api,registry}.ts`; `src/game/content/rally/{index,mesh}.ts`, `tex/kit.ts`; the flow edits (flow-data, flow, mission-intro, boot, params, ams `next`, cards, fps-tally, mission-complete `tallyLines`, app `view3d`, main) |
| GL | `src/engine/gl3d.browser.ts` (v0 by PREP) and new `gl3d-*.browser.ts`; `tools/shot3d.ts` (v0 by PREP) |
| TRACK | `src/game/content/rally/track/` (the stub oval by PREP); new files in `src/engine/r3/` |
| DRIVE | `src/game/rally/{runner,physics,input,camera,ai,score}.ts` (stubs by PREP); `src/sim/{headless,bot}-rally.ts` (skeletons by PREP); new files in `src/game/rally/` |
| CARS | `src/game/content/rally/models/`, `src/game/content/rally/tex/` except `kit.ts` (stubs by PREP; extend the kit in new files) |
| INTEGRATE | `src/game/scenes/{rally,rally-route,rally-glitch}.ts` (skeletons by PREP) and the new `rally-fold.ts`, the HUD, the smoke branch; after the builders: every file of wave A (their requests, the docs) |

### A.2 Space and units

y up, metres, radians, metres per second, 60 Hz ticks. Yaw is a right-handed turn about +y
(counter-clockwise seen from above: **+ = a left turn**); `forward(yaw) = (sin yaw, 0, cos yaw)`.
Cameras look along forward(yaw) tilted by pitch (+ = up); roll + = the right side down. Steering
input + = left. Matrices are column-major (the WebGL layout). Model space: the nose points +z, the
wheels stand on y = 0. Mesh front faces are counter-clockwise.

### A.3 The 3D view (`src/engine/view3d.ts`, pure)

```ts
interface TexturePage { id: number; w: number; h: number /* ≤ 256 */; index: Uint8Array /* w·h palette indices */;
  clut: Uint32Array /* rows of 256 engine Colors 0xRRGGBBAA; a 4-bit texture uses entries 0..15; alpha 0 = cut out */ }
type Blend3 = 'opaque' | 'average' | 'add' | 'sub' | 'quarter';
interface Mesh3 { id: string; pos: Float32Array; uv: Float32Array /* TEXEL units, wrap at the page size */;
  rgb: Uint8Array /* 128 = the texture as painted */; nrm?: Float32Array; idx: Uint16Array | Uint32Array;
  page: number; clutRow: number; blend: Blend3; twoSided?: boolean; emissive?: boolean;
  bias?: number /* wave A, additive: a depth bias 0..16 (GL polygonOffset) for decals, shadows, plates */ }
interface DrawItem { mesh: string; m: Float32Array | null /* column-major world matrix; null = identity */; clutRow?: number }
interface Light3 { sunDir; sun; ambient; fog: Rgb3; fogNear: number; fogFar: number; skyTop; skyBottom: Rgb3 } // 0..1
interface Cam3 { pos: [x, y, z]; yaw: number; pitch: number; roll: number; fovY: number; near: number; far: number }
interface View3 { x; y; w; h /* logical px: 1P 0,0,384,216; 2P 0,0,384,108 and 0,108,384,108 */; cam: Cam3; light: Light3; items: readonly DrawItem[] }
interface Ps1Opts { snap: boolean; affine: boolean; dither: boolean; fog: boolean }  // PS1_ON: all true
interface View3d {
  readonly ok: boolean; readonly reason: string; readonly density: number;
  setDensity(d: 1 | 2 | 4): void;
  upload(meshes: readonly Mesh3[], pages: readonly TexturePage[]): void;   // same id = replaced
  release(meshIds?: readonly string[]): void;                              // none = everything
  render(views: readonly View3[], opts: Ps1Opts): unknown;                 // a canvas 384d × 216d, or null
  stats(): { tris; draws; texBytes; bufBytes; frameMs? };
  dispose(): void;
}
class NullView3d implements View3d { constructor(ok = true, reason = '') }  // node: draws nothing
```

- `NullView3d()` is OK (headless races run, logic only); `new NullView3d(false, reason)` stands
  for a device without WebGL2 (tests of the no-3D path). `render` returns null.
- **Refined by PREP:** `TexturePage.clut` holds engine `Color`s (0xRRGGBBAA, like `PixelBuffer`),
  not raw RGBA bytes; the GL layer converts on upload. `Mesh3.rgb` 128 = ×1 (255 ≈ ×2).
- **Wave A:** `Mesh3.bias?` (GL read it before the contract listed it; CARS' shadows and lamps use
  it). A CLUT entry with alpha < 0.5 is cut out (GL), so index 0 is not special.

### A.4 `Renderer.surface` (render.ts; additive, OPTIONAL member)

`surface?(src: unknown, x: number, y: number, w: number, h: number): void` — the 3D image over a
logical rectangle, screen space, nearest-neighbour, in draw order. CanvasRenderer: one
`drawImage` (logical × k); a null `src` draws the placeholder. SoftRenderer: always the
placeholder (`SURFACE_SKY` above the middle, `SURFACE_ROAD` below). Optional so that the test
renderers (tests/engine/helpers.ts, hires-subpixel.test.ts) stay valid: call it as
`r.surface?.(…)`. Nothing else in the renderers changed (off by default).

### A.5 The WebGL2 view (`src/engine/gl3d.browser.ts`, v0) and the app slot

**Wave A:** GL replaced v0 with the PS1 program (snap, affine, dither, fog, the sky gradient, the
frustum test, the blended pass back to front, the 3D governor): see "A.GL". The app slot, the
first-use feature check and the probe below stay.

- `createGl3d(): View3d` (main.ts) → `AppOptions.view3d` → `GameApp.view3d` (default
  `new NullView3d()`). The context is created on FIRST USE (reading `ok`, `setDensity`, `upload`,
  `render`): the rally card's `preloadRally` does it (the feature check). A failed context or
  shader sets `ok = false` and `reason`.
- v0: a detached canvas of 384·d × 216·d; one program: perspective-correct texturing through the
  R8 index and the CLUT row (`texelFetch`, nearest, the uv wraps at the page size; alpha < 0.5 is
  discarded), vertex colour × (ambient + sun·max(0, n·sunDir)) (no normals: 0.6; `emissive`: no
  light), a depth buffer, back faces culled unless `twoSided`, a viewport and a clear (skyBottom)
  per view, opaque meshes first, then the blended ones in list order with the era's blend
  equations. Context loss: the CPU copies are kept and re-uploaded on restore; `render` returns
  null while lost. **No PS1 traits in v0** (GL adds snap, affine, dither, fog, the sky gradient).
- The probe `window.__ms3.rally` (main.ts getter → `rallyProbe(app)`, rally-route.ts):
  `{ gl: { ok, reason }, scene, tick, raceTick, phase, lap, place, finished, players, cars, tris, draws, density }`.
- Lesson: giant polygons (a 4 km ground quad) break up on the GPU (depth and uv interpolation):
  tile big surfaces (the stub ground uses 60 m tiles).

### A.6 r3 core (`src/engine/r3/`, pure, deterministic)

```ts
// vec.ts — type Vec3 = [number, number, number]; every op writes `out` and returns it
vec3(x?, y?, z?); v3set; v3copy; v3add; v3sub; v3scale; v3addScaled(out, a, b, s); v3dot; v3cross;
v3len; v3dist; v3normalize; v3lerp
// mat.ts — type Mat4 = Float32Array | Float64Array (column-major)
mat4(); mat4Identity(out); mat4Copy; mat4Multiply(out, a, b) /* b first */; mat4Translate; mat4Scale;
mat4RotateX/Y/Z(out, a); mat4Pose(out, x, y, z, yaw); mat4PoseYPR(out, x, y, z, yaw, pitch, roll);
mat4Perspective(out, fovY, aspect, near, far); mat4View(out, cam: Cam3);
mat4TransformPoint(out: Vec3, m, x, y, z) /* affine */; mat4TransformPoint4(out4, m, x, y, z) /* clip */;
forward(out: Vec3, yaw, pitch = 0)
// trig.ts — TRIG_N = 16384 entries per turn, rounded to 1/2^20, linear steps (|err| < 2e-6)
sinT(a); cosT(a); tanT(a); atan2T(y, x) /* polynomial, |err| < 1.1e-5 rad */; wrapAngle(a) /* (−π, π] */;
angleDiff(from, to); SIN_TABLE; TAU; PI; HALF_PI
// spline.ts — closed uniform Catmull-Rom with an arc-length table
class Spline3 { constructor(points: number[] /* x,y,z flat, ≥ 3 points */, o?: { sub?: number /* 32 */ });
  length; points; tableS/X/Y/Z; wrap(s); sample(s, out?: SplineSample): SplineSample;
  nearest(x, z, hint?: number, window = 40): number }
interface SplineSample { p: Vec3; t: Vec3 /* unit tangent */; r: Vec3 /* horizontal right = forward × up */ }
splineSample(): SplineSample
```

Builders ADD files in `r3/` (mesh builders, culling, frustum, …) and never edit these five.

### A.7 The texture kit core (`src/game/content/rally/tex/kit.ts`)

```ts
PAGE_MAX = 256; CLUT_ROW = 256; CLUT_4BIT = 16; CLEAR = 0x00000000 /* a cut-out entry */
interface TexRect { x; y; w; h }
ramp(name: HdRampName, from = 0, to?): Color[]          // tones of a PAL_HD ramp
clutOf(...parts: (Color | Color[])[]): Color[]          // ≤ 256
class PageBuilder { constructor(id, w = 256, h = 256); addRow(colors): number; rowCount;
  alloc(w, h): TexRect | null /* shelf packing */; reserve(x, y, w, h): TexRect /* full-height strips that wrap */;
  set(r, x, y, i); get(r, x, y); fill(r, i); rect(r, x, y, w, h, i); line(r, x0, y0, x1, y1, i);
  noise(r, rng: Rng /* a fork */, idx: number[], weights?); text(r, s, x, y, i, size = 'small' /* the wagon font */);
  build(): TexturePage }
kitTextWidth(s, size?); pageToPixels(page, row = 0): PixelBuffer   // tools: savePNG(…)
```

`src/game/content/rally/mesh.ts` (PREP's helper): `MeshBuilder { vertex; tri; quad(a, b, c, d, uv: [u0, v0, u1, v1], col, n) /* fixes the winding along n */; box(x0, y0, z0, x1, y1, z1, uvOf(face), col, skipBottom = true); build(id, page, clutRow, { blend?, twoSided?, emissive? }): Mesh3; vertices; triangles }`.

Page ids (`PAGE_IDS`, rally/ids.ts): the track 1–99, the cars 100–199, the scenery and landmarks
200–299, the sky, lights and effects 300–399. Mesh ids: `track/…`, `car/<model>/…`, `scenery/…`,
`fx/…`.

### A.8 The race (`src/game/rally/`, pure, deterministic)

- `ids.ts`: `RALLY_ID = 'rally'`, `RALLY_LAPS = 3`, `RALLY_HZ`, `RallyCam = 'chase' | 'bumper'`,
  `RALLY_MODEL = { white: 'estate-white', green: 'estate-green', rival: 'rival', traffic: 'traffic', police: 'police' }`,
  `RALLY_EVENTS` (start, lap, place, finish, complete, flash, fine, pulledOver, overtake, nearMiss,
  tunnelIn, tunnelOut, roadworksAhead, policeActive, jam), `LEVEL2_SEED_KEY = 'route/level2-seed'`
  (`Level2Seed { mission, seed }`), `PAGE_IDS`.
- `api.ts`: `CarSpec { id, team, model, clutRow?, mass, topSpeed (m/s), accel, grip }`;
  `CarState { id, slot (−1 = AI), team, spec, pos: Vec3, yaw, speed, steer, lap, dist (m from the
  start line; < 0 on the grid), s, side (m, + = right), place, finished, finishTicks (−1), projected,
  lapTicks: number[], fines }`; `RacePhase = 'grid' | 'race' | 'finish' | 'done'`;
  `RaceState { tick, raceTick (−1 in the countdown), phase, laps, cars, order }`;
  `RallyOpts { seed, difficulty, players, lap?, cam? }`; `RallyInput { steer −127…127 (+ left),
  gas 0…127, brake 0…127, handbrake, camera, lookBack }`, `emptyRallyInput()`;
  `GridSlot { s, side }`; `RallyTrack { id, spline, length, halfWidth, lanes, laneWidth, startS,
  grid (8), parLapTicks, meshes, pages, items }` (fields may be ADDED: segments, AI lines, tunnels;
  **wave A** added the optional `bounds`, `laneSide`, `laneOffset`, `racingAt` (DRIVE) and
  `createView?(): RallyTrackView` (`{ fill(cam, aspect, far, out, from?): number; tris; draws }`, the
  per-view culler; TRACK's `TrackView`, the scene's draw));
  `RallyModel { id, meshes, pages, parts (mesh ids drawn with the car's matrix), tris }`;
  `RallyReport { seed, ticks, complete, players, difficulty, laps, places[], lapTicks[][],
  finishTicks[], fines[], score[], stateHash }` (per joined player slot).
- `registry.ts`: `defineRallyTrack({ id, build })`, `hasRallyTrack()`, `rallyTrack()` (built
  once; throws when the content is not loaded), `defineRallyModel({ id, build })`,
  `hasRallyModel(id)`, `rallyModel(id)` (built once; null when unknown), `listRallyModels()`.
- `runner.ts` — `class RallyRunner`:
  - `constructor({ ...RallyOpts, session, pads: [VirtualPad, VirtualPad], audio?, settings?, track? })`;
    the grid: the player estates first (P1 / 1P white, P2 green), then the rivals.
  - `start()` (`session.startMission('rally')`), `step()` (60 Hz; also `update()`), `finishNow()`
    (debug F4: places by the current order, projected times, a short results hold), `joinPlayer(slot,
    character)` (on the grid: the next slot; in the race: behind the last car), `report()`,
    `stateHash()`, `nextMission() → null`, `carOf(slot)`, `raceLines(slot)`, `raceStars(slot)`,
    `parTicks`, `countdown`, `phase`, `tick`, `done`, `stopLoops()`, `dispose()`.
  - Fields: `mission { id: 'rally', hostages: {} }`, `session`, `seed`, `difficulty`, `laps`,
    `startLap`, `track`, `events: EventBus<RallyRunnerEvents>`, `hud: HudState` (`hud.banner` for
    the bridge), `artDensity = 2` (the bridge's snapshot), `rng` (gameplay), `fxRng` (cosmetic),
    `race: RaceState`, `cars`, `cams: [RallyCam, RallyCam]`, `players` / `player(slot)` /
    `continueTicks` / `continuePlayer()` (the play controls; nobody is ever out).
  - Events: `start { tick }`, `lap { car, slot, lap, ticks }`, `place { car, slot, place }`,
    `finish { car, slot, place, ticks, projected }`, `complete { mission }`.
  - The stub race: `COUNTDOWN_TICKS` 180, then the laps; when every player car finished, the rest
    get projected times; `FINISH_HOLD` 180, then 'complete' (`session.completed` gets 'rally'; a
    player in 1st place gets the race's golden record — a PREP decision, RULES may change it).
    **Wave A:** DRIVE's race ("A.D"; `FINISH_HOLD` 300), plus INTEGRATE's DEBUG members (never
    used by the game's own input or the sims): `autopilot: [boolean, boolean]`,
    `setAutopilot(slot, on, pace = 0.94)` (the slot's car drives itself on the racing line) and
    `placeCar(slot, dist, speed = 0, lane?)` (a teleport `dist` m past the start line, laps
    included; the camera snaps behind) — `tools/shot3d.ts --at` uses them.
- Stubs DRIVE / FIELD replace (same entry points): `physics.ts` `stepCar(car, input, track, tmp)`
  and `PHYS`; `input.ts` `readPadInput(pad, out)` (LEFT / RIGHT steer, FIRE or UP gas, JUMP or
  DOWN brake, BOMB handbrake); `camera.ts` `rallyCam(kind, car, out: Cam3, split)`, `newCam()`,
  `FOV_FULL` 65°, `FOV_SPLIT` 38°; `ai.ts` `followLine(car, track, side, pace, out)`,
  `cornerSpeed(track, s, top)`; `score.ts` `raceLines(race, car)` (PLACE n/N by the §9 table, TIME
  m:ss.t with 50 per second under par), `raceStars(car)`, `raceClock(ticks)`, `PLACE_POINTS`.

Determinism (spec §12.4): the sim folders (`src/game/rally/`, `src/engine/r3/`,
`src/game/content/rally/`) use only + − × ÷, `Math.sqrt / floor / round / abs / min / max / trunc
/ sign / imul` and the r3 tables; a vitest scans them (tests/game/rally/contract.test.ts; a line
marked `determinism-ok` — the trig table's one-time build — is exempt).

### A.9 The content (`src/game/content/rally/`, LAZY)

`content/index.ts`: the manifest entry `rally` (one entry: `content/rally/index.ts` imports
`track/` and `models/` and registers them); `isLazyContent(id)` = `isFpsContent(id) ||
isRallyContent(id)` (the boot, the default `loadContent()` of the sims and the art worker skip it).
**Wave A:** the fps loader (`fps-intro.ts`) and the art worker load only `isFpsContent` (the rally
has no sprites); `content/rally/index.ts` registers TRACK's A10 (`buildTrack`), imports CARS'
`models/index.ts` (it registers the five models itself; PREP's box-car loop is gone) and
`sfx.ts` (the rally's synth sounds, "A.I.6").
`loadRallyContent()` (rally-route.ts) loads it once; `rallyLoadState() → { started, registered, failed }`.
PREP's wave-A stubs (the 1,043 m oval, the box cars and their pages) are gone since the wave-A fix:
`track/index.ts` `buildTrack()` builds TRACK's A10 ("A.T"), `models/index.ts` registers CARS' models
("A.C").

### A.10 Scenes and the flow

ams tally → `missionDone` (accepts `RALLY_ID`) → `MissionIntroScene('rally')` (the card;
`prepareRally` + `preloadRally`) → `RallyGlitchScene({ start, from: card })` → `RallyScene` →
'complete' → `rallyDone` → `MissionCompleteScene(rallyTally(runner))` → `afterTally` →
`GlitchBridgeScene({ from: page, runner, tallied: true })` → fps-1.

- `rally-route.ts`: `RALLY_ID`, `isRally(id)`, `prepareRally(app, { seed? }): RallyOpts`
  (`?seed=` wins, else a fresh seed; the session's difficulty; `?lap=`, `?cam=`),
  `loadRallyContent()`, `rallyLoadState()`, `rallyGl(app) → { ok, reason }` (`?gl=0` → false),
  `preloadRally(app, start)`, `startRally(app, { players?, characters?, difficulty?, seed? })`
  (`?mission=rally`: a new session and campaign, no card, → the glitch scene), `rallyTally(runner):
  NextRunner` (`tallyLines` → the race lines, `tallyStars`, footer `RALLY SEED n`),
  `recordLevel2Seed(session, seed)`, `rallyDone(app, from, runner)`, `rallyNoGlTally(session,
  seed)`, `rallyProbe(app)`. **Wave A:** `RALLY_HEADLINES { win, podium, rest, off }` and
  `rallyHeadline(bestPlace)` (spec §1.1); `rallyTally` sets `tallyHeadline` by the best joined
  player's place; the no-WebGL2 tally judges nobody (a device limit, mechanics.md §23): the
  default stars and the neutral `off` headline `RALLY CALLED OFF. THE SQUAD DRIVES ON.`
- `rally.ts` `RallyScene` (`PlayHost`): `{ start?, session? }`; `RallyScene.last` (the probe);
  the play controls (pause, lost pad, P2 join with START on a free pad or the key 2); the draw
  (§12.2): `r.begin` → `view3d.render(views, PS1_ON)` → `r.surface?.(image, 0, 0, 384, 216)` → the
  wave-A HUD (`POSITIE p/n`, `RONDE l/3`, the clock, km/h, the countdown, GO!); the density
  `densityAtRes(min(artTier(), 4), r.res)`; uploads once, releases on exit; debug F4 →
  `runner.finishNow()`; the seed in the debug overlay. `RALLY_LIGHT` (one afternoon).
- `rally-glitch.ts`: `RallyGlitchScene` (stub: black with palette blocks; waits ≥ `GLITCH_MIN` 45
  ticks for the content, at most `GLITCH_MAX_WAIT` 900, then the GL check; **wave A:** the real
  glitch, "A.I.2") and `RallyNoGlScene`
  (THIS DEVICE CANNOT SHOW 3D, the reason; PRESS START after 60 ticks, by itself after 240 → the
  tally with no race lines → the bridge).
- `mission-complete.ts` (additive): `TallyRunner.tallyLines?(slot): readonly TallyLine[]` replaces
  the bonus lines (DIFFICULTY and TOTAL follow); `TallyRunner.tallyStars?(slot)` (1–5, default 3).
  Absent = the page is unchanged (no ovation voice with own lines). **Wave A:**
  `TallyRunner.tallyHeadline?: string` (the newspaper's headline of this play; absent = the card's).
- `fps-tally.ts`: floor 1's footer `RING SEED n` = the bonus record's seed, else the
  `LEVEL2_SEED_KEY` record (the rally writes it in `rallyDone`).
- High scores: `M2` by the route (`missionNumber('rally') = 2`); the dormant ring: `RING` / `RIN`.
- Boot: `bootArt` for `?mission=rally` = the start screens and the hero; no sample group yet.

URL params (params.ts): `mission=rally`, `lap=1|2|3`, `cam=chase|bumper`, `gl=0`, plus `players`,
`seed`, `difficulty`, `art`, `debug`, `god`.

### A.11 Sim and tools

- `src/sim/headless-rally.ts`: `createHeadlessRally(o)`, `runRally(o) → RallySimReport` (the
  runner's report + `seconds`, `errors`, `warnings`, `missingSfx`, `timing`); `HeadlessRally {
  app, session, bot, scene, runner, done, ticks, step(n), runUntil(pred, max), renderFrame(),
  report(), dispose() }`; options `{ seed, players, difficulty, lap, cam, bot, view3d, clock, … }`.
- `src/sim/bot-rally.ts`: `RallyBot implements InputSource` (pads: `followLine` → LEFT / RIGHT /
  FIRE / JUMP), `side`, `pace`.
- `npm run sim -- --mission rally [--seed n] [--players 2] [--difficulty …] [--lap n]
  [--expect-complete] [--expect-ticks a-b] [--trace N]`; default `--max-ticks` 54000.
- `npm run shot3d -- [--url … | --port …] [--query …] [--size WxH] [--dpr n] [--ticks N]
  [--keys KeyZ,ArrowLeft] [--out x.png] [--gpu] [--headed]`: fails when the GL flag is down.
  **Wave A:** GL's flags ("A.GL.5") and INTEGRATE's `--at m[,m…] [--speed kmh] [--no-auto]` and
  `--until "<js>" [--freeze]` ("A.I.7"); `npm run shot -- --mission rally` points to it.
- `npm run smoke -- --query "mission=rally"` (`playRally`: the GL flag, GO, gas, steer, pause,
  the P2 join / 2P cars, with `debug=1` F4 → the tally); the CI route (`mission=ams&boss=1&debug=1`)
  goes ams → the rally card → the glitch → the race (F4) → the rally tally → the bridge → … .

### A.12 Tests

`tests/game/rally/contract.test.ts` (the API, the registry, the kit, the runner, determinism,
F4, the join, the tally hook, the flow, the no-WebGL2 path, the params, the scan),
`tests/engine/r3/{trig,mat,spline}.test.ts`. The route tests moved to `rally`: fps/flow,
ring/flow (numbering; the ring card through its own start), scenes, oldenzaal-flow, mission-ams,
ams-art. **Wave A:** the builders' tests ("A.GL.5", "A.C.5", "A.D.7", "A.T.5") and
`tests/game/rally/scene.test.ts` ("A.I.9"); the contract test now reads TRACK's A10 (no fixed mesh
id; the per-view budget is the culler's test) and runs the race to its end (60,000 ticks).

### A.13 Wave A numbers (stub)

**Superseded:** the wave-A numbers on the A10 are in "A.I.8".

`npm run sim -- --mission rally --expect-complete`: 4,502 ticks, the bot 1st (laps 1590 / 1276 /
1276), 0 errors; 2P seed 1: places 2 and 1. The view: 1P about 3,400 triangles in 9 draws, 2P
about 3,500 per view (7,000 in 20 draws for both).

## A.GL The 3D view (GL, wave A, 2026-10-23)

Owner: GL — `src/engine/gl3d.browser.ts`, `src/engine/r3/ps1.ts`, the 3D governor in `src/main.ts`,
`tools/shot3d.ts`, `tests/media/browser-3d.test.ts` (+ `tests/media/browser/gl3d-entry.ts`),
`tests/engine/r3/ps1.test.ts`. The `View3d` contract (A.3) is unchanged; everything below is
additive.

### A.GL.1 The PS1 program (`r3/ps1.ts`: the sources; `gl3d.browser.ts`: the GL)

One program (`PS1_VS`, `PS1_FS`, GLSL ES 3.00) and one sky pass (`SKY_VS`, `SKY_FS`). The four
traits, each switched by `Ps1Opts` (the game passes `PS1_ON`):

| Trait | Where | What |
|---|---|---|
| `snap` (vertex wobble) | vertex | NDC → the view's 1× grid (`uGrid` = the VIEW's logical w × h: 384 × 216, or 384 × 108 in split screen), rounded to the nearest pixel corner, × w again (the clipper and the depth stay right; vertices behind the eye are not snapped). At density d the edges are sharp but every vertex sits on a multiple of d screen px. |
| `affine` (texture warp) | both | the varyings carry `uv·k` and `k`, k = max(w, `PS1_AFFINE_NEAR` 2.5 m); the fragment divides them: screen-linear uv inside each (clipped) triangle. The near limit keeps a triangle wholly inside 2.5 m perspective-correct (and softens one that reaches into it): the bumper camera's near road smeared into streaks without it; the chase camera sees the road from about 4 m on and keeps the full warp. `Gl3dView.affineNear` = 0 gives the pure trait. Subdivide near big polygons to taste (TRACK). |
| `dither` (15-bit colour) | fragment | after the shade and the fog: `v8 = round(c·255) + DITHER[y][x]` (rows −4 0 −3 1 / 2 −2 3 −1 / −3 1 −4 0 / 3 −1 2 −2), clamp, `>> 3`, shown as `v5 / 31`. The cell is one 1× pixel, `floor(gl_FragCoord / d)`, counted from the top-left of the 384 × 216 frame (continuous across the split). Off = the full 8-bit colour, no cut. |
| `fog` (short sight) | vertex | linear on the view depth w from `fogNear` to `fogFar`, per vertex; the fragment mixes toward `Light3.fog` BEFORE the cut. |

- The texel: `texelFetch` of the R8 index (nearest, no mipmaps; uv in texels, wrapped at the page
  size) → the CLUT row (`DrawItem.clutRow ?? Mesh3.clutRow`, clamped to the page's rows). A CLUT
  entry with **alpha < 0.5 is cut out** (`discard`) — the contract's rule (A.3), so index 0 is an
  ordinary colour unless its CLUT entry is `CLEAR`.
- The light (Gouraud, per vertex): `rgb·(255/128) × (ambient + sun·max(0, n·sunDir))`; a mesh
  **without normals** uses its vertex colour as baked shading, scaled by `ambient + sun·0.6`
  (`PS1_BAKED_SUN`), so the time of day still darkens it; `emissive` meshes skip the light (the
  vertex colour alone; 128 = the CLUT colour exactly).
- The sky: per view, before the geometry, a full-viewport triangle: `skyBottom` at the horizon and
  below it → `skyTop` at an elevation of sin⁻¹(0.45) (`PS1_SKY_SPAN`), computed per 1× pixel (the
  same picture at every density), dithered. Let `Light3.fog` equal `skyBottom` for a seamless pop-in.
- **Depth bias (additive, optional):** a mesh may carry `bias` (0..16; `Mesh3 & { bias?: number }`
  until the contract lists it): `polygonOffset(−bias, −bias)` keeps it in front of a coplanar mesh.
  Needed because the vertex snap tilts a big polygon by up to half a 1× pixel, which at a grazing
  angle is metres of depth: 40–60 m ground tiles under a road 2 cm above them poke through it
  (seen in the test scene; gone with `bias: 2` on the road). Use it on the road over the ground,
  lane lines, the start line, decals (or do not lay the ground under the road).
- JS references for node tests: `ps1Dither(x, y)`, `ps1Cut(v8, x, y)` (the 5-bit level),
  `ps1Level8(v5)`, `PS1_LEVELS`, `ps1Snap(ndc, size)`, `ps1Fog(w, near, far)`.

### A.GL.2 The frame (`render(views, opts)`)

Per view: the viewport and the scissor (logical rect × d; GL's y from the bottom), a clear, the
sky, then the draw list: each item's bounding sphere (the mesh's, × the item matrix's largest
axis scale) is tested against the frustum (near, far = `cam.far`, the four sides) — culled items
cost nothing; the opaque items sorted by texture page (then two-sided, then list order) with depth
writes; then the blended items (`average` B/2 + F/2, `add` B + F, `sub` B − F, `quarter` B + F/4)
from far to near by the view depth of their sphere's centre, with depth test but no depth writes.
Depth test `LEQUAL`; back faces culled unless `twoSided` (front = counter-clockwise).

Per item: one `uModel` matrix and, when it changes, the page textures, the CLUT row, the light
flags and the cull state. Per mesh one static vertex buffer (pos | uv | nrm | rgb) and one index
buffer (16- or 32-bit), uploaded once. No allocation per frame (the sort-key arrays grow only when a
list is longer than ever before; `sortKeys` in ps1.ts is an in-place heap sort).

An upload checks every mesh (array lengths, index range, 16-bit indices for ≤ 65,536 vertices) and
every page; a bad one is skipped with a `console.warn('[gl3d] mesh "id": …')` — the browser test
asserts that every registered rally model draws with no warning and no missing page.

### A.GL.3 `Gl3dView` (what `createGl3d()` returns; extends `View3d`)

```ts
interface Gl3dView extends View3d {
  readonly frames: number;              // frames drawn so far
  readonly cap: 1 | 2 | 4;              // the 3D governor's cap (setDensity clamps to it)
  setCap(d: 1 | 2 | 4): void;
  readonly maxDensity: 1 | 2 | 4;       // the device's viewport / renderbuffer limit
  readonly canvas: HTMLCanvasElement | null;
  ps1Override: Partial<Ps1Opts> | null; // debug: wins over the scene's Ps1Opts (shot3d --ps1); null in the game
  affineNear: number;                   // the affine near limit (m), default PS1_AFFINE_NEAR 2.5
  stats(): Gl3dStats;
}
interface Gl3dStats extends View3dStats {
  frameMs: number;  // the average interval of the last 60 3D frames (a rAF interval; gaps > 250 ms skipped)
  cpuMs: number;    // the CPU time of the last render
  views: number; culled: number; missing: number /* items whose mesh or page is not uploaded */;
  cap: 1 | 2 | 4; maxDensity: 1 | 2 | 4; lost: boolean; frames: number;
}
```

- `setDensity(d)` sets `min(d, cap, maxDensity)` and resizes the canvas only on a change. The
  scene keeps calling `densityAtRes(Math.min(artTier(), 4), r.res)` every frame (rally.ts does);
  under a cap `density` stays below `d`, so the scene's `v3.density !== d` check calls
  `setDensity` each frame, which is then a cheap no-op.
- **The feature check** (on the first use): WebGL2, `MAX_TEXTURE_SIZE` ≥ 256, 2 texture units, 4
  vertex attributes, highp floats in the fragment shader, a 384 × 216 viewport (`maxDensity` from
  the limits), both programs compile and link. A failure: `ok` false, `reason` says which.
- **Context loss:** `ok` is false while lost (`reason` 'the WebGL context is lost', `stats().lost`);
  `render` returns null; `upload` and `release` keep working on the CPU copies; on
  `webglcontextrestored` the programs and every kept mesh and page are built again, then `ok` is
  true. **No exception leaves `render`** (null; 60 failures in a row set `ok` false with the reason).
- `window.__ms3.gl3d` (main.ts) is the view: `stats()`, `cap`, `ok`, `reason` for the console and
  the tools (`shot3d` prints them).

### A.GL.4 The 3D governor (main.ts, `Governor3d` in ps1.ts)

The 2D `FrameGovernor` times the CPU; the 3D view gets a frame-interval sample: on every frame
where the 3D view drew, main.ts feeds the interval since the previous 3D frame (at the end of
render + present) to `Governor3d.sample(intervalMs, now, density)`. A 2 s window averaging more
than 20 ms (`GOV3D_LIMIT_MS` 20.5) at density 4 caps the 3D view at 2 (`view3d.setCap(2)` + a `console.info`), a later one
at density 2 caps it at 1; once per session each. Gaps > 250 ms and density changes restart the
window; density 1 never counts. The 2D art tier is not touched. The 2D governor's sample now leaves
out the 3D view's own CPU time (`stats().cpuMs`) on 3D frames, so a heavy 3D frame does not drop
the whole game's art tier (nothing changes on frames without the 3D view). The 0.5 ms margin keeps
a 50 Hz display (20.0 ms a frame) from tripping.

### A.GL.5 Tools and tests

- `npm run shot3d -- [--url … | --port …] [--art 1|2|4] [--players 2] [--cam chase|bumper] [--lap n]
  [--seed n] [--size WxH] [--ticks N] [--keys KeyZ] [--ps1 affine=0,…] [--eval "<js>"] [--gpu]
  [--out x.png]`: the game; prints the probe and `gl3d` (ok, reason, cap, `stats()`); on a failure
  the probe says where it stopped. `--ps1` sets the view's debug override; `--eval` runs code in the
  page once the race is up (`--eval "__ms3.gl3d.affineNear = 0"`). Use `--port` (its own server,
  no file watching) rather than `--url` of a dev server with HMR: an edit by another agent reloads
  the page, which then waits at the boot screen.
- `npm run shot3d -- --orbit <model> [--density 4] [--ps1 snap=0,affine=0] [--out x.png]`: a
  contact sheet of a rally model from 8 angles (4 × 2 views of 96 × 108 logical px, 45° apart,
  starting at the nose; pitch −0.32) on a neutral grey; no server (the bundle of
  `tests/media/browser/gl3d-entry.ts` in a blank page).
- `npm run shot3d -- --test-scene <name> [--density 1|2|4] [--players 2] [--t n] [--ps1 …]`: the
  test scenes of that bundle (`scene` = a small road scene; `flat`, `gradient`, `fog`, `snap`,
  `affine`, `frontal`, `cull`, `blend`, `split`).
- `tests/media/browser-3d.test.ts` (14 tests, about 4 s on SwiftShader): the programs link; the
  road scene in 1P and 2P; the dither exactly as `ps1Cut` at d 1 / 2 / 4; the gradient on 15-bit
  levels; the fog; the snap (an edge moves in steps of d px); the affine warp (a steep floor
  changes, a facing quad does not, a floor inside the near limit does not unless the limit is 0);
  back faces; the depth bias; the blend modes; the split viewports; densities agree at the 1× grid;
  every rally model draws (a second bundle, `gl3d-orbit-entry.ts`, with the content: a content
  error fails that one test only); context loss and restore; no page errors. A bundle that does not
  build FAILS; only a Chromium that will not start skips.
- `tests/engine/r3/ps1.test.ts`: the dither matrix, the cut, the snap, the fog, `sortKeys`, the
  governor, the GLSL sources.

## A.C The cars (CARS, wave A, 2026-10-23)

Spec §6, §7.3, §7.4; ring decisions 13 / 13a (the estates' likeness and liveries). All art is drawn
by code; no badge on any car; made-up yellow plates; our own lettering, never mirrored.

### A.C.1 The models (`src/game/content/rally/models/`, registered at import)

| `RALLY_MODEL` id | What | Triangles (`tris`) | Far (`lod.tris`) | L × W × H (m) | Page | CLUT rows |
|---|---|---|---|---|---|---|
| `estate-white` | the boxy 1990s Swedish estate, WHITE "rozzers": the orange / yellow / orange band, `ROZZERS` on a dark-blue box (both front doors), `619` on the band behind the front arch, silver wheel covers, black roof rails, the black tubular push bar with two round spot lamps | 484 | 158 | 5.08 (push bar) × 1.76 × 1.48 | 101 | 1 |
| `estate-green` | the same estate, GREEN "safari": bottle green with camouflage, `ARTISANAL` / `GRAPE` (yellow, grape bunch) on the RIGHT side, `MAJOR` (big) / `COCKTAILS` (pink, cocktail glass) on the LEFT side, five-spoke alloys, rails, a silver roof rack, two round roof lamps, the spare tyre lying flat, a bag, a red jerrycan | 494 | 158 | 4.84 × 1.76 × 1.88 (gear) | 102 | 1 |
| `rival` | DE LAATSTE RIT: a black 1980s hearse of our own design, chrome bumpers and belt strip, curtained rear glass, a chrome landau bar on the blind rear quarter, flowers on the roof, the team name in gold on both sides and on the rear roof (it reads from behind) | 392 | 158 | 5.65 × 1.84 × 1.72 | 103 | 1 |
| `traffic` | a small 1990s hatchback of our own design, steel wheels, ten paint colours | 242 | 118 | 3.85 × 1.66 × 1.38 | 104 | 10 (`red blue silver white black yellow green teal brown orange`) |
| `police` | our own police estate (not a real force's livery or emblem): white, one dark-blue band low on the sides with a thin gold line, `POLITIE` on the sides and the tailgate, steel wheels, a roof bar with blue ends, `STOP POLITIE` (red lamps) on its back and `POLITIE` on its front | 382 | 158 | 4.84 × 1.76 × 1.58 | 105 | 1 |

`models/index.ts` defines one `RallyModelDef` per id (`RALLY_MODELS`) and registers them when it
loads (the lazy content's import).
Builders: `buildEstate(id, 'white' | 'green' | 'police')`, `buildHearse(id)`, `buildHatch(id)`.

### A.C.2 `RallyCarModel` (`models/types.ts`; every registered model; ADDITIVE to `RallyModel`)

```ts
carModelInfo(m: RallyModel | null): RallyCarModel | null        // narrows a registry model
interface RallyCarModel extends RallyModel {
  parts;        // [body, shadow, wheels] — the static draw (all with the car's matrix); `tris` counts these
  body;         // [body, shadow] — draw these + 4 spinning wheels instead of `parts`
  wheelsStatic; // 'car/<id>/wheels' (the four wheels in place, the last of `parts`)
  anchors: CarAnchors; lights: CarLightParts; lod: { parts; tris }; rows: string[]; lightTris }
interface CarAnchors { length; width; height; box: { x0 x1 y0 y1 z0 z1 } /* collision box, mirrors out */;
  wheelbase; track; wheels: WheelAnchor[4] /* FL FR RL RR */; lamps: CarLamps; bumperCam: [x, y, z] }
interface WheelAnchor { x; y; z; r; width; front; left /* +x */; mesh /* 'car/<id>/wheel-l|r' */ }
interface CarLamps { head; tail; brake; indL; indR; spots; beacons: [x, y, z][] }   // lamp centres
interface CarLightParts { head; tail; brake; indL; indR; spots?; beacons?: [a, b] }  // mesh ids
poseWheel(out, carMatrix, w: WheelAnchor, steer /* + = left, front only */, spin /* rolled m / r */): out  // no allocation
```

- Model space as A.2: the nose +z, +x the LEFT side, the wheels on y = 0. Estates: wheel centres
  x ±0.76, z +1.40 / −1.28, r 0.33 (wheelbase 2.68, track 1.52); bumper camera (0, 1.02, 1.85).
  Hearse: ±0.80, +1.75 / −1.55, r 0.34. Hatch: ±0.70, +1.20 / −1.24, r 0.29.
- **Spinning wheels** (the integrator's switch): draw `body` with the car's matrix and, per
  `anchors.wheels[i]`, `w.mesh` with `poseWheel(m, carM, w, steer, spin)` (four matrices per car,
  allocated once). Until then `parts` draws the wheels in place.
- **Lights** (wave B): the lamp meshes are emissive, blend `'add'`, depth bias 2, NOT in `parts`;
  draw them with the car's matrix when the lamp is on (`head` / `tail` at night, `brake` when braking,
  `indL` / `indR` blinking, `spots`, the police `beacons[0]` / `[1]` alternating).
- **Shadow**: `car/<id>/shadow`, blend `'sub'`, emissive, a soft rectangle (vertex colours) 4 cm
  over the road, depth bias 4 (GL's optional `Mesh3 & { bias }`).
- **Far version**: `lod.parts` (10-section body, square wheels; same page) for cars beyond about
  60 m.
- **Palette swap**: `CarSpec.clutRow` = an index of `rows` (only the traffic car has more than
  one); every slot but the three paint tones is the same in each row, so the override is safe for all
  parts.

### A.C.3 Textures (`tex/`; one 4-bit page per model)

- `CAR_TEXEL = 32` texels per metre on every car (sides about 159 × 44 texels on the estate, about
  the spec's 128 × 48); the plate decals about 2× (34 × 8 on 0.52 × 0.12 m) so the made-up text fits.
- `tex/car-palette.ts`: the 16 slots `S` (`PAINT_D PAINT PAINT_L ACC_A ACC_B ACC_C BLACK PLASTIC
  GLASS_D GLASS GLASS_L SILVER LENS RED AMBER PLATE`); `carRow(paint, accents)` (PAL_HD tones only).
- `tex/car-sheet.ts`: `CarSheet(id, frame: CarFrame, extras)` — the regions `sideL` (nose at the
  texture's left), `sideR` (nose at its right), `top` (unrolled along the top line: u from +x, v the
  arc length from the nose), `front`, `back`, `wheel`, `tread`, `plateF` / `plateB`, `solids`, extras;
  the uv mappings `sideU/V`, `topU/V`, `capU/V`, `solid(slot)`; painters in metres `paintSide`,
  `paintTop`, `paintCap`, `sideText`, `sideBox`, `sideIcon`, `topText`, `capText`, `textIn`, `plates`;
  `bayer(i, j)`.
- `tex/letters.ts`: our pixel capitals (A–Z, 0–9, `- . ! ? '`; small 3 × 5, big 4 × 6 for `MAJOR`; the
  ring wagon font's shapes where it had the letter): `paintText`, `letterWidth`, `glyphRows`.
- `tex/car-parts.ts` (rims: `cover`, `alloy`, `steel`, `chrome`; tread; spot lamp; glass),
  `tex/estate.ts`, `tex/hearse.ts`, `tex/hatch.ts` (`HATCH_COLOURS`).
- Baked shading (the era's way): a shoulder highlight, darker lower panels by a 4 × 4 ordered dither,
  the glass dark low with a diagonal streak; plus GL's Gouraud from the flat face normals.

### A.C.4 Building blocks (`models/loft.ts`, `models/shape.ts`, `models/parts.ts`)

`CarShape` (a three-box body from `ShapeParams`: the top line, the windscreen, the belt, octagonal
arches) gives `Station`s; `loft(mb, sheet, stations)` builds both sides, the top and the end caps
with the sheet's planar uv; `face`, `box`, `boxFaced`, `decal`, `wheel`, `flatWheel`, `blobShadow`,
`lampQuad`; `parts.ts`: `wells` (open black boxes behind the arches: no line of sight into the body),
`plates`, `wheelAnchors`, `wheelMeshes`, `lampMeshes`, `endUV`, `withBias`. Extra sections at the
B- and D-pillars keep the side panels short, so the affine warp stays mild on the liveries.

### A.C.5 Tests

`tests/content/rally-models.test.ts` (16): registry; budgets; valid arrays and indices; uvs inside
the page; every triangle's winding along its normal; part flags; 4-bit pages, ≤ 16 PAL_HD colours
per row; the traffic rows; deterministic builds (a hash); sizes; anchors inside the body; `poseWheel`;
the lettering found glyph by glyph (so a mirrored text fails); plates; the texel density.

## A.D Driving and the race (DRIVE, wave A, 2026-10-23)

Spec §2, §6 (handling), §7.6, §7.7, §10, §12.3–§12.5. Everything below is pure and deterministic
(§12.4: + − × ÷, `Math.sqrt / floor / ceil / round / trunc / abs / sign / min / max / imul`, `PI`,
the r3 trig tables; THE SCAN in `tests/game/rally/determinism.test.ts` enforces this whitelist and
bans `**`, `Date`, `performance`, `crypto` and timers in `src/game/rally`, `src/engine/r3` and
`src/game/content/rally`). No allocation per tick (event payloads aside; `scrape` / `bump` reuse
theirs).

### A.D.1 Additive changes to the frozen files

- `api.ts`: `CarSpec` gains OPTIONAL `power` (W/kg), `brake`, `gripFront`, `gripRear`, `fwd`,
  `length`, `width`, `wheelbase`. New types `Handling` (a resolved spec), `CarPhys` (the physics state:
  `h`, `slip`, `yawRate`, `pitch`, `roll`, `lat`, `grade`, `scrape`, `scrapeSide`, `bumpT`, `stuck`,
  `blink`, `hold`, `spin`, `draft`, `ghost`, `rev`, `gear`, the counters `scrapes`, `bumps`,
  `recoveries`, `vmax`), `RallyBody` (`id pos yaw speed steer s side dist phys`: anything that drives
  and collides), `TrackBounds { left ≤ 0, right ≥ 0 }`. `CarState extends RallyBody` and gains
  `phys`. `RallyTrack` gains OPTIONAL `bounds(s, out)` (the barrier faces; default ±`halfWidth`),
  `laneSide(i, s)`, `laneOffset(lane)`, `racingAt(s)` (TRACK's A10 has all four). `RallyInput.lookBack`
  is HELD (the camera is the pressed edge). `RallyReport` gains OPTIONAL per-player `bestLap`,
  `topKmh`, `scrapes`, `bumps`, `recoveries`.
- `ids.ts`: `RALLY_EVENTS` gains `scrape`, `bump`, `recover`.
- The engine (an ADDITIVE OPT-IN, off by default; every other mode unchanged): A.D.4.

### A.D.2 The physics (`physics.ts`)

```ts
DT = 1/60; GRAVITY = 9.81; PHYS = { roll, engineBrake, brake 11, reverse 4, reverseTop 8, handbrake, grip 10.5,
  maxLock 0.6, lockGrip 1.3, steerRate 1/12, steerReturn 1/6, speedUndersteer, powerUndersteer, handbrakeRear 0.3,
  handbrakeYaw 2, handbrakeRoom 14, scrub, slideDrag, wallBounce, wallFriction, wallScrape, wallAlign, carBounce,
  carFriction, restVel 1, spinHit, spinTicks, bumpEvent, bumpCool, creep 0.8, recoverTicks 180, recoverHold 30,
  recoverBlink 90, stuckSpeed, wrongWay, lockTicks 180, lockSpeed 0.5, lockMax 600, draftRange 30, draftWidth 1.6,
  draftGain 0.15, draftRate }
POWER_KNEE = 0.4                      // default power = accel × 0.4 × topSpeed (W/kg)
handlingOf(spec): Handling            // cached per spec object; drag = (power/top − roll) / top²
newPhys(h): CarPhys
stepBody(b, input, track, tmp, cap = Infinity): void   // = stepCar (PREP's name); tmp ends as the sample under b
lockAt(h, u); frontGrip(h, u, gas); trackBounds(track, s, out); laneSide(track, i, s); laneOf(track, side, s)
stuckStep(b, input, tmp): boolean     // true after 180 ticks the wrong way, or still while pressing gas / brake,
                                      // or locked: phys.lock ≥ 180 below half the top speed (fix, wave A)
recoverBody(b, track, side, tmp)      // back on the road at b.s: straight, standing, hold 30, blink 90
draftStep(b, bodies, n, L)            // the slipstream (same lane, ≤ 30 m, × the leader's `wake`)
class Collider { collide(bodies, n, L); hits; hitA[]; hitB[]; hitDv[] }  // 3 circles per body, impulses by mass and yaw inertia;
                                      // a contact closing below restVel (a push, a rub): no bounce, no yaw; the rear body's phys.lock += 2 (−1 per tick)
dsOf(a, b, L); yawOf(dx, dz)
```

The model (per tick): the wheel follows the input at `steerRate` (back to the centre at
`steerReturn`); the lock falls with speed so full lock asks `lockGrip` × the front grip (a key or a
stick gets the whole range); the yaw rate follows `speed · angle / wheelbase`, capped by the front
grip (understeer past it: no tighter, the tyres scrub speed); the front grip falls at high speed and,
front-wheel drive, under full gas. The world velocity is kept while the heading turns and the tyres
pull the sideways part back at the axles' grip: normal cornering does not slide; the handbrake cuts
the rear grip and lets the yaw run past the cap (the tail steps out). Drive `min(accel, power / v)`,
drag `drag·v²` (× (1 − 0.15 · draft)), rolling resistance, engine braking, the brake, reverse up to
8 m/s, gravity on the slope. The road: `track.spline.nearest`, the height and pitch of the sample, the
barriers with the body's extent at its angle (the speed into the wall removed, a little bounce,
friction along it, the car turned toward the wall's line, a scrape costs speed).

**The wave-A fix (the locked pair):** a resting contact used to add yaw every tick, so a car
pressing on another's rear quarter beside the barrier turned both noses into the barrier and they
crawled together to the finish (the race doubled in length). Now a slow contact only cancels the
closing speed, the drivers back off from a car that overlaps their side (`ai.ts`), and a car pressed
against the car ahead for 3 s below half its top speed is recovered (`CarPhys.lock`, additive).

Numbers (the estates, `tests/game/rally/physics.test.ts`): 0–100 km/h 4.4 s, 0–200 18.4 s, top
219 km/h; 100–0 in 32 m; full lock radius 9 m at 36 km/h, 365 m at 209 km/h; a handbrake turn at
90 km/h: 7 m/s of slide, yaw 1.2 rad/s, caught again within 1 s.

### A.D.3 The race (`runner.ts`), the drivers (`ai.ts`), the tables (`track-info.ts`)

- `COUNTDOWN_TICKS` 180 (a jump start creeps at `PHYS.creep`), `FINISH_HOLD` 300 (the results orbit),
  `RIVALS_1P` 7 / `RIVALS_2P` 6 (`STUB_RIVALS` = 7), `CRUISE_PACE` 0.5, `PACE` by difficulty
  (0.94 / 1 / 1.04) × each rival's own share (`RIVAL_PACE` 0.925–0.955), `ESTATE_WHITE` /
  `ESTATE_GREEN` (1500 kg, 61 m/s, front-wheel drive, 4.9 × 1.76 m), `STUB_RIVAL` (the hearse body,
  5.6 × 1.84 m) and `RIVAL_SPECS` (seven spreads of it; FIELD replaces them with the teams).
- `RallyRunner` adds: `info` (track tables), `bodies` (the cars first, then `addBody(b)` /
  `removeBody(b)` for wave B's traffic and police), `addSystem({ step(runner) })` (after the cars
  moved, before the contacts), `inputs[]` and `drivers[]` per car, `rigs` (one `CamRig` per view),
  `switchCam(slot)`, `camera(slot, out, split): boolean` (the PREFERRED camera call), events
  `scrape { car, slot, side, speed }`, `bump { a, b, slotA, slotB, dv }`, `recover { car, slot }`.
- A tick: the player cars read their race channel (`input.ts` `readRaceInput`: `pad.race` while the
  race mode is on, else the 8 buttons); the camera button switches the view, look back is held; the
  rivals (and finished cars) drive with `drive`; `stepBody`; the stuck check (and a rival that waited
  3 s behind a standing car) → `recover` in the nearest free lane; the systems; `Collider`; the
  slipstream; laps at `lap · length` m; the order (finished by time, then by distance). A finished
  car becomes a ghost and cruises in the right lane; its player's camera orbits it.
- `ai.ts`: `Driver { lane, side, pace, laneT, overtake, blockT, pullOut, racing }`, `newDriver(track,
  s, side, pace, overtake?, racing?)`, `drive(car, d, track, bodies, n, out)` (lane keeping; the car ahead in its
  corridor: pass it in a free lane (left first) above 8 m/s, or after 1 s behind a standing car; else
  follow at a time gap; a car that overlaps its side: ahead of its centre → back off 1.5 m/s below
  its speed, behind → the side line moves away from it; `laneFree` skips ghosts; the speed
  envelope at `pace`; pure pursuit), `steerTo`, `pedalsTo`,
  `followLine` and `cornerSpeed` (PREP's, kept), `AI_GRIP` 0.9, `AI_BRAKE` 0.7.
- Joins (spec §10, §0 item 20; the field stays at 8): on the grid P2 takes grid slot 2 (the rivals
  move one slot back, the last one leaves: the grid of a 2P start); during the race the last rival
  still racing leaves and P2 starts 15 m behind the last car with a blink. `CarState.lapStart` (the
  race tick its current lap started) and `CarState.partLaps` (leading partial laps: a mid-race
  join; no lap record) are additive; `score.ts` `bestLapTicks(car)`; `runner.roster` counts every
  change of `cars` (the scene rebuilds its draw list). A place past the PLACE table scores as 8th.
- `RallyOpts.gridBack?` (additive, off by default): the player estates start behind the rivals
  (`npm run sim -- --mission rally --grid-back`: the overtaking gate).
- `track-info.ts`: `trackInfo(track)` (cached: `yaw`, signed `curv`, `vc2` every `BIN` = 4 m),
  `binOf`, `yawAt`, `curvAt`, `envelope(info, s, aLat, aBrake, top)`.

### A.D.4 The race input channel (engine; an additive opt-in, both slots)

- `src/engine/race-input.ts` (new): `RaceInput { steer −127…127 (+ left), gas, brake 0…127,
  handbrake, camera (edge), lookBack (held) }`, `RaceAxes { steer, gas, brake, buttons }`,
  `RACE_BIT { handbrake 1, camera 2, lookBack 4 }`, `RACE_MAX`, `newRaceInput`, `clearRaceInput`,
  `newRaceAxes`, `clearRaceAxes`, `mergeRaceAxes` (largest steer, max pedals, OR buttons),
  `raceFromPad(mask, axes, prevButtons, out)`, `RACE_KEYS` (solo: camera `KeyV`, look back `KeyB`;
  p1: `KeyR` / `KeyT`; p2: `Quote`, `Numpad4` / `Semicolon`, `Numpad5`), `RACE_PAD` (RT 7 gas, LT 6
  brake, Y 3 camera, LB 4 look back, RB 5 handbrake), `stickSteer(x)` (dead zone 0.12, a soft
  centre), `triggerValue(v)`.
- `input.ts`: `InputManager.raceMode = false` (THE OPT-IN); `VirtualPad.race` + `raceOn`;
  `InputContext.raceMode?`; `InputSource.readRace?(slot, out, ctx)`; `ScriptedActions.race?(tick,
  out)` (a `ScriptedSource` with analog race axes). With the mode off nothing runs (the pads, the
  sims and every other mode are byte-identical).
- `pads.ts`: `PadSource.readRace` (race mode only: the left stick, the triggers, the race buttons;
  1 player: every pad drives slot 0; 2 players: each slot its own pad).
- `input.browser.ts`: `KeyboardSource.readRace` (the race keys of the slot's key set).
- The 8 buttons always count (through the `VirtualPad`, so `suppress` still hides a held button): an
  analog steer wins over LEFT / RIGHT; gas and brake take the larger of the button and the trigger.

### A.D.5 The cameras (`camera.ts`)

`FOV_FULL` 65°, `FOV_SPLIT` 38° (the same horizontal view in 384 × 108), `CAM` (the tuning),
`newCam()`, `CamRig`, `newRig()`, `stepRig(rig, car, info, lookBack, orbit)` (every race tick, in
the runner), `bindRig(car, rig)` / `rigOf(car)`, `rallyCam(kind, car, out, split, rig = rigOf(car))`
(PREP's entry point; the rig bound by the runner is found by itself). Chase: the position rigid to
the car (6.3–7.6 m behind, 2.3–2.55 m up, −0.12 rad); the heading on a critically damped spring
(6.5 rad/s, the lag capped at 0.45 rad, 75 % of the steady lag in a bend fed forward), half the slip
angle, a look-ahead of 0.25 × the track's turn 20 + 0.6·v m ahead (≤ 0.12 rad); +5° of field of view
at top speed. A split view: the chase camera `CAM.splitDist` 0.6 m further back and `CAM.splitPitch`
0.08 rad more down (the whole car and its shadow in the 384 × 108 view). Bumper: 0.2 m inside the nose, 0.85 m up, rigid. Look back: the chase camera in front
looking back; the bumper camera at the rear. The results orbit: radius 8.5 m, 2.6 m up, 0.011 rad
per tick, from where the chase camera was.

### A.D.6 The bot and the sim

- `src/sim/bot-rally.ts`: `RallyBot(runner)` — `pace` (0.94), `racing` (true: the track's racing
  line when it is not passing), `slots` ([true, true]); per tick (`update`) a `Driver` per slot;
  `readRace` (analog steer, gas, brake) in race mode, else `read` (the 8 buttons).
- `src/sim/headless-rally.ts`: options add `botPace`, `raceMode` (default true: the bot drives
  through the race channel), `gridBack` (the bot starts behind the rivals). `npm run sim -- --mission rally` prints best laps, the top speed,
  scrapes, bumps and recoveries too.
- Measured on TRACK's A10 (6,801 m), seeds 1–3: 1P 24,094 ticks at easy, normal and hard (laps
  8,114 / 7,750 / 7,750, about 2:09; places 1 / 1 / 2); 2P 24,190–24,195 (places 1 2 / 1 2 / 2 4);
  `--lap 2` 16,344, `--lap 3` 8,594; top 208 km/h; 0 scrapes, bumps, recoveries; about 0.02 ms per
  tick with the scene. The seed changes nothing yet (wave B's traffic and events use it).

### A.D.7 Tests

`tests/game/rally/{physics,race,input,camera,bot,determinism}.test.ts` (on the test tracks of
`helpers.ts`: an A10-sized loop, an oval, an 8 km straight; no content needed) and
`tests/sim/rally-sim.test.ts` (the real content: 1P / 2P at every difficulty in 23,000–31,000 ticks,
the same seed twice, drawing never changes the hash, the race channel).

## A.T The track (TRACK, wave A, 2026-10-23)

The compressed A10: THE TABLE of ten sections, laid out into a closed spline, cut into segments of
about 20 m with their meshes, culling units and a near / far level of detail. Files:
`src/game/content/rally/track/` (`table.ts`, `layout.ts`, `geometry.ts`, `tex-road.ts`,
`ai-lines.ts`, `view.ts`, `types.ts`, `index.ts`), `src/engine/r3/road.ts`, `src/engine/r3/cull.ts`,
`tools/rally-map.ts` (`npm run rally-map`). Everything is pure and deterministic (the §12.4 rules).

### A.T.1 THE TABLE (`table.ts`) and the layout (`layout.ts`)

- `A10_TABLE: SectionSpec[]`, clockwise from the Zuidas: ZUIDAS (start / finish at 190 m: `A10_FINISH_AT`),
  NIEUWE MEER (the Schinkel bridge, the long right-hander north), RING WEST (the average-speed
  zone), SLOTERDIJK, COENTUNNEL, NOORD (the big right-hander east, the canal bridge), ZEEBURGERTUNNEL,
  OOST, AMSTEL (the Amstel bridge), RAI. A rough likeness, not to scale: about 1.9 × 2.0 km.
- A section: `elems` (`S(len, close?)` straights, `B(turn°, r, t)` bends: + = left, minimum radius
  r, transition curves of t m at each end; length |turn|·r + t), and offsets in design metres from
  its start: `tunnel { name, from, to, ramp, depth, water }`, `decks [{ name, kind, from, to,
  height, ramp }]`, `gantries`, `cameras`, `avg`, `roadworks`, `spits`, `noise`, `exits` (the S-codes
  and names of the 2D ring), `landmarks` (generic ids, a side offset).
- `layoutTrack(table, yaw0, bumpsOf) → Layout { length, sectionD, gap, closeDx, closeDz,
  heading(d), curvature(d), position(d, out), height(d) }`: an exact heading, Simpson positions on
  the r3 tables, the loop closed by stretching the two `close` straights ('x' Zuid, 'z' West; a 2 × 2
  solve; |change| < 60 m). The bends must sum to −360°. Elevation: smoothstep bumps (tubes −8 m,
  decks +6 m, ramps 110–150 m).
- The spline: control points every ~10 m of the layout (`Spline3`, `sub` 4); s ↔ d through them.

### A.T.2 `buildTrack(): RallyTrack` / `buildA10(table, { props? }): A10Track` (`index.ts`, `types.ts`)

The `RallyTrack` contract (id `'a10'`, `halfWidth` 7.5, `lanes` 3, `laneWidth` 3.5, `startS`,
`grid` (8 slots, 6 m behind the line, rows 8 m, the right column 4 m back, sides −3.75 / +0.75),
`parLapTicks` (L / 46 m/s), `meshes`, `pages` (one), `items`) plus DRIVE's optional `bounds(s, out)`
(±7.5) and `laneSide(i, s)`, plus the ADDED `A10Track` fields:

```ts
sections: { id, name, s0, s1 }[]            segments: TrackSegment[]   chunks: TrackChunk[]   cull: CullSet
sample(s, out?: TrackSample): TrackSample   // pos, fwd, right, up (orthonormal), width, lanes, flags (TF), section, curv
laneOffset(lane)                            // 0..2 the lanes (−5, −1.5, +2), 3 the shoulder / spitsstrook (+5.375)
flagsAt(s); sectionAt(s); racingAt(s); curvAt(s)   // 5 m tables, no allocation
aiLines: { step: 5, count, racing: Float64Array, curv: Float64Array, lanes }
finish { s, section }; gantries { s, kind: 'start'|'matrix'|'avg-start'|'avg-end'|'exit', section }[]
cameras { s, side, limit, section }[]; avgZone { s0, s1, limit }; roadworks { s0, s1, closed, limit, section }[]
spits { s0, s1 }[]; tunnels { name, s0, s1, ramp0, ramp1 }[]; bridges { name, kind, s0, s1 }[]
exits { code, name, s, section }[]; landmarks { id, s, side, section }[]
createView(): TrackCuller                   // one per view (below)
closure; trisTotal
```

- `TF` flags: `tunnel`, `cutting` (a ramp below the ground), `bridge`, `viaduct`, `noise`, `avgZone`,
  `spits`, `roadworks`, `exit` (block marks, 200 m before an S-exit), `water` (over a tube), `raised`.
- The cross-section (x m right of the centre line): ours −7.5 … +7.5 (a 0.75 m strip, three lanes
  of 3.5 m, a 3.25 m hard shoulder, 0.5 m); the central barrier −8.1 … −7.5; the oncoming carriageway
  −23.1 … −8.1 (mirrored); guard rails; on each side a verge, the slope (an embankment when raised),
  a ditch with water, a textured field to 52 m, then flat far fields to the fog (`chunks`, 8
  segments each, narrowed inside tight bends; they start 8 m under the near field, 4 cm lower, so
  the T-junction seams with the vertex snap show no sky). Lowered: a kerb and a retaining wall up to the ground.
  Tubes: tiled walls, a ceiling, two rows of sodium lamps (an `emissive` interior mesh), portals, a
  lid of ground or water. Decks: parapets, piers every 40 m, water or ground below, caps where the
  embankment ends. Placeholder gantries (posts, a beam, dark matrix signs or a blue direction
  sign), flitspalen (a pole and a grey box), the start chequer and the grid boxes (decals); wave B
  leaves them out with `buildA10(A10_TABLE, { props: false })` when it dresses them itself.
- Meshes: `track/seg/NNN` (near: rows ≤ 7 m, our road in 4 pieces of 3.75 m), `track/seg/NNN/far`
  (one row per segment, the same pieces across: no cracks), `…/in` and `…/in/far` (tube interiors),
  `track/far/NN` (far chunks). `items` holds one complete set (near + interiors + chunks) for a view
  without culling; every mesh is uploaded.

### A.T.3 Culling and the budget (`view.ts`, `r3/cull.ts`)

- `track.createView(): TrackCuller` (`TrackView`): `fill(cam: Cam3, aspect, far, out: DrawItem[],
  from = 0): number` writes the visible track items (sphere within `far`, then the frustum, then the
  8-point hull; nearest first) into `out` from `from`, sets `out.length`, returns the count; the
  segments within `LOD_NEAR` (130 m) use the near meshes. `tris`, `draws`, `units`, `nearUnits` hold
  the last fill. No allocation per frame when `out` is reused.
- Measured along the whole lap (a chase camera every 10 m, fog end 420 m): at most about 3,050
  track triangles (average about 2,450) and 45 draws per view, 1P and 2P (budget `TRACK_TRI_BUDGET`
  4,000).
- `r3/cull.ts`: `Frustum.set(cam, aspect, far?)` (the planes of mat4Perspective · mat4View),
  `sphere(x, y, z, r)`, `points(pts, off, n)`; `CullSet(count, withHull)` with `setSphere`,
  `setBox(i, x, y, z, a, b, c)` (an oriented box) and `cull(fr, x, y, z, maxDist) → n` (`out[0..n)`
  near → far).
- `r3/road.ts`: `MeshAcc` (`vertex`, `tri`, `quadIdx`, `quad`, `fan`, `obox`, `toMesh(id, page,
  clutRow, { blend, twoSided, emissive })`, bounds), `CrossEdge` / `crossEdge(x0, y0, x1, y1, u0,
  u1, vScale, vOff, across, col)` (x = lateral, y = ABSOLUTE height; the front is on the left of the
  edge's direction), `RoadRow`, `rowsFor(length, maxAlong)`, `extrude(acc, rows, prof, sRef)` (UVs in
  texels; `across` pieces; degenerate edges left out).

### A.T.4 The texture page (`tex-road.ts`, page id 1)

One 256 × 256 page; every texture uses one 16-colour bank of CLUT row 0 (bank b = entries 16b …),
all PAL_HD. Full-height strips (v wraps along the road, 4 texels per metre): `road` and `roadBlock`
(48 wide, 3.2 texels per metre across; cool greys only, mostly one tone; lane dashes two texels
wide, 4 m on 12 m off; block marks 1 m on 3 m off),
`concrete`, `grass`, `tiles`, `rail` (cut out), `lamp` (cut out), `earth`, `water`, `noise`,
`steel` (rows 128+: 8 × 8 flat swatches, `swatch(name)`: far, white, dark, sign, grey, red, water,
black, amber, blue, green, yellow).

### A.T.5 Tools and tests

- `npm run rally-map -- [--out tmp/rally-map.png] [--scale 0.5] [--page tmp/rally-page.png]`: the
  top-down map (sections, tunnels, decks, embankments, the racing line, gantries, cameras, the
  average-speed zone, road works, the spitsstrook, S-exits, landmarks, the grid) and the elevation
  profile; `--page` the texture page. Prints a JSON summary.
- `tests/content/rally-track.test.ts` (the closure, the length, the curves, the frames, the lanes,
  the flags per section, valid and front-facing meshes, a pinned hash, the per-view budget along the
  lap, the culling order, the subdivision of the road, the grid and the finish, the page banks, the
  AI lines, the registry) and `tests/content/rally-track-r3.test.ts` (road.ts, cull.ts).
- Numbers: 6,801 m, 340 segments, 43 far chunks, 773 meshes, about 80,000 triangles in all (both levels); the
  build takes about 60 ms. DRIVE's bot laps it in about 2:10 (24,233 ticks for three laps).

## A.I The integration (INTEGRATE, wave A, 2026-10-23)

The race plays end to end with the real parts: the MISSION 2 card → the glitch into 3D → the race
on TRACK's A10 in GL's PS1 view with DRIVE's physics and cameras and CARS' estates (1P white; 2P
white on top, green below) and the hearse rivals → the countdown, three laps, the finish, the
results → the tally (PLACE, TIME) → the glitch bridge → fps-1. Traffic, police, the time of day,
the teams, the full HUD and the radio are waves B and C.

### A.I.1 The flow

ams tally → `MissionIntroScene('rally')` (`prepareRally`; `preloadRally`: the lazy content and the
GL context) → `RallyGlitchScene({ start, from: card })` (hold → break → the mosaic) →
`RallyScene({ start, fold: the mosaic })` (the fold, then the countdown) → the race → 'finish'
(the results, `FINISH_HOLD` 300) → 'complete' → `rallyDone` → `MissionCompleteScene(rallyTally)` →
`GlitchBridgeScene({ from: page, tallied: true })` → fps-1. A direct `?mission=rally` starts at
the glitch scene (its picture: MISSION 2 / BINNEN DE RING on black). `?gl=0`, no WebGL2, a failed
content load, or a context lost for 5 s → `RallyNoGlScene` → the tally with no race lines (a
neutral headline, the default stars) → the bridge. The card shows the GL reason in neutral words
(the program is named "the 3D shader": no console name in game text, spec §11).

### A.I.2 The glitch into 3D (`rally-glitch.ts`, spec §1.2)

- `RallyGlitchScene { app, start, from, work: PixelBuffer, phase: 'hold' | 'break' | 'gone' }`. The
  constructor draws the card once into a private `SoftRenderer` at density 2 (`work`, 768 × 432);
  the damage accumulates in it (no allocation per tick; its own `Rng` from the race seed, never the
  race's).
- `hold` (≥ `HOLD_MIN` 8 ticks, until `rallyLoadState()` is registered or failed, at most
  `GLITCH_MAX_WAIT` 900): the frozen card, a small row twitch every 24 ticks.
- `break` (`BREAK_TICKS` 36): until `MOSAIC_AT` 22 the bridge's recipe, harder — 8 × 8 blocks
  copied, row bands shifted, a band one shade off (HD ramps), the `rally/glitch` crackle every 7–16
  ticks; then the mosaic: each `FOLD_TILE` tile of the fold's grid turns into its average colour at
  its own tick, all of them on the last tick.
- Then the GL check (`rallyGl`) → `RallyScene({ start, fold: work })` or `RallyNoGlScene`.
  `GLITCH_MIN` = `HOLD_MIN + BREAK_TICKS` (44 ticks, about 0.7 s).

### A.I.3 The fold (`rally-fold.ts`, pure)

- `FOLD_TILE` 16 px, `FOLD_TICKS` 54, `FOLD_PLANE` 1 m, `FOLD_PAGE` = `PAGE_IDS.fx` (300).
- `foldViews(players)` (the view rectangles), `foldTiles(players): FoldTile[]` (`{ view, x, y, w,
  h }`, per view from its corner, the last ones clipped; 1P 336 tiles, 2P 2 × 168),
  `tileColour(pic, tile)` (the average, any density).
- `class RallyFold { tiles, meshes, page, meshIds; constructor(pic, players); fill(t, view, cam, w,
  h, out, from, v3?): number; done(t) }`: the tiles as emissive two-sided quads on one page (four
  texels per tile: its colour at four shades; a CLUT row holds 64 tiles), batched into one DYNAMIC
  mesh per view and CLUT row (`fold/<view>/<row>`, at most 7: about 45 draws in all during the fold
  instead of 375, §7.3). `fill` writes the quads' world-space corners and their shade's texel in
  place and sends them with `v3.updateMesh(id)`; a finished tile is a degenerate quad. At tick 0 each tile covers its own
  rectangle of the picture on a plane 1 m in front of its view's camera; after its delay (a sweep
  from the bottom middle up, plus a hash jitter) it slides along its own view ray (a tile above the
  horizon drops onto the road 40 m ahead), tips forward until it lies flat on the ground, lighting
  one shade toward the race's haze per quarter turn, and is gone. `fill` allocates nothing.
- The 3D view's additive opt-in for it: `Mesh3.dynamic?` and `View3d.updateMesh?(id)` (GL:
  `bufferSubData` of `pos` and `uv`, the bounding sphere refitted; `NullView3d`: a no-op).

### A.I.4 `RallyScene` (`rally.ts`)

- `new RallyScene(app, { start?, session?, fold? })`; `folding` (the fold runs: the race does not
  step, the player cameras settle with `stepRig`, cosmetic); a P2 join during the fold ends it.
- `enter`: `input.raceMode = true` (also in `resume`; off in `exit`), the runner, 'complete' →
  `rallyDone`, 'start' → `rally/go`, debug F4 → `finishNow()`. Countdown beeps `rally/count` on 3, 2, 1.
- The draw, per player view: `runner.camera(slot, view.cam, split)`; the track through one
  `track.createView()` culler per view (`fill(cam, w / h, light.fogFar, list, 0)`); then every car
  within the fog: near (≤ `CAR_LOD_M` 60 m) `RallyCarModel.body` + its four wheels
  (`poseWheel(m, carM, w, front ? steer · lockAt(h, v) : 0, dist / r)`) + the brake lamps when its
  brake input ≥ 16 and it moves; far: `lod.parts`; a car in its recovery blink is hidden every
  other 4 ticks (`phys.blink`); the car matrix `mat4PoseYPR(pos, yaw, phys.pitch, phys.roll)`;
  then the fold's tiles. One list per view, reused (no allocation per frame after the first). In
  split screen a 1 px dark line divides the views.
- The density `densityAtRes(min(artTier(), 4), r.res)` (GL clamps it to its cap: the 3D governor).
- A lost context (`view3d.ok` false): the race waits and the screen says THE 3D VIEW WAS LOST;
  back within `GL_LOST_TICKS` 300 the race goes on (GL re-uploads everything), else
  `RallyNoGlScene` (spec §12.2).
- `pauseExtra(): PauseExtra` — the pause menu's item after RESUME, `CAMERA: CHASE` /
  `CAMERA: BUMPER` (both views switch; in the race each player also has the race channel's camera
  button). `PauseHost.pauseExtra?` / `PauseExtra { label; act() }` are an additive opt-in of
  pause.ts (absent: the menu is unchanged).
- Memory: no dense art run lives during the race (GameplayScene's exit stopped ams' tier-4 set),
  so there is nothing to reserve through `denseReserve`; the GL holds about 0.2 MB of pages and
  4.5 MB of buffers (`stats().texBytes`, `bufBytes`).

### A.I.5 The HUD (2D, the game's font, Dutch labels; readable at 1×)

- 1P: top left `POSITIE` and the place `n/8` (big, the player colour), `RONDE n/3`; top right
  `RONDETIJD` and the lap time (big; `TOTAAL` and the race time once finished), `BESTE RONDE m:ss.t`
  after a lap; bottom right the speed (big, gold) and `KM/H`. The countdown `3`, `2`, `1` and `GO!`
  (big × 3). `FINISH! nE` while the other player still races.
- 2P (each 384 × 108): `P1` / `P2` (the player colour) `POSITIE n/8`, `RONDE n/3`; the lap time
  and `BESTE m:ss.t` top right; `nnn KM/H` bottom right; the countdown big × 2 in each view.
- The results (phase 'finish'): a dark panel with `UITSLAG` and the standings (place, team, time;
  the players in their colours, projected times in grey) while the camera circles the estate.
- The HUD shows once the fold is 60 % done.

### A.I.6 Sounds (`content/rally/sfx.ts`, lazy, synth only)

`rally/glitch` (bit-crushed static with a falling chirp), `rally/fold` (a rising swept whoosh, a
low swell, a thump), `rally/count`, `rally/go`. Registered with the lazy content; the scenes check
`hasSfx` first.

### A.I.7 Tools

- `npm run shot3d -- --at <m>[,<m>…] [--speed 150] [--no-auto]`: after GO, player 1's car (P2
  10 m behind) is put `m` metres past the start line at the speed with the debug autopilot, and a
  capture is taken `--ticks` later (one per distance: `-<m>.png`). `--until "<js>" [--freeze]`:
  capture when a page expression holds (with `--freeze` the scene updates stop at that moment: the
  glitch and the fold frame by frame). The page is clicked until the boot screen is gone.
- `npm run smoke -- --query "mission=rally&gl=0"`: the no-WebGL2 path (the card, the GL flag
  down, the tally, the bridge). The CI route shoots `rally-glitch` after the card.
- `npm run shot -- --mission rally` prints the `shot3d` command (node cannot draw WebGL2).

### A.I.8 Numbers (2026-10-23)

| Sim (`--expect-complete`) | Ticks | Places | stateHash |
|---|---|---|---|
| seeds 1, 2, 3 (normal) | 24,094 | 1 | 716585496 |
| 2P seed 1 | 24,195 | 1, 2 | 1108275714 |
| easy seed 1 | 24,094 | 1 | 1370001541 |
| hard seed 1 | 24,094 | 2 | 448174481 |
| 2P easy / hard seed 1 | 24,190 / 24,193 | 1, 2 / 2, 3 | 1880225268 / 1979026086 |
| `--grid-back` normal / easy / hard seed 1 | 24,655 / 25,034 / 24,524 | 4 / 1 / 7 | 2708962887 / 3211054485 / 666070240 |
| `--grid-back` 2P seed 1 | 24,694 | 3, 4 | 1011488432 |

(After the wave-A fix the 2P and hard hashes changed: rival–rival rubs no longer add yaw. Ticks
and places of the pole-start sims are unchanged. Before the fix a bot from the back locked with a
rival at the central barrier and both crawled to the finish at about 50,900 ticks.)

The same hash on a second run; the seed changes nothing yet (no gameplay randomness before wave
B's traffic). Baselines: `tmp/rally/base-a/`. A tick takes about 0.007 ms. The view: 1P about
3,000 triangles in 35–45 draws; 2P about 6,400–6,700 in 85–100 draws for both views.

### A.I.9 Tests

`tests/game/rally/scene.test.ts`: the fold's tile grid and `RallyFold`, the glitch phases and
the mosaic, the fold before the countdown, the HUD texts (1P, 2P), the pause item, the results, a
lost context (wait, resume, the no-WebGL2 path), the headline by place, the debug teleport and
autopilot, and that the fold and the drawing never change the state hash.
