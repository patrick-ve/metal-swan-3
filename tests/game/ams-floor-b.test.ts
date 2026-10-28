/**
 * The floor of `ams` b MUSEUMPLEIN (docs/design/floor.md §4.4 b, §12.2 b; src/game/content/missions/ams/
 * floor/b/). The generic floor tests (floor-sections, floor-street, floor-faces, floor-wave-b) enrol b by
 * its switch; these check what is special in b:
 * - THE PASSAGE: the lane runs through it at the walk line (the riders ride on it) on the street's own
 *   kerb lines, so it connects at both mouths without a bend; the museum crate stands on a bulb of its
 *   own; the vault's shade lies only under the roof (the far walkway and the lane's far edge, soft at the
 *   mouths; the lane's near half and the near pavement in the light); its roof is a slab from the facade
 *   to the platform line; its mouths' piers stand on the far walkway, behind the lane; no rows;
 * - MUSEUMPLEIN: a flush plein (path, lawns and edgings at one level; the pool's stone rim rises over
 *   it and its water lies under it, behind the walk line); the lawns follow the path's kerb lines (bulbs
 *   round the tourists); trees, flags, tulips, the bench and the lamp stand on the grass, never on a
 *   gravel path or in the pool; the lawn chains are the only front row there; the hot-dog stand is a box
 *   and its vendor draws the stand's lower box over himself (render only, on a floor only);
 * - THE CANAL ROAD: a house stretch with its canal in front (the quay's coping, the wall, the water),
 *   the front poles on the quay; the window wavers at the facades' depth (render only).
 */
import { describe, expect, it } from 'vitest';
import { depthAtV, makeFloorCam, vAtDepth } from '../../src/engine/floor/cam';
import { SoftRenderer } from '../../src/engine/render-soft';
import { getFrame } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import {
  B_BULBS,
  B_CABINET_DEPTH,
  B_FLOOR_ON,
  B_LAYOUT,
  B_MUSEUM_X,
  B_PLEIN,
  B_POOL,
  B_STAND_X,
  bFloorDef,
  CHAIN_ROW,
  CROSS_ROAD,
  CROSS_SQUARE,
  ROAD_CANAL,
} from '../../src/game/content/missions/ams/floor/b/index';
import { PASSAGE_KERB, PASSAGE_SHADE, ROOF_TOP_Y } from '../../src/game/content/missions/ams/floor/b/passage';
import {
  AMS_CAMERA,
  BULB_FAR,
  depthAt,
  FACADE,
  FAR_KERB_TOP,
  HOUSE_FAR,
  HOUSE_FRONT_ROW,
  HOUSE_NEAR,
  KERB_H,
  pieceAt,
  roadwayAt,
  type FloorArea,
  type StreetLayout,
} from '../../src/game/content/missions/ams/floor/index';
import { AMS_WAVE_B } from '../../src/game/content/missions/ams/floor/sections';
import { B_PASSAGE } from '../../src/game/content/missions/ams/terrain';
import { bindWorldFloor, checkFloor, floorOf, worldFloor } from '../../src/game/mission/floor/index';
import { getFloorPainter, type FloorPaintCtx } from '../../src/game/mission/floor/registry';
import type { FaceGroupDef, FloorDef } from '../../src/game/mission/floor/types';
import type { DecorDef, SectionDef } from '../../src/game/mission/types';
import { gameEntityFactory, getMission } from '../../src/game/registry';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import type { Entity } from '../../src/engine/entity';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';

import { createHeadlessGame } from '../../src/sim/index';

await loadContent();
const section = getMission('ams')?.sections.b as SectionDef;
const def = section.floor as FloorDef;
const decor: readonly DecorDef[] = section.decor ?? [];
const cam = makeFloorCam({ ...AMS_CAMERA });
const vAt = (depth: number): number => vAtDepth(cam, depth);
const G = 176;

