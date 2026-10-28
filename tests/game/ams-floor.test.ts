/**
 * The Amsterdam floor kit (src/game/content/missions/ams/floor/, docs/design/floor.md §4) and the
 * floor of section a (§4.4). CORE's tests (tests/game/floor-sections.test.ts) already check every
 * floor section's walk line, canopies, factor rule and front-row rules; these check the kit's own
 * promises:
 * - the bike symbol is painted for the rider (§4.3): its top toward the riding direction (near half
 *   +u, far half −u: the two are point mirrors), its wheels side by side across the lane, about 14
 *   px across and 15 along;
 * - the kerb crossing (§4.2): the band at 30° from the depth axis, shark teeth on the lane side, the
 *   cobbles cut along the band (no zigzag of whole cells), the pavements unchanged;
 * - the painter is pure (any call order, the same colour) and its kerbs bend over ≥ 32 px;
 * - the pole rows stop at the crossings, bridges and canals; the poles are thin enough for a front row;
 * - the decor depths: the facades at 14, what carries a hittable entity in the walk plane, the old 2D
 *   bridge and water pieces hidden, the bike racks by the front rows on the near pavement; the wavers
 *   and the baker drawn at their depths (render only);
 * - the street logic (§11 R2; nothing in the lane or on the roadway: the generic guard is
 *   tests/game/floor-street.test.ts): the bulbs lie flush and bend over ≥ 32 px; the lane leads to the
 *   raised drawbridge (stop line, barriers, the landing), whose leaf stands over the lane's far half
 *   only, behind the heroes' feet, with the hinge pit's plate in front of it;
 * - the small canal boat draws its open hull and its ends itself (its kind's faces, render only).
 */
import { describe, expect, it } from 'vitest';
import { depthAtV, makeFloorCam, sAtDepth, vAtDepth } from '../../src/engine/floor/cam';
import { frameW } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { loadContent } from '../../src/game/content/index';
import {
  A_BRIDGE_1,
  A_BRIDGE_2,
  A_DRAWBRIDGE,
  A_LAYOUT,
  AMS_CAMERA,
  BULB_FRONT_DECOR,
  CROSS_BAND,
  CROSS_TAN,
  crossingOffset,
  depthAt,
  HOUSE_FRONT_ROW,
  KERB_H,
  kitFloor,
  laneMidV,
  onBikeSymbol,
  pieceAt,
  poleFrame,
  POLE_SCALE,
  QUAY_FRONT_ROW,
  ROW_GAP,
  ROWBOAT_BEAM,
  streetFeatures,
  TEETH_GAP,
  TOOTH_LEN,
} from '../../src/game/content/missions/ams/floor/index';
import { getFloorPainter, type FloorPaintCtx } from '../../src/game/mission/floor/registry';
import { bindWorldFloor, checkFloor, FRONT_MAX_W } from '../../src/game/mission/floor/index';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import type { SectionDef } from '../../src/game/mission/types';
import { gameEntityFactory, getMission } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

await loadContent();
const sectionA = getMission('ams')?.sections.a as SectionDef;
const cam = makeFloorCam({ ...AMS_CAMERA });
const vAt = (depth: number): number => vAtDepth(cam, depth);

/** The `ams/floor` texel function of section a at density d. */
function painter(d: number): (u: number, v: number) => number {
  const ctx: FloorPaintCtx = {
    d,
    params: { layout: A_LAYOUT },
    seed: 7,
    cam,
    heightAt: () => 0,
    featureAt: () => -1,
    vAt,
    depthAt: (v) => depthAtV(cam, v),
  };
  return getFloorPainter('ams/floor')(ctx);
}

const r = (c: number): number => c >>> 24;
const g = (c: number): number => (c >>> 16) & 255;
const b = (c: number): number => (c >>> 8) & 255;
/** White road paint (the snow ramp's light tones). */
const isPaint = (c: number): boolean => r(c) > 170 && g(c) > 185 && b(c) > 195;
/** Granite (light grey, low saturation). */
const isGranite = (c: number): boolean => Math.max(r(c), g(c), b(c)) - Math.min(r(c), g(c), b(c)) < 40 && r(c) > 120;

