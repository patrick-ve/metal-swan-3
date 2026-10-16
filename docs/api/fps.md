# First-person mode API — ray engine, input actions, fps game, content, tools

Spec: `docs/design/fps.md` (it wins over this file when they disagree; fix this file then).
Originality: `docs/ORIGINALITY.md` ("Exception: the first-person mode"). Art rules:
`docs/ART_GUIDE.md` §10. Each builder fills its own section and replaces the `TODO` marks with the
final signatures, file names and examples. Keep it short: what a caller needs, not the internals.

| Section | Code | Owner (group / area) |
|---|---|---|
| 1. Ray engine | `src/engine/ray/**` | engine / ray |
| 2. Input actions | `src/engine/input-actions.ts`, `input.ts`, `input.browser.ts`, `pointer.browser.ts` | engine / input |
| 3. Fps game shell | `src/game/fps/{types,registry,map,game,player,doors,pushwall,run}.ts`, `scenes/{fps,fps-intro,fps-route}.ts` | engine / fps-shell |
| 4. Actors, combat, pickups, HUD | `src/game/fps/{actors,ai,hitscan,weapons,pickups,hud,audio}.ts` | cast / actors |
| 5. Floors, boss, tally, bot | `src/game/fps/{boss,validate}.ts`, `content/fps/{floor-1,floor-2,episode}.ts`, `scenes/fps-tally.ts`, `src/sim/bot-fps.ts` | floors |
| 6. Content registration and tools | `src/game/content/fps/**`, `src/game/content/index.ts`, `tools/{shot,sim,sprites}.ts` | fps-shell, art, fps-sound, floors |
| 7. Flow | `scenes/{glitch-bridge,flow,pause,continue,ending,final-tally}.ts` | flow |

## 1. Ray engine (`src/engine/ray/`)

Pure, deterministic, no game ids, no per-tick allocations. Units: tile = 1.0 (float64 positions;
cell `(x, y)` covers `[x, x+1) × [y, y+1)`, y grows south); angles are integers 0..4095 (0 east,
1024 south, turning right adds). The contract is spec §3.2; `src/engine/ray/index.ts` re-exports
every module.

- `fixed.ts` — `ANG_FULL/ANG_MASK/ANG_90/ANG_180/ANG_270`, `SIN`, `COS` (`Float64Array(4096)`,
  rounded to 1/65536, exact at the cardinals: `SIN[1024] = 1`, `COS[1024] = 0`). `angNorm(a)`
  (any int → 0..4095), `angDelta(from, to)` (−2047..2048), `angleTo(dx, dy)` (binary search over
  the tables, no `atan2`: `angleTo(COS[a], SIN[a]) === a` for every `a`; `(0, 0)` → 0),
  `degToAng(deg)` (0 east, 90 south).
- `grid.ts` — `RayGrid(w, h)`: SoA `wall` (texture index + 1), `flags` (`CELL_SOLID` blocks
  movement, `CELL_OPAQUE` stops rays, `CELL_DOOR`, `CELL_PUSH` (a secret; a normal wall for the
  engine until it is the active `PushWall`), `CELL_PROP` (blocks movement, not rays)), `area`,
  `door` (−1 = none). Outside the grid = solid and opaque. Helpers: `setWall(x, y, tex)`,
  `clearCell(x, y)`. `DoorTable(max = 64)`: `add(x, y, vertical, tex)` → index (−1 + warning when
  full); `place(grid, x, y, vertical, tex)` also marks the cell (flags = `CELL_DOOR` only);
  `open[i]` 0..1 is written by the game; **`edgeTex`** (default −1 = off) = the jamb texture drawn
  on the walls seen from inside a door cell, parallel to the passage. `PushWall` `{active, x, y,
  dx, dy, offset, tex}`: while `active` the block is a unit box at `(x + dx·offset, y + dy·offset)`;
  the grid's own walls in cells `(x, y)` and `(x+dx, y+dy)` are ignored for rays, and both cells
  block movement. The game steps `x, y` cell by cell and writes the wall back when it stops.
