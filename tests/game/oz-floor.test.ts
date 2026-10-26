/**
 * The Oldenzaal floor kit and oz-a's floor (docs/design/floor.md §5.1, §2, §3.5–§3.8):
 * - the town painter: pure, in texture space, each band of the street in its own materials;
 *   nothing reads as blood (the cracks and frames add no red; the lamp pools are amber);
 * - the post prop keeps the front-row rules; the tiles are opaque; the awning stripes start at
 *   the awning's edge (as the sprite's);
 * - the decor depths (the fronts, the lamps, the walk plane; items below the walk line keep their
 *   screen spot; the old front bollards are hidden);
 * - the rows keep clear of every spawn spot and of the boarded openings;
 * - THE PAN TEST and THE STILL TEST on oz-a's real floor (the method of floor-raster.test.ts);
 * - the light pass on the floor (glows at their lamps' depth, pools, the mist) and the old pass
 *   without a floor (oz-b);
 * - the depth steps: the boarded openings in their fronts; the dead who burst out drawn in the walk
 *   plane with their hitbox; only the burst's fx (the tell's dust, the planks) drawn at the front's
 *   depth, spawned where they would be without a floor (the same fx with and without it); nothing at
 *   a depth without a floor.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { FLOOR_YW, sAtDepth, sOfY, vAtDepth } from '../../src/engine/floor/cam';
import { frameW } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { Terrain } from '../../src/engine/terrain';
import { loadContent } from '../../src/game/content/index';
import { OZ_A_DECOR, OZ_A_LAMP_LIGHTS } from '../../src/game/content/missions/oldenzaal/art-layout';
import {
  AWNING_PAIRS,
  moodTones,
  moodTonesOf,
  OZ_A_DEPTHS,
  OZ_A_FLOOR as OZ_A_FLOOR_BUILT,
  OZ_A_KEEP_CLEAR,
  OZ_A_MANHOLES,
  OZ_A_STREET,
  OZ_FLOOR_IDS,
  ozAwningTile,
  ozDecorDepth,
  ozFloorDecor,
  postFrame,
  STREET_GRIME,
} from '../../src/game/content/missions/oldenzaal/floor/index';
import { OZ_ZOMBIE_TAG } from '../../src/game/content/missions/oldenzaal/ids';
import { OZ_A_LIGHT, sectionOzA } from '../../src/game/content/missions/oldenzaal/section-oz-a';
import { G, OZ_A_OPENINGS, OZ_A_RISE } from '../../src/game/content/missions/oldenzaal/terrain';
import { OzBoarded, ruinSpotX } from '../../src/game/content/oldenzaal/ruin/index';
import { floorShift, worldFloor } from '../../src/game/mission/floor/hooks';
import { getFloorPainter, getFloorTile, listFloorTiles, setFloorOverride } from '../../src/game/mission/floor/registry';
import type { FloorDef } from '../../src/game/mission/floor/types';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import { createHeadlessGame } from '../../src/sim/index';

beforeAll(async () => {
  await loadContent();
});

/** The kit is fail soft (none when it throws while it builds); here it must have built. */
const OZ_A_FLOOR = OZ_A_FLOOR_BUILT as FloorDef;

function floorOzA(): SectionFloor {
  return new SectionFloor(sectionOzA, OZ_A_FLOOR, new Terrain(sectionOzA.terrain), 1, 'oz-floor-test/');
}

/** The texel function of oz-a's painter at density d. */
function texels(floor: SectionFloor, d: number): (u: number, v: number) => number {
  const ref = OZ_A_FLOOR.painter;
  return getFloorPainter(ref.id)({
    d,
    params: ref.params ?? {},
    seed: ref.seed ?? 0,
    cam: floor.cam,
    heightAt: (u, v) => floor.heightAt(u, v),
    featureAt: () => -1,
    vAt: (depth) => floor.vAt(depth),
    depthAt: () => 0,
  });
}

/** Redness of a packed colour: red over the larger of green and blue. */
function redness(c: number): number {
  const r = c >>> 24;
  const g = (c >>> 16) & 255;
  const b = (c >>> 8) & 255;
  return r - Math.max(g, b);
}

