/**
 * Two players on the ring (docs/design/ring.md §9): P2 joins at any time and drives in from the
 * left in the green wagon with a driver of its own; the two wagons bump (a push, no damage); a lob
 * flies over the other wagon.
 */
import { describe, expect, it } from 'vitest';
import '../../../src/game/content/characters/art';
import { LOB } from '../../../src/game/content/ring/wagon/lob';
import { laneY } from '../../../src/game/ring/lanes';
import { RING } from '../../../src/game/ring/types';
import { WAGON_W } from '../../../src/game/ring/wagon';
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
