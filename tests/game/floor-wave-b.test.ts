/**
 * The floor's wave-B base (docs/design/floor.md §12; CORE-B):
 * - ENTITY FACES (§12.1 item 4, docs/api/floor.md §8.2): a moving or breakable entity draws its sides
 *   and top itself, render only, on a floor that lists its kind (oz-a lists none: it stays as it was);
 *   only the side that faces the centre column shows, narrowing to nothing there; a broken one draws
 *   none; a mirrored boat takes the mirrored faces; the canvases are made at the section start (the
 *   frame path makes none), a still camera re-rasterises nothing, the faces sample without aliasing,
 *   the face pass allocates nothing; faces in front of the walk plane draw over the world;
 * - the KIT's wave-B materials (§4.1, §12.2): the new street kinds and `FloorArea`s in the painter,
 *   `pool`, `stepFeatures`, `riverSurface`, the lawn chains, `pontoonFaces`, the passage's tiles;
 * - the FOLDERS (§12.3): one per section with its switch (all off: their sections draw as before), and
 *   each start FloorDef already keeps the floor's rules;
 * - the BOAT-CARRIED CAMERA (c2): replayed on a floor, every flat row moves s(y)·Δ within 1/res along
 *   the cruise boat's real camera path (1/8-px speed steps, accelerating, braking, stopping).
 */
import { describe, expect, it } from 'vitest';
import { FLOOR_CX, FLOOR_YW, makeFloorCam, sOfY, vOfY } from '../../src/engine/floor/cam';
import { heightAt, profileAt } from '../../src/engine/floor/mesh';
import { QuadCanvas } from '../../src/engine/floor/quad';
import type { Entity } from '../../src/engine/entity';
import type { PixelBuffer } from '../../src/engine/pixel';
import { frameW, VIEW_W, type Renderer } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { loadContent } from '../../src/game/content/index';
import {
  AMS_CAMERA,
  amsEntityFaces,
  ensurePassageWallTile,
  lawnChainRow,
  lawnPostFrame,
  pontoonFaces,
  pool,
  riverSurface,
  stepFeatures,
  vAtAms,
  type AmsFacedKind,
  type StreetLayout,
} from '../../src/game/content/missions/ams/floor/index';
import { AMS_WAVE_B } from '../../src/game/content/missions/ams/floor/sections';
import { bFloorDef } from '../../src/game/content/missions/ams/floor/b/index';
import { cFloorDef } from '../../src/game/content/missions/ams/floor/c/index';
import { c1FloorDef } from '../../src/game/content/missions/ams/floor/c1/index';
import { c2FloorDef } from '../../src/game/content/missions/ams/floor/c2/index';
import { dFloorDef } from '../../src/game/content/missions/ams/floor/d/index';
import { bindWorldFloor, checkFloor, factorViolations, floorOf, frontRowViolations, walkLineErrors } from '../../src/game/mission/floor/index';
import { getFloorPainter, hasFloorTile, type FloorPaintCtx } from '../../src/game/mission/floor/registry';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import type { FloorDef } from '../../src/game/mission/floor/types';
import type { DecorDef, SectionDef } from '../../src/game/mission/types';
import { gameEntityFactory, getMission } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

await loadContent();
const ams = getMission('ams');
const sectionA = ams?.sections.a as SectionDef;
const sectionOzA = getMission('oldenzaal')?.sections['oz-a'] as SectionDef;
const G = 176;

const ALL: AmsFacedKind[] = ['crate', 'ams-bike-rack', 'ams-tulip-stall', 'ams-herring-cart', 'ams-market-stall', 'ams-boat-platform', 'ams-party-boat', 'ams-tour-boat', 'ams-cruise-boat', 'ams-magere-brug', 'ams-low-bridge'];

/** Section a's floor listing every ams kind (no shadows: a face pass draws only faces). */
function allFloor(extra: Partial<FloorDef> = {}, key = 'all'): SectionFloor {
  const def: FloorDef = { ...(sectionA.floor as FloorDef), entityFaces: amsEntityFaces(ALL, { lowBridge: { back: 30 }, magere: { back: 30 } }), shadow: 0, ...extra };
  return new SectionFloor(sectionA, def, new Terrain(sectionA.terrain), 1, `wave-b-test/${key}/`);
}

/** A world on section a's terrain bound to `floor`, with the game's entities. */
function worldOn(floor: SectionFloor | null, s: SectionDef = sectionA): World {
  const w = new World({ terrain: new Terrain(s.terrain), seed: 1, factory: gameEntityFactory });
  bindWorldFloor(w, floor);
  return w;
}

/** The back face pass (what `drawShadows` draws with no shadows) at camera camX on an empty renderer. */
function facePass(floor: SectionFloor, world: World, camX: number, res = 1): PixelBuffer {
  const r = new SoftRenderer(undefined, undefined, undefined, { res });
  r.begin(0);
  r.setCamera(camX, 0);
  floor.drawBand(r, 0, res);
  r.begin(0);
  r.setCamera(camX, 0);
  floor.drawBack(r, 0, res);
  r.begin(0);
  floor.drawShadows(r, world, res);
  r.end();
  return r.target;
}

/** The floor's entity-face internals the smoothness tests read. */
type FaceProbe = {
  entitySlots: Array<{ id: number; cv: QuadCanvas | null; px: Float64Array; py: Float64Array; shown: Uint8Array; lastSet: { n: number; du: Float64Array; dh: Float64Array; abs: Uint8Array; v: Float64Array } | null }>;
};

