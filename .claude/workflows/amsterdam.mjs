export const meta = {
  name: 'amsterdam',
  description: 'Amsterdam mission work for one group (args.group: aim | cast | city | mission | polish): builders, then an adversarial verifier/integrator that play-tests, fixes and runs the gates',
  phases: [
    { title: 'Build', detail: 'the group builders' },
    { title: 'Verify', detail: 'adversarial review, play-test, fixes, gates' },
  ],
}

const ROOT = '/Users/everdingen/Projects/private/metal-swan-3'
const GROUP = args && args.group ? String(args.group) : ''

const PRE = `You are one agent in a team building METAL SWAN 3 - an ORIGINAL browser arcade run-and-gun shooter (TypeScript + Vite, zero runtime dependencies) in the style of the late-1990s arcade classics. Project root: ${ROOT} - run every command from there.

STATE: the whole game is built and green (engine, content, missions m0 test range and m1-m5, bosses, menus; ~2250 tests). This wave adds (1) diagonal fire at 45/135 degrees for the whole game, and (2) a NEW FIRST MISSION 'ams' - THE FRYING DUTCHMAN - set in Amsterdam, with new enemies, a boss (a robot caricature of the mayor), friendly NPCs, a vibrant animated city and new music. The user approved it and is asleep: work autonomously, use your best judgment, and leave everything working.

READ FIRST:
- docs/design/amsterdam.md - THE SPEC for this wave (ids, enemies, boss, music, the art brief from the user's reference photos, the section layouts with x positions, the briefing text, wiring). It wins over the GDD for 'ams'.
- docs/ORIGINALITY.md (mandatory; note the 'ams' exception for real names) and docs/ARCHITECTURE.md (contract, content folders, conventions).
- docs/GAME_DESIGN.md as needed (grep headings): 4.1-4.3 controls and aiming, 4.11 fairness, 1.5 pacing, 9.0 enemy rules, 10.0 boss rules, 11.0 mission notation, 15 ids.
- APIs: docs/api/game.md (MissionDef, SectionDef, SectionContext, Boss base, recipes), docs/api/sim.md (terrain builder, scripts), docs/api/media.md + docs/ART_GUIDE.md (art, palette, generators), docs/api/legion.md, heroes.md, arsenal.md, items.md, characters.md, sfx.md, sound-ui.md, slice.md (tools and bot).
- Reference code: src/game/content/missions/m1 (sections, helpers, swan greeting/lesson in section-c.ts), src/game/content/bosses/m1/encore.ts, src/game/content/creatures/{common,echo-bat,kazoo-drone,ram-goat}.ts, src/game/content/infantry/rhythm/index.ts (drummer contactBoxes), src/game/content/props/{scenery,breakables}.ts, src/game/content/items/hostage.art.ts (apron piece), src/game/art/{humanoid,human-sprites,poses,paint,bg,terrain-art}.ts, src/game/content/music/finale.ts (song module pattern), src/game/content/sfx/index.ts.

TEAM RULES
- Other agents may work IN PARALLEL in this directory. Edit ONLY the files you own (your task lists them). Never delete, move or rewrite other agents' files. src/game/content/index.ts (the manifest) is final: the entries locals, locals/art, bosses/ams, missions/ams and music/ams already exist and point at stub files you replace.
- Typecheck covers the whole project (npm run typecheck = both tsconfigs, including tests); files others are still writing may show errors - YOUR files must have zero.
- Tests: iterate with your own test files (npx vitest run <files> --maxWorkers=2); run the full suite at the end (npx vitest run --maxWorkers=3). Never leave the suite red because of your files. If an existing test encodes a rule this wave deliberately changes (e.g. 'no diagonal aiming on foot', mission labels), update that test and say so.
- Visual feedback is mandatory: npm run shot -- --mission <id> --section <s> [--x n] [--ticks n] [--bot] [--god] [--every n --count k] --out tmp/<label>/x.png, npm run sprites -- <prefix> --out tmp/<label>/, npm run arena -- --spawn "id@x,y{k:v}" ... (sandbox, docs/api/slice.md). Open every PNG with the Read tool and LOOK at it at 1x and zoomed. Things must read well: the player and enemies stand out from the background, platforms are visible, hazards are readable.
- Bot play-test: npm run sim -- --mission <id> [--section s] [--god] [--seed n] [--expect-complete].
- Browser smoke: npm run smoke -- --port <your port> --query "<params>" (only YOUR port; port 5173 is the user's dev server - never touch it).
- No git commands, no new npm dependencies. Deterministic simulation (world.rng / world.fxRng; no Math.random, Date or DOM outside *.browser.ts). No per-tick allocations in hot paths. 64-colour palette only (src/engine/palette.ts PAL ramps; tests reject other colours).
- Be economical with tokens: grep, read only what you need, do not re-read large files.

FINAL ANSWER: a concise report (max 450 words): what you built (ids, files), test / sim / gate results (numbers), what you LOOKED at, known issues, what you did NOT finish (be honest), and requests for other owners (exact file + change).`

