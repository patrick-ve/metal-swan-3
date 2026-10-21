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
| 4 | The zombies are **possessed townspeople**: daily clothes, a ghostly grey soldier helmet, green glowing eyes, a see-through soldier soul over them; **no Nazi symbols** anywhere in this mission **(replaced by revision 2)** | user |
| 5 | **Shoot the soul out**: at 0 HP the soul rises and fades; the person falls dazed, then runs off (bloodless; the townspeople are victims) **(replaced by revision 2)** | user |
| 6 | The meal: a 20 s **snack power** (faster fire, one hit absorbed by a mayo splat) + **2 frikandel bombs** (a holy-mayo blast that drives the souls out of a group) **(replaced by revision 2)** | user |
| 7 | The climb: **inside the tower**, scrolling up, a **horde tide** climbs up behind the players; the bells swing as hazards | user |
| 8 | The rescue: a **cutscene**; the Swan comes with **rocket units under her wings**, the heroes jump on, she flies off into the storm | user |
| 9 | About **7 minutes, 5 sections**: the drop + the shopping street, De Smulhoek, Plechelmusplein (the statue boss), the nave, the tower **(replaced by revision 2)** | user |
| 10 | The statue: **possessed, 3 phases, freed at the end** (it sits back on its plinth, whole) **(replaced by revision 2)** | user |
| 11 | Mevrouw Winkel: **story moments only** here (she cannot be hit); her fight comes in stage 2 **(replaced by revision 2)** | user |
| 12 | The nave: **horde + church set pieces**, no mini-boss, nothing mocks the faith **(replaced by revision 2)** | user |
| 13 | Audio: **ElevenLabs for this level** (music, sfx, designed voices for Meneer Wu, the ghost and the statue); a new dated exception (§12); synth fallbacks for every id | user |
| 14 | Darkness: **dusk → night → storm**, darker step by step (§10) | user |
| 15 | Story: a **typed story card** after the first-person floors + the `MISSION 4` card; Meneer Wu tells the rest in voiced bubbles | user |
| 16 | After the Swan: **MISSION COMPLETE tally → `TO BE CONTINUED` card → today's ending** → name entry | user |
| 17 | Build in **two workflow waves with a play-test stop** between them; every agent at effort **high** | user |
| 18 | The atmosphere is **spooky, dark and grim** | user |
| 19 | All new art at 1×, 2× and 4× (one density-generic drawer per family) inside the tier-4 budget | standing rule |
| 20 | The mission is a normal `defineMission` 2D mission on the unchanged `MissionRunner`; new engine features only as additive opt-ins (§13) | lead (architect) |
| 21 | Section ids `oz-a` … `oz-e` (the art packs are keyed by section id; `a` … `e` would share ams's packs) **(replaced by revision 2)** | lead default |
| 22 | The card's subtitle: **`A HAUNTING IN OTOWN`** ("Otown" = Oldenzaal) | user |
| 23 | The statue's plaque shows only `ST. PLECHELMUS` in our own lettering (not the real plaque's other lines) | lead default |
| 24 | Patrick ("master of eating frikandellen", his bio) gets a longer snack power (30 s) | lead default |
| 25 | The free souls can possess a fleeing townsperson again if the players do not shoot them (§3.4) **(replaced by revision 2)** | lead proposal |

### Revision 2 (2026-10-21 evening, the user's feedback after playing wave A)

These rows replace rows 4, 5, 6 (the blast), 9, 10, 11, 12, 21 and 25. Where a section below still
says otherwise, revision 2 wins.

| # | Item | Decided by |
|---|---|---|
| R2-1 | The enemies are **real, high-fidelity Nazi zombies**: risen WW2 German soldiers, rotting, in field-grey uniforms and steel helmets. They are **tanks: slow, and they take many hits** (§3) | user |
| R2-2 | **Swastika armbands** on the zombies' uniforms and a few torn, rotten swastika banners in the town; no other insignia (no SS runes, no eagle, no slogans); a new dated exception (§12) | user |
| R2-3 | **Rotting, no red blood**: grey-green skin, bone showing, torn cloth; hits knock off chunks and helmets; at death they collapse into bones and dust | user |
| R2-4 | The roster: **grunt** (melee), **rifleman**, **MG gunner** (heavy), **crawler** (§3.2) | user |
| R2-5 | The entrances: **rise from the ground**, **break out of buildings**, **climb out of manholes**, **march in from the far end** (§3.3) | user |
| R2-6 | **No more ghosts**: no souls, no ghost rifles, no possession, no townspeople. **Mevrouw Winkel appears once, in the middle of the level**: on Plechelmusplein she wakes the statue (§6); her face stays on the `TO BE CONTINUED` card | user |
| R2-7 | Oldenzaal looks **abandoned and worn down, after the outbreak**: today's town, left weeks ago (§10.3); only De Smulhoek is still open | user |
| R2-8 | **St. Plechelmus is a mini-boss**: short and sharp, **2 phases**, about 45–60 s (§5.2) | user |
| R2-9 | The players **explore the church interior before the tower**: the **nave** (a spooky **Catholic** church, §7.1), then the **crypt** (§7.2), then the tower | user |
| R2-10 | Six sections `oz-a` … `oz-f`: street, De Smulhoek, the square (mini-boss), the nave, the crypt, the tower (+ the Swan finale); about 8 minutes | lead default |
| R2-11 | The frikandel blast is now a big **explosion** (heavy damage to the zombies in a wide radius) | lead default |
| R2-12 | Meneer Wu is the last living soul in town who still works: his joke gets stronger (he keeps the fryer going while the dead walk) | lead default |

