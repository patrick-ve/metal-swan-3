/**
 * The floor of `ams` c AMSTEL (src/game/content/missions/ams/floor/c/, docs/design/floor.md §4.4,
 * §12.2 c). The generic floor tests (floor-sections, floor-street, floor-wave-b) enrol c by its switch
 * and check its walk line, front rows, pan and still, faces' sampling, gate 5, memory and allocation,
 * and the street guard over a bot run; these check what is special in c:
 * - the street logic (§11 R2): the bulbs lie flush and bend over ≥ 32 px; the lane ends at a kerb
 *   crossing onto the quay head's square (it never runs into the canal); everything the script keeps
 *   in the walk plane (the crates, the herring cart, the market stall, the tourist's chair, the secret's
 *   bike, the lamps gulls sleep on) stands off the lane and the roadway; the pole rows stop at the
 *   crossing, the canal, the bulbs and the stair;
 * - the decor depths: facades 14, the gull lamps 0, the old water and bollards hidden, the racks on the
 *   near pavement, the route signs on the far pavement, the white bridge and its gallows at the deck's
 *   far side, the tour boat behind the pontoon; the window wavers at the facades' depth (render only);
 * - the fork (§12.2 c): the jetty stair cut into the quay (treads on the walk profile, the quay beside
 *   it at pavement height, the basin's water under it); the bridge's deck and ramp from the sprite's
 *   deck line to the platform line for every camera; the pontoon and the tour boat as boxes, the boat
 *   moored behind the pontoon;
 * - the side faces (§11 R1): the shop quay's two row ends, the six houseboats; the entity kinds c lists.
 */
import { describe, expect, it } from 'vitest';
import { FLOOR_CX, makeFloorCam, sAtDepth, vAtDepth } from '../../src/engine/floor/cam';
import { Terrain } from '../../src/engine/terrain';
import { loadContent } from '../../src/game/content/index';
import {
  C_BEND,
  C_BULBS,
  C_DUCK_DEPTH,
  C_CROSSING,
  C_DECK_DEPTH,
  C_FLOOR_ON,
  C_KEEP_CLEAR,
  C_LAYOUT,
  C_RACKS,
  C_STAIR_FAR,
  C_TOUR_DEPTH,
  C_TOUR_X,
  PONTOON_DEEP,
} from '../../src/game/content/missions/ams/floor/c/index';
import {
  AMS_CAMERA,
  BULB_FRONT_DECOR,
  CROSS_TAN,
  depthAt,
  depthBehind,
  FACADE,
  HOUSE_FAR,
  HOUSE_FRONT_ROW,
  HOUSE_NEAR,
  KERB_H,
  pieceAt,
  ROW_GAP,
  roadwayAt,
  streetFeatures,
} from '../../src/game/content/missions/ams/floor/index';
import { AMS_WAVE_B } from '../../src/game/content/missions/ams/floor/sections';
import { C_BASIN, C_BASIN_Y, C_BOATS, C_CANAL, C_DECK_Y, C_RAMP, C_RAMP_FOOT_Y, C_STEP, C_STEPS_X, C_W, G } from '../../src/game/content/missions/ams/terrain';
import { bindWorldFloor, checkFloor } from '../../src/game/mission/floor/index';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import type { FaceGroupDef, FloorDef } from '../../src/game/mission/floor/types';
import type { SectionDef } from '../../src/game/mission/types';
import { gameEntityFactory, getMission } from '../../src/game/registry';
import { SoftRenderer } from '../../src/engine/render-soft';
import { World } from '../../src/engine/world';
import type { Entity } from '../../src/engine/entity';
import { AmsScanCar } from '../../src/game/content/bosses/ams-scan/car';
import { createHeadlessGame } from '../../src/sim/index';

await loadContent();
const sectionC = getMission('ams')?.sections.c as SectionDef;
const def = sectionC.floor as FloorDef;
const cam = makeFloorCam({ ...AMS_CAMERA });
const vAt = (depth: number): number => vAtDepth(cam, depth);

/** The depth a decor item of c draws at (its own depth, else the floor's rule). */
function depthOfDecor(i: number): number | null | undefined {
  const d = sectionC.decor?.[i];
  if (!d) return undefined;
  return d.depth !== undefined ? d.depth : def.decorDepth?.(d, i);
}

