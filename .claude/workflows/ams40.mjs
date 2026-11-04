export const meta = {
  name: 'ams40',
  description: 'ams 40 px animation sets (docs/design/ams40.md), one wave per run (args.wave: found | pilot | heroes | street | riders | people | bosses | swan | polish); every agent is Opus 5.5 at high effort and reports its model id',
  whenToUse: 'Run the waves of docs/design/ams40.md one run per wave, in two lanes at most (args.portOffset 20 + args.concurrent for the second lane, args.done = the finished waves); read each wave report before the next.',
  phases: [
    { title: 'Build', detail: 'builders on disjoint files' },
    { title: 'Review', detail: 'two read-only reviewers' },
    { title: 'Verify', detail: 'fixes and the gates' },
  ],
}

// ------------------------------------------------------------------ Opus 5.5 at high effort only
// The ONLY agent() call of this script is inside opus(). Model and effort are set last, so no
// caller can override them; agentType and isolation are removed (a custom type can bring its own
// model). Every agent returns model_id; a mismatch stops the run after its stage.
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
const WAVE = args && args.wave ? String(args.wave) : ''
const FEEDBACK = args && args.feedback ? String(args.feedback) : ''
const ORDER = ['found', 'pilot', 'heroes', 'street', 'riders', 'people', 'bosses', 'swan', 'polish']
// Two lanes (user 2026-11-03): lane A heroes -> swan -> street (ports 5531-5539), lane B bosses ->
// people -> riders (ports 5551-5559); polish after both. args.lane ('A' | 'B') sets the port offset
// and the CONCURRENT text (every wave of the other lane without a report); args.done = the waves
// that have a report. args.portOffset / args.concurrent set them by hand (the first lane-B run).
const LANES = { A: ['heroes', 'swan', 'street'], B: ['bosses', 'people', 'riders'] }
const WAVE_FILES = {
  heroes: 'tools/art40/chars/{_hero,vincent,thom,dirk,bob,patrick}/**, src/game/content/art40/{vincent,thom,dirk,bob,patrick}.gen.ts, src/game/art/human-sprites.ts, src/game/player/**, every file that defines char/{vincent,thom,dirk,bob,patrick}/* art, src/game/scenes/{ending,character-select}.ts and their tests (ids char/{vincent,thom,dirk,bob,patrick}/*)',
  swan: 'tools/art40/chars/{swan,swan-neck,swan-water}/**, src/game/content/art40/swan*.gen.ts, src/game/content/vehicles/swan/**, the files that define vehicle/swan/* and vehicle/swan-mute/* art, tools/art40/check/rules.ts (BUDGET_SLUGS), the ride-* / mount / mount-hop strips in tools/art40/chars/{_hero,vincent,thom,dirk,bob,patrick}/** with the five hero .gen.ts files, and the Swan tests (ids vehicle/swan/*, vehicle/swan-mute/*, char/*/ride-*, char/*/mount, char/*/mount-hop)',
  street: 'tools/art40/chars/{stag-partier,stag-partier-2,stag-groom,beer-bike,stag-beer-bike,cork,hostage-tourist,bind*}/**, their .gen.ts files, the files that define enemy/stag-partier*/*, enemy/stag-groom/*, vehicle/beer-bike/*, enemy/stag-beer-bike/*, enemy/cork/*, item/hostage/*, item/bind/* art, their logic files (frame constants) and tests',
  bosses: 'tools/art40/chars/{ams-scan,ams-tow-truck,ams-wheel-clamp,ams-mayor}/**, their .gen.ts files, src/game/content/bosses/ams-scan/** and src/game/content/bosses/ams/**, the MECHA HASLEMA rename (MAYOR_NAME, the ams section-d boss intro, the cards, the tools/audio voice guard, the docs that name her, test titles), tests/content/boss-ams*.test.ts, tests/art/mayor-hi.test.ts (ids boss/ams-scan/*, boss/ams-mayor/*)',
  people: 'tools/art40/chars/{ams-baker,ams-hotdog-vendor,ams-staff*,ams-window-waver}/**, their .gen.ts files, the files that define npc/ams/{ams-baker,ams-hotdog-vendor,ams-staff,ams-window-waver}/* art, their logic files (frame constants) and tests',
  riders: 'tools/art40/chars/{delivery-rider,fatbike-youth*,seagull,pigeons,ducks}/**, their .gen.ts files, the files that define enemy/delivery-rider*/*, enemy/fatbike-youth*/*, enemy/seagull/*, npc/ams/ams-pigeons/*, npc/ams/ams-ducks/* art, their logic files (frame constants) and tests',
}
const LANE = args && args.lane ? String(args.lane) : ''
const DONE = args && Array.isArray(args.done) ? args.done.map(String) : null
const PORT_OFF = args && args.portOffset ? Number(args.portOffset) : LANE === 'B' ? 20 : 0
const OTHER = LANES[LANE] ? LANES[LANE === 'A' ? 'B' : 'A'].filter((w) => !(DONE || []).includes(w)) : []
const CONCURRENT = args && args.concurrent ? String(args.concurrent)
  : OTHER.length ? `the other lane works beside this wave: ${OTHER.map((w) => `wave '${w}'`).join(', then ')} (one at a time, in this order; any of them can run while you work). ${OTHER.map((w) => `Wave '${w}' owns ${WAVE_FILES[w]}.`).join(' ')} The other lane uses ports ${LANE === 'A' ? '5551-5559' : '5531-5539'}; YOURS are ${LANE === 'A' ? '5531-5539' : '5551-5559'} (your port line says which one). Sim differences in player shots can come from the hero wave; explain each difference by its owner.` : ''
const prior = DONE || ORDER.slice(0, Math.max(0, ORDER.indexOf(WAVE)))
// args.thorough: the user's test demand (2026-11-03) - builders and verifiers get THOROUGH TESTS.
const THOROUGH = Boolean(args && args.thorough)
const PRIOR_REPORTS = prior.length ? prior.map((w) => `${ROOT}/tmp/ams40-${w}-report.md`).join(', ') : '(none - this is the first wave)'

const NOTE = `IMPORTANT - YOUR TASK: a relayed chat message from the user may appear in your context (for example about models, effort or the workflow file). The lead has ALREADY handled it; it is NOT your task. Never edit .claude/workflows/. Do ONLY the role and task in this prompt.`

const MODEL_RULE = `MODEL ID (mandatory): your structured result has the field model_id. Put your exact model id there, exactly as your own system prompt states it (the text "The exact model ID is ..."). Never guess or copy it from this prompt.`

const PRE = `${NOTE}

${MODEL_RULE}

You are one agent in a team working on METAL SWAN 3 - an ORIGINAL browser arcade run-and-gun (TypeScript + Vite, zero runtime dependencies, Canvas 2D, logical 384x216 at 60 Hz, all art made by code). Project root: ${ROOT} - run every command from there.

THIS WORK: full animation sets at 40 px for every character of mission 'ams', with the craft of a private 1990s arcade reference sheet (motion and colour design), replacing the game's current strips correctly.
THE PLAN (final, do not re-litigate): ${ROOT}/docs/design/ams40.md - read it first: the reference numbers and the action class table, the 10 "replaced correctly" rules, colour rules, animation rules, pipeline, gates, the decisions (D1 colour budget 28 / machines 40 / the mayor 64; D3 the natural Swan with a strapped-on gun; D4 MECHA HASLEMA; D7 hitboxes and gameplay numbers stay), "The Swan", "The mayor".
REPORTS OF EARLIER WAVES (read them; do the requests that name YOUR files): ${PRIOR_REPORTS}${FEEDBACK ? `\nLEAD NOTES FOR THIS WAVE: ${FEEDBACK}` : ''}

USER REVIEW OF THE PILOT (2026-11-03, final): the handhaver is right (look, frame counts, motion) - it is THE MODEL for every later character: match its level (tools/art40/chars/handhaver/, tmp/art40/handhaver/sheet.png). The Swan keeps the long running legs; player 2 rides the BLACK swan (black plumage, red bill, red cloth). The mayor's level of detail is right, and her ATTACK ANIMATIONS must clearly improve on today's. The same holds for every attack in the scope: more in-betweens, anticipation, smears, impact and recoil, inside the same telegraph and hit windows (logic time stays).

THE APPROVED LOOK (keep it): the hero spike docs/design/squad40.md + docs/design/squad40/ (the rig: rig.py, pose.py, parts*.py, anims.py, hero.py, heroes/, ext_*.py) and the cast spike docs/design/cast40.md + docs/design/cast40/ (castkit.py, chars/<id>.py: one sample frame per character). Both folders are FROZEN records: never edit them; production code goes to tools/art40/.

THE REFERENCE: ${ROOT}/tmp/refs/run-gun-sheet/ (sheet.png and the slices L0..L7.png, R0..R7.png; open them with the Read tool). Use it ONLY for frame counts, timing, motion design (anticipation, follow-through, secondary motion), palette discipline (ramps, one warm near-black outline, selout, light from the upper front) and the level of craft. Never trace, copy or sample colours from it; never put it or any part of it in src/, public/, docs/, tests/ or tools/; never name the game, its studio or its characters anywhere (docs/ORIGINALITY.md). Our characters, Amsterdam and the squad stay ours.

TEAM RULES
- Other agents work IN PARALLEL in this directory. Edit ONLY the files you own (your task lists them). Never delete, move or rewrite other agents' files. Need a change in a file you do not own? Put the exact request (file + change) in your report.${CONCURRENT ? `
- CONCURRENT WAVE (another team, same directory, same time): ${CONCURRENT}
  Never edit its files. Its unfinished state can make SHARED gates fail: typecheck errors or test failures in its files, the geometry fixture test and the art40-contract frame-count test for its ids, npm run art40 -- --all --check for its slugs, sim differences caused by its art points. Such a failure is NOT yours: name it in your report with the evidence (file, test, id) and go on. Judge your own work with your own tests, your own slugs (npm run art40 -- <slug> --check; npm run art40-check -- <slug>) and the sims. Bake only your own slugs (npm run art40 -- <slug>); use --all only with --check. Shared files (tools/art40/contract/scope.ts, docs/design/ams40/contract.json, tools/art40/check/rules.ts): small exact Edit calls on your own entries only, never rewrite them by hand; if npm run art40-contract regenerates the whole contract, changes to the other wave's ids are expected (its verifier regenerates again at its end) - never hand-edit those entries. tests/engine/fixtures/*.json: the verifier only, npm run geometry-fixture -- <this wave's ids> only.` : ''}
- THE PAUSED OAT WORK: the files in ${ROOT}/tmp/ams40-lead/oat-paths.txt have uncommitted changes from paused work. Never edit, revert, format or delete them. If one of them blocks you, report it and stop on that point.
- tests/engine/fixtures/*.json: builders never edit them (the verifier updates them with npm run geometry-fixture -- <ids> for ids changed on purpose).
- No git commands. No new npm dependencies (Python 3 + Pillow are allowed for offline tools under tools/art40/). Never open .env.local or any key, never call ElevenLabs or any other network service, never generate audio.
- Typecheck covers the whole project (npm run typecheck); files others are still writing may show errors - YOUR files must have zero.
- Tests: iterate with your own files (npx vitest run <files> --maxWorkers=2); run the full suite at the end (npx vitest run --maxWorkers=3). Timeouts under machine load: rerun the failed files alone before you call a test red. The kick-off baseline is ${ROOT}/tmp/ams40-lead/baseline.json: a test that already failed there is not yours.
- LOOK at your work (mandatory): contact sheets and zooms as PNG under tmp/<label>/, opened with the Read tool, judged at real size and zoomed against the reference sheet's level of craft and the approved spikes. npm run sprites -- <prefix> --out tmp/<label>/ and npm run shot -- --mission ams --section <a|b|c|d> [--bot --god] [--ticks n] --out tmp/<label>/x.png show the game (docs/api/slice.md).
- Browser and sims: npm run smoke -- --port <your port> --query "<params>"; npm run sim -- --mission ams --god --expect-complete. Ports 5173, 4173 and 5520 belong to others: never use them.
- Determinism: no Math.random or Date in art or bakes; same input, same bytes (also with another PYTHONHASHSEED).
- Some local hooks block commands whose text contains 'dist/' or '.log' paths: write outputs under tmp/<label>/ and avoid those patterns.
- Never write the name of a commercial game, studio, artist, celebrity or brand in files. The boss name MECHA HASLEMA is the user's choice and allowed. Never open, copy or describe the friends' photos (tmp/refs/friends/); the heroes' look comes from the squad spike only.
- Be economical with tokens: grep, read only what you need, do not re-read large files.`

