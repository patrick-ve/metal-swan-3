/**
 * npm run sim -- --mode fps --floor 1|2 [--god] [--seed n] [--difficulty normal] [--expect-complete]
 *                [--max-ticks 36000] [--out file] [--trace 600] [--quiet]
 * npm run sim -- --mission m0 [--god] [--max-ticks 72000] [--seed 1] [--route lower|upper]
 *                [--players 1|2] [--section a] [--boss] [--difficulty normal] [--char recruit]
 *                [--weapon machine-gun] [--no-bot] [--expect-complete] [--out tmp/sim/report.json]
 *                [--trace 600] [--quiet]
 *
 * Runs a mission headless with the bot autopilot (docs/ARCHITECTURE.md §9) and prints a JSON
 * report: sections visited, kills, deaths, shots, hostages, boss defeated, mission complete,
 * errors with stacks, missing sounds / songs, console warnings, avg / max tick time.
 * Exit code 1 when the run recorded errors, or when --expect-complete is set and the mission
 * was not completed. --trace N prints the player position every N ticks to stderr (with the bot's
 * mode: foot / flight / swan / drive, and its goal). --import loads extra modules first (test
 * missions: `--import tests/sim/bot-missions.ts --mission bot-swan`).
 *
 * `--mode fps --floor n` plays a first-person floor with the fps bot (src/sim/bot-fps.ts) and
 * prints the fps report (kills, secrets, treasure, the boss, the clock, errors).
 *
 * `--mission ring` drives the A10 ring road (docs/design/ring.md §15) with the ring bot
 * (src/sim/bot-ring.ts) in a RingScene (src/sim/headless-ring.ts) and prints the ring report
 * (ticks, plan distance, landmarks, kills, wrecks, fines, hostages, skipped plan ids, bosses,
 * max entities, errors, timing) and a one-line summary. `--seed` fixes the ring, `--section` is a
 * landmark id, `--players 2` drives two wagons; `--expect-ticks 28800-39600` fails a run outside
 * that tick range (the spec's gate for the full ring). Default --max-ticks 43200 (12 minutes).
 *
 * Revision R (docs/design/ring.md §R.10): the ring is the whole level — the short drive, the ZWAAN
 * truck, the hand-over and the on-foot part (`rf-a`, `rf-b`; the 2D bot) — with ONE merged report
 * (`foot`: the on-foot part's numbers) and `--expect-complete` = the level's final tally.
 * `--route full` (the old loop), `--section amstel|zuid|zwaan|rf-a|rf-b` (an unused landmark
 * implies the full route), `--boss` (the truck's run-in; with `rf-b` the boat in wave B).
 */
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Difficulty } from '../src/game/session';
import { createHeadlessFps } from '../src/sim/headless-fps';
import { createHeadlessRing } from '../src/sim/headless-ring';
import { createHeadlessGame } from '../src/sim/index';
import type { BotRoute } from '../src/sim/index';

interface Args {
  /** Extra modules to import first (test missions, e.g. tests/sim/bot-missions.ts). */
  imports: string[];
  mission: string;
  section?: string;
  god: boolean;
  maxTicks: number;
  seed: number;
  route: BotRoute;
  /** `--mission ring --route full|short` (revision R). */
  ringRoute?: 'full' | 'short';
  players: 1 | 2;
  boss: boolean;
  difficulty: Difficulty;
  char?: string;
  weapon?: string;
  bot: boolean;
  expectComplete: boolean;
  out?: string;
  trace: number;
  quiet: boolean;
  /** 'fps' = a first-person floor with the fps bot. */
  mode: 'mission' | 'fps';
  floor: number;
  maxTicksSet: boolean;
  /** `--mission ring`: fail outside this tick range ([min, max]; null = no check). */
  expectTicks: [number, number] | null;
}

const USAGE =
  'usage: npm run sim -- --mission m0 [--god] [--max-ticks 72000] [--seed 1] [--route lower|upper] [--players 1|2] ' +
  '[--section a] [--boss] [--difficulty easy|normal|hard] [--char id] [--weapon id] [--no-bot] [--expect-complete] [--out file] [--trace N] [--quiet] [--import module.ts]\n' +
  '       npm run sim -- --mode fps --floor 1|2 [--god] [--seed 1] [--difficulty normal] [--max-ticks 36000] [--expect-complete] [--out file] [--trace N] [--quiet]\n' +
  '       npm run sim -- --mission ring [--god] [--seed 1] [--players 1|2] [--route short|full] [--section <landmark>|zwaan|rf-a|rf-b] [--boss] [--difficulty normal] [--char id] [--weapon id] [--no-bot] ' +
  '[--max-ticks 43200] [--expect-complete] [--expect-ticks min-max] [--out file] [--trace N] [--quiet]';

