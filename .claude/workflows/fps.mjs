export const meta = {
  name: 'fps',
  description: 'First-person mode after mission ams, one group per run (args.group: spec | engine-a | engine-b | cast | audio-gen | floors | audio-ship | polish): builders, then adversarial review/verify',
  phases: [
    { title: 'Build', detail: 'the group builders' },
    { title: 'Review', detail: 'independent read-only lenses' },
    { title: 'Verify', detail: 'adversarial verify, fixes, gates' },
  ],
}

const ROOT = '/Users/everdingen/Projects/private/metal-swan-3'
const PLAN = '/Users/everdingen/.claude/plans/next-up-i-want-vast-mccarthy.md'
const GROUP = args && args.group ? String(args.group) : ''

const PRE = `You are one agent in a team building METAL SWAN 3 - an ORIGINAL browser arcade run-and-gun shooter (TypeScript + Vite, zero runtime dependencies, custom engine, Canvas 2D 384x216, fixed 60 Hz, code-generated pixel art). Project root: ${ROOT} - run every command from there. Branch: fps-mode.

The user asked (2026-10-16) to work as autonomously as possible: never stop to ask; use your best judgment, follow the spec, leave everything working, and list real open questions in your report.

STATE: the game is built and green. Mission 'ams' (Amsterdam, MISSION 1, boss ROBO-HALSEMA) is the only mission that matters; m0-m5 must keep passively working (existing tests and sims pass) but get no new work.

THIS WAVE: after the ams boss dies, the game changes style, direction and gameplay. It becomes a first-person raycaster shooter in the style of the 1992 classic genre-founder: the player shoots Nazi soldiers with the classic mechanics (pickups, ammo, health, keys, doors, push-wall secrets, treasure, lives). 1 floor + a separate boss floor; the final boss is "MechaHitler" (mech suit phase, then on foot). Then the ending.
THE APPROVED PLAN: ${PLAN} - read it first. It holds the user's decisions, the architecture, the gameplay numbers and the build order.

USER DECISIONS (2026-10-14, final - do not re-litigate):
- Transition: glitch + story bridge right after the ams boss; it skips the ams tally screen and MISSION 2.
- Historical Nazi symbols (swastika banners/flags) are allowed in this mode; the enemies are the villains.
- Classic red blood in this mode only (the rest of the game stays bloodless).
- The in-game NAME of the mode comes later from the user: use the constant MODE_TITLE (placeholder 'OPERATION ???'). Never write the reference game's name ('Wolfenstein') anywhere in the game, code, ids or docs except in docs/ORIGINALITY.md where it names what must not be copied.
- Audio: ElevenLabs takes are wanted and every sound first gets a synth fallback. The user approved generation (2026-10-16), but only the audio-gen task calls the ElevenLabs API; nobody else does.
- Boss face (user decision 2026-10-16, "face only"): the phase-1 mech suit wears the user's own pixel-art face "Mecha Hofmans" (art-src/user/, imported to palette data, spec 0 item 10, 7.1, 8.7) and speaks three Dutch lines the user wrote (spec 7.4, speaker 'mecha', already generated). The name MECHAHITLER, the phases and phase 2 stay unchanged.
- Co-op: only P1 plays the mode; P2's slot waits and carries over.
- Controls: keyboard + optional pointer-lock mouse look + gamepad.
ORIGINALITY: copy genre MECHANICS only. Never copy the reference game's maps/layouts, sprites, textures, music, sound effects, voice lines (its famous German shouts and death lines), menu text or treasure designs. MechaHitler is a mech caricature of a historical figure: an original design, a DESIGNED voice that never imitates the real person.

READ FIRST (only what you need): ${PLAN}; ${ROOT}/tmp/fps-engine-b-reports.md (what the engine-b group built, and its requests for other owners: do the ones for YOUR files); docs/design/fps.md (THE SPEC for this wave once group 'spec' has written it - it wins over the GDD for this mode); docs/ORIGINALITY.md; docs/ARCHITECTURE.md (hard rules section 2, content folders section 7, tooling section 9); docs/api/media.md (pixels, sprites, renderer, audio), docs/api/game.md (registries, session, scenes), docs/api/sim.md, docs/api/audio-pipeline.md; docs/ART_GUIDE.md for art.

TEAM RULES
- Other agents may work IN PARALLEL in this directory. Edit ONLY the files you own (your task lists them). Never delete, move or rewrite other agents' files.
- Typecheck covers the whole project (npm run typecheck); files others are still writing may show errors - YOUR files must have zero.
- Tests: iterate with your own test files (npx vitest run <files> --maxWorkers=2); run the full suite at the end (npx vitest run --maxWorkers=3). Never leave the suite red because of your files.
- Visual feedback is mandatory for anything visible: render PNGs (npm run shot / npm run sprites, or the fps shot tool once it exists) into tmp/<your label>/ and open them with the Read tool. LOOK at them.
- Browser smoke: npm run smoke -- --port <your port> --query "<params>" (only YOUR port; port 5173 is the user's dev server - never touch it).
- No git commands except read-only git status / git diff / git log. No new npm dependencies. Deterministic simulation (Rng; no Math.random, Date, performance or DOM outside *.browser.ts). No per-tick allocations in hot paths. 64-colour palette only (src/engine/palette.ts).
- Be economical with tokens: grep, read only what you need, do not re-read large files.

FINAL ANSWER: a concise report (max 450 words): what you built (ids, files), test/gate results (numbers), what you LOOKED at, known issues, what you did NOT finish (be honest), and requests for other owners (exact file + change).`

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    gates: {
      type: 'object',
      properties: { typecheck: { type: 'string' }, tests: { type: 'string' }, build: { type: 'string' }, sim: { type: 'string' }, smoke: { type: 'string' } },
      required: ['typecheck', 'tests', 'build', 'sim', 'smoke'],
    },
    looked: { type: 'string' },
    fixed: { type: 'array', items: { type: 'string' } },
    unfinished: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'gates', 'looked', 'fixed', 'unfinished', 'openQuestions'],
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

// ---------------------------------------------------------------- group: spec

