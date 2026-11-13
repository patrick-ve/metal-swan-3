# Mission sewers — level 2, RATTENJONG MET DE RATTENITEMS: De Wallen by night and the sewer under it (spec, 2026-11-12)

The user, 2026-11-11: "A level that takes place in the Amsterdam Red Light District by night. The squad needs to
clear the area of shady drug dealers, pimps […]. The squad will then enter the Amsterdam underground sewers, where
gigantic rats attack the players. In the end a rat boss must be defeated (he is called the Rattenjong). The
Rattenjong throws items from the sewer at the players as attack." It replaces `oat` as level 2 ("Delete the oat
level, as I do not want it anymore"): ams 1 → **sewers 2** → rally 3 → fps 4 → oldenzaal 5.

This file is THE SPEC for the `sewers` waves. Inputs: the approved level card `docs/design/sewers/brainstorm.md`
(55 decision rows; the rows are the authority, this file never softens them), the look sheet
`docs/design/sewers/look-sheet.md`, the look sample (page https://claude.ai/artifact/QkY3LU3R5URFQs3vrCrVQN
version 2; kit `tools/levelkit/missions/sewers/`), `docs/LEVEL_GUIDE.md`, the code survey `tmp/sewers/survey.md`
(file:line facts; git-ignored, read it if you have it). Numbers marked *start* may move in play; the builder's
report says what moved and why.

## Status
| Phase | State | Date | Note |
|---|---|---|---|
| 1 Brainstorm | approved | 2026-11-11 | "Yes, proceed" |
| 2 Look sample | approved | 2026-11-11 | V2 BLACK, "Yes, approve the look"; grate light made faint and white; page version 2 |
| 3 Spec | approved | 2026-11-12 | "Proceed"; the fresh-helper guess check found 15 points, all fixed |
| 4 Play | in progress | 2026-11-12 | P0 done (oat deleted: 80 files, 21,190 lines; route ams → sewers → rally; full suite 335 files / 6,829 tests green; ams and rally sims equal the baseline; grey sewers sim 8,708 ticks); P1a done (4 rats, dealer/pimp/bodyguard, `sewers-worker`, banana tourist; notes `tmp/sewers/p1a/notes.md`); P1b done (five sections, Gerrit, the eruption, the flashlight and the fall, the fatberg, the Rattenjong and the end; god 1P full run 20,094 ticks); P2 done (mortal stall in d fixed, Gerrit pellets readable, bubbles, the king lit; full suite 343 files / 6,970 tests green; ams and rally equal; god 1P seeds 1–3 20,380 / 19,528 / 20,857; 2P 18,089; mortal 1P 19,964, 2P 15,428); Stop 4: the user said "Proceed with the next steps" (2026-11-12; play feedback may still come) |
| 5 Paint | in progress | 2026-11-12 | P3 audio estimate ~13,500–16,500 credits (`tmp/sewers/audio-estimate.md`); the user: "yes, generate" (2026-11-12); P3 audio DONE: 9,629 credits spent; 35 sfx, 4 songs, 14 voiced lines + 3 card lines shipped to `public/audio/sewers/` (6 designed voices: dealer, pimp, gerrit, sewer-worker, taxi-driver, stag-tourist; the hero line stays text-only; no outro on `sewers-boss`, the end fades it); notes `tmp/audio/sewers/notes.md`; lead: `WORKER_GAG.second` 70 → 75 (the take's fade), mission test updated for the streamed songs; sim unchanged 20,380/175; P4a (1 helper: the kit mission on the real layout, the wet De Wallen parts, the gates of the place; brief `tmp/sewers/briefs/p4a-shared.md`) paused by the user ("Pause") before it changed any file, then restarted ("Continue with where you left off", 2026-11-12); P4a done (kit mission `tools/levelkit/missions/sewers/` on the real layout with a kit-side floor that P6 mirrors; the look sample moved to `missions/sewers-look/`, frames byte-equal; `parts_wallen.py`, `checks_sewers.py`; block-out of a passes every gate at tiers 1, 2, 4); P4b done (5 painters, brief `tmp/sewers/briefs/p4b-paint.md`): `sw_a … sw_end.py` (+ `sw_c_lit`, `sw_d_lit`, `sw_e_lit`), every gate passes at tiers 1, 2, 4 for every stack; lead audit and P6 notes `tmp/sewers/p4/lead-audit.md` (the secret fatberg now wells up from a standpipe on the walk plane at 1,200: §2.4's "side-tunnel mouth" could not hold its spot; side tunnels of d on the bay grid 660 / 1,176 / 2,001; c narrower than d); the scenery page is published: https://claude.ai/artifact/QkY3LU3R5URFQs3vrCrVQN version 3 (the same link as the look page; the approved look is its version 2), and a still preview https://claude.ai/artifact/UsSveZq2ynPn7mFCWx3HtW; lead fix: `sw_b.py` church layer id `d26` → `church` (it collided with the bikes' plane on the page); the page text in `work/sewers/site/page.html` is hand-edited (a `page` run rewrites it); P5 figures done (3 helpers; 33 sets in `src/game/content/sewers/art40/`, 216 KB of the 450 KB lazy budget, `tests/art/sewers-art40.test.ts`; skin tones spread, the darkest tone on dealer c and bodyguard b only; the rat eye flash a white star 13 × 7 px); lead: `art40.py` `canonical_out` sends `sewers-*` slugs to that folder and the `--out` engine import is relative only inside the repo (the bake test's fixture stays byte-equal), joint sidecars moved to `tools/art40/joints/`; `npm run art40 -- --all --check` 65/65. Lead check: typecheck clean; full suite 345 files, 6,979 pass, 3 failed → 2 fixed (the art40 bake tool), 1 flaky (`tests/media/browser.test.ts` "a paused song asked again resumes": fails and passes on reruns, timing); sims equal Phase 4 (god 1P 20,380 / 19,528 / 20,857, 2P 18,089, mortal 1P 19,964, 2P 15,428, boss 6,338); ams and rally equal the baseline. **Stop 5**: the pages (stills + figures https://claude.ai/artifact/UsSveZq2ynPn7mFCWx3HtW, scrolling https://claude.ai/artifact/QkY3LU3R5URFQs3vrCrVQN) wait for the user's approval. **Stop 5 approved**: "YEs, I approve. Proceed" (2026-11-12) |
| 6 Port | in progress | 2026-11-12 | P6a done (brief `tmp/sewers/briefs/p6a-engine.md`): the lit pair (`litOf`), the masked lit composite in `CanalView` (`LitMask`, Bayer 4×4 dither), the entity-only light mode with emitters, the layer API in the renderers, `docs/api/canal.md` §12; the lit layers draw at tier 2 at most (`LIT_LAYER_TIER`; memory: both stacks at tier 4 would be 26.4 M px in d, capped 17.4); d ported, fidelity exact both stacks, sims unchanged, other missions byte-equal; light pass 0.217 ms at res 4 (budget 0.2); 4K GPU cost not measurable headless. P6a follow-up done: a lit pair's canal sprites draw like the scenery (`World.drawHook`; the fatberg seam gone); the lit stack (layers + sprites) capped at tier 2 (d peak 17.96 M px); street a and b `scope: 'entities'`, no pass rain or neon (painted), lamps only on painted lamps with `StaticLight.speed` (parallax); e's crack lights on the painted cracks; the light pass while walking 0.26–0.52 ms at res 4 on a loaded machine (Phase 4 0.14–0.32; budget 0.2: NOT met; standing equal). P6b done (brief `tmp/sewers/briefs/p6b-port.md`): a, b, c (+lit), e (+lit), end ported, fidelity exact at tiers 1, 2, 4 for every stack, every section sim equal; Gerrit's flee runs up the painted bridge 2 (draw only); kit fixture-camera changes in `sw_c.py`, `sw_end.py`. Lead: `C_LAMPS` on the shaft plane (x 45.5, speed 0.86), `D_ART` explicit ids, `prewarm` skips painted ids. Notes per section: `tmp/sewers/p4/lead-audit.md`. Lead check (2026-11-13): typecheck clean; full suite 346 files, 7,013 pass, 1 timing failure under load (`tests/art/ams-terrain-hd.test.ts` "a 4× chunk … inside the budget", passes alone 7/7); sims equal Phase 4 (god 1P 20,380 / 19,528 / 20,857, 2P 18,089, mortal 1P 19,964, 2P 15,428, boss 6,338); ams and rally equal the baseline. **Stop 6**: the user plays the finished level on dev 5540. The user's new ending (row 56, 2026-11-13): P6c done (brief `tmp/sewers/briefs/p6c-wagon-ending.md`): the white ROZZERS wagon (`sewers-wagon`, ring art, handbrake turn, a non-playing hero at the wheel, `STAP IN, ZWAAN!` text only, heroes flip in through the windows), the taxi gone from code, kit, bake and audio; the end 561 → 458 ticks, so the full runs move by −103: god 1P seed 1 20,277/175, 2P 17,986, mortal 1P 19,861, boss 6,235 (kills and deaths equal); end fidelity exact; ring wagon frames hash-equal; ams and rally equal. The user's play test (2026-11-13): "The camera doesnt render the environment. It also happens in the sewers" — leading-edge canal tiles came in late; measured cause: on the dev server the art workers' module flood filled the 6 connections per host, so packs waited 1.7–6.6 s; fix (P6a, `store.ts`/`view.ts`/`registry.ts`/`main.ts`): dev packs from the other loopback name, the whole section's tier-1 fallback loaded at section start, 4 reads in flight, black until the first full screen; headless walks and runs at tiers 2 and 4, dev and prod: 0 missing columns; `docs/api/canal.md` §4. Production build OK, headless smoke on the preview (4173) passes with 0 page or console errors |
| 7 Ship | — | | |
Next step: wave P1a (the cast), then P1b (five section builders). Open questions for the user: none.

