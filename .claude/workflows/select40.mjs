export const meta = {
  name: 'select40',
  description: 'REPORT FOR DUTY select screen at 40 px (docs/design/select40.md): reference-fidelity miserable caricature portraits of the five friends (grey, colour loop, pick reaction) and the screen furniture at 1x; every agent is Opus 5.5 at high effort and reports its model id',
  whenToUse: 'One run, a third lane beside the ams40 lanes (ports 5571-5579). args: { thorough: true, feedback? }',
  phases: [
    { title: 'Build', detail: 'stage 1 kit + VINCENT, furniture + scene; stage 2 the other four portraits' },
    { title: 'Review', detail: 'two read-only reviewers' },
    { title: 'Verify', detail: 'fixes, thorough tests and the gates' },
  ],
}

// ------------------------------------------------------------------ Opus 5.5 at high effort only
// The ONLY agent() call of this script is inside opus(). Model and effort are set last, so no
// caller can override them; agentType and isolation are removed. Every agent returns model_id; a
// mismatch stops the run after its stage.
const MODEL_ID = 'claude-opus-5-5'
const BAD = []
async function opus(prompt, opts) {
  const o = Object.assign({}, opts)
  delete o.agentType
  delete o.isolation
  o.model = 'opus'
  o.effort = 'high'
  const r = await agent(prompt, o)
  if (r && r.model_id !== MODEL_ID) {
    BAD.push(`${o.label}: ${r.model_id}`)
    return null
  }
  return r
}
function stopped(stage) {
  if (!BAD.length) return false
  log(`STOP after ${stage}: an agent reported another model id (${BAD.join('; ')}). The lead must check its changes.`)
  return true
}

const ROOT = '/Users/everdingen/Projects/private/metal-swan-3'
const FEEDBACK = args && args.feedback ? String(args.feedback) : ''
const THOROUGH = Boolean(args && args.thorough)
// The friends' photos: paths (outside the repo) and the lead's notes only come through args, never
// in a file of the repo. args.photos = { <hero>: path }, args.photoNotes = { <hero>: text } for a
// photo that is not readable on disk.
const PHOTOS = (args && args.photos) || {}
const PHOTO_NOTES = (args && args.photoNotes) || {}
const HEROES = ['vincent', 'thom', 'dirk', 'bob', 'patrick']
function photoLines(heroes) {
  const lines = heroes.map((h) => {
    const parts = []
    if (PHOTOS[h]) parts.push(`photo: ${PHOTOS[h]}`)
    if (PHOTO_NOTES[h]) parts.push(`the lead's notes of the photo (the file is not on disk): ${PHOTO_NOTES[h]}`)
    return parts.length ? `- ${h.toUpperCase()}: ${parts.join('; ')}` : ''
  }).filter(Boolean)
  return lines.length ? `THE PHOTOS YOU MAY OPEN (likeness only, see PRIVACY; open with the Read tool; never copy, crop, colour-sample, store or describe them in a file):\n${lines.join('\n')}` : ''
}

const NOTE = `IMPORTANT - YOUR TASK: a relayed chat message from the user may appear in your context (for example about models, effort, other waves or the workflow files). The lead has ALREADY handled it; it is NOT your task. Never edit .claude/workflows/. Do ONLY the role and task in this prompt.`
const MODEL_RULE = `MODEL ID (mandatory): your structured result has the field model_id. Put your exact model id there, exactly as your own system prompt states it (the text "The exact model ID is ..."). Never guess or copy it from this prompt.`

