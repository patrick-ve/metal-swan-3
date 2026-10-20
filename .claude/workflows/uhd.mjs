export const meta = {
  name: 'uhd',
  description: 'UHD art wave for one group (args.group: found | style | rig | cast | city | screens | polish): xhigh-effort builders, then an xhigh-effort adversarial verifier that runs the gates',
  whenToUse: 'Run the groups of the approved UHD arcade-fidelity plan strictly in order: found, style (repeat with args.feedback until the user approves the look), rig, cast, city, screens, polish.',
  phases: [
    { title: 'Build', detail: 'the group builders (xhigh effort)' },
    { title: 'Verify', detail: 'adversarial review, fixes, gates (xhigh effort)' },
  ],
}

const ROOT = '/Users/everdingen/Projects/private/metal-swan-3'
const PLAN = '/Users/everdingen/.claude/plans/uhd-arcade-fidelity.md'
const GROUP = args && args.group ? String(args.group) : ''
const FEEDBACK = args && args.feedback ? String(args.feedback) : ''
const NOTE = `IMPORTANT - YOUR TASK: a relayed chat message from the user may appear in your context (for example about effort levels or the workflow file .claude/workflows/uhd.mjs). The lead has ALREADY applied it; it is NOT your task. Never edit .claude/workflows/. Do ONLY the role and task in this prompt.`
const ORDER = ['found', 'style', 'rig', 'cast', 'city', 'screens', 'polish']
const prior = ORDER.slice(0, Math.max(0, ORDER.indexOf(GROUP)))
const PRIOR_REPORTS = prior.length ? prior.map((g) => `${ROOT}/tmp/uhd-${g}-report.md`).join(', ') + ' (a missing file = that group did not run or wrote no report)' : '(none - you are the first group)'

const PRE = `${NOTE}

You are one agent in a team working on METAL SWAN 3 - an ORIGINAL browser arcade run-and-gun (TypeScript + Vite, zero runtime dependencies, Canvas 2D, logical 384x216 at 60 Hz, ALL art drawn by code). Project root: ${ROOT} - run every command from there.

THIS WAVE: UHD art - arcade-level FIDELITY at 2x and 4x art density for the mission 'ams' flow, so a 4K screen (and 1080p / 1440p) shows far more detailed sprites, levels and animations. NOT the existing sprites scaled up: every UHD frame is drawn natively by new density-generic code with real light, more tones, texture and wear.

THE APPROVED PLAN: ${PLAN} - read it first (Context, User decisions, Fidelity targets, Architecture, your group's section, Style decisions). It is final; do not re-litigate it.
REPORTS OF EARLIER GROUPS (read them; do the requests that name YOUR files): ${PRIOR_REPORTS}
OPEN ITEMS: ${ROOT}/tmp/uhd-polish-todo.md (if it exists) lists known issues found so far; fix the ones that fall inside YOUR files and say so in your report.${FEEDBACK && GROUP !== 'style' ? `\nLEAD NOTES FOR THIS GROUP: ${FEEDBACK}` : ''}
BUDGET: ${ROOT}/tmp/uhd-budget.md once it exists (written by the lead after group 'found').
FIDELITY YARDSTICK: ${ROOT}/tmp/uhd-ref/ (README.md first). ref.png / soldiers.png are a screenshot of the 1990s arcade reference: use them ONLY to judge the LEVEL (tones per material, form shading, contrast, clean clusters, outlines, texture, wear, depth). Never copy, trace or sample colours from them; never put them or any part of them in src/, public/, docs/ or tests/. ours-today-*.png show our game before the wave (keep our identity).

USER DECISIONS (2026-10-19, final):
- New art, not scaled art. Scaling filters (MMPX, xBR, nearest) are never the look.
- HD palette: about 256 colours in 6-8-tone hue-shifted ramps (src/engine/palette-hd.ts, made in group found) for ALL 2x and 4x art; the 1x art keeps the 64-colour palette and stays byte-identical.
- The SAME new drawers make the 2x art and the 4x art (one generator per id taking d in {2, 4}); the old 2x art code is retired group by group (delete it once nothing uses it).
- Density 4 for 4K (backbuffer k = 8). Scope: the ams flow only; m0-m5 keep working passively with their 1x art.
- Fidelity of the reference, never its looks: our characters, Amsterdam, outfits, colour families and the squad's likenesses stay ours (docs/ORIGINALITY.md). Never name any reference game (arcade or first-person) in code, ids, comments or docs.

READ FIRST (only what you need): the plan; docs/ART_GUIDE.md (art rules; "2x art (mission ams)"; "Motion"; the "UHD art" section once group found wrote it); docs/ORIGINALITY.md; docs/ARCHITECTURE.md section 3 (backbuffer, 2x art, 2x scenery) and 6.1 (sprite contract); docs/api/media.md (sprites, PixelBuffer, renderers); src/game/art/portrait-kit.ts (the lit height-field painter: the model for the new art); src/game/art/hd/ (the UHD kit, after group found).

GEOMETRY IS LAW: every 2x and 4x frame has exactly its 1x frame's logical size, anchor and points; terrain cell classification and collision never change; game logic never reads art pixels; sims stay byte-identical. 1x pixels stay byte-identical (tests/engine/fixtures/sprite-geometry.json at density 1, scenery-1x.json).

TEAM RULES
- Other agents work IN PARALLEL in this directory. Edit ONLY the files you own (your task lists them). Never delete, move or rewrite other agents' files. Need a change in a file you do not own? Put the exact request (file + change) in your report.
- tests/engine/fixtures/*.json: never edit them as a builder (the verifier updates them with npm run geometry-fixture). If a fixture test fails ONLY for ids you changed on purpose (their 2x pixels), list those ids in your report.
- Typecheck covers the whole project (npm run typecheck); files others are still writing may show errors - YOUR files must have zero.
- Tests: iterate with your own files (npx vitest run <files> --maxWorkers=2); run the full suite at the end (npx vitest run --maxWorkers=3). Timeouts under machine load: rerun the failed files alone before you call a test red. Rewrite an existing test only when this wave changes the rule it pins (old 2x art details), and say so.
- LOOK at your work (mandatory): npm run sprites -- <prefix> --density 4 --out tmp/<label>/ (and --density 2, --density 1 to check 1x is unchanged), npm run shot -- --mission ams --section <s> --res 8 --art 4 [--bot --god] [--ticks n] --out tmp/<label>/x.png, npm run arena -- ... (docs/api/slice.md). Before group found lands these flags, use the tools as they are. Open every PNG with the Read tool (crop large ones with a short python3 -I PIL script into tmp/<label>/) and judge it against the plan's Fidelity targets AND at its real size: does it read, does it keep our identity, is it clearly more detailed than ours-today?
- Sims: npm run sim -- --mission ams --god --expect-complete (and --section d). Browser smoke: npm run smoke -- --port <your port> --query "<params>". Port 5173 is the user's dev server and 4173 may be another project: never use them.
- No git commands, no new npm dependencies, no audio generation (never call ElevenLabs or read .env.local). Determinism: no Math.random / Date in art; same input, same pixels. No per-tick allocations in hot paths.
- A stopped earlier run of this wave may have left uncommitted changes in files you own (git diff <file>): review them, keep what is right and finish them; never revert another owner's files.
- Some local hooks block commands whose text contains 'dist/' or '.log' paths: write outputs under tmp/<label>/ and avoid those patterns.
- Be economical with tokens: grep, read only what you need, do not re-read large files.

FINAL ANSWER: a concise report (max 450 words): what you built (ids / files / APIs with signatures), test / sim / gate results (numbers), generation ms and frames at 2x and 4x, what you LOOKED at (paths), known issues, what you did NOT finish (be honest), requests for other owners (exact file + change).`

