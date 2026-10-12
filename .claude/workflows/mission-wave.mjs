export const meta = {
  name: 'mission-wave',
  description: 'Mission wave for one group (args.group): prep agents (runtime+engine requests, bot) or mission and boss builders in parallel, then a group reviewer-integrator that play-tests, fixes and runs the gates',
  phases: [
    { title: 'Build', detail: 'mission and boss builders (or prep agents) in parallel' },
    { title: 'Integrate', detail: 'play-test with the bot and the browser, fix, gates' },
  ],
}

const ROOT = '/Users/everdingen/Projects/private/metal-swan-3'
const GROUP = args && args.group ? String(args.group) : ''

const PRE = `You are one agent in a team building METAL SWAN 3 - an ORIGINAL browser arcade run-and-gun shooter (TypeScript + Vite, zero runtime dependencies) that plays like the late-1990s arcade classics of the genre. Project root: ${ROOT} - run every command from there.

STATE: the engine, game layer, tools, test mission m0, and ALL content are built: 4 heroes, the ridden Metal Swan and 3 other vehicles, 9 weapons, items and hostages, 15 props, 7 creatures, 8 infantry types, 14 machines, every sound and song, every menu screen. This wave builds the five MISSIONS (m1-m5) and their BOSSES from that content, so the game can be played from start to end.

READ FIRST:
- docs/ARCHITECTURE.md (contract; 6.2 mission data format; 7 content folders; 7.1 reconciled ids that WIN over the GDD; 8 conventions) and docs/ORIGINALITY.md (mandatory IP rules: every name, sprite, text and set piece is original; no look-alikes of existing games' levels, bosses or characters).
- docs/GAME_DESIGN.md (the GDD): 11.0 shared mission rules and notation, your mission's section in 11, your boss's section in 10 (and 10.0 shared boss rules), 1.5 pacing, 4.5-4.8 (death, respawn, time, checkpoints), 4.11 fairness, 7.4 rescue rules, 14 scoring, 15 ids. The GDD layouts (x positions, waves, set pieces, timings) are the spec; when a layout does not work in play, adjust it minimally and say so in your report.
- docs/api/game.md (section 10: MissionDef, SectionDef, SectionContext - spawning, waitCamera, camera locks, autoScroll, bossIntro, callouts, exits, respawn rules, startVehicle, vehicles, iceRanges; section 13 recipes: a mission section, a Boss subclass with the part model), docs/api/sim.md (terrain builder, scripts), docs/api/media.md and docs/ART_GUIDE.md (art; background generators and terrain styles in src/game/art/art-registry.ts, bg.ts, terrain-art.ts).
- The content references (how to place and spawn every id, params, timings, sizes): docs/api/heroes.md, docs/api/arsenal.md, docs/api/items.md, docs/api/legion.md, docs/api/sound-ui.md, docs/api/characters.md, docs/api/sfx.md. Use them; grep the content code only when a doc is unclear.
- Reference implementation: src/game/content/missions/m0 (a complete mission with routes, waves, an arena lock and a boss).

TEAM RULES
- Other agents work IN PARALLEL in this directory. Edit ONLY the files you own (your task lists them). Never delete, move or rewrite other agents' files.
- Frozen for builders in this wave (put needed changes under Requests): src/engine/**, src/game/** outside src/game/content/missions and src/game/content/bosses, every other content folder, src/sim/**, tools/**, tests you do not own, docs/GAME_DESIGN.md, docs/design/**, docs/ARCHITECTURE.md, package.json. If a content entity misbehaves in your mission, work around it in your mission script where you can and report the bug (owner, file, exact change).
- Typecheck covers the whole project; files others are still writing may show errors - YOUR files must have zero. Filter: npm run typecheck 2>&1 | grep -E '<your folders>'.
- Tests: iterate with your own test files (npx vitest run <files> --maxWorkers=2); run the full suite once at the end (npx vitest run --maxWorkers=3).
- Visual feedback is mandatory: npm run shot -- --mission <id> --section <s> [--x n] [--ticks n] [--bot] [--every n --count k] --out tmp/<label>/x.png, npm run sprites -- <prefix> --out tmp/<label>/, npm run arena (sandbox, docs/api/slice.md). Open every PNG with the Read tool and LOOK at it. Every section must read well at 1x: the player and enemies stand out from the background, platforms are visible, hazards are readable.
- Play-test with the bot: npm run sim -- --mission <id> [--section s] [--god] [--seed n] [--max-ticks n]. The bot walks, jumps, climbs, shoots, drives ground vehicles, flies the Trumpeter (auto-scroll), rides the Swan (run, jump, swim, glide; it never presses down), plays vertical 'up'/'down' sections and rides cable cars and moving platforms (docs/api/slice.md section 6 lists each mode and its limits) - where the bot cannot do something, test it with scripted input (npm run arena / shot --hold) and say so.
NEW RUNTIME (finished in the prep step, see docs/api/game.md sections 9, 10, 13): ctx.records (campaign records kept across sections and missions; key format '<mission>/<name>', plain data only, e.g. ctx.records.set('m3/lift', ...)), ctx.bodyWall(x, opts) (walls that stop bodies, not shots; filter + onTouch - use it for the swan-only clamp wall), ctx.music(id, fade, { from }) and bossIntro(..., { musicFrom }), y checkpoints and the vertical respawn rule, exits as drop-in holes, MissionDef.bossSections; Boss base: phases with 'when', brokenCount, partAlive, say/hush, telegraphFor, recoveryFor, volleySize, deathSequence(); Terrain.addHazard/removeHazard.
- Browser smoke: npm run smoke -- --port <your port> --query "mission=<id>&god=1" (only YOUR port).
- No git commands, no new npm dependencies. Deterministic simulation (world.rng / world.fxRng; no Math.random, Date or DOM outside *.browser.ts). No per-tick allocations in hot paths.
- Be economical with tokens: read the GDD sections you need (grep by heading), the docs you need, and avoid re-reading large files.

RESUMED RUN: an earlier run of this wave was stopped part-way by the user (to save usage). Files you own may already exist and be partial (e.g. backgrounds, art, helpers, some sections, bot-nav.ts, runner.ts edits, tests/*/runtime-prep.test.ts). Before writing anything, list and read YOUR existing files and CONTINUE from them - do not start over and do not delete good work. Some may not typecheck yet (a missing import, a palette key that does not exist, an unfinished function): finish or fix them. Delete stray probe files you own (e.g. tests/content/_*probe*.test.ts) when done.

FINAL ANSWER: a concise report (max 450 words): what you built (sections, ids), files, test and sim results (numbers), what you LOOKED at, known issues, what you did NOT finish (be honest), and Requests for other owners (exact file + change).`

