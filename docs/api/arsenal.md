# Arsenal API — weapons, fx, items, props, creatures (for mission and boss builders)

Content group ARSENAL. Code: `src/game/content/{weapons,fx,items,props,creatures}/` plus the game-layer
files `weapons.ts projectile.ts grenade.ts fx.ts hostage.ts pickup.ts`. Spec: GDD §5–§7, §9.3, §9.5, §15.
Deeper references: weapons and fx helpers → [game.md](game.md) §5–§7; crates, pickups, hostages and drop
values → [items.md](items.md). Every gameplay roll uses `world.rng`; cosmetics use `world.fxRng`.

**Placing things.** In a section script: `ctx.spawn(id, x, y | 'ground', params)`. Unless noted, x is the
centre and y the feet (the floor top under the entity). Every id below is registered at import time by its
category's `index.ts` (manifest entries `weapons`, `fx`, `items`, `props`, `creatures`); sprites come from
the matching `…/art` entry. Ids follow GDD §15 and ARCHITECTURE §7.1.

```ts
ctx.spawn('crate', 620, 'ground', { contains: 'R' });                     // rocket launcher inside
ctx.spawn('hostage', 900, 'ground', { kind: 'tourist', bind: 'sack' });
ctx.spawn('willow-tree', 1940, 'ground', { bridgeY: 170 });               // m1-c bridge
ctx.spawn('kazoo-drone', view.right + 16, 70, { formation: 'v', shooter: 2 });  // a formation of 5
```

---

## 1. Weapons (player) — `content/weapons/`

Weapon ids (`player.giveWeapon(id, ammo?)`, `pickup-weapon { weapon }`, crate letters `M S R F L H T B`):

| id | letter | ammo first / again | dmg | cadence | notes |
|---|---|---|---|---|---|
| `pistol` | — | ∞ | 10 | tap 8 / hold 10 (crouch 6) | 8 px/tick, ≤ 16 on screen; measured 75 dps tapping |
| `machine-gun` | M | 200 / +150 | 10 | every 4 | 4-round burst per tap, ±1.5 px jitter, 22.5° aim sweep per 2 ticks; 150 dps |
| `shotgun` | S | 30 / +10 | 150 per target | 28 | instant cone 72 px long, 16 → 40 px tall, 6 ticks, kick 2 px; ≈ 320 dps point blank |
| `rocket-launcher` | R | 30 / +20 | 30 + 50 r 16 | 20 | 2 → 7 px/tick, steers vertically only ≤ 1 px/tick, max 2; 240 dps |
| `flamethrower` | F | 30 / +15 | 10 per 2 ticks (≤ 12 hits/press) | 24 | 96 px stream, pierces, 128 px floor run when fired down near the floor; ≈ 290 dps |
| `laser` | L | 200 / +150 | 8 per 2 ticks | hold | to first solid or 384 px, pierces, tap = 12-tick pulse (3 ammo); 240 dps |
| `homing` | H | 40 / +20 | 30 + 10 r 8 | 20 | 2 per press (±15°), locks the nearest **in-view** `enemy` within 220 px ahead, 4°/tick, 120 ticks |
| `tuba` | T | 25 / +15 | 60 once per enemy | 30 | ring 12 → 40 px, 2.5 px/tick, 70 ticks, max 3; **erases** `erasable` enemy shots; pushes ≤ 40 HP enemies 8 px |
| `bounce-mine` | B | 30 / +10 | 30 + 40 r 20 | 20 | hops 32 px gaps / 12 px steps; blows on contact, 4th landing or 150 ticks; max 3 |
| `grenade` (bomb) | — | 10 per life (EASY 15), cap 99 | 100 + 100 r 24 | 10 | 2 in the air, 2nd ground contact or 120-tick fuse; infantry within 36 px `panic` |
| `knife` (melee) | — | — | 30 | 20 | box 26 × 28 ahead (crouch 26 × 18); knife kill = 5 × kill score |

Vehicle guns kept from the slice: `vulcan`, `cannon` (the fleet and Swan define their own weapons).

