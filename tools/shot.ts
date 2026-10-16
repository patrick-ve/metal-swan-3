/**
 * npm run shot -- --mission m0 [--section a] [--x 1200] [--ticks 60] [--bot] [--every 60 --count 6]
 *                 [--seed 1] [--out file.png] [--god] [--route lower|upper] [--players 1|2] [--boss]
 *                 [--hold right,fire] [--scale 2] [--cols 3] [--weapon id] [--difficulty normal]
 *                 [--res 1] [--gfx pixel|smooth|xbr] [--art 1|2]
 * npm run shot -- --fps 0 [--pose x,y,deg[;x,y,deg…]] [--ticks n] [--every n --count k] [--hold forward,use]
 *                 [--seed 1] [--difficulty normal] [--god] [--unfold] [--out file.png] [--scale 2] [--cols 3]
 *
 * Headless gameplay screenshots with the software renderer (docs/ARCHITECTURE.md §9):
 * - one frame after --ticks ticks → tmp/shots/<mission>-<section>-t<tick>.png (scale 2), or
 * - with --every N --count K: K frames N ticks apart (the first after --ticks) composed into a
 *   labelled contact sheet → tmp/shots/<mission>-sheet.png (scale 1; --scale to change).
 * Every frame is labelled with its tick, section, player x and (with --bot) the bot's goal.
 * --x teleports the players to that world x first. --hold keeps buttons held (fire is tapped).
 * --import loads extra modules first (test missions: `--import tests/sim/bot-missions.ts`).
 * --res k renders the high-resolution backbuffer the browser uses at display scale k
 * (docs/ARCHITECTURE.md §3), with the sprite filter --gfx (default pixel, as in the browser; a filter
 * that needs a larger res steps down with a warning, tools/lib/gfx.ts); the PNG scale then
 * defaults to 1 and the labels grow with k.
 * A mission with `artDensity: 2` (ams) draws its 2× art (docs/ART_GUIDE.md "2x art (mission
 * ams)") as in the browser: at --res 2 or more it shows the full 2× detail, at --res 1 its
 * reduction. --art 1 draws the 1× art instead (to compare); the sheet title names the art.
 *
 * --fps n shoots the first-person floor n instead (docs/design/fps.md §10, src/sim/headless-fps.ts):
 * every --pose (tiles x, y and degrees: 0 east, 90 south) gives one frame after --ticks ticks
 * (default 0); with one pose (or none: the floor start) --every / --count make a timeline.
 * --hold keeps fps actions held (names from input-actions.ts, e.g. forward,turnRight,use).
 * → tmp/shots/fps-<n>[-sheet].png.
 */
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { buttonMask, type Button } from '../src/engine/input';
import { drawText } from '../src/engine/font';
import { PixelBuffer } from '../src/engine/pixel';
import { setHiArt } from '../src/engine/sprites';
import { getMission } from '../src/game/registry';
import { isGraphicsMode } from '../src/game/settings';
import type { UpscaleMode } from '../src/engine/upscale';
import type { Difficulty } from '../src/game/session';
import { createHeadlessGame, type BotRoute, type HeadlessGame } from '../src/sim/index';
import { ACTION_BIT, FPS_ACTIONS, type FpsAction } from '../src/engine/input-actions';
import { createHeadlessFps, type HeadlessFps } from '../src/sim/headless-fps';
import { resolveGfx } from './lib/gfx';
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
  /** Backbuffer resolution (1 = the classic image). */
  res: number;
  /** Sprite filter at res > 1 (null = pixel). */
  gfx: UpscaleMode | null;
  /** 2 (default): a 2× mission draws its 2× art; 1: the 1× art everywhere. */
  art: number;
}