const AIM = {
  key: 'aim-build',
  port: 5401,
  owns: 'src/game/player/player.ts, src/game/weapons.ts, src/game/art/humanoid.ts, src/game/art/human-sprites.ts, src/game/content/weapons/** (only what 45 degrees needs), src/sim/bot.ts (+ bot-nav.ts if needed), src/game/scenes/flow-data.ts (help text only), the tests that cover these (tests/game/player.test.ts, tests/game/weapons.test.ts, tests/content/weapons.test.ts, tests/content/characters.test.ts, tests/art/*.test.ts, tests/content/boss-m2.test.ts, boss-m4.test.ts, boss-m5.test.ts, tests/sim/**), docs/GAME_DESIGN.md sections 4.1 and 4.3 (and the weapon table rows of 5 / 6.1 if needed), docs/api/arsenal.md, docs/api/heroes.md, docs/ARCHITECTURE.md (torso contract lines), docs/ART_GUIDE.md (diagonal pose lines)',
  task: `ROLE: DIAGONAL FIRE (whole game). Spec: docs/design/amsterdam.md section 0 'Whole-game aim rule'.
KNOWN FACTS (verified): the aim is a free angle relative to facing (player.ts elev/elevTarget ~208; world angle aimAngle in weapons.ts ~125). updateAim (~631) sets elevTarget = up && !crouching ? -HALF_PI : down && airborne ? HALF_PI : 0; ax is a local of updatePlay (~440, already flipped by the invert status) - pass it in. aimAction (~770) already picks diag-up/shoot-diag-up torso frames for 22.5-67.5 degrees when hasSprite finds them; muzzleWorld (~796) reads that frame's muzzle. Only the heavy weapon has diagonal torso strips (human-sprites.ts ~136-157 'if (w === heavy)'); weaponRig in humanoid.ts (~469) has no pistol diagonal branch (copy the heavy one ~510-519; placedGun rotates guns). Flashes have -diag frames; projectile strips have 16 directions. aimDirOf(-PI/4) is 'forward' (strict threshold) - keep it, so the bounce mine stays a forward throw; but throwBomb (~733) must keep the old 'up' lob whenever up is held. TubaRing in content/weapons/shots.ts (~541-595) has a float tie at 45 degrees (|vx| >= |vy|): give it a clear rule and make it travel/push along its velocity. Check the flamethrower and shotgun at 45 degrees with a shot.
DO:
0. BASELINE FIRST (before any edit): npx vitest run --maxWorkers=3 (record failures, expect 0), and npm run sim -- --mission <m> --god --seed 1 for m0 m1 m2 m3 m4 m5 (record complete?/ticks/deaths/kills per mission) into tmp/aim-build/baseline.txt.
1. The input rule: up + left/right -> elev -PI/4 (walking continues), up alone -> -PI/2, down in the air -> +PI/2. Sweep weapons (machine-gun, laser) keep sweeping 22.5 deg / 2 ticks toward the new target. Crouch + up still stands up. Vehicles are untouched (the Swan and Sundae already do -45 deg).
2. Pistol diag-up / shoot-diag-up torso strips for every character and the helium variants (diag-down stays heavy-only); correct muzzle points. LOOK at npm run sprites for every character's torso strips.
3. The bot (src/sim/bot.ts ~325-353, ~475): aim at the lowest alive, unarmoured boss part (partRect) or the target centre. Target nearly overhead (|dx| < 24) -> dir 0 and hold up (so watchProgress ~353 does not count it as stuck), at most ~60 ticks; target at about 45 degrees (0.5 < dy/|dx| < 2) -> up + toward; in a locked arena pick a stand-off distance that gives a 45-degree line to the part instead of the fixed cam.left+120. Keep the edgeOk / riding / airDir guards. Goal: no mission sim gets worse than the baseline; bosses that need aiming up (m1 encore, m3 windbag, m4 grand-grand, m5 organ-console) may now get better - report.
4. Tests: new ones for up+right -> 45, up+left -> 135 world, up -> 90, grenade lob with up+side, pistol diag muzzle; update the sprite-count test (characters.test.ts ~321), the torso contract tests, and boss time-to-kill tests that walk while holding up (boss-m2 ~169, boss-m4 ~441-459, boss-m5 ~458) - make them stand still to aim straight up or use the diagonal, keeping the fairness intent.
5. Docs: GDD 4.1 (up row) and 4.3 (remove 'No diagonal aiming on foot'; describe the new rule and the grenade lob), the help screen text in src/game/scenes/flow-data.ts (~87), arsenal.md, heroes.md, ARCHITECTURE.md torso contract, ART_GUIDE.md.
6. Gates: npm run typecheck, full vitest suite, the six sims compared with the baseline (table in your report), npm run smoke -- --port ${5401} --query "mission=m1&god=1".`,
}

