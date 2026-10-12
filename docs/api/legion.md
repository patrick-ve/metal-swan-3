# Legion API — the Fanfare Legion's soldiers, machines and support entities

Reference for the **mission and boss agents**. Every id below is registered by the manifest
entries `infantry`, `infantry/rhythm`, `infantry/winds`, `machines/armor`, `machines/transport`
(+ their `…/art`). Numbers are NORMAL; GDD §9.0–§9.2, §9.5 and §4.11 are the spec, this page says
how the code does it. Source headers (`src/game/content/infantry/**`, `machines/**`) hold the
details. Tests: `tests/content/{infantry,rhythm,winds,armor,transport,legion}.test.ts`.

## 0. Placing things

```ts
ctx.spawn('rifleman', 700, 'ground', { gag: 'cards', outfit: 'deck', tag: 'w1' }); // feet on the floor under x
ctx.enter('cymbalist', 'right', { tag: 'w2' });                 // just outside the view, runs in (skips gag)
ctx.enter('rifleman', 'top', { x: 900, params: { entry: 'parachute' } });
ctx.spawnGroup('drummer', 3, { x: 1200, spacing: 34, params: { column: 'c1', facing: -1 } });
yield ctx.waitClear('w2');                                      // see "holds waitClear" below
```

- **y is the feet** (soldiers, ground machines, props) or the **hull centre** (flyers:
  `piano-bomber`, `baton-copter`), or the **mount surface** (`metronome-turret` hung from a
  ceiling). Water craft (`rowboat`, `tank-barge`) take the water surface under x.
- **holds `ctx.waitClear()`** = has the `enemy` tag. Yes: every infantry type, `oompah-tank`,
  `tank-crewman`, `band-truck`, `metronome-turret`, `gramophone-mortar`, `piano-bomber`,
  `baton-copter`, `pipe-battery`, `drum-barricade` (unless `holdsWave: false`). No:
  `anthem-speaker`, `rowboat`, `tank-barge`, `subway-train`, `parade-float`, all projectiles.
- **Shared params** (every entity): `facing` (`1`/`-1`/`'left'`/`'right'`), `hp` (overrides the
  base HP), `drop` (spawn spec of the item dropped on death), `tag` / `tags` (wave tags).
- **Difficulty** (GDD §4.10): telegraphs ×1.25 / ×1 / ×0.9 (never < 18 ticks), fire intervals and
  bullet speeds scale; *big* enemies (all machines, `drum-barricade`, `pipe-battery` pipes,
  `rowboat`, `parade-float`) scale HP by difficulty and ×1.25 with 2 players.
- **Fairness is built in** (GDD §4.11): attack tokens (3 / 4 / 6), no shot from outside the view
  (8 px margin, checked at the shot), gags are free time. A level designer only has to keep
  attackers where the player can see and reach them.

## 1. Infantry (all `Soldier`s)

Rig 38 px tall incl. shako, hitbox 14×28 (crouch 14×18), anchor at the feet; walk 0.6, run 1.2;
step down ledges, climb ≤ 24 px; turn to the nearest player every 30 ticks.

**Shared soldier params** (`rifleman`, rhythm and winds types):

| param | values (default) | effect |
|---|---|---|
| `outfit` | `parade` · `deck` (m1) · `desert` (m2) · `snow` (m3) · `night` (m4–m5) | art `enemy/<id>-<outfit>/…` |
| `skin` | `a` · `b` · `c` (random per spawn) | skin tone, art `…-skin<x>` (cosmetic rng) |
| `entry` | `walk` · `run` · `drop` · `parachute` · `popup` · `window` · `chimney` · `manhole` · `truck` · `rowboat` · `float` · `ski` · `skate` | `ctx.enter` from a side = `run`, from the top = `drop` |
| `gag` | a gag name · `true` (random of the type's) · `false` (placed soldiers: 40 % gag) | free time until he notices (160 px ahead / 48 behind / a shot or blast within 48 / an ally's shout within 96) → double-take 36/24/12 ticks → alert 12; killed before the double-take ends: CAUGHT NAPPING +100 |
| `column` | column id (+ `march` px/tick, default 0.6; drummers only 0.5) | members march in step (30-tick beat); the drummer sets the tempo, his death = the column stumbles 60 ticks |
| `patrol` | px | walks back and forth around the spawn x |
| `carrier` | an Entity | rides along with it (`rowboat` / `float` entries; the carriers set it) |