- `cast.ts` — `castRay(g, d, push, px, py, dirX, dirY, out, maxDist = 64)` → `boolean`; fills a
  reused `RayHit` (`newRayHit()`): `dist` = the ray parameter t (Euclidean for a unit dir;
  perpendicular for `camDir + plane·k`), `cellX/Y`, `side` (0 = x-side / vertical door, 1 =
  y-side / horizontal door), `u` 0..1 (walls: flipped per face so textures never read mirrored;
  doors: world coordinate along the plane − `open`), `tex` (0 = fallback; outside the grid hits
  with tex 0), `door` (index or −1). Doors: the plane at the cell centre; `u < open` passes. A wall
  in the start cell is ignored. `lineOfSight(g, d, push, x0, y0, x1, y1)` = no wall, closed door
  part or push wall on the segment (a door gap lets sight through).
- `textures.ts` — `defineRayTexture(id, gen)` (64 × 64 `PixelBuffer`; a wrong size is resized,
  transparent texels become ink, both with one warning); `rayTextureIndex(id)` = stable index in
  definition order from 1 (redefining keeps it), unknown → 0 = magenta / ink checker + one warning;
  `hasRayTexture`, `rayTextureId(i)`, `rayTextureCount()`, `listRayTextures()` (sorted).
  `rayTextureColumns(index, dark?)` → column-major `Uint32Array` (`[u·64 + v]`), dark = y-side
  variant (`stepShade(c, −1)`); built on first use. `defineRayBillboard(id, {size?: 64|96|128,
  yaws: 1|8, frames, worldW?, worldH?, gen(frame, yaw)})` (world size defaults to size / 64 tiles;
  with 8 yaws `gen` is called for yaws 0..4 only, 5/6/7 = mirrors of 3/2/1); `getRayBillboard(id)`
  (unknown → a 64 × 64 1-yaw checker + one warning); `hasRayBillboard`, `listRayBillboards()`.
  `billboardColumns(bb, frame, yaw)` / `billboardSpans(bb, frame, yaw)` (`first << 8 | last` opaque
  row per column, `0xFFFF` = empty; frames wrap, yaw is masked). `billboardYaw(actorAngle, ax, ay,
  camX, camY)` → 0..7: 0 = faces the viewer, 2 = faces the viewer's left (screen left), 4 = its
  back, 6 = screen right. `prepareRayAssets(prefixes?, onProgress?, {timeBudgetMs = 8, yieldFn,
  now})` → `{failed}`: textures then billboards, id order, slices of the budget, never rejects.
- `view.ts` — `RayView(w = 384, h = 176, density = 1)`: `buf` (w·density × h·density), `zbuf`
  (perpendicular wall distance per buffer column, `Infinity` = none), `focal` (296 × bufW / 384 —
  the same 66° field at any size), `colK` (per-column plane factor). `renderView(view, scene,
  cam)`: flat `ceil` / `floor` fill, one `castRay` per column, wall height `focal / dist`, the
  horizon at h/2; `cam.eyeZ` (0.5) is the eye height (lower = the walls rise, the death fall);
  `cam.squash` 0..1 scales everything vertically around the horizon and leaves the rows outside
  `TRANSPARENT` (0 = a 1-px line, the unfold). Sprites (`scene.sprites[0 .. spriteCount)`, each
  `{x, y, bb, frame, yaw}`) stand on the floor, centred, `focal·worldW / d` wide; drawn far → near
  (ties by index), per column only where `zbuf > d` and only inside the column span; texels with
  alpha 0 are skipped (no blending). Ends with `buf.touch()`. Present it with
  `r.image(view.buf, 0, 0, { screen: true, stream: true })`.