describe('oz-a: the town painter', () => {
  it('is the floor of oz-a: the camera of spec §1.1 (yh 56, f 200, the fronts 14 px behind the feet)', () => {
    expect(OZ_A_FLOOR_BUILT).toBeDefined();
    expect(sectionOzA.floor).toBe(OZ_A_FLOOR);
    expect(OZ_A_FLOOR.camera).toEqual({ yh: 56, f: 200, back: 162 });
    expect(FLOOR_YW - OZ_A_FLOOR.camera.back).toBe(OZ_A_STREET.facade);
    expect(OZ_A_FLOOR.shadow).toBe(0.35);
  });

  it('is pure in (u, v): the same texel for the same point, in any order, from any instance', () => {
    const floor = floorOzA();
    for (const d of [1, 2, 4]) {
      const a = texels(floor, d);
      const b = texels(floor, d);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 400; i++) pts.push([300 + i * 7.37, -26 + ((i * 13.1) % 60)]);
      const first = pts.map(([u, v]) => a(u, v));
      const again = [...pts].reverse().map(([u, v]) => b(u, v)).reverse();
      expect(again).toEqual(first);
    }
  });

  it('paints every band of the street in its own materials (sandstone · kerb · slate gutter · brick street · the posts\' strip)', () => {
    const floor = floorOzA();
    const S = OZ_A_STREET;
    for (const d of [1, 2]) {
      const t = texels(floor, d);
      const D = d as 1 | 2;
      const sets = {
        stoep: new Set([...moodTones('sandstone', 'dusk', D), ...moodTones('moss', 'dusk', D)]),
        kerb: new Set(moodTones('sandstone', 'dusk', D)),
        strip: new Set([...moodTones('sandstone', 'dusk', D), ...moodTones('sand', 'dusk', D)]),
        gutter: new Set([...moodTones('slate', 'dusk', D), ...moodTones('black', 'dusk', D)]),
        street: new Set([
          ...(['brick', 'brickDark', 'sand', 'moss', 'black', 'stone'] as const).flatMap((n) => moodTones(n, 'dusk', D)),
          ...moodTonesOf('oz-grime', STREET_GRIME(), 'dusk', D),
        ]),
      };
      const bands: Array<[keyof typeof sets, number, number]> = [
        ['stoep', S.facade - 0.5, S.kerbBack + 0.3],
        ['kerb', S.kerbBack - 0.3, S.kerbFront + 0.3],
        ['gutter', S.kerbFront - 0.3, S.gutterFront + 0.3],
        ['street', S.gutterFront - 0.5, S.stripFar + 0.3],
        ['strip', S.stripFar - 0.3, S.stripNear + 0.3],
        ['street', S.stripNear - 0.3, -30],
      ];
      for (const [name, far, near] of bands) {
        for (let k = 0; k <= 8; k++) {
          const v = floor.vAt(far + ((near - far) * k) / 8);
          for (let u = 0; u < 3072; u += 13.3) expect(sets[name].has(t(u, v)), `${name} d ${d} at u ${u} v ${v.toFixed(2)}`).toBe(true);
        }
      }
    }
  });

  it('nothing reads as blood: no dark red anywhere on the street; wear, cracks and frames add no red; the lamp pools are amber', () => {
    const floor = floorOzA();
    for (const d of [1, 2, 4]) {
      const td = texels(floor, d);
      // Dark texels (wear, damage, joints, the deepest bricks) are never a dark red.
      for (let u = 0; u < 3072; u += 1.7) {
        for (let v = floor.vAt(OZ_A_STREET.gutterFront); v < 40; v += 0.9) {
          const c = td(u, v);
          const lum = ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
          if (lum < 50) expect(redness(c), `d ${d} u ${u} v ${v.toFixed(1)}`).toBeLessThan(30);
        }
      }
    }
    const t = texels(floor, 2);
    // The plain street's reddest brick (away from every decal).
    let plain = 0;
    for (let u = 3000; u < 3060; u += 0.5) for (let v = -4; v < 20; v += 0.5) plain = Math.max(plain, redness(t(u, v)));
    for (const x of [...OZ_A_RISE, ...OZ_A_MANHOLES]) {
      for (let u = x - 12; u <= x + 12; u += 0.25) for (let v = -9; v <= 9; v += 0.25) expect(redness(t(u, v)), `decal at ${x}`).toBeLessThanOrEqual(plain);
    }
    for (const l of OZ_A_LAMP_LIGHTS) {
      const r = l.color >>> 24;
      const g = (l.color >>> 16) & 255;
      expect(g / r, 'a lamp pool is amber, never red').toBeGreaterThan(0.55);
    }
  });

  it('nothing reads as blood under the dusk: every oz floor tile, face tile and the whole painted band, at every light level', () => {
    // The light pass lays the section's tint over the frame at alpha darkness · (1 − light): every
    // texel is seen anywhere between its own colour (a lamp) and that mix (the dark). None of them
    // may become a dark wine red (the street's rule: lum < 50 with redness ≥ 30).
    const tint = OZ_A_LIGHT.tint >>> 0;
    const dark = OZ_A_LIGHT.darkness;
    const steps = [0, 0.25, 0.5, 0.75, 1].map((k) => k * dark);
    const wine = (c: number): number => {
      for (const a of steps) {
        const r = Math.round((c >>> 24) * (1 - a) + (tint >>> 24) * a);
        const g = Math.round(((c >>> 16) & 255) * (1 - a) + ((tint >>> 16) & 255) * a);
        const b = Math.round(((c >>> 8) & 255) * (1 - a) + ((tint >>> 8) & 255) * a);
        if ((r * 3 + g * 6 + b) / 10 < 50 && r - Math.max(g, b) >= 30) return a;
      }
      return -1;
    };
    const tiles = listFloorTiles().filter((id) => id.startsWith('oz/'));
    // The kit's tiles and oz-a's face tiles (the side walls, roofs, ends) are all registered.
    expect(tiles.length).toBeGreaterThan(30);
    expect(tiles.some((id) => id.includes('/side-wall/'))).toBe(true);
    for (const id of tiles) {
      const tile = getFloorTile(id);
      if (!tile) continue;
      for (const d of [1, 2, 4]) {
        for (let a = 0.125; a < tile.w; a += 0.5 / d) {
          for (let b = 0.125; b < tile.h; b += 0.5 / d) {
            const c = tile.paint(a, b, d);
            const at = wine(c);
            if (at >= 0) expect.fail(`${id} d ${d} (${a}, ${b}): ${(c >>> 0).toString(16)} reads as dark wine at darkness ${at}`);
          }
        }
      }
    }
    const floor = floorOzA();
    for (const d of [1, 2, 4]) {
      const td = texels(floor, d);
      for (let u = 0; u < 3072; u += 1.3) {
        for (let v = floor.cam.vBack; v < 40; v += 0.7) {
          const c = td(u, v);
          if (wine(c) >= 0) expect.fail(`painter d ${d} u ${u} v ${v.toFixed(1)}: ${(c >>> 0).toString(16)} reads as dark wine`);
        }
      }
    }
  });

  it('paints the manholes\' cast frames where the floor\'s flat openings lie (16 px covers, ellipses)', () => {
    expect(OZ_A_MANHOLES).toEqual(OZ_A_OPENINGS.filter((o) => o.kind === 'manhole').map((o) => o.x));
    const ops = OZ_A_FLOOR.openings ?? [];
    expect(ops.length).toBe(OZ_A_MANHOLES.length);
    const floor = floorOzA();
    for (const op of ops) {
      expect(op.ellipse).toBe(true);
      expect(op.x1 - op.x0).toBe(16);
      expect(floor.vAt(op.from)).toBeCloseTo(-8, 6);
      expect(floor.vAt(op.to)).toBeCloseTo(8, 6);
      // The whole cover lies in the street (in front of the gutter).
      expect(op.from).toBeLessThan(OZ_A_STREET.gutterFront);
    }
  });
});