const MISSIONS = {
  m1: { name: 'BRASS ON THE RIVERBANK', sections: 'a Puddlewick Quay, b1 Chimney Chase (upper route), b2 Storm Drain (lower route), c River Run (the Swan section; ends with the boss THE ENCORE)', gens: 'town-rooftops, sewer-brick, far-bank, reeds', extra: 'mission-local entities hatch, sign, mk1-head (a rusty older swan head with a lifebuoy stencilled MK1 and river weed - no hat), drum-mine (prop/drum-mine, 2 frames) and the m1 decor of GDD 15.6 (decor/m1/sign-no-diving, judges-box, sign-timpani ...). m1-c is the showcase of the ridden Swan: read docs/design/swan-mount/levels.md section 3 (the m1-c layout, the DRUM LINE stomp lesson, the BOAT HOP, the TIMPANI MINEFIELD, the judges box glide) and docs/api/heroes.md.', boss: 'encore', bossFolder: 'bosses/m1', bossPorts: 5302 },
  m2: { name: 'DUNE BUGLE', sections: 'a Rattlebone Flats, b Rocky Road (the Sundae Driver section; ends with the mini-boss THE GOLDEN GOOSE), c1 Canyon Floor (lower), c2 Mesa Top (upper), d The Drum Quarry (boss THE BA-DUM BEHEMOTH)', gens: 'cacti, canyon-walls, rock-pillars, quarry-terraces', extra: 'the sundae-driver vehicle sections (docs/api/heroes.md), the JINGLE queue gags.', boss: 'ba-dum-behemoth (+ the mini-boss golden-goose, GDD 9.4)', bossFolder: 'bosses/m2' },
  m3: { name: 'THE HIGH NOTE', sections: 'a Yodel Valley (the Swan section on snow and ice: the pond, the piste, the ski jump and K-lines, the avalanche pursuit), b1 North Face (vertical, scroll up), b2 Echo Caves (vertical, scroll up), c Summit Station (boss THE WINDBAG)', gens: 'chalets, ice-cave, cable-cars', extra: 'm3-a is the second Swan showcase: read docs/design/swan-mount/levels.md section 4 and docs/api/heroes.md; the m3 decor (decor/m3/sign-piste-closed, k-line-blue, k-line-red, judges-stand, snow-mound, cable-car-cabin); the Swan-only clamp wall at x 2860 after the UNLOCK (mission-local); the SHE TOOK THE LIFT record from m3-a to m3-c ({variant, cells, shells}; keep it in your mission module state or the session per docs/api/game.md - request a session field if needed); the swan wears socks in m3 (param socks).', boss: 'windbag', bossFolder: 'bosses/m3' },
  m4: { name: 'OPENING NIGHT', sections: 'a Avenue of Statues (ends with the mini-boss THE BIG HEAD), b Bandwagon Boulevard (the Bandwagon section), c1 The Underground (lower), c2 Billboard Rooftops (upper), d The Opera House (boss THE GRAND GRAND)', gens: 'neon-signs, crowd-barrier, subway-tiles, opera-hall', extra: 'the bandwagon vehicle section (docs/api/heroes.md), the subway-train and parade-float set pieces (docs/api/legion.md), night outfits.', boss: 'grand-grand (+ the mini-boss big-head, GDD 9.4; the prop chandelier)', bossFolder: 'bosses/m4' },
  m5: { name: 'SWAN SONG', sections: 'a Above the Clouds (shoot-em-up on the Trumpeter: auto-scroll 1.0 px/tick, players start and respawn mounted; ends with stage 1 of the final boss, THE GRAND ORGAN), b The Pipe Works (vertical, scroll down), c The Console (single screen: stages 2 THE CONSOLE and 3 THE MAESTRO)', gens: 'organ-pipes, organ-deep, console-room', extra: 'the trumpeter flight section (docs/api/heroes.md, SectionDef.startVehicle and respawn), mission-local organ-distant; the final mission leads into the ending (src/game/scenes/flow.ts missionDone -> EndingScene).', boss: 'grand-organ, organ-console, maestro (three stages; the prop wreck-block)', bossFolder: 'bosses/m5' },
}

