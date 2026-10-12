import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { Grenade } from '../../src/game/grenade';
import type { Projectile } from '../../src/game/projectile';
import { defineWeapon, getWeapon, hasWeapon } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { shootBullet } from '../../src/game/weapons';
import { Dummy, FLOOR, Rig } from './helpers';

/** Count every projectile spawned of a type. */
function countSpawns(rig: Rig, type: string): { n: number; list: Entity[] } {
  const out = { n: 0, list: [] as Entity[] };
  rig.world.events.on('spawn', (e) => {
    if (e.type === type) {
      out.n++;
      out.list.push(e);
    }
  });
  return out;
}

const angleDeg = (p: Entity): number => (Math.atan2(p.vy, p.vx) * 180) / Math.PI;

describe('shooting', () => {
  it('a tap fires one pistol bullet from the muzzle, flying forward', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'pistol');
    rig.tap(['fire']);
    expect(shots.n).toBe(1);
    const b = shots.list[0] as Projectile;
    expect(b.team).toBe('player');
    expect(b.hasTag('shot')).toBe(true);
    expect(b.vx).toBeCloseTo(TUNING.weapons.pistol.speed, 5);
    expect(b.vy).toBe(0);
    expect(b.damage.owner).toBe(0);
  });

  it('respects the cooldown when fire is mashed', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'pistol');
    for (let i = 0; i < 20; i++) rig.tap(['fire']); // 40 ticks, a press every 2 ticks
    expect(shots.n).toBe(5); // ticks 0, 8, 16, 24, 32
  });

  it('repeats slower while fire is held (tap weapon)', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'pistol');
    rig.hold(['fire']).run(41);
    expect(shots.n).toBe(5); // 0, 10, 20, 30, 40
  });

  it('fires up when aiming up', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'pistol');
    rig.hold(['up']).run(1).tap(['fire']);
    expect(angleDeg(shots.list[0])).toBeCloseTo(-90, 5);
  });

  it('kills a soft enemy with one pistol bullet and scores', () => {
    const rig = new Rig();
    const d = rig.dummy(200);
    rig.hold(['fire']).run(30);
    expect(d.dead).toBe(true);
    expect(d.hits[0].kind).toBe('bullet');
    expect(rig.session.slots[0].score).toBe(100);
  });

  it('machine gun: 4-round burst per tap, ammo use, back to the pistol when empty', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'machine-gun');
    rig.p.giveWeapon('machine-gun', 6, false);
    expect(rig.p.weapon.id).toBe('machine-gun');
    expect(rig.session.slots[0].ammo).toBe(6);
    rig.tap(['fire']).run(20);
    expect(shots.n).toBe(4);
    expect(rig.session.slots[0].ammo).toBe(2);
    rig.hold(['fire']).run(20);
    expect(shots.n).toBe(6);
    expect(rig.p.weapon.id).toBe('pistol');
    expect(rig.session.slots[0].ammo).toBe(Infinity);
  });

  it('picking up the same weapon adds ammo; a different one replaces it', () => {
    const rig = new Rig();
    rig.p.giveWeapon('machine-gun', undefined, false);
    expect(rig.session.slots[0].ammo).toBe(TUNING.weapons.machineGun.ammo);
    rig.p.giveWeapon('machine-gun', undefined, false);
    expect(rig.session.slots[0].ammo).toBe(TUNING.weapons.machineGun.ammo + TUNING.weapons.machineGun.ammoAgain);
    rig.p.giveWeapon('pistol', undefined, false);
    expect(rig.session.slots[0].ammo).toBe(Infinity);
  });

  it('machine-gun sweep turns 22.5° per 2 ticks while firing; rounds in between fly diagonally (GDD 4.3)', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'machine-gun');
    rig.p.giveWeapon('machine-gun', 200, false);
    rig.hold(['fire']).run(12);
    const before = shots.n;
    rig.hold(['fire', 'up']);
    const elevs: number[] = [];
    for (let i = 0; i < 8; i++) {
      rig.run(1);
      elevs.push(Math.round((rig.p.elev * 180) / Math.PI * 10) / 10);
    }
    // One step every 2 ticks: forward → up takes 8 ticks.
    expect(elevs).toEqual([0, -22.5, -22.5, -45, -45, -67.5, -67.5, -90]);
    rig.run(16);
    const angles = shots.list.slice(before).map(angleDeg);
    const diagonal = angles.filter((a) => a < -1 && a > -89);
    expect(diagonal.length).toBeGreaterThan(0);
    for (const a of diagonal) expect(Math.abs((a / 22.5) - Math.round(a / 22.5))).toBeLessThan(0.01);
    expect(angles[angles.length - 1]).toBeCloseTo(-90, 3);
    // Releasing up sweeps back down through the in-between angles too.
    const mid = shots.n;
    rig.hold(['fire']).run(16);
    const back = shots.list.slice(mid).map(angleDeg);
    expect(back.some((a) => a < -1 && a > -89)).toBe(true);
    expect(back[back.length - 1]).toBeCloseTo(0, 3);
  });

  it('caps live projectiles per weapon', () => {
    const rig = new Rig();
    defineWeapon({
      id: 'test-slow',
      name: 'SLOW',
      ammo: Infinity,
      pose: 'pistol',
      cooldown: 1,
      auto: true,
      maxShotsOnScreen: 3,
      fire: (ctx) => shootBullet(ctx, { speed: 0.5, damage: 1, sprite: 'weapon/bullet', life: 200 }),
    });
    rig.p.giveWeapon('test-slow', undefined, false);
    rig.hold(['fire']).run(30);
    expect(rig.ofType('test-slow').length).toBe(3);
  });

  it('getWeapon falls back to the pistol for unknown ids', () => {
    expect(hasWeapon('no-such-gun')).toBe(false);
    expect(getWeapon('no-such-gun').id).toBe('pistol');
  });
});

