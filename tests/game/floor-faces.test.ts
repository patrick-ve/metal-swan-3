/**
 * The perspective floor's face groups (docs/design/floor.md §11 R1, docs/api/floor.md §8: the side
 * faces): a side shows only while it faces the eye and narrows to nothing as its prop crosses the
 * screen's centre column; its front edge lies exactly on its sprite's edge for every camera; groups
 * draw before the decor at their depth; world corners are world px; the canvases are made once and
 * always hold their faces' on-screen part. And the kits: the ams house rows and the oz-a shop rows
 * show their sides at the row ends and the alleys; the houseboats are boxes.
 */
import { describe, expect, it } from 'vitest';
import { FLOOR_CX, makeFloorCam, sAtDepth } from '../../src/engine/floor/cam';
import { QuadCanvas } from '../../src/engine/floor/quad';
import { VIEW_H, VIEW_W } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { Terrain } from '../../src/engine/terrain';
import { isSewersContent, loadContent } from '../../src/game/content/index';
import { A_BOATS } from '../../src/game/content/missions/ams/terrain';
import { OZ_A_ROW, OZ_A_ROW_X, OZ_A_SHOPS } from '../../src/game/content/missions/oldenzaal/terrain';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import { wallFace } from '../../src/game/mission/floor/faces';
import type { FaceGroupDef, FloorDef } from '../../src/game/mission/floor/types';
import type { SectionDef } from '../../src/game/mission/types';
import { getMission, listMissions } from '../../src/game/registry';
import { defineFloorTile, floorOf } from '../../src/game/mission/floor/registry';

await loadContent();
// The lazy sewers chunk (docs/design/sewers.md §1): its floors join like the boot set's.
await loadContent(isSewersContent);

/** Every section of every registered mission that has a floor. */
function floorSections(): SectionDef[] {
  const out: SectionDef[] = [];
  for (const m of listMissions()) for (const sec of Object.values(getMission(m)?.sections ?? {})) if (floorOf(sec) && !out.includes(sec)) out.push(sec);
  return out;
}

const G = 176;
const sectionA = getMission('ams')?.sections.a as SectionDef;
const sectionOzA = getMission('oldenzaal')?.sections['oz-a'] as SectionDef;

interface GroupView {
  n: number;
  px: Float64Array;
  py: Float64Array;
  shown: Uint8Array;
  def: FaceGroupDef;
}
interface FloorView {
  groups: GroupView[];
  pool: { made: number; size: number };
  prepare(camX: number, want?: number): void;
  backDeep: Array<{ depth: number; decor: unknown; group: unknown }>;
  projectGroup(g: GroupView, camX: number, camY: number): number[] | null;
  drawGroup(r: SoftRenderer, g: GroupView, d: number): void;
}

/** A floor on section a with only these face groups (no decor of its own beyond the section's). */
function floorWith(faces: FaceGroupDef[]): FloorView {
  const def: FloorDef = { ...(sectionA.floor as FloorDef), faces };
  return new SectionFloor(sectionA, def, new Terrain(sectionA.terrain), 1, 'faces-test/') as unknown as FloorView;
}

/** A house-like box at the facade's depth: both side walls, 40 px wide, 100 high, back to depth 30. */
const BOX: FaceGroupDef = {
  name: 'box',
  x: 1000,
  y: G,
  depth: 14,
  faces: [wallFace(-20, 0, 100, 14, 30, -1, 'floor/slab', 16), wallFace(20, 0, 100, 14, 30, 1, 'floor/slab', 16)],
};

/** The on-screen width of face f of a projected group. */
function faceWidth(g: GroupView, f: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let c = 0; c < 4; c++) {
    lo = Math.min(lo, g.px[f * 4 + c]);
    hi = Math.max(hi, g.px[f * 4 + c]);
  }
  return hi - lo;
}