/** The `ams/floor` texel function of section b (or of `layout`) at density d. */
function painter(d: number, layout: StreetLayout = B_LAYOUT): (u: number, v: number) => number {
  const ctx: FloorPaintCtx = { d, params: { layout }, seed: 11, cam, heightAt: () => 0, featureAt: () => -1, vAt, depthAt: (v) => depthAtV(cam, v) };
  return getFloorPainter('ams/floor')(ctx);
}

const lum = (c: number): number => 0.3 * (c >>> 24) + 0.59 * ((c >>> 16) & 255) + 0.11 * ((c >>> 8) & 255);

/** The depth a decor item stands at on b's floor. */
function depthOf(d: DecorDef, i: number): number | null | undefined {
  return d.depth !== undefined ? d.depth : def.decorDepth?.(d, i);
}

/** Is (u, depth) inside an area (its u range and its far … near depths there)? */
function inArea(a: FloorArea, u: number, depth: number): boolean {
  if (u < a.u0 || u >= a.u1) return false;
  const far = a.far === undefined ? Infinity : depthAt(a.far, u);
  const near = a.near === undefined ? -Infinity : depthAt(a.near, u);
  return depth <= far && depth >= near;
}

const group = (name: string): FaceGroupDef => {
  const g = def.faces?.find((f) => f.name === name);
  if (!g) throw new Error(`no face group ${name}`);
  return g;
};

describe('section b: the switch', () => {
  it('is on, and b has its floor', () => {
    expect(B_FLOOR_ON).toBe(true);
    expect(AMS_WAVE_B.find((s) => s.id === 'b')?.on).toBe(true);
    expect(section.floor).toBeDefined();
    expect(checkFloor(section)).not.toBeNull();
  });
});

