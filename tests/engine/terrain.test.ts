import { describe, expect, it } from 'vitest';
import {
  CELL_EMPTY,
  CELL_GROUND,
  CELL_PLATFORM,
  CELL_SOLID,
  PLATFORM_BAND,
  Terrain,
  ground,
  platformPath,
  terrain,
} from '../../src/engine/terrain';

describe('terrain builder', () => {
  it('builds polylines with flat, slope, to, step and gap', () => {
    const lines = ground().at(0, 170).flat(100).slope(50, -25).to(200, 145).step(-10).flat(20).gap(40).flat(60).build();
    expect(lines).toEqual([
      [
        [0, 170],
        [100, 170],
        [150, 145],
        [200, 145],
        [200, 135],
        [220, 135],
      ],
      [
        [260, 135],
        [320, 135],
      ],
    ]);
  });

  it('hill makes a smooth bump that returns to the start height', () => {
    const [line] = ground().at(0, 100).hill(80, 20, 8).build();
    expect(line[0]).toEqual([0, 100]);
    expect(line[line.length - 1]).toEqual([80, 100]);
    expect(Math.min(...line.map((p) => p[1]))).toBeCloseTo(80, 6);
  });

  it('rejects bad paths early', () => {
    expect(() => ground().flat(10)).toThrow(/at\(x, y\)/);
    expect(() => ground().at(10, 0).to(5, 0)).toThrow(/decrease/);
    expect(() => platformPath().at(0, 0).flat(10).step(-5)).toThrow(/vertical/);
  });

  it('collects a whole TerrainDef', () => {
    const t = terrain(1000, 216);
    t.ground().at(0, 170).flat(500).gap(50).flat(450);
    t.platforms().at(100, 120).slope(60, -20);
    t.platform(300, 100, 80).solid(600, 150, 20, 20, 'crate').hazard('water', 500, 190, 50, 26).killY(250);
    const def = t.build();
    expect(def.bounds).toEqual({ x: 0, y: 0, w: 1000, h: 216 });
    expect(def.ground).toHaveLength(2);
    expect(def.platforms).toHaveLength(2);
    expect(def.solids).toEqual([{ x: 600, y: 150, w: 20, h: 20, tag: 'crate' }]);
    expect(def.hazards[0].kind).toBe('water');
    expect(def.killY).toBe(250);
    // Plain data: survives JSON.
    expect(JSON.parse(JSON.stringify(def))).toEqual(def);
  });
});