describe('the bike symbol (spec §4.3: painted for the rider)', () => {
  it('has its top (saddle, bars) toward +A and its two wheels side by side across the lane', () => {
    const k = 1;
    const wc = 0.6;
    const wa = 0.5;
    // Wheels: on the rings at C ±4.5 (rear at the rider's left), below the middle.
    expect(onBikeSymbol(-4.5, -2.6 + 4.3, k, wc, wa)).toBe(true);
    expect(onBikeSymbol(4.5, -2.6 - 4.3, k, wc, wa)).toBe(true);
    expect(onBikeSymbol(-4.5, -4.6, k, wc, wa)).toBe(false);
    // The saddle and the bars at the top (+A), nothing at the mirrored place below.
    expect(onBikeSymbol(-0.6, 5.3, k, wc, wa)).toBe(true);
    expect(onBikeSymbol(3.5, 6.3, k, wc, wa)).toBe(true);
    expect(onBikeSymbol(-0.6, -9.3, k, wc, wa)).toBe(false);
    // Its extent: about 14 across (C) and 15 along (A).
    let c0 = 0;
    let c1 = 0;
    let a0 = 0;
    let a1 = 0;
    for (let C = -9; C <= 9; C += 0.1) {
      for (let A = -10; A <= 10; A += 0.1) {
        if (!onBikeSymbol(C, A, k, wc, wa)) continue;
        c0 = Math.min(c0, C);
        c1 = Math.max(c1, C);
        a0 = Math.min(a0, A);
        a1 = Math.max(a1, A);
      }
    }
    expect(c1 - c0).toBeGreaterThan(13);
    expect(c1 - c0).toBeLessThan(16);
    expect(a1 - a0).toBeGreaterThan(13);
    expect(a1 - a0).toBeLessThan(17);
  });

  it('is painted in both halves of the lane, the far one the point mirror of the near one', () => {
    const p = painter(4);
    // Section a's quay lane at u 280 (near half, every 220 from 60) and 170 (far half, 110 later).
    const u = 280;
    const vF = vAt(depthAt(A_LAYOUT.far, u));
    const vN = vAt(depthAt(A_LAYOUT.near, u));
    let near = 0;
    let far = 0;
    let mirrored = 0;
    let both = 0;
    for (let du = -9; du <= 9; du += 0.25) {
      for (let v = vF + 3; v < vN - 3; v += 0.25) {
        const a = isPaint(p(u + du, v));
        if (a && v > -5) near++;
        if (isPaint(p(170 + du, v)) && v < -12) far++;
      }
    }
    expect(near).toBeGreaterThan(60);
    expect(far).toBeGreaterThan(60);
    // The near symbol's top (the saddle, at A +5.3) points to +u, the far symbol's to −u.
    const f0 = cam.f;
    const k0 = cam.yw - cam.yh;
    const vis = f0 - (k0 * (f0 - vN)) / (k0 - KERB_H);
    const c0 = (vF + vis) / 2 + 2;
    const sn = (c0 + vis) / 2;
    const sf = (vF + c0) / 2;
    let top = 0;
    let bottom = 0;
    for (let C = -1.6; C <= 0.2; C += 0.2) {
      if (isPaint(p(u + 5.3, sn + C))) top++;
      if (isPaint(p(u - 5.3, sn + C))) bottom++;
      if (isPaint(p(170 - 5.3, sf - C))) top++;
      if (isPaint(p(170 + 5.3, sf - C))) bottom++;
    }
    expect(top).toBeGreaterThan(14);
    expect(bottom).toBe(0);
    // The far symbol (u 170, riders going −u) is the near one (u 280) turned by 180° in (u, v).
    const f = cam.f;
    const k1 = cam.yw - cam.yh;
    const vVis = f - (k1 * (f - vN)) / (k1 - KERB_H);
    const vc = (vF + vVis) / 2 + 2;
    const svN = (vc + vVis) / 2;
    const svF = (vF + vc) / 2;
    for (let du = -8; du <= 8; du += 0.25) {
      for (let dv = -6; dv <= 6; dv += 0.25) {
        both++;
        if (isPaint(p(u + du, svN + dv)) === isPaint(p(170 - du, svF - dv))) mirrored++;
      }
    }
    // Not exact: the strokes keep about 0.6 SCREEN px, so the far symbol's are thicker in world v; and the
    // worn paint specks differ (a hash per texel).
    expect(mirrored / both).toBeGreaterThan(0.88);
  });
});

