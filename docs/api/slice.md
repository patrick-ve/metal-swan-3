# Content slice API — fx, sfx, music, items, infantry, m0, headless harness, bot, tools

Owner: content-slice agent. Source: `src/game/content/{fx,sfx,music,items,infantry}/index.ts`,
`src/game/content/missions/m0/**`, `src/sim/**`, `tools/{shot,sim,smoke}.ts`.
Tests: `tests/content/*.test.ts`, `tests/sim/*.test.ts`. Read `docs/api/game.md` first (Enemy,
Boss, Pickup, Hostage, MissionRunner). Art for these ids comes from the art modules (`*/art.ts`).

## 1. Entity ids

| id | params | notes |
|---|---|---|
| `rifleman` | `entry` (`walk` \| `run` \| `drop` \| `parachute` \| `popup`), `gag` (true / name / false; default 40 % of placed soldiers), `patrol` (px), `range` (px), `grenades` (bool), `crouch`, `outfit` (`enemy/rifleman-<outfit>/…` when drawn), Enemy params `hp drop facing tag` | `ctx.enter(…, 'left' \| 'right')` = runs in alerted; `ctx.enter(…, 'top')` = drops in |
| `crate` | `contains` (alias `contents`): weapon id, crate letter `M S R F L H T B`, `bombs`, `repair`, `1up`, `food` / food kind, `gem` / gem kind, a drop-table name, `auto` (table `crate`), any entity id or `{ id, params }`, a list (one is picked); `hp` (30) | team enemy + tags `shootable soft crate cover`: shots, blasts and the knife break it; 100 points; never a kill, never holds a wave; riflemen hide behind it |
| `pickup-weapon` | `weapon` (id or crate letter) | sprite `item/pickup-weapon/<id>` → `item/pickup-<letter>` → `item/pickup-<id>`; 500 |
| `pickup-bombs` | `count` (10) | +10 bombs (riding: shells); 500 |
| `pickup-food` / `pickup-gem` | `kind` (bread cheese teacake jelly birthday-cake / golden-note gem medal golden-record) | score only (`FOOD_SCORE`, `GEM_SCORE`) |
| `pickup-1up` / `pickup-repair` | — | +1 life (10,000 when 9) / +1 vehicle cell (1,000 on foot) |
| `hostage` | `gives` (aliases `drop`, `item`; like `contains`; default: table A, roadie B, tea-lady C, tourist D, composer `1up` — old kind `maestro` still works), `kind` (art `item/hostage/<kind>` when drawn) | game-layer `Hostage` + 500 points when freed; the composer plays `hostage/composer` |
| `fx-explosion` | `size` s/m/l/xl, `damage` (0), `team` (enemy), `radius`, `debris`, `silent` | one explosion |
| `fx-explosion-chain` | `count` 5, `interval` 8, `spread` 24, `size`, `damage`, `team` | set pieces |
| `fx-smoke` | `rate` 6, `life` (0 = forever), `dark`, `spread` | smoke column |
| `fx-sparks` / `fx-debris` / `fx-dust` / `fx-splash` | `count`, `dirX` / `kind` | one-shot particles |
| `m0-crate-colossus` | `facing` | the m0 test boss (`missions/m0/boss.ts`) |

Helpers (items/index.ts): `contentsSpecs(v, world, table)`, `DROP_TABLES` (`crate`, `table-a…d`,
`officer`, `truck`), `weaponForLetter(letter)`. Drop rolls use `world.rng`.

## 2. Rifleman (infantry/index.ts)

