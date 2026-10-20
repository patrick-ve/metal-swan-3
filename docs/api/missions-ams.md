# Mission `ams` API — THE FRYING DUTCHMAN

Code: `src/game/content/missions/ams/**`. Spec: `docs/design/amsterdam.md` (§6 layout, §7 briefing,
§8 mission def and card). GDD summary: `docs/GAME_DESIGN.md` §1.4, §2.4, §9.6, §10.0a, §11.0a.
Tests: `tests/content/mission-ams.test.ts`, `tests/content/ams-route.test.ts` (the route split, the
cruise, hostages per route, secrets), `tests/content/boss-ams.test.ts`, `tests/content/ams-npcs.test.ts`,
`tests/content/ams-secrets.test.ts`. The arcade extras of 2026-10-20: `docs/design/ams-extras.md`
(stag party and beer bike `docs/api/stag.md`, scan car `docs/api/scan-car.md`).

## Files

| file | what |
|---|---|
| `index.ts` | `AMS: MissionDef` (`next: 'm1'`, hostages a 5 / b 4 / c 2 / c1 1 / c2 1: the same 12 on both routes, the hidden tourists of a and b included) |
| `helpers.ts` | the m1 wave notation helpers: `fromRight` (R+), `fromLeft` (L−), `fromTop`, `at`, `hostage`, `crate`, `normalUp` [N], `hardOnly` [H], `twoPlayers` [2P], `waitBoss`, `anyAlive` |
| `terrain.ts` | terrain and layout numbers (`A_*`, `B_*`, `C_*`, `D_*`, `DECK_Y`, `ROOF_Y`) |
| `art.ts`, `backgrounds.ts`, `npc.art.ts` | the city art (`decor/ams/…`, bg generators `ams-skyline`, `ams-canal-houses`, `ams-elms`, `ams-plein`) |
| `entities.ts`, `ambient.ts`, `breakables.ts` | NPCs (`ams-baker`, `ams-hotdog-vendor`, `ams-staff`), city life, `ams-boat-platform`, breakables (see the header of `entities.ts`) |
| `section-a.ts` … `section-d.ts`, `section-c1.ts`, `section-c2.ts` | each: `life(ctx)` (ambient life + landmark NPCs; a → `{ baker }`, b → `{ vendor }`), `script`, the `SectionDef` |
| `cruise.ts`, `art-route.ts`, `art-hd-route*.ts`, `art-hd-bg-amstel.ts` | the canal cruise (c2): `ams-cruise-boat`, `ams-low-bridge`, `ams-magere-brug`, `ams-party-boat`, the route signs and the pontoon of c, the `ams-amstel` far bank layer; 1× and 2× / 4× art |
| `secrets.ts`, `secrets.art.ts` | `ams-secret` and `AMS_SECRETS` (per section), `placeSecrets(ctx, id)`, `secretArt(id)`, `HIDDEN_TOURISTS` |

## Section scripts

- Every script calls `life(ctx)` first and reuses its handles (never a second baker / vendor).
- Exits of a / b / c / c1 / c2 are `disabled`; a leaves by `exitTo('b')` after the briefing (a
  beer-bike rider gets off first: `noBeerBikes`), b and c1 open their exit (`enableExit('end')`,
  GO arrow) when the last tagged squad is clear, c opens both `brug` (→ c1) and `rondvaart`
  (→ c2) after the scan car (`scanCarFight`, `openFork`), c2 when the boat has docked and the
  jetty wave is clear.
- Camera locks: a `1520–1904` (tag `plein`), `2120–2504` (the beer bike, tag `bike`),
  `3200–3584` (tag `fabel`); c `1984–2368` (the scan car; from camera 1640 a body wall at
  `C_ARENA[1] − 8` until the car is beaten); c2: the cruise boat holds the camera; d `896–1280`
  (boss).
- Tier 4: b, c and c2 list `artLate` (what they show only well into them; the section before
  never builds it ahead): b the Rijksmuseum facade, c its shop-quay decor and the fork, c2 the
  bridges, Carré and the stag party.
- Stag partiers pass their `look` (helpers `STAG_LOOKS` = [0, 2], `stagArt(looks, { groom, bike })`
  for the section `art`): one look set is about 3.6 MB at 4×, so the sections share two looks.
- Perched gulls: `G − 70` on a `decor/ams/lamp` top, `ROOF_Y` on a houseboat cabin.
- One voice at a time in b: the Swan's note shows at once; Gramps's greeting waits for the vendor's
  salute; the glide lesson waits for the greeting.
- `ams-cyclist-bg` is registered but no section spawns it (removed 2026-10-13: it drew over the railings and distracted).
- The finale pauses the timer (it cannot run out under the cheering).

## Exports for tests and other modules

