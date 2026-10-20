# First-person mode API — ray engine, input actions, fps game, content, tools

Spec: `docs/design/fps.md` (it wins over this file when they disagree; fix this file then).
Originality: `docs/ORIGINALITY.md` ("Exception: the first-person mode"). Art rules:
`docs/ART_GUIDE.md` §10. Every section describes the shipped code (polish-fix 2026-10-16: no open
`TODO` marks). Keep it short: what a caller needs, not the internals.

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
- `AnalogState { turn, moveX, moveY }`: integers, cleared every tick. `turn` ±2048 (+ = right,
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
  warning), `hasFpsFloor`, `fpsFloorByNumber(n)` (id `fps-<n>`, no warning), `defineFpsEpisode`,
  `getFpsEpisode`. The route goes by floor number (`fpsTallyDone`: floor + 1 while it is
  registered); the episode `ostia` = [`fps-1`, `fps-2`] records the same order (a floors test).
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
  `isCellFree(x, y)`, `fireOff` (the suit breaks: fire is masked out of the weapon input and
  `weaponLower` takes the view down 60 px, 8 px per tick). Fields: `state` (`'play' | 'elevator' |
  'dying' | 'dead' | 'done' | 'deathcam'`),
  `tick` (since the (re)start; the first `UNFOLD_TICKS` = 30 ignore input and `camera.squash`
  goes 0 → 1), `clock` (the floor time; stops at the elevator), `camera`, `map`, `grid`, `doors`,
  `pushes`, `areas`, `taken`, `rng`, `fxRng`. Items and props draw as billboards
  `fps/item/<id>` / `fps/prop/<id>` when registered (else nothing). The shell picks up keys only;
  group actors adds actors, combat and the other pickups here.
- **Run** (`run.ts`): `fpsSlotIndex(session)` (slot 0 when active, else 1), `fpsSlot`,
  `newFpsRun(session, floor)`, `emptyFpsInput()`, `reserveLives(slot)` (= `max(0, lives − 1)`: the
  count every fps screen shows, spec §4.13), `AMS_BONUS_KEY` (`'fps/ams-bonus'`: the one key the
  bridge writes and the floor-1 tally reads).
- **Scenes:** `FpsIntroScene(app, {floor, run?, fromBridge?})` (spec §1.5; `loadFpsContent(app,
  onProgress?)` = one shared promise, never rejects; `fpsLoadState()` → `{registered, ready,
  frac}`; the card shows `MODE_TITLE`, `FLOOR n`, the name, `LIVES` (reserve lives) and the
  controls hint; at least 120 ticks, start after 60, auto at 180; the first entry calls
  `session.startMission('fps-<n>')` and sets `run.floorStartScore`; when neither the floor nor
  floor 0 is registered (the lazy chunk failed) it warns and goes to the title — fail soft). `FpsScene(app, run)` (spec §1.6): `enter`/`resume` turn on
  `input.fpsMode` + `app.pointerLockWanted` and suppress held actions; `pause`/`exit` turn them
  off; pause on `input.pausePressed`, `app.focusLost` or raw pad button 9; draws the view with
  `r.image(view.buf, 0, 0, {screen: true, stream: true})`, the weapon view (not during the
  death-cam), the damage feedback, the death fade, the boss band, the status bar (spec §8.6;
  `HudInfo.lives` = reserve lives), messages, the `CLICK TO LOOK WITH THE MOUSE` hint
  (`lookHintOn()`: 300 ticks after the start, a resume or the restart card; never over a subtitle),
  the death-cam fade over the whole screen (`r.fade`, `game.fade`) and, with `?debug=1`, the map
  (top right; F1 hides it). A death: `slot.loseLife()` → `game.restart()` behind a 60-tick
  `FLOOR n / LIVES n` card; the last life → `ContinueScene(app, this)`. FpsScene is the
  `PauseHost` (`applySettings`) and the `Continuable` (`continuePlayer`, `resumeMusic`,
  `startPressed`: any start key for the fps slot, `acceptsSlot(i)`: only the fps slot acts on the
  continue screen).
- **Route** (`scenes/fps-route.ts`): `startFpsRun(app, {floor, fromBridge?})` (no session → the
  title), `fpsFloorDone(app, run, result)` (→ `FpsTallyScene`), `fpsTallyDone(app, run)` (floor 0 →
  the title; the next registered floor's intro; after the last floor →
  `EndingScene({ variant: 'fps' })`).