function missionArea(id, port) {
  const m = MISSIONS[id]
  return {
    key: `mission-${id}`,
    port,
    owns: `src/game/content/missions/${id}/** (index.ts, art and helper files you add), tests/content/mission-${id}.test.ts (new)`,
    task: `ROLE: MISSION ${id} - ${m.name}. Build the whole mission: ${m.sections}.
READ: GDD 11.0 and the ${id} part of 11 (every section: size, scroll, checkpoints, allowed vehicles, terrain, waves, set pieces, hostages, exits and routes, timer), 2.4 (the briefing), the boss section of 10 only for how the boss section starts and ends (the boss itself is built by another agent - see below), 12.2 (the mission song), 15.5.
BUILD: defineMission('${id}', ...) with every section: terrain (readable builder code), terrainStyle, backgrounds (standard generators plus the custom ones of GDD 15.5 for ${id}: ${m.gens} - register them with defineBgGenerator in your folder), decor, playerStart, checkpoints, timeLimit, exits and route choices, respawn rules, startVehicle / vehicles / iceRanges where the GDD says, the scripts (waves with the exact ids, params and entry modes, camera locks and arena fights, set pieces, callouts and hints, hostages with kinds, binds and drops), MissionDef.hostages per section (the tally needs it), the mission music and bossMusic, and the boss section that spawns the boss by id with ctx.bossIntro and waits for it. Also: ${m.extra}
THE BOSS: the ${m.boss} entity is built at the same time by the boss-${id} agent in src/game/content/${m.bossFolder}. Spawn it by its GDD id at the GDD position; until it exists, a placeholder shows - that is fine. Build the boss arena terrain exactly as GDD 10 describes it, so the boss fits.
TEST (tests/content/mission-${id}.test.ts): the mission registers; every section builds; every spawned id is registered (no placeholders except the boss while it is missing); each section's script runs 1200 ticks in god mode without errors; exits lead where the GDD says. Run the bot on every section it can play (npm run sim -- --mission ${id} --section <s> --god) and fix layout problems it finds (stuck spots, unreachable exits, unfair spawns). LOOK at contact sheets of every section (npm run shot -- --mission ${id} --section <s> --bot --god --every 120 --count 9).`,
  }
}

