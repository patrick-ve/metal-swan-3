# Mission `ams` — THE FRYING DUTCHMAN (design brief)

> Status: approved by the user on 2026-10-12. This brief is the spec for the `ams` work
> (`.claude/workflows/amsterdam.mjs`). The `mission` group folds a summary into
> `docs/GAME_DESIGN.md` (§1.4, §2.4, §9.4, §10, §11, §15). Where this brief and the GDD
> disagree for `ams`, this brief wins until that fold-in is done.

## 0. Decisions

- New mission id `ams`, played FIRST (MISSION 1). `m1`–`m4` keep their ids and become
  MISSION 2–5; `m5` stays FINAL MISSION. `ams.next = 'm1'`.
- Language: English with Dutch flavour words (`HOI!`, `LEKKER!`, `DANKJEWEL!`,
  `GEMEENTE AMSTERDAM`, `BURGEMEESTER`, `GESLOTEN`, `BOETE`, `TOT ZIENS!`, `FIETSPAD`).
- Real names by the user's explicit wish: Amsterdam, Rijksmuseum, Museumplein, Stopera, Amstel,
  Fabel Friet (a real friet shop, shown in a friendly light), burgemeester Femke Halsema as a
  robot caricature boss (ROBO-HALSEMA), Uber Eats style delivery riders. All art is drawn by our
  code; no logo is traced. See the exception paragraph in `docs/ORIGINALITY.md`.
- Tone: Saturday-morning cartoon, bloodless. The mayor is a ROBOT; no human is hurt. No ethnic
  caricature: the youths use the normal mixed skin/outfit variant pool.
- Story: a stand-alone prologue. Task Force CYGNET is on shore leave in Amsterdam and wants
  fries. Gramps brought the Swan along. After `ams`, the m1 card starts the Fanfare Legion story.
- Whole-game aim rule (group `aim`): on foot and in the air, `up` + `left`/`right` fires at
  elev −45° (45° to the horizon facing right, 135° facing left) while walking; `up` alone fires
  straight up; `down` in the air fires down. No down-diagonals. Grenades keep the `up` lob when
  up is held.

## 1. Ids

| Kind | Ids |
|---|---|
| Mission | `ams`, sections `a` `b` `c` `d` |
| Enemies (`src/game/content/locals/`) | `fatbike-youth`, `delivery-rider`, `seagull`, `handhaver`; projectile `boete-ticket` |
| Boss (`src/game/content/bosses/ams/`) | `ams-mayor`; parts `stamp-arm`, `chain`, `medallion`, `head`; projectiles `noise-letter`, `shield-shot`, `stamp-wave` |
| NPCs / mission entities (`missions/ams/entities.ts`) | `ams-baker`, `ams-hotdog-vendor`, `ams-staff`, ambient `ams-tour-boat` (background), `ams-boat-platform` (rideable moving platform), `ams-cyclist-bg`, `ams-pigeons`, `ams-ducks` (canal ducks), `ams-window-waver`; breakables `ams-herring-cart`, `ams-tulip-stall`, `ams-market-stall`, `ams-bike-rack` |
| Sprites | `enemy/<id>/…`, `boss/ams-mayor/<part>-0|1|2` (+ extras under `boss/ams-mayor/`), `decor/ams/…`, `npc/ams/<id>/…` |
| Songs (`content/music/ams.ts`) | `ams`, `ams-boss` |
| Sfx (`content/sfx/ams.ts`) | `ams/bell`, `ams/bass-thump`, `ams/gull`, `ams/kick`, `ams/stamp`, `ams/chain`, `ams/ticket` (cheering reuses `env/applause`) |
| Records | `'ams/swan-met'`, and ams-b also sets `'m1/swan-lesson'` |

Every id must spawn and run with `{}` params (tests/content/modules.test.ts).

## 2. Enemies (one-hit melee kills; GDD 4.11 fairness: tell ≥ 18 ticks WHILE ON SCREEN, attack tokens, only the attack box kills)

### `fatbike-youth` — Hang youth on a fatbike (HP 20, soft, score 300)
- Look: hoodie (varied colours), cap backwards or hood up, trackpants, sneakers; a fat-tyre
  e-bike (very thick black tyres, short frame, phone mount, a small speaker on the rack). Rider
  upper body = `renderHuman(style, pose, 'upper')` with `RIDE_*` poses (grips at hip +(9,−5)),
  wheels from `wheel(r, phase)`. Param `pair: true` = a passenger on the back rack who does the
  kick (+10 HP, +200 score).
