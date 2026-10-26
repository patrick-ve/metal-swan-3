/**
 * npm run floor-clip -- --mission ams [--section a] [--x 60] [--ticks 150] [--hold right,fire]
 *                       [--every 1] [--count 150] [--res 2] [--art 1|2|4] [--gfx pixel|smooth|xbr]
 *                       [--seed 1] [--players 1|2] [--pan <px/tick>] [--floor-debug] [--floor-overlay]
 *                       [--floor-off] [--no-mp4] [--bench] --out tmp/floor-lead/clips/x
 *
 * The perspective floor's motion check (docs/design/floor.md §2, §3.9; docs/api/floor.md §8):
 * headless gameplay frames (the software renderer, as `npm run shot`) written as numbered PNGs
 * `<out>/f0000.png …`, then an MP4 `<out>.mp4` with ffmpeg when it is installed (60 / every fps:
 * --every 1 gives a 60 fps clip of every tick).
 * - Default: the game runs; --hold keeps buttons held (fire is tapped every other tick); --x
 *   teleports the players first, --ticks steps before the first frame.
 * - --pan v: a render-only pan: the simulation stops after --ticks and the camera moves v px per
 *   frame from the view at that moment (the floor's clock still runs: water moves). The pure
 *   camera motion of the floor, the rows and the decor.
 * - --bench: no files; prints the frame and the floor band's draw time (avg / p95 / max ms) and
 *   the floor's CPU memory (`cpuBytes`: textures, canvases, row frames).
 * --floor-debug / --floor-overlay / --floor-off: as `npm run shot`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buttonMask, type Button } from '../src/engine/input';
import type { Renderer } from '../src/engine/render';
import { tierAtRes } from '../src/engine/render-common';
import { setArtTier, setHiArt, toArtDensity } from '../src/engine/sprites';
import type { UpscaleMode } from '../src/engine/upscale';
import { debugFloorDef, setFloorOverlay, setFloorOverride, SectionFloor } from '../src/game/mission/floor/index';
import { isGraphicsMode } from '../src/game/settings';
import { createHeadlessGame } from '../src/sim/index';
import { resolveGfx } from './lib/gfx';
import { savePNG } from './lib/image';

interface Args {
  mission: string;
  section?: string;
  x?: number;
  ticks: number;
  hold: Button[];
  every: number;
  count: number;
  res: number;
  art: number;
  gfx: UpscaleMode | null;
  seed: number;
  players: 1 | 2;
  pan: number;
  floorDebug: boolean;
  floorOverlay: boolean;
  floorOff: boolean;
  mp4: boolean;
  bench: boolean;
  out: string;
}

const USAGE =
  'usage: npm run floor-clip -- --mission ams [--section a] [--x 60] [--ticks 150] [--hold right,fire] [--every 1] [--count 150] ' +
  '[--res 2] [--art 1|2|4] [--gfx pixel|smooth|xbr] [--seed 1] [--players 1|2] [--pan <px/tick>] [--floor-debug] [--floor-overlay] [--floor-off] [--no-mp4] [--bench] --out <dir>';

const BUTTONS: readonly Button[] = ['left', 'right', 'up', 'down', 'fire', 'jump', 'bomb', 'start'];

function parse(argv: readonly string[]): Args {
  const a: Args = { mission: 'ams', ticks: 60, hold: [], every: 1, count: 60, res: 2, art: 2, gfx: null, seed: 1, players: 1, pan: 0, floorDebug: false, floorOverlay: false, floorOff: false, mp4: true, bench: false, out: 'tmp/floor-clip' };
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
      case '--hold':
        a.hold = next()
          .split(',')
          .map((b) => b.trim())
          .filter((b): b is Button => (BUTTONS as readonly string[]).includes(b));
        break;
      case '--every':
        a.every = Math.max(1, Math.round(num()));
        break;
      case '--count':
        a.count = Math.max(1, Math.min(3600, Math.round(num())));
        break;
      case '--res':
        a.res = Math.max(1, Math.min(8, Math.round(num())));
        break;
      case '--art':
        a.art = toArtDensity(num());
        break;
      case '--gfx': {
        const g = next().toLowerCase();
        if (!isGraphicsMode(g)) throw new Error(`--gfx must be pixel, smooth or xbr\n${USAGE}`);
        a.gfx = g;
        break;
      }
      case '--seed':
        a.seed = num() >>> 0;
        break;
      case '--players':
        a.players = next() === '2' ? 2 : 1;
        break;
      case '--pan':
        a.pan = num();
        break;
      case '--floor-debug':
        a.floorDebug = true;
        break;
      case '--floor-overlay':
        a.floorOverlay = true;
        break;
      case '--floor-off':
        a.floorOff = true;
        break;
      case '--no-mp4':
        a.mp4 = false;
        break;
      case '--bench':
        a.bench = true;
        break;
      case '--out':
        a.out = next().replace(/\/$/, '');
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

/** Times of the floor band's draws (the tool wraps SectionFloor.drawBand; tools may read the clock). */
const bandMs: number[] = [];
function timeBands(): void {
  const proto = SectionFloor.prototype as unknown as { drawBand: (r: Renderer, tick: number, d: number) => void };
  const draw = proto.drawBand;
  proto.drawBand = function (this: SectionFloor, r: Renderer, tick: number, d: number): void {
    const t0 = performance.now();
    draw.call(this, r, tick, d);
    bandMs.push(performance.now() - t0);
  };
}

