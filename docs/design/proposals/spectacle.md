# METAL SWAN 3 — Design Proposal: "Spectacle & Variety"

> **Angle:** maximise variety — five biomes driven by one weather theme, four very different
> rideable vehicles, set pieces in every section, four route branches, three creature families,
> and bosses that each test a *different* skill — while every element stays buildable with
> procedural art (shared humanoid rig, machine kit, named background generators, terrain
> painter) and data-driven sections.
>
> All names, characters, places, story text and music descriptions in this document are
> invented for this project and were checked against `docs/ORIGINALITY.md`.
> Units: px, px/tick, ticks (60 per second). y grows downward. Ground baseline in most
> sections is **y = 176** unless stated.

---

## 1. Overview

**Pitch.** A mad TV weather presenter has built a flying weather machine and now forces the
whole world to match her forecasts. Four soldiers of the **Cygnet Squad** fight through
monsoon jungle, a desert under mirror-suns, a hurricane harbour, a blizzard mountain and
finally the storm-fortress itself — on foot, on a two-legged walker tank called the **Swan**,
in a bouncing dune buggy, in an armoured hover-bathtub and in a VTOL jet.

**The variety engine: weather.** Every mission is "one kind of bad weather", which gives each
biome its own palette, background generators, hazards, enemy variants, music mood and a
signature set piece:

| Mission | Weather | Biome | Signature set piece | Ride |
|---|---|---|---|---|
| m1 | Monsoon | Jungle river delta | Lightning flashes reveal enemies in the dark; a giant tree falls to bridge a river | SW-3 Swan |
| m2 | Heatwave | Desert canyon, three mirror-suns | Highway chase alongside a sailing land-battleship | Buckboard buggy |
| m3 | Hurricane | Flooded port city | Climb a leaning tower while the flood rises behind you | Bathtub hovercraft |
| m4 | Blizzard | Alpine mountain | Outrun an avalanche; downhill fight against a chalet on skis | Swan (returns) |
| m5 | All of it | Sky fortress in the storm's eye | Jet flight through lightning; the studio floor collapses into the vortex | Gullwing jet |

**Tone.** Slapstick war comedy. Nobody bleeds. Enemies lose helmets, turn black with soot, see
stars, run off-screen with their pants smoking, or freeze in a comic pose and pop into
confetti-like debris. The villain's soldiers are underpaid, rain-soaked and grumpy; they
shelter under newspapers, wring out their socks and argue about the forecast.

**Title screen tagline:** `LOCK, LOAD & HONK!`

**Target runtime.** About 20–25 minutes for a first full clear on NORMAL:

| Part | Target |
|---|---|
| Each mission (m1–m4) | 3.5–4.5 min including its boss |
| m5 (longer, three-stage final) | 5–6 min |
| Intro + ending + tallies | about 2.5 min |

**Design pillars.**
1. *Something new every 30 seconds:* a new enemy type, a terrain trick, a set piece, a ride,
   or a route choice.
2. *Readable at 384×216:* chunky silhouettes, one dominant colour per enemy type, every
   attack telegraphed by a big shape change, a colour flash, or a ground marker.
3. *Data, not code:* set pieces are built from the same section primitives (moving solids,
   hazards, scripted spawns, camera locks, parallax offsets), so mission agents can build
   them without new engine features. Where a set piece needs a small helper, the helper is
   named in §11.

---

## 2. Story

### 2.1 Premise

**Grand Duchess Ottilie Isobar** was the most famous TV weather presenter in the world — and
the most wrong. After she promised "sunshine all weekend" during the worst flood in a century,
the network fired her live on air. She swore an oath on her pointer stick: *"From now on, the
weather will listen to ME."*

Using her fortune and a lot of stolen science, she built the **Maelstrom Engine**, a flying
fortress at the centre of a permanent storm. It can push any weather anywhere. She founded an
army, **the Cold Front**, and sent the world her demand: crown her "Empress of All Weather",
or it rains on every wedding, every picnic and every holiday — forever.

To protect her plan she kidnapped the world's meteorologists, weather-station crews and TV
weather staff, so nobody can forecast against her.

**The Cygnet Squad** — a small special-operations team with a long record of loud successes
and expensive damage — receives the order: **Operation METAL SWAN**. It is the operation's
third phase, which is why the squad's new walker tank, the SW-3 "Swan", is in fact the third
Swan. (The first two still lie at the bottom of a lake. "They float. They just don't float
upright.")

### 2.2 The enemy faction — the Cold Front

- **Look:** slate-blue greatcoats, safety-yellow rain hats with a long back brim, black rubber
  boots, round tinted goggles. Arm patch: a white cloud with a yellow zig-zag bolt. Officers
  wear a navy long coat and a peaked cap with a tiny spinning weathervane on top.
- **Personality:** they were recruited with a promise of "sunny weekends for life" and have
  not seen the sun since. They complain, they hide from rain, they read the forecast in the
  paper and groan. When a soldier panics he opens a tiny umbrella and runs.
- **Technology:** steam boilers, umbrellas, lightning rods, kites, blimps disguised as clouds,
  mirrors and clockwork. Machines have weather nicknames.
- **Creatures:** the Engine's storms mutated the local wildlife (toads, moths, eels,
  mudskippers, rams, storm-jellies), and the Duchess's clockwork workshop builds robot hounds.

**Leader — Grand Duchess Ottilie Isobar.** A tall woman with a towering grey-white hairdo
shaped like a cumulus cloud, an electric-purple presenter blazer with huge shoulder pads, a
necklace of hailstone pearls and an extendable pointer stick. She speaks to the player in
forecast language: *"Tomorrow: scattered soldiers, with a 100% chance of YOU LOSING."*

### 2.3 Mission briefings (shown on the mission intro card)

| Mission | Briefing (two lines max, exact text) |
|---|---|
| m1 RAIN CHECK | `THE DELTA HAS HAD RAIN FOR 40 DAYS. A WEATHER BARGE IS PUMPING IT IN.` / `FIND THE SWAN DROP, FREE THE STAFF, SINK THE BARGE.` |
| m2 HEATSTROKE HIGHWAY | `THREE MIRROR-SUNS ARE COOKING THE DESERT.` / `TAKE THE HIGHWAY TO THE SOLAR FARM AND SMASH THE LENS.` |
| m3 HURRICANE HARBOR | `A HURRICANE IS PARKED OVER THE PORT. IT HAS BEEN PARKED FOR WEEKS.` / `REACH THE LIGHTHOUSE. SOMETHING IN IT IS STEERING THE WIND.` |
| m4 WHITEOUT PEAK | `THE FRONT IS LOADING STOLEN SNOW INTO THE ENGINE AT THE SUMMIT.` / `CLIMB THE PEAK BEFORE THE NEXT AVALANCHE. OR DURING IT.` |
| m5 EYE OF THE STORM | `THE MAELSTROM ENGINE IS ABOVE THE CLOUDS. SO ARE YOU, NOW.` / `FLY IN. SHUT DOWN THE BROADCAST. CANCEL THE FORECAST.` |

### 2.4 Story beats between missions (one caption each, shown on the tally screen)

- After m1: `THE BARGE SINKS. FOR THE FIRST TIME IN 40 DAYS, A FROG LOOKS UP AND SEES A CLOUD GAP.`
- After m2: `THE LENS SHATTERS. THE DESERT COOLS DOWN TO 'VERY HOT'.`
- After m3: `THE KEEPER FALLS. THE HURRICANE WANDERS OFF, CONFUSED.`
- After m4: `A CUCKOO FLIES OUT OF THE WRECK, CHIMES TWICE AND GIVES UP.`

### 2.5 Ending

The Maelstrom Engine's core shuts down. The storm clouds unroll like a carpet and real sun
hits the deck for the first time. The fortress slowly sinks into the sea in a cloud of steam
while the Cygnet Squad parachutes down (each character with their own comic landing).

Last shot: far out at sea, the Duchess paddles away in an **inflatable swan pedal-boat**,
under a tiny personal rain cloud that follows only her. She shakes her pointer at the sky.
Caption: `FORECAST FOR TOMORROW: SUNNY. FOR HER: SCATTERED SHOWERS.`

Then: credits (§13.12), score tally, high-score entry.

---

## 3. Playable characters

All four use the shared humanoid rig, **identical stats** (run speed, jump, hitbox, grenade
count). Differences are cosmetic only: silhouette, colours, idle fidget (`bored`), death
pose details, victory pose, voice-jingle pitch and select-screen quote.

Silhouette rule: each character owns **one big shape** that reads at 1×: Juno = trailing
scarf + goggles, Otto = wide build + beanie + beard, Pip = small build + spiky hair + antenna
backpack, Rosa = wide-brim hat + long coat tails.

### 3.1 `juno` — Captain Juno Varga

- **Personality:** the squad leader. Calm, precise, dry humour. Secretly writes terrible
  poetry about battles in a small notebook.
- **Rig style:**
  - skin: medium-dark (`skinC`)
  - hair: high ponytail, glossy black (`ink`) with one blue-black highlight row
  - headgear: aviator goggles pushed up on the forehead (lenses amber)
  - top: short flight jacket, teal (`teal` / sea-green ramp) with a white collar
  - accessory: long **white scarf** that trails 10–14 px behind and waves while running
    (2-frame flutter, separate layer so it reads against every background)
  - pants: charcoal cargo pants; boots: black lace-up, knee-high
  - gloves: brown leather, fingerless
  - build: tall (rig height 37 px), slim
- **`bored` fidget:** writes in her notebook, frowns, tears the page out.
- **Victory pose:** removes the goggles, flips the scarf over her shoulder, two-finger salute.
- **Select quote:** `"FORMATION, PEOPLE. TRY TO LOOK MAJESTIC."`

### 3.2 `otto` — Sergeant Otto Bramble

- **Personality:** heavy-weapons specialist and gentle giant. Bakes for the squad. Talks to
  machines kindly before he blows them up.
- **Rig style:**
  - skin: light, ruddy cheeks (`skinA`)
  - hair: bald under the hat; **big ginger beard** (`fire` ramp, mid tones), square shape
  - headgear: rolled knitted beanie, mustard yellow (`sand` light)
  - top: sleeveless padded vest, orange (`fire` dark/mid) over a grey undershirt
  - accessory: oven mitt hanging from the belt; grenade bandolier across the chest (one
    pouch holds a muffin — a 1-px detail, optional)
  - pants: olive-brown work pants; boots: heavy brown boots, wide soles
  - gloves: thick grey work gloves
  - build: **wide** (shoulders +4 px), height 36 px
- **`bored` fidget:** pulls a muffin from a pouch, eats it in two bites, pats his belly.
- **Victory pose:** flexes both arms; beard puffs out; a single crumb falls.
- **Select quote:** `"I BROUGHT MUFFINS. AND ROCKETS. MOSTLY MUFFINS."`

### 3.3 `pip` — Corporal Pip Saito

- **Personality:** demolitions and gadgets. Fast talker, fearless, a little too happy about
  explosions. Names every grenade.
- **Rig style:**
  - skin: light-medium (`skinB`)
  - hair: **spiky**, short, violet (`violet` / purple ramp), 5 spikes on top
  - headgear: oversized radio headset with a boom mic (steel grey + red light)
  - top: yellow overalls (`sand` light / safety yellow) with rolled sleeves over a
    black-and-white striped shirt
  - accessory: **backpack with a whip antenna** (antenna 10 px, sways 1 px with movement;
    red tip pixel), wrench hanging on the strap
  - pants: (part of the overalls) yellow; boots: red high-top sneakers
  - gloves: none, taped fingers (white 1-px marks)
  - build: **small** (height 33 px), thin
- **`bored` fidget:** pulls out a tiny screwdriver, tunes the antenna, gets a small shock,
  hair spikes stand up straighter for 20 ticks.
- **Victory pose:** jumps, pumps a fist, the antenna boings.
- **Select quote:** `"IF IT TICKS, I CAN FIX IT. IF IT TICKS FASTER, RUN!"`

### 3.4 `rosa` — Lieutenant Rosa Delacroix

- **Personality:** veteran marksman and field medic, oldest in the squad. Sarcastic, unshakable,
  drinks very strong tea at the worst moments.
- **Rig style:**
  - skin: medium-light, tanned (`skinB`)
  - hair: long grey-white braid over one shoulder (`snow` mid)
  - headgear: **wide-brim bush hat** (brim 16 px wide), khaki (`sand` mid) with a red band
  - top: **long field coat** to the knees, rust-brown (`rust` / clay ramp); coat tails
    flare 2–4 px when running and jumping
  - accessory: small round spectacles (2 white pixels), medic armband (white with a red bar —
    not a cross), tin mug on the belt
  - pants: khaki; boots: dark brown riding boots
  - gloves: white cotton gloves
  - build: average (height 35 px), straight posture
- **`bored` fidget:** pours tea from a flask, sips, sighs; steam pixels rise.
- **Victory pose:** tips her hat with the pistol barrel, then blows on the barrel.
- **Select quote:** `"AIM SMALL, MISS SMALL, COMPLAIN LATER."`

### 3.5 `recruit` (test character, kept)

The existing test character `recruit` stays for `m0` and debugging: plain olive shirt, grey
pants, bare head with brown short hair, average build. It is not shown on the select screen
unless `?char=recruit` is used.

---

## 4. Core rules & controls

### 4.1 Buttons

Engine buttons: `left right up down fire jump bomb start` (default keys in ARCHITECTURE §5.2).

| Action | Input | Notes |
|---|---|---|
| Run | left / right | 1.5 px/tick; reaches full speed in 3 ticks; stops in 3 ticks |
| Jump | jump | fixed height ≈ 48 px (vy −4.6, gravity 0.22, max fall 5.0); full air control; coyote 5 ticks; jump buffer 6 ticks |
| Crouch | hold down on ground | hitbox 16×20; crouch-walk 0.6 px/tick; muzzle at hip height (y −13) |
| Drop through | down + jump on a one-way platform | ignores that platform for 12 ticks |
| Aim up | hold up | standing, running or in the air |
| Aim down | hold down in the air | on ground, down = crouch |
| Fire | fire (tap or hold) | see §5; holding the pistol auto-fires every 12 ticks |
| Knife | fire, when an enemy is in knife range | automatic replacement for the shot (§6.2) |
| Bomb | bomb | throw a grenade (§6.1); in a vehicle: vehicle special |
| Enter vehicle | touch an empty vehicle and press down, or land on its hatch | 20-tick `mount` animation, invulnerable while mounting |
| Eject | down + jump inside a vehicle | §8 |
| Pause | start (Esc) | §13.6 |

**Aim sweep.** With `machine-gun`, `quill-gun` and `arc-caster`, changing aim while firing
sweeps the stream through the in-between angles over 6 ticks (0° → 30° → 60° → 90°), so a
held burst draws a fan. Other weapons snap.

**Facing** follows the last horizontal input. The upper body can aim up while the legs run in
either direction.

### 4.2 Lives, death and respawn

- **One hit kills** the player on foot: enemy projectiles, explosions, melee swings, contact
  with creatures and machines marked `contactKill`, and hazards `spikes`, `lava`, `kill`,
  `pit` (falling below the section bottom). Touching an infantry body does **not** kill.
- **Deep water** (`water` hazard rect) kills after 30 ticks with a comic sinking animation
  (helmet floats on the surface, 3 bubbles). Floating vehicles are safe on it.
- **Death animation** 60 ticks (`die`, `die-burn` for fire). Bloodless: the character spins,
  their hat flies off, they land flat with cartoon stars.
- **Respawn:** after the animation the player drops in from the top of the view at the same
  x (clamped 32 px inside the view), plays `spawn`, and is **invulnerable for 120 ticks**
  (blinks every 4 ticks). Enemy bullets pass through a blinking player.
- **Weapon loss:** the player returns to `pistol`. Grenades reset to the difficulty's start
  count (if the player has more, they keep the higher number).
- **Unbanked hostages are lost** on death (§7.4).
- **Stormhead** status (§4.7) is cleared on death.

### 4.3 Credits and continues

- Options: `CREDITS` = 3 / 5 / 9 / FREE PLAY (default 5). One credit = one set of lives.
- When a player's last life is lost: **CONTINUE?** with a countdown `9`→`0`, 60 ticks per
  number. Pressing fire skips 20 ticks of the current number (genre convention). Pressing
  start continues: −1 credit, full lives, respawn at the death position, **score kept**,
  continue counter +1 (shown in the final tally).
- 1 player: the world freezes and darkens to 50 % during the countdown.
- 2 players: if the partner is alive, the world keeps running; the countdown is drawn in the
  dead player's HUD corner.
- Countdown reaches 0 (all players out) → **GAME OVER** (§13.9) → high-score entry if
  qualified.

### 4.4 Time limit

- Each section has a timer (default by difficulty, §4.6). It resets to full at every
  checkpoint and when a new section starts.
- At 0: `TIME OVER!` banner, every on-foot or mounted player loses a life, the timer resets.
- The timer pauses during mission intro cards, vehicle drop cut-ins, boss intro sequences
  and the mission-complete tally. It runs during boss fights.
- Sections with an auto-scroll (m2-b, m4-a, m5-a) and boss arenas use `timeLimit: 99`.

### 4.5 Co-op (2 players)

- **Drop-in:** the idle player presses start at any time (costs 1 credit, except FREE PLAY).
  They parachute in at the top-centre of the view with 120 ticks of invulnerability.
- **No friendly fire.** Player explosions never hurt players or player vehicles.
- **Camera:** follows the midpoint of the living players. It ratchets forward only when the
  rear player is at least 16 px from the left edge; a player cannot walk out of the view.
  In vertical sections the same rule applies on the y axis.
- **Hostages:** the first player to touch frees the hostage; the item is handed to that
  player. Both players see the hostage counter on their own HUD side.
- **Vehicles:** one pilot per vehicle; the Buckboard has a second seat for a gunner (§8.2).
- **Scaling (2 players):** boss HP ×1.5; machine HP ×1.25; infantry and creature HP ×1.0;
  wave entries tagged `coop` spawn only in 2-player games.
- **Scores, lives and weapons are separate.** Pickups are taken by whoever touches them.

### 4.6 Difficulty levels

Selected on the mode screen. Values are multipliers on the numbers in this document.

| Parameter | EASY | NORMAL | HARD |
|---|---|---|---|
| Lives per credit | 5 | 3 | 3 |
| Start / respawn grenades | 15 | 10 | 8 |
| Section timer (s) | 99 | 60 | 45 |
| Enemy projectile speed | ×0.8 | ×1.0 | ×1.2 |
| Enemy attack cooldowns | ×1.4 | ×1.0 | ×0.75 |
| Telegraph durations | ×1.25 | ×1.0 | ×0.85 (never below 20 ticks) |
| Machine and boss HP | ×0.8 | ×1.0 | ×1.25 |
| Ammo per weapon pickup | ×1.5 | ×1.0 | ×1.0 |
| Respawn invulnerability | 150 ticks | 120 | 120 |
| Wave entries tagged `hard` | off | off | on |
| Score multiplier (all in-game score, not tally) | ×0.5 | ×1.0 | ×1.5 |

### 4.7 Status gimmick: STORMHEAD (original)

A grumpy little personal rain cloud attaches itself above the player's head.

- **Cause:** hit by a `cloud-seeder` shell (fired by `whirligig` and `nimbus-blimp`), or
  touching the body (not the tendrils) of a `jellycloud`. These hits do **not** kill — they
  give Stormhead instead. A second Stormhead hit while already clouded **does** kill
  (lightning comedy death: the character is shocked black, hair standing up, falls over).
- **Look:** a 18×9 px dark-grey cloud 6 px above the head, rain streaks (1-px blue lines,
  fxRng) falling on the player, hair/hat drawn 1 px lower ("soaked"), a puddle splash
  particle at every step, a grumpy face on the cloud (2 eye pixels, frown line).
- **Effects (duration 600 ticks):**
  - run speed ×0.75, jump height ×0.85 ("soggy boots");
  - **grenades cannot be thrown** (wet fuses — a fizzle sfx plays instead);
  - **upside — CALL LIGHTNING:** the bomb button makes the cloud strike the nearest enemy on
    screen with a lightning bolt from the top of the view: 12 damage (`laser` kind), also
    hits everything in a 12-px-wide column. Cooldown 90 ticks. Telegraph: the cloud puffs
    up white for 8 ticks before the strike.
- **Cure (any):** 600 ticks pass; stand within 24 px of a heat source (campfire decor tagged
  `heat`, `lava`, burning `torch` flames, a `heatwaver` flame); pick up `pickup-towel`;
  in co-op the partner can shoot the cloud (6 hits) to burst it; death.
- **Ending gag:** when cured, the cloud gives a tiny sad thunder-rumble and drifts away.
- Vehicles are immune: a cloud-seeder hit on a vehicle just bounces off the hatch.

### 4.8 Extra lives

- Score extends at **200 000** and **600 000** points (per player): +1 life, `item/1up` sfx,
  `1UP!` popup.
- `pickup-1up` item (§7.1): +1 life.
- Lives display caps at 9.

### 4.9 Suggested tuning constants (`src/game/tuning.ts`)

| Constant | Value |
|---|---|
| `GRAVITY` | 0.22 px/tick² |
| `MAX_FALL` | 5.0 px/tick |
| `RUN_SPEED` | 1.5 |
| `CROUCH_SPEED` | 0.6 |
| `JUMP_VY` | −4.6 |
| `COYOTE_TICKS` | 5 |
| `JUMP_BUFFER_TICKS` | 6 |
| `RESPAWN_INVULN` | 120 |
| `DEATH_ANIM_TICKS` | 60 |
| `KNIFE_RANGE` | 24 × 28 box in front of the hip |
| `PICKUP_MAGNET` | none (items must be touched) |
| `BULLET_LIMIT_PLAYER` | 40 player projectiles alive per player (oldest removed) |

---

## 5. Weapons

Damage scale: `rifleman` has 1 HP; a pistol bullet does 1. Eight guns in total (the pistol
plus seven pickups), each with its own *shape* on screen so players can read a co-op partner's
weapon at a glance: dot, stream, cone, flame, wobbling rockets, lightning, fan, skipping discs.