const SPEC = {
  key: 'spec',
  owns: 'docs/design/fps.md (new), docs/api/fps.md (new, API skeleton for the builders), docs/ORIGINALITY.md (add a dated section), docs/ART_GUIDE.md (add a dated section), docs/ARCHITECTURE.md (rule-2 audio exception, new layers, lazy content), docs/GAME_DESIGN.md (short pointer section + flow/score rows only)',
  task: `ROLE: WRITE THE SPEC for the first-person mode. No source code in this group - docs only.
Turn the approved plan into docs/design/fps.md, a complete, buildable spec that later agents follow without guessing. It wins over the GDD for this mode. Verify every code fact you cite (file:line) against the current code before writing it.

docs/design/fps.md must contain, with exact numbers (ticks at 60 Hz, tiles, HP, px):
0. Status line + "decisions" list (the user decisions above, dated 2026-10-14) + open items (MODE_TITLE name; MISSION 1 BONUS line; m1-m5 unreachable in a normal run).
1. Flow: hook (MissionDef.after = 'fps' checked in the GameplayScene 'complete' handler, src/game/scenes/gameplay.ts ~248), recordMissionClear extraction (find the exact bookkeeping in src/game/scenes/mission-complete.ts), GlitchBridgeScene phases with tick timings, story card text (draft 4-6 short lines, English, Metal Swan comedic tone that bridges Amsterdam to a 3D castle - mark as draft), FpsIntroScene (lazy load + floor card), FpsScene, FpsTallyScene, the route to EndingScene/FinalTallyScene, death/floor restart rules, continue (Continuable interface, shared session.credits), PauseHost, final-tally golden-record route list, P2 handling, debug params (?mode=fps|bridge&floor=0|1|2, ?debug=1 map overlay, F4).
2. Controls: FpsAction list and default keys (keyboard, mouse, gamepad), sensitivity, pointer-lock rules, fallback mapping from the 8-button pad; the settings rows.
3. Engine contract: the ray/ module API (types and signatures from the plan), units (tile = 1.0, integer angle 4096), view size 384x176 + 40 px status bar, the stream DrawOpts, texture and billboard formats (64x64 column-major, 8 yaws), lazy content + prepareRayAssets, perf budget (render <= 2 ms headless at density 1; zero per-tick allocations).
4. Gameplay numbers: player speeds (walk/run/turn per tick), radius, HP, ammo cap, weapons (fire timing in ticks, ammo use, damage bands by distance), enemies (HP per difficulty, speeds, reaction times, tell >= 18 ticks before every shot, attack damage bands, hit chance rules, drops, score), dogs, sight and noise rules (areas linked by open doors), pickups with values, keys/doors/push walls timings, elevator, floor tally formula (kill/secret/treasure %, par), face states, score/extends interplay with PlayerSlot. Mark each value G (genre convention) or I (invented).
5. Map format: the full ASCII legend (one char per tile/thing; walls by texture, doors with axis, locked doors, keys, push walls, starts with facing, enemies with patrol/ambush/difficulty markers, every pickup, props (solid/non-solid), elevator switch, boss), plus a separate things[] list for options a char cannot carry. Validation rules (closed border, keys reachable before their doors, every secret reachable, ammo budget >= enemy HP budget x 1.5 on normal).
6. Floor plans: Floor 0 test range (small); Floor 1 "Supply Depot" 48x48 (9 rooms, forced key loop, 5 secrets, enemy counts per difficulty) and Floor 2 "Hangar" 32x32 (antechamber, supply room with guaranteed chaingun, 18x18 arena). Give a room-by-room plan with approximate tile coordinates and contents. Original layouts only (do NOT reproduce any reference-game map; the start is a wrecked freight car, not a prison cell).
7. MechaHitler: look (original mech design - describe it), size, both phases (HP per difficulty, speeds, weapons, attack patterns with tell/burst/recover ticks, reinforcements), death sequence (death-cam slow motion), taunts (6 original German lines + English subtitles; must not match reference-game lines), score.
8. Art list with ids: wall textures (incl. banners with the historical symbol as the user decided), billboard sets per enemy (anim x yaws x frames), props, pickups, weapon view sprites, HUD status bar layout (pixel positions), face frames, blood (pools, hit spurts, death frames). Palette-only rule.
9. Audio list with ids: sfx (fps/*), songs (fps-floor, fps-boss, fps-tally, fps-bridge), voice lines (original German shouts per enemy type, MechaHitler lines), which ones get ElevenLabs takes, the new sample group 'mode:fps', and voice design notes (designed voices only).
10. Tests and tools: the test files and what they prove; headless-fps + bot-fps; shot/sim/perf flags; map validators.
11. Build groups and file ownership (engine | cast | floors || flow | audio-spec -> user gate -> audio-ship | polish), with the owner of every new or changed file, so parallel agents never collide.

Also write:
- docs/api/fps.md: a skeleton API reference (sections for ray engine, input actions, fps game, content registration, tools) that builders fill in; mark unbuilt parts 'TODO (group X)'.
- docs/ORIGINALITY.md: a section "Exception: the first-person mode (2026-10-14)" in the style of the ams exception: what the user decided (historical symbols, red blood in this mode, MechaHitler as caricature with a designed voice), what is still banned (the reference game's name in the game, maps, sprites, textures, music, sfx, voice lines, menu text, treasure designs), and a self-check list.
- docs/ART_GUIDE.md: a dated blood exception for this mode only + a short raycaster art section (texture size, side shading, billboard rules).
- docs/ARCHITECTURE.md: extend the audio/asset exception of rule 2 to sample group 'mode:fps'; add src/engine/ray/ and src/game/fps/ to the layer description; describe lazy content modules.
- docs/GAME_DESIGN.md: one short pointer section ("First-person mode - see docs/design/fps.md") and the flow change.
Keep docs in the existing style. Do not edit any source file.`,
}

// ------------------------------------------------- shared rule for build groups

const OWN_NOTE = 'If docs/design/fps.md section 11 (file ownership) assigns files differently from this list, the spec wins - but never edit a file another agent of YOUR group owns.'