// ------------------------------------------------------------------ shared format (wave found)

const FORMAT = `THE BAKED SET FORMAT (fixed by the lead; the bake writes it, the loader reads it, the check reads it - do not change field names; additions only as optional fields, documented in tools/art40/README.md):
  // src/game/content/art40/<slug>.gen.ts - GENERATED by \`npm run art40 -- <slug>\`; do not edit.
  import type { BakedSet } from '../../../engine/baked';
  export const SET: BakedSet = { ... };
  export const THROW_RELEASE = 3;          // one named const per entry of SET.events
  // src/engine/baked.ts
  export interface BakedFrame { w: number; h: number; ox: number; oy: number; px: string; pts?: Record<string, readonly [number, number]>; smear?: true }
  export interface BakedStrip { frames: BakedFrame[]; durations: number[]; loop: boolean; defer?: true; cls?: string; why?: string }
  export interface BakedSet {
    v: 1;
    slug: string;                          // tools/art40/chars/<slug>/ (the last segment of the prefix, e.g. 'handhaver', 'ams-mayor', 'vincent')
    prefix: string;                        // id prefix: strip 'walk' becomes id '<prefix>/walk'
    budget: 28 | 40 | 64;                  // colour budget of plan D1 (figures 28, machines and multi-part 40, the mayor 64)
    pal: string[];                         // '#rrggbb'; index 0 = transparent (never drawn)
    outline: number;                       // index of the one warm near-black outline colour
    hl?: number[];                         // indices allowed as single pixels (eyes, highlights, glints)
    variants?: Record<string, string[]>;   // another id prefix -> a palette of the same length (skins, P2): same pixels, other colours
    strips: Record<string, BakedStrip>;
    events?: Record<string, number>;       // named frame or tick constants the game code reads (THROW_RELEASE, KICK_HIT, ...)
  }
  px = base64 of a run-length byte stream over the frame's palette indices, row-major: pairs (run length 1..255, index 0..255). pts are relative to the anchor of the unflipped frame (the engine convention, src/engine/render.ts Frame). ox, oy = the anchor in the frame ('feet' = floor(w/2), h unless the contract says otherwise). cls = the plan's action class of the strip; why = the logged reason when a strip has fewer frames than its class count. smear marks a smear frame (at most 2 per strip).
  export function defineBakedSet(set: BakedSet, opts?: { only?: readonly string[] }): string[]  // registers '<prefix>/<strip>' and every variant prefix through defineSprite (durations, loop, defer), decodes lazily on first getFrames, registers NO dense art (no hi / hi4 / hd / dense alias); returns the ids.`

// ------------------------------------------------------------------ schemas

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

// ------------------------------------------------------------------ wave found

const FOUND_BAKE = {
  key: 'ams40-found-bake',
  port: 5531,
  owns: 'tools/art40/** EXCEPT tools/art40/contract/**, tools/art40/check/** and tools/art40/review/**; src/engine/baked.ts (new); src/game/content/art40/ (new folder: README.md only in this wave, no game set yet); tests/engine/baked.test.ts (new); tests/tools/art40-bake.test.ts (new); tests/fixtures/art40/** (new); package.json (the scripts "art40", "art40-check" and "art40-contract" ONLY); docs/api/media.md (a new section "Baked sets" only)',
  task: `ROLE: FOUNDATION - THE PRODUCTION KIT, THE BAKE AND THE ENGINE LOADER (plan "Pipeline").
${FORMAT}
- tools/art40/kit/: PRODUCTION COPIES (copy, then clean up; never import from docs/) of the squad rig (docs/design/squad40: rig, pose, parts, parts2, anims, hero and what they need) and the cast kit (docs/design/cast40/castkit.py, the shared shading / outline / selout / palette helpers). Proof that the copy is faithful: tools/art40 renders VINCENT's 47 groups (squad spike) and the cast spike's handhaver sample PIXEL-IDENTICAL to the frozen spikes (compare against renders of the docs/ code into tmp/ams40-found-bake/; write the comparison as a script, tools/art40/selftest.py).
- The character module API that every later builder writes to: tools/art40/chars/<slug>/ (INFO, palette and variants, parts, poses, strips with frames, durations, loop, defer, cls, why, events, smear flags; looks = separate slugs sharing code). Document it with a short worked example in tools/art40/README.md (the API, the slug rule, the colour budget per set, how to make a palette variant and a look, how to export events, how to render a contact sheet).
- tools/art40/bake.py: npm run art40 -- <slug> | --all [--check] [--sheet]. Renders every strip, checks the palette fits the set's budget, writes src/game/content/art40/<slug>.gen.ts in the format above with a "GENERATED - do not edit" header and one named export per event. --check re-renders in memory and exits 1 when any checked-in file differs. --sheet writes tmp/art40/<slug>/sheet.png (every strip, 1x and a 4x zoom, durations written under each frame) and tmp/art40/<slug>/<strip>.gif at the real timing. Output is byte-identical across runs and PYTHONHASHSEED values. package.json scripts: "art40": "python3 tools/art40/bake.py", "art40-check": "tsx tools/art40/check/index.ts", "art40-contract": "tsx tools/art40/contract/extract.ts" (the last two files are written by other builders now).
- src/engine/baked.ts: the types and defineBakedSet above (decode on first getFrames; variants = same pixels with the variant palette; the id is skipped when opts.only excludes it). A clear error when an id is already registered (replacing an id means deleting its old registration first - plan rule 8). Decode cost: measure; all ams sets together must decode in <= 50 ms per mission start (plan budget).
- A probe set: tools/art40/chars/_probe/ (2 strips, 5 frames, one variant, one event, one point, one smear frame) baked to tests/fixtures/art40/_probe.gen.ts (never into src/). tests/engine/baked.test.ts: round trip (the decoded pixels equal a JSON dump of the Python render), lazy decode, variants, events, points, durations / loop / defer, no dense art at d 2 and 4 (getFrames(id, 4) returns the 1x frames), duplicate id error. tests/tools/art40-bake.test.ts: --check passes on the probe and fails on a changed byte; determinism.
- docs/api/media.md: section "Baked sets" (the format, defineBakedSet, the bake commands).`,
}

const FOUND_CONTRACT = {
  key: 'ams40-found-contract',
  port: 5532,
  owns: 'tools/art40/contract/** (new, TypeScript run by tsx); docs/design/ams40/contract.json and docs/design/ams40/contract.md (new); tests/tools/art40-contract.test.ts (new)',
  task: `ROLE: FOUNDATION - THE STRIP CONTRACT (plan "Rules: replaced correctly"). Read-only on game code: you change no game file.
- tools/art40/contract/extract.ts (npm run art40-contract; the script entry is added to package.json by ams40-found-bake): loads the content like this inventory snippet (it works from the repo root with npx tsx):
    const S = await import('${ROOT}/src/engine/sprites.ts'); const C = await import('${ROOT}/src/game/content/index.ts');
    await C.loadContent((id) => C.ART_MODULE_IDS.includes(id));
    for (const id of S.listSprites('')) { const f = S.getFrames(id, 1); ... }
  and writes, for EVERY in-scope id of the plan's Scope table (the exact ids: every strip under each prefix, every variant / skin / look / P2 id, item/bind/*, item/hostage/*, enemy/boete-ticket/*, enemy/cork, the five heroes char/{vincent,thom,dirk,bob,patrick}/* with the helium sets, vehicle/swan/*, vehicle/swan-mute/*, boss/ams-scan/*, boss/ams-mayor/*): frame count, logical size per frame, ox / oy per frame, the sprite's durations / ticksPerFrame / loop / defer, the point names per frame, whether it has 2x / 4x art or a dense alias (and the target), and the defining source file(s).
- Then the part a script cannot do - read the code: for every in-scope id or prefix, which code reads it (file:line), which frame indices, frame roles or counts the code reads (gloat phases, turn frames, throw release, kick hit, damage stages, neck aim frames, wheel steps ...), which points it reads, the logic time in ticks the code depends on and the event ticks, the entity's speed in px per tick for locomotion strips (for the foot-slide gate), how skins / variants / looks / P2 are made today (separate ids or a runtime recolour), the hitbox (plan D7: they stay), the tests that pin the id, and the plan's action class with the target frame count. Also the scenery fit points (plan rule 10): the window waver's 20x26 window, the vendor's stand, the crew's counter, the hostage chair and sack, the Swan's water line, with coordinates and the files that place them.
- docs/design/ams40/contract.json (machine-readable, one entry per id plus one per character with the roles and events) and docs/design/ams40/contract.md (readable, one section per character, wave by wave in the plan's order; a short "what the replacement must keep" list per character).
- tests/tools/art40-contract.test.ts: the JSON lists every id the game registers under the in-scope prefixes (no id missing) and its frame counts match getFrames today.
- Report the 10 riskiest contract points of the whole scope (code that reads frame indices by number, shared ids used by oldenzaal / oat, points used by physics).`,
}