Shared gags: `cards` (spawn a `card-table` next to him), `kazoo`, `shine`, `rehearse`, `nap`,
`newspaper`; mission gags: `ice-cream` (m2; drops a cone), `snowman` (m3; the snowman stays and
loses its head when he dies), `queue` (m4).

**Reactions** they accept (`enemy.react(kind, ticks, source)` or `reactInArea(world, shape, kind,
ticks, { tags: ['legion'] })` from `src/game/enemy.ts`): `salute` (anthem: freeze, no attacks),
`panic` (40 ticks at 1.6 px/tick; also automatic for a player grenade within 36 px), `confused`
(baton-major death, 60), `freeze` (sundae-mortar, 90: any hit shatters him), `queue` (JINGLE),
`ears` (HONK; not the bassoonist), `photo` (SAY CHEESE, every non-boss enemy), `stumble`,
`buff` (riflemen only: IN STEP!). Every reaction cancels a running telegraph and frees the token.

**Deaths by damage kind**: bullet/laser/impact `die` (shako pops 24 px; laser: 4 rising notes),
explosion `die-blast` (arc vx ±1.5, vy −3), fire `die-burn` (runs a circle 30 ticks), knife
`die-knife` (the swoon), crush `die-crush`, frozen + hit `die-shatter`. All ≤ 60 ticks; corpses
never block shots.

| id | size · HP · score | behaviour and timings (T telegraph → A attack → R recovery, ticks) | own params | type gags |
|---|---|---|---|---|
| `rifleman` | 16×38 · 10 · 100 | keeps 80–160 px, uses crates/walls (`cover` tag) as cover, crouches 30 %. Shot T 18 (muzzle glint) → bullet 2.5 px/tick chest high (crouch shot 11 px up: jump it) → R 30; 90 between shots (HARD: 2-shot burst). 45° up-shot when the player is > 40 px above, < 120 px sideways. Grenade (25 %, player 40–140 px): T 20 → arc → 30-tick blinking fuse → r 14 (knife or shoot it on the ground: 50); cooldown 180. Butt swing (< 18 px): T 50 → 20×20 for 6 → R 30 | `range`, `grenades` (bool), `crouch` | shared |
| `drummer` | 28×38 (drum 26×26) · body 30, drum 120 · 300 (+100 drum) | advances 0.5 (one step per 30-tick beat, `enemy/drum-hit`). Front bullets/laser/homing hit the drum (`hit/drum`); spread shots, flame, blasts, rings, mines, knife and anything from behind hit him. Charge (player < 72 px): T 30 drumroll → 2.5 px/tick for 64 px, contact kills (jump the 26 px drum) → R 40 dizzy. Drum broken: runs away 1.4, no attacks. Death: the drum rolls 64 px | `drumHp` | `nap`, `air-solo` |
| `cymbalist` | 22×36 · 30 · 300 | keeps 48–140 px. CRASH T 32 → ground shockwave 10 px tall, 2.5 px/tick, 160 px, stopped by walls > 8 px (HARD: both ways) → R 50 (dizzy: free window). HARD only: frisbee T 24 → disc 28 px up (crouch), 3 px/tick, 200 px | — | `tune`, `yawn` |
| `triangle` | 14×32 · 10 · 200 (+800 QUIET PLEASE) | no weapon. On noticing: DING ×3, 30 apart (90 total), then ALARM: `alarm` enters from the nearest view edge, `ALARM!` flashes, he runs off and despawns. Killed before the third ding: +800 | `alarm`: count of riflemen · an id · a list of ids / `{ id, params?, x?, y? }` (with `x`: spawned there, e.g. out of chimneys); default 3 `rifleman`. `duet`: same id = ring together, one alarm | `counting` |
| `baton-major` | 18×46 · 100 · 1,000 + `medal` | stays 60–120 px behind the soldier nearest the player; marches in place. IN STEP! every 240: T 20 whistle → riflemen within 120 px cooldowns ×0.7 for 240. Baton: T 30 twirl → boomerang 140 px out and back at 3 px/tick (hits both ways, cannot be shot; a tuba ring erases it) → R 30; 20 % fumble = stunned 60. Death: infantry within 160 px `confused` 60 | `column` (marches behind that column, leads it once alerted) | `twirl` |
| `oompah-trooper` | 26×40 · 60 · 500 | walks 0.4; attacks at 60–200 px and only when the target is within 24 px of his floor level. OOMPAH T 36 (inhale) → `sonic-ring` 1.5 px/tick, grows 12→24 over 40 ticks, range 180, centre 18 px up (30 HP, shoot it: 50) → R 60. Every 3rd blast: LOW NOTE `low-ring` 24×8 rolls on the ground at 2 px/tick | `range` (preferred distance, random 110–170) | `polish`, `practice` |
| `piccolo` | 30×10 prone · 20 · 400 | **place him prone on a roof, ledge or balcony, never on the main ground line**; he never walks (entries ignored). Aim T 45: dotted crimson line to the player's chest, locks solid 12 ticks before the shot → `piccolo-bullet` 4 px/tick along the locked line → R 120. Aim cone 70° up to 80° down, needs line of sight (right under his ledge is safe). Woken from a gag: +40 ticks before the first aim. Death: slides off the ledge | — | `scales` |
| `bassoonist` | 20×36 · 40 · 600 | anti-vehicle: targets a driven player vehicle first; keeps 120–220 px. Rocket T 40 (kneels, aim in 22.5° steps ±45°, holds still the last 12) → `bassoon-rocket` 1.0 → +0.1/tick → 3.5, straight, 10 HP (50), blast r 12 → R 90. Ignores HONK (ear-muffs). Place him on the player's level: shots are straight lines | `range` (random 140–200) | `reed` |