describe('the kerb crossing (spec §4.2)', () => {
  const p = painter(2);
  const x = A_LAYOUT.crossings[0];
  const vF = vAt(depthAt(A_LAYOUT.far, x.u));
  const vN = vAt(depthAt(A_LAYOUT.near, x.u));
  const vMid = (vF + vN) / 2;

  it('crosses the street at 30° from the depth axis (in world space)', () => {
    expect(Math.atan(CROSS_TAN) * (180 / Math.PI)).toBeCloseTo(30, 6);
    const uFar = x.u - x.dir * (vF - vMid) * CROSS_TAN;
    const uNear = x.u - x.dir * (vN - vMid) * CROSS_TAN;
    expect(crossingOffset(uFar, vF, x.u, x.dir, vMid)).toBeCloseTo(0, 9);
    expect(crossingOffset(uNear, vN, x.u, x.dir, vMid)).toBeCloseTo(0, 9);
    expect(Math.abs(uFar - uNear) / (vN - vF)).toBeCloseTo(CROSS_TAN, 6);
  });

  it('paints granite on the band, white teeth on the lane side, cobbles cut along the band', () => {
    let teeth = 0;
    for (let v = vF + 4; v < vN - 6; v += 0.5) {
      const uc = x.u - x.dir * (v - vMid) * CROSS_TAN;
      // The band's lit top: granite all along it.
      expect(isGranite(p(uc + 0.2 * x.dir, v)), `band at v ${v}`).toBe(true);
      // Just past the band (cobble side): never the lane's red asphalt — the cut follows the line.
      const c = p(uc + x.dir * (CROSS_BAND / 2 + 0.3), v);
      expect(r(c) - b(c) < 90 || isGranite(c), `cobble side at v ${v}`).toBe(true);
      // The tooth row on the lane side.
      for (let s = CROSS_BAND / 2 + TEETH_GAP + 0.3; s < CROSS_BAND / 2 + TEETH_GAP + TOOTH_LEN; s += 0.5) if (isPaint(p(uc - x.dir * s, v))) teeth++;
    }
    expect(teeth).toBeGreaterThan(20);
  });

  it('leaves the pavements and their kerbs unchanged across the crossing', () => {
    for (const v of [vF - 12, vN + 10]) {
      const a = p(x.u - 40, v);
      const c = p(x.u + 40, v);
      // Both pavement tiles (grey, low saturation) on both sides of the crossing.
      for (const col of [a, c, p(x.u, v)]) expect(Math.max(r(col), g(col), b(col)) - Math.min(r(col), g(col), b(col))).toBeLessThan(45);
    }
  });
});

describe('the ams painter', () => {
  it('is pure: the same colour for a (u, v) in any call order (its column cache included)', () => {
    const seq = painter(2);
    const rnd = painter(2);
    const pts: [number, number][] = [];
    for (let i = 0; i < 4000; i++) pts.push([((i * 7919) % 3700) - 60 + ((i * 13) % 7) / 2, vAt(30) + ((i * 104729) % 1000) / 9]);
    const want = pts.map(([u, v]) => seq(u, v));
    const order = pts.map((_, i) => i).sort((i, j) => ((i * 48271) % 4001) - ((j * 48271) % 4001));
    for (const i of order) expect(rnd(pts[i][0], pts[i][1])).toBe(want[i]);
  });

  it('bends the kerbs between stretches over at least 32 px (spec §4.4)', () => {
    for (const line of [A_LAYOUT.far, A_LAYOUT.near]) {
      if (typeof line === 'number') continue;
      for (let i = 1; i < line.length; i++) if (line[i][1] !== line[i - 1][1]) expect(line[i][0] - line[i - 1][0]).toBeGreaterThanOrEqual(32);
    }
  });
});