// ------------------------------------------------------------------------------------ areas

const FOUND_ENGINE = {
  key: 'uhd-found-engine',
  port: 5511,
  owns: 'src/engine/sprites.ts, src/engine/render-common.ts, src/engine/render-canvas.browser.ts, src/engine/render-soft.ts, src/engine/render.ts, src/engine/display.browser.ts, src/engine/pixel.ts (density helpers only), src/engine/sprite-pack.ts, src/game/art-registry.ts, src/game/mission/view.ts, src/game/mission/runner.ts (draw density only), src/game/mission/types.ts, src/game/params.ts, src/game/settings.ts, src/game/scenes/options.ts, src/main.ts, src/game/content/missions/ams/index.ts (artDensity only), src/game/content/machines/transport/machine.ts (raw buf.w reads only), tools/sprites.ts, tools/shot.ts, tools/arena.ts, tools/perf.ts, tests/engine/hires-density.test.ts, tests/engine/hires.test.ts, tests/engine/density4.test.ts (new), tests/media/browser.test.ts, tests/media/browser/scene.ts, docs/ARCHITECTURE.md (section 3 and 10), docs/api/media.md',
  task: `ROLE: FOUNDATION - ENGINE (plan Architecture "Tiers and density"; no new art).
- Art tier T in {1, 2, 4}: export artTier(): 1 | 2 | 4 and setArtTier(t) from src/engine/sprites.ts (CONTRACT: the POOL builder reads artTier() in parallel). setArtDensity / withArtDensity accept 1 | 2 | 4. MissionDef.artDensity becomes the mission's highest tier (ams: 4); the runner and the HUD draw at min(mission artDensity, artTier()).
- Registry: per-density generators (one cache per density): keep defineHiSprite(id, gen2x) working and add a density argument or an { hd: (d) => frames } option for one generator serving d 2 and 4; getFrames(id, d) returns the highest density <= d the id has (4 -> 2 -> 1), never an upscale; generic validation (buffer size divisible by d, same frame count, same points as 1x) with failures labelled id@<d>x; listHiSprites(d); installFrames for any d; a non-generating peek (has the frame at d been built?) so the browser at tier 4 can draw the 2x frame and queue the id instead of generating 4x on the main thread (setDeferDense(true)); releaseDense(ids, d) for the working set. sprite-pack: any density.
- Scenery: defineHiBgGenerator / hi terrain painters / SectionView generalised to d in {2, 4} (terrain sub-pixels (sx, sy) in {0..d-1}^2 - keep the 2x API working for the existing painters), only at res >= d, else the next lower density; chunk eviction behind the camera (ams scrolls forward).
- Backbuffer: chooseRes takes the tier: auto tier 4 when the integer display scale s >= 8 with k = 8 (KMAX 8 for tier 4, 6 otherwise); tier 2 for 2 <= s < 8; tier 1 below. d > k falls back to the next lower density (4 -> 2), not straight to 1x (lowRes only for 2 -> 1). Option ART DETAIL (AUTO / 4X / 2X / 1X) in the options scene and settings (bump SETTINGS_VERSION only if the save format needs it), URL ?art=1|2|4. A frame-time governor in src/main.ts: when render + present averages > 8 ms over 2 s at tier 4, drop to tier 2 (k <= 6) once per session and console.info it.
- Canvas renderer: texture budget scales with k (proposal 96 M px at k = 8); faster upload (one byte-order swizzle into a reused ImageData, no per-pixel object path) with an upload time budget per frame; d-frames still never filtered.
- Logic: replace raw f.buf.w / f.buf.h reads in game logic (e.g. machines/transport/machine.ts:294) with frameW / frameH.
- Tools: npm run sprites -- --density 4, shot / arena --art 4 and --res 8, perf at k 8 (also --gpu).
- Tests: tier selection table (s 1-16, both tiers), density 4 frames (fallback 4 -> 2 -> 1, validation, peek, release), browser parity at k = 8 for 4x frames, existing hires tests updated only where the {1,2} clamp was the pinned rule. Sims must stay byte-identical.
- Docs: ARCHITECTURE section 3 (tiers, k = 8, governor) and 10 (budgets), docs/api/media.md (the new APIs).`,
}

