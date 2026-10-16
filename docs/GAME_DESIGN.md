# METAL SWAN 3 — Game Design Document

> **Status:** final design, v1. This file is the single source of truth for all content agents.
> Base: the "Personality & Comedy" proposal, with grafts from the "Arcade-Faithful" and
> "Spectacle & Variety" proposals and the feel targets of `docs/research/mechanics.md` §22
> (see `docs/design/scorecard.md`). Engine contract: `docs/ARCHITECTURE.md`, `docs/api/*.md`.
> IP rules: `docs/ORIGINALITY.md` (mandatory). If this file and the code disagree, fix one of
> them in the same change.

## Conventions used in this document

- **Units.** px, ticks (60 ticks = 1 s), px/tick, px/tick² (gravity). Angles in degrees, 0° =
  facing direction, negative = up.
- **Damage unit.** One pistol bullet = **10** damage. All HP values use this unit (a `rifleman`
  has 10 HP and dies to one bullet). Machines and bosses scale from it.
- **Coordinates.** Section space, origin top-left, y grows downward. The standard ground line
  is **y = 176** (40 px of ground under the feet in a 216 px view) unless a section says
  otherwise. Positions in wave scripts are the **feet** of the spawned entity; when no y is
  given, put the entity on the first surface under the spawn point
  (`terrain.surfaceY(x, 0)`; enemies on platforms give their y).
- **Section ids.** Inside a `MissionDef` the section ids are short: `a`, `b`, `b1`, `b2`, `c`,
  `c1`, `c2`, `d` (so `?mission=m1&section=b1` works). This document writes them with the
  mission prefix (`m1-b1`).
- **Wave notation** (section 11):
  - `@X` — when the camera's **left** edge reaches world x = X (`waitCamera(X)`).
    Vertical sections: `@Y` — when the camera's **top** edge reaches world y = Y (up-scrolling:
    top ≤ Y; down-scrolling: top ≥ Y).
  - `R+16` / `L-16` — enter 16 px outside the right / left view edge at ground height and walk
    or run in. `TOP` — drop in from above the view at the x given. `@x` — already standing
    there (idle or in a gag).
  - `LOCK a–b` — `camera.lock(a, b)`: the view is held between world x a and b (b − a = 384
    unless noted). `UNLOCK` — `camera.unlock()` and show the ONWARD prompt (13.7).
    `WAIT dead` — `waitAllDead` for the wave spawned in that row.
  - `t+N` — N ticks after the row above. `[N]` — spawn only on NORMAL and HARD. `[H]` — HARD
    only. `[2P]` — only with 2 players.
  - Hostages: `hostage kind/bind @x (drop)` (section 7). Crates: `crate @x (contains)`. A drop
    or contents value is a crate letter (M S R F L H T B; `B` is always Bounce Mines, never a
    drop table), `bombs`, `repair`, a food or gem kind, `1up`, or `auto` (a hostage rolls its
    kind's drop table, 7.3; a crate rolls table `crate`). Drop tables are never written as
    single letters.
- **Palette words** are the ramps of `src/engine/palette.ts`: `ink steel stone olive sand brown
  rust red orange gold fire green teal sky navy purple pink snow skinA skinB skinC hairA hairB
  hairC ui`. "Gold" = the `gold` ramp, "ivory" = `snow` mid tones, "crimson" = `red`.
- **Difficulty.** Numbers are for **NORMAL, 1 player** unless a line says otherwise. Section
  4.10 lists exactly what EASY and HARD change; section 4.9 lists the 2-player changes.
- **Timer unit.** One timer **count** = **256 ticks** (≈ 4.3 s). `SectionDef.timeLimit` is in
  counts (default 60).

---

## 1. Overview

### 1.1 Pitch

A swan looks calm on the water and paddles like mad underneath. So does **Task Force CYGNET**:
four odd but elite soldiers sent to stop **Grand Marshal Bombastian Fanfaroni**, a failed opera
tenor who built an army out of a marching band. His **Fanfare Legion** wants to broadcast the
*Anthem of Eternal Attention* to every radio on Earth: anyone who hears it must stand to
attention and salute him, forever. The Cygnets are immune — eleven years of their commander's
karaoke nights made them deaf to bad music.

The squad fights through six missions (a fried-food fight in Amsterdam, then brass bands, drum tanks, bagpipe airships and a piano
that bites, on foot and on the back of the **SWAN-3**: a robot swan that sprints, leaps, glides,
swims and honks, with a machine gun in her beak. She is the third prototype of the "Metal Swan"
programme. (Mk1 sank. Mk2 flew south for the winter and never came back.)

### 1.2 Tone

- **Saturday-morning cartoon war.** Nobody bleeds (one dated exception: the first-person mode
  after `ams`, §17 and `docs/ART_GUIDE.md` §10, user decision 2026-10-14). Defeated soldiers
  swoon like opera singers, turn black with soot, lose their tall hats, flatten like pancakes and
  flutter away.
- **The enemy is a band, and the band is the joke.** Every enemy type is built around one
  instrument and one personality trait. Its attacks are music and its telegraphs are sounds you
  learn to hear (an inhale before the tuba, a shimmer before the cymbals, three dings before the
  alarm). This suits the synthesized audio: every telegraph has a sound.
- **The heroes are straight men** in a world of noise. Grace is polite, Mittens knits, Pip is
  far too excited, Gramps built the Swan and talks to her.
- **Pompous villain, sincere stakes.** Fanfaroni is ridiculous, but the anthem is a real threat
  in the story. His comeuppance is small and kind.
- **The comedy rule:** a gag is either free time for the player or pure decoration. A gag never
  hides a threat, never takes control away for more than 30 ticks (cutscenes excepted) and
  never kills.

### 1.3 Title-screen tagline

**`THE SWAN HAS LANDED. THE ENEMY HAS NOT.`** (military, 2026-10-16, `docs/design/squad.md` §3.2;
was `CALM ON TOP. FURIOUS UNDERNEATH.`)

Attract-mode alternates (cycled under the logo, 300 ticks each):
`ONE SWAN. FIVE IDIOTS. ZERO RETREAT.` · `LOCK. LOAD. HONK.` · `OPERATION FRIKANDEL IS A GO.`

### 1.4 Target runtime and structure

| Mission | Name | Biome | Sections played | Vehicle | Boss | Time (good player) |
|---|---|---|---|---|---|---|
| ams | THE FRYING DUTCHMAN (MISSION 1, prologue) | Amsterdam canals, morning → sunset | `a` → `b` → `c` → `d` | SWAN-3 (parked in `b`, may continue to `c`, `d`) | ROBO-HALSEMA (robot mayor) | 4:00 |
| m1 | BRASS ON THE RIVERBANK | river town, spring morning | `a` → `b1`/`b2` → `c` | SWAN-3 (`c`) | THE ENCORE (riverboat) | 4:00 |
| m2 | DUNE BUGLE | desert flats and canyon, noon | `a` → `b` → `c1`/`c2` → `d` | SUNDAE DRIVER (`b`, may continue) | THE BA-DUM BEHEMOTH (drum tank) | 5:00 |
| m3 | THE HIGH NOTE | ski resort mountain, sunset | `a` → `b1`/`b2` (vertical) → `c` | SWAN-3 (`a`; `c` if she survives `a`) | THE WINDBAG (bagpipe airship) | 4:30 |
| m4 | OPENING NIGHT | the capital at night | `a` → `b` → `c1`/`c2` → `d` | BANDWAGON (`b`) | THE GRAND GRAND (piano mech) | 5:00 |
| m5 | SWAN SONG | above the clouds, inside the organ | `a` (shoot-em-up) → `b` (vertical) → `c` | TRUMPETER (`a`) | THE GRAND ORGAN → THE CONSOLE → THE MAESTRO | 6:00 |

- Campaign order (`CAMPAIGN_MISSIONS`): `ams`, `m1` … `m5`. The cards number them MISSION 1–5
  (`ams` = 1, `m1` = 2 … `m4` = 5) and `m5` stays FINAL MISSION; detail of `ams`:
  `docs/design/amsterdam.md`.
- One-credit clear by a good player on NORMAL: **≈ 26 minutes** (+ ≈ 4 for `ams`) including cards and tallies.
  A first clear with continues: 40–45 minutes.
- 4 route branches (m1, m2, m3, m4); every branch rejoins before the boss.
- Vertical sections: `m3-b1` and `m3-b2` (scroll up; one of them per run), `m5-b` (scroll down).
- Vehicle sections: `m1-c`, `m2-b` (and optionally `m2-c1`/`m2-c2`/`m2-d`), `m3-a` (and `m3-c`
  when a swan survives `m3-a`), `m4-b`, `m5-a` (horizontal shoot-em-up flight).

### 1.5 Pacing rules (apply to every section)

1. **The 4-second rule.** The player is never more than 240 ticks without a new threat, a
   pickup, a hostage, a breakable object or a gag on screen.
2. **Breathers.** After every 3–4 dense waves comes one short breather (a hostage, a crate, an
   idle gag group that can be shot before it notices you).
3. **Weapon generosity.** At least one weapon pickup per ~45 s of play; the first one of each
   mission in its first 20 s; every boss arena holds one weapon crate.
4. **Escalation inside a mission:** foot soldiers → mixed squads → first machine → set piece →
   arena lock → vehicle or route choice → boss.
5. **Escalation across missions:** m1 teaches (rifleman, drummer, anthem, first creatures,
   Swan); m2 adds hidden creatures, a heavy vehicle and the first mini-boss; m3 adds slopes, ice,
   a chase and vertical climbs; m4 adds dense machines and night; m5 remixes everything and adds
   flight.
6. **Rhythm.** About 40 % of play time in camera locks, 60 % scrolling (research §20). A new
   threat type or set piece every 20–40 s.
7. **Readable danger.** Every enemy attack has a pose telegraph and a sound of at least 18 ticks
   (never shorter on any difficulty). Standard rifle shots fly at chest height (22–26 px above
   the ground) so a crouch dodges them.

---

## 2. Story

### 2.1 Premise

The quiet republic of **Lowmere** is famous for nothing, and likes it that way. Its neighbour
**Crescendia** was the same until its opera house gave the lead role in *The Tenor Who Wept* to
somebody else. The rejected tenor, **Bombastian Fanfaroni**, marched out of the audition,
bought every brass instrument in the country and declared himself **Grand Marshal**. His
followers call him **His Loudness**. (In Italian, *fanfaroni* means "braggarts". He says it means
"geniuses".)

His plan has three steps (he sings them, badly, in every broadcast):

1. Kidnap every music critic who ever gave him a bad review.
2. Finish the **Grand Organ**, a flying pipe organ the size of a cathedral.
3. On **Opening Night**, play the *Anthem of Eternal Attention* from the Grand Organ through every
   radio on Earth. All listeners freeze at attention and salute him forever. Finally: the
   biggest audience in history.

Lowmere's **Brigadier Lionel Gusto** sends **Task Force CYGNET** (official name: *Covert Yet
Graceful Navy-Army Expeditionary Team*; nobody can say it fast). Gusto has sung karaoke in the
barracks every Friday for eleven years, so his troops are immune to terrible music: the only
soldiers on Earth who can walk up to the anthem and switch it off.

### 2.2 The enemy: the Fanfare Legion

- **Look:** crimson (`red`) tunics with gold cross-cords, white (`snow`) trousers, black (`ink`)
  boots, tall black shakos with a white plume. Every soldier wears a moustache; recruits who
  cannot grow one wear a stick-on moustache that flies off when they are hit.
- **Crest:** a gold megaphone crossed with a conductor's baton on a crimson shield.
- **Personality:** loud, vain, obsessed with rank, parades and applause. They cannot sneak (they
  hum). A Legion soldier always tries to save his instrument first.
- **Structure:** organised like an orchestra. Each **Section Leader** commands one boss:

| Section | Leader | Personality | Boss |
|---|---|---|---|
| Brass | **Commodore Blare** | shouts every sentence through a megaphone, even indoors | THE ENCORE (m1) |
| Percussion | **Colonel Rimshot** | tells terrible jokes; a rimshot plays after each one | THE BA-DUM BEHEMOTH (m2) |
| Woodwinds | **Wing Commander Puffington** | gives speeches that never end | THE WINDBAG (m3) |
| Strings | **Countess Pizzicata** | vain diva; treats every fight as her audition | THE GRAND GRAND (m4) |
| Conductor | **Grand Marshal Bombastian Fanfaroni** | tiny man, giant hat, giant voice | THE GRAND ORGAN, THE CONSOLE, THE MAESTRO (m5) |

- **Fanfaroni:** about 30 px tall, short and round, an enormous gold-and-crimson bicorne hat as
  wide as he is tall with three white plumes, huge gold epaulettes, a curled moustache whose
  points reach past his ears, white gloves, a conductor's baton. He talks through a hand
  megaphone; his lines appear in the big font.
- **Enlisted animals and robots:** the Legion's frogs, snakes, bats and goats wear tiny crimson
  caps or scarves; its robots are tin and brass with crimson paint.

### 2.3 Hostages: the critics

Fanfaroni kidnapped the music critics (and anyone who once yawned at a concert). They wear
tweed, bow ties and round glasses and carry notepads. When freed, a critic scribbles a review of
the player, holds up a card with stars and hands over a gift (section 7).

### 2.4 Mission briefings (intro card, typed in Gusto's radio box, max 2 lines)

| Mission | Line 1 | Line 2 |
|---|---|---|
| ams THE FRYING DUTCHMAN | `SHORE LEAVE IN AMSTERDAM. THE CYGNETS WANT FRIES.` | `THE BEST FRY SHOP IN TOWN NEEDS HELP. GO!` |
| m1 BRASS ON THE RIVERBANK | `THE LEGION HIJACKED THE PUDDLEWICK DUCK REGATTA.` | `FREE THE CRITICS, SINK THEIR FLAGSHIP, MIND THE DUCKS.` |
| m2 DUNE BUGLE | `THEIR DRUM CORPS IS TESTING A DRUM THE SIZE OF A HOUSE.` | `STOP IT. AND DO NOT LAUGH AT THE COLONEL'S JOKES.` |
| m3 THE HIGH NOTE | `THE WOODWINDS HAVE TAKEN MOUNT MURMUR AND ITS SKI LIFT.` | `SOMETHING HUGE AND TARTAN FLOATS AT THE TOP. DEFLATE IT.` |
| m4 OPENING NIGHT | `TONIGHT FANFARONI REHEARSES THE ANTHEM AT THE OPERA.` | `CRASH THE DRESS REHEARSAL. FORMAL WEAR OPTIONAL.` |
| m5 SWAN SONG | `THE GRAND ORGAN FLIES. THE ANTHEM STARTS AT MIDNIGHT.` | `GRAMPS SAYS THE SWAN CAN FLY NOW. ...SINCE WHEN, GRAMPS?` |

### 2.5 Running gags

- **The Metal Swan programme.** Mk1 sank in the river Wend: its head pokes out of the water in
  `m1-c`, with a rusty lifebuoy stencilled `MK1` round its neck and river weed on its dome (no
  hat of any kind). Mk2 "migrated" south; the Legion caught it, painted it
  gold and calls it THE GOLDEN GOOSE (m2 mini-boss). Gramps: `THAT IS A SWAN, YOU PHILISTINES!`
  SWAN-3 is the first one with an open seat: the pilot rides on her back (Gramps, at the Goose:
  `MK2 HAD A CANOPY. IT FOGGED UP.`).
- **The anthem's wrong note.** The *Anthem of Eternal Attention* always plays its 7th melody note
  one semitone flat. In the ending Fanfaroni plays that note on the triangle and it is still
  wrong.
- **Everything renamed.** In m4 every sign in the capital starts with FANFARONI
  (`FANFARONI LAUNDRY`, `FANFARONI BAKERY`, `FANFARONI AVENUE`). The city was called *Little
  Hushing* last year; one sign still says it, crossed out.
- **Gramps vs. accounting.** Every new Swan feature comes with `DON'T TELL ACCOUNTING.`

### 2.6 Ending (in-engine, then credits)

1. **The Last Note** (600 ticks). The Grand Organ breaks apart over the sea. Its pipes fall like
   bowling pins and each plays one note; together they play the anthem with every note wrong
   except the one wrong note, which is finally right. Fanfaroni floats down under his bicorne
   hat, which works as a parachute.
2. **Splashdown** (300 ticks). The Cygnets glide down on the Trumpeter (one on her seat, the
   other three hanging on to her neck, legs and tail). Swan Mk1 (it drifted down the river after
   m1) surfaces under Fanfaroni; he lands on its head, soaking wet.
3. **The Parade** (900 ticks, no player control, credits scroll over it). Lowmere throws a victory
   parade. The freed critics march with `5 STARS` placards. The Section Leaders do community
   service: Blare directs traffic with his megaphone, Rimshot tells a joke to a crowd that does
   not laugh (rimshot), Puffington gives a speech to a pigeon, Pizzicata sings to the parade
   horses. At the end Fanfaroni walks with the band holding a triangle. He has one note to
   play. He plays it at the wrong time. Everybody cheers anyway.
4. **Captions** (big font, centred at y 96, one at a time, 180 ticks each):
   `THE ANTHEM WAS NEVER BROADCAST.` · `THE CRITICS WERE RELEASED, AND WROTE VERY KIND REVIEWS.` ·
   `GRAND MARSHAL FANFARONI NOW PLAYS THE TRIANGLE.` · `HE IS STILL NOT VERY GOOD.` ·
   `TASK FORCE CYGNET RETURNED TO THE NEST.` · `THE END ... OF THE NOISE.`
5. Each chosen character's victory pose with their ending line (section 3), then the final
   tally (14.6), the credits (13.12) and name entry.

---

## 3. Playable characters

> **Superseded for the roster (2026-10-16):** the playable heroes are now the **squad of five
> friends** — VINCENT (THE CONSULTANT), THOM (LITTLE NAPOLEON), DIRK (THE PLUMBER), BOB (CAPTAIN
> CLIMATE), PATRICK (THE SUPERNERD) — in that select order, cosmetic only (the same stats as
> below). Looks, bios, knife props and fidgets: `docs/design/squad.md` §1 (it wins over this
> section). The four heroes below stay registered but not playable (m1–m5 code, Gramps' radio role
> in ams). Code: `src/game/content/characters/{vincent,thom,dirk,bob,patrick}.art.ts`, API:
> `docs/api/characters.md`.

All four use the shared humanoid rig (`src/game/art/humanoid.ts`, `HumanStyle`) with the **same
stats**: hitbox 14×30 standing / 16×20 crouching, the same speeds, jump, weapons and knife
damage. They differ only in look, idle (`bored`) animation, knife look (cosmetic), death
flourish, victory pose and lines. Each owns one silhouette feature that reads at 1×: Grace = beret
+ long white scarf, Mittens = bobble hat + beard + heavy build, Pip = helmet + backpack + bright
vest, Gramps = bald dome + goggles + walrus moustache. Two players may **not** pick the same
character. Rig values below are the existing `HumanStyle` options.

### 3.1 `grace` — Captain Grace Stillmere (callsign GRACE)

- **Personality:** squad leader. Unflappable, polite, dry. Says "pardon me" before throwing a
  grenade. Her run cycle is a long, smooth stride (never hurried).
- **Rig:** skin `skinC` · hair `hairA` (black), hairStyle `bob` · headgear `beret`, gear `snow`
  (ivory) · accent `snow` (scarf, buttons) · top `navy`, topType `jacket` · shirt `snow` ·
  pants `navy` · boots `ink` · gloves `snow` · belt `brown` · build `slim` · accessories
  `scarf` (long, trails 10 px behind the neck, waves in the run cycle) · face none.
- **Knife look (optional art):** a furled black umbrella, quick fencing jab.
- **Bored (after 300 idle ticks):** checks a pocket watch, nods, polishes a boot with the scarf.
- **Death flourish:** sits down neatly, folds her hands, tips over sideways (dust puff).
- **Victory pose:** crisp salute, then a tiny curtsy; the scarf flutters up.
- **Select quote:** `"PARDON ME. I'M HERE TO STOP THE MUSIC."`
- **Ending line:** `"THANK YOU, EVERYONE. YOU MAY NOW RESUME BEING QUIET."`

### 3.2 `mittens` — Sergeant Torvald "Mittens" Magnusson (callsign MITTENS)

- **Personality:** a gentle giant who almost never speaks. Knits between firefights. Every knitted
  thing in the game (the Swan's socks in m3, the goat's scarf, the `SHHH` scarf in the ending)
  is his.
- **Rig:** skin `skinA` (pink cheeks) · hair `rust` (ginger), hairStyle `short` · face `beard` ·
  headgear `bobble`, gear `snow` (cream) · accent `red` (bobble stripes) · top `red`, topType
  `sweater` · pants `stone` · boots `brown` · gloves `red` (mittens) · belt `brown` · build
  `heavy` · accessories `satchel` (knitting bag, two needles sticking out).
- **Knife look (optional art):** a two-needle knitting poke ("tik-tik").
- **Bored:** knits three rows; the yarn ball rolls away; he shuffles after it and back.
- **Death flourish:** falls backwards stiff like a tree (big dust puff); the bobble pops off and
  bounces twice.
- **Victory pose:** holds up a freshly knitted tiny swan and beams.
- **Select quote:** `"..."` then, small: `(HE NODS. HE HAS KNITTED YOU A SCARF.)`
- **Ending line:** `(HE GIVES FANFARONI A SCARF. IT SAYS SHHH.)`

### 3.3 `pip` — Private Pip Okafor (callsign PIP)

- **Personality:** the rookie. Read the whole recruitment brochure and believes every word. Far
  too excited. Collects enemy hats (tally joke line `HATS COLLECTED`, equal to infantry killed).
- **Rig:** skin `skinB` · hair `hairA`, hairStyle `curly` · headgear `helmet`, gear `steel`
  (sits low; on the `legs-land` frame it slips over the eyes for 1 frame) · accent `red` · top
  `gold` (reflective vest), topType `vest` · shirt `sky` (sleeves) · pants `sand` · boots `snow`
  (white high-tops) · gloves none · belt `brown` · build `slim` · accessories `backpack`,
  `armband`.
- **Knife look (optional art):** a frying pan, "BONK" (sfx `weapon/knife-pan`).
- **Bored:** blows a bubble-gum bubble that grows until it pops over the face; peels it off.
- **Death flourish:** spins like a top for 12 ticks; the helmet bounces off and drops back on.
- **Victory pose:** jumps and punches the air twice; the helmet falls over the eyes.
- **Select quote:** `"IS THIS THE REAL WAR? THE BROCHURE HAD MORE BALLOONS!"`
- **Ending line:** `"CAN WE DO THAT AGAIN? FROM THE START?"`

### 3.4 `gramps` — Warrant Officer Ambrose "Gramps" Fenwick (callsign GRAMPS)

- **Personality:** 71 ("seventy, and a bit"). Designed every Metal Swan. Talks to the SWAN-3 like
  a pet. Grumpy, proud, secretly very sweet.
- **Rig:** skin `skinA` (ruddy) · hair `snow` (white side tufts), hairStyle `bald` · face
  `moustache` (white walrus moustache) · headgear `goggles`, gear `gold` (brass welding goggles
  on the forehead) · accent `gold` · top `rust`, topType `jacket` (boiler suit) · shirt `rust` ·
  pants `rust` · boots `ink` · gloves `brown` · belt `brown` · build `normal` (1 px forward lean
  in idle) · accessories `pouches` (tool belt).
- **Knife look (optional art):** a big wrench swing, "CLANG" (sfx `weapon/knife-wrench`).
- **Bored:** takes a screwdriver to his boot; the boot squeaks on every step for 120 ticks.
- **Death flourish:** his dentures fly out in an arc and chatter on the ground for 20 ticks; he
  grabs them back as he falls.
- **Victory pose:** polishes his bald head with a rag; a sparkle pops; thumbs up.
- **Select quote:** `"BACK IN MY DAY, TANKS DIDN'T HAVE LEGS. THEN I GAVE THEM LEGS."`
- **Ending line:** `"RIGHT. WHO WANTS TO SEE THE MK4? IT'S A SUBMARINE. DON'T TELL ACCOUNTING."`

### 3.5 `recruit` (test character, kept)

The foundation's plain test character stays for `m0` and debugging (`?char=recruit`). It is not
shown on the select screen.

### 3.6 Shared character sprites

Every character provides the full sprite contract of ARCHITECTURE §6.1 under `char/<id>/`
(legs, torso for weapon poses `pistol` and `heavy`, `die`, `die-burn`, `victory`, `spawn`,
`bored`, `mount`, `portrait`) plus Helium Head variants of the torso strips named
`char/<id>/helium-<anim>` (4.13; e.g. `helium-torso-heavy-idle`) and `char/<id>/salute`
(2 frames, used by the continue gag). For the ridden Swan (8.2) every character (and `recruit`)
also provides nine rider strips: `char/<id>/ride-sit` 2 f (20 ticks, loop), `ride-lean` 2 f (6,
loop), `ride-up` 1 f, `ride-hunch` 1 f, `ride-hold` 2 f (4, loop), `ride-brace` 1 f, `ride-duck`
1 f, `ride-ears` 2 f (6, loop) and `ride-cheer` 2 f (8, loop) = 14 frames. Rig part `upper` (hips
up), anchored at the hip (the pelvis pixel), `weapon: 'none'`. Points `head` and `hand` only, no
`muzzle`. Both hands hold the handle grips, except in `ride-ears` (both hands open on the ears)
and `ride-cheer` (near fist raised). They are registered by `definePlayerSprites` from `RIDE_*`
tables in `src/game/art/poses.ts`. There are no `helium-ride-*` strips (Helium Head cannot
mount) and no `mount-duck` frame (`ride-duck` replaces it). Pose rules, arm targets and the
pose for each moment: `docs/design/swan-mount/look.md` §6. The knife look is a per-character
`held` prop; when the prop art is missing, draw the standard knife.

---

## 4. Core rules & controls

### 4.1 Buttons

Engine buttons `left right up down fire jump bomb start` (default keys in ARCHITECTURE §5.2).

| Input | On foot | In a ground vehicle | In the Trumpeter (flight) |
|---|---|---|---|
| left / right | walk; in the air steer (facing follows the pressed side at once) | drive | fly |
| up | aim straight up (hold; standing or in the air); **up + left/right aims 45° up** (135° facing left) with the feet planted (the side only turns the player) |  aim up (turret; the Swan's neck: up −90°, up + forward −45°, up + back −135°; up locks her facing) | fly up |
| down | crouch on the ground; aim down in the air | crouch (the Swan: crouch on the ground, duck in water, aim forward-down +45° in the air) / aim down where possible | fly down |
| fire | shoot; becomes the knife when an enemy is in melee range | main gun | main gun |
| jump | jump | hop (the Swan: a full jump; hold jump while she falls to glide) | — |
| down + jump | drop through a one-way platform (4.2) | **eject** (the Swan: jump pressed within 4 ticks after down, on the ground or in water only; 8.2) | **bail out** (= ram, 8.5) |
| bomb | throw a grenade | heavy shell | dive bomb |
| fire + bomb (both pressed on the same tick or 1 tick apart) | — | **vehicle special** | **HONK** special |
| fire + jump (both pressed on the same tick or 1 tick apart) | — | **ram** (8.1) | **bail out** |
| start | join (P2) / pause | pause | pause |

"On the same tick or 1 tick apart" means both buttons had a `pressed` edge, at most 1 tick
apart; a held button does not count. The narrow window keeps a quick jump-and-shoot from
becoming a ram by accident. Math: with one fire tap per 20-tick burst and a jump pressed at a
random tick, a 4-tick window (either order, 9 offsets) turned 9 of 20 jumps into a ram; this
window (3 offsets) turns 3 of 20, and on the Swan 2 of 20. The combo cancels nothing that
already happened (a shot or hop that started first stays). On the Swan, a jump pressed before
fire is always a plain jump: her squat starts and fire is a shot (8.2).

### 4.2 Movement (values for `src/game/tuning.ts`, from research §22.1)

| Constant | Value | Note |
|---|---|---|
| Run speed | 1.5 px/tick | crosses the 384 px view in 4.3 s; firing does not slow it |
| Run accel / brake | 0.75 px/tick² | full speed in 2 ticks; turning is instant |
| Crouch-walk | 0.75 px/tick | hold down + left/right |
| Jump | vy −3.5, gravity 0.13 | apex ≈ 47 px, 54 ticks in the air; **fixed height** (no variable jump) |
| Apex hang | gravity × 0.5 while \|vy\| < 0.6, only for jumps started standing still | standing jumps linger at the top |
| Max fall | 4.0 px/tick | |
| Air max speed / accel | 2.0 px/tick / 0.15 px/tick² | jumping is faster than walking; no air drag |
| Take-off boost | horizontal speed × 1.33 at take-off, capped at 2.0 | |
| Coyote / jump buffer | 4 / 6 ticks | |
| Landing fire lock | 2 ticks | no shot for 2 ticks after landing |
| Step-up / slopes | 4 px / up to 1:1 walkable | steeper = wall |
| Drop-through | down + jump on a one-way platform; ignored for 12 ticks | never through ground, and never through a platform over deep water (a `water` hazard rect under the player's feet: lily pads, jetties, floats, the ENCORE pontoon, the m1-b2 grates). There down + jump is a normal jump, so a crouch held into a jump never drops a player into the river |
| Hitbox | 14×30 standing, 16×20 crouching (anchor at the feet centre) | |
| Deep water (`water` hazard) | on foot: death (sink with 3 bubbles, 30 ticks) | the Swan floats and swims (8.2) |
| `pit`, `kill`, `spikes`, `lava` | death, also through invulnerability | |

### 4.3 Aiming and firing

- **Directions:** forward, **up** (up alone: straight up, standing or in the air), **diagonal
  up** (up + left/right: 45° up toward the pressed side, i.e. 45° facing right and 135° facing
  left; on the ground the feet stay planted: the side only turns the player, who brakes to a stop;
  in the air it steers as usual) and **down** (only in the air, down
  alone or with a side: straight down). There are no down-diagonals. Every weapon fires along the
  diagonal; the torso shows the diagonal frames (`torso-<w>-diag-up`, `shoot-diag-up`).
- **Grenades** keep the high **up lob** whenever up is held, also with up + left/right (no
  diagonal throw). The bounce mine (a fire weapon) counts the diagonal as forward: up +
  left/right throws it low and forward, up alone lobs it.
- **Crouch:** shots leave at crouch height (muzzle 14 px above the feet). Pressing up while
  crouched stands the player up.
- **Air facing:** in the air, shots and grenades go toward the currently pressed side (drift
  one way, shoot the other); with no side pressed, toward the facing.
- **Aim sweep** (`machine-gun`, `laser`, Swan beak gun): when the aim changes while fire is
  held, the gun turns 22.5° per 2 ticks toward the new aim, and rounds fired in between go out
  at the in-between angles (forward → up takes 8 ticks: 22.5°, 45°, 67.5°, 90°; forward →
  diagonal takes 4). (The Swan's neck turns at this rate whether or not fire is held, 8.2.)
- **Tap vs. hold:** every weapon fires on the press when its cooldown is ready; holding fire
  auto-fires at the weapon's hold rate (section 5). A press during another attack is stored for
  6 ticks and fires when possible.
- **Weapon draw:** when a pickup weapon runs dry the player switches to the pistol with a
  30-tick draw (no firing); turning, crouching or throwing a grenade cancels the draw.
- **Shot caps** (per player, for readability and performance): pistol 16, machine gun 24, other
  weapons as in section 5. At the cap a press is ignored and uses no ammo.

### 4.4 Knife and bombs

- **Knife:** automatic. When fire is pressed and a knifeable enemy hurtbox overlaps the melee
  box, the player knifes instead of shooting (section 6.2). Works with every weapon, uses no
  ammo, not in vehicles.
- **Bombs:** the bomb button throws a grenade (section 6.1); legs keep running.

### 4.5 Lives, death and respawn

- **One hit kills** a player on foot: any enemy projectile, explosion, flame, beam, crush, a
  charging enemy or a boss part flagged `contact`, and the hazards above. Walking into a standing
  infantryman does **not** kill (the player knifes him if fire is pressed).
- **Death:** 60-tick death animation chosen by damage kind (`die`; `die-burn` for fire;
  explosions use `die` with the `soot` expression), with the character's flourish (section 3).
- **Respawn:** right after the animation the new life drops from the top of the view at the
  death x (clamped 32 px inside the view; over a pit or hazard: the nearest safe ground in view)
  and lands in **12 ticks** (`spawn` animation). On landing, every enemy projectile within 64 px
  is removed with a `POOF` puff.
- **Invulnerability:** 120 ticks after landing; the sprite blinks every 2 ticks. The player can
  shoot and throw while blinking. Pits, `kill` zones and crushers still kill.
- **Lost on death:** the pickup weapon and its ammo (back to `pistol`); grenades are set to 10
  (EASY 15); the hostage tally drops by the difficulty rule (4.10); Helium Head ends; the section
  timer resets to full. Score is kept.
- **Other invulnerability:** mount animation + 20 ticks; eject (16-tick somersault + 30 ticks);
  ram eject 60 ticks; continue drop-in = respawn.

### 4.6 Lives, extends and continues

- **Lives:** 3 per credit (EASY 5). The HUD shows lives in reserve.
- **Extends:** +1 life at **500,000** and **1,500,000** points; one hidden `pickup-1up` per
  mission (the `composer` hostage, 7.2). Max 9 lives in reserve.
- **Credits option:** `FREE PLAY` (default) / `9` / `5` / `3`. Joining as P2 uses a credit.
- **Continue screen:** when a player loses the last life: `CONTINUE?` with a countdown
  **9 → 0**, 60 ticks per number; each fire or jump press removes 15 ticks of the current
  number. **start** continues: full lives, score kept, the score's last digit +1 (continue
  marker, max 9), respawn at once where the player died (no checkpoint rewind), and a `crate`
  with `M` (machine gun) drops from the top of the view onto that spot (a partner may take it).
- 1 player: the world freezes and dims to 50 % during the countdown. 2 players: the world keeps
  running and the countdown shows in the dead player's HUD corner.
- Countdown at 0 with no living player → `GAME OVER` (13.10).

### 4.7 Time limit

- Each section has a timer in **counts** (`timeLimit`, default **60**); one count = **256
  ticks** (≈ 4.3 s), so a full timer lasts about 4 min 16 s. The HUD shows the counts (2 digits).
- It resets to full at every checkpoint, at every section start and whenever a player respawns.
- At 10 the digits blink red and `ui/timer-warn` ticks once per count.
- At 0: `TIME UP!` — every living player yawns (20 ticks), falls asleep standing up (snore
  bubble) and loses a life. Then the timer resets. Vehicles are not destroyed.
- The timer pauses during intro cards, boss entrances, cutscenes, section transition fades and
  the tally.

### 4.8 Checkpoints and section changes

- Checkpoints are x positions (y positions in vertical sections) in each section table. Passing
  one (the camera edge reaches it) resets the timer, shows `CHECKPOINT` (13.7) and, on EASY,
  stores the hostage tally (4.10).
- **Exits:** every section ends in one or more exit rects. The first player to touch one takes
  the team: 30-tick fade, the next section starts, the timer resets. Weapons, ammo, bombs,
  lives, score and hostage tallies carry over.
- **Vehicle carry-over:** a player who touches an exit while riding starts the next section
  mounted in the same vehicle with the same cells and shells, **if** that section lists the
  vehicle under "Vehicles allowed" (section 11). Otherwise the vehicle stays behind. (Session
  stores `{vehicleId, cells, shells}` per player.)

### 4.9 Two-player co-op

- P2 joins at any time with start and drops in like a respawn next to P1.
- **No friendly fire.** Players pass through each other. A player can stand on a Swan's tail
  perch (8.2) or on the Bandwagon stage (moving one-way platforms).
- **Camera:** follows the midpoint of the living players, ratchets forward and never leaves a
  player out of view; when the players are more than 352 px apart the front player is held by the
  right view edge.
- Separate lives, scores, weapons, ammo, bombs and hostage tallies. Pickups go to the first
  player who touches them; a freed hostage walks to the player who freed it.
- One pilot per vehicle; wave rows tagged `[2P]` place a second vehicle.
- **2-player balance:** boss and mini-boss HP ×1.5, machine HP ×1.25, `[2P]` rows spawn.
  Everything else is unchanged.
- **Route choice:** the first player to touch an exit rect chooses for both.

### 4.10 Difficulty levels

Chosen on the mode select screen and in OPTIONS. These values, and only these, change:

| Setting | EASY "REHEARSAL" | NORMAL "CONCERT" | HARD "ENCORE" |
|---|---|---|---|
| Lives per credit | 5 | 3 | 3 |
| Grenades at each life start | 15 | 10 | 10 |
| Enemy projectile speed | ×0.9 | ×1.0 | ×1.15 |
| Enemy recovery and cooldowns (time between attacks) | ×1.3 | ×1.0 | ×0.8 |
| Telegraph durations (enemies and bosses) | ×1.25 | ×1.0 | ×0.9, never below 18 ticks |
| Boss, mini-boss and machine HP | ×0.8 | ×1.0 | ×1.25 |
| Attack tokens (4.11 rule 4) | 3 | 4 | 6 |
| Wave rows `[N]` / `[H]` | skipped / skipped | spawned / skipped | spawned / spawned |
| Hostages lost on death | those freed since the last checkpoint | **all** freed in this mission | all freed in this mission |
| Vehicle at 0 cells | the pilot is ejected automatically | the pilot must eject within 60 ticks or dies with it | as NORMAL |
| Gag double-take window | 36 ticks | 24 ticks | 12 ticks |
| Extra behaviours | none | none | `rifleman` 2-shot bursts; `cymbalist` shockwave both ways and the cymbal frisbee; bosses and mini-bosses add 1 projectile to every volley |
| Mission tally multiplier | ×0.5 | ×1.0 | ×1.5 |

Weapon ammo, item drops and scores (except the tally multiplier) are the same on all levels.

### 4.11 Fairness and comedy rules (all enemies)

1. **Gags are free time.** An enemy in a gag does not attack. It notices a player who comes
   within 160 px in front or 48 px behind, a player shot or explosion within 48 px, or an alerted
   ally within 96 px who shouts. Then it plays a **double-take** (24 ticks: looks, looks away,
   looks back, `!` bubble), 12 ticks `alert`, then its behaviour. Killing it before the
   double-take ends: **CAUGHT NAPPING** +100. Enemies that enter running skip gag and alert.
2. **Every attack is telegraphed** by a pose and a sound for at least 18 ticks (section 9 lists
   each one).
3. **No off-screen fire:** enemies attack only while their muzzle is inside the view (8 px margin).
4. **Attack tokens:** at most 4 enemies (EASY 3, HARD 6) may be in an attack telegraph or attack
   at the same time; others keep moving and wait for a token. Bosses and their parts do not use
   tokens.
5. **Contact:** only charging enemies, creatures marked "contact", moving enemy vehicles and boss
   parts flagged `contact` kill by touch.
6. **Reactions:** a player grenade landing within 36 px of an infantryman makes him `panic` (40
   ticks, runs away at 1.6 px/tick, no attacks). When a `baton-major` dies, infantry within 160 px
   are `confused` for 60 ticks (`?` bubble, no attacks).
7. **The anthem** (`anthem-speaker`, 9.3): while it plays, Legion infantry within 240 px salute:
   they freeze, cancel any telegraph, do not attack and still take damage. Players are immune.
   `windup-bot`s dance in place; other creatures are not affected.

### 4.12 Camera

- Ratchets forward (or up/down in vertical sections); the leading direction keeps the player at
  40 % of the view (`lead` 38 px). Catch-up after an unlock: max 3 px/tick, easing out.
- **While any followed player rides a Swan** (8.2): `lead` 64 px and catch-up max 4 px/tick;
  back to 38 and 3 when none does (the lead eases at 1 px/tick). Why: at her 2.6 px/tick the
  camera trails her by 4 × 2.6 ≈ 10 px (smoothing 0.2). With lead 38 her anchor sits at view
  x 192 − 38 + 10 = 164, so only 384 − 164 − 40 = 180 px lie ahead of her beak (+40 px); with
  lead 64 it sits at x 138 and 206 px lie ahead. After an unlock a 3 px/tick camera gains only
  3 − 2.6 = 0.4 px/tick on her and needs 323 ticks to settle; at 4 px/tick it needs 93 ticks.
- Arena locks: `LOCK a–b`; `UNLOCK` shows the ONWARD prompt after 90 ticks without scrolling.
- Auto-scroll (only `m5-a`): the section script moves the lock window every tick
  (`camera.lock(x, x + 384)` with x += speed) through a mission-runtime helper
  `autoScroll(speed)`; `autoScroll(0)` stops it. Players are clamped inside the view; the left
  edge pushes them and never kills.
- Screen shake: explosions 2 px / 8 ticks, big explosions 4 px / 20 ticks, boss stomps as listed.

### 4.13 Helium Head (status gimmick, `helium-head`)

One original temporary status. It changes the head and the jump, never the body.

- **Source:** the `helium-tank` prop (a 20×28 pink-and-white striped gas cylinder with a party
  balloon tied to its valve, 10 HP). Shot, knifed or blasted, it bursts into a pastel pink
  helium cloud (48×48) for 120 ticks. A player who touches the cloud gets the status. Tanks sit
  next to secret ledges and before platforming spots (section 11).
- **Look:** head and headgear drawn at 2× (`headScale = 2` rig parameter; art: scale the head
  part of the frame), with a 1 px `pink` outline; the player's sfx play at pitch × 1.6
  (`audio.sfx(id, { pitch: 1.6 })`). Announcer `"HELIUM HEAD!"`, a squeaky bubble `HI!`.
- **Effects (600 ticks):** jump vy −4.5 (apex ≈ 78 px); while falling with jump held: gravity
  0.05 and max fall 1.0 (slow float); run speed × 0.9; no crouch (the head bobs instead);
  vehicles cannot be entered (the player floats off the seat with a `?` bubble).
- **One-hit shield:** the first hit that would kill the player pops the head instead (BANG,
  confetti, `player/helium-pop`); the status ends and the player gets 60 invulnerable ticks.
  Pits, deep water, `kill` zones and crushers still kill.
- **End:** in the last 120 ticks the head wobbles and hisses. At 0: "PFFFT", the player spins
  twice in place (30 ticks, no control, invulnerable), head back to normal. Death also ends it.
- HUD: a balloon icon and a 24×2 px timer bar under the player's block (13.7).

---

## 5. Weapons

**Rules**

- Every life starts with the `pistol` (infinite ammo).
- A `pickup-weapon` gives that weapon with its **first** ammo amount. **Double-pickup rule:**
  the **same** weapon again adds its **again** amount (cap 999) and the announcer says
  `"MORE <NAME>!"` (e.g. `"MORE ROCKETS!"`; the weapon lines are the plain names, user decision 2026-10-14). A **different** weapon replaces the current one and
  its ammo.
- Ammo 0 → back to the pistol: dry click (`weapon/empty`), a comic puff from the empty weapon,
  30-tick draw (4.3). Death → back to the pistol.
- A weapon pickup touched while riding a ground vehicle is stored and given when the player
  exits (the newest one wins). In the Trumpeter every weapon pickup becomes +10 dive bombs.
- Crate letters (big font, `navy` on the round ivory weapon medallion of 7.1): **M S R F L H T B**.
- All weapons fire from the `muzzle` point of the current torso frame; pose `pistol` for the
  pistol, `heavy` for every pickup weapon.

| id | Name | Crate | Ammo first / again | Behaviour | Damage | Cooldown tap / hold (ticks) | Speed (px/tick) | Pierce / area | Pose | sfx id | Announcer |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pistol` | Service Pistol | — | ∞ | One 8×2 px yellow bullet along the aim. Crouched taps: 6-tick cooldown. Max 16 on screen. | 10 | 8 / 10 | 8 | none | pistol | `weapon/pistol` | — |
| `machine-gun` | Machine Gun | M | 200 / +150 | Tap = 4-round burst (one round per 4 ticks); hold = stream; ±1.5 px vertical jitter; aim sweep (4.3). Max 24. | 10 per round | 4 / 4 | 9 | none | heavy | `weapon/machine-gun` | `"HEAVY MACHINE GUN!"` |
| `shotgun` | Shotgun | S | 30 / +10 | Instant cone: a damage area 72 px long, 16 px tall at the muzzle and 40 px at the tip, active 6 ticks; each target is hit once per blast. Cosmetic pellets fly 6 px/tick and fade. The player is kicked back 2 px. Max 1 blast. | 150 per target | 28 / 28 | instant | every target in the cone | heavy | `weapon/shotgun` | `"SHOTGUN!"` |
| `rocket-launcher` | Rocket Launcher | R | 30 / +20 | Rocket starts at 2 and accelerates +0.3/tick to 7. It steers only vertically (≤ 1 px/tick) toward the nearest enemy ahead; it cannot turn around. Explodes on any hit or terrain. Smoke trail. Max 2. | 30 hit + 50 blast (r 16, the hit target takes both) | 20 / 20 | 2 → 7 | blast r 16 | heavy | `weapon/rocket` | `"ROCKET LAUNCHER!"` |
| `flamethrower` | Flamethrower | F | 30 / +15 | A flame stream 96 px long (rises slightly, curls down at the tip), active 24 ticks per press. Fired down from the air within 32 px of the ground it runs 128 px along the floor. Max 1 stream. | 10 per 2 ticks per target, max 12 hits per target per press | 24 / 24 | instant (stream) | pierces all | heavy | `weapon/flame` | `"FLAMETHROWER!"` |
| `laser` | Laser | L | 200 / +150 | Hold: continuous beam to the first solid or 384 px, 1 ammo per 4 ticks, lingers 6 ticks after release. Tap: a 12-tick pulse (3 ammo). Aim sweep like the machine gun. | 8 per 2 ticks per target | — (continuous) | instant | pierces all | heavy | `weapon/laser` (loop) | `"LASER GUN!"` |
| `homing` | Homing Missiles | H | 40 / +20 missiles | Each press launches 2 missiles (15° up and 15° down from the aim). Each locks the nearest enemy hurtbox within 220 px in front, turns 4°/tick, lives 120 ticks, flies straight without a target. Max 4. | 30 hit + 10 blast (r 8) | 20 / 20 | 4 | blast r 8 | heavy | `weapon/homing` | `"ENEMY CHASER!"` |
| `tuba` | Tuba (captured Legion tech) | T | 25 / +15 | A sonic ring that grows from 12 to 40 px over 40 ticks and lives 70 ticks. It hits each enemy once, **erases** every enemy bullet, note, record, egg and grenade it touches, and pushes enemies with ≤ 40 HP back 8 px. Max 3. | 60 | 30 / 30 | 2.5 | pierces all; erases enemy projectiles | heavy | `weapon/tuba` | `"TUBA!"` |
| `bounce-mine` | Bounce Mines | B | 30 / +10 | A disc mine thrown low (vx 3.0, vy −2.0, gravity 0.2) that bounces along the ground (vy × −0.6, vx kept), hops gaps up to 32 px and steps up to 12 px. Explodes on enemy contact, on the 4th landing or after 150 ticks. Aimed up: lobbed (vx 1.0, vy −4.0); aimed down in the air: dropped (vy +1). Max 3. | 30 hit + 40 blast (r 20) | 20 / 20 | 3 (start) | blast r 20 | heavy | `weapon/bounce-mine` | `"BOUNCE MINES!"` |

**Design notes.** The tuba is the comedy weapon with a real job: low damage, but the only weapon
that defends (best against the note-spray bosses of m4–m5). The shotgun is the crowd-clearer,
the flamethrower the point-blank killer, the bounce mine the answer to crawlers, creatures and
vertical shafts, the laser and homing missiles the "rare and strong" pickups (at most 2 lasers
and 2 homing per mission route). Expected damage per second (for boss tuning): pistol 75,
machine gun 150, shotgun ≈ 320 (point blank), rocket ≈ 240, flamethrower ≈ 300 per target,
laser 240 per target, homing ≈ 160, tuba ≈ 120, bounce mine ≈ 210, knife 90.

---

## 6. Bombs & melee

### 6.1 Grenade (`grenade`)

| Property | Value |
|---|---|
| Count | 10 at every life start (EASY 15); `pickup-bombs` +10; cap 99 |
| Throw | `torso-<w>-throw` (4 frames, 12 ticks); the grenade leaves the `hand` point (≈ 38 px above the feet, 8 px ahead) on tick 4. Legs keep running |
| Velocity | forward: vx = 2.1 × facing + the player's vx, vy = −1.5 · aiming up: vx = 0.8 × facing, vy = −3.5 · crouched (released 16 px above the feet): vx = 2.4, vy = −1.2 · aiming down in the air: vx = 0.5 × player vx, vy = +1.5 |
| Gravity | 0.2 px/tick² |
| Bounce | first ground contact: vy × −0.65, vx kept; walls: vx × −0.5 |
| Detonation | on the 2nd ground contact, on touching any enemy hurtbox, or after a 120-tick fuse. A standing throw lands first ≈ 60 px ahead (≈ 28 ticks) and explodes ≈ 115 px ahead (≈ 55 ticks) |
| Blast | circle r 24: **100** damage (`explosion`) to every enemy hurtbox inside (each part once); `fx/explosion-m`, shake 2 px for 8 ticks, sfx `explosion/m` |
| Limits | max 2 grenades in the air per player; 10-tick cooldown between throws |
| Comedy | infantry within 36 px of a landed grenade `panic` (4.11 rule 6) |
| Look | 6×6 round grenade, `olive` with a `gold` band and a tiny white swan stencil, 4-frame spin |
| sfx | `weapon/grenade-throw`, `weapon/grenade-bounce`, `explosion/m` |

### 6.2 Knife (`knife`)

| Property | Value |
|---|---|
| Trigger | fire pressed while a knifeable enemy hurtbox (or a knifeable slow projectile: enemy grenade, golden egg, record, barrel) overlaps the melee box |
| Melee box | 26 px ahead of the hitbox front edge × 28 px tall from the feet (crouched 26 × 18) |
| Damage | **30** (`knife`) to every knifeable target in the box (projectiles are destroyed, 50 points) |
| Timing | `torso-<w>-knife` 4 frames × 3 ticks; active on ticks 3–6; cooldown 20 ticks (≈ 3 slashes/s) |
| Knifeable | all infantry, creatures up to 40 px tall, boss and mini-boss parts flagged `knifeable` (section 10). Never machines, vehicles or the knife in a vehicle |
| Score | knife kill = **5 ×** the target's kill score (a `rifleman` gives 500) |
| Kill animation | infantry: `die-knife`, the **operatic swoon** (kneels, raises one arm, sings one note `enemy/aria`, collapses). The note rises one step of the major scale for each knife kill within 180 ticks (cosmetic) |
| Look | per character (umbrella / knitting needles / frying pan / wrench); same box and damage |
| sfx | `weapon/knife` (+ character variants `weapon/knife-umbrella`, `weapon/knife-needles`, `weapon/knife-pan`, `weapon/knife-wrench`) |

### 6.3 Vehicle heavy shells (`bomb` in a vehicle)

| Vehicle | Shell id | Behaviour | Damage / area | Cooldown | Shells in a new vehicle |
|---|---|---|---|---|---|
| `swan` | `swan-beak-shell` | fired from the beak tip along the neck angle, speed 4.0, gravity 0.06, plus the Swan's horizontal speed (×1); explodes on contact or terrain | 200 to the hit target, 100 to others in r 24 | 30 | 10 |
| `sundae-driver` | `sundae-mortar` | lobbed from the cone: vx 2.5 × facing + van vx, vy −4.0, gravity 0.15 | 150, r 24; infantry inside are frozen in ice for 90 ticks (any hit shatters them: `die-shatter`) | 36 | 10 |
| `bandwagon` | `bandwagon-drum-boom` | ground shockwave both ways from the truck, 96 px each way, 12 px tall, 3 px/tick | 100 to every grounded enemy it crosses | 45 | 10 |
| `trumpeter` | `trumpeter-dive-bomb` | dropped with the ship's speed, gravity 0.2 | 150, r 20 | 20 | 20 |

`pickup-bombs` collected while riding adds +10 shells. Shells are stored on the vehicle (an
empty vehicle keeps its count).

---

## 7. Items & hostages

### 7.1 Pickups

Items dropped by crates, hostages and enemies pop up (vy −2.0), land, bob 2 px over 40 ticks,
blink during their last 120 ticks and vanish after 720 ticks. Items placed by the level never
vanish. Touch to collect.

| id | Look (px) | Effect | Score |
|---|---|---|---|
| `crate` | 24×20 wooden supply crate, rope bands, white swan stencil; 30 HP (3 pistol shots; any knife or explosion) | breaks into planks and drops its `contains` item (else drop table `crate`) | 100 for breaking |
| `pickup-weapon` | 16×16 round ivory (`snow`) medallion with a `gold` rim and the crate letter in `navy` (big font), like a big band-uniform button; bounces when spawned (never a dark box with a yellow letter, never a winged emblem) | gives `params.weapon` (section 5) | 500 |
| `pickup-bombs` | 16×12 small crate with three grenades on top | +10 grenades (cap 99); riding: +10 shells | 500 |
| `pickup-food` | `params.kind`: `bread` (loaf 12×8), `cheese` (wedge 12×8), `teacake` (cake with a cherry 12×10), `jelly` (wobbling green jelly 12×12, 2-frame wobble), `birthday-cake` (tall cake with 3 candles 16×16) | score only; the character shows a 1-frame `chew` face | 100 / 300 / 500 / 1,000 / 5,000 |
| `pickup-gem` | `params.kind`: `golden-note` (gold eighth note 8×10, floats), `gem` (crimson cut gem 8×8), `medal` (Legion medal, crimson ribbon 10×12), `golden-record` (gold disc 14×14, one hidden per mission). With `params.float: true` (the Swan glide trails, 11.1 `m1-c` @700 and 11.3 `m3-a` @1880) it has no gravity and hangs at its placed y (its 12×12 box sits on that y) | score only, sparkle fx | 100 / 1,000 / 2,000 / 10,000 |
| `pickup-1up` | tiny tin cygnet toy 14×12 that waddles toward the nearest player at 0.5 px/tick | +1 life (max 9); announcer `"ONE MORE TRY!"` | 0 (10,000 when lives are full) |
| `pickup-repair` | 14×14 oil can with a wrench | riding: +1 vehicle cell (max = the vehicle's cells); announcer `"PATCHED UP!"` | 1,000 on foot or with full cells |

The `helium-tank` prop (4.13) and the other props are listed in 9.5.

### 7.2 Hostages (`hostage`)

All hostages are team `neutral`: they cannot be hurt and never block shots. Sprites
`item/hostage/<kind>/<anim>` with the contract anims `tied`, `freed`, `walk`, `give`, `run` plus
`bow` (2 frames) and `gag` (4 frames). Looks are rig styles:

| `kind` | Look (rig) | Gift (drop table 7.3) | Freed gag |
|---|---|---|---|
| `critic` (default) | hair `stone` `parted`, face `glasses`, top `brown` `jacket` (tweed), accent `red` + accessory `bowtie`, pants `brown`, boots `ink`; notepad prop | `table-a` | scribbles for 20 ticks, then holds up a card with 3–5 stars (`fxRng`) |
| `roadie` | build `heavy`, top `ink` `tank`, headgear `cap` (gear `ink`), hair `hairB` `short`, pants `steel`, boots `ink` | `table-b` (always a weapon) | carries the weapon out like a heavy amp case, puffs, hands it over |
| `tea-lady` | hair `snow` `curly` (curlers), top `pink` `tunic` (floral apron), pants `pink`, boots `brown`; teapot prop | `table-c` | pours a cup of tea, drinks it herself, then gives the gift |
| `tourist` | top `orange` `shirt` (palm print), headgear `rainhat` with gear `sand` (sun hat), face `shades`, pants `sand`, accessory `satchel` (camera) | `table-d` + **SAY CHEESE** | takes a photo: every non-boss enemy on screen freezes in the `photo-pose` (peace sign) for 45 ticks |
| `composer` | hidden, one per mission; hair `snow` `spiky` (wild white hair), top `ink` `coat` (tails), accessory `bowtie`, baton prop | `pickup-1up` | conducts a 4-note phrase with his eyes closed (`hostage/composer`) |
| `dollop` | m2 story hostage Mrs. Dollop: top `pink` `tunic`, headgear `cap` with gear `snow` (paper hat), hair `hairC` `bob` | the `sundae-driver` vehicle | points at her shed; the doors open and the van rolls out (m2-a) |

**Bindings** (`params.bind`):
- `chair` — tied to a folding chair. A touch, any player shot, blast or knife frees; the chair
  falls apart.
- `cage` — a cage (20×30) hangs from a rope (10 HP). Breaking the rope drops the cage, which
  breaks and frees the hostage.
- `sack` — inside a sack that hops around blindly at 0.3 px/tick inside a 48 px band. Touch frees.
- `float` — tied to the mast of a parade float (m4). Shoot both ropes (10 HP each).
- `balloon` — tied under a weather balloon drifting left at 0.5 px/tick (m5 shoot-em-up). Shoot
  the rope (10 HP): the hostage parachutes down and throws the gift up to the nearest Trumpeter.

**Behaviour** (all kinds):
1. `tied`: loop; every 120 ticks a wriggle (4 ticks of shake) and an `MMF!` bubble.
2. Freed: `freed` (20 ticks, ropes fall, a stretch), **+500** to the freeing player, +1 to that
   player's hostage tally (a bow-tie icon pops into the HUD).
3. `walk` toward the freeing player at 0.8 px/tick along the ground until within 16 px or 180
   ticks have passed (blocked by a wall or gap: stops and gives where it stands).
4. `give` (24 ticks): the gift spawns at the `hand` point (vy −2.0) and lands.
5. `bow` (12 ticks): a theatrical curtain-call bow (the critic doffs an imaginary hat). Hostages
   never salute. Then `run` off to the left at 2.0 px/tick and despawn.
6. If the freeing player is dead or gone, the hostage walks to the nearest living player.

### 7.3 Drop tables (used when the script gives `auto`; rolls use `world.rng`)

| Table | Used by | Contents (weights) |
|---|---|---|
| `table-a` | `critic` | weapon 40 (M 28, S 14, R 14, F 12, L 10, H 10, T 6, B 6) · bombs 25 · food 20 (bread 40, cheese 30, teacake 20, jelly 10) · gem 15 (gem 70, medal 30) |
| `table-b` | `roadie` | weapon 100 (M 20, S 15, R 15, F 15, L 10, H 10, T 8, B 7) |
| `table-c` | `tea-lady` | food 60 (teacake 50, jelly 35, birthday-cake 15) · bombs 40 |
| `table-d` | `tourist` | gem 70 (gem 60, medal 40) · food 30 (cheese 50, teacake 50) |
| `crate` | `crate` without `contains` | bombs 35 · weapon 25 (`table-a` weights) · food 25 · 3 × golden-note 15 |
| `officer` | `baton-major` on death | medal 100 |
| `truck` | `band-truck` on death | bombs 50 · nothing 50 |

Wave scripts give most drops exactly (`(R)`, `(bombs)`, `(1up)` …); `(auto)` rolls the hostage kind's
table (Conventions).

### 7.4 Rescue bonus and death rule

- **On free:** +500 at once.
- **Mission tally:** **10,000** per hostage in the player's tally at the end of the mission.
- **STANDING OVATION:** 1 player: +50,000 when the tally holds every hostage of the route taken.
  2 players: when the two tallies together hold every hostage of the route, each player gets
  +25,000. The critics stand up and clap on the tally screen (`env/applause`).
- **On death** (difficulty rule 4.10): the lost bow-tie icons "faint" in the HUD (each tips over
  and slides off, 8 ticks apart, `hostage/faint`). Gifts already handed over are kept. EASY
  stores the tally at each checkpoint and drops back to the stored count.
- The hostage count of every route is given in each mission header (section 11).

---

## 8. Player vehicles

### 8.1 Shared vehicle rules

- **Enter:** land on the vehicle's hatch zone (its top 16 px; on the Swan, the seat on her back,
  only 32 px up while she sits parked) while falling. Mount animation 16 ticks, invulnerable, plus
  20 ticks after. An empty vehicle shows a `RIDE?` speech bubble (the 13.7 bubble style, small
  font, its tail pointing at the hatch, 8 px above it; no arrow) while a player on foot is within
  96 px.
  A player with Helium Head cannot enter.
- **The pilot cannot be hit** while mounted; the vehicle takes all damage. In the Sundae Driver
  and the Bandwagon the pilot is drawn with the rig `mount` pose (head and shoulders in the van's
  window, upper body at the Bandwagon's bell). On the Swan the rider sits astride her back and
  shows from the hips up (`ride-*` strips, 3.6); his body counts as part of her hurtbox (8.2), so
  a shot that touches him costs her cells like any other hit. The Trumpeter's rider sits the same
  way, but only its hull is a hurtbox (8.5).
- **View:** a driven ground vehicle stays inside the view like a player on foot (its x is clamped
  half its body width from each view edge, `Camera.clampX`, as `Vehicle.keepInView` already
  does), so it can never leave a locked arena. (The Trumpeter has its own rule, 8.5.)
- **HP cells** (shown in the HUD as 8×5 boxes, half-filled allowed). Damage to vehicles:
  - small hit = ½ cell: enemy bullet, note, ring, record, dart, contact with a small creature;
  - big hit = 1 cell: explosion, shell, rocket, mortar, beam, falling piano, any boss attack,
    contact with a charging enemy or enemy vehicle;
  - crush, `pit`, `lava`, `kill` = destroyed at once (the pilot is thrown up, vy −6, with 60
    invulnerable ticks).
  After any hit the vehicle is invulnerable and flashes for 60 ticks. At ≤ 1 cell the cells blink
  red, the vehicle smokes and `vehicle/warning` beeps every 60 ticks.
- **0 cells:** the vehicle stops (guns off), flashes for 60 ticks with `vehicle/alarm`, then
  explodes (r 40, 200 damage to enemies). The pilot must eject in those 60 ticks (down + jump or
  jump) or dies with it. EASY: the pilot is ejected automatically at the end.
- **Eject:** down + jump. The pilot somersaults out (vy −3.5; 16 + 30 invulnerable ticks). The
  vehicle stays parked with its cells and shells and can be re-entered. The Swan ejects only on
  the ground or in water, and only when jump is pressed within 4 ticks after down (or on the same
  tick): a jump from a held crouch or water duck is a normal jump. In the air a jump press opens
  her wings. A Swan in water catches her own pilot again (8.2 Water).
- **Ram:** fire + jump (on the same tick or 1 tick apart, 4.1). The pilot pops out upward
  (vy −4.0) with 60 invulnerable ticks; the empty vehicle charges forward at its ram speed and
  explodes on the first enemy,
  solid or at the end of its run: **400** damage in r 40 (each target once), `explosion/l`,
  shake 4 px for 20 ticks. The vehicle is lost. Exception: the Swan's SWAN DIVE costs her 1 cell,
  not her life (8.2).
- **Special:** fire + bomb on the same tick or 1 tick apart (one per vehicle, below).
- **Pickups while riding:** `pickup-bombs` +10 shells, `pickup-repair` +1 cell, weapons stored
  for the pilot (section 5).
- **Panic:** Legion infantry within 64 px of a moving player vehicle panic (30 % chance, checked
  once per 60 ticks per soldier).
- Empty vehicles are invulnerable and ignored by enemies. Vehicles never drop through one-way
  platforms (down + jump is free for the eject).
- **Bonuses:** NO SCRATCHES +10,000 when a vehicle section ends with the vehicle at full cells
  (once per mission). VEHICLE AT THE FINISH +100,000 when the player is riding when the
  mission boss dies (possible in m1, m2 and m3).

### 8.2 `swan` — SWAN-3 "Metal Swan" (ridden)

The fastest ride and the best jumper: a robot swan that the pilot rides on her back (user
request, 16.1). Her numbers come from `docs/design/swan-mount/feel.md`, her look and the full
sprite contract from `docs/design/swan-mount/look.md`, her level use from
`docs/design/swan-mount/levels.md`; the decisions between them are in
`docs/design/swan-mount/decisions.md`. Points and boxes are (x, y, w, h) from her feet anchor
with her facing right (+x forward, −y up). Values in [brackets] come from a tick-by-tick run of
the engine step (`vy += g`, then `y += vy`); they are 3–4 % below the formulas.

| Item | Value |
|---|---|
| Look | A riveted ivory **robot** swan built by Gramps, never an animal in armour. A long, low boat hull 48×20 (`snow` ivory with `steel` shading, a `navy` waterline stripe, a navy bow number `3`, `gold` rivets) ends in an upturned tail of three blades with a navy rudder fin. A thick neck of six ivory rings on a steel hose is always curved: lowered forward like a charging goose on land, an S on water; it telescopes for back aims. A smooth ivory head has one lens eye with a steel shutter lid (her expressions) and a navy face patch; the long `orange` beak is the gun barrel. Wing plates with navy tips: the far wing stands in a low arch behind the rider, the near wing lies flush on the flank. Steel telescoping legs with a backward joint and pistons; big `orange` webbed paddles that spread and fold. The rider sits astride a low quilted navy seat pad between the wing roots and holds two brass handles; he shows from the hips up (`ride-*` strips, 3.6) and the near wing hides his legs. **Never:** plumage or soft feathers on her body (her only feathers are the stiff, stamped `fx/tin-feather` plates of her cues); a helmet, visor, goggles, crest or plume on her head; a control stick, lever or panel on her head or neck (she is steered by the two handles on the deck); a saddle frame, straps, stirrups or reins; a gun barrel or gun pod on her body; a thin straight neck, thin bare legs, two-toed feet; a gold or yellow body (16.1). Personality: she looks back at her rider, hisses before a dive, flinches when hit, and after 3 stomps without touching the ground she waggles her tail and honks. P2's swan is **the Mute** (black neck, head and beak; grey wing tips), as in 8.5. Frames, points, layers and variants: `docs/design/swan-mount/look.md` |
| Size | 77 px from the tail fin to the beak tip; 68–72 px tall with the rider (his head top about 1.9 humans up; the deck, his hip, at 48 px). Body (terrain) 28×48; crouched or parked 28×20. Hurtboxes: legs (−8, −28, 16, 28), hull (−22, −48, 40, 20), rider (−10, −66, 12, 18); crouched one box (−22, −20, 40, 20); swimming: hull (−22, −30, 40, 16) and rider (−10, −48, 12, 18); ducked in water: hull (−22, −24, 40, 12) and rider (−10, −37, 12, 15). The neck, head, beak, wings and tail are never hurtboxes. Seat (mount) zone: the top 16 px of her back, (−10, −32, 20, 16) parked and (−10, −44, 20, 16) in water. The `seat` point is the rider's hip: (−4, −48) standing, (−4, −16) crouched, (−4, −30) swimming. It places and draws the rider (`drawRide`) and starts the eject. **The driver's anchor is not the seat:** the Swan overrides `syncDriver()` so the mounted player's anchor is her own feet anchor (x, y). Enemy AI reads a player's y as his feet, so it then sees a grounded target: chest shots hit her legs and her crouch dodges them, a rifleman fires 45° up-shots only when she really is more than 40 px above him, and shots aimed at the target's centre (y − 15) hit her legs, her crouched box or her swimming hull. (With the anchor on the hip, 48 px up, every rifleman within 120 px fired 45° up-shots, which miss her beyond about 54 px (he prefers 80–160 px), and aimed shots missed her crouch by 11 px.) |
| Move | Run **2.6 px/tick**, the fastest ride (on foot 1.5, Sundae Driver 2.4, Bandwagon 1.8): she crosses the view in 384 / 2.6 = 148 ticks. Two-stage start: 0.25 px/tick² to a 1.5 trot (1.5 / 0.25 = 6 ticks), then 0.06 px/tick² to 2.6 (1.1 / 0.06 = 18.3 ticks more; full speed after 25 ticks and 45 px [engine]). Brake 0.2: 2.6 / 0.2 = 13 ticks, 2.6² / 0.4 = 17 px. Turning: instant below 1.6 px/tick. At 1.6 or more a reverse is a **SKID**: she plants her paddles, keeps firing forward and slows at 0.3 to 0.5 px/tick ((2.6 − 0.5) / 0.3 = 7 ticks, (2.6² − 0.5²) / 0.6 = 10.9 px), then flips and runs the other way; a jump cancels it. Firing never slows her. Step-up 12 px, snap-down 8 px, slopes up to 1:1. Down = **crouch**: the legs fold, the keel touches the ground and the rider lies flat (`ride-duck`); the crouched top is 20 px, so chest-high shots (22.5–25.5 px) pass over her, and the beak fires 0° from 14 px up. Down + left/right = waddle at 0.8 px/tick. Crouching at a sprint = belly slide: (2.6 − 0.8) / 0.2 = 9 ticks, (2.6² − 0.8²) / 0.4 = 15 px. Shallow water (ground less than 16 px under the surface): she wades at full speed. The run strip advances one frame per 6 px: a foot contact (dust, `swan/step`) every 24 px |
| Jump | Fixed height, like on foot. A press starts a 4-tick squat (it commits her; she keeps her speed) and she takes off on the 5th tick. Her own gravity 0.18 and max fall 5.0 (on foot 0.13 and 4.0). vy −5.9: apex 5.9² / (2 × 0.18) = **96.7 px** [93.8], 2.05 × the on-foot 47 [45]; rise 5.9 / 0.18 = 32.8 ticks; air time 66 [65] ticks; length at a sprint 2.6 × 65 = **169 px** (on foot 108). Air accel 0.1 px/tick², no drag; air speed cap = clamp(take-off speed, 1.5, 2.6), so hopping never beats running. In the air her facing follows the pressed side at once (not while up is held). Coyote 4, buffer 6 ticks: a coyote jump (pressed up to 4 ticks after she ran off a ledge) takes off at once, without the squat, and if she leaves the ground during the squat she takes off at once. Reach [engine]: from a sprint she lands on a ledge 48 px up 143 px ahead, or 80 px up 117 px ahead; up to about 90 px is in reach. From the y 176 ground line the rider's head top peaks at y 10–14 [engine]: in view. Level rule: keep what she must hit or collect below y 24 (`levels.md` §1.3). A landing after a fall of 60 px or more: `swan/land`, a dust ring, a 1 px shake for 4 ticks |
| Wings | **GLIDE**: hold jump while she falls (vy > 0). The opening flap sets vy = min(vy, −0.4): at the apex she lifts 0.4² / (2 × 0.06) = 1.3 px; in a fast fall it stops the fall at once. Then glide gravity 0.06, fall ≤ 1.0 px/tick, speed ≤ 2.2 px/tick (from 2.6 she loses 0.05 per tick: 8 ticks), at most 60 ticks (the last 12 tremble), **one glide per airtime**. Releasing jump folds the wings until she lands. A landing (ground, platform, solid or water) or a STOMP bounce gives the glide back. The flap is her only lift: no airtime rises more than 1.3 px [engine 1.1] above the jump apex. A full glide from the apex of a sprint jump: her fall speed grows to 1.0 in 1.0 / 0.06 = 16.7 ticks (1.0² / 0.12 = 8.3 px), then 36.6 ticks at 1.0 px/tick: she drops 8.3 + 36.6 − 1.3 = 43.6 px and covers 19 + 52 × 2.2 = 133 px. After the glide, with forward held, her air speed climbs back to 2.6 at her air accel 0.1 px/tick² (with no input she keeps 2.2: no drag). Sprint jump + full glide = **268 px in 112 ticks** [engine] with forward held (261 px with no input; no glide: 169 px in 65), an average of 268 / (4 + 112) = 2.3 px/tick, slower than the 2.6 run: hang time, not travel. A press within max(16, 6 × vy) px above the landing surface buffers a jump instead. A glide never stomps: release jump to drop onto a target. Cues: tin feathers burst from the wing roots (`swan/flap`), wind streaks and `swan/glide` while she glides, `swan/tired` in the last 12 ticks, `swan/fold` |
| Water | Every `water` rect floats her. Her feet ride a **float line 16 px under the surface**: a one-way floor that only she uses (ground above it wins, so she walks out where a bank rises). The hull rides the surface (keel 6 px under it, the waterline stripe on it) while the legs paddle like mad underneath: the title-screen image. **Swim 2.0 px/tick** (77 % of her run; faster than on foot): accel 0.08 (2.0 / 0.08 = 25 ticks, 2.0² / 0.16 = 25 px); with no input she drifts 25 px in 25 ticks; a reverse pivots her on the spot and brakes at 0.15 (13 ticks, 13 px). Down = **duck**: she settles 8 px lower and the rider hunches; her boxes then reach 8 px (hull) and 21 px (rider) above the surface, so chest-high shots (22.5–25.5 px above the water) pass over her; duck speed 1.0, and the beak fires 0° from 2 px above the surface. **Jump from water:** an 8-tick paddle-up (she runs on the surface, wings beating), then the same vy −5.9 from the float line: her feet peak 96.7 − 16 = 80.7 px [77.8] above the surface; length 2.0 × 65 = 130 px, so hopping averages (130 + 8 × 2.0) / (65 + 8) = 2.0 px/tick, the swim speed. The float line catches every landing in water (vy 0, a splash; the glide comes back). Water never hurts or pushes her, and ground shockwaves miss her while she swims; `pit`, `kill`, `lava` and falling below `killY` destroy her (8.1). **Eject in water:** she stops at once (vx 0). `Player.checkMount` refuses a new mount until the pilot has landed on a surface (`mountLock`), and over deep water he never lands, so **she catches him herself** (Swan-module code, no shared change): for 90 ticks after the eject, while she swims empty and in one piece, she calls her own `mount(p)` when her last pilot is falling (vy > 0) with his foot box in her water seat zone (−10, −44, 20, 16), from tick 30 on (the remount lock; never with Helium Head). Math [engine]: his feet leave at y 164 (float line 196 − 30 − 2) with vy −3.5 and gravity 0.13; they peak at y 118.6 on tick 26 and fall through the zone (y 152–168) on ticks 49–55, so the straight-up somersault lands back on her seat. Without the catch his feet would reach the drowning depth on tick 65 (y 208: the surface, y 180, is then 28 px above his feet, and `Player.checkHazards` drowns him). If he steers away he must reach a pad, jetty or island on foot. At 0 cells she never catches him (HP cells row) |
| Aim | The neck is the gun. **9 directions, 180°**: from +45° (forward-down, in the air only) to −135° (up and back over the rider) in 22.5° steps. It turns 22.5° every 2 ticks toward the input, fire held or not (0° → −90° in 8 ticks; +45° → −135° in 16); rounds fired during a turn leave at the in-between angles (4.3). Input: none or forward = 0°; up = −90°; up + forward = −45°; up + back = −135°; down in the air = +45°. Up locks her facing: up + back aims −135° while she back-pedals at 1.2 px/tick (in water 1.0). On land 0° is the low "hiss pose": the beak gun fires 24 px above the ground, so it hits standing infantry (an upright neck would fire over them). Beak-tip muzzles: 0° (40, −24); −45° (35, −58); −90° (14, −76); −135° (−12, −78); +45° (35, −15); swimming 0° (42, −23), 7 px above the surface; ducked 0° (40, −18), 2 px above it. She cannot aim straight back: the rider sits there. Ridden and idle for 40 ticks, the neck relaxes into the classic S; a fire press snaps it to the aim on the same tick |
| Ice (m3) | She wears Mittens' knitted socks (red-and-cream striped, `swan-socks` sprites). On `iceRanges` her brake and skid deceleration is 0.05 px/tick²: from 2.6 she slides 2.6 / 0.05 = 52 ticks and 2.6² / 0.1 = 68 px. Her acceleration is unchanged |
| HP cells | 3. Hits as 8.1 (small ½ cell, big 1 cell). At ≤ 1 cell she limps (every 4th step hitches) and smokes behind the rider. 0 cells: the 8.1 rule (she stops, alarms for 60 ticks and explodes); polish: a sooty swan then bursts out of the smoke and flies off (`migrate-soot`), so she never dies on screen. Either way she is lost. **At 0 cells her wings fold at once (no glide, normal gravity), and a jump press ejects her pilot anywhere, also in the air** (as the shared doomed state already does); otherwise a gliding Swan (fall ≤ 1.0 px/tick, still about 50 px up at the end of a full glide) could outlast the 60-tick window with her pilot locked in. In water she does not catch him: he must steer the somersault to a pad, jetty, island or float. With forward held his air steering carries him 96–102 px [engine] before his feet come down to jetty, island or pad height (y 168–178), and the static gaps of the `m1-c` on-foot path are at most 48 px |
| Main gun | **BEAK GUN** (`swan-beak-gun`): tap = 5-round burst, hold = stream; 1 round per 4 ticks, 10 damage (150 per second), speed 8 (at a sprint the rounds still pull away at 8 − 2.6 = 5.4 px/tick), ±1 px jitter, life 60 ticks, max 24 on screen, infinite; along the neck angle, through the in-between angles of a turn. sfx `swan/fire` |
| Heavy | **BEAK SHELL** (`swan-beak-shell`, 6.3), 10 shells, from the beak tip. The shell adds her horizontal speed, so a 0° shell always lands 113 px ahead of her: it falls √(2 × 24 / 0.06) = 28.3 ticks and moves 4.0 × 28.3 = 113 px relative to her at any speed. At −45° it is the anti-air arc (it peaks 123 px above the ground) |
| Special | **HONK** (`swan-honk`, fire + bomb): wings spread and the chest puffs for 10 ticks (in the air she hangs still, vy 0, for the wind-up; this is not the glide), then a ring shockwave grows from 0 to 128 px radius in 16 ticks (8 px/tick), centred on her hull where she was at the end of the wind-up (at a sprint she moves 2.6 × 16 = 42 px meanwhile and stays deep inside it): 80 damage to every enemy part it touches (once), erases every enemy projectile inside it, and infantry inside cover their ears (`ears`, stunned 60 ticks); the rider covers his ears too (`ride-ears`). Costs 3 shells; cooldown 240; with fewer than 3 shells a sad `swan/squeak` and nothing else. sfx `swan/honk` |
| Contact | Only the **STOMP**: she falls at vy ≥ 1.5 and her stomp box (−14, −6, 28, 10) touches the top 12 px of a soft enemy (infantry or creature), a crate or a knifeable slow projectile (enemy grenade, golden egg, record, barrel): **100 `crush`** to each (every infantry type and creature has ≤ 100 HP, so one stomp kills, `die-crush`; on a drummer it hits the body, not the drum). She bounces with vy −3.4 (3.4² / 0.36 = 32 px [30], 37 ticks) and the bounce gives the glide back; 2 px shake for 6 ticks, `swan/stomp`. Never machines, bosses or boss parts; a glide never stomps; a stomped target does not hurt her. On the ground she does not squash or trample: she passes through standing infantry (the van and the Bandwagon own the squash). Contact damage to her as 8.1 |
| Ram | **SWAN DIVE** (fire + jump, on the same tick or 1 tick apart, 4.1; if the jump edge comes first it is always a plain jump: her squat starts and fire is a shot). It starts only while she stands on ground or on a platform (a jetty or the ENCORE pontoon too). It is refused while she swims or is in the air, and at 0 cells: she shakes her head and the pilot stays seated. (In the air fire + jump is no combo: jump is the glide and fire a shot.) The pilot pops up (vy −4.0, 60 invulnerable ticks, 8.1). The empty Swan hisses for 6 ticks (wings raised, neck low), then charges with her wings beating: 0.25 px/tick² up to **3.4 px/tick** (13.6 ticks, 23 px), up to **192 px** in all (13.6 + 169 / 3.4 = 63 ticks). She tramples soft enemies on the way (100 `crush` each) and **BEAK-BASHES** the first hard enemy, a wall or the end of her run: 400 in r 40 (each target once), shake 4 px for 20 ticks, `explosion/l`, tin feathers and bolts instead of fire. Body walls (the ENCORE wall at x 2844, 10.1; the m3-a cliff wall at x 2860, 11.3) count as walls: she bashes there, and at the ENCORE bow the blast hits the boss parts inside its r 40. If the charge carries her off a platform or a bank into water, it ends there with the BEAK BASH and she floats dazed (the `dazed` strip on her float line; no new art). Over water the popped-up pilot steers back to the platform, as after any eject. It costs her **1 cell**, not her life. With 2 or more cells she bounces back (vx −1.5 × facing, vy −3.0), lands on her back with her paddles in the air and stays dazed for 180 ticks (invulnerable and ignored, like an empty vehicle), then rolls upright in 12 ticks and can be ridden again (`RIDE?`). With 1 cell left she gives everything and **migrates**: she flies off up and forward, honking (`swan/migrate`); radio bubble `GRAMPS: "SHE'LL BE BACK IN SPRING."`; she is lost. With 3 cells and no repairs: at most 3 dives, 1,200 damage |
| Empty gag | Parked, she sits like a resting bird: keel on the ground, legs stowed, head tucked on her breast; her eye follows the nearest player within 96 px. After an eject she stands for 20 ticks, looks around, then sits down with a steam sigh. Left empty for 600 ticks she "lays" one egg (once per section): a riveted ivory capsule with a gold band and a navy `3` that pops open into a `pickup-bombs`; bubble from Gramps: `SHE DOES THAT WHEN SHE'S NERVOUS.` |
| Co-op | **PERCH**: the rear deck behind the seat (14×4, its top on her hull top, mirrored when she turns) is a moving one-way platform carried with her (`world.moveSolid`, up to 2.6 px/tick). A partner stands on it on foot with all on-foot controls: a tail gunner (his own hurtbox; one hit still kills him). **Over land** it is off from the squat to the landing of every jump, so the partner simply drops to the ground (at most 48 px). **Over water** (a jump that starts while her x is inside a `water` rect: swimming, or standing on a jetty, pad, float, island or the pontoon) it stays on from the squat or paddle-up to the landing, and the partner rides along: `world.moveSolid` carries a standing rider by position and an `onGround` rider keeps vy 0, so the box never launches him. (Off, he would drop from her swimming hull top, y 166, and reach the drowning depth, y 208, 42 px lower, after about 25 ticks.) It is off during the dive, the daze and the migration. One pilot per Swan; no pillion seat |
| Appears | `m1-c` (parked at x 160; `[2P]` the Mute at x 112) · `m3-a` (cargo parachute at x 200, in socks; `[2P]` the Mute at x 152) · `m3-c` when she ends `m3-a` in one piece (SHE TOOK THE LIFT, 11.3) |

### 8.3 `sundae-driver` — the SUNDAE DRIVER (armed ice-cream van)

| Item | Value |
|---|---|
| Look | Boxy van 80×44, `pink` with mint (`teal` light) stripes, a striped awning over the serving window, four round wheels (14 px), a roof loudspeaker, and a giant ice-cream cone on the roof (24 px tall, three scoops: pink, white, `brown`) that is the turret; its cherry blinks. Painted name `DOLLOP'S`. The pilot's head shows in the driver's window |
| Size | 80×68 including the cone; hurtbox 76×36 (the cone is not a hurtbox) |
| Move | accelerate 0.08 px/tick², max 2.4 px/tick, brake 0.15; jump = suspension hop vy −3.0 (apex ≈ 35 px); the van faces its direction of travel. It cannot swim (deep water destroys it; m2 has none) |
| Aim | the cone turns toward the held direction (forward, forward-up 45°, up, back-up 45°, back) at 15° per 2 ticks and keeps its angle when nothing is held |
| HP cells | 3 |
| Main gun | **SPRINKLE GUN** (`sundae-sprinkle-gun`): rainbow sprinkles, 1 per 4 ticks, 10 damage, speed 8, infinite |
| Heavy | **SUNDAE MORTAR** (`sundae-mortar`, 6.3), 10 shells; freezes infantry |
| Special | **JINGLE** (`sundae-jingle`, fire + bomb): the van plays its jingle (`vehicle/jingle`, 8 original notes). Every Legion infantryman within 200 px drops his weapon, takes out a coin and queues in front of the van for 120 ticks (`queue` anim; no attacks; can be shot). Machines and creatures ignore it. Cooldown 900, no shell cost |
| Contact | driving faster than 1.6 px/tick into infantry squashes them (`die-crush`, 100 damage, no damage to the van) |
| Ram | the empty van rolls at 2.8 px/tick for up to 200 px playing the jingle slowed down and wobbly, then explodes into a cloud of scoops and sprinkles |
| Appears | given by Mrs. Dollop at the end of `m2-a` (rolls out to x 2260; `[2P]` a second van at x 2320). Vehicles allowed: `m2-b`, `m2-c1`, `m2-c2`, `m2-d` |

### 8.4 `bandwagon` — THE BANDWAGON (captured Legion parade truck)

| Item | Value |
|---|---|
| Look | `red` and `gold` flatbed parade truck 96×56: a cab with a chrome grille shaped like a grin, bunting flags, and a small stage on the flatbed with a giant bass drum (Pip painted a wonky white swan over the Legion crest) and a swivelling sousaphone bell (the main gun). The pilot stands on the stage at the bell (upper body visible) |
| Size | 96×56; hurtbox: cab 32×36 + flatbed 64×24 |
| Move | accelerate 0.06 px/tick², max 1.8 px/tick; jump = hydraulic bounce vy −2.4 (apex ≈ 22 px) |
| Aim | the bell has 5 angles: 0°, −30°, −60°, −90°, −120° (over the cab, backwards-up). Holding up raises it one step per 6 ticks up to −90°; up + the back direction reaches −120°; with nothing held it returns to 0° |
| HP cells | 4 |
| Main gun | **BRASS CANNON** (`bandwagon-brass-cannon`): a sonic ring every 12 ticks that grows from 10 to 24 px, speed 4, 30 damage, pierces and erases enemy bullets it touches |
| Heavy | **DRUM BOOM** (`bandwagon-drum-boom`, 6.3), 10 shells |
| Special | **CYMBAL WALL** (`bandwagon-cymbal-wall`, fire + bomb): two giant cymbals swing up in front of the cab for 60 ticks; they block every projectile from the front and deal 100 damage to anything the truck touches (once per target). Cooldown 300 |
| Contact | driving at ≥ 1.0 px/tick into infantry squashes them (`die-crush`) |
| Co-op | the stage is a moving one-way platform; the partner can stand on it and shoot |
| Ram | the driverless truck careens at 2.4 px/tick for up to 240 px while the band music plays twice as fast, then explodes into a shower of instruments (500 damage, r 48) |
| Appears | `m4-b` (parked at x 120 with a sign `NOW UNDER NEW MANAGEMENT`; `[2P]` a second at x 40) |

### 8.5 `trumpeter` — SWAN-3 flight mode "TRUMPETER"

| Item | Value |
|---|---|
| Look | The same SWAN-3 in flight, built from the parts of 8.2 (`docs/design/swan-mount/look.md` §14): the same hull, rings, head, lens eye and beak; wings open (72 px span, ivory plates with `navy` tips); legs retracted and trailing; neck stretched straight forward, its bill tip split with one bore in each half (the twin gun); the two flush vents under the wing roots opened into small jet nozzles with `fire` exhaust ("Wings AND jets. Don't tell accounting."). The rider sits astride the open seat as on the ground: `ride-lean` in flight, `ride-hold` on a dive bomb or a hard bank, `ride-ears` on HONK, `ride-cheer` when the boss dies. P2 flies **the Mute**: black neck, head and beak, grey wing tips |
| Size | about 76×64 with the rider (72×40 without him); hurtbox 28×14 (the hull only: shoot-em-up fairness). Its `syncDriver()` puts the player's anchor 15 px below the hull centre, so enemy shots aimed at the target's centre (y − 15) fly at the hull (8.2 Size) |
| Move | free 8-way flight at 2.0 px/tick (1.4 per axis on diagonals); the screen auto-scrolls; the ship stays 4 px inside the view; always faces right. No gravity |
| HP cells | 3. Touching a small enemy destroys it and costs ½ cell |
| Main gun | **TWIN BEAK GUN** (`trumpeter-twin-gun`): 2 parallel bullets 4 px apart every 6 ticks, 10 damage each, speed 9, infinite |
| Heavy | **DIVE BOMB** (`trumpeter-dive-bomb`, 6.3), 20 bombs |
| Special | **HONK** (`trumpeter-honk`, fire + bomb): as the Swan's HONK; costs 3 dive bombs, cooldown 240 |
| Eject / ram | **BAIL OUT** (down + jump, or fire + jump): the pilot somersaults off the seat and bails out under a swan-shaped parachute (ivory, with navy wing-tip panels; falls 0.5 px/tick, invulnerable, can fire the pistol forward); the empty Trumpeter flies on as a missile at 4 px/tick (400 damage, r 40). After 60 ticks a **backup Trumpeter** swoops in from the left and picks the pilot up with 1 cell and 5 dive bombs. Available again 900 ticks after the pick-up |
| Destroyed | in flight the Trumpeter **is** the player: losing the last cell costs a life; the player respawns in a new Trumpeter (3 cells, 20 dive bombs, 120 invulnerable ticks) flying in from the left edge |
| Pickups | weapon pickups → +10 dive bombs; `pickup-bombs` +10; `pickup-repair` +1 cell |
| Appears | `m5-a`; players start mounted. Final boss stage 1 is fought in it |

### 8.6 Vehicle overview

| id | Sections | Cells | Main gun | Heavy (shells) | Special | Ram speed / distance |
|---|---|---|---|---|---|---|
| `swan` | m1-c, m3-a (m3-c if she survives m3-a) | 3 | beak gun (180° neck arc) | beak shell (10) | HONK | 3.4 / 192 (SWAN DIVE: costs 1 cell; she is lost only at 1 cell) |
| `sundae-driver` | m2-a end → m2-b → m2-c1/c2 → m2-d | 3 | sprinkle gun (turret) | sundae mortar (10) | JINGLE | 2.8 / 200 |
| `bandwagon` | m4-b | 4 | brass cannon (bell) | drum boom (10) | CYMBAL WALL | 2.4 / 240 |
| `trumpeter` | m5-a + final stage 1 | 3 | twin beak gun | dive bomb (20) | HONK | bail-out missile 4.0 |

---

## 9. Enemy faction — the Fanfare Legion

### 9.0 Overview and shared rules

The Legion is a marching band turned army (2.2). One instrument and one personality per enemy
type; every attack is a sound you can learn. Legion colours: **crimson (`red`), gold, white
(`snow`), black (`ink`)**. Enlisted animals wear a small crimson cap or scarf; Legion robots are
tin (`steel`) and brass (`gold`) with crimson paint. Machines use the machine kit (plates,
rivets, treads, wheels, rotors, barrels) in crimson with gold trim, bunting and brass bells.

**Infantry rig (shared base; per-type changes in 9.1):** skin `skinA`/`skinB`/`skinC` picked per
spawn with `world.rng` · hair `hairA` or `hairB`, `short` · face `moustache` (30 % of
`rifleman`s are recruits whose moustache is drawn crooked and flies off as a separate particle
when they die) · headgear `shako`, gear `ink`, accent `snow` (white plume) · top `red`, topType
`tunic` · accessories `cross-belt` (gold) · pants `snow` · boots `ink` · gloves `snow` · build
`normal`. Standing height 38 px including the shako; hitbox 14×28 (crouch 14×18), anchor at the
feet.

**Outfit param** (`params.outfit`, a palette and headgear swap of the same rig): `parade`
(default) · `deck` (m1: headgear `cap`, gear `snow`, sailor collar) · `desert` (m2: shako gear
`sand`, sleeves `sand`) · `snow` (m3: headgear `hood`, gear `brown`, top `red` `coat`) · `night`
(m4–m5: top `ink`, accent `gold`).

**Movement:** walk 0.6 px/tick, run 1.2 px/tick. Infantry step down ledges, never climb more than
24 px, and turn to face the nearest player every 30 ticks.

**Entry modes** (`params.entry`): `walk` (default; from `R+16` / `L-16`), `run` (enters running
at 1.2, skips gag and alert), `window` (jumps out of a window opening and lands), `chimney` (pops
up from a chimney, sooty face for 60 ticks), `manhole` (pops up, pushes the lid aside),
`parachute` (crimson canopy with gold tassels, falls 0.6 px/tick, can be shot while falling; the
empty canopy floats away), `truck` (jumps off a `band-truck`), `rowboat` (two per `rowboat`; they
stand and shoot from the boat), `ski` (m3: slides in at 2.0 px/tick and crashes into a snowbank
for 20 ticks first), `skate` (m3 pond: slides; one falls flat every 90 ticks), `float` (m4: rides
a `parade-float`).

**Gags** (`params.gag`, 4.11 rule 1): `cards` (pair at a `card-table`; cards fly up on alert),
`kazoo` (practises a scale, squeaks the top note, glares at the kazoo), `shine` (polishes his
shako, admires his reflection), `rehearse` (practises a salute, knocks his shako over his eyes),
`nap` (asleep, a snore bubble grows and pops), `newspaper` (reads `THE DAILY FANFARONI`),
`ice-cream` (licks a stolen cone; m2), `snowman` (builds a snowman of Fanfaroni; it loses its
head when he is hit; m3), `queue` (waits in line; m4), plus the per-type gags in 9.1.

**Extra animations for all infantry** (in addition to the ARCHITECTURE §6.1 contract, all from
the shared rig): `double-take` (≥3f), `salute` (≥2f), `confused` (≥2f), `queue` (≥2f, holding a
coin), `photo-pose` (1f, peace sign), `ears` (≥2f, hands over ears), `die-crush` (≥3f),
`die-shatter` (≥3f), `gag-<name>` (≥4f for each gag the type uses).

**Panic look** (`panic`, 4.11 rule 6): the soldier hugs his instrument (or rifle) to his chest,
pulls his shako down over his eyes and scurries away on tiptoe (`enemy/panic`). No arm-waving and
no scream: the Legion panics quietly, it just wants to save its instrument.

**Death variants** (chosen by damage kind; all ≤ 60 ticks; corpses never block shots):
- `bullet` / `laser` / `impact` → `die`: half spin, the shako pops up 24 px and tumbles. Laser
  kills glow white and dissolve into 4 rising music notes.
- `explosion` → `die-blast`: launched in an arc (vx ±1.5, vy −3.0), soot-black (`soot`
  expression), hair frazzled, lands head-first in the ground, legs kick for 30 ticks, poof.
- `fire` → `die-burn`: runs a small circle for 30 ticks, becomes a soot silhouette with blinking
  white eyes, crumbles into an ash pile; the eyes blink twice in the pile; poof.
- `knife` → `die-knife`: the **operatic swoon** (6.2).
- `crush` → `die-crush`: flattened like a pancake, peels off the ground like paper, flutters away.
- frozen + hit → `die-shatter`: ice cubes and a surprised face that slides away.

**Enemy projectiles** are drawn brighter than player shots: the standard enemy bullet is an 8×3
brass (`gold`) pellet with an `ink` outline and flies at chest height (24 px above the shooter's
feet) unless an attack says otherwise. Notes, rings and records use `gold`, `snow` and `ink`.

### 9.1 Infantry

| id | Name | Size (w×h px) | HP | Score | Missions |
|---|---|---|---|---|---|
| `rifleman` | Brass Private | 16×38 | 10 | 100 | all |
| `drummer` | Drum Guard | 28×38 (drum 26×26) | body 30, drum 120 | 300 (+100 for the drum) | m1, m2, m4, m5 |
| `oompah-trooper` | Oompah Trooper | 26×40 | 60 | 500 | m1, m2, m4, m5 |
| `cymbalist` | Cymbal Crasher | 22×36 | 30 | 300 | m1, m2, m3, m4, m5 |
| `baton-major` | Drum Major (officer) | 18×46 (incl. hat) | 100 | 1,000 + `medal` drop | all |
| `piccolo` | Piccolo Sniper | 30×10 prone | 20 | 400 | m1, m3, m4, m5 (console Stop Pull) |
| `triangle` | Triangle Ringer (alarm) | 14×32 | 10 | 200 (+800 QUIET PLEASE) | m1, m2, m3, m4 |
| `bassoonist` | Bassoon Bazooka | 20×36 | 40 | 600 | m2, m3, m4, m5 |

Attacks are written **T** (telegraph) → **A** (attack) → **R** (recovery), in ticks.

#### `rifleman` — Brass Private
- **Look:** the base rig; a rifle with a small brass bell flare at the muzzle (weapon pose
  `rifle`).
- **Behaviour:** gag or patrol until he notices a player, then keeps 80–160 px away, uses crates
  and walls as cover, crouches at random (30 %). Shoots horizontally, or 45° up when the player
  is more than 40 px above him and within 120 px horizontally.
- **Rifle shot:** T 18 (raises the rifle; muzzle glint on the last 2 ticks) → A one bullet,
  2.5 px/tick → R 30; 90 ticks between shots (HARD: a 2-shot burst, 10 ticks apart).
- **Crouch shot:** same timing; the bullet flies 10 px above the ground (jump it).
- **Grenade:** 25 % of attack choices when the player is 40–140 px away: T 20 (lit fuse visible)
  → A arc vx 1.8 × facing, vy −3.0, gravity 0.15, the grenade flashes red/white; on landing a
  30-tick blinking fuse, then blast r 14 (knifeable while on the ground) → cooldown 180.
- **Butt swing** (player within 18 px): T 50 (rifle raised overhead, `enemy/windup`) → A a
  20×20 hitbox for 6 ticks → R 30.
- **Gags:** `cards`, `kazoo`, `shine`, `rehearse`, `nap`, `newspaper` and the mission gags.

#### `drummer` — Drum Guard
- **Look:** tall black fur busby (headgear `shako` drawn 10 px tall and wider, gear `ink`), red
  tunic, a bass drum 26×26 (white skin with the Legion crest, gold rims) strapped in front, two
  mallets.
- **Shield rule:** the drum is a separate front hurtbox (120 HP). Bullets, laser and homing
  missiles from the front hit the drum (`hit/drum`, a dull boom). The shotgun cone, flame,
  explosions, tuba rings, bounce mines and the knife hit the body; anything from behind hits
  the body.
- **Behaviour:** advances 0.5 px/tick, one step per drum beat (a beat every 30 ticks,
  `enemy/drum-hit`). In a parade column he sets the tempo: if he dies first, the whole column
  stumbles for 60 ticks (no attacks).
- **Drum charge** (player within 72 px): T 30 (drumroll, the drum shakes, `enemy/drumroll`) → A
  charges at 2.5 px/tick for 64 px (contact kills; the drum is 26 px tall: jump over) → R 40
  (dizzy, three stars circle the busby).
- **Drum broken:** his head pokes through the drum skin and he runs away at 1.4 px/tick
  (killable, no attacks).
- **Death:** the drum rolls away like a wheel (1.5 px/tick for 64 px) while he sits down dazed.
- **Gags:** `nap` (asleep on his drum), `air-solo` (air-drums with closed eyes).

#### `oompah-trooper` — Oompah Trooper
- **Look:** build `heavy`, a sousaphone coiled around the body with a 20 px brass bell facing
  forward above the head, red cheeks, headgear `cap` (gear `red`).
- **Behaviour:** walks 0.4 px/tick; attacks from 60–200 px.
- **OOMPAH:** T 36 (inhales; the body puffs +2 px; `enemy/tuba-inhale` rising) → A a sonic ring
  (grows 12 → 24 px over 40 ticks, 1.5 px/tick, range 180 px, centre 18 px above the ground;
  30 HP, shoot it down for 50) → R 60 (wheezes, wipes his brow). Jump over it or shoot it.
- **LOW NOTE:** every third blast, same telegraph: a flat ring 24×8 rolls along the ground at
  2 px/tick (jump it).
- **Death:** a long sad "bwaaa"; the tuba blows him backwards off his feet in a spin. Blast
  variant: the tuba crumples around him like an accordion.
- **Gags:** `polish` (polishes the bell), `practice` (two soft notes, then hiccups).

#### `cymbalist` — Cymbal Crasher
- **Look:** build `slim`, red and gold, two 14 px cymbals, headgear `cap` with a chin strap, big
  cartoon ears.
- **CRASH:** approaches to 48–140 px; T 32 (cymbals raised overhead shimmer,
  `enemy/cymbal-raise`) → A a ground shockwave from his feet toward the player, 10 px tall,
  2.5 px/tick, 160 px range, stopped by walls (HARD: both ways) → R 50 (his ears ring: he
  wobbles with stars — a free window).
- **Cymbal frisbee** (HARD only): T 24 → one cymbal spins out 28 px above the ground (crouch
  under it), 3 px/tick for 200 px.
- **Death:** the cymbals clap shut on his own head; blast variant: they roll away like coins.
- **Gags:** `tune` (taps a cymbal, holds it to his ear, nods), `yawn`.

#### `baton-major` — Drum Major (officer)
- **Look:** 46 px with a 14 px plumed shako (gear `snow`, accent `red`), top `gold` `tunic` with a
  white sash, accessories `epaulettes`, `cross-belt`, a huge waxed moustache, white gloves, a 12 px
  baton with a gold ball.
- **Behaviour:** stays 60–120 px behind his troops; marches in place when idle.
- **IN STEP!** (buff): every 240 ticks: T 20 (whistle in mouth, `enemy/whistle`) → riflemen
  within 120 px fire 30 % faster (cooldowns × 0.7) for 240 ticks (they bob in time; small note
  icons over their heads).
- **Baton boomerang:** T 30 (twirls the baton overhead, whoosh) → A throws it 140 px forward in a
  flat arc at 3 px/tick; it returns (hits going out and coming back; 10×10; cannot be shot; a
  tuba ring erases it) → R 30 (catch). 20 % chance (`world.rng`) he fumbles the catch and bonks
  himself: stunned 60 ticks (`enemy/fumble` "CLONK").
- **Death:** the tall hat hangs in the air for 20 ticks before it drops; the baton spins up and
  lands on his chest like a lily. Infantry within 160 px become `confused` (4.11 rule 6). Drops a
  `medal`.
- **Gag:** `twirl` (twirls, drops the baton, checks that nobody saw).

#### `piccolo` — Piccolo Sniper
- **Look:** build `slim`, headgear `beret` (gear `red`) with a long white feather, a long thin
  silver piccolo-rifle; always lies prone on rooftops, ledges and balconies (never on the main
  ground line).
- **Aim:** T 45 — a dotted crimson aim line (every other pixel) from the muzzle to the player's
  chest, with a rising whistle (`enemy/piccolo-whistle`); the line **locks** (turns solid) 12 ticks
  before the shot, so a moving player can step out of it → A one bullet at 4 px/tick along the
  locked line → R 120 (reload).
- **Gag:** `scales` (practises scales). When he notices a player he jumps, drops his piccolo off the ledge
  and takes a spare from his cap (40 extra ticks before his first aim).
- **Death:** slides off the ledge with a long slide whistle and lands off-screen ("plop").

#### `triangle` — Triangle Ringer (the alarm)
- **Look:** build `slim`, 32 px, an oversized wobbling shako, a triangle and beater, no weapon,
  big worried eyes.
- **Behaviour:** when he notices a player he rings **DING** three times, 30 ticks apart (a `DING!`
  bubble each, `enemy/triangle`; 90 ticks total). After the third ding: **ALARM** — the row's
  `alarm` list (default 3 `rifleman`) enters from the nearest view edge and `ALARM!` flashes once.
  Then he runs off and despawns.
- **Score:** 200; **QUIET PLEASE** +800 if he dies before the third ding.
- **Gag:** `counting` (counts rests on his fingers, lips moving, then proudly plays one ding — no
  alarm — and starts again). He has one job.
- **Death:** the triangle bounces off his head with a pure "ting!".

#### `bassoonist` — Bassoon Bazooka
- **Look:** headgear `goggles` (gear `brown`) plus padded ear-muffs (the only Legion soldier who
  protects his ears), a long wooden bassoon-launcher on the shoulder with a curly brass crook.
- **Behaviour:** anti-vehicle: targets a player vehicle first if one is on screen; keeps
  120–220 px away.
- **Rocket:** T 40 (kneels and aims; rising reed squeak, `enemy/bassoon-aim`) → A a rocket that
  starts at 1.0 and accelerates +0.1/tick to 3.5 px/tick, straight; 10 HP (shoot it down for
  50); blast r 12 → R 90.
- **Death:** his last rocket goes straight up and lands on his own head 30 ticks later (visual).
- **Gag:** `reed` (licks the reed, tests it, it squeaks, he frowns at it).

### 9.2 Machines (vehicles, aircraft, turrets)

Shared: at 50 % HP add smoke and a dented plate, at 25 % flames and sparks. **Spawn armour:**
machines that drive in (`oompah-tank`, `band-truck`) are invulnerable (shots ping off) until they
stop at their `stopX` or for 240 ticks, whichever comes first. Machines are not knifeable.

| id | Name | Size (px) | HP | Score | Missions |
|---|---|---|---|---|---|
| `oompah-tank` | Oompah Tank | 72×44 | 500 | 3,000 | m1, m2, m4 |
| `band-truck` | Band Truck (troop carrier) | 88×48 | 500 | 2,000 | m1, m2, m4 |
| `metronome-turret` | Metronome Turret | 32×48 | 300 | 1,500 | m1, m3, m4, m5 |
| `gramophone-mortar` | Gramophone Mortar | 40×40 | 240 | 1,200 | m2, m4 |
| `piano-bomber` | Piano Bomber | 96×36 | 400 | 4,000 | m1, m2, m4, m5 |
| `baton-copter` | Baton Copter | 48×36 | 200 | 1,500 | m2, m3, m4, m5 |
| `pipe-battery` | Pipe Battery | 64×64 (5 pipes) | 5 × 120 | 3,000 (+300 per pipe) | m4, m5 |
| `anthem-speaker` | Anthem Speaker (support) | 24×40 | 100 | 500 | m1, m2, m4, m5 |

#### `oompah-tank` — Oompah Tank
- **Look:** small crimson tank, gold trim, `steel` treads; the turret's cannon is a giant tuba bell
  (20 px wide). Hurtbox: hull 64×28 + turret 24×14. The hull top is a solid a player can stand on.
- **Behaviour:** drives in to its `stopX`, then 0.4 px/tick keeping 160–240 px from the nearest
  player; turns around in 40 ticks. With `params.maxX` it never moves right of that x (a leash:
  in `m1-c` it keeps the tank on the flat bank instead of backing down the slipway into the river).
- **Bell shell:** T 45 (the bell glows yellow and puffs) → A an arcing shell (vx 2.2 × facing,
  vy −2.5, gravity 0.12), blast r 18 → R 80.
- **Bass pulse** (player within 64 px): T 24 (the hull rumbles, dust) → A a ground shockwave 48 px
  each side, 10 px tall (jump) → R 40.
- **Death:** the bell flips up and plays three sad descending notes (`machine/sad-notes`), then
  the tank explodes. The smoking wreck stays as a solid block 56×20 for 600 ticks (cover and a
  step). A crewman (`tank-crewman`: infantry rig, 10 HP, no attacks) pops out of the hatch and
  scurries off in the panic pose (100 if shot).

#### `band-truck` — Band Truck
- **Look:** crimson truck with gold trim; its back is a small stage with seated bandsmen.
- **Behaviour:** drives in at 2.0 px/tick (from `R+48` unless the row says `L-48`) to its
  `stopX` (brake screech), unloads its `cargo` (default 3 `rifleman` + 1 `cymbalist`) one every
  20 ticks (`entry: 'truck'`), honks a two-tone horn, and after 300 ticks reverses out at
  1.5 px/tick. Contact while moving crushes. No weapon.
- **Death:** explodes; instruments rain down (cosmetic: drums, horns, and one triangle that
  "tings" on landing). Drop table `truck`.

#### `metronome-turret` — Metronome Turret
- **Look:** a pyramid-shaped wooden metronome (crimson, gold numbers) mounted upside down on
  ceilings and under bridges (param `floor: true` stands it upright on the ground); its pendulum
  is the gun.
- **Pattern:** the pendulum swings between −50° and +50° from straight down (up when on the
  floor); one swing takes 60 ticks. It glows for the last 18 ticks before each extreme and
  ticks or tocks there (`machine/metronome-tick` / `-tock`); at each extreme it fires a 3-bullet
  burst along the pendulum (2.5 px/tick, 6 ticks apart). **Accelerando:** after 600 ticks alive
  the sliding weight moves down (visible) and a swing takes 45 ticks.
- **Death:** the pendulum snaps and twangs away, spinning.

#### `gramophone-mortar` — Gramophone Mortar
- **Look:** a wooden box with a big brass flower horn.
- **Attack** (every 150 ticks): T 50 (the horn swivels to aim for 30 ticks, then a needle-drop
  scratch for 20, `machine/scratch`) → A lobs a spinning vinyl record (12 px) in an arc that lands
  at the player's x (vx ≤ 3, vy −3.5, gravity 0.15); on landing it rolls at 1.5 px/tick for
  96 px (6 px tall: jump it) and shatters. A record has 10 HP (50 points) and is knifeable.
- **Death:** the horn falls off and spins like a top; the box plays a slowed-down tune for 60
  ticks.

#### `piano-bomber` — Piano Bomber
- **Look:** a fat, slow twin-prop plane with high wings, crimson and gold, a bomb bay.
- **Behaviour:** crosses the screen at 1 px/tick at y 24–48 (direction per row); drops up to 3
  grand pianos per pass, each near the nearest player.
- **Piano drop:** T 50 (the bay opens; a shadow grows on the ground under the drop point; falling
  whistle `machine/piano-whistle`) → A the piano falls (acceleration 0.25) → impact: crush zone
  32×24, comic chord "PLONK" (`machine/piano-crash`), dust. The landed piano stays as a solid
  32×24 for 600 ticks (cover and a step), then collapses into a pile of keys. On deep water the
  pianos float (bob ±2 px) as moving platforms for 600 ticks.
- **Flight mode** (`params.mode: 'air'`, m5-a): pianos fall through the whole screen; a `!`
  marker blinks at the top edge 40 ticks before each drop.
- **Death:** the plane wobbles and drops its last piano on itself.

#### `baton-copter` — Baton Copter
- **Look:** a one-seat gyrocopter whose rotor is a giant spinning conductor's baton; the pilot
  wears a flying helmet with a plume.
- **Behaviour:** flies in, hovers 60–90 px above the ground and moves to a new spot every 120
  ticks (1.2 px/tick).
- **Note spread:** T 24 (the pilot raises his stick; rotor pitch rises) → A 3 note-bullets at
  60°, 90° and 120° (forward-down, down, back-down), 2 px/tick → R 60.
- **Flight mode** (`params.mode: 'air'`): flies level and aims the 3-note spread at the player
  (±15°).
- **Death:** spins down like a sycamore seed and crashes; the pilot parachutes out holding his hat.

#### `pipe-battery` — Pipe Battery
- **Look:** a wall emplacement of 5 brass organ pipes of different heights.
- **Attack** (cycle 180 ticks): the pipes light up in chord order; each glows for 30 ticks, then
  fires a note-rocket straight up that comes down near a player; a shadow grows on the ground for
  40 ticks before the impact; blast r 14. Each pipe is a part with 120 HP; the battery dies when
  all 5 are gone.

#### `anthem-speaker` — Anthem Speaker (support)
- **Look:** a lamp post with a crimson loudspeaker horn and a small portrait of Fanfaroni.
- **Behaviour:** every 900 ticks (or on a script command) it crackles for 30 ticks (a `♪` bubble,
  `machine/anthem-crackle`), then plays the anthem for 180 ticks (`env/anthem-sting`). Effect:
  4.11 rule 7. If it is destroyed while playing, the saluting soldiers stay frozen 60 more ticks,
  looking at each other. (Players often leave it standing: that is the joke.)

### 9.3 Creatures

| id | Name | Size (px) | HP | Score | Contact kills | Missions |
|---|---|---|---|---|---|---|
| `bullfrog` | Baritone Bullfrog | 28×20 | 40 | 400 | no (pushes) | m1 |
| `windup-bot` | Wind-Up Bandbot | 16×18 | 20 | 100 | only when exploding | m1, m2, m3, m4, m5 |
| `rattler` | Maraca Rattler | 48×16 (coiled 28×24) | 60 | 600 | when lunging | m2 |
| `echo-bat` | Echo Bat | 20×14 (wings 24) | 10 | 200 | yes | m3, m5 |
| `ram-goat` | Avalanche Goat | 36×32 | 80 | 800 | when charging or leaping | m3 |
| `usher-bot` | Usher-Bot | 24×36 | 60 | 700 | no | m4, m5 |
| `kazoo-drone` | Kazoo Drone | 16×12 | 10 (20 in flight) | 100 (+1,000 FULL SET) | yes | m4, m5 |

#### `bullfrog` — Baritone Bullfrog
- **Look:** `olive` frog with a big yellow (`gold`) throat sac and a tiny crimson Legion cap.
- **Behaviour:** hops toward the player every 60 ticks (48 px wide, 40 px high arc); sits on lily
  pads and walkway edges.
- **Croak:** T 40 (the throat sac inflates, `creature/croak-build`) → A a low ring rolls along the
  ground at 2 px/tick for 120 px (10 px tall: jump) → R 40.
- **Tongue** (player within 40 px): T 20 (eyes bulge) → A the tongue shoots 40 px straight in 8
  ticks (kills) → R retracts in 12.
- **Death:** inflates and pops into bubbles, leaving a small dizzy normal frog that hops away.
- **Gag:** catches a fly with its tongue and burps one tiny note.

#### `windup-bot` — Wind-Up Bandbot
- **Look:** a tin robot with a big wind-up key on its back and a tiny drum on its chest; brass
  and crimson.
- **Behaviour:** marches in lines of 3–6 at 0.8 px/tick, in step; walks off ledges and keeps
  marching; turns at walls; dances in place during the anthem.
- **Self-destruct** (player within 24 px): T 30 (stops; the key spins fast; it shakes; rising
  ratchet `creature/windup`) → A explodes, r 16 (it dies). It can be shot during the telegraph.
- **Variants** (`params.variant`): `walk` (default), `ski` (m3: tiny skis, 1.6 px/tick downhill),
  `fly` (m5: a propeller key; flies straight at 1.5 px/tick; contact kills; no self-destruct).
- **Death:** springs and cogs pop out; the key flies off spinning.

#### `rattler` — Maraca Rattler
- **Look:** a big desert snake, `sand` with an `orange` diamond pattern, a maraca for a tail rattle.
- **Behaviour:** hides in the sand (two eyes and a twitching mound show). Wakes when a player is
  within 96 px.
- **Lunge:** T 45 (rises and rattles, "chk-chk", `creature/rattle`) → A lunges 72 px forward in
  12 ticks (contact kills) → R 50 (dizzy, tongue out), then burrows again for 60 ticks.
- **Death:** ties itself in a knot, rattles one last time, poof.

#### `echo-bat` — Echo Bat
- **Look:** small `purple` bat with enormous ears.
- **Behaviour:** hangs from the ceiling singing little notes (gag). Disturbed (a player within
  96 px or a shot nearby) it flies a sine path toward the player (1.5 px/tick, amplitude 24).
- **Dive:** every 120 ticks: T 20 (it flashes white, `creature/bat-screech`) → A dives at the
  player's position at 3 px/tick → R climbs back.
- **Death:** a puff; it falls with X eyes.

#### `ram-goat` — Avalanche Goat
- **Look:** white mountain goat with curling horns and a crimson knitted scarf (the Legion
  mascot). The first time a player meets one, a bubble over Mittens (if he is in the game):
  `NICE STITCHING.`
- **Charge:** T 40 (paws the ground and snorts, dust) → A charges along its ledge at 3 px/tick,
  jumping gaps up to 32 px; hitting a wall stuns it for 60 ticks (stars; takes ×2 damage) → R 40.
- **Leap-down:** T 30 (a shadow appears on the lower ledge) → A leaps down onto it.
- **Death:** tumbles, horns stuck in the snow, legs kicking; poof.
- **Gag:** chews a Legion flag.

#### `usher-bot` — Usher-Bot
- **Look:** a robot theatre usher: crimson uniform, pillbox hat, a flashlight arm and a
  ticket-punch arm.
- **Behaviour:** patrols at 0.5 px/tick with a visible yellow flashlight cone (96 px long, 30°).
- **Shush:** a player inside the cone → T 30 (`SHHH!` bubble, the beam turns crimson,
  `creature/shush`) → A 3 ticket darts in a narrow spread (±8°) at 2.5 px/tick → R 60.
- **Death:** its head spins, it prints a long paper receipt that reads `ADMIT NONE` and folds up.
- **Gags:** checks an imaginary ticket; polishes its flashlight.

#### `kazoo-drone` — Kazoo Drone
- **Look:** a flying kazoo with two tiny propellers.
- **Formations** of 5 (`params.formation`): `v` (a V, 16 px spacing, enters from the right at
  1.5 px/tick and crosses), `sine` (a line 20 px apart, y = base ± 24·sin(t/30)), `loop` (enters,
  flies one loop of radius 64, leaves), `dive` (hovers at the top for 60 ticks, then each dives at
  the player's position at 2.5 px/tick). A formation killed in full gives **FULL SET** +1,000.
- **Shot** (drones with `params.shooter`): T 20 (buzzes higher and glows) → A one slow note
  bullet at 1.5 px/tick aimed at the player.
- **Death:** pops into confetti.

### 9.4 Mini-bosses

Each mini-boss fight locks the camera, shows `WARNING!` + its name (13.7), plays `mini-boss`
and resets the timer. 2 players: HP ×1.5. Part score 1,000 each.

#### `golden-goose` — THE GOLDEN GOOSE (end of `m2-b`)
- **Concept:** Swan Mk2, which "migrated" south, was caught by the Legion, painted gold and
  renamed. Gramps (if playing) bubble: `THAT IS A SWAN, YOU PHILISTINES!`, then
  `MK2 HAD A CANOPY. IT FOGGED UP.` (it explains SWAN-3's open seat).
- **Look and size:** like the SWAN-3 but bigger, 96×96 standing: gold hull with crimson trim, a
  crimson plume on the head, a Legion pilot in a shako under Mk2's enclosed glass canopy (its own
  trait: SWAN-3 is ridden on an open seat), a nest of crates around it.
- **Parts:** `neck` 800 (destroying it ends Neck Lash and Honk Ring), `hull` 2,000 (the core;
  hurtbox 60×36; the stage ends when it breaks).
- **Attacks** (cycle A, B, C, D with 60-tick gaps; Goose Step only when a player is on the
  ground within 160 px):
  - **A Egg Drop:** T 40 (squats and wiggles) → 3 golden egg-bombs roll toward the player at
    1.5 px/tick (12×14, 20 HP each, knifeable; explode on contact or after 120 ticks, r 16) → R 40.
  - **B Neck Lash:** T 30 (the neck pulls back) → the neck sweeps from −60° to +20° over 40 ticks
    and fires 6 shots (2.5 px/tick) → R 40.
  - **C Goose Step:** T 20 (lifts a leg high) → stomps 32 px toward the player 3 times; each
    stomp sends a ground shockwave 32 px each way, 8 px tall (jump) → R 40.
  - **D Honk Ring:** T 50 (the chest puffs, `boss/goose-wiggle`) → a ring of 8 slow notes
    (1.5 px/tick) with clear gaps → R 40.
- **Arena:** `LOCK 3216–3600` (flat sand, two low dunes 16 px high as cover).
- **Death:** it sits down, sighs and lays one last golden egg; the egg cracks open and a
  `pickup-repair` and a `pickup-bombs` pop out. The pilot runs off. Score 15,000.

#### `big-head` — THE BIG HEAD (end of `m4-a`)
- **Concept:** a propaganda blimp shaped like Fanfaroni's head.
- **Look and size:** 160×120; the bicorne hat is the top fin, the moustache tips are gun pods, a
  loudspeaker is in the mouth and a small gondola hangs under the chin. Its top edge bobs between
  y 4 and y 20, so the chin stays 36–52 px above the ground (players can walk under it); it drifts
  left and right at 0.5 px/tick inside the arena.
- **Parts:** `moustache-left` 500, `moustache-right` 500, `mouth-speaker` 800, `head` 1,500 (the
  core; takes half damage while the mouth speaker lives).
- **Attacks** (cycle A, B, C with 50-tick gaps; D on its own timer):
  - **A Moustache Volley:** T 30 (the tips curl up) → each living tip fires 3 aimed bullets
    (2.5 px/tick, 8 ticks apart) → R 40.
  - **B Propaganda Drop:** T 24 (a hatch in the hat opens) → 8 harmless leaflets flutter down,
    mixed with 2 leaflet-bombs marked with a crimson X (they explode on the ground, r 12; shoot
    them in the air for 100 each) → R 40.
  - **C ATTENTION!:** T 40 (the mouth opens; big text `ATTENTION!` on the blimp) → a visible sonic
    cone straight down (64 px wide at the ground) for 30 ticks — step out of it → R 50. Skipped
    when the mouth speaker is destroyed.
  - **D Paratroopers** `[N]`: every 600 ticks 3 `rifleman` parachute from the gondola.
- **Arena:** `LOCK 2416–2800` (the plaza).
- **Death:** deflates with a long raspberry (`boss/deflate`), loops around the screen twice and
  lands draped over a statue of Fanfaroni like a rubber mask. Score 20,000.

### 9.5 Props and support entities (not counted as enemies)

Props that can be damaged are on the `enemy` team (not knifeable unless noted); they never shoot.

| id | Look and size (px) | HP | Score | Behaviour |
|---|---|---|---|---|
| `helium-tank` | pink-and-white striped gas cylinder with a party balloon, 20×28 | 10 | 100 | bursts into a helium cloud 48×48 for 120 ticks (4.13) |
| `statue-head` | gold head of a Fanfaroni statue on a plinth, 24×24 | 50 | 500 (VANDALISM) | knocked off, rolls 64 px at 1.5 px/tick, crushes infantry it rolls over |
| `breakable-wall` | cracked wall or door, 24×48 (param `w`, `h`) | 200 | 100 | hides secrets; cracks show after the first hit |
| `rolling-drum` | bass drum rolling on its side, 24×24 | 40 | 100 | rolls 2 px/tick downhill or along the floor; contact kills |
| `spring-awning` | striped bounce awning (variant `net`: a Legion training net), width per row | — | — | landing on it launches vy −6.0; placed across pits so a fall bounces back up |
| `duck-float` | giant rubber regatta duck 32×20 | — | — | moving one-way platform; drifts ±(distance in the row) at 0.5 px/tick, bobs ±3 px |
| `lily-pad` | lily pad 24×6 | — | — | static one-way platform at water level |
| `card-table` | folding card table, 20×12 | — | — | decor for the `cards` gag |
| `air-jet` | warm air from a pipe, 24 wide (param `h`) | — | — | pushes players up 1.5 px/tick while inside (slows falls) |
| `parade-float` | tuba or drum parade float, 96×40 | 300 | 1,500 | moving solid platform driving left at 0.5 px/tick; riders and `float` hostages |
| `cable-car` | cable-car cabin floor 64×8 | — | — | moving one-way platform on a path; starts when a player stands on it |
| `bellows-platform` | brass-and-leather bellows, 64×12 | — | — | moving one-way platform; rises and falls 24 px every 120 ticks (in time with the music) |
| `icicle` | hanging icicle, 8×24 | 10 | 50 | plays one note when shot (the m3-b2 icicle organ) |
| `willow-tree` | giant willow with a red target ring on the trunk base, 64×120 | trunk 200 | 1,000 | falls in 40 ticks (`env/timber`) and becomes a solid bridge 160×12 (m1-c); crushes the enemies it lands on; a player or a Swan under it is pushed out to the nearest side, unhurt (a swimming Swan's 48 px body reaches 32 px above the water, so the bridge at y 170 would crush her) |
| `avalanche` | rolling snow wall 64×216 with tumbling snowballs | — | — | chases (m3-a): every tick its front moves by clamp(target − front, `speed`, `maxSpeed`) px, where target = min(view left + `holdX`, the rearmost living player's x − `gap`); so it holds the left part of the view at any player speed but gains on a player only at `speed`. Its leading 24 px are a `kill` zone; it swallows enemies (a hat pops out, +200 SET PIECE each); at `stopX` it stops and its kill zone switches off |
| `rising-water` | meltwater surface band, full width | — | — | a `kill` rect whose top rises at its speed (m3-b2) |
| `rowboat` | wooden rowboat 48×12 | 40 | 200 | carries 2 riflemen on water; sinks when empty or destroyed |
| `tank-barge` | log raft 96×12 | — | — | moving platform carrying an `oompah-tank` (m1-c) |
| `subway-train` | 400×40 train | — | — | moving `kill` zone on the m4-c1 track bed, 6 px/tick (telegraph in the wave table) |
| `drum-barricade` | wall of drums 32×64 | 600 | 2,000 | solid; blocks the m4-b exit until destroyed |
| `chandelier` | crystal chandelier 32×24 | — | — | m4 boss prop (10.4) |
| `wreck-block` | console wreckage 24×32 | — | — | m5 boss prop: solid cover (10.5) |

---

### 9.6 Amsterdam locals (mission `ams` only; not Legion)

Spec: `docs/design/amsterdam.md` §2, API `docs/api/locals.md`. One-hit melee kills, GDD 4.11
fairness (tell ≥ 18 ticks in view, attack tokens, only the attack box kills).

| id | HP | score | in short |
|---|---|---|---|
| `fatbike-youth` | 20 (pair 30) | 300 (500) | fat-tyre e-bike, brakes near the player, wheelie + `OI!` (T 24), a shin kick (jump it); gag `circles`; `pair` = a passenger kicks |
| `delivery-rider` | 10 | 200 | fast pass at 2.2 px/tick, `TRING TRING!` (T 20) in view, a kick while passing; `from: 'behind'`; drops `pickup-food` |
| `seagull` | 10 | 150 | perches on lamps / roofs (`perch`), steals fries (`gag: 'fries'`), `KAW!` (T 20) then a dive (contact only while diving); `flock: n` |
| `handhaver` | 20 | 300 | walks in, licks the pencil (T 24), throws a fluttering `boete-ticket` at chest height (crouch it); sections `c`, `d` and the boss adds |

Friendly NPCs and city life (`missions/ams/entities.ts`): the Fabel Friet baker (the briefing),
the hot-dog vendor (salutes), the staff (the finale), tour boats, rideable `ams-boat-platform`s,
background cyclists, pigeons, window wavers; breakable stalls and bike racks.

## 10. Bosses

### 10.0 Shared boss rules

- Each boss is a multi-part `Boss` entity (`bosses/mN/`). Parts have their own hurtboxes and HP.
  A destroyed part explodes (`fx/explosion-m`, `boss/part-break`), leaves a smoking stump and its
  attacks stop. **Required** parts must be destroyed to end the fight; **optional** parts give
  their part score and remove attacks.
- Damage states per part: clean → smoke and dents (≤ 50 %) → sparks and flames (≤ 25 %). Every hit
  flashes the part white for 2 ticks. Sprites `boss/<id>/<part>-<state>` with state `0`, `1`, `2`.
- Every attack is **telegraph → attack → recovery** (ticks below are NORMAL; 4.10 scales them).
  Recovery is always a safe window: no new attack starts during it.
- **Phase changes** play a 60-tick **intermission gag**: the boss and the players are
  invulnerable and enemy projectiles on screen fade out.
- **Intro:** camera lock, `boss/warning` klaxon, music `boss` (m5: `boss-final`), banner
  `WARNING!` with the boss name and subtitle (13.7) for 120 ticks while the boss enters. The
  timer resets to 60 and is paused during the intro.
- **Boss bar:** shown in boss fights (option, default ON, 13.7): the sum of the remaining HP of the
  required parts.
- Each arena holds one weapon crate (in the mission script).
- **Score:** the boss score on death, 1,000 per destroyed part, BOSS SPEED BONUS in the tally
  (14.4). 2 players: HP ×1.5. HARD: +1 projectile in every volley.

| Boss | Skill tested | Spectacle hook |
|---|---|---|
| `encore` (m1) | jump-or-crouch reading, hopping on floating platforms | a riverboat that keeps coming back for an encore |
| `ba-dum-behemoth` (m2) | shield timing, jumping shockwaves | a drum kit on treads; its jokes are free windows |
| `windbag` (m3) | moving against wind, shooting down homing notes | a bagpipe airship that never stops talking |
| `grand-grand` (m4) | using height, reading falling hazards | an opera premiere with falling chandeliers |
| `grand-organ` (m5) | shoot-em-up dodging | a flying cathedral organ |
| `organ-console` (m5) | reading the sheet-music lanes | the telegraph is the score itself |
| `maestro` (m5) | using cover | a tiny man with a giant scream |

### 10.0a ams — `ams-mayor` — ROBO-HALSEMA, THE IRON MAYOR

Spec `docs/design/amsterdam.md` §3, code `src/game/content/bosses/ams/`. A ~140 px walking robot
caricature with a recognisable likeness of the burgemeester (big wavy dark-brown hair as a wig
over a steel skull, arched brows, red lips, a gold disc earring, a cream boucle jacket over a
crimson blouse, the chain of office with the city-arms medallion). Parts:
`stamp-arm` 1,200, `chain` 1,050, `medallion` 1,350 (core, armoured until the arm and the chain
are broken), optional `head` 750 (the brief's HP ×3: 60–120 s for a pistol + grenade player).
Phase 1 STAMP SLAM (T 30, floor waves) + LETTER RAIN (T 24) + `handhaver` adds (≤ 3); phase 2
CHAIN WHIP high / low (T 28, 124-px lash) + gull flocks; phase 3 SHIELD FAN (T 24; 5 shots at 6/12/30/54/72°
below the horizon, HARD + 42°: safe lanes standing 149–189 px and crouching 69–80 / 149–236 px in
front of the muzzle) and a 48 px STOMP (shadow, T 24) + rider passes. **Arena:** `LOCK 896–1280`
in front of the Stopera, a weapon crate at 960, a body wall 100 px in front of her while the arm
or the chain stands (a 45° shot reaches the chain), 60 px once both are broken (the medallion).
**Death:** the wig flies, the head boings, she sits and powers off. Score 20,000 + parts. Then
the baker and the staff cheer (`FABEL FRIET / BLIJFT OPEN!`).

### 10.1 m1 — `encore` — THE ENCORE (Commodore Blare)

- **Concept:** a paddle-steamer warship with a steam calliope on deck and a giant brass foghorn
  at the bow. It refuses to stay beaten: every phase starts with the riverbank crowd chanting
  `ENCORE!`. Subtitle: `COMMODORE BLARE WILL NOT LEAVE THE STAGE`.
- **Look and size:** 288×150 overall. Hull 288×56 (crimson, gold trim, white railings); two
  funnels shaped like trumpet bells (gold); a 6-pipe calliope on the deck (brass, 10–30 px tall); a
  big foghorn at the bow (gold, 40×28); a red paddle wheel at the stern (64 px across); the bridge
  window with Commodore Blare (white captain's cap, megaphone, mutton chops). Phase 1: the bow faces
  the player (bow at view x ≈ 232, just past the pontoon's end at view x 224; the rest past the
  right edge). Phase 2: it turns around behind a splash cloud (sprite flip), so the stern and the
  wheel face the player.
- **Arena (`m1-c`):** `LOCK 2616–3000`. Floating pontoon (one-way platform) x 2616–2840 at y 176;
  deep water elsewhere (surface y 180). Two floating crates (one-way, 32 wide) bob ±4 px at
  (2700, 150) and (2760, 136). An invisible body wall at x 2844 (y 0–216) stands from the boss
  entrance to the death sequence. It stops players and Swans, never shots, so nothing swims under
  the boat or jumps or glides onto its deck (a 97 px jump from the pontoon would reach the
  calliope); for a SWAN DIVE it counts as a wall (8.2 Ram). The pontoon covers the whole arena
  left of the bow, and a Swan's view clamp and this wall keep her over it. A Swan that arrives
  swimming swims in front of the pontoon (it is drawn behind actors, and a one-way platform does
  not block her from below: her feet on the float line, y 196, stay under its top, y 176) and
  ducks the high waves. Once she jumps, she lands on the pontoon (vehicles never drop through
  platforms) and fights from it for the rest of the fight. Riding a Swan, every attack still
  reads: she jumps the low foghorn wave and crouches (on the pontoon) or ducks (in the water)
  under the high one; she jumps the Paddle Wave, jumps or crouches the Slide Shot like a player,
  and stomps barrels. (A jump pressed out of her crouch or duck stays a jump, 8.1 Eject.)
- **Parts:** `horn` 1,100 (bow; required) · `calliope` 1,300 (deck; required) · `wheel` 1,600
  (stern; required; exposed from phase 2). Total 4,000.

**Phase 1 "First Act"** (until `horn` and `calliope` are destroyed). Cycle A, B, A, B; C on its
own timer. If one part dies, the other's cooldowns × 0.8.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| A Steam Scale (calliope) | 40: the pipes puff steam low to high with a rising scale (`boss/calliope-scale`) | 6 steam notes, one every 8 ticks, arc onto the pontoon at the player's x −48, −24, 0, +24, +48, then the player's current x; each leaves a lethal 24×16 steam puff for 20 ticks | 60 |
| B Foghorn (horn) | 50: the horn tilts down or up, glows, a rising toot (`boss/foghorn`) | a sonic wave 16 px tall crosses the pontoon right to left at 3 px/tick: the low wave covers 0–16 px above the deck (jump), the high wave 22–38 px (crouch: the crouched hitbox is 20 px tall) | 40 |
| C All Hands `[N]` | — | every 600 ticks 2 `rifleman` (`outfit: deck`) jump from the deck onto the pontoon at x 2800 | — |

**Intermission:** Blare through the megaphone: `THAT WAS ONLY THE FIRST ACT!`; the crowd chants
`ENCORE!`; the boat reverses into a splash cloud and comes back stern first.

**Phase 2 "Encore"** (`wheel` ≥ 800). Cycle D, E, F.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| D Paddle Wave | 60: the wheel spins up (blur, spray, rising whoosh) | a water wave 24 px tall rolls across the pontoon right to left at 2 px/tick (jump it; vehicles take a big hit) | 50 |
| E Barrel Roll | 24: a deckhand appears at the stern holding a barrel | 3 barrels, 20 ticks apart, roll along the pontoon at 1.2 px/tick (16 px tall, contact kills, 20 HP each, knifeable) | 40 |
| F Smoke Stack | 40: the funnels puff black smoke | 4 soot balls arc out (vx −1.5 … −3.0, vy −3.0, gravity 0.12) and burst on landing (r 10) | 50 |

**Phase 3 "Second Encore"** (`wheel` < 800). Blare climbs onto the stern rail with a trombone.
Cycle G, D, G, F; cooldowns × 0.8; the hull sinks 1 px every 60 ticks (cosmetic, max 16 px).

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| G Slide Shot | 30: the slide pulls back (`boss/trombone-pull`) | 3 brass pellets at 4 px/tick, 30 ticks apart, alternating chest height (crouch) and ankle height (jump) | 40 |

- **Death sequence (300 ticks):** 6 explosions chain along the hull, 15 ticks apart; the wheel
  breaks off and rolls away downriver; the boat lists while the calliope plays a sad descending
  run; Blare salutes on the bridge until only his cap shows. 120 ticks later he pops up in a
  rubber ring and paddles off: `THIS ISN'T OVER! ...IS IT? IT IS? DRAT!`
- **Score:** 30,000 + parts.

### 10.2 m2 — `ba-dum-behemoth` — THE BA-DUM BEHEMOTH (Colonel Rimshot)

- **Concept:** a giant drum kit on tank treads. Colonel Rimshot sits on the drum throne on top and
  tells awful jokes; a rimshot (`env/rimshot`) follows every one. Subtitle:
  `COLONEL RIMSHOT IS HERE ALL WEEK`.
- **Look and size:** 240×170. Crimson treads 200×28; on them a bass drum on its side, 120×120,
  facing the player (white skin with the Legion crest, gold hoops); two tom-tom turrets (32×24)
  on top; a crash cymbal (56 px disc) on a stand arm in front of the bass drum as a shield; a
  hi-hat (40 px cymbals) on a long hydraulic arm that reaches forward; Rimshot on the throne
  (striped jacket, bow tie, big grin, two drumsticks).
- **Arena (`m2-d`):** `LOCK 1600–1984`. Flat sand at y 176, quarry walls at both ends; two
  sandstone ledges (one-way, 64 wide) at x 1624–1688 and 1740–1804, y 132. The tank patrols
  view x 230–290 at 0.4 px/tick.
- **Parts:** `hihat-arm` 1,200 · `tom-left` 800 · `tom-right` 800 · `crash-shield` 1,000
  (optional; while it is in front, shots at the bass drum hit the shield) · `bass-drum` 2,000
  (required core). Phase 1 needs 2 of the 3 arm/tom parts (required).

**Phase 1 "Warm-Up"** (until 2 of `hihat-arm`, `tom-left`, `tom-right` are destroyed). Cycle A, B, A, C.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| A Hi-Hat Crush | 45: the arm moves over the nearest player's x (30 ticks); the cymbals open ("chick", `boss/hihat-open`) and a shadow grows on the ground | slam: crush zone 40×20; the closed hi-hat stays down 30 ticks (its top is a platform) | 30 (lifts back) |
| B Tom Volley | 30: the tom heads flash, drumroll | each living tom fires 2 mortar shells 12 ticks apart (`tom-left` lands at the player's x −32 and +32, `tom-right` at 0 and +64; a shadow marks each spot for 30 ticks), r 14 | 50 |
| C Rimshot Taunt | — | a joke bubble for 90 ticks, then the rimshot. **No attack** (free window). Jokes in turn: `KNOCK KNOCK! WHO'S THERE? A TANK MADE OF DRUMS!` · `I TOLD THE ARMY I'D BEAT THEM. NOW I BEAT DRUMS!` · `MY FAVOURITE DESSERT? A DRUM ROLL!` · `I'M NOT LOUD. I'M PERCUSSIVE!` | — |

**Intermission:** `THAT'S MY WARM-UP ACT!` (rimshot; nobody laughs; one cricket chirps, `env/cricket`).

**Phase 2 "Drum Solo"** (until `bass-drum` < 1,000). Cycle D, E, D, B (B only if a tom lives).

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| D Kick Boom | 40: the pedal beater at the back pulls back with a creak (`boss/beater-pull`); the crash shield swings aside | BOOM: the drum skin flexes; a ground shockwave rolls both ways (12 px tall, 3 px/tick; jump); shake 3 px / 10 ticks | 40 — the shield stays aside: the window to hit the bass drum |
| E Drum-Roll Charge | 40: the treads spin, dust; a dust line appears on the ground at view x 130 | charges left at 2 px/tick and stops with its front at that line (view x 0–120 is always safe) | backs off at 1 px/tick |

**Phase 3 "Big Finish"** (`bass-drum` < 1,000). Rimshot stands up; the crash shield stays aside.
Cycle F, G, D; cooldowns × 0.8.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| F Stick Storm | 40: Rimshot throws sticks high; 6 shadows appear on the ground | the `drumstick`s rain down on the shadows (4×16 each, lethal, falling at 4 px/tick) | 40 |
| G Cymbal Saw | 30: the crash cymbal (or Rimshot's spare if it was destroyed) spins up with a rising shimmer | the `cymbal-saw` (24×8) flies left across the arena at 3 px/tick, 28 px above the ground (crouch), then returns at the same speed 6 px above the ground (jump) | 40 |

- **Death sequence (240 ticks):** the drums explode one by one like a drum fill: tom, tom, bass,
  crash ("boom, boom, BOOM, tssss"); 60 ticks of silence; Rimshot crawls out of the bass drum and
  dusts himself off: `TOUGH CROWD.` (rimshot).
- **Score:** 40,000 + parts.

### 10.3 m3 — `windbag` — THE WINDBAG (Wing Commander Puffington)

- **Concept:** a bagpipe airship: the tartan bag is the balloon, three drone pipes are cannons,
  the chanter that hangs below is the main gun, and Puffington talks in his gondola the whole
  time. Subtitle: `WING COMMANDER PUFFINGTON HAS A FEW WORDS`.
- **Look and size:** 320×180. Bag 200×110 (red-and-gold tartan, patched); three drone pipes (8×60,
  black and brass, with tassels) sticking up and back; the chanter (12×56, black with silver rings
  and finger holes) under the front of the bag; a wooden gondola (64×24) with Puffington (handlebar
  moustache, flying goggles, a stack of speech notes); a propeller at the back.
- **Arena (`m3-c`):** `LOCK 896–1280`. The summit cable-car deck: concrete at y 176; a station hut
  (solid 40×40 at x 912–952, its roof is standable); two snow piles (solids 24×16) at x 1046 and
  1146. The airship floats at view x 180–360, y 10–120.
- **Parts:** `drone-1`, `drone-2`, `drone-3` 800 each (required) · `chanter` 1,500 (optional) ·
  `bag` 2,500 (required core; shots bounce off with a "boing" until all three drones are gone).
- **Riding a Swan** (when she took the lift, 11.3 `m3-c`): the Gust pushes her like a player
  (2.6 − 0.6 = 2.0 px/tick into the wind); her neck (up to −135°) and HONK answer the Drone Bolts;
  she jumps the Reel line (65 ticks in the air against its 60-tick sweep); she crouches under the
  Pendulum Gondola (her crouched top is 20 px, the gondola passes 24 px above the ground); her stomp
  never hits the airship; Leak Dash contact is a big hit (1 cell). No HP change.

**Phase 1 "The Speech"** (drones alive). A speech bubble scrolls the whole time and never ends
(`...AND FURTHERMORE...`). Cycle A, B, C, B.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| A Gust | 60: the bag swells ("hoooo") | it exhales: players are pushed left at 0.6 px/tick for 90 ticks (wind streaks; walking right still makes 0.9 px/tick) | 30 |
| B Drone Bolts | 40: one drone tip glows and its hum rises (drones take turns) | 3 slow homing notes (1.5 px/tick, turn 2°/tick, life 180; 10 HP each, 50 points) | 30 |
| C Sheet-Music Mines | 20: a hatch in the gondola flaps | 4 sheets of music flutter down slowly, swaying (each visible ≥ 40 ticks before it lands); they explode on the ground or on a player (r 12); shoot them for 50 each | 30 |

**Intermission:** Puffington drops his speech notes; they scatter in the wind; he starts again
from page one.

**Phase 2 "The Chanter"** (drones gone; the bag can be hurt). The airship sinks to y 40–90.
Cycle D, E, A.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| D Reel (chanter; skipped if destroyed) | 30: the finger holes light up in order | a stream of notes (one every 4 ticks, 2 px/tick) hits a line on the floor that starts at the far left and sweeps right toward the boss over 60 ticks: jump the moving impact line once | 40 |
| E Pendulum Gondola | 40: the ropes creak and the gondola pulls back | it swings across the arena; its lowest point passes 24 px above the ground in the middle (crouch) | 40 |

**Phase 3 "Hot Air"** (`bag` < 1,000). A patch pops and the bag leaks. Cycle F, C, F.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| F Leak Dash | 30: the leak spurts and a dotted line shows the dash path (a horizontal line at y ≤ 90, or a diagonal that meets the ground at a marked shadow) | the Windbag dashes along it at 4 px/tick (contact kills), bounces once off the view edge and stops | 50 |

- **Death sequence (300 ticks):** the bag deflates with a long dying drone chord
  (`boss/bagpipe-die`), loops around the screen three times and wraps itself around a background
  peak. Puffington parachutes down, still talking, and lands head-first in a snow drift, legs
  kicking: `...MMF... AND FURTHERMORE...`
- **Score:** 50,000 + parts.

### 10.4 m4 — `grand-grand` — THE GRAND GRAND (Countess Pizzicata)

- **Concept:** a black grand piano on four piston legs that walks, bites with its lid and fires
  felt hammers, with Countess Pizzicata singing on the bench on top. The fight is staged as an
  opera premiere: the curtain rises, audience silhouettes gasp and clap. Subtitle:
  `COUNTESS PIZZICATA REQUESTS YOUR SILENCE`.
- **Look and size:** 220×150. Body 180×60 (glossy `ink` with gold trim); the lid is the jaw
  (hinged at the back); the keyboard at the front shows keys like teeth; four chrome piston legs
  (40 px) on brass castors; the Countess on top (tall beehive hairdo, tiara, `green` gown, opera
  glasses).
- **Arena (`m4-d`):** `LOCK 1400–1784`, a wooden stage at y 176. A prop crate step (one-way, 48
  wide) at x 1500–1548, y 144; two balcony boxes (one-way, 72 wide) at x 1408–1480 and
  1540–1612, y 108. Three chandeliers hang at x 1460, 1580 and 1700 (y 0–30).
- **Parts:** `lid` 1,500 (required) · `keyboard` 1,200 (optional; removes Glissando) ·
  `front-legs` 1,000 (optional; removes Pedal Stomp) · `strings` 2,500 (required core: the gold
  harp frame inside the body, exposed when the lid is gone). The keyboard and the legs can be
  destroyed in any phase.

**Phase 1 "Overture"** (until the `lid` is destroyed). Between attacks the piano stomps 32 px toward
the player at 0.5 px/tick on the beat (it stays inside view x 160–384). Cycle A, B, C.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| A Chomp | 40: the lid opens wide and the keys rattle (`boss/piano-rattle`) | lunges 64 px forward and snaps shut (bite zone 56×40) | 50; the lid stays open for the first 20 ticks and takes ×1.5 damage while open |
| B Glissando (keyboard) | 36: keys light up left to right with a rising run (`boss/piano-gliss`) | 12 felt hammers fan out in a rising arc (−10° to −70°, 2.5 px/tick, gravity 0.05) | 50 |
| C High C | 40: the Countess inhales; the chandelier above the nearest player shakes and its shadow appears | it falls (impact 48×24) and stays on the stage as a solid 32×16 for 300 ticks. Skipped when all three have fallen | 40 |

**Intermission:** the Countess demands a costume change. The curtain drops for 60 ticks (stage
hands drag the broken lid away) and rises again; her hairdo is now twice as tall.

**Phase 2 "Intermezzo"** (until `strings` < 1,250). Cycle D, B, E.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| D Harp Strings | 45: 5 flickering 1 px gold preview lines show the beam paths (a fan across the stage from the strings, with gaps of at least 24 px at floor level; `boss/harp-charge`) | 5 laser beams (4 px wide) for 30 ticks | 40 |
| E Pedal Stomp (front legs) | 30: the front legs lift | stomp: a ground shockwave both ways, 10 px tall (jump) | 30 |

**Phase 3 "Finale"** (`strings` < 1,250). The legs fold; the piano drops onto its castors
(hurtbox top at y 116). Cycle F, G, D; cooldowns × 0.8.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| F Castor Charge | 40: the piano leans back and the castors squeal | rolls across the stage at 2.5 px/tick to the far side and back (contact kills). Safe: the balconies (y 108), reached from the crate step | 40 |
| G Grand Aria | 60: a huge breath; all remaining chandeliers shake and show their shadows | they all fall at once (if none remain: 6 `crystal-shard`s, 8×12 and lethal, fall at 4 px/tick onto shadows shown during the telegraph) | 60 |

- **Death sequence (300 ticks):** the piano collapses key by key, each key popping off with one
  note of a descending scale, then a final crashing chord. The Countess stands in the wreck and
  bows deeply; a single rose lands at her feet: `BRAVA! ...WAIT. YOU'RE THE ENEMY.` She faints in
  an operatic swoon.
- **Score:** 60,000 + parts.

### 10.5 m5 — the final boss: Grand Marshal Fanfaroni (three stages)

Music `boss-final` for all three stages (`boss-final-fast` during **Tempo!**). Stage 1 is fought in
the Trumpeters at the end of `m5-a`; stages 2 and 3 on foot in `m5-c`. A continue restarts nothing:
the player drops back into the current stage, and destroyed parts stay destroyed.

#### Stage 1 — `grand-organ` — THE GRAND ORGAN (end of `m5-a`, shoot-em-up)

- **Concept:** the flying fortress: a cathedral-sized pipe organ with propellers, bellows for lungs
  and a rose window, rehearsing the anthem through a giant loudspeaker. Subtitle:
  `TONIGHT'S PROGRAMME: YOU`.
- **Look and size:** the visible front face is 300×200: dark carved wood (`brown`) with gold, three
  brass pipe clusters (top, middle, low; 60×50 each), accordion bellows (80×60) that pump, a huge
  gold loudspeaker horn (64×48) in the centre (closed behind shutters at first), a rose window at
  the top. It hovers at view x 200–384+ (partly off-screen) and drifts up and down at 0.3 px/tick
  (±24 px). The auto-scroll is stopped (lock); the cloud layers keep drifting; the Trumpeters fly
  freely.
- **Parts:** `pipes-top`, `pipes-mid`, `pipes-low` 1,000 each (2 of 3 required) · `bellows` 1,500
  (optional, +5,000 instead of 1,000) · `speaker` 1,200 (required; its shutters open after 2 pipe
  clusters are destroyed). The stage ends when the `speaker` is destroyed.

**Phase 1 "Rehearsal"** (until 2 pipe clusters are gone). Cycle A, B, A; C on its own timer.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| A Chord Spray | 30: one cluster's pipes light up (clusters take turns; `boss/organ-chord`) | 3 fans of 5 notes (spread 40°, 1.8 px/tick), 20 ticks apart | 40 |
| B Bellows Breath (bellows) | 45: the bellows pull open | wind pushes the Trumpeters left at 1.0 px/tick for 60 ticks (the left view edge is safe) carrying 6 slow notes | 30 |
| C Kazoo Escort `[N]` | — | every 480 ticks a `kazoo-drone` formation (5, `sine`) leaves a hatch | — |

**Phase 2 "Dress Rehearsal"** (the speaker is open). Cycle D, A, B.

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| D Anthem Beam | 50: the speaker glows; a 24 px horizontal stripe flickers across the screen at its height | a sound beam fills that stripe for 40 ticks | 50 |

- **End of stage (180 ticks):** the speaker explodes with a squawk; the anthem stops on its wrong
  note; the organ lurches and opens a landing hatch; the Trumpeters fly in automatically (exit to
  `m5-b`). **Score:** 30,000 + parts.

#### Stage 2 — `organ-console` — THE CONSOLE (`m5-c`, on foot)

- **Concept:** Fanfaroni plays the console himself. The three keyboards are three tiers of
  platforms, and a giant sheet-music screen above the room **shows the score of the next
  attacks**: the telegraph is the sheet music. Subtitle: `HIS LOUDNESS WILL NOW PERFORM`.
- **Look and layout** (`m5-c` is a single 384×216 screen; world = view coordinates): the console
  fills the right of the room (dark wood, gold, ivory keys; sprite x 120–344, y 40–176). Tiers are
  one-way platforms (stepping on them plays a note, cosmetic): **tier 1** x 120–300, y 148 ·
  **tier 2** x 150–300, y 116 · **tier 3** x 180–300, y 84. Pipe banks climb the left wall (x 0–40)
  and the right wall (x 344–384), y 40–176. Fanfaroni sits on his bench at x 304–340 (feet y 84).
  The music stand (`console` hurtbox) is at x 296–336, y 44–84. The **sheet screen** hangs at
  x 72–312, y 30–62 with **4 staff lines = 4 lanes** (y 34 tier 3, 42 tier 2, 50 tier 1, 58 floor)
  and a NOW bar at x 76.
- **Parts:** `pipe-bank-left` 1,500 · `pipe-bank-right` 1,500 (one bank required) · `console`
  3,000 (required; damageable only after one bank is destroyed).
- **THE SCORE** (runs all stage): notes appear 128 px right of the NOW bar and scroll left at
  2 px/tick, reaching NOW after 64 ticks. When a note reaches NOW, its lane is blasted across the
  whole room for 20 ticks (`boss/organ-chord`): **floor** band y 150–176, **tier 1** band
  y 120–146, **tier 2** band y 88–114, **tier 3** band y 56–82. At most 2 lanes fire at once on
  NORMAL (3 on HARD); there is always a safe lane. One note per beat, 32 ticks per beat;
  `F` floor, `1`–`3` tiers, `-` rest, two letters = both lanes:
  - Phrase 1: `F - 1 - F - 2 -` · Phrase 2: `F 1 - 2 F - 3 -` · Phrase 3: `F1 - 23 - F2 - 13 -` ·
    Phrase 4 (fugue): `F 1 2 3 F 1 2 3`.

**Phase 1 "Overture"** (both banks alive): phrases 1, 2, 1, 3 in a loop, plus:

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| A Pedal Notes | 30: his feet slam the pedalboard (visible under the console) | a floor shockwave 10 px tall from the console toward the left wall (jump); never on the same beat as a floor note | 30 |

**Phase 2 "Fugue"** (one bank destroyed; the console can be hurt): notes scroll at 3 px/tick
(43 ticks of warning); phrases 2, 3, 4, 3 in a loop; plus:

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| B Stop Pull | 40: he pulls a big labelled stop knob | by label: `TRUMPET` = 2 `rifleman` from a side door at x 8; `FLUTE` = 3 homing notes (as the Windbag's drone bolts); `PICCOLO` = a `piccolo` on tier 3 at x 200; `BOMBARDE` = 4 falling note-bombs on marked shadows (r 12) | 60 |

- **End of stage:** the console explodes and throws Fanfaroni into the air; he lands in his
  escape podium and stage 3 starts at once. Intermission gag (60 ticks): his hat is on fire; he
  blows it out; the plumes are now black. The three tier platforms fall away as debris and three
  **wreck blocks** (solids 24×32, indestructible) land on the floor at x 72, 192 and 312.
  **Score:** 40,000 + parts.

#### Stage 3 — `maestro` — THE MAESTRO (`m5-c`, same room)

- **Concept:** Fanfaroni in his personal flying conductor's podium. A tiny target with a giant
  voice. Subtitle: `GRAND MARSHAL BOMBASTIAN FANFARONI`.
- **Look and size:** 64×64: a round brass podium (48×28) on a hover jet, a speaker wing (8×24) on
  each side, and Fanfaroni (30 px, bicorne 30 px wide) standing on top with a giant baton.
- **Parts:** `speaker-left` 600 · `speaker-right` 600 (optional) · `podium` 2,400 (required core:
  the glowing gem on its front). `podium` is `knifeable` while he is in the D recovery.
- **Movement:** a figure-eight over the room (one loop per 360 ticks), y 40–120; he stops for each
  attack.
- **Attacks:** cycle A, C, B, A, C; D replaces the next attack when `podium` < 1,200 (at most every
  600 ticks).

| Attack | Telegraph | Attack | Recovery |
|---|---|---|---|
| A Baton Lash | 30: the baton glints; a thin arc preview line shows the sweep | a beam 6 px wide and 120 px long sweeps a 120° arc in 30 ticks | 40 |
| B Tempo! | 60: he taps the baton on the podium 4 times (tock-tock-tock-tock) | the music switches to `boss-final-fast` for 300 ticks and his cooldowns × 0.8 (no damage) | — |
| C Speaker Volley | 24 per living speaker: the cone pulses | 5 note-bullets in a spread toward the player, 2 px/tick | 30 |
| D BRAVISSIMO! | 60: he flies to (192, 50); a gigantic breath; his hat lifts off; the text `BRAVISSIMO...` grows letter by letter (big font); the floor glows in the 16 px behind the outer wreck blocks (x 44–60 and x 324–340) | the scream: every player whose head can be seen from his mouth is hit (the segment mouth → head must not cross a wreck block (`segmentRectT`) or terrain (`terrain.lineOfSight`)). Crouching close behind an outer block hides you | 90: he coughs and sinks to y 140 with a hoarse voice (podium ×1.5 damage, knifeable from the blocks' tops) |

- **Death sequence (360 ticks):** his last scream cracks into a squeak (`BRAVISSI—`, then a tiny
  `*squeak*`, `boss/voice-crack`); the podium sputters; every pipe in the organ plays one note on
  its own and the room starts to fall apart. The players auto-run right and jump into a Trumpeter
  flown by Gramps (`I'M A PILOT NOW TOO. DON'T TELL ACCOUNTING.`); if Gramps is a player, Brigadier
  Gusto flies it, singing. Then the ending (2.6). **Score:** 100,000 + parts.

---

## 11. Missions

### 11.0 Shared mission rules and notation

**Route map**

| Mission | Path | Branch point → routes → rejoin |
|---|---|---|
| m1 | `a` → (`b1` or `b2`) → `c` (boss) | end of `a`: ROOFTOPS ↑ (`b1`) or DRAIN ↓ (`b2`) → both exit into `c` |
| m2 | `a` → `b` → (`c1` or `c2`) → `d` (boss) | end of `b`: CANYON ↓ (`c1`) or MESA ↑ (`c2`) → both exit into `d` |
| m3 | `a` → (`b1` or `b2`) → `c` (boss) | end of `a`: NORTH FACE ↑ (`b1`, vertical) or CAVES → (`b2`, vertical) → both exit into `c` |
| m4 | `a` → `b` → (`c1` or `c2`) → `d` (boss) | end of `b`: SUBWAY ↓ (`c1`) or ROOFTOPS ↑ (`c2`) → both exit into `d` |
| m5 | `a` → `b` → `c` (final boss) | none |

- **Choosing a route:** after the branch-point fight both exits open at once and a sign with an
  arrow appears over each (decor `sign`, small font). The first player to touch an exit rect takes
  the whole team. There is no menu: the choice is physical. **Exit rects are active only after the
  row that opens them** (usually the `UNLOCK` after the branch-point fight, or the end of the
  last wave); before that they do nothing.
- **Section header fields:** size (w×h px), scroll, checkpoints, vehicles allowed (carry-over,
  4.8); the timer (counts) only when it is not the default 60. **Music** is set once per mission in
  the mission header (a section row may start another song, e.g. `m5-b`). Then the body gives the
  terrain (ground line y 176 unless noted; "platform" = one-way, "solid" = blocks from all
  sides; builder notation of `docs/api/sim.md` §3), background layers (far first: `generator
  {colour notes} factorX`; vertical sections give `factorY`), terrain style (`ground / edge /
  platform / solid` materials).
- **Background colour notes** are guidance for the generator params (palette words); exact param
  names follow the art agent's generator docs. Custom generators are registered by the mission
  agent in its own folder (one-line spec given where first used).
- **Spawning at the section end:** when a locked view ends at the section's right edge, `R+16`
  means "appear at x = section width − 8 and walk in" (never outside the section bounds).
- **Vertical sections:** triggers use `@Y` (camera top edge). Falling below the bottom view edge
  in an up-scrolling section is death; respawns land on a moving platform in view if there is one,
  else on the lowest platform in view. Checkpoints are y values.
- **Secrets behind walls:** a `breakable-wall` with `solid: false` is drawn behind the actors;
  when it breaks, the script spawns what it hid (hostage, records). Secret ledges are real
  platforms placed so that only a Helium Head jump (apex ≈ 78 px) reaches them. Sections where a
  Swan can be ridden have no secret ledges: her jump (apex ≈ 97 px, 8.2) would reach them.
- **Mission-local entities** (each mission folder defines the ones it uses): `hatch` (a lid
  32×8, dynamic solid, opens on a script command), `sign` (text decor), `mk1-head` (m1-c),
  `drum-mine` (m1-c, 11.1), `organ-distant` (m5-a decor in 3 pre-rendered sizes). Shared props
  are in 9.5.
- **Timer:** every section has `timeLimit: 60` (counts) unless the header says otherwise.
- **Transitions:** a 30-tick fade; flavour text in a row (slide, drop, zip-line) is a sound plus
  the fade, no extra animation required.
- **Pacing check:** a checkpoint at least every ~1,200 px (or ~700 px vertically).

### 11.0a ams — THE FRYING DUTCHMAN (MISSION 1)

Full layout, art brief and texts: `docs/design/amsterdam.md` §6–§8; API `docs/api/missions-ams.md`.
Music `ams` (street-organ waltz), boss `ams-boss`. `next: 'm1'`. Hostages a 4 / b 3 / c 3
(mostly `tourist`). Golden record on the gable ledge of `ams-a` (x 2334, y 66).

- **`a` Grachtengordel** (3584, checkpoints 1300, 2500): quay street (crate M @420, tourist at
  the bike rack, a gull asleep on a lamp), bridge 1, the side canal (two houseboats and a little
  boat), `LOCK 1520–1904` PLEINTJE (fatbike gang from both sides, a gull, a rider from behind),
  the shopping street (riders both ways, a gull flock, tulip stall, herring cart, awnings up to
  the record), bridge 2, `LOCK 3200–3584` FABEL FRIET (the last wave), THE BRIEFING (input
  locked, timer paused, 6 hint lines, fire skips; the baker tosses a flamethrower: "FRIES FOR THE
  ROAD"), `exitTo('b')`.
- **`b` Museumplein** (3072, 1100, 2300): riders through the Rijksmuseum passage, the hot-dog
  vendor and THE SWAN parked at 1080 (2P: the Mute), Gramps `I BROUGHT HER ALONG.` /
  `DON'T TELL ACCOUNTING.`, the glide lesson on the first mount (records `ams/swan-met`,
  `m1/swan-lesson`; m1-c greets her as an old friend), the gull set piece, youths on the lawn,
  the canal road; the exit opens after the last squad.
- **`c` Amstel** (3328, 1200, 2400, 3100; vehicles `swan`): the handhavers arrive, the canal
  with six houseboats and two little boats, the shop quay, the white Amstel bridge, the
  Blauwbrug; the exit opens after the last squad.
- **`d` Stopera** (1280, checkpoint 896; vehicles `swan`): the flea market (stalls, a few
  handhavers), then ROBO-HALSEMA (10.0a), the cheering finale and MISSION COMPLETE.

### 11.1 m1 — BRASS ON THE RIVERBANK

- **Biome and mood:** Puddlewick, a little brick river town on the river Wend on a bright spring
  morning. Red roofs, willow trees, regatta bunting, rubber ducks everywhere; crimson Legion
  banners pasted over the regatta posters. Palette: fresh `green`, `sky` blue, warm brick (`rust`,
  `red`), cream (`snow`, `sand`), crimson and gold accents.
- **Music:** `m1`; boss `boss`. **Announcer at start:** `"MISSION ONE. LOOK SHARP, CYGNETS!"`
- **Hostages per route:** 10 (`a` 4 incl. the `composer`, `b1`/`b2` 3, `c` 3).
  **Golden record:** `m1-a` secret ledge. **Composer:** `m1-a` secret ledge.

#### `m1-a` — Puddlewick Quay · 2560×216 · scroll right · checkpoints 1400

- **Terrain:** `ground().at(0,176).flat(600).slope(60,-16).flat(440).slope(60,16).flat(1204)
  .gap(32).flat(164)` — cobbled street y 176, market square y 160 at x 660–1100, the storm-drain
  hole x 2364–2396 (covered by a `hatch` lid until the quay-gate fight ends), quay to x 2560. The
  right edge (2560) is a wall: the river.
  Platforms (`wood`): shop awning 420–476 y 136; triangle balcony 760–820 y 128; awning 1300–1360
  y 132; bandstand roof 1640–1756 y 112; roof awning 1800–1880 y 120; chimney ledge 2040–2090 y 92;
  **secret roof ledge 1860–1920 y 56** (only a Helium Head jump from the roof awning reaches it);
  quay steps 2440–2520 y 140 and 2460–2540 y 100.
  Solids: market crate 968–992 y 140–160; crate stack 1428–1452 y 136–176; bandstand base
  1650–1746 y 160–176.
- **Background:** `sky-gradient {top sky[2] → horizon pale lemon gold[3]}` 0 · `clouds {white}`
  0.1 · `hills {soft green}` 0.2 · `treeline {dark willow green}` 0.35 · `town-rooftops` *(custom:
  red-brown roofs, cream walls, bunting strings)* 0.55.
- **Terrain style:** `concrete / tiles / wood / brick`.
- **Decor:** a banner `PUDDLEWICK DUCK REGATTA` with `MILITARY PARADE` pasted over `DUCK`;
  posters `SALUTE HIS LOUDNESS`; lamp posts; flower boxes; buckets of rubber ducks.

| Trigger | Events |
|---|---|
| start | Players drop in at x 48. Card `MISSION 2` / `START!`. Music `m1`. |
| @0 | 2 `rifleman` @300, @324, gag `cards` (`card-table` @312). 1 `rifleman` @520, gag `kazoo`. `crate @470 (M)`. |
| @160 | 3 `rifleman` from `R+16`, 40 ticks apart. |
| @380 | `triangle` on the balcony @790 (y 128), gag `counting` (alarm: 3 `rifleman` from `R+16`). 2 `rifleman` @700, @730, gag `rehearse`. |
| @560 | hostage `critic/chair @900 (S)`. `crate @1010 (bombs)`. |
| @720 | **PARADE COLUMN** from `R+16`, marching left at 0.6 px/tick in step with the music, 28 px apart (`params.column: 'p1'`): `drummer`, 3 `rifleman`, `cymbalist`, `[N]` +1 `rifleman`. They notice players only within 160 px (they are performing). Kill the drummer first and the column stumbles for 60 ticks. |
| @1000 | **ANTHEM BREAK (tutorial):** `anthem-speaker` @1260 on a lamp post. 4 `rifleman` @1300 (gag `shine`), @1330 (gag `nap`), @1380 and @1420 (pair, gag `cards`, `card-table` @1400). When a player reaches x 1180 the speaker plays at once: all four salute for 180 ticks; hint text (small, centred at y 40, 150 ticks): `LEGION SOLDIERS MUST SALUTE THE ANTHEM!` Then it plays every 900 ticks while it stands. |
| @1400 | Checkpoint. `oompah-trooper` on the bandstand roof @1700 (y 112). 2 `rifleman`, entry `window`, @1620 and @1660 (from y 100). `crate @1560 (M)`. |
| @1560 | hostage `tourist/sack @1780 (auto)`. `helium-tank` @1830. **Secret:** hostage `composer/chair @1880 (1up)` and `pickup-gem` `golden-record` @1905 on the secret roof ledge. |
| @1700 | `piccolo` prone on the chimney ledge @2060 (y 92). |
| @1900 | `band-truck` from `R+48` to stopX 2250; cargo 3 `rifleman`, 1 `cymbalist`, `[H]` +1 `baton-major`. |
| @2000 | hostage `roadie/cage @2140 (R)`, hanging from a crane (rope top y 60, cage bottom y 120). |
| @2176 | `LOCK 2176–2560`. **Quay Gate:** `baton-major` @2460; 2 `rifleman` walk in from x 2552 (climbing up the quay steps); 2 `rifleman` entry `parachute` @2300, @2400; `[N]` `cymbalist` from `L-16`. `WAIT dead`. The drain `hatch` clanks open; a Legion head pops out: bubble `DON'T COME DOWN HERE!` and ducks back. Signs `ROOFTOPS ↑` (over the quay steps) and `DRAIN ↓` (over the drain). `UNLOCK`. |
| exits | `b1`: rect (2520–2560, 40–100), the top of the quay steps (fade). `b2`: rect (2364–2396, 176–216), the open drain (the player drops in; fade). |

#### `m1-b1` — Chimney Chase (upper route) · 2400×216 · scroll right · checkpoints 1240

- **Terrain:** rooftops with gaps. Ground points: (0,140)–(380,140) · gap 380–420 · (420,128)–
  (590,104)–(760,128) (a pitched roof) · gap 760–800 · (800,136)–(1240,136) · gap 1240–1288 ·
  (1288,120)–(1700,120) · gap 1700–1744 · (1744,144)–(2000,144)–(2250,176)–(2400,176).
  Every gap has a `spring-awning` at y 196 across its full width (a fall bounces the player back
  up to roof height). Chimneys (solids 16×28): x 892–908, 1032–1048, 1172–1188 (tops y 108).
  Platforms (`wood`, sagging laundry lines): 1340–1460 y 84, 1500–1620 y 80; weather-vane ledge
  1000–1060 **y 56** (only a Helium Head jump from a chimney top reaches it).
- **Background:** as `m1-a`, but `town-rooftops` at factor 0.3 with offsetY +40 (we are above it).
- **Terrain style:** `concrete / tiles / wood / brick`.

| Trigger | Events |
|---|---|
| start | Players enter from the left at (40, 140). |
| @0 | 2 `rifleman`, entry `chimney`, @300 and @350 (chimney decor there). |
| @180 | `crate @450 (M)` on the pitched roof. `piccolo` prone @590 (roof peak, y 104). 2 `rifleman` from `R+16`. |
| @420 | hostage `critic/chair @700 (H)`. `triangle` @740, gag `counting` (alarm: 3 `rifleman`, entry `chimney`, @900, @1040, @1180). |
| @640 | `drummer` walks in from `R+16` along the roof 800–1240, a `cymbalist` behind him. |
| @860 | `helium-tank` @960. **Secret:** 5 `golden-note` + 1 `gem` on the weather-vane ledge. |
| @1000 | 3 `rifleman`, entry `chimney`, @1040, @1180, @1180 (30 ticks apart). `[N]` `piccolo` on the chimney top @1180 (y 108). |
| @1240 | Checkpoint. 2 `rifleman` on the laundry lines (gag `shine`). `oompah-trooper` @1560. `crate @1460 (bombs)`. |
| @1500 | hostage `tea-lady/chair @1640 (auto)`. |
| @1700 | 4 `rifleman`, entry `parachute`, @1820, @1880, @1940, `[N]` @2000. |
| @1900 | hostage `tourist/sack @2100 (auto)`. |
| @2016 | `LOCK 2016–2400`: `baton-major` @2300, 3 `rifleman` from `R+16`, `[N]` `drummer` from `R+16`. `WAIT dead`. `UNLOCK`. |
| exit | rect (2380–2400, 100–176) → `c` (the players slide down a drainpipe; fade). |

#### `m1-b2` — Storm Drain (lower route) · 2400×216 · scroll right · checkpoints 1100

- **Terrain:** ceiling solid along y 0–40 for the whole length. Walkway: `at(0,168).flat(420)
  .gap(100).flat(380).gap(140).flat(460).gap(120).flat(780)` — water channels (hazard `water`,
  y 180–216) at x 420–520, 900–1040 and 1500–1620. Metal grates (platforms) over each channel at
  y 128 (420–520, 900–1040, 1500–1620). Grate steps to the exit: 2290–2330 y 144, 2340–2400 y 120.
- **Background:** `sewer-brick {darker, far}` 0.2 · `sewer-brick` *(custom: dark teal brick arches,
  dripping pipes)* 0.4; sky colour `navy[0]`.
- **Terrain style:** `concrete / moss / metal / brick`.

| Trigger | Events |
|---|---|
| start | Players land in a puddle at (40, 168) (splash). |
| @0 | 4 `windup-bot` in a line from `R+16`, 20 px apart. |
| @200 | 2 `bullfrog` @380, @540 on the walkway edges. `duck-float` over channel 1 (centre 470, drift ±34). |
| @400 | `metronome-turret` on the ceiling @700 (y 40). `crate @640 (F)`. |
| @560 | hostage `critic/chair @780 (S)`. 2 `rifleman` from `R+16`. |
| @760 | 2 `duck-float` over channel 2 (centres 940 and 1000, drift ±30). `bullfrog` on the grate @980 (y 128). 5 `windup-bot` from `R+16` on the far walkway. |
| @1100 | Checkpoint. **Rubber Duck Stampede** (cosmetic): a sluice gate opens and 8 small rubber ducks race down the channels with a rush of water (`env/water-rush`). 2 `metronome-turret` on the ceiling @1240, @1400. `crate @1300 (bombs)`. |
| @1300 | hostage `roadie/cage @1450 (B)`, hanging from a pipe (rope top y 40, cage bottom y 110). |
| @1460 | `duck-float` over channel 3 (centre 1560, drift ±40). 2 `bullfrog` beyond it @1660, @1700. |
| @1700 | 6 `windup-bot` from `R+16`. `[N]` 2 `rifleman` from `R+16`. |
| @1900 | hostage `tea-lady/chair @2080 (auto)`. |
| @2016 | `LOCK 2016–2400` (overflow chamber): 3 `bullfrog` drop from ceiling pipes (`TOP`) @2150, @2250, @2330. `[N]` `metronome-turret` on the ceiling @2200. `WAIT dead`. `UNLOCK`. |
| exit | rect (2360–2400, 60–120), a manhole above the top grate step → `c` (the players pop out of a manhole on the riverbank). |

#### `m1-c` — River Run · 3000×216 · scroll right · checkpoints 900, 1900, 2616 · vehicles allowed: `swan`

- **Terrain:** riverbank `at(0,176).flat(780).slope(120,24)`: the bank, then the regatta
  **slipway** (780–900), which runs down into the water (y 200 at x 900). River: hazard `water`
  x 800–3000, y 180–216 (surface y 180). The slipway is under water from x 800 and at most 20 px
  deep (at x 900): players wade with their heads above water; the Swan walks down to x 880 and
  floats beyond it (8.2). An on-foot path with no gap wider than 48 px: lily pads (`lily-pad`,
  y 178) 924–948, 1328–1352, 1530–1554, 1580–1604, 1630–1654, 1680–1704, 1730–1754, 1990–2014,
  2040–2064, 2330–2354, 2380–2404, 2560–2584; jetties (platforms `wood`, y 168) 980–1120,
  1380–1500, 1790–1960; islands (ground pieces, y 172) 1160–1300 and 2100–2300; on island 1 the
  **judges' box** (platforms `wood`): a ladder step 1196–1232 at y 144 and the box 1240–1296 at
  y 116; a `duck-float` at 2430–2530 (drift ±40); the boss pontoon (platform) 2616–2840 at y 176
  and two floating crates (platforms 32 wide, bob ±4) at (2700, 150) and (2760, 136).
- **Background:** `sky-gradient {morning sky}` 0 · `clouds` 0.1 · `hills` 0.2 · `treeline {willows}`
  0.35 · `far-bank` *(custom: the far river bank with Puddlewick's church spire and a strip of
  cheering crowd)* 0.5 · `reeds` *(custom, front: true, along the bottom edge, offsetY 180)* 1.2.
- **Terrain style:** `mud / grass / wood / crate`.
- **Decor:** Swan Mk1's head sticks out of the water at x 1520 (`mk1-head`), a rusty lifebuoy
  stencilled `MK1` round its neck and river weed on its dome (no hat of any kind). A
  sign `NO DIVING` at the top of the slipway (x 772). The judges' box stands on stilts under a
  crimson-and-gold `JUDGES` banner, with three empty chairs. A Legion sign `DANGER: TIMPANI` at
  the right edge of island 2 (x 2288).
- **`drum-mine`** (mission-local): a floating Legion kettledrum mine, an upturned copper timpani
  bowl 20×12 with a crimson rim, gold studs and a brass spike on top. It bobs ±2 px (40-tick
  period; the bob is cosmetic) and never moves. 10 HP, team `enemy`, not knifeable; hurtbox 18×12
  at y 171–183, centred on the mine's x (it does not bob, so the Swan's swimming beak at y 173 and
  her ducked beak at y 178 always hit it). It explodes (r 24, `explosion/m` + `hit/drum`) when a
  player or a Swan touches it, when a player's shot or blast hits it, or 6 ticks after another
  mine's blast reaches it (a chain). The blast deals 100 to enemies and props inside it. It hurts
  players only when a player or a Swan set it off by touch (on foot: death; a Swan: a big hit); a
  mine set off by a player's shot or blast belongs to that player (no friendly fire), and a chain
  keeps the owner of the mine that started it. Enemy shots pass through mines. 100 points per
  mine.

| Trigger | Events |
|---|---|
| start | The `swan` sits parked at x 160, head tucked, with a note `SWAN-3. PLEASE RETURN BY 6 PM. -G.` (`[2P]` the Mute, `params.variant: 'mute'`, at x 112). When a player comes within 64 px: bubble from Gramps on the radio `BE GENTLE WITH HER!` (if Gramps is a player: `THERE SHE IS!`). The first time anyone mounts a Swan in this mission: radio `SHE GLIDES NOW.` / `HOLD JUMP IN THE AIR.`, then `DON'T TELL ACCOUNTING.` |
| @0 | 3 `rifleman` walk from `R+16` (first targets for the Swan). |
| @100 | **DRUM LINE** from `R+16`: 3 `drummer` 36 px apart, marching left at 0.5 px/tick on the beat (`params.column: 'c1'`), with a `baton-major` keeping 60–120 px behind them. Kill the first drummer and the line stumbles for 60 ticks. Their drums soak up the beak gun from the front (`hit/drum`), but a stomp lands on the body (30 HP): one stomp each. If no drummer has been stomped 240 ticks after the first one entered the view, a `STOMP!` hint (the word and three gold chevrons pointing down) blinks over the front drummer. On foot: grenades, the knife or shots from behind. hostage `critic/chair @640 (M)`. |
| @360 | `oompah-tank` from `R+48` to stopX 720, `params.maxX: 744`: it parks on the bank in front of the slipway (a Swan can leap it), and when a player pushes it back it never goes right of x 744, so its body (708–780) stays on the flat bank (without the leash it would back down the slipway at 0.4 px/tick: its anchor would enter the water at x 800 after 200 ticks and leave the ground's end at x 900 after 450). A Swan's clean hurdle take-off window [engine] is 610–660 with the tank at 720 and 634–684 at 744. `[N]` 2 `rifleman` walk in behind it from `R+16`. |
| @560 | **SLIPWAY LEAP:** a `rowboat` with 2 `rifleman` rows in from `R+48` to x 960 (crew at 948 and 972). 2 `bullfrog` hop out of the reeds onto the slipway @800 and @850. 1 `bullfrog` on the jetty @1090. A Swan sprints down the slipway and leaps: a tap jump comes down on the crew (a double stomp: they stand 24 px apart, her stomp box is 28 px wide); a held jump glides over the shallows. |
| @700 | hostage `tourist/sack @1200 (auto)` on the island. `crate @1268 (H)` in the judges' box (y 116). **Glide trail:** 5 `golden-note` (`params.float: true`: they hang in the air, 7.1) at (1333, 117), (1351, 124), (1368, 132), (1386, 140), (1403, 148): the line a Swan glides from the box to jetty 2. |
| @900 | Checkpoint. `piano-bomber` crosses right to left at y 32 and drops 3 pianos near the nearest player; **on water the pianos float** as platforms for 600 ticks. |
| @1200 | **BOAT HOP:** 2 `rowboat` (4 `rifleman`) row in from `R+48` and `R+120` and stop over the lily pads at x 1596 and 1668 (each crew 12 px either side of its boat's centre). A Swan can stomp from boat to boat (her bounce carries her 74 px at the swim speed; the boats are 72 px apart). |
| @1300 | **Mk1 gag:** if Swan Mk1's head (`mk1-head` @1520, hurtbox 16×16) is hit 3 times, it surfaces, honks sadly and a `pickup-bombs` floats up. A Swan's stomp on its dome counts as 3 hits, and then the two swans honk at each other (`swan/honk` at pitch 1.0, then 0.8). Once. |
| @1500 | **Tank barge:** an `oompah-tank` on a `tank-barge` floats left at 0.3 px/tick from `R+48`. **Willow:** a `willow-tree` stands at the end of the jetty @1940 (trunk 200 HP, red target ring); 2 `rowboat` (4 `rifleman`) wait in its fall zone at x 2000 and 2060. `oompah-trooper` on the jetty @1900. |
| @1700 | **Willow set piece:** a `SHOOT!` chevron appears over the willow after 180 ticks if nobody hits it. Broken, it falls right in 40 ticks (its shadow shows on the water) and becomes a solid bridge 160×12 at y 170 over x 1950–2110. It crushes the enemies under it (+200 SET PIECE each); a player or a Swan under it is pushed out to the nearest side, unhurt (9.5). hostage `roadie/cage @2200 (T)` on a fishing post on island 2 (rope top y 100) — the tuba arrives just before a boss full of projectiles. `crate @2280 (bombs)` on island 2. |
| @1900 | Checkpoint. 3 `bullfrog` hop out @2014, @2150, @2200. 1 `rowboat` with 2 `rifleman`, placed now at x 2350 (crew at 2338 and 2362), out of view (the view's right edge is at 2284): it waits over pad 2330–2354, as the BOAT HOP boats do, in open water right of island 2 and 47 px left of the first mine hurtbox (2421). (Entering from `R+48`, x 2332, it would have to row through island 2, 2100–2300.) **TIMPANI MINEFIELD** (placed now, out of view): a barrage of 5 `drum-mine` at x 2430, 2454, 2478, 2502 and 2526 (centres; 24 px apart, so one blast sets off the next), all in the water under the duck-float's drift range. If a player's shot or blast starts a chain that sets off all 5: `DRUM ROLL!` +1,000 to that player. A Swan shoots the first mine from the water, hops across on the duck-float, or (sprint jump + full glide from island 2) glides over the whole barrage. On foot: pad 2404 → the duck → pad 2560, or a grenade into the barrage. |
| @2300 | `[N]` `piano-bomber` crosses left to right. |
| @2616 | Checkpoint. `LOCK 2616–3000`. `crate @2640 (S)` on the pontoon. Boss `encore` (10.1) steams in from the right (300-tick entrance: horn toots, the far-bank crowd cheers). Music `boss`. The invisible body wall at x 2844 (10.1) stands until the boss's death sequence. |
| boss dead | `MISSION COMPLETE!` → tally (13.11). |

Swan geometry, tells and on-foot checks for this layout: `docs/design/swan-mount/levels.md`
§3.3–§3.4. Every required Swan check (reach, headroom, tells, the slipway stomp, the minefield
by shot or by the duck-float) passes from −15 % to +15 % of the 8.2 numbers; at the low corner
the tank leap ends on the tank's hull top, which is safe (a standable solid). The optional BOAT
HOP chain (at the low corner the bounce carries her 54 px, the boats are 72 px
apart) and the full glide over the minefield (at the low corner she lands at x 2469, in the
barrage) need the 8.2 values or more: see the tuning floor (15.9 item 7).

### 11.2 m2 — DUNE BUGLE

- **Biome and mood:** the Rattlebone Flats at noon: orange dunes, red mesas, a dry riverbed, a
  canyon and a quarry shaped like a drum. Palette: ochre and `sand`, burnt `orange`, `rust`, a pale
  white-hot sky, with Mrs. Dollop's pastel `pink` van as the bright contrast.
- **Music:** `m2`; mini-boss `mini-boss`; boss `boss`. **Announcer at start:**
  `"MISSION TWO. STAY HYDRATED, CYGNETS!"`
- **Hostages per route:** 8 (`a` 3 incl. `dollop`, `b` 1, `c1`/`c2` 2, `d` 2 incl. the `composer`).
  **Golden record and composer:** `m2-d`, behind the cracked quarry wall.

#### `m2-a` — Rattlebone Flats · 2400×216 · scroll right · checkpoints 1200

- **Terrain:** rolling dunes around y 176 (bumps 16 px high, 200 px long, x 0–1000); a dry
  riverbed dip to y 196 at x 1000–1150 (1:2 slopes in and out); dunes again x 1150–2200; flat
  oasis x 2200–2400. Solids (`rock`): outcrops 680–720 and 1280–1320 (y 152–176); sandbags
  1928–1952 (y 164–176); Dollop's shed 2290–2354 (y 128–176) with palm trees (decor).
- **Background:** `sky-gradient {white-hot horizon snow[3] → pale cyan sky[3]}` 0 ·
  `clouds {sparse}` 0.05 · `mountains {flat-topped mesas, rust-orange}` 0.15 · `dunes {ochre}` 0.3 ·
  `dunes {light sand, offsetY 20}` 0.5.
- **Terrain style:** `sand / sand / rock / rock`.

| Trigger | Events |
|---|---|
| start | Players drop in at x 48. Card `MISSION 3` / `START!`. |
| @0 | 3 `rifleman` (`outfit: desert`): one gag `nap` under a parasol (decor) @320, a pair gag `cards` @420 and @444 (`card-table` @432). `crate @260 (M)`. |
| @200 | 2 `rattler` hidden @520, @620. |
| @400 | `anthem-speaker` @760. 3 `rifleman` @800, @850, @900. `triangle` @820, gag `counting`. |
| @600 | `crate @700 (S)` on the outcrop (y 152). hostage `critic/chair @880 (H)`. |
| @800 | 2 `cymbalist` walk from `R+16`. `[N]` `oompah-trooper` from `R+16`. |
| @1000 | Riverbed: 3 `rattler` @1040, @1090, @1130. `crate @1150 (bombs)`. |
| @1200 | Checkpoint. `band-truck` to stopX 1500 (cargo 3 `rifleman`, 1 `drummer`). hostage `tourist/sack @1600 (auto)`. |
| @1500 | **PARADE COLUMN (desert)** from `R+16`: `drummer`, 4 `rifleman`, `baton-major` at the back. |
| @1800 | `gramophone-mortar` on a dune crest @2000. 2 `rifleman` crouching behind the sandbags @1960. |
| @2016 | `LOCK 2016–2400`. **Dollop's Oasis:** hostage `dollop/chair @2300` in front of the shed. 5 `rifleman` around her, gag `ice-cream` (@2230, 2250, 2270, 2330, 2350; they drop their cones on alert), `baton-major` @2370. `WAIT dead` and Mrs. Dollop freed: bubbles `THEY ATE ALL MY SPRINKLES!` then `TAKE MY VAN. NOT A SCRATCH, MIND!` The shed doors open and the `sundae-driver` rolls out to x 2260 (`[2P]` a second van to x 2320). `UNLOCK`. |
| exit | rect (2380–2400, 0–216) → `b` (a rider keeps the van). |

#### `m2-b` — Rocky Road · 3600×216 · scroll right · checkpoints 1200, 2400, 3216 · vehicles allowed: `sundae-driver`

- **Terrain:** long dunes with ramps (slopes up to 1:2) for van jumps, no pits; rocks (solids
  24×16, `rock`) at 888–912, 1688–1712, 2488–2512 to hop. The mini-boss arena (3216–3600) is flat
  sand at y 176 with two low dunes (16 px bumps) at 3260–3320 and 3360–3420 as cover. The fork
  inside the arena: the ground dips from (3480,176) to (3600,196); a rock ramp (sloped one-way platform, `rock`) climbs from
  (3420,176) to (3560,104) and runs flat to 3600.
- **Background:** as `m2-a`, plus `cacti` *(custom: saguaro silhouettes, dark green-brown)* 0.8.
- **Terrain style:** `sand / sand / rock / rock`.

| Trigger | Events |
|---|---|
| start | Players who arrive on foot find a van waiting at x 120 with its engine running (`[2P]` a second at x 60). |
| @0 | 2 `rattler` @400, @500. 3 `rifleman`, entry `run`, chase the van from `L-16`. |
| @300 | `oompah-tank` from `R+48` to stopX 900. 2 `bassoonist` on a dune crest @700, @760. |
| @700 | **Overtake:** a `band-truck` drives past from `L-48` at 3 px/tick, stops ahead at 1200 and unloads 3 `rifleman` + 1 `cymbalist`. |
| @1000 | 2 `gramophone-mortar` @1300, @1420. 2 `rattler` @1250, @1350. |
| @1200 | Checkpoint. |
| @1300 | 6 `windup-bot` march in a line toward the van from `R+16` (crush all six in one run: **STRIKE!** +1,000). |
| @1600 | `oompah-tank` from `R+48` to stopX 2100; `[N]` a second `oompah-tank` from `L-48` 120 ticks later, stopX = camera left + 64. |
| @2000 | `anthem-speaker` @2200. 4 `rifleman` @2240–2320, 1 `oompah-trooper` @2350. (If the JINGLE plays during the anthem, the soldiers salute with one hand and hold out a coin with the other: cosmetic.) |
| @2400 | Checkpoint. 3 `bassoonist` in a line @2650, @2700, @2750. `crate @2600 (bombs)` (+10 shells when riding). |
| @2800 | hostage `roadie/cage @2900 (repair)`, hanging from a Legion oil derrick (rope top y 60); he carries the oil can out like an amp case. |
| @3216 | Checkpoint. `LOCK 3216–3600`. Mini-boss `golden-goose` (9.4) walks in from the right edge and honks. Music `mini-boss`. `WAIT` boss dead. Signs `CANYON ↓` (over the dip) and `MESA ↑` (over the ramp). `UNLOCK`. |
| exits | `c1`: rect (3560–3600, 150–216) at the bottom of the dip. `c2`: rect (3560–3600, 40–104) at the top of the ramp. The van may take either. |

#### `m2-c1` — Canyon Floor (lower route) · 2200×216 · scroll right · checkpoints 900 · vehicles allowed: `sundae-driver`

- **Terrain:** canyon floor y 176, except a slope rising from (400,176) to (600,152) and flat at
  152 to 700, then back down to 176 at 760 (rolling drums come down it). Overhang (solid) x 300–500,
  y 0–60. A cave x 900–1300 with a ceiling (solid y 0–100; the van fits). Rock ledges (platforms
  `rock`, y 120) 780–880 (it ends before the cave ceiling) and 1650–1760.
- **Background:** `sky-gradient {narrow strip of hot sky, offsetY −60}` 0 · `canyon-walls`
  *(custom: striped red-orange rock walls)* 0.3 · `canyon-walls {darker}` 0.6 · `rock-pillars`
  *(custom, front: true, sparse dark pillars)* 1.3.
- **Terrain style:** `rock / sand / rock / rock`.

| Trigger | Events |
|---|---|
| @0 | 2 `rattler` @200, @260. `crate @300 (L)`. |
| @250 | 2 `cymbalist` + 2 `rifleman` walk from `R+16`. |
| @450 | 3 `rolling-drum` roll down the slope from `R+16`, 60 ticks apart. |
| @650 | hostage `critic/chair @820 (M)`. `bassoonist` on the ledge @830 (y 120). |
| @900 | Checkpoint. In the cave: 5 `windup-bot` from `R+16`. `oompah-tank` from `R+48` to stopX 1250. |
| @1300 | hostage `tea-lady/chair @1450 (auto)`. 3 `rattler` @1500, @1550, @1600. |
| @1500 | `gramophone-mortar` on the ledge @1700 (y 120). 3 `rifleman`, entry `parachute`, @1600, @1660, @1720. |
| @1816 | `LOCK 1816–2200`: 4 `rifleman` + 2 `drummer` from `R+16`, `[N]` +1 `oompah-trooper`. `WAIT dead`. `UNLOCK`. |
| exit | rect (2180–2200, 0–216) → `d`. |

#### `m2-c2` — Mesa Top (upper route) · 2200×216 · scroll right · checkpoints 1000 · vehicles allowed: `sundae-driver`

- **Terrain:** mesa tops (ground, y 150) x 0–420, 560–1100, 1260–1500, 1640–2200; rope bridges
  (platforms `wood`, y 150) over the gaps 420–560, 1100–1260, 1500–1640. Under every bridge a
  Legion training net (`spring-awning`, variant `net`, y 206) bounces a falling player back up.
  Vehicles never fall (bridges carry them).
- **Background:** `sky-gradient {wide deep-blue sky}` 0 · `clouds {high}` 0.05 · `mountains {far
  mesas}` 0.1 · `dunes {far below, offsetY 60}` 0.25; wind-streak particles.
- **Terrain style:** `rock / sand / wood / rock`.

| Trigger | Events |
|---|---|
| @0 | `baton-copter` from `R+32`. `crate @200 (bombs)`. |
| @200 | 3 `rifleman` @600, @650, @700. `triangle` @520, gag `counting`. |
| @400 | `piano-bomber` crosses right to left (3 pianos). `crate @640 (H)`. |
| @650 | hostage `tourist/sack @800 (auto)`. 2 `bassoonist` @900, @960. |
| @1000 | Checkpoint. `baton-copter`; `[N]` a second `baton-copter`. |
| @1300 | hostage `critic/cage @1450 (M)`, hanging under a signpost (rope top y 80). |
| @1500 | `piano-bomber` crosses left to right. 4 `rifleman`, entry `parachute`, @1700, @1760, @1820, @1880. |
| @1816 | `LOCK 1816–2200`: 2 `baton-copter` + 2 `cymbalist` + 2 `rifleman`. `WAIT dead`. `UNLOCK`. |
| exit | rect (2180–2200, 0–216) → `d` (a ramp down into the quarry). |

#### `m2-d` — The Drum Quarry · 2000×216 · scroll right · checkpoints 1000, 1600 · vehicles allowed: `sundae-driver`

- **Terrain:** quarry floor y 176; scaffolds (platforms `metal`, y 120) 760–880 and 1240–1340;
  a cracked part of the quarry wall at x 628–652 (`breakable-wall`, `solid: false`, 200 HP); the
  boss arena 1600–1984 with two sandstone ledges (platforms `rock`, y 132) 1624–1688 and 1740–1804
  and a quarry wall (solid) x 1984–2000, y 0–176.
- **Background:** `sky-gradient` 0 · `dunes` 0.15 · `quarry-terraces` *(custom: stepped orange
  rock, cranes, a giant crimson drum banner)* 0.3.
- **Terrain style:** `rock / sand / metal / metal`.

| Trigger | Events |
|---|---|
| @0 | 4 `rifleman`: a pair gag `cards` @300 and @324 (`card-table` @312), one gag `nap` @360, one gag `kazoo` @420. |
| @300 | 2 `drummer` + 1 `cymbalist` from `R+16`. `crate @500 (R)`. |
| @500 | **Secret:** the cracked wall @640 — broken, it reveals a niche: hostage `composer/chair @652 (1up)` and `pickup-gem` `golden-record` @664. |
| @800 | `oompah-tank` from `R+48` to stopX 1150. 2 `bassoonist` on the scaffold @780, @840 (y 120). |
| @1000 | Checkpoint. hostage `critic/chair @1200 (S)`. 3 `rifleman` walk from `R+16`. |
| @1300 | `band-truck` to stopX 1500 (cargo 2 `rifleman`, 1 `oompah-trooper`, 1 `cymbalist`). |
| @1600 | Checkpoint. `LOCK 1600–1984`. `crate @1640 (M)`. Boss `ba-dum-behemoth` (10.2) rolls in from the right to a drum fill. Music `boss`. |
| boss dead | `MISSION COMPLETE!` → tally. If a van survived: Mrs. Dollop on the radio `NOT A SCRATCH! YOU'RE ALL GETTING FREE CONES.` |

### 11.3 m3 — THE HIGH NOTE

- **Biome and mood:** Mount Murmur, an alpine ski resort taken over by the Woodwinds: snow, pines,
  chalets with crimson banners, a frozen pond, a cliff face, ice caves and a cable-car summit at
  sunset. Palette: `snow` white and ice blue, deep pine `green`, warm chalet wood (`brown`),
  crimson; a peach-pink (`pink`, `orange`) sky at the summit.
- **Music:** `m3`; boss `boss`. **Announcer at start:** `"MISSION THREE. WRAP UP WARM, CYGNETS!"`
- **Hostages per route:** 8 (`a` 4 incl. the `composer`, `b1`/`b2` 3, `c` 1).
  **Golden record:** `m3-b1` helium niche / `m3-b2` cracked crystal wall (one per route).
- **Mission-runtime need:** an `ice` flag on ground ranges (`iceRanges: [x0, x1][]` in the section
  data): players and the Swan get deceleration 0.05 px/tick² there (drawn with an `ice` decor
  sheet over the snow). Also: the avalanche pursuit rule (9.5, `m3-a`), and **SHE TOOK THE
  LIFT**: when `m3-a` ends, a record of every swan still in one piece (parked, empty or ridden;
  not destroyed, not migrated), one entry per swan as `{ variant: 'ivory' | 'mute', cells,
  shells }`, at most 2, which `m3-c` reads at its start. (The session's `VehicleCarry`,
  `{ id, cells, shells }`, has no variant, so this record is its own.)

#### `m3-a` — Yodel Valley · 3000×216 · scroll right · checkpoints 1300, 2300 · vehicles allowed: `swan`

- **Terrain:** `at(0,176)`, two snow bumps 12 px high at x 200–400 and 500–700, flat to 1700
  (the chalets and the frozen pond on it). **The piste**, a long gentle downhill with three moguls
  (8–10 px; the Swan strides over them with her 12 px step-up), through the ground points
  (1700,176) (1820,181) (1850,173) (1880,182) (1980,186) (2010,178) (2040,188) (2140,193)
  (2170,185) (2200,195) (2290,204). **The kicker** up to the lip (2330,190), a `step(14)` down to
  (2330,204), the flat **landing valley** at y 204 to 2540, a climb to (2620,176), flat base camp
  to 3000. The cliff at x 3000 is the section's right wall. The kicker lip is low on purpose: from
  y 190 a full Swan jump lifts the rider's head top only to y 24–28 (190 − 93.8 − 68…72 [engine]),
  so the whole ski jump stays in view.
  Solids (`rock`): chalet 880–944 and chalet 1030–1094 (y 136–176) with roof platforms (`wood`)
  at y 120 (880–944) and y 110 (1030–1094). A third chalet at 1160–1240 is decor with its back
  door a `breakable-wall` (`solid: false`) at 1180–1204. A boulder on the piste: 1910–1958
  (y 162–186, 21–23 px above the piste). There is no second boulder: one at 2232–2264 (14–17 px
  above the piste, over her 12 px step-up) made a sprinting Swan hurdle it from x 2112–2212 and
  land at 2289–2386 [engine], mostly past the lip, so she skipped the kicker. **Ice range**
  1340–1700 (the frozen pond).
  Cliff ladder steps (platforms `wood`): 2880–2930 y 140, 2900–2960 y 104.
- **Background:** `sky-gradient {cold blue sky[2] → pale peach horizon}` 0 · `ice-peaks {white and
  blue}` 0.1 · `clouds` 0.15 · `treeline {snowy pines}` 0.35 · `chalets` *(custom: wooden chalets
  with crimson banners)* 0.55.
- **Terrain style:** `snow / snow / wood / rock`.
- **Decor:** a Legion sign `PISTE CLOSED` at the top of the piste (x 1712); a blue K-line painted
  across the valley snow at x 2420 and a red one at x 2540, the foot of the climb; a small judges'
  stand on the climb at x 2560 with three cardboard judges who hold up `9.5` cards after a STYLE
  landing.

| Trigger | Events |
|---|---|
| start | Card `MISSION 4`. The `swan` arrives by cargo parachute at x 200 wearing Mittens' knitted socks (`params.socks: true`; `[2P]` the Mute, also in socks, at x 152). Bubble: `MITTENS KNITTED HER SOCKS.` `crate @300 (M)`. |
| @0 | 3 `rifleman` (`outfit: snow`), entry `ski`, from `R+16` (each crashes into a snowbank first). |
| @250 | 4 `windup-bot` (variant `ski`) downhill from `R+16`. |
| @450 | 2 `cymbalist` from `R+16`. `triangle` @700, gag `counting`. `crate @620 (S)`. |
| @700 | 2 `ram-goat` on the chalet roofs @900 (y 120) and @1050 (y 110). (A Swan lands on roof 1 with one jump, 56 px up, and stomps the goat on roof 2 from there.) |
| @900 | hostage `critic/chair @1100 (H)`. 2 `bassoonist` @1280, @1320 (they target the Swan). **Secret:** the chalet back door @1180 — broken, it reveals hostage `composer/chair @1200 (1up)`. |
| @1300 | Checkpoint. **Skating parade:** on the frozen pond a `baton-major` leads 4 `rifleman` skating in a line (entry `skate`); on alert they shoot while sliding. |
| @1460 | hostage `tourist/sack @1600 (auto)` on the ice. `crate @1934 (bombs)` on the first boulder (y 162). |
| @1600 | **AVALANCHE!** Rumble (`env/avalanche`), shake 2 px for 60 ticks, banner `AVALANCHE!`; then an `avalanche` (`speed: 1.0`, `maxSpeed: 3.0`, `holdX: 40`, `gap: 104`, `stopX: 2540`) rolls in at the left edge of the view (front at view x 8, and never closer than 104 px to a player) and **chases** (9.5): it holds the left part of the view (view x 32–40) at any player speed, but it gains on a player only at 1.0 px/tick and only while that player is slower. Anyone who keeps moving right (on foot 1.5 px/tick, a Swan 2.6) is never caught; a player who stops is caught after about 90–110 ticks. It swallows enemies it touches (+200 SET PIECE each to the nearest player). Respawns land at least 160 px right of its front. When its front reaches x 2540 it smashes into the rock face at the foot of the base-camp climb (decor), shake 6 px, white flash 20 ticks, and stops: its kill zone switches off and a snow mound stays (decor). |
| @1660 | 3 `ram-goat` from `R+16`, 45 ticks apart: each trots in at 0.8 px/tick, paws for its full telegraph (T 40) and charges up the piste at 3 px/tick. A goat that misses runs on into the avalanche (+200 SET PIECE). Spawn points (camera left + 400): with a sprinting Swan (camera 2.6 px/tick) x 2060, 2177 and 2294; on foot (1.5) x 2060, 2128 and 2195; all on the piste, left of the lip (2330). (At 90 ticks apart the third goat spawned at x 2528, in the landing valley behind the 14 px kicker step, and never charged.) |
| @1700 | 1 `baton-copter` (`mode: 'air'`: level flight, aimed note spreads) flies in from `R+16` at y 40 and crosses left over the piste at 1.2 px/tick. A sprinting Swan passes under it and shoots it up (−90°); as it falls behind she jumps and aims up and back (−135°): in the air she keeps her forward drift (on the ground up + back would make her back-pedal toward the avalanche). If it lives, the avalanche swallows it (+200 SET PIECE). On foot: shoot it up. With the 3 goats there are at most 4 attackers at once (NORMAL has 4 attack tokens; on EASY one of them waits, 4.11). No new art or sound. |
| @1880 | 2 `bassoonist` in the landing valley @2450 and @2510 (y 204). `crate @2500 (bombs)`. **Glide trail:** 7 `golden-note` (`params.float: true`, 7.1) at (2378, 110), (2404, 97), (2429, 95), (2451, 99), (2473, 108), (2495, 118), (2517, 128). |
| @2000 | **SKI JUMP:** take off from the kicker (x 2290–2330). On foot, land beyond the blue K-line (x 2420); riding a Swan, open the wings in the air and land beyond the red K-line (x 2540); either way without taking a hit while airborne: `STYLE POINTS 9.5!` +2,000 (once per player); the cardboard judges raise their cards. (From the lip a run-up on foot lands at x 2444, +24 px. From the lip at 2.6 px/tick [engine]: a Swan with no wings lands at 2507, 33 px short; a 1-tick flap at 2513; a glide of 20 ticks with forward held after it (28 ticks with no input) passes the line; a full glide lands at 2589–2595, +49–55 px. The red line assumes the tuning floor of 15.9 item 7.) |
| @2300 | Checkpoint. hostage `roadie/cage @2700 (F)`, hanging from a ski-lift pylon (rope top y 60). |
| @2616 | `LOCK 2616–3000`. **Base camp:** 5 `rifleman`, 2 `cymbalist`, 1 `baton-major` (from x 2992 and out of two tents at 2800 and 2900, entry `window`). `WAIT dead`. Signs `NORTH FACE ↑` (over the ladder) and `CAVES →` (over the cave mouth). `UNLOCK`. **The Swan can't climb:** after the `UNLOCK` an invisible Swan-only body wall stands at x 2860 (a clamp like the ENCORE wall, 10.1; players on foot pass it; for a SWAN DIVE it counts as a wall). A ridden Swan that touches it on the ground stops and her pilot is ejected; in the air the wall only stops her, so she can never reach the ladder steps (y 140 and 104) or the `b1` exit rect while ridden. Then: radio bubble `GRAMPS: "SHE DOESN'T DO CLIFFS. PARK HER."`; the Swan sits down and waves her head goodbye. Before the `UNLOCK` there is no wall and no eject, so riders can chase the soldiers out of the tents at x 2800 and 2900. When the section ends, every swan still in one piece is recorded for `m3-c` (SHE TOOK THE LIFT, 11.3). |
| exits | `b1`: rect (2930–2970, 40–100), the top of the rope ladder. `b2`: rect (2976–3000, 136–176), the cave mouth at the foot of the cliff. |

Swan checks for this layout (reach, headroom, the chase and the K-lines):
`docs/design/swan-mount/levels.md` §4.3–§4.5. Every required check passes from −15 % to +15 % of
the 8.2 numbers. The red K-line (x 2540, a bonus) assumes the tuning floor of 15.9 item 7: at the
low corner only a near-full glide passes it (2546).

#### `m3-b1` — North Face (vertical) · 384×1800 · scroll up · checkpoints y 900, 400

- **Terrain:** rock walls (solids) x 0–24 and 360–384 for the full height; bottom ground at
  y 1776. Ice ledges (platforms `ice`): **lower stack** k = 1…10 at y = 1776 − 36k (1740 … 1416),
  odd k at x 24–200, even k at x 184–360. **Cable car** (`cable-car`, 64×8) at x 250–314, y 1400;
  it rises to y 900 at 0.5 px/tick while a player stands on it and then stays there. Side ledges
  (platforms 24–96) at y 1300, 1150, 1000 (enemy perches). **Upper stack** k = 1…24 at
  y = 900 − 36k (864 … 36), odd k at x 184–360, even k at x 24–200. **Secret niche** (platform
  24–56, y 1380): only a Helium Head jump from the k = 9 ledge (y 1452) reaches it.
- **Wind gusts:** every 480 ticks (every 360 above y 700): snow streaks for 60 ticks
  (`env/wind`), then a push to the left at 0.4 px/tick for 120 ticks.
- **Background:** `sky-gradient {deep blue at the top → peach at the bottom}` factorY 0.2 ·
  `ice-peaks` factorY 0.1 · `clouds {drifting}` factorX 0.1, factorY 0.3.
- **Terrain style:** `rock / snow / ice / rock`. Player start (192, 1776).

| Trigger | Events |
|---|---|
| start | 2 `rifleman` (`outfit: snow`) on the ledges at y 1668 and 1632. |
| @1560 | `ram-goat` on the ledge (288, 1560), charging left. `crate (96, 1596) (bombs)`. |
| @1400 | `piccolo` prone at (320, 1488). `helium-tank` at (100, 1452). **Secret:** `pickup-gem` `golden-record` in the niche (40, 1380). |
| @1250 | **Cable-car ride** (the car at y 1400 rises to y 900): during the ride 2 `baton-copter` attack from the sides; `[N]` 2 `rifleman` parachute past it onto the side ledges. |
| @900 | Checkpoint. hostage `critic/chair (300, 792) (L)`. 2 `ram-goat` at (100, 756) and (280, 720). |
| @700 | Gusts every 360 ticks. 2 `piccolo` at (60, 612) and (330, 576). `crate (200, 648) (M)`. hostage `tea-lady/chair (120, 540) (auto)` (she pours from a thermos). |
| @400 | Checkpoint. hostage `roadie/cage (250, 360) (H)`, hanging from a pine branch; the cage falls onto the ledge at y 432. |
| @300 | `baton-major` + 3 `rifleman` on the top ledges (y 36–144). `bassoonist` at (330, 144). `WAIT dead`. |
| exit | top rect (140–244, 0–24) → `c`. |

#### `m3-b2` — Echo Caves (vertical) · 384×1800 · scroll up · checkpoints y 950, 420

- **Terrain:** crystal walls (solids) x 0–24 and 360–384; bottom ground at y 1776. Crystal ledges
  (platforms `rock`) k = 1…48 at y = 1776 − 36k (1740 … 48), odd k at x 24–200, even k at
  x 184–360. A cracked crystal wall (`breakable-wall`, `solid: false`) at (340, 1128). An
  underground waterfall (decor). The **Icicle Organ:** 8 `icicle` props hang with their tops at
  y 808 (between the k = 27 and k = 26 ledges, clear of both), x = 60 + 38i (i = 0…7).
- **Rising meltwater** (from the checkpoint at y 950): a `rising-water` kill surface starts at
  y 1300 and rises 0.3 px/tick; it is never more than 48 px below the view bottom (it jumps up to
  view bottom + 48 when it falls behind). During the final `WAIT dead` it rises 0.15 px/tick into
  the view, at most 48 px above the view bottom. Banner `THE ICE IS MELTING! CLIMB!`
- **Background:** `ice-cave {dark far layer}` factorY 0.15 · `ice-cave` *(custom: blue-violet
  crystal walls with softly glowing crystals)* factorY 0.3; sky colour `purple[0]`.
- **Terrain style:** `ice / snow / rock / rock`. Player start (192, 1776).

| Trigger | Events |
|---|---|
| start | 3 `echo-bat` hanging under the ledges at (100, 1600), (190, 1600) and (300, 1564). |
| @1560 | 4 `windup-bot` marching along the ledge y 1524. `crate (300, 1488) (T)`. |
| @1400 | `metronome-turret` hanging under the ledge at (192, 1348). 4 `echo-bat`. |
| @1250 | **Secret:** the cracked crystal wall at (340, 1128) — broken, it reveals a `pickup-gem` `golden-record` there. |
| @1100 | hostage `critic/chair (64, 1092) (S)`. `bassoonist` at (300, 984). |
| @950 | Checkpoint. The meltwater starts rising. **The Icicle Organ:** each shot icicle plays one note (a rising major scale from left to right). Shooting all 8 from left to right in order spawns 10 `golden-note` and a `gem` on the ledge below; any other order just breaks them. |
| @760 | 6 `echo-bat` (sine swarm). hostage `tea-lady/chair (300, 696) (auto)`. |
| @600 | 3 `rifleman` + 1 `cymbalist` on the ledges at y 588 and 552. `metronome-turret` hanging under the ledge at (100, 520). |
| @420 | Checkpoint. hostage `roadie/cage (192, 412) (M)`, hanging under the ledge at y 408; the cage falls onto the ledge at y 444. |
| @250 | `baton-major` + 2 `bassoonist` on the ledges at y 264 and 228. 4 `echo-bat`. `WAIT dead`. |
| exit | top rect (140–244, 0–24) → `c`. |

#### `m3-c` — Summit Station · 1280×216 · scroll right · checkpoints 880

- **Terrain:** snowy path y 176; the station roof (platform `metal`, 780–880, y 120); the summit
  deck arena 896–1280 with the station hut (solid 912–952, y 136–176) and two snow piles (solids
  24×16 at 1034–1058 and 1134–1158) (10.3). A cable-car cabin (decor `decor/m3/cable-car-cabin`,
  64×40, doors open) stands at x 140–204 under the station cable.
- **Background:** `sky-gradient {sunset: orange horizon → pink → violet top}` 0 · `clouds {pink}`
  0.1 · `ice-peaks` 0.2 · `cable-cars` *(custom: cables with small cars crossing)* 0.5.
- **Terrain style:** `snow / snow / metal / concrete`.

| Trigger | Events |
|---|---|
| start | Players climb out at (48, 176). **SHE TOOK THE LIFT:** for each swan recorded at the end of `m3-a` (11.3), a `swan` sits parked next to the cable-car cabin with the cells and shells she had, still in her socks (`socks: true`): the ivory swan at x 120 and the Mute (`variant: 'mute'`) at x 76, each only if recorded. `env/train-bell` dings once; radio bubble `GRAMPS: "SHE TOOK THE LIFT."` (if Gramps is a player: `GOOD GIRL.`). With no record there is no swan and no bubble, and the fight is played on foot as designed. 3 `rifleman` (`outfit: snow`) @240–320, one with gag `snowman` @300. |
| @200 | 2 `ram-goat` from `R+16`. `crate @400 (bombs)`. |
| @400 | hostage `critic/chair @560 (R)`. `triangle` @640, gag `counting`. 2 `rifleman` from `R+16`. |
| @600 | 5 `windup-bot` (variant `ski`) from `R+16`. `bassoonist` on the station roof @820 (y 120). |
| @880 | Checkpoint. |
| @896 | `LOCK 896–1280`. `crate @932 (L)` on the hut roof. Boss `windbag` (10.3) rises from below the summit edge. Music `boss`. |
| boss dead | `MISSION COMPLETE!` → tally. |

### 11.4 m4 — OPENING NIGHT

- **Biome and mood:** Fanfaroni City (formerly Little Hushing) at night. Every neon sign says
  FANFARONI; statues of the Marshal line the avenue; a parade on the boulevard; a subway;
  rooftop billboards; the Opera House. Palette: deep `navy` and violet (`purple`) night, neon
  `pink`, cyan (`teal` light) and gold, crimson banners, warm window light (`gold`).
- **Music:** `m4`; mini-boss `mini-boss`; boss `boss`. **Announcer at start:**
  `"MISSION FOUR. BREAK A LEG, CYGNETS!"`
- **Hostages per route:** 10 (`a` 3, `b` 2, `c1`/`c2` 2, `d` 3 incl. the `composer`).
  **Golden record:** `m4-a` high balcony (Helium Head). **Composer:** `m4-d` cloakroom.

#### `m4-a` — Avenue of Statues · 2800×216 · scroll right · checkpoints 1200, 2100

- **Terrain:** avenue `at(0,176).flat(2800)`. Statue plinths (solids `brick` 32×40, y 136–176)
  at 484–516, 1184–1216, 1884–1916, each with a `statue-head` on top. Balconies (platforms
  `metal`, y 120): 980–1040, 1130–1190, 1680–1740. **High balcony** (platform 540–600, y 64):
  only a Helium Head jump from the first plinth top (y 136) reaches it. The arena 2416–2800 is a wide plaza.
- **Background:** `sky-gradient {navy → violet}` 0 · `clouds {thin, night colours}` 0.05 ·
  `city {far skyline, lit windows}` 0.25 · `city {nearer}` 0.5 · `neon-signs` *(custom: signs
  `FANFARONI LAUNDRY`, `FANFARONI BAKERY`, `FANFARONI AVENUE`, one crossed-out `LITTLE HUSHING`)*
  0.7.
- **Terrain style:** `concrete / tiles / metal / brick`.

| Trigger | Events |
|---|---|
| start | Card `MISSION 5`. Players drop in at x 48. |
| @0 | 3 `rifleman` (`outfit: night`) @300, @330, @360, gag `rehearse`. `anthem-speaker` @420. `crate @200 (M)`. |
| @200 | `drummer` + 2 `rifleman` from `R+16`. |
| @400 | `helium-tank` @640. **Secret:** `pickup-gem` `golden-record` on the high balcony (570, 64). |
| @560 | hostage `critic/chair @760 (S)`. |
| @700 | `band-truck` to stopX 1100 (cargo 2 `rifleman`, 1 `cymbalist`, 1 `oompah-trooper`). |
| @900 | 2 `piccolo` on the balconies @1000 and @1150 (y 120). `crate @1050 (H)`. |
| @1200 | Checkpoint. **GRAND PARADE COLUMN** from `R+16`: `drummer`, 4 `rifleman`, `oompah-trooper`, `baton-major`, marching in step (kill the drummer first: the whole column stumbles). |
| @1500 | `gramophone-mortar` on the balcony @1700 (y 120). hostage `tourist/sack @1600 (auto)`. |
| @1700 | **Triangle duet:** 2 `triangle` @1850, @1880, gag `counting` (they ding in harmony; if either finishes, the alarm calls 6 `rifleman`). 3 `rifleman` from `R+16`. |
| @1900 | hostage `roadie/cage @2000 (T)`, hanging from a lamp post (rope top y 60). |
| @2100 | Checkpoint. `crate @2300 (bombs)`. |
| @2416 | `LOCK 2416–2800`. `crate @2440 (R)`. Mini-boss `big-head` (9.4) floats in from the right. Music `mini-boss`. `WAIT` boss dead. `UNLOCK`. |
| exit | rect (2780–2800, 0–216) → `b`. |

#### `m4-b` — Bandwagon Boulevard · 3600×216 · scroll right · checkpoints 1300, 2400, 3216 · vehicles allowed: `bandwagon`

- **Terrain:** boulevard `at(0,176)` flat, with two low ramps (12 px bumps) at 1440–1560 and
  2540–2660. Balconies (platforms `metal`, y 112) 1100–1300; rooftops above the road (platforms
  y 96) 1880–1940 and 1980–2040. The subway stairs: a ground gap 3440–3480 covered by a `hatch`
  until the barricade fight ends. A `drum-barricade` (32×64) at 3496–3528 (y 112–176). Fire-escape
  steps (platforms `metal`): 3530–3570 y 140, 3550–3600 y 104, 3560–3600 y 68.
- **Background:** as `m4-a` with more neon · `crowd-barrier` *(custom: barriers with cheering
  silhouettes)* 0.9; confetti particles.
- **Terrain style:** `concrete / tiles / metal / metal`.

| Trigger | Events |
|---|---|
| start | The `bandwagon` is parked at x 120 with its engine running and a sign `NOW UNDER NEW MANAGEMENT` (`[2P]` a second at x 40). |
| @0 | 4 `rifleman` from `R+16`. |
| @300 | `oompah-tank` from `R+48` to stopX 800. `anthem-speaker` @600 with 3 `rifleman` @640, @670, @700. |
| @700 | **Parade floats:** 2 `parade-float` (a giant tuba float and a giant drum float) drive left at 0.5 px/tick from `R+48`, 2 `rifleman` riding each (entry `float`). hostage `critic/float (M)` tied to the mast of the second float (stored while riding). |
| @1100 | 3 `bassoonist` on the balconies @1150, @1200, @1250 (y 112; anti-vehicle). |
| @1300 | Checkpoint. 2 `oompah-tank` from `R+48` (stopX 1700 and 1800). 6 `windup-bot` from `R+16` (crush all six: **STRIKE!** +1,000). |
| @1700 | 2 `gramophone-mortar` on the rooftops @1910 and @2010 (y 96). |
| @2000 | A third `parade-float` with hostage `tea-lady/float (repair)`. |
| @2400 | Checkpoint. **Battle of the Bands:** a `band-truck` drives head-on from `R+48` at 2 px/tick, honking in rhythm with the music; if it reaches the Bandwagon it rams it (big hit) and explodes. |
| @2900 | `oompah-tank` from `R+48` (stopX 3200). 2 `bassoonist` @3100, @3150. `anthem-speaker` @3120. |
| @3216 | Checkpoint. `LOCK 3216–3600`. **Barricade:** 4 `rifleman`, 2 `drummer` and 1 `baton-major` guard the `drum-barricade`. `WAIT dead` **and** the barricade destroyed. The Bandwagon cannot go on (eject, or ram it into the barricade). The subway `hatch` opens. Signs `SUBWAY ↓` and `ROOFTOPS ↑`. `UNLOCK`. |
| exits | `c1`: rect (3440–3480, 176–216), the subway stairs (drop in). `c2`: rect (3560–3600, 20–68), the top of the fire escape. |

#### `m4-c1` — The Underground (lower route) · 2400×216 · scroll right · checkpoints 1000

- **Terrain:** the track bed `at(0,192).flat(2400)`; ceiling solid y 0–40. Station platforms
  (one-way `metal`, y 152): 0–640, 760–1400, 1520–2400 (stairs down to the track at the ends; the
  gaps must be crossed on the track bed). Tiled pillars every 320 px are decor.
- **Trains:** a `subway-train` is a moving `kill` zone 400×40 on the track bed (y 152–192) at
  6 px/tick; players standing on a station platform are safe.
- **Background:** `subway-tiles` *(custom: white tiled walls, FANFARONI posters)* 0.5; sky colour
  `ink[0]`.
- **Terrain style:** `concrete / tiles / metal / concrete`.

| Trigger | Events |
|---|---|
| @0 | 2 `usher-bot` patrolling the platform (ticket inspectors). 2 `rifleman` @300, @340, gag `newspaper` (waiting for a train). |
| @300 | 2 `metronome-turret` on the ceiling @450, @600 (y 40). `crate @520 (F)`. |
| @600 | hostage `critic/chair @820 (B)`. |
| @800 | **TRAIN:** the rails spark, a headlight beam sweeps the tunnel and a bell rings `DING DING` (`env/train-bell`) for 120 ticks → a `subway-train` passes right to left at 6 px/tick (`env/train-pass`). Afterwards 3 `rifleman` stand on the platform @1100–1200 (one still holding a strap). |
| @1000 | Checkpoint. 3 `usher-bot`. 4 `windup-bot` from `R+16`. |
| @1300 | hostage `tourist/sack @1600 (auto)`. `metronome-turret` on the ceiling @1500. |
| @1600 | **TRAIN** from the left (same telegraph). `bassoonist` on a bench @1800. |
| @2016 | `LOCK 2016–2400`: 2 `usher-bot`, 3 `rifleman`, 1 `drummer`. `WAIT dead`. `UNLOCK`. |
| exit | rect (2380–2400, 100–152), the stairs up → `d`. |

#### `m4-c2` — Billboard Rooftops (upper route) · 2400×216 · scroll right · checkpoints 1000

- **Terrain:** rooftops (ground pieces) 0–400 y 150 · 440–900 y 140 · 944–1400 y 156 ·
  1440–1900 y 144 · 1948–2400 y 150; every gap has a `spring-awning` (variant `net`) at y 206.
  Billboard tops (platforms `metal`, y 96): 560–640, 1100–1180, 1560–1640. **Giant billboard**
  top (platform 700–800, y 40): only a Helium Head jump from the first billboard reaches it.
  Water towers (solids 32×48, standable tops): 1000–1032 (y 108–156), 1700–1732 (y 96–144).
- **Background:** `sky-gradient {night}` 0 · `city` 0.25 · `neon-signs {big billboards of
  Fanfaroni whose eyes follow the player}` 0.6.
- **Terrain style:** `metal / rust / metal / brick`.

| Trigger | Events |
|---|---|
| @0 | `kazoo-drone` formation `v`. 2 `rifleman` @250, @300. |
| @300 | `baton-copter`. `crate @600 (L)` on the first billboard top (y 96). |
| @500 | `helium-tank` @620 (y 96). **Secret:** 5 `golden-note` + 1 `gem` on the giant billboard top. |
| @700 | `piano-bomber` crosses right to left. hostage `critic/chair @860 (R)`. |
| @1000 | Checkpoint. 2 `piccolo` on the billboard tops @1140 and @1600 (y 96). `kazoo-drone` formation `sine` (`shooter`). |
| @1300 | `gramophone-mortar` on the water tower @1716 (y 96). hostage `roadie/cage @1500 (M)` hanging from a billboard (rope top y 40). |
| @1600 | `baton-copter`; `[N]` a second one. 3 `rifleman`, entry `parachute`, @1760, @1820, @1880. |
| @2016 | `LOCK 2016–2400`: 2 `kazoo-drone` formations `loop`, 1 `baton-copter`, 2 `rifleman`. `WAIT dead`. `UNLOCK`. |
| exit | rect (2380–2400, 0–216) → `d` (a zip-line down to the Opera House roof). |

#### `m4-d` — The Opera House · 1800×216 · scroll right · checkpoints 1100, 1400

- **Terrain:** lobby and stage `at(0,176).flat(1800)`; a wall (solid) x 1784–1800. The cloakroom
  door at 628–652 (`breakable-wall`, `solid: false`). The stage arena 1400–1784 with the crate
  step and balcony boxes (10.4).
- **Background:** `opera-hall` *(custom: crimson velvet, gold balconies with audience silhouettes,
  chandeliers)* 0.4; sky colour `red[0]`.
- **Terrain style:** `concrete / tiles / wood / brick`.

| Trigger | Events |
|---|---|
| @0 | 2 `usher-bot`. 2 `rifleman` @560, @590, gag `queue` (in line for the cloakroom). `crate @300 (bombs)`. |
| @300 | hostage `critic/chair @500 (S)` in the critics' box (decor). **Secret:** the cloakroom door @640 — broken, it reveals hostage `composer/chair @660 (1up)`. |
| @500 | `pipe-battery` on the wall @800 (the opera's organ pipes, y 100–164). 3 `rifleman` from `R+16`. |
| @800 | 2 `usher-bot` + 1 `drummer`. hostage `tea-lady/chair @1000 (auto)`. |
| @1100 | Checkpoint. 2 `rifleman` + 1 `cymbalist`. A `triangle` in the orchestra pit @1300, gag `counting`. |
| @1400 | Checkpoint. `LOCK 1400–1784`. `crate @1420 (H)`. The curtain rises: boss `grand-grand` (10.4). Music `boss`. |
| boss dead | `MISSION COMPLETE!` → tally. |

### 11.5 m5 — SWAN SONG

- **Biome and mood:** the sky above the clouds from dusk to night, then the inside of the Grand
  Organ (brass pipes, dark walnut, gears, bellows), ending in the console room. Palette: sunset
  `orange` → magenta (`pink`) → indigo (`navy`, `purple`), pink and violet clouds; inside: walnut
  `brown`, brass `gold`, crimson velvet, ivory keys, warm gold lights.
- **Music:** `m5-sky` (`a`), `m5-organ` (`b`, started by the section script), `boss-final` for all
  three final-boss stages. **Announcer at start:** `"FINAL MISSION. FLY GRACEFULLY, CYGNETS!"`
- **Hostages:** 6 (`a` 2 on balloons, `b` 4 incl. the `composer`). **Golden record and composer:**
  `m5-b`, behind a cracked organ panel.
- **Mission-runtime needs:** `autoScroll(speed)` (4.12); players start `m5-a` already mounted in
  Trumpeters.

#### `m5-a` — Above the Clouds (shoot-em-up) · 4400×216 · auto-scroll 1.0 px/tick · checkpoints 1200, 2400, 3600, 4016 · vehicles allowed: `trumpeter`

- **Terrain:** none (open sky). The Trumpeters are clamped 4 px inside the view. Spawns appear at
  view x 400 (just right of the view) at the y given, unless the row says "from L" (view x −16).
- **Background:** `sky-gradient {orange horizon → magenta → indigo top}` 0 · `sea {far below,
  small, offsetY 180}` 0.05 · `clouds {far, pink}` 0.1 · `clouds {mid, violet}` 0.3 ·
  `clouds {near, sparse, front: true, alpha 0.7}` 1.4. The scene darkens over the section: a
  full-screen `navy` fade with alpha 0.3 × camera x / 4016.
- **Respawn:** a new Trumpeter flies in from the left edge (8.5).

| Trigger | Events |
|---|---|
| start | Card `FINAL MISSION`. Players spawn in their Trumpeters at view x 64 (y 80 and 130); `autoScroll(1.0)`; announcer `"TRUMPETER!"`. Radio bubble `GRAMPS: "SHE FLIES! DON'T TELL ACCOUNTING!"` (if Gramps is a player, the first other player says `"YOU MADE HER FLY?!"`). |
| @0 | `kazoo-drone` formation `v` at y 60. |
| @240 | 2 `kazoo-drone` formations `sine` at y 40 and y 140. |
| @480 | 2 `baton-copter` (`mode: 'air'`) at y 50 and 150. |
| @720 | `piano-bomber` (`mode: 'air'`) crosses above at y 20; its pianos fall through the screen (a `!` blinks at the top edge 40 ticks before each drop). |
| @960 | A parachute `crate (bombs)` drifts down at view x 300. |
| @1100 | A parachute `crate (repair)` drifts down at view x 320. |
| @1200 | Checkpoint. 2 `kazoo-drone` formations `loop` (`shooter`). 6 `windup-bot` (variant `fly`) in a line at y 100. |
| @1500 | 2 `kazoo-drone` formations `dive`. |
| @1800 | 2 `piano-bomber` (`mode: 'air'`): one high at y 24, one low at y 150; the players fly between them. |
| @2100 | hostage `tourist/balloon (auto)` at y 60 (SAY CHEESE freezes every enemy for 45 ticks). |
| @2400 | Checkpoint. 3 `baton-copter` (`mode: 'air'`) + 1 `kazoo-drone` formation `v`. |
| @2700 | `piano-bomber` (`mode: 'air'`) + 2 `kazoo-drone` formations `sine`. |
| @2900 | A parachute `crate (bombs)` at view x 300. |
| @3000 | The Grand Organ appears far away: `organ-distant` decor grows over 600 ticks (3 sizes). |
| @3300 | `[N]` 3 `kazoo-drone` formations `dive`. |
| @3600 | Checkpoint. hostage `critic/balloon (auto)` at y 90 (a weapon result becomes +10 dive bombs). |
| @4016 | Checkpoint. `autoScroll(0)`; `LOCK 4016–4400`. A parachute `crate (repair)` drifts in. Final boss stage 1 `grand-organ` (10.5). Music `boss-final`. |
| stage done | The Trumpeters fly into the landing hatch (automatic, 120 ticks) → exit to `b`. |

#### `m5-b` — The Pipe Works (vertical) · 384×1800 · scroll down · checkpoints y 700, 1400

- **Terrain:** pipe walls (solids) x 0–24 and 360–384. The hatch floor (platform 144–240, y 72) at
  the top. Ledges (platforms `metal`) at y = 120 + 48k for k = 0…33 (120 … 1704): even k at
  x 24–240, odd k at x 144–360 (drop-through is the main move). The ledges at k = 10 (y 600) and
  k = 17 (y 936) are replaced by `bellows-platform`s at x 160–224 (they rise and fall 24 px every
  120 ticks, in time with the music). `air-jet` columns (24 wide) at x 40–64, y 1000–1300 and
  x 320–344, y 1400–1700. A cracked organ panel (`breakable-wall`, `solid: false`) at (300, 840).
  Bottom ground `at(0,1784).flat(384)` with the exit door.
- **Background:** `organ-deep` *(custom: dim far pipes)* factorY 0.1 · `organ-pipes` *(custom: rows
  of brass pipes, dark wood, turning gears)* factorY 0.3; sky colour `brown[0]`.
- **Terrain style:** `metal / rust / metal / metal`. Player start (192, 72). `@Y` = camera top ≥ Y.

| Trigger | Events |
|---|---|
| start | The Trumpeters stay parked in the hatch (decor). Music `m5-organ`. 2 `usher-bot` on the first ledge at (60, 120) and (200, 120). |
| @150 | 4 `windup-bot` march along the ledge y 216 and drop to lower ones (they keep marching, unharmed). |
| @300 | `metronome-turret` hanging under the ledge at (192, 316). `crate (200, 360) (M)`. |
| @450 | `anthem-speaker` at (320, 552) (here it plays every 600 ticks). 4 `rifleman` (`outfit: night`) at (60, 504), (120, 504), (200, 552), (260, 552). |
| @600 | hostage `critic/chair (80, 696) (S)`. 4 `echo-bat` (they live in the pipes). |
| @700 | Checkpoint. **Secret:** the cracked panel at (300, 840) — broken, it reveals hostage `composer/chair (300, 840) (1up)` and a `golden-record` at (330, 840). |
| @850 | `pipe-battery` on the right wall at (344, 920). `drummer` + 2 `rifleman` ride the bellows platform at y 936. |
| @1000 | hostage `roadie/cage (192, 1036) (T)`, hanging under the ledge at y 1032; the cage falls onto the ledge at y 1080 — the tuba is perfect for the console fight. |
| @1150 | 2 `usher-bot` (y 1176) + 1 `bassoonist` (y 1224). 1 `kazoo-drone` formation `sine`. |
| @1300 | hostage `tea-lady/chair (300, 1320) (auto)`. `baton-major` + 3 `rifleman` on the ledges at y 1368 and 1416. |
| @1400 | Checkpoint. `crate (200, 1512) (bombs)`. |
| @1450 | The last group on the bottom floor (y 1784): 2 `oompah-trooper` + 2 `cymbalist`. `WAIT dead`; then the exit door opens. |
| exit | rect (150–234, 1760–1784), the bottom door (active after the last group) → `c`. |

#### `m5-c` — The Console · 384×216 · single screen · no checkpoints (stage starts are respawn points)

- **Terrain:** floor `at(0,176).flat(384)`; the three console tiers (platforms `wood`, 10.5) until
  the end of stage 2, then the three `wreck-block`s.
- **Background:** `console-room` *(custom: a cathedral-like hall of giant pipes, a stained-glass
  window of Fanfaroni, gold trim)* 0.2; sky colour `brown[0]`.
- **Terrain style:** `metal / tiles / wood / metal`.

| Trigger | Events |
|---|---|
| start | `LOCK 0–384`. `crate @40 (H)`. Fanfaroni turns on his bench: `AH. THE AUDIENCE HAS ARRIVED.` then `PLEASE HOLD YOUR APPLAUSE. FOREVER.` Final boss stage 2 `organ-console` (10.5). |
| stage 2 done | During the 60-tick intermission a `crate (bombs)` drops at x 40 and a `crate (R)` at x 344. Stage 3 `maestro` starts. |
| stage 3 done | Death sequence (10.5) → ending (2.6) → final tally → credits → name entry. |

---

## 12. Audio

All sounds are synth recipes (`defineSfx`, `docs/api/media.md` §9.1) and all music is original
tracker songs (`defineSong`, §9.2). Every melody is composed for this project: the hooks below are
described in words on purpose, so the music agent writes new notes. **No arrangement of any existing
game, film, folk, classical or pop melody** — that includes wedding marches, national anthems,
ice-cream-van tunes, circus marches, the well-known "sad trombone" phrase and any music of the
reference series. The engine's default sounds (`ui/move`, `ui/confirm`, `ui/cancel`, `ui/pause`,
`ui/announce`, `drum/*`) stay; redefine them freely.

### 12.1 Sound effects (id → description)

**Weapons and bombs**

| id | Description |
|---|---|
| `weapon/pistol` | short "pew": pulse 25 %, 1200 → 400 Hz in 60 ms, tiny noise click |
| `weapon/machine-gun` | tight noise burst + low pulse thump, 40 ms, random pitch ±5 % |
| `weapon/shotgun` | wide noise blast, low-pass 6 kHz → 800 Hz, 180 ms, saw thump 90 Hz; a two-click pump at 300 ms |
| `weapon/rocket` | launch "fwoosh": band-passed noise rising 400 Hz → 2 kHz, 300 ms |
| `weapon/flame` | noise roar, low-pass 1.2 kHz, slow tremolo, 400 ms (re-triggered while firing) |
| `weapon/laser` | saw 880 Hz with 30 Hz vibrato and light FM; loops while held |
| `weapon/homing` | two quick rising chirps (pulse 12.5 %, 600 → 1800 Hz, 80 ms each) |
| `weapon/tuba` | fat "OOM-PAH": saw 70 Hz with a quick blip up a fifth and back, low-pass, 220 ms |
| `weapon/bounce-mine` / `weapon/mine-bounce` | low "thunk" launch (triangle 140 Hz, 60 ms) / triangle "plink" 1200 Hz, 30 ms on every bounce |
| `weapon/empty` | dry click + a comic deflating squeak (pulse 600 → 200 Hz, 120 ms) |
| `weapon/grenade-throw` / `weapon/grenade-bounce` | short whoosh / "tonk" (triangle 300 Hz, 40 ms) |
| `weapon/knife` | swish: high-passed noise sweep, 80 ms |
| `weapon/knife-umbrella` / `weapon/knife-needles` / `weapon/knife-pan` / `weapon/knife-wrench` | soft "fwip" / "tik-tik" / "BONK" (triangle 220 Hz + bell partial, 150 ms) / "CLANG" (FM bell 400 Hz, 250 ms) |

**Explosions and hits**

| id | Description |
|---|---|
| `explosion/s` `explosion/m` `explosion/l` | noise bursts with low-pass sweeps and a saw sub-drop; 200 / 400 / 900 ms (`l` adds a rumble tail) |
| `explosion/part` | `explosion/m` + metal tinkles (FM bell, random high notes) |
| `hit/enemy` | short noise tick + pulse blip |
| `hit/metal` | FM bell "tink", 1.2 kHz, 60 ms (machines, boss parts) |
| `hit/drum` | dull boom: triangle 90 Hz with a fast pitch drop + noise, 120 ms |
| `hit/shield` | hollow "tonk" (wreck blocks, the crash shield) |

**Player, items, hostages**

| id | Description |
|---|---|
| `player/jump` / `player/land` | soft pulse 300 → 500 Hz, 60 ms / soft noise thump, 40 ms |
| `player/die` | pulse slide 800 → 100 Hz over 500 ms, ending in a spring "boing" (triangle wobble) |
| `player/spawn` | a feather "fwump" + a small rising 3-note arpeggio |
| `player/helium-on` / `player/helium-pop` / `player/helium-deflate` | rising balloon squeal (pulse 400 → 1600 Hz, vibrato, 300 ms) / big noise BANG 150 ms + confetti sparkle / long "pffft" (band-passed noise sweeping down + pulse wobble, 500 ms) |
| `player/yawn` | time-up yawn: falling pulse with vibrato, 600 ms |
| `item/weapon` | quick 3-note arpeggio up (pulse 25 %) |
| `item/bombs` | two low "thunk" notes |
| `item/food` | "nom": triangle blip + noise |
| `item/gem` | two high sparkly FM bell notes (pitch rises with the value) |
| `item/1up` | the Cygnet hook (12.2) played fast on pulse |
| `item/repair` | ratchet clicks + a rising two-tone |
| `item/crate-break` | wood crack: noise + square click |
| `hostage/free` / `hostage/give` | rope snap + two-note chirp / two-note "ta-da" up |
| `hostage/faint` | sad 3-note slide down (triangle) |
| `hostage/composer` | four FM bell notes (an original falling-then-rising figure) |
| `hostage/camera` | shutter click + a short flash whine |

**Vehicles**

| id | Description |
|---|---|
| `vehicle/enter` / `vehicle/exit` | hatch clunk + rising engine whine / spring "boing" + hatch pop |
| `vehicle/hit` / `vehicle/warning` / `vehicle/alarm` | metal clang + crunch / two-tone beep (pulse 880 and 660 Hz) every 60 ticks / fast alternating two-tone (8 Hz) for the last 60 ticks |
| `vehicle/ram` | rising siren into `explosion/l` |
| `swan/step` / `swan/paddle` | one foot contact of the run (every 24 px): a quick webbed-paddle slap with a light hydraulic tick (short low noise burst + saw 60 Hz blip, 50 ms; quieter in the waddle) / swimming: a fast watery flutter (band-passed noise in 16th pulses), every 12 ticks while she moves, every 32 at rest |
| `swan/fire` | beak gun: like `weapon/machine-gun`, a third higher |
| `swan/honk` | **the signature sound**: saw + pulse at 220 Hz through a nasal band-pass (1.2 kHz) with a pitch scoop up, 400 ms |
| `swan/squeak` | the sad squeak when HONK has no shells |
| `swan/jump` / `swan/land` | take-off: a hydraulic "ka-chunk" (two low square clicks + saw 80 Hz blip) and a steam hiss (high-passed noise, 150 ms) / landing after a fall of 60 px or more: a heavy thump (low-passed noise + saw 50 Hz pitch drop) and a metal clank (FM bell 300 Hz), 200 ms |
| `swan/skid` | skid start: a webbed-foot screech (band-passed noise sweeping 3 kHz → 1 kHz) over a hydraulic hiss, 10 ticks |
| `swan/flap` / `swan/fold` | the glide opens: a deep wing whump (low-passed noise burst) and a servo whirr (pulse 12.5 %, 300 → 600 Hz), 150 ms; it may share the `trumpeter/flap` recipe / the wings fold: a short clack (two square clicks, 30 ms) |
| `swan/glide` / `swan/tired` | loop while she glides: soft wind (band-passed noise around 800 Hz with a slow tremolo) / the last 12 glide ticks: a falling wheeze (noise + pulse 600 → 200 Hz, 200 ms) |
| `swan/stomp` | a stomp: a spring "boing" (triangle with a fast wobble) and a crunch (short noise burst) |
| `swan/splash` | landing in water: a water slap (low noise burst) and droplets (random high pulse blips), 250 ms |
| `swan/hiss` | SWAN DIVE wind-up: an angry hiss (high-passed noise with a fast tremolo), 6 ticks |
| `swan/dazed` | the daze after a dive: three wobbly falling notes (triangle with vibrato) |
| `swan/migrate` | she flies away: the `swan/honk` recipe sliding down a fourth and fading out over 1 s |
| `vehicle/jingle` | the Sundae Driver's jingle: 8 original notes on FM bell + pulse 12.5 %, music-box tone, ends on an unresolved note |
| `sundae/mortar` | cartoon "bloop" lob |
| `bandwagon/brass` / `bandwagon/drum` / `bandwagon/cymbals` | saw chord stab / bass-drum boom / bright crash with a 600 ms decay |
| `trumpeter/flap` / `trumpeter/bail` | two wing-beat noise whooshes / parachute pop + a short honk |

**Enemies**

| id | Description |
|---|---|
| `enemy/alert` | "!" blip: pulse 1500 Hz, 40 ms, twice |
| `enemy/double-take` | comic triangle slide up then down |
| `enemy/aria` | one sung note: pulse 50 % with 6 Hz vibrato, 500 ms (pitch steps up the major scale in a knife combo: `pitch` option) |
| `enemy/scream` / `enemy/panic` | short falling yelp (deaths only) / quick tiptoe patter with a tiny worried hum (9.0 panic look) |
| `enemy/salute` | heel click + tiny two-note fanfare |
| `enemy/rifle` | a rounder, lower "pop" than the player's pistol |
| `enemy/windup` | a rising wind-up whoosh (butt swing telegraph) |
| `enemy/grenade` | fuse hiss |
| `enemy/tuba-inhale` / `enemy/tuba-blast` | rising breath noise + low saw swell / deep saw "BWOMP" |
| `enemy/cymbal-raise` / `enemy/cymbal-crash` | shimmering high-passed noise with tremolo / bright noise burst, 600 ms decay |
| `enemy/drum-hit` / `enemy/drumroll` | single low hit / snare hits that speed up |
| `enemy/whistle` | officer's whistle: pulse 2.6 kHz with a fast trill |
| `enemy/piccolo-whistle` / `enemy/piccolo-shot` | pitch rising 1.2 → 3 kHz over 45 ticks / sharp high crack |
| `enemy/triangle` | the "DING": FM bell 2.5 kHz, long decay |
| `enemy/bassoon-aim` | squeaky reed: pulse 12.5 % with a rising wobble |
| `enemy/fumble` | "CLONK": wood-block triangle + noise |

**Machines and creatures**

| id | Description |
|---|---|
| `machine/tank-move` / `machine/tank-charge` | tread rumble loop / rising hum |
| `machine/sad-notes` | three slow descending notes on pulse 50 % with a wobble (an original phrase, not the "sad trombone" figure) |
| `machine/truck-horn` / `machine/brake` | plain two-tone horn / tyre screech (high band-passed noise) |
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
| `creature/goat` | "mehh": pulse 50 % with 8 Hz vibrato + a noise snort |
| `creature/shush` | "SHHH": high-passed noise (3 kHz), 400 ms |
| `creature/kazoo` | buzzy saw with heavy vibrato (loop) |

**Bosses, environment, UI**

| id | Description |
|---|---|
| `boss/warning` | klaxon: square 440 / 554 Hz alternating, 4 times |
| `boss/part-break` | heavy metal crunch + `explosion/m` |
| `boss/calliope-scale` | 6 rising steam-whistle notes (pulse 50 % + breath noise) |
| `boss/foghorn` | deep horn: saw 55 Hz + 110 Hz |
| `boss/trombone-pull` | slide-up "wwwoop" |
| `boss/hihat-open` / `boss/beater-pull` | "chick" / a low creak |
| `boss/bagpipe-drone` / `boss/bagpipe-die` | nasal drone loop (saw 110 + 165 Hz, band-passed) / the drone sliding down as it runs out of air |
| `boss/piano-rattle` / `boss/piano-gliss` | key clatter / a rising run |
| `boss/harp-charge` | glittering arpeggio up (FM bell) |
| `boss/organ-chord` | big pad chord |
| `boss/goose-wiggle` / `boss/goose-honk` | rattling wobble / `swan/honk` detuned down and distorted |
| `boss/scream` / `boss/voice-crack` | BRAVISSIMO scream: noise + saw formant sweep, 1.2 s / a tiny squeak (pulse 2 kHz, 80 ms) |
| `boss/deflate` | long raspberry: saw 90 Hz with 30 Hz AM, falling pitch, 1.5 s |
| `env/applause` | crowd clapping from random noise bursts over a soft low-passed bed, 2 s |
| `env/rimshot` | "ba-dum-tss": two drum hits + a cymbal hiss |
| `env/cricket` | two chirps (pulse 4 kHz, gated) |
| `env/water-splash`, `env/water-rush`, `env/wind`, `env/radio-static` | water and air noises; radio static under the briefing |
| `env/avalanche` / `env/timber` / `env/ice-melt` | long roar, 3 s / creak (saw glide) + crash / dripping plinks over a low hiss |
| `env/train-bell` / `env/train-pass` | "DING DING" / whoosh + rumble |
| `env/anthem-sting` | the anthem's first bar through a band-pass "loudspeaker" filter (used by `anthem-speaker`) |
| `ui/coin` | credit added: bright 2-note chime |
| `ui/countdown` | one tick per continue number |
| `ui/timer-warn` | tick per timer count under 10 |
| `ui/tally-tick` / `ui/tally-end` | fast blips while the tally counts / total chord |
| `ui/star` / `ui/stamp` | review-star "ding" / newspaper stamp thump |
| `ui/select-confirm` | short drum roll + a honk |
| `ui/mil-shutter` / `ui/mil-clank` | REPORT FOR DUTY: a steel shutter rattling up / a shutter landing (squad.md §4) |
| `ui/name-letter` | letter change blip |
| `mission/checkpoint` | short rising chime |
| `mission/time-up` | a yawning buzzer |

### 12.2 Music tracks

Two leitmotifs, both original: the **Cygnet hook** (the heroes): a short, graceful phrase with a
wide leap up and a dotted-rhythm walk down that ends on an unresolved note (the swan gliding),
always answered by a fast, busy bass figure (the paddling). It appears in `title`, `select`,
`mission-complete`, `m5-sky` and `ending`. The **anthem** (the villain): pompous and slow; its
**7th melody note is always one semitone flat** (a plain wrong note the player learns to hear).
Instrument names are the engine presets (`pulse12`, `pulse25`, `pulse50`, `triangle`, `bass`,
`saw`, `lead`, `sine`, `bell`, `pad`, `drums`).

| id | Use | Mood | BPM | Key / mode | Instrumentation | Structure |
|---|---|---|---|---|---|---|
| `title` | title, attract | "calm on top, furious underneath": slow elegant melody over a frantic bass | 112 | D major | bell arpeggio + pad intro; `pulse25` lead (legato, long notes); `saw` bass in running 16ths; drums | intro 8 (pad + bell) → A 16 (lead + racing bass + drums, Cygnet hook) → B 8 (`triangle` counter-melody) → A′ 8 → loop to A |
| `select` | mode and character select | bouncy, eager | 128 | A major | `pulse12` lead, walking `bass`, hat-only drums | 16-bar loop |
| `briefing` | intro card radio box | radio chatter, light | 96 | G mixolydian | filtered `pulse12` melody, `triangle` bass, brushed snare | 8-bar loop |
| `m1` | m1 | sunny regatta march with a swing | 132 | D major, 6/8 feel (`rowsPerBeat: 3`) | `pulse25` lead, `pulse50` harmony in thirds, `bass` on 1 and 4, kick/snare, `bell` ornaments | intro 4 → A 16 → B 16 (moves to G major) → A 16 → loop |
| `m2` | m2 | hot, driving, sandy | 140 | E dorian | `saw` bass ostinato in a 3+3+2 rhythm, `pulse12` lead with bugle-like leaps of fourths and fifths, shaker 16ths (hat), snare backbeat | intro 8 → A 16 → B 16 (half-time break, `pulse50` bugle solo) → A′ 16 → loop |
| `m3` | m3 | cold, airy, climbing | 120 | B minor, chorus in D major | `bass` long tones, cold `pad`, high `pulse25` lead with octave-flip "yodel" grace notes, `bell` icicles, sparse kick + hat | intro 8 → A 16 → B 16 (major lift) → A 16 → loop |
| `m4` | m4 | night-club swing, sly | 150 | C minor, swing 0.3 | walking `bass`, `saw` stabs on the off-beats (a brass section), chromatic `pulse25` lead, ride pattern (open hat) | A 16 → B 16 → break 8 (bass + drums) → A 16 → loop |
| `m5-sky` | m5-a flight | soaring, heroic | 160 | F major → D minor | long-note `pulse50` lead over fast `saw` arpeggios, `pad` swells, kick on every beat; the Cygnet hook in triumph | intro 8 → A 16 → B 16 → C 8 (`'C+2'`: a whole step up) → loop to A |
| `m5-organ` | m5-b | mechanical, inside a machine | 108 | D minor | organ-like `pad` drones, `triangle` ostinato in 8ths, `bell` clock ticks, `pulse25` fragments of the anthem bent out of shape, heavy kick on 1 and 3 | A 16 → B 16 → loop |
| `mini-boss` | golden-goose, big-head | urgent, cheeky | 150 | E minor | 2-bar `saw` bass ostinato, `pulse50` stabs, snare rolls, `bell` hits | 16-bar loop |
| `boss` | bosses m1–m4 | fast, aggressive, a little silly | 156 | A minor | `saw` bass in octave 8ths, `pulse25` lead with fast triplet runs, snare rolls before phrase ends, `bell` stabs | intro 4 (snare roll) → A 16 → B 16 → C 8 (half-time breakdown) → loop to A |
| `boss-final` | final boss | grand, pompous, desperate | 168 | C minor | everything: organ `pad` chords, `saw` bass, both pulses in counterpoint, `triangle`, full drums; quotes the anthem in minor with its wrong note intact | intro 8 → A 16 → B 16 → C 16 (anthem quote) → loop to A |
| `boss-final-fast` | the maestro's Tempo! | as `boss-final`, frantic | 200 | C minor | the same patterns as `boss-final` | A → B → loop (switching restarts it with a 30-tick crossfade) |
| `anthem` | anthem cutscenes and the ending parade counter-line | pompous, slow, self-important | 84 | B♭ major | organ `pad`, `pulse50` melody doubled by `saw` an octave down, `bass` in half notes, timpani-like kick rolls; the 7th melody note one semitone flat | 8 bars, no loop |
| `mission-complete` | tally start | triumphant jingle | 140 | D major | `pulse25` lead + `bell`, ends with a honk (`swan/honk` via the drum kit) | 6 s, no loop |
| `continue` | continue countdown | nervous ticking | 120 | chromatic | hats as a clock, a `pulse12` figure that rises a semitone on every repeat | 2-bar loop |
| `game-over` | game over | deflated | 80 | D minor | slow descending `pulse50` line; the last note is the anthem's wrong note (the anthem wins) | 5 s, no loop |
| `ending` | the parade | happy march | 116 | D major | the Cygnet hook as a full march; the anthem melody as a counter-line on `bell` (finally in tune, except one note) | 32 bars, then `credits` |
| `credits` | credits roll | relaxed | 100 | G major | swing version of the `title` theme: `pulse25` + `triangle` + brushed drums | 32-bar loop |
| `high-score` | name entry, high scores | perky | 132 | A major | short `pulse25` melody, `triangle` bass | 8-bar loop |
| `ams` | mission `ams` (THE FRYING DUTCHMAN) | a cheerful Amsterdam street-organ waltz | 150 | F major, 3/4 (`rowsPerBeat: 3`, 9 rows per bar) | organ (`pad`) lead doubled by a `pulse12` piping rank an octave up, FM glockenspiel counter-line, `triangle` oom on 1, `pulse25` chords on 2 and 3, kick + rim | intro 4 → A 16 → B 16 (B♭ major) → A′ 16 (glockenspiel in thirds, a second organ voice) → loop to A |
| `ams-boss` | ROBO-HALSEMA (`ams-mayor`) | driving, bossy, a little pompous | 160 | D minor | 16th-note `saw` bass ostinato, organ stabs in a 3+3+2 push, bold `pulse12` lead, snare rolls into each phrase | intro 4 → A 16 → B 16 ("rules are rules" call) → C 8 (organ break, rising build) → loop to A |

### 12.3 Announcer lines (`audio.voice`; jingle fallback)

| Event | Line |
|---|---|
| Mission start | m1 `"MISSION ONE. LOOK SHARP, CYGNETS!"` · m2 `"MISSION TWO. STAY HYDRATED, CYGNETS!"` · m3 `"MISSION THREE. WRAP UP WARM, CYGNETS!"` · m4 `"MISSION FOUR. BREAK A LEG, CYGNETS!"` · m5 `"FINAL MISSION. FLY GRACEFULLY, CYGNETS!"` |
| Weapons | the lines in section 5 (Dutch); same weapon again: `"MEER <NAME>!"` |
| Bombs / shells / repair | `"EXTRA BOMBS!"` / `"RELOAD!"` / `"PATCHED UP!"` |
| 1UP | `"ONE MORE TRY!"` |
| Helium Head | `"HELIUM HEAD!"` |
| Vehicle entered | `"SWAN-3, READY!"` · `"SUNDAE DRIVER!"` · `"BANDWAGON!"` · `"TRUMPETER!"` |
| Character chosen | `"GRACE!"` · `"MITTENS!"` · `"PIP!"` · `"GRAMPS!"` |
| Boss | `"WARNING!"` (on the boss banner) |
| Mission complete | `"MISSION COMPLETE! BRAVO!"` |
| All hostages | `"STANDING OVATION!"` |
| Time up | `"TIME UP!"` |
| Continue / game over | `"CONTINUE?"` / `"GAME OVER... UITGEZWAAND!"` |
| New high score | `"NEW HIGH SCORE! YOU'RE GREAT!"` |

---

## 13. UI & flow

> **2026-10-16: military menus.** `docs/design/squad.md` §2.3 and §3 win over this section for
> the boot text, the title, the mode select, the character select (now **REPORT FOR DUTY**) and
> the menu backdrop. Summary: every menu draws the night military base (`scenes/base.ts`
> `drawBase`) instead of the lake (the ending keeps the lake); titles are stencil sprites
> (`ui/mil/stencil-<slug>`); the logo is riveted army-green plates with stencil gaps and the gold
> 3-swan. The texts below are updated; the old ones are in the git history.

All text uses the project bitmap fonts: **big** (8 px) for titles and banners, **small** (5×7)
for everything else; upper case only. Default text: `snow` with a 1 px `ink` outline. Centred
text is centred on x = 192 ("C"). P1 colour `sky`, P2 colour `gold`; warnings `red`; scores
`gold`. Blink = 30 ticks on / 30 off unless noted. Menu cursor: a small swan-head icon
(`ui/cursor-swan`) left of the item. Our HUD uses icons and digits only (no labelled boxes).

### 13.1 Scene flow

`Boot` → `Title` (attract loop) → `ModeSelect` → `CharacterSelect` → `MissionIntro` →
`Gameplay` (⇄ `Pause`, `Continue` overlay) → `MissionComplete` (tally) → next `MissionIntro` … →
after m5: `Ending` → `Credits` → final tally → `NameEntry` (if the score qualifies) → `HighScores`
→ `Title`. All players out of continues: `GameOver` → `NameEntry` → `HighScores` → `Title`.

**Since 2026-10-14 (user decision; §17, `docs/design/fps.md` §1):** after the `ams` boss the game
does not show the `ams` tally or `MissionIntro` m1. `Gameplay` (ams) → `GlitchBridge` (glitch +
story card) → `FpsIntro` → `Fps` floor 1 (⇄ `Pause`, `Continue`) → `FpsTally` → `FpsIntro` →
`Fps` floor 2 (boss) → `FpsTally` → `Ending` (fps captions) → `Credits` → final tally →
`NameEntry` → `HighScores` → `Title`. m1–m5 are unreachable in a normal run (they stay playable
with `?mission=`).

### 13.2 Boot

- Black screen; a row of 8 small swan icons (C, y 100) fills in as sprites and sounds pre-render.
- Small, C, y 120: `LOADING AMMUNITION... 64%` (live percentage). The row of swan icons is an
  ammunition belt of 16 brass rounds that fills in (squad.md §3.1).
- When ready: `CLICK OR PRESS ANY KEY` (small, C, y 140, blinking). This gesture unlocks audio.

### 13.3 Title and attract

- **Scene:** a lake at dusk (`sky-gradient` + `hills` + water band). The SWAN-3 glides across the
  water from left to right at 0.25 px/tick (`swim` with the relaxed S-neck `swim-neck-relax`),
  with Captain Grace sitting perfectly still on her back (`ride-sit`, scarf lifting in the
  breeze), while her legs paddle like mad under the surface. On the far bank a tiny crimson Legion
  parade marches past. Music `title`.
- **Logo** (`ui/logo`, C, y 20–84): `METAL SWAN` in chunky riveted ivory-and-steel letters and a
  large gold `3` whose top curls like a swan's neck and head (orange beak).
- **Military title (2026-10-16, squad.md §3.2):** the night base with sweeping searchlights; the
  SWAN-3 with `vincent` patrols behind the sandbag wall (0.4 px/tick, turning at the ends).
- **Tagline** (small, C, y 92): `THE SWAN HAS LANDED. THE ENEMY HAS NOT.`; alternates `ONE SWAN.
  FIVE IDIOTS. ZERO RETREAT.` · `LOCK. LOAD. HONK.` · `OPERATION FRIKANDEL IS A GO.`
- **Prompt** (gold stencil `ui/mil/stencil-press-start`, C, y 114, blinking): `PRESS START`
- **Top** (small, C, y 4): `HI 0500000` (best score).
- **Footer** (small): `(C) 2026 THE METAL SWAN 3 TEAM` at C, y 206; right-aligned at (380, 206):
  `FREE PLAY` or `CREDITS 05`.
- **Attract loop** after 600 idle ticks: demo play (bot on `ams-a`; `m1-a` in a build without `ams`; 1200 ticks, `DEMO PLAY` big
  blinking at C, y 40) → HOW TO PLAY card (300 ticks) → high scores (300 ticks) → title with the
  next alternate tagline (1.3).
- **HOW TO PLAY** (small, left-aligned at x 40, from y 40, 12 px line spacing; 10 lines, the last
  at y 148):
  `ARROWS / WASD   MOVE AND AIM` · `UP + LEFT / RIGHT   AIM DIAGONALLY` · `FIRE   SHOOT (KNIFE UP CLOSE)` · `JUMP   JUMP` ·
  `HOLD JUMP   GLIDE (SWAN)` · `DOWN + JUMP   DROP DOWN / LEAVE A VEHICLE` · `BOMB   THROW A GRENADE` ·
  `FIRE + BOMB   VEHICLE SPECIAL` · `FIRE + JUMP   RAM!` · `FREE THE CRITICS. STOP THE ANTHEM.`

### 13.4 Mode select

Music `select` (it keeps playing on the character select). Stencil header `SELECT OPERATION`
(C, y 36). Vertical menu, big, C, from y 80, 16 px apart: `1 SOLDIER` · `2 SOLDIERS` ·
`DIFFICULTY  < NORMAL >` (a gold small subtitle under it: `"RECRUIT"`, `"VETERAN"` or
`"COMMANDO"`; and a hint at C, y 170: EASY `MORE LIVES. SLOWER BULLETS.` · NORMAL
`THE REAL WAR.` · HARD `NO MERCY. NO MEDALS.`) · `OPTIONS` · `HALL OF FAME`. The difficulty ids
stay `easy` / `normal` / `hard`.

### 13.5 Character select

> **Superseded (2026-10-16):** the character select is now **REPORT FOR DUTY**, specified in
> `docs/design/squad.md` §3.4 and built in `scenes/character-select.ts`: a riveted rust-brown
> steel frame, five panels with shutters, grey portraits that turn to colour when highlighted, P1
> (red) / P2 (blue) lamps, nameplates, the callsign and bio in the highlighted panel, a sprite
> preview window on the dropped shutter, `STAND BY` / `READY!` and a 20-second countdown. The
> text below is the original design, kept for reference.

- Title (big, C, y 12): `CHOOSE YOUR CYGNET`. Timer (big, right-aligned at (376, 12)): `20`
  counting down once per 60 ticks; at 0 the highlighted character is chosen.
- Four portraits (32×32, `char/<id>/portrait`) with centres at x 72, 152, 232, 312, y 40–72;
  short names under them (small, y 76): `GRACE`, `MITTENS`, `PIP`, `GRAMPS`.
- Cursors: P1 `sky` frame with a `1P` tag, P2 `gold` frame with a `2P` tag. A character taken by
  the other player turns grey.
- Below: the highlighted character's full figure in its idle animation (feet at (88, 196)); a text
  box at x 140–376, y 100–196 (small font, word-wrapped) with the full name and rank, the role
  and the quote:
  - `CAPT. GRACE STILLMERE` / `SQUAD LEADER` / `"PARDON ME. I'M HERE TO STOP THE MUSIC."`
  - `SGT. TORVALD "MITTENS" MAGNUSSON` / `HEAVY WEAPONS. KNITTING.` / `"..."` + `(HE NODS. HE HAS KNITTED YOU A SCARF.)`
  - `PVT. PIP OKAFOR` / `ROOKIE` / `"IS THIS THE REAL WAR? THE BROCHURE HAD MORE BALLOONS!"`
  - `W.O. AMBROSE "GRAMPS" FENWICK` / `ENGINEER. BUILT THE SWAN.` / `"BACK IN MY DAY, TANKS DIDN'T HAVE LEGS. THEN I GAVE THEM LEGS."`
- On confirm: the victory pose (30 ticks), the announcer name and `ui/select-confirm`.

### 13.6 Mission intro card (max 360 ticks; start skips after 60)

- Black background with a simple 1-colour line map of the region and a blinking dot.
- `MISSION 1` (big, C, y 24; m5: `FINAL MISSION`) · mission name (big, `gold`, C, y 40):
  `BRASS ON THE RIVERBANK`, `DUNE BUGLE`, `THE HIGH NOTE`, `OPENING NIGHT`, `SWAN SONG` ·
  subtitle (small, C, y 54): m1 `PUDDLEWICK, LOWMERE - 0900 HOURS` · m2
  `RATTLEBONE FLATS, CRESCENDIA - 1200 HOURS` · m3 `MOUNT MURMUR, CRESCENDIA - 1700 HOURS` · m4
  `FANFARONI CITY - 2100 HOURS` · m5 `ABOVE THE CLOUDS - 2330 HOURS`.
- Radio box (x 16–368, y 120–200, `ui` ramp): Brigadier Gusto's portrait (32×32 at (24, 128):
  big, red-faced, peaked cap, moustache, microphone in hand) and the 2 briefing lines (2.4) typed
  at 2 characters per tick over `env/radio-static`, word-wrapped to the text area x 64–360
  (max 4 lines); music `briefing`.
- `PRESS START TO SKIP` (small, C, y 206). Then fade to gameplay, where the banner `MISSION 1` /
  `START!` shows for 120 ticks with the announcer line.

### 13.7 HUD (384×216, screen space)

| Element | Position | Content |
|---|---|---|
| P1 score | (4, 3) | small: `1P` (sky) then the 7-digit score at x 16 (gold): `0012300`; the last digit counts continues |
| P1 weapon | icon (4, 12), ammo (22, 12) | weapon icon 16×8 (`ui/icon-weapon-<id>`) + small digits (no digits for the pistol: the icon alone means it never runs out); the weapon name pops under it at (4, 46) for 90 ticks (e.g. `MACHINE GUN`) |
| P1 grenades | (52, 12) | grenade icon 6×6 + small `x10`; in a vehicle: shell icon + count |
| P1 lives | (4, 22) | swan-head icons 6×6 (`ui/icon-life`), one per life in reserve, max 5 drawn, then `x7` |
| P1 hostages | (4, 30) | bow-tie icons 5×3 (`ui/icon-hostage`), one per hostage in the tally, max 10 drawn, then `x12` |
| P1 continues | (4, 38) | small `CONT 1`, only when > 0 |
| P1 vehicle | (80, 12) / (80, 21) | vehicle name (small: `SWAN-3`, `SUNDAE`, `BANDWAGON`, `TRUMPETER`) and HP cells 8×5 with 2 px gaps (`snow`; `red` and blinking at ≤ 1 cell); a 3×3 dot after the cells when the special is ready |
| P1 status | (80, 30) | balloon icon + a 24×2 px timer bar while Helium Head is on |
| P2 blocks | mirrored | right-aligned at x 380 (`2P` gold) |
| P2 not playing | (380, 3), right-aligned | blinking `2P PRESS START` (credit mode with no credits: `2P NO CREDITS`) |
| Timer | frame 28×18 at (178, 2); digits centred at (192, 6) | big 2-digit counts; `red` blink under 10 |
| Boss bar | name (small, C, y 198); bar 192×4 at (96, 207) | crimson fill = remaining HP of the required parts; white flash on a part break; boss and mini-boss fights only (option BOSS BAR) |
| Banners | C, big, y 90 | `MISSION 1` / `START!`, `TIME UP!`, `ALARM!`, `AVALANCHE!`, `THE ICE IS MELTING! CLIMB!`, `MISSION COMPLETE!`; `WARNING!` (red, blinking) at y 84 with the boss name (big, gold) at y 98 and the subtitle (small) at y 110 |
| ONWARD prompt | (330–378, 100); vertical: C, y 40 (up) / y 176 (down) | small `ONWARD` + three gold chevrons (`ui/onward`), blinking 20/20 ticks, 90 ticks after an unlock without scrolling |
| Callouts | C, small, y 60, 90 ticks | `CHECKPOINT`, `CAUGHT NAPPING +100`, `QUIET PLEASE +800`, `STRIKE! +1000`, `FULL SET! +1000`, `VANDALISM +500`, `SET PIECE! +200`, `STYLE POINTS 9.5! +2000`, `DRUM ROLL! +1000`, `NO SCRATCHES! +10000`, `ONE MORE TRY!` |
| Score popups | world space | small digits rise 12 px over 40 ticks at the kill point |
| Speech bubbles | over the speaker | small font in a white rounded box with a 3 px tail, max 24 characters × 2 lines, 120 ticks (option SPEECH BUBBLES OFF hides gag bubbles, never hints) |
| RIDE bubble | 8 px above an empty vehicle's hatch | the `RIDE?` speech bubble (bubble style above, tail toward the hatch, no arrow; a hint, so SPEECH BUBBLES OFF never hides it; 8.1) |
| Swan marker | top edge (y 1), at the Swan's x, kept 4 px inside the side edges | while a ridden Swan's hull or rider is above the view: a 6×6 swan head (the `ui/icon-life` art) with a 1 px outline in the rider's colour (P1 `sky`, P2 `gold`); no arrow. It goes away as soon as both are back in view. Required: designed beats lift her out of the view for 30–44 ticks (a full jump from a chalet roof, the judges' box or the `m3-c` roofs, `levels.md` §1.4) |

### 13.8 Pause

The game dims (black at 50 %), music volume halves. Centre box 160×80 (`ui` ramp): `PAUSE` (big,
C, y 76) and the menu `RESUME` · `OPTIONS` · `QUIT TO TITLE` (small, C, from y 96, 12 px apart).
Quit asks `QUIT? PROGRESS WILL BE LOST.` → `YES` / `NO` (default `NO`). Gag: after 600 ticks
in pause a tiny Legion private walks onto the pause box, sits on its edge and falls asleep (snore
bubble); he leaves when the game resumes.

### 13.9 Continue

- 1 player: the world freezes and dims to 50 %. 2 players: the world runs; the texts are drawn
  small inside the dead player's HUD corner.
- `CONTINUE?` (big, C, y 60), the countdown digit (big ×2, C, y 90) `9` … `0` (60 ticks each,
  each fire/jump press removes 15 ticks), `PRESS START` (small, C, y 130, blinking), `FREE PLAY`
  or `CREDITS 04` (small, C, y 140), `SCORE 0123400` (small, C, y 152). Music `continue`;
  `ui/countdown` per digit.
- **Gag scene** (1 player): the character sits tied to a chair while two Legion privates push a
  giant loudspeaker one step closer for every number. At 0 they switch it on, the `game-over`
  jingle plays (with the wrong note) and the character salutes against their will. Continued in
  time: the ropes snap, the character punches the speaker over and drops back into the game.

### 13.10 Game over

`GAME OVER` (big, C, y 96; the letters drop in 4 ticks apart), `UITGEZWAAND!`
(small, C, y 120), the final score of each player (small, C, y 140), music `game-over`, announcer.
After 240 ticks → name entry (if the score qualifies) → high scores → title.

### 13.11 Mission complete — "THE REVIEWS ARE IN"

1. In the level: `MISSION COMPLETE!` (big) for 180 ticks, victory poses, the `mission-complete`
   jingle and the announcer.
2. A newspaper slides in (`snow` paper, `ink` text). Masthead (big, C, y 16):
   `THE LOWMERE LISTENER`; under it (small) `SPECIAL EDITION`; a stamp (`ui/stamp`) drops the
   headline (small, C, y 44): m1 `RIVERBOAT SUNK! REGATTA RESUMES!` · m2
   `DRUM TANK SILENCED! COLONEL'S JOKES STILL BAD!` · m3 `WINDBAG DEFLATED ON MOUNT MURMUR!` ·
   m4 `PREMIERE CANCELLED! PIANO "UNPLAYABLE"!` · m5 `ANTHEM STOPPED! WORLD STAYS FREE TO SLOUCH!`
3. Tally lines (small; P1 column from x 24, P2 column from x 200; a line every 30 ticks with
   `ui/tally-tick`, the total with `ui/tally-end`; values per 14.4):
   ```
   HOSTAGES          8 x 10000     80000
   STANDING OVATION                50000
   FLAWLESS PERFORMANCE            30000
   BOSS SPEED BONUS                 9600
   VEHICLE AT THE FINISH          100000
   NO SCRATCHES                    10000
   DIFFICULTY                       x1.0
   TOTAL                          279600
   ```
   Missed bonuses show `---`. When Pip is played his column adds `HATS COLLECTED  47` (no points).
4. **THE CRITICS SAY:** a star rating per player (`ui/star` per star): 1 star, +1 for each of:
   ≥ 75 % of the route's hostages in the tally; no life lost; a boss speed bonus > 0; the
   mission's golden record found. Quote by stars: 1 `"LOUD. MESSY. WE LEFT AT THE INTERVAL."` ·
   2 `"SOME NICE MOMENTS. MOSTLY EXPLOSIONS."` · 3 `"A SOLID PERFORMANCE. THE DUCKS LOVED IT."` ·
   4 `"GRACEFUL! FURIOUS! WE WEPT A LITTLE."` · 5 `"FIVE STARS. WE HAVE NOTHING BAD TO SAY, AND IT HURTS."`
5. `PRESS START` (small, C, y 206; continues automatically after 600 ticks).

### 13.12 Ending and credits

The ending runs as in 2.6 (music `ending`). Credits scroll up at 0.5 px/tick over the parade
(small font, big for headings): `METAL SWAN 3` · `MADE ENTIRELY OUT OF CODE` ·
`BY THE METAL SWAN 3 TEAM` · `STARRING` · `CAPT. GRACE STILLMERE` ·
`SGT. TORVALD "MITTENS" MAGNUSSON` · `PVT. PIP OKAFOR` · `W.O. AMBROSE "GRAMPS" FENWICK` ·
`AND THE SWAN-3` · `WITH` · `BRIGADIER LIONEL GUSTO` · `MRS. DOLLOP AS HERSELF` · `INTRODUCING` ·
`HIS LOUDNESS, GRAND MARSHAL BOMBASTIAN FANFARONI` · `COMMODORE BLARE` · `COLONEL RIMSHOT` ·
`WING COMMANDER PUFFINGTON` · `COUNTESS PIZZICATA` · `ALL PIXELS GENERATED BY CODE` ·
`ALL SOUNDS SYNTHESIZED` · `NO CRITICS WERE HARMED IN THE MAKING OF THIS GAME` ·
`THANK YOU FOR PLAYING` · `THE END ... OF THE NOISE.` Music `credits`. Then the final tally
(14.6) and name entry.

### 13.13 Options

Header `OPTIONS` (big, C, y 16). Rows (small) from y 40, 11 px apart; labels left-aligned at
x 64, values right-aligned at x 320 between `<` and `>`; left/right change, fire confirms.

`DIFFICULTY  EASY / NORMAL / HARD` · `CREDITS  FREE PLAY / 9 / 5 / 3` · `MUSIC VOLUME  0-10` (7) ·
`SFX VOLUME  0-10` (8) · `VOICE VOLUME  0-10` (10; announcer and voiced bubbles, 2026-10-14) ·
`ANNOUNCER  ON / OFF` · `SPEECH BUBBLES  ON / OFF` ·
`BOSS BAR  ON / OFF` · `SCREEN SHAKE  FULL / LOW / OFF` · `REDUCE FLASHES  OFF / ON` (white flashes
and lightning at 30 % alpha) · `GRAPHICS  PIXEL / SMOOTH / XBR` (PIXEL; the sprite filter on a
high-resolution display, applied at once; `?gfx=` sets it for one session and the row shows it;
while the row is selected, `XBR NEEDS A LARGER WINDOW: SMOOTH` (or `… : PIXEL`) says when the
window is too small for the filter; docs/ARCHITECTURE.md §3) · `CONTROLS` (rebind screen: `PRESS A KEY FOR FIRE`,
`PRESS A KEY FOR JUMP`, `PRESS A KEY FOR BOMB`, `PRESS A KEY FOR START`; `ESC TO CANCEL`) ·
`RESET HIGH SCORES` (asks `ARE YOU SURE?` → `YES` / `NO`) · `BACK`.

### 13.14 High scores and name entry

- Title (stencil, C, y 12): `HALL OF FAME` (was `TOP PERFORMERS`, squad.md §3.5). Ten rows from y 40, 14 px apart (small): rank (`1ST` …
  `10TH`) at x 32, initials at x 80, 7-digit score right-aligned at x 220, character head icon at
  x 228, mission reached (`M3` or `ALL`; numbered by campaign place, `ams` = `M1`, `m1` = `M2`;
  saved rows keep their mission id, so a pre-Amsterdam `m1` row now reads `M2`) at x 252, difficulty (`E`, `N`, `H`) at x 284, continues
  used (`C2`, blank if none) at x 304.
- Default table: `GRC 1000000`, `MIT 0800000`, `PIP 0600000`, `GPS 0500000`, `HIS 0400000`,
  `BLR 0300000`, `RIM 0200000`, `PUF 0150000`, `PIZ 0100000`, `DOL 0050000`.
- Name entry: `ENTER YOUR INITIALS` (stencil, C, y 34); three letter slots (big) at x 168, 184, 200,
  y 80; up/down cycles `A`–`Z`, `0`–`9`, `.`, `END`; fire confirms a slot; a 30-second timer
  (small, right-aligned at (380, 4)); music `high-score`; the announcer says
  `"NEW HIGH SCORE! YOU'RE GREAT!"` when the screen opens. Scores are saved per player (co-op: two
  entries).

---

## 14. Scoring

Scores are per player, 7 digits (max 9,999,999). A kill scores for the player whose damage killed
the target; area kills score for the owner of the explosion; hostage points go to the freeing
player. In-game scores are the same on every difficulty; only the mission tally is multiplied.

### 14.1 Kills

| Source | Points |
|---|---|
| `rifleman` · `drummer` (+100 for breaking the drum) · `oompah-trooper` · `cymbalist` | 100 · 300 · 500 · 300 |
| `baton-major` · `piccolo` · `triangle` (+800 QUIET PLEASE) · `bassoonist` | 1,000 · 400 · 200 · 600 |
| `bullfrog` · `windup-bot` · `rattler` · `echo-bat` | 400 · 100 · 600 · 200 |
| `ram-goat` · `usher-bot` · `kazoo-drone` | 800 · 700 · 100 |
| `oompah-tank` · `band-truck` · `metronome-turret` · `gramophone-mortar` | 3,000 · 2,000 · 1,500 · 1,200 |
| `piano-bomber` · `baton-copter` · `pipe-battery` (+300 per pipe) · `anthem-speaker` | 4,000 · 1,500 · 3,000 · 500 |
| Tank crewman (fleeing) · `rowboat` · `parade-float` · `drum-barricade` | 100 · 200 · 1,500 · 2,000 |
| Mini-bosses: `golden-goose` · `big-head` | 15,000 · 20,000 |
| Bosses: `encore` · `ba-dum-behemoth` · `windbag` · `grand-grand` | 30,000 · 40,000 · 50,000 · 60,000 |
| Final stages: `grand-organ` · `organ-console` · `maestro` | 30,000 · 40,000 · 100,000 |
| Any destroyed boss or mini-boss part | 1,000 (the Grand Organ `bellows`: 5,000) |
| Shot-down enemy projectiles (sonic rings, rockets, golden eggs, barrels, records, homing notes, sheet-music mines) | 50 each; leaflet-bombs 100 |
| **Knife kill** | 5 × the target's score |

### 14.2 Style bonuses (shown as callouts, 13.7)

| Source | Points |
|---|---|
| CAUGHT NAPPING (killed before its double-take ends) | +100 |
| QUIET PLEASE (`triangle` killed before the third ding) | +800 |
| STRIKE! (6 `windup-bot`s crushed in one vehicle run) | +1,000 |
| FULL SET (a whole `kazoo-drone` formation) | +1,000 |
| VANDALISM (a `statue-head` knocked off) | +500 |
| SET PIECE! (an enemy killed by a set piece: the falling willow, the avalanche, a rolling statue head, a landing piano, a falling chandelier) | +200 per enemy |
| STYLE POINTS 9.5! (the m3-a ski jump: on foot, land past the blue K-line; riding a Swan, open the wings and land past the red K-line; no hit while airborne; once per player) | +2,000 |
| DRUM ROLL! (a player's shot or blast starts a chain that sets off all 5 `drum-mine`s of the m1-c minefield) | +1,000 |

### 14.3 Objects, pickups and rescues

| Source | Points |
|---|---|
| `crate` broken · `breakable-wall` · `helium-tank` · `rolling-drum` · `drum-mine` | 100 each |
| `icicle` · `willow-tree` (felled) | 50 · 1,000 (a `statue-head` scores only its VANDALISM bonus, 14.2) |
| `pickup-weapon` · `pickup-bombs` | 500 · 500 |
| `pickup-food`: `bread` · `cheese` · `teacake` · `jelly` · `birthday-cake` | 100 · 300 · 500 · 1,000 · 5,000 |
| `pickup-gem`: `golden-note` · `gem` · `medal` · `golden-record` | 100 · 1,000 · 2,000 · 10,000 |
| `pickup-1up` | 0 (10,000 when lives are full) |
| `pickup-repair` on foot or with full cells | 1,000 |
| Hostage freed | 500 |
| Continue | +1 (the score's last digit counts continues, max 9) |

### 14.4 Mission tally (per player, 13.11)

| Line | Points |
|---|---|
| `HOSTAGES` | count in the tally × 10,000 |
| `STANDING OVATION` | 50,000 (1P: every hostage of the route in the tally); 2P: 25,000 each when the two tallies together hold every hostage of the route |
| `FLAWLESS PERFORMANCE` | 30,000 if the player lost no life in this mission |
| `BOSS SPEED BONUS` | max(0, 90 − seconds from the end of the boss intro to its death) × 200 (max 18,000). m5: max(0, 240 − seconds for all three final stages) × 200 |
| `VEHICLE AT THE FINISH` | 100,000 if the player was riding a vehicle when the boss died |
| `NO SCRATCHES` | 10,000 if a vehicle section of this mission ended with the player's vehicle at full cells (once per mission) |
| `DIFFICULTY` | the tally lines × 0.5 (EASY) / 1.0 (NORMAL) / 1.5 (HARD) |

### 14.5 Extends

+1 life at **500,000** and **1,500,000** points (`item/1up`, callout `ONE MORE TRY!`).

### 14.6 Final tally (after the credits)

The first-person mode (§17) has its own kill, treasure and floor-tally scores: `docs/design/fps.md`
§4 (they go through the same score, extends and lives). The `ams` tally is paid silently at the
bridge and shown as `MISSION 1 BONUS` on the floor-1 tally.

| Line | Points |
|---|---|
| `LIVES LEFT` | lives in reserve × 50,000 |
| `ALL GOLDEN RECORDS` | 100,000 if the player picked up the golden record of every mission of the route played: the 6 missions, or (the first-person route, §17) `ams` + floor 1 + floor 2 |
| `ONE-TAKE WONDER` | 500,000 if the player used no continue |
| `CONTINUES USED` | shown, no points |

A strong one-credit NORMAL clear scores about 2–3 million; a first clear with continues about
1–1.5 million.

---

## 15. Content ID index

All ids are kebab-case. Foundation ids are kept for their concepts: weapons `pistol`,
`machine-gun`, `grenade`, `knife`; enemy `rifleman`; items `crate`, `hostage`, `pickup-weapon`,
`pickup-bombs`, `pickup-food`, `pickup-gem`; character `recruit`; mission `m0`.

### 15.1 Characters (`characters/`)

`grace`, `mittens`, `pip`, `gramps` (playable) · `recruit` (test only).

### 15.2 Weapons, vehicle weapons, status (`weapons/`, `vehicles/`)

- **Player weapons:** `pistol`, `machine-gun`, `shotgun`, `rocket-launcher`, `flamethrower`,
  `laser`, `homing`, `tuba`, `bounce-mine`. **Bomb and melee:** `grenade`, `knife`.
- **Player projectiles** (entities): `bullet-pistol`, `bullet-mg`, `shotgun-blast`, `rocket`,
  `flame-stream`, `laser-beam`, `homing-missile`, `tuba-ring`, `mine-disc`, `grenade`.
- **Vehicle weapons:** `swan-beak-gun`, `swan-beak-shell`, `swan-honk` · `sundae-sprinkle-gun`,
  `sundae-mortar`, `sundae-jingle` · `bandwagon-brass-cannon`, `bandwagon-drum-boom`,
  `bandwagon-cymbal-wall` · `trumpeter-twin-gun`, `trumpeter-dive-bomb`, `trumpeter-honk`.
  Their projectiles: `beak-bullet`, `beak-shell`, `honk-ring`, `sprinkle`, `sundae-shell`,
  `brass-ring`, `drum-wave`, `twin-bullet`, `dive-bomb`.
- **Status:** `helium-head`.

### 15.3 Items (`items/`)

`crate` (param `contains`: crate letter `M S R F L H T B`, `bombs`, `repair`, a food or gem kind,
`1up`, `auto`) · `hostage` (params `kind`: `critic` | `roadie` | `tea-lady` | `tourist` | `composer` |
`dollop`; `bind`: `chair` | `cage` | `sack` | `float` | `balloon`; `drop`: the same values as `contains`,
default `auto` = the kind's table) · `pickup-weapon`
(param `weapon`) · `pickup-bombs` · `pickup-food` (param `kind`: `bread` | `cheese` | `teacake` |
`jelly` | `birthday-cake`) · `pickup-gem` (params `kind`: `golden-note` | `gem` | `medal` |
`golden-record`; `float`: no gravity, it hangs at its placed y, 7.1) · `pickup-1up` ·
`pickup-repair`.
Drop tables: `table-a` (critic), `table-b` (roadie), `table-c` (tea-lady), `table-d` (tourist),
`crate`, `officer`, `truck`.

### 15.4 Entities

- **Infantry** (`infantry/`): `rifleman`, `drummer`, `oompah-trooper`, `cymbalist`, `baton-major`,
  `piccolo`, `triangle`, `bassoonist`. Params: `outfit` (`parade` | `deck` | `desert` | `snow` |
  `night`), `entry` (`walk` | `run` | `window` | `chimney` | `manhole` | `parachute` | `truck` |
  `rowboat` | `ski` | `skate` | `float`), `gag` (shared: `cards` | `kazoo` | `shine` | `rehearse` |
  `nap` | `newspaper`; mission: `ice-cream` | `snowman` | `queue`; per type: `air-solo` (drummer),
  `polish` | `practice` (oompah-trooper), `tune` | `yawn` (cymbalist), `twirl` (baton-major),
  `scales` (piccolo), `counting` (triangle), `reed` (bassoonist)), `alarm` (triangle), `column`
  (parade columns), `facing`.
- **Machines** (`machines/`): `oompah-tank` (params `stopX`, `maxX`: it never moves right of
  `maxX`, 9.2), `band-truck` (params `stopX`,
  `cargo`, `from`), `metronome-turret` (param `floor`), `gramophone-mortar`, `piano-bomber`
  (params `mode: 'ground' | 'air'`, `dir`), `baton-copter` (param `mode`), `pipe-battery`,
  `anthem-speaker` (param `interval`). Support entities (also `machines/`): `rowboat`,
  `tank-barge`, `subway-train`, `drum-barricade`, `parade-float`, `tank-crewman` (spawned by a
  dying `oompah-tank`).
- **Creatures** (`creatures/`): `bullfrog`, `windup-bot` (param `variant`: `walk` | `ski` |
  `fly`), `rattler`, `echo-bat`, `ram-goat`, `usher-bot`, `kazoo-drone` (params `formation`:
  `v` | `sine` | `loop` | `dive`; `shooter`).
- **Player vehicles** (`vehicles/`): `swan`, `sundae-driver`, `bandwagon`, `trumpeter`.
- **Amsterdam locals** (`locals/`, mission `ams`): `fatbike-youth`, `delivery-rider`, `seagull`,
  `handhaver` and its projectile `boete-ticket` (see `docs/api/locals.md`). Friendly NPCs and
  set dressing (`missions/ams/`): `ams-hotdog-vendor`, `ams-baker`, `ams-staff`,
  `ams-window-waver`, `ams-cyclist-bg`, `ams-pigeons`, `ams-ducks`, `ams-tour-boat`, `ams-boat-platform`.
  Breakables: `ams-tulip-stall`, `ams-market-stall`, `ams-herring-cart`, `ams-bike-rack`.
- **Mini-bosses:** `golden-goose` (`bosses/m2`; parts `neck`, `hull`), `big-head` (`bosses/m4`;
  parts `moustache-left`, `moustache-right`, `mouth-speaker`, `head`).
- **Bosses:**
  - `bosses/ams`: `ams-mayor` (ROBO-HALSEMA) — parts `stamp-arm`, `chain`, `medallion`, `head`
    (optional); projectile entities `noise-letter`, `shield-shot` (the stamp wave is internal).
  - `bosses/m1`: `encore` — parts `horn`, `calliope`, `wheel`.
  - `bosses/m2`: `ba-dum-behemoth` — `hihat-arm`, `tom-left`, `tom-right`, `crash-shield`,
    `bass-drum`.
  - `bosses/m3`: `windbag` — `drone-1`, `drone-2`, `drone-3`, `chanter`, `bag`.
  - `bosses/m4`: `grand-grand` — `lid`, `keyboard`, `front-legs`, `strings`; prop `chandelier`.
  - `bosses/m5`: `grand-organ` — `pipes-top`, `pipes-mid`, `pipes-low`, `bellows`, `speaker`;
    `organ-console` — `pipe-bank-left`, `pipe-bank-right`, `console`; `maestro` —
    `speaker-left`, `speaker-right`, `podium`; prop `wreck-block`.
- **Shared props** (`items/`, placed by missions): `helium-tank`, `statue-head`,
  `breakable-wall` (params `w`, `h`, `solid`), `rolling-drum`, `spring-awning` (variant `net`),
  `duck-float`, `lily-pad`, `card-table`, `air-jet`, `cable-car`, `bellows-platform`, `icicle`,
  `willow-tree`, `avalanche` (params `speed`, `maxSpeed`, `holdX`, `gap`, `stopX`), `rising-water`
  (params `startY`, `speed`).
- **Mission-local** (inside `missions/mN/`): `hatch`, `sign`, `mk1-head` and `drum-mine` (m1),
  `organ-distant` (m5).
- **Enemy projectiles** (defined in their owners' folders): `enemy-bullet`, `enemy-grenade`,
  `sonic-ring`, `low-ring`, `shockwave`, `cymbal-disc`, `baton`, `piccolo-bullet`,
  `bassoon-rocket`, `bell-shell`, `metronome-bullet`, `record`, `piano`, `note-bullet`,
  `note-rocket`, `ticket-dart`, `croak-ring`, `golden-egg`, `leaflet-bomb`, `sonic-cone`,
  `steam-note`, `foghorn-wave`, `paddle-wave`, `barrel`, `soot-ball`, `brass-pellet`,
  `tom-shell`, `drumstick`, `cymbal-saw`, `homing-note`, `sheet-mine`, `reel-note`,
  `felt-hammer`, `harp-beam`, `chord-note`, `anthem-beam`, `lane-blast`, `note-bomb`,
  `baton-beam`, `scream`, `crystal-shard`.

### 15.5 Missions and sections (`missions/`)

- `m0` (test range, unchanged).
- `ams` THE FRYING DUTCHMAN (MISSION 1): `a` Grachtengordel · `b` Museumplein · `c` Amstel ·
  `d` Stopera (boss).
- `m1` BRASS ON THE RIVERBANK: `a` Puddlewick Quay · `b1` Chimney Chase · `b2` Storm Drain ·
  `c` River Run (boss).
- `m2` DUNE BUGLE: `a` Rattlebone Flats · `b` Rocky Road · `c1` Canyon Floor · `c2` Mesa Top ·
  `d` The Drum Quarry (boss).
- `m3` THE HIGH NOTE: `a` Yodel Valley · `b1` North Face (vertical, up) · `b2` Echo Caves
  (vertical, up) · `c` Summit Station (boss).
- `m4` OPENING NIGHT: `a` Avenue of Statues · `b` Bandwagon Boulevard · `c1` The Underground ·
  `c2` Billboard Rooftops · `d` The Opera House (boss).
- `m5` SWAN SONG: `a` Above the Clouds (shoot-em-up) · `b` The Pipe Works (vertical, down) ·
  `c` The Console (final boss).
- **Background generators.** Standard (art agent): `sky-gradient`, `clouds`, `mountains`,
  `hills`, `treeline`, `jungle`, `city`, `ruins`, `dunes`, `ice-peaks`, `sea`. Custom (mission
  agents): ams `ams-skyline`, `ams-canal-houses`, `ams-elms`, `ams-plein` · m1 `town-rooftops`, `sewer-brick`, `far-bank`, `reeds` · m2 `cacti`, `canyon-walls`,
  `rock-pillars`, `quarry-terraces` · m3 `chalets`, `ice-cave`, `cable-cars` · m4 `neon-signs`,
  `crowd-barrier`, `subway-tiles`, `opera-hall` · m5 `organ-pipes`, `organ-deep`,
  `console-room`. The title lake scene reuses `sky-gradient`, `hills` and `sea`.
- **Terrain materials used:** ground `concrete`, `mud`, `sand`, `rock`, `snow`, `ice`, `metal`,
  `klinker` (ams) · edge `tiles`, `grass`, `moss`, `sand`, `snow`, `rust`, `bikepath`, `kerb`
  (ams) · platform `wood`, `metal`, `rock`, `ice`, `whitewood` (ams) ·
  solid `brick`, `crate`, `rock`, `metal`, `concrete`.

### 15.6 Sprite id prefixes

| Prefix | Contents |
|---|---|
| `char/<id>/…` | the ARCHITECTURE §6.1 player contract + `bored`, `salute`, `portrait`, Helium Head torso variants `helium-<anim>`, the Swan rider strips `ride-<pose>` (`sit`, `lean`, `up`, `hunch`, `hold`, `brace`, `duck`, `ears`, `cheer`; hip anchor; 3.6) |
| `enemy/<id>/…` | infantry: the §6.1 enemy contract + `double-take`, `salute`, `confused`, `queue`, `photo-pose`, `ears`, `die-crush`, `die-shatter`, `gag-<name>`; outfit variants as `enemy/<id>-<outfit>/<anim>` (e.g. `enemy/rifleman-desert/run`) |
| `creature/<id>/…` | `idle`, `walk`, `tell`, `attack`, `die`, `die-blast`, `die-burn`, optional `die-crush` (the Swan's STOMP, 8.2; missing, it falls back to `die`) (+ type extras) |
| `machine/<id>/…` | `body`, `turret`, `wheel`, `rotor`, `tell`, `fire`, `wreck` (+ support entities) |
| `vehicle/<id>/…` | `body`, `legs` / `wheels`, `neck` / `turret` / `bell`, `special`, `wreck`, `empty-gag`. The Swan instead uses whole-body strips with the legs (`idle`, `run` with its alias `move`, `squat`, `jump`, `fall`, `stomp`, `land`, `flap`, `glide`, `glide-tired`, `fold`, `skid`, `crouch`, `waddle`, `slide`, `settle`, `swim`, `water-duck`, `paddle-up`, `honk`, `honk-air`, `honk-swim`, `rise`, `wreck`, each with an `<anim>-front` overlay that hides the rider's hips), riderless strips (`sit-down`, `empty`, `empty-look`, `empty-lay`, `hiss`, `dive`, `bash`, `tumble`, `dazed`, `right`, `shake`, `migrate`, `migrate-soot`), `scuffs`, `egg`, and 9-angle neck strips (`neck`, `swim-neck`, `crouch-neck`, `duck-neck`, each with `-fire`, `-shell`, `-blink`, `-hurt`; `neck-relax`, `swim-neck-relax`, `neck-honk`). Body prefixes `vehicle/swan`, `vehicle/swan-mute`, `vehicle/swan-socks`, `vehicle/swan-mute-socks`; overlays and necks use only `swan` or `swan-mute` (`docs/design/swan-mount/look.md` §9) |
| `boss/<id>/…` | one strip per part and damage state `<part>-0`, `-1`, `-2`, plus `<anim>` strips (mini-bosses too) |
| `item/<id>/…` | `item/crate`, `item/hostage/<kind>/<anim>`, `item/pickup-weapon/<weapon>`, `item/pickup-bombs`, `item/pickup-food/<kind>`, `item/pickup-gem/<kind>`, `item/pickup-1up`, `item/pickup-repair` |
| `prop/<id>/…` | shared props (15.4), and the m1 `drum-mine` (2 frames) |
| `proj/<id>` | every projectile, player and enemy |
| `fx/<id>` | `explosion-s`, `explosion-m`, `explosion-l`, `smoke`, `soot`, `poof`, `dust`, `confetti`, `music-note`, `steam-puff`, `helium-cloud`, `splash`, `spark`, `shadow`, `aim-line`, `stars-dizzy`, `flying-shako`, `stick-on-moustache`, `snow-puff`, `ice-cubes`, `tin-feather` (the Swan's stamped ivory feather plate, 4 turning frames), `muzzle-<weapon>` (also `muzzle-swan-beak-gun`) |
| `ui/<id>` | `logo`, `cursor-swan`, `icon-life`, `icon-hostage`, `icon-bomb`, `icon-shell`, `icon-cell`, `icon-balloon`, `icon-weapon-<weapon>`, `onward`, `ride`, `bubble`, `newspaper`, `star`, `portrait-gusto` |
| `npc/ams/<id>/…` | the Amsterdam friendly NPCs (vendor, baker, staff, window wavers, background cyclists, pigeons, ducks) |
| `decor/<mission>/<id>` | static props and set-piece art per mission (banners, posters, signs, tents, the parked Trumpeters …; for the Swan beats: `m1/sign-no-diving`, `m1/judges-box`, `m1/sign-timpani`, `m3/sign-piste-closed`, `m3/k-line-blue`, `m3/k-line-red`, `m3/judges-stand`, `m3/snow-mound`, `m3/cable-car-cabin`) |

### 15.7 Sound effects

`weapon/pistol`, `weapon/machine-gun`, `weapon/shotgun`, `weapon/rocket`, `weapon/flame`,
`weapon/laser`, `weapon/homing`, `weapon/tuba`, `weapon/bounce-mine`, `weapon/mine-bounce`,
`weapon/empty`, `weapon/grenade-throw`, `weapon/grenade-bounce`, `weapon/knife`,
`weapon/knife-umbrella`, `weapon/knife-needles`, `weapon/knife-pan`, `weapon/knife-wrench`,
`explosion/s`, `explosion/m`, `explosion/l`, `explosion/part`, `hit/enemy`, `hit/metal`,
`hit/drum`, `hit/shield`, `player/jump`, `player/land`, `player/die`, `player/spawn`,
`player/helium-on`, `player/helium-pop`, `player/helium-deflate`, `player/yawn`, `item/weapon`,
`item/bombs`, `item/food`, `item/gem`, `item/1up`, `item/repair`, `item/crate-break`,
`hostage/free`, `hostage/give`, `hostage/faint`, `hostage/composer`, `hostage/camera`,
`vehicle/enter`, `vehicle/exit`, `vehicle/hit`, `vehicle/warning`, `vehicle/alarm`,
`vehicle/ram`, `vehicle/jingle`, `swan/step`, `swan/paddle`, `swan/fire`, `swan/honk`,
`swan/squeak`, `swan/jump`, `swan/land`, `swan/skid`, `swan/flap`, `swan/fold`, `swan/glide`,
`swan/tired`, `swan/stomp`, `swan/splash`, `swan/hiss`, `swan/dazed`, `swan/migrate`,
`sundae/mortar`, `bandwagon/brass`, `bandwagon/drum`, `bandwagon/cymbals`,
`trumpeter/flap`, `trumpeter/bail`, `enemy/alert`, `enemy/double-take`, `enemy/aria`,
`enemy/scream`, `enemy/panic`, `enemy/salute`, `enemy/rifle`, `enemy/windup`, `enemy/grenade`,
`enemy/tuba-inhale`, `enemy/tuba-blast`, `enemy/cymbal-raise`, `enemy/cymbal-crash`,
`enemy/drum-hit`, `enemy/drumroll`, `enemy/whistle`, `enemy/piccolo-whistle`,
`enemy/piccolo-shot`, `enemy/triangle`, `enemy/bassoon-aim`, `enemy/fumble`,
`machine/tank-move`, `machine/tank-charge`, `machine/sad-notes`, `machine/truck-horn`,
`machine/brake`, `machine/metronome-tick`, `machine/metronome-tock`, `machine/scratch`,
`machine/piano-whistle`, `machine/piano-crash`, `machine/copter`, `machine/pipe-charge`,
`machine/anthem-crackle`, `creature/croak-build`, `creature/croak`, `creature/windup`,
`creature/rattle`, `creature/bat-screech`, `creature/goat`, `creature/shush`, `creature/kazoo`,
`boss/warning`, `boss/part-break`, `boss/calliope-scale`, `boss/foghorn`, `boss/trombone-pull`,
`boss/hihat-open`, `boss/beater-pull`, `boss/bagpipe-drone`, `boss/bagpipe-die`,
`boss/piano-rattle`, `boss/piano-gliss`, `boss/harp-charge`, `boss/organ-chord`,
`boss/goose-wiggle`, `boss/goose-honk`, `boss/scream`, `boss/voice-crack`, `boss/deflate`,
`env/applause`, `env/rimshot`, `env/cricket`, `env/water-splash`, `env/water-rush`, `env/wind`,
`env/radio-static`, `env/avalanche`, `env/timber`, `env/ice-melt`, `env/train-bell`,
`env/train-pass`, `env/anthem-sting`, `ui/move`, `ui/confirm`, `ui/cancel`, `ui/pause`,
`ui/announce`, `ui/coin`, `ui/countdown`, `ui/timer-warn`, `ui/tally-tick`, `ui/tally-end`,
`ui/star`, `ui/stamp`, `ui/select-confirm`, `ui/mil-shutter`, `ui/mil-clank`, `ui/name-letter`, `mission/checkpoint`,
`mission/time-up`; engine drum hits `drum/kick`, `drum/snare`, `drum/hat`, `drum/ohat`,
`drum/crash`, `drum/tom`, `drum/clap`, `drum/rim`.

Mission `ams` (docs/design/amsterdam.md §4; `src/game/content/sfx/ams.ts`): `ams/bell`,
`ams/bass-thump`, `ams/gull`, `ams/kick`, `ams/stamp`, `ams/chain`, `ams/ticket`.

Added 2026-10-14 with the sampled audio of ams and the start screens (each id has a quiet synth
recipe as the fallback of its ElevenLabs take): `player/step` (footsteps in missions with
`footsteps`, every 16 ticks at a run), `player/splash` (wading into or dropping into water),
`weapon/reload` (bombs picked up while riding), `swan/engine` (loop while she is ridden),
`ui/title-sting` (the first title visit), `env/title-lake` (loop under the title), the section
ambience loops `env/ams-canal` and `env/ams-street`, `env/ams-carillon` (now and then in sections
a–c), `ams/rider-crash`, `ams/handhaver-down`, `ams/tour-boat` (loop while a tour boat is in
view), `ams/duck`, `ams/pigeon`, `ams/mayor-intro` (ROBO-HALSEMA steps out) and `ams/mayor-babble` (loop: her
wordless robot chatter while one of her bubbles is up; a placeholder, she has no voice). `ui/go` plays when
the GO arrow comes up.

### 15.8 Music

`title`, `select`, `briefing`, `ams`, `ams-boss`, `m1`, `m2`, `m3`, `m4`, `m5-sky`, `m5-organ`, `mini-boss`, `boss`,
`boss-final`, `boss-final-fast`, `anthem`, `mission-complete`, `continue`, `game-over`, `ending`,
`credits`, `high-score`. (`m0` uses `m1`.)

### 15.9 Requests to other owners (collected from this document)

1. **Art (rig):** a `headScale` parameter (Helium Head); optional per-character held props for
   the knife look; the extra infantry animations of 9.0; outfit palette variants; the nine Swan
   rider strips `char/<id>/ride-*` for every playable character and `recruit`, exactly as 3.6:
   `ride-sit` 2 f (20 ticks, loop), `ride-lean` 2 f (6, loop), `ride-up` 1 f, `ride-hunch` 1 f,
   `ride-hold` 2 f (4, loop), `ride-brace` 1 f, `ride-duck` 1 f, `ride-ears` 2 f (6, loop),
   `ride-cheer` 2 f (8, loop) = 14 frames; rig part `upper`, hip anchor (the pelvis pixel),
   `weapon: 'none'`, points `head` and `hand` only (no `muzzle`); `RIDE_*` pose tables in
   `src/game/art/poses.ts`, registered by `definePlayerSprites` (arm targets: `look.md` §6.4);
   added to the art tests' frame-count and point checks. No `helium-ride-*` strips and no
   `mount-duck` frame.
2. **Gameplay (player):** status timers with physics overrides (Helium Head); per-player sfx
   pitch through the existing `sfx(id, { pitch })` option; drop-through never over deep water
   (4.2: down + jump on a one-way platform with a `water` hazard rect under the feet is a normal
   jump). Optional helpers for the ridden Swan (the Swan module can work without them):
   `RidePose` and `Player.drawRide(r, x, y, flipX, pose, frame?)` with the invulnerability blink
   and the fallback chain `ride-<pose>` → `ride-sit` → `mount` frame 1 drawn 17 px lower, and a
   flag (for example `cheering`) that tells a ridden Swan when to cheer (`victory()` returns early
   while mounted; without the flag the Swan cheers on `bossDefeated`) (`look.md` §6.5).
3. **Mission runtime:** `timeLimit` in counts of 256 ticks; `autoScroll(speed)` (a moving
   `camera.lock` window); `iceRanges`; vertical-section triggers and y checkpoints; exit rects
   that act as drop-in holes; vehicle carry-over (`allowVehicles`, session `{vehicleId, cells,
   shells}`); players spawning mounted (`m5-a`); the respawn rules for vertical sections (11.0);
   the avalanche pursuit rule (9.5; params `speed`, `maxSpeed`, `holdX`, `gap`, `stopX`; respawns
   at least 160 px right of its front); the willow that crushes only team `enemy` and pushes
   players and Swans out (9.5); the invisible body wall at x 2844 during THE ENCORE (a clamp like
   the view edges, not a `SolidBox`, so it never stops shots; 10.1); the Swan-only body wall at
   x 2860 in `m3-a` after its `UNLOCK` (the same kind of clamp; a ridden Swan that touches it on
   the ground ejects her pilot; 11.3); the SHE TOOK THE LIFT record: one entry for each swan still
   in one piece at the end of `m3-a`, `{ variant: 'ivory' | 'mute', cells, shells }`, read at the
   start of `m3-c` (11.3).
4. **Audio:** the 12 new Swan sound effects of 12.1 (`swan/jump`, `swan/land`, `swan/skid`,
   `swan/flap`, `swan/fold`, `swan/glide`, `swan/tired`, `swan/stomp`, `swan/splash`,
   `swan/hiss`, `swan/dazed`, `swan/migrate`) and the new `swan/step` recipe; otherwise the
   existing contract (`boss-final-fast` is its own song).
5. **HUD / scenes:** speech bubbles, the newspaper tally, the ONWARD prompt, the boss bar, the
   `RIDE?` bubble; no ammo digits for the pistol (13.7); the `STOMP!` hint over a drummer (m1-c,
   drawn like the willow's `SHOOT!` chevron); the `DRUM ROLL! +1000` callout; the Swan marker at
   the top edge (13.7, required); the title scene (13.3, shared code `src/game/scenes/title.ts`):
   the ridden swimming Swan, drawn as `vehicle/swan/swim`, then `char/grace/ride-sit` at the seat
   point, then `swim-front`, then `swim-neck-relax` at the neck point (the order of `look.md` §7;
   the vehicles module exports a small draw helper for it), and the `HOLD JUMP   GLIDE (SWAN)`
   line of HOW TO PLAY. Later, not needed for the first build: an attract demo that rides (odd
   loops play `m1-a` as now, even loops `m1-c` from its start: the bot mounts the Swan at x 160,
   stomps the DRUM LINE, leaps the tank and glides off the slipway; 1200 ticks).
6. **Items:** the weapon pickup is a round ivory medallion with a navy letter (7.1); hostages use
   `bow` instead of a salute (7.2); `auto` / `table-a`…`table-d` drop values (Conventions, 7.3);
   `pickup-gem` with `params.float: true` has no gravity and hangs at its placed y
   (`PickupSpec.gravity: false`; the glide trails of `m1-c` @700 and `m3-a` @1880; 7.1). Today
   every `pickup-gem` falls, so the trail notes would drop into the river or onto the valley floor.
7. **Vehicles and physics (the Swan, 8.2).** Already in shared code, no request:
   `Vehicle.keepInView` (the view clamp of 8.1), `floatOnWater(this, 16)` in `src/game/water.ts`
   for her float line (call it after `moveBody`; skip it where the ground under her is above the
   float line), and the fire + jump ram (`TUNING.vehicle.ramButtons = ['fire', 'jump']`, 4.1).
   Built in `src/game/content/vehicles/` with the existing hooks, no shared change: her numbers
   (`feel.md` §14) kept in the module, as the header of `tuning.ts` asks (no `TUNING.swan`
   block); her Body settings (gravity 0.18, maxFall 5.0, stepUp 12, snapDown 8) and the glide's
   runtime `body.gravity` / `body.maxFall`; overrides of `control()` (her own eject rule, down
   then jump within 4 ticks, and her combo rule, a jump that comes first stays a jump),
   `physics()`, `animate()`, `draw()`, `hurtboxes()`, `seatRect()` per pose and `syncDriver()`
   (the driver's anchor is her feet anchor, not the seat: 8.2 Size); `fireMain()` /
   `fireCannon()` (body `neck` point + neck `muzzle` / `cannon`); `special()` / `trySpecial()`
   for the HONK (`reactInArea(…, 'ears', 60)`, `eraseEnemyShots`, `world.damage` per part);
   `updateRam()` (the dive, the daze and the migration as phases of the base `'ram'` state, then
   `'idle'`); `explode()` (the sooty migration); the STOMP; the PERCH
   (`world.addSolid(new SolidBox(…, true, this))`, `world.moveSolid`, `enabled`; on through jumps
   over water, 8.2 Co-op); the water re-mount (she calls her own `mount(p)`, 8.2 Water); the
   cheer on `bossDefeated`. **Shared change requested:** `TUNING.vehicle.comboWindow` 4 → 1, so
   every vehicle combo needs both presses on the same tick or 1 tick apart (4.1); the header of
   `src/game/vehicle.ts` and `docs/api/game.md` ("within 4 ticks") follow it. **Tuning floor:**
   keep her top speed, swim speed, jump apex and glide at or above the 8.2 values. Every required
   check holds from −15 % to +15 %, but the optional BOAT HOP chain and the full glide over the
   minefield (11.1) and the red K-line (11.3) need the 8.2 values or more.
8. **Camera:** `lead` 64 and `maxSpeed` 4 while any followed player rides a Swan; 38 and 3
   otherwise (4.12). `Camera.lead` and `Camera.maxSpeed` are public fields, so the Swan module
   can set them itself (it counts the ridden Swans, and the last one to lose its rider restores
   38 and 3); a shared helper is optional.
9. **Art (vehicles, fx, props, decor):** the Swan strips of 15.6 in four colour variants
   (`look.md` §9–§12); `fx/tin-feather` (a stiff, stamped ivory plate 5×2 with a navy tip, a 1 px
   `steel[3]` edge glint and a 1 px gold rivet dot at the quill; it tumbles rigidly in 4 turning
   frames and never curls like down); `fx/muzzle-swan-beak-gun`; `prop/drum-mine`; the m1 and m3
   decor of 15.6; `ui/icon-life` and `ui/cursor-swan` use her head (ivory dome, lens eye, navy
   face patch, orange beak), and `mk1-head` is an older, rusty version of it with a dented dome,
   river weed on top and a lifebuoy stencilled `MK1` (red and ivory quarters) round its neck at
   the waterline: no hat or helmet of any kind; optional `creature/<id>/die-crush` strips (15.6;
   missing, they fall back to `die`).
10. **Architecture:** ARCHITECTURE §6.1 already lists the `ride-*` strips and the open-seat
    `seat` note. Still to add: the strip timings and the hands rule of 3.6, and the note "the
    driver's anchor is not the seat: an open-seat mount overrides `syncDriver()` and puts it on
    its own feet anchor (a flyer: 15 px below its hull centre), so enemy AI reads it like a player
    on foot".
11. **Machines:** `oompah-tank` `params.maxX` (9.2; `m1-c` @360 uses `maxX: 744`).

### 15.10 Originality self-check (`docs/ORIGINALITY.md`)

1. **Names:** every proper name is invented for this project (Task Force CYGNET, Lowmere,
   Crescendia, Puddlewick, Rattlebone Flats, Mount Murmur, Fanfaroni City, Little Hushing, the
   Fanfare Legion and its leaders, the four heroes, Brigadier Gusto, Mrs. Dollop, every vehicle,
   enemy and boss). No vehicle uses the banned "<animal> + series noun" pattern; the banned-name
   lists of ORIGINALITY.md and research §23 were checked. Names were also web-checked against
   other franchises (Revision notes): the hero surname, the villain's name and one section title
   were changed because they matched existing characters or titles.
2. **Characters:** a slim officer with a beret and long white scarf, a giant in a knitted sweater
   and bobble hat, a small rookie in a reflective vest and helmet, a bald old engineer in a boiler
   suit. Enemy soldiers are crimson-and-gold marching-band troops with shakos (no green fatigues,
   no borrowed insignia). Hostages are fully dressed critics and civilians tied to chairs; freed,
   they take a curtain-call bow (never a salute). The SWAN-3 is a riveted robot swan ridden on her
   back (user request, 16.1). She never reads as an armoured ostrich: no plumage, helmet, saddle
   frame, stirrups or flank gun; her gun is her beak (`docs/design/swan-mount/look.md` §15). Her
   head carries no control stick (unlike a famous cartoon robot swan), and Mk1's wreck wears a
   lifebuoy, never a sailor hat (a white bird head with an orange beak under a sailor cap is a
   famous cartoon duck).
   Weapon pickups are ivory medallions, not dark boxes with a yellow letter.
3. **Gags and transformations:** the one status gimmick is Helium Head (head and jump only; no
   zombie, mummy, fat, gold or snowman transformation). Enemies never laugh at a player's death,
   and panicking soldiers scurry quietly (no arm-waving, no scream). Set pieces (anthem salutes,
   parade columns, floating pianos, the jingle queue, the sheet-music telegraph, the willow
   bridge, the avalanche, the meltwater climb, the drum line, the timpani minefield, the ski-jump
   K-lines; there is no broken-bridge glide) and all bosses (riverboat, drum kit, bagpipe
   airship, piano, organ, console, podium) are this project's own; there is no free-fall final
   fight.
4. **HUD and text:** our own HUD (icons and digits, no labelled weapon/bomb boxes, `ONWARD`
   chevrons, the `RIDE?` speech bubble with no arrow, no `∞` ammo sign, swan-head lives). All
   lines, jokes, headlines and announcer calls are new (every weapon call-out adds its own tag
   line); generic phrases (`MISSION 1`, `START!`, `MISSION COMPLETE!`, `CONTINUE?`, `GAME OVER`)
   are used as allowed.
5. **Music and sound:** tracks are described by mood, tempo, key, instruments and form only; the
   music agent writes new melodies (12).

---

## 16. Revision notes (originality and consistency review, 2026-10-09)

**Originality** (names were also web-checked against other franchises):

- The villain is now **Grand Marshal Bombastian Fanfaroni** ("Fortissimo" is an existing
  opera-singer sound villain in *Freedom Force vs the 3rd Reich*). The city, signs, newspaper,
  captions and credits follow. His final scream attack is now `BRAVISSIMO!`.
- The squad leader is now **Captain Grace Stillmere** ("Grace Holloway" is a *Doctor Who*
  companion). The id `grace` and the callsign stay.
- Section `m2-b` is now **Rocky Road** ("Sundae Drive" is the title of an ice-cream-truck shooter).
- Weapon call-outs: each one has its own tag line. "TOASTY!" (a *Mortal Kombat* line) is gone, and
  the shotgun no longer repeats the tourist's SAY CHEESE.
- Freed hostages take a curtain-call `bow`, not a salute (research §23.2).
- Weapon pickups are round ivory band-button medallions with a navy letter (not a dark box with a
  yellow letter, not a winged emblem).
- HUD: no `∞` for the pistol. The empty-vehicle marker is a `RIDE?` speech bubble with no arrow.
- The SWAN-3 pilot sat under an enclosed canopy (never astride a bird). **Superseded** the same
  day by the user's request: she is now ridden on her back (16.1).
- Panicking infantry scurry on tiptoe (no arm-waving, no scream).
- The NORMAL difficulty hint no longer echoes a well-known hardware slogan.

**Consistency and completeness:**

- Hostage drops written as table letters (`(C)`, `(D)`, `(A)`) are now `(auto)`. The tables are
  `table-a` … `table-d`, and `B` only means Bounce Mines (Conventions, 7.2, 7.3, 15.3).
- The hidden 1UP hostage kind is now `composer` (sfx `hostage/composer`), so `maestro` only names
  the final boss stage.
- New ids: `tank-crewman`, `crystal-shard`. All gag ids are listed in 15.4 (new piccolo gag
  `scales`). The `piccolo` missions column now includes m5.
- Geometry: the m1-a secret ledge route (from the roof awning); the m2-c1 ledge moved out of the
  cave ceiling (780–880, bassoonist @830); m3-b2 icicle tops at y 808; the m4-a high balcony moved
  to 540–600 so a Helium Head jump can reach it; the ENCORE bow at view x 232 (clear of the
  pontoon); the foghorn high wave at 22–38 px; the BIG HEAD height (chin 36–52 px above the
  ground) and its gondola.
- Added numbers: drumstick, cymbal-saw and crystal-shard speeds and sizes; `icicle` and
  `willow-tree` scores.
- Music cues for the title and mode select screens; the 11.0 header list now matches the section
  headers (music is set per mission).
- 15.9 lists the follow-ups for the art, items and HUD owners.

### 16.1 User request: the Metal Swan becomes a ridden, ostrich-class mount (2026-10-09)

**The request.** The user asked for a "Metal Swan" vehicle in the role of the reference game's
ostrich mount: a bird that the pilot rides on its back, fast, with very high jumps and an aimable
gun. This request reverses the canopy rule above (the pilot under an enclosed canopy, never
astride a bird). The specs are in `docs/design/swan-mount/`: `feel.md` (numbers), `look.md` (look
and sprite contract), `levels.md` (level use) and `decisions.md` (every choice between them).

**Why riding is allowed.** Riding a creature, or a robot shaped like one, is a genre mechanic,
not protected expression. Countless games let the player ride horses, riding birds or dinosaurs,
and ORIGINALITY.md allows "vehicles the player can enter, with their own weapons and armour". The
mechanics we share with the reference mount are generic: a fast ride, high jumps and a gun that
sweeps 180°. The expression stays ours: the name, look, silhouette, palette, animation, sounds and
gags.

**Originality safeguards.**

- **A machine, not an animal.** She is a riveted robot of enamel plates, with no plumage and no
  skin (her only feathers are stamped tin plates that clink off her as effects). Filled black,
  her silhouette is a long, low boat hull with a thick curved neck and an
  upturned tail. It is never a small round body high on long legs with a thin upright neck
  (`look.md` §2).
- **No armour props.** No helmet, visor, goggles, crest or plume on her head. No saddle frame,
  straps, stirrups, reins or saddle blanket. The rider sits on a low quilted pad built into her
  deck and holds two brass handles. The wing plates hide his legs.
- **No gun on the flank.** There is no barrel or gun pod anywhere on her body. Her gun is her
  beak, aimed with her neck. The flank has only flush vents.
- **Our own palette.** Ivory, steel, navy trim, gold rivets, an orange beak and orange paddles.
  Her body is never gold or yellow: the gold swan is the enemy's Golden Goose, and a yellow riding
  bird belongs to another franchise.
- **Our own verbs and gags.** She swims and pivots on the water, glides on her wing plates,
  stomps, HONKs a shockwave, waddles, and hisses before a dive. After a dive she crash-lands dazed
  or migrates; she never runs off. She lays a nervous riveted egg, wears knitted socks and looks
  back at her rider. Her skid turn lasts 7 ticks: we do not copy the reference mount's slow turn
  that leaves its rider exposed, and her armour still protects the pilot.
- **Our own level beats.** A regatta slipway, a judges' box, a kettledrum minefield, an avalanche
  run and a ski jump. There is no broken-bridge glide: the reference game's ostrich route crosses
  a broken bridge (research §19, §23.6).
- **Our own names and sounds.** SWAN-3, Metal Swan, the Mute, TRUMPETER, SWAN DIVE, BEAK BASH,
  PERCH, SHE TOOK THE LIFT. Every sound is synthesized (12.1). The specs describe the reference
  mount but never name it.
- **Other famous mounts were checked:** a yellow riding bird of an RPG series, a green dinosaur
  mount, jousting ostriches, a platformer's ostrich buddy, a giant sky-bird mount, a swan monster,
  a cartoon robot swan steered by a stick on its head (it fires a laser from its mouth), a
  sea-ferry creature and a honking indie goose. None of their looks or gags is echoed
  (`look.md` §15.3): she is steered by two handles on her deck, never by a stick, lever or panel
  on her head or neck, and her beak fires rounds and shells, never a beam.
- **No borrowed cartoon heads.** Mk1's wreck in `m1-c` wears a rusty lifebuoy and river weed, no
  hat of any kind: a white bird head with an orange beak under a sailor cap is a famous cartoon
  duck, and a helmet would bring back the reference mount's helmeted bird.
- **Mk2 keeps its canopy.** The enemy's Golden Goose keeps the enclosed canopy as its own trait,
  so the hero machine and the enemy machine look even more different (9.4).

**What changed in this document:** 1.1, 1.2, 1.4, 1.5 (m2's van is now "a heavy vehicle"; the
Swan is the fastest ride), 2.5, 2.6, 3.6 (the `ride-*` strips), 4.1, 4.2, 4.3, 4.9 (the tail
perch), 4.12 (the Swan camera), 6.3 (the shell adds her speed), 8.1 (the open seat, the view
clamp, the eject and ram exceptions, VEHICLE AT THE FINISH in m3), 8.2 (rewritten: a fast ridden
jumper with a glide replaces the slow walker), 8.5 (the rider sits astride; about 76×64), 8.6, 9.4,
9.5 (willow, avalanche), 10.1 (the arena wall), 10.3 (riding a Swan), 11.0, 11.1 (`m1-c` re-laid),
11.3 (`m3-a` re-laid; `m3-c` SHE TOOK THE LIFT), 12.1 (12 new sfx), 13.3, 13.7, 14.2, 14.3, 15.4,
15.6, 15.7, 15.9 and 15.10.

**Review fixes (2026-10-09, after the originality, math, feasibility and user-intent critics;
each one is listed in `docs/design/swan-mount/decisions.md`, "Review fixes"):** Mk1 wears a
lifebuoy, not a sailor hat (2.5, 11.1, 15.9); "no plumage" instead of "no feathers", and no
control stick on her head (8.2, 15.10, 16.1); the exact rider strips (3.6, 15.9); vehicle combos
need both presses on the same tick or 1 tick apart, a Swan jump that comes first stays a jump,
and the Swan's eject needs jump within 4 ticks after down (4.1, 8.1, 8.2); no drop-through over
deep water (4.2); floating glide-trail notes (7.1, 15.3); the driver's anchor is the Swan's feet
(8.2, 8.5); the water catch, the perch over water, 0 cells in the air, where the SWAN DIVE
starts, and the jump and glide numbers (8.2); the oompah-tank leash `maxX` (9.2, 15.4); the
ENCORE pontoon (10.1); `m1-c` (the tank leash, the placed rowboat, the footer) and `m3-a` (one
boulder, goats 45 ticks apart, a baton-copter, the red K-line at x 2540, the cliff wall after the
UNLOCK); the SHE TOOK THE LIFT record (11.3); the Swan marker (13.7); `die-crush` for creatures
(15.6); 15.9 (rewritten item 7, tuning floor, new item 11).

---

## 17. First-person mode (after `ams`) — see `docs/design/fps.md`

By the user's decision (2026-10-14), the game changes style, direction and gameplay after the
`ams` boss ROBO-HALSEMA: a glitch and a story card lead into a first-person raycaster shooter
with the classic mechanics of the genre (doors, keys, push-wall secrets, treasure, health, ammo,
lives) against Nazi soldiers, one floor ("SUPPLY DEPOT") and a boss floor ("HANGAR") with the
final boss MechaHitler (a mech suit, then on foot), then the ending. Only one player plays it
(P1, or P2 when P1 is already out at the ams boss kill); the other slot waits. The in-game name of the mode is `MODE_TITLE` until the user names it.

**`docs/design/fps.md` is the spec of this mode and wins over this document for it** (flow,
controls, numbers, maps, boss, art, audio, tests). Its originality rules and dated exceptions
(historical symbols, red blood in this mode only, a designed voice) are in `docs/ORIGINALITY.md`
and `docs/ART_GUIDE.md` §10.

