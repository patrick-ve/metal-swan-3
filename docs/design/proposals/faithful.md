# METAL SWAN 3 — Design Proposal "Arcade-Faithful"

> **Angle:** make the moment-to-moment feel, pacing and difficulty curve match a late-1990s arcade
> run-and-gun as closely as possible: dense waves, a small surprise every few seconds, generous
> weapon drops, punchy bosses with clear tells, and a 1-credit clear of about 30 minutes.
> Everything named here is original (checked against `docs/ORIGINALITY.md`).
>
> **Conventions in this document**
> - Units: pixels (px), ticks (60 per second), px/tick for speeds. Damage is in "hit points" (HP).
> - Coordinates: section space, origin top-left, y grows downward. The usual ground line is
>   **y = 184** (the HUD needs the top 32 px; 32 px of ground stay visible under the feet).
> - `cam≥X` means "when the camera's left edge reaches world x = X". Spawn side `R` / `L` = the
>   entity enters from 16 px outside the right / left edge of the view; `top` = from above the view
>   (full notation in section 11.0).
> - Telegraph → attack → recovery timings are written `T 24 → A … → R 60` (ticks).
> - All numbers are for **REGULAR** difficulty and **1 player** unless a line says otherwise.

---

## 1. Overview

**Pitch.** Archduke Ignatius Fanfaron wants his face burned onto the Moon so the whole world must
look at him every night. His glittering private army, the **Plume Legion**, has seized the coast,
the jungle, the mountains and the gold fields to pay for it. Four misfits of **Cygnet Squad** and
their wobbly walker tank, the **SW-4N "Swan" Mk.3**, must blast through five missions, rescue the
"captive audience" the Legion kidnapped to clap at its parades, and pop the Archduke's sky palace
before moonrise.

**Tone.** Saturday-morning war comedy. Enemies are vain, ceremonial and easily startled: they
polish medals, rehearse salutes, fall over their own flags, and flee when their leader's statue
cracks. Deaths are bloodless and cartoony: soot faces, spinning shakos, stars, feathers, poses.
The heroes are competent but chaotic. Nothing is grim; everything explodes.

**Title-screen tagline:** `FLY LOW. SHOOT FIRST. HONK LATER.`

**Why "3"?** In the fiction the squad's walker is the third prototype. The Mk.1 tipped over at
its own unveiling and the Mk.2 was "requisitioned" by geese. The Mk.3 is held together by hope.

**Target runtime (1-credit clear, REGULAR, a good player):**

| Mission | Sections played | On foot / vehicle | Boss | Total |
|---|---|---|---|---|
| m1 Haverwick Harbour | 3 | 3:20 | 1:10 | 4:30 |
| m2 The Snapwater Delta | 4 | 4:20 | 1:10 | 5:30 |
| m3 Mount Grumbelhorn | 4 | 4:40 | 1:20 | 6:00 |
| m4 The Gilded Wastes | 3 | 4:40 | 1:20 | 6:00 |
| m5 The Palace Above the Clouds | 4 | 4:30 | 3:00 (3 stages) | 7:30 |
| Intro cards, tallies, ending | | | | 2:00 |
| **Game** | | | | **≈ 31:30** |

A first-time player who continues freely needs about 40–45 minutes.

**Arcade-faithful pacing rules (apply to every section):**
1. **The 4-second rule.** The player is never more than ~240 ticks without a new threat, a pickup,
   a hostage, a breakable object or a gag on screen.
2. **Breather cadence.** Every 3–4 dense waves are followed by 1 short breather (a hostage, a
   crate, a comedic idle group that can be shot before it notices you).
3. **Weapon generosity.** At least one weapon pickup every ~45 s of play. Each mission's first
   weapon appears in its first 20 s. Bosses always have one weapon crate in or just before the arena.
4. **Escalation inside a mission:** foot soldiers → mixed squads → first machine → set piece →
   mini-arena (camera lock) → vehicle or route choice → boss.
5. **Escalation across missions:** m1 teaches; m2 adds creatures and water; m3 adds vertical and
   slope play; m4 adds the GILDED status and heavy machine combos; m5 remixes everything and adds
   the flying section.
6. **Readable danger.** Every enemy attack has a visible and audible telegraph of at least 14 ticks
   (bullets ≥ 1.6 px/tick at REGULAR). Deaths should feel fair and fast to recover from.

---

## 2. Story

### 2.1 Premise
The free coastal city of **Haverwick** wakes up to a brass band. Overnight the **Plume Legion**,
private army of **Archduke Ignatius Fanfaron**, sovereign of the tiny mountain duchy of
**Gildenstein**, has taken the harbour, the river delta, Mount Grumbelhorn and the Gilded Wastes.
The Archduke's plan, **Project MOONFACE**, is simple and stupid: a flying palace, the
**Fanfaronne**, carries a giant lens that will burn his portrait onto the Moon.

The Free Coast Alliance cannot spare an army. It sends **Cygnet Squad**: a mechanic, a gentle
giant, a stunt pilot and a rookie radio operator, plus their walker tank, the Swan Mk.3.

### 2.2 The enemy: the Plume Legion
- **Look:** crimson tunics with white cross-belts, sky-blue trousers, black boots, tall black
  shakos with red feather plumes and gold chin straps. Officers wear white shakos with enormous
  plumes. Machines are purple, gold and covered in bunting, crests and loudspeaker horns.
- **Personality:** vain, ceremonial, easily distracted. They salute portraits, practise parade
  steps, pose for the court painter and panic when anything shiny breaks. They are brave in groups
  and hopeless alone. Legion soldiers shout short original barks (text bubbles, no voice):
  `HALT!` `FOR THE ARCHDUKE!` `NOT THE PLUME!` `MEDIC! ...AND A MIRROR!` `RETREAT IN STYLE!`
- **Statues:** every outpost has a gold-painted statue of the Archduke (`fanfaron-statue`).
  Breaking one makes every Legion soldier within 160 px gasp and panic for 60 ticks.
- **The leader:** **Archduke Ignatius Fanfaron** — tall, thin, clean-shaven, enormous chin, a
  towering silver pompadour with a tiny crown balanced on top, a monocle, an ermine-trimmed purple
  cape and a ruffled collar. He speaks only in proclamations: `BEHOLD ME!` He is a coward who
  always has an escape parasol.
- **His court (boss pilots):** Admiral **Barnabas Spool** (m1 showboat), Ringmaster **Hettie
  Krank** (m2 riverhorse), court composer Maestro **Ottokar Brumm** (m3 war organ), master
  sculptor **Lady Philippa Chisel** (m4 colossus).

### 2.3 Mission briefings (shown on the mission intro card)
| Mission | Codename | Briefing (on the card) |
|---|---|---|
| m1 | OPERATION WAKE-UP CALL | `The Legion took Haverwick harbour during breakfast. Take it back before lunch.` |
| m2 | OPERATION MUDDY BOOTS | `Their gold barges run through the Snapwater Delta. Sink the supply line - mind the frogs.` |
| m3 | OPERATION COLD SHOULDER | `The Archduke's composer is hiding on Mount Grumbelhorn. Stop the music.` |
| m4 | OPERATION FOOL'S GOLD | `Gold mines, a foundry and a statue the size of a hill. Bring a chisel.` |
| m5 | OPERATION MOONRISE | `The Fanfaronne lifts off at moonrise. Get aboard. Pop the palace. Save the Moon.` |

### 2.4 Ending
The final shot of the Moonface Lens misfires. Its beam bounces off a cracked mirror panel and
carves a giant **swan** onto the Moon instead of the Archduke's face. The sky palace sinks
slowly into the sea with a long, sad organ note. The Archduke drifts away under his escape
parasol and lands in a lake full of very angry geese. Cygnet Squad stands on the beach and
salutes the Moon. Final caption: `THE MOON NEVER LOOKED SO GOOD.`

---

## 3. Playable characters

All four use the shared humanoid rig. **Stats are identical** (same hitbox, speed, jump, weapon
handling). They differ only in look, voice text, victory pose and the cosmetic shape of the knife
swing (damage and range are identical). Colour words refer to palette ramps (`skinA` light,
`skinB` medium, `skinC` deep; other words name ramps such as `orange`, `navy`, `khaki`).

### 3.1 `rivet` — Sgt. Nadia "Rivet" Okafor (mechanic)
- **Personality:** loud, practical, fixes things by hitting them. Loves the Swan like a pet.
- **Rig:** skin `skinC`; hair: two large round puffs on top (dark brown), held by a red headband;
  headgear: welding goggles with amber lenses pushed up on the forehead; top: burnt-orange coverall
  with the upper half tied around the waist over a white tank top; pants: orange coverall legs;
  boots: heavy black work boots; gloves: thick yellow work gloves; build: athletic, medium-tall;
  accessories: big wrench strapped diagonally across the back (strong silhouette), tool belt.
- **Knife swing:** wrench bonk (sparks).
- **Victory pose:** spins the wrench, catches it, thumbs-up.
- **Select quote:** `"If it rattles, I fix it. If it honks, I ride it."`

### 3.2 `moose` — Cpl. Bram "Moose" Hollander (heavy weapons, birdwatcher)
- **Personality:** huge, calm, kind; names every bird he sees, including enemy aircraft.
- **Rig:** skin `skinA` (ruddy); hair: shaggy ginger + big full ginger beard; headgear: round
  steel pot helmet (grey) with a small white swan decal; top: navy sleeveless vest; pants: khaki
  cargo pants; boots: brown; gloves: black fingerless; build: heavy (widest torso preset);
  accessories: binoculars on a neck strap, ammo bandolier.
- **Knife swing:** folding-shovel swat (dust puff).
- **Victory pose:** lifts the binoculars, spots something, waves happily.
- **Select quote:** `"Spotted: one Archduke. Common. Very loud."`

### 3.3 `yoyo` — Spc. Yolanda "Yo-Yo" Reyes (stunt pilot)
- **Personality:** fast-talking, fearless, bored on the ground. Flies the Honker in m5.
- **Rig:** skin `skinB`; hair: short black bob with a long fringe; headgear: brown leather
  aviator cap with ear flaps and round flight goggles on the cap; top: brown bomber jacket with a
  cream sheepskin collar; pants: navy flight trousers; boots: tall brown boots; gloves: brown
  leather; build: small/light (shortest preset, still ≥ 34 px tall); accessories: long white scarf
  that trails behind (2-frame flutter, strong silhouette), small wing pin.
- **Knife swing:** quick knife flick (silver arc).
- **Victory pose:** draws a loop-the-loop in the air with one hand, cheeky salute, scarf flutters.
- **Select quote:** `"Altitude is attitude!"`

### 3.4 `static` — Pvt. Felix "Static" Dunmore (rookie radio operator)
- **Personality:** nervous, polite, reads the manual out loud in combat. Secretly very brave.
- **Rig:** skin `skinA` with freckles; hair: messy dark-brown tufts sticking out under the helmet;
  headgear: oversized steel helmet that tilts over one eye, dangling chin strap; top: slate-blue
  field shirt with sleeves too long (rolled); pants: slate-blue; boots: black; gloves: none;
  build: lanky (tallest, thinnest preset); accessories: big backpack radio with a tall whip
  antenna (bends when he runs — strongest silhouette of the four) and a coiled handset cord.
- **Knife swing:** antenna whip (it twangs).
- **Victory pose:** checks the manual ("STEP 7: CELEBRATE"), then cheers a little too late.
- **Select quote:** `"Cygnet Squad, radio check... hello? Is this thing on?"`

### 3.5 `recruit` (test character, kept)
`recruit` stays the plain test character for `m0`: default rig, grey shirt and trousers, no
accessories. It is not shown on the select screen.

---

## 4. Core rules & controls

### 4.1 Buttons
`left` `right` `up` `down` move/aim; `fire` shoots (or knifes at close range); `jump`; `bomb`
throws a grenade (in a vehicle: fires the vehicle's heavy weapon); `start` joins / pauses.
Default keys are those in `docs/ARCHITECTURE.md` §5.2.

### 4.2 Movement (values for `src/game/tuning.ts`)
| Action | Rule |
|---|---|
| Run | 1.25 px/tick, instant start, 3-tick stop. No acceleration (arcade-crisp). |
| Jump | press `jump`: vy = −4.2, gravity 0.22 px/tick² → apex ≈ 40 px, airtime ≈ 38 ticks. Full air control at run speed. No variable jump height (arcade-faithful). |
| Fall | max fall speed 5 px/tick. Landing anim 6 ticks (no lock, cosmetic). |
| Coyote / buffer | 5 ticks coyote time, 6 ticks jump buffer. |
| Crouch | hold `down` on ground. Hitbox 16×20. Crouch-walk 0.5 px/tick. Shots leave at crouch height (muzzle about 14 px above feet). |
| Drop-through | `down` + `jump` on a one-way platform. |
| Slopes | walkable up to 1:1, speed unchanged. |
| Stairs/ledges | step-up ≤ 6 px is automatic. |
| Deep water | `water` hazard = deep water; a player on foot sinks (splash death). Shallow water is decor only. |
| Pits | `pit` = instant death, the player respawns at the nearest safe ground to the left. |

### 4.3 Aiming and firing
- **Aim directions:** forward (default), **up** (hold `up`, also while running), **down** (hold
  `down` **only in the air**). No diagonals on foot, except the **sweep**: when the aim changes
  while `fire` is held with a rapid weapon (`machine-gun`, `laser`), the stream sweeps through the
  diagonal over 6 ticks (3 shots at 45°). This is a core feel item.
- **Firing:** each `fire` press shoots at once (input never waits for animation). Holding `fire`
  auto-fires at the weapon's hold rate (section 5).
- **Facing:** the legs turn instantly with `left`/`right`. The torso keeps the aim.
- **Weapon pose:** `pistol` pose for pistol/knife; `heavy` pose for all pickup weapons.
- **Shot cap:** max 6 player bullets on screen per player for the pistol (prevents spam fatigue);
  other weapons have their own caps (section 5).

### 4.4 Knife (automatic melee)
When `fire` is pressed and an enemy hurtbox overlaps the **melee box** (20 px ahead of the hip,
from 4 px to 30 px above the feet), the player knifes instead of shooting: 5 damage, 12-tick
cooldown, hits every enemy in the box. The knife works with every weapon, uses no ammo and does
not work against air units more than 30 px above the feet. Knife kills score ×2.

### 4.5 Bombs
`bomb` throws a grenade (section 6). Start of each life: **10 grenades** (if you have more, keep
them). Max 2 grenades of one player in the air. Throwing does not stop running.

### 4.6 Lives, death, respawn
- **One hit kills** a player on foot. Damage sources: enemy projectiles, explosions, contact with
  creatures/vehicles that "attack" (charging, biting, crushing), `spikes`, `lava`, `kill`, `pit`,
  deep `water`, crushing solids, TIME OVER.
- **Death:** death animation 60 ticks (variant by cause: `die`, `die-burn`, `die-blast` uses
  `die` with soot palette). At tick 45 the respawn starts.
- **Respawn:** the player drops in from the top of the view at the same x (or the nearest safe
  ground), `spawn` animation 24 ticks, then **120 ticks invulnerable** (blink 4 on / 4 off). A
  spawning player kills nothing, but enemy bullets that touch them vanish.
- **On death the player loses:** the current weapon and its ammo (back to `pistol`), grenades above
  10 are kept / below 10 are refilled to 10, and **all hostages rescued in this mission** (they
  flee; see 7.4). Score is kept.
- **Lives:** 3 per credit (option: 1–5). **Extends** at 500,000 and 1,500,000 points, plus
  `pickup-1up` items (3 in the game, held by VIP hostages in m2, m3, m4).
- **Vehicles:** when the vehicle's HP reaches 0 the player is ejected automatically (upwards,
  vy −3.5) with 60 ticks invulnerability; the vehicle explodes 30 ticks later (r 40, hurts enemies).

### 4.7 Continues and credits
- When a player loses the last life: `CONTINUE?` with a big countdown **9 → 0** (one step per 60
  ticks; pressing `fire` or `jump` skips one step). The game keeps running behind a dimmed screen
  if the other player still plays; in 1-player mode the action freezes.
- Press `start` to continue: +3 lives, score kept, the continue counter of that player +1, respawn
  at once at the same place (arcade-faithful: no checkpoint rewind).
- **Credits option:** `FREE PLAY` (default, unlimited continues), `9`, `5`, `3` credits per game.
  High-score entries show the number of continues. A clear with 0 continues gets the
  `ONE CREDIT CLEAR` bonus (section 14).

### 4.8 Time limit
- Each section has a timer (default **60**, counts one per second). It resets to the section's
  value at every checkpoint and to **99** at the start of a boss or mini-boss fight.
- Below 10: the digits flash red and `mission/timer-low` beeps each second.
- At 0: `TIME OVER` — every living player loses a life (standard death, `die` animation), then the
  timer resets. Vehicles are not destroyed by TIME OVER.
- The timer pauses during scripted cutscenes (boss entrances, branch transitions).

### 4.9 Two-player co-op
- P2 joins at any time with `start` (uses a credit if credits are limited); P2 drops in like a respawn.
- **Shared camera:** it follows the leading player (ratchet, never scrolls back). The view edges
  are walls. A player who is pushed by the trailing edge into a solid is moved up onto it (never
  killed by the camera).
- **No friendly fire.** Players cannot hurt or push each other. Players can stand on a Swan.
- Pickups and hostage items go to the player who touches them / frees them first (the hostage walks
  to that player). Score, lives, weapons, bombs and hostage counts are per player.
- A vehicle holds one driver. In vehicle sections (`m2-b`, `m3-b`, `m5-c`) the script spawns one
  vehicle per joined player.
- **Balance with 2 players:** boss, mini-boss and machine HP ×1.5; troop-lorry and summon counts
  +1; everything else unchanged.
- **Route choice in co-op:** the first player to enter an exit zone chooses; the other player is
  moved along (fade transition 30 ticks).

### 4.10 Difficulty levels
Chosen in OPTIONS (default REGULAR). Exactly these values change:

