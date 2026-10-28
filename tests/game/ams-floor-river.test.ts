/**
 * The river sections' floors (docs/design/floor.md §12.2 c1 and c2; AMS-RIVER, wave B): `ams` c1 BRUG
 * (the white bridge over the Amstel, the quay, the Blauwbrug, Waterlooplein) and c2 RONDVAART (the
 * cruise on the Amstel, the bridges spanning it, the quays).
 *
 * - Both floors are on and enrolled (every generic floor test runs them).
 * - THE PAN TEST and THE STILL TEST on their real floors (spec §2.7). Neither section has flat land a
 *   view wide (the river is a gap of the ground; the Blauwbrug a hump), so the generic test finds no
 *   rows: here the rows are those of a LEVEL surface across the view — the white bridge's deck (24 over
 *   the walk plane) and the river in front of it in c1, the river (−4) in c2 along the cruise boat's
 *   real camera path (1/8-px steps, accelerating, braking) — and each moves (y − yh)/(yw − yh − h)·Δ.
 * - c1: the deck is a level strip over the river at the walk line, its near face's foot above the tour
 *   boats' waterline (they sail in front of it, flat: no faces); the ramp and the railings; the
 *   street logic (the bulb, the Blauwbrug's railings off the roadway); the railing sprite's geometry at
 *   every density; the front railing low (legs only).
 * - c2: the bridges reach the far bank (the depth that scrolls with the bank layer), their bodies above
 *   the boat's passage (they never hide the boat or its riders); the far portals and arches sit on the
 *   true walkway there; the fairway is kept free (the piles stand behind it); Carré rides up with its
 *   layer.
 */
import { describe, expect, it } from 'vitest';
import { FLOOR_CX, sAtDepth } from '../../src/engine/floor/cam';
import { heightAt, meshHeightAt } from '../../src/engine/floor/mesh';
import type { PixelBuffer } from '../../src/engine/pixel';
import { VIEW_W } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { getFrames, hasHiSprite } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { loadContent } from '../../src/game/content/index';
import { roadwayAt, vAtAms, WATER_LEVEL } from '../../src/game/content/missions/ams/floor/index';
import { AMS_WAVE_B } from '../../src/game/content/missions/ams/floor/sections';
import {
  C1_BLAUWBRUG,
  C1_BULB,
  C1_DECK_FAR,
  C1_DECK_H,
  C1_DECK_NEAR,
  C1_LAYOUT,
  C1_RAMP,
  ensureWhiteRail,
  WHITE_RAIL_H,
} from '../../src/game/content/missions/ams/floor/c1/index';
import { C2_BRIDGE_BACK, C2_FAIRWAY_FAR, C2_LAYOUT, C2_PILE_DEPTH, C2_PILES, c2LowBridgeFaces } from '../../src/game/content/missions/ams/floor/c2/index';
import { C2_BRIDGE_HALF, C2_PIER_FRONT } from '../../src/game/content/missions/ams/floor/c2/bridges';
import { C2_BANK_FACTOR } from '../../src/game/content/missions/ams/section-c2';
import { C_AMSTEL, C2_RIVER } from '../../src/game/content/missions/ams/terrain';
import { bindWorldFloor, floorOf } from '../../src/game/mission/floor/index';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import type { FloorDef } from '../../src/game/mission/floor/types';
import type { DecorDef, SectionDef } from '../../src/game/mission/types';
import { gameEntityFactory, getMission } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

await loadContent();
const ams = getMission('ams');
const c1 = ams?.sections.c1 as SectionDef;
const c2 = ams?.sections.c2 as SectionDef;
const G = 176;

function floorFor(s: SectionDef, key: string): SectionFloor {
  return new SectionFloor(s, floorOf(s) as FloorDef, new Terrain(s.terrain), 1, `river-test/${key}/`);
}

function lum(c: number): number {
  return ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
}

/** The sub-pixel shift k (output px) that best maps row A onto row B: B[x] ≈ A[x − k] (floor-sections.test.ts). */
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

