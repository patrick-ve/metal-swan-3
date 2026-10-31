# Mission oat — level 2, OAT OF CONTROL: a day out in the old city (spec, 2026-10-31)

The user (2026-10-31), after eight proposal rounds (`docs/design/amsterdam-2/level-2.md`): "Build
the spec. Ensure that level 2 has high fidelity realism in the scenery." The squad, still on shore
leave after `ams`, spends a tourist day in the old centre of Amsterdam, from a morning in the
9 Straatjes to 03:00 in De Wallen. The city and its prices are the joke. The score of the whole
game becomes a **budget in euros**. After the boss a taxi races the squad out of the centre to
the A10, where the 3D race (`rally`, now level 3) begins.

This file is THE SPEC for the `oat` waves. Every *(user)* mark of the proposal is kept here as a
user decision. Detail values (speeds, HP, euros, sizes, timings, tones) are start values; the
builders may tune them when play or the frames show a better value, and the report says what
changed and why.

Inputs (read before building): `docs/design/amsterdam-2/level-2.md` (the approved proposal),
`brainstorm.md` §3 and `research.md` §7–§9 (rules, euro values, sensitivity, parody names), the
code map `tmp/oat/arch-map.md`, the art map `tmp/oat/art-map.md` (levers L1–L19, budgets, the
fidelity verdict of `ams`), the scenery research `tmp/oat/scenery-research.md` (sourced facts,
checklists, colour, proportion and light tables) and the reference photos in the git-ignored
`tmp/oat/ref/` (`LICENSES.md`: free licences, likeness only, never traced, never shipped).

Originality: `docs/ORIGINALITY.md` applies in full, with the new dated `oat` paragraph (§10). Never
name a commercial game, studio or artist in code, ids, comments, docs, prompts or commit messages.

## 0. Decisions

| # | Item | Decided by |
|---|---|---|
| 1 | New 2D mission `oat` **OAT OF CONTROL** = level 2 (`MISSION 2`), between `ams` and `rally` | user |
| 2 | Route: ams 1 → **oat 2** → rally 3 → fps-1/fps-2 4 → oldenzaal 5; the race moves to level 3 ("Level 3, after Amsterdam 2") | user |
| 3 | Story **een dag uit**: a tourist day that goes wrong, morning to night; no special goal; the squad is still on shore leave | user |
| 4 | Route **de binnenstad**, four sections and a boss, about the length of `ams` (12–15 min) | user |
| 5 | Opening: the mission card is **een toeristenfolder** with the day plan; generic city-marketing look, never the real city logo or slogan | user |
| 6 | a **DE 9 STRAATJES** (morning): boutiques with three items each and a €400 candle; statiegeld bins, the havermelk-bar, the hijsbalk, het draaiorgel; **De Makelaar** as the mini-boss | user |
| 7 | a: **de conceptstore**: one sock on a pedestal for €85; shoot the glass case: the sock is a weapon crate in disguise | user |
| 8 | b **FORT NEGEN & ZESTIG** (noon): the parody bakery and **DE RIJ** (camera lock; the queue steps forward every 5 s; line-cutters push you back a place); the blauwe envelop | user |
| 9 | b: **U BENT NUMMER 47**: a queue number counts down; each line-cutter the player stops moves them up one place | user |
| 10 | c **DE KADEMUUR** (afternoon): **the Swan returns**; an **auto-scroll chase** on the canal while the old quay wall crumbles behind; a closed bridge, pontoon bridges, a sinkhole that swallows a parked scan car | user |
| 11 | d **DE WALLEN BY NIGHT**: neon and closed curtains, narrow alleys, dealers, taxis, `BLOWVERBOD` signs, tour groups on bridges, the hijsbalk again; at **03:00 the neon goes out** and the boss lights up the house | user |
| 12 | d: **gids op de brug**: a tour group stops on a bridge and blocks the way; a handhaver fines the guide €190; the group moves on | user |
| 13 | Enemies: **brommobiel influencer** (`BRAMMOBIEL`), **bakfiets-ouder**, **aggressive taxi**, **Wallen dealer**, plus `handhaver`, `fatbike-youth`, `delivery-rider` from `ams`. Not here: the seagull, the levend standbeeld, the wafel-winkel, the auction | user |
| 14 | Mini-boss **De Makelaar** in a: `VERKOCHT` signs as cover, `+10%` paddles, `OVERBIEDEN!`, 1.5 % `COURTAGE` on every pickup while he lives (his fall returns it); **de bezichtiging** (about 20 viewers rush out of a door and push the player) | user |
| 15 | Boss **De Huisjesmelker** (the slumlord who milks a small house like a cow): **huurverhoging** (€1.900, €2.400, €3.100; faster each rise, drains a little budget), **de sleutelbos** (a key-ring flail, low then high), **schimmel** (mould spreads, the safe floor shrinks until the player hits him) | user |
| 16 | The €1.900 studio gag at the end of the fight: a freed tenant says `€1.900 PER MAAND` / `EN GEEN KEUKEN!`, a microwave dings | user |
| 17 | Ending: **a playable taxi ride**: a short rail shooter; the heroes lean out of the windows and shoot the handhavers and brommobielen that chase the taxi to the ring; then the MISSION 3 card and the existing glitch into 3D | user |
| 18 | **Real prices**: enemies pay €1–€25, cans €0,15, fines €95–€190, a flat white €4,45; every player starts with €100 | user |
| 19 | The budget is **game-wide from `ams` on**: in `ams` only the score changes (`BUDGET € 1.234,56`, enemies pay euros); the level stays as it is | user |
| 20 | **Statiegeld bins**: shoot a bin, it explodes or collapses, cans and bottles fly out, bounce, and are picked up (can €0,15, small bottle €0,15, big bottle €0,25) | user |
| 21 | **Havermelk-bar**: flat white (speed + fire rate), matcha (slow motion), €9 sourdough (full heal); +10 % per buy (`INFLATIE`) | user |
| 22 | **Blauwe envelop**: shoot it open: a refund (+€) or an assessment (−€); generic sender, never the real agency's logo | user |
| 23 | **Fines**: the `BOETE` hit still kills, and the death also costs a fine | user |
| 24 | **Toeristenbelasting**: each continue costs 12.5 % of the budget, rising to 20 % | user |
| 25 | **Below €0**: rood staan; the havermelk-bar refuses (`GEWEIGERD`) until the budget is above €0 again; the tally stamps `TEKORT` or `OVERSCHOT` | user |
| 26 | HUD: **the bank-app look**: `BUDGET € 1.234,56`, green above €0, red below, small `+€0,15` / `−€95` pop-ups | user |
| 27 | Tally: **de kassabon**: a long receipt with every can, coffee, fine and continue, then the total, stamped `OVERSCHOT` or `TEKORT` | user |
| 28 | Two players: **two budgets** (own fines, pickups, continue costs); the tally compares them | user |
| 29 | Music: **a day-to-night score**: a song per section (bright a, tense b, chase c, neon synth d) plus the boss song | user |
| 30 | Voices: **everybody speaks**: short Dutch ElevenLabs lines (designed voices) for De Makelaar, De Huisjesmelker, the taxi driver, the barista, the influencer, the bakfiets-ouder, the dealer and the queue; the bubbles stay | user |
| 31 | Rules: originality (parody brands, real places under the `ams` exception), behaviours not groups, sex workers never shown or targeted, deposit hunters never enemies, the gloat rule, every new attack has a tell ≥ 18 ticks on screen | user |
| 32 | **Realistic pixel art**: it stays pixel art; real proportions and gable types, 6–8 tones per material, real light per time of day, cast shadows, wear, reflections. Not painted backdrops, not near-photo (2026-10-31) | user |
| 33 | **Likeness = real streets, recognisable**: real street-name plates, the real gable mix, the Oude Kerk tower in d, real bridge shapes; NOT house by house | user |
| 34 | Top realism features: **light and shadow**, **water** (reflections, ripples, wakes, neon in water at night), **weather and wear** (wet cobbles, dirt, stickers, worn paint, quay-wall cracks). "Life" was not picked: background people stay modest | user |
| 35 | Reference photos: free-licence (Wikimedia) in the git-ignored `tmp/oat/ref/`, likeness only, never traced, never shipped | user |
| 36 | Scale **MIXED**: the ground-floor band at true scale (20 px/m: real doors, shop fronts, awnings, stoeps around the heroes), about half scale above it so the gables stay in view (§8.2) | user |
| 37 | The **sun stays LEFT** in every section (morning high-left, afternoon low-left), so the shadows of houses and heroes agree | user |
| 38 | **No ink outlines on façades and street props** (edges from light and colour); heroes, enemies and pickups keep their outlines | user |
| 39 | `ams` gets the same realism **later, as its own wave** (out of scope here; §12.5) | user |
| 40 | Every worker agent at effort **xhigh**, never max | user (standing rule) |
| 41 | Section ids `oat-a`, `oat-b`, `oat-c`, `oat-c1` (the chase), `oat-d` (with the boss arena), `oat-e` (the taxi ride). Bare `a`–`d` would share global light maps and fixtures with `ams` | lead |
| 42 | The boss arena sits **inside `oat-d`** (`bossStart`, `bossSection: 'oat-d'`): the 03:00 switch is a moment on screen, not a section cut; `bossSections: ['oat-a', 'oat-d']` times both fights for the speed bonus | lead |
| 43 | The chase is its own section `oat-c1` with `startVehicle: 'swan'`, `vehicles: ['swan']` and `ctx.autoScroll`; the crumbling wall reuses the `avalanche` pursuit pattern (m3-a) as a softer oat entity | lead |
| 44 | The taxi ride `oat-e` is a **scripted carrier** (the `ams` c2 cruise pattern: the taxi holds the camera, both heroes sit in its window seats, respawn in the seat), not `startVehicle` (that gives one taxi per player and a new taxi per respawn) and not the ring's `RingRunner` (its global hooks would put the ring sims at risk) | lead |
| 45 | The budget is a **new signed ledger in integer cents** per player, next to the old points (§7.1); Dutch notation `€ 1.234,56`; one `€` glyph in each 1× font | lead |
| 46 | Old point missions (the dormant `ring`, m0–m5) keep points and their old high-score table; the route missions (ams, oat, rally, fps, oldenzaal) pay euros; a new high-score key `budgets` | lead |
| 47 | The kassabon is **oat's own tally** (a new receipt scene); `ams` and `oldenzaal` keep the newspaper with euro lines; the run's final tally gets the `JAARREKENING` stamp (open question Q2) | lead |
| 48 | The `BOETE` fine and the toeristenbelasting are score rules, so they apply from `ams` on, like the euros (open question Q3) | lead |
| 49 | `oat` loads **lazily** with the MISSION 2 card (like the rally), and the art workers load it on demand; the boot stays as it is | lead |
| 50 | Scenery memory: `oat` declares a **dense reserve of 84 MB** inside the 256 MB tier-4 cap (oldenzaal style; §8.12) | lead |
| 51 | Palette: an additive **`PAL_HD_OAT`** (43 new colours + 4 spare, ≤ 47; set total ≤ 256), hand-built ramps; photo-measured hex values only guide them | lead |
| 52 | Light: **a sun per section** with cast shadows baked into the floor and the façades; the light pass moves to a neutral home with per-section flags (oldenzaal stays byte-identical); **smoothed glow** at 2× / 4× | lead |
| 53 | 03:00: **two bakes (lit / dark) for the boss arena only**, with a 60-tick cross-fade, prefetched from the checkpoint before it (+11 MB, inside the reserve); fallback: runtime darkening with the neon spill drawn as light-pass glows (§8.9) | lead |
| 54 | Water reflections and light streaks are **Canvas 2D overlays** after the floor band; the GL floor shader stays texture-only (§8.8) | lead |
| 55 | Façades come from a **façade grammar** (real gable, window and door types) and are **streamed as strips** (L7 + L8), so no house repeats | lead |
| 56 | Tiers: design and review at 4× and 2×; the **look stop is judged at 4×**; 1× is the automatic snapped version with a readability check | lead |
| 57 | Time of year: **a late-September day** (sunset 19:39): green elms with the first yellow leaves, a real dark night for d, and a low afternoon sun that is compass-true for c (open question Q4) | lead |
| 58 | Three build waves with **one user look stop after wave A** (the first scenery: all of oat-a and a night proof strip of oat-d) | lead |
| 59 | No hostages in `oat` (`hostages: {}`, as oldenzaal); one golden record in oat-a; no secrets in this build | lead |
| 60 | Shootable street props (bins, the glass case, the hoist rope and load, the envelope, `VERKOCHT` signs) keep the ink outline: what can be hit has an edge (readability rule); static props have none | lead |
| 61 | The rally card's first line becomes `TAXI PAID. NOW THE SQUAD RACES DE RINGRALLY: THREE LAPS OF THE A10.`; its announce `MISSION THREE. VOL GAS!`; oldenzaal's `MISSIE VIJF. BLIJF BIJ ELKAAR, ZWAANTJES!` (new takes) | lead |

Scope: the new mission `oat`, the route switch, the game-wide budget and the engine opt-ins the
scenery needs. `ams` keeps its level content; `oldenzaal`, the fps floors and the rally keep
their play. The dormant `ring` and m0, m2 keep their sims byte-identical; which baselines move
and why is in §7.10.

## 1. Flow and numbering

`ams` boss → the `ams` MISSION COMPLETE tally (the newspaper, euro lines) → **the MISSION 2 card:
the toeristenfolder** (Gusto voices the briefing; the oat chunk loads meanwhile) → `oat-a` …
`oat-d` (the boss) → `oat-e` (the taxi ride) → **the kassabon** → the MISSION 3 card (`BINNEN DE
RING`) → the glitch into 3D (`rally-glitch.ts`, unchanged) → the race → the glitch bridge → fps-1,
fps-2 (MISSION 4) → the story card → MISSION 5 `oldenzaal` → … → the final tally (`JAARREKENING`)
→ name entry.

- `FPS_ROUTE = ['ams', 'oat', RALLY_ID, 'fps-1', 'fps-2', OLDENZAAL_ID]`. `routeNumber` then gives
  ams 1, oat 2, rally 3, fps 4, oldenzaal 5; the high-score columns `M1`, `M2` (oat), `M3`
  (rally), `F1`/`F2`, `M5`. `missionLabel` never reaches 6 (`FINAL MISSION`).
- `ams.next = 'oat'`, `oat.next = 'rally'`: the rally card and its glitch work as they are.
- **The m5 trap.** `listMissions()` sorts ids: `ams, m0…m5, oat, oldenzaal`, so `m5.nextMission()`
  would name `oat` once oat is loaded. `missionDone` (`flow.ts:60-69`) gets a general guard: a
  mission on `FPS_ROUTE` is opened only from its route predecessor (it covers `oat` and
  `oldenzaal`; the test `tests/game/oldenzaal-flow.test.ts:221` moves to the new rule).
