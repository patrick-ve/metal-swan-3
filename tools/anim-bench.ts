/**
 * npm run anim-bench -- [prefix] [--density 1|2|4] [--pool N] [--runs 3] [--json out.json] [--half-px]
 * npm run anim-bench -- --baseline   (writes tmp/uhd-baseline.json: boot@1x, ams-hi@2x on one
 *                                     thread and with --pool 8, median of 3)
 *
 * Sprite generation budget (animation wave, plan F6): frame counts and generation ms per hero
 * (`char/<id>/`), per rider set (`enemy/fatbike-youth`, `enemy/delivery-rider`), for the boot list
 * (`bootArt` of the default launch, 1×, deferred sprites left out like the boot) and for the ams
 * 2× set (every id with a 2× generator, what `preloadMissionArt` builds). Every group is measured
 * from an empty sprite cache (clearSpriteCache); memoised art parts inside art modules stay warm
 * after the first run, so take the median of several runs (--runs, default 3). `prefix` limits
 * the groups to those whose key starts with it. Deferred frames are counted apart.
 * `--density 4` measures the 4× generators (`ams-hd@4x`: every id with a 4× generator).
 * `--pool N` measures WALL time with N node worker_threads (the art pool, src/engine/art-pool.ts):
 * the workers are started and warm (content loaded) before timing, and drop their sprite cache
 * before each run like the one-thread runs; the main thread only installs the frames.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { nodeArtPool, type ArtPool } from '../src/engine/art-pool';
import {
  clearSpriteCache,
  getFrames,
  isDeferredSprite,
  listHiSprites,
  listSprites,
} from '../src/engine/sprites';
import { isLazyContent, loadContent } from '../src/game/content/index';
import { DEFAULT_PARAMS } from '../src/game/params';
import { setHalfPxJoints } from '../src/game/art/humanoid';
import { bootArt } from '../src/game/scenes/boot';

interface Args {
  prefix: string;
  density: number | null;
  runs: number;
  json: string | null;
  /** --half-px: measure with the HALF_PX_JOINTS spike on (humanoid.ts; default off). */
  halfPx: boolean;
  /** --pool N: wall time with N worker_threads (0: this thread). */
  pool: number;
  /** --baseline: the UHD wave's baseline (tmp/uhd-baseline.json). */
  baseline: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { prefix: '', density: null, runs: 3, json: null, halfPx: false, pool: 0, baseline: false };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--density') {
      const d = Number(argv[++i]);
      a.density = d >= 4 ? 4 : d >= 2 ? 2 : 1;
    } else if (s === '--pool') a.pool = Math.max(0, Math.floor(Number(argv[++i]) || 0));
    else if (s === '--baseline') a.baseline = true;
    else if (s === '--runs') a.runs = Math.max(1, Number(argv[++i]) || 1);
    else if (s === '--json') a.json = argv[++i] ?? null;
    else if (s === '--half-px') a.halfPx = true;
    else if (!s.startsWith('--')) a.prefix = s;
  }
  return a;
}

interface Group {
  key: string;
  ids: string[];
  density: number;
}

interface Row {
  key: string;
  density: number;
  /** Worker threads (0: this thread). */
  pool: number;
  ids: number;
  frames: number;
  deferredFrames: number;
  ms: number;
}

const now = (): number => performance.now();

function measure(g: Group): Row {
  clearSpriteCache();
  let frames = 0;
  let deferredFrames = 0;
  const t0 = now();
  for (const id of g.ids) {
    const n = getFrames(id, g.density).length;
    frames += n;
    if (isDeferredSprite(id)) deferredFrames += n;
  }
  return { key: g.key, density: g.density, pool: 0, ids: g.ids.length, frames, deferredFrames, ms: now() - t0 };
}