Modes: `enter drop hide idle gag notice move crouch aim recover windup swing panic` (field
`mode`, `modeT`). Numbers in `RIFLEMAN` (GDD §9.1): walk 0.6 / run 1.2, shot telegraph 18 (+
muzzle glint on the last 2 ticks, `enemy/aim` click) → 2.5 px/tick bullet at chest height 24 px
with a **1 px tall** hitbox (`chestY`, `shotH`: it passes 3.5 px over a crouched player, also on
steps and slopes; crouch shot at 11 px — jump it) → recovery 30, ~90 ticks between shots, HARD
2-shot bursts; the muzzle is checked again at the shot (never fires with it off-screen); hitbox
14×28 standing, 14×26 crouched (`CROUCH_BOX`: the crouched figure is ~27 px tall, so standing
shots hit it); hops onto steps up to 24 px (`climb`) and never walks off a drop of more than 40 px; grenade (25 % at 40–140 px)
telegraph 20 → `LobGrenade` (lands, blinks 30 ticks, blast r 14; knife or shoot it: defused, 50
points); butt swing (≤ 18 px) telegraph 50 → 6 ticks → 30; up-shots at 45°; keeps 80–160 px,
uses crates as cover (one soldier per crate), spreads out, crouches at random, panics at a
nearby player grenade, backs off up close; telegraphs via `telegraphTicks` (× `telegraph`, ≥ 18),
intervals × `enemyFireInterval`, bullet speed × `enemyBulletSpeed`. Tagged `legion`: accepts the Legion
reactions (salute, panic, confused, freeze, queue, ears, photo, stumble) and `buff` (IN STEP!: cooldowns
× 0.7 for the buff time); a reaction cancels the telegraph and frees the attack token. Gags: notice at 160 px ahead / 48 behind
/ shots or blasts within 48 px / an ally's shout; double-take 36/24/12 + alert 12; killing a
soldier in a gag or double-take pays CAUGHT NAPPING (+100). Deaths: game-layer anim by kind +
a random yelp (`enemy/die-1..3`), knife swoon note `enemy/aria` rising a major-scale step per
knife kill within 180 ticks. No firing with the muzzle off-screen.

Shared for other infantry: `takeAttackToken(world, e)` / `releaseAttackToken(world, e)` /
`attackTokenLimit(world)` (3 / 4 / 6 by difficulty, GDD §4.11 rule 4). Spawn helpers:
`riflemanRunIn(world, side, params)`, `riflemanDrop(world, x, params, parachute)`,
`riflemanPopUp(world, x, y, params)`.

## 3. Sounds (sfx/index.ts) and songs (music/index.ts)

`SFX` (≈ 100 recipes) covers the task list, the game layer's ids and the GDD §12.1 ids of the
weapon / explosion / hit / player / item / hostage / vehicle / enemy / ui families, plus
`boss/part-break`, `mission/checkpoint`, `mission/time-up`, `enemy/aim`. `SFX_ALIASES` maps
equal sounds (`weapon/machine-gun`→`weapon/mg`, `weapon/cannon`→`vehicle/cannon`,
`bomb/throw|bounce`, `hit/armor`, `player/respawn`, `item/bomb`, `crate/break`,
`vehicle/mount|eject`, `enemy/shot`, `enemy/die`, `ui/tally-tick`, `boss/warning`, `pickup/*`).
Loudness is tested: peak 0.18–0.985, RMS of the audible part −26 … −9.5 dB.
Never delete an `SFX_ALIASES` entry: other modules play the old names. `swan/honk` (saw + pulse
180→232 Hz through a band-pass) is a placeholder the vehicles agent may refine; `hostage/composer`
(alias `hostage/maestro`).

Songs (`SONGS`): `title` (D major, 112 bpm, intro 4 → A 8 → B 8 → A′ 8, loop ≈ 51 s), `m0` (E minor,
150 bpm, loop ≈ 32 s), `boss` (156 bpm, intro → A B C, loops from A). Cues (`CUES`, loop): `continue`
(one block that climbs a semitone per slot: order `A A+1 A+2 A+3 A+4`). Jingles (`JINGLES`, once):
`game-over` (80 bpm, ends on C#4), `mission-complete` (140 bpm, the swan-honk hook; drum kit letter
`x` = `swan/honk`). Write bars with `bars(...)` — it throws unless every bar has **16 rows** (4/4 at
`rowsPerBeat: 4`). For 6/8 use `rowsPerBeat: 3` and join your own 12-row bars (do not use `bars`).

## 4. Mission m0 — the test range

`a` 2400 px (flat → 1:1 slope → plateau + platforms → slope → pit 1240–1296 → solid stairs →
arena lock 1600–1984 with 2 waves → MG crate → hostage (bombs) → exits `upper` (platform
staircase, → `b1`) and `lower` (ground, → `b2`), both enabled after the arena);
`b1` 960 px rooftops; `b2` 960 px drain; `c` 1152 px boss arena (`bossStart` for `?boss=1`).
Music `m0`, boss music `boss`. Decor sprites `decor/m0/sign` (4 frames), `decor/m0/target`.

## 5. Headless harness (src/sim)