describe('terrain queries', () => {
  const def = terrain(1000, 216);
  def.ground().at(0, 170).flat(200).slope(100, -50).flat(100).step(-30).flat(100).gap(100).flat(300);
  def.platform(50, 100, 100);
  def.platforms().at(700, 150).slope(100, -40);
  def.solid(850, 60, 40, 30);
  def.hazard('spikes', 520, 160, 40, 10);
  const t = new Terrain(def.build());

  it('groundY follows the polyline and is Infinity over pits', () => {
    expect(t.groundY(10)).toBe(170);
    expect(t.groundY(250)).toBe(145);
    expect(t.groundY(350)).toBe(120);
    expect(t.groundY(400)).toBe(90); // half-open: the step belongs to the higher part
    expect(t.groundY(399.99)).toBe(120);
    expect(t.groundY(550)).toBe(Infinity); // the pit
    expect(t.groundY(-10)).toBe(Infinity);
    expect(t.groundSlope(250)).toBeCloseTo(-0.5, 12);
  });

  it('platformY, surfaceY, ceilingY, slopeAt', () => {
    expect(t.platformY(100)).toBe(100);
    expect(t.platformY(100, 110, 200)).toBe(Infinity);
    expect(t.platformY(750)).toBe(130);
    expect(t.surfaceY(100, 0)).toBe(100);
    expect(t.surfaceY(100, 101)).toBe(170);
    expect(t.surfaceY(100, 0, Infinity, { platforms: false })).toBe(170);
    expect(t.surfaceY(860, 0)).toBe(60); // solid top
    expect(t.ceilingY(860, 200)).toBe(90); // solid bottom
    expect(t.ceilingY(10, 200)).toBe(-Infinity);
    expect(t.slopeAt(750, 130)).toBeCloseTo(-0.4, 12);
    expect(t.slopeAt(250, 145)).toBeCloseTo(-0.5, 12);
  });

  it('isSolid and cellAt agree with the painter contract', () => {
    expect(t.isSolid(10, 170)).toBe(false); // on the surface
    expect(t.isSolid(10, 170.5)).toBe(true);
    expect(t.isSolid(550, 300)).toBe(false); // pit
    expect(t.isSolid(860, 70)).toBe(true);
    expect(t.cellAt(10, 169)).toBe(CELL_EMPTY);
    expect(t.cellAt(10, 170)).toBe(CELL_GROUND);
    expect(t.cellAt(100, 99)).toBe(CELL_EMPTY);
    expect(t.cellAt(100, 100)).toBe(CELL_PLATFORM);
    expect(t.cellAt(100, 100 + PLATFORM_BAND - 1)).toBe(CELL_PLATFORM);
    expect(t.cellAt(100, 100 + PLATFORM_BAND)).toBe(CELL_EMPTY);
    expect(t.cellAt(860, 60)).toBe(CELL_SOLID);
    expect(t.cellAt(889, 89)).toBe(CELL_SOLID);
    expect(t.cellAt(890, 89)).toBe(CELL_EMPTY);
  });

  it('hazards', () => {
    expect(t.hazardAt({ x: 530, y: 150, w: 10, h: 20 })?.kind).toBe('spikes');
    expect(t.hazardAt({ x: 300, y: 150, w: 10, h: 20 })).toBeNull();
    const out: unknown[] = [];
    expect(t.hazardsAt({ x: 0, y: 0, w: 1000, h: 216 }, out as never[])).toBe(1);
  });

  it('raycast and line of sight', () => {
    // Horizontal ray into the step wall at x = 400 (between y 90 and 120).
    const h = t.raycast(380, 100, 450, 100);
    expect(h?.kind).toBe('ground');
    expect(h?.x).toBeCloseTo(400, 9);
    expect(h?.nx).toBeCloseTo(-1, 9);
    // Down onto the slope.
    const d = t.raycast(250, 0, 250, 200);
    expect(d?.y).toBeCloseTo(145, 9);
    expect(d?.ny).toBeLessThan(0);
    // Across the pit at depth: hits the far cliff (polyline start cap at x = 600).
    const p = t.raycast(520, 200, 700, 200);
    expect(p?.x).toBeCloseTo(600, 9);
    // Platforms only block when asked, and only from above.
    expect(t.raycast(100, 50, 100, 200)?.kind).toBe('ground');
    expect(t.raycast(100, 50, 100, 200, true)?.kind).toBe('platform');
    expect(t.raycast(100, 150, 100, 50, true)).toBeNull();
    // Solid rect from the left.
    const s = t.raycast(800, 75, 900, 75);
    expect(s?.kind).toBe('solid');
    expect(s?.x).toBeCloseTo(850, 9);
    // Leaving a surface does not count as a hit.
    expect(t.raycast(10, 170, 10, 100)).toBeNull();
    expect(t.lineOfSight(10, 160, 190, 160)).toBe(true);
    expect(t.lineOfSight(10, 160, 450, 100)).toBe(false);
    // Start inside ground.
    expect(t.raycast(10, 180, 10, 0)?.t).toBe(0);
  });

  it('ground walls only for steep rises taller than the step height', () => {
    // Moving right toward the 30 px step at x = 400 (feet at 120): wall.
    expect(t.groundWall(1, 390, 401, 120 - 4, 1)).toBe(400);
    // Feet already above the step top: no wall.
    expect(t.groundWall(1, 390, 401, 85, 1)).toBeNaN();
    // The 1:2 slope is walkable.
    expect(t.groundWall(1, 190, 260, 166, 1)).toBeNaN();
    // In the pit, the far cliff (start cap at 600) is a wall; the near one at 500 going left.
    expect(t.groundWall(1, 590, 610, 200, 1)).toBe(600);
    expect(t.groundWall(-1, 510, 495, 200, 1)).toBe(500);
  });

  it('survives bad data with warnings instead of throwing', () => {
    const warn = console.warn;
    const msgs: string[] = [];
    console.warn = (m: string) => msgs.push(m);
    try {
      const bad = new Terrain({
        bounds: { x: 0, y: 0, w: 100, h: 100 },
        ground: [
          [
            [0, 50],
            [50, 50],
            [40, 60],
            [100, NaN],
            [100, 50],
          ],
        ],
        platforms: [
          [
            [0, 20],
            [0, 10],
          ],
        ],
        solids: [{ x: 0, y: 0, w: 0, h: 10 }],
        hazards: [],
      });
      expect(bad.groundY(75)).toBe(50);
      expect(bad.platformCount).toBe(0);
      expect(bad.solids).toHaveLength(0);
    } finally {
      console.warn = warn;
    }
    expect(msgs.length).toBeGreaterThan(0);
  });

  it('empty terrain is all air', () => {
    const e = Terrain.empty();
    expect(e.groundY(10)).toBe(Infinity);
    expect(e.cellAt(10, 10)).toBe(CELL_EMPTY);
    expect(e.killY).toBe(216 + 32);
  });
});