Helpers (`src/game/content/infantry/index.ts`): `riflemanRunIn(world, side, params?)`,
`riflemanDrop(world, x, params?, parachute?)`, `riflemanPopUp(world, x, y, params?)`.

## 2. Machines

Shared: not knifeable; damage states at 50 % (smoke, dents) and 25 % (flames, sparks); every hit
flashes; `hit/metal` pings. Machines take `photo` only (never the anthem).

| id | size · HP · score | behaviour and timings | params (default) |
|---|---|---|---|
| `oompah-tank` | 72×44 (hull 64×28 + turret 24×14) · 500 · 3,000 | drives in at 1.0 to `stopX` with **spawn armour** (shots ping) until it stops or 240 ticks; then 0.4 px/tick keeping 160–240 px from the nearest player, never into a pit/hazard or out of a locked view; turns in 40 when a player is 40 px behind. Bell shell T 45 (bell glows, `enemy/tuba-inhale`) → arc vx 2.2, vy −2.5, g 0.12, r 18 → R 80 (it lands ≈ 150 px ahead: it guards the near edge of its band). Bass pulse (< 64 px) T 24 → ground wave 48 px each side, 10 px tall → R 40. Hull top = one-way platform. Death: sad notes, `tank-crewman` hops out, solid wreck 56×20 for 600 ticks | `stopX` (none = starts in place), `maxX` / `minX` (leash; m1-c), `enter` |
| `tank-crewman` | rig · 10 · 100 | spawned by the dying tank; scurries off in the panic pose, never attacks | — |
| `band-truck` | 88×48 · 500 · 2,000 | drives in at 2.0 (spawn armour) to `stopX` (brake), unloads `cargo` one per 20 ticks (`entry: 'truck'`), honks, reverses out at 1.5 after 300. Contact while moving kills. Death: instruments rain, wreck 300 ticks, drop table `truck` | `stopX` (112 px inside the view), `cargo` (3 `rifleman` + 1 `cymbalist`; list / `{id, params}` / count map / `'none'`), `from` (`right`), `speed` (2.0; m2-b 3), `ram` (m4-b: rams a driven vehicle), `outfit`, `tag` → cargo |
| `metronome-turret` | 32×48 · 300 · 1,500 | hangs from a ceiling (spawn y = the ceiling); `floor: true` stands it up (auto when spawned on a floor with open air above). Pendulum ±50°, 60 ticks per swing; glows the last 18 before each extreme (tick/tock) → 3-bullet burst along the pendulum, 2.5 px/tick, 6 apart. After 600 ticks in view: 45 ticks per swing. Starts when first on screen | `floor`, `swing` (60) |
| `gramophone-mortar` | 40×40 · 240 · 1,200 | every 150: T 50 (horn aims 30 + needle scratch 20) → `record` lobbed to land at the player's x (vx ≤ 3, vy −3.5, g 0.15) → rolls 1.5 px/tick for 96 px, 6 px tall (jump), 10 HP (50), knifeable | — |
| `pipe-battery` | 64×64, 5 pipes · 5 × 120 · 3,000 (+300 per pipe) | wall emplacement, spawn = bottom centre; the wind chest is armoured. Cycle 180: pipes glow 30 each in chord order → `note-rocket` straight up → comes down near a player after a 40-tick ground shadow, r 14 (10 HP, 50). Dies when all 5 pipes are gone | `pipeHp` (120) |
| `anthem-speaker` | 24×40 · 100 · 500 | support, never attacks, no `enemy` tag. Every `interval` while on screen: crackle 30 (♪, `machine/anthem-crackle`) → anthem 180 (`env/anthem-sting`): Legion infantry within 240 px salute; `windup-bot`s dance. Destroyed while playing: salute lasts 60 more | `interval` (900), `first` (= interval), `auto` (true), `triggerX`. Script: `playAnthem(entity)` from `machines/armor/speaker` |
| `piano-bomber` | 96×36 · 400 · 4,000 | flies at 1 px/tick (hull centre y 20–64, default 36), up to 3 pianos per pass near the nearest player: T 50 bay opens + growing shadow + `machine/piano-whistle` → `piano` falls (acc 0.25) → crush 32×24, PLONK. Bay must be in view at start and release. Contact kills. Death: last piano lands on itself | `dir` / `from` / `enter` (right → left), `mode` (`ground` · `air`: pianos fall through the screen, `!` at the top 40 ticks before), `pianos` (3) |
| `baton-copter` | 48×36 · 200 · 1,500 | hovers with its skids 60–90 px over the floor, new spot near the player every 120 at 1.2. Note spread T 24 → 3 `note-bullet`s at 60/90/120° (down-forward, down, down-back), 2 px/tick → R 60. Contact kills. Death: spins down, pilot parachutes | `mode` (`ground` · `air`: level flight 1.2, spread aimed ±15°), `dir` |