describe('section a: street logic (spec §11 R2)', () => {
  it('lays the bulbs flush with the street (the walk line stays on the physics surface) and bends their kerbs over ≥ 32 px', () => {
    for (const b of A_LAYOUT.bulbs ?? []) {
      const feat = streetFeatures(A_LAYOUT).find((f) => f.kind === 'raise' && f.u0 === b.u0);
      expect(feat?.dh, `bulb ${b.u0}`).toBe(0);
      for (const pts of [b.far, b.near]) for (let i = 1; i < pts.length; i++) if (pts[i][1] !== pts[i - 1][1]) expect(pts[i][0] - pts[i - 1][0]).toBeGreaterThanOrEqual(32);
    }
  });

  it('leads the lane to the raised drawbridge: a stop line, barriers on both banks, the landing on the far bank', () => {
    expect(A_LAYOUT.stops?.some((s) => s.u > A_DRAWBRIDGE.barriers[0] - 20 && s.u < A_DRAWBRIDGE.barriers[0])).toBe(true);
    expect(pieceAt(A_LAYOUT.street, A_DRAWBRIDGE.hinge - 20)).toBe('lane');
    expect(A_DRAWBRIDGE.barriers.some((u) => u < 1060) && A_DRAWBRIDGE.barriers.some((u) => u > 1340)).toBe(true);
    expect(A_LAYOUT.landings).toContain(1340);
    const def = sectionA.floor;
    expect(def?.faces?.some((g) => g.name === 'drawbridge leaf')).toBe(true);
    // The pole rows stop at the barriers.
    const rows = (def?.rows ?? []).filter((r) => r.prop === 'ams/pole');
    for (const r of rows) for (const u of r.at ?? []) expect(u > A_DRAWBRIDGE.barriers[0] - 12 && u < A_DRAWBRIDGE.barriers[1] + 12, `${r.name} at ${u}`).toBe(false);
  });

  it('stands the raised leaf over the lane\'s far half only, behind the heroes\' feet; the hinge pit lies in front of it', () => {
    const vF = vAt(depthAt(A_LAYOUT.far, A_DRAWBRIDGE.hinge - 8));
    const vN = vAt(depthAt(A_LAYOUT.near, A_DRAWBRIDGE.hinge - 8));
    // The leaf's near edge is the lane's centre line (the painter's), at least 6 world px behind the walk line.
    expect(vAt(A_DRAWBRIDGE.near)).toBeCloseTo(laneMidV(vF, vN, cam.f, cam.yw - cam.yh), 9);
    expect(vAt(A_DRAWBRIDGE.near)).toBeLessThan(-6);
    expect(A_DRAWBRIDGE.far).toBeGreaterThan(depthAt(A_LAYOUT.far, A_DRAWBRIDGE.hinge - 8));
    // Every face of the leaf stays behind its near edge (no solid part in the walk depth).
    const leaf = sectionA.floor?.faces?.find((g) => g.name === 'drawbridge leaf');
    expect(leaf).toBeDefined();
    for (const f of leaf?.faces ?? []) for (const p of f.pts) expect(p[2]).toBeGreaterThanOrEqual(A_DRAWBRIDGE.near - 1e-9);
    // In front of it, from its near edge to the near kerb, the hinge pit (the painter's steel plate).
    const pit = A_LAYOUT.hingePits?.[0];
    expect(pit).toEqual({ u0: A_DRAWBRIDGE.hinge - A_DRAWBRIDGE.thick, u1: A_DRAWBRIDGE.hinge, far: A_DRAWBRIDGE.near });
    const p = painter(2);
    const steel = (c: number): boolean => Math.max(r(c), g(c), b(c)) - Math.min(r(c), g(c), b(c)) < 40;
    for (let v = vAt(A_DRAWBRIDGE.near) + 0.5; v < vN; v += 1.5) expect(steel(p(A_DRAWBRIDGE.hinge - 7, v)), `v ${v}`).toBe(true);
  });
});

