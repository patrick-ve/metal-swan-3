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
0.08 rad more down (the whole car and its shadow in the 384 × 108 view). Bumper: 0.2 m inside the nose, 0.85 m up, rigid
(wave B, integrator: the model's own eye `bodyShape(h).cam` — forward `cam[2]`, up `cam[1]` — when the
physics has the model's shape; the look-back keeps `halfLen − bumperIn`). Look back: the chase camera in front
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

## B. Wave B contracts (PREP, 2026-10-23; FROZEN)

PREP built every contract below with WORKING STUBS: the start gantry counts down on its matrix
signs, the sky darkens over the laps, one traffic car drives, every speed camera fines a car above
its limit (the HUD shows `FLITSER` before it, the white flash and `BOETE EUR n` after it), and the
tally shows every line of spec §9. The builders grow the stubs behind these names. A name below
changes only when the code demands it; the change is then ADDITIVE and the report says so.

The wave-B parts live in the LAZY content (`src/game/content/rally/**`, lead note 6): they register
with the plug-in registries of `registry.ts` (B.6) at import, and the runner and the scene (static,
the main chunk) find them there. The 10 identity sims and the dormant ring stay byte-identical; the
rally sims change in wave B (the integrator writes new baselines).

### B.0 Owners (wave B)

| Owner | Files |
|---|---|
| PREP (frozen; requests go to the integrator) | `src/game/rally/{daylight,signs}.ts` (the API; `DAY_KEYS` values are WORLD's), the wave-B parts of `ids.ts`, `api.ts`, `score.ts` (the API; the values are RULES'), `registry.ts`; the hooks in `runner.ts` (B.7) and `scenes/rally.ts` (B.8); `tests/game/rally/contract-b.test.ts`; this part B |
| WORLD | `content/rally/sections/`, `content/rally/props/` (the stub sign faces), new `content/rally/{sky,lights,…}/` files; the `DAY_KEYS` values; the road page `track/tex-road.ts` (lead note 2a: keep the page layout and the UV contract) |
| FIELD | `content/rally/teams/`, `content/rally/traffic/`; `rally/physics.ts` (lead note 3: the models' anchors) and `rally/ai.ts` (the rival AI); the oncoming decor traffic (a scenery part) |
| RULES | `content/rally/rules/` (the director, cameras, the zone, the red X, road works, police, the HUD part); the values in `score.ts`; the 2P join (`runner.joinPlayer`) |

### B.1 The time of day (`src/game/rally/daylight.ts`, pure)

```ts
interface Daylight { progress; clock /* minutes after midnight */; night /* 0..1 */; readonly light: Light3;
  lampGlow /* 0..1 */; carLights: boolean }
interface DayKey { at /* laps */; sunDir; sun; ambient; fog; fogNear; fogFar; skyTop; skyBottom }
CLOCK_START = 975 /* 16:15 */; CLOCK_PER_LAP = 45; CAR_LIGHTS_AT = 0.3
DAY_KEYS: readonly DayKey[]                       // PREP's stub: 0 afternoon, 1 sunset, 2 dark, 3 night (WORLD fills)
newDaylight(): Daylight
daylight(progress, out = newDaylight(), keys = DAY_KEYS): Daylight   // writes out in place
raceProgress(race, length): number                // the leading PLAYER's dist / length, 0..laps
clockText(minutes): string                        // '16:15'
```

- `progress` is the race progress of the LEADING PLAYER in laps (0 … 3, continuous; a `?lap=2`
  race starts at about 1). The clock: 16:15 at 0, 17:00 at 1, 17:45 at 2, 18:30 at 3.
- The keys blend with a smoothstep between neighbours (no steps). `night` rises from 0.6 to 2 laps,
  `lampGlow` from 0.8 to 1.6 laps; `carLights` = `night ≥ 0.3` (during lap 2).
- The fog colour equals `skyBottom` (a seamless pop-in). The scene culls at `light.fogFar`.
- ONE world time for both views: the scene computes it once per frame (`RallyScene.day`) and gives
  every view `day.light`. Cosmetic: the sim never reads it.

### B.2 The matrix signs (`src/game/rally/signs.ts`, pure)

```ts
SIGN_STATES = ['blank', 'limit-50', 'limit-70', 'limit-80', 'limit-100', 'x', 'arrow-down',
  'merge-left', 'merge-right', 'end', 'count-3', 'count-2', 'count-1', 'go']; type SignState
SIGN_LANES = 4 /* lanes 0..2 (0 = the left lane) + 3 the hard shoulder */; SIGN_SHOULDER = 3
class SignTable { constructor(gantries); count; codes: Uint8Array; version /* +1 per change */;
  sign(g, lane): SignState; setSign(g, lane, state): boolean /* changed */; setGantry(g, state, lanes = 4); clear() }
signCode(state); signOf(code); signLimit(state) /* km/h or 0 */
gantriesOf(track); startGantry(track) /* −1 on a test track */
countdownSign(left, raceTick); GO_SIGN_TICKS = 180   // count-3 → count-2 → count-1 → go (180 ticks) → blank
```

- A gantry's id is its index in `A10Track.gantries` (17 on the A10: 'start', 'matrix',
  'avg-start', 'avg-end', 'exit'; the 'exit' ones carry a blue direction sign, no matrix). The
  start gantry has three signs (no shoulder sign).
- The runner makes the table: `runner.signs` = `race.signs` (`RaceState.signs?`, additive). RULES
  sets the states (`race.signs.setSign(g, lane, state)`); WORLD draws them (B.6 scenery: an
  emissive face per state, our own pixel symbols in the Dutch matrix style) and may compare
  `version` to skip work.
- PREP's stubs: RULES' stub system drives the start gantry's countdown (`countdownSign`); the props
  stub (`content/rally/props/index.ts`, `buildSignFaces`, page `PAGE_IDS.signs` 301, meshes
  `fx/sign/<state>`) draws a 1.5 m face in front of TRACK's dark placeholder sign (5.55 m up, not in
  tunnels). WORLD replaces both the faces and the gantries.

### B.3 Bodies (`ids.ts`, `api.ts`; DRIVE's body API of wave A)

```ts
BODY_KINDS = ['player', 'rival', 'traffic', 'police', 'prop']; type BodyKind
BODY_LIGHT = { head 1, tail 2, brake 4, left 8, right 16, hazard 32, blue 64 }
interface RallyBody { …wave A…; kind?: BodyKind; model?: string; clutRow?: number; lights?: number; hidden?: boolean }
```

- FIELD (traffic) and RULES (police, road-works trucks and barriers) add bodies with
  `runner.addBody(b)` (once; a POOL is preferred: park a body with `hidden = true` and
  `phys.ghost = true` instead of removing it) and drive them in a system (B.6) with
  `drive(...)` + `stepBody(...)` (a standing prop needs no step). `addBody` / `removeBody` now bump
  `runner.roster` (the scene rebuilds its draw list), so pool, do not churn.
- The race cars have no `kind`: the scene reads `slot` ('player' ≥ 0, else 'rival').
- `model` (a registered `RallyModel` id) and `clutRow` (a palette swap) are what the scene draws; a
  pooled body may change them (the scene rebuilds that body's items, an allocation only then).
- `lights`: the owner sets brake, the indicators (blinking is the drawer's: on in the first half
  of every 40 ticks), hazard and blue; head and tail at night come from `day.carLights` (the
  drawer ORs them in). The scene draws the brake lamp of a near body with `BODY_LIGHT.brake`;
  WORLD's night lights draw the glows of every car and body.
- Collisions, the slipstream and `laneFree` already treat every body alike (DRIVE); `ghost` = no
  contact.

### B.4 Events (one emitter: `runner.events`)

`RallyRunnerEvents extends RallyEventsB` (api.ts). Wave A's events keep their payloads (`lap {
car, slot, lap, ticks }`, `place { car, slot, place }`, `finish { car, slot, place, ticks,
projected }`, …). The wave-B payloads (`car`, `other`, `police` = body ids; `slot` = the player slot
of `car`, −1 for an AI car; sections = section ids such as `'ring-west'`; speeds in km/h):

| Event | Payload | Emitted by |
|---|---|---|
| `flash` | `{ car, slot, speed, limit, where, kind: 'camera' \| 'zone' \| 'redx' }` | RULES |
| `fine` | `{ car, slot, kind, euros }` (after `CarState.fines` += 1) | RULES |
| `redx` | `{ car, slot, gantry, lane }` | RULES |
| `pulledOver` / `released` | `{ car, slot, police }` / `{ car, slot }` | RULES |
| `policeActive` | `{ count }` | RULES |
| `roadworksAhead` | `{ section, lanes }` | RULES |
| `spitsstrookOpen` | `{ lap }` | RULES |
| `jam` | `{ section }` | FIELD |
| `overtake` | `{ car, slot, other }` (once per rival per lap: the emitter checks) | RULES |
| `nearMiss` | `{ car, slot, other, speed }` | FIELD |
| `bestLap` | `{ car, slot, ticks }` | RULES |
| `tunnelIn` / `tunnelOut` | `{ car, slot, name }` | RULES |
| `honk` | `{ car, slot }` | FIELD |
| `crash` | `{ car, slot, other }` (a hard hit on traffic) | FIELD |

`RALLY_EVENTS` (ids.ts) lists every name. The radio (wave C) and the HUD listen; the sim never
reads an event back. Reuse one payload object per event (no allocation per tick).

### B.5 The score (`score.ts`; RULES owns the values)

```ts
BEST_LAP_POINTS 2000; OVERTAKE_POINTS 100; NEAR_MISS_POINTS 50; NEAR_MISS_KMH 150; FINE_POINTS −250;
TEAM_POINTS 5000; TEAM_TOP 3                                  // spec §9 (PLACE_POINTS, TIME as in wave A)
interface CarTally { overtakes; nearMisses; finesEuros }
class ScoreBook { tally(car); peek(car); overtake(car); nearMiss(car, kmh); fine(car, euros);
  listen(events): () => void; clear() }
