/**
 * Fidelity gate 3 of the canal port (tmp/l1/port/PORT-BRIEF.md §4, docs/api/canal.md §6): the game's
 * headless scenery frame of a canal section (SectionView with its canal scene, the software renderer
 * at res = the art tier, no entities, no HUD) equals the kit's own `compose_level(sec, cx)` frame
 * (no hero) pixel for pixel, at every fixture camera and tier. The reference frames are baked next to
 * the art, one index per section (index-<id>.json, written by the level kit's bake,
 * `tools/levelkit/lk.py <mission> bake`, at the kit module's GAME_CAMS): tier 1 full frames, tiers 2
 * and 4 full-height crops. A difference is a bug, never a tolerance. Every section with fixtures is
 * checked (a section baked but not opted in yet is drawn with `canal: { scene: '<mission>/<id>' }`).
 *
 * Every mission with canal scenes: mission `ams` keeps its fixtures in tests/fixtures/canal itself,
 * any other mission in tests/fixtures/canal/<mission id>/ (the bake's default); its manifest is the
 * one its canal/index.ts registers under the mission id (`defineCanalManifest`).
 *
 * One section only:  npx vitest run tests/art/canal-fidelity.test.ts -t "ams b "
 * A bake elsewhere (a section agent's scratch bake) is checked with
 *   CANAL_FIXTURES=<dir> CANAL_PUBLIC=<dir holding art/<mission>> CANAL_MANIFEST=<manifest dir or <id>.gen.ts> [CANAL_MISSION=<id>, default ams] npx vitest run tests/art/canal-fidelity.test.ts
 * (the section files are read and registered over the built-in ones of that mission).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodePngSync } from '../../src/engine/png';
import { SoftRenderer } from '../../src/engine/render-soft';
import { setArtTier, setDeferHiArt, setHiArt } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { loadContent } from '../../src/game/content/index';
import { canalManifest, defineCanalManifest, resetCanalStore, setCanal, setCanalSource, type CanalSectionManifest } from '../../src/game/mission/canal/index';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { getMission, listMissions } from '../../src/game/registry';
import { nodeCanalSource } from '../../tools/lib/canal-source';

interface FixtureEntry {
  section: string;
  tier: number;
  cx: number;
  x0: number;
  w: number;
  file: string;
}

const ROOT = join(__dirname, '..', 'fixtures', 'canal');
/** The mission whose manifest the env overrides (CANAL_MANIFEST) and a scratch fixture folder (CANAL_FIXTURES) belong to. */
const ENV_MISSION = process.env.CANAL_MISSION ?? 'ams';
/** The fixture folder of a mission: `ams` the root (level 1 came first), any other mission its own subfolder. */
const dirOf = (mission: string): string => (mission === 'ams' ? ROOT : join(ROOT, mission));

/** Every section's index in a folder (index-<id>.json; an old single index.json is read too). */
function readIndex(dir: string): FixtureEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^index(-[a-z0-9]+)?\.json$/.test(f))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as FixtureEntry[]);
}

/** The fixture sets: the scratch folder of CANAL_FIXTURES, else `ams` (the root) and every mission subfolder. */
const SETS: Array<{ mission: string; dir: string; index: FixtureEntry[] }> = process.env.CANAL_FIXTURES
  ? [{ mission: ENV_MISSION, dir: process.env.CANAL_FIXTURES, index: readIndex(process.env.CANAL_FIXTURES) }]
  : ['ams', ...readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()].map((m) => ({
      mission: m,
      dir: dirOf(m),
      index: readIndex(dirOf(m)),
    }));
const INDEX_AMS = SETS.find((s) => s.mission === 'ams')?.index ?? [];
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

/** The section's def, drawing its scene (a section not opted in yet gets `canal: { scene: '<mission>/<id>' }`). */
function sectionDef(mission: string, id: string): SectionDef {
  const def = getMission(mission)?.sections[id];
  if (!def) throw new Error(`mission ${mission} has no section ${id}`);
  return def.canal ? def : { ...def, canal: { scene: `${mission}/${id}` } };
}

describe('canal scenes: the game frame equals the kit frame', () => {
  beforeAll(async () => {
    await loadContent();
    setHiArt(true);
    setDeferHiArt(false);
    setCanal(true);
    setCanalSource(nodeCanalSource(process.env.CANAL_PUBLIC));
    const mf = process.env.CANAL_MANIFEST;
    const base = canalManifest(ENV_MISSION);
    if (mf && existsSync(mf)) {
      if (!base) throw new Error(`no canal manifest registered for mission ${ENV_MISSION} (its canal/index.ts)`);
      defineCanalManifest(ENV_MISSION, { ...base, sections: { ...base.sections, ...envSections(mf) } });
    }
  });
  afterAll(() => {
    setCanalSource(null);
    resetCanalStore();
    setArtTier(2);
  });

  it.skipIf(process.env.CANAL_FIXTURES !== undefined)('has fixtures for section a at tiers 1, 2 and 4, five cameras or more each', () => {
    for (const t of [1, 2, 4]) expect(INDEX_AMS.filter((e) => e.section === 'a' && e.tier === t).length).toBeGreaterThanOrEqual(5);
  });

  it.skipIf(process.env.CANAL_FIXTURES !== undefined)('every baked section has fixtures for every baked tier, five cameras or more each', () => {
    expect(canalManifest('ams')).toBeDefined();
    for (const m of listMissions()) {
      const man = canalManifest(m);
      if (!man) continue;
      const index = readIndex(dirOf(m));
      for (const [id, sec] of Object.entries(man.sections)) {
        for (const t of Object.keys(sec.tiers)) {
          expect(index.filter((e) => e.section === id && e.tier === Number(t)).length, `${m} ${id} tier ${t}`).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  for (const { mission, dir: DIR, index: INDEX } of SETS) {
    for (const id of [...new Set(INDEX.map((e) => e.section))].sort()) {
      for (const tier of [1, 2, 4]) {
        const list = INDEX.filter((e) => e.section === id && e.tier === tier);
        if (list.length === 0) continue;
        it(`${mission} ${id} at tier ${tier}: every fixture camera, exact`, () => {
          setArtTier(tier);
          resetCanalStore();
          const def = sectionDef(mission, id);
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
  }
});
