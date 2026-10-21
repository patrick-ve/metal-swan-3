# Mission oldenzaal — level 4, the haunted town (spec, 2026-10-21)

The user (2026-10-21): a new level after level 3 (the first-person floors). After their work on
the A10 ring the squad is parachuted into the town of Oldenzaal, which is infested with nazi
zombies. They start in the main shopping street, meet Meneer Wu (Mr. Wu) at the snack bar **De Smulhoek**,
who gives them a `PATAT MAYO MET 2 FRIKANDELLEN` as a power-up and tells them about the
paranormal activity: the ghost of **Mevrouw Winkel** has been sighted, and she makes the restless
souls of dead Nazi soldiers take possession of the inhabitants. The first mini-boss is the cursed,
living **statue of St. Plechelmus** in front of the **Plechelmus Basilica**. After it, the squad
enters the basilica and fights the possessed inside, escapes the horde by climbing the basilica's
tower, and is trapped at the top until the **Metal Swan** from level 1 saves them and carries them
to a second stage (TBD, built later). The atmosphere is **spooky, dark and grim**, in contrast to
the Amsterdam levels.

This file is THE SPEC for the oldenzaal waves. Detail values (speeds, HP, sizes, timings) may be
tuned by the builders when play shows a better value; the report says what changed and why.

Originality: `docs/ORIGINALITY.md` and `docs/research/mechanics.md` §23 apply in full. Never name
any reference game in code, ids, comments or docs. Real Oldenzaal names are allowed under a new
dated exception (§12). The user's reference photos (Street View and photo captures of De Smulhoek,
the basilica and the statue) are for likeness only and never enter the repository.

## 0. Decisions

| # | Item | Decided by |
|---|---|---|
| 1 | New 2D mission `oldenzaal` = level 4 (`MISSION 4`), after the first-person floors | user |
| 2 | **Meneer Wu: our own design, the name stays**; a **hard-working** owner of De Smulhoek with a **Chinese background** (the user); no likeness of a real person, no accent, no stereotype | user |
| 3 | **Mevrouw Winkel is fictional** (made up by the user): a middle-aged woman with dark grey hair | user |
| 4 | The zombies are **possessed townspeople**: daily clothes, a ghostly grey soldier helmet, green glowing eyes, a see-through soldier soul over them; **no Nazi symbols** anywhere in this mission | user |
| 5 | **Shoot the soul out**: at 0 HP the soul rises and fades; the person falls dazed, then runs off (bloodless; the townspeople are victims) | user |
| 6 | The meal: a 20 s **snack power** (faster fire, one hit absorbed by a mayo splat) + **2 frikandel bombs** (a holy-mayo blast that drives the souls out of a group) | user |
| 7 | The climb: **inside the tower**, scrolling up, a **horde tide** climbs up behind the players; the bells swing as hazards | user |
| 8 | The rescue: a **cutscene**; the Swan comes with **rocket units under her wings**, the heroes jump on, she flies off into the storm | user |
| 9 | About **7 minutes, 5 sections**: the drop + the shopping street, De Smulhoek, Plechelmusplein (the statue boss), the nave, the tower | user |
| 10 | The statue: **possessed, 3 phases, freed at the end** (it sits back on its plinth, whole) | user |
| 11 | Mevrouw Winkel: **story moments only** here (she cannot be hit); her fight comes in stage 2 | user |
| 12 | The nave: **horde + church set pieces**, no mini-boss, nothing mocks the faith | user |
| 13 | Audio: **ElevenLabs for this level** (music, sfx, designed voices for Meneer Wu, the ghost and the statue); a new dated exception (§12); synth fallbacks for every id | user |
| 14 | Darkness: **dusk → night → storm**, darker step by step (§10) | user |
| 15 | Story: a **typed story card** after the first-person floors + the `MISSION 4` card; Meneer Wu tells the rest in voiced bubbles | user |
| 16 | After the Swan: **MISSION COMPLETE tally → `TO BE CONTINUED` card → today's ending** → name entry | user |
| 17 | Build in **two workflow waves with a play-test stop** between them; every agent at effort **high** | user |
| 18 | The atmosphere is **spooky, dark and grim** | user |
| 19 | All new art at 1×, 2× and 4× (one density-generic drawer per family) inside the tier-4 budget | standing rule |
| 20 | The mission is a normal `defineMission` 2D mission on the unchanged `MissionRunner`; new engine features only as additive opt-ins (§13) | lead (architect) |
| 21 | Section ids `oz-a` … `oz-e` (the art packs are keyed by section id; `a` … `e` would share ams's packs) | lead default |
| 22 | The card's subtitle: **`A HAUNTING IN OTOWN`** ("Otown" = Oldenzaal) | user |
| 23 | The statue's plaque shows only `ST. PLECHELMUS` in our own lettering (not the real plaque's other lines) | lead default |
| 24 | Patrick ("master of eating frikandellen", his bio) gets a longer snack power (30 s) | lead default |
| 25 | The free souls can possess a fleeing townsperson again if the players do not shoot them (§3.4) | lead proposal |