describe('section b: THE PASSAGE (spec §12.2 b)', () => {
  it('runs the lane through it at the walk line on the street\'s kerb lines (no bend at the mouths); the museum crate on a bulb of its own', () => {
    for (let u = 0; u < CROSS_SQUARE; u += 4) expect(pieceAt(B_LAYOUT.street, u), `u ${u}`).toBe('lane');
    // The street's lane leads into the passage at the left mouth and out to the crossing onto the square.
    expect(B_LAYOUT.crossings).toContainEqual({ u: CROSS_SQUARE, dir: 1 });
    expect(pieceAt(B_LAYOUT.street, CROSS_SQUARE + 4)).toBe('tiles');
    const crate = B_BULBS.find((b) => b.u0 < 470 && b.u3 > 470);
    expect(crate, 'the museum crate\'s bulb').toBeDefined();
    if (!crate) return;
    // A small bulb inside the passage: its bends ≥ 32 px, its flat part under the crate (30 px wide).
    expect(crate.u0).toBeGreaterThanOrEqual(B_PASSAGE[0] + 16);
    expect(crate.u3).toBeLessThanOrEqual(B_PASSAGE[1] - 16);
    for (let u = 470 - 18; u <= 470 + 18; u += 2) expect(depthAt(B_LAYOUT.far, u), `u ${u}`).toBe(BULB_FAR);
    for (let u = B_PASSAGE[0] - 16; u <= B_PASSAGE[1] + 16; u += 2) {
      const r = roadwayAt(B_LAYOUT, u, vAt);
      expect(r, `u ${u}`).not.toBeNull();
      if (!r || (u >= crate.u0 && u <= crate.u3)) continue;
      // The lane straddles the walk line (the riders ride on it), on the house stretch's kerb lines at both mouths.
      expect(r[0], `u ${u}`).toBeLessThan(0);
      expect(r[1], `u ${u}`).toBeGreaterThan(0);
      expect(depthAtV(cam, r[0])).toBeCloseTo(HOUSE_FAR, 6);
      expect(depthAtV(cam, r[1])).toBeCloseTo(HOUSE_NEAR, 6);
    }
  });

  it('lays the vault\'s shade only under the roof: the far walkway darker, soft at the mouths; the lane\'s near half and the near pavement in the light', () => {
    expect(B_LAYOUT.shades?.length).toBe(1);
    const d = 2;
    const lit = painter(d);
    const bare = painter(d, { ...B_LAYOUT, shades: [] });
    const mean = (p: (u: number, v: number) => number, u0: number, u1: number, depth0: number, depth1: number): number => {
      let sum = 0;
      let n = 0;
      for (let v = vAt(depth0); v < vAt(depth1); v += 0.5) {
        for (let u = u0 + 0.25; u < u1; u += 1.5) {
          sum += lum(p(u, v));
          n++;
        }
      }
      return sum / n;
    };
    // The far walkway under the roof: darker by the vault's shade (2 ramp steps).
    expect(mean(lit, 540, 640, FACADE, HOUSE_FAR + FAR_KERB_TOP)).toBeLessThan(mean(bare, 540, 640, FACADE, HOUSE_FAR + FAR_KERB_TOP) * 0.82);
    expect(PASSAGE_SHADE).toBeGreaterThan(1.5);
    // In front of the roof's front edge (its soft edge done): the lane's near half and the near pavement exactly as outside.
    for (let u = B_PASSAGE[0] - 20; u < B_PASSAGE[1] + 20; u += 3.7) {
      for (const depth of [-2, -8, -14, -20, -30]) expect(lit(u, vAt(depth)), `u ${u} depth ${depth}`).toBe(bare(u, vAt(depth)));
    }
    // Outside the passage (past the soft mouths) nothing changes; across a mouth the walkway darkens step by step.
    for (const u of [B_PASSAGE[0] - 6, B_PASSAGE[1] + 6]) expect(lit(u, vAt(10))).toBe(bare(u, vAt(10)));
    const ramp = [-6, -2, 2, 6].map((du) => mean(lit, B_PASSAGE[0] + du - 1, B_PASSAGE[0] + du + 1, 13, 7));
    for (let k = 1; k < ramp.length; k++) expect(ramp[k], `the left mouth's ramp ${k}`).toBeLessThan(ramp[k - 1] + 2);
    expect(ramp[3]).toBeLessThan(ramp[0] * 0.9);
    // The far kerb's face under the vault is the darker granite (not where the crate's bulb lies flush).
    const kerbs = (def.features ?? []).filter((f) => f.face === PASSAGE_KERB);
    expect(kerbs.length).toBe(2);
    for (const f of kerbs) {
      expect(f.u0 as number).toBeGreaterThanOrEqual(B_PASSAGE[0]);
      expect(f.u1 as number).toBeLessThanOrEqual(B_PASSAGE[1]);
      expect(f.dh).toBe(KERB_H);
    }
  });

  it('makes its roof a slab from the facade to the platform line (the heroes stand on its drawn front edge)', () => {
    const roof = group('passage roof');
    expect(roof.depth).toBe(FACADE);
    const top = roof.faces[0];
    const front = top.pts.filter((q) => q[2] === 0);
    const back = top.pts.filter((q) => q[2] === FACADE);
    expect(front.length).toBe(2);
    expect(back.length).toBe(2);
    // The front edge: world px on the terrain's solid (its top y 84 over 400 … 720).
    const solid = section.terrain.solids?.find((s) => s.x === B_PASSAGE[0]);
    expect(solid).toBeDefined();
    expect(solid?.y).toBe(ROOF_TOP_Y);
    for (const q of front) {
      expect(q.length).toBe(4);
      expect(q[1]).toBe(G - ROOF_TOP_Y);
      expect([B_PASSAGE[0], B_PASSAGE[1]]).toContain(B_MUSEUM_X + q[0]);
    }
    // The back edge on the art's opening (sprite px from the museum's anchor; the art's passage 80 … 400 px of 480).
    for (const q of back) {
      expect(q.length).toBe(3);
      expect(Math.abs(q[0])).toBe(160);
    }
  });

  it('stands its mouths\' piers on the walkway, behind the walk line, and no row inside', () => {
    const floor = checkFloor(section);
    if (!floor) throw new Error('no floor');
    for (const name of ['passage mouth L', 'passage mouth R']) {
      const g = group(name);
      // Drawn after the facade, before the walk plane.
      expect(g.order).toBeGreaterThan(0);
      expect(g.order).toBeLessThan(FACADE);
      for (const f of g.faces) {
        for (const q of f.pts) {
          // Under the slab (h < its underside) only on the far walkway, behind the lane's far kerb; the slab's end reaches the platform's end.
          const h = q[1];
          if (h < G - ROOF_TOP_Y - 12 - 0.01) expect(q[2], `${name}`).toBeGreaterThanOrEqual(HOUSE_FAR + FAR_KERB_TOP);
        }
      }
    }
    for (const row of floor.rows) for (const u of row.u) expect(u < B_PASSAGE[0] - 24 || u > B_PASSAGE[1] + 24, `${row.def.name} @${u}`).toBe(true);
  });
});