- Behaviour: enters from either side at 1.8 px/tick, brakes to 0.8 px/tick within ~90 px of the
  player; TELL 24: wheelie + `ams/bass-thump` + bubble `OI!`; ATTACK 8: kick box ahead at
  shin/knee height (y −22…−6) — a jump clears it; RECOVER: rides on and off screen, or (50 %)
  turns around for one more pass. Idle gag (`gag: 'circles'`): slow circles on a square, music
  thumping; notices the player within 120 px.
- Death: tumbles off, cap flies, runs off yelling `MAMA!`; the bike skids away and fades.

### `delivery-rider` — Food-delivery rider (HP 10, soft, score 200)
- Look: black jacket with green trim, black helmet, big green cube backpack with small `EATS`
  letters, phone on the handlebar, a city bike.
- Behaviour: fast pass at 2.2 px/tick, never stops; TELL 20 (`ams/bell`, bubble `TRING TRING!`)
  starts as soon as he is inside the view; ATTACK 6: a kick while passing; then rides off.
  Param `from: 'behind'` enters from the left edge (the tell still plays inside the view before
  the kick can hit). Gag: checks his phone, `SORRY, LATE ORDER!`.
- Death: falls; the cube pops open and drops a food pickup (`pickup-food`).

### `seagull` — Aggressive gull (HP 10, soft, score 150)
- Look: big white-grey herring gull, grey back, black wing tips, yellow beak with a red spot.
- Behaviour (base `echo-bat`): perches on lamp posts/railings (`perch: true`, sleep gag; wakes
  within 96 px), flies a wobbly path to a hover spot above and beside the player; TELL 20: flap
  + `ams/gull` `KAW!`; ATTACK: dive ≤ 3 px/tick (contact damage only while diving = the peck),
  then climb back. Param `flock: n` (2–5) spawns a formation (pattern `kazoo-drone`
  `KazooFormation`). Gag: steals fries from a tourist.
- Death: feather puff; falls (into the canal if over water).

### `handhaver` — City enforcement officer (HP 20, score 300; boss add and section c/d)
- Look: navy uniform and cap, a yellow-black vest with `HANDHAVING`, a ticket book.
- Behaviour: walks in; TELL 24: opens the ticket book, licks the pencil; throws a fluttering
  `boete-ticket` (a white paper with `BOETE`) at chest height, 1.6 px/tick with a small sine
  flutter (a crouch dodges it); recover 40. Never more than 2 tickets in the air per officer.
- Death: swoons; tickets scatter like confetti.

## 3. Boss `ams-mayor` — ROBO-HALSEMA, "THE IRON MAYOR" (GDD 10.0 rules)

- Size ~140 px tall, ~110 px wide. Stands at the right of the arena (feet y 176, centre about
  arena-left + 300). A walking robot caricature with a recognisable likeness of the mayor
  (rules: `docs/ORIGINALITY.md`, "Exception: mission ams"; hand-built from shapes, never traced):
  - Hair: big, voluminous, dark chocolate-brown waves (near black in the shadows, chestnut
    crests), shoulder length and flaring wide; a side part with a soft sweep off the forehead.
    It is one wig piece over a steel skull; the letter hatch sits in the crown.
  - Face plate: a long oval in skin-tone enamel, a defined jaw and chin, strong dark arched
    brows, brown almond eyes with heavy lashes and liner, a straight long nose, deep red lips
    in a closed, slightly asymmetric smile. A round gold disc earring on a short gold bar.
  - Outfit: a cream-white boucle jacket with a wide shawl collar over a crimson blouse with a
    pointed collar; navy trousers, black low-heeled shoes.
  - The silver chain of office (ambtsketen) in a deep U across the chest with small enamel
    shields (red, blue, green, white), and a big round silver medallion at the bottom with the
    city arms (a red shield, a black pale, three white crosses, a small gold crown).
  - She stays a machine: a steel neck, steel ball joints at the elbows and knees, steel mitten
    hands.
  - Recognisable by hair + face + white jacket over red blouse + chain. Dignified: hurt states
    scuff the wig and the skull, and the face plate only gets thin panel seams.
- Parts (HP in pistol units of 10): `stamp-arm` 400 (required; a giant rubber stamp that reads
  `GESLOTEN`), `chain` 350 (required), `medallion` 450 (core; armoured until stamp-arm and chain
  are broken; required; its centre ~76 px above the ground, so a 45° shot from ~70–110 px away
  hits it), `head` 250 (optional bonus part, letter hatch in the hair).