Scope: the new mission `oldenzaal`, its flow changes and the engine opt-ins it needs. `ams`, `ring`
and the first-person floors keep their content; `ams` (lower and upper), m0 and m2 keep their sims
byte-identical, and the ring's sims stay byte-identical too.

## 1. Flow and numbering

- Normal play: … → the first-person floors (level 3, `MISSION 3`) → their tally → the **story
  card** → the `MISSION 4` card → `oldenzaal` → MISSION COMPLETE tally → the **`TO BE CONTINUED`
  card** → today's ending (the first-person variant) → name entry / high scores.
- The story card (a full-screen typed card like the glitch bridge, our own text, skippable): the
  ring is clean; a call comes in from Oldenzaal; the squad is flown east and parachuted over the
  town at dusk. 3–5 short lines, English with Dutch flavour.
- The intro card: `MISSION 4` and the subtitle `A HAUNTING IN OTOWN` (the user's title); place
  `OLDENZAAL`.
- Numbering: the first-person floors count as one level (`MISSION 3`), so `oldenzaal` is
  `MISSION 4` and its high-score column is `M4`. `FPS_ROUTE` gets `oldenzaal`, with the number
  special-cased (today `missionNumber` would give 5).
- `?mission=oldenzaal` starts it directly (with `section=oz-a … oz-e`, `players`, `char`, `god`,
  `debug`, `art`, `res`, `difficulty` as today). `?mission=oldenzaal&boss=1` starts at the statue.
- After the first-person mode (one slot), P2 rejoins the 2D runner as in the ring → fps hand-off;
  verify P2 and the continues.
- The `TO BE CONTINUED` card: night sky, the Swan's jet trail, the ghost's face fading in and her
  laugh; then today's ending. Stage 2 plugs in between this card and the ending later.
- **Trap:** `listMissions` sorts ids, so `oldenzaal` comes after `m5` and would become m5's
  default `next`. Keep m0–m5 exactly as they are (an explicit `next` or a filter).

## 2. The sections (about 7 minutes)

| Section | Place | Time | Light | Content |
|---|---|---|---|---|
| `oz-a` | the drop over the roofs, then the main shopping street | ~1:45 | dusk: a low red sun, fog, flickering lamps | the parachute start (`introDrop`), closed shops, the first possessed, frightened townspeople, free souls; Mevrouw Winkel watches from a roof and vanishes |
| `oz-b` | the street corner with **De Smulhoek**, the basilica's tower above the roofs | ~1:00 | late dusk | the Meneer Wu scene (the story, the meal), a short fight on the way to the square |
| `oz-c` | **Plechelmusplein** (red-brick pavers, the basilica's long side as the backdrop) | ~1:30 | night, full moon | the statue boss (§5) |
| `oz-d` | **the nave** of the basilica | ~1:30 | candle light, lightning in the windows | the horde and the church set pieces (§7) |
| `oz-e` | **the tower**, scrolling up to the top | ~1:30 | storm: rain, lightning | the climb, the horde tide, the bells (§8); at the top the Swan finale (§9) |

- Checkpoints at most 1,400 px apart (the mission tests). `oz-e` is a vertical section
  (`scroll: 'up'`, like m3-b1, about 384 × 1,800 px).
- 2P co-op everywhere, as in ams. The in-world continue applies (gloat, cower, stagger).

## 3. The possessed (enemies)

### 3.1 The look and the rule
- Hosts are Oldenzaal townspeople in daily clothes (shoppers, a jogger, a butcher in an apron, a
  student, a market vendor, a pensioner with a walking stick; churchgoers in the nave). They wear
  a **ghostly grey soldier helmet** (WW2 style, see-through, no insignia) and have **green
  glowing eyes**; a pale, see-through **soldier soul** (greatcoat, helmet, no symbol) hovers over
  and behind the host and moves with it, a little delayed.
- **No Nazi symbol** in this mission (not on souls, banners, flags or walls). No blood: the souls
  are pale green-grey mist.
- Never the reference game's zombie gags: no vomit attack, no hero transformation, no cure item.

### 3.2 Kinds (the builders may add one more if play needs it)
1. `oz-shambler` — slow walk (about 0.5 px/tick), arms forward; a grab / claw at close range
   (a tell ≥ 18 ticks; the attack box is live only in the strike). The common enemy.
2. `oz-gunner` — the host stands still and the **soul raises a ghost rifle**: a slow, visible
   spectral shot along the ground or a low arc (a long tell: the rifle glows).
3. `oz-brute` — a big host (the butcher, a bouncer): more HP, a heavy charge, knocks over street
   furniture.
4. `oz-soul` — a **free soul** (a flyer, `body: false`): it drifts and swoops at the heroes; it
   dies in a few shots. Free souls come out of drains, chimneys and chandeliers.
5. Townspeople (neutral NPCs): frightened people who run and hide. A free soul that reaches one
   **possesses** him (§3.4).

### 3.3 Shooting the soul out (the user's rule)
- Shots hurt the host's HP as usual (the host is the hit box). At 0 HP the **soul is ejected**: it
  rises with a wail, flickers and fades (about 40 ticks; a few points more if shot while it
  rises). The person drops, sits up dazed (about 60 ticks), then runs off screen with a thank-you
  line now and then (`BEDANKT!`, `WAT IS ER GEBEURD?`). Score as for a kill.
- The knife and the grenades work the same. The frikandel bomb ejects every soul in its blast at
  once (§4.3).

### 3.4 Re-possession (lead proposal)
- An ejected soul that is not shot drifts off; a **free soul** that touches a fleeing or dazed
  townsperson possesses him again (a 30-tick tell: the soul circles and dives). This gives the
  street a reason to shoot souls fast. Never more than 2 re-possessions on screen at once.

### 3.5 Gloat and cower (the in-world continue)
- Gloat: the hosts sway and groan, the souls circle above the gloat spot (no pointing, no
  laughing; `docs/research/mechanics.md` §23). Cower: the souls pull back into the hosts, the
  hosts flinch.

## 4. Meneer Wu, De Smulhoek and the meal

### 4.1 De Smulhoek (likeness of the real building, from the user's photo)
- A three-storey 19th-century corner building: white-painted brick on the ground floor with
  cream pilasters and cornices, dark red-brown brick on the upper floor bays, a cream bay with a
  green scalloped window awning, a dormer with three windows on the roof, a dark tile roof.
- The shop front: a **dark-green sign board with `de Smulhoek` in cream script** (our own script
  lettering), a green door frame, a menu board on the pavement, a closed parasol, a hanging
  flower basket on the double street lamp beside it.
- In the dark of `oz-b` its windows glow warm yellow: the only cosy light in the town.

### 4.2 Meneer Wu (our own design)
- In the game he is **MENEER WU**. The user: a **hard-working** owner of De Smulhoek with a
  **Chinese background** (like many Dutch snack-bar and restaurant families). Middle-aged, black
  hair with some grey at the temples, a white apron over a short-sleeved shirt, sleeves rolled
  up, a towel over the shoulder, a fry scoop in his hand; East Asian features drawn with the same
  care as the squad's faces (normal open eyes and a warm, tired smile).
- His joke is his **work ethic**, never his background: the fryer keeps going through the zombie
  night, he wipes the counter while he talks, he will not close before closing time
  (`IK SLUIT PAS OM TIEN UUR.`), he hands out the meal as if it is a normal Saturday.
- Our own design: **no likeness of a real person**. **No stereotype** in look, sound or text
  (ORIGINALITY.md): no slit-line eyes, no buck teeth, no conical hat, no queue, no "Chinese-style"
  lettering, no accent and no broken Dutch or English, no jokes about his origin. He is brave,
  kind and a bit gruff.
- The scene (like the ams FABEL FRIET briefing, `section-a.ts` `briefing()`): the heroes reach
  the corner, the input locks, Meneer Wu waves them in from the door, says 4–6 short lines (voiced,
  ElevenLabs designed voice) about the ghost of Mevrouw Winkel and the soldiers' souls, and
  tosses each living hero a paper tray: `PATAT MAYO MET 2 FRIKANDELLEN`. Skippable after 20
  ticks; the meal is given even when skipped.

### 4.3 The meal (the power-up)
- **Snack power** (a status like Helium Head, `player/status.ts`): 20 s (Patrick: 30 s); fire rate
  ×1.5; one hit is absorbed by a mayo splat (a white splash, a `SPLAT!` pop); a HUD icon (a tray
  of fries) with a countdown ring; a warm tint pulse on the hero.
- **Frikandel bombs**: 2 per hero, a special throw (BOMB while you have them; then the normal
  grenades come back): a frikandel in a high arc, a **holy-mayo blast** on landing (a wide
  radius) that ejects every soul in it at once and blasts free souls. No other damage to people.
- In 2P each hero gets their own meal. A later continue does not give a new meal.

## 5. The statue boss: St. Plechelmus (oz-c)

### 5.1 The look (likeness of the real statue, from the user's photo)
- A seated bishop: a tall mitre, a long robe and cope with a broad collar, the right hand raised
  holding a small object, the left hand holding a long **crozier** with a curled head across the
  body; weathered grey-green stone. On a tall **stepped plinth** of square stone blocks with a
  dark plaque (`ST. PLECHELMUS` in our lettering). Size about 64 × 120 px on screen with the
  plinth (a big boss at 1×).
- The square: red-brick pavers in a herringbone, benches, the tall black street lamps, the
  basilica's side behind (§10.3).

### 5.2 The fight (the user's choice: possessed, 3 phases, freed at the end)
- **Phase 0 — decor.** The statue looks like decor; shots chip dust but do nothing. A wave of
  possessed comes over the square. Then **Mevrouw Winkel** glides in, laughs, and **flies into
  the statue**: the stone cracks, the eyes glow green, the boss bar `ST. PLECHELMUS` fills; the
  camera locks.
- **Phase 1 — seated** (100 % → 60 %): it stays on its plinth. The **crozier sweep** (a low sweep
  across the square: jump it; tell: the crozier glows and swings back), the **thrown stone** (it
  breaks a block off the plinth and lobs it; it shatters into small bouncing stones), the raised
  hand casts a slow **curse orb** that drifts toward a hero.
- **Phase 2 — on foot** (60 % → 25 %): it steps down off the plinth, heavy and slow. The
  **ground slam** (a shockwave along the pavers: jump it), the **crozier hook** (it hooks a hero
  and pulls him in; shoot the crozier head or jump to break free), a short stomp walk across the
  arena.
- **Phase 3 — cracked** (25 % → 0): cracks glow, the **souls swirl out** as adds (`oz-soul`),
  faster sweeps, the curse orbs come in pairs.
- **Parts**: the head (the weak point, ×1.5 in phases 2–3), the crozier (breakable: no hook
  while it is broken, it re-forms from mist after a while), the body. Bosses do not use attack
  tokens; every attack has a tell ≥ 18 ticks and starts only on screen.
- **The end** (the user's wish: the saint is a victim): the ghost is torn out of the stone and
  flees into the basilica with a shriek; the cracks close; the statue walks back, **sits down on
  its plinth, whole**, and its eyes go dark. The basilica's red doors creak open. Points as for a
  boss (10,000), a weapon drop.
- Continue: the statue staggers (as ROBO-HALSEMA); its souls cower.

## 6. Mevrouw Winkel (the ghost; story moments only)

- Fictional (the user made her up): a **middle-aged woman with dark grey hair** (the user), in a
  pinned-up style, in an old-fashioned long dark dress with a high collar and a shawl, carrying an
  old lantern with a green flame. She is see-through and pale, with a cold green glow and a trail
  of mist (alpha + an additive glow pass, §10.2).
- She **cannot be hit** in this level (shots pass through her; she is not a target). Her
  appearances:
  1. `oz-a`: she stands on a roof at dusk as the heroes drop, raises the lantern, vanishes.
  2. `oz-c`: she glides in and possesses the statue (§5.2); she flees from it at the end.
  3. `oz-d`: she shrieks in the nave, slams the doors (the camera lock) and calls the souls down
     from the chandeliers.
  4. `oz-e` top: she floats beside the spire in the storm and watches the Swan fly off.
  5. The `TO BE CONTINUED` card: her face and her laugh.
- Her lines: few and short, our own (English with Dutch flavour), voiced by an ElevenLabs
  designed voice (an eerie, whispering middle-aged woman; never a clone or an imitation).

## 7. The nave (oz-d)

- The heroes enter through the **red doors** (from the photo: pointed-arch doors in the long side).
  Inside: a long nave with grey sandstone **pillars** and arches, rows of dark wooden **pews**
  (low one-way platforms and cover), **candle stands** and wall candles (flickering light
  sources), tall **pointed windows** with stained glass that flash white in the lightning, iron
  **chandeliers** high up, a stone floor with grave slabs, the organ loft at the far end.
- The set pieces: possessed churchgoers rise from the pews; the ghost slams the doors (a camera
  lock, a horde arena: two waves); souls drop from the chandeliers (a chandelier sways); the
  lightning shows the possessed in silhouette for a moment; at the west end a small door leads
  into the tower.
- **Respect** (the user's choice, ORIGINALITY.md: no religious stereotype): nothing in the nave is
  mocked, broken or burned; shots never damage the altar, crosses or images; no enemy wears a
  church vestment as a joke; the church is the place the squad frees from the curse.
- No mini-boss in the nave.

## 8. The tower climb (oz-e)

- A vertical section, scrolling **up** (about 384 × 1,800 px). Inside the square tower: wooden
  **stairs and landings** (one-way platforms, drop-through), heavy beams, the stone walls with
  narrow openings (rain and lightning outside), the **clock works**, the **bell chamber** with
  2–3 swinging **bells** (the bell is a hazard when it swings at a hero and a platform at rest; a
  bell toll stuns the souls near it for a moment).
- **The horde tide**: from about a third of the way up, a mass of possessed climbs up behind the
  players at a steady rate (like m3-b2's rising meltwater): it pushes the camera up and **kills on
  contact** (one hit, the genre rule). The players must keep moving; souls fly in through the
  openings; a few `oz-gunner` hosts stand on landings.
- **The top**: the roof platform under the small spire with the clock, the storm all around. The
  tide stops one landing below (the souls cannot pass the bells' last toll), the heroes are
  trapped: the ghost floats beside the spire (§6), then the Swan comes (§9).
- The bot must be able to finish the climb (the m3 platform-staircase rule: goals more than 20 px
  up; the tide must leave the bot enough time).

## 9. The Swan finale (the end of oz-e)

- A scripted, cosmetic **jet Swan** (`oz-swan-jet`), modelled on the m5 finale's flying ship
  (`m5/finale.ts`: a `Mountable`, `canMount` / `boardAll`, `autoRun`, `leave()`): the Metal Swan
  with two **rocket units under her wings** (blue-white flames) flies in from the storm, hovers
  beside the roof, the heroes jump on (in 2P both ride: the second hero on the tail perch, as on
  the Swan today), she turns and flies off into the clouds with a long jet trail. The ghost
  watches. Then MISSION COMPLETE.
- The Swan's look stays her own (a robot swan, ams art); only the jet units and the flight
  frames are new.

## 10. The atmosphere and the art

### 10.1 Dusk → night → storm
- `oz-a`: a low red-orange sun behind the roofs, a purple sky, thick ground fog, the street lamps
  flickering on, shop windows dark with shutters down.
- `oz-b`: late dusk, the fog thicker; De Smulhoek's windows are warm.
- `oz-c`: night, a **full moon** behind the basilica's tower, cold blue light, the statue in a
  pool of lamp light.
- `oz-d`: dark inside, warm **candle light** pools, cold flashes of **lightning** through the
  windows.
- `oz-e`: a storm: rain streaks, wind, lightning flashes that light the whole tower.
- Overall: desaturated, cold greens, greys and blues; warm light only from lamps, candles and De
  Smulhoek. The squad and the pickups stay readable (the readability rule).

### 10.2 New engine opt-ins (additive; ams and the ring unchanged)
- **A light pass for missions** (`MissionRunner` / the mission view, opt-in per section): a
  darkness overlay with additive light sources (lamps, candles, the ghost's glow, De Smulhoek's
  windows), a lightning flash, like the ring's tunnel light pass. Without the opt-in nothing
  changes.
- **Weather layers**: fog bands (parallax, drifting), rain streaks, wind gusts in `oz-e`.
- **Vertical chunk eviction**: dense chunks are evicted by x only today; the tower needs eviction
  by y too (else every chunk of a vertical section stays resident).
- **The ghost draw**: alpha ~0.5, then an additive tint pass and a glow sprite (render.ts
  `DrawOpts` `alpha` / `tint` / `blend: 'add'`). The souls use the same draw.
- **New light lists**: `Light` (ams art) today has morning, noon, golden and sunset only; add
  dusk and night for the new drawers.

### 10.3 The places (likeness from the user's photos; never traced)
- **The Plechelmus Basilica**: grey-brown **Bentheimer sandstone** (weathered, darker streaks), a
  tall square **Romanesque tower** (about 61 m in reality) in stacked tiers with rows of round-
  arched openings and blind arcades, a small spire with a clock and a cross on top; the **Gothic
  nave** with tall pointed tracery windows, stepped buttresses, a steep grey slate roof with small
  dormers and finials; red pointed-arch doors; benches along the wall.
- **The shopping street**: Dutch brick shop fronts of 2–3 storeys (red-brown and dark brick, white
  window frames, some plastered fronts), closed shutters, shop signs in our own lettering, the
  tall black **double street lamps** with hanging flower baskets, signposts (`MUSEUM`,
  `PLECHELMUSBASILIEK`, `STADHUIS`, `GANZENMARKT`, from the photo's signpost), red-brick pavers,
  bicycle racks, the basilica's tower always above the roofs.
- **Plechelmusplein**: the open square in front of the basilica (§5.1).
- Shop and brand names other than De Smulhoek are our own made-up names.

### 10.4 Palette and budget
- PAL_HD (209 of 256 colours today): new ramps for the sandstone, the dusk sky, the ghost green and
  the candle amber, inside the 256 limit. 1× keeps the 64-colour palette (mapped).
- Tier-4 working set: the mission's sprites + its dense scenery must fit `DENSE_BUDGET_BYTES`
  (256 MB; ams's worst case is 251.6 MB today), with a `denseReserve` for the scenery like the
  ring, and a budget test like `ams-dense-budget.test.ts`. 2P uses the same rules as ams.

## 11. Sound (ElevenLabs, with synth fallbacks)

- **Music** (ElevenLabs takes; synth fallbacks in `content/music/`): the level theme (a dark,
  slow organ and choir pad over a low heartbeat drum, rising in `oz-b`), the statue boss song
  (heavy, stone percussion, a choir), the tower chase (fast, the bells in the rhythm), a
  `TO BE CONTINUED` sting. Prompts in our own words, never a named song, artist, game or composer.
- **Sfx**: the souls' wail and eject, the hosts' groans, the ghost rifle, the brute's charge, the
  ghost's shriek and laugh, the stone crack, the crozier sweep, the ground slam, bells, thunder,
  rain and wind loops, the doors slamming, candles, the frikandel throw and the mayo splat, the
  jet Swan.
- **Voices** (ElevenLabs Voice Design, from text descriptions; never a clone or an imitation):
  `wu` (a warm, brisk, slightly gruff middle-aged man who sounds busy; plain Dutch-flavoured
  English; never an imitated or caricatured accent), `winkel` (an
  eerie, whispering middle-aged woman), `plechelmus` (a deep, stony rumble; 1–3 lines). Lines are
  our own text, short, English with Dutch flavour.
- Tooling: a new sample group for the mission (the group names are hard-coded in
  `tools/audio/spec-types.ts`, `lib.ts`, `ship.ts`, `review.ts` and `engine/samples.ts`). The
  AUDIO builder writes the spec and a **credit estimate** in wave A; the generation runs in wave B
  after the user's OK at the play-test stop. The ElevenLabs key lives only in `.env.local`: never
  print it, commit it or read the file.

## 12. Originality exception (a new dated section in docs/ORIGINALITY.md)

- Real names allowed in `oldenzaal`: Oldenzaal, the Plechelmus Basilica (Sint-Plechelmusbasiliek),
  Plechelmusplein, St. Plechelmus and his statue (a likeness, freed and whole at the end), the
  snack bar **De Smulhoek** (shown in a friendly light), and the signpost names (Museum, Stadhuis,
  Ganzenmarkt).
- Meneer Wu is our own design with a name the user chose: a hard-working snack-bar owner with a
  Chinese background, drawn and voiced without any stereotype (§4.2); no likeness of a real
  person. Mevrouw Winkel is fictional.
- **No Nazi symbols** in this mission; the soldiers are the villains' souls; bloodless.
- The possessed are not the reference game's zombie gag: no hero transformation, no vomit attack,
  no cure item.
- **Respect for the church**: no mockery of the faith, its objects or clergy; the saint is a victim
  of the curse and is freed.
- ElevenLabs audio for this mission (music, sfx, designed voices) under the same rules as the
  `ams` audio exception.
- The photos never enter the repository; all art is drawn by code, never traced or sampled.

## 13. Architecture and files

- `src/game/content/missions/oldenzaal/` — `index.ts` (`defineMission`, `introDrop: true`,
  `artDensity: 4`, `art`, `audioGroup`, `hostages: 0` unless the builders add some), `terrain.ts`,
  `section-oz-{a,b,c,d,e}.ts`, `backgrounds.ts`, `art*.ts`, `helpers.ts`, `entities.ts` (Meneer Wu,
  the townspeople, the ghost, the jet Swan), `finale.ts`.
- `src/game/content/oldenzaal/possessed/` — the hosts, the souls, the eject, art.
- `src/game/content/bosses/oldenzaal/` — the statue (parts, phases, art, voice).
- `src/game/content/characters/snack-power.ts` (the status) and the frikandel bomb (with the
  grenade code); a meal pickup in `content/items/`.
- `src/game/content/music/oldenzaal.ts`, `src/game/content/sfx/oldenzaal.ts`.
- Flow: `scenes/fps-route.ts` (fps → story card → intro), a story card scene (the glitch bridge's
  pattern), `scenes/flow-data.ts` (`FPS_ROUTE`, numbering), `content/ui/cards.ts` (the card),
  `scenes/high-scores.ts` (M4), the `TO BE CONTINUED` scene, the ending variant after the tally.
- Engine opt-ins (§10.2): the mission light pass, weather layers, y eviction, the night lights.
- Tests: the mission test (registration, card, per section `playerStart` on the floor,
  checkpoints ≤ 1,400 px apart, exits inside), a bot run (1P / 2P god complete), the enemies
  (tells ≥ 18, attacks only on screen, eject → dazed → runs), the statue (phases, the free end),
  the status, the climb, the finale, the flow (fps → story → oldenzaal → tally → card → ending),
  the budget, the audio spec. Pinned lists to update: `FPS_ROUTE` (ring and fps flow tests),
  the fps → ending assertion, the high-score columns, the song list (`audio-spec.test.ts`), the
  1× scenery fixture (`UPDATE_SCENERY_FIXTURE=1`, new mission only).

## 14. The build: two workflow waves (every agent at effort high)

Snapshot `.claude/snapshots/oz-pre-<wave>.tgz` before each wave. After each wave the lead runs the
gates (§15), looks at the frames, commits locally on main (no push) and reports.

**Wave A — the town and the mechanism** (9 agents):
1. **CORE** (first, alone): the ids, contracts and the API doc `docs/api/oldenzaal.md`; the mission
   stub with sections `oz-a` … `oz-e` (empty ones playable); the flow (story card, the `MISSION 4`
   card, numbering, M4, the `TO BE CONTINUED` card, the ending after it, the m5 trap); the PAL_HD
   ramps; stubs for every content folder in the manifest.
2. Then in parallel:
   - **LIGHT**: the mission light pass, weather layers, y eviction, the dusk / night lights, the
     ghost draw helper.
   - **TOWN**: `oz-a` and `oz-b` art: the shopping street, De Smulhoek, the basilica (exterior,
     also used in `oz-c`), the street furniture, the dusk sky and parallax, the paver terrain; 1×,
     2×, 4×.
   - **POSSESSED**: the hosts (shambler, gunner, brute), the free soul, the townspeople, the eject
     → dazed → run, re-possession, gloat / cower, art.
   - **WU + GHOST**: Meneer Wu and his scene, the meal pickup, snack power, the frikandel bombs, the
     HUD icon; Mevrouw Winkel (the untouchable ghost: paths, appear / vanish, the glow); art.
   - **AUDIO**: the sample group plumbing, the ElevenLabs spec (music, sfx, voices, lines), the
     credit estimate, synth fallbacks for every id; **no generation** in wave A.
3. **INTEGRATE**: sections `oz-a` and `oz-b` (the drop, the waves, the scene, the walk to the
   square), the mission def, preload and the budget test, the bot and sims, smoke.
4. **REVIEW** (read-only) → 5. **FIX**.

**Wave A: DONE (2026-10-21).** CORE, LIGHT, TOWN, POSSESSED, WUGHOST, AUDIO, then INTEGRATE:
`oz-a` and `oz-b` play end to end with their scripts (`script-oz-a.ts`, `script-oz-b.ts`); `oz-c`,
`oz-d` and `oz-e` are playable placeholders with their light configs (night, candles, storm), their
songs and ambience set; the route fps-2 → story card → `MISSION 4` → oldenzaal → tally →
`TO BE CONTINUED` → ending runs. The bot completes the mission 1P and 2P (god and normal, every
`--section`); all identity sims unchanged. The credit estimate is `tmp/oz-audio-estimate.md`
(about 27,200 credits, about 31,300 with a 15 % reserve). Tuning in wave A (the integrator):
- The ground fog of oz-a / oz-b: colour `night[5]` (was `night[4]`) and density 0.75 / 0.8, top
  146 (was 0.5 / 0.6): at `night[4]` it did not show on the dark dusk (LIGHT's finding), and at
  0.6 / 0.7 it was still faint at 4× (the review).
- The dusk darkens as the street goes on: oz-a 0.4 → 0.44 (after the first lock) → 0.48 (before
  the last); oz-b 0.48 → 0.52 after Meneer Wu's scene (§10.1: darker step by step). The start was
  0.35 and read as a warm, cosy sunset (the review); the user decides in the play test.
- Freed people (§3.3) run off at 2.2 px/tick (was 1.5, the heroes' speed), always against the
  scroll (left), fade out 240 ticks after they get up, and never more than 3 at once (a new one
  makes the oldest fade): they crowded the street and hid the heroes (the review: 4 or more on
  screen 59 % of oz-a, now about 10 %).
- The brute is drawn on the rig's new `brute` build (about 40 px tall, wide shoulders; the
  shambler is about 34 px), so the 80-HP charger reads by his silhouette.
- The gunner walks on until he is inside the view before he holds at his range (a gunner that
  came in behind the players stood just off screen and locked an arena).
- Hosts enter on the pavement only (never on a bay roof or an awning) and never behind a low
  wall they cannot climb; an arena member that stays off the locked view for 7 s is removed.
- The bot throws the frikandels like bombs, also at two enemies close together ahead.
- Unchanged from the builders: shambler 30 HP, gunner hold 170 px, soul 20 HP, the holy-mayo
  radius 48 px, snack power 1,200 ticks (Patrick 1,800).

**Stop: the user plays `oz-a` and `oz-b`**, and OKs the credit estimate.

**Wave B — the basilica and the escape** (8 agents): **STATUE** (`oz-c` + the boss), **NAVE**
(`oz-d`), **TOWER** (`oz-e`: the climb, the tide, the bells), **FINALE** (the jet Swan, the
ghost's last moments, the `TO BE CONTINUED` card art), **AUDIO-GEN** (generate, review and ship
the takes) in parallel → **INTEGRATE** → **REVIEW** → **FIX**.

## 15. Gates (the lead, after each wave)

- `npm run typecheck`; `npx vitest run --maxWorkers=3` (rerun a timed-out file alone first).
- Byte identity (`jq 'del(.timing)'` diffs): ams lower 21,443 / upper 23,088, m0 5,679, m2 31,036;
  the ring god seeds 1–5 equal to before the wave.
- `npm run sim -- --mission oldenzaal --god --expect-complete` 1P and 2P, every `--section`, normal
  difficulty runs; 0 errors.
- `npx vite build`; `npm run smoke` (own port; never 5173, 4173 or 5520) for `mission=oldenzaal`,
  `mission=ams`, and the full route; a 4K browser run (`&art=4`) with 0 errors.
- The tier-4 budget test; `npm run sprites -- <prefix> --density 1|2|4` sheets and
  `npm run shot -- --mission oldenzaal --section oz-x --res 8 --art 4` looked at by the lead.
- The diff has no photo, no `.env*`, no banned name, no Nazi symbol outside the first-person mode.

## 16. Risks

- **Budget**: ams already sits at 251.6 of 256 MB; the new mission needs its own reserve and a
  careful tier-4 set (the boss, the hosts' variants share parts).
- **The light pass cost at 4K** (a full-screen dark layer + additive lights each frame).
- **The vertical section**: y eviction, the tide's fairness, the bot's climb.
- **Re-possession** can feel unfair; cap it and give a clear tell.
- **Sensitivity**: the church, the saint and the WW2 theme: the respect rules (§7, §12) and no
  symbols.
- **ElevenLabs**: the credit cost and the take quality (the user listens at the stop).
