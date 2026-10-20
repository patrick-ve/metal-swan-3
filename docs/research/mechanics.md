# Research: the gameplay mechanics of Metal Slug 3 (feel reference for METAL SWAN 3)

> **Purpose.** This file records how *Metal Slug 3* (SNK, Neo Geo MVS, 2000) and its series siblings
> work as a **game system**: speeds, timers, rules, numbers. Use it to tune the **feel** of our
> original game. It is not a content brief.
>
> **IP warning.** This file names characters, vehicles, bosses, missions and lines from the series.
> We need these names here only to trace facts to their sources. **Never put any of these names,
> designs, gags, texts or tunes into game content.** Read `docs/ORIGINALITY.md` and section 23
> ("IP to avoid") before you use anything from this file.
>
> **Engine contract reminders** (`docs/ARCHITECTURE.md`): 60 Hz fixed ticks, 384×216 logical
> pixels, y grows downward, standing humans about 36 px tall, all speeds in px/tick, all timers in
> ticks.

---

## How to read the tags

Every number in this file has one tag.

| Tag | Meaning |
|---|---|
| **SOURCED [Sx]** | A linked source states the number. `Sx` points to the source list in section 1. |
| **MEASURED [Vx @ time]** | We measured the number ourselves, frame by frame, from the linked gameplay video `Vx` at the given time stamp. The method is in Appendix A. This counts as sourced: the video is the primary source. |
| **ESTIMATED** | Our estimate. The reasoning is given next to it. Treat it as a starting value for play-testing. |

Units used in this file:

- **MS tick** = one game-logic update of Metal Slug 3 = **2 video frames** at 59.185 Hz = **33.8 ms**
  (≈ 29.6 updates/s). MEASURED, see section 1.3.
- **vblank** = one Neo Geo video frame (16.9 ms). TAS notes count "frames" in vblanks.
- **our tick** = one tick of our engine (16.7 ms). **1 vblank ≈ 1 our tick** (1.4 % difference).
- **ru** = raw damage units of the game (1 pistol bullet = 10 ru). **pu** = "pistol units" used by
  the speed-run guides (ru ÷ 10).

---

## 0. Quick reference: the twenty numbers that matter most

| Quantity | Metal Slug 3 (native 304×224) | Suggested for our engine (60 Hz, 384×216) | Tag |
|---|---|---|---|
| Logic update rate | 29.6 Hz (new image every 2nd vblank) | run at 60 Hz, halve MS per-update speeds | MEASURED [V1, V2] |
| Standing human height | 36 px | 36 px → **1 MS px = 1 our px** | MEASURED [V2 @ 10–16 s] |
| Walk speed | 3 px / MS tick (≈ 89 px/s) | **1.5 px/tick** | MEASURED [V2 @ 134.9–137.0 s] |
| Jump air time (flat ground) | 27 MS ticks (0.91 s) | **54 ticks** | MEASURED [V2 @ 15.8–17.8 s, 63.9–75 s] |
| Jump apex | ≈ 46–52 px (≈ 1.3–1.4 body heights) | **≈ 47 px** (v₀ 3.5, g 0.13) | MEASURED [V2 @ 63.9–75 s] |
| Horizontal speed in a moving jump | ≈ 4 px / MS tick (faster than walking) | **2.0 px/tick** | MEASURED [V1, V2 @ 66.9–67.8 s] |
| Pistol bullet speed | 16 px / MS tick | **8 px/tick** | MEASURED [V2 @ 11.95–12.25 s] |
| Pistol rate (mashed, standing) | 1 shot / 4 MS ticks (≈ 7.4 shots/s) | **cooldown 8 ticks** | MEASURED [V1 frames 331–339] |
| Machine gun | 4 rounds per press, 1 round per 4 vblanks, 200 rounds | **1 round / 4 ticks**, 200 rounds | SOURCED [S2, S4] |
| Grenade | ≈ 124 px range, 1 bounce, explodes on 2nd landing, ≈ 1 s | vx 2.1, vy −1.5, g 0.2, bounce 0.65 | MEASURED [V2 @ 18.7–19.7 s] |
| Grenades | 10 per life, max 99, max 2 in the air, 100 ru | same | SOURCED [S4, S7, S16] |
| Knife | 30 ru (= 3 pistol shots), ≈ 3 stabs/s, auto at close range | **cooldown 20 ticks** | SOURCED [S1, S3, S6] |
| Time limit | 60 counts; 1 count = 128 MS ticks (4.33 s) → 4 min 20 s per checkpoint | **256 ticks per count** | MEASURED [V1] + SOURCED [S7] |
| Lives | 3 per credit, no extra lives | same | SOURCED [S7] |
| Respawn invulnerability | short blink after the drop-in | **120 ticks** | ESTIMATED (sec. 9) |
| Tank armour | 3 hits; gas can restores 1 hit; 10 shells | same | SOURCED [S11] |
| Captive bonus | 10,000 per captive at mission end; lost on death | same idea | SOURCED [S8] |
| Camera catch-up after an arena unlock | 6 px / MS tick, easing down to the walk speed | **3 px/tick max, ease out** | MEASURED [V1, V2] |
| Average forward progress (normal play) | ≈ 46 px/s (camera moves ≈ 57 % of the time) | **≈ 0.75 px/tick average** | MEASURED [V2 @ 130–200 s] |
| Mission length (skilled player) | 3–8 min (missions 1–4), final mission ≈ 26 min | **4–8 min per mission** | MEASURED [V3] |

---

## 1. Sources and method

### 1.1 Written sources

| Id | Source | What it gives |
|---|---|---|
| S1 | TASVideos submission #5392, *Arcade Metal Slug 3 "2 players"* by zk547 — <https://tasvideos.org/5392S> | Damage per weapon (ru), hit counts, cancel tricks, boss HP notes |
| S2 | TASVideos submission #9815, *Arcade Metal Slug X "2 players"* by zk547 — <https://tasvideos.org/9815S> | Same engine family as MS3: frame data for the machine gun, vulcan, laser, jumps, landing delay |
| S3 | Speed-run guide "Metal Slug 3 Strat Explanation" (Enasper, Sukimos, GenevensiS, VerzViper, toto64) — <https://docs.google.com/document/d/1sO8fh1STVBEU4qrFSYjD7CZxlwplGCqNL_Ar6Zb41eY/> | Air control, fire-rate rules, weapon chart, drops, boss HP at LEVEL-4 |
| S4 | "Metal Slug 3 One Coin Guide" (GenevensiS) — <https://docs.google.com/document/d/1EYcFF-lxlduP9l_nF04S6jyKRqYdaCgKi7lRkvvjrA0/> | Weapon chart (ammo, 2nd pickup, crate, max on screen), splash rules, difficulty levels, debug DIPs, enemy and boss HP at LEVEL-4 / LEVEL-8, enrage thresholds |
| S5 | Speed Demos Archive knowledge base, *Metal Slug (series)* — <https://kb.speeddemosarchive.com/Metal_Slug> | Fire-rate cap, crouch bypass, weapon ranking, pistol draw delay |
| S6 | Metal Slug Wiki, *Weapons* — <https://metalslug.fandom.com/wiki/Weapons> | Ammo per pickup (series), repeat pickups, weapon behaviour, melee, grenade variants |
| S7 | Metal Slug Wiki, *Status Screen* — <https://metalslug.fandom.com/wiki/Status_Screen> | Lives, timer rules, ammo cap 999, bomb cap 99, reset rules, continue score marker |
| S8 | Metal Slug Wiki, *Recaptured Prisoners* — <https://metalslug.fandom.com/wiki/Recaptured_Prisoners> | Captive points, vehicle bonus points, "Great!" bonus |
| S9 | Metal Slug Wiki, *Continue Screen* — <https://metalslug.fandom.com/wiki/Continue_Screen> | Continue count, machine-gun crate on continue |
| S10 | Metal Slug Wiki, *Items* — <https://metalslug.fandom.com/wiki/Items> | Item points, crate rules, gas can, medicine |
| S11 | Metal Slug Wiki, *SV-001* — <https://metalslug.fandom.com/wiki/SV-001> | Tank armour, shells, vulcan, hatch, ramming |
| S12 | Metal Slug Wiki, *Slugs* — <https://metalslug.fandom.com/wiki/Slugs> | All vehicle types, bonus points, forced dismount |
| S13 | Metal Slug Wiki, *Metal Slug Attack (Move)* — <https://metalslug.fandom.com/wiki/Metal_Slug_Attack_(Move)> | Ram attack rules |
| S14 | Metal Slug Wiki, *Invulnerability* — <https://metalslug.fandom.com/wiki/Invulnerability> | When the player is invulnerable |
| S15 | Metal Slug Wiki, *POW* — <https://metalslug.fandom.com/wiki/POW> | Captive behaviour and types |
| S16 | Metal Slug Wiki, *Grenade* and the memory-read image *GrenadeStats.png* — <https://metalslug.fandom.com/wiki/Grenade>, <https://metalslug.fandom.com/wiki/File:GrenadeStats.png> | Grenade damage and collision boxes read from MS3 memory |
| S17 | Metal Slug Wiki, *Fire Bomb* and *FireBombStats.png* / *StoneStats.png* — <https://metalslug.fandom.com/wiki/Fire_Bomb>, <https://metalslug.fandom.com/wiki/File:FireBombStats.png>, <https://metalslug.fandom.com/wiki/File:StoneStats.png> | Fire-bomb and stone damage and boxes from MS3 memory |
| S18 | Metal Slug Wiki, *Knife* — <https://metalslug.fandom.com/wiki/Knife> | Melee rules, enemy knife wind-up |
| S19 | Metal Slug Wiki, *Metal Slug 3* — <https://metalslug.fandom.com/wiki/Metal_Slug_3> | Branch list and triggers, missions, bosses |
| S20 | Metal Slug Wiki mission pages — <https://metalslug.fandom.com/wiki/A_Couple%27s_Love_Land>, <https://metalslug.fandom.com/wiki/Wandering_at_Midnight>, <https://metalslug.fandom.com/wiki/Eyes_Over_the_Waves>, <https://metalslug.fandom.com/wiki/Tombstone_of_Sand>, <https://metalslug.fandom.com/wiki/All_About_Love> | Section lists, captive counts per route |
| S21 | Metal Slug Wiki, *Arcade Settings* — <https://metalslug.fandom.com/wiki/Arcade_Settings> | Operator settings (lives, difficulty 1–8, play time) |
| S22 | Metal Slug Wiki, *Rebel Infantry*, *Fanatics*, *Grenadier*, *Enemy Deaths* — <https://metalslug.fandom.com/wiki/Rebel_Infantry>, <https://metalslug.fandom.com/wiki/Fanatics>, <https://metalslug.fandom.com/wiki/Grenadier>, <https://metalslug.fandom.com/wiki/Enemy_Deaths> | Infantry types and behaviour |
| S23 | Metal Slug Wiki vehicle pages — <https://metalslug.fandom.com/wiki/Slugnoid>, <https://metalslug.fandom.com/wiki/Drill_Slug>, <https://metalslug.fandom.com/wiki/Slug_Mariner>, <https://metalslug.fandom.com/wiki/Elephant_Slug>, <https://metalslug.fandom.com/wiki/Ostrich_Slug>, <https://metalslug.fandom.com/wiki/Slug_Copter>, <https://metalslug.fandom.com/wiki/Astro_Slug>, <https://metalslug.fandom.com/wiki/Rebel_Armor> | Vehicle HP and specials |
| S24 | Metal Slug Wiki, *Mobile Satellite* — <https://metalslug.fandom.com/wiki/Mobile_Satellite> | Helper-drone rules |
| S25 | GameFAQs, *Metal Slug 3 Guide and Walkthrough* by Gon Liu (2000) — <https://gamefaqs.gamespot.com/arcade/577440-metal-slug-3/faqs/9750> | Dismount invulnerability, enemy notes |
| S26 | GameFAQs, *Metal Slug 3 FAQ/Walkthrough* by Wasabi X (2004) — <https://gamefaqs.gamespot.com/arcade/577440-metal-slug-3/faqs/38376> | Controls, automatic melee, item points |
| S27 | speedrun.com, *Metal Slug 3* leaderboards — <https://www.speedrun.com/mslug3>; full-game record run — <https://www.speedrun.com/mslug3/runs/m38ell4y> | Mission and game durations |
| S28 | TrueAchievements guide note for *Metal Slug X* scoring — <https://www.trueachievements.com/a241843/score-1000000-points-achievement> | Melee kill 500 vs shot kill 100 (MSX) |
| S29 | Shmuplations, *Metal Slug 2 – 1998 Developer Interview* — <https://shmuplations.com/?p=19321> | Design intent |
| S30 | Time Extension, *The Making Of: Metal Slug* — <https://www.timeextension.com/features/the-making-of-metal-slug-i-never-thought-that-it-would-have-sequels> | Design intent |
| S31 | Sega Retro, *Metal Slug* (via search excerpt; the site blocked direct fetch) — <https://segaretro.org/Metal_Slug> | Down shots only while airborne, no diagonals |
| S32 | JumpLab (A. Fukuchi), *Vx adjustment at takeoff* — <https://fukuchi.org/en/works/jumplab/settings-jump-vxAdjustmentAtTakeoff.html> | Metal Slug *accelerates* the horizontal speed at jump take-off |