function bossArea(id, port) {
  const m = MISSIONS[id]
  return {
    key: `boss-${id}`,
    port,
    owns: `src/game/content/${m.bossFolder}/** (index.ts, art and helper files you add), tests/content/boss-${id}.test.ts (new)`,
    task: `ROLE: BOSS ${id} - ${m.boss}.
READ: GDD 10.0 (shared boss rules: intro, bars, phases, telegraphs, damage states, intermissions, the death sequence and the score), the ${id} boss section in 10${id === 'm2' || id === 'm4' ? ' and the mini-boss in 9.4' : ''}, 4.11 fairness, 14.1 boss scores, 15.4 (part ids), 15.6 (boss/<id>/<part>-0|1|2 strips), 15.7 (boss sfx); the mission section in 11 that holds the fight (arena size and terrain); docs/api/game.md (Boss base: the part model with required / knifeable / contact parts, sequence, intermission, HP from parts; recipe 13); src/game/boss.ts; src/game/content/missions/m0/boss.ts (a complete example).
BUILD every boss (and mini-boss) of this mission: the multi-part body with the GDD part ids, HP per part, every attack with its telegraph (at least 18 ticks), its projectiles (the GDD 15.4 enemy projectile ids that belong to it), phases and damage states (art per part: -0 intact, -1 damaged, -2 broken), intermissions, the reactions it accepts, the defeat sequence (explosions, the pilot's comic exit, score), music cues (GDD 12.2: mini-boss / boss / boss-final ...) and sfx. Large, readable, original pixel art built with the machine kit and the pixel toolkit - a set piece the player remembers. Register each with defineEntity in your folder; it must work when the mission script spawns it at the GDD position, and also alone in a flat test arena.
TEST (tests/content/boss-${id}.test.ts): spawns; every attack fires after its telegraph; parts break in order; the fight can be won with the starting pistol plus grenades within a fair time (simulate a player that stands at a safe spot and fires - measure the time to kill and report it); defeat sequence ends and fires the boss-defeated event; no errors in 3000 ticks. LOOK at a contact sheet of the whole fight at 1x (npm run arena -- --spawn "<boss id>@+200" --god --hold right,fire --every 60 --count 12, or the mission's boss section once it exists: npm run shot -- --mission ${id} --boss ...).`,
  }
}