const FOUND_CHECK = {
  key: 'ams40-found-check',
  port: 5533,
  owns: 'tools/art40/check/** (new, TypeScript); tools/art40/review/** (new); tools/art40/old/** (new); tests/tools/art40-check.test.ts (new); tests/art/art40-gates.test.ts (new)',
  task: `ROLE: FOUNDATION - THE GATES, THE OLD-FRAME RECORD AND THE REVIEW PAGE (plan "Gates", "Tools").
${FORMAT}
- First (before anything is replaced): tools/art40/old/dump.ts records today's frames of every in-scope id (use the content-loading snippet of the contract builder: import src/engine/sprites.ts and src/game/content/index.ts, loadContent with ART_MODULE_IDS, listSprites, getFrames(id, 1) and getFrames(id, 4)) as PNG strips + JSON (sizes, anchors, points, durations) under ${ROOT}/tmp/ams40-old/ (ignored by git). Run it now for the whole scope and say how many ids and frames you recorded.
- tools/art40/check/index.ts (npm run art40-check -- [<slug>...]; default: every set in src/game/content/art40/): for each baked set (import the .gen.ts files; decode with the engine loader src/engine/baked.ts written in parallel by ams40-found-bake - code to the format above; test against the probe fixture tests/fixtures/art40/_probe.gen.ts once it exists): colour budget; one outline colour on most outer edge pixels (report the share); orphan pixels outside hl; no anti-aliasing against transparency; class frame counts (cls and why); the contract (docs/design/ams40/contract.json from ams40-found-contract, written in parallel: same ids, every contract point name on every frame that had it, events present, the logic time and event ticks the contract names); foot slide (a locomotion strip's planted foot drifts <= 1 px per cycle against the contract speed; agree a point name for the planted foot with the bake builder through your reports - propose 'plant'); smoothness with the existing helper tests/art/motion.ts (no two identical consecutive frames, joint travel <= 3 px per displayed tick except smear frames). Output: a table per set, exit 1 on any failure, --json for machines.
- tests/art/art40-gates.test.ts: runs the check over every set in src/game/content/art40/ (passes with zero sets now), plus the coverage gates for REPLACED ids (a replaced id = an id that a baked set registers): spriteErrors() is empty for them, getFrames(id, 2) and getFrames(id, 4) return the 1x frames (no dense art), and every contract id of a replaced prefix exists. tests/tools/art40-check.test.ts: the check catches each kind of fault on small hand-made bad sets.
- tools/art40/review/build.ts: a self-contained private review page tmp/ams40-review/index.html (no external requests; images as data URIs or files next to it): per character the old frames (from tmp/ams40-old/) next to the new ones, playback at the real durations, 1x and integer zoom, a line-up next to VINCENT at 1x on the game's 384x216 view, the check table, and a "look samples" section that shows any PNGs found under tmp/ams40-looks/<name>/ with their notes.md. Dark and light background toggle. The lead publishes it; keep it under 12 MB.`,
}

// ------------------------------------------------------------------ wave pilot

const PILOT_HANDHAVER = {
  key: 'ams40-pilot-handhaver',
  port: 5534,
  owns: 'tools/art40/chars/handhaver/** and tools/art40/chars/boete-ticket/** (new); src/game/content/art40/handhaver.gen.ts, boete-ticket.gen.ts (and the variant / look sets of these two, generated); src/game/content/locals/handhaver.art.ts and every other file that defines handhaver or boete-ticket art (2x / 4x / hd drawers and dense aliases: find them in docs/design/ams40/contract.json); src/game/content/locals/handhaver.ts (named frame constants only: the logic time and gameplay numbers stay); the handhaver / boete-ticket tests',
  task: `ROLE: PILOT - THE HANDHAVER END TO END (plan wave 1). The first character through the whole pipeline: the user judges this one before the rest is drawn.
- Read the contract section of enemy/handhaver/* and enemy/boete-ticket/* (docs/design/ams40/contract.md + .json), tools/art40/README.md, and the approved look: docs/design/cast40/chars/handhaver.py + handhaver_kit.py.
- Draw every strip of the contract in tools/art40/chars/handhaver/ with the class frame counts of the plan (walk 12, throw 6, death 10-12, gloat / cheer 6-8, idle 4 ...), the reference's motion craft (anticipation, follow-through, secondary motion of the jacket, cap and notebook), 28 colours max, the skins b and c as palette variants (the way the contract says the game makes them today), the boete ticket's flight. Foot slide <= 1 px per cycle at the contract speed. Events the code reads become named constants (THROW_RELEASE ...) and the code reads them; the logic time in ticks and the event ticks stay as the contract says.
- Bake (npm run art40 -- handhaver; -- boete-ticket), register with defineBakedSet where the old art was registered, DELETE the old 1x drawers, the 2x / 4x / hd drawers and dense aliases of these ids (plan rules 7 and 8; keep shared rig code that other characters still use), keep every id and point (rules 1-3). Hitboxes and numbers stay (rule 9).
- Gates for your ids: npm run art40-check -- handhaver boete-ticket green; npm run art40 -- --all --check; tests; npm run sim -- --mission ams --god --expect-complete and --section d (compare with ${ROOT}/tmp/ams40-lead/baseline.json); LOOK: tmp/art40/handhaver/sheet.png and the GIFs, npm run shot of ams sections a and d with handhavers in view at --art 1, 2 and 4 (open them), the line-up next to VINCENT.`,
}

const LOOK_SWAN = {
  key: 'ams40-look-swan',
  port: 5535,
  owns: 'tools/art40/chars/swan/** (new: the start of the Swan production module; NOT registered in the game in this wave); tmp/ams40-looks/swan/** (outputs)',
  task: `ROLE: PILOT - THE NEW SWAN LOOK (plan "The Swan", decision D3). A look sample for the user's review, built as the start of the production module that wave 7 extends (palette, parts, the body / neck / legs rig, the gun). Nothing in the game changes in this wave.
- The user's direction (their words): "a natural swan, that has a machine gun strapped on to it", like a mount bird in the reference game they showed: a big running bird with a rider on its back and a round gun housing strapped to its side, the barrel pointing forward. Use only the IDEA; the design is ours (plan "The Swan": a natural mute swan, white plumage in soft ramps, orange bill with the black knob, small leather saddle at the base of the neck with two grips, a round steel drum under the rider's knee held by two leather belts with buckles, a short barrel with a cooling jacket pointing forward past her chest, the barrel pivoting on the drum for the game's 9 aim angles). Start from the squad spike's natural swan (docs/design/squad40/ext_ride_swan.py) and the game's Swan contract (vehicle/swan/* in docs/design/ams40/contract.md: sizes, the rider seat point, muzzle and neck aim strips, which strips exist).
- Budget 40 colours max for the Swan sprite (the rider is a separate sprite with VINCENT's palette). Same craft as the heroes: one warm near-black outline, selout, light from the upper front, hard ramps.
- Render with VINCENT riding (his ride pose from the squad spike, through tools/art40/kit) into tmp/ams40-looks/swan/: look.png (the main look, idle on the street, facing right, 1x and a 4x zoom), run.png (4 key poses of the run with long strides and half-raised wings), aim.png (the barrel at 5 of the 9 aim angles, with the muzzle point marked in a separate debug copy), swim.png (on the water line), p2.png (the player 2 palette), lineup.png (next to VINCENT on foot and the old Swan from ${ROOT}/tmp/ams40-old/ or the game's vehicle/swan frames, at 1x on a 384x216 strip), and notes.md (5-10 lines: the design choices, the colour count, how the 9 aim angles map to the barrel, which game points move).`,
}

const LOOK_MAYOR = {
  key: 'ams40-look-mayor',
  port: 5536,
  owns: 'tools/art40/chars/ams-mayor/** (new: the start of the mayor production module; NOT registered in the game in this wave); tmp/ams40-looks/mayor/** (outputs)',
  task: `ROLE: PILOT - THE HIGH-FIDELITY MAYOR LOOK (plan "The mayor", decision D4: robot, named MECHA HASLEMA). The user said of the cast sample: "the mayor detail can be more high fidelity. Use more colors and create more detail for her. That was the only sprite in the earlier artefact that I think could use some more polishing." A look sample for their review, built as the start of the production module that wave 6 extends. Nothing in the game changes in this wave (the rename is wave 6).
- Start from the cast sample docs/design/cast40/chars/ams-mayor.py (132 x 173, 34 colours; render it for comparison) and the game's contract (boss/ams-mayor/*: the parts - body, head, wig, chain, medallion, stamp arm, arm-back, legs - their sizes and damage stages 0-2, docs/design/ams40/contract.md). Keep her silhouette, height (173 px), the robot face (no likeness of any real person), the long wave locks, the chain of office, jacket and heavy robot boots.
- Raise the fidelity: up to 64 colours + transparent; lit curls in the locks; separate lit links in the chain; a relief medallion; lapels, buttons, seams and cloth folds on the jacket; panel seams, rivets and specular highlights on the steel; a glowing gradient in the red eye slots; a mouth grille; cables and joints at the neck and wrists; pistons and plates on the stamp arm. Interior anti-aliasing is allowed for her (never against transparency). One warm near-black outline, selout, light from the upper front.
- Render into tmp/ams40-looks/mayor/: look.png (the full figure at stage 0, facing left as in the fight, 1x and a 3x zoom), stamp.png (the stamp arm raised, 1 frame), damage.png (head and medallion at damage stages 0, 1, 2), before-after.png (the cast sample next to the new look, both 1x and zoomed), lineup.png (next to VINCENT at 1x on a 384x216 strip), and notes.md (5-10 lines: the colour count, what detail was added, how the parts split matches the game's part sprites).`,
}