function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    imports: [],
    mission: 'm0',
    god: false,
    maxTicks: 72000,
    seed: 1,
    route: 'lower',
    players: 1,
    boss: false,
    difficulty: 'normal',
    bot: true,
    expectComplete: false,
    trace: 0,
    quiet: false,
    mode: 'mission',
    floor: 1,
    maxTicksSet: false,
    expectTicks: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value after ${s}\n${USAGE}`);
      return v;
    };
    switch (s) {
      case '--import':
        a.imports.push(next());
        break;
      case '--mission':
        a.mission = next();
        break;
      case '--section':
        a.section = next();
        break;
      case '--god':
        a.god = true;
        break;
      case '--max-ticks':
        a.maxTicks = Math.max(1, Number(next()) || a.maxTicks);
        a.maxTicksSet = true;
        break;
      case '--seed':
        a.seed = Number(next()) >>> 0;
        break;
      case '--route': {
        const r = next();
        if (r === 'full' || r === 'short') {
          a.ringRoute = r;
          break;
        }
        if (r !== 'upper' && r !== 'lower') throw new Error(`--route must be upper, lower (or full, short with --mission ring)\n${USAGE}`);
        a.route = r;
        break;
      }
      case '--players':
        a.players = next() === '2' ? 2 : 1;
        break;
      case '--boss':
        a.boss = true;
        break;
      case '--difficulty': {
        const d = next();
        if (d !== 'easy' && d !== 'normal' && d !== 'hard') throw new Error(`--difficulty must be easy, normal or hard\n${USAGE}`);
        a.difficulty = d;
        break;
      }
      case '--char':
        a.char = next();
        break;
      case '--weapon':
        a.weapon = next();
        break;
      case '--no-bot':
        a.bot = false;
        break;
      case '--expect-complete':
        a.expectComplete = true;
        break;
      case '--expect-ticks': {
        const m = /^(\d+)-(\d+)$/.exec(next());
        if (!m) throw new Error(`--expect-ticks needs min-max, e.g. 28800-39600\n${USAGE}`);
        a.expectTicks = [Number(m[1]), Number(m[2])];
        break;
      }
      case '--out':
        a.out = next();
        break;
      case '--trace':
        a.trace = Math.max(0, Number(next()) || 0);
        break;
      case '--mode': {
        const m = next();
        if (m !== 'fps' && m !== 'mission') throw new Error(`--mode must be fps or mission\n${USAGE}`);
        a.mode = m;
        break;
      }
      case '--floor':
        a.floor = Math.max(0, Math.floor(Number(next()) || 0));
        break;
      case '--quiet':
        a.quiet = true;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown option ${s}\n${USAGE}`);
    }
  }
  return a;
}