const RUNTIME = {
  key: 'runtime',
  port: 5390,
  owns: 'src/engine/** (additive changes only), src/game/mission/**, src/game/session.ts, src/game/registry.ts, src/game/boss.ts, src/game/enemy.ts, src/game/tuning.ts, the matching tests (tests/engine/**, tests/game/**), docs/api/game.md, docs/api/sim.md, docs/api/media.md',
  task: `ROLE: SHARED RUNTIME PREP - make the requested shared changes before the mission and boss builders need them. Mission and boss agents start in about an hour and will read your docs; keep every existing API working.
DO (each with a test and a doc line):
1. Engine audio: MusicOpts.from?: number (start a song at an index of its order list) in src/engine/audio.ts and audio.browser.ts (and NullAudio log), passed through the mission runner's music call / ctx.music. Apply sfxJitter(id) as a random pitch change of +-jitter per play in audio.browser.ts play() (cosmetic randomness: not the simulation RNG).
2. Terrain: Terrain.addHazard(h) / removeHazard(h) (src/engine/terrain.ts) so props stop casting the read-only hazards array; then update src/game/content/props/common.ts to use them (you may edit that one call site).
3. Mission runtime (src/game/mission/**, session.ts): a per-campaign record store for cross-section state (e.g. session.campaignRecords or MissionRunner.records: get/set by key, kept across sections of one mission and across missions, cleared on a new game) - the m3 'SHE TOOK THE LIFT' record {variant, cells, shells} from m3-a to m3-c uses it; document it in docs/api/game.md section 10. Check that SectionDef.respawn, startVehicle, vehicles, iceRanges, autoScroll, y checkpoints for vertical 'up'/'down' sections, exits that act as drop-in holes, and MissionDef.hostages all work as docs/api/game.md says - fix gaps (GDD 15.9 item 3 is the list).
4. tuning.ts: TUNING.pickup.dropLifetime 900 -> 720 and popVy -2.2 -> -2.0 (GDD 7.1), or mark them unused if the items use their own ITEM_RULES.
5. Boss base (src/game/boss.ts): read GDD 10.0 and check that the part model, intro, bars, intermission, erasing shots, the defeat sequence and the boss-defeated event cover what the five bosses need (read GDD 10.1-10.5 quickly); add small generic hooks that are clearly missing and document them in docs/api/game.md (recipe 13).
6. Gates at the end: typecheck clean, full suite (--maxWorkers=3), npm run sim -- --mission m0 --god complete.`,
}

const BOT = {
  key: 'bot',
  port: 5391,
  owns: 'src/sim/** (bot, headless, stats), tools/sim.ts, tools/shot.ts, tests/sim/**, tests/review/r1-flow2.test.ts, docs/api/slice.md (bot section)',
  task: `ROLE: BOT PREP - teach the headless bot (src/sim/bot.ts) to play the new kinds of sections, so the mission agents and QA can play-test every mission with npm run sim.
FIRST: the m0 upper route regressed: npm run sim -- --mission m0 --god --route upper --seed 2 gets stuck in section a at x 2150-2265 (the platform staircase to exit:b1) for about 14,000 ticks and loses a life to the timer; tests/sim/sim.test.ts 'completes the upper route' and tests/review/r1-flow2.test.ts R1-23 ('every m0 rifleman spawns above a floor', at a@1243 and b1@700) fail. Physics, terrain, the bot and m0 did not change; player.ts gained small swan hooks, tuning changed boredTicks 600->300 and comboWindow 4->1 (both ruled out), and the rifleman, weapons and items were extended. Find the real cause (trace the player and bot input with npm run shot / a script) and fix it in the right place; if the cause is in another owner's file, make the smallest correct fix there and report it.
THEN add bot modes (each with tests): (1) flight - a Trumpeter shoot-em-up in an auto-scrolling view (m5-a: players start mounted; dodge shots, shoot, collect pickups); (2) riding the Swan - mount a parked swan when its section allows, run, jump gaps and water, swim, glide, stomp (m1-c, m3-a layouts are in docs/design/swan-mount/levels.md); (3) vertical sections - scroll 'up' (climb platforms upward, m3-b1/b2) and 'down' (drop down, m5-b); (4) cable cars and moving platforms (ride them, step off at the far side); (5) ground vehicles already work - keep them. Build small synthetic test sections in tests/sim for each mode (the missions do not exist yet). Report per mode what works and its limits.
Gates at the end: typecheck clean for your files, tests/sim and the full suite, m0 complete on both routes.`,
}

const GROUPS = {
  prep: { port: 5392, areas: [RUNTIME, BOT], doc: null },
  m1m2: { port: 5310, areas: [missionArea('m1', 5301), bossArea('m1', 5302), missionArea('m2', 5303), bossArea('m2', 5304)], doc: 'docs/api/missions-m1-m2.md' },
  m3m4: { port: 5320, areas: [missionArea('m3', 5311), bossArea('m3', 5312), missionArea('m4', 5313), bossArea('m4', 5314)], doc: 'docs/api/missions-m3-m4.md' },
  m5: { port: 5330, areas: [missionArea('m5', 5321), bossArea('m5', 5322)], doc: 'docs/api/missions-m5.md' },
}