| export | file | what |
|---|---|---|
| `BRIEFING`, `LINE_TICKS` (150), `SKIP_AFTER` (20), `BRIEFING_TOSS` | section-a | the six hint lines (`\n` = 2 lines, ≤ 24 chars each), the line time, the no-skip window, the tossed item (`pickup-weapon` flamethrower, homes in on the catcher) |
| `briefing(ctx, baker)` | section-a | THE BRIEFING: erase enemy shots, `timer.pause()`, input lock, players closer than `CLEAR_DIST` (34) to `COUNTER_X` (3326) walk aside (scripted pad; 2P: player 1 left of the counter, player 2 right of it) and turn to him, the baker walks to the counter, 6 lines (auto-advance; fire on a real pad skips after 20 ticks), one toss per living player, each aimed at its own catcher (`toss(spec, target)`), wave; `finally` restores the pads and resumes the timer |
| `InputLock` | section-a | `apply(steer?)` once per tick: every player (also one who joins or continues) gets a private `VirtualPad` (empty, or `steer(p)`'s buttons); `fire()` = fire pressed on a real pad; `restore()` |
| `SWAN_X` (1080), `MUTE_X`, `SWAN_PARK_AHEAD` (480), `B_VENDOR` | section-b | where the Swan (2P: the Mute) and the vendor are; the Swans park when the camera reaches `SWAN_X − 480` (still off screen), so her nervous egg (600 ticks after she parks) does not fall right as the player walks up |
| `BOSS_HOME_X`, `BOSS_WALL_FAR`, `BOSS_WALL_NEAR`, `CHEER_X`, `DOORS_X` | section-d | the boss arena: the body wall sits 100 px in front of her while the stamp arm or the chain stands, 60 px once both are broken (so a player pressed against it hits the next part with the 45° shot); the finale spots |

## Records

`ams/swan-met` (b: a player came near the Swan or mounted her; m1-c then shows its "welcome
back" greeting) and `m1/swan-lesson` (b: the glide lesson was given; m1-c skips its own).

## Campaign wiring

`CAMPAIGN_MISSIONS` (`src/game/scenes/flow-data.ts`, re-exported by `final-tally.ts`) =
`['ams', 'm1', 'm2', 'm3', 'm4', 'm5']`; `missionLabel` / `missionNumber` and the high-score column
(`missionColumn`) number by that place (`ams` → MISSION 1 / `M1`, `m1` → MISSION 2 / `M2` …, `m5` →
FINAL MISSION / `M6`). `firstMission()` → `ams`; the title's attract demo plays `ams-a`.

## Play-test record (the arcade extras, final fixer, 2026-10-20)

Sims (`npm run sim -- --mission ams …`, the bot; `--route lower` = RONDVAART c2 (default),
`upper` = BRUG c1). These are the new baselines:

| run | result |
|---|---|
| `--god --expect-complete` (lower) | complete a→b→c→c2→d, 21 443 ticks, 0 deaths, 0 errors, 12 hostages |
| `--god --route upper --expect-complete` | complete a→b→c→c1→d, 21 843 ticks, 0 deaths, 0 errors, 12 hostages |
| `--section a / b / c / c1 / c2 / d --god` | complete: 21 455 / 16 901 / 21 915 / 8 721 / 19 090 / 10 740 ticks (to MISSION COMPLETE) |
| seeds 1 / 2 / 3, normal (lower) | complete in 19 858 / 21 523 / 19 185 ticks; 14 / 14 / 12 deaths; 12 hostages each |
| seeds 1 / 2 / 3, normal (upper) | complete in 16 209 / 15 694 / 15 391 ticks; 18 / 12 / 15 deaths; 11 / 12 / 12 hostages |
| seeds 4–8, normal | all complete on both routes (lower 12–20 deaths, upper 13–18) |
| `--players 2 --god` (lower / upper) | complete, 23 347 / 19 170 ticks, 0 deaths |
| `--players 2 --seed 1`, normal (lower / upper) | complete, 19 014 / 13 919 ticks, 21 / 20 deaths |
| `m0`, `m2 --god` | 5 679 ticks; 31 036 ticks, 1 death: byte-identical reports |

Where the bot dies (normal, seeds 1–3, the whole mission): none in a, b and c; c2 1–4 (gulls
diving at the boat, a cork); c1 3–5; the rest at ROBO-HALSEMA in d (9–14). The scan car (section
c alone, normal, seeds 1–4): beaten in 541 / 846 / 558 / 551 ticks (9–14 s), 0–1 deaths; the bot
stands at its rear bumper (out of the RAM's path: level fire hits the body, the 45° shot the
scanner) and jumps a RAM that comes at it. A human with the pistol is not measured (the spec's
target is 30–60 s).

Fixes of the final fixer that changed play: seeds 4 and 7 used to time out in a's beer-bike lock
(the bot on the awning at x 2245, y 126; the seated riders and its level shots could not reach
each other): the bot now drops to the targets' floor after 240 ticks. c: a body wall at
`C_ARENA[1] − 8` from the last squad on (a player who runs ahead stays in the arena's view) and the
car's arena is fixed (`arenaLeft: C_ARENA[0]`). The scan car: SCAN LOCK's strip drops onto the
frozen spot (a step away dodges it), the RAM never drives into a clamped player, its contact box
is the leading part of the body. The fork's `BRUG ↑` sign moved 22 px left (its arrow showed under
the `RONDVAART ↓` board).

Pacing (GDD 1.5; integrator, god, seed 1; spawns unchanged since): the longest stretch without an
enemy on screen: a 458 ticks (the side canal, older content), b 219, c 226, c1 117, c2 272, d 260.

Tier-4 working set (real 4× bytes, `DENSE_BUDGET_BYTES` 256 MB; worst squad hero, bob, 1P): a
251.6 · b 249.7 · c 247.6 · c1 241.6 · c2 216.6 · d 241.0 MB (Vincent 247.4 / 245.5 / 243.3 /
237.3 / 212.3 / 236.7); two players at most 243.0 MB (d). The next section's art joins ahead
without its `fx/`, `boss/`, deferred strips and its `artLate` (b: the Rijksmuseum facade; c: the
golden houses, the market stall, the tour boat, the white bridge, the route signs, the pontoon;
c2: the low bridges, the Magere Brug, Carré, the stag party and the cork), and a route split
builds every route ahead (`nextSections`). The continue's `sit-gloat` / `sit-cower` strips stay
out of the set like `gloat` / `cower`. `tests/content/ams-dense-budget.test.ts` keeps every squad
hero (1P) and hero pair (2P) under the budget with a 2 MB margin.

## Play-test record (final polish, 2026-10-13)

| run | result |
|---|---|
| `npm run sim -- --mission ams --god --expect-complete` | complete a→b→c→d, 14 581 ticks (243 s), 0 deaths, 0 errors |
| `--seed 1 / 2 / 3` (normal, mortal bot) | complete in 13 807 / 12 812 / 14 025 ticks; 11 / 11 / 10 deaths (was 13 / 10 / 11 before the polish, with the old bot) |
| `--players 2 --god` | complete, 12 681 ticks, 0 deaths (houseboat 2 now reaches x 1316: the gap to the quay is 24 px) |
| `--boss` (mortal) | complete, 5 194 ticks (87 s), 8 deaths |
| `m0`–`m5 --god` | all complete (m1 45 242 ticks with its known Encore time-ups; m4 `--seed 1` normal now completes, see below) |

Where the bot dies (seed 1, normal): 1 in a (a gull over the canal), the rest in d: stamp waves
when it is pinned at the arena's left wall, a few low lashes (it jumps too late), gulls, letters
and the phase-3 fan. A human gets a 28-tick lash tell with a lane cue in pose, glow and pitch.

Fixes from this pass: the m4-b respawn soft-lock (`Player.safeSpot` rejects spots below the view
and spots under a dynamic solid such as the closed hatch; `tests/game/life.test.ts`); the boss
damage looks (`finish()` scuffed outside the canvas); the stamp arm drawn behind the block (the
GESLOTEN face is never covered) with tube shading on every limb; boss idle breath and blink; the
intro and phase-2 bubbles clear before the first tell; the red-rimmed slam shadow; the lash 156 →
124 px, tell 26 → 28, recovery 36 → 44, pitch by lane; the Swan greeting (checkpoint 1100 → 1200,
the radio waits for the sign, the phone rider waits for Gramps); the finale victory pose and
spaced staff bubbles; gag bubbles skip when another hangs within 56 px (`gagBubble`); the far
bike lane (12 px up, haze 0.5); a slate rider jacket; the gull blast tumble; the herring wreck;
HOTDOGS lettering; `ams-ducks`; `enter: 'top'` gulls start above the view; sprite pre-warm at
each section start; the bot dodges growing boss lanes (a lash).

### Earlier record (mission-verify)


| run | result |
|---|---|
| `npm run sim -- --mission ams --god --expect-complete` | complete a→b→c→d, 12 825 ticks (214 s), 0 deaths, 0 errors, no missing sfx |
| `--seed 1 / 2 / 3` (normal, mortal bot) | complete in 12 256 / 12 147 / 12 242 ticks; 13 / 10 / 11 deaths |
| `--players 2 --god` | complete, 14 298 ticks; 1 drown (bot 1 walked back over the side-canal gap at x 1302–1340 for a hostage: a bot-nav limit, the 38 px gap is an easy jump) |
| `--boss` (mortal) | complete, 4 528 ticks (75 s); 9 deaths: 1 stamp wave, 7 chain lashes (the bot does not crouch / jump the lash; the dodges are covered by `boss-ams.test.ts`), 1 under her stomp |

Where the bot dies on the full run: a few in a (riders, the side canal) and c on foot; most in d
(the lashes, above). Pacing (GDD 1.5), measured as ticks with no enemy on screen while the player
plays (god bot): no stretch over 240 ticks except THE BRIEFING (a cut-scene) and the finale after
the boss. Fixes from this pass: the background cyclist that looped at the left edge of the Fabel
Friet lock; the player standing inside the baker during the briefing; both 2P fries going to one
player; four bubbles at once at the hot-dog stand (vendor, note, greeting, nervous egg) and the
greeting and lesson interleaving on the radio; `player/throw` (not an sfx id) →
`weapon/grenade-throw`; three quiet stretches in a (after the PLEINTJE, before Fabel Friet) and b
(the walk to the stand).
