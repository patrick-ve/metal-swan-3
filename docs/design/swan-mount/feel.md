# SWAN-3 "Metal Swan" as a ridden mount — feel numbers

> **Status:** design proposal, 2026-10-09. **Scope:** movement, aim and combat numbers for the
> ridden `swan`. Look, palette and sprites belong to the art and originality owners.
> **Replaces:** the Size, Move, Aim, Water, Ram and Co-op rows of GDD 8.2 and the `swan` row of
> GDD 8.6. The shared rules of GDD 8.1 stay, except where section 9 of this file says otherwise.
> **Why:** the user asked for a Metal Swan that fills the "fast riding bird" role of the reference
> game: a bird you ride on its back, fast, with very high jumps and an aimable gun. That request
> overrides the canopy rule of GDD §16. The expression stays our own (`docs/ORIGINALITY.md`,
> research §23): a robot swan built by Gramps with a gun in her beak. She never reads as an
> armoured ostrich, has no saddle-and-helmet look and carries no gun on her flank.

**Units and axes.** px, ticks (60 per second), px/tick, px/tick². y grows downward. Points on the
swan are (x, y) from her anchor (the feet centre) with her facing right: +x is forward, −y is up.
Mirror x when she faces left. "The pilot" is the rider on her back (GDD term).

**Math.** Constant acceleration: apex h = v² / 2g, rise time v / g, air time T = 2v / g (while the
fall stays under the max fall speed). Speed change from v1 to v2 at rate a: time |v2 − v1| / a,
distance |v2² − v1²| / 2a. The engine steps with semi-implicit Euler (`vy += g`, then `y += vy`),
so its apexes are 3–4 % lower than the formula. Engine values are given in [brackets] where they
matter. They come from a tick-by-tick simulation of `moveBody`. The GDD quotes formula values: the
on-foot jump is 47 px and 54 ticks by the formula, [45.4 px, 53 ticks] in the engine.

---

## 0. Decisions at a glance

| Topic | Decision |
|---|---|
| Role | The fastest ride and the best jumper. The jump is her main verb. Her contact attack is a STOMP from above. |
| Ground | Run 2.6 px/tick (on foot 1.5, Sundae Driver 2.4, Bandwagon 1.8). Two-stage acceleration: trot 1.5 after 6 ticks, full sprint after 25 ticks. Above 1.6 px/tick a reverse is a short SKID: 7 ticks, about 10 px. |
| Jump | Fixed height. 4-tick squat, vy −5.9 with her own gravity 0.18: apex 96.7 px [93.8] (2.05 × on foot), 65 ticks in the air, 169 px long at a sprint. |
| Wings | GLIDE: hold jump while she falls. One glide per airtime, 60 ticks max, fall ≤ 1.0 px/tick, speed ≤ 2.2 px/tick; the opening flap is her only lift (1.3 px at most above the jump apex). |
| Water | Floats on every `water` rect. Swims at 2.0 px/tick. Same jump, after an 8-tick paddle-up. |
| Aim | Neck arc from +45° (forward-down, air only) to −135° (back-up): 180° in 22.5° steps, 22.5° per 2 ticks. BEAK GUN 10 damage, 1 round per 4 ticks. |
| Damage | 3 cells. The pilot is never hit (8.1 kept), but his body is part of her hurtbox. Her crouch dodges chest-high shots. |
| SWAN DIVE | The ram costs her 1 cell, not her life. She crash-lands dazed for 180 ticks and can be ridden again. With only 1 cell left she gives everything and migrates (lost). |
| Co-op | The partner can stand on her tail (PERCH, a moving one-way platform). No pillion seat. |
| Camera | Requests: clamp driven vehicles to the view; lead 64 and max speed 4 while a swan is ridden. |

---

## 1. The yardstick: how the rides compare

| | On foot (GDD 4.2) | **SWAN-3** (this file) | Sundae Driver (8.3) | Bandwagon (8.4) |
|---|---|---|---|---|
| Top speed (px/tick) | 1.5 (air 2.0) | **2.6** (air ≤ 2.6, swim 2.0) | 2.4 | 1.8 |
| 0 → top speed | 2 ticks | **25 ticks**, 45 px (trot 1.5 after 6) | 30 ticks, 36 px | 30 ticks, 27 px |
| Stop from top speed | 2 ticks | **13 ticks, 17 px** | 16 ticks, 19 px | not given |
| Turn | instant | **instant below 1.6; skid 7 ticks above** | faces its travel direction | not given |
| Jump apex | 47 [45] | **97 [94]** | 35 [33] (vy −3.0) | 22 [21] (vy −2.4) |
| Air time | 54 [53] | **66 [65]** + 4-tick squat | 46 | 37 |
| Jump length at top speed | 108 [106] | **169** (268 with a glide [engine], forward held) | 110 | 66 |
| Contact attack | knife | **stomp from above** | squash above 1.6 px/tick | squash at ≥ 1.0 px/tick |
| Armour | one hit | **3 cells** | 3 cells | 4 cells |
| Gun arc | forward, up, down (air) | **180°: +45° … −135°** | 180°: forward … back (5 directions) | 0° … −120° |
| Deep water | death | **floats and swims** | destroyed | — |
| Crossing the 384 px view | 256 ticks | **148 ticks** | 160 ticks | 213 ticks |

From a standstill [engine]: a 100 px dash takes the swan 47 ticks, the van 57, a player on foot
68. A 400 px run takes 162, 182 and 268 ticks.

What makes each ride feel different:

- **On foot:** instant starts and turns, one hit kills, and jumping is faster than running.
- **SWAN-3:** a quick start, the longest stride, huge jumps and a glide; an aerial bully that
  stomps. Jumping is never faster than running (4.3).
- **Sundae Driver:** heavy momentum (slow to start and to stop), a low hop, squashes what it hits.
- **Bandwagon:** a slow fortress with a tiny hop, 4 cells and a shield.

**Why 2.6 px/tick.** It is clearly the fastest ride: 8 % over the van's top speed, she reaches
1.5 px/tick 3 × sooner (6 ticks against the van's 19), and her jump is 54 % longer. It also stays under the camera's 3 px/tick follow limit
(section 11). A higher speed needs a bigger camera change and cuts the reaction space ahead of her.

---

## 2. Shape, body and hurtboxes

These are logic numbers. The art must match them within 2 px.

| Item | Rect (x, y, w, h) or point | Note |
|---|---|---|
| Body (terrain collision), standing | 28 × 48 | the legs and the hull; the pilot and the neck do not collide with terrain |
| Body, crouched or parked | 28 × 20 | |
| Hurtbox: legs | (−8, −28, 16, 28) | standing, running, jumping, gliding |
| Hurtbox: hull | (−22, −48, 40, 20) | |
| Hurtbox: pilot | (−10, −66, 12, 18) | the rider's torso and head |
| Hurtbox, crouched | (−22, −20, 40, 20) | one box; the pilot ducks flat; top 20 px above the ground |
| Hurtbox, swimming | hull (−22, −30, 40, 16), pilot (−10, −48, 12, 18) | the anchor is on the float line, 16 px under the surface (6.1); the hull reaches from 14 px above the surface to 2 px below |
| Hurtbox, ducked in water | (−22, −24, 40, 12) | from 8 px above the surface to 4 px below |
| Never hurtboxes | neck, head, beak, wings, tail | as GDD 8.2: the neck is the gun |
| Seat zone (mount) | parked (−10, −32, 20, 16); in water (−10, −44, 20, 16) | the top 16 px of her back (8.1). Parked she sits like a resting bird, so the on-foot jump (47 px) reaches it with room to spare |
| Pilot's hips (where `mount` is drawn) | standing (−4, −48); crouched (−4, −20); swimming (−4, −30) | |
| PERCH (co-op) | one-way box (−26, hull top, 14, 4) | section 10 |
| STOMP box | (−14, −6, 28, 10) | under her feet (4.5) |
| Highest points | pilot's head −66; beak −76 when she aims straight up | |

**Rule kept from 8.1: the pilot cannot be hit; the swan takes all damage.** Shots that touch the
pilot box cost her cells. Why keep it:

1. The reference rider is "exposed". We keep that flavour as a **bigger target** (the pilot box
   adds 18 px of height), not as one-hit deaths. A fast mount that dies to one stray bullet would
   feel fragile, which is the opposite of the fantasy the user asked for.
2. Every vehicle shares this rule. One exception would confuse players and the HUD.
3. It is free to build: the base `Vehicle` already protects its driver. The swan only overrides
   `hurtboxes()` to return two or three rects, and every rect damages her the same way.

**Crouch check.** The standard enemy bullet is 8×3 and flies 24 px above the shooter's feet (GDD
9.0), so it spans 22.5–25.5 px. Her crouched top is 20 px, so it passes over, as it does over the
on-foot crouch (16×20). The cymbal frisbee (28 px) and the Encore's high foghorn wave (22–38 px)
pass over too. Standing, a chest-high shot hits her legs (0–28 px).