// ------------------------------------------------------------------ waves 2-8: shared steps

const STD = `STANDARD STEPS FOR EVERY CHARACTER (exactly as the pilot did for the handhaver - read tools/art40/chars/handhaver/ and ${ROOT}/tmp/ams40-pilot-report.md first):
1. Read the character's section of docs/design/ams40/contract.md (+ .json), tools/art40/README.md and its approved look (the cast sample docs/design/cast40/chars/<id>.py, or the squad spike for heroes).
2. Draw EVERY contract strip in tools/art40/chars/<slug>/ at the class frame counts of the plan, with the reference's motion craft (anticipation, fast action, follow-through, settle, secondary motion of cloth, hair, straps; eased loops; at most 2 smears per strip). Attacks get the most care (user review of the pilot).
3. Colours within the set's budget (28; 40 for the machine slugs in tools/art40/check/rules.ts BUDGET_SLUGS). Variants (skins, P2) by palette, looks by part swaps (the way the contract says the game makes them today).
4. Locomotion: 'plant' points, the planted foot drifts <= 1 px per cycle at the contract speed. Events the code reads become named constants exported by the bake and read by the code. Logic time and event ticks stay as the contract says; hitboxes, speeds, HP and AI timing do not change.
5. Bake (npm run art40 -- <slug>), register with defineBakedSet where the old art was registered, DELETE the old 1x drawers and every 2x / 4x / hd drawer and dense alias of these ids (keep shared rig code that characters outside the wave still use), keep every id, anchor and point name.
6. Do NOT edit tools/art40/contract/scope.ts (the verifier adds your slugs to BAKED and updates stale rules): list in your report every rule there that cites code you deleted, with the new constant.
7. Gates for your ids: npm run art40-check -- <your slugs>; npm run art40 -- --all --check; your tests; npm run sim -- --mission ams --god --expect-complete against the baseline. LOOK: tmp/art40/<slug>/sheet.png and the GIFs, npm run shot of the sections where it appears at --art 1 and --art 4 (open them), a line-up next to VINCENT; fit with the scenery (plan rule 10).`

const charArea = (key, port, owns, task) => ({ key, port, owns, task: `${task}\n${STD}` })

const TESTING = `THOROUGH TESTS (the user, 2026-11-03: "Ensure that the code generated is tested thoroughly"). For every set you bake and every code path you touch, add or extend vitest tests (tests/art40/<slug>.test.ts for a set; code tests next to the existing tests of that code):
- THE SET: defineBakedSet registers exactly the contract ids of this character and its variants (docs/design/ams40/contract.json); frame counts, durations, loop and defer flags as the contract and the plan's class table say; every frame decodes (w*h pixels, palette indices in range, colours within the budget); the anchor and every contract point name on every frame that had it; smear flags only where the strip allows them; getFrames(id, 2) and getFrames(id, 4) give the 1x frames (no dense art left).
- THE CODE: every named event constant the code reads exists in the set and lies inside its strip; the logic time and the event ticks equal the contract; for every state of the character's logic, the frame pick returns an existing frame at every tick of the state (no out-of-range index, no NaN).
- BEHAVIOUR: one test runs the character's real update loop headless through its states (spawn, move, attack with telegraph and hit, hurt, death - as far as the character has them; see tests/content/ for the harness) and checks that the presentation never reads a missing frame and that the gameplay numbers (hitboxes, speeds, damage, timings) equal the values from before this work (tmp/ams40-old/ and the contract).
- Prove each new test can fail: break its input once, see it red, restore it. Name the tests in your report with their counts. The full suite stays green.`

// ------------------------------------------------------------------ wave heroes

const HERO_KIT = {
  key: 'ams40-heroes-kit',
  port: 5531,
  owns: 'tools/art40/chars/_hero/** (new shared hero module), tools/art40/chars/vincent/**, tools/art40/chars/{thom,dirk,bob,patrick}/** (first pass only: the stage-2 builders take them over), src/game/content/art40/{vincent,thom,dirk,bob,patrick}.gen.ts (generated), src/game/art/human-sprites.ts and every other file that defines char/{vincent,thom,dirk,bob,patrick}/* art except portrait / select / select-grey (UI, out of scope: keep), src/game/player/** (frame constants and presentation only), src/game/scenes/ending.ts and src/game/scenes/character-select.ts (point reads only), tests of these files',
  task: `ROLE: HEROES STAGE 1 - THE SHARED HERO MODULE AND VINCENT END TO END, then a first bake of all five heroes (plan wave 2). Read the contract sections of the five heroes.
- tools/art40/chars/_hero/: the production hero module from the approved squad spike (docs/design/squad40: its 47 groups per hero, anims.py holds in 60 Hz ticks): the map from the spike groups to the game's 121 strips per hero (portrait / select / select-grey stay as they are), the strip timing, the events, the helium-* and helium-wob-* twins (the Helium Head status art, same roles as the base strips), salute, deaths, ride-* (2-frame poses read as 0/1 by the Swan; wave 7 refits them to the new Swan), mount, mount-hop. Fill every gap the spike has with the same craft.
- FIX THE RUN (wave 0 report): VINCENT's approved run slides 3.5-5 px against the game's 1.5 px/tick; one frame sinks 1 px; the run palette has 29 colours. Restride or retime the run so the cycle stays 36 ticks (logicTicks) = 54 px and the planted foot drifts <= 1 px; 28 colours. legs-run and torso-*-run keep the same count (the torso index is legs index % torso count).
- HERO SHOOT (lead decision): the fire rate and the 6-tick shot window stay. Frames 0-2 (flash, recoil, return) fit the 6 ticks; then a presentation-only settle tail (up to 6 more frames, about 12 ticks: the gun eases back, arm and shoulder settle) plays only while the hero does not fire again; a new shot restarts at frame 0. Frame 0 of every shoot strip keeps 'muzzle' at the barrel tip. If src/game/player/ cannot show the tail without a logic change, keep 3 frames and log 'why'.
- Keep every PHYSICS point exactly where the contract says the code reads it (muzzle of frame 0 of the aim strips, the throw release 'hand', every legs 'hip', the mount-hop last 'hip', the mount frame 1 hip drop): a moved muzzle or release hand moves every bullet and bomb, so sims may change - explain every sim difference in your report, gameplay numbers must not change.
- Knife 14 ticks in all; throw release frame and about 12-14 ticks from it; crouch transitions draw-only.
- VINCENT end to end in the game (registration, old drawers and dense art of his char ids deleted, player code reads the bake's named constants). Then bake THOM, DIRK, BOB and PATRICK through the same module from their spike files (their gear: THOM two pistols, backwards cap, Dutch camo; DIRK plumber with the plunger; BOB Captain Climate with the flag cape; PATRICK nerd with the keyboard) so all five are registered and the old hero drawers can go. Stage 2 builders then polish one hero each: leave them notes in your report (what is rough per hero).
${STD}`,
}

const heroPolish = (hero, port, gear) => charArea(`ams40-heroes-${hero}`, port,
  `tools/art40/chars/${hero}/** and src/game/content/art40/${hero}.gen.ts (generated). Read-only: tools/art40/chars/_hero/** (request changes from the verifier in your report)`,
  `ROLE: HEROES STAGE 2 - POLISH ${hero.toUpperCase()} (plan wave 2). Stage 1 made the shared module and a first bake of all five heroes (its report is above). Bring ${hero.toUpperCase()} to VINCENT's level on every strip: likeness and gear as in the approved squad spike (${gear}), secondary motion of the hero's own gear on run, jump, shoot, knife, throw, deaths and victory, the helium twins, the 28-colour palette. Do not change the shared module; hero-specific parts, poses and timing tweaks live in your folder. Only this hero's ids change.`)

// ------------------------------------------------------------------ wave street

const STAG = charArea('ams40-street-stag', 5531,
  'tools/art40/chars/stag-partier/** and tools/art40/chars/stag-partier-2/** (+ a shared stag kit module there), src/game/content/art40/stag-partier*.gen.ts, the files that define enemy/stag-partier/* and enemy/stag-partier-2/* art, the stag partier logic file (frame constants only), their tests',
  'ROLE: STREET - THE STAG PARTIER, LOOKS 0 AND 2 (plan wave 3), and the shared stag kit that the groom builder uses in stage 2. Approved look: docs/design/cast40/chars/stag-partier.py, stag-partier-2.py, stag-partier_kit.py (29 colours there: cut to 28). Attacks (throws, charges, the drunk stagger) get the most care.')
const BEERBIKE = charArea('ams40-street-beerbike', 5532,
  'tools/art40/chars/beer-bike/**, tools/art40/chars/stag-beer-bike/**, tools/art40/chars/cork/**, their .gen.ts files, the files that define vehicle/beer-bike/*, enemy/stag-beer-bike/* and enemy/cork/* art, the beer bike logic files (frame constants only), their tests',
  'ROLE: STREET - THE BEER BIKE, ITS DRIVER AND THE CORK (plan wave 3). Approved look: docs/design/cast40/chars/beer-bike.py (the keg is a barrel on the rear deck). The bike is a machine set (budget 40, slug beer-bike); the riders pedal on a locomotion cycle that matches the bike speed; wheels keep 4-step mechanical counts.')
const HOSTAGE = charArea('ams40-street-hostage', 5533,
  'tools/art40/chars/hostage-tourist/**, tools/art40/chars/bind/** (or one slug per bind kind), their .gen.ts files, the files that define item/hostage/tourist/*, item/hostage/flash/* and item/bind/* art, the hostage logic files (frame constants only), their tests',
  'ROLE: STREET - THE TIED TOURIST (HOSTAGE), THE CAMERA FLASH AND THE BINDS (plan wave 3). Approved look: docs/design/cast40/chars/hostage-tourist.py. The chair and the sack (rule 10: fit), the release, the thank-you and the item give (GIVE_HANDOVER) and the run-off.')