const LOCALS = {
  key: 'locals',
  port: 5411,
  owns: 'src/game/content/locals/** (replace the stubs index.ts and art.ts; add files), tests/content/locals.test.ts (new), tests/content/helpers.ts (you may ADD a shared fairness watcher there), tests/content/creatures.test.ts (only to import the moved watcher), docs/api/locals.md (new)',
  task: `ROLE: THE AMSTERDAM ENEMIES - fatbike-youth, delivery-rider, seagull, handhaver and the projectile boete-ticket, exactly as docs/design/amsterdam.md sections 1-2 describe (looks, numbers, tells, attacks, gags, deaths, params). Sound ids ams/bell, ams/bass-thump, ams/gull, ams/kick, ams/ticket are being made in parallel by the sound agent - play them by id (an unknown sfx id is silent, not an error).
HOW: Creature subclasses (content/creatures/common.ts: setMode/modeT, tele() >= 18 ticks, takeToken/releaseToken, gags, inView). Melee kills come ONLY from a timed attack box (contactBoxes() override like the drummer in infantry/rhythm/index.ts, or the rifleman swing window in infantry/index.ts ~2004). The tell must run >= 18 ticks while the enemy is inside the view. Seagull base: echo-bat (perch = sleep gag, hover, telegraph, dive with contact only while diving, climb); flock param via the kazoo-drone KazooFormation pattern. Riders: soft (knife works), a body, ride -> tell -> kick -> ride off, despawn off-screen. Art: rider upper body via renderHuman(style, pose, 'upper') + RIDE_* poses (art/poses.ts ~178; grips at hip +(9,-5)), wheels via wheel(r, phase) (art/machines.ts ~42), fat tyres for the fatbike, the green cube backpack as a withPieces piece; outfits via HumanStyle (humanoid.ts ~60) with the normal skin variant pool; the gull via the creature Sketch helper (creatures/draw.ts). Full sprite sets (idle/ride/tell/kick/die and death variants the Enemy base looks up) registered with defineSprite under enemy/<id>/. defineEntity(id, ..., {category:'enemy', score, description}). Every id must spawn and run with {} params.
TEST (tests/content/locals.test.ts): registration and scores; every param combination spawns and runs 300 ticks without errors; the fairness rules (move the watcher from tests/content/creatures.test.ts ~80 into tests/content/helpers.ts and reuse it; use the mode names its ATTACKS/TELLS maps expect, e.g. tell / kick / dive / throw - extend the maps if needed); the kick hits a standing player and misses a jumping one; the crouch dodges the ticket; a gull only hurts while diving; a rider from behind tells on screen before it can hit.
LOOK: npm run sprites -- enemy/<id> for each, and npm run arena with each enemy against the player (contact sheets). Write docs/api/locals.md (how to place each id, params, timings) in the style of docs/api/legion.md.`,
}

const SOUND = {
  key: 'sound',
  port: 5412,
  owns: 'src/game/content/music/ams.ts (replace the stub), src/game/content/sfx/ams.ts (new) and the one spread line in src/game/content/sfx/index.ts, tests/content/music-ams.test.ts (new), docs/GAME_DESIGN.md sections 12.2 (song list) and 15.7 (sfx ids) - ADD rows only, docs/api/sfx.md (new rows)',
  task: `ROLE: THE AMSTERDAM SOUND - songs 'ams' (an ORIGINAL street-organ waltz in 3/4) and 'ams-boss', and the sfx ams/bell, ams/bass-thump, ams/gull, ams/kick, ams/stamp, ams/chain, ams/ticket, exactly as docs/design/amsterdam.md sections 1 and 4 describe.
HOW: songs in their own module with defineSong at import time, like src/game/content/music/finale.ts (~1274: an exported table + a loop); do NOT add them to MISSION_SONGS (tests/content/music-missions.test.ts pins that list). Reuse the helpers and instruments exported by src/game/content/music/index.ts (ORGAN, KIT, mel, measures, harmonize, ...). Compose every melody yourself; never quote or arrange any existing tune (ORIGINALITY.md) - especially no Dutch folk/schlager songs about Amsterdam. Sfx recipes in src/game/content/sfx/ams.ts, spread into SFX in sfx/index.ts (one line, like the other tables) so pinSeeds, the loudness tests and tests/content/sfx.test.ts (which reads the ids listed in GDD 15.7) cover them; add the ids to GDD 15.7 and docs/api/sfx.md. Tells must be audible for >= 18 ticks where they are a telegraph (bass-thump, bell, gull).
TEST: tests/content/music-ams.test.ts (both songs register, parse, loop, sane length/tempo, 3/4 for 'ams'); the existing sfx/music test suites stay green. LISTEN by numbers: npm run audio -- ams --songs (and --wav into tmp/sound/ to check peak/RMS like the other songs); compare loudness with m1 and boss.`,
}