**Damage kinds** that bosses and enemies can read (`Damage.kind`, `damageHas(d, tag)`): bullet (`pistol`,
`machine-gun`; shotgun adds tag `spread`), explosion (`grenade`, `rocket-launcher`, `homing`, `bounce-mine`),
`fire` (flamethrower), `laser`, `knife`, `impact` + tag `sonic` (tuba). `Damage.weapon` = the weapon id.

**What enemy and boss authors must do:**
- Enemy shots are `erasable` by default (`Projectile.spawn({ team: 'enemy' })`): tuba rings, HONK, the respawn
  POOF and boss intermissions remove them. Beams and lane blasts pass `erasable: false`.
- Knifeable slow shots (GDD §6.2: grenades, eggs, records, barrels) need `shootable: true, soft: true, hp, score: 50`.
- Homing and rocket steering pick hurtboxes of entities tagged `enemy` that are inside the view (16 px margin).
- Script shots (rare): `ctx.spawn('rocket' | 'tuba-ring' | …, x, y, { facing, angle, team, owner })`; shot ids
  `bullet-pistol bullet-mg shotgun-blast rocket flame-stream laser-beam homing-missile tuba-ring mine-disc grenade`.
- Sounds: `weapon/<pistol|machine-gun|shotgun|rocket|flame|laser|homing|tuba|bounce-mine>`, `weapon/mine-bounce`,
  `weapon/empty`, `weapon/grenade-throw`, `weapon/grenade-bounce`, `weapon/knife[-umbrella|-needles|-pan|-wrench]`.

## 2. FX — `content/fx/` (script-spawnable effects)

`ctx.spawn('fx-explosion', x, y, { size: 'l', damage: 0 })` etc. Code helpers (`explosion`, `blast`,
`confetti`, `dizzyStars`, `heliumCloud`, `debris` …) are in [game.md](game.md) §5.

| id | params (defaults) |
|---|---|
| `fx-explosion` | `size` s / m / l / xl (m; radius 12 / 24 / 40 / 64), `damage` (0 = harmless), `team` (enemy), `radius`, `debris`, `silent` |
| `fx-explosion-chain` | `count` 5, `interval` 8, `spread` 24, `size` m, `damage`, `team` — wrecks and set pieces |
| `fx-smoke` | `rate` 6, `life` (0 = forever), `dark` true, `spread` 6 — chimneys, burning wrecks |
| `fx-steam` | `rate` 20, `life` 0, `vx` 0, `vy` −0.35 — a steam vent |
| `fx-sparks` `fx-debris` `fx-dust` `fx-splash` `fx-snow-puff` `fx-ice-shatter` | `count` (debris: `kind` dirt / metal / wood / rock / glass / plant / snow / cloth) |
| `fx-poof` · `fx-confetti` · `fx-music-notes` · `fx-tin-feathers` · `fx-stars-dizzy` · `fx-helium-cloud` | — · `count` 16, `power` 2.4 · `count` 3, `spread` 8, `life` 50 · `count` 3, `dirX` · `life` 60 · `life` 120 (cosmetic: only the `helium-tank` gives the status) |

FX entities never touch gameplay unless `damage` > 0. Sprite ids: [game.md](game.md) §5.

## 3. Items and hostages — `content/items/` (full reference: [items.md](items.md))