describe('oz-a: tiles and the iron post', () => {
  it('the tiles are opaque at every density', () => {
    const ids = [
      OZ_FLOOR_IDS.kerbFace('dusk'),
      OZ_FLOOR_IDS.slab('dusk'),
      OZ_FLOOR_IDS.bayRoof('dusk'),
      OZ_FLOOR_IDS.wallTop('dusk'),
      OZ_FLOOR_IDS.car('dusk', 0),
      OZ_FLOOR_IDS.car('dusk', 1),
      OZ_FLOOR_IDS.car('dusk', 2),
      OZ_FLOOR_IDS.carGlass('dusk'),
      OZ_FLOOR_IDS.manhole('dusk'),
      OZ_FLOOR_IDS.manholeShaft('dusk'),
      ozAwningTile('dusk', 1, 490),
    ];
    for (const id of ids) {
      const tile = getFloorTile(id);
      expect(tile, id).not.toBeNull();
      if (!tile) continue;
      expect(tile.h % 4).toBe(0);
      for (const d of [1, 2, 4]) for (let a = 0.25; a < tile.w; a += 1.5) for (let b = 0.25; b < tile.h; b += 1.5) expect(tile.paint(a, b, d) & 255, `${id} d ${d}`).toBe(255);
    }
  });

  it('an awning\'s canvas stripes start at its left edge, 6 px wide, in its colour pair (the sprite\'s)', () => {
    for (const x0 of [140, 490, 954, 1260]) {
      const tile = getFloorTile(ozAwningTile('dusk', 0, x0));
      if (!tile) throw new Error('no awning tile');
      // Same b, the two sides of a stripe edge differ; inside a stripe the base tone is the same.
      const at = (u: number): number => tile.paint(u, 8.2, 2);
      expect(at(x0 + 5.75)).not.toBe(at(x0 + 6.25));
      expect(at(x0 + 11.75)).not.toBe(at(x0 + 12.25));
    }
    expect(AWNING_PAIRS.length).toBe(3);
  });

  it('the post keeps the front-row rules at the front row\'s scale (≤ 8 px wide, its top below G − 14) and has its chain point', () => {
    const k = sAtDepth({ yh: OZ_A_FLOOR.camera.yh, yw: FLOOR_YW }, OZ_A_STREET.frontRow) * 1.15;
    for (const d of [1, 2, 4]) {
      const f = postFrame('dusk', k, d);
      expect(frameW(f)).toBeLessThanOrEqual(8);
      expect(FLOOR_YW - OZ_A_STREET.frontRow - f.oy).toBeGreaterThanOrEqual(FLOOR_YW - 14);
      const p = f.pts?.chain;
      expect(p).toBeDefined();
      if (!p) continue;
      expect(-p[1]).toBeGreaterThan(f.oy * 0.5);
      expect(-p[1]).toBeLessThan(f.oy);
      // Every density has the 1× frame's logical size and anchor.
      const one = postFrame('dusk', k, 1);
      expect(frameW(f)).toBe(frameW(one));
      expect(f.oy).toBe(one.oy);
    }
  });
});