- Phase 1 (at 1): STAMP SLAM — the arm rises, a shadow marks the target (telegraph 30 ticks,
  `ams/stamp`), slam; a `stamp-wave` shockwave runs along the floor both ways (jump it). LETTER
  RAIN — the hair hatch opens (telegraph 24), 4–6 `noise-letter` envelopes flutter down in sine
  paths (shootable). Adds: `handhaver` from the arena sides, at most 3 alive (tag cap).
- Phase 2 (`when` stamp-arm broken): CHAIN WHIP — she grabs the chain and swings it high
  (crouch) or low (jump), alternating, telegraph 26 with `ams/chain`; letter rain continues.
  Adds: a `seagull` flock of 3 every ~600 ticks.
- Phase 3 (`when` chain broken): the medallion opens and fires a 5-shot `shield-shot` fan
  (telegraph 24, glow); she stomps 48 px forward and back (screen shake, no damage except under
  her feet with a shadow tell). Adds: `delivery-rider` passes from both sides.
- Bubbles via `say`: intro `THE NEIGHBOURS` / `COMPLAINED.` then `FABEL FRIET IS` /
  `GESLOTEN!`; phase 2 `RULES ARE RULES!`; phase 3 `THIS WILL COST YOU` / `A BIG BOETE!`;
  death `TOT ZIENS...`.
- Intro: she steps out of the Stopera doors (invulnerable entrance), bossIntro `ROBO-HALSEMA`,
  subtitle `THE IRON MAYOR`, music `ams-boss`.
- Death: sparks and small blasts, the hair flies off like a wig (a bald steel skull shows), the
  head boings on a spring, she sits down and powers off, a big explosion, score.
- Must be winnable with the pistol + grenades from the floor, and by the bot.

## 4. Music and sound

- `ams`: an ORIGINAL street-organ (draaiorgel) waltz in 3/4, F major, ~150 bpm (3 rows per
  beat): `ORGAN` lead with a glockenspiel/bell counter-line, oompah bass on 1, chords on 2 and 3,
  a light drum. intro 4 → A 16 → B 16 (B♭ major) → A′ 16 → loop. Never quote or arrange an
  existing tune (no "Tulpen uit Amsterdam", "Aan de Amsterdamse grachten", "Mokum" songs, or
  any other).
- `ams-boss`: D minor, ~160 bpm, driving: organ stabs, saw bass ostinato, snare rolls, a bold
  lead; loops.
- Sfx: `ams/bell` (bike bell, two dings), `ams/bass-thump` (sub kick + muffled beat, 18+ ticks),
  `ams/gull` (rising-falling squawk), `ams/kick` (whoosh + thud), `ams/stamp` (heavy wooden
  slam), `ams/chain` (metallic rattle), `ams/ticket` (paper flutter).

## 5. The city — art brief (64-colour palette, 1-px ink outline, light from the top-left)

**Metal Slug 3 density:** 5–6 parallax layers; detailed facades; foreground decor that partly
covers the player (railings, bike racks, bollards, lamp posts); moving life everywhere (animated
decor + light ambient entities with category `npc`, no `enemy`/`shootable` tag). Keep the
frame time low (static buffers for layers; few live entities).

- **Canal houses:** narrow 3–5-storey houses, step / neck / bell / spout gables, brick in
  brown / rust / red ramps, some painted dark green or ink; white cornices and white sash
  windows; hoist beams with hooks; a slight lean; tulip flower boxes; elms along the quay; the
  Westertoren silhouette (a tall tower with a blue-and-gold crown) in the far skyline; canal
  water with house reflections; arched brick bridges with bikes chained to the railings;
  rust-brown bollards with three white crosses (XXX); a red bike path; grey brick pavement.
- **Fabel Friet** (reference photo 1): a cream-white wooden shopfront with a deep cornice; a big
  display window with gold script `Fabel` above spaced capitals `FRIET` (our own lettering), its
  bottom part filled with potatoes; an open white door (glass upper panel, panelled lower part)
  showing a dark brick inside; an oval black hanging sign with gold `Fabel` / `FRIET` on a curly
  wrought-iron bracket over the door; red brick upper floor with white windows; the next shop on
  the right has orange-brown wood and leaded glass; dark grey stone pavement.