/** `--mode fps`: one first-person floor with the fps bot. */
async function mainFps(args: Args): Promise<void> {
  const h = await createHeadlessFps({ floor: args.floor, seed: args.seed, difficulty: args.difficulty, god: args.god, bot: true });
  const maxTicks = args.maxTicksSet ? args.maxTicks : 36000;
  const t0 = performance.now();
  try {
    let last = '';
    for (let t = 0; t < maxTicks && !h.complete; t++) {
      h.step(1);
      if (args.trace > 0 && h.ticks % args.trace === 0) {
        const g = h.game;
        const b = h.bot;
        const line = g
          ? `t=${h.ticks} state=${g.state} p=${g.player.x.toFixed(1)},${g.player.y.toFixed(1)} hp=${g.player.hp} ammo=${g.player.ammo} w=${g.player.weapon} keys=${g.player.keys} kills=${g.actors.kills}/${g.actors.placedTotal} bot=${b?.goal}@${b?.goalX},${b?.goalY}${g.boss ? ` boss=p${g.boss.phase} hp${g.boss.actor.hp}` : ''}`
          : `t=${h.ticks} no game`;
        if (line !== last) process.stderr.write(`${line}\n`);
        last = line;
      }
    }
  } finally {
    h.dispose();
  }
  const report = { ...h.report(), god: args.god, difficulty: args.difficulty, seconds: Math.round(h.ticks / 6) / 10 };
  const wall = (performance.now() - t0) / 1000;
  const json = JSON.stringify(report, null, 2);
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, json);
  }
  if (!args.quiet) console.log(json);
  const failed = report.errors.length > 0 || (args.expectComplete && !report.complete);
  process.stderr.write(
    `sim fps-${report.floor} seed ${report.seed}${args.god ? ' god' : ''} ${args.difficulty}: ${report.complete ? 'COMPLETE' : 'not complete'} in ${report.ticks} ticks ` +
      `(${report.seconds}s game, ${wall.toFixed(1)}s wall), kills ${report.kills}/${report.killsTotal}, secrets ${report.secrets}/${report.secretsTotal}, ` +
      `treasure ${report.treasure}/${report.treasureTotal}, deaths ${report.deaths}, errors ${report.errors.length}${failed ? '  FAIL' : ''}\n`,
  );
  if (failed) process.exitCode = 1;
}

