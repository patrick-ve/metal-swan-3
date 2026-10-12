# Simulation API — math, rng, input, terrain, physics, entities, world, scripts, camera, particles

Owner: engine (simulation core). Source: `src/engine/{math,rng,events,input,input.browser,terrain,physics,entity,world,script,particles,camera,scene,storage,storage.browser,loop,loop.browser,debug}.ts`,
initial `src/game/tuning.ts`. Tests: `tests/engine/*.test.ts` (incl. a randomised physics fuzz test).
Everything except `*.browser.ts` is pure TS, deterministic and runs headless. 60 Hz: speeds px/tick, times ticks; y grows down.

## 0. Boot and the frame (who calls what)

```ts
applyTuning();                                   // game/tuning.ts → physics Body defaults (once)
const input = new InputManager(parseBindings(store.get('bindings')));
input.addSource(new KeyboardSource(window, { isBound: (c) => input.isBound(c) }));   // browser only
input.addSource(new GamepadSource());                                                // browser only
startBrowserLoop({
  tick: () => { input.update(); debug.handleInput(input); scenes.update(); },       // 60 Hz
  render: () => { r.begin(); scenes.draw(r); r.end(); },
});
// Gameplay scene, each tick: world.update();   each frame:
r.setCamera(world.camera.renderX, world.camera.renderY); /* bg + terrain */ world.draw(r); debug.draw(r, world);
```
Headless (tests, tools, bot): same, minus the browser files; drive `input` with `ScriptedSource`.

**World tick order** (`world.update()`): scripts → entity `update()` (insertion order) → shot pass →
contact damage → particles → camera → cleanup (killY, despawn, removal) → `audio.update()` (voice
housekeeping; scenes without a world may call it themselves — extra calls are harmless).
Entities added during a pass join right after it: spawned in the entity pass ⇒ first `update()` next
tick, but already in this tick's shot/contact passes. Removal is deferred to cleanup.

## 1. math.ts, rng.ts, events.ts

`Rect {x,y,w,h}` (top-left). `clamp lerp invLerp approach(v,target,step) sign wrap dist dist2 angleTo
angleDiff rotateToward smoothstep easeIn/Out/InOutQuad`, `overlaps(a,b)` (touching ≠ overlap),
`contains(r,x,y)` (half-open), `rectAt(ax,ay,rel,flip?,out?)`, `expandRect unionRect circleOverlapsRect
distToRect segmentRectT sweptRectT`. Rect builders take an optional `out` (no allocation).

`new Rng(seed: number|string)`: `next()` [0,1), `int(min,max)` inclusive, `range`, `jitter(v,a)`,
`chance(p)`, `sign()`, `pick(arr)`, `weighted(weights)→index`, `shuffle`, `fork(salt)` (independent
child; does not advance the parent), `getState/setState`. **Gameplay → `world.rng`; cosmetics →
`world.fxRng`.** Never `Math.random`.

`EventBus<M>`: `on(type, fn) → off`, `once`, `off`, `emit`, `count`, `clear`. Listener errors are
logged once and isolated. `world.events` carries `spawn | remove | hit | killed | error`; add game
events by declaration merging:
```ts
declare module '../../engine/world' { interface WorldEvents { score: { player: number; points: number } } }
world.events.emit('score', { player: 0, points: 100 });
```

## 2. Input — input.ts (+ input.browser.ts)