**Art request (superseded):** the single `mount-duck` frame asked for here is replaced by the
`ride-duck` rider strip of `look.md` §6.4 (decisions #11): the pilot lies flat along her back, and
the crouched rider's head top is 23–25 px above the ground (`look.md` §13.6).

---

## 3. Ground movement

### 3.1 Run and acceleration

Two stages. She starts nearly as fast as a person, then opens up into a long-striding sprint.

| Stage | Rate | Time | Distance |
|---|---|---|---|
| 0 → 1.5 (trot) | 0.25 px/tick² | 1.5 / 0.25 = **6 ticks** | 1.5² / 0.5 = 4.5 px [5.3] |
| 1.5 → 2.6 (sprint) | 0.06 px/tick² | 1.1 / 0.06 = **18.3 ticks** | (2.6² − 1.5²) / 0.12 = 37.6 px |
| Total | | **24.3 ticks** [25] | **42 px** [45] |

- Firing does not slow her (as on foot).
- Legs: a trot cycle with a foot contact every 12 ticks, a sprint cycle with one every 8 ticks.
  Each contact plays `swan/step` and puffs dust.

### 3.2 Braking

No direction held on the ground: **0.2 px/tick²**.

- From 2.6: 2.6 / 0.2 = **13 ticks**, 2.6² / 0.4 = **16.9 px** [15.6].
- From the trot (1.5): 7.5 ticks, 5.6 px.

### 3.3 Turning: the SKID

- **Below 1.6 px/tick** she turns at once, like a player on foot.
- **At 1.6 px/tick or more**, pressing back starts a SKID. She plants her webbed feet and keeps
  facing forward. She slows at **0.3 px/tick²** down to 0.5 px/tick. Then her facing flips and she
  accelerates the other way with the normal two-stage acceleration.

| Case | Time | Distance |
|---|---|---|
| Skid from 2.6 | (2.6 − 0.5) / 0.3 = **7 ticks** | (2.6² − 0.5²) / 0.6 = **10.9 px** [9.8] |
| Skid from 1.6 | 3.7 ticks | 3.9 px |
| Full reversal 2.6 → trot the other way (1.5) | 7 + 2 + 6 = **15 ticks** [16] | |
| Full reversal 2.6 → −2.6 | about 34 ticks [35] | |

- She keeps firing during the skid, toward her old facing.
- A jump cancels the skid. The take-off keeps her speed, and in the air she faces the pressed side
  at once (4.3).
- **Why:** the skid adds weight and a readable "she is fast" moment, but it is short. The
  reference mount's slow turn, a long window with the rider exposed, is a known trait that we do
  not copy. Our skid is 7 ticks, and her armour still protects the pilot.
- **Feel:** sparks and dust from her feet, `swan/skid`, the pilot leans back.

### 3.4 Facing lock and back-pedal (up held)

While **up** is held, left and right do not turn her.

- **Back** moves her backward: a back-pedal, max **1.2 px/tick**, acceleration 0.25. If she was
  moving forward, she first slows at the skid rate (0.3) without turning.
- This is how she aims back-up (−135°, section 7.1) while she retreats.
- When up is released, the normal turning rules apply again.

### 3.5 Slopes, steps and ledges

- **Slopes:** the same rule as on foot. She walks up to 1:1 (engine `maxSlope` 1), her feet follow
  the line, and her speed does not change uphill or downhill. A steeper rise is a wall: she jumps it.
- **Step-up 12 px** (on foot 4): her long legs stride over curbs, snow bumps and small crates, when
  her 48 px body has head room.
- **Snap-down 8 px:** she keeps her feet on small drops at a sprint. On a larger drop she becomes
  airborne (air rules, 4.3).

### 3.6 Crouch, waddle and belly slide

- **Down on the ground = CROUCH.** Her legs fold, her belly touches the ground, her neck folds flat
  and the pilot ducks. Hurtbox 40×20 (section 2).
- **Waddle:** down + left/right moves her at **0.8 px/tick** (on-foot crawl 0.75), with a comic
  side-to-side waddle. Turns are instant at this speed.
- **Belly slide:** crouching at a sprint drops her onto her belly. Her speed eases to 0.8 at the
  brake rate: (2.6 − 0.8) / 0.2 = **9 ticks**, (2.6² − 0.8²) / 0.4 = **15.3 px** [14.4]. Sparks fly
  under her belly. This lets her slide under chest-high fire at speed.
- **Gun:** crouched, the beak fires forward (0°) from 12 px above the ground. That hits crouched
  riflemen, frogs, wind-up bots and rolling records.
- Up while crouched stands her up. Down + jump ejects (9.1).

### 3.7 Ice (m3, Mittens' knitted socks)

On `iceRanges`, her brake and skid deceleration are **0.05 px/tick²** (GDD m3). Her acceleration is
unchanged. Braking from 2.6 takes 2.6 / 0.05 = **52 ticks** and 2.6² / 0.1 = **67.6 px** [66.3]. A
skid on ice is the same long, wobbly slide, with the socks flapping. The socks are cosmetic.

### 3.8 Shallow water (wading)

Where the ground lies less than 16 px under a `water` surface, she wades. She moves as on the
ground, with a splash on each step and **no slowdown** (long legs; a player on foot wades at 75 %).

---

## 4. Jump

### 4.1 Squat and take-off

- Press jump on the ground: a **4-tick squat** (legs compress 6 px, a steam puff from the knees,
  `swan/jump`). She takes off on the 5th tick.
- From water: an **8-tick paddle-up** instead (6.5).
- The press commits her: releasing jump during the squat changes nothing.
- She keeps her speed during the squat: 4 × 2.6 = 10.4 px at a sprint.
- **Coyote 4 ticks:** a jump pressed up to 4 ticks after she ran off a ledge takes off at once,
  without the squat. If she leaves the ground during the squat (she keeps her speed, so she can
  run off a ledge while squatting), she takes off at once too.
- **Jump buffer 6 ticks:** a press up to 6 ticks before landing jumps on landing (with the squat).
  See 5.1 for how a press in the air is told apart from a glide.

### 4.2 Height and air time: fixed

Every jump has the same height, like the on-foot jump (GDD 4.2; research §2: the reference has no
variable jump). The glide (section 5) is how the player extends a jump.

- Her own **gravity 0.18 px/tick²** (on foot 0.13) and **max fall 5.0 px/tick** (on foot 4.0).
- **vy −5.9:**
  - apex = 5.9² / (2 × 0.18) = 34.81 / 0.36 = **96.7 px** [93.8]. On foot: 47.1 [45.4]. Ratio 2.05.
  - rise = 5.9 / 0.18 = **32.8 ticks** [32].
  - fall: she reaches 5.0 px/tick after 5.0 / 0.18 = 27.8 ticks and 5.0² / 0.36 = 69.4 px; the last
    27.3 px take 5.5 ticks; the fall lasts 33.3 ticks.
  - air time ≈ **66 ticks** [65] (on foot 54). From the press to landing: 4 + 65 = 69 ticks.
- **Why her own gravity:** with the shared 0.13, the same apex needs vy −5.0 and takes 77 ticks.
  That is as floaty as Helium Head (vy −4.5, 78 px, 69 ticks). With 0.18 she launches hard, hangs
  briefly and lands heavy: a powerful robot, not a balloon.

### 4.3 Air control

- Air acceleration **0.1 px/tick²** (on foot 0.15). No air drag: with no input she keeps her drift.
- **Air speed cap = clamp(|vx at take-off|, 1.5, 2.6).** She keeps the speed she had when she left
  the ground, and she can always steer up to at least 1.5.

| Jump | Air speed | Length |
|---|---|---|
| From a sprint | 2.6 | 2.6 × 65 = **169 px** |
| Standing, forward held | 0 → 1.5 in 15 ticks (11.3 px), then 50 × 1.5 | **87 px** |
| From water at swim speed | 2.0 | 2.0 × 65 = **130 px** |

- **Why the cap:** jumping is never faster than running or swimming, so hopping never beats the
  ground speed. Without the cap, hopping across the river would average 2.5 px/tick against
  2.0 swimming; with it, hopping averages 2.0 (6.5). A long jump needs a run-up, like a real
  swan's take-off run.
- **Facing in the air** follows the pressed side at once (GDD 4.1), unless up is held (facing lock,
  3.4). Her speed changes only at 0.1 px/tick²: a full reversal from 2.6 to −2.6 takes 52 ticks,
  most of a jump. So she can drift one way and shoot the other way.
- **Reach** [engine]: from a sprint she lands on a ledge 48 px higher 143 px ahead, and on one 80 px
  higher 117 px ahead. Ledges up to about 90 px higher are in reach.
- **Widest gap** at the same height: **169 px** without the glide, **268 px** [engine] with it
  (forward held; 261 px with no input after the glide, 5.2).

### 4.4 Landing

- No speed loss and no fire lock. A 4-tick squash (cosmetic).
- After a fall of 60 px or more: `swan/land`, a dust ring and a 1 px shake for 4 ticks.
- Landing refreshes the glide (5.1).

### 4.5 STOMP

- **Trigger:** she falls at **vy ≥ 1.5**, and her STOMP box (−14, −6, 28, 10) touches the top 12 px
  of a target's hurtbox.
- **Targets:** soft enemies (infantry and creatures), crates, and knifeable slow projectiles
  (enemy grenades, golden eggs, records, barrels). Never machines, bosses or boss parts.
- **Effect:** **100 `crush` damage** to each target in the box, once per stomp. Every infantry type
  (9.1) and every creature (9.3) has ≤ 100 HP, so one stomp kills (`die-crush`, the pancake). A
  stomp on a drummer lands on his body (30 HP), not on his drum.
- **Bounce:** vy **−3.4**: apex 3.4² / 0.36 = **32.1 px** [30.4], 37.8 ticks [37]. The bounce
  refreshes the glide. 2 px shake for 6 ticks, `swan/stomp`.
- A glide (fall ≤ 1.0) never stomps. To stomp from a glide, fold the wings (release jump) and drop.
- The stomped target does not hurt her.

### 4.6 Headroom at the top of the view

Sections that are 216 px tall never scroll up. From the ground line (y 176), a full jump puts her
feet at y 79 [82], the pilot's head at y 13 [16] and an up-aimed beak at y 3 [6]: all in view.
From a surface higher than about **y 160**, the pilot's head leaves the top of the view near the
apex. From the m3-a chalet roofs (y 110 and 120) that lasts about **45 ticks**. This is allowed:
there is no ceiling. Level rule: keep the targets she must hit (enemies, pickups) below y 24.

---

## 5. Wings: the GLIDE

### 5.1 The one rule

**Hold jump while she falls: she spreads her wings and glides.**

- **When:** she is in the air, she is falling (vy > 0), jump is held, and she has not glided yet in
  this airtime.
- **So:** tap jump = a plain fixed jump (fast fall, stomp). Hold jump through the apex = jump plus
  glide. After running off a ledge, a press or a hold after the coyote window = glide.
- **Near the floor a press is a buffered jump, not a glide.** If the surface she would land on
  (ground, platform, or the float line) is within **max(16, 6 × vy) px** below her feet, the press
  buffers the next jump (4.1). This keeps the jump-jump rhythm.
- **Release jump:** the wings fold and normal gravity returns. She cannot open them again until she
  lands.
- **One glide per airtime.** A landing on ground, a platform, a solid or water, or a STOMP bounce,
  refreshes it.
- There is no separate double jump. The wing beat that opens the glide is the "flap".

### 5.2 Numbers

| Constant | Value |
|---|---|
| Opening flap | vy = min(vy, −0.4). At the apex this lifts her 0.4² / (2 × 0.06) = 1.3 px. From a fast fall it stops the fall at once (a save). |
| Glide gravity | 0.06 px/tick² |
| Glide max fall | 1.0 px/tick |
| Glide speed cap | min(air cap, 2.2) px/tick; above it she slows by 0.05 px/tick per tick (2.6 → 2.2 in 8 ticks) |
| Glide time | 60 ticks max. The last 12 ticks warn. Then the wings fold by themselves. |

**Math for a full glide from the apex of a sprint jump:**

1. Flap: she rises 1.3 px in 0.4 / 0.06 = 6.7 ticks.
2. Her fall grows from 0 to 1.0 at 0.06: 16.7 ticks, 1.0² / 0.12 = 8.3 px.
3. She falls at 1.0 px/tick for the remaining 60 − 6.7 − 16.7 = 36.6 ticks: 36.6 px.
4. Drop during the glide: 8.3 + 36.6 − 1.3 = **43.6 px** [44.4].
5. Distance during the glide: 8 ticks slowing from 2.6 to 2.2 (≈ 19 px), then 52 × 2.2 = 114 px:
   **133 px** [132].
6. The wings fold about 54 px [50] above the ground with vy 1.0. She lands 19.6 ticks later:
   54.3 = 1.0 t + 0.09 t² gives t = 19.6.

**After the glide** (the wings fold at 60 ticks or on release) her air speed climbs back to her
air cap at the air accel 0.1 px/tick² while forward is held. With no input she keeps 2.2 (no air
drag).

**Totals** [engine, forward held; the glide on a run-off opens after the 4-tick coyote window]:

| Case | Air time | Distance |
|---|---|---|
| Sprint jump, no glide | 65 ticks | 169 px |
| Sprint jump + full glide | **112 ticks** | **268 px** (261 with no input after the glide) |
| Standing jump + full glide (air cap 1.5) | 112 ticks | 158 px |
| Jump from water at 2.0 + full glide | 112 ticks | 224 px |
| Run off a 48 px ledge at 2.6: no wings / wings | 23 / 66 ticks | 60 / 148 px |
| Run off a 96 px ledge at 2.6: no wings / wings | 33 / 83 ticks | 86 / 193 px (186 with no input) |

### 5.3 Limits: it never trivializes pits and never flies over the level

1. **It barely gains height.** The flap is her only lift: 1.3 px at most [engine 1.1]. No airtime
   rises more than 1.3 px above the jump apex (96.7 px [93.8]).
2. **One glide per airtime, 60 ticks max.** Every airtime ends within 112 ticks.
3. **It is slower than running.** The cap is 2.2 px/tick. A jump plus a glide averages
   268 / (4 + 112) = **2.3 px/tick**, less than the 2.6 run. It is hang time, not travel.
4. **It cannot chain.** Only a landing or a STOMP refreshes it, and a stomp needs a soft target,
   so every refresh in the air is a kill.
5. **It costs exposure.** A glide never stomps, and she stays longer in the air, where riflemen
   shoot 45° up, bats dive and copters fly.
6. **Pit rule for level design:** a pit stops the swan only if it is wider than 268 px (169 px once
   the glide is used). Today no swan section has a pit; m1-c is water and m3-a has none.

Research §14.2 records that the reference team cut a hover move because it "would ruin the
jump-jump-jump tempo". Our answer: the glide is optional (hold), short, and the tap jump does not
change at all.

### 5.4 Feel cues

- **Open:** the wing plates unfold in 2 frames with a mechanical clack and a deep whump
  (`swan/flap`; it may reuse `trumpeter/flap`). 4–6 tin feathers (`fx/tin-feather`: stiff,
  stamped ivory plates with a steel glint, never soft down; `look.md` §16 item 5) burst from the wing roots and
  drift down (drag 0.95, gravity 0.02, life 40–60 ticks, `fxRng`).
- **Gliding:** 1 px `snow` wind streaks from both wing tips every 4 ticks; a soft wind loop
  (`swan/glide`); the pilot's scarf or hair streams back.
- **Tiring (last 12 ticks):** the wings tremble by ±1 px, two steam puffs come from the shoulder
  joints, `swan/tired` (a falling wheeze).
- **Fold:** a short clack (`swan/fold`); the wings snap shut.
- **Landing from a glide:** she skis in on her webbed feet for 6 ticks: dust on the ground, a spray
  line on water.

---

## 6. Water

### 6.1 The float line

- Every `water` hazard rect floats her. The surface y is the rect top.
- **Float line = surface + 16** (`SWAN_SWIM_DEPTH`). While she swims, her anchor (the feet) sits
  on it. Her legs paddle under the hull, and the hull's waterline is on the surface.
- **The float line is a one-way floor that only she uses.** When she moves down across it inside
  a water rect, y = float line and vy = 0, and she swims. Hint for the build: after `moveBody`, if
  she is inside a water rect with y ≥ float line and vy ≥ 0, snap her to it.
- **Ground above the float line wins.** Where the ground under her is higher than the float line
  (shallows, banks), she stands and walks on it (3.8).
- Water never hurts her. Ground shockwaves do not hit her while she swims (kept from 8.2).

### 6.2 Swimming

| Constant | Value | Math |
|---|---|---|
| Max speed | **2.0 px/tick** | 77 % of her run, the same ratio as the old 1.3 walk / 1.0 swim; faster than a player on foot (1.5) |
| Acceleration | 0.08 px/tick² | 0 → 2.0 in 2.0 / 0.08 = **25 ticks**, 2.0² / 0.16 = **25 px** [26] |
| Drag, no input | 0.08 px/tick² | she glides on: stops in **25 ticks**, **25 px** [24] |
| Reverse | pivots at once, brakes at 0.15 px/tick² | 2.0 → 0 in **13.3 ticks**, **13.3 px** [12.4], then accelerates the new way |
| Back with up held | max 1.0 px/tick | facing lock (3.4) |
| Crossing the 384 px view | | 384 / 2.0 = 192 ticks |

On land she skids; in water she pivots on the spot, as a swan does. That contrast is deliberate.

### 6.3 Bob, paddle and wake (cosmetic only)

- **Bob** ±1 px with a 48-tick period. It is a draw offset; the hurtbox stays on the float line.
- **Paddle:** a 4-frame leg blur under the hull. `swan/paddle` plays every 12 ticks while she moves
  and every 32 ticks at rest.
- **Wake:** two ripple lines behind her when |vx| > 1.0.

### 6.4 Duck (down in water)

- Down while swimming: she settles 8 px lower, stretches her neck flat over the water, and the
  pilot ducks. Hurtbox (−22, −24, 40, 12): from 8 px above the surface to 4 px below.
- Chest-high shots from rowboat riflemen (24 px above their deck) pass over her.
- Speed max 1.0 px/tick. The beak fires forward (0°) from 2 px above the surface.

### 6.5 Jumping out and landing in

- **Jump from water:** an 8-tick paddle-up (she runs on the surface with spray), then the normal
  vy −5.9 from the float line. She starts 16 px under the surface, so her feet peak at
  96.7 − 16 = **80.7 px** [77.8] above the surface. Jetties (12 px above the surface), islands (8),
  the boss pontoon (4) and the floating boss crates (30 and 44) are easy.
- **Length:** 2.0 × 65 = 130 px. With the paddle-up, hopping averages (130 + 8 × 2.0) / (65 + 8) =
  **2.0 px/tick**, exactly the swim speed (4.3).
- **Landing in water:** the float line catches her (vy = 0), and the glide refreshes. A cosmetic
  plunge: the sprite dips 2 × min(vy, 5) px (max 10 px) and rises back over 16 ticks; a splash of 12
  droplets and a ring; `swan/splash`.

### 6.6 Banks, islands, jetties, pads

- **Banks that slope into the water:** she walks out where the ground rises above the float line
  (m1-c: at x 880, where the slipway, y = 176 + 0.2 × (x − 780), reaches y 196).
- **Island and quay edges** are walls (polyline ends). She jumps onto them. She cannot step up
  from the float line onto an island at y 172: that is 24 px, and her step-up is 12 px.
- **One-way platforms** (jetties, lily pads, the pontoon, the floating crates, the `duck-float`) do
  not block her sideways. She swims under them and jumps up onto them.

### 6.7 Pits and waterfalls

- `pit`, `kill`, `lava`, crush, or falling below `killY`: she is destroyed at once (8.1: the pilot
  is thrown up with vy −6 and 60 invulnerable ticks).
- **A water rect that ends in open air** (a waterfall edge): she swims off the edge and falls. She
  can glide (5). If she lands in lower water, she swims on (with a plunge). If she falls into a pit,
  8.1 applies.
- **No current:** water never pushes her.

### 6.8 Eject, dive and 0 cells in water

- **Eject while swimming** (down, then jump within 4 ticks, 9.1): she stops at once (vx = 0).
  `Player.checkMount` refuses a new mount until the pilot has landed on a surface (`mountLock`,
  set by `leaveVehicle`, cleared only by `onLanded`), and over deep water he never lands. So **she
  catches him herself** (Swan-module code): for 90 ticks after the eject, while she swims empty and
  in one piece, she calls her own `mount(p)` when her last pilot is falling (vy > 0) with his foot
  box in her water seat zone (−10, −44, 20, 16), from tick 30 on (the remount lock; never with
  Helium Head). Math [engine]: his feet leave at y 164 (float line 196 − 30 − 2) with vy −3.5,
  gravity 0.13; they peak at y 118.6 on tick 26 and fall through the zone (y 152–168) on ticks
  49–55. Without the catch they reach the drowning depth (y 208) on tick 65. He only falls into
  the river if he steers away.
- **SWAN DIVE is refused** while she swims or is in the air (also over water), and at 0 cells. She
  shakes her head and the pilot stays seated. From a platform over water (a jetty, the ENCORE
  pontoon) it is allowed: the pilot pops up over the platform and steers back onto it. A charge
  that runs off a platform or a bank into water ends there with the BEAK BASH, and she floats
  dazed (the `dazed` strip on the float line).
- **0 cells in water:** the shared rule (8.1), and she does not catch him (9.3). The pilot jumps
  out and must reach a pad, jetty, island or float. In m1-c the on-foot path has no static gap over
  48 px, and his somersault with forward held carries him 96–102 px [engine], so one is always in
  reach.

---

## 7. Aim and weapons

### 7.1 The neck arc and the input map

Angles follow the GDD: 0° = her facing, negative = up. The arc runs from **+45°** (forward-down)
to **−135°** (back-up): **180°** in 22.5° steps (9 directions). She cannot aim straight back,
because the pilot sits there.

| Input (relative to her facing) | On the ground | In the air | In water |
|---|---|---|---|
| none or forward | 0° | 0° | 0° |
| up | −90° (facing locked) | −90° (facing locked) | −90° (facing locked) |
| up + forward | −45° | −45° | −45° |
| up + back | −135°, back-pedal (3.4) | −135° | −135°, paddles back |
| down | crouch: 0° from the low beak | **+45°** | duck: 0° at the waterline |
| down + back | crouch, turns at once | faces back at once, +45° | duck, pivots |
| back | turn (SKID at ≥ 1.6 px/tick) | faces back at once, 0° | pivots, 0° |

- The in-between steps (+22.5°, −22.5°, −67.5°, −112.5°) appear only during sweeps.
- When she turns, the neck keeps its angle relative to her facing.

### 7.2 Neck speed and sweep

- The neck turns **22.5° every 2 ticks** toward the target. This is the GDD 4.3 sweep rule, which
  already names the Swan beak gun.
- 0° → −90°: **8 ticks**. −90° → −135°: 4 ticks. +45° → −135°: 16 ticks.
- Rounds fired while the neck moves leave at the current step. A held stream fans out: forward
  → up gives rounds at 0°, −22.5°, −45°, −67.5° and −90°.
- The neck always turns toward the target, not only while she fires.

### 7.3 Neck poses and muzzle points

The beak tip is the muzzle for the gun and for the shell (`muzzle` and `cannon` frame points).
Fallback points (art frame points win):

| Aim | Beak tip (x, y) | Pose |
|---|---|---|
| 0°, standing or running | (+40, −24) | the **hiss pose**: neck stretched forward and low, head at the chest height of infantry |
| −45° | (+34, −58) | neck raised forward |
| −90° | (+14, −76) | neck straight up |
| −135° | (−8, −74) | neck arched back over the pilot; the pilot leans aside |
| +45° (air) | (+36, −14) | neck points down past her chest |
| 0°, crouched | (+38, −12) | head low |
| 0°, swimming | (+40, −22) | 6 px above the surface |
| 0°, ducked | (+40, −18) | 2 px above the surface |

- **Why 24 px for forward:** enemy infantry hitboxes are 14×28 (feet to 28 px). A forward shot from
  an upright neck (beak at about 50 px) would fly over every soldier. From 24 px it hits standing
  infantry and the drummer's drum (26 px tall), and it mirrors the enemy chest-shot height.
- **The relaxed S-neck** (the classic swan look) shows only when she is parked, or ridden and idle
  (no move, no fire) for 40 ticks. A fire press snaps the neck to the aim pose on the same tick, and
  the round leaves from the aim pose. There is no delay.

### 7.4 BEAK GUN (`swan-beak-gun`)

| Property | Value |
|---|---|
| Fire | tap: a 5-round burst; hold: a stream |
| Rate | 1 round per 4 ticks (15 per second) |
| Damage | 10 per round: 150 per second, the same as the van's sprinkles and the machine gun |
| Speed | 8 px/tick (GDD). At a sprint the rounds still pull away from her at 8 − 2.6 = 5.4 px/tick. |
| Jitter | ±1 px across the aim |
| Life / range | 60 ticks / 480 px |
| On screen | max 24 |
| Ammo | infinite |
| sfx | `swan/fire` |

Only the arc changes from GDD 8.2.

### 7.5 BEAK SHELL (`swan-beak-shell`)

GDD 6.3 numbers are kept: speed 4.0 along the neck angle, gravity 0.06, explodes on contact or
terrain, 200 damage to the hit target and 100 to others in r 24, cooldown 30, 10 shells.

**One change: the shell adds her horizontal speed (×1), like the van's mortar.** Without it, a
sprinting swan runs into her own shell. At 0° from the 24 px beak, the shell falls for
√(2 × 24 / 0.06) = 28.3 ticks:

- standing: it lands 4.0 × 28.3 = **113 px** ahead [112];
- sprinting, without the change: it lands 113 px from where she fired, but she has moved
  2.6 × 28.3 = 74 px, so it lands only 39 px in front of her;
- sprinting, with the change: (4.0 + 2.6) × 28.3 = 187 px from where she fired = still **113 px**
  in front of her. The arc looks the same to the player at every speed.

Other arcs [engine]: from the crouched beak (12 px): 80 px. At −45° (beak 58 px up): it peaks
123 px above the ground and lands 314 px away (usually off-screen; it is the anti-air arc).
Straight up: it rises 4.0² / 0.12 = 133 px above the beak. From the air at +45° near the apex
(110 px up): it lands 85 px ahead after 30 ticks.

### 7.6 HONK (`swan-honk`)

GDD 8.2 numbers are kept:

- Fire + bomb (both pressed on the same tick or 1 tick apart, GDD 4.1). A 10-tick wind-up (wings spread, chest puffs). Then a
  ring grows from 0 to **128 px** radius in 16 ticks (128 / 16 = 8 px/tick), centred where she was
  at the end of the wind-up.
- **80 damage** to every enemy part it touches (once). It erases every enemy projectile inside it.
  Infantry inside cover their ears (`ears`, stunned 60 ticks).
- Costs **3 shells**; cooldown **240 ticks**. With fewer than 3 shells: `swan/squeak`, nothing else.
- **New:** in the air, the wind-up holds vy at 0 for its 10 ticks: she hangs with her wings spread.
  It does not use the glide. On water the ring also draws a water ripple.
- At a sprint she moves 2.6 × 16 = 42 px while the ring grows, so she stays deep inside it.

---

## 8. Damage, contact and panic

- **Cells: 3** (van 3, Bandwagon 4). HUD as GDD 13.7.
- **Hits as 8.1:** a small hit costs ½ cell, a big hit 1 cell; crush, `pit`, `lava` and `kill`
  destroy her. After a hit she is invulnerable for 60 ticks.
- The pilot box is part of her hurtbox (section 2).
- **Contact damage to her, as 8.1:** small creatures ½ cell; charging enemies and enemy vehicles
  1 cell (drummer charge, ram-goat charge, rattler lunge, a moving band truck, an exploding
  wind-up bot).
- **Contact damage from her: only the STOMP (4.5) and the SWAN DIVE (9.2).** She does not squash
  or trample when she runs; she passes through standing infantry. Why: the van and the Bandwagon
  own the squash, and the swan's jump is her verb. It also stops the sprint from becoming a free
  kill line.
- **Panic:** the shared 8.1 rule (Legion infantry within 64 px of a moving player vehicle, 30 %
  chance per 60 ticks).
- **At ≤ 1 cell:** the shared warning; she limps (cosmetic: every 4th step hitches) and smokes.

---

## 9. Eject, SWAN DIVE and 0 cells

### 9.1 Eject

- **Down + jump while she stands or swims**, with jump pressed within 4 ticks after down (or on
  the same tick). The shared 8.1 eject: the pilot somersaults out with 16 + 30 invulnerable ticks.
  In water see 6.8.
- **A jump from a held crouch or water duck is a jump.** When down has been held longer than 4
  ticks (her crouch or her water duck), jump is a normal jump out of it, never an eject. Her boss
  reads alternate crouch and jump (the ENCORE foghorn waves and Slide Shot, the WINDBAG Pendulum
  Gondola and Reel), and a player who still holds down when he presses jump must not be thrown
  out where one hit kills him. To leave her from a crouch, press down again with jump.
- **Not in the air.** In the air a jump press is the glide. (GDD 4.1 lists down + jump = eject; for
  the swan it applies only on ground or water.)
- After an eject she sits down (parked pose) after 20 ticks. The empty gags of GDD 8.2 stay: her
  head tucked, her eye following the nearest player, and one `pickup-bombs` "laid" after 600 empty
  ticks (once per section) with Gramps' bubble.

### 9.2 SWAN DIVE (the ram)

A reference animal mount runs off unhurt; a tank explodes. Ours does neither. **The dive costs her
one cell. Then she comes back, or, with nothing left, she migrates.**

| Step | Ticks | What happens |
|---|---|---|
| Combo | 0 | Fire + jump (on the same tick or 1 tick apart, GDD 4.1; a jump pressed before fire is always a plain jump: her squat starts and fire is a shot). The pilot pops up (vy −4.0: 4.0² / 0.26 = 61.5 px, 61.5 ticks) with 60 invulnerable ticks (8.1). |
| Hiss | 6 | The empty swan lowers her neck and raises her wings (a threat display), `swan/hiss`. |
| Charge | ≤ 63 | She accelerates at 0.25 to **3.4 px/tick** (13.6 ticks, 23 px), then runs at 3.4 up to **192 px** in total: 13.6 + 168.9 / 3.4 = 63 ticks. Wings beating. She tramples soft enemies on the way (100 `crush` each) and keeps going. |
| Impact | — | At the first hard enemy (a machine, a boss part, any non-soft enemy), a solid wall, a body wall (the ENCORE wall, the m3-a cliff wall), water ahead of her, or the end of the run: **BEAK BASH**, 400 damage in r 40 (each target once), shake 4 px for 20 ticks, `explosion/l`, with tin feathers and bolts instead of fire. |
| She had ≥ 2 cells | 180 | **Cells − 1.** She bounces back (vx −1.5 × facing, vy −3.0: a 25 px hop [23.5], 33 ticks) and lands on her back, feet paddling the air, three tin feathers circling her head (`swan/dazed`); in water she floats on her back. She is invulnerable and ignored (the empty-vehicle rule). 180 ticks after the impact she rolls upright (12 ticks), shakes off a puff of tin feathers and sits down: `RIDE?` shows again. |
| She had 1 cell | — | She staggers up and **migrates**: she flies up and forward (vx 1.0 × facing, vy −1.5, no gravity), honking (`swan/migrate`), and is removed 32 px above the view top. Gramps on the radio: `SHE'LL BE BACK IN SPRING.` One tin feather drifts down for 120 ticks. The swan is lost. |

- **Limits:** with 3 cells and no repairs she can dive 3 times: 2 dives she survives, then a last one.
  That is 1,200 damage at most, and each survived dive leaves the pilot on foot for at least 180
  ticks of daze plus the walk back to her. A `pickup-repair` buys one more dive. (The plain 8.1 ram
  gives 400 once.)
- **Starts only** while she stands on ground or on a platform; **refused** while she swims or is in
  the air, and at 0 cells (she is disabled). In the air fire + jump is no combo: jump is the glide
  and fire a shot (6.8).
- **Speed:** 3.4 = 1.31 × her run (van 2.8 = 1.17 × 2.4; Bandwagon 2.4 = 1.33 × 1.8). The camera
  does not follow an empty vehicle, so 3.4 is fine.
- **Cheap to build:** the shared ram state, then two small states: `dazed` (a timer, normal
  physics, no mounting) and `migrate` (no collision, constant velocity, removed off-screen).
- If the dive ends off-screen, she does her dazed landing there and waits.

### 9.3 0 cells

The shared 8.1 rule: she stops, flashes and alarms for 60 ticks, then explodes (r 40, 200
damage). The pilot must eject (jump, or down + jump) or die with her (EASY: auto-eject). **Her
wings fold at once (no glide, normal gravity), and a jump press ejects her pilot anywhere, also in
the air**, as the shared doomed state already does. Without this rule a gliding swan (fall
≤ 1.0 px/tick, still about 50 px up at the end of a full glide) could outlast the 60-tick window
with her pilot locked in. In water she does not catch him (6.8): he steers the somersault to a
pad, jetty, island or float. With forward held he travels 96–102 px [engine] before his feet come
down to jetty, island or pad height (y 168–178); the static gaps of the m1-c on-foot path are at
most 48 px.
Cosmetic proposal: she bursts out of the smoke, sooty, and migrates (the same exit as 9.2), so the
swan never dies on screen. Either way she is lost.

---

## 10. Co-op

- **PERCH:** her tail end is a moving one-way platform, 14×4, with its top on her hull top: (−26,
  −48) standing, (−26, −20) crouched or parked, (−26, −30) swimming. It is mirrored when she faces
  left. It moves with her through `world.moveSolid`, so the engine carries a partner who stands on
  it, at her speed (up to 2.6 px/tick). The partner keeps all on-foot controls and can shoot both
  ways: a tail gunner with no new art.
- The perch is **on** while she stands, runs, crouches, skids or swims, and while she is parked.
- **Jumps over land:** it is **off** from the squat to the landing, so the partner stays behind and
  drops to the ground (at most 48 px), or jumps.
- **Jumps over water** (a jump that starts while her x is inside a `water` rect: swimming, or
  standing on a jetty, pad, float, island or the pontoon): it stays **on** from the squat or
  paddle-up to the landing, and the partner rides along. `world.moveSolid` carries a standing rider
  by position and an `onGround` rider keeps vy 0, so the box never launches him; he is set down
  where she lands. Off, he would drop from her swimming hull top (y 166) to the drowning depth
  (y 208), 42 px, in about 25 ticks, and his 4-tick coyote jump could not follow her 73-tick hop.
  A rising box crushes a rider under a solid ceiling, but m1-c has no solid over open water.
- It is **off** during the dive, the daze and the migration.
- When she turns, the perch moves to her other side and carries the partner round with her (a
  one-tick pop; accepted).
- The partner is on foot: one hit kills him, and his own hurtbox applies.
- **Not chosen: a pillion seat.** It needs a seated aiming sprite set (the ARCHITECTURE 6.1 contract
  has only `mount`), a second seat point and a new player state. The perch reuses dynamic solids.
- One pilot per swan. `[2P]` rows place a second swan (m1-c, m3-a).

---

## 11. Camera and engine requests (to the camera and vehicle owners)

**Facts** (`src/engine/camera.ts`, `TUNING.camera`): the camera targets the players' mean x + lead
− 192, with lead 38 (the 40 % line), smoothing 0.2, max speed 3 px/tick and a right-scrolling
ratchet. Players in the `play` state are clamped to the view. Vehicles are not.

1. **Clamp driven vehicles to the view: done.** `Vehicle.keepInView` already clamps a driven
   vehicle like `Player.clampToView` (`Camera.clampX`: half the body width from each view edge; the
   camera's 12 px `margin` is only its follow margin). No request.
2. **Steady follow: no change needed.** At speed v the camera trails its target by 4v px
   (smoothing 0.2). At 2.6 her anchor sits at view x 164; a player on foot sits at 160.
3. **Catch-up: request max speed 4.** After an arena unlock she can sit near the right edge. The
   camera gains only 3 − 2.6 = 0.4 px/tick on a sprinting swan, so it needs **323 ticks** (5.4 s)
   to settle [camera simulation]. With max speed 4 it needs **93 ticks** (1.6 s). Research §22.8
   already says "no cap below 4 px/tick" for the follow speed.
4. **Look-ahead: request lead 64.** At a sprint the space ahead of her beak (+40) is
   384 − 164 − 40 = 180 px: 69 ticks of running, or 35 ticks for a rifle bullet closing at
   2.5 + 2.6 = 5.1 px/tick. On foot it is 209 px and 139 ticks. With lead 64 her anchor sits at view
   x 138 (36 %), so 206 px are ahead: 79 ticks. The lead already eases at 1 px/tick (26 ticks to
   shift from 38 to 64).
5. Set `camera.lead = 64` and `camera.maxSpeed = 4` while any followed player rides a swan.
   Restore 38 and 3 when none does. Both are public `Camera` fields, so the swan module can do
   this itself (GDD 15.9 item 8).
6. **Vertical: no change.** 216 px sections do not scroll (see 4.6).
7. **Shakes:** a landing after a 60+ px fall, 1 px for 4 ticks; a stomp, 2 px for 6 ticks; the dive
   impact, 4 px for 20 ticks (the shared ram value).
8. **Per-body physics:** her Body uses gravity 0.18, maxFall 5.0, stepUp 12 and snapDown 8. The
   glide changes `body.gravity` and `body.maxFall` at runtime (the fields are mutable; Helium Head
   already works this way).

Note: `TUNING.vehicle.ramButtons` is `['fire', 'jump']`, as GDD 4.1 says. The review narrowed the
combo window to "on the same tick or 1 tick apart" (GDD 4.1; `TUNING.vehicle.comboWindow` 4 → 1 is
requested in GDD 15.9 item 7).

---

## 12. Feel cues: sound, fx and personality

Existing sound ids stay: `swan/step`, `swan/paddle`, `swan/fire`, `swan/honk`, `swan/squeak`. The
new ids below are requests to the audio owner. All are synthesized.

| id | When | Sound |
|---|---|---|
| `swan/jump` | take-off | hydraulic "ka-chunk" and a steam hiss |
| `swan/land` | landing after a fall of 60 px or more | heavy thump and a metal clank |
| `swan/skid` | skid start | webbed-foot screech and a hydraulic hiss, 10 ticks |
| `swan/flap` | the glide opens | deep wing whump and a servo whirr (or reuse `trumpeter/flap`) |
| `swan/glide` | loop while gliding | soft filtered-noise wind |
| `swan/tired` | the last 12 glide ticks | falling wheeze |
| `swan/fold` | the wings fold | short clack |
| `swan/stomp` | a stomp | spring "boing" and a crunch |
| `swan/splash` | landing in water | water slap and droplets |
| `swan/hiss` | dive wind-up | angry noise hiss |
| `swan/dazed` | the daze after a dive | three wobbly falling notes |
| `swan/migrate` | migrating | a honk that fades and drops in pitch |

**Fx:** tin feathers (`fx/tin-feather`: glide open, hits, dive impact, daze), steam puffs (squat, tired wings), sparks
(skid, belly slide), dust (steps, landings), spray and ripples (water), wind streaks (glide).

**Personality (cosmetic, cheap):** on a hit she flinches (neck recoil, two tin feathers). After 3
stomps without touching the ground she waggles her tail and honks once. Ridden and idle for 120
ticks, she preens a wing or looks back at the pilot. The empty gags of GDD 8.2 stay.

**What keeps her from being an ostrich copy:** she swims and pivots in water, she glides on her
wings, she HONKs a shockwave, she waddles, she hisses before a dive, and she crash-lands or migrates
instead of running off. Her gun is in her beak, never on her flank.

---

## 13. Knock-on changes for other owners (not edited here)

- **GDD 8.2:** replace the Size, Move, Aim, Water, Ram and Co-op rows with this file. **Look**
  (art and originality owners): the pilot now rides on her back, at the user's request. GDD §16
  and 15.10 item 2 still say "enclosed canopy, not a ridden animal"; update them.
- **GDD 8.6:** swan ram 3.4 / 192 px, and "she survives at ≥ 2 cells (−1 cell)".
- **GDD 6.3:** the beak shell adds the swan's vx.
- **GDD 4.1:** for the swan, jump = jump (hold: glide), and down + jump ejects only on ground or
  water.
- **GDD 1.5, rule 5** ("m2 adds … a fast vehicle"): the van is no longer the fastest ride; reword it
  (for example "a heavy vehicle").
- **m3-a:** the avalanche (1.0 px/tick) cannot threaten a swan at 2.6 px/tick; it was written for a
  1.3 px/tick walker. The SKI JUMP mark (x 2470) is trivial now: a swan that takes off at x 2390
  lands near x 2590 (2.6 × 77 ticks [engine], landing 52 px lower). Suggest a swan mark at x ≥ 2640
  or a landing target zone. Chalet roofs at y 110 and 120: the pilot's head leaves the view for
  about 45 ticks on a full jump (4.6).
- **m1-c:** plan the river for a 2.0 px/tick swimmer and a 97 px jumper (rowboats, bassoonists and
  the Encore's attacks).
- **Golden Goose (Mk2):** if it mirrors the new look, its Legion pilot rides on its back.
- **Numbers:** section 14, kept in the swan module (`src/game/content/vehicles/`), not in
  `src/game/tuning.ts`: its header asks content agents to keep their own numbers in their entity
  definitions. **Art:** the `mount-duck` request is superseded by `ride-duck` (`look.md` §6.4).

---

## 14. Constant table

Names are suggestions (the research §22 style). The numbers live in the swan module
(`src/game/content/vehicles/`), not in `TUNING` (the header of `src/game/tuning.ts` asks content
agents to keep their own numbers); the `SWAN` object below maps them.

| Name | Value | Unit | Note |
|---|---|---|---|
| **Ground** | | | |
| `SWAN_RUN_MAX` | 2.6 | px/tick | on foot 1.5, van 2.4, Bandwagon 1.8 |
| `SWAN_TROT` | 1.5 | px/tick | end of the fast first stage |
| `SWAN_ACCEL` | 0.25 | px/tick² | 0 → 1.5 in 6 ticks |
| `SWAN_ACCEL_HIGH` | 0.06 | px/tick² | 1.5 → 2.6 in 18.3 ticks; full sprint after 25 ticks, 45 px |
| `SWAN_BRAKE` | 0.2 | px/tick² | stops from 2.6 in 13 ticks, 17 px |
| `SWAN_SKID_MIN` | 1.6 | px/tick | reversing at or above this skids |
| `SWAN_SKID_DECEL` | 0.3 | px/tick² | 2.6 → 0.5 in 7 ticks, 10.9 px |
| `SWAN_SKID_END` | 0.5 | px/tick | facing flips here |
| `SWAN_BACKPEDAL_MAX` | 1.2 | px/tick | back with up held |
| `SWAN_CROUCH_SPEED` | 0.8 | px/tick | waddle |
| `SWAN_ICE_DECEL` | 0.05 | px/tick² | brake and skid on `iceRanges` |
| `SWAN_STEP_UP` | 12 | px | on foot 4 |
| `SWAN_SNAP_DOWN` | 8 | px | on foot 4 |
| `SWAN_BODY_W` / `SWAN_BODY_H` | 28 / 48 | px | crouched or parked height 20 |
| **Jump** | | | |
| `SWAN_GRAVITY` | 0.18 | px/tick² | her Body; on foot 0.13 |
| `SWAN_MAX_FALL` | 5.0 | px/tick | on foot 4.0 |
| `SWAN_JUMP_VY` | −5.9 | px/tick | apex 96.7 px [93.8], air 66 ticks [65] |
| `SWAN_SQUAT_TICKS` | 4 | ticks | ground take-off delay |
| `SWAN_WATER_SQUAT_TICKS` | 8 | ticks | paddle-up |
| `SWAN_AIR_ACCEL` | 0.1 | px/tick² | no air drag |
| `SWAN_AIR_CAP_MIN` | 1.5 | px/tick | air cap = clamp(take-off speed, 1.5, 2.6) |
| `SWAN_COYOTE_TICKS` / `SWAN_JUMP_BUFFER_TICKS` | 4 / 6 | ticks | as on foot |
| `SWAN_LAND_SHAKE_FALL` | 60 | px | fall height for the landing thump and shake |
| **STOMP** | | | |
| `SWAN_STOMP_MIN_VY` | 1.5 | px/tick | glides (≤ 1.0) never stomp |
| `SWAN_STOMP_BOX` | (−14, −6, 28, 10) | px | under the feet |
| `SWAN_STOMP_TOP_BAND` | 12 | px | must touch the top of the target's hurtbox |
| `SWAN_STOMP_DAMAGE` | 100 | damage | `crush`; soft targets, crates, knifeable slow projectiles |
| `SWAN_STOMP_BOUNCE_VY` | −3.4 | px/tick | 32.1 px [30.4]; refreshes the glide |
| **GLIDE** | | | |
| `SWAN_GLIDE_FLAP_VY` | −0.4 | px/tick | vy = min(vy, this) when the wings open |
| `SWAN_GLIDE_GRAVITY` | 0.06 | px/tick² | |
| `SWAN_GLIDE_MAX_FALL` | 1.0 | px/tick | |
| `SWAN_GLIDE_SPEED` | 2.2 | px/tick | cap = min(air cap, this) |
| `SWAN_GLIDE_DRAG` | 0.05 | px/tick per tick | slows to the cap |
| `SWAN_GLIDE_TICKS` | 60 | ticks | one glide per airtime |
| `SWAN_GLIDE_TIRE_TICKS` | 12 | ticks | warning before the wings fold |
| `SWAN_GLIDE_BUFFER_MIN` / `SWAN_GLIDE_BUFFER_TICKS` | 16 / 6 | px / ticks | a press within max(16, 6 × vy) px of the landing surface buffers a jump |
| **Water** | | | |
| `SWAN_SWIM_DEPTH` | 16 | px | float line = surface + 16 |
| `SWAN_SWIM_MAX` | 2.0 | px/tick | |
| `SWAN_SWIM_ACCEL` | 0.08 | px/tick² | 25 ticks, 25 px to full |
| `SWAN_SWIM_DRAG` | 0.08 | px/tick² | drifts 25 px |
| `SWAN_SWIM_REVERSE` | 0.15 | px/tick² | pivots at once |
| `SWAN_SWIM_BACK_MAX` | 1.0 | px/tick | back with up held |
| `SWAN_DUCK_SINK` / `SWAN_DUCK_SPEED` | 8 / 1.0 | px / px/tick | down in water |
| `SWAN_BOB_AMP` / `SWAN_BOB_PERIOD` | 1 / 48 | px / ticks | cosmetic |
| `SWAN_PLUNGE_PER_VY` / `SWAN_PLUNGE_MAX` / `SWAN_PLUNGE_TICKS` | 2 / 10 / 16 | px / px / ticks | cosmetic dip on landing in water |
| **Aim** | | | |
| `SWAN_NECK_MIN` | +45° (π/4) | rad | forward-down, air only |
| `SWAN_NECK_MAX` | −135° (−3π/4) | rad | back-up |
| `SWAN_NECK_STEP` / `SWAN_NECK_STEP_TICKS` | 22.5° (π/8) / 2 | rad / ticks | 0° → −90° in 8 ticks |
| `SWAN_NECK_RELAX_TICKS` | 40 | ticks | idle time before the cosmetic S-neck |
| **BEAK GUN** | | | |
| `SWAN_GUN_DAMAGE` / `SWAN_GUN_SPEED` | 10 / 8 | damage / px/tick | |
| `SWAN_GUN_COOLDOWN` / `SWAN_GUN_BURST` | 4 / 5 | ticks / rounds | |
| `SWAN_GUN_JITTER` / `SWAN_GUN_MAX` / `SWAN_GUN_LIFE` | 1 / 24 / 60 | px / rounds / ticks | |
| **BEAK SHELL** | | | |
| `SWAN_SHELL_SPEED` / `SWAN_SHELL_GRAVITY` | 4.0 / 0.06 | px/tick / px/tick² | |
| `SWAN_SHELL_DIRECT` / `SWAN_SHELL_SPLASH` / `SWAN_SHELL_RADIUS` | 200 / 100 / 24 | damage / damage / px | |
| `SWAN_SHELL_COOLDOWN` / `SWAN_SHELLS` | 30 / 10 | ticks / shells | |
| `SWAN_SHELL_INHERIT_VX` | 1 | × | new: adds her vx |
| **HONK** | | | |
| `SWAN_HONK_WINDUP` | 10 | ticks | holds vy at 0 in the air |
| `SWAN_HONK_RADIUS` / `SWAN_HONK_GROW_TICKS` | 128 / 16 | px / ticks | 8 px/tick |
| `SWAN_HONK_DAMAGE` / `SWAN_HONK_STUN_TICKS` | 80 / 60 | damage / ticks | |
| `SWAN_HONK_COST` / `SWAN_HONK_COOLDOWN` | 3 / 240 | shells / ticks | |
| **Armour** | | | |
| `SWAN_CELLS` | 3 | cells | |
| **SWAN DIVE** | | | |
| `SWAN_DIVE_HISS_TICKS` | 6 | ticks | |
| `SWAN_DIVE_SPEED` / `SWAN_DIVE_ACCEL` / `SWAN_DIVE_DISTANCE` | 3.4 / 0.25 / 192 | px/tick / px/tick² / px | 63 ticks of charge |
| `SWAN_DIVE_DAMAGE` / `SWAN_DIVE_RADIUS` / `SWAN_DIVE_TRAMPLE` | 400 / 40 / 100 | damage / px / damage | |
| `SWAN_DIVE_CELL_COST` | 1 | cells | survives at ≥ 2 cells; migrates at 1 |
| `SWAN_DIVE_BOUNCE_VX` / `SWAN_DIVE_BOUNCE_VY` | −1.5 / −3.0 | px/tick | vx × facing |
| `SWAN_DAZED_TICKS` / `SWAN_RIGHTING_TICKS` | 180 / 12 | ticks | |
| `SWAN_MIGRATE_VX` / `SWAN_MIGRATE_VY` | 1.0 / −1.5 | px/tick | no gravity |
| **Co-op** | | | |
| `SWAN_PERCH` | (−26, hull top, 14, 4) | px | one-way; off from the squat to the landing of a jump over land, on through a jump over water (10) |
| **Camera while ridden** | | | |
| `SWAN_CAMERA_LEAD` | 64 | px | default 38 |
| `SWAN_CAMERA_MAX_SPEED` | 4 | px/tick | default 3 |

```ts
  /** Ridden SWAN-3 (docs/design/swan-mount/feel.md), kept in the swan module. Apex = 5.9² / 0.36 ≈ 97 px. */
  const SWAN = {
    // ground
    runMax: 2.6, trotSpeed: 1.5, accel: 0.25, accelHigh: 0.06, brake: 0.2,
    skidMin: 1.6, skidDecel: 0.3, skidEnd: 0.5, backpedalMax: 1.2, crouchSpeed: 0.8, iceDecel: 0.05,
    stepUp: 12, snapDown: 8, bodyW: 28, bodyH: 48, crouchBodyH: 20,
    // jump
    gravity: 0.18, maxFall: 5.0, jumpVelocity: -5.9, squatTicks: 4, waterSquatTicks: 8,
    airAccel: 0.1, airCapMin: 1.5, coyoteTicks: 4, jumpBufferTicks: 6, landShakeFall: 60,
    // stomp
    stompMinVy: 1.5, stompBox: [-14, -6, 28, 10] as const, stompTopBand: 12, stompDamage: 100,
    stompBounceVy: -3.4,
    // glide
    glideFlapVy: -0.4, glideGravity: 0.06, glideMaxFall: 1.0, glideSpeed: 2.2, glideDrag: 0.05,
    glideTicks: 60, glideTireTicks: 12, glideBufferMin: 16, glideBufferTicks: 6,
    // water
    swimDepth: 16, swimMax: 2.0, swimAccel: 0.08, swimDrag: 0.08, swimReverse: 0.15, swimBackMax: 1.0,
    duckSink: 8, duckSpeed: 1.0, bobAmp: 1, bobPeriod: 48, plungePerVy: 2, plungeMax: 10, plungeTicks: 16,
    // aim (radians; 0 = facing, negative = up)
    neckMin: Math.PI / 4, neckMax: (-3 * Math.PI) / 4, neckStep: Math.PI / 8, neckStepTicks: 2,
    neckRelaxTicks: 40,
    // weapons
    gun: { damage: 10, speed: 8, cooldown: 4, burst: 5, jitter: 1, maxOnScreen: 24, life: 60 },
    shell: { speed: 4.0, gravity: 0.06, direct: 200, splash: 100, radius: 24, cooldown: 30, inheritVx: 1 },
    shells: 10,
    honk: { windup: 10, radius: 128, growTicks: 16, damage: 80, stunTicks: 60, cost: 3, cooldown: 240 },
    // armour
    cells: 3,
    // SWAN DIVE
    dive: {
      hissTicks: 6, speed: 3.4, accel: 0.25, distance: 192, damage: 400, radius: 40, trample: 100,
      cellCost: 1, bounceVx: -1.5, bounceVy: -3.0, dazedTicks: 180, rightingTicks: 12,
      migrateVx: 1.0, migrateVy: -1.5,
    },
    // co-op perch: x, width, height (its top follows the hull top: -48 / -20 / -30)
    perch: [-26, 14, 4] as const,
    // camera while any followed player rides a swan
    cameraLead: 64, cameraMaxSpeed: 4,
  };
```