| Setting | CADET | REGULAR | VETERAN |
|---|---|---|---|
| Lives per credit (default) | 5 | 3 | 3 |
| Enemy bullet speed | ×0.80 | ×1.00 | ×1.15 |
| Enemy attack recovery (time between attacks) | ×1.35 | ×1.00 | ×0.80 |
| Telegraph length (enemies and bosses) | ×1.30 | ×1.00 | ×0.85 (never < 14 ticks) |
| Boss and mini-boss HP | ×0.80 | ×1.00 | ×1.20 |
| Aimed-shot error (enemies aim at the player's x ± this) | ±24 px | ±12 px | ±4 px |
| Section timer | +30 | +0 | +0 |
| Wave entries tagged `vet` (see section 11) | not spawned | not spawned | spawned |
| VIP `pickup-1up` | 1UP | 1UP | 50,000 points |
| Score multiplier at the end of each mission | ×0.5 | ×1.0 | ×1.5 |

### 4.11 Status gimmick: GILDED (original, m4–m5 only)
Golden "gilding mist" from `gilding-nozzle` hazards, the m4 boss and the m5 throne walker turns
the player into a living gold statue for **480 ticks**.
- **Look:** the player's sprite is palette-mapped to the gold ramp, with a sparkle every 20 ticks
  and a creaky step sound.
- **Effects:** run speed ×0.6, jump vy ×0.75 (apex ≈ 23 px), cannot crouch, weapon replaced by
  **gold nuggets** (heavy arcing shots: 4 damage, 18-tick cooldown, speed 3.5 with gravity 0.12;
  the stored weapon and its ammo return afterwards). Grenades still work.
- **Benefit:** enemy **bullets** bounce off (no death). Explosions, fire, crush, lava, pits and
  water still kill (a gilded player sinks at once).
- **Danger:** a second gilding hit while GILDED = **full statue** = lose a life (special death
  pose: the player freezes in a heroic pose, then crumbles into gold dust).
- **Cure:** timer ends (the gold cracks off with a puff), or touching any `pickup-food` (the player
  "polishes it off").
- A gilded player inside a vehicle is not possible: mist that hits a vehicle only damages it
  (2 HP per 10 ticks).

---

## 5. Weapons

**Pickup rule.** A `pickup-weapon` gives that weapon with the listed ammo. **Same weapon again:**
ammo + the listed amount (cap 999 for `machine-gun` and `laser`, 99 for the others). **Different
weapon:** replaces the current one and its ammo. When ammo reaches 0 the player goes back to the
`pistol` (sfx `weapon/empty`). A weapon pickup touched while driving a ground vehicle is stored for
the player (it applies on exit) and also gives +5 vehicle shells. Dying returns you to the pistol.

**Tap vs. hold.** Every weapon fires on the press. "Hold" is the auto-fire rate while `fire` is held.

| id | Name | Crate | Ammo / pickup | Behaviour | Damage | Cooldown tap / hold | Speed px/tick | Pierce / area | Pose | sfx id | Announcer |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pistol` | Pistol | – | ∞ | Single straight shot, 4 aim directions. Max 6 on screen. | 1 | 6 / 12 | 7.0 | no | pistol | `weapon/pistol` | – |
| `machine-gun` | Machine Gun | **M** | 160 | Tap = 3-round burst (3 ticks apart); hold = stream. ±1 px alternating spread. Aim **sweep** through diagonals. Max 18 on screen. | 1 | burst 12 / 4 | 9.0 | no | heavy | `weapon/machine-gun` | `MACHINE GUN!` |
| `shotgun` | Shotgun | **S** | 24 | Instant cone blast: wedge 96 px long, 10 px tall at the muzzle → 44 px at the end, active 6 ticks, hits each target once. Pellet sprites are cosmetic. | 8 (×1.5 inside the first 32 px) | 28 / 28 | instant | all targets in the cone | heavy | `weapon/shotgun` | `SHOTGUN!` |
| `rocket-launcher` | Rocket Launcher | **R** | 30 | Straight rocket: starts at 1.0, +0.25/tick up to 7.0. Smoke trail. Explodes on contact. Max 3. | 8 direct + 6 blast | 20 / 20 | 1.0 → 7.0 | blast r 16 | heavy | `weapon/rocket` | `ROCKET LAUNCHER!` |
| `flamethrower` | Flamethrower | **F** | 48 | Each shot = a rolling flame burst that travels ~100 px (36 ticks) and drifts up 0.05/tick. Hits ground units through each other. | 2 per 6 ticks per target (fire) | 16 / 16 | 3.0 | pierces all | heavy | `weapon/flame` | `FLAMETHROWER!` |
| `laser` | Laser | **L** | 240 energy (1 energy = 2 ticks of beam) | Hold = continuous beam to the view edge (2–4 px thick, pulsing); tap = 12-tick pulse. Sweeps like the machine gun. | 1 per 3 ticks per target (laser) | 12 / beam | instant | pierces all | heavy | `weapon/laser` (loop) | `LASER!` |
| `homing` | Tracker | **T** | 36 missiles | 2 missiles per shot, launched 30° up/down from the aim, then steer to the nearest enemy (turn 6°/tick). Fly straight if no target. Max 6. | 6 + 3 blast each | 24 / 24 | 3.5 | blast r 8 | heavy | `weapon/tracker` | `TRACKER!` |
| `bouncer` | Bouncer | **B** | 80 | Shot bounces off ground, walls and solids up to 3 times (mirror reflect), lifetime 120 ticks. Max 8. Great in tunnels and vertical sections. | 3 | 6 / 8 | 5.0 | no | heavy | `weapon/bouncer` | `BOUNCER!` |
| `whizbang` | Whizbang (firework launcher) | **W** | 16 | Rocket with a slight rising arc (gravity −0.06 → it climbs). Bursts after 30 ticks or on contact: centre blast + ring of 8 star sparks. Max 2. | 10 blast + 8 sparks × 3 | 36 / 36 | 4.0 (sparks 2.5, 24 ticks) | blast r 20, sparks pierce | heavy | `weapon/whizbang` | `WHIZBANG!` |

**Effective damage per second (for boss tuning):** pistol 10 (tapping), machine-gun 15, shotgun
~17 per target (25 at point blank), rocket ~42, flamethrower ~20 per target, laser 20 per target,
tracker ~27, bouncer ~22, whizbang ~35 when all sparks hit. Knife 25. Bosses (section 10) are
tuned so that a REGULAR fight lasts 45–80 s with the expected weapons.

**Pickup frequency targets:** ~6–9 weapon pickups per mission, 3–4 bomb pickups per mission.
Rare weapons: `laser` ≤ 2 per mission, `whizbang` ≤ 1 per mission (always a hostage reward).

---

## 6. Bombs & melee

### 6.1 Grenade (`grenade`) — the thrown bomb
| Property | Value |
|---|---|
| Count | 10 at each life start; `pickup-bombs` +10; cap 30 |
| Throw | from the `hand` point; throw anim 12 ticks (upper body only, legs keep running) |
| Arc | forward: vx = 2.2 × facing + 0.5 × player vx, vy = −3.0, gravity 0.18. Aiming up: vx 1.2, vy −4.0. Aiming down in the air: vx = player vx, vy = +1.0 |
| Bounce | first ground contact bounces once: vy = −1.6, vx × 0.6 |
| Fuse | explodes on the 2nd ground contact, on any enemy hurtbox, or after 100 ticks |
| Blast | radius 22 px, 12 damage (`explosion`) to every enemy part in the radius; shake 4 px / 8 ticks |
| Limit | 2 grenades in the air per player |
| sfx | `bomb/throw`, `bomb/bounce`, `explosion/m` |
| Look | round dark-olive grenade with a white stripe and a little swan stencil (6×6 px) |

### 6.2 Knife (`knife`) — automatic melee
| Property | Value |
|---|---|
| Trigger | `fire` pressed while an enemy hurtbox overlaps the melee box |
| Melee box | 20 px ahead of the hip, 4–30 px above the feet (crouching: 4–20 px) |
| Damage | 5 (`knife`) to every enemy in the box; 12-tick cooldown; 10-tick swing anim |
| Rules | works with every weapon, no ammo; no effect on targets more than 30 px above the feet; knife kills score ×2 and use the enemy's `die-knife` animation |
| sfx | `weapon/knife-swing`, `weapon/knife-hit` |

### 6.3 Vehicle heavy shells (`bomb` button inside a vehicle)
| Vehicle | Shell id | Behaviour | Damage | Blast | Ammo | Cooldown |
|---|---|---|---|---|---|---|
| `swan` | `swan-shell` | Fired from the beak along the neck angle, speed 5.0, gravity 0.05 | 18 direct | r 26, 10 | 20 (+5 per `pickup-bombs`) | 30 |
| `paddler` | `paddler-torpedo` | Skims along the water line, speed 3.0 → 5.0; also hits boats, mines, the m2 boss below the water line | 20 | r 20, 8 | 15 (+5) | 36 |
| `plowcat` | `plow-mortar` | Arcing flare shell, vx 3.0 + vehicle speed, vy −3.5, gravity 0.15 | 14 | r 24, 10 | 20 (+5) | 30 |
| `honker` | `egg-bomb` | Dropped down and slightly forward, falls with gravity 0.2, cracks on contact | 16 | r 24, 10 | 20 (+5) | 24 |

---

## 7. Items & hostages

### 7.1 Pickups
All pickups bob 2 px (40-tick cycle), blink during their last 120 ticks and vanish after 900 ticks
(level-placed pickups never vanish). Touch to collect.

| id | Look (px) | Effect | Score |
|---|---|---|---|
| `crate` | 20×18 wooden crate, Cygnet stencil | Breaks on any damage (3 HP) into planks; drops the item set in level data (else table `crate`) | 100 |
| `pickup-weapon` | 16×14 grey box, big letter (section 5) | Gives the weapon (param `weapon`) | 500 |
| `pickup-bombs` | 16×12 crate with 3 grenades | +10 grenades (vehicle: +5 shells); announcer `BOMBS!` | 500 |
| `pickup-food` | 12–16 px item (param `kind`) | Score; cures GILDED | bread 300, fish 500, sausage 800, pie 1,000, cake 2,000, banquet 5,000 |
| `pickup-gem` | 8–12 px sparkle item (param `kind`) | Score | coin 100, ruby 1,000, sapphire 2,000, emerald 3,000, medal 2,500, crown-jewel 10,000, golden-feather 10,000 |
| `pickup-1up` | 14×14 swan badge, flashing | +1 life; announcer `ONE UP!` | 0 (VETERAN: 50,000 instead of the life) |
| `pickup-repair` | 14×14 oil can with a wrench | Vehicle: +2 HP cells. On foot: score only | 1,000 |

**Golden feathers:** 3 per mission, hidden (behind breakable decor, in hard-to-reach spots, or
held by a hidden hostage). Counted on the mission tally.

### 7.2 Hostages (`hostage`)
The Legion kidnaps civilians to be its parade audience. Hostages are fully dressed civilians tied
to folding chairs with an `APPLAUSE` sign hanging from their neck. Looks are rig presets: baker
(white cap, apron), postal worker (blue cap, satchel), tourist (straw hat, loud flower shirt,
camera), grandmother (grey bun, shawl, handbag), scientist (white coat, clipboard), lighthouse
keeper (yellow raincoat, sou'wester), street musician (beret, accordion on the back). They are
neutral and cannot die.

| `kind` param | Behaviour |
|---|---|
| `tied` (default) | Freed by touch or any damage. `freed` 30 ticks (ropes snap, sign drops) → walks to the nearest player (1.0 px/tick, max 96 px) → `give` 24 ticks: the item pops out in front of the player → salute 16 ticks → `run` off-screen left at 2.0 px/tick. |
| `walker` | After `freed`, walks right at 0.6 px/tick ahead of the camera and hands the item only when a player comes within 16 px. If it leaves the view, the item is lost (it still counts as rescued). |
| `caged` | Inside a hanging birdcage (20×30, chain to a hook or crane). The cage has 6 HP; when broken it drops and the hostage behaves as `tied`. |
| `vip` | Gold cage with a `VIP` ribbon, 12 HP. Holds a `pickup-1up` or a rare item. Counts as 2 hostages. |
| `hidden` | Tied inside breakable decor (a barrel, a wardrobe, a snowman: 6 HP). Holds a golden feather or a rare weapon. |

Freeing a hostage scores **1,000** at once and adds 1 to the player's mission hostage count.

### 7.3 Drop tables (used only when level data gives no item)
| Table | weapon | bombs | food | gem | Weapon weights |
|---|---|---|---|---|---|
| `hostage` | 45 % | 15 % | 25 % | 15 % | M 30, S 15, R 15, F 12, B 10, T 10, L 6, W 2 |
| `crate` | 35 % | 30 % | 20 % | 15 % | same |
| `vehicle-zone` (in vehicle sections) | – | 50 % | – | 20 % | 30 % `pickup-repair` |
| `enemy-drum-major` | – | – | – | 100 % `medal` | – |
| `enemy-machine` (lorries, launches) | 10 % crate | – | – | 20 % coin ×3 | – |

### 7.4 Rescue bonus and death
- **Mission tally:** `HOSTAGES` = count × 5,000 (VIP counts 2). **ALL RESCUED** bonus 30,000 when
  the player (co-op: the team) freed every hostage on the route taken.
- **On death:** the player's hostage count for this mission drops to **0**. The HUD hostage icons pop
  off one by one, and a little line of civilians runs off-screen to the left (cosmetic, 60 ticks).
  Items already handed over stay. This is the core risk/reward of the genre.

---

## 8. Player vehicles

### 8.1 Shared vehicle rules
- **HP cells:** each cell = 12 HP. Damage to vehicles: enemy bullet 3, rocket/shell/explosion 12,
  creature or contact attack 6, gilding mist 2 per 10 ticks, crush / `lava` / `pit` / `kill` =
  destroyed. HUD shows the cells (partial fill). At 1 cell left: red flash every 20 ticks and
  `vehicle/alarm`.
- **Enter:** touch the vehicle's entry box while falling, or press `down` while overlapping it.
  `mount` anim 24 ticks (invulnerable). An empty vehicle is ignored by enemies.
- **Plain exit:** `down` + `jump` → the player hops out (vy −3.5). The vehicle stays and can be
  re-entered. Not possible in the `honker`. Vehicles never drop through one-way platforms (too
  heavy), so `down` + `jump` is free for the exit.
- **Ram:** `jump` + `bomb` pressed within 4 ticks of each other → the player ejects upward with
  60 ticks invulnerability, and the empty vehicle charges forward and explodes (vehicle lost). A
  hop, shell or special that started inside those 4 ticks is cancelled.
- **Destroyed:** HP 0 → automatic eject (60 ticks invulnerability), the vehicle explodes 30 ticks
  later (r 40, 40 damage to enemies).
- **Driver look:** the driver's head and shoulders show in the cockpit (character rig, `mount` pose).
- Vehicle main guns have infinite ammo. Heavy shells use the `bomb` button (section 6.3).

### 8.2 `swan` — SW-4N "Swan" Mk.3 (walker tank)
- **Look (56×64 standing, 56×44 crouching):** egg-shaped white armoured body (40×28) with a
  rounded glass canopy at the back, two backward-bending bird legs (dark steel, orange three-toed
  feet), a long 4-segment neck (white with orange bands) ending in an orange beak-shaped cannon.
  Navy "3" on the side, a small fluttering pennant on the canopy. The neck sways 2 px while walking.
  Its silhouette is a tall bird on two legs, not a round tank.
- **Controls:** walk 1.0 px/tick (legs animate, body bobs 2 px). `jump`: vy −3.8 (apex ≈ 33 px).
  Landing on an enemy deals 10 crush damage ("stomp"). `down`: crouch (body drops 20 px, neck folds;
  dodges most bullets at head height). **Aim:** the neck turns toward the held direction in 8
  directions (forward, up-forward, up, up-back, back, plus down-forward and down in the air) at
  8°/tick, so the stream sweeps smoothly.
- **HP:** 5 cells (60).
- **Main gun:** twin chin guns at the beak, 2 bullets per 4 ticks while held, 1 damage, 9 px/tick.
- **Heavy:** `swan-shell` from the beak along the neck angle, 20 shells.
- **Special — WING GUARD:** `down` + `bomb` → two armour "wings" unfold in front for 60 ticks and
  block enemy bullets and rockets from the front. Walk speed ×0.5 while open. Cooldown 300 ticks.
- **Ram — SWAN DIVE:** the empty Swan runs forward flapping its wings (3.0 px/tick, max 240 px)
  and belly-flops: explosion r 44, 48 damage.
- **Co-op:** the top of the body is a one-way platform; the other player can ride on it.
- **Appears:** m1-c (parked under a tarp at x 256), m4-a (air-dropped by parachute at x 192),
  m5-a (x 160; a spare drops at the checkpoint x 1792 for any player without one).

### 8.3 `paddler` — PB-2 "Paddler" (armed pedal boat)
- **Look (64×40):** park pedal boat with a blue-and-white striped hull, a striped canopy on two
  poles, two side paddle wheels, a deck machine gun on a swivel at the bow, a lifebuoy on the side.
- **Controls (on the water line only):** forward 1.2 px/tick, back 0.8. `jump` = **splash hop**
  (vy −3.2, apex ≈ 23 px; clears logs and mines). **Aim:** deck gun in 5 directions (forward,
  forward-up 45°, up, back-up 45°, back).
- **HP:** 4 cells (48).
- **Main gun:** deck machine gun, 1 bullet per 5 ticks, 1 damage, 9 px/tick.
- **Heavy:** `paddler-torpedo` along the water line, 15 torpedoes.
- **Special — SPLASH SCREEN:** `down` + `bomb` → the paddles spin backwards and throw a 24×40
  water wall in front for 45 ticks that blocks bullets. Cooldown 240.
- **Ram — FULL STEAM:** the empty boat surges forward at 3.5 px/tick (max 240 px) and explodes
  (r 40, 40 damage).
- **No boat on the river:** if a player ejects or loses the boat on deep water, a `raft` (64×10
  moving platform, matches the scroll speed) spawns under them. At the next checkpoint a fresh
  Paddler floats in from the left for every player without one.
- **Appears:** m2-a dock (x 2224, one per player), m2-b, m2-c2 (the cave route keeps it), m2-d
  (boss lagoon, if still alive).

### 8.4 `plowcat` — PC-7 "Plowcat" (armoured snowplow)
- **Look (88×52):** yellow-orange boxy cab on wide black treads, a huge angled silver plow blade
  in front, a roof turret with short twin guns, an exhaust stack puffing black smoke, an orange
  warning light that spins.
- **Controls:** acceleration 0.06 px/tick², max 1.8 on flat ground; downhill adds up to +0.6
  (max 2.4), uphill −0.6. Braking (opposite direction) 0.12 px/tick². `jump` = **bump** (vy −3.0,
  apex ≈ 20 px; enough for 40 px gaps at speed). **Aim:** the roof turret turns toward the held
  direction (8 directions) at 10°/tick.
- **HP:** 5 cells (60).
- **Main gun:** roof twin guns, 2 bullets per 4 ticks, 1 damage, 9 px/tick.
- **Heavy:** `plow-mortar`, 20 shells.
- **Blade (passive):** driving into an enemy at speed ≥ 1.2 deals 10 crush damage per contact and
  blocks contact attacks from the front. Snow barricades (`snow-wall`, 1 hit) break on contact.
- **Special — PLOW BOOST:** `down` + `bomb` → 90 ticks at 2.8 px/tick, the blade glows, ram damage
  30 per contact (can flatten a `bunting-tank` in 2 hits). Cooldown 360.
- **Ram — AVALANCHE RUN:** the empty Plowcat races forward at 3.5 px/tick for up to 300 px and
  explodes (r 44, 48 damage).
- **Appears:** m3-b only (x 96, one per player). At the end of m3-b it crashes into a snowbank
  (cutscene, 90 ticks) and the players continue on foot.

### 8.5 `honker` — HK-1 "Honker" (jump-jet, flying section)
- **Look (48×24):** tiny single-seat jet with a long goose-like nose cone (orange tip), white
  fuselage, stubby wings with orange stripes, twin tail fins, open cockpit (the pilot's head and
  headgear show; Yo-Yo's scarf trails behind). Exhaust flicker 2 frames.
- **Controls:** free 8-way flight at 1.8 px/tick inside the view (the camera auto-scrolls). No
  gravity. The nose always points right.
- **HP:** 5 cells (60).
- **Main gun:** twin nose guns, 2 bullets per 5 ticks, 1 damage, 10 px/tick.
- **Weapon crates in flight** give honker versions (same ammo as section 5): M = 3-way spread;
  S = short wide blast; R and T = 2 homing rockets per 20 ticks; F = short flame cone; L =
  forward beam; B = shots that bounce off the view's top and bottom edges; W = whizbang bursts.
  Ammo 0 → back to the nose guns.
- **Heavy:** `egg-bomb` (dropped down), 20 bombs.
- **Special — BARREL ROLL:** `jump` → 36 ticks spin: invulnerable, speed ×1.3. Cooldown 240.
  It starts 4 ticks after the press unless `bomb` follows (then it is a BEAK DIVE).
- **Ram — BEAK DIVE:** `jump` + `bomb` → 40 ticks forward dash at 4.0 px/tick with the nose down;
  30 damage to each enemy touched; the Honker takes 1 cell per contact. There is **no eject in the
  air**. A destroyed Honker = the pilot loses a life (tumbles away under a comic parasol); the
  player respawns in a new Honker flying in from the left (120 ticks invulnerable).
- **Appears:** m5-b (boarding in the hangar at the top of the spire) and m5-c, including final boss
  stage 1 at its end. After stage 1 the Honkers land on the throne deck (m5-d, cutscene) and the
  players fight on foot.

### 8.6 Vehicle overview
| id | Sections | HP cells | Heavy ammo | Special | Ram |
|---|---|---|---|---|---|
| `swan` | m1-c, m4-a → m4-b1/b2 → m4-c, m5-a | 5 | 20 | WING GUARD | SWAN DIVE |
| `paddler` | m2-a dock, m2-b, m2-c2, m2-d | 4 | 15 | SPLASH SCREEN | FULL STEAM |
| `plowcat` | m3-b | 5 | 20 | PLOW BOOST | AVALANCHE RUN |
| `honker` | m5-b top, m5-c (incl. final stage 1) | 5 | 20 | BARREL ROLL | BEAK DIVE |

---

## 9. Enemy faction — the Plume Legion

### 9.1 Shared rules
- **Uniform rig (all infantry unless noted):** crimson tunic with gold buttons and white
  cross-belts, sky-blue trousers, black boots, black shako (8 px) with a red plume (6 px), gold
  chin strap. Skin tone picked per spawn from `skinA/B/C` (`world.rng`). Standing height 34 px +
  plume = 40 px; hitbox 14×28 (crouch 14×18). Anchor at the feet.
- **Awareness:** idle until a player is within 176 px in front or 64 px behind, or a shot lands
  within 32 px → `alert` 18 ticks with a `!` bubble → behaviour. Infantry that spawn running skip
  the alert.
- **Fair-fire throttle:** at most 3 infantry projectiles from "aimed shots" may be in the air per
  player at once (a shared token pool). This keeps dense waves readable.
- **Panic:** triggered by a broken `fanfaron-statue` within 160 px, a Drum Major's death (his aura),
  a Swan stomp within 48 px, or an attack goose. `panic` 60 ticks: run away, arms flailing, no attacks.
- **Comedy idles (`gag` anim, random at spawn):** polishing a medal, saluting a pocket portrait of
  the Archduke, yawning, fixing the plume in a hand mirror, marching on the spot, sharing a tea flask.
- **Death variants (bloodless):** `die` (bullet: the shako spins off, he turns once, sits down
  dazed with circling stars, then poofs into a grey soot cloud, 40 ticks); `die-blast` (launched
  24–40 px up, sooty face, plume on fire, lands flat, poof, 50 ticks); `die-burn` (soot-black,
  eyes blink twice, crumbles into an ash pile with the plume on top, 50 ticks); `die-knife` (bonk:
  stars and tweeting birds circle the head, falls flat, poof, 40 ticks). Knife kills score ×2.

### 9.2 Infantry
| id | Name | Look & size | HP | Score | Behaviour | Attacks (telegraph → attack → recovery) | Deaths | Missions |
|---|---|---|---|---|---|---|---|---|
| `rifleman` | Legionnaire | Standard uniform; musket-carbine with bayonet. 14×28 hitbox | 1 | 100 | Idle gag or runs in. On alert: 55 % advance to 72–140 px and stand-shoot; 30 % crouch-shoot from cover; 15 % hold position. Turns to face the player every 30 ticks. | **Shot:** T 24 (raises rifle; muzzle glint at tick 16) → 1 bullet 1.8 px/tick, straight or 45° up if the player is > 40 px above → R 70–100. **Bayonet** (player ≤ 20 px): T 14 → stab 18 px for 6 ticks → R 40 | all 4 | all |
| `grenadier` | Bombardier | Wider build, no rifle, bandolier of round black bombs | 2 | 200 | Keeps 96–160 px away, backs off if closer. | **Lob:** T 20 (arm back, fuse sparkles) → bomb lands at the player's x ± aim error (apex 48 px); explodes 60 ticks after landing or on contact, r 16 → R 90 | all 4 | m1–m5 |
| `shield-guard` | Shieldbearer | Brass helmet instead of shako; tall oval parade shield 24×32 with the Archduke's face | body 1, shield 12 | 300 (+200 shield) | Advances 0.5 px/tick. Shield blocks bullets, fire and knife from the front; explosions and shots from behind/above hit the body. | **Peek shot** every 150 ticks: T 16 (lowers shield — body exposed) → 1 shot 2.0 px/tick → R 30. **Bash** (player ≤ 24 px): T 12 (leans back) → dash 24 px in 8 ticks → R 50. Shield broken → panic 60, then rifleman behaviour | all 4 (+ shield clatters) | m1–m5 |
| `tuba-gunner` | Tubist | Heavy build, puffed cheeks, giant brass tuba-shaped rocket launcher on the shoulder (bell 16 px) | 3 | 300 | Stands at 140–220 px, likes platforms and rooftops. Param `aa: true` aims 45° up (anti-air). | **Rocket:** T 36 (cheeks puff, bell glows, low "oom" note) → rocket 1.2 → 3.0 px/tick (+0.06/tick), straight; the rocket has 1 HP (shoot it down: 100) → R 120 | all 4 (tuba lands bell-down) | m1–m5 |
| `torchbearer` | Torchbearer | Ceremonial bronze torch nozzle, red gas tank (8×12) on the back, sooty face, leather apron | 2 (tank weak point) | 300 (+200 tank) | Walks to 48 px at 0.8 px/tick. A hit on the tank (from behind, bouncer, explosion) blows it up: r 24, 12 damage to enemies. | **Flame:** T 24 (torch flares, hiss) → flame jet 48×12 for 40 ticks → R 70 | die, die-blast, die-knife | m2–m5 |
| `drum-major` | Drum Major | Tall build, white shako with a 14 px plume, gold epaulettes, sash, mace baton he twirls | 6 | 1,000 + `medal` | Stays 160–220 px behind his troops. **Double-time aura** r 96: soldiers inside get recovery ×0.6, speed ×1.3 (tiny music notes over their heads). His death makes the aura's soldiers panic. | **Whistle** every 300 ticks: T 30 → 2 riflemen run in from the nearest edge → R 60. **Baton** (player ≤ 120 px): T 20 (baton spins faster) → boomerang out 120 px and back in 60 ticks → R 60 | all 4 (baton keeps spinning on the ground) | m1–m5 |
| `parasol-trooper` | Parasol Trooper | Standard uniform hanging from a frilly white-and-crimson parasol (24 px canopy) | 1 (+ parasol 2) | 200 | Drops from aircraft or `top`, descends 0.6 px/tick, sways ± 8 px. Popping the parasol: he plunges at 3 px/tick and lands dazed for 60 ticks. Lands → rifleman behaviour. | **Air shot** every 90 ticks: T 18 → shot aimed at the player, 2.0 px/tick → R 72 | all 4 (parasol drifts away) | m1–m5 |
| `lancer` | Flag Lancer | Standard uniform, long lance with a pennant of the Archduke's face | 2 | 300 | Patrols, then charges. | **Charge:** T 30 (stamps twice, lowers lance, bubble `CHAAARGE!`) → 2.2 px/tick for up to 300 px or until a wall, lance hitbox 28 px ahead → R: if he missed, trips onto his face (stunned 90 ticks, takes ×2 damage) | all 4 | m2–m5 |

### 9.3 Creatures
| id | Name | Look & size | HP | Score | Behaviour | Attacks (telegraph → attack → recovery) | Deaths | Missions |
|---|---|---|---|---|---|---|---|---|
| `honk-goose` | Attack Goose | White goose, orange beak and feet, tiny crimson Legion cap. 20×18 | 2 | 300 | Flocks of 3–6, waddle 1.0 px/tick with 10-tick stagger. Chaotic: also bites Legion soldiers in the way (they panic, no damage). | **Charge:** T 20 (neck stretches, wings spread, `creature/honk`) → dash 2.8 px/tick for 40 ticks (bite) → R 40 (shakes head) | `die` (puff of feathers, cap flies), `die-burn` (sooty goose runs off honking, harmless) | m1, m5 |
| `war-boar` | War Boar | Bristly brown boar, brass helmet, tusk caps, crimson saddle cloth. 40×28 | 8 | 600 | Patrols; tramples soldiers too. | **Charge:** T 36 (paws ground, dust, snort) → 2.6 px/tick up to 320 px → R: hits a solid = dazed 60 ticks (stars, ×1.5 damage), else turns 30 ticks | `die` (tips over, legs up, stars, poof), `die-blast`, `die-burn` | m2, m4 |
| `spit-frog` | Spitter Frog | Big yellow-and-black frog with tiny gold epaulettes. 24×20. Hides in foliage or water (only 2 blinking eyes show) | 4 | 400 | Hops toward the player: arc 64 px wide, 32 px high, every 50 ticks. | **Spit:** T 24 (throat swells) → glob 2.0 px/tick, gravity 0.1 → lands as a sticky puddle 24×4 for 120 ticks (player speed ×0.5, no jump inside) → R 60 | `die` (flips, tongue out, poof), `die-burn` | m2 |
| `sapper-mole` | Sapper Mole | Mole with a miner's helmet and lamp. 20×18 | 3 | 400 | Travels underground as a visible dirt bulge at 0.8 px/tick (the telegraph). Invulnerable underground. | **Dynamite:** pops up within 32 px: T 16 (lights the stick) → throws it (arc, fuse 50, r 20) → digs down, R 90 | `die` (helmet pops, dizzy, poof), `die-blast` | m2, m4 |
| `helmet-ram` | Helmet Ram | Shaggy white mountain ram, polished brass helmet with a spike. 36×30 | 10 | 700 | Stands on ledges; can knock `snow-boulder` props down slopes. Charging off a ledge = falls with a bleat (still scores). | **Charge:** T 30 (lowers head, stamps twice) → 3.0 px/tick along the ledge → R 60 (turns) | `die` (helmet rings like a bell, ram sits, poof), `die-blast` | m3 |
| `clockwork-hound` | Clockwork Hound | Brass robot dog, wind-up key on its back, red glass eyes. 32×22 | 6 (key ×2 from above) | 500 | Packs of 2–4, runs 2.2 px/tick. After 600 ticks alive it runs down: slows to 0.5, then sits (harmless). | **Leap:** T 18 (crouches, key spins fast, whirr) → arc 48 px high at the player → R 30 | `die` (springs and cogs pop out, key spins away), `die-blast` | m3, m4, m5 |
| `brass-bee` | Brass Bee | Clockwork bee drone with glass wings. 10×8 | 1 | 50 (SWARM bonus 1,000 when a whole swarm dies) | Swarms of 6–10 from `hive-launcher` props or aircraft. Sine flight (amplitude 12 px) toward the player at 1.4 px/tick. | **Dive:** T 20 (red eye flicker, buzz pitch rises) → straight dive 3.0 px/tick at the player's position → R 40 (regroup) | `die` (pops into a spark and a tiny spring) | m4, m5 |

### 9.4 Machines (vehicles, aircraft, turrets)
Machine colours: royal purple bodies, gold trim, crimson canvas, bunting flags, loudspeaker horns.
Machines use the helper kits (hull plates, treads, wheels, rotors, barrels).

| id | Name | Look & size | HP | Score | Behaviour | Attacks (telegraph → attack → recovery) | Deaths | Missions |
|---|---|---|---|---|---|---|---|---|
| `bunting-tank` | Bunting Tank | Boxy purple light tank 72×48: tall square turret, one long cannon, gold crest on the front plate, a gramophone horn on the turret, bunting flags, small treads | 60 | 2,000 | Drives toward the player at 0.6 px/tick to ~160 px, reverses if the player is closer than 64 px. The hull top is a solid the players can stand on. The horn plays a tinny anthem loop (`machine/anthem`). | **Cannon:** T 40 (barrel draws back 4 px, muzzle smoke, creak) → shell 3.0 px/tick flat, r 18 → R 100. **Hull gun** (player ≤ 96 px): T 20 (port light) → 3 bullets 2.4 px/tick, 6 ticks apart → R 60 | 3 small blasts over 40 ticks, big blast, turret flies up spinning, 2 crew pop out and panic (50 % become riflemen) | m1, m3, m4, m5 |
| `troop-lorry` | Troop Lorry | Truck 88×44 with a crimson canvas cover and bunting | 50 | 1,500 | Drives in from `R+48` at 1.6 px/tick, brakes at its script x (screech), unloads soldiers (param `cargo`, default 6 riflemen, 1 per 45 ticks), then reverses off. The moving bumper crushes. | Crush only | Big blast, canvas flies off, driver runs; drop table `enemy-machine` | m1–m5 |
| `gyrocopter` | Gyrocopter | Open-frame autogyro, pilot + rear gunner, purple with gold rotor tips. 48×32 | 20 | 800 | Enters from the right at y 40–80, hovers over the player (1.2 px/tick). Leaves after 3 attacks. | **Bomb:** T 24 (bay opens, bomb visible) → bomb falls (gravity 0.15), r 16 → R 90. **Gunner:** T 18 (leans out) → 2 aimed shots 2.2 px/tick → R 90 | Spins down trailing smoke, crash blast r 24 (hurts enemies) | m1–m5 |
| `blimp-bomber` | Bomber Blimp | Envelope 112×48 painted with the Archduke's grin, gondola with a bomb hatch | 80 (gondola ×1.5) | 3,000 | Crosses at 0.4 px/tick relative to the camera. Drops 2 `parasol-trooper`s every 300 ticks. | **Carpet:** T 40 (hatch blinks red, 5 bomb shadows appear on the ground) → 5 bombs 16 px apart → R 240 | Deflates with a long raspberry noise, spins, falls, blasts | m1–m5 |
| `gazebo-gun` | Gazebo Turret | Wrought-iron bandstand with a striped dome roof, twin gun under the roof. 48×56, fixed. Param `mortar: true` adds a roof mortar | 60 | 2,000 | Guns turn in the lower half circle toward the player. | **Burst:** T 30 (roof lamp blinks) → 5 shots 2.2 px/tick, 6 ticks apart → R 90. **Mortar:** T 45 (crosshair on the ground) → shell r 20 → R 150 | The roof spins off like a top, the frame sags | m1, m3, m5 |
| `mortar-coach` | Mortar Coach | Horseless royal carriage: purple body, big gold-spoked wheels, mortar tube through the roof, coachman in a powdered wig. 64×48 | 45 | 1,500 | Keeps ~200 px away, moves 0.8 px/tick. | **Mortar:** T 45 (crosshair at the player's x) → shell flight 70 ticks, r 20 → R 150 | Wheels roll away on their own, wig flies, blast | m3, m4, m5 |
| `patrol-launch` | Patrol Launch | Armoured motorboat, crimson hull, bow gun, pennant. 72×32 | 40 | 1,500 | Water only; matches scroll speed ± 0.5. Drops a `river-mine` behind it every 180 ticks. | **Bow gun:** T 24 (gun swings, flash) → 3 shots 2.2 px/tick, 8 ticks apart → R 90 | Flips upside down and sinks; crew swim off | m1, m2 |
| `plume-fighter` | Plume Fighter | Small propeller fighter, crimson, gold nose, feather-shaped tail fin. 40×20 | 6 | 500 | m5-c: formations (V of 5, snake of 6, loop of 4). m4: 2-ship strafing runs. | **Shot:** T 16 (nose flash) → aimed shot 2.5 px/tick → R 120. **Strafe** (ground sections): T 60 (engine whine, shadows cross the ground) → a line of bullets walks along the ground → leaves | Smoke spiral, blast | m4, m5 |

### 9.5 Mini-bosses
Each mini-boss fight locks the camera, resets the timer to 99 and plays `mini-boss`.

| id | Name | Look & size | Parts (HP) | Score | Attacks (telegraph → attack → recovery) | Where |
|---|---|---|---|---|---|---|
| `parade-float` | Parade Float | Three-tier parade cake on wheels with a gold Archduke figurine on top, confetti cannons on both sides. 128×80. Two `tuba-gunner`s ride the top tier (separate entities) | `float-cannon` ×2 (40 each), `float-core` figurine (160) | 15,000 | Moves back and forth at 0.6 px/tick. **Confetti:** T 30 (cannon shakes) → fan of 5 shots 1.8 px/tick → R 90 (cannons alternate). **Phase 2** (both cannons gone): the cake top opens: T 40 (3 crosshairs on the ground) → 3 firework rockets fall on them, r 20 → R 120. **Parade ram** every 600 ticks: T 40 (engine revs, wheel smoke) → crosses the arena at 2.4 px/tick → R 60 | m1-c, m5-a (with +50 % HP) |
| `peacock-sentinel` | Peacock Sentinel | Robot peacock, emerald and gold plates. Body 48×40; tail fan 96×64 when open | `tail-fan` (120), `peacock-head` (140) | 20,000 | **Fan laser:** T 40 (tail opens, 7 "eyes" light one by one) → 7 beams in a fan for 20 ticks → R 80. **Peck dash:** T 24 (head pulls back) → dash 96 px → R 50. **Phase 2** (tail gone): hops between platforms: T 20 (crouch) → leap → R 40, peck dash twice as often | m2-c1 |
| `rail-howitzer` | Rail Howitzer | Armoured railcar 160×72 with a huge mortar and two gun cupolas, coupled at the front of the gold train | `cupola` ×2 (40 each), `howitzer` (220) | 20,000 | **Cupola burst:** T 20 → 4 shots 2.2 px/tick → R 70. **Howitzer:** T 60 (barrel rises, crosshair on a car roof) → shell r 32; the hit roof segment is gone for 300 ticks → R 150. **Low bridge** every 480 ticks: T 60 (warning bell, `DUCK!` sign) → a bridge sweeps everything higher than 28 px above the roofs (crouch or die; a crouching Swan loses 1 cell) | m4-b1 |
| `carrier-blimp` | Carrier Blimp | Big airship 256×96 with a hangar gondola, two engine pods, the Archduke's crest | `engine-pod` ×2 (80 each), `hangar-gondola` (260) | 30,000 | **Launch:** T 30 (hangar doors open) → 3 `plume-fighter`s → R 180. **Broadside:** T 36 (6 ports glow) → 6 shells aimed in a spread → R 90. **Mine curtain:** T 40 → 5 `sky-mine`s in a column → R 120 | m5-c |

### 9.6 Props and hazards (entities, not counted as enemies)
| id | Look & size | HP | Score | Behaviour |
|---|---|---|---|---|
| `fanfaron-statue` | Gold-painted statue of the Archduke on a plinth, 24×48 | 20 | 1,000 | Breaks into chunks; Legion soldiers within 160 px panic 60 ticks |
| `explosive-barrel` | Red barrel with a crown stencil, 16×20 | 3 | 100 | Explodes r 28, 15 damage to enemies only |
| `river-mine` | Spiked floating mine on the water line, 14×14 | 2 | 200 | Bobs; explodes on contact r 20 (hurts players and vehicles) |
| `sky-mine` | Balloon with a dangling bomb, 16×24 | 2 | 200 | Drifts; explodes on contact r 20 |
| `gilding-nozzle` | Brass wall nozzle with a gold drip, 16×16 | 15 | 500 | T 30 (hiss, drip) → gold mist cone 64×24 for 60 ticks (GILDED) → R 120 |
| `hive-launcher` | Brass beehive on a pole, 24×32 | 20 | 1,500 | Releases a swarm of 6 `brass-bee`s every 360 ticks while on screen |
| `snow-boulder` | Rolling snowball with rocks, 24×24 | 12 | 300 | Rolls downhill at 1.5–3.0 px/tick (crush) |
| `snow-wall` | Snow barricade, 24×40 | 10 | 200 | Blocks; a Plowcat breaks it on contact |
| `falling-icicle` | Icicle, 8×24 | 1 | 100 | Shadow 40 ticks → falls (gravity 0.3), kills on contact |
| `raft` | Log raft 64×10 | – | – | Moving platform that keeps pace with the river scroll |
| `barge` | Canal barge 128×24 | – | – | Moving solid platform on a path |
| `lift` | Funicular car, elevator or ladle, 64×12 by default (param `w`) | – | – | Moving platform on a path |
| `lily-pad` | Lily pad 32×6 | – | – | One-way platform that sinks 60 ticks after a player lands, returns after 180 |

---

## 10. Bosses

**Shared boss rules.** A boss fight starts with a camera lock, a 120-tick entrance (timer paused,
`boss/warning` klaxon, music `boss`), then the timer resets to 99. There is **no boss HP bar**
(arcade-faithful): every part shows 3 damage states (clean → smoking + dents → sparking, flames,
loose plates) and flashes white when hit. Parts can be destroyed separately; destroyed parts stop
their attacks. Phase changes play `boss/phase` and a 40-tick pause in attacks (a breather).
Explosive weapons damage every part in their blast. HP values are REGULAR 1P (section 4.10 and
co-op ×1.5 apply). Each arena holds one weapon crate.

### 10.1 m1 boss — `showboat` — S.S. VAINGLORIOUS
- **Concept:** the Archduke's armed paddle-steamer, captained by Admiral Barnabas Spool. A brass
  band plays on the stern deck the whole fight (decor animation).
- **Look (320×176, extends ~100 px past the right edge):** white-and-purple paddle-steamer.
  Hull 320×64 at the water line; two tall smokestacks (24×72) with gold crown tops; a side paddle
  wheel (80×80) mid-hull behind a purple cover; a big gilded bust of the Archduke as the bow
  figurehead (48×40); two deck cannons on the foredeck; bunting everywhere; the bridge with the
  tiny Admiral behind the stacks.
- **Arena (m1-c end, camera lock 384 px):** quay floor y = 176 from view x 0–232, deep water
  (`water`, y ≥ 184) to the right of it. Two floating cargo crates (one-way, 32×8) bob at view x
  150 and 190, y 140. A crate stack (solid, 32×24) at view x 40 for cover. Weapon crate (R) at x 24.
- **Parts:** `deck-cannon-a` 70, `deck-cannon-b` 70, `smokestack-a` 90 and `smokestack-b` 90
  (optional), `paddle-wheel` 160 (vulnerable in phase 2), `figurehead` 220 (core, phase 3).

| Phase | Trigger | Attacks |
|---|---|---|
| 1 BROADSIDE | start | **Cannon volley** (cannons alternate, every 120 ticks): T 30 (barrel flashes white 3 times) → 3 shells in an arc (vx −2.0 / −2.6 / −3.2, vy −2.5, gravity 0.1, r 14) → R 60. **Soot bombs** (each living stack, every 200 ticks): T 24 (black smoke ring puffs out) → 2 soot bombs lobbed at the player's x ± 16, r 18 → R 90. **Ram** (every 600 ticks): T 45 (horn blast `boss/m1-horn`, wheel churns) → the boat lurches 56 px left in 30 ticks; the quay's right 56 px become a `kill` zone; holds 40 ticks → backs off in 60 ticks |
| 2 PADDLE FURY | both cannons destroyed | The wheel cover blows off. **Barrel fling:** T 30 (wheel glows red, spins faster) → 3 bouncing barrels (1.8 px/tick, 2 bounces, 2 HP each) → R 70. **Foghorn ring:** T 40 (the bust's cheeks inflate) → a 24 px tall sound ring rolls left along the floor at 2.2 px/tick (jump it) → R 80. **Lifebuoy mines:** every 360 ticks 2 `river-mine`s float to the quay edge. Ram continues every 600 ticks |
| 3 WRECKING BUST | wheel destroyed | The figurehead detaches on a crane arm. **Swing:** T 36 (arm rises, chain rattles, shadow marker on the quay) → the bust swings across view x 40–200 at 0–40 px above the floor in 50 ticks (jump at the right moment or stand on a floating crate) → R 60: the bust rests on the quay and takes ×1.5 damage. **Coin spray** (bust < 50 %): T 24 (mouth opens) → 8 gold coins in a fan, 2.0 px/tick, gravity 0.08 → R 60 |

- **Death sequence (240 ticks):** the bust cracks; chain explosions bow to stern for 120 ticks;
  the band plays a sad falling tuba slide (`boss/m1-sad-tuba`); the boat tilts and sinks, the flag
  goes down last; the Admiral rows away in a tiny rowboat with a lifebuoy round his neck, shaking
  his fist.
- **Score:** 50,000 + parts (cannon 2,000 each, stack 2,000 each, wheel 5,000).

### 10.2 m2 boss — `riverhorse` — THE ROYAL RIVERHORSE
- **Concept:** a giant brass robot hippo river-fortress, driven by Ringmaster Hettie Krank from a
  circus howdah on its back.
- **Look (256×144 body; extends past the right edge):** purple-painted brass plates with gold
  rivets, porthole eyes, tiny ears that are mortar tubes, a small crown, a striped circus howdah
  (64×48) on the back. The mouth opens to 96×64 and shows brass teeth and a glowing furnace core.
- **Arena (m2-d, camera lock):** deep water everywhere (surface y 184). A high wooden pier
  (one-way, y 136) on posts spans view x 0–176; Paddlers sail beneath it (their canopy top is
  y 144, so they never touch the pier). 3 `lily-pad`s on the water at view x 196, 244, 292 (y 180).
  Players on foot fight from the pier and the pads; players who still have a `paddler` fight on
  the water. Weapon crate (S) on the pier.
- **Parts:** `howdah` 140, `ear-mortar-l` 60 and `ear-mortar-r` 60 (optional), `mouth-core` 320
  (only hittable while the mouth is open).

| Phase | Trigger | Attacks |
|---|---|---|
| 1 WALLOW | start (only the head and back show above the water) | **Howdah gun:** T 20 (canopy flaps open) → 3 aimed shots 2.0 px/tick → R 70. **Ear mortars:** T 30 (ears flip up, crosshairs appear) → 1 shell per ear at the player's x, r 18 → R 120. **Wave surge** (every 420 ticks): T 60 (it sinks, bubbles across the lagoon) → it surfaces and a wave rolls left at 2.0 px/tick (it rises 20 px above the pier; jump it; boats splash-hop) → R 90. **Circus cannon** (every 480 ticks): 2 `parasol-trooper`s are fired out of the howdah |
| 2 OPEN WIDE | howdah destroyed (the Ringmaster flees, her top hat bouncing behind her) | The hippo stands up, full body visible. **Gape:** T 40 (jaw creaks open, steam) → inhale: pulls players 0.4 px/tick toward the mouth for 90 ticks while 4 pineapple bombs arc out (r 16) → the mouth stays open 120 ticks (core exposed) → **Chomp:** T 20 (teeth flash white) → the jaws slam; everything in the 48 px in front of the mouth is crushed → R 60. **Tail drops** (every 300 ticks): T 30 (tail rises, 3 markers on the pier and the water) → 3 water bombs fall on the markers, r 12 |
| 3 STAMPEDE | core < 50 % | **Charge:** T 50 (snorts steam, stamps, shake 2 px) → charges 160 px left in 60 ticks and smashes the right half of the pier (view x 96–176 is gone except two 16 px post stumps as one-way platforms at y 136) → R 150: dizzy with stars and mouth open (core ×1.5 damage) → backs off in 90 ticks. Gape/Chomp continues with an open window of 80 ticks |

- **Death sequence (200 ticks):** the porthole eyes turn into X's, it rolls belly-up while
  springs and cogs burst out, a little flag pops from its belly reading `OOPS`, then it sinks in
  bubbles.
- **Score:** 60,000 + parts (howdah 5,000, ear 2,000 each).

### 10.3 m3 boss — `war-organ` — THE GRAND WAR ORGAN
- **Concept:** a cathedral pipe organ that is also a war machine, played by the court composer
  Maestro Ottokar Brumm. Its attacks are music: the boss track's chords line up with its tells.
- **Look (320×200, pipes rise past the top edge):** dark wood and brass; three pipe banks (left,
  centre, right, each 64×120 with 6–8 pipes that glow in colour when they fire); a bell tower
  (48×48) on top with one big bell; the console (64×48) at floor level with the Maestro (wild
  white hair, tailcoat, flapping arms). Hydraulic legs hidden under the base (shown in phase 2).
- **Arena (m3-d, camera lock):** floor y = 184; two balconies (one-way) at y 128, view x 24–104
  and 280–360. Background: stained-glass windows and snow outside (custom generator
  `cathedral`). Weapon crate (L) on the left balcony.
- **Parts:** `pipes-left` 100, `pipes-centre` 120, `pipes-right` 100, `bell-tower` 120
  (optional), `console` 300 (hittable from phase 2).

| Phase | Trigger | Attacks |
|---|---|---|
| 1 OVERTURE | start | Banks fire in turn (left → centre → right), one every 100 ticks. **Left:** T 30 (pipes glow bottom to top, a rising chord plays) → 3 note bolts (eighth-note shapes) aimed at the player, 1.8 px/tick, 10 ticks apart → R 45. **Centre:** T 30 (5 sparkles in the air mark the target columns) → 5 notes rain down on those x at 2.2 px/tick → R 45. **Right:** T 30 → a "bass note" wave rolls right-to-left along the floor (16 px tall, 1.6 px/tick; jump it or stand on a balcony) → R 45. **Bell drop** (every 300 ticks): T 40 (rope wobbles, `dong`, shadow) → the bell falls, bounces twice toward the player at 1.5 px/tick, then cracks (r 12) |
| 2 CRESCENDO | two pipe banks destroyed | The organ rises 40 px on 4 hydraulic legs and shows the console. **Sound wall:** T 36 (the Maestro raises his arms; a 5-line music staff appears above the arena and one line lights up: the gap's height, floor or balcony) → a full-height wall of noise moves left at 1.2 px/tick with a 40 px gap at the lit height → R 90 (the Maestro holds his ears: console ×1.5 damage). The last pipe bank keeps firing every 150 ticks |
| 3 FINALE | console < 50 % | **Stomp:** T 30 (a leg lifts) → stomp; floor shockwaves both ways (12 px tall, 1.5 px/tick) → R 40. **Roof avalanche** (every 240 ticks): T 40 (3 shadows) → snow chunks fall, r 12. **Double wall** (every 300 ticks): two sound walls 90 px apart with different gap heights |

- **Death sequence (220 ticks):** a horribly out-of-tune chord (`boss/m3-sour-chord`); pipes
  pop off one by one like corks; the Maestro is launched out of the centre pipe and flies off the
  top of the screen while his sheet music rains down.
- **Score:** 70,000 + parts (each pipe bank 3,000, bell 3,000).

### 10.4 m4 boss — `golden-colossus` — THE COLOSSUS OF FANFARON
- **Concept:** a walking hill-sized statue of the Archduke, still wrapped in scaffolding, driven by
  the master sculptor Lady Philippa Chisel from a cockpit inside the crown. It brings the GILDED
  status into a boss fight.
- **Look (200×208):** gold paint over grey concrete (chips show grey), a huge pompadour with a crown,
  a red monocle lens, a stone cape, wooden scaffold planks tied around the legs, a scepter cannon in
  the right hand, a fist on the left. Each step shakes the screen 2 px.
- **Arena (m4-c end, "Foundry Yard", camera lock):** floor y = 184; scaffold platforms (one-way,
  wood) at view x 24–96 (y 128) and x 112–168 (y 96). The colossus stays inside view x 176–384
  (left edge between 176 and 240). Weapon crate (M) at x 40, two `pickup-food` on the high platform.
- **Parts:** `scepter-arm` 140, `fist-arm` 140, `monocle` 120, `chest-furnace` 360 (core,
  phase 2+).

| Phase | Trigger | Attacks |
|---|---|---|
| 1 UNVEILING | start | **Scepter orbs:** T 40 (the scepter orb charges and glows) → 3 aimed golden orbs, 2.0 px/tick; each splits on the floor into 2 rolling coins (16 px tall, 1.2 px/tick, left and right) → R 60. **Fist slam:** T 45 (the fist rises above the player's x, shadow grows) → slam, crush 32 px wide + floor ripple both ways (8 px tall, 2 px/tick) → R 70 (fist stuck: ×1.5 damage). **Monocle laser** (every 360 ticks): T 50 (glint, a thin red aim line sweeps the floor) → a 12 px beam sweeps the floor right-to-left in 60 ticks (jump it or be on a platform) → R 80 |
| 2 THE GILDING | both arms destroyed | The chest plates swing open: a furnace. **Gilding breath:** T 40 (chest glows orange, hiss, gold drips) → gold mist cone 160×48 down-left for 60 ticks (GILDED; a second dose = statue death) → R 60. **Stomp walk:** it advances 32 px and returns. Monocle laser every 300 ticks while the monocle lives |
| 3 CRUMBLE | chest < 50 % | The legs crack; it falls to its knees and crawls toward the players (0.3 px/tick, never past view x 200). **Pompadour missiles:** T 30 (the hair splits open like a hatch) → 6 hairpin missiles that rise, then home weakly (2.0 px/tick, turn 2°/tick, 1 HP each) → R 90. **Crawl slam:** T 30 (the torso rears) → slams forward, crush 48 px in front of the chest → R 60 (chest ×1.5) |

- **Death sequence (240 ticks):** cracks spread; the gold paint flakes off in a shower of sparkles
  and shows grey concrete stamped `MADE IN A HURRY`; it crumbles into a pile; the head rolls to the
  front and stops facing the camera with a sheepish look; Lady Chisel climbs out of the crown and
  tiptoes away.
- **Score:** 80,000 + parts (arm 4,000 each, monocle 4,000).

### 10.5 m5 final boss — the FANFARONNE (3 stages)
The final boss is three linked fights with no checkpoint between them, but each stage start is a
respawn point (after a continue you restart the current stage with the parts already destroyed
staying destroyed). Music: `boss-final` throughout.

#### Stage 1 — `palace-prow` — THE FANFARONNE: PROW (flying, in Honkers)
- **Look (320×216 shown, extends past the right, top and bottom edges):** the front of the flying
  palace: white marble towers with purple roofs and gold domes, a gilded ram at the bottom, the
  main gate with the Archduke's crest (64×64) in the middle, two propeller pods (64×48, top and
  bottom), three prow turrets (24×16).
- **Arena:** end of m5-c. The auto-scroll stops; the cloud sea keeps scrolling (parallax only).
  Honkers fly freely. One weapon crate floats in at the start (T).
- **Parts:** `prop-pod-top` 120, `prop-pod-bottom` 120, `prow-turret-a/b/c` 50 each,
  `gate-core` 320.

| Phase | Trigger | Attacks |
|---|---|---|
| 1 SALUTE | start | **Turrets** (in turn): T 20 (turret light) → aimed fan of 3 shots, 2.2 px/tick → R 80. **Pods:** T 36 (propeller spins up, wind lines) → gust pushes Honkers 0.6 px/tick left for 90 ticks while the pod fires a ring of 8 bullets at 1.6 px/tick → R 120 |
| 2 OPEN THE GATES | both pods destroyed | The gate opens. **Gate beam:** T 50 (a charging line crosses the screen at the Honker's y, sparks gather) → beam 24 px tall across the whole screen for 40 ticks → R 90 (gate core exposed for these 90 ticks). **Fighter launch** (every 300 ticks): 4 `plume-fighter`s in a loop formation |
| 3 RAMMING SPEED | gate core < 40 % | **Ram:** T 40 (engines roar, shake 3 px) → the prow lunges 96 px left; the ram covers the right third of the view → R 60 (core ×1.5) → backs off. Gate beam every 240 ticks |

- **Transition (180 ticks, timer paused):** the prow crumbles, the palace tilts, the Honkers fly
  over the top and land on the throne deck; players hop out. Score 60,000 + parts (pod 4,000
  each, turret 1,000 each).

#### Stage 2 — `throne-walker` — THE THRONE WALKER (on foot)
- **Look (160×128):** the Archduke's giant golden throne with purple velvet cushions on four
  spindly ornate legs, a big parasol canopy with gatling barrels around its rim, a glass dome that
  can close over the seat. The Archduke sits on it with a golden remote. Speech bubbles:
  `BEHOLD ME!` `KNEEL!` `STOP THAT AT ONCE!`
- **Arena (m5-d "Throne Deck", camera lock):** marble floor y = 184 with a red carpet; floating
  balconies (one-way) at y 120, view x 32–96 and 288–352. The parked Honkers are decor. Weapon
  crate (L) at x 48.
- **Parts:** `canopy-gun` 160, `legs-front` 100, `legs-back` 100, `throne-seat` 320 (the dome
  protects it until phase 3).

| Phase | Trigger | Attacks |
|---|---|---|
| 1 ROYAL PROCESSION | start | Walks left and right across the arena at 0.8 px/tick. **Canopy gatling:** T 30 (the parasol spins faster, barrels glow) → a spiral of 12 bullets over 60 ticks, 1.6 px/tick → R 90. **Stomp hop:** T 40 (crouches; a shadow grows at the player's x) → hops there (60-tick arc), crush 64 px + small floor ripple → R 60. **Red carpet** (every 420 ticks): T 30 (a servant runs in and kicks it) → a rolling carpet runs right-to-left along the floor at 2.0 px/tick carrying 3 small bombs (16 px tall; jump it) |
| 2 MIDAS MIST | canopy gun destroyed | The dome closes. **Midas mist:** T 40 (nozzles under the seat hiss gold) → gold mist fills the bottom 24 px of the arena for 90 ticks (GILDED; stand on a balcony) → R 90. Each time, a banquet tray drops 2 `pickup-food` (cake) at view x 64 and 320. Stomp hop every 240 ticks |
| 3 THRONE ROCKETS | both leg pairs destroyed | The legs snap; rockets ignite under the seat and it hovers (y 80–140); the dome opens. **Royal decree:** T 30 (the Archduke unrolls a scroll) → 5 scroll-shaped shots in a wide fan, 1.8 px/tick → R 60. **Dive:** T 40 (rockets flare, a target marker on the floor) → dives onto the marker, crush 64 px → R 90 (stuck, seat ×1.5) |

- **Transition (150 ticks):** the throne breaks; the Archduke scrambles up a golden ladder into
  the giant lens above the deck; the deck tilts and the right 64 px crumble away. Score 80,000 +
  parts (canopy 4,000, legs 3,000 each).

#### Stage 3 — `moonface-lens` — THE MOONFACE LENS (desperation)
- **Look (192×192 lens + rim):** a huge round lens in a gold frame rising above the deck, 4 mirror
  panels (32×32) at the top, right, bottom-right and left of the rim, the core cockpit (48×48) in
  the centre with the Archduke inside; his face is projected huge on the lens (a comic grimacing
  mask that changes expression). Behind it: a night sky with a giant full Moon.
- **Arena:** the same deck, now 320 px wide (right part gone = `pit`), balconies stay. A weapon
  crate (R) drops at the start.
- **Parts:** `mirror-a/b/c/d` 80 each, `lens-core` 500 (shots ping off with sparks while 2 or
  more mirrors live).

| Phase | Trigger | Attacks |
|---|---|---|
| 1 FOCUS | start | Mirrors fire in turn. **Mirror beam:** T 30 (the mirror turns and flashes) → a thin 2 px beam aimed at the player for 20 ticks → R 90. **Portrait drones** (every 300 ticks): 3 picture-frame drones (24×20, 6 HP, 300 points each) fly out; each: T 16 → 1 shot 2.0 px/tick → R 90 |
| 2 MOONBEAM | ≤ 1 mirror left | The core opens. **Moonbeam sweep:** T 60 (concentric rings shrink on the lens, a target line crosses the floor) → a 32 px beam slams down and sweeps the floor left-to-right in 90 ticks (jump through it or stand on a balcony) → R 90. **Ego burst:** T 30 (the projected face grins) → 16 crown-shaped bullets in a ring, 1.4 px/tick → R 60 |
| 3 FINAL FANFARE | core < 30 % | The music drops to a heartbeat drum. The lens turns to the Moon and a **1200-tick charge ring** fills around the rim (the only boss gauge in the game). Bubble: `ONE LAST LOOK AT ME!` Ego burst every 120 ticks, two moonbeams 45 ticks apart. **If the ring fills:** the beam misfires into the deck: white flash, every player loses a life, the core heals 10 %, and the ring restarts |

- **Death sequence (= ending trigger, 360 ticks):** the core cracks; one last beam fires upward,
  bounces off a cracked mirror and carves a giant swan into the Moon; the palace starts to sink;
  white-out to the ending (section 13.10).
- **Score:** 150,000 + parts (mirror 3,000 each) + `FINAL BONUS` (section 14).

---

## 11. Missions

### 11.0 Notation and shared level rules
- Section ids are `m<n>-<letter>` (route variants `b1`/`b2`). Sizes are `width×height` px.
- Ground heights are y values of the ground line. `gap a–b` = a pit (or deep water) between x a and b.
- Wave tables: **Trigger** = `cam≥X` (camera left edge), `lock`, `t+N` (ticks after the previous
  trigger), `dead(...)`. **Spawns** list `count × id @ x (y) from`, where `from` is `R` (enters
  from the right edge), `L` (from the left edge, a surprise), `top`, or `place` (already standing
  there, idle). Rows marked **vet** only spawn on VETERAN.
- Every hostage row names its item. "feather" = `pickup-gem` kind `golden-feather`.
- Exits: `exit → section` with a rect `x0–x1, y0–y1`. Every section change uses a 30-tick fade and
  resets the timer to the new section's value.
- Every section ends in an exit rect. Every mission ends with a boss arena: `lock x0–x1`
  (camera fixed), boss spawn, `MISSION COMPLETE` on the boss's death sequence end.
- Generic background ids are those of the art agent (`sky-gradient`, `clouds`, `mountains`,
  `hills`, `treeline`, `jungle`, `city`, `ruins`, `dunes`, `ice-peaks`, `sea`). Custom generators
  that missions register are marked *(custom)* with a one-line spec.

### 11.1 m1 — HAVERWICK HARBOUR (OPERATION WAKE-UP CALL)
- **Biome & mood:** a seaside town at dawn. Peach-pink sky fading to pale blue, teal sea,
  terracotta roofs, grey stone quays, white gulls, bunting everywhere (the Legion's "victory
  parade" decorations).
- **Music:** `m1`; `mini-boss` (parade float); `boss` (showboat).
- **Flow:** `m1-a` → branch (`m1-b1` rooftops | `m1-b2` canals) → `m1-c` → boss `showboat`.
- **Hostages per route:** 10. **Feathers:** a, b1/b2, c (one each).

#### m1-a "Fish Market Quay" — 2560×216, scroll right, timer 60
- **Terrain:** ground y 184 from x 0–560 (sand decor in front), stone ramp up to y 168 at x 620,
  quay y 168 to x 1780, `gap 1780–1816` (deep water), quay y 168 to x 2560. Market awnings
  (one-way) at y 136: x 760–824, 880–944, 1000–1064. Warehouse roof (solid) x 1450–1530, top y 120.
  Crate tower steps (solids) at x 2400 (top y 152), 2424 (136), 2448 (120), 2472 (104); balcony
  (one-way) y 96, x 2464–2560.
- **Background:** `sky-gradient` (peach `#f4b38a` at the horizon → pale blue top, factorX 0),
  `clouds` (pink-lit, factorX 0.1), `sea` (teal, horizon y 120, factorX 0.2), `city` (far
  terracotta roofs and a lighthouse silhouette, warm grey, factorX 0.35), *(custom)* `harbour`
  (piers, moored fishing boats with striped sails, gull sprites, factorX 0.6).
- **Terrain style:** ground `concrete`, edge `tiles`, platform `wood`, solid `crate`.
- **Checkpoints:** x 1200, 1920.

| Trigger | Spawns / events |
|---|---|
| start | The squad's tiny rowboat bumps the quay steps (decor at x 40); players `spawn` at x 64. Card `MISSION 1` → `START!`; voice `MISSION ONE. FLY LOW!` |
| cam≥0 | 2 × `rifleman` @ 300, 332 place (gag: polishing medals, facing left) |
| cam≥80 | `hostage` tied (baker) @ 430 → `pickup-weapon` machine-gun |
| cam≥160 | 3 × `rifleman` from R (30 ticks apart); 1 × `grenadier` @ 640 place |
| cam≥300 | Gag: 1 × `rifleman` runs in from R in `panic`, chased by 3 × `honk-goose` |
| cam≥420 | `crate` @ 792 (on the awning) → `pickup-bombs`; 2 × `rifleman` crouch behind a fish stall (solid 16 px) @ 830 |
| cam≥520 | `troop-lorry` from R, stops @ 1000, cargo 5 × `rifleman`; `fanfaron-statue` @ 940 |
| cam≥640 | 1 × `shield-guard` from R; 2 × `rifleman` @ 900, 1020 on the awnings |
| cam≥760 | Gag tableau: 1 × `drum-major` @ 1180 posing with 3 × `rifleman` @ 1120–1160 for a court painter (decor NPC who flees). They notice at 120 px or on a shot |
| cam≥880 | 1 × `gyrocopter` from R, y 56 |
| cam≥960 | `hostage` walker (postal worker) @ 1320 → `pickup-weapon` shotgun |
| cam≥1040 | 1 × `tuba-gunner` @ 1490 on the warehouse roof; 4 × `rifleman` from R in pairs, 60 ticks apart. **vet:** 2 × `rifleman` from L |
| cam≥1200 | **lock 1200–1584** "Bandstand Plaza": `gazebo-gun` @ 1480; `crate` @ 1260 → `pickup-weapon` rocket-launcher; 1 × `grenadier` @ 1540 (roof); 3 × `rifleman` from R every 150 ticks (max 9) until the gazebo dies → unlock |
| cam≥1400 | 1 × `blimp-bomber` from R, y 40 (drops 2 parasol troopers) |
| cam≥1600 | 3 × `parasol-trooper` from top @ 1820, 1880, 1940 |
| cam≥1700 | 4 × `honk-goose` from R (stampede, 10 ticks apart) |
| cam≥1800 | `hostage` caged (lighthouse keeper), cage on a crane hook @ 2100 (y 120) → `pickup-bombs` |
| cam≥1880 | `hostage` hidden in a fish barrel @ 2240 → feather #1 |
| cam≥1900 | 2 × `rifleman` + 1 × `shield-guard` from R; 1 × `grenadier` @ 2424 on the crate tower |
| cam≥2000 | Sign decor @ 2360: `ROOFTOPS ↑   CANALS →` |
| exits | `→ m1-b1` rect 2464–2560, 64–96 (top of the crate tower) · `→ m1-b2` rect 2536–2560, 120–168 (canal gate at ground level) |

#### m1-b1 "Rooftop Run" (upper route) — 2048×216, scroll right
- **Terrain:** pitched roofs as ground polylines (slopes 1:2), roof tops alternating y 120–152;
  pits between houses: `gap 344–376`, `gap 688–728`, `gap 1088–1120`, `gap 1528–1560`. Chimneys
  (solids 16×24) at x 260, 610, 1180 (breakable decor version at 1180). Laundry lines (one-way)
  y 88: x 400–480, 820–900. Bell tower (solids) x 980–1040, top y 72.
- **Background:** `sky-gradient` (pale yellow → blue), `clouds`, `sea` (factorX 0.15), `city`
  (terracotta roofs and chimneys, factorX 0.5).
- **Terrain style:** ground `concrete`, edge `tiles`, platform `wood`, solid `brick`.
- **Checkpoints:** x 760, 1440. Start: x 32, y 120.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 2 × `rifleman` @ 240, 300 place |
| cam≥100 | 1 × `gyrocopter` from R |
| cam≥200 | `hostage` tied (tourist) @ 420 → `pickup-weapon` flamethrower |
| cam≥300 | 3 × `parasol-trooper` from top; 1 × `grenadier` @ 620 in a dormer (y 104) |
| cam≥420 | Gag: 4 × `rifleman` hop across the roofs from R; the 3rd misses the gap and falls with a yelp |
| cam≥560 | 1 × `blimp-bomber` from R (carpet bombs on the roofs) |
| cam≥700 | 1 × `tuba-gunner` @ 1010 on the bell tower; 2 × `shield-guard` @ 900, 960 |
| cam≥840 | `hostage` caged (street musician) hanging under the bell tower @ 1010 (y 96) → `pickup-gem` sapphire |
| cam≥900 | Breakable chimney @ 1180 (6 HP) → `hostage` hidden → feather #2 |
| cam≥960 | 1 × `gyrocopter` from L (surprise), 1 × `gyrocopter` from R |
| cam≥1100 | 1 × `drum-major` @ 1400 + 4 × `rifleman` from R. **vet:** 1 × `grenadier` @ 1460 |
| cam≥1300 | `fanfaron-statue` @ 1560 with 3 × `rifleman` saluting it (place); `crate` @ 1620 → `pickup-weapon` machine-gun |
| cam≥1500 | 4 × `honk-goose` from R (rooftop geese) |
| exit | `→ m1-c` rect 2016–2048, 80–184 (roofs step down to the quay) |

#### m1-b2 "Canal Locks" (lower route) — 2048×216, scroll right
- **Terrain:** walkway y 176. Canal 1 `gap 400–560` (deep water) crossed by 2 `barge`s (128×24,
  moving x 400–560, 1.0 px/tick, out of phase). Lock gates (solids 16×40) at x 392 and 568.
  Bridge (one-way) y 112 x 900–1000. Canal 2 `gap 1200–1400` with 2 barges. Lock-keeper house
  (solid) x 1080–1140, top y 128.
- **Background:** `sky-gradient`, `city` (tall narrow canal houses with stepped gables, brick red
  and cream, factorX 0.4), *(custom)* `canal` (water surface band with moored boats, factorX 0.8).
- **Terrain style:** ground `concrete`, edge `moss`, platform `wood`, solid `brick`.
- **Checkpoints:** x 760, 1440. Start: x 32, y 176.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | Gag: 3 × `rifleman` @ 240–300 place, fishing with rods (drop them when alerted) |
| cam≥120 | 1 × `patrol-launch` in canal 1 (patrols x 410–550) |
| cam≥200 | 2 × `rifleman` riding the barges |
| cam≥360 | `hostage` tied (grandmother) @ 640 → `pickup-weapon` homing |
| cam≥440 | `troop-lorry` from R, stops @ 860, cargo 3 × `rifleman` + 1 × `shield-guard` |
| cam≥600 | 2 × `grenadier` on the bridge @ 920, 980 |
| cam≥740 | `gazebo-gun` (mortar) on the lock-keeper house @ 1110 |
| cam≥860 | 2 × `patrol-launch` in canal 2; 2 × `rifleman` on its barges |
| cam≥1000 | `hostage` walker (street musician) @ 1480 → `pickup-bombs` |
| cam≥1040 | Breakable rain barrel @ 1560 → `hostage` hidden → feather #2 |
| cam≥1200 | 1 × `blimp-bomber` from R |
| cam≥1400 | 1 × `drum-major` + 3 × `rifleman` from R; 2 × `honk-goose` cross from L. **vet:** 1 × `shield-guard` from R |
| cam≥1560 | `crate` @ 1700 → `pickup-weapon` machine-gun |
| exit | `→ m1-c` rect 2016–2048, 100–176 |

#### m1-c "Lighthouse Quay" — 2688×216, scroll right (boss at the end)
- **Terrain:** quay y 176. Shipping containers (solids 64×32) at x 1000–1064 (2 high, top y 112),
  1128–1192 (1 high, top y 144), 1640–1704 (3 high, top y 80: feather on top). Arena x 2304–2688:
  quay y 176 to x 2536, deep water from x 2536 (see 10.1).
- **Background:** `sky-gradient` (morning blue), `clouds`, `sea` (factorX 0.3), *(custom)*
  `harbour` (factorX 0.6), lighthouse decor at x 2200 (behind).
- **Terrain style:** ground `concrete`, edge `tiles`, platform `metal`, solid `metal`.
- **Checkpoints:** x 960, 1440, 2304 (boss).

| Trigger | Spawns / events |
|---|---|
| start | `swan` @ 256 under a tarp; the tarp blows away when a player comes within 64 px (`vehicle/swan-honk`, voice `SWAN, READY TO WADDLE!`) |
| cam≥120 | 4 × `rifleman` from R (50 % panic at the sight of a Swan) |
| cam≥240 | 1 × `bunting-tank` from R, stops @ 700 |
| cam≥360 | 2 × `gyrocopter` from R; 3 × `rifleman` from R |
| cam≥480 | `crate` @ 860 → `pickup-repair`; `hostage` tied (scientist) @ 920 → `pickup-weapon` laser |
| cam≥600 | `troop-lorry` from R, stops @ 1100, cargo 2 × `grenadier` + 4 × `rifleman` |
| cam≥760 | 2 × `tuba-gunner` on the containers @ 1030, 1160 |
| cam≥900 | 5 × `honk-goose` from R |
| cam≥1024 | **lock 1024–1408**: mini-boss `parade-float` drives in from R to @ 1250 (music `mini-boss`, timer 99) → unlock on death; `crate` @ 1060 → `pickup-bombs` |
| cam≥1440 | 2 × `bunting-tank` from R, stop @ 1800 and 1900 (240 ticks apart); 4 × `rifleman` from L (surprise). **vet:** 2 × `rifleman` from L |
| cam≥1600 | 1 × `blimp-bomber` from R; `hostage` caged on a crane @ 1760 (y 120) → `pickup-weapon` machine-gun; feather #3 on top of the container stack @ 1672 (y 72) |
| cam≥1800 | Gag: `fanfaron-statue` @ 2000 with 4 × `rifleman` polishing it (place) |
| cam≥1900 | `hostage` tied (lighthouse keeper) @ 2100 → `pickup-bombs` |
| cam≥2304 | **lock 2304–2688** boss arena; `crate` @ 2328 → `pickup-weapon` rocket-launcher; boss `showboat` steams in from the right (section 10.1) |

### 11.2 m2 — THE SNAPWATER DELTA (OPERATION MUDDY BOOTS)
- **Biome & mood:** a steamy mangrove delta at midday. Hazy white-yellow sky, misty blue-green
  far jungle, deep greens, orange flowers, brown-green water, Legion bunting rotting on the trees.
- **Music:** `m2` (a, c1, c2, d approach); `m2-river` (b, the boat run); `mini-boss` (peacock);
  `boss` (riverhorse).
- **Flow:** `m2-a` → `m2-b` (Paddler run) → branch (`m2-c1` canopy on foot | `m2-c2` caves, keep
  the boat) → `m2-d` → boss `riverhorse`.
- **Hostages per route:** 10 (+1 VIP that counts double). **Feathers:** a, b, c1/c2.

#### m2-a "Mangrove Landing" — 2304×216, scroll right, timer 60
- **Terrain:** mud ground y 180 with low mounds (±12 px slopes). Boardwalks (one-way) y 136:
  x 600–760, 1300–1460. Root tangles (solids 16–32 px high) at x 450, 1050, 1720. `gap 880–920`
  (deep pool). `gap 1640–1690` with one `lily-pad` at x 1650. Dock: ground y 168 x 2100–2200,
  deep water from x 2200 to the end (the river).
- **Background:** `sky-gradient` (hazy white-yellow → turquoise), `jungle` (far, misty
  blue-green, factorX 0.2), `jungle` (near, dark green with orange flowers, factorX 0.5).
- **Terrain style:** ground `mud`, edge `moss`, platform `wood`, solid `rock`.
- **Checkpoints:** x 960, 1600. Start: x 48, y 180.

| Trigger | Spawns / events |
|---|---|
| start | Card `MISSION 2` → voice `MISSION TWO. MIND THE FROGS!` |
| cam≥0 | 2 × `rifleman` @ 280, 320 place (gag: slapping mosquitoes) |
| cam≥60 | `hostage` tied (botanist, scientist preset with a pith helmet) @ 360 → `pickup-weapon` machine-gun |
| cam≥140 | 3 × `spit-frog` hidden in foliage @ 520, 560, 640 |
| cam≥240 | 3 × `rifleman` from R; 1 × `grenadier` @ 700 on the boardwalk |
| cam≥360 | 1 × `war-boar` from R (first boar) |
| cam≥440 | `crate` @ 760 → `pickup-bombs`; 1 × `lancer` from R (first lancer) |
| cam≥520 | 2 × `spit-frog` in the pool @ 890, 910 (only eyes show) |
| cam≥600 | `troop-lorry` from R (mud-spattered), stops @ 1100, cargo 4 × `rifleman` + 2 × `lancer` |
| cam≥700 | 2 × `sapper-mole` from R (first moles) |
| cam≥820 | `hostage` walker (tourist) @ 1180 → `pickup-weapon` shotgun |
| cam≥900 | 2 × `torchbearer` from R (first torchbearers); `fanfaron-statue` @ 1240 (overgrown with vines) |
| cam≥1000 | 3 × `parasol-trooper` from top; gag: the 2nd one's parasol snags on a branch @ 1290 and he dangles (still shoots) |
| cam≥1100 | 1 × `drum-major` @ 1440 on the boardwalk + 4 × `rifleman` from R. **vet:** 1 × `torchbearer` from R |
| cam≥1200 | `hostage` caged on a tree branch @ 1380 (y 100) → `pickup-weapon` flamethrower |
| cam≥1400 | 2 × `war-boar` from R, 120 ticks apart |
| cam≥1500 | 2 × `gyrocopter` from R |
| cam≥1700 | Hollow log (breakable, 6 HP) @ 1820 → `hostage` hidden → feather #1 |
| cam≥1760 | 3 × `sapper-mole` + 2 × `rifleman` from R |
| cam≥1900 | 1 × `patrol-launch` in the river (x 2200+); `crate` @ 2080 → `pickup-bombs` |
| cam≥1920 | `paddler` @ 2224 on the water (one per player); voice `PADDLER, ALL ABOARD!` |
| exit | `→ m2-b` rect 2272–2304, 140–200 (river mouth; triggers on a driven `paddler`) |

#### m2-b "Paddler Run" (vehicle section) — 3584×216, auto-scroll right 0.8 px/tick, timer 99
- **Terrain:** the whole section is deep water (surface y 184; the `paddler` rides it). Stilt huts
  (one-way decks y 136 on solid posts) at x 900–980, 1940–2020, 2500–2620. Rope bridges (one-way)
  y 96 at x 1460–1560. Floating logs (solid obstacles 48×12, 10 HP, hop or shoot) at x 1100, 2150.
  The auto-scroll stops at cam 3200 (the fork is a still screen). Fork: a high dock (ground)
  y 120 at x 3400–3480 with a rope ladder; cave mouth at x 3552–3584 at water level.
- **Background:** `sky-gradient`, `jungle` (far, factorX 0.15), `jungle` (riverbank, factorX 0.45),
  *(custom)* `river` (brown-green water band with ripples and floating leaves, bottom 40 px,
  factorX 1.0).
- **Terrain style:** ground `mud`, edge `moss`, platform `wood`, solid `rock`.
- **Checkpoints:** x 1280, 2304 (new Paddlers float in for players without one).

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 3 × `river-mine` @ 500, 560, 640 |
| cam≥120 | 1 × `patrol-launch` from R |
| cam≥240 | 4 × `spit-frog` leap out of the water @ 700–800 (one every 30 ticks) |
| cam≥360 | Stilt hut @ 900: 3 × `rifleman` + 1 × `tuba-gunner` (place) |
| cam≥480 | 2 × `gyrocopter` from R |
| cam≥700 | `hostage` caged on a buoy @ 1250 (6 HP; when freed the hostage swims to the nearest Paddler, climbs the canopy, hands over the item, dives off) → `pickup-repair` |
| cam≥800 | 2 × `patrol-launch`: one from R, one from L (surprise) |
| cam≥960 | Rope bridge @ 1460–1560: 4 × `rifleman` + 1 × `grenadier` (drops bombs straight down) |
| cam≥1100 | 1 × `blimp-bomber` from R |
| cam≥1250 | Mine field: 6 × `river-mine` @ 1700–1900 (every 40 px) |
| cam≥1400 | `hostage` tied on the stilt hut deck @ 1980 → `pickup-bombs` |
| cam≥1500 | 3 × `spit-frog` from the water @ 2000–2100 |
| cam≥1800 | 2 × `patrol-launch` from R; 1 × `gyrocopter` from R |
| cam≥2000 | Stilt fort @ 2500–2620: 2 × `tuba-gunner` + 1 × `torchbearer` + 2 × `rifleman` (place) |
| cam≥2200 | Floating barrel (6 HP) @ 2800 → `hostage` hidden → feather #2 |
| cam≥2400 | **vet:** 1 × `patrol-launch` from L |
| cam≥2600 | 1 × `blimp-bomber` from R; 4 × `river-mine` @ 3000–3120 |
| cam≥3000 | Sign @ 3300 on the island rock: `CANOPY ↑   CAVES →` |
| exits | `→ m2-c1` rect 3420–3480, 80–120 (climb the ladder; the boat stays behind) · `→ m2-c2` rect 3552–3584, 150–200 (sail into the cave; the boat comes along) |

#### m2-c1 "Canopy Walk" (upper route, on foot) — 2304×216, scroll right
- **Terrain:** wide branches as ground at y 152–168 with frequent pits to the forest floor (`kill`
  at y ≥ 216): `gap 280–312`, `gap 540–600` (rope bridge one-way y 140 across it), `gap 980–1010`,
  `gap 1300–1360` (rope bridge), `gap 1900–1940`. Treehouses (solids `crate`) at x 680–760 (top
  y 112), 1160–1240 (top y 104). Arena x 1500–1884: floor y 168, branch platforms (one-way) y 136
  at x 1560–1620, 1700–1760, 1820–1870.
- **Background:** `sky-gradient` (bright green-blue), `jungle` (canopy tops, factorX 0.3), `jungle`
  (big trunks, factorX 0.6).
- **Terrain style:** ground `dirt`, edge `moss`, platform `wood`, solid `crate`.
- **Checkpoints:** x 800, 1500. Start: x 32, y 120 (top of the ladder).

| Trigger | Spawns / events |
|---|---|
| cam≥0 | `hostage` tied (birdwatcher, tourist preset with binoculars) @ 200 → `pickup-weapon` whizbang |
| cam≥100 | 3 × `parasol-trooper` from top; 2 × `rifleman` @ 420, 470 place |
| cam≥240 | 3 × `spit-frog` @ 640, 700, 860 |
| cam≥360 | 2 × `gyrocopter` from R; 1 × `tuba-gunner` (aa) @ 720 on the treehouse |
| cam≥500 | Gag: 4 × `rifleman` march across the rope bridge @ 1300 in step, singing (text bubbles) |
| cam≥600 | `hostage` vip in a gold cage hanging @ 1000 (y 96) → `pickup-1up` |
| cam≥700 | 2 × `lancer` from R along the long branch |
| cam≥820 | 2 × `torchbearer` + 1 × `drum-major` @ 1300 from R |
| cam≥960 | Bird's nest (breakable, 6 HP) @ 1200 (y 80) → `hostage` hidden → feather #3 |
| cam≥1100 | `crate` @ 1450 → `pickup-weapon` machine-gun. **vet:** 2 × `grenadier` @ 1480 |
| cam≥1500 | **lock 1500–1884**: mini-boss `peacock-sentinel` glides down from the top right (music `mini-boss`, timer 99) → unlock on death |
| cam≥1900 | 2 × `spit-frog` + 3 × `rifleman` from R |
| exit | `→ m2-d` rect 2272–2304, 100–168 (a vine slide down to the lagoon) |

#### m2-c2 "Root Caves" (lower route, keep the Paddler) — 2048×216, auto-scroll right 0.7 px/tick
- **Terrain:** underground river, surface y 184 (deep water everywhere). Low cave ceiling (solid)
  from y 0 to y 40 with stalactites. Rock ledges (solid tops) at x 600–700 (y 120), 1380–1460
  (y 128), 1700–1800 (y 120). A rock islet (ground y 168) at x 1080–1140.
- **Background:** *(custom)* `cave` (dark teal rock walls, glowing cyan mushrooms and roots,
  factorX 0.3), `ruins` (old carved temple pillars, mossy green-grey, factorX 0.6).
- **Terrain style:** ground `rock`, edge `moss`, platform `rock`, solid `rock`.
- **Checkpoints:** x 760 (new Paddlers float in for players without one).

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 4 × `river-mine` @ 300–420; 1 × `patrol-launch` from R |
| cam≥160 | 3 × `falling-icicle` (rock stalactite variant) @ 400, 460, 520 |
| cam≥280 | Ledge @ 600: 2 × `grenadier` + 1 × `rifleman` (place) |
| cam≥400 | `hostage` caged on the ledge @ 680 → `pickup-weapon` laser (stored until the player leaves the boat) |
| cam≥520 | 4 × `spit-frog` leap from the water |
| cam≥640 | 2 × `patrol-launch` from R |
| cam≥760 | `hostage` vip in a gold cage on the islet @ 1100 → `pickup-1up` |
| cam≥900 | Floating barrel (6 HP) @ 1300 → `hostage` hidden → feather #3 |
| cam≥1000 | Ledge @ 1380: 2 × `torchbearer` + 1 × `tuba-gunner` (place) |
| cam≥1150 | 5 × `river-mine` @ 1500–1660; floating `crate` @ 1560 → `pickup-repair` |
| cam≥1300 | **vet:** 1 × `patrol-launch` from L |
| cam≥1400 | Ledge @ 1700: 3 × `rifleman` + 1 × `grenadier` (place) |
| exit | `→ m2-d` rect 2016–2048, 120–200 (the cave opens into the lagoon) |

#### m2-d "Riverhorse Lagoon" — 768×216, scroll right
- **Terrain:** deep water everywhere (surface y 184). High pier (one-way platform on posts) y 136
  from x 0–560; Paddlers sail beneath it. Lily pads at x 580, 628, 676 (y 180). The arena is
  x 384–768 (see 10.2).
- **Background:** `sky-gradient` (late-afternoon gold), `jungle` (factorX 0.3), *(custom)* `river`.
- **Terrain style:** ground `mud`, edge `moss`, platform `wood`, solid `rock`.
- **Checkpoints:** x 384 (boss). Start: from c1 the players slide down vines onto the pier at
  x 40; from c2 the Paddlers sail in on the water at x 40, under the pier.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 2 × `rifleman` @ 260, 300 on the pier; 1 × `patrol-launch` from R; `crate` @ 200 (pier) → `pickup-bombs` |
| cam≥384 | **lock 384–768**; `crate` @ 410 (pier) → `pickup-weapon` shotgun; boss `riverhorse` surfaces |

### 11.3 m3 — MOUNT GRUMBELHORN (OPERATION COLD SHOULDER)
- **Biome & mood:** alpine peaks on a cold bright morning that turns into a blizzard near the
  summit. Icy blues, white, slate-grey rock, purple shadows, warm orange chalet windows.
- **Music:** `m3` (a, c1, c2, d approach); `m3-slope` (b, the Plowcat descent); `boss` (war organ).
- **Flow:** `m3-a` (vertical climb) → `m3-b` (Plowcat descent) → branch (`m3-c1` frozen falls |
  `m3-c2` observatory road) → `m3-d` → boss `war-organ`.
- **Hostages per route:** 10 (+1 VIP that counts double). **Feathers:** a, b, c1/c2.

#### m3-a "Funicular Cliffs" (vertical section) — 384×1728, scroll up, timer 60
- **Rules for vertical sections:** triggers use `camY≤Y` (the camera's top edge reaches y = Y or
  higher). The camera ratchets upward; falling below the bottom edge of the view = death (the
  player respawns on the lowest visible ledge). Checkpoints are **y** values (needs the mission
  runtime to accept `checkpoints` as y for `scroll: 'up'`).
- **Terrain:** rock ledges alternating left and right every ~90 px of height (ground segments and
  solid outcrops 96–200 px wide), one-way wooden scaffolds between them. Funicular: a `lift` car
  (64×12) on a diagonal rail from (48, 1360) to (300, 940), moving 1.0 px/tick while a player
  stands on it. Station platform (one-way) y 720, x 0–384. Summit platform y 120, x 200–384.
- **Background:** `sky-gradient` (pale icy blue → white, factorY 0), `ice-peaks` (far peaks,
  factorX 0, factorY 0.1), `mountains` (slate-blue cliffs, factorY 0.3), `clouds` (factorY 0.2).
- **Terrain style:** ground `rock`, edge `snow`, platform `wood`, solid `rock`.
- **Checkpoints (y):** 1360, 720. Start: (96, 1700).

| Trigger | Spawns / events |
|---|---|
| start | Card `MISSION 3` → voice `MISSION THREE. WRAP UP WARM!` |
| camY≤1512 | Gag: 2 × `rifleman` @ (300, 1640) building a snowman; `hostage` tied (mountain guide: red jacket, wool hat) @ (200, 1600) → `pickup-weapon` bouncer |
| camY≤1400 | 2 × `grenadier` @ (320, 1440) throwing bombs down; 1 × `helmet-ram` @ (80, 1380) (first ram) |
| camY≤1300 | 2 × `snow-boulder` roll down a slope from (360, 1250) |
| camY≤1200 | Funicular ride (about 490 ticks): 2 × `gyrocopter` from R, then 3 × `parasol-trooper` from top |
| camY≤900 | Top station: 3 × `rifleman` + 1 × `tuba-gunner` (aa) @ (100, 860) |
| camY≤820 | 3 × `falling-icicle` @ x 120, 200, 280 |
| camY≤760 | `hostage` caged hanging from the funicular cable @ (200, 780) → `pickup-weapon` machine-gun |
| camY≤700 | **vertical lock** (camera top fixed at y 560) "Station Platform": 2 × `gazebo-gun` @ (64, 720) and (320, 720); 2 × `rifleman` from the sides every 180 ticks until both turrets die; `crate` @ (192, 720) → `pickup-bombs` |
| camY≤520 | 2 × `helmet-ram` on ledges @ (60, 560) and (320, 480) |
| camY≤440 | 3 × `clockwork-hound` along the long ledge y 420 (first hounds) |
| camY≤360 | Snowman (breakable, 6 HP) @ (320, 380) → `hostage` hidden → feather #1 |
| camY≤300 | `hostage` vip in a gold cage @ (64, 240) → `pickup-1up` |
| camY≤240 | 1 × `drum-major` + 3 × `rifleman` on the summit platform; 1 × `blimp-bomber` crosses at the top of the view. **vet:** 2 × `helmet-ram` @ (300, 200) |
| exit | `→ m3-b` rect 320–384, 80–120 (the Plowcat garage on the summit) |

#### m3-b "The Long Slope" (vehicle section) — 4096×432, scroll right, vertical follow, timer 99
- **Terrain:** a long downhill: ground from y 200 at x 0 to y 400 at x 3712 in slopes of 1:6 to
  1:3 with bumps, two ramps and gaps: `gap 1400–1464`, `gap 2480–2530`. Snowbank (solid) at
  x 3880–3940 (stops the Plowcats). Final screen x 3712–4096 is flat at y 400 except a crevasse
  `gap 3780–3840` (the c1 entrance) and the road up at x 4040–4096.
- **Background:** `sky-gradient` (bright blue), `ice-peaks` (factorX 0.1), `mountains` (factorX
  0.25), *(custom)* `pines` (snow-laden fir trees, dark green with white caps, factorX 0.6).
- **Terrain style:** ground `snow`, edge `snow`, platform `wood`, solid `rock`.
- **Checkpoints:** x 1280, 2944. Spare Plowcats appear at checkpoints and at x 1500.

| Trigger | Spawns / events |
|---|---|
| start | Players start mounted in `plowcat`s @ 96 (one per player); voice `PLOWCAT! CLEAR THE ROAD!` |
| cam≥0 | `snow-wall` @ 400 and 700, each with 2 × `rifleman` behind it |
| cam≥200 | 4 × `rifleman` with param `ski: true` from L (they slide downhill at 2.0 px/tick and shoot backwards; surprise) |
| cam≥400 | 1 × `bunting-tank` from R, stops @ 1000 |
| cam≥560 | 3 × `snow-boulder` from L at 2.6 px/tick (shoot or outrun) |
| cam≥700 | 2 × `gyrocopter` from R |
| cam≥800 | `hostage` tied in a ski hut @ 1200 → `pickup-repair` |
| cam≥1100 | 1 × `mortar-coach` on a rock shelf @ 1700; 2 × `lancer` from R |
| cam≥1400 | Spare `plowcat` @ 1500 for any player on foot |
| cam≥1600 | **Avalanche set piece:** 120-tick warning (rumble, shake 2 px, falling snow, bubble `AVALANCHE!`), then a 64 px snow wall (`kill`) chases from the left edge at 1.6 px/tick until x 2900, where it smashes into a rock wall |
| cam≥1700 | `snow-wall` @ 2000, 2200, 2400 (plough through); 6 × `rifleman` flee ahead in `panic` (free points); 2 × `helmet-ram` from R |
| cam≥2100 | Snowed-in phone booth (breakable, 6 HP) @ 2600 → `hostage` hidden → feather #2 |
| cam≥2900 | `troop-lorry` (snow chains) from R, stops @ 3300, cargo 4 × `rifleman` + 2 × `grenadier`; 1 × `blimp-bomber` from R |
| cam≥3100 | 2 × `bunting-tank` from R (stop @ 3500, 3600). **vet:** 1 × `mortar-coach` from R |
| cam≥3300 | `hostage` caged on a ski-lift chair @ 3500 (y 300) → `pickup-weapon` rocket-launcher (stored while driving) |
| cam≥3712 | **lock 3712–4096**. The Plowcats crash into the snowbank (cutscene 90 ticks); players continue on foot. Sign: `FALLS ↓   OBSERVATORY →` |
| exits | `→ m3-c1` rect 3780–3840, 420–432 (jump into the crevasse) · `→ m3-c2` rect 4060–4096, 300–380 (road up to the observatory) |

#### m3-c1 "Frozen Falls" (lower route) — 2048×216, scroll right
- **Terrain:** a gorge with a frozen waterfall. Ice ground y 176 with **slippery zones** (start 12
  ticks to full speed, stop distance 24 px; needs an `ice` surface flag in physics, otherwise
  decor only). Frozen water columns (solids 32×80) at x 500, 1100, 1600. Ice ledges (one-way)
  y 120 at x 560–680, 1160–1280. `gap 820–860` and `gap 1400–1440` (icy water).
- **Background:** `sky-gradient` (grey-blue, falling snow), `ice-peaks` (factorX 0.2), *(custom)*
  `frozen-falls` (pale cyan ice curtains, factorX 0.5).
- **Terrain style:** ground `ice`, edge `snow`, platform `ice`, solid `rock`.
- **Checkpoints:** x 960. Start: x 48, y 176 (landing in the gorge).

| Trigger | Spawns / events |
|---|---|
| cam≥0 | `hostage` tied (ice fisherman) @ 240 → `pickup-weapon` homing; 2 × `rifleman` @ 330, 360 (gag: ice fishing) |
| cam≥160 | 3 × `clockwork-hound` from R |
| cam≥300 | 2 × `helmet-ram` on the ledge @ 600; 3 × `falling-icicle` @ 700, 760, 800 |
| cam≥480 | 2 × `torchbearer` from R (their flames melt nothing, but look great on ice) |
| cam≥640 | `hostage` caged hanging from an ice column @ 1100 (y 100) → `pickup-food` cake |
| cam≥760 | 1 × `drum-major` + 4 × `rifleman` from R |
| cam≥900 | 2 × `gyrocopter` from R; 1 × `tuba-gunner` @ 1220 on the ledge |
| cam≥1100 | Frozen block (breakable, 6 HP) @ 1500 → `hostage` hidden → feather #3 |
| cam≥1240 | 3 × `clockwork-hound` from L (surprise) + 2 × `lancer` from R. **vet:** 2 × `grenadier` @ 1700 |
| cam≥1500 | `crate` @ 1800 → `pickup-weapon` machine-gun |
| exit | `→ m3-d` rect 2016–2048, 100–176 |

#### m3-c2 "Observatory Road" (upper route) — 2304×216, scroll right
- **Terrain:** snowy village road y 180 with gentle slopes; chalets (solid roofs at y 112–128,
  one-way balconies y 136) at x 400–520, 980–1100; the observatory (solid, dome top y 72) at
  x 1600–1760 with a one-way gantry y 120 around it.
- **Background:** `sky-gradient` (deep blue with early stars), `ice-peaks` (factorX 0.15),
  `hills` (snowy, factorX 0.35), *(custom)* `village` (chalets with orange windows, factorX 0.6).
- **Terrain style:** ground `snow`, edge `snow`, platform `wood`, solid `brick`.
- **Checkpoints:** x 1100. Start: x 48, y 180.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | Gag: 4 × `rifleman` @ 260–340 in a snowball fight (they ignore you until shot or within 96 px) |
| cam≥120 | `hostage` tied (postal worker on skis) @ 420 → `pickup-weapon` flamethrower |
| cam≥240 | 1 × `mortar-coach` from R, stops @ 760; 3 × `parasol-trooper` from top |
| cam≥400 | 1 × `bunting-tank` from R, stops @ 900; 2 × `grenadier` on the chalet balcony @ 1000 |
| cam≥600 | `troop-lorry` from R, stops @ 1200, cargo 3 × `rifleman` + 2 × `shield-guard` + 1 × `torchbearer` |
| cam≥800 | 3 × `clockwork-hound` from R; `fanfaron-statue` @ 1300 (a snow sculpture of the Archduke — same behaviour) |
| cam≥960 | Chimney stack (breakable, 6 HP) @ 1060 (y 112) → `hostage` hidden → feather #3 |
| cam≥1100 | 1 × `gazebo-gun` (mortar) on the observatory gantry @ 1640; 2 × `tuba-gunner` @ 1700, 1740 on the gantry |
| cam≥1300 | `hostage` caged inside the telescope opening @ 1680 (y 96) → `pickup-weapon` laser |
| cam≥1500 | 1 × `blimp-bomber` from R; 4 × `rifleman` from R. **vet:** 1 × `bunting-tank` from R |
| cam≥1800 | 1 × `drum-major` + 2 × `lancer` from R; `crate` @ 2000 → `pickup-bombs` |
| exit | `→ m3-d` rect 2272–2304, 100–180 |

#### m3-d "Cathedral of Echoes" — 768×216, scroll right
- **Terrain:** stone floor y 184; arena x 384–768 with balconies (one-way) y 128 at x 408–488 and
  664–744 (view x 24–104 and 280–360).
- **Background:** *(custom)* `cathedral` (tall stained-glass windows in purple, gold and blue,
  stone arches, snow visible outside, factorX 0.3), dark stone sky colour.
- **Terrain style:** ground `concrete`, edge `tiles`, platform `wood`, solid `brick`.
- **Checkpoints:** x 384 (boss). Start: x 48, y 184.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 3 × `rifleman` in choir robes over their uniforms @ 220–300 (gag: singing scales); `crate` @ 160 → `pickup-bombs` |
| cam≥384 | **lock 384–768**; `crate` on the left balcony @ 430 → `pickup-weapon` laser; the organ wakes with a deafening chord: boss `war-organ` |

### 11.4 m4 — THE GILDED WASTES (OPERATION FOOL'S GOLD)
- **Biome & mood:** desert gold country at blazing noon, ending at a foundry at sunset. Amber and
  ochre sand, burnt-orange mesas, pale yellow sky, black iron girders, glowing molten gold.
- **Music:** `m4` (a, b2, c); `m4-train` (b1); `mini-boss` (rail howitzer); `boss` (colossus).
- **Flow:** `m4-a` (the Swan arrives by air) → branch (`m4-b1` gold train | `m4-b2` sandstorm flats)
  → `m4-c` → boss `golden-colossus`.
- **Hostages per route:** 11 (b1) or 12 (b2), +1 VIP. **Feathers:** a, b1/b2, c.
- **New this mission:** the GILDED status (section 4.11), introduced by a gag first (m4-c).

#### m4-a "Statue Quarry" — 2816×216, scroll right, timer 60
- **Terrain:** sand ground y 184 with dunes (slopes ±16 px). Quarry terraces (solids `rock`)
  x 900–1300 with tops at y 152 and 120. A giant stone hand (solid, top y 136) x 1500–1580.
  `gap 1700–1740` (quarry pit). Station x 2432–2816: gold train standing on the track, car roofs
  (solids) top y 136 from x 2560 onward; step crates at x 2600 (top y 160) and 2640 (top y 144).
- **Background:** `sky-gradient` (pale yellow → hot white-blue), `dunes` (far, amber, factorX
  0.15), *(custom)* `mesas` (burnt-orange flat-topped rocks, factorX 0.3), `ruins` (half-carved
  giant statue heads in scaffolding, factorX 0.55).
- **Terrain style:** ground `sand`, edge `sand`, platform `wood`, solid `rock`.
- **Checkpoints:** x 960, 1800. Start: x 48, y 184.

| Trigger | Spawns / events |
|---|---|
| start | Card `MISSION 4` → voice `MISSION FOUR. DON'T TOUCH THE GOLD!` |
| t+60 | A cargo plane crosses the sky (decor); a `swan` drops by parachute @ 192 (one per player in co-op); voice `SWAN DELIVERY!` |
| cam≥0 | Gag: 3 × `rifleman` @ 340–400 sunbathing on towels with sun reflectors |
| cam≥120 | `hostage` tied (prospector: wide hat, bandana) @ 480 → `pickup-weapon` machine-gun |
| cam≥240 | 2 × `war-boar` from R; 2 × `sapper-mole` from R |
| cam≥360 | 1 × `bunting-tank` from R, stops @ 900 |
| cam≥480 | 2 × `plume-fighter` strafing run (first, shadows telegraph) |
| cam≥560 | 2 × `grenadier` @ 1000 (y 120); 2 × `tuba-gunner` @ 1200 (y 152) |
| cam≥700 | `troop-lorry` from R, stops @ 1400, cargo 2 × `torchbearer` + 3 × `rifleman` + 1 × `shield-guard` |
| cam≥820 | `hive-launcher` @ 1290 (y 120): first `brass-bee` swarms |
| cam≥900 | `hostage` caged on a quarry crane @ 1450 (y 96) → `pickup-weapon` shotgun |
| cam≥1000 | 1 × `mortar-coach` from R, stops @ 1700 |
| cam≥1100 | `fanfaron-statue` (half finished) @ 1600 + 1 × `drum-major` + 4 × `rifleman` |
| cam≥1200 | Giant stone nose (breakable, 6 HP) @ 1520 → `hostage` hidden → feather #1 |
| cam≥1400 | 3 × `clockwork-hound` from R; 2 × `gyrocopter` from R |
| cam≥1600 | `hostage` walker (geologist) @ 2000 → `pickup-weapon` homing |
| cam≥1800 | 2 × `bunting-tank` from R, stop @ 2300 and 2400. **vet:** 1 × `mortar-coach` from R |
| cam≥2000 | 1 × `blimp-bomber` from R |
| cam≥2432 | **lock 2432–2816** (still screen, the station): 3 × `rifleman` on the car roofs; sign `TRAIN ↑   DESERT →`. The train whistles every 240 ticks (`env/train-whistle`) |
| exits | `→ m4-b1` rect 2700–2816, 100–136 (on the car roofs; the Swan can climb via the crates) · `→ m4-b2` rect 2784–2816, 150–184 (the desert road under the station sign) |

#### m4-b1 "Gold Train" (upper route) — 3072×216, auto-scroll right 1.2 px/tick
- **Terrain:** the train is static terrain; the camera auto-scrolls and the background scrolls fast
  to sell the speed. Car roofs (solids) top y 136, cars 160 px long, 24 px gaps between cars
  (`kill` at y ≥ 200: the track). Ore hoppers (open cars, floor y 160, walls 8 px) at x 700, 1380,
  2060; flatbeds (top y 152) at x 880, 1960. Front car area x 2304–2688 is the mini-boss arena
  (the howitzer car is at x 2528–2688).
- **Background:** `sky-gradient` (late-afternoon amber), `dunes` (factorX 0.2 + constant drift
  2 px/tick), *(custom)* `mesas` (drift 1 px/tick), *(custom)* `telegraph-poles` (front layer,
  dark poles whizzing past, factorX 2.0).
- **Terrain style:** ground `metal`, edge `rust`, platform `metal`, solid `metal`.
- **Checkpoints:** x 1024, 2048.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 3 × `rifleman` on the roofs; 1 × `tuba-gunner` in the hopper @ 740 |
| cam≥200 | 2 × `gyrocopter` from R (they keep pace) |
| cam≥420 | **Low bridge #1:** T 60 (warning bell, `DUCK!` sign) → a girder sweeps everything higher than 28 px above the roofs (crouch; a crouching Swan scrapes under it and loses 1 cell) |
| cam≥480 | `hostage` tied on the flatbed @ 900 → `pickup-weapon` rocket-launcher |
| cam≥600 | 2 × `plume-fighter` strafe |
| cam≥760 | Troop car: 4 × `rifleman` + 1 × `shield-guard` pop out of roof hatches @ 1100–1200 |
| cam≥900 | 1 swarm of 8 × `brass-bee` from R |
| cam≥1000 | `hostage` caged in the ore hopper @ 1400 → `pickup-weapon` laser |
| cam≥1100 | **Low bridge #2** (same as #1) |
| cam≥1200 | 1 × `drum-major` + 3 × `lancer` on the roofs from R |
| cam≥1400 | Gold crate (breakable, 6 HP) @ 1800 → `hostage` hidden → feather #2 |
| cam≥1500 | 1 × `mortar-coach` riding the flatbed @ 1980 |
| cam≥1700 | 2 × `gyrocopter` + 3 × `parasol-trooper` from top |
| cam≥1900 | **vet:** 2 × `plume-fighter` strafe |
| cam≥2304 | **lock 2304–2688**: mini-boss `rail-howitzer` (music `mini-boss`, timer 99); `crate` @ 2340 → `pickup-bombs` → unlock on death (the car detaches and derails, tumbling away) |
| exit | `→ m4-c` rect 3040–3072, 80–136 (the train enters the foundry tunnel) |

#### m4-b2 "Sandstorm Flats" (lower route) — 2560×216, scroll right
- **Terrain:** dunes (slopes up to 1:2) on ground y 168–192. Old fort ruins (solids `brick`) at
  x 900–1100 with one-way ramparts y 120 and a tower (top y 72) at x 1040–1072. Oasis pool
  `gap 1700–1740` (deep water) under palm trees. Arena x 1600–1984 is mostly flat (y 184).
- **Background:** `sky-gradient` (dusty orange), `dunes` (far, factorX 0.2), `dunes` (near, factorX
  0.5), *(custom)* `sandstorm` (front layer, ochre streaks; normal alpha 0.15, storm pulse 0.6).
- **Sandstorm pulses:** every 600 ticks: T 60 (wind whistle `env/wind`) → 180 ticks of heavy storm
  (front layer alpha 0.6; enemy bullets get a 1 px bright outline so they stay readable).
- **Terrain style:** ground `sand`, edge `sand`, platform `wood`, solid `brick`.
- **Checkpoints:** x 960, 1984. Start: x 48, y 184.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 3 × `sapper-mole` from R; gag: 2 × `rifleman` @ 300 building a sandcastle shaped like the Archduke |
| cam≥160 | `hostage` tied (tour guide with a flag on a stick) @ 360 → `pickup-weapon` machine-gun |
| cam≥300 | 2 × `war-boar` from R; 2 × `plume-fighter` strafe |
| cam≥480 | Fort ramparts: 2 × `grenadier` + 2 × `tuba-gunner` @ 950–1080 (y 120) |
| cam≥640 | Storm pulse + 3 × `clockwork-hound` from R |
| cam≥800 | `hostage` caged on the fort tower @ 1056 (y 72) → `pickup-weapon` laser |
| cam≥900 | `troop-lorry` from R, stops @ 1400, cargo 4 × `rifleman` + 2 × `lancer` |
| cam≥1000 | `hive-launcher` @ 1300 |
| cam≥1100 | Buried treasure chest (breakable, 6 HP) @ 1500 → `hostage` hidden → feather #2 |
| cam≥1600 | **lock 1600–1984** "Oasis Ambush": 2 × `bunting-tank` from R (300 ticks apart) + 1 × `mortar-coach` from R; 1 × `rifleman` from R every 200 ticks (max 8) until all three machines die → unlock. `crate` @ 1640 → `pickup-repair`; `crate` @ 1680 → `pickup-weapon` rocket-launcher |
| cam≥2000 | Storm pulse + 3 × `sapper-mole` + 1 × `war-boar` from R. **vet:** 2 × `gyrocopter` |
| cam≥2200 | `hostage` walker (tour guide's assistant) @ 2400 → `pickup-bombs` |
| exit | `→ m4-c` rect 2528–2560, 100–184 (the foundry gate) |

#### m4-c "The Foundry" — 2560×216, scroll right (boss at the end)
- **Terrain:** iron floor y 184. Molten gold pools (`lava`): `gap 600–660`, `gap 1400–1480`
  (two ladle `lift`s cross it horizontally between x 1390 and 1490 at 0.8 px/tick, top y 168).
  Catwalks (one-way) y 112 x 1100–1300 and x 1650–1850. Gilding nozzles on walls at x 300, 900,
  980, 1750, 1800. Arena x 2176–2560: see 10.4.
- **Background:** `sky-gradient` (sunset red-orange through high windows), *(custom)* `foundry`
  (dark iron girders, glowing furnaces, rising sparks, factorX 0.4).
- **Terrain style:** ground `metal`, edge `rust`, platform `metal`, solid `metal`.
- **Checkpoints:** x 960, 1792, 2176 (boss). Start: from b1 the train rolls in and stops, players
  hop off at x 64; from b2 they walk in at x 32.

| Trigger | Spawns / events |
|---|---|
| cam≥0 | 3 × `rifleman` + 1 × `shield-guard`. **Teaching gag:** the nozzle @ 300 fires on a `rifleman` @ 320 first; he turns into a gold statue mid-salute (breakable, 500 points) |
| cam≥120 | `hostage` tied (foundry worker in overalls) @ 420 → `pickup-weapon` flamethrower; `crate` @ 520 → `pickup-food` banquet |
| cam≥240 | 2 × `torchbearer` from R |
| cam≥400 | 4 × `clockwork-hound` from R |
| cam≥520 | Nozzles @ 900, 980 active; 4 × `rifleman` from R |
| cam≥700 | `hive-launcher` @ 1200; 2 × `tuba-gunner` on the catwalk @ 1150, 1250 |
| cam≥860 | `hostage` caged in a ladle on a crane @ 1300 (y 96) → `pickup-weapon` homing |
| cam≥1000 | 1 × `bunting-tank` from R, stops @ 1700 |
| cam≥1200 | Casting mould (breakable, 6 HP) @ 1600 → `hostage` hidden → feather #3 |
| cam≥1300 | 1 × `drum-major` + 3 × `lancer` from R; nozzles @ 1750, 1800 active |
| cam≥1500 | `troop-lorry` from R, stops @ 2000, cargo 3 × `torchbearer` + 3 × `rifleman`. **vet:** 1 × `bunting-tank` from R |
| cam≥1700 | `hostage` vip in a gold cage @ 1950 → `pickup-1up` |
| cam≥1800 | 2 × `fanfaron-statue` @ 2050, 2100 with 4 × `rifleman` polishing them |
| cam≥2176 | **lock 2176–2560**; `crate` @ 2216 → `pickup-weapon` machine-gun; 2 × `pickup-food` cake on the high platform @ 2300, 2330; boss `golden-colossus` rises out of the casting pit |

### 11.5 m5 — THE PALACE ABOVE THE CLOUDS (OPERATION MOONRISE)
- **Biome & mood:** the Archduke's mountaintop launch palace at dusk, then the night sky above the
  clouds under a giant full Moon. Deep violet sky, pink-gold sunset, white marble, gold domes,
  purple banners, silver moonlit clouds.
- **Music:** `m5` (a, b); `m5-sky` (c); `mini-boss` (parade float reprise, carrier blimp);
  `boss-final` (palace prow at the end of c, then d).
- **Flow:** `m5-a` (Swan) → `m5-b` (vertical climb + elevator) → `m5-c` (Honker flight, ends with
  stage 1 `palace-prow`) → `m5-d` (stage 2 `throne-walker`, stage 3 `moonface-lens`) → ending.
- **Hostages:** 10. **Feathers:** a, b, c. No route branch (the finale is one straight run).

#### m5-a "Grand Promenade" — 2816×216, scroll right, timer 60
- **Terrain:** marble promenade y 184 with short grand stairs (1:1 slopes, ±24 px). Parade
  grandstands (one-way) y 136 at x 880–1020, 2180–2320. Fountains (solids 48×24) at x 640, 1220.
  Triumphal arch (solids, top y 72) x 1280–1360 with a one-way walkway y 112. Spire door at the end.
- **Background:** `sky-gradient` (violet top → pink-gold horizon), `clouds` (gold-lit, factorX 0.1),
  `mountains` (far purple, factorX 0.2), *(custom)* `palace-spires` (white marble towers, purple
  roofs, gold domes; the Fanfaronne floats far above, factorX 0.4).
- **Terrain style:** ground `concrete`, edge `tiles`, platform `metal`, solid `concrete`.
- **Checkpoints:** x 1024, 1792. Start: x 48, y 184.

| Trigger | Spawns / events |
|---|---|
| start | Card `FINAL MISSION` → voice `FINAL MISSION. MOONRISE IS COMING!`; `swan` @ 160 (one per player) |
| cam≥0 | Gag: 1 × `drum-major` leads 4 × `rifleman` in a parade rehearsal from R (they march in step until alerted) |
| cam≥80 | `hostage` tied (the court painter from m1, beret and palette) @ 380 → `pickup-weapon` machine-gun |
| cam≥200 | 1 × `bunting-tank` from R, stops @ 800; 4 × `honk-goose` (palace geese) from R |
| cam≥320 | Grandstand @ 900–1000: 3 × `tuba-gunner` (aa) + 2 × `grenadier` |
| cam≥440 | 2 × `gyrocopter` from R; 4 × `parasol-trooper` from top |
| cam≥560 | `troop-lorry` from R, stops @ 1200, cargo 2 × `shield-guard` + 2 × `torchbearer` + 2 × `lancer` |
| cam≥700 | 2 × `gazebo-gun` @ 1180, 1250 (fountain plaza) |
| cam≥800 | `hostage` caged hanging from the triumphal arch @ 1320 (y 96) → `pickup-bombs` |
| cam≥900 | 4 × `clockwork-hound` from R; `hive-launcher` @ 1380 |
| cam≥1408 | **lock 1408–1792**: mini-boss `parade-float` "Grand Finale Float" (+50 % HP, 3 `tuba-gunner`s on top); `crate` @ 1440 → `pickup-weapon` rocket-launcher → unlock on death; spare `swan` drops @ 1792 for any player on foot |
| cam≥1792 | 2 × `blimp-bomber` from R (120 ticks apart); 1 × `mortar-coach` from R |
| cam≥1900 | Swan-shaped topiary hedge (breakable, 6 HP) @ 2100 → `hostage` hidden → feather #1 |
| cam≥2000 | 2 × `plume-fighter` strafe; 2 × `bunting-tank` from R, stop @ 2400 and 2500 |
| cam≥2200 | `hostage` walker (royal gardener) @ 2500 → `pickup-weapon` whizbang |
| cam≥2300 | 3 × `fanfaron-statue` @ 2450, 2550, 2650 with 6 × `rifleman` saluting them. **vet:** `troop-lorry` from R, cargo 6 × `rifleman` |
| exit | `→ m5-b` rect 2784–2816, 120–184 (the spire door; the Swan cannot fit — it waves goodbye with its neck, 60-tick cutscene) |

#### m5-b "Hangar Spire" (vertical section) — 384×1944, scroll up, timer 60
- **Terrain:** shaft walls (solids) x 0–24 and 360–384. Freight elevator (`lift` 128×12) from
  y 1900 to y 1100 at 0.6 px/tick (≈ 1333 ticks) once a player stands on it. Side balconies
  (one-way, 48 px wide) every 120 px, alternating sides. Above y 1100: steel scaffolds and beams
  (one-way) zig-zagging up. Top hangar floor y 180 (x 24–360) for the last screen (y 0–216).
- **Background:** *(custom)* `hangar-shaft` (riveted purple steel, gold pipes, blinking red warning
  lights, factorY 0.5); `sky-gradient` (night) behind round windows.
- **Terrain style:** ground `metal`, edge `rust`, platform `metal`, solid `metal`.
- **Checkpoints (y):** 1100, 500. Start: (192, 1890) on the elevator.

| Trigger | Spawns / events |
|---|---|
| ride t+0 | Elevator starts. 2 × `rifleman` jump onto the left balcony (y 1700) |
| ride t+180 | 1 swarm of 8 × `brass-bee` from the top |
| ride t+300 | 2 × `grenadier` on the right balconies; 3 × `parasol-trooper` drop down the shaft |
| ride t+480 | 3 × `clockwork-hound` leap onto the elevator from a balcony |
| ride t+600 | `hostage` caged on the balcony @ (40, 1360) → `pickup-bombs` (the freed hostage hops onto the elevator to hand it over) |
| ride t+720 | 2 × `tuba-gunner` @ y 1300 (one per side) |
| ride t+800 | **vet:** 2 × `grenadier` on balconies |
| ride t+900 | 2 × `torchbearer` jump onto the elevator |
| ride t+1050 | 1 × `gyrocopter` (maintenance model) rises from below the elevator |
| camY≤900 | 2 × `lancer` charge along the beam y 980; toolbox (breakable, 6 HP) @ (320, 940) → `hostage` hidden → feather #2 |
| camY≤700 | `hostage` tied (palace mechanic) @ (80, 760) → `pickup-weapon` laser |
| camY≤600 | 1 × `drum-major` + 3 × `rifleman` @ y 640 |
| camY≤400 | 1 × `gazebo-gun` (mortar) @ (300, 440); `hive-launcher` @ (60, 420) |
| camY≤216 | **vertical lock** at the top hangar: 3 × `rifleman` guard the parked `honker`s @ (120, 180) and (220, 180). Board a Honker: the roof opens and the Honkers launch (cutscene 120 ticks) |
| exit | `→ m5-c` (automatic after the launch cutscene) |

#### m5-c "Sky Chase" (flying section) — 4608×216, auto-scroll right 1.0 px/tick, timer 99
- **Terrain:** none (open sky; the view edges bound the Honkers). Hazards are entities
  (`sky-mine`, aircraft). The scroll stops at locks.
- **Background:** `sky-gradient` (deep indigo → violet horizon), *(custom)* `moon` (huge full
  Moon, factorX 0.02), `clouds` (silver moonlit, factorX 0.15), *(custom)* `cloud-sea` (thick cloud
  floor at the bottom, factorX 0.6) and a front wisp layer (`clouds`, front, factorX 1.4, alpha 0.5).
- **Checkpoints:** x 1280, 2560 (respawns arrive in a new Honker from the left).

| Trigger | Spawns / events |
|---|---|
| start | Honkers fly in from the left; voice `HONKERS AWAY!` |
| cam≥0 | 5 × `plume-fighter` V formation from R |
| cam≥200 | 6 × `plume-fighter` snake (upper half) from R |
| cam≥360 | 6 × `sky-mine` drifting in a diagonal line |
| cam≥480 | 3 × `gyrocopter` from L (behind) |
| cam≥600 | 1 × `blimp-bomber` from R (at Honker height) + 2 × `parasol-trooper` |
| cam≥720 | Parachute `crate` → `pickup-weapon` machine-gun (Honker spread) |
| cam≥840 | 2 × loop of 4 `plume-fighter` (top and bottom) |
| cam≥960 | 2 swarms of 10 × `brass-bee` |
| cam≥1100 | `hostage` caged in a hot-air balloon basket (cage 6 HP; the hostage throws the item up to the nearest Honker) → `pickup-weapon` homing |
| cam≥1408 | **lock 1408–1792** (scroll pauses): mini-boss `carrier-blimp` (music `mini-boss`) → unlock on death |
| cam≥1800 | 2 × V of 5 `plume-fighter` |
| cam≥2000 | 3 mine curtains: columns of 4 `sky-mine` with one 48 px gap, 160 px apart |
| cam≥2200 | Floating barrel (6 HP) → `hostage` hidden (a stowaway) → feather #3 |
| cam≥2300 | 4 × `gyrocopter` + 6 × `plume-fighter` snake |
| cam≥2600 | Parachute `crate` → `pickup-bombs`; parachute `crate` → `pickup-repair` |
| cam≥2800 | 2 × `blimp-bomber` + 1 swarm of 10 × `brass-bee` |
| cam≥3000 | "Grand parade": 3 V formations of 5 `plume-fighter`, 90 ticks apart (a crown shape) |
| cam≥3300 | `hostage` tied on a floating rock islet (shoot the ropes) → `pickup-weapon` bouncer |
| cam≥3500 | **vet:** 2 × loop of 4 `plume-fighter` |
| cam≥3700 | The Fanfaronne grows on the horizon (background zoom by layer swap) |
| cam≥4000 | 8 × `sky-mine` + 5 × `plume-fighter` V |
| cam≥4224 | **lock 4224–4608**: final boss stage 1 `palace-prow` (music `boss-final`); parachute `crate` → `pickup-weapon` homing |
| exit | `→ m5-d` after the stage 1 transition cutscene (section 10.5) |

#### m5-d "Throne Deck" — 384×216, scroll free (locked single screen)
- **Terrain:** marble floor y 184 with a red carpet; balconies (one-way) y 120 at x 32–96 and
  288–352. Stage 3: the right 64 px become a `pit` (crumbled).
- **Background:** `sky-gradient` (night), *(custom)* `moon` (huge, behind the lens), `clouds`
  (moonlit), *(custom)* `palace-spires` (close).
- **Terrain style:** ground `concrete`, edge `tiles`, platform `metal`, solid `concrete`.
- **Script:** players hop out of the landed Honkers (decor) at x 96 → `crate` @ 48 →
  `pickup-weapon` laser → stage 2 `throne-walker` walks out of the palace doors to a fanfare →
  transition → `crate` @ 64 → `pickup-weapon` rocket-launcher → stage 3 `moonface-lens` → ending.

### 11.6 Ending flow
Final boss death → ending cutscene (13.10) → `MISSION COMPLETE` tally for m5 → final tally
(section 14) → credits roll → high-score name entry → title.

---

## 12. Audio

All sounds are synth recipes (`defineSfx`) and all songs are original tracker compositions
(`defineSong`). Instruments: pulse 12.5/25/50 %, triangle, saw, noise kick/snare/hat, FM bell,
pad. Descriptions below are recipes and intentions, not transcriptions of any existing music.

### 12.1 Sound effects (id → description)
**Weapons and bombs**
| id | Description |
|---|---|
| `weapon/pistol` | Pulse 25 % blip 1.2 kHz → 400 Hz in 60 ms + noise click |
| `weapon/machine-gun` | Punchy 40 ms noise burst + 90 Hz pulse thump; pitch ±5 % random per shot |
| `weapon/shotgun` | Wide noise blast 180 ms, low-pass sweep 6 kHz → 800 Hz, 70 Hz sub thump |
| `weapon/rocket` | Ignition pop, then band-pass noise whoosh rising 300 Hz → 2 kHz over 400 ms |
| `weapon/flame` | 300 ms filtered noise roar with bit-crush crackle |
| `weapon/laser` | Loop: saw 880 Hz + pulse an octave up, 30 Hz vibrato, filter wobble |
| `weapon/tracker` | Two quick rising pulse 12.5 % chirps + short whoosh |
| `weapon/bouncer` | Springy "boing": triangle 300 → 900 Hz with fast pitch LFO |
| `weapon/bouncer-hit` | Short bright ping on each bounce |
| `weapon/whizbang` | Rising whistle (sine 1 → 2 kHz, 500 ms), then `explosion/sparkle` |
| `weapon/knife-swing` | 80 ms high-passed airy noise swish |
| `weapon/knife-hit` | "Bonk": triangle 220 Hz thunk + wood-block click |
| `weapon/empty` | Dry click + falling two-note blip |
| `bomb/throw` | Small whoosh |
| `bomb/bounce` | Dull clunk (noise + 120 Hz) |
| `explosion/s` `explosion/m` `explosion/l` | Noise bursts 150 / 300 / 600 ms with falling low-pass and a sub thump that grows with size |
| `explosion/boss` | 1.5 s rumble + debris crackles + delayed second boom |
| `explosion/sparkle` | Firework crackle: many tiny random-pitch noise ticks |

**Hits, enemies, creatures, machines**
| id | Description |
|---|---|
| `hit/metal` | Short inharmonic FM clank (armour, machines, boss parts) |
| `hit/soft` | Dull "pomf" thud (soldiers, creatures; bloodless) |
| `hit/shield` | Hollow "tonk" |
| `enemy/alert` | Two-note rising "huh?" pulse blip |
| `enemy/die` | Comic falling slide whistle (sine 1.2 kHz → 300 Hz, 300 ms) |
| `enemy/die-blast` | Slide whistle up, then a pop |
| `enemy/panic` | Fast warbling pulse |
| `enemy/whistle` | Drum Major's whistle: sine 2.8 kHz trill |
| `enemy/charge` | Lancer's charge: rising saw growl |
| `enemy/tuba-oom` | Tubist's tell: low saw 55 Hz with a vowel-like formant filter |
| `creature/honk` | Goose honk: nasal band-passed saw 400 Hz with a pitch dip |
| `creature/boar-snort` | Short noise grunt with a low pulse |
| `creature/frog-croak` | Low amplitude-modulated pulse "ribbit" |
| `creature/frog-spit` | Wet blip (fast falling sine) |
| `creature/mole-dig` | Gritty low noise loop |
| `creature/ram-bleat` | Vibrato pulse "baa" |
| `creature/hound-whirr` | Wind-up ratchet clicks speeding up |
| `creature/bee-buzz` | Loop: saw 180 Hz, 40 Hz amplitude modulation |
| `machine/engine-loop` | Tread rumble: low noise + 40 Hz pulse |
| `machine/cannon` | Big thump + noise tail |
| `machine/rotor-loop` | Gyro chop: amplitude-gated noise at 12 Hz |
| `machine/blimp-deflate` | Long falling "raspberry": pulse with a wobbling, sinking pitch |
| `machine/anthem` | Tinny loop from the tank horn: an original 4-note pompous phrase on pulse 12.5 % through a narrow band-pass |
| `machine/brake` | Tyre screech: high band-passed noise |
| `machine/strafe-whine` | Rising engine whine (saw 200 → 600 Hz) |

**Player, vehicles, items, hostages**
| id | Description |
|---|---|
| `player/jump` `player/land` | Tiny blip up / soft thud |
| `player/die` | Three falling blips + a soft "poof" |
| `player/spawn` | Rising shimmer (pad + bell) |
| `player/gilded` `player/gild-crack` `player/gilded-step` | Shimmering bell chord / glassy crack / creak |
| `vehicle/enter` `vehicle/exit` | Hatch clunk + rising (enter) or falling (exit) arpeggio |
| `vehicle/hurt` | Metal clang + crackle |
| `vehicle/alarm` | Two-tone beep, 20-tick period |
| `vehicle/swan-step` | Hydraulic hiss + thud |
| `vehicle/swan-honk` | Horn: two pulse waves a minor third apart |
| `vehicle/swan-shell` `vehicle/torpedo` `vehicle/plow-mortar` `vehicle/egg-drop` | Heavy shells: cannon boom / bubbly whoosh / mortar "thoonk" / comic "plop" |
| `vehicle/wing-guard` `vehicle/splash-screen` `vehicle/plow-boost` `vehicle/barrel-roll` | Metal unfold / water wall / diesel roar / whoosh |
| `vehicle/paddle-loop` `vehicle/plow-loop` `vehicle/jet-loop` | Engine loops |
| `vehicle/ram` | Rising siren into a big explosion |
| `item/pickup-weapon` | Bright rising arpeggio |
| `item/pickup-bombs` | Two-tone confirm |
| `item/pickup-food` | Two quick noise "munch" bites + blip |
| `item/pickup-gem` | FM bell ding; pitch rises with the value |
| `item/feather` | Sparkly rising glissando |
| `item/1up` | Original 5-note rising fanfare on pulse + bell |
| `item/crate-break` | Wood crunch |
| `hostage/free` `hostage/give` `hostage/salute` | Rope snap + happy chirp / pop / short trumpet-like pulse blip |

**Bosses, environment, UI**
| id | Description |
|---|---|
| `boss/warning` | Klaxon: square 440/554 Hz alternating, 4 times |
| `boss/phase` | Deep FM gong |
| `boss/part-break` | Heavy metal crunch + `explosion/m` |
| `boss/charge` | Rising whine used under telegraphs |
| `boss/laser` `boss/beam-charge` | Layered saws + noise / rising filtered pad |
| `boss/stomp` `boss/chomp` | Sub thump / metal clank |
| `boss/m1-horn` `boss/m1-puff` `boss/m1-sad-tuba` | Ship horn (low saw chord 73 + 110 Hz) / smoke-ring puff / slow falling saw slide |
| `boss/m3-sour-chord` | Detuned cluster chord on all channels |
| `env/water-splash` `env/collapse` `env/train-whistle` `env/wind` `env/avalanche` `env/bell` `env/lava-bubble` | Environment one-shots and loops |
| `ui/move` `ui/confirm` `ui/cancel` `ui/coin` `ui/start` `ui/pause` | Menu blips (pulse 12.5 %) |
| `ui/countdown` `ui/tally-tick` `ui/tally-end` `ui/name-enter` | Countdown tick / fast tally ticks / tally total chord / letter select |
| `mission/checkpoint` `mission/timer-low` `mission/time-over` | Short chime / beep / buzzer |

**Announcer lines** (`voice`, speech synthesis; jingle fallback): weapon names from section 5,
`BOMBS!`, `ONE UP!`, `YOU'RE GOLDEN!` (GILDED), `GOLDEN FEATHER!`, mission start lines (section
11), `SWAN, READY TO WADDLE!`, `SWAN DELIVERY!`, `PADDLER, ALL ABOARD!`, `PLOWCAT! CLEAR THE
ROAD!`, `HONKERS AWAY!`, `MISSION COMPLETE!`, `TIME OVER!`, `CONTINUE?`, `GAME OVER.`,
`THE MOON IS SAVED!` (ending).

### 12.2 Music tracks
| id | Use | Mood | BPM | Key / mode | Instrumentation | Structure |
|---|---|---|---|---|---|---|
| `title` | Title, attract | Cheeky heroic march-rock | 140 | D mixolydian | pulse 25 % lead, pulse 12.5 % harmony, saw bass, triangle counter-line, noise drums, FM bell accents | Intro 4 bars (drum fill + bell hits) → A 8 (main theme: a rising fourth, then a skipping stepwise fall) → B 8 (call and response, pulse vs. saw) → A′ 8 → loop to A |
| `select` | Mode / character select | Light funk, playful | 120 | G major | triangle "slap" bass, pulse arpeggios, hats | 8-bar loop; stab on each character change |
| `jingle-start` | Mission intro card | Fanfare sting | 130 | C major | drum roll, saw chord stab, bell | 3 s, no loop |
| `m1` | m1 sections | Sunny seaside rock | 152 | A mixolydian | pulse 50 % lead with vibrato, octave-bouncing saw bass, off-beat hats, FM bell "gull" calls | Intro 4 → A 16 → B 8 (borrowed minor iv stabs) → C 8 (drum + bass break) → loop A |
| `m2` | m2 on foot | Humid jungle groove | 128 | E dorian | triangle lead (woody), pulse 12.5 % plucks, noise shaker 16ths, pitched-kick toms, pad swells | A 16 → B 16 → bridge 8 → loop |
| `m2-river` | m2-b, m2-c2 | Boat chase | 160 | E dorian | saw lead, double-time drums, m2 motif sped up | A 8 → B 8 → loop |
| `m3` | m3 on foot | Crisp alpine, lonely then bold | 136 | B minor (harmonic-minor turns) | FM bell lead (icy), pulse 25 % arpeggios, pad, drums that build | A 16 → B 16 → loop |
| `m3-slope` | m3-b | Downhill speed | 172 | B minor | driving saw bass 8ths, pulse lead, fast hats | A 8 → B 8 → C 8 (avalanche: drums + rising pad only) → loop |
| `m4` | m4 on foot | Desert swagger, half-time | 116 | D phrygian dominant | sliding saw lead, pulse 12.5 % drone, noise hand-drum patterns, bell | A 16 → B 16 → loop |
| `m4-train` | m4-b1 | Chugging chase | 150 | D minor | noise-hat "train" rhythm, saw bass, pulse lead | A 8 → B 8 → loop |
| `m5` | m5-a, m5-b | Grand, determined | 144 | C minor → E♭ major in B | pulse 50 % lead doubled by saw, pad, full drums | A 16 → B 16 → C 8 (whole-step key lift) → loop |
| `m5-sky` | m5-c | Soaring flight | 160 | F lydian | fast pulse arpeggios, saw lead, triangle bass, big pad | A 16 → B 16 → loop |
| `mini-boss` | Mini-bosses | Urgent | 150 | E minor | 2-bar saw-bass ostinato, pulse stabs, snare rolls | 16-bar loop |
| `boss` | Bosses m1–m4 | Big and menacing | 158 | A harmonic minor | tritone bass ostinato, pulse lead with trills, double-kick noise drums | Intro 2 bars (in time with `boss/warning`) → A 16 → B 16 → loop |
| `boss-final` | Final boss | Pompous villain + heroic answer | 166 | D minor → F major (C) | organ-like pad + saw, FM bell "royal fanfare" counter-motif in a pompous dotted rhythm | Intro 4 → A 16 → B 16 → C 8 "Final Fanfare" (heartbeat kick + pad only, for stage 3) → loop |
| `jingle-clear` | Mission complete | Triumphant cadence | 130 | B♭ major | all channels | 6 s, no loop |
| `continue` | Continue countdown | Tense ticking | 100 | A minor | sparse triangle, clock-tick noise | 8-bar loop |
| `game-over` | Game over | Sad, comic | 80 | G minor | triangle + pad falling figure | 4 s, no loop |
| `ending` | Ending cutscene | Warm, silly, proud | 108 | F major | pad + FM bell melody that slowly quotes the title's rising fourth | 32 bars, no loop |
| `credits` | Credits roll | Upbeat medley | 132 | D major | medley of this game's own mission motifs | 64 bars → loop |
| `high-score` | Name entry, high scores | Cheerful | 120 | C major | bell arpeggios, triangle bass | 8-bar loop |

---

## 13. UI & flow

Fonts: `big` (8×8) for titles and numbers, `small` (5×7) for everything else. All text is
upper-case. Colours: white text with a 1 px dark outline; P1 colour sky blue, P2 colour orange;
warnings red; score yellow.

### 13.1 Flow
`Boot` → `Title` (attract loop) → `Menu` → `Select` → `MissionIntro` → `Gameplay` (⇄ `Pause`,
`Continue`) → `MissionComplete` → next `MissionIntro` … → `Ending` → `Credits` → `NameEntry` →
`Title`. `GameOver` → `NameEntry` (if the score qualifies) → `Title`.

### 13.2 Boot
- Centre: `WARMING UP THE SWAN...` (small) and a 128×4 progress bar at y 120 while sprites
  pre-generate. Then `PRESS ANY KEY` blinking (needed to start audio).

### 13.3 Title and attract
- Logo `METAL SWAN 3` at the top centre (y 40–90): chunky riveted steel letters; the "3" is drawn
  as a swan's curved neck and head. Tagline under it (y 100): `FLY LOW. SHOOT FIRST. HONK LATER.`
- `PRESS START` blinking (30 ticks on / 30 off) at y 150. Bottom-right (380, 206, right-aligned):
  `FREE PLAY` or `CREDIT n`. Bottom-left (4, 206): `MADE ENTIRELY OF CODE`.
- Attract loop: title 900 ticks → `DEMO PLAY` (bot plays m1-a for 1200 ticks, label at the top
  centre) → `TOP SWANS` table 300 ticks → title.

### 13.4 Menu
Items (centred, y 120 + 14 per row): `1 PLAYER` · `2 PLAYERS` · `OPTIONS` · `HIGH SCORES`.
Cursor: a small swan-head icon left of the item.

### 13.5 Character select
- Header (y 12): `SELECT YOUR SWAN`. Timer at the top right (380, 12): `20` counting down; at 0
  the current choice is confirmed.
- Four 32×32 portraits in a row at y 40 (x 72, 136, 200, 264 + 16 offsets), names under them
  (y 76): `RIVET` `MOOSE` `YO-YO` `STATIC`. Cursors `1P` (blue) and `2P` (orange).
- Detail panel (y 96–200): the full-body idle sprite at 2× scale on the left; on the right the
  full name and rank, the role, and the quote:
  - `SGT. NADIA "RIVET" OKAFOR` / `MECHANIC` / `"IF IT RATTLES, I FIX IT. IF IT HONKS, I RIDE IT."`
  - `CPL. BRAM "MOOSE" HOLLANDER` / `HEAVY WEAPONS` / `"SPOTTED: ONE ARCHDUKE. COMMON. VERY LOUD."`
  - `SPC. YOLANDA "YO-YO" REYES` / `PILOT` / `"ALTITUDE IS ATTITUDE!"`
  - `PVT. FELIX "STATIC" DUNMORE` / `RADIO OPERATOR` / `"CYGNET SQUAD, RADIO CHECK... HELLO? IS THIS THING ON?"`
- Both players may pick the same character; P2 then gets the alternate palette (top colour
  swapped to the orange/navy alternate ramp).
- Confirm: the character plays the victory pose (30 ticks) + `ui/confirm`.

### 13.6 Mission intro card (180 ticks, `start` skips after 60)
Black background with a thin strip map of the mission.
- y 64: `MISSION 1` (big) — m5 shows `FINAL MISSION`.
- y 84: mission name (big): `HAVERWICK HARBOUR` / `THE SNAPWATER DELTA` / `MOUNT GRUMBELHORN` /
  `THE GILDED WASTES` / `THE PALACE ABOVE THE CLOUDS`.
- y 98: codename (small), e.g. `OPERATION WAKE-UP CALL`.
- y 120–140: briefing (small, max 2 lines, section 2.3).
- y 168: `START!` (big, appears at tick 120 with `jingle-start` and the voice line).

### 13.7 HUD (384×216)
| Element | Position (x, y) | Content |
|---|---|---|
| P1 label + score | label (4, 4); score right-aligned ending at x 92 | `1UP` + 8-digit score, e.g. `  123400` (yellow) |
| P1 weapon | icon 16×8 at (4, 13); text from (22, 13) | weapon letter box + `ARMS` + ammo (`∞` for the pistol) |
| P1 bombs | (64, 13) | `BOMB 10` (heavy shells in a vehicle: `SHELL 20`) |
| P1 lives | (4, 22) | up to 5 head icons (7×7) of the character, then `×6` |
| P1 vehicle | (4, 31) | vehicle name (`SWAN`, `PADDLER`, `PLOWCAT`, `HONKER`) + HP cells (8×5 each, 1 px gap) + special-ready dot |
| Timer | centred at (192, 4) | 2 digits (big); below 10 they flash red |
| P2 block | mirrored, right-aligned at x 380 | `2UP` …; if not joined: `PRESS START` blinking (credit mode with 0 credits: `INSERT COIN`) |
| P1 hostages | (4, 207) | 5×7 hostage icons, up to 10, then `×n` |
| P2 hostages | right-aligned at (380, 207) | same |
| Credits | centred (192, 207) | `CREDIT n` (credit mode only) |
| GO arrow | (344, 100) (vertical sections: (184, 36), pointing up) | `GO!` + arrow, blinking, after a lock is released or after 180 idle ticks |
| Weapon name pop | under the player's weapon icon, 90 ticks | e.g. `MACHINE GUN` |
| Centre messages | centred, y 96 | `START!`, `TIME OVER`, `WARNING!` (red, flashing, boss entrance) with the boss name under it (small), e.g. `S.S. VAINGLORIOUS` |

There is no boss HP bar (arcade-faithful); only the m5 stage 3 charge ring is a diegetic gauge.

### 13.8 Pause
Screen dimmed 50 %. `PAUSE` (big, y 70). Items: `RESUME` · `OPTIONS` · `QUIT TO TITLE`
(confirm: `QUIT? YES / NO`). Music volume halves while paused.

### 13.9 Continue and game over
- `CONTINUE?` (big, y 72), countdown digit (big, 2× scale, y 100) `9` … `0`, `PRESS START`
  (small, y 140), `SCORE  1234500` (y 160), `CONTINUES USED  1` (y 172). With 0 credits in credit
  mode: `INSERT COIN` replaces `PRESS START`. Music `continue`.
- `GAME OVER` (big, centred, 240 ticks, `game-over`), then name entry if the score qualifies.

### 13.10 Mission complete tally
Music `jingle-clear`; the players do their victory poses for 120 ticks, then the tally panel
(lines appear every 30 ticks with `ui/tally-tick`; the total uses `ui/tally-end`):
```
MISSION 1 COMPLETE!
HOSTAGES          10 x  5,000     50,000
ALL RESCUED                       30,000
GOLDEN FEATHERS    2 x 10,000     20,000
NO MISS BONUS                     50,000
TIME BONUS        42 x    500     21,000
MISSION BONUS                     10,000
DIFFICULTY                          x1.0
TOTAL                            181,000
```
Lines with 0 are shown as `0` (ALL RESCUED and NO MISS show `---` when missed). Co-op: two
columns, P1 left and P2 right.

### 13.11 Ending and credits
Ending cutscene (in-engine, about 1,100 ticks, `ending` music; captions in small font at y 190):
1. 0–240: the lens core cracks; the last beam bounces off a mirror and carves a swan into the
   Moon. Caption: `THE MOONFACE LENS MISFIRED.`
2. 240–480: the Fanfaronne sinks slowly into the sea with one long organ note. Caption:
   `THE FANFARONNE SANK. VERY SLOWLY.`
3. 480–720: the Archduke drifts away under his parasol and lands in a lake of geese. Caption:
   `ARCHDUKE FANFARON WAS LAST SEEN... BEING CHASED BY GEESE.`
4. 720–960: Cygnet Squad on the beach with the Swan Mk.3; each chosen character does the victory
   pose; everyone salutes the Moon. Caption: `THE MOON NEVER LOOKED SO GOOD.`
5. 960–1100: `THE END?` → 60 ticks → `...YES. THE END.`

Credits roll (`credits` music), centred lines: `METAL SWAN 3` · `STARRING` · `SGT. NADIA "RIVET"
OKAFOR` · `CPL. BRAM "MOOSE" HOLLANDER` · `SPC. YOLANDA "YO-YO" REYES` · `PVT. FELIX "STATIC"
DUNMORE` · `AND THE SWAN MK.3 AS ITSELF` · `VILLAINY BY ARCHDUKE IGNATIUS FANFARON` · `ALL PIXELS
GENERATED BY CODE` · `ALL SOUNDS SYNTHESIZED` · `NO GEESE WERE HARMED` · `THANK YOU FOR PLAYING!`.
Then the final tally (section 14.4) and name entry.

### 13.12 Options
Rows (left label, right value; `left`/`right` change, `fire` confirms):
`DIFFICULTY  CADET / REGULAR / VETERAN` · `LIVES  1 / 2 / 3 / 4 / 5` · `CREDITS  FREE PLAY / 9 / 5 / 3` ·
`MUSIC VOLUME  0–10` · `SFX VOLUME  0–10` · `ANNOUNCER  ON / OFF` · `SCREEN SHAKE  ON / OFF` ·
`CONTROLS` (rebinding page: `PRESS A KEY FOR FIRE`, … `JUMP`, `BOMB`, `START`; `ESC TO CANCEL`) ·
`RESET HIGH SCORES` (confirm `ARE YOU SURE? YES / NO`) · `BACK`.

### 13.13 High scores
- Title `TOP SWANS`. 10 rows: rank, 3-letter name, score, last mission reached (`M1`–`M5`, or
  `ALL` for a clear), character head icon, continues used (`C0`).
- Default table (all invented): `CYG 500000`, `HNK 400000`, `RVT 300000`, `MOO 250000`,
  `YOY 200000`, `STA 150000`, `PLM 120000`, `GLD 100000`, `MUN 80000`, `SWN 50000`.
- Name entry: `ENTER YOUR NAME` (big), letter wheel `A–Z 0–9 . - END`, 30-second timer; music
  `high-score`.

---

## 14. Scoring

All values are points for the player who caused them. Display max 99,999,999.

### 14.1 Kills and destruction
| Source | Points |
|---|---|
| `rifleman` | 100 |
| `grenadier`, `parasol-trooper` | 200 |
| `shield-guard` | 300 (+200 for breaking the shield) |
| `tuba-gunner`, `lancer` | 300 |
| `torchbearer` | 300 (+200 for exploding the tank) |
| `drum-major` | 1,000 (+ drops a `medal` gem worth 2,500) |
| `honk-goose` | 300 |
| `spit-frog`, `sapper-mole` | 400 |
| `clockwork-hound` | 500 |
| `war-boar` | 600 |
| `helmet-ram` | 700 |
| `brass-bee` | 50 each; SWARM bonus 1,000 when a whole swarm dies |
| `plume-fighter` | 500 |
| `gyrocopter` | 800 |
| `troop-lorry`, `mortar-coach`, `patrol-launch` | 1,500 |
| `bunting-tank`, `gazebo-gun` | 2,000 |
| `blimp-bomber` | 3,000 |
| Mini-bosses | `parade-float` 15,000 · `peacock-sentinel` 20,000 · `rail-howitzer` 20,000 · `carrier-blimp` 30,000 (+ 1,000 per destroyed part) |
| Bosses | `showboat` 50,000 · `riverhorse` 60,000 · `war-organ` 70,000 · `golden-colossus` 80,000 · `palace-prow` 60,000 · `throne-walker` 80,000 · `moonface-lens` 150,000 (+ part scores in section 10) |
| Enemy projectiles shot down | tuba rocket 100 · hairpin missile 100 · boss barrel 200 · sky/river mine 200 |
| Props | `crate` 100 · `explosive-barrel` 100 · breakable decor 100 · `snow-wall` 200 · `snow-boulder` 300 · `gilding-nozzle` 500 · gilded soldier statue 500 · `fanfaron-statue` 1,000 · `hive-launcher` 1,500 · portrait drone 300 |
| **Knife kill** | ×2 the target's kill score |

### 14.2 Pickups and rescues
| Source | Points |
|---|---|
| Freeing a hostage | 1,000 at once |
| `pickup-weapon`, `pickup-bombs` | 500 |
| `pickup-food` | bread 300 · fish 500 · sausage 800 · pie 1,000 · cake 2,000 · banquet 5,000 |
| `pickup-gem` | coin 100 · ruby 1,000 · sapphire 2,000 · emerald 3,000 · medal 2,500 · crown-jewel 10,000 · golden-feather 10,000 |
| `pickup-repair` on foot | 1,000 |
| `pickup-1up` on VETERAN | 50,000 (instead of the life) |

### 14.3 Mission tally (per player, section 13.10)
| Line | Points |
|---|---|
| `HOSTAGES` | count × 5,000 (VIP counts 2) |
| `ALL RESCUED` | 30,000 if every hostage on the route taken was freed (co-op: by the team) |
| `GOLDEN FEATHERS` | count × 10,000 (on top of the 10,000 at pickup) |
| `NO MISS BONUS` | 50,000 if the player lost no life in the mission |
| `TIME BONUS` | the boss timer's remaining value × 500 |
| `MISSION BONUS` | m1 10,000 · m2 20,000 · m3 30,000 · m4 40,000 · m5 50,000 |
| `DIFFICULTY` | the tally sum × 0.5 (CADET) / 1.0 (REGULAR) / 1.5 (VETERAN) |

### 14.4 Final tally (after the credits)
| Line | Points |
|---|---|
| `LIVES LEFT` | lives × 100,000 |
| `ALL FEATHERS` | 150,000 if the player collected all 15 golden feathers |
| `ONE CREDIT CLEAR` | 1,000,000 if the player used 0 continues |
| `CONTINUES USED` | shown, no points |

### 14.5 Extends and expectations
- Extra lives at **500,000** and **1,500,000** points (`item/1up` sound, announcer `ONE UP!`).
- A strong 1-credit REGULAR clear scores about 2.5–3.5 million; a credit-feeding first clear
  about 1.0–1.5 million.
- Co-op: separate scores; the high-score table stores each player's entry separately.

---

## 15. Content ID index

### 15.1 Characters
`rivet`, `moose`, `yoyo`, `static` (playable) · `recruit` (test only).

### 15.2 Weapons and player projectiles
- Weapons: `pistol`, `machine-gun`, `shotgun`, `rocket-launcher`, `flamethrower`, `laser`,
  `homing`, `bouncer`, `whizbang`, `grenade`, `knife`.
- Vehicle heavy shells: `swan-shell`, `paddler-torpedo`, `plow-mortar`, `egg-bomb`.
- GILDED shot: `gold-nugget`.

### 15.3 Items
`crate`, `hostage` (kinds `tied`, `walker`, `caged`, `vip`, `hidden`), `pickup-weapon` (param
`weapon`), `pickup-bombs`, `pickup-food` (kinds `bread`, `fish`, `sausage`, `pie`, `cake`,
`banquet`), `pickup-gem` (kinds `coin`, `ruby`, `sapphire`, `emerald`, `medal`, `crown-jewel`,
`golden-feather`), `pickup-1up`, `pickup-repair`.
Drop tables: `hostage`, `crate`, `vehicle-zone`, `enemy-drum-major`, `enemy-machine`.

### 15.4 Entities
- **Infantry:** `rifleman` (param `ski`), `grenadier`, `shield-guard`, `tuba-gunner` (param `aa`),
  `torchbearer`, `drum-major`, `parasol-trooper`, `lancer`.
- **Machines:** `bunting-tank`, `troop-lorry` (param `cargo`), `gyrocopter`, `blimp-bomber`,
  `gazebo-gun` (param `mortar`), `mortar-coach`, `patrol-launch`, `plume-fighter`.
- **Creatures:** `honk-goose`, `war-boar`, `spit-frog`, `sapper-mole`, `helmet-ram`,
  `clockwork-hound`, `brass-bee`.
- **Mini-bosses (parts):** `parade-float` (`float-cannon` ×2, `float-core`), `peacock-sentinel`
  (`tail-fan`, `peacock-head`), `rail-howitzer` (`cupola` ×2, `howitzer`), `carrier-blimp`
  (`engine-pod` ×2, `hangar-gondola`).
- **Bosses (folder → ids, parts):**
  - `bosses/m1`: `showboat` — `deck-cannon-a`, `deck-cannon-b`, `smokestack-a`, `smokestack-b`,
    `paddle-wheel`, `figurehead`.
  - `bosses/m2`: `riverhorse` — `howdah`, `ear-mortar-l`, `ear-mortar-r`, `mouth-core`.
  - `bosses/m3`: `war-organ` — `pipes-left`, `pipes-centre`, `pipes-right`, `bell-tower`, `console`.
  - `bosses/m4`: `golden-colossus` — `scepter-arm`, `fist-arm`, `monocle`, `chest-furnace`.
  - `bosses/m5`: `palace-prow` — `prop-pod-top`, `prop-pod-bottom`, `prow-turret-a/b/c`,
    `gate-core`; `throne-walker` — `canopy-gun`, `legs-front`, `legs-back`, `throne-seat`;
    `moonface-lens` — `mirror-a/b/c/d`, `lens-core`; plus `portrait-drone`.
- **Player vehicles:** `swan`, `paddler`, `plowcat`, `honker`.
- **Props and hazards:** `fanfaron-statue`, `explosive-barrel`, `river-mine`, `sky-mine`,
  `gilding-nozzle`, `hive-launcher`, `snow-boulder`, `snow-wall`, `falling-icicle` (param `rock`),
  `raft`, `barge`, `lift`, `lily-pad`.
- **Enemy projectiles:** `enemy-bullet`, `tank-shell`, `tuba-rocket`, `round-bomb`, `gyro-bomb`,
  `mortar-shell`, `flame-jet`, `spit-glob`, `dynamite`, `baton`, `confetti-shot`, `firework-shell`,
  `soot-bomb`, `boss-barrel`, `sound-ring`, `pineapple-bomb`, `water-bomb`, `note-bolt`,
  `bass-wave`, `bell`, `sound-wall`, `gold-orb`, `rolling-coin`, `hairpin-missile`, `gold-mist`,
  `scroll-shot`, `crown-bullet`, `mirror-beam`, `moonbeam`, `gate-beam`, `snow-chunk`.

### 15.5 Missions and sections
- `m0` (test range, kept).
- `m1`: `m1-a`, `m1-b1`, `m1-b2`, `m1-c`.
- `m2`: `m2-a`, `m2-b`, `m2-c1`, `m2-c2`, `m2-d`.
- `m3`: `m3-a`, `m3-b`, `m3-c1`, `m3-c2`, `m3-d`.
- `m4`: `m4-a`, `m4-b1`, `m4-b2`, `m4-c`.
- `m5`: `m5-a`, `m5-b`, `m5-c`, `m5-d`.
- Custom background generators: `harbour`, `canal`, `river`, `cave`, `pines`, `frozen-falls`,
  `village`, `cathedral`, `mesas`, `telegraph-poles`, `sandstorm`, `foundry`, `palace-spires`,
  `hangar-shaft`, `moon`, `cloud-sea`.

### 15.6 Sprite id prefixes
| Prefix | Contents |
|---|---|
| `char/<id>/` | player legs/torso/full-body frames (contract in ARCHITECTURE §6.1), `portrait` |
| `enemy/<id>/` | infantry (same contract as enemy soldiers) |
| `creature/<id>/` | creatures: `idle`, `walk`, `attack`, `tell`, `die`, `die-blast`, `die-burn` |
| `machine/<id>/` | machines: `body`, `turret`, `wheel`, `rotor`, `fire`, `wreck` |
| `vehicle/<id>/` | player vehicles: `body`, `legs`/`treads`/`paddles`, `neck`/`turret`/`gun`, `special`, `wreck` |
| `boss/<id>/<part>` | bosses and mini-bosses, one strip per part and damage state (`-0`, `-1`, `-2`) |
| `item/<id>/` | `item/crate`, `item/hostage/<anim>`, `item/pickup-weapon/<weapon>`, `item/food/<kind>`, `item/gem/<kind>`, `item/1up`, `item/repair` |
| `proj/<id>` | all projectiles (player and enemy) |
| `prop/<id>/` | props and hazards |
| `fx/<id>` | `fx/explosion-s`, `fx/explosion-m`, `fx/explosion-l`, `fx/soot-puff`, `fx/stars`, `fx/feathers`, `fx/confetti`, `fx/gold-mist`, `fx/gold-sparkle`, `fx/splash`, `fx/muzzle-<weapon>`, `fx/smoke`, `fx/sparkle`, `fx/snow-puff` |
| `ui/<id>` | `ui/logo`, `ui/icon-bomb`, `ui/icon-weapon-<weapon>`, `ui/icon-life-<char>`, `ui/icon-hostage`, `ui/cell`, `ui/cursor-swan`, `ui/go-arrow` |
| `decor/<mission>/<id>` | mission decor (stalls, signs, painter NPC, tarp, rowboat, chalets, palm trees …) |

### 15.7 Sound and music ids
- **sfx:** all ids in section 12.1 (`weapon/*`, `bomb/*`, `explosion/*`, `hit/*`, `enemy/*`,
  `creature/*`, `machine/*`, `player/*`, `vehicle/*`, `item/*`, `hostage/*`, `boss/*`, `env/*`,
  `ui/*`, `mission/*`).
- **music:** `title`, `select`, `jingle-start`, `m1`, `m2`, `m2-river`, `m3`, `m3-slope`, `m4`,
  `m4-train`, `m5`, `m5-sky`, `mini-boss`, `boss`, `boss-final`, `jingle-clear`, `continue`,
  `game-over`, `ending`, `credits`, `high-score`.

---

## Appendix A — Originality self-check
- All proper names (Cygnet Squad, Rivet, Moose, Yo-Yo, Static, Swan Mk.3, Paddler, Plowcat,
  Honker, Plume Legion, Archduke Ignatius Fanfaron, Gildenstein, Haverwick, Snapwater, Grumbelhorn,
  Fanfaronne, Project MOONFACE, all bosses and enemies) were invented for this proposal.
- The heroes avoid the genre classic's looks: no red-vest hero, no sunglasses-and-bandana hero,
  no blonde bandana heroine, no glasses-and-cap heroine. The leader is tall, thin and
  clean-shaven with a pompadour (no stout moustached general). Enemy soldiers wear crimson
  tunics and plumed shakos (no green fatigues). Hostages are fully dressed civilians in chairs.
- No crab, locust, man-eating plant, yeti, jellyfish, mummy, zombie, alien or fat-transformation
  content. The status gimmick is GILDED (a gold statue), which is our own.
- The walker tank is a two-legged bird with a neck cannon, not a round tank with a top gun;
  no vehicle uses the "<animal> + vehicle-word" naming pattern of the classic.
- Bosses (paddle-steamer, robot hippo, war organ, walking statue, flying palace / throne / lens)
  and set pieces (bandstand plaza, avalanche run, gold train with low bridges, elevator spire)
  are original. All lines, captions and music descriptions are new.
