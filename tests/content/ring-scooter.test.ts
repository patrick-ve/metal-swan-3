/**
 * The scooter gang (`ring-scooter`, docs/design/ring.md §5.1; GDD §4.11 fairness): registration, a
 * plain spawn that runs, the telegraphs (≥ 18 ticks, only on screen, every attack right after its
 * own tell, no shot from off screen, at most the token count at once), the bottle lob (1 cell in the
 * target lane), the pistol along the lane (½ cell), the side ram that knocks the riders off onto
 * the hard shoulder (bloodless), the gloat (a wheelie, no attack) and the cower.
 */
import { describe, expect, it } from 'vitest';
import { attackTokenLimit } from '../../src/game/enemy';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/ring/hazards/index';
import '../../src/game/content/ring/items/index';
import { RingBottle, RingScooter, SCOOTER_AI } from '../../src/game/content/ring/scooter/scooter';
import '../../src/game/content/ring/scooter/index';
import '../../src/game/content/ring/traffic/index';
import { PlaneTumbler } from '../../src/game/content/ring/traffic/road-kit';
import { laneY, SHOULDER_TOP } from '../../src/game/ring/lanes';
import { RingRig } from '../game/ring/ring-helpers';
import { TestWorld, watchFairness, type TestWorld as TW } from './helpers';

function rig(o: { god?: boolean } = {}): RingRig {
  const r = new RingRig({ god: o.god });
  r.run(2);
  return r;
}

/** The fairness watcher on a ring rig. */
function asTestWorld(r: RingRig): TW {
  return { world: r.world, run: (n = 1) => r.run(n) } as unknown as TW;
}

describe('ring-scooter', () => {
  it('is registered and runs 600 ticks from {} (ring and plain world)', () => {
    expect(hasEntity('ring-scooter')).toBe(true);
    const errors: unknown[] = [];
    const r = rig({ god: true });
    r.world.events.on('error', (e) => errors.push(e));
    r.spawnAt('ring-scooter', 300, laneY(2));
    r.spawnAt('ring-scooter', -40, laneY(3), { count: 4, gang: 2 });
    r.run(600);
    const tw = new TestWorld();
    tw.world.events.on('error', (e) => errors.push(e));
    tw.spawn('ring-scooter', 300);
    tw.run(600);
    expect(errors).toEqual([]);
    // A group entry spawned its followers.
    expect(r.world.entities.filter((e) => e.type === 'ring-scooter').length + 1).toBeGreaterThanOrEqual(2);
  });

  it('telegraphs every attack ≥ 18 ticks on screen; no shot from off screen; tokens hold', () => {
    const r = rig({ god: true });
    r.spawnAt('ring-scooter', -30, laneY(2), { count: 5, gang: 1 });
    r.spawnAt('ring-scooter', 420, laneY(3), { count: 3, gang: 2 });
    const w = watchFairness(asTestWorld(r), 1800, {
      attacks: { throw: 'tell-throw', shoot: 'tell-shoot' },
      tells: new Set(['tell-throw', 'tell-shoot']),
      watched: (e) => e instanceof RingScooter,
    });
    expect(w.attacks.length).toBeGreaterThan(2);
    for (const a of w.attacks) {
      expect(a.prev).toBe(a.mode === 'throw' ? 'tell-throw' : 'tell-shoot');
      expect(a.tell).toBeGreaterThanOrEqual(18);
      expect(a.tellInView).toBeGreaterThanOrEqual(18);
      expect(a.inView).toBe(true);
    }
    for (const t of w.tells) expect(t).toBeGreaterThanOrEqual(1);
    expect(w.outsideShots).toBe(0);
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(r.world));
  });

  it('a bottle smashes in its lane only: 1 cell to a wagon there', () => {
    const r = rig();
    const wg = r.wagon;
    r.until(() => wg.invulnTicks <= 0, 300);
    const lane = wg.laneTarget;
    // Thrown at the next lane: the wagon is untouched.
    r.world.add(new RingBottle(r.world, wg.x + 60, laneY(lane), { lift: 20, ty: laneY(lane - 1), vx: r.runner.roadSpeed - 1.5, ticks: 30, arc: 24 }));
    r.run(40);
    expect(wg.cells).toBe(wg.maxCells);
    r.world.add(new RingBottle(r.world, wg.x + 60, laneY(lane - 1), { lift: 20, ty: laneY(lane), vx: r.runner.roadSpeed - 2, ticks: 30, arc: 24 }));
    r.run(40);
    expect(wg.cells).toBe(wg.maxCells - 1);
  });

  it('the side ram knocks both riders off onto the hard shoulder (bloodless)', () => {
    const r = rig();
    const s = r.spawnAt<RingScooter>('ring-scooter', 260, laneY(2));
    r.run(2);
    const score = r.session.slots[0].score;
    r.world.damage(s, { amount: 120, kind: 'impact', dirX: 1, owner: 0, tags: ['ram', 'side-ram'] });
    expect(s.dead).toBe(true);
    expect(r.session.slots[0].score).toBe(score + SCOOTER_AI.score);
    r.world.flush();
    const fall = r.world.entities.filter((e) => e instanceof PlaneTumbler);
    expect(fall.length).toBe(3);
    r.run(70);
    const riders = r.world.entities.filter((e) => e instanceof PlaneTumbler && e.y > SHOULDER_TOP);
    expect(riders.length).toBeGreaterThanOrEqual(2);
  });

  it('two pistol shots knock it off (light), and its drop falls as a ring crate', () => {
    const r = rig();
    const s = r.spawnAt<RingScooter>('ring-scooter', 260, laneY(2), { drop: 'S' });
    r.run(1);
    r.world.damage(s, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(s.dead).toBe(false);
    r.world.damage(s, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(s.dead).toBe(true);
    r.world.flush();
    expect(r.world.byTag('ring-crate').length).toBe(1);
  });

  it('gloats with a wheelie and no attack while held; cowers when a hero lands', () => {
    const r = rig();
    const s = r.spawnAt<RingScooter>('ring-scooter', 260, laneY(2));
    r.run(5);
    expect(s.react('gloat', 300, null)).toBe(true);
    const tells: string[] = [];
    for (let i = 0; i < 200; i++) {
      r.run(1);
      if (s.mode.startsWith('tell')) tells.push(s.mode);
    }
    expect(tells).toEqual([]);
    expect(s.anim.id).toBe('ring/scooter/0/gloat');
    expect(s.react('cower', 60, null)).toBe(true);
    r.run(2);
    expect(s.anim.id).toBe('ring/scooter/0/cower');
    expect(s.facing).toBe(1);
  });
});