## 0. Decisions

User decisions are the card's rows 1–55 (`docs/design/sewers/brainstorm.md`, with the user's words); the short
form, by number:

| # | Decision | By |
|---|---|---|
| 1–3 | De Wallen by night, then the sewers, then the rat boss; replaces `oat` (level 2); `oat` is deleted | user |
| 4, 5 | No can collectors; pimps are enemies; sex workers never shown, targeted or joked about | user |
| 6 | The picture: the Rattenjong on his trash throne | user |
| 7–9 | Sleazy neon street, gross-out sewer; Dutch bubbles and generated Dutch voices; no drug use shown; no real names or brands | user |
| 10 | Name RATTENJONG MET DE RATTENITEMS; id `sewers` | user |
| 11 | Bloodless: green slime | user |
| 12 | The Rattenjong is a giant rat king (animal) | user |
| 13, 54, 55 | Flashlights in the dark; always on; battery = 20 s bonus; in the dark rats are red eyes and can be shot; in the cone the whole rat and its tell show | user |
| 14 | Stays: five heroes, weapons, euro budget, delivery riders, fatbike youths; no Swan, no handhavers | user |
| 16–18 | Five sections, no split; the rats come up first; out of a manhole at dawn, a car waits, then the race | user |
| 19–22 | Late October drizzle; a: the limo on a bridge; b: the rat eruption on the square; krul urinals | user |
| 23–29 | Brick vaults; c: the drop down the burst shaft (short in-engine fall, then a horizontal tunnel); e: a hall under a canal; fatbergs, lost things, red eyes; d: the fatberg; grate light + green glow | user |
| 30–33 | Four rat kinds; dealers and pimps all new; mini-boss GOUDEN GERRIT at the limo; boss in 3 phases, the roof breaks | user |
| 34–37 | Hostages tourists + a sewer worker; GOUDEN GERRIT; four songs; ElevenLabs cap 35,000, estimate first | user |
| 38–41 | Six stops; pages for looks, game for play; helpers as the guide says; `oat` deleted in Phase 4 | user |
| 49, 50, 52 | Sewer light V2 BLACK; look approved; grate shafts faint and mostly white | user |
| 53 | New 40 px figures load with the level, own budget 450 KB gzip | user |
| 42–46, 48, 51 | Hours; key colours per section; a taxi waits; Gerrit's chain on the throne; the church backdrop only; the look-sample record; the flashlight art proposal | lead |
| L1 | Section widths, x tables, enemy numbers, euro values, lines: this file | lead |
| L2 | The mission is lazy (loads as its own chunk, as `oat` did) | lead |
| L3 | Before oat is deleted, oat.md §7 (the game-wide budget) moves to `docs/design/budget.md` and every pointer follows | lead |
| L4 | The ending is a sixth, script-only screen `sewers-end` (384 px): the manhole at dawn, the taxi | lead |
| L5 | The flashlight art: a second "lit" canal stack for c, d, e drawn through the cone mask; the light pass darkens entities only (§5.1) | lead |
| L6 | The c fall reuses the parachute intro drop with a new per-section opt-in | lead |
| L7 | The second sewer worker (d) gives the flamethrower `F`: fire breaks the fatberg twice as fast | lead |
| L8 | The golden record hides in a small secret fatberg in a side-tunnel mouth in d | lead |
| 56 | **The ending (Stop 6, 2026-11-13):** not a taxi but the squad's **white ROZZERS wagon** (the ring's white estate, a Volvo 850 likeness without badge) picks the heroes up; a **squad hero who does not play** drives it (2P: also a non-playing hero); the driver's line is a text bubble only, **`STAP IN, ZWAAN!`** (no voice: the heroes are real friends); the wagon reuses the ring's art (1×, 2×, 4×). The taxi, its sign and the taxi driver's two lines go | user ("Yes, that car", "A non-playing hero", "STAP IN, ZWAAN!", "Reuse the ring art") |

## 1. Flow

**oat after P0.** P0 deletes oat, but later waves copy some of its patterns. Every pointer in this file to oat's
code or docs means the tree at commit `eb3316a` (read with `git show eb3316a:<path>`, e.g.
`git show eb3316a:src/game/content/samples/oat.ts`). Builders never restore oat files.

- Route: `FPS_ROUTE = ['ams', 'sewers', RALLY_ID, 'fps-1', 'fps-2', OLDENZAAL_ID]`; `goldenRecordRoute` names
  `sewers` where it named oat; `AMS.next = 'sewers'`; `sewers.next = 'rally'`; `routePredecessor('rally')` is
  `sewers`. `missionLabel` gives `MISSION 2`; the high-score column `M2`.
- Sections: `sewers-a` → `sewers-b` → `sewers-c` → `sewers-d` → `sewers-e` → `sewers-end` → the tally (the
  generic newspaper tally with euros; no receipt) → the MISSION 3 card (`rally`; its line `TAXI PAID. …` no longer fits the wagon ending of row 56: open question for
  the user, a new Gusto take is needed to change it) → the race.
- `MissionDef`: `id 'sewers'`, `name 'RATTENJONG MET DE RATTENITEMS'`, `subtitle 'MISSION 2'`, `start 'sewers-a'`,
  `next 'rally'`, `music 'sewers-street'`, `economy 'euro'`, `audioGroup 'mission:sewers'`, `hostages {
  'sewers-a': 2, 'sewers-b': 1, 'sewers-c': 1, 'sewers-d': 1 }`, `bossSection 'sewers-e'` (`?boss=1` without a
  section starts the Rattenjong arena), `bossSections ['sewers-a', 'sewers-e']` (both count for BOSS SPEED BONUS).
  The mission start in `sewers-a` behaves as every mission's fresh start does today (no new opt-in).