describe('section b: MUSEUMPLEIN (spec §12.2 b)', () => {
  const floor = checkFloor(section);
  if (!floor) throw new Error('no floor');
  const areas = B_LAYOUT.areas ?? [];
  const grass = areas.filter((a) => a.kind === 'grass');
  const gravel = areas.filter((a) => a.kind === 'gravel');

  it('lies flush: the path, the lawns and their edgings at the walk level; the pool\'s rim over it, its water under it, behind the walk line', () => {
    const [p0, p1] = B_PLEIN;
    for (let u = p0 + 40; u < p1 - 40; u += 16) {
      for (const depth of [29, 22, 9, 0, -10, -20, -30, -39]) {
        const inPool = u >= B_POOL.u0 && u < B_POOL.u1 && depth <= B_POOL.far && depth >= B_POOL.near;
        if (inPool) continue;
        expect(floor.heightAt(u, vAt(depth)), `u ${u} depth ${depth}`).toBeCloseTo(0, 6);
      }
    }
    const mid = (B_POOL.u0 + B_POOL.u1) / 2;
    expect(B_POOL.near).toBeGreaterThan(0);
    expect(floor.heightAt(mid, vAt((B_POOL.far + B_POOL.near) / 2))).toBeLessThan(0);
    expect(floor.heightAt(mid, vAt(B_POOL.near + 0.4))).toBeGreaterThan(0);
    expect(floor.heightAt(mid, vAt(B_POOL.far - 0.4))).toBeGreaterThan(0);
  });

  it('runs the path between lawns that follow its kerb lines (the far lawn bulges round the tourists at 1420 and 1760)', () => {
    const far = grass.find((a) => a.near === B_LAYOUT.far);
    const near = grass.find((a) => a.far === B_LAYOUT.near);
    expect(far).toBeDefined();
    expect(near).toBeDefined();
    for (const x of [1420, 1760]) {
      expect(depthAt(B_LAYOUT.far, x), `far line at ${x}`).toBeLessThan(-2);
      // The tourist (16 px wide) sits on the lawn: the path starts in front of his feet.
      for (const u of [x - 8, x, x + 8]) expect(depthAt(B_LAYOUT.far, u)).toBeLessThan(-2);
    }
    for (let u = B_PLEIN[0] + 40; u < B_PLEIN[1] - 40; u += 8) expect(pieceAt(B_LAYOUT.street, u)).toBe('gravel');
    expect(B_LAYOUT.crossings).toContainEqual({ u: CROSS_ROAD, dir: -1 });
    expect(pieceAt(B_LAYOUT.street, CROSS_ROAD + 4)).toBe('lane');
  });

  it('stands the trees, flags, tulips, the bench and the lamp on the grass, never on a gravel path or in the pool', () => {
    let n = 0;
    decor.forEach((d, i) => {
      if (d.front || d.y !== G || d.x < B_PLEIN[0] || d.x > B_PLEIN[1]) return;
      if (!/^decor\/ams\/(elm|flag-|tulips|bench|lamp)/.test(d.sprite)) return;
      const depth = depthOf(d, i);
      expect(typeof depth, d.sprite).toBe('number');
      if (typeof depth !== 'number') return;
      // The foot: the sprite's middle column (a trunk, a pole, a planter's box).
      expect(grass.some((a) => inArea(a, d.x, depth)), `${d.sprite} @${d.x} depth ${depth} on the grass`).toBe(true);
      expect(gravel.some((a) => inArea(a, d.x, depth)), `${d.sprite} @${d.x} on a path`).toBe(false);
      const inPool = d.x >= B_POOL.u0 - 2 && d.x < B_POOL.u1 + 2 && depth <= B_POOL.far + 1 && depth >= B_POOL.near - 1;
      expect(inPool, `${d.sprite} @${d.x} in the pool`).toBe(false);
      n++;
    });
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it('has the low lawn chains as its only front row, and hides the old 2D lawn and pool strips', () => {
    const chains = floor.rows.filter((r) => r.def.prop === 'ams/lawn-post');
    expect(chains.length).toBe(1);
    expect(chains[0].depth).toBe(CHAIN_ROW);
    expect(chains[0].u.length).toBeGreaterThan(10);
    for (const u of chains[0].u) expect(u > B_PLEIN[0] && u < B_PLEIN[1]).toBe(true);
    for (const row of floor.rows) {
      if (row.def.prop !== 'ams/pole') continue;
      for (const u of row.u) expect(u < B_PLEIN[0] || u > B_PLEIN[1], `${row.def.name} @${u} on the plein`).toBe(true);
    }
    for (const prefix of ['decor/ams/lawn-', 'decor/ams/pool-']) expect(def.hideDecor).toContain(prefix);
  });

  it('makes the hot-dog stand a box: its ends and its roof, behind the walk plane; the cabinet on the square\'s near side', () => {
    const stand = group('hotdog stand');
    expect(stand.x).toBe(B_STAND_X);
    expect(stand.faces.length).toBe(3);
    for (const f of stand.faces) for (const q of f.pts) expect(q[2]).toBeGreaterThanOrEqual(0);
    const cab = decor.find((d) => d.sprite === 'decor/ams/cabinet');
    expect(cab?.depth).toBe(B_CABINET_DEPTH);
    expect(group('cabinet').front).toBe(true);
    // The stand's own front piece is not drawn over the world on the floor (it would cover heads and guns).
    expect(decor.find((d) => d.sprite === 'decor/ams/hotdog-front')?.depth).toBeNull();
  });

  it('lets the vendor draw the stand\'s lower box over himself on a floor (render only: the world pass, under the heroes)', async () => {
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: 'b', seed: 1, players: 1, god: true });
    try {
      game.step(2);
      const w = game.runner?.world;
      if (!w) throw new Error('no world');
      expect(worldFloor(w)).not.toBeNull();
      const vendor = w.entities.find((e) => e.type === 'ams-hotdog-vendor');
      expect(vendor).toBeDefined();
      if (!vendor) return;
      const r = new SoftRenderer();
      const ids: string[] = [];
      const own = r.sprite.bind(r);
      r.sprite = (id, i, x, y, o) => {
        ids.push(id);
        own(id, i, x, y, o);
      };
      vendor.draw(r);
      expect(ids[ids.length - 1]).toBe('decor/ams/hotdog-front');
      expect(ids.length).toBeGreaterThan(1);
      // Its z: under the heroes.
      for (const p of w.players) expect(vendor.z).toBeLessThan(p.z);
      expect(getFrame('decor/ams/hotdog-front', 0, 1).buf.w).toBeGreaterThan(60);
    } finally {
      game.dispose();
    }
  }, 60_000);
});