/**
 * The front edges of entity e's faces drawn this frame meet its sprite whose anchor lands at screen
 * (ax, ay): every corner on the sprite's plane (depth 0, sprite px) is projected exactly to the anchor +
 * its sprite px, on a canvas px boundary of a canvas whose grid is the sprite's (so the hard edge lands
 * on the sprite's own backbuffer column at every res that is a multiple of the canvas density).
 * Returns the corners checked.
 */
function frontLocked(F: FaceProbe, e: Entity, ax: number, ay: number, what: string): number {
  const slot = F.entitySlots.find((x) => x.id === e.id * 2);
  const set = slot?.lastSet;
  const cv = slot?.cv;
  if (!slot || !set || !cv || !cv.drawn) return 0;
  const d = cv.d;
  expect(Math.abs((ax - cv.ox) * d - Math.round((ax - cv.ox) * d)), `${what}: canvas grid x on the sprite`).toBeLessThan(1e-6);
  expect(Math.abs((ay - cv.oy) * d - Math.round((ay - cv.oy) * d)), `${what}: canvas grid y on the sprite`).toBeLessThan(1e-6);
  let n = 0;
  for (let f = 0; f < set.n; f++) {
    if (!slot.shown[f]) continue;
    for (let c = 0; c < 4; c++) {
      const k = f * 4 + c;
      if (set.abs[k] || set.v[k] !== 0) continue;
      // (A mirrored set's du is mirrored already.)
      expect(Math.abs(slot.px[k] - (ax + set.du[k])), `${what}: front corner x`).toBeLessThan(1e-6);
      expect(Math.abs(slot.py[k] - (ay - set.dh[k])), `${what}: front corner y`).toBeLessThan(1e-6);
      n++;
    }
  }
  return n;
}

/** Opaque px of a buffer (res 1) in [x0, x1) × [y0, y1). */
function opaque(b: PixelBuffer, x0: number, x1: number, y0: number, y1: number): number {
  let n = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(b.h, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(b.w, Math.ceil(x1)); x++) if ((b.data[y * b.w + x] & 255) > 0) n++;
  }
  return n;
}