const BOSS = {
  key: 'boss-ams',
  port: 5413,
  owns: 'src/game/content/bosses/ams/** (replace the stub index.ts; add files), tests/content/boss-ams.test.ts (new), docs/api/locals.md (ADD a boss section at the end only)',
  task: `ROLE: THE BOSS 'ams-mayor' - ROBO-HALSEMA, THE IRON MAYOR - exactly as docs/design/amsterdam.md section 3 describes (look, parts and HP, three phases with 'when', attacks with telegraphs, adds, bubbles, intro, death). The adds handhaver, seagull (flock param) and delivery-rider already exist in src/game/content/locals (read docs/api/locals.md); sfx ams/stamp and ams/chain exist; the song ams-boss exists.
HOW: class extends Boss (src/game/boss.ts: addPart, phases with when, brokenCount, partAlive, telegraphFor, recoveryFor, volleySize, say/hush, intermission, deathSequence; reference src/game/content/bosses/m1/encore.ts and its geometry.ts/art files, and bosses/m4/art-head.ts for a big caricature head). Part art strips boss/ams-mayor/<part>-0|1|2 (intact/damaged/broken) plus any body/leg/fx strips, drawn with the pixel toolkit (art/paint.ts Composer, art/machines.ts) - large, readable, funny, original, a robot (not a photo likeness): wavy brown hair as riveted helmet plates, navy blouse armour, the silver chain of office with enamel shields and the big round medallion core, a GESLOTEN stamp arm. Projectiles noise-letter, shield-shot, stamp-wave (register them; enemy team). Add cap via a tag + countAlive like encore.ts ~257. The medallion centre ~76 px above the floor so a 45-degree shot from ~70-110 px hits it (the game now has diagonal fire: up + left/right). Must work spawned with {} params on a flat floor (tests/content/modules.test.ts) and at the arena position of section d (arena x 896-1280, she starts at ~1190 and steps forward).
TEST (tests/content/boss-ams.test.ts): spawns; each attack fires only after its telegraph (>= 18 ticks); parts break in order (medallion armoured until stamp-arm and chain break); adds respect the cap; the fight can be won with the pistol + grenades by a player who uses the diagonal (measure time to kill on normal; target 60-120 s); the defeat sequence ends and emits bossDefeated; no errors in 4000 ticks. LOOK: npm run arena -- --spawn "ams-mayor@+260" --god --hold right,fire --every 60 --count 12 (and with up held), and npm run sprites -- boss/ams-mayor. Add a short boss section to docs/api/locals.md.`,
}

const CITY_BG = {
  key: 'city-bg',
  port: 5421,
  owns: 'src/game/content/missions/ams/{index.ts, backgrounds.ts, art.ts, terrain.ts, section-a.ts, section-b.ts, section-c.ts, section-d.ts} (skeleton sections: terrain, backgrounds, decor, checkpoints, exits, a minimal script), src/game/art/terrain-art.ts (ADD new materials only), tests/art/ams-art.test.ts (new), src/game/content/ui/cards.ts (ONLY if a test needs a card for a registered mission: add a minimal ams card)',
  task: `ROLE: THE CITY - backgrounds, landmarks, terrain and decor for mission 'ams' (docs/design/amsterdam.md sections 5 and 6). Make Amsterdam look VIBRANT and ALIVE in the dense, detailed, colourful pixel-art style of the late-1990s arcade run-and-guns: rich parallax (5-6 layers per section), detailed canal houses with gables, cornices, windows, flower boxes, hoist beams and a slight lean; canal water with reflections; bridges with chained bikes; bollards with XXX; elms; the Westertoren far away; foreground decor that partly covers the player. Landmarks as decor sprites at the x positions of section 6: the FABEL FRIET shopfront (follow the art brief closely - cream-white wooden front, gold 'Fabel' script over 'FRIET', potatoes in the window, open white door, the oval black hanging sign on the iron bracket, red brick above, the orange-brown neighbour shop) with a counter piece (front decor) for the baker, the HOT-DOG STAND trailer (US-flag graphic, blue 'HOTDOGS', painted hot dog with mustard, graffiti cabinet, lamp post, red roof flag; hatch facing the player), the RIJKSMUSEUM (towers, the cycle passage with a solid ceiling over the path in section b), MUSEUMPLEIN, the STOPERA (curved white marble/glass music theatre + red-brick city-hall wing, big doors the boss steps out of), the BLAUWBRUG, Waterlooplein. Light per section: morning, noon, golden afternoon, orange-pink sunset. Animated decor (flags, tulips, water glints, smoke) via decor 'animate' strips; static layers via defineBgGenerator (seamless, deterministic, exact size, widths multiple of 4).
BUILD the mission skeleton so the city can be seen: missions/ams/index.ts registers MissionDef 'ams' (fields from section 8 of the brief: name, subtitle MISSION 1, music 'ams', bossMusic 'ams-boss', start 'a', bossSection 'd', next 'm1', hostages) and sections a-d with the full TERRAIN of section 6 (bridges, the raised-drawbridge canal with houseboat platforms and water hazards, the passage ceiling, the canal stretches of c, the arena of d), terrainStyle (add klinker-brick pavement and a red bike-path edge material to src/game/art/terrain-art.ts if they read better than the existing ones), backgrounds, decor, playerStart, checkpoints, exits (enabled so the bot can walk through), vehicles lists, bossStart for d, and a MINIMAL script per section (no waves; the mission agent writes the real scripts later in the same files - keep the script in its own clearly marked function 'script' so it can be replaced). Do NOT change firstMission or other campaign wiring (the mission group does it). Water: copy the m1 waterDecor approach into missions/ams/art.ts (canal colour). Keep tests green: registering 'ams' may trip tests that enumerate all missions (cards, map dots, music ids) - fix them in a way that stays correct (e.g. a minimal ams card in cards.ts per brief section 8).
TEST (tests/art/ams-art.test.ts): every generator is exact-size, seamless and deterministic, palette-only; every decor sprite id used by the sections exists. LOOK: npm run shot -- --mission ams --section <s> --god --bot --every 120 --count 9 for every section, and zoomed crops of each landmark (npm run sprites -- decor/ams). Judge honestly: would a player say 'that is Amsterdam' and 'that is Fabel Friet'? Iterate until yes.`,
}