const GROOM = charArea('ams40-street-groom', 5534,
  'tools/art40/chars/stag-groom/**, src/game/content/art40/stag-groom.gen.ts, the files that define enemy/stag-groom/* art, its logic file (frame constants only), its tests. Read-only: the stag kit of stage 1',
  'ROLE: STREET - THE GROOM (plan wave 3), on the shared stag kit of stage 1 (report above). Approved look: docs/design/cast40/chars/stag-groom.py (the veil, the L-plate). The veil and sash get secondary motion.')

// ------------------------------------------------------------------ wave riders

const RIDER = charArea('ams40-riders-delivery', 5531,
  'tools/art40/chars/delivery-rider/**, src/game/content/art40/delivery-rider*.gen.ts, the files that define enemy/delivery-rider*/* art (incl. the shared rider HD art for these ids), the delivery rider logic file (frame constants only), its tests',
  'ROLE: RIDERS - THE DELIVERY RIDER, SKINS a, b, c (plan wave 4; also used by oat: its ids change there too). Approved look: docs/design/cast40/chars/delivery-rider.py + delivery-rider_kit.py (fix its 13 edge orphans). Kick attack (KICK_HIT stays at its tick), the bag throw if any, the crash and flee.')
const FATBIKE = charArea('ams40-riders-fatbike', 5532,
  'tools/art40/chars/fatbike-youth/** (the rig, look 0 and the skins, + the shared fatbike kit), src/game/content/art40/fatbike-youth.gen.ts (and its skin variants), the files that define enemy/fatbike-youth/* and enemy/fatbike-youth-0*/* art, the fatbike logic file (frame constants only), its tests',
  'ROLE: RIDERS - THE FATBIKE YOUTH, LOOK 0 AND SKINS a-c, and the shared fatbike kit for stage 2 (plan wave 4). Approved look: docs/design/cast40/chars/fatbike-youth.py (fat tyres). Machine budget only if the bike is its own set; the youth stays at 28.')
const GULL = charArea('ams40-riders-gull', 5533,
  'tools/art40/chars/seagull/**, src/game/content/art40/seagull.gen.ts, the files that define enemy/seagull/* art, the seagull logic file (frame constants only), its tests',
  'ROLE: BIRDS - THE HERRING GULL (plan wave 4; the most killed enemy of the sims: 80 per run). Approved look: docs/design/cast40/chars/seagull.py. The flap cycle is a locomotion cycle; the dive, the chip steal, the peck and the deaths (feathers) get the most care.')
const SMALLBIRDS = charArea('ams40-riders-smallbirds', 5534,
  'tools/art40/chars/pigeons/**, tools/art40/chars/ducks/**, their .gen.ts files, the files that define npc/ams/ams-pigeons/* and npc/ams/ams-ducks/* art, their logic files (frame constants only), their tests',
  'ROLE: BIRDS - THE PIGEON FLOCK AND THE MALLARDS, DRAKE AND HEN (plan wave 4). Approved looks: docs/design/cast40/chars/pigeon.py, duck-drake.py, duck-hen.py. Peck, walk, startle and take-off; the ducks swim on the canal water line (rule 10).')
const FATBIKE_LOOKS = charArea('ams40-riders-fatbike-looks', 5535,
  'tools/art40/chars/fatbike-youth-{1,2,3}/** and tools/art40/chars/fatbike-youth-pair*/**, their .gen.ts files, the files that define enemy/fatbike-youth-{1,2,3}*/* and enemy/fatbike-youth-pair-*/* art, their tests. Read-only: the fatbike kit of stage 1',
  'ROLE: RIDERS - THE FATBIKE LOOKS 1-3 AND THE PAIRS 0-3 (plan wave 4), as part swaps on the stage-1 fatbike kit (report above). The pair: the second youth on the rack with his own secondary motion.')

// ------------------------------------------------------------------ wave people

const BAKER = charArea('ams40-people-baker', 5531,
  'tools/art40/chars/ams-baker/**, src/game/content/art40/ams-baker.gen.ts, the files that define npc/ams/ams-baker/* art, its logic file (frame constants only), its tests',
  'ROLE: PEOPLE - THE FABEL FRIET BAKER (plan wave 5). Approved look: docs/design/cast40/chars/ams-baker.py. Talk, cheer, the end scene; fit at the friet shop (rule 10).')
const HOTDOG = charArea('ams40-people-hotdog', 5532,
  'tools/art40/chars/ams-hotdog-vendor/**, its .gen.ts, the files that define npc/ams/ams-hotdog-vendor/* art, its logic file (frame constants only), its tests',
  'ROLE: PEOPLE - THE HOT-DOG VENDOR (plan wave 5). Approved look: docs/design/cast40/chars/ams-hotdog-vendor.py (29 colours there: cut to 28). Fit behind his stand (rule 10).')
const CREW = charArea('ams40-people-crew', 5533,
  'tools/art40/chars/ams-staff/** (+ one slug per crew look if needed), their .gen.ts files, the files that define npc/ams/ams-staff/{0,1,2}/* art, their logic file (frame constants only), their tests',
  'ROLE: PEOPLE - THE FABEL FRIET CREW 0-2 (plan wave 5) as part swaps on one crew rig. Approved looks: docs/design/cast40/chars/ams-staff-0.py, -1, -2 (shirts white, teal, red). Fit behind the counter (rule 10).')
const WINDOW = charArea('ams40-people-window', 5534,
  'tools/art40/chars/ams-window-waver/**, its .gen.ts, the files that define npc/ams/ams-window-waver/* art, its logic file (frame constants only), its tests',
  'ROLE: PEOPLE - THE WINDOW WAVER AND THE CAT (plan wave 5). Approved looks: docs/design/cast40/chars/ams-window-waver.py, ams-window-cat.py. Both fit inside the 20x26 window (rule 10): never larger, never cut.')

// ------------------------------------------------------------------ wave bosses

const SCAN = charArea('ams40-bosses-scan', 5531,
  'tools/art40/chars/ams-scan/** (the scan car and its driver), src/game/content/art40/ams-scan.gen.ts, the scan car strips of boss/ams-scan/* in the files that define them, src/game/content/bosses/ams-scan/car.ts (frame constants and the driver frame pick), its tests',
  'ROLE: BOSSES - THE SCAN CAR (SCANAUTO) AND ITS DRIVER (plan wave 6). Approved look: docs/design/cast40/chars/ams-scan-car.py (no readable PARKEERCONTROLE: letter-like marks; no light bar). Damage stages 0-2 and the wreck. Its attacks (the scan beam, the ram, the reverse) clearly better than today. Fix the driver foot slide (pilot report request 1): car.ts:714, frame = Math.floor(Math.abs(this.driverX - x0) / 2.4) % this.driverFrames or the right stride for the new run. The tow truck and the wheel clamp are another builder\'s: bake your strips as slug ams-scan with the prefix boss/ams-scan (separate slugs share the prefix).')
const TOW = charArea('ams40-bosses-tow', 5532,
  'tools/art40/chars/ams-tow-truck/** and tools/art40/chars/ams-wheel-clamp/**, their .gen.ts files, the tow truck and wheel clamp strips of boss/ams-scan/* in the files that define them, the tow / clamp logic (frame constants and art-only offsets), their tests',
  'ROLE: BOSSES - THE TOW TRUCK (1.2x LONGER, decision D5) AND THE WHEEL CLAMP (plan wave 6). Approved looks: docs/design/cast40/chars/ams-tow-truck.py, ams-wheel-clamp.py. The truck backs in during the fight; its hook and the clamp\'s points move with the art; the HITBOXES stay (D7) - if a longer truck makes a hitbox look wrong, report it, do not change it. Slugs ams-tow-truck and ams-wheel-clamp with the prefix boss/ams-scan.')
const MAYOR_A = charArea('ams40-bosses-mayor-a', 5533,
  'tools/art40/chars/ams-mayor/** EXCEPT limbs.py (stage 2 owns it): head, wig, chain, medallion, body, spring, shadow, the props noise-letter / shield-shot / stamp-wave, the palette, the set build function; src/game/content/art40/ams-mayor.gen.ts (first bake)',
  `ROLE: BOSSES STAGE 1 - MECHA HASLEMA'S PIECES (plan wave 6, "The mayor"). Start from the approved look module (tmp/ams40-looks/mayor/ and its notes.md: the open items are yours - the wig texture at 1x: each lock a dark core gap, one mid band, one continuous lit streak, one glint, no lone specks). Every head frame (smile, hatch open, shout, blink, off, bald) at stages 0-2; wig 8+ spin frames; chain 0-2 + gone; medallion closed / open / glow at stages 0-2 (the opening and charge glow as a real sequence where the code shows it); body 0-2; spring; shadow; the props. Up to 64 colours, high fidelity. Write the set's build function so stage 2 adds the limb strips; do not register in the game (stage 2 integrates).`)
