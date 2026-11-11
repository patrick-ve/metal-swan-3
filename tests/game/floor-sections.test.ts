/**
 * The perspective floor on the real sections (docs/design/floor.md §7, §8 gates 4 and 5;
 * src/game/mission/floor/checks.ts). EVERY section of every registered mission that has a
 * `SectionDef.floor` joins these tests by itself:
 * - the walk line: the drawn floor at v = 0 is on the physics surface (±0.5 px, every px);
 * - the mesh is watertight: no T-junction (a GPU's vertex snap opens cracks at one);
 * - canopies / slabs: their front edges lie on platform lines;
 * - the factor rule: lifted background layers scroll slower than the floor's back edge;
 * - the front-row rules (spacing, width, height, kept spots);
 * - GATE 5 over a bot run: nothing drawn over the world covers a hero's head or gun;
 * - THE PAN TEST and THE STILL TEST on its real floor (spec §2.7);
 * - its face groups sample their tiles without aliasing (the residual footprint after the mip
 *   level, the cause of M2's shimmer), and the canvases' edges move in backbuffer px steps at res 4
 *   and 8 (a face group and a canopy: no ½-px grid);
 * - the ground mist's rows move at s(y)·Δ (no whole-px snapping), where the section has one;
 * - no contact shadow lies where nothing is drawn (a bot run);
 * - THE MEMORY TEST: the floor's whole CPU memory at tier 4 in the browser's flow (deferred art
 *   jobs, the band on a GPU after the CPU raster's frames of its compile) stays ≤ 16 MB over a walk
 *   of the section, the store never caps, and the frame path makes no canvas.
 * The debug floor is also built on every horizontal `ams` and `oldenzaal` section (their humps,
 * steps, gaps and water: the mesh against every real walk profile), and the opt-in hooks are
 * checked to change nothing without a floor. (The factor rule is checked per real floor: oz-c's
 * `oz-basilica` layer has factorX 1 and needs its kit's answer in wave B.)
 */