// -------------------------------------------------------------- group: engine

const RAY = {
  key: 'ray',
  port: 5501,
  owns: 'src/engine/ray/** (new), tests/engine/ray/** (new), the ray-engine section of docs/api/fps.md',
  task: `ROLE: THE RAYCASTER ENGINE (pure, genre-agnostic, deterministic, no game ids). Build exactly the API in docs/design/fps.md section 3 (and the plan): fixed.ts (integer angles, SIN/COS tables), grid.ts (RayGrid SoA, DoorTable, PushWall), cast.ts (DDA castRay into a reused RayHit, doors at the tile centre with an open fraction, push-wall offset, lineOfSight), textures.ts (defineRayTexture / defineRayBillboard from code-generated PixelBuffers, column-major 64x64 + opaque spans, darker variant for the other side, magenta fallback with one warning, time-budgeted prepareRayAssets mirroring preloadSprites in src/engine/sprites.ts), view.ts (RayView {buf: PixelBuffer, zbuf}; renderView: flat ceiling/floor colours, textured wall columns with perpendicular distance (no fisheye), billboards sorted far->near with per-column z-buffer test and opaque spans, buf.touch()), move.ts (tryMove: axis-separated box vs tiles, closed doors and actor blockers), areas.ts (area flood fill, door links, reach recompute on door change).
RULES: zero allocations per call in castRay/renderView/tryMove (preallocate in constructors); doubles for positions in tile units; exact results for the same inputs.
TEST (tests/engine/ray/*.test.ts): axis and diagonal hits and perpendicular distance; door fractions; push-wall offset; lineOfSight; collision sliding, corners, doors, blockers; area reach when a door opens/closes; texture layout/spans/fallback; renderView symmetry facing a flat wall, z-buffer hides a billboard behind a wall, a golden hash at fixed poses, buffers reused; a timing check (print the ms per 384x176 frame).
LOOK: write a tiny script under tmp/fps-ray/ that renders a test grid with SoftRenderer/PixelBuffer to PNG (tools/lib/image.ts savePNG) at several poses and open the PNGs. ${OWN_NOTE}`,
}

const MEDIA = {
  key: 'media',
  port: 5502,
  owns: 'src/engine/render.ts (only the optional DrawOpts.stream field + doc), src/engine/render-canvas.browser.ts, src/engine/render-soft.ts (only if needed for stream parity), tests/media/browser.test.ts, tests/engine/helpers.ts (RecordingRenderer only if the contract change needs it), docs/api/media.md (stream section)',
  task: `ROLE: THE STREAMING RENDER PATH. Add the optional DrawOpts.stream ("contents change most frames; never cached as a texture"). CanvasRenderer: for image()/frame() with stream and no tint/flip/src, keep one slot per PixelBuffer {canvas, ctx, ImageData, Uint32 view}, on a version change convert 0xRRGGBBAA -> canvas byte order (little-endian check) and putImageData, then draw it with the same placement/scaling as today; slots live outside the LRU budget and are evicted after 120 unused frames; textureStats() reports streams and streamUploads. SoftRenderer must give identical pixels (it may ignore the flag). No per-frame allocations on the stream path.
TEST: extend tests/media/browser.test.ts - a stream buffer that changes 3 times, Canvas vs Soft identical at res 1 and 3, and exactly one slot reused (streams === 1). Run the existing media tests. ${OWN_NOTE}`,
}

const INPUT = {
  key: 'input',
  port: 5503,
  owns: 'src/engine/input-actions.ts (new), src/engine/input.ts (additive only), src/engine/input.browser.ts, src/engine/pointer.browser.ts (new), src/main.ts (wiring only), src/game/app.ts (pointerLockWanted + accessors only), src/game/settings.ts and src/game/scenes/options.ts (MOUSE LOOK, SENSITIVITY rows), tests/engine/input-actions.test.ts (new) and the existing input/settings/options tests if they need new rows, the input section of docs/api/fps.md',
  task: `ROLE: THE FPS INPUT LAYER, exactly as docs/design/fps.md section 2 says. The 8-bit Button pad stays UNCHANGED (menus, side-scroller, bot, rebinding untouched). Add input-actions.ts (FpsAction 16-bit mask, ActionPad held/pressed/released with tick counts, AnalogState {turn, moveX, moveY} cleared each tick, FpsKeyMap defaults, actionsFromPad fallback); InputManager gains actions, analog and fpsMode (only polled for slot 0 when fpsMode is on); InputSource gains optional readActions?/readAnalog?; ScriptedSource accepts optional actions/turn per tick for deterministic tests. KeyboardSource maps keys via the FpsKeyMap; GamepadSource reads left stick move/strafe and right stick X turn (quantised ints); PointerLockSource (pointer.browser.ts): movementX -> integer turn with carried remainder and sensitivity, LMB fire, RMB use, wheel cycles weapon. main.ts: request pointer lock on canvas click when app.pointerLockWanted and the MOUSE LOOK setting is on; losing the lock while playing signals pause (app flag). Settings rows: MOUSE LOOK on/off, SENSITIVITY 1-10, persisted like the others.
TEST: action pad edges, pad fallback, scripted actions/analog, remainder carry, settings persistence. Existing input tests must stay green. ${OWN_NOTE}`,
}