const CITY_NPC = {
  key: 'city-npc',
  port: 5422,
  owns: 'src/game/content/missions/ams/{entities.ts, npc.art.ts, ambient.ts, breakables.ts} (new), tests/content/ams-npcs.test.ts (new)',
  task: `ROLE: THE PEOPLE AND LIFE OF THE CITY for mission 'ams' (docs/design/amsterdam.md sections 1 and 5): friendly NPCs ams-baker, ams-hotdog-vendor, ams-staff; ambient life ams-tour-boat (background, glides on the canal), ams-cyclist-bg (background riders), ams-pigeons (peck, fly up when a player comes near), ams-window-waver; the rideable moving platform ams-boat-platform (a small canal/tour boat the player can stand on, moving back and forth over water - the m1-float-crate in missions/m1/entities.ts is the pattern); breakables ams-herring-cart, ams-tulip-stall, ams-market-stall, ams-bike-rack (pattern props/breakables.ts: reveals items).
HOW: NPCs are plain Entities with an Animator (pattern props/scenery.ts CardTable ~36), registered with defineEntity(id, ..., {category:'npc'}) and NO enemy/shootable tag, so waitClear ignores them; ambient entities draw behind the action (z) and are cheap (no per-tick allocations, few of them, sleep when far off-screen). The vendor salutes (P.SALUTE from art/poses.ts with a calm face) when a player - on foot or riding a vehicle - passes within ~40 px, once per player, with a bubble via hudOf(world).bubble (kind 'gag'): HOWDY, SOLDIER! or NICE BIRD, SOLDIER! when the player rides the Swan. The baker has idle, talk (mouth/scoop gestures) and toss (throws an item) animations and a method or params the mission script can drive (document it at the top of entities.ts). Staff: param look 0-2, modes idle/walk-to x/clap/cheer/wave, driven by params or methods (document). New poses CLAP and WAVE are local to npc.art.ts (IK hand targets like the EARS pose in infantry/art.ts ~460; the apron piece like items/hostage.art.ts ~251). Humans 35-37 px, palette only, 1-px ink outline. Every id must spawn and run with {} params.
TEST (tests/content/ams-npcs.test.ts): registration; {} spawn; NPCs are not counted by waitClear and cannot be shot; the vendor salutes once per player when passed on foot and when passed on a swan; the boat platform carries a standing player; breakables reveal items.
LOOK: npm run sprites -- npc/ams (and your decor), and npm run arena sheets of the vendor salute, staff clap/cheer, the boat platform with a player on it, pigeons flying up.`,
}

