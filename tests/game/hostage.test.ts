import { describe, expect, it } from 'vitest';
import { Hostage } from '../../src/game/hostage';
import { Pickup, bombsEffect, weaponEffect } from '../../src/game/pickup';
import { defineEntity, paramStr } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { FLOOR, Rig } from './helpers';

defineEntity('hostage', (w, x, y, p) => new Hostage(w, x, y, p), { category: 'hostage' });
defineEntity('test-bombs', (w, x, y, p) => new Pickup(w, x, y, { sprite: 'item/test-bombs', effect: bombsEffect(10), score: 500 }, p), {
  category: 'item',
});
defineEntity(
  'test-weapon',
  (w, x, y, p) => {
    const weapon = paramStr(p, 'weapon', 'machine-gun');
    return new Pickup(w, x, y, { sprite: `item/pickup-${weapon}`, effect: weaponEffect(weapon) }, p);
  },
  { category: 'item' },
);

function hostageAt(rig: Rig, x: number, item: unknown = 'test-bombs'): Hostage {
  const h = rig.world.spawn('hostage', x, FLOOR, { item }) as Hostage;
  rig.world.flush();
  return h;
}

describe('hostages', () => {
  it('a shot frees the hostage (+1 tally at once); it walks to its rescuer, hands over its item and runs off', () => {
    const rig = new Rig();
    const h = hostageAt(rig, 220);
    const events: string[] = [];
    rig.world.events.on('hostageFreed', () => events.push('freed'));
    rig.world.events.on('hostageRescued', (e) => events.push(`rescued:${e.slot}`));
    rig.tap(['fire']).run(16);
    expect(h.state).toBe('freed');
    expect(events).toEqual(['rescued:0', 'freed']);
    expect(rig.session.slots[0].rescued).toBe(1); // GDD §7.2: the tally counts on free
    expect(rig.session.slots[0].mission.hostagesFreed).toBe(1);
    rig.run(TUNING.hostage.freedTicks);
    expect(h.state).toBe('walk');
    // It walks over to the player (who stands still) and gives.
    const x0 = h.x;
    rig.until(() => h.state === 'give', 200);
    expect(h.x).toBeLessThan(x0);
    rig.run(TUNING.hostage.giveTicks + 1);
    expect(['run', 'bow']).toContain(h.state);
    expect(rig.session.slots[0].stats.hostages).toBe(1);
    // The item pops out right next to the player, who picks it up.
    rig.until(() => rig.session.slots[0].bombs === TUNING.grenade.perLife + 10, 120);
    expect(rig.ofType('test-bombs').length).toBe(0);
    // It runs off-screen and disappears.
    rig.until(() => h.removed, 600);
  });

  it('touching a tied hostage frees and tags it at once; the item can be collected', () => {
    const rig = new Rig();
    const h = hostageAt(rig, 140, { id: 'test-weapon', params: { weapon: 'machine-gun' } });
    rig.hold(['right']);
    rig.until(() => h.state !== 'tied', 60);
    rig.release();
    expect(h.state).toBe('freed');
    rig.until(() => rig.ofType('test-weapon').length === 1, TUNING.hostage.freedTicks + TUNING.hostage.giveTicks + 10);
    rig.until(() => rig.ofType('test-weapon').length === 0, 120);
    expect(rig.p.weapon.id).toBe('machine-gun');
    expect(rig.session.slots[0].rescued).toBe(1);
  });

  it('point blank: a shot frees a hostage (the knife only targets enemies); hostages are never hurt', () => {
    const rig = new Rig();
    const h = hostageAt(rig, rig.p.x + 14);
    rig.p.facing = 1;
    rig.p.invulnTicks = 0;
    rig.tap(['fire']).run(2);
    expect(h.state).toBe('freed');
    expect(h.dead).toBe(false);
    expect(h.hasTag('shootable')).toBe(false);
  });

  it('a player blast frees hostages; dying loses the rescued count', async () => {
    const { explosion } = await import('../../src/game/fx');
    const rig = new Rig();
    const h = hostageAt(rig, 600);
    explosion(rig.world, 600, FLOOR - 4, 'm', { damage: 50 });
    expect(h.state).toBe('freed');
    rig.session.slots[0].rescued = 3;
    rig.p.kill('impact');
    expect(rig.session.slots[0].rescued).toBe(0);
  });

  it('EASY: a death drops the tally back to the count stored at the last checkpoint', () => {
    const rig = new Rig();
    rig.session.difficulty = 'easy';
    const s = rig.session.slots[0];
    s.rescued = 2;
    s.checkpointRescued = 2;
    s.rescued = 5;
    rig.p.kill('impact');
    expect(s.rescued).toBe(2);
    expect(s.mission.hostagesLost).toBe(3);
  });
  it('2 players: freed by P2, it walks to P2; with P2 gone it walks to P1 instead', () => {
    const rig = new Rig({ players: 2, x: 100 });
    const h = hostageAt(rig, 300);
    h.free(1);
    expect(rig.session.slots[1].rescued).toBe(1);
    expect(rig.session.slots[0].rescued).toBe(0);
    rig.players[1].remove();
    rig.until(() => h.state === 'walk', 60);
    rig.run(5);
    expect(h.vx).toBeLessThan(0); // toward P1 at x 100
  });

  it('running off at the left end of the level: it fades out there, it never turns back', () => {
    const rig = new Rig({ x: 40 });
    const h = hostageAt(rig, 52);
    rig.until(() => h.state === 'run', 300);
    let maxX = h.x;
    rig.until(() => {
      maxX = Math.max(maxX, h.x);
      return h.removed;
    }, 200);
    expect(maxX).toBeLessThanOrEqual(60);
  });
});