function stats(ms: number[]): string {
  if (ms.length === 0) return 'n/a';
  const s = [...ms].sort((a, b) => a - b);
  const avg = s.reduce((x, y) => x + y, 0) / s.length;
  return `avg ${avg.toFixed(3)}  p95 ${s[Math.floor(s.length * 0.95)].toFixed(3)}  max ${s[s.length - 1].toFixed(3)} ms`;
}

async function main(): Promise<void> {
  const a = parse(process.argv.slice(2));
  const tier = a.art < 2 ? 1 : a.res >= 2 ? tierAtRes(a.art, a.res) : a.art;
  if (tier < 2) setHiArt(false);
  else setArtTier(tier);
  if (a.floorOff) setFloorOverride(() => null);
  if (a.floorDebug) setFloorOverride((s) => debugFloorDef(s, a.mission));
  if (a.floorOverlay) setFloorOverlay(true);
  if (a.bench) timeBands();
  const gfx = resolveGfx(a.res, a.gfx);
  const holdMask = buttonMask(...a.hold.filter((b) => b !== 'fire'));
  const tapFire = a.hold.includes('fire');
  const game = await createHeadlessGame({
    missionId: a.mission,
    sectionId: a.section,
    seed: a.seed,
    players: a.players,
    god: true,
    res: a.res,
    gfx: gfx.mode,
    input: a.hold.length ? (tick) => holdMask | (tapFire && tick % 2 === 0 ? buttonMask('fire') : 0) : undefined,
  });
  const frameMs: number[] = [];
  try {
    if (a.x !== undefined) {
      game.step(1);
      game.teleport(a.x);
    }
    game.step(a.ticks);
    const dir = a.out;
    if (!a.bench) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
    }
    const runner = game.runner;
    const cam = runner?.world.camera;
    const x0 = cam ? cam.x : 0;
    for (let i = 0; i < a.count; i++) {
      if (i > 0) {
        if (a.pan !== 0 && runner && cam) {
          // Render-only: the camera moves, the floor's clock runs, the simulation holds.
          cam.x = x0 + i * a.pan * a.every;
          runner.ticks += a.every;
        } else game.step(a.every);
      }
      const t0 = performance.now();
      const buf = game.renderFrame();
      frameMs.push(performance.now() - t0);
      if (!a.bench) savePNG(buf, join(dir, `f${String(i).padStart(4, '0')}.png`), 1);
    }
    if (a.bench) {
      const fl = runner?.view.floor ?? null;
      console.log(`${a.mission}/${runner?.section.id} res ${a.res} art ${tier}: frame ${stats(frameMs)}`);
      console.log(`  floor band (${fl?.gpuDrawn ? 'gpu' : 'cpu'} raster): ${stats(bandMs)}`);
      if (fl) {
        const MB = (n: number): string => (n / 1048576).toFixed(2);
        console.log(`  floor CPU memory (cpuBytes): ${MB(fl.cpuBytes())} MB — textures ${MB(fl.store.bytes())} (1x ${MB(fl.store.bytes(1))}, 2x ${MB(fl.store.bytes(2))}, 4x ${MB(fl.store.bytes(4))}), canvases ${MB(fl.pool.bytes())} (${fl.pool.size})`);
      }
      return;
    }
    const n = readdirSync(dir).filter((f) => f.endsWith('.png')).length;
    console.log(`${n} frame(s) → ${dir}/f*.png`);
    if (a.mp4 && n > 1) {
      const fps = Math.max(1, Math.round(60 / a.every));
      const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', `${dir}.mp4`], { stdio: 'inherit' });
      if (ff.error) console.log('(ffmpeg not found: PNGs only)');
      else if (ff.status === 0) console.log(`→ ${dir}.mp4 (${fps} fps)`);
    }
    for (const e of game.report().errors) console.error(`error: ${e.where}: ${e.message}`);
  } finally {
    game.dispose();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