interface GroupView {
  def: FaceGroupDef;
  px: Float64Array;
  py: Float64Array;
  shown: Uint8Array;
}
interface FloorView {
  groups: GroupView[];
  projectGroup(g: GroupView, camX: number, camY: number): number[] | null;
  liftAt(x: number, depth: number): number;
  heightAt(u: number, v: number): number;
}

describe('section c: the floor is on (spec §12.3)', () => {
  it('turns its switch on: the section has its floor, and the wave-B list enrols it', () => {
    expect(C_FLOOR_ON).toBe(true);
    expect(AMS_WAVE_B.find((s) => s.id === 'c')?.on).toBe(true);
    expect(def).toBeDefined();
    expect(checkFloor(sectionC)).not.toBeNull();
  });
});

describe('section c: street logic (spec §11 R2)', () => {
  it('lays the bulbs flush with the street and bends every kerb over ≥ 32 px (spec §4.4)', () => {
    for (const b of C_BULBS) {
      const feat = streetFeatures(C_LAYOUT).find((f) => f.kind === 'raise' && f.u0 === b.u0);
      expect(feat?.dh, `bulb ${b.u0}`).toBe(0);
    }
    for (const line of [C_LAYOUT.far, C_LAYOUT.near]) {
      if (typeof line === 'number') continue;
      for (let i = 1; i < line.length; i++) if (line[i][1] !== line[i - 1][1]) expect(line[i][0] - line[i - 1][0], `bend at ${line[i][0]}`).toBeGreaterThanOrEqual(32);
    }
    // The bend from the open quay to the house stretch lies under the canal's water.
    expect(C_BEND[0]).toBeGreaterThan(C_CANAL[0]);
    expect(C_BEND[1]).toBeLessThan(C_CANAL[1]);
  });

  it('ends the lane at a kerb crossing onto the quay head\'s square: no lane runs into the canal', () => {
    expect(pieceAt(C_LAYOUT.street, C_CROSSING - 10)).toBe('lane');
    expect(pieceAt(C_LAYOUT.street, C_CROSSING + 10)).toBe('fan');
    expect(C_LAYOUT.crossings).toContainEqual({ u: C_CROSSING, dir: 1 });
    for (let u = C_CROSSING; u < C_CANAL[0]; u += 2) expect(pieceAt(C_LAYOUT.street, u), `u ${u}`).not.toBe('lane');
    // The shop quay is cobbles up to the fork's square; no lane anywhere after the canal.
    for (let u = C_CANAL[1]; u < C_W; u += 4) expect(['cobbles', 'fan']).toContain(pieceAt(C_LAYOUT.street, u));
  });

  it('keeps what the script puts in the walk plane off the lane and the roadway (crates, kiosks, the chair, the secret, the gull lamps)', () => {
    // [x, half width] of the script's walk-plane things (section-c.ts `script`, secrets.ts, the decor lamps).
    const things: readonly (readonly [number, number, string])[] = [
      [250, 12, 'crate S'],
      [534, 12, 'the canal bike (secret)'],
      [520, 3, 'lamp with a gull'],
      [1460, 12, 'crate M'],
      [1520, 23, 'herring cart'],
      [1640, 8, 'tourist on a chair'],
      [1700, 27, 'market stall'],
      [1980, 12, 'crate'],
      [2000, 3, 'lamp with a gull'],
      [2384, 12, 'repair crate'],
    ];
    for (const [x, hw, what] of things) {
      for (let u = x - hw; u <= x + hw; u += 0.5) {
        const r = roadwayAt(C_LAYOUT, u, vAt);
        // Free here, or the roadway lies wholly in front of the thing's foot (the near half of a bulb's street).
        if (r) expect(r[0], `${what} at ${u}`).toBeGreaterThan(3);
      }
    }
  });

  it('stops the pole rows at the crossing, the canal, the bulbs (back rows), the racks and the stair', () => {
    const rows = (def.rows ?? []).filter((r) => r.prop === 'ams/pole');
    expect(rows.length).toBe(4);
    for (const r of rows) {
      expect(r.at?.length ?? 0, r.name).toBeGreaterThan(5);
      for (const u of r.at ?? []) {
        const x = C_LAYOUT.crossings[0];
        const far = depthAt(C_LAYOUT.far, x.u);
        const near = depthAt(C_LAYOUT.near, x.u);
        const d = Math.max(near, Math.min(far, r.depth));
        const uc = x.u - x.dir * (vAt(d) - (vAt(far) + vAt(near)) / 2) * CROSS_TAN;
        expect(Math.abs(u - uc), `${r.name} at ${u}: the crossing`).toBeGreaterThanOrEqual(ROW_GAP);
        expect(u < C_CANAL[0] - 10 || u > C_CANAL[1] + 10, `${r.name} at ${u}: the canal`).toBe(true);
        expect(u, `${r.name} at ${u}: the stair`).toBeLessThan(C_STEPS_X);
        if (r.depth > 0) for (const b of C_BULBS) expect(u < b.u0 || u > b.u3, `${r.name} at ${u}: bulb ${b.u0}`).toBe(true);
        else for (const k of C_RACKS) expect(Math.abs(u - k), `${r.name} at ${u}: rack ${k}`).toBeGreaterThan(30);
      }
    }
  });
});