`Button = 'left'|'right'|'up'|'down'|'fire'|'jump'|'bomb'|'start'`. `input.pad(0|1)` is a `VirtualPad`:
`held(b)`, `pressed(b)` (down this tick), `released(b)`, `heldTicks(b)`, `axisX()`, `axisY()` (−1/0/1),
`anyPressed()`, `suppress(mask = 0xff)` (hide held buttons until released — call on scene changes;
`suppress(ACTION_BUTTONS)` hides fire / jump / bomb / start only, so a direction held through a pause keeps
working), `mask`. Button bits: left 1, right 2, up 4, down 8, fire 16, jump 32, bomb 64, start 128.
`InputManager`: `players` (1 = solo key set + every gamepad → pad 0; 2 = P1/P2 sets, 1st/2nd gamepad),
`update()` once per tick, `rawPressed` / `keyPressed('F1')` (KeyboardEvent.code or `GamepadB<n>`,
for menus, rebinding, debug), `pausePressed` (Esc/P or pad Back), `anyPressed()`, `isBound(code)`,
`reserved` (extra codes to swallow), `setKeys(set, button, codes)`, `setPadButtons`, `suppress()`.
`Bindings` (`defaultBindings()`, `serializeBindings`, `parseBindings(json)` — never throws, repairs per
field): `solo` (arrows/WASD, Z/J fire, X/K jump, C/L bomb, Enter), `p1` (WASD, F/G/H, 1), `p2`
(arrows, ,./ or numpad 1/2/3, Enter), `pause`, `pad` (std mapping: 2 fire, 0 jump, 1 bomb, 9 start,
12–15 d-pad), `padPause` [8]. Keyboard taps shorter than a tick still register; blur releases all.

Headless / bot / attract mode:
```ts
input.addSource(new ScriptedSource(timeline().hold('right', 60).tap('jump').hold(['right', 'fire'], 30), 0));
input.addSource(new ScriptedSource((tick) => (tick % 20 < 2 ? 'fire' : null), 1));   // fn of own tick
```
`InputTimeline`: `hold(btns, ticks)`, `idle(ticks)`, `tap(btns, times, down=1, up=1)`, `at(tick)`
(layer steps), `loop()`, `length`, `maskAt(tick)`. Custom sources implement `InputSource`
`{ update?, read(slot, ctx), drainPressed?, endTick? }` and report raw held masks only. Touch screens:
`TouchSource` (`input.browser.ts`) is one more source for pad 0: a DOM overlay (drag stick on the left, FIRE / JUMP / BOMB / START buttons on the right) that shows on the first touch and hides on a key press; `main.ts` adds it on touch devices.

## 3. Terrain — terrain.ts

```ts
const t = terrain(2400, 216);                                   // bounds; or terrain(w, h, x, y)
t.ground().at(0, 170).flat(400).slope(200, -40).step(-12).flat(100).gap(48).flat(300).hill(120, 20).to(2400, 170);
t.platform(300, 120, 96);                                      // flat one-way platform
t.platforms().at(700, 150).slope(100, -40).flat(50);            // sloped one-way platform path
t.solid(900, 98, 32, 32, 'crate').hazard('water', 1100, 180, 200, 40).killY(260);
const def: TerrainDef = t.build();                              // plain JSON-safe data
```
Ground = polylines (x never decreasing); **everything below a line and below its end points is
solid** (ends are cliffs to infinity). `step(dy)` = vertical step; `gap(len)` = pit. Platforms:
one-way, x strictly increasing. Solids: rects blocking all sides. Hazards: `{kind:'pit'|'water'|
'spikes'|'lava'|'kill', x,y,w,h}` — game code decides what they do. Bad points are skipped with a warning.

`new Terrain(def)` queries (64-px column buckets, no allocation): `groundY(x)` (+∞ over pits),
`groundSlope(x)`, `platformY(x, yFrom?, yTo?)`, `surfaceY(x, yFrom?, yTo?, {platforms?})` (first floor
at/below — use to place enemies), `ceilingY(x, y)`, `slopeAt(x, y)`, `isSolid(x, y)`, `cellAt(px, py)`
(0 empty, 1 ground, 2 platform band 4 px, 3 solid — the painter contract), `hazardAt(rect)`,
`hazardsAt(rect, out)`, `lineOfSight(x0,y0,x1,y1)`, `raycast(x0,y0,x1,y1, platforms?, out?) → RayHit
{x,y,t,nx,ny,kind,index} | null`, `bounds`, `killY` (default bottom + 32), `pitRims`.
Live hazards: `addHazard(h: HazardDef)` → added? (no duplicates) / `removeHazard(h)` → removed? — props
add and remove rects at run time (a fire, a moving blade); every reader (`hazards`, `hazardAt`,
`hazardsAt`) sees them, and a rect moved in place (`h.x = …`) is read where it is now. Never push into
the read-only `hazards` array.