interface PlayerScore { place; timeBonus; bestLap; overtakes; nearMisses; fines; finesEuros; team }
interface ScoredRace { parTicks; carCount; parLapTicks?; book?; cars? }   // the optional fields are wave B's
playerScore(race, car): PlayerScore | null
raceLines(race, car): RallyLine[]     // with a book: scoreLines; without: wave A's PLACE, TIME
scoreLines(race, car): RallyLine[]    // PLACE n/N, TIME m:ss.t, BEST LAP m:ss.t, OVERTAKES n, NEAR MISSES n, FINES n EUR e, TEAM (2P)
```

- `runner.book` listens to the runner's `overtake`, `nearMiss` and `fine` events; the emitters only
  emit. The fine count is `CarState.fines` (RULES adds 1 before `fine`); the book adds the euros.
- `runner.raceLines(slot)` passes the book, the par lap and the cars, so the tally
  (`rallyTally` → `TallyRunner.tallyLines`) shows every line; a missed bonus shows its count with
  null points (`---`). The FINES line never takes the total below 0.
- TEAM (2P): 5,000 each when both estates finish in the top 3. The headline stays wave A's
  `rallyHeadline(bestPlace)` (spec §1.1).
- `RallyReport` gains `overtakes?`, `nearMisses?`, `finesEuros?` per joined player.

### B.6 The plug-ins (`registry.ts`; the lazy content registers at import)

```ts
defineRallySystem({ id, order?, install(runner) }); rallySystems()        // FIELD 100–199, RULES 200–299
defineRallyTeams({ id, rivals(count): RivalEntry[] }); rallyTeams()        // RivalEntry { spec: CarSpec, pace }
defineRallyScenery({ id, order?, build(track): RallyScenery }); rallyScenery(track)   // WORLD 100–199, FIELD 200–299, RULES 300–399
defineRallyHud({ id, order?, create(runner): RallyHudPart }); rallyHud()
undefineRally(id)                                                            // tests
interface RallyScenery { meshes; pages; fill(ctx: RallyDrawCtx, out: DrawItem[], k): number }
interface RallyDrawCtx { runner; view /* 0 | 1 */; cam; aspect; far /* fog far */; day: Daylight; t; v3: View3d }
interface RallyHudPart { tick?(); draw(r, v: RallyHudView); drawFrame?(r); dispose?() }
interface RallyHudView { slot; car; x; y; w; h; split; day; ticker }
```

- **Systems** (the sim): `install(runner)` runs at the END of every runner's constructor (the grid
  is set) in `order`; it adds systems (`runner.addSystem({ step })`: every tick, the grid included,
  after the cars moved and before the contacts), bodies and listeners. Pure and deterministic
  (`runner.rng.fork(...)` for gameplay, `runner.fxRng` for cosmetics); it must cope with a test
  track (no gantries, cameras or zones).
- **Teams** (FIELD): `rivals(count)` gives the rivals in grid order (7 in 1P, 6 in 2P; fewer = the
  runner repeats); `pace` × the difficulty's `PACE` drives each one. Absent: wave A's `RIVAL_SPECS`.
- **Scenery** (cosmetic): built once per track (cached), uploaded with the track, released on the
  scene's exit. `fill` runs per view per frame after the track's culled items and before the cars:
  cull by `ctx.cam` / `ctx.far`, no allocation. Moving decor (the oncoming traffic) may use
  dynamic meshes (`ctx.v3.updateMesh`) or matrices it rewrites.
- **HUD parts** (cosmetic; RULES): created in the scene's `enter`, `tick` after each race step,
  `draw` per player view after the base HUD (place, lap, times, speed), `drawFrame` once over the
  frame, `dispose` on exit. `ticker` is the radio's text (`''` until wave C writes
  `RallyScene.ticker`).

### B.7 The runner's hooks (`runner.ts`, PREP, additive)

`signs` (+ `race.signs`), `book` (listening), the teams in the constructor, the systems installed
at the end of the constructor, `roster` bumped by `addBody` / `removeBody`, `raceLines` with the
book, the report's new fields, and `stateHash` over the extra bodies (position, yaw, speed) once
there are any. Nothing else in the race changed.

### B.8 The scene's hooks (`scenes/rally.ts`, PREP, additive)

`RallyScene.day` (`daylight(raceProgress(...))` every frame, every view's light), `ticker`, the
scenery parts (uploaded once; `fill` per view), the bodies that are not race cars (drawn by
`model` / `clutRow`, near and far LOD like the cars, the brake lamp from `lights`, hidden ones
skipped), the HUD parts (enter / tick / draw / drawFrame / exit). A view's list order: the track,
the scenery, the cars, the bodies, the fold's tiles.

### B.9 PREP's stubs (the builders replace them)

| Stub | File | What it does |
|---|---|---|
| sections | `content/rally/sections/index.ts` | an empty scenery part; `SECTION_LOOK` (spec §3) |
| sign faces | `content/rally/props/index.ts` | B.2: the states as emissive faces on the gantries |
| teams | `content/rally/teams/index.ts` | wave A's `RIVAL_SPECS` through the hook (the names stay `RIVAL n`: `tests/game/rally/scene.test.ts` counts them; FIELD updates that test when it uses `TEAM_NAMES`) |
| traffic | `content/rally/traffic/index.ts` | one hatchback (a `HATCH_COLOURS` row from `runner.rng.fork('traffic')`) at about 100 km/h in the right lane, 600 m past the start; it comes back 380 m ahead of the leader when the leader is 200 m past it |
| rules | `content/rally/rules/index.ts` | the start gantry's countdown; every speed camera (`A10Track.cameras`, any lap) fines a car passing above its limit + 3 km/h (`flash`, `fine`: 50 + 10 EUR per km/h over); the HUD part: the clock, `FLITSER` 250 m before a camera, the white flash, `BOETE EUR n` |

Numbers with the stubs (`npm run sim -- --mission rally --expect-complete`; in
`tmp/rally-prep-b/`): 1P seeds 1–3 normal 24,182 ticks, place 1, 9 fines (8,430 EUR), score 22,150,
hash 3644224439 (the same twice; the seed only picks the traffic car's colour so far); easy / hard
24,182 (place 1); 2P normal / easy / hard 24,403 / 24,388 / 24,297 ticks, places 1 3 / 1 2 / 2 3;
`--lap 3` 8,619; `--grid-back` normal / easy / hard 24,969 / 24,498 / 24,427 ticks, places 5 / 1 / 4;
2P `--grid-back` 24,988, places 4 and 5. (A debug teleport over a camera fines too: the captures'
`BOETE` lines.)

### B.10 Tests

`tests/game/rally/contract-b.test.ts`: the clock and the light over the laps, `out` in place,
`raceProgress`; the sign table, the countdown, the runner's table, the faces; the event names, the
body kinds and lamp bits; the `ScoreBook` and every line of §9 (TEAM, the fines' floor); the
registries (order, teams, scenery cache, HUD list); the stubs on the A10 (the countdown on the
start gantry, the traffic car, a camera's fine with `FLITSER`, `BOETE` and the clock on the HUD,
the tally lines, the same hash twice). Wave A's `contract.test.ts` tally test now expects the full
lines.

## B.W The world (WORLD, wave B, 2026-10-23)

The A10 around the road (spec §3, §4, §7.4, §7.5): the scenery and landmarks of the ten sections,
the road's furniture (gantries, matrix signs, S-exit signs, hectometre boards, flitspalen), the sky
and the time of day, and the lights of the night. All of it is LAZY content that registers with
`defineRallyScenery` at import (B.6): cosmetic, built once per track, culled per view, no allocation
per frame. A test track (no A10 anchors) gets empty parts.

| Part (scenery id, order) | Files | What |
|---|---|---|
| `world/sky` (100) | `content/rally/sky/index.ts` | the cloud layer and the sun sprite |
| `sections` (110) | `content/rally/sections/*` | buildings, trees, water, fields, lamp posts, billboards, landmarks; windows, lamp glows and pools at night |
| `world/signs` (150) | `content/rally/signs/*`, `props/index.ts` | gantries with their matrix signs, S-exit signs, hectometre boards, average-speed boards, flitspalen |
| `world/car-lights` (190) | `content/rally/lights/*` | headlights, tail lights and indicators of every car and body |

`sections/index.ts` loads the sky and the car lights; `props/index.ts` loads the signs (the content
index already imports both). PREP's stub sign faces are gone; `buildSignFaces()` stays for the B.10
test (it now cuts WORLD's faces).

### B.W.1 The time of day (`rally/daylight.ts`; the B.1 API unchanged)

- `DAY_KEYS` (WORLD's): 0 (16:15) a low autumn sun from the south-west, warm light, a cool fill
  (the long dark sides away from the sun), a cream horizon; 0.5 (16:37) golden; 0.95 (16:58) the
  sunset, an orange-pink horizon under a purple-blue sky; 1.35 (17:16) the afterglow; 1.85 (17:38)
  the blue hour; 2.2 (17:54) dark: a deep blue sky over the orange city glow; 3 (18:30) night. Every
  channel of `skyTop` only falls; the fog colour is `skyBottom`; the fog's far end 430 → 370 m.
- Additive: `sunVector(azimuth°, elevation°)`, `SUN_PATH` (226°/13° at 0 → 242°/0.5° at 1 → below the
  horizon after), `sunAt(progress, out)` (the sky's sun; below the horizon after about 1.05 laps).
  After the sunset `light.sunDir` turns into the night's high fill (the city's glow), not the sun.
- `carLights` (night ≥ 0.3, about 1.15 laps) and `lampGlow` (0.8 → 1.6 laps) as PREP made them:
  the lamps, windows and car lights read them.

### B.W.2 Pages (WORLD's ids)

| Id | Page | Size | CLUT rows |
|---|---|---|---|
| 200 | façades: 7 full-height strips of 32 × 256 (glass, stone, 1960s flats, brick, the islands' flats, sheds, halls) + roof gravel and louvres | 256² | 0 day; 1–4 the night overlay (all cut out but the lit windows, glow levels ¼ … 1) |
| 201 | props: tree cards, bushes, reeds, 6 billboards, name plates, lattice, pitch, container, boats, fence, water, swatches | 256² | 0 |
| 301 | signs: the 14 matrix faces (32 × 32), 17 S-exit panels, 68 hectometre boards, zone boards, the A10 shield, the finish banner, truss, cabinet | 256² | 0 |
| 302 | glows: disc, pool, sun, bar, dot (16-step gradients, additive from black) | 128 × 64 | 0–3 glow levels, 3 full |
| 310 | clouds (tileable, cut out) | 256² | 0 |

RULES' road-works page is 303 (`PAGE_IDS.fx + 3`); WORLD's sky moved to 310 to stay clear of it.
Every texture is a 16-colour bank of PAL_HD tones (the glow page's index 0 is black: it adds nothing).

### B.W.3 The sections (`sections/`)

- `batch.ts`: `WorldBatch(prefix, layers, cell = 160)` — world-space geometry cut into square
  CELLS of the ground; per cell one mesh per LAYER and level of detail (`near` within
  `WORLD_LOD_NEAR` 150 m of the cell's box, `far` beyond); `Frame` (x right, y up, z forward; the
  track's frame or any yaw); `quad / tri / poly / box` (the winding follows the given outward side);
  `CellCuller.fill(cells, cam, aspect, far, glowLevel, out, k)` (box within the fog, sphere in the
  frustum, the night layers' CLUT row per glow level; `tris` / `draws` of the last fill).
- Layers (`pieces.ts` `WORLD_LAYERS`): `facade` (lit, 200), `props` (lit, 201), `cut` (two-sided
  cut-out, baked), `ground` (decals with a depth bias), `win` (the lit windows, emissive, night
  rows), `glow` (additive halos), `pool` (additive light on the road, near only, from glow level 1).
- `pieces.ts`: `building` (façade quads of at most one strip width, a gravel roof, the window
  overlay), `tree` (two crossed cards), `centralLamp` (the A10's double-armed mast on the central
  barrier every 50 m, with sodium halos and pools), `billboard`, `water`, `parcel`, `container`,
  `boat`, `lattice`, `crane`, `floodlight`, `turbineTower`, `deck` (viaducts and flyovers), `face`.
- `place.ts`: `Placer` (frames at (s, side); `clear(x, z, r)` keeps 27 m + r from the middle of both
  carriageways and off the keep-outs: rivers, pitches, landmarks) and the filler makers (`office`,
  `tower`, `flats`, `houses` with pitched roofs, `shed`, `farm`, `trees`, `billboardAt`, `treeRow`,
  `zone`).
- `dress.ts`: `dressA10(track, batch)` — the lamp posts, the 26 landmarks at TRACK's anchors (one
  builder per id; table in the file's header), then each section's filler. Animated parts
  (`AnimSpec`): five turbine rotors, the metro train on the Ring West viaduct (posed once a frame).
- `index.ts`: `buildSections(track): WorldSections` (`cells`, `report.landmarks` per section,
  `layerTris`, `cullers`), `isA10(track)`, `SECTION_LOOK`.

Our own made-up billboards (`BILLBOARD_ADS`: FRIET MET ALLES, FILE FM, STROOPWAFELS, PARKEERVERGUNNING?,
APPELTAART, FIETS KWIJT?) and plates (`PLATES`: the two tunnel names, station names, EXPO, SCIENCE
PARK, SPORTPARK); `worldTexts()` lists them (the brand test). No company name on any building.

### B.W.4 The road's furniture (`signs/`)

- The gantries enclose TRACK's placeholders (columns 0.6 m, the beam 1.25 × 1.1 m, a dark housing per
  lane), so `buildA10(…, { props: false })` would leave no gap. A matrix gantry has ONE dynamic mesh
  (`fx/world-signs/leds/<g>`) of 4 faces (3 on the start gantry): 1.5 m, 5.55 m up, 0.28 m in front;
  its uv is rewritten (and `updateMesh` called) only when `race.signs.version` changes.
- The 'exit' gantries carry the blue panel of the next S-exit; the start gantry the FINISH banner;
  the average-speed gantries a blue TRAJECT / CONTROLE (EINDE TRAJECT) board on the right column.
- `EXIT_PLACES` fills the table's blank S-exit names with real districts (S108 ZUID, S110
  BUITENVELDERT, S115 ZEEBURG, S116 NIEUWENDAM, S117 NOORD, S118 OOSTZAAN). A blue sign stands on the
  verge 250 m before each exit that no gantry signs; green hectometre boards every 100 m (our own
  numbering from 12.0, `hectoText(s)`); the zone's boards 160 m before and 40 m after it.
- `signTex(exits, hectos)`: the page; `faces[state]` for every `SIGN_STATES` entry (our own 5 × 9
  digits; the countdown at double size), `texts` (the brand test).

### B.W.5 The sky (`sky/`)

- The cloud layer: a 10 × 10 sheet of 100 m tiles, `CLOUD_Y` 105 m up (above every building, 96 m at
  most, so the depth test never lets it cover one), cut-out clouds lit by the time of day and faded
  by the fog. One DYNAMIC mesh per view (`sky/clouds/<view>`) follows its camera tile by tile; its uv
  is rewritten then, so the clouds stay fixed in the world.
- The sun: an additive sprite 140 m from the camera in `sunAt`'s direction, facing the camera, in four
  tints (warm white → orange-red); not drawn below the horizon or at night. Near its distance it
  may glow over a far building (the glare of the era).

### B.W.6 The night (`lights/`)

- Glow levels (`glowLevel(lampGlow)`: −1 off, 0 … 3): the windows' overlay rows, the lamp halos and
  floodlights, the pools (from level 1).
- `lights/cars.ts`: per car and body (not hidden), at night or when its `lights` has head / tail:
  one glow mesh per model (`fx/carglow/<model>`: halos at the head lamps, red halos at the tail lamps,
  a pool on the road ahead; built and uploaded when the model is first seen), plus CARS' lamp lenses
  within 70 m; the indicators (left / right / hazard bits) blink on the first half of every 40
  frames. The scene draws the brake lamps; RULES draws the police beacons.

### B.W.7 Numbers (node: `tests/content/rally-world.test.ts`; browser: shot3d)

- The world: 593 meshes, 146 cells, about 26,300 triangles in all; built in about 25–50 ms.
- Per view along the lap (340 chase cameras; track + sky + sections + signs; no cars): 1P day max
  6,294 / avg 4,334 triangles, at most 96 draws; 1P night max 6,128; 2P night max 6,128 / avg 4,203,
  at most 95 draws. The world's own share: max 3,600, avg about 1,950.
- In the game (SwiftShader, `stats()` with cars and traffic): 1P 4,200–5,500 triangles in 63–88
  draws; 2P about 12,800 triangles in 190 draws for both views.

### B.W.8 Tests

`tests/content/rally-world.test.ts`: the 26 landmarks in their sections; geometry in every section;
a test track; determinism; nothing stands on the carriageways; no company name in any text; the
road signs carry real place names; the palette rules of every page; the road page's layout; every
matrix state has its face and a gantry's faces follow the table; the time of day (continuous, the
clock monotonic, the fog = the sky's bottom, the sun sets in lap 2); the glow levels and the sun
sprite; a model's glow mesh; the budget per view at 40 places (1P day and night, 2P).

## B.R The rules, the score and the HUD (RULES, wave B, 2026-10-23)

Spec §4, §5, §7.6, §9, §10. Files: `src/game/rally/rules/` (`plan.ts`, `rules.ts`, `works.ts`,
`police.ts`; pure, deterministic, scanned), `src/game/content/rally/rules/` (`index.ts` the
registrations, `hud.ts`, `scenery.ts`, `sfx.ts`; lazy), `src/game/content/rally/props/roadworks.ts`
(the art), the values in `score.ts`, the `joinAt` hook in `runner.ts`, two feedback sounds in
`scenes/rally.ts`. The race modules reach the main chunk only through the lazy content.

### B.R.1 The plan (`plan.ts`) and the rules (`rules.ts`)

```ts
rulesPlan(track): RulesPlan          // cached per track: anchors as lap OFFSETS (m past the start line, [0, L))
RulesPlan { L, gantries: GantryPlan[] /* off kind section signs base (100; 80 in a tunnel section) spits */, start,
  cameras: CameraPlan[] /* off limit where works (−1 fixed; else the road works it belongs to) side */, zone, works: WorksPlan[],
  spits, tunnels, exits, sections, laneX /* 0..2 lanes, 3 shoulder */, borders }