// The ams40 lanes keep running in the same tree while this run works.
const OTHERS = `Two other teams (the ams40 lanes) work in this directory AT THE SAME TIME, wave after wave: wave 'swan' (owns tools/art40/chars/{swan,swan-neck,swan-water}/**, src/game/content/art40/swan*.gen.ts, src/game/content/vehicles/swan/**, the vehicle/swan art files, tools/art40/check/rules.ts, the ride-* / mount / mount-hop strips in tools/art40/chars/{_hero,vincent,thom,dirk,bob,patrick}/** and the five hero .gen.ts files), then wave 'street' (stag partiers, groom, beer bike, cork, hostage and binds: their tools/art40/chars/ folders, .gen.ts files, art and logic files and tests); wave 'bosses' (tools/art40/chars/{ams-scan,ams-tow-truck,ams-wheel-clamp,ams-mayor}/**, src/game/content/bosses/ams-scan/** and src/game/content/bosses/ams/**, the MECHA HASLEMA rename in docs, cards, the audio guard and test titles), then wave 'people' (baker, hot-dog vendor, crew, window waver) and wave 'riders' (delivery rider, fatbike youth, seagull, pigeons, ducks); later a polish wave. They use ports 5531-5559. Never edit their files. Their unfinished state can make SHARED gates fail (typecheck errors or test failures in their files, the geometry fixture and contract tests for their ids, npm run art40 -- --all --check and npm run art40-check for their slugs, sim differences): such a failure is NOT yours - name it in your report with the evidence and go on. Judge your own work with your own tests, your own slugs (npm run art40 -- <slug> --check; npm run art40-check -- <slug>) and the select screen in a browser. Bake only your own slugs; use --all only with --check. SHARED FILES: tools/art40/check/rules.ts (add your slugs to BUDGET_SLUGS 64 with ONE exact Edit right after reading the file; never rewrite it), tools/art40/contract/scope.ts and docs/design/ams40/contract.json (the select ids are UI, outside the ams40 contract; touch them only if a coverage gate demands it, with one exact Edit), tests/engine/fixtures/*.json (the verifier only: npm run geometry-fixture -- <the ids this run changes>).`

