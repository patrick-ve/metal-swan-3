# Mission ams — arcade extras (spec, 2026-10-20)

A gap analysis (2026-10-20) compared mission `ams` with the run-and-gun genre's classic mechanics.
The user chose the extras below. This file is THE SPEC for the wave; it wins over the GDD for
`ams` where they differ. Detail rules (looks, numbers) may be tuned by the builders when play shows
a better value; the report says what changed and why.

Originality: `docs/ORIGINALITY.md` and `docs/research/mechanics.md` §23 apply in full. Never name
any reference game in code, ids, comments or docs. No transformations, no laughing or pointing at a
player's death, no mass scream when a player comes back, no cheering idle gag, no copied set
pieces. Real Amsterdam names are allowed in `ams` (the ams exception).

## 0. Decisions

| # | Item | Decided by |
|---|---|---|
| 1 | The in-world continue's `laugh` becomes an own Amsterdam gag: the **gloat** (§1) | user |
| 2 | Mid-mission boss: the **parking scan car** on the shop quay of section c (§3) | user |
| 3 | New enemy with guns and a hijackable enemy vehicle: the **stag party** and the **beer bike** (§2) | user |
| 4 | A **route choice** in section c: the white bridge (`c1`) or a **canal cruise** with auto-scroll (`c2`) (§4) | lead default, told to the user |
| 5 | **Secrets**: hidden captives, one hidden 1UP, shoot-to-reveal items (§5) | lead default |
| 6 | A **repair item** source in ams, and vehicle-state drops (§6) | lead default |
| 7 | **Bug fixes** found by the analysis (§7) | lead default |
| 8 | All new art at 1×, 2× and 4× (the UHD dense-art contract) inside the tier-4 working-set budget (§8) | standing rule |
| 9 | Run as a workflow | user |
| 10 | **Bluetooth controllers** for 2 players, PlayStation, Xbox, Switch / 8BitDo and generic pads (§10) | user |

Scope: mission `ams` only. m0–m5 keep working passively (their sims stay byte-identical).

## 1. The gloat (replaces `laugh`)