describe('section c: depths (spec §1.3, §3.7)', () => {
  it('puts the decor at its depth: facades 14, the gull lamps in the walk plane, the fork\'s pieces at theirs, the old pieces hidden', () => {
    const decor = sectionC.decor ?? [];
    expect(def.hideDecor).toEqual(expect.arrayContaining(['decor/ams/water-', 'decor/ams/bollard']));
    let signs = 0;
    decor.forEach((d, i) => {
      const dep = depthOfDecor(i);
      if (d.sprite.startsWith('decor/ams/house-')) expect(dep, `${d.sprite} @${d.x}`).toBe(FACADE);
      // The lamps gulls sleep on (520, 2000) in the walk plane; the others on the pavements.
      if (d.sprite === 'decor/ams/lamp' && [520, 2000].includes(d.x)) expect(dep, `lamp ${d.x}`).toBe(0);
      else if (d.sprite === 'decor/ams/lamp') expect(dep as number, `lamp ${d.x}`).toBeGreaterThan(0);
      if (d.sprite === 'decor/ams/bike-rack') expect([HOUSE_FRONT_ROW, BULB_FRONT_DECOR]).toContain(dep);
      if (d.sprite === 'decor/ams/route-sign') {
        signs++;
        // On the far pavement: behind the far kerb, in front of the facades.
        expect(dep as number).toBeGreaterThan(HOUSE_FAR + 2);
        expect(dep as number).toBeLessThan(FACADE);
      }
      if (d.sprite === 'decor/ams/white-bridge' || d.sprite === 'decor/ams/white-portal') expect(dep, d.sprite).toBe(C_DECK_DEPTH);
      if (d.sprite === 'decor/ams/ams-cruise-boat') {
        expect(dep).toBe(C_TOUR_DEPTH);
        expect(d.x).toBe(C_TOUR_X);
      }
    });
    expect(signs).toBe(2);
    // The tour boat lies behind the pontoon (its near side past the pontoon's far edge).
    expect(C_TOUR_DEPTH).toBeGreaterThan(depthBehind(0, PONTOON_DEEP));
  });

  it('draws the window wavers at the facades\' depth (render only) and keeps the sleeping gulls with their hitboxes', async () => {
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: 'c', seed: 1, players: 1, god: true });
    game.step(2);
    const w = game.runner?.world;
    expect(w).toBeTruthy();
    const wavers = w?.entities.filter((e) => e.type === 'ams-window-waver') ?? [];
    expect(wavers.length).toBe(3);
    for (const e of wavers) expect(e.drawDepth).toBe(FACADE);
    const gull = w?.entities.find((e) => e.type === 'seagull' && Math.abs(e.x - 520) < 1);
    expect(gull).toBeTruthy();
    expect(gull?.drawDepth).toBe(0);
    game.dispose();
  }, 60_000);
});