const SHELL = {
  key: 'fps-shell',
  port: 5504,
  owns: 'src/game/fps/{types,registry,map,game,player,doors,pushwall,run}.ts (new), src/game/scenes/fps.ts and fps-intro.ts (new), src/game/content/fps/{index,names,floor-0,textures-basic}.ts (new; textures-basic = simple placeholder wall textures until the art group lands), src/game/content/index.ts (add LAZY fps entries + the isLazy filter), src/game/scenes/boot.ts (lazy filter + ?mode=fps branch), src/game/params.ts (?mode=fps|bridge, ?floor=), src/sim/headless-fps.ts (new), tools/shot.ts (--fps flag only), tests/game/fps/{map,doors,pushwall,determinism,scene}.test.ts (new), the game/tools sections of docs/api/fps.md',
  task: `ROLE: THE PLAYABLE SHELL. Using the ray engine and input layer (reports below), build: FpsFloorDef/FpsEpisodeDef types + registry; parseFloor (ASCII legend from docs/design/fps.md section 5, fail-soft warnings); FpsGame with step(input) and stateHash(), the player (movement, run, turn, strafe, collision radius, use-to-open doors, push walls), doors (timings from the spec, stay open while blocked, locked doors respect keys), push walls; FpsIntroScene (lazy import of fps content with a progress bar, then the floor card using MODE_TITLE from content/fps/names.ts) and FpsScene (owns update/draw; renders the RayView via r.image(..., {stream:true}); a basic status bar with HP/ammo/score placeholders; pause via the existing pause flow if it can be done without touching pause.ts, else Esc returns to title for now and note it); Floor 0 test range (a small map using every wall type, doors, a locked door + key, a push wall); ?mode=fps&floor=0 in params/boot (new session P1). Content modules under fps/ are LAZY: boot must not import or generate them.
Headless: src/sim/headless-fps.ts createHeadlessFps({floor, seed, input, pose}) and npm run shot -- --fps <floor> [--pose x,y,deg] [--ticks n] [--every n --count k] --out <png>.
TEST: map parsing, doors, push walls, determinism (same seed + timeline -> same hash), the scene starts headless and renders without magenta. LOOK at shot sheets of floor 0. Smoke: npm run smoke -- --port 5504 --query "mode=fps&floor=0". ${OWN_NOTE}`,
}

// ---------------------------------------------------------------- group: cast

const ACTORS = {
  key: 'actors',
  port: 5511,
  owns: 'src/game/fps/{actors,ai,hitscan,weapons,pickups,hud,audio}.ts (new), src/game/content/fps/lines.ts (new), src/game/scenes/fps.ts (only: swap the shell drawBar for hud.ts and draw the weapon view) + the combat/pickup parts of src/game/fps/{game,player}.ts, src/game/content/fps/floor-0.ts (add enemies/pickups for testing), tests/game/fps/{actors,ai,hitscan,weapons,pickups,hud}.test.ts (new), the actor sections of docs/api/fps.md',
  task: `ROLE: ENEMIES, COMBAT, PICKUPS, HUD - exactly the numbers in docs/design/fps.md section 4. Actor pool (preallocated), table-driven states (stand, path, chase, attack with a tell >= 18 ticks, pain, die, dead), sight (angle + lineOfSight, ambush flag), noise through areas linked by open doors, chase/dodge direction choice, guard/officer/SS/dog behaviour, distance-band hitscan both ways with the game rng, drops; player weapons knife/pistol/MG/chaingun (timings, ammo, silent knife), weapon switching; all pickups with caps and refusals; keys; treasure score via the PlayerSlot (extends still work); blood decals/pools; the status bar HUD (layout from spec section 8: floor, score, lives, face, health, ammo, keys, weapon) and the weapon view + face states, using the sprite ids the art group defines in spec section 8 (they may not exist yet: unknown ids draw magenta - that is fine); positional sfx (pan/volume from angle and reach) by the sfx ids in spec section 9. Place every enemy and pickup type on floor 0 for testing. Write src/game/content/fps/lines.ts (spec 9.3) with every spoken string VERBATIM from the spec, including the three Dutch mecha taunts with their \\n exactly as in spec 7.4 (tests/tools/audio-spec.test.ts checks that each tools/audio/spec.ts line text appears in src/ verbatim; it is red until lines.ts exists).
TEST: AI wake by sight and noise (not through closed doors), tell >= 18 ticks before every shot, damage distributions per band (seeded), pickup caps, weapon fire rates, knife silent, drops, death/blood. ${OWN_NOTE}`,
}

const ART = {
  key: 'art',
  port: 5512,
  owns: 'src/game/art/figure3d.ts (new), src/game/art/wall-tex.ts (new), tools/art/import-face.ts (new), src/game/content/fps/art/mecha-face.gen.ts (generated), package.json (the art:import-face script line only), src/game/content/fps/{textures,billboards,props,pickups-art,hud-art,weapon-art}.ts (new; registered through content/fps/art.ts as spec sections 3.6 and 11 say), tests/art/fps-*.test.ts (new), docs/ART_GUIDE.md (raycaster art notes)',
  task: `ROLE: ALL FPS ART, with exactly the ids in docs/design/fps.md section 8 - code-generated, palette-only, original. A 3D joint rig (figure3d.ts) that renders 64x64 billboards at 8 yaws (render 5, mirror 3) for guard, officer, SS (1940s German uniforms: field grey, caps/helmets, boots; officer and SS distinct), a dog, MechaHitler mech suit (larger) and MechaHitler on foot; animations stand, walk x4, tell, shoot, pain, die with red blood; corpses. Wall textures 64x64 exactly as the list in spec section 8.1 (it replaces any older list; banners/flags carry the historical symbol, nothing else does), tiling without seams. Props, pickups (food, first aid, dog food, clip, MG, chaingun, 1UP, keys, original treasures, golden record), weapon view sprites (4 weapons x idle + fire frames), the HUD status bar pieces and the face frames (based on the chosen Metal Swan hero, 7 health bands x 3 glances + grin + ouch + dead). Do not trace or copy the reference game's sprites. THE MECH SUIT FACE: build the user-art import of spec section 8.7 first (tools/art/import-face.ts -> src/game/content/fps/art/mecha-face.gen.ts; PNG decode only in the tool, with node:zlib - no new npm dependency), then paint the phase-1 suit in the style of art-src/user/mecha-hofmans-full.png (dark plates, glowing orange-red seams, red reactor core, spiked fins, brass horn pods) with the imported face big on top, exactly as spec 7.1 says (yaws, eye flare on tell, crack on break, dead face on the wreck). LOOK at the suit at 1x in a raycast shot from 3, 6 and 10 tiles: the face must read as the user's art.
TEST: every id exists and has the spec'd size/frame count; palette-only. LOOK: npm run sprites -- fps/ contact sheets at 1x and zoomed; fix what reads badly. ${OWN_NOTE}`,
}