/** Wall time of building a group with the pool (workers warm, caches cleared before). */
async function measurePool(pool: ArtPool, g: Group): Promise<Row> {
  clearSpriteCache();
  await pool.reset();
  const t0 = now();
  const r = await pool.build(g.ids, g.density);
  const ms = now() - t0;
  if (r.fallback) throw new Error(`${g.key}: ${r.fallback} ids fell back to this thread`);
  let frames = 0;
  let deferredFrames = 0;
  for (const id of g.ids) {
    const n = getFrames(id, g.density).length;
    frames += n;
    if (isDeferredSprite(id)) deferredFrames += n;
  }
  return { key: g.key, density: g.density, pool: pool.size, ids: g.ids.length, frames, deferredFrames, ms };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.halfPx) setHalfPxJoints(true);
  await loadContent((id) => !isLazyContent(id));
  const all = listSprites();
  const hiIds: Record<number, Set<string>> = { 2: new Set(listHiSprites(2)), 4: new Set(listHiSprites(4)) };
  const under = (p: string): string[] => all.filter((id) => id.startsWith(p));
  const groups: Group[] = [];
  const densities = args.baseline ? [1, 2] : args.density === null ? [1, 2] : [args.density];
  const heroes = [...new Set(under('char/').map((id) => id.split('/')[1]))].sort();
  if (!args.baseline) {
    for (const d of densities) {
      for (const h of heroes) {
        const ids = under(`char/${h}/`).filter((id) => d === 1 || hiIds[d].has(id));
        if (ids.length) groups.push({ key: `hero:${h}@${d}x`, ids, density: d });
      }
      for (const r of ['enemy/fatbike-youth', 'enemy/delivery-rider']) {
        const ids = under(r).filter((id) => d === 1 || hiIds[d].has(id));
        if (ids.length) groups.push({ key: `rider:${r}@${d}x`, ids, density: d });
      }
    }
  }
  if (densities.includes(1)) {
    const art = bootArt(DEFAULT_PARAMS) ?? [''];
    groups.push({ key: 'boot@1x', ids: all.filter((id) => !isDeferredSprite(id) && art.some((p) => id.startsWith(p))), density: 1 });
  }
  if (densities.includes(2)) groups.push({ key: 'ams-hi@2x', ids: [...hiIds[2]].sort(), density: 2 });
  if (densities.includes(4) && hiIds[4].size) groups.push({ key: 'ams-hd@4x', ids: [...hiIds[4]].sort(), density: 4 });
  const chosen = groups.filter((g) => g.key.startsWith(args.prefix) || g.key.split(':')[1]?.startsWith(args.prefix));

  const medianRows = (runs: Row[][]): Row[] =>
    runs[0].map((row, i) => ({ ...row, ms: Math.round(median(runs.map((run) => run[i].ms)) * 10) / 10 }));
  const rows: Row[] = [];
  // One thread (the default; with --baseline as well).
  if (args.pool === 0 || args.baseline) {
    const runs: Row[][] = [];
    for (let r = 0; r < args.runs; r++) runs.push(chosen.map(measure));
    rows.push(...medianRows(runs));
  }
  // The art pool: N worker_threads (--baseline: 8, for the dense groups).
  const poolN = args.baseline ? 8 : args.pool;
  let startMs = 0;
  if (poolN > 0) {
    const t0 = now();
    const pool = await nodeArtPool(poolN);
    try {
      await pool.reset();
      startMs = Math.round(now() - t0);
      const pooled = args.baseline ? chosen.filter((g) => g.density >= 2) : chosen;
      const runs: Row[][] = [];
      for (let r = 0; r < args.runs; r++) {
        const run: Row[] = [];
        for (const g of pooled) run.push(await measurePool(pool, g));
        runs.push(run);
      }
      rows.push(...medianRows(runs).map((row) => ({ ...row, key: `${row.key} pool ${poolN}` })));
    } finally {
      pool.close();
    }
  }

  const pad = (s: string | number, n: number): string => String(s).padStart(n);
  console.log(`${'group'.padEnd(36)} ${pad('ids', 5)} ${pad('frames', 7)} ${pad('defer', 6)} ${pad('ms', 9)}  (median of ${args.runs})`);
  for (const r of rows) console.log(`${r.key.padEnd(36)} ${pad(r.ids, 5)} ${pad(r.frames, 7)} ${pad(r.deferredFrames, 6)} ${pad(r.ms.toFixed(1), 9)}`);
  if (poolN > 0) console.log(`pool start (${poolN} workers, content loaded): ${startMs} ms`);
  const json = args.json ?? (args.baseline ? 'tmp/uhd-baseline.json' : null);
  if (json) {
    mkdirSync(dirname(json), { recursive: true });
    const meta = { date: new Date().toISOString(), runs: args.runs, cores: (await import('node:os')).availableParallelism(), load: (await import('node:os')).loadavg()[0] };
    writeFileSync(json, JSON.stringify({ ...meta, poolStartMs: poolN > 0 ? startMs : undefined, rows }, null, 2) + '\n');
    console.log(`wrote ${json}`);
  }
}

void main();
