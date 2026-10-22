/**
 * The ZWAAN train's controller `ring-zwaan` (docs/design/ring.md §R.3; TRAIN-1, revision R wave A)
 * on a RingRig: the fixed order, one live part at a time, the next part spawns at its chain place
 * after the previous one is beaten, the visible catch-up (it surges ahead, then eases back to the
 * anchor in 130–180 ticks), the catch-up gang (2 / 2 / 3 scooters), the traffic while the plan is
 * locked (lanes 3–4 only), the pips counting down, the plan lock over the whole train, the uncouple
 * (the beaten steps), the drops, 'ringTrainDone' only after the cab, and determinism.
 */
import { describe, expect, it } from 'vitest';
import '../../src/game/content/ring/boss/index';
import '../../src/game/content/ring/boss/art';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/traffic/index';
import '../../src/game/content/ring/scooter/index';
import { RING_ZWAAN, RING_ZWAAN_ORDER, ZWAAN, ZWAAN_LOCK, RingZwaan, ZwaanPart } from '../../src/game/content/ring/zwaan/index';
import { ZWAAN_CATCH } from '../../src/game/content/ring/zwaan/controller';
import { laneY, nearestLane } from '../../src/game/ring/lanes';
import { RingRig, tinyPlan } from '../game/ring/ring-helpers';

/** A rig with a long plan and the train's controller spawned (small HP: the parts die quickly). */
function trainRig(params: Record<string, unknown> = {}, o: { players?: 1 | 2; difficulty?: 'easy' | 'normal' | 'hard' } = {}): { r: RingRig; z: RingZwaan } {
  const r = new RingRig({ god: true, plan: tinyPlan({ length: 60_000, difficulty: o.difficulty }), players: o.players });
  if (o.difficulty) r.session.difficulty = o.difficulty;
  r.run(2);
  const z = r.spawnAt<RingZwaan>(RING_ZWAAN.controller, 448, laneY(1), params);
  return { r, z };
}

/** Run until the active part fights, then kill it. Returns the killed part. */
function beatActive(r: RingRig, z: RingZwaan): ZwaanPart {
  r.until(() => z.phase === 'fight' && z.active?.state === 'fight', 900);
  const p = z.active!;
  p.kill(0);
  return p;
}