const SOUND = {
  key: 'fps-sound',
  port: 5513,
  owns: 'src/game/content/fps/{sound,sfx,music}.ts (new; content/fps/sound.ts registers them), tests/content/fps-sound.test.ts (new), tools/lib/audio-report.ts + audio-report.entry.ts (loadContent(() => true) only), docs/api/sfx.md (fps section)',
  task: `ROLE: SYNTH FALLBACKS for every fps sound id and the 4 songs in docs/design/fps.md section 9 (fps/* sfx; songs fps-floor, fps-boss, fps-tally, fps-bridge). Use the synth (defineSfx recipes via content/sfx/kit.ts helpers) and the tracker (defineSong, pattern of content/music/*.ts). Original melodies only (a brooding martial floor theme, a driving boss theme, a short tally jingle, a glitchy bridge sting). Wordless synth stand-ins for voice lines are fine. If tests/content/sfx.test.ts checks the id list against the GDD, add the ids where it expects them.
TEST + LISTEN: npm run audio -- fps --wav (check loudness against the ams songs), loops clean. ${OWN_NOTE}`,
}

// -------------------------------------------------------------- group: floors

const FLOORS = {
  key: 'floors',
  port: 5521,
  owns: 'src/game/content/fps/{floor-1,floor-2,episode}.ts (new), src/game/fps/boss.ts (new) + boss hooks in src/game/fps/{actors,game}.ts, src/game/fps/validate.ts (new map validators), src/game/scenes/fps-tally.ts (new), src/sim/bot-fps.ts (new), tools/sim.ts (--mode fps --floor flags only), tests/game/fps/{floors,boss,validate,tally}.test.ts, tests/sim/fps-bot.test.ts (new), the floors/boss/play-test sections of docs/api/fps.md',
  task: `ROLE: THE FLOORS, THE BOSS, THE TALLY, THE BOT. Build floor 1 "Supply Depot" and floor 2 "Hangar" from docs/design/fps.md sections 6-7 as ASCII maps (original layouts; difficulty markers; patrols; 5 secrets on floor 1; a golden record in a secret per floor); the episode def (floor order, par times, music). MechaHitler: both phases with the spec's HP/speeds/patterns/tells/reinforcements, the wreck as a solid obstacle, death-cam slow motion, taunts as subtitled bubbles. The floor tally scene (kill/secret/treasure %, par, bonuses, MISSION 1 BONUS line on floor 1 if the flow group provides the value via session.records). Map validators (closed border, keys reachable before their doors, secrets reachable, ammo budget). The fps bot (BFS through keys -> doors -> elevator, fights, picks up health/ammo when low) and npm run sim -- --mode fps --floor n [--god] [--seed n] [--expect-complete].
TEST: validators on both floors, boss phases, tally math, bot clears floor 1 and 2 with --god on seeds 1-3. LOOK: shot sheets of every room and the boss. ${OWN_NOTE}`,
}

const FLOW = {
  key: 'flow',
  port: 5522,
  owns: 'tools/smoke.ts (accept mode=fps|bridge like mission=: skip the title wait, expect FpsScene/GlitchBridgeScene), src/game/scenes/fps.ts (only the PauseHost / Continuable wiring the engine-b report asks for), src/game/mission/types.ts (MissionDef.after), src/game/content/missions/ams/index.ts (after: \'fps\' only), src/game/scenes/{gameplay,flow,mission-complete,pause,continue,game-over,ending,final-tally,flow-data}.ts (only the changes the spec section 1 lists), src/game/scenes/glitch-bridge.ts (new), src/game/content/fps/story.ts (new), src/game/params.ts + src/game/scenes/boot.ts (?mode=bridge only), tests/game/scenes.test.ts, tests/content/mission-ams.test.ts, tests/game/fps/flow.test.ts (new), docs/GAME_DESIGN.md flow rows',
  task: `ROLE: THE ROUTE. Exactly docs/design/fps.md section 1: MissionDef.after; the GameplayScene 'complete' hook to GlitchBridgeScene; recordMissionClear extracted and called by both paths; the ams tally points added silently and stored for the MISSION 1 BONUS line (session.records key from the spec); GlitchBridgeScene (snapshot of the last ams frame, glitch, story card from content/fps/story.ts, fold into 3D, then FpsIntroScene floor 1); the route floor 1 -> tally -> floor 2 -> tally -> EndingScene fps variant -> FinalTallyScene; PauseHost and Continuable interfaces so pause and continue work from FpsScene (shared session.credits); P2 slot waits unchanged; final-tally golden-record list by route; ?mode=bridge. The fps scenes and tally are built by other agents in parallel (fps.ts exists from the engine group; fps-tally.ts is being written by the floors agent - import it by the name in the spec).
TEST: the route in tests/game/fps/flow.test.ts (headless: ams complete -> bridge -> fps intro), pause/continue/game over from fps, final tally route, P2 unchanged; existing scenes and mission-ams tests green (update only deliberate changes). Smoke: --query "mission=ams&boss=1&debug=1&god=1" (F4) and "mode=bridge". ${OWN_NOTE}`,
}

// ---------------------------------------------------------- groups: audio-gen, audio-ship

