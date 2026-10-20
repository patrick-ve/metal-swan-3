# Stag API — the stag party and the beer bike (mission `ams`)

Reference for the **integrator** (and the route builder: the c2 party boat). Spec:
`docs/design/ams-extras.md` §2 (and §1: the gloat). Fairness: GDD §4.11. Numbers are NORMAL.
Tests: `tests/content/stag.test.ts` (partier, cork, enemy bike) and
`tests/content/beer-bike.test.ts` (the rideable bike).

Manifest entries (already in `src/game/content/index.ts`): `stag`, `stag/art`,
`vehicles/beer-bike`, `vehicles/beer-bike/art`. The enemy bike spawns the rideable one by id, so
both gameplay modules must be loaded (they always are: the manifest loads every module).

## 0. Placing things

```ts
import { fromRight, at } from './helpers';
import type { StagBeerBike } from '../../stag';

// A stag party on foot (3 + the groom), walking in from the right, then waiting at 100–160 px.
ctx.enter('stag-partier', 'right', { params: { look: 0 } });
ctx.enter('stag-partier', 'right', { margin: 40, params: { look: 2 } });
ctx.enter('stag-partier', 'right', { margin: 56, params: { groom: true } });
// Standing about (gags, CAUGHT NAPPING): two of them clinking bottles, one taking a selfie.
at(ctx, 'stag-partier', 1980, { gag: 'toast', facing: -1 });
at(ctx, 'stag-partier', 1996, { gag: 'toast', facing: 1 });
at(ctx, 'stag-partier', 2060, { gag: 'selfie' });

// The beer bike: 3 riders, the groom on the front stool, rolling in from the right.
// margin ≥ 60: the bike is 106 px long (half 53), a smaller margin pops half of it into view.
const bike = ctx.enter('stag-beer-bike', 'right', { margin: 64, params: { riders: 3, groom: true }, tag: 'bike' }) as StagBeerBike;
// … or with the ams helper: fromRight(ctx, 'stag-beer-bike', { riders: 4 }, 64);
// A fixed stop distance (px from the nearest player) instead of a random 140–200:
ctx.enter('stag-beer-bike', 'right', { margin: 64, params: { riders: 2, stop: 170, looks: [1, 3] } });

// Everybody off (the FABEL FRIET briefing stop): the riders hop off and walk, the driver runs
// (MIJN FIETS!), the bike rolls to a stop and becomes the rideable beer-bike.
bike.unload();

// A rideable beer bike parked by the script (RIDE? hint, bell gag), facing left:
ctx.spawn('beer-bike', 2600, 'ground', { facing: -1 });
```

- **y is the floor** (the feet / the wheels) for every id.
- **Holds `ctx.waitClear()`**: the partiers (on foot and seated) and the enemy bike (tag `enemy`).
  Once every rider is down the enemy bike removes itself (it becomes the vehicle `beer-bike`,
  not an enemy), so a wave that holds on a bike ends when its riders are gone or the bike is
  wrecked.
- **Despawn**: on-foot partiers like the locals (96 px after they were seen). Seated riders never
  despawn alone; they go with their bike.
- **Tags**: `tag` / `tags` params as for every enemy; seated riders do not inherit the bike's tag
  (the bike holds the wave until its riders are down anyway).

## 1. `stag-partier` (enemy, Creature, soft)

| param | values |
|---|---|
| `groom` | `true`: pink tutu, veil, L-plate; 40 HP, 1,000 points, 3 corks per pop |
| `look` | 0–3 (random by `world.rng`): hair, skin, shorts, cap / sunglasses (the T-shirts match) |
| `gag` | `toast` (clinks with a neighbour), `selfie`, `true` (toast), `false` (alert, walks at once) |
| `facing` | `1` / `-1` / `'right'` / `'left'` (default: towards the nearest player) |
| `enter` / `entry` / `from` | `left` / `right`: walks in from that side (no gag) |
| `hp`, `drop`, `tag(s)` | the Enemy params |

- 20 HP (groom 40), 300 points (groom 1,000). Walks 0.7 px/tick towards the nearest player
  until ≤ 160 px; closer than 48 px he steps back (to 64). Stops at walls and drops.
- **Attack** (only inside the view, with an attack token, player ≤ 230 px and < 40 px of height
  away): TELL 24 ticks (difficulty-scaled, never < 18: he shakes the bottle, foam round the cork,
  `ams/cork-shake`), then one `cork` (`ams/cork-pop`); RECOVER 50, then 60 ± 30 ticks.
