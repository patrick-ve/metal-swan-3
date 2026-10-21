/**
 * Road hazards of the ring (docs/design/ring.md §7): matrix gantries (faces), lane closures (armour,
 * a stop, a bounce to the open lane, cones), speed cameras (a fine only in the front third), the
 * average-speed zone (one fine at its end) and the jam controller (the road crawls, stops, clears).
 */
import { describe, expect, it } from 'vitest';
import { hasEntity } from '../../src/game/registry';
import { RingAvgZone, RingSpeedcam } from '../../src/game/content/ring/hazards/camera';
import { RingClosure } from '../../src/game/content/ring/hazards/closure';
import { gantryFaces, RingGantry } from '../../src/game/content/ring/hazards/gantry';
import '../../src/game/content/ring/hazards/index';
import { RingJam } from '../../src/game/content/ring/hazards/jam';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/scooter/index';
import '../../src/game/content/ring/traffic/index';
import { jamOf } from '../../src/game/content/ring/traffic/road-kit';
import { laneY } from '../../src/game/ring/lanes';
import { RING } from '../../src/game/ring/types';
import { RingRig } from '../game/ring/ring-helpers';
import { TestWorld } from './helpers';

const IDS = ['ring-gantry', 'ring-closure', 'ring-speedcam', 'ring-avgzone', 'ring-jam'];

function rig(): RingRig {
  const r = new RingRig();
  r.run(2);
  return r;
}

/** Hold the wagon at a screen x (it keeps its lane and its place on screen). */
function park(r: RingRig, sx: number): void {
  const w = r.wagon;
  w.x = r.world.camera.x + sx;
  w.sideV = 0;
}