```ts
import { createHeadlessGame } from '../src/sim/index';
const game = await createHeadlessGame({ missionId: 'm0', sectionId?, seed: 1, players: 1, god: true,
  bot: { route: 'upper' } | true | false, characterId?, difficulty?, bossRush?, weapon?,
  input?: InputTimeline | ((tick) => mask), clock?: () => performance.now(), loadContent?: true,
  autoContinue?: true, captureConsole?: true, echoConsole?: false });
game.step(n); game.runUntil((g) => g.done, maxTicks); game.renderFrame(); // PixelBuffer 384×216
game.teleport(x); game.player(0); game.runner; game.world; game.ticks; game.missionComplete;
const report = game.report(); game.dispose();
```
The real app runs (GameplayScene + MissionRunner + HUD) with `SoftRenderer`, `SimAudio` (counts
sounds; `missingSfx` / `missingSongs`), `MemoryStore`. Errors (world errors, scene exceptions,
content load failures) are caught and reported with stacks; the run goes on. `SimReport`:
`sectionsVisited finalSection finalX missionComplete completeTick bossDefeated gameOvers
continues kills knifeKills killsByType deaths deathCauses shots bombs hostages pickups score
timeouts maxEntities errors warnings missingSfx missingSongs timing`. `comparableReport(r)` drops
timing and console lines (determinism checks).

## 6. Bot (src/sim/bot.ts, bot-nav.ts, bot-flight.ts, bot-swan.ts)

`new Bot(host, slot, { route: 'lower' | 'upper', bombs, vehicles, dodge })` is an `InputSource`.
Each tick it picks a **mode** from the player's state (debug field `bot.mode`): `foot`, `flight`
(mounted on a `trumpeter`), `swan` (riding a `swan`), `drive` (any other vehicle), `menu` / `idle`.
Goals in order: empty vehicle nearby (never one that threw this player out) → wandering freed
hostage → pickup → locked arena (hold 120 px from the left edge; not in 'up' / 'down'; against a
boss that rams along the floor — it has a `ramming` field, the ams scan car — stand at its rear
bumper, `RAM_REAR` 36 px behind its x, and back away while it revs or drives in front of us; on a
ledge 40–120 px over targets that stay below for 240 ticks with no boss: their floor, dropping
through) → the open exit of the chosen route (upper = highest rect; aimed at the player's own
height inside a tall rect; from above the rect, its floor) → a cable car that goes our way → the
scroll direction. A boss driving a low contact box (≤ 30 px) at us is jumped straight up when its
front is 38–70 px away (`jumpWhy` `ram`). Presses start on CONTINUE, fire on
the tally. Debug fields: `mode goalX goalY goalKind jumpWhy`; `bot.swan.why / air`,
`bot.flight.safe / wishX / wishY`.

- **foot:** fires constantly (taps / holds), turns to targets behind (ground only), aims up,
  dodges by simulating incoming shots against stand / crouch / step / jump (pit-safe), throws
  bombs at bosses and groups, boards vehicles (down on the seat, else a hop). Every jump over a
  gap or hazard is planned (`predictLanding`: no air drag, so the landing follows from the
  take-off) and steered in the air onto the landing span (`steerOnto`). Climbs platform stairs
  toward goals above (nearest ledge 8–44 px up, terrain or a dynamic solid), jumps into an exit
  rect just above, drops through one-way platforms and walks off solid shelves toward goals below
  (the walk-off side is kept until airborne). **Vertical sections:** 'up' climbs (and walks the
  floor, turning at walls, when no ledge is in reach), 'down' drops. **Rides:** boards a cable car
  that goes our way (stands on its leading half; a car that waits for a rider only starts then),
  stays on board while its path end is nearer the goal, steps off at the end; at a gap with no
  safe landing it waits (≤ 600 ticks) for a moving platform (floats, bellows) and jumps when the
  predicted landing is on it. Stuck detector: jump at 90 / 150 ticks, back off at 240.
- **flight** (Trumpeter, m5-a): every tick it tests the 9 stick moves over 32 ticks against enemy
  shots and bodies (moved by their last step, shots with gravity; the ship moves with the
  auto-scroll and is clamped in the view); takes the safe move that ends nearest its wish (a
  pickup, else the twin-gun line of the best target ahead, else the left middle of the view),
  else the move hit last. Holds the twin gun, drops dive bombs on targets in their fall line,
  HONKs (release fire, then fire + bomb) when ≥ 3 shots close in and nothing escapes. **Never
  presses jump** (no bail-out). `dodge: false` turns the threat test off.