const FOUND_POOL = {
  key: 'uhd-found-pool',
  port: 5512,
  owns: 'src/engine/art-pool.ts (new), src/game/art-worker.ts (new worker entry), vite.config.ts, src/game/scenes/gameplay.ts (preloadMissionArt and the density checks only), src/game/art-cache.ts, src/game/scenes/boot.ts (pack restore only), tools/sw/**, tools/cache-check.ts, tools/anim-bench.ts, tests/engine/art-pool.test.ts (new), tests/game/art-pool-preload.test.ts (new)',
  task: `ROLE: FOUNDATION - ART POOL, MEMORY, PACKS (plan Architecture "Generation, memory, caching").
- src/engine/art-pool.ts: a pool of module workers (Vite: new Worker(new URL('../game/art-worker.ts', import.meta.url), { type: 'module' })), size min(navigator.hardwareConcurrency - 1, 8), at least 1. The worker loads the content registry (src/game/content/index.ts, lazy ids on demand), builds the ids it gets at density d, and returns a raw (uncompressed) sprite pack as transferable ArrayBuffers (no SharedArrayBuffer: GitHub Pages cannot set cross-origin isolation headers). Ids of one family (char/<id>/, enemy/<set>, boss/<id>/ ...) go to the same worker. The main thread installs the frames (installFrames). Backends: browser Worker; an in-process backend for node tools and tests; a node worker_threads backend for tools/anim-bench.ts --pool N (wall time). Fallback: today's budgeted main-thread preload when Worker is missing or a worker fails (console.warn once).
- Determinism test: frames built by the pool (in-process backend AND worker_threads) are byte-identical to main-thread getFrames for a sample of hero, rider, boss, fx and decor ids at density 2.
- preloadMissionArt (gameplay.ts): through the pool; reads artTier() (CONTRACT from the ENGINE builder, src/engine/sprites.ts; until it exists, treat the tier as 2). Tier 2: today's 2x set. Tier 4: the WORKING SET in order - the chosen heroes, preloadFirst, the current and next section, the boss at the end - with setDeferDense(true) so nothing 4x is generated on the main thread during play; the other heroes are never built at 4x; on a section change release the ids of sections behind (releaseDense) within DENSE_BUDGET_BYTES (proposal 256 MB).
- art-cache.ts: packs per density and section ('hi' stays for 2x until the rig group retires it; 'hd4-<section>' for 4x), restored at the mission start, not at boot (boot restores only boot and the 2x pack as today). Keyed by the build tag as today.
- tools/sw: precache the worker chunk; npm run cache-check must pass on a build.
- tools/anim-bench.ts: --pool N (wall time with N worker_threads) and --density 4; write the BASELINE tmp/uhd-baseline.json: boot@1x, ams-hi@2x on one thread and with --pool 8 (median of 3).
- Docs: put the text for docs/api/media.md ("Art pool") and ARCHITECTURE ("Sprite cache") in your report; the verifier writes it in.`,
}

const FOUND_KIT = {
  key: 'uhd-found-kit',
  port: 5513,
  owns: 'src/engine/palette-hd.ts (new), src/game/art/hd/** (new folder), tools/uhd-spike.ts (new), package.json (scripts only: uhd-spike), tests/art/palette-hd.test.ts (new), tests/art/hd-kit.test.ts (new), docs/ART_GUIDE.md (a new "UHD art" section only)',
  task: `ROLE: FOUNDATION - THE UHD ART KIT AND THE FIRST STYLE SPIKE (plan "Fidelity targets", Architecture, group found KIT). You set the look of the whole wave: aim for the yardstick's LEVEL with our own designs.
- src/engine/palette-hd.ts: PAL_HD, about 256 unique colours in named ramps of 6-8 tones, dark -> light, hue-shifted (shadows lean cool purple/blue, highlights lean warm yellow, saturation peaks in the mid-tones - the 64-palette's own style statement), covering every material family of the 64 palette (ink, steel, stone, olive, sand, skin tones, leather, rust, fire, red, orange, gold, teal, foliage, sky, water, brick, wood, cloth colours, snow/white ...) plus the Amsterdam needs (brick reds, canal greens, gable whites). Every 64-palette swatch appears in PAL_HD at a sensible ramp position; a map hdRampOf(Ramp) from each 64-palette ramp to its HD ramp. Test: count <= 256, unique, luma monotonic per ramp, every 64 swatch present.
- src/game/art/hd/ (density-generic, logical units, d in {2, 4}): an HdCanvas (logical w x h at density d; float logical coordinates; draws into a PixelBuffer of (w*d) x (h*d)); lit primitives - capsule, ellipsoid, box, cylinder, plane with a normal function, a height field (generalise the portrait-kit painter, src/game/art/portrait-kit.ts); a light model (key light from the upper left, cool bounce on the shadow side, rim, ambient occlusion where parts meet, specular for metal/glass/wet) that quantises to an HD ramp with hard bands (sprites) or an ordered dither at band borders (backgrounds); a cluster clean-up (no orphan pixels except speculars, no jaggy band edges); outline variants A (ink, 1 logical px = d art px), B (1/2 logical px), C (selective: the deepest ramp tone, ink only on the shadow side), interior separations in the darker part's deepest tone; material textures in logical units with finer detail at d = 4: brick + mortar, plaster + cracks + stains, wood grain, cobbles, cloth folds, foliage clusters, water ripples. Fast: per-pixel work in tight loops, no per-pixel allocation.
- Rig contracts as working prototypes (the rig group replaces their bodies later): src/game/art/hd/head.ts renderHeadHd(s: HeadStyle, expr: Expression, d: 2 | 4, opts?: { glint?: boolean }): PixelBuffer (exactly HEAD_W*d x HEAD_H*d, the same logical layout as renderHead: NECK and HEAD_CENTER at d times them); src/game/art/hd/gear.ts gunArtHd(kind, d), heldArtHd(item, d), knifeArtHd(d), propArtHd(kind, d) - each exactly d times the size of its 1x art (gunArt / grenadeArt / knifeArt / propArt in src/game/art/humanoid-gear.ts) with the same logical anchor points.
- STYLE SPIKE: tools/uhd-spike.ts (npm run uhd-spike -- [--out tmp/uhd-style]) renders, at 2x AND 4x: (1) a hero (the recruit's colours) in idle, one run frame and a shooting frame, built from lit prototype parts (capsule limbs, a lit torso volume with folds and a belt, boots, the prototype head and gun); (2) the Swan's head and neck (white plumage feathers, the steel and orange parts); (3) a 128 x 96 logical street crop: a canal house facade (brick, gable, window with frame and reflection), a street lamp, a tree, cobbles, a quay edge and canal water. Each next to TODAY's 2x art of the same subject at the same scale (getFrames of char/recruit/ idle, the Swan, an ams section a shot crop), in outline variants A, B and C, and a sheet of PAL_HD (--palette). Write an index tmp/uhd-style/index.md listing every PNG. Nothing is registered in the game.
- LOOK hard at every spike PNG against the yardstick (level) and ours-today (identity); iterate until the 4x hero clearly shows 5-6 tones per material, volume, folds and clean clusters.
- docs/ART_GUIDE.md "UHD art" section: the fidelity targets, PAL_HD, the kit API with a short example, the outline variants (choice pending), the rig contracts.`,
}