describe('ring-zwaan: the controller', () => {
  it('the parts come in the fixed order, one live at a time; the next spawns at its chain place after the previous is beaten', () => {
    const { r, z } = trainRig();
    const starts: string[] = [];
    r.world.events.on('ringTrainPart', (e) => {
      if (e.phase === 'start') starts.push(e.part);
    });
    expect(z.order).toEqual([...RING_ZWAAN_ORDER]);
    let maxLive = 0;
    for (let i = 0; i < RING_ZWAAN_ORDER.length; i++) {
      r.until(() => z.phase === 'fight' && z.active?.state === 'fight', 900);
      const p = z.active!;
      expect(p.type).toBe(RING_ZWAAN_ORDER[i]);
      expect(p.index).toBe(i);
      for (let t = 0; t < 30; t++) {
        r.run(1);
        maxLive = Math.max(maxLive, r.world.byTag('ring-zwaan-part').filter((e) => e.alive && !(e as ZwaanPart).beaten).length);
      }
      const front = p.x + p.length;
      p.kill(0);
      if (i + 1 < RING_ZWAAN_ORDER.length) {
        // The next part takes its place in the chain at once (the waiting look → the live part).
        r.world.flush();
        const next = z.active!;
        expect(next).not.toBe(p);
        expect(next.type).toBe(RING_ZWAAN_ORDER[i + 1]);
        expect(next.x).toBeCloseTo(front + ZWAAN.coupling, 0);
        expect(next.state === 'intro' || next.state === 'waiting').toBe(true);
        expect(p.beaten).toBe('uncouple');
      }
    }
    expect(starts).toEqual([...RING_ZWAAN_ORDER]);
    expect(maxLive).toBe(1);
  }, 30_000);

  it('the catch-up: the train surges ahead, then eases back to the anchor in 130–180 ticks; the part waits invulnerable', () => {
    const { r, z } = trainRig({ adds: false, traffic: false });
    beatActive(r, z);
    const next = z.active!;
    expect(z.phase).toBe('catchup');
    const from = next.screenX;
    let maxSx = -Infinity;
    let ticks = 0;
    while (z.phase === 'catchup' && ticks < 400) {
      r.run(1);
      ticks++;
      maxSx = Math.max(maxSx, z.anchorScreenX);
      // Invulnerable while it catches up (its intro).
      expect(next.state === 'intro' || next.state === 'waiting').toBe(true);
    }
    expect(ticks).toBeGreaterThanOrEqual(ZWAAN.catchUp.min);
    expect(ticks).toBeLessThanOrEqual(ZWAAN.catchUp.max + 1);
    expect(maxSx).toBeGreaterThan(from + 4);
    expect(maxSx).toBeLessThanOrEqual(from + ZWAAN_CATCH.surge + 1);
    expect(z.catchUps.length).toBe(1);
    r.until(() => next.state === 'fight', 60);
    expect(Math.abs(next.screenX - ZWAAN.anchorX)).toBeLessThanOrEqual(ZWAAN.drift + 6);
  });

  it('a catch-up sends its gang (2 on normal, 3 on hard): scooters from behind in the near lanes', () => {
    for (const [diff, n] of [['normal', 2], ['hard', 3]] as const) {
      const { r, z } = trainRig({ traffic: false }, { difficulty: diff });
      beatActive(r, z);
      expect(z.addsSent).toBe(n);
      r.world.flush();
      const sc = r.world.byTag('ring-scooter').filter((e) => e.alive);
      expect(sc.length).toBe(n);
      for (const s of sc) {
        expect(s.x).toBeLessThan(r.world.camera.x);
        expect([3, 4]).toContain(nearestLane(s.y));
      }
    }
  });

  it('the traffic while the train holds the plan: civilians in lanes 3–4 only; none with traffic: false', () => {
    const { r, z } = trainRig({ adds: false });
    r.until(() => z.phase === 'fight', 900);
    const lanes = new Set<number>();
    r.world.events.on('spawn', (e) => {
      if (e.type === 'ring-car') lanes.add(nearestLane(e.y));
    });
    r.run(1600);
    expect(z.carsSent).toBeGreaterThanOrEqual(2);
    for (const l of lanes) expect(l).toBeGreaterThanOrEqual(3);
    const q = trainRig({ adds: false, traffic: false });
    q.r.run(1600);
    expect(q.z.carsSent).toBe(0);
  });

  it('the pips count down, the plan stays locked over the whole train, a beaten part drops a crate, ringTrainDone only after the cab', () => {
    const { r, z } = trainRig({ adds: false, traffic: false });
    let done = 0;
    let parts = 0;
    r.world.events.on('ringTrainDone', () => done++);
    r.world.events.on('bossDefeated', (e) => {
      if (e.boss instanceof ZwaanPart) parts++;
    });
    const pips: number[] = [];
    const crates0 = r.world.byTag('ring-crate').length;
    for (let i = 0; i < RING_ZWAAN_ORDER.length; i++) {
      r.until(() => z.phase === 'fight' && z.active?.state === 'fight', 900);
      pips.push(z.active!.barPips!.left);
      expect(r.runner.planLocked).toBe(true);
      expect(done).toBe(0);
      const p = z.active!;
      p.kill(0);
      if (i + 1 < RING_ZWAAN_ORDER.length) r.until(() => p.dropped !== null, 300);
    }
    expect(pips).toEqual([5, 4, 3, 2, 1]);
    expect(done).toBe(1);
    expect(z.removed || z.phase === 'done').toBe(true);
    r.run(2);
    expect(r.runner.planLocked).toBe(false);
    r.run(400);
    expect(parts).toBeGreaterThanOrEqual(RING_ZWAAN_ORDER.length - 1);
    expect(r.world.byTag('ring-crate').length + 0).toBeGreaterThanOrEqual(crates0);
  }, 30_000);

  it('the uncouple: a beaten part goes uncouple → brake → swerve → tip → wreck, drops back off the left edge and is removed', () => {
    const { r, z } = trainRig({ adds: false, traffic: false });
    const p = beatActive(r, z);
    const seen: string[] = [];
    for (let t = 0; t < 900 && !p.removed; t++) {
      r.run(1);
      if (p.beaten && seen[seen.length - 1] !== p.beaten) seen.push(p.beaten);
    }
    expect(seen).toEqual(['uncouple', 'brake', 'swerve', 'tip', 'wreck']);
    expect(p.removed).toBe(true);
    expect(p.dropped).not.toBeNull();
  });

  it('the waiting parts are drawn in front of the active one (decor; the chain front lies beyond its front)', () => {
    const { r, z } = trainRig({ adds: false, traffic: false });
    r.until(() => z.phase === 'fight', 900);
    const a = z.active!;
    expect(z.chainFront()).toBeGreaterThan(a.x + a.length + 100);
    expect(z.hurtboxes().length).toBe(0);
  });

  it('is deterministic: the same seed gives the same parts, catch-ups and traffic', () => {
    const run = (): string => {
      const { r, z } = trainRig();
      const log: string[] = [];
      r.world.events.on('ringTrainPart', (e) => log.push(`${e.part}:${e.phase}:${r.runner.ticks}`));
      r.world.events.on('spawn', (e) => {
        if (e.type === 'ring-car' || e.type === 'ring-scooter') log.push(`${e.type}@${Math.round(e.x)},${Math.round(e.y)}`);
      });
      for (let i = 0; i < 3; i++) {
        r.until(() => z.phase === 'fight' && z.active?.state === 'fight', 900);
        r.run(200);
        z.active!.kill(0);
      }
      r.run(300);
      return log.join('|');
    };
    expect(run()).toBe(run());
  });

  it('holds its lock key while it runs (ZWAAN_LOCK) and lets go when removed', () => {
    const { r, z } = trainRig({ adds: false, traffic: false });
    r.until(() => z.phase === 'fight', 900);
    expect(r.runner.planLocked).toBe(true);
    z.remove();
    r.run(1);
    expect(r.runner.planLocked).toBe(false);
    expect(ZWAAN_LOCK).toBe(RING_ZWAAN.controller);
  });
});