const AUDIO_GEN = {
  key: 'audio-gen',
  owns: 'tools/audio/** (spec entries for the fps ids and the squad drill callouts; small pipeline fixes), tools/audio/voices.json, tmp/audio/**, docs/api/audio-pipeline.md (fps section) (NOT src/**, NOT public/audio/**: audio-ship ships later)',
  task: `ROLE: GENERATE THE ELEVENLABS TAKES for the fps mode. The user approved spending credits (2026-10-16, "proceed with generating audio, don't wait for my permission"); hard budget for this task: 150,000 credits (check with npm run audio:gen -- credits before and after; pass --budget). Read docs/api/audio-pipeline.md and tools/elevenlabs.ts + tools/audio/*. The 'mode:fps' group, the robot filter and the 'mecha' voice + its 3 lines already exist (do NOT regenerate them; their picks are in tmp/audio/picks.json).
1. Add spec entries (group 'mode:fps') for every fps sfx id and the 4 songs of docs/design/fps.md section 9, and every voice line of spec 9.3 / 7.4 except the mecha ones (exact game text, as in spec; German shouts are original lines). Voices guard, officer, ss, mechahitler: DESIGNED voices from the spec's descriptions (never a clone, never the account's cloned voices of real people, never a named person; prompts never name games, songs, films or artists). mechahitler lines get the robot/horn treatment the spec asks for (phase 1 lines are the mecha's now; his own taunts 4-6 are on foot: no robot filter).
2. Also generate the REPORT FOR DUTY drill-sergeant callouts that tools/audio/spec.ts already lists (speaker 'drill', group 'boot') if they have no takes yet.
3. Make tools/audio/{process,review}.ts see the fps ids if they need content loaded (loadContent(() => true)).
4. npm run audio:gen -- plan (write the estimate to tmp/audio/fps-estimate.md), then generate: design (2 designs per speaker), pick the preview whose median pitch and pace best fit the description (measure with ffmpeg/numpy in python3 -I; never print the API key; never read .env.local yourself - the tools do), design-save, then sfx, music and lines; npm run audio:process for the new ids.
5. PICK the takes yourself (the user is away and asked for autonomy): reject takes that are silent, clipped, too long for maxSeconds/trimTo, or whose loop seam clicks; prefer the take closest to the spec timing; write the picks into tmp/audio/picks.json (keep every existing pick). Also run npm run audio:review so the user can re-pick later, and say where the page is.
6. Tests: npx vitest run tests/tools (audio-spec 'verbatim' may stay red only for lines whose text is not in src/ yet - list them).
REPORT: credits used, ids generated, picks and why, failures. ${OWN_NOTE}`,
}

const AUDIO_SHIP = {
  key: 'audio-ship',
  port: 5531,
  owns: 'public/audio/** (via npm run audio:ship only), src/game/content/samples/** (manifest via the ship tool + index wiring), src/engine/samples.ts (SAMPLE_GROUPS: add mode:fps), the lazy-load hook that loads the mode:fps sample group in src/game/scenes/fps-intro.ts (that one call only), tools/audio/ship.ts, tests/content/samples.test.ts, docs/api/audio-pipeline.md, docs/ARCHITECTURE.md (rule-2 audio exception text only)',
  task: `ROLE: SHIP THE PICKED TAKES. npm run audio:ship -- --dry-run, then npm run audio:ship: public/audio/<group dir>/ for 'mode:fps' (and the boot drill callouts), the regenerated manifest, the 'mode:fps' sample group in src/engine/samples.ts, loaded by FpsIntroScene behind its progress bar (never at boot), the synth stays the fallback for every id. The voice lines are found by voiceKey(text) through audio.say / audio.hasVoice (spec 9.3); the mecha lines must play on taunts 1-3. Do not touch the four user music ids (title, select, ams, ams-boss: HAND_MUSIC).
TEST: tests/content/samples.test.ts + the full suite; npm run build (check the dist size growth and report it); smoke ?mode=fps&floor=2 (or floor 0) with --port 5531 and check in the network log that the fps samples load only when the mode starts. ${OWN_NOTE}`,
}

function verifierPrompt(label, port, scope, owns, reports, extra) {
  return `${PRE}

YOUR LABEL: ${label} (tool output goes to tmp/fps-${label}/). YOUR PORT: ${port}.
ROLE: ADVERSARIAL VERIFIER AND INTEGRATOR for: ${scope}. The builders are done (reports below). Assume their reports are optimistic. Check the claims yourself, play it like a player would, LOOK at the frames, and fix what is wrong (missing wiring between areas included).
YOU OWN (for fixes): ${owns}

REPORTS:
${reports}

${extra}

GATES (all must pass at the end, report numbers): npm run typecheck; npx vitest run --maxWorkers=3; npx vite build --outDir tmp/fps-${label}/dist --emptyOutDir; the sims named above; npm run smoke -- --port ${port} --query "<the right query>".

FINAL ANSWER: the structured result - summary (max 250 words), gate results with numbers, what you LOOKED at, what you fixed, what remains unfinished, open questions for the user (max 5).`
}

function builderPrompt(a) {
  return `${PRE}

YOUR LABEL: ${a.key} (tool output goes to tmp/fps-${a.key}/).${a.port ? ` YOUR PORT: ${a.port}.` : ''}
YOU OWN: ${a.owns}

${a.task}`
}

const reportsOf = (areas, rs) => areas.map((a, i) => `=== ${a.key} === (owns: ${a.owns})\n${rs[i] || '(no report - the agent failed: check this area yourself and finish what is missing)'}`).join('\n\n')

let result = { group: GROUP }