/** `--mission ring`: the A10 ring road with the ring bot (docs/design/ring.md §15). */
async function mainRing(args: Args): Promise<void> {
  for (const m of args.imports) await import(pathToFileURL(resolve(m)).href);
  const h = await createHeadlessRing({
    seed: args.seed,
    players: args.players,
    god: args.god,
    bot: args.bot,
    characterId: args.char,
    weapon: args.weapon,
    difficulty: args.difficulty,
    section: args.section,
    route: args.ringRoute,
    boss: args.boss,
    clock: () => performance.now(),
  });
  // The full loop (tests and sims only) carries the whole ZWAAN train in westpoort: 18 min.
  const full = (h.runner?.plan.route ?? args.ringRoute) === 'full';
  const maxTicks = args.maxTicksSet ? args.maxTicks : full ? 64800 : 43200;
  const t0 = performance.now();
  try {
    let last = '';
    for (let t = 0; t < maxTicks && !h.done; t++) {
      h.step(1);
      if (args.trace > 0 && h.ticks % args.trace === 0) {
        const r = h.runner;
        const p = h.player(0);
        const w = p?.wagon ?? null;
        const b = h.bots[0];
        const fr = h.footRunner;
        const fp = fr?.player(0) ?? null;
        const line = fr
          ? `t=${h.ticks} FOOT ${fr.section.id} state=${fr.state} p=${fp ? `${fp.state} x=${Math.round(fp.x)}` : '-'} ent=${fr.world.entities.length}`
          :
          `t=${h.ticks} ${r?.section.id ?? '-'} state=${r?.state ?? '-'} d=${r ? Math.round(r.planDist) : '-'}/${r?.plan.length ?? '-'} v=${r ? r.roadSpeed.toFixed(1) : '-'}` +
          `${r?.planLocked ? ' LOCK' : ''}${r?.held ? ' HELD' : ''} p=${p ? `${p.state} lane=${w ? w.laneTarget : '-'} sx=${w ? Math.round(w.screenX) : '-'} cells=${w ? w.cells : '-'}` : '-'}` +
          ` bot=${b ? `${b.goal}${b.targetLane ? `>${b.targetLane}` : ''}` : '-'} ent=${r?.world.entities.length ?? 0}`;
        if (line !== last) process.stderr.write(`${line}\n`);
        last = line;
      }
    }
  } finally {
    h.dispose();
  }
  const report = h.report();
  const wall = (performance.now() - t0) / 1000;
  const json = JSON.stringify(report, null, 2);
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, json);
  }
  if (!args.quiet) console.log(json);
  const outside = args.expectTicks !== null && (report.ticks < args.expectTicks[0] || report.ticks > args.expectTicks[1]);
  const failed = report.errors.length > 0 || (args.expectComplete && !report.complete) || outside;
  const skipped = Object.entries(report.skipped)
    .map(([id, n]) => `${id}×${n}`)
    .join(' ');
  const tick = report.timing ? `, ${report.timing.avgTickMs.toFixed(3)} ms/tick` : '';
  process.stderr.write(
    `sim ring seed ${report.seed}${report.god ? ' god' : ''} ${report.difficulty}${report.players > 1 ? ` ${report.players}P` : ''}: ${report.complete ? 'COMPLETE' : report.gameOver ? 'GAME OVER' : 'not complete'} in ${report.ticks} ticks ` +
      `(${report.seconds}s game, ${wall.toFixed(2)}s wall${tick}), landmarks ${report.landmarks.join('→')}, distance ${report.distance}/${report.planLength}, ` +
      `kills ${report.kills}, deaths ${report.deaths}, wrecks ${report.wrecks}, fines ${report.fines}, hostages ${report.hostages}, continues ${report.continues}, ` +
      `route ${report.route}, drive ${report.driveTicks}, train ${report.train ? `${report.train.done ? 'done' : 'not done'} ${report.train.ticks} [${report.train.parts.map((x) => x.ticks).join(' ')}] catch-ups [${report.train.catchUps.join(' ')}] road ${report.train.startTick} after ${report.train.endTick >= 0 ? report.driveTicks - report.train.endTick : -1}` : '-'}, ` +
      `foot ${report.foot ? `${report.foot.sectionsVisited.join('→')} ${report.foot.ticks} ticks [${Object.entries(report.foot.sectionTicks).map(([k, v]) => `${k} ${v}`).join(', ')}] gaps [${Object.entries(report.foot.sectionGaps).map(([k, v]) => `${k} ${v}`).join(', ')}]${report.foot.complete ? ' COMPLETE' : ''}` : '-'}, ` +
      `spawned ${report.spawned}${skipped ? ` (skipped ${skipped})` : ''}, max entities ${report.maxEntities}, errors ${report.errors.length}` +
      `${outside ? `  TICKS OUTSIDE ${args.expectTicks?.join('-')}` : ''}${failed ? '  FAIL' : ''}\n`,
  );
  if (failed) process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'fps') {
    await mainFps(args);
    return;
  }
  if (args.mission === 'ring') {
    await mainRing(args);
    return;
  }
  for (const m of args.imports) await import(pathToFileURL(resolve(m)).href);
  const game = await createHeadlessGame({
    missionId: args.mission,
    sectionId: args.section,
    seed: args.seed,
    players: args.players,
    god: args.god,
    bot: args.bot ? { route: args.route } : false,
    characterId: args.char,
    weapon: args.weapon,
    difficulty: args.difficulty,
    bossRush: args.boss,
    clock: () => performance.now(),
  });
  const t0 = performance.now();
  try {
    let last = '';
    for (let t = 0; t < args.maxTicks && !game.done; t++) {
      game.step(1);
      if (args.trace > 0 && game.ticks % args.trace === 0) {
        const p = game.player(0);
        const r = game.runner;
        const b = game.bots[0];
        const line = `t=${game.ticks} ${r?.section.id ?? '-'} state=${r?.state ?? '-'} p=${p ? `${Math.round(p.x)},${Math.round(p.y)} ${p.state}` : '-'} cam=${r ? Math.round(r.world.camera.x) : '-'}${r?.world.camera.locked ? ' LOCK' : ''} bot=${b ? `${b.mode} goal=${b.goalKind}@${Math.round(b.goalX)},${Math.round(b.goalY)}` : '-'} enemies=${r?.world.countAlive('enemy') ?? 0}`;
        if (line !== last) process.stderr.write(`${line}\n`);
        last = line;
      }
    }
  } finally {
    game.dispose();
  }
  const report = game.report();
  const wall = (performance.now() - t0) / 1000;
  const json = JSON.stringify(report, null, 2);
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, json);
  }
  if (!args.quiet) console.log(json);
  const failed = report.errors.length > 0 || (args.expectComplete && !report.missionComplete);
  process.stderr.write(
    `sim ${report.mission} seed ${report.seed}${report.god ? ' god' : ''}: ${report.missionComplete ? 'COMPLETE' : 'not complete'} in ${report.ticks} ticks ` +
      `(${report.seconds}s game, ${wall.toFixed(1)}s wall), sections ${report.sectionsVisited.join('→')}, kills ${report.kills}, deaths ${report.deaths}, ` +
      `errors ${report.errors.length}${failed ? '  FAIL' : ''}\n`,
  );
  if (failed) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