- **swan** (m1-c, m3-a): runs toward the goal holding the beak gun (up at targets above, shells at
  bosses / crowds); jumps walls and steps (≤ 90 px), pits and deadly hazards, enemies in the way
  (stomps), banks out of the water and goals on ledges above — each jump planned with her own
  ballistics (4-tick squat / 8-tick paddle-up, vy −5.9, g 0.18, air cap, the 60-tick glide) and
  only taken when it lands safely (water is a floor for her); in the air it tests steer on / let
  go / back × glide / no glide and keeps the safe landing nearest the goal. Swims, never ducks.
  **Never ejects or SWAN DIVEs:** down is never pressed; jump only while fire has been held 3+
  ticks. At 0 cells it presses jump to get out.
- **drive** (ground vehicles): forward, fire, cannon at bosses, hop gaps; at 0 cells it ejects
  (down, then down + jump).

On m0 it finishes both routes in ~5,700 ticks with 0 deaths in god mode (seeds 1–6) and ~1–5
deaths without. Synthetic sections for every mode: `tests/sim/bot-missions.ts` (`bot-flight`,
`bot-swan`, `bot-swan-wall`, `bot-up`, `bot-down`, `bot-rides`; run them with the tools'
`--import tests/sim/bot-missions.ts`), tests in `tests/sim/bot-modes.test.ts`.
**Limits:** no shoot-em-up "stay out of the boss's body" logic beyond the threat test; flight
never bails out (also not to save a last cell); the swan never uses HONK or the SWAN DIVE, never
ducks under shots and does not hunt pickups above y 24 differently; vertical climbs need ledges
≤ 44 px apart (on foot) — a gap that needs a ride elsewhere relies on the cable-car goal or the
floor patrol; air-jets, wind gusts and rising water are not modelled (the bot just keeps
climbing); 2-player bots play independently (no PERCH or co-op riding).

## 7. Tools

