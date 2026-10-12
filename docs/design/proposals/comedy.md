# METAL SWAN 3 — Design Proposal: "Personality & Comedy"

> Angle: maximum charm (memorable heroes and villains, idle gags, funny deaths, absurd set pieces,
> a silly but coherent story) on top of tight, fair, readable arcade mechanics.
> Status: proposal for merge into `docs/GAME_DESIGN.md`. All names, characters, places, story
> text, lines and music descriptions below are invented for this project and were checked against
> `docs/ORIGINALITY.md` (see the self-check at the end of section 15).

**Conventions used in this document**

- Units: px and ticks (60 ticks = 1 s). Speeds in px/tick, gravity in px/tick².
- Coordinates: section space, origin top-left, y grows down. The standard ground line is
  **y = 176** (40 px of ground visible under a 216 px view). "Feet at y" means the entity anchor.
- `@X` in a wave script = when the camera's left edge reaches section x = X (`waitCamera`).
- `R+16` = spawn 16 px past the right edge of the view; `L-16` = past the left edge; `TOP` =
  above the view, at the x given.
- `LOCK a–b` = `camera.lock(a, b)` (b − a = 384 unless noted). `WAIT dead` = `waitAllDead` for
  the wave just spawned. `UNLOCK` = `camera.unlock()`.
- HP is in "pistol bullets": a pistol bullet does 1 damage.
- "Normal" difficulty values are given; section 4.10 lists what Easy and Hard change.
- The comedy rule: **every gag is either free time for the player or pure decoration.** A gag
  never hides a threat, never steals control for more than 30 ticks, and never kills.

---

## 1. Overview

### 1.1 Pitch

A swan looks calm on the water and paddles like mad underneath. So does **Task Force CYGNET**,
four elite (and odd) soldiers sent to stop **Grand Marshal Bombastian Fortissimo**, a failed opera
tenor who built an army out of a marching band. His **Fanfare Legion** wants to broadcast the
*Anthem of Eternal Attention* to every radio on Earth. Anyone who hears it must stand to
attention and salute. Forever. The Cygnets are immune: years of their commander's karaoke
nights made them deaf to bad music.

The squad fights through five missions of brass bands, drum tanks, bagpipe airships and a
piano that bites. They ride the **SWAN-3**, a walking, paddling, honking tank on two long legs,
the third prototype of the "Metal Swan" programme (the first one sank, the second one flew south
for the winter and never came back).

### 1.2 Tone

- **Saturday-morning cartoon war.** Nobody bleeds. Defeated soldiers swoon like opera singers,
  get blackened with soot, fly off with their tall hats spinning, or flatten like pancakes and
  flutter away.
- **The enemy is a band, and the band is the joke.** Every enemy is built around one instrument
  and one personality trait. Their attacks are music; their telegraphs are sounds you can hear
  coming (inhale before the tuba, shimmer before the cymbals, three dings before the alarm).
- **The heroes are straight men** in a world of noise. Grace is polite, Mittens knits, Pip is
  too excited, Gramps built the swan and talks to it.
- **Pompous villain, sincere stakes.** Fortissimo is ridiculous, but his anthem is a real threat
  inside the story. The ending gives him a small, kind comeuppance (he plays the triangle in the
  heroes' victory parade, and he gets his one note wrong).

### 1.3 Title screen tagline

> **CALM ON TOP. FURIOUS UNDERNEATH.**

Alternate attract-mode lines (cycled under the logo, 300 ticks each):
`NO SWANS WERE HARMED. SEVERAL TUBAS WERE.` / `NOW WITH 40% MORE HONK.` /
`THE CRITICS SAY: "LOUD."`

### 1.4 Target runtime

| Item | Target |
|---|---|
| One mission | 3–5 min (2–4 sections on the path taken, boss ~60–90 s) |
| Full game, 1 credit, skilled player | 22–26 min |
| Full game, first time, with continues | 35–45 min |
| Route branches | 4 (m1, m2, m3, m4); both routes of each branch rejoin before the boss |
| Vertical sections | 3 (m3 `b1`/`b2` scroll up, m5 `b` scrolls down) |
| Vehicle sections | 5 (m1 `c` SWAN-3, m2 `b` Sundae Driver, m3 `a` SWAN-3 on ice, m4 `b` Bandwagon, m5 `a` Trumpeter shoot-em-up) |

---

## 2. Story

### 2.1 Premise

The quiet republic of **Lowmere** is famous for nothing at all, and it likes it that way. Its
neighbour **Crescendia** used to be the same, until its opera house gave the lead role in
*The Tenor Who Wept* to somebody else. The rejected tenor, Bombastian Fortissimo, marched out of
the audition, bought every brass instrument in the country, and declared himself
**Grand Marshal**. His followers call him **His Loudness**.

Fortissimo's plan has three steps (he sings them, badly, in every broadcast):

1. Kidnap every music critic who ever gave him a bad review.
2. Finish the **Grand Organ**, a flying pipe organ the size of a cathedral.
3. On **Opening Night**, play the *Anthem of Eternal Attention* from the Grand Organ through
   every radio on Earth. All listeners will freeze at attention and salute him forever, and he
   will finally have the biggest audience in history.

Lowmere's Brigadier **Lionel Gusto** sends in **Task Force CYGNET** (official name: *Covert Yet
Graceful Navy-Army Expeditionary Team*; nobody can say it fast). Gusto sings karaoke every Friday
in the barracks, at full volume, for eleven years. His troops are now completely immune to
terrible music. That makes the Cygnets the only soldiers on Earth who can walk up to the anthem
and switch it off.

### 2.2 The enemy: the Fanfare Legion

- **Look:** crimson tunics with gold cord across the chest, white trousers, black boots, tall
  black shakos (cylinder hats) with a white plume. Every man wears a moustache; recruits who
  cannot grow one wear a stick-on moustache that flies off when they are hit.
- **Crest:** a gold megaphone crossed with a conductor's baton on a crimson shield.
- **Personality:** loud, vain, obsessed with rank, parades and applause. They cannot sneak (they
  hum). They love their instruments more than their lives: a Legion soldier always tries to save
  his instrument first.
- **Structure:** the Legion is organised like an orchestra. Each **Section Leader** commands one
  mission's boss:

| Section | Leader | Personality | Boss (mission) |
|---|---|---|---|
| Brass | **Commodore Blare** | shouts every sentence through a megaphone, even indoors | THE ENCORE riverboat (m1) |
| Percussion | **Colonel Rimshot** | tells terrible jokes; a rimshot plays after every one | THE BA-DUM BEHEMOTH drum tank (m2) |
| Woodwinds | **Wing Commander Puffington** | gives speeches that never end | THE WINDBAG bagpipe airship (m3) |
| Strings | **Countess Pizzicata** | a vain diva who believes every fight is her audition | THE GRAND GRAND piano mech (m4) |
| The Conductor | **Grand Marshal Bombastian Fortissimo** | tiny man, giant hat, giant voice | THE GRAND ORGAN, THE CONSOLE, THE MAESTRO (m5) |

- **Fortissimo's look:** about 30 px tall (short, round), with an enormous gold-and-crimson
  bicorne hat (as wide as he is tall) topped by three white plumes, huge gold epaulettes, a
  curled moustache with points that reach past his ears, white gloves, a conductor's baton. He
  talks through a hand megaphone in every cutscene; his text appears in the big font.

### 2.3 Hostages: the critics

Fortissimo has kidnapped the critics (and anyone else who once yawned at a concert). They wear
tweed, bow ties and round glasses, and carry notepads. When freed, a critic scribbles a review of
the player, holds up a card with stars, and hands over a gift. See section 7.

### 2.4 Mission briefings

Delivered by Brigadier Gusto over the radio on the mission intro card (radio-static sfx,
portrait of Gusto: big, red-faced, microphone in hand).

| Mission | Name | Briefing (exact text) |
|---|---|---|
| m1 | BRASS ON THE RIVERBANK | "Cygnets! The Legion has hijacked the Puddlewick Duck Regatta and turned it into a military parade. Free the critics, sink their flagship, and mind the ducks." |
| m2 | DUNE BUGLE | "Their percussion corps is testing a drum so big it registers on earthquake charts. It's in the Rattlebone Flats. Stop it, and please, nobody laugh at the Colonel's jokes." |
| m3 | THE HIGH NOTE | "The Woodwinds have taken Mount Murmur and its ski lift. Something enormous and tartan is floating at the summit. Climb up there and let the air out of it." |
| m4 | OPENING NIGHT | "Fortissimo City. Tonight's dress rehearsal of the Anthem is at the Opera House. Crash it. Formal wear optional." |
| m5 | SWAN SONG | "The Grand Organ is airborne and the anthem starts at midnight. Gramps says the Swan can fly now. Gramps, why didn't you mention this before? ...Never mind. GO!" |

### 2.5 Running gags that carry the story

- **The Metal Swan programme.** Mk1 sank in the Puddlewick river (its head pokes out of the water
  in the m1 background, wearing a little sailor hat). Mk2 "migrated" south last autumn; the
  Legion found it, painted it gold and calls it **THE GOLDEN GOOSE** (m2 mini-boss). Gramps is
  furious: "That is a SWAN, you philistines!"
- **The anthem's wrong note.** The *Anthem of Eternal Attention* has one note that is always
  flat (detuned −50 cents). Every time the anthem plays, the same note is wrong. In the ending,
  Fortissimo finally plays it on the triangle and it is still wrong.
- **Renamed everything.** In m4, every sign in the capital starts with FORTISSIMO
  ("FORTISSIMO LAUNDRY", "FORTISSIMO BAKERY", "FORTISSIMO AVENUE"). The city was called
  *Little Hushing* until last year; one sign still says it, crossed out.
- **Gramps vs. accounting.** Every new Swan feature comes with "Don't tell accounting."

### 2.6 Ending

1. **The Last Note** (in-engine, 600 ticks). The Grand Organ breaks apart over the sea. Its
   pipes fall like bowling pins and each plays one note on the way down; together they play the
   anthem with every note wrong, and then the one wrong note right. Fortissimo floats down in his
   bicorne hat, which works as a parachute.
2. **Splashdown.** The Cygnets glide down in the Trumpeter. Swan Mk1 (which drifted down the
   river to the sea after m1) surfaces under Fortissimo, and he lands on its head, soaking wet.
3. **The Parade** (scrolling right, 900 ticks, players have no control; credits scroll over it).
   Lowmere throws a victory parade for the Cygnets. The freed critics march with "5 STARS"
   placards. The Section Leaders appear doing community service: Commodore Blare directs traffic
   with his megaphone, Colonel Rimshot tells a joke to a crowd that does not laugh (rimshot),
   Puffington is still giving a speech to a pigeon, Countess Pizzicata sings to the parade horses.
   At the very end, Fortissimo walks with the band holding a triangle. He has one note to play.
   He plays it at the wrong time. Everybody cheers anyway.
4. **Final card:** `THE END ... OF THE NOISE.` Then each character's victory pose with a last
   line (section 3), then the score and the high-score entry.

Ending text strings (shown in the big font, centred, one at a time, 180 ticks each):
- `THE ANTHEM WAS NEVER BROADCAST.`
- `THE CRITICS WERE RELEASED, AND WROTE VERY KIND REVIEWS.`
- `GRAND MARSHAL FORTISSIMO NOW PLAYS THE TRIANGLE.`
- `HE IS STILL NOT VERY GOOD.`
- `TASK FORCE CYGNET RETURNED TO THE NEST.`
- `THE END ... OF THE NOISE.`

---
## 3. Playable characters

All four use the shared humanoid rig, the same hitbox (14×30 standing, 16×20 crouching) and the
**same stats**. They differ in silhouette, colours, idle/bored animation, knife look (cosmetic
only: damage and range are identical), death flourish, victory pose and voice lines. Each has
one strong silhouette feature that reads at 1×: Grace = long white scarf, Mittens = huge pom-pom
hat with knitting needles, Pip = oversized helmet and bright vest, Gramps = bald dome with goggles
and walrus moustache.

Palette words below refer to ramps the art agent should provide (`navy`, `ivory`, `crimson`,
`gold`, `brass`, `rust`, `mustard`, `skinA` light, `skinB` medium, `skinC` deep, and so on).

### 3.1 `grace` — Captain Grace Holloway (callsign GRACE)

- **Personality:** squad leader. Unflappable, polite, dry. Says "pardon me" before throwing a
  grenade. Never runs in a way that looks hurried (her run cycle is a long, smooth stride).
- **Rig style:** skin `skinC`; hair `bun-high`, black; headgear `beret`, ivory, tilted left,
  small navy swan pin; top `field-jacket`, navy with brass buttons; pants `cargo`, navy; boots
  `knee-high`, black; gloves `short`, ivory; build `slim` (36 px); accessories `scarf-long`
  (ivory, trails 10 px behind the neck and waves in the run cycle, 3 frames), `whistle` (brass, on
  a lanyard).
- **Knife look:** a furled black umbrella, quick fencing jab.
- **Bored (after 300 ticks idle):** checks a pocket watch, nods, polishes a boot with the scarf.
- **Death flourish:** sits down neatly, folds her hands, then tips over sideways (dust puff).
- **Victory pose:** crisp salute, then a tiny curtsy; the scarf flutters up.
- **Select-screen quote:** `"Pardon me. I'm here to stop the music."`
- **Ending line:** `"Thank you, everyone. You may now resume being quiet."`

### 3.2 `mittens` — Sergeant Torvald "Mittens" Magnusson (callsign MITTENS)

- **Personality:** a gentle giant who almost never speaks. Knits between firefights. Every
  knitted item in the game (the Swan's ski socks in m3, the scarf on the m3 goat mascot, the "SHHH"
  scarf in the ending) is his.
- **Rig style:** skin `skinA` with pink cheeks; hair `short` red, plus accessory `beard-full`
  (red, bushy); headgear `bobble-hat`, cream with two crimson stripes, a 6 px pom-pom and two
  knitting needles stuck through it (they stick up like antennae); top `chunky-sweater`, crimson
  with a cream zigzag band across the chest; pants `cargo`, slate grey; boots `fur-trim`, brown;
  gloves `mittens`, crimson; build `large` (38 px tall, shoulders 2 px wider); accessories
  `yarn-ball` (cream, hangs from the belt).
- **Knife look:** a two-needle knitting poke ("tik-tik").
- **Bored:** knits three rows; the yarn ball rolls away; he shuffles after it and back.
- **Death flourish:** falls backwards stiff like a tree (big dust puff), the pom-pom pops off and
  bounces twice.
- **Victory pose:** holds up a freshly knitted tiny swan and beams.
- **Select-screen quote:** `"..."` then, in the small font: `(He nods. He has knitted you a scarf.)`
- **Ending line:** `(He gives Fortissimo a scarf. It says SHHH.)`

### 3.3 `pip` — Private Pip Okafor (callsign PIP)

- **Personality:** the rookie. Read the whole recruitment brochure and believes every word. Far
  too excited. Collects enemy hats as souvenirs (on the tally screen Pip's hat count is shown as a
  joke stat: "HATS COLLECTED", equal to infantry killed).
- **Rig style:** skin `skinB`; hair `short-curly`, black; headgear `helmet-oversized`, steel grey,
  sits low over the eyebrows (on the `legs-land` frame it slips over the eyes for 1 frame); top
  `vest-over-tee`, mustard reflective vest over a sky-blue T-shirt; pants `shorts`, khaki, with
  white knee pads; boots `high-top`, white with red laces; gloves none; build `small` (34 px);
  accessories `badge` ("I ♥ LOWMERE" drawn as a 3×3 red heart pixel badge on the vest),
  `bubble-gum` (pink bubble in the bored animation only).
- **Knife look:** a frying pan, "BONK" (sfx variant `weapon/knife-pan`).
- **Bored:** blows a bubble that grows until it pops over the face; peels it off.
- **Death flourish:** spins like a top for 12 ticks; the helmet bounces off, then drops back on
  the head.
- **Victory pose:** jumps and punches the air twice; the helmet falls over the eyes.
- **Select-screen quote:** `"Is this the real war? The brochure had more balloons!"`
- **Ending line:** `"Can we do that again? From the start?"`

### 3.4 `gramps` — Warrant Officer Ambrose "Gramps" Fenwick (callsign GRAMPS)

- **Personality:** 71 years old ("seventy, and a bit"). Designed every Metal Swan. Talks to the
  SWAN-3 like a pet ("Who's a good walker?"). Grumpy, proud, secretly very sweet. Every new Swan
  feature is followed by "Don't tell accounting."
- **Rig style:** skin `skinA`, ruddy; hair `bald-tufts` (white side tufts, a 1 px white shine on
  the dome) plus accessory `moustache-walrus` (white, 8 px wide); headgear `goggles-up`, brass
  welding goggles on the forehead; top `boiler-suit`, rust-orange with rolled sleeves; pants
  `boiler-suit` (same piece); boots `work`, black, oversized; gloves `leather`, brown; build
  `stocky`, slight forward lean (+1 px in idle); 35 px; accessories `tool-belt` (brown, with a
  wrench), `pencil-ear`.
- **Knife look:** a big wrench swing, "CLANG" (sfx variant `weapon/knife-wrench`).
- **Bored:** takes a screwdriver to his own boot; the boot starts to squeak with every step for
  the next 120 ticks (cosmetic sfx).
- **Death flourish:** his dentures fly out in an arc and chatter on the ground for 20 ticks, then
  he grabs them back while he falls.
- **Victory pose:** polishes his bald head with a rag; a sparkle pops; thumbs up.
- **Select-screen quote:** `"Back in my day, tanks didn't have legs. Then I gave them legs."`
- **Ending line:** `"Right. Who wants to see the Mk4? It's a submarine. Don't tell accounting."`

### 3.5 `recruit` (test character, kept)

The foundation's test character stays as is. It can be unlocked on the select screen with a
cheat (hold UP on Grace for 120 ticks) and shows the quote `"I'm just here for the tests."`

---

## 4. Core rules & controls

### 4.1 Buttons

| Button | Action |
|---|---|
| left / right | walk; in the air, steer (full air control) |
| up | aim up (hold) |
| down | crouch on ground; aim down in the air |
| fire | shoot; becomes the knife when an enemy is in melee range |
| jump | jump; **down + jump** on a one-way platform drops through it |
| bomb | throw a grenade; in a vehicle, fire the vehicle's sub-weapon |
| fire + bomb (same tick, or within 4 ticks) | vehicle special (section 8) |
| down + jump in a vehicle | eject |
| start | join (P2), pause |

Default keys and gamepad mapping are as in `ARCHITECTURE.md` §5.2.

### 4.2 Movement (tuning targets)

| Value | Amount |
|---|---|
| Run speed | 1.4 px/tick (no acceleration; start/stop in 1 tick) |
| Crouch-walk speed | 0.6 px/tick |
| Jump | vy₀ = −4.0, gravity 0.20 → apex 40 px, 40 ticks in the air on flat ground |
| Max fall speed | 4.5 px/tick |
| Coyote time / jump buffer | 5 ticks / 6 ticks |
| Air control | full run speed, the player may turn around in the air |
| Step-up height | 4 px; slopes up to 1:1 walkable |
| Drop-through | down + jump on a platform: fall through for 12 ticks |
| Landing after a fall > 96 px | 6-tick `legs-land` frame, no control lock |

Fixed jump height (no variable jump), as in the classics: easy to read, easy to plan.

### 4.3 Aiming and firing

- Three aim directions: **forward**, **up** (hold up, on the ground or in the air), **down**
  (hold down, only in the air). The legs and torso are separate, so the player can run and aim up.
- **Aim sweep** (heavy weapons only): when the aim changes while fire is held, the upper body
  passes through the 45° angle for 4 ticks, and shots fired in those ticks go out at 45°. This
  gives the classic "spray arc" feel without diagonal aiming.
- Shots spawn at the `muzzle` point of the current torso frame.
- Holding fire with the pistol auto-repeats every 12 ticks; tapping can reach one shot every
  8 ticks (rewards tapping, but never forces it).
- **Automatic knife:** when fire is pressed and an enemy hurtbox overlaps the melee box (24×26 px,
  from 4 px to 28 px in front of the hip), the player swings the knife instead of shooting.
  Damage 5, active on ticks 3–6 of a 12-tick swing, cooldown 16 ticks. No knife in vehicles.
  Bosses can be knifed only on parts flagged `knifeable`.

### 4.4 Bombs

Grenades are thrown with the bomb button (details in section 6). Start with 10, max 30. While
riding a vehicle, the bomb button fires the vehicle's sub-weapon instead.

### 4.5 Crouch and drop-through

- Hold down on the ground to crouch (hitbox 16×20). Crouching makes the player duck under
  "high" attacks (flagged `high` in the enemy tables; they fly at 20–34 px above the ground).
- Fire while crouched shoots forward from the crouched muzzle (14 px above the ground).
- Down + jump on a one-way platform drops through.

### 4.6 Lives, extends, continues

- **Lives:** 3 per credit (Normal). The lives counter shows the lives in reserve.
- **Extends:** +1 life at 30,000 points and at every 100,000 after that (max 9 in reserve).
  A hidden hostage in every mission gives a `pickup-1up` (section 7).
- **Continues:** 5 credits by default (options: 3 / 5 / 9 / FREE PLAY). When a player has no
  lives left, `CONTINUE?` counts down from 10 (60 ticks per number; pressing jump skips 30 ticks).
  Fire or start continues: the player gets full lives, keeps the score, and re-enters where they
  died. The number of continues used is shown under the score as `CONT n` and is saved with high
  scores.

### 4.7 Death, respawn, invulnerability

- **One hit kills** the player on foot: any enemy bullet, explosion, flame, beam, crush, or a
  contact with a hurtful enemy part. Falling into a `pit` or `kill` hazard, or touching deep
  `water`, `lava` or `spikes` also kills (on foot only; vehicles have their own rules).
- **Death animation:** 60 ticks (`die`, or `die-burn` for fire), including the character's
  flourish (section 3). Comic water death: the player sinks with three rising bubbles.
- **Respawn:** 30 ticks after the death animation, the player drops in from the top of the view
  at the place of death (clamped to the view, or above the partner in co-op) under a small
  swan-shaped parachute (`spawn`, 3 frames, lands in 24 ticks). On landing, every enemy
  projectile within 64 px is removed with a "POOF" puff.
- **Invulnerability:** 120 ticks after landing (blink: 4 ticks visible, 4 ticks hidden). The
  player can shoot and throw bombs while blinking.
- **Loss on death:** the weapon returns to the `pistol` (ammo lost), bombs reset to 10, the
  Helium Head status (section 7.6) ends, hostages are lost by the difficulty rule (section 4.10).

### 4.8 Time limit

- Each section has a timer (HUD, top centre): 60 on Normal, 99 for boss arenas, 99 for the m5
  shoot-em-up. One unit = 60 ticks. The timer resets to full at every checkpoint and at the start
  of every section. It pauses during cutscenes, boss intros and the mission-complete tally.
- At 10 the digits blink crimson and a tick sfx plays each unit (`ui/timer-warn`).
- At 0: `TIME UP!` The player yawns (20 ticks), falls asleep standing up (snore bubble) and loses
  a life (counts as a death). The timer resets to full.

### 4.9 Co-op (2 players)

- P2 joins at any time by pressing START; this uses one credit (`NO CREDITS` if none are left).
- Separate lives, score, weapon, ammo, bombs and hostage tally per player.
- **No friendly fire.** Players walk through each other. A player can stand on the partner's
  head (one-way platform 8 px wide on top of the head; "piggyback" gag: the lower player looks up
  annoyed, cosmetic).
- **Camera:** follows the midpoint of living players and ratchets forward; the scroll stops when
  the rear player reaches the left edge (that player blocks the scroll).
- **Pickups:** first touch wins. **Hostages:** the freed hostage walks to the player who freed it
  and gives the item to that player.