const STYLE_KIT = {
  key: 'uhd-style-kit',
  port: 5513,
  owns: FOUND_KIT.owns,
  task: `ROLE: STYLE ITERATION (re-runnable). Apply the USER'S FEEDBACK below to the UHD kit, PAL_HD and the style spike only (nothing registered in the game). Keep the rig contracts' signatures. Re-render tmp/uhd-style/ (all subjects at 2x and 4x next to today's art; update index.md, add a short "what changed" list at its top). Follow the plan's "Style decisions" where they are filled in.
USER'S FEEDBACK: ${FEEDBACK || '(none given - improve the weakest subject against the Fidelity targets and the yardstick level)'}`,
}

const RIG_HEADS = {
  key: 'uhd-rig-heads',
  port: 5511,
  owns: 'src/game/art/hd/head.ts, src/game/art/humanoid-head.ts (exports and hooks only), src/game/art/portrait-kit.ts (exports only), src/game/content/characters/portrait.art.ts and select.art.ts (exports only), tests/art/hd-head.test.ts (new)',
  task: `ROLE: RIG - HEADS (stage 1). renderHeadHd(s, expr, d) for EVERY HeadStyle the game uses (all hair styles, headgear, extras, all expressions; tilt and glint as the 2x path does), painted with the kit's height field and light: skull, ears, brows, eyes with iris / pupil / highlight at 4x, nose and mouth shading, hair as lit strand clusters, headgear with seams and shine. Start from the style-approved head in src/game/art/hd/head.ts (style round 1: locks with a fringe, visible ear, big eye) and fix its open notes: the light horizontal cheek band and the ear that reads like a blush spot. The five squad members keep the likeness cues of their select portraits (reuse the portrait-kit face definitions; export what you need). Exactly HEAD_W*d x HEAD_H*d, same layout. Test: sizes, layout points, determinism, every style x expression renders. LOOK at a contact sheet of all heads at 2x and 4x next to today's 2x heads.`,
}

const RIG_GEAR = {
  key: 'uhd-rig-gear',
  port: 5512,
  owns: 'src/game/art/hd/gear.ts, src/game/art/humanoid-gear.ts (exports and hooks only), tests/art/hd-gear.test.ts (new)',
  task: `ROLE: RIG - GEAR (stage 1). gunArtHd (pistol, heavy, rifle: slide, grip texture, screws, muzzle, specular steel), heldArtHd (grenade, snack, gift), knifeArtHd, propArtHd for every PropKind (umbrella, needles, pan, wrench, plan, pistol-butt, plunger, airliner, frikandel), and an HD hand drawer for every HandShape at d (knuckles and fingers at 4x) with the same signature idea as drawHand. Exactly d times the 1x art size with the same logical anchor points. Tests: sizes, anchors, determinism. LOOK at sheets at 2x and 4x next to today's 2x gear.`,
}

const RIG_PIECES = {
  key: 'uhd-rig-pieces',
  port: 5513,
  owns: 'src/game/content/characters/{vincent,thom,dirk,bob,patrick,grace,mittens,pip,gramps}.art.ts, src/game/content/characters/pieces.ts, tests/content/hd-pieces.test.ts (new)',
  task: `ROLE: RIG - HERO PIECES (stage 1). Every hero-specific piece and prop table in the hero files (piece(..., hiRows) templates, custom held items, fidget props) gets an HD drawer at d in {2, 4} built with the kit (no ASCII doubling), the same logical footprint and anchors as its 1x twin. Expose them through the same table entries the rig reads (add an hd field next to hiRows; keep hiRows until the BODY builder switches over). Tests: sizes, anchors. LOOK at each hero's pieces at 2x and 4x.`,
}

const RIG_BODY = {
  key: 'uhd-rig-body',
  port: 5514,
  owns: 'src/game/art/humanoid.ts, src/game/art/hd/body.ts (new), src/engine/art-pool.ts (familyOf only), src/game/art/human-sprites.ts, src/game/art/human-fx.ts, src/game/art/hi-strips.ts, src/game/art/humanoid-head-hi.ts (delete when unused), src/game/content/characters/art.ts, src/game/content/characters/helium.ts, tests/content/characters.test.ts, tests/art/sprites.test.ts, tests/art/hd-body.test.ts (new)',
  task: `ROLE: RIG - BODY AND REGISTRATION (stage 2; heads, gear and pieces are done - read their reports above). THE APPROVED LOOK is the style spike's hero (tools/uhd-spike.ts drawHero / POSES, tmp/uhd-style/hero@4x.png and hero@2x.png; kit APIs blob, limb, along, rimLight in src/game/art/hd/): port that approach into the rig so EVERY pose of poses.ts renders that way (the spike only had 3 poses); fix its open note: the near sleeve in idle is a large tan shape - give it an elbow bend and a cuff at 2x too. BUDGET (tmp/uhd-budget.md, binding): average <= 4 ms per 4x hero frame on one thread (cache lit limb segments per style and angle if needed); split familyOf('char/<hero>/...') in src/engine/art-pool.ts by strip family (legs / torso-<w> / full) so one hero spreads over >= 4 workers; report the chosen-hero 4x pool wall time (npm run anim-bench -- hero:recruit --density 4 --pool 8 or a row you add). In humanoid.ts: Density = 1 | 2 | 4; the HD path for d in {2, 4} draws limbs and torso with the kit (lit volumes, folds at elbows and knees, belts, straps, pouches, boots with soles and laces at 4x, collar and sleeve seams) using renderHeadHd, the HD gear and the HD pieces; joints at 1/d logical px (generalise HALF_PX_JOINTS; the 1x path keeps whole pixels and stays byte-identical); renderHuman keeps the 1x frame geometry (size, anchor, points). Retire the old 2x body and head drawers (delete humanoid-head-hi.ts and the 2x-only branches once nothing uses them; riders, handhaver, people and hostages call renderHuman too - they must keep working at 2x). Register d 2 and 4 for EVERY hero strip (all 10 heroes, Helium twins, deferred strips keep defer) via the new registry API. Tests: geometry at 1/2/4 equal, motion gate unchanged, no duplicate frames at 4x, 1x fixture unchanged. LOOK at char/recruit/, char/patrick/, char/vincent/ at 2x and 4x (sheets and an ams shot at --res 8 --art 4) next to ours-today.`,
}

