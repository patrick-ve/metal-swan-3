# Mission ring — level 2, the A10 ring road (spec, 2026-10-20)

The user (2026-10-20): a new level 2. It picks up from the end of level 1 (`ams`). The players
leave the city centre and drive the A10 ring road ("de Ring") in a 1990s station wagon (a likeness
of the Volvo 850 estate) that another squad hero drives. The player hangs out of the window, moves
the car across the width of the ring and shoots. The ring is generated procedurally and holds
mobile enemies. With 2 players, each player gets their own wagon. The story and the bosses come
later; this wave builds the **mechanism**. The first-person run becomes level 3.

**Revision R (2026-10-22, §R): a short drive, the ZWAAN truck (a sequential boss), a traffic jam and
the rest on foot (the jam, the EXHAUSTING REBELLION blockade, the pink boat). §R wins over every
older section.**

This file is THE SPEC for the ring waves. Detail values (speeds, HP, sizes, timings) may be tuned
by the builders when play shows a better value; the report says what changed and why.

Originality: `docs/ORIGINALITY.md` and `docs/research/mechanics.md` §23 apply in full. Never name
any reference game in code, ids, comments or docs. No laughing or pointing at a player's death.
Real Amsterdam names are allowed in `ring` (the `ams` exception is extended, §12).

## 0. Decisions

| # | Item | Decided by |
|---|---|---|
| 1 | New mission `ring` = level 2; order ams → ring → glitch bridge → first-person floors → ending | user |
| 2 | **Side view, 4 lanes as depth bands**; up/down changes lanes, left/right moves the car on screen | user |
| 3 | Opening: an in-engine **boarding scene** at the on-ramp; no on-foot part yet **(replaced by revision R)** | user |
| 4 | **Seeded chunks + fixed landmarks**; same seed = same ring | user |
| 5 | **Car armour** (the vehicle rule): hits cost armour; at 0 the wagon wrecks and a life is lost | user |
| 6 | Ground enemies: **scooter gang, parcel vans, enforcement convoy, caravan car** | user |
| 7 | Other enemies: **lorry + container, road-works crew** | user |
| 8 | Hazards: **matrix signs (red X), traffic jam, tunnels, speed cameras** | user |
| 9 | Driver: a **random squad hero who does not play**; 2P → two different drivers | user |
| 10 | Controls: **steer lock on FIRE** (hold FIRE: the D-pad aims 8 ways), JUMP = swerve, BOMB = lob | user |
| 11 | Civilian traffic: **obstacles + cover**; never destroyed, no penalty | user |
| 12 | Route: the **full loop, compressed** (about 8–10 min), clockwise from A10 Oost **(replaced by revision R)** | user |
| 13 | The wagon: **likeness, no badge**; code ids say `wagon`; lines may say "de Volvo" | user |
| 13a | The two wagons are the squad's real rally estates: **GREEN safari** (`ARTISANAL GRAPE` / `MAJOR COCKTAILS`, roof lamps, spare tyre) and **WHITE rozzers** (jam-sandwich band, `ROZZERS`, `619`, push bar with lamps); no rally plaque, no real plates; 1P and P1 = white, P2 = green (§3) | user |
| 14 | Boss slots: the **lorry as a temporary test mid-boss**; the level ends at an exit **(replaced by revision R)** | user |
| 15 | The hero **never leaves** the wagon **(replaced by revision R)** | user |
| 16 | Pickups: **hostages in vans and caravans + crates** you drive over | user |
| 17 | Plan first, then a workflow build after the user's OK | user |
| 18 | All new art at 1×, 2× and 4× (one density-generic drawer) inside the tier-4 budget | standing rule |
| 19 | Architecture: a `RingRunner` + `RingScene` on the **unchanged** engine World (§13) | lead (architect) |
| 20 | ams now ends with its normal MISSION COMPLETE tally page, then the ring | lead default |
| 21 | The ring is `MISSION 2` / high-score `M2`; the URL-only m1 card keeps its old label (passive) | lead default |
| 22 | The test lorry sits in the **middle** slot (`westpoort`); the end slot is a marker **(replaced by revision R)** | lead default |
| 23 | One driver per player for the whole level (a new wagon keeps the driver) | lead default |
| 24 | New `torso-pistol-diag-down` strips for every squad hero (the near-lane aim with the default gun) | lead default |
| 25 | Build in **two workflow waves** with a stop to play-test between them (§14) | lead proposal |

Scope: the new mission `ring` and the flow changes it needs. `ams` keeps its content and its sims
byte-identical; m0–m5 keep working passively (their sims stay byte-identical).

## R. Revision R: the short drive, the ZWAAN truck and the blockade (2026-10-22)

The user (2026-10-22): the ring "is too long and takes away the momentum". The new level: a short
drive, a sequential truck boss, a traffic jam, and the rest **on foot**: a fight through the jam,
then a blockade of climate activists with a parody banner and a mini-boss. Four AskUserQuestion
rounds settled it (R.0). **Where this section and an older section disagree, this section wins.**
Older rows it replaces are marked in §0.

### R.0 Decisions (revision R)