| id | size | key params | points |
|---|---|---|---|
| `crate` | 24×20, 30 HP | `contains` (letter, weapon id, `bombs`, `repair`, `1up`, food / gem kind, table name, `auto` = table `crate`), `variant` supply / legion, `chute: true` | 100 |
| `pickup-weapon` | 16 medallion | `weapon` (id or letter) | 500 |
| `pickup-bombs` · `pickup-repair` · `pickup-1up` | 16×12 · 14×14 · 14×12 | — | 500 · 1,000 (on foot / full) · 0 (10,000 at 9 lives) |
| `pickup-food` | 12–16 | `kind` bread / cheese / teacake / jelly / birthday-cake | 100 / 300 / 500 / 1,000 / 5,000 |
| `pickup-gem` | 8–14 | `kind` golden-note / gem / medal / golden-record; `float: true` (no gravity, Swan glide trails) | 100 / 1,000 / 2,000 / 10,000 |
| `loot` | — | `contains` / `table` — rolls a drop at spawn (`drop: { id: 'loot', params: { contains: 'officer' } }`) | — |
| `hostage` | 16×26 box | `kind` critic / roadie / tea-lady / tourist / composer / dollop; `bind` chair / cage / sack / float / balloon; `drop` (default `auto` = the kind's table) | +500 on free |

- Placed items never vanish; dropped ones (`dropped: true`, set by `dropItems` / `spawnDrops`) pop at vy −2.0,
  blink in their last 120 ticks and vanish after 720.
- Cage: spawn y = the cage floor **in the air**; `ropeTop` (anchor y) or `rope` (length; 0 = standing cage with a
  lock). Balloon: spawn in the sky; drifts left 0.5 px/tick (m5-a). Float: the hostage stands on a `parade-float`.
- Composer = the hidden 1UP (one per mission). Dollop (m2-a) gives the `sundae-driver` at `shedX` (default 40 px
  behind her); `repair` while the fleet module is not loaded.
- Tourist SAY CHEESE: every non-boss enemy on screen gets `react('photo', 45)`.
- Events for scripts: `hostageFreed`, `hostageRescued`, `hostageGift { hostage, slot, item }`; `isHostage(e, kind)`.
- Mission tally: list the route's hostages in `MissionDef.hostages` (GDD §7.4).

## 4. Props — `content/props/` (category `prop`, two `hazard`; never tagged `enemy`, never hold a wave)

| id | size | params (defaults) | behaviour a level designer must know |
|---|---|---|---|
| `helium-tank` | 20×28, 10 HP | `hp` | 100 pts; shot / knifed / blasted → helium cloud 48×48 for 120 ticks; players **on foot** touching it get `helium-head` (600 ticks). Put it next to secret ledges |
| `statue-head` | 24×24 on a plinth, 50 HP | `hp` | knocked off away from the hit: hops off the plinth (≈ 30 px), rolls 64 px at 1.5 px/tick (≈ 95 px in all), stops at walls; VANDALISM +500; crushes infantry (SET PIECE +200); never hurts players |
| `breakable-wall` | `w` 24 × `h` 48, 200 HP | `solid` (true), `look` brick / door / rock / crystal / panel, `reveal` (spawn specs) | 100 pts; cracks after the first hit; solid until broken. `solid: false` = a secret wall behind the actors (broken: a dark niche). `reveal` items spawn when it breaks |
| `rolling-drum` | 24×24, 40 HP | `dir` / `facing` (toward the nearest player), `speed` 2 | 100 pts; rolls along the floor and down slopes, falls off ledges; **contact kills** a player on foot (a ridden vehicle loses a cell and the drum smashes); smashes on walls. It rolls from where it is placed: spawn it at view right + 16 (GDD); its thump each half turn is the warning |
| `spring-awning` | `w` 48 × 4 | `variant` awning / net, `power` 6 | y = the bounce surface; a landing launches vy −6.0 (≈ 136 px). Over a pit, the `pit` hazard top must be ≥ awning y − 3 (the player dies at `y > hazard.y + 4`) |
| `duck-float` | 32×20 | `drift` 32, `speed` 0.5, `bob` 3, `period` 96, `dir` | y = the water line; one-way platform drifting ± drift, bobbing ± 3 px |
| `lily-pad` | 24×6 | `flower` | static one-way platform; y = its top (water level) |
| `card-table` | 20×12 | — | decor for the infantry `cards` gag; the cards fly when the players at it notice a player |
| `air-jet` | `w` 24 × `h` 96 | `push` 1.5 | y = the pipe (column bottom); airborne players inside rise 1.5 px/tick (standing players are not lifted) |
| `cable-car` | 64×8 floor | `toX`, `toY` (default 96 px up) or `path`, `speed` 0.5, `hold` true | one-way floor; starts when a player stands on it, moves while ridden (`hold`), stays at the end |
| `bellows-platform` | 64×12 | `rise` 24, `period` 120, `phase` | one-way platform rising and falling 24 px every 120 ticks (on `world.tick`) |
| `icicle` | 8×24, **top anchor**, 10 HP | `organ` ('organ' / false), `note`, `reward` true | 50 pts; one note when shot. All icicles of one organ broken **left to right** → 10 `golden-note` + 1 `gem` below them (BRAVO!); other orders give nothing. An icicle that leaves the view unbroken spoils the organ: keep them in view (m3-b2) |
| `willow-tree` | 64×120, trunk 16×44 shootable, 200 HP | `dir` 1, `bridgeY` (y + 2), `length` 160, `hp` | 1,000 pts; SHOOT! hint after 180 ticks in view; falls in 40 ticks (`env/timber`) into a **solid bridge** `length`×12 starting 10 px past the trunk; crushes enemies (SET PIECE +200); players, Swans (ridden or empty), hostages and items under it are pushed to the nearest bridge end, unhurt |
| `avalanche` | 64×216 wall | `speed` 1, `maxSpeed` 3, `holdX` 40, `gap` 104, `stopX` (none), `startX`, `respawn` 160 | m3-a chase. Front += clamp(target − front, speed, maxSpeed), target = min(view left + holdX, rearmost living player − gap). Leading 24 px = `kill` zone (kills through invulnerability, destroys vehicles). Swallows enemies (+200 SET PIECE each). While it chases, respawns land ≥ 160 px right of its front. At `stopX` it stops: shake, flash, kill zone off, a snow mound stays |
| `rising-water` | full width band | `startY` (spawn y), `speed` 0.3, `lag` 48, `cap`, `delay`, `kind` kill / water | m3-b2 meltwater: its top rises at `speed`; never more than `lag` below the view bottom; `cap` keeps it ≥ cap px below the view bottom. `(e as RisingWater).setSpeed(0.15, 48)` for the final fight |

Moving platforms use the engine's `world.moveSolid`: they carry players, vehicles, enemies and items, and push
bodies. Props are on team `enemy` (player shots hit the breakable ones) but tagged `prop`, not `enemy`.
Props send no events: scripts read the state (`tree.state === 'bridge'`, `avalanche.state === 'stopped'`,
`wall.dead`); keep the entity that `ctx.spawn` returns.
Sounds used: `env/timber`, `env/avalanche` (loop), `env/water-splash`, `hit/drum`, `hit/metal`, `hit/shield`,
`explosion/s|m`, `ui/star`. Sprites: `prop/<id>/…`.

## 5. Creatures — `content/creatures/` (category `enemy`, tags `enemy creature`, soft = knifeable, never `legion`)

All creatures follow GDD §4.11: telegraphs ≥ 18 ticks on every difficulty, attack tokens, no attack whose
muzzle or path start is outside the view (8 px margin, checked again at the shot), gags are free time
(double-take 24 + alert 12; CAUGHT NAPPING +100). Every creature takes the tourist's `photo` reaction; only the
`windup-bot` takes `dance` (anthem). Death strips by damage kind: `die`, `die-blast`, `die-burn`, `die-crush`.
Common params: `facing`, `enter` / `entry` (walk / fly in alerted), `gag` (true / false), `hp`, `drop`, `tag`.

| id | size · HP · pts | contact kills | attacks (T = telegraph, A = attack, R = recover) | placement notes |
|---|---|---|---|---|
| `bullfrog` | 28×20 · 40 · 400 | no (pushes 1.5 px/tick) | hops toward a player every 60 ticks (48 × 40 px arc). Croak: T 40 → a ground ring 2 px/tick for 120 px, 10 px tall (jump it) → R 40. Tongue (≤ 40 px): T 20 → 40 px in 8 ticks → R 12 | lily pads, walkway edges; `entry` hop (out of the reeds) / top / left / right. Never hops onto water or over a pit. Death leaves a harmless froglet |
| `windup-bot` | 16×18 · 20 · 100 | only when exploding (`fly`: always) | marches 0.8 px/tick in step, walks off ledges, turns at walls. Self-destruct (≤ 24 px): T 30 → blast r 16 (30 dmg; no points) | one spawn = one bot: place lines of 3–6, ~20 px apart. `variant` walk / ski (1.6 px/tick, 0.8 uphill) / fly (1.5 px/tick straight, no self-destruct). STRIKE! +1,000 for 6 crushed by one vehicle run |
| `rattler` | 48×16 (coiled 28×24) · 60 · 600 | while lunging | hidden in sand; wakes at 96 px or when hit. Lunge: T 45 → 72 px in 12 ticks (stops at walls / ledges) → R 50 → burrows 60 | the hidden mound is low: hard to hit with the pistol on purpose |
| `echo-bat` | 20×14 · 10 · 200 | yes (not while asleep) | wakes at 96 px / a shot or blast nearby; sine flight 1.5 px/tick (amp 24) to a hover 56 px beside and above. Dive every 120: T 20 → 3 px/tick at the player's position (≤ 160 px) → climbs back 36 | spawn y = just under the ceiling / platform it hangs from; no ceiling = it sleeps hovering. `enter` fly / swarm / left / right / top = awake |
| `ram-goat` | 36×32 · 80 · 800 | while charging or leaping | Charge (player ahead ≤ 300 px, within 40 px of its height): T 40 → 3 px/tick along the ledge, jumps gaps ≤ 32 px; a wall stuns it 60 ticks (×2 damage) → R 40. Leap-down: T 30 (a shadow on the lower ledge) → leaps (≤ 112 px sideways, 24–160 px down) | never trots off a ledge; steps over 10 px bumps. A charge ends 24 px outside the view. Mittens says `NICE STITCHING.` at the first goat |
| `usher-bot` | 24×36 · 60 · 700 | no | patrols 0.5 px/tick (`patrol` 80 px each side; 0 = guard) with a 96 px, 30° cone (8° down; needs line of sight). Shush: T 30 (SHHH!, crimson beam) → 3 ticket darts ±8° at 2.5 px/tick, 10 dmg → R 60 | gags `ticket` / `polish` switch the beam off. A hit from behind turns it round. Death prints `ADMIT NONE` (readable in both facings) |
| `kazoo-drone` | 16×12 · 10 (20 while a player flies a `trumpeter`) · 100 | yes | **one spawn = a formation of 5** (`count`). `formation` v (16 back, ±12 per rank, 1.5 px/tick) / sine (20 px apart, ±24·sin(t/30)) / loop (128 px in, radius 64, leaves) / dive (row 28 px under the view top, 48 px apart, hover 60, then each T 20 → 2.5 px/tick at the player, 24 ticks apart). `shooter` true / n: T 20 → one note bullet 1.5 px/tick, then every 150 ticks | spawn = the leader's start; the formation flies toward the view centre unless `facing` / `enter`. Loop: spawn y ≥ view top + 136. FULL SET +1,000 only when players kill all 5 (none escaped). Prefer `shooter: 2` — `true` arms all 5 |

Enemy shots made here: `croak-ring` (bullfrog; `sonic` tag), `ticket-dart` (usher), `note-bullet` (kazoo) — all
`erasable`, none knifeable. Sounds: `creature/croak-build`, `creature/croak`, `creature/windup`,
`creature/rattle`, `creature/bat-screech`, `creature/goat`, `creature/shush`, `creature/kazoo` (one loop per
formation, stopped when the last drone goes). Sprites `creature/<id>/<anim>` (+ `photo-pose`, `gag-<name>`,
the usher's `die-left`).

## 6. Known limits

- A `kazoo-drone` leader killed on its very first tick never spawns its wingmen (no FULL SET possible; harmless).
- `kazoo-drone` death strips stand on the floor: a mid-air blast or burn death draws ~6 px high until it lands.
- `willow-tree`: the last fall frame (~100 px long) jumps to the 160 px bridge in one tick; the whole tree
  flashes white on each hit (heavy with the machine gun).
- `rolling-drum` has no separate 18-tick wind-up (the GDD enters it from view right + 16; its thump telegraphs).
- `icicle` organ: an icicle that despawns unbroken means the organ never pays.
- Hostage `float` was tested on flat ground only (the m4 parade float is built by machines-transport).
- The knife hits enemy shots only when they are `shootable` + `soft`.