- `move.ts` — `tryMove(g, d, push, box, dx, dy, blockers?, self?)` → bit 1 moved on x, bit 2 on
  y. Axis-separated (x then y) square box (`r` = half-size); a blocked axis stops at the contact
  point (`MOVE_SKIN` = 1e-4 gap), so the box slides along walls. Blocks: outside, `CELL_SOLID` /
  `CELL_PROP`, a door with `open < 1`, both cells of the active push wall, and `Blockers` boxes
  (`newBlockers(max)`; `self` = the mover's own index). Obstacles the box already overlaps never
  block (it can walk out). `cellBlocks(g, d, push, x, y)` is the cell test.
- `areas.ts` — `new AreaMap(g, d)` floods `g.area` (1..255 over cells that are neither opaque nor
  doors; props belong to their room) and links each door's two sides (west/north = side 0).
  `setDoorOpen(door, open)` (the game decides when a door counts as open; the constructor takes
  `open > 0`), `computeReach(fromArea)` (BFS over open doors), `reached(area)`, `doorArea(door,
  side)`, `count`. A push wall that opens a new path needs a new `AreaMap`.
- **Recipe: render one frame headless.**

  ```ts
  import { DoorTable, RayGrid, RayView, defineRayTexture, rayTextureIndex, renderView, degToAng } from '../src/engine/ray';
  import { PAL } from '../src/engine/palette';
  defineRayTexture('fps/wall/x', () => myPainter());          // content does this once
  const g = new RayGrid(16, 16); const d = new DoorTable();
  g.setWall(0, 0, rayTextureIndex('fps/wall/x'));              // … fill the grid
  const view = new RayView();
  renderView(view, { grid: g, doors: d, push: null, ceil: PAL.stone[0], floor: PAL.stone[2], sprites: [], spriteCount: 0 },
    { x: 2.5, y: 2.5, angle: degToAng(0), eyeZ: 0.5 });
  savePNG(view.buf, 'tmp/x.png', 2);                           // tools/lib/image.ts
  ```

  A runnable example: `npx tsx tmp/fps-ray/look.ts` (the test level in
  `tests/engine/ray/fixture.ts`).
- **Measured cost:** 0.33 ms per 384 × 176 frame in Node (M-series Mac, a 48 × 48 hall with 36
  pillars and 40 sprites, 300 frames; `tests/engine/ray/view.test.ts` prints it). Budget: 2.0 ms.

## 2. Input actions

Spec: `docs/design/fps.md` §2. The 8-bit `Button` pad is unchanged; the first-person mode reads a
second channel that `InputManager` fills **for slot 0 only, only while `input.fpsMode` is on**.

**`src/engine/input-actions.ts`** (pure)

- `FpsAction` = `forward back turnLeft turnRight strafeLeft strafeRight strafe run fire use
  weapon1..weapon4 weaponNext weaponPrev` (bits 0..15, `FPS_ACTIONS` in bit order).
  `ACTION_BIT.fire === 1 << 8`, `ACTION_INDEX`, `ALL_ACTIONS = 0xffff`, `actionMask('forward', 'fire')`.
- `ActionPad`: `held(a)`, `pressed(a)`, `released(a)`, `heldTicks(a)` (a = name or bit index),
  `mask`, `pressedMask`, `releasedMask`, `anyPressed()`, `suppress(mask = 0xffff)` (held actions
  stay hidden until released; works even when the pad was not polled before), `reset()`.
- `AnalogState { turn, moveX, moveY }`: integers, cleared every tick. `turn` ±512 (+ = right,
  the angle grows), `moveX` ±127 (+ = right), `moveY` ±127 (+ = forward).
- `defaultFpsKeyMap()` / `FPS_KEY_CODES`, `defaultFpsPadMap()` (fixed in this wave),
  `actionsFromKeys`, `actionsFromPadButtons`, `actionsFromPad(mask)` (the 8-button fallback:
  up → forward, down → back, left/right → turnLeft/turnRight, fire → fire, jump → use,
  bomb → weaponNext, start → nothing).
- Sticks: `stickMove(ax, ay, out)` (0.2 radial dead zone, rescaled, × 127),
  `stickTurn(x)` (`round(48 × s²) × sign`), `stickScale(moveX, moveY)` (m),
  `stickSpeed(moveX, moveY, runHeld, walk, run)` (walk × m, or run × m when run is held or m > 0.9).
- Mouse: `turnPerPixel(s) = 0.6 × s`; `TurnAccumulator` (`add(px)`, `take()` → whole units, the
  rest carries; `sensitivity` 1..10).

**`InputManager`** (input.ts, additive): `actions: ActionPad`, `analog: AnalogState`,
`fpsMode: boolean`. Per tick, in fpsMode, every source gives `readActions(0)` or, without it,
`actionsFromPad(read(0))`; analog is the sum of every `readAnalog(0, out)`, then clamped. With
fpsMode off the actions are all up and analog is zero. `suppress()` also calls
`actions.suppress()` (all actions); `reset()` resets both. `InputContext.fpsMode` tells sources.
`InputSource` gains `readActions?(slot, ctx)` and `readAnalog?(slot, out, ctx)` (add into `out`).

**Browser sources**: `KeyboardSource` reports actions through `fpsKeys` (the whole keyboard → slot
0) and, in fpsMode, prevents the default of every `FPS_KEY_CODES` key (never with Ctrl/Meta/Alt).
`GamepadSource` in fpsMode merges every pad into slot 0: buttons via the pad map (OR), left stick →
`moveX`/`moveY`, right stick X → `turn` (per axis the largest pad wins). The sticks only feed the
analog channel (no action bits, so they never count twice). `PointerLockSource`
(`src/engine/pointer.browser.ts`): only while the canvas holds the lock and `enabled`:
movementX → `turn` (carried rest), left button → `fire`, right → `use`, wheel down/up →
`weaponNext`/`weaponPrev` (one step per ~100 px of wheel). It never reports 8-button masks.

**Tests and bots**: `new ScriptedSource(fn, slot, { actions?: (tick) => mask, analog?: (tick, out) => void })`.
Without `actions` the 8-button fallback applies, so old timelines and the 2D bot still move.

```ts
input.addSource(new ScriptedSource(() => 0, 0, {
  actions: (t) => (t < 60 ? ACTION_BIT.forward : ACTION_BIT.fire),
  analog: (t, out) => { out.turn = t < 30 ? 8 : 0; },
}));
input.fpsMode = true;
input.update(); // input.actions.held('forward'), input.analog.turn === 8
```

**Pointer lock and settings** (`src/main.ts`, `src/game/app.ts`): the fps scene sets
`app.pointerLockWanted` while it plays and clears it under menus. A click on the canvas takes the
lock when `pointerLockWanted && settings.mouseLook`; the click that takes it does not fire. The
lock is given back when either turns false (no pause for that). Losing it while wanted (Esc,
alt-tab) sets `app.focusLost = true` → the scene pauses. `app.pointerLocked` mirrors the lock (for
the `CLICK TO LOOK WITH THE MOUSE` hint; always false headless). main.ts copies
`settings.mouseLook` / `settings.mouseSensitivity` into the source every tick, so a change in
OPTIONS (also from the pause menu) applies at once. Settings: `mouseLook` (default true),
`mouseSensitivity` 1..10 (default 5), saved with the others; OPTIONS rows `MOUSE LOOK` (ON / OFF)
and `SENSITIVITY` (1–10) after GRAPHICS (rows now 10 px apart).

## 3. Fps game shell

Spec: `docs/design/fps.md` §1.5–1.7, §3.7, §4.1, §4.6–4.8, §5. All pure and deterministic.

- **Types** (`src/game/fps/types.ts`): `FpsThing`, `FpsFloorDef` (spec §5), `FpsEpisodeDef {id,
  floors}`, `FpsInput {held, pressed, turn, moveX, moveY}`, `FpsCarry {hp, ammo, weapons, weapon}`
  (`WEAPON_KNIFE..WEAPON_CHAINGUN` = 0..3), `FloorResult`, `FpsRun {slot, floor, carry,
  floorStartScore, results, entered?}`, `FpsEvents` (`floorComplete {result}`, `playerDead`,
  `message {text}`, `extend {lives}`, `secret {x, y}`, `door`). Payloads are reused: copy them.
- **Registry** (`registry.ts`): `defineFpsFloor(def)`, `getFpsFloor(id)` (unknown → undefined + one
  warning), `hasFpsFloor`, `fpsFloorByNumber(n)` (id `fps-<n>`, no warning), `listFpsFloors()`,
  `defineFpsEpisode`, `getFpsEpisode`.
- **`parseFloor(def, difficulty = 'normal')`** (`map.ts`) → `ParsedFloor {grid, doors, doorLock,
  start {x, y, angle}, actors, items, props, pushes, switches, turns, spawns, switchOnTex,
  warnings}`. The §5.1 legend: wall letters → `WALL_TEXTURES` (or `def.walls`), doors via
  `DoorTable.place` (+ `doorLock[i]`: `LOCK_NONE/GOLD/SILVER/LIFT`, `doors.edgeTex =
  fps/door/edge`), push walls = wall + `CELL_PUSH` (texture: `things.tex`, else the most common
  neighbour letter, ties N E S W), solid props = `CELL_PROP`, actors by char and difficulty
  (`ParsedActor {type, x, y, facing, ambush, patrol, char}`; default facing = the longest free
  run), pickups (`PICKUP_CHARS`) and props (`PROP_CHARS`) filtered by `things` min/max difficulty.
  Fail soft: an unknown char warns once and is floor; ragged rows are padded with wall; no start →
  the first floor cell. Helpers: `cardinalAngle(c)`, `cardinalIndex(angle)` (0 E, 1 S, 2 W, 3 N),
  `DIR_DX/DIR_DY`. Parse after the fps content is loaded (texture ids resolve then).
- **`FpsPlayer`** (`player.ts`): `box {x, y, r = 0.34}`, `angle`, `hp`, `ammo`, `weapons`,
  `weapon`, `keys` (`KEY_GOLD | KEY_SILVER`), `move(input, grid, doors, push, blockers?)` (spec
  §4.1: walk 0.09, run 0.15, key turn 24 / 44 with half speed for the first 6 ticks, analog turn,
  stick via `stickSpeed`, keys + stick clamped to the run speed, `strafe` turns the turn keys into
  strafes), `frontX/frontY` (the use cell), `reset(x, y, angle, carry|null)`, `carry()`.
  `freshCarry()` = knife + pistol, 8 ammo, HP 100.
- **`DoorSystem`** (`doors.ts`): `use(i, keys, blocked?)` → `'opened' | 'closed' | 'reopened' |
  'locked-gold' | 'locked-silver' | 'busy' | 'blocked'`; `step(blocked: (i) => boolean)` once per
  tick; `open(i)` (no key check; actors, debug). `state[i]` = `DOOR_CLOSED/OPENING/OPEN/CLOSING`,
  `prog[i]` 0..54 (`doors.open[i] = prog / 54`), `timer[i]`. 54 ticks to move, 258 open; blocked
  while open → waits, blocked while closing → opens again. It calls `AreaMap.setDoorOpen` when a
  door starts to open and when it is shut. `sfx(id, i)` hook: `fps/door-open`, `fps/door-close`,
  `fps/door-locked`.
- **`PushSystem`** (`pushwall.ts`): `push` (the engine `PushWall`), `use(x, y, dir, free)` →
  `'moved' | 'blocked' | 'busy' | 'none'`, `step(free)` → true on the tick it stops, `found`
  (secrets). 110 ticks per tile, at most 2 tiles; stops early when the next cell is not `free`;
  then a normal wall. The game floods a new `AreaMap` when it stops.
- **`FpsGame`** (`game.ts`): `new FpsGame({floor, difficulty, seed, slot, carry, audio, god?,
  run?})`. `step(input)`, `render(view)`, `stateHash()` (FNV-1a over the tick, the state, the
  player, doors, push wall, taken items and the rng words), `restart()` (re-parse, fresh loadout,
  rng seed + attempt, `slot.score = run.floorStartScore`), `carry()`, `setPose(x, y, angle)`,
  `skipUnfold()`, `use()`, `useElevator()` (F4 on floors 0/1), `hurt(n, fromX, fromY)` (→ 90-tick
  `dying` → `playerDead`), `addScore(points)` (extends → `extend` + `ONE MORE TRY!`),
  `message(text)` (`messages`: 2 lines, 90 ticks), `giveAll()` (F5), `cellOccupied(x, y)`,
  `isCellFree(x, y)`. Fields: `state` (`'play' | 'elevator' | 'dying' | 'dead' | 'done'`),
  `tick` (since the (re)start; the first `UNFOLD_TICKS` = 30 ignore input and `camera.squash`
  goes 0 → 1), `clock` (the floor time; stops at the elevator), `camera`, `map`, `grid`, `doors`,
  `pushes`, `areas`, `taken`, `rng`, `fxRng`. Items and props draw as billboards
  `fps/item/<id>` / `fps/prop/<id>` when registered (else nothing). The shell picks up keys only;
  group actors adds actors, combat and the other pickups here.
- **Run** (`run.ts`): `fpsSlotIndex(session)` (slot 0 when active, else 1), `fpsSlot`,
  `newFpsRun(session, floor)`, `emptyFpsInput()`.
- **Scenes:** `FpsIntroScene(app, {floor, run?, fromBridge?})` (spec §1.5; `loadFpsContent(app,
  onProgress?)` = one shared promise, never rejects; `fpsLoadState()` → `{registered, ready,
  frac}`; the card shows `MODE_TITLE`, `FLOOR n`, the name, lives and the controls hint; at least
  120 ticks, start after 60, auto at 180; the first entry calls `session.startMission('fps-<n>')`
  and sets `run.floorStartScore`). `FpsScene(app, run)` (spec §1.6): `enter`/`resume` turn on
  `input.fpsMode` + `app.pointerLockWanted` and suppress held actions; `pause`/`exit` turn them
  off; pause on `input.pausePressed`, `app.focusLost` or raw pad button 9; draws the view with
  `r.image(view.buf, 0, 0, {screen: true, stream: true})`, the death fade, a basic status bar
  (spec §8.6 layout), messages, the `CLICK TO LOOK WITH THE MOUSE` hint and, with `?debug=1`, the
  map (top right; F1 hides it). A death: `slot.loseLife()` → `game.restart()` behind a 60-tick
  `FLOOR n / LIVES n` card; the last life → `GameOverScene` (until group flow wires the
  `ContinueScene`). The pause menu gets a stand-in host until `PauseHost` exists.
- **Route** (`scenes/fps-route.ts`, group flow takes it over): `startFpsRun(app, {floor,
  fromBridge?})`, `fpsFloorDone(app, run, result)`, `fpsTallyDone(app, run)` (the next floor's
  intro, else the title; floor 0 → the title).
- **`?mode=fps&floor=n`** (`params.ts`: `mode?: 'fps' | 'bridge'`, `floor?: 0..2`, default 1 with
  `mode=fps`; both absent otherwise): the boot makes a new session + campaign and calls
  `startFpsRun`. A floor that is not registered yet plays floor 0 (with a warning).

## 4. Actors, combat, pickups, HUD

- Actor pool, the state table, per-type numbers (spec §4.3). TODO (group cast / actors)
- Sight, noise, ambush, patrol, attack tokens (spec §4.4). TODO (group cast / actors)
- Hitscan both ways, damage bands (spec §4.2, §4.3). TODO (group cast / actors)
- Weapons and switching. TODO (group cast / actors)
- Pickups, keys, treasure, score through `PlayerSlot.addScore`. TODO (group cast / actors)
- HUD drawing (`hud.ts`, spec §8.6), face states, messages, `bossBar` / `subtitle` fields. TODO (group cast / actors)
- Positional audio (`audio.ts`) and the spoken lines (`content/fps/lines.ts`). TODO (group cast / actors)

## 5. Floors, boss, tally, bot

- Floor 1 and floor 2 (`content/fps/floor-1.ts`, `floor-2.ts`), the episode. TODO (group floors)
- `validate.ts` — the rules of spec §5.3. TODO (group floors)
- MechaHitler (`boss.ts`): phases, events, reinforcements, death-cam. TODO (group floors)
- `FpsTallyScene`. TODO (group floors)
- `bot-fps.ts` and `npm run sim -- --mode fps`. TODO (group floors)
- Play-test notes (seeds, difficulties, results). TODO (group floors)

## 6. Content registration and tools

- Lazy manifest entries `fps` (`content/fps/index.ts`: `textures-basic.ts` + `floor-0.ts`),
  `fps/art`, `fps/sound`, `fps/floors` (stubs until their groups fill them).
  `isLazyContent(id)` (`id === 'fps' || id.startsWith('fps/')`); `loadContent()`'s default filter
  is `(id) => !isLazyContent(id)`, so the boot, the sims and the 2D tools load what they loaded
  before. The fps mode loads with `loadFpsContent` (spec §1.5) or `loadContent(isLazyContent)`.
  Tools that must see every sound use `loadContent(() => true)` (spec §3.6).
- `content/fps/textures-basic.ts`: placeholder textures for every §8.1 id and placeholder
  billboards for every §4.5 item and §5.1 prop. Each id is defined only when it is not registered
  yet, so the real art wins whatever the load order (hand-over to group art).
- `content/fps/floor-0.ts`: `fps-0` "TEST RANGE" (spec §6.0; the wall letters show every texture
  `A`–`P` along room A; hand-over to group actors).
- Pure data modules that eager scenes may import: `content/fps/names.ts` (`MODE_TITLE =
  'OPERATION ???'`, no imports). `content/fps/story.ts`: TODO (group flow)
- Art registration (`content/fps/art.ts` and its files; ids spec §8). TODO (group cast / art)
- Sound registration (`content/fps/sound.ts`; ids spec §9). TODO (group cast / fps-sound)
- `src/sim/headless-fps.ts`: `createHeadlessFps({floor = 0, seed, difficulty, god, players, input:
  {actions?(tick), analog?(tick, out)}, pose: {x, y, deg}, unfold = false, loadBase = false})` →
  `{app, input, session, run, scene, game, ticks, complete, step(n), runUntil(pred, max),
  setPose(x, y, deg), renderFrame(), report(), dispose()}` (the real app + `FpsScene`, software
  renderer, `SimAudio`; it clears the scene's enter-suppression so a script may hold from tick 0).
  `runFps(o + {maxTicks})` → `FpsReport {floor, seed, ticks, complete, deaths, kills, secrets,
  treasure, stateHash, errors, warnings, missingSfx}`.
- `npm run shot -- --fps n [--pose x,y,deg[;x,y,deg…]] [--ticks n] [--every n --count k] [--hold
  forward,use] [--seed] [--difficulty] [--god] [--unfold] [--out] [--scale] [--cols]` → a labelled
  sheet (`tmp/shots/fps-<n>[-sheet].png`); one frame per pose, or a timeline for one pose; `use`
  and `fire` in `--hold` are tapped. Degrees: 0 east, 90 south.
- `npm run sprites -- fps/ [--ray]`. TODO (group cast / art)
- `npm run sim -- --mode fps --floor n`. TODO (group floors)

## 7. Flow

- `MissionDef.after`, the GameplayScene hook. TODO (group flow)
- `recordMissionClear`, `silentTally`, the `'fps/ams-bonus'` record. TODO (group flow)
- `GlitchBridgeScene` (phases spec §1.3). TODO (group flow)
- `PauseHost`, `Continuable`. TODO (group flow)
- `EndingScene({ variant: 'fps' })`, `goldenRecordRoute`, `missionColumn` (`F1`, `F2`). TODO (group flow)
- `?mode=bridge`. TODO (group flow)
