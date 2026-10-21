/**
 * Two players on the ring (docs/design/ring.md §9): P2 joins at any time and drives in from the
 * left in the green wagon with a driver of its own; the two wagons bump (a push, no damage); queued
 * in one lane at the band's left end both stay fully on screen and traffic is shoved ahead; a lob
 * flies over the other wagon.
 */
import { describe, expect, it } from 'vitest';
import '../../../src/game/content/characters/art';
import { LOB } from '../../../src/game/content/ring/wagon/lob';
import { RingCar } from '../../../src/game/content/ring/traffic/car';
import '../../../src/game/content/ring/traffic/index';
import { laneY } from '../../../src/game/ring/lanes';
import { RING } from '../../../src/game/ring/types';
import { QUEUE_GAP, WAGON_W, wagonBandEnd } from '../../../src/game/ring/wagon';
import { RingRig, TestTarget } from './ring-helpers';

describe('two players', () => {
  it('P2 joins: the green wagon drives in from the left with a driver nobody plays and not P1 driver', () => {
    const rig = new RingRig();
    rig.run(30);
    const d1 = rig.runner.drivers[0];
    const p2 = rig.runner.joinPlayer(1, 'thom');
    rig.world.flush();
    expect(p2.state).toBe('spawn');
    const w2 = p2.wagon!;
    expect(w2.livery).toBe('green');
    expect(w2.screenX).toBeLessThan(0);
    const d2 = rig.runner.drivers[1];
    expect(d2).not.toBeNull();
    expect(d2).not.toBe(d1);
    expect(['vincent', 'thom']).not.toContain(d2);
    expect(w2.driverId).toBe(d2);
    rig.until(() => p2.state === 'mounted', RING.driveInTicks + 5);
    expect(w2.screenX).toBeCloseTo(RING.startX[1], 0);
    expect(rig.hero.wagon!.livery).toBe('white');
  });

  it('two wagons in one lane bump apart: a push, no damage', () => {
    const rig = new RingRig({ players: 2 });
    rig.run(4);
    const a = rig.runner.player(0)!.wagon!;
    const b = rig.runner.player(1)!.wagon!;
    a.invulnTicks = b.invulnTicks = 0;
    // Put both in lane 3, overlapping.
    a.laneTarget = b.laneTarget = 3;
    a.y = b.y = laneY(3);
    b.x = a.x - 20;
    rig.run(3);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(WAGON_W - 4);
    expect(a.cells).toBe(RING.wagonCells);
    expect(b.cells).toBe(RING.wagonCells);
  });

  it('queued in one lane behind a slow car, both wagons stay fully on screen and the car is shoved ahead', () => {
    const rig = new RingRig({ players: 2 });
    rig.run(4);
    const a = rig.runner.player(0)!.wagon!;
    const b = rig.runner.player(1)!.wagon!;
    rig.until(() => !a.arriving && !b.arriving, RING.driveInTicks + 10);
    const cam = rig.world.camera;
    a.laneTarget = b.laneTarget = 3;
    a.y = b.y = laneY(3);
    a.x = cam.x + 220;
    b.x = cam.x + 120;
    // A slow car right ahead; P1's wagon keeps driving into it (the car pushes it back onto P2's).
    const car = rig.spawnAt<RingCar>('ring-car', 330, laneY(3), { model: 'estate', rel: -1.6 });
    rig.hold(['right']);
    let minRear = Infinity;
    for (let t = 0; t < 400; t++) {
      rig.run(1);
      for (const w of [a, b]) minRear = Math.min(minRear, w.screenX - WAGON_W / 2);
    }
    rig.release();
    // The rear wagon at the band's left end, the front one a queue gap ahead of it (its band end),
    // the car shoved ahead of the front one (wave B: a wagon at the band end shoves traffic).
    expect(minRear).toBeGreaterThanOrEqual(0);
    const [rear, front] = a.x < b.x ? [a, b] : [b, a];
    expect(rear.screenX).toBeGreaterThanOrEqual(RING.screenMinX - 0.01);
    expect(rear.screenX).toBeLessThan(RING.screenMinX + 3);
    // (The spacing settles a few px under the gap: the wagons update one after the other.)
    expect(front.x - rear.x).toBeGreaterThanOrEqual(QUEUE_GAP - 4);
    expect(front.x - rear.x).toBeLessThan(QUEUE_GAP + 8);
    expect(wagonBandEnd(front)).toBeGreaterThan(rear.x + QUEUE_GAP);
    // (P1 keeps driving into it: a few px of nose under its bumper between the shoves.)
    expect(car.x - car.geo.len / 2).toBeGreaterThan(front.x + WAGON_W / 2 - 8);
  });

  it('two wagons on the same x part (the lower slot in front), the one behind stops at the band end', () => {
    const rig = new RingRig({ players: 2 });
    rig.run(4);
    const a = rig.runner.player(0)!.wagon!;
    const b = rig.runner.player(1)!.wagon!;
    rig.until(() => !a.arriving && !b.arriving, RING.driveInTicks + 10);
    const cam = rig.world.camera;
    a.laneTarget = b.laneTarget = 2;
    a.y = b.y = laneY(2);
    a.x = b.x = cam.x + RING.screenMinX;
    rig.run(4);
    expect(a.x - b.x).toBeGreaterThanOrEqual(QUEUE_GAP - 4);
    expect(b.screenX).toBeGreaterThanOrEqual(RING.screenMinX - 0.01);
  });

  it('a lob flies over the other wagon and lands behind it in the aimed lane', () => {
    const rig = new RingRig({ players: 2 });
    rig.run(4);
    const p1 = rig.runner.player(0)!;
    const a = p1.wagon!;
    const b = rig.runner.player(1)!.wagon!;
    // P2 right in front of P1, in P1's lane; a target where the lob lands, past P2.
    b.laneTarget = a.laneTarget;
    b.y = a.y;
    b.x = a.x + WAGON_W + 4;
    const at = p1.x - rig.world.camera.x + 6 + LOB.ahead;
    const t = rig.spawnAt<TestTarget>('test-ring-target', Math.max(at, b.x - rig.world.camera.x + WAGON_W), a.y, { w: 120 });
    rig.tap(['bomb']);
    rig.run(LOB.ticks + 2);
    expect(b.cells).toBe(RING.wagonCells);
    expect(t.hits.some((d) => d.kind === 'explosion')).toBe(true);
  });
});