describe('section b: the street and THE CANAL ROAD', () => {
  const floor = checkFloor(section);
  if (!floor) throw new Error('no floor');

  it('runs the canal in front of the canal road: the quay\'s coping, its wall toward the camera, the water to the screen\'s bottom', () => {
    const cut = (def.features ?? []).find((f) => f.kind === 'cut' && f.u0 === ROAD_CANAL.u0);
    expect(cut).toBeDefined();
    expect(cut?.from).toBe(ROAD_CANAL.far);
    expect(cut?.to).toBeUndefined();
    for (let u = ROAD_CANAL.u0 + 8; u < section.width; u += 32) {
      expect(floor.heightAt(u, vAt(ROAD_CANAL.far - 4))).toBeLessThan(-3);
      expect(floor.heightAt(u, vAt(ROAD_CANAL.far + 2))).toBeCloseTo(KERB_H, 6);
    }
    // The front poles stand on the quay, between the near kerb's top and the coping.
    const poles = floor.rows.find((r) => r.def.name === 'front poles (canal road)');
    expect(poles?.depth).toBe(HOUSE_FRONT_ROW);
    expect(HOUSE_FRONT_ROW).toBeGreaterThan(ROAD_CANAL.far + ROAD_CANAL.coping);
  });

  it('puts the house fronts and the museum at the facade\'s depth, the gull lamps in the walk plane, the racks by the front rows', () => {
    decor.forEach((d, i) => {
      const depth = depthOf(d, i);
      if (d.sprite.startsWith('decor/ams/house-') || d.sprite === 'decor/ams/rijksmuseum') expect(depth, d.sprite).toBe(FACADE);
      if (d.sprite === 'decor/ams/lamp' && [110, 2300, 2620].includes(d.x)) expect(depth, `lamp ${d.x}`).toBe(0);
      if (d.sprite === 'decor/ams/bike-rack') expect(depth as number, `rack ${d.x}`).toBeLessThanOrEqual(HOUSE_FRONT_ROW);
    });
    expect(def.hideDecor).toContain('decor/ams/bollard');
  });

  it('shows the street row\'s end and the museum\'s corner wings and towers as boxes', () => {
    const names = (def.faces ?? []).map((g) => g.name ?? '');
    expect(names.filter((n) => n.startsWith('house side')).length).toBeGreaterThanOrEqual(2);
    expect(names).toContain('museum wing L');
    expect(names).toContain('museum wing R');
    expect(names.filter((n) => n.startsWith('museum tower')).length).toBe(2);
  });

  it('draws the window wavers at the facades\' depth (render only)', async () => {
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: 'b', seed: 1, players: 1, god: true });
    try {
      game.step(2);
      const wavers = game.runner?.world.entities.filter((e) => e.type === 'ams-window-waver') ?? [];
      expect(wavers.length).toBe(2);
      for (const e of wavers) expect(e.drawDepth).toBe(FACADE);
    } finally {
      game.dispose();
    }
  }, 60_000);

  it('builds the same def again (no state between builds)', () => {
    expect(JSON.stringify(bFloorDef(decor).features)).toBe(JSON.stringify(def.features));
  });
});