const MISSION = {
  key: 'mission-ams',
  port: 5431,
  owns: 'src/game/content/missions/ams/** (all files; keep the city art, extend the sections with the real scripts; add helpers.ts), src/game/content/bosses/ams/** (arena fit and small tuning only), tests/content/boss-ams.test.ts, src/game/content/ui/cards.ts, src/game/scenes/{gameplay.ts (firstMission), title.ts (attract demo), final-tally.ts (CAMPAIGN_MISSIONS), flow-data.ts (missionLabel), high-scores.ts (mission column)}, src/game/app.ts and src/game/session.ts (only if the default high-score rows need it), src/game/content/missions/m1..m5/index.ts (labels, subtitles, announces, startBanners only), src/game/content/missions/m1/section-c.ts (only the swan greeting variant), tests/content/mission-ams.test.ts (new), tests/content/ui.test.ts, tests/game/scenes.test.ts, tests/content/mission-m1..m5.test.ts (only label/announce expectations), docs/GAME_DESIGN.md (1.4 table, 2.4 briefings, new 9.4 Amsterdam locals summary, 10 boss entry, 11 mission ams; the other sections are done), docs/api/missions-ams.md (new)',
  task: `ROLE: THE MISSION 'ams' - the playable level and the campaign wiring (docs/design/amsterdam.md sections 6, 7, 8). The city (terrain, backgrounds, decor), the NPCs and ambient entities (read the header of missions/ams/entities.ts), the enemies (docs/api/locals.md), the boss ams-mayor, the songs and sfx already exist.
BUILD the real scripts in the section files: waves per the layout of section 6 with the GDD wave notation helpers (copy missions/m1/helpers.ts into missions/ams/helpers.ts: fromRight/fromLeft/at/hostage/crate/normalUp/hardOnly/twoPlayers/waitBoss), camera locks and arena fights, hostages (mostly kind 'tourist'; counts a 4, b 3, c 3 matching MissionDef.hostages), weapon crates (first within 20 s; one in the boss arena), the golden record in ams-a (pickup-gem kind 'golden-record' like m1-a), breakables, ambient life placement (lots of it - the city must feel alive), the pacing rules (GDD 1.5: a new threat or gag every few seconds, breathers, escalation from single riders to mixed squads to the arena lock, to the Swan, to the boss). THE BRIEFING at Fabel Friet (section 7 exactly: input lock that saves and restores pads every tick and in finally, timer pause/resume, hint bubbles, auto-advance, fire skips, the item toss, exitTo('b')). Section b: the hot-dog vendor and THE SWAN parked next to the stand (copy and adapt the m1-c swan greeting and lesson with new text; 2P mute swan; set records 'm1/swan-lesson' and 'ams/swan-met'); give m1/section-c.ts a greeting variant when 'ams/swan-met' is set (the player met her already). Section d: the boss fight (lockCamera, bodyWall, spawn ams-mayor, bossIntro, waitBoss) then the cheering finale (staff + baker walk in, clap, cheer, bubbles, env/applause) and missionComplete().
WIRING: firstMission() -> 'ams' when registered (else m1); the title attract demo plays ams-a; CAMPAIGN_MISSIONS = ['ams','m1',...]; missionLabel and the high-score mission column number missions by their place in CAMPAIGN_MISSIONS (ams = 1, m1 = 2 ... m4 = 5; m5 stays FINAL MISSION / its current label); m1-m4 subtitles, announces (MISSION TWO...), card labels and startBanners renumbered; the ams card per section 8 with its own small canal-ring map (dot 54 < y < 120). Update the tests that pin labels.
OPEN ITEMS FROM EARLIER GROUPS: (a) the boss ams-mayor was only tested on an open floor (her part HP was tripled vs the brief for a 60-120 s fight): test her in the real section-d arena, make sure the camera lock keeps the player in front of her, and make the bot win: npm run sim -- --mission ams --section d --god --expect-complete (fix the arena or, if needed, small boss tuning in src/game/content/bosses/ams - you may edit it for this); (b) her phase-3 5-shot shield fan has narrow safe gaps - check it is fair in the arena; MEASURED: the bot needs ~47000 ticks in section d and dies to the timer even in god mode - far too long. TARGET: a human-like player with the pistol + grenades kills her in 60-120 s (3600-7200 ticks) on normal, and the bot (god) clears section d well under the section timer (< 15000 ticks). Retune her HP / phases / the bot-reachable medallion line until both hold, and keep tests/content/boss-ams.test.ts in line; (e) THE CITY AGENTS SAY: each section file exports life(ctx) (ambient life + landmark NPCs; a returns {baker}, b returns {vendor} at B_VENDOR with counter:false) - call it first in your script and reuse those handles, never spawn a second baker/vendor; section a's side canal still needs its ams-boat-platform; the far Rijksmuseum on the Museumplein background reads as a plain brick wall - repaint it (missions/ams/backgrounds.ts ams-plein / art.ts) so the two towers, the cream bands and the many windows read as the museum; the exits 'end' of a/b/c are enabled - disable them if your scripts use exitTo; (c) add 'ams' and 'ams-boss' to the GDD 15.8 music id list; (d) a perched gull needs the y of the lamp top / railing top; a rider from behind is ctx.spawn('delivery-rider', x, 'ground', { from: 'behind' }) (docs/api/locals.md).
DOCS: fold the brief into docs/GAME_DESIGN.md (1.4 row, 2.4 briefing row, a 9.4 Amsterdam locals summary, a 10 boss entry, an 11 mission ams section - short, pointing to docs/design/amsterdam.md for detail).
TEST (tests/content/mission-ams.test.ts): mission registers and comes first; sections build; exits lead a->b->c->d->complete; checkpoint gaps <= 1400 px; every spawned id is registered (no placeholders); each section script runs headless in god mode with the bot without errors; the briefing locks and restores the pads (also with a player 2 joining mid-briefing) and resumes the timer; the vendor and swan are in section b; the boss section ends in missionComplete. Run npm run sim -- --mission ams --god --expect-complete and fix layout problems it finds. LOOK at shot contact sheets of every section with --bot --god.`,
}

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

function builderPrompt(a) {
  return `${PRE}

YOUR LABEL: ${a.key} (tool output goes to tmp/${a.key}/). YOUR PORT: ${a.port}.
YOU OWN: ${a.owns}

${a.task}

DONE WHEN: everything above is built and registered; your tests pass; typecheck is clean for your files; you LOOKED at frames of everything at 1x; the full suite is green (or every failure is explained and owned by someone else).`
}

