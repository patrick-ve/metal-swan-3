/**
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
 */
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Difficulty } from '../src/game/session';
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
}

const USAGE =
  'usage: npm run sim -- --mission m0 [--god] [--max-ticks 72000] [--seed 1] [--route lower|upper] [--players 1|2] ' +
  '[--section a] [--boss] [--difficulty easy|normal|hard] [--char id] [--weapon id] [--no-bot] [--expect-complete] [--out file] [--trace N] [--quiet] [--import module.ts]';

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
        break;
      case '--seed':
        a.seed = Number(next()) >>> 0;
        break;
      case '--route': {
        const r = next();
        if (r !== 'upper' && r !== 'lower') throw new Error(`--route must be upper or lower\n${USAGE}`);
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
      case '--out':
        a.out = next();
        break;
      case '--trace':
        a.trace = Math.max(0, Number(next()) || 0);
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
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