describe('section a: rows and depths', () => {
  const floor = checkFloor(sectionA);

  it('has a floor whose pole rows stop at the crossings, bridges and canals', () => {
    expect(floor).not.toBeNull();
    if (!floor) return;
    const poles = floor.rows.filter((row) => row.def.prop === 'ams/pole');
    expect(poles.length).toBe(4);
    for (const row of poles) {
      expect(row.u.length).toBeGreaterThan(10);
      for (const u of row.u) {
        for (const x of A_LAYOUT.crossings) {
          const far = depthAt(A_LAYOUT.far, x.u);
          const near = depthAt(A_LAYOUT.near, x.u);
          const d = Math.max(near, Math.min(far, row.depth));
          const uc = x.u - x.dir * (vAt(d) - (vAt(far) + vAt(near)) / 2) * CROSS_TAN;
          expect(Math.abs(u - uc), `${row.def.name} at ${u}`).toBeGreaterThanOrEqual(ROW_GAP);
        }
        for (const br of [A_BRIDGE_1, A_BRIDGE_2]) expect(u < br.x0 || u > br.x0 + br.len, `${row.def.name} on a bridge at ${u}`).toBe(true);
        expect(u < 1060 || u > 1340, `${row.def.name} over the canal at ${u}`).toBe(true);
      }
    }
  });

  it('draws the Amsterdammertje thin enough for the front rows at every density', () => {
    for (const depth of [QUAY_FRONT_ROW, HOUSE_FRONT_ROW]) {
      const s = sAtDepth(cam, depth);
      for (const d of [1, 2, 4]) expect(frameW(poleFrame(s * POLE_SCALE, d)), `depth ${depth} d ${d}`).toBeLessThanOrEqual(FRONT_MAX_W);
    }
  });

  it('puts the decor at its depth: facades 14, the gull lamps and the secret elm in the walk plane, the old 2D pieces hidden', () => {
    if (!floor) return;
    const def = sectionA.floor;
    expect(def).toBeDefined();
    if (!def) return;
    const depthOf = (i: number): number | null | undefined => {
      const d = sectionA.decor?.[i];
      if (!d) return undefined;
      return d.depth !== undefined ? d.depth : def.decorDepth?.(d, i);
    };
    const decor = sectionA.decor ?? [];
    decor.forEach((d, i) => {
      const dep = depthOf(i);
      if (d.sprite.startsWith('decor/ams/house-') || d.sprite.startsWith('decor/ams/fabel-friet-')) expect(dep, d.sprite).toBe(14);
      if (d.sprite.startsWith('decor/ams/bridge-rail-') || d.sprite.startsWith('decor/ams/bridge-face-')) expect(dep, d.sprite).toBeNull();
      if (d.sprite === 'decor/ams/lamp' && [470, 920, 1360].includes(d.x)) expect(dep, `lamp ${d.x}`).toBe(0);
      if (d.sprite === 'decor/ams/elm' && d.x === 620) expect(dep).toBe(0);
      if (d.sprite === 'decor/ams/bike-rack') expect([QUAY_FRONT_ROW, HOUSE_FRONT_ROW, BULB_FRONT_DECOR].includes(dep as number), `rack ${d.x}`).toBe(true);
      // the flat view's bollards stay in the list for the no-floor paths; the floor's pole rows replace them
      if (d.sprite === 'decor/ams/bollard') expect(dep, `bollard ${d.x}`).toBeNull();
    });
    expect(def.hideDecor).toContain('decor/ams/water-');
  });

  it('draws the window wavers at the facade depth and the baker behind the counter (render only)', async () => {
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, players: 1, god: true });
    game.step(2);
    const w = game.runner?.world;
    expect(w).toBeTruthy();
    const wavers = w?.entities.filter((e) => e.type === 'ams-window-waver') ?? [];
    expect(wavers.length).toBe(3);
    for (const e of wavers) expect(e.drawDepth).toBe(14);
    const baker = w?.entities.find((e) => e.type === 'ams-baker');
    expect(baker?.drawDepth).toBe(7);
    game.dispose();
  }, 60_000);

  it('keeps a sleeping gull with its hitbox: drawn in the walk plane, on its lamp in the walk plane (spec §3.7)', async () => {
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, players: 1, god: true });
    game.step(2);
    const gull = game.runner?.world.entities.find((e) => e.type === 'seagull' && Math.abs(e.x - 470) < 1);
    expect(gull).toBeTruthy();
    expect(gull?.drawDepth).toBe(0);
    expect(sectionA.decor?.find((d) => d.sprite === 'decor/ams/lamp' && d.x === 470)?.depth).toBe(0);
    game.dispose();
  }, 60_000);
});