const USAGE =
  'usage: npm run shot -- --mission m0 [--section a] [--x 1200] [--ticks 60] [--bot] [--every 60 --count 6] [--seed 1] ' +
  '[--out file.png] [--god] [--route lower|upper] [--players 1|2] [--boss] [--hold right,fire] [--scale 2] [--cols 3] [--weapon id] [--difficulty normal] [--import module.ts] [--res 1] [--gfx pixel|smooth|xbr] [--art 1|2]';

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
    res: 1,
    gfx: null,
    art: 2,
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
      case '--res':
        a.res = Math.max(1, Math.min(8, Math.round(num())));
        break;
      case '--gfx': {
        const g = next().toLowerCase();
        if (!isGraphicsMode(g)) throw new Error(`--gfx must be pixel, smooth or xbr\n${USAGE}`);
        a.gfx = g;
        break;
      }
      case '--art':
        a.art = num() >= 2 ? 2 : 1;
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

/** Lay frames out in a grid with a label strip under each (`k`: text and margins scale, for --res). */
function sheet(frames: ReadonlyArray<{ buf: PixelBuffer; label: string }>, cols: number, title: string, k = 1): PixelBuffer {
  const fw = frames[0].buf.w;
  const fh = frames[0].buf.h;
  const c = Math.min(cols, frames.length);
  const rows = Math.ceil(frames.length / c);
  const pad = PAD * k;
  const labelH = LABEL_H * k;
  const head = 14 * k;
  const out = new PixelBuffer(pad + c * (fw + pad), head + rows * (fh + labelH + pad) + pad).fill(SHEET.bg);
  drawText(out, title, pad, 3 * k, { color: SHEET.title, scale: k });
  frames.forEach((f, i) => {
    const x = pad + (i % c) * (fw + pad);
    const y = head + Math.floor(i / c) * (fh + labelH + pad);
    out.blit(f.buf, x, y);
    drawText(out, f.label, x + k, y + fh + 2 * k, { color: SHEET.label, scale: k });
  });
  return out;
}

function gfxNote(a: Args): string {
  const hi = a.art >= 2 && (getMission(a.mission)?.artDensity ?? 1) >= 2;
  return `${resolveGfx(a.res, a.gfx).note}${hi ? '  2x art' : ''}`;
}

// ------------------------------------------------------------------------------------- --fps

interface FpsArgs {
  floor: number;
  poses: Array<{ x: number; y: number; deg: number }>;
  ticks: number;
  every: number;
  count: number;
  seed: number;
  difficulty: Difficulty;
  god: boolean;
  unfold: boolean;
  hold: FpsAction[];
  out?: string;
  scale: number;
  cols: number;
}

const FPS_USAGE =
  'usage: npm run shot -- --fps 0 [--pose x,y,deg[;x,y,deg…]] [--ticks n] [--every n --count k] [--hold forward,use] ' +
  '[--seed 1] [--difficulty normal] [--god] [--unfold] [--out file.png] [--scale 2] [--cols 3]';

function parseFpsArgs(argv: readonly string[]): FpsArgs {
  const a: FpsArgs = { floor: 0, poses: [], ticks: 0, every: 0, count: 1, seed: 1, difficulty: 'normal', god: false, unfold: false, hold: [], scale: 0, cols: 3 };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value after ${s}\n${FPS_USAGE}`);
      return v;
    };
    const num = (): number => {
      const v = Number(next());
      if (!Number.isFinite(v)) throw new Error(`${s} needs a number\n${FPS_USAGE}`);
      return v;
    };
    switch (s) {
      case '--fps':
        a.floor = Math.max(0, Math.round(num()));
        break;
      case '--pose':
        for (const part of next().split(';')) {
          const [x, y, deg] = part.split(',').map(Number);
          if (![x, y, deg].every(Number.isFinite)) throw new Error(`--pose needs x,y,deg\n${FPS_USAGE}`);
          a.poses.push({ x, y, deg });
        }
        break;
      case '--ticks':
        a.ticks = Math.max(0, Math.round(num()));
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
      case '--difficulty': {
        const d = next();
        if (d !== 'easy' && d !== 'normal' && d !== 'hard') throw new Error(`--difficulty must be easy, normal or hard\n${FPS_USAGE}`);
        a.difficulty = d;
        break;
      }
      case '--god':
        a.god = true;
        break;
      case '--unfold':
        a.unfold = true;
        break;
      case '--hold':
        a.hold = next()
          .split(',')
          .map((b) => b.trim())
          .filter((b): b is FpsAction => (FPS_ACTIONS as readonly string[]).includes(b));
        break;
      case '--out':
        a.out = next();
        break;
      case '--scale':
        a.scale = Math.max(1, Math.min(6, Math.round(num())));
        break;
      case '--cols':
        a.cols = Math.max(1, Math.min(8, Math.round(num())));
        break;
      case '--help':
      case '-h':
        console.log(FPS_USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown option ${s}\n${FPS_USAGE}`);
    }
  }
  return a;
}