- `npm run sim -- --mission m0 [--god] [--max-ticks 72000] [--seed 1] [--route lower|upper] [--players 2] [--section b1] [--boss] [--difficulty hard] [--char id] [--weapon id] [--no-bot] [--expect-complete] [--out file.json] [--trace 300] [--quiet] [--import module.ts]` → JSON report on stdout (`--trace` lines show the bot's mode and goal), a summary line on stderr; exit 1 on errors or a failed `--expect-complete`.
- `npm run shot -- --mission m0 [--section a] [--x 1200] [--ticks 60] [--bot] [--every 60 --count 6] [--seed 1] [--god] [--route upper] [--hold right,fire] [--scale 2] [--cols 3] [--out file] [--import module.ts]` → `tmp/shots/*.png`, frames labelled with tick, section, player x, bot mode and goal. `--import` (both tools) loads extra modules first, e.g. the test missions. Both tools also take `--res k` (backbuffer px per logical px), `--gfx pixel|smooth|xbr` and `--art 1|2|4` (the art tier: `--res 8 --art 4` is the 4K look with the 4× UHD art, `--res 4 --art 2` the 2× look, `--art 1` the 1× art; `docs/api/media.md` §8).
- `npm run smoke -- [--port 5180] [--url …] [--query "mission=m0&god=1"] [--out tmp/smoke] [--headed]` → Vite on the port (strict) or `--url`, Chromium 1152×648, Enter ×2, run/shoot/jump/bomb/pause/resume/play with screenshots in `tmp/smoke/`, JSON summary with console errors / warnings and page errors; exit 1 on page errors or when gameplay never starts; the server always stops.

## 8. Arena sandbox (`npm run arena`)

`tools/arena.ts`: see and measure one entity in a real gameplay frame before its mission exists. It
registers an in-memory mission `arena` (only inside the tool process, never in the manifest): one
section `a`, `--width` (2400) × 216, scroll `free`, no timer, empty script, background and terrain
style of m0 section a (`--bg plain`: a sky gradient), a flat floor at **y 170**, player 1 at `--x`
(80; player 2 20 px behind). The start banner is cleared and the start blink is off.

```
npm run arena -- [--spawn "id@x[,y][{k:v}];…"] [--vehicle id[{k:v}]] [--water x0-x1[:depth]] [--gap x:width]
  [--platform x,y,len] [--solid x,y,w,h] [--slope x:len:dy] [--step x:dy] [--width 2400] [--x 80] [--bg m0|plain]
  [--hold right,fire] [--press "30:jump;45:jump,fire;60-90:right"] [--bot] [--players 2] [--god] [--weapon id]
  [--difficulty normal] [--seed 1] [--ticks 60] [--every N --count K] [--scale n] [--cols 3] [--out file.png]
  [--trace id[,id…]] [--trace-every N]          # --help prints all of it with examples
```

| option | what it does |
|---|---|
| `--water x0-x1[:depth]` | `water` hazard from the floor line down; the floor under it drops `depth` px (48 = deep: a player on foot drowns; 16 = wading). The tool draws it (body behind, see-through layer in front) |
| `--gap x:width` | a pit (dark shaft, `pit` hazard 20 px under the rim) |
| `--platform x,y,len` · `--solid x,y,w,h` | one-way platform (top at y) · solid block (top-left; on the floor: y = 170 − h) |
| `--slope x:len:dy` · `--step x:dy` | the floor rises (dy < 0) or falls and stays there. Terrain options repeat and combine; ground features must not overlap |
| `--spawn` | `id@x[,y][{k:v}]`, `;` between specs. x absolute, or `+dx` / `-dx` from player 1's start; y (feet) = the top floor (ground, platform, solid) or water surface under x. Params are JSON-ish: unquoted keys, bare words (numbers, true / false / null, strings), `'single'` or `"double"` quotes, `[lists]`, `{nested}`. Spawned before tick 1 with `world.spawn`: unknown ids become magenta placeholders and a warning |
| `--vehicle id[{k:v}]` | spawned at player 1, who is mounted (`Vehicle.mount`) before tick 1 — also over deep water |
| `--hold` · `--press` | player 1 input (with `--bot` both are ORed with the bot). `--hold` is held all the time (fire taps every 2 ticks); `--press N:btns` is down during tick N only, `N-M:btns` from N to M. Ticks count from 1 |
| `--trace` | one line per tick (or `--trace-every N`) per id, for the first live entity of the id (else a dying one; `none` when absent); `player` = player 1, `p2`: `t=31 swan#2 x=412.00 y=170.00 vx=1.60 vy=0.00 gnd state=driven anim=move:2 hp=1 cells=3` (`gnd` / `air` = on a floor; `state` = the entity's `state` or `mode`; `anim` = sprite name:frame) |
| output | one frame after `--ticks` (60) → `tmp/arena/arena-t<tick>.png` (scale 2); `--every N --count K` → K frames N ticks apart → `tmp/arena/arena-sheet.png` (scale 1). Labels: tick, players `x,y state` (+ vehicle), traced ids `x,y state` |

Stdout: the resolved spawn positions, the trace lines, `N frame(s) → file`, then a JSON summary:
`ticks seed file errors` (with stacks) `warnings missingSfx missingSongs unknownIds alive` (live
entities by id) `player {x y state vehicle weapon lives} kills deaths deathCauses`. Exit code 1 on
errors. Open the PNG with the Read tool.

- **Several agents at once:** give each run its own `--out` (the default file names are shared).
- **Game rules apply:** an enemy that was within its despawn margin (96 px) of the view and then
  moves farther out is removed; the tool prints `removed while alive … (despawned …)`. Spawn inside
  the view (e.g. `+60` … `+280`) or move the player there.
- **`npm run` and braces:** npm hands the arguments to `sh` without quoting `{a,b}`, so the shell
  splits `rifleman@420{patrol:64,gag:false}` into two words. The tool glues a split `--spawn` back
  together; for `--vehicle` (and to be safe) write a space after each comma: `{patrol:64, gag:false}`.
  Values with quotes and lists with `;` are passed through unchanged.

```sh
npm run arena -- --spawn "drummer@+90;oompah-tank@+220{facing:-1}" --god --ticks 90 --out tmp/arena/band.png
npm run arena -- --water 160-1400 --x 240 --vehicle swan --hold right --press "30:jump;45:jump,fire" \
    --trace swan,player --every 15 --count 6 --out tmp/arena/swan.png
npm run arena -- --gap 300:56 --spawn "rifleman@+300{patrol:48, gag:false}" --hold right --press "118:jump" \
    --god --trace player,rifleman --trace-every 10 --ticks 100 --every 20 --count 6 --out tmp/arena/gap.png
```
For tests: `parseArenaArgs`, `parseSpawnList`, `parseParams`, `ArenaTerrain`, `buildArena` and
`runArena(args, { io, save: false })` are exported (`tests/tools/arena.test.ts`).
