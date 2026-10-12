/**
 * npm run shot -- --mission m0 [--section a] [--x 1200] [--ticks 60] [--bot] [--every 60 --count 6]
 *                 [--seed 1] [--out file.png] [--god] [--route lower|upper] [--players 1|2] [--boss]
 *                 [--hold right,fire] [--scale 2] [--cols 3] [--weapon id] [--difficulty normal]
 *
 * Headless gameplay screenshots with the software renderer (docs/ARCHITECTURE.md §9):
 * - one frame after --ticks ticks → tmp/shots/<mission>-<section>-t<tick>.png (scale 2), or
 * - with --every N --count K: K frames N ticks apart (the first after --ticks) composed into a
 *   labelled contact sheet → tmp/shots/<mission>-sheet.png (scale 1; --scale to change).
 * Every frame is labelled with its tick, section, player x and (with --bot) the bot's goal.
 * --x teleports the players to that world x first. --hold keeps buttons held (fire is tapped).
 * --import loads extra modules first (test missions: `--import tests/sim/bot-missions.ts`).
 */
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { buttonMask, type Button } from '../src/engine/input';
import { drawText } from '../src/engine/font';
import { PixelBuffer } from '../src/engine/pixel';
import type { Difficulty } from '../src/game/session';
import { createHeadlessGame, type BotRoute, type HeadlessGame } from '../src/sim/index';
import { savePNG, SHEET } from './lib/image';

interface Args {
  /** Extra modules to import first (test missions, e.g. tests/sim/bot-missions.ts). */
  imports: string[];
  mission: string;
  section?: string;
  x?: number;
  ticks: number;
  bot: boolean;
  every: number;
  count: number;
  seed: number;
  out?: string;
  god: boolean;
  route: BotRoute;
  players: 1 | 2;
  boss: boolean;
  hold: Button[];
  scale: number;
  cols: number;
  weapon?: string;
  difficulty: Difficulty;
}

const USAGE =
  'usage: npm run shot -- --mission m0 [--section a] [--x 1200] [--ticks 60] [--bot] [--every 60 --count 6] [--seed 1] ' +
  '[--out file.png] [--god] [--route lower|upper] [--players 1|2] [--boss] [--hold right,fire] [--scale 2] [--cols 3] [--weapon id] [--difficulty normal] [--import module.ts]';

const BUTTONS: readonly Button[] = ['left', 'right', 'up', 'down', 'fire', 'jump', 'bomb', 'start'];

