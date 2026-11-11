/**
 * Clean frames of mission `ams2` and the gates of its look (docs/design/ams2.md §1.4,
 * docs/design/ams2-contract.md): no HUD, no labels.
 *
 *   npx tsx tools/herokit/frame.ts --section a --cam 60 --art 2 --out tmp/ams2-lead/frames/a.png
 *
 * --section  the section (default a); --mission to shoot another (default ams2)
 * --cam      the view's left edge in world px (default 60); --tick the animation tick (default 0)
 * --art      the art tier 1, 2 or 4 (default 1); the frame has that many px per logical px
 * --figures  with the real figures: the players stand at cam + 90, the script runs --tick ticks
 * --gate     print the look's numbers (a frame without figures) and exit 1 when one fails
 *
 * The numbers are those of docs/design/ams2/spike/study/metrics.py: `edge` is the mean tone step at an
 * edge (at least 0.17; the hero has 0.25), `soft` the neighbour pairs with a tone step under 0.04, as a share
 * of all pairs (at most 5 %; the hero has 0.3 %; the line also prints it as a share of edges), `outside` the pixels with a colour outside the section's palette (none:
 * a section with `paintedFloor: true` still shows terrain cells or decor of `ams`, the gate tells).
 */
import { setArtTier, setHiArt, withArtDensity } from '../../src/engine/sprites';
import type { SoftRenderer } from '../../src/engine/render-soft';
import { lightTable } from '../../src/game/art/herokit/hi';
import { LIGHTS, type LightName } from '../../src/game/art/herokit/palette';
import { createHeadlessGame } from '../../src/sim/index';
import { savePNG } from '../lib/image';

const argv = process.argv.slice(2);
const arg = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const art = Number(arg('art', '1')) as 1 | 2 | 4;
if (art < 2) setHiArt(false);
else setArtTier(art);
const section = arg('section', 'a');
const cam = Number(arg('cam', '60'));
const tick = Number(arg('tick', '0'));
const figures = argv.includes('--figures');

const game = await createHeadlessGame({ missionId: arg('mission', 'ams2'), sectionId: section, seed: 1, players: 1, god: true, bot: false, res: art, gfx: 'pixel' });
game.step(1);
if (figures) {
  game.teleport(cam + 90);
  game.step(tick);
}
const runner = game.runner;
if (!runner) throw new Error('no mission runner');
const r: SoftRenderer = game.renderer;
r.begin();
if (figures) runner.draw(r);
else {
  withArtDensity(runner.artDensity, () => {
    r.setCamera(cam, 0);
    runner.view.drawBack(r, tick);
    runner.view.drawFront(r, tick);
  });
}
r.end();
const out = arg('out', `tmp/ams2-lead/frame-${section}-u${art}.png`);
savePNG(r.target, out, 1);
console.log(`→ ${out}`);

/** The lightness of a packed colour (metrics.py `lum`). */
function lum(c: number): number {
  const f = (v: number): number => (v / 255) ** 2.2;
  return (0.2126 * f(c >>> 24) + 0.7152 * f((c >>> 16) & 255) + 0.0722 * f((c >>> 8) & 255)) ** (1 / 2.2);
}

function lightOf(sectionId: string): LightName | null {
  const sky = runner?.mission.sections[sectionId]?.background.layers?.[0]?.params?.light;
  return typeof sky === 'string' && sky in LIGHTS ? (sky as LightName) : null;
}

let failed = false;
if (argv.includes('--gate')) {
  const { data, w, h } = r.target;
  const seen = new Set<number>();
  const cache = new Map<number, number>();
  const L = (c: number): number => {
    let v = cache.get(c);
    if (v === undefined) cache.set(c, (v = lum(c)));
    return v;
  };
  let edges = 0;
  let sum = 0;
  let soft = 0;
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x];
      seen.add(c);
      for (const n of [x + 1 < w ? data[y * w + x + 1] : -1, y + 1 < h ? data[(y + 1) * w + x] : -1]) {
        if (n === -1) continue;
        total++;
        if (n !== c) {
          const d = Math.abs(L(n) - L(c));
          edges++;
          sum += d;
          if (d < 0.04) soft++;
        }
      }
    }
  }
  const light = lightOf(section);
  let outside = -1;
  if (light) {
    const pal = new Set(lightTable(light, art));
    outside = 0;
    for (let i = 0; i < data.length; i++) if (!pal.has(data[i])) outside++;
  }
  const edge = sum / Math.max(1, edges);
  const softPct = (soft / Math.max(1, total)) * 100;
  const softOfEdges = (soft / Math.max(1, edges)) * 100;
  const cols = seen.size;
  failed = edge < 0.17 || softPct > 5 || outside > 0;
  console.log(`colours ${cols}  edge ${edge.toFixed(3)} (>= 0.17)  soft ${softPct.toFixed(2)} % of pairs, ${softOfEdges.toFixed(2)} % of edges (<= 5)  outside ${outside} (0)  ${failed ? 'FAIL' : 'pass'}`);
}
const report = game.report();
for (const e of report.errors) {
  console.error(`error: ${e.where}: ${e.message}`);
  failed = true;
}
game.dispose();
if (failed) process.exitCode = 1;