- Lazy, as oat was (`git show eb3316a:` the files below): `CONTENT_MODULES` entry, `isSewersContent`,
  `isLazyContent`, the lazy filters in `scenes/boot.ts`, `sim/headless.ts`, `art-worker.ts` (predicate
  `isSewersSpriteId(id)`: every sprite id of this mission has a path segment starting with `sewers-`, e.g.
  `enemy/sewers-rat-runner/run`, `boss/sewers-rattenjong/throw`, `decor/sewers-grate/burst`), and
  `scenes/mission-intro.ts` (the card waits for the chunk); `scenes/oat-route.ts` becomes `scenes/sewers-route.ts`
  with the same role. `engine/samples.ts` `SAMPLE_GROUPS` and `tools/audio/lib.ts` (`GROUP_DIRS`, `LAZY_GROUPS`)
  name `mission:sewers` instead of `mission:oat`.
- Banners: the section banner helper of oat (`git show eb3316a:src/game/content/missions/oat/helpers.ts`, the
  banner at line 85) with the same style and ticks; P0 copies it into `missions/sewers/helpers.ts`.
- The card (`content/ui/cards.ts`, `SEWERS_CARD`, `label 'MISSION 2'`, the normal line-map look; copy the ams
  card's structure; the map: five dots on one line, labels `WALLEN`, `STEEGJES`, `PUT`, `RIOOL`, `AFVALHAL`): name
  `RATTENJONG MET DE RATTENITEMS`; place `AMSTERDAM, DE WALLEN - 2300 HOURS`; briefing `SHORE LEAVE, NIGHT TWO:
  DE WALLEN IS FULL OF CROOKS.` / `CLEAR THE STREETS. MIND THE DRAINS. GO!`; headline `SQUAD CLEANS UP DE WALLEN!
  THE SEWER IS ANOTHER STORY.`; announce (Dutch voice) `MISSIE TWEE. HOU JE NEUS DICHT!`.
- Section banners: `DE WALLEN - 23:00`, `DE STEEGJES - 01:00`, `DE PUT - 01:30`, `HET RIOOL - 02:30`,
  `DE AFVALHAL - 05:00`, `DAGERAAD - 07:15`.
- Length: about 5 minutes for a good player (ams: 4:30); the god-bot full run *start* 19,000–23,000 ticks.
  Timer 60 counts per checkpoint segment (the game rule); checkpoints at most 1,400 px apart, camera-centre x,
  ascending. 2P everywhere; the in-world continue (gloat, cower, stagger) everywhere.
- URLs: `?mission=sewers`, `section=sewers-a … sewers-end`, `boss=1` (with `section=sewers-a` the Gerrit arena).

## 2. The sections

Walk line y 176, scroll right everywhere, 216 px high, heroes 40 px. Widths *start*.

| Section | Place | Hour | Width | Set piece | Lock(s) | Song | Light |
|---|---|---|---|---|---|---|---|
| `sewers-a` | De Wallen, the quay of the Oudezijds Achterburgwal | 23:00 | 3,072 | GOUDEN GERRIT's limo at the bridge head | 1,664–2,048; 2,688–3,072 (mini-boss) | `sewers-street`; `sewers-gerrit` | neon night, rain |
| `sewers-b` | the alleys, then the square by the old church | 01:00 | 2,560 | the rat eruption | 1,920–2,304 | `sewers-street` | neon night, rain |
| `sewers-c` | the burst drain shaft, the first brick tunnel | 01:30 | 1,920 | the fall; FLASHLIGHTS ON | none | `sewers-sewer` | V2 dark + flashlights |
| `sewers-d` | the sewer tunnels | 02:30 | 2,816 | the fatberg | 2,432–2,816 | `sewers-sewer` | V2 dark + flashlights |
| `sewers-e` | the trash hall under a canal | 05:00 | 1,280 | the trash throne, the flood | 864–1,248 (boss) | `sewers-boss` | V2 dark + flashlights, grey crack light |
| `sewers-end` | a manhole far from the centre | 07:15 | 384 | the dawn, the white wagon | — | `sewers-boss` outro | dawn |

Water and hazards: no kill water in the level (the canal of a lies behind the walk band; the sewer channel lies
behind the near walkway). New mechanics: the flashlight (§5.1), the fall (§5.2), the eruption grates (§5.3), the
fatberg (§5.4), the trash throws and the flood (§4.2).

### 2.1 `sewers-a` DE WALLEN — 23:00, 3,072 px

- Play layout: flat ground at y 176 from 0 to 3,072; no platforms but the limo's roof (§4.1). The floor: the near
  quay is the walk band (cobbles, straight kerb at depth 5, the quay coping behind), the canal behind it, the far
  quay with the house row (the canal look's De Wallen night: `docs/design/canal-look/ref/d-u4.png`, rain added).
  Bridges across the canal in depth (vista, decor only) at 1,280–1,536 and at 2,880–3,008 (the limo's bridge).
- Script (x = trigger at the camera's right edge unless said):

| x | Content |
|---|---|
| 0–640 | walk-in; 2 dealers step out from behind the krul at 300 and the tree at 520 (the dealer lesson: whisper, then the jab); weapon crate `H` at 420 (the first weapon, in the first 20 s) |
| 640–1,280 | the pimp lesson at 900 (one pimp; he whistles one bodyguard in); 3 dealers; a fatbike youth at 1,100; hostage tourist 1 at 1,150 (the stag-party guy in a banana costume, bind `chair`, drop: table); checkpoint 1,200 |
| 1,280–1,536 | bridge 1 (vista); delivery riders both ways (2) |
| 1,536–2,304 | **LOCK 1,664–2,048**: 2 pimps, 2 bodyguards, 3 dealers in two waves; weapon crate `S` at 1,800; after the lock hostage tourist 2 at 2,200 (bind `cage`, drop `pickup-food`); checkpoint 2,300 |
| 2,304–2,688 | a delivery rider; a fatbike pair at 2,500; 2 dealers |
| 2,688–3,072 | **LOCK 2,688–3,072: GOUDEN GERRIT** (`bossStart` 2,700; §4.1); weapon crate at 2,720 (`R`); the limo across the quay at 2,860–2,980; after the fight Gerrit flees across the bridge into depth (cosmetic), unlock; exit → `sewers-b` at 3,040 |

  Checkpoints: 0, 1,200, 2,300, 2,700. Cast: dealer, pimp, bodyguard, delivery rider, fatbike youth, Gerrit.
- Scene: the look sheet's a (neon red and pink on wet blue-black, rain, wet mirrors). Planes: sky, the far roofs,
  the far house row (red tubes only on ground-floor windows, closed curtains), the canal (mirror with rain rings),
  the near quay. Local things: krul urinals (beside the band, at 300 and 2,450), bikes chained to the bridge rails,
  puddles that mirror the neon, a moored boat under a tarp, umbrellas of passers-by (decor in depth only), neon
  words of our own (never BAR, CAFE, LIVE). Moves: rain, canal rings, neon flicker.
- Rules of the place (gates in `checks(sec)`): window figures 0; red-tube pixels above the ground floor 0; no
  lettering from the banned list; krul and furniture off the walk band; the house row tiles (overlap 0 px).
- Entities on scenery: the limo stands on the walk plane at the bridge head (its art: the canal sprite of the limo,
  intact; the wreck is the entity's own art); hostages stand on the quay.
- Owner files: `src/game/content/missions/sewers/section-a.ts`, `content/bosses/sewers-gerrit/` (wave A); the
  street cast `content/sewers/street/` is P1a STREET's; kit `tools/levelkit/missions/sewers/sw_a.py`.

### 2.2 `sewers-b` DE STEEGJES — 01:00, 2,560 px

- Play layout: flat ground at y 176. 0–1,280 the alleys: the far wall 1–1.4 m behind the heroes (back edge y 170),
  cobbles with a central gutter; drain grates in the gutter at 400, 760, 1,120 (decor that rattles). 1,280–1,536 the
  alley mouth. 1,536–2,560 the square (back edge y 150): paving; the church wall with buttresses behind (backdrop
  only); the eruption grates (entities, §5.3) at 1,980, 2,100, 2,220; the big burst grate (the way down) at
  2,384–2,448.
- Script:

| x | Content |
|---|---|
| 0–640 | dealers from doorways (3, one at a time); weapon crate `R` at 600; the gutter grates rattle once each (a hint, no threat) |
| 640–1,280 | a pimp with a bodyguard at 800; hostage tourist 3 at 1,000 (bind `sack`, drop: table); 2 dealers; checkpoint 1,200 |
| 1,280–1,536 | a krul at the alley mouth; a delivery rider crosses the square ahead |
| 1,536–1,920 | the square: a fatbike youth; 2 dealers and a pimp idle on the square (the eruption's victims-to-be) |
| 1,920–2,304 | **LOCK 1,920–2,304: THE RAT ERUPTION** (§5.3): the three grates rattle (60 ticks), burst; the street enemies left alive scream and run off the screen (untargetable from the burst on, no score); runner rats in 3 waves of 5 over about 30 s *start*, a leaper from the middle grate in wave 3; checkpoint 2,000 |
| 2,304–2,560 | after the lock the big grate at 2,384–2,448 is open (rats still pour out of it as decor); the pointer `SPRING!`; the heroes jump in → exit → `sewers-c` (transition `cut`; in 2P the second hero follows within 120 ticks or is carried) |

  Checkpoints: 0, 1,200, 2,000. Cast: dealer, pimp, bodyguard, delivery rider, fatbike youth, runner rat, leaper.
- Scene: alleys colder and darker than a, one warm wall lamp per alley stretch, roller shutters, bins with cans,
  steam from a vent; the square in the same neon with rain. The church is backdrop only (never marked by shots).
- Owner files: `section-b.ts`, `content/sewers/set-pieces/grate.ts`; kit `sw_b.py`.

### 2.3 `sewers-c` DE PUT — 01:30, 1,920 px

- Play layout: flat ground at y 176 (the near walkway). Behind it the channel (depth 16 to about 80, decor), the far
  walkway and the vault wall (the look sample's layout, `tools/levelkit/missions/sewers/layout.json`, widened).
  No ceiling solid (the vault is scenery).
- Script:

| x | Content |
|---|---|
| start | **the fall** (§5.2): every hero drops in from above at x 64 (80 ticks, collisions off); the first screen's back layer shows the shaft (rats on its walls, animated); landing; the banner `FLASHLIGHTS ON` (90 ticks) and the click sfx |
| 0–640 | the flashlight lesson: eyes in pipe mouths; 3 runner rats come out of the dark one at a time (300, 420, 560); weapon crate `H` at 300 |
| 640–1,000 | the leaper lesson: a pipe mouth at 760 (eyes, tell, jump); 2 runner packs of 3 |
| 1,000 | hostage: the sewer worker 1 (orange overalls, tangled in wet wipes, bind `sack`, drop `pickup-battery`; lines §7) |
| 1,000–1,600 | 3 runner packs of 4 (triggers 1,100, 1,300, 1,500); 2 leapers (pipe stubs at 1,200 and 1,450); the spitter lesson on a plinth at 1,400 (§3); checkpoint 900 (before the worker) |
| 1,600–1,920 | a last pack of 3 at 1,750; exit → `sewers-d` at 1,880 (the default exit transition, as ams's); checkpoint 1,700 |

  The eyes in 0–640 are scenery (painted, blinking frames in the far wall's pipe mouths and side tunnel), not
  entities. Banners at the start of c: the section banner `DE PUT - 01:30` on entry (as every section), then
  `FLASHLIGHTS ON` (90 ticks) when the last hero lands (tick 80 of the drop or later).

  Checkpoints: 0, 900, 1,700. Cast: runner, leaper, spitter.
- Scene: the look sample's materials and light (V2 BLACK), narrower than d: one side tunnel, iron rungs, rain
  through the grate above the start, drips, moss. Moves: falling water, drips, blinking eyes.
- Owner files: `section-c.ts`, the flashlight (§5.1: `mission/light/` cone, `isLit`, `pickup-battery`, the HUD
  icon), the fall opt-in (§5.2) (wave C); the rats are P1a RATS's; kit `sw_c.py`.

### 2.4 `sewers-d` HET RIOOL — 02:30, 2,816 px

- Play layout: as c (the look sample is this section): near walkway at y 176, channel, far walkway, vault, side
  tunnels at 640, 1,200, 1,980 (in perspective, decor; the 1,200 mouth holds the secret fatberg).
- Script:

| x | Content |
|---|---|
| 0–896 | runner packs (3 of 4 at 200, 450, 700); 2 spitters on plinths (500/596, 800/896); outfalls pour (decor); lost things float by |
| 896–1,280 | the brute lesson at 1,100 (one brute alone, room to jump); the secret: a small fatberg in the side-tunnel mouth at 1,200 (`sewers-fatberg` small: hp 150 *start*, `reveal` the golden record; it is off the walk band, shootable) ; checkpoint 1,300 |
| 1,280–1,920 | hostage: the sewer worker 2 at 1,700 (bind `float`, drop `pickup-weapon F`); mixed packs (runners, a spitter) |
| 1,920–2,432 | 3 leapers from pipe mouths (2,000, 2,150, 2,300); runner packs; a brute at 2,250; checkpoint 2,300 |
| 2,432–2,816 | **LOCK 2,432–2,816: THE FATBERG** (§5.4) at 2,700; weapon crate `S` at 2,460; at its end the way opens; exit → `sewers-e` at 2,800 |

  Checkpoints: 0, 1,300, 2,300. Cast: runner, leaper, spitter, brute.
- Scene: exactly the approved look sample (V2 BLACK, faint white grate shafts, green water glow); local things:
  fatbergs, lost things (phones, keys, dentures, a selfie stick, a bike), red eyes, outfalls, ladders, the `UIT`
  arrow plate, slime stains, cables, roots, calcite drips. Pipe stubs for leapers at 2,000, 2,150, 2,300 and
  plinths for spitters (above) on the walk plane.
- Owner files: `section-d.ts`, `content/sewers/set-pieces/fatberg.ts` (wave D); the brute is P1a RATS's; kit `sw_d.py`.

### 2.5 `sewers-e` DE AFVALHAL — 05:00, 1,280 px

- Play layout: the near walkway at y 176 runs on; at 832 the hall opens (the vault rises; the walkway widens into
  the hall floor, wet trash and shallow water, ground still y 176). The arena 864–1,248: flat ground; two low trash
  ledges (platforms) at 920–990 y 150 and 1,110–1,180 y 150 *start* (cover from the cart rolls; jump-shoot height
  for phase 1). The throne: the trash mountain at the arena's back (depth ~30, x 1,000–1,200), the Rattenjong on
  its top (his hitbox at y 96–140 *start* in phase 1, reachable by aiming up or diagonally from the ledges).
- Script:

| x | Content |
|---|---|
| 0–832 | the approach: runner packs, a spitter, lost things; weapon crate `H` at 500; checkpoint 600 |
| 864–1,248 | **LOCK: DE RATTENJONG** (`bossStart` 880; §4.2); crate at 900 |
| after | the flood (§4.2), then exit → `sewers-end` (transition `fade`) |

  Checkpoints: 0, 600, 880.
- Scene: a wide brick hall under a canal; the vault cracks and leaks (cold grey light and water from the cracks);
  bikes, scooters, shopping carts and fatbike wheels sink through and pile into the throne; Gerrit's gold chain on
  the throne (gag); green water glow below. Moves: falling trash (frames), leaking water, the pile shifting.
- Owner files: `section-e.ts`, `section-end.ts`, `content/bosses/sewers-rattenjong/`; kit `sw_e.py`, `sw_end.py`.

### 2.6 `sewers-end` DAGERAAD — 07:15, 384 px

Script-only, no enemies, no timer. A quiet street far from the centre after the rain (cold pale pink and blue sky);
a manhole lid lifts, the heroes climb out one by one (slimed: a green tint pass or a slime overlay frame), shake
off; the squad's **white ROZZERS wagon** (row 56: the ring's white estate, its 1×/2×/4× art reused, entity
`sewers-wagon` in `e-kit.ts`) comes in from the right showing its left side, makes the ring's handbrake turn (spin
frames 4 → 0) and stops at the kerb (`SEWERS_END.wagonX` 320, facing right). At the wheel, behind the front door
glass: a **squad hero who does not play** (1P and 2P: picked from the heroes no player plays, by a fork of the
gameplay rng). Driver: `STAP IN, ZWAAN!` (a text bubble, never voiced); 104 ticks later Vincent (or the living P1
hero): `IK RUIK NAAR RIOOL.` (text only). The heroes somersault into the rear windows (P1 the rear door, P2 the
load space; ≤ 7 s, as the c2 cruise boarding) and ride behind the glass; the wagon drives off to the right and
`missionComplete()` follows when it has gone. One wagon takes both heroes in 2P. The `sewers/taxi` sfx (a generic
car pulling up) plays at its arrival and its start. About 460 ticks (sim seed 7: 458).

## 3. Cast

Returning: `delivery-rider` (HP 10, €4) and `fatbike-youth` (HP 20, pair 30, €6/€10) as they are in ams
(`content/locals/`). Every new enemy: our own design, the gloat rule, every attack tell ≥ 18 ticks with a pose and
a sound, standard shots at chest height (22–26 px) so a crouch dodges them; bloodless (rats: green slime). New
ids under `src/game/content/sewers/`; 40 px art through the pipeline into the lazy chunk (§9). HP *start*.

| Id | What it does | HP | Attacks and tells | Speed | € |
|---|---|---|---|---|---|
| `sewers-dealer` | hood up, hands in coat; steps out of a doorway or from behind cover, sidles toward the hero whispering `PSST. VRIEND.`; drops a bag of mints (`NEP!`, a gag pickup worth €0.50) | 10 | tell 20 (looks left and right, opens his coat; whisper) → a short knife jab, reach 20 px; after a miss he backs off 48 px and tries again | 1.2 | 5 |
| `sewers-pimp` | loud suit (purple or white), gold chains, a cane, a wide hat; struts; shouts `HE! MIJN STRAAT!` | 30 | gold pistol: tell 24 (adjusts his hat, cane under the arm) → 3 shots at chest height, 10 ticks apart; once per pimp: tell 30 (two fingers in the mouth, whistle sfx, `JONGENS!`) → one bodyguard runs in from the nearer screen edge | 1.0 | 12 |
| `sewers-bodyguard` | big, black suit, sunglasses, earpiece; walks in, never runs | 40 | tell 24 (cracks his knuckles, plants his feet) → a shoulder charge 72 px at 2.4 px/tick; contact kills; knockback on a whiff into a wall (stunned 40 ticks) | 0.9 | 8 |
| `sewers-rat-runner` | dog-sized; runs along the walkway in packs of 3–6; in the dark only its eyes show | 10 | tell 18 (rears up, squeak; in the dark the eyes flash white) → a bite lunge, reach 14 px | 2.4 | 2 |
| `sewers-rat-leaper` | waits in a side pipe (eyes) or a grate (b). The side pipe is a pipe stub on the walk plane: an outfall riser at the walkway's back edge, mouth at sim y 150 *start*, facing the heroes; the painter paints it at that x (play sits on its art); the waiting eyes draw in its mouth | 10 | tell 24 (eyes flash, hiss) → an arc jump to the hero's x at the tell's start (peak 48 px), one try, then it runs along the walkway as a runner | 2.0 | 3 |
| `sewers-rat-spitter` | sits on a plinth: a one-way platform at y 148, 48 px wide *start*, on the walk plane at the walkway's back edge, painted as a brick plinth (play sits on its art); each spitter has two plinths 96 px apart and hops between them every 3rd spit; fat cheeks; it sits above the chest line: hit it with up or diagonal aim, a jump-shot, or a blast | 20 | tell 24 (cheeks puff up, gurgle) → a slime blob in an arc (lands where the hero stood, splash 16 px, 120 ticks of green puddle that only looks wet: no damage after the splash); every 150 ticks | 0 (hops) | 4 |
| `sewers-rat-brute` | horse-sized, scarred, slow | 120 | tell 30 (paws the ground, snorts steam) → a charge 96 px at 3.0 px/tick (jumpable: its back at 30 px); tell 24 (rears) → a stomp, ground wave 48 px each way (jump it) | 0.8 | 15 |

Defeats: people swoon, lose their hats and sunglasses, crawl off (the game's comedy deaths); rats squeak, flip on
their backs, flatten or run off; no blood anywhere.

Hostages: `tourist` (existing kind; the stag-party guy in a banana costume is a variant of the tourist art; line
`DANK JE, MAN!`; owner P1a STREET); `sewers-worker` (a new kind, owner P1a STREET; the id carries the mission
prefix so the lazy chunk holds it, lead 2026-11-12: orange overalls, helmet with a dead head-lamp, tangled in wipes;
bow; lines `EINDELIJK LICHT!` / `HIER, EEN BATTERIJ!` in c, `PAK DIE PROPPEN AAN!` / `MET VUUR!` in d).

New pickup: `pickup-battery` (§5.1). The golden record (`pickup-gem` kind `golden-record`) in d (L8).

## 4. Bosses

### 4.1 Mini-boss: GOUDEN GERRIT (`sewers-gerrit`, end of `sewers-a`)

Template: `ams-scan-car` (`src/game/content/bosses/ams-scan/`). A long white stretch limo stands across the quay at the
bridge head (2,860–2,980, solid; its roof a platform at y 148 *start*); Gerrit (gold chains, gold teeth, white fur
collar, a gold shotgun) rises out of the sunroof. Intro: `bossIntro('GOUDEN GERRIT', { subtitle: 'MINI-BOSS',
music: 'sewers-gerrit' })`; Gerrit: `GOUD IS GOUD!`.

- Parts: limo body 900 (required), Gerrit in the sunroof 500 (required; he ducks into the car 60 ticks after each
  volley, invulnerable while down). HP × difficulty × co-op as every boss. 10,000 points; €150 (the mini-boss row).
- Phase 1 (both parts > 50 %): Gerrit's shotgun: tell 24 (he pumps it, gold glint) → a 3-pellet spread at chest
  height (one pellet low, one mid, one high: crouch dodges two, jump dodges one; pick one); the back door opens every
  480 ticks: a bodyguard steps out (at most 2 alive).
- Phase 2 (limo ≤ 50 %): the horn (tell 30, the car rocks on its springs) → the limo rolls 64 px toward the heroes
  and back (contact kills; jump onto the roof or step back); Gerrit throws a gold chain (arc lob, tell 24, shootable
  10 HP) between volleys.
- End: the limo breaks (hood flames, doors fall off, `MIJN LIMO!!`); Gerrit jumps out and flees across the bridge
  into depth (cosmetic, untargetable): `DIT IS NIET VOORBIJ!`; his chain stays (it lies on the Rattenjong's throne
  later). Unlock; exit.

### 4.2 Boss: DE RATTENJONG (`sewers-rattenjong`, the `sewers-e` arena)

A giant rat king (an animal: no clothes, no words; a crown made of a bent bicycle wheel and a bottle cap; a tail of
trash knots; red eyes; mange; big yellow teeth). Intro: `bossIntro('DE RATTENJONG', { subtitle: 'KONING VAN HET
RIOOL', music: 'sewers-boss' })`; he screeches (voice: a designed creature sound, no words).

- HP: one pool 4,000 *start* (× difficulty × co-op); 20,000 points; €250 (the boss row). Phases at HP fractions.
- **Phase 1 (100–66 %), on the throne.** He throws trash from the pile (template: oldenzaal's `StatueStone` +
  `StatueBit`, `bosses/oldenzaal/shots.ts`), one throw every 90 ticks *start*:
  - a bike: tell 30 (he lifts it over his head) → a high arc to the hero's x; shootable (24 HP) into 2 bouncing parts;
  - a shopping cart: tell 24 (he shoves it off the pile) → it rolls along the floor at 2.5 px/tick (jump it or stand
    on a ledge);
  - a scooter: tell 24 → a flat throw that bounces twice.
- **Phase 2 (66–33 %), the rats.** He squeaks (tell 40, all eyes in the hall light up) → a wave from the pile: 6
  runners and 1 spitter every 480 ticks *start*; between waves he throws (every 120 ticks); the throne shrinks in
  three steps (the pile art lowers; his hitbox comes down with it).
- **Phase 3 (< 33 %), on foot.** He jumps down into the walk band (tell 40: crouch, the pile shakes): a charge
  across the arena (tell 30: rears and screeches; 3.2 px/tick; jump over his head at 52 px *start* or hide on a
  ledge), a tail sweep (tell 24: the tail rises; low: jump), a bite (tell 20, reach 24). He staggers after each
  charge (60 ticks, the window).
- **End.** His last hit: he staggers back into the pile; the vault cracks above (the canal's bottom) and the water
  comes down (`rising-water`, cosmetic, no kill: it fills the hall floor to y 190 in 120 ticks *start*); the wave
  washes him off down the channel (tumbling, squeaking; bloodless); the heroes hang on the ledges / ladders (an
  input-locked beat ≤ 120 ticks); fade → `sewers-end`.

## 5. Mechanics and set pieces

### 5.1 The flashlight (c, d, e)

Rule (user rows 13, 54, 55): every hero has a flashlight on the gun, always on. The cone follows the aim (8
directions; horizontal aim tilts 5° down). In the dark a rat is only its eyes (and can be shot); in the cone the
whole rat shows; every tell stays readable in the dark (the eyes flash white on every rat tell).

- Numbers *start*: cone length 210 px, half-angle 20°, dithered edge (two 3° bands, the last 35 % of the length
  fades); a soft hero glow r 28 px so every hero is always readable. The cone starts at the gun's muzzle point
  (the point bullets spawn from, also when crouching or jumping) and points along the aim (aim down in a jump
  points it down). Battery (`pickup-battery`): for the hero who picks it up, 1,200 ticks of length 280 px and
  half-angle 28° (a HUD battery icon by that hero's status blinks in the last 120 ticks; owner C, in `hud.ts`); a
  second battery refreshes the time.
- Sim: one pure test `isLit(world, x, y)`: true inside any living hero's cone or glow circle (the union over all
  players; template `src/game/content/creatures/usher-beam.ts` `BEAM`). Rats read it only to choose their art
  state (whole body or eyes only). It never changes a hit, a speed, a timing or an rng draw. Deterministic, no
  allocation.
- Phase 4 (grey): c, d, e use the light pass in its normal mode (darkness 0.6 over everything *start*) with the
  new cone lights (`LightMap.addCone`) and the hero glow, so the grey play already reads dark and lit. Phase 6
  switches these sections to the entity-only mode over the baked ambient and lit stacks (below).
- Art (L5): the darkness is baked. c, d, e are baked twice by the kit: the **ambient** stack (V2 BLACK, the look
  sample's `v2`) and a **lit** stack (`v2l`) with the same layers and geometry. `CanalView` draws the lit back
  layers into one reused view-size buffer, masks it with the union of the heroes' cones (the dithered mask drawn
  into a reused buffer at the tier's resolution), and composites it over the ambient back layers; the same for the
  `over` layers. Entities are drawn normally and then darkened by the light pass in a new entity-only mode
  (`defineSectionLight(id, { darkness: 0.6, scope: 'entities', cones: true, heroLight: 28 })` *start*): darkness
  outside the cones and glows applies to entity pixels only, never to the baked scenery again. Emitters skip it:
  rat eyes, muzzle flashes, slime glow, pickups' glints. A new `LightMap.addCone` serves both the mask and the pass.
  If the lit stack breaks the canal memory budget, the lit stack bakes at tier 2 only (the look sample's proposal B
  fallback); the report says which.
- Gates: (1) a test runs the sims of c, d, e twice with `isLit` forced to always-true and to always-false (a test
  hook, no URL flag) and gets the same ticks, kills and world hash as the normal run; (2) every rat tell shows its
  eye flash in a dark frame (`npm run shot` at a tell); (3) the draw cost stays inside the light pass ≤ 0.2 ms and
  4K render + present ≤ 2 ms per frame (the oat budget, `git show eb3316a:docs/design/oat.md` line 975, and
  `docs/ARCHITECTURE.md` ~line 1005 for the 2 ms).

### 5.2 The fall (start of c)

The parachute intro drop (`player/intro-drop.ts`, 80 ticks, collisions off, hits absorbed) gets a per-section
opt-in `SectionDef.introDrop?: { x, fromY, chute: false }` (engine change; today it runs only on a fresh mission
start). With `chute: false` no `fx/chute` draws and the hero keeps the current weapon (no forced pistol); the pose
is the fall pose of the hero's 40 px set. b's exit into the big grate uses transition `cut`; c starts with the drop
from y −40 to the walkway at x 64 (`introDrop.x` wins over `playerStart.x`; both are 64). The drop runs when c is
entered from b and on a direct start `?section=sewers-c`; not on a respawn or a continue (the normal checkpoint
respawn) and not in a boss rush. The shaft walls with rats are the first screen's canal back layer (frames); no
vertical scroll (user row 27).

### 5.3 The eruption grates (b)

`sewers-grate` (prop): a cast-iron gutter grate in the paving. `rattle()`: 60 ticks of shake and squeaks (tell);
`burst()`: the lid flies up (a cosmetic arc), the hole spawns rats per the script's waves (`ctx.spawn` at the hole,
rising out as oldenzaal's zombies do, `oldenzaal/script-kit.ts`), then pours decor rats for 240 ticks. Template for
rising out of the ground: `infantry/index.ts` manhole entry. Not a hazard.

### 5.4 The fatberg (d, and the small secret one)

`sewers-fatberg` extends `breakable-wall` (`props/breakables.ts`): solid until broken; hp 1,200 *start* (secret:
150); fire (`DamageKind 'fire'`) does double damage (the user's "fire weapons burn it faster"); 4 crack stages at
75/50/25/0 %. At each of the first three stages 4 runners and 1 spitter burst out of its rat holes (the rat holes are
in the art; the spawn points sit on them); at 0 it slumps into a cosmetic slick and the way opens (`wall.broken`).
Its art is the look sample's fatberg (the kit paints the intact look as the entity's canal sprite; the stages are
the entity's frames).

## 6. The look

The look sheet: `docs/design/sewers/look-sheet.md` (filled; the V2 numbers in its Hours line). Method, grammar and
rejected defects: `docs/design/level-guide/look.md`. In short:

- Street (a, b): the canal look's De Wallen night (`canal-look.md` §3.2, ref `d-u4.png`) plus rain: wet mirrors on
  cobbles and the canal, rain streaks (the light pass's `rain`, `streaks`, `water`, flickering neon `groups`, kept
  from oat's work), red tubes on the ground floor only, our own neon words, closed curtains.
- Sewer (c, d, e): V2 BLACK (ambient key dark (2,3,12) light (42,56,98) .93 .30; air (8,12,26)-(40,50,80) .30; water
  glow .90; grate shafts faint cold white, strength .42 crown / .30 manhole). Lit stack: key (26,18,14)-(255,240,214).
  Scale: far wall at s 0.621, 7.4 m to the spring line = 60 px, bays 7.9 m = 64 px, tunnel mouths 5 × 6 m; the near
  walkway coping at depth 16 (y 160). The parts: `tools/levelkit/missions/sewers/parts_sewers.py`.
- e: the same materials, a wider hall, grey crack light from above (cold, desaturated), falling water.
- end: dawn after rain: cold pale pink and blue sky, a quiet street in the canal look's daylight method.
- Deviations from `canal-look.md`: interiors have no sky and no skyline (the skyline gate is replaced by the look
  sample's air measure: back wall ≥ walkway ≥ front planes in darkest tone); the lit stack is a second bake.
- Gates of the look (every section, tiers 1, 2, 4): the kit's gates; the rules of the place of §2; for c–e: closed
  above the walkway (0 unpainted px), every shaft under a painted grate, every eye in a carrier, bays tile (0 px);
  colours per frame ≤ 560 for each stack.

## 7. Sound

- Songs (ElevenLabs, synth fallbacks in `content/music/`): `sewers-street` (a, b: slow sleazy synth-funk, neon
  feel, ~90 BPM), `sewers-gerrit` (the mini-boss: a short funky boss loop), `sewers-sewer` (c, d: dark drones,
  drips, a low pulse), `sewers-boss` (e: heavy and grimy; its outro plays on `sewers-end`).
- Sfx ids (new; P0 creates every id as a synth recipe in `content/sfx/sewers.ts`, builders only use them):
  `sewers/rain-bed`, `sewers/neon-buzz`, `sewers/whistle`, `sewers/gold-pistol`, `sewers/shotgun-pump`,
  `sewers/shotgun`, `sewers/limo-horn`, `sewers/limo-wreck`, `sewers/knife-jab`, `sewers/knuckles`,
  `sewers/grate-rattle`, `sewers/grate-burst`, `sewers/rat-squeak`, `sewers/rat-hiss`, `sewers/rat-bite`,
  `sewers/rat-flip`, `sewers/spit-gurgle`, `sewers/spit-splat`, `sewers/brute-snort`, `sewers/brute-stomp`,
  `sewers/flash-click`, `sewers/battery`, `sewers/fatberg-squelch`, `sewers/fatberg-slump`, `sewers/throw-bike`,
  `sewers/throw-cart`, `sewers/throw-scooter`, `sewers/cart-roll`, `sewers/king-screech`, `sewers/king-squeak`,
  `sewers/hall-crack`, `sewers/flood`, `sewers/drip-bed`, `sewers/manhole-lid`, `sewers/taxi`. Songs: the four ids
  above, synth recipes in `content/music/sewers.ts` (P0).
- Voices (designed Dutch voices, plain standard Dutch): dealer, pimp, Gerrit, the tourist, the sewer worker (the taxi
  driver's voice went with row 56; it stays designed in `voices.json`), the announcer line. Bubbles ≤ 24 characters × 2 lines, no diacritics:
  dealer `PSST. VRIEND.` · `WIL JE IETS?` · pimp `HE! MIJN STRAAT!` · `JONGENS!` · Gerrit `GOUD IS GOUD!` ·
  `MIJN LIMO!!` · `DIT IS NIET VOORBIJ!` · tourist `DANK JE, MAN!` · worker `EINDELIJK LICHT!` · `HIER, EEN BATTERIJ!` ·
  `PAK DIE PROPPEN AAN!` · `MET VUUR!` · hero `IK RUIK NAAR RIOOL.` and the wagon's driver `STAP IN, ZWAAN!` (text bubbles only, row 56) ·
  card `MISSIE TWEE. HOU JE NEUS DICHT!`. The Rattenjong and the rats: creature sounds, no words.
- Pipeline (`docs/api/audio-pipeline.md`): group `mission:sewers` (merges the ams sfx and voices, without the ams
  songs, so the riders' takes play: copy oat's `samples/oat.ts` pattern), `spec.ts` entries, `audio:gen` dry run →
  **the estimate goes to the user** (cap 35,000 credits) → generation only after the OK → process, review, ship to
  `public/audio/sewers/`; lines checked by speech-to-text as oldenzaal's were; a voice-fit test.

## 8. Originality and sensitivity

The dated exception `## Exception: mission sewers` is in `docs/ORIGINALITY.md` (2026-11-12); it replaces oat's when
oat is deleted. In short: real places by typology (De Wallen, the Oudezijds Achterburgwal, the Oudekerksplein, the
sewer as a game liberty); no real names or brands; sex workers never shown, targeted or joked about; no can
collectors; no drug use (whispers, mints); bloodless; behaviours, not groups; the Oude Kerk backdrop only; all
characters our own designs; the Rattenjong an animal; ElevenLabs under the audio rules. Names checked once each
before the build (GOUDEN GERRIT, RATTENJONG as a game boss, the neon words): a real business with a name gets a
new parody. Never a reference game, studio or artist in files, ids, prompts or commits.

## 9. Architecture and files

- New: `src/game/content/missions/sewers/` (`ids.ts`, `index.ts`, `section-{a,b,c,d,e,end}.ts`, `terrain.ts`,
  `floor.ts`, `light.ts`, `canal/` (manifest, registry), `card.ts`, `helpers.ts`); `src/game/content/sewers/`
  (`street/`, `rats/`, `set-pieces/`, `items/battery.ts`); `src/game/content/bosses/sewers-gerrit/`,
  `sewers-rattenjong/`; `content/music/sewers.ts`, `sfx/sewers.ts`, `samples/sewers.ts`; `public/art/sewers/` (the
  canal bake), `public/audio/sewers/`; `tools/levelkit/missions/sewers/` (sections `sw_a … sw_end.py`, parts);
  `docs/api/sewers.md` (Phase 7); `docs/design/budget.md` (oat.md §7 moved, L3).
- Shared files that change, by owner:
  - **P0** owns every file outside `missions/sewers/` that names oat (`grep -rlE "\boat\b|OAT_|oat-|isOat|/oat/"
    src tests tools docs .github`), including: `scenes/flow-data.ts`, `flow.ts`, `ams/index.ts` (`next`),
    `content/index.ts`, `scenes/boot.ts`, `sim/headless.ts`, `art-worker.ts`, `scenes/mission-intro.ts`,
    `content/ui/cards.ts`, `budget/euro-table.ts`, `budget/tax.ts`, `budget/scores.ts`, `engine/samples.ts`,
    `tools/audio/lib.ts`, `tools/audio/spec.ts`, `tools/art40/contract/scope.ts` (text and reader lists: drop
    `missions/oat/index.ts`), `tools/smoke.ts` (`followOat` → `followSewers`), and the tests: `tests/game/fps/flow`,
    `ring/flow`, `scenes`, `rally/contract`, `content/mission-ams`, `content/modules`, `game/mission-light`,
    `game/floor-sections`, `floor-street`, `floor-faces`, `media/browser-floor`, `game/budget/*` (core, pay,
    screens), `tools/audio-spec`, `content/samples`, `art/scenery-hi` (+ its fixture). P0 also pre-creates for
    the later waves: `content/music/sewers.ts`, `content/sfx/sewers.ts`, `content/samples/sewers.ts` (all ids of
    §7 as synth recipes; group `mission:sewers` merges the ams sfx and voices without the ams songs, as
    `git show eb3316a:src/game/content/samples/oat.ts`), `missions/sewers/light.ts` (an entry per section;
    C fills c–e, A and B fill a and b), and the euro rows of every new id of §3 and §4 in `euro-table.ts`.
  - Budget rules tied to oat: `tax.ts` `BLOWVERBOD_SECTION` and its rule are deleted (no handhavers in sewers);
    the two `DEFAULT_BUDGETS` rows with `mission: 'oat'` in `scores.ts` become `mission: 'sewers'` with the same
    values.
  - **C** owns `mission/light/` (`addCone`, the cone lights; the `scope: 'entities'` mode is P6's), the hero cone
    and `isLit`, `player/intro-drop.ts` + `SectionDef.introDrop`, `pickup-battery`, the battery icon in `hud.ts`.
  - **P6 engine helper** owns `canal/view.ts`, `canal/store.ts`, `tools/levelkit/core/bake_game.py` (the lit
    stack) and the entity-only light mode.
  - **Audio** (the lead, after the user's OK) owns the generated files and the spec entries' prompts.
- oat.md pointers (L3): `docs/design/budget.md` is oat.md §7 verbatim with its numbering kept (§7.1 … §7.10), so
  every `docs/design/oat.md §7.x` becomes `docs/design/budget.md §7.x`; every other pointer to oat.md (§1, §3, §8,
  §9 …, in comments and docs) becomes `docs/design/oat.md (deleted; git show eb3316a)`. `docs/api/oat.md`
  pointers the same.
- Deleted (P0, user row 3): the 80 oat-only files (~21,200 lines: `missions/oat/`, `content/oat/`, oat music, sfx,
  samples, `scenes/oat-route.ts`, the oat tests, `docs/design/oat.md` after §7 moved, `docs/api/oat.md`); the
  oat rows of the euro table and the default budgets; oat's ORIGINALITY exception. Kept (generic): the euro
  budget (`src/game/budget/`), `receipt-tally.ts` and `mission/strips/` (unused, harmless), the light-pass
  `groups`/`streaks`/`water`/`rain`, `PAL_HD_OAT` only if another mission imports it (else deleted with oat).
- Budgets: ≤ 300 entities, ≤ 800 particles; `DENSE_BUDGET_BYTES` with `tests/content/sewers-dense-budget.test.ts`;
  the floor ≤ 16 MiB per section; the canal bake inside `docs/api/canal.md`'s numbers per section (the lit stack
  included, or tier-2 lit); the 40 px sets of the mission in their own lazy budget **450 KB gzip**
  (`tests/art/sewers-art40-budget.test.ts`; the shared 1,300 KB stays untouched; user row 53).
- Tests to add: `tests/content/mission-sewers.test.ts` (registers, sections build, spawned ids registered, 1,200-tick
  god scripts, exits, checkpoints ascending and ≤ 1,400 apart, banners), `tests/game/sewers-flow.test.ts` (ams →
  sewers → rally, the card, the route guard, golden records), the dense budget, the 40 px budget, the flashlight
  (sim unchanged with `light=0`; eye flash on tells), the gates of the rules of the place (`checks(sec)` in the
  kit), canal fidelity (`tests/fixtures/canal/sewers/`), the voice fit. Route tests that walk ams → oat → rally move
  to sewers (`tests/game/fps/flow`, `ring/flow`, `scenes`, `rally/contract`, `content/mission-ams`, `modules`).
- Fixtures to regenerate: `tools/levelkit/work/sewers/layout.json` (dump), the scenery-1x fixture if oat's rows
  leave it, the canal fixtures per bake.

## 10. The build

Baseline (2026-11-12, `tmp/sewers/baseline/`): typecheck clean; 348 test files, 7,043 tests pass; ams sims a 20,828/165,
b 24,337/123, c 19,353/83, c1 8,631/38, c2 17,136/59, d 11,520/29, boss 6,403/16, lower 23,185/170, upper
22,933/160, 2P 24,244/173, mortal 20,354/165 (ticks/kills); oat 18,142/62; rally 27,959 (hash 2010710864). The ams
numbers must not change in any wave.

Phase 4 numbers (P2, 2026-11-12; `npm run sim -- --mission sewers … --quiet`, ticks/kills): god 1P seed 1 per
section a 4,379/25, b 2,706/28, c 1,310/28, d 4,620/52, e 6,803/42, end 561/0. Full runs: god 1P seed 1
20,380/175, seed 2 19,528/181, seed 3 20,857/173 (all inside 19,000–23,000); 2P god 18,089/180; mortal 1P
19,964/160 (16 deaths, 5 continues); mortal 2P 15,428/166 (13 deaths); boss rush (`--boss`) 6,338/35. All
COMPLETE, 0 errors. ams and rally sims equal to the baseline (rally 27,959, hash 2010710864).

Every helper: Opus 5.5 at effort high, set explicitly (`docs/LEVEL_GUIDE.md`, "Working with helpers"); briefs in
`tmp/sewers/briefs/`; the lead tells the user the count before each wave.

| Wave | Helpers | Owns | Gates | Stop |
|---|---|---|---|---|
| **P0 route and delete** (Phase 4) | 1 | move oat.md §7 → `docs/design/budget.md` and repoint the references; scaffold `sewers` (lazy, six flat sections, the card, banners); the route swap; delete oat (§9); move the route tests | typecheck; the full suite (fails only where oat tests left, none remain); ams sims equal to the baseline; `npm run sim -- --mission sewers --god --expect-complete` | — |
| **P1a cast** (Phase 4) | 2 in parallel | RATS: the four rats (`content/sewers/rats/`), the eyes-only art state, `isLit` with a stub that always returns true until C replaces it (C owns the real one) · STREET: dealer, pimp, bodyguard (`content/sewers/street/`) | a test arena per enemy (a sim in a flat test section: tells, attacks, deaths, gloat); typecheck | — |
| **P1b play** (Phase 4) | 5 in parallel | A: section a + Gerrit + limo · B: section b + grates + the square · C: section c + the flashlight (`isLit`, cones in the light pass, battery, HUD icon) + the fall · D: section d + fatberg · E: section e + end + the Rattenjong + flood. They use P1a's cast and never edit it (a need goes into the report) | each: its section sims (god, 2P, mortal), its content tests, typecheck | — |
| **P2 integrate** (Phase 4) | 1 | the full runs, both players, mortal, bot contact sheets of every section (read), smoke, the stand-in list, the sim numbers into this file | all of Phase 4's "done when" | **Stop 4**: the user plays it in grey |
| **P3 audio estimate** (with P2) | — (lead) | `audio:gen` dry run | the estimate ≤ 35,000 | the user's OK on credits |
| **P4 paint** (Phase 5) | 1, then 5 | first the shared parts (wet De Wallen parts on the ams kit; the sewer parts exist); then one painter per section a–e (+ end with e) | kit gates at tiers 1, 2, 4; the lead's audit strips | **Stop 5**: the page with every section |
| **P5 figures** (Phase 5, after P4's painters) | 3 | 40 px sets: street people (dealer, pimp, bodyguard, tourist variant, sewer worker), rats (4), bosses (Gerrit + limo, the Rattenjong) | the art40 gates; the lazy 450 KB budget | shown on the Stop 5 page |
| **P6 port** (Phase 6) | 1, then 5 | first the engine helper: the lit stack (bake + `CanalView` mask) and the entity-only light mode; then one porter per section; the audio generation after the OK | fidelity exact at 3 tiers; sims equal to Phase 4's; the canal budgets | **Stop 6**: the user plays the finished level |
| **P7 ship** (Phase 7) | lead | the gates, docs (`docs/api/sewers.md`, the GAME_DESIGN pointer, ARCHITECTURE where a rule changed), the report | all green | commit and push on the user's word |