- **Hot-dog stand** (photo 3): a white box trailer (~64×44 px) printed with a US-flag graphic: a
  blue field with white stars at the top-left, red and white stripes sweeping diagonally; big
  blue serif `HOTDOGS` with a white edge; a painted hot dog in a bun with a mustard zigzag; a red
  flag on the roof; drawbar, jockey wheel, small wheels; a grey electrical cabinet with graffiti
  tags in front of one corner; a grey lamp post; pigeons. The serving hatch faces the player
  (the vendor shows in it).
- **Rijksmuseum:** red-brown brick, cream stone bands and window frames, many tall windows, two
  towers with dark slate spires and gold vanes, the central passage arch (cyclists ride through).
  Museumplein: grass, a long shallow pool, trees, tourists.
- **Stopera:** the curved white marble-and-glass front of the music theatre on the Amstel, the
  red-brick city-hall wing with white bands, big glass doors; the Blauwbrug with ornate lamp
  posts; the Amstel with boats; Waterlooplein flea-market stalls with striped awnings.
- **The mayor caricature** (photo 2; the likeness reference, studied but never traced):
  big shoulder-length wavy dark-brown hair with a side sweep, strong arched brows, brown almond
  eyes, red lips in a closed confident smile, a round gold disc earring, a cream-white boucle
  jacket with a shawl collar over a crimson blouse, the silver chain of office with enamel
  shields and a big round medallion with the city arms.
- **Light per section:** a = bright spring morning, b = noon, c = golden late afternoon,
  d = orange-pink sunset.
- **Ambient life:** a gliding tour boat with glass roof and tourists, ducks, houseboat chimney
  smoke, a white-blue tram at Museumplein, pigeons that fly up when a player
  comes near, tourists with flashing cameras, a cat in a window, a person waving from a window,
  waving red-black-red Amsterdam flags (XXX) and Dutch flags, swaying tulips.
- **Friendly NPCs** (35–37 px humans): `ams-baker` (white shirt, dark apron, cap, fry scoop, in
  the Fabel Friet door behind a small counter drawn as front decor); `ams-hotdog-vendor` (big
  moustache, red-white-blue cap, white apron; in the hatch; salutes with `P.SALUTE` and a calm
  face when a player passes within ~40 px, on foot or on the Swan, once per player, bubble
  `HOWDY, SOLDIER!` or on the Swan `NICE BIRD, SOLDIER!`); `ams-staff` (param `look` 0–2;
  Fabel Friet aprons; idle, `walk`, `clap`, `cheer` (VICTORY), `wave`).

## 6. Layout (scroll right, ground y 176, `G = 176`; x in world px)

### `a` GRACHTENGORDEL — width 3584, morning, timer 60, music `ams`
| x | Content |
|---|---|
| 0–700 | quay street along a canal (canal + houses in the parallax); weapon crate at ~420; hostage (tourist, bike rack) ~560; first riders and a perched gull |
| 720–880 | bridge 1: an arched brick bridge (ground hill, +14 px), bikes on the railing |
| 900–1500 | the raised drawbridge: a side canal (water hazard 1060–1340, surface y 180) crossed by hopping on two houseboat roofs (platforms ~y 150) and one `ams-boat-platform`; hostage on a houseboat deck |
| 1520–1904 | camera lock "PLEINTJE": a small square with a tree and a bench; fatbike gang waves from both sides + a gull; hostage after |
| 1904–2600 | a narrow shopping street (Nine-Streets feel): delivery riders both ways, a gull flock, breakable tulip stall and herring cart; awnings as platforms; the golden record on a gable ledge ~x 2300, y 70 |
| 2600–2760 | bridge 2 |
| 2760–3584 | arrival at FABEL FRIET: facade 3260–3356 (door/counter at ~3330); camera lock 3200–3584; the last wave (youths + riders + gulls); then the BRIEFING; then `exitTo('b')` |
Checkpoints: 0, 1300, 2500. Hostages 4.

