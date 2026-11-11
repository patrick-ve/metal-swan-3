# Level guide — from an idea to a shipped level (design, spec, build)

For the lead agent of one new level of Metal Swan 3 and the helpers it briefs: all of them Opus 5.5 at effort
high (`claude-opus-5-5`; "Working with helpers" says how that is set and checked). The user
starts it with the project skill `/new-level`. A level can be any place and any kind of scene. What is fixed is
the way of working, the laws, and the fidelity the user approved on level 1 (`ams`, 2026-11-11: "I like the new
looks! Looks great").

You lead seven phases. Each phase ends at a **stop**: you show the user what the phase made and you go on only
after their approval in their own words. Between stops you work alone and decide details yourself.

| Phase | You make | The stop shows the user | Reference |
|---|---|---|---|
| 1 Brainstorm | the level card: direction, journey, scenes, cast, scope | the card, read back in the chat | `docs/design/level-guide/brainstorm.md` |
| 2 Look | the look sheet and one painted scene | a private page with the scene at 4×, variants side by side | `docs/design/level-guide/look.md` |
| 3 Spec | `docs/design/<id>.md` | the flow, the sections, the cast, the build waves | `docs/design/level-guide/spec-template.md` |
| 4 Play | the mission in grey: layout, scripts, enemies, boss | the running game, without final scenery | `docs/design/level-guide/play.md` |
| 5 Paint | every section's scenery in the paint kit | a private page with every section scrolling | `look.md`, `tools/levelkit/README.md` |
| 6 Port | the scenery baked into the game, entities paired with it | the running game | `docs/api/canal.md` |
| 7 Ship | green gates, the docs, the record | the gate table; then commit and push on the user's word | this file |

Read now: this file, then `brainstorm.md`. Read the other references when their phase starts.

## Laws (every phase, every helper)

Each law is a decision of the user or a defect they rejected. A helper's brief repeats the ones that touch its
work.

1. **The user decides the level; you decide the details.** Direction, place, scene, tone, cast, scope and every
   look choice go to the user with `AskUserQuestion`: concrete options, your recommendation first. A choice you
   make alone is recorded as `lead` and listed at the next stop.
2. **Figures are never enlarged or resampled.** Scenery is scaled to the 40 px hero by the scale rule (`look.md`).
3. **Fidelity never drops.** Three painted tiers (1×, 2×, 4×), judged at 4×. A change keeps the level of detail
   of what it touches. The reference for "enough" is `docs/design/canal-look/ref/` and level 1 in the game.
4. **The grammar of `look.md` holds from the first block-out**: the walk band makes sense, rows tile, solids are
   closed, one perspective, play sits on its art, a rule of a place is a gate.
5. **Play numbers freeze at stop 4.** After the user approved the play, art work changes no terrain, platform,
   hitbox, spawn, script number or sim result.
6. **Original work only** (`docs/ORIGINALITY.md`). Never name a reference game, studio or artist in code, ids,
   comments, docs, prompts or commit messages; write "the arcade reference". Reference photos are for likeness
   only, kept in the git-ignored `tmp/`, never traced, never shipped.
7. **Look, do not assume.** Every frame and strip you or a helper makes is opened with the Read tool. A gate in
   code backs every rule, but a green gate does not replace the look.
8. **One fault, every section.** A fault found anywhere is measured everywhere before it is fixed.
9. **The tree is shared.** Stay on `main`. Never revert, reformat or clean up work you did not make. No commit,
   push or deploy until the user says so in the conversation; then CI must be green (`.github/workflows/pages.yml`).
10. **Every helper is Opus 5.5 at effort high, set explicitly on every spawn.** "Working with helpers" has the
    exact parameters and the check. No other model, no other effort, no inherited default.
11. **Write for the user in their style** (the global writing rules apply to every chat reply and every question).

## Phase 1 — Brainstorm

Follow `brainstorm.md` branch by branch. Nothing of level 1 is a default.

Done when the user approved the level card in their own words, the card is saved as
`docs/design/<id>/brainstorm.md`, and the auto-memory index has one line for the level.
**Stop 1.**

## Phase 2 — Look

1. Fill the look sheet (`look.md`) from the card. For a place the game has never drawn, research it first: what
   its fronts, roofs, ground, plants, vehicles and light look like (web search, the user's photos). Keep sources
   and photos in `tmp/<id>/ref/` with their licences.
2. Paint the look sample: one scene, on the kit's stub layout, with variants where the card left the light open.
3. Publish a private artifact page with the frames and the variants.

Done when the user picked the variant and approved the look, and the look sheet is complete.
**Stop 2.**

## Phase 3 — Spec

Write `docs/design/<id>.md` from `spec-template.md`. Add the dated "Exception" section for this mission to
`docs/ORIGINALITY.md` when the level uses a real place, real-world parody or generated audio. Take the baseline
before any build: `npm run typecheck`, `npm test`, and the sims of the missions next to yours in the campaign,
saved under `tmp/<id>/baseline/`.

Done when the template's "Done when" holds: a fresh helper finds nothing to guess, and the user approved.
**Stop 3.**

## Phase 4 — Play, in grey

Build the mission so that it plays from the first screen to the boss, with the simplest scenery the game
already has. Nobody polishes old-look scenery here: the kit paints the real one in Phase 5.

1. Scaffold the mission (`play.md`, "The shortest mission that boots"). Run it.
2. Lay out each section: terrain, platforms, water, the floor. **Write the floor layout by the grammar from the
   start** (straight borders, squares, bays, furniture off the walk band): the kit paints from these numbers.
3. Script each section: waves, locks, hostages, secrets, pickups, dialogue. Reuse shared content; build what the
   spec lists as new. New figures go through the 40 px pipeline (`tools/art40/README.md`); until their art
   exists they play with a stand-in the report names.
4. Play-test: the sim on every section, the full run on every route, two players, a mortal run; bot contact
   sheets of every section, opened and read; the browser smoke test.
5. Run the app for the user (`play.md`, "Commands") and tell them what is a stand-in.

Helpers: one builder per section and one for the boss, each owning its files, then one integrator who play-tests
and runs the gates. The brief text of earlier mission waves is in `.claude/workflows/mission-wave.mjs`.

Done when every section and route completes in the sim without errors, the content tests pass, `npm run
typecheck` is clean, and the user played it and approved the play. Record the sim numbers (ticks, kills) of
every section and route in the spec: they are the "play unchanged" baseline of all later phases.
**Stop 4.**

## Phase 5 — Paint

The kit paints each section on the game's own layout (`tools/levelkit/README.md`: the dump, the section module,
the checks, the previews, the page export).

1. Dump the layout. Add the mission's folder to the kit (README, "Add a mission"): its hours (key and air tables
   from the look sheet), its shared parts (the place's fronts, furniture, plants), one module per section. Start
   from the look sample's folder: its parts and hours are already approved.
2. Paint the shared parts first, yourself or with one helper, and look at each part alone at tier 1 and 4. The
   section painters build on them.
3. Paint the sections, one helper per section, each from a brief modelled on `briefs/1-paint-section.md` plus the
   grammar. Each helper lists every entity that stands on scenery in its section and paints its carrier.
4. Review every section yourself: the audit strips of the whole section, start to end, and the tier-4 previews.
   Walk it as a person who knows such a place. Send back what makes no sense.
5. Export the page with every section and publish it as a private artifact.

Done when every section passes the kit's gates at tiers 1, 2 and 4, your own full pass over the strips finds
nothing, and the user approved the page. A known failing gate is named to the user with its value, never hidden.
**Stop 5.**

## Phase 6 — Port

The game draws the kit's layer stack from baked image files, pixel for pixel (`docs/api/canal.md`; a section
agent's recipe is at its end; the level 1 briefs are `briefs/4-port-engine.md` and `5-port-section.md`).

1. Register the mission's canal scenes (`tools/levelkit/README.md`, "Add a mission", step 5: a section that does
   not import the mission's `canal/index.ts` never finds its scene) and bake each section at tiers 1, 2 and 4.
2. Opt each section in. Pair every entity with the art (`briefs/5-port-section.md`, step 2): the kit paints the
   intact look of breakables, boats and stands as the entity's sprite; perches, windows, hatches and beams sit
   where the entity is; layer order is right in front of and behind the figures.
3. Shoot the game at ten or more cameras per section at tier 4, and a bot sheet; open every one beside the kit's
   frame of that camera; fix every seam (a double, a float, a wrong order, an old-look piece). Repeat until a
   full pass finds nothing.

Done when, per section: the fidelity test is exact at all three tiers; the sims equal the Phase 4 numbers; the
memory and size numbers of the bake are inside the budgets of `canal.md`; and the user played the level in the
running game and approved it.
**Stop 6.**

## Phase 7 — Ship

1. Gates, all green: `npm run typecheck`; `npm test` (compare with the baseline: a failure that was there before
   is reported to the user, a new one is yours to fix); the sims of every section, route, two players and mortal,
   equal to the Phase 4 numbers; the other missions' frames unchanged where you touched shared code; `npm run
   build`; the smoke test and `npm run cache-check` against the production preview.
2. Docs: the spec's Status table; `docs/api/<id>.md` for what later builders must know; a pointer section in
   `docs/GAME_DESIGN.md`; `docs/ARCHITECTURE.md` where a rule changed.
3. Report to the user: what was built, the gate table, the `lead` decisions, the known limits, what was not
   checked. Then wait.
4. Commit and push only on the user's word. Stage by name; leave local logs and stray files out. After the push,
   watch the CI run to its end and report the deploy.

## Working with helpers

**Spawn every helper as Opus 5.5 at effort high, explicitly.** The user's token budget depends on it: a helper
without these parameters inherits the session's model.

- With the Agent tool, every call passes both parameters: `model: "opus"` and `effort: "high"`, with
  `subagent_type: "general-purpose"`. Never leave one out. Never use `subagent_type: "fork"` (a fork always
  runs on the session's own model) or a custom agent type (it can bring its own model).
- In a Workflow script, every `agent()` call goes through one wrapper that sets `model = 'opus'` and
  `effort = 'high'` last and removes `agentType`, as `opus()` does in `.claude/workflows/ams40.mjs`. Copy it.
- Every brief ends with: "First line of your report: your exact model id." The expected id is
  `claude-opus-5-5`. Read that line first. On any other id: use nothing of that report, stop spawning, and tell
  the user in one line which helper ran on which model.
- You, the lead, are meant to run on Opus 5.5 at effort high too. If your own session is another model, say so
  to the user once, at the start, and let them decide.

A helper knows only its brief. A brief is a file (`tmp/<id>/briefs/<name>.md`) so that several helpers share it
and the next session can read it; the prompt names the file and adds only that helper's section and specifics.
The six briefs of level 1 in `docs/design/level-guide/briefs/` are the pattern. A brief holds:

- **The request**, with the user's own words in quotes, and their decisions.
- **Read first**: the files, in order, with the sections that matter.
- **The cause or the rule**, with the numbers you measured. Never your guess as a fact.
- **What the helper owns** (files it may write) and what is shared and read-only. A need in a shared file goes
  into its report as the exact change wanted.
- **What must still hold**: the laws that touch the work, play unchanged, the things other pieces hang on.
- **Steps**, each ending in something the helper can check, and the **gates** with their commands.
- **The report**: a word limit, deviations first, then results with numbers, the paths of the frames it made,
  and "what I did not check".
- The standing lines: first line of the report is the helper's exact model id; no git commands that change
  state, no other agents, never revert or reformat, one tier-4 build at a time, do not run the whole test suite
  (the lead runs it once at the end).

Spend tokens where they buy fidelity:

- One helper per section for painting and porting, in parallel; do the audit, the review and the integration
  yourself. Do not delegate a check you can run in one command.
- Keep your own context for decisions. Let helpers read the big files and return conclusions. Open a helper's
  final frames (three to six per section), not all its working frames.
- A fix that touches one function is yours. A fix that needs a section's painter back gets a short brief of its
  own (`briefs/6-fix-one-fault.md`).
- Before a wave, tell the user in one line how many helpers it starts.

## Records

- **The spec is the state.** Update its Status table and decisions at every stop, with the date. A later session
  starts from it alone.
- **Decisions** carry who decided (`user` or `lead`) and, for the user, their words.
- **Auto-memory**: one index line per level, and a memory file with the standing rules the user gave during the
  level (a rule of a place, a like, a dislike). Not the task status: that is in the spec.
- **Working files** (briefs, baselines, shots, strips, reference photos) live in the git-ignored `tmp/<id>/`.
  What a later builder needs (the kit modules, the spec, the docs) lives in the repo.
