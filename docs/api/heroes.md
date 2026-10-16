# Heroes API — characters, the SWAN-3 and the fleet (for mission and boss authors)

Owner: heroes group (characters, swan-logic, swan-art, fleet). Source:
`src/game/content/characters/**`, `src/game/content/vehicles/{swan,fleet}/**`, `src/game/vehicle.ts`,
`src/game/player/**`, `src/game/water.ts`. Tests: `tests/content/{characters,swan,swan-art,fleet}.test.ts`,
`tests/game/{vehicle,player}.test.ts`. Deeper references: `docs/api/characters.md` (rig, strips,
Helium Head), `docs/api/game.md` §8 (Player) and §9 (Vehicle, Swan, Water), `docs/design/swan-mount/`
(feel.md, look.md, levels.md). GDD §3, §4.13, §8.

Units: px, ticks (60 per second), px/tick. Coordinates: an entity's anchor is its **feet centre**;
x forward when facing right; y down. The floor line in the examples is `G`.

## 1. Quick table

| id | what | size (w×h) | cells | where (GDD) | spawn params (default) |
|---|---|---|---|---|---|
| `vincent` `thom` `dirk` `bob` `patrick` | playable heroes: the squad of friends (docs/design/squad.md §1) | body 14×30 (crouch 16×20) | — | select screen | — (session `characters`) |
| `grace` `mittens` `pip` `gramps` | retired GDD heroes: registered, not playable (m1–m5, Gramps' radio role in ams) | same | — | not on select | — |
| `recruit` | test hero (m0, `?char=recruit`) | same | — | not on select | — |
| `swan` | SWAN-3, ridden robot swan | body 28×48 (crouched / parked 28×20); 77 px beak to tail | 3 | m1-c, m3-a, m3-c | `variant` ('ivory' \| 'mute'; first rider picks, P2 = mute), `socks` (false), `cells` (3), `shells` (10), `facing` (1 \| −1) |
| `sundae-driver` | armed ice-cream van | 80×44 body, 80×68 with cone; hurtbox 76×36 | 3 | m2-a end → m2-d | `facing` (1; −1 or 'left'), `cells` (3), `shells` (10) |
| `bandwagon` | captured parade truck | 96×56; hurtbox cab 32×36 + bed 64×24 | 4 | m4-b | `facing`, `cells` (4), `shells` (10) |
| `trumpeter` | SWAN-3 flight mode (shoot-em-up ship) | sprite ≈ 90×80 with rider; hurtbox 28×14 (hull) | 3 | m5-a, final stage 1 | `variant` ('ivory' \| 'mute'), `backup` (false; internal), `cells` (3), `shells` (20) |

Weapons (registered, used by the vehicles; never give them to a player on foot): `swan-beak-gun`,
`swan-beak-shell`, `swan-honk`; `sundae-sprinkle-gun`, `sundae-mortar`, `sundae-jingle`;
`bandwagon-brass-cannon`, `bandwagon-drum-boom`, `bandwagon-cymbal-wall`; `trumpeter-twin-gun`,
`trumpeter-dive-bomb`, `trumpeter-honk`. Projectiles: `beak-bullet`, `beak-shell`, `honk-ring`,
`sprinkle`, `sundae-shell`, `brass-ring`, `drum-wave`, `twin-bullet`, `dive-bomb`. Statuses:
`helium-head`, `helium-deflate`, `squeaky-boot`, `swan-parachute`.

## 2. Characters

- The session picks them: `new GameSession({ characters: ['vincent', 'thom'] })`; URL `?char=<id>`.
  Two players may not pick the same hero. Every hero has **identical stats** (GDD §3): pistol,
  10 grenades (EASY 15), knife; only looks, idle fidget, knife look and sound, death flourish,
  victory pose and texts differ. `PLAYABLE` (`characters/index.ts`) = select order =
  `vincent, thom, dirk, bob, patrick`; the GDD heroes are in `RETIRED` (still usable by id).
- Texts for scenes and scripts: `getCharacter(id)` → `name`, `fullName`, `title`, `callsign`,
  `quote`, `quoteSub` (Mittens), `endingLine`, `voice`, `color`. Use the callsign in radio bubbles
  (`GRAMPS: …`).
- Sprites `char/<id>/…` (ARCHITECTURE §6.1 + `bored`, `salute` 2 f, `portrait` 32×32, `helium-*`,
  nine `ride-*` strips). A scene that shows a hero still frame: `char/<id>/portrait` (top-left
  anchor) or `char/<id>/victory`.
- **Aim on foot** (GDD §4.3, `player.ts` `updateAim`): up alone → `elev` −π/2 (straight up);
  up + left/right → −π/4 (45° up toward the pressed side; the player keeps walking; also in the
  air); down in the air → +π/2. Crouched, up stands the player up first. Sweep weapons turn
  22.5° per 2 ticks toward the new aim. The torso shows `torso-<w>-diag-up` / `shoot-diag-up`
  (pistol and heavy, plain and the helium variants: 22 torso strips per set) and shots leave
  from that frame's `muzzle`. Bombs keep the up lob whenever up is held. Vehicles keep their own
  aiming (the Swan's neck, 8.2).
- **Idle fidget** (`bored`): plays after 300 ticks without input (`TUNING.player.boredTicks`).
  Gramps' boot then squeaks for 120 ticks when he walks again (status `squeaky-boot`, applied by
  the player). Pure cosmetics; no rule changes.
- **Helium Head** (GDD §4.13, status `helium-head`, 600 ticks): the `helium-tank` cloud applies it;
  a script can too: `const st = getStatus('helium-head'); if (st) player.status.add(st);`. While
  it lasts: jump −4.5 (apex ≈ 78), slow fall with jump held (0.05 / max 1.0), speed × 0.9, **no
  crouch, no vehicle mount**, voice pitch 1.6, the first hit only pops the head. Do not require a
  mount or a crouch inside a helium area.
- Rider heights (head top above the hip, `ride-sit`): 20–24 px for every hero (Bob's quiff 24,
  as Mittens' bobble). The title and swan rider default is `vincent`.
- Mounted heroes: `player.state === 'mounted'`, `player.vehicle`; the rider is drawn by the
  vehicle (`Player.drawRide`). `player.victory()` while mounted keeps him seated and raises
  `cheering` (`ride-cheer` on the Swan and Trumpeter).

## 3. Shared vehicle rules (all four; GDD §8.1)

```ts
// In a section script (SectionContext). Anchor = the ground under the vehicle's middle (her feet).
ctx.spawn('swan', 160, 'ground');
if (ctx.playerCount === 2) ctx.spawn('swan', 112, 'ground', { variant: 'mute' });   // [2P]
ctx.spawn('bandwagon', 120, 'ground', { facing: -1 });
```
- Carry-over: a player who leaves a section riding a vehicle keeps it (cells and shells) only
  when the next section lists it in `SectionDef.vehicles: ['swan']`.
- **Mount:** fall onto the seat / hatch (the top 16 px; the parked Swan's seat is only 32 px up).
  16 ticks mount anim + 20 invulnerable ticks. `RIDE?` bubble while a player on foot is within
  96 px. Helium Head cannot mount.
- **Pilot is never hit;** the vehicle takes the damage: small hit ½ cell, big hit 1 cell
  (explosions, shells, beams, boss attacks, charging contact), `crush` / `pit` / `kill` / `lava` =
  destroyed at once. 60 invulnerable ticks after a hit. ≤ 1 cell: red blinking cells, smoke,
  `vehicle/warning` every 60 ticks.
- **0 cells:** it stops, flashes 60 ticks (`vehicle/alarm`); the pilot must jump out (EASY: thrown
  out) or dies; then it explodes (r 40, 200 to enemies).
- **Eject** = down + jump. **Ram** = fire + jump (same tick or 1 apart): the pilot pops up (vy −4,
  60 invulnerable), the vehicle charges and explodes (400 in r 40; the Bandwagon 500 in r 48) —
  lost, except the Swan's SWAN DIVE (§4). **Special** = fire + bomb.
- Empty vehicles are invulnerable and ignored by enemies. A driven ground vehicle stays inside the
  view (`keepInView`), never despawns, never drops through one-way platforms.
- Panic: Legion infantry within 64 px of a moving player vehicle panic (30 %, once per 60 ticks).
- Pickups while riding: `pickup-bombs` +10 shells, `pickup-repair` +1 cell; weapon pickups go to
  the pilot (the Trumpeter turns them into +10 dive bombs).
- Events (`world.events`): `vehicleMounted {vehicle, player, slot}`, `vehicleEjected {…, mode:
  'exit' | 'ram' | 'destroyed' | 'forced'}`, `vehicleDestroyed {vehicle}`; ram / bash blasts emit
  `explosion`. NO SCRATCHES: full cells at a vehicle section's end (the mission runner).
- Script API on any vehicle (`Vehicle`): `state` ('idle' | 'driven' | 'doomed' | 'ram' | 'wreck'),
  `driver`, `cells`, `maxCells`, `shells`, `eject(mode)`, `destroy()`, `repair(n)`, `addShells(n)`,
  `canMount(p)`, `mount(p)`.

## 4. `swan` — SWAN-3 "Metal Swan" (GDD §8.2)

**Placement.** Spawn her parked with her feet on the ground (`y: G`), or over water on the
surface (she floats with her feet on the float line 16 px under it). Spawned in the air she falls
(gravity 0.18, max 5.0) and sits down on landing: an m3-a "cargo drop" needs only a parachute prop
from the mission (there is no parachute art on her). m3 uses `socks: true`. P2 gets the Mute
automatically; force it with `variant: 'mute'`.

**Movement numbers (measured in the arena, GDD values):**

| what | value |
|---|---|
| run | 2.6 px/tick (trot 1.5 after 6 ticks, full after 25 ticks / 45 px); brake 13 ticks; skid on reverse ≥ 1.6 |
| crouch | 20 px tall, waddle 0.8; chest-high shots pass over |
| jump | 4-tick squat, **fixed apex 94 px**, 65 ticks in the air, 169 px at a sprint; reach: ledge 48 up at 143 ahead, 80 up at 117 ahead (≈ 90 px max) |
| glide | hold jump while falling: fall ≤ 1.0, speed ≤ 2.2, 60 ticks, once per airtime; sprint jump + full glide = **268 px in 112 ticks** |
| stomp | falling ≥ 1.5 onto a soft enemy's top: 100 `crush`, bounce 30 px |
| water | swim 2.0, duck (down) 8 px lower, jump out after an 8-tick paddle-up (feet peak ≈ 78 px above the surface) |
| ice (`iceRanges`) | brake 0.05: slides 68 px from a sprint |

**Weapons.** BEAK GUN (fire): 10 dmg, 1 round / 4 ticks, speed 8, 5-round burst on a tap; the neck
aims in 9 steps from +45° (down-forward, air only) to −135° (up-back) at 22.5° per 2 ticks. The
0° beak tip is at (44, −24) from her feet (GDD says 40; the art wins): **on land it hits standing
infantry**. BEAK SHELL (bomb): 10 shells, a 0° shell lands 113 px ahead at any speed; 200 direct,
100 in r 24. **HONK** (fire + bomb): 10-tick wind-up (in the air she hangs still), then a ring 0 →
128 px in 16 ticks: 80 to every enemy part once, erases enemy shots inside it, Legion infantry get
reaction `ears` (60 ticks); costs 3 shells, cooldown 240.

**SWAN DIVE** (fire + jump on ground or a platform; refused in water or the air): the pilot pops
up; she hisses 6 ticks, charges at 3.4 px/tick up to 192 px, tramples soft enemies (100 `crush`),
BEAK-BASHES the first hard enemy, a wall, water or the view edge ahead: 400 in r 40. It costs
**1 cell**: with ≥ 2 cells she lies dazed 180 ticks (invulnerable, ignored), then can be ridden
again; with 1 cell she migrates (flies off, lost; radio `GRAMPS: SHE'LL BE BACK IN SPRING.`).
Body walls (boss hulls) count as walls. Boss authors: a dive reaches 192 + 40 px; give the boss a
hard part or a wall in that reach.

**Rules a level designer must respect** (`docs/design/swan-mount/levels.md`):
- Keep targets and pickups she must reach **below y 24** (the rider's head peaks at y 10–14).
- Gaps on her route ≤ 169 px for a plain sprint jump, ≤ 268 px with a full glide; ledges ≤ 90 px up.
- Eject = jump within 4 ticks after down, only on ground or in water. **In water she catches her
  own pilot** (30–90 ticks after the eject) unless she has 0 cells: put a pad / jetty within
  ~96 px where the pilot must be able to leave her.
- At 0 cells her wings fold and a jump press ejects anywhere (also in the air).
- **Co-op PERCH:** a 14×4 one-way deck on her tail; a partner stands on it as tail gunner. Over
  land it switches off during her jumps (the partner drops ≤ 48 px); jumps that start over water
  carry him.
- Camera: while anyone rides a Swan, the camera lead is 64 and max speed 4 (restored after).
- Empty gags (free time, no gameplay): she sits, her eye follows the nearest player within 96 px;
  left empty 600 ticks she lays one egg (→ `pickup-bombs`, once per section) with a Gramps bubble.

Sounds (GDD §15.7): `swan/step paddle fire honk squeak jump land skid flap fold glide tired stomp
splash hiss dazed migrate`, `vehicle/warning`, `explosion/l`. Fields a script may read: `medium`
('ground' | 'air' | 'water'), `swimming`, `phase`, `migrating`, `mute`, `perch`; `isSwan(e)`.

## 5. `sundae-driver` — the SUNDAE DRIVER (GDD §8.3)

- Drive: accel 0.08 to 2.4 px/tick, brake 0.15, hop vy −3.0 (apex ≈ 35). Faces its direction of
  travel; up locks the facing (so up + back aims the cone backwards). It cannot swim: deep water
  (wheels 16 px under) sinks it. Squashes infantry at > 1.6 px/tick (100 `crush`, no damage to it).
- Cone turret: 15° per 2 ticks toward forward / forward-up / up / back-up / back; keeps its angle.
  **Down dips it to +15°** (the roof muzzle is 45 px up; the dipped stream hits a soldier 50–180
  px ahead).
- SPRINKLE GUN: 10 dmg, 1 / 4 ticks, speed 8. SUNDAE MORTAR (bomb, 10): an arcing scoop, 150 in
  r 24, **freezes infantry 90 ticks** (reaction `freeze`; a hit shatters them).
- **JINGLE** (fire + bomb; cooldown 900, free): every Legion infantryman within 200 px gets
  reaction `queue` for 120 ticks — he walks to the van and lines up with a coin, no attacks, can be
  shot. Machines and creatures ignore it. Use it as a crowd-control set piece in m2.
- Ram: rolls 2.8 px/tick for up to 200 px with the slowed jingle, explodes (400 in r 40).
- Left empty: a parked gag after 300 ticks, every 420 (cosmetic).
- Sounds: `vehicle/jingle`, `sundae/mortar`, plus the shared vehicle sounds.

## 6. `bandwagon` — THE BANDWAGON (GDD §8.4)

- Drive: accel 0.06 to 1.8 px/tick, hydraulic bounce vy −2.4 (apex ≈ 22). Squashes infantry at
  ≥ 1.0 px/tick. Up locks the facing.
- Bell: 0°, −30°, −60°, −90° (hold up: one step per 6 ticks), −120° with up + back; back to 0°
  when nothing is held. BRASS CANNON: a ring every 12 ticks, 10 → 24 px, speed 4, 30 dmg,
  **pierces and erases enemy bullets**. DRUM BOOM (bomb, 10): a ground wave, 100 dmg, reach 96.
- **CYMBAL WALL** (fire + bomb, cooldown 300): 60 ticks of two cymbals in front of the cab; they
  block every projectile from the front and deal 100 to anything the truck touches (once each).
- Co-op: `bandwagon.stage` is a moving one-way platform the partner can stand on.
- Ram: careens 2.4 px/tick for up to 240 px, explodes into instruments (500 in r 48).
- Sounds: `bandwagon/brass`, `bandwagon/drum`, `bandwagon/cymbals`.

## 7. `trumpeter` — SWAN-3 flight mode (GDD §8.5; m5-a)

```ts
// SectionDef
{ id: 'a', startVehicle: 'trumpeter', /* camera locked, lock window moved by the script */ }
// Script
const t = trumpeterOf(player);              // Trumpeter | null
t?.flyTo(x, y, 2); if (t?.arrived) t.releaseAutopilot();   // e.g. into the landing hatch
t?.cheer(300);                              // ride-cheer when the boss dies
```
- Players start mounted (view y 80 / 130) and on every respawn get a new ship flying in from the
  left edge (3 cells, 20 bombs, 120 invulnerable). **Losing the last cell costs a life**.
- Free 8-way flight at 2.0 px/tick (1.4 per axis diagonally), no gravity, always faces right,
  kept 4 px inside the view. Auto-scroll: **lock the camera and move the lock window**; the ship
  adds the view's movement to its own, so a released stick keeps its place on screen.
- Hurtbox: the hull only, 28×14 (shoot-em-up fairness). Touching a small enemy destroys it (≤ 40
  HP) and costs ½ cell.
- TWIN BEAK GUN: 2 bullets 4 px apart every 6 ticks, 10 dmg each, speed 9. DIVE BOMB (bomb, 20):
  drops with the ship's speed, gravity 0.2, 150 in r 20, cooldown 20. HONK (fire + bomb): as the
  Swan's, costs 3 bombs, cooldown 240.
- **BAIL OUT** (down + jump or fire + jump): the pilot drops under a swan parachute (status
  `swan-parachute`: 0.5 px/tick, invulnerable, pistol forward); the empty ship flies on as a
  missile (4 px/tick, 400 in r 40). 60 ticks later a backup ship picks him up with 1 cell and 5
  bombs; the next bail-out waits 900 ticks.
- Boss authors: its drawn box is x −41…49, y −42…13 around the anchor; only the 28×14 hull is hit.
- Sounds: `trumpeter/flap`, `trumpeter/bail`, `swan/honk`, `swan/squeak`.

## 8. Known limits

- The Swan's 0° beak tip is (44, −24), 4 px ahead of the GDD's (40, −24); levels lose nothing.
- The Swan's optional "looks back at the rider after 120 idle ticks" gag is not built.
- The Trumpeter's UP wing pose reaches 58 px above the hull, so the sprite is ≈ 90×80, not 76×64.
- Bandwagon co-op on the stage is tested in code only, not with two players in the arena.
- Pip's helmet does not slip over his eyes on `legs-land` (the head is in the torso strip).
- Building every Swan colour variant adds ≈ 470 ms to the boot preload.
