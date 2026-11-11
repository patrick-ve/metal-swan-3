# Level 1 in the canal look — port one section to the game (shared brief for the section agents, 2026-11-11)

Read first, in this order:
1. `tmp/l1/port/PORT-BRIEF.md` — the request, the user's decisions (§0), the architecture (§2), the gates (§4).
2. `docs/api/canal.md` — the engine path that exists: the opt-in, the bake, kit sprites for entities (§7–§11), the
   gull shift, the tests. Section a is the worked example (`src/game/content/missions/ams/section-a.ts`,
   `tmp/l1/kit/proof_l1a.py`, `tmp/l1/kit/game_sprites.py`).
3. `tmp/l1/kit/STREET-BRIEF.md` — the street grammar your section's art already follows; `L1-BRIEF.md` and
   `SCALE-BRIEF.md` in the same folder for the kit's rules.

## The goal

`?mission=ams`, your section, at art tiers 1, 2 and 4: the player sees the kit's scenery (the page "Level 1
Repainted" v3 is the approved look), with the game's own figures, enemies, pickups and fx living in it without a
seam: nothing painted twice, nothing floating, nothing in the old look where the kit has a painting for it, every
platform, perch, window, door and counter of the game sitting on its art. Play does not change by one tick.

## What you own

- Your section's kit files in `tmp/l1/kit/`: `l1<id>.py`, `parts_l1<id>.py`, `street_<id>.py` (a street painter
  finished them today; the lead accepted the look: change art only where this brief asks).
- `src/game/content/missions/ams/section-<id>.ts`: the `canal:` opt-in line and nothing else in the script, the
  spawns, the terrain, the entities or the old scenery definitions (`?canal=0` must still draw the old look).
- The generated files of your section (`public/art/ams/<id>-*`, `src/game/content/missions/ams/canal/<id>.gen.ts`,
  `tests/fixtures/canal/*<id>*`): made by the bake only, never by hand.
- A new test file of your own if you need one (`tests/game/canal-<id>.test.ts`).

Shared files (the engine in `src/engine/`, `src/game/mission/`, `src/game/content/missions/ams/canal/index.ts`,
`tmp/l1/kit/level.py`, `parts_ams.py`, `street.py`, `bake_game.py`, `game_sprites.py`, `tmp/l1/dump.ts`, entity
source files, shared tests): four other section agents work beside you. Do not edit them. A need there goes into
your report with the exact change you want; if you are blocked without it, make the smallest additive edit, re-read
the file right before you write, and name it at the top of your report. Never revert or reformat anything; the
tree holds much uncommitted work of other waves. No commit, push, deploy or branch. Do not spawn other agents.

## Steps

1. **Opt in and bake.** Follow `docs/api/canal.md` (the recipe at its end): `GAME_CAMS` in your `l1<id>.py`
   (seven or more integer cameras that together show every set piece and every layer kind of your section, the
   first and the last screen included), the bake at tiers 1, 2 and 4 (one tier-4 build at a time; other agents
   bake too, so a build can be slow or die from memory: wait a minute and run it again), then
   `canal: amsCanal('<id>', …)` in your section file.
2. **Pair the entities with the art.** Shoot the game (below) and list every thing that the game draws as an
   entity or keeps as a script anchor in your section: breakables, stalls, carts, racks, boats, stands, NPC spots,
   hostages, secrets, pickups, perched gulls, window wavers, doors, boss spots. For each one decide and do:
   - the kit also paints it → in a game bake the kit leaves it out (`entity(sec, '<sprite id>', painting, x, depth)`
     in place of `sec.put`), and its painting becomes the entity's sprite, so the entity shows the kit's look.
     The frame box, anchor and frame count must equal the game's (the bake refuses a mismatch): paint into the
     game's box. Frames the kit has no painting for (wrecks, damage) keep their old art; list them.
   - it stands on or in scenery → the art under it is right: a gull's lamp cap at its perch (kerbside lamps:
     `LAMP_GULLS`, or `gullOnLamp(perchY, depth)` for another depth), a waver inside a real window of the facade,
     a hostage's chair on ground, a secret's carrier (a bough, a beam, a hatch) where the secret is, a vendor
     behind his hatch, a counter in front of its baker, a door where the boss steps out.
   - a kit layer covers an entity that must be seen, or an entity covers art it should stand behind → fix the
     layer's depth or its `over` flag in the kit, or skip the layer in the opt-in when an entity draws that thing.
3. **Look.** Headless shots with the canal scene and the 40 px hero:
   `npm run shot -- --mission ams --section <k> --x <x> --ticks 40 --god --char vincent --res 4 --art 4 --out <file>`
   (also `--res 2` and `--res 1 --art 1`; `--canal 0` for the old scenery; `--bot --every 240 --count 12` for a
   contact sheet of a play-through; `--route upper|lower` where the route matters). Shoot ten or more cameras
   across the section at tier 4 and a bot sheet, open every one with the Read tool, put each beside the kit's
   own frame of that camera, and write down every seam: a double, a float, an old-look piece, a wrong order, a
   perch off its lamp, a waver on a wall. Fix and repeat until a full pass finds nothing.
4. **Gates** (PORT-BRIEF §4), for your section:
   - `npx vitest run tests/art/canal-fidelity.test.ts -t "ams <id> "` exact at tiers 1, 2, 4 after your last bake.
   - `npm run sim -- --mission ams --section <k> --seed 7 --god --quiet`: the same ticks and kills as before your
     change (record the "before" number FIRST, before you edit anything; for a route section also the full run
     the brief of your section names).
   - `npm run typecheck` clean; the tests that touch your section pass (`tests/game/canal-*.test.ts`,
     `tests/content/mission-ams.test.ts`, `tests/game/ams-floor*.test.ts`, `tests/game/floor-wave-b.test.ts`,
     `tests/content/ams-dense-budget.test.ts`). Do NOT run the whole suite (five agents share the machine; the
     lead runs it at the end).
   - `--stats` of the tier-4 bake: the resident peak of your section and the size of its files.
5. **Report** (your final message; it goes to the lead, not the user), under 700 words: deviations and shared-file
   edits first; the pairing table (thing → what you did); the seams you found and fixed; what still shows old-look
   art and why; the gate numbers (fidelity, sims before/after, typecheck, tests, resident peak, file sizes); what
   you did not check. Put your final tier-4 shots in `tmp/l1/port/shots/<id>/`.

## Rules that bite

- Play unchanged: you never move, add or remove an entity, a spawn, a hitbox, a platform or a script number.
  `ams2` reuses the `ams` scripts and must not change.
- Scenery only: figures, enemies, pickups and fx keep their art. A crate is a pickup. Vincent is never scaled.
- A sprite id can have one kit painting per section. The same id may get another painting in another section
  (another hour).
- The street grammar still holds for everything you repaint. Amsterdammertjes stand on kerbstones only.
- Never name a reference game in code, ids, comments or docs; write "the arcade reference".