## 3. Support entities (GDD §9.5)

| id | size · HP · score | behaviour | params (default) |
|---|---|---|---|
| `drum-barricade` | 32×64 · 600 · 2,000 | full solid wall (blocks players, vehicles, shots); a rammed Bandwagon explodes on it; never despawns. Destroyed: drums roll away, decor pile stays | `holdsWave` (true) |
| `rowboat` | 48×12 · 40 · 200 | on water (keel 6 px under the surface); 2 riflemen stand in it 12 px each side and shoot (`entry: 'rowboat'`). Rows to `stopX` at 0.8, else waits. Sinks when empty (no points) or destroyed (crew lost in deep water) | `stopX`, `crew` (2 `rifleman`; `'none'` = decoy), `outfit`, `tag`, `dir` |
| `tank-barge` | 96×12 · — · — | log raft drifting 0.3 px/tick on water with an `oompah-tank` on board (no spawn armour); one-way platform players can ride; halts within 60 ticks when the tank dies | `dir` (right → left), `speed` (0.3), `cargo` (`oompah-tank`; `'none'`), `outfit`, `tag` |
| `subway-train` | 400×40 · — · — | spawn its feet on the track bed (m4-c1 y 192), x ignored. T 120 (rail sparks, headlight, `env/train-bell` every 60, rumble last 30) → passes at 6 px/tick (`env/train-pass`): kills players on the track bed, flattens soldiers; a station platform at roof height (y 152) is safe | `from` (`right`), `telegraph` (120), `speed` (6), `cars` (4 × 100 px) |
| `parade-float` | 96×40 (deck 42 px up) · 300 · 1,500 | moving **solid** platform at 0.5 px/tick (halts while a player blocks its nose; pushes soldiers); 2 riders (`entry: 'float'`); optional mast hostage. Death: riders drop, hostage freed, chassis 240 ticks | `variant` (`tuba` · `drum`), `riders` (2 `rifleman`; `'none'`), `hostage` (spawn spec, e.g. `{ id: 'hostage', params: { kind: 'critic', bind: 'float', drop: 'M' } }`), `outfit`, `tag`, `dir`, `speed` |

Transport spawn examples (y = hull centre for flyers, water surface for boats):

```ts
ctx.enter('band-truck', 'right', { margin: 48, params: { stopX: 2250, cargo: ['rifleman', 'rifleman', 'cymbalist'] } });
ctx.enter('piano-bomber', 'right', { y: 32 });
ctx.enter('baton-copter', 'right', { margin: 32 });
ctx.enter('rowboat', 'right', { margin: 48, params: { stopX: 960, outfit: 'deck' } });
ctx.enter('tank-barge', 'right', { margin: 48 });
ctx.spawn('subway-train', 0, 192, { from: 'right' });
ctx.spawn('oompah-tank', 1800, 'ground', { stopX: 1700, maxX: 1820 });
ctx.spawn('metronome-turret', 1400, 40);            // hangs from the ceiling at y 40
ctx.spawn('drum-barricade', 3512, 'ground');
```