describe('entity faces (spec §12.1 item 4): moving and breakable things draw their sides and tops themselves', () => {
  it('a floor opts in per kind: section a lists its kinds, a kind it does not list draws flat, oz-a lists none', () => {
    const a = checkFloor(sectionA) as SectionFloor;
    expect(a.hasEntityFaces('crate')).toBe(true);
    expect(a.hasEntityFaces('ams-bike-rack')).toBe(true);
    expect(a.hasEntityFaces('ams-boat-platform')).toBe(true);
    expect(a.hasEntityFaces('ams-market-stall')).toBe(false);
    const oz = checkFloor(sectionOzA) as SectionFloor;
    for (const k of ALL) expect(oz.hasEntityFaces(k), k).toBe(false);
    // A crate in oz-a: its face pass draws nothing (oz-a's frames stay as they were).
    const w = worldOn(oz, sectionOzA);
    w.spawn('crate', 400, G, {});
    w.flush();
    expect(opaque(facePass(oz, w, 400 - 192), 0, VIEW_W, 0, 216)).toBe(0);
    // Without a floor nothing calls the hook: the entity draws exactly as before.
    const plain = worldOn(null);
    const crate = plain.spawn('crate', 400, G, {});
    plain.flush();
    const r = new SoftRenderer();
    r.begin(0);
    r.setCamera(400 - 192, 0);
    crate.drawFloorFaces(r);
    expect(r.target.countOpaque()).toBe(0);
  });

  it('a crate shows its lid and the side that faces the centre column, narrowing to nothing at the centre', () => {
    const floor = allFloor();
    const w = worldOn(floor);
    const X = 600;
    w.spawn('crate', X, G, {});
    w.flush();
    // Left of the centre (screen x 100): its right side shows, beyond the sprite's right edge; nothing beyond its left edge.
    let b = facePass(floor, w, X - 100);
    expect(opaque(b, 100 + 12, 100 + 30, G - 30, G)).toBeGreaterThan(20);
    expect(opaque(b, 100 - 30, 100 - 12, G - 30, G)).toBe(0);
    // Its lid above the sprite's top edge.
    expect(opaque(b, 100 - 10, 100 + 10, G - 30, G - 20)).toBeGreaterThan(20);
    // Right of the centre: the left side.
    b = facePass(floor, w, X - 290);
    expect(opaque(b, 290 - 30, 290 - 12, G - 30, G)).toBeGreaterThan(20);
    expect(opaque(b, 290 + 12, 290 + 30, G - 30, G)).toBe(0);
    // At the centre: no side reaches past the sprite (a side narrows to nothing), the lid stays.
    b = facePass(floor, w, X - FLOOR_CX);
    expect(opaque(b, FLOOR_CX - 30, FLOOR_CX - 12.5, G - 22, G)).toBe(0);
    expect(opaque(b, FLOOR_CX + 12.5, FLOOR_CX + 30, G - 22, G)).toBe(0);
    expect(opaque(b, FLOOR_CX - 10, FLOOR_CX + 10, G - 30, G - 20)).toBeGreaterThan(20);
  });

  it('a broken breakable and a broken crate draw no faces; whole ones do', () => {
    const floor = allFloor();
    const w = worldOn(floor);
    const kinds = ['crate', 'ams-bike-rack', 'ams-tulip-stall', 'ams-herring-cart', 'ams-market-stall'];
    const es = kinds.map((k, i) => w.spawn(k, 300 + i * 70, G, {}));
    w.flush();
    for (let i = 0; i < kinds.length; i++) {
      const e = es[i] as Entity & { broken: boolean };
      for (const other of es) other.removed = other !== e;
      const cam = e.x - 100;
      const whole = opaque(facePass(floor, w, cam), 0, VIEW_W, 0, 216);
      expect(whole, `${kinds[i]} whole`).toBeGreaterThan(10);
      e.broken = true;
      expect(opaque(facePass(floor, w, cam), 0, VIEW_W, 0, 216), `${kinds[i]} broken`).toBe(0);
      e.broken = false;
      for (const other of es) other.removed = false;
    }
  });

  it('a boat sailing left takes the mirrored faces (its ends swap sides)', () => {
    const floor = allFloor();
    const w = worldOn(floor);
    const X = 700;
    const boat = w.spawn('ams-tour-boat', X, 182, { range: 0 });
    w.flush();
    // Left of the centre: its right end (the bow sailing right; the stern sailing left) shows; the deck and roof both ways.
    const cam = X - 120;
    const right = facePass(floor, w, cam);
    boat.facing = -1;
    const left = facePass(floor, w, cam);
    const endR = opaque(right, 120 + 50, 120 + 70, 150, 186);
    const endL = opaque(left, 120 + 50, 120 + 70, 150, 186);
    expect(endR).toBeGreaterThan(10);
    expect(endL).toBeGreaterThan(10);
    // The mirrored set: its stern end (at the right now) rakes the other way, and its tiles are the mirror's.
    expect(Buffer.from(left.data.buffer).equals(Buffer.from(right.data.buffer))).toBe(false);
    const all = (b: PixelBuffer): number => opaque(b, 0, VIEW_W, 0, 216);
    expect(Math.abs(all(left) - all(right)) / all(right)).toBeLessThan(0.15);
  });

  it('the canvases are made at the section start: drawing entities over a pan makes no canvas; a still camera re-rasterises nothing', () => {
    const floor = allFloor({}, 'pool');
    floor.prepare(0, 2);
    const made = floor.pool.made;
    const w = worldOn(floor);
    // Every kind at its planned count, spread over the section.
    let x = 260;
    for (const k of ALL) {
      w.spawn(k, x, k === 'ams-tour-boat' ? 182 : k === 'ams-magere-brug' || k === 'ams-low-bridge' ? 112 : k.includes('boat') ? 172 : G, { range: 0 });
      x += 150;
    }
    w.flush();
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
    let calls = 0;
    const proto = QuadCanvas.prototype as unknown as { quad: (...a: unknown[]) => void };
    const quad = proto.quad;
    proto.quad = function (this: QuadCanvas, ...a: unknown[]): void {
      calls++;
      quad.apply(this, a);
    };
    try {
      for (let cx = 0; cx < x; cx += 3.5) {
        r.begin(0);
        r.setCamera(cx, 0);
        floor.drawBand(r, 0, 2);
        floor.drawBack(r, 0, 2);
        floor.drawShadows(r, w, 2);
      }
      expect(floor.pool.made, 'canvases made while drawing').toBe(made);
      // A still camera: the same frame again rasterises no quad.
      r.setCamera(1400, 0);
      floor.drawBand(r, 0, 2);
      floor.drawBack(r, 0, 2);
      floor.drawShadows(r, w, 2);
      expect(floor.entityCanvases).toBeGreaterThan(0);
      const before = calls;
      floor.drawBand(r, 0, 2);
      floor.drawBack(r, 0, 2);
      floor.drawShadows(r, w, 2);
      expect(calls - before).toBe(0);
    } finally {
      proto.quad = quad;
    }
  });

  it('the faces sample their tiles without aliasing (the footprint left after the mip level ≤ 1.5) over a pan', () => {
    const floor = allFloor({}, 'residual');
    floor.prepare(0, 2);
    const w = worldOn(floor);
    for (const [k, xx, y] of [['crate', 500, G], ['ams-market-stall', 700, G], ['ams-tour-boat', 900, 182], ['ams-cruise-boat', 1100, G], ['ams-low-bridge', 1500, 112]] as const) w.spawn(k, xx, y, { range: 0 });
    w.flush();
    const r = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
    const slots = (floor as unknown as { entitySlots: Array<{ cv: QuadCanvas | null }> }).entitySlots;
    let worst = 0;
    let seen = 0;
    for (let cx = 100; cx < 1600; cx += 2.5) {
      r.begin(0);
      r.setCamera(cx, 0);
      floor.drawBand(r, 0, 2);
      floor.drawBack(r, 0, 2);
      floor.drawShadows(r, w, 2);
      for (const s of slots) {
        if (!s.cv) continue;
        seen++;
        worst = Math.max(worst, s.cv.residual);
      }
    }
    expect(seen).toBeGreaterThan(200);
    expect(worst).toBeLessThanOrEqual(1.5);
  });

  it('every kind, every state, both orientations: no aliasing (the residual footprint ≤ 1.5 against the true perspective) and the front edges locked to the sprite while the entity moves, at res 4 and 8', () => {
    const floor = allFloor({}, 'smooth');
    floor.prepare(1000, 2);
    const F = floor as unknown as FaceProbe;
    const kinds = Object.entries(floor.def.entityFaces ?? {});
    expect(kinds.map(([k]) => k).sort()).toEqual([...ALL].sort());
    let id = 1;
    let checked = 0;
    for (const [kind, ed] of kinds) {
      for (let state = 0; state < ed.states.length; state++) {
        if (ed.states[state].length === 0) continue;
        for (const flip of [false, true]) {
          const e = { type: kind, id: id++, x: 0, y: ed.y ?? G, drawDepth: 0, removed: false } as unknown as Entity & { x: number };
          const what = `${kind} state ${state}${flip ? ' flipped' : ''}`;
          // The residual over a camera sweep (the entity still), at res 2.
          const r2 = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
          let worst = 0;
          for (let camX = 600; camX < 1400; camX += 3.7) {
            e.x = 1192;
            r2.begin(0);
            r2.setCamera(camX, 0);
            floor.drawEntityFaces(r2, e, state, flip, 0, 0);
            const cv = F.entitySlots.find((x) => x.id === e.id * 2)?.cv;
            if (cv) worst = Math.max(worst, cv.residual);
          }
          expect(worst, `${what}: residual`).toBeLessThanOrEqual(1.5);
          // The entity moving 0.37 px a frame, left and right of the centre column, the camera still.
          for (const k of [4, 8]) {
            const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
            for (const off of [-140, 120]) {
              for (let t = 0; t < 30; t++) {
                e.x = 1000 + FLOOR_CX + off + t * 0.37;
                r.begin(0);
                r.setCamera(1000, 0);
                floor.drawEntityFaces(r, e, state, flip, 0, 0);
                checked += frontLocked(F, e, e.x - r.camX, e.y - r.camY, `${what} res ${k} x ${e.x.toFixed(2)}`);
              }
            }
          }
        }
      }
    }
    expect(checked, 'front corners checked').toBeGreaterThan(1000);
  }, 120_000);

  it('an entity drawn at a depth (a cosmetic actor) shows its faces there: the front edges on its sprite where drawAtDepth draws it, the faces receding from its depth, no aliasing', () => {
    const floor = allFloor({}, 'depth-faces');
    floor.prepare(1000, 2);
    const F = floor as unknown as FaceProbe;
    for (const [kind, y] of [['ams-tour-boat', 182], ['crate', G], ['ams-market-stall', G]] as const) {
      const e = { type: kind, id: 900 + kind.length, x: 0, y, drawDepth: 0, removed: false } as unknown as Entity & { x: number };
      for (const k of [2, 4, 8]) {
        const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
        for (const depth of [6, 14]) {
          e.drawDepth = depth;
          let worst = 0;
          let shown = 0;
          for (let t = 0; t < 40; t++) {
            const camX = 1000 + t * 0.29;
            e.x = 1000 + FLOOR_CX - 130 + t * 0.53;
            r.begin(0);
            r.setCamera(camX, 0);
            floor.drawEntityFaces(r, e, 0, false, 0, 0);
            // Where drawAtDepth puts the sprite: the depth's shift, speed and lift, its camera snapped by the renderer.
            const s0 = 1 - depth / (floor.cam.yw - floor.cam.yh);
            const sx = e.x - FLOOR_CX - (e.x - r.camX - FLOOR_CX) * s0;
            const sy = r.camY + depth + floor.liftAt(e.x, depth);
            r.setCamera(sx, sy);
            const ax = e.x - r.camX;
            const ay = e.y - r.camY;
            r.setCamera(camX, 0);
            shown += frontLocked(F, e, ax, ay, `${kind} at depth ${depth} res ${k} t ${t}`);
            const cv = F.entitySlots.find((x) => x.id === e.id * 2)?.cv;
            if (cv) worst = Math.max(worst, cv.residual);
          }
          expect(shown, `${kind} at depth ${depth}: front corners`).toBeGreaterThan(40);
          expect(worst, `${kind} at depth ${depth}: residual`).toBeLessThanOrEqual(1.5);
        }
      }
      // The faces recede from the entity's depth: the same entity at depth 14 draws them higher up (and
      // smaller) than at 0.
      const top = (depth: number): number => {
        e.drawDepth = depth;
        e.x = 1000 + FLOOR_CX - 130;
        const r = new SoftRenderer();
        r.begin(0);
        r.setCamera(1000, 0);
        floor.drawEntityFaces(r, e, 0, false, 0, 0);
        const b = r.target;
        for (let yy = 0; yy < b.h; yy++) for (let xx = 0; xx < b.w; xx++) if ((b.data[yy * b.w + xx] & 255) > 0) return yy;
        return -1;
      };
      expect(top(14), `${kind}: faces at depth 14 above those at 0`).toBeLessThan(top(0));
      e.drawDepth = 0;
    }
  });

  it('faces in front of the walk plane (a bridge spanning to the front) draw over the world, with the front decor', () => {
    const def = { entityFaces: amsEntityFaces(['ams-low-bridge'], { lowBridge: { back: 30, front: -30 } }), shadow: 0 };
    const floor = new SectionFloor(sectionA, { ...(sectionA.floor as FloorDef), ...def }, new Terrain(sectionA.terrain), 1, 'wave-b-test/front/');
    const w = worldOn(floor);
    w.spawn('ams-low-bridge', 700, 112, {});
    w.flush();
    const r = new SoftRenderer();
    r.begin(0);
    r.setCamera(700 - 140, 0);
    floor.drawBand(r, 0, 1);
    r.begin(0);
    floor.drawShadows(r, w, 1);
    const back = r.target.countOpaque();
    r.begin(0);
    floor.drawFront(r, 0, 1);
    // The front part covers rows below the walkway (it comes toward the camera), and it is drawn in the front pass.
    let front = 0;
    for (let y = 112; y < 216; y++) for (let xx = 0; xx < VIEW_W; xx++) if ((r.target.data[y * VIEW_W + xx] & 255) > 0) front++;
    expect(back).toBeGreaterThan(100);
    expect(front).toBeGreaterThan(100);
    // Gate 5 sees them (frontBoxes asks the live entities for their front faces).
    const boxes = floor.frontBoxes(700 - 140, 0, w).filter((b) => b.what.startsWith('faces of ams-low-bridge'));
    expect(boxes.length).toBe(1);
    expect(boxes[0].y1).toBeGreaterThan(176);
  });

  it('the face pass allocates nothing per frame (Hard Rule 7)', async () => {
    const { Session } = await import('node:inspector/promises');
    const floor = allFloor({}, 'alloc');
    floor.prepare(0, 2);
    for (let i = 0; i < floor.tileIds.length; i++) floor.store.tile(i, 2);
    const w = worldOn(floor);
    for (const [k, xx, y] of [['crate', 400, G], ['ams-herring-cart', 520, G], ['ams-boat-platform', 640, 172], ['ams-tour-boat', 800, 182], ['ams-magere-brug', 1000, 112]] as const) w.spawn(k, xx, y, { range: 0 });
    w.flush();
    // One drawn at a depth (a cosmetic actor: its faces by the sprite-px rule, per frame).
    (w.entities.find((e) => e.type === 'ams-tour-boat') as Entity).drawDepth = 9;
    const soft = new SoftRenderer(undefined, undefined, undefined, { res: 2 });
    const r = { res: 2, subpixel: 'all', camX: 0, camY: 0, frame() {}, sprite() {}, surface() {}, line() {}, rect() {}, image() {}, parallax() {} } as unknown as Renderer & { camX: number; camY: number };
    const pass = (x: number): void => {
      soft.setCamera(x, 0);
      r.camX = soft.camX;
      r.camY = soft.camY;
      floor.drawBand(r, 0, 2);
      floor.drawShadows(r, w, 2);
    };
    for (let rep = 0; rep < 4; rep++) for (let x = 200; x < 1100; x += 1.75) pass(x);
    type N = { selfSize: number; callFrame: { url: string; functionName: string }; children: N[] };
    let best = Infinity;
    let where: string[] = [];
    for (let attempt = 0; attempt < 3 && best / 600 >= 64; attempt++) {
      const ses = new Session();
      ses.connect();
      await ses.post('HeapProfiler.enable');
      await ses.post('HeapProfiler.startSampling', { samplingInterval: 1024 } as never);
      for (let i = 0; i < 600; i++) pass(200 + i * 1.5);
      const { profile } = (await ses.post('HeapProfiler.stopSampling')) as unknown as { profile: { head: N } };
      ses.disconnect();
      let bytes = 0;
      const at: string[] = [];
      const walk = (n: N): void => {
        if (n.selfSize > 0 && /\/floor\//.test(n.callFrame.url)) {
          bytes += n.selfSize;
          at.push(`${n.callFrame.functionName} ${n.selfSize}`);
        }
        for (const c of n.children) walk(c);
      };
      walk(profile.head);
      if (bytes < best) {
        best = bytes;
        where = at;
      }
    }
    expect(best / 600, `bytes per frame in the floor's code: ${where.join(', ')}`).toBeLessThan(64);
  }, 60_000);

  it('the rowing boat of section a draws its faces itself (no spawn-time decoration)', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, god: true, loadContent: false });
    try {
      g.step(2);
      const boat = g.runner?.world.entities.find((e) => e.type === 'ams-boat-platform');
      expect(boat).toBeTruthy();
      expect(Object.hasOwn(boat as object, 'draw')).toBe(false);
      expect(g.runner?.view.floor?.hasEntityFaces('ams-boat-platform')).toBe(true);
    } finally {
      g.dispose();
    }
  }, 60_000);
});