| id | Name | Crate letter | Ammo per pickup | Behaviour | Damage | Cooldown (ticks) | Speed (px/tick) | Pierce / area | Pose | sfx id | Announcer line |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pistol` | SERVICE PISTOL | — | ∞ | Single shot. Tap fires when ready; hold auto-fires every 12 ticks. 8×2 px yellow tracer. | 1 | 6 (tap) / 12 (hold) | 7 | none | pistol | `weapon/pistol` | — |
| `machine-gun` | MACHINE GUN | **M** | 200 (1 per bullet) | Continuous stream while held, ±1 px vertical jitter, aim sweep (§4.1). | 1 | 4 | 8 | none | heavy | `weapon/machine-gun` | `"MACHINE GUN!"` |
| `blunderbuss` | BLUNDERBUSS | **B** | 25 | 6 pellets in a ±15° cone; pellets slow by 0.25/tick and vanish after 14 ticks (range ≈ 95 px). Small knockback on infantry (they slide 8 px). | 2 per pellet | 28 | 7.5 → 4 | each pellet pierces 2 infantry | heavy | `weapon/blunderbuss` | `"BLUNDERBUSS!"` |
| `torch` | TORCH HOSE | **T** | 30 bursts | A burst = 8 flame blobs over 24 ticks; blobs fall slightly (gravity 0.05), grow 6→14 px, die after 28 ticks. A blob that touches ground leaves a burning patch 16×8 px for 60 ticks. Clears Stormhead of the user. | blob: 1 per 6 ticks while overlapping; patch: 1 per 10 ticks (`fire`) | 24 | 4.5 | pierces everything | heavy | `weapon/torch` | `"TORCH HOSE!"` |
| `bottle-rocket` | BOTTLE ROCKETS | **R** | 30 shots (2 rockets each) | Two rockets fan ±10°, wobble ±6 px (sine, period 10) for 20 ticks, then fly straight and accelerate +0.3/tick. Explode on enemy, terrain or after 90 ticks. Coloured spark trail. | 6 direct + 8 blast | 24 | 2 → 8 | blast r 16 | heavy | `weapon/bottle-rocket` | `"BOTTLE ROCKETS!"` |
| `arc-caster` | ARC CASTER | **A** | 120 | Instant lightning bolt to the nearest enemy hurtbox within 128 px inside a 40° cone around the aim; chains to 2 more targets within 56 px (each target once). No target: straight 128 px bolt that stops at the first solid. Bolt drawn 6 ticks (jagged 2-px line, white core, cyan edge). Captured Cold Front tech. | 4 / 3 / 2 (`laser`) | 12 | instant | chains to 3 targets | heavy | `weapon/arc-caster` | `"ARC CASTER!"` |
| `quill-gun` | QUILL GUN | **Q** | 150 | Fan of 3 steel quills at −7°, 0°, +7°. Quills pass through infantry and creatures; they stop on machines, boss parts and terrain (stick in walls 30 ticks as decor). | 1 each | 9 | 9 | infinite vs infantry and creatures | heavy | `weapon/quill-gun` | `"QUILL GUN!"` |
| `skipper` | SKIPPER MINES | **S** | 30 | A flat disc mine slides along the ground and hops (vy −2.5) like a stone skipping on water: hops over gaps up to 32 px and steps up to 12 px; explodes on enemy contact or at the end of its 3rd hop. On `water` it skims 5 hops. Fired in the air: drops in an arc and starts skipping on landing. Fired up: lobbed at 60°. | 4 contact + 10 blast | 20 | 4 (ground) | blast r 20 | heavy | `weapon/skipper` | `"SKIPPER!"` |

**Rules.**
- **Same weapon picked up again:** add the pickup amount; cap at 3× the pickup amount
  (for example the machine gun caps at 600). Announcer line plays again.
- **Different weapon picked up:** replaces the current one; ammo = pickup amount.
- **Ammo reaches 0:** automatic switch to `pistol`, `weapon/empty` click, the HUD box flashes.
- **Death:** back to `pistol` (§4.2).
- Difficulty EASY: ammo per pickup ×1.5 (§4.6).
- Crate letters render with the `big` font in white on a red metal box (14×14), with a 1-px
  dark outline. All seven letters (M B T R A Q S) are different, so they are easy to tell
  apart.
- Player projectile cap: 40 per player; the oldest is removed first.

---

## 6. Bombs & melee

### 6.1 Grenade — id `grenade`

| Property | Value |
|---|---|
| Count | Start / respawn: difficulty value (10 on NORMAL). `pickup-bombs` +10. Cap 99. |
| Throw | From the `hand` point. Forward: vx 2.6 × facing + 0.5 × player vx, vy −3.2. Aiming up: vx 0.8 × facing, vy −4.6. Aiming down in the air: vx 0.5 × facing, vy +1.0. |
| Flight | gravity 0.20; spins (4-frame sprite, 2 ticks per frame), 6×6 px, dark olive with a yellow band |
| Bounce | First ground contact: bounces once (vy × −0.45, vx × 0.6). Walls: vx × −0.5. |
| Detonation | On second ground contact, on touching any enemy hurtbox, or after a 90-tick fuse |
| Blast | Radius 24 px, 10 damage (`explosion`), `fx/explosion-m`, shake 2 px for 8 ticks |
| Limits | Max 2 grenades in flight per player; throw cooldown 14 ticks |
| Animation | `torso-<w>-throw` (≥4 frames); usable while running, jumping and crouching |
| Stormhead | Cannot be thrown; the bomb button calls lightning instead (§4.7) |

### 6.2 Knife — id `knife`

| Property | Value |
|---|---|
| Trigger | Fire pressed while an enemy hurtbox tagged `meleeable` overlaps the knife box. It replaces the shot of any weapon (no ammo used). |
| Knife box | 24 px forward × 28 px tall from the feet; crouched 24 × 18 |
| Damage | 4 (`knife`) per slash |
| Timing | 12-tick slash (4 frames × 3 ticks), cooldown 14 ticks; the legs keep running |
| Special | The knife reaches around a `brolly-guard` umbrella (hits the body directly). Knife kills score ×2. |
| Tagged `meleeable` | All infantry, creatures under 40 px, boss parts marked `melee: true` in §10 |
| Not available | In vehicles. (The knife still works during Stormhead.) |

### 6.3 Vehicle shells and specials (summary; details in §8)

| id | Vehicle | Damage | Area | Speed / arc | Count per entry |
|---|---|---|---|---|---|
| `honk-shell` | Swan | 20 | blast r 28 | vx 5, vy −1.2, gravity 0.12 | 10 |
| `tumble-mine` | Buckboard | 20 | blast r 24 | dropped behind, rolls at vx −1 relative to the buggy | 8 |
| `depth-charge` | Bathtub | 16 | blast r 24 (also under water) | lobbed vx 2, vy −3, sinks at 1.5 in water | 10 |
| `swarm-missile` | Gullwing | 6 each | blast r 10 | 4 per volley, home with a 4°/tick turn rate, speed 5 | 20 volleys |

`pickup-shells` adds 10 to the mounted vehicle's special count.

---

## 7. Items & hostages

### 7.1 Pickups

| id | Look (size px) | Effect | Score |
|---|---|---|---|
| `crate` | Wooden supply crate 20×18 with rope bands; variant `metal` (steel, rivets) | Breakable container. HP 3 (wood) or 8 (metal); one knife slash or one explosion breaks wood. Drops its `contents`. | 50 when broken |
| `pickup-weapon` | 14×14 red box with a white crate letter, bobs 1 px | Gives `params.weapon` (§5) | 200 |
| `pickup-bombs` | 14×12 canvas bag with three grenade tops | +10 grenades | 200 |
| `pickup-food` | `params.kind`: `toast` (12×8, golden), `soup` (12×10, red tin + steam), `fish-can` (14×8, silver tin), `pie` (14×10, crust with lattice), `cake` (16×14, pink layer cake, rare) | Score only | toast 100, soup 300, fish-can 500, pie 1 000, cake 3 000 |
| `pickup-gem` | `params.kind`: `gem-blue` (8×8), `gem-red` (8×8), `gem-gold` (10×10), `medal` (10×12, stolen "Weather Order" medal), `crown` (16×12, hidden) | Score only, sparkle fx | blue 1 000, red 2 000, gold 5 000, medal 10 000, crown 50 000 |
| `pickup-1up` | 12×12 brass squad badge with a swan neck outline and "1UP" | +1 life | 0 |
| `pickup-towel` | 14×10 striped beach towel | Cures Stormhead; otherwise just score | 100 |
| `pickup-shells` | 14×12 olive ammo can with a shell icon | Mounted pilot only: +10 vehicle specials. On foot it is not collected. | 500 |
| `pickup-repair` | 14×14 wrench + oil can | Mounted pilot only: +1 HP cell (max = vehicle cells). On foot it is not collected. | 500 |

Items on the ground despawn after 600 ticks (they blink for the last 120). Items from crates
pop up (vy −2.5) and land.

### 7.2 Hostages — id `hostage`

The hostages are the **kidnapped weather staff**: plump scientists and presenters in knitted
bobble hats, long striped scarves and woolly jumpers (fully clothed, assorted rig styles and
colours). They are tied up with coiled green **garden hose**. When freed they unwind the hose,
salute with a clipboard, rummage in their scarf (`give`, hand point), hand over an item, then a
red **weather balloon** inflates from their backpack and they float up and away, waving.

| `params.kind` | Setup | How to free | Gives (default) |
|---|---|---|---|
| `forecaster` | Sitting tied to a weathervane post | Touch, or any player shot/blast hits them | weapon (mission table) |
| `balloonist` | Tangled under a weather balloon caught 40–56 px up on a pole, tree or crane; dangling by a rope | Shoot the rope (hp 1) or blast near it → they drop, bounce once on their bottom (comic), then walk | bombs or weapon |
| `cook` | Kidnapped camp cook in an apron and a pot helmet, tied to a stool next to a cooking pot | Touch or shot | food (pie 50 %, soup 50 %), or a scripted `pickup-1up` |
| `caged` | Inside a round-top cage (24×32, hp 12) | Destroy the cage | gem (red 60 %, gold 40 %) |
| `stowaway` | Hidden in a `crate` with `contents: 'hostage'`; pops out with a "TA-DA" pose | Break the crate | scripted `pickup-1up` or `gem-gold` |
| `runner` | Already loose, panicking: runs back and forth in a 64-px band | Touch | `pickup-towel` (m3, m5) or food |

**Behaviour after release.**
1. `freed` animation (24 ticks).
2. Walks toward the nearest player at 0.8 px/tick for up to 240 ticks; stops when within
   16 px. If no player is reachable (gap, wall), they stop and give where they stand.
3. `give` (20 ticks): the item spawns at the `hand` point and pops 16 px forward.
4. Salute (12 ticks), balloon inflates (16 ticks), floats up at 0.6 px/tick and despawns
   off the top of the view.
5. Hostages are `neutral`: enemy fire never hurts them, and they never block shots.
6. Score +500 and `hostage/thanks` jingle at the moment of release.

### 7.3 Drop tables

A script entry can set `drop` explicitly (`{ weapon: 'torch' }`, `'bombs'`, `{ food: 'pie' }`,
`{ gem: 'gem-gold' }`, `'1up'`, `'towel'`) or `'auto'`. `'auto'` rolls with `world.rng`
using the mission table:

| Mission | Weighted table for `'auto'` (weights) |
|---|---|
| m1 | machine-gun 40, blunderbuss 25, bombs 20, food 15 |
| m2 | machine-gun 25, torch 25, bottle-rocket 20, bombs 20, food 10 |
| m3 | machine-gun 20, skipper 25, quill-gun 20, bombs 20, food 15 |
| m4 | machine-gun 20, torch 20, arc-caster 20, bottle-rocket 15, bombs 15, food 10 |
| m5 | arc-caster 25, quill-gun 20, machine-gun 20, bottle-rocket 15, bombs 20 |

- `food` without a kind: toast 40, soup 30, fish-can 20, pie 10.
- Crate `contents: 'auto'`: bombs 30, food 40, gem-blue 20, weapon (mission table) 10.
- Enemy drops: `forecaster-officer` always drops `gem-red`; `kite-trooper` drops
  `pickup-bombs` 15 %; `whirligig` drops food 20 %; `nimbus-blimp` gondola drops
  `pickup-weapon` (mission table) 100 %.

### 7.4 Rescue bonus and the "banking" rule

- Each released hostage: **+500** at once.
- Released hostages are first **unbanked** (drawn as small red balloons next to the player's
  lives on the HUD). At the next checkpoint or section exit they become **banked** (balloons
  turn into a tally number with a tick sound).
- **When a player dies, their unbanked hostages are lost**: the balloons on the HUD pop
  one by one (1 per 4 ticks, soft pop sfx). Banked hostages are never lost — not even by
  continuing.
- **Mission tally:** 2 000 points per banked hostage. **FULL FLOCK bonus +20 000** when the
  player banked at least the mission target (m1 8, m2 8, m3 9, m4 9, m5 6 — each route of a
  branch holds enough hostages to reach it).
- Co-op: each player keeps their own counts.

---

## 8. Player vehicles

Four rides, four control feels: a **walker** that hops and glides, a **buggy** in a high-speed
chase, a **hover-tub** that slides on water, and a **jet** in a shoot-em-up flight.

### 8.0 Shared vehicle rules

| Rule | Value |
|---|---|
| HP | `cells × 24` points. HUD shows the cells as a bar under the pilot's weapon box. |
| Damage taken | enemy bullet 2, rocket or shell 8, explosion 12, flame 1 per 6 ticks, `laser` 8, `crush` 24 (one cell), contact with an enemy machine 4 per 20 ticks |
| Pilot safety | While mounted, the pilot cannot be hit; the vehicle takes all damage. |
| Enter | Touch an empty vehicle and press down, or land on its hatch. `mount` animation 20 ticks, invulnerable. Empty vehicles are invulnerable and enemies ignore them. |
| Eject | down + jump: the pilot pops up (vy −4.5) with 60 ticks of invulnerability; the vehicle stays parked and can be re-entered. |
| Critical | At 0 HP: the vehicle flashes red and smokes, `vehicle/alarm` for 60 ticks, then auto-ejects the pilot and explodes (blast r 40, 30 damage to enemies). |
| Ram | Ejecting with left/right held launches the empty vehicle in that direction as a ram (each vehicle's own version below). |
| Hazards | A pit, lava or `kill` zone destroys the vehicle; the pilot is auto-ejected upward (vy −6, 60 ticks invulnerability) to get a chance to land. |
| Pickups | `pickup-shells` +10 specials, `pickup-repair` +1 cell; weapon pickups are stored for the pilot (they take the weapon when they eject), except in the Gullwing (§8.4). |
| Carry-over | A vehicle that is mounted when the player takes a section exit is carried into the next section (session stores id, HP and specials; the pilot starts mounted). If the mission runtime does not support this in v1, the vehicle is left behind and the next section places a spare where noted. |
| Sprite ids | `vehicle/<id>/<part-or-anim>` |

### 8.1 `swan` — SW-3 "SWAN" walker tank

- **Look and size:** 72 × 80 px standing (hull 40 × 28). A boxy armoured hull in white
  enamel with teal stripes and a stencilled "3"; a **long armoured neck** of three segments
  (8 px thick) rising from the front; a wedge-shaped **head turret** with twin barrels (the
  "beak", orange tips) and one round visor; **two reverse-jointed legs** with three-toed feet;
  small armoured wing flaps on the hull sides. The pilot's head shows in the rear hatch.
  Built from the machine kit: plates, rivets, barrels; legs are two-bone limbs.
- **Controls:** walk 1.2 px/tick (8-frame step cycle, `swan/step` thud every 4th frame);
  **down** = kneel (height 52 px, smaller hitbox, ducks shots); **jump** = hop
  (vy −4.2, ≈ 40 px); **hold jump in the air** = wing flaps, glide (max fall 1.2 px/tick
  for up to 90 ticks, then normal fall).
- **HP cells:** 4.
- **Main gun — BEAK VULCAN:** the neck aims in 16 steps over a 225° arc (from straight back-up,
  through up and forward, to 45° below forward); it turns 1 step per 3 ticks toward the held
  direction. Fires alternate barrels: 1 damage, cooldown 4, speed 8, infinite ammo.
- **Special — HONK SHELL** (bomb): a heavy shell from the beak in the current aim:
  vx 5 along the aim, gravity 0.12, 20 damage, blast r 28, cooldown 30, 10 per entry.
  The Swan honks (`swan/honk`) with every shot; the neck recoils 4 px.
- **Stomp:** landing on enemies after a hop deals 10 `crush` (kills infantry outright).
- **Ram — SWAN DIVE:** eject with a direction held: the empty Swan stretches its neck and
  sprints at 3 px/tick for up to 120 ticks, exploding on the first enemy or solid
  (60 damage, blast r 48, shake 4 px / 20 ticks).
- **Where:** m1-b (parachute drop at x 160 — set piece), m4-d (spare dropped by a cargo
  glider at the arena start). Carry-over allowed from m1-b into the m1 branch sections.

### 8.2 `buckboard` — BUCKBOARD dune buggy

- **Look and size:** 88 × 44 px. Open-frame desert buggy, sand-yellow with a red side stripe,
  big balloon rear tyres (20 px) and smaller front tyres, a roll cage, a spare tyre and a
  jerry can on the back, a swivel gun on the roll bar. Driver in front, empty gunner seat
  behind.
- **Context:** m2-b is an auto-scroll chase (camera moves right at 2.0 px/tick).
- **Controls:** left/right change speed relative to the scroll (−1.5 … +1.5 px/tick); the
  buggy stays between screen x 24 and 300. **Jump** = hop (vy −4.0, ≈ 36 px); ramps (decor
  with a `ramp` tag on the ground line) launch with vy −6.0.
- **HP cells:** 3.
- **Main gun — SAND HORNET:** the roll-bar swivel gun points instantly in the held direction
  (8 directions; with no direction held it points forward): 1 damage, cooldown 5, speed 8,
  infinite.
- **Co-op gunner seat:** a second player who jumps on becomes the gunner. The gunner aims the
  swivel gun (8 directions, cooldown 4) and still throws grenades; the driver then fires a
  fixed bonnet gun forward (1 damage, cooldown 6).
- **Special — TUMBLE MINE** (bomb): drops a spiked barrel behind; it rolls back at 1 px/tick
  relative to the ground and explodes on contact (20 damage, blast r 24); cooldown 30;
  8 per entry.
- **Ram — NITRO:** double-tap forward: +2.5 px/tick for 30 ticks, the front deals 30 `impact`
  per contact and ignores frontal damage; cooldown 180 ticks (a small flame gauge next to
  the HP cells refills).
- **Eject:** standard. In the chase, a player on foot is pushed by the left view edge.
- **Spare rule (m2-b only):** if a buggy is destroyed, a new empty Buckboard rolls in from
  the left edge after 180 ticks, matching the scroll speed, and waits for a pilot.
- **Where:** m2-b (whole section). Carry-over into the m2 branch sections is **not**
  allowed (the canyon road ends at a collapsed bridge; set piece).

### 8.3 `bathtub` — BATHTUB amphibious hover-tub

- **Look and size:** 80 × 40 px. A giant clawfoot bathtub turned into an armoured
  hovercraft: white enamel hull with bolted steel plates, a thick black rubber skirt
  underneath, a caged rear fan (24 px), two stubby cannons sticking out of the soap dish,
  a periscope shaped like a shower head and a **rubber-duck figurehead** on the bow.
- **Controls:** hovers over water and land at up to 1.6 px/tick with momentum (accel 0.08,
  friction 0.04 — it slides); **jump** = hop (vy −3.6); on water it bobs with a 2-px sine
  wave (period 60 ticks). Spray particles behind.
- **HP cells:** 3.
- **Main gun — TAP CANNONS:** two forward barrels fire alternately; aim forward or, with up
  held, up-forward 30°: 2 damage, cooldown 6, speed 7, infinite.
- **Special — DEPTH CHARGE** (bomb): lobbed barrel (vx 2, vy −3); in water it sinks at
  1.5 px/tick and explodes after 30 ticks or on contact; on land it explodes on the second
  bounce. 16 damage, blast r 24, cooldown 24, 10 per entry. Hits underwater enemies
  (`mudskipper` in the water, submerged mines).
- **Ram — HOVER DASH:** double-tap forward: 3.5 px/tick for 24 ticks, the front deals
  25 `impact`; on water it leaves a white wake; cooldown 120.
- **Eject:** standard on land. **Over deep water the eject input is ignored.** If the tub is
  destroyed over water, the pilot is thrown up and the burnt tub floats for 300 ticks as a
  one-way platform (32 px wide) before it sinks.
- **Where:** m3-a (whole section; second empty tub parked at x 1700 as a spare).

### 8.4 `gullwing` — GULLWING VTOL jet

- **Look and size:** 64 × 32 px. Stubby twin-tail jet with **inverted gull wings** (bent
  down at the root, up at the tips), a big round cockpit bubble with the pilot's head
  showing their headgear, a white nose with teal stripes like the Swan, two underwing
  missile pods, a flickering exhaust flame.
- **Context:** m5-a is a horizontal shoot-em-up section (auto-scroll right 1.0 px/tick,
  height 216).
- **Controls:** free 8-direction flight at 2.0 px/tick (diagonal 1.4), clamped inside the
  view with an 8-px margin; the jet tilts 1 frame when moving up or down.
- **HP cells:** 4.
- **Main gun — NOSE VULCAN:** always fires forward; level 1 = two parallel streams; level 2 =
  three streams (0°, ±6°); level 3 = five streams (0°, ±6°, ±12°). 1 damage per bullet,
  cooldown 4, speed 9. **Any `pickup-weapon` collected in flight raises the level by 1**
  (max 3) instead of giving a gun; the level drops to 1 when a jet is lost.
- **Special — SWARM MISSILES** (bomb): a volley of 4 micro-missiles that home on the
  nearest enemies (turn rate 4°/tick, speed 5): 6 damage each, blast r 10; cooldown 40;
  20 volleys per jet.
- **Evade/ram — BARREL ROLL** (jump): a 24-tick roll, invulnerable, 1.5× speed in the held
  direction; small enemies hit during the roll take 10 `impact`; cooldown 60.
- **Eject:** disabled (there is no ground). Losing the jet costs a life; a new Gullwing
  flies in from the left with 120 ticks of invulnerability.
- **Where:** m5-a (whole section). It ends with a crash landing on the fortress deck
  (set piece, §11.5).

---

## 9. Enemy faction — the Cold Front

**Overview.** The Cold Front is a weather-obsessed private army. Everything it owns is named
after weather, painted **slate blue + safety yellow**, and powered by boilers, umbrellas,
lightning rods, kites, mirrors and clockwork. Infantry share the humanoid rig with one
uniform base and per-mission variants (rig colour swaps, no new art):

| `params.variant` | Missions | Change |
|---|---|---|
| `poncho` | m1 | Olive-yellow rain poncho over the coat, hat brim drips |
| `desert` | m2 | Sand scarf over the hat, sleeves rolled, coat in sand-grey |
| `sailor` | m3 | Yellow sou'wester and oilskin coat, rubber boots |
| `parka` | m4 | White parka with fur hood, snow goggles |
| `elite` | m5 | Black coat with a silver bolt patch, **2 HP** (score +50 %) |

**Shared behaviour rules.**
- Every attack has a **telegraph** (shape change + sound) of at least 20 ticks (§4.6 scales it).
- Infantry are `meleeable` and have no contact damage; they swing a melee attack instead.
- Idle infantry play `gag` animations until alerted (player within 200 px, or a player shot
  lands within 64 px). Alert = `!` bubble + small hop, 20 ticks.
- When a player vehicle is within 96 px, infantry may `panic` (30 % chance per second): they
  open a tiny umbrella and run away at 1.8 px/tick.
- Enemy bullet: 6×3 px orange pellet with a dark outline. Enemy projectiles are drawn
  brighter than player shots on purpose (danger reads first).
- Death variants are chosen by damage kind: `bullet`/`laser` → `die`; `explosion`/`impact` →
  `die-blast`; `fire` → `die-burn`; `knife` → `die-knife`. Deaths are bloodless (§1).

### 9.1 Infantry

| id | Name | Look and size (px) | HP | Score | Behaviour | Attacks (telegraph → attack → recovery) | Death variants | Missions |
|---|---|---|---|---|---|---|---|---|
| `rifleman` | DRIZZLER | 36 tall. Slate-blue greatcoat, yellow rain hat with long back brim, round tinted goggles, black boots, bolt-action rifle | 1 | 100 | Gags: hides under a newspaper, wrings out a sock, reads the forecast and groans. Advances to 80–140 px from the player, crouches at random, retreats when hit nearby. | **Rifle:** raises rifle 24 ticks (muzzle glint at tick 20) → 1 bullet 2.5 px/tick → cooldown 90–150 (rng). **Grenade:** arm back with grenade visible 30 ticks → arc vx 2, vy −3.5, explodes on landing r 16. **Butt swing:** player within 18 px: 18-tick wind-up → 20-px hitbox for 6 ticks → 30 recovery. | `die`: spins, hat flies off, flat with stars. `die-blast`: launched up spinning, soot-black. `die-burn`: charred, hops off-screen with smoking pants. `die-knife`: X-eyes, topples stiff like a plank. | all |
| `brolly-guard` | BROLLY GUARD | 38 tall + steel umbrella canopy 30 wide (dark grey, red trim) held in front like a shield | body 3, umbrella 20 | 300 | Walks at 0.6 px/tick with the open umbrella facing the player; the umbrella absorbs frontal bullets. If a grenade is above him, he flips the umbrella up (10 ticks). The knife reaches around it. | **Poke:** closes umbrella 16 ticks (vulnerable) → lunge 28 px → 30 recovery. **Twirl reflect:** canopy spins slowly 30 ticks (spin lines) → for 60 ticks reflects player bullets back at 2 px/tick (they become enemy shots). Every 240 ticks. | Umbrella breaks: canopy flips inside-out, he panics and runs. `die`: umbrella spins up and drifts down slowly after him. Others as rifleman. | m1, m3, m5 |
| `hailer` | HAILER | 30 tall kneeling, short mortar tube 12 px, basket of white-blue shells | 3 | 300 | Stays 120–220 px away, behind sandbags or on ledges; never advances. | **Hail shell:** drops shell in tube 40 ticks (`enemy/mortar-load` "thoonk") → a blue target ring appears where it will land and stays 50 ticks → 8-px ice ball lands, shatters into 3 shards (vx −1.5 / 0 / +1.5, vy −2, each lethal) → cooldown 150. | `die`: tube fires straight up; the last shell lands on his own head (harmless "bonk", stars). | m1, m3, m4 |
| `thunder-trooper` | THUNDER TROOPER | 36 tall, backpack battery with a whip lightning rod, shoulder rocket tube | 2 | 300 | Keeps 100–180 px; prefers vehicles as targets. | **Rocket:** kneels 45 ticks (tube end glows, backblast smoke puffs) → slow rocket 1.2 px/tick accelerating +0.05/tick to 3, steering 1°/tick toward the target for 60 ticks; the rocket has 1 HP (50 pts) → cooldown 180. | `die`: battery discharges — he glows yellow, hair stands up, goes soot-black, falls backward. | m2, m3, m4, m5 |
| `sleet-sniper` | SLEET SNIPER | 36 tall (or 16-tall prone), grey-white cloak, long scoped rifle | 2 | 500 | Static in windows, on ledges and in crow's nests. | **Laser shot:** red dotted sight line from muzzle to the player's chest tracks for 60 ticks → line stops and turns white for 12 ticks → bullet 6 px/tick along the line → cooldown 150. | `die`: falls out of the window with a long synth yell; his hat stays on the ledge. | m2, m4, m5 |
| `heatwaver` | HEATWAVER | 38 tall, bulky silver heat suit, round welding visor, two red fuel tanks on the back | 4; tanks 2 | 400 | Walks 0.5 px/tick. Shots from behind or above hit the tanks: they explode (r 32, 20 damage to enemies) and kill him. | **Flame jet:** blue pilot light grows at the nozzle 30 ticks → flame 64 long × 16 tall for 60 ticks (sweeps 10° up and back) → 40 recovery. Cooldown 120. His flames cure Stormhead (and kill). | `die`: tanks pop and he rockets up off-screen with a whistle. | m2, m4, m5 |
| `kite-trooper` | KITE TROOPER | 36 tall soldier hanging under a red-and-yellow delta kite 40×20 | 1; kite 2 | 200 (+100 kite) | Glides in from the top corner (vx −1.0, vy 0.5) and lands, then acts as a `rifleman`. Kite shot down → he drops, lands dazed (stars, 60 ticks), then acts as a rifleman. | **Drop bomb:** when within ±16 px above a player: lets go with a falling whistle (12 ticks) → small bomb falls straight, r 12. Max 2 bombs. | Mid-air `die`: spins down holding the kite like a leaf. | m1, m2, m4, m5 |
| `forecaster-officer` | FRONT FORECASTER | 38 tall, navy long coat, peaked cap with a **spinning weathervane**, pointer stick, wheeled weather-map board 20×24 | 4 | 1 000 (+ `gem-red`) | Stays behind his troops; flees when alone. | **Volley call:** points the stick at a player 60 ticks (the board flips to a red X over a sun icon, whistle) → every `rifleman` on screen fires at once (ignores cooldowns). **Reinforce:** every 300 ticks blows the whistle (30 ticks) → 2 riflemen run in from the nearest edge. | `die`: the board falls on his head; the weathervane keeps spinning on the ground. | m1–m5 (1–2 each) |

### 9.2 Machines (vehicles, aircraft, turrets)

All machines are built with the machine kit (plates, rivets, treads, wheels, rotors, barrels)
in slate blue with yellow hazard stripes; damage states: at 50 % HP add smoke and a dented
plate; at 25 % add flames and sparks.

| id | Name | Look and size (px) | HP | Score | Behaviour | Attacks (telegraph → attack → recovery) | Death | Missions |
|---|---|---|---|---|---|---|---|---|
| `kettle-tank` | KETTLE TANK | 56×52. Tall rounded boiler body on short treads, copper spout cannon in front, brass bands, whistle valve and a lid hatch on top | 60 | 3 000 | Rolls 0.4 px/tick toward the player, stops 120–200 px away. Contact pushes. | **Spout shell:** whistle shrieks + steam jet from the valve 40 ticks → shell lobbed at the player's x (gravity 0.15), blast r 24 → cooldown 150. **Steam burst** (player within 48 px): lid rattles 30 ticks → steam cloud 48×32 in front for 40 ticks (lethal) → 40 recovery. | Lid blows off spinning high; 2 coughing riflemen pop out and run; hull sags into scrap. | m1, m2, m4 |
| `gale-jeep` | GALE JEEP | 72×36. Open jeep with a striped canvas umbrella canopy; driver and rear gunner | 30 | 1 500 | Drives in at 2 px/tick, brakes 160 px from the player, drops 2 riflemen, then fights. In chases it matches the scroll and weaves. | **Burst:** rear gun turns toward the player 30 ticks → 3 bullets (3 px/tick, 6 ticks apart) → cooldown 90. **Ram:** player on the ground in its lane: revs 20 ticks (exhaust puffs) → 3 px/tick charge, contact lethal. | Flips over, wheels spin, the crew crawls out and runs. | m2, m3, m4 |
| `plow-crawler` | PLOW CRAWLER | 80×44. Snowplow tractor, huge angled front blade (invulnerable, yellow-black stripes), cab with driver, exhaust stack | 50 (cab top and back only) | 2 500 | Pushes forward 0.5 px/tick; the blade is a moving solid that shoves players and snow piles. | **Charge:** exhaust black puffs 30 ticks → 2 px/tick for 60 ticks; pinning a player against a solid = `crush` death. **Snow chunk:** every 120 ticks the blade flicks a snow chunk in an arc (r 12). | Blade falls off, the cab door pops open, the driver runs away holding his hat. | m4 |
| `squall-boat` | SQUALL BOAT | 96×40. Small gunboat with a cloud-and-bolt flag, bow gun, depth-bomb rack | 50 | 2 500 | Moves on water 0.8–1.6 px/tick; crossing at full speed sends a wake that rocks floating things ±4 px. | **Bow burst:** gun swivels + flash 30 ticks → 3 shots 3 px/tick. **Depth bomb:** rack tilts 24 ticks → lobbed bomb r 20 (also explodes in water). Cooldown 100. | Sinks bow-first; the crew jumps overboard wearing arm floats. | m1, m3 |
| `whirligig` | WHIRLIGIG | 48×32. Open-frame autogyro, big two-blade rotor, pilot in goggles, bomb hook | 12 | 800 | Flies in a sine (amplitude 16, period 120) at y 30–70, crosses and returns twice, then leaves. Variant `seeder` carries cloud-seeder shells. | **Bomb drop:** over a player ±24 px: red shadow marker on the ground 30 ticks → bomb falls straight, r 16. **Cloud seeder** (`seeder`): puffball shell in an arc that bursts into a small drifting grey cloud (lingers 60 ticks) → Stormhead on touch. Cooldown 100. | Rotor flies off spinning; the body drops and explodes; the pilot floats down under a tiny umbrella. | m1, m3, m4, m5 |
| `sleet-jet` | SLEET JET | 40×20. Small swept-wing fighter, slate blue with a yellow nose | 6 | 500 | Flies path presets: `dive`, `sine`, `loop`, `strafe`, in groups of 3–5. | **Aimed shot:** nose flash 12 ticks → 1 bullet 3 px/tick at the player. Max 1 shot per pass. | Puffs black smoke, spirals down. | m5 |
| `nimbus-blimp` | NIMBUS BLIMP | 160×64. Blimp covered in bumpy grey cloud padding (fake cloud), gondola 32×16 underneath, 2 side turrets | gondola 60 (weak point), turrets 15 each; envelope invulnerable | 5 000 | Drifts across the top of the view at 0.3 px/tick. | **Drop troops:** belly hatch opens 20 ticks → 2 kite-troopers, every 300 ticks. **Turret shot:** barrel turns 20 ticks → aimed bullet, cooldown 120. **Cloud seeder:** every 240 ticks (as `whirligig`). | Envelope deflates with a long whistle, loops across the sky and crashes in the background (fx only). Gondola drops a weapon crate. | m3, m5 |
| `tesla-mast` | TESLA MAST | 24×64 pylon with 3 ceramic rings and a copper ball; ground or ceiling mounted (`flipY`) | 25 | 1 000 | Static. | **Arc:** sparks climb the rings 60 ticks (hum rises) → jagged bolt along the ground in front, 96 px, for 20 ticks (ceiling: straight down, 8 wide) → 60 recovery. | Ball pops off, the mast short-circuits with comic sparks and flops over. | m4, m5 |

### 9.3 Creatures (storm-mutated wildlife and clockwork)

Creatures carry the weather of their biome as a **colour accent** (yellow storm stripe,
ice-blue crystals, glowing sparks). They use simple generated shapes: ellipses, segments,
legs as 2-bone limbs.

| id | Name | Look and size (px) | HP | Score | Behaviour | Attacks (telegraph → attack → recovery) | Death | Missions |
|---|---|---|---|---|---|---|---|---|
| `bog-toad` | BOG TOAD | 32×24. Squat green-brown toad with a yellow zig-zag stripe on its back and a huge throat sac | 8 | 400 | Hops toward the player every 60 ticks (32 px arc). No contact damage (it pushes). | **Croak:** throat sac inflates 40 ticks (grows 4→14 px, turns pale) → ground shockwave 6 px tall travels both ways at 3 px/tick for 48 px (jump it) → 40 recovery. | Deflates like a balloon, zips around in loops, lands flat. | m1 |
| `zap-moth` | ZAP MOTH | 16×12. Chunky moth with glowing yellow wings (2-frame flap), sparks trail | 1 | 100 | Swarms of 5–8. Drift in sine; steer at 1.2 px/tick toward the nearest player who fired in the last 30 ticks ("attracted to muzzle flashes"); otherwise toward light decor. | **Contact:** lethal spark. No telegraph, but slow and bright. | Pops into a little sparkle. | m1, m2, m4 |
| `dune-eel` | DUNE EEL | 64×16. Five round sand-coloured segments, head 16×14 with a wide jaw and two tiny eyes | 10 (head only; the body blocks bullets) | 600 | Hidden in sand. Every 150 ticks picks the player's current x. | **Leap:** sand ripple + dust jets at the exit point 50 ticks → leaps out in a 96-px-wide arc (peak 56 px) over that spot and dives back in; contact lethal → 60 hidden. | Stiffens mid-air and drops like a stick, dizzy stars. | m2 |
| `mudskipper` | MUDSKIPPER | 24×16. Mutated fish on two stubby legs, big googly eyes, tiny yellow rain hood | 3 | 300 | On land: flops forward in 16-px hops. In water: hides. | **Leap:** bubbles at the surface 30 ticks → leaps in an arc at the player (contact lethal), then flops on land. | Bounces, flips on its back, X-eyes, tail twitch. | m1, m3 |
| `frost-ram` | FROST RAM | 48×36. Mutant mountain ram, shaggy white fleece, glowing ice-crystal horns | 14 | 800 | Paces; standing contact only pushes. | **Charge:** paws the ground 40 ticks (frost snorts, head lowers) → 3.5 px/tick for up to 200 px, lethal → hitting a solid stuns it 90 ticks with stars (takes ×2 damage while stunned). | Fleece puffs off like popcorn; a bald, embarrassed ram runs off-screen. | m4 |
| `jellycloud` | JELLYCLOUD | 32×32. Floating storm-jellyfish: a grey cloud-shaped bell with a sleepy face, 4 dangling yellow lightning tendrils 20 long | 6 | 500 | Drifts 0.4 px/tick, bobbing. Tendrils lethal. Touching the bell → Stormhead (§4.7). | **Lightning drop:** underside glows yellow 40 ticks → vertical bolt from it to the ground, 8 wide, 16 ticks → 120 cooldown. | Bursts into a short drizzle of rain pixels. | m4, m5 |
| `clockwork-hound` | CLOCKWORK HOUND | 32×20. Robot dog of brass plates and rivets, turning wind-up key on its back, one red eye | 6 | 400 | Runs 2.2 px/tick toward the player. | **Pounce:** within 80 px: crouches and the eye blinks red 20 ticks → leap vx 3, vy −3.5, contact lethal → on a miss skids 24 px (30 ticks). | The key spins wildly; springs and 8 gears burst out; the head bounces away. | m4, m5 |

### 9.4 Mini-bosses

| id | Name | Look and size (px) | Parts (HP) | Score | Attacks (telegraph → attack → recovery) | Death | Mission |
|---|---|---|---|---|---|---|---|
| `sand-schooner` | SAND SCHOONER | 240×120. A land-yacht warship on three giant spoked wheels, two big patched sails, a crow's nest, three broadside gun ports, a captain with a telescope | cannons 3 × 30, crow's nest 25, **mast 80** (weak point: when it falls, the fight ends) | 20 000 | Drives on the raised parallel road (upper lane, ground y 112) at the scroll speed. **Broadside:** ports open 20 ticks, cannons poke out, smoke puffs 30 ticks → 3 cannonballs (staggered 10 ticks) lobbed at the buggy's x, r 20 → 90 recovery. **Crow's nest sniper:** as `sleet-sniper`. **Sail gust:** sails bulge 30 ticks → a gust pushes the buggy back 1 px/tick for 60 ticks (use NITRO). | The mast cracks and falls; sails collapse over the deck; the schooner tips off the road into a dune; 5 staggered explosions. | m2-b |
| `dockside-grabber` | DOCKSIDE GRABBER | Container crane: gantry rail across the top of the arena, **cab 40×32** on the rail, 3-finger claw (24×20) on a cable | cab 120 (weak point), claw 60 | 15 000 | **Container drop:** the claw brings a 48×24 container from off-screen right, stops over a player (container shadow on the ground), fingers twitch 30 ticks → it falls (`crush`) and stays as a solid block (max 3; the 4th drop smashes the oldest). **Claw snatch:** cable shakes and the claw opens 24 ticks → it drops at 6 px/tick to the ground, lethal → 40 ticks stuck (shoot it). **Phase 2 (cab < 50 %): cable sweep:** cable sparks 30 ticks → the claw swings left–right at 40 px height for 120 ticks (crouch or jump). | Cab sparks and leans; the whole crane topples into the sea with a giant splash (fx). | m3-b |
| `blizzard-cannon` | BLIZZARD CANNON | 128×96. A giant snow-making cannon on a turntable at the top of the frozen dam; two round snow tanks; small operator cab | barrel 100, tanks 2 × 50, cab 40 | 15 000 | **Snowball volley:** barrel aims 30 ticks → 3 big snowballs (16 px, 3 HP each) that land and roll down the dam ledges (lethal, roll off the edges) → 60 recovery. **Blizzard blast:** tanks hiss 40 ticks → snow cone 96×48 for 60 ticks that pushes players back 1 px/tick (lethal only via pits). **Icicle rain:** barrel thumps the roof, 30-tick shake with falling powder → 6 icicles fall at marked x positions. | The barrel droops and sneezes one last giant snowball that rolls away and smashes the ice wall — opening both branch exits (§11.4). | m4-b |

---

## 10. Bosses

Each boss tests a **different skill**:

| Boss | Skill tested | Spectacle hook |
|---|---|---|
| m1 Drenchnought | Reading lobbed arcs, jumping low waves | A warship turns around mid-fight; the rain stops when it sinks |
| m2 Mirage Engine | Spotting the real target among copies | Heat-mirage copies; it melts into a glass statue |
| m3 Gale Keeper | Vertical awareness (a boss taller than the screen) | A lighthouse stands up on stilts and bows to attack |
| m4 Cuckoo Chalet | Fighting while the screen scrolls | A chalet on skis races down the mountain; the cuckoo pops out on the hour |
| m5 Final (three stages) | Everything, plus reading icon telegraphs | A weather map decides the attack; the floor collapses into the vortex |

**Shared boss rules.**
- Boss parts are separate hurtboxes with their own HP. A destroyed part shows a broken
  sprite (smoke, sparks) and stops its attack. Part score: **2 000** each (in addition to the
  boss score).
- Hit flash 2 ticks per hit; parts below 30 % HP smoke.
- Every attack has a telegraph ≥ 20 ticks (difficulty-scaled, §4.6).
- Boss intro: camera locks, music switches to `boss` (m5: `boss-final`), name card
  `WARNING!` + boss name for 120 ticks (timer paused). Optional: a thin boss HP bar at the
  bottom of the HUD (§13.4).
- 2 players: all boss HP ×1.5.
- HP below is NORMAL, 1 player.
- Sprite ids: `boss/<id>/<part-or-anim>`.

### 10.1 m1 — `drenchnought` — THE DRENCHNOUGHT

- **Concept:** the Cold Front's rain barge: an armoured river paddle-steamer that pumps river
  water up into the clouds through two giant sprinkler turrets, keeping the delta flooded.
  Commanded by **Captain Gumboot**, a round officer in a huge yellow rain hat.
- **Look and size:** 300 × 150 px. Hull 288 × 64 (slate-blue riveted plates, yellow
  waterline stripe), a tall smokestack 24 × 56 with a brass rim, two rotating sprinkler
  turrets 32 × 32 (fore and aft), a bow ram with a cannon, a bridge cabin 48 × 32 with
  armoured shutters, and a big red **paddle wheel** (64 diameter) at the stern.
- **Arena:** section `m1-d` (§11.1). Wooden dock (ground y 168) from view x 0–200; two
  floating crate platforms (one-way, 32 wide, y 140, bob ±2 px) at view x 210 and 260;
  deep water from view x 200 to the right edge (water hazard from y 184). The boat floats on
  the right and drifts ±40 px. Camera locked.

| Part | HP | Notes |
|---|---|---|
| `bow-cannon` | 120 | low on the bow, phase 1 |
| `sprinkler-fore` | 80 | phase 1 |
| `sprinkler-aft` | 80 | phase 1 |
| `smokestack` | 100 | all phases until destroyed |
| `paddle-wheel` | 200 | phase 2 (exposed after the turn) |
| `bridge` | 150 | phase 3 weak point (shutters open), `melee: true` when the bow touches the dock |

**Phase 1 — Broadside** (until bow cannon and both sprinklers are destroyed)

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Bow shot | Cannon lowers, barrel glows orange, 30 ticks | Shell flies flat along the dock at 3 px/tick, 10 px tall (jump it) | 60 |
| Sprinkler arc | Turret spins up with mist puffs, 40 ticks | 8 water pellets in a fan over 40 ticks, each lands across the dock (gravity 0.1) | 60 |
| Stack mortar | Black smoke from the stack 40 ticks + blue target ring on the dock | Barrel bomb lands, blast r 24 | 90 |

Order: bow shot → sprinkler (fore/aft alternate) → stack mortar → repeat, 30 ticks between.

**Transition:** steam whistle blast (60 ticks); the boat reverses out of view to the right at
2 px/tick, then returns stern-first (sprite `flipX`) — the paddle wheel now faces the dock.

**Phase 2 — Paddle Surge** (until the paddle wheel is destroyed)

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Surge | Wheel spins faster, spray 40 ticks | The boat surges 40 px toward the dock; the water hazard rises 8 px for 90 ticks, flooding the low dock planks (stand on the crate platforms or the high dock end) | 60 |
| Barrel fling | Wheel stops with a clunk 24 ticks | Flings 3 barrels in arcs; they bounce and roll on the dock (2 HP each, 100 pts) | 60 |
| Deck crew | Hatch bangs open 20 ticks | 2 `rifleman` (`poncho`) appear on the deck and fire; every 300 ticks | — |

**Phase 3 — Captain's Last Stand** (bridge shutters open; the boat lists 6°)

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Flare volley | Captain Gumboot aims his flare pistol 24 ticks | 3 parachute flares arc high, then drift down at 0.5 px/tick for 120 ticks (lethal, area denial) | 60 |
| Bow slam | The bow rises with a siren, 40 ticks | Bow slams the water: 2 waves run along the dock surface (6 px tall, 2.5 px/tick) | 60 |

- **Death sequence (240 ticks):** 6 explosions along the hull (10 ticks apart, shake 3);
  the smokestack topples onto the dock (harmless debris); the bow rises and the boat slides
  under; Captain Gumboot paddles away in a rubber ring shaking his fist. **The rain stops**:
  rain fx off, the sky gradient brightens over 120 ticks, one sunbeam. Then mission
  complete.
- **Score:** 30 000 + parts.

### 10.2 m2 — `mirage-engine` — THE MIRAGE ENGINE

- **Concept:** a giant solar crawler that focuses the light of the three mirror-suns into a
  heat beam, and projects heat-mirage copies of itself to confuse attackers.
- **Look and size:** 256 × 176 px. Bronze tracked chassis 224 × 56 on four bogie wheels;
  a 120-px **golden mirror dish** on a lifting arm (vertical gradient white → yellow → amber,
  bright rim); a red-orange **lens core** (24 px) in the dish centre; two missile racks
  (32 × 24) on the chassis sides; radiator fins at the back; a heat shimmer over everything
  (2-px horizontal wobble of the top rows every 8 ticks).
- **Arena:** section `m2-d` (§11.2). Flat ground y 176; two one-way solar-panel platforms
  (48 wide, y 128) at view x 70 and 190. The boss moves between view x 200 and 330.

| Part | HP | Notes |
|---|---|---|
| `lens` | 220 | phase 1 weak point; ×2 damage during the vent window |
| `rack-left`, `rack-right` | 60 each | phases 1–2 |
| `mirage-mast` | 250 | phase 2 weak point (real crawler only) |
| `core` | 180 | phase 3 weak point |

Bullets that hit the dish rim (not the lens) ricochet harmlessly into the sky with sparks
(feedback: "aim at the red spot").

**Phase 1 — Sunbeam**

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Sunbeam sweep | Dish tilts down and glows white 60 ticks; an orange line marks the start point on the ground | The beam's ground impact (a 16 × 40 column of flame) sweeps from the boss to the left edge at 3 px/tick (jump over it) | **Vent window** 60: dish vents steam, lens takes ×2 damage |
| Missile salvo | Rack hatches flap open 30 ticks | 4 missiles fly up off-screen; red crosshairs appear on the ground at the players' x for 45 ticks; missiles fall there (r 16) | 60 |

**Transition:** the lens cracks, the dish breaks off and falls behind the chassis (dust,
shake 4 for 30 ticks); the mast rises from the chassis (60 ticks).

**Phase 2 — Mirage**

- The mast projects **2 copies** of the crawler (same sprite, alpha 0.6, 1-px shimmer). The
  three stand in slots at view x 80, 200 and 320 and move in sync.
- **Only the real crawler casts a dark ground shadow.** Shots pass through copies (copies
  flicker when hit). Copy attacks are drawn semi-transparent and are harmless.
- Every 300 ticks, all three fade out (30 ticks) and reappear in shuffled slots; the real
  shadow appears 20 ticks before the bodies.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Heat rings | Mast glows red 40 ticks | 3 rings expand from the mast top (radius +2 px/tick up to 140, 4 px thick, 40 ticks apart); where a ring crosses the ground, players must jump it | 60 |
| Missile salvo | as phase 1 (if a rack survives) | as phase 1 | 60 |

**Phase 3 — Meltdown** (copies vanish; the chassis top becomes a moving platform)

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Crawler charge | Treads spin in place, dust 40 ticks | Charges left at 2.5 px/tick to view x 40, then backs up at 1 px/tick. The front is lethal; the **top is a platform** (stand on it and shoot down at the core) | 40 |
| Glass spit | Core pulses white 30 ticks | 4 molten glass blobs in arcs; each leaves a burning patch (16 × 6) for 60 ticks | 50 |

- **Death sequence (240 ticks):** the core whistles; cracks spread; the crawler melts into a
  puddle that hardens into a giant **green glass statue** of itself (palette swap to a
  glass ramp), holds for 60 ticks, then shatters into sparkling shards. The three mirror-suns
  in the background dim one by one.
- **Score:** 35 000 + parts.

### 10.3 m3 — `gale-keeper` — THE GALE KEEPER

- **Concept:** the harbour lighthouse, rebuilt as a walking robot whose storm-beacon steers
  the hurricane.
- **Look and size:** 176 × 256 px (taller than the view: in phase 1 the lantern is above the
  top edge; only its searchlight beam is visible). Red-and-white striped tapered tower (96 px
  wide at the base, 64 at the top); lantern room with iron shutters and a yellow lamp
  (48 × 40); a gallery balcony with two cannons; a big brass **foghorn** in the middle of the
  tower (40 × 32); a left arm made of chain with a ship's anchor. Phase 2 adds four
  mechanical stilt legs (each 12 × 80) under the base.
- **Arena:** section `m3-d` (§11.3). Rocky pier (ground y 176) from view x 0 to 260; sea to
  the right (water hazard from y 190). Two one-way buoy platforms (24 wide, y 136, bob ±3 px)
  at view x 120 and 210. Heavy rain and wind particles. Camera locked.

| Part | HP | Notes |
|---|---|---|
| `cannon-left`, `cannon-right` | 70 each | gallery balcony, phase 1 |
| `foghorn` | 140 | phases 1–2 |
| `anchor-arm` | 100 | phases 1–2 |
| `lamp` | 260 | weak point; damage only when the shutters are open |

**Phase 1 — Standing Watch** (foundation in the sea)

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Searchlight | Beam (translucent yellow cone) sweeps the pier for 120 ticks | A player inside the beam for 30 ticks is `SPOTTED!` (text pop): the cannons fire 3 shells at that spot, 20 ticks apart, each with a 30-tick marker | 40 |
| Foghorn blast | Horn vibrates and glows 45 ticks, low rumble | Two sound-wave arcs travel left at 2.5 px/tick: first low (jump), 40 ticks later high (crouch) | 50 |
| Anchor slam | Chain rattles, anchor rises 40 ticks; its shadow marks the spot | Anchor slams down (lethal 24 × 24), then drags back along the ground at 1.5 px/tick (jump it) | 60 |

**Transition** (both cannons and the foghorn destroyed, or 50 % of total HP lost): the
foundation cracks, the tower rises 40 px on four stilts (shake 4 for 60 ticks).

**Phase 2 — Stilt Walk**

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Bow beam | The tower bends toward the pier 60 ticks; shutters open (lamp exposed) | A sustained beam along the pier 22–32 px above the ground for 60 ticks (crouch under it) | 60 — shutters stay open, lamp takes ×1.5 |
| Stilt stomp | One leg lifts 30 ticks; its shadow marks the spot | Stomp + ground shockwave both ways (6 px tall, 3 px/tick) | 40 |
| Anchor slam | as phase 1 (if the arm survives) | | |

**Phase 3 — Storm Call** (lamp below 40 %): the lamp spins and stays exposed.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Lightning call | 4 yellow markers on the pier and buoys, 40 ticks | 4 lightning strikes (8 wide, 16 ticks) | 40 |
| Storm surge | A big wave rises on the horizon, 60 ticks | The water hazard rises 12 px for 120 ticks: the low pier floods — stand on the buoys or the rock ledge (pier x 0–48 is 16 px higher) | 60 |

- **Death sequence (240 ticks):** the lamp shatters in a white flash (fade 20 ticks); the
  tower tips toward the sea in 3 slow steps and falls with a giant splash (water particles,
  shake 6); the storm clouds spiral away; a keeper's cap floats on the water.
- **Score:** 40 000 + parts.

### 10.4 m4 — `cuckoo-chalet` — THE CUCKOO CHALET

- **Concept:** the Cold Front's mountain headquarters: a giant alpine chalet built around a
  clockwork cuckoo-clock engine and mounted on two enormous skis. When the squad reaches the
  summit, it launches down the mountain — and the fight happens **while the screen scrolls**.
- **Look and size:** 288 × 192 px. Two storeys of dark timber beams and white plaster, red
  shutters, a steep snow-covered roof with a chimney, a big round **clock face** on the gable
  (64 px, black hands that really move), a small **cuckoo door** (20 × 20) above the clock,
  two balconies with flower boxes (hidden gun ports), a pendulum with pine-cone weights under
  the floor, and two giant skis (300 long, curled tips) that work as **moving platforms**.
- **Arena:** section `m4-d` (§11.4): auto-scroll right at 1.5 px/tick on a downhill slope with
  moguls; the chalet stays between view x 220 and 360 and lunges left at times. A spare
  **Swan** is dropped at the start (§8.1). Phase 3 stops the scroll (camera lock).
- **The clock rule (main telegraph):** the minute hand turns once every **360 ticks**. A soft
  tick plays every 30 ticks and speeds up in the last 60 ticks. When the hand reaches 12
  ("on the hour"), the cuckoo door opens and the **cuckoo** pops out for 90 ticks — the only
  time the weak point can be hit.

| Part | HP | Notes |
|---|---|---|
| `chimney` | 120 | phase 1 |
| `balcony-left`, `balcony-right` | 70 each | phase 1 |
| `cuckoo` | 300 | weak point, only while the door is open. If it reaches 0 in phase 1 or 2, the chalet skips straight to phase 3. Damage dealt here also lowers the `cuckoo-bot` HP (see phase 3) |
| `gearworks` | 200 | phase 2 (exposed when the roof blows off) |
| `cuckoo-bot` | 220 | phase 3, a separate walking body (60 × 60) |

**Phase 1 — Downhill Race**

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Snowball mortar | Chimney puffs 30 ticks | 2 big snowballs (16 px, 3 HP) land and roll left at 2 px/tick | 40 |
| Balcony gunners | Flower boxes flip open 20 ticks | 2 riflemen (`parka`) pop up and fire 2 shots each, then duck | 60 |
| Ski lunge | Skis carve with snow spray 40 ticks | The chalet lunges 120 px left and back over 90 ticks; the pendulum sweeps under the floor (lethal); the **ski tips are platforms** players can ride | 40 |
| On the hour | Clock ticking speeds up; hand reaches 12 | Door opens, the cuckoo pops out with a two-note "CUCKOO" (synth), beak opens 20 ticks → **cuckoo darts:** 5 wooden bird-shaped darts in a fan, 2.5 px/tick | door closes after 90 ticks |

**Transition** (chimney and both balconies destroyed): the roof blows off and spins away;
the gearworks are exposed; the clock goes haywire (hands spin) and the hour now comes every
**240 ticks**.

**Phase 2 — Haywire Clock**

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Gear saws | Gearworks screech, sparks 30 ticks | 2 saw-gears (24 px) roll left at 3 px/tick, hopping over moguls (jump them) | 40 |
| Chime quake | The bell swings — 3 tolls, 20 ticks apart | Each toll sends a ground shockwave (6 px tall, 3 px/tick) — jump in rhythm | 40 |
| On the hour | as phase 1 (every 240 ticks) | cuckoo darts, now 7 in the fan | |

**Phase 3 — The Cuckoo Gets Out** (gearworks destroyed): the chalet hits a giant pine tree
and collapses in a cloud of snow; scroll stops (camera lock). The **cuckoo-bot** — a wooden
clockwork bird with a spring neck, painted red and yellow, 60 × 60 — bursts out. Its HP is
220 minus 1/3 of the damage the `cuckoo` part already took (reward for early hits).

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Hop stomp | Crouches 24 ticks; shadow at the target spot | Leaps to the player's x, lands with a shockwave both ways | 40 |
| Spring peck | Neck coils, spring compresses 30 ticks | Neck shoots out 64 px at head height (crouch or jump) | 40 |
| Cuckoo darts | Beak opens 20 ticks | 5-dart fan | 60 |

- **Death sequence (200 ticks):** the cuckoo-bot freezes, says "cuckoo" twice in falling
  pitch, springs and gears burst out, and it falls apart into wooden pieces; the clock face
  rolls away down the mountain and out of view.
- **Score:** 45 000 + parts.

### 10.5 m5 — the final boss: three stages

The final fight happens in section `m5-d` after the **Storm Crown** prelude (end of m5-a).
The three stages run back to back; a stage change refills nothing but gives a 90-tick
breather with pickups.

#### Prelude (m5-a) — `storm-crown` — THE STORM CROWN (shoot-em-up mini-boss)

- **Look and size:** 320 × 200: the top of the Maelstrom Engine — a ring of **4 giant lightning
  rods** (16 × 120 each, copper with ceramic rings) around a central **cloud cannon**
  (64 × 48, a swirling grey muzzle), on a dark steel dome. It scrolls in from the right and
  stops (the flight scroll stops while it lives).
- **Parts:** `rod-1`…`rod-4` 100 each; `cloud-cannon` 250 (vulnerable after 2 rods fall).

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Rod chain | Two rods glow white 40 ticks | A lightning beam joins them across the screen for 40 ticks (fly above or below) | 40 |
| Storm ball | Muzzle swirls 40 ticks | A slow ball (2 px/tick) that bursts into 8 bullets after 60 ticks | 60 |
| Hail curtain | Rumble + 2 lighter sky "gaps" shown 30 ticks | Hail falls in vertical lanes except the 2 gaps, 90 ticks | 40 |
| Jelly launch | Cannon coughs 20 ticks | 3 `jellycloud`s drift out | — |

- **Death:** the crown cracks; a falling rod clips the Gullwing — **crash landing** set piece
  (§11.5). Score 40 000 + parts.

#### Stage 1 — `grand-forecaster` — THE GRAND FORECASTER (studio fight)

- **Concept:** the Duchess's giant presenter mech in her TV studio inside the Engine. It
  rises from the studio floor, waist up, to deliver "the forecast".
- **Look and size:** 300 × 200. Wide purple armour "blazer" with big shoulder pads, a head
  shaped like a **grey-white cumulus hairdo** with a cockpit window where the Duchess sits,
  a **weather-map screen** chest (96 × 64, blue map with white coastlines), a right arm that
  is a giant **pointer stick**, a left hand holding big magnetic weather icons, two
  cloud-shaped shoulder pods. Studio lights hang above; an `ON AIR` sign glows red.
- **Arena:** `m5-d` studio: flat floor y 176, three one-way lighting-rig platforms
  (48 wide) at y 120 (view x 40, 168, 296 — the right one is in front of the boss).
- **The weather map rule (main telegraph):** every attack starts with the left hand
  slapping a 32-px icon onto the chest map with a jingle (`boss/forecast-sting`). The icon
  says what comes next. Between forecasts the screen shows static for 60 ticks — **the
  `map-screen` part takes damage only during static**.

| Part | HP | Notes |
|---|---|---|
| `pointer-arm` | 200 | pointer jab, laser dot |
| `pod-left`, `pod-right` | 150 each | cloud-seeder puffs |
| `map-screen` | 300 | weak point during static |
| `cockpit` | 250 | stage 2 weak point |

| Icon | Telegraph | Attack | Recovery |
|---|---|---|---|
| SUN | Icon + 3 studio lights turn orange 40 ticks, light cones mark 3 lanes | Heat beams strike down those 3 lanes for 40 ticks | 40 |
| RAIN/HAIL | Icon + rumble 30 ticks; 2 safe spots marked by umbrella decals on the floor | Hail falls over the whole floor except the 2 safe spots, 90 ticks | 40 |
| WIND | Icon + wall fans spin up 30 ticks | Wind pushes players 0.8 px/tick toward one side for 180 ticks while the pointer attacks | 40 |
| LIGHTNING | Icon + 5 yellow floor markers 40 ticks | 5 strikes | 40 |
| (any time) Pointer jab | Arm draws back 30 ticks | Jab along the floor at 24–34 px height (crouch) | 40 |
| (any time) Cloud puffs | Pod opens 30 ticks | 2 slow homing cloud puffs (Stormhead on touch, 1 HP each) | 60 |

Order: SUN → RAIN → WIND → LIGHTNING, then random without repeats; pointer jab and cloud puffs
interleave every 2nd forecast.

#### Stage 2 — THE FALL (`grand-forecaster`, phase 2)

- **Trigger:** `map-screen` destroyed. The screen shows `TECHNICAL DIFFICULTIES`, the
  studio floor cracks (60 ticks shake) and **breaks**: players, three floor chunks and the
  mech fall into the vortex.
- **How it is built:** the camera stays put. The background layers scroll **upward** fast
  (animated `offsetY`, 6 px/tick on the near layer) and debris sprites rise past; the three
  floor chunks (96, 80, 96 px wide, at view x 0, 144, 288) stay on screen as solids that bob
  ±4 px; the gaps between them are `kill` zones (falling in costs a life; the player respawns
  on the middle chunk). The mech's upper body falls beside the chunks on the right.
- **Attacks** (the Duchess now opens the cockpit and shouts her forecasts — a speech bubble
  shows the icon):

| Forecast | Telegraph | Attack | Recovery |
|---|---|---|---|
| SNOW | Bubble icon 30 ticks | The chunks ice over for 240 ticks (friction ×0.2) | 30 |
| WIND | Bubble icon + streak lines 30 ticks | Push toward the gaps 0.6 px/tick for 120 ticks | 40 |
| LIGHTNING | 3 markers 40 ticks | 3 strikes | 40 |
| Debris | Shadows on the chunks 40 ticks | Rubble falls from above (lethal 16 × 16) | — |

- **Weak point:** `cockpit` (250). When it breaks, the cockpit ejects (stage 3).

#### Stage 3 — `duchess-pod` — DUCHESS ISOBAR'S BROLLY POD

- **Concept:** the fall ends in the **eye of the storm**: perfect calm, blue sky, sunshine,
  birdsong — the swirling storm wall all around. The Duchess flies her escape pod.
- **Look and size:** 64 × 56: a purple armoured umbrella canopy with gold ribs, a glass
  bubble under it with the Duchess inside (hairdo pressed against the glass), two little
  propellers at the sides.
- **Arena:** the core cap of the Engine: flat round metal ground y 176 across the view, two
  one-way vent platforms (y 128) at view x 80 and 256. Camera locked.

| Part | HP | Notes |
|---|---|---|
| `canopy` | 200 | ribs break off as it takes damage |
| `bubble` | 300 | final weak point (the Duchess) |

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| Umbrella spin | Canopy spins up 30 ticks | 3 rings of 12 raindrop bullets (2 px/tick), each ring rotated 10° | 40 |
| Forecast dive | She shouts a pun in a speech bubble 30 ticks; shadow on the ground | Diagonal dive to the shadow, then climbs back | 40 |
| Final forecast (below 30 %) | All 5 icons appear around the arena edge, each lights up 40 ticks before it fires | SUN beam, HAIL lane, WIND push, LIGHTNING strike, then a FOG fade (0.5 dark, 120 ticks) in sequence | 60 |

Speech-bubble puns (random, no repeats): `"CLOUDY WITH A CHANCE OF DOOM!"`, `"EXPECT HEAVY
SQUALLS. FROM ME!"`, `"I PREDICT... YOUR DEFEAT!"`, `"BRING A COAT. BRING TWO!"`.