const PRE = `${NOTE}

${MODEL_RULE}

You are one agent in a team working on METAL SWAN 3 - an ORIGINAL browser arcade run-and-gun (TypeScript + Vite, zero runtime dependencies, Canvas 2D, logical 384x216 at 60 Hz, all art made by code). Project root: ${ROOT} - run every command from there.

THIS WORK - the user's request (2026-11-03): "Redesign the player select screen before the first mission starts. Port the graphics fidelity of the reference select sheet and apply it to the players (Vincent, Dirk, Thom, Bob and Patrick). Create the same miserable look for them, laid out as a parody of the photos of the players."
THE PLAN (final, do not re-litigate): ${ROOT}/docs/design/select40.md - read it first. The screen today: src/game/scenes/character-select.ts (REPORT FOR DUTY: five 64x120 panels behind shutters, grey portraits, colour on highlight, confirm flash, shutter drop, preview window), its furniture src/game/content/ui/military.art.ts, the portraits src/game/content/characters/select.art.ts (+ src/game/art/portrait-kit.ts), the tests tests/game/character-select.test.ts and tests/art/squad-portraits.test.ts.${FEEDBACK ? `\nLEAD NOTES: ${FEEDBACK}` : ''}

THE REFERENCE: ${ROOT}/tmp/refs/select-sheet/sheet.png (open it with the Read tool; zoom crops into tmp/<your label>/ are fine). It is a private sheet of a 1990s arcade select screen: a title, P1 / P2 tags, a riveted panel with four doors and nameplates, shutter parts and, on the right, four soldiers in three states (top row: unlit, dark low-key monochrome; middle row: lit, full colour; bottom row: the picked reaction). Use it ONLY for the level of craft: portrait size and framing in the door, the three states, light and shading (strong top-front key light, deep shadow, rim light, specular glints, warm skin ramps, cold steel), palette discipline (ramps, one dark outline, selout), the haggard, sweaty, miserable caricature style and the mechanics of the furniture (rivets, wear, lamps, shutters). NEVER trace, copy or sample colours from it; never put it or any part or derivative of it in src/, public/, docs/, tests/ or tools/; never copy its title text, its tags, its emblem, its door or nameplate designs or its faces; never name the game, its studio or its characters in any file (docs/ORIGINALITY.md). Our screen, our title (REPORT FOR DUTY), our emblem and our five friends stay ours.

THE FRIENDS (their approved look - keep it): the 40 px heroes in the game (tools/art40/chars/_hero/ and chars/<hero>/, sheets tmp/art40/<hero>/sheet.png), the squad spike docs/design/squad40/ (heroes/<name>.py; FROZEN: never edit), and the traits in the header of src/game/content/characters/select.art.ts. Costume as the 40 px hero: VINCENT brown tweed jacket, white shirt, thin maroon tie, dark stubble beard and mustache, wide grin; THOM navy cap worn backwards, Dutch multi-colour camo, huge toothy grin; DIRK plumber with a thick mustache and messy spiky hair; BOB Captain Climate with his flag-like cape, tousled swept-up hair, blue eyes; PATRICK the nerd with slick swept-back black hair, short sides, strong brows, trimmed mustache. The 40 px craft model is the handhaver (tools/art40/chars/handhaver/).
"A PARODY OF THE PHOTOS OF THE PLAYERS": the user sent one photo of each friend for this work (the paths are in the task of the agents that need them). Each portrait parodies HIS photo: the same framing and head angle as far as the 64 x 120 head-and-shoulders window allows, his face shape, hair, brows, eyes, nose, mouth, facial hair and skin tone, and his photo expression turned into the miserable arcade soldier version of it - deep eye bags, strained or bloodshot eyes, sweat beads, heavy shadow, rough stubble, sunken cheeks, the smile gone weary, strained or pained. The friends themselves must recognise each face at once. Clothing: the 40 px hero's costume (the user chose it); where the photo shows the same idea (THOM's backwards navy cap and olive tee, PATRICK's dark collared top), follow the photo's cut; DIRK's hi-vis vest of the photo may show if it fits his plumber costume. Kind and funny, never cruel; no ethnic or body stereotypes.

PRIVACY (the user's rule): the friends' photos are for likeness only - never stored, traced, copied, cropped, colour-sampled or embedded in the repo, in tmp/ or in pages, never described in files (code comments name traits at most, as select.art.ts does today), never sent anywhere. Open only the photos your task lists. tmp/refs/friends/ is empty: never look for other photos.

THE ART40 PIPELINE (reuse it, do not fork it): tools/art40/README.md (the character module API, slugs, budgets, palette variants, events, sheets), the kit tools/art40/kit/, the bake npm run art40 -- <slug> [--check] [--sheet], the check npm run art40-check -- <slug>, the loader src/engine/baked.ts (defineBakedSet; a set's prefix may be shared by several slugs, e.g. boss/ams-scan). New sprites are drawn at 1x only (pixel grid path B): no 2x / 4x / hd art, no dense aliases. The select sets use the 64-colour budget.

TEAM RULES
- Other agents work IN PARALLEL in this directory. Edit ONLY the files you own (your task lists them). Never delete, move or rewrite other agents' files. Need a change in a file you do not own? Put the exact request (file + change) in your report.
- ${OTHERS}
- THE PAUSED OAT WORK: the files in ${ROOT}/tmp/ams40-lead/oat-paths.txt have uncommitted changes from paused work. Never edit, revert, format or delete them. If one of them blocks you, report it and stop on that point.
- tests/engine/fixtures/*.json: builders never edit them (the verifier updates them for ids this run changes on purpose).
- No git commands. No new npm dependencies (Python 3 + Pillow are allowed for offline tools under tools/art40/). Never open .env.local or any key, never call ElevenLabs or any other network service, never generate audio (existing ui sounds only).
- Typecheck covers the whole project (npm run typecheck); files others are still writing may show errors - YOUR files must have zero.
- Tests: iterate with your own files (npx vitest run <files> --maxWorkers=2); run the full suite once at the end (npx vitest run --maxWorkers=3). The machine is loaded (three teams): rerun timed-out files alone before you call a test red. The kick-off baseline is ${ROOT}/tmp/ams40-lead/baseline.json.
- LOOK at your work (mandatory): sheets and zooms as PNG under tmp/<your label>/, opened with the Read tool, judged at real size and zoomed next to the reference sheet (same zoom) and next to today's portraits (before images in tmp/select40-before/). The screen in a browser: npm run smoke -- --port <your port> --query "<params>" (see tools/smoke.ts for how to reach the select screen and take shots).
- Ports: yours is in your task line (5571-5579). 5173, 4173, 5520 and 5531-5559 belong to others: never use them.
- Determinism: no Math.random or Date in art or bakes; same input, same bytes (also with another PYTHONHASHSEED).
- Some local hooks block commands whose text contains 'dist/' or '.log' paths: write outputs under tmp/<label>/ and avoid those patterns.
- Never write the name of a commercial game, studio, artist, celebrity or brand in files. Never name the comedy character VINCENT's outfit is extrapolated from.
- Be economical with tokens: grep, read only what you need, do not re-read large files.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    model_id: { type: 'string' },
    report: { type: 'string', description: 'max 450 words: what you built (files, ids, APIs with signatures), test and gate numbers, what you LOOKED at (paths), known issues, what you did NOT finish (be honest), requests for other owners (exact file + change)' },
  },
  required: ['model_id', 'report'],
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    model_id: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { severity: { type: 'string', enum: ['high', 'medium', 'low'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
        required: ['severity', 'problem', 'evidence', 'fix'],
      },
    },
  },
  required: ['model_id', 'findings'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    model_id: { type: 'string' },
    summary: { type: 'string', description: 'max 250 words' },
    gates: { type: 'array', items: { type: 'object', properties: { gate: { type: 'string' }, result: { type: 'string' } }, required: ['gate', 'result'] } },
    looked: { type: 'array', items: { type: 'string' }, description: 'paths of the sheets and shots you opened' },
    fixed: { type: 'array', items: { type: 'string' } },
    unfinished: { type: 'array', items: { type: 'string' } },
  },
  required: ['model_id', 'summary', 'gates', 'looked', 'fixed', 'unfinished'],
}

// ------------------------------------------------------------------ the portrait contract

const STATES = `THE PORTRAIT CONTRACT (fixed by the lead; the kit, the five hero sets and the scene code all follow it):
- One baked set per hero: slug select-<hero> (vincent, thom, dirk, bob, patrick), prefix char/<hero> (shared with the hero set, as boss/ams-scan is shared), budget 64 colours, 1x only. Strips: select-grey, select, select-pick. Every frame 64 x 120 with a TOP-LEFT anchor (ox 0, oy 0: the panel window), exactly like today's ids, so the panel draws them where it draws them today.
- select-grey: the unlit state, 1 frame (or a 2-frame slow breath, loop). Dark low-key steel-grey monochrome (a cold grey ramp of 6-9 steps from near-black, lit only by a faint rim and the eye whites), the same face and pose as the colour state but heavier, gloomier.
- select: the lit state, a loop of 6-12 frames with long holds (about 2-4 s per cycle): breathing, a blink, a sweat drop running down, a nervous twitch or eye dart; never more than a few pixels of motion; frame 0 is the key pose.
- select-pick: the confirm reaction, played once, 8-14 frames, total time 24-40 ticks: the miserable grimace - eyes bulge or squeeze, teeth clench or the jaw drops, sweat bursts, plus ONE signature gag per hero (VINCENT the raised eyebrow and a smug grin turning into panic; THOM the cap brim jolts and the grin turns to a wince; DIRK the mustache bristles; BOB the cape snaps up behind his shoulders; PATRICK a vein throbs on his brow and one strand of his slick hair falls - or better gags of your own that fit the friend). It ends on a held pose. The scene flashes white at its start and drops the shutter when it ends.
- The face, the light and the framing stay the same across the three strips (one rig), so grey -> colour -> pick reads as one photo coming alive.`

const TESTING = `THOROUGH TESTS (the user, 2026-11-03: "Ensure that the code generated is tested thoroughly"). Add or extend vitest tests for what you build:
- THE SETS: defineBakedSet registers exactly char/<hero>/select, select-grey and select-pick for each hero; 64 x 120 frames with a top-left anchor; frame counts, durations, loop flags and the pick's total time as the portrait contract says; every frame decodes (w*h pixels, palette indices in range, colours within 64); getFrames(id, 2) and getFrames(id, 4) give the 1x frames (no dense art left); deterministic bake (npm run art40 -- <slug> --check).
- THE SCREEN: the sequence with the pick reaction (shutters rise one by one; grey for a panel that is not highlighted, the colour loop for the highlighted one; confirm -> white flash -> select-pick plays once -> the shutter drops when it ends -> the preview shows the 40 px hero idle), 1 and 2 players (a taken soldier cannot be picked), the timer auto-pick, back before a pick, a pad claiming a player; every ui/mil id still registered at 1x; every other screen that uses ui/mil art still draws (no missing sprite).
- Prove each new test can fail: break its input once, see it red, restore it. Name the tests in your report with their counts. The full suite stays green.`

// ------------------------------------------------------------------ areas

const KIT_VINCENT = {
  key: 'select40-kit-vincent',
  port: 5571,
  owns: 'tools/art40/chars/_portrait/** (new shared portrait kit), tools/art40/chars/select-{vincent,thom,dirk,bob,patrick}/** (VINCENT final; the other four as a FIRST PASS only - the stage-2 builders take them over), src/game/content/art40/select-*.gen.ts (generated), src/game/content/characters/select.art.ts (the registration: the five select sets replace the old select / select-grey drawers and their 2x / 4x art; char/<hero>/portrait stays as it is today), src/game/art/portrait-kit.ts (only to delete what nothing uses any more), tests/art/squad-portraits.test.ts and new tests/art40/select-*.test.ts, tools/art40/check/rules.ts (one exact Edit: the select slugs in BUDGET_SLUGS 64)',
  task: `ROLE: STAGE 1 - THE PORTRAIT KIT AND VINCENT.
