# The play side of a level — map and recipe

Phase 4 of `docs/LEVEL_GUIDE.md`. What a mission is in code, what to create, and what trips a newcomer. Checked
against the code on 2026-11-11; line numbers drift, so find a symbol by name. The full API is in the docs this
file points to; here is only what those docs do not tell you in one place.

## Where things are

| What | Where |
|---|---|
| Types: `MissionDef`, `SectionDef`, `DecorDef`, `ExitDef`, `SectionContext` | `src/game/mission/types.ts`; explained in `docs/api/game.md` §10, recipes in §13 |
| Registry: `defineMission`, `getMission`, `listMissions`, `defineEntity` | `src/game/registry.ts` |
| Terrain builder (`terrain(w,h).ground().at(0,176)…platform/solid/hazard/build`) | `src/engine/terrain.ts`, `docs/api/sim.md` |
| Scripts (a generator that yields ticks or conditions; `ctx.spawn`, `waitCamera`, `lockCamera`, `bossIntro`, `hud.bubble` …) | `src/engine/script.ts`, `docs/api/game.md` §10 |
| The perspective floor (`SectionDef.floor`: art only, the sims never read it) | `src/game/mission/floor/`, `docs/api/floor.md`, `docs/design/floor.md` |
| Shared content to reuse: items, props, locals, vehicles, bosses | `src/game/content/{items,props,locals,vehicles,bosses}`, docs `docs/api/{items,legion,locals,heroes,characters}.md` |
| A mission's own content: breakables, NPCs, secrets, helpers, lines | `src/game/content/missions/<id>/` (compare `ams`, `sewers`, `ams2`) |
| New figures at 40 px (enemies, people, bosses): Python sets baked to `src/game/content/art40/<slug>.gen.ts` | `tools/art40/README.md`, `docs/design/ams40.md` "Pipeline" |
| Songs, sfx, sample groups | `src/game/content/{music,sfx,samples}/<id>.ts`, `docs/api/media.md`, `docs/api/sound-ui.md` |
| The scenery of a section in the game (baked canal scenes, the `canal:` opt-in) | `docs/api/canal.md` |
| A full spec of a mission, for the level of detail | `docs/design/sewers.md` |
| How a mission wave was briefed to builder agents before | `.claude/workflows/mission-wave.mjs` (the `PRE` text and the mission task) |

## The shortest mission that boots (stand-alone and lazy, as `ams2` is)

1. `src/game/content/missions/<id>/ids.ts`: pure data, the mission id and the section ids.
2. `…/<id>/section-a.ts`: one flat section (copy `placeholderSection` from `src/game/mission/runner.ts`); its
   script ends with `yield ctx.missionComplete()`.
3. `…/<id>/index.ts`: `{ id, name, music, start, sections, standalone: true, hostages: {} }` → `defineMission`.
4. `src/game/content/index.ts`: the manifest entry in `CONTENT_MODULES`, an `is<Id>Content` predicate, and that
   predicate in `isLazyContent`.
5. The hand-written lazy filters: `src/game/scenes/boot.ts`, `src/sim/headless.ts`, and `src/game/art-worker.ts`
   only when the worker must draw the mission's dense sprites.
6. `tests/content/mission-<id>.test.ts`: the mission registers, every section builds, every spawned id is
   registered, each script runs 1,200 ticks in god mode without errors, exits lead where the spec says.
7. Gates: `npm run typecheck`, the content tests, `npm run sim -- --mission <id> --god --expect-complete`.

A mission in the campaign also needs: `CAMPAIGN_MISSIONS`, `FPS_ROUTE` and `missionLabel` in
`src/game/scenes/flow-data.ts`, `missionDone` / `routeAllows` in `flow.ts`, a card in
`src/game/content/ui/cards.ts`, euro values in `src/game/budget/euro-table.ts` (ids not in it score points),
`REPAIR_DROP_MISSIONS` in `content/items/drops.ts`, and the route of `tools/smoke.ts`.