describe('face groups (spec §11 R1)', () => {
  const floor = floorWith([BOX]);
  const g = floor.groups[0];
  const cam = makeFloorCam({ yh: 60, f: 210, back: 146 });
  const s14 = sAtDepth(cam, 14);

  it('shows the side that faces the screen centre only, and narrows it to nothing at the centre', () => {
    // The box left of the centre: its right side shows; right of the centre: its left side.
    floor.projectGroup(g, 1000 + 120 - FLOOR_CX, 0);
    expect([...g.shown]).toEqual([0, 1]);
    floor.projectGroup(g, 1000 - 120 - FLOOR_CX, 0);
    expect([...g.shown]).toEqual([1, 0]);
    // The right side's width falls steadily as the eye comes to its edge (u = x + 20 / s14), then it hides.
    const edge = 1000 + 20 / s14;
    let last = Infinity;
    for (let eye = edge + 160; eye > edge + 0.25; eye -= 2.5) {
      floor.projectGroup(g, eye - FLOOR_CX, 0);
      const w = faceWidth(g, 1);
      expect(w).toBeLessThan(last);
      last = w;
    }
    // Linear in the eye's distance (true perspective: the back edge goes to the vanishing point) …
    floor.projectGroup(g, edge + 100 - FLOOR_CX, 0);
    const w100 = faceWidth(g, 1);
    floor.projectGroup(g, edge + 50 - FLOOR_CX, 0);
    expect(faceWidth(g, 1)).toBeCloseTo(w100 / 2, 6);
    // … to nothing at the edge, and then the side hides.
    floor.projectGroup(g, edge + 0.2 - FLOOR_CX, 0);
    expect(faceWidth(g, 1)).toBeLessThan(0.05);
    floor.projectGroup(g, edge - 2 - FLOOR_CX, 0);
    expect(g.shown[1]).toBe(0);
  });

  it('puts a side front edge on its sprite edge for every camera (decor drawn at its depth, unscaled)', () => {
    for (const camX of [600, 812.5, 1000.25, 1180]) {
      floor.projectGroup(g, camX, 0);
      // The decor's anchor on screen: 192 + (x − camX − 192)·s; its edge 20 px right; its base on the depth's row.
      const ax = FLOOR_CX + (1000 - camX - FLOOR_CX) * s14;
      const lift = (floor as unknown as { liftAt(x: number, d: number): number }).liftAt(1000, 14);
      // Right wall: corners front-top, back-top, back-bottom, front-bottom.
      expect(g.px[4]).toBeCloseTo(ax + 20, 9);
      expect(g.px[7]).toBeCloseTo(ax + 20, 9);
      expect(g.py[7]).toBeCloseTo(G - 14 - lift, 9);
      expect(g.py[4]).toBeCloseTo(G - 14 - lift - 100, 9);
    }
  });

  it('takes world corners as world px', () => {
    const f = floorWith([{ name: 'w', x: 500, y: G, depth: 14, faces: [wallFace(6, 0, 10, 0, 10, 1, 'floor/slab', 8, 0, true)] }]);
    const gw = f.groups[0];
    f.projectGroup(gw, 400, 0);
    // The front corners at depth 0: u = 506, h 10 / 0 → the plain 2D world.
    expect(gw.px[0]).toBeCloseTo(106, 9);
    expect(gw.py[0]).toBeCloseTo(G - 10, 9);
    expect(gw.py[3]).toBeCloseTo(G, 9);
  });

  it('draws the groups before the decor at their depth (a facade covers its own edge)', () => {
    const real = new SectionFloor(sectionA, sectionA.floor as FloorDef, new Terrain(sectionA.terrain), 1, 'faces-test-a/') as unknown as FloorView;
    const at14 = real.backDeep.filter((e) => e.depth === 14);
    const firstDecor = at14.findIndex((e) => e.decor);
    const lastGroup = at14.map((e) => !!e.group).lastIndexOf(true);
    expect(lastGroup).toBeGreaterThanOrEqual(0);
    expect(lastGroup).toBeLessThan(firstDecor);
  });

  it('keeps every face of ams a and oz-a inside its canvas; the pool made at the start makes no canvas while drawing (res 1, 2, 8)', () => {
    let quads = 0;
    let worst = -Infinity;
    const orig = QuadCanvas.prototype.quad;
    QuadCanvas.prototype.quad = function (xs, ys, qs, as, bs, tex) {
      quads++;
      for (let i = 0; i < 4; i++) {
        // The on-screen part (the canvas is clamped to the view ± 1).
        const x = Math.max(-1, Math.min(VIEW_W + 1, xs[i])) - this.ox;
        const y = Math.max(-1, Math.min(VIEW_H + 1, ys[i])) - this.oy;
        worst = Math.max(worst, x - this.w, y - this.h, -x - 1, -y - 1);
      }
      return orig.call(this, xs, ys, qs, as, bs, tex);
    };
    try {
      // Every section with a floor (they join by themselves).
      for (const sec of floorSections()) {
        const f = new SectionFloor(sec, floorOf(sec) as FloorDef, new Terrain(sec.terrain), 1, `faces-canvas-${sec.id}/`) as unknown as FloorView;
        for (const res of [1, 2, 8]) {
          const r = new SoftRenderer(undefined, undefined, undefined, { res });
          const d = res >= 4 ? 4 : res;
          // The section start sizes the pool for this density (prepare), then a pan makes none.
          f.prepare(0, d);
          const made = f.pool.made;
          for (let x = 0; x <= sec.width - VIEW_W; x += 3.5) {
            r.setCamera(x, 0);
            for (const g of f.groups) f.drawGroup(r, g, d);
          }
          expect(f.pool.made, `${sec.id} res ${res}: no canvas made on the frame path`).toBe(made);
        }
      }
    } finally {
      QuadCanvas.prototype.quad = orig;
    }
    expect(quads).toBeGreaterThan(1000);
    expect(worst).toBeLessThanOrEqual(0.01);
  }, 120_000);
});