const RENAME = {
  key: 'ams40-bosses-rename',
  port: 5534,
  owns: 'src/game/content/bosses/ams/geometry.ts (MAYOR_NAME, MAYOR_SUBTITLE only), src/game/content/missions/ams/section-d.ts (the bossIntro name only), src/game/content/ui/cards.ts (the headline only if it names her), tools/audio/lib.ts and tools/audio/spec.ts and tools/audio/README-spec.md and tools/audio/mayor-placeholders.ts (comments and the no-voice guard only), docs/ORIGINALITY.md, docs/GAME_DESIGN.md, docs/design/amsterdam.md, docs/design/ams-extras.md, docs/design/floor.md, docs/ARCHITECTURE.md (the name only), comments and test titles that name her in tests/**',
  task: `ROLE: BOSSES - THE RENAME TO MECHA HASLEMA (decision D4). The boss ROBO-HALSEMA becomes MECHA HASLEMA everywhere the game, the docs, the tests and the comments name her: MAYOR_NAME, the boss intro card (the subtitle THE IRON MAYOR may stay), the story / news cards, docs, test titles. The id ams-mayor stays. Her lines stay text-only, never voiced: the audio guard (tools/audio/lib.ts /halsema/i and the tests that pin it) must block the new name too (keep blocking the old one). NEVER change the baker's voiced line 'BURGEMEESTER HALSEMA / WIL ONS VOOR ALTIJD...' (its recording exists; no new voice generation) and never touch public/audio/. docs/ORIGINALITY.md: update the caricature exception to the new name (a robot face, no likeness). Leave the paused oat files alone. Tests and typecheck green; npm run sim -- --mission ams --section d --god --expect-complete.`,
}
const MAYOR_B = charArea('ams40-bosses-mayor-b', 5535,
  'tools/art40/chars/ams-mayor/limbs.py (+ new attack modules there), the mayor set build (shared with stage 1: extend, do not rewrite), src/game/content/art40/ams-mayor.gen.ts, src/game/content/bosses/ams/{art.ts,art-hd.ts,art-hi*.ts,art-shots.ts,layout.ts,mayor.ts} (art registration, frame constants, art-only offsets and presentation of the attacks), the old mayor drawers, tests/content/boss-ams*.test.ts, tests/art/mayor-hi.test.ts',
  `ROLE: BOSSES STAGE 2 - MECHA HASLEMA'S LIMBS, ATTACKS AND INTEGRATION (plan wave 6). Stage 1 made her pieces (report above). Build the stamp arm at stages 0-2 + gone (pre-mirrored, 2 x ARM_FRAMES), the arm-back (rest, chain high / low, the whirl), the legs (stand, the walk MAYOR_WALK, squat, sit, half squat, push-off; an A-stance if the legJoints allow it), the lash. Move the pilot's art-only numbers into layout.ts (pilot report request 3: ARM_POSES[1] = ((46,-118),(64,-138),-96); arm-back frame 0 elbow (-33,-75), fist (-38,-54)).
THE USER'S EMPHASIS: her ATTACK ANIMATIONS must clearly improve on today's. Today the stamp has 6 poses (low, raised, slam, anticipation, smear, recoil), the chain whirl 6 steps, the lash 2 frames. Give each attack a full reference-class sequence inside the SAME telegraph, hit and recover windows (bosses/ams/geometry.ts; logic time stays, hitboxes stay): the stamp wind-up (rise in 3+ steps, tremble during the hold, a 2-frame smear, the impact squash with the shock wave, a recoil and a settle), the chain whip (wind-up, 8+ whirl steps with link smears, the release, the lash extending and snapping back in 4+ frames), the medallion beam (open, charge pulse, fire, close), the wig launch and spin, the spring head; her stagger, the shout, the death (power down). Code that picks frames reads named constants; a new frame role needs a new constant and a code path that only changes presentation. Integrate in the game: register the set, delete the old 1x / 2x / 4x / hd drawers of boss/ams-mayor/*, keep every id, the one shared anchor and every part box.`)

// ------------------------------------------------------------------ wave swan

const SWAN_CORE = charArea('ams40-swan-core', 5531,
  'tools/art40/chars/swan/** (the core: palette with the P2 black swan, body rig, the shared drawing code, the ground and locomotion strips), src/game/content/art40/swan.gen.ts, tools/art40/check/rules.ts (BUDGET_SLUGS: add swan-neck and swan-water at 40, then npm run art40-check -- --write-rules), src/game/content/vehicles/swan/** (art registration, frame constants, art-only offsets), the files that define vehicle/swan/* and vehicle/swan-mute/* art, the Swan tests',
  `ROLE: SWAN STAGE 1 - THE CORE AND THE GROUND STRIPS (plan wave 7, "The Swan"). Start from the approved look module (tmp/ams40-looks/swan/notes.md: the user kept the LONG running legs and picked the BLACK swan for player 2: black plumage, red bill, red cloth - vehicle/swan-mute is the same pixels with that palette). The core: palette + P2 variant, the body and leg rig, the saddle, belts and gun drum, the shared drawing code that stage 2 imports. Your strips: idle, move, run (the 12-frame run_pose), jump, fall, land, crouch, squat, stomp, skid, slide, bash, dazed, hiss, honk (ground), shake, right, scuffs, empty / empty-look / empty-lay, egg, and their -front overlays (the rider's near leg over the flank, the look's rider_leg). Integrate the Swan in the game (registration of all three slugs swan, swan-neck, swan-water with the prefix vehicle/swan and the variant vehicle/swan-mute), delete the old robot Swan drawers and dense art, keep the seat, neck socket and every point name; the art-only point moves of notes.md. Stage 2 adds the neck, water and air strips and refits the riders.`)
const SWAN_NECK = charArea('ams40-swan-neck', 5532,
  'tools/art40/chars/swan-neck/** (imports the swan core read-only), src/game/content/art40/swan-neck.gen.ts, src/game/content/vehicles/swan/constants.ts (MUZZLE_REL only) and the neck / gun frame picks in the swan code (presentation only)',
  'ROLE: SWAN STAGE 2 - THE NECK AND THE GUN (plan wave 7). Every neck strip (neck, neck-blink, neck-fire, neck-hurt, neck-shell, neck-honk, neck-relax, crouch-neck*, duck-neck*, swim-neck*, beak-flash): 9 aim frames each = the free neck with its face + the barrel on the drum at aim i (theta = +45 - 22.5 * i); muzzle / cannon = the barrel tip (notes.md: MUZZLE_REL values). The gun fire gets real craft: recoil of the barrel and drum, the muzzle flash, the belt feed, a flinch of the neck. Slug swan-neck, prefix vehicle/swan.')
const SWAN_WATER = charArea('ams40-swan-water', 5533,
  'tools/art40/chars/swan-water/** (imports the swan core read-only), src/game/content/art40/swan-water.gen.ts',
  'ROLE: SWAN STAGE 2 - WATER AND AIR (plan wave 7). swim, paddle-up, dive, flap, glide, glide-tired, migrate, migrate-soot, fold, rise, settle, sit-down, honk-swim, honk-air and every -front overlay of these. The water line (rule 10), the wing beats as locomotion cycles, splash FX from the shared FX ramp. Slug swan-water, prefix vehicle/swan.')
const SWAN_RIDERS = charArea('ams40-swan-riders', 5534,
  'the ride-*, mount and mount-hop strips in tools/art40/chars/{_hero,vincent,thom,dirk,bob,patrick}/** and the five hero .gen.ts files (rebake), the rider pick code in src/game/content/vehicles/swan/swan.ts (presentation only)',
  'ROLE: SWAN STAGE 2 - THE RIDERS ON THE NEW SWAN (plan wave 7). Refit every hero ride pose (ride-sit, ride-lean, ride-up, ride-hunch, ride-hold, ride-brace, ride-duck, ride-ears, ride-cheer; 2-frame poses read as 0/1), mount and mount-hop to the new Swan: hip on the seat, fists on the two grips, the near leg matching the core\'s -front overlay; the barrel at aims 6-8 must not cut through the rider\'s hands in a way that reads wrong. Only the ride, mount and mount-hop strips of the five heroes change.')

// ------------------------------------------------------------------ wave polish

const POLISH_LENSES = [
  { key: 'ams40-polish-review-art', ask: 'ART LENS over the whole scope: open every set\'s sheet (npm run art40 -- --all --sheet) and the review page; rank the weakest strips against the handhaver (the user-approved model) and the reference sheet: motion craft, attacks, silhouettes, colour, outline, consistency between characters and with VINCENT.' },
  { key: 'ams40-polish-review-game', ask: 'GAME LENS: play the ams route in shots and smoke at --art 1, 2 and 4, 1P and 2P (and oldenzaal for the shared ids): fit with the scenery, readability against the scenery, layering, z-order, flips, missing frames, wrong timing, sims against the baseline, budgets (bundle, decode, memory).' },
  { key: 'ams40-polish-review-code', ask: 'CODE LENS: leftover old drawers, 2x / 4x / hd art and dense aliases of replaced ids; dead rig code; magic frame numbers that should be named constants; the contract (npm run art40-contract -- --check); docs to update (ART_GUIDE, ARCHITECTURE 6.1, docs/api/media.md, the plan status).' },
  { key: 'ams40-polish-review-tests', ask: 'TEST LENS (the user: "Ensure that the code generated is tested thoroughly"): audit the tests of the whole work (tests/art40/, tests/tools/art40*, tests/engine/baked*, the character and boss tests, the player tests). For every baked set and every changed logic file: is there a test for the registered ids, frame counts, durations, loop / defer, decoding, palette budget, contract points, named event constants, the logic time, frame picks at every tick of every state, the no-dense-art rule, and a headless behaviour run? Do the tests really fail on bad input (mutate one input per suspect test and run it)? Are tools/art40 (bake determinism, --check, the check rules, the contract extractor) tested? List the gaps, most risky first.' },
]
const POLISH_FIX = [
  { key: 'ams40-polish-fix-art', port: 5531, owns: 'tools/art40/chars/** and src/game/content/art40/*.gen.ts', task: 'ROLE: POLISH FIXER - ART. Fix the ART lens findings and the art part of the others, weakest first; rebake; keep every contract rule.' },
  { key: 'ams40-polish-fix-code', port: 5532, owns: 'src/** except src/game/content/art40/*.gen.ts and the paused oat files; tests/** except tests/ams40/**; tools/** except tools/art40/chars/**', task: 'ROLE: POLISH FIXER - CODE AND GAME. Fix the GAME and CODE lens findings: leftover old art and dense art, dead code, constants, fit offsets, budgets, the contract check.' },
  { key: 'ams40-polish-fix-tests', port: 5534, tests: false, owns: 'tests/ams40/** (new folder: cross-cutting tests over the whole work)', task: `ROLE: POLISH FIXER - TESTS. Close the TEST lens gaps with cross-cutting tests in tests/ams40/: one table-driven suite over EVERY baked set in src/game/content/art40/ (ids against docs/design/ams40/contract.json, frame counts, durations, loop / defer, decode, palette budget per tools/art40/check/rules.ts, contract points on every frame, smear limits, no dense art at d 2 and 4), the named event constants against the code that reads them, frame picks at every tick of every state for each character with logic, a headless run of the ams route (sections a-d, god mode) that asserts no missing frame is ever read, and tests for tools/art40 (bake determinism and --check catching one changed byte). Prove each test can fail (mutate an input once). Gaps inside a character's own tests: put the exact request in your report (the code fixer and the verifier own those files).\n${TESTING}` },
  { key: 'ams40-polish-fix-docs', port: 5533, tests: false, owns: 'docs/** (except the paused oat docs)', task: 'ROLE: POLISH FIXER - DOCS. Bring docs/ART_GUIDE.md (the 40 px rules: per-character palettes, budgets 28 / 40 / 64, the bake pipeline), docs/ARCHITECTURE.md 6.1, docs/api/media.md and docs/design/ams40.md (status: done, what was built, known issues) to what was built; docs only; never banned names.' },
]

