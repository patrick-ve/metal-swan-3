/**
 * Fidelity gate 3 of the canal port (tmp/l1/port/PORT-BRIEF.md §4, docs/api/canal.md §6): the game's
 * headless scenery frame of a canal section (SectionView with its canal scene, the software renderer
 * at res = the art tier, no entities, no HUD) equals the kit's own `compose_level(sec, cx)` frame
 * (no hero) pixel for pixel, at every fixture camera and tier. The reference frames are baked next to
 * the art, one index per section (tests/fixtures/canal/index-<id>.json, written by
 * `tmp/l1/kit/bake_game.py --fixtures` at the kit module's GAME_CAMS): tier 1 full frames, tiers 2
 * and 4 full-height crops. A difference is a bug, never a tolerance. Every section with fixtures is
 * checked (a section baked but not opted in yet is drawn with `canal: { scene: 'ams/<id>' }`).
 *
 * One section only:  npx vitest run tests/art/canal-fidelity.test.ts -t "ams b "
 * A bake elsewhere (a section agent's scratch bake) is checked with
 *   CANAL_FIXTURES=<dir> CANAL_PUBLIC=<dir holding art/ams> CANAL_MANIFEST=<manifest dir or <id>.gen.ts> npx vitest run tests/art/canal-fidelity.test.ts
 * (the section files are read and registered over the built-in ones).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodePngSync } from '../../src/engine/png';
import { SoftRenderer } from '../../src/engine/render-soft';
import { setArtTier, setDeferHiArt, setHiArt } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { CANAL_MANIFEST } from '../../src/game/content/missions/ams/canal/manifest.gen';
import { loadContent } from '../../src/game/content/index';
import { defineCanalManifest, resetCanalStore, setCanal, setCanalSource, type CanalSectionManifest } from '../../src/game/mission/canal/index';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';
import { nodeCanalSource } from '../../tools/lib/canal-source';

interface FixtureEntry {
  section: string;
  tier: number;
  cx: number;
  x0: number;
  w: number;
  file: string;
}

const DIR = process.env.CANAL_FIXTURES ?? join(__dirname, '..', 'fixtures', 'canal');
/** Every section's index (index-<id>.json; an old single index.json is read too). */
const INDEX: FixtureEntry[] = readdirSync(DIR)
  .filter((f) => /^index(-[a-z0-9]+)?\.json$/.test(f))
  .sort()
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as FixtureEntry[]);
const SECTIONS = [...new Set(INDEX.map((e) => e.section))].sort();
const inflate = (d: Uint8Array): Uint8Array => new Uint8Array(inflateSync(d));

/** The section manifests of CANAL_MANIFEST (a folder of <id>.gen.ts, or one such file). */
function envSections(path: string): Record<string, CanalSectionManifest> {
  const files = statSync(path).isDirectory()
    ? readdirSync(path)
        .filter((f) => /^[a-z0-9]+\.gen\.ts$/.test(f) && f !== 'manifest.gen.ts')
        .map((f) => join(path, f))
    : [path];
  const out: Record<string, CanalSectionManifest> = {};
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    const a = t.indexOf('/*BEGIN-SECTION*/');
    const b = t.indexOf('/*END-SECTION*/');
    if (a < 0 || b < 0) continue;
    const sec = JSON.parse(t.slice(a + 17, b)) as CanalSectionManifest;
    out[sec.id] = sec;
  }
  return out;
}

/** The section's def, drawing its scene (a section not opted in yet gets `canal: { scene: 'ams/<id>' }`). */
function sectionDef(id: string): SectionDef {
  const def = getMission('ams')?.sections[id];
  if (!def) throw new Error(`mission ams has no section ${id}`);
  return def.canal ? def : { ...def, canal: { scene: `ams/${id}` } };
}

describe('canal scenes: the game frame equals the kit frame', () => {
  beforeAll(async () => {
    await loadContent();
    setHiArt(true);
    setDeferHiArt(false);
    setCanal(true);
    setCanalSource(nodeCanalSource(process.env.CANAL_PUBLIC));
    const mf = process.env.CANAL_MANIFEST;
    if (mf && existsSync(mf)) defineCanalManifest('ams', { ...CANAL_MANIFEST, sections: { ...CANAL_MANIFEST.sections, ...envSections(mf) } });
  });
  afterAll(() => {
    setCanalSource(null);
    resetCanalStore();
    setArtTier(2);
  });

  it.skipIf(process.env.CANAL_FIXTURES !== undefined)('has fixtures for section a at tiers 1, 2 and 4, five cameras or more each', () => {
    for (const t of [1, 2, 4]) expect(INDEX.filter((e) => e.section === 'a' && e.tier === t).length).toBeGreaterThanOrEqual(5);
  });

  it.skipIf(process.env.CANAL_FIXTURES !== undefined)('every baked section has fixtures for every baked tier, five cameras or more each', () => {
    for (const [id, sec] of Object.entries(CANAL_MANIFEST.sections)) {
      for (const t of Object.keys(sec.tiers)) {
        expect(INDEX.filter((e) => e.section === id && e.tier === Number(t)).length, `ams ${id} tier ${t}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  for (const id of SECTIONS) {
    for (const tier of [1, 2, 4]) {
      const list = INDEX.filter((e) => e.section === id && e.tier === tier);
      if (list.length === 0) continue;
      it(`ams ${id} at tier ${tier}: every fixture camera, exact`, () => {
        setArtTier(tier);
        resetCanalStore();
        const def = sectionDef(id);
        const view = new SectionView(def, new Terrain(def.terrain), 7, 4);
        expect(view.canal).not.toBeNull();
        const r = new SoftRenderer(384, 216, undefined, { res: tier });
        for (const e of list) {
          r.setCamera(e.cx, 0);
          view.prepare(e.cx, 0);
          r.begin();
          view.drawBack(r, 0);
          view.drawFront(r, 0);
          r.end();
          expect(view.canal?.failed).toBe(false);
          const ref = decodePngSync(readFileSync(join(DIR, e.file)), inflate);
          const H = 216 * tier;
          expect(ref.h).toBe(H);
          // The frame shows the scene (not a blank: a game frame of nothing would not equal the kit's anyway).
          const colours = new Set<number>();
          for (let i = 0; i < ref.data.length; i += 7) colours.add(ref.data[i]);
          expect(colours.size).toBeGreaterThan(40);
          let diff = 0;
          let first = '';
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < ref.w; x++) {
              const a = r.target.data[y * r.target.w + e.x0 * tier + x] >>> 8;
              const b = ref.data[y * ref.w + x] >>> 8;
              if (a !== b) {
                if (!first) first = `(${e.x0 * tier + x}, ${y}): game ${a.toString(16)} kit ${b.toString(16)}`;
                diff++;
              }
            }
          }
          expect(`${e.file}: ${diff} px differ${first ? ` first ${first}` : ''}`).toBe(`${e.file}: 0 px differ`);
        }
        view.dispose();
      });
    }
  }
});