describe('a narrow side face does not shimmer (M2: the whole mip chain, the level from the real footprint)', () => {
  // A wall tile striped along b (depth) every 2 world px: still stripes after the band's three levels, the
  // worst case for aliasing as the side narrows.
  defineFloorTile('test/stripes-b', { w: 16, h: 32, paint: (_a, b) => (Math.floor(b / 2) % 2 === 0 ? 0xf0f0f0ff : 0x101010ff) });
  const STRIPES: FaceGroupDef = { name: 'stripes', x: 1000, y: G, depth: 14, faces: [wallFace(-20, 0, 100, 14, 60, -1, 'test/stripes-b', 32)] };

  /** The side's mean luminance per frame over a slow pan while it narrows to nothing, and its worst footprint left. */
  function means(truncate: boolean): { means: number[]; residual: number } {
    const floor = floorWith([STRIPES]) as unknown as FloorView & { store: { tile(i: number, d: number): { levels: unknown[] } | null }; groups: Array<{ tile: Int32Array; cv: { residual: number } | null }> };
    const g = floor.groups[0];
    if (truncate) {
      // The wave-A sampling: the tile's three band levels only.
      const t = floor.store.tile(g.tile[0], 2);
      if (t) (t.levels as unknown[]).length = 3;
    }
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
    const s14 = sAtDepth(makeFloorCam({ yh: 60, f: 210, back: 146 }), 14);
    const edge = 1000 - 20 / s14;
    const out: number[] = [];
    let residual = 0;
    for (let eye = edge - 60; eye < edge - 2; eye += 0.5) {
      r.begin(0x00000000);
      r.setCamera(eye - FLOOR_CX, 0);
      floor.drawGroup(r, g, 2);
      residual = Math.max(residual, g.cv ? g.cv.residual : 0);
      let sum = 0;
      let n = 0;
      for (const c of r.target.data) {
        if ((c & 255) < 250) continue;
        sum += ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
        n++;
      }
      if (n > 30) out.push(sum / n);
    }
    return { means: out, residual };
  }

  it('keeps the colour of a narrowing side steady frame to frame (the wave-A sampling flickered: this test catches it)', () => {
    const now = means(false);
    const old = means(true);
    const jump = (m: number[]): number => Math.max(...m.slice(1).map((v, i) => Math.abs(v - m[i])));
    expect(now.means.length).toBeGreaterThan(40);
    expect(now.residual).toBeLessThanOrEqual(1.5);
    // The side's mean colour moves on gently as stripes cross its near edge; the wave-A sampling picked
    // black or white stripes at random every frame where the side was narrow.
    expect(jump(now.means), 'mean luminance step between frames, now').toBeLessThan(25);
    expect(old.residual).toBeGreaterThan(4);
    expect(jump(old.means), 'mean luminance step between frames, wave A').toBeGreaterThan(50);
  });
});

describe('the kits\' side faces (spec §11 R1)', () => {
  const groups = sectionA.floor?.faces ?? [];
  const names = groups.map((g) => g.name ?? '');

  it('ams a: the house rows show their sides at the row ends, and FABEL FRIET above its neighbours', () => {
    // The shopping street (1904 → 2628) and the arrival row (2804 →).
    const sides = names.filter((n) => n.startsWith('house side'));
    expect(sides.some((n) => n.includes('@1933') && n.endsWith(' L'))).toBe(true);
    expect(sides.some((n) => n.endsWith(' R') && /@2(5|6)\d\d/.test(n))).toBe(true);
    expect(sides.some((n) => n.includes('fabel-friet') && n.endsWith(' L'))).toBe(true);
    expect(sides.some((n) => n.includes('fabel-friet') && n.endsWith(' R'))).toBe(true);
    expect(sides.length).toBeGreaterThan(8);
  });

  it('ams a: the houseboats are boxes (hull and cabin ends on both sides), the drawbridge has its leaf and arms', () => {
    for (const b of A_BOATS) {
      const g = groups.find((x) => x.name === `houseboat @${b.x0}`);
      expect(g?.faces.length).toBe(4);
    }
    expect(names).toContain('drawbridge leaf');
    expect(names.filter((n) => n.startsWith('barrier arm')).length).toBe(4);
  });

  it('oz-a: both sides of every alley and the row ends get their side walls', () => {
    const oz = (sectionOzA.floor?.faces ?? []).map((g) => g.name ?? '');
    // Walk the row: an alley is a gap item between two shops.
    let k = 0;
    for (let i = 0; i < OZ_A_ROW.length; i++) {
      const it = OZ_A_ROW[i];
      if (typeof it === 'number') {
        k++;
        continue;
      }
      const left = OZ_A_SHOPS[k - 1];
      const right = OZ_A_SHOPS[k];
      expect(oz, `alley after shop ${k - 1}`).toContain(`shop side #${left.frame} @${left.x} R`);
      expect(oz, `alley before shop ${k}`).toContain(`shop side #${right.frame} @${right.x} L`);
    }
    expect(OZ_A_SHOPS[0].x).toBe(OZ_A_ROW_X);
    expect(oz.filter((n) => n.startsWith('car ends')).length).toBe(3);
    expect(oz.filter((n) => n.startsWith('wall ends')).length).toBe(3);
  });
});