### Revision 3a (2026-10-21, after the user's play of wave B): more zombies

The user after a play: "I want more zombies as it is very easy to play against them now". The dead
stay the slow tanks of R2-1 (numbers.ts unchanged: grunt 90 HP, rifleman 90, MG 260, crawler 40,
walk ≤ 0.5 px/tick); there are just more of them at a time. On normal and hard: bigger, mixed
groups (grunts in front, a rifleman or the MG zombie behind, crawlers under the fire line), squads
and pincers from both view edges (script-kit.ts `zSquadLeft` / `zSquadRight` / `zPincer`), a third
wave in the big locks, more bursts, manholes and rises (a rise spot is not reused within 150 ticks),
more posts in the tower, and in the statue's phase 2 a few dead called up behind the heroes (they
collapse when the saint is freed). Easy keeps the revision-2 numbers; 2P gets more than 1P. The
fairness rules stay: every entrance tells, attacks only on screen, the attack tokens (3 / 4 / 6)
cap how many attack at once, no new MG on easy and normal (hard: one more per big lock).

Dead spawned per section (god bot, seed 1; revision 2 → revision 3):

| | oz-a | oz-b | oz-c | oz-d | oz-e | oz-f | total | most on screen |
|---|---|---|---|---|---|---|---|---|
| easy 1P | 34 | 21 | 5 | 16 | 14 | 8 | 98 → 98 | 4 → 4 |
| normal 1P | 40 → 78 | 27 → 50 | 5 → 12 | 20 → 44 | 16 → 29 | 10 → 19 | 118 → 232 | 5 → 10 |
| normal 2P | 43 → 86 | 29 → 56 | 5 → 14 | 23 → 53 | 18 → 33 | 12 → 23 | 130 → 265 | 5 → 8 |
| hard 1P | 43 → 87 | 28 → 55 | 5 → 16 | 22 → 52 | 17 → 32 | 10 → 23 | 125 → 265 | 6 → 11 |
| hard 2P | 46 → 95 | 30 → 61 | 5 → 17 | 25 → 61 | 19 → 36 | 12 → 27 | 137 → 297 | 6 → 8 |

The bot's deaths to the dead (all sections but the statue's, seeds 1–3) on normal 1P went from
5–8 to 14–17; the run takes about 50 s longer. tests/content/oldenzaal-more-zombies.test.ts pins
the scaling.

### Revision 3b (2026-10-21): Twente wares

The user: "the stores should have typical goods and wares from Twente. Research and implement".
Eight of the 18 shop fronts are now Twente shops with their goods in the window (art-street.ts
`SHOPS[].wares`, painted by art-wares.ts between the dark room and the planks / shards, so they
read through the gaps; 1×, 2× and 4× from one drawer; frame sizes unchanged):

| Sign (frame) | Was | What the window shows |
|---|---|---|
| BAKKERIJ (0) | — | one long **krentenwegge** on its board across the window (mould), krentenbroden, a roggebrood, a tipped basket of rolls; boarded, the top plank torn off |
| SLAGERIJ (1) | shutter down | **metworsten**, grey **Twentse bakleverworsten** and droge worsten on hooks, grey blocks of **balkenbrij** on a tray; now smashed |
| STOFFEN (2) | BOEKHANDEL | bolts and rolls of checked cotton (the Twente textile industry), a torn length, cones of yarn |
| SLIJTERIJ (3) | OPTIEK | brown **beugelflessen** (swing-tops), stoneware kruiken, square bottles of a local kruidenbitter (blank labels), a beer crate |
| KLOMPEN (6) | SCHOENEN | pairs of pale poplar **klompen** on shelves, one kicked over; now smashed (the burnt shop is SPEELGOED now) |
| BANKET (9) | JUWELIER | **knieperkes** (rolled New Year wafers) in jars and round tins, a krentenwegge with a bow |
| GROENTEN (14) | FOTO | heads of **boeskool** (white cabbage; Oldenzaal is "Boeskoolstad" at carnival), some rotting |
| HOUTWAREN (17) | KLOKKEN | **midwinterhoorns** (long, slightly curved bare-wood horns, bands, an elder mouthpiece) on hooks, one fallen; a split trunk |