- **Death sequence (360 ticks):** the propellers stop; the pod flutters down like a broken
  umbrella, bounces on the core cap and rolls off the edge with a long falling whistle. The
  Engine's hum dies; the storm wall unrolls; the ending starts (§2.5, §13.11).
- **Score:** Grand Forecaster 60 000, Duchess Pod 100 000 (+ parts).

---

## 11. Missions

### 11.0 Notation and shared helpers

- `cam ≥ X` — wait until the camera's left edge reaches world x X (`waitCamera`).
- `R+16` / `L−16` — spawn 16 px outside the right / left view edge, at ground height unless
  a y is given. `@x` — world x. y values are world y (ground baseline 176 unless stated).
- `[coop]` — spawn only with 2 players. `[hard]` — spawn only on HARD.
- `H:kind(drop)` — hostage of that kind with that drop (§7.2, §7.3).
  `C:contents` — wooden crate; `CM:contents` — metal crate.
- `lock A–B` — camera lock with view left edge from A to B (B − A ≥ 0; a 384-wide arena
  uses `lock A–A`); `unlock when clear` = after `waitAllDead` of the wave.
- `t+N` — N ticks after the previous line in the same block.
- Ground notation follows the builder style: `at(0,176).flat(480).slope(80,-16)…`
  (`slope(dx, dy)`; negative dy goes up), `gap(w)` = pit of width w.