describe('oz-a: decor depths and rows', () => {
  const list = ozFloorDecor(OZ_A_DECOR, OZ_A_DEPTHS);

  it('keeps every item (sprite, frame, x, order) and gives each its depth', () => {
    expect(list.length).toBe(OZ_A_DECOR.length);
    list.forEach((d, i) => {
      const o = OZ_A_DECOR[i];
      expect([d.sprite, d.frame, d.x, d.front]).toEqual([o.sprite, o.frame, o.x, o.front]);
      expect(d.depth, d.sprite).not.toBeUndefined();
    });
    expect(sectionOzA.decor).toEqual(list);
  });

  it('the fronts at 14, the lamps by the kerb, the platforms\' art and the cars in the walk plane (unchanged)', () => {
    list.forEach((d, i) => {
      const o = OZ_A_DECOR[i];
      if (d.sprite === 'decor/oz/shop' || d.sprite === 'decor/oz-ruin/banner' || d.sprite === 'decor/oz/flag') expect(d.depth).toBe(14);
      if (d.sprite === 'decor/oz/lamp' || d.sprite === 'decor/oz-ruin/crow') expect(d.depth).toBe(OZ_A_STREET.lamp);
      if (['decor/oz/awning', 'decor/oz/balcony', 'decor/oz-ruin/car', 'decor/oz/planter'].includes(d.sprite)) {
        expect(d.depth).toBe(0);
        expect(d.y).toBe(o.y);
      }
      if (d.sprite === 'decor/oz/bollard') expect(d.depth).toBeNull();
    });
  });

  it('an item placed below the walk line keeps its screen spot and scrolls with its floor row (y = G, the offset in the depth)', () => {
    list.forEach((d, i) => {
      const o = OZ_A_DECOR[i];
      if (o.y <= G || d.depth === null || d.depth === undefined) return;
      expect(d.y).toBe(G);
      if (d.sprite === 'decor/oz-ruin/paper' || o.front) expect(G - d.depth, d.sprite).toBeGreaterThanOrEqual(o.y);
      if (d.sprite === 'decor/oz-ruin/paper') expect(G - d.depth).toBe(o.y);
      // Things at the fronts' feet: k px in front of the facade, but on the pavement (no nearer than the lamps' row).
      else if (!o.front) expect(G - d.depth).toBe(G - Math.max(OZ_A_STREET.lamp, 14 - (o.y - G)));
    });
    // The FloorDef's rule agrees for an item without a depth.
    expect(ozDecorDepth({ sprite: 'decor/oz/shop', x: 0, y: G }, OZ_A_DEPTHS)).toBe(14);
  });

  it('the front row keeps 24 px from every spawn spot; the back row stops at the boarded doors and windows', () => {
    for (const x of OZ_A_RISE) expect(OZ_A_KEEP_CLEAR).toContain(x);
    for (const o of OZ_A_OPENINGS) expect(OZ_A_KEEP_CLEAR).toContain(ruinSpotX(o));
    const floor = floorOzA();
    const [back, front] = floor.rows;
    expect(back.depth).toBe(OZ_A_STREET.backRow);
    expect(front.depth).toBe(OZ_A_STREET.frontRow);
    for (const u of front.u) for (const x of OZ_A_KEEP_CLEAR) expect(Math.abs(u - x), `front post ${u} / spot ${x}`).toBeGreaterThanOrEqual(24);
    for (const o of OZ_A_OPENINGS) {
      if (o.kind === 'manhole') continue;
      const w = o.kind === 'door' ? 11 : (o.w ?? 23);
      for (const u of back.u) expect(u > o.x - 4 && u < o.x + w + 4, `back post ${u} in front of the opening at ${o.x}`).toBe(false);
    }
    expect(back.u.length).toBeGreaterThan(40);
    expect(front.u.length).toBeGreaterThan(20);
  });
});