import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/engine/palette';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Renderer } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { Entity } from '../../src/engine/entity';
import { isOatContent, loadContent } from '../../src/game/content/index';
import { getMission, listMissions } from '../../src/game/registry';
import {
  bindWorldFloor,
  debugFloorDef,
  decorDepthOf,
  factorViolations,
  floorOf,
  floorPool,
  floorProject,
  floorShift,
  frontRowViolations,
  overhangErrors,
  setFloorOverride,
  walkLineErrors,
  worldFloor,
  FRONT_CLEAR,
} from '../../src/game/mission/floor/index';
import type { FloorDef } from '../../src/game/mission/floor/types';
import type { DecorDef, SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { FLOOR_CX, sOfY } from '../../src/engine/floor/cam';
import type { FloorFrame, FloorGpu } from '../../src/engine/floor/gpu';
import { heightAt, meshTJunctions, MESH_MIN_GAP, QUAD_FACE_V, QUAD_TOP } from '../../src/engine/floor/mesh';
import { VIEW_W } from '../../src/engine/render';
import { artTier, cancelArtJobs, pendingArtJobs, runArtJobs, setArtTier, setDeferDense, setDeferHiArt } from '../../src/engine/sprites';
import { sectionLight } from '../../src/game/content/oldenzaal/kit/light-api';
import { frontCoverHits } from '../../src/game/mission/floor/checks';
import { SectionFloor, SHADOW_MAX_AIR } from '../../src/game/mission/floor/section-floor';
import type { FaceGroupDef } from '../../src/game/mission/floor/types';
import { createHeadlessGame } from '../../src/sim/index';
import { AMS_WAVE_B } from '../../src/game/content/missions/ams/floor/sections';

await loadContent();
// The lazy oat chunk (decision 49): its floors join every gate here like the boot set's.
await loadContent(isOatContent);

/** Every [mission, section] pair with a floor (the sections join these tests by themselves). */
function floorSections(): Array<[string, SectionDef]> {
  const out: Array<[string, SectionDef]> = [];
  for (const m of [...listMissions(), 'oldenzaal', 'ams']) {
    const def = getMission(m);
    if (!def) continue;
    for (const s of Object.values(def.sections)) if (floorOf(s) && !out.some(([, x]) => x === s)) out.push([m, s]);
  }
  return out;
}

/**
 * The sections that must have a floor now (wave A: `ams` a and oz-a; wave B: every `ams` section whose
 * builder turned its switch on — `AMS_WAVE_B`, read from their folders, so no builder edits this file).
 * A floor that disappears fails here instead of silently dropping every check below.
 */
const EXPECTED_FLOORS = ['ams/a', 'oldenzaal/oz-a', 'oat/oat-a', 'oat/oat-d', ...AMS_WAVE_B.filter((s) => s.on).map((s) => `ams/${s.id}`)];

describe('every section with a floor (gates 4 and 5)', () => {
  const list = floorSections();
  it('lists the floor sections: every expected one (a floor that is gone fails), each checked below', () => {
    const ids = list.map(([m, s]) => `${m}/${s.id}`);
    for (const id of EXPECTED_FLOORS) expect(ids, `${id} has no floor`).toContain(id);
    expect(ids.length).toBeGreaterThanOrEqual(EXPECTED_FLOORS.length);
  });
  for (const [m, s] of list) {
    it(`${m}/${s.id}: the walk line is the physics surface`, () => {
      expect(walkLineErrors(s).slice(0, 5)).toEqual([]);
    });
    it(`${m}/${s.id}: canopies and slabs sit on their platforms`, () => {
      expect(overhangErrors(s)).toEqual([]);
    });
    it(`${m}/${s.id}: lifted layers scroll slower than the back edge`, () => {
      expect(factorViolations(s)).toEqual([]);
    });
    it(`${m}/${s.id}: the front rows keep the rules`, () => {
      expect(frontRowViolations(s)).toEqual([]);
    });
    it(`${m}/${s.id}: the mesh is watertight (no vertex inside another quad's edge: no T-junction; no sliver quad: no GPU crack)`, () => {
      const floor = new SectionFloor(s, floorOf(s) as FloorDef, new Terrain(s.terrain), 1, `tj/${m}/${s.id}/`);
      const mesh = floor.mesh;
      expect(meshTJunctions(mesh)).toEqual([]);
      // A top or a +v face narrower than MESH_MIN_GAP along u folds under a GPU's vertex snap (two
      // region ends that close: move one).
      const slivers: string[] = [];
      for (let q = 0; q < mesh.quadCount; q++) {
        const k = mesh.quadKind[q];
        const w = mesh.quadU1[q] - mesh.quadU0[q];
        if ((k === QUAD_TOP || k === QUAD_FACE_V) && w < MESH_MIN_GAP) slivers.push(`u ${mesh.quadU0[q].toFixed(3)} + ${w.toFixed(3)}`);
      }
      expect(slivers).toEqual([]);
      floor.dispose();
    });
  }
});

describe('the debug floor on every horizontal ams and oldenzaal section', () => {
  for (const m of ['ams', 'oldenzaal']) {
    const def = getMission(m);
    for (const s of Object.values(def?.sections ?? {})) {
      if (s.scroll !== 'right' || s.height !== 216) continue;
      it(`${m}/${s.id}: the mesh is the walk profile at v = 0`, () => {
        expect(walkLineErrors(s, debugFloorDef(s, m)).slice(0, 5)).toEqual([]);
      });
    }
  }
});

describe('front-row rules (§3.6)', () => {
  const s = getMission('ams')?.sections.a as SectionDef;
  const base = (rows: FloorDef['rows'], keepClear?: number[]): FloorDef => ({
    camera: { yh: 60, f: 210, back: 146 },
    painter: { id: 'floor/debug' },
    rows,
    keepClear,
  });

  it('passes a thin, low, sparse row away from the kept spots', () => {
    debugFloorDef(s, 'ams');
    expect(frontRowViolations(s, base([{ prop: 'floor/debug-post', depth: -16.5, at: [200, 260, 330] }]))).toEqual([]);
  });

  it('flags props too close, too wide, too high and over a kept spot', () => {
    const v = frontRowViolations(
      s,
      base(
        [
          { name: 'close', prop: 'floor/debug-post', depth: -16.5, at: [200, 220] },
          { name: 'wide', prop: 'floor/debug-post', depth: -16.5, scale: 2.5, at: [400] },
          { name: 'tall', prop: 'floor/debug-post', depth: -4, scale: 1.4, at: [600] },
          { name: 'spot', prop: 'floor/debug-post', depth: -16.5, at: [800] },
        ],
        [800 + FRONT_CLEAR - 4],
      ),
    );
    expect(v.some((x) => x.startsWith('close:') && x.includes('closer'))).toBe(true);
    expect(v.some((x) => x.startsWith('wide:') && x.includes('wide'))).toBe(true);
    expect(v.some((x) => x.startsWith('tall:') && x.includes('above'))).toBe(true);
    expect(v.some((x) => x.startsWith('spot:') && x.includes('kept spot'))).toBe(true);
    // The player start (48) is a kept spot too.
    expect(frontRowViolations(s, base([{ prop: 'floor/debug-post', depth: -16.5, at: [60] }])).length).toBe(1);
  });
});

/** A plain flat section without a floor. */
function plain(): SectionDef {
  return {
    id: 'plain',
    width: 1200,
    height: 216,
    scroll: 'right',
    background: { sky: PAL.sky[2], layers: [] },
    terrain: { bounds: { x: 0, y: 0, w: 1200, h: 216 }, ground: [[[0, 170], [600, 170]], [[660, 170], [1200, 170]]], platforms: [[[100, 120], [200, 120]]], solids: [], hazards: [] },
    terrainStyle: { ground: 'dirt' },
    playerStart: { x: 48, y: 170 },
    *script() {},
  };
}

class Box extends Entity {
  override draw(r: Renderer): void {
    r.rect(this.x - 4, this.y - 10, 8, 10, 0xff8000ff);
  }
}

describe('the opt-ins change nothing without a floor', () => {
  it('a section without a floor has no SectionFloor; drawShadows draws nothing', () => {
    const s = plain();
    const view = new SectionView(s, new Terrain(s.terrain), 1, 2);
    expect(view.floor).toBeNull();
    const r = new SoftRenderer();
    r.begin(0x123456ff);
    const before = r.target.data.slice();
    const world = new World({ terrain: new Terrain(s.terrain), seed: 1 });
    view.drawShadows(r, world);
    expect(Buffer.from(r.target.data.buffer).equals(Buffer.from(before.buffer))).toBe(true);
  });

  it('floor-only decor (DecorDef.floorOnly) is drawn only with a floor: every no-floor path (--floor-off, a failed build) leaves it out', () => {
    let marked = 0;
    for (const [, s] of floorSections()) {
      const only = (s.decor ?? []).filter((d) => d.floorOnly);
      marked += only.length;
      const lists = (v: SectionView): DecorDef[] => {
        const x = v as unknown as { back: DecorDef[]; front: DecorDef[] };
        return [...x.back, ...x.front];
      };
      const on = new SectionView(s, new Terrain(s.terrain), 1, 1);
      expect(on.floor, `${s.id}: its floor`).not.toBeNull();
      for (const d of only) expect(lists(on), `${s.id}: ${d.sprite} with the floor`).toContain(d);
      on.dispose();
      for (const off of [() => null, () => ({ ...(s.floor as FloorDef), camera: { yh: 200, f: 210, back: 100 } })]) {
        // --floor-off (no floor), and a floor def that fails to build (the camera's order is wrong).
        setFloorOverride(off);
        const warn = console.warn;
        console.warn = () => {};
        try {
          const v = new SectionView(s, new Terrain(s.terrain), 1, 1);
          expect(v.floor, `${s.id}: no floor`).toBeNull();
          const drawn = lists(v);
          expect(drawn.filter((d) => d.floorOnly), `${s.id}: floor-only decor without a floor`).toEqual([]);
          expect(drawn.length, `${s.id}: the rest of its decor`).toBe((s.decor ?? []).length - only.length);
          v.dispose();
        } finally {
          console.warn = warn;
          setFloorOverride(null);
        }
      }
    }
    // The wave-B sections mark theirs (c1's white railing, d's Stopera …).
    expect(marked).toBeGreaterThan(5);
  });

  it('World.draw: entities with drawDepth 0 draw themselves even with a depth hook set', () => {
    const s = plain();
    const draw = (hook: boolean): PixelBuffer => {
      const world = new World({ terrain: new Terrain(s.terrain), seed: 1 });
      world.add(new Box(world, 100, 170));
      world.add(new Box(world, 150.5, 160));
      world.flush();
      if (hook) world.depthDraw = () => {
        throw new Error('the hook must not run for drawDepth 0');
      };
      const r = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
      r.begin(0x000000ff);
      r.setCamera(40, 0);
      world.draw(r);
      return r.target;
    };
    const a = draw(false);
    const b = draw(true);
    expect(Buffer.from(b.data.buffer).equals(Buffer.from(a.data.buffer))).toBe(true);
    expect(a.countOpaque()).toBeGreaterThan(0);
  });

  it('with a floor: drawDepth shifts an entity to its depth (render only, the hitbox stays)', () => {
    const s = plain();
    s.floor = debugFloorDef(s, 'ams');
    const terrain = new Terrain(s.terrain);
    const view = new SectionView(s, terrain, 1, 1);
    const floor = view.floor;
    expect(floor).not.toBeNull();
    const world = new World({ terrain, seed: 1 });
    const e = new Box(world, 300, 170);
    world.add(e);
    world.flush();
    world.depthDraw = (r, en) => floor?.drawAtDepth(r, en, world);
    const shot = (depth: number): number => {
      e.drawDepth = depth;
      const r = new SoftRenderer();
      r.begin(0x000000ff);
      r.setCamera(world.camera.viewX, world.camera.viewY);
      world.draw(r);
      // The box's top row on screen.
      for (let y = 0; y < 216; y++) for (let x = 0; x < 384; x++) if (r.target.data[y * 384 + x] === 0xff8000ff) return y;
      return -1;
    };
    const flat = shot(0);
    const deep = shot(14);
    expect(flat - deep).toBe(14);
    const hb = e.hitRect();
    expect(hb.y).toBe(e.y + e.hitbox.y);
  });
});

describe('light hooks (§3.8)', () => {
  it('floorShift follows a decor item drawn at its depth; floorPool lies on its floor row; worldFloor binds', () => {
    const s = plain();
    s.floor = { ...debugFloorDef(s, 'ams'), decorDepth: (d) => (d.sprite === 'lamp' ? 14 : undefined) };
    s.decor = [{ sprite: 'lamp', x: 500, y: 170 }, { sprite: 'bench', x: 520, y: 170 }];
    const terrain = new Terrain(s.terrain);
    const view = new SectionView(s, terrain, 1, 1);
    const floor = view.floor;
    if (!floor) throw new Error('no floor');
    const world = new World({ terrain, seed: 1 });
    expect(worldFloor(world)).toBeNull();
    bindWorldFloor(world, floor);
    expect(worldFloor(world)).toBe(floor);
    expect(decorDepthOf(floor, s.decor[0], 0)).toBe(14);
    expect(decorDepthOf(floor, s.decor[1], 1)).toBe(0);
    // A point at depth 14 with the camera at 300: screen x = 192 + (500 − 300 − 192)·s(14), y up by 14.
    const pt = { x: 0, y: 0 };
    floorShift(floor, 500, 100, 14, 300, pt);
    const s14 = 1 - 14 / (176 - 60);
    expect(pt.x - 300).toBeCloseTo(192 + (500 - 300 - 192) * s14, 9);
    expect(pt.y).toBe(86);
    // The pool's centre is on the floor at its depth: this ground is 6 px over the walk plane, so
    // y = yh + (yw − yh − 6)·s(14); flattened by the perspective.
    const pool = { x: 0, y: 0, rx: 0, ry: 0 };
    floorPool(floor, 500, 14, 30, 300, pool);
    expect(pool.y).toBeCloseTo(60 + (116 - 6) * s14, 6);
    expect(pool.rx).toBeCloseTo(30 * s14, 9);
    expect(pool.ry).toBeLessThan(pool.rx);
    // floorProject at v = 0 is the plain 2D world.
    floorProject(floor, 420, 0, 6, 300, 0, pt);
    expect(pt.x).toBeCloseTo(120, 9);
    expect(pt.y).toBeCloseTo(170, 9);
  });
});

// ------------------------------------------------------------------------------- the auto-enrolled proofs

function lum(c: number): number {
  return ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
}

/** The sub-pixel shift k (output px) that best maps row A onto row B: B[x] ≈ A[x − k] (floor-raster.test.ts). */
function rowShift(a: Float64Array, b: Float64Array, maxK: number): number {
  const n = a.length;
  const m = maxK + 2;
  const ssd = (k: number): number => {
    let sum = 0;
    for (let x = m + 8; x < n - m - 8; x++) {
      const d = b[x] - a[x - k];
      sum += d * d;
    }
    return sum;
  };
  let best = 0;
  let bv = Infinity;
  for (let k = -maxK; k <= maxK; k++) {
    const v = ssd(k);
    if (v < bv) {
      bv = v;
      best = k;
    }
  }
  const l = ssd(best - 1);
  const r = ssd(best + 1);
  const den = l - 2 * bv + r;
  return den > 1e-9 ? best + (0.5 * (l - r)) / den : best;
}

function realFloor(s: SectionDef, key: string): SectionFloor {
  return new SectionFloor(s, floorOf(s) as FloorDef, new Terrain(s.terrain), 1, `sections-test/${key}/${s.id}/`);
}

/**
 * The level surfaces a section's band can show a view wide: the walk plane (h 0) first, then the
 * level of every `cut` (the water of a canal or a river, a plank deck over it). The river sections
 * (c1, c2) have no flat land a view wide; their pan test runs on the river or the deck.
 */
function levelsOf(floor: SectionFloor): number[] {
  const out = [0];
  for (const ft of floor.def.features ?? []) {
    if (ft.kind !== 'cut') continue;
    const l = ft.level ?? -4;
    if (!out.includes(l)) out.push(l);
  }
  return out;
}

/** The scale of screen row y on a level surface h over the walk plane: s = (y − yh)/(yw − yh − h) (h 0: s(y)). */
function sLevel(floor: SectionFloor, y: number, h: number): number {
  const c = floor.cam;
  return (y - c.yh) / (c.yw - c.yh - h);
}

/**
 * Is the level surface h at screen row y seen across the view at camX? Nothing nearer may rise into the
 * line of sight (a raised deck hides the river behind it): for screen columns every 16 px and nearer
 * depths up to the mesh's front, the floor stays under the ray's height (yw − yh) − (y − yh)/s there.
 */
function seen(floor: SectionFloor, camX: number, y: number, h: number): boolean {
  const c = floor.cam;
  const k = c.yw - c.yh;
  const s0 = sLevel(floor, y, h);
  const sFront = c.f / (c.f - c.vFront);
  for (let xs = -192; xs <= 192; xs += 16) {
    for (let s = s0 + 0.005; s <= sFront; s += 0.005) {
      const v = c.f * (1 - 1 / s);
      const ray = k - (y - c.yh) / s;
      if (heightAt(floor.field, camX + 192 + xs / s, v) > ray + 1e-6) return false;
    }
  }
  return true;
}

/**
 * Rows of a LEVEL surface h at camera camX: screen rows whose floor is h across the view (and ±2.5 px
 * around the row: no kerb, step, cut edge or deck edge near it); there every texel moves at
 * sLevel(y, h)·Δ. h 0 is the flat walk plane (the rows of the original test).
 */
function levelRows(floor: SectionFloor, camX: number, k: number, h: number): number[] {
  const cam = floor.cam;
  const out: number[] = [];
  const rows = floor.bandH * k;
  for (let j = 0; j < rows; j++) {
    const y = floor.bandTop + (j + 0.5) / k;
    if (y > 214) continue;
    let level = true;
    for (const dy of [-2.5, 0, 2.5]) {
      const sl = sLevel(floor, y + dy, h);
      const v = cam.f * (1 - 1 / sl);
      if (!(sl > 0) || v < cam.vBack + 1e-3) {
        level = false;
        break;
      }
      const half = (FLOOR_CX + 4) / sl;
      for (let u = camX + FLOOR_CX - half; u <= camX + FLOOR_CX + half && level; u += 6) if (Math.abs(heightAt(floor.field, u, v) - h) > 1e-6) level = false;
      if (!level) break;
    }
    // A cut's level (not the walk plane: its rows are as before) only where nothing nearer hides it.
    if (level && h !== 0 && !seen(floor, camX, y, h)) level = false;
    if (level) out.push(j);
  }
  return out;
}

/** Rows the pan test must check per res (over its 8 camera steps). */
const PAN_MIN_ROWS = 40;

/**
 * The camera x and the level of the pan test: the walk plane (h 0) at its longest flat stretch, as
 * before, wherever it has flat land a view wide (a, b, c, d, oz-a); else, over every cut level, the
 * level and camera with the most rows (c1 and c2: the river; c1's plank deck, a strip of a few rows, is
 * pan-tested in ams-floor-river.test.ts). (A raised pavement is a level too, but its tiles'
 * joint rows repeat every 4 texels: the cross-correlation cannot tell their shift, so it never
 * replaces the walk plane.)
 */
function levelCamera(floor: SectionFloor, s: SectionDef): { x: number; h: number } {
  let best = { x: 0, h: 0 };
  let bestN = -1;
  for (const h of levelsOf(floor)) {
    // The walk plane (first) wherever it shows flat rows; else every cut level, the most rows win.
    if (h !== 0 && best.h === 0 && bestN > 0) break;
    for (let x = 0; x <= Math.max(0, s.width - VIEW_W); x += 64) {
      const n = levelRows(floor, x, 1, h).length;
      if (n > bestN) {
        bestN = n;
        best = { x, h };
      }
    }
  }
  return best;
}

describe('every floor section: smooth (spec §2.7: the pan test and the still test on its real floor)', () => {
  for (const [m, s] of floorSections()) {
    it(`${m}/${s.id}: every row of a level surface (the walk plane, else a cut's level) moves s(y)·Δ within 1/res at 0.5 and 2 px/tick; a still camera draws the same band`, () => {
      const floor = realFloor(s, 'pan');
      const { x: x0, h } = levelCamera(floor, s);
      for (const k of [1, 2]) {
        const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
        const bw = VIEW_W * k;
        let checked = 0;
        let worst = 0;
        for (const speed of [0.5, 2]) {
          let x = x0;
          r.setCamera(x, 0);
          floor.drawBand(r, 0, k);
          let prev = (floor.raster.band as PixelBuffer).data.slice();
          let prevCam = r.camX;
          for (let t = 1; t <= 4; t++) {
            x += speed;
            r.setCamera(x, 0);
            floor.drawBand(r, 0, k);
            const cur = (floor.raster.band as PixelBuffer).data.slice();
            const delta = r.camX - prevCam;
            for (const j of levelRows(floor, r.camX, k, h)) {
              const a = new Float64Array(bw);
              const b = new Float64Array(bw);
              let mean = 0;
              for (let i = 0; i < bw; i++) {
                a[i] = lum(prev[j * bw + i]);
                b[i] = lum(cur[j * bw + i]);
                mean += a[i];
              }
              mean /= bw;
              let vr = 0;
              for (let i = 0; i < bw; i++) vr += (a[i] - mean) ** 2;
              if (vr / bw < 20) continue;
              const y = floor.bandTop + (j + 0.5) / k;
              const want = -sLevel(floor, y, h) * delta * k;
              const err = Math.abs(rowShift(a, b, Math.ceil(Math.abs(want)) + 3) - want) / k;
              worst = Math.max(worst, err);
              checked++;
              expect(err, `res ${k} speed ${speed} x ${x} level ${h} row y ${y.toFixed(2)}`).toBeLessThanOrEqual(1 / k);
            }
            prev = cur;
            prevCam = r.camX;
          }
        }
        expect(checked, `res ${k} level ${h} at x ${x0}: rows checked`).toBeGreaterThan(PAN_MIN_ROWS);
        // THE STILL TEST: the same camera and tick twice.
        r.setCamera(x0 + 3.25, 0);
        floor.drawBand(r, 7, k);
        const a = (floor.raster.band as PixelBuffer).data.slice();
        floor.drawBand(r, 7, k);
        expect(Buffer.from((floor.raster.band as PixelBuffer).data.buffer).equals(Buffer.from(a.buffer))).toBe(true);
      }
    }, 60_000);
  }
});

/** A floor of section s with only these face groups / overhangs (and nothing else drawn over the floor). */
function floorWithOnly(s: SectionDef, faces: FloorDef['faces'], overhangs: FloorDef['overhangs'], key: string): SectionFloor {
  const def: FloorDef = { ...(floorOf(s) as FloorDef), faces, overhangs, tops: [], openings: [], rows: [] };
  return new SectionFloor({ ...s, decor: [] }, def, new Terrain(s.terrain), 1, `sections-test/${key}/${s.id}/`);
}

/**
 * The left and right edge of row y (backbuffer px) of a picture of one quad or face group on an empty
 * (transparent) renderer, from its coverage: C = Σ α (the width), M = Σ x·α / C (the centre). Exact for
 * a span whose end pixels are partly covered; null for an empty row.
 */
function rowEdges(buf: PixelBuffer, y: number, x0: number, x1: number): [number, number] | null {
  let c = 0;
  let mx = 0;
  for (let x = Math.max(0, x0); x < Math.min(buf.w, x1); x++) {
    const a = (buf.data[y * buf.w + x] & 255) / 255;
    c += a;
    mx += (x + 0.5) * a;
  }
  if (c < 2) return null;
  const m = mx / c;
  return [m - c / 2, m + c / 2];
}

/**
 * How far an edge's steps between frames stray from its even motion (the mean step), backbuffer px:
 * an edge on the world's 1/res grid strays at most about 1 px (the grid's rounding); one on a ½-px
 * grid jumps by k/2 px every few frames (4 px at res 8).
 */
function worstStray(series: number[]): number {
  const mean = (series[series.length - 1] - series[0]) / (series.length - 1);
  let w = 0;
  for (let i = 1; i < series.length; i++) w = Math.max(w, Math.abs(series[i] - series[i - 1] - mean));
  return w;
}

describe('every floor section: the faces and quads move with the world (spec §2.1, §2.3)', () => {
  for (const [m, s] of floorSections()) {
    const def = floorOf(s) as FloorDef;
    // A floor with no face groups (oat wave A: the strips are the façades) has nothing to sample.
    it.skipIf(!def.faces?.length)(`${m}/${s.id}: every face group samples its tiles without aliasing (the footprint left after the mip level ≤ √2, or the one-row mean)`, () => {
      const floor = realFloor(s, 'residual');
      floor.prepare(0, 2);
      const r = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
      const fl = floor as unknown as { groups: Array<{ def: { name?: string }; cv: { residual: number } | null }>; drawGroup(r: SoftRenderer, g: unknown, d: number): void };
      let worst = 0;
      let draws = 0;
      for (const g of fl.groups) {
        for (let x = -100; x < s.width; x += 2.5) {
          r.setCamera(x, 0);
          fl.drawGroup(r, g, 2);
          if (!g.cv) continue;
          draws++;
          worst = Math.max(worst, g.cv.residual);
          expect(g.cv.residual, `${g.def.name} at camX ${x}`).toBeLessThanOrEqual(1.5);
        }
      }
      expect(draws).toBeGreaterThan(100);
      expect(worst).toBeGreaterThan(0.5);
    }, 120_000);

    it.skipIf(!def.faces?.length && !def.overhangs?.length)(`${m}/${s.id}: a side wall's edges and a canopy's edges step evenly at res 4 and 8 (each step within about 1 backbuffer px of the even motion; no ½-px grid)`, () => {
      // The widest side wall of the section (a constant-u face) and its first canopy, each drawn alone.
      const cases: Array<{ what: string; floor: SectionFloor; draw: (f: SectionFloor, r: SoftRenderer, d: number) => void; camX: number }> = [];
      const probe = realFloor(s, 'edges-probe');
      const pg = probe as unknown as { groups: Array<{ def: FaceGroupDef; cols: Uint8Array; shown: Uint8Array; px: Float64Array }>; projectGroup(g: unknown, x: number, y: number): number[] | null };
      let pick: { g: FaceGroupDef; camX: number; w: number } | null = null;
      for (const g of pg.groups) {
        for (let x = 0; x <= s.width - VIEW_W; x += 16) {
          const box = pg.projectGroup(g, x, 0);
          if (!box) continue;
          for (let f = 0; f < g.def.faces.length; f++) {
            if (!g.cols[f] || !g.shown[f]) continue;
            const xs = [0, 1, 2, 3].map((c) => g.px[f * 4 + c]);
            const w = Math.max(...xs) - Math.min(...xs);
            if (Math.min(...xs) > 40 && Math.max(...xs) < VIEW_W - 40 && w > 6 && w < 30 && (!pick || w > pick.w)) pick = { g: g.def, camX: x, w };
          }
        }
      }
      if (pick) {
        const g = pick.g;
        cases.push({ what: `side wall ${g.name}`, floor: floorWithOnly(s, [g], [], 'edges-g'), camX: pick.camX, draw: (f, r, d) => (f as unknown as { drawGroup(r: SoftRenderer, g: unknown, d: number): void }).drawGroup(r, (f as unknown as { groups: unknown[] }).groups[0], d) });
      }
      const o = (def.overhangs ?? [])[0];
      if (o) cases.push({ what: `canopy ${o.kind} @${o.x0}`, floor: floorWithOnly(s, [], [o], 'edges-o'), camX: Math.max(0, (o.x0 + o.x1) / 2 - FLOOR_CX - 90), draw: (f, r, d) => (f as unknown as { drawQuads(r: SoftRenderer, d: number, o: boolean): void }).drawQuads(r, d, false) });
      expect(cases.length, 'a side wall or a canopy to check').toBeGreaterThan(0);
      for (const c of cases) {
        for (const k of [4, 8]) {
          const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
          const d = k % 4 === 0 ? 4 : 2;
          c.floor.prepare(c.camX, d);
          // 24 frames, the camera one backbuffer px a frame.
          const lefts: number[][] = [];
          const rights: number[][] = [];
          for (let t = 0; t < 24; t++) {
            r.begin(0x00000000);
            r.setCamera(c.camX + t / k, 0);
            c.draw(c.floor, r, d);
            const buf = r.target;
            let row = 0;
            for (let y = 0; y < buf.h; y += 3 * k) {
              const e = rowEdges(buf, y, 0, buf.w);
              (lefts[row] ??= []).push(e ? e[0] : NaN);
              (rights[row] ??= []).push(e ? e[1] : NaN);
              row++;
            }
          }
          let rowsSeen = 0;
          for (const series of [...lefts, ...rights]) {
            if (series.some((v) => !Number.isFinite(v))) continue;
            rowsSeen++;
            expect(worstStray(series), `${c.what} res ${k}`).toBeLessThanOrEqual(1.25);
          }
          expect(rowsSeen, `${c.what} res ${k}: rows seen`).toBeGreaterThan(4);
        }
      }
    }, 120_000);
  }
});

describe('every floor section: the ground mist moves with its floor rows (spec §2.1, §3.8)', () => {
  for (const [m, s] of floorSections()) {
    it(`${m}/${s.id}: each mist row moves s(y)·Δ within 1/res (no whole-px snapping), where the section has a mist`, async () => {
      const g = await createHeadlessGame({ missionId: m, sectionId: s.id, seed: 1, god: true, loadContent: false, res: 2 });
      try {
        g.step(2);
        const light = g.runner?.light ?? null;
        const floor = g.runner?.view.floor ?? null;
        if (!light || !floor || !sectionLight(s.id)?.fog) return;
        const k = 2;
        const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
        const shot = (x: number): Uint32Array => {
          r.begin(0x000000ff);
          r.setCamera(x, 0);
          light.drawGround(r, 0, 2);
          return r.target.data.slice();
        };
        const bw = VIEW_W * k;
        let checked = 0;
        for (const speed of [0.5, 1.5]) {
          let x = 600;
          let prev = shot(x);
          let prevCam = r.camX;
          for (let t = 1; t <= 3; t++) {
            x += speed;
            const cur = shot(x);
            const delta = r.camX - prevCam;
            for (let y = floor.cam.back + 2; y < 210; y += 3) {
              const j = Math.floor(y * k);
              const a = new Float64Array(bw);
              const b = new Float64Array(bw);
              let mean = 0;
              for (let i = 0; i < bw; i++) {
                a[i] = lum(prev[j * bw + i]);
                b[i] = lum(cur[j * bw + i]);
                mean += a[i];
              }
              mean /= bw;
              let vr = 0;
              for (let i = 0; i < bw; i++) vr += (a[i] - mean) ** 2;
              if (vr / bw < 0.5) continue;
              const want = -sOfY(floor.cam, (j + 0.5) / k) * delta * k;
              const err = Math.abs(rowShift(a, b, Math.ceil(Math.abs(want)) + 3) - want) / k;
              checked++;
              expect(err, `speed ${speed} y ${y}`).toBeLessThanOrEqual(1 / k);
            }
            prev = cur;
            prevCam = r.camX;
          }
        }
        expect(checked).toBeGreaterThan(20);
      } finally {
        g.dispose();
      }
    }, 60_000);
  }
});

describe('every floor section: a bot run (gate 5, contact shadows)', () => {
  for (const [m, s] of floorSections()) {
    it(`${m}/${s.id}: nothing drawn over the world covers a hero's head or gun; no shadow lies where nothing is drawn`, async () => {
      const g = await createHeadlessGame({ missionId: m, sectionId: s.id, seed: 1, god: true, bot: true, loadContent: false });
      const r = new SoftRenderer();
      const hits = new Set<string>();
      const phantoms = new Set<string>();
      let frames = 0;
      try {
        for (let t = 0; t < 9000; t++) {
          g.step(1);
          const run = g.runner;
          if (!run || run.section.id !== s.id) break;
          const floor = run.view.floor;
          if (!floor) break;
          if (t % 3) continue;
          frames++;
          for (const h of frontCoverHits(floor, run.world)) hits.add(h);
          // Every entity that gets a contact shadow draws something (a hidden zombie, a flown flock: no shadow).
          if (t % 9) continue;
          const w = run.world;
          for (const e of w.entities) {
            if (e.removed || e.dead || e.drawDepth !== 0 || !e.castsShadow) continue;
            if (!(e.tags.has('player') || e.tags.has('enemy') || e.tags.has('npc'))) continue;
            if (e.x < w.camera.viewX - 10 || e.x > w.camera.viewX + VIEW_W + 10) continue;
            const fy = w.terrain.surfaceY(e.x, e.y - 2, e.y + SHADOW_MAX_AIR);
            if (!Number.isFinite(fy) || fy - e.y < -2 || fy - e.y > SHADOW_MAX_AIR) continue;
            const p = e as unknown as { state?: string; invulnTicks?: number };
            // A blinking or mounted hero is there (its vehicle draws it): its shadow stays.
            if (e.tags.has('player') && (p.state === 'mounted' || (p.invulnTicks ?? 0) > 0)) continue;
            r.begin(0x00000000);
            r.setCamera(e.x - 192, e.y - 150);
            e.draw(r);
            if (r.target.countOpaque() === 0) phantoms.add(`${e.type}${(e as unknown as { hidden?: boolean }).hidden ? ' (hidden)' : ''}`);
          }
        }
      } finally {
        g.dispose();
      }
      expect(frames, 'frames of the bot run').toBeGreaterThan(300);
      expect([...hits]).toEqual([]);
      expect([...phantoms].filter((p) => !p.startsWith('stag-partier') && !p.startsWith('handhaver'))).toEqual([]);
    }, 120_000);
  }

  it('a hidden entity casts no shadow (Entity.castsShadow: render only)', () => {
    const sec = plain();
    sec.floor = debugFloorDef(sec, 'ams');
    const terrain = new Terrain(sec.terrain);
    const view = new SectionView(sec, terrain, 1, 1);
    class Hider extends Box {
      hide = false;
      override get castsShadow(): boolean {
        return !this.hide;
      }
    }
    const world = new World({ terrain, seed: 1 });
    const e = new Hider(world, 300, 170);
    e.addTag('enemy');
    world.add(e);
    world.flush();
    const shadow = (): number => {
      const r = new SoftRenderer();
      r.begin(0x00000000);
      r.setCamera(world.camera.viewX, world.camera.viewY);
      view.drawShadows(r, world);
      return r.target.countOpaque();
    };
    expect(shadow()).toBeGreaterThan(0);
    e.hide = true;
    expect(shadow()).toBe(0);
  });
});

describe('every floor section: THE MEMORY TEST (spec §3.2, §8 gate 7) at tier 4 in the browser\'s flow', () => {
  /**
   * The frames GL's program compiles in the background at a direct section start: `live` is already
   * true (the section prepares its 4× set), but `render` gives null, so the CPU raster draws those
   * frames at its cap (2×) and asks for 2× chunks and tiles after the 4× ones (gl-floor.browser.ts).
   */
  const COMPILE_FRAMES = 8;
  let frameNo = 0;
  /** A GPU that draws the band (as GL does: it asks the store for the visible chunks and the materials' tiles). */
  const gpu: FloorGpu = {
    cpuCap: 2,
    live: () => true,
    render(fr: FloorFrame) {
      if (frameNo < COMPILE_FRAMES) return null;
      const mesh = fr.mesh;
      for (let q = fr.q0; q < fr.q1; q++) {
        const mi = mesh.quadMat[q];
        if (mi < 0) fr.chunk(mesh.quadChunk[q]);
        else {
          fr.tile(fr.materials[mi].base.tile);
          const o = fr.materials[mi].over;
          if (o) fr.tile(o.tile);
        }
      }
      return {};
    },
  };
  for (const [m, s] of floorSections()) {
    it(`${m}/${s.id}: the floor's whole CPU memory (cpuBytes) stays ≤ 16 MB over a walk; the 4× store never caps; no canvas is made while drawing`, () => {
      const tier = artTier();
      const prevDefer = setDeferHiArt(true);
      const prevDense = setDeferDense(true);
      setArtTier(4);
      const floor = realFloor(s, 'memory');
      try {
        floor.gpu = gpu;
        frameNo = 0;
        floor.prepare(0, 4);
        const made = floor.pool.made;
        // A renderer that draws nothing (the memory is the floor's own).
        const soft = new SoftRenderer(undefined, undefined, undefined, { res: 8 });
        const r = { res: 8, subpixel: 'all', camX: 0, camY: 0, frame() {}, sprite() {}, surface() {}, line() {}, rect() {}, image() {}, parallax() {} } as unknown as Renderer & { camX: number };
        let peak = 0;
        for (let x = 0; x <= s.width - VIEW_W; x += 1.5) {
          soft.setCamera(x, 0);
          (r as { camX: number }).camX = soft.camX;
          floor.drawBand(r, 0, 4);
          floor.drawOpenings(r, 4);
          floor.drawBack(r, 0, 4);
          floor.drawFront(r, 0, 4);
          floor.maintain(soft.camX, 4);
          // The browser's per-frame job budget (8 ms) as a count: a few jobs a frame.
          for (let j = 0; j < 4 && pendingArtJobs() > 0; j++) runArtJobs(0);
          frameNo++;
          peak = Math.max(peak, floor.cpuBytes());
          expect(floor.store.capped, `capped at camX ${x}`).toBe(false);
        }
        expect(peak, `peak ${(peak / 1048576).toFixed(2)} MB`).toBeLessThanOrEqual(16 * 1024 * 1024);
        expect(peak).toBeGreaterThan(2 * 1024 * 1024);
        expect(floor.pool.made, 'canvases made on the frame path').toBe(made);
      } finally {
        floor.dispose();
        cancelArtJobs('sections-test/');
        setArtTier(tier);
        setDeferHiArt(prevDefer);
        setDeferDense(prevDense);
      }
    }, 120_000);
  }
});

describe('every floor section: the floor\'s frame path allocates nothing (Hard Rule 7; spec §2.6)', () => {
  for (const [m, s] of floorSections()) {
    it(`${m}/${s.id}: 600 frames of every floor pass (band, openings, decor, rows, faces, quads, shadows) sample no heap growth`, async () => {
      const { Session } = await import('node:inspector/promises');
      const floor = realFloor(s, 'alloc');
      floor.prepare(0, 2);
      // Everything built once and kept: the frames below only draw (no bake, no eviction).
      for (let k = -1; k * 256 < s.width + 256; k++) floor.store.chunk(k, 2);
      for (let i = 0; i < floor.tileIds.length; i++) floor.store.tile(i, 2);
      const soft = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
      // A renderer that draws nothing: what is measured is the floor's own code.
      const r = { res: 2, subpixel: 'all', camX: 0, camY: 0, frame() {}, sprite() {}, surface() {}, line() {}, rect() {}, image() {}, parallax() {} } as unknown as Renderer & { camX: number; camY: number };
      const world = new World({ terrain: new Terrain(s.terrain), seed: 1 });
      const pass = (x: number, t: number): void => {
        soft.setCamera(x, 0);
        r.camX = soft.camX;
        r.camY = soft.camY;
        floor.drawBand(r, t, 2);
        floor.drawOpenings(r, 2);
        floor.drawBack(r, t, 2);
        floor.drawShadows(r, world, 2);
        floor.drawFront(r, t, 2);
      };
      const W = s.width - VIEW_W;
      // Warm up (the JIT), then sample 600 frames.
      for (let rep = 0; rep < 6; rep++) for (let x = 0; x < W; x += 3.25) pass(x, rep * 5000 + Math.round(x));
      type N = { selfSize: number; callFrame: { url: string; functionName: string }; children: N[] };
      // The JIT compiles in the background: a busy machine may still run a pass unoptimised (which
      // boxes its doubles), so the best of three samples counts.
      let floorBytes = Infinity;
      let where: string[] = [];
      for (let attempt = 0; attempt < 3 && floorBytes / 600 >= 64; attempt++) {
        const ses = new Session();
        ses.connect();
        await ses.post('HeapProfiler.enable');
        await ses.post('HeapProfiler.startSampling', { samplingInterval: 1024 } as never);
        const step = W / 600;
        for (let i = 0; i < 600; i++) pass(i * step, 20000 + i);
        const { profile } = (await ses.post('HeapProfiler.stopSampling')) as unknown as { profile: { head: N } };
        ses.disconnect();
        let bytes = 0;
        const at: string[] = [];
        const walk = (n: N): void => {
          if (n.selfSize > 0 && /\/(floor|light)\//.test(n.callFrame.url)) {
            bytes += n.selfSize;
            at.push(`${n.callFrame.functionName} ${n.selfSize}`);
          }
          for (const c of n.children) walk(c);
        };
        walk(profile.head);
        if (bytes < floorBytes) {
          floorBytes = bytes;
          where = at;
        }
      }
      expect(floorBytes / 600, `bytes per frame in the floor's code: ${where.join(', ')}`).toBeLessThan(64);
      // ~10 s on a dev machine; the CI runner is about 6× slower (ams/a timed out at 60 s there).
    }, 180_000);
  }
});