describe('grenades', () => {
  it('arcs, bounces once, then explodes on the second ground contact', () => {
    const rig = new Rig();
    rig.tap(['bomb']);
    expect(rig.session.slots[0].bombs).toBe(TUNING.grenade.perLife - 1);
    const g = rig.ofType('grenade')[0] as Grenade;
    expect(g).toBeInstanceOf(Grenade);
    const x0 = g.x;
    let explosions = 0;
    let at = { x: 0, y: 0 };
    rig.world.events.on('explosion', (e) => {
      explosions++;
      at = { x: e.x, y: e.y };
    });
    let rose = false;
    let landedOnce = false;
    for (let i = 0; i < 120 && explosions === 0; i++) {
      const vy = g.vy;
      rig.run(1);
      if (vy > 0 && g.vy < 0) landedOnce = true; // the bounce
      if (g.vy < 0 && landedOnce) rose = true;
    }
    expect(landedOnce).toBe(true);
    expect(rose).toBe(true);
    expect(explosions).toBe(1);
    expect(at.x - x0).toBeGreaterThan(60);
    expect(at.x - x0).toBeLessThan(200);
    expect(at.y).toBeGreaterThan(FLOOR - 3);
  });

  it('a direct hit deals the big damage, the blast hurts soft enemies nearby', () => {
    const rig = new Rig();
    const near = rig.dummy(160, { hp: 500 });
    const close = rig.dummy(176, { hp: 500 });
    rig.tap(['bomb']).run(40);
    // GDD §6.1: the direct hit is an 'explosion' hit; the blast (100, r 24, no falloff) hits the rest once.
    expect(near.hits.length).toBe(1);
    expect(near.hits[0]).toEqual({ kind: 'explosion', amount: TUNING.grenade.direct });
    expect(close.hits).toEqual([{ kind: 'explosion', amount: TUNING.grenade.splash }]);
  });

  it('allows only two grenades in the air', () => {
    const rig = new Rig();
    for (let i = 0; i < 4; i++) rig.tap(['bomb']).run(TUNING.grenade.cooldown);
    expect(rig.ofType('grenade').length).toBe(2);
    expect(rig.session.slots[0].bombs).toBe(TUNING.grenade.perLife - 2);
  });

  it('does nothing without bombs', () => {
    const rig = new Rig();
    rig.session.slots[0].bombs = 0;
    rig.tap(['bomb']);
    expect(rig.ofType('grenade').length).toBe(0);
  });
});

describe('knife', () => {
  it('stabs a soft enemy in reach instead of shooting', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'pistol');
    const d: Dummy = rig.dummy(rig.p.x + 14);
    rig.tap(['fire']);
    expect(shots.n).toBe(0);
    expect(d.hits).toEqual([{ amount: TUNING.knife.damage, kind: 'knife' }]);
    expect(d.dead).toBe(true);
    // Knife kills score more.
    expect(rig.session.slots[0].score).toBe(100 * TUNING.score.knifeMultiplier);
    expect(rig.session.slots[0].stats.knifeKills).toBe(1);
  });

  it('shoots when the enemy is out of reach or not soft', () => {
    const rig = new Rig();
    const shots = countSpawns(rig, 'pistol');
    rig.dummy(rig.p.x + 60);
    rig.tap(['fire']);
    expect(shots.n).toBe(1);
    const rig2 = new Rig();
    const shots2 = countSpawns(rig2, 'pistol');
    rig2.dummy(rig2.p.x + 14, { soft: false });
    rig2.tap(['fire']);
    expect(shots2.n).toBe(1);
  });
});
