/**
 * Mission `ams` art: the Amsterdam background generators are exact-size, deterministic,
 * palette-only and seamless for every light; every decor sprite the sections use exists and
 * draws; the new terrain materials are palette-only and chunk-seamless; the mission is registered.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import type { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, hasSprite, spriteErrors } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { getBgGenerator, getTerrainPainter, hasBgGenerator, type TerrainStyleDef } from '../../src/game/art/art-registry';
import type { MissionDef } from '../../src/game/mission/index';

let mission: MissionDef;
let GENS: readonly string[] = [];
let LIGHTS: readonly string[] = [];
let demo: typeof import('../../src/game/art/demo-art');

beforeAll(async () => {
  await import('../../src/game/art/bg');
  await import('../../src/game/art/terrain-art');
  demo = await import('../../src/game/art/demo-art');
  mission = (await import('../../src/game/content/missions/ams/index')).AMS;
  GENS = (await import('../../src/game/content/missions/ams/backgrounds')).AMS_BG_GENERATORS;
  LIGHTS = (await import('../../src/game/content/missions/ams/art')).LIGHTS;
});

function colDiff(b: PixelBuffer, x0: number, x1: number): number {
  let d = 0;
  for (let y = 0; y < b.h; y++) if (b.get(x0, y) !== b.get(x1, y)) d++;
  return d / b.h;
}

function palette(b: PixelBuffer, label: string): void {
  for (const c of b.data) if ((c & 255) !== 0) expect(inPalette(c), `${label} ${c.toString(16)}`).toBe(true);
}

describe('ams background generators', () => {
  it('are registered', () => {
    expect(GENS.length).toBe(5);
    for (const id of GENS) expect(hasBgGenerator(id), id).toBe(true);
  });

  it('are exact-size, deterministic, palette-only and seamless in every light', () => {
    for (const id of GENS) {
      for (const light of LIGHTS) {
        const gen = getBgGenerator(id);
        const a = gen(384, 216, { light }, 7);
        const b = gen(384, 216, { light }, 7);
        const label = `${id}/${light}`;
        expect([a.w, a.h], label).toEqual([384, 216]);
        expect(Array.from(a.data), label).toEqual(Array.from(b.data));
        expect(a.countOpaque(), label).toBeGreaterThan(384 * 20);
        palette(a, label);
        let worst = 0;
        for (let x = 0; x + 1 < a.w; x++) worst = Math.max(worst, colDiff(a, x, x + 1));
        expect(colDiff(a, a.w - 1, 0), `${label} seam`).toBeLessThanOrEqual(worst + 1e-9);
      }
    }
  });

  it('every section layer names a registered generator with a width that is a multiple of 4', () => {
    for (const s of Object.values(mission.sections)) {
      expect(s.background.layers.length, s.id).toBeGreaterThanOrEqual(5);
      for (const l of s.background.layers) {
        expect(hasBgGenerator(l.gen), `${s.id}: ${l.gen}`).toBe(true);
        expect((l.width ?? 512) % 4, `${s.id}: ${l.gen}`).toBe(0);
        const buf = getBgGenerator(l.gen)(l.width ?? 512, l.height ?? 216, l.params ?? {}, 3);
        expect([buf.w, buf.h]).toEqual([l.width ?? 512, l.height ?? 216]);
        palette(buf, `${s.id}: ${l.gen}`);
      }
    }
  });
});

describe('ams decor', () => {
  it('every decor sprite used by the sections exists, draws and is palette-only', () => {
    const seen = new Set<string>();
    for (const s of Object.values(mission.sections)) for (const d of s.decor ?? []) seen.add(d.sprite);
    expect(seen.size).toBeGreaterThan(30);
    for (const id of seen) {
      expect(hasSprite(id), id).toBe(true);
      const frames = getFrames(id);
      expect(frames.length, id).toBeGreaterThan(0);
      for (const f of frames) {
        expect(f.buf.countOpaque(), id).toBeGreaterThan(0);
        palette(f.buf, id);
      }
    }
    for (const s of Object.values(mission.sections)) {
      for (const d of s.decor ?? []) {
        if (d.frame !== undefined && !d.animate) expect(d.frame, `${s.id}: ${d.sprite}`).toBeLessThan(getFrames(d.sprite).length);
      }
    }
    expect(spriteErrors().filter((e) => e.id.includes('decor/ams'))).toEqual([]);
  });
});

describe('ams terrain materials', () => {
  const STYLES: TerrainStyleDef[] = [
    { ground: 'klinker', edge: 'bikepath', platform: 'whitewood', solid: 'brick', seed: 1 },
    { ground: 'klinker', edge: 'kerb', platform: 'wood', solid: 'brick', seed: 2 },
  ];

  it('are palette-only and chunk-seamless', () => {
    const t = demo.demoTerrain();
    for (const style of STYLES) {
      const whole = demo.paintTerrainArea(t, style, 0, 0, 256, 128, 256);
      palette(whole, `${style.ground}/${style.edge}`);
      expect(whole.countOpaque()).toBeGreaterThan(0);
      for (const chunk of [64, 37]) {
        const parts = demo.paintTerrainArea(t, style, 0, 0, 256, 128, chunk);
        expect(Array.from(parts.data), `${style.edge} chunk ${chunk}`).toEqual(Array.from(whole.data));
      }
    }
  });

  it('every section terrain paints with its style', () => {
    const painter = getTerrainPainter();
    for (const s of Object.values(mission.sections)) {
      const t = new Terrain(s.terrain);
      // The whole section in 256-px windows (c1 and c2 are mostly river: little ground at the start).
      let opaque = 0;
      for (let x = 0; x < s.width; x += 256) {
        const buf = painter((cx, cy) => t.cellAt(cx, cy), s.terrainStyle, x, 0, Math.min(256, s.width - x), 216);
        opaque += buf.countOpaque();
        palette(buf, `${s.id} @${x}`);
      }
      expect(opaque, s.id).toBeGreaterThan(256 * 30);
    }
  });
});

describe('ams mission', () => {
  it('is registered with the brief fields (§8) and six sections (the route c → c1 | c2)', () => {
    expect(mission).toMatchObject({ id: 'ams', name: 'THE FRYING DUTCHMAN', subtitle: 'MISSION 1', music: 'ams', bossMusic: 'ams-boss', start: 'a', bossSection: 'd', next: 'm1', hostages: { a: 5, b: 4, c: 2, c1: 1, c2: 1 } });
    expect(Object.keys(mission.sections).sort()).toEqual(['a', 'b', 'c', 'c1', 'c2', 'd']);
    expect(mission.sections.d.bossStart).toBeDefined();
    expect(mission.sections.c.vehicles).toContain('swan');
    expect(mission.sections.d.vehicles).toContain('swan');
  });

  it('has water hazards under the canals and walkable stepping stones (no gap over 48 px)', () => {
    for (const id of ['a', 'c']) {
      const def = mission.sections[id].terrain;
      const t = new Terrain(def);
      const water = def.hazards?.filter((h) => h.kind === 'water') ?? [];
      expect(water.length, id).toBeGreaterThan(0);
      for (const h of water) {
        let gap = 0;
        let worst = 0;
        for (let x = h.x - 8; x < h.x + h.w + 8; x++) {
          const floor = Math.min(t.groundY(x), t.platformY(x, 100, 179) ?? Infinity);
          gap = Number.isFinite(floor) && floor < 179 ? 0 : gap + 1;
          worst = Math.max(worst, gap);
        }
        expect(worst, `${id} water at ${h.x}`).toBeLessThanOrEqual(48);
      }
    }
  });

  it('the passage in b has a solid ceiling', () => {
    const t = new Terrain(mission.sections.b.terrain);
    expect(t.isSolid(560, 90)).toBe(true);
    expect(t.isSolid(560, 120)).toBe(false);
  });
});