- **Cork** (`cork`, an enemy `Projectile`, type `cork`): straight, 2.2 px/tick × the difficulty
  shot speed, flies 25 px above the thrower's feet with a 6 × 4 box: a crouch dodges a standing
  partier's cork, a standing player is hit. 10 damage (kills like every hit). Erased by POOF,
  HONK and the beer bike's FOAM SPRAY (`eraseEnemyShots`). The groom: three corks (vy 0, −0.22,
  −0.44). Spawned alone: `ctx.spawn('cork', x, feetY, { facing: -1, speed, vy })`.
- **Reactions**: SAY CHEESE (`photo`: bottle up), the gloat (§1: the group selfie WITH the spot:
  he turns his back to it, phone up, a small flash every ~50 ticks, one line per hold:
  `FOR THE GROUP CHAT!`), the cower (the T-shirt pulled over the head). Seated riders play the
  stool strips (`sit-gloat`, `sit-cower`) and stay on their stools.
- **Deaths** (bloodless): he sits down hard and the bottle foams over (`die`), seated he tips off
  the stool backwards (`die-stool`); knife, blast, burn and crush strips; the groom's veil flies
  off (`enemy/stag-groom/veil`). Every death strip keeps the costume: the party shirt and its
  print, the groom's tutu, L-plate and tiara (turned with a tumbling or lying body); no veil on
  the head (it flies off as a tumble). A blast singes one shade within each colour's own ramp
  (the shirt stays green, the tutu pink). A driven vehicle that touches him breaks him (½ cell to the
  vehicle, like the locals).

## 2. `stag-beer-bike` (enemy vehicle)

| param | values |
|---|---|
| `riders` | 2–4 (default 3) partiers on the stools |
| `groom` | `true`: the front rider is the groom |
| `looks` | a list of look numbers for the riders, front first |
| `facing`, `enter` / `entry` / `from` | as the partier |
| `stop` | a fixed stop distance in px (default: random 140–200, one value per bike) |
| `hp`, `drop`, `tag(s)` | the Enemy params (`hp` 400; `big`: scaled by difficulty and co-op) |

- A bar counter on four wheels, a striped canopy, a keg on the roof, a sober driver in a red polo.
- Rolls at 0.6 px/tick along its facing; stops `stop` px from the nearest player; rolls on when
  the gap grows by 24 px; a player more than 70 px behind it for 60 ticks makes it turn round.
  It stops at a wall, a step up and a drop of more than 8 px (it never rolls into a canal).