/** The scale of screen row y on a level surface h over the walk plane (s = (y − yh)/(yw − yh − h)). */
function sLevel(floor: SectionFloor, y: number, h: number): number {
  const c = floor.cam;
  return (y - c.yh) / (c.yw - c.yh - h);
}

/**
 * Band rows (index j at res k) inside [y0, y1] whose floor is the level surface h across the view at
 * camX (and ±2.5 px around the row): there every texel moves at sLevel(y)·Δ.
 */
function levelRows(floor: SectionFloor, camX: number, k: number, h: number, y0: number, y1: number): number[] {
  const c = floor.cam;
  const out: number[] = [];
  for (let j = 0; j < floor.bandH * k; j++) {
    const y = floor.bandTop + (j + 0.5) / k;
    if (y < y0 || y > y1) continue;
    let level = true;
    for (const dy of [-2.5, 0, 2.5]) {
      const s = sLevel(floor, y + dy, h);
      const v = c.f * (1 - 1 / s);
      const half = (FLOOR_CX + 4) / s;
      for (let u = camX + FLOOR_CX - half; u <= camX + FLOOR_CX + half && level; u += 4) if (Math.abs(heightAt(floor.field, u, v) - h) > 1e-6) level = false;
      if (!level) break;
    }
    if (level) out.push(j);
  }
  return out;
}

/** Pan the band along camera xs (res k, tick 0): every level row's shift vs sLevel·Δ; returns [rows checked, worst error]. */
function panLevel(floor: SectionFloor, xs: readonly number[], k: number, bands: readonly (readonly [number, number, number])[]): [number, number] {
  const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
  const bw = VIEW_W * k;
  let checked = 0;
  let worst = 0;
  let prev: Uint32Array | null = null;
  let prevCam = 0;
  for (const x of xs) {
    r.setCamera(x, 0);
    floor.drawBand(r, 0, k);
    const cur = (floor.raster.band as PixelBuffer).data.slice();
    if (prev && r.camX !== prevCam) {
      const delta = r.camX - prevCam;
      for (const [h, y0, y1] of bands) {
        for (const j of levelRows(floor, r.camX, k, h, y0, y1)) {
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
          expect(err, `res ${k} camX ${x} h ${h} row y ${y.toFixed(2)} Δ ${delta}`).toBeLessThanOrEqual(1 / k);
        }
      }
    }
    prev = cur;
    prevCam = r.camX;
  }
  return [checked, worst];
}

/** The still test: the same camera and tick twice draw the same band. */
function still(floor: SectionFloor, camX: number, k: number): boolean {
  const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
  r.setCamera(camX, 0);
  floor.drawBand(r, 7, k);
  const a = (floor.raster.band as PixelBuffer).data.slice();
  floor.drawBand(r, 7, k);
  return Buffer.from((floor.raster.band as PixelBuffer).data.buffer).equals(Buffer.from(a.buffer));
}

describe('the river sections have their floors (wave B, AMS-RIVER)', () => {
  it('c1 and c2 are switched on and draw a floor (every generic floor test enrols them)', () => {
    for (const id of ['c1', 'c2']) expect(AMS_WAVE_B.find((s) => s.id === id)?.on, id).toBe(true);
    expect(floorOf(c1)).toBeTruthy();
    expect(floorOf(c2)).toBeTruthy();
  });
});