### 1.2 Videos used for measurements

| Id | Video | Format | Use |
|---|---|---|---|
| V1 | TAS encode of S1 (zk547) — <https://archive.org/download/metalslug3-tas-zk547/metalslug3-tas-zk547.mkv> (page: <https://tasvideos.org/3344M>). Its settings screen shows "DIFFICULTY LEVEL 4, PLAY TIME 60"; timer and movement do not depend on the level. | native 304×224, variable frame rate, duplicate frames removed, base step 33.8 ms | timer rate, camera speeds, pistol cadence |
| V2 | Fightcade replay *Metal Slug 3: (CH) GenevensiS vs (CA) VxY91* — <https://archive.org/details/1648691113828-7472> | 1920×1080, 60 fps (game area 1440×1080 = 304×224 scaled) | human height, walk, jump, grenade, bullet speed, How-to-Play demo |
| V3 | *Metal Slug 3 (2000) (Arcade Longplay)* — <https://archive.org/details/metal-slug-3-2000> | 854×480, 29.97 fps, 1 player, one continue | mission durations, respawn timer reset |

### 1.3 The most important measured fact: Metal Slug 3 updates at about 30 Hz

- In the 60 fps capture V2, the picture changes only on **every second frame**; the frames in
  between are near-identical (mean difference < 0.05 grey levels, i.e. only compression noise,
  versus ≥ 0.9 on update frames). MEASURED [V2 @ 120–140 s].
- The TAS encode V1 removes duplicate frames. All its frame steps are multiples of **33.8 ms**
  (2 vblanks at 59.185 Hz); the encode's nominal rate is 29.59 fps. MEASURED [V1].