First (before you change anything): record today's portraits for the before / after review: npx tsx tools/art40/old/dump.ts --out tmp/select40-old char/vincent/select char/thom/select char/dirk/select char/bob/select char/patrick/select (the prefixes also catch select-grey), and save a 1x + 4x sheet of the five old colour and grey portraits as tmp/select40-before/portraits.png.
Then build tools/art40/chars/_portrait/: the bust rig on a 64 x 120 window (head, neck, shoulders, the costume collar and chest, the background of the window - a dark, slightly lit backdrop that reads as a photo booth behind the shutter, our own), the face parts (eyes with bags and strain, brows, nose, mouth shapes from grin to grimace, teeth, stubble, sweat beads and runs, veins, wrinkles), the light (key light top-front, rim light, specular glints on sweat, eyes and teeth), the grey-state derivation (the same pixels through a cold low-key grey ramp, then hand-tuned), the loop and pick timing helpers and a sheet / zoom writer. Then VINCENT complete at the reference's level of craft: select-grey, select (loop), select-pick (with his gag). Then a FIRST PASS of THOM, DIRK, BOB and PATRICK on the kit (likeness, costume, the three strips at a first level) so all five sets bake and register; leave notes per hero in your report (what is rough).
Register the five sets in the game (select.art.ts: defineBakedSet; delete the old select / select-grey drawers and their hi / hi4 art for the five; keep char/<hero>/portrait and anything else the game still uses; the retired heroes and tests that read portrait-kit keep working). The scene builder (parallel) updates character-select.ts to play select-pick; you do NOT edit the scene.
${STATES}
${photoLines(HEROES)}`,
}

const FRAME_SCENE = {
  key: 'select40-frame-scene',
  port: 5572,
  owns: 'src/game/content/ui/military.art.ts (+ a new tools/art40/chars/ui-mil/** set with its .gen.ts if you bake the furniture with the art40 pipeline - recommended), src/game/content/ui/art.ts (the ui/mil registration only), src/game/scenes/character-select.ts, tests/game/character-select.test.ts and new select-screen tests',
  task: `ROLE: STAGE 1 - THE FURNITURE AND THE SCENE.