| # | Item | Decided by |
|---|---|---|
| R-1 | The drive is **about 2 min**: the boarding at S113, then `oost` → `amstel` → `zuid`. The truck appears at the Zuidas | user |
| R-2 | **The ZWAAN truck** = a **sequential boss**: a road train of **4 trailers + the cab**, fought from the rear trailer forward. Each part is a mini-boss; the next part becomes available only after the previous one is beaten | user |
| R-3 | The trailers: **container** (today's lorry container), **car transporter**, **tanker**, **livestock trailer**; **all four** in every play (5 fights) | user |
| R-4 | The cab (`ZWARE JONGEN`): **ram, block lanes, brake checks, a gunner** in the sleeper cab | user |
| R-5 | After the truck: a **traffic jam**; the heroes get out; the **drivers stay in the cars** (silent, as today) | user |
| R-6 | **On foot like `ams`**: the normal side view, run, jump, shoot; the stopped cars are cover and platforms | user |
| R-7 | On foot, part 1: a **short fight through the jam** (about 1 min, the ring gangs on foot) | user |
| R-8 | On foot, part 2: the **blockade**: climate activists chained / glued to the road; **slapstick, bloodless** (a beaten one snaps free and runs off, or the police carry them away) | user |
| R-9 | The protest group is **`EXHAUSTING REBELLION`** (a parody name; our own mark, never the real logo) | user |
| R-10 | The blockade's mini-boss: **a pink protest boat** on the A10 with a leader with a megaphone who calls waves; break the boat → the exit → MISSION COMPLETE | user |
| R-11 | Length: **about 9 min** in total is fine | user |
| R-12 | Language: **all new bubbles, signs and voices in Dutch** (the spandoek title `EXHAUSTING REBELLION` stays) | user |
| R-13 | Audio: **ElevenLabs generation inside the build** (voices, sfx, songs); the report says the credits used | user |
| R-14 | The rest of the ring (`west`, `westpoort`, `coentunnel`, `noord`, `zeeburg`, `exit`) **stays in the code, unused** by the level (a `full` route for tests) | user |
| R-15 | Spec first; the build starts **after the user's OK** | user |
| R-16 | The trailer order (rear → front): **container, car transporter, tanker, livestock trailer**, then the cab (fixed) | lead default |
| R-17 | The on-foot part is an **unregistered `MissionDef` with the id `ring`** (sections `rf-a`, `rf-b`), run by `MissionRunner` in a `GameplayScene`; the drive hands over to it **without a tally page**; **one** MISSION COMPLETE tally at the end | lead (architecture map) |
| R-18 | The truck = an invisible controller `ring-zwaan` + **one `Boss` subclass per part** | lead (architecture map) |
| R-19 | Two workflow waves with a play-test stop between them; every agent at **effort high** | lead proposal (standing rule: effort high) |

### R.1 Flow and timing

Title → select → `ams` → tally → the `MISSION 2` card (`DE RING`) → **the drive** (RingScene, the
short route) → the ZWAAN truck → the final jam and the alight scene → *(hand-over, a 40-tick fade,
no tally)* → **`rf-a` DE FILE** (on foot) → **`rf-b` DE BLOKKADE** with the pink boat → MISSION
COMPLETE (one tally for the whole level) → the glitch bridge → the first-person floors. `M2`, the
high-score column, `FPS_ROUTE`, the golden record and `recordMissionClear` keep the id `ring`.

| Part | Target | Ticks (60 Hz) |
|---|---|---:|
| Boarding + the drive `oost` → `amstel` → `zuid` | 2:00 | 7,200 |
| The ZWAAN truck: 5 parts × 30–40 s + 4 catch-ups of 2–3 s | 3:00 | 10,800 |
| The final jam + the alight scene | 0:12 | 720 |
| `rf-a` DE FILE | 1:15 | 4,500 |
| `rf-b` DE BLOKKADE + the boat | 2:30 | 9,000 |
| **Total** (the bot's pace) | **≈ 9:00** | **≈ 32,400** |

**URLs.** `?mission=ring` = the whole level. `?mission=ring&section=amstel|zuid` = the drive from
that landmark. `section=zwaan` (or `?boss=1`) = straight to the truck (a short run-in). `section=rf-a`
/ `rf-b` = on foot; `section=rf-b&boss=1` = the boat. `&route=full` = the old full loop (tests and
sims only; its `westpoort` slot spawns the ZWAAN truck too, the `ring-lorry` id retires). An unused
landmark in `section=` implies `route=full`.

**The card.** The ring card's A10 map polyline shows the short route (S113 → Zuidas) and a
blockade mark; the card text stays English (as the other cards; the user may still ask for Dutch).

### R.2 The drive (short route)

- `planRing(seed, difficulty, { route: 'short' | 'full' })`; default `short`. `RingPlan.route`
  records it. The director reads the route's landmark list; `checkPlan` is route-aware.
- Short route: `oost` (the boarding, S113, S112, S111, the Rembrandt tower), `amstel` (knooppunt
  Amstel, the Rozenoordbrug), `zuid` (S109 RAI, the Zuidas towers; set piece: `rai`, `zuidas`, then
  the boss chunk `ring-zwaan`, then the `final-jam` scene chunk). The plan's road part is 7,200
  ticks ± 5 %.
- **No mid-drive jam** (the final jam is the only one). Keep a few hazards for variety (one
  matrix gantry with a closure, one speed camera); the threat budget rises over the 2 min.
- Guarantees per seed: the golden record in `amstel` or `zuid`; ≥ 1 hostage per stretch; a repair
  chance every ~60 s; the 4-second rule; the boss slot in `zuid`.

### R.3 The ZWAAN truck (the sequential boss)

**The road train.** One made-up hauler, ZWAAN (our own livery: white cab with an orange band;
the rust-red `ZWAAN` colour and the swan mark run along every trailer; made-up plates and box
codes; no badge). Lanes 1–2 only (`ring-block`). Only the active part and the front of the next fit
on screen: the controller keeps the active part's rear near screen x 150.

**The controller `ring-zwaan`** (invisible, no `boss` tag): holds the plan lock for the whole
train; spawns the parts in order; when a part is beaten it **uncouples** (a clank, coupling sparks),
brakes, swerves onto the hard shoulder, tips and drops back as a wreck, and the train pulls ahead
and eases back about 190 px over 130–180 ticks (**the catch-up**); during a catch-up it sends a
small gang (2 / 2 / 3 scooters by difficulty) so the 4-second rule holds, and the wreck drops a
repair or a weapon. It draws the parts in front of the active one (decor only, not hittable).

**The boss bar.** One bar per part with the part's name; under it a strip of **5 pips** shows the
parts left. The boss song plays from the first part to the cab's death (no stage song between
parts). Only the cab's death sets the ring's boss end (`bossEndTick`), switches the music back and
counts for `bossSpeedBonus` (a ring limit like m5's 240 s).

**Every part:** parts with own HP (weak points), stagger and `cutAttack` as in the `Boss` base;
every attack has a tell of ≥ 18 ticks; a damage-rate bucket like today's lorry (each part 30–40 s
with the machine gun, ≥ 25 s with the best gun; × difficulty × co-op); 2,000 points per trailer,
10,000 for the cab.

| # | Part (bar name) | Attacks | Weak points | Beaten |
|---|---|---|---|---|
| 1 | Container trailer `ZWAAN CONTAINER` | today's lorry without the cab: CARGO DUMP (drums and crates roll back along the lanes, one lane always free), then the side panel drops and the **forklift** charges along a lane | the rear doors, the bogie | uncouples, the container slides onto the hard shoulder |
| 2 | Car transporter `ZWAAN AUTOTRANSPORT` | the rear ramp lowers (hydraulic hiss) and a lower-deck car **rolls off backwards** into a lane; the upper deck tilts and a car **slides down** onto the road and bounces once; the dropped cars are obstacles that drift back (civilian-style cars, no badges, no plates) | the hydraulic rams (2), the deck | the decks fold, the cars spill onto the shoulder |
| 3 | Tanker `ZWAAN TANKWAGEN` (`FRITUURVET` on the tank) | leaks frying-fat **slicks** into a lane (a wagon in a slick slides: the steering lags for ~40 ticks); a hit valve hisses, sparks, then a **flame trail** runs along a lane | 3 valves, the tank | a big bloodless fireball, the tank rolls onto the shoulder |
| 4 | Livestock trailer `ZWAAN VEETRANSPORT` | the rear gate drops: **cows and pigs** trot back across the lanes (moving obstacles: they block shots like civilian cars and cost a cell on a bump; **never hurt**: they trot to the hard shoulder and graze there); a **farmhand** on the roof throws hay bales and milk churns (lobs) | the gate, the farmhand's hatch | the trailer stops on the shoulder, the animals wander off unhurt |
| 5 | The cab `ZWARE JONGEN` | **weave** (indicator tell) to block lanes; **brake check** (brake lights ~24 ticks); the **gunner** in the sleeper-cab window fires along a lane; the air horn on every lane change | the cab (× 1.5), the sleeper window (the gunner) | the jackknife: the cab spins onto the shoulder; the driver climbs out dazed (bloodless) |

### R.4 The final jam and the alight scene

After the cab: a matrix gantry shows a red X on every lane and `FILE` / `BLOKKADE` (our own
lettering). The road slows into a standing queue (the `final-jam` chunk: a `ring-jam` with
`final: true` that never clears and has no waves). The wagons crawl into the queue and stop in
their lanes; each hero climbs out of the window and jumps down onto the road (the boarding jump
run backwards); the drivers stay at the wheel (silent). Then `handOver()` and a 40-tick fade to
`rf-a`, whose first screen shows the parked wagons with their drivers.

### R.5 `rf-a` DE FILE (on foot, ~1:15)

- The A10 at the Zuidas, in the normal 2D side view: the near lane and the hard shoulder are the
  ground; **stopped cars** (the ring's civilian car looks as solid decor) are cover and platforms
  (jump on the roofs); a stopped lorry and a bus are higher platforms; the crash barrier; the far
  lanes with standing cars and the Zuidas towers in the background (reuse the ring skyline layers).
- Enemies: **the ring gangs on foot**: scooter riders (pistol, bottle lobs), parcel couriers
  (parcel lobs, the `NIET THUIS` gag), the van crew. New `Enemy` subclasses with the gangs' looks
  (all strips at 1×/2×/4×); their scooters stand in the jam as decor.
- A tied hostage in an open parcel van; weapon crates; a checkpoint at least every 1,400 px.
- The end: the police line → `rf-b`.

### R.6 `rf-b` DE BLOKKADE (on foot, ~1:30 + the boat)

**The scene.** Police tape and a police van; then the blockade across the whole road: activists
glued and chained to the asphalt; the big **spandoek** across the road, then the boat.

**The spandoek.** Title `EXHAUSTING REBELLION` (the user's name; a pun: exhausting = tiring and
exhaust fumes). Our own mark: a round-bellied hourglass with a smoke puff rising from its top,
**not** in a circle (never the real circled hourglass). The line under it in Dutch, e.g. `WIJ ZIJN
MOE. NU JULLIE OOK.` Smaller banners and signs in Dutch, our own puns, e.g. `STOP UITLAATGAS`,
`LIJM IS GEEN MISDAAD`, `TOETER NIET, DOE MEE`, `KLIMAATNOOD!`. Never a real slogan word for word.

**The activists** (fictional, comic; no likeness; bloodless; small HP, 1–3 hits):

| Kind | How it fights | Beaten |
|---|---|---|
| `lijmer` (glued sitter) | a fixed turret: lobs **paint balloons**; a **glue pot** leaves a puddle that sticks a hero ~40 ticks (no move, no jump; the hero can still shoot) | the glue lets go with a rip (`LOS!`), they run off in a huff |
| `ketting` (chained to a barrel or a partner) | throws **soup cans** (orange tomato soup; the can is the hit, the puddle is orange, never red) | the chain snaps; two police officers carry them away stiff as a plank |
| `megafoon` (on a crate) | a **shout**: sound rings along the ground that push a hero back (no damage); a feedback squeal stuns ~20 ticks | the megaphone squeals, they run off |
| `loper` (walk-in) | runs in with a small banner, **sits down and glues** (the tell: ~40 ticks) → a `lijmer` | hit before the glue: drops the banner, runs off |

Thrown things hurt like enemy shots (the normal hit rule). In the in-world continue they do not
point or laugh: they sit and hum, hold up `WIJ HADDEN HET GEZEGD`, or share a sandwich; the cower:
hands over their heads.

**The police** (`ring-agent`, NPCs): never targeted, never hurt; they come in pairs and carry the
beaten `ketting` activists (and at the end the leader) off screen.

### R.7 The mini-boss: the pink boat `DE LAATSTE DRUPPEL`

A big pink sailing boat on a wheeled trailer in the middle of the A10 (our own design and name;
never the real protest boat's look or name). Mast with `EXHAUSTING REBELLION` pennants; on deck the
leader with a megaphone, a drum band of two drummers, two loudspeakers. The arena locks; `bossIntro`
(`DE LAATSTE DRUPPEL`, `MINI-BOSS`); `autoStart = false`, the section script starts it.

- Phase 1: the leader's megaphone rings; the leader **calls waves** of `loper` activists (2 / 3 / 4 by
  difficulty); paint balloons from the deck.
- Phase 2 (HP ≤ 50 % or both speakers broken): the **drum band**: each drum beat (sticks raised:
  the tell) sends a ground shock along the road (jump over it); the boom swings low across the deck
  as a hazard.
- Parts: the 2 speakers, the hull; the leader ducks behind the rail (not a target).
- The end: the hull cracks, the mast falls, the boat settles; the leader slides down and the police
  carry the leader off (`WIJ KOMEN TERUG... NA DE LUNCH!`); a weapon drop; the exit → MISSION COMPLETE.

### R.8 Text and sound

- All new bubbles in Dutch, ≤ 24 characters per line, 2 lines. Examples: the activists
  `KLIMAATNOOD!`, `WIJ ZITTEN HIER GOED!`, `LIJM IS GEEN MISDAAD!`; the leader `MEDE-REBELLEN...
  ZITTEN!`, `DIT IS EEN VREEDZAAM PROTEST!`; the cab `UIT MIJN SPIEGEL!`, `MIJN VRACHT...!`. The
  wagon drivers stay silent (`Wagon.talk = false`). HUD words stay English (as in `oldenzaal`).
- **ElevenLabs (the user's OK, 2026-10-22):** designed Dutch voices (never a clone) for the
  leader, two activists and ZWARE JONGEN; sfx (cows, pigs, the ramp hydraulics, the fat hiss and
  flare, the uncoupling clank, the glue rip, the chain snap, the megaphone squeal, the police
  whistle, the drum band, the police van); two new songs: `ring-foot` (the jam and the blockade)
  and `ring-boot` (the boat). The ring stage theme and `ring-boss` stay synth. A synth fallback for
  every id. The group `mission:ring` joins `SAMPLE_GROUPS`, `GROUP_DIRS` and `LAZY_GROUPS`;
  ring-route merges the ams entries with `SAMPLE_MANIFEST['mission:ring']`. Every voiced line has a
  shipped take, and every beat fits its take (a voice-fit test as in `oldenzaal`). Prompts never
  name games, songs or artists; never generate takes for the user's own four music ids. The report
  states the credits used.

### R.9 Originality (a dated paragraph in `docs/ORIGINALITY.md`)

`EXHAUSTING REBELLION` is a parody name of a real activist movement (the user's choice,
2026-10-22). Never the real name, its logo (the circled hourglass), its fonts or its slogans word
for word; no real activist, leader, event or boat. The activists, the leader and the police are
fictional comic characters; nothing hurts them (they run off or are carried away). ZWAAN is a
made-up hauler with our own livery; no real hauler's colours or names. The animals are never hurt.

### R.10 Architecture (from the code map, 2026-10-22)

- **Hand-over.** `RingRunner.handOver()` (no victory banner, no `completed.push`) and a
  `'handover'` event; `ring-route.ringHandover()` replaces the scene with
  `new GameplayScene(app, { mission: RING_ID, handover })`. `GameplayOpts.handover = { def, artDef,
  onComplete }` is optional: absent, nothing changes. The drive's stats stay: either an additive
  `RunnerOptions.continueMission` (skips `startMission`, the banner, the announcer and the intro
  drop) or save and restore `slot.mission` / `rescued` around `runner.start()`. `onComplete` opens
  `MissionCompleteScene(ringFinalTally(...))` (hostages of both parts, FINES, the seed), whose
  `afterTally` opens the glitch bridge.
- **The foot def** (`src/game/content/ring/foot/`): `{ id: 'ring', sections: { 'rf-a', 'rf-b' },
  bossSections: ['zuid'], footsteps: true, audioGroup: 'mission:ring', hostages: drive + foot }`.
  **Never `defineMission`** (the sorted id list would make it some mission's default next one).
- **One tier-4 run.** `ringArtDef(plan)` appends the foot sections (same id `ring`); the hand-over
  skips `stopDense`; the foot part gets its own `denseReserve` and budget test. The train's art goes
  per part (pseudo-sections per part, death strips deferred) so `zuid` stays inside 256 MB.
  New art prefixes only: `boss/ring-zwaan/<part>/`, `ring/foot/`, `npc/ring/`, `fx/ring/`, never
  under the prefixes `ams` preloads (`item/pickup-`, `weapon/`, `ui/icon-`, `fx/hit…`,
  `fx/dust…`, `npc/ams/`).
- **The train.** `ring-zwaan` (controller) + `Boss` subclasses `ring-zwaan-container`,
  `-autos`, `-tank`, `-vee`, `-cab`; the order from `params.order` (fixed, R-16). The old lorry
  splits into the container trailer and the cab. Fix `bossEndTick` (runner.ts), the music cue
  (cues.ts) and `bossSpeedBonus` for a multi-part boss. While the plan is locked the controller
  brings its own adds and traffic.
- **The alight scene** = the boarding scene run backwards (`boarding.ts` is the model); a
  `final-jam` chunk; `RING_HOOKS.planEnd` → the alight director on the short route.
- **Sims.** `headless-ring` follows the `GameplayScene` after the hand-over; both bots registered
  (each idles while its runner is null); one merged report; the ring bot learns the parts; 2D bot
  changes keyed to the new entity types only. `npm run sim -- --mission ring --god
  --expect-complete [--seed n] [--players 2] [--section zwaan|rf-a|rf-b] [--route full]`.
- **Byte identity:** additive options only in `MissionRunner`, `GameplayScene` and the tally; no
  change to the defaults of `TUNING`, `Player`, `Enemy`, `Boss`; new randomness only through new
  rng forks.

### R.11 Build: two workflow waves (every agent at effort high)

Each wave: a snapshot → the workflow → my own gates and a look at frames → a local commit → the
user plays. No push without the user's word.

**Wave A — the road, the truck and the jam (7 agents).**

| Stage | Builder | Owns |
|---|---|---|
| core | CORE | the route option (plan, director, `checkPlan`, URLs), the `zuid` set piece with the boss and `final-jam` chunks, the hand-over chain (runner, ring-route, `GameplayOpts.handover`, the single tally with the drive's stats), the foot def skeleton (flat `rf-a` / `rf-b` placeholders), one tier-4 run across the hand-over, the sim harness (merged report, both bots), stubs. Exit: `?mission=ring` runs drive → placeholder truck → alight → `rf-a` → `rf-b` → tally. Interfaces frozen. |
| build | TRAIN-1 | the controller (lock, order, catch-up, adds, drops, pips, music), the container trailer and the cab (from today's lorry), the boss-end, cue and speed-bonus fixes, synth sfx |
| build | TRAIN-2 | the car transporter, the tanker (slicks, flame trail), the livestock trailer (cows, pigs, the farmhand); art 1×/2×/4×, AI, synth sfx |
| build | JAM + FOOT | the final jam and the alight scene; `rf-a` DE FILE (terrain, background, stopped cars, the parked wagons), the ring gangs on foot, hostage, crates, checkpoints |
| finish | INTEGRATOR | merge, the bots, sims, budget tests, docs (this spec's status, `docs/api/ring.md`, GDD, ARCHITECTURE) |
| finish | REVIEW | spec, standards, determinism, byte identity, budget, momentum (part lengths, catch-ups) |
| finish | FIXER | the review's findings, the final gates, `tmp/ring-r-a-report.md` |

**Wave B — the blockade, the boat and the sound (6 agents).**

| Builder | Owns |
|---|---|
| ACTIVISTS | `lijmer`, `ketting`, `megafoon`, `loper`; the police pair and the carry-off; the glue status; gloat and cower; all strips 1×/2×/4× |
| BLOCKADE + BOAT | `rf-b` DE BLOKKADE (the police line, the spandoek and banners, the layout, the waves); the pink boat (2 phases, parts, the drum band, the end with the leader's carry-off); the exit and the tally |
| AUDIO + TEXT | the Dutch lines; ElevenLabs voices, sfx and the two songs (plan → generate → pick by measurement → ship; Scribe check of every Dutch line), the voice-fit test, the `mission:ring` group; the credits used |
| INTEGRATOR, REVIEW, FIXER | as wave A; `tmp/ring-r-b-report.md`; `docs/ORIGINALITY.md` paragraph (R.9) |

Estimates (from the earlier ring and oldenzaal waves): wave A about 5–6 M tokens and 5 h; wave B
about 4–5 M tokens and 4 h; ElevenLabs about 20,000–30,000 credits (about 1.0 M left).

### R.12 Gates (the lead, after each wave)

- `npm run typecheck`; the full vitest suite; `npx vite build`; `npm run smoke` (title,
  `?mission=ring`, `?mission=ring&section=rf-b`); a 4K browser run of `?mission=ring&art=4`.
- Ring sims: god seeds 1–5 and 2P seed 1 complete the whole level, about 32,400 ticks (fail
  outside 28,800–36,000); every section (`zwaan`, `rf-a`, `rf-b`) 1P and 2P; `--route full`
  still completes. New ring baselines after wave A.
- Byte identity (`jq 'del(.timing)'` against `tmp/oz-baseline/`): ams lower 21,443 and upper
  23,088, m0 5,679, m2 31,036, fps-1 4,026, fps-2 2,533 — identical; oldenzaal full and every
  section 1P/2P — identical.
- Budget tests: `zuid` with the train, `rf-a`, `rf-b`, 1P every hero and 2P pairs ≤ 256 MB.
- Tests to update: `tests/game/ring/{plan,runner,determinism,scenery-job,flow}.test.ts`,
  `ring-helpers.ts`, `tests/game/fps/flow.test.ts`, `tests/content/ring-{boss,dense-budget,
  scenery,sound}.test.ts`. New: the train order and the catch-up, the hand-over keeps lives /
  score / weapon / hostages, the activists never die bloody (exit animations), the boat, the
  voice fit.
- Look at frames: every train part at 1×/4×, the alight, `rf-a`, the spandoek (the mark is not a
  circled hourglass), the boat.

### R.13 Risks

- **Momentum** (the user's reason for this revision): each part ≤ 40 s with the machine gun, each
  catch-up ≤ 3 s, no empty road (the controller's adds). The review measures it with the bot.
- **Memory:** the whole train sits in `zuid`'s working set; `ams` has almost no room (251.6 of
  256 MB): no new art under its preloaded prefixes.
- **The hand-over:** a 4× rebuild spike if `stopDense` runs; a 2P slot that is out at the
  hand-over (the foot runner spawns only active slots): it gets a fresh `CONTINUE?` in `rf-a`.
- **Tone:** a comic parody, bloodless; nobody is hurt; no real people, logos or slogans (R.9).

### R.14 Status (wave A, the integrator, 2026-10-22)

**Wave A is integrated** (reports `tmp/ring-r-a-{core,train1,train2,foot,integrate}-report.md`): the
whole level plays end to end in 1P and 2P — the boarding, the short drive `oost` → `amstel` → `zuid`,
the five-part ZWAAN train (container, car transporter, tanker, livestock trailer, ZWARE JONGEN; real
parts, art at 1× / 2× / 4×), the final jam with the `FILE` / `BLOKKADE` gantry, the alight, the
hand-over, `rf-a` DE FILE with the ring gangs on foot, `rf-b` (still the wave-A placeholder), ONE
MISSION COMPLETE tally, the glitch bridge. One tier-4 run covers the level. The decisions above are
unchanged; the table below lists only tuned values.

| Value | Spec | Now | Why |
|---|---|---|---|
| A part's fight with the machine gun (the bot, ammo kept full) | 30–40 s | 1P means 31.1–33.1 s (max 37.1); 2P 30.3–31.0 s (max 32.7) | every part's rate = (HP − 150) / 1,800 ticks (`zwaanRate`, fixer) |
| A part's fight with the best gun | ≥ 25 s | ≥ 30 s for every gun (the laser 30.0–30.4 s) | the fixer's floor: 30 s; the flat rate 1.1 gave 22–23 s on the tanker, livestock trailer and cab |
| A part's fight with the pistol (the bot) | — | 1P means 35.7–40.1 s (max 46.1); 2P 30.7–38.9 s (max 50.2) | the bot's aim, not the cap |
| Container HP | — | 1,845 (0.9 × 2,050; was 2,050) | the pistol took 37–49 s |
| Car transporter HP | — | 1,640 (0.8 × 2,050; was 1,804) | the pistol 39 s → 36 s |
| Cab HP (`ZWAAN_PACE.cabHp`) | — | 1,650 (was 2,200) | 47 s → 36 s |
| Tanker / livestock HP | — | 1,300 / 1,360 (was 1,702 / 1,804) | 44–50 s → 30–40 s |
| A catch-up | 2–3 s | 131–169 ticks (2.2–2.8 s) | — |
| The drive before the truck | 7,200 ticks | ≈ 7,420–7,650 (the boarding and the truck's arrival included) | — |
| The final jam + the alight | 720 | ≈ 500 | — |
| `rf-a` | 4,500 | 3,780–4,570 (1P), 3,340–3,530 (2P); normal 0–4 deaths (seeds 1–5) | the fixer: the crew at the camper (camera 1,300) only on hard |
| The longest stretch without an enemy | 4 s rule | the drive 164–218 ticks (god seeds 1–10, 2P 1–3), `rf-a` 150 | the short route's forced-wave mark 130 → 80 ticks (fixer; 243–266 before) |
| The whole level (the bot, god) | ≈ 32,400 | 1P 24,080–26,288 with the rf-b placeholder (850) → projected 32,230–34,438 with wave B's 9,000; 2P 23,287 → 31,431 | the watch test checks the projection |
| 2P, the car transporter (two pistols) | 30–40 s | mean 34.1 s, max 39 s (was 67 s, max 99 s) | the ring bot's player 2 keeps out of player 1's lane on a train part |

**Open for wave B / the play-test:** `rf-b` and the boat (the wave-A placeholder now has a trickle of
the ring gangs on foot); the card's briefing still says "ONE LAP, CLOCKWISE" (voiced; wave B
re-words and re-voices it); on normal the bot still dies 0–4 times in `rf-a` (the lock at the van,
x ≈ 1,420–1,660, and the last lock); on hard the flame trail and the animals cost the bot the most
cells (a play-test question: a softer animal bump?).

### R.14 Status (wave B, the integrator, 2026-10-22)

**Wave B is integrated** (reports `tmp/ring-r-b-{prep,activists,boat,audio1,audio2,integrate}-report.md`):
`rf-b` DE BLOKKADE (the police line, the activists `lijmer` / `ketting` / `megafoon` / `loper`, the
police pair, three locks, the spandoek `EXHAUSTING REBELLION` with our own mark) and the pink boat
`DE LAATSTE DRUPPEL` play to the one tally in 1P and 2P; the Dutch lines are voiced (5 designed
voices, 19 lines), `ring-foot` and `ring-boot` play on foot and at the boat, 61 ring sfx have
ElevenLabs takes (synth fallbacks for all). The decisions above are unchanged; the rows below are
measured and tuned values (the bots, seeds 1–5; normal unless "god").

| Value | Spec | Now | Why |
|---|---|---|---|
| `rf-b` (blockade + boat + end) | 9,000 ticks | god 1P 7,467–7,631, 2P 7,042–7,049; normal 7,482–7,508, hard 7,636–7,725 | the shorter boat fight (final fixer) |
| The boat's fight (first tick in 'fight' → beaten) | ≤ 40 s per part (§R.13) | god 2,344–2,503 ticks (39.1–41.7 s); normal 2,349–2,389 (39.8 s max); hard 2,559 (42.7 s) | final fixer: `BOAT_HP` 1,500 (was 1,800), the hull's floor `BOAT_PACE.floorTicks` 2,250 (37.5 s; was 3,000 / 50 s): at 3,000 every fight lasted exactly the floor and a hull shot at an empty bucket only pinged |
| The end scene (beaten → the tally) | — | 262 ticks | — |
| The longest stretch without an enemy in `rf-b` | 4 s rule | 130 ticks (sim; 1P / 2P, god and normal) | the trickle guard `RF_B_TRICKLE` 100, now from the RIGHT (from the left only after an unseen kill and on the run-up to the boat); the end scene no longer counts |
| Activist bubbles | — | rf-b normal seed 4: `IK BEL MIJN MOEDER!` 9 (was 42), `KLIMAATNOOD!` 10 (was 0) | a cool-down per line (`ACTIVIST_LINE_GAP`, 300–720 ticks) |
| `rf-a` | 4,500 | god 1P 4,268–5,053, 2P 3,939; normal 3,904–4,831 | the lock cap `RF_A_LOCK_MAX` 600 (was 2,400: a gang member on a roof held a lock up to 40 s) |
| `rf-a` locks | — | the locked view = the fight's framing, no backward pan | `RF_A_ARENAS` were `[x, x]`: the view scrolled back 192 px at each lock |
| `rf-a`, the van lock on normal | soften if a human dies there too | the rider from behind only on hard / 2P; the bot still dies 1–4 times per level in `rf-a` (it holds a fixed spot under the roof couriers' lobs; the riders' shots are slow, 2.2 px/tick, with 24-tick tells) | — |
| The bot at the boat | — | 0 deaths (was 1 per fight: its dodge jump ran along with the shock) | `bot.ts`: the shock jump before the dodge planner; it crouches under the boom |
| The whole level (the bots) | ≈ 32,400 (28,800–36,000) | god 1P 31,185–33,706, 2P 29,885; normal 1P 29,965–31,966, 2P 29,804–30,064; hard 31,548–33,173 | the watch test now checks the measured totals |
| Tier 4 (every hero, 1P / 2P pairs, the reserve included) | ≤ 256 MB | `rf-b` 156.0 / 180.1 MB, `rf-a` 154.7 / 178.7 MB | — |
| The sign face (`SMALL`, art-blok-letters.ts) | our lettering, readable | M and W 5 bits wide, N 4, with diagonal middles | at 2× / 4× M, N and W read as H (`HISDAAD`) |

**Open for the play-test:** listen to `HOOI VOOR JOU!` (Scribe hears "hoi" in every take; the shipped
take's first word lasts 0.38 s, a long vowel, so it is probably right) and `VERSE MELK!` (Scribe hears a
question); Gusto's two card lines (6.6 s): the card now waits for him (`INTRO_VOICE_HOLD` up to 90
ticks); the drum tell `ring/boot/drum-tell` is now at vol 1.0 (+3.1 dB, re-shipped); the boat crew has no gloat / cower of its own in the in-world continue (only
the boss stagger); the police sprites carry no `POLITIE` lettering (the van does).

## 1. Flow and numbering

- Normal play: title → select → `ams` (MISSION 1) → MISSION COMPLETE tally → `ring` (MISSION 2)
  → tally → the glitch bridge → the first-person floors (level 3) → the ending.
- `?mission=ring` starts the ring directly (with `seed`, `players`, `char`, `god`, `debug`,
  `art`, `res`, `difficulty` as today). `?mission=ring&section=<landmark>` starts at a landmark.
- The intro card for the ring: `MISSION 2` and the subtitle `DE RING` (A10).
- The glitch bridge moves after the ring. Its story text (it names ROBO-HALSEMA today) gets one
  neutral line until the story exists. The first-person tally's `MISSION 1 BONUS` line becomes
  the bonus of the missions before it (ams + ring).
- High scores get a column for the ring (M1, M2, F1, F2).

## 2. The road and the lanes (side view)

- The camera looks at the right-hand side of the cars (the passenger side faces the camera).
  Traffic drives to the right.
- The screen from top to bottom: the HUD; the sky and the skyline (parallax, per stretch); the
  far carriageway with oncoming traffic behind the median barrier (scenery only); **4 lanes**
  (lane 1 far … lane 4 near) as depth bands; the hard shoulder (vluchtstrook) and the near crash
  barrier. Lane bands about 18 px high; the exact layout is set by the core builder.
- Everything on the road has a depth: its **plane y** = the line where it touches the road on
  screen (lane feet lines about y 124 / 145 / 167 / 190). It is drawn in depth order (far first)
  with a soft shadow on the road. `Entity.z` stays the draw-order tie-break (§13).
- Hits need overlap in x and in depth (thin depth slabs of about ±8 px), so a car in lane 2 does
  not stop a shot in lane 3, even where their sprites overlap on screen.
- Screen layout (tunable): HUD 0–50 over the sky; skyline 40–100 (parallax 0.2 / 0.35); the
  median and the oncoming traffic 96–110 (0.9); lanes 1–4; the hard shoulder 200–208; the near
  crash barrier 206–216 as a front layer (1.25).
- The camera scrolls forward all the time (about 3 px/tick when cruising). It slows down in the
  traffic jam and holds while every player is out. The road markings, the hectometre posts and
  the skyline sell the speed.

## 3. The wagon (player vehicle)

- **Shape:** the boxy 1990s Swedish estate (1993–96): a flat upright nose with a wide grille
  between rectangular headlights, a long flat roof with roof rails, a low straight window line
  with a large glass area and thin pillars, a nearly upright tailgate, the tall tail lights that
  cover the whole rear pillar (the signature), dark grey bumpers and a dark side rubbing strip.
  Proportions: length ≈ 3.3 × height, wheelbase ≈ 57 % of the length → about 92 px long, 28 px
  high, wheelbase 52 px (roof gear adds about 6 px).
- **The two wagons (user update 2026-10-20, from the user's photos of the squad's two real rally
  estates; likeness only, the photos stay outside the repo; this wins over any older colour
  text).** No maker badge, no real plate (made-up yellow Dutch plates `XX-XX-99`), no rally
  plaque, no rally numbers, no rally logo. Our own pixel lettering.
  - **GREEN "safari" (P2 in 2P):** dark bottle green with darker green / black camouflage blotches on the
    bonnet and the sides; silver five-spoke alloys; a silver roof rack on the rails with **two
    round spot lamps** at the front (black housings, chrome rims, glass with a grille) and a
    **spare tyre** lying flat at the rear (a small red jerrycan is optional). Right side (the
    side the camera sees): `ARTISANAL` over `GRAPE` in yellow block capitals across the doors,
    with a small pink grape-bunch icon. Left side: `MAJOR` (big) over `COCKTAILS` in pink
    capitals, with a small cocktail glass (an orange-red drink, a lime slice, a straw).
  - **WHITE "rozzers" (1P, and P1 in 2P):** white with the British "jam sandwich" police-style livery: a waist
    band of fluorescent orange (wide, top), yellow (middle) and orange (bottom) from the front
    wing to the tailgate; `619` in white digits on the band at the rear of the front wing;
    `ROZZERS` in white capitals on a dark-blue box on the front door (both sides); silver wheel
    covers; black roof rails; a black tubular **push bar** on the nose with **two round black
    spot lamps** with grilles. Optional 4× details: a tiny St George's cross under the `619`,
    the small script line `Catching crims and locking them up` on the rear door, a hint of the
    mirror-written blue bonnet text `U WOT M8?`.
  - The left side (`MAJOR COCKTAILS`, and the white wagon's left side) shows whenever a wagon
    faces left: in the boarding scene the wagon comes down the on-ramp loop facing left and makes
    a handbrake turn; and in the wreck spin. Lettering never mirrors (text frames per facing,
    like the scan car).
  - **Who rides which (user decision, 2026-10-20; wins over any older text, including a
    builder prompt that says P1 green):** 1P → the **white** wagon; 2P → P1 **white**, P2
    **green**. A P2 who joins mid-level drives in with the green wagon.
- **People:** the driver hero sits on the far side (seen through the glass: head, shoulders,
  hands on the wheel). The playing hero sits in the near passenger window frame, torso above the
  roof line, and aims 8 ways. Both use their own hero art (seated / ride strips).
- **Steer:** the D-pad. Up/down moves the car toward the next lane (a lane change takes about 14
  ticks; on release it settles in the nearest lane). Left/right moves the car forward/back on
  screen inside a band (about x 24–300); a forward push tilts the nose up a little, a brake dips it.
- **Aim (steer lock):** while FIRE is held, the car keeps its lane and its screen x, and the D-pad
  aims the gun: → same lane forward; ↗ forward into the far lanes; ↑ straight across into the far
  lanes; ↘ / ↓ into the near lanes; ← ↖ ↙ backwards. Release FIRE to steer again. A tap of FIRE
  shoots in the last aim (default: forward). Every weapon keeps its own shot; a shot moves in x
  and depth (diagonals about ±20°: one lane per about 64 px; ↑ / ↓ straight across). Shots that
  leave the road band are removed. Weapons that need gravity or terrain (flame shot, bounce
  mine) do not drop on the ring in wave A; homing shots aim at depth slabs.
- **JUMP = swerve:** a fast one-lane dodge toward the held up/down (or away from the nearest
  threat) in about 6 ticks, with 8 ticks of no damage and a 30-tick cooldown. A swerve into a
  small vehicle (scooter, motorbike) is a side ram (damage, knocks the rider off).
- **BOMB = lob:** a grenade arcs into the aimed lane (forward by default) and blasts an area in x
  and z.
- **Knife:** an enemy on the bonnet or at the window gets the knife (FIRE at close range, as on
  foot).
- **Armour (cells, like `Vehicle`):** about 10 cells; a bullet ½, a thrown object or a bump 1, a
  ram or a crate 2. Damage states: dents → broken glass → smoke → fire. At 0: the wagon spins
  out, the driver and the hero tumble onto the hard shoulder (no harm shown), the hero loses a
  life; after about 60 ticks a fresh wagon with the same driver drives in from the left, with
  120 ticks of blink. `pickup-repair` gives +1 cell.
- **Driver lines:** OFF (user 2026-10-21: "I don't want the driver to say anything"; `Wagon.talk`
  is false, so no bubble and no line). The lines stay in `content/ring/wagon/lines.ts` for a later
  story: each driver has own short lines (bubbles ≤ 24 characters per line, 2 lines) on the
  boarding, a bump, a speed camera flash, a hostage on the roof, low armour, a tunnel, the boss.
  Example: `HOU JE VAST!`, `NIET WEER EEN FLITSER!`, `WIE PARKEERT ER EEN CARAVAN?!`.

## 4. The ring generator

- **Seed:** each play gets a seed (`?seed=` / `--seed` fix it). The generator has its own `Rng`
  stream, so the generator's output does not depend on combat.
- **Today's ring** (the game is set now; only the wagon is a 1990s classic). The clockwise
  carriageway is the inner ring (binnenring); 32.3 km in reality. The S-exit numbers count DOWN
  in our direction (S113 → S101, then S118 → S114).
- **Landmarks (fixed, in the real clockwise order):**
  1. `oost` — the on-ramp at S113 Watergraafsmeer (the boarding scene); S112 Centrum, S111
     Overamstel; the Rembrandt tower near Amstel station.
  2. `amstel` — knooppunt Amstel (A2) and the Rozenoordbrug over the Amstel.
  3. `zuid` — S109 RAI (the exhibition halls), the Zuidas towers, the railway and metro between
     the two carriageways, S108.
  4. `nieuwe-meer` — the Schinkelbrug (a bascule bridge), knooppunt De Nieuwe Meer (A4) and the
     lake with the woods to the south.
  5. `west` — S107–S104 (Slotervaart, Lelylaan, De Baarsjes, Bos en Lommer, the buildings over
     the road), S103, S102 Sloterdijk (the station and its offices). The 80 km/h stretch with the
     average-speed zone.
  6. `westpoort` — S101 Hemhavens, the port cranes: the **mid-boss slot** (the test lorry, §6).
  7. `coentunnel` — the **Coentunnel** under the Noordzeekanaal, then knooppunt Coenplein (A8).
  8. `noord` — S118, S117, the bridge over the Noordhollandsch Kanaal, S116, S115; long noise
     screens, the polders to the north.
  9. `zeeburg` — the **Zeeburgertunnel** under the Buiten-IJ, S114 IJburg, the Zeeburgerbrug over
     the Amsterdam-Rijnkanaal.
  10. `exit` — the end-boss slot (a marker for now), the exit sign S113 and the off-ramp →
      MISSION COMPLETE.
- **Chunks** between the landmarks (about 512 px each): open road, dense traffic, on-ramp merge
  (enemies join from the near side), off-ramp, matrix gantry with a lane closure, road works,
  speed camera, average-speed zone, bridge, interchange (fly-overs in the background), traffic jam
  (at most 2 per ring), rest (items, no enemies).
- **Director:** a threat budget per chunk that rises along the ring; enemy wave templates with
  costs; rest gaps; rules: always at least one open lane; never a lane closure inside a jam; no
  stretch without an enemy on screen longer than 4 s (GDD 1.5) except rests and scenes; landmarks
  in order; total length in range (about 8–10 min at the bot's pace).
- `?mission=ring&section=<landmark>` starts at that landmark with a short run-in.

## 5. Enemies (all mobile; all bloodless; riders tumble onto the hard shoulder)

1. **Scooter gang** (`ring-scooter`): two-up scooters in groups of 2–4 (EASY 2, NORMAL 3, HARD 4;
   at most 4 on screen; user play-test 2026-10-21, was 3–5), from behind or ahead.
   They weave between lanes. The pillion lobs bottles into your lane or fires a pistol along the
   lane. Light; a swerve ram knocks them off. (Scooters are not allowed on a motorway; the
   parody keeps them.)
2. **Parcel van** (`ring-parcel-van`): the rear doors open; a thrower tosses parcels (they land
   and tumble back as obstacles; shot parcels break, some drop an item) or a gunner fires back.
   **Brake check:** the brake lights glow for about 24 ticks, then the van brakes hard in front
   of you. Variant: a tied hostage in the back (§8).
3. **Enforcement convoy** (from `ams`):
   - `ring-scan-car`: the scan car (the `ams` likeness, smaller roof scanner box) drives
     alongside and casts SCAN LOCK on a lane: a red strip that slows a wagon inside it until it
     changes lanes.
   - `ring-tow-truck`: comes from behind and swings its hook; a hooked wagon is dragged back
     until you swerve free or shoot the cable.
   - `ring-handhaver-moto`: a handhaver on a motorbike rides up to the window and swings a baton
     or slaps a fine sticker on the glass (blocks a part of the hero's aim until a swerve shakes
     it off).
4. **Caravan car** (`ring-caravan`): the caravan comes loose (after damage or on a timer) and
   swerves across the lanes, then tips over. A gunner shoots from its roof hatch. Variant: a tied
   hostage inside (§8).
5. **Road-works crew** (`ring-roadworks`): a slow truck with the orange-white arrow-board trailer
   (flashing arrow); workers on the back throw cones (lobs); behind it the lane is closed by
   cones for a stretch.
6. **Lorry + container** (`ring-lorry`): §6.

Foot enemies in the traffic jam (§7.2) reuse `ams` enemies (handhavers, stag partiers): they run
between the stopped cars and jump onto the bonnet.

## 6. The test mid-boss: lorry + container

A temporary boss that proves the boss hook on a moving road. The real bosses replace it later.

- A container lorry (about 180 px; cab + trailer + container) drives in lanes 1–2 and keeps pace
  with the camera; the camera locks its forward motion so the lorry stays on screen.
- Phase 1: the container doors open; it launches crates and barrels that roll across the lanes.
- Phase 2: the side panels drop; a forklift drives out onto the road and charges along a lane;
  the cab weaves to block lanes.
- Parts with their own HP (cab, doors, trailer wheels), a boss bar, stagger and `cutAttack` as in
  the `Boss` base; 10,000 points; death: the lorry jackknifes, the container slides onto the hard
  shoulder; a weapon or repair drop.

## 7. Hazards

1. **Matrix gantries:** one sign above each lane, with amber corner flashers: a white diagonal
   arrow (leave this lane) on the first gantry, then a red X (the lane is closed: yellow
   temporary lines, orange cones with reflective bands, a crash-absorber truck and an arrow
   trailer block it for a stretch); red-ringed speed numbers (80 / 100; a `50` warns of a jam);
   the white end-of-restrictions circle. Hitting the closure costs armour and stops the wagon for
   a moment.
2. **Traffic jam (file):** the matrix shows `50`, then the civilian cars brake; the scroll slows
   to a crawl and stops. Lane changes only into gaps. Foot enemies run between the cars and jump
   onto the bonnet (knife or shoot). After its waves the jam clears and the speed comes back.
3. **Tunnels** (Coentunnel, Zeeburgertunnel): the skyline gives way to the tunnel wall; white
   LED light bands pass overhead; green escape doors with pictograms and emergency phone posts;
   the sprites get a darker light; sounds echo. Three lanes (the near lane becomes the tunnel
   kerb and wall); no overhead gantries inside.
4. **Speed cameras:** a camera post or gantry; a wagon in the front third of the screen when it
   passes gets a flash and a fine: `BOETE!` and −500 points (never below 0), and a driver line.
   **Average-speed zone** (trajectcontrole): a start and an end sign; a wagon whose average x in
   the zone is in the front third gets one fine at the end.

## 8. Traffic, pickups and hostages

- **Civilian traffic** (`ring-traffic`): hatchbacks, vans, a taxi, a camper (one parametric car
  drawer: length, height, roof, colour). Slower cars in the near lanes (you overtake them),
  faster ones in the far lanes. Light traffic (user play-test 2026-10-21: about half the first
  build's cars) and never a wall: at most two lanes hold cars abreast (one in a tunnel or beside a
  closure), so two open lanes always stay free. A bump costs ½–1 cell and pushes. They stop bullets from both
  sides (cover); shots dent them (3 states) but never destroy them; no penalty.
- **Crates** fall from wrecked enemy vehicles and lie on the road (they move back at road speed).
  Drive over one (x and z overlap) to pick it up: weapons, bombs, `pickup-repair` (more often
  while the armour is low), food and gems.
- **Hostages:** tied hostages in the backs of parcel vans and caravans. Shoot the door open: the
  hostage jumps onto your roof, salutes and drops an item into the window. They count in
  `MissionDef.hostages` and the tally.

## 9. Two players and the continue

- Each player has an own wagon with a different driver (drivers come from the heroes nobody
  plays). P2 joins at any time: the wagon drives in from the left. The two wagons bump (a push, no
  damage); a lob flies over the other wagon.
- The in-world continue (GDD 4.6) applies: while every player is out, the generator and the
  scroll hold (the camera stops at the crash), but the **traffic drives on** (user 2026-10-21):
  the civilians keep the road's free speed (`RingHost.flowSpeed`), fresh ones come from behind,
  and a car held back by a standing thing changes lanes around it. The enemies on screen
  **gloat** with ring gags (no pointing, no laughing):
  the parcel courier sticks a `NIET THUIS` card on the wreck, the tow truck hooks the wreck, a
  handhaver writes a fine for parking on the hard shoulder, the scooter gang does slow wheelies.
  START → a fresh wagon drives in; on its arrival every non-boss enemy on screen cowers (`!`)
  and the boss staggers.

## 10. The boarding scene and the end

- Start: the on-ramp at A10 Oost. The hero stands on the hard shoulder; the wagon comes down the
  on-ramp loop facing left (its left side shows), makes a screeching handbrake turn;
  the driver shouts a line (`STAP IN!`); the hero jumps into the window frame; the wagon
  accelerates up the ramp and merges into lane 4. Skippable with START after the first play.
- End: after the end-boss slot the matrix shows the exit; the wagon steers onto the off-ramp
  (automatic); MISSION COMPLETE; the tally (hostages, fines); then the glitch bridge.

## 11. Art, sound and text

- Every new sprite id has 1× art (the 64-colour palette) and 2× / 4× art from ONE density-generic
  drawer (PAL_HD, `src/game/art/hd/`), per `docs/ART_GUIDE.md` "UHD art": geometry is law; the
  outline rule A for things that move or can be hit; painted backgrounds without ink outlines.
  `defer: true` for rare strips.
- Scenery per stretch: the road surface (asphalt, dashes, yellow temporary lines in road works),
  the steel guard rails (concrete barriers next to tunnel walls), the median and the far
  carriageway, noise screens, small green hectometre boards (`A10 12,3 Re`), white-on-blue
  direction signs (`RING A10`) with the S-shield (white, a thick black border, `S 113`), the
  skyline layers per landmark (the Rembrandt tower, RAI halls, Zuidas towers, the lake and the
  woods, Sloterdijk offices, port cranes, the Noord polders, the tunnels).
- Lane rule flavour: caravans and lorries keep to the two right lanes (lanes 3–4, near); the
  test lorry breaks that rule as a boss (it drives in lanes 1–2 so it does not hide the play).
- Tier-4 working set ≤ 256 MB (`DENSE_BUDGET_BYTES`) for every hero and hero pair: only the
  current and the next landmark's scenery are resident; the generator tells the art cache what
  comes next.
- Sound: synth recipes only (no new samples, no ElevenLabs): the engine hum (pitch follows the
  speed), the tyre screech, the horn, the matrix click, the camera flash, the tunnel echo, the
  scooter whine, the tow winch, the lorry's air horn, the road-works beeper. A new original synth
  stage theme for the ring.
- Text: English with Dutch flavour; bubbles ≤ 24 characters per line, 2 lines.

## 12. Originality: the `ring` exception

Add to `docs/ORIGINALITY.md`: by the user's decision (2026-10-20), mission `ring` uses real names
of the A10 ring road and its places (A10, de Ring, the S-exits, the Coentunnel, the
Zeeburgertunnel, RAI, Zuidas, Sloterdijk, Westpoort, Noord, Zeeburg) and a likeness of the Volvo
850 estate without the maker badge or logo; the heroes may say "de Volvo". All art is drawn by our
code; no photo is traced or sampled; signs use our own pixel lettering.

## 13. Architecture (from the code map, 2026-10-20)

**Choice: a `RingRunner` and a `RingScene` on top of the unchanged engine `World`.** The ring
simulates a top-down plane: x = road distance, y = depth (the road line on screen). Height above
the road is only drawn (`lift`). Existing game classes are reused through subclasses. Nothing in
`src/engine/`, `mission/runner.ts`, `Player`, `Vehicle` or `Enemy` changes at run time, so `ams`
and m0–m5 stay byte-identical by construction.

- **Not** a lane mode inside `MissionRunner` (it is built around sections, terrain and on-foot
  players, runner.ts:205-288, 788-827, 1189-1209; the World shot pass has no depth filter,
  world.ts:526-606). **Not** a separate world like the first-person mode (it would rewrite
  enemies, weapons, boss parts, fx, HUD and scoring).
- **Do not register `ring` with `defineMission`:** `listMissions` sorts ids (registry.ts:371), so
  `ring` would become m5's default next mission (runner.ts:719-724).
- **Depth slabs:** ring entities keep `hitbox` as the visual box (bubbles hud.ts:583, popups
  enemy.ts:590, despawn world.ts:664) and override `hurtboxes()` / `contactBoxes()`
  (entity.ts:160-172) with slabs of about ±8 px depth. Then `shotPass`, `damageArea` and
  `contactPass` work unchanged; an aim angle is a plane angle; a shotgun spread fans over lanes.
- **Civilian cover:** each civilian car is a `SolidBox` (physics.ts:189); `sweep` stops both
  teams' shots (physics.ts:975-1003); dents count the shots that end on its box.
- **Subclasses:** `RingHero extends Player` (always `'mounted'`; overrides update, draw, respawn,
  life loss: player.ts:486, 1127, 1230, 1262; keeps `isPlayer`, the HUD vehicle panel
  hud.ts:253, pickups pickup.ts:359, `giveWeapon` / `addBombs` / `addLife`). `Wagon extends
  Vehicle` (cells = armour, `cellDamage` / `onHit` vehicle.ts:675-700, `repair` :741, `mount`
  :277; overrides `control` :500 and `physics` :386). `RingEnemy extends Enemy` with
  `body: false` (enemy.ts:200): keeps gloat / cower, `die` / score (:580); its own plane aim
  (`aimAt` :525 aims at visual boxes); `dropItem` (:640) spawns a ring crate. The lorry extends
  `Boss`. `attachGame` + `game.runner = ringRunner` (context.ts:371-385).
- **Type-only widening** (no run-time change): `HudRunner` (hud.ts:41), `TallyRunner`
  (mission-complete.ts:59/81, flow.ts:42-80, glitch-bridge.ts:51), rumble.ts:48.
- **Continue:** copy the rules of runner.ts:839-994 into `src/game/ring/continue.ts` (no refactor
  of `MissionRunner`). Join / pause / lost pad: extract gameplay.ts:772-961 into
  `scenes/play-host.ts` only if `pads-scenes.test.ts` stays green; otherwise copy.
- **Generator:** `planRing(seed, difficulty)` is a pure function → `RingPlan`
  (`new Rng(seed).fork('ring/plan')`, rng.ts:141). The plan holds every spawn decision (lane,
  variant, side), so `world.rng` only drives AI and a P2 join never changes the plan. Drivers come
  from the plan rng (`ROSTER` minus the playing heroes). Landmarks have fixed set-piece lengths;
  the stretches are generated; the total is normalised to 9:00 ± 5 % at the planned speeds. Chunk
  types: `cruise`, `traffic`, `jam`, `roadworks`, `gantry`, `speedcam`, `avgzone`, `convoy`,
  `caravan`, `parcel`, `merge`, `rest`; `bridge` and `tunnel` only at their landmarks. A budget
  curve 0.2 → 1.0 over the loop; a `rest` after each peak. Guarantees per seed: exactly 1 golden
  record (the route now includes the ring), ≥ 1 hostage per stretch, a repair chance at least
  every ~60 s, the boss slot in place. The camera always moves at `roadSpeed`; `planDist`
  advances only while the plan is not locked (the boss locks it; the road keeps scrolling); an
  unknown boss id (the end marker) is skipped.
- **New seed each play:** `freshSeed()` at the mission start; `?seed=` wins; the seed is shown in
  the debug overlay and the tally footer (bug reports and replays).
- **Scenery streaming** (`src/game/ring/view.ts`, after view.ts:55-59): per layer, chunk
  i = ⌊viewX · factor / 256⌋ is drawn by a bg generator with `params {district}` and
  `seed mix(seed, layer, i)` (art-registry.ts:85); dense versions via `defineHiBgGenerator`
  (:180) as queued art jobs; landmark set pieces are sprites under `decor/ring/<landmark>/`.
- **Tier 4:** `ringArtDef(plan)` returns a `MissionArtDef` whose sections are the stretches (the
  landmark decor + the enemy families the plan first uses there). Always resident: the wagon,
  civilians, scooters, `fx/ring/`, items; the lorry in `preloadLast` (boss art only in the boss
  stretch, gameplay.ts:244). `preloadMissionArt` at the start and `missionArtSection(stretch)` at
  each boundary (gameplay.ts:447-503); stretches behind are released. One additive field:
  `MissionArtDef.extraChar` lets the drivers' `char/<id>/ride-*` and `mount` strips through the
  hero filter (gameplay.ts:239); ams has no such field. Scenery 4× buffers get their own reserve
  (≤ 32 MB), tested separately.
- **Drawing order:** road → shadow pass (ellipses at plane y; airborne things get a shrinking
  shadow) → entities sorted by `y · 100 + z` → particles → front layer → light → HUD. Shots are
  drawn raised by their `lift` (from the shooter's gun height, projectile.ts:129). Tunnels: tunnel
  layers between the portals, a darkness rect (alpha ramps at the portals), then additive light
  sprites (lamp bands, headlights, muzzle flashes, blasts). Particles get a flat ground at the
  bottom of the road band.

### 13.1 Flow edits

| Place | Change |
|---|---|
| flow-data.ts:70 | `FPS_ROUTE = ['ams', 'ring', 'fps-1', 'fps-2']` |
| flow-data.ts:78 / 86 | `missionNumber('ring')` = 2, `missionLabel` from the route |
| ams/index.ts:65-67 | `next: 'ring'`, drop `after` (and mission-ams.test.ts:41) |
| flow.ts:42-46 | `missionDone` sends `'ring'` to `MissionIntroScene`, which starts `RingScene` |
| mission-intro.ts:119-121, 159-164 | ring preload and dispatch |
| new `scenes/ring.ts` | `complete` → `GlitchBridgeScene({ from, runner })`; `releaseMissionDense` (glitch-bridge.ts:211) also frees ring art |
| fps/run.ts:12, fps-tally.ts:105-110 | store `{ mission, totals }`; the label becomes `MISSION 2 BONUS` |
| high-scores.ts:40-50 | a column for `ring` |
| cards.ts | the ring card via `defineMissionCard` (label, an A10 map polyline, briefing, headline) |
| boot.ts:43-50, 121, 175-185 | `?mission=ring` → `startRing`; boot art list; audio group reuse |
| content/index.ts | manifest entries `ring/*` (not lazy) |
| glitch-bridge story text | one neutral line until the story exists (it names ROBO-HALSEMA today) |
| docs | GDD (flow §13, new ring chapter), ARCHITECTURE §6, api/game.md §10–11, new api/ring.md, ORIGINALITY (§12), sim.md |

Tests to update: fps/flow.test.ts:370-376 (`FPS_ROUTE`), scenes.test.ts:434-441 (column,
label). Unchanged (the ring is not a registered mission, synth only): ui.test.ts:295-305,
audio-spec.test.ts:103-107, boot-art.test.ts:40-47, scenery-hi.test.ts:127.

## 14. Build waves (two workflows, a play-test stop between them)

Each wave: snapshot → workflow → my own gates and a look at frames → a local commit → the user
plays. No push without the user's word.

**Wave A — the mechanism (9 agents).**

| Stage | Builder | Owns |
|---|---|---|
| core | C1 RUNTIME | `src/game/ring/{types,lanes,ids,entity,runner,continue,hero,wagon,view,art-def,mission}.ts` (minimal wagon and a flat view); stub `index.ts` for every builder folder; manifest entries. Interfaces frozen at the end of the core stage. |
| core | C2 WIRING | the type widening in shared files, the flow edits (§13.1), `scenes/{ring,ring-route,play-host}.ts`, `src/sim/headless-ring.ts`, a first `src/sim/bot-ring.ts`, the `tools/sim.ts` ring branch. Exit: the ring runs to MISSION COMPLETE on placeholder art. |
| build | GEN | `ring/{plan,director,landmarks}.ts`, `tests/game/ring/plan*.test.ts` |
| build | WAGON | `ring/{wagon,hero,boarding}.ts`, `content/ring/wagon/**`: steer, steer lock, 8-way aim, swerve and side ram, lob, knife, armour and damage art, wreck and drive-in, the drivers and their lines, 2P, the boarding scene, `torso-pistol-diag-down` |
| build | SCENERY | `ring/{view,light}.ts`, `content/ring/scenery/**`: road, barriers, signs, skyline layers and set pieces for the 10 landmarks, tunnels and light |
| build | ROAD | `content/ring/{traffic,hazards,items}/**`: civilians (cover, dents), gantries and closures, speed cameras and the average-speed zone, the jam controller (no boarders yet), crates, `RingPickup`, the hostage carrier hook; the **scooter gang** as the first enemy (combat end to end) |
| finish | INTEGRATOR | merge, the bot (lanes, steer lock, swerve, pick-ups, continue), sims, the dense budget test, docs |
| finish | REVIEW | spec, standards, determinism, byte identity, budget |
| finish | FIXER | the review's findings, the final gates, `tmp/ring-a-report.md` |

**Wave B — the enemies, the test boss and the sound (7 agents).**

| Builder | Owns |
|---|---|
| GANGS | `content/ring/gangs/**`: parcel vans (thrower, gunner, brake check, parcels, hostage), the caravan car (loose caravan, roof hatch, hostage) |
| CONVOY | `content/ring/{convoy,roadworks,jam}/**`: ring scan car (SCAN LOCK lane), tow truck (hook and drag), handhaver motorbike (baton, fine sticker), road-works crew, the jam boarders (reuse `ams` handhavers and stag partiers) |
| BOSS | `content/ring/boss/**`: the lorry + container (2 phases, parts, stagger, death) |
| SOUND + TEXT | `content/ring/{audio,card,lines}.ts`, `sfx/ring-*.ts`: all synth sfx, the ring stage theme, the driver lines, the card, the gloat gags |
| INTEGRATOR | placement in the director's wave templates, the bot, sims, budget, docs |
| REVIEW | as wave A |
| FIXER | as wave A, `tmp/ring-b-report.md` |

Estimates (from the extras wave: 10 agents, 5.7 M tokens, 5.5 h): wave A about 6–7 M tokens and
6 h; wave B about 4–5 M tokens and 4–5 h.

**Status.** Wave A done (2026-10-21, `tmp/ring-a-report.md`). **Wave B done (2026-10-21,
integrator `tmp/ring-b-integrate-report.md`):** `RING_CONTENT_WAVE = 'B'`: parcel vans, the caravan
car, the convoy, the road-works crew, the jam boarders, the test lorry in `westpoort`, the ring
theme and boss song with their cues, the drivers' wave-B lines; hostages ride in parcel vans and
caravans; the ring's own MISSION COMPLETE page; the green wagon's deep bottle green; the comma on
the hectometre boards; the x-ray outline of a covered wagon. The fixer's pass (the review's
findings, the tuning below) and the final gates: `tmp/ring-b-report.md`.

Tuning in wave B (measured with the bot; the builders' reports list theirs):

| Value | Spec / before | Now | Why |
|---|---|---|---|
| `ENEMY_PRESENCE` (the 4-second estimate) | moto 240, van 360, caravan 420, scan car 420, tow truck 300, road works 360 | moto 90, van 240 (hostage 240), caravan 200 (hostage 200), scan car 240, tow truck 200, road works 450, boarder 120 | measured time on screen with the bot (p10 … p25); two players kill a van in about 150 ticks and the plan never depends on the player count |
| `RING_PLAN.gapPlace` (a forced wave after this many ticks without an enemy) | 120 | 90 | wave-B targets die faster than the estimate: 2P gaps up to 290 ticks at 120 |
| the estimate after a rest or a scene | carried over | starts afresh at its end | a convoy shot during a rest left 6–7 s without an enemy after it |
| hostage carriers in the estimate | not counted | counted | no forced wave on top of a hostage van |
| waves in a jam and in the chunk after it | any template | scooter gangs only | motos from behind waited off screen behind the queue for 5 s |
| the jam's waves | the scooter gang | the gang, then the boarders (2 / 3 / 4 by difficulty) | spec §7.2 |
| caravans | any lane | lane 3 or 4 | spec §11 |
| scooter filtering in a jam | jam level > ½ | > 0.05 (while the queue is parked) | a new gang sat off screen behind the parked queue as the jam cleared |
| the lorry's push-out of a wagon beside it | away from it | away from it, always onto the road | a wagon in lane 1 was pushed over the median (y 108) and stuck there |
| civilian cars while every player is out | their own speed | they stand with the held road | near-lane cars drove backwards into the cars behind |
| the wagon wreck while every player is out | gone after 90 ticks | stays until the hold ends | the courier's NIET THUIS card and the tow truck's hook need it |
| the bot's lob at a boss | every 2 s (any target) | every 6 s, when the landing spot is on the boss | 32–34 s fights at 2 s; now 48–61 s (spawn → gone) |

Fixer B (2026-10-21, after the review; `tmp/ring-b-report.md`):

| Value | Before | Now | Why |
|---|---|---|---|
| the lorry's damage rate | none | the pool loses at most 2 HP per tick (a bucket of 150; × difficulty × co-op) and holds at the phase-2 line until the side panel is down | the shotgun killed it in 9–12 s and phase 2 hardly showed; now 28–30 s with the shotgun, 38–46 s with the machine gun, the pistol (1.9 HP per tick at the cab) unchanged |
| the fine sticker (§5.3) | the hero's fire rate halved (a builder's call) | the back aims (←, ↖, ↙) are blocked | back to the spec: it blocks a part of the hero's aim |
| the loose caravan's ram | 2 cells every 30 ticks of contact | 2 cells once per wagon per crash | it dropped back onto the wagon behind it and rammed it again and again (6–20 cells per normal run) |
| `RING_PLAN.gapJam` | 120 | 100 | jam gaps of 250–252 ticks (over the 4 s mark) |
| the plan's target | 9:00 | 8:45 (`RING_PLAN.target`; the invariant stays 9:00 ± 5 %) | the lorry's fight comes on top: whole rings reached 36,600–36,900 ticks (§15: 31,000–36,000) |
| a boss slot | no wave of its own after the fight | a forced wave right after the fight | in 2P the next enemy came 260 ticks after the lorry died |
| an entrant boxed in off screen | waited (van 884 ticks, moto 339, tow truck 453) | gives up after 300 ticks fully off screen; a leaving one goes past either edge | the director counted it as present while nobody saw it; a hostage van lingered behind the left edge |
| scooters and the big wave-B vehicles | rode through them | `ring-block` and `ring-big` block their lane | a scooter in the tow truck's cab, scooters piled over the road-works crew |
| a slow civilian car ahead of a wagon at the band's left end | pushed the wagon off the screen | is shoved ahead of it (not in a jam stand) | the corrected off-screen-hit watch found bumps on wagons pushed past the left edge |
| the x-ray's density | the art density | at most 2× | about 1.3 ms per covered wagon per frame at 4× |
| sound effects in a tunnel (§7.3) | dry | an echo (0.11 s, feedback 0.3, mix 0.32) through the opt-in `AudioOut.setEcho` | spec §7.3: sounds echo |
| the container code | `ZWNU 619072` | `ZWAU 619072` | the 3-wide N reads as an M at 4× |

Polish (2026-10-21; `tmp/ring-polish-report.md`):

| Value | Before | Now | Why |
|---|---|---|---|
| EASY jams | the stand's thin waves, then nothing until the plan's floor | `after`: a gang of 2 scooters from behind when the stand ends (EASY only; drawn last from the jam's own fork, so NORMAL / HARD plans stay byte-identical) | EASY seed 2: 270 ticks without an enemy in the Coentunnel crawl (the plan's floor counted the gangs that came in during the stand as if they came after it) |
| a wagon at the band's left end in 2P | the rear wagon of a queue pushed to half off the screen | `wagonBandEnd`: a wagon queued in front of the other wagon at the band end cannot give way either; road things shove ahead of it; a push never takes a wagon past that end; a jam car standing in the stand is shoved too | wagons up to 55 px past the left edge in 2P bot runs |
| the caravan's tip | toward us (the roof faces us) | away from us (the livery stays in view, the underside and both wheels toward us), a dust puff, slide sparks | the tipped caravan read as a white roof slab |

## 15. Gates

- New tests under `tests/game/ring/`: `plan` (the same seed gives a deep-equal plan; 50 seeds
  meet every invariant; different seeds differ), `lanes` (shots stay in their lane, diagonals
  cross lanes, the lob hits only the aimed lane, civilians block both ways and never die),
  `armour` (½ / 1 / bump costs, wreck → life → new wagon, repair, out), `two-player` (join from
  the left, a different driver, a bump without damage), `continue` (hold: plan and road speed 0,
  gloat → START → cower), `determinism` (two runs with the same seed hash equal), and
  `tests/content/ring-dense-budget.test.ts` (seeds 1–20 × every hero 1P and hero pairs 2P × every
  stretch ≤ 256 MB − 2 MB margin − the scenery reserve).
- Sim: `npm run sim -- --mission ring --god --expect-complete [--seed n] [--players 2]`. Bot:
  a lane safety map; release FIRE to change lanes; hold FIRE and aim at the nearest target; JUMP
  to swerve from shots and rams; bombs at the boss; stay in the rear half (fines); knife
  boarders; START to continue. Expected about 31,000–36,000 ticks (fail outside 28,800–39,600);
  under 30 s wall; ≤ 1 ms average per tick; ≤ 120 entities.
- Byte identity: a baseline before each wave, then diff the reports (`jq 'del(.timing)'`): ams
  `--god --expect-complete` lower **21,443** and upper **23,088** ticks; m0 and m2 god reports
  identical.
- `npm run typecheck`; the full vitest suite; `npx vite build`; `npm run smoke` (title,
  `?mission=ams`, `?mission=ring`); a 4K browser run of `?mission=ring&art=4`; boot ≤ 4 s.

## 16. Risks

- `RingHero` depends on `Player` internals (status effects, the victory pose): a test of every
  `PlayerState` under the ring.
- 2P tier-4 budget: two pinned heroes and two drivers; the drivers use only the `ride-*` and
  `mount` strips.
- Boot time: every sfx is pre-rendered at boot (boot.ts:93-103); the ring sfx add to the 4 s
  limit (measure; defer if needed).
- Particles have no ground in the plane: a flat ground at the bottom of the road band.