describe('section a: the small canal boat in perspective (spec §11 R1, §12.1 item 4: its own faces, render only)', () => {
  const floor = checkFloor(sectionA);
  if (!floor) throw new Error('no floor');
  const BOAT_X = 1150;
  const BOAT_Y = 172;
  // The real entity in a world bound to the floor: the floor lists its kind, so it draws its faces itself.
  const world = new World({ terrain: new Terrain(sectionA.terrain), seed: 1, factory: gameEntityFactory });
  bindWorldFloor(world, floor);
  const boat = world.spawn('ams-boat-platform', BOAT_X, BOAT_Y, { range: 0, bob: 0 });
  world.flush();
  /** Opaque px of a draw of the boat's faces with the camera at camX, in [x0, x1) × [y0, y1) (screen px). */
  const paint = (camX: number, x0: number, x1: number, y0: number, y1: number): number => {
    const r = new SoftRenderer();
    r.begin(0);
    r.setCamera(camX, 0);
    boat.drawFloorFaces(r);
    r.end();
    let n = 0;
    const t = r.target;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(t.h, y1); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(t.w, x1); x++) if ((t.data[y * t.w + x] & 255) > 0) n++;
    }
    return n;
  };

  it('shows its open hull over its beam: the top reaches back from the gunwale', () => {
    const camX = BOAT_X - 192;
    // Above the gunwale (screen y of the walk-plane top − 1), up to the far gunwale.
    const yTop = BOAT_Y + 1;
    const n = paint(camX, 192 - 26, 192 + 26, yTop - ROWBOAT_BEAM * 0.6, yTop - 1);
    expect(n).toBeGreaterThan(52 * 3);
  });

  it('shows only the end that faces the screen\'s centre column (the stern when the boat is right of it)', () => {
    // The boat right of the centre: its stern (left end, x − 30) shows, toward the centre.
    const right = BOAT_X - 192 - 120;
    const sternX = BOAT_X - 30 - right;
    expect(paint(right, sternX - 6, sternX - 0.5, BOAT_Y - 4, BOAT_Y + 9)).toBeGreaterThan(4);
    // Left of the centre: no stern face (nothing left of the stern's edge).
    const left = BOAT_X - 192 + 120;
    const sternL = BOAT_X - 30 - left;
    expect(paint(left, sternL - 6, sternL - 0.5, BOAT_Y - 4, BOAT_Y + 9)).toBe(0);
  });
});

describe('fail soft (Hard Rule 7)', () => {
  it('a kit that throws while it builds a floor leaves the section without one (logged)', () => {
    const warn = console.warn;
    const said: unknown[] = [];
    console.warn = (...a: unknown[]): void => {
      said.push(a);
    };
    try {
      expect(
        kitFloor('test', () => {
          throw new Error('bad tile');
        }),
      ).toBeUndefined();
    } finally {
      console.warn = warn;
    }
    expect(said.length).toBe(1);
    expect(sectionA.floor).toBeDefined();
  });
});