// ------------------------------------------------------------------------------- smooth (spec §2.7)

function lum(c: number): number {
  return ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
}

/** The sub-pixel shift k (output px) that best maps row A onto row B: B[x] ≈ A[x − k] (floor-raster.test.ts). */
function rowShift(a: Float64Array, b: Float64Array, maxK: number): number {
  const n = a.length;
  const m = maxK + 2;
  const ssd = (k: number): number => {
    let s = 0;
    for (let x = m + 8; x < n - m - 8; x++) {
      const d = b[x] - a[x - k];
      s += d * d;
    }
    return s;
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

function band(floor: SectionFloor, r: SoftRenderer, camX: number, tick = 0): Uint32Array {
  r.setCamera(camX, 0);
  floor.drawBand(r, tick, r.res);
  return (floor.raster.band as { data: Uint32Array }).data.slice();
}

describe('oz-a: smooth (spec §2.7)', () => {
  it('THE PAN TEST on oz-a\'s floor: every row moves s(y)·Δ within 1/res at 0.25 … 3 px/tick (the herringbone does not shimmer)', () => {
    const floor = floorOzA();
    const cam = { ...OZ_A_FLOOR.camera, yw: FLOOR_YW };
    const kerb = FLOOR_YW - OZ_A_STREET.kerbFront;
    for (const k of [1, 2]) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      const bw = 384 * k;
      let worst = 0;
      let rows = 0;
      for (const speed of [0.25, 0.5, 1, 2, 3]) {
        let x = 1100;
        r.setCamera(x, 0);
        let prevCam = r.camX;
        let prev = band(floor, r, x);
        for (let t = 1; t <= 5; t++) {
          x += speed;
          const cur = band(floor, r, x);
          const delta = r.camX - prevCam;
          for (let j = 0; j < cur.length / bw; j++) {
            const y = floor.bandTop + (j + 0.5) / k;
            // Flat rows only: not the back edge, not the raised kerb (its face and top), not the bottom.
            if (y < cam.back + 1.5 || Math.abs(y - kerb) < 2.5 || y > 214) continue;
            const a = new Float64Array(bw);
            const b = new Float64Array(bw);
            for (let i = 0; i < bw; i++) {
              a[i] = lum(prev[j * bw + i]);
              b[i] = lum(cur[j * bw + i]);
            }
            let mean = 0;
            for (let i = 0; i < bw; i++) mean += a[i];
            mean /= bw;
            let vr = 0;
            for (let i = 0; i < bw; i++) vr += (a[i] - mean) * (a[i] - mean);
            if (vr / bw < 20) continue;
            const want = -sOfY(cam, y) * delta * k;
            const got = rowShift(a, b, Math.ceil(Math.abs(want)) + 3);
            const err = Math.abs(got - want) / k;
            worst = Math.max(worst, err);
            rows++;
            expect(err, `res ${k} speed ${speed} y ${y.toFixed(2)}`).toBeLessThanOrEqual(1 / k);
          }
          prev = cur;
          prevCam = r.camX;
        }
      }
      expect(rows).toBeGreaterThan(100);
      expect(worst).toBeLessThan(0.5 / k);
    }
  });

  it('THE STILL TEST on oz-a\'s floor: a still camera draws identical frames', () => {
    const floor = floorOzA();
    expect(floor.animated).toBe(false);
    for (const k of [1, 2]) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      const a = band(floor, r, 1717.5, 10);
      const b = band(floor, r, 1717.5, 11);
      expect(Buffer.from(b.buffer).equals(Buffer.from(a.buffer))).toBe(true);
    }
  });
});