WorksPlan { index off0 len closed limit section arrow x inside end open openDir line edge cones }
wrapOff(x, L); inRange(off, off0, len, L); ahead(a, b, L); signLaneAt(plan, side) /* 0..3 */; sectionAt(plan, off)
installRules(runner): RallyRules     // the system 'rules' (content/rally/rules/index.ts, order 200)
rulesOf(runner): RallyRules | null   // the HUD, the scenery, other owners
class RallyRules { plan; lap /* the event lap 1..3 */; lap3Tick; spitsOpen; posted[] /* km/h per gantry */; works: RoadWorks;
  police: PoliceForce; cars: CarRules[]; of(car); offOf(dist); clearOfPlayers(off0, len);
  cameraAhead(car, range = 250); redXAhead(car, range = 300); zoneAverage(car); laneClosed(off, lane, look = 0); joinPoint(last) }
CarRules { car prev posted zoneT0 zoneD0 zoneLimit tunnel stopped hunted pulled best }
CAMERA_TOLERANCE 3; MAX_STEP 20; FLITSER_AHEAD 250; SWITCH_CLEAR_BEFORE 520 / _AFTER 60; POLICE_BY_DIFFICULTY { easy 2, normal 3, hard 4 }
```

- **The event lap** = max(`startLap`, 1 + ⌊the leading player's progress⌋) (daylight.ts `raceProgress`,
  the clock's own measure): lap 1 cameras and signs; lap 2 the road works; lap 3 `spitsstrookOpen`
  (once) and the police. A road-works zone switches up or down only while no player car is within
  520 m before it, in it or 60 m after it (no pop-in in a player's view).
- **The signs** (recomputed only when the lap, the standing works or the start's state change):
  matrix gantries show their base limit over lanes 0–2; the shoulder sign shows the spitsstrook
  (`x` laps 1–2, `arrow-down` lap 3) where a stretch is under it or starts within 250 m, else blank;
  exit gantries stay blank. Around a standing zone: the **arrow gantry** (the gantry before the red-X
  gantry, ≤ 950 m) `merge-left` / `merge-right` over the closed lanes and 80 over the others; the
  **red-X gantry** (the last one ≤ 700 m before the zone) and the gantries inside it `x` over the
  closed lanes (the shoulder too when closed) and the zone's limit (70); the **end gantry** (the first
  ≤ 400 m after it) `end`. The start gantry: `count-3/2/1`, `go` for `GO_SIGN_TICKS`, then dark.
  `posted[g]` = the highest limit over its lanes (blank / end = its base). On the A10: RING WEST
  arrow 2 / X 3 / inside 4 / end 5; NOORD 8 / 9 / – / 11; OOST 11 / 12 / – / 14 (gantry 11 is both
  NOORD's end and OOST's arrow: the arrow wins).
- **Enforcement** (every race car, players and rivals; not finished, not being stopped; a move of more
  than `MAX_STEP` m in a tick — a debug teleport — checks nothing): a gantry passed under `x` over
  the car's lane (`signLaneAt`; 3 = the shoulder) → `redx`, `flash` (kind 'redx'), `fine`
  (`REDX_EUROS`); every gantry passed sets the car's posted limit; a speed camera passed above the
  posted limit + 3 km/h (the camera's own limit before any sign) → `flash`, `fine`; the zone: the
  clock starts at its start, the average (m / ticks) at its end above the entry limit + 3 → `flash`
  (kind 'zone'), `fine`. `CarState.fines` + 1 before `fine`; euros `fineEuros(kind, over)`.
- **Race events**: `overtake` (a player passes a rival: once per rival per lap of the player, by
  `dist`), `bestLap` (a new best FULL lap of any racer), `tunnelIn` / `tunnelOut` (the tube's name),
  `roadworksAhead` (a zone goes up: its section and closed lanes), `policeActive` (a police car joins:
  the count on the road). The payloads are reused objects.

### B.R.2 The road works (`works.ts`, lap 2)

- The seed (`runner.rng.fork('rules')`) leaves one zone out half of the time (never RING WEST): 2–3
  zones. A zone is a POOL of standing bodies (`kind` 'prop', no `model`: the drawing is the scenery
  `rules/works`): the arrow-board truck (`WORKS_TRUCK`, 7.4 × 2.3 m, 9 t) at `TRUCK_AT` 4 m in the
  first closed lane, a barrier (`WORKS_BARRIER`, 2 × 2 m, 20 t) every 30 m in every closed lane, and
  the taper's cones (`WORKS_CONE`, 0.6 m, 400 kg) every 10 m over `TAPER_LEN` 100 m from the far edge
  of the closed lanes to the cones' line (`CONE_CLEAR` 2.45 m from the open lane's centre: outside a
  driver's corridor). Parked: `hidden` + `phys.ghost`; up: solid once nothing overlaps it; reset to
  its place every tick (a push never moves it).
- The AI: every driver of `runner.drivers` (the rivals, the finished cars, the debug autopilot)
  leaves a closed lane from `GUIDE_AHEAD` 420 m before a zone (`openLane`). The bot (`RallyBot`)
  reads the same guide (integrator: like a player who reads the red X; before, its racing line ran
  into the taper and it pushed against the cones for up to 19 s). FIELD's traffic reads the zones too
  (B.F.2). The safety net: a race car that stands (below `STUCK_SPEED` 2.5 m/s: creeping against a
  cone counts; integrator) 2 s within 16 m behind a prop is put in the nearest free open lane
  (`recoverBody`, the `recover` event).
- Queries: `closedAt(off, lane, look)`, `openLane(off, lane, look)`, `mask()`; `taperSide(w, o)`.

### B.R.3 The police (`police.ts`, lap 3)

```ts
POLICE_SPEC { 1600 kg, 72 m/s, accel 8.5, grip 1.12, 4.9 × 1.76 m, model 'police' }; POLICE_GAP 420; BOX_AHEAD 3.5; BOX_SLACK 3;
BOX_SIDE_MIN 1.9 / MAX 5; BOX_TICKS 120; HOLD_TICKS 180; CHASE_MAX 3600; LOSE_GAP 600; APPROACH 22; DROP_BACK 40; TAIL_GAP 12;
SPAWN_MIN 130 / NEAR 450 / MAX 900; SEEN_AHEAD 430 / BEHIND 40; CATCH_GAIN 15; CATCH_PACE 1.12; RETRY_TICKS 600
class PoliceForce { cars: PoliceCar[]; count; active; hunting(car); step() }
PoliceCar { index body driver phase: 'idle'|'chase'|'pull'|'hold'|'leave'|'done' target chaseT boxT pullT holdT waitT stopped … }
```

- Police k joins `POLICE_GAP`·k ticks after the event lap 3 began. **The pick:** the racer with the
  most fines (≥ 1), not stopped, not hunted (a tie: the better place). **The on-ramp:** the nearest
  S-exit 130–450 m behind the racer that no player sees (not within 430 m ahead of a player car nor
  40 m behind one), else the shoulder 170–320 m behind, else a farther exit (≤ 900 m); on the shoulder,
  6 m/s faster than the racer, blue lights on (`BODY_LIGHT.blue`).
- **The chase:** unseen by every player and more than 32 m behind its racer it gains on it as a ghost
  along its lane (`CATCH_GAIN`); seen, it drives (rally/ai.ts `drive`, pace 1.12, passing) until
  `APPROACH` m; then its own line one lane beside the racer (the freer side, the left on a tie),
  `BOX_AHEAD` m ahead; with traffic beside on both sides it tails the racer `TAIL_GAP` m behind; traffic
  in its line caps its speed (bumps only) and sends it back to the lanes. **The box** (`BOX_SLACK`,
  one lane beside, the racer moving) for `BOX_TICKS` → `pulledOver` → both glide onto the hard shoulder
  (kinematic, ghosts, the racer's input held) → `HOLD_TICKS` standing (its hazards on; integrator:
  the racer and the police car turn solid once nothing overlaps them, so lap 3's spitsstrook traffic
  sees them and does not drive through them) → `released` (the racer still a ghost while a body
  overlaps it, then solid; before, a lorry on the spitsstrook pinned a released P2 to the barrier).
  Shaken off (`CHASE_MAX`, `LOSE_GAP`, standing 3 s): it drives off and returns for the next racer after
  `RETRY_TICKS`. It never spins; a stopped racer and a police car that stopped one are never in a
  chase again.

### B.R.4 The score (`score.ts`, RULES' values) and the tally

`FINE_BASE` 50 + `FINE_PER_KMH` 10 per km/h over (camera, zone), `REDX_EUROS` 250, `fineEuros(kind,
over)`, `eurosText(e)` ('8.430'); the FINES line `FINES n EUR 8.430`. Unchanged from B.5: PLACE
20,000…2,000, TIME 50 per second under the par (TRACK's par: 8,871 ticks a lap, 26,613 the race),
BEST LAP 2,000 under the lap par, OVERTAKES 100, NEAR MISSES 50 (≥ 150 km/h), FINES −250 (never below
0), TEAM 5,000. The headline by the best player's place: `rallyHeadline` (spec §1.1).

### B.R.5 The HUD part (`content/rally/rules/hud.ts`, `rules/hud`)

`createRulesHud(runner)`; `HUD_LAYOUT.full` / `.split` (the boxes the tests check). Full view: the
clock top centre; two warning rows by priority (`POLITIE!` within 300 m of a police car after you,
`RIJSTROOK DICHT` with a red cross when a gantry ≤ 300 m ahead shows X over your lane, `FLITSER` ≤ 250 m
before a live camera, `TRAJECT avg/limit` in the zone (red above it), `WERK IN UITVOERING 70` ≤ 600 m
before standing works, `SPITSSTROOK OPEN` on lap 3 near a stretch); `BOETE EUR n` for 2.5 s after a
fine; the white flash of a camera over that view only (10 ticks); `AAN DE KANT!` + `POLITIE n` (the
seconds) while stopped; the mini-map bottom left (56 px: the loop pre-drawn, the start tick, rivals
white, the players in their colours with a blinking centre on your own, the police blinking blue / red,
standing works amber); a speed dial (0–260, ticks every 20, gold every 100, red past 200) above the
digits; the ticker bottom centre once (in 2P: in the lower view). Split view: the clock, one row, BOETE,
AAN DE KANT!, a 34 px map.

### B.R.6 The scenery part (`content/rally/rules/scenery.ts`, `rules/works`, order 300)

Page `WORKS_PAGE` 303 (128², one 16-colour CLUT). Per zone: the solid props cut into 80 m pieces
(cones, boards on posts, the truck with its raised arrow board, the mobile camera's tripod), one
decal mesh (the yellow solid line along the closed lanes, yellow dashes between the open ones;
`bias` 6), the lit arrow (emissive; pointing to the open side) and the amber lamps (additive) by
turns every 24 frames. Police: CARS' beacon meshes by turns (6 frames) while the blue bit is on, and
`rules/police/display` + `stop` / `politie` (a raised red-LED matrix over the roof bar, every 40
frames) while it chases or stops. About 700 triangles a zone; 1–12 draws in a view.

### B.R.7 The 2P join (`runner.ts` `joinAt`, additive)

`RallyRunner.joinAt: ((last) => { back, lane } | null) | null` — RULES sets it to `joinPoint`: the
first place 15–600 m behind the last car (10 m steps) with no tunnel or cutting within 40 m, clear of
standing works (140 m before to 40 m after), and a lane (the right one first) with no body within
30 m. Null = wave A's 15 m behind it.

### B.R.8 Sounds, numbers, tests

- Synth placeholders (wave C replaces them): `rally/flash` (a player is flashed) and `rally/pulled`
  (a player is stopped), played by the scene's listeners.
- Sims with the full rules and WORLD's / FIELD's wave-B parts as of 2026-10-23 05:10 (`npm run sim --
  --mission rally --expect-complete`; `tmp/rally-rules/many.sh`): every run complete; 1P seeds 1–3
  27,447–29,227 ticks; easy / hard 27,537 / 29,291; 2P 28,582–31,368; `--grid-back` 26,964–30,135;
  `--lap 3` 12,432. Per race ~100–120 flashes in the field (the bot ~15 fines, rivals 11–17), 7–17
  red X, 2 / 3 / 4 stops by the police (easy / normal / hard), 6–9 overtakes by the bot. Without the
  rules (seed 1): 28,420 → with them 28,521–29,181 (the police's stop costs a player about 6 s).
- `tests/game/rally/rules.test.ts` (20: the plan, the signs per lap, a flash above the limit only and
  rivals too, a teleport fines nothing, the zone's average, the red X, the works up / down / never
  near a player, the AI and the safety net, the police count / pick / box / stop / release / once,
  overtakes once per lap, tunnels, the euros, the headline, the join's safe point, determinism) and
  `tests/game/rally/rules-hud.test.ts` (4: 1P and 2P at 1× with every element on and no text over
  another, the layout, drawing never changes the race).

## B.F The field (FIELD, wave B, 2026-10-23)

Spec §2 (the race), §4 (traffic per lap), §6 (the cars), §7.3 (budgets); lead notes 3 and 6. The
rally teams, the traffic and its spawner, the rival AI, the oncoming decor, the grid order, the
results, and the physics' bodies from CARS' anchors. The AI modules live in `src/game/rally/ai-*.ts`
but only the lazy content imports them (the main chunk grows by `grid.ts` and the small additions
to `ai.ts` / `physics.ts` only).

### B.F.1 The rally teams (`content/rally/teams/index.ts`; models `models/team-index.ts`)

| Grid (1P) | Team | Model (`TEAM_MODEL_IDS`) | Tris / far | Handling (mass kg, top m/s, accel, grip; extras) | Pace share |
|---|---|---|---|---|---|
| 1 | DE LAATSTE RIT | `rival` (CARS' hearse) | 402 / 158 | 1800, 60.5, 6.0, 0.95; RWD | 0.955 |
| 2 | OMA TRUUS | `team-oma`: a tiny lilac 1990s hatch, the grey-haired driver through the glass, a boy racer's wing | 326 / 112 | 820, 57, 7.2, 1.02 | 0.97 |
| 3 | VRIJGEZELLEN | `team-limo`: a white stretch limousine, three lads through the sunroof (the groom in a gold hat) | 440 / 148 | 2400, 60, 6.0, 0.92; RWD; wheelbase 5.05 m | 0.95 |
| 4 | DE FRIETBAK | `team-frietbak`: a snack van, the giant cone of fries on the roof, the hatch open under its flap | 386 / 138 | 2100, 55, 5.8, 0.94; RWD; `lean` 1.6 | 0.962 |
| 5 | HUISJE OP WIELEN | `team-camper`: a 1970s coachbuilt camper, cream with sweeping stripes, the luton, a ladder | 404 / 138 | 2300, 51.5, 5.2, 0.97; RWD; `lean` 2.6 | 0.985 |
| 6 | ACHTERUIT | `team-achteruit`: a small orange 1970s saloon, white arrows pointing BACKWARDS | 330 / 124 | 850, 55, 6.6, 1.0; `reverseTop` 55 (belt drive); `gag` 'reverse' | 0.945 |
| 7 | DE IJSCOMAN | `team-ijsco`: a pastel ice-cream van, a giant ice cream on the roof, the striped awning | 330 / 138 | 1900, 54, 5.9, 0.95; `lean` 1.5 | 0.965 |

- `TEAMS: Team[]` (grid order; 2P uses the first six), `TEAM_NAMES`, `TEAM_PACE`; each spec is a
  `RivalSpec` (`ai-rival.ts`: `CarSpecB` + `horn` `'rally/horn/<id>'`, `dj` `'rally/dj/team/<id>'`,
  `gag`, `bias`). Wave C makes the horns (and the ice-cream tune) and writes the DJ lines.
- Every team name on both sides (painted unmirrored, `sideText` / `sideTextScaled`), on the roof
  (reads from behind) and mostly on the back; made-up yellow plates; no badges.
- Registered here: the models, `defineRallyTeams('teams')`, `defineRallySystem('rivals', 110)`,
  `defineRallyHud('results', 900)`.

### B.F.2 The traffic (`content/rally/traffic/index.ts`; `rally/ai-traffic.ts`)

`TRAFFIC_TYPES` (spawn weight, lanes, pace × the lane's speed, cap, pool per player):

| Type | Model | Tris | Rows | Lanes | Notes |
|---|---|---|---|---|---|
| hatch 22 | `traffic` (CARS') | 240 | 10 | 0–2 | |
| saloon 18 | `traffic-saloon` | 240 | 10 | 0–2 | 1990s four-door |
| estate 14 | `traffic-estate` | 250 | 10 | 0–2 | |
| van 10 | `traffic-van` | 250 | 6 | 0–2 | glass in the cab only |
| parcel 6 | `traffic-parcel` | 250 | 4 | 1–2 | a step van; our own parcel icon, `PAKKETTEN` on the back (no company) |
| lorry 12 | `traffic-lorry` | 250 | 6 | 1–2 | cab-over + curtain trailer, 16.1 m, 5 axles (2 spin), 18 t, ≤ 85 km/h; wake 2 (slipstream) |
| coach 4 | `traffic-coach` | 250 | 4 | 1–2 | 12 m, `AMSTERDAM` on the back |
| taxi 4 | `traffic-taxi` | 250 | 2 | 0–2 | the saloon + a `TAXI` roof sign |

- **Pools** (`Traffic`, one per runner; `trafficOf(runner)`): every type's bodies are added ONCE at
  install (`kind` 'traffic', `hidden` + `phys.ghost` when parked, `side` 1000 then); a spawn sets
  the `clutRow`. The stateHash covers them (B.7).
- **The spawner** (every 8 ticks): `DENSITY` 5 / 8 / 12 cars per player window (laps 1 / 2 / 3) ×
  `DENSITY_K` (easy 0.75, normal 1, hard 1.2) × `DENSITY_2P` 0.85 in 2P; the window is
  `WINDOW_BEHIND` 240 m behind to `WINDOW_AHEAD` 500 m ahead of each player; new cars at
  `SPAWN_AHEAD` 450–500 m (never within −60 … `SPAWN_SAFE` 440 m of ANY player: no pop-in), behind a
  slow player at −220 m; never two bodies within 40 m across the road (no walls); parked beyond
  −270 / +660 m of every player. At install the road ahead of the grid is filled (250–500 m).
- **The driver** (per car, per tick): `LANE_KMH` 108 / 98 / 86 (left → right) × the type's pace × its
  own ±5 %, the spitsstrook 88; bends at 90 % of its grip; a time gap behind the body ahead (brake
  lights); a lane change = the indicator `SIGNAL` 60 ticks first, then the move at 1.8 m/s (the
  indicator stays on; it goes back if a car comes alongside: the mirror); reasons: out of a lane
  closed by road works (280 m early; with RULES installed it reads RULES' zones — `rulesOf(runner)
  .works`: the active zones, their closed lanes and limit; without them TRACK's `roadworks` anchors
  while a player is on lap 2), onto / off the hard shoulder in a `spits` stretch while a player is on lap 3, make way
  for a faster body from up to 150 m behind (keep right), pass a slower car on the left, back right
  when there is room. Lorries, coaches and parcel vans never use the left lane.
- **A hit** (a bump that spins it or changes its speed by `HIT_DV` 4 m/s): it brakes to a stop with
  its hazards on, stands `STOP_TICKS` 120–180 (integrator: was 180–240), turns back along the road, drives on (hazards
  `HAZARD_AFTER` 90 more ticks). `crash { car: the racer, slot, other: the traffic car }`.
- **Lights** (`lights`, B.3): brake (braking, or slow in a jam), left / right (signalling or
  moving), hazard; head / tail at night are the drawer's.
- **Events:** `honk { car: the traffic car, slot: the racer it honks at }` when a racer cuts in
  within 14 m and it must brake > 5 m/s (cooldown 4 s); `nearMiss { car: the player, slot, other,
  speed km/h }` when a PLAYER passes it with less than `NEAR_GAP` 0.9 m between the bodies (no
  bump in the last 0.5 s); `jam { section }`.
- **Jams** (lap 3): `JAMS` 1 / 2 / 2 zones (easy / normal / hard) of `JAM_LEN` 110 m spread over
  lap 3 (seeded); armed when a player is `JAM_ARM` 520 m before one: `JAM_CARS` 7 slow cars across
  the lanes (out of sight), stop-and-go at about `JAM_KMH` 60 km/h (27–72) with brake lights;
  traffic slows into it from `JAM_APPROACH` 60 m before; over when every player is through.
  Integrator (momentum, B.I.4): FIELD's 170 m / 45 km/h / 90 m cost the bot 20–25 s per jam.
- **The works' limit by lane** (integrator): traffic takes the limit × its own ±5 % × `WORKS_LEFT`
  1.04 (the left open lanes) or `WORKS_RIGHT` 0.86 (the right lane), so two cars side by side at
  exactly 70 no longer form a rolling wall through a zone.
- **The deadlock breaker** (integrator): a car that stood `DEADLOCK_TICKS` 300 while it wanted to
  drive turns a ghost for `UNLOCK_TICKS` 150, takes the middle of its nearest lane and drives on
  (it ignores the bodies ahead meanwhile); it turns solid once nothing overlaps it. A lane change
  holds its line while a body is alongside on that side (it never squeezes a car against the
  barrier).

### B.F.3 The rival AI (`rally/ai-rival.ts`; system 'rivals')

`installRivals(runner)` puts a `RivalBrain` in each rival's `Driver.ext` (B.F.6) and one system:
`catchUp` = `catchUpFactor(dist − leading player's dist, hard)` (+3 % at 400 m behind, −2 % at
400 m ahead, linear, 1 on hard; × top speed only), `traffic` = 1 − `VIRTUAL_TRAFFIC` (1.2 / 2.5 /
4.5 % by lap) outside every player's window (no traffic is simulated there), the horns (a close pass
of a player → `honk { car: the rival, slot: the player }`, cooldown 10 s), ACHTERUIT's gag. The
drive: the racing line + the team's `bias`; a slower body ahead → the lane (the hard shoulder too)
with the most free road, the mirror checked 1.8 s back (`passLane`); behind a race car / lorry /
coach nearly as fast on a straight → stay in its slipstream to 8 m, then pull out; follow at 0.35 s
(0.25 s drafting); it never moves onto a line a player closes in on and never brakes for a car
behind (no brake-checks). **The gag** (once, from lap 2, a straight of 220 m ahead, a player 15–220 m
behind, or anyone's on lap 3): a 0.5 s spin (kinematic, keeping the velocity), backwards at full
reverse (its belt drive: up to its top speed) for ≤ 4 s or until a bend / a body ahead, a spin back
(`GAG`, `GagPhase` 'ready' → 'spin' → 'back' → 'spinBack' → 'done').

### B.F.4 The oncoming decor (`rally/ai-oncoming.ts`; `content/rally/traffic/oncoming.ts`)

`oncomingPlan(length, skins)` — a fixed plan (Rng 'rally/oncoming'; 9 / 12 / 14 cars per km in the
lanes −10.6 / −14.1 / −17.6 m at 112 / 100 / 86 km/h, against our direction; vans; lorries not in
the fast lane); `oncomingS(car, L, t)`; `oncomingDensity(progress)` 0.45 → 1 (lap 1 → lap 3). The
scenery part `oncoming` (order 200): the `ONCOMING_MAX` 26 nearest per view (−40 m to the fog) as
textured boxes (10 tris; one dynamic mesh per view, two-sided, page `PAGE_IDS.cars + 30`) and, when
`day.carLights`, their headlamps (an emissive additive dynamic mesh). Cosmetic: never in the sim; no
allocation per frame.

### B.F.5 The grid and the results

- `rally/grid.ts`: `PLAYER_GRID` {1: [5], 2: [4, 5]}, `gridPlan(players, rivals, gridBack)`. The
  runner builds `cars` in that order; a P2 join on the grid re-grids (`regrid`, private) to the 2P
  start (the estates 5th and 6th, the last rival leaves). (runner.ts: the constructor's grid and the
  grid branch of `joinPlayer`, FIELD's additive edit.)
- `content/rally/teams/results.ts` (HUD part 'results'): UITSLAG over the frame in 'finish' / 'done':
  POS, TEAM (`P1 ROZZERS` …), TIJD (a projected time with `*`), BESTE, BOETES (`nX EUR e` from
  `CarState.fines` and the book, the euros in Dutch thousands: `eurosText`). `resultRows(runner)`
  (rebuilt every 15 ticks). The camera orbit is the runner's. When this part is registered the scene
  no longer draws its own wave-A panel (integrator).

### B.F.6 Additive changes to DRIVE's files

- `ai.ts`: `Driver.ext?: DriverExt` (`drive` → `ext.drive`, else `driveCore` = wave A's driver
  improved for traffic), `Driver.backT?`, `lastLane?` / `forcedT?` (`forcedLane`: a lane set from
  outside — RULES' road works guide, a recovery — is kept `FORCE_TICKS` 90: no racing line, no
  passing), `laneFreeAt`, `laneRoom`, `sideClear` (the mirror: a faster body from behind within
  `react` s), `passLane` (the lane with the most room, crossing lanes, `squeeze` round a standing
  body), `driveLanes(track)` (the hard shoulder counts when the track has one), `reachFirst`,
  `lookAhead`, `AI_CORRIDOR`. `driveCore` now plans a pass `PLAN_EXTRA` 45 m beyond its look-ahead,
  moves over at 6 m/s on straights, never steers into a body alongside, moves off a touching or
  standing body, backs away (steering) when pressed against a standing one, and sees RULES' props
  by their real width.
- `physics.ts` (lead note 3): `handlingOf(spec)` takes the length, width, wheelbase and the box's
  centre (`offZ`: the white estate's push bar) from the model's anchors when the model is
  registered (`shapeOfModel`, cached per model; the spec's numbers otherwise); `HandlingB` adds
  `offZ`, `circles` (`circlesFor`: odd, ≥ 3; the limousine 5, the lorry 7), `lean`, `reverse`,
  `reverseTop`, `shape`; `CarSpecB` (`lean`, `reverseAccel`, `reverseTop`); `bodyShape(h).cam` = the
  bumper camera's eye (camera.ts reads it since the integrator's change, A.D.5); the Collider's circles follow
  `circles` and `offZ`; the barrier check uses the box's centre.
- `tex/car-sheet.ts`: `CarSheet(…, texel = CAR_TEXEL)` (the limousine 24, the lorry 12, the coach 16
  texels per metre); `models/vehicle.ts` (FIELD's kit: `assemble`, `lampSet`, panels, `frustum`,
  `cone`, scaled lettering).

### B.F.7 Numbers (2026-10-23, `npm run sim -- --mission rally --expect-complete`, all rules on)

1P seeds 1–3 28,536–29,199 ticks (places 2–5); easy / hard 28,263 / 29,346; 2P normal / easy / hard
27,805 / 26,560 / 27,977; `--grid-back` normal / hard / easy 28,657 / 29,685 / 26,445 (places 7 / 4 /
1), 2P 29,067; `--lap 3` 10,589; 0 recoveries for the bot in every run; laps of the bot 8,300–11,500
ticks (2:18–3:12; lap 3 is rush hour). FIELD's harness without RULES (`tmp/rally-field/batch.sh`, 6
seeds): mean 27,354, max 28,111. View at 1× 1P: 6,800–8,000 tris, 94–108 draws (the grid, the pack,
lap 3 at night). Rival laps in a race of their own (the player dawdling): 6,600–12,000 ticks, all
three laps, ≤ 1 recovery.

### B.F.8 Tests

`tests/content/rally-teams.test.ts` (11: registry, budgets, meshes, pages and rows, deterministic
builds, sizes, anchors, the team names on both sides and the roof (never mirrored), plates, the
teams' handling, the anchors in the physics, the traffic types) and `tests/game/rally/ai-field.test.ts`
(15: the grid; traffic spawns out of sight, keeps lanes, signals ≥ 1 s; a hit → hazards, stop, drive
on, `crash`; `honk`; `nearMiss`; lap 3's jams and spitsstrook; determinism; the catch-up bounds; no
brake-checks; three laps at every difficulty; ACHTERUIT's gag; the oncoming plan; the estate's box
from its anchors; the belt drive). Updated: `race.test.ts` (the grid order, the 2P join on the grid),
`scene.test.ts` (6/8 on the grid, the team names on the results), `contract.test.ts` (CARS' ids among
the registered models), `contract-b.test.ts` (the real traffic instead of PREP's stub).

## B.I The integration (INTEGRATE, wave B, 2026-10-23)

The integrator merged the builders' parts (B.W, B.R, B.F on PREP's contracts B.0–B.10), did their
requests, built the race intro and tuned the momentum. Every change below is additive to the frozen
contracts; the identity sims (`tmp/ring-r/id.sh`, `ring-b.sh`, `drive-same.sh`) stay byte-identical.

### B.I.1 The full race

ams tally → the MISSION 2 card → the glitch into 3D (the fold folds into the fly-over's first view)
→ **the fly-over** (B.I.2) → the countdown on the start gantry (3-2-1, green arrows; then dark) →
lap 1 (16:15, the low sun, light traffic, the speed cameras, the average-speed zone, the matrix
signs) → lap 2 (the sunset, the headlights and lamps on, medium traffic, 2–3 road-works zones with
the red X, merge arrows, cones, barriers, the arrow-board truck, yellow lines, 70 and a camera) →
lap 3 (dark, rush hour with short jams, the spitsstrook open, the police) → the finish → the results
(UITSLAG: FIELD's part over the orbiting camera) → the tally (PLACE, TIME, BEST LAP, OVERTAKES, NEAR
MISSES, FINES with the euros, TEAM in 2P; the headline by place) → the glitch bridge → fps-1. 1P and
2P; P2 joins on the grid, during the fly-over (the fly-over goes on in both views) or during the race
(RULES' `joinAt`: the next safe point at the back).

### B.I.2 The race intro: the fly-over (`camera.ts`, `scenes/rally.ts`; cosmetic)

```ts
INTRO { ticks 240, ahead 70, height 26, swing 15, blend 0.25 }
introCam(t, track, cars, car, end: Cam3, out: Cam3, tmp: SplineSample): Cam3   // r3 trig only
RallyScene.introducing: boolean
```

- From high over the start gantry (`ahead` m before the grid's front, `height` m up, looking back
  down at the middle of the grid) round the right side of the field (`swing` m out at the middle of
  the path) and down into the view's chase camera (`end`): the last `blend` of the path blends into
  it, so the countdown starts without a jump. One path per view (2P: each ends behind its own car).
- Only after the glitch's fold (`RallySceneOpts.fold`): the fold folds into the fly-over's first view,
  then the race waits exactly `INTRO.ticks` ticks (any pad button skips it after 20 ticks). A sim or
  a test without the fold starts at once, so the fly-over never changes the race (the scene test's
  hash with and without the fold and the fly-over).
- The titles (no HUD yet): `DE RINGRALLY` (big, gold) and `3 RONDEN  A10  8 AUTO'S`, until 90 ticks
  before the end.

### B.I.3 The builders' requests

| From | Request | Done |
|---|---|---|
| FIELD 1 | the scene's own UITSLAG only without FIELD's part | `RallyScene.ownResults` (no 'results' HUD part registered) |
| FIELD 2 | the bumper camera from the model's anchors | `rallyCam`: `bodyShape(ph.h).cam` (A.D.5) |
| FIELD | results fines in Dutch thousands | `eurosText` in `resultRows` |
| RULES 1 | the traffic reads RULES' road works | `Traffic.roadworksOn` / `worksClosed` / the works' limit read `rulesOf(runner).works` (active zones, closed lanes, the limit); TRACK's anchors only without RULES |
| RULES 2 | the rival AI honours `d.lane` | already in FIELD's `ai-rival.ts` (`forcedLane`) |
| RULES 3 | `PAGE_IDS.works` | `PAGE_IDS.works` 303 (`WORKS_PAGE`), `PAGE_IDS.sky` 310 (WORLD's) |
| RULES 4 | `PAR_SPEED` 46 → 44 m/s? | **kept at 46** (race par 26,613 ticks): the bot (pace 0.94) finishes in 26,056–29,192 ticks (B.I.5; after the fixer's changes 26,320–29,317, B.X.3), so a TIME bonus comes for a race at or above the bot's level |
| WORLD | the pinned track hash | `tests/content/rally-track.test.ts`: 2708714424 (the fixer's road repaint: 2477415180) |
| WORLD (optional) | a sodium light in the tunnels | `TUNNEL_LIGHT` { ambient 0.92 / 0.6 / 0.3, sun 0.18 / 0.12 / 0.06 }, blended in over `TUNNEL_FADE` 30 m at each mouth, per view by its car's arc length (the tube walls are emissive; the road and the cars take it) |
| WORLD (look) | the headlight pool shifted to one side | the pool quad is cut into 2 × 6 cells (the affine warp of one big quad) |

### B.I.4 Momentum (the bot's pace; tuned 2026-10-23)

What dragged, measured with per-lap probes (ticks below 100 km/h and standing, the events):

| Drag (before) | Cause | Change |
|---|---|---|
| lap 2 easy: 19 s standing at the NOORD taper | the bot's racing line ran into the taper and pushed against the cones (creeping 2–6 km/h, so the 2 s safety net never fired) | the bot reads RULES' guide (B.R.2); the safety net counts below `STUCK_SPEED` 2.5 m/s |
| lap 2: 20–25 s at 70 km/h in RING WEST | two traffic cars side by side at exactly the works' limit | the works' limit by lane (`WORKS_LEFT` 1.04, `WORKS_RIGHT` 0.86) × the car's ±5 % |
| lap 3: 20–28 s per jam | `JAM_LEN` 170 m, `JAM_KMH` 45, a 90 m approach | `JAM_LEN` 110, `JAM_KMH` 60, `JAM_APPROACH` 60 m |
| lap 3 (2P): a 3-minute knot of standing traffic and racers | lorries stuck half across two lanes | the deadlock breaker (`DEADLOCK_TICKS` 300 → a ghost for `UNLOCK_TICKS` 150) |
| lap 3 (2P hard): a recovery | a pulled-over racer stood on the spitsstrook as a ghost; a lorry drove into it and pinned it to the barrier at the release | standing racer and police car solid once clear; the release waits until nothing overlaps (B.R.3); a lane change never squeezes a body alongside |
| a hit traffic car | stood 3–4 s | `STOP_TICKS` 120–180 |

The result (16 sims, B.I.5): laps 8,395–10,290 ticks (2:20–2:52; lap 1 8,400–9,300 with the start
from 6th, lap 2 8,350–9,750, lap 3 8,420–10,290 with rush hour, 1–2 jams and usually a pull-over of
the bot, which collects 12–15 fines), races 26,056–29,192 ticks (7:14–8:07) in 1P, 26,413–29,182 in
2P. Gaps between the events: the cameras every ~2,000 m, the average-speed zone, the works from
lap 2's start, the spitsstrook at lap 3's start, police 1–4 at 420-tick steps after it, jams armed
520 m ahead. The jam and a pull-over cost about 6–9 s each.

### B.I.5 Sims (`tmp/rally/base-b/`, `tmp/rally/base-b-same.sh`)

| Run | Ticks | Places | Laps (P1 / P2) | stateHash |
|---|---|---|---|---|
| seed 1 | 29,192 | 2 | 9,203 / 9,219 / 10,290 | 3090918087 |
| seed 2 | 27,483 | 2 | 8,908 / 8,959 / 9,136 | 388572297 |
| seed 3 | 28,597 | 4 | 9,300 / 8,884 / 9,933 | 2554887757 |
| seed 4 | 26,056 | 1 | 8,395 / 8,761 / 8,420 | 3481186445 |
| seed 5 | 26,900 | 1 | 8,779 / 8,705 / 8,936 | 1049823357 |
| easy / hard seed 1 | 27,536 / 27,412 | 2 / 1 | | 3769366482 / 3532398400 |
| 2P seed 1 / 2 | 27,722 / 28,025 | 1 2 / 3 1 | | 2589755350 / 3411358398 |
| 2P easy / hard | 26,413 / 28,586 | 3 1 / 1 4 | | 3166585092 / 3310924776 |
| `--grid-back` normal / easy / hard | 27,765 / 27,068 / 28,238 | 2 / 3 / 2 | | 1112348446 / 2030626039 / 2691694365 |
| `--grid-back` 2P | 29,182 | 6 2 | | 903341713 |
| `--lap 3` | 9,875 | 1 | 9,395 | 391978127 |

All complete, 0 errors, 0 recoveries, the same hash on a second run; 0.18–0.20 ms per tick.

### B.I.6 Budgets (`tmp/rally-integrate-b/lapstats.ts`: P1 teleported every 200 m, stats() after 20 ticks)

| View | Density | Triangles max / avg | Draws max / avg | Notes |
|---|---|---|---|---|
| 1P lap 1 (1×, SwiftShader) | 1 | 6,892 / 5,331 | 99 / 81 | |
| 1P lap 2 | 1 | 6,940 / 5,769 | 109 / 93 | the road works |
| 1P lap 3 | 1 | 7,602 / 5,604 | 130 / 92 | rush hour, night |
| 2P lap 2 (both views) | 1 | 14,956 / 12,056 | 231 / 195 | about 7,500 / 116 per view |
| 2P lap 3 (both views) | 1 | 15,738 / 11,848 | 272 / 197 | |
| 1P 4K, real GPU (Metal), lap 3 | 4 | 7,124 / 5,374 | 123 / 88 | frame interval 16.67 ms (max 16.68) |
| 2P 4K, real GPU, lap 3 | 4 | 15,032 / 11,517 | 257 / 187 | frame interval 16.67 ms (max 16.70) |

Textures 1.49 MB, buffers 7.1 MB (of 8 / 16 MB). Every view stays under the lead's 10,000 triangles;
the busiest 1P frames pass the spec's 6,000 (the lead allows it where the look needs it). The main
chunk is 822 KB (wave A 803 KB: +19 KB of the wave-B contracts the scene imports statically —
daylight, signs, score, the intro); the rally content chunk is 266 KB (95 KB gzip), lazy.

### B.I.7 Tests

`tests/game/rally/scene.test.ts` (the direct start: fold, fly-over, countdown; the hash with the
fold and the fly-over), `contract.test.ts` (the flow waits `INTRO.ticks`), `tests/content/
rally-track.test.ts` (the pinned hash), `rally-world.test.ts` (the pool's cells).

## B.X The final fixes (FIXER, wave B, 2026-10-23)

The review of wave B (`tmp/rally-b-review-report.md`) found 12 issues. The fixer verified each one
and fixed 11; finding 8 (the balance of fines against places) is the lead's decision for wave C.
Every change is additive or local to the rally; the 2D game, the dormant ring and the FPS mode are
unchanged (`id.sh` 10/10, `ring-b.sh` 6/6, `drive-same.sh` 4/4 SAME).

### B.X.1 Behaviour

| Finding | Cause | Change (API) |
|---|---|---|
| 1 the police brake-check | close and AHEAD of its racer with both lines beside busy, the tail case put the police car in the racer's line at the racer's speed − 12 m/s | `police.ts`: ahead (gap < −1) it holds its own line at the racer's speed + `AHEAD_PULL` 1.5 m/s; ahead and nearer than `IN_LINE` (= `BOX_SIDE_MIN` 1.9 m) sideways it never drives slower than that |
| (found on the way) a catching ghost turned solid at +20 m/s into a car's tail | the un-ghost checked only an overlap within 10 m | `PoliceForce.aheadCap`: it turns solid only at a speed it can hold behind the body ahead in its line (10 m + 2 s of closing) |
| 2 rivals into the taper | the racing line (+ bias) ran along a closed lane's cones; RULES' guide changed only `d.lane` | `Driver.keepLo` / `keepHi` (additive): the lanes a driver may use; `keepSide` / `keepLane` clamp the racing line and the lane (rivals and `driveCore`); RULES sets them each tick for the AI drivers (`RoadWorks.keepLanes`), the sim bot sets its own |
| 7 the AI on the closed hard shoulder | `driveLanes` gave every pass the shoulder | `keepHi` = `track.lanes` (the shoulder) only with no red X over it within `SHOULDER_X_AHEAD` 300 m (`RallyRules.shoulderX`); `passLane` keeps inside `keepLo..keepHi`. The HUD's red X warning also counts a lane within `REDX_EDGE` 1 m of the car's side |
| (found on the way) a released or spun racer crossed all lanes at 60 km/h | the racing line at once | below `MERGE_SPEED` 18 m/s a racing driver keeps the lane it is in (`holdLane`; the shoulder when it may use it) |
| 4 lap-2 cameras enforce 80 / 70 far from the works | the arrow / red-X gantries post the step-down up to 950 / 700 m before a zone | a fixed camera more than `WORKS_CAMERA_LEAD` 300 m before standing works keeps the base limit (`CarRules.postedBase`, `cameraLimitOf`); the mobile camera and the zone are unchanged. The HUD's `WERK IN UITVOERING` row shows from the arrow gantry on |
| 3 the limits unreadable at 1× | 5 × 9 digits with 1-texel strokes in a 1.5 m face | `signs/page.ts`: bold 7 × 12 digits (strokes 2, holes 3), a thinner ring; `FACE_M` 1.5 → 1.7 m (the housing follows). `RallyRules.cameraLimit(car, range)` and the HUD row `FLITSER 100` (the limit that camera enforces on that car) |
| 6 a P2 join keeps the 1P traffic | the pools and `k` were fixed at install | `Traffic.syncPlayers` on a roster change: the pools grow to 2 players (`addBody`), `k` takes `DENSITY_2P` (`Traffic.k` is no longer readonly) |
| 9 the headlight pool as a roof lamp | the bright middle of a 16 m pool was the only part the car did not hide | `lights/cars.ts`: `POOL_LEN` 24 m, the near part faded by vertex colour (15 % at the nose, full from 70 %), a slightly dimmer tint |
| 10 dark texels in the near asphalt | 1 lone darker texel in 19, the tyre tracks as 40 % lone texels | `tex-road.ts`: the grain only base + a hair lighter; the tracks as 4–10-texel streaks along the lane (pinned track hash 2477415180) |
| 11 docs | | B.I.3 and `headless-rally.ts` (`botPace` default 0.94) |
| 12 `buildSignFaces` | PREP's dead stub | removed; `contract-b.test.ts` reads WORLD's sign page |

### B.X.2 Momentum (`tmp/rally-fix-b/probe/`: the review's probe at the bot's paces, seeds 1–5, normal)

| Pace | Race ticks (avg) | Laps over 2:40 | Recoveries | Before (review) |
|---|---|---|---|---|
| 0.94 | 26,320–28,348 (27,696) | 2 of 15 | 0 | 26,056–29,192; 1–2 rival recoveries in a race |
| 0.97 | 27,327–28,537 (28,015) | 4 of 15 | 0 | seed 1 28,678 (lap 3 3:02), seed 2 28,906 (6th) |
| 1.0 | 26,789–28,139 (27,307) | 0 of 15 | 0 | seed 3 lap 3 10,202; seed 1 lap 2 10,595 |

Pace 1.0 is now the fastest on average, and no run needs a recovery. 0.97 is still not faster than
0.94: one incident (a pull-over, a jam, a traffic knot) moves a race by ±600 ticks, more than 3 % of
pace. Lap 3 costs about 7 s for the pull-over and 4–8 s per jam; that is the design (spec §4).

### B.X.3 Sims (`tmp/rally/base-b/` refreshed by the fixer; the integrator's set is in `tmp/rally-fix-b/base-b-integrate/`)

| Run | Ticks | Places | Laps (P1 / P2) | stateHash |
|---|---|---|---|---|
| seed 1 | 27,959 | 2 | 9,019 / 9,288 / 9,172 | 2010710864 |
| seed 2 | 27,859 | 2 | 8,630 / 8,818 / 9,931 | 1185523105 |
| seed 3 | 28,348 | 3 | 9,602 / 8,846 / 9,420 | 2904554971 |
| seed 4 | 26,320 | 1 | 8,670 / 8,512 / 8,658 | 3779398399 |
| seed 5 | 27,996 | 2 | 9,101 / 9,410 / 9,005 | 2992313605 |
| easy / hard seed 1 | 27,067 / 29,317 | 1 / 6 | 8,449 / 9,800 / 8,338 — 8,742 / 10,788 / 9,307 | 3285246445 / 3703276667 |
| 2P seed 1 / 2 | 27,270 / 28,545 | 2 3 / 2 5 | | 349112750 / 580332114 |
| 2P easy / hard | 27,408 / 29,294 | 1 5 / 3 1 | | 2381576728 / 624434113 |
| `--grid-back` normal / easy / hard | 28,352 / 27,692 / 27,787 | 3 / 4 / 1 | | 3894115142 / 1890955972 / 3017487850 |
| `--grid-back` 2P | 27,799 | 3 1 | | 2018254950 |
| `--lap 3` | 10,350 | 1 | 9,870 | 4269963532 |

All complete, 0 errors, 0 recoveries, 16/16 the same hash on a second run.

### B.X.4 Tests

`tests/game/rally/rules.test.ts`: no brake check (fails without the fix: both cars down to 15 km/h),
the cameras before the works keep the base limit, the AI lanes (no shoulder under a red X on laps 1–2,
the shoulder on lap 3, the closed works lanes left out), the red X warning at the shoulder border.
`tests/game/rally/ai-field.test.ts`: a P2 join grows the traffic pools and `k`. `contract-b.test.ts`:
the sign page; `FLITSER` with its limit. `tests/content/rally-track.test.ts`: the pinned hash.