describe('entity depth steps (FloorDef.entityDepth, spec §3.7): render only, set before the shadow pass', () => {
  it("sets a listed kind's drawDepth every frame before the contact shadows (none at a depth); other kinds and other floors are untouched", () => {
    let depth = 9;
    const floor = allFloor({ shadow: 0.3, entityFaces: {}, entityDepth: { 'ams-staff': () => depth } }, 'depth');
    const w = worldOn(floor);
    const staff = w.spawn('ams-staff', 400, G, {}) as Entity;
    const baker = w.spawn('ams-baker', 470, G, {}) as Entity;
    w.flush();
    // The shadow ovals under the feet (no band, no decor: the shadow pass alone on an empty renderer).
    const ovals = (x: number): number => {
      const r = new SoftRenderer();
      r.begin(0);
      r.setCamera(400 - 192, 0);
      floor.drawShadows(r, w, 1);
      r.end();
      // The camera's left edge is at 208: an oval (≤ 40 px wide) under world x lies within screen x − 208 ± 20.
      return opaque(r.target, x - 228, x - 188, G - 4, G + 4);
    };
    expect(ovals(400), 'no shadow under the staff at a depth').toBe(0);
    expect(staff.drawDepth).toBe(9);
    expect(ovals(470), 'the baker (not listed) keeps his').toBeGreaterThan(0);
    expect(baker.drawDepth).toBe(0);
    depth = 0;
    expect(ovals(400), 'back in the walk plane: its shadow').toBeGreaterThan(0);
    expect(staff.drawDepth).toBe(0);
    // A floor that does not list the kind never writes it.
    const plain = allFloor({ shadow: 0.3, entityFaces: {} }, 'depth-none');
    const w2 = worldOn(plain);
    const s2 = w2.spawn('ams-staff', 400, G, {}) as Entity;
    w2.flush();
    s2.drawDepth = 0;
    const r = new SoftRenderer();
    r.begin(0);
    plain.drawShadows(r, w2, 1);
    expect(s2.drawDepth).toBe(0);
  });
});

