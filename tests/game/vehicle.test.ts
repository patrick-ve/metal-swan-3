import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import type { World } from '../../src/engine/world';
import { Projectile } from '../../src/game/projectile';
import { defineEntity, type SpawnParams } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, Rig } from './helpers';

class TestTank extends Vehicle {
  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, {
      art: 'vehicle/test-tank',
      w: 36,
      h: 26,
      seat: { x: -10, y: -34, w: 20, h: 14 },
      seatPoint: [0, -20],
      mainGun: 'vulcan',
      cannon: 'cannon',
      speed: 1.6,
    });
  }
}
defineEntity('test-tank', (w, x, y, p) => new TestTank(w, x, y, p), { category: 'vehicle' });

function setup(): { rig: Rig; tank: TestTank } {
  const rig = new Rig({ x: 100 });
  const tank = rig.world.spawn('test-tank', 200, FLOOR) as TestTank;
  rig.world.flush();
  // Drop the player onto the seat.
  rig.p.placeAt(200, 120, 0);
  rig.p.y = 120;
  rig.p.body.onGround = false;
  rig.until(() => rig.p.state === 'mounted', 60);
  return { rig, tank };
}

function enemyShotAt(rig: Rig, x: number, y: number): void {
  Projectile.spawn(rig.world, { team: 'enemy', x: x + 40, y, vx: -4, vy: 0, damage: 10 });
}