Also: the torn **flag of Twente** (the white rearing horse, the Twentse Ros, on red; a black
outline at 2× / 4×) pinned under a window sill of one BAKKERIJ front in oz-a (`decor/oz/flag`), and
wares tipped out on the pavement before a few of these shops (`decor/oz/wares`: a beer crate,
klompen on a crate, a crate of boeskool). Everything is grim: faded colours, mould, dust,
cobwebs, things knocked over. Only De Smulhoek is lit and warm.

Research (web, 2026-10-21; each item checked in at least one source): krentenwegge, the long
Twente birth loaf (nl.wikipedia.org/wiki/Krentenwegge); knieperkes (also Drenthe, Groningen);
Twentse bakleverworst (Slow Food Ark of Taste); balkenbrij, grey blocks (nl.wikipedia.org/wiki/
Balkenbrij); klompen, Enter had more than 300 makers; the midwinterhoorn, alder / birch, about
1.2–1.5 m, blown from Advent to 6 January, also from the basilica tower in Oldenzaal
(immaterieelerfgoed.nl, nl.wikipedia.org/wiki/Midwinterhoorn); the Twente textile mills,
Oldenzaal had its own (nl.wikipedia.org/wiki/Oldenzaal); boeskool and "Boeskoolstad"
(nl.wikipedia.org/wiki/Oldenzaal); swing-top beer bottles and local bitters (en.wikipedia.org/
wiki/Twente); the flag of Twente (nl.wikipedia.org/wiki/Vlag_van_Twente). Not verified, so drawn
as generic Dutch only: a "Twente" check colour, the metworst's look, a Twente link for jenever
kruiken, Twente paint colours on klompen.

The no-brand rule holds: only generic Dutch shop words on the signs (all in our pixel lettering,
no diacritics), no business names, no brand names, logos or label text on any product, no club
crest.

### Revision 3c (2026-10-21): Dutch bubbles and voices; the audio ships

The user: "I am okay with the credits. You may generate audio. Note that all text bubbles and
audio should be in Dutch". Every speech bubble and every voiced line of this mission is now plain,
standard Dutch (`missions/oldenzaal/lines.ts`; no diacritics, the pixel font has none): Meneer Wu's
scene, Mevrouw Winkel's wake and flight, the saint (already Dutch), the meal's callout
`SNACKKRACHT!` and pop `PLETS!`, the announcer's `MISSIE VIER. BLIJF BIJ ELKAAR, ZWAANTJES!`, and the
tower's two banners (`DE DODEN KLIMMEN! OMHOOG!`, `GEEN WEG TERUG!`). The story card, the TO BE
CONTINUED card, the MISSION 4 card and the game's own HUD words (MINI-BOSS, TAP JUMP!, CHECKPOINT)
stay English. The voice designs describe Dutch speakers. The ElevenLabs round ran on 2026-10-21
(docs/api/audio-pipeline.md "Mission oldenzaal"): 3 voices, 91 sfx, 4 songs, 16 lines; about
17,200 credits. Because a speaker's next bubble cuts off the playing line, Wu's lines and the wake
got per-line beats that fit the shipped takes (`WU_SCENE.lineTicks`, `WAKE.lines`; the test
`oldenzaal-voice-fit.test.ts`).

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
- `?mission=oldenzaal` starts it directly (with `section=oz-a … oz-f`, `players`, `char`, `god`,
  `debug`, `art`, `res`, `difficulty` as today). `?mission=oldenzaal&boss=1` starts at the statue.
- After the first-person mode (one slot), P2 rejoins the 2D runner as in the ring → fps hand-off;
  verify P2 and the continues.
- The `TO BE CONTINUED` card: night sky, the Swan's jet trail, the ghost's face fading in and her
  laugh; then today's ending. Stage 2 plugs in between this card and the ending later.
- **Trap:** `listMissions` sorts ids, so `oldenzaal` comes after `m5` and would become m5's
  default `next`. Keep m0–m5 exactly as they are (an explicit `next` or a filter).

## 2. The sections (about 8 minutes; revision 2)