While every player is out (the runner's hold, GDD §4.6), the enemies on screen stop and go about
their own Amsterdam business at the spot where the last player went down. They never point, laugh
or cheer.

- Reaction kind `gloat` replaces `laugh` everywhere: `ReactionKind`, `EVERY_ENEMY_REACTIONS`,
  `REACTION_ANIMS`, the runner (`updateHeld`, field names), `TUNING.continues.gloatEvery` /
  `gloatTicks` (same values 15 / 24), `ON_DEMAND_4X` in `scenes/gameplay.ts`, the sim, the tests
  and the docs. The 62 `enemy/<set>/laugh` strips are deleted; new `enemy/<set>/gloat` strips
  replace them (same sets, `defer: true`, 1× / 2× / 4×).
- Per enemy (bubbles are kind `gag`, at most one per enemy per hold, ≤ 24 chars per line):
  - **handhaver**: walks to the spot (≤ 40 px, stays on its floor), writes in his notebook, tears
    the page off and lets it flutter onto the spot (`ams/ticket`). Bubble `VERBODEN TE LIGGEN!`.
  - **fatbike youth** (solo and pair): a slow wheelie on the spot, the speaker thumps.
  - **delivery rider**: circles once and rings his bell (`ams/bell`), checks his phone.
  - **seagull**: lands at the spot and pecks at the ground (the hero's lost fries).
  - **stag partier** (new, §2): the group takes a selfie with the spot (phone up, a small flash).
- The cower on a continued hero's landing stays (strips `cower`). It has no scream sound.
- Docs: GDD §4.6, §13.9 and the originality rule at GDD "Gags and transformations" agree again
  (enemies never laugh at a player's death); `docs/research/mechanics.md` §22.7; `docs/api/game.md`;
  `docs/api/locals.md`.

## 2. The stag party and the beer bike

A stag party on a pedal beer bike rolls through the old centre (the city banned beer bikes from the
centre in 2017; ROBO-HALSEMA's rule book is a running joke). Look: matching bright party T-shirts,
shorts, sunburn; the **groom** in a pink tutu and a veil with an L-plate on his chest. Own designs,
not soldiers.

### 2.1 `stag-partier` (enemy, Creature, soft)

- Params: `groom` (bool), `look` 0–3, `gag`, `facing`, `from` / `enter` like the locals.
- HP 20 (groom 40); score 300 (groom 1000).
- Weapon: a fizzy-wine bottle that fires **corks**. Tell: he shakes the bottle for 24 ticks
  (foam, sfx `ams/cork-shake`, ≥ 18 ticks on screen), then fires one `cork` (the groom: 3 corks in
  a small spread). Recovery 50 ticks. Attack tokens as usual.
- `cork` projectile: straight, 2.2 px/tick × the difficulty shot speed, chest height (a crouch
  dodges a shot from a standing partier), kills like every hit, erased by POOF and HONK.
- Moves: walks 0.7 px/tick, keeps 100–160 px from the nearest player; closer than 48 px he steps
  back. Gags: `toast` (two partiers clink bottles), `selfie`.
- Death: he sits down hard, the bottle foams over; the groom's veil flies off. Bloodless.
- Gloat: group selfie (§1). Cower: pulls the T-shirt over his head.

### 2.2 `beer-bike` — the enemy vehicle

- A long wooden bar counter on four wheels with stools on both sides, a canopy roof and a tap in
  the middle; a sober driver in front steers. 2–4 partiers ride on the stools (child riders or
  hurt parts; each has the partier's HP and fires corks in turn, using attack tokens).
- Rolls at 0.6 px/tick, stops 140–200 px from the nearest player, rolls on when the players move
  ahead. The bike body is armoured against bullets (shots ping) but takes explosions and the knife:
  400 HP → it is wrecked (+2,000, an `m` explosion, keg debris).
- When every rider is down, the driver flees (`MIJN FIETS!`) and the bike rolls to a stop: it
  turns into the rideable vehicle `beer-bike` (empty, the `RIDE?` hint). So the players choose:
  shoot the riders off and ride it, or blow it up for points.

### 2.3 `beer-bike` — the rideable vehicle

- 3 cells; the vehicle rules of GDD §8.1 (mount, eject, cells, DANGER, doomed, ram, carry-over).
- Pedal drive: accel 0.08 to 1.4 px/tick, brake 0.12; a small hop (vy −2.6); no glide; it cannot
  swim: deep water destroys it at once (the pilot is thrown up, like a pit).
- Gun: the **cork cannon** on the roof (the tap turret): aims in steps from 0° to −90° like the
  Swan's neck; 10 dmg, speed 7, cooldown 6, unlimited.
- Bomb: the **keg roll** (shells: 10 at the start, +10 per bomb pickup): a keg rolls along the
  floor at 2.5 px/tick, drops down steps, explodes on contact or after 120 ticks (150 + splash
  r 24).
- Special (fire + bomb): **foam spray**: a short foam cone in front (64 px) that knocks soft
  enemies back 12 px and erases enemy shots; costs 3 shells, cooldown 240.
- Ram (fire + jump): the pilot jumps off, the bike rolls on at 3.0 px/tick and crashes
  (400 in r 40); the bike is lost.
- 2P: the bar counter is a one-way platform for the partner.
- Where it can go: the street sections. It never enters the canal stretches.

### 2.4 Placement (integrator)

- a: the shopping street after the PLEINTJE: a stag party on foot (3 + the groom), then the beer
  bike from the right (the first hijack). At FABEL FRIET the riders get off for the briefing and
  the bike stays in `a` (the baker: `GEEN BIERFIETSEN!`).
- b: stag partiers in the gull square; one more beer bike if the pacing allows.
- c2: a stag party on a small open party boat alongside the cruise (§4).

## 3. The parking scan car (mid-mission boss, section c)

- `ams-scan-car`: it must look like the real Amsterdam scan car (user request 2026-10-20, with a
  photo). The photo stays outside the repo: use it for the likeness only; never copy it, or any
  part of it, into `src/`, `public/`, `docs/` or `tests/`; all art is drawn by code. The look:
  - **Body:** a compact, tall white electric hatchback: a short sloping bonnet, a long raked
    windscreen, a high roof line, a short rear with a near-vertical tailgate; black plastic wheel
    arch edges and a black side sill; silver multi-spoke alloy wheels.
  - **Windows:** one continuous band of dark tinted glass from the windscreen pillar to the rear
    (black pillars, so the white roof seems to float); the band's lower edge rises to the rear; black
    mirrors; a parking permit behind the windscreen.
  - **Livery (the city of Amsterdam):** white body; red vertical bars (slightly slanted) on the lower
    doors (three on the doors, one on the front wing behind the front wheel); red slanted stripes
    across the bonnet; `PARKEERCONTROLE` in black capitals on the front door above the bars;
    `Gemeente Amsterdam` in red with the three red St Andrew's crosses (X X X) stacked vertically on
    the rear door; a small red city emblem near the rear wheel arch. At 1× the bars, the bonnet
    stripes and the X X X carry the read; the text is readable at 2× and 4×.
  - **Roof scanner:** a big white flat box with rounded corners on a black roof rack, overhanging the
    roof at the front and the back; dark smoked camera windows (two on the side, one at the front,
    one at the back); a dark seam line; the number `24` on the side.
  - **Front and rear:** slim swept-back LED headlights, a black grille with a thin chrome bar and a
    generic emblem (no car maker's logo or model badge), a fog lamp in the bumper, a yellow Dutch
    number plate with the blue EU strip and a made-up number (never the photo's number); red tail
    lights. Added for the game: orange hazard lights, and the handhaver at the wheel as a dark
    silhouette with his cap behind the windscreen.
  - **Scale:** heroes are about 36 px tall at 1×, so the car is about 80–90 px long, the body about
    26–28 px tall and about 36–38 px with the scanner box. The RAM must stay jumpable (its contact
    box is the body).
  - **Damage:** dents, scuffed red bars, cracked camera windows, the scanner box askew and then torn
    off (the `scanner` part broken), steam from the bonnet, hazard lights blinking.
- Arena: section c, the shop quay; a camera lock about 384 px wide (the integrator places it). The
  stage music plays on; no WARNING banner; the HUD boss bar shows its name (e.g. `SCANAUTO`).
- Intro: it drives in from the right, brakes, the roof scanner box lifts a little on its rack and
  its camera windows light up (60 ticks, invulnerable), bubble `KENTEKEN GESCAND.`
- Parts (normal HP; the Boss base scales by difficulty and co-op): `scanner` 400 (required;
  breaking it stops SCAN LOCK) and `body` 900 (required core). Target fight: 30–60 s for a human
  player with the pistol and grenades on normal.
- Attacks (every telegraph ≥ 18 ticks, `telegraphFor`):
  - **SCAN LOCK**: a red reticle follows the nearest player for 40 ticks, then freezes for 24
    ticks (blinks, `ams/scan-beep`); then a ticket printer shoots a fine strip at the frozen spot.
    Step away after the freeze.
  - **RAM**: it revs for 24 ticks (wheels spin, smoke, `ams/rev`), then drives across the arena at
    3 px/tick; its body hurts only during the ram; the car is low enough to jump over. It turns
    around at the far side.
  - **TOW CALL** (phase 2: the scanner is broken or the body is below 50 %): bubble
    `TAKELWAGEN!`; a tow truck (`ams-tow-truck`) backs in from the far side (reversing beeps ≥ 18
    ticks), its crane hook swings low (crouch or time a jump) and it drops 2 **wheel clamps**
    (`ams-wheel-clamp`) that hop towards the players. Stepping into an armed clamp gives the status
    `clamped` (45 ticks: the hero cannot walk or jump, can turn, aim, shoot and throw). A clamp
    breaks after 2 hits or a knife. The truck has 300 HP and leaves after 10 s or when broken.
- Death: the airbag pops (`AIRBAG!`), the car rolls onto its roof smoking, the driver crawls out
  and runs. Score 10,000. Drops: `pickup-repair` when a player rides a vehicle, else a weapon
  (H, R or L).
- The continue stagger works (Boss base). The bot must be able to win the fight.

## 4. The route choice and the canal cruise (c → c1 | c2 → d)

- **c AMSTEL** keeps the quay street, the canal with the houseboats and the shop quay, and adds the
  scan car arena at the end of the shop quay. When the scan car is down, two exits open with signs:
  `BRUG ↑` (up the ramp → `c1`) and `RONDVAART ↓` (down the jetty steps → `c2`).
- **c1 BRUG**: today's white Amstel bridge and the Blauwbrug to Waterlooplein (today's c from about
  x 1940, re-based), with its waves, its sack hostage and the last squad; exit → `d`.
- **c2 RONDVAART** (new): a canal cruise on the Amstel.
  - The players board a long, low tour boat with a glass roof (`ams-cruise-boat`, about 190 px:
    the deck and the roof are one-way platforms). The camera auto-scrolls with the boat
    (≈ 0.6 px/tick); the boat **stops for each wave** (the scroll pauses until the wave is
    cleared or a timeout). The view edges push the players.
  - On foot, falling into the water drowns (deep water). The Swan swims alongside.
  - Low bridges: the boat passes under bridge arches; a player standing on the roof must jump
    down or crouch (a readable warning: the bridge shows from the right ≥ 2 s before).
  - Set piece: the **Magere Brug** (the white wooden drawbridge with its lights) with handhavers
    and gulls on it; Carré on the bank.
  - Waves: gulls dive at the boat; handhavers on the quays and bridges throw tickets down; a stag
    party on a small open party boat alongside fires corks; a hostage on a passing houseboat.
  - The boat docks at the Waterlooplein jetty; exit → `d`.
- Hostages per route: the same total on both routes (MissionDef.hostages per section id; the
  tally already counts the route a slot took). Hidden captives (§5) count too.
- Both routes must be playable by the bot; the tests and sims cover both.

## 5. Secrets

- `ams-secret` (neutral entity, not an enemy, ignored by `waitClear`): a small shootable spot on a
  piece of decor. 1–3 hits, a knife or a blast reveal what it hides, with a sparkle and a sound;
  +100 points on the reveal. A subtle hint: a 1-px glint every few seconds.
- It hides a pickup (gem, medal, food, golden notes), the hidden `pickup-1up` (exactly one in
  ams), or a hidden tourist (who drops out tied to a chair and is freed as usual).
- At least 6 secrets in ams, at least one per section, e.g.: a crate on a gable hoist beam; a bike
  hanging in a tree; a houseboat roof hatch (hidden tourist); a museum crate `NIET OPENEN` in the
  Rijksmuseum passage (hidden tourist); the hot-dog stand's roof flag (the 1UP); a bike fished out
  of the canal; a flea-market chest in d.
- Hidden tourists count in MissionDef.hostages, so STANDING OVATION needs them.

## 6. Repair item and vehicle-state drops

- `pickup-repair` (+1 cell; exists in code) needs 2× / 4× art if it has none.
- While a player rides a vehicle with fewer than its max cells, the crate table and the
  breakables' food / gem rolls give `pickup-repair` instead in about 30 % of the rolls.
- Fixed sources: the scan car's drop (§3), one repair crate in c after the scan car, one in the
  flea market of d.

## 7. Bug fixes

1. ROBO-HALSEMA's adds always enter from the same side (`mayor.ts` `adds()`: the side flips every
   tick and every spawn tick is even). Flip the side only when an add spawns.
2. `Boss.stagger` freezes a running attack: a lash or slam box can stay hot for up to 60 ticks
   and the baked-in slam sound plays at the wrong time. A stagger must not leave a live attack:
   wait for the attack to end, or cancel it cleanly (no hit box, no late sound, glow reset).
3. The HUD special-ready gem never lights for the Swan's HONK: give the Swan a `specialReady`
   getter (HONK cooldown done and shells ≥ cost).
4. Riders over a canal fall out of the world without a splash: they fall in with `fx/splash`
   (no score unless a player's hit killed them).
5. A driven vehicle does not break a handhaver by contact (riders and gulls do): same rule.
6. A sack hostage cannot be freed from the Swan: a mounted player whose vehicle body touches a tied
   hostage frees it (user decision 2026-10-12: the Swan body counts as a touch).

## 8. Art, budgets, sound, text

- Every new sprite id has 1× art (the 64-colour palette) and 2× / 4× art from ONE density-generic
  drawer (PAL_HD, `src/game/art/hd/`), per `docs/ART_GUIDE.md` "UHD art": geometry is law; the
  outline rule A for things that move or can be hit, painted backgrounds without ink outlines.
  `defer: true` for rare strips (gloat, cower, deaths, reveals).
- Tier-4 working set: each section's `art` list holds only what that section draws; the 1P working
  set stays ≤ 256 MB (`DENSE_BUDGET_BYTES`) in every section, 2P no worse than today.
- Sound: synth recipes only (no new samples, no ElevenLabs). Each builder writes its own table file
  (`src/game/content/sfx/ams-<area>.ts`, already spread into `SFX`); new ids go into GDD §15.7 and
  `docs/api/sfx.md` (the integrator).
- Text: English with Dutch flavour; bubbles ≤ 24 characters per line, 2 lines.

## 9. Gates and baselines

- Before the wave (commit 59db3b9): 3,607 tests; sims (god, seed 1) ams 18,895 ticks, ams
  section d 12,372, m0 5,679, m2 31,036 (1 death).
- After: `npm run typecheck`; the full suite; sims: ams `--god --expect-complete` on both routes,
  ams sections c, c1, c2, d, and without god on normal (seeds 1–3); m0 and m2 byte-identical;
  `npx vite build`; `npm run smoke`; a 4K browser run of `?mission=ams&art=4`.

## 10. Bluetooth controllers (2 players)

The user plays with several Bluetooth controllers (PlayStation DualShock 4 / DualSense, Xbox
Wireless, Switch Pro / Joy-Con / 8BitDo and generic pads). Two players, each on their own pad; the
keyboard sets stay as they are. This applies to the whole game (menus, 2D missions, the
first-person mode), not only `ams`.

- **Claim a player.** In 2-player mode a pad claims a player slot when its owner presses START
  (or the south face button) on the mode select or the character select (`P1 PRESS START`,
  `P2 PRESS START`). In 1-player mode every pad drives player 1 (as today) until a second player
  joins.
- **Sticky slots.** A slot remembers its pad (`Gamepad.id` and index). A pad that drops out and
  reconnects (Bluetooth sleep) gets its own slot back; a reconnect never swaps the players. A
  third pad is ignored by play, but may still navigate menus.
- **Join at any time.** In a 1-player game, START on a free pad (or player 2's keyboard START)
  makes player 2 join: it costs a credit (free on FREE PLAY), player 2 drops in next to player 1
  with the next squad hero not in use, and the input, HUD, session and tier-4 working set switch to
  2 players. The P2 HUD corner blinks `PRESS START` while a free pad is connected. (GDD §4.9.)
- **Lost pad.** When the pad of a player in play disconnects (2D or first-person), the game pauses
  with `CONTROLLER 2 LOST` / `RECONNECT OR PRESS START`. The same pad reconnecting, or START on a
  free pad (which then takes the slot), resumes. The keyboard keeps working.
- **Mappings.** The standard mapping first (`Gamepad.mapping === 'standard'`). For a non-standard
  pad (common in Firefox and with some Bluetooth pads) a profile table keyed by the vendor and
  product ids in `Gamepad.id` (Sony 054c, Microsoft 045e, Nintendo 057e, 8BitDo 2dc8, …) remaps the
  buttons and reads the D-pad from a hat axis when the pad has one. Unknown pads use the standard
  indices; the CONTROLS screen can rebind them.
- **Positional default.** The gameplay buttons sit in the same physical place on every pad (south
  = jump, west = fire, the existing defaults decide the rest). Only the labels differ.
- **Labels.** Menus, the help text and the CONTROLS screen show each pad's own labels: PlayStation
  ✕ ○ □ △ (drawn glyphs), Xbox A B X Y, Nintendo B A Y X (Nintendo positions), generic pads by
  position.
- **Per-player pad maps.** CONTROLS has a P1 PAD and a P2 PAD page (rebind; stored in settings).
- **Rumble.** OPTIONS `RUMBLE` on / off (default on): a short, light rumble on the own pad for the
  player's death, a big explosion near the player, a boss part break and a vehicle hit, via
  `vibrationActuator` where the browser has it; ignored where not.
- **Menus.** Any pad navigates menus. In the 2-player character select each pad drives its own
  player's cursor.
- **Tests.** Unit tests with fake `Gamepad` objects (connect, disconnect, reconnect, 3 pads,
  non-standard profiles, the hat D-pad, sticky slots) and a browser test that injects fake pads
  (`navigator.getGamepads`) for: claiming P1 / P2, a mid-game join, the lost-pad pause and resume.
  Headless sims stay byte-identical.
- **Real devices.** The agents cannot pair real controllers. The report lists the exact checks for
  the user to do with real pads.