### `b` MUSEUMPLEIN — width 3072, noon
| x | Content |
|---|---|
| 0–380 | street to the museum |
| 400–720 | THE PASSAGE: the cycle tunnel through the Rijksmuseum (solid ceiling ~y 96, vaulted decor); delivery riders rush through both ways (bell echoes) |
| 720–1800 | Museumplein: grass, the long pool (shallow, wadeable decor), the Rijksmuseum back facade in the parallax; HOT-DOG STAND at 960–1024 with the vendor in the hatch at ~990; THE SWAN parked at ~1080 (`ctx.spawn('swan', 1080, 'ground', {facing:1})`, 2P `'mute'` swan like m1-c); Gramps radio `I BROUGHT HER ALONG.` / `DON'T TELL ACCOUNTING.`; the swan lesson (copy of m1-c, new text); sets `'m1/swan-lesson'` and `'ams/swan-met'` |
| 1300–2200 | gull flock set piece over the square (gulls steal tourists' fries, then dive); youths doing circles on the grass (gag); tram in the background; hostages |
| 2200–3072 | a canal-side road toward the Amstel; hostage; exit at ~3000 → `c` |
Checkpoints: 0, 1100, 2300. Hostages 3.

### `c` AMSTEL — width 3328, golden afternoon, `vehicles: ['swan']`
| x | Content |
|---|---|
| 0–600 | quay street; handhavers first appear |
| 600–1400 | a long canal stretch (water hazard, surface y 180): the Swan swims; on foot hop on tour-boat platforms (`ams-boat-platform`) and houseboats; gulls dive |
| 1400–2000 | a quay street with riders, youths and handhavers; breakables |
| 2000–2800 | the Amstel stretch: water with boats and a white wooden drawbridge (Magere-Brug feel) as a high path |
| 2800–3328 | the Blauwbrug to Waterlooplein; exit → `d` |
Checkpoints: 0, 1200, 2400, 3100. Hostages 3.

### `d` STOPERA — width 1280, sunset, `vehicles: ['swan']`, `bossStart` ~900
| x | Content |
|---|---|
| 0–896 | Waterlooplein flea market (breakable stalls), a few handhavers |
| 896–1280 | the boss arena (lock 896–1280); the Stopera facade behind; weapon crate ~960; the mayor steps out of the doors at ~1190 |
After the boss: 3 `ams-staff` and the baker walk in from the left, clap and cheer; baker
`FABEL FRIET` / `BLIJFT OPEN!`, staff `LEKKER!`, `DANKJEWEL!`; `env/applause`; then
`missionComplete()` (the world keeps running for the victory ticks).

## 7. The briefing (end of `a`)

1. `waitClear` the last wave; erase enemy shots; `ctx.timer.pause()`.
2. Input lock: save each player's real pad, give a `VirtualPad`, re-apply every tick (player 2
   may join), restore in `finally` and resume the timer. No `invulnTicks` (blinking).
3. The baker steps to the counter; bubbles of kind `hint`, ≤ 24 chars per line, 2 lines, ~150
   ticks each, auto-advance; fire on a real pad skips a line:
   1. `HOI! WELCOME TO` / `FABEL FRIET!`
   2. `BAD NEWS, SOLDIER.` / `WE MIGHT CLOSE FOR GOOD.`
   3. `BURGEMEESTER HALSEMA` / `WANTS TO SHUT US DOWN!`
   4. `THE NEIGHBOURS SAY` / `WE SMELL TOO GOOD.`
   5. `SHE IS AT THE STOPERA.` / `PLEASE, STOP HER!`
   6. `HERE, FRIES FOR THE` / `ROAD! LEKKER!` — he tosses a weapon crate (or `pickup-weapon`).
4. `exitTo('b')`.

## 8. Mission def and card

- `{ id:'ams', name:'THE FRYING DUTCHMAN', subtitle:'MISSION 1', music:'ams',
  bossMusic:'ams-boss', start:'a', bossSection:'d', next:'m1',
  announce:'MISSION ONE. FRIES FIRST, CYGNETS!', hostages:{a:4,b:3,c:3} }`.
- Card: label `MISSION 1`, name `THE FRYING DUTCHMAN`, place `AMSTERDAM - 1100 HOURS`,
  briefing `SHORE LEAVE IN AMSTERDAM. THE CYGNETS WANT FRIES.` /
  `THE BEST FRY SHOP IN TOWN NEEDS HELP. GO!`, headline
  `ROBO-MAYOR SCRAPPED! THE FRYER STAYS ON!`, its own small canal-ring map (dot 54 < y < 120).
- Campaign: `firstMission()` → `ams`; attract demo → `ams-a`; `CAMPAIGN_MISSIONS` gets `ams`
  first (golden record in ams-a); `missionLabel` and the high-score column number missions by
  their place in `CAMPAIGN_MISSIONS`; m1–m4 labels/subtitles/announces/startBanners → MISSION
  2–5; m5 stays FINAL MISSION; m1-c's Swan greeting gets a variant when `'ams/swan-met'` is set.