- The TAS notes count every timing in steps of 2 frames ("8 per 2 frames", "landing adds a
  2-frame delay", "hold right for 2 frames"). SOURCED [S1, S2].
- Some background tiles (the sea) also change on odd frames about every 10 frames while no
  sprite moves; this is probably Neo Geo hardware tile auto-animation. Sprites and the camera
  only move on the 2-frame beat. MEASURED [V2 @ 63–77 s]; cause ESTIMATED.

**Consequence for us:** one MS tick ≈ two of our ticks. Speeds per MS tick are **halved** for our
engine; accelerations per MS tick² are **quartered**. Frame counts quoted by TAS notes in
vblanks can be used **1:1** as our ticks.

### 1.4 Size conversion

- MS3 renders 304×224 at about 59.185 Hz. MEASURED [V1: encode is 304×224, 29.59 fps].
- A standing soldier (the How-to-Play demo hero) is **36 px** from the top of the hair to the
  soles: head top y = 115/116, feet y = 151. MEASURED [V2 @ 10.0–15.8 s].
- Our humans are 34–38 px (ARCHITECTURE §6.1). So **1 MS px = 1 our px** for movement, jump
  height, ranges and hitboxes.
- Our view is **26 % wider** (384 vs 304 px) and 4 % shorter (216 vs 224). With equal px
  speeds, crossing our screen takes 26 % longer, and the player sees enemies earlier. Keep
  px speeds 1:1 (feel is relative to body size); place spawns with the wider view in mind.

---

## 2. Player movement

| Item | Metal Slug 3 | Tag |
|---|---|---|
| Walk speed | **3 px / MS tick** (≈ 89 px/s; crosses the 304 px screen in ≈ 3.4 s). The camera followed a walking, firing player at exactly 3.0 px per update for 2 s. | MEASURED [V2 @ 134.9–137.0 s]; also V1 frames 538–572 (mostly 3.0) |
| Walk start / stop | Near instant (no visible acceleration phase on the player sprite). | ESTIMATED (series feel; not measured frame by frame). The camera has its own start ramp, see sec. 16. |
| Firing while walking | Does not slow the walk (the player held the machine gun and walked at 3.0 px/update). | MEASURED [V2 @ 135.1–136.7 s] |
| Turning on the ground | Instant; pressing the opposite direction turns and walks that way. | ESTIMATED (series behaviour; no turn animation visible) |
| Crouch | Hold down on the ground. Crouching dodges many shots: piranhas "can't get you" while you crouch; some boss shot patterns are dodged by "crouch and crawl". | SOURCED [S4] |
| Crouch-walk ("crawl") | Possible; clearly slower than walking. | SOURCED [S4] ("crouch and crawl to the other side of the screen"); speed ESTIMATED at ½ of the walk (no measurement) |
| Jump height control | **None**: every jump has the same height (no variable jump on button release). | SOURCED [S3, S4] |
| Jump air time | **27 MS ticks** (0.91 s) on flat ground, standing or moving. | MEASURED [V2 @ 15.83→16.70 s and 16.87→17.73 s (land), 63.95→64.82 s and 66.88→67.75 s (water)]; "both types land on the same frame" SOURCED [S2] |
| Jump apex | Head top rises **≈ 52 px**; ≈ 5–7 px of that is the change from the standing pose to the jump pose, so the body rises **≈ 46 px**. Feet rise ≈ 54 px because the legs tuck. | MEASURED [V2 @ 63.9–75 s] |
| Take-off speed | ≈ 7 px / MS tick upward. | MEASURED [V2]: first rising steps 7, 7, 5–8 px |
| Gravity (effective) | ≈ 0.55 px / MS tick² (moving jump is close to a parabola). | MEASURED [V2]: rise 7→0 in 12–13 updates |
| Two jump shapes | **Standing jump**: rises faster (7–8 px/update for 4 updates), then hangs ≈ 8 updates within 7 px of the apex, then falls faster. **Moving jump**: smoother parabola, gains horizontal speed faster. Both land on the same update. | SOURCED [S2] ("Standing jumps gain height faster, linger longer at the peak, and descend faster. Moving jumps gain horizontal speed faster."); MEASURED shapes [V2 @ 66.9–67.8 s vs 63.9–64.8 s] |
| Fall speed at landing | ≈ 7 px / MS tick (symmetric arc). No terminal speed seen within a single jump. | MEASURED [V2] |
| Horizontal speed in the air | Rises to **≈ 4 px / MS tick** (≈ 1.33 × walk). From a standstill it takes ≈ 3 updates to reach 3 px and ≈ 10 updates to reach 4 px. "Jumping has a higher max speed than walking." "In most cases jumping is faster than walking." | MEASURED [V2 @ 66.9–67.8 s; V1 camera 4.0 px/update while hopping, frames 331–436]; SOURCED [S2, S3, S4] |
| Take-off boost | The game multiplies horizontal speed at take-off (acceleration, not deceleration). Holding a direction for 2 frames before the jump gives more distance. | SOURCED [S32, S2] |
| Air control | "Some horizontal air control allowing the player to change direction." In the air the gun (and grenade) fires toward the **currently pressed** left/right; with no direction pressed it fires toward the facing. You can drift one way and shoot the other way. | SOURCED [S3, S4] |
| Landing | 2-vblank delay before the next shot after landing. No movement lag observed. | SOURCED [S2] ("Landing adds a 2-frame delay") |
| Slopes | Jumping off a slope can give a speed boost (MS4 TAS note); slopes are walkable. Walking up a dune looked slower on screen (≈ 2 px/update camera), maybe because of vertical camera motion. | SOURCED (MS4 TAS notes, <https://tasvideos.org/9399S>, via search excerpt); MEASURED [V1 frames 440–473], cause ESTIMATED |
| Water (shallow, mission 1 start) | Wading; jumps and moves look normal. | MEASURED [V2 @ 63–96 s] |
| Water (deep, swimming) | Speed builds up for **½ s** before max; moving diagonally is slower than straight; the hurtbox gets shorter and wider at full speed. | SOURCED [S4] |

---

## 3. Aiming rules

| Rule | Metal Slug 3 | Tag |
|---|---|---|
| Directions | Forward, **up** (standing, walking or in the air), **down only while airborne**. No diagonals for any foot weapon. | SOURCED [S31] (down only airborne, no diagonals), [S6] ("The HMG is the only weapon that can fire diagonally prior to Metal Slug 6"), [S26] ("There is no diagonal aiming") |
| Up while walking | The legs keep walking while the upper body aims up (split upper/lower body). | ESTIMATED from series sprites; matches ARCHITECTURE §6 contract |
| Crouching | Shots go forward at crouch height. Pressing up stands you up. | ESTIMATED (series behaviour) |
| In the air | Facing (and shot direction) follows the pressed left/right at once, even against the drift. | SOURCED [S3, S4] |
| Machine-gun sweep | When the aim changes while the machine gun fires, the rounds fan through the in-between angles (e.g. forward → up passes the diagonals). This is the only way to get diagonal shots on foot. | SOURCED [S6]; step size and speed ESTIMATED in section 22 |
| Design intent | "Restricting it to horizontal makes it easier for newcomers to understand, and easier to pick up and play." / "I like the fact that the central characters, the soldiers, can only shoot directly upward and not diagonally." | SOURCED [S29] (Meeher), [S30] (Kazuma Kujo) |

---

## 4. Pistol (default weapon)

| Item | Metal Slug 3 | Tag |
|---|---|---|
| Damage | **10 ru** per bullet (1 pu). | SOURCED [S1], [S16] (grenade = "10 pistol shots") |
| Ammo | Unlimited. | SOURCED [S6] |
| Bullet speed | **16 px / MS tick** (= 8 px/vblank ≈ 474 px/s). | MEASURED [V2 @ 11.95–12.25 s: x 131→147→163→179→…→275] |
| Fire rate, standing, mashed | ≈ **1 shot per 4 MS ticks** (8 vblanks, ≈ 7.4 shots/s). Muzzle flashes of one player at TAS frames 331, 335, 339. | MEASURED [V1]; ESTIMATED as the cap (a TAS fires as fast as allowed) |
| Fire-rate cap | "There is a cap limiting how fast you can fire. Crouching bypasses this cap." In MS3 the crouch trick works for the pistol too (it fails only in MS1 and for pistols in MS2/X). Crouch-cancel rate: **once every 4 vblanks**. | SOURCED [S5], [S2] |
| Bullets on screen | **No limit** for the pistol ("Max On Screen: ∞"). | SOURCED [S3, S4] |
| Reload animation | After about twelve shots the hero "reloads" if idle; purely cosmetic and cancelled by any action. | SOURCED [S6, S3] |
| Draw after a weapon runs dry | ≈ 1 s draw animation, no firing; cancelled by turning, crouching or throwing a grenade on the ground. | SOURCED [S5, S3, S4] |
| Input storage | A fire or grenade press during another attack is **stored** and released when the attack ends (intended). Bug: if you crouch or stand up at that moment, the input stays stored. | SOURCED [S4] |

---

## 5. Weapons

### 5.1 Weapon table (Metal Slug 3 values)

Damage in ru (pistol = 10). "Again" = ammo added by picking up the **same** weapon again.
"Crate" = ammo added by an ammo crate. "Max" = projectiles of this weapon allowed on screen.

| MS name (do not reuse) → our generic type | First pickup | Again | Crate | Damage (ru) | Max | Fire mode | Tag |
|---|---|---|---|---|---|---|---|
| Handgun → pistol | ∞ | — | — | 10 | ∞ | Fast | SOURCED [S1, S4] |
| Knife → knife | — | — | — | 30 | 1 | Fast (≈ 3/s) | SOURCED [S1, S3, S4] |
| Grenade → grenade | 10 per life | — | +10 (bomb crate) | 100 direct (+ 2 × 1 splash) | 2 | Fast | SOURCED [S4, S16] |
| Heavy Machine Gun → machine gun | 200 | +150 | +100 | 10 per round; one press = 4 rounds | ∞ | Fast | SOURCED [S4], [S2] (4 rounds/press, 1 round per 4 vblanks) |
| Laser Gun → laser | 200 | +150 | +100 | 8 per 2 vblanks while the beam touches; 1 ammo per 4 vblanks; beam lingers 6 vblanks after release (+24) | ∞ (beam) | Fast | SOURCED [S4], [S2] |
| Flame Shot → flamethrower | 30 | +15 | +10 | main flame 20 per 2 vblanks, max 13 hits (260); side flame 0–5 per 2 vblanks; max total 314 | 1 | Slow | SOURCED [S1, S4] |
| Shotgun → shotgun | 30 (Big: 15) | +10 | +10 | 200 per blast, pierces | 1 | Slow | SOURCED [S1, S4, S6] |
| Super Grenade → heavy grenade launcher | 20 | +5 | +10 | 100 + 50 splash | 2 | Slow | SOURCED [S1, S4] |
| Enemy Chaser → homing missiles | 40 | +20 | +10 | 30 + 10 splash | 3 | Medium | SOURCED [S1, S4] |
| Rocket Launcher → rocket launcher | 30 | +20 | +10 | 30 + 50 splash (3 frames) | 2 | Medium | SOURCED [S1, S4] |
| Iron Lizard → ground-runner rocket | 30 | +10 | +10 | 30 + 30 splash | 2 | Medium | SOURCED [S1, S4] |
| Drop Shot → bouncing mine | 30 | +10 | +10 | 30 + 1 splash | 3 | Medium | SOURCED [S1, S4] |

Notes on the table:

- **Fire modes.** "Three types of weapon firing rate: Slow, Medium and Fast. Crouching turns Medium
  firing weapons into Fast firing weapons." Being right next to the target bypasses the
  "max on screen" limit because the projectiles die at once. SOURCED [S3, S4].
- **Repeat pickups.** The MS3 guide numbers above add 25–75 % of the first amount. The series wiki
  says "67–75 %". We trust the MS3-specific guide. SOURCED [S4] vs [S6].
- **Caps.** Weapon ammo max **999**; grenades max **99**. SOURCED [S7]. (The guide farms the
  machine gun "until you have 999". SOURCED [S4].)
- **Different weapon = replace.** A new weapon type replaces the current one and its ammo. SOURCED
  [S6, S4] (weapon drops "could overwrite the Shotgun").
- **Weapon loss.** "All special weapons are lost upon death." SOURCED [S6].
- **Ammo crate with no special weapon:** 1,000 points instead. SOURCED [S10].
- **"Big" variants** (pulsing letter on the crate): same damage, bigger hitboxes; some fly slower
  (rocket). Big shotgun has double range and half ammo. SOURCED [S3, S4, S6].
- **Series ranking (strong → weak):** flamethrower > shotgun > heavy grenade launcher > laser >
  homing / rocket / ground-runner / mine > machine gun > pistol. SOURCED [S5].

### 5.2 Weapon behaviour (qualitative, all SOURCED [S6] unless noted)

- **Machine gun:** very fast; "the same firepower as a regular handgun, but its high fire ratio
  compensates". The weapon most often found; also dropped on every continue (sec. 10).
  A human mashing used ≈ 20 rounds in 1.6 s (≈ 12.5 rounds/s). MEASURED [V2 @ 135.1–136.7 s].
- **Rocket launcher:** "small, slow moving rockets"; "can adjust their trajectory somewhat to hit
  targets on different platform levels, but they cannot turn around completely". Clears
  infantry groups.
- **Shotgun:** "short range, but incredibly powerful blast"; hits groups; pellets "lose their
  velocity after traveling a short distance".
- **Flamethrower:** large flame wave with "limited range and a slow fire rate"; travels "in a
  shallow parabolic trajectory upward when fired horizontally", longer range when fired up,
  shorter when fired down; fired **down from the air near the ground** it runs far along the floor.
  Strong at point blank. SOURCED [S6, S3, S4].
- **Laser:** thin beam that cuts through rows; full-screen range.
- **Homing missiles:** "immediately go into homing mode once launched, randomly targeting
  enemies"; good against air targets; useful to find hidden captives and items.
- **Ground-runner rocket:** runs along the floor until contact, then a blue blast; useless against
  air targets or targets on other platforms.
- **Bouncing mine:** drops and bounces along the ground until it hits or stops; slow; good
  against infantry behind cover.
- **Heavy grenade launcher:** fast rocket-propelled grenade; on impact a fire plume shoots
  straight up (hits flyers above).

### 5.3 Other pickups and helpers (MS3)

| Item | Rule | Tag |
|---|---|---|
| Bomb crate | +10 grenades; when riding a vehicle +10 shells instead; crouching in the vehicle gives grenades instead. | SOURCED [S10] |
| Fire-bomb grenades | Replace grenade type, keep the count; reverts on death, new mission, or a normal grenade pickup. Damage 0 on contact; flame blast 80 ru (80×128 box, only on "mechanical" targets); ground flames 15 ru (32×32). | SOURCED [S17] |
| Stone grenades | Damage 100 ru, 16×16 box, longer range, no explosion. | SOURCED [S17] |
| Helper drone (MS3 "Mobile Satellite") | Hovers, auto-tracks the nearest target, fires 200 bolts (10 ru each), then falls and explodes. Destroyed when you pick up a weapon crate. | SOURCED [S24, S1, S4] |
| Helper cloud (MS3 "Thunder Cloud") | Hovers over the nearest target and zaps it (30 ru). Destroyed by a weapon crate pickup. | SOURCED [S6, S4] |
| Gas can | Restores 1 vehicle hit; 1,000 points on foot or with full armour. | SOURCED [S10, S11] |
| Medicine | Cures a transformation, else 1,000 points. (Transformations are banned for us, see sec. 23.) | SOURCED [S10] |

---

## 6. Grenades

| Item | Metal Slug 3 | Tag |
|---|---|---|
| Count | **10** at the start of each life and each mission; bomb crate +10; max **99**. | SOURCED [S6, S7] |
| In the air at once | **2**. | SOURCED [S3, S4] |
| Damage | Direct hit **100 ru** (= 10 pistol shots); projectile box **12×12**. | SOURCED [S16] |
| Explosion | Blast 1: **80×32** box at the ground, 1 ru; blast 2: **48×112** vertical column, 1 ru. Splash hits only "knifeable" (soft) targets: 2 frames × 1 ru. The 1 ru splash still kills basic soldiers (they have 1 ru HP). | SOURCED [S16, S4] |
| Throw arc | Overhand release ≈ 43 px above the feet (hand above the head); first steps up ≈ 3 px / MS tick; apex only ≈ 7 px above the release point; horizontal ≈ **4.2 px / MS tick**; gravity ≈ **0.8 px / MS tick²**. | MEASURED [V2 @ 18.73–19.72 s] |
| Bounce | First ground contact after **16 MS ticks**, ≈ 64 px ahead; **one bounce** (vertical restitution ≈ 0.65–0.7, rises ≈ 20 px); explodes on the **second ground contact** after **29 MS ticks** total, ≈ **124 px** from the release point. It also explodes on contact with an enemy. | MEASURED [V2 @ 18.73–19.72 s]; "explodes upon contact with an enemy or when its momentum ends" SOURCED [S6] |
| Throw while moving | Walking adds the player's horizontal speed to the grenade. | SOURCED [S3] |
| Throw while airborne | Thrown toward the pressed direction (like shots). | SOURCED [S3, S4] |
| Vehicles | The grenade button fires the vehicle's own secondary weapon instead (cannon, torpedo, bomb). | SOURCED [S6] |
| Special zones | Under water a sinking mine; in the air a big homing missile; in space a capsule that flies straight. | SOURCED [S6] |
| Enemy grenades | Rebel grenades "travel slowly and flash red and blue to help the player spot and dodge them". | SOURCED [S22] |

---

## 7. Knife (automatic melee)

| Item | Metal Slug 3 | Tag |
|---|---|---|
| Trigger | Pressing fire **near** an enemy does a melee attack instead of a shot, with any weapon. "Same goes for slow moving projectiles." | SOURCED [S6, S26] |
| Damage | **30 ru** (3 pistol shots); usually kills any human without a shield in one hit; zombies, aliens and bosses take several. Can hit several targets at once; useless against armoured vehicles. | SOURCED [S1, S18] |
| Rate | "About **three times per second**"; knife-cancel (crouch + alternate left/right) is faster. | SOURCED [S3, S4] |
| Range | Short box in front of the body (visible with debug DIP 1-6). Not documented in numbers. | SOURCED [S4] (box exists); size ESTIMATED in sec. 22 |
| Score | Melee kills are worth more: **500** vs **100** for a shot kill (stated for Metal Slug X; the 100 for a shot kill is confirmed in MS3, the 500 for MS3 is not verified). | SOURCED [S28], [S18] ("close-range attacks score more points per enemy"); MEASURED [V1 frames 341–347] for the 100 |
| Enemy knives | Most human enemies knife at close range, but "they take nearly a full second to attack", so an alert player can kill them or jump away. | SOURCED [S18] |

---

## 8. Damage model details

- **Multi-hit in one frame.** A projectile damages every enemy it touches in the same frame,
  "even the Handgun". SOURCED [S4].
- **Splash only on soft targets.** Extra splash boxes hurt only enemies that can be knifed.
  SOURCED [S4].
- **Basic soldiers have 1 ru (0.1 pu).** Any hit kills them, even 1 ru splash. SOURCED [S4].
- **Big enemies may share one HP pool between several hitboxes** (e.g. the first boss: body and
  shell). Some bosses take double damage when two parts are hit at once (MSX). SOURCED [S3, S2].
- **Spawn invulnerability.** Some threats are invulnerable until the camera stops scrolling (the
  crab-spawning missile) or for 4–5 s after appearing (a truck). SOURCED [S4].
- **Vehicle-aware stats.** Some enemies spawn with more HP and drop shells/fuel if the player is
  in a vehicle when they spawn (e.g. 40 vs 80 pu, "shoot three times" vs "only once"). SOURCED
  [S3, S4].
- **Crush.** Enemy vehicles can crush a player vehicle against the left screen edge: instant
  vehicle loss and death. SOURCED [S4].

---

## 9. Death, respawn, invulnerability and weapon loss

| Item | Metal Slug 3 | Tag |
|---|---|---|
| One hit kills | On foot, any enemy hit kills (no health bar). | SOURCED [S14] ("Getting hit: Only in games where the player has a health bar") |
| Knock-down hits | Some big enemies knock you down instead: you do not die, you **lose your weapon**, and your i-frames end very fast after you stand up. | SOURCED [S4] |
| What you lose | Special weapon → pistol; grenades → 10; captive count → 0; support captives leave. | SOURCED [S6, S7, S8, S15] |
| Respawn | **On the spot**: the new life drops in from the top of the screen at the death position in ≈ 5 updates; enemies stay. | MEASURED [V3 @ 172.3–172.5 s] |
| Timer on respawn | Resets to **60**. | MEASURED [V3 @ 172.0→172.5 s: 57 → 60]; SOURCED [S7] |
| Respawn invulnerability | The player blinks and is invulnerable "a few seconds". Exact length **not measured** (heavy sprite flicker in our sample hid the blink). | SOURCED [S14] (exists); duration ESTIMATED 2 s from series feel |
| Other i-frame sources | Mission start, entering a new room, being knocked over, entering a vehicle, leaving a vehicle ("invulnerable when flipping and a bit after landing"), a vehicle being hit, transforming. | SOURCED [S14] |
| Dismount i-frames | Long enough to absorb a volley, but "if you dismount … and jump immediately, you will die at the peak of your jump because the invincibility wears off" → ≈ ½ s after landing. MS3 window is shorter than MS2. | SOURCED [S25]; length ESTIMATED from "peak of jump" ≈ 13 MS ticks |
| Pit / crush | Falling into a pit or being crushed kills even with i-frames (debug invincibility excludes them). | SOURCED [S14] |
| Exiting a room | Enemies still on screen usually die when the player triggers the exit; survivors cannot kill. | SOURCED [S14] |
| Death presentation | Many death animations by cause (knock-back, cut, burn, electrocution, drown, acid, eaten …). | SOURCED (Metal Slug Wiki, *Deaths*, <https://metalslug.fandom.com/wiki/Deaths>) |
| Enemy reaction | Fanatics stop to point and laugh or shrug when the player dies, then scream in terror and get back to work when the player respawns. **(Signature gag: do not copy; see sec. 23.)** | SOURCED [S22] |

---

## 10. Lives, continues and credits

| Item | Metal Slug 3 | Tag |
|---|---|---|
| Lives | **3 per credit** by default ("Hero" operator setting); **no extra lives** can be earned. HUD shows remaining lives ("1UP=2" at start). | SOURCED [S7, S21]; MEASURED [V2, V3 HUD] |
| Continue screen | **Nine counts**; pressing a button speeds the count up. | SOURCED [S9] |
| Continue gift | A **machine-gun crate** drops on the continuing player; a living partner may grab it. (Once in the series a rocket launcher instead.) | SOURCED [S9] |
| Continue marker | Each continue adds **1 point** to the score (up to 9), so the last digit counts continues. | SOURCED [S7]; MEASURED [V3: score ends in 1 after the continue] |
| Character select | After a continue you may pick a character again within a time limit. | SOURCED [S9] |
| Credits | Credits can be inserted any time; operators can disable continues. Some home ports limit continues; the western Xbox port restarts the mission on continue (1P). | SOURCED [S9, S19] |
| 2 players | A player who does not continue leaves; the game goes on while the partner lives. | SOURCED [S9, S21] |

---

## 11. Time-limit counter

| Item | Metal Slug 3 | Tag |
|---|---|---|
| Start value | **60** (operator setting "Play Time"). | SOURCED [S7, S21]; MEASURED [V1 settings screen "PLAY TIME 60"] |
| Rate | **1 count per 128 MS ticks = 256 vblanks = 4.33 s** (five clean intervals of exactly 128 updates / 4.326 s). The wiki rounds this to "every four real-time seconds". | MEASURED [V1, frames 2101→2229, 3508→3636, 4435→4563, 6265→6393, 7593→7720]; SOURCED [S7] |
| Full length | 60 counts ≈ **4 min 20 s** of play per checkpoint (longer with slowdown, because the count is tied to game updates). | MEASURED (derived from the two rows above) |
| Alarm | An alarm plays at **10**. | SOURCED [S7] |
| Time out | **All players die** when it reaches 0. | SOURCED [S7] |
| Reset | At each **checkpoint** and on **death**. | SOURCED [S7]; MEASURED [V3 @ 172.5 s] |
| Typical use | In a skilled 1-player run, sections used up to ≈ 40 counts (≈ 3 min) before a reset; the timer is rarely a threat. | MEASURED [V3 HUD samples, timer values 60…19] |

> **Contract note for mission builders.** `SectionDef.timeLimit` in ARCHITECTURE §6.2 says
> "seconds, default 60". A 60-**second** limit would be four times harsher than the reference.
> Recommendation: treat `timeLimit` as **counts** shown on the HUD, with **256 ticks per count**
> (≈ 4.3 s), or keep seconds and use a default of ≈ 250 s. See section 22.

---

## 12. Scoring

### 12.1 Enemies and items

| Source of points | Value | Tag |
|---|---|---|
| Small enemy killed by a shot | **100** (TAS score rose 100 → 200 → 300 → 400 as small crabs died to pistol fire) | MEASURED [V1 frames 341–347]; SOURCED [S28] for MSX |
| Enemy killed by the knife | **500** | SOURCED [S28] (MSX), [S18] |
| Food items | 10–1,000 (e.g. apple 100, fish 500, turkey 1,000, rotten food 10) | SOURCED [S10] |
| Animals as items | 100–2,000; a rare golden bat 30,000 | SOURCED [S10] |
| Medals | small 10, larger 500 | SOURCED [S10] |
| Jewels | 100 / 10,000 / 30,000 / 50,000 depending on how bright they glint when collected | SOURCED [S10] |
| Treasure, dolls, golf bag … | 1,000–5,000 | SOURCED [S10] |
| Unusable pickups (gas can on foot, medicine when healthy, ammo crate with no special weapon) | 1,000 | SOURCED [S10, S11] |
| Continue | +1 (marker digit, see sec. 10) | SOURCED [S7] |

### 12.2 End-of-mission bonus (result screen after the boss)

| Bonus | Value | Tag |
|---|---|---|
| Each captive tagged **in the current life** | **10,000** (first game: 1,000) | SOURCED [S8] |
| Special captives (supply girl, disguised officer, monkey) | 30,000 | SOURCED [S8] |
| VIP captive (the "president") | 50,000 | SOURCED [S8] |
| "Great!" bonus | **100,000** if 1 player tagged ≥ **10** captives; in 2P the player with the most captives gets it (tie: "Draw!", no points) | SOURCED [S8] |
| Riding a vehicle when the boss dies | Tank 300,000; light mech 200,000; camel 400,000; flyer 100,000 (MS X onward) | SOURCED [S8, S12] |
| Captive names | The result screen lists each tagged captive by name (randomised from a long list in MS3). | SOURCED [S8] |

A skilled run with one continue ends near 3.4 million points. MEASURED [V3 @ 3020 s HUD:
3,400,361]. The theoretical maximum is **10,122,000** points (best route mix, all captives,
vehicle bonuses), of which ≈ 5.9 million come from the final mission. SOURCED (GameFAQs POW FAQ by
CODY_2, <https://gamefaqs.gamespot.com/arcade/577440-metal-slug-3/faqs/17759>).

---

## 13. Captives (hostages)

| Item | Metal Slug 3 | Tag |
|---|---|---|
| States | Tied up → freed by an attack → walks around → **tagged** when the player touches him → hands over an item → salutes and runs off. | SOURCED [S15, S8] |
| Counting | A captive counts only when **tagged**, not when merely freed. | SOURCED [S8] |
| Items | Usually **fixed** per captive (weapon, grenades, food, points); a few pick at random from a small list. | SOURCED [S3, S4] |
| Placement | Anywhere, some hidden (inside crates, in walls, off-path, revealed by shooting up). | SOURCED [S15, S20, S26] |
| Invulnerable | Captives cannot be hurt by enemies or hazards. | SOURCED [S15] |
| On death | The tagged count for the bonus resets to 0; support captives run away. Items already given are kept. | SOURCED [S8, S15] |
| Wandering captive | A supply carrier walks across the level; tag her before she leaves or she does not count; shooting her backpack drops food and makes her faster. | SOURCED [S15] |
| Support captives | Some fight beside the player until the next area or the player's death (energy-ball officer; monkey with a submachine gun). **(Specific characters banned, sec. 23.)** | SOURCED [S15] |
| "Freeing too early" | Shooting near captives can free them early so they wander off before you reach them. | SOURCED [S4] |
| Counts per route | Routes differ: e.g. mission 2 main route 9 (+3 at the boss) vs ice-cave detour 11; mission 4 inner pyramid 9, mutated underground 11. | SOURCED [S20] |
| Maximum | **98** captives in one MS3 run with the best routes. Per mission and route (in stage + at the boss): M1 16 / 22 / 18; M2 23 (9 main + 11 in the cave detour + 3 at the boss); M3 13 / 13 / 11; M4 18 / 24 / 21 / 18 / 22; M5 16. Boss arenas hold extra captives (M1 +10 on every route, M2 +3, M4 +5). | SOURCED (GameFAQs POW FAQ by CODY_2, <https://gamefaqs.gamespot.com/arcade/577440-metal-slug-3/faqs/17759>) |

---

## 14. Vehicles

### 14.1 General rules

| Rule | Metal Slug 3 | Tag |
|---|---|---|
| Entering | Jump onto it (the HUD tutorial: "Jump to board …"); an "IN" arrow marks free vehicles. Entering grants i-frames. | SOURCED [S14]; MEASURED [V2 How-to-Play @ 21.7–28.7 s] |
| Exiting | **Down + jump**: somersault out with i-frames (sec. 9). Some vehicles need down held a moment first. | SOURCED [S4, S14], StrategyWiki controls (<https://strategywiki.org/wiki/Metal_Slug/Controls>) |
| Armour | Most vehicles take **3 hits** (the "slug gauge"); the gauge flashes on the last point. A hit grants vehicle i-frames. | SOURCED [S7, S11, S23] |
| Destroyed | At 0 the vehicle breaks down and flashes; the pilot must get out before it explodes or dies with it. | MEASURED [V2 How-to-Play tutorial text @ 29–31 s]; SOURCED TAS MS1 page <https://tasvideos.org/3040S> |
| Repair | Gas can = +1 hit. | SOURCED [S10, S11] |
| Ammo | Vulcan unlimited; cannon **10 shells** to start, bomb crate +10 while riding. | SOURCED [S11, S10] |
| Ram attack | **Fire + jump** (A+B): the pilot jumps clear with i-frames; the empty vehicle charges forward, tramples infantry and explodes on vehicles, bosses or walls (**400 ru**; 40 pu in MS3). Animal mounts run off instead of exploding. | SOURCED [S13, S2, S4] |
| Crushing | Ground vehicles crush infantry by driving over them. | SOURCED [S11, S22] |
| Bonus | Riding a vehicle at the boss kill pays a bonus (sec. 12). | SOURCED [S8] |
| Forced exit | Some levels force the player out at a set point. | SOURCED [S12] |
| Two players | In 2P a second vehicle often appears. | SOURCED [S6] ("two Slugs can be found in a single mission"), [S23] |
| Enemy grab | (MS1 only) soldiers jump onto the tank to block the cannon or plant grenades; moving shakes them off. | SOURCED [S12] |

### 14.2 Vehicle catalogue (MS3) — mechanics only

| Type (MS name, do not reuse) | Armour | Weapons and specials | Tag |
|---|---|---|---|
| Light tank (SV-001 / Type-R) | 3 hits | Vulcan turret that aims with the stick and turns smoothly; cannon shells (200 ru, lob arc); **crouch opens the hatch to throw the pilot's grenades**; jumps; Type-R is faster, jumps higher, no heavy recoil when hit | SOURCED [S11, S12, S2] |
| Tank vulcan | — | One press fires **5 rounds**, 10 ru each, 1 round per 4 vblanks; home ports add a "lock aim + autofire" option | SOURCED [S2], <https://metalslug.fandom.com/wiki/Vulcan_Fix> |
| Light mech (Slugnoid) | 3 hits | Two vulcans that rotate 360°; downward cannon; rocket-boosted high jump; loses a vulcan per hit | SOURCED [S23] |
| Enemy-built mech (Rebel Armor) | 3 hits | Uses **picked-up weapons** (limited ammo); grenade launcher (100 ru cannon); slow claw punch (30 ru, ≈ 1 s lock); **double jump**; cannot turn around; partner can stand on it for a boost | SOURCED [S23, S4] |
| Mini-sub (Slug Mariner) | 3 hits | Sinking vulcan rounds; torpedoes; can be left and re-entered under water | SOURCED [S23] |
| Drill tank | 3 hits | Vulcan; cannot jump but **jacks the cockpit up**; contact drill damages; extending drill = big damage that "sticks" in enemies | SOURCED [S23, S4] |
| Elephant mount | rider exposed | Very slow, tiny jump; vulcans; trunk weapon after eating a chili (fire) or a battery (lightning) | SOURCED [S23] |
| Camel mount | rider exposed (narrow hurtbox) | Fast; vulcan; jump off for i-frames; cannot be killed | SOURCED [S12, S4] |
| Ostrich mount | rider exposed | Fastest, huge jumps; vulcan in a 180° arc; slow turn that leaves the rider vulnerable | SOURCED [S23] |
| Helicopter (Slug Copter) | 3 hits | 360° vulcan; drops bombs straight down | SOURCED [S23] |
| VTOL jet (Slug Flyer) | 3 hits | Limited vulcan arc; missiles; adds its speed to thrown grenades | SOURCED [S12, S2] |
| Space pod (Astro Slug) | 3 hits | Nose cannon; side pods take picked-up weapons (lost one per hit, regained by pickups); twin rockets per bomb (100 ru each) | SOURCED [S23, S4] |
| Jet-pack fallback | — | If the air vehicle is lost the player flies a jet pack with homing missiles | SOURCED [S19] |

Design note from the developers: once the tank could "jump, crouch, and move around, they seemed
like living creatures", and a hover move was cut because "it would ruin the jump-jump-jump tempo".
SOURCED [S29].

---

## 15. Enemy behaviour

### 15.1 Infantry

| Type | Behaviour | Tag |
|---|---|---|
| Common soldier ("fanatic") | Knife slash; leaping knife slash; throws slow firework rockets; rolls ball bombs; lays mines that may blow up their own side. Dies to any hit (1 ru). | SOURCED [S22, S4] |
| Grenadier | Lobs grenades continuously, always in groups; knife when close. | SOURCED [S22] |
| Bazooka soldier | Fires from high points or cover; paratroopers. | SOURCED [S22] |
| Shield soldier | Advances behind a riot shield, slashes at close range, uses a pistol when above/below/out of range; **flees after losing the shield**. | SOURCED [S22] |
| Rifleman | Slow, unreliable fire; "often seen jamming after every shot". | SOURCED [S22] |
| Mortar soldier | Lobs shells from cover; can hit his own side. | SOURCED [S22] |
| Gatling soldier | Short bursts with long pauses (overheating); ammo pack on the back absorbs shots. | SOURCED [S22] |
| Biker | Fast pass; sidecar bazooka or kamikaze crash. | SOURCED [S22] |
| Divers | Pop out of water to fire a rocket, then dive; bomb-carrying divers explode on contact or when shot. | SOURCED [S22] |

**AI states seen across the series** (SOURCED [S22] gallery names and death list; details
ESTIMATED): *idle* with a comedy activity → *alert* (startled jump/shout) → *attack* (shoot, throw,
knife if close) → *panic/flee* (screaming run, e.g. after losing a shield or seeing a tank) →
*death* with an animation chosen by damage type (burn, blast, knife cut, crushed). Enemy taunt on
player death, scream on respawn (sec. 9). **The specific gags are protected; invent our own
(sec. 23).**

**Timing that matters** (all ESTIMATED unless tagged):

- Enemy knife wind-up ≈ **1 s** before the stab. SOURCED [S18].
- Enemy grenades are slow and flash. SOURCED [S22].
- Enemy shots must be readable: we estimate enemy bullets at ⅓–½ of the player bullet speed
  (series feel), fired every 1–2 s per soldier, with a visible aim or muzzle cue.
- Many shots can be **ducked**: "Laser can be ducked", "You can duck under their shots".
  SOURCED [S25, S4]. Rule of thumb: standard enemy rifle shots fly at chest height so that a
  crouch dodges them.

**Spawning rules** (SOURCED [S3, S4]):

- Waves hold the camera: "The screen won't scroll further if one of these Crabs is alive."
- Some spawn sides depend on the player's screen half: on the **opposite** side or the **same**
  side of the player (the screen centre is marked by the timer).
- Some enemies spawn seconds before they are visible; scrolling quickly can de-spawn them.
- Off-screen projectiles and enemies cease to exist (homing missiles that overshoot off-screen
  are removed).

### 15.2 Enemy HP reference (MS3, pistol units at LEVEL-4 / LEVEL-8; × 10 for ru)

| Enemy | HP (pu) | Tag |
|---|---|---|
| Basic soldier | 0.1 | SOURCED [S4] |
| Security camera / drone | 5 / 8, 2 / 4 | SOURCED [S4] |
| Swarm alien (three colours) | 3/5, 5/7, 10/14 | SOURCED [S4] |
| Kamikaze spider | 5 / 7 | SOURCED [S4] |
| Enemy mech | 15 / 25 | SOURCED [S4] |
| Crab-spawning missile | 20 / 20 (invulnerable until the camera stops) | SOURCED [S4] |
| Big crab | 30 / 40 | SOURCED [S4] |
| Helicopter | 28 / 36 (small one 24 / 32) | SOURCED [S4] |
| Truck | 50 / 70 (invulnerable 4–5 s after spawn) | SOURCED [S4] |
| Big brown submarine | 80 / 100 | SOURCED [S4] |
| Giant bug | 80 / 120, plus an 80 HP shield appendage | SOURCED [S4] |
| Big walker | 80 / 100 … 120 / 160 | SOURCED [S4] |

### 15.3 Bosses (MS3)

| Boss | HP (pu) L4 / L8 | Phase / rage rules | Tag |
|---|---|---|---|
| Mission 1 boss (giant hermit crab) | 500 / 600 | Phase 2 after 300 damage (a backwards jitter announces it); burning visuals at 50 % and 25 % | SOURCED [S4] |
| Mission 2 mid-boss (group of floating aliens) | 50 / 67 each | Rage after 150 / 200 collective damage; three opening patterns | SOURCED [S4] |
| Mission 2 boss (alien saucer) | 400 / 500 | Rage after 150 (falling slabs drop faster; colour change) | SOURCED [S4] |
| Mission 3 boss (giant robot) | 650 / 800 | Rage after 200 / 250; "the more damage dealt, the more missiles and the faster they launch" | SOURCED [S3, S4] |
| Mission 4 boss (flying guardian) | 500 / 600 | Rage after 200; four patterns | SOURCED [S4] |
| Mission 5 mid-bosses | 650/850, 500/900, 170/240, 250/350, 250/350 | Phases at 200 and 400 damage; rage after 150 / 300 | SOURCED [S4] |
| Final boss | 1,600 / 2,400 | Extra helper appears after 800 / 1,000 damage; hit-flash colour shifts white → dark red with damage | SOURCED [S4] |

General boss rules (SOURCED [S3, S4]): several hitboxes may share one HP pool; patterns are
chosen at random from a small set; rage after a damage threshold (≈ 30–40 % of HP) adds
projectiles and speed; damage states are shown at 50 % and 25 %; most fights have safe spots
that skilled players learn.

Rough fight length (ESTIMATED): 500 pu ÷ (machine gun ≈ 15 pu/s) ≈ 35 s of pure firing; with
dodging and the pistol, 60–120 s.

---

## 16. Camera

| Rule | Metal Slug 3 | Tag |
|---|---|---|
| Forward scrolling | Scrolls with the leading player; never back. While a player walks at the scroll line the camera moves exactly at the walk speed (3 px / MS tick); while hopping 4 px / MS tick. | MEASURED [V2 @ 134.9–137.0 s; V1 frames 331–436] |
| Scroll line | The player stays at ≈ 35–45 % of the screen width while the camera follows. | MEASURED (approx.) [V1, V2 frames]; value ESTIMATED |
| Arena locks | The camera stops for waves, set pieces and bosses; a flashing "GO!" sign with an arrow appears when the way is clear. | MEASURED [V2 @ 103–130 s]; SOURCED [S4] ("invulnerable until the screen stops moving") |
| Unlock catch-up | After a lock the camera catches up at **6 px / MS tick**, then eases 6 → 5 → 4 → 3 → 2 px over ≈ 0.6 s to the player's speed. Camera start from rest: 1 → 2 → 3 px over ≈ 1 s (cause unclear: camera easing, or the leader only reaching the scroll line). | MEASURED [V2 @ 147.2, 154.1, 158.3 s; 130.2–131.1 s]; [V1 frames 485–523, 834–869] |
| Vertical | The camera also follows climbs (ship hulls, towers, shafts). | MEASURED [V1 frames 440–473] |
| Player limits | Players cannot leave the screen. | ESTIMATED (series behaviour) |
| Average progress | ≈ **46 px/s** horizontal in normal 2P play; the camera moved in 57 % of updates. A TAS averages ≈ 72 px/s. | MEASURED [V2 @ 130–200 s; V1 frames 330–960] |
| Design intent | "There's a lot of stopping and shooting in Meeher's stages, but the levels that I designed just keep on scrolling … By alternating the levels we were able to give the game variety." | SOURCED [S30] (Kazuma Kujo) |

---

## 17. Difficulty levels

| Item | Metal Slug 3 | Tag |
|---|---|---|
| Levels | **8** operator levels (LEVEL-1 … LEVEL-8), default **LEVEL-4**; the level is shown on screen. | SOURCED [S4, S21, S7] |
| What changes | "The amount, and movement speed of projectiles"; "the likeliness to perform an attack, the reaction time, and movement speed of enemies"; "the HP of big enemies and bosses". | SOURCED [S4] |
| Size of the change | Boss HP +20 % (500 → 600) to +80 % (500 → 900) from L4 to L8; big-enemy HP +25–100 %. 2-player values differ. | SOURCED [S4] |
| Home-port names | Easy ≈ L1–L2, Normal ≈ L3–L4, Hard ≈ L6–L8 depending on the port. | SOURCED [S4] |
| Ammo by difficulty | MS3 gives the same ammo on all levels (later games halve ammo on Hard). | SOURCED [S6] (tables start at MS6) |
| Hardware | The game is tuned for a 12 MHz CPU; emulators running faster make the game faster and harder. Slowdown is part of the original feel. | SOURCED [S4], [S29] ("wondered if we'd gone too far" about slowdown) |

---

## 18. Co-op rules

| Rule | Metal Slug 3 | Tag |
|---|---|---|
| Mode | 2 players at the same time on one screen. | SOURCED [S19] |
| Lives / continues | Each player has own lives; continue pool shared or separate depending on the version. | SOURCED [S7, S9] |
| Friendly fire | None (players and partner vehicles are not hurt by partner shots). | ESTIMATED (series behaviour; matches ARCHITECTURE §8) |
| Respawn | On the spot, which "works well with simultaneous multiplayer games". | SOURCED [S30] (Meeher) |
| Captive bonus | Competitive: the player with the most captives gets the "Great!" bonus. | SOURCED [S8] |
| Vehicles | Often two vehicles in 2P; a partner can stand on the enemy-built mech for a jump boost. | SOURCED [S6, S23] |
| Continue crate | The partner can take the crate dropped for a continuing player. | SOURCED [S9] |
| Story twist | In the final mission only player 1's character is abducted. **(Story content, banned.)** | SOURCED [S19] |
| Design note | Vertical stages suit co-op less well ("stages that scroll vertically weren't very suited to co-op play"). | SOURCED [S29] |

---

## 19. Mission structure and branching in Metal Slug 3

MS3 has **5 missions**. Missions 1–4 each fork into 2–4 routes that differ in length,
difficulty, captives, weapons and vehicles, and **all rejoin before the boss**. Mission 5 is one
long linear chain of sections, vehicles and mid-bosses. SOURCED [S19, S20].

| Mission | Sections (generic) | Route triggers (how a branch is taken) | Boss, vehicle at boss | Tag |
|---|---|---|---|---|
| 1 | beach → river or ship or underwater trench → bridge | **Keep going and jump onto a boat** (river route, tank at the boss); **jump over a gap into a sunken ship** (or a "warp" entrance); **board a mini-sub in a pool** (underwater route); the latter two give a mech at the boss | giant crab | SOURCED [S19, S20] |
| 2 | crash site → highway **or** detour into an ice cave → research site | **Break a marked wall** to enter the cave detour (ride an elephant, then come back out) | floating-alien mid-boss, saucer boss | SOURCED [S19, S20] |
| 3 | sea (scuba) → factory **or** underwater tunnel **or** bridge → boiler room | **Below the first missile wall** (sub route); **a tunnel that lowers into view at the second wall** (ostrich route over a broken bridge); **keep going** (factory; steal an enemy mech) | giant robot | SOURCED [S19, S20] |
| 4 | desert (camel) → pyramid outside → inside pyramid **or** quick boss route **or** underground (drill tank) **or** a hidden army hideout → tower | **Climb to the top and pull a crank until a manhole opens** (inner route); **skip the hole** (quick route); **inside the base, pull a crank** (underground); **skip the crank and enter a portal** (hideout) | flying guardian | SOURCED [S19, S20] |
| 5 | hangar (pick helicopter or jet) → sky dogfight → forest convoy → mid-boss → spaceport mid-boss → space (pod) → mid-boss → shaft → on foot in the mothership → several mid-bosses → escape with a tank and a mech → free-fall final boss | none ("There are no alternate routes in this mission") | final boss; "longest mission in the series", five mid-bosses | SOURCED [S20] |

Notes:

- Branch triggers are always **physical and visible**: a gap, a pipe, a breakable wall, a lever
  pulled repeatedly, a vehicle to board, a portal. Some branches open only after a short wait
  ("wait a few seconds at the Missile Wall until a pipe"). SOURCED [S19, S25].
- Branch choice changes the boss experience (e.g. tank vs mech at the first boss) and the
  captive tally. SOURCED [S20].
- Speed-runners take the top route almost everywhere; the safest one-credit routes differ.
  SOURCED [S3, S4, S5].
- One mission (2) is "continuous from beginning to end" (no screen transitions). SOURCED [S20].

---

## 20. Pacing

| Measure | Value | Tag |
|---|---|---|
| Mission durations, skilled 1P with one continue | M1 ≈ **3 min**, M2 ≈ **4.5 min**, M3 ≈ **7.5 min**, M4 ≈ **8 min**, M5 ≈ **26 min**; whole game ≈ **50 min** | MEASURED [V3: mission starts at ≈ 25, 220, 500, 960, 1440 s; end screen at ≈ 3040 s] |
| Speed-run, full game, LEVEL-4 | **22 min 46 s** (record) | SOURCED [S27] |
| Speed-run, single missions (Steam port, LEVEL-4) | M1 81 s, M2 91 s, M3 94 s, M4 141 s | SOURCED [S27] |
| Boss fights | ≈ 40–80 s each for a skilled player (M1 boss ≈ 160–210 s in V3) | MEASURED [V3] |
| Time between checkpoints | ≤ 60 counts (4.3 min); skilled play used ≈ 20–40 counts (1.5–3 min) per section | MEASURED [V3 HUD] |
| Forward progress | ≈ 46 px/s average including stops → a 3-minute mission ≈ 6,000–8,000 px of scroll | MEASURED [V2]; length ESTIMATED from it |
| Locks | Camera moving ≈ 57 % of the time, locked or waiting ≈ 43 % | MEASURED [V2 @ 130–200 s] |
| Enemy density | 3–8 hostile actors on screen in normal sections; 10–20+ in set pieces (crab swarms, clone rooms) | ESTIMATED from V1–V3 frames |
| Set-piece rhythm | A new threat type or set piece roughly every 20–40 s (crab hut → locust swarm → piranha barrel → big crabs → boss in M1) | ESTIMATED from S3 strat list and V3 |
| Design intent | The first stage is "the most carefully balanced" because it sets the tone; bosses and gimmicks should surprise ("I don't want to create ordinary stuff that the player expects"). | SOURCED [S29] |

---

## 21. Design intent in the developers' own words

- "Restricting it to horizontal makes it easier for newcomers to understand, and easier to pick
  up and play." — Meeher [S29]
- A hover move was cut: "we felt it would ruin the jump-jump-jump tempo." — Meeher [S29]
- "I want the attacks and stage gimmicks to be wild too, to surprise the player." — Meeher [S29]
- "Precisely because something will only appear once … we want to splurge on the animation
  frames." — Meeher [S29]
- "Care should be taken to ensure that the moment of respawn is both dynamic and dramatic." —
  Meeher [S30]
- "There's a lot of stopping and shooting in Meeher's stages, but the levels that I designed just
  keep on scrolling … By alternating the levels we were able to give the game variety." — Kazuma
  Kujo [S30]

Take-aways for us: horizontal-first aiming, a steady hop rhythm, alternate "stop and shoot" arenas
with "keep scrolling" runs, spend animation budget on one-time moments, make respawns flashy.

---

## 22. Feel targets for our engine

Assumptions: 60 Hz ticks, 384×216, humans ≈ 36 px, 1 MS px = 1 our px, 1 MS tick = 2 our ticks
(speeds ÷ 2, accelerations ÷ 4, vblank counts 1:1). Values are **starting points for
play-testing**; each line gives the reason. Names are suggestions for `src/game/tuning.ts`.

### 22.1 Movement

| Constant | Value | Rationale |
|---|---|---|
| `RUN_SPEED` | **1.5** px/tick | MS walk 3 px / MS tick (MEASURED); crosses our 384 px view in 4.3 s. |
| `RUN_ACCEL` / `RUN_DECEL` | **0.75** px/tick² | Full speed in 2 ticks: MS starts and stops near instantly; 2 ticks avoids 1-px jitter. |
| `CRAWL_SPEED` | **0.75** px/tick | MS crawl is clearly slower than the walk (SOURCED); half speed is our estimate. |
| `JUMP_VELOCITY` | **−3.5** px/tick | With the gravity below: 54-tick air time and ≈ 47 px apex, like MS (27 MS ticks, ≈ 46–52 px). |
| `GRAVITY` | **0.13** px/tick² | 8·h/T² for h = 47, T = 54; MS ≈ 0.55 px / MS tick² ÷ 4 = 0.14. |
| `APEX_HANG` (optional) | gravity × **0.5** while \|vy\| < **0.6** and the jump began standing | Copies the "standing jump lingers at the peak" shape (SOURCED S2); keep total air time ≤ 58 ticks. |
| `MAX_FALL` | **4.0** px/tick | MS lands at ≈ 3.5 px/tick (7 / MS tick); a slightly higher cap keeps long drops fast but readable. |
| `AIR_MAX_SPEED` | **2.0** px/tick | MS moving jump ≈ 4 px / MS tick (MEASURED); jumping should beat walking (SOURCED). |
| `AIR_ACCEL` | **0.15** px/tick² | 0 → 2.0 in ≈ 13 ticks; MS needs ≈ 10 MS ticks from a standstill (MEASURED). |
| `AIR_DRAG` | **0** (keep momentum when no direction is held) | MS jumps keep their drift; reverse input decelerates at `AIR_ACCEL`. |
| `TAKEOFF_BOOST` | × **1.33** of ground speed, capped at `AIR_MAX_SPEED` | MS accelerates vx at take-off (SOURCED S32): a walking jump starts at 2.0 at once. |
| `AIR_FACING` | facing = pressed direction, instantly | In MS the shot direction follows the pressed side in the air (SOURCED S3/S4). |
| `COYOTE_TICKS` | **4** | Not in MS; harmless forgiveness for keyboard play. |
| `JUMP_BUFFER_TICKS` | **6** | Not in MS; keeps the "jump-jump-jump tempo" smooth. |
| `LAND_FIRE_LOCK` | **2** ticks | MS: "landing adds a 2-frame delay" (SOURCED S2). |
| Hitboxes | stand **14×30**, crouch **16×20** (ARCHITECTURE) | Enemy "chest" shots must fly 22–26 px above the ground so a crouch dodges them, as in MS. |

### 22.2 Pistol and firing input

| Constant | Value | Rationale |
|---|---|---|
| `DMG_UNIT` | pistol bullet = **10** damage | Lets every MS ru number in this file transfer directly (basic soldier HP 1–10 = one hit). |
| `PISTOL_COOLDOWN` | **8** ticks (7.5 shots/s) | MS mashed rate ≈ 1 shot per 8 vblanks (MEASURED). |
| `PISTOL_COOLDOWN_CROUCH` | **6** ticks | MS lets crouching beat the cap (SOURCED S5); a mild bonus without exploits. |
| `HOLD_AUTOFIRE` | **10** ticks while fire is held | MS needs mashing; browser players need comfort; tapping stays slightly better. |
| `PISTOL_BULLET_SPEED` | **8** px/tick | MS 16 px / MS tick (MEASURED); 48 ticks to cross our view. |
| `PLAYER_BULLET_LIMIT` | **16** per player (pool) | MS has no pistol limit (SOURCED); cap only for performance. |
| `FIRE_BUFFER_TICKS` | **6** | MS stores presses made during an attack and fires them after (SOURCED S4). |
| `WEAPON_DRAW_TICKS` | **30** | MS draw after a dry weapon ≈ 60 vblanks but players cancel it; 30 keeps the beat. |

### 22.3 Special weapons (ammo: first / again / crate; cap 999)

| Constant group | Value | Rationale |
|---|---|---|
| Machine gun | 200 / +150 / +100; **1 round per 4 ticks** while held (4-round minimum burst per tap); 10 dmg; bullet **9** px/tick; ±1.5 px jitter | MS: 4 rounds per press, 1 per 4 vblanks (SOURCED S2); bullets a bit faster than the pistol for punch (ESTIMATED). |
| Machine-gun sweep | aim turns **22.5° per 2 ticks** toward the held direction while firing (forward → up = 8 ticks, 3 diagonal steps) | Reproduces the fan of diagonal rounds (SOURCED S6); step size ESTIMATED from series sprites. |
| Shotgun | 30 / +10 / +10; cooldown **28** ticks; 200 dmg to all in a cone ≈ **72×40** px; pierces; 1 at a time | MS "Slow", 200 ru, max 1 (SOURCED); cooldown and size ESTIMATED from the short-range blast. |
| Flamethrower | 30 / +15 / +10; cooldown **24** ticks; 20 dmg per 2 ticks per target, ≤ **13** hits; range ≈ **96** px, slight upward arc; longer along the floor when fired down from the air | SOURCED damage and limits (S1/S4); range and cooldown ESTIMATED. |
| Rocket launcher | 30 / +20 / +10; max 2; speed **2 → 7** px/tick (accel 0.3); 30 + 50 splash (soft targets); turns only vertically ≤ **1 px/tick** toward the nearest target | SOURCED damage, limit, "adjusts to other platform levels but cannot turn around"; speeds ESTIMATED. |
| Laser | 200 / +150 / +100; beam full width; 8 dmg per 2 ticks; **1 ammo per 4 ticks**; lingers **6** ticks after release | SOURCED (S2/S4). |
| Homing missiles | 40 / +20 / +10; max 3; 30 + 10 splash; speed **4** px/tick, turn **4°**/tick | SOURCED damage and limit; motion ESTIMATED. |
| Ground runner | 30 / +10 / +10; max 2; 30 + 30 splash; runs along the floor at **3** px/tick, follows slopes | SOURCED damage and limit; speed ESTIMATED. |
| Bouncing mine | 30 / +10 / +10; max 3; 30 + 1 splash; bounces with restitution **0.6**, rolls to a stop | SOURCED damage and limit; motion ESTIMATED. |
| Heavy grenade launcher | 20 / +5 / +10; max 2; 100 + 50 splash; speed **6** px/tick; fire column **24×96** px on impact | SOURCED damage and limit; motion ESTIMATED. |
| "Big" crate variants | same damage, hitbox × **1.5–2**, ammo of shotgun halves | SOURCED (S3/S4/S6). |

### 22.4 Grenades

| Constant | Value | Rationale |
|---|---|---|
| `GRENADES_PER_LIFE` / `GRENADE_CAP` / `GRENADES_IN_AIR` | **10 / 99 / 2** | SOURCED. |
| `GRENADE_COOLDOWN` | **10** ticks | MS "Fast" mode; the 2-in-the-air limit is the real brake (ESTIMATED). |
| Spawn point | **38** px above the feet, **8** px in front | MS overhand release ≈ 43 px above the feet for a 36 px body (MEASURED), scaled down a little for readability. |
| `GRENADE_VX` | **2.1** px/tick + the thrower's vx | MS 4.2 px / MS tick (MEASURED); walking adds speed (SOURCED). |
| `GRENADE_VY` | **−1.5** px/tick | MS ≈ −3 px / MS tick (MEASURED): a flat lob. |
| `GRENADE_GRAVITY` | **0.2** px/tick² | MS ≈ 0.8 px / MS tick² (MEASURED): heavier than the player. |
| `GRENADE_BOUNCE` | vy × **−0.65** on the first ground contact, vx kept; explode on the second contact or any enemy contact | MS: one bounce, second landing ≈ 1 s after the throw, ≈ 124 px away (MEASURED). |
| Damage | direct **100**; blast boxes **80×32** (ground) + **48×112** (column); splash **10** once per soft target | SOURCED boxes and direct damage (S16); MS splash is tiny but kills soldiers, so 10 = one infantry kill. |

### 22.5 Knife

| Constant | Value | Rationale |
|---|---|---|
| `KNIFE_RANGE` | box **26×28** px starting at the body front, feet to chest | Not documented; ≈ ¾ body width so it triggers only when an enemy is really close (ESTIMATED). |
| `KNIFE_DAMAGE` | **30** | SOURCED (3 pistol shots). |
| `KNIFE_COOLDOWN` | **20** ticks (3/s) | SOURCED ("about three times per second"). |
| Trigger | fire pressed + soft enemy or slow projectile inside the box → knife instead of a shot | SOURCED (S6/S26). |
| `ENEMY_MELEE_WINDUP` | **50–60** ticks | SOURCED ("nearly a full second"). |

### 22.6 Death, respawn and invulnerability

| Constant | Value | Rationale |
|---|---|---|
| `DEATH_ANIM_TICKS` | **60** | Time to show a funny, readable death before the drop-in (ESTIMATED). |
| `RESPAWN_DROP_TICKS` | **12** | MS drops the new life from the top in ≈ 5 MS ticks (MEASURED); 12 ticks is fast but visible. |
| `RESPAWN_INVULN` | **120** ticks, blink every 2 ticks | MS blinks "a few seconds" (SOURCED, length ESTIMATED); 2 s is the genre norm. |
| `MOUNT_INVULN` | enter animation + **20** ticks | MS grants i-frames on entering (SOURCED). |
| `EJECT_INVULN` | somersault (≈ 16 ticks) + **30** ticks | Ends near the apex of a jump made right after landing, as in MS (SOURCED S25). |
| `VEHICLE_HIT_INVULN` | **60** ticks | MS vehicles get i-frames per hit (SOURCED); 1 s is our estimate. |
| `KNOCKDOWN` | **40** ticks down, weapon lost, **20** ticks i-frames after standing | MS knock-down hits (SOURCED S4); times ESTIMATED. |
| On death | weapon → pistol, grenades → 10, captive tally → 0, timer → full | SOURCED. |
| Pits and crushers | kill through i-frames | SOURCED (S14). |

### 22.7 Lives, continues, timer

| Constant | Value | Rationale |
|---|---|---|
| `LIVES_PER_CREDIT` | **3**; no extra lives | SOURCED. |
| `CONTINUE_COUNT` | **9 → 0**, **60** ticks per count, fire/jump ×4 faster | MS nine counts (SOURCED); seconds per count ESTIMATED. |
| `CONTINUE_GIFT` | machine-gun crate drops on the player | SOURCED (ours: the machine gun is given at once). |
| In-world continue | no pause: the countdown runs over the live world; every player out → the enemies on screen laugh; a continued hero lands → they cower **90** ticks, the boss staggers **60** | User decision 2026-10-20 (GDD §4.6). |
| `TIMER_COUNTS` | **60**, shown as a 2-digit counter | SOURCED. |
| `TIMER_TICKS_PER_COUNT` | **256** (≈ 4.3 s) | MS 128 MS ticks per count (MEASURED); full counter ≈ 4.3 min. |
| `TIMER_ALARM_AT` | **10** | SOURCED. |
| On time-out | every player dies | SOURCED. |
| Reset | at checkpoints and on death | SOURCED + MEASURED. |

### 22.8 Camera

| Constant | Value | Rationale |
|---|---|---|
| `SCROLL_LINE` | **40 %** of the view width (≈ 154 px) | MS keeps the leader at ≈ 35–45 % (MEASURED approx.); shows threats ahead. |
| Follow speed | equal to the leader's forward speed (no cap below 4 px/tick) | MS camera matched 3 and 4 px / MS tick exactly (MEASURED). |
| `CAMERA_CATCHUP_MAX` | **3** px/tick, then ease out by **0.05** px/tick² | MS 6 px / MS tick decaying over ≈ 0.6 s (MEASURED). |
| `CAMERA_START_RAMP` | **0.03** px/tick² from rest | MS camera ramps 1 → 2 → 3 px over ≈ 1 s (MEASURED). |
| `GO_PROMPT_DELAY` | **90** ticks after a lock clears with no movement | ESTIMATED; MS shows a flashing "GO" sign after clears (generic UI, design our own sign). |

### 22.9 Enemies and bosses

| Constant | Value | Rationale |
|---|---|---|
| Basic soldier HP | **10** (one hit) | MS 1 ru (SOURCED); our pistol = 10. |
| Enemy bullet speed | **2.5–3.5** px/tick | ⅓–½ of the player bullet so shots stay dodgeable (ESTIMATED). |
| Rifle fire interval | **60–120** ticks per soldier, plus a **12**-tick aim cue | MS riflemen are slow and jam (SOURCED); numbers ESTIMATED. |
| Enemy grenade | vx ≈ **1.5**, vy ≈ **−3**, g **0.15**, flashing | MS enemy grenades are slow and flash (SOURCED); values ESTIMATED. |
| Wave lock | camera locks until the wave is dead; spawn side from the player's screen half | SOURCED (S3/S4). |
| Boss HP (normal) | **2,000–6,500** dmg (= MS 200–650 pu); final boss ≈ **16,000** | SOURCED (S4) at LEVEL-4, × 10 for our units. |
| Boss rage | at **30–40 %** damage taken: +1 projectile per volley, ×1.25 speed | SOURCED thresholds (S4); effect sizes ESTIMATED. |
| Boss damage states | visual stages at **50 %** and **25 %** HP | SOURCED (S4). |
| Spawn armour | big vehicles invulnerable until the camera lock or **240** ticks | SOURCED (S4: "4 or 5 seconds"). |

### 22.10 Difficulty (our 4 levels mapped to MS levels)

| Our level | ≈ MS level | Boss / big-enemy HP | Enemy fire interval | Enemy bullet speed | Tag |
|---|---|---|---|---|---|
| Easy | L2 | × 0.8 | × 1.3 | × 0.9 | ESTIMATED from S4 trends |
| Normal | L4 | × 1.0 | × 1.0 | × 1.0 | baseline (MS default) |
| Hard | L6 | × 1.25 | × 0.8 | × 1.15 | ESTIMATED |
| Arcade | L8 | × 1.5 | × 0.7 | × 1.25 | ESTIMATED (MS L8 boss HP +20–80 %) |

### 22.11 Scoring

| Event | Points | Rationale |
|---|---|---|
| Soldier, shot | **100** | MS (MEASURED / SOURCED). |
| Soldier, knife | **500** | MS (SOURCED). |
| Light vehicle / turret | **500–3,000** | ESTIMATED; scale with HP. |
| Captive at mission end | **10,000** each, lost on death | MS (SOURCED). |
| Special captive / VIP captive | **30,000 / 50,000** | MS (SOURCED). |
| ≥ 10 captives (1P) or most captives (2P) | **100,000** | MS (SOURCED). |
| Riding a vehicle when the boss dies | **100,000–400,000** by type | MS (SOURCED). |
| Items | **10–1,000** (food), **500–50,000** (treasure, rare) | MS (SOURCED). |
| Pickup you cannot use | **1,000** | MS (SOURCED). |
| Continue | **+1** marker | MS (SOURCED). |

### 22.12 Pacing targets

| Target | Value | Rationale |
|---|---|---|
| Mission length | **4–8 min** each for a first-time clear | MS missions 1–4: 3–8 min for a skilled player (MEASURED). |
| Section length (between checkpoints) | **60–150 s** of play | MS skilled play used 20–40 timer counts per section (MEASURED). |
| Scroll length per mission | **6,000–10,000** px | ≈ 46 px/s average progress (MEASURED) × 3–4 min. |
| Lock share | **≈ 40 %** of play time in locked arenas | MS ≈ 43 % (MEASURED). |
| New threat or set piece | every **20–40 s** | MS rhythm (ESTIMATED). |
| Branches | **2–3** routes in most missions, triggered by a visible object (gap, pipe, breakable wall, lever, vehicle), rejoining before the boss | MS3 structure (SOURCED). |
| Feel checklist | standing jump ≈ 0.9 s; walk across the view ≈ 4.3 s; grenade lands ≈ ⅓ view ahead; pistol bullet crosses the view in 0.8 s; one timer count ≈ 4.3 s | Quick play-test checks derived from the rows above. |

---

## 23. IP to avoid (complements `docs/ORIGINALITY.md`)

Everything below is protected **expression** of the *Metal Slug* series (SNK / Nazca / SNK
Playmore). Mechanics may be shared; the items below may **not** appear in our game, not even
renamed or slightly changed. Names already banned in ORIGINALITY.md are not repeated.

### 23.1 Names (additional)

- **People and creatures:** General (Donald) Morden, Utan, Madoka Aikawa, Marx / "the President",
  Pupipi, Abul Abbas, Clark, Ralf, Leona, Trevor, Nadia, Walter, Tyra, Gimlet, Red Eye, Tequila,
  Sisilia, Alice / MS-Alice; enemy names Ohumein-Conga, Chowmein-Conga, Huge Locust, Flying
  Killer, Enormous Moray, Man Eater, Sasquatch, Tar Man, Hopper Mecha, Mecha-Brain, Maggot,
  Giant Caterpillar, Big Snail, Dog Mummy, Chariot, Bull Chan, Marine Diver, Fanatics (as a unit
  name).
- **Bosses:** Monoeye UFO, Hairbuster Riberts, Rugname, Dai-Manji / Di Manji, Fake Rootmars, Clone
  Incubator, Dragon Nosuke, Hozmi, Kessi, Mosque Artillery, Mecha Allen.
- **Factions:** PF Squad, Japonese Army / Division 6, Amadeus Syndicate, Martians / Invaders,
  Future Rebels.
- **Vehicles:** Slugnoid, SV-001 (any letter variant: Type-R, Type-B), Borobune Slug, Hammer-Yang,
  Rebel Armor, Slug Gunner, Protogunner, Slug Mobile, Slug Digger, Slug Gigant, Slug Trolley,
  Slug Armor, Landseek, Melty Honey, Metal Claw, R-Shobu, Nop-03, Parachuetruck, TM-1 Missile,
  Black Hound, Metal Rear; the word "Slug" for any vehicle.
- **Weapons and items:** Heavy Machine Gun / "HMG" (use our own name), Flame Shot, Enemy Chaser,
  Iron Lizard, Drop Shot, Super Grenade, Two Machine Guns, Zantetsu Sword, Thunder Shot, Thunder
  Cloud, Mobile Satellite / MOBS, Armor Piercer, Gnome Bullet, Next Meat, Ajirabian Teardrop,
  Diet Food.
- **Systems and screens:** "Metal Slug Attack" (the ram move), Vulcan Fix, Slug Gauge, Weapon Stock,
  Metallish System, Rush Blaster, Combat School, Best Tank Busters, Recaptured Prisoners,
  Soldier Select, "Enforced Metal Slug", Storming the Mothership, Fat Island.
- **Mission titles:** A Couple's Love Land, Wandering at Midnight, Eyes Over the Waves, Tombstone of
  Sand, All About Love (and other entries' titles such as Drifting in Desert, Madrigal of Wind,
  Kiss in the Dark, I Wish to Believe in Love).
- **Music titles:** Steel Beast, Final Attack, Assault Theme, Blue Water Fangs, The Midnight
  Wandering, Devil's Snow Cave, The Shallow Sea, Hard Water, Secret Factory, The Cenotaph, In The
  Void, Into the Cosmos, First Contact, Bioinformatics, Marine Diver, The Unknown World.

### 23.2 Designs and visual signatures

- The four heroes' looks (blond commando with headband and red vest; cap-and-sunglasses soldier;
  the two female agents with glasses, caps and their weapon poses).
- Captive look and routine: bearded, ragged, tied sitting captive who **pulls items from his
  pants**, **salutes** and dashes off; the wandering supply girl with a huge backpack; the
  disguised officer firing an energy ball; the armed monkey.
- Enemy soldier look: green fatigues + German-style helmet + exaggerated screaming face; the
  muscular shirtless sergeant with an M60 and his taunts; the pompous mustached general.
- Aliens: tentacled squid-like alien with a ray gun; flat mini saucers; one-eyed floating alien
  groups; the giant brain final boss and its mothership.
- Bosses and set pieces of MS3: giant hermit crab carrying a building; giant flower/guardian
  with spirit wolves and gold-turning beam; giant security robot with a chest missile; airlock
  doors with three orbs; partner-clone rooms; free-fall final fight; beach of crashed missiles and
  a shipwreck; plane-crash site in snowy mountains; ice cave of frozen soldiers; pyramid base with
  ten batteries to power a door.
- Vehicles: the small round silver tank with twin top vulcans and front cannon (and its jump/
  crouch/hatch animations), the crab-walking front-facing mech, the elephant that eats chili or
  batteries, the ostrich, the camel with a vulcan, the yellow mini-sub.
- HUD signatures: "ARMS / BOMB" boxes, "1UP=2" lives format, "∞" ammo symbol in that box, the
  "P1" arrow marker, the "IN" arrow over vehicles, the "GO!" sign with a pointing arrow, the slug
  gauge bar. Design our own HUD layout, labels and markers.
- Crate art: black/blue/green/red crates with a yellow letter (H, R, S, F, L, C, I, D, G) and the
  pulsing-letter "big" crate. Our crates may carry letters (allowed), but use our own colours,
  frame and letter set.

### 23.3 Gags and transformations

- No zombie, mummy, fat (from eating food), snowman (ice breath), monkey or similar transformations
  (already banned) — including their weapon changes and "cure" items.
- Enemy idle gags: soldiers cooking at a campfire, gossiping, sunbathing, squatting to poop,
  reading, sleeping, cheering, megaphone; the pointing-and-laughing at the player's death and the
  mass scream when the player respawns; soldiers running away waving their arms in panic with
  the series' scream. Invent our own idle and panic gags.
- Death gags: being eaten by flying fish or locusts, vines bursting from the body, turning to gold
  and coins, acid melting to a skeleton, the male "hand on chest" death pose.
- The capture twist (player 1 abducted and cloned; enemy general revealed as an alien), the
  co-operating enemy army, the ending where a thrown gun hits a sea creature.

### 23.4 Text and voice

- Announcer and voice lines: "Mission … Start!" with that delivery, "Mission Complete!" jingle and
  voice, weapon call-outs ("Heavy Machine Gun!", "Rocket Launcher!", "Shotgun!" …), "Okey-dokey",
  the captive's "Thank you!", "You're great!", "Great!" / "Draw!", "Mission All Over!", the
  heroes' death screams. Generic phrases allowed by ORIGINALITY.md stay allowed; record or
  synthesize **our own** delivery and wording.
- How-to-Play tutorial lines from MS3 (e.g. "Press Button A to fire the gun", "Press Button C to
  throw a grenade. Awesome Power!", "Jump to board the Enforced Metal Slug", "The tank will
  explode when its power reaches 0, so get out quick", "Shift lever down and press Button B to
  escape", "Press Buttons A + B to stage a frontal attack", "Crash the tank into the enemy to
  inflict great damage", "That's all the controls you need to know."). Write new tutorial text.
- Menu and screen texts: "SOLDIER SELECT", "PLEASE WAIT", "MISSION ALL OVER!", "BEST TANK
  BUSTERS", "RECAPTURED PRISONERS", the scrolling list of captive names, character bios.

### 23.5 Music and sound

- No melody, bass line, rhythm or arrangement from any series track (title theme, mission themes,
  boss themes, "mission complete" fanfare, continue/game-over jingles). Compose new music only.
- No imitation of the series' pickup "clunk", the tank engine whine or the signature explosion
  and scream samples. Synthesize our own sounds (ARCHITECTURE §5.7).

### 23.6 Level design

- Do not rebuild MS3 layouts or their branch puzzles one-to-one (boat-vs-sunken-ship-vs-sub split
  in a beach level; "ICEMAN" wall into an ice cave; tunnel that lowers at a missile wall; crank
  pulled until a manhole opens on a pyramid; portal marked "entrance"). Use the **idea** of
  visible branch triggers with our own places and props.

---

## Appendix A — Measurement log

All analysis ran on copies of the videos in a scratch folder (frame extraction with ffmpeg,
analysis with Python/NumPy). Coordinates are native MS pixels (304×224). For V2 the game area
(x 240–1680 of 1920) was scaled to 304×224; its HUD edges matched V1 exactly (scale 1.000,
offset 0), so the conversion is exact.

| # | What | Video and time | Method | Result |
|---|---|---|---|---|
| A1 | Update rate | V2 120–140 s; V1 all | Mean abs. difference of consecutive frames; timestamps of V1 | V2: change every 2nd frame (dupes < 0.05). V1 (7,799 frames in 300 s): ≈ 7,160 steps of 33.8 ms, ≈ 560 of 67.6 ms (slowdown), a few longer |
| A2 | Timer rate | V1 frames 0–7799 | Change detection on the timer digits (x 135–170, y 6–24) | Clean intervals of 128 frames = 4.326 s (×5); other intervals noisy from sprites over the digits |
| A3 | Human height | V2 10–16 s (How-to-Play demo, static camera) | Background subtraction | Standing box y 115/116 → 151 (36 px) |
| A4 | Jump arcs | V2 15.8–17.8 s (land), 63.9–75 s (water) | Head-top tracking per update | 27 updates take-off → landing; head rise ≈ 52 px; steps 7,7,5,6,5,4,3,3,1,3,2,0,0 up, mirror down (moving jump); 12,7,7,8,8,4,2,1,2,0,1,1,0 (standing jump) |
| A5 | Air speed | V2 66.88–67.75 s | Head centroid x per update | 0, 1.1, 3.5, 2.5, 2.1, 3.3, 2.7, 2.9, 3.8, 3.0, then ≈ 4.0 px/update |
| A6 | Walk speed | V2 134.9–137.0 s | Per-update camera shift of rows 150–215 (subpixel SSD fit) while the leader walks at a fixed screen x | 3.0 px/update steady |
| A7 | Hop speed | V1 frames 331–436 | Same, TAS hopping forward | 4.0 px/update with a 0 every ≈ 5 updates |
| A8 | Camera catch-up | V2 147.2, 154.1, 158.3 s; V1 frames 485–523, 834–869, 887–924 | Same | 6.0 px/update, then 5, 4, 3, 2 |
| A9 | Pistol bullet | V2 11.95–12.25 s (demo, static) | Blob tracking in the bullet lane | x 131→147→163→179→(195)→211→(227)→243→(259)→275: 16 px/update |
| A10 | Pistol cadence | V1 frames 330–353 | Visual reading of muzzle flashes | One player flashes at 331, 335, 339: 4 updates apart |
| A11 | Grenade | V2 18.73–19.72 s (demo, static) | Centroid tracking per update | Release (118.8, 108.9); apex (135.8, 101.7) after 4 updates; ground (182.9, 150.1) after 16; bounce apex (216.9, 130.5); 2nd ground (242.5, 152.2) after 29; explosion column next update |
| A12 | Average progress | V2 130–200 s; V1 frames 330–960 | Sum of positive camera shifts / time | 3,180 px / 69.7 s = 45.6 px/s (moving 1,060 of 1,870 updates); TAS 1,605 px / 22.4 s = 71.7 px/s |
| A13 | Mission durations | V3, samples every 20 s | Contact sheets of the screen and HUD | Mission starts ≈ 25, 220, 500, 960, 1440 s; final result screen ≈ 3040 s |
| A14 | Respawn | V3 168–200 s | Frame-by-frame | Drop-in ≈ 172.3–172.5 s, timer 57 → 60; the post-respawn blink could not be separated from heavy sprite flicker in this boss fight, so the i-frame length stays ESTIMATED |
| A15 | Machine-gun use | V2 135.1–136.7 s | HUD ammo digits | 200 → 180 rounds in 1.6 s (human mashing) |

## Appendix B — Open questions (not verified)

1. Exact respawn and hit i-frame lengths in MS3 (need a frame-by-frame look at a quiet death).
2. Exact crawl speed and the knife box size (debug DIP 1-6 would show the box).
3. Exact cooldowns of the shotgun, flamethrower and rocket launcher when fired standing.
4. Machine-gun sweep step size and timing per bullet.
5. Whether a trailing co-op player blocks scrolling at the left edge or is pushed along.
6. Enemy bullet speeds and fire intervals per enemy type and difficulty level.