First (before you change anything): screenshots of today's select screen into tmp/select40-before/ (1P: shutters closed, rising, all open with one highlighted, the confirm flash, the preview after the pick; 2P with both lamps; at --art 1 and --art 4; also a 1x crop of one panel), and list every screen and test that uses ui/mil/* art (grep) in your report.
Then redraw the select screen furniture at 1x with the reference's level of craft, our own design: the rust-brown riveted steel frame (worn paint, scratches, grime streaks, bolt heads with highlights, recessed panels with bevels), the olive shutters with our squad emblem (8+ frames; the rise eases out with a small bounce at the top; the drop has an impact squash, a shake of 1 px and dust puffs), the P1 / P2 lamps (off, on, a blink and a glow halo), the stencil nameplates, the glass preview window (reflection streaks) and the hazard strip; the title REPORT FOR DUTY as a sprayed, chipped stencil (our text and lettering; the other stencil titles of the game keep working). Keep the layout constants of military.art.ts (MIL_PANEL_*, MIL_PREVIEW_*, MIL_HAZARD_Y, MIL_TITLE_RECESS, MIL_BOTTOM_BAND) unless a test-backed reason forces a change. Delete the 2x / 4x / HD drawers of the ids you redraw (1x only); every other screen that uses ui/mil art must still draw.
The scene (character-select.ts): play char/<hero>/select as a loop for the highlighted panel (today a still), select-grey for the others; on confirm: the white flash (FLASH_TICKS) at the start of select-pick, select-pick once, then the shutter drop when the pick strip ends (read its total time from the sprite durations; fall back to today's timing when a hero has no select-pick, e.g. the retired heroes and tests); keep the 2-player rules, the timer, the pads, back, the countdown and the bottom row. The portraits are 1x art now: remove the 2x density special case for the portraits and draw them like any 1x sprite at every art tier. The portrait builder (parallel) bakes the sets; until VINCENT's set exists, test with any hero that has the strips or with hasSprite fallbacks.
${STATES}`,
}

const heroPortrait = (hero, port, gag) => ({
  key: `select40-${hero}`,
  port,
  owns: `tools/art40/chars/select-${hero}/** and src/game/content/art40/select-${hero}.gen.ts (generated), tests/art40/select-${hero}.test.ts. Read-only: tools/art40/chars/_portrait/** (request kit changes from the verifier in your report)`,
  task: `ROLE: STAGE 2 - ${hero.toUpperCase()}'S PORTRAIT. Stage 1 made the portrait kit, VINCENT and a first pass of ${hero.toUpperCase()} (reports above). Bring ${hero.toUpperCase()} to VINCENT's level on all three strips: the likeness of the approved squad look and of today's portrait traits, the costume of the 40 px hero, the miserable parody of a portrait photo, the grey state, the colour loop and the pick reaction with his gag (${gag}). Hero-specific parts, poses and timing live in your folder; do not change the kit. Bake (npm run art40 -- select-${hero} --sheet), LOOK (sheet, 4x zoom next to VINCENT, the reference sheet and his old portrait in tmp/select40-before/), the select screen in a browser with ${hero.toUpperCase()} highlighted and picked.
${STATES}
${photoLines([hero])}`,
})

// ------------------------------------------------------------------ prompts

function builderPrompt(a, earlier) {
  return `${PRE}

YOUR LABEL: ${a.key} (tool output goes to tmp/${a.key}/). YOUR PORT: ${a.port}.
YOU OWN: ${a.owns}
${earlier ? `\nREPORTS OF THE EARLIER STAGE (build on them):\n${earlier}\n` : ''}
${a.task}${THOROUGH ? `\n\n${TESTING}` : ''}

DONE WHEN: everything above is built; your tests pass; typecheck is clean for your files; you LOOKED at your work and judged it next to the reference sheet; the full suite is green (or every failure is explained and owned by someone else or in the baseline). Return the structured result (model_id + report).`
}

function reviewerPrompt(label, port, lens) {
  return `${PRE}

YOUR LABEL: ${label} (tool output goes to tmp/${label}/). YOUR PORT: ${port}. You are a READ-ONLY reviewer: never edit source, test, tool or doc files (writing into tmp/${label}/ is fine).
ROLE: ${lens}
Report only real, verified problems with evidence (file:line, a PNG path you opened, a number, a command and its output). Max 15 findings, most severe first. Return the structured result (model_id + findings).`
}

const reportsOf = (areas, rs) => areas.map((a, i) => `=== ${a.key} === (owns: ${a.owns})\n${rs[i] ? rs[i].report : '(no report - the agent failed or was stopped: check this area yourself and finish what is missing)'}`).join('\n\n')

// ------------------------------------------------------------------ the run

const STAGES = [
  [KIT_VINCENT, FRAME_SCENE],
  [
    heroPortrait('thom', 5573, 'the backwards cap brim jolts, the grin turns into a wince'),
    heroPortrait('dirk', 5574, 'the thick mustache bristles and droops'),
    heroPortrait('bob', 5575, 'the flag-like cape snaps up behind his shoulders'),
    heroPortrait('patrick', 5576, 'a vein throbs on the brow, the slick hair loses one strand'),
  ],
]

phase('Build')
const all = []
const rsAll = []
let halted = false
for (const stage of STAGES) {
  const earlier = all.length ? reportsOf(all, rsAll) : ''
  const rs = await parallel(stage.map((a) => () => opus(builderPrompt(a, earlier), { label: `build:${a.key}`, phase: 'Build', schema: BUILD_SCHEMA })))
  all.push(...stage)
  rsAll.push(...rs)
  if (stopped('Build')) { halted = true; break }
}

let result = { run: 'select40', stopped: BAD }
if (!halted) {
  const reports = reportsOf(all, rsAll)
  phase('Review')
  const LENSES = [
    { key: 'select40-review-craft', ask: 'LIKENESS AND CRAFT LENS. Open every select set sheet (tmp/art40/select-<hero>/sheet.png, GIFs), zoom them next to the reference sheet at the same zoom, next to the old portraits (tmp/select40-before/) and next to each friend\'s 40 px hero (tmp/art40/<hero>/sheet.png) and next to his photo (likeness: would the friend recognise himself at once?). Do the portraits reach the reference\'s level of craft (light, ramps, outline, selout, texture of skin, stubble, hair and cloth, glints), the miserable parody-photo look, and does each friend stay recognisable with his costume? Are the grey state, the loop and the pick reaction good, with each hero\'s gag, and equal in level across the five? Is anything a copy or a trace of the reference (compare silhouettes, faces, door and title designs)? Then the furniture and the whole screen (smoke shots at --art 1 and 4): frame, shutters, lamps, plates, preview, title.' },
    { key: 'select40-review-game', ask: 'GAME, CODE AND TEST LENS. Play the select screen in a browser at --art 1, 2 and 4, 1P and 2P: the shutters, grey vs colour loop on highlight, the confirm flash, the pick reaction, the drop, the preview, the timer auto-pick, back, a pad claiming a player, a taken soldier; 0 console errors; the flow into the first mission. Code: the old select drawers and their 2x / 4x / HD art gone, nothing else broken (retired heroes, other screens with ui/mil art, the HUD portrait), no magic frame numbers, deterministic bakes. Tests: is every point of THOROUGH TESTS covered, and does each new test fail on a mutated input (mutate one per suspect test and run it)?' },
  ]
  const fs = await parallel(LENSES.map((l, i) => () => opus(reviewerPrompt(l.key, 5577 + i, `${l.ask}${i === 0 ? `\n\n${photoLines(HEROES)}` : ''}\n\nBUILDER REPORTS:\n${reports}`), { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS_SCHEMA })))
  if (!stopped('Review')) {
    const findings = fs.filter(Boolean).flatMap((f) => f.findings || [])
    log(`${findings.length} findings from ${fs.filter(Boolean).length} reviewers`)
    phase('Verify')
    const owns = `every file of this run: ${all.map((a) => a.owns).join('; ')}`
    const v = await opus(`${PRE}

YOUR LABEL: select40-verify (tool output goes to tmp/select40-verify/). YOUR PORT: 5579.
ROLE: ADVERSARIAL VERIFIER AND INTEGRATOR of the select screen redesign. The builders and the reviewers are done (below). Assume the builder reports are optimistic. Check each claim and each finding (skip false findings and say why), LOOK at the work yourself (open the sheets and the screen shots), and fix what is wrong or missing.
YOU OWN (for fixes): ${owns}. You alone may run npm run geometry-fixture -- <ids> for ids this run changes on purpose (list every id and why).

BUILDER REPORTS:
${reports}

REVIEW FINDINGS:
${JSON.stringify(findings, null, 1)}

${STATES}
${photoLines(HEROES)}
${THOROUGH ? `
THOROUGH TESTS (the user's demand): check that the builders wrote the tests below, that each one really tests something (break an input once and see it red), and write the missing ones yourself. Run the gates twice: once when you start and once at the end.
${TESTING}
` : ''}
GATES (all must pass at the end, apart from failures owned by the concurrent ams40 waves - name them; compare with ${ROOT}/tmp/ams40-lead/baseline.json): npm run typecheck; npx vitest run --maxWorkers=3 (rerun timeouts alone); npm run art40 -- select-vincent --check (and each select slug); npm run art40-check -- select-vincent select-thom select-dirk select-bob select-patrick (and the furniture slug if any); npx vite build --outDir tmp/select40-verify/out --emptyOutDir; npm run sim -- --mission ams --god --expect-complete; the select screen in a browser on port 5579 at --art 1 and --art 4, 1P and 2P, 0 errors.

FOR THE LEAD'S REVIEW PAGE: write tmp/select40-verify/page/ with: screen-before.png and screen-after.png (the whole screen at 1x, all panels open, one highlighted; the same moment), screen-after-2p.png, pick-sequence.png (VINCENT's highlight -> flash -> pick reaction -> shutter drop as a strip of screen crops), and for each hero <hero>-states.png (grey | colour loop frames | pick frames at 1x and 3x). Plus the size of the new art (gzip of the select .gen.ts files).

HAND-OFF: write ${ROOT}/tmp/select40-report.md (max 600 words): what was built (files, ids, APIs), gate numbers, what you LOOKED at, known issues.

FINAL ANSWER: the structured result (model_id, summary, gates, looked, fixed, unfinished).`, { label: 'verify:select40', phase: 'Verify', schema: VERIFY_SCHEMA })
    result = stopped('Verify') ? { run: 'select40', stopped: BAD } : { run: 'select40', builders: all.map((a, i) => ({ key: a.key, ok: Boolean(rsAll[i]) })), findings: findings.length, verify: v }
  }
}

return result