if (GROUP === 'spec') {
  phase('Build')
  const r = await agent(builderPrompt(SPEC), { label: 'build:spec', phase: 'Build' })
  phase('Review')
  const LENSES = [
    { key: 'review-feasible', ask: 'ENGINE AND CODE FEASIBILITY: check docs/design/fps.md against the real code (src/engine/render.ts, render-canvas.browser.ts, render-soft.ts, input.ts, input.browser.ts, sprites.ts, samples.ts, src/game/scenes/{gameplay,flow,mission-complete,pause,continue,final-tally,ending,boot}.ts, src/game/session.ts, src/game/params.ts, src/game/content/index.ts). Find wrong file:line facts, APIs that do not exist or have other signatures, contract changes that would break the ~1334 existing tests, hidden coupling (e.g. scenes that assume a GameplayScene/MissionRunner), determinism or allocation problems, perf risks, and file-ownership collisions between the build groups.' },
    { key: 'review-game', ask: 'GAME DESIGN AND COMPLETENESS: check docs/design/fps.md as a game designer who knows the 1992 genre-founder well. Are the mechanics faithful (speeds, damage bands, pickups, doors, push walls, AI states, sound propagation, tally) and correctly converted to 60 Hz? Are any numbers missing, contradictory or untestable? Are the floor plans buildable, the key loop forced, the secrets reachable, the ammo/health budget fair on each difficulty? Is the boss fight fair (tells >= 18 ticks, cover, pickups) and climactic? Is the bridge flow complete (credits, continue, P2, game over, final tally)?' },
    { key: 'review-original', ask: 'ORIGINALITY AND RULES: check docs/design/fps.md, docs/ORIGINALITY.md, docs/ART_GUIDE.md, docs/ARCHITECTURE.md and docs/GAME_DESIGN.md changes. Find anything copied from the reference game beyond genre mechanics: its name used in-game, map layouts (compare the floor plans with its well-known first floors), signature voice lines or German shouts, treasure/item designs, the face-portrait art description, menu text, music descriptions; voice design that would imitate a real person; prompts naming games/artists. Check that the dated exceptions record the user decisions exactly (historical symbols, red blood only in this mode, designed voice) and that the bloodless rule still holds elsewhere. Check the docs match each other.' },
  ]
  const found = await parallel(LENSES.map((l) => () => agent(`${PRE}\n\nYOUR LABEL: ${l.key}. You are a READ-ONLY reviewer: do not edit any file.\nTHE SPEC WRITER REPORTED:\n${r || '(no report)'}\n\nROLE: ${l.ask}\nReport only real, verified problems with evidence (file:line or spec section). Max 15 findings, most severe first.`, { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS_SCHEMA })))
  const all = found.filter(Boolean).flatMap((f) => f.findings || [])
  log(`spec: ${all.length} review findings`)
  phase('Verify')
  const v = await agent(`${PRE}

YOUR LABEL: spec-fix.
ROLE: ADVERSARIAL VERIFIER AND EDITOR of the spec. You own the same docs as the spec writer: ${SPEC.owns}. Do not edit source files.
THE WRITER REPORTED:
${r || '(no report - the writer failed: write the spec yourself, following the plan)'}

FINDINGS FROM THE REVIEW PANEL (verify each one against the code/docs before acting; skip false ones and say why):
${JSON.stringify(all, null, 1)}

Fix every real finding, most severe first. Then re-read docs/design/fps.md end to end once: it must be complete enough that the engine group can start without questions. Gates for this docs-only group: npm run typecheck and npx vitest run --maxWorkers=3 must still pass (they should be untouched; some tests parse docs, e.g. GDD id lists). Put "n/a (docs only)" for build/sim/smoke. List in openQuestions only the questions that truly need the USER (e.g. the mode name, anything the plan left open) - max 5.`, { label: 'verify:spec', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, build: r, findings: all, verify: v }
} else if (GROUP === 'engine-a') {
  phase('Build')
  const first = await parallel([RAY, MEDIA, INPUT].map((a) => () => agent(builderPrompt(a), { label: `build:${a.key}`, phase: 'Build' })))
  result = { group: GROUP, ray: first[0], media: first[1], input: first[2] }
} else if (GROUP === 'engine-b') {
  const REPORTS_FILE = `${ROOT}/tmp/fps-engine-a-reports.md`
  const first = [`(read ${REPORTS_FILE}, section ray)`, `(read ${REPORTS_FILE}, section media)`, `(read ${REPORTS_FILE}, section input)`]
  phase('Build')
  const shell = await agent(builderPrompt({ ...SHELL, task: `${SHELL.task}\n\nREPORTS OF THE ENGINE BUILDERS (use their real APIs):\n${reportsOf([RAY, MEDIA, INPUT], first)}` }), { label: 'build:fps-shell', phase: 'Build' })
  phase('Verify')
  const areas = [RAY, MEDIA, INPUT, SHELL]
  const v = await agent(verifierPrompt('engine-verify', 5509, 'the raycaster engine, the streaming render path, the fps input layer and the FpsScene shell with floor 0', areas.map((a) => a.owns).join('; '), reportsOf(areas, [...first, shell]),
    `CHECK: walk floor 0 like a player (headless fps shot sheets at many poses: walls straight, no fisheye, no gaps or seams between columns, doors open/close and render at the tile centre, push wall slides 2 tiles, collision slides along walls and never lets you through a wall or closed door, side shading); the Canvas and Soft renderers give the same pixels for the stream path (tests/media/browser.test.ts) and the stream path allocates no new canvas per frame; keyboard, scripted actions and the pointer-lock source (unit tests; smoke with ?mode=fps&floor=0); determinism (same seed + input timeline -> same stateHash); zero per-tick allocations in castRay/renderView/tryMove (read the code); render time per frame headless at density 1 (target <= 2 ms; report the number); boot time not slower (fps content is lazy: check boot.ts/preload does not generate fps art); the ~1334 existing tests still pass (no weakened tests); ams sim still completes (npm run sim -- --mission ams --god --expect-complete).`), { label: 'verify:engine', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, ray: first[0], media: first[1], input: first[2], shell, verify: v }
} else if (GROUP === 'cast') {
  phase('Build')
  const rs = await parallel([ACTORS, ART, SOUND].map((a) => () => agent(builderPrompt(a), { label: `build:${a.key}`, phase: 'Build' })))
  phase('Verify')
  const areas = [ACTORS, ART, SOUND]
  const v = await agent(verifierPrompt('cast-verify', 5519, 'the fps actors/combat/pickups/HUD, the fps art and the fps synth sounds and songs', areas.map((a) => a.owns).join('; '), reportsOf(areas, rs),
    `CHECK: wire-up between the three areas (actor sprite ids exist in the art; sfx ids exist; HUD sprites exist; no magenta placeholders in shots). Play floor 0 with every enemy type and pickup placed (headless shots + scripted input): enemies stand/patrol, notice by sight and by gunfire through open doors (not through closed ones), chase, show a readable tell >= 18 ticks before each shot, shoot with distance-band damage, take pain, die with red blood, drop clips; dogs bite; the knife is silent; every pickup applies its value and caps; weapon switching and fire rates; the face reacts. LOOK at the 8-yaw contact sheets of every enemy (npm run sprites -- fps/) at 1x and zoomed: do they read as 1940s German soldiers/officers/SS/dogs from every angle, is the art original (not traced from the reference game), palette-only? Wall textures tile without seams; banners carry the historical symbol as the user decided. Songs: original, loop cleanly, loudness in line with the ams songs (npm run audio). Fix what is wrong.`), { label: 'verify:cast', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, actors: rs[0], art: rs[1], sound: rs[2], verify: v }
} else if (GROUP === 'floors') {
  phase('Build')
  const rs = await parallel([FLOORS, FLOW].map((a) => () => agent(builderPrompt(a), { label: `build:${a.key}`, phase: 'Build' })))
  phase('Verify')
  const areas = [FLOORS, FLOW]
  const v = await agent(verifierPrompt('floors-verify', 5529, 'floors 1-2, MechaHitler, the floor tally, the fps bot, and the whole flow from the ams boss through the bridge to the ending', areas.map((a) => a.owns).join('; '), reportsOf(areas, rs),
    `CHECK: the full route like a player: npm run smoke -- --port 5529 --query "mission=ams&boss=1&debug=1&god=1" (kill the boss with F4) -> glitch bridge -> story card -> fold -> floor 1 -> tally -> floor 2 -> MechaHitler both phases -> tally -> ending -> final tally -> name entry; also ?mode=bridge and ?mode=fps&floor=1|2. The fps bot: npm run sim -- --mode fps --floor 1 --god --expect-complete and --floor 2; then on normal without god, seeds 1-3 (report deaths, time, where it dies). Map validators pass (closed border, keys reachable before their doors, secrets reachable, ammo budget). Fairness: no hit without a visible tell, no spawn in view behind the player, the boss arena has cover and pickups. Continue/game over from inside the fps mode with shared credits; P2 slot unchanged in a 2-player game; score/lives carry over; golden records counted in the final tally. Contact sheets of every room of both floors and of every boss phase (LOOK). Existing tests: mission-ams and scenes tests still green (update only what this wave deliberately changes and say so); npm run sim for ams, m0 and m2 still pass.`), { label: 'verify:floors', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, floors: rs[0], flow: rs[1], verify: v }
} else if (GROUP === 'audio-gen') {
  phase('Build')
  const r = await agent(builderPrompt(AUDIO_GEN), { label: 'build:audio-gen', phase: 'Build' })
  result = { group: GROUP, build: r }
} else if (GROUP === 'audio-ship') {
  phase('Build')
  const r = await agent(builderPrompt(AUDIO_SHIP), { label: 'build:audio-ship', phase: 'Build' })
  phase('Verify')
  const v = await agent(verifierPrompt('audio-verify', 5539, 'the shipped fps samples and drill callouts', AUDIO_SHIP.owns, reportsOf([AUDIO_SHIP], [r]),
    'CHECK: every shipped id has a synth fallback; the mode:fps group loads only with the fps mode (network log in a smoke run); the mecha taunts 1-3 play their clips (audio.hasVoice true for the exact lines.ts strings); voice lines are not clipped and match their subtitles; loudness in line with the ams samples; boot time and the ams start are not slower; all gates.'), { label: 'verify:audio', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, build: r, verify: v }
} else if (GROUP === 'polish') {
  phase('Review')
  const LENSES = [
    { key: 'review-play', ask: 'GAMEPLAY AND FAIRNESS: play the whole fps route (bot sims on easy/normal/hard, seeds 1-4, with and without --god; scripted runs; smoke from mission=ams&boss=1&debug=1). Find unfair hits, tells < 18 ticks, stuck spots, bad door/key logic, unreachable secrets, ammo/health starvation, difficulty spikes, boss fight problems, flow breaks (bridge, tally, continue, ending, P2), mouse-look problems (pointer lock lost, sensitivity), and frame-time problems (npm run perf if available).' },
    { key: 'review-art', ask: 'ART AND READABILITY: shot sheets of every room of floors 1-2, every enemy at 8 yaws and every animation, MechaHitler both phases, the HUD and face, the weapon views, the bridge effect, the tally. Judge as an art director who knows the 1992 genre: readable, atmospheric, consistent palette, no seams, no magenta placeholders, original (not traced). Find the weakest visuals first.' },
    { key: 'review-code', ask: 'CODE, TESTS, DOCS, RULES: review the diff of this wave (git diff main --stat and changed files; read-only git). Find bugs, per-tick allocations, determinism breaks, dead code, weak or missing tests, docs that disagree with the code (docs/design/fps.md, docs/api/fps.md, ARCHITECTURE, GDD), and ORIGINALITY breaks: grep the whole repo for the reference game name outside docs/ORIGINALITY.md, its signature voice lines/shouts, and map layouts copied from it.' },
  ]
  const found = await parallel(LENSES.map((l) => () => agent(`${PRE}\n\nYOUR LABEL: ${l.key} (tool output goes to tmp/fps-${l.key}/). You are a READ-ONLY reviewer: do not edit source files (writing into tmp/ is fine).\nROLE: ${l.ask}\nReport only real, verified problems with evidence (file:line, a frame path you looked at, a sim number). Max 15 findings, most severe first.`, { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS_SCHEMA })))
  const all = found.filter(Boolean).flatMap((f) => f.findings || [])
  log(`polish: ${all.length} findings`)
  phase('Verify')
  const v = await agent(verifierPrompt('polish-fix', 5549, 'the final polish of the fps wave', 'every file changed in this wave (src/**, tests/**, docs/**, tools/**) - keep changes minimal and safe', `FINDINGS FROM THE REVIEW PANEL (verify each before fixing; skip false ones and say why):\n${JSON.stringify(all, null, 1)}`,
    'Fix the findings, most severe first. Then run all gates plus the fps sims (floors 1-2, --god --expect-complete, and normal seeds 1-3), npm run sim for ams/m0/m2 (--god), and smoke from mission=ams&boss=1&debug=1&god=1 through the bridge into floor 1. Update docs/api/fps.md with a final play-test record section.'), { label: 'polish:fix', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, findings: all, verify: v }
} else {
  throw new Error(`unknown group '${GROUP}' (expected spec | engine-a | engine-b | cast | audio-gen | floors | audio-ship | polish)`)
}

return result