- **Riders** are child `stag-partier` entities (each with the partier's HP and score). They fire
  corks from the stools one at a time (40 ticks between two riders), with attack tokens, range
  260 px.
- **Armour**: the body (the low box under the riders: 96 × 14) pings bullets, lasers and flames;
  explosions, the knife, rams and crushes count. 400 HP → wrecked: +2,000, an `m` explosion,
  keg debris; riders still on board are thrown off (killed, credited to the wrecker); the driver
  runs (`MIJN FIETS!`).
- **The hijack**: every rider down (or `unload()`) → the driver runs, the bike rolls to a stop
  (36 ticks) and is replaced by the rideable `beer-bike` (same x, floor, facing; empty, RIDE?).
  No score for the bike then (the riders were the points).
- Reactions: the bike itself just rolls to a stop (it never turns on the spot); its riders react.
- API: `bike.unload()`, `bike.aboard` (live riders), `bike.riders` (by stool), `bike.mode`
  (`roll` / `stop` / `abandon` / `wrecked`).

## 3. `beer-bike` (the rideable vehicle, `BeerBike`)

- **BIERFIETS** on the HUD; 3 cells, 10 shells; the vehicle rules of GDD §8.1 (mount, eject with
  down + jump, cells: a bullet ½, a blast 1; DANGER at 1, doomed at 0; RIDE?; the empty gag:
  the handlebar bell). Carry-over: put `'beer-bike'` into the next section's `vehicles` list
  (`toCarry()` → `{ id: 'beer-bike', cells, shells }`).
- **Drive**: accel 0.08 to 1.4 px/tick, brake 0.12, faces its direction of travel (up locks the
  facing), a small hop (jump: vy −2.6, about 25 px high), no glide, no squash.
- **Fire: CORK CANNON** (`beer-cork-cannon`): the brass tap on the front, aimed in 22.5° steps (one
  step per 2 ticks): released 0°, up + forward −45°, up −90°. 10 damage, speed 7, cooldown 6,
  unlimited.
- **Bomb: KEG ROLL** (`beer-keg-roll`, entity `beer-keg`): 1 shell (+10 per bomb pickup); the keg
  rolls 2.5 px/tick along the floor, drops down steps, bursts on an enemy, at a wall or after
  120 ticks (150 in r 24, credited to the pilot); in deep water it just splashes.
- **Special (fire + bomb): FOAM SPRAY**: a 64 × 28 px foam cone in front: soft enemies in it are
  knocked back 12 px, enemy shots in it are erased (for 16 ticks); 3 shells, cooldown 240. The
  HUD gem (`specialReady`): cooldown done and shells ≥ 3.
- **Ram (fire + jump)**: the pilot jumps off, the bike rolls on at 3.0 px/tick for ≤ 200 px and
  crashes on the first enemy it touches, a wall, or at the end (400 in r 40, centred 26 px ahead of
  the anchor: on the nose); the bike is lost.
- **Deep water destroys it at once**: driven, the pilot is thrown up (like a pit; he then lands
  or swims by the normal rules); parked, it explodes. Wading water (< 16 px) is fine.
- **2P perch**: the bar counter's top (58 px long, 27 px over the floor) is a one-way platform
  that carries player 2 while the bike drives.

## 4. Where it can go

- **Streets only**: flat or gently sloped floor. The enemy bike needs about 300 px of flat street
  in front of its stop point (it is about 100 px long, 106 px with the canopy overhang, stops 140–200 px from the player and stops at
  drops and walls); the rideable bike rolls up steps of 4 px and hops about 25 px (a hop clears a step of about 20 px).
- **Never in the canal stretches** (`c2`, and no carry-over into a section that starts on water):
  deep water wrecks it. Do not list `'beer-bike'` in `vehicles` of `c2`; in `c` / `c1` only if
  the start is on the street.
- Spec placement (§2.4): `a` after the PLEINTJE: a party on foot (3 + the groom), then the bike
  from the right (the first hijack); at FABEL FRIET `unload()` (the riders get off for the
  briefing) and the bike stays in `a` (the baker: `GEEN BIERFIETSEN!`). `b`: partiers in the gull
  square, one more bike if the pacing allows. `c2`: partiers on the small open party boat (the
  route builder's boat; spawn them with `gag: false` on its deck, y = the deck).

## 5. Art (tier-4 working set)

| prefix (section `art`) | what | 4× MB (deferred strips extra) |
|---|---|---|
| `enemy/stag-` | 5 partier sets (`stag-partier`, `-1` … `-3`, `stag-groom`), the driver (`enemy/stag-beer-bike/…`), flash, veil | 11.9 (+ 7.6) |
| `enemy/cork/` | the cork (4 frames) | < 0.1 |
| `vehicle/beer-bike/` | body (2: whole, damaged), posts, turret (5 steps), wheels, keg, cork, foam, debris, wreck | 1.4 (+ 1.0) |

Deferred (rare: built when drawn): `photo-pose`, `gloat`, `cower`, `die-knife`, `die-blast`,
`die-burn`, `die-crush`, `sit-gloat`, `sit-cower`, the flash, the veil, the bike's wreck, foam
and debris. `gloat`, `cower`, `sit-gloat` and `sit-cower` never join the tier-4 working set
(`ON_DEMAND_4X`); c2 lists `enemy/stag-` and `enemy/cork/` in its `artLate` (the party boat comes
well into the cruise), so section c does not build them ahead. Every id has 1× (PAL) and 2× / 4× (PAL_HD) art from one density-generic drawer
(`stag/kit.art.ts`, `vehicles/beer-bike/art.ts`), with the 1× geometry.

## 6. Sounds (`src/game/content/sfx/ams-stag.ts`, table `AMS_STAG`)

`ams/cork-shake` (the tell, 0.4 s), `ams/cork-pop`, `ams/cork-cannon`, `ams/clink` (the toast),
`ams/foam` (the spray, a bottle foaming over), `ams/keg-roll`, `ams/beer-bell` (the empty gag),
`ams/beer-creak` (the ram). Synth recipes; GDD §15.7 and `docs/api/sfx.md` list them (integrator).