| Section | Place | Time | Light | Content |
|---|---|---|---|---|
| `oz-a` | the drop over the roofs, then the main shopping street | ~1:45 | dusk: a low red sun, fog, dead and flickering lamps | the parachute start (`introDrop`), the abandoned street, the first zombies (every entrance kind), a column marching in from the fog |
| `oz-b` | the street corner with **De Smulhoek**, the basilica's tower above the roofs | ~1:00 | late dusk | the Meneer Wu scene (the story, the meal), a fight on the way to the square |
| `oz-c` | **Plechelmusplein** (cracked red-brick pavers, the basilica's long side as the backdrop) | ~1:15 | night, full moon | **Mevrouw Winkel's scene**: she wakes the statue; the **mini-boss** (§5); the red doors open |
| `oz-d` | **the nave** of the basilica | ~1:30 | candle light, lightning in the windows | the spooky Catholic church (§7.1); the dead rise from the grave slabs and come out of the side chapels |
| `oz-e` | **the crypt** under the choir | ~1:00 | almost dark: votive candles, a lantern glow | tombs and niches; the dead climb out of the tombs; crawlers; stairs up to the tower door (§7.2) |
| `oz-f` | **the tower**, scrolling up to the top | ~1:30 | storm: rain, lightning | the climb, the horde tide, the bells (§8); at the top the Swan finale (§9) |

- Checkpoints at most 1,400 px apart (the mission tests). `oz-f` is a vertical section
  (`scroll: 'up'`, like m3-b1, about 384 × 1,800 px); `oz-a` … `oz-e` scroll right.
- 2P co-op everywhere, as in ams. The in-world continue applies (gloat, cower, stagger).

## 3. The dead soldiers (enemies; revision 2)

### 3.1 The look and the rules
- **Real, high-fidelity Nazi zombies**: risen WW2 German soldiers. Field-grey wool uniforms (torn,
  muddy, faded), the steel helmet with its flared rim, leather belts and Y-straps, ammo pouches,
  the cylindrical gas-mask can, bread bags, jackboots; a **red swastika armband** on the left upper
  arm (the user, R2-2); collar tabs and shoulder straps without marks; no other insignia.
- Rotting faces at real fidelity (the 4× target: the ams / ring 4× art): grey-green and yellowed
  skin, sunken eyes with a dull glow, exposed teeth and jaw bone, torn cheeks, wisps of hair,
  bony hands. **No red blood** (R2-3): hits knock off dust, cloth and chunks of rot; helmets fly
  off; at 0 HP a zombie stops, sags and **collapses into bones and dust** (the helmet rolls).
- **Tanks** (R2-1): slow (about 0.35–0.5 px/tick), many hits, a heavy stagger only on big hits
  (grenades, the frikandel blast, the knife); they never run.
- Never the reference game's zombie gags (ORIGINALITY.md): no vomit attack, no hero
  transformation, no cure item; no laughing or pointing at a player's death.

### 3.2 Kinds (R2-4)
1. `oz-grunt` — the common one: shambles forward, swings a rifle butt or a trench shovel at close
   range (a tell ≥ 18 ticks on screen; the attack box is live only in the strike). About 8 pistol
   hits (the builders tune HP with the bot and a human-speed estimate).
2. `oz-rifleman` — stops at range, raises a rusty rifle (a long, clear tell), fires **one slow
   shot** (a visible, slow bullet that the heroes can jump or duck), reloads slowly. About 8 hits.
3. `oz-gunner` — a big zombie with a machine gun: walks slowly to a spot, **plants the gun** (a
   bipod), aims after a clear tell, fires a **short sweeping burst**, then cools down. About 25
   hits; the threat in each locked fight. His helmet and the gun's barrel can be shot off (cosmetic
   damage states).
4. `oz-crawler` — a legless zombie that drags itself along the ground and **grabs a hero's feet**
   (a short hold: tap to break free, or a small hit); low: aim down or jump over. About 4 hits.

### 3.3 Entrances (R2-5; each with a clear tell, never on top of a hero)
- **Rise from the ground**: cracks and a hand break through the pavers (or a grave slab in the
  nave, a tomb in the crypt); the zombie climbs out (about 60–90 ticks, invulnerable only while
  fully underground).
- **Break out of buildings**: a boarded-up door or shop window bursts (planks and glass fly) and
  the zombie staggers out.
- **Climb out of manholes**: a drain cover lifts and slides away; the zombie pulls itself up.
- **March in from the far end**: a slow column of 3–6 silhouettes in the fog at the end of the
  street, a grim moment before a big fight (the light pass and the fog sell it).

### 3.4 Gloat and cower (the in-world continue)
- Gloat: the zombies stop, sway and groan, the gunner pats his gun, the crawler lies still (no
  pointing, no laughing; `docs/research/mechanics.md` §23). Cower: they flinch and step back.

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
  ElevenLabs designed voice) about the ghost of Mevrouw Winkel and the dead soldiers who walk again
  since she came back (revision 2), and
  tosses each living hero a paper tray: `PATAT MAYO MET 2 FRIKANDELLEN`. Skippable after 20
  ticks; the meal is given even when skipped.

### 4.3 The meal (the power-up)
- **Snack power** (a status like Helium Head, `player/status.ts`): 20 s (Patrick: 30 s); fire rate
  ×1.5; one hit is absorbed by a mayo splat (a white splash, a `PLETS!` pop); a HUD icon (a tray
  of fries) with a countdown ring; a warm tint pulse on the hero.
- **Frikandel bombs**: 2 per hero, a special throw (BOMB while you have them; then the normal
  grenades come back): a frikandel in a high arc, a **holy-mayo blast** on landing: a big
  explosion (revision 2, R2-11) with heavy damage to every zombie in a wide radius and a stagger
  (a cream-white burst with a glow).
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