## 4. Physics — physics.ts

Anchor = **feet centre**; collision box `[x−w/2, x+w/2] × [y−h, y]`. Position/velocity live on the
mover (the entity); the `Body` holds size, settings and contact state.
```ts
override body = new Body({ w: 14, h: 30 });        // field narrows Entity.body to Body (no `!` needed)
                                                     // options: gravity maxFall stepUp snapDown maxSlope
                                                     //   platforms collide bounce groundFriction
override update(): void {
  this.vx = this.facing * TUNING.player.runSpeed;
  if (pad.pressed('jump') && this.body.ticksSinceGrounded <= TUNING.player.coyoteTicks) {
    if (pad.held('down') && this.body.onOneWay) dropThrough(this); else jump(this, TUNING.player.jumpVelocity);
  }
  const c = moveBody(this, this.world.terrain, this.world);   // gravity + move + collide
  if (c.landed) this.world.particles.dust(this.x, this.y);
  if (c.hitWall) this.facing = -this.facing as 1 | -1;
}
```
`Contact` (= `body.contact`, reused): `landed hitWall wallDir hitCeiling onGround leftGround bounced`.
Body state: `onGround`, `support` (`SUPPORT_GROUND|PLATFORM|SOLID|DYNAMIC`), `supportSolid`, `slope`,
`ticksSinceGrounded` (coyote), `onOneWay`, `dropTimer`, `dropLine` / `dropSolid` (the one-way surface the
body dropped through: ignored until it lands again, so running down a sloped platform never lands on it
again). Helpers: `jump(m, vy)`, `dropThrough(m)` (one-way only, never ground), `settle(m, terrain, env?)`
(snap onto the floor after spawning), `displace(m, dx, dy, …)` (knock-back without gravity, stops at walls),
`pushX(m, dx, terrain, env?)` (sideways push like walking: follows slopes and steps, stops at walls — view-edge
pushes and auto-scroll), `sweep(terrain, x0,y0,x1,y1, platforms?, env?)` (projectile vs terrain + dynamic solids).

Behaviour: feet follow ground/platform lines exactly (slopes ≤ `maxSlope` 1:1, no hop/sink); steeper
rises, polyline ends and rect sides are walls; obstacles ≤ `stepUp` (4) are stepped onto (only if the
head has room); landing only from above; one-way platforms ignored going up and while dropping;
rects/dynamic solids support the whole body width; pits narrower than the body are rolled over;
sub-steps ≤ 2 px (no tunnelling at 16 px/tick); a body never ends a tick inside terrain (fuzz-tested).
A body that lands on a too-steep slope can stand still on it but cannot walk up it.

**Dynamic solids** (moving platforms, elevators, hulls, barricades):
```ts
this.lift = this.world.addSolid(new SolidBox(x, y, 64, 8, /*oneWay*/ true, this)); // removed with owner
update() { this.world.moveSolid(this.lift, 0, -0.5); }   // carries riders, pushes/crushes bodies
```
Solid boxes block like rects; one-way boxes act like platforms. A mover never collides with its own
box (`owner`). Squeezed bodies get `onCrushed(box)` (Entity default: lethal 'crush' damage).

## 5. Entities — entity.ts