- `missionDone` opens the oat card by id (like `rally`): oat is lazy, so it is not registered
  when `ams` ends.
- `goldenRecordRoute` switches to `FPS_ROUTE` also once the campaign played `oat`; ALL GOLDEN
  RECORDS needs oat's record (§2.1).
- URL: `?mission=oat` (direct start, no card), `section=oat-a … oat-e`, `boss=1` (the Huisjesmelker
  arena; with `section=oat-a` the Makelaar arena, since `bossRush` uses the section's
  `bossStart`), `players`, `char`, `god`, `debug`, `art`, `res`, `difficulty` as today.
- The section start banner shows the place and the clock: `DE 9 STRAATJES - 09:30`,
  `FORT NEGEN & ZESTIG - 12:30`, `DE KADEMUUR - 17:15`, `DE WALLEN - 22:30`, `NAAR DE RING - 03:20`.

### 1.1 The card: the toeristenfolder

- An additive `MissionCard.look?: 'folder'` (`flow-data.ts:19-41`): `MissionIntroScene` draws the
  folder instead of the line map; the radio box and Gusto's voice stay; other cards are unchanged.
- A glossy tri-fold leaflet: the generic headline `ONTDEK DE BINNENSTAD!`, four panels of our own
  pixel illustrations with times (`09:30 DE 9 STRAATJES`, `12:30 FORT NEGEN & ZESTIG`, `17:15 DE
  GRACHTEN`, `22:30 DE WALLEN`) and small icons. Never the real city logo, letters or slogan.
- Text (English): label `MISSION 2`, name `OAT OF CONTROL`, place `AMSTERDAM, DE BINNENSTAD - 0930
  HOURS`, briefing `SHORE LEAVE, DAY TWO: A DAY OUT IN THE OLD CITY.` / `EVERY CYGNET GETS 100
  EURO. AMSTERDAM IS NOT CHEAP. GO!`, headline (required, unused in oat) `SQUAD SURVIVES A DAY OUT!
  THE BANK ACCOUNT DOES NOT.`, announce `MISSIE TWEE. HOU JE PORTEMONNEE VAST!`.

### 1.2 The way out

After the boss and the tenant gag, the taxi screeches onto the square; the driver: `INSTAPPEN! DE
METER` / `LOOPT AL!`. The boarding waits until every living hero is in a seat (at most 7 s, as
the c2 cruise). The ride ends under the `A10` gantry with `missionComplete()`; the fare is the
last ledger line of the kassabon. The rally card then reads `TAXI PAID. NOW THE SQUAD RACES DE
RINGRALLY: THREE LAPS OF THE A10.` (decision 61).

## 2. The sections

Ground: walk line `G` = 176, the view 384 × 216, the heroes 36 px (1.8 m: 20 px/m). Scroll right
everywhere. Checkpoints at most 1,400 px apart (copy the oldenzaal mission test). `timeLimit` 60
counts (one count = 256 ticks) unless a row says otherwise. 2P co-op everywhere; the in-world
continue applies (gloat, cower, stagger).

| Section | Place (real) | Clock | Width | Time | Song |
|---|---|---|---|---|---|
| `oat-a` | Prinsengracht → Berenstraat → Keizersgracht → Wolvenstraat → Herengracht → Oude Spiegelstraat → Singel | 09:30 | 4,608 | ~3:30 | `oat-a`; Makelaar `oat-boss` (part A) |
| `oat-b` | Keizersgracht → Huidenstraat (the bakery on an invented corner) | 12:30 | 2,816 | ~2:30 | `oat-b` |
| `oat-c` | Grimburgwal, the south quay | 17:15 | 2,048 | ~1:15 | `oat-c` (part A) |
| `oat-c1` | Grimburgwal, on the water (the chase) | 17:30 → 18:00 | 4,096 | ~1:00 | `oat-c` (part B) |
| `oat-d` | Oudezijds Achterburgwal → Trompettersteeg → Oudezijds Voorburgwal → Oudekerksplein | 22:30 → 03:00 | 4,352 | ~3:00 + boss ~1:15 | `oat-d`; boss `oat-boss` (part B) |
| `oat-e` | Warmoesstraat → Prins Hendrikkade → IJtunnel → the A10 ramp | 03:20 → 04:30 | 6,144 | ~1:10 | `oat-c` (part B, the chase) |

The real places are recognisable by typology, street plates, bridge shapes and landmarks; the
houses are generated (§8.6), never copied house by house. Distances along the street are
compressed (a real street of 150–200 m is about 1,000 px here); heights and objects in the ground
band are true scale (§8.2).

### 2.1 `oat-a` DE 9 STRAATJES — morning, 4,608 px

Camera: `yh` 60, `f` 210; façades at 16 px behind the feet (back edge y 160); house stretches with
a narrow pavement, the far kerb, the one-way clinker street (no bike lane: the real narrow streets
have none), the near kerb and front row. At each canal a bridge deck over water (the canal recedes
into depth under it: a canal vista layer).