describe('smooth (spec §2.7) on the level surfaces of the river sections', () => {
  it('c1: over the white bridge the deck rows (h 24) and the river in front (h −4) move s·Δ within 1/res at 0.5 and 2 px/tick; a still camera draws the same band', () => {
    const floor = floorFor(c1, 'pan-c1');
    for (const k of [1, 2]) {
      let checked = 0;
      for (const speed of [0.5, 2]) {
        const xs = Array.from({ length: 6 }, (_, i) => 180 + i * speed);
        const [n] = panLevel(floor, xs, k, [
          [C1_DECK_H, 139, 152],
          [WATER_LEVEL, 184, 214],
        ]);
        checked += n;
      }
      expect(checked, `res ${k}: rows checked`).toBeGreaterThan(40);
      expect(still(floor, 183.25, k)).toBe(true);
    }
  }, 120_000);

  it('c2: along the cruise boat\'s real camera path (1/8-px steps, accelerating, braking) every river row moves s·Δ within 1/res; a still camera draws the same band', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'c2', seed: 1, god: true, bot: { route: 'lower' }, loadContent: false });
    const path: number[] = [];
    try {
      for (let t = 0; t < 1500; t++) {
        g.step(1);
        const c = g.runner?.world.camera;
        if (c) path.push(c.viewX);
      }
    } finally {
      g.dispose();
    }
    const steps = path.slice(1).map((x, i) => x - path[i]);
    expect(Math.max(...steps)).toBeCloseTo(0.625, 6);
    expect(steps.some((d, i) => d === 0 && i > 0 && steps[i - 1] > 0)).toBe(true);
    const floor = floorFor(c2, 'pan-c2');
    // Every 4th tick of the path (and so its accelerating and braking steps), on the river rows.
    const xs = path.filter((_, i) => i % 4 === 0 && path[i] > C2_RIVER[0] + 20);
    for (const k of [1, 2]) {
      const [checked] = panLevel(floor, xs.slice(0, 160), k, [[WATER_LEVEL, 150, 214]]);
      expect(checked, `res ${k}: rows checked`).toBeGreaterThan(40);
      expect(still(floor, 640.375, k)).toBe(true);
    }
  }, 240_000);
});

describe('c1 BRUG: the white bridge, the quay, the Blauwbrug, Waterlooplein', () => {
  const floor = floorFor(c1, 'c1');

  it('the white bridge\'s deck is a level strip around the walk line over the river (24 over the walk plane), water in front of and behind it', () => {
    const vFar = vAtAms(C1_DECK_FAR);
    const vNear = vAtAms(C1_DECK_NEAR);
    expect(vFar).toBeLessThan(0);
    expect(vNear).toBeGreaterThan(0);
    for (let u = C_AMSTEL[0] + 1; u < C1_RAMP[0]; u += 7) {
      expect(meshHeightAt(floor.mesh, u, 0), `deck at ${u}`).toBeCloseTo(C1_DECK_H, 6);
      expect(meshHeightAt(floor.mesh, u, vNear + 3)).toBeCloseTo(WATER_LEVEL, 6);
      expect(meshHeightAt(floor.mesh, u, vFar - 3)).toBeCloseTo(WATER_LEVEL, 6);
    }
    // The ramp's span is the river in the field (the ramp is a face group: a level cannot slope).
    expect(meshHeightAt(floor.mesh, (C1_RAMP[0] + C1_RAMP[1]) / 2, 0)).toBeCloseTo(WATER_LEVEL, 6);
    expect((floorOf(c1) as FloorDef).faces?.some((g) => g.name === 'c1 white bridge ramp')).toBe(true);
  });

  it('the deck\'s near face meets the water above the tour boats\' waterline (y 182): the boats sail in front of it, and stay flat', () => {
    const c = floor.cam;
    const s = sAtDepth(c, C1_DECK_NEAR);
    const foot = c.yh + (c.yw - c.yh - WATER_LEVEL) * s;
    const edge = c.yh + (c.yw - c.yh - C1_DECK_H) * s;
    expect(foot).toBeLessThanOrEqual(182);
    // The heroes' feet (the platform at y 152) stand on the deck, in front of its near edge.
    expect(edge).toBeGreaterThan(152);
    expect(Object.keys((floorOf(c1) as FloorDef).entityFaces ?? {})).not.toContain('ams-tour-boat');
  });

  it('the white railing: one design at every density (the same logical box), low enough for the front (legs only); the ramp piece slopes', () => {
    const flat = ensureWhiteRail(128);
    const f1 = getFrames(flat, 1)[0];
    expect(hasHiSprite(flat, 2) && hasHiSprite(flat, 4)).toBe(true);
    expect(WHITE_RAIL_H).toBeLessThanOrEqual(10.5);
    expect(f1.oy).toBeLessThanOrEqual(13);
    const ramp = getFrames(ensureWhiteRail(160, 100, C1_DECK_H - 4), 1)[0];
    expect(ramp.buf.h - f1.buf.h).toBeGreaterThanOrEqual(C1_DECK_H - 4);
    // The section's front railing pieces are front decor on the deck (its line, y 152).
    const front = (c1.decor ?? []).filter((d) => d.sprite.startsWith('decor/ams/c1-white-rail') && d.front);
    expect(front.length).toBe(6);
    for (const d of front) expect(d.y).toBe(G - C1_DECK_H);
  });

  it('street logic: the lamp with the sleeping gull, the bomb crate and the pigeons stand on the bulb; the lane swerves in front of it', () => {
    for (const u of [920, 940, 960]) {
      const r = roadwayAt(C1_LAYOUT, u, vAtAms);
      expect(r, `${u}`).not.toBeNull();
      // The roadway starts in front of the walk line there (the walk plane is pavement).
      expect((r as readonly [number, number])[0], `${u}`).toBeGreaterThan(3);
    }
    expect(C1_BULB.u0).toBeLessThan(900);
    expect(C1_BULB.u3).toBeGreaterThan(965);
    // Lamp 920 stays in the walk plane (its perched gull is hittable: §3.7).
    const lamp = (c1.decor ?? []).find((d) => d.sprite === 'decor/ams/lamp' && d.x === 920) as DecorDef;
    expect(floor.def.decorDepth?.(lamp, 0) ?? lamp.depth ?? 0).toBe(0);
  });

  it('the Blauwbrug: a hump in cobbles over a canal running in depth; its railings stand off the cobbled roadway, its lamps on the far parapet', () => {
    const b = C1_BLAUWBRUG;
    const mid = b.x0 + b.len / 2;
    expect(meshHeightAt(floor.mesh, mid, 0)).toBeCloseTo(b.h, 1);
    expect(meshHeightAt(floor.mesh, mid, vAtAms(b.far) - 6)).toBeCloseTo(WATER_LEVEL, 6);
    expect(meshHeightAt(floor.mesh, mid, vAtAms(b.near) + 6)).toBeCloseTo(WATER_LEVEL, 6);
    const road = roadwayAt(C1_LAYOUT, mid, vAtAms) as readonly [number, number];
    expect(vAtAms(b.far)).toBeLessThan(road[0] - 3);
    expect(vAtAms(b.near)).toBeGreaterThan(road[1] + 3);
    const lamps = floor.rows.find((r) => r.def.name === 'Blauwbrug lamps');
    expect(lamps?.depth).toBeGreaterThan(b.far);
  });
});