```ts
export class Grunt extends Entity {
  override body = new Body({ w: 14, h: 30 });
  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'enemy'; this.hp = this.maxHp = 10; this.z = 30;
    this.hitbox = { x: -7, y: -30, w: 14, h: 30 };   // relative to the anchor, mirrored when facing −1
    this.addTag('enemy', 'shootable');
  }
  override update(): void { moveBody(this, this.world.terrain, this.world); }
  override draw(r: Renderer): void { r.sprite('enemy/grunt/idle', 0, this.x, this.y, { flipX: this.facing < 0, flash: this.flashTicks > 0 }); }
  override die(d?: Damage): void { this.dead = true; /* play death anim, later: */ this.remove(); }
}
```
Fields: `id` (per world, increasing), `type`, `world`, `x y vx vy`, `prevX prevY`, `hitbox`, `team`,
`tags`, `hp maxHp`, `facing`, `z`, `age`, `dead`, `removed`, `invulnTicks` / `flashTicks` (counted down
by the world), `despawnMargin` (160; removed when that far outside the view **after** being inside once;
`Infinity` = never), `contactDamage`, `body`. Methods: `update`, `draw`, `hurtboxes()` (several for
multi-part bosses; the index is `part`), `contactBoxes()` (the boxes that deal `contactDamage`; default the
hitbox; bosses return only their `contact` parts, `[]` = none), `hitRect()`, `onHit(d, part) → absorbed`, `die(d?)`, `remove()`,
`onRemove()`, `onOutOfWorld()` (below `killY`; default remove — players should die), `onCrushed`,
`addTag/removeTag/hasTag` (keep the world index right), `alive`, `onScreen(margin)`.
**dead** = killed (no longer a target, still updates/draws); **removed** = gone at the end of the tick.
Default `onHit`: ignored while invulnerable (except 'crush'), else hp −= amount, 4-tick flash, `die` at 0.

Conventional tags: `player`, `enemy`, `shootable` (hit by shots/explosions/contact), `shot`; the game
adds `soft`, `boss`, `vehicle`, `hostage`, `cover`, `erasable`, `legion` (ARCHITECTURE §6).

**Damage** `{ amount, kind, dirX, source?, owner?, weapon?, tags? }`: `kind` ∈ `bullet explosion fire knife
laser crush impact`; `weapon` = the weapon id; `tags` = extra facts (`heavy`, `boss`, `shockwave`, `sonic`,
`spread`, `hazard`) tested with `damageHas(d, tag)`. The game's rules per kind / tag: game.md §6.
z: decor 10, items 20, enemies 30, vehicles 35, players 40, shots 50, (particles 55), fx 60, front 80.

## 6. World — world.ts

`new World({ terrain, seed, factory, audio, viewW, viewH, particleCapacity })`. Members: `entities`,
`terrain` (`setTerrain`), `camera`, `particles`, `scripts`, `rng`, `fxRng`, `events`, `audio`
(`NullAudio` default), `tick`, `paused`, `god`, `solids`, `errors`, `particleZ`.
- `spawn(id, x, y, params?)` via `factory(id, world, x, y, params) → Entity | null`; unknown id / throwing
  factory → `PlaceholderEntity` (magenta box with the id) + one warning. `add(entity)` for hand-made ones.
- Queries: `byTag(tag)` (live, stable array — keep it; may hold dead ones until cleanup), `countAlive(tag)`, `query(rect,
  filter?, out?)`, `players`, `alivePlayers()`, `nearestPlayer(x, y)`, `onScreen(e, margin)`.
  **`byTag` is live**: an entity added or tagged during your loop shows up in it. When the loop may spawn,
  kill or re-tag (damage, reactions, erasing), iterate a pooled copy instead — no allocation after warm-up:
  ```ts
  const list = world.snapshotTag('shootable');
  try { for (let i = 0; i < list.length; i++) { /* … */ } } finally { world.releaseSnapshot(); }
  ```
  Snapshots nest (a stack); always release in `finally`.