describe('vehicles', () => {
  it('a player falling onto the seat climbs in', () => {
    const { rig, tank } = setup();
    expect(tank.driver).toBe(rig.p);
    expect(tank.state).toBe('driven');
    expect(tank.hasTag('shootable')).toBe(true);
    expect(rig.p.hasTag('shootable')).toBe(false);
    expect(rig.p.vehicle).toBe(tank);
  });

  it('drives with the stick and keeps the driver on the seat', () => {
    const { rig, tank } = setup();
    const x0 = tank.x;
    rig.hold(['right']).run(40);
    expect(tank.x - x0).toBeGreaterThan(40);
    expect(rig.p.x).toBeCloseTo(tank.x, 5);
    expect(rig.p.y).toBeCloseTo(tank.y - 20, 5);
  });

  it('fires its own main gun and cannon (shells are limited)', () => {
    const { rig, tank } = setup();
    let vulcan = 0;
    let shells = 0;
    rig.world.events.on('spawn', (e) => {
      if (e.type === 'vulcan') vulcan++;
      if (e.type === 'cannon') shells++;
    });
    rig.tap(['fire']).run(30);
    expect(vulcan).toBe(TUNING.weapons.vulcan.burst);
    const before = tank.shells;
    rig.tap(['bomb']).run(40);
    expect(shells).toBe(1);
    expect(tank.shells).toBe(before - 1);
    tank.shells = 0;
    rig.tap(['bomb']).run(40);
    expect(shells).toBe(1);
  });

  it('down + jump ejects with invulnerability; the vehicle stays', () => {
    const { rig, tank } = setup();
    rig.hold(['down', 'jump']).run(1).release();
    expect(rig.p.state).toBe('play');
    expect(rig.p.vy).toBeLessThan(0);
    expect(rig.p.invulnTicks).toBeGreaterThan(30);
    expect(tank.state).toBe('idle');
    expect(tank.driver).toBe(null);
    expect(tank.hasTag('shootable')).toBe(false);
    // No instant re-mount while falling back onto the seat.
    rig.run(10);
    expect(rig.p.state).toBe('play');
  });

  it('bullets cost half a cell, explosions a whole one, with i-frames in between (GDD §8.1)', () => {
    const { rig, tank } = setup();
    tank.invulnTicks = 0;
    enemyShotAt(rig, tank.x, tank.y - 10);
    rig.run(15);
    expect(tank.cells).toBe(TUNING.vehicle.cells - 0.5);
    enemyShotAt(rig, tank.x, tank.y - 10);
    rig.run(15);
    expect(tank.cells).toBe(TUNING.vehicle.cells - 0.5); // still invulnerable
    tank.invulnTicks = 0;
    rig.world.damage(tank, { amount: 30, kind: 'explosion', dirX: 1 });
    expect(tank.cells).toBe(TUNING.vehicle.cells - 1.5);
    tank.invulnTicks = 0;
    rig.world.damage(tank, { amount: 10, kind: 'bullet', dirX: 1, tags: ['heavy'] });
    expect(tank.cells).toBe(TUNING.vehicle.cells - 2.5);
  });

  it('at 0 cells the pilot has 60 ticks to jump out; then the wreck explodes', () => {
    const { rig, tank } = setup();
    tank.invulnTicks = 0;
    tank.cells = 1;
    let mode = '';
    let destroyed = false;
    rig.world.events.on('vehicleDestroyed', () => (destroyed = true));
    rig.world.events.on('vehicleEjected', (e) => (mode = e.mode));
    rig.world.damage(tank, { amount: 30, kind: 'explosion', dirX: 1 });
    expect(destroyed).toBe(true);
    expect(tank.state).toBe('doomed');
    expect(rig.p.state).toBe('mounted');
    rig.run(10);
    rig.tap(['jump']); // jumps out in time
    expect(mode).toBe('destroyed');
    expect(rig.p.state).toBe('play');
    expect(rig.p.invulnTicks).toBeGreaterThan(0);
    rig.until(() => tank.removed, TUNING.vehicle.ejectWindow + 5);
    expect(rig.p.state).toBe('play');
  });

  it('a pilot who stays in a doomed vehicle goes down with it (EASY: thrown out)', () => {
    const { rig, tank } = setup();
    tank.invulnTicks = 0;
    tank.cells = 0.5;
    rig.p.invulnTicks = 0;
    rig.world.damage(tank, { amount: 10, kind: 'bullet', dirX: 1 });
    rig.until(() => tank.removed, TUNING.vehicle.ejectWindow + 5);
    expect(rig.p.state).toBe('dead');

    const easy = setup();
    easy.rig.session.difficulty = 'easy';
    easy.tank.invulnTicks = 0;
    easy.tank.cells = 0.5;
    easy.rig.world.damage(easy.tank, { amount: 10, kind: 'bullet', dirX: 1 });
    easy.rig.until(() => easy.tank.removed, TUNING.vehicle.ejectWindow + 5);
    expect(easy.rig.p.state).toBe('play');
  });

  it('crushing destroys it at once: the pilot is thrown up hard', () => {
    const { rig, tank } = setup();
    rig.world.damage(tank, { amount: 1, kind: 'crush', dirX: 0 });
    expect(tank.state).toBe('wreck');
    expect(rig.p.state).toBe('play');
    expect(rig.p.vy).toBeCloseTo(TUNING.vehicle.crushEjectVy, 5);
  });

  it('fire + jump together: ram — the pilot pops out, the empty vehicle charges and explodes on the first enemy', () => {
    const { rig, tank } = setup();
    const target = rig.dummy(330, { soft: false, hp: 1000 });
    rig.hold(['fire', 'jump']).run(1).release();
    expect(rig.p.state).toBe('play');
    expect(rig.p.invulnTicks).toBeGreaterThanOrEqual(TUNING.vehicle.ramEjectInvulnTicks - 2);
    expect(tank.state).toBe('ram');
    rig.until(() => tank.removed, 200);
    expect(target.hits.some((h) => h.amount === TUNING.vehicle.ramDamage)).toBe(true);
  });

  it('a combo counts on the same tick or 1 tick apart: fire, then jump 1 tick later is a ram (the first shot stays)', () => {
    expect(TUNING.vehicle.comboWindow).toBe(1);
    const { rig, tank } = setup();
    let vulcan = 0;
    rig.world.events.on('spawn', (e) => {
      if (e.type === 'vulcan') vulcan++;
    });
    rig.hold(['fire']).run(1).release();
    expect(vulcan).toBeGreaterThan(0);
    rig.hold(['jump']).run(1).release();
    expect(tank.state).toBe('ram');
  });

  it('presses 2 ticks apart are no combo (GDD 4.1): a shot, then a hop', () => {
    const { rig, tank } = setup();
    rig.hold(['fire']).run(1).release().run(1);
    rig.hold(['jump']).run(1).release();
    expect(tank.state).toBe('driven');
    expect(rig.p.state).toBe('mounted');
    expect(tank.vy).toBeLessThan(0);
  });

  it('an empty vehicle shows RIDE? while a player on foot is near; not while driven', () => {
    const rig = new Rig({ x: 100 });
    const tank = rig.world.spawn('test-tank', 160, FLOOR) as TestTank;
    rig.world.flush();
    rig.run(31);
    expect(rig.hud.bubbles.some((b) => b.target === tank && b.text === 'RIDE?' && b.kind === 'hint')).toBe(true);
    rig.p.placeAt(160, 120, 0);
    rig.p.y = 120;
    rig.p.body.onGround = false;
    rig.until(() => rig.p.state === 'mounted', 60);
    expect(rig.hud.bubbles.some((b) => b.target === tank)).toBe(false);
  });

  it('a driven vehicle stays inside the view like a player (GDD 8.1)', () => {
    const { rig, tank } = setup();
    rig.world.camera.lock(0, 384);
    rig.hold(['right']).run(400);
    expect(tank.x).toBeLessThanOrEqual(rig.world.camera.right - 18 + 1e-6);
    rig.hold(['left']).run(500);
    expect(tank.x).toBeGreaterThanOrEqual(rig.world.camera.left + 18 - 1e-6);
  });

  it('fire + bomb together: the special (a weapon id), costing shells', async () => {
    const { defineWeapon } = await import('../../src/game/registry');
    let fired = 0;
    defineWeapon({ id: 'test-honk', name: 'HONK', kind: 'vehicle', ammo: Infinity, pose: 'heavy', cooldown: 60, auto: false, fire: () => fired++ });
    class HonkTank extends Vehicle {
      constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
        super(world, x, y, p, { art: 'vehicle/test-tank', w: 36, h: 26, seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20], special: 'test-honk', specialCost: 3 });
      }
    }
    defineEntity('test-honk-tank', (w, x, y, p) => new HonkTank(w, x, y, p), { category: 'vehicle' });
    const rig = new Rig({ x: 100 });
    const tank = rig.world.spawn('test-honk-tank', 200, FLOOR) as HonkTank;
    rig.world.flush();
    rig.p.placeAt(200, 120, 0);
    rig.p.y = 120;
    rig.p.body.onGround = false;
    rig.until(() => rig.p.state === 'mounted', 60);
    const shells = tank.shells;
    rig.hold(['fire', 'bomb']).run(1).release().run(2);
    expect(fired).toBe(1);
    expect(tank.shells).toBe(shells - 3);
    tank.shells = 2; // not enough for another one
    rig.run(70).hold(['fire', 'bomb']).run(1).release().run(2);
    expect(fired).toBe(1);
  });

  it('a player under a no-mount status cannot climb in; after an eject he must land first', () => {
    const { rig, tank } = setup();
    rig.hold(['down', 'jump']).run(1).release();
    expect(rig.p.state).toBe('play');
    rig.run(TUNING.vehicle.remountTicks + 2);
    rig.p.status.add({ id: 'test-float', ticks: 600, noMount: true });
    rig.until(() => rig.p.onGround, 120);
    rig.p.placeAt(tank.x, 120, 0);
    rig.p.y = 120;
    rig.p.body.onGround = false;
    rig.run(40);
    expect(rig.p.state).toBe('play');
  });

  it('collects pickups for its driver (bombs give shells)', async () => {
    const { bombsEffect, Pickup } = await import('../../src/game/pickup');
    const { rig, tank } = setup();
    const before = tank.shells;
    rig.world.add(new Pickup(rig.world, tank.x + 30, FLOOR, { sprite: 'item/test-bombs', effect: bombsEffect(5) }));
    rig.hold(['right']).run(40);
    expect(tank.shells).toBe(before + 5);
  });

  it('lava destroys a driven vehicle at once and throws the pilot up alive (GDD 8.1)', () => {
    const rig = new Rig({ x: 100, build: (t) => t.hazard('lava', 260, FLOOR - 4, 40, 4) });
    const tank = rig.world.spawn('test-tank', 200, FLOOR) as TestTank;
    rig.world.flush();
    rig.p.placeAt(200, 120, 0);
    rig.p.y = 120;
    rig.p.body.onGround = false;
    rig.until(() => rig.p.state === 'mounted', 60);
    expect(tank.state).toBe('driven');
    rig.hold(['right']).until(() => tank.state !== 'driven', 120);
    expect(tank.state).toBe('wreck');
    expect(tank.driver).toBe(null);
    expect(rig.p.alive).toBe(true);
    expect(rig.p.vy).toBeLessThan(-4);
    expect(rig.p.invulnTicks).toBeGreaterThan(30);
  });

  it('at 1 cell a driven vehicle beeps vehicle/warning every 60 ticks (GDD 8.1)', () => {
    const { rig, tank } = setup();
    const audio = rig.world.audio as NullAudio;
    const beeps = (): number => audio.log.filter((e) => e === 'sfx:vehicle/warning').length;
    rig.run(61);
    expect(beeps()).toBe(0);
    tank.cells = 1;
    rig.run(121);
    expect(beeps()).toBe(2);
  });
});