/** The px the floor's entity pass draws for the entities `spawn` puts in a world on the section's floor (no contact shadows). */
function entityFacePx(section: SectionDef, spawn: (w: World) => Entity[], camX: number, before?: (es: Entity[]) => void): number {
  const fl = new SectionFloor(section, { ...(floorOf(section) as FloorDef), shadow: 0 }, new Terrain(section.terrain), 1, `${section.id}-test/faces/${camX}/`);
  const w = new World({ terrain: new Terrain(section.terrain), seed: 1, factory: gameEntityFactory });
  bindWorldFloor(w, fl);
  const es = spawn(w);
  w.flush();
  before?.(es);
  const r = new SoftRenderer();
  r.begin(0);
  r.setCamera(camX, 0);
  fl.drawShadows(r, w, 1);
  r.end();
  const b = r.target;
  let n = 0;
  for (let i = 0; i < b.data.length; i++) if ((b.data[i] & 255) > 0) n++;
  return n;
}

describe('section b: the museum crate in the passage (spec §12.1 item 4; a secret)', () => {
  it('draws the museum crate NIET OPENEN as a box (its lid and sides); a secret of another look draws none', () => {
    const crate = entityFacePx(section, (w) => [w.spawn('ams-secret', 470, G, { look: 'museum-crate', hides: 'hostage' })], 300);
    expect(crate).toBeGreaterThan(60);
    expect(entityFacePx(section, (w) => [w.spawn('ams-secret', 1025, G - 57, { look: 'spot', hides: '1up' })], 860)).toBe(0);
  });
});