- **`?mode=fps&floor=n`** (`params.ts`: `mode?: 'fps' | 'bridge'`, `floor?: 0..2`, default 1 with
  `mode=fps`; both absent otherwise): the boot makes a new session + campaign and calls
  `startFpsRun`. A floor that is not registered yet plays floor 0 (with a warning).

## 4. Actors, combat, pickups, HUD

Spec: `docs/design/fps.md` §4.2–4.5, §4.9–4.10, §8.6, §9.1, §9.3. All simulation code is pure and
deterministic: every roll that changes the game uses `game.rng`; cosmetic choices (voice line,
blood size, face glance) use `game.fxRng`. No allocations per tick.

- **Actors** (`src/game/fps/actors.ts`): `ACTOR_TYPES` (`guard`, `officer`, `ss`, `dog`, and a
  `boss` stand-in with the phase-1 numbers) — `hp [E, N, H]`, `patrol`, `chase` (tiles/tick),
  `reactMin..reactMax`, `tell`, `burst` / `burstGap`, `recover`, `pain`, `score`, `drop`
  (`'clip' | 'ss' | 'none'`), `radius` (0.4, dogs 0.3), `bite`, `opensDoors`, `tokens`, `dodges`,
  `moveSheet` / `actSheet` (billboard ids, spec §8.2), `frames` (act frames), `dieTicks`,
  `shotSfx`, `tellSfx`, `speaker`, `hitBase` / `hitBaseRun`. State ids `ST_STAND … ST_DEAD`
  (`STATE_TABLE` names them). `Actor` (pool object: `x, y` centre; `cx, cy` cell; `tx, ty` reserved target;
  `dir` 0..7 or −1; `angle`; `hp`; `state`, `timer`; `react` (reaction delay left: noticed but
  still unaware); `ambush`, `patrol`, `placed`; `token`; `shots`; `tellDone` (ticks of the last
  full tell); `walked`; `pool` (blood pool frame); `spurt`; `alive` (not dying), `aware`).
  `ActorPool` (128 preallocated): `reset(w, h)`, `spawn(type, x, y, angle, difficulty, placed?)`,
  `spawnParsed(list, difficulty, angleOf)`, cell occupancy (`occupant`, `claim`, `release`,
  `cellTaken`: one actor per cell, the target cell reserved), `turns` / `setTurn` (patrol
  markers), `buildBlockers()` (the player's `tryMove` blockers: living actors only), `frameOf(a,
  camX, camY, out)` (sheet, frame, yaw), `kills`, `placedTotal`, `tokensUsed`. Hooks for group
  floors: `bossThink(g, a) → handled`, `bossDamage(g, a, dmg) → dealt`; `onShot(e)` for tests.
  `billboardOf(id)` = the billboard or null when not registered (drawn as nothing).
- **AI** (`ai.ts`): `STATE_TABLE` (one `think` per state), `stepActors(g)` once per tick.
  `canSee` (front half or within 1.5 tiles, plus `lineOfSight`; closed door parts block),
  `notice` (start the reaction delay), `makeNoise(g)` (a gun shot: every non-ambush actor whose
  area the player's area reaches over open doors notices; the knife is silent), `startTell`,
  `damageActor(g, a, dmg)` (× 2 when unaware, not the boss; pain cancels a tell; death),
  `killActor` (score through the slot, kill count, blood, death line, drop: guard / officer
  `clip-drop`, SS `mg` when the player has none else `clip-drop`), `canStep`, `chooseChase`
  (diagonal → major → minor → any → reverse; people with sight dodge half of the time),
  `choosePatrol` (facing, turn markers, reverse when blocked). People open unlocked doors and wait;
  dogs need an open door. Attack: in `chase` with sight and a free token (3 / 4 / 6), each tick
  `rng(0..255) < floor(19 / max(1, floor(d)))`, always at `d < 1`; dogs at `d ≤ BITE_REACH` (1.5: the spec's 1.0 plus the player's offset from
  a cell centre, else a player on a cell corner is never bitten). A hit on an unaware actor wakes it
  (shout, `actorWoke`), then `pain`. Every attack
  = tell (≥ 18 ticks, `fps/enemy/aim` / `fps/dog/growl`) → shots (`ShotEvent {actor, damage,
  tell, tick}`) → recover → chase. One alert shout per 30 ticks per floor (`audio.say` when
  `hasVoice`, else `fps/shout-<type>`; dogs bark). `MIN_TELL = 18`.
- **Hitscan** (`hitscan.ts`): `bandDist` (Chebyshev), `playerDamage(rng, weapon, d)` (spec §4.2
  bands; knife `d ≤ 1.25`), `findTarget(pool, grid, doors, push, x, y, angle)` (nearest living
  actor within `max(aimWidth(d) = max(0.35, 0.06 d), its box half-size)` of the aim line, in sight
  (of its centre or of the aim-line point beside it), not behind the centre
  column's wall), `enemyHitChance(d, ran, inView, base?, baseRun?)`, `enemyDamage`, `bossDamage`,
  `biteDamage`, `scaleForDifficulty` (EASY × 0.5 rounded up), `VIEW_HALF = 375`, `RUN_MOVE =
  0.12`.
- **Weapons** (`weapons.ts`): `WEAPONS[0..3]` (`cycle`, `shotOn`, `hold` = `repeat` / `press` /
  `auto`, `queueFrom` 14 for the pistol, `noise`, `sfx`, `view` sprite id). `WeaponSystem`:
  `step(player, input) → shot this tick`, `request(p, w)`, `cycle(p, ±1)` (skips weapons not
  owned or without ammo), 8 + 8 tick switch (`viewDrop()`), out of ammo → the knife, `viewFrame(p)`
  (0 idle, 1 flash, 2 fire B, 3 recover; knife: idle, wind-up, stab, return), `shots`.
  `usable(p, w)`.
- **Pickups** (`pickups.ts`): `applyPickup(host, id) → taken` with the §4.5 caps and refusals (HP
  100, ammo 99, the blood pool only at ≤ 10 HP, a weapon refused when owned at 99 ammo, the 1UP
  never: full lives → `ONE_UP_SCORE` points), `TREASURE_SCORE`, `PICKUP_MESSAGES` (each ≤ 128 px),
  the first ammo on an empty pool raises the best gun. `ItemList` (placed items first, then up to
  128 drops: `add`, `at`, `treasure()`); `FpsGame.taken` is a view of its placed part.
- **Positional sound** (`audio.ts`): `panVol(out, lx, ly, angle, x, y, reached, tell)` = spec §9.1
  (pan `clamp(sin rel, ±0.8)`, vol `max(0.15, 1 − d/20) × (reached ? 1 : 0.35)`, tells ≥ 0.5).
  `FpsSound`: `setListener(...)` once per tick (it also computes the area reach that the noise rule
  reads), `reachedCell(x, y)`, `play(id)` (at the player), `at(id, x, y)`.
- **HUD** (`hud.ts`): `HudState` (face glance by `fxRng` 1:2:1 every 30–90 ticks, `ouch` 30 ticks
  at ≥ 20 damage in one tick, `grin` 60 ticks, damage flash 6, pickup flash 4, edge markers 12;
  `faceFrame(hp)` = dead > ouch > grin > band × 3 + glance), `healthBand`, `edgeSide(rel)`.
  Draw: `drawStatusBar(r, src, info)` (§8.6 layout; `fps/hud/bar`, `fps/face/<character>`
  (fallback `recruit`), `ui/icon-life`, `fps/hud/key`, `fps/hud/weapon`; an id that is not
  registered draws a plain stand-in, never magenta), `drawWeaponView` (`fps/view/<weapon>`, anchor
  bottom-centre at (192, 176 + bob ± 2)), `drawFeedback` (flashes × 0.3 with REDUCE FLASHES; edge
  markers never reduced), `drawMessages`, `drawBossBand` (`bossBar`, `subtitle`), `messageFits`.
- **Game wiring** (`game.ts`): `actors`, `items`, `weaponSys`, `sound`, `hud`, `playerMove`,
  `walked`, `lastShout`, `bossBar {visible, name, frac, phase}` and `subtitle {text, ticks}` (group
  floors fills them; `speak(line, subtitle?, ticks?)`), `dropItem`, `turnAt`, `addLife`, hooks
  `actorWoke(a)` / `actorKilled(a)`. `step`: doors → push wall → `sound.setListener` → player
  move (actor blockers) → use → weapon (a shot: `findTarget` → `playerDamage` → `damageActor`;
  gunfire → `makeNoise`) → pickups → `stepActors` (also while dying and in the elevator) → HUD.
  `hurt(n, fromX, fromY)` also sets the face, the flash and the edge marker. `cellOccupied`
  counts living actors (doors stay open on them); `isCellFree` (push walls) also refuses items,
  drops and corpses. `stateHash` mixes the actors, the items and the weapon state.
- **Lines** (`content/fps/lines.ts`): `ALERT_LINES`, `DEATH_LINES` (guard, officer, ss),
  `BOSS_TAUNTS` (taunts 1–6 verbatim from spec §7.4, the Dutch ones with their `\n`),
  `ALL_FPS_LINES`; each `{speaker, text, meaning}`.
- **Floor 0** (`content/fps/floor-0.ts`): a patrolling guard and a dog in room B, an officer and
  the chaingun in room C, an ambush SS in the east room, the other pickups and the four treasures
  along the south wall of room A; nothing in sight of the start.
- **Tests** (`tests/game/fps/{actors,ai,hitscan,weapons,pickups,hud}.test.ts`): wake by sight
  (cone, 1.5-tile all-round, doors block) and noise (not through closed doors; ambush ignores it;
  the knife is silent), a ≥ 18-tick tell before every damaging event over long seeded fights with
  every type, attack tokens, SS bursts, damage distributions per band, × 2 on unaware actors, fire
  rates, the pistol queue, switching, the out-of-ammo knife, every pickup cap and refusal, drops,
  blood and corpses, messages ≤ 128 px, the face and the edge markers, determinism with combat.

## 5. Floors, boss, tally, bot

### 5.1 Floors and the episode (`content/fps/{floor-1,floor-2,episode,floors}.ts`)

- The lazy manifest entry `fps/floors` imports `floor-1.ts`, `floor-2.ts` and `episode.ts`.
- `FLOOR_1` — `fps-1` "SUPPLY DEPOT", 48 × 48, par 210 s, `secrets: 5`, music `fps-floor`.
  The forced key loop of spec §6.1 (freight car → yard → barracks → mess hall → fuel store →
  motor pool, gold key (27, 15) → warehouse, silver key (2, 27) → officers' wing → silver door →
  corridor → elevator, switch `X` (45, 6)). Enemies E / N / H 22 / 34 / 46; 12 treasures
  (20,300 points); the golden record in S4 (28, 11). `things[]`: the yard dog patrols y 36
  (turn markers (3, 36) E, (15, 36) W), two barracks guards sleep (`ambush`), a warehouse guard
  patrols y 20 (turn markers (2, 20) E, (19, 20) W).
- `FLOOR_2` — `fps-2` "HANGAR", 32 × 32, par 150 s, `secrets: 2`, `boss: true`, ceiling
  `PAL.navy[0]`, floor `PAL.steel[1]`, music `fps-floor` (boss.ts switches to `fps-boss` when he
  wakes; a restart switches back). MechaHitler `@` (15, 4) facing S; spawn points (4, 10) and
  (27, 10) all, (4, 9) NORMAL+, (27, 11) HARD; one extra clip (5, 27) on HARD only (rule 8).
- `FPS_EPISODE` (`id: 'ostia'`): `['fps-1', 'fps-2']`. Par times and songs live on the floor defs.
- Map edits: draw with the §5.1 legend, then run `tests/game/fps/validate.test.ts`.

### 5.2 Validators (`src/game/fps/validate.ts`)

```ts
validateFloor(def: FpsFloorDef): { errors: string[]; warnings: string[]; budget: { easy?, normal?, hard?: AmmoBudget } }
```

Parses the floor on every difficulty and checks spec §5.3 rules 1–11 (size, closed border, one
start, doors with walls and floor, things not on walls/doors, keys reachable before their doors
with secrets solid, every push wall pushable from a reached cell into a free cell (pushes are
simulated, 2 tiles, stopping early), every item reachable after the pushes, the push-wall count,
one golden record inside a secret, the ammo budget (error on NORMAL, warning on EASY / HARD), the
fair start (no line of sight to the start with the doors closed), the reinforcement spawns behind
doors (2 / 3 / 4) and the boss-fight ammo). `budget` gives the numbers (floor 1 NORMAL: 34
enemies, 1206 HP, 150 rounds; floor 2 NORMAL: 175 arena rounds ≥ 144). Load the fps content
first (textures). `room(cells, x, y)` floods a room without doors.

### 5.3 MechaHitler (`src/game/fps/boss.ts`)

- `installBoss(g)` runs in `FpsGame.load` (every attempt): it finds the `'boss'` actor and sets
  `ActorPool.bossThink` / `bossDamage`; `g.boss` is the `FpsBoss` (null on floors without one).
- `FpsBoss`: `phase` 1 | 2, `awake`, `breakT` (−1 or the break ticks), `taunts` (bit n = taunt
  n + 1 given), `reinforced` (bit 0 = the 50 % wave, bit 1 = the 25 % wave), `firstBay` (0 west, 1
  east), `wreckX/Y`, `leash` (his room without one-cell pockets: no alcoves, no corners; the wreck
  cell leaves it when the wreck appears), `think()`, `damage(dmg)`, `wake()`, `taunt(n)`,
  `reinforce(wave)`, `slowStep()`,
  `debugSkip()` (debug F4 via `FpsGame.debugSkip()`: phase 1 → a fatal suit hit, so the 50 %
  events and the break; phase 2 → he dies; nothing during the break or the die frames).
- Numbers (spec §7.2) are constants: `BOSS_HP`, `BOSS_TELL_1` 30 / `BOSS_TELL_1_LOW` 24 (below
  25 %) / `BOSS_TELL_2` 24, `BOSS_SHOT_GAP` 4 (bursts of 8 / 6), recover 45 / 40,
  `BOSS_MIN_CHASE_1/2` 45 / 30, `BOSS_ATTACK_ROLL` 24, `BOSS_ATTACK_CAP` 120, `BOSS_LOST_TICKS`
  180, `BREAK_TICKS` 120, `DEATHCAM_SLOW/HOLD/FADE` 150 / 60 / 30, `REINFORCE_REACT` 30,
  `REINFORCE_MESSAGE`. Phase 2 is the
  `BOSS_FOOT` def in actors.ts (`actor.def` is swapped; radius 0.34, pain 6).
- Behaviour: stands until he sees the player or is hit → horn, taunt 1, music `fps-boss`, the
  bar. Chase toward the player (stops at 2 tiles; leash BFS path, tile centre to tile centre);
  without sight he holds, after 180 ticks he walks to the last seen cell. The attack starts in
  chase with sight after the minimum chase ticks with chance 24/256 per tick, always at 120; the
  counter pauses without sight and resets at the tell. Suit hits only spark (no pain). Events:
  75 % taunt 2; 50 % taunt 3 + `reinforce(0)`: the bay (west / east half of the map) farther from
  the player; 25 % `reinforce(1)`: the other bay (bay doors within 3 cells of a spawn open, the
  horn, the message `REINFORCEMENTS!`; SS with `placed = false` stand `REINFORCE_REACT` ticks, then
  shout and chase; a spawn point within `SPAWN_CLEAR` = 3 tiles of the player stays empty); 0 →
  the break (invulnerable, the player's fire is off — `FpsGame.fireOff` —, `forceFrame` act 5–8, 25,000,
  `fps/boss/break`), then the wreck (`g.addProp('fps/boss/wreck', …, solid)`; an item under it
  moves aside), he jumps out on the free cell next to it nearest to the player, taunt 4, two
  `clip` items spill onto the free cells next to it farthest from him. On foot: pain 6 ticks only
  out of chase; 50 % taunt 5; 0 → 50,000, a kill (`placed`), taunt 6, `g.startDeathCam(actor)`.
- Taunts use `g.speak(line, line.meaning, subtitleTicks(text))`: the longest of 150, 30 + 5 per
  letter and the voice clip + 30 ticks (`getSampleGroup('mode:fps').voice[voiceKey(text)]`), so no
  subtitle ends before its voice.
- Hooks added to `actors.ts`: `Actor.forceFrame` (an act-sheet frame instead of the state's,
  −1 = off), `ActFrames.tell2` (the suit's two-frame tell), `BOSS_FOOT`. The act frame order is
  the art group's (mech: tell 0–1, fire 2–3, pain 4, break 5–8; foot: tell 0, fire 1–2, pain 3,
  die 4–9, dead 10).
- Hooks added to `game.ts`: `boss`, `fade` (0..1; FpsScene draws it over the whole screen),
  `addProp(bbId, x, y, solid)`, `startDeathCam(actor)` (also puts the weapon to idle), the
  state `'deathcam'`: input off, the others frozen, doors / push wall / the boss step once per 3
  ticks for 150 ticks, the camera turns to him over 30 ticks and moves in along the clear line to
  `DEATHCAM_NEAR` = 2.8 tiles over `DEATHCAM_DOLLY` = 60 ticks (`render()` skips a prop within
  0.9 tiles of the line from the camera to him, so the wreck never hides his fall), `fps/boss/fall` at the last die
  frame, 60 ticks hold, 30 ticks fade, then `floorComplete`. The floor clock only runs in
  `'play'`, so it stops at his 0 HP (and at the elevator). `restart()` on a boss floor plays the
  floor's song again.

### 5.4 `FpsTallyScene` (`src/game/scenes/fps-tally.ts`)

- `new FpsTallyScene(app, run, result)`; `fpsFloorDone` (flow) shows it, `next` →
  `fpsTallyDone(app, run)`.
- Pure maths: `fpsTally(result, { par, mul, slot, amsBonus?, otherJoined? }) → { lines, raw,
  total, killPct, treasurePct, seconds }`, `ratioPct` (rounded down, ≤ 100, 0 / 0 = 100),
  `tallySeconds` (rounded up), `clockText` (m:ss). Lines: KILLS, SECRETS, TREASURE (10,000 each
  at 100 % / all), TIME `m:ss  PAR m:ss` ((par − s) × 500 under par), on floor 1 the info lines
  `MISSION 1 BONUS` (+ `<tag> MISSION 1 BONUS` for the joined waiting slot) read from
  `session.records.get('fps/ams-bonus')` (`AMS_BONUS_KEY` from `fps/run.ts`, written by the bridge), DIFFICULTY, TOTAL
  (= round(raw × `session.mods.tallyScore`)).
- Page: `drawPanel` 304 × 188, `<NAME> CLEARED` big gold y 16, `FLOOR n` y 30, the slot tag top
  right, a line every 30 ticks from tick 40 (`ui/tally-tick`, TOTAL `ui/tally-end`,
  `fps/tally-100` on a 100 % line), TOTAL counts into the score (`slot.addScore`, extends with
  `item/1up`), PRESS START when done; the first press shows all and pays out; auto at 600
  ticks. `enter`: music `fps-tally`, records `fps-N` in `campaign.missions`,
  `campaign.goldenRecords[slot]` (with the record) and `session.completed`. `next` also sets
  `run.floorStartScore` to the score after the tally.

### 5.5 Bot and sim (`src/sim/bot-fps.ts`, `tools/sim.ts`)

- `new FpsBot(() => game, seed)` with `actions(tick)` / `analog(tick, out)` for a
  `ScriptedSource`; `createHeadlessFps({ bot: true })` wires it (`h.bot`). Per tick: fight the
  nearest living enemy in line of sight (in the boss fight any other enemy in sight within 14
  tiles first, and below 20 rounds it fetches a clip between his bursts — polish-fix 2026-10-16;
  turn up to 96 units, fire when the aim line is on it;
  the pistol taps, the knife walks in); else BFS (walls, solid props, push walls and locked doors
  without the key block) to: health when HP < 40, ammo when < 20 or on the knife, an unowned gun,
  the gold key, the silver key, ammo before the boss wakes, the boss, the elevator switch (face
  it and use). Closed doors on the path: face and use. No progress for 90 ticks → back off and
  strafe 20 ticks. `goal`, `goalX/Y` for traces.
- **The boss tactic** (floors-verify, 2026-10-16): with a gun up the bot keeps MechaHitler at a
  band distance of 2.6–5 tiles (the 1..42 band; from across the arena most bullets miss and a
  bullet did 4–8 damage), runs sideways through his tell and burst (running lowers his hit
  chance; it flips side when blocked) and holds fire while the suit breaks. A bullet now does
  14–18 damage on average over the fight (rule 11 assumes 19); `tests/sim/fps-bot.test.ts`
  checks ≥ 12.
- `FpsReport` (headless-fps.ts) now has `kills` / `killsTotal` (from `actors`), `secrets` /
  `secretsTotal`, `treasure` / `treasureTotal` / `goldenRecord` (from `items.treasure()`),
  `score`, `clock`, `bossPhase`, `bossDead`, `hp`, `ammo`.
- `npm run sim -- --mode fps --floor 1|2 [--god] [--seed n] [--difficulty easy|normal|hard]
  [--max-ticks 36000] [--expect-complete] [--out file] [--trace N] [--quiet]`. Exit code 1 on
  errors or (with `--expect-complete`) when the floor did not end.

### 5.6 Play-test notes (2026-10-16, the bot; re-run by floors-verify)

| Run (seeds 1 / 2 / 3) | Result |
|---|---|
| floor 1, god, NORMAL | complete in 3951 / 4494 / 3974 ticks (66–75 s, par 210), kills 33/34, 0 deaths |
| floor 2, god, NORMAL | complete, boss dead, 0 deaths (seed 1: 2558 ticks) |
| floor 1, no god, EASY | complete in 3130 / 3268 / 3458 ticks, kills 22/22, 0 deaths |
| floor 1, no god, NORMAL | complete in 3951 / 4494 / 3974 ticks, kills 33/34, 0 deaths |
| floor 1, no god, HARD | complete in 14130 / 9636 / 6181 ticks, kills 45/46, 2 / 1 / 0 deaths |
| floor 2, no god, EASY | complete in 1847 / 1543 / 1715 ticks, 0 deaths |
| floor 2, no god, NORMAL | seed 1: 3 deaths (two in phase 2 out of ammo at 450–550 HP, one in phase 1); seeds 2 / 3: complete in 1906 / 2445 ticks, 0 deaths, ending with 0 ammo and 61 / 15 HP |
| floor 2, no god, HARD | 3 deaths on every seed: after a death the fresh loadout (pistol, 8 rounds) meets 3 guards + 2 SS at the lift door; in the arena the bot runs dry in phase 1 or 2 |

Every floor-2 run starts with the fresh loadout (no floor-1 carry), the hardest case. The
survivor on floor 1 is the officer in the office at (7, 4): the bot skips the office (it does not
collect treasure). The bot never opens secrets and has perfect aim; a human check of the boss
fight on NORMAL / HARD is still open.

## 6. Content registration and tools

- Lazy manifest entries `fps` (`content/fps/index.ts`: `textures-basic.ts` + `floor-0.ts`),
  `fps/art` (`content/fps/art.ts`: textures, billboards incl. `fps/fx/sparks`, props, items,
  weapon views, faces, HUD), `fps/sound` (`content/fps/sound.ts`: `sfx.ts` + `music.ts`, the synth
  for every §9 id) and `fps/floors` (`content/fps/floors.ts`: floors 1 and 2 + the episode).
  `isLazyContent(id)` (`id === 'fps' || id.startsWith('fps/')`); `loadContent()`'s default filter
  is `(id) => !isLazyContent(id)`, so the boot, the sims and the 2D tools load what they loaded
  before. The fps mode loads with `loadFpsContent` (spec §1.5) or `loadContent(isLazyContent)`.
  Tools that must see every sound use `loadContent(() => true)` (spec §3.6).
- `content/fps/textures-basic.ts`: a re-export that imports the real §8.1 textures (the
  placeholders are gone; the art group's files define every id).
- `content/fps/floor-0.ts`: `fps-0` "TEST RANGE" (spec §6.0; the wall letters show every texture
  `A`–`P` along room A; hand-over to group actors).
- Pure data modules that eager scenes and `src/game/fps/` may import: `content/fps/names.ts`
  (`MODE_TITLE = 'OPERATION OSTIA'`, no imports), `content/fps/story.ts` (the bridge card lines,
  `withCallsign`), `content/fps/lines.ts` (every spoken string, verbatim for `voiceKey`).
- Samples: the `mode:fps` group (sfx, the four songs, the German shouts, the Mecha Hofmans taunts)
  loads in `loadFpsContent` (10 % of the bar, capped at `FPS_SAMPLES_MAX_MS` = 3 s; the synth fills
  in). docs/api/audio-pipeline.md has the takes.
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
- `npm run sprites -- fps/` (the weapon views, faces, HUD sprites) and `npm run sprites -- fps/
  --ray` (the textures and billboards; one row per yaw).
- `npm run sim -- --mode fps --floor n` (§5.5). `npm run smoke -- --query "mode=fps&floor=1"`
  (or `mode=bridge`; `mission=ams&boss=1&debug=1` plays the whole route and adds `god=1` itself).
  `npm run perf -- --query "mode=fps&floor=1&god=1"` measures the fps scene (it waits for a scene
  with a `runner` or a `game`).

## 7. Flow

- `MissionDef.after?: 'fps'` (`mission/types.ts`; ams sets it): on the mission's `complete`
  GameplayScene replaces itself with `GlitchBridgeScene(app, { from, runner })` instead of the
  tally (no MISSION 2).
- `recordMissionClear(app, runner)` (`scenes/flow.ts`): the campaign's mission list and golden
  records (both routes call it; idempotent). `silentTally(app, runner)` → `[p1, p2]`: each joined
  slot's tally TOTAL paid with `slot.addScore` (no page, no sound); the bridge stores it under
  `AMS_BONUS_KEY` for the floor-1 tally's `MISSION 1 BONUS` line.
- `GlitchBridgeScene(app, { from?, runner? })` (spec §1.3): `freeze` (≥ `FREEZE_MIN` 30 ticks until
  the lazy content is registered, ≤ `FREEZE_MAX` 120; it starts `loadFpsContent` at once) →
  `glitch` (`GLITCH_TICKS` 120, palette-only corruption) → `card` (the story lines type in,
  `TYPE_TICKS` 2 per letter, PRESS START from tick 60, `CARD_HOLD` 150) → `fold` (60) →
  `startFpsRun(app, { floor: 1, fromBridge: true })`.
- `PauseHost` (`scenes/pause.ts`: `applySettings?(s)`) and `Continuable` (`scenes/continue.ts`:
  `continuePlayer(slot)`, `resumeMusic()`, `clearOverlays?()`, `startPressed?(slot, input)`,
  `acceptsSlot?(slot)`): FpsScene implements both; GameplayScene is a `PauseHost` (the 2D missions
  have the in-world continue, GDD §4.6, and no continue screen).
- `EndingScene(app, { variant: 'fps' })` (after the last floor; `'campaign'` after m5),
  `goldenRecordRoute(campaign)` (`FPS_ROUTE` = ams, fps-1, fps-2 once the campaign played fps-1,
  else the six missions), `missionColumn(entry)` (`fps-1` → `F1`, `fps-2` → `F2`).
- `?mode=bridge` (`params.ts`): the boot makes a session and shows the bridge without a runner (a
  placeholder freeze frame, no tally) — then floor 1.

## 8. Final play-test record (polish-fix, 2026-10-16)

The bot (`src/sim/bot-fps.ts`, perfect aim, no secrets) after the polish fixes; every floor-2 run
starts with the fresh loadout (pistol, 8 rounds; no floor-1 carry), the hardest case.

| Run | Result |
|---|---|
| floor 1, god, NORMAL, seeds 1–3 (`--expect-complete`) | complete in 4026 / 4494 / 4146 ticks, kills 33/34, 0 deaths |
| floor 2, god, NORMAL, seeds 1–3 (`--expect-complete`) | complete in 2533 / 2198 / 2910 ticks, the boss dead, 0 deaths |
| floor 2, no god, seeds 1–4 (`tmp/fps-polish-fix/arena.ts`) | EASY 4/4 complete, 0 deaths; NORMAL 4/4, 0 deaths; HARD 4/4, 1 death in all |
| floor 2, no god, before the polish (same bot without the adds-first / fetch-a-clip rules) | NORMAL 2/4, HARD 0/4 (the reinforcement SS were the largest damage source, mostly off-view) |

What changed the fight: the two reinforcement waves (50 % / 25 %, the farther bay first, a 30-tick
stand in the door, the horn and `REINFORCEMENTS!`), the lift clip and the arena cover clips (lead
decisions), no fire (and no wasted rounds) while the suit breaks, the mech hit on its arms
(`findTarget` uses the box half-size), and a bot that kills the adds first and fetches clips —
what a player does. Damage by source with that bot (seeds 1–4): NORMAL boss phase 1 252, phase 2
84, reinforcements 18; HARD boss 290 / 162, placed SS 134, guards 59, reinforcements 8.

Still open: no human has played the boss fight on NORMAL / HARD; the bot never opens secrets.