- Sprite decor ids for set pieces: `decor/<mission>/<name>`.

**Mission-local helpers** (built by mission agents inside their own folders, no engine change):
- `rainFx(world, density)` / `snowFx(world, density, windX)` — weather particles from
  `fxRng` spawned at the view top each tick (density 0–3).
- `darkness(alpha, flashEvery)` — a full-screen `fade` overlay; a lightning flash sets
  alpha 0 for 4 ticks and plays `env/thunder`.
- `fallingPlatform`, `movingPlatform(path, speed)`, `breakable(hp, onBreak)` — dynamic solids
  built on the world's moving-solid support (ARCHITECTURE §5.9).

**Requests to other owners** (needed by the spectacle set pieces):
1. Camera **auto-scroll**: `camera.autoScroll(vx, vy)` that moves the lock window at a fixed
   speed (m2-b, m4-a, m4-d, m5-a). Players pushed by the trailing edge are not killed.
2. Parallax **layer drift**: per-layer `driftX` / `driftY` (px per tick added to the layer
   offset) for treadmill and falling scenes (m2-b schooner fight, m5-d stage 2).
3. A section-level `water` hazard whose top can be **raised and lowered by script**
   (m1-d, m3-c, m3-d).

### 11.1 m1 — RAIN CHECK (Monsoon Delta)

- **Biome and mood:** jungle river delta in a monsoon. Deep greens and teal, slate-blue sky,
  grey rain streaks, white lightning flashes, warm orange lamps on Front gear.
- **Music:** `m1` (sections a–c), `boss` (m1-d). **Hostage target:** 8. Rain fx density 2
  throughout (stops after the boss).
- **Route:** `m1-a` → `m1-b` → branch (`m1-c1` canopy | `m1-c2` river) → `m1-d` boss.

#### `m1-a` — DELTA LANDING · 2560 × 216 · scroll right · checkpoints x 1000, 1900

- **Ground:** `at(0,176).flat(480).slope(80,-16).flat(340).gap(48).flat(352).slope(16,8)
  .flat(184).slope(16,8).flat(124).gap(120).flat(800)` — plateau y 160 at x 560–1300, temple
  floor y 168 at x 1316–1500, river bank y 176 at x 1516–1640, **river pit x 1640–1760**
  (deep-water hazard), bank y 176 at x 1760–2560.
- **Platforms (wood):** log over the first gap x 896–944 y 158; temple ledges x 1320–1400 y 128
  and x 1420–1500 y 100; ruin ledge x 2200–2300 y 120.
- **Solids:** sandbag wall x 800–832, y 144–160; ruin pillar x 1284–1300, y 112–160.
- **Background:** `sky-gradient` {top `#2c3a4a`, bottom `#5a6a5a`} factor 0; `clouds`
  {dark grey, heavy} factor 0.1; `jungle` {dark teal} factor 0.3; `treeline` {deep green}
  factor 0.6; front layer `jungle` {black-green leaves, front: true, factorX 1.2, offsetY 150}
  at 50 % density.
- **Terrain style:** `{ ground: 'mud', edge: 'moss', platform: 'wood', solid: 'rock' }`.

| Trigger | Event |
|---|---|
| start | Intro card (§13.4). Players parachute in at x 64 (`spawn`). Announcer: `"MISSION ONE. BRING AN UMBRELLA!"` |
| cam ≥ 0 | 2 `rifleman` (`poncho`) @300, @340 in `gag` (newspaper shelter), facing left |
| cam ≥ 160 | `H:forecaster(machine-gun)` @520. `C:bombs` @600 |
| cam ≥ 300 | 3 `rifleman` from R+16, 30 ticks apart. `hailer` @850 behind the sandbags. [coop] +1 rifleman |
| cam ≥ 520 | **Set piece — Lightning Dark:** `darkness(0.75, 30)` for 150 ticks; 4 `rifleman` advance from R+16 (visible only in flashes and by their muzzle glints) |
| cam ≥ 700 | 2 `bog-toad` hop out of the puddles @1000, @1060 |
| cam ≥ 760 | 2 `kite-trooper` from the top-right corner, 60 ticks apart |
| cam ≥ 900 | `CM:{weapon:'blunderbuss'}` @1180. `H:balloonist(bombs)` tangled in a tree @1240, y 112 |
| cam ≥ 1000 | Checkpoint. **lock 1116–1116** (arena): `forecaster-officer` @1460 on the upper ledge; 2 `rifleman` R+16; t+180: 2 `rifleman` L−16; t+300: 1 `brolly-guard` R+16; [coop] +2 rifleman; [hard] +1 hailer @1440 y 100. Unlock when clear |
| cam ≥ 1300 | **Set piece — Tree Bridge:** giant tree @1600 (decor + `breakable(20)` trunk base with a red target ring; a `SHOOT!` arrow appears after 180 ticks if nobody hits it). On break it falls in 40 ticks (`env/timber`) and becomes a dynamic solid 160 × 12 at y 170 over the river x 1620–1780, crushing anything under it |
| cam ≥ 1500 | `kettle-tank` from R+32, stops @1980; 2 `rifleman` escort it |
| cam ≥ 1700 | 6 `zap-moth` from the top-right, sine swarm |
| cam ≥ 1900 | Checkpoint. 3 `rifleman` + `hailer` on the ruin ledge @2200–2300 |
| cam ≥ 2100 | `H:caged(gem-red)` @2300. `C:auto` @2380 |
| x ≥ 2540 | Exit → `m1-b` (fade 30 ticks) |