- Damage: `damage(target, d, part?) → absorbed` (emits `hit`, and `killed` when it died) — use for
  knives/beams. `damageArea({x,y,r} | rect, damage, team, falloff?)` for explosions (each target once).
  **Which part is hit**: the shot pass sweeps against every hurtbox and hits the nearest one; `damageArea`
  hits each target once with its closest hurtbox (falloff by that distance); the contact pass uses
  `contactBoxes()` only; the game's knife hits only parts a target reports as knifeable (`isKnifeable(part)`).
- Teams: `hostile(attacker, target)` — player ↔ enemy; neutral attackers hurt both; neutral targets
  are never hit (hostages). "enemy" = hurt by the player (destructible props are enemy team).
- `addSolid / removeSolid / moveSolid`, `draw(r)` (z-sorted, ties oldest first), `reportError`.
- Isolation: an entity whose `update` throws is logged once and removed; `errors[]` feeds the sim tool.

**Shots** (`ShotLike` on an entity tagged `'shot'`): the world sweeps every shot from `prev` to its
current position against hostile `shootable` hurtboxes (nearest first) and terrain, then calls
`onImpact(target | null, x, y)` and removes it (unless `pierce` is left). Your update only moves it:
```ts
class Bullet extends Entity implements ShotLike {
  damage: Damage = { amount: 10, kind: 'bullet', dirX: 1, owner: 0 };
  constructor(w: World, x: number, y: number, dir: 1 | -1) {
    super(w, x, y); this.team = 'player'; this.vx = 8 * dir; this.z = 50; this.damage.dirX = dir;
    this.hitbox = { x: -3, y: -1, w: 6, h: 2 }; this.despawnMargin = 16; this.addTag('shot');
  }
  override update(): void { this.x += this.vx; }
  onImpact(target: Entity | null, x: number, y: number): void { this.world.particles.sparks(x, y, 4, -Math.sign(this.vx)); }
}
```
Options: `pierce` (extra targets; `Infinity` = all), `hitsTerrain` (default true), `hitsPlatforms`.

## 7. Scripts — script.ts

`world.scripts.run(fn | generator, { owner?, name? }) → handle {done, cancelled, failed, cancel()}`.
The script runs to its first `yield` at once, then one step per tick. `yield` = next tick, `yield n` =
n ticks, `yield () => bool` = first later tick where true. Nest with `yield*`. Owner dead/removed →
cancelled (`finally` runs). A throwing script is reported once and stopped.
```ts
world.scripts.run(function* wave() {
  yield waitCamera(1200);                       // camera.x >= 1200 (ambient world; or waitCamera(x, cam))
  world.camera.lock(1200, 1200 + 384);           // arena
  for (let i = 0; i < 4; i++) { world.spawn('grunt', 1600, 170).addTag('wave1'); yield 45; }
  yield* all(waitAllDead('wave1'), 120);         // all dead AND at least 2 s
  world.camera.unlock();
});
```
Helpers: `wait(t)`, `until(pred)`, `waitCamera(x, cam?)`, `waitAllDead(list | tag, world?)`,
`yield* all(...)`, `yield* race(...)` (items: numbers, predicates, generators, handles). `race` cancels the
losers — script handles too: `yield* race(world.scripts.run(volley), 120)` stops the volley after 2 s; when
the script running `all` / `race` is cancelled, its items (handles included) are cancelled as well.
Boss patterns: `run(pattern, { owner: boss })`. Runner: `count`, `cancelAll()`, `cancelOwned(owner)`.

## 8. Camera — camera.ts

