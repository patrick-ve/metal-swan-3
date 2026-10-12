# Game API — registries, player, weapons, enemies, bosses, vehicles, items, missions, HUD, scenes

Owner: gameplay core. Source: `src/main.ts`, `src/game/*.ts` (not `art/`), `src/game/player/**`,
`src/game/mission/**`, `src/game/scenes/**`, `src/game/content/{characters,weapons}/index.ts`.
Tests: `tests/game/*.test.ts` (helpers: `tests/game/helpers.ts`). Read `docs/api/sim.md` (engine:
world, entities, physics, scripts, camera) and `docs/api/media.md` (sprites, fonts, audio) first.
Everything here is pure TypeScript (no DOM) except `src/main.ts`: it runs headless in tests and tools.

**Content references** (one per content group; ids, sizes, params, placement, timings):
- [heroes.md](heroes.md) — characters, the SWAN-3 `swan`, `sundae-driver`, `bandwagon`, `trumpeter`.
- [sound-ui.md](sound-ui.md) — songs (ids, lengths, loops), sound effects for missions and bosses, HUD calls, mission cards and the tally.
- [arsenal.md](arsenal.md) — weapons, fx ids, items and hostages (details in [items.md](items.md)), the 15 shared props, the 7 creatures.
- [legion.md](legion.md) — the Fanfare Legion: 8 infantry types, machines, support entities (`rowboat`, `tank-barge`, `subway-train`, `parade-float`, `drum-barricade`) and their projectiles.

```
src/game/
  tuning.ts        TUNING (all feel / balance numbers) + applyTuning()
  registry.ts      defineEntity / defineWeapon / defineCharacter / defineMission + lookups, spawn-param readers
  session.ts       GameSession, PlayerSlot, DIFFICULTY, HighScoreTable
  context.ts       per-world game context: sessionOf / difficultyOf / hudOf / settingsOf / iceAt / flash,
                   HudState (banners, ONWARD, speech bubbles, callouts, score pop-ups, screen flashes)
  settings.ts      GameSettings (speech bubbles, boss bar, screen shake, reduce flashes, announcer, volumes)
  events.ts        game events on world.events (declaration merging) + awardScore()
  pool.ts          acquire / release (entity pools)
  fx.ts            FxEntity, explosion, blast, muzzleFlash, impactPuff, hitSpark, dust, splash, debris, smokeTrail
  projectile.ts    Projectile (pooled ShotLike)
  grenade.ts       Grenade (bouncing explosive)
  weapons.ts       WeaponDef, FireContext, Gun, shootBullet, throwGrenade, meleeStrike, built-in fallbacks
  enemy.ts         Enemy base class, reaction protocol, shared enemy rules (tokens, telegraphs, gags), spawn helpers
  boss.ts          Boss base class (pool or required-part HP, knifeable / contact parts, phases, intermissions, death)
  vehicle.ts       Vehicle base class (mount, ½ / 1-cell armour, combos, eject window, ram, special)
  pickup.ts        Pickup base class + ready-made effects
  hostage.ts       Hostage (tied → freed → walks to the rescuer → gives → bows → runs off)
  water.ts         waterSurfaceAt / floatOnWater (swimmers, boats, floating props)
  player/          Player entity (player.ts) + StatusEffects (status.ts)
  mission/         MissionDef types, MissionRunner, SectionView, terrain builders (index.ts = public entry)
  hud.ts           drawHud() (screen HUD + world-space speech bubbles and score pop-ups)
  params.ts        URL launch parameters
  app.ts           GameApp services + menu text helpers
  scenes/          Boot, Title, Gameplay (+ Pause, Continue / Game Over), MissionComplete (newspaper tally)
```

## 1. Boot and the frame

`src/main.ts` (browser only) does: `applyTuning()` → `parseLaunchParams(location.search)` →
`createBrowserStore()` → `InputManager` + `KeyboardSource` + `GamepadSource` → `WebAudioOut` (unlocks on the
first gesture; `?mute=1`, key **M** toggles mute) → `CanvasRenderer` + `createDisplay(canvas)` → `Debug`
(`?debug=1`: F-keys reserved, `debug.perf = loop.stats`) → `createApp(...)` → `scenes.reset(new BootScene(app))`
→ `startBrowserLoop`. Each tick: `input.update(); debug.handleInput(input); scenes.update()`. Each frame:
`r.begin(); scenes.draw(r); r.end(); display.present(r.canvas)`. Uncaught errors (window `error`,
`unhandledrejection`, loop errors) show in a red overlay (click to hide). `window.__ms3.app` is a debug handle.

Headless (tools, bot, tests): build the same app with `MemoryStore`, `NullAudio` and a `ScriptedSource`:
```ts
applyTuning();
const input = new InputManager(); input.addSource(new ScriptedSource(timeline().hold('right', 120), 0));
const app = createApp({ input, audio: new NullAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS } });
await loadContent();                       // or import only the modules you need
startNewGame(app, { mission: 'm0' });      // or drive a MissionRunner directly (§10)
for (;;) { input.update(); app.scenes.update(); r.begin(); app.scenes.draw(r); r.end(); }
```

## 2. Registries — registry.ts

```ts
defineEntity(id, (world, x, y, params) => Entity, { category, score?, description? })
getEntityFactory(id) · getEntityMeta(id) · hasEntity(id) · listEntities(category?)
gameEntityFactory            // World spawn factory: new World({ factory: gameEntityFactory }) (the runner does this)
defineWeapon(def) · getWeapon(id) (unknown → pistol, warns once) · hasWeapon · listWeapons(filter?)
defineCharacter(def) · getCharacter(id) (unknown → 'recruit') · hasCharacter · listCharacters()
defineMission(def) · getMission(id) (unknown → undefined; the runner shows a placeholder) · hasMission · listMissions()
defineStatus(def) · getStatus(id) · hasStatus(id) · listStatuses()   // shared status effects (§8)
// re-exported for one-stop imports: defineSprite, defineSfx, defineSong, defineBgGenerator, setTerrainPainter
```
Categories: `enemy boss vehicle item hostage prop hazard projectile fx npc other`. `params` is never
undefined (`NO_PARAMS`). **Common params handled for every entity** by `gameEntityFactory`: `facing`
(1 / -1 / 'left' / 'right'), `tag` / `tags` (string or list — wave tags for `ctx.waitClear(tag)`), `z`.
Param readers: `paramNum(p, key, fb)`, `paramStr`, `paramBool`, `paramFacing(p, fb)`, `paramSpawn(p, key, world?)`
/ `toSpawnSpec(v, world?)` → `{ id, params? } | null` from `'id'`, `{ id, params }` or a list (one is picked
with `world.rng`).

`CharacterDef { id, name, art: 'char/<id>', title?, description?, stats?, color?, voice? }`;
`CharacterStats { speed?, jump? (multipliers), bombs?, bomb? (weapon id), weapon? (start weapon), melee?, ammo? (pickup ammo ×) }`.
Registered: `recruit` (content/characters/index.ts).

## 3. Session, difficulty, world context, events

`GameSession({ difficulty?, characters?: ['recruit', …] (1 entry = 1 player), credits? (Infinity = free play), seed? })`:
`slots: [PlayerSlot, PlayerSlot]`, `mods` (DifficultyMods), `activeSlots`, `activeCount`, `allOut`,
`join(i, char)`, `addScore(i, pts)`, `continueSlot(i)` (uses a credit), `startMission(id)`, `missionId`,
`sectionId`, `completed[]`.
`PlayerSlot`: `joined gameOver active character lives` (lives **including** the one in play; NORMAL 3, EASY 5;
at most `MAX_LIVES` = 10) `score bombs bombType weapon ammo` (Infinity = unlimited) `rescued` (the hostage
tally, paid by the mission-complete scene) `checkpointRescued` (the tally at the last checkpoint) `continues
extendsGiven vehicle` (carried vehicle) `bonus.vehicle` `mission` (**MissionStats**, reset per mission) `stats
{kills knifeKills shots bombsThrown deaths hostages pickups bossKills}`; `addScore(pts)` (gives the score
extends at `EXTEND_SCORES` = 500,000 and 1,500,000, event `extend`), `addLife(n)`, `livesFull`,
`resetLife(bombs, weapon)`, `loseLife(keepRescued)`, `continueGame(lives)`.
`MissionStats { deaths hostagesFreed hostagesLost bossStartTick bossEndTick vehicleAtFinish noScratches goldenRecord
kills (by entity type) route (section ids) }` — the runner fills it; the tally reads it.
`DIFFICULTY.easy|normal|hard` (`DifficultyMods`): `lives` (5 / 3 / 3), `grenades` (15 / 10 / 10), `bossHp`
(0.8 / 1 / 1.25), `bigEnemyHp`, `enemyFireInterval` (1.3 / 1 / 0.8), `enemyBulletSpeed` (0.9 / 1 / 1.15),
`telegraph` (1.25 / 1 / 0.9; `enemyReaction` is a deprecated alias), `tokens` (3 / 4 / 6), `doubleTake`
(36 / 24 / 12 ticks), `hostageLoss` ('checkpoint' on EASY: only the hostages freed since the last checkpoint
are lost; else 'all'), `vehicleAutoEject` (EASY), `extraVolley` (HARD +1 boss projectile), `normalRows` /
`hardRows` (which `[N]` / `[H]` wave rows spawn), `timerBonus` (0), `tallyScore` (0.5 / 1 / 1.5).
**Content reads `extraVolley`, `normalRows` and `hardRows` itself** (the base classes do not apply them).
`HighScoreTable.load(store) / save(store) / qualifies(score) / submit(entry) / top`.