#### `m1-b` — SWAN DROP · 2400 × 216 · scroll right · checkpoints x 900, 1700

- **Ground:** flooded temple ruins: `at(0,176).flat(1060)` · deep water pit x 1060–1180 ·
  `flat(…)` to x 2200 at 176 · then the **fork**: a stepped rise of rock platforms going up
  (x 2200–2400, y 140 → 108 → 76) and the ground continuing at 176 to the lower exit.
- **Platforms (rock):** ledge x 860–960 y 112; courtyard steps x 1300–1380 y 136, x 1420–1500
  y 112; fork steps x 2200–2260 y 140, x 2280–2340 y 108, x 2350–2400 y 76.
- **Solids:** **frog-idol statue** @1010 (48 × 96, `breakable(30)`); courtyard pillars.
- **Background:** as m1-a plus `ruins` {mossy grey-green} factor 0.45 in front of `jungle`.
- **Terrain style:** `{ ground: 'rock', edge: 'moss', platform: 'rock', solid: 'brick' }`.

| Trigger | Event |
|---|---|
| start | **Set piece — Swan Drop:** a cargo plane silhouette crosses the sky layer (decor, 1.5 px/tick); a crate on a parachute falls and lands @160 (shake 3); the crate bursts and the **Swan** stands up and shakes itself (60 ticks). Announcer: `"SWAN DELIVERED!"` Players can mount (`swan`, HP full, 10 shells) |
| cam ≥ 0 | 3 `rifleman` @420–480 — they see the Swan and `panic` |
| cam ≥ 200 | `whirligig` crosses once (bomb drops). 2 `brolly-guard` @640, @700 |
| cam ≥ 400 | 3 `bog-toad` @800–900; 2 `hailer` on the ledge @880, @940 |
| cam ≥ 600 | **Set piece — Toppling Idol:** shooting the frog-idol (hp 30) tips it right in 50 ticks; it crushes enemies within 96 px and becomes a bridge (dynamic solid 120 × 16, y 168) over the water x 1060–1180. The Swan can also glide across |
| cam ≥ 900 | Checkpoint. **lock 1240–1240**: `kettle-tank` R+32; t+120: 2 `rifleman` L−16; t+240: 2 `kite-trooper`; [coop] +2 rifleman; [hard] +1 brolly-guard. `H:forecaster(auto)` @1300 on the step y 136 (gives `pickup-shells` if the freeing player rides the Swan). Unlock when clear |
| cam ≥ 1400 | `whirligig` (`seeder`) — the first Stormhead encounter. `C:towel` @1560 |
| cam ≥ 1600 | `C:stowaway → H:stowaway(1up)` @1800. `H:runner(food)` @1900 |
| cam ≥ 1700 | Checkpoint. 8 `zap-moth` swarm |
| cam ≥ 1900 | `forecaster-officer` @2140 + 3 `rifleman`; `CM:{weapon:'machine-gun'}` @2150 |
| fork | Signposts (decor): upper `"CANOPY ROUTE — SUNNY SPELLS"` (with a scribbled `LIES`), lower `"RIVER ROUTE — WET"` |
| upper exit | rect x 2350–2400, y 40–76 → `m1-c1` |
| lower exit | rect x 2384–2400, y 140–176 → `m1-c2` |

**Branch rule (all missions):** the first player to touch an exit chooses; in co-op the other
player is carried along after a 60-tick fade. The Swan may take either exit (carry-over).

#### `m1-c1` — CANOPY WALK (branch A) · 1800 × 216 · scroll right · checkpoint x 900

- **Ground:** none between x 160 and 1640 (pit: falling below y 232 kills). Start and end
  ledges at y 120. Treetop **wood platforms** and rope bridges (one-way polylines with a 6-px
  sag): x 160–300 y 120; 330–420 y 96; 450–620 y 128 (rope bridge); 650–720 y 104;
  760–980 y 120 (rope bridge); 1010–1080 y 92; 1110–1300 y 124 (rope bridge); 1330–1400
  y 100; 1430–1640 y 120; end ledge 1640–1800 y 120 (solid ground polyline).
- **Background:** `sky-gradient` (as m1-a); `clouds` 0.1; `jungle` {lighter green, offsetY −30}
  0.3; `treeline` {offsetY 40} 0.6 — the view looks *down* on the treetops.