/**
 * Can entity e be hit (a shootable with a hurtbox), hurt (contact damage with a box) or stop shots (a
 * dynamic solid)? The reason, or '' when it can do none of these (a cosmetic actor).
 */
function threat(e: Entity, w: World): string {
  const live = (bs: readonly { w: number; h: number }[]): boolean => bs.some((b) => b.w > 0 && b.h > 0);
  const why: string[] = [];
  if (e.tags.has('shootable') && live(e.hurtboxes())) why.push('can be hit');
  if (e.contactDamage !== null && live(e.contactBoxes())) why.push('can hurt');
  if (w.solids.some((b) => b.owner === e)) why.push('stops shots');
  return why.join(', ');
}

describe('§3.7 has no exceptions (§12.1 item 3): a bot run through every floor section, drawn every tick', () => {
  const runs: Array<[string, string, boolean]> = [];
  for (const m of ['ams', 'oldenzaal']) for (const sec of Object.values(getMission(m)?.sections ?? {})) if (floorOf(sec)) runs.push([m, sec.id, false]);
  // The boss's intro (MECHA HASLEMA walks out of the Stopera's doors): from the boss rush's start.
  runs.push(['ams', 'd', true]);
  for (const [m, id, boss] of runs) {
    it(`${m}/${id}${boss ? ' (boss rush)' : ''}: no entity that can be hit, can hurt or stops shots is drawn at a depth (drawDepth ≠ 0) in any tick`, async () => {
      const g = await createHeadlessGame({ missionId: m, sectionId: id, seed: 1, god: true, bot: true, bossRush: boss, loadContent: false });
      const r = new SoftRenderer();
      const bad = new Map<string, string>();
      let ticks = 0;
      try {
        for (let t = 0; t < (boss ? 1500 : 9000); t++) {
          g.step(1);
          const run = g.runner;
          if (!run || run.section.id !== id || !run.view.floor) break;
          // The floor's depth steps of this frame are set in its shadow pass (as the runner draws).
          r.begin(0);
          r.setCamera(run.world.camera.viewX, run.world.camera.viewY);
          run.view.drawShadows(r, run.world);
          ticks++;
          for (const e of run.world.entities) {
            if (e.removed || e.drawDepth === 0) continue;
            const why = threat(e, run.world);
            if (why && !bad.has(e.type)) bad.set(e.type, `${why} at depth ${e.drawDepth.toFixed(1)} (tick ${t})`);
          }
        }
      } finally {
        g.dispose();
      }
      expect(ticks, 'ticks run in the section').toBeGreaterThan(100);
      expect([...bad].map(([k, v]) => `${k}: ${v}`)).toEqual([]);
    }, 300_000);
  }
});