const CAST = [
  { key: 'uhd-cast-swan', port: 5511, owns: 'src/game/content/vehicles/swan/** (art files: kit.art.ts, body.art.ts, head.art.ts, poses.art.ts, extras.art.ts, art.ts; draw.ts only for density), tests/content/swan-hi.test.ts, tests/content/swan-hd.test.ts (new)', task: 'ROLE: CAST - THE METAL SWAN. One HD generator (d 2 and 4) for every Swan id: lit white plumage with feather layers, steel plates with rivets and specular, orange beak and parts, eyes, the rider seat; the old 2x Swan code retired. Seat and all points unchanged. LOOK at sheets and a shot with the Swan (npm run arena -- --vehicle).' },
  { key: 'uhd-cast-boss', port: 5512, owns: 'src/game/content/bosses/ams/** (art.ts, art-hi.ts, art-shots.ts, canvas.ts, look.ts), tests/content/boss-ams.test.ts, tests/content/boss-ams-anim.test.ts, tests/content/boss-ams-hd.test.ts (new)', task: 'ROLE: CAST - ROBO-HALSEMA. canvas.ts DCanvas at d 2 and 4 with the kit; the robot body, the face (likeness rules in docs/ORIGINALITY.md, the ams exception), the chain and medallion (gold specular), the wig, the stamp arm, the spring, the legs, her shots - all lit HD; the old 2x templates retired. Telegraph timings and geometry unchanged. LOOK at section d shots (--res 8 --art 4).' },
  { key: 'uhd-cast-locals', port: 5513, owns: 'src/game/content/locals/** (rider.art.ts, seagull.art.ts, handhaver.art.ts, fatbike-youth.ts, delivery-rider.ts, art.ts), tests/content/riders-anim.test.ts, tests/content/locals.test.ts, tests/content/locals-hd.test.ts (new)', task: 'ROLE: CAST - LOCALS. Riders: the bikes (frames, wheels with spokes and tyre tread, delivery boxes, lights) HD at d 2 and 4, riders through renderHuman at d 4, all 27 sets (share parts, mind the budget); the gull (feather layers, beak, eye); the handhaver (uniform, cap, ticket book). Old 2x code retired. LOOK at sections a-c shots.' },
  { key: 'uhd-cast-people', port: 5514, owns: 'src/game/content/missions/ams/npc.art.ts, src/game/content/missions/ams/npc-hi.art.ts, src/game/content/missions/ams/ambient.ts (art only), src/game/content/items/hostage.art.ts, src/game/content/items/binds.art.ts, tests/content/people-anim.test.ts, tests/content/ambient-anim.test.ts, tests/content/people-hd.test.ts (new)', task: 'ROLE: CAST - PEOPLE AND AMBIENT LIFE. Baker, hot-dog vendor, staff, the tourist hostage and binds, window waver and cat, pigeons, ducks, the tour boat: HD at d 2 and 4 (humans via renderHuman at d), aprons, props, feathers, the boat hull with reflections. Old 2x code retired. LOOK at sections a-d shots.' },
  { key: 'uhd-cast-fx', port: 5515, owns: 'src/game/content/fx/**, src/game/content/weapons/art.ts, src/game/content/weapons/shots.art.ts, src/game/content/items/pickups.art.ts, src/game/content/items/pickups-hi.art.ts, src/game/content/items/crate.art.ts, src/engine/particles.ts (draw only), src/game/fx.ts (draw only), tests/content/fx.test.ts, tests/content/fx-hd.test.ts (new)', task: 'ROLE: CAST - FX, SHOTS, ITEMS. Explosions (lit fire volumes, smoke with soft dithered edges, sparks), muzzle flashes, tracers, shots, smoke puffs, splashes, the parachute, pickups and crates (wood grain, metal corners, labels) HD at d 2 and 4; runtime particles and lines drawn in art pixels (1/d logical px) at tier >= 2 without per-tick allocation. Old 2x code retired. LOOK at combat shots.' },
]

const CITY = [
  { key: 'uhd-city-ab', port: 5511, owns: 'src/game/content/missions/ams/art-hi-ab*.ts and new art-hd-ab*.ts files, tests/art/ams-ab-hd.test.ts (new)', task: 'ROLE: CITY - SECTIONS A AND B DECOR. Canal houses (brick bond with mortar and weathering, gables, cornices, window frames with glass reflections and curtains, doors, shop fronts, the frites shop sign lettering crisp at d), bikes, lamps, flags, bollards, trees with lit leaf clusters: HD at d 2 and 4 with the kit and PAL_HD; old 2x code retired. LOOK at section a and b shots at --res 8 --art 4 next to ours-today-2x.png.' },
  { key: 'uhd-city-cd', port: 5512, owns: 'src/game/content/missions/ams/art-hi-cd*.ts, art-hi-boat.ts, art-hi-canopy.ts and new art-hd-cd*.ts files, src/game/content/missions/ams/breakables.ts (art only), tests/art/ams-cd-hd.test.ts (new)', task: 'ROLE: CITY - SECTIONS C AND D DECOR. The museum and civic buildings, breakables (with HD damage states), boats, canopies, the boss arena dressing: HD at d 2 and 4; old 2x code retired. LOOK at section c and d shots.' },
  { key: 'uhd-city-sky', port: 5513, owns: 'src/game/content/missions/ams/art-hi-sky.ts, art-hi-bg.ts, backgrounds-hi.ts and new art-hd-sky*.ts / art-hd-bg*.ts files, tests/art/ams-bg-hd.test.ts (new)', task: 'ROLE: CITY - SKY AND BACKGROUND LAYERS. Sky with soft dithered gradients and painted clouds, the skyline and far layers with atmospheric perspective (lighter, cooler, less contrast with distance), towers and roofs with detail scaled by depth: HD at d 2 and 4 for every layer; memory per layer inside the budget; old 2x code retired. LOOK at full-screen shots of every section.' },
  { key: 'uhd-city-terrain', port: 5514, owns: 'src/game/content/missions/ams/art-hi-terrain.ts and new art-hd-terrain*.ts files, src/game/art/terrain-art.ts, tests/art/scenery-hi.test.ts, tests/art/ams-terrain-hd.test.ts (new)', task: 'ROLE: CITY - TERRAIN AND WATER. Street and quay materials (cobbles each with a lit edge, kerb stones, brick paths, quay walls with algae and wet stains, bridge masonry, railings), the canal surface with ripples, highlights and reflections: HD terrain painters at d in {2, 4} with the SAME cell classification (collision unchanged; carry the scenery-hi tests to d = 4); old 2x painters retired. LOOK at every section shot.' },
]