- **Terrain style:** `{ ground: 'dirt', edge: 'moss', platform: 'wood', solid: 'rock' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 2 `rifleman` on the bridge @520, @580 |
| cam ≥ 200 | 3 `kite-trooper` (staggered 45 ticks); `H:balloonist(blunderbuss)` hanging under a branch @700, y 60 |
| cam ≥ 450 | `brolly-guard` @900 on the bridge; `whirligig` crosses |
| cam ≥ 700 | 6 `zap-moth`; `H:cook(pie)` @1050 on the platform y 92 |
| cam ≥ 900 | Checkpoint. 2 `hailer` @1350, @1600 |
| cam ≥ 1100 | `forecaster-officer` @1500 + 2 `rifleman`; `C:bombs` @1460 |
| x ≥ 1780 | Exit → `m1-d` |

#### `m1-c2` — RIVERBED (branch B) · 1800 × 216 · scroll right · checkpoint x 900

- **Ground:** mud bank at 176 with three deep-water pockets (water hazard): x 380–460,
  x 820–940, x 1300–1380, each crossed by 1–2 floating log platforms (one-way, 32 wide,
  bob ±2 px, y 168). Front layer: translucent shallow-water band (decor, front) along y 170–176.
- **Background:** as m1-a, plus `sea` {muddy brown-green, calm} factor 0.8 as the far river.
- **Terrain style:** `{ ground: 'mud', edge: 'grass', platform: 'wood', solid: 'rock' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 3 `mudskipper` leap from the first pocket |
| cam ≥ 200 | `squall-boat` sails in on the river layer behind (lane y 150, it can be hit) from R+48, fights for 600 ticks or until sunk; 2 `rifleman` on the bank |
| cam ≥ 500 | 2 `bog-toad`; `H:forecaster(auto)` @760 |
| cam ≥ 900 | Checkpoint. 4 `mudskipper` from the middle pocket; `hailer` @1200 |
| cam ≥ 1100 | `H:caged(gem-gold)` @1250; `CM:{weapon:'machine-gun'}` @1450 |
| cam ≥ 1300 | `forecaster-officer` @1600 + 2 `brolly-guard` |
| x ≥ 1780 | Exit → `m1-d` |

#### `m1-d` — PADDLE DOCK (boss) · 640 × 216 · scroll right

- **Ground:** jungle bank x 0–256 at 176; wooden dock (ground) x 256–456 at 168; deep water
  x 456–640 (water hazard top y 184, raised by the boss in phase 2). Crate platforms (one-way)
  at x 466 and 516, y 140.
- **Background:** `sky-gradient` (darker), `clouds` 0.1, `sea` {grey-brown, waves} 0.5,
  `treeline` 0.7 (left half only, offsetY 30).
- **Terrain style:** `{ ground: 'mud', edge: 'grass', platform: 'wood', solid: 'crate' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | `C:bombs` @120, `C:auto` @200, `H:cook(auto)` @160 |
| cam ≥ 256 | **lock 256–256**. Music → `boss`. Boss intro: the Drenchnought steams in from the right (180 ticks, horn blasts, rain heavier). `drenchnought` fight (§10.1) |
| boss dead | Death sequence; rain stops; `MISSION COMPLETE` (§13.10) |

### 11.2 m2 — HEATSTROKE HIGHWAY (Mirror Desert)

- **Biome and mood:** desert canyon under **three mirror-suns** (orbital mirrors). Bleached
  white-yellow sky, orange horizon, terracotta mesas, pale sand, deep violet shadows, heat
  shimmer on the far layers.
- **Music:** `m2` (a, c1, c2), `chase` (m2-b), `boss` (m2-d). **Hostage target:** 8.
- **Route:** `m2-a` → `m2-b` (Buckboard chase + Sand Schooner) → branch (`m2-c1` town |
  `m2-c2` mine) → `m2-d` boss.
- **Mission-local generator:** `mirror-suns` (three white discs with ring flares and a soft
  glow, placed at 25 %, 50 %, 75 % of the layer width; factor 0.02).

#### `m2-a` — MIRROR DUNES · 2400 × 216 · scroll right · checkpoints x 800, 1600

- **Ground:** `at(0,176).flat(300).slope(120,-24).slope(120,24).flat(200).slope(160,-32)
  .flat(140).slope(160,32).flat(300).slope(100,-16).slope(100,16).flat(700)` (ends x 2400).
- **Platforms (wood):** mirror-relay scaffolds x 1900–2000 y 128, x 2040–2140 y 96.
- **Solids:** rock outcrops x 600 (32 × 24), x 1300 (32 × 32).
- **Background:** `sky-gradient` {top `#f8f0c8`, bottom `#f0a050`} 0; `mirror-suns` 0.02;
  `mountains` {terracotta mesas, flat tops} 0.15; `dunes` {pale cream} 0.35; `dunes`
  {darker ochre, offsetY 20} 0.6.
- **Terrain style:** `{ ground: 'sand', edge: 'sand', platform: 'wood', solid: 'rock' }`.
- **Set piece — Sun Spots:** a 32-px bright ellipse on the ground wanders ±80 px (0.5 px/tick)
  around its anchor. Every 180 ticks it brightens for 60 ticks (telegraph, rising hum), then
  **flares for 30 ticks** (lethal to everyone — enemies caught in it play `die-burn`).

| Trigger | Event |
|---|---|
| start | Intro card. Announcer: `"MISSION TWO. STAY HYDRATED!"` |
| cam ≥ 0 | 2 `rifleman` (`desert`) @320, @360 in `gag` (fanning themselves with the paper) |
| cam ≥ 100 | `dune-eel` @560 (wakes when a player is within 160 px) |
| cam ≥ 250 | `H:forecaster(torch)` @640 behind the rock. 3 `rifleman` R+16 |
| cam ≥ 400 | Sun Spot A active (anchor @760) until cam ≥ 900 |
| cam ≥ 500 | `heatwaver` @930 on the dune top; 2 `kite-trooper` |
| cam ≥ 700 | `dune-eel` @1100, @1250. `C:auto` @1180 |
| cam ≥ 800 | Checkpoint. **lock 900–900**: Sun Spot B (anchor @1100) active during the lock; `kettle-tank` R+32; t+150: 2 `rifleman` L−16; t+300: `thunder-trooper` R+16; [coop] +1 heatwaver; [hard] +1 dune-eel @1000. `H:balloonist(bombs)` snagged on a mirror pylon @1150, y 80. Unlock when clear |
| cam ≥ 1300 | `forecaster-officer` @1650 + 3 `rifleman`; `CM:{weapon:'bottle-rocket'}` @1600 |
| cam ≥ 1500 | 2 `whirligig` (one `seeder`) |
| cam ≥ 1600 | Checkpoint. `H:caged(gem-red)` @1960 on the scaffold y 128; `thunder-trooper` @2100 on the scaffold y 96; `heatwaver` R+16 |
| cam ≥ 1900 | `dune-eel` @2200, @2300; `C:bombs` @2250 |
| x ≥ 2380 | Exit → `m2-b` |

#### `m2-b` — HEATSTROKE HIGHWAY · 5200 × 216 · auto-scroll · checkpoints x 1600, 3200, 4400

- **Ground:** highway at y 184: `at(0,184).flat(1384).slope(16,-8).gap(56)…` — three
  **collapsed-road gaps** (pits) x 1400–1456, x 2600–2660, x 3700–3760, each with a 16-px
  **ramp** right before it (ground bump −8 px, decor `decor/m2/ramp` with tag `ramp`: a buggy
  crossing it is launched with vy −6). Flat from x 4400 to 4950; the **collapsed bridge** is a pit from x 4950 to 5200.
- **Solids:** road rocks (16 × 16, `breakable(6)`) x 900, 1900, 3300.
- **Platforms (metal):** overpasses x 2000–2120 and x 3000–3120 at y 104 (enemy perches).
- **Background:** `sky-gradient` (as m2-a); `mirror-suns` 0.02; `mountains` {mesas} 0.1;
  `dunes` 0.3; `ruins` {bleached billboard wrecks, telegraph poles} 0.55. From x 4400 the
  near layers **drift** left 2 px/tick (treadmill, request §11.0-2).
- **Terrain style:** `{ ground: 'concrete', edge: 'sand', platform: 'metal', solid: 'rock' }`.
- **Auto-scroll:** 2.0 px/tick from t+120 after the start until cam = 4400.

| Trigger | Event |
|---|---|
| start | **Buckboard** parked @120, engine idling. Announcer: `"BUCKBOARD READY!"` Music → `chase`. Auto-scroll starts at t+120 |
| cam ≥ 200 | 2 `gale-jeep` from **L−16** (behind) at 3.0 px/tick, overtaking with gunners firing |
| cam ≥ 600 | 3 `kite-trooper`, 40 ticks apart |
| cam ≥ 900 | `dune-eel` leaps across the road @1100 |
| cam ≥ 1100 | `H:balloonist(machine-gun)` floating above the road @1300, y 64 — shoot the rope: the hostage drops into the buggy's back seat and hands the item over at once ("hitchhiker" gag) |
| cam ≥ 1600 | Checkpoint. `gale-jeep` from R+32 brakes and rams; 2 `whirligig` |
| cam ≥ 1950 | 2 `thunder-trooper` on the overpass @2040, @2100; 2 `rifleman` on the road |
| cam ≥ 2700 | `kettle-tank` crawling on the shoulder @3000 (the buggy overtakes it) |
| cam ≥ 2950 | `sleet-sniper` on the overpass @3060; 2 `gale-jeep` from L−16 |
| cam ≥ 3200 | Checkpoint. `H:balloonist(bottle-rocket)` @3400, y 60 |
| cam ≥ 3500 | `dune-eel` @3900, @4000 |
| cam ≥ 4100 | 2 `gale-jeep` R+32; 3 `kite-trooper`. [hard] +1 `whirligig` (`seeder`) |
| cam = 4400 | Checkpoint. Auto-scroll stops; **lock 4400–4400**, treadmill drift on. `WARNING!` card: **SAND SCHOONER** rolls in from the left on the raised lane (y 112, decor road) and holds beside the players (§9.4). [coop] schooner HP ×1.5 |
| schooner dead | Drift slows to 0 over 120 ticks; the buggy sputters (`vehicle/sputter`), text `OUT OF GAS!` over it; it becomes an empty wreck (cannot be re-entered). Unlock; normal ratchet scroll on foot |
| cam ≥ 4500 | The road ends at a **collapsed bridge** @4950 (decor). 2 `rifleman` + `C:bombs` @4700 |
| fork | Upper: a rope-ladder of wood platforms up the canyon wall x 4900–4960 y 144, x 4980–5040 y 108, x 5060–5200 y 72; signpost `"DUSTY GULCH — POP. 3"`. Lower: a **mine elevator** (moving platform 48 × 8) @4800–4848 that descends 2 px/tick when a player stands on it; signpost `"GLASSWORKS MINE — KEEP OUT"` |
| upper exit | rect x 5140–5200, y 30–72 → `m2-c1` |
| lower exit | rect x 4800–4848, y 200–216 (reached by riding the elevator) → `m2-c2` |

#### `m2-c1` — DUSTY GULCH (branch A, canyon town) · 2000 × 216 · scroll right · checkpoint x 1000

- **Ground:** main street at y 176, flat.
- **Platforms (wood):** boardwalks y 140 at x 200–600 and x 900–1300; rooftops y 96 at
  x 380–460 and x 1100–1180.
- **Background:** `sky-gradient` {deeper orange}; `mirror-suns`; `mountains` {red canyon
  walls} 0.2; `city` {params `style: 'timber'`, brown facades with dark windows} 0.7.
- **Terrain style:** `{ ground: 'dirt', edge: 'sand', platform: 'wood', solid: 'brick' }`.
- **Set piece — Billboard:** `"ISOBAR — ALWAYS RIGHT"` with the Duchess's smiling face
  @700 (decor 96 × 64 on 2 legs, each `breakable(15)`). Breaking both drops it flat (crushes
  enemies below) and it becomes a one-way platform 96 wide at y 152.
- **Set piece — Water Tower:** @1500 on stilts, `breakable(40)`. When destroyed, a flood wave
  rushes right along the street for 90 ticks: ground enemies in x 1500–1800 wash away
  (`die-blast`, score counts); players are only pushed 1 px/tick.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 2 `rifleman` (`desert`) @300, @330 in `gag` (playing cards on a barrel) |
| cam ≥ 150 | `sleet-sniper` in windows @500 (y 140) and @560 (y 96). `H:forecaster(auto)` @420 |
| cam ≥ 350 | Billboard set piece; 4 `rifleman` patrol under it @720–780 |
| cam ≥ 600 | `gale-jeep` R+32; `heatwaver` @1000 |
| cam ≥ 800 | `forecaster-officer` @1200 on the boardwalk + 2 `rifleman`; `CM:{weapon:'torch'}` @1150 |
| cam ≥ 1000 | Checkpoint. `H:cook(1up)` @1050 |
| cam ≥ 1200 | Water Tower set piece: 5 `rifleman` + `heatwaver` hold a barbecue @1550–1750 (gag) |
| cam ≥ 1400 | `sleet-sniper` @1700 (y 96); `thunder-trooper` @1800; `H:caged(gem-gold)` @1880 |
| x ≥ 1980 | Exit → `m2-d` |

#### `m2-c2` — GLASSWORKS MINE (branch B) · 2000 × 216 · scroll right · checkpoint x 1000

- **Ground:** tunnel floor y 184; ceiling solids along y 0–32 for the whole length (a low
  tunnel); pits x 500–620 and x 1200–1360, each crossed by **mine carts** (moving platforms
  32 × 12 on a rail line at y 176, ping-pong 1.2 px/tick). **Crystal walls** (solid 24 × 64,
  `breakable(20)`, shatter into green sparkles) at x 800 and x 1500.
- **Background:** sky colour `#1a1410`; mission generator `mine-walls` (dark rock, timber
  supports every 96 px, glowing green glass clusters) 0.5; `darkness(0.45)` without
  flashes; lamp decor (warm halos) every 160 px.
- **Terrain style:** `{ ground: 'rock', edge: 'rust', platform: 'metal', solid: 'rock' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 2 `rifleman` with pickaxes in `gag` @300–340; 6 `zap-moth` circling the lamp @450 |
| cam ≥ 200 | Mine carts over pit 1 start; `hailer` beyond the pit @700 |
| cam ≥ 400 | `H:forecaster(bottle-rocket)` @760; crystal wall @800 |
| cam ≥ 600 | `thunder-trooper` @1000; 2 `rifleman`; `C:auto` @950 |
| cam ≥ 800 | Checkpoint (x 1000). `dune-eel` in a sand pocket @1100 |
| cam ≥ 1000 | Mine carts over pit 2; 8 `zap-moth`. `C:stowaway → H:stowaway(1up)` @1420 |
| cam ≥ 1300 | Crystal wall @1500 with a `heatwaver` behind it; `forecaster-officer` @1750 + 2 `rifleman`; `H:caged(gem-red)` @1850 |
| x ≥ 1980 | Exit → `m2-d` |

#### `m2-d` — SOLAR FARM (boss) · 640 × 216 · scroll right

- **Ground:** flat sand y 176. Solar-panel platforms (one-way, metal, 48 wide, y 128) at
  x 326 and x 446 (view x 70 and 190 after the lock).
- **Background:** `sky-gradient` {white-hot top}; `mirror-suns` {scale 1.5}; `dunes` 0.3;
  mission generator `solar-panels` (rows of tilted dark-blue panels) 0.6.
- **Terrain style:** `{ ground: 'sand', edge: 'sand', platform: 'metal', solid: 'metal' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | `C:bombs` @100; `H:forecaster(auto)` @180 |
| cam ≥ 256 | **lock 256–256**. Music → `boss`. Intro (180 ticks): the **Mirage Engine** crawls out of a heat haze (shimmer fades in). Fight §10.2 |
| boss dead | Glass-statue death; mirror-suns dim; `MISSION COMPLETE` |

### 11.3 m3 — HURRICANE HARBOR (Flooded Port)

- **Biome and mood:** a port city drowned by a hurricane that has been "parked" overhead
  for weeks. Storm greys, sea-green water, rust-red cranes and containers, yellow oilskins,
  white spray, rain blowing sideways (`rainFx` density 3, wind −1.5).
- **Music:** `m3` (a, b), `climb` (c), `boss` (d). **Hostage target:** 9.
- **Route (no branch):** `m3-a` (Bathtub) → `m3-b` (on foot + Dockside Grabber) → `m3-c`
  (vertical climb, rising flood) → `m3-d` boss.

#### `m3-a` — FLOODED DOCKS · 2800 × 216 · scroll right · checkpoints x 1000, 2000

- **Ground:** start dock x 0–160 at y 168; **deep water** (water hazard, top y 176) from
  x 160 to 2600; end dock x 2600–2800 at y 168 (a slipway).
- **Platforms (wood):** low piers y 160 (64 wide) at x 520, 820, 1240, 1700, 2100, 2460;
  high piers y 120 at x 1000, 1900.
- **Solids:** rusty containers (48 × 24, `metal`) sticking out of the water at x 700 (2
  stacked, top y 128), x 1400, x 2300 (2 stacked).
- **Background:** `sky-gradient` {top `#30383c`, bottom `#6a7a78`} 0; `clouds` {dark,
  ragged} 0.1; `city` {flooded skyline, dark grey, a few lit windows, offsetY 20} 0.3; `sea`
  {grey-green, big swells} 0.6.
- **Terrain style:** `{ ground: 'concrete', edge: 'rust', platform: 'wood', solid: 'metal' }`.
- **Set piece — Rogue Waves:** every 600 ticks a swell rises on the horizon (the `sea`
  layer's offsetY rises 12 px over 90 ticks + `env/wave-rumble`), then the water top rises
  16 px for 60 ticks. Low piers flood (enemies standing there wash away); the Bathtub just
  rides up and down.

| Trigger | Event |
|---|---|
| start | **Bathtub** parked @100 at the dock edge. Announcer: `"MISSION THREE. HOLD ON TO YOUR HATS!"` |
| cam ≥ 0 | 3 `mudskipper` leap from the water @400–460 |
| cam ≥ 200 | `squall-boat` from R+48 on the water lane |
| cam ≥ 400 | 2 `rifleman` (`sailor`) on the containers @700 (y 128); `hailer` on the pier @830 |
| cam ≥ 600 | `H:balloonist(skipper)` tangled on a crane arm @900, y 60; `whirligig` |
| cam ≥ 800 | `nimbus-blimp` crosses the top (first appearance), drops `kite-trooper`s on the piers |
| cam ≥ 1000 | Checkpoint. **lock 1100–1100**: 2 `squall-boat` (R+48 and L−48), 2 `thunder-trooper` on the high pier @1000 and @1240 pier; [coop] +1 squall-boat; [hard] +1 `whirligig` (`seeder`). Unlock when clear |
| cam ≥ 1500 | Rogue Waves start (until cam ≥ 2400) |
| cam ≥ 1600 | `H:forecaster(auto)` on the pier @1720 (shots free hostages, so the pilot never has to leave the tub). Spare **Bathtub** parked on the high pier @1900 |
| cam ≥ 1800 | 5 `mudskipper`; `squall-boat` R+48 |
| cam ≥ 2000 | Checkpoint. `forecaster-officer` on the container stack @2300 + 3 `rifleman`; `H:caged(gem-red)` on the pier @2460 |
| x ≥ 2780 | The tub runs aground on the slipway (no carry-over). Exit → `m3-b` |

#### `m3-b` — CONTAINER YARD · 2000 × 216 · scroll right · checkpoint x 900

- **Ground:** concrete quay at y 176, flat.
- **Solids:** container stacks (48 × 24 each, `metal`) forming steps: x 600 (1 high), x 648
  (2 high), x 860 (2 high), x 1300 (1 high), x 1348 (3 high).
- **Platforms (metal):** catwalks y 120 at x 700–820 and x 1100–1260.
- **Background:** storm sky; `clouds` 0.1; `city` {warehouses and cranes} 0.35; mission
  generator `crane-row` (gantry crane silhouettes, rust red) 0.6.
- **Terrain style:** `{ ground: 'concrete', edge: 'rust', platform: 'metal', solid: 'metal' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 2 `rifleman` (`sailor`) in `gag` (chasing a hat blown away by the wind) @300; `brolly-guard` @420 |
| cam ≥ 200 | 3 `mudskipper` flop out of a drain @500; `H:forecaster(quill-gun)` @560 |
| cam ≥ 400 | `gale-jeep` R+32; 2 `rifleman` on the containers |
| cam ≥ 600 | `thunder-trooper` on the stack @860 (y 128); `C:auto` @820; `whirligig` (`seeder`); `H:runner(towel)` @1000 |
| cam ≥ 900 | Checkpoint. `forecaster-officer` @1150 on the catwalk + 2 `brolly-guard` |
| cam ≥ 1200 | `H:caged(gem-gold)` @1450; `CM:{weapon:'skipper'}` @1500; `C:bombs` @1560 |
| cam ≥ 1600 | **lock 1600–1600**. `WARNING!` card: **DOCKSIDE GRABBER** (§9.4); the gantry rail spans the top of the view |
| grabber dead | Unlock. Exit at x ≥ 1980 → `m3-c` |

#### `m3-c` — LEANING TOWER · 384 × 1600 · scroll **up** · checkpoint y 860

A flooded office skyscraper, seen in cut-away: each floor is a one-way platform, broken
windows in the side walls, desks and filing cabinets as solids. The flood rises behind the
players.

- **Walls:** solids x 0–16 and x 368–384 for the full height, with window openings (gaps in
  the solid) every second floor.
- **Floors (one-way, `metal` grating or `wood`):** every 72 px from y 1560 up to y 192
  (1560, 1488, 1416, … 264, 192), alternating openings: odd floors span x 16–300 (gap on the right), even floors span
  x 84–368 (gap on the left). Extra stair platforms (48 wide) halfway between floors at the
  gap side. Roof: a one-way platform at y 120 across x 16–368 (open sky above).
- **Rising flood:** the water hazard top starts at y 1640 and rises 0.35 px/tick after a
  180-tick grace; it is never more than 32 px below the view bottom (it catches up). During
  the camera lock it keeps rising at 0.2 px/tick **into** the view (max 64 px above the view
  bottom), so arena fights have a clock. Request §11.0-3.
- **Background:** sky colour `#30383c`; mission generator `office-interior` (wallpaper bands,
  windows showing rain) factorY 0.5; `city` {skyline seen through windows} factorX 0,
  factorY 0.2.
- **Terrain style:** `{ ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'concrete' }`.
- **Triggers** use `camTop ≤ Y` (camera top edge at or above world y Y).

| Trigger | Event |
|---|---|
| start | Players at y 1560. Banner `THE FLOOD IS RISING! CLIMB!` (120 ticks). Music → `climb` |
| camTop ≤ 1300 | 2 `rifleman` on the floor y 1416 (left); `brolly-guard` on y 1344 (right) |
| camTop ≤ 1150 | `H:forecaster(auto)` on y 1272 (left); 2 `kite-trooper` glide in through the windows |
| camTop ≤ 1000 | `hailer` on y 1128 (right) shelling down; 4 `mudskipper` leap from the flood surface |
| camTop ≤ 900 | `C:auto` on y 1056 |
| camTop ≤ 800 | Checkpoint (y 860). **Vertical lock** with camTop 700 (view y 700–916): `forecaster-officer` + 3 `rifleman` + `thunder-trooper` on floors y 768–912; [coop] +2 rifleman; [hard] +1 hailer. Unlock when clear |
| camTop ≤ 600 | `sleet-sniper` on y 552 aiming down; `H:balloonist(bombs)` dangling outside a window at y 600 (rope tied to a flagpole) |
| camTop ≤ 450 | `whirligig` bombs through the windows; 2 `brolly-guard` on y 480 |
| camTop ≤ 300 | `H:cook(1up)` in the office kitchen on y 336; `C:towel` on y 336 |
| camTop ≤ 60 | Roof: 3 `rifleman`; a `nimbus-blimp` passes overhead dropping 2 `kite-trooper` |
| roof exit | rect x 320–368, y 64–120 (a zipline anchor) → `m3-d`. Transition: the squad rides a zipline across the bay (wipe, 60 ticks) |

#### `m3-d` — LIGHTHOUSE POINT (boss) · 640 × 216 · scroll right

- **Ground:** rocks x 0–256 at y 168; pier x 256–516 at y 176 (pier x 256–304 is a rock
  ledge at y 160); sea from x 516 (water hazard top y 190, raised by the boss).
- **Platforms:** buoys (one-way, 24 wide, y 136, bob ±3 px) at x 376 and x 466.
- **Background:** `sky-gradient` {near-black teal}; `clouds` {spiral, dark} 0.1; `sea` {huge
  waves, white caps} 0.4; `sea` {near, offsetY 30} 0.7. Rain density 3; `darkness(0.3, 90)`
  lightning flashes.
- **Terrain style:** `{ ground: 'rock', edge: 'moss', platform: 'wood', solid: 'rock' }`.

| Trigger | Event |
|---|---|
| start | Players land from the zipline at x 40 |
| cam ≥ 0 | `H:forecaster(auto)` @150; `C:bombs` @200 |
| cam ≥ 256 | **lock 256–256**. Music → `boss`. Intro (180 ticks): the searchlight sweeps across the pier, then the foghorn sounds. Fight §10.3 |
| boss dead | Tower falls; the storm spirals away; `MISSION COMPLETE` |

### 11.4 m4 — WHITEOUT PEAK (Blizzard Mountain)

- **Biome and mood:** an alpine mountain in a blizzard. White and ice blue, dark pine green,
  grey rock, warm yellow chalet windows; snow blowing sideways (`snowFx` density 2, wind +1).
- **Music:** `chase` (a), `climb` (b), `m4` (c1, c2), `boss` (d). **Hostage target:** 9.
- **Route:** `m4-a` (avalanche, auto-scroll) → `m4-b` (vertical climb + Blizzard Cannon) →
  branch (`m4-c1` cable cars | `m4-c2` ice caves) → `m4-d` boss (auto-scroll, Swan).

#### `m4-a` — AVALANCHE RUN · 3200 × 216 · auto-scroll · checkpoints x 1000, 2000

- **Ground:** snowy slopes with moguls: `at(0,176).flat(300)` then repeating
  `slope(60,-12).slope(60,12).flat(80)` bumps; crevasses (pits) x 900–950 and x 1900–1960;
  flat run-out x 2700–3200 ending at the dam wall (solid, x 3180).
- **Platforms (ice):** ice bridges over each crevasse (`fallingPlatform`: cracks 20 ticks after
  first touch, then falls): x 896–954 y 172; x 1896–1928 and x 1928–1964 y 172.
- **Solids:** log cabin x 2600–2664, y 128–176 (roof walkable); pine trunks (16 × 32) at
  x 1400, 2300.
- **Background:** `sky-gradient` {top `#9aa8b8`, bottom `#e8eef4`}; `ice-peaks` 0.15;
  `mountains` {snowy, blue shadows} 0.35; `treeline` {snow-dusted pines} 0.65.
- **Terrain style:** `{ ground: 'snow', edge: 'snow', platform: 'ice', solid: 'rock' }`.
- **Set piece — The Avalanche:** auto-scroll 1.25 px/tick (players run at 1.5). A giant
  rolling snow wave (front layer sprite, 64 px wide, tumbling snowballs and a few surprised
  enemy hats in it) rides the left view edge. **Its 24-px leading edge is a `kill` zone**
  (players must keep up; enemies it touches are swallowed — a hat pops out). Respawns happen
  at view x 120.

| Trigger | Event |
|---|---|
| start | Intro card. Announcer: `"MISSION FOUR. WRAP UP WARM!"` t+120: rumble, shake 2, banner `AVALANCHE!`; auto-scroll starts; music → `chase` |
| cam ≥ 200 | 3 `rifleman` (`parka`) walk toward the players, see the avalanche and `panic` (run right with them) |
| cam ≥ 600 | `kite-trooper` ×2 |
| cam ≥ 700 | `frost-ram` charging from R+16 @1200 and @1300 (staggered 90 ticks) |
| cam ≥ 1000 | Checkpoint. `H:forecaster(arc-caster)` @1250 |
| cam ≥ 1200 | `plow-crawler` from R+32 pushing a snow pile toward the players — destroy it or it pushes them into the avalanche |
| cam ≥ 1600 | 2 `whirligig`; 2 `kite-trooper` |
| cam ≥ 2000 | Checkpoint. `H:balloonist(bombs)` on a ski-lift pylon @2200, y 80; 3 `frost-ram` |
| cam ≥ 2400 | 2 `rifleman` + `hailer` on the cabin roof @2600–2664; `H:cook(auto)` beside the cabin @2680; `C:auto` on the roof @2640 |
| cam ≥ 2816 | Auto-scroll stops. **Set piece:** the avalanche slams into a rock outcrop behind the players — shake 6, white-out fade 60 ticks, then silence and a single falling snowflake |
| x ≥ 3160 | Exit (dam door) → `m4-b` |

#### `m4-b` — FROZEN DAM · 384 × 1400 · scroll **up** · checkpoint y 700

- **Layout:** the icy face of a dam. Bottom ground at y 1376. Ice ledges (one-way, `ice`)
  every 64 px from y 1360 up to y 272 (1360, 1296, 1232, … 336, 272), alternating left
  (x 16–240) and right (x 144–368), with spillway pipes (solids 32 × 16) halfway between
  ledges as steps; side walls x 0–16 and x 368–384. The top (y 0–216) is the cannon deck: a
  one-way `metal` platform at y 176 across x 16–368 (players jump up through it), with ice
  walls (solid, broken only by the cannon's death) at x 0–16 and x 368–384, y 120–176.
- **Background:** sky colour `#8898a8`; mission generator `dam-face` (concrete blocks with
  icicles) factorY 0.6; `ice-peaks` factorX 0, factorY 0.2.
- **Terrain style:** `{ ground: 'concrete', edge: 'snow', platform: 'ice', solid: 'concrete' }`.
- **Triggers** use `camTop ≤ Y`.

| Trigger | Event |
|---|---|
| start | Players at y 1360. Music → `climb` |
| camTop ≤ 1100 | `tesla-mast` on the right ledge y 1104; 2 `rifleman` |
| camTop ≤ 950 | `H:forecaster(auto)` on y 1040; `hailer` on y 912 |
| camTop ≤ 800 | `frost-ram` on the long ledge y 848 |
| camTop ≤ 700 | Checkpoint (y 700). 3 `kite-trooper`; `C:auto` on y 720 |
| camTop ≤ 500 | 2 `tesla-mast` hanging under the ledge y 528 (`flipY`); `H:caged(gem-red)` on y 592 |
| camTop ≤ 350 | Snowballs (16 px, 3 HP) roll off the top ledges every 120 ticks (rumble + falling powder telegraph 30 ticks); `whirligig` |
| camTop = 0 | **Vertical lock** (camTop 0). `WARNING!` card: **BLIZZARD CANNON** (§9.4) |
| cannon dead | Its last giant snowball smashes **both** ice walls. Left opening = cable-car station door; right opening = cave mouth. Signposts: `"CABLE CAR — OUT OF ORDER (MOSTLY)"`, `"ICE CAVES — MIND THE ICICLES"` |
| left exit | rect x 0–16, y 120–176 → `m4-c1` |
| right exit | rect x 368–384, y 120–176 → `m4-c2` |

#### `m4-c1` — CABLE CAR LINE (branch A) · 2400 × 216 · scroll right · checkpoint x 1200

- **Ground:** stations only: x 0–200 (y 176), mid station x 1100–1300 (y 168), end station
  x 2200–2400 (y 176). Everything else is a bottomless chasm (pit).
- **Gondolas:** `movingPlatform` cabins (floor 64 × 8, with cabin decor and a roof that is
  also a one-way platform 64 wide 40 px higher) running left → right along the upper cable at
  y 120 at 1.0 px/tick, one every 200 px, looping from station to station.
  **Enemy gondolas** run right → left on a lower cable (floor at y 152), each with 2 `rifleman`
  (`parka`) aboard who fire from the windows (the gondola itself has 20 HP, falls when destroyed).
- **Background:** `sky-gradient` {blizzard grey-white}; `ice-peaks` 0.2; `mountains` {snowy}
  0.4; `clouds` {low fog bank, offsetY 150} 0.7.
- **Terrain style:** `{ ground: 'concrete', edge: 'snow', platform: 'metal', solid: 'metal' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 2 `rifleman` (`parka`) at the station; `C:bombs` @150 |
| cam ≥ 150 | Gondola line starts; 3 `kite-trooper` |
| cam ≥ 400 | Enemy gondola from R+32; `whirligig` |
| cam ≥ 700 | 3 `jellycloud` drifting in the chasm; `H:balloonist(arc-caster)` caught on the cable @900, y 70 |
| cam ≥ 1100 | Checkpoint (x 1200). `forecaster-officer` + 2 `rifleman` at the mid station; `sleet-sniper` on the station roof (y 120); `H:cook(auto)` @1250 |
| cam ≥ 1500 | 2 enemy gondolas (100 px apart); 2 `whirligig` (`seeder`) |
| cam ≥ 1900 | 4 `jellycloud`; `CM:{weapon:'torch'}` @2260; `H:caged(gem-gold)` @2300 |
| x ≥ 2380 | Exit → `m4-d` |

#### `m4-c2` — ICE CAVES (branch B) · 2400 × 216 · scroll right · checkpoint x 1200

- **Ground:** cave floor y 176 with ice humps; low ceiling solids (y 0–24, and stalactite
  blocks down to y 48 at x 600, 1400, 2000); frozen pond (ice floor, no hazard) x 1600–1800.
- **Hazard entities:** **icicles** (8 × 24) in the ceiling at x 520, 560, 600, 640, 680 and
  x 1960, 2000 — each shakes 20 ticks when a player passes beneath, then falls (lethal,
  shatters).
- **Solids:** ice walls (24 × 64, `breakable(20)`) at x 960 and x 1850; a charging
  `frost-ram` that hits an ice wall breaks it.
- **Background:** sky colour `#0c1420`; mission generator `ice-cave` (blue crystal walls,
  frozen waterfalls) 0.5; `darkness(0.4)`; glowing ice crystals as decor.
- **Terrain style:** `{ ground: 'ice', edge: 'snow', platform: 'ice', solid: 'rock' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 3 `clockwork-hound` from R+16, 40 ticks apart |
| cam ≥ 300 | Icicle field; 6 `zap-moth` |
| cam ≥ 500 | `frost-ram` @900 in front of the ice wall @960; `H:forecaster(auto)` @850 |
| cam ≥ 800 | `heatwaver` @1150 melting an ice block (gag); 2 `rifleman` (`parka`); `C:auto` @1100 |
| cam ≥ 1100 | Checkpoint (x 1200). **lock 1200–1200**: 4 `clockwork-hound` (2 per side) + `forecaster-officer` @1500 + ceiling `tesla-mast` @1480; [coop] +2 hounds; [hard] +1 frost-ram. `C:stowaway → H:stowaway(1up)` @1450. Unlock when clear |
| cam ≥ 1600 | 2 `frost-ram` on the frozen pond (they slide 40 px further after a charge); 8 `zap-moth` |
| cam ≥ 1900 | `CM:{weapon:'arc-caster'}` @2100; 2 `heatwaver`; `H:caged(gem-red)` @2200 |
| x ≥ 2380 | Exit → `m4-d` |

#### `m4-d` — DOWNHILL DASH (boss) · 3600 × 216 · auto-scroll

- **Ground:** snow at y 176 with moguls (12-px bumps every 160 px) and two jumpable pine
  stumps (solids 16 × 16) at x 900 and x 2100. From x 3200 flat (crash zone). The "downhill"
  feeling comes from the background: `mountains` layer drawn with a steep diagonal slope,
  pines tilted 10°, snow spray behind every runner.
- **Background:** `sky-gradient` {clearing storm, pale blue}; `ice-peaks` 0.1; `mountains`
  {params `tilt: 0.25`} 0.4; `treeline` {snowy} 0.7.
- **Terrain style:** `{ ground: 'snow', edge: 'snow', platform: 'wood', solid: 'rock' }`.

| Trigger | Event |
|---|---|
| start | Summit. `H:forecaster(auto)` @80; `C:bombs` @120. t+60: a Front cargo glider (decor) is hit by the blizzard and drops its crate: the **spare Swan** lands @200 |
| t+180 | The summit chalet (decor) grinds, unfolds its skis and launches: `WARNING!` card **CUCKOO CHALET**. Music → `boss`. Auto-scroll 1.0 px/tick (slower than the Swan's 1.2) |
| cam = 3200 | If phase 2 is still running: **lock 3200–3200** + treadmill drift 1 px/tick until the gearworks fall |
| gearworks destroyed | The chalet hits a giant pine (decor at the view's right edge) — collapse, snow cloud; lock at the current view; phase 3 vs the cuckoo-bot (§10.4) |
| every 600 ticks (phases 1–2) | 2 `kite-trooper` glide in from the top |
| boss dead | Clock face rolls downhill; `MISSION COMPLETE` |

### 11.5 m5 — EYE OF THE STORM (Sky Fortress)

- **Biome and mood:** above the clouds at the Maelstrom Engine. Indigo and violet storm sky
  with a gold sunset band under it, lightning everywhere; the fortress is dark steel with
  yellow hazard stripes; the studio inside is purple with neon and studio lights; the final
  arena is the calm **eye**: clear blue sky and sunshine.
- **Music:** `shmup` (a), `m5` (b, c1, c2), `boss-final` (d). **Hostage target:** 6.
- **Route:** `m5-a` (Gullwing flight + Storm Crown) → crash landing → `m5-b` (deck) → branch
  (`m5-c1` shaft, scroll down | `m5-c2` antenna gantry) → `m5-d` final boss.

#### `m5-a` — STORMFRONT (shoot-em-up) · 4800 × 216 · auto-scroll 1.0 px/tick · checkpoints x 1200, 2400, 3600

- **Terrain:** none (open sky). The jets are clamped to the view; there is no pit.
- **Hazards:** **lightning columns**: a cloud above glows 40 ticks (marker line from top to
  bottom, 16 wide, faint), then a bolt fills the column for 20 ticks.
- **Background:** `sky-gradient` {top `#1a1030`, bottom `#d08040`}; mission generator
  `engine-silhouette` (the far Maelstrom Engine, grows: offsetY decreases 1 px per 160 px of
  scroll) 0.03; `clouds` {purple-grey, large} 0.2; `clouds` {darker, small} 0.5; front
  layer `clouds` {thin wisps, alpha 0.5, front: true} 1.3.
- **In-flight pickups:** weapon crates float under small balloons (shoot the balloon, then
  touch the crate): `pickup-weapon` = vulcan level +1; `pickup-bombs` = +5 swarm volleys.

| Trigger | Event |
|---|---|
| start | The Gullwings fly in from the left (60 ticks). Announcer: `"MISSION FIVE. FINAL FORECAST!"` Music → `shmup` |
| cam ≥ 100 | 5 `sleet-jet` in a V (`dive`) from the right |
| cam ≥ 400 | 3 `whirligig` (sine); 3 `jellycloud` drifting |
| cam ≥ 700 | 4 `sleet-jet` (`sine`) from top-right + 4 from bottom-right |
| cam ≥ 1000 | Balloon crate `pickup-weapon` @1100, y 80 |
| cam ≥ 1200 | Checkpoint. `nimbus-blimp` keeps pace with the scroll for 600 ticks; 2 `sleet-jet` (`loop`) |
| cam ≥ 1600 | 6 lightning columns over 600 ticks (random x from `world.rng`, never 2 within 48 px) |
| cam ≥ 2000 | `H:balloonist(bombs)` drifting under a weather balloon @2100, y 70 — shoot the rope: they open a parachute, wave, and the item floats up to the nearest jet |
| cam ≥ 2400 | Checkpoint. 6 `sleet-jet` (`strafe`); 2 `whirligig` (`seeder`; the cloud bounces off jets) |
| cam ≥ 2800 | `nimbus-blimp` #2 + a field of 5 `jellycloud`; balloon crate `pickup-bombs` @3000 |
| cam ≥ 3300 | `H:balloonist(gem-gold)` @3400, y 50 |
| cam ≥ 3600 | Checkpoint. 2 groups of 4 `sleet-jet` (`loop`), 120 ticks apart. [hard] + 4 lightning columns |
| cam = 4400 | Scroll stops. `WARNING!` card: **STORM CROWN** (§10.5 prelude); music → `boss` |
| crown dead | **Set piece — Crash Landing** (300 ticks): a falling rod clips the jets; the jets spin down (4 rotation frames) through the clouds; fade to the deck where the wrecks skid in, smoking; the squad climbs out with singed hair (`spawn` variant) → `m5-b` |

#### `m5-b` — FORTRESS DECK · 2800 × 216 · scroll right · checkpoints x 900, 1900

- **Ground:** steel deck y 176; raised superstructure x 2300–2420 (platforms y 104 and y 140);
  fork at x 2500 (see table).
- **Background:** `sky-gradient` {storm indigo}; `clouds` 0.15; mission generator
  `fortress-towers` (antennas, turbines, flashing beacons) 0.5; `darkness(0.2, 120)` lightning.
- **Terrain style:** `{ ground: 'metal', edge: 'rust', platform: 'metal', solid: 'metal' }`.
- **Set piece — Lightning Rod Alley:** 5 `tesla-mast` at x 900, 960, 1020, 1080, 1140 fire in
  sequence (20 ticks apart, a wave of arcs running right, each arc 48 px), repeating every
  160 ticks. Time the run or destroy them.

| Trigger | Event |
|---|---|
| start | Wrecks smoking @60. `C:bombs` @120; `CM:{weapon:'auto'}` @200 |
| cam ≥ 100 | 3 `rifleman` (`elite`) @400–460; `brolly-guard` @520 |
| cam ≥ 300 | 2 `jellycloud` over the deck; `H:forecaster(auto)` @700 |
| cam ≥ 500 | Lightning Rod Alley active |
| cam ≥ 800 | Checkpoint (x 900). 2 `heatwaver`; 3 `clockwork-hound` |
| cam ≥ 1100 | **lock 1300–1300**: `forecaster-officer` + 4 `rifleman` (`elite`) + `thunder-trooper`; t+200: 2 `kite-trooper`; [coop] +2 elite; [hard] +1 heatwaver. `H:caged(gem-gold)` @1600. Unlock when clear |
| cam ≥ 1700 | Checkpoint (x 1900). 2 `whirligig` (`seeder`); `C:towel` @2000 |
| cam ≥ 2100 | 2 `sleet-sniper` on the superstructure (y 104); `H:runner(food)` @2200 |
| fork | Lower: a **lift** (moving platform 48 × 8) at x 2560–2608 that sinks when stood on; sign `"ENGINE ROOM — STORM STAFF ONLY"`. Upper: ladder platforms x 2640–2700 y 140, x 2700–2760 y 104, x 2740–2800 y 72; sign `"BROADCAST ANTENNA — HIGH WIND"` |
| lower exit | rect x 2560–2608, y 200–216 → `m5-c1` |
| upper exit | rect x 2760–2800, y 24–72 → `m5-c2` |

#### `m5-c1` — GENERATOR SHAFT (branch A) · 384 × 1400 · scroll **down** · checkpoint y 700

- **Layout:** a vertical shaft inside the Engine. One-way metal ledges every 64 px going
  down, alternating sides; **piston platforms** (`movingPlatform`, 48 × 8, 1 px/tick
  horizontal ping-pong) over the open middle at y 420, 560, 1060; side walls with
  wall-mounted `tesla-mast`s; the bottom is solid ground at y 1384.
- **Background:** sky colour `#120a18`; mission generator `engine-shaft` (giant spinning
  turbine blades drawn as a 4-frame layer, pipes, warning lights) factorY 0.5.
- **Terrain style:** `{ ground: 'metal', edge: 'rust', platform: 'metal', solid: 'metal' }`.
- **Triggers** use `camTop ≥ Y`.

| Trigger | Event |
|---|---|
| start | Players at y 40 |
| camTop ≥ 200 | 2 `rifleman` (`elite`) on ledges below; wall `tesla-mast` at y 360 |
| camTop ≥ 400 | Piston platforms active; 2 `jellycloud` rising up the shaft |
| camTop ≥ 600 | Checkpoint (y 700). `H:forecaster(auto)` on y 760; 3 `clockwork-hound` |
| camTop ≥ 800 | **Vertical lock** (camTop 800): 2 `heatwaver` + `forecaster-officer` + 2 `rifleman` (`elite`); [coop] +2 hounds. Unlock when clear |
| camTop ≥ 1000 | 2 wall `tesla-mast`; `C:auto` on y 1144 |
| bottom exit | rect x 160–224, y 1360–1384 (a hatch in the floor) → `m5-d` |

#### `m5-c2` — ANTENNA GANTRY (branch B) · 2000 × 216 · scroll right · checkpoint x 1000

- **Layout:** narrow catwalks (one-way metal platforms) on the broadcast antenna over open
  sky (pit below y 216): x 0–300 y 176; 330–520 y 152; 550–700 y 176; 730–1000 y 140;
  1000–1300 y 176 (rest deck, ground); 1330–1500 y 152; 1530–1700 y 120; 1730–2000 y 176
  (ground). Antenna struts as solids.
- **Wind gusts:** every 300 ticks: wind streak particles 40 ticks (telegraph, `env/wind`) →
  push left 0.6 px/tick for 90 ticks.
- **Background:** `sky-gradient` {storm indigo to gold}; `clouds` {below the catwalks,
  offsetY 120} 0.3; `clouds` 0.6.
- **Terrain style:** `{ ground: 'metal', edge: 'rust', platform: 'metal', solid: 'metal' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | 2 `rifleman` (`elite`); wind gusts start |
| cam ≥ 300 | 3 `sleet-jet` strafe the gantry (`strafe`); `H:forecaster(auto)` @600 |
| cam ≥ 600 | 3 `kite-trooper` riding the wind (vx −1.6); 3 `jellycloud` |
| cam ≥ 900 | Checkpoint (x 1000). 2 `tesla-mast` on struts @1200, @1280; `thunder-trooper` @1250 |
| cam ≥ 1200 | **lock 1300–1300**: `forecaster-officer` + 2 `brolly-guard` + 2 `sleet-jet` passes; [coop] +2 elite. Unlock when clear |
| cam ≥ 1600 | `C:auto` @1800 |
| x ≥ 1980 | Exit (studio door) → `m5-d` |

#### `m5-d` — STUDIO OF STORMS (final boss) · 640 × 216 · scroll right

- **Ground:** studio floor y 176 (metal). Lighting-rig platforms (one-way, 48 wide, y 120) at
  x 296, 424, 552 (view x 40, 168, 296 after the lock).
- **Background, stage 1:** sky colour `#140c20`; mission generator `tv-studio` (studio walls,
  big cameras on dollies, an `ON AIR` sign, rows of cardboard cut-out audience) 0.8.
  **Stage 2:** mission generator `vortex` (spiral cloud bands, purple-grey) with drift
  `driftY −6` (request §11.0-2); floor chunks as described in §10.5. **Stage 3:**
  `sky-gradient` {clear blue `#4aa0e8` → `#c8e8ff`}; `clouds` {white storm wall, only at the
  left and right edges} 0.1; a sun decor; birdsong sfx.
- **Terrain style:** `{ ground: 'metal', edge: 'tiles', platform: 'metal', solid: 'metal' }`.

| Trigger | Event |
|---|---|
| cam ≥ 0 | Corridor with posters `THE ISOBAR HOUR`. `C:bombs` @100, `C:bombs` @180, `CM:{weapon:'auto'}` @200, `H:cook(1up)` @140 (a kidnapped studio caterer) |
| cam ≥ 256 | **lock 256–256**. Music → `boss-final`. Intro (240 ticks): studio lights bang on one by one, applause sfx from the cut-outs, the Grand Forecaster rises from the floor, the Duchess: `"GOOD EVENING. HERE IS YOUR FORECAST."` (speech bubble) |
| stage 1 → 2 | §10.5: `TECHNICAL DIFFICULTIES`, the floor breaks, background → `vortex`; music → `boss-final-fall` |
| stage 2 → 3 | Cockpit ejects; 90-tick breather: `C:bombs` and `CM:{weapon:'auto'}` parachute onto the core cap; background → the eye; music → `boss-final-eye` |
| stage 3 end | Duchess pod falls; the Engine's hum dies → Ending (§13.11) |

---

## 12. Audio

All sounds are synthesized (`defineSfx` recipes) and all songs are **new compositions** for this
project (`defineSong`). The descriptions below give mood, harmony and form only; composers write
their own melodies. No track may quote, transcribe or "arrange" any existing tune.

### 12.1 Sound effects (id → description)

**Weapons**

| id | Description |
|---|---|
| `weapon/pistol` | Short square blip 880→440 Hz in 40 ms + 20 ms noise click |
| `weapon/machine-gun` | 30 ms noise burst + 120 Hz square thump; pitch ±5 % per shot |
| `weapon/blunderbuss` | 150 ms wide noise boom, low-pass sweep 4 kHz→400 Hz, plus a 90 Hz saw "ka-chunk" |
| `weapon/torch` | 200 ms band-passed noise whoosh with a 7 Hz wobble |
| `weapon/bottle-rocket` | Sine whistle 600→1800 Hz over 250 ms + crackle noise |
| `weapon/arc-caster` | 60 Hz saw buzz, bit-crushed, + high crackle, 120 ms |
| `weapon/quill-gun` | Three high-passed "fft" noise ticks, 15 ms each, 12 ms apart |
| `weapon/skipper` | Low "thunk" launch (triangle 140 Hz, 60 ms) |
| `weapon/skip` | Triangle "plink" 1200 Hz, 30 ms (each hop) |
| `weapon/empty` | Dry double click |
| `weapon/grenade-throw` | Short soft whoosh |
| `weapon/knife` | Noise swish, high→low sweep, 80 ms |
| `weapon/knife-hit` | Thwack: noise 20 ms + 200 Hz square 30 ms |

**Explosions and hits**

| id | Description |
|---|---|
| `explosion/s` | 200 ms noise burst + 60 Hz sine thump |
| `explosion/m` | 400 ms noise + 45 Hz thump, bit-crushed tail |
| `explosion/l` | 800 ms layered noise + 35 Hz thump + crackle tail |
| `hit/enemy` | Tiny tick (noise 8 ms) |
| `hit/metal` | Short inharmonic FM ping (machines, boss parts) |
| `hit/shield` | Dull clank (umbrella shield) |
| `crate/break` | Wood crunch: two noise bursts, low-pass 1.5 kHz |

**Player**

| id | Description |
|---|---|
| `player/jump` | Soft rising square blip |
| `player/land` | Low thud (noise, low-pass 300 Hz) |
| `player/die` | Descending slide whistle (sine 1600→300 Hz, 500 ms) + three "boing" triangle drops |
| `player/spawn` | Rising 4-note pulse arpeggio |
| `player/stormhead` | A tiny grumpy thunder: low noise rumble 300 ms with a squeaky pitch blip on top |
| `player/fizzle` | Wet-fuse fizzle: high-passed noise with falling cutoff |
| `player/lightning-call` | Sharp crack + 300 ms crackle |
| `player/squelch` | Wet step (Stormhead), noise blip band-passed at 800 Hz |

**Enemies, creatures, machines**

| id | Description |
|---|---|
| `enemy/alert` | Two-note "huh?" (square 300→450 Hz) |
| `enemy/yell` | Comic yell: saw with vibrato, falling pitch, 400 ms (long falls) |
| `enemy/die` | Short "oof": square 220→110 Hz, 120 ms |
| `enemy/shot` | Enemy rifle: thin noise pop, brighter than player shots |
| `enemy/mortar-load` | "Thoonk": triangle 110 Hz + noise, 150 ms |
| `enemy/rocket` | Fizzing launch: noise with rising band-pass |
| `enemy/laser-sight` | Faint high beep every 10 ticks while a sniper aims |
| `enemy/sniper-shot` | Sharp crack, short reverb tail (delay 2 taps) |
| `enemy/flame` | Roar: low-passed noise 600 ms |
| `enemy/whistle` | Officer whistle: sine 2.2 kHz with a fast trill |
| `enemy/croak` | Toad croak: low saw with 12 Hz LFO, 300 ms |
| `enemy/moth-zap` | Tiny zap |
| `enemy/eel-burrow` | Sandy rumble (noise, band 200–600 Hz) |
| `enemy/ram-snort` | Two snort bursts |
| `enemy/hound-bark` | Metallic bark (FM, ratio 1.4) |
| `enemy/jelly-zap` | Soft rising hum + crack |
| `machine/kettle-whistle` | Rising whistle with steam noise, 600 ms |
| `machine/engine` | Idle rumble chunk (loopable 500 ms) |
| `machine/rotor` | Chop chunk (noise gated at 12 Hz) |
| `machine/jet-pass` | Doppler noise sweep |
| `machine/tesla-charge` | Rising hum 100→400 Hz over 60 ticks |
| `machine/tesla-arc` | Crackle burst |

**Items and hostages**

| id | Description |
|---|---|
| `item/pickup` | Bright two-note up |
| `item/weapon` | Three-note pulse fanfare |
| `item/bombs` | Metal clank + blip |
| `item/food` | "Munch" bloop pair |
| `item/gem` | FM bell sparkle arpeggio |
| `item/1up` | Five-note jingle |
| `item/towel` | Swish + ding |
| `hostage/free` | Hose-unwind "sproing" + short cheer jingle |
| `hostage/give` | Pop |
| `hostage/thanks` | Tiny 4-note jingle |
| `hostage/balloon` | Inflate squeak (sine glide up) |
| `hostage/lost` | Balloon pop (unbanked hostage lost on death) |
| `hostage/bank` | Soft tick (banked at a checkpoint) |

**Vehicles**

| id | Description |
|---|---|
| `vehicle/enter` | Hatch clang + power-up whirr |
| `vehicle/eject` | Pop + spring |
| `vehicle/hurt` | Metal clang |
| `vehicle/alarm` | Two-tone alarm (square 600/800 Hz, 8 Hz alternation) |
| `vehicle/sputter` | Engine coughs: 3 noise bursts with gaps |
| `swan/step` | Servo whine + thud |
| `swan/honk` | A brassy honk: two detuned saws with a fast pitch drop + breath noise |
| `swan/glide` | Wing-flap whoosh |
| `buggy/engine` | Revving buzz (saw with pitch following speed) |
| `buggy/nitro` | Whoosh + rising whine |
| `tub/hover` | Fan hum |
| `tub/splash` | Water splash noise |
| `gullwing/roll` | Fast whoosh |

**Bosses, environment, UI**

| id | Description |
|---|---|
| `boss/warn` | Warning siren: square 440/660 Hz alternating for 2 s |
| `boss/part-break` | Crunch + `explosion/s` |
| `boss/forecast-sting` | Three-note TV-style FM bell sting (original) |
| `boss/cuckoo` | Two-note falling "cuck-oo" (sine, a minor third) |
| `boss/foghorn` | Deep 55 Hz saw drone, slow attack, 1.5 s |
| `boss/applause` | Crackly noise bursts |
| `env/thunder` | Long rumbling low-passed noise, 1.5 s |
| `env/wave-rumble` | Swelling low noise, 1.5 s |
| `env/wind` | Band-passed noise gust, 1 s |
| `env/timber` | Creak (saw glide) + crash |
| `env/avalanche` | Long roar, 3 s |
| `env/birdsong` | A few chirps (sine glides) for the eye of the storm |
| `ui/move` | Tick |
| `ui/confirm` | Two-note up |
| `ui/cancel` | Two-note down |
| `ui/coin` | Coin chime |
| `ui/pause` | Short muted chord |
| `ui/tally` | Counting tick |
| `ui/tally-end` | Ding |
| `ui/countdown` | Beep per continue number |

### 12.2 Announcer lines (speech synthesis; jingle fallback)

| Event | Line |
|---|---|
| Mission start m1…m5 | `"MISSION ONE. BRING AN UMBRELLA!"`, `"MISSION TWO. STAY HYDRATED!"`, `"MISSION THREE. HOLD ON TO YOUR HATS!"`, `"MISSION FOUR. WRAP UP WARM!"`, `"MISSION FIVE. FINAL FORECAST!"` |
| Weapon pickups | see §5 |
| Vehicles | `"SWAN DELIVERED!"`, `"BUCKBOARD READY!"`, `"BATHTUB AFLOAT!"` (first mount in m3-a), `"GULLWINGS UP!"` (m5-a start) |
| Other | `"WARNING!"` (boss card), `"TIME OVER!"`, `"ONE UP!"`, `"MISSION COMPLETE!"`, `"CONTINUE?"`, `"GAME OVER."`, `"FULL FLOCK!"` (tally bonus) |

### 12.3 Music tracks

Instruments available: pulse 12.5 / 25 / 50 %, triangle, saw, noise kick / snare / hat,
FM bell, pad.

| id | Use | Mood | BPM | Key / mode | Instrumentation | Structure |
|---|---|---|---|---|---|---|
| `title` | Title + attract | Cheeky heroic march | 132 | D major with a flat-7 (Mixolydian) colour | Pulse 25 % lead, pulse 12.5 % counter-line, triangle bass in a march pattern, noise snare rolls, FM bell sparkle on downbeats | Intro (4 bars, snare roll + bell call) → A (8) → B (8, bass walks up) → A′ (8) → loop to A |
| `select` | Mode/character select | Bouncy, eager | 112 | G major | Staccato pulse 50 % chords, triangle bass, light hats | 16-bar loop |
| `intro-sting` | Mission intro card | Fanfare | 120 | Bb major | Pulse brass-like stack + snare | 4 bars, no loop |
| `m1` | Monsoon jungle | Steady, damp, determined | 124 | E Dorian | Triangle bass ostinato in eighths, syncopated pulse 25 % hook, soft 16th noise hats ("rain"), pad on i7–IV–♭III–♭VII | Intro 4 → A 16 → B 16 (pad swell + thunder noise hits) → A′ 16 → loop |
| `m2` | Mirror desert | Hot, swaggering | 138 | A Phrygian dominant | Saw lead with slides, triangle bass in a 3-3-2 rhythm, clicky noise percussion, pad drone on A | Intro 8 → A 16 → B 16 → breakdown 8 (drums only) → loop |
| `chase` | m2-b buggy, m4-a avalanche | Relentless | 152 | C minor (last part lifts to D minor) | 16th-note pulse arpeggios, four-on-the-floor kick, snare on 2 and 4, octave saw bass | A 16 → B 16 → C 16 (up a whole step) → loop |
| `m3` | Hurricane harbour | Rolling, sea-shanty swagger (original tune) | 96 (dotted quarter, 6/8) | F minor | Square lead, "squeezebox" pad from two detuned 50 % pulses, triangle bass on beats 1 and 4, noise snare | A 16 → B 16 → A′ 16 → loop |
| `climb` | m3-c, m4-b vertical climbs | Urgent, rising | 144 | B minor, then C# minor, then D# minor | Pulse ostinato, double-time drums, rising bass sequence | Three 8-bar blocks, each a whole step higher → loop to the first |
| `m4` | Blizzard caves and cable cars | Icy, playful | 116 | D minor, B section in F major | FM bell lead, triangle bass, sparse noise, shimmering pad; B section uses big octave-plus-sixth leaps on pulse (alpine flavour, original) | A 16 → B 16 → A 16 → loop |
| `shmup` | m5-a flight | Soaring | 160 | E minor | Long-note pulse 25 % lead, fast pulse 12.5 % arpeggio, driving kick/snare, saw bass | A 16 → B 16 → C 8 (half-time) → loop |
| `m5` | Fortress interior | Menacing, mechanical | 132 | C# Phrygian | Low saw ostinato, pulse stabs, marching noise snare, FM bell "alarm" motif every 8 bars | Intro 8 → A 16 → B 16 → loop |
| `boss` | Bosses m1–m4 and mini-bosses | Aggressive | 148 | G minor | Saw bass eighths root/octave, pulse lead riffs, snare fills every 4 bars | A 16 → B 16 → loop |
| `boss-final` | Final stage 1 (studio) | A twisted TV theme | 156 | A minor with tritone (Eb) stabs | FM bell "broadcast" motif in minor, pulse lead, saw bass, crash-like noise | A 16 → B 16 → loop |
| `boss-final-fall` | Final stage 2 (the fall) | Vertigo | 156 (half-time feel) | A minor | Tremolo pad, descending chromatic bass, sparse pulse cries | 16-bar loop |
| `boss-final-eye` | Final stage 3 (the eye) | Hopeful surprise, building to triumph | 140 | A major | Bright pulse lead with harmony line, triangle bass, full drums; starts quiet, adds a layer every 8 bars | 32-bar build → loop last 16 |
| `mission-complete` | Tally start | Victory fanfare | 120 | C major | Pulse brass stack, triangle, snare | 4 bars, no loop |
| `tally` | Score tally | Light, bouncy | 120 | Bb major | Pulse 12.5 % melody, triangle, hats | 8-bar loop |
| `continue` | Continue countdown | Tense ticking | 100 | E minor | Triangle pulse, clock-like hats, low pad | 4-bar loop |
| `game-over` | Game over | Sad but comic | 72 | D minor | Pulse melody descending, triangle, ends with a "wah" pitch bend down | 8 bars, no loop |
| `ending` | Ending scene | Warm sunrise | 96 | Eb major | Pad → bell → pulse melody, full harmony at the end | Intro 8 (pad only) → theme 16 → final 8 |
| `credits` | Credits roll | Cheerful, nostalgic | 120 | F major | Reprises the `title` motifs (same composer's material) | 32-bar loop |
| `high-score` | Name entry and table | Playful | 108 | G major | Pulse lead, triangle, light hats | 8-bar loop |

---

## 13. UI & flow

Fonts: `small` (≈5×7) and `big` (8×8). Coordinates are screen pixels on 384×216; `(x,y)` is
the text anchor; "C" = centred on x 192. Default text colour white with a 1-px dark outline.
Blink = 30 ticks on / 30 off.

**Flow:** Boot → Title (⇄ attract demo ⇄ high scores) → Mode select → Difficulty →
Character select → Mission intro card → Gameplay (⇄ Pause) → Mission complete tally → next
mission intro … → Ending → Credits → High-score entry → Title. Game over → high-score entry
(if qualified) → Title.

### 13.1 Boot

- `LOADING...` small, C, y 100; progress bar 100 × 4 at (142, 112), white fill on dark grey.

### 13.2 Title

- **Background scene:** stormy dawn sky (`sky-gradient` + `clouds`), the SW-3 Swan silhouette
  walking slowly along a ridge (1 px every 4 ticks), lightning flashes every ~4 s.
- **Logo:** `METAL SWAN` in `big` font scaled ×2 (C, y 36), steel ramp with a bevel; a large
  procedural **"3"** to the right whose top curve is drawn as a swan's neck and head (white,
  orange beak), 48 px tall.
- Tagline: `LOCK, LOAD & HONK!` small, yellow, C, y 96.
- `PRESS START` big, blinking, C, y 150.
- Top centre: `HI 100000` small, C, y 4 (the best score).
- Bottom right: `CREDITS 5` (or `FREE PLAY`) small, right-aligned at (380, 206).
- Bottom left: `AN ORIGINAL ARCADE GAME` small at (4, 206).
- **Attract:** after 20 s without input: demo gameplay (bot on m1-a, 30 s) with `DEMO PLAY`
  blinking big at C, y 100; then the high-score table for 8 s; then back to the title.

### 13.3 Mode and difficulty select

- Header `SELECT MODE` big, C, y 40. Items (big, C): `1 PLAYER` (y 80), `2 PLAYERS` (y 96),
  `OPTIONS` (y 112), `HIGH SCORES` (y 128). Cursor: a small swan-head arrow left of the item.
- Then `DIFFICULTY` big, C, y 40; items `EASY` (y 80), `NORMAL` (y 96), `HARD` (y 112);
  a hint line small, C, y 150: EASY `MORE LIVES, SLOWER BULLETS.` · NORMAL
  `THE WAY IT WAS MEANT TO BE PLAYED.` · HARD `FOR VETERANS. AND SHOW-OFFS.`

### 13.4 Character select

- Header `CHOOSE YOUR SOLDIER` big, C, y 10. Timer `15` big, right-aligned at (380, 10),
  counts down; at 0 the highlighted soldier is chosen.
- Four portrait frames (36 × 36) centred at x 72, 152, 232, 312, y 52; names under them,
  small, y 76: `JUNO`, `OTTO`, `PIP`, `ROSA`.
- Cursors: P1 cyan frame with `1P` tag, P2 magenta frame with `2P` tag. Two players may not
  pick the same soldier (the taken one turns grey).
- Below: the highlighted soldier full-body in the `victory` pose (×1) at C, y 150; rank and
  name small, C, y 160 (`CAPTAIN JUNO VARGA`, `SERGEANT OTTO BRAMBLE`, `CORPORAL PIP SAITO`,
  `LIEUTENANT ROSA DELACROIX`); quote small, yellow, C, y 172 (§3).
- Confirm: the soldier salutes; `ui/confirm`; the portrait flashes white 8 ticks.

### 13.5 Mission intro card (~240 ticks, skippable after 60)

- Background: a dark-blue weather map with white coastlines and slowly drifting isobar
  lines (procedural).
- `MISSION 1` big, C, y 64 → mission name big, yellow, C, y 84 (`RAIN CHECK`,
  `HEATSTROKE HIGHWAY`, `HURRICANE HARBOR`, `WHITEOUT PEAK`, `EYE OF THE STORM`) → subtitle
  small, C, y 100 (`MONSOON DELTA`, `MIRROR DESERT`, `FLOODED PORT`, `BLIZZARD MOUNTAIN`,
  `SKY FORTRESS`).
- Briefing (§2.3) small, C, y 130 and y 140, typed at 1 character per 2 ticks.
- Last 40 ticks: `START!` big, C, y 170; announcer line (§12.2); `intro-sting`.

### 13.6 HUD (gameplay)

| Element | Position | Content |
|---|---|---|
| P1 tag + score | (4, 4) | `1P` cyan, then score 7 digits small at (18, 4): `0001200` |
| P1 weapon box | (4, 13), 44 × 11, dark frame | weapon icon 16 × 8 at (6, 14); ammo small right-aligned at (46, 15): `--` for the pistol, else the number |
| P1 bombs | (52, 14) | grenade icon 6 × 6 + `x10` small (vehicle: special icon + count) |
| P1 lives | (4, 27) | 8 × 8 head icon from the portrait + `x3` |
| P1 hostages | (28, 27) | banked: tied-figure icon + `x4`; unbanked: up to 5 red balloon icons (4 × 6) after it, then `+n` |
| P1 vehicle | (4, 38) | vehicle name small (`SWAN`, `BUCKBOARD`, `BATHTUB`, `GULLWING`) + HP cells 8 × 4 each with 1-px gaps; Buckboard nitro gauge 20 × 2 under it |
| P1 Stormhead | (4, 46) | cloud icon + 24 × 2 timer bar, blinks in the last 120 ticks |
| P2 blocks | mirrored | right-aligned at x 380 (`2P` magenta) |
| No P2 | (380, 4) right-aligned | `PRESS START` blinking; `CREDITS 3` small under it (y 13) |
| Timer | C | `TIME` small at y 3; digits big at y 11 (`60`); red and blinking below 10 |
| Boss bar (option) | bottom | boss name small at (8, 199); bar 368 × 4 at (8, 208), red fill on dark grey, white flash on part breaks |
| Banners | C, y 90 | big: `WARNING!` (red, blinking, + boss name small y 104), `TIME OVER!`, `1UP!`, `AVALANCHE!`, `SPOTTED!` (world-space over the player), `OUT OF GAS!` |
| Score popups | world space | small, at the kill position, rising 12 px over 30 ticks: `100`, `1000` … |
| Checkpoint | C, y 60 | small `CHECKPOINT` for 60 ticks + `hostage/bank` ticks |

### 13.7 Pause

- World frozen; dark overlay alpha 0.6. `PAUSE` big, C, y 60. Items big, C: `CONTINUE`
  (y 96), `OPTIONS` (y 112), `QUIT TO TITLE` (y 128). Quit asks `QUIT? YES / NO` (small, C,
  y 150; default NO).

### 13.8 Continue countdown

- `CONTINUE?` big, C, y 72; the digit `9`…`0` big at scale ×2, C, y 100; `CREDITS 2` small, C,
  y 136; `PRESS START` blinking big, C, y 156. 1 player: world darkened 50 % and frozen.
  2 players: the same texts drawn small inside the dead player's HUD corner. Music
  `continue`; `ui/countdown` per digit.

### 13.9 Game over

- `GAME OVER` big, C, y 100, letters drop in one by one (4 ticks apart); music `game-over`;
  after 240 ticks → high-score entry (if qualified) or title.

### 13.10 Mission complete tally

- `MISSION COMPLETE!` big, C, y 24 (announcer). Music `mission-complete`, then `tally`.
- Per player (1P left column x 24, 2P right column x 200; small font), lines appear one by
  one with counting ticks:

```
HOSTAGES      8 x 2000     16000
FULL FLOCK BONUS           20000
NO MISS BONUS              30000
BOSS TIME BONUS             4500
MISSION TOTAL              70500
SCORE                    0213400
```

- Story caption (§2.4) small, yellow, C, y 176, after the counting ends.
- `PRESS START` blinking small, C, y 200 (skips the counting; a second press continues).

### 13.11 Ending (≈ 1 500 ticks, start skips to credits after 300)

| Ticks | Scene | Text (small, C, y 190 unless noted) |
|---|---|---|
| 0–240 | The Engine's lights die; the storm clouds unroll like a carpet; first real sunlight | `THE MAELSTROM ENGINE IS OFF THE AIR.` |
| 240–600 | The squad parachutes onto a sunny beach. Juno lands perfectly and writes in her notebook; Otto lands in the sea and stands up with a fish in his beard; Pip's chute snags a palm tree and she hangs upside down, grinning; Rosa lands sitting in a deck chair without spilling her tea | `THE CYGNET SQUAD RETURNS TO EARTH.` |
| 600–900 | Rescued weather staff float down under red balloons and cheer (up to 12 figures, count = total hostages rescued in the run) | `ALL FORECASTERS ACCOUNTED FOR. MOSTLY.` |
| 900–1140 | Far out at sea, the Duchess paddles an **inflatable swan pedal-boat** under her own tiny rain cloud and shakes her pointer at the sky | `FORECAST FOR TOMORROW: SUNNY.` then `FOR HER: SCATTERED SHOWERS.` |
| 1140–1500 | The Swan walker wades out of the surf and honks at the sunset; title logo fades in | `THANK YOU FOR PLAYING` big, C, y 100 |

Music `ending`.

### 13.12 Credits

- Music `credits`. A **cast parade**: every enemy, machine, creature and boss (small-scale
  sprites where needed) walks, rolls or flies across the screen left to right at y 150 with
  its name small at y 186 (`DRIZZLER`, `BROLLY GUARD`, … `DUCHESS OTTILIE ISOBAR`). Above,
  scrolling credit lines (small, C):
  `METAL SWAN 3` · `GAME DESIGN` · `PROGRAMMING` · `PROCEDURAL PIXEL ART` ·
  `SYNTHESIZED MUSIC AND SOUND` · `LEVEL DESIGN` · `TESTING` · `SPECIAL THANKS` ·
  `AND YOU!` — names under each heading are filled in by the team.
- Ends with the final score per player and `THE END` big, C, y 100 (hold 180 ticks) →
  high-score entry.

### 13.13 Options

Header `OPTIONS` big, C, y 16. Items small, left at x 96, values right-aligned at x 300,
rows every 14 px from y 48:

| Item | Values |
|---|---|
| `MUSIC VOLUME` | `0`–`10` (default 7) |
| `SFX VOLUME` | `0`–`10` (default 8) |
| `ANNOUNCER` | `ON` / `OFF` |
| `DIFFICULTY` | `EASY` / `NORMAL` / `HARD` |
| `CREDITS` | `3` / `5` / `9` / `FREE PLAY` |
| `BOSS BAR` | `ON` / `OFF` (default ON) |
| `SCREEN SHAKE` | `FULL` / `LOW` / `OFF` |
| `FLASHES` | `ON` / `REDUCED` (reduced: lightning flashes and white boss flashes at 30 % alpha) |
| `CONTROLS` | opens the rebinding screen: `PRESS A KEY FOR <ACTION>` |
| `BACK` | |

### 13.14 High scores

- Header `HIGH SCORES` big, C, y 16. Ten rows from y 40, every 14 px: rank (`1ST`…`10TH`) at
  x 40, name (3 letters) at x 96, score 7 digits right-aligned at x 260, mission reached
  (`M1`…`M5`, `ALL`) at x 280, character head icon at x 320.
- Default table: `SWN 100000 ALL`, `JUN 090000 M5`, `OTO 080000 M5`, `PIP 070000 M4`,
  `ROS 060000 M4`, `GUM 050000 M3`, `CKO 040000 M3`, `HNK 030000 M2`, `WET 020000 M2`,
  `SUN 010000 M1`.
- Entry: `ENTER YOUR NAME` big, C, y 40; three letter slots big at C, y 80; the selected slot
  cycles `A`–`Z`, `0`–`9`, `.`, `!`, `END` with up/down, fire confirms, 30-second timer
  small at (380, 4).

---

## 14. Scoring

All in-game score is multiplied by the difficulty multiplier (§4.6); tally bonuses are not.
Each player scores separately.

### 14.1 Kills

| Source | Score |
|---|---|
| `rifleman` | 100 |
| `kite-trooper` | 200 (+100 for shooting down the kite) |
| `brolly-guard`, `hailer`, `thunder-trooper` | 300 |
| `heatwaver` | 400 |
| `sleet-sniper` | 500 |
| `forecaster-officer` | 1 000 (+ dropped `gem-red`) |
| `elite` variant (m5) | +50 % |
| `zap-moth` | 100 |
| `mudskipper` | 300 |
| `bog-toad`, `clockwork-hound` | 400 |
| `jellycloud` | 500 |
| `dune-eel` | 600 |
| `frost-ram` | 800 |
| `whirligig` | 800 |
| `sleet-jet` | 500 |
| `tesla-mast` | 1 000 |
| `gale-jeep` | 1 500 |
| `plow-crawler`, `squall-boat` | 2 500 |
| `kettle-tank` | 3 000 |
| `nimbus-blimp` | 5 000 (+300 per turret) |
| Enemy gondola (m4-c1) | 1 000 |
| Shootable enemy projectiles: rocket 50; barrel, snowball, saw-gear 100 | |

### 14.2 Bosses

| Source | Score |
|---|---|
| Mini-boss part | 1 000 each |
| `sand-schooner` | 20 000 |
| `dockside-grabber`, `blizzard-cannon` | 15 000 |
| `storm-crown` | 40 000 |
| Boss part (m1–m5) | 2 000 each |
| `drenchnought` | 30 000 |
| `mirage-engine` | 35 000 |
| `gale-keeper` | 40 000 |
| `cuckoo-chalet` (incl. `cuckoo-bot`) | 45 000 |
| `grand-forecaster` | 60 000 |
| `duchess-pod` | 100 000 |
| **Boss time bonus** (tally) | 100 × max(0, 90 − seconds from the end of the intro to the kill); m5: 100 × max(0, 240 − seconds for all three stages) |

### 14.3 Style bonuses

| Source | Score |
|---|---|
| Knife kill | ×2 the enemy's score |
| Swan Dive kill (§8.1) | +500 per enemy |
| Set-piece kill (enemy killed by the falling tree, idol, billboard, water-tower flood, sun spot, rogue wave, avalanche, falling container) | +200 per enemy, popup `SET PIECE!` |
| Reflected-bullet kill (an enemy hit by its own reflected or redirected shot) | +300 |

### 14.4 Objects, items, hostages

| Source | Score |
|---|---|
| Crate broken | 50 |
| Breakable decor (rocks, crystal walls, ice walls, the tree, the idol, the billboard legs, the water tower) | 100 |
| Pickups | §7.1 (weapon 200, bombs 200, food 100–3 000, gems 1 000–50 000, towel 100, shells 500, repair 500) |
| Hostage released | 500 |
| Tally: banked hostage | 2 000 each |
| Tally: FULL FLOCK (mission target reached) | 20 000 |
| Tally: NO MISS (no life lost in the mission) | 30 000 |

### 14.5 Secret crowns (`pickup-gem` kind `crown`, 50 000 each)

One per mission, always in a non-branch section so both routes can get it:

| Mission | Where |
|---|---|
| m1 | m1-b: on the frog idol's head (x 1010, y 40) — reach it with a Swan hop + glide, or from the courtyard ledge before the idol falls |
| m2 | m2-a: inside the rock outcrop at x 1300 (`breakable(30)`, cracks show after the first hit) |
| m3 | m3-c: on a filing cabinet in a side office behind a window at y 900 (left wall) |
| m4 | m4-a: on top of the ski-lift pylon at x 2200, y 40 (jump from the balloonist's pole crossbar) |
| m5 | m5-b: the 5th mast of Lightning Rod Alley drops it when all five are destroyed |

### 14.6 Game-level bonuses

| Source | Score |
|---|---|
| Game clear | 50 000 + 20 000 per remaining life |
| No-continue clear | +100 000 |
| Extends | +1 life at 200 000 and at 600 000 |

---

## 15. Content ID index

**Section ids:** inside each `MissionDef` the section ids are the short suffixes `a`, `b`,
`c1`, `c2`, `d` (so `?mission=m1&section=b` works); this document writes them with the
mission prefix (`m1-b`) for clarity.

### 15.1 Characters (`characters/`)

`juno`, `otto`, `pip`, `rosa`, `recruit` (test only).

### 15.2 Weapons and projectiles (`weapons/`)

- Player weapons: `pistol`, `machine-gun`, `blunderbuss`, `torch`, `bottle-rocket`,
  `arc-caster`, `quill-gun`, `skipper`.
- Bomb and melee: `grenade`, `knife`.
- Vehicle guns: `beak-vulcan`, `honk-shell` (Swan); `sand-hornet`, `bonnet-gun`,
  `tumble-mine` (Buckboard); `tap-cannon`, `depth-charge` (Bathtub); `nose-vulcan`,
  `swarm-missile` (Gullwing).
- Player projectiles: `bullet-pistol`, `bullet-mg`, `pellet`, `flame-blob`, `flame-patch`,
  `rocket-bottle`, `arc-bolt`, `quill`, `skip-mine`, `grenade`, plus the vehicle shells above.
- Enemy projectiles (defined by their owners' folders): `enemy-bullet`, `enemy-grenade`,
  `hail-shell`, `hail-shard`, `enemy-rocket`, `sniper-bullet`, `flame-jet`, `kite-bomb`,
  `spout-shell`, `steam-cloud`, `aerial-bomb`, `cloud-seeder`, `cannon-shell`,
  `cannonball`, `container`, `snowball`, `icicle`, `water-pellet`, `barrel-bomb`, `flare`,
  `heat-ring`, `glass-blob`, `sound-wave`, `shockwave`, `saw-gear`, `cuckoo-dart`,
  `storm-ball`, `hailstone`, `raindrop`, `lightning-strike`, `cloud-puff`.

### 15.3 Items (`items/`)

`crate` (params `look: 'wood' | 'metal'`, `contents`), `hostage` (params `kind:
'forecaster' | 'balloonist' | 'cook' | 'caged' | 'stowaway' | 'runner'`, `drop`),
`pickup-weapon` (`weapon`), `pickup-bombs`, `pickup-food` (`kind: 'toast' | 'soup' |
'fish-can' | 'pie' | 'cake'`), `pickup-gem` (`kind: 'gem-blue' | 'gem-red' | 'gem-gold' |
'medal' | 'crown'`), `pickup-1up`, `pickup-towel`, `pickup-shells`, `pickup-repair`.
Status id: `stormhead`.

### 15.4 Entities

| Registry folder | ids |
|---|---|
| `infantry/` | `rifleman`, `brolly-guard`, `hailer`, `thunder-trooper`, `sleet-sniper`, `heatwaver`, `kite-trooper`, `forecaster-officer` (variants via `params.variant`: `poncho`, `desert`, `sailor`, `parka`, `elite`) |
| `machines/` | `kettle-tank`, `gale-jeep`, `plow-crawler`, `squall-boat`, `whirligig` (`params.variant: 'seeder'`), `sleet-jet` (`params.path`), `nimbus-blimp`, `tesla-mast` (`params.flipY`); mini-bosses `sand-schooner`, `dockside-grabber`, `blizzard-cannon` |
| `creatures/` | `bog-toad`, `zap-moth`, `dune-eel`, `mudskipper`, `frost-ram`, `jellycloud`, `clockwork-hound` |
| `vehicles/` | `swan`, `buckboard`, `bathtub`, `gullwing` |
| `bosses/m1` | `drenchnought` |
| `bosses/m2` | `mirage-engine` |
| `bosses/m3` | `gale-keeper` |
| `bosses/m4` | `cuckoo-chalet`, `cuckoo-bot` |
| `bosses/m5` | `storm-crown`, `grand-forecaster`, `duchess-pod` |
| mission-local (inside `missions/mN/`) | `sun-spot`, `mine-cart`, `elevator`, `water-tower`, `billboard`, `crystal-wall`, `road-rock`, `fallen-tree`, `frog-idol`, `ice-bridge`, `icicle-trap`, `gondola`, `enemy-gondola`, `ice-wall`, `piston-platform`, `lift`, `lightning-column`, `avalanche`, `floor-chunk`, `balloon-crate` |

### 15.5 Missions and sections (`missions/`)

| Mission | Sections |
|---|---|
| `m0` | test range (unchanged) |
| `m1` RAIN CHECK | `a` DELTA LANDING, `b` SWAN DROP, `c1` CANOPY WALK, `c2` RIVERBED, `d` PADDLE DOCK |
| `m2` HEATSTROKE HIGHWAY | `a` MIRROR DUNES, `b` HEATSTROKE HIGHWAY, `c1` DUSTY GULCH, `c2` GLASSWORKS MINE, `d` SOLAR FARM |
| `m3` HURRICANE HARBOR | `a` FLOODED DOCKS, `b` CONTAINER YARD, `c` LEANING TOWER, `d` LIGHTHOUSE POINT |
| `m4` WHITEOUT PEAK | `a` AVALANCHE RUN, `b` FROZEN DAM, `c1` CABLE CAR LINE, `c2` ICE CAVES, `d` DOWNHILL DASH |
| `m5` EYE OF THE STORM | `a` STORMFRONT, `b` FORTRESS DECK, `c1` GENERATOR SHAFT, `c2` ANTENNA GANTRY, `d` STUDIO OF STORMS |

Branches: m1 (b → c1 | c2), m2 (b → c1 | c2), m4 (b → c1 | c2), m5 (b → c1 | c2) — four
branches, each rejoining in section `d` before the boss. Vertical sections: m3-c (up), m4-b
(up), m5-c1 (down). Vehicle sections: m1-b (Swan), m2-b (Buckboard), m3-a (Bathtub), m4-d
(Swan), m5-a (Gullwing, shoot-em-up).

### 15.6 Background generators

- Standard (art agent): `sky-gradient`, `clouds`, `mountains`, `hills`, `treeline`, `jungle`,
  `city`, `ruins`, `dunes`, `ice-peaks`, `sea`.
- Mission-local: `mirror-suns`, `solar-panels`, `mine-walls` (m2); `crane-row`,
  `office-interior` (m3); `dam-face`, `ice-cave` (m4); `engine-silhouette`,
  `fortress-towers`, `engine-shaft`, `tv-studio`, `vortex` (m5).
- New params on standard generators: `city` {`style: 'timber'`}, `mountains` {`tilt`}.

### 15.7 Sprite id prefixes

| Prefix | Content |
|---|---|
| `char/<id>/…` | player characters (ARCHITECTURE §6.1 animation names) |
| `enemy/<id>/…` | infantry (ARCHITECTURE §6.1 enemy animation names) |
| `machine/<id>/…` | enemy machines and mini-bosses |
| `creature/<id>/…` | creatures |
| `vehicle/<id>/…` | player vehicles |
| `boss/<id>/…` | bosses (per part and per animation) |
| `item/<id>`, `item/hostage/…`, `item/pickup-food/<kind>`, `item/pickup-gem/<kind>` | items |
| `weapon/<id>/…`, `proj/<id>` | weapon art, projectiles |
| `fx/…` | `fx/explosion-s`, `fx/explosion-m`, `fx/explosion-l`, `fx/muzzle-flash`, `fx/smoke`, `fx/spark`, `fx/splash`, `fx/snow-puff`, `fx/soot-puff`, `fx/dizzy-stars`, `fx/flying-hat`, `fx/lightning`, `fx/steam`, `fx/glass-shard`, `fx/gear`, `fx/balloon`, `fx/stormhead-cloud` |
| `decor/<mission>/…` | static props and set-piece art per mission |
| `ui/…` | `ui/icon-<weapon-id>`, `ui/icon-bomb`, `ui/icon-balloon`, `ui/icon-hostage`, `ui/logo`, `ui/logo-3`, `ui/cursor-swan`, `ui/portrait-frame` |

### 15.8 Sound effects

`weapon/pistol`, `weapon/machine-gun`, `weapon/blunderbuss`, `weapon/torch`,
`weapon/bottle-rocket`, `weapon/arc-caster`, `weapon/quill-gun`, `weapon/skipper`,
`weapon/skip`, `weapon/empty`, `weapon/grenade-throw`, `weapon/knife`, `weapon/knife-hit`,
`explosion/s`, `explosion/m`, `explosion/l`, `hit/enemy`, `hit/metal`, `hit/shield`,
`crate/break`, `player/jump`, `player/land`, `player/die`, `player/spawn`,
`player/stormhead`, `player/fizzle`, `player/lightning-call`, `player/squelch`,
`enemy/alert`, `enemy/yell`, `enemy/die`, `enemy/shot`, `enemy/mortar-load`, `enemy/rocket`,
`enemy/laser-sight`, `enemy/sniper-shot`, `enemy/flame`, `enemy/whistle`, `enemy/croak`,
`enemy/moth-zap`, `enemy/eel-burrow`, `enemy/ram-snort`, `enemy/hound-bark`,
`enemy/jelly-zap`, `machine/kettle-whistle`, `machine/engine`, `machine/rotor`,
`machine/jet-pass`, `machine/tesla-charge`, `machine/tesla-arc`, `item/pickup`,
`item/weapon`, `item/bombs`, `item/food`, `item/gem`, `item/1up`, `item/towel`,
`hostage/free`, `hostage/give`, `hostage/thanks`, `hostage/balloon`, `hostage/lost`,
`hostage/bank`, `vehicle/enter`, `vehicle/eject`, `vehicle/hurt`, `vehicle/alarm`,
`vehicle/sputter`, `swan/step`, `swan/honk`, `swan/glide`, `buggy/engine`, `buggy/nitro`,
`tub/hover`, `tub/splash`, `gullwing/roll`, `boss/warn`, `boss/part-break`,
`boss/forecast-sting`, `boss/cuckoo`, `boss/foghorn`, `boss/applause`, `env/thunder`,
`env/wave-rumble`, `env/wind`, `env/timber`, `env/avalanche`, `env/birdsong`, `ui/move`,
`ui/confirm`, `ui/cancel`, `ui/coin`, `ui/pause`, `ui/tally`, `ui/tally-end`,
`ui/countdown`.

### 15.9 Music

`title`, `select`, `intro-sting`, `m1`, `m2`, `chase`, `m3`, `climb`, `m4`, `shmup`, `m5`,
`boss`, `boss-final`, `boss-final-fall`, `boss-final-eye`, `mission-complete`, `tally`,
`continue`, `game-over`, `ending`, `credits`, `high-score`.

---

*End of proposal — "Spectacle & Variety".*