describe('ring hazards', () => {
  it('are registered and run 600 ticks from a {} spawn without errors (ring and plain world)', () => {
    for (const id of IDS) expect(hasEntity(id), id).toBe(true);
    const r = rig();
    const errors: unknown[] = [];
    r.world.events.on('error', (e) => errors.push(e));
    for (const id of IDS) r.spawnAt(id, 300, laneY(3));
    r.run(600);
    const tw = new TestWorld();
    tw.world.events.on('error', (e) => errors.push(e));
    for (const id of IDS) tw.spawn(id, 300);
    tw.run(600);
    expect(errors).toEqual([]);
  });

  it('gantry faces: arrows toward the open lane, then the red X; limits; the jam shows 50', () => {
    expect(gantryFaces({})).toEqual(['100', '100', '100', '100']);
    expect(gantryFaces({ closed: [4], stage: 'warn' })).toEqual(['100', '100', '100', 'arrow-far']);
    expect(gantryFaces({ closed: [1], stage: 'warn', limit: 80 })).toEqual(['arrow-near', '80', '80', '80']);
    expect(gantryFaces({ closed: [3, 4], limit: 80 })).toEqual(['80', '80', 'x', 'x']);
    expect(gantryFaces({ jam: true })).toEqual(['50', '50', '50', '50']);
    expect(gantryFaces({ limit: 'end' })).toEqual(['end', 'end', 'end', 'end']);
    const r = rig();
    const g = r.spawnAt<RingGantry>('ring-gantry', 520, laneY(2), { closed: [4] });
    expect(g.lit).toBe(false);
    r.run(80);
    expect(g.lit).toBe(true);
  });

  it('a closure costs armour, stops the wagon a moment and bounces it to the open lane; cones fly', () => {
    const r = rig();
    const w = r.wagon;
    const lane = w.laneTarget;
    const c = r.spawnAt<RingClosure>('ring-closure', w.screenX + 80, laneY(lane));
    const open = c.openLane;
    r.until(() => w.cells < w.maxCells, 120);
    expect(w.maxCells - w.cells).toBe(2);
    expect(w.sideV).toBeLessThan(-1);
    r.run(30);
    expect(w.laneTarget).toBe(open);
    // A wagon that drives along the closed lane later knocks a cone (and pays for it).
    const r2 = rig();
    const w2 = r2.wagon;
    r2.until(() => w2.invulnTicks <= 0, 300);
    const c2 = r2.spawnAt<RingClosure>('ring-closure', w2.screenX - 140, laneY(w2.laneTarget), { length: 600 });
    r2.run(30);
    expect(c2.cones.some((k) => !k.up)).toBe(true);
    expect(w2.cells).toBeLessThan(w2.maxCells);
  });

  it('a speed camera fines only a wagon in the front third when it passes', () => {
    const r = rig();
    park(r, 290);
    const cam = r.spawnAt<RingSpeedcam>('ring-speedcam', 380, laneY(4));
    const fines: number[] = [];
    r.runner.events.on('fine', (e) => fines.push(e.slot));
    r.session.slots[0].addScore(2000);
    for (let i = 0; i < 80; i++) {
      park(r, 290);
      r.run(1);
    }
    expect(cam.fines).toBe(1);
    expect(fines).toEqual([0]);
    expect(r.session.slots[0].score).toBe(2000 - RING.finePoints);
    // In the rear two thirds: no fine.
    const r2 = rig();
    park(r2, 150);
    const cam2 = r2.spawnAt<RingSpeedcam>('ring-speedcam', 300, laneY(4));
    for (let i = 0; i < 120; i++) {
      park(r2, 150);
      r2.run(1);
    }
    expect(cam2.fines).toBe(0);
    // Never below 0.
    const r3 = rig();
    r3.spawnAt<RingSpeedcam>('ring-speedcam', 360, laneY(4));
    for (let i = 0; i < 60; i++) {
      park(r3, 300);
      r3.run(1);
    }
    expect(r3.session.slots[0].score).toBe(0);
  });

  it('the average-speed zone fines once at its end when the average is in the front third', () => {
    const r = rig();
    const z = r.spawnAt<RingAvgZone>('ring-avgzone', 330, laneY(4), { length: 400 });
    // In the zone: mostly at the front, a short stay at the back (the average still in front).
    for (let i = 0; i < 260; i++) {
      park(r, i % 10 < 8 ? 300 : 120);
      r.run(1);
    }
    expect(z.runs[0].state).toBe('done');
    expect(z.average(0)).toBeGreaterThan(256);
    expect(z.fines).toBe(1);
    const r2 = rig();
    const z2 = r2.spawnAt<RingAvgZone>('ring-avgzone', 330, laneY(4), { length: 400 });
    for (let i = 0; i < 260; i++) {
      park(r2, i % 10 < 3 ? 300 : 120);
      r2.run(1);
    }
    expect(z2.runs[0].state).toBe('done');
    expect(z2.fines).toBe(0);
  });

  it('the jam: 50 on the matrix, the road crawls and stops, then the speed comes back', () => {
    const r = rig();
    const jam = r.spawnAt<RingJam>('ring-jam', 420, laneY(2), { ticks: 120 });
    r.run(2);
    expect(r.world.byTag('ring-gantry').length).toBe(1);
    expect((r.world.byTag('ring-gantry')[0] as RingGantry).faces).toEqual(['50', '50', '50', '50']);
    r.until(() => jam.phase === 'hold', 600);
    expect(r.runner.roadSpeed).toBeLessThan(0.05);
    expect(jamOf(r.world).level).toBeGreaterThan(0.8);
    expect(jam.cars.length).toBeGreaterThan(0);
    r.until(() => !jam.alive || jam.removed, 600);
    expect(jamOf(r.world).level).toBe(0);
    r.run(120);
    expect(r.runner.roadSpeed).toBeGreaterThan(RING.cruiseSpeed - 0.2);
  });

  it("the plan's jam: crawls, stands its ticks at holdAt, crawls on, clears after its length", () => {
    const r = rig();
    const jam = r.spawnAt<RingJam>('ring-jam', -40, laneY(2), { length: 900, crawl: 1.2, hold: 150, holdAt: 300, seed: 7 });
    r.run(2);
    // The plan holds the 50 gantry and the queue: the controller adds neither.
    expect(r.world.byTag('ring-gantry').length).toBe(0);
    expect(jam.cars.length).toBe(0);
    r.run(90);
    expect(jam.phase).toBe('crawl');
    expect(r.runner.roadSpeed).toBeCloseTo(1.2, 1);
    r.until(() => jam.phase === 'hold', 600);
    r.run(60);
    expect(r.runner.roadSpeed).toBeLessThan(0.05);
    r.until(() => jam.phase === 'crawl', 300);
    r.until(() => jam.phase === 'clear' || !jam.alive, 900);
    r.until(() => !jam.alive, 300);
    r.run(90);
    expect(r.runner.roadSpeed).toBeGreaterThan(RING.cruiseSpeed - 0.2);
  });

  it("the plan's jam spawns its `after` wave when the stand ends (the EASY floor)", () => {
    const r = rig();
    const after = [
      { id: 'ring-scooter', from: 'behind', dx: 0, lane: 2, params: { side: 'behind', lead: true } },
      { id: 'ring-scooter', from: 'behind', dx: 44, lane: 3, params: { side: 'behind' } },
    ];
    const jam = r.spawnAt<RingJam>('ring-jam', -40, laneY(2), { length: 900, crawl: 1.2, hold: 150, holdAt: 300, seed: 7, after });
    r.until(() => jam.phase === 'hold', 600);
    const scooters = (): number => r.world.entities.filter((e) => e.type === 'ring-scooter' && !e.removed).length;
    expect(scooters()).toBe(0);
    r.until(() => jam.phase === 'crawl', 400);
    r.run(1);
    expect(scooters()).toBe(2);
  });

  it("a plan's closure without a truck has cones only; a plan's end entry of a zone is empty", () => {
    const r = rig();
    const c = r.spawnAt<RingClosure>('ring-closure', 300, laneY(3), { truck: false, length: 300 });
    expect(c.head).toBe(false);
    expect(c.cones.length).toBeGreaterThan(5);
    const end = r.spawnAt<RingAvgZone>('ring-avgzone', 300, laneY(4), { part: 'end', zone: 1 });
    r.run(2);
    expect(end.removed).toBe(true);
  });
});