const SCREENS = [
  { key: 'uhd-screens-font', port: 5511, owns: 'src/engine/font.ts, the text path in src/engine/render-canvas.browser.ts and src/engine/render-soft.ts, src/game/hud.ts, src/game/content/ui/hud.art.ts, src/game/content/weapons/icons.art.ts, tests/engine/font-hd.test.ts (new)', task: 'ROLE: SCREENS - FONT AND HUD. Designed HD glyph tables for both fonts at d 2 and 4 (same advances and line heights, so layoutText / measure do not change; smooth strokes, crisp corners, the outline style of the style decisions), glyphAtlas per density in both renderers; HUD icons, bars, timer, boss bar, banners and speech bubbles HD at d 2 and 4. LOOK at gameplay shots with the HUD and at every menu with text.' },
  { key: 'uhd-screens-menus', port: 5512, owns: 'src/game/scenes/{base,title,mode-select,how-to-play,controls,character-select,mission-intro,pause,continue}.ts, src/game/content/ui/{logo,military,screens,art,cards}.art.ts or .ts files, tests/content/ui-hd.test.ts (new)', task: 'ROLE: SCREENS - MENUS. Title backdrop and logo, mode select, the military frame, shutters, plates and badges, the soldier select (the preview drawn at the tier), the mission intro radio panel and portrait, pause and continue gags: HD at d 2 and 4 at the tier (setArtDensity(2) in character-select becomes the tier). LOOK at every screen at --res 8 --art 4.' },
  { key: 'uhd-screens-ending', port: 5513, owns: 'src/game/scenes/{glitch-bridge,ending,final-tally,name-entry,high-scores,heads,lake}.ts, src/game/content/ui/ending.art.ts, tests/content/ending-hd.test.ts (new)', task: 'ROLE: SCREENS - ENDING FLOW. Glitch bridge card, the ending backdrops (night, dawn, street, lake), the victory poses at the tier, final tally, name entry, high-score heads: HD at d 2 and 4. LOOK at each screen.' },
  { key: 'uhd-screens-fps', port: 5514, owns: 'src/engine/ray/**, src/game/fps/hud.ts, src/game/content/fps/**, src/game/art/wall-tex.ts, src/game/scenes/{fps,fps-intro,fps-tally}.ts, tests/engine/ray-hd.test.ts (new)', task: 'ROLE: SCREENS - FIRST-PERSON MODE. RayView at density 2 and 4 inside its frame budget (docs/design/fps.md: measure; drop to 2 at tier 4 if 4 is over budget), per-texture sizes (wall textures painted at 128 / 256 with the kit), billboards at a higher size, the fps view weapon sprites, its HUD bar and face at the tier, the fps pack per density. Never name the reference first-person game anywhere. LOOK at fps shots.' },
]

const LENSES = [
  { key: 'uhd-lens-fidelity', ask: 'FIDELITY lens: render 2x and 4x sheets and --res 8 --art 4 shots of every section, the boss, the start screens, the HUD and the FPS mode. Judge every plan Fidelity target (tones per material, light, form, clusters, outline, texture and wear, depth, identity) against tmp/uhd-ref/ (LEVEL only) and ours-today (identity). Report concrete ids / frames / screen regions that fall short, with the PNG path.' },
  { key: 'uhd-lens-gameplay', ask: 'GAMEPLAY lens: geometry (logical size, anchors, points) equal at densities 1, 2 and 4 for every id; terrain classification unchanged; 1x fixtures byte-identical; sims byte-identical to before the wave (npm run sim -- --mission ams --god --expect-complete, --section d, m0, m2); no logic reads art pixels; the tier fallback 4 -> 2 -> 1 never shows a placeholder. Report concrete failures with evidence.' },
  { key: 'uhd-lens-perf', ask: 'PERF lens: npm run anim-bench (one thread and --pool 8, densities 1 / 2 / 4) vs tmp/uhd-baseline.json and tmp/uhd-budget.md; memory of the tier-4 working set; frame time at k 8 (npm run perf, also --gpu) and the governor on the CPU renderer; boot@1x unchanged; pack sizes; per-tick allocations added. Report numbers and concrete offenders.' },
]

// ------------------------------------------------------------------------------------ prompts

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    gates: {
      type: 'object',
      properties: { typecheck: { type: 'string' }, tests: { type: 'string' }, build: { type: 'string' }, sim: { type: 'string' }, smoke: { type: 'string' }, bench: { type: 'string' } },
      required: ['typecheck', 'tests', 'build', 'sim', 'smoke', 'bench'],
    },
    looked: { type: 'string' },
    fixed: { type: 'array', items: { type: 'string' } },
    unfinished: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'gates', 'looked', 'fixed', 'unfinished'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { severity: { type: 'string', enum: ['high', 'medium', 'low'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
        required: ['severity', 'problem', 'evidence', 'fix'],
      },
    },
  },
  required: ['findings'],
}

function builderPrompt(a, earlier) {
  return `${PRE}

YOUR LABEL: ${a.key} (tool output goes to tmp/${a.key}/). YOUR PORT: ${a.port}.
YOU OWN: ${a.owns}
${earlier ? `\nREPORTS OF THE EARLIER STAGE OF THIS GROUP (build on them):\n${earlier}\n` : ''}
${a.task}

DONE WHEN: everything above is built and registered (where your task says so); your tests pass; typecheck is clean for your files; you LOOKED at your work at 2x and 4x (and checked 1x is unchanged) and judged it against the Fidelity targets; the full suite is green (or every failure is explained and owned by someone else).`
}

