/**
 * Items and hostages of the ring (docs/design/ring.md §8): crates picked up by driving over them
 * (x and depth overlap only; shots pass them), their contents (weapons that work on the plane,
 * repair, the golden record) and the hostage flow (shoot the door open → the rescue counts → onto
 * the wagon's roof → a bow → the gift in the window → off).
 */
import { describe, expect, it } from 'vitest';
import { Projectile } from '../../src/game/projectile';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/items/index';
import { RingCrate, ringContents } from '../../src/game/content/ring/items/crate';
import { RingHostage } from '../../src/game/content/ring/items/hostage';
import '../../src/game/content/ring/items/index';
import type { RingCar } from '../../src/game/content/ring/traffic/car';
import '../../src/game/content/ring/traffic/index';
import { laneY } from '../../src/game/ring/lanes';
import { RingRig } from '../game/ring/ring-helpers';
import { TestWorld } from './helpers';

function rig(): RingRig {
  const r = new RingRig();
  r.run(2);
  return r;
}

describe('ring-crate', () => {
  it('is registered and runs 600 ticks from {} (ring and plain world)', () => {
    expect(hasEntity('ring-crate')).toBe(true);
    expect(hasEntity('ring-hostage')).toBe(true);
    const errors: unknown[] = [];
    const r = rig();
    r.world.events.on('error', (e) => errors.push(e));
    r.spawnAt('ring-crate', 300, laneY(1));
    r.spawnAt('ring-hostage', 300, laneY(2));
    r.run(600);
    const tw = new TestWorld();
    tw.world.events.on('error', (e) => errors.push(e));
    tw.spawn('ring-crate', 300);
    tw.spawn('ring-hostage', 400);
    tw.run(600);
    expect(errors).toEqual([]);
  });

  it('holds only weapons that work on the plane', () => {
    const tw = new TestWorld();
    expect(ringContents('F', tw.world)).toEqual({ id: 'pickup-weapon', params: { weapon: 'machine-gun' } });
    expect(ringContents('bounce-mine', tw.world).params?.weapon).toBe('machine-gun');
    expect(ringContents('S', tw.world).params?.weapon).toBe('shotgun');
    expect(ringContents('golden-record', tw.world)).toEqual({ id: 'pickup-gem', params: { kind: 'golden-record' } });
    for (let i = 0; i < 200; i++) {
      const s = ringContents(undefined, tw.world);
      if (s.id === 'pickup-weapon') expect(['machine-gun', 'shotgun', 'rocket-launcher', 'homing']).toContain(s.params?.weapon);
    }
  });

  it('is picked up only by a wagon driving over it (x and depth), never by shots', () => {
    const r = rig();
    const w = r.wagon;
    const lane = w.laneTarget;
    const mine = r.spawnAt<RingCrate>('ring-crate', w.screenX + 120, laneY(lane), { contains: 'S' });
    const next = r.spawnAt<RingCrate>('ring-crate', w.screenX + 120, laneY(lane - 1), { contains: 'repair' });
    // Shots through both crates do nothing to them.
    for (let i = 0; i < 4; i++) {
      Projectile.spawn(r.world, { team: 'player', x: w.x + 50, y: laneY(lane), vx: 6, vy: 0, damage: 10, owner: 0 });
      Projectile.spawn(r.world, { team: 'player', x: w.x + 50, y: laneY(lane - 1), vx: 6, vy: 0, damage: 10, owner: 0 });
      r.run(4);
    }
    expect(mine.alive).toBe(true);
    expect(next.alive).toBe(true);
    // Lying still on the road they drift back into the wagon: the one in its lane is taken.
    r.until(() => !mine.alive, 200);
    expect(r.session.slots[0].weapon).toBe('shotgun');
    expect(next.alive).toBe(true);
    r.run(80);
    expect(next.taken).toBe(false);
  });

  it('gives repair (+1 cell) and the golden record (the mission record)', () => {
    const r = rig();
    const w = r.wagon;
    w.cells = 5;
    r.spawnAt<RingCrate>('ring-crate', w.screenX + 70, laneY(w.laneTarget), { contains: 'repair' });
    r.until(() => w.cells > 5, 200);
    expect(w.cells).toBe(6);
    r.spawnAt<RingCrate>('ring-crate', w.screenX + 70, laneY(w.laneTarget), { kind: 'golden-record' });
    r.until(() => r.session.slots[0].mission.goldenRecord, 200);
    expect(r.session.slots[0].mission.goldenRecord).toBe(true);
  });
});

describe('ring-hostage', () => {
  it('a lone entry makes a hostage van that carries it', () => {
    const r = rig();
    const e = r.spawnAt('ring-hostage', 300, laneY(2));
    expect(e.type).toBe('ring-car');
    expect((e as RingCar).hostageVan).toBe(true);
    r.run(1);
    expect(r.world.byTag('ring-hostage').length).toBe(1);
  });

  it('shoot the door open: the rescue counts, it leaps onto the roof, bows, gives its gift, leaves', () => {
    const r = rig();
    const w = r.wagon;
    const lane = w.laneTarget;
    const van = r.spawnAt<RingCar>('ring-car', w.screenX + 170, laneY(lane), { hostage: true, rel: 0, item: 'S' });
    r.run(1);
    const h = r.world.byTag('ring-hostage')[0] as RingHostage;
    expect(h.state).toBe('tied');
    // Shots at the door (it is in front of the van's cover).
    let n = 0;
    while (h.state === 'tied' && n++ < 20) {
      Projectile.spawn(r.world, { team: 'player', x: w.x + 50, y: laneY(lane), vx: 6, vy: 0, damage: 10, owner: 0 });
      r.run(8);
    }
    expect(h.state).not.toBe('tied');
    expect(van.cage).toBe(-1);
    const slot = r.session.slots[0];
    expect(slot.mission.hostagesFreed).toBe(1);
    expect(slot.rescued).toBe(1);
    expect(r.runner.report().hostages).toBe(1);
    r.until(() => h.state === 'roof', 120);
    expect(h.ride).toBe(w);
    expect(Math.abs(h.x - w.x)).toBeLessThan(40);
    r.until(() => h.state === 'leave', 120);
    expect(slot.weapon).toBe('shotgun');
    r.until(() => h.removed, 700);
  });

  it('blasts open the door too, and hostages themselves are never hurt', () => {
    const r = rig();
    r.spawnAt<RingCar>('ring-car', 300, laneY(2), { hostage: true, rel: 0 });
    r.run(1);
    const h = r.world.byTag('ring-hostage')[0] as RingHostage;
    // An enemy-team blast does nothing (the door is on the enemy team, never a target of enemies).
    r.world.damageArea({ x: h.x - 40, y: h.y - 20, r: 60 }, { amount: 100, kind: 'explosion', dirX: 0 }, 'enemy');
    expect(h.state).toBe('tied');
    r.world.damageArea({ x: h.x - 20, y: h.y, r: 40 }, { amount: 100, kind: 'explosion', dirX: 0, owner: 0 }, 'player');
    expect(h.state).toBe('freed');
    expect(h.alive).toBe(true);
  });
});