function verifierPrompt(label, port, scope, owns, reports, extra) {
  return `${PRE}

YOUR LABEL: ${label} (tool output goes to tmp/${label}/). YOUR PORT: ${port}.
ROLE: ADVERSARIAL VERIFIER AND INTEGRATOR for: ${scope}. The builders are done (reports below). Assume their reports are optimistic. Check the claims yourself, play it like a player would, LOOK at the frames, and fix what is wrong.
YOU OWN (for fixes): ${owns}

REPORTS:
${reports}

${extra}

GATES (all must pass at the end, report numbers): npm run typecheck; npx vitest run --maxWorkers=3; npx vite build --outDir tmp/${label}/dist --emptyOutDir; the sims named above; npm run smoke -- --port ${port} --query "<the right query>".

FINAL ANSWER: the structured result - summary (max 250 words), gate results with numbers, what you LOOKED at, what you fixed, what remains unfinished.`
}

const reportsOf = (areas, rs) => areas.map((a, i) => `=== ${a.key} === (owns: ${a.owns})\n${rs[i] || '(no report - the agent failed: check this area yourself and finish what is missing)'}`).join('\n\n')

let result = { group: GROUP }

if (GROUP === 'aim') {
  phase('Build')
  const r = await agent(builderPrompt(AIM), { label: 'build:aim', phase: 'Build' })
  phase('Verify')
  const v = await agent(verifierPrompt('aim-verify', 5402, 'diagonal fire (45/135 degrees) for the whole game', AIM.owns, reportsOf([AIM], [r]),
    `CHECK: the input rule in play (scripted input via npm run arena / shot --hold up,right etc.: up+right fires at 45 deg facing right, up+left at 135 deg, up alone 90 deg, down in the air 90 deg down, crouch+up stands, machine-gun and laser sweep through the diagonal, grenade lob with up held, the shotgun/flame/rocket/homing/laser/tuba/bounce-mine at 45 deg); every character's pistol diagonal frames look right (gun direction, hands on the gun, muzzle flash at the barrel tip) - LOOK at sprite sheets and in-game frames; two players; the helium variants; the bot sims for m0-m5 (npm run sim -- --mission <m> --god --seed 1) are no worse than tmp/aim-build/baseline.txt; boss tests still meaningful (no test weakened just to pass); docs updated.`), { label: 'verify:aim', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, build: r, verify: v }
} else if (GROUP === 'cast') {
  phase('Build')
  const first = await parallel([LOCALS, SOUND].map((a) => () => agent(builderPrompt(a), { label: `build:${a.key}`, phase: 'Build' })))
  const boss = await agent(builderPrompt({ ...BOSS, task: `${BOSS.task}\n\nTHE LOCALS AGENT REPORTED:\n${first[0] || '(no report)'}` }), { label: 'build:boss-ams', phase: 'Build' })
  phase('Verify')
  const areas = [LOCALS, SOUND, BOSS]
  const v = await agent(verifierPrompt('cast-verify', 5414, 'the Amsterdam enemies, the boss ROBO-HALSEMA, the songs and sfx', areas.map((a) => a.owns).join('; '), reportsOf(areas, [first[0], first[1], boss]),
    `CHECK: each enemy in the arena against a player (contact sheets; tells visible and audible >= 18 ticks on screen; the kick hits only in its window; a jump clears the youth kick; a crouch dodges the ticket; gull only hurts while diving; deaths and drops work; knife works on soft ones); the boss fight from start to defeat in the arena on normal with the pistol + grenades + diagonal fire (time to kill; every attack telegraphed and avoidable; the adds cap; parts break in order; the death sequence; bubbles readable); the boss art at 1x - does it read as a robot mayor with brown hair, navy blouse and the chain of office? Is it funny and original? Fix ugly or unreadable art. Songs: original (not a known tune), loop cleanly, loudness in line with m1/boss (npm run audio). No sims needed beyond npm run sim -- --mission m0 --god.`), { label: 'verify:cast', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, locals: first[0], sound: first[1], boss, verify: v }
} else if (GROUP === 'city') {
  phase('Build')
  const rs = await parallel([CITY_BG, CITY_NPC].map((a) => () => agent(builderPrompt(a), { label: `build:${a.key}`, phase: 'Build' })))
  phase('Verify')
  const areas = [CITY_BG, CITY_NPC]
  const v = await agent(verifierPrompt('city-verify', 5423, 'the Amsterdam city art, terrain skeleton, NPCs and ambient life', areas.map((a) => a.owns).join('; '), reportsOf(areas, rs),
    `CHECK like an art director who loves the late-1990s arcade run-and-guns: contact sheets of every section (npm run shot -- --mission ams --section <s> --god --bot --every 120 --count 9) and zoomed crops of every landmark and NPC. Against docs/design/amsterdam.md section 5: is it vibrant, dense and alive (parallax depth, detail, colour, motion everywhere)? Is Fabel Friet recognisable from the brief (white front, gold Fabel/FRIET, potatoes, hanging oval sign, open door)? The hot-dog stand (flag graphic, HOTDOGS, hot dog, graffiti cabinet)? Rijksmuseum, Stopera, canal houses, water? Do the player, enemies and platforms still read clearly against the backgrounds? Are NPCs placed at the landmarks (the mission group places them in scripts later; check they can be)? Fix the weakest visuals first (you may edit the city files). Check terrain: walkable, no stuck spots (npm run sim -- --mission ams --god per section with the minimal scripts), exits work, water hazards and platforms are visible. Frame-time: ambient entities cheap. Full suite green.`), { label: 'verify:city', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, bg: rs[0], npc: rs[1], verify: v }
} else if (GROUP === 'mission') {
  phase('Build')
  const r = await agent(builderPrompt(MISSION), { label: 'build:mission-ams', phase: 'Build' })
  phase('Verify')
  const v = await agent(verifierPrompt('mission-verify', 5432, 'mission ams and the campaign wiring', MISSION.owns, reportsOf([MISSION], [r]),
    `CHECK: play the whole mission like a player - the bot (npm run sim -- --mission ams --god --expect-complete; then without --god on normal, seeds 1-3; report deaths, time, where it dies), contact sheets of every section with --bot, the briefing (bubbles readable, timing, input locked and restored, the item toss), the vendor salute (on foot and on the Swan), the Swan pick-up and lesson, the boss fight and the cheering finale, the tally (hostages count, golden record), and the campaign flow: title -> mode/character select -> the ams card says MISSION 1 -> ams -> tally -> the m1 card says MISSION 2 -> ... (tests/game/scenes.test.ts + a browser smoke from the title: npm run smoke -- --port 5432 --query "" and --query "mission=ams&god=1"). Pacing (GDD 1.5) and fairness (4.11): no unavoidable hits, no off-screen attacks, no dead stretches > 4 s, no stuck spots. Also re-run npm run sim for m0 and m2 (no regression). Write/refresh docs/api/missions-ams.md (play-test record).`), { label: 'verify:mission', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, build: r, verify: v }
} else if (GROUP === 'polish') {
  phase('Build')
  const LENSES = [
    { key: 'review-play', ask: 'GAMEPLAY AND FAIRNESS: play mission ams (bot sims on normal, seeds 1-4, with and without --god; scripted-input arena runs of each enemy and the boss) and the diagonal fire in m1-m5. Find unfair hits, telegraphs < 18 ticks or off-screen, stuck spots, dead stretches, broken flow (briefing, swan, finale, tally, next card), difficulty spikes, bot regressions vs the old sims.' },
    { key: 'review-art', ask: 'ART AND LIFE: contact sheets and zoomed crops of every ams section, landmark, NPC, enemy and the boss (npm run shot / sprites / arena). Judge against docs/design/amsterdam.md section 5 and the late-1990s arcade look: vibrant, dense, animated, readable. Find the weakest visuals, readability problems (player vs background), wrong or ugly frames, missing life, text bubbles that overflow (<= 24 chars per line), the pistol diagonal frames of every character.' },
    { key: 'review-code', ask: 'CODE, TESTS, DOCS, RULES: review the diff of this wave (git diff HEAD --stat and the changed files; git is read-only for you: only git diff / git status / git log). Find bugs, per-tick allocations, determinism breaks (Math.random/Date), dead code, missing or weak tests, docs that disagree with the code (GDD 4.1/4.3, 11 ams, ARCHITECTURE manifest, api docs), ORIGINALITY rule breaks (copied tunes, traced logos, banned names), and frame-time cost of the ams sections vs m1 (measure with the headless runner).' },
  ]
  const found = await parallel(LENSES.map((l) => () => agent(`${PRE}\n\nYOUR LABEL: ${l.key} (tool output goes to tmp/${l.key}/). You are a READ-ONLY reviewer: do not edit source files (writing into tmp/ is fine).\nROLE: ${l.ask}\nReport only real, verified problems with evidence (file:line, a frame path you looked at, a sim number). Max 15 findings, most severe first.`, { label: `review:${l.key}`, phase: 'Build', schema: FINDINGS_SCHEMA })))
  const all = found.filter(Boolean).flatMap((f) => f.findings || [])
  log(`polish: ${all.length} findings`)
  phase('Verify')
  const v = await agent(verifierPrompt('polish-fix', 5441, 'the final polish of the Amsterdam wave', 'every file changed in this wave (src/**, tests/**, docs/**) - keep changes minimal and safe', `FINDINGS FROM THE REVIEW PANEL (verify each before fixing; skip false ones and say why):\n${JSON.stringify(all, null, 1)}`,
    'Known before the panel: docs/api/locals.md section 6 still describes the old phase-3 fan (now 6/12/30/54/72 deg, HARD adds 42 deg; safe lanes standing 149-189 px, crouching 69-80 or 149-236 px from the muzzle) - fix it; the mortal bot loses 7 of 9 boss deaths in the CHAIN WHIP phase (it stands up into the high lash) - check the whip is fair and readable for a human (tell length, height cue, sound) and adjust if not. Fix the findings, most severe first. Then run all gates plus npm run sim for ams (--god --expect-complete, and normal seeds 1-3) and m0-m5 (--god), and smoke from the title and with mission=ams. Update docs/api/missions-ams.md with the final play-test record.'), { label: 'polish:fix', phase: 'Verify', schema: VERIFY_SCHEMA }).catch(() => null)
  result = { group: GROUP, findings: all, verify: v }
} else {
  throw new Error(`unknown group '${GROUP}' (expected aim | cast | city | mission | polish)`)
}

return result