function verifierPrompt(label, scope, owns, reports, extra) {
  return `${PRE}

YOUR LABEL: ${label} (tool output goes to tmp/${label}/). YOUR PORT: 5519.
ROLE: ADVERSARIAL VERIFIER AND INTEGRATOR for group '${GROUP}': ${scope}. The builders are done (reports below). Assume their reports are optimistic. Check every claim against the plan, LOOK at the art yourself at 2x and 4x (sheets and --res 8 --art 4 shots, every PNG opened), judge it against the Fidelity targets and tmp/uhd-ref/ (level only), and fix what is wrong or missing.
YOU OWN (for fixes): ${owns}. You alone may run npm run geometry-fixture -- <ids> for 2x / 4x art the wave changes ON PURPOSE (list every id you rewrite and why; 1x entries must not change).

REPORTS:
${reports}

${extra}

GATES (all must pass at the end, report numbers): npm run typecheck; npx vitest run --maxWorkers=3 (rerun timeouts alone); npx vite build --outDir tmp/${label}/out --emptyOutDir; npm run sim -- --mission ams --god --expect-complete; npm run sim -- --mission ams --section d --god --expect-complete; npm run sim -- --mission m0 --god --expect-complete; npm run sim -- --mission m2 --god --expect-complete (all tick counts equal to before the group); npm run smoke -- --port 5519 --query "mission=ams"; npm run anim-bench (with --pool and --density 4 once they exist) vs tmp/uhd-baseline.json and tmp/uhd-budget.md when they exist.

HAND-OFF: write ${ROOT}/tmp/uhd-${GROUP}-report.md (max 700 words): what this group built (ids, files, APIs with signatures), gate numbers, bench numbers (2x and 4x, one thread and pool), what you LOOKED at (paths of the best 2x / 4x sheets and shots for the lead's demo page), known issues, requests for later groups.

FINAL ANSWER: the structured result - summary (max 250 words), gate results with numbers, what you LOOKED at, what you fixed, what remains unfinished.`
}

const reportsOf = (areas, rs) => areas.map((a, i) => `=== ${a.key} === (owns: ${a.owns})\n${rs[i] || '(no report - the agent failed: check this area yourself and finish what is missing)'}`).join('\n\n')

// stages: an array of arrays of areas; each stage runs in parallel, the next stage gets the earlier reports.
async function buildAndVerify(stages, scope, extra) {
  phase('Build')
  const all = []
  const rsAll = []
  for (const stage of stages) {
    const earlier = all.length ? reportsOf(all, rsAll) : ''
    const rs = await parallel(stage.map((a) => () => agent(builderPrompt(a, earlier), { label: `build:${a.key}`, phase: 'Build', effort: 'xhigh' })))
    all.push(...stage)
    rsAll.push(...rs)
  }
  phase('Verify')
  const owns = `every file of this group: ${all.map((a) => a.owns).join('; ')}`
  const v = await agent(verifierPrompt(`uhd-${GROUP}-verify`, scope, owns, reportsOf(all, rsAll), extra || ''), { label: `verify:${GROUP}`, phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'xhigh' })
  return { group: GROUP, builders: all.map((a, i) => ({ key: a.key, ok: Boolean(rsAll[i]) })), verify: v }
}

let result = { group: GROUP }