**World context** (context.ts): the runner calls `attachGame(world, session, hud?, settings?)` (then sets the
context's `runner` and `ice`);
anywhere else `sessionOf(world)`, `difficultyOf(world)`, `hudOf(world)`, `settingsOf(world)`,
`playerCountOf(world)`, `iceAt(world, x)` (the section's `iceRanges`), `flash(world, color, alpha?, ticks?)`,
`gameOf(world).runner`. A world without a context gets a default 1-player normal session (unit tests).

`HudState` — every module talks to the HUD through this one object (`hudOf(world)` / `ctx.hud`), so the
options apply everywhere:
- `showBanner(text, { sub?, detail? (third line: a boss subtitle), style: 'warning' | 'mission' | 'info', ticks? })`,
  `clearBanner()`; `showGo(dir = 'right', delay?, ticks?)` / `hideGo()` (the ONWARD prompt);
  `message(slot, text, ticks?, color?)` (one pop-up line per player);
- `bubble(target, text, { kind: 'gag' | 'hint' | 'radio', ticks? (120), dy? })` → a speech bubble that
  follows an entity (or a fixed `{x, y}`) until it is removed; `clearBubble(target)`. **'gag'** bubbles
  ('!', 'MMF!', jokes) hide with SPEECH BUBBLES OFF; 'hint' (RIDE?) and 'radio' lines always show;
- `callout(text, { ticks? (90), color? })` — centred lines at y 60 ('CHECKPOINT', 'CAUGHT NAPPING +100'); the
  exact GDD §14.2 texts are `CALLOUTS` in `scenes/flow-data.ts` (`CALLOUTS.drumRoll` = 'DRUM ROLL! +1000' …);
  the caller adds the points;
- `pointer(target, text, { ticks?, dy? })` / `clearPointer(target)` — a blinking word over three gold chevrons
  pointing down at a target (`HINTS.stomp` 'STOMP!' over the m1-c drummer, 'SHOOT!' over the willow); a hint, so
  SPEECH BUBBLES OFF never hides it;
- `popup(x, y, text)` — world-space score numbers (the runner adds one for every `score` event with x / y);
- `screenFlash(color, alpha?, ticks?)` (or `flash(world, …)`) — drawn at 30 % with REDUCE FLASHES;
- `hidden` (cut-scenes). Limits: 16 bubbles, 3 callouts, 24 pop-ups (the oldest goes).

**Settings** (`settings.ts`, `settingsOf(world)`): `speechBubbles`, `bossBar`, `screenShake: 'full' | 'low' |
'off'` (the runner scales camera shake), `reduceFlashes`, `announcer`, `musicVolume`, `sfxVolume` (0..10);
`loadSettings(store)` / `saveSettings(store, s)`. The options screen (UI agent) edits them.

**Events** (`world.events.on(type, fn)`, declared in events.ts):

| Event | Payload | Emitted by |
|---|---|---|
| `score` | `{ player, points, x?, y? }` | `awardScore(world, slot, points, x?, y?)` — use it for every score |
| `enemyKilled` | `{ enemy, damage, points, player }` | Enemy.die |
| `playerDied` / `playerSpawned` / `playerOut` | `{ player, slot, cause }` / `{ player, slot, respawn }` / `{ player, slot }` | Player |
| `weaponChanged` · `pickup` | `{ player, slot, weapon }` · `{ player, slot, item }` | Player · Pickup |
| `hostageFreed` · `hostageRescued` | `{ hostage, slot }` | Hostage |
| `bossPhase` · `bossDefeated` | `{ boss, phase }` · `{ boss, player }` | Boss |
| `vehicleMounted` · `vehicleEjected` · `vehicleDestroyed` | `{ vehicle, player, slot }` · `{ …, mode: 'exit' \| 'ram' \| 'destroyed' \| 'forced' }` · `{ vehicle }` | Vehicle |
| `explosion` | `{ x, y, r, team, owner, size }` | fx.explosion |
| `checkpoint` · `timeOut` · `sectionExit` | `{ x, y }` · `{ section }` · `{ from, to }` | MissionRunner |
| `extend` | `{ player, lives }` | PlayerSlot.addScore (score extend) |

`DeathCause = DamageKind | 'pit' | 'drown' | 'timeout'`.

## 4. Tuning — tuning.ts

`TUNING.physics` (Body defaults) · `player` (run 1.5, crawl 0.75, jump −3.5, air control, coyote 4, buffer 6,
apex hang, body sizes, fallback attachment points) · `fire` (buffer 6, tap-hold repeat 10, draw 30, anim
ticks, sweep 22.5° per 2 ticks) · `weapons` (pistol, machineGun, vulcan, cannon, maxAmmo 999) · `grenade` (10 per
life, cap 99, 2 in the air, arc + crouch / up / down throws, bounce, direct 100 + 100 to every enemy in r 24, no falloff) · `knife` (30 dmg, cooldown 20,
26×28 box) · `life` (death anim 60, respawn invulnerability 120 + drop, blink 2, lives 3) · `vehicle`
(cells 3, shells 10, hit i-frames 60, eject, ram, wreck) · `pickup` · `hostage` · `timer` (60 counts,
**256 ticks per count**, alarm at 10) · `continues` (10 s, gift weapon) · `score` (enemy 100, knife ×5, hostage
10,000, rescue bonus, vehicle boss bonus, boss 20,000) · `coop` (boss HP ×1.5) · `camera` · `transition`.
`applyTuning()` copies `TUNING.physics` into the Body defaults (boot, headless tools and tests).

## 5. FX — fx.ts

```ts
explosion(world, x, y, size: 's'|'m'|'l'|'xl' = 'm', { damage?, team = 'player', owner?, kind?, radius?, softOnly?, falloff = 0.5, exclude?, silent?, shake?, debris? }) → FxEntity
blast(world, x, y, r, damage, team, { kind, owner, source, softOnly, falloff, exclude, weapon?, tags? })   // area damage only; also frees hostages
muzzleFlash(world, x, y, angle, { kind: 'pistol'|'heavy', follow?, weapon? })   // fx/muzzle-<weapon>(-up|-diag) when drawn, else fx/muzzle(-heavy)(-up|-diag)
poof(world, x, y)                                                       // the respawn / erase puff (fx/poof)
confetti(world, x, y, count = 16, power = 2.4) · musicNotes(world, x, y, count = 1, spread = 8, life = 50)
steamPuff(world, x, y, vx?, vy?) · snowPuff(world, x, y, n?) · iceShatter(world, x, y, n?) · tinFeathers(world, x, y, n = 3, dirX = 0)
dizzyStars(world, target, dy = -40, ticks = 60) · heliumCloud(world, x, y, ticks = 120)
tumble(world, sprite, x, y, vx, vy, { gravity?, life?, ticksPerFrame?, z?, flipX? })   // fx/flying-shako, fx/stick-on-moustache …
drawShadow(r, x, y, w, alpha = 0.45) · drawAimLine(r, x0, y0, x1, y1, locked = false, phase = 0, color?)   // call from draw()
impactPuff(world, x, y, nx?, ny?) · hitSpark(world, x, y, dirX) · dust(world, x, y, n?) · splash(world, x, y, n?)
debris(world, x, y, kind: 'metal'|'wood'|'rock'|'dirt'|'glass'|'plant'|'snow'|'cloth', n?) · smokeTrail(world, x, y, dark?)
FxEntity.spawn(world, { sprite, x, y, vx?, vy?, gravity?, drag?, flipX?, flipY?, ticksPerFrame?, loop?, life?, z?, blend?, alpha?, follow?, fallback?, angle?, scale? })
```
Explosion sizes (`EXPLOSION_SIZES`): radius 12 / 24 / 40 / 64, shake 1 / 3 / 5 / 8 (× the screen-shake
setting). Each target is hit once (closest part: `World.blast` measures to every hurtbox of a multi-part
target); `falloff` reduces damage toward the edge. `explosion` also takes `weapon` and `tags` for its Damage.
Angles between 22.5° and 67.5° use the diagonal muzzle flash. FX sprites are centre-anchored; explosions and
muzzle flashes draw a procedural stand-in while their sprite is missing. Particle presets: `FX_SPARK FX_FLAME
FX_SMOKE FX_TRAIL FX_EMBER FX_DUST FX_WATER FX_SNOW FX_STEAM FX_PELLET FX_CONFETTI FX_ICE FX_FEATHER`. FxEntity is pooled
(never keep a reference after it ends).
**FX sprite ids** (GDD §15.6; `content/fx/*.art.ts`): `fx/explosion-s|m|l|xl`, `fx/smoke` (old `fx/smoke-puff`),
`fx/soot` (old `fx/soot-cloud`), `fx/poof`, `fx/dust`, `fx/confetti` (+ `fx/confetti-bit`), `fx/music-note`,
`fx/steam-puff`, `fx/helium-cloud`, `fx/splash`, `fx/spark`, `fx/hit` (= `fx/hit-spark`), `fx/impact`, `fx/shadow`
(11 widths), `fx/aim-line` (the target mark), `fx/stars-dizzy` (old `fx/stun-stars`), `fx/flying-shako`,
`fx/stick-on-moustache`, `fx/snow-puff`, `fx/ice-cubes`, `fx/debris-<kind>`, `fx/parachute`; `fx/tin-feather` and
`fx/muzzle-swan-beak-gun` are drawn by the Swan art. Spawnable from scripts (`content/fx/index.ts`): `fx-explosion`,
`fx-explosion-chain`, `fx-smoke`, `fx-sparks`, `fx-debris`, `fx-dust`, `fx-splash`, `fx-poof`, `fx-confetti`,
`fx-music-notes`, `fx-steam`, `fx-snow-puff`, `fx-ice-shatter`, `fx-tin-feathers`, `fx-stars-dizzy`, `fx-helium-cloud`.

## 6. Projectiles — projectile.ts, grenade.ts

```ts
Projectile.spawn(world, { team, x, y, vx, vy, damage, kind = 'bullet', owner?, shooter?, gravity?, drag?, life = 90,
  pierce?, hitsTerrain = true, hitsPlatforms?, w = 4, h = 4, sprite?, look: 'angle' | 'anim', ticksPerFrame?, blend?,
  offscreen = 24, impact: 'spark' | 'none' | fn, onImpact?, shootable?, hp?, soft?, z?, tracker?, type?,
  weapon?, tags?, erasable?, score? })
eraseEnemyShots(world, circle | rect, { team = 'enemy' }) → count   // removes 'erasable' shots with a puff each
```
**Erasable shots**: enemy projectiles are tagged `erasable` by default (beams and lane blasts pass
`erasable: false`); tuba rings, HONK, the respawn POOF (r 64) and boss intermissions call
`eraseEnemyShots`. `score` = points for shooting the projectile down. `weapon` / `tags` go into every Damage
the projectile deals (`shootBullet` adds the weapon id itself).
The world's shot pass does the hits (hostile `shootable` hurtboxes, terrain via the engine sweep) and calls
`onImpact(target | null, x, y)`. Projectiles expire after `life` ticks (`expire()`) or `offscreen` px outside
the view. **Sprites**: `look: 'angle'` picks the frame from the flight angle — an N-frame strip covers 360°,
frame 0 points right, clockwise (16 frames = 22.5° steps; 1 frame = flipped by vx); `look: 'anim'` loops the
frames and flips by vx. Shootable enemy rockets: `shootable: true, hp: 10` (add `soft: true` to allow knifing).
Subclass with a `(world)` constructor, override `init` (call super), `update` (call `this.move()`), `onImpact`,
`expire`; `MyRocket.spawn(world, opts)` returns a pooled `MyRocket`.

`Grenade.spawn(world, { …ProjectileOpts, bounce?, contacts = 2, fuse?, blastSize = 'm', blastDamage?, blastRadius?, softOnly?, maxFall? })`:
moves itself, bounces off floors / walls / platforms / dynamic solids, explodes on the n-th floor contact, on
fuse end, or on touching a hostile shootable (direct damage first; that target is excluded from the splash).
Enemy grenades: `team: 'enemy'`.

**Damage contract** (engine `Damage`): `kind` = what hit (`bullet explosion fire knife laser crush impact`),
`weapon` = which weapon id, `tags` = extra facts tested with `damageHas(d, tag)`. Rules read them: enemies
pick their death anim by `kind`; a player vehicle (`Vehicle.cellDamage`) loses **all** cells to `crush` or the
tag `hazard`, **1 cell** to `explosion`, `laser`, `impact`, `fire` or the tags `heavy` / `boss`, else **½
cell**. Content follows this table (GDD §5, §8.1):

| Source | kind | tags | Vehicle cost |
|---|---|---|---|
| `pistol`, `machine-gun`, `vulcan` | `bullet` | — | (player) |
| `shotgun` cone | `bullet` | `spread` | (player) |
| `grenade`, `cannon`, `rocket-launcher`, `homing`, `bounce-mine` | `explosion` | — | (player) |
| `flamethrower` · `laser` · `knife` | `fire` · `laser` · `knife` | — | (player) |
| `tuba` ring | `impact` | `sonic` | (player) |
| enemy bullets, notes, rings, records, darts; small-creature contact | `bullet` | (`sonic` for rings) | ½ |
| enemy shells, rockets, mortars, grenades | `explosion` | — | 1 |
| enemy beams · fire | `laser` · `fire` | — | 1 |
| charging enemy / enemy vehicle contact, falling piano | `impact` | — | 1 |
| any boss attack | any | `boss` (+ `shockwave` for ground waves) | 1 |
| crush (moving solids) | `crush` | — | all |
| hazard entities (content) | any | `hazard` | all |

Terrain hazards: players die in `pit` / `water` (deep) / `spikes` / `kill` / `lava`; a driven vehicle is
destroyed by `pit`, `lava` and `kill` (`checkHazards`), and the pilot is thrown up alive (vy −6, 60
invulnerable ticks).

## 7. Weapons — weapons.ts, content/weapons/index.ts

```ts
interface WeaponDef {
  id; name; letter?; kind?: 'gun' | 'bomb' | 'melee' | 'vehicle';
  ammo (Infinity = unlimited); ammoAgain?; maxAmmo? (999); ammoPerShot? (1);
  pose: 'pistol' | 'heavy';            // player torso sprites torso-<pose>-*
  cooldown; crouchCooldown?; auto;     // auto = fires every cooldown while held
  holdRepeat? (tap weapons: repeat while held; default TUNING.fire.tapHoldRepeat; null = off);
  burst? (min shots per press); sweep? (machine-gun aim sweep); maxShotsOnScreen?;
  sfx? (played by the Gun per shot); voice? (announcer on pickup); voiceAgain? (same weapon again; default 'MORE <NAME>!'); icon? ('ui/icon-<id>'); melee?: { w, h, crouchH?, damage };
  fire(ctx: FireContext): void;
}
interface FireContext { world, shooter, owner, team, weapon, x, y (muzzle / hand), angle (0 right, +π/2 down), dirX, dirY,
  facing, aim: 'forward'|'up'|'down', shotIndex (since the press), crouching, airborne, vx, vy (shooter speed), gun }
```
Helpers for `fire`: `shootBullet(ctx, { speed, damage, sprite, kind?, life?, w?, h?, pierce?, gravity?, offset?
(sideways px), spread? (radians), impact?, onImpact?, look?, blend?, hitsPlatforms?, track? })` (tracked for the
on-screen limit), `throwGrenade(ctx, { sprite, damage, …GrenadeOpts })` (forward / up / down-in-air arcs, adds
the thrower's speed), `meleeStrike(ctx, rect, damage, kind = 'knife')` (soft hostile targets once each; frees
hostages), `meleeBox(...)`, `meleeBoxFor(ctx, box)`, `meleeTargetIn(world, rect, team)`, `aimAngle(facing, elev)`,
`aimDirOf(elev)`. `Gun` (one trigger: `press()`, `tick(busy)`, `wants(held)`, `fire(args)`, `track(p)`, `live`,
`cooldown`, `lock`, `buffer`, `burstLeft`, `reset()`) is shared by the player and vehicles.

Registered weapons: `pistol` (∞, tap, cooldown 8 / crouch 6, hold repeat 10, 8 px/tick, 10 dmg, 16 on screen),
`machine-gun` (M, 200 / +150, heavy, auto every 4, 4-round burst per tap, **sweep** (GDD §4.3): while firing,
the aim turns one 22.5° step every 2 ticks toward the held direction — forward ↔ up in 8 ticks — and rounds fired
meanwhile fly at the in-between angles), `grenade`
(bomb: arc, 1 bounce, direct 100 ('explosion' kind) + 100 to every enemy in r 24, crouched throw 2.4 / −1.2, up throw 0.8 / −3.5, max 2 in the air), `knife` (melee 30, cooldown 20),
`vulcan` (vehicle gun, 5-round bursts), `cannon` (vehicle shell: arc, 200 direct + 'm' blast 40).
Fallbacks when content is missing: `BUILTIN_KNIFE`, `BUILTIN_GRENADE`, a built-in pistol.

Pickup weapons (`content/weapons/index.ts` + `shots.ts`, numbers in `content/weapons/stats.ts` = GDD §5):
`shotgun` (S, 30 / +10, `ShotgunBlast`: 150 to each target in a 72 px cone 16 → 40 px tall, 6 ticks, every 28,
kick 2 px, 1 at a time), `rocket-launcher` (R, 30 / +20, `Rocket`: 2 → 7 px/tick, steers sideways ≤ 1 px/tick
toward the nearest enemy ahead, 30 hit + 50 in r 16, every 20, max 2), `flamethrower` (F, 30 / +15,
`FlameStream`: 96 px stream for 24 ticks, 10 per 2 ticks per target (≤ 12 per press), pierces, runs 128 px along
the floor when fired down near it, walls stop it, max 1), `laser` (L, 200 / +150, `LaserBeam`: to the first solid
or 384 px, 8 per 2 ticks per target, 1 ammo per 4 ticks, tap = 12-tick pulse, lingers 6 ticks, sweep, loops
`weapon/laser`), `homing` (H, 40 / +20, `HomingMissile`: 2 per press at ±15°, 4 px/tick, locks within 220 px
ahead, turns 4°/tick, 120 ticks, 30 hit + 10 in r 8, max 4), `tuba` (T, 25 / +15, `TubaRing`: 2.5 px/tick,
12 → 40 px over 40 ticks, lives 70, 60 once per enemy (`impact` + `sonic`), pushes ≤ 40 HP enemies 8 px, calls
`eraseEnemyShots` on its circle, max 3), `bounce-mine` (B, 30 / +10, `MineDisc` (a `Grenade`): thrown 3 / −2,
lobbed up 1 / −4, dropped +1, bounces vy × −0.6, hops 32 px gaps and 12 px steps, 30 hit + 40 in r 20 on contact,
the 4th landing or 150 ticks, max 3). Announcer lines: `VOICE` in `stats.ts`; again: `MORE <NAME>!`.
Knife sound: `knifeSfx(shooter)` → the character's `knifeSfx` (characters/index.ts), else the GDD §15.7
variant by character id, else `weapon/knife` (also when the variant has no recipe).
Shot entity ids for scripts (`ctx.spawn(id, x, y, { facing, angle (deg, −90 = up), team, owner })`, out 16 px
above y): `bullet-pistol`, `bullet-mg`, `shotgun-blast`, `rocket`, `flame-stream`, `laser-beam` (+ `shots`),
`homing-missile`, `tuba-ring`, `mine-disc`, `grenade`.
Sprites: `weapon/<shot>` strips (`weapon/bullet`, `weapon/mg-bullet`, `weapon/shell`, `weapon/rocket`,
`weapon/homing`: 16 directions; `weapon/grenade`, `weapon/mine-disc`: 4-frame spin; `weapon/tuba-ring[-up]`: 8
sizes; `weapon/flame`, `weapon/flame-glow`, `weapon/laser-flare`, `weapon/laser-hit`, `weapon/pellet`), muzzle
flashes `fx/muzzle-<weapon id>[-up|-diag]`, HUD icons `ui/icon-<weapon id>` (≤ 16 × 8; GDD alias
`ui/icon-weapon-<id>`; old `ui/icon-rocket|flame|bouncer`).

## 8. Player — player/player.ts, player/status.ts

`new Player(world, x, y, { pad, index?, slot?, character? })` (the runner creates players). States:
`play spawn dead out mounted victory`. Sprites (§6.1): `<art>/legs-{idle,run,jump,fall,land,crouch,crouch-walk}`
(each with a `hip` point), `<art>/torso-<pistol|heavy>-{idle,shoot,up,shoot-up,down,shoot-down,throw,knife}`
(anchored at the hip; `muzzle` on aim / shoot frames, `hand` on throw frames — the release frame is the one whose
hand is farthest forward and up), full body `<art>/{die,die-burn,victory,spawn,bored,mount}`. Missing points fall
back to `TUNING.player.fallback*`. `bored` plays after `TUNING.player.boredTicks` (300, GDD §3.1) idle ticks; when
the player moves again the character's optional `boredStatus` is added (Gramps: `squeaky-boot`).

Rules: instant run, crouch / crouch-walk (16×20 hitbox; stays crouched under low ceilings), fixed-height jump
(standing jumps hang at the apex), take-off boost and air control (facing follows the stick in the air),
coyote 4 / buffer 6, drop-through (down + jump on one-way platforms; never with a `water` rect under the feet:
there it is a normal jump, GDD §4.2), aim up anytime / down only in the air,
landing locks fire 2 ticks. Fire presses are buffered (also during a throw / knife). **Knife**: a fresh fire
press with a soft hostile in the knife box (26×28 in front) stabs instead of shooting (knife kills ×5 score).
Bombs from the hand, max 2 in the air. Hazards: `pit` (falling in), `spikes` / `kill` / `lava` (through the
damage pipeline: god mode and invulnerability protect), `water` (head under = drown, else wade at 75 % speed).
Death (one hit unless invulnerable / god mode; crush and pits kill anyway) → death anim (60 ticks; `die-blast`
for explosions when drawn) → drop in: first the section rule (`respawnRule`, from `SectionDef.respawn`), else
the nearest spot in view with floor and no hazard, else `respawnAt` (the runner's last checkpoint); 132 ticks
blinking invulnerability, start weapon, 10 bombs (EASY 15). A **POOF** (r 64) erases the enemy shots around
the drop point. The weapon is lost; hostages by `hostageLoss`. Last life → `out` + 'playerOut'. View edges
are walls; in 'up' sections falling below the view kills. Ice (`iceAt`): low friction, slides on.
Crouch fire uses the crouch muzzle (the shot leaves at crouch height).

API: `giveWeapon(id, ammo?, announce = true)` · `addBombs(n)` · `addLife(n)` · `addScore(points)` ·
`kill(cause)` · `respawn()` · `continueGame(gift?)` · `placeAt(x, y, invuln)` · `victory()` ·
`enterVehicle(v)` / `leaveVehicle({ x, y, vx?, vy?, invuln? })` (vehicles call these) · `drawSeated(r, x, y, flip)`
(cockpit vehicles: `<art>/mount` at the seat point) · `drawRide(r, x, y, flip, pose: RidePose, frame?)` (open-seat
mounts, the Swan: `<art>/ride-<pose>` with its hip on (x, y); falls back to `ride-sit`, then to `mount` frame 1
drawn 17 px lower; blinks while invulnerable; `RidePose` = `sit lean up hunch hold brace duck ears cheer`,
`RIDE_POSES`) · `muzzleWorld(out)` · `handWorld(out)` · `knifeTargetInReach()` · `setCrouch(on, force?)` · getters `weapon`,
`aim`, `aimAngle`, `onGround`, `busy`, `mounted`, `controllable` · fields `slot index pad character art status
gun bombGun meleeGun vehicle elev elevTarget crouching cause wading respawnAt cheering`. `isPlayer(e)` type guard.
`victory()` on a mounted player keeps him in his vehicle and only sets `cheering` (the Swan then brakes, stops
firing and shows `ride-cheer`; the Trumpeter too).

**Status effects**: register shared ones with `defineStatus(def)` (`getStatus(id)` from any module), then
`player.status.add(def, ticks?)` (again = refresh), `has(id)`, `ticksLeft(id)`, `remove(id)`, `clear()` (on
death). `StatusEffectDef { id, ticks, speed?, jump?, gravity?, fallGravity? (with jump held while falling),
maxFall?, weapon? (forced, ammo-free), invertControls?, noJump?, noCrouch?, noFire?, noBomb?, noMount?,
noControl?, sfxPitch? (the player's own sounds), art? (sprite infix: `<art>/<infix>-<anim>` when registered),
icon? (HUD icon + 24×2 timer bar), tint?, tintAlpha?, onHit?(p, d) → absorb?, onStart?, onTick?(p, left),
onEnd?, onDraw?(p, r, left) (extra world-space drawing: a balloon, a parachute) }`.

## 9. Enemies, bosses, vehicles, items, hostages

**Enemy** (`enemy.ts`): `super(world, x, y, params, { art, hp = 10, w = 14, h = 30, soft = true, body = true, big?, score? })`.
Override `think()` (AI, every tick while alive; physics and the animator run after it) and maybe `draw()`.
Tags `enemy shootable` (+ `soft`; Legion soldiers add `legion`). Params: `hp`, `drop` (spawn spec), `facing`, `tag(s)`.

*Reaction protocol* (GDD §9.0): any module asks enemies to react — `enemy.react(kind, ticks, source?)` →
accepted?, or `reactInArea(world, circle | rect, kind, ticks, { tags?, onScreen?, source?, exclude? })` →
count. Kinds: `salute` (anthem), `dance` (windup-bots), `panic` (grenade / moving vehicle: run away),
`confused` (baton-major dies), `freeze` (sundae-mortar), `queue` (the JINGLE), `ears` (HONK), `photo` (SAY
CHEESE), `stumble` (the drummer dies), `buff` (IN STEP!). While a reaction runs the enemy does not attack
(`thinkReaction(kind)` replaces `think()`; default: stand and play `<art>/<anim>` — `salute`, `dance`,
`confused`, `frozen`, `queue`, `ears`, `photo-pose`, `stumble`, else `idle`; `panic` runs). Default
acceptance: everyone takes `photo`; soft `legion` enemies take the rest except `dance` / `buff`; override
`acceptsReaction(kind)` to opt in or out; hooks `onReact`, `onReactionEnd`; `reacting`, `endReaction()`.

*Shared rules* (GDD §4.11): `takeAttackToken(world, e)` before a telegraph (false = keep moving, try later)
and `releaseAttackToken(world, e)` after the recovery (limit `attackTokenLimit` = 3 / 4 / 6; bosses do not use
tokens); `telegraphTicks(world, base)` (× difficulty, never below 18); gag awareness: `noticesPlayer(e,
front?, behind?, maxDy?)`, `playerNoiseNear(e, r?)` (+ `listenForBlasts(world)` once), `shoutToAllies(e,
range?)` (allies implement `hearShout(delay, from)`), `doubleTakeTicks(world)`, `caughtNapping(e, d)` (CAUGHT
NAPPING +100 callout); `knifeComboStep(world)` (the rising knife note). Never attack from outside the view:
check `onScreen()` at the shot, not only at the wind-up.
Helpers: `play(name, opts)` (`<art>/<name>`), `playing(name)`, `hasAnim`, `spriteId`, `target()` (nearest alive
player), `dxTo dyTo distTo isFacing facePlayer inRange(e, rx, ry) canSee(e) checkAlert() alert()` (hook
`onAlert`), `sightRange`, `point(name, fx, fy, out)` (frame point → world), `aimAt(x, y, e?)`,
`shoot({ speed, damage, sprite, angle?, kind?, life?, gravity?, w?, h?, x?, y?, impact?, look?, shootable?, hp?, soft?, offscreen? })`
(from the 'muzzle' point, speed × difficulty), `fireInterval(base, jitter?)` (× difficulty), `scaledHp(base)`,
`mods`, `drawTint(r, color, alpha)` (telegraph flash), `settle()`. Death: score (+ ×5 for knife kills of soft
enemies) + 'enemyKilled' + drop + anim by kind (`die-knife`, `die-blast` (with knock-back), `die-burn`,
`die-crush`, `die-shatter` (hit while frozen), fallback `die`; no 'die' sprite → small explosion) → corpse
blinks out after `corpseTicks`. Override `onDeath(d)` for
machines. Despawn: 96 px outside the view after being seen once. Spawn helpers: `offscreenX(world, side, margin)`,
`floorY(world, x, fromY?)`, `findFloor(world, x, { fromY?, prefer?, maxShift?, minX?, maxX? })` (the nearest
real floor, never a pit), `spawnOffscreen(world, id, side, { y?, margin?, params? })` (adds `enter: side`),
`sideAwayFromPlayer(world, toward?)`.

**Boss** (`boss.ts`): `super(world, x, y, params, { art, name, hp, score? })` — HP × difficulty × co-op.
`addPart(name, { box, hp? (own pool, breaks at 0), shared?, multiplier? (weak point), armored?, enabled?,
required?, knifeable?, contact? })` → part index = call order; `part(name)`, `setPart(name, on)`, `partRect(p)`,
`partState(p)` (0 / 1 / 2 by its HP), `partSpriteId(p)` (`<art>/<part>-<state>`); disabled / broken parts report
an off-world box. **Two HP models**: *pool* (no `required` part: hits go to the boss HP) or *required parts*
(GDD §10.0: the fight ends when every `required` part is destroyed; the bar and the phase thresholds follow
their remaining HP; hook `onRequiredPartsGone(d)`). `knifeable` parts are the only ones the automatic knife
hits; `contact` parts are the only boxes that hurt on touch (`contactBoxes()`). `phaseIntermission` (ticks)
or `intermission(ticks)` (yield it): boss and players invulnerable, enemy shots on screen erased. `phases = [{ at: 1, name?, pattern?: (b) => ScriptGen, onEnter? }, { at: 0.4, … }, { when: (b) => b.brokenCount(['horn', 'pipes']) >= 2 }]`
(`at` = HP fraction threshold, `when` = a condition; either one starts the phase; the latest phase met wins;
checked after every hit and broken part, call `checkPhases()` when a condition changes otherwise); patterns run as world scripts owned by the boss and are cancelled on the next phase / death.
`*intro()` runs first (invulnerable; shots are absorbed). Helpers: `*cycle(patterns, gap)` (random, no repeat),
`*sequence(patterns, gap)` (fixed order, as the GDD writes attack cycles), `kill(owner?)` (debug skip),
`pick(list)`, `play(name)`, `center()`, `randomPoint()`, `sparkAt(part, dirX)`, `brokenCount(names?)`
(destroyed parts, of these names or all), `partAlive(name)`. Difficulty (GDD §10.0): `telegraphFor(base)` (×
difficulty, never below 18), `recoveryFor(base)` (× enemy fire interval), `volleySize(n)` (HARD +1),
`scaledHp(base)`. Speech: `say(text, { at?: [dx, dy] (mirrored when facing left), ticks? (120), kind? ('gag' |
'radio') })` — one bubble that follows the boss; `hush()`. Hooks: `think()`,
`onPartBroken(p)`, `onDamageState(1 | 2)` (≤ 50 %, ≤ 25 %; damaged bosses smoke), `onDeathStart()`,
`deathSequence()` (return a ScriptGen to replace the chain of explosions; when it ends the boss calls
`finishDeath(false)`: 'bossDefeated', `onDefeated`, removal; default null), `onDefeated()`. Fields: `state` ('waiting' | 'intro' | 'fight' | 'dying' | 'done'), `phase`, `damageState`,
`healthFrac`, `showBar`, `autoStart` (false = call `start()` yourself), `deathTicks` (150), `removeOnDeath`,
`defeated`. Death: score, chained explosions, final 'xl', then 'bossDefeated'.

**Vehicle** (`vehicle.ts`, GDD §4.1): `super(world, x, y, params, { art, name? (HUD), w?, h?, seat: Rect,
seatPoint?, gunPoint?, cannonPoint?, cells? (3), mainGun? ('vulcan'), cannon? ('cannon'), shells? (10),
special?, specialCost?, speed?, accel?, jump? (0 = none), ramSpeed?, ramDistance?, ramDamage?, ramRadius?,
wreckDamage?, wreckRadius?, ejectWindow? (60), pilotDiesWithVehicle? (flyers), iceFriction?, bonus? })`.
Mount: a player falling onto the seat box, or touching it with down held (not with a `noMount` status).
Driver input goes to `control(pad)` (override for flyers / boats): drive, jump = hop, fire = main gun (up
turns it), bomb = cannon (uses `shells`), **down + jump = eject**, **fire + jump = ram**, **fire + bomb =
special** (`special` weapon or override `special()`). A combo needs both pressed edges on the same tick or
`TUNING.vehicle.comboWindow` (1) tick apart (`combo(a, b)`; GDD §4.1); it cancels nothing that already happened. Ram: the pilot pops
out (vy −4, invulnerable); the empty vehicle charges at `ramSpeed` for up to `ramDistance` px and explodes on
the first enemy, wall or at the end (`ramDamage` in `ramRadius`, each target once, no falloff).
**Armour**: `cellDamage(d)` — ½ cell for small hits, 1 cell for big ones (see the Damage contract, §6), all
for crush / `hazard`; 60 invulnerable ticks after a hit; the pilot cannot be hit. At 0 cells the vehicle is
**doomed**: it stops and flashes for `ejectWindow` ticks; the pilot must jump out or dies with it (EASY:
thrown out by itself); then it explodes. `pilotDiesWithVehicle`: the last cell costs the pilot a life at
once. A driven (or doomed) vehicle stays in the view like a player (`keepInView()`: x clamped half its body width
from each view edge, GDD §8.1) and never despawns (removed anyway → the pilot is thrown out).
Sprites `<art>/idle`, `move`, `wreck` with points `seat`, `muzzle`, `cannon`. API: `eject(mode)`,
`destroy(mode?)`, `explode()`, `repair(cells)`, `addShells(n)`, `canMount(p)`, `mount(p)`, `toCarry()` /
`applyCarry()` (the runner carries a mounted vehicle into the next section when that section allows it),
`point(name, fx, fy, out)`, `markerTop()`, fields `state ('idle' | 'driven' | 'doomed' | 'ram' | 'wreck') driver
lastDriver cells maxCells shells aimElev canTurn hudName doomLeft offscreenMarker`. Protected hooks: `control(pad)`,
`physics()`, `keepInView()`, `checkHazards()`, `combo(a, b)`, `trySpecial()` / `special()`, `fireMain()` /
`fireCannon()` / `fireArgs(...)`, `cellDamage(d)`, `cellsGone()`, `lowCellWarning()`, `panicInfantry()`,
`updateRam()` / `updateDoomed()` / `updateWreck()`, `seatWorld(out)`, `syncDriver()`, `rideBubbleTip(out)`,
`showRideHint()`, `animate()`. **Open-seat mounts** (the Swan): the `seat` point is the rider's HIP, drawn with
`Player.drawRide`; they override `seatWorld(out)` per pose and `syncDriver()` so the driver's x, y are the
mount's own FEET anchor (enemy AI reads a player's y as his feet; ARCHITECTURE §6.1).
**Fleet** (`content/vehicles/fleet`, GDD §8.3–§8.6): `sundae-driver`, `bandwagon`, `trumpeter`; mission notes
(`startVehicle: 'trumpeter'`, `trumpeterOf(p).flyTo / arrived / releaseAutopilot / cheer`, spawn params `facing: -1`
and `variant`) in the header of `content/vehicles/fleet/index.ts` and in [heroes.md](heroes.md).

**Swan** (`content/vehicles/swan`, GDD §8.2, docs/design/swan-mount/): `Swan` (entity `swan`, params `variant`
'ivory' | 'mute' (default: the first rider picks, P2 = the Mute), `socks`, `cells`, `shells`, `facing`), her
numbers `SWAN` (a frozen object in the module, no `TUNING.swan`), `isSwan(e)`, `HonkRing` / `spawnHonkRing(world,
x, y, owner, source)` (the HONK shockwave, also for the Trumpeter), `BeakShell` / `spawnBeakShell`,
`drawRiddenSwan(r, x, y, opts)` (title / menus). Fields a scene or HUD may read: `medium` ('ground' | 'air' |
'water'), `swimming`, `crouching`, `ducking`, `glide` ('ready' | 'open' | 'folded'), `phase` (riderless and dive
phases), `neckAngle` / `neckIndex`, `honkT`, `mute`, `migrating`, `perch` (the co-op SolidBox). While any
player rides a Swan the camera uses `lead` 64 and `maxSpeed` 4 (restored to `TUNING.camera` after the last
ride).

**Pickup** (`pickup.ts`): `new Pickup(world, x, y, { sprite, effect(player, item) → false to refuse,
vehicleEffect?, sfx? ('item/pickup'), voice?, score?, message?, magnet?, bob?, lifetime?, w?, h?, gravity? }, params)`.
Dropped items (`params.dropped`) pop up (vy −2.0), blink during their last 120 ticks and vanish after 720 ticks (GDD §7.1; `ITEM_RULES`, `TUNING.pickup`). Ready-made effects: `weaponEffect(id, ammo?)`,
`bombsEffect(n)` (vehicle: shells), `scoreEffect(n)`, `lifeEffect(n)`, `repairEffect(cells)`.

**Hostage** (`hostage.ts`, GDD §7.2): `new Hostage(world, x, y, params)` with `item` (spawn spec), `art`
('item/hostage'), `kind` (e.g. `composer`, the hidden 1UP). 'tied' (MMF! gag bubble every 120 ticks) → freed by
a player's touch, shot, blast or knife: the rescue counts at once (`slot.rescued`, `mission.hostagesFreed`,
'hostageRescued') → walks to the rescuer (stops at a wall or gap and gives where it stands) → 'give' (the item
pops from the hand) → optional 'bow' → runs off to the left. Never hurt (neutral, not shootable); never walks
into a pit. Other modules free hostages through the duck-typed `onMelee` / `onBlast`.

**Water** (`water.ts`): `waterSurfaceAt(e, x, yFrom?, above?)` (top of the 'water' hazard under x, else
Infinity), `waterRectAt(world, x, y, below = 0)` (the topmost 'water' rect holding (x, y), else null),
`overWaterAt(world, x)` (x inside any 'water' rect, at any height), `floatOnWater(e, draft = 6, maxBelow = 64)`
(call after `moveBody`; true while floating — boats, floating props). The Swan uses her own float line (feet
16 px under the surface; a one-way floor only she uses, built on `waterRectAt`).

## 10. Missions — mission/index.ts

```ts
interface MissionDef { id, name, subtitle?, music, bossMusic?, start, sections: Record<string, SectionDef>, bossSection?, next?,
  bossSections?: string[] }   // BOSS SPEED BONUS over several fights (m5): their times add up, the walk between does not
interface MissionDef { …, startBanner?: { text?, sub? }, announce?, clearLine? ('Objective secured!'),
  hostages?: Record<sectionId, number> }   // hostages per section: STANDING OVATION in the tally
interface SectionDef { id, name?, width, height, scroll: 'right'|'up'|'down'|'free', background: BackgroundDef,
  terrain: TerrainDef, terrainStyle: TerrainStyleDef, decor?: DecorDef[], playerStart: {x, y}, checkpoints?: number[],
  timeLimit? (HUD counts; default 60; 0 = none), music?, script: (ctx: SectionContext) => ScriptGen, exits?: ExitDef[], bossStart?,
  respawn?: (p, ctx) => {x, y} | null | void,   // section respawn rule (asked first; nothing = the default rule)
  startVehicle?: string,                        // every player starts (and respawns) in this vehicle
  vehicles?: string[],                          // vehicle ids that may be carried INTO this section
  iceRanges?: [x0, x1][] }                      // icy ground: players and vehicles slide (iceAt)
interface DecorDef { sprite, x, y, frame?, animate? (true | ticks per frame), flipX?, front?, parallax? (1), alpha? }
interface ExitDef { id?, rect, to (section id | 'complete'), transition?: 'fade'|'cut', entry?: {x, y}, disabled? }
// terrain builders re-exported: terrain(w, h).ground().at(0, 170).flat(400).slope(200, -40)…, platformPath, Terrain
```
**Timer**: `timeLimit` counts, one count = `TUNING.timer.ticksPerCount` = 256 ticks (≈ 4.3 s, like the reference;
60 counts ≈ 4.3 min per checkpoint segment). It refills at checkpoints and on a death; from 10 down `ui/timer-warn`
plays on every count; at 0 TIME UP! (`mission/time-up`) and every player dies ('timeout'). `bossIntro` refills it
and holds it until the banner is gone and the boss has entered. **Checkpoints**: camera-centre x positions
('right' / 'free') or y positions ('up' / 'down'): timer refill, respawn fallback point, CHECKPOINT callout +
`mission/checkpoint`, and the EASY hostage-loss mark. **Carry-over**: a player who leaves riding a vehicle keeps
it only when the next section lists it in `vehicles` (full cells at a vehicle section's end = NO SCRATCHES).
**Respawn** (drop-in): the section's `respawn` rule first; in 'up' / 'down' sections without a rule (or when it
returns nothing) the GDD §11.0 rule (`runner.verticalRespawn(p)`): a moving platform in view (a dynamic solid that
moved; its position predicted for the landing), else the lowest free floor in view; then the nearest safe floor
near the death point, then the checkpoint. `startVehicle`: every player starts mounted and gets a new one after
each respawn. **Drop-in holes**: an exit rect may sit in a pit (inside the section, above `killY` = bottom + 32):
a falling player's feet entering it take the exit before the pit kills; give `entry` for the landing spot.
**Campaign records** (`ctx.records` = `runner.records` = `session.records`, class `CampaignRecords`): `get(key,
fallback?)`, `set(key, value)`, `has`, `delete`, `keys()`, `size`, `clear()`; kept across the sections of a mission
and across missions of one game; a new game (new `GameSession`) starts empty. Use `'<mission>/<name>'` keys, e.g.
SHE TOOK THE LIFT: m3-a writes `ctx.records.set('m3/lift', [{ variant: 'ivory', cells, shells }, …])` (one entry per
swan still in one piece), m3-c reads `ctx.records.get('m3/lift', [])`. Store plain data, never entities.
**Body walls** (GDD §10.1 THE ENCORE x 2844, §11.3 the Swan-only wall in m3-a): `ctx.bodyWall(x, { keep? ('left'),
y0?, y1?, players? (true), vehicles? (true), filter?: (e) => boolean, onTouch?: (e) => void })` → `{ x, enabled,
remove() }`. A clamp like the view edges, not a solid: shots pass; bodies on the far side are pushed back each
tick (a vehicle carries its rider); `filter` narrows it (e.g. `isSwan`), `onTouch` runs on each push (eject a
grounded Swan pilot). Walls end with the section; `runner.bodyWallBetween(e, x0, x1)` asks for one in a path.

**SectionContext** (`ctx`; every helper acts at once; the ones returning a `Wait` can be yielded):
`world mission section session camera rng hud bossRush players playerCount` ·
`spawn(id, x, y | 'ground', params?)` · `spawnGroup(id, n, { x, y?, spacing? (32), params?, tag? })` ·
`enter(id, 'left'|'right'|'top', { x?, y?, margin?, params?, tag? })` (just outside the view, facing in, params.enter
set; side entries land on real floor, never over a pit) ·
`lockCamera(minX?, maxX?)` · `unlockCamera(go = true)` · `autoScroll(speed)` (the view moves `speed` px/tick in the
scroll direction and pushes the players; 0 = hold; a lock / unlock cancels it) · `waitCamera(x)` · `waitCameraY(y)` ·
`waitPlayerX(x)` · `waitClear(tag = 'enemy')` · `showGo(dir?)` · `banner(text, opts)` · `callout(text, opts?)` ·
`bossIntro(name?, { subtitle?, sfx? ('boss/warning'), music?, musicFrom?, ticks? })` (WARNING! + name + subtitle + klaxon +
boss music, timer refilled and held; yield it to wait for the banner) · `setCheckpoint(x?, y?)` ·
`music(id | null, fade?, { from?, restart? })` (`from` = start a new song at that index of its order list; the same
song keeps playing unless `restart`) · `records` (campaign records, above) · `bodyWall(x, opts?)` (above) ·
`timer.{counts, pause, resume, reset}` · `enableExit(id, on?)` · `exitTo(section, { transition?, entry? })` ·
`missionComplete()` (yield these two: `yield ctx.exitTo('b')`). Entities spawned in a script join the world at the
next tick.

**MissionRunner** (`new MissionRunner({ session, mission (id | def), section?, pads, audio?, seed?, bossRush?, settings? })`):
`start()`, `update()`, `draw(r)` (scenery + world + fade; the HUD is separate), `sky`, `events`
('sectionLoaded' | 'complete' | 'gameOver' | 'playerOut'), `state` ('playing' | 'exiting' | 'entering' |
'victory' | 'complete' | 'gameover'), `world section view players hud checkpoint timeLeft continueTicks`,
`loadSection(id, entry?)`, `exitTo`, `enableExit(id, on)`, `isExitOpen(exit | id)`, `completeMission()` (MISSION
COMPLETE! + `mission-complete` jingle), `skip()` (debug F4), `continuePlayer(slot)` (creates the Player when it is
missing), `joinPlayer(slot, char)`, `nextMission()`, `playMusic(id, fade?, { from?, restart? })`, `currentMusic`, `resumeMusic()` (keeps `from`),
`records`, `addBodyWall(x, opts)`, `bodyWalls`, `bodyWallBetween(e, x0, x1)`, `verticalRespawn(p)`,
`autoScroll(speed)` / `stopAutoScroll()` / `autoScrolling`, `pauseTimer(on)`, `resetTimer(counts?)`,
`holdTimerForBoss(ticks)`, `setCheckpoint(x, y)`. It fills `slot.mission` (MissionStats): deaths, route, kills by
type, hostages, boss start / end ticks, VEHICLE AT THE FINISH, NO SCRATCHES, the golden record.
Each section gets a fresh World (`gameEntityFactory`, seed from the mission seed + section id); players spawn at
`playerStart` (P2 20 px behind); the camera follows `world.players` and snaps. `SectionView` paints backgrounds
(lazy layer buffers from `getBgGenerator`) and terrain in lazily built 256×256 chunks (`getTerrainPainter()`
sampling `terrain.cellAt`, one chunk prefetched per frame). Unknown missions / sections → a placeholder stretch.

## 11. HUD, scenes, URL parameters, debug

`drawHud(r, { session, hud, runner, inputPlayers, ticks, settings? })` (GDD §13.7): per player (1P left, 2P right)
the score (always), the weapon icon (`ui/icon-<id>` or `def.icon`) with ammo digits only when finite, bombs
`x<n>` (in a vehicle: the shell icon + the bare count), life icons (swan heads) and hostage icons (bow ties; max 5 / 10, then `xN`), `CONT n`, the vehicle
name + cells (half cells, red blink at ≤ 1), a status icon + 24×2 timer bar, pop-up messages; CONTINUE? / PRESS
START when out or not joined; the timer frame (red under 10), the boss bar (192×4 at y 207; the BOSS BAR option),
the blinking ONWARD prompt (`ui/onward`), callouts, banners (warning / mission / info, with a detail line),
the screen flash; world-space score pop-ups and speech bubbles (gag bubbles obey SPEECH BUBBLES; radio lines
in navy).

The HUD also draws the **Swan marker** by itself (no request needed): while a ridden Swan's rider is above the
view, `ui/swan-marker` (her 6×6 head outlined in the rider's colour) at y 1, at her x, 4 px inside the sides.

Scenes (`scenes/`, GDD §13.1; `flow.ts` holds the shared steps): `BootScene` (loads, pre-renders, then waits
for a click / key that unlocks audio; `?mission=` starts that mission) → `TitleScene` (lake, ridden Swan, logo,
attract loop: demo → `HowToPlayScene` → `HighScoresScene`) → `ModeSelectScene` (1 PLAYER, 2 PLAYERS,
DIFFICULTY, OPTIONS, HIGH SCORES) → `CharacterSelectScene` (the registry's heroes: `portrait`, `fullName`,
`role`, `quote`, `quoteSub`) → `startCampaign` → `MissionIntroScene` (the mission card: `defineMissionCard` in
`flow-data.ts`, cards for m0–m5 in `content/ui/cards.ts`; a mission without a card gets one from its
MissionDef `name` / `subtitle`) → `GameplayScene` (⇄ `PauseScene` RESUME / OPTIONS / QUIT TO TITLE,
`ContinueScene` → `GameOverScene`) → `MissionCompleteScene` (THE LOWMERE LISTENER; `tallyLines`,
`bossSpeedBonus`, `hatsCollected` exported) → `missionDone`: the next mission's card (`MissionDef.next`, else
the next registered mission after m0) or, after the last one, `EndingScene` (THE LAST NOTE, SPLASHDOWN, THE
PARADE with the credits, CAPTIONS, the heroes' ending lines) → `FinalTallyScene` (§14.6) → `NameEntryScene`
(when a score qualifies) → `HighScoresScene` → title. Missions feed the tally through the session's
`slot.mission` stats and `MissionDef.hostages` (hostages per section id, for STANDING OVATION and the stars).
`startNewGame(app, { players?, difficulty?, mission?, section?, bossRush?, characters? })` skips the menus and
the card (tools, tests, `?mission=`); `firstMission()`.

URL parameters (`params.ts`): `mission section god debug seed players char weapon boss mute difficulty`.
Debug keys (with `?debug=1`): F1 hitboxes, F2 stats, F3 god mode, F4 skip (next exit / kill the boss / complete),
F5 weapons. Key M: mute.

## 12. Ids the game layer uses

The reconciled code ↔ GDD id table is `docs/ARCHITECTURE.md` §7.1 (it wins over the GDD names).
Sprites: `char/<id>/…` (§8), `item/hostage[/<kind>]/{tied,freed,walk,give,bow,run}`, `fx/explosion-{s,m,l,xl}`,
`fx/muzzle[-up|-diag]`, `fx/muzzle-heavy[-up|-diag]`, `fx/impact`, `fx/hit`, `fx/dust`, `fx/splash`, `fx/poof`,
`fx/debris-<kind>`, `weapon/{bullet,mg-bullet,vulcan-bullet,shell,grenade}`, `enemy/bullet`, `ui/icon-<weapon>`,
`ui/icon-{bomb,hostage,life,shell}`, `ui/onward`, `ui/star`.
Sounds (sfx agent): `player/{jump,land,die}`, `weapon/{pistol,machine-gun,vulcan,cannon,knife,empty}`,
`bomb/{throw,bounce}`, `explosion/{s,m,l,xl}`, `hit/armor`, `vehicle/{mount,eject,hit,ram,alarm,warning}`,
`item/{pickup,1up}`, `hostage/{free,give}`, `ui/{move,confirm,cancel,pause,timer-warn,tally-tick,tally-end}`,
`boss/warning` (bossIntro default), `mission/{checkpoint,time-up}`.
Songs (music agent): `title`, mission `music` / `bossMusic` (default `boss`), `mission-complete`, `continue`, `game-over`.
Voice lines: 'Move out!', 'Objective secured!' (or `MissionDef.clearLine`), weapon `voice`, character `voice`.

## 13. Recipes

**An enemy** (content/infantry/index.ts):
```ts
class Grunt extends Enemy {
  private cool = 90;
  constructor(w: World, x: number, y: number, p: SpawnParams) {
    super(w, x, y, p, { art: 'enemy/grunt', hp: 10 });
    this.sightRange = 240;
  }
  protected override think(): void {
    if (!this.checkAlert()) return this.play('idle');
    const t = this.facePlayer();
    if (!t) return this.play('idle');
    if (this.inRange(t, 180, 40)) {
      this.vx = 0;
      if (--this.cool <= 0) {
        this.play('shoot', { restart: true, loop: false });
        this.shoot({ speed: 3, damage: 10, sprite: 'enemy/bullet' });   // chest height: crouching dodges it
        this.cool = this.fireInterval(90, 20);
      } else if (!this.playing('shoot') || this.anim.done) this.play('idle');
    } else {
      this.vx = this.facing * 0.8;
      this.play('walk');
    }
  }
}
defineEntity('grunt', (w, x, y, p) => new Grunt(w, x, y, p), { category: 'enemy', score: 100 });
```
Longer behaviours read well as scripts owned by the enemy: `this.world.scripts.run(this.brain(), { owner: this })`
with `*brain(): ScriptGen { … yield 30; … }` (cancelled when it dies).

**A weapon** (content/weapons/index.ts, ~20 lines): see the `defineWeapon` example in weapons.ts; add
`weapon/<id>` projectile art, `ui/icon-<id>`, `item/pickup-<id>` and a `weapon/<id>` sound.
```ts
defineWeapon({
  id: 'rocket-launcher', name: 'ROCKET LAUNCHER', letter: 'R', ammo: 30, ammoAgain: 20, pose: 'heavy',
  cooldown: 20, auto: false, holdRepeat: null, maxShotsOnScreen: 2, sfx: 'weapon/rocket', voice: 'Rockets armed!',
  fire(ctx) {
    shootBullet(ctx, { speed: 4, damage: 30, sprite: 'weapon/rocket', kind: 'explosion', impact: 'none', life: 120,
      onImpact: (p, target, x, y) => explosion(ctx.world, x, y, 'm', { damage: 50, team: p.team, owner: p.damage.owner, exclude: target }) });
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', follow: ctx.shooter });
  },
});
```

**A vehicle**: subclass `Vehicle` (see vehicle.ts header), `defineEntity('buggy', …, { category: 'vehicle' })`;
override `control(pad)` for special movement (flying: no gravity body, set vy from up/down), `draw(r)` for turrets
(draw the body, the turret at `aimElev`, then `this.driver?.drawSeated(...)`), `animate()` for legs.

**A boss**: subclass `Boss` (see boss.ts header). Typical section script:
```ts
yield ctx.waitCamera(2200);
ctx.lockCamera(2200);
const boss = ctx.spawn('iron-heron', 2520, 'ground');
yield ctx.bossIntro('IRON HERON');
yield () => (boss as Boss).defeated;
yield 90;
yield ctx.missionComplete();
```

**A mission section with waves and a branch**:
```ts
const t = terrain(2400, 216);
t.ground().at(0, 170).flat(900).slope(160, -40).flat(500).gap(64).flat(776);
t.platform(1300, 100, 120);
const a: SectionDef = {
  id: 'a', width: 2400, height: 216, scroll: 'right',
  background: { sky: PAL.sky[1], layers: [{ gen: 'mountains', factorX: 0.2 }, { gen: 'treeline', factorX: 0.5 }] },
  terrain: t.build(), terrainStyle: { ground: 'dirt', edge: 'grass', platform: 'wood' },
  decor: [{ sprite: 'decor/sign', x: 120, y: 170 }], playerStart: { x: 48, y: 170 }, checkpoints: [1200],
  exits: [
    { id: 'upper', rect: { x: 1300, y: 60, w: 120, h: 40 }, to: 'b1' },      // up on the platform
    { id: 'lower', rect: { x: 2300, y: 0, w: 100, h: 216 }, to: 'b2' },      // the end of the ground path
  ],
  *script(ctx) {
    yield ctx.waitCamera(300);
    ctx.spawnGroup('grunt', 3, { x: 700, spacing: 36, tag: 'w1' });
    yield ctx.waitCamera(800);
    ctx.lockCamera(800);
    for (let i = 0; i < 4; i++) { ctx.enter('grunt', i % 2 ? 'left' : 'right', { tag: 'w2' }); yield 40; }
    yield ctx.waitClear('w2');
    ctx.unlockCamera();                                                      // shows GO
    ctx.spawn('hostage', 1100, 'ground', { item: { id: 'pickup-weapon', params: { weapon: 'machine-gun' } } });
  },
};
defineMission({ id: 'm1', name: 'MISSION 1', music: 'm1', bossMusic: 'boss', start: 'a', sections: { a, b1, b2, c } });
```

**An item**: see pickup.ts header (`new Pickup(w, x, y, { sprite, effect: bombsEffect(10), score: 500 }, p)`); crates
are enemies on the 'enemy' team (`soft: false`, `body` true) whose `onDeath` breaks them and whose `drop` param
spawns the item.

**A character** (content/characters/index.ts + art.ts): `defineCharacter({ id: 'rivet', name: 'RIVET', art: 'char/rivet',
stats: { speed: 1.05, bombs: 12 } })` and the §6.1 sprite set under `char/rivet/`. Pick it with `?char=rivet`.

**A status effect** (a slowing goo hazard; registered so every module uses the same one):
```ts
defineStatus({ id: 'goo', ticks: 180, speed: 0.5, noJump: true, tint: PAL.green[2], tintAlpha: 0.45, icon: 'ui/icon-goo',
  onEnd: (p) => splash(p.world, p.x, p.y - 8, 6) });
if (isPlayer(e) && e.state === 'play') e.status.add(getStatus('goo')!);
```

**A reaction sender** (the JINGLE van): `reactInArea(world, { x: van.x, y: van.y - 20, r: 200 }, 'queue', 120,
{ tags: ['legion'], source: van })`; the receiving enemy overrides `thinkReaction('queue')` to walk to the van.

**A boss with required parts**: `addPart('left-drum', { box, hp: 600, required: true, contact: true })`,
`addPart('pedal', { box, hp: 300, required: true, knifeable: true })`; `phaseIntermission = 60`; the fight ends
when both are gone (`onRequiredPartsGone` for the last gag).

**Boss hooks together** (conditional phase, speech, difficulty, scripted death):
```ts
class Kit extends Boss {
  constructor(w: World, x: number, y: number, p: SpawnParams) {
    super(w, x, y, p, { art: 'boss/kit', name: 'THE KIT', hp: 1 });
    for (const n of ['tom-a', 'tom-b', 'tom-c']) this.addPart(n, { box: TOMS[n], hp: 300 });
    this.addPart('core', { box: CORE, hp: 900, required: true });
    this.phases = [
      { at: 1, pattern: (b) => b.sequence([(b) => b.volley(), (b) => b.roll()], b.recoveryFor(40)) },
      { when: (b) => b.brokenCount(['tom-a', 'tom-b', 'tom-c']) >= 2, onEnter: (b) => b.say('SOLO TIME!', { at: [0, -80] }) },
      { at: 0.3, pattern: (b) => b.cycle([(b) => b.roll()]) },
    ];
  }
  *volley(): ScriptGen {
    yield this.telegraphFor(30);                       // ≥ 18 ticks on every difficulty
    for (let i = 0; i < this.volleySize(3); i++) { /* fire */ yield 8; }
  }
  protected override deathSequence(): ScriptGen | null {
    const self = this;
    return (function* fall(): ScriptGen { self.play('topple'); yield 60; explosion(self.world, self.x, self.y - 30, 'l'); yield 40; })();
  }
}
```
'bossDefeated' fires when the death sequence ends (then the section script's `yield () => boss.defeated` goes on).
For a boss over several sections (m5) set `MissionDef.bossSections`.

## 14. Testing

`tests/game/helpers.ts`: `Rig` (flat world at y = 170 + session + players on virtual pads: `hold([...])`, `tap`,
`run(n)`, `until(pred)`, `dummy(x, params)`, `ofType(type)`), `Dummy` (soft test enemy, records hits), `FLOOR`.
It also silences the expected "unknown sprite" warnings. Test files: player, weapons, life, vehicle, hostage,
boss, mission (runner incl. a branch exit, timer, checkpoints, game over, vehicle carry), core (session,
registry, params), scenes (headless title → gameplay → tally, pause, continue), capabilities (reactions, boss
parts, status hooks, erasable shots, ice, extends, EASY rules, HUD bubbles / callouts, water, respawn rules,
start vehicles, auto-scroll, vertical checkpoints), runtime-prep (campaign records, music `from`, body walls,
vertical respawn, drop-in holes, ice ranges, y checkpoints, several boss sections, boss hooks) and `tests/review/*` (regression tests for the round-1 review findings).

## 15. Known limits

- Respawn is on the spot (reference behaviour) unless the section has a `respawn` rule (or is vertical: §10);
  checkpoints refill the timer and serve as the fallback point.
- Diagonal machine-gun rounds use the `torso-heavy-diag-*` frames when drawn; the pistol has no diagonal frames
  (it does not sweep).
- A player pushed by the camera's left edge into a wall is held by the wall (it may sit slightly outside the view).
- `timeLimit` is in HUD counts of 256 ticks (set `TUNING.timer.ticksPerCount = 60` for seconds).
- `DifficultyMods.extraVolley`, `normalRows` and `hardRows` are data only: content applies them.
- The Helium Head status has its hooks (`art`, `headScale` in the rig, `onDraw`, `sfxPitch`) but no strips yet.
- The bot (`npm run sim`) cannot fly, swim or ride cable cars yet (docs/api/slice.md).