function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    imports: [],
    mission: 'm0',
    ticks: 60,
    bot: false,
    every: 0,
    count: 1,
    seed: 1,
    god: false,
    route: 'lower',
    players: 1,
    boss: false,
    hold: [],
    scale: 0,
    cols: 3,
    difficulty: 'normal',
  };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value after ${s}\n${USAGE}`);
      return v;
    };
    const num = (): number => {
      const v = Number(next());
      if (!Number.isFinite(v)) throw new Error(`${s} needs a number\n${USAGE}`);
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
      case '--x':
        a.x = num();
        break;
      case '--ticks':
        a.ticks = Math.max(0, Math.round(num()));
        break;
      case '--bot':
        a.bot = true;
        break;
      case '--every':
        a.every = Math.max(1, Math.round(num()));
        break;
      case '--count':
        a.count = Math.max(1, Math.min(64, Math.round(num())));
        break;
      case '--seed':
        a.seed = num() >>> 0;
        break;
      case '--out':
        a.out = next();
        break;
      case '--god':
        a.god = true;
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
      case '--hold':
        a.hold = next()
          .split(',')
          .map((b) => b.trim())
          .filter((b): b is Button => (BUTTONS as readonly string[]).includes(b));
        break;
      case '--scale':
        a.scale = Math.max(1, Math.min(6, Math.round(num())));
        break;
      case '--cols':
        a.cols = Math.max(1, Math.min(8, Math.round(num())));
        break;
      case '--weapon':
        a.weapon = next();
        break;
      case '--difficulty': {
        const d = next();
        if (d !== 'easy' && d !== 'normal' && d !== 'hard') throw new Error(`--difficulty must be easy, normal or hard\n${USAGE}`);
        a.difficulty = d;
        break;
      }
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

/** Label for one frame: tick, section, player position, bot goal. */
function label(game: HeadlessGame): string {
  const r = game.runner;
  const p = game.player(0);
  const b = game.bots[0];
  const parts = [`t=${game.ticks}`, r ? `${r.mission.id}/${r.section.id}` : '-'];
  if (p) parts.push(`x=${Math.round(p.x)} ${p.state}`);
  if (r?.world.camera.locked) parts.push('LOCK');
  if (b && b.goalKind) parts.push(b.mode === 'foot' ? `goal ${b.goalKind}` : `${b.mode} goal ${b.goalKind}`);
  return parts.join('  ');
}

const LABEL_H = 12;
const PAD = 4;

/** Lay frames out in a grid with a label strip under each. */
function sheet(frames: ReadonlyArray<{ buf: PixelBuffer; label: string }>, cols: number, title: string): PixelBuffer {
  const fw = frames[0].buf.w;
  const fh = frames[0].buf.h;
  const c = Math.min(cols, frames.length);
  const rows = Math.ceil(frames.length / c);
  const head = 14;
  const out = new PixelBuffer(PAD + c * (fw + PAD), head + rows * (fh + LABEL_H + PAD) + PAD).fill(SHEET.bg);
  drawText(out, title, PAD, 3, { color: SHEET.title });
  frames.forEach((f, i) => {
    const x = PAD + (i % c) * (fw + PAD);
    const y = head + Math.floor(i / c) * (fh + LABEL_H + PAD);
    out.blit(f.buf, x, y);
    drawText(out, f.label, x + 1, y + fh + 2, { color: SHEET.label });
  });
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  for (const m of args.imports) await import(pathToFileURL(resolve(m)).href);
  const holdMask = buttonMask(...args.hold.filter((b) => b !== 'fire'));
  const tapFire = args.hold.includes('fire');
  const game = await createHeadlessGame({
    missionId: args.mission,
    sectionId: args.section,
    seed: args.seed,
    players: args.players,
    god: args.god,
    bot: args.bot ? { route: args.route } : false,
    weapon: args.weapon,
    difficulty: args.difficulty,
    bossRush: args.boss,
    input: args.hold.length ? (tick) => holdMask | (tapFire && tick % 2 === 0 ? buttonMask('fire') : 0) : undefined,
  });
  try {
    if (args.x !== undefined) {
      game.step(1);
      game.teleport(args.x);
    }
    game.step(args.ticks);
    const frames: Array<{ buf: PixelBuffer; label: string }> = [];
    for (let i = 0; i < args.count; i++) {
      if (i > 0) game.step(args.every || 60);
      frames.push({ buf: game.renderFrame().clone(), label: label(game) });
    }
    const sec = game.runner?.section.id ?? args.section ?? 'x';
    let file: string;
    if (frames.length === 1) {
      file = args.out ?? join('tmp/shots', `${args.mission}-${sec}-t${game.ticks}.png`);
      const one = sheet(frames, 1, `${args.mission.toUpperCase()}  seed ${args.seed}${args.bot ? `  bot ${args.route}` : ''}${args.god ? '  god' : ''}`);
      savePNG(one, file, args.scale || 2);
    } else {
      file = args.out ?? join('tmp/shots', `${args.mission}-sheet.png`);
      const title = `${args.mission.toUpperCase()}  seed ${args.seed}  every ${args.every || 60} ticks${args.bot ? `  bot ${args.route}` : ''}${args.god ? '  god' : ''}`;
      savePNG(sheet(frames, args.cols, title), file, args.scale || 1);
    }
    const report = game.report();
    console.log(`${frames.length} frame(s) → ${file}`);
    for (const e of report.errors) console.error(`error: ${e.where}: ${e.message}${e.count > 1 ? ` (×${e.count})` : ''}`);
    if (report.errors.length) process.exitCode = 1;
  } finally {
    game.dispose();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