- **Vehicles:** one driver per vehicle. The partner can stand on top of the SWAN-3 and the
  Bandwagon (their tops are moving one-way platforms). In the m5 shoot-em-up each player flies
  their own Trumpeter (P2's has a black neck and beak, "the Mute").
- If one player is out of credits, the other plays on; the empty slot shows `PRESS START`.

### 4.10 Difficulty levels

Chosen on the mode select screen. Names in quotes are shown under each option.

| Setting | EASY "REHEARSAL" | NORMAL "CONCERT" | HARD "ENCORE" |
|---|---|---|---|
| Lives per credit | 5 | 3 | 3 |
| Default credits | 9 | 5 | 3 |
| Enemy projectile speed | ×0.8 | ×1.0 | ×1.15 |
| Enemy attack cooldowns | ×1.4 | ×1.0 | ×0.8 |
| Telegraph durations | ×1.25 | ×1.0 | ×0.9 (never under 18 ticks) |
| Wave entries tagged `[N]` / `[H]` | skipped / skipped | spawned / skipped | spawned / spawned |
| Boss and mini-boss HP | ×0.8 | ×1.0 | ×1.25 |
| Section timer | 99 | 60 | 60 |
| Bombs at start and after death | 15 | 10 | 10 |
| Ammo per weapon pickup | ×1.5 | ×1.0 | ×1.0 |
| Hostages lost on death | none | those freed since the last checkpoint | all freed in this mission |
| Gag double-take window (4.11) | 36 ticks | 24 ticks | 12 ticks |
| Extra behaviours | none | none | rifleman 2-shot bursts; cymbal shockwave both ways; cymbal frisbee; Big-Head and bosses add one extra projectile per volley |
| End-of-mission tally multiplier | ×0.5 | ×1.0 | ×1.5 |

### 4.11 Comedy fairness rules (apply to every enemy)

1. **Gags are free time.** An enemy in a gag state does not attack. It notices a player when the
   player is within 160 px in front of it or 48 px behind it, when a player shot or explosion
   lands within 48 px, or when an alerted ally within 96 px shouts. Then it plays a
   **double-take** (24 ticks: looks at the player, looks away, looks back, "!" bubble), then
   `alert` (12 ticks), then normal behaviour. Killing an enemy before its double-take ends gives
   the "CAUGHT NAPPING" bonus (+100).
2. **Every attack is telegraphed** by a pose and a sound, at least 18 ticks long. Every
   telegraph is listed in section 9.
3. **No off-screen fire:** enemies fire only when their muzzle is inside the view (8 px margin).
4. **Stacking cap:** wave scripts keep at most 4 attacking enemies on screen on Normal (6 on
   Hard), not counting enemies in gags, saluting, panicking or fleeing.
5. **Contact:** walking into a standing infantryman does not kill (the player knifes him).
   Contact kills only for charging enemies, creatures, vehicles and boss parts flagged `contact`.
6. **Reactions:** a player grenade landing within 36 px of an infantryman makes him `panic`
   (40 ticks, runs away at 1.6 px/tick, cannot attack). An infantryman whose officer
   (`baton-major`) dies within 160 px is confused for 60 ticks ("?" bubble, no attacks).
7. **The anthem:** while an `anthem-speaker` plays (section 9.3), Legion infantry within 240 px
   salute: they freeze, do not attack, still take damage, and cancel any telegraph in progress.
   Players are immune (karaoke training). Wind-up robots dance in place; other creatures are not
   affected.

---
## 5. Weapons

### 5.1 Rules

- Every character starts each life with the `pistol` (infinite ammo).
- A weapon pickup replaces the current weapon (old ammo is lost). **Double-pickup rule:** picking
  up the **same** weapon again adds the full pickup ammo (display cap 999) and the announcer says
  `"MORE <NAME>!"` (for example `"MORE ROCKETS!"`).
- When ammo reaches 0, the player returns to the pistol with a dry click (`weapon/empty`) and a
  comic puff from the empty weapon.
- Weapon pickups come from crates and hostages. The crate shows the gold crate letter on a navy
  plate (16×16 icon, big font letter).
- On-screen projectile caps per player: pistol 6, machine gun 16, rocket 4, homing 6, tuba 3.
  At the cap, the press is ignored (no ammo is used).

### 5.2 Weapon table

| id | Name | Crate | Ammo per pickup | Behaviour | Damage | Cooldown (ticks) | Proj. speed (px/tick) | Pierce / area | Pose | sfx id | Announcer line |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pistol` | Service Pistol | — | ∞ | One small bullet straight along the aim. | 1 | 8 tap / 12 hold | 6 | none | pistol | `weapon/pistol` | — |
| `machine-gun` | Machine Gun | **M** | 200 | Hold for a stream; bullets alternate ±1 px vertically; aim sweep (4.3). | 1 | 4 | 7 | none | heavy | `weapon/machine-gun` | "MACHINE GUN! Rat-a-tat-tat!" |
| `shotgun` | Shotgun | **S** | 30 | A short cone blast: a damage area 80 px long that grows from 16 to 44 px tall, active 6 ticks; each enemy is hit once per blast. Visual pellets fly 6 px/tick and fade. Kicks the player back 2 px. | 10 | 40 | — (area) | hits everything in the cone | heavy | `weapon/shotgun` | "SHOTGUN! Say cheese!" |
| `rocket` | Rocket Launcher | **R** | 30 | A rocket that starts slow and speeds up (1.5 → 7, +0.25 per tick); explodes on the first hit or wall. | 10 + 5 splash | 24 | 1.5 → 7 | blast radius 16 | heavy | `weapon/rocket` | "ROCKET LAUNCHER! Mind the backblast!" |
| `flamethrower` | Flamethrower | **F** | 30 bursts | A flame stream 96 px long (slight upward arc, curls down at the tip), active 24 ticks per press; damages everything inside every 4 ticks. Burning kills use `die-burn`. | 2 per 4 ticks | 30 | — (stream) | pierces all | heavy | `weapon/flame` | "FLAMETHROWER! Toasty!" |
| `laser` | Laser | **L** | 200 units | Hold for a continuous beam to the first solid or 300 px. Uses 1 unit per 3 ticks while held; a tap makes a 6-tick pulse (2 units). | 1 per 3 ticks per target | — (continuous) | instant | pierces all | heavy | `weapon/laser` | "LASER! Pew pew. Officially." |
| `homing` | Homing Missiles | **H** | 40 missiles | Fires 2 missiles per press (one up-angled, one down-angled at 15°); each locks on the nearest enemy hurtbox within 220 px in front, turns 5°/tick, lives 120 ticks. | 5 each | 30 | 3 | blast radius 10 | heavy | `weapon/homing` | "HOMING MISSILES! They never forget a face." |
| `tuba` | Tuba | **T** | 25 blasts | A sonic ring that grows from 12 to 40 px over 40 ticks and lives 70 ticks. It hits each enemy once, **erases enemy bullets, notes, records and grenades it touches**, and pushes small enemies (hp ≤ 4) back 8 px. Captured from the Legion. | 6 | 30 | 2.5 | pierces all; erases enemy projectiles | heavy | `weapon/tuba` | "TUBA! Oom-pah-pah!" |

Design notes:
- The **tuba** is the comedy weapon with a real job: low damage, but it is the only weapon that
  defends. It turns the enemy's own instrument against them, and it is the best answer to the
  "note spray" attacks of the late bosses.
- The **shotgun** is the panic button for crowds. Its cone, the flame stream, explosions and
  tuba rings go around a drummer's shield and hit the body (9.1); plain bullets and the laser hit
  the drum.
- Weapon crate frequency target per mission (Normal): 5–7 weapon pickups on any route.

---

## 6. Bombs & melee

### 6.1 Grenade (`grenade`)

| Value | Amount |
|---|---|
| Count | 10 at the start of each life (15 on Easy), max 30, `pickup-bombs` gives +10 |
| Throw | `torso-<w>-throw` (4 frames, 16 ticks); the grenade leaves the `hand` point on tick 6 |
| Throw velocity | forward: vx = 2.0 × facing + 0.5 × player vx, vy = −3.0; aiming up: vx = 1.0, vy = −4.0; crouched: vx = 2.4, vy = −2.2; aiming down in the air: vx = 0.5, vy = +1.0 |
| Gravity | 0.18 px/tick² |
| Bounce | first ground contact: vy = −0.4 × \|vy\|, vx × 0.6; second ground contact: explodes |
| Other triggers | explodes on contact with an enemy hurtbox, or after a 90-tick fuse |
| Blast | radius 20 px, damage 10 to every enemy part inside (team player); `fx/explosion-m`, shake 2 px for 8 ticks |
| Cooldown / cap | 20 ticks between throws; max 2 grenades in flight per player |
| Comedy | infantry within 36 px of a landed grenade play `panic` (4.11 rule 6) |

### 6.2 Knife (`knife`)

| Value | Amount |
|---|---|
| Trigger | fire pressed while an enemy hurtbox overlaps the melee box (24×26 px, 4–28 px in front of the hip) |
| Animation | `torso-<w>-knife`, 12 ticks; active on ticks 3–6 |
| Damage | 5 per swing (one-swing kill on all infantry with hp ≤ 5; drummers lose 5 from the body, not the drum) |
| Cooldown | 16 ticks |
| Look | per character (umbrella / knitting needles / frying pan / wrench); same hitbox and damage |
| Kill animation | infantry killed by the knife play `die-knife`: the **operatic swoon** (kneel, raise one arm, sing one note `enemy/aria`, collapse) |
| Bonus | knife kill +50 points on top of the enemy score ("CLOSE HARMONY") |

### 6.3 Vehicle shells (the bomb button while riding)

| Vehicle | Shell | Behaviour | Damage / area | Cooldown | Ammo on entry |
|---|---|---|---|---|---|
| `swan` | Beak Shell | fired from the beak along the neck angle, vx 4.0 along the aim, gravity 0.06 | 12, blast radius 24 | 30 | 20 |
| `sundae-driver` | Sundae Mortar | high arc from the cone turret: vx 2.5 × facing, vy −4.0, gravity 0.15 | 10, radius 24; infantry inside are frozen in ice for 90 ticks (any hit shatters them: instant kill, `die-shatter` = ice cubes and a surprised face) | 36 | 15 |
| `bandwagon` | Bass Drum Boom | ground shockwave both ways from the truck, 96 px each way, 12 px tall, 3 px/tick | 8 per enemy | 45 | 12 |
| `trumpeter` | Dive Bomb | dropped with the ship's speed, gravity 0.2 | 10, radius 20 | 20 | 30 |

While riding, `pickup-bombs` refills +10 shells instead of grenades. Shell counts are stored on
the vehicle (they stay if the player ejects and gets back in).

---

## 7. Items & hostages

### 7.1 Pickups

| id | Look (size) | Effect | Score |
|---|---|---|---|
| `crate` | wooden supply crate 24×20, stencilled with a white swan; 3 hp | Breaks when shot, knifed or blasted, and drops its `contains` item (set in the wave script: a weapon letter, `bombs`, a food or gem variant, `1up`, or `moth` = nothing but a moth flies out). | 100 for breaking |
| `pickup-weapon` | 16×16 navy plate with a gold letter, bounces when spawned | Gives the weapon and its ammo (5.1). Blinks after 600 ticks, vanishes at 720. | 500 |
| `pickup-bombs` | 16×12 small crate with three grenades on it | +10 grenades (cap 30); +10 shells while riding. | 500 |
| `pickup-food` | variants: `bread` (loaf), `cheese` (wedge), `teacake` (cake with a cherry), `jelly` (wobbling green jelly, 2-frame wobble), `birthday-cake` (tall cake, 3 candles) | Score only. The character does a 1-frame "yum" face. | 100 / 300 / 500 / 1,000 / 5,000 |
| `pickup-gem` | variants: `golden-note` (gold eighth note 8×10, floats and bobs), `gem` (crimson cut gem), `medal` (Legion medal with crimson ribbon), `golden-record` (gold disc 14×14, one hidden per mission) | Score only. | 100 / 1,000 / 2,000 / 10,000 |
| `pickup-1up` | a tiny tin cygnet toy 14×12 that waddles to the nearest player at 0.5 px/tick | +1 life (cap 9). Announcer: "ONE MORE TRY!" | 0 (10,000 if lives are full) |

### 7.2 Hostage types (`hostage`, param `kind`)

All hostages are team `neutral` and can't be hurt. Sprites: `item/hostage/<kind>/<anim>` with the
contract anims `tied`, `freed`, `walk`, `give`, `run`.

| kind | Look | Gift (drop table 7.4) | Freed gag |
|---|---|---|---|
| `critic` (default) | brown tweed jacket, crimson bow tie, round glasses, notepad, grey hair parted in the middle | table A | scribbles for 20 ticks, then holds up a card with 3–5 stars |
| `roadie` | big build, black T-shirt with a white lightning bolt, backwards cap, headphones round the neck | table B (always a weapon) | carries the weapon out like a heavy amp case, puffs, hands it over |
| `tea-lady` | floral apron, hair curlers, holds a teapot | table C | pours a cup of tea, drinks it herself, then gives the gift |
| `tourist` | loud palm-print shirt, sun hat, camera | table D + **SAY CHEESE** | takes a photo: all non-boss enemies on screen freeze in a peace-sign pose for 45 ticks |
| `maestro` | hidden, one per mission; very old conductor, wild white hair, tails, baton | `pickup-1up` | conducts a tiny 4-note phrase (sfx `hostage/maestro`), bows |
| `dollop` | m2 story hostage: Mrs. Dollop, pink ice-cream-seller uniform, paper hat | the `sundae-driver` vehicle | points at her shed, the doors open and the van rolls out (section 11, m2 `a`) |

Binding (param `bind`):
- `chair` — tied to a chair. One hit or a touch frees. The chair falls apart.
- `cage` — hangs from a rope (rope 2 hp). The cage drops, breaks, and frees the hostage.
- `sack` — inside a sack that hops around blindly at 0.3 px/tick. A touch frees.
- `float` — tied to the mast of a parade float (m4). Shoot the 2 ropes (1 hp each).

### 7.3 Hostage behaviour

1. `tied`: loops; every 120 ticks wriggles and shows a "Mmmf!" bubble (4 ticks of shake).
2. Freed: `freed` (20 ticks, ropes fall, stretches), +500 points to the freeing player, a bow-tie
   icon appears in that player's HUD tally.
3. `walk` toward the player who freed it at 0.8 px/tick (passes through everything) until within
   16 px or 180 ticks have passed.
4. `give` (24 ticks): the gift spawns at the `hand` point with vy −2.0 and lands.
5. The hostage salutes for 12 ticks, then `run`s off to the left at 2 px/tick and despawns.
6. If the freeing player is dead or gone, the hostage walks to the nearest living player.

### 7.4 Drop tables (weights)

| Table | Used by | Contents |
|---|---|---|
| A | `critic` | weapon 40 (M 30, S 15, R 15, F 12, L 10, H 10, T 8) · bombs 25 · food 20 (bread 40, cheese 30, teacake 20, jelly 10) · gem 15 (gem 70, medal 30) |
| B | `roadie` | weapon 100 (M 20, S 15, R 20, F 15, L 10, H 10, T 10) |
| C | `tea-lady` | food 60 (teacake 50, jelly 35, birthday-cake 15) · bombs 40 |
| D | `tourist` | gem 70 (gem 60, medal 40) · food 30 (cheese 50, teacake 50) |
| Officer | `baton-major` on death | `medal` 100 |
| Truck | `band-truck` on death | bombs 50 · nothing 50 |

Wave scripts can override any hostage or crate with an exact item (`drop: 'R'`, `drop: 'bombs'`).
Weapon draws use `world.rng`, so runs stay reproducible.

### 7.5 Rescue bonus and death rule

- **On free:** +500 points.
- **Mission end tally:** each hostage still in the player's tally = **1,000** points.
- **STANDING OVATION:** +20,000 if the player (or the pair, in co-op: split equally) freed every
  hostage placed in the sections they passed through on the route taken. The critics stand up
  and clap on the tally screen (`env/applause`).
- **On death** (by difficulty, 4.10): the lost hostage icons "faint" in the HUD: each tips over and
  slides off the bottom of the HUD (8 ticks each, `hostage/faint` sfx). Gifts already given are
  kept. On Normal, the game stores the tally count at each checkpoint; a death reduces the tally
  back to that stored count.

### 7.6 Status gimmick: HELIUM HEAD (`helium-head`)

One original temporary status. It changes the head and the jump, never the body.

- **Source:** `helium-tank` prop: a 20×28 striped pink-and-white gas cylinder with a party balloon
  tied to its valve; 1 hp. When shot, knifed or blasted, it bursts into a helium cloud (48×48,
  pastel pink puffs) for 120 ticks. A player who touches the cloud gets the status.
- **Look:** the head (with its headgear) is drawn at 2× size (rig parameter `headScale = 2`),
  round and shiny, with a 1 px pink outline. The character's sfx and voice play at pitch ×1.6.
  On pickup the announcer says `"HELIUM HEAD!"` and the player answers with a squeaky bubble "Hi!".
- **Effects (600 ticks):**
  - jump vy₀ −5.0 (apex about 62 px);
  - while falling with jump held: gravity 0.08, max fall speed 1.0 (a slow float);
  - run speed ×0.9; crouch is not possible (the head bobs down instead);
  - **one-hit shield:** if anything would kill the player, the head pops instead (BANG, confetti
    burst, `player/helium-pop`), the status ends and the player gets 60 invulnerable ticks.
    Pits and deep water still kill.
  - vehicles can't be entered (the player floats off the seat with a "?" bubble).
- **End:** in the last 120 ticks the head wobbles and hisses louder. At 0: "PFFFT", the player
  spins twice in place (30 ticks, no control, invulnerable) and the head is normal again.
- **Use in levels:** helium tanks sit near secret high ledges (golden records, `maestro`
  hostages) and before hard platforming or arena fights. They appear in m1 `a`/`b1`, m3 `b1`/`b2`,
  m4 `a`/`c2` and m5 `b`.
- **Engine needs:** a `headScale` parameter on the humanoid rig (art), status timers on the
  player with physics overrides (game), and a per-player sfx pitch multiplier (audio).

---
## 8. Player vehicles

### 8.1 Shared vehicle rules

- **Enter:** land on the vehicle's hatch zone (top 16 px of the hull) or press up while
  overlapping the hull. Mounting takes 16 ticks (`mount` anim), invulnerable.
- **HP cells:** each cell holds 12 damage units. Incoming damage to vehicles: rifle bullet 2,
  piccolo bullet 3, enemy grenade 6, tuba ring 6, shell or rocket 8, any boss attack 12, piano
  crush 12. After a hit the vehicle is invulnerable for 30 ticks. With 1 cell left the HUD cells
  blink crimson, the vehicle smokes, and `vehicle/warning` beeps every 60 ticks.
- **Destroyed:** the player is auto-ejected (vy −4.0, 120 invulnerable ticks); 30 ticks later the
  vehicle explodes (radius 40, damage 20 to enemies).
- **Eject:** down + jump. The player jumps out (vy −4.5, 60 invulnerable ticks). The empty vehicle
  stays parked and can be re-entered.
- **Ram:** eject while holding forward. The empty vehicle charges forward and explodes on the
  first enemy or wall or at the end of its run (values per vehicle). A rammed vehicle is lost.
- **Carry-over:** if the player is riding when a section exit fires, the mission runtime spawns
  the same vehicle (same cells and shells) under the player in the next section, if that section
  allows it (`allowVehicles` list per section). Engine request for the mission runtime.
- **NO SCRATCHES bonus:** reaching the end of a vehicle section with all cells: +10,000.
- Vehicle sections have no pits. Only the SWAN-3 floats; other vehicles stop at deep water.

### 8.2 `swan` — SWAN-3 "Metal Swan" walker

| Item | Value |
|---|---|
| Look | Egg-shaped hull 48×26 (ivory, steel-blue shading, navy trim, gold rivets), two long reverse-jointed legs (steel grey, 28 px) with orange webbed feet 12 px wide, an S-curved neck of 6 ivory segments ending in a head with an orange beak (the gun barrel tip) and a black eye visor. The player's head and shoulders show in an open cockpit ring on the back. Folded wing plates on the sides. |
| Size | 64×70 standing (neck up), 64×44 crouched. Hurtbox: hull 44×24 plus legs 20×28. The neck and head are **not** hurtboxes. |
| Move | walk 1.2 px/tick (8-frame stomp, dust puff per step); hop: 6-tick crouch, then vy −3.6 (apex ~32 px); down = crouch (hurtbox height 36) |
| Aim | up/down turns the neck through 5 angles: +30° (forward-down), 0°, −30°, −60°, −90°; one step per 6 ticks while held |
| Water | floats in deep water: the hull rides the surface and the legs paddle fast under it (the "calm on top, furious underneath" shot: legs visible through the water layer, 4-frame blur cycle). Swim speed 1.0; hop from water vy −3.0; immune to ground shockwaves while swimming. |
| Main gun | **Beak Gun**: 1 bullet per 5 ticks, damage 1.5, speed 7, infinite, along the neck angle |
| Sub-weapon | **Beak Shell** (6.3), 20 shells |
| Special | **HONK** (fire + bomb): wings spread and the chest puffs for 10 ticks, then a ring shockwave grows from 0 to 128 px radius in 16 ticks: 8 damage to every enemy part it touches (once), erases every enemy projectile inside it, and infantry inside cover their ears for 60 ticks (stunned). Costs 4 shells; cooldown 240 ticks; with fewer than 4 shells it makes a sad squeak. sfx `swan/honk`. |
| HP cells | 3 |
| Ram | **SWAN DIVE**: the empty Swan lowers its neck like an angry goose, flaps, and runs at 3 px/tick for up to 192 px; explodes on contact: damage 40, radius 40 |
| Empty-vehicle gags | sits down like a resting bird with its head tucked under a wing; its eye follows the nearest player. If left empty for 600 ticks it "lays" one `pickup-bombs` (once per section). Gramps: "She does that when she's nervous." |
| m3 variant | wears Mittens' knitted socks (crimson-and-cream striped feet); on `ice` it slides (deceleration 0.05 px/tick²) |
| Appears | m1 `c` (River Run and the boss), m3 `a` (Yodel Valley) |

### 8.3 `sundae-driver` — the SUNDAE DRIVER (armed ice-cream van)

| Item | Value |
|---|---|
| Look | Boxy van 80×44, pastel pink with mint stripes, striped awning over the serving window, four round wheels (14 px), a roof loudspeaker, and a giant ice-cream cone on the roof (24 px tall, three scoops: pink, white, chocolate) that is the turret; its cherry blinks. The player's head shows in the driver's window. Painted name on the side: `DOLLOP'S`. |
| Size | 80×68 including the cone; hurtbox 76×36 (the cone is not a hurtbox) |
| Move | accelerate 0.08 px/tick², max 2.4 px/tick, brake 0.15; jump = suspension hop vy −3.2 (apex ~26 px); the van faces its direction of travel |
| Aim | the cone turret turns toward the held direction (8-way), 15° per 2 ticks, and keeps its angle when nothing is held |
| Main gun | **Sprinkle Gun**: rainbow sprinkles, 1 per 4 ticks, damage 1.5, speed 7, infinite |
| Sub-weapon | **Sundae Mortar** (6.3), 15 shells; freezes infantry for 90 ticks |
| Special | **JINGLE** (fire + bomb): the van plays its ice-cream jingle (`vehicle/jingle`, an original 8-note tune). Every Legion infantryman within 200 px drops his weapon, takes out a coin and queues in front of the van for 120 ticks (no attacks; they can be shot). Machines and creatures ignore it. Cooldown 900 ticks. |
| HP cells | 3 |
| Contact | driving faster than 1.6 px/tick into infantry squashes them (crush, damage 10, no damage to the van) |
| Ram | the empty van rolls at 2.8 px/tick for up to 200 px, playing the jingle slowed down and wobbly; explodes into a cloud of scoops and sprinkles: damage 40, radius 40 |
| Appears | m2 end of `a` (given by Mrs. Dollop), `b` (Sundae Drive), may carry over into `c1` and `c2` and `d` |

### 8.4 `bandwagon` — THE BANDWAGON (captured Legion parade truck)

| Item | Value |
|---|---|
| Look | Crimson-and-gold flatbed parade truck 96×56: a cab with a chrome grille shaped like a grin, bunting flags, and a small stage on the flatbed with a giant bass drum (Pip painted a wonky white swan over the Legion crest) and a swivelling sousaphone bell (the main gun). The player stands on the stage at the tuba (upper body visible). |
| Size | 96×56; hurtbox: cab 32×36 plus flatbed 64×24 |
| Move | accelerate 0.06 px/tick², max 1.8 px/tick; jump = small hydraulic bounce vy −2.4 (apex ~14 px) |
| Aim | up/down turns the bell through 5 angles: 0°, −30°, −60°, −90°, and −120° (over the cab, backwards-up) |
| Main gun | **Brass Cannon**: a tuba ring every 12 ticks; grows 10 → 24 px, speed 4, damage 3, pierces, erases enemy bullets |
| Sub-weapon | **Bass Drum Boom** (6.3), 12 shells |
| Special | **CYMBAL WALL** (fire + bomb): two giant cymbals swing up in front of the cab for 60 ticks; they block every projectile from the front and deal 10 damage to anything the truck touches. Cooldown 300. |
| HP cells | 4 |
| Co-op | the partner can stand on the stage (one-way platform) and shoot |
| Ram | the driverless truck careens at 2.4 px/tick for up to 240 px while the band music plays twice as fast; explodes into a shower of instruments: damage 50, radius 48 |
| Appears | m4 `b` (Bandwagon Boulevard) |

### 8.5 `trumpeter` — SWAN-3 flight mode "TRUMPETER"

| Item | Value |
|---|---|
| Look | The SWAN-3 with its wings open (72 px span, ivory with navy tips), legs tucked, neck stretched forward, two small jet nozzles under the wings ("Wings AND jets. Don't tell accounting."). P2 flies "the Mute": black neck and beak, grey wing tips. |
| Size | 72×40; hurtbox 28×14 (the hull only: shoot-em-up fairness) |
| Move | free 8-way flight, 2.0 px/tick (1.4 per axis on diagonals); the screen auto-scrolls; the ship stays 4 px inside the view; always faces right |
| Main gun | **Twin Beak Gun**: 2 parallel bullets 4 px apart every 6 ticks, damage 1.5 each, speed 8, infinite |
| Sub-weapon | **Dive Bomb** (6.3), 30 |
| Special | **HONK** (as 8.2), costs 4 dive bombs, cooldown 240 |
| Ram | **BEAK DASH**: double-tap forward: dash 48 px in 8 ticks, invulnerable during the dash, 10 damage to everything touched; cooldown 120 |
| HP cells | 3. Touching a small enemy kills it and costs 6 units. |
| Eject | down + jump: the player bails out under the swan parachute; the empty Trumpeter flies on as a missile (damage 40, radius 40). After 60 ticks a **BACKUP SWAN** flies in from the left and picks the player up with 1 cell. The player floats down slowly, invulnerable, and can fire the pistol while hanging. |
| Destroyed | in the shoot-em-up the Trumpeter **is** the player: losing the last cell costs a life; the player respawns in a new Trumpeter (3 cells, 120 invulnerable ticks) from the left edge |
| Appears | m5 `a` (Above the Clouds) and the Grand Organ fight |

---
## 9. Enemy faction: the Fanfare Legion

### 9.0 Overview and shared rules

The Legion is a marching band turned army (story in 2.2). One instrument per enemy type, one
personality per enemy type, and every attack is a sound you can learn. Colours: **crimson,
gold/brass, white, black** for the Legion; enlisted animals wear a small crimson cap or scarf;
Legion robots are tin and brass with crimson paint.

**Shared infantry rules**
- Walk 0.6 px/tick, run 1.2 px/tick. They step down ledges; they never climb more than 24 px.
- **Entry modes** (script param `entry`): `walk` (from R+16 or L−16), `window` (jumps out of a
  window opening, lands), `chimney` (pops up from a chimney, face sooty for 60 ticks), `manhole`
  (pops up, pushes the lid aside), `parachute` (crimson canopy with gold tassels, falls
  0.6 px/tick, can be shot while falling; the canopy floats away empty), `truck` (jumps off a
  `band-truck`), `rowboat` (two per rowboat, row in on water, stand up and shoot from the boat;
  the boat sinks when both are gone), `ski` (m3: slides in at 2 px/tick and crashes into a
  snowbank for 20 ticks before standing up), `float` (m4: rides a parade float).
- **Outfit param** (`outfit`): `parade` (default), `deck` (white sailor cap, m1), `desert`
  (sun-flap shako, m2), `snow` (fur hat with ear flaps, m3), `night` (black tunic, gold, m4/m5).
- **Extra comedy anims for all infantry** (on top of the contract list in
  `ARCHITECTURE.md` §6.1; all come cheaply from the shared rig): `double-take` (≥3f), `salute`
  (≥2f), `confused` (≥2f), `queue` (≥2f, holding a coin), `photo-pose` (1f, peace sign), `ears`
  (≥2f, hands over ears), `die-crush` (≥3f), `die-shatter` (≥3f).
- **Death variants for all infantry** (by damage kind):
  - bullet / laser / impact → `die`: half spin, the hat pops up 24 px and tumbles; 30% of
    riflemen are recruits whose stick-on moustache flies off separately (`fxRng`). Laser kills
    glow white and dissolve into 4 rising music notes.
  - explosion → `die-blast`: launched in an arc (vx ±1.5, vy −3.0), soot-black, hair frazzled,
    lands head-first stuck in the ground, legs kick for 30 ticks, poof.
  - fire → `die-burn`: runs in a small circle for 30 ticks, becomes a soot silhouette with
    blinking white eyes, crumbles into an ash pile; the eyes blink twice in the pile; poof.
  - knife → `die-knife`: the **operatic swoon** (kneels, raises one arm, sings one note
    `enemy/aria`, collapses). The aria note pitch rises by one scale step for each knife kill in
    a row within 180 ticks (a combo you can hear: do-re-mi-fa...).
  - crush → `die-crush`: flattened like a pancake, peels off the ground like paper, flutters away.
  - ice → `die-shatter`: ice cubes and a surprised face that slides away.
- Corpses never block shots. All death anims finish in ≤ 60 ticks.

### 9.1 Infantry

| id | Name | Size (w×h px) | hp | Score | Missions |
|---|---|---|---|---|---|
| `rifleman` | Brass Private | 16×38 (incl. shako) | 1 | 100 | all |
| `drummer` | Drum Guard | 28×38 (drum 26×26) | 3 + drum 12 | 300 (+100 drum) | m1, m2, m4, m5 |
| `oompah-trooper` | Oompah Trooper | 26×40 | 8 | 500 | m1, m2, m4, m5 |
| `cymbalist` | Cymbal Crasher | 22×36 | 3 | 300 | m1, m2, m3, m4 |
| `baton-major` | Drum Major (officer) | 18×46 (incl. hat) | 10 | 1,000 | m1, m2, m3, m4, m5 |
| `piccolo` | Piccolo Sniper | 30×10 prone | 2 | 400 | m1, m3, m4 |
| `triangle` | Triangle Ringer (alarm) | 14×32 | 1 | 200 (+800 QUIET PLEASE) | m1, m2, m3, m4 |
| `bassoonist` | Bassoon Bazooka | 20×36 | 4 | 600 | m2, m3, m4, m5 |

#### `rifleman` — Brass Private
- **Look:** crimson tunic with gold cord, white trousers, black boots, black shako (8 px) with a
  brass plate and a white plume, curled black moustache; a rifle with a small brass bell flare at
  the muzzle. Recruit variant: crooked stick-on moustache, shako one size too big.
- **Behaviour:** gag or patrol until he notices a player (4.11), then keeps 80–160 px away; uses
  crates as cover. Shoots horizontally; shoots 45° up when the player is > 40 px above and within
  120 px horizontally.
- **Attacks:** *Rifle shot* — raise rifle 18 ticks (muzzle glint on the last 2) → one brass bullet
  8×3, 2.5 px/tick → recovery 30; 90 ticks between shots (Hard: 2-shot burst, 10 ticks apart).
  *Crouch shot* — same timings, the bullet flies 10 px above the ground (jump it). *Grenade* — 25%
  of attack choices when the player is 40–140 px away: wind-up 20 ticks (lit fuse visible) → arc
  vx 1.8, vy −3.0, gravity 0.15; on landing a 30-tick blinking fuse, then blast radius 14;
  cooldown 180.
- **Gags** (param `gag`): `cards` (pair at a folding table; cards fly up on alert), `kazoo`
  (practises a scale, squeaks the top note, glares at the kazoo), `shine` (polishes his shako,
  admires his reflection), `rehearse` (practises a salute, knocks his own shako over his eyes),
  `nap` (asleep on a drum, snore bubble grows and pops).

#### `drummer` — Drum Guard
- **Look:** tall black fur busby (10 px, wider than a shako), crimson tunic, a bass drum 26×26
  (white skin with the Legion crest, gold rims) strapped to the front, two mallets.
- **Shield rule:** the drum is a separate hurtbox in front (12 hp). Bullets and laser from the
  front hit the drum (`hit/drum`, a dull boom). Shotgun cone, flame, explosions and tuba rings
  hit the body. Anything from behind hits the body.
- **Behaviour:** advances 0.5 px/tick, one step per drum beat (beat every 30 ticks,
  `enemy/drum-hit`). In a parade column he sets the tempo: if he dies first, the whole column
  stumbles for 60 ticks (no attacks).
- **Attack:** *Drum Charge* — at ≤ 72 px: drumroll 30 ticks (fast beats, drum shakes) → charges at
  2.5 px/tick for 64 px (contact kills; the drum is 26 px tall, so jump over) → dizzy 40 ticks
  (three stars circle the busby).
- **Drum broken:** his head pokes out through the drum skin, and he runs away at 1.4 px/tick
  (still killable, no attacks).
- **Death:** the drum rolls away like a wheel (1.5 px/tick for 64 px) while he sits down dazed.
- **Gags:** `nap` (asleep sitting on the drum), `air-solo` (air-drums with closed eyes).

#### `oompah-trooper` — Oompah Trooper
- **Look:** big build, a sousaphone coiled around the body with a 20 px brass bell that faces
  forward above the head, red cheeks, small peaked cap.
- **Behaviour:** walks 0.4 px/tick, attacks from 60–200 px.
- **Attacks:** *OOMPAH* — inhales 36 ticks (body puffs +2 px, `enemy/tuba-inhale` rising) → a
  sonic ring (12 → 24 px over 40 ticks, 1.5 px/tick, range 180 px, 3 hp, can be shot down;
  centre 18 px above the ground) → recovery 60 (wheezes, wipes his brow). Jump over it or shoot
  it. *LOW NOTE* — every third blast: a flat ring 24×8 rolls along the ground at 2 px/tick (jump).
- **Death:** a long sad "bwaaa"; the tuba blows him backwards off his feet in a spin. Blast
  variant: the tuba crumples around him like an accordion.
- **Gags:** `polish` (polishes the bell, admires the shine), `practice` (two soft notes, then
  hiccups).

#### `cymbalist` — Cymbal Crasher
- **Look:** slim, crimson and gold, two 14 px cymbals, round cap with chinstrap, big cartoon ears.
- **Attacks:** *CRASH* — approaches to 48–140 px; raises the cymbals overhead, they shimmer
  (`enemy/cymbal-raise`) for 32 ticks → crash → ground shockwave from his feet toward the player,
  10 px tall, 2.5 px/tick, 160 px range, stopped by walls (Hard: both ways) → **recovery 50 ticks:
  his ears ring** (he wobbles, stars) — a free window. *Cymbal frisbee* (Hard only) — wind-up 24
  ticks → one cymbal spins out at 28 px above the ground (`high`), 3 px/tick, 200 px; crouch.
- **Death:** the cymbals clap shut on his own head; blast variant: they roll away like coins.
- **Gags:** `tune` (taps a cymbal, holds it to his ear, nods), `yawn`.

#### `baton-major` — Drum Major (officer)
- **Look:** 46 px with a 14 px plumed hat, gold tunic with a white sash and many medals, a huge
  waxed moustache, white gloves, a 12 px baton with a gold ball.
- **Behaviour:** stays 60–120 px behind his troops; marches in place when idle. Drops a `medal`.
- **Buff "IN STEP!":** every 240 ticks: whistle in mouth 20 ticks (`enemy/whistle`) → riflemen
  within 120 px fire 30% faster for 240 ticks (they bob in time; small note icons over heads).
- **Attack:** *Baton Boomerang* — twirls the baton overhead 30 ticks (blur, whoosh) → throws it
  140 px forward in a flat arc at 3 px/tick; it returns (hits going out and coming back; 10×10;
  can't be shot down; a tuba ring erases it) → catch recovery 30 ticks. 20% chance (`world.rng`)
  he fumbles the catch and bonks himself: stunned 60 ticks ("CLONK").
- **Death:** the tall hat hangs in the air for 20 ticks before it drops; the baton spins up and
  lands on his chest like a lily. Riflemen within 160 px become `confused` (4.11 rule 6).
- **Gag:** `twirl` (twirls, drops the baton, looks around to check nobody saw).

#### `piccolo` — Piccolo Sniper
- **Look:** thin, crimson tunic, slouch cap with a long white feather, a long thin silver
  piccolo-rifle; lies prone on rooftops, ledges and balconies (never on the ground floor).
- **Attack:** *Aim* — a dotted crimson aim line (1 px, every other pixel) from the muzzle to the
  player's chest for 45 ticks, with a rising whistle (`enemy/piccolo-whistle`); the line locks
  (turns solid) 12 ticks before the shot, so a moving player can step out of it → *Shot* — one
  bullet at 4 px/tick along the locked line → reload 120 ticks.
- **Gag:** practises scales. When he notices the player he jumps and drops his piccolo-rifle off
  the ledge, then takes a spare from his cap (40 extra ticks before his first aim).
- **Death:** slides off the ledge with a long slide whistle and lands off-screen ("plop").

#### `triangle` — Triangle Ringer (the alarm)
- **Look:** small (32 px), skinny, oversized wobbling shako, triangle and beater, no weapon, big
  worried eyes.
- **Behaviour:** when he notices a player he rings **DING** three times, 30 ticks apart (a "DING!"
  bubble each time, 90 ticks total). After the third ding: **ALARM** — the wave's `alarm` list
  (default: 3 riflemen) enters from the nearest view edge, `ALARM!` flashes once. Then he runs
  off and despawns.
- **Score:** 200; **QUIET PLEASE** +800 if he dies before the third ding.
- **Gag:** `counting` (counts rests on his fingers, lips moving, then proudly plays one ding — no
  alarm — and starts counting again). "He has one job."
- **Death:** the triangle bounces off his head with a pure "ting!".

#### `bassoonist` — Bassoon Bazooka
- **Look:** goggles and padded ear-muffs (the only Legion soldier who protects his ears), a long
  wooden bassoon-launcher on the shoulder with a curly brass crook, crimson tunic.
- **Behaviour:** anti-vehicle: targets a player vehicle first if one is on screen; keeps
  120–220 px away.
- **Attack:** kneels and aims 40 ticks (rising reed squeak, `enemy/bassoon-aim`) → rocket starts at
  1.0 and accelerates to 3.5 px/tick (+0.1 per tick), straight, 1 hp, blast radius 12 →
  recovery 90.
- **Death:** his last rocket goes straight up and comes back down on his own head 30 ticks later
  (visual only).
- **Gag:** `reed` (licks the reed, tests it, it squeaks, he frowns at it).

### 9.2 Machines

| id | Name | Size (px) | hp | Score | Missions |
|---|---|---|---|---|---|
| `oompah-tank` | Oompah Tank | 72×44 | 50 | 3,000 | m1 `c`, m2 `b` `c1`, m4 `b` |
| `band-truck` | Band Truck (troop carrier) | 88×48 | 60 | 2,000 | m1 `a`, m2 `a` `b`, m4 `a` |
| `metronome-turret` | Metronome Turret | 32×48 | 30 | 1,500 | m1 `b2`, m3 `b2`, m4 `c1`, m5 `b` |
| `gramophone-mortar` | Gramophone Mortar | 40×40 | 24 | 1,200 | m2 `b` `c1`, m4 `a` `c2` |
| `piano-bomber` | Piano Bomber | 96×36 | 40 | 4,000 | m1 `c`, m2 `c2`, m4 `c2`, m5 `a` |
| `baton-copter` | Baton Copter | 48×36 | 20 | 1,500 | m2 `c2`, m3 `b1`, m4 `c2`, m5 `a` |
| `pipe-battery` | Pipe Battery | 64×64 | 5 × 12 | 3,000 (+300 per pipe) | m4 `d`, m5 `b` `c` |
| `anthem-speaker` | Anthem Speaker (support) | 24×40 | 10 | 500 | m1 `a`, m2 `a`, m4 `a` `b`, m5 `b` |

#### `oompah-tank` — Oompah Tank
- **Look:** small crimson tank with gold trim and treads; the turret's cannon is a giant tuba bell
  (20 px wide). Hurtbox: hull 64×28 plus turret 24×14.
- **Behaviour:** 0.4 px/tick; keeps 160–240 px from the nearest player; turns around in 40 ticks.
- **Attacks:** *Bell Shell* — the bell glows yellow and puffs for 45 ticks → arcing shell
  (vx 2.2 × facing, vy −2.5, gravity 0.12), blast radius 18 → recovery 80. *Bass Pulse* — if a
  player is within 64 px: the hull rumbles 24 ticks (dust) → ground shockwave 48 px each side,
  10 px tall (jump) → recovery 40.
- **Death:** the bell flips up and plays three sad descending notes, then the tank explodes. The
  smoking wreck stays as a solid block (56×20) for 600 ticks (cover and a step). A crewman pops
  out of the hatch and runs off flailing (100 if shot).

#### `band-truck` — Band Truck
- **Look:** crimson truck, gold trim; its back is a small stage with seated bandsmen.
- **Behaviour:** drives in at 2 px/tick to its `stopX`, unloads its `cargo` (default: 3 riflemen
  and 1 cymbalist) one every 20 ticks (`entry: 'truck'`), honks a two-tone horn, and after 300
  ticks reverses out at 1.5 px/tick. Contact while moving crushes. No weapon.
- **Death:** explodes; instruments rain down (cosmetic: drums, horns, and one triangle that
  "tings" when it lands). Drops from the Truck table (7.4).

#### `metronome-turret` — Metronome Turret
- **Look:** a pyramid-shaped wooden metronome (crimson, gold numbers), mounted upside down on
  ceilings and under bridges; its pendulum is the gun.
- **Pattern:** the pendulum swings between −50° and +50° from straight down; one swing takes 60
  ticks. The pendulum glows for the last 12 ticks before each extreme and **ticks** (or tocks) at
  the extreme (the telegraph is the rhythm); at each extreme it fires a 3-bullet burst along the
  pendulum (2.5 px/tick, 6 ticks apart). *Accelerando:* after 600 ticks the sliding weight moves
  down (visible) and the swing takes 45 ticks.
- **Death:** the pendulum snaps and twangs away, spinning.

#### `gramophone-mortar` — Gramophone Mortar
- **Look:** a wooden box with a big brass flower horn.
- **Attack:** the horn swivels to aim (30 ticks) → needle-drop scratch (20 ticks,
  `machine/scratch`) → lobs a spinning vinyl record (12 px) in an arc (vx ≤ 3, vy −3.5, gravity
  0.15) aimed to land at the player's x; on landing it rolls at 1.5 px/tick for 96 px (6 px tall,
  jump) and then shatters. One shot per 150 ticks.
- **Death:** the horn falls off and spins like a top; the box plays a slowed-down tune for 60 ticks.

#### `piano-bomber` — Piano Bomber
- **Look:** a fat, slow twin-prop plane with high wings, crimson and gold, and a bomb bay.
- **Behaviour:** crosses the screen at 1 px/tick at y 24–48; drops up to 3 grand pianos per pass.
- **Attack:** the bomb bay opens and a shadow grows on the ground under the drop point for 50
  ticks, with a falling whistle (`machine/piano-whistle`) → the piano falls (accel 0.25) → impact:
  crush zone 32×24, a big comic chord "PLONK" (`machine/piano-crash`), dust. **The landed piano
  stays as a solid block (32×24) for 600 ticks** — cover and a step — then collapses into a pile
  of keys. On water (m1 `c`) the pianos float and act as moving platforms for 600 ticks.
- **Death:** the plane wobbles and drops its last piano on itself.

#### `baton-copter` — Baton Copter
- **Look:** a one-seat gyrocopter whose rotor is a giant spinning conductor's baton; the pilot
  wears a flying helmet with a plume.
- **Behaviour:** flies in, hovers 60–90 px above the ground, moves to a new spot every 120 ticks
  (1.2 px/tick).
- **Attack:** the pilot raises his stick (24 ticks, rotor pitch rises) → 3 note-bullets downward
  at 60°, 90° and 120°, 2 px/tick → recovery 60.
- **Death:** spins down like a sycamore seed and crashes; the pilot parachutes out holding his hat.

#### `pipe-battery` — Pipe Battery
- **Look:** a wall emplacement of 5 brass organ pipes of different heights.
- **Attack:** the pipes light up in chord order, each glowing 30 ticks before it fires → each fires
  a note-rocket straight up that comes down near a player; a shadow on the ground grows for 40
  ticks before impact; blast radius 14. Cycle 180 ticks. Each pipe is a part (12 hp); the battery
  dies when all 5 are gone.

#### `anthem-speaker` — Anthem Speaker (support)
- **Look:** a lamp post with a crimson loudspeaker horn and a small portrait of Fortissimo.
- **Behaviour:** every 900 ticks (or on a script command) it crackles for 30 ticks (a "♪" bubble)
  and then plays the anthem for 180 ticks (`anthem` song fragment). Effect: section 4.11 rule 7.
- **Comedy:** if it is destroyed while playing, the saluting soldiers stay frozen 60 more ticks,
  looking at each other. Players often choose to leave it standing: that is the joke.

### 9.3 Creatures

| id | Name | Size (px) | hp | Score | Missions |
|---|---|---|---|---|---|
| `bullfrog` | Baritone Bullfrog | 28×20 | 4 | 400 | m1 `b2` `c` |
| `windup-bot` | Wind-Up Bandbot | 16×18 | 2 | 100 | m1 `b2`, m2, m3, m4, m5 |
| `rattler` | Maraca Rattler | 48×16 (coiled 28×24) | 6 | 600 | m2 |
| `echo-bat` | Echo Bat | 20×14 (wings 24) | 1 | 200 | m3 `b2`, m5 `b` |
| `ram-goat` | Avalanche Goat | 36×32 | 8 | 800 | m3 |
| `usher-bot` | Usher-Bot | 24×36 | 6 | 700 | m4 `c1` `d`, m5 `b` |
| `kazoo-drone` | Kazoo Drone | 16×12 | 1 (2 in the shoot-em-up) | 100 (+1,000 FULL SET) | m4 `c2`, m5 `a` `b` |

#### `bullfrog` — Baritone Bullfrog
- **Look:** olive frog with a big yellow throat sac and a tiny crimson Legion cap ("enlisted").
- **Behaviour:** hops toward the player every 60 ticks (48 px wide, 40 px high); sits on lily pads.
- **Attacks:** *Croak* — the throat sac inflates for 40 ticks (`creature/croak-build`) → a low
  ring rolls along the ground at 2 px/tick for 120 px (10 px tall, jump) → recovery 40.
  *Tongue* — at ≤ 40 px: eyes bulge 20 ticks → the tongue shoots 40 px straight in 8 ticks →
  retracts in 12.
- **Death:** inflates and pops into bubbles, leaving a small dizzy normal frog that hops away.
- **Gag:** catches a fly with its tongue and burps one tiny note.

#### `windup-bot` — Wind-Up Bandbot
- **Look:** a tin robot with a big wind-up key on its back and a tiny drum on its chest; brass and
  crimson.
- **Behaviour:** marches in lines of 3–6 at 0.8 px/tick, in step; walks off ledges and keeps
  marching; turns at walls. Dances during the anthem.
- **Attack:** within 24 px of a player it stops; the key spins fast and it shakes for 30 ticks
  (rising ratchet, `creature/windup`) → explodes, radius 16. It can be shot during the telegraph.
- **Variants:** `ski` (m3, tiny skis, 1.6 px/tick downhill), `fly` (m5, propeller key, flies in a
  straight line).
- **Death:** springs and cogs pop out; the key flies off spinning.

#### `rattler` — Maraca Rattler
- **Look:** a big desert snake, sand and orange diamond pattern, with a maraca for a tail rattle.
- **Behaviour:** hides in the sand (two eyes and a twitching mound visible).
- **Attack:** when a player is within 96 px: rises and rattles for 45 ticks ("chk-chk",
  `creature/rattle`) → lunges 72 px forward in 12 ticks (contact kills) → recovery 50 (dizzy,
  tongue out).
- **Death:** ties itself in a knot, rattles one last time, poof.

#### `echo-bat` — Echo Bat
- **Look:** small purple bat with enormous ears.
- **Behaviour:** hangs from the ceiling singing little notes (gag). When disturbed (a player
  within 96 px or a shot nearby) it flies a sine path toward the player (1.5 px/tick, amplitude
  24).
- **Attack:** every 120 ticks: screech for 20 ticks (it flashes white, `creature/bat-screech`) →
  dives at the player's position at 3 px/tick, then climbs back. Contact kills.
- **Death:** a puff; it falls with X eyes.

#### `ram-goat` — Avalanche Goat
- **Look:** white mountain goat with curling horns and a crimson knitted scarf (the Legion mascot).
  Mittens notices the scarf: the first time a player meets one, a bubble over Mittens (if he is
  in the game) says "Nice stitching."
- **Attack:** paws the ground and snorts for 40 ticks (dust) → charges along its ledge at
  3 px/tick, jumping gaps up to 32 px; hitting a wall stuns it for 60 ticks (stars). *Leap-down* —
  a shadow appears on the lower ledge for 30 ticks → it leaps down onto it. Contact while
  charging or leaping kills.
- **Death:** tumbles, horns stuck in the snow, legs kicking; poof.
- **Gag:** chews a Legion flag.

#### `usher-bot` — Usher-Bot
- **Look:** a robot theatre usher: crimson uniform, pillbox hat, a flashlight arm and a
  ticket-punch arm.
- **Behaviour:** patrols at 0.5 px/tick with a visible yellow flashlight cone (96 px long, 30°).
- **Attack:** a player in the cone → "SHHH!" bubble, the beam turns crimson for 30 ticks
  (`creature/shush`) → 3 ticket darts in a narrow spread (±8°) at 2.5 px/tick → recovery 60.
- **Death:** its head spins, it prints a long paper receipt that reads `ADMIT NONE`, and it folds up.
- **Gag:** checks an imaginary ticket; polishes its flashlight.

#### `kazoo-drone` — Kazoo Drone
- **Look:** a flying kazoo with two tiny propellers.
- **Behaviour:** formations of 5 (`v`, `sine`, `loop`, `dive`). A formation killed in full gives
  **FULL SET** +1,000.
- **Attack:** drones flagged `shooter` buzz higher for 20 ticks → one slow note-bullet (1.5 px/tick)
  aimed at the player. Contact damage.
- **Death:** pops into confetti.

### 9.4 Mini-bosses

#### `golden-goose` — THE GOLDEN GOOSE (m2, end of section `b`)
- **Concept:** Swan Mk2, which "migrated" south, was captured by the Legion, painted gold and
  renamed. Gramps (if he is a playable character in the game) gets a bubble: "That is a SWAN, you
  philistines!"
- **Look and size:** like the SWAN-3 but bigger: 96×96 standing; gold hull, crimson trim, a
  crimson plume on the head; a Legion pilot in a shako in the cockpit; a nest of crates around it.
- **Parts:** `neck` (80 hp; destroying it removes Neck Lash and the Honk ring), `hull` (200 hp,
  the core; hurtbox 60×36). Total 280.
- **Attacks (cycle, 60-tick gaps):**
  - *Egg Drop* — squats and wiggles 40 ticks → lays 3 golden egg-bombs that roll toward the player
    (1.5 px/tick, 12×14, 2 hp each; explode on contact or after 120 ticks, radius 16).
  - *Neck Lash* — the neck pulls back 30 ticks → sweeps from −60° to +20° over 40 ticks firing 6
    shots (2.5 px/tick).
  - *Goose Step* — lifts a leg high for 20 ticks → stomps toward the player 3 times; each stomp
    sends a small ground shockwave 32 px each way (jump).
  - *Honk Ring* — the chest puffs for 50 ticks → a ring of 8 slow notes (1.5 px/tick) with clear
    gaps between them.
- **Arena:** `LOCK` 384 px, flat sand with two low dunes (16 px) as cover.
- **Death:** it sits down, sighs, and lays one last egg. The egg hatches a `pickup-1up` (a tiny
  tin cygnet). The pilot runs off. Score 15,000.

#### `big-head` — THE BIG HEAD (m4, end of section `a`)
- **Concept:** a propaganda blimp shaped like Fortissimo's head, 160×120, with the bicorne hat as
  the top fin, the moustache tips as gun pods, and loudspeakers in the mouth. It floats at
  y 20–100 and drifts left and right (0.5 px/tick).
- **Parts:** `moustache-left` (50 hp), `moustache-right` (50 hp), `mouth-speaker` (80 hp), `head`
  (150 hp; takes half damage while the mouth speaker lives). Total 330.
- **Attacks (cycle, 50-tick gaps):**
  - *Moustache Volley* — the moustache tips curl up for 30 ticks → each tip fires 3 aimed bullets
    (2.5 px/tick, 8 ticks apart).
  - *Propaganda Drop* — 8 harmless leaflets flutter down, mixed with 2 leaflet-bombs marked with a
    crimson X (they explode on the ground, radius 12; shoot them in the air for 100 each).
  - *ATTENTION!* — the mouth opens for 40 ticks (big-font text `ATTENTION!` on the blimp) → a
    visible sonic cone straight down (64 px wide at the ground) for 30 ticks: step out of it.
  - *Paratroopers* `[N]` — 3 riflemen parachute from the gondola every 600 ticks.
- **Death:** deflates with a long raspberry (`boss/deflate`), loops around the screen twice and
  lands draped over a statue of Fortissimo like a rubber mask. Score 20,000.

---
## 10. Bosses

Shared boss rules:
- Each boss is a multi-part `Boss` entity. Parts have their own hurtboxes and hp; a destroyed
  part explodes (`fx/explosion-m`), leaves a smoking stump, and its attacks stop.
- Every attack follows **telegraph → attack → recovery**; the tick numbers below are Normal.
  The recovery is always a safe window (no new attack starts).
- Phase changes play a 60-tick **intermission gag** (the boss is invulnerable, and so are the
  players; enemy projectiles on screen fade out). The gag gives the player a breath and shows
  the personality of the Section Leader.
- Boss intro: the camera locks, the music switches to `boss` (`boss-final` in m5), the big-font
  card shows the boss name and a one-line subtitle for 120 ticks while the boss enters.
- Boss score is given on death; a **speed bonus** is added in the tally (section 14).
- Sprites: `boss/<id>/<part>-<anim>`.

### 10.1 m1 — `encore` — THE ENCORE (Commodore Blare)

- **Concept:** a paddle-steamer warship with a steam calliope on deck and a giant brass foghorn at
  the bow. It refuses to stay beaten: every phase starts with the riverbank crowd chanting
  `ENCORE!`. Intro card: `THE ENCORE` / `COMMODORE BLARE WILL NOT LEAVE THE STAGE`.
- **Look and size:** 288×150 overall. Hull 288×56 (crimson, gold trim, white railings); two
  funnels shaped like trumpet bells (gold); a 6-pipe calliope on the deck (brass, 10–30 px tall);
  a big foghorn at the bow (gold, 40×28); a red paddle wheel at the stern (64 px across); the
  bridge window with Commodore Blare (white captain's cap, megaphone, mutton chops). In phase 1
  the bow faces the player (bow at view x ≈ 200, the rest past the right edge). In phase 2 it
  turns around behind a splash cloud (sprite flip) so the stern and the wheel face the player.
- **Arena (m1 `c`):** `LOCK 2616–3000`. A floating pontoon (one-way platform) from x 2616 to
  2840 at y 176; deep water elsewhere (water line y 180). Two floating crates bob ±4 px at
  (2700, 150) and (2760, 136) as extra height. The SWAN-3 can swim anywhere.
- **Parts:** `horn` 100 hp (bow) · `calliope` 120 hp (deck) · `wheel` 150 hp (stern; weak point,
  only exposed from phase 2). Total 370.
- **Phase 1 — "First Act"** (until `horn` and `calliope` are both destroyed). Cycle A, B, A, B…;
  C runs on its own timer.
  - **A Steam Scale:** telegraph 40 — the pipes puff steam in order, low to high, with a rising
    scale (`boss/calliope-scale`) → attack: 6 steam notes, one every 8 ticks, arc onto the
    pontoon at player x −48, −24, 0, +24, +48, then the player's current x; each leaves a 24×16
    steam puff for 20 ticks → recovery 60.
  - **B Foghorn:** telegraph 50 — the horn tilts **down** or **up**, glows, and a rising toot
    plays → a sonic wave 16 px tall crosses the pontoon right-to-left at 3 px/tick: the low wave
    covers 0–16 px above the deck (jump), the high wave covers 20–36 px (crouch) → recovery 40.
  - **C All Hands** `[N]`: every 600 ticks, 2 riflemen (`outfit: 'deck'`) jump from the deck onto
    the pontoon at x 2800.
  - If one part dies, the other's cooldowns ×0.8.
- **Intermission gag:** Blare through the megaphone: `THAT WAS ONLY THE FIRST ACT!`; the crowd
  chants `ENCORE!`; the boat reverses into a splash cloud and comes back stern-first.
- **Phase 2 — "Encore"** (wheel ≥ 75 hp). Cycle D, E, F.
  - **D Paddle Wave:** telegraph 60 — the wheel spins up (blur, spray, rising whoosh) → a water
    wave 24 px tall rolls across the pontoon at 2 px/tick (jump it; vehicles take 12) → recovery 50.
  - **E Barrel Roll:** telegraph 24 — a deckhand appears at the stern holding a barrel → 3 barrels,
    20 ticks apart, roll along the pontoon at 1.2 px/tick (16 px tall, contact kills, 2 hp each)
    → recovery 40.
  - **F Smoke Stack:** telegraph 40 — the funnels puff black smoke → 4 soot balls arc out
    (vx −1.5 to −3.0, vy −3.0, gravity 0.12) and burst on landing (radius 10) → recovery 50.
- **Phase 3 — "Second Encore"** (wheel < 75 hp). Blare climbs onto the stern rail with a
  trombone. Cycle G, D, G, F; cooldowns ×0.8; the hull sinks 1 px every 60 ticks (cosmetic).
  - **G Slide Shot:** telegraph 30 — the slide pulls back (`boss/trombone-pull`) → the slide shoots
    a brass pellet at 4 px/tick, alternating chest height (crouch) and ankle height (jump), 3 shots
    per cycle, 30 ticks apart → recovery 40.
- **Death sequence (300 ticks):** 6 explosions chain along the hull, 15 ticks apart; the wheel
  breaks off and rolls away downriver; the boat lists while the calliope plays a sad descending
  run; Blare stands on the bridge saluting until only his cap shows. 120 ticks later he pops up in
  a rubber ring and paddles off: `THIS ISN'T OVER! ...IS IT? IT IS? DRAT!` Score **30,000**.

### 10.2 m2 — `ba-dum-behemoth` — THE BA-DUM BEHEMOTH (Colonel Rimshot)

- **Concept:** a giant drum kit on tank treads. Colonel Rimshot sits on the drum throne on top and
  tells awful jokes; a rimshot (`env/rimshot`) plays after every one. Intro card:
  `THE BA-DUM BEHEMOTH` / `COLONEL RIMSHOT IS HERE ALL WEEK`.
- **Look and size:** 240×170. Crimson treads 200×28; on them a bass drum on its side, 120×120,
  facing the player (white skin with the Legion crest, gold hoops); two tom-tom turrets (32×24)
  on top; a crash cymbal (56 px disc) on a stand arm in front of the bass drum as a shield; a
  hi-hat (40 px cymbals) on a long hydraulic arm that reaches forward; Rimshot on the throne
  (striped jacket, bow tie, big grin, two drumsticks).
- **Arena (m2 `d`):** `LOCK 1600–1984`. Flat sand at y 176, quarry walls at both ends; two
  sandstone ledges (one-way, 64 px wide) at view x 24–88 and 140–204, y 132. The tank patrols
  view x 230–290 at 0.4 px/tick.
- **Parts:** `hihat-arm` 120 hp · `tom-left` 80 hp · `tom-right` 80 hp · `crash-shield` 100 hp
  (blocks shots at the bass drum while it is in front) · `bass-drum` 200 hp (core). Total 580.
- **Phase 1 — "Warm-Up"** (until 2 of `hihat-arm`, `tom-left`, `tom-right` are destroyed).
  Cycle A, B, A, C.
  - **A Hi-Hat Crush:** the arm moves over the nearest player's x (30 ticks) → the cymbals open,
    "chick", and a shadow grows on the ground (telegraph 45) → slam (crush zone 40×20) → the
    closed hi-hat stays down 30 ticks (its top is a platform) → lifts back in 30.
  - **B Tom Volley:** telegraph 30 — the tom heads flash, drumroll → each living tom fires 2 mortar
    shells 12 ticks apart (tom-left lands at player x −32 and +32, tom-right at 0 and +64),
    radius 14 → recovery 50.
  - **C Rimshot Taunt:** a joke bubble for 90 ticks, then the rimshot. **No attack**: a free window.
    Jokes (rotate): `KNOCK KNOCK! WHO'S THERE? A TANK MADE OF DRUMS!` /
    `I TOLD THE ARMY I'D BEAT THEM. NOW I BEAT DRUMS. CLOSE ENOUGH!` /
    `MY FAVOURITE DESSERT? A ROLL. A DRUM ROLL!` / `I'M NOT LOUD. I'M PERCUSSIVE!`
- **Intermission gag:** Rimshot: `THAT'S MY WARM-UP ACT!` (rimshot, nobody laughs, one cricket
  chirps: `env/cricket`).
- **Phase 2 — "Drum Solo"** (until `bass-drum` < 100 hp). Cycle D, E, D, B (if a tom lives).
  - **D Kick Boom:** telegraph 40 — the giant pedal beater at the back pulls back with a creak and
    the crash shield swings aside → BOOM: the drum skin flexes; a ground shockwave rolls both ways
    (12 px tall, 3 px/tick; jump), shake 3 px for 10 ticks → recovery 40 (the shield stays aside:
    the window to hit the bass drum).
  - **E Drum-Roll Charge:** telegraph 40 — the treads spin, dust flies, and a dust line appears on
    the ground at view x 130 → the tank charges left at 2 px/tick and stops with its front at that
    line (view x 0–120 is always safe) → it backs off at 1 px/tick.
- **Phase 3 — "Big Finish"** (bass drum < 100 hp). Rimshot stands up. Cycle F, G, D; cooldowns
  ×0.8.
  - **F Stick Storm:** telegraph 40 — Rimshot throws sticks high; 6 shadows appear on the ground →
    the sticks rain down on the shadows (4×16 each) → recovery 40.
  - **G Cymbal Saw:** telegraph 30 — the crash cymbal (or, if destroyed, Rimshot's spare) spins up
    with a rising shimmer → flies left across the arena at 28 px above the ground (crouch) →
    returns at 6 px above the ground (jump) → recovery 40.
- **Death sequence (240 ticks):** the drums explode one by one like a drum fill: tom, tom, bass,
  crash ("boom, boom, BOOM, tssss"); 60 ticks of silence; Rimshot crawls out of the bass drum,
  dusts himself off: `TOUGH CROWD.` (rimshot). Score **40,000**.

### 10.3 m3 — `windbag` — THE WINDBAG (Wing Commander Puffington)

- **Concept:** a bagpipe airship: the tartan bag is the balloon, the three drone pipes are
  cannons, the chanter that hangs below is the main gun, and Puffington talks in his gondola the
  whole time. Intro card: `THE WINDBAG` / `WING COMMANDER PUFFINGTON HAS A FEW WORDS`.
- **Look and size:** 320×180. Bag 200×110 (crimson-and-gold tartan, patched); three drone pipes
  (8×60, black and brass, with tassels) sticking up and back; the chanter (12×56, black with
  silver rings and finger holes) under the front of the bag; a wooden gondola (64×24) under the
  bag with Puffington (handlebar moustache, flying goggles, a stack of speech notes); a propeller
  at the back.
- **Arena (m3 `c`):** `LOCK 896–1280`. The summit cable-car deck: concrete at y 176, a station hut
  (solid 40×40 at view x 16–56, roof is a platform), two snow piles (16 px). The airship floats at
  view x 180–360, y 10–120.
- **Parts:** `drone-1`, `drone-2`, `drone-3` 80 hp each · `chanter` 150 hp · `bag` 250 hp (core;
  shots bounce off with a "boing" until all three drones are gone). Total 640.
- **Phase 1 — "The Speech"** (drones alive). A speech bubble scrolls the whole time and never ends
  (`...AND FURTHERMORE...`). Cycle A, B, C, B.
  - **A Gust:** telegraph 60 — the bag swells ("hoooo") → it exhales: players are pushed left at
    0.6 px/tick for 90 ticks (wind streaks; walking right still makes 0.8 px/tick) → recovery 30.
  - **B Drone Bolts:** telegraph 40 — one drone tip glows and its hum rises → 3 slow homing notes
    (1.5 px/tick, turn 2°/tick, life 180, 1 hp each). Drones take turns.
  - **C Sheet-Music Mines:** 4 sheets of music flutter down slowly, swaying (visible 40+ ticks);
    they explode on the ground or on a player (radius 12); shoot them for 50 each.
- **Intermission gag:** Puffington drops his speech notes; they scatter in the wind; he starts
  again from page one.
- **Phase 2 — "The Chanter"** (drones gone; the bag can be hurt). The airship sinks to y 40–90.
  Cycle D, E, A.
  - **D Reel:** telegraph 30 — the finger holes light up in order → a stream of notes (one every 4
    ticks, 2 px/tick) hits a line on the floor that starts at the far left and sweeps right toward
    the boss over 60 ticks: jump the moving impact line once → recovery 40.
  - **E Pendulum Gondola:** telegraph 40 — the ropes creak and the gondola pulls back → it swings
    across the arena; its lowest point passes 24 px above the ground in the middle (crouch) →
    recovery 40.
- **Phase 3 — "Hot Air"** (bag < 100 hp). A patch pops and the bag leaks. Cycle F, C, F.
  - **F Leak Dash:** telegraph 30 — the leak spurts and a dotted line shows the dash path (always
    either a horizontal line at y ≤ 90, or a diagonal that meets the ground at a marked shadow) →
    the Windbag dashes along it at 4 px/tick (contact kills), bounces once off the view edge, stops
    → recovery 50.
- **Death sequence (300 ticks):** the bag deflates with a long, dying drone chord
  (`boss/bagpipe-die`), loops around the screen three times and wraps itself around a background
  peak. Puffington parachutes down, still talking, and lands head-first in a snow drift, legs
  kicking, with a muffled bubble `...MMF... AND FURTHERMORE...`. Score **50,000**.

### 10.4 m4 — `grand-grand` — THE GRAND GRAND (Countess Pizzicata)

- **Concept:** a black grand piano on four piston legs that walks, bites with its lid and fires
  felt hammers, with Countess Pizzicata singing on the bench on top. The fight is staged as an
  opera premiere: the curtain rises, the audience silhouettes gasp and clap. Intro card:
  `THE GRAND GRAND` / `COUNTESS PIZZICATA REQUESTS YOUR SILENCE`.
- **Look and size:** 220×150. Body 180×60 (glossy black, gold trim); the lid is the jaw (hinged at
  the back); the keyboard at the front shows keys like teeth; four chrome piston legs (40 px) on
  brass castors; the Countess on top (tall beehive hairdo, tiara, emerald gown, opera glasses).
- **Arena (m4 `d`):** `LOCK 1400–1784`, a wooden stage at y 176. A prop crate step (one-way,
  48 px wide) at view x 100–148, y 144, and two balcony boxes (one-way, 72 px wide) at view x 8–80
  and 140–212, y 108. Three chandeliers hang at view x 60, 180 and 300 (y 0–30).
- **Parts:** `lid` 150 hp · `keyboard` 120 hp · `front-legs` 100 hp · `strings` 250 hp (core: the
  gold harp frame inside the body, exposed when the lid is gone). Total 620. The keyboard and the
  legs can be destroyed in any phase; each removes its attacks.
- **Phase 1 — "Overture"** (until the `lid` is destroyed). Between attacks the piano stomps 32 px
  toward the player at 0.5 px/tick, on the beat. Cycle A, B, C.
  - **A Chomp:** telegraph 40 — the lid opens wide and the keys rattle → lunges 64 px forward and
    snaps shut (bite zone 56×40) → recovery 50; the lid stays open for the first 20 recovery ticks
    (the lid takes ×1.5 damage while open).
  - **B Glissando:** telegraph 36 — keys light up left to right with a rising run → 12 felt hammers
    fan out in a rising arc (angles −10° to −70°, 2.5 px/tick, gravity 0.05) → recovery 50.
  - **C High C:** telegraph 40 — the Countess inhales; the chandelier above the nearest player
    shakes and its shadow appears → it falls (impact 48×24) and stays on the stage as a solid
    obstacle (16 px tall) for 300 ticks. Skipped when all three have fallen.
- **Intermission gag:** the Countess demands a costume change. The curtain drops for 60 ticks
  (stage hands drag the broken lid away) and rises again; her hat is now twice as tall.
- **Phase 2 — "Intermezzo"** (until `strings` < 125 hp). Cycle D, B, E.
  - **D Harp Strings:** telegraph 45 — 5 flickering 1 px gold preview lines show the beam paths (a
    fan across the stage from the strings, with gaps of at least 24 px at floor level) → 5 laser
    beams (4 px wide) for 30 ticks → recovery 40.
  - **E Pedal Stomp:** telegraph 30 — the front legs lift → stomp: a ground shockwave both ways,
    10 px tall (jump) → recovery 30. Skipped when `front-legs` is destroyed.
- **Phase 3 — "Finale"** (strings < 125 hp). The legs fold; the piano drops onto its castors
  (hurtbox height 60, top at y 116). Cycle F, G, D; cooldowns ×0.8.
  - **F Castor Charge:** telegraph 40 — the piano leans back and the castors squeal → it rolls
    across the stage at 2.5 px/tick to the far side and back (contact kills). Safe: the balconies
    (y 108), reached from the crate step.
  - **G Grand Aria:** telegraph 60 — a huge breath; all remaining chandeliers shake and show their
    shadows → they all fall at once → recovery 60. If none remain, 6 crystal shards fall on
    marked shadows instead.
- **Death sequence (300 ticks):** the piano collapses key by key, each key popping off with one
  note of a descending scale, then a final crashing chord. The Countess stands in the wreck and
  takes a deep bow; a single rose lands at her feet. `BRAVA! ...WAIT. YOU'RE THE ENEMY.` She faints
  in an operatic swoon. Score **60,000**.

### 10.5 m5 — the final boss: Grand Marshal Fortissimo (three stages)

#### Stage 1 — `grand-organ` — THE GRAND ORGAN (end of m5 `a`, shoot-em-up)

- **Concept:** the flying fortress itself: a cathedral-sized pipe organ with propellers, bellows
  for lungs and a rose window, rehearsing the anthem through a giant loudspeaker. Intro card:
  `THE GRAND ORGAN` / `TONIGHT'S PROGRAMME: YOU`.
- **Look and size:** the visible front face is 300×200: dark carved wood with gold, three brass
  pipe clusters (top, middle, low; 60×50 each), accordion bellows (80×60) that pump, a huge gold
  loudspeaker horn (64×48) in the centre (closed behind shutters at first), a rose window at the
  top. It hovers at view x 200–384+ (partly off-screen) and drifts up and down 0.3 px/tick
  (±24 px). The camera auto-scroll stops (arena), the cloud layers keep scrolling, and the
  Trumpeters keep free movement.
- **Parts:** `pipes-top` 100 · `pipes-mid` 100 · `pipes-low` 100 · `bellows` 150 (optional,
  +5,000) · `speaker` 120 (the shutters open after 2 pipe clusters are destroyed). The stage ends
  when the `speaker` is destroyed.
- **Phase 1 — "Rehearsal"** (until 2 pipe clusters are gone). Cycle A, B, A; C on its own timer.
  - **A Chord Spray:** telegraph 30 — one cluster's pipes light up → 3 fans of 5 notes (spread
    40°, 1.8 px/tick), 20 ticks apart → recovery 40. Clusters take turns.
  - **B Bellows Breath:** telegraph 45 — the bellows pull open → a wind blast pushes the
    Trumpeters left at 1.0 px/tick for 60 ticks (the left view edge is safe), carrying 6 slow
    notes → recovery 30.
  - **C Kazoo Escort** `[N]`: every 480 ticks a `kazoo-drone` formation (5, `sine`) leaves a hatch.
- **Phase 2 — "Dress Rehearsal"** (the speaker opens). Cycle D, A, B.
  - **D Anthem Beam:** telegraph 50 — the speaker glows and a 24 px horizontal stripe flickers
    across the screen at its height → a sound beam fills that stripe for 40 ticks → recovery 50.
- **End of stage (180 ticks):** the speaker explodes with a squawk; the anthem stops on its wrong
  note; the organ lurches and opens a landing hatch; the Trumpeters fly in automatically (exit to
  m5 `b`). Score **30,000**.

#### Stage 2 — `organ-console` — THE CONSOLE (m5 `c`, on foot)

- **Concept:** Fortissimo plays the console himself. The three keyboards (manuals) are three tiers
  of platforms, and a giant sheet-music screen above the room **shows the score of the next
  attacks**: the telegraph is the sheet music. Intro card: `THE CONSOLE` /
  `HIS LOUDNESS WILL NOW PERFORM`.
- **Look and size:** the console fills the right of the arena (320×160): dark wood, gold, ivory
  keys. Tiers (one-way platforms; stepping on them plays a note, cosmetic): tier 1 view x 120–300,
  y 148 · tier 2 view x 150–300, y 116 · tier 3 view x 180–300, y 84. Pipe banks climb the left
  wall (view x 0–40) and the right wall (view x 344–384). Fortissimo sits at the top right (view x
  300–360, y 60). The sheet screen hangs at view x 64–320, y 8–48 with **4 staff lines = 4 lanes**
  (floor, tier 1, tier 2, tier 3) and a NOW bar at its left end.
- **Parts:** `pipe-bank-left` 150 · `pipe-bank-right` 150 · `console` 300 (the glowing music stand;
  damageable only after one pipe bank is destroyed). Total 600.
- **THE SCORE (runs all fight):** notes appear at the right of the screen and scroll left at
  2 px/tick, reaching the NOW bar after 64 ticks. When a note reaches NOW, its lane is blasted by
  both pipe banks for 20 ticks (a horizontal blast band 32 px tall at that lane's height). At most
  2 of the 4 lanes fire at once on Normal (3 on Hard); there is always a safe lane. Phrases (one
  note per beat, 32 ticks per beat; `F` floor, `1`–`3` tiers, `-` rest):
  - Phrase 1: `F - 1 - F - 2 -` · Phrase 2: `F 1 - 2 F - 3 -` · Phrase 3: `F1 - 23 - F2 - 13 -`
    (two letters = a chord, both lanes) · Phrase 4 (fugue): `F 1 2 3 F 1 2 3`.
  - Phase 1 plays phrases 1, 2, 1, 3 in a loop.
- **Phase 1 — "Overture"** (both banks alive): THE SCORE plus
  - **A Pedal Notes:** telegraph 30 — his feet slam the pedalboard (visible under the console) → a
    floor shockwave 10 px tall from the console (jump) → recovery 30. Never on the same beat as a
    floor note.
- **Phase 2 — "Fugue"** (one bank destroyed; the console can be hurt): notes scroll at 3 px/tick
  (43 ticks of warning); phrases 2, 3, 4, 3; plus
  - **B Stop Pull:** telegraph 40 — he pulls a big labelled stop knob → a mini-wave by label:
    `TRUMPET` = 2 riflemen from a side door; `FLUTE` = 3 homing notes; `PICCOLO` = a piccolo
    sniper on tier 3; `BOMBARDE` = 4 falling note-bombs on marked shadows → recovery 60.
- **End of stage:** the console explodes and throws Fortissimo into the air; he lands in his
  escape podium (stage 3 starts at once). Intermission gag: his hat is on fire; he blows it out;
  the plumes are now black. Three wreck blocks (solid, 24×32) fall onto the floor at view x 70,
  180 and 290. Score **40,000**.

#### Stage 3 — `maestro` — THE MAESTRO (m5 `c`, same arena)

- **Concept:** Fortissimo in his personal flying conductor's podium. A tiny target with a giant
  voice. Intro card: `THE MAESTRO` / `GRAND MARSHAL BOMBASTIAN FORTISSIMO`.
- **Look and size:** 64×64: a round brass podium (48×28) on a hover jet, a speaker wing (8×24) on
  each side, and Fortissimo (30 px, bicorne 30 px wide) standing on top with a giant baton.
- **Parts:** `speaker-left` 60 · `speaker-right` 60 · `podium` 240 (core; the glowing gem on its
  front). Total 360.
- **Movement:** a figure-eight over the arena (one loop per 360 ticks), y 40–120; it stops for
  each attack.
- **Attacks** (cycle A, C, B, A, C, then D when podium < 120 hp; D at most every 600 ticks):
  - **A Baton Lash:** telegraph 30 — the baton glints and a thin arc preview line shows the sweep
    → a beam (6 px wide, 120 px long) sweeps a 120° arc in 30 ticks → recovery 40.
  - **B Tempo!:** telegraph 60 — he taps the baton on the podium 4 times (tock-tock-tock-tock) →
    the music plays 25% faster for 300 ticks and his cooldowns ×0.8. No damage; pure pressure.
  - **C Speaker Volley:** telegraph 24 per living speaker — the cone pulses → 5 note-bullets in a
    spread toward the player (2 px/tick) → recovery 30.
  - **D FORTISSIMO!:** he flies to the top centre (view x 192, y 50); telegraph 60 — a gigantic
    breath, his hat lifts off his head, the text `FORTISSIMO...` grows letter by letter, and the
    floor glows behind the wreck blocks → the scream: every player with line of sight from his
    mouth to the player's head (`terrain.lineOfSight`) is hit. Hide behind a wreck block →
    recovery 90: he coughs and sinks to y 140 with a hoarse voice (best damage window).
- **Death sequence (360 ticks):** his last scream cracks into a squeak (`FORTISSI—` then a tiny
  `*squeak*`); the podium sputters; every pipe in the organ plays one note on its own and the
  room starts to fall apart. The players auto-run right and jump into a Trumpeter flown by Gramps
  ("I'm a pilot now too. Don't tell accounting."); if Gramps is one of the players, Brigadier
  Gusto flies it instead, singing. The ending follows (2.6). Score **100,000**.

---
## 11. Missions

### 11.0 Shared mission rules and notation

- **Route map:**

| Mission | Path (sections) | Branch point → routes → rejoin |
|---|---|---|
| m1 | `a` → (`b1` or `b2`) → `c` (boss) | end of `a`: ROOFTOPS ↑ (`b1`) or DRAIN ↓ (`b2`) → both exit into `c` |
| m2 | `a` → `b` → (`c1` or `c2`) → `d` (boss) | end of `b`: CANYON ↘ (`c1`) or MESA ↗ (`c2`) → both exit into `d` |
| m3 | `a` → (`b1` or `b2`) → `c` (boss) | end of `a`: NORTH FACE ↑ (`b1`, vertical) or CAVES → (`b2`, vertical) → both exit into `c` |
| m4 | `a` → `b` → (`c1` or `c2`) → `d` (boss) | end of `b`: SUBWAY ↓ (`c1`) or ROOFTOPS ↑ (`c2`) → both exit into `d` |
| m5 | `a` → `b` → `c` (final boss) | none |

- **Choosing a route:** after the branch-point fight, both exit zones open at once and a sign
  with an arrow appears over each. The first player to touch an exit zone takes the whole team
  (the partner is moved along). There is no menu: the choice is physical.
- **Ground line** y = 176 unless noted. "Platform" = one-way; "solid" = blocks from all sides.
- **Wave tables:** trigger (`@X` camera left edge for horizontal sections, `@Y` camera top edge
  for vertical sections) → spawns. `[N]` = Normal and Hard only; `[H]` = Hard only. Positions are
  section coordinates of the feet. `gag:` = idle gag; `entry:` = entry mode (9.0). Hostages are
  written `hostage kind/bind @x (drop)`.
- **Pacing rule:** a checkpoint roughly every 900–1200 px (or 600 px vertically); never more than
  45 s of play between checkpoints.
- **Comedy props** (decor entities, cosmetic unless noted): `prop/card-table`, `prop/parasol`,
  `prop/spring-awning` (bounce pad, vy −6.0 on landing; also the `net` variant), `prop/duck-float`
  (giant rubber duck, moving platform 32×20), `prop/statue-head` (5 hp, rolls off, +500
  VANDALISM), `prop/breakable-wall` (20 hp, hides secrets), `prop/rolling-drum` (24 px, rolls
  2 px/tick, 4 hp, contact kills), `prop/helium-tank` (7.6), `prop/air-jet` (pushes up 1.5 px/tick
  while inside), `prop/parade-float` (moving platform 96×40).

### 11.1 m1 — BRASS ON THE RIVERBANK

- **Biome and mood:** Puddlewick, a little brick river town on the river Wend, on a bright spring
  morning. Red roofs, willow trees, regatta bunting, rubber ducks everywhere; Legion crimson
  banners pasted over the regatta posters. Palette: fresh greens, sky blue, warm brick, cream,
  with crimson and gold accents.
- **Music:** `m1`; boss `boss`. **Announcer at start:** "MISSION ONE. LOOK SHARP, CYGNETS!"
- **Hostages on any route:** 10 (including the hidden `maestro` in `a`).

#### m1 `a` — Puddlewick Quay (2560×216, scroll right, timer 60)
- **Background:** `sky-gradient` (sky blue top → pale lemon horizon) · `clouds` (white, factorX
  0.1) · `hills` (soft green, 0.2) · `treeline` (dark willow green, 0.35) · `town-rooftops`
  (custom: red-brown roofs, cream walls, bunting strings, 0.55).
- **Terrain style:** ground `concrete`, edge `tiles` (cobbles), platform `wood`, solid `brick`.
- **Terrain:** flat cobbled street y 176 from 0 to 600; short ramp up to y 160 (600–660, market
  square) flat to 1100; ramp down to 176 (1100–1160); flat to 2560. Platforms: shop awnings
  (420–476, y 136), triangle balcony (760–820, y 128), awning (1300–1360, y 132), bandstand roof
  (1640–1756, y 112) on a bandstand base (solid 1650–1746, y 160–176), roof awning (1880–1960,
  y 120), **secret roof ledge** (1900–1980, y 64), chimney ledge (2020–2070, y 92), quay steps
  (2440–2520, y 140) and (2460–2540, y 100). Solids: market crates (980, 24×20), (1440, 24×40).
  The storm-drain lid at 2364–2396 is a solid entity until the end fight. The right edge (2560)
  is a wall: the river.
- **Decor:** a banner `PUDDLEWICK DUCK REGATTA` with `MILITARY PARADE` pasted over `DUCK`;
  posters `SALUTE HIS LOUDNESS`; lamp posts; flower boxes; rubber ducks in buckets.
- **Checkpoints:** 1400.

| Trigger | Events |
|---|---|
| start | Players parachute in at x 48. Card `MISSION 1` / `START!`. Music `m1`. |
| @0 | 2 `rifleman` @300, @324, gag: `cards` (`prop/card-table` @312). 1 `rifleman` @520, gag: `kazoo`. `crate` @470 (M). |
| @160 | 3 `rifleman`, entry: walk from R+16, 40 ticks apart. |
| @380 | `triangle` on the balcony @790, gag: `counting` (alarm: 3 `rifleman` from R+16). 2 `rifleman` @700, @730, gag: `rehearse`. |
| @560 | hostage `critic`/chair @900 (A). `crate` @980 (bombs). |
| @720 | **PARADE COLUMN:** from R+16, marching left at 0.6 px/tick in step with the music, 28 px apart: `drummer`, 3 `rifleman`, `cymbalist`, `[N]` +1 `rifleman`. They notice players only within 160 px (they are performing). Kill the drummer first and the column stumbles for 60 ticks. |
| @1000 | **ANTHEM BREAK (tutorial):** `anthem-speaker` @1260 on a lamp post. 4 `rifleman` @1300 (gag `shine`), @1330 (gag `nap`), @1380 and @1420 (pair, gag `cards`). When a player reaches x 1180, the speaker plays at once: all four salute for 180 ticks; hint text (small font, top centre, 150 ticks): `LEGION SOLDIERS MUST SALUTE THE ANTHEM!` Then it plays every 900 ticks while it stands. |
| @1400 | Checkpoint. `oompah-trooper` on the bandstand roof @1700. 2 `rifleman`, entry: `window` @1620 and @1660 (from y 100). `crate` @1560 (S). |
| @1560 | hostage `tourist`/sack @1780 (D). `prop/helium-tank` @1830. **Secret:** from the roof awning (y 120) a Helium Head jump reaches the secret roof ledge (y 64): hostage `maestro`/chair @1940 (1up) and `pickup-gem` `golden-record` @1960. |
| @1700 | `piccolo` prone on the chimney ledge @2040 (y 92). |
| @1900 | `band-truck` from R+48 to stopX 2250; cargo: 3 `rifleman`, 1 `cymbalist`, `[H]` +1 `baton-major`. |
| @2000 | hostage `roadie`/cage @2140 hanging from a crane (rope at y 60) (drop R). |
| @2176 | `LOCK 2176–2560`. **Quay Gate:** `baton-major` @2460; 2 `rifleman` walk from R+16; 2 `rifleman` entry `parachute` @2300, @2400; `[N]` `cymbalist` from R+16. `WAIT dead`. Then the drain lid clanks open; a Legion head pops out of the drain: bubble `DON'T COME DOWN HERE!` and ducks back. Signs `ROOFTOPS ↑` (over the quay steps) and `DRAIN ↓` (over the drain) appear. `UNLOCK`. |
| exits | `b1`: rect (2520–2560, 40–100), top of the quay steps (transition: fade). `b2`: rect (2364–2396, 176–216), the open drain: the player drops into it (transition: fall). |

#### m1 `b1` — Chimney Chase (2400×216, scroll right, timer 60)
- **Background:** as `a`, but `town-rooftops` at factor 0.3 and lower (we are above it).
- **Terrain style:** ground `concrete` (roof slabs), edge `tiles` (roof tiles), platform `wood`
  (laundry lines, sagging), solid `brick` (chimneys).
- **Terrain:** rooftops with gaps. Roof (0–380, y 140) · gap 380–420 · roof (420–760, y 128) with a
  pitched peak (up to y 104 at 590 and back down) · gap 760–800 · roof (800–1240, y 136) with
  chimneys (solids 16×28 at 900, 1040, 1180) · gap 1240–1288 · roof (1288–1700, y 120) with
  laundry lines (platforms 1340–1460 at y 84 and 1500–1620 at y 80) · gap 1700–1744 · roof
  (1744–2400, y 144) sloping down to y 176 at 2250. **Every gap has a `prop/spring-awning` at
  y 196** across its full width (a fall bounces the player back up to roof height); gaps are
  ≤ 48 px. A weather-vane ledge (platform 1000–1060, y 60).
- **Checkpoints:** 1240.

| Trigger | Events |
|---|---|
| start | Players enter from the left at (40, 140). |
| @0 | 2 `rifleman`, entry: `chimney` @300, @350 (chimney decor). |
| @180 | `crate` @450 (M) on the pitched roof. `piccolo` prone @590 (roof peak). 2 `rifleman` walk from R+16. |
| @420 | hostage `critic`/chair @700 (A). `triangle` @740, gag `counting` (alarm: 3 `rifleman`, entry `chimney` @820, @860, @900). |
| @640 | `drummer` walks in from R+16 along the roof 800–1240, `cymbalist` behind him. |
| @860 | `prop/helium-tank` @960. **Secret:** from a chimney top (y 108), a Helium Head jump reaches the weather-vane ledge (y 60): 5 `golden-note` + 1 `gem`. |
| @1000 | 3 `rifleman`, entry `chimney` @1040, @1180, @1180 (30 ticks apart). `[N]` `piccolo` on the chimney top @1180. |
| @1240 | Checkpoint. 2 `rifleman` on the laundry lines, gag `shine`. `oompah-trooper` @1560. `crate` @1460 (bombs). |
| @1500 | hostage `tea-lady`/chair @1640 (C). |
| @1700 | 4 `rifleman`, entry `parachute` @1820, @1880, @1940, `[N]` @2000. |
| @1900 | hostage `tourist`/sack @2100 (D). |
| @2016 | `LOCK 2016–2400`: `baton-major` @2300, 3 `rifleman` from R+16, `[N]` `drummer` from R+16. `WAIT dead`. `UNLOCK`. |
| exit | rect (2380–2400, 100–176) → `c` (transition: the players slide down a drainpipe, 40 ticks). |

#### m1 `b2` — Storm Drain (2400×216, scroll right, timer 60)
- **Background:** `sewer-brick` (custom: dark teal brick arches, dripping pipes, 0.4) over a far
  layer of darker arches (0.2); sky colour near-black teal.
- **Terrain style:** ground `concrete`, edge `moss`, platform `metal` (grates), solid `brick`.
- **Terrain:** ceiling solids along y 0–40; walkway at y 168; water channels (hazard `water`,
  y 180–216) at 420–520, 900–1040 and 1500–1620, each crossed by `prop/duck-float` platforms
  (giant regatta rubber ducks drifting left and right at 0.5 px/tick, bobbing ±3 px) and with
  metal grates above (platforms at y 120). An overflow chamber at 2016–2400 with pipes in the
  ceiling.
- **Checkpoints:** 1100.

| Trigger | Events |
|---|---|
| start | Players land in a puddle at (40, 168) (splash). |
| @0 | 4 `windup-bot` in a line from R+16, 20 px apart. |
| @200 | 2 `bullfrog` @380, @540 on the walkway edges. `prop/duck-float` over channel 420–520. |
| @400 | `metronome-turret` on the ceiling @700 (y 40). `crate` @640 (F). |
| @560 | hostage `critic`/chair @780 (A). 2 `rifleman` walk from R+16. |
| @760 | 2 `prop/duck-float` over channel 900–1040. `bullfrog` on the grate @980. 5 `windup-bot` from R+16 on the far walkway. |
| @1100 | Checkpoint. **Rubber Duck Stampede:** a sluice gate opens (decor) and 8 small rubber ducks race down the channels with a rush of water (cosmetic, `env/water-rush`). 2 `metronome-turret` on the ceiling @1240, @1400. `crate` @1300 (bombs). |
| @1300 | hostage `roadie`/cage @1450, hanging from a pipe (drop L). |
| @1460 | `prop/duck-float` over channel 1500–1620. 2 `bullfrog` beyond it @1660, @1700. |
| @1700 | 6 `windup-bot` from R+16. `[N]` 2 `rifleman` from R+16. |
| @1900 | hostage `tea-lady`/chair @2080 (C). |
| @2016 | `LOCK 2016–2400` (overflow chamber): 3 `bullfrog`, entry: drop from pipes at TOP @2150, @2250, @2330. `[N]` `metronome-turret` on the ceiling @2200. `WAIT dead` (frogs). `UNLOCK`. |
| exit | grate steps up to a manhole, rect (2360–2400, 60–120) → `c` (transition: the players pop out of a manhole on the riverbank). |

#### m1 `c` — River Run (3000×216, scroll right, timer 60; boss arena 99; vehicles: `swan`)
- **Background:** `sky-gradient` (morning) · `clouds` (0.1) · `hills` (0.2) · `treeline` (willows,
  0.35) · `far-bank` (custom: the far river bank with Puddlewick's church spire and a cheering
  crowd strip, 0.5) · front layer `reeds` (custom, front: true, factor 1.2, along the bottom edge).
- **Terrain style:** ground `mud`, edge `grass`, platform `wood` (jetties), solid `crate`.
- **Terrain:** riverbank y 176 from 0 to 860, sloping into the water at 860–900. River (hazard
  `water`, surface y 180) from 900 to 3000. On-foot path through the river, with no gap wider than
  48 px: jetties (platforms 1000–1120, 1400–1500, 1800–1960 at y 168), islands (ground 1160–1300
  and 2100–2300 at y 172), lily pads (24 px platforms at y 178: 960, 1040, 1340, 1560, 1600,
  1650, 1700, 1990, 2040), and `prop/duck-float` platforms filling the rest. The boss pontoon
  (platform 2616–2840, y 176). Swan Mk1's head with a sailor hat sticks out of the water at 1400
  (decor, see below).
- **Checkpoints:** 900, 1900.

| Trigger | Events |
|---|---|
| start | The `swan` sits parked at x 160, head tucked, with a note decor `SWAN-3. PLEASE RETURN BY 6 PM. -G.` When a player comes within 64 px: bubble `"BE GENTLE WITH HER!"` (from Gramps on the radio; if Gramps is a player, from Gramps himself: `"THERE SHE IS!"`). |
| @0 | 3 `rifleman` walk from R+16 (a first target for the Swan). |
| @200 | `oompah-tank` from R+48 to x 600. `[N]` 2 `rifleman` behind it. |
| @420 | hostage `critic`/chair @640 (A). 2 `bullfrog` hop out of the reeds @760, @820. |
| @700 | `rowboat` with 2 `rifleman` rows in from R+48 to x 1000. 2 `bullfrog` on lily pads @960, @1040. |
| @900 | Checkpoint. `piano-bomber` crosses right to left at y 32, dropping 3 pianos near the nearest player; **on water the pianos float** as platforms for 600 ticks. |
| @1100 | 2 `rowboat` (4 `rifleman`). `crate` on the island @1250 (H). hostage `tourist`/sack on the island @1280 (D). |
| @1300 | **Mk1 gag:** if Swan Mk1's head (@1400) is shot 3 times, it surfaces, honks sadly, and a `pickup-bombs` floats up. Once. |
| @1500 | **Tank barge:** an `oompah-tank` on a raft (moving platform 96×12) floats left at 0.3 px/tick from R+48. |
| @1900 | Checkpoint. `oompah-trooper` on the jetty @1900. 3 `bullfrog`. 1 `rowboat`. |
| @2100 | hostage `roadie`/cage @2200 on a fishing post (drop **T**: the tuba arrives just before a boss full of projectiles). |
| @2300 | `[N]` `piano-bomber` crosses left to right. `crate` on the island @2280 (bombs). |
| @2616 | `LOCK 2616–3000`. Boss `encore` (10.1) steams in from the right (300-tick entrance: horn toots, the far-bank crowd cheers). Music `boss`. Timer 99. |
| boss dead | `MISSION COMPLETE!` → tally. |

### 11.2 m2 — DUNE BUGLE

- **Biome and mood:** the Rattlebone Flats at noon: orange dunes, red mesas, a dry riverbed, a
  canyon, and a quarry shaped like a drum. Palette: ochre, burnt orange, rust, pale white-hot sky,
  with Mrs. Dollop's pastel pink van as the bright contrast.
- **Music:** `m2`; boss `boss`. **Announcer at start:** "MISSION TWO. STAY HYDRATED, CYGNETS!"
- **Hostages on any route:** 8 (including `dollop` and the hidden `maestro` in `d`).

#### m2 `a` — Rattlebone Flats (2400×216, scroll right, timer 60)
- **Background:** `sky-gradient` (white-hot horizon → pale cyan) · `clouds` (sparse, 0.05) ·
  `mountains` (mesa shapes, rust-orange, 0.15) · `dunes` (ochre, 0.3) · `dunes` (light sand, 0.5).
- **Terrain style:** ground `sand`, edge `sand`, platform `rock`, solid `rock`.
- **Terrain:** rolling dunes around y 176 (±16 px over 200 px); rock outcrops (solids 40×24) at 700
  and 1300; a dry riverbed dip to y 196 at 1000–1150; sandbags (solid 24×12) at 1940; **Dollop's
  Oasis** at 2200–2380: an ice-cream stand with a shed (solid 64×48 at 2290–2354) and palm trees.
- **Checkpoints:** 1200.

| Trigger | Events |
|---|---|
| start | Players parachute in. |
| @0 | 3 `rifleman` (`outfit: desert`): one gag `nap` under a `prop/parasol` @320, a pair gag `cards` @420. |
| @200 | 2 `rattler` hidden @520, @620. |
| @400 | `anthem-speaker` @760. 3 `rifleman` @800–900. `triangle` @820, gag `counting`. |
| @600 | `crate` on the outcrop @700 (S). hostage `critic`/chair @880 (A). |
| @800 | 2 `cymbalist` walk from R+16. `[N]` `oompah-trooper` from R+16. |
| @1000 | Riverbed: 3 `rattler` @1040, @1090, @1130. `crate` @1150 (bombs). |
| @1200 | Checkpoint. `band-truck` to stopX 1500 (cargo: 3 `rifleman`, 1 `drummer`). hostage `tourist`/sack @1600 (D). |
| @1500 | **PARADE COLUMN (desert):** `drummer`, 4 `rifleman`, `baton-major` at the back. |
| @1800 | `gramophone-mortar` on a dune crest @2000. 2 `rifleman` crouching behind the sandbags @1960. |
| @2016 | `LOCK 2016–2400`. **Dollop's Oasis:** hostage `dollop`/chair @2300 in front of the shed. 5 `rifleman` around her, gag `ice-cream` (all five licking her stolen cones; they drop them on alert), `baton-major` @2340. `WAIT dead`. When freed, Mrs. Dollop: `THEY ATE ALL MY SPRINKLES!` then `TAKE MY VAN. NOT A SCRATCH, MIND!` The shed doors open and the `sundae-driver` rolls out to x 2260. `UNLOCK`. |
| exit | right edge, rect (2380–2400, 0–216) → `b` (a rider keeps the van). |

#### m2 `b` — Sundae Drive (3600×216, scroll right, timer 90; vehicles: `sundae-driver`)
- **Background:** as `a`, plus a `cacti` midground layer (custom: saguaro silhouettes, 0.8).
- **Terrain style:** ground `sand`, edge `sand`, solid `rock`.
- **Terrain:** long dunes with ramps (slopes up to 1:2) for van jumps; rocks (solids 24×16) to hop
  at 900, 1700, 2500; **no pits**. The fork at 3400–3600: the main road dips down to the right
  (to y 196 at the right edge) and a rock ramp climbs to y 104 at 3560.
- **Checkpoints:** 1200, 2400.

| Trigger | Events |
|---|---|
| start | If nobody is in the van, it waits at x 120 with its engine running. |
| @0 | 2 `rattler`. 3 `rifleman` running after the van. |
| @300 | `oompah-tank` from R+48. 2 `bassoonist` on a dune crest @700, @760. |
| @700 | **Overtake:** a `band-truck` drives past from L−48 at 3 px/tick, stops ahead at 1200 and unloads 3 `rifleman` + 1 `cymbalist`. |
| @1000 | 2 `gramophone-mortar` @1300, @1420. 2 `rattler`. |
| @1200 | Checkpoint. |
| @1300 | 6 `windup-bot` marching in a line toward the van (crush all six in one run: **STRIKE!** +1,000). |
| @1600 | `oompah-tank` from R+48; `[N]` a second `oompah-tank` from L−48 after 120 ticks. |
| @2000 | `anthem-speaker` @2200. 4 `rifleman`, 1 `oompah-trooper`. (If the van's JINGLE plays during the anthem, the soldiers salute with one hand and hold out a coin with the other.) |
| @2400 | Checkpoint. 3 `bassoonist` in a line on rocks @2650–2750. `crate` @2600 (bombs → shells). |
| @2800 | hostage `roadie`/cage @2900, hanging from a Legion oil derrick (drop R). |
| @3216 | `LOCK 3216–3600`. Mini-boss `golden-goose` (9.4) walks in from the right and honks. `WAIT` boss dead. Signs `CANYON ↘` and `MESA ↗` appear. `UNLOCK`. |
| exits | `c1`: rect (3560–3600, 150–216) at the bottom of the dip. `c2`: rect (3560–3600, 40–110) at the top of the ramp. The van may take either. |

#### m2 `c1` — Canyon Floor (2200×216, scroll right, timer 60; vehicles: `sundae-driver`)
- **Background:** `sky-gradient` (a narrow strip of sky) · `canyon-walls` (custom: striped
  red-orange rock, 0.3 and 0.6) · front layer `rock-pillars` (custom, front: true, factor 1.3,
  sparse).
- **Terrain style:** ground `rock`, edge `sand`, platform `rock`, solid `rock`.
- **Terrain:** canyon floor y 176; overhang solids (ceiling y 0–60) at 300–500; rock ledges
  (platforms at y 120) at 850–950, 1650–1760; a cave 900–1300 with a ceiling at y 100 (the van
  fits); a slope from the right at 400–600 for rolling drums.
- **Checkpoints:** 900.

| Trigger | Events |
|---|---|
| @0 | 2 `rattler`. `crate` @300 (L). |
| @250 | 2 `cymbalist` + 2 `rifleman` walk from R+16. |
| @450 | 3 `prop/rolling-drum` roll down the slope from R+16, 60 ticks apart. |
| @650 | hostage `critic`/chair @820 (A). `bassoonist` on the ledge @900. |
| @900 | Checkpoint. Cave: 5 `windup-bot` from R+16. `oompah-tank` at the cave exit @1250. |
| @1300 | hostage `tea-lady`/chair @1450 (C). 3 `rattler` @1500–1600. |
| @1500 | `gramophone-mortar` on the ledge @1700. 3 `rifleman`, entry `parachute`. |
| @1816 | `LOCK 1816–2200`: 4 `rifleman` + 2 `drummer` from R+16, `[N]` +1 `oompah-trooper`. `WAIT dead`. `UNLOCK`. |
| exit | right edge → `d`. |

#### m2 `c2` — Mesa Top (2200×216, scroll right, timer 60; vehicles: `sundae-driver`)
- **Background:** `sky-gradient` (wide sky) · `clouds` (high, 0.05) · `mountains` (far mesas,
  0.1) · `dunes` (far below, 0.25); wind-streak particles.
- **Terrain style:** ground `rock`, edge `sand`, platform `wood` (rope bridges), solid `rock`.
- **Terrain:** mesa tops at y 150 joined by rope bridges (platforms at y 150: 420–560,
  1100–1260, 1500–1640); under every bridge a Legion training net (`prop/spring-awning` variant
  `net`, y 206) bounces a falling player back up. Vehicles can't fall (bridges carry them).
- **Checkpoints:** 1000.

| Trigger | Events |
|---|---|
| @0 | `baton-copter` from R+32. |
| @200 | 3 `rifleman`. `triangle` @520, gag `counting`. |
| @400 | `piano-bomber` crosses right to left (3 pianos). `crate` @640 (H). |
| @650 | hostage `tourist`/sack @800 (D). 2 `bassoonist` @900, @960. |
| @1000 | Checkpoint. `baton-copter`, `[N]` a second `baton-copter`. |
| @1300 | hostage `critic`/cage @1450, hanging under a signpost (drop M). |
| @1500 | `piano-bomber` crosses left to right. 4 `rifleman`, entry `parachute`. |
| @1816 | `LOCK 1816–2200`: 2 `baton-copter` + 2 `cymbalist` + 2 `rifleman`. `WAIT dead`. `UNLOCK`. |
| exit | right edge → `d` (a ramp down into the quarry). |

#### m2 `d` — The Drum Quarry (2000×216, scroll right, timer 60; arena 99; vehicles: `sundae-driver`)
- **Background:** `sky-gradient` · `quarry-terraces` (custom: stepped orange rock, cranes, a giant
  crimson drum banner, 0.3) · `dunes` (0.15).
- **Terrain style:** ground `rock`, edge `sand`, platform `metal` (scaffolds), solid `metal`.
- **Terrain:** quarry floor y 176; scaffolds (platforms at y 120) at 760–880 and 1240–1340; a
  `prop/breakable-wall` at 640 hiding an alcove (600–700); the arena 1600–1984 as in 10.2 (ledges
  and walls).
- **Checkpoints:** 1000.

| Trigger | Events |
|---|---|
| @0 | 4 `rifleman`: a pair gag `cards`, one gag `nap`, one gag `kazoo`. |
| @300 | 2 `drummer` + 1 `cymbalist`. `crate` @500 (R). |
| @500 | **Secret:** `prop/breakable-wall` @640 → hostage `maestro`/chair @680 (1up) and a `golden-record`. |
| @800 | `oompah-tank`. 2 `bassoonist` on the scaffold @800, @860. |
| @1000 | Checkpoint. hostage `critic`/chair @1200 (A). 3 `rifleman` walk from R+16. |
| @1300 | `band-truck` (cargo: 2 `rifleman`, 1 `oompah-trooper`, 1 `cymbalist`). |
| @1600 | `LOCK 1600–1984`. Boss `ba-dum-behemoth` (10.2) rolls in from the right to a drum fill. Music `boss`. Timer 99. |
| boss dead | `MISSION COMPLETE!` → tally. Mrs. Dollop's voice on the radio if the van survived: `NOT A SCRATCH! YOU'RE ALL GETTING FREE CONES.` (+10,000 NO SCRATCHES applies once per mission.) |

### 11.3 m3 — THE HIGH NOTE

- **Biome and mood:** Mount Murmur, an alpine ski resort taken over by the Woodwinds: snow, pines,
  chalets with crimson banners, a frozen pond, a cliff face, ice caves and a cable-car summit at
  sunset. Palette: white and ice blue, deep pine green, warm chalet wood, crimson; a peach-pink
  sky at the summit.
- **Music:** `m3`; boss `boss`. **Announcer at start:** "MISSION THREE. WRAP UP WARM, CYGNETS!"
- **Hostages on any route:** 8 (including the hidden `maestro` in `a`).
- **Engine request:** an `ice` physics flag on ground ranges (`iceRanges: [x0, x1][]`) for the
  frozen pond (low friction, deceleration 0.05 px/tick² for players and the Swan), drawn with
  `decor/ice-sheet` over the snow.

#### m3 `a` — Yodel Valley (3000×216, scroll right, timer 60; vehicles: `swan`)
- **Background:** `sky-gradient` (cold blue → pale peach horizon) · `ice-peaks` (white and blue,
  0.1) · `clouds` (0.15) · `treeline` (snowy pines, 0.35) · `chalets` (custom: wooden chalets
  with crimson banners, 0.55).
- **Terrain style:** ground `snow`, edge `snow`, platform `wood`, solid `rock`.
- **Terrain:** rolling snow slopes around y 176; chalets (solids 64×40 at 880 and 1030 with roof
  platforms at y 120 and y 110); a `prop/breakable-wall` (chalet back door) at 1180; frozen pond
  (ice range 1400–1900, flat y 176); a long downhill 1900–2200; a **ski-jump ramp** rising to
  y 120 at 2400, then a drop and landing slope to y 176 at 2520; base camp flat 2616–3000; the
  cliff at 3000 (right wall).
- **Checkpoints:** 1300, 2100.

| Trigger | Events |
|---|---|
| start | The `swan` arrives by cargo parachute at x 200, wearing Mittens' knitted socks. Bubble: `MITTENS KNITTED HER SOCKS.` |
| @0 | 3 `rifleman` (`outfit: snow`), entry `ski` from R+16 (each crashes into a snowbank first). |
| @250 | 4 `windup-bot` (`ski` variant) downhill from R+16. |
| @450 | 2 `cymbalist`. `triangle` @700, gag `counting`. `crate` @620 (M). |
| @700 | 2 `ram-goat` on the chalet roofs @900, @1050. |
| @900 | hostage `critic`/chair @1100 (A). 2 `bassoonist` @1200, @1260 (they target the Swan). **Secret:** `prop/breakable-wall` @1180 → hostage `maestro`/chair @1220 (1up) inside the chalet. |
| @1300 | Checkpoint. **Skating parade:** on the frozen pond a `baton-major` leads 4 `rifleman` skating in a line, gag `skate` (wobbling, one falls flat every 90 ticks); on alert they shoot while sliding. |
| @1700 | hostage `tourist`/sack @1850 on the ice (D). |
| @1900 | 3 `ram-goat` charge down the slope one by one, 90 ticks apart (leap-down shadows first). |
| @2100 | Checkpoint. **SKI JUMP:** the ramp at 2400. A Swan (or a player on foot) that lands without being hit gets `STYLE POINTS 9.5!` +2,000. 2 `bassoonist` wait under the landing zone @2560, @2600. `crate` @2560 (bombs). |
| @2600 | hostage `roadie`/cage @2700, hanging from a ski-lift pylon (drop F). |
| @2616 | `LOCK 2616–3000`. **Base camp:** 5 `rifleman`, 2 `cymbalist`, 1 `baton-major` (from R+16 and out of two tents). `WAIT dead`. Signs `NORTH FACE ↑` and `CAVES →` appear. `UNLOCK`. **The Swan can't climb:** a player riding the Swan who reaches x 2900 is auto-ejected; radio bubble `GRAMPS: "SHE DOESN'T DO CLIFFS. PARK HER."` The Swan sits down and waves its head goodbye. |
| exits | `b1`: rect (2940–3000, 60–120), the top of a rope ladder (platform steps at y 140 and y 104 on the cliff). `b2`: rect (2900–2940, 136–176), the cave mouth at ground level. |

#### m3 `b1` — North Face (384×1800, scroll up, timer 90)
- **Background:** `sky-gradient` (deep blue at the top → peach at the bottom, factorY 0.2) ·
  `clouds` (factorX 0.1, factorY 0.3, drifting) · `ice-peaks` (factorY 0.1).
- **Terrain style:** ground `rock`, edge `snow`, platform `ice`, solid `rock`.
- **Terrain:** rock walls on both sides (solids x 0–24 and 360–384, with outcrops); ice ledges
  (platforms) zig-zag upward with vertical gaps ≤ 36 px; a **cable car** (moving platform 64×8)
  rising from y 1400 to y 900 at 0.5 px/tick when a player stands on it; **wind gusts** every
  480 ticks (snow streaks for 60 ticks, then a push left at 0.4 px/tick for 120 ticks).
- **Player start:** (192, 1776). `@Y` = camera top edge reaches y.
- **Checkpoints:** y 900, y 400.

| Trigger | Events |
|---|---|
| start | 2 `rifleman` on ledges above at y 1640. |
| @1560 | `ram-goat` on the ledge (288, 1500), charging left. `crate` (96, 1520) (bombs). |
| @1400 | `piccolo` prone at (320, 1330). `prop/helium-tank` at (60, 1450). **Secret:** ledge (40, 1300) with a `golden-record` (reachable only with Helium Head). |
| @1250 | **Cable-car ride:** the car at (150, 1400) rises to y 900. During the ride: 2 `baton-copter` attack from the sides; `[N]` 2 `rifleman` parachute past it. |
| @900 | Checkpoint. hostage `critic`/chair at (300, 820) (A). 2 `ram-goat` at (100, 760) and (280, 700). |
| @700 | Gusts are now every 360 ticks. 2 `piccolo` at (60, 600) and (330, 560). `crate` at (200, 640) (L). hostage `tea-lady`/chair at (120, 520) on a ledge, with a thermos instead of a teapot (C). |
| @400 | Checkpoint. hostage `roadie`/cage at (250, 380), hanging from a pine branch (drop H). |
| @300 | `baton-major` + 3 `rifleman` on the top ledges. `bassoonist` at (330, 160). `WAIT dead`. |
| exit | top, rect (140–244, 0–24) → `c`. |

#### m3 `b2` — Echo Caves (384×1800, scroll up, timer 90)
- **Background:** `ice-cave` (custom: blue-violet crystal walls with softly glowing crystals,
  factorY 0.3, and a darker far layer, 0.15); sky colour near-black violet.
- **Terrain style:** ground `ice`, edge `snow`, platform `rock`, solid `rock`.
- **Terrain:** an inner shaft with crystal ledges (vertical gaps ≤ 36 px), an underground waterfall
  (decor), overhangs with ceilings for turrets, and the **Icicle Organ** row at y 820.
- **Player start:** (192, 1776). **Checkpoints:** y 950, y 420.

| Trigger | Events |
|---|---|
| start | 3 `echo-bat` hanging at y 1600. |
| @1560 | 4 `windup-bot` marching along a ledge. `crate` (300, 1500) (T). |
| @1400 | `metronome-turret` under the overhang at (192, 1330). 4 `echo-bat`. |
| @1250 | `prop/helium-tank` at (80, 1280). **Secret:** crystal alcove (330, 1150) with a `golden-record`. |
| @1100 | hostage `critic`/chair at (64, 1050) (A). `bassoonist` at (300, 980). |
| @950 | Checkpoint. **The Icicle Organ:** 8 icicles hang from the ceiling at y 820, x 60–330. Each shot icicle (1 hp) plays one note. Shooting all 8 from left to right in order (a rising scale) opens a crystal door: 10 `golden-note` and a `gem`. Any order still breaks them (no reward). |
| @760 | 6 `echo-bat` (sine swarm). hostage `tea-lady`/chair at (300, 700) (C). |
| @600 | 3 `rifleman` + 1 `cymbalist` on the ledges. `metronome-turret` at (100, 520). |
| @420 | Checkpoint. hostage `roadie`/cage at (192, 400) (drop S). |
| @250 | `baton-major` + 2 `bassoonist`. 4 `echo-bat`. `WAIT dead`. |
| exit | top, rect (140–244, 0–24) → `c`. |

#### m3 `c` — Summit Station (1280×216, scroll right, timer 60; arena 99)
- **Background:** `sky-gradient` (sunset: orange horizon → pink → violet top) · `clouds` (pink,
  0.1) · `ice-peaks` (0.2) · `cable-cars` (custom: cables with cars crossing, 0.5).
- **Terrain style:** ground `snow`, edge `snow`, platform `metal`, solid `concrete`.
- **Terrain:** snowy path y 176; the station roof (platform 780–880, y 120); the summit deck
  (arena 896–1280) as in 10.3.
- **Checkpoints:** 880.

| Trigger | Events |
|---|---|
| start | Players climb out at (48, 176). 3 `rifleman`, one with gag `snowman` (building a snowman of Fortissimo; it loses its head when he is hit). |
| @200 | 2 `ram-goat`. `crate` @400 (bombs). |
| @400 | hostage `critic`/chair @560 (A). `triangle` @640. 2 `rifleman`. |
| @600 | 5 `windup-bot` (`ski`). `bassoonist` on the station roof @820. |
| @880 | Checkpoint. |
| @896 | `LOCK 896–1280`. Boss `windbag` (10.3) rises from below the summit edge. Music `boss`. Timer 99. |
| boss dead | `MISSION COMPLETE!` → tally. |

### 11.4 m4 — OPENING NIGHT

- **Biome and mood:** Fortissimo City (formerly Little Hushing) at night. Every neon sign says
  FORTISSIMO; statues of the Marshal line the avenue; a parade on the boulevard; a subway; rooftop
  billboards; the Opera House. Palette: deep navy and violet night, neon pink, cyan and gold,
  crimson banners, warm window light.
- **Music:** `m4`; boss `boss`. **Announcer at start:** "MISSION FOUR. BREAK A LEG, CYGNETS!"
- **Hostages on any route:** 10 (including the hidden `maestro` in `d`).

#### m4 `a` — Avenue of Statues (2800×216, scroll right, timer 60)
- **Background:** `sky-gradient` (navy → violet) · `clouds` (night colours, thin, 0.05) · `city`
  (far skyline with lit windows, 0.25) · `city` (nearer, 0.5) · `neon-signs` (custom: signs
  `FORTISSIMO LAUNDRY`, `FORTISSIMO BAKERY`, `FORTISSIMO AVENUE`, and one crossed-out
  `LITTLE HUSHING`, 0.7).
- **Terrain style:** ground `concrete`, edge `tiles`, platform `metal`, solid `brick`.
- **Terrain:** avenue y 176; statue plinths (solids 32×40) at 500, 1200 and 1900, each with a
  `prop/statue-head`; balconies (platforms at y 120) at 980–1040, 1130–1190, 1680–1740; a high
  balcony ledge (platform 700–760, y 72); the arena 2416–2800 is a wide plaza.
- **Checkpoints:** 1200, 2100.

| Trigger | Events |
|---|---|
| @0 | 3 `rifleman` (`outfit: night`), gag `rehearse`. `anthem-speaker` @300. |
| @200 | `prop/statue-head` @500. `drummer` + 2 `rifleman`. |
| @400 | `prop/helium-tank` @640. **Secret:** the high balcony (700–760, y 72) with a `golden-record`. |
| @560 | hostage `critic`/chair @760 (A). |
| @700 | `band-truck` to stopX 1100 (cargo: 2 `rifleman`, 1 `cymbalist`, 1 `oompah-trooper`). |
| @900 | 2 `piccolo` on balconies @1000, @1150. `crate` @1050 (H). |
| @1200 | Checkpoint. **GRAND PARADE COLUMN:** `drummer`, 4 `rifleman`, `oompah-trooper`, `baton-major`, marching in step (kill the drummer first: the whole column stumbles). |
| @1500 | `gramophone-mortar` on the balcony @1700. hostage `tourist`/sack @1600 (D). |
| @1700 | **Triangle duet:** 2 `triangle` @1850, @1880, gag `counting` (they ding in harmony; the alarm calls 6 riflemen if both finish). 3 `rifleman`. |
| @1900 | `prop/statue-head` @1900. hostage `roadie`/cage @2000, hanging from a lamp post (drop T). |
| @2100 | Checkpoint. |
| @2416 | `LOCK 2416–2800`. Mini-boss `big-head` (9.4) floats in from the right. `WAIT` boss dead. `UNLOCK`. |
| exit | right edge → `b`. |

#### m4 `b` — Bandwagon Boulevard (3600×216, scroll right, timer 90; vehicles: `bandwagon`)
- **Background:** as `a` with more neon; a `crowd-barrier` layer (custom: barriers with cheering
  silhouettes, 0.9); confetti particles.
- **Terrain style:** ground `concrete`, edge `tiles`, solid `metal`.
- **Terrain:** a wide boulevard, flat y 176, small ramps at 1500 and 2600; balconies (platforms,
  y 112) at 1100–1300 for bassoonists; rooftop solids at 1900 and 2000 (tops at y 96) for mortars;
  the drum barricade (solid entity 32×64, 60 hp) at 3500; the subway stairs (ground gap 3460–3520
  after the barricade falls); fire-escape stairs (platform steps 3520–3600 up to y 40).
- **Checkpoints:** 1300, 2400.

| Trigger | Events |
|---|---|
| start | The `bandwagon` is parked at x 120 with its engine running and a sign `NOW UNDER NEW MANAGEMENT`. |
| @0 | 4 `rifleman` from R+16. |
| @300 | `oompah-tank` from R+48. `anthem-speaker` @600 with 3 `rifleman`. |
| @700 | **Parade floats:** 2 `prop/parade-float` (a giant tuba float and a giant drum float) drive left at 0.5 px/tick with 2 `rifleman` riding each (entry `float`). Hostage `critic`/float tied to the mast of the second float (drop M). |
| @1100 | 3 `bassoonist` on the balconies (anti-vehicle). |
| @1300 | Checkpoint. 2 `oompah-tank`. 6 `windup-bot` (crush all six: STRIKE! +1,000). |
| @1700 | 2 `gramophone-mortar` on the rooftops @1900, @2000. |
| @2000 | hostage `tea-lady`/float on a third float (C). |
| @2400 | Checkpoint. **Battle of the Bands:** a `band-truck` drives head-on from R+48, honking its two-tone horn in rhythm with the music; it rams the Bandwagon (12 damage) if it is not stopped in time. |
| @2900 | `oompah-tank`, 2 `bassoonist`, `anthem-speaker` @3100. |
| @3216 | `LOCK 3216–3600`. **Barricade:** 4 `rifleman`, 2 `drummer`, 1 `baton-major` guard a barricade of drums (60 hp). `WAIT dead` and barricade destroyed. The Bandwagon can't go on (the player ejects, or rams it into the barricade for fun). Signs `SUBWAY ↓` and `ROOFTOPS ↑`. `UNLOCK`. |
| exits | `c1`: rect (3460–3520, 176–216), the subway stairs (drop in). `c2`: rect (3560–3600, 20–80), the top of the fire escape. |

#### m4 `c1` — The Underground (2400×216, scroll right, timer 60)
- **Background:** `subway-tiles` (custom: white tiled walls, FORTISSIMO posters, 0.5); dark ceiling.
- **Terrain style:** ground `concrete`, edge `tiles`, platform `metal`, solid `concrete`.
- **Terrain:** station platform at y 160 (ground) along the whole section; the track bed below at
  y 192 (2 px rails, decor) from 0 to 2400; pillars (solids 16×120) every 320 px; ceilings at y 40.
- **Checkpoints:** 1000.

| Trigger | Events |
|---|---|
| @0 | 2 `usher-bot` patrolling (ticket inspectors). 2 `rifleman`, gag `newspaper` (waiting for a train). |
| @300 | 2 `metronome-turret` on the ceiling @450, @600. `crate` @520 (F). |
| @600 | hostage `critic`/chair @760 (A). |
| @800 | **TRAIN:** rails spark, a headlight beam sweeps and a bell rings `DING DING` for 120 ticks → a train (a moving `kill` zone 400×40 on the track bed, 6 px/tick) passes right to left. Players on the platform (y 160) are safe; the track bed is not. 3 `rifleman` are left behind on the platform (one still holding a strap). |
| @1000 | Checkpoint. 3 `usher-bot`. 4 `windup-bot`. |
| @1300 | hostage `tourist`/sack @1450 (D). `metronome-turret` @1500. |
| @1600 | **TRAIN** from the left (same telegraph). `bassoonist` on a bench (platform y 136) @1800. |
| @2016 | `LOCK 2016–2400`: 2 `usher-bot`, 3 `rifleman`, 1 `drummer`. `WAIT dead`. `UNLOCK`. |
| exit | right edge stairs → `d`. |

#### m4 `c2` — Billboard Rooftops (2400×216, scroll right, timer 60)
- **Background:** `sky-gradient` (night) · `city` (0.25) · `neon-signs` (big billboards of
  Fortissimo whose eyes follow the player, 0.6).
- **Terrain style:** ground `metal`, edge `rust`, platform `metal`, solid `brick`.
- **Terrain:** rooftops at y 140–160 with ≤ 48 px gaps (each with a `net` bounce pad); water
  towers (solids 32×48 with platform tops); billboard tops (platforms at y 80); a giant billboard
  top (platform 700–800, y 40).
- **Checkpoints:** 1000.

| Trigger | Events |
|---|---|
| @0 | `kazoo-drone` formation `v`. 2 `rifleman`. |
| @300 | `baton-copter`. `crate` @450 (L) on a water tower. |
| @500 | `prop/helium-tank` @600. **Secret:** the giant billboard top (700–800, y 40): `golden-record` + 5 `golden-note`. |
| @700 | `piano-bomber` crosses. hostage `critic`/chair @900 (A). |
| @1000 | Checkpoint. 2 `piccolo` on billboards. `kazoo-drone` formation `sine` (shooters). |
| @1300 | `gramophone-mortar` on a water tower. hostage `roadie`/cage @1500, hanging from a billboard (drop R). |
| @1600 | `baton-copter`, `[N]` a second one. 3 `rifleman`, entry `parachute`. |
| @2016 | `LOCK 2016–2400`: 2 `kazoo-drone` formations `loop`, 1 `baton-copter`, 2 `rifleman`. `WAIT dead`. `UNLOCK`. |
| exit | right edge → `d` (transition: zip-line down to the Opera House roof). |

#### m4 `d` — The Opera House (1800×216, scroll right, timer 60; arena 99)
- **Background:** `opera-hall` (custom: crimson velvet, gold balconies with audience silhouettes,
  chandeliers, 0.4).
- **Terrain style:** ground `concrete`, edge `tiles` (marble), platform `wood`, solid `brick`.
- **Terrain:** the lobby (0–1100, y 176) with a cloakroom door (`prop/breakable-wall` at 640);
  grand stairs up to the stage (1100–1300, ramp to y 176 again — the stage is the same height for
  simplicity); the stage arena 1400–1784 as in 10.4.
- **Checkpoints:** 1100.

| Trigger | Events |
|---|---|
| @0 | 2 `usher-bot`. 2 `rifleman`, gag `queue` (in line for the cloakroom). `crate` @300 (bombs). |
| @300 | hostage `critic`/chair @500 (A), in the critics' box. **Secret:** cloakroom door @640 → hostage `maestro`/chair @680 (1up). |
| @500 | `pipe-battery` on the wall @800 (the opera's organ pipes). 3 `rifleman`. |
| @800 | 2 `usher-bot` + 1 `drummer`. hostage `tea-lady`/chair @1000 (C). |
| @1100 | Checkpoint. 2 `rifleman` + 1 `cymbalist`. A `triangle` in the orchestra pit, gag `counting`. |
| @1400 | `LOCK 1400–1784`. The curtain rises: boss `grand-grand` (10.4). Music `boss`. Timer 99. |
| boss dead | `MISSION COMPLETE!` → tally. |

### 11.5 m5 — SWAN SONG

- **Biome and mood:** the sky above the clouds from dusk to night, then the inside of the Grand
  Organ (brass pipes, dark walnut, gears, bellows), ending in the console room. Palette: sunset
  orange → magenta → indigo, pink and violet clouds; inside: walnut brown, brass gold, crimson
  velvet, ivory keys, warm gold lights.
- **Music:** `m5-sky` (section `a`), `m5-organ` (section `b`, started by the section script),
  `boss-final` for all three final-boss stages. **Announcer at start:**
  "FINAL MISSION. FLY GRACEFULLY, CYGNETS!"
- **Hostages:** 4 (2 balloon hostages in `a`, 2 in `b`). In the shoot-em-up, weapon drops become
  +10 dive bombs.
- **Engine request:** `autoScroll` (px/tick) on a section, set and cleared by its script; the
  Trumpeter start (players spawn already mounted).

#### m5 `a` — Above the Clouds (4400×216, auto-scroll right 1 px/tick, timer 99; vehicles: `trumpeter`)
- **Background:** `sky-gradient` (orange horizon → magenta → indigo top; it darkens over the
  section) · `sea` (far below, small, 0.05) · `clouds` (far, pink, 0.1) · `clouds` (mid, violet,
  0.3) · `clouds` (near, front: true, factor 1.4, sparse, drawn at 70% alpha so ships stay visible).
- **Terrain:** none. The view edges keep the Trumpeters inside.
- **Hostage variant:** bind `balloon` — a hostage tied to a weather balloon drifting across; shoot
  the rope (1 hp): the hostage parachutes down and throws the gift up to the nearest Trumpeter.
- **Checkpoints:** 1200, 2400, 3600 (respawn in place: the shoot-em-up has no backtracking).

| Trigger | Events |
|---|---|
| start | Players spawn in their Trumpeters. Radio bubble: `GRAMPS: "SHE FLIES! DON'T TELL ACCOUNTING!"` (if Gramps is a player, the bubble comes from Grace or the first other player: `"YOU MADE HER FLY?!"`). |
| @0 | `kazoo-drone` formation `v` from the right at y 60. |
| @240 | 2 `kazoo-drone` formations `sine` at y 40 and y 140. |
| @480 | 2 `baton-copter` (shoot-em-up mode: they fly level and fire their 3-note spread aimed at the player). |
| @720 | `piano-bomber` crosses above; its pianos fall through the screen as hazards, each marked by a `!` at the top edge 40 ticks before it drops. |
| @960 | A supply `crate` on a parachute drifts down (bombs). |
| @1200 | Checkpoint. 2 `kazoo-drone` formations `loop` (shooters). 6 `windup-bot` (`fly` variant) in a line. |
| @1500 | 2 `kazoo-drone` formations `dive`. |
| @1800 | 2 `piano-bomber` (one high at y 24, one low at y 150); the players fly between them. |
| @2100 | hostage `tourist`/balloon (D, plus SAY CHEESE: everything freezes for 45 ticks). |
| @2400 | Checkpoint. 3 `baton-copter` + 1 `kazoo-drone` formation `v`. |
| @2700 | `piano-bomber` + 2 `kazoo-drone` formations `sine`. |
| @3000 | The Grand Organ appears far away (decor growing over 600 ticks). |
| @3300 | `[N]` 3 `kazoo-drone` formations `dive`. |
| @3600 | Checkpoint. hostage `critic`/balloon (A; a weapon result becomes +10 dive bombs). |
| @4016 | Auto-scroll stops. `LOCK 4016–4400`. Final boss stage 1 `grand-organ` (10.5). Music `boss-final`. |
| boss stage done | The Trumpeters fly into the landing hatch (automatic, 120 ticks) → exit to `b`. |

#### m5 `b` — The Pipe Works (384×1800, scroll down, timer 90)
- **Background:** `organ-pipes` (custom: rows of brass pipes, dark wood, turning gears, factorY
  0.3) · `organ-deep` (custom: dim far pipes, 0.1).
- **Terrain style:** ground `metal`, edge `rust`, platform `metal`, solid `metal`.
- **Terrain:** a descent: ledges (platforms) zig-zag downward (drop-through is the main move);
  **bellows platforms** (moving platforms 64×12 that rise and fall 24 px every 120 ticks, in time
  with the music); `prop/air-jet` columns (warm air from pipes; they slow falls); walls of pipes
  on both sides; the exit door at the bottom.
- **Player start:** (192, 40). `@Y` = camera top edge reaches y (moving down).
- **Checkpoints:** y 700, y 1400.

| Trigger | Events |
|---|---|
| start | The Trumpeters park in the hatch (they stay behind). Music switches to `m5-organ`. 2 `usher-bot` on the first ledges (y 120). |
| @150 | 4 `windup-bot` march off the ledges and drop to lower ones (they keep marching, unharmed). |
| @300 | `metronome-turret` under a ledge at (192, 330). `crate` at (60, 380) (M). |
| @450 | `anthem-speaker` at (320, 520) (the organ broadcasts: it plays every 600 ticks here). 4 `rifleman` (`outfit: night`) on the ledges. |
| @600 | hostage `critic`/chair at (80, 640) (A). 4 `echo-bat` (they live in the pipes). |
| @700 | Checkpoint. `prop/helium-tank` at (300, 760). **Secret:** an alcove at (20, 820) with a `golden-record`, reachable by a slow Helium Head glide. |
| @850 | `pipe-battery` on the wall at (330, 900). `drummer` + 2 `rifleman` on a bellows platform. |
| @1000 | hostage `roadie`/cage at (192, 1060), hanging under a ledge (drop **T**: the tuba is perfect for the console fight). |
| @1150 | 2 `usher-bot` + 1 `bassoonist`. 1 `kazoo-drone` formation `sine`. |
| @1300 | hostage `tea-lady`/chair at (300, 1340) (C). `baton-major` + 3 `rifleman`. |
| @1400 | Checkpoint. |
| @1450 | Last group at the bottom (y 1760): 2 `oompah-trooper` + 2 `cymbalist`. `WAIT dead`. |
| exit | bottom door, rect (150–234, 1776–1800) → `c`. |

#### m5 `c` — The Console (384×216, single screen, timer 99)
- **Background:** `console-room` (custom: a cathedral-like hall of giant pipes, a stained-glass
  window of Fortissimo, gold trim, 0.2).
- **Terrain style:** ground `metal`, edge `tiles`, platform `wood` (the keyboards are drawn by the
  boss sprite over the tier platforms), solid `metal`.
- **Terrain:** floor y 176; the three console tiers and the pipe banks as in 10.5; the three wreck
  blocks drop in after stage 2.

| Trigger | Events |
|---|---|
| start | `LOCK 0–384`. Fortissimo turns on his bench: `AH. THE AUDIENCE HAS ARRIVED.` Then `PLEASE HOLD YOUR APPLAUSE. FOREVER.` Final boss stage 2 `organ-console` (10.5). |
| stage 2 done | Stage 3 `maestro` starts at once (10.5). |
| stage 3 done | Death sequence (10.5) → ending (2.6), credits, tally, high-score entry. |

---
## 12. Audio

All sounds are synth recipes (`defineSfx`) and all music is original tracker songs
(`defineSong`). Every melody is composed for this project: the hooks below are described in words
on purpose, so the composer writes new notes instead of matching a known tune. No arrangement of
any existing game, film, folk or classical melody (that includes famous wedding marches, national
anthems, ice-cream-van tunes, circus marches and the well-known "sad trombone" phrase).

### 12.1 Sound effects (`id` → description)

**Weapons**

| id | Description |
|---|---|
| `weapon/pistol` | short "pew": pulse 25%, pitch 1200 → 400 Hz in 60 ms, tiny noise click |
| `weapon/machine-gun` | tight noise burst + low pulse thump, 40 ms, random pitch ±5% |
| `weapon/shotgun` | wide noise blast, low-pass sweep 6 kHz → 800 Hz, 180 ms, saw thump 90 Hz; then a two-click pump at 300 ms |
| `weapon/rocket` | launch "fwoosh": band-passed noise rising 400 Hz → 2 kHz, 300 ms |
| `weapon/flame` | noise roar, low-pass 1.2 kHz, slow tremolo, 400 ms (loops while firing) |
| `weapon/laser` | saw 880 Hz with 30 Hz vibrato and light FM, loops while held |
| `weapon/homing` | two quick rising chirps (pulse 12.5%, 600 → 1800 Hz, 80 ms each) |
| `weapon/tuba` | fat "OOM-PAH": saw 70 Hz with a quick blip up a fifth and back, low-pass, 220 ms |
| `weapon/empty` | dry click + a comic deflating squeak (pulse 600 → 200 Hz, 120 ms) |
| `weapon/grenade-throw` / `weapon/grenade-bounce` | short whoosh / a "tonk" (triangle 300 Hz, 40 ms) |
| `weapon/knife` | swish (high-passed noise sweep, 80 ms); character variants: `weapon/knife-umbrella` (soft "fwip"), `weapon/knife-needles` ("tik-tik"), `weapon/knife-pan` ("BONK": triangle 220 Hz + bell partial, 150 ms), `weapon/knife-wrench` ("CLANG": FM bell 400 Hz, 250 ms) |

**Explosions and hits**

| id | Description |
|---|---|
| `explosion/s`, `explosion/m`, `explosion/l` | noise bursts with low-pass sweeps and a saw sub-drop; 200 / 400 / 900 ms (l adds a rumble tail) |
| `explosion/part` | `explosion/m` + metal tinkles (FM bell, random high notes) |
| `hit/enemy` | short noise tick + pulse blip |
| `hit/metal` | FM bell "tink", 1.2 kHz, 60 ms |
| `hit/drum` | dull boom: triangle 90 Hz with a fast pitch drop + noise, 120 ms |
| `hit/boss-part` | metallic thud: noise + FM 300 Hz |

**Player, items, hostages**

| id | Description |
|---|---|
| `player/jump` / `player/land` | soft pulse 300 → 500 Hz, 60 ms / soft noise thump, 40 ms |
| `player/die` | pulse slide down 800 → 100 Hz over 500 ms, ending in a spring "boing" (triangle wobble) |
| `player/spawn` | parachute "fwump" + a small rising 3-note arpeggio |
| `player/helium-on` | rising balloon squeal: pulse 400 → 1600 Hz with vibrato, 300 ms |
| `player/helium-pop` | big noise BANG (150 ms) + confetti sparkle (FM bell, random high notes) |
| `player/helium-deflate` | long "pffft": band-passed noise sweeping down + pulse wobble, 500 ms |
| `pickup/weapon` | quick 3-note arpeggio up (pulse 25%) |
| `pickup/bombs` | two low "thunk" notes |
| `pickup/food` | "nom": triangle blip + noise |
| `pickup/gem` | two high sparkly FM bell notes |
| `pickup/1up` | the Cygnet hook (12.2) played fast on pulse |
| `crate/break` | wood crack: noise + square click |
| `hostage/free` / `hostage/give` | rope snap + two-note chirp / two-note "ta-da" up |
| `hostage/faint` | sad 3-note slide down (triangle) |
| `hostage/maestro` | four FM bell notes (an original falling-then-rising figure) |
| `hostage/camera` | shutter click + a short flash whine |

**Vehicles**

| id | Description |
|---|---|
| `vehicle/enter` / `vehicle/exit` | hatch clunk + rising engine whine / spring "boing" + hatch pop |
| `vehicle/hit` / `vehicle/warning` / `vehicle/explode` | metal clang + crunch / two-tone beep (pulse 880 and 660 Hz) / `explosion/l` + debris |
| `swan/step` | heavy hydraulic stomp: low noise + saw 60 Hz blip |
| `swan/paddle` | fast watery flutter: band-passed noise in 16th-note pulses |
| `swan/fire` | beak gun: like `weapon/machine-gun`, a third higher |
| `swan/honk` | **the signature sound**: saw + pulse at 220 Hz through a nasal band-pass (1.2 kHz) with a pitch scoop up, 400 ms |
| `swan/egg` | cute "plop" + chirp |
| `vehicle/jingle` | the Sundae Driver's jingle: 8 original notes on FM bell + pulse 12.5%, music-box tone, ends on an unresolved note |
| `sundae/mortar` | cartoon "bloop" lob |
| `bandwagon/brass` / `bandwagon/drum` | saw chord stab / bass-drum boom |
| `trumpeter/flap` / `trumpeter/dash` | two wing-beat noise whooshes / jet whoosh + a short honk |

**Enemies**

| id | Description |
|---|---|
| `enemy/alert` | "!" blip: pulse 1500 Hz, 40 ms, twice |
| `enemy/double-take` | comic triangle slide up then down |
| `enemy/aria` | one sung note: pulse 50% with 6 Hz vibrato, 500 ms; pitch steps up the major scale in a knife combo |
| `enemy/scream` / `enemy/panic` | short falling yelp / fast alternating "wa-wa-wa" |
| `enemy/salute` | heel click + tiny two-note fanfare |
| `enemy/rifle` | rounder, lower "pop" than the player's pistol |
| `enemy/grenade` | fuse hiss |
| `enemy/tuba-inhale` / `enemy/tuba-blast` | rising breath noise + low saw swell / deep saw "BWOMP" |
| `enemy/cymbal-raise` / `enemy/cymbal-crash` | shimmering high-passed noise with tremolo / bright noise burst, 600 ms decay |
| `enemy/drum-hit` / `enemy/drumroll` | single low hit / snare hits that speed up |
| `enemy/whistle` | officer's whistle: pulse 2.6 kHz with a fast trill |
| `enemy/piccolo-whistle` / `enemy/piccolo-shot` | pitch rising 1.2 → 3 kHz over 45 ticks / sharp high crack |
| `enemy/triangle` | the "DING": FM bell 2.5 kHz, long decay |
| `enemy/bassoon-aim` | squeaky reed: pulse 12.5% with a rising wobble |
| `enemy/kazoo` | buzzy saw with heavy vibrato |
| `enemy/fumble` | "CLONK": wood-block triangle + noise |

**Machines and creatures**

| id | Description |
|---|---|
| `machine/tank-move` / `machine/tank-charge` | tread rumble loop / rising hum |
| `machine/sad-notes` | three slow descending notes on pulse 50% with a wobble (an original phrase) |
| `machine/truck-horn` | plain two-tone horn |
| `machine/metronome-tick` / `machine/metronome-tock` | wood clicks at two pitches |
| `machine/scratch` | record scratch: noise with a fast pitch sweep up and down |
| `machine/piano-whistle` / `machine/piano-crash` | falling whistle 2 kHz → 600 Hz over 50 ticks / "PLONK": a 5-note cluster on FM bell + noise, 600 ms |
| `machine/copter` | rotor chop: noise gated at 12 Hz (loop) |
| `machine/pipe-charge` | organ-pipe swell: pad with a rising filter |
| `machine/anthem-crackle` | loudspeaker crackle |
| `creature/croak-build` / `creature/croak` | rising throat rumble / "rrribbit": saw 80 Hz with 20 Hz AM |
| `creature/windup` | ratchet clicks speeding up |
| `creature/rattle` | maraca "chk-chk": short noise bursts |
| `creature/bat-screech` | high pulse squeal |
| `creature/goat` | "mehh": pulse 50% with 8 Hz vibrato + a noise snort |
| `creature/shush` | "SHHH": high-passed noise (3 kHz), 400 ms |
| `creature/kazoo-drone` | buzzing loop |

**Bosses and environment**

| id | Description |
|---|---|
| `boss/calliope-scale` | 6 rising steam-whistle notes (pulse 50% + breath noise) |
| `boss/foghorn` | deep horn: saw 55 Hz + 110 Hz |
| `boss/trombone-pull` | slide-up "wwwoop" |
| `boss/hihat-open` / `boss/beater-pull` | "chick" / a low creak |
| `boss/bagpipe-drone` / `boss/bagpipe-die` | nasal drone loop (saw 110 + 165 Hz, band-passed) / the drone sliding down as it runs out of air |
| `boss/piano-rattle` / `boss/piano-gliss` | key clatter / a rising run |
| `boss/harp-charge` | glittering arpeggio up (FM bell) |
| `boss/organ-chord` | big pad chord |
| `boss/goose-wiggle` / `boss/goose-honk` | rattling wobble / `swan/honk` detuned down and distorted |
| `boss/scream` / `boss/voice-crack` | FORTISSIMO scream: noise + saw formant sweep, 1.2 s / a tiny squeak (pulse 2 kHz, 80 ms) |
| `boss/deflate` | long raspberry: saw 90 Hz with 30 Hz AM, falling pitch, 1.5 s |
| `env/applause` | crowd clapping from random noise bursts over a soft low-passed bed, 2 s |
| `env/rimshot` | "ba-dum-tss": two drum hits + a cymbal hiss |
| `env/cricket` | two chirps (pulse 4 kHz, gated) |
| `env/water-splash`, `env/water-rush`, `env/wind`, `env/radio-static` | water and air noises; radio static for briefings |
| `env/train-bell`, `env/train-pass` | "DING DING" / whoosh + rumble |
| `env/anthem-sting` | the anthem's first bar through a band-pass "loudspeaker" filter |

**UI**

| id | Description |
|---|---|
| `ui/move`, `ui/confirm`, `ui/cancel` | menu blips (pulse) |
| `ui/coin` | credit added: bright 2-note chime |
| `ui/pause` | short descending chime |
| `ui/countdown` | one tick per continue number |
| `ui/timer-warn` | tick per timer unit under 10 |
| `ui/tally-tick` | fast blips while the tally counts up |
| `ui/star` | review star "ding" |
| `ui/stamp` | newspaper stamp thump |
| `ui/select-confirm` | short drum roll + a honk |
| `ui/name-letter` | letter change blip |

### 12.2 Music tracks

The **Cygnet hook** is the heroes' leitmotif: a short, graceful phrase with a wide leap up and a
dotted-rhythm walk down that ends on an unresolved note (the swan gliding), always answered by a
fast, busy bass figure (the paddling). It appears in `title`, `select`, `mission-complete`,
`m5-sky` and `ending`. The **anthem** is the villain's leitmotif; its seventh melody note is
always 50 cents flat (a running joke the player learns to hear).

| id | Mood | bpm | Key / mode | Instrumentation | Structure |
|---|---|---|---|---|---|
| `title` | "Calm on top, furious underneath": a slow, elegant melody over a frantic bass | 112 | D major | FM bell arpeggio + pad intro; pulse 25% lead (legato, long notes); saw bass in running 16ths; noise kick/snare/hat | intro 8 bars (pad + bell only) → A 16 (lead + racing bass + drums) → B 8 (triangle counter-melody) → A' 8 → loop to A |
| `select` | bouncy, eager | 128 | A major | pulse 12.5% lead, walking triangle bass, hat-only drums | 16-bar loop |
| `briefing` | radio chatter, light | 96 | G mixolydian | filtered pulse 12.5% melody, triangle bass, brushed noise snare | 8-bar loop under Gusto's lines |
| `m1` | sunny regatta march with a swing | 132 | D major, 6/8 feel (3 rows per beat) | pulse 25% lead, pulse 50% harmony in thirds, triangle bass on 1 and 4, noise kick/snare, FM bell ornaments | intro 4 → A 16 → B 16 (moves to G major) → A 16 → loop |
| `m2` | hot, driving, sandy | 140 | E dorian | saw bass ostinato in a 3+3+2 rhythm, pulse 12.5% lead with bugle-like leaps of fourths and fifths, noise shaker 16ths, snare backbeat | intro 8 (shaker + bass) → A 16 → B 16 (half-time break with a pulse 50% bugle solo) → A' 16 → loop |
| `m3` | cold, airy, climbing | 120 | B minor, chorus in D major | triangle bass long tones, cold pad, high pulse lead with octave-flip "yodel" grace notes, FM bell icicles, sparse kick + hat | intro 8 → A 16 (minor) → B 16 (major lift) → A 16 → loop |
| `m4` | night-club swing, sly | 150 | C minor, swing (3 rows per beat) | walking triangle bass, saw stabs on off-beats (a brass section), chromatic pulse lead, noise ride pattern | A 16 → B 16 → break 8 (bass + drums only, for the parades) → A 16 → loop |
| `m5-sky` | soaring, heroic | 160 | F major → D minor | long-note pulse 50% lead over fast saw arpeggios, pad swells, kick on every beat; the Cygnet hook in triumph | intro 8 → A 16 → B 16 → C 8 (key up a whole step) → loop to A |
| `m5-organ` | mechanical, inside a machine | 108 | D minor | organ-like pad drones, triangle ostinato in 8ths, FM bell clock ticks, pulse fragments of the anthem bent out of shape; heavy kick on 1 and 3, metallic noise hits | A 16 → B 16 → loop |
| `boss` | Section Leader battle: fast, aggressive, a little silly | 156 | A minor | saw bass in octave 8ths, pulse 25% lead with fast triplet runs, snare rolls before phrase ends, FM bell stabs | intro 4 (snare roll) → A 16 → B 16 → C 8 (half-time breakdown; jumped to during intermission gags) → loop to A |
| `boss-final` | His Loudness: grand, pompous, desperate | 168 | C minor | everything: organ pad chords, saw bass, both pulses in counterpoint, triangle, full drums; quotes the anthem in minor with its flat note intact | intro 8 → A 16 → B 16 → C 16 (anthem quote) → loop to A. `boss-final-fast`: the same song at 210 bpm for the **Tempo!** attack |
| `anthem` | Anthem of Eternal Attention: pompous, slow, self-important | 84 | B♭ major | pad organ, pulse 50% melody doubled by saw an octave down, triangle bass in half notes, timpani-like kick rolls; the 7th melody note is detuned −50 cents | 8 bars; the speakers play only bar 1 (about 3 s); the full anthem plays in cutscenes and in the ending parade |
| `mission-complete` | triumphant jingle | 140 | D major | pulse lead + FM bell, ends with a honk | 6 s, no loop |
| `game-over` | deflated | 80 | D minor | slow descending pulse line; the last note is the anthem's flat note (the anthem wins) | 5 s, no loop |
| `continue` | nervous ticking | 120 | chromatic | noise hats as a clock, a pulse figure that rises a semitone on every repeat | 10 s loop matched to the countdown |
| `ending` | The Parade: a happy march | 116 | D major | the Cygnet hook as a full march; the anthem melody as a counter-line on FM bell (in tune at last, except one note) | 32 bars, then into `credits` |
| `credits` | relaxed | 100 | G major | swing version of the `title` theme, pulse + triangle + brushes | 32-bar loop |
| `highscore` | perky | 132 | A major | short pulse melody, triangle bass | 8-bar loop |

Engine request (audio): a per-player sfx pitch multiplier for Helium Head, and `music(id)` to
swap `boss-final` ↔ `boss-final-fast` at the same song position (or a playback-rate option).

### 12.3 Announcer lines (`audio.voice`)

| Event | Line |
|---|---|
| Mission start | m1 "MISSION ONE. LOOK SHARP, CYGNETS!" · m2 "MISSION TWO. STAY HYDRATED, CYGNETS!" · m3 "MISSION THREE. WRAP UP WARM, CYGNETS!" · m4 "MISSION FOUR. BREAK A LEG, CYGNETS!" · m5 "FINAL MISSION. FLY GRACEFULLY, CYGNETS!" |
| Weapons | as in 5.2; same weapon again: "MORE <NAME>!" |
| Bombs / shells | "EXTRA BOMBS!" / "RELOAD!" |
| 1UP | "ONE MORE TRY!" |
| Helium Head | "HELIUM HEAD!" |
| Vehicle entered | "SWAN-3, READY!" · "SUNDAE DRIVER!" · "BANDWAGON!" · "TRUMPETER!" |
| Character chosen | "GRACE!" · "MITTENS!" · "PIP!" · "GRAMPS!" |
| Mission complete | "MISSION COMPLETE! BRAVO!" |
| All hostages | "STANDING OVATION!" |
| Continue / game over | "CONTINUE?" / "GAME OVER. THE CRITICS WERE NOT KIND." |
| New high score | "NEW HIGH SCORE! ENCORE!" |

When speech is off or unavailable, each category plays a short jingle instead (engine default).

---
## 13. UI & flow

### 13.1 Scene flow

`Boot` → `Title` (attract loop) → `ModeSelect` → `CharacterSelect` → `MissionIntro` →
`Gameplay` (↔ `Pause`) → `MissionComplete` (tally) → next `MissionIntro` … → after m5:
`Ending` → `Credits` → `NameEntry` (if the score qualifies) → `HighScores` → `Title`.
From `Gameplay`: a player with no lives → `Continue` overlay; all players out → `GameOver` →
`NameEntry` → `HighScores` → `Title`.

All text uses the project bitmap fonts: **big** (8×8) for titles and banners, **small** (5×7)
for everything else. Centred text is centred on x = 192.

### 13.2 Boot

- Black screen, a row of 8 small swan icons that fill in as sprites and sounds pre-render.
- Text (small, centre, y 120): `TUNING INSTRUMENTS... 64%` (live percentage).
- When ready: `CLICK OR PRESS ANY KEY` (blinking; this gesture unlocks Web Audio).

### 13.3 Title

- **Scene:** a lake at dusk. The SWAN-3 glides across the water from left to right, its legs
  paddling like mad under the surface. On the far bank a tiny crimson Legion parade marches past.
- **Logo** (centre, y 20–84): `METAL SWAN` in chunky riveted ivory-and-steel letters, a large gold
  `3` whose top curls like a swan's neck.
- **Tagline** (small, y 92): `CALM ON TOP. FURIOUS UNDERNEATH.`
- **Prompt** (big, y 160, blink 30/30 ticks): `PRESS START`
- **Footer** (small): `(C) 2026 THE METAL SWAN 3 TEAM` at y 206 centre; `CREDITS 05` right-aligned
  at (380, 206) (`FREE PLAY` when set).
- **Attract loop** after 600 idle ticks: demo play of m1 `a` with the bot (1200 ticks, label
  `DEMO PLAY` at the top centre) → HOW TO PLAY card → high scores → title with an alternate tagline
  (1.3).
- **HOW TO PLAY** card (small font, left-aligned at x 40, from y 40, 12 px line spacing):
  `ARROWS / WASD  MOVE AND AIM` · `FIRE  SHOOT (KNIFE UP CLOSE)` · `JUMP  JUMP` ·
  `DOWN + JUMP  DROP DOWN` · `BOMB  THROW A GRENADE` · `FIRE + BOMB  VEHICLE SPECIAL` ·
  `DOWN + JUMP IN A VEHICLE  EJECT` · `FREE THE CRITICS. STOP THE ANTHEM.`

### 13.4 Mode select

Vertical menu, centred, from y 80, 16 px apart; cursor = a small swan-head icon left of the item.

- `1 PLAYER`
- `2 PLAYERS`
- `DIFFICULTY  < NORMAL >` with the subtitle line under it (small, gold): `"REHEARSAL"`,
  `"CONCERT"` or `"ENCORE"`
- `OPTIONS`
- `HIGH SCORES`

### 13.5 Character select

- Title (big, y 12): `CHOOSE YOUR CYGNET`
- Four portraits (32×32) in a row, centres at x 72, 152, 232, 312, y 40–72; short names under
  each (small, y 76): `GRACE`, `MITTENS`, `PIP`, `GRAMPS`.
- Cursors: P1 = navy frame with a `1P` tag; P2 = gold frame with a `2P` tag. Two players can't pick
  the same character.
- Below: the highlighted character's full figure in its idle animation at (88, 196); a text box at
  x 140–376, y 100–196 with the full name and rank (big): `CAPT. GRACE HOLLOWAY`,
  `SGT. TORVALD "MITTENS" MAGNUSSON` (small font if too wide), `PVT. PIP OKAFOR`,
  `W.O. AMBROSE "GRAMPS" FENWICK`; and the quote (small, word-wrapped) from section 3.
- Timer (big, top right, (376, 12) right-aligned): `20` → at 0 the highlighted character is chosen.
- On confirm: victory pose + announcer name + `ui/select-confirm`.

### 13.6 Mission intro card

- Black background with a simple map of the region (1-colour lines) and a blinking dot.
- `MISSION 1` (big, y 24) · `BRASS ON THE RIVERBANK` (big, gold, y 40) · subtitle (small, y 54):
  - m1 `PUDDLEWICK, LOWMERE - 0900 HOURS`
  - m2 `RATTLEBONE FLATS, CRESCENDIA - 1200 HOURS`
  - m3 `MOUNT MURMUR, CRESCENDIA - 1700 HOURS`
  - m4 `FORTISSIMO CITY - 2100 HOURS`
  - m5 `ABOVE THE CLOUDS - 2330 HOURS`
- Radio box (x 16–368, y 120–200): Gusto's portrait at the left, the briefing (2.4) types out at
  2 characters per tick with `env/radio-static` under it.
- `PRESS START TO SKIP` (small, y 206). Max 360 ticks, then fade to gameplay, where the banner
  `MISSION 1` / `START!` shows for 120 ticks with the announcer line.

### 13.7 HUD (384×216, screen space)

| Element | Position | Content |
|---|---|---|
| P1 score | (4, 3) | small: `1P` then the 7-digit score at x 16: `0012300` |
| P1 arms box | (4, 11), 64×16 | navy fill (70% alpha), ivory border; left half: `ARMS` label over the ammo (`∞` or 3 digits); right half: `BOMB` label over 2 digits |
| P1 lives | (4, 29) | swan-head icons 6×6, one per life in reserve, max 5 drawn, then `x7` |
| P1 hostages | (4, 37) | bow-tie icons 5×3, one per hostage in the tally, max 10 drawn, then `x12` |
| P1 continues | (4, 45) | small `CONT 1`, only when > 0 |
| P1 vehicle | (72, 11) | vehicle name (small, max 9 chars: `SWAN-3`, `SUNDAE`, `BANDWAGON`, `TRUMPETER`) + HP cells 8×6 with 2 px gaps (ivory, crimson and blinking at 1 left) + shells count |
| P1 status | (72, 21) | balloon icon + 24 px bar when Helium Head is on |
| P2 blocks | mirrored | right-aligned at x 380 (`2P` score at the top right, arms box at (316, 11) …) |
| P2 not playing | (380, 3) right-aligned | blinking `2P PRESS START`, or `NO CREDITS` |
| Timer | frame 28×18 at (178, 2) | big 2 digits centred at (192, 6); crimson blink under 10 |
| Boss bar | (96, 206), 192×4 | crimson fill = sum of remaining part hp; boss name (small) centred at y 198; only in boss fights |
| Banners | centre, y 80–100 | big: `MISSION 1`, `START!`, `TIME UP!`, `ALARM!`, `MISSION COMPLETE!` |
| GO arrow | (352, 100) | big `GO!` + arrow, blinking, when the camera unlocks after a fight |
| Small callouts | centre, y 60, 90 ticks | `CHECKPOINT`, `CAUGHT NAPPING +100`, `QUIET PLEASE +800`, `STRIKE! +1000`, `FULL SET! +1000`, `VANDALISM +500`, `STYLE POINTS 9.5! +2000`, `NO SCRATCHES! +10000` |
| Score popups | at the kill point | small digits rise 12 px over 40 ticks |
| Speech bubbles | over the speaker | small font, white rounded box, 3 px tail, max 24 chars × 2 lines, 120 ticks (option `SPEECH BUBBLES` OFF hides gag bubbles only, never hints) |

### 13.8 Pause

The game dims (black at 50%). Centre box 160×80: `PAUSE` (big) and the menu `RESUME`, `OPTIONS`,
`QUIT TO TITLE`. Quit asks `QUIT? PROGRESS WILL BE LOST.` → `YES` / `NO`. Cosmetic gag: after 600
ticks in pause, a tiny Legion private walks onto the pause box, sits on its edge and falls asleep
(snore bubble). He leaves when the game resumes.

### 13.9 Continue

The game freezes and dims for that player's half of the HUD (in 1P: the whole screen). Centre:
`CONTINUE?` (big, y 60), a large countdown digit (big font ×2, y 90) from `9` down to `0` (60 ticks
each, jump skips 30), `CREDITS 04` (small, y 140). **Gag scene:** the character sits tied to a
chair while two Legion privates push a giant loudspeaker one step closer for every number. At 0
they switch it on, the `game-over` jingle plays (with the flat note) and the character salutes
against their will. Pressing fire or start in time: the ropes snap, the character punches the
speaker over and drops back into the game (4.7).

### 13.10 Game over

`GAME OVER` (big, centre), then `THE CRITICS WERE NOT KIND.` (small, y 120), final scores per
player; then name entry if the score qualifies, then high scores, then title.

### 13.11 Mission complete tally — "THE REVIEWS ARE IN"

1. In the level: `MISSION COMPLETE!` (big) for 180 ticks, victory poses, `mission-complete` jingle,
   announcer "MISSION COMPLETE! BRAVO!".
2. A newspaper slides in (ivory paper, black ink). Masthead (big): `THE LOWMERE LISTENER`; under it
   `SPECIAL EDITION`; a stamp (`ui/stamp`) drops the headline:
   - m1 `RIVERBOAT SUNK! REGATTA RESUMES!`
   - m2 `DRUM TANK SILENCED! COLONEL'S JOKES STILL BAD!`
   - m3 `WINDBAG DEFLATED ON MOUNT MURMUR!`
   - m4 `PREMIERE CANCELLED! PIANO "UNPLAYABLE"!`
   - m5 `ANTHEM STOPPED! WORLD STAYS FREE TO SLOUCH!`
3. Tally lines count up (columns `1P` / `2P`):
   `HOSTAGES  x 1000` · `STANDING OVATION  20000` (if earned) · `FLAWLESS PERFORMANCE  10000`
   (no life lost this mission) · `BOSS SPEED BONUS` · `DIFFICULTY  x0.5 / x1.0 / x1.5` · `TOTAL`.
   When Pip is played, his column adds the joke line `HATS COLLECTED  47` (no points).
4. **THE CRITICS SAY:** a star rating per player, 1 star plus 1 each for: ≥ 75% of the route's
   hostages; no life lost; a boss speed bonus > 0; the mission's golden record found. Quote by
   stars: 1 `"LOUD. MESSY. WE LEFT AT THE INTERVAL."` · 2 `"SOME NICE MOMENTS. MOSTLY
   EXPLOSIONS."` · 3 `"A SOLID PERFORMANCE. THE DUCKS LOVED IT."` · 4 `"GRACEFUL! FURIOUS! WE
   WEPT A LITTLE."` · 5 `"FIVE STARS. WE HAVE NOTHING BAD TO SAY, AND IT HURTS."`
5. `PRESS START` (auto after 600 ticks).

### 13.12 Ending and credits

The ending is described in 2.6. Credits (small font, scrolling up at 0.5 px/tick over the parade,
big font for headings): `METAL SWAN 3` · `MADE ENTIRELY OUT OF CODE` · `BY THE METAL SWAN 3 TEAM` ·
`STARRING` · `CAPT. GRACE HOLLOWAY` · `SGT. TORVALD "MITTENS" MAGNUSSON` · `PVT. PIP OKAFOR` ·
`W.O. AMBROSE "GRAMPS" FENWICK` · `AND THE SWAN-3` · `WITH` · `BRIGADIER LIONEL GUSTO` ·
`MRS. DOLLOP AS HERSELF` · `INTRODUCING` · `HIS LOUDNESS, GRAND MARSHAL BOMBASTIAN FORTISSIMO` ·
`COMMODORE BLARE` · `COLONEL RIMSHOT` · `WING COMMANDER PUFFINGTON` · `COUNTESS PIZZICATA` ·
`NO CRITICS WERE HARMED IN THE MAKING OF THIS GAME` · `THANK YOU FOR PLAYING` ·
`THE END ... OF THE NOISE.`

### 13.13 Options

`DIFFICULTY  < EASY / NORMAL / HARD >` · `CREDITS  < 3 / 5 / 9 / FREE PLAY >` ·
`MUSIC VOLUME  < 0-10 >` · `SFX VOLUME  < 0-10 >` · `ANNOUNCER  < ON / OFF >` ·
`SPEECH BUBBLES  < ON / OFF >` · `SCREEN SHAKE  < ON / OFF >` · `REDUCE FLASHES  < ON / OFF >` ·
`CONTROLS` (rebind screen: `PRESS A KEY FOR FIRE`, `... FOR JUMP`, `... FOR BOMB`; `ESC` cancels) ·
`RESET HIGH SCORES` (asks `ARE YOU SURE?` → `YES` / `NO`) · `BACK`.

### 13.14 High scores and name entry

- Title (big): `TOP PERFORMERS`. Ten rows: rank, 3 initials, 7-digit score, character icon, mission
  reached (`M3` or `ALL`), continues used (`C2`, blank if none).
- Default table: `GRC 200000`, `MIT 150000`, `PIP 120000`, `GPS 100000`, `HIS 90000`,
  `BLR 70000`, `RIM 50000`, `PUF 40000`, `PIZ 30000`, `DOL 20000`.
- Name entry: `ENTER YOUR INITIALS`; a letter wheel (A–Z, 0–9, `.`, `END`); 30-second timer; the
  announcer says "NEW HIGH SCORE! ENCORE!" when the entry screen opens.

---

## 14. Scoring

| Source | Points |
|---|---|
| `rifleman` / `drummer` (+100 for breaking the drum) / `oompah-trooper` / `cymbalist` | 100 / 300 / 500 / 300 |
| `baton-major` / `piccolo` / `triangle` / `bassoonist` | 1,000 / 400 / 200 / 600 |
| `oompah-tank` / `band-truck` / `metronome-turret` / `gramophone-mortar` | 3,000 / 2,000 / 1,500 / 1,200 |
| `piano-bomber` / `baton-copter` / `pipe-battery` (+300 per pipe) / `anthem-speaker` | 4,000 / 1,500 / 3,000 / 500 |
| `bullfrog` / `windup-bot` / `rattler` / `echo-bat` | 400 / 100 / 600 / 200 |
| `ram-goat` / `usher-bot` / `kazoo-drone` | 800 / 700 / 100 |
| Mini-bosses: `golden-goose` / `big-head` | 15,000 / 20,000 |
| Bosses: `encore` / `ba-dum-behemoth` / `windbag` / `grand-grand` | 30,000 / 40,000 / 50,000 / 60,000 |
| Final stages: `grand-organ` / `organ-console` / `maestro` | 30,000 / 40,000 / 100,000 |
| Any destroyed boss or mini-boss part | 1,000 (the Grand Organ `bellows`: 5,000) |
| Shootable enemy projectiles (tuba rings, rockets, golden eggs, barrels, records, homing notes) | 50 each |
| Leaflet-bombs / sheet-music mines | 100 / 50 |
| Tank crewman (fleeing) | 100 |
| CAUGHT NAPPING (kill before the double-take ends) | +100 |
| CLOSE HARMONY (knife kill) | +50; knife combo within 180 ticks: +50 × combo step (2nd kill +100, 3rd +150 …, max +500) |
| QUIET PLEASE (triangle killed before the third ding) | +800 |
| STRIKE! (6 wind-up bots crushed in one vehicle run) | +1,000 |
| FULL SET (whole kazoo-drone formation) | +1,000 |
| VANDALISM (statue head knocked off) | +500 |
| STYLE POINTS (clean ski-jump landing) | +2,000 |
| NO SCRATCHES (vehicle section ended with full cells; once per mission) | +10,000 |
| `crate` broken | 100 |
| `pickup-weapon` / `pickup-bombs` | 500 / 500 |
| `pickup-food`: bread / cheese / teacake / jelly / birthday-cake | 100 / 300 / 500 / 1,000 / 5,000 |
| `pickup-gem`: golden-note / gem / medal / golden-record | 100 / 1,000 / 2,000 / 10,000 |
| `pickup-1up` | 0 (10,000 if lives are full) |
| Hostage freed | 500 |
| Tally: each hostage in the tally | 1,000 |
| Tally: STANDING OVATION (all hostages of the route) | 20,000 (split in co-op) |
| Tally: FLAWLESS PERFORMANCE (no life lost in the mission) | 10,000 |
| Tally: BOSS SPEED BONUS | (90 − boss fight seconds) × 200, min 0 (max 18,000) |
| Tally multiplier | Easy ×0.5, Normal ×1.0, Hard ×1.5 (applies to the tally lines only) |
| Game end: ONE-TAKE WONDER (all 5 missions on one credit) | +100,000 |
| Extends | +1 life at 30,000 and every 100,000 after |

Scores are per player (7 digits, max 9,999,999). In co-op a kill scores for the player whose
damage killed it; area kills score for the owner of the explosion.

---
## 15. Content ID index

All ids are kebab-case. Foundation ids are kept for their concepts: weapons `pistol`,
`machine-gun`, `grenade`, `knife`; enemy `rifleman`; items `crate`, `hostage`, `pickup-weapon`,
`pickup-bombs`, `pickup-food`, `pickup-gem`; character `recruit`; mission `m0`.

### 15.1 Characters (`defineCharacter`) — folder `characters/`
`grace`, `mittens`, `pip`, `gramps`, `recruit` (test).
Rig style parameter values introduced here (art agent): hair `bun-high`, `short`, `short-curly`,
`bald-tufts`; headgear `beret`, `bobble-hat`, `helmet-oversized`, `goggles-up`; tops
`field-jacket`, `chunky-sweater`, `vest-over-tee`, `boiler-suit`; pants `cargo`, `shorts`,
`boiler-suit`; boots `knee-high`, `fur-trim`, `high-top`, `work`; gloves `short`, `mittens`,
`leather`; builds `slim`, `large`, `small`, `stocky`; accessories `scarf-long`, `whistle`,
`beard-full`, `yarn-ball`, `badge`, `bubble-gum`, `moustache-walrus`, `tool-belt`, `pencil-ear`;
new rig parameter `headScale` (Helium Head).

### 15.2 Weapons (`defineWeapon`) — folder `weapons/`
Player: `pistol`, `machine-gun`, `shotgun`, `rocket`, `flamethrower`, `laser`, `homing`, `tuba`,
`grenade`, `knife`.
Vehicle weapons: `swan-beak-gun`, `swan-beak-shell`, `swan-honk`, `sundae-sprinkle-gun`,
`sundae-mortar`, `sundae-jingle`, `bandwagon-brass-cannon`, `bandwagon-drum-boom`,
`bandwagon-cymbal-wall`, `trumpeter-twin-gun`, `trumpeter-dive-bomb`, `trumpeter-honk`,
`trumpeter-dash`.
Status: `helium-head`.

### 15.3 Items (`items/`)
`crate` (param `contains`), `hostage` (param `kind`: `critic` | `roadie` | `tea-lady` | `tourist`
| `maestro` | `dollop`; param `bind`: `chair` | `cage` | `sack` | `float` | `balloon`; param
`drop`), `pickup-weapon` (param `weapon`), `pickup-bombs`, `pickup-food` (param `kind`: `bread` |
`cheese` | `teacake` | `jelly` | `birthday-cake`), `pickup-gem` (param `kind`: `golden-note` |
`gem` | `medal` | `golden-record`), `pickup-1up`.

### 15.4 Entities (`defineEntity`)
- **Infantry** (`infantry/`): `rifleman`, `drummer`, `oompah-trooper`, `cymbalist`,
  `baton-major`, `piccolo`, `triangle`, `bassoonist`.
  Params: `gag`, `entry`, `outfit`, `alarm` (triangle), `cargo` (trucks), `facing`.
- **Machines** (`machines/`): `oompah-tank`, `band-truck`, `metronome-turret`,
  `gramophone-mortar`, `piano-bomber`, `baton-copter`, `pipe-battery`, `anthem-speaker`.
  Carriers and hazards (also `machines/`): `rowboat`, `tank-barge`, `subway-train`.
- **Creatures** (`creatures/`): `bullfrog`, `windup-bot` (param `variant`: `walk` | `ski` |
  `fly`), `rattler`, `echo-bat`, `ram-goat`, `usher-bot`, `kazoo-drone` (params `formation`,
  `shooter`).
- **Player vehicles** (`vehicles/`): `swan`, `sundae-driver`, `bandwagon`, `trumpeter`.
- **Mini-bosses**: `golden-goose` (`bosses/m2`), `big-head` (`bosses/m4`).
- **Bosses**: `encore` (`bosses/m1`), `ba-dum-behemoth` (`bosses/m2`), `windbag` (`bosses/m3`),
  `grand-grand` (`bosses/m4`), `grand-organ`, `organ-console`, `maestro` (`bosses/m5`).
  Boss-owned props: `chandelier` (m4), `wreck-block` (m5), `drum-barricade` (m4 `b`).
- **Props** (`items/` or the mission folder that uses them; registered without the prefix,
  written `prop/<id>` in mission tables): `card-table`, `parasol`, `spring-awning` (variant
  `net`), `duck-float`, `statue-head`, `breakable-wall`, `rolling-drum`, `helium-tank`, `air-jet`,
  `parade-float`, `cable-car`, `bellows-platform`, `icicle`.

### 15.5 Missions and sections (`missions/`)
- `m0` (test range, unchanged)
- `m1`: `a` Puddlewick Quay · `b1` Chimney Chase · `b2` Storm Drain · `c` River Run (boss)
- `m2`: `a` Rattlebone Flats · `b` Sundae Drive · `c1` Canyon Floor · `c2` Mesa Top · `d` The Drum
  Quarry (boss)
- `m3`: `a` Yodel Valley · `b1` North Face (vertical, up) · `b2` Echo Caves (vertical, up) ·
  `c` Summit Station (boss)
- `m4`: `a` Avenue of Statues · `b` Bandwagon Boulevard · `c1` The Underground · `c2` Billboard
  Rooftops · `d` The Opera House (boss)
- `m5`: `a` Above the Clouds (shoot-em-up) · `b` The Pipe Works (vertical, down) · `c` The Console
  (final boss)

Background generators — standard: `sky-gradient`, `clouds`, `mountains`, `hills`, `treeline`,
`city`, `dunes`, `ice-peaks`, `sea`. Custom (mission agents register them): `town-rooftops`,
`sewer-brick`, `far-bank`, `reeds`, `cacti`, `canyon-walls`, `rock-pillars`, `quarry-terraces`,
`chalets`, `ice-cave`, `cable-cars`, `neon-signs`, `crowd-barrier`, `subway-tiles`, `opera-hall`,
`organ-pipes`, `organ-deep`, `console-room`.

Terrain materials used: ground `concrete`, `mud`, `sand`, `rock`, `snow`, `ice`, `metal`; edges
`tiles`, `grass`, `moss`, `sand`, `snow`, `rust`; platforms `wood`, `metal`, `rock`, `ice`;
solids `brick`, `crate`, `rock`, `metal`, `concrete`.

### 15.6 Sprite id prefixes
- `char/<id>/…` (contract anims, plus `bored`, `portrait`)
- `enemy/<id>/…` infantry (contract anims plus `double-take`, `salute`, `confused`, `queue`,
  `photo-pose`, `ears`, `die-crush`, `die-shatter`, `gag-<name>`)
- `machine/<id>/…`, `creature/<id>/…`, `vehicle/<id>/…`, `boss/<id>/<part>-<anim>`
- `item/<id>/…`, `item/hostage/<kind>/…` (`tied`, `freed`, `walk`, `give`, `run`)
- `weapon/<id>/icon`, `weapon/<id>/proj`, `weapon/<id>/muzzle`
- `prop/<id>/…`, `decor/<name>` (for example `decor/ice-sheet`, `decor/banner-regatta`,
  `decor/poster-loudness`, `decor/mk1-head`)
- `fx/…`: `explosion-s`, `explosion-m`, `explosion-l`, `smoke`, `soot`, `confetti`, `music-note`,
  `steam-puff`, `helium-cloud`, `splash`, `spark`, `shadow`, `aim-line`, `stars-dizzy`,
  `bubble-speech`
- `ui/…`: `icon-life` (swan head), `icon-hostage` (bow tie), `icon-bomb`, `icon-cell`,
  `icon-balloon`, `cursor-swan`, `logo`, `newspaper`, `star`

### 15.7 Sound effects
`weapon/pistol`, `weapon/machine-gun`, `weapon/shotgun`, `weapon/rocket`, `weapon/flame`,
`weapon/laser`, `weapon/homing`, `weapon/tuba`, `weapon/empty`, `weapon/grenade-throw`,
`weapon/grenade-bounce`, `weapon/knife`, `weapon/knife-umbrella`, `weapon/knife-needles`,
`weapon/knife-pan`, `weapon/knife-wrench`, `explosion/s`, `explosion/m`, `explosion/l`,
`explosion/part`, `hit/enemy`, `hit/metal`, `hit/drum`, `hit/boss-part`, `player/jump`,
`player/land`, `player/die`, `player/spawn`, `player/helium-on`, `player/helium-pop`,
`player/helium-deflate`, `pickup/weapon`, `pickup/bombs`, `pickup/food`, `pickup/gem`,
`pickup/1up`, `crate/break`, `hostage/free`, `hostage/give`, `hostage/faint`, `hostage/maestro`,
`hostage/camera`, `vehicle/enter`, `vehicle/exit`, `vehicle/hit`, `vehicle/warning`,
`vehicle/explode`, `vehicle/jingle`, `swan/step`, `swan/paddle`, `swan/fire`, `swan/honk`,
`swan/egg`, `sundae/mortar`, `bandwagon/brass`, `bandwagon/drum`, `trumpeter/flap`,
`trumpeter/dash`, `enemy/alert`, `enemy/double-take`, `enemy/aria`, `enemy/scream`,
`enemy/panic`, `enemy/salute`, `enemy/rifle`, `enemy/grenade`, `enemy/tuba-inhale`,
`enemy/tuba-blast`, `enemy/cymbal-raise`, `enemy/cymbal-crash`, `enemy/drum-hit`,
`enemy/drumroll`, `enemy/whistle`, `enemy/piccolo-whistle`, `enemy/piccolo-shot`,
`enemy/triangle`, `enemy/bassoon-aim`, `enemy/kazoo`, `enemy/fumble`, `machine/tank-move`,
`machine/tank-charge`, `machine/sad-notes`, `machine/truck-horn`, `machine/metronome-tick`,
`machine/metronome-tock`, `machine/scratch`, `machine/piano-whistle`, `machine/piano-crash`,
`machine/copter`, `machine/pipe-charge`, `machine/anthem-crackle`, `creature/croak-build`,
`creature/croak`, `creature/windup`, `creature/rattle`, `creature/bat-screech`, `creature/goat`,
`creature/shush`, `creature/kazoo-drone`, `boss/calliope-scale`, `boss/foghorn`,
`boss/trombone-pull`, `boss/hihat-open`, `boss/beater-pull`, `boss/bagpipe-drone`,
`boss/bagpipe-die`, `boss/piano-rattle`, `boss/piano-gliss`, `boss/harp-charge`,
`boss/organ-chord`, `boss/goose-wiggle`, `boss/goose-honk`, `boss/scream`, `boss/voice-crack`,
`boss/deflate`, `env/applause`, `env/rimshot`, `env/cricket`, `env/water-splash`,
`env/water-rush`, `env/wind`, `env/radio-static`, `env/train-bell`, `env/train-pass`,
`env/anthem-sting`, `ui/move`, `ui/confirm`, `ui/cancel`, `ui/coin`, `ui/pause`, `ui/countdown`,
`ui/timer-warn`, `ui/tally-tick`, `ui/star`, `ui/stamp`, `ui/select-confirm`, `ui/name-letter`.

### 15.8 Music
`title`, `select`, `briefing`, `m1`, `m2`, `m3`, `m4`, `m5-sky`, `m5-organ`, `boss`,
`boss-final`, `boss-final-fast`, `anthem`, `mission-complete`, `game-over`, `continue`, `ending`,
`credits`, `highscore`. (`m0` uses `m1`.)

### 15.9 Engine and art requests collected from this proposal
1. Rig: `headScale` parameter (Helium Head); extra infantry anims (15.6).
2. Player: status timers with physics overrides; per-player sfx pitch multiplier.
3. Vehicles: carry-over between sections (`allowVehicles` per section); players spawn mounted
   (m5 `a`); Backup Swan respawn rule in the shoot-em-up.
4. Mission runtime: `autoScroll` per section; `iceRanges` physics flag; exits shaped as drop-in
   holes; vertical triggers `@Y` for up and down sections.
5. Audio: `boss-final` ↔ `boss-final-fast` swap at the same position (or a playback-rate option).
6. HUD: speech bubbles (small font box) and the newspaper tally screen.

### 15.10 Originality self-check (docs/ORIGINALITY.md)

1. **Names:** every proper name is invented for this project (Task Force CYGNET, Lowmere,
   Crescendia, Puddlewick, Rattlebone Flats, Mount Murmur, Fortissimo City, Little Hushing, the
   Fanfare Legion, its leaders, the four heroes, Brigadier Gusto, Mrs. Dollop, every vehicle and
   boss). The banned-name list was searched in this file: no matches. No vehicle is named with the
   banned animal-plus-series-noun pattern; the player vehicles are a walker (`swan`), an
   ice-cream van, a parade truck and the walker's flight mode.
2. **Characters:** the heroes are a slim officer with a beret and long scarf, a giant in a knitted
   sweater and pom-pom hat, a small rookie in a reflective vest and oversized helmet, and a bald
   old engineer in a boiler suit. Enemy soldiers are crimson-and-gold marching-band troops with
   tall shakos (no green fatigues, no borrowed insignia). Hostages are tweed-jacketed critics and
   other fully dressed civilians. No tentacled aliens, no round tank with a top gun.
3. **Gags and transformations:** the one status gimmick is Helium Head (head and jump only); no
   zombie, mummy or fat transformation. Set pieces (anthem salutes, parade columns, floating
   pianos, the van's jingle queue, the sheet-music boss telegraph) and all boss designs (a
   riverboat, a drum kit, a bagpipe airship, a piano, a pipe organ) are this project's own.
4. **Text and voice:** all lines, jokes, headlines and announcer calls were written for this
   proposal. Generic genre phrases (MISSION COMPLETE, GAME OVER, CONTINUE?) are used as allowed.
5. **Music and sound:** tracks are described by mood, tempo, key, instruments and form only; the
   composer must write new melodies, and the list of tunes not to imitate in section 12 applies.