describe('section c: the fork (spec §12.2 c: the ramp, the jetty steps, the pontoon, the tour boat)', () => {
  const floor = new SectionFloor(sectionC, def, new Terrain(sectionC.terrain), 1, 'ams-floor-c-test/') as unknown as FloorView;

  it('cuts the jetty stair into the quay: its treads on the walk profile, the quay beside it at pavement height, the basin under it', () => {
    const t1 = C_STEPS_X + C_STEP / 2;
    const t2 = C_STEPS_X + C_STEP * 1.5;
    expect(floor.heightAt(t1, 0)).toBeCloseTo(-6, 6);
    expect(floor.heightAt(t2, 0)).toBeCloseTo(-12, 6);
    // The stair runs from behind the bridge's far side to the near kerb line.
    for (const depth of [C_STAIR_FAR - 0.5, C_DECK_DEPTH, 0, HOUSE_NEAR + 0.5]) expect(floor.heightAt(t2, vAt(depth)), `depth ${depth}`).toBeCloseTo(-12, 6);
    for (const depth of [C_STAIR_FAR + 1, 25, HOUSE_NEAR - 1, -40]) expect(floor.heightAt(t1, vAt(depth)), `depth ${depth}`).toBeCloseTo(KERB_H, 6);
    // The basin's water, over the whole band.
    for (const depth of [28, 10, 0, -30]) expect(floor.heightAt(C_BASIN[0] + 40, vAt(depth))).toBeCloseTo(G - C_BASIN_Y, 6);
    // The bridge's far side and its gallows stand on the stair and over the basin: no lift.
    expect(floor.liftAt(C_RAMP[1], C_DECK_DEPTH)).toBeCloseTo(0, 9);
    expect(floor.liftAt(C_RAMP[1] + 104, C_DECK_DEPTH)).toBeCloseTo(0, 9);
  });

  it('lays the bridge\'s deck and ramp from the sprite\'s deck line (its far side) to the platform line, for every camera', () => {
    const g = floor.groups.find((x) => x.def.name === 'white bridge deck');
    expect(g).toBeDefined();
    if (!g) return;
    const s = sAtDepth(cam, C_DECK_DEPTH);
    for (const camX of [2000, 2111.5, 2180.25, C_W - 384]) {
      floor.projectGroup(g, camX, 0);
      // The deck (face 0): far-left on the sprite's deck line (drawn at its depth's shift, unscaled, no lift) …
      expect(g.px[0]).toBeCloseTo(FLOOR_CX + (C_RAMP[1] - camX - FLOOR_CX) * s, 6);
      expect(g.py[0]).toBeCloseTo(C_DECK_Y - C_DECK_DEPTH, 6);
      expect(g.py[1]).toBeCloseTo(C_DECK_Y - C_DECK_DEPTH, 6);
      // … the near edge on the platform line (v = 0: the plain 2D world).
      expect(g.px[3]).toBeCloseTo(C_RAMP[1] - camX, 6);
      expect(g.py[3]).toBeCloseTo(C_DECK_Y, 6);
      expect(g.py[2]).toBeCloseTo(C_DECK_Y, 6);
      // The ramp (face 1): its near edge on the ramp's platform, from its foot up to the deck; its far end at the deck's.
      expect(g.px[4 + 3]).toBeCloseTo(C_RAMP[0] - camX, 6);
      expect(g.py[4 + 3]).toBeCloseTo(C_RAMP_FOOT_Y, 6);
      expect(g.px[4 + 2]).toBeCloseTo(C_RAMP[1] - camX, 6);
      expect(g.py[4 + 2]).toBeCloseTo(C_DECK_Y, 6);
      expect(g.px[4 + 1]).toBeCloseTo(g.px[0], 6);
      expect(g.py[4 + 1]).toBeCloseTo(g.py[0], 6);
      // Both are seen from above.
      expect(g.shown[0]).toBe(1);
      expect(g.shown[1]).toBe(1);
    }
  });

  it('makes the pontoon and the tour boat boxes: their tops and the ends that face the eye (the camera never passes the stair)', () => {
    const pont = floor.groups.find((x) => x.def.name === 'pontoon');
    const boat = floor.groups.find((x) => x.def.name === 'tour boat at the pontoon');
    expect(pont && boat).toBeTruthy();
    if (!pont || !boat) return;
    // The camera's right limit: the eye stays left of the basin, so the left ends and the tops show, the right ones never.
    for (const camX of [2100, C_W - 384]) {
      floor.projectGroup(pont, camX, 0);
      expect([...pont.shown]).toEqual([1, 0, 1]);
      floor.projectGroup(boat, camX, 0);
      expect([...boat.shown]).toEqual([1, 1, 1, 1]);
    }
    // The boat lies behind the pontoon: every corner of its faces at or behind its moored depth.
    for (const f of boat.def.faces) for (const p of f.pts) expect(p[2]).toBeGreaterThanOrEqual(C_TOUR_DEPTH - 1e-9);
    expect(boat.def.depth).toBe(C_TOUR_DEPTH);
  });
});