const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    gates: {
      type: 'object',
      properties: { typecheck: { type: 'string' }, tests: { type: 'string' }, build: { type: 'string' }, sim: { type: 'string' }, smoke: { type: 'string' } },
      required: ['typecheck', 'tests', 'build', 'sim', 'smoke'],
    },
    playtest: { type: 'string' },
    unfinished: { type: 'array', items: { type: 'string' } },
    requests: {
      type: 'array',
      items: { type: 'object', properties: { owner: { type: 'string' }, file: { type: 'string' }, change: { type: 'string' } }, required: ['owner', 'change'] },
    },
  },
  required: ['summary', 'gates', 'playtest', 'unfinished', 'requests'],
}

function builderPrompt(a) {
  return `${PRE}

YOUR LABEL: ${a.key} (tool output goes to tmp/${a.key}/). YOUR PORT: ${a.port}.
YOU OWN: ${a.owns}

${a.task}

DONE WHEN: everything above is built and registered; your tests pass; typecheck is clean for your files; you LOOKED at frames of everything at 1x; no console errors in a smoke run on your port.`
}

function integratorPrompt(gname, g, reports) {
  const parts = g.areas.map((a, i) => `=== ${a.key} ===\nFILES: ${a.owns}\n[report]\n${reports[i] || '(no report - the agent failed: check this area yourself and list what is missing)'}`).join('\n\n')
  const owns = g.areas.map((a) => a.owns).join('; ')
  const mids = Object.keys(MISSIONS).filter((m) => gname.includes(m.slice(1)) && gname.startsWith('m'))
  return `${PRE}

YOUR LABEL: integrate-${gname} (tool output goes to tmp/integrate-${gname}/). YOUR PORT: ${g.port}.
ROLE: GROUP PLAY-TESTER AND INTEGRATOR for ${gname}. The builders are done (reports below). You are the adversarial check: play the missions like a player would.
YOU OWN: ${owns}${g.doc ? `, ${g.doc}` : ''}.

REPORTS:
${parts}

TASKS:
1. Play-test every section of ${mids.join(' and ') || 'your group'}: the bot (npm run sim -- --mission <id> --god, then without --god on normal and on 3 seeds), contact sheets of each section and of each boss fight (LOOK at them at 1x), and a browser smoke per mission (--query "mission=<id>&god=1"). Check against the GDD: the layout and set pieces are there, routes and exits work, the timer is fair, checkpoints and respawns work, hostages count in the tally, the boss fight starts, can be won and ends the mission, and the next mission (or the ending) follows. Check fairness (GDD 4.11, 1.5 pacing): no unavoidable hits, no off-screen attacks, no stuck spots.
2. Fix what you find in files you own, most severe first; regression tests for logic fixes.
3. Gates: npm run typecheck (whole project), npx vitest run --maxWorkers=3, npm run typecheck && npx vite build --outDir tmp/integrate-${gname}/dist --emptyOutDir, npm run sim for m0 and every mission of your group, npm run smoke -- --port ${g.port}.
${g.doc ? `4. Write ${g.doc}: a short play-test record per section (what the bot and you saw, times, deaths on normal, known issues) for the QA wave.` : ''}

FINAL ANSWER: the structured result - summary (max 250 words), gate results with numbers, the play-test record (per mission and boss: completed? time, deaths, problems), what remains unfinished, and requests for owners outside your group (exact file + change).`
}

const g = GROUPS[GROUP]
if (!g) throw new Error(`unknown group '${GROUP}' (expected one of ${Object.keys(GROUPS).join(', ')})`)
log(`Mission wave group ${GROUP}: ${g.areas.map((a) => a.key).join(', ')}`)

phase('Build')
const reports = await parallel(g.areas.map((a) => () => agent(builderPrompt(a), { label: `build:${a.key}`, phase: 'Build' })))

if (GROUP === 'prep') {
  return { group: GROUP, reports: Object.fromEntries(g.areas.map((a, i) => [a.key, reports[i]])) }
}

phase('Integrate')
const integ = await agent(integratorPrompt(GROUP, g, reports), { label: `integrate:${GROUP}`, phase: 'Integrate', schema: INTEG_SCHEMA }).catch(() => null)

return { group: GROUP, reports: Object.fromEntries(g.areas.map((a, i) => [a.key, reports[i]])), integ }