## 4. Projectiles (spawnable by bosses and scripts)

`ctx.spawn(id, x, y, { facing })`: x/y = the shooter's feet unless noted. All are `team: 'enemy'`.

| id | what | notes |
|---|---|---|
| `enemy-bullet` | 8×3 brass pellet, 2.5 px/tick, 24 px above y | params `angle` (degrees, 0 = right, −90 = up; default along `facing`), `speed` |
| `enemy-grenade` | lobbed (vx 1.8 × facing, vy −3, g 0.15), 30-tick fuse, r 14 | param `vx`; shoot/knife it on the ground: 50 |
| `sonic-ring` / `low-ring` | the oompah's rings (ring 30 HP) | erased by tuba rings |
| `shockwave` | ground wave 10 px tall, 2.5 px/tick | `pierce`, not shootable |
| `cymbal-disc` | 28 px up, 3 px/tick, 200 px | crouch under it |
| `baton` | boomerang 10×10, cannot be shot | |
| `piccolo-bullet` | 4 px/tick | |
| `bassoon-rocket` | 1.0 → 3.5 px/tick, 10 HP, r 12 | |
| `bell-shell` | arc vx 2.2, vy −2.5, g 0.12, r 18 | |
| `metronome-bullet` | 2.5 px/tick | |
| `record` | lob + roll 96 px, 10 HP, knifeable | |
| `piano` | falls (acc 0.25), crush 32×24, cover 600 ticks / floats on deep water | params `mode`, `vx`, `vy`, `harmless` |
| `note-bullet` | 2 px/tick, 10 damage | params `vx`, `vy` |
| `note-rocket` | falls near a player after a 40-tick shadow, r 14, 10 HP | |

Every one of them is tagged `erasable` (Projectile default for enemy shots): tuba rings, HONK, the respawn POOF
and boss intermissions remove them.

## 5. Sounds (GDD §15.7) and events

- Infantry: `enemy/alert`, `enemy/double-take`, `enemy/rifle`, `enemy/aim`, `enemy/windup`,
  `enemy/grenade`, `enemy/panic`, `enemy/salute`, `enemy/aria`, `enemy/die-1..3`, `enemy/drum-hit`,
  `enemy/drumroll`, `hit/drum`, `enemy/cymbal-raise`, `enemy/cymbal-crash`, `enemy/triangle`,
  `enemy/whistle`, `enemy/fumble`, `enemy/tuba-inhale`, `enemy/tuba-blast`,
  `enemy/piccolo-whistle`, `enemy/piccolo-shot`, `enemy/bassoon-aim`, `enemy/bassoon-rocket`.
- Machines: `machine/tank-move`, `machine/tank-charge`, `machine/sad-notes`, `machine/brake`,
  `machine/truck-horn`, `machine/metronome-tick` / `-tock`, `machine/scratch`,
  `machine/pipe-charge`, `machine/anthem-crackle`, `env/anthem-sting`, `machine/copter` (loop),
  `machine/piano-whistle`, `machine/piano-crash`, `env/train-bell`, `env/train-pass`,
  `env/water-splash`, `hit/metal`. Looping sounds stop in `onRemove`.
- Events: every kill emits `enemyKilled` (`{ enemy, damage, points, player }`); the props
  `rowboat` and `parade-float` award their points but emit no `enemyKilled` and add no kill.
  Score pop-ups: QUIET PLEASE (+800), CAUGHT NAPPING (+100), SET PIECE (+200, piano crush).

## 6. Known limits

- Bell shells land ≈ 150 px ahead of the tank, which keeps 160–240 px: it hits a player who
  closes in, not one who keeps his distance (GDD numbers; documented choice).
- `bassoonist` and `oompah-trooper` fire straight: put them on the player's level. Oompah rings
  ignore targets more than 24 px above or below his floor.
- `tank-crewman`'s `panic` and `run` strips are the same art. The tank wreck is a flat 56×20 block
  (on a slope one end floats a little; use `maxX` to keep the tank on flat ground).
- `rowboat` oar is hard to see at 1x; the `tank-barge` shows only ~6 px above the water.
- The piano-bomber's `air` mode is tested headless only (m5-a does not exist yet).
- Winds outfit × skin looks register on first spawn (the first desert soldier's strips render
  when they first play); rifleman and rhythm skins are registered at load (lazy frames).
- `armor/machine.ts` (`Machine`) and `transport/machine.ts` (`TransportMachine`) are two similar
  machine bases; subclass the one of the sub-area you extend.