describe('c2 RONDVAART: the river, its bridges and its quays', () => {
  const floor = floorFor(c2, 'c2');

  it('the bridges reach the far bank: the depth whose speed is the bank layer\'s', () => {
    expect(sAtDepth(floor.cam, C2_BRIDGE_BACK)).toBeCloseTo(C2_BANK_FACTOR, 9);
    const def = floorOf(c2) as FloorDef;
    let deepest = 0;
    for (const f of def.entityFaces?.['ams-low-bridge']?.states[0] ?? []) for (const p of f.pts) deepest = Math.max(deepest, p[2]);
    expect(deepest).toBeCloseTo(C2_BRIDGE_BACK, 9);
    for (const f of def.entityFaces?.['ams-magere-brug']?.states[0] ?? []) for (const p of f.pts) deepest = Math.max(deepest, p[2]);
    expect(deepest).toBeCloseTo(C2_BRIDGE_BACK, 9);
  });

  it('the far arches and portals stand on the true walkway at the far bank (decor at a depth is drawn at y − depth); the near portals stand over the walkway receding behind them', () => {
    const c = floor.cam;
    const s = sAtDepth(c, C2_BRIDGE_BACK);
    const far = (c2.decor ?? []).filter((d) => d.depth === C2_BRIDGE_BACK);
    expect(far.length).toBe(3);
    for (const d of far) {
      const walk = c.yh + (c.yw - c.yh - (G - 112)) * s;
      expect(d.y - C2_BRIDGE_BACK, d.sprite).toBeCloseTo(walk, 6);
    }
    // The near portals: split at the walkway's line, their tops over the receding walkway (front), their feet behind the world.
    const near = (c2.decor ?? []).filter((d) => d.sprite.startsWith('decor/ams/c2-magere-portals-') && d.depth === 0);
    expect(near.map((d) => [d.sprite.slice(-4), d.front === true, d.y])).toEqual([
      ['foot', false, 112],
      ['-top', true, 112],
    ]);
    const orig = (c2.decor ?? []).find((d) => d.sprite === 'decor/ams/magere-brug/back') as DecorDef;
    expect(floor.def.decorDepth?.(orig, 0)).toBeNull();
    const [top, foot] = [getFrames(near[1].sprite, 1)[0], getFrames(near[0].sprite, 1)[0]];
    expect(top.oy + (foot.buf.h - foot.oy)).toBe(getFrames('decor/ams/magere-brug/back', 1)[0].buf.h);
  });

  it('the fairway is kept free: the piles stand behind it, on the water; Carré rides up with the far bank\'s layer', () => {
    const vFair = vAtAms(C2_FAIRWAY_FAR);
    for (const u of [C2_RIVER[0] + 10, 1000, C2_RIVER[1] - 10]) {
      const r = roadwayAt(C2_LAYOUT, u, vAtAms) as readonly [number, number];
      expect(r[0]).toBeCloseTo(vFair, 6);
    }
    expect(C2_PILES.length).toBeGreaterThan(20);
    expect(vAtAms(C2_PILE_DEPTH)).toBeLessThan(vFair - 10);
    const piles = floor.rows.find((r) => r.def.name === 'mooring piles');
    for (const h of piles?.h ?? []) expect(h).toBeCloseTo(WATER_LEVEL, 6);
    const carre = (c2.decor ?? []).find((d) => d.sprite === 'decor/ams/carre') as DecorDef;
    expect(floor.def.decorDepth?.(carre, 0)).toBe(G - floor.cam.back);
  });

  it('a low bridge\'s deck spans back over the river above the boat\'s passage, on piers just behind the fairway (drawn under every entity: they never hide the boat or its riders)', () => {
    const fl = floorFor(c2, 'low-bridge');
    const w = new World({ terrain: new Terrain(c2.terrain), seed: 1, factory: gameEntityFactory });
    bindWorldFloor(w, fl);
    w.spawn('ams-low-bridge', 700, 112, {});
    w.flush();
    for (const camX of [380, 470, 508, 560, 640]) {
      const r = new SoftRenderer();
      r.begin(0);
      r.setCamera(camX, 0);
      fl.drawBand(r, 0, 1);
      r.begin(0);
      fl.drawBack(r, 0, 1);
      r.begin(0);
      fl.drawShadows(r, w, 1);
      r.end();
      const b = r.target;
      let above = 0;
      let below = 0;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if ((b.data[y * b.w + x] & 255) > 0) (y < 128 ? above++ : below++);
      expect(above, `camX ${camX}`).toBeGreaterThan(200);
      // The piers and the dark of the arch under the deck (the boat passes in front of them).
      expect(below, `camX ${camX}`).toBeGreaterThan(50);
    }
    // Everything under the deck's underside stands behind the fairway (the boat's beam): the piers' fronts at C2_PIER_FRONT.
    const under = -(127 - 112);
    const faces = c2LowBridgeFaces().states[0];
    let low = 0;
    for (const f of faces) {
      for (const q of f.pts) {
        const h = q.length === 4 ? q[1] - (176 - 112) : q[1];
        if (h >= under - 1e-6) continue;
        low++;
        expect(q[2], 'a corner under the deck').toBeGreaterThanOrEqual(C2_PIER_FRONT);
      }
    }
    expect(low).toBeGreaterThan(8);
    expect(C2_PIER_FRONT).toBeGreaterThan(C2_FAIRWAY_FAR + 1);
    // The river lies in the deck's shade under each low bridge (a cut over its footprint, from the walk line back).
    const shades = (c2.floor?.features ?? []).filter((f) => f.kind === 'cut' && f.to === 0 && f.u0 !== undefined && f.u1 !== undefined && f.u1 - f.u0 === 2 * C2_BRIDGE_HALF);
    expect(shades.map((f) => ((f.u0 as number) + (f.u1 as number)) / 2)).toEqual([700, 1660]);
  });
});