| x | Content |
|---|---|
| 0–320 | Prinsengracht west quay; the far bank across the canal, the Westertoren above the roofs at the far left; the squad walks in; a statiegeld bin on a pavement bulb at 240 (the lesson: pointer `SCHIET!`) |
| 320–544 | bridge 65 (Berensluis) over the Prinsengracht: brick arch, hump +12, green railings, oxblood lantern posts, bikes on the railings; morning mist over the water (thin) |
| 544–1,568 | **BERENSTRAAT** (8.3 m): boutiques (three items each; a `€ 400` candle in one window); **DE HAVERBAR** window at 704–768 (the shop lesson, §6.2); delivery riders both ways; a fatbike youth at 1,000; a handhaver at 1,100; bins at 900 and 1,400; hanging signs, span-wire lamps; checkpoint 1,200 |
| 1,568–1,792 | bridge 48 over the Keizersgracht (the widest canal): a tour boat passes in depth; **the BRAMMOBIEL lesson**: it drives up the bridge and parks across the far foot (1,760) as a solid block |
| 1,792–2,816 | **WOLVENSTRAAT** (8.2 m): **de conceptstore** at 1,900–1,964 (§6.6); **LOCK 1** 2,048–2,432 with **the hijsbalk** at 2,240 (a piano over the lock; §6.4): a bakfiets-ouder (the lesson: flank or jump-shoot), 2 delivery riders, a fatbike youth; the **golden record** rides on the hanging piano and lands with it (2,240; picked up from the piano's top); checkpoint 2,560 |
| 2,816–3,040 | bridge 25 over the Herengracht; a bakfiets-ouder charges over the hump |
| 3,040–4,096 | **OUDE SPIEGELSTRAAT** (6.6 m: narrower, deeper shade): **LOCK 2** 3,200–3,584 with **het draaiorgel** at 3,330 (§6.5): the organ starts when the second wave enters, every enemy sways 240 ticks (`SCHIET NU!`); a handhaver pair; a brammobiel; bins; checkpoint 3,700 |
| 4,096–4,608 | **THE SINGEL**: the open quay, the canal behind with houseboats; the canal house `TE KOOP` (a wide 18th-century cornice house with a double stoep) at 4,352–4,480; **LOCK 4,224–4,608: DE MAKELAAR** (`bossStart` x 4,250; §4); then `exitTo('oat-b')` |

Checkpoints: 0, 1,200, 2,560, 3,700, 4,250. Cast: delivery rider, fatbike youth, handhaver,
brammobiel, bakfiets-ouder.

### 2.2 `oat-b` FORT NEGEN & ZESTIG — noon, 2,816 px

Camera as a. The real bakery the parody plays on is elsewhere in the city; here the corner, the
shop and the staff are invented and friendly; the joke is the queue.

| x | Content |
|---|---|
| 0–640 | Keizersgracht east quay at the Huidenstraat corner (open quay, the canal behind): a brammobiel and a bakfiets-ouder as normal enemies first; **the blauwe envelop** floats in for the first time at ~500 (hint `SCHIET HEM OPEN?`) |
| 640–1,344 | **HUIDENSTRAAT**: the queue's tail starts: about 30 people pressed along the shop windows, belt barriers on posts, a `RIJ BEGINT HIER` stand (one `oat-queue` entity draws them all, §6.7); a bin; a handhaver; checkpoint 900 |
| 1,344–1,728 | **DE RIJ** (camera lock; §6.7): the corner bakery `FORT NEGEN & ZESTIG` at 1,600–1,728 (door at 1,680); `U BENT NUMMER 47`; line-cutters; one blauwe envelop at ~20 s; the timer pauses |
| 1,728–2,816 | the Huidenstraat to the Herengracht: a fight with the reward (or the `UITVERKOCHT` mood); a statiegeld bin; a taxi tease (it passes at the crossing, `TE KORT!`); exit → `oat-c` at 2,780; checkpoint 2,200 |

Checkpoints: 0, 900, 1,344, 2,200. Cast: brammobiel, bakfiets-ouder (both also as line-cutters),
handhaver, delivery rider.

### 2.3 `oat-c` DE KADEMUUR (on foot) — afternoon, 2,048 px

Camera: back edge y 146 (open quay): our south quay is the walk plane, the canal lies behind the
coping, the north bank (its old quay wall and south-facing houses) is the layer behind it. The
low sun from the left throws our own row's shadow over our quay, the water, the far wall and the
far ground floors; the upper storeys across the water glow orange (§8.7).

| x | Content |
|---|---|
| 0–512 | the Grimburgwal south quay from the Rokin end: **DE HAVERBAR kiosk** at 320 (the INFLATIE prices carry over from a); **the taxi lesson**: door swing, ram, `TE KORT!`, the fare billed if it leaves alive |
| 512–1,280 | temporary works on our quay: mesh fences on concrete feet (cover and low platforms), sheet-pile boxes in the water behind, a work boat; **LOCK 768–1,152**: 2 taxis (one after the other), handhavers, a bakfiets-ouder, a delivery rider |
| 1,280–1,664 | a statiegeld bin, the blauwe envelop; a crack runs along the far coping (the first sign); checkpoint 1,300 |
| 1,664–2,048 | the jetty: our paving cracks (`DE KADE ZAKT!`); **the Swan returns**: she glides in over the far roofs, lands at the jetty (2P: the Mute follows); the boarding (input lock ≤ 7 s, the heroes jump on); `exitTo('oat-c1')` |

Checkpoints: 0, 1,300. Cast: taxi, handhaver, bakfiets-ouder, delivery rider.

### 2.4 `oat-c1` the chase — afternoon to golden hour, 4,096 px, auto-scroll

`startVehicle: 'swan'` (P2: the Mute), `vehicles: ['swan']`; water over the whole floor band; the
north quay wall at the back edge (y 146) with its houses behind; the near coping at the screen
bottom. `ctx.autoScroll(1.0)` from the start, `1.2` from x 2,048 (about 56 s in all). The timer is
paused. The collapse front (§6.10) rolls in from the left.

| x | Content |
|---|---|
| 0–256 | banner `DE KADE BEZWIJKT!`; the collapse front enters at the view's left |
| 256–1,024 | open water; bricks and paving slabs fall from the far wall as the front passes; a small electric work boat (low: hop over); a houseboat moored at the far side |
| 1,024–1,280 | **pontoon bridge 1**: a temporary steel pontoon across the canal, 6 px above the water: hop over (on foot: a platform); a handhaver on it throws tickets |
| 1,280–2,048 | the work-boat crane swings a steel pipe low over the water (tell: warning beeps and the pipe's shadow, 30 ticks: duck or time it); floating steel pipes (booms) as low obstacles |
| 2,048–2,304 | **the closed bridge** (`BRUG AFGESLOTEN`: barrier boards on the deck, a work platform under the arch): pass only low (down: the Swan squats and the rider ducks; `BUKKEN!`, the c2 low-bridge rule: a standing rider is hit only after 2 s in view); a handhaver on the deck throws tickets down |
| 2,304–2,560 | **pontoon bridge 2** beside it |
| 2,560–3,584 | **the sinkhole**: on the far quay a parked scan car (`SCANAUTO`, its roof scanner turning) tilts as the paving opens and slides into the canal ahead of the Swan (tell: the crack, the tilt, 60 ticks); it floats for 4 s as a platform, then sinks; a last handhaver |
| 3,584–4,096 | the meeting of the three canals: the step-gabled corner house; the front stops at its `stopX` (3,600: a stone abutment holds); the Swan swims to a jetty; exit → `oat-d` (the Swan stays behind: d lists no `vehicles`) |

Checkpoints (respawn on a new Swan): 0, 1,280, 2,560, 3,584.

### 2.5 `oat-d` DE WALLEN BY NIGHT — 22:30 → 03:00, 4,352 px

Camera: quay stretches with **our row behind** (back edge y 160: bar fronts, window frames with
closed curtains and red tubes, doorways), the quay street at the walk line, and **the canal in
front** (the near coping at about y 192, water to the screen bottom: the façades, the lanterns and
the neon reflect in it). The alley: back edge y 170 (the far wall 1–1.4 m behind the heroes). The
square: back edge y 150.

| x | Content |
|---|---|
| 0–1,280 | **OUDEZIJDS ACHTERBURGWAL** (west quay, 22:30): bars with neon (our own words: `BAR`, `SNACKS`, `KOFFIE`), window frames with closed curtains and red tubes (no figures), doorways; **the dealer lesson** (`COKE? XTC?`, the pickpocket, shoot him before he escapes); handhavers; a fatbike youth; delivery riders; `BLOWVERBOD` signs on poles at the alley mouths; broken bins; checkpoint 1,200 |
| 1,280–1,664 | **GIDS OP DE BRUG** at the bridge (22:45; §6.8): a tour group of about 12 crowds the bridge head and the quay (a body wall); **camera lock** 1,280–1,664 with a dealer wave; a handhaver fines the guide `€190`; the group crosses the bridge toward the camera (a cosmetic depth walk) and the lock opens |
| 1,664–2,432 | **TROMPETTERSTEEG** (00:30; 1.0–1.4 m wide, compressed to 768 px): plain brick walls close behind, white-framed windows of small business spaces, a tagged roller shutter (invented tags), a wall lamp, the central gutter; **the hijsbalk** at 2,000 (a sofa over a dealer group); a dealer ambush from a door; no vehicles; checkpoint 2,400 |
| 2,432–3,584 | **OUDEZIJDS VOORBURGWAL** (wider canal; 02:00): the **Oude Kerk tower** floodlit above the roofs, closer step by step; at 02:00 `DE BARS SLUITEN`: roller shutters come down one by one (lamp groups off), terraces stacked, the crowd thins; taxis on the quay; dealers; handhavers; a bin; the blauwe envelop; checkpoint 3,500 |
| 3,584–4,352 | **OUDEKERKSPLEIN** (03:00): the square at the church's flank; the boss's house (a narrow, crooked house, `TE HUUR` signs; invented, no real address); **the carillon strikes three, the neon goes out** (§6.9); **LOCK 3,968–4,352: DE HUISJESMELKER** (`bossStart` x 3,990; §5); after the fight the tenant gag, the taxi arrives, exit → `oat-e` |

Checkpoints: 0, 1,200, 2,400, 3,500, 3,990. Cast: dealer, taxi, handhaver, fatbike youth,
delivery rider. Respect: the Oude Kerk is backdrop only; shots never mark it, nothing mocks it.

### 2.6 `oat-e` DE TAXIRIT — 03:20 → 04:30, 6,144 px

The carrier `oat-taxi-ride` holds the camera (no auto-scroll): 2.0 px/tick, up to 3.0 on the open
stretches, down to 1.0 while a wave lives (at most 15 s per wave, the c2 rule). The heroes sit in
the near-side window seats (P1 rear, P2 front passenger) and aim from the windows (§6.11). The
timer is paused. Camera: `yh` 64, `f` 200, back edge y 156 (the road).

| x | Content |
|---|---|
| 0–256 | the boarding at the square's edge (`INSTAPPEN!`); the meter starts (`€ 4,00`) |
| 256–2,048 | **PRINS HENDRIKKADE**: the taxi races east; the station's long façade far behind across the water (floodlit); 2 handhaver scooters from behind; a delivery rider |
| 2,048–2,560 | a red light: the taxi runs it (`ROOD? DAT IS MEER` / `EEN ADVIES.`); **a BRAMMOBIEL** pulls alongside, flashes its ring light at the windows, falls behind (`WACHT NOU!`) |
| 2,560–4,608 | **THE IJTUNNEL**: tunnel lamps pass in bands (light pass; no strobe, ≤ 2 bands per second); scooters with headlights (entity lights) throw tickets in the dark |
| 4,608–6,144 | **the A10 ramp**: the sky still dark, the orange glow of the motorway lights; the last wave (scooters + a brammobiel); the `A10` gantry and an S-exit sign in our lettering; the meter stops at about `€ 87,50`; `missionComplete()` |

Checkpoints (respawn in the seat): 0, 1,300, 2,600, 3,900, 5,200.

## 3. Enemies

Common rules: one-hit kills for the heroes; tells ≥ 18 ticks while on screen (`telegraphTicks`),
attack tokens, only the attack box kills; every enemy has `gloat` (own business at the spot: never
a laugh, a point, a cheer or a phone filming) and `cower` strips; `onRemove` without a death is the
"escaped" hook. Mixed look pools for every human enemy; the joke is the behaviour. Sizes at true
scale (§8.2).

### `oat-brammobiel` — the brommobiel influencer (HP 60, hard, € 15,00)
- A 45 km/h cube micro-car (`BRAMMOBIEL` on the door, our lettering; 48 × 30 px), pastel paint, a
  ring light and a phone on a gimbal on the dash. Drives in at 1.6 px/tick and parks across the
  pavement as a `SolidBox` (jump on it, over it, or wreck it).
- TELL 30: the ring light brightens in 3 steps, `KLIK`, `LIVE!`; ATTACK 8: a white cone 96 px ahead
  at body height (the kill box; peak alpha 0.6, never a full-screen flash, ≤ 1 flash per second);
  RECOVER 60.
- `cutter: true` (b): she gets out and walks the queue to the door, filming herself (`HOI LIEVE
  VOLGERS!`). `chase: true` (e): she drives beside the taxi, flashes at the windows, falls behind.
- Wreck: smoke, popped doors, she runs off (`MIJN CONTENT!`), 4–6 `SPONSORDEAL` coins (€ 0,50).
  Gloat: she fixes her hair in the phone's mirror, the ring light off.

### `oat-bakfiets` — the bakfiets-ouder (HP 40 parent, € 12,00)
- An e-cargo bike (52 px) with a wooden box and rain canopy (30 px tall), two toddlers inside, the
  parent behind (head and shoulders above the canopy). The box covers the standing shot line: hit
  the parent by a jump-shot, a 45° shot from close, or from behind.
- TELL 24: the bell, a forward lean, `AAN DE KANT!`; ATTACK: a charge at 2.2 px/tick for up to
  160 px (contact kills; jump it); then on, and 50 % turn for one more pass.
- **The box is a shield**: the kids are never hurt; a shot into it costs **€ 1,00 `LAKSCHADE`**
  (≤ 1 per 15 ticks per player). The kids lob harmless rice cakes (`TOK`). `cutter: true` (b).
- Defeat: the parent pushes the bike off (`IK BEL DE CRECHE!`), the kids wave. Gloat: rice cakes.

### `oat-taxi` — the aggressive taxi (HP 120, hard, € 25,00)
- A long dark estate (96 × 30 px), a generic `TAXI` roof sign with a meter display that ticks
  (`oat/meter` every 30 ticks) while on screen; near a hero: `TE KORT!`.
- DOOR SWING: TELL 24 (it slows, the handle wiggles), ATTACK 10 (a box shin to chest; jump it).
  RAM: TELL 30 (revs, two headlight flashes), a 60 px lunge at 3 px/tick.
- **Left alive** (`onRemove`): **€ 12,50 `RITPRIJS`** to the nearest living player. Wreck: the
  driver runs off, the meter spins away. Gloat: he counts change, the meter stops.

### `oat-dealer` — the Wallen dealer (HP 10, soft, € 5,00 + the money back)
- Hood up in a dark doorway. Never shoots. TELL ≥ 24: he sidles up with an open hand, `COKE? XTC?`
  or `PSST. VRIEND.`; the theft box is live after 20 ticks of reaching. Contact = **pickpocket**:
  10 % of a positive budget (min € 5, max € 50; at ≤ € 0 `NIKS TE HALEN`), `DANKJEWEL!`, then he
  runs for a door or the view edge (4 s).
- Shot in time: a `PORTEMONNEE` pickup with the stolen amount (`OKE, OKE, TERUG!`); escaped: gone
  (`ZAKKENROLLER`). His "pills" are mints (`PEPERMUNT`, € 0, `NEP!`). Gloat: he counts notes.

### Reused, and one new mount
- `handhaver` € 6,00 (its `BOETE` death costs the fine, §7.3); `fatbike-youth` € 6,00 (pair
  € 10,00; a and d only, §8.12); `delivery-rider` € 4,00. Code and art unchanged.
- `oat-handhaver-scooter` (e only; HP 30, € 8,00): the handhaver's upper body on a white e-scooter
  beside the taxi; TELL 24 (raises the ticket book), a `boete-ticket` at the window seats (duck
  into the car). Wreck: he skids off waving the book.

## 4. Mini-boss: De Makelaar (`oat-makelaar`, end of `oat-a`)

- Our own design (no real agent or agency): a sharp slim suit, open collar, a lanyard with a key,
  slicked hair, a tablet; about 40 px tall; the `TE KOOP` house behind him (`VRAAGPRIJS OP
  AANVRAAG`, no site name). `bossIntro('DE MAKELAAR', { subtitle: 'MINI-BOSS', music: 'oat-boss'
  })` (part A); HP 900 (pistol units ×10); about 45–60 s; € 150,00 plus the courtage pile.
- **COURTAGE** from the intro to his fall: 1.5 % of every euro any player picks up flows to his
  briefcase (a thin coin trail; `COURTAGE € 1,23` under the boss bar; milli-cents, §7.1); his fall
  returns each player's pile (`COURTAGE TERUG`).
- Phase 1 `VERKOCHT` (100 → 60 %): he plants `VERKOCHT O.V.` signs (shootable cover, 40 HP, ≤ 3,
  € 1,00 each) and hides behind them; the paddle throw: TELL 24 (a `+10%` paddle raised,
  `OVERBIEDEN!`), an arc with one bounce.
- Phase 2 **de bezichtiging** (60 → 30 %): TELL 40 (the door bell `DING DONG`, `DE BEZICHTIGING
  IS` / `GEOPEND!`, a dust line in the doorway), then **about 20 viewers rush out** (one
  `oat-viewers` entity with 20 bodies): harmless, they push a hero along the street (a short
  no-control hop, the `ring-push` model) and go back in after 6 s; the heroes jump on their heads
  or ride the push; he throws paddles from the stoep.
- Phase 3 `BIEDEN!` (30 → 0 %): faster; the sign sweep (TELL 26: he swings a `TE KOOP` sign back;
  a low sweep, jump it) and a fan of 3 paddles (TELL 24).
- Fall: he stumbles into his own signs, the tablet cracks, the coins rain back, he slinks off down
  the quay (bloodless); a weapon drop. Continue: he staggers, the viewers cower. Lines in §9.2.

## 5. Boss: De Huisjesmelker (`oat-huisjesmelker`, the `oat-d` arena)

- Our own design (no real landlord): a heavy man in a long fur-collared coat, rings, a milking
  stool and a bucket; beside him his small "house", a doll-size canal house on four short pipes
  whose gutter spouts he milks like udders (rent coins clink into the bucket). About 56 px tall.
- The arena: lock 3,968–4,352 on the Oudekerksplein, his narrow crooked house behind
  (grammar-made, a `TE HUUR` banner, a big rent board on the first floor). After the 03:00 switch
  (§6.9) his windows light up one by one, then `bossIntro('DE HUISJESMELKER', { music: 'oat-boss'
  })` (part B). HP 1,800; about 60–90 s; € 250,00 as `BORG TERUG`.
- Parts: `body` (required 1,800), `keys` (optional 300: broken = no flail for 600 ticks, then a
  `RESERVESLEUTEL`), `sign` (the rent board, optional 200: broken = the next rise drains nothing).
- **Huurverhoging** at each phase start (TELL 40: the board's digits spin, `HUURVERHOGING!`):
  **€1.900** (phase 1), **€2.400** (at 66 %), **€3.100** (at 33 %); each rise makes him 15 % faster
  (tells never below 18 ticks) and drains every living player **€ 19,00 / € 24,00 / € 31,00** (1 %
  of the new rent).
- **De sleutelbos** (every phase): a giant key ring on a chain. LOW: TELL 26 (he crouches, the keys
  glint at knee height, a low rattle), a floor sweep (jump). HIGH: TELL 26 (he rears up, keys at
  head height, a high jingle), a head-height sweep (crouch). Phase 1 singles, phase 2 low-high
  pairs, phase 3 low-high-low.
- **Schimmel** (from phase 2): he sprays black mould from a plant mister on his walls and the
  street: a floor hazard that spreads from both arena edges, 8 px per step, each step told 30
  ticks ahead (the edge swells and puffs spores); every 40 HP of damage pushes both edges back
  8 px; the safe floor never shrinks below 112 px; contact kills; it retreats at his fall.
- Fall: the keys scatter, the board drops to `€ 0,-`, he flees into his house and the door jams; a
  tenant opens the studio door: `€1.900 PER MAAND` / `EN GEEN KEUKEN!`; a microwave dings in the
  hallway. Continue: he staggers; the mould stops for 120 ticks.

## 6. Set pieces and mechanics

### 6.1 Statiegeld bins (`oat-bin`)
- The city's 100 L and 200 L street bins (true scale 20 / 24 px; dark grey, our own city mark,
  never the real arms as a logo) on pavement bulbs in the walk plane. HP 30. Shot: it bursts (100
  L) or tips and spills (200 L): 4–8 pickups fly out (gameplay rng inside the entity), bounce and
  settle: `oat-can` (+€ 0,15), `oat-bottle-s` (+€ 0,15), `oat-bottle-l` (+€ 0,25). They blink at
  120 and vanish at 720 ticks (the dropped-pickup rule); at most 24 cans alive (the oldest goes).
- Pop-ups within 30 ticks merge (`+€0,45`). The kassabon groups them (`STATIEGELD 37X € 5,55`).
- Deposit hunters are never enemies or targets. No gulls or rats take the cans in this build.

### 6.2 DE HAVERBAR (the havermelk-bar shop; a and c)
- A coffee window with a friendly barista. Three goods stand on the counter as priced pickups;
  stand on one for 20 ticks (`PINNEN...`) to buy it: **FLAT WHITE € 4,45** (speed ×1.2, fire rate
  ×1.3, 20 s); **MATCHA € 5,20** (`MATCHA-MOMENT`: for 6 s every non-player entity and enemy shot
  steps on even ticks only: an additive runner opt-in `slowWorld(ticks)` with a fixed pattern, so
  it stays deterministic); **ZUURDESEM € 9,00** ("full heal" in a one-hit game: one hit absorbed,
  `KRUIM!`, no time limit, never stacked).
- **INFLATIE**: each buy raises that item's price for that player by 10 % (rounded to € 0,05); c's
  kiosk shows the same prices. **GEWEIGERD** when the price is above the budget or the budget is
  ≤ € 0 (a red beep); it serves again above € 0. No shop at night.

### 6.3 The blauwe envelop (`oat-envelope`)
- A blue envelope with `DE FISCUS` in our lettering (no logo, no real window design) floats in on
  a slow sine path (b's queue first, then once in b's end, c and d). Not shot: it floats away.
- Shot open: **TERUGGAAF** (60 %): +€ 12,00 … +€ 85,00, or **AANSLAG** (40 %): −€ 25,00 …
  −€ 120,00; gameplay rng at spawn, inside the entity. A paper burst, `TERUGGAAF!` / `AANSLAG!`.

### 6.4 The hijsbalk (`oat-hoist`; a and d)
- A hoist beam in a gable (a real feature: warehouses and narrow houses) with a rope, a hook and a
  load (a piano in a, a sofa in d) that sways. Shoot the rope (2 hits; it frays visibly) and the
  load falls. It crushes enemies under it (bloodless: they flatten and wobble off); a hero under it
  is pushed aside, never killed. The load stays as a platform (the piano plays a chord on impact).

### 6.5 Het draaiorgel (`oat-street-organ`; a, once)
- A street organ with its grinder (friendly NPC). Scripted at lock 2: when the second wave enters,
  the organ plays an 8 s waltz of our own; every enemy on screen stops and sways for 240 ticks
  (their attacks pause, tokens released); `SCHIET NU!`. The section song ducks under it.

### 6.6 De conceptstore (`oat-conceptstore`; a)
- A white minimal shop front (`MINDER` on the glass; our name) with one item on a plinth: a single
  sock, `€ 85,00`. Shoot the glass case (40 HP; it cracks in 2 steps, then shatters): the "sock"
  is a weapon crate in disguise (a shotgun or a machine gun). The empty plinth stays.

### 6.7 DE RIJ and U BENT NUMMER 47 (`oat-queue`; b)
- Banner `DE RIJ`; screen-space text (`DrawOpts.screen`): `U BENT NUMMER 47`, `NU: 38`, `NOG 6
  KAASBRIOCHES`. One entity draws the ~30 queue people (friendly; shots pass). The timer pauses.
- Every 300 ticks the staff call the next number (`NUMMER 39!`), the queue shuffles, `NU` +1, and
  the served customer takes a brioche with 60 % chance (rng inside the entity).
- Line-cutters (`cutter: true` brammobiel and bakfiets) come every 360–480 ticks from either side
  and head for the door: **stopped** = the player moves up one place; **reached the door** = one
  place back. Delivery riders pass meanwhile.
- When `NU` reaches the player: `NUMMER 47! KOMT U` / `MAAR.` With a brioche left, each hero (P1
  first) gets **BRIOCHE POWER** (fire ×1.5, one hit absorbed, 25 s) and pays **€ 6,50**; else
  `SORRY, UITVERKOCHT!` / `MORGEN WEER!`. The lock ends after 90 s at the latest (`DE ZAAK SLUIT`,
  `UITVERKOCHT`).

### 6.8 Gids op de brug (`oat-tour-group`; d)
- A guide with a folded umbrella held high and about 12 tourists (one entity, a crowd strip)
  stop on the bridge head and block the quay (a `bodyWall`). The guide: `EN HIER ZIET U` / `DE
  OUDSTE BRUG...`, `NIET FOTOGRAFEREN` / `BIJ DE RAMEN!`. After the lock's dealer wave a handhaver
  walks in: `STILSTAAN OP DE BRUG?` / `€190 BOETE.`; the guide: `MAAR... HET` / `UITZICHT!`; a
  `−€190` pop over the guide (the guide pays, not the players). The group crosses the bridge
  toward the camera (a cosmetic depth walk; not hittable), the wall opens.

### 6.9 03:00: the neon goes out (d)
- At x 3,700 the Oude Kerk carillon strikes three (three bell strikes; the music stops). The neon
  and red tubes go out **group by group** over about 2 s (each group flickers 20–40 ticks, then
  off: lamp groups in the light API); the arena's façade and floor chunks cross-fade from the lit
  bake to the dark bake over 60 ticks; the darkness rises 0.35 → 0.6; the tower's floodlight
  goes off. Then the boss's house lights up window by window and the fight starts.
- A game liberty: since 2024 the real windows may stay lit until 06:00 (the bars close at 02:00 and
  the crowd thins). In the game every neon and red tube goes out at 03:00; the curtains stay
  closed. No figure is ever shown in a window.

### 6.10 The crumbling quay (`oat-kade-collapse`, `oat-sinkhole`; c1)
- The avalanche model (`props/set-pieces.ts:238-306`): front = clamp(target − front, 1, 3), target
  = min(view left + 40, rearmost player − 104). Its leading 24 px in the water are the **brick
  surge**: the Swan loses 2 cells (30-tick cooldown), a hero on foot dies, enemies are swallowed;
  `stopX` 3,600.
- It draws the falling far wall over the static floor (tilting slabs, splashing bricks, dust,
  leaning lamps, bikes sliding in) and leaves ≤ 8 rubble sprites behind; no runtime floor edit.
- The sinkhole (x ~2,900): the parked scan car tilts and slides in (tell 60 ticks), floats 4 s as a
  platform, then sinks.

### 6.11 The taxi ride (`oat-taxi-ride`, `oat-seat`; e)
- The carrier (the c2 cruise pattern) locks the camera, slows per wave, respawns heroes in their
  seats, holds while all are out; it cannot be destroyed (scratches only).
- The seat (a player status without walking): the hero leans out, faces left or right, aims by the
  whole-game rule (forward, up-forward 45°, up), fires and lobs grenades; **jump = duck** into the
  car (safe 20 ticks, no fire). The window aim is copied into oat, never imported from the ring.
- The meter: `€ 4,00` + € 0,25 every 70 ticks (about € 87,50); billed at `missionComplete` (2P:
  half each, P1 pays the odd cent).

## 7. The budget (game-wide)

### 7.1 The ledger
- `PlayerSlot.cents` (signed integer; start +10.000 = € 100,00) sits next to the old `score`,
  which keeps counting for the point missions and the sims (§7.10). Integer maths only:
  `floor(cents × permille / 1000)`; the 1.5 % courtage accrues in milli-cents and moves whole cents.
- `pay(world, slot, cents, x, y, kind)` (`src/game/budget/pay.ts`, beside `awardScore`, which
  refuses ≤ 0): signed; a `pay` event; HUD pop-ups (never entities); fixed category counters
  (≤ 32 per slot per mission, no per-tick allocation) for the kassabon.
- Opt-in: `MissionDef.economy?: 'euro'` (default points) for `ams`, `oat`, `oldenzaal`; the rally
  and the fps floors pay euros in their own score code.
- Extends (`ONE MORE TRY!`) at **€ 1.000 and € 3.000 of gross income** (never reduced by costs).

### 7.2 Euro values

| Payer | Euros |
|---|---|
| Enemies and items without a row below | legacy points ÷ 50, rounded to € 0,50, capped at € 25,00 |
| `handhaver` / `fatbike-youth` (pair) / `delivery-rider` / `seagull` (ams) | € 6,00 / € 6,00 (€ 10,00) / € 4,00 / € 3,00 |
| `stag-partier` / groom / `beer-bike` (ams) | € 6,00 / € 20,00 / € 25,00 |
| `oat-brammobiel` (+ coins) / `oat-bakfiets` / `oat-taxi` / `oat-dealer` / `oat-handhaver-scooter` | € 15,00 (+ 4–6 × € 0,50) / € 12,00 / € 25,00 / € 5,00 / € 8,00 |
| oldenzaal grunt / rifleman / gunner / crawler | € 3,00 / € 4,00 / € 12,00 / € 2,00 |
| Mini-bosses (ams scan car, the statue, De Makelaar) | € 150,00 |
| Bosses (ams mayor, De Huisjesmelker) | € 250,00 |
| Knife kill on a soft enemy (was ×5) | ×2 (`CONTANT`) |
| Breakables (ams) / `VERKOCHT` sign / `CAUGHT NAPPING` | € 1,00 each |
| Statiegeld: can / small bottle / big bottle | € 0,15 / € 0,15 / € 0,25 |
| Golden record | € 50,00 |
| Tally and final bonuses (hostages, ovation, flawless, boss speed, vehicle, no scratches, per life, all records, one-take) | legacy points ÷ 500 (boss speed ≤ € 36,00; per life € 100,00; one-take € 1.000,00) × the difficulty factor (0.5 / 1 / 1.5) |

### 7.3 Costs

| Cost | Euros | Where |
|---|---|---|
| Death by a `BOETE` ticket | **− € 95,00** `BOETE`; in d **− € 100,00** `BLOWVERBOD` | every euro mission |
| Toeristenbelasting per continue | 12.5 % → 15 → 17.5 → 20 % of a positive budget (min € 5,00); a flat € 12,50 at ≤ € 0 | every euro mission (the continue hook, `runner.ts:1032-1043`) |
| Flat white / matcha / zuurdesem | € 4,45 / € 5,20 / € 9,00, +10 % per buy | a, c |
| Kaasbrioche | € 6,50 | b |
| Lakschade | € 1,00 per shot into the box (≤ 1 per 15 ticks) | a, b, c |
| Dealer pickpocket | 10 % (min € 5,00, max € 50,00) | d |
| Courtage | 1.5 % of every pickup while the Makelaar lives (returned) | a |
| Huurverhoging | € 19,00 / € 24,00 / € 31,00 | d (boss) |
| Taxi escaped | € 12,50 | b, c, d |
| Blauwe envelop (aanslag) | € 25,00 … € 120,00 | b, c, d |
| The taxi ride | about € 87,50 (2P: half each) | e |

### 7.4 Below € 0: rood staan
- The budget may go red. The HUD turns red, the havermelk-bar refuses (`GEWEIGERD`), the dealer
  finds nothing. Nothing else changes (no bailiff: not picked).

### 7.5 The HUD (the bank-app look)
- `hud.ts:251-254`: the tag `1P` at x 4, `BUDGET` (small, grey), the amount (green above € 0, red
  below, `−€ 12,34`); P2 mirrored, right-aligned at x 380. The amount rolls to its new value over
  20 ticks with a small `+€0,15` / `−€95` pop beside it; world pop-ups merge per 30 ticks. The
  widest text (`BUDGET −€ 12.345,67`, 19 glyphs) fits the 170 px per side; the display clamps at
  ± € 99.999,99; HD follows the 1× call (`hudDensity`).
- Notation: `€ 1.234,56` (dot for thousands, comma for cents, a space after `€`, the hyphen as
  minus). `src/engine/font.ts` gets one `€` glyph in SMALL (`:56`) and BIG (`:167`); HD derives
  from them (`:603`).

### 7.6 The kassabon (oat's tally)
- A new scene `src/game/scenes/receipt-tally.ts`, chosen by an additive `MissionDef.tally?:
  'receipt'` in `gameplay.ts:715-721`; the newspaper stays byte-identical for the rest.
- The receipt rolls out of a printer slot (4 lines per second; fire skips after 30 ticks):
  `KASSABON` / `DAGJE UIT - DE BINNENSTAD`; the categories with counts (`STATIEGELD 37X`,
  `VIJANDEN 84X`, `FLAT WHITE 2X`, `LAKSCHADE 3X`, `BOETE 1X`, `ZAKKENROLLER`, `TERUGGAAF`,
  `AANSLAG`, `COURTAGE`, `HUURVERHOGING 3X`, `TOERISTENBELASTING 2X`, `TAXI (NIET GEREDEN)`, `BORG
  TERUG`, …, and last `RIT NAAR DE RING`); the bonus lines (`BONUS: SNELLE BAAS`, …); `TOTAAL`; the
  stamp **`OVERSCHOT`** (green, mission net ≥ € 0) or **`TEKORT`** (red); `SALDO € x`. `payOut`
  books the bonuses.
- 2P: two receipts side by side, each stamped; the higher net also gets `ZUINIGST`.
- The final tally (`final-tally.ts`) stamps `JAARREKENING: OVERSCHOT` / `TEKORT` against € 100,00.

### 7.7 High scores
- A new key `budgets` (`metal-swan-3:budgets`): signed rows `{ name, cents, mission, character,
  continues, difficulty }`, sorted by cents; a run qualifies only by beating the 10th row (the
  defaults are positive, so a red run does not enter). Defaults € 2.500 … € 150 (2.500, 2.000,
  1.600, 1.250, 1.000, 800, 600, 400, 250, 150) with the existing names. The old `highscores` key
  stays for point runs (dormant ring, m0–m5 by URL), with today's screens.
- `euroText` beside `scoreText` (`app.ts:519-521`) for the title and mode-select `HI`, the table,
  name entry, game over, the final tally, the fps HUD and continue screen.

### 7.8 The rally: prize money
- `rally/score.ts` lines become euros: `PLACE` € 500 / 350 / 250 / 150 / 100 / 75 / 50 / 25;
  `TIME` € 0,50 per second under par; `BEST LAP` € 50; `OVERTAKES` € 2 each; `NEAR MISSES` € 1
  each; `FINES` − € 120 each (the real red-light fine; the joke column goes); `TEAM` (2P) € 100 each.
  They reach the page through `TallyRunner.tallyLines` as today.

### 7.9 The first-person floors
- Kills pay € 2–€ 10 by enemy type, treasure € 5–€ 50, the golden record € 50; the fps tally lines
  and HUD show euros (`fps/hud.ts:218`, `fps-tally.ts`); the fps continue charges the
  toeristenbelasting.

### 7.10 Sims and baselines
- The identity sims diff the whole report. Euro missions add a `budget` field (cents per slot);
  `score` (points) is still counted and reported as before; no `world.rng` call is added on a
  shared path (cans and envelopes roll inside oat entities).
- So when the budget lands (wave A), `ams-god-lower`, `ams-god-upper`, `ams-god-2p`,
  `ams-normal-1`, `oz-full-1p`, `oz-full-2p`, `oz-normal-1`, `fps-1-god`, `fps-2-god` and `rally-1`
  gain `budget`; every other field stays SAME (ticks, kills, deaths, continues, `score`); `m0-god`,
  `m2-god` and `ring-god-1` stay fully SAME; a route field (ams's next mission) may change. The
  report names every DIFF.
- The € 1.000 / € 3.000 extends must not fire in these sims (they never reached 500,000 points); if
  one does, the lead stops the wave (a lives change is gameplay). New baselines after wave C:
  `oat-god-1p`, `oat-god-2p`, `oat-normal-1`.

## 8. Scenery and realism (the core of the user's demand)

The target (decision 32): **realistic pixel art**. It stays pixel art: hard-edged, palette-exact,
hand-built ramps, ordered dither only at band borders, no photo, no painted backdrop, no
near-photo noise. What changes against `ams` is the physics of the picture: real proportions, real
light and shadow, water that reflects, surfaces that are wet and worn, and no repetition. The
honest verdict of `ams` (art map §3) is the baseline we must beat: "a clean, bright, well-made
arcade postcard … toy scale, even studio light, spotless surfaces, repetition, ink outlines,
cartoon water". §8.13 turns that verdict into review criteria.

The facts in this section come from `tmp/oat/scenery-research.md` (sources S1–S26 there); the
reference photos in `tmp/oat/ref/` are for likeness only: measure ratios, read materials and
light, never trace, never sample a pixel, never ship.

### 8.1 The pipeline in one frame (oat)

1. Sky (gradient + clouds, lit from the left) → 2. far layers (landmark, roofscape, the far bank
across a canal with baked reflections), lifted by the floor depth → 3. the perspective floor
(line scroll; the oat floor kit: materials, wetness, wear, water cuts) → 4. **the façade strips**
at the façade depth (§8.6; new store) → 5. back decor at depth (lamps, trees, bikes, signs, side
faces), the back prop row → 6. **the water overlays** (static strips are in the floor; dynamic
reflections, wakes) → 7. contact shadows stretched along the sun, then the entities → 8. the
front row and front layers → 9. the light pass (opt-in: d and e; smoothed glow, streaks, lamp
groups) → 10. the HUD.

### 8.2 The scale rule (MIXED, decision 36)

| Part | Scale | Numbers (world px) |
|---|---|---|
| **Ground band**: street level up to the band top (the shop front's beam, the stoep door's lintel or the first-floor sill line) | **true, 20 px/m**, both axes for every opening and object | band top 64–84 px (3.2–4.2 m); doors 2.2–2.4 m = 44–48 px (the hero is 36); shop glass from 0.4 to 3.0 m = 52 px; awnings' front edge 50–56 px over the walk line; a stoep 7–9 steps = 26–32 px with two flights parallel to the façade |
| **Lot widths** (the house rhythm along the street) | 0.6 (12 px/m) | 18 / 20 / 22 / 24 / 26 Amsterdam feet (0.2831 m) = 61 / 68 / 74 / 82 / 89 px; the 30 ft Herengracht lot 102 px; doubles 144–204 px; infills 24–48 px |
| **Upper band** (storeys, gable, attic) | ~0.4 vertical (8 px/m) | storeys 2.8–3.3 m = 22–26 px; gables and attics 3–5 m = 24–40 px; window openings keep their real ratio (height : width 1.6–1.9) by narrowing, never by squashing (a 12-pane sash about 11 × 18 px) |
| **Street furniture** in front of the façades | true | Amsterdammertje 0.75 m = 15 px; bike staple 0.9 × 1.2 m = 18 × 24 px; bikes 20–22 px to the bars, 36 px long; bins 20 / 24 px; lantern posts 4.0–4.5 m = 80–90 px; parked car 29 × 84 px |
| **Trees** (quay elms) | split like a house | trunk true scale (10 px wide) to the band top; the crown at 0.4 above, so the crowns reach the ridges as in the photos |
| **Bridges** | true heights, compressed spans | clear height 2.1–2.4 m = 42–48 px over the water; spans 200–224 px; hump +12 on the walk line |
| **Quays and water** | true | quay top 1.0–1.2 m = 20–24 px over the water |
| **Far rows** (across a canal, vistas, roofscape) | uniform 0.4–0.5 | whole houses, hazed |
| Depth (across the street or canal) | compressed by the floor camera | the floor band is a projection; depth is never literal |

- The fit: the façade base sits at y 160 (`s` = 0.862). A median 9 Straatjes house (ridge 16.2 m)
  is 72 + 101 = 173 world px → its gable tip at about y 11. Houses above about 18 m (1 lot in 6 at
  most) may cut the screen top, as a close street view does. The Wallen median (14.7 m) tips at
  about y 21.
- **The seam rule**: the scale changes only at a real horizontal line of the house (the shop
  front's beam, a string course, the first-floor sill), never inside a window or a door. Each lot
  has its own band top; neighbours may differ by up to 20 px.
- A test (`tests/art/oat-scale.test.ts`) checks the grammar's numbers: doors ≥ 44 px, the band at
  20 px/m, window ratios 1.6–1.9, no lot without a seam line.
- The forward lean (2.75 cm per m, about 30 cm per house) shows only in side faces at row ends and
  alleys (1 px per ~40 px of height). Subsidence tilts some houses sideways by 1–2 px over their
  height: 1 lot in 8 in a and b, 1 in 5 in d.

### 8.3 The sun per section (decisions 37 and 52)

The sun is a **game convention**: always on the left and in front of the façades (the camera
side), the same side as the heroes' fixed key light, so every shadow agrees with the sprites. It
is compass-true for c and c1 (the Grimburgwal runs about 82°, its north bank faces south, and a
late-September sun at 17:15 stands at about 18° in the south-west, behind the camera's left). In
a and b the convention beats the compass (the 9 Straatjes run east–west: a real morning sun would
light the north row from the right, and the noon sun stands straight behind the camera), and the
elevations follow the user's rule (morning high, afternoon low), not the date (the real
late-September sun is about 17° at 09:30 and 36° at noon). The research's light colours, street
widths and house heights still apply.

| Section | Clock | Elevation e | Yaw (from the façade plane toward the camera) | Sun colour (Kelvin, a guide) | Sky | Floor shadow per metre of height |
|---|---|---|---|---|---|---|
| oat-a | 09:30 | 32° | 40° | 4,500 K, cool white (≈ #ffd9b6) | zenith ≈ #4583c0, a pale warm horizon, broken cumulus | 1.60 m |
| oat-b | 12:30 | 40° | 30° | 5,500 K (≈ #ffedde) | zenith ≈ #60a0d9, cumulus | 1.19 m |
| oat-c | 17:15 | 18° | 45° | 3,500 K, warm (≈ #ffc18d) | warm haze low in the west | 3.08 m |
| oat-c1 | 17:30 → 18:00 | 15° → 11° | 45° | 3,200 → 3,000 K, golden (≈ #ffb16e) | gold under the clouds | 3.7 → 5.1 m |
| oat-d | 22:30 → 03:00 | — | — | lamps 2,700–3,000 K; neon; red tubes | navy ≈ #0b1030 with a warm cloud glow | lamp pools only |
| oat-e | 03:20 → 04:30 | — | — | tunnel and motorway lamps | night, ≈ #0b1030 | none |

- The model: one sun vector per section: from the scene toward the sun, (−cos e · cos yaw, sin e,
  +cos e · sin yaw) with x right, y up, z toward the camera. A point at height h casts its floor
  shadow at Δu = h · cot e · cos yaw (to the right) and Δv = −h · cot e · sin yaw (toward the back).
  A protrusion of depth d (a cornice, a sill, an awning, a hoist beam, a wall anchor) casts on its
  wall Δx = d · cot yaw (right) and Δy = d · tan e / sin yaw (down). Compute in metres, then convert
  with the scale of the band where the shadow falls.
- The light kit: `HdCanvas.render({ key, bounce })` takes the section's sun (today's `KEY` is the
  default, so `ams` and oldenzaal bytes stay the same); the index painters (`BgCanvas`) and the
  floor painter read the same record from `content/missions/oat/light/sun.ts`. The time of day is
  real light, never a recolour of a noon picture.
- Ambient and bounce: the shade is lit by the sky (a cool blue cast, ≈ #bfd3ff–#dde6ff as a tint
  guide) by day; a warm bounce from sunlit brick into the shaded side.

### 8.4 Cast shadows (L2)

- **One source of truth**: the shadows are computed at section load from the decor list, the
  façade grammar's heights and protrusions, and the opposite row; nothing is placed by hand, so
  shadows follow every layout change.
- **The unseen opposite row** (behind the camera) is a procedural skyline from the same grammar
  (another seed, the real street width: a 8.2 m, Oude Spiegelstraat 6.6 m, b about 8 m, c/c1 about
  23 m façade to façade). Its shadow line on our façade sits at H_s = H_opp − W · tan e / sin yaw,
  with the gable silhouettes stretched along it; gaps (side streets behind us) let sun shafts
  through.
  - a (32°): H_s ≈ 4.5 m in the 8.2 m streets: the shop fronts and the street floor lie in cool
    shade, the upper storeys and gables in sun; the Oude Spiegelstraat (6.6 m) shades up to about
    6.1 m. The bridges and canal vistas are in full sun: narrow and shaded, then wide and bright.
  - b (40°): the façades are fully lit, but the opposite row's shadow covers the street except a
    thin strip of sun (about 0.5 m) at the façade foot: the queue stands in cool shade beside warm
    shop windows under a bright slot of sky (the research's noon picture).
  - c (18°): our own row's shadow covers our quay, the whole water, the far quay wall and the far
    ground floors (H_s ≈ 2.4 m); the far upper storeys glow orange and their glow is what the water
    mirrors. c1 (15° → 11°): the shade line climbs the far fronts from about 4.3 m to 6.7 m as the
    sun sinks during the chase. Sun shafts through gaps cross the water and light stripes of the
    crumbling wall.
- **Floor**: the façade row's shadow, awnings, balconies and stoeps, trees (the elm crowns as
  dappled shade), lamp posts, bollards, staples, parked bikes and cars, bridge parapets: baked into
  the floor chunks (`FloorShade`-style soft edges at 2×/4×, a hard edge at 1×), shade ≤ 1.5 tones
  so a fight in shade stays readable.
- **Façades**: cornice, sill, lintel, hoist-beam, anchor, sign-bracket, awning and stoep-railing
  shadows on the wall (down-right for the left sun); deep window reveals (the jamb's shadow inside
  the opening); baked into the strips.
- **Actors**: today's contact ovals, stretched along the sun's floor direction (length by e; an
  additive floor opt-in `sun` field; `ams` and oldenzaal floors do not set it).

### 8.5 Materials and ramps (L11; decision 51)

- Every big material uses **6–8 tones** at 4× (the art map measured 3–4 on `ams` brick). Mortar is
  a warm, recessed grey (never the even cool grid of `ams`), and joints sit in shadow under the
  sun's direction. Ordered dither only at band borders, in world space.
- Daytime saturation is lower than `ams` (real Amsterdam is greyer, browner, wetter); colour comes
  from paint (grachtengroen doors, oxblood posts, red shutters, white sashes) against brick.
- `PAL_HD_OAT` (`src/engine/palette-hd.ts`, additive like `PAL_HD_OZ`; PAL_HD 209 + 47 = 256): 43
  colours in 11 ramps, 4 spare. Research hex values (scenery research §4) are starting points; each
  ramp is hand-built in Oklab steps by the CORE agent and judged by eye; no eyedropper value ships
  as is.

| Ramp | Tones | Guide values (research) |
|---|---|---|
| Canal water, day (olive-brown body → sky sheen) | 6 | #13110f, #3e4434, #51584c; sky-reflected #343f55 |
| Night water and wet black (asphalt, wet clinkers) | 4 | #050403, #181519; lamp-lit wet #948267 |
| Weathered brick (18th c. red-brown, hard-fired purple-brown, near-black over-painted) | 7 | #4e3129, #7a4e3e, #9a6a55; #2e2224, #4a3436, #634748; #2a2426 |
| Mortar and sandstone (Bentheimer) | 4 | #9d968b, #b8b2a6, #b5ad9b, #cbbd96 |
| Grachtengroen / monumentengroen | 4 | #121a17, #1e2a26, #2f3d36, #2f4a3c |
| Oxblood (doors, posts, Amsterdammertjes) | 3 | #3a1a1c, #5a2a2c, #7a3a3a |
| Warm LED lantern (spill → core) | 4 | spill dark, #ffa757, #ffd29a, #fff4d6 |
| Red window light (wall wash → tube core) | 3 | #7a0a10, #e0141e, #ff6a5a |
| Neon pink (glow, core) | 2 | #ff3fa0, a pale core |
| Neon cyan (glow, core) | 2 | #2fb6ff, #96dcf7 |
| Night sky and cloud glow | 4 | #0b1030, a deep blue, #3a2a2a, a warm brown |

- `BgCanvas` gets an additive LUT parameter (default `HD_PALETTE`), so the oat painters index the
  oat set; at d 1 the same painters map to the 64-colour `PAL` (the `Pen` snap rule).
- A palette test: every oat sprite, layer and strip pixel is in PAL_HD ∪ PAL_HD_OAT (the floor
  output and the light pass blend, as today); the set ≤ 256; oz's ramps stay apart.

### 8.6 The façade grammar and the strips (L7 + L8; decision 55)

**The grammar** (`src/game/content/missions/oat/facade/`): parts and rules from photo study
(ratios measured, never traced). One drawer per part for every density (the `Pen` pattern).

- **Gables** (all common in the canal belt): *trapgevel* (step; few, large, unequal steps capped
  with stone; 1600–1665), *halsgevel* and *verhoogde halsgevel* (neck, carved sandstone
  klauwstukken; 1640–1775), *klokgevel* (bell, stone edging; 1660–1790; 18th-century bells taller
  and more curved), *tuitgevel* (spout; warehouses and simple houses; brick-on-edge course),
  *lijstgevel* (a full-width cornice, often wooden; with an attic or a raised centre; 18th and 19th
  century), plus 19th-century plastered fronts and a few 20th-century infills.
- **Windows**: the 17th-century *kruiskozijn* (cross-frame, sandstone colour, with shutters), sash
  windows with small panes (12-pane, 6-over-6: white is required with small panes), 2-over-2 and
  big panes (green allowed), casement + transom; the bigger middle loft window where hoist doors
  were; warehouse loading doors stacked up the middle bay with red or green hourglass shutters;
  attic windows; sandstone or white frames; every opening has a reveal and a sill shadow.
- **Doors and ground floors**: the stoep door (grachtengroen, black or oxblood; a fanlight with
  a carved centre post; brass letter slot; railings the door's colour), the flat stoop, the
  half-sunk basement with a grilled cellar window and a hatch beside the stoep, the shop front
  (white-painted wooden pui, thin columns, a fascia with painted letters, awnings striped or plain,
  hanging signs on wrought-iron brackets, chalkboards), the bar front (d: neon in our own words,
  a dark interior), the **window-brothel frame** (d, architecture only: a plain painted frame or
  glass door, the curtain always closed, a red tube along the top or sides, a small number; never
  a figure; no blue window light), the roller shutter (d after 02:00; tagged with invented marks).
- **Walls and details**: brick bonds (Flemish, stretcher), fine joints after 1700, over-painted
  near-black brick on some fronts, red-painted and dark grey painted brick, plaster (cream,
  grey-white); a hardstone plinth; **wall anchors** at each floor (black St Andrew's crosses or
  rosettes); gable stones (our own motifs); hoist beams with a hook (some with a small roof);
  flower boxes on at most 1 lot in 6 (`ams` had them everywhere); downpipes; house numbers mixed
  so no real façade gets its real number.
- **Street style sheets** (lead estimates; tuned at the look stop):

| Street sheet | Storeys | Gable mix | Other |
|---|---|---|---|
| 9 Straatjes (a, b) | 4–5 + attic; ridge 12.4–20.7 m (median 16.2) | lijst 35 %, klok 20 %, hals 20 %, tuit 8 %, trap 7 %, 19th/20th c. 10 % | 3 bays (some 2); shops in most ground floors; span-wire lamps; a bridge at each canal |
| Canal fronts (a, b vistas; the Singel) | 4–5 | more lijst and wider lots (24–30 ft), doubles | stoeps, elms, houseboats, parked cars nose to the water |
| Grimburgwal north bank (c, c1) | 3–5 | lijst 35 %, trap 15 %, hals 15 %, tuit 15 %, plastered 20 % | the quay wall 1 m above the water with a stone coping; at the end the step-gabled corner house where three canals meet (needs a reference photo first) |
| Oudezijds Achterburgwal / Voorburgwal (d) | 3–5; ridge 11.0–18.3 m (median 14.7) | lijst 30 %, tuit 15 %, trap 15 %, hals 15 %, klok 10 %, 19th/20th c. 15 % | narrow lots, more lean and tilt, bar fronts, red-lit frames, lit upper windows at random (~30 %) |
| Trompettersteeg (d) | 3–4 | walls only (no gables in view) | plain brick, white frames, a roller shutter, a wall lamp, the central gutter |
| Oudekerksplein (d) | 3–4 | small houses round the church | the Oude Kerk (Gothic hall church, tower about 70 m) as the backdrop |

- **The lot sequencer**: lots in Amsterdam feet, seeded per street stretch in world u. **No repeat
  rule**: within any 1,536 px of street, no two lots share the triple (gable type, wall material,
  window type), and no neighbour pair shares two of the three. Twins and triplets (real: identical
  houses on two lots) are allowed once per street as a deliberate pair.
- **The strips** (L7; a CORE engine store in `src/game/mission/strips/`): the façade row of a
  stretch is painted as streamed chunks at the façade depth, drawn with that row's line-scroll
  speed. A chunk is 256 logical px wide × the strip height (≤ 216); at 4× 1,024 × ≤ 864 px ≈ 3.5 MB.
  Prefetch one chunk ahead (two in auto-scroll sections), evict two behind; about 5 resident ≈ 18 MB
  at 4×, flat for any section length. Chunks are main-thread art jobs painted with index canvases
  (≈ 3–5 ms per 4× chunk measured for `BgCanvas`; the grammar, sun, wear and wetness functions may
  bring it to 8–14 ms: slice into bands so no job exceeds 16 ms and ≤ 8 ms of jobs run per frame;
  the lower density draws until a chunk is ready). Workers stay for sprites only.
- Shadows, night light, wear and wetness are baked in **world space** at paint time, so they cross
  house borders (a sprite per house could not).
- A section may declare a second light set (`strips.dark: [x0, x1]`) for the 03:00 switch (§8.9).
- Side faces at row ends, alleys and gaps use the floor's faces (`FloorDef.faces`, floor.md §11 R1).
- Fallback (if the store slips): unique façades as decor sprites with a hard cap per section; the
  grammar stays the same.

### 8.7 Per section: far to near

**oat-a, DE 9 STRAATJES, 09:30, sun high-left (32°)**
1. Sky: morning blue at the zenith, pale toward the horizon, broken cumulus lit from the left
   (mixed skies are the Amsterdam norm).
2. The **Westertoren** (about 87 m, the imperial crown) above the roofs on the Prinsengracht
   stretch; the roofscape: 98 % pitched roofs, red-orange pan tiles, slate and zinc, chimneys,
   dormers, roof terraces; hazed and cooled.
3. At the three bridges, **canal vistas** into depth (24.5 / 26.4 / 23.5 m of water): both banks
   converging, elms arching over the water, houseboats (concrete arks, old steel barges), a long
   low glass-roofed electric tour boat (no exhaust), the far rows mirrored in still morning water,
   thin mist.
4. **The strips** (the 9 Straatjes sheet): gables against the sky, upper storeys in sun, the
   opposite row's jagged shadow over the shop fronts; anchors, hoist beams, white sashes; span
   cables across the street with hanging lamps (no masts in narrow streets).
5. Back decor: bikes against the fronts and in staples, Amsterdammertjes (red-brown, XXX), hanging
   signs, short flag poles, chalkboards, door plants; street-name plates on corners
   (`BERENSTRAAT`, `WOLVENSTRAAT`, `OUDE SPIEGELSTRAAT`: navy enamel, white capitals, a thin white
   border, `CENTRUM` small; our lettering at 1.5× true size so it reads at 2× / 4×).
6. Floor: dikformaat red bricks (stretcher bond) or grey 30 × 30 tiles on the pavement, a 12 cm
   stone kerb (2 px, lit top), red-brown keiformaat clinkers in herringbone on the one-way street;
   **wet in shade after a night of rain, drying in the sun strips**. Bridges: brick arches
   (5.6–7.0 m openings), dark green cast-iron railings, oxblood lantern posts, bikes chained.
7. Front row: Amsterdammertjes, a staple with a bike, a café chair (thin, ≥ 34 px apart). Life
   (modest, ≤ 4 figures per screen): a shopkeeper putting out a sign, a cyclist on a bridge in
   depth, a street sweeper.

**oat-b, FORT NEGEN & ZESTIG, 12:30, sun highest-left (40°)**
1. Noon sky with bright cumulus; the roofscape with short shadows; at the start the Keizersgracht's
   far bank in full sun and brighter water with more sky, a tour boat's wake cutting the
   reflection into bands.
2. The strips (another seed): fully lit fronts, short hard shadows under cornices and sills, deep
   window reveals.
3. **The bakery** (an invented corner; corner houses were usually shops): shop fronts on two
   façades, a white wooden window frame, a hand-painted fascia `FORT NEGEN & ZESTIG` (cream on
   grachtengroen, our lettering), bread on wooden shelves, warm interior light, a worn step.
4. The queue (one entity): about 30 people along the windows (light jackets, scarves, totes and
   paper bags, phones, some eating from trays), belt barriers, the line spilling over the kerb.
5. Floor: a thin strip of sun at the façade foot, the rest of the street in cool shade; a gully
   grate; crumbs, paper bags, cups on sills, stickers on the drainpipe.

**oat-c and oat-c1, DE KADEMUUR, 17:15 → 18:00, sun low-left (18° → 11°)**
1. Warm haze low in the west (left); clouds lit gold underneath.
2. The far row (the Grimburgwal sheet): upper storeys glowing orange-red, the lower fronts in our
   row's blue shade, sun shafts through gaps.
3. The quay wall at the back edge: ~1 m of brick and a stone coping; moss on the coping, iron
   rings with rust streaks, white-capped mooring piles, the dark wet band and algae at the
   waterline, limescale streaks; **diagonal cracks opening at the top**, a sagging coping, a dip
   with puddles, gaps between kerb and paving.
4. Temporary works: mesh fences on concrete feet, rusty sheet-pile boxes planted with reeds, a
   steel waling, a blue work boat with a crane, a pontoon, floating pipes; generic site gear
   (barrier boards, `WERK IN UITVOERING`, sandbags, crack tell-tales: invented detail).
5. Quay furniture: elms 1–3 m back (some leaning on the failing stretch), lantern posts, staples,
   dark grey waste columns (our mark), power boxes for houseboats, bikes up to the edge.
6. Water (c1: the whole band; c: behind the coping): brown-gold, mirroring the lit tops, dark
   where it mirrors the shaded wall; the Swan's wake; bricks and slabs sliding in behind. The near
   coping at the screen bottom (c1). Life: a crew in orange high-visibility clothing and white
   helmets at the closed bridge (cosmetic).

**oat-d, DE WALLEN BY NIGHT, 22:30 → 03:00, no sun**
1. Deep navy sky, low clouds lit orange-brown from below; the **Oude Kerk tower** (about 70 m,
   floodlit) above the roofs, nearer on the Voorburgwal and the square; dark after 03:00.
2. The strips (the Oudezijds sheet): narrow step and spout gables against the glow, lit upper
   windows at random, **baked lamp light** (brick in its own lit ramp near each lantern), neon
   spill in its hue on plaster, red-tube wash on the frames, warm bar interiors.
3. Street level: bar fronts with our own neon words and shapes, window frames with closed curtains
   and red tubes, doorways, `BLOWVERBOD` signs at the alley mouths (a white disc with a red ring,
   our own pictogram, a text plate), warning screens, cables.
4. Floor: wet herringbone **reflecting red and gold**, litter, broken bins, bottle glass; stacked
   terrace chairs after 02:00.
5. The front: the near coping and **the canal** (Achterburgwal ~8 m of water, Voorburgwal ~18 m):
   near-black water with long gold, red and pink streaks broken into dashes; the elms on our quay
   as dark masses lit from below; low brick bridges with lanterns and densely chained bikes.
6. The alley: the far wall 1–1.4 m behind the heroes, plain brick, white frames, a wall lamp, the
   central gutter, a roller shutter with invented tags, a strong lamp pool, little sky.
7. The square: the church's flank (tall pointed windows, buttresses) behind small houses; the
   boss's crooked house; the dark set after 03:00 (§8.9). Life: a few silhouettes before 02:00,
   fewer after (the real crowd fell 30–63 % after the bar hours); at 03:00 a cleaning crew and a
   sweeper machine far off.

**oat-e, DE TAXIRIT, 03:20 → 04:30**: a lean kit: the d night grammar along the Warmoesstraat end
and the Prins Hendrikkade, the station's long front as a far layer, a repeating tunnel kit (tiles,
lamp bands, niches), the ramp under the motorway lights. Needs reference study first (no photos yet in
`tmp/oat/ref/`).

### 8.8 Water (L5; decision 54)

- **Body**: olive-brown and opaque by day (never teal), near black at night; darker near quay
  walls, under hulls and bridges; more sky toward the far bank (the grazing angle), more of the
  water's own dark near the viewer.
- **The floor water tile** (`oat/water`): two ripple scales that match the far rows' pattern, world
  anchored, moving with time; a calm variant (morning mirror, 03:00) and a busy one (afternoon
  wakes).
- **Static reflections**, baked in world u as part of the floor cut: the far bank, quay walls,
  bridges, moored boats and (at night) lantern and neon positions, mirrored from the same grammar
  output and broken by ripple rows; 2–6 MB at 4× inside the floor's 16 MB (new tiles replace, not
  add).
- **Dynamic reflections** (`src/game/mission/floor/reflect.ts`, a Canvas 2D overlay after the
  floor band): for at most 6 tagged entities (the Swan, boats, the taxi on a quay, figures at the
  edge), the sprite drawn flipped, sliced in rows with per-row x offsets from a fixed ripple table,
  alpha 0.35–0.5, clipped to the water quads with the floor's `s(y)` mapping.
- **Wakes and splashes**: a V wake and a foam trail behind the Swan and boats, bow waves, splash
  rings, brick splashes and floating debris of the collapse; fx particles (not entities) on
  `world.fxRng`, world-anchored decay; ≤ 800 particles in all.
- **Night streaks**: the light pass draws for each light with `streak: true` a vertical stack of
  short additive dashes below its mirror point on water and wet floor quads, longer with more
  ripple; smoothed at 2× / 4×.
- **CPU parity**: the GL floor shader stays texture-only. Reflections, streaks and wakes use only
  the `Renderer` API after the floor raster, so the GL and CPU floor paths draw the same overlays,
  the GL = CPU floor tests are untouched, and the node `shot` tool shows them.

### 8.9 Night lighting and the 03:00 switch (L3 + L4; decisions 52 and 53)

- **Baked static light** (strips and floor): lantern pools on the floor, lit brick in its own ramp
  within a lamp's radius, rim light on wet clinkers, neon spill on plaster, red-tube wash on
  frames, warm shop and bar interiors, lit upper windows.
- **Neon signs and tubes as sprites** with 2–4 flicker frames plus halo frames (our own words and
  shapes), grouped in lamp groups.
- **Moving and short lights** through the light pass: muzzle flashes, blasts, taxi and scooter
  headlights, the boss's lights (entity lights, `LIGHT_TAG`).
- **The light pass moves to a neutral home**: `src/game/mission/light/api.ts` (the config API
  from `content/oldenzaal/kit/light-api.ts`, which re-exports it unchanged). New per-section flags
  with old defaults: `glow: 'block' | 'smooth'` (oat: smooth at 2× / 4×; 1× stays per pixel),
  `streaks`, `groups` (named lamp groups with on, off and flicker scripts). Oldenzaal frames stay
  byte-identical; `tests/game/mission-light.test.ts:41-50` widens to oldenzaal + `oat-d` + `oat-e`.
- Darkness: d 0.35 (lit streets); the arena after 03:00 0.6; e's tunnel 0.4 with passing bands.
- **The switch: two bakes for the arena only.** The arena view (3,968–4,352 plus 128 px) has a lit
  and a dark set of façade and floor chunks. The dark set is prefetched as art jobs from the
  checkpoint at 3,500 (3 strip chunks + the floor slices: about +11 MB at 4×, inside the reserve);
  the lit chunks behind the camera are evicted as usual. At 03:00 each sign group flickers out, the
  bakes cross-fade over 60 ticks (one extra chunk draw), the darkness rises. Why two bakes: a
  runtime darkening cannot remove baked neon spill (walls would stay red after the sign is off),
  and the user's first feature is light. **Fallback** if the budget test fails: no dark bake; the
  arena's neon spill is drawn as light-pass glows (switchable) and the darkness does the rest.

### 8.10 Weather, wet and wear (L6 + L10)

- **Wetness field** w(u, v) per section: a: after a night of rain, wet in shade and dry in the sun
  strips (from the shadow function), puddles in dips and at gully grates, drips from awnings in the
  first minute; b: dry, with a few damp joints in shade; c, c1: damp quay edges, puddles in the
  sagging paving; d: **all wet** (the strongest night picture); e: wet road. Wet = one tone darker,
  the sky (day) or the lamp colour (night) on clinker domes and in the joints, a specular edge.
  Puddles are flat mirrors (sky by day, streaks at night). No rain in play (it would hide shots).
- **Floor wear** (hashed decals in world space): gum spots, cigarette ends in the joints, elm
  leaves under the trees, tyre marks, oil stains, sunken and cracked tiles, root heaves, moss in
  joints near kerbs and quays, drain grates, litter near bins (more at night), bottle glass in d.
  At least 12 marks per 256 px of floor.
- **Façade wear**: stickers at hand height on poles, drainpipes and sign posts (invented marks,
  never real logos or crews), posters on electricity cabinets, peeling paint on doors and frames,
  rust streaks under wall anchors and railings, salt bloom and patched brick at the foot, damp at
  the wall foot, soot under cornices, pigeon spikes on ledges, chipped paint on bollards (grey and
  rust under the oxblood). At least 6 marks per lot.
- **Quay-wall wear**: the algae band, the tide line, limescale streaks, rust under rings, missing
  bricks, sheet piling, cracks that grow toward the collapse.
- Density rule: fine detail at 4×, 2 × 2 clusters at 2×, only tone at 1× (no single-pixel noise).

### 8.11 Outlines (decisions 38 and 60)

- None on façades, the floor, layers and static street props: edges come from tone, the sun's
  light side, AO and cast shadows. A dated style paragraph in `docs/ART_GUIDE.md` records it for
  `oat`.
- Outline A (ink, 1 logical px) stays on the heroes, enemies, NPCs that act, pickups, and on what
  can be shot (bins, the glass case, the hoist rope and load, `VERKOCHT` signs, the envelope).
- Background people have no outline and sit darker, at their depth, so they never read as targets.

### 8.12 Memory and frame budgets (decision 50)

| Item (tier 4) | Estimate | Note |
|---|---|---|
| Façade strips (~5 resident chunks) | 18 MB | flat for any length |
| Background layers (5 per section) | 50 MB | 10 MB per 768-wide layer |
| The 03:00 dark set (d only) | 11 MB | 3 chunks + floor slices |
| Terrain chunks and margin | 5 MB | small with a floor |
| **`denseReserve`** | **84 MB** | inside the 256 MB cap (oldenzaal style) |
| Sprite working set (heroes, cast, bosses, decor sprites) | ≤ 170 MB | 256 − 84 − 2 MB margin; checked per section, 1P every hero, 2P pairs |

- Order of cuts if `tests/content/oat-dense-budget.test.ts` fails: (1) the fatbike youth at 2× in
  that section (as the `ams` 2P rule); (2) 5 → 4 layers at 4×; (3) the far roof layer at 2× only;
  (4) the dark set falls back (§8.9).
- Unique sprite prefixes only (`item/oat/`, `ui/oat/`, `npc/oat/`, `decor/oat/`, `enemy/oat-`,
  `boss/oat-`); `ams` must not grow (it sits at 251.6 of 256 MB).
- Floor textures ≤ 16 MB CPU and ≤ 16 MB GPU per section (outside the 256).
- Frame: 4K render + present ≤ 2 ms (goal 1.8); floor code ≤ 0.5 ms (≤ 1.2 ms with its draws);
  overlays (reflections, streaks, wakes) ≤ 0.3 ms; light pass ≤ 0.2 ms; art jobs ≤ 16 ms each and
  ≤ 8 ms per frame; no frame over 16.7 ms after the first load frame of a section; the c1
  prefetch keeps ahead of 1.2 px/tick.

### 8.13 What "done" looks like (review criteria; the look stop is judged at 4×)

| Aspect | `ams` today (art map §3) | `oat` must show | Check |
|---|---|---|---|
| Proportions | toy town at ~⅓ scale; doors lower than the heroes | doors 44–48 px; shop glass to 3 m; stoeps 26–32 px; gables in view | the scale test; the lead measures crops |
| Variety | 13 house frames, repeats within one screen; one window type | no repeat in 1,536 px; ≥ 5 gable types and ≥ 4 window types per street sheet; warehouses, cornice houses, 19th-c. fronts | the grammar test; a 4-screen strip contact sheet |
| Tones | 3–4 per brick wall; an even cool mortar grid | 6–8 tones per big material; warm recessed mortar | a crop histogram (tones covering ≥ 0.5 % of a material's area) |
| Light | one fixed key, time of day as a recolour; "golden looks like noon" | a sun per section; cast shadows from every protrusion, post, tree and bike; the opposite row's band; c's blue lower fronts under glowing tops | side-by-side frames a / b / c at the same x pattern; the lit-brick hue at c is clearly warmer than at b |
| Atmosphere | haze on far rows only | haze plus morning mist (a), a warm low haze (c), cloud glow (d); depth through vistas | frames |
| Water | teal cartoon ripples; no reflections near; boats like stickers | olive-brown body; static and dynamic reflections; darker at walls and hulls; wakes; neon and lamp streaks at night; one ripple language near and far | frames + a 60 fps capture of c1 and d |
| Wear | spotless pavements and quays | ≥ 12 floor marks per 256 px, ≥ 6 per lot; quay cracks and algae; stickers, rust, peeling paint | the lead counts on 4× crops |
| Outlines | ink on every façade and prop | none on façades and static props; ink only on hittables | a pixel check on strips (no outline palette run along edges) |
| Signage | clean and sparse | real street-name plates, parody shop names, `BLOWVERBOD`, cables, notices | the scan list (§10) |
| Saturation | high, primary | lower by day: mean Oklab chroma of oat-a scenery ≤ 0.75 × `ams`-a | a script on two frames |
| People | an empty city | modest: ≤ 4 background figures per day screen, ≤ 2 after 03:00, never mistaken for enemies | frames |
| Night | 4 × 4 blocky glows; light does not shape materials | round glows at 2× / 4×; lit brick near lamps; spill; wet streaks; the 03:00 switch | frames at 4×, a capture of the switch |
| 1× | — | readable: heroes, enemies, shots and pickups stand out from scenery | the readability check at res 1 |
| Smooth | — | no shimmer, no stepping rows, no swimming reflections | the floor pan tests + a capture |

## 9. Sound

### 9.1 The day-to-night score
- Songs (ElevenLabs takes, a synth fallback for every id in `content/music/oat.ts`; prompts in our
  own words, never a named song, artist, game or composer), with section markers for
  `ctx.music(id, fade, { from })` in takes and fallbacks: `oat-a` bright morning (plucked strings,
  marimba, hand claps); `oat-b` tense (a ticking pulse, pizzicato, a shop-bell motif; part B for
  the queue); `oat-c` (A an afternoon intro, B the chase with driving drums and brass stabs; also
  the taxi ride); `oat-d` neon synth (a pulsing bass, slow arpeggios; part C sparse after 02:00);
  `oat-boss` (A for De Makelaar, a cocky dance; B for De Huisjesmelker, a heavy minor waltz with
  cash-register percussion).
- Stings: the draaiorgel waltz (8 s, our own), the carillon's three strikes, the neon power-down,
  the kassabon printer loop and stamp.
- Sfx (`content/sfx/oat*.ts`, ids `oat/…`): bins and cans, the till and refusal beeps, the ring
  light, the bakfiets bell and `LAKSCHADE`, the taxi meter, horn, door and rev, the envelope, the
  hoist rope, piano and sofa, the organ, the queue, the quay rumble, brick splashes, the sinkhole,
  the Swan wake, crane beeps, the paddle, the door bell and the viewers' rush, the two key-ring
  rattles (low and high clearly different), the mould spray, the rent board, the microwave ding,
  neon buzz, roller shutters, the tunnel, scooters. Ambience loops per section; no gulls.

### 9.2 Voices (ElevenLabs Voice Design; designed, never a clone or an imitation)
- Speakers (in `missions/oat/ids.ts`): `makelaar`, `huisjesmelker`, `taxi`, `barista`,
  `influencer`, `bakfiets`, `dealer`, `rij-staf` (the bakery staff), `rij` (queue people), `gids`,
  `huurder`; reused: `handhaver` (new lines in its designed voice), Gusto (the card), the announcer.
  Plain, standard Dutch; no accent as a joke; the voice descriptions never name a real person.
- Lines (all text verbatim in `missions/oat/lines.ts` with `voicedLines()`; ≤ 24 chars × 2 lines;
  no diacritics):

| Speaker | Lines |
|---|---|
| barista | `GOEDEMORGEN! HAVER` / `OF HAVER?` · `BETAALD! FIJNE DAG!` · `INFLATIE, SORRY!` · `GEWEIGERD. HEEFT U` / `EEN ANDERE PAS?` |
| makelaar | `WELKOM BIJ DE` / `BEZICHTIGING!` · `VRAAGPRIJS? DAT IS` / `MAAR EEN BEGIN.` · `OVERBIEDEN!` · `+10%!` · `DE BEZICHTIGING IS` / `GEOPEND!` · `VERKOCHT, O.V.!` · `ONDER VOORBEHOUD` / `VAN FINANCIERING...` |
| influencer | `LIVE!` · `HOI LIEVE VOLGERS!` · `DIT IS ZO HYPED!` · `GEBRUIK MIJN CODE!` · `WACHT NOU!` · `MIJN CONTENT!` |
| bakfiets | `AAN DE KANT!` · `ER ZITTEN KINDEREN` / `IN, HOOR!` · `LAKSCHADE!` · `IK BEL DE CRECHE!` |
| rij-staf | `NUMMER 39!` (and the other numbers up to 60, one short take each) · `NUMMER 47! KOMT U` / `MAAR.` · `SORRY, UITVERKOCHT!` / `MORGEN WEER!` |
| rij | `HE! ACHTERAAN` / `AANSLUITEN!` · `IK STA HIER AL` / `SINDS ZES UUR.` · `NOG MAAR DRIE` / `BRIOCHES!` |
| taxi | `TE KORT!` · `DE METER LOOPT, HOOR!` · `INSTAPPEN! DE METER` / `LOOPT AL!` · `ROOD? DAT IS MEER` / `EEN ADVIES.` · `NACHTTARIEF, HE.` · `€87,50. CONTANT,` / `ALSJEBLIEFT.` |
| dealer | `COKE? XTC?` · `PSST. VRIEND.` · `DANKJEWEL!` · `OKE, OKE, TERUG!` |
| gids | `EN HIER ZIET U` / `DE OUDSTE BRUG...` · `NIET FOTOGRAFEREN` / `BIJ DE RAMEN!` · `MAAR... HET` / `UITZICHT!` |
| handhaver | `STILSTAAN OP DE BRUG?` / `€190 BOETE.` · `BLOWVERBOD. BOETE!` |
| huisjesmelker | `DE HUUR, GRAAG.` · `HUURVERHOGING!` · `€1.900. EXCLUSIEF.` · `€2.400. PLUS` / `SERVICEKOSTEN.` · `€3.100. DAT IS` / `DE MARKT, HE.` · `WIE MOET ER` / `EEN SLEUTEL?` · `DAT IS GEEN SCHIMMEL,` / `DAT IS KARAKTER!` · `VENTILEREN, HE!` · `MIJN... MIJN` / `BELEGGING...` |
| huurder | `€1.900 PER MAAND` / `EN GEEN KEUKEN!` |
| announcer | `MISSIE TWEE. HOU JE PORTEMONNEE VAST!` (oat) · `MISSION THREE. VOL GAS!` (rally, new take) · `MISSIE VIJF. BLIJF BIJ ELKAAR, ZWAANTJES!` (oldenzaal, new take) |
| Gusto | the oat card's two lines (§1.1); the rally card's new first line (§1.2) |

- A speaker's next bubble cuts their playing line (`SpeechLane`): scene beats get per-line ticks
  that fit the shipped takes (copy `tests/content/oldenzaal-voice-fit.test.ts` as
  `oat-voice-fit.test.ts`).
- The `€` in a voiced line is spoken as "euro" (the `say` text in the spec; the bubble shows `€`).

### 9.3 The sample group and the credits
- A new group `mission:oat`: `SAMPLE_GROUPS` (`engine/samples.ts:94`), `GROUP_DIRS` and
  `LAZY_GROUPS` (`tools/audio/lib.ts:88`, `:101`), the hard-coded group names
  (`tools/audio/spec-types.ts`, `ship.ts`, `review.ts`), the def's `audioGroup`, and
  `content/samples/oat.ts` that merges the `ams` sfx and voices without the `ams` songs (the reused
  handhaver and rider takes), like `content/samples/ring.ts`. Shipped to `public/audio/oat/`.
- **Estimate** (the AUDIO agent's plan run gives the real number): 11 designed voices × 2 design
  calls ≈ 6,200 credits; about 80 lines × 3–4 takes ≈ 10,500; about 55 sfx ≈ 8,000; 5 songs with
  parts ≈ 7,500; the changed fixed lines (oat, rally and oldenzaal announces, Gusto's lines) ≈
  1,000: **about 33,000 credits planned**. Earlier plans ran high (oldenzaal: plan 32,270, spent
  about 17,200), so the real spend may be near 18,000–20,000.
- **Cap: 35,000 credits.** No generation before the user OKs the plan's number (open question
  Q1). Picks by speech-to-text check and the shorter take. The key lives only in `.env.local`,
  read by the audio tool alone; no agent opens, prints, commits or logs it.

## 10. Originality and sensitivity

`docs/ORIGINALITY.md` gets a dated paragraph **"Exception: mission `oat` (OAT OF CONTROL,
2026-10-31)"** that extends the `ams` exception and the generated-audio exception:

- **Real places**: Amsterdam, de binnenstad, De Negen Straatjes and their street names, the
  Prinsengracht, Keizersgracht, Herengracht and Singel with their bridge shapes, the Westertoren,
  the Grimburgwal, the Oudezijds Achterburgwal and Voorburgwal, the Trompettersteeg, the Oude Kerk
  and the Oudekerksplein, De Wallen, the Warmoesstraat, the Prins Hendrikkade, the station front,
  the IJtunnel and the A10 (the `ring` exception). Likeness by typology; never a real façade with
  its real house number; no real shop, bar or venue name.
- **Parody and generic names only**: `FORT NEGEN & ZESTIG` (the real bakery is never named in the
  game; the staff stay friendly; the product is a generic `KAASBRIOCHE`), `BRAMMOBIEL`, `DE
  HAVERBAR` / `HAVERMELK`, `MINDER`, `DE FISCUS` (no agency logo), `TAXI`, `TE KOOP` / `TE HUUR` /
  `VERKOCHT O.V.`, our own neon words. Each new name is searched once; a real business with that
  name gets a new parody. Never the city's letter sculpture, logo or slogan; the XXX on bins is our
  own motif, never the arms as a logo.
- **Behaviours, not groups**: dealers and taxi drivers come from the mixed look pool; no origin,
  accent or flag is a joke. **Sex workers are never shown, targeted or joked about**: window frames
  are architecture only (closed curtains, red tubes, a number; no figure; no blue window light);
  the 03:00 lights-out is a stated liberty (§6.9). Kids are never hurt; deposit hunters, queue
  people, tourists and viewers are never targets; the gloat rule holds for every new enemy. The
  Oude Kerk is backdrop only. Drug words appear only as the dealer's whisper; his "pills" are mints.
- **Photos**: free-licence references in the git-ignored `tmp/oat/ref/` (attribution in
  `LICENSES.md`), likeness only, never traced, sampled or pixel-copied, never in `src/`, `public/`,
  `tests/` or a build; their hex values only guide hand-built ramps.
- **Audio**: ElevenLabs music, sfx and designed voices (group `mission:oat`) under the `ams` audio
  rules; prompts in our own words, never a named song, artist, game, composer or real voice; synth
  fallbacks for every id.
- The rules about other games apply in full; this file and every prompt name no commercial game,
  studio or artist.

## 11. Architecture and files

| Part | Where | Rules |
|---|---|---|
| Mission | `src/game/content/missions/oat/`: `index.ts` (`OAT` def: `id 'oat'`, `name`, `subtitle 'MISSION 2'`, `start 'oat-a'`, sections in play order, `bossSection 'oat-d'`, `bossSections`, `next 'rally'`, `hostages {}`, `artDensity 4`, `economy 'euro'`, `tally 'receipt'`, `denseReserve`, `preloadFirst/Last`, `art`, `audioGroup 'mission:oat'`), `ids.ts`, `lines.ts`, `card.ts` (`defineMissionCard`, the folder), `terrain.ts`, `section-{a,b,c,c1,d,e}.ts`, `script-*.ts`, `backgrounds.ts`, `helpers.ts` | a normal `defineMission` 2D mission on the unchanged `MissionRunner`; section ids `oat-…` |
| Scenery kit | `missions/oat/facade/` (grammar, parts, street sheets, opposite row, wear), `missions/oat/floor/` (painter, materials wet/dry, water tiles, reflection strips, layouts, decals), `missions/oat/light/` (sun table, `defineSectionLight` for `oat-d`, `oat-e`, lamp groups), `missions/oat/art/` (decor sprites, signs, neon, bridges, shops, the two boss houses) | one density-generic drawer per id (`Pen`); index painting for strips and layers |
| Content | `src/game/content/oat/`: `traffic/` (brammobiel, bakfiets, taxi), `wallen/` (dealer, tour group), `budget/` (bins, cans, envelope, shop, conceptstore), `set-pieces/` (hijsbalk, draaiorgel, queue, kade collapse, sinkhole, pontoons, closed bridge, crane boat, neon-out), `taxi-ride/` (carrier, seat, scooter), `npcs/` (barista, staff, grinder, guide, tenant, background figures, viewers) | oat rng use stays inside oat entities; no entity in a shared path |
| Bosses | `src/game/content/bosses/oat-makelaar/`, `src/game/content/bosses/oat-huisjesmelker/` (geometry, phases, shots, mould, art, voice) | `boss.ts` API; tells ≥ 18 |
| Audio | `content/music/oat.ts`, `content/sfx/oat*.ts`, `content/samples/oat.ts`, `tools/audio/spec.ts` entries, `public/audio/oat/` | §9.3 |
| Budget (new) | `src/game/budget/`: `ledger.ts` (cents, categories, extends), `format.ts` (`€ 1.234,56`), `pay.ts`, `euro-table.ts` (§7.2), `tax.ts` (fines, toeristenbelasting), `scores.ts` (the `budgets` table) | integer cents only; pure, node-tested |
| Budget hooks (additive) | `session.ts` (`PlayerSlot.cents`), `events.ts` (`pay` next to `awardScore`), `runner.ts` (pay events → pop-ups; the tax in `continuePlayer`; the fine on a `BOETE` death; `slowWorld`), `hud.ts`, `app.ts` (`euroText`, default rows), `scenes/receipt-tally.ts` (new), `gameplay.ts` (the receipt branch), `high-scores.ts`, `name-entry.ts`, `title.ts`, `mode-select.ts`, `game-over.ts`, `final-tally.ts`, `fps-tally.ts`, `fps/hud.ts`, `fps/*` pay sites, `rally/score.ts`, `engine/font.ts` (`€`) | every change keeps the old behaviour for point missions |
| Strips (new CORE store) | `src/game/mission/strips/` (store, jobs, eviction, light sets, accounting), `SectionDef.strips?` (`types.ts`), drawn by `src/game/mission/view.ts` at the façade depth | art jobs ≤ 16 ms; prefetch per scroll speed |
| Light | `src/game/mission/light/api.ts` (moved; `content/oldenzaal/kit/light-api.ts` re-exports), `pass.ts` / `lightmap.ts` (smooth glow, streaks, groups, the bake cross-fade), `src/game/art/hd/light.ts` (`SunDef`; `KEY` default) | oldenzaal byte-identical |
| Water overlays | `src/game/mission/floor/reflect.ts` (dynamic reflections), fx wakes in oat content | Canvas 2D only; GL floor shader unchanged |
| Palette | `src/engine/palette-hd.ts` `PAL_HD_OAT`; `BgCanvas` LUT parameter (`missions/ams/art-hd-bg-kit.ts`, default `HD_PALETTE`) | ≤ 256 per mission set |
| Route and flow | `scenes/flow-data.ts` (`FPS_ROUTE`, `goldenRecordRoute`, comments), `scenes/flow.ts` (the route guard; oat by id), `content/missions/ams/index.ts` (`next: 'oat'`), `content/ui/cards.ts` (rally `MISSION 3` + announce + line 1; oldenzaal `MISSION 5` + announce), `missions/oldenzaal/index.ts` (`subtitle`, `announce`), `content/rally/radio/lines.ts` (`RALLY_CARD_LINES`, `RALLY_ANNOUNCE`), `scenes/rally-glitch.ts:91`, `:327` (`MISSION 3`), `tools/audio/spec.ts:1254`, `:1311-1313`, the number comments listed in `tmp/oat/arch-map.md` §2.2 | the dormant ring card keeps MISSION 2 |
| Lazy content | `content/index.ts` (a lazy `oat` entry; orchestrator-owned file), `isLazyContent`, `scenes/mission-intro.ts` (`isOat`: load the chunk, then `preloadMissionArt` / `preloadMissionAudio`; the folder draw), `boot.ts` / `params.ts` (a direct `?mission=oat` loads the chunk first), `src/game/art-worker.ts` (load oat on demand, as fps) | boot@1x ≤ 4.0 s unchanged |
| Sim and tools | `tools/sim.ts` (load oat; `--mission oat`), `src/sim/headless.ts` (the `budget` field), `src/sim/bot*.ts` (the queue, the Swan under auto-scroll, crouch at `BUKKEN`, hop pontoons, the seat mode, avoid mould, low/high keys), `tools/smoke.ts` (`followOat` before `followRally`; doc lines `:17-38`, `:543`, `:574`) | the CI route must pass in the same commit as the route switch |
| Tests (new) | `tests/content/mission-oat.test.ts` (registration, card, sections: `playerStart` on the floor, checkpoints ≤ 1,400 px, exits inside, ids and prefixes unique, lines fit bubbles, palette), `tests/game/oat-flow.test.ts`, `tests/content/oat-dense-budget.test.ts`, `tests/game/budget/*.test.ts`, `tests/content/oat-*.test.ts` (enemies: tells, tokens, gloat/cower; bosses; set pieces), `tests/art/oat-*.test.ts` (scale, grammar no-repeat, strips store, sun default unchanged, palette), `tests/content/oat-voice-fit.test.ts`; `tests/art/scenery-hi.test.ts` fixture (`UPDATE_SCENERY_FIXTURE=1`, oat lines only) | |
| Tests (pinned, change) | the list in `tmp/oat/arch-map.md` §2.2 (mission-ams, ams-art, scenes, ring/flow, rally/contract, fps/flow, rally/scene, rally-radio-lines, audio-spec, mission-oldenzaal, oldenzaal-flow) plus the score pins of the code map's §3.5 item 3 where a euro rule touches them; `tests/game/mission-light.test.ts:41-50`; `tests/content/modules.test.ts` (load oat first) | |
| Docs (by the builders) | `docs/api/oat.md`, `docs/api/budget.md` (new); `ORIGINALITY.md` (§10), `ART_GUIDE.md` (the oat style paragraph), `GAME_DESIGN.md`, `ARCHITECTURE.md`, `design/rally.md` §1 and `design/oldenzaal.md` §1 (new numbers), the other route-number docs of the code map | |

## 12. The build: three workflow waves (every worker agent at effort xhigh, never max)

Rules for every wave: one workflow; the builders own separate folders; each agent gets its own
port (never 5173, 4173 or 5520); a snapshot `.claude/snapshots/oat-pre-<wave>.tgz` before the
wave; after it the lead runs the gates (§13), looks at the frames, commits locally on main (no
push) and reports. ElevenLabs only in wave C, after the user's OK.

### 12.1 Wave A — the foundation and the first street (then the LOOK STOP)

| Agent | Owns | Delivers |
|---|---|---|
| CORE (alone, first) | ids, contracts, flow, stubs | the oat stub (all six sections playable as placeholders), lazy content + the worker path + the direct start, the route switch (§1, §11 route row) with smoke `followOat` and the pinned tests, the route guard, the light API move, `SunDef` (default `KEY`), the `BgCanvas` LUT parameter, `PAL_HD_OAT`, the `€` glyphs, the strips and budget contracts, `docs/api/oat.md`, the `ORIGINALITY.md` paragraph, identity baselines before the wave |
| BUDGET | `src/game/budget/`, the budget hooks | §7 complete for ams, oldenzaal, fps, rally: ledger, pay path, HUD, pop-ups, euro tables, fines, tax, extends, the `budgets` table and screens, `receipt-tally.ts`, 2P, the sim field |
| STRIPS | `src/game/mission/strips/`, `view.ts` | the store (§8.6), jobs and slicing, prefetch by scroll speed, eviction, two light sets, the memory accounting, tests |
| LIGHT-WATER | `missions/oat/light/`, `mission/light/*`, `mission/floor/reflect.ts`, oat water tiles | §8.3–§8.4 (sun table, the shadow function for floor, strips and the opposite row, stretched contact shadows), §8.8 (water), §8.9 flags (smooth glow, streaks, lamp groups, the cross-fade) |
| GRAMMAR | `missions/oat/facade/` | §8.6: parts, the 9 Straatjes and Oudezijds sheets, the sequencer and its tests, façade wear and wetness, painters at 1× / 2× / 4× |
| STREET-A | `missions/oat/floor/` (a), `backgrounds.ts`, `missions/oat/art/` (a) | §8.7 a: layers, floor materials (wet/drying/dry) and wear, bridges and canal vistas, street furniture, the shops (Haverbar, conceptstore, `TE KOOP` house); plus the **night proof strip** of `oat-d` 0–1,280 (layers, our-row strips, the front canal with streaks) |
| AUDIO | the group plumbing, `tools/audio/spec.ts` | §9.3 plumbing, the full spec, the plan's credit estimate (`tmp/oat/audio-estimate.md`), synth fallbacks for every id; no generation |
| INTEGRATE-A | | oat-a walkable end to end with the `ams` locals as stand-in enemies, the shop and bins live, the d strip viewable (`section=oat-d`); budgets, the CI smoke, the scenery fixture, sims |
| REVIEW → FIX | | the §8.13 criteria, perf (§8.12), the gates |

**LOOK STOP (user):** the user looks at and plays oat-a and the d proof strip at 4× (2× also
shown), with the lead's frame sheet against `ams`. The user's feedback becomes a dated revision
in §0 before wave B.

### 12.2 Wave B — the day

| Agent | Owns | Delivers |
|---|---|---|
| CAST-DAY | `content/oat/traffic/` | brammobiel, bakfiets, taxi (§3), gloat/cower, art at real fidelity |
| MAKELAAR | `bosses/oat-makelaar/`, `npcs/` viewers | §4 with the courtage and the bezichtiging |
| PIECES | `content/oat/budget/`, `set-pieces/` (hijsbalk, draaiorgel) | §6.1–§6.6 incl. the `slowWorld` opt-in |
| QUEUE-B | `section-b.ts` art and scripts, `set-pieces/queue.ts` | §2.2 scenery (§8.7 b) and §6.7 |
| KADE | `section-c.ts`, `section-c1.ts`, `set-pieces/kade*.ts`, the c floor/strips | §2.3–§2.4, §6.10, §8.7 c; the Swan's return; the bot mode |
| INTEGRATE-B → REVIEW → FIX | | scripts a, b, c, c1; the bot 1P/2P every section; budgets; sims; an internal look check |

### 12.3 Wave C — the night and the way out

| Agent | Owns | Delivers |
|---|---|---|
| NIGHT | `section-d.ts` scenery, neon sprites, the arena's dark set | §8.7 d (the alley, the Voorburgwal, the square, the Oude Kerk), §6.9 |
| CAST-NIGHT | `content/oat/wallen/`, `taxi-ride/scooter.ts` | the dealer, the tour group (§6.8), the handhaver scooter |
| HUISJESMELKER | `bosses/oat-huisjesmelker/` | §5 with the mould floor and the tenant gag |
| TAXIRIT | `section-e.ts`, `taxi-ride/` | §2.6, §6.11, the lean e scenery |
| SOUND | `public/audio/oat/`, the spec | generation after the user's OK; picks; the voice-fit test; ≤ 35,000 credits |
| INTEGRATE-C → REVIEW → FIX | | the whole mission, the kassabon with the fare, the folder card, the full route; new oat baselines; then the user's play-test |

### 12.4 Bot and pacing
- The bot must finish every section 1P and 2P (god and normal, every `--section`). Bot times are
  logged per section; a human-speed estimate sets the lock lengths (the oldenzaal lesson: tune
  HP with both).

### 12.5 Follow-up (out of scope): realism for `ams`
- `ams` gets the same realism later as its own wave (decision 39): the sun per section, the strips
  and grammar, water, wear, no façade outlines. It moves the `ams` frames and its 1× fixture on
  purpose, so it needs its own baselines and its own look stop.

## 13. Gates (the lead, after each wave)

1. `npm run typecheck`; `npx vitest run --maxWorkers=3` (rerun a timed-out file alone first).
2. Identity: the 13 sims of `tmp/floor-lead/id.sh` (`jq -S 'del(.timing,.seconds)'`): the DIFFs
   allowed are named in §7.10; everything else SAME. The ring's own sets SAME.
3. `npm run sim -- --mission oat --god --expect-complete` 1P and 2P, every `--section`, plus
   normal-difficulty runs; 0 errors; ticks in range.
4. `npx vite build`; `npm run smoke` on an own port for `mission=oat`, `mission=ams` and the CI
   route (`mission=ams&boss=1&debug=1`, `--route`: ams → oat card → oat → kassabon → rally card →
   glitch); `npm run cache-check` on a preview build; boot@1x ≤ 4.0 s.
5. A 4K browser run (`&art=4`, 1P and 2P) with 0 errors; the perf numbers of §8.12.
6. The tier-4 budget test (`oat-dense-budget.test.ts`); `ams-dense-budget` unchanged.
7. `npm run sprites -- <prefix> --density 1|2|4` sheets and `npm run shot -- --mission oat
   --section oat-x --x <x> --res 4 --art 4` frames (and `--art 2`, `--res 1`) looked at by the lead
   against §8.13.
8. Scans: no commercial game, studio or artist name; no real brand or venue name in game text; no
   photo, photo path or `.env*` in `src/`, `public/`, `tests/`; no `Math.random`, `Date` or DOM in
   `src/game` / `src/engine`; credits within the cap.

## 14. Risks

1. **The strips store** (L7) is the biggest engine change: depth must match the floor; 4× job
   time; fallback: façade sprites with a cap.
2. **Memory**: the 84 MB reserve plus the reused riders; the cut order in §8.12; `ams` must not grow.
3. **The budget touches the whole game** (~30 pay sites, every tally, fps, rally, high scores): one
   owner, additive opt-ins, the §7.10 baseline rule.
4. **The CI route** breaks unless smoke learns oat in the same commit as the route switch.
5. **The mixed scale** may look odd at the seam or squat: the seam and window-ratio rules, the look
   stop. **The convention sun** in a and b differs from the compass (the user's rule).
6. **Readability** in shade, at night, with reflections: shade ≤ 1.5 tones, the hittable outline
   rule, the 1× check; no full-screen flash, ≤ 3 flashes per second (the ring light, the tunnel).
7. **New mechanics without engine support** (queue, crowd push, mould, slow motion, shop, seat):
   oat entities or additive opt-ins, each bot-completable. **The Swan under auto-scroll** is new
   for the bot; the pontoon hop needs a jump from the water (check early; else low ramps).
8. **Determinism**: integer cents; rng only inside oat entities; no new entity on a shared path
   (entity id order reshuffles the ring's variants).
9. **Sensitivity** in d (§10), reviewed in every wave. **ElevenLabs**: four fixed voiced texts need
   new takes; cost and take quality (the user listens after wave C).

## 15. Open questions for the user

- **Q1** — ElevenLabs: OK to generate up to the plan's estimate (about 33,000 planned, cap 35,000
  credits) in wave C?
- **Q2** — The kassabon: only for `oat` (lead default), or the tally of every euro mission
  (`ams` and `oldenzaal` would lose the newspaper)?
- **Q3** — In `ams`: besides the euros, also the `BOETE` fine on a ticket death and the
  toeristenbelasting on a continue (lead default: yes, they are score rules)?
- **Q4** — The season: a late-September day (lead default: green elms with the first yellow
  leaves, a truly dark night for d, a compass-true low sun in c) or high summer (fuller trees and
  a dawn at the A10, but June nights never get fully dark)?
- **Q5** — The way out: the IJtunnel to the A10 north (lead default) or the Wibautstraat to the
  A10 east?
- Still open from the proposal (not needed for this build): where the unused ideas go (Vondelpark,
  De Pont, Albert Cuyp-markt, NDSM-werf, De foodhal, the wafel-winkel, the auction, the levend
  standbeeld), and whether the dormant `ring` ever changes (lead: no; it keeps points).