// ------------------------------------------------------------------------------- the kit

const cam = makeFloorCam({ ...AMS_CAMERA });

/** The `ams/floor` texel function of a layout at density d (the floor's height field ignored). */
function painter(layout: StreetLayout, d = 2): (u: number, v: number) => number {
  const ctx: FloorPaintCtx = { d, params: { layout }, seed: 3, cam, heightAt: () => 0, featureAt: () => -1, vAt: vAtAms, depthAt: (v) => -((cam.yw - cam.yh) * v) / (cam.f - v) };
  return getFloorPainter('ams/floor')(ctx);
}

const R = (c: number): number => c >>> 24;
const Gc = (c: number): number => (c >>> 16) & 255;
const B = (c: number): number => (c >>> 8) & 255;
/** The mean colour of the painter over a patch (u0…u1 at depth). */
function mean(p: (u: number, v: number) => number, u0: number, u1: number, depth: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let u = u0; u < u1; u += 0.37) {
    for (let k = -1; k <= 1; k++) {
      const c = p(u, vAtAms(depth + k));
      r += R(c);
      g += Gc(c);
      b += B(c);
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

const BASE: StreetLayout = {
  light: 'noon',
  far: 17,
  near: -12.3,
  street: [
    { u0: -1e9, kind: 'gravel' },
    { u0: 200, kind: 'grass' },
    { u0: 400, kind: 'stone' },
    { u0: 600, kind: 'planks' },
    { u0: 800, kind: 'tiles' },
    { u0: 1000, kind: 'klinkers' },
  ],
  crossings: [],
  quays: [],
  bridges: [],
  canals: [],
  bikes: { every: 0, phase: 0 },
};

describe('the wave-B kit materials (spec §4.1, §12.2)', () => {
  it('paints the new street kinds: gravel sandy, grass green, the Stopera\'s stone pale, planks wooden', () => {
    const p = painter(BASE);
    const [gr, , gb] = mean(p, 20, 180, 3);
    expect(gr).toBeGreaterThan(gb + 20);
    const [lr, lg, lb] = mean(p, 220, 380, 3);
    expect(lg).toBeGreaterThan(lr + 10);
    expect(lg).toBeGreaterThan(lb + 10);
    const [sr, sg, sb] = mean(p, 420, 580, 3);
    expect((sr + sg + sb) / 3).toBeGreaterThan(150);
    const [pr, , pb] = mean(p, 620, 780, 3);
    expect(pr).toBeGreaterThan(pb);
    // Pure: any order, the same colour.
    const a = p(450.3, vAtAms(2));
    p(1100, vAtAms(-5));
    p(10, vAtAms(20));
    expect(p(450.3, vAtAms(2))).toBe(a);
  });

  it('paints `FloorArea`s over the layout (later ones win), with a granite border inside an outline', () => {
    const plain = painter(BASE);
    const withAreas = painter({
      ...BASE,
      areas: [
        { u0: 100, u1: 300, far: 25, near: 5, kind: 'grass' },
        { u0: 150, u1: 250, far: 20, near: 10, kind: 'stone', edge: 2 },
      ],
    });
    // Outside every area: the layout as before.
    for (const [u, d] of [[50, 15], [350, 15], [120, 2], [200, -5]]) expect(withAreas(u, vAtAms(d))).toBe(plain(u, vAtAms(d)));
    // Inside the first only: grass; inside both: the later (stone); its border granite (grey).
    const [, g1] = mean(withAreas, 105, 145, 15);
    expect(g1).toBeGreaterThan(mean(withAreas, 105, 145, 15)[0] + 10);
    const [r2, g2, b2] = mean(withAreas, 170, 230, 15);
    expect((r2 + g2 + b2) / 3).toBeGreaterThan(150);
    const edge = withAreas(150.5, vAtAms(15));
    expect(Math.max(R(edge), Gc(edge), B(edge)) - Math.min(R(edge), Gc(edge), B(edge))).toBeLessThan(45);
  });

  it('a pool is a stone rim round a water cut behind the walk line; the walk line keeps the physics surface', () => {
    const pl = pool({ u0: 300, u1: 700, far: 24, near: 8, rim: 3, rimH: 1.2, level: -1.5, surface: riverSurface('noon') });
    expect(pl.features.map((f) => f.kind)).toEqual(['raise', 'cut']);
    expect(pl.area.kind).toBe('granite');
    const def: FloorDef = { ...(sectionA.floor as FloorDef), features: [...((sectionA.floor as FloorDef).features ?? []), ...pl.features] };
    expect(walkLineErrors(sectionA, def).slice(0, 3)).toEqual([]);
    const floor = new SectionFloor(sectionA, def, new Terrain(sectionA.terrain), 1, 'wave-b-test/pool/');
    const h0 = profileAt(floor.field, 500);
    expect(floor.heightAt(500, vAtAms(16)) - 0).toBeCloseTo(-1.5, 6);
    expect(floor.heightAt(500, vAtAms(24) + 1) - h0).toBeCloseTo(1.2, 6);
  });

  it('stepFeatures: a flight of treads falling from the top level to the foot', () => {
    const st = stepFeatures({ u0: 100, u1: 148, dir: 1, top: 0, bottom: -12, n: 3, from: 20, to: 8 });
    expect(st.length).toBe(3);
    expect(st.map((f) => f.level)).toEqual([-4, -8, -12]);
    expect(st.map((f) => f.u0)).toEqual([100, 116, 132]);
    expect(st.every((f) => f.kind === 'cut' && f.face === 'ams/step-face' && f.surface === 'ams/step-tread')).toBe(true);
    const down = stepFeatures({ u0: 100, u1: 148, dir: -1, top: 0, bottom: -12, n: 3 });
    expect(down.map((f) => f.u0)).toEqual([132, 116, 100]);
  });

  it('river water is animated, world-anchored, its crests in the light\'s sky', () => {
    const m = riverSurface('morning');
    const gd = riverSurface('golden');
    expect(typeof m).toBe('object');
    if (typeof m !== 'object' || typeof gd !== 'object') return;
    expect(m.du).not.toBe(0);
    expect(m.over?.alpha).toBeGreaterThan(0);
    expect(hasFloorTile(m.tile) && hasFloorTile(gd.tile) && hasFloorTile(m.over?.tile ?? '')).toBe(true);
    expect(m.tile).not.toBe(gd.tile);
  });

  it('the lawn chains make a low, thin front row that keeps the front-row rules', () => {
    const f = lawnPostFrame(1, 2);
    expect(frameW(f)).toBeLessThanOrEqual(8);
    expect(f.pts?.chain).toBeTruthy();
    const row = lawnChainRow({ depth: -20, u0: 900, u1: 1300 });
    expect(row.link).toBeTruthy();
    const def: FloorDef = { ...(sectionA.floor as FloorDef), rows: [row], keepClear: [] };
    expect(frontRowViolations(sectionA, def)).toEqual([]);
  });

  it('a pontoon is a box: its deck from the sprite back, its two ends to the water', () => {
    const g = pontoonFaces('pontoon', 2480, 128, 188, 192, 24);
    expect(g.faces.length).toBe(3);
    const top = g.faces[2];
    expect(top.tile).toBe('ams/pontoon-top');
    expect(top.pts.filter((p) => p[2] === 0).length).toBe(2);
    expect(hasFloorTile(ensurePassageWallTile(-1, 60, 40))).toBe(true);
    expect(hasFloorTile('ams/passage-ceiling')).toBe(true);
    expect(hasFloorTile('ams/rim-face') && hasFloorTile('ams/rim-inner')).toBe(true);
  });
});

// ------------------------------------------------------------------------------- the folders

describe('one folder per wave-B section (spec §12.3)', () => {
  const builders: Record<string, (d: readonly DecorDef[]) => FloorDef> = { b: bFloorDef, c: cFloorDef, c1: c1FloorDef, c2: c2FloorDef, d: dFloorDef };
  it('lists b, c, c1, c2 and d; a section draws its floor exactly when its switch is on', () => {
    expect(AMS_WAVE_B.map((s) => s.id)).toEqual(['b', 'c', 'c1', 'c2', 'd']);
    for (const s of AMS_WAVE_B) expect(!!floorOf(ams?.sections[s.id] as SectionDef), s.id).toBe(s.on);
  });
  for (const id of ['b', 'c', 'c1', 'c2', 'd']) {
    it(`${id}: its start FloorDef keeps the floor's rules (walk line, front rows, the factor rule)`, () => {
      const s = ams?.sections[id] as SectionDef;
      const def = builders[id](s.decor ?? []);
      expect(walkLineErrors(s, def).slice(0, 3)).toEqual([]);
      expect(frontRowViolations(s, def)).toEqual([]);
      expect(factorViolations(s, def)).toEqual([]);
      expect(checkFloor(s, def)).toBeTruthy();
    });
  }
});

// ------------------------------------------------------------------------------- the boat-carried camera

function lum(c: number): number {
  return ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
}

/** The sub-pixel shift k (output px) that best maps row A onto row B (floor-sections.test.ts). */
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

/** Band rows of the flat floor at camX (no kerb, step, cut or deck near the row across the view). */
function flatRows(floor: SectionFloor, camX: number, k: number): number[] {
  const c = floor.cam;
  const out: number[] = [];
  for (let j = 0; j < floor.bandH * k; j++) {
    const y = floor.bandTop + (j + 0.5) / k;
    if (y < c.back + 1.5 || y > 214) continue;
    let flat = true;
    for (const dy of [-2.5, 0, 2.5]) {
      const v = vOfY(c, Math.max(c.back + 0.01, y + dy));
      const half = (FLOOR_CX + 4) / sOfY(c, y + dy);
      for (let u = camX + FLOOR_CX - half; u <= camX + FLOOR_CX + half && flat; u += 6) {
        const h0 = profileAt(floor.field, u);
        if (!Number.isFinite(h0) || Math.abs(heightAt(floor.field, u, v) - h0) > 1e-6 || Math.abs(h0 - (c.yw - FLOOR_YW)) > 1e-6) flat = false;
      }
      if (!flat) break;
    }
    if (flat) out.push(j);
  }
  return out;
}

describe('the boat-carried camera (c2: the cruise boat holds the view)', () => {
  it('replayed on a floor, every flat row moves s(y)·Δ within 1/res along the real camera path (1/8-px steps, accelerating, braking)', async () => {
    // The real path: c2 with the bot, the view's x every tick from the boat's departure through its first stops.
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'c2', seed: 1, god: true, bot: { route: 'lower' }, loadContent: false });
    const path: number[] = [];
    try {
      for (let t = 0; t < 1400; t++) {
        g.step(1);
        const c = g.runner?.world.camera;
        if (c) path.push(c.viewX);
      }
    } finally {
      g.dispose();
    }
    const steps = path.slice(1).map((x, i) => x - path[i]);
    const moving = steps.filter((d) => d > 0);
    // It sails: speeds in 1/8-px steps up to 5/8, and it stops (and starts) again.
    expect(moving.length).toBeGreaterThan(300);
    expect(Math.max(...moving)).toBeCloseTo(0.625, 6);
    expect(new Set(moving.map((d) => Math.round(d * 8))).size).toBeGreaterThan(3);
    expect(steps.some((d, i) => d === 0 && i > 0 && steps[i - 1] > 0)).toBe(true);
    // Replay on section a's floor (a flat stretch: x0 + the path's offsets).
    const floor = new SectionFloor(sectionA, sectionA.floor as FloorDef, new Terrain(sectionA.terrain), 1, 'wave-b-test/boatcam/');
    const x0 = 3000 - (path[path.length - 1] - path[0]);
    for (const k of [1, 2]) {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      const bw = VIEW_W * k;
      let checked = 0;
      let prev: Uint32Array | null = null;
      let prevCam = 0;
      // Every 4th tick of the path (and the ticks around a stop), the band at tick 0 (still water).
      for (let t = 0; t < path.length; t += 3) {
        r.setCamera(x0 + path[t] - path[0], 0);
        floor.drawBand(r, 0, k);
        const cur = (floor.raster.band as PixelBuffer).data.slice();
        if (prev) {
          const delta = r.camX - prevCam;
          for (const j of flatRows(floor, r.camX, k).filter((_, i) => i % 3 === 0)) {
            const a = new Float64Array(bw);
            const b = new Float64Array(bw);
            let mn = 0;
            for (let i = 0; i < bw; i++) {
              a[i] = lum(prev[j * bw + i]);
              b[i] = lum(cur[j * bw + i]);
              mn += a[i];
            }
            mn /= bw;
            let vr = 0;
            for (let i = 0; i < bw; i++) vr += (a[i] - mn) ** 2;
            if (vr / bw < 20) continue;
            const y = floor.bandTop + (j + 0.5) / k;
            const want = -sOfY(floor.cam, y) * delta * k;
            const err = Math.abs(rowShift(a, b, Math.ceil(Math.abs(want)) + 3) - want) / k;
            checked++;
            expect(err, `res ${k} tick ${t} row y ${y.toFixed(2)} Δ ${delta}`).toBeLessThanOrEqual(1 / k);
          }
        }
        prev = cur;
        prevCam = r.camX;
      }
      expect(checked, `res ${k}: rows checked`).toBeGreaterThan(200);
    }
  }, 120_000);
});