// ------------------------------------------------------------------------------- light and depth steps

describe('oz-a: the light pass on the floor', () => {
  it('the glows sit on their lamps (the lamps\' depth), each lamp lights a pool on the floor, the fog lies on it as mist', async () => {
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-a', seed: 1, god: true, loadContent: false });
    g.step(1);
    g.teleport(1150);
    g.step(20);
    const run = g.runner;
    if (!run || !run.light) throw new Error('no light pass');
    const floor = worldFloor(run.world);
    expect(floor).not.toBeNull();
    expect(run.light.floor).toBe(floor);
    const r = new SoftRenderer();
    r.begin(run.sky);
    run.draw(r);
    r.end();
    expect(run.light.mistRows).toBeGreaterThan(30);
    if (!floor) return;
    // The steady lamp at 1150 (flicker 0.08): its left head at (1135, G − 95), at the lamps' depth.
    const head = OZ_A_LAMP_LIGHTS.find((l) => l.x === 1135);
    if (!head) throw new Error('no lamp');
    const pt = floorShift(floor, head.x, head.y, OZ_A_STREET.lamp, r.camX, { x: 0, y: 0 });
    const map = run.light.map;
    expect(map.lightAt(pt.x, pt.y)).toBeGreaterThan(0.5);
    expect(pt.y).toBeCloseTo(head.y - OZ_A_STREET.lamp, 9);
    // The pool: light on the floor row of the lamp's depth under the head, none above the back edge.
    expect(map.lightAt(pt.x, FLOOR_YW - OZ_A_STREET.lamp)).toBeGreaterThan(0.2);
    g.dispose();
  });

  it('a light section without a floor (oz-b) keeps the old pass: no floor, no mist rows', async () => {
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-b', seed: 1, god: true, loadContent: false });
    g.step(30);
    const run = g.runner;
    if (!run || !run.light) throw new Error('no light pass');
    expect(worldFloor(run.world)).toBeNull();
    expect(run.light.floor).toBeNull();
    const r = new SoftRenderer();
    r.begin(run.sky);
    run.draw(r);
    r.end();
    expect(run.light.mistRows).toBe(0);
    g.dispose();
  });
});

/** The fx sprites a burst may draw at the front's depth (the tell's dust, the thrown planks). */
const DEPTH_FX = new Set(['fx/dust', 'prop/oz-boarded/plank']);