function fpsLabel(h: HeadlessFps): string {
  const g = h.game;
  if (!g) return `t=${h.ticks}  (no game)`;
  const p = g.player;
  const deg = Math.round((p.angle * 360) / 4096);
  return `t=${h.ticks}  x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} ${deg}deg  ${g.state}`;
}

async function fpsMain(argv: readonly string[]): Promise<void> {
  const a = parseFpsArgs(argv);
  let mask = 0;
  for (const name of a.hold) mask |= ACTION_BIT[name];
  // `use` and `fire` are tapped (a press every other tick), the rest is held.
  const tap = mask & (ACTION_BIT.use | ACTION_BIT.fire);
  const held = mask & ~tap;
  const frames: Array<{ buf: PixelBuffer; label: string }> = [];
  const poses = a.poses.length ? a.poses : [null];
  let last: HeadlessFps | null = null;
  for (const pose of poses) {
    const h = await createHeadlessFps({
      floor: a.floor,
      seed: a.seed,
      difficulty: a.difficulty,
      god: a.god,
      unfold: a.unfold,
      pose: pose ?? undefined,
      input: mask ? { actions: (t) => held | (t % 2 === 0 ? tap : 0) } : undefined,
    });
    last?.dispose();
    last = h;
    h.step(a.ticks);
    const n = poses.length === 1 ? a.count : 1;
    for (let i = 0; i < n; i++) {
      if (i > 0) h.step(a.every || 60);
      frames.push({ buf: h.renderFrame().clone(), label: fpsLabel(h) });
    }
  }
  const title = `FPS FLOOR ${a.floor}  seed ${a.seed}  ${a.difficulty}${a.god ? '  god' : ''}`;
  const file = a.out ?? join('tmp/shots', frames.length === 1 ? `fps-${a.floor}.png` : `fps-${a.floor}-sheet.png`);
  savePNG(sheet(frames, frames.length === 1 ? 1 : a.cols, title), file, a.scale || (frames.length === 1 ? 2 : 1));
  console.log(`${frames.length} frame(s) → ${file}`);
  if (last) {
    const report = last.report();
    for (const e of report.errors) console.error(`error: ${e.where}: ${e.message}${e.count > 1 ? ` (×${e.count})` : ''}`);
    for (const w of report.warnings) console.warn(`warning: ${w}`);
    if (report.errors.length) process.exitCode = 1;
    last.dispose();
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--fps')) {
    await fpsMain(process.argv.slice(2));
    return;
  }
  const args = parseArgs(process.argv.slice(2));
  if (args.art < 2) setHiArt(false);
  for (const m of args.imports) await import(pathToFileURL(resolve(m)).href);
  const gfx = resolveGfx(args.res, args.gfx);
  if (gfx.warning) console.warn(`[shot] ${gfx.warning}`);
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
    res: args.res,
    gfx: gfx.mode,
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
      const one = sheet(frames, 1, `${args.mission.toUpperCase()}  seed ${args.seed}${args.bot ? `  bot ${args.route}` : ''}${args.god ? '  god' : ''}${gfxNote(args)}`, args.res);
      savePNG(one, file, args.scale || (args.res > 1 ? 1 : 2));
    } else {
      file = args.out ?? join('tmp/shots', `${args.mission}-sheet.png`);
      const title = `${args.mission.toUpperCase()}  seed ${args.seed}  every ${args.every || 60} ticks${args.bot ? `  bot ${args.route}` : ''}${args.god ? '  god' : ''}${gfxNote(args)}`;
      savePNG(sheet(frames, args.cols, title, args.res), file, args.scale || 1);
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