describe('section c: side faces and entity faces (spec §11 R1, §12.1 item 4)', () => {
  it('shows the shop quay\'s two row ends, the six houseboats\' ends, and the deck and roof tops', () => {
    const names = (def.faces ?? []).map((g) => g.name ?? '');
    // The row's first house (FIETSEN, 56 wide from 1400) and its last (BLOEMEN, 52 wide to 2436).
    expect(names).toContain('house side decor/ams/house-golden#12 @1429 L');
    expect(names).toContain('house side decor/ams/house-golden#9 @2411 R');
    for (const b of C_BOATS) expect(names).toContain(`houseboat @${b.x0}`);
    expect((def.tops ?? []).length).toBe(C_BOATS.length * 2);
  });

  it('lists the moving and breakable kinds c spawns (the crates, the herring cart, the market stall, the rowing boats, the scan car) and no other', () => {
    expect(Object.keys(def.entityFaces ?? {}).sort()).toEqual(['ams-boat-platform', 'ams-herring-cart', 'ams-market-stall', 'ams-scan-car', 'crate']);
  });

  it('keeps the front rows clear of the script\'s spots', () => {
    const fronts = (def.rows ?? []).filter((r) => r.depth < 0);
    for (const r of fronts) for (const u of r.at ?? []) for (const k of C_KEEP_CLEAR) expect(Math.abs(u - k), `${r.name} at ${u}: ${k}`).toBeGreaterThanOrEqual(24);
  });
});

/** The px the floor's entity pass draws for the entities `spawn` puts in a world on c's floor (no contact shadows). */
function entityFacePx(spawn: (w: World) => Entity[], camX: number, before?: (es: Entity[]) => void): { n: number; x0: number; x1: number } {
  const fl = new SectionFloor(sectionC, { ...def, shadow: 0 }, new Terrain(sectionC.terrain), 1, `c-test/faces/${camX}/`);
  const w = new World({ terrain: new Terrain(sectionC.terrain), seed: 1, factory: gameEntityFactory });
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
  let x0 = Infinity;
  let x1 = -Infinity;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if ((b.data[y * b.w + x] & 255) === 0) continue;
      n++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  return { n, x0, x1 };
}

describe('section c: the scan car and the ducks on the floor (spec §11 R1, §12.1 item 4, §12.2 c; render only)', () => {
  it('draws the scan car as a box: its tops and the end toward the screen\'s centre, mirrored with it; the wreck draws none', () => {
    const camX = 1984;
    const spawn = (facing: number) => (w: World): Entity[] => [w.spawn('ams-scan-car', 2280, 176, { facing, arenaLeft: 1984, arenaW: 384 })];
    for (const facing of [-1, 1]) {
      const whole = entityFacePx(spawn(facing), camX);
      expect(whole.n, `facing ${facing}`).toBeGreaterThan(400);
      // Right of the centre column: the end toward it (the left one) recedes left of the car's sprite.
      expect(whole.x0, `facing ${facing}`).toBeLessThan(2280 - 42 - camX);
      expect(whole.x1).toBeLessThan(2280 + 44 - camX);
      const wreck = entityFacePx(spawn(facing), camX, (es) => {
        (es[0] as AmsScanCar).wreckFrame = 2;
      });
      expect(wreck.n).toBe(0);
    }
  });

  it('lets the basin\'s ducks paddle in front of the pontoon (cosmetic: no hitbox they can be shot in, no damage)', () => {
    expect(def.entityDepth?.['ams-ducks']?.({} as Entity)).toBe(C_DUCK_DEPTH);
    expect(C_DUCK_DEPTH).toBeLessThan(0);
    const w = new World({ terrain: new Terrain(sectionC.terrain), seed: 1, factory: gameEntityFactory });
    const d = w.spawn('ams-ducks', C_BASIN[0] + 60, C_BASIN_Y, { count: 2, range: 40 });
    expect(d.tags.has('shootable')).toBe(false);
    expect(d.contactDamage).toBeFalsy();
  });
});
