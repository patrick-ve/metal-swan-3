/**
 * The rideable beer bike `beer-bike` (docs/design/ams-extras.md §2.3): registration and numbers,
 * the pedal drive and the hop, the cork cannon's aim steps, the keg roll (shells, the floor, a
 * step down, the blast on an enemy and on its timer), the FOAM SPRAY (knock-back, erased shots,
 * cost and cooldown, the HUD's ready gem), the ram, the eject and the empty gag, cells, deep water,
 * the 2P perch on the bar counter, and the carry-over.
 */
import { describe, expect, it } from 'vitest';
import type { Damage, Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import { VirtualPad } from '../../src/engine/input';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/items/index';
import '../../src/game/content/stag/index';
import '../../src/game/content/vehicles/beer-bike/index';
import { BEER_BIKE, BeerBike, BIKE, RollingKeg } from '../../src/game/content/vehicles/beer-bike/index';
import { Enemy } from '../../src/game/enemy';
import { Player } from '../../src/game/player/player';
import { Projectile } from '../../src/game/projectile';
import { defineEntity, getEntityMeta, getWeapon, type SpawnParams } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { FLOOR, TestWorld, type TestWorldOptions } from './helpers';

/** A soft stand-in enemy that never attacks and records its hits. */
class Dummy extends Enemy {
  readonly hits: Damage[] = [];
  constructor(world: TestWorld['world'], x: number, y: number, params: SpawnParams = {}) {
    super(world, x, y, params, { art: 'enemy/test-dummy', hp: typeof params.hp === 'number' ? params.hp : 400, w: 14, h: 28, soft: true });
  }
  override onHit(d: Damage, part = 0): boolean {
    this.hits.push({ ...d });
    return super.onHit(d, part);
  }
}
defineEntity('beer-test-dummy', (w, x, y, p) => new Dummy(w, x, y, p), { category: 'enemy' });

/** A flat world with player 1 on a fresh beer bike at x (mount invulnerability cleared). */
function rig(o: { x?: number; params?: SpawnParams } & TestWorldOptions = {}) {
  const x = o.x ?? 200;
  const tw = new TestWorld({ god: false, width: 2000, ...o, playerX: x });
  const p = tw.player as Player;
  const v = tw.spawn('beer-bike', x, o.params ?? {}) as BeerBike;
  v.mount(p);
  v.invulnTicks = 0;
  tw.run(1);
  return { tw, p, v };
}

/** Press `buttons` for one tick (edges), then release for one tick. */
function tap(tw: TestWorld, ...buttons: Button[]): void {
  tw.hold(...buttons).run(1);
  tw.hold().run(1);
}

/** Entities of `type` spawned during `n` ticks while `hold` is held, with their tick (projectiles are pooled). */
function spawned(tw: TestWorld, type: string, n: number, hold: Button[]): Array<{ e: Entity; t: number }> {
  const out: Array<{ e: Entity; t: number }> = [];
  const off = tw.world.events.on('spawn', (e) => {
    if (e.type === type) out.push({ e, t: tw.world.tick });
  });
  tw.hold(...hold);
  try {
    tw.run(n);
  } finally {
    off?.();
  }
  return out;
}

describe('beer-bike: registration and numbers', () => {
  it('registers the vehicle, its two weapons and the keg', () => {
    expect(getEntityMeta('beer-bike')?.category).toBe('vehicle');
    expect(getEntityMeta('beer-keg')?.category).toBe('projectile');
    expect(getWeapon('beer-cork-cannon')).toMatchObject({ kind: 'vehicle', cooldown: 6, ammo: Infinity });
    expect(getWeapon('beer-keg-roll')).toMatchObject({ kind: 'vehicle' });
  });

  it('3 cells, 10 shells, name BIERFIETS; accelerates 0.08 to 1.4, brakes at 0.12, hops vy −2.6', () => {
    const { tw, v } = rig();
    expect([v.cells, v.shells, v.hudName]).toEqual([3, 10, 'BIERFIETS']);
    tw.hold('right').run(1);
    expect(v.vx).toBeCloseTo(0.08, 5);
    tw.run(30);
    expect(v.vx).toBeCloseTo(1.4, 5);
    tw.hold().run(1);
    expect(v.vx).toBeCloseTo(1.28, 5);
    tw.run(20);
    expect(v.vx).toBe(0);
    tw.hold('jump').run(1);
    expect(v.vy).toBeLessThan(0);
    let top = v.y;
    for (let i = 0; i < 40; i++) {
      tw.hold().run(1);
      top = Math.min(top, v.y);
    }
    // vy −2.6: a small hop (about 2.6² / 2g), back on the floor.
    expect(FLOOR - top).toBeGreaterThan(10);
    expect(FLOOR - top).toBeLessThan(26);
    expect(v.y).toBe(FLOOR);
  });

  it('no glide: holding jump in the air does not slow the fall', () => {
    const a = rig();
    const b = rig();
    a.tw.hold('jump').run(1);
    b.tw.hold('jump').run(1);
    a.tw.hold('jump').run(14);
    b.tw.hold().run(14);
    expect(a.v.y).toBeCloseTo(b.v.y, 5);
  });
});

describe('beer-bike: the cork cannon', () => {
  it('10 damage, speed 7, one cork every 6 ticks, unlimited', () => {
    const { tw, v } = rig();
    const s = spawned(tw, 'beer-cork', 61, ['fire']);
    expect(s.length).toBeGreaterThanOrEqual(10);
    const gaps = s.slice(1).map((x, i) => x.t - s[i].t);
    expect(Math.min(...gaps)).toBe(6);
    const c = s[0].e as Projectile;
    expect(c.damage.amount).toBe(BIKE.cannon.damage);
    expect(Math.hypot(c.vx, c.vy)).toBeCloseTo(7, 5);
    expect(c.vx).toBeGreaterThan(0);
    expect(v.shells).toBe(10);
  });

  it('aims in 22.5° steps, one step per 2 ticks: up → −90°, up + forward → −45°, released → 0°', () => {
    const { tw, v } = rig();
    tw.hold('up').run(1);
    expect(v.step).toBe(0);
    tw.run(1);
    expect(v.step).toBe(1);
    tw.run(6);
    expect(v.step).toBe(4);
    expect(v.aimElev).toBeCloseTo(-Math.PI / 2, 5);
    tw.hold('up', 'right').run(4);
    expect(v.step).toBe(2);
    expect(v.aimElev).toBeCloseTo(-Math.PI / 4, 5);
    tw.hold().run(4);
    expect(v.step).toBe(0);
    // Straight up: the cork flies up from the tap.
    tw.hold('up').run(10);
    const s = spawned(tw, 'beer-cork', 8, ['up', 'fire']);
    const c = s[0].e as Projectile;
    expect(c.vy).toBeCloseTo(-7, 3);
    expect(Math.abs(c.vx)).toBeLessThan(0.01);
  });
});

describe('beer-bike: the keg roll', () => {
  it('costs a shell; rolls 2.5 px/tick along the floor and bursts after 120 ticks (150 in r 24)', () => {
    const { tw, v } = rig({ x: 200 });
    tap(tw, 'bomb');
    expect(v.shells).toBe(9);
    const k = tw.ofType('beer-keg')[0] as RollingKeg;
    expect(k).toBeDefined();
    k.despawnMargin = Infinity; // 300 px of roll: past the view's despawn margin
    tw.run(10);
    expect(Math.abs(k.vx)).toBeCloseTo(BIKE.keg.speed, 5);
    expect(k.body?.onGround).toBe(true);
    // A dummy 18 px past the keg's last spot: out of touch (12 px), inside the blast (r 24).
    const dummy = tw.spawn('beer-test-dummy', k.x + BIKE.keg.speed * (BIKE.keg.life - k.t) + 18) as Dummy;
    tw.until(() => k.removed, 200);
    expect(k.t).toBe(BIKE.keg.life);
    expect(dummy.hits.some((h) => h.kind === 'explosion' && h.amount === BIKE.keg.damage)).toBe(true);
  });

  it('bursts on an enemy (150, credited to the pilot); +10 shells per bomb pickup', () => {
    const { tw, v } = rig({ x: 200 });
    const d = tw.spawn('beer-test-dummy', 330) as Dummy;
    tap(tw, 'bomb');
    const k = tw.ofType('beer-keg')[0] as RollingKeg;
    tw.until(() => k.removed, 100);
    expect(k.t).toBeLessThan(BIKE.keg.life);
    const h = d.hits.find((x) => x.kind === 'explosion');
    expect(h?.amount).toBe(150);
    expect(h?.owner).toBe(0);
    v.addShells(10);
    expect(v.shells).toBe(19);
  });

  it('drops down a step and rolls on', () => {
    const tw = new TestWorld({ god: false, width: 2000, playerX: 200, noFloor: true, build: (t) => t.ground().at(0, FLOOR - 20).flat(300).step(20).flat(1700) });
    const p = tw.player as Player;
    p.placeAt(200, FLOOR - 20, 0);
    const v = tw.spawn('beer-bike', 200, {}, FLOOR - 20) as BeerBike;
    v.mount(p);
    tw.run(5);
    tap(tw, 'bomb');
    const k = tw.ofType('beer-keg')[0] as RollingKeg;
    tw.until(() => k.x > 330, 100);
    tw.run(10);
    expect(k.removed).toBe(false);
    expect(k.y).toBe(FLOOR);
    expect(k.body?.onGround).toBe(true);
  });
});

describe('beer-bike: FOAM SPRAY (fire + bomb)', () => {
  it('knocks soft enemies in the 64 px cone back 12 px, erases enemy shots, costs 3 shells; cooldown 240', () => {
    const { tw, v } = rig({ x: 200 });
    expect(v.specialReady).toBe(true);
    const near = tw.spawn('beer-test-dummy', 200 + BEER_BIKE.foamStart[0] + 30) as Dummy;
    const far = tw.spawn('beer-test-dummy', 200 + BEER_BIKE.foamStart[0] + 120) as Dummy;
    const shot = tw.spawn('cork', 200 + BEER_BIKE.foamStart[0] + 40, { facing: -1 }, FLOOR + 5) as Projectile;
    const x0 = near.x;
    const f0 = far.x;
    tw.hold('fire', 'bomb').run(1);
    expect(near.x - x0).toBeCloseTo(BIKE.foam.push, 5);
    expect(far.x).toBe(f0);
    expect(shot.removed || shot.dead).toBe(true);
    expect(v.shells).toBe(7);
    expect(v.specialReady).toBe(false);
    // Shots that fly in during the next 16 ticks are erased too.
    tw.hold().run(4);
    const late = tw.spawn('cork', 200 + BEER_BIKE.foamStart[0] + 30, { facing: -1 }, FLOOR + 5) as Projectile;
    tw.run(2);
    expect(late.removed || late.dead).toBe(true);
    // Cooldown 240: nothing before it, again after it.
    tw.run(100);
    tap(tw, 'fire', 'bomb');
    expect(v.shells).toBe(7);
    tw.run(BIKE.foam.cooldown);
    expect(v.specialReady).toBe(true);
    tap(tw, 'fire', 'bomb');
    expect(v.shells).toBe(4);
  });

  it('with fewer than 3 shells: nothing happens, the gem stays dark', () => {
    const { tw, v } = rig();
    v.shells = 2;
    expect(v.specialReady).toBe(false);
    tap(tw, 'fire', 'bomb');
    expect(v.foamCool).toBe(0);
    expect(v.shells).toBe(2);
  });
});

describe('beer-bike: ram, eject, cells', () => {
  it('RAM (fire + jump): the pilot jumps off, the bike rolls on at 3.0 and crashes (400 in r 40); the bike is lost', () => {
    const { tw, p, v } = rig({ x: 200 });
    expect(TUNING.vehicle.comboWindow).toBe(1);
    tw.hold('fire').run(1);
    tw.hold('fire', 'jump').run(1);
    expect(v.state).toBe('ram');
    expect(p.vehicle).toBeNull();
    expect(p.vy).toBeLessThan(0);
    const d = tw.spawn('beer-test-dummy', 360, { hp: 1000 }) as Dummy;
    let maxVx = 0;
    while (!v.removed && tw.world.tick < 400) {
      tw.hold().run(1);
      maxVx = Math.max(maxVx, Math.abs(v.vx));
    }
    expect(v.removed).toBe(true);
    expect(maxVx).toBeCloseTo(BIKE.ram.speed, 5);
    expect(d.hits.some((h) => h.kind === 'explosion' && h.amount === 400)).toBe(true);
    expect(tw.ofType('beer-bike').length).toBe(0);
  });

  it('eject (down + jump) leaves it parked with its cells and shells; RIDE? and the empty bell', () => {
    const { tw, p, v } = rig();
    tap(tw, 'bomb');
    tw.hold('down').run(1);
    tw.hold('down', 'jump').run(1);
    expect(p.vehicle).toBeNull();
    expect(v.state).toBe('idle');
    expect(v.shells).toBe(9);
    let rings = 0;
    const orig = tw.world.audio.sfx.bind(tw.world.audio);
    tw.world.audio.sfx = ((id: string, o?: unknown) => {
      if (id === 'ams/beer-bell') rings++;
      return orig(id, o as never);
    }) as typeof tw.world.audio.sfx;
    tw.hold().run(600);
    expect(rings).toBeGreaterThan(0);
    expect(tw.hud.bubbles.some((b) => b.text === 'RIDE?')).toBe(true);
    // Mount again: cells and shells kept.
    p.placeAt(v.x + BEER_BIKE.driver[0], FLOOR, 0);
    v.mount(p);
    expect([v.cells, v.shells]).toEqual([3, 9]);
  });

  it('a bullet costs ½ cell, a blast 1; 0 cells → doomed, then it explodes; a jump saves the pilot', () => {
    const { tw, p, v } = rig();
    tw.world.damage(v, { amount: 10, kind: 'bullet', dirX: 1 });
    expect(v.cells).toBe(2.5);
    v.invulnTicks = 0;
    tw.world.damage(v, { amount: 50, kind: 'explosion', dirX: 1 });
    expect(v.cells).toBe(1.5);
    v.invulnTicks = 0;
    tw.world.damage(v, { amount: 50, kind: 'explosion', dirX: 1 });
    v.invulnTicks = 0;
    tw.world.damage(v, { amount: 50, kind: 'explosion', dirX: 1 });
    expect(v.state).toBe('doomed');
    tap(tw, 'jump');
    expect(p.vehicle).toBeNull();
    tw.run(90);
    expect(v.removed).toBe(true);
    expect(p.state).not.toBe('dead');
  });
});

describe('beer-bike: deep water', () => {
  /** Dry street 0–400, deep water 400–1000 (no floor under it), street again. */
  const canal = (): TestWorldOptions => ({
    noFloor: true,
    build: (t) => {
      t.ground().at(0, FLOOR).flat(400).gap(600).flat(1000);
      t.hazard('water', 400, FLOOR + 4, 600, 60);
    },
  });

  it('driven into deep water it is destroyed at once and the pilot is thrown up', () => {
    const { tw, p, v } = rig({ x: 300, ...canal() });
    let thrown = false;
    const gone = (): boolean => (v.state as string) === 'wreck' || v.removed;
    tw.hold('right');
    for (let i = 0; i < 300 && !gone(); i++) {
      tw.run(1);
      if (gone()) thrown = p.vehicle === null && p.vy < 0;
    }
    expect(gone()).toBe(true);
    expect(thrown).toBe(true);
    expect(v.x).toBeGreaterThan(400);
  });

  it('parked and pushed into deep water it sinks (explodes)', () => {
    const tw = new TestWorld({ god: false, width: 2000, playerX: 100, ...canal() });
    const v = tw.spawn('beer-bike', 500, {}, FLOOR) as BeerBike;
    tw.run(120);
    expect(v.removed || (v.state as string) === 'wreck').toBe(true);
  });
});

describe('beer-bike: the 2P perch', () => {
  it('player 2 stands on the bar counter (one-way) and rides along; the perch turns with the bike', () => {
    const { tw, v } = rig({ x: 200 });
    const p2 = new Player(tw.world, 0, 0, { pad: new VirtualPad(), index: 1 });
    tw.world.add(p2);
    tw.world.flush();
    p2.placeAt(200 - 15, FLOOR + BEER_BIKE.counter.top - 30, 0);
    p2.body.onGround = false;
    tw.run(40);
    expect(p2.y).toBeCloseTo(FLOOR + BEER_BIKE.counter.top, 0);
    expect(p2.body.onGround).toBe(true);
    const x0 = p2.x;
    const b0 = v.x;
    tw.hold('right').run(60);
    expect(v.x - b0).toBeGreaterThan(40);
    expect(p2.x - x0).toBeCloseTo(v.x - b0, 0);
    expect(p2.y).toBeCloseTo(FLOOR + BEER_BIKE.counter.top, 0);
    // From below it lets the partner through (one-way).
    expect(v.perch.oneWay).toBe(true);
    // Turned round, the counter is on the other side of the anchor.
    tw.hold('left').run(60);
    expect(v.facing).toBe(-1);
    expect(v.perch.x).toBeCloseTo(v.x - BEER_BIKE.counter.x1, 0);
  });
});

describe('beer-bike: carry-over', () => {
  it('toCarry() names the id; applyCarry() restores cells and shells', () => {
    const { tw, v } = rig();
    v.cells = 1.5;
    v.shells = 4;
    const c = v.toCarry();
    expect(c).toEqual({ id: 'beer-bike', cells: 1.5, shells: 4 });
    const w = tw.spawn(c.id, 400) as BeerBike;
    w.applyCarry(c);
    expect([w.cells, w.shells]).toEqual([1.5, 4]);
  });

  it('spawns and runs 600 ticks empty, driven and facing left without errors', () => {
    for (const params of [{}, { facing: -1 }, { facing: 'left' }]) {
      const tw = new TestWorld({ god: true, width: 2000, playerX: 100 });
      const v = tw.spawn('beer-bike', 260, params) as BeerBike;
      tw.run(300);
      v.mount(tw.player as Player);
      tw.hold('left', 'fire').run(150);
      tw.hold('right', 'bomb').run(150);
      expect(v.removed).toBe(false);
    }
  });
});
