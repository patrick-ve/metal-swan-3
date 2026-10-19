/**
 * npm run anim-bench -- [prefix] [--density 1|2] [--runs 3] [--json out.json] [--half-px]
 *
 * Sprite generation budget (animation wave, plan F6): frame counts and generation ms per hero
 * (`char/<id>/`), per rider set (`enemy/fatbike-youth`, `enemy/delivery-rider`), for the boot list
 * (`bootArt` of the default launch, 1×, deferred sprites left out like the boot) and for the ams
 * 2× set (every id with a 2× generator, what `preloadMissionArt` builds). Every group is measured
 * from an empty sprite cache (clearSpriteCache); memoised art parts inside art modules stay warm
 * after the first run, so take the median of several runs (--runs, default 3). `prefix` limits
 * the groups to those whose key starts with it. Deferred frames are counted apart.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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
}

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { prefix: '', density: null, runs: 3, json: null, halfPx: false };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--density') a.density = Number(argv[++i]) >= 2 ? 2 : 1;
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
  return { key: g.key, density: g.density, ids: g.ids.length, frames, deferredFrames, ms: now() - t0 };
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
  const hiIds = new Set(listHiSprites());
  const under = (p: string): string[] => all.filter((id) => id.startsWith(p));
  const groups: Group[] = [];
  const densities = args.density === null ? [1, 2] : [args.density];
  const heroes = [...new Set(under('char/').map((id) => id.split('/')[1]))].sort();
  for (const d of densities) {
    for (const h of heroes) {
      const ids = under(`char/${h}/`).filter((id) => d === 1 || hiIds.has(id));
      if (ids.length) groups.push({ key: `hero:${h}@${d}x`, ids, density: d });
    }
    for (const r of ['enemy/fatbike-youth', 'enemy/delivery-rider']) {
      const ids = under(r).filter((id) => d === 1 || hiIds.has(id));
      if (ids.length) groups.push({ key: `rider:${r}@${d}x`, ids, density: d });
    }
  }
  if (args.density !== 2) {
    const art = bootArt(DEFAULT_PARAMS) ?? [''];
    groups.push({ key: 'boot@1x', ids: all.filter((id) => !isDeferredSprite(id) && art.some((p) => id.startsWith(p))), density: 1 });
  }
  if (args.density !== 1) groups.push({ key: 'ams-hi@2x', ids: [...hiIds].sort(), density: 2 });
  const chosen = groups.filter((g) => g.key.startsWith(args.prefix) || g.key.split(':')[1]?.startsWith(args.prefix));

  const runs: Row[][] = [];
  for (let r = 0; r < args.runs; r++) runs.push(chosen.map(measure));
  const rows = chosen.map((_, i) => ({ ...runs[0][i], ms: Math.round(median(runs.map((run) => run[i].ms)) * 10) / 10 }));

  const pad = (s: string | number, n: number): string => String(s).padStart(n);
  console.log(`${'group'.padEnd(36)} ${pad('ids', 5)} ${pad('frames', 7)} ${pad('defer', 6)} ${pad('ms', 9)}  (median of ${args.runs})`);
  for (const r of rows) console.log(`${r.key.padEnd(36)} ${pad(r.ids, 5)} ${pad(r.frames, 7)} ${pad(r.deferredFrames, 6)} ${pad(r.ms.toFixed(1), 9)}`);
  if (args.json) {
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, JSON.stringify({ date: new Date().toISOString(), runs: args.runs, rows }, null, 2) + '\n');
    console.log(`wrote ${args.json}`);
  }
}

void main();