`world.camera`: `x, y` (top-left), `w, h`, `bounds` (`setBounds`; the World sets the terrain bounds),
`scroll` `'right' | 'up' | 'down' | 'free'` (ratchet: never back against the scroll direction),
`follow(target | targets | null)` (dead targets ignored; all targets kept in view), `snap()` (jump to
the follow position — section start), `lock(minX, maxX, minY?, maxY?)` / `unlock()` / `locked` (eases
in and out), `shake(amount, ticks)` (deterministic; `shakeScale` 0 disables), `renderX/renderY`
(rounded + shake → `r.setCamera`), `left right top bottom centerX centerY`, `view(margin?)`,
`inView(rect, margin?)`, `containsPoint`, `clampX(x, halfW)` / `clampY(y, above, below?)` (view edges are
walls for players and driven vehicles). Tunables: `lead` 38 (player at 40 % of the width), `offsetY`
(the runner sets it for 'down' sections so the player sees below), `deadZoneY`, `smoothing` 0.2, `maxSpeed` 3,
`margin`. Auto-scroll is a game feature (`ctx.autoScroll`): it moves a lock window every tick.

## 9. Particles — particles.ts

`world.particles` (pool of 1024, round-robin overwrite when full, cosmetic rng):
```ts
const SPARK: ParticlePreset = { kind: 'rect', w: 2, h: 1, life: [6, 12], drag: 0.9, gravity: 0.05,
  colors: [PAL.gold[3], PAL.orange[2], PAL.red[1]], additive: true };          // define once
world.particles.burst(SPARK, x, y, 8, 1, 3, angle?, spread?);   world.particles.emit(SPARK, x, y, vx, vy);
world.particles.emit({ kind: 'sprite', sprite: 'fx/smoke-puff', ticksPerFrame: 4, life: 24 }, x, y);  // sprite frames
```
Preset fields: `kind` (`pixel|rect|sprite`), `w h`, `sprite frame randomFrames ticksPerFrame randomFlip`,
`life` (n or [min,max]), `gravity`, `drag`, `colors` (ramp over life), `fadeFrom`, `alpha`, `additive`,
`ground` (`none|bounce|stop|die`, terrain), `bounce`, `friction`. Built-ins: `sparks(x,y,n,dirX)`,
`debris(x,y,n,colors?)`, `smoke`, `casing(x,y,dirX)`, `dust`, `embers`; presets `SPARK DEBRIS SMOKE
CASING DUST EMBER`. Drawn by `world.draw` at `particleZ` (55). `count`, `clear()`.

## 10. Scenes, loop, storage, debug

- `SceneManager`: `push/pop/replace/reset(scene, { fade: ticks, color })`, `top`, `depth`, `busy`
  (fading), `update()` (top only), `draw(r)` (from the top opaque scene up). `Scene`: `enter exit pause
  resume update draw transparent`.
- `FixedStepLoop({ stepMs, maxSteps: 4, snapMs })`: `advance(ms, tick)`, `reset()`, `paused`, `ticks`,
  `dropped`. `startBrowserLoop({ tick, render })` → `{ stats: {fps, tickMs, drawMs}, loop, stop() }`
  (rAF; hidden tab runs nothing; errors logged once).
- `Store` (`get set remove keys`): `MemoryStore`, `PrefixedStore`, `createBrowserStore(prefix)` (localStorage
  in try/catch, memory fallback); `loadJson(store, key, fallback, validate?)`, `saveJson`.
- `Debug(enabled)`: flags `hitboxes stats god`, `perf` (assign the loop stats), `reserveKeys(input)`,
  `handleInput(input)` (F1 hitboxes, F2 stats, F3 god, F4 `on('skip')`, F5 `on('weapons')`), `apply(world)`
  (god), `draw(r, world)` (terrain lines, dynamic solids, hurtboxes by team, body boxes, stats line).
  God mode ignores all damage to players except 'crush'.

## 11. Tuning — src/game/tuning.ts

`TUNING.physics` (Body defaults: gravity 0.13, maxFall 4, stepUp 4, snapDown 4, maxSlope 1,
dropThroughTicks 12), `TUNING.player` (run 1.5, crawl 0.75, jump −3.5 → apex ≈ 47 px / 54 ticks, air
control, coyote 4, buffer 6, body sizes), `TUNING.life`, `TUNING.camera` — from mechanics.md §22.
`applyTuning()` copies `TUNING.physics` into the Body defaults; call once at boot (browser and headless).