describe('oz-a: depth steps (spec §3.7)', () => {
  it('the boarded openings sit in their fronts; the dead who burst out are drawn with their hitbox; only fx leave the front, and they come back', async () => {
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-a', seed: 1, god: true, loadContent: false });
    g.step(1);
    // The first burst (the music shop at 453) needs its window in view.
    g.teleport(300);
    g.step(1);
    const run = g.runner;
    if (!run) throw new Error('no runner');
    const world = run.world;
    const boards = world.entities.filter((e) => e instanceof OzBoarded);
    expect(boards.length).toBe(OZ_A_OPENINGS.filter((o) => o.kind !== 'manhole').length);
    for (const b of boards) expect(b.drawDepth).toBe(OZ_A_STREET.facade);
    let bursts = 0;
    let planks = 0;
    const was = new Set<number>();
    for (let t = 0; t < 700; t++) {
      g.step(1);
      for (const e of world.byTag(OZ_ZOMBIE_TAG)) {
        // A zombie is never drawn off its hitbox: in the walk plane always (hidden ones are not drawn).
        expect(e.drawDepth, `zombie ${e.id} at tick ${t}`).toBe(0);
        if (!(e as typeof e & { hidden: boolean }).hidden && e.age > 0) was.add(e.id);
      }
      for (const e of world.entities) {
        if (e instanceof OzBoarded || e.drawDepth === 0) continue;
        // Nothing else is drawn at a depth but the burst's fx, between the front and the walk plane.
        expect(e.type).toBe('fx');
        expect(DEPTH_FX.has((e as typeof e & { sprite: string }).sprite)).toBe(true);
        expect(e.drawDepth).toBeGreaterThan(0);
        expect(e.drawDepth).toBeLessThanOrEqual(OZ_A_STREET.facade);
        if ((e as typeof e & { sprite: string }).sprite === 'prop/oz-boarded/plank') planks++;
      }
      bursts = boards.filter((b) => !(b as OzBoarded).closed).length;
    }
    expect(bursts, 'the first bursts of the script happened').toBeGreaterThan(0);
    expect(was.size).toBeGreaterThan(0);
    expect(planks, 'planks flew out of a drawn opening').toBeGreaterThan(0);
    g.dispose();
  });

  it('the fx of the bursts are spawned at the same spots with and without the floor (the sims never see it)', async () => {
    const fxTrace = async (floorOff: boolean): Promise<string[]> => {
      setFloorOverride(floorOff ? () => null : null);
      const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-a', seed: 1, god: true, loadContent: false });
      try {
        g.step(1);
        g.teleport(300);
        const out: string[] = [];
        for (let t = 0; t < 600; t++) {
          g.step(1);
          const w = g.runner?.world;
          if (!w || t % 3 !== 0) continue;
          for (const e of w.entities) if (e.type === 'fx' && !e.removed) out.push(`${t} ${(e as typeof e & { sprite: string }).sprite} ${e.x.toFixed(3)} ${e.y.toFixed(3)}`);
          out.push(`${t} particles ${w.particles.count}`);
        }
        return out;
      } finally {
        g.dispose();
        setFloorOverride(null);
      }
    };
    const on = await fxTrace(false);
    const off = await fxTrace(true);
    expect(on.some((l) => l.includes('prop/oz-boarded/plank'))).toBe(true);
    expect(on).toEqual(off);
  });

  it('without a floor (oz-b) nothing is drawn at a depth', async () => {
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-b', seed: 1, god: true, loadContent: false });
    g.step(2);
    const run = g.runner;
    if (!run) throw new Error('no runner');
    for (let t = 0; t < 400; t++) {
      g.step(1);
      for (const e of run.world.entities) expect(e.drawDepth).toBe(0);
    }
    g.dispose();
  });

  it('the floor\'s depth unit: a lamp 9.5 px behind the walk line stands on the kerb\'s pavement', () => {
    const cam = { ...OZ_A_FLOOR.camera, yw: FLOOR_YW };
    expect(vAtDepth(cam, OZ_A_STREET.lamp)).toBeLessThan(vAtDepth(cam, OZ_A_STREET.kerbBack));
    expect(vAtDepth(cam, OZ_A_STREET.lamp)).toBeGreaterThan(vAtDepth(cam, OZ_A_STREET.facade));
  });
});