### 5.2 The fight (revision 2: a mini-boss, 2 phases, about 45–60 s)
- **The wake** (Mevrouw Winkel's only scene, §6): the heroes reach the square; the statue looks like
  decor (shots chip dust but do nothing); the camera locks; **Mevrouw Winkel** fades in beside the
  plinth, says 2–3 lines, laughs and **flies into the statue**: the stone cracks, the eyes glow,
  the boss bar `ST. PLECHELMUS` fills (marked as a mini-boss).
- **Phase 1 — seated** (100 % → 50 %): the **crozier sweep** (a low sweep across the square: jump
  it; tell: the crozier glows and swings back) and the **thrown stone** (it breaks a block off the
  plinth and lobs it; it shatters into small bouncing stones).
- **Phase 2 — on foot** (50 % → 0): it steps down off the plinth, heavy and slow: the **ground
  slam** (a shockwave along the pavers: jump it) and the **crozier hook** (it hooks a hero and
  pulls him in; shoot the crozier head or jump to break free).
- **Parts**: the head (the weak point in phase 2), the crozier (breakable: no hook while it is
  broken), the body. Bosses do not use attack tokens; every attack has a tell ≥ 18 ticks and starts
  only on screen.
- **The end** (the saint is a victim): the ghost is torn out of the stone and flees with a shriek
  (she is not seen again in this level); the cracks close; the statue walks back, **sits down on
  its plinth, whole**, and its eyes go dark. The basilica's red doors creak open. Points as a
  mini-boss (5,000), a weapon drop.
- Continue: the statue staggers; zombies on the square cower.

## 6. Mevrouw Winkel (the ghost; one scene; revision 2)

- Fictional (the user made her up): a **middle-aged woman with dark grey hair** (the user), pinned
  up in a bun, in an old-fashioned long dark dress with a high collar and a shawl, carrying an old
  lantern with a green flame. She is see-through and pale, with a cold green glow and a trail of
  mist (`drawGhost`, an additive glow, a light for the light pass).
- She **cannot be hit** (shots pass through her; she is not a target).
- **No more ghosts** (R2-6): she appears **once, in the middle of the level**: on Plechelmusplein
  she wakes the statue (§5.2). Her roof moment in `oz-a` goes. Her face and her laugh stay on the
  `TO BE CONTINUED` card (a teaser for stage 2, where she is fought).
- Her lines: few and short, our own (Dutch since revision 3c), voiced by an ElevenLabs designed
  voice (an eerie, whispering middle-aged woman; never a clone or an imitation).

## 7. The church interior: the nave (oz-d) and the crypt (oz-e) (revision 2)

The players **explore the church before the tower** (R2-9). It must look like a **spooky Catholic
church**: rich, old, dark, candle-lit, abandoned for weeks (dust, cobwebs, fallen hymn boards,
toppled candle stands), never mocked.

### 7.1 The nave (oz-d, ~1:30)
- Enter through the **red pointed-arch doors**. Grey sandstone **pillars** and round and pointed
  arches, the **side aisles** with **side chapels** behind iron grilles, rows of dark wooden
  **pews** (low one-way platforms and cover), a stone floor with **grave slabs**.
- Catholic details (our own drawings): **votive candle racks** with many small flames (light
  sources), **statues of saints** and of **Mary** in niches, the **Stations of the Cross** as small
  framed reliefs along the walls, **confessionals** (dark wooden booths with curtains), a **holy
  water font** by the door, the **pulpit** with its canopy, the **altar** in the choir with a
  **crucifix** and tall candlesticks, the red **sanctuary lamp** (the eternal light) glowing, an
  **organ loft** with pipes at the west end, iron **chandeliers**, tall **stained-glass windows**
  that flash in the lightning.
- Set pieces: the dead rise from the grave slabs; a zombie column comes out of a side chapel; the
  doors slam shut behind the players (a camera lock, a fight with a gunner); the organ moans by
  itself (a sound, no ghost); lightning shows the zombies in silhouette for a moment. At the choir
  a stair leads **down into the crypt**.
- **Respect** (ORIGINALITY.md: no religious stereotype or mockery): nothing in the church is
  mocked, broken or burned on purpose; shots never damage the altar, the crucifix, statues or
  images; no zombie wears a church vestment; the church is the place the squad frees.

### 7.2 The crypt (oz-e, ~1:00)
- A low vaulted crypt under the choir: squat columns, rough stone, **tombs** and **wall niches**,
  old coffins, iron gates, votive candles and a few lanterns (almost dark: the light pass), dust
  in the air.
- The dead **climb out of the tombs** and niches (the rise entrance with a lid that slides off);
  **crawlers** come along the floor; a short locked fight at a gate.
- At the far end a narrow **stair goes up** to the tower door (the exit to `oz-f`).

## 8. The tower climb (oz-f)

- A vertical section, scrolling **up** (about 384 × 1,800 px). Inside the square tower: wooden
  **stairs and landings** (one-way platforms, drop-through), heavy beams, the stone walls with
  narrow openings (rain and lightning outside), the **clock works**, the **bell chamber** with
  2–3 swinging **bells** (the bell is a hazard when it swings at a hero and a platform at rest; a
  bell toll stuns the zombies near it for a moment).
- **The horde tide**: from about a third of the way up, a mass of zombies climbs up behind the
  players at a steady rate (like m3-b2's rising meltwater): it pushes the camera up and **kills on
  contact** (one hit, the genre rule). The players must keep moving; a few riflemen stand on
  landings.
- **The top**: the roof platform under the small spire with the clock, the storm all around. The
  tide stops one landing below (the dead cannot pass the bells' last toll), the heroes are
  trapped; then the Swan comes (§9).
- The bot must be able to finish the climb (the m3 platform-staircase rule: goals more than 20 px
  up; the tide must leave the bot enough time).

## 9. The Swan finale (the end of oz-f)

- A scripted, cosmetic **jet Swan** (`oz-swan-jet`), modelled on the m5 finale's flying ship
  (`m5/finale.ts`: a `Mountable`, `canMount` / `boardAll`, `autoRun`, `leave()`): the Metal Swan
  with two **rocket units under her wings** (blue-white flames) flies in from the storm, hovers
  beside the roof, the heroes jump on (in 2P both ride: the second hero on the tail perch, as on
  the Swan today), she turns and flies off into the clouds with a long jet trail. Then MISSION COMPLETE.
- The Swan's look stays her own (a robot swan, ams art); only the jet units and the flight
  frames are new.

## 10. The atmosphere and the art

### 10.1 Dusk → night → storm
- `oz-a`: a low red-orange sun behind the roofs, a purple sky, thick ground fog, most street
  lamps dead, a few flickering, shop windows dark, smashed or boarded up (revision 2).
- `oz-b`: late dusk, the fog thicker; De Smulhoek's windows are warm.
- `oz-c`: night, a **full moon** behind the basilica's tower, cold blue light, the statue in a
  pool of lamp light.
- `oz-d`: dark inside, warm **candle light** pools, cold flashes of **lightning** through the
  windows.
- `oz-e` (the crypt): almost dark; votive candles and a lantern glow.
- `oz-f` (the tower): a storm: rain streaks, wind, lightning flashes that light the whole tower.
- Overall: desaturated, cold greens, greys and blues; warm light only from lamps, candles and De
  Smulhoek. The squad and the pickups stay readable (the readability rule).

### 10.2 New engine opt-ins (additive; ams and the ring unchanged)
- **A light pass for missions** (`MissionRunner` / the mission view, opt-in per section): a
  darkness overlay with additive light sources (lamps, candles, the ghost's glow, De Smulhoek's
  windows), a lightning flash, like the ring's tunnel light pass. Without the opt-in nothing
  changes.
- **Weather layers**: fog bands (parallax, drifting), rain streaks, wind gusts in `oz-f`.
- **Vertical chunk eviction**: dense chunks are evicted by x only today; the tower needs eviction
  by y too (else every chunk of a vertical section stays resident).
- **The ghost draw**: alpha ~0.5, then an additive tint pass and a glow sprite (render.ts
  `DrawOpts` `alpha` / `tint` / `blend: 'add'`). (Revision 2: only Mevrouw Winkel uses it.)
- **New light lists**: `Light` (ams art) today has morning, noon, golden and sunset only; add
  dusk and night for the new drawers.

### 10.3 The places (likeness from the user's photos; never traced)
- **The Plechelmus Basilica**: grey-brown **Bentheimer sandstone** (weathered, darker streaks), a
  tall square **Romanesque tower** (about 61 m in reality) in stacked tiers with rows of round-
  arched openings and blind arcades, a small spire with a clock and a cross on top; the **Gothic
  nave** with tall pointed tracery windows, stepped buttresses, a steep grey slate roof with small
  dormers and finials; red pointed-arch doors; benches along the wall.
- **The shopping street**: Dutch brick shop fronts of 2–3 storeys (red-brown and dark brick, white
  window frames, some plastered fronts), shop signs in our own lettering, the tall black **double
  street lamps** with hanging flower baskets, signposts (`MUSEUM`, `PLECHELMUSBASILIEK`,
  `STADHUIS`, `GANZENMARKT`, from the photo's signpost), red-brick pavers, bicycle racks, the
  basilica's tower always above the roofs.
- **Abandoned and worn down, after the outbreak** (revision 2, R2-7): the town was left weeks ago.
  Boarded-up and smashed shop windows (planks nailed across, broken glass, `GESLOTEN` and
  `NIET BETREDEN` notes), half-open roller shutters, peeling paint and plaster, damp stains and
  cracks, dead hanging baskets, dead or flickering lamps, weeds between cracked pavers, rubbish
  and blown newspapers, toppled bikes and bins, abandoned cars (doors open, flat tyres, a
  **burned-out car**), police tape and crowd barriers, an emergency sign, a few torn swastika
  banners hung by the dead (R2-2). Only **De Smulhoek** is still open: its windows glow warm.
- **Twente shops** (revision 3, Twente wares, §0): eight fronts sell Twente goods that still read
  through the boards and the broken glass (krentenwegge, metworst and bakleverworst, checked
  cotton, swing-top bottles, klompen, knieperkes, boeskool, midwinterhoorns); the torn flag of
  Twente hangs from one front.
- **Plechelmusplein**: the open square in front of the basilica (§5.1).
- Shop and brand names other than De Smulhoek are our own made-up names.

### 10.4 Palette and budget
- PAL_HD: the wave-A ramps (sandstone, dusk sky, ghost green, candle amber, night blue) plus what
  revision 2 needs (rotting skin, field grey, rust, soot), inside the 256 limit. 1× keeps the 64-colour palette (mapped).
- Tier-4 working set: the mission's sprites + its dense scenery must fit `DENSE_BUDGET_BYTES`
  (256 MB; ams's worst case is 251.6 MB today), with a `denseReserve` for the scenery like the
  ring, and a budget test like `ams-dense-budget.test.ts`. 2P uses the same rules as ams.

## 11. Sound (ElevenLabs, with synth fallbacks)

- **Music** (ElevenLabs takes; synth fallbacks in `content/music/`): the level theme (a dark,
  slow organ and choir pad over a low heartbeat drum, rising in `oz-b`), the statue boss song
  (heavy, stone percussion, a choir), the tower chase (fast, the bells in the rhythm), a
  `TO BE CONTINUED` sting. Prompts in our own words, never a named song, artist, game or composer.
- **Sfx** (revision 2): the zombies' groans and collapse into bones, the rifle shot, the MG burst,
  the crawler's drag and grab, the ground breaking, boards and glass bursting, a manhole cover, the
  ghost's shriek and laugh, the stone crack, the crozier sweep, the ground slam, bells, thunder,
  rain and wind loops, the doors slamming, candles, the frikandel throw and the mayo splat, the
  jet Swan.
- **Voices** (ElevenLabs Voice Design, from text descriptions; never a clone or an imitation):
  `wu` (a warm, brisk, slightly gruff middle-aged man who sounds busy; plain, standard Dutch;
  never an imitated or caricatured accent), `winkel` (an
  eerie, whispering middle-aged woman), `plechelmus` (a deep, stony rumble; 1–3 lines). Lines are
  our own text, short, in Dutch (revision 3c).
- Tooling: a new sample group for the mission (the group names are hard-coded in
  `tools/audio/spec-types.ts`, `lib.ts`, `ship.ts`, `review.ts` and `engine/samples.ts`). The
  AUDIO builder writes the spec and a **credit estimate** in wave A; the generation runs in wave B
  after the user's OK at the play-test stop. The ElevenLabs key lives only in `.env.local`: never
  print it, commit it or read the file.

## 12. Originality exception (a dated section in docs/ORIGINALITY.md; revision 2)

- Real names allowed in `oldenzaal`: Oldenzaal, the Plechelmus Basilica (Sint-Plechelmusbasiliek),
  Plechelmusplein, St. Plechelmus and his statue (a likeness, freed and whole at the end), the
  snack bar **De Smulhoek** (shown in a friendly light), and the signpost names (Museum, Stadhuis,
  Ganzenmarkt).
- Meneer Wu is our own design with a name the user chose: a hard-working snack-bar owner with a
  Chinese background, drawn and voiced without any stereotype (§4.2); no likeness of a real
  person. Mevrouw Winkel is fictional.
- **Nazi symbols (revision 2, the user's decision of 2026-10-21):** in this mission only, the
  zombie soldiers wear a **swastika armband**, and a few **torn, rotten swastika banners** hang in
  the town. Nothing else: no SS runes, no eagle, no slogans, no real units or names, no
  uniform badges beyond the armband. The symbols are on the villains only, never shown in a
  positive light; no Holocaust imagery, no real victims, no real quotes.
- **Rotting, bloodless**: no red blood in this mission (the first-person mode keeps its own
  exception).
- The zombies are not the reference game's zombie gag: no hero transformation, no vomit attack,
  no cure item.
- **Respect for the church**: no mockery of the faith, its objects or clergy; the saint is a victim
  of the curse and is freed.
- ElevenLabs audio for this mission (music, sfx, designed voices) under the same rules as the
  `ams` audio exception.
- The photos never enter the repository; all art is drawn by code, never traced or sampled.

## 13. Architecture and files

- `src/game/content/missions/oldenzaal/` — `index.ts` (`defineMission`, `introDrop: true`,
  `artDensity: 4`, `art`, `audioGroup`, `hostages: 0` unless the builders add some), `terrain.ts`,
  `section-oz-{a,b,c,d,e,f}.ts`, `backgrounds.ts`, `art*.ts`, `helpers.ts`, `entities.ts`,
  `finale.ts`.
- `src/game/content/oldenzaal/zombies/` — the dead soldiers (revision 2; replaces `possessed/`).
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

**Stop: the user played `oz-a` and `oz-b`** (2026-10-21) and gave the feedback of revision 2
(§0). The credit estimate is not OK'd yet: no generation until the user says so.

**Wave B — revision 2, the church and the escape** (9 agents; the user is away: autonomous):
1. **PREP** (first, alone): revision 2's foundation: sections `oz-a` … `oz-f` (`oz-e` becomes the
   crypt, a new vertical `oz-f` tower placeholder; light configs), ids and owners, the rewritten
   lines (story card, Meneer Wu, Mevrouw Winkel's wake lines, the statue), the zombie API with a
   working placeholder, the boarded-door contract, the PAL_HD ramps, the ORIGINALITY exception
   (R2-2), `docs/api/oldenzaal.md` revision 2.
2. Then in parallel:
   - **ZOMBIES**: the four dead soldiers (grunt, rifleman, MG gunner, crawler), the four entrances,
     gloat / cower, the frikandel explosion, art at real fidelity; `possessed/` stays until the
     integrator switches the scripts.
   - **RUIN**: `oz-a` / `oz-b` abandoned and worn down (§10.3), the boarded doors and windows that
     burst, manholes, abandoned cars, the torn banners.
   - **STATUE**: `oz-c` (the square, Mevrouw Winkel's wake scene, the 2-phase mini-boss, the doors),
     Meneer Wu's hair (grey temples), the `TO BE CONTINUED` card's ghost face.
   - **CHURCH**: `oz-d` the nave and `oz-e` the crypt (§7): the Catholic interior art, layout,
     scripts and set pieces.
   - **TOWER**: `oz-f` the climb, the horde tide, the bells, the top and the jet Swan finale (§8, §9).
3. **INTEGRATE**: `oz-a` / `oz-b` scripts on the zombies (no souls, no townspeople, no roof ghost),
   `possessed/` removed, pacing for tank zombies, the whole mission end to end, the bot (the
   mini-boss, the tide), sims, budget, the audio spec and estimate for revision 2 (no generation),
   docs.
4. **REVIEW** (read-only) → 5. **FIX**.

**Wave B: DONE (2026-10-21).** PREP, then ZOMBIES, RUIN, STATUE, CHURCH, TOWER, then INTEGRATE:
the six sections play end to end (oz-a → oz-f → tally → `TO BE CONTINUED` → ending); `oz-a` and
`oz-b` run on the dead soldiers (every kind, every entrance, at RUIN's openings); wave A's
possessed, souls, townspeople and roof ghost are removed (code, ids, sprites, sfx, tests, spec).
The bot completes the mission 1P and 2P on easy, normal and hard, god and mortal, and from every
`--section`; all 12 identity sims unchanged; the tier-4 peaks are 123.2 MB (1P) and 146.5 MB (2P)
of 256 MB. The audio spec lists every revision-2 id; the credit estimate is now about 32,300
credits (about 37,200 with a 15 % reserve): `tmp/oz-audio-estimate.md`, still not OK'd, nothing
generated. Tuning in wave B (the integrator, from bot runs and a human-speed estimate):
- Tank pacing: each big lock has one MG zombie at most; the weapons come first: a machine-gun
  crate before oz-a's first lock (x 520), the middle MG zombie drops a machine gun, a shotgun crate
  on the way to the last lock (x 2210), oz-b's MG zombie drops a shotgun. Entries are always IN
  VIEW (an opening out of view gives a rise in view instead), never behind a low wall.
- `ENTRY.maxWait` 600 → 240 ticks, and a zombie whose opening spot a hero blocks comes out beside
  it (it never came out: a 69-s lock in oz-b).
- The dead clamber over low walls (≤ 20 px) and step down off them: a march column stood stuck
  behind oz-a's middle garden wall.
- The zombies' hit flash is a pale overlay (alpha 0.3), not the white cut-out: under steady fire a
  zombie was white half the time and read as a ghost (R2-6: no ghosts).
- The statue's hook strike goes through `world.damage` (it killed god-mode players).
- Bot times (normal 1P): oz-a 89 s, oz-b 65 s, oz-c 72 s, oz-d 79 s, oz-e 30 s, oz-f 38 s (6:13
  in all); a human is slower (about 8 minutes). The longest locks for the bot: oz-a 21 s / 20 s,
  oz-b 13 s; a human with the machine gun about 10–15 s, on the pistol alone about 30 s.

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
- **Tank zombies** can make the fights slow and grindy: tune HP with a human-speed estimate, not
  only the bot; give the heroes weapon drops.
- **The symbols** (R2-2): keep them to the armband and a few torn banners; nothing more.
- **Sensitivity**: the church, the saint and the WW2 theme: the respect rules (§7, §12) and no
  symbols.
- **ElevenLabs**: the credit cost and the take quality (the user listens at the stop).