// ------------------------------------------------------------------ prompts

function builderPrompt(a, earlier) {
  return `${PRE}

YOUR LABEL: ${a.key} (tool output goes to tmp/${a.key}/). YOUR PORT: ${a.port + PORT_OFF}.
YOU OWN: ${a.owns}
${earlier ? `\nREPORTS OF THE EARLIER STAGE (build on them):\n${earlier}\n` : ''}
${a.task}${THOROUGH && a.tests !== false ? `\n\n${TESTING}` : ''}

DONE WHEN: everything above is built; your tests pass; typecheck is clean for your files; you LOOKED at your work and judged it; the full suite is green (or every failure is explained and owned by someone else or in the baseline). Return the structured result (model_id + report).`
}

function reviewerPrompt(label, port, lens) {
  return `${PRE}

YOUR LABEL: ${label} (tool output goes to tmp/${label}/). YOUR PORT: ${port}. You are a READ-ONLY reviewer: never edit source, test, tool or doc files (writing into tmp/${label}/ is fine).
ROLE: ${lens}
Report only real, verified problems with evidence (file:line, a PNG path you opened, a number, a command and its output). Max 15 findings, most severe first. Return the structured result (model_id + findings).`
}

function verifierPrompt(label, scope, owns, reports, findings, extra) {
  return `${PRE}

YOUR LABEL: ${label} (tool output goes to tmp/${label}/). YOUR PORT: ${5539 + PORT_OFF}.
ROLE: ADVERSARIAL VERIFIER AND INTEGRATOR for wave '${WAVE}': ${scope}. The builders and the reviewers are done (below). Assume the builder reports are optimistic. Check each claim and each finding (skip false findings and say why), LOOK at the work yourself (open the sheets and shots), and fix what is wrong or missing.
YOU OWN (for fixes): ${owns}. You alone may run npm run geometry-fixture -- <ids> for ids this wave changes on purpose (list every id and why).

BUILDER REPORTS:
${reports}

REVIEW FINDINGS:
${findings}

${extra}
${THOROUGH ? `
THOROUGH TESTS (the user's demand): check that every builder wrote the tests below, that each one really tests something (break an input once and see it red), and write the missing ones yourself. Run the gates twice: once when you start (so you know what the builders left) and once at the end.
${TESTING}
` : ''}
GATES (all must pass at the end; give numbers and compare with ${ROOT}/tmp/ams40-lead/baseline.json): npm run typecheck; npx vitest run --maxWorkers=3 (rerun timeouts alone); npm run art40 -- --all --check; npm run art40-check; npx vite build --outDir tmp/${label}/out --emptyOutDir; npm run sim -- --mission ams --god --expect-complete; npm run sim -- --mission ams --section d --god --expect-complete; npm run sim -- --mission oldenzaal --god --expect-complete; npm run smoke -- --port ${5539 + PORT_OFF} --query "mission=ams&art=1", then "mission=ams&art=4" (0 errors).

HAND-OFF: write ${ROOT}/tmp/ams40-${WAVE}-report.md (max 700 words): what this wave built (files, ids, APIs with signatures), gate numbers against the baseline, what you LOOKED at (the best sheet and shot paths for the lead's review page), known issues, requests for later waves.

FINAL ANSWER: the structured result (model_id, summary, gates, looked, fixed, unfinished).`
}

const reportsOf = (areas, rs) => areas.map((a, i) => `=== ${a.key} === (owns: ${a.owns})\n${rs[i] ? rs[i].report : '(no report - the agent failed or was stopped: check this area yourself and finish what is missing)'}`).join('\n\n')

// builders: an array of areas (one stage) or an array of stages (arrays of areas); each stage runs in
// parallel, and a later stage gets the reports of the earlier ones.
async function wave(builders, lenses, scope, extra) {
  phase('Build')
  const stagesIn = Array.isArray(builders[0]) ? builders : [builders]
  const all = []
  const rsAll = []
  for (const stage of stagesIn) {
    const earlier = all.length ? reportsOf(all, rsAll) : ''
    const rs = await parallel(stage.map((a) => () => opus(builderPrompt(a, earlier), { label: `build:${a.key}`, phase: 'Build', schema: BUILD_SCHEMA })))
    all.push(...stage)
    rsAll.push(...rs)
    if (stopped('Build')) return { wave: WAVE, stopped: BAD }
  }
  builders = all
  const rs = rsAll
  const reports = reportsOf(builders, rs)
  phase('Review')
  const fs = await parallel(lenses.map((l, i) => () => opus(reviewerPrompt(l.key, 5537 + PORT_OFF + i,`${l.ask}\n\nBUILDER REPORTS:\n${reports}`), { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS_SCHEMA })))
  if (stopped('Review')) return { wave: WAVE, stopped: BAD }
  const findings = fs.filter(Boolean).flatMap((f) => f.findings || [])
  log(`${findings.length} findings from ${fs.filter(Boolean).length} reviewers`)
  phase('Verify')
  const owns = `every file of this wave: ${builders.map((a) => a.owns).join('; ')}`
  const v = await opus(verifierPrompt(`ams40-${WAVE}-verify`, scope, owns, reports, JSON.stringify(findings, null, 1), extra), { label: `verify:${WAVE}`, phase: 'Verify', schema: VERIFY_SCHEMA })
  if (stopped('Verify')) return { wave: WAVE, stopped: BAD }
  return { wave: WAVE, builders: builders.map((a, i) => ({ key: a.key, ok: Boolean(rs[i]) })), findings: findings.length, verify: v }
}

let result = { wave: WAVE }

if (WAVE === 'found') {
  result = await wave(
    [FOUND_BAKE, FOUND_CONTRACT, FOUND_CHECK],
    [
      { key: 'ams40-found-review-contract', ask: 'CONTRACT AND ENGINE LENS. Is docs/design/ams40/contract.json complete and right? Pick 12 ids across the scope (heroes, handhaver, the Swan neck strips, the mayor parts, a rider, a bird, the hostage binds) and check each entry against the code that reads it (frame indices, roles, points, logic time, events, speed, variants, tests). Is src/engine/baked.ts right (lazy decode, variants, no dense art at d 2 / 4, the duplicate error, the decode budget)? Do the gate tests really fail on a bad set?' },
      { key: 'ams40-found-review-pipeline', ask: 'PIPELINE AND FIDELITY LENS. Is tools/art40 a faithful production copy (run tools/art40/selftest.py: VINCENT and the cast handhaver pixel-identical)? Is the bake deterministic (two runs, two PYTHONHASHSEED values, byte-identical) and does --check catch a changed byte? Do the check rules match the plan and the reference numbers (colour budget, outline share, orphan pixels, class counts, foot slide, smoothness)? Is the old-frame record complete for the whole scope? Does the review page build and stay private (no external requests)?' },
    ],
    'the foundation: tools/art40 (kit, bake, --check, sheets), src/engine/baked.ts, the strip contract, the gates and the review page',
    'Extra checks: nothing in the game is replaced yet (no game id changes; sims and sprite-geometry.json unchanged against the baseline); tmp/ams40-old/ holds the whole scope; the review page builds with zero sets.'
  )
} else if (WAVE === 'pilot') {
  result = await wave(
    [PILOT_HANDHAVER, LOOK_SWAN, LOOK_MAYOR],
    [
      { key: 'ams40-pilot-review-fidelity', ask: 'FIDELITY LENS (motion and colour). Open tmp/art40/handhaver/sheet.png, the GIFs and the reference sheet (tmp/refs/run-gun-sheet/). Do the handhaver strips meet the class frame counts and the motion craft (anticipation, follow-through, secondary motion, eased loops, no identical frames, smears <= 2)? Colour: <= 28, one outline, selout, ramps, no orphans? Then the look samples tmp/ams40-looks/swan/ and tmp/ams40-looks/mayor/: does the Swan read as a natural swan with a strapped-on gun (and not a copy of another game\'s mount), does the mayor clearly have more colours and detail than the cast sample while keeping her silhouette? Judge each at 1x and zoomed.' },
      { key: 'ams40-pilot-review-contract', ask: 'CONTRACT AND GAME LENS. For enemy/handhaver/* and enemy/boete-ticket/*: same ids, anchors and points as docs/design/ams40/contract.json; the logic time and event ticks unchanged; the code reads named constants; the old 1x drawers and every 2x / 4x / hd drawer and dense alias of these ids are gone and nothing else broke; hitboxes and numbers unchanged; sims against tmp/ams40-lead/baseline.json; shots of ams a and d at --art 1, 2 and 4 (open them: fit, scale against VINCENT, readability). The look builders must not have changed any game file.' },
    ],
    'the pilot: the handhaver end to end, the Swan and the mayor look samples',
    'Extra checks: only handhaver and boete-ticket ids changed in the game (sprite-geometry.json only for them, updated on purpose); every tier draws their 1x frames; the review page (npx tsx tools/art40/review/build.ts) shows the handhaver old vs new and both look samples; tmp/ams40-looks/{swan,mayor}/notes.md exist.'
  )
} else if (WAVE === 'heroes') {
  result = await wave(
    [[HERO_KIT], [heroPolish('thom', 5532, 'two pistols, backwards cap, Dutch camo'), heroPolish('dirk', 5533, 'plumber overalls and the plunger'), heroPolish('bob', 5534, 'Captain Climate with the flag cape'), heroPolish('patrick', 5535, 'nerd with the keyboard')]],
    [
      { key: 'ams40-heroes-review-fidelity', ask: 'FIDELITY LENS. Open each hero\'s sheet (tmp/art40/<hero>/sheet.png) and GIFs, the approved squad spike page sources (docs/design/squad40/) and the reference sheet. Do the five heroes keep their approved likeness and gear, the class frame counts and the motion craft (run, jump, shoot with the settle tail, knife, throw, deaths, victory, helium twins)? Equal level across the five? Colours <= 28, one outline, selout, no edge orphans?' },
      { key: 'ams40-heroes-review-game', ask: 'GAME LENS. Player feel and contract: run foot slide <= 1 px at 1.5 px/tick, cycle 36 ticks; shot window and fire rate unchanged; knife 14 ticks; the throw release; muzzle / hand / hip points where the code reads them (every bullet and bomb origin: sims against tmp/ams40-lead/baseline.json, every difference explained); helium status art; ride / mount still work on today\'s Swan; the ending and the character select read their points; shots of ams a-d at --art 1 and 4, 1P and 2P; old hero drawers and dense art gone (portrait / select stay).' },
    ],
    'the five heroes: the shared hero module, VINCENT, THOM, DIRK, BOB and PATRICK in the game',
    'Extra checks: only char/{vincent,thom,dirk,bob,patrick}/* ids changed (portrait / select / select-grey unchanged); add the five slugs to BAKED in tools/art40/contract/scope.ts and fix stale rules so npm run art40-contract -- --check passes; the size budget (500 KB gzip) holds - report the total; 2P with two different heroes at --art 4.'
  )
} else if (WAVE === 'street') {
  result = await wave(
    [[STAG, BEERBIKE, HOSTAGE], [GROOM]],
    [
      { key: 'ams40-street-review-fidelity', ask: 'FIDELITY LENS for the stag partiers, the groom, the beer bike with driver and cork, the tied tourist with flash and binds: sheets and GIFs against the handhaver (the approved model) and the reference sheet; attacks first; colours, outline, selout, orphans; the looks as part swaps.' },
      { key: 'ams40-street-review-game', ask: 'CONTRACT AND GAME LENS for the same characters: ids, anchors, points, logic time and events against docs/design/ams40/contract.json; old drawers and dense art gone; the hostage chair / sack fit and the handover; the beer bike riders pedal without slide; shots of the sections where they appear at --art 1 and 4; sims against the baseline.' },
    ],
    'the street: stag partier looks 0 and 2, the groom, the beer bike with its driver and the cork, the tied tourist with the flash and the binds',
    'Extra checks: add the wave\'s slugs to BAKED in tools/art40/contract/scope.ts and fix stale rules (art40-contract --check passes); size budget total; the review page (npx tsx tools/art40/review/build.ts) shows every replaced character old vs new.'
  )
} else if (WAVE === 'riders') {
  result = await wave(
    [[RIDER, FATBIKE, GULL, SMALLBIRDS], [FATBIKE_LOOKS]],
    [
      { key: 'ams40-riders-review-fidelity', ask: 'FIDELITY LENS for the delivery rider, the fatbike youth (looks 0-3, pairs, skins), the seagull, the pigeons and the ducks: sheets and GIFs against the handhaver and the reference sheet; attacks (kick, dive, steal) first; bird flap cycles; colours, outline, orphans.' },
      { key: 'ams40-riders-review-game', ask: 'CONTRACT AND GAME LENS for the same characters: ids, anchors, points, KICK_HIT and other events, logic time against the contract; old drawers, the shared rider HD art and dense aliases gone for replaced ids (and still working for anything outside the scope); riders on the road, ducks on the water; sims (ams and oldenzaal, the rider is shared) against the baseline; shots at --art 1 and 4.' },
    ],
    'riders and birds: the delivery rider, the fatbike youth (looks 0-3, pairs, skins), the seagull, the pigeons and the ducks',
    'Extra checks: add the wave\'s slugs to BAKED in scope.ts and fix stale rules (art40-contract --check passes); size budget total; oat still type-checks with the shared rider ids (do not edit the paused oat files).'
  )
} else if (WAVE === 'people') {
  result = await wave(
    [BAKER, HOTDOG, CREW, WINDOW],
    [
      { key: 'ams40-people-review-fidelity', ask: 'FIDELITY LENS for the baker, the hot-dog vendor, the crew 0-2, the window waver and the cat: sheets and GIFs against the handhaver and the reference sheet; talk, cheer and idle fidgets; colours, outline, orphans.' },
      { key: 'ams40-people-review-game', ask: 'CONTRACT AND SCENERY LENS for the same characters: ids, anchors, points, logic time against the contract; old drawers and dense art gone; the fit at the friet shop, behind the stand, behind the counter and inside the 20x26 window (rule 10) in shots at --art 1 and 4; the end scene of the mission; sims against the baseline.' },
    ],
    'the people: the baker, the hot-dog vendor, the crew 0-2, the window waver and the cat',
    'Extra checks: add the wave\'s slugs to BAKED in scope.ts and fix stale rules (art40-contract --check passes); size budget total.'
  )
} else if (WAVE === 'bosses') {
  result = await wave(
    [[SCAN, TOW, MAYOR_A, RENAME], [MAYOR_B]],
    [
      { key: 'ams40-bosses-review-fidelity', ask: 'FIDELITY LENS for the scan car with driver, the tow truck (1.2x longer), the wheel clamp and MECHA HASLEMA: sheets, GIFs and fight shots. Are her ATTACK animations clearly better than today\'s (compare with tmp/ams40-old/png/boss/ams-mayor/): stamp, chain whip and lash, medallion, wig, spring, stagger, death? The 64-colour detail kept from the approved look, the wig texture fixed at 1x? Damage stages read?' },
      { key: 'ams40-bosses-review-game', ask: 'CONTRACT AND GAME LENS: every boss frame role as a named constant; telegraph, hit and recover windows unchanged (bosses/ams/geometry.ts); part boxes unchanged; the one shared anchor; the rename (MECHA HASLEMA in the intro card, docs, tests; the voice guard blocks old and new name; the baker\'s voiced line untouched; public/audio untouched); the scan car driver no longer slides; sims ams and section d against the baseline; fight shots at --art 1 and 4.' },
    ],
    'the bosses: the scan car with its driver, the tow truck and the wheel clamp; MECHA HASLEMA at high fidelity with improved attacks; the rename',
    'Extra checks: add the wave\'s slugs to BAKED in scope.ts and fix stale rules (art40-contract --check passes); size budget total; the boss fight in a browser at --art 4 with 0 errors.'
  )
} else if (WAVE === 'swan') {
  result = await wave(
    [[SWAN_CORE], [SWAN_NECK, SWAN_WATER, SWAN_RIDERS]],
    [
      { key: 'ams40-swan-review-fidelity', ask: 'FIDELITY LENS for the new Swan (P1 white, P2 black) and the five heroes riding her: every strip against the approved look (tmp/ams40-looks/swan/), the handhaver level and the reference sheet; the gun fire, the run, the jump, swim and flight; the riders\' fit on the seat and grips.' },
      { key: 'ams40-swan-review-game', ask: 'CONTRACT AND GAME LENS: every vehicle/swan and vehicle/swan-mute id, the seat, neck socket, muzzle / cannon (MUZZLE_REL), head points; hurtboxes, SEAT_ZONE and PERCH_TOP unchanged; the 9 aim angles fire from the barrel tip; mount, dismount, the rider picks; the water line; sims (ams with the Swan sections, oldenzaal) against the baseline; shots at --art 1 and 4, 1P and 2P (black swan).' },
    ],
    'the Swan: the natural swan with the strapped-on gun (P2 black swan), her neck, water and air strips, and the heroes riding her',
    'Extra checks: add the swan slugs to BAKED in scope.ts and fix stale rules (art40-contract --check passes); the old robot Swan drawers and dense art gone (the swan-socks of m3 is out of scope: keep it working); size budget total.'
  )
} else if (WAVE === 'polish') {
  phase('Review')
  const fs = await parallel(POLISH_LENSES.map((l, i) => () => opus(reviewerPrompt(l.key, 5536 + PORT_OFF + i,`${l.ask}\n\nREPORTS OF ALL WAVES: ${PRIOR_REPORTS}`), { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS_SCHEMA })))
  if (stopped('Review')) {
    result = { wave: WAVE, stopped: BAD }
  } else {
    const findings = fs.filter(Boolean).flatMap((f) => f.findings || [])
    log(`${findings.length} findings from ${fs.filter(Boolean).length} lenses`)
    const FINDINGS = `FINDINGS OF THE REVIEW PANEL (verify each before fixing; skip false ones and say why; take the ones inside YOUR files):\n${JSON.stringify(findings, null, 1)}`
    phase('Build')
    const fixed = await parallel(POLISH_FIX.map((a) => () => opus(builderPrompt({ ...a, task: `${a.task}\n${FINDINGS}` }, ''), { label: `fix:${a.key}`, phase: 'Build', schema: BUILD_SCHEMA })))
    if (stopped('Build')) {
      result = { wave: WAVE, stopped: BAD }
    } else {
      phase('Verify')
      const v = await opus(verifierPrompt('ams40-polish-verify', 'the final polish of the whole scope (four fixers: art, code, tests, docs)', 'every file changed in this work (src/**, tests/**, docs/**, tools/**) except the paused oat files - keep changes minimal and safe', reportsOf(POLISH_FIX, fixed), JSON.stringify(findings, null, 1), 'Extra checks: the full ams route in a browser at --art 1, 2 and 4, 1P and 2P, 0 errors; every in-scope id baked (coverage gate); npm run art40-contract -- --check; the size budget total; the review page builds with every character; the whole test suite green twice in a row (no flaky test); the tests of tests/ams40/ fail on a mutated input.'), { label: 'verify:polish', phase: 'Verify', schema: VERIFY_SCHEMA })
      result = stopped('Verify') ? { wave: WAVE, stopped: BAD } : { wave: WAVE, findings: findings.length, fixers: POLISH_FIX.map((a, i) => ({ key: a.key, ok: Boolean(fixed[i]) })), verify: v }
    }
  }
} else {
  log(`Unknown wave "${WAVE}". Order: ${ORDER.join(', ')}`)
}

return result