## Commands

| For | Command |
|---|---|
| A sim from one section on (it runs on through the exits; read `sectionsVisited`) | `npm run sim -- --mission <id> --section <k> --seed 7 --god --quiet` |
| A full run; both routes; two players; mortal | `npm run sim -- --mission <id> --seed 1 --god --expect-complete --quiet`; add `--route upper`; `--players 2`; drop `--god` |
| A frame at a player x | `npm run shot -- --mission <id> --section <k> --x <x> --ticks 40 --god --char vincent --res 4 --art 4 --out <file>` (also `--res 2`, `--res 1 --art 1`, `--canal 0` for the scenery without the canal scene) |
| A contact sheet of a play-through | add `--bot --every 240 --count 12` |
| The browser smoke test | `npm run smoke -- --url http://127.0.0.1:4173/ --query "mission=<id>&god=1"` |
| Dev server; production preview | `npm run dev`; `npm run build && npm run preview -- --port 4173 --host 127.0.0.1 --strictPort` (the page asks for the password `6767`) |
| What CI runs on a push to `main` | `.github/workflows/pages.yml`: `npm test`, `npm run build`, smoke, `npm run cache-check`, deploy |

## Rules that bind a level builder

- **Deterministic sim.** No `Math.random`, `Date`, `performance` or DOM in `src/engine` and `src/game` outside
  `*.browser.ts`. `world.rng` for play, `world.fxRng` for looks. 60 Hz; speeds in px per tick, times in ticks.
- **Budgets.** At most 300 entities and 800 particles; no per-tick allocations; the dense art of a mission inside
  `DENSE_BUDGET_BYTES` (a `tests/content/<id>-dense-budget.test.ts` of its own); the floor at most 16 MiB per
  section; all baked 40 px data inside the gzip budget of `tests/art/art40-gates.test.ts`.
- **Ids.** kebab-case; sprites `<category>/<entity>/<anim>`; section ids carry the mission prefix (`xyz-a`).
- **Pacing** (`docs/GAME_DESIGN.md` §1.4, §1.5, §4.7, §11.0): read them for the numbers before you lay out waves
  (length, a new threat every few seconds, the share of camera locks, checkpoint spacing, the timer, the first
  weapon, the hidden hostage). The level card's length wins where it differs.
- **Text.** Speech bubbles and voiced lines: plain standard Dutch without diacritics, at most 24 characters × 2
  lines. Cards and HUD words: English.
- **Originality** (`docs/ORIGINALITY.md`, read "Not allowed" and the self-check): genre mechanics only; all art
  from project code, nothing traced, no reference photo in `src/`, `public/` or `docs/`; new music, designed
  voices; real places only as parody, no real shop names, logos or emblems; bloodless, children and animals are
  never hurt. A mission in a real place gets its own dated "Exception" section there before the build.

## What trips a newcomer

1. `listMissions()` sorts by name and `nextMission()` follows that order: give a new mission `standalone: true`
   or an explicit `next`, or a campaign test breaks.
2. A lazy mission is invisible to the tests that walk the boot set (`tests/content/modules.test.ts`, the floor
   gates, the scenery fixture): add your mission's own tests for the same things.
3. Bare section ids (`a`) collide in the global light and floor maps. Level 1 has them for history; a new
   mission never does.
4. A wrong `?mission=` boots a placeholder mission with no error: check the banner before you trust a frame.
5. Checkpoints are camera-centre x values in ascending order.
6. `DecorDef` has `depth`, not `floorDepth` or `box`: those two exist only in the kit's layout dump.
7. Some mission docs still state older numbers (budgets, section naming): the tests hold the current ones.
8. A direct link without `char=` starts the old test hero `recruit`, not a squad hero. Every link you give the
   user carries `&char=vincent` (or `thom`, `dirk`, `bob`, `patrick`), and every shot `--char vincent`.
