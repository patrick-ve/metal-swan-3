# Mission ams at 40 px: full animation sets for every character (plan)

Status: **kicked off 2026-11-03** (decisions answered, see "Decisions"). Workflow
`.claude/workflows/ams40.mjs`, one run per wave (`args.wave`). Lead state: `tmp/ams40-lead/state.md`.

Builds on: `docs/design/squad40.md` (the approved 40 px hero look and the five heroes' full sets, spike)
and `docs/design/cast40.md` (one look sample per enemy and character, spike).

## The request (user, 2026-11-03)

Plan generating the full animations for all characters in the first Amsterdam level (mission `ams`),
with the private reference sprite sheet the user supplied earlier as the reference. There must be
1-on-1 fidelity in the **animation design** and the **colour design**, and the current animations must
be **replaced correctly** in the game. When the workflow is kicked off, it may only spawn **Opus 5.5
subagents at high effort**.

## The reference (numbers only)

The sheet is a playable-character sheet of a 1990s arcade run-and-gun game. It is private reference
for frame counts, timing, palette discipline and motion only: it is never committed, never copied or
traced, and never named in files, code, pages or reports (docs/ORIGINALITY.md). A copy for the agents
is in `tmp/refs/run-gun-sheet/` (ignored by git): `sheet.png` and the slices `L0..L7.png`, `R0..R7.png`.

Measured on the sheet (2,343 standing / running / acting figures, 2026-11-03):

| Property | Reference | Our approved spikes today |
|---|---|---|
| Standing height | 40–43 px (at the game's own 304-px-wide view) | hero 42 px on 384×216; people 41–45 |
| Colours per figure (outline included) | median 13, 90 % ≤ 15, max 21 | VINCENT 28; cast samples 10–29, bosses ≤ 34 |
| Outline | one warm near-black, about 2/3 of the edge pixels; the rest is selout | one `K` outline + selout (same idea) |
| Light | upper front; hard ramps; no dithering on figures | same |
| Split | upper body ≈ 29×29 + legs ≈ 21×16, joined at the pelvis | same (squad rig) |

Motion, per action class (frame counts from the sheet; holds in 60 Hz ticks from the approved squad
spike, `docs/design/squad40/anims.py`):

| Action class | Reference frames | Used for (our cast) |
|---|---|---|
| Idle breathing | 4 | every `idle` |
| Idle fidget | 8–18 | `gag-*`, `talk`, `bored`, `fidget-*` |
| Locomotion cycle | 12 (run 12 + 12 torso) | `walk`, `run`, `flee`, `ride` (pedalling), Swan `run` / `move` |
| Crouch walk | 7 | crouched moves |
| Shoot | 10 (flash, recoil, settle) | `fire`, `sit-fire`, hero shoot strips |
| Throw | 6 | `throw`, `toss`, hero grenade |
| Melee | 6 (+ 6 second variant) | `kick`, hero knife |
| Death, shot | 10–12 | `die` |
| Death, blast | 10 | `die-blast` |
| Death, burn | ≈ 7 (+ ash) | `die-burn` |
| Death, crushed | ≈ 5 | `die-crush` |
| Victory, cheer | 6–8 | `cheer`, `clap`, `wave`, `gloat`, `victory` |
| Respawn, get up | 6 | `spawn`, `get-up` |
| Jump, fall, land | 6–7, 2, 3 | jumps, `takeoff`, `land` |
| Mount, hop | 5–6, 5 | `mount`, `mount-hop` |

The sheet has only foot-soldier heroes. For people we use the class of the nearest action. For animals
and machines there is no reference figure: they get the same craft (outline, selout, ramps, palette
budget) and the class rule where an action matches (a bird's flap cycle is a locomotion cycle, a death
is a death). Wheels, scanners and other rigid machine parts keep their mechanical counts (4-step wheels).

## Scope

Every character that mission `ams` shows or spawns (ids from `listSprites`, 2026-11-03):

| Wave | Character | Game ids | Strips | Frames now | Variants |
|---|---|---|---|---|---|
| 1 | handhaver (pilot) | `enemy/handhaver/*`, `enemy/boete-ticket/fly` | 14 + 1 | 61 + 4 | skins b, c (palette) |
| 2 | the five heroes | `char/{vincent,thom,dirk,bob,patrick}/*` | 121 each | 452–467 each | `helium-*`, `helium-wob-*` (derived) |
| 3 | stag partier look 0, look 2, groom | `enemy/stag-partier`, `-2`, `enemy/stag-groom` | 23, 22, 23 | 84, 81, 85 | flash, veil |
| 3 | beer bike, its driver, the cork | `vehicle/beer-bike`, `enemy/stag-beer-bike`, `enemy/cork` | 10, 2, 1 | 33, 6, 4 | |
| 3 | tied tourist (hostage) and its binds | `item/hostage/tourist`, `item/hostage/flash`, `item/bind/*` | 14, 1, 8 | 57, 3, 28 | sack, chair |
| 4 | delivery rider | `enemy/delivery-rider` | 18 | 76 | skins a, c (palette); also used by oat |
| 4 | fatbike youth | `enemy/fatbike-youth`, `-0..3`, `-pair-0..3` | 20 | 91 + 91 (pair) | looks 1–3 (parts), skins a–c (palette) |
| 4 | seagull, pigeons, ducks | `enemy/seagull`, `npc/ams/ams-pigeons`, `npc/ams/ams-ducks` | 19, 2, 2 | 71, 7, 12 | drake, hen |
| 5 | baker, hot-dog vendor, crew 0–2 | `npc/ams/ams-baker`, `-hotdog-vendor`, `-staff/0..2` | 12, 7, 9 × 3 | 42, 20, 96 | crew looks (parts) |
| 5 | window waver and cat | `npc/ams/ams-window-waver` | 4 | 13 | person, cat |
| 6 | scan car with tow truck and wheel clamp | `boss/ams-scan` | 18 | 52 | damage stages 0–2 |
| 6 | robot mayor | `boss/ams-mayor` | 26 | 119 | damage stages 0–2 |
| 7 | the Swan | `vehicle/swan`, `vehicle/swan-mute` (P2) | 89, 86 | 319, 311 | P2 (palette) |

Unique pictures to draw for the cast: about 1,430 frames at today's counts, about 2,000 at the
reference counts. The heroes' sets (about 2,280 frames) exist in the squad spike and are integrated,
with the gaps filled (see wave 2).

Shared ids change everywhere they are used: the heroes, the Swan, the handhaver and the delivery rider
also appear in oldenzaal and oat. That is intended.

**Out of scope:** scenery, tiles, UI and menus (the select panels, portraits); FX ids that are not part
of a character strip (muzzles, explosions, sparks, debris); the background cyclists (not spawned); the
tour boat with painted people; the retired heroes and the stored style trials (`char/vincent-<style>`,
grace, gramps, mittens, pip, recruit); the Swan in socks (m3 only); m0–m5, the ring, the rally, the FPS
mode; characters that only oldenzaal or oat spawn.

## Rules: "replaced correctly" (the strip contract)

Wave 0 extracts the contract of every in-scope id from the code into `docs/design/ams40/contract.json`
(+ a readable `contract.md`): frame count, durations, loop and defer flags, anchor, the point names on
each frame and which code reads them, the frame roles the code reads (gloat phases, throw release,
kick hit, turn frames, damage stages), and the tests that pin the id. The gates check against it.

1. **Same ids.** Every in-scope id keeps its name. No id disappears while code or tests read it.
2. **Anchors.** `feet` stays the ground contact; joined sprites keep `hip` / pelvis; vehicles keep their
   seat and wheel points.
3. **Points.** Every point name the code reads (`muzzle`, `hand`, `hip`, `head`, seats, beak, hooks)
   is on every frame that had it. The values move with the new art.
4. **Logic time stays.** A strip whose length or frames the code reads keeps its total time in ticks
   and its event ticks (release, hit, flash). The frame count under it follows the reference. Code that
   indexes frames reads named constants exported by the bake (for example `THROW_RELEASE`), never
   magic numbers.
5. **No foot sliding.** A locomotion cycle's stride matches the entity's speed: the planted foot drifts
   at most 1 px over a cycle.
6. **Variants by palette or parts.** Skins and P2 are palette swaps of the same pixels. Looks (fatbike
   1–3, stag 0 / 2, crew 0–2) are part swaps on the same animation.
7. **One pixel size for characters.** Replaced ids drop their 2× / 4× generators and dense aliases. Every
   art tier draws the 1× frames, scaled by whole numbers. Memory and preload budgets are measured again
   (they go down).
8. **Old code goes.** The old drawers of replaced ids (including their HD drawers) are deleted once
   nothing reads them. Shared rig code stays while out-of-scope characters still use it.
9. **Gameplay numbers stay.** Hitboxes, speeds, HP, scores and AI timing do not change (decision D7).
10. **Fit with the scenery.** Characters that sit in or at scenery fit it: the waver in its 20×26
    window, the vendor at his stand, the crew behind the counter, the hostage on the chair and in the
    sack, riders on the road, the Swan on the canal. A misfit is fixed in the sprite or in the hook,
    never by scaling.

## Rules: colour design

- **Budget (decision D1, user: "I like the 28 colors").** The approved VINCENT budget: at most 28
  colours plus transparent per figure, one palette per character, shared by all its strips (variants
  swap it). Machines and multi-part figures (beer bike, scan car with tow truck and clamp, the Swan):
  at most 40 per sprite. **The mayor: high fidelity, at most 64** (user: "use more colors and create
  more detail for her"; see "The mayor").
- One warm near-black outline colour for every character; selout on lit edges; light from the upper
  front; hard ramps of 3–5 tones per material, hue-shifted; no dithering, no anti-aliasing against
  transparency, no orphan pixels except highlights and eyes.
- Effects that belong to a strip (flames, soot, splashes, flashes) use the character's palette plus a
  small shared FX ramp.
- The 64-colour 1× palette rule (ART_GUIDE) is replaced for these sprites by the per-character
  palettes. ART_GUIDE gets the new rule.

## Rules: animation design

- Frame counts follow the class table above. A strip may go below its class count only with a logged
  reason (for example a 1-frame held pose that the code holds for 30 ticks).
- One-shots have anticipation (1–2 frames), a fast action (1–3 ticks per frame), follow-through and
  settle (2–3 frames). Loops ease at the turning points. At most 2 smear frames per strip.
- Secondary motion where the reference has it: cloth, hair, straps, the cape, the Swan's neck.
- Hand-drawn rigid parts, IK limbs shaded as cloth tubes with creases (the squad rig), a straight back.
- Smoothness gate (existing helper `tests/art/motion.ts`): no two consecutive frames identical; joint
  travel at most 3 px per displayed tick at 1×, except marked smears.
- Comic, no gore, no blood. Never trace or copy a reference pose.

## Pipeline

- **Authoring (offline, Python 3 + Pillow):** a new `tools/art40/` with production copies of the squad
  rig and the cast kit (`docs/design/squad40` and `docs/design/cast40` stay as frozen records). One
  module folder per character: `tools/art40/chars/<id>/` (parts, palette, poses, strips, timing).
- **Bake:** `npm run art40 -- <id>` renders every strip and writes `src/game/content/art40/<id>.gen.ts`:
  the palette, indexed and run-length-coded pixels, anchors, points, durations, loop flags and the named
  event constants. Generated files are checked in and carry a "do not edit" header. Builds are
  deterministic (two bakes with other hash seeds are byte-identical). `--check` compares without writing.
- **Loader:** `defineBakedSet(prefix, data, { palettes, parts })` in the engine registers the ids; it
  decodes lazily on first `getFrames`, makes palette swaps for variants, and registers no dense art.
  Heroes load with the core content; the cast loads with the ams content modules.
- **Tools:** `npm run art40-check` (coverage, colour, outline, orphan pixels, palette consistency,
  points, event ticks, foot slide, smoothness), contact sheets per character, and a review page
  (old next to new, playback at the real timing, 1× and zoom, line-up next to VINCENT).
- **Size budget:** at most 1300 KB gzip for all baked data (owner decision 2026-11-11: the street and riders sets of waves 3 and 4 taken in as they stand, 1258 KB measured; was 1200 after wave 6, 2026-11-04, before that 500 and 400); the build ships the data once (not in the main and the worker chunk); decode at most 50 ms per mission start.

## Gates (every wave)

1. Coverage: every contract id of the wave has new frames; `spriteErrors()` is empty; no magenta
   placeholder on the ams route at art tiers 1, 2 and 4.
2. `npm run art40-check` green for the wave's ids (colour, motion, contract, foot slide).
3. `tests/engine/fixtures/sprite-geometry.json` changes only for the wave's ids (updated on purpose).
4. Typecheck clean; the full test suite green against the kick-off baseline.
5. Sims complete: ams, ams section d, oldenzaal (and oat when its code is unpaused). Any change is
   explained by a moved point (muzzle, hand); gameplay numbers are the same.
6. Browser: the ams route at 1×, 2× and 4×, 1P and 2P, 0 errors; screenshots looked at.
7. Budgets: bundle size, decode time, 4× memory (expected lower).
8. Originality: no name of a game, studio, artist, celebrity or brand in files; no traced pose.

## Waves

Each wave is one workflow run with at most 9 agents (the session's size guideline), all on Opus 5.5 at
high effort. Inside a run: builders on disjoint files → two read-only reviewers (fidelity: motion and
colour against the reference numbers; contract: code, tests, sims, fit) → one verifier that fixes and
runs the gates. After each run the lead (inline, no extra agents) looks at the sheets, updates the
private review page, records the state in `tmp/ams40-lead/state.md` and takes a snapshot
(`.claude/snapshots/ams40-post-<wave>.tgz`). Commits stage only the wave's paths (never the paused
oat changes) and happen only on the user's "commit"; never a push.

| Wave | Content | Builders | Agents | Stop for the user? |
|---|---|---|---|---|
| 0 found | `tools/art40` (rig copy, bake, `--check`), the loader + tests, the contract extraction, `art40-check`, the review page | 4 | 7 | no |
| 1 pilot | the handhaver end to end (art → bake → game → old drawers and dense art removed → gates); look samples of the new Swan (natural, gun strapped on, VINCENT riding) and of the high-fidelity mayor, as the start of their production modules | 3 | 6 | **yes**: handhaver look, frame counts, in-game feel; the Swan and mayor looks |
| 2 heroes | the five heroes: map the spike's 47 groups to the 121 strips per hero, fill the gaps (salute, the helium sets at the new counts), adapt `src/game/player/*` to the new frame counts with the same logic time | 5 | 8 | no |
| 3 street | stag partier 0 and 2, groom, beer bike with driver and cork, tied tourist with binds | 5 | 8 | no |
| 4 riders and birds | delivery rider, fatbike youth (looks 0–3, pair, skins), seagull, pigeons, ducks | 5 | 8 | no |
| 5 people | baker, hot-dog vendor, crew 0–2, window waver and cat | 3 | 6 | no |
| 6 bosses | scan car with tow truck (1.2× longer) and wheel clamp (damage stages, wreck); MECHA HASLEMA at high fidelity (multi-part rig, damage stages) and the rename | 3 | 6 | no (D4, D5 answered) |
| 7 Swan | the natural Swan with the strapped-on gun (all 89 strips), the P2 palette, the hero ride poses fitted to it | 3 | 6 | no (D3 answered) |
| 8 polish | leftover old code and dense art, budgets, docs (ART_GUIDE, ARCHITECTURE 6.1, docs/api), the full route at all tiers; 3 lenses → 3 fixers on disjoint files → verifier | 6 | 7 | final review |

**Two lanes (user, 2026-11-03).** From wave 2 on, two waves run at the same time on disjoint files:
lane A (ports 5531–5539) runs heroes → Swan (it refits the hero ride poses, so it needs the heroes) →
street; lane B (ports 5551–5559, `args.portOffset: 20`) runs bosses → people → riders. Polish runs
last, after both lanes. A lane-B run gets `args.concurrent` (the other wave's files, ids and ports:
its failures in shared gates are not ours) and `args.done` (the waves that have a report). Never more
than two ams40 lanes: the machine has 10 cores, and every agent runs tests, builds and browsers. One
exception: the select screen redesign (docs/design/select40.md) runs once as a small third lane
(ports 5571–5579) on its own files.

## Agents: Opus 5.5 at high effort only

- Every agent in `ams40.mjs` goes through one helper that sets `{ model: 'opus', effort: 'high' }`
  last, so nothing can override it. No `agentType` (a custom type can bring its own model). No other
  `agent(` call exists in the script; the lead greps for it before each run.
- Every agent returns `model_id` (its exact model id) in its structured result. The script stops the
  run when an id is not `claude-opus-5-5`.
- The lead spawns no agents outside the workflow for this work (checks and reviews between runs are
  done inline).
- Prompts carry the standing note: a relayed chat message from the user may appear in an agent's
  context; the lead has already handled it; never edit `.claude/workflows/`.
- Agents never open `.env.local` or any key, never call ElevenLabs or another network service, never
  run git, and never touch the paused oat changes in the working tree.

## Decisions (user, 2026-11-03)

| # | Question | Answer |
|---|---|---|
| D1 | Colour budget per figure | **28** (the approved VINCENT budget), machines and multi-part figures 40, the mayor 64 (more colours and detail, user request). |
| D2 | Where the gaps in the reference are (animals, machines) | The class rule above. |
| D3 | The Swan: robot restyle or natural swan | **A natural swan with a machine gun strapped on**, ridden like a mount bird (see "The Swan"). |
| D4 | The robot mayor | **Robot, named MECHA HASLEMA**, at high fidelity (see "The mayor"). |
| D5 | The tow truck 1.2× longer | **Yes.** |
| D6 | 1× characters on HD screens while the scenery keeps its dense art | **Later**: the scenery is decided later. Until then the replaced ids draw 1× pixels at every tier (rule 7). |
| D7 | Characters grow from about 37 to about 42 px; hitboxes and gameplay numbers stay | **Fine.** |
| D8 | Run style | **Proceed**: stop after the pilot (wave 1); then waves 2–8. |

**Pilot review (user, 2026-11-03):** the handhaver is right (look, frame counts, motion): it is the
model for every later wave. The Swan keeps the long running legs. Player 2 rides the **black swan**
(`vehicle/swan-mute`: black plumage, red bill, red cloth). The mayor's level of detail is right, and
**her attack animations must clearly improve on today's** (stamp, chain whip and lash, medallion,
wig spin, spring): more in-betweens, anticipation, smears, impact and recoil inside the same
telegraph and hit windows. The same goes for every attack in the scope.

## The Swan (D3)

A natural mute swan, not a machine: white plumage in soft ramps, an orange bill with the black knob,
dark eyes, black webbed feet. She carries the rider like a mount bird: the rider sits on a small
leather saddle at the base of the neck and holds two grips (the squad spike's natural swan,
`docs/design/squad40/ext_ride_swan.py`, is the start). **A machine gun is strapped to her flank**: a
round steel housing (a drum) under the rider's knee, held by two leather belts with buckles around
her body, and a short barrel with a cooling jacket that points forward past her chest. The barrel
pivots on the drum, so the game's 9 aim angles turn the barrel, not the neck; the neck stays free
for the honk, blink, hurt and hiss strips. `muzzle` moves to the barrel tip; the strips keep their
names (rule 1). Running and jumping use her own legs with long strides, wings half raised for
balance; swimming, gliding and flapping stay. Player 2's Swan is the same pixels with a palette swap.
Our design, from the user's idea of a mount bird with a strapped-on gun: never a copy of another
game's mount.

## The mayor (D4)

The boss is renamed **MECHA HASLEMA** (`MAYOR_NAME`, the boss intro card, docs, tests and comments;
the id `ams-mayor` stays; her lines stay text-only, never voiced, and the audio guard blocks the new
name as well). Look: the robot mayor of the cast page (steel robot face with red eye slots, long wave
locks, the chain of office, jacket, heavy robot boots, 173 px) at **high fidelity**: up to 64 colours
plus transparent, and more detail: lit curls in the locks, separate lit links in the chain, a relief
medallion, lapels, buttons, seams and cloth folds on the jacket, panel seams, rivets and specular
highlights on the steel, a glowing gradient in the eye slots, a mouth grille, cables and joints at
the neck and wrists, the stamp arm's pistons and plates. Interior anti-aliasing is allowed for her
(never against transparency). The baker's voiced line that names the real mayor is not changed (no
new voice generation).

## Risks

- **Size change.** Figures grow by about 14 % against unchanged scenery and hitboxes: fit checks in
  every wave; hitboxes stay (D7).
- **Mixed pixel sizes on HD screens** until the whole-game grid decision (D6).
- **Feel.** More frames in shoot, knife and throw must not slow the player: logic time stays (rule 4).
- **Paused oat work.** Its uncommitted changes stay in the working tree. The files do not overlap with
  this wave. A baseline of tests and sims is recorded at kick-off; commits stage only wave paths.
- **Bundle growth** from baked pixels: budget of 400 KB gzip, lazy cast data.
- **Python in the toolchain** (offline only): CI needs no Python because the baked files are checked
  in; `npm run art40 -- --check` runs locally in the gates.

## Kick-off steps

1. The user answers D1–D8 (done 2026-11-03).
2. The lead writes `.claude/workflows/ams40.mjs` from this plan and checks the Opus-only helper.
3. The lead records the baseline (tests, sims, sprite errors, bundle, 4× memory) in
   `tmp/ams40-lead/baseline.json` and a snapshot in `.claude/snapshots/ams40-pre-found.tgz`.
4. Wave 0, then wave 1 (pilot), then stop for the user's review.