if (GROUP === 'found') {
  result = await buildAndVerify([[FOUND_ENGINE, FOUND_POOL, FOUND_KIT]], 'the foundation: tiers and density 4, k = 8, the art pool and packs, the HD palette and kit, the rig contracts, the first style spike', 'Extra checks: sims byte-identical; 1x fixtures unchanged; pool output byte-identical to the main thread; tier table tests; tmp/uhd-baseline.json exists (median of 3); tmp/uhd-style/index.md lists every spike PNG and you judged them; nothing new is registered in the game yet (the 2x art is still today\'s).')
} else if (GROUP === 'style') {
  result = await buildAndVerify([[STYLE_KIT]], 'a style iteration of the UHD kit and spike', 'Extra checks: only the kit, PAL_HD, the spike tool and their tests and docs changed; the spike shows the user feedback applied; the rig contract signatures are unchanged.')
} else if (GROUP === 'rig') {
  result = await buildAndVerify([[RIG_HEADS, RIG_GEAR, RIG_PIECES], [RIG_BODY]], 'the rig: every human figure at 2x and 4x (heads, gear, hero pieces, body, registration)', 'Extra checks: riders, handhaver, people and hostages still render at 1x and 2x (they use renderHuman); hero strips registered at 4; geometry equal at 1/2/4; the old 2x head / gear templates deleted only when unused; the 4x hero reads at its real size in an ams shot.')
} else if (GROUP === 'cast') {
  result = await buildAndVerify([CAST], 'the cast: the Swan, ROBO-HALSEMA, the locals, people and ambient life, fx, shots and items at 2x and 4x', 'Extra checks: telegraph and tell timings unchanged; seat, muzzle and hit points unchanged; the 27 rider sets inside the budget; runtime particles allocate nothing per tick.')
} else if (GROUP === 'city') {
  result = await buildAndVerify([CITY], 'the levels: decor, sky and layers, terrain and water at 2x and 4x', 'Extra checks: terrain classification and collision unchanged (scenery tests at d 2 and 4); memory per section at tier 4 inside the budget; chunk eviction works; full-screen shots of sections a-d at --res 8 --art 4.')
} else if (GROUP === 'screens') {
  result = await buildAndVerify([SCREENS], 'everything outside the mission: font, HUD, menus, ending flow, FPS mode at 2x and 4x', 'Extra checks: text layout numbers unchanged (measure / layoutText); the FPS frame budget; every screen of the ams route (boot -> title -> select -> intro -> gameplay -> glitch bridge -> fps -> tally -> ending -> name entry -> high scores) captured at --res 8 --art 4.')
} else if (GROUP === 'polish') {
  phase('Build')
  const found = await parallel(LENSES.map((l, i) => () => agent(`${PRE}\n\nYOUR LABEL: ${l.key} (tool output goes to tmp/${l.key}/). YOUR PORT: ${5516 + i}. You are a READ-ONLY reviewer: do not edit source files (writing into tmp/ is fine).\nROLE: ${l.ask}\nOPEN ITEMS: ${ROOT}/tmp/uhd-polish-todo.md (if it exists) lists known issues of the earlier groups; confirm or refute the ones in your lens (with evidence) and add new ones.\nReport only real, verified problems with evidence (file:line, a PNG path you looked at, a number). Max 15 findings, most severe first.`, { label: `review:${l.key}`, phase: 'Build', schema: FINDINGS_SCHEMA, effort: 'xhigh' })))
  const all = found.filter(Boolean).flatMap((f) => f.findings || [])
  log(`${all.length} findings from ${found.filter(Boolean).length} lenses`)
  // Three fixers on disjoint files (one fixer cannot hold ~40 findings, ~34 open items and the docs), then the verifier integrates.
  const FINDINGS = `FINDINGS FROM THE REVIEW PANEL (verify each before fixing; skip false ones and say why; take the ones inside YOUR files):\n${JSON.stringify(all, null, 1)}`
  const TODO = `OPEN ITEMS: ${ROOT}/tmp/uhd-polish-todo.md - work through the items listed for you below (fix what is safe and inside tmp/uhd-budget.md); in your report say fixed / skipped and why for every one of them.`
  const FIX = [
    { key: 'uhd-polish-perf', port: 5511, owns: 'src/engine/** (sprites, art-pool, ray, render*, perf, pixel), src/game/scenes/gameplay.ts, src/game/art-cache.ts, src/game/art-worker.ts, src/game/fps/**, src/game/content/fps/dense-load.ts, src/game/scenes/{glitch-bridge,fps,fps-intro,fps-tally}.ts (runtime and memory only), src/game/content/missions/ams/index.ts (preload lists only), tools/** except tools/uhd-spike.ts, and the tests of these files',
      task: `ROLE: POLISH FIXER - PERFORMANCE AND MEMORY (the PERF lens findings and the engine side of the others).\n${TODO} Yours: 2, 3, 4, 5, 18, 23, 25, 26, 29 (two players and two different heroes still 262-282 MB at tier 4: find a cut that keeps every section <= 256 MB, or show why not), 30 (the FPS GPU budget: follow the LEAD DECISION in the item), 34 (preload lists, the hd2-fps pack, shot --res / --art for --fps), item 24's working-set filter if the ART fixer needs it.\n${FINDINGS}` },
    { key: 'uhd-polish-art', port: 5512, owns: 'src/game/art/** (hd kit, rig, human-fx, humanoid*), src/game/content/** art files (*.art.ts, art-hd*.ts, art-hi*.ts, hd/**, rider.hd.ts, layout.ts, canvas.ts, pieces.ts, fps/{faces,figure-hd,walls-hd,fx-hd,ray-art}.ts, ui/**), src/game/scenes/{options,character-select,base}.ts (cursor and portraits only), tests/engine/fixtures/sprite-geometry.json (2x / 4x entries you change on purpose; never 1x), and the tests of these files',
      task: `ROLE: POLISH FIXER - ART FIDELITY (the FIDELITY lens findings, and the GAMEPLAY lens findings in art files).\n${TODO} Yours: 7, 9, 10, 11, 12, 14 (retire the old 2x templates that nothing uses - but KEEP renderHeadHi / humanoid-head-hi.ts for the 1x FPS face, item 33), 19, 20, 22, 24 (only if its art stays out of the ams tier-4 set; else skip and say why), 27, 31, 32. Prioritise what a player sees most at 4K: the heroes, the street, the boss, the HUD, the FPS gun. 1x pixels stay byte-identical (hash before and after).\n${FINDINGS}` },
    { key: 'uhd-polish-docs', port: 5513, owns: 'docs/** and tools/uhd-spike.ts',
      task: `ROLE: POLISH FIXER - DOCS. Bring the docs to what was actually built in this wave (read the reports of every group: found, style, rig, cast, city, screens, and git log -12): docs/ART_GUIDE.md ("UHD art"; retire the "2x art (mission ams)" rules that no longer apply; the rig at d 2 / 4, fitFrame, the Helium head d 8, the tight 1x region, the familyOf hero split, dense aliases, decor is section art and never preloadFirst), docs/ARCHITECTURE.md sections 3, 5.4, 6.1 and 10 (tiers, the art pool, the working set and budget, packs), docs/api/media.md (the HD kit, defineHdSprite / defineDenseAlias, defineHdBgGenerator / BgCanvas, defineHdTerrainMaterial / defineHdTerrainHang / paintTerrainHd, HD particles, the screen art API, the HD text API), docs/design/squad.md, docs/design/swan-mount/look.md §5.6, docs/design/fps.md §3.4-3.5; tools/uhd-spike.ts labels (todaySwan). ${TODO} Yours: 15, 21, 28 and the docs part of 34. Docs only: never edit source files; keep each doc's style and length discipline; never write banned names.\n${FINDINGS}` },
  ]
  const fixed = await parallel(FIX.map((a) => () => agent(builderPrompt(a, ''), { label: `fix:${a.key}`, phase: 'Build', effort: 'xhigh' })))
  phase('Verify')
  const v = await agent(verifierPrompt('uhd-polish-verify', 'the final polish of the UHD wave (three fixers: perf, art, docs)', 'every file changed in this wave (src/**, tests/**, docs/**, tools/**) - keep changes minimal and safe', reportsOf(FIX, fixed),
    `${FINDINGS}\n\nOPEN ITEMS: check the fixers' fixed / skipped list against ${ROOT}/tmp/uhd-polish-todo.md and finish what is safe; in the hand-off give fixed / skipped and why for EVERY item.\nEXTRA: the full ams route in a browser at 3840 x 2160 with ?mission=ams&art=4 (smoke / Playwright screenshots) with no placeholder and 0 errors; 1x byte-identical to ${ROOT}/.claude/snapshots/uhd-pre-polish.tgz.`), { label: 'verify:polish', phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'xhigh' })
  result = { group: GROUP, findings: all.length, fixers: FIX.map((a, i) => ({ key: a.key, ok: Boolean(fixed[i]) })), verify: v }
} else {
  log(`Unknown group "${GROUP}". Use one of: ${ORDER.join(', ')}`)
}

return result
