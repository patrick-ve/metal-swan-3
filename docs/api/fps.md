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

Pure, deterministic, no game ids, no per-tick allocations. Units: tile = 1.0; angles are integers
0..4095 (0 east, 1024 south). The contract sketch is spec §3.2.

- `fixed.ts` — `SIN`, `COS`, `angNorm`, `angDelta`, `angleTo`, `degToAng`. TODO (group engine / ray)
- `grid.ts` — `RayGrid`, `DoorTable`, `PushWall`, `CELL_*` flags. TODO (group engine / ray)
- `cast.ts` — `castRay(…, out: RayHit)`, `lineOfSight`. TODO (group engine / ray)
- `textures.ts` — `defineRayTexture`, `defineRayBillboard`, `getRayBillboard`,
  `rayTextureIndex`, `prepareRayAssets`, `billboardYaw`, list functions. TODO (group engine / ray)
- `view.ts` — `RayView`, `RayCamera`, `RaySprite`, `RayScene`, `renderView`. TODO (group engine / ray)
- `move.ts` — `tryMove`. TODO (group engine / ray)
- `areas.ts` — `AreaMap`. TODO (group engine / ray)
- Recipe: render one frame headless. TODO (group engine / ray)
- Measured cost per frame. TODO (group engine / ray)

## 2. Input actions

- `FpsAction` bits, `FPS_ACTIONS`, `FpsKeyMap` defaults, `actionsFromPad`. TODO (group engine / input)
- `ActionPad` (held / pressed / released / `heldTicks`), `AnalogState`. TODO (group engine / input)
- `InputManager.actions`, `.analog`, `.fpsMode`; `InputSource.readActions?` / `readAnalog?`. TODO (group engine / input)
- `ScriptedSource` actions and analog for tests. TODO (group engine / input)
- `PointerLockSource` (`pointer.browser.ts`), `app.pointerLockWanted`, the lost-lock pause. TODO (group engine / input)
- Settings `mouseLook`, `mouseSensitivity`. TODO (group engine / input)

## 3. Fps game shell

- Types: `FpsFloorDef`, `FpsThing`, `FpsEpisodeDef`, `FpsInput`, `FpsCarry`, `FpsRun`,
  `FloorResult`. TODO (group engine / fps-shell)
- Registry: `defineFpsFloor`, `getFpsFloor`, `defineFpsEpisode`. TODO (group engine / fps-shell)
- `parseFloor(def, difficulty)` — the legend (spec §5.1), warnings. TODO (group engine / fps-shell)
- `FpsGame` — `step`, `restart`, `carry`, `stateHash`, `render`, events. TODO (group engine / fps-shell)
- Doors and push walls (timings spec §4.6, §4.7). TODO (group engine / fps-shell)
- `FpsIntroScene`, `loadFpsContent`, `FpsScene`, `fps-route.ts`. TODO (group engine / fps-shell; flow wires pause / continue / route)
- `?mode=fps&floor=n`. TODO (group engine / fps-shell)

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

- Lazy manifest entries `fps`, `fps/art`, `fps/sound`, `fps/floors`; `isLazyContent`; the default
  `loadContent` filter; `loadFpsContent` / `fpsLoadState` (spec §1.5). Tools that must see every
  sound use `loadContent(() => true)` (spec §3.6). TODO (group engine / fps-shell)
- Pure data modules that eager scenes may import: `content/fps/names.ts` (`MODE_TITLE`),
  `content/fps/story.ts`. TODO (groups fps-shell, flow)
- Art registration (`content/fps/art.ts` and its files; ids spec §8). TODO (group cast / art)
- Sound registration (`content/fps/sound.ts`; ids spec §9). TODO (group cast / fps-sound)
- `src/sim/headless-fps.ts` (`runFps`). TODO (group engine / fps-shell)
- `npm run shot -- --fps n --pose x,y,deg`. TODO (group engine / fps-shell)
- `npm run sprites -- fps/ [--ray]`. TODO (group cast / art)
- `npm run sim -- --mode fps --floor n`. TODO (group floors)

## 7. Flow

- `MissionDef.after`, the GameplayScene hook. TODO (group flow)
- `recordMissionClear`, `silentTally`, the `'fps/ams-bonus'` record. TODO (group flow)
- `GlitchBridgeScene` (phases spec §1.3). TODO (group flow)
- `PauseHost`, `Continuable`. TODO (group flow)
- `EndingScene({ variant: 'fps' })`, `goldenRecordRoute`, `missionColumn` (`F1`, `F2`). TODO (group flow)
- `?mode=bridge`. TODO (group flow)
