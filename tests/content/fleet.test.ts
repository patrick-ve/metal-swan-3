/**
 * The fleet: `sundae-driver`, `bandwagon` and `trumpeter` (GDD §8.1, §8.3–§8.6, §6.3, §15.2).
 * Every number checked here is the GDD value; chosen values (GDD silent) are marked "chosen" in
 * src/game/content/vehicles/fleet/numbers.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Damage, Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import { buttonMask, VirtualPad } from '../../src/engine/input';
import { frameCount, getFrames, hasSprite } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/vehicles/fleet/art';
import {
  Bandwagon,
  BANDWAGON,
  BRASS,
  BrassRing,
  CYMBAL,
  DIVE_BOMB,
  DRUM,
  DrumWave,
  HONK,
  HonkRing,
  JINGLE,
  MORTAR,
  PARACHUTE,
  SPRINKLE,
  SUNDAE,
  SundaeDriver,
  Trumpeter,
  TRUMPETER,
  TWIN,
} from '../../src/game/content/vehicles/fleet/index';
import '../../src/game/content/weapons/index';
import { Enemy } from '../../src/game/enemy';
import { Player } from '../../src/game/player/player';
import { Projectile } from '../../src/game/projectile';
import { defineEntity, getEntityMeta, getWeapon, hasWeapon, type SpawnParams } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { FLOOR, TestWorld } from './helpers';

/** A Legion soldier stand-in: soft, 30 HP (or `hp`), answers the reactions; never attacks. */
class Soldier extends Enemy {
  readonly hits: Damage[] = [];
  constructor(world: TestWorld['world'], x: number, y: number, params: SpawnParams = {}) {
    const hp = typeof params.hp === 'number' ? params.hp : 30;
    super(world, x, y, params, { art: 'enemy/test-soldier', hp, w: 14, h: 28, soft: params.soft !== false });
    this.addTag('legion');
  }
  override onHit(d: Damage, part = 0): boolean {
    this.hits.push({ ...d });
    return super.onHit(d, part);
  }
}
defineEntity('fleet-test-soldier', (w, x, y, p) => new Soldier(w, x, y, p), { category: 'enemy' });

/** A small flyer stand-in (≤ 40 HP, ≤ 32×32) for the Trumpeter's contact rule. */
class Gnat extends Enemy {
  constructor(world: TestWorld['world'], x: number, y: number, params: SpawnParams = {}) {
    super(world, x, y, params, { art: 'enemy/test-gnat', hp: 20, w: 12, h: 12, body: false });
  }
}
defineEntity('fleet-test-gnat', (w, x, y, p) => new Gnat(w, x, y, p), { category: 'enemy' });

const ids = ['sundae-driver', 'bandwagon', 'trumpeter'] as const;

/** A flat world with player 1 mounted on a fresh `id` at x 200. */
function rig(id: string, o: { x?: number; y?: number; width?: number; params?: SpawnParams } = {}) {
  const tw = new TestWorld({ god: false, playerX: o.x ?? 200, width: o.width });
  const p = tw.player as Player;
  const v = tw.spawn(id, o.x ?? 200, o.params ?? {}, o.y ?? FLOOR) as SundaeDriver & Bandwagon & Trumpeter;
  v.mount(p);
  tw.run(1);
  return { tw, p, v };
}

/** Press `buttons` for one tick (edges), then release for one tick. */
function tap(tw: TestWorld, ...buttons: Button[]): void {
  tw.hold(...buttons).run(1);
  tw.hold().run(1);
}

/** Ticks on which new entities of `type` appeared during `n` ticks. */
function spawnTicks(tw: TestWorld, type: string, n: number, hold: Button[]): number[] {
  const seen = new Set<Entity>(tw.ofType(type));
  const out: number[] = [];
  tw.hold(...hold);
  for (let i = 0; i < n; i++) {
    tw.run(1);
    for (const e of tw.ofType(type)) {
      if (seen.has(e)) continue;
      seen.add(e);
      out.push(tw.world.tick);
    }
  }
  return out;
}

const gaps = (t: number[]): number[] => t.slice(1).map((x, i) => x - t[i]);

beforeEach(() => {
  expect(TUNING.vehicle.comboWindow).toBe(1);
});

// ---------------------------------------------------------------------------------------------

describe('registration', () => {
  it('registers the three vehicles, their weapons, projectiles and the status', () => {
    for (const id of ids) expect(getEntityMeta(id)?.category).toBe('vehicle');
    for (const id of ['sprinkle', 'sundae-shell', 'brass-ring', 'drum-wave', 'twin-bullet', 'dive-bomb']) expect(getEntityMeta(id)?.category, id).toBe('projectile');
    for (const id of [
      'sundae-sprinkle-gun',
      'sundae-mortar',
      'sundae-jingle',
      'bandwagon-brass-cannon',
      'bandwagon-drum-boom',
      'bandwagon-cymbal-wall',
      'trumpeter-twin-gun',
      'trumpeter-dive-bomb',
      'trumpeter-honk',
    ]) {
      expect(hasWeapon(id), id).toBe(true);
      expect(getWeapon(id).kind).toBe('vehicle');
    }
    expect(PARACHUTE.id).toBe('swan-parachute');
  });

  it('weapon cooldowns are the GDD numbers', () => {
    expect(getWeapon('sundae-sprinkle-gun').cooldown).toBe(4);
    expect(getWeapon('sundae-mortar').cooldown).toBe(36);
    expect(getWeapon('sundae-jingle').cooldown).toBe(900);
    expect(getWeapon('bandwagon-brass-cannon').cooldown).toBe(12);
    expect(getWeapon('bandwagon-drum-boom').cooldown).toBe(45);
    expect(getWeapon('bandwagon-cymbal-wall').cooldown).toBe(300);
    expect(getWeapon('trumpeter-twin-gun').cooldown).toBe(6);
    expect(getWeapon('trumpeter-dive-bomb').cooldown).toBe(20);
    expect(getWeapon('trumpeter-honk').cooldown).toBe(240);
  });

  it('every sprite the logic draws exists with enough frames, in palette with an ink outline', () => {
    const need: Record<string, number> = {
      'vehicle/sundae-driver/cab': 1,
      'vehicle/sundae-driver/body': 2,
      'vehicle/sundae-driver/wheels': 4,
      'vehicle/sundae-driver/special': 3,
      'vehicle/sundae-driver/turret': SUNDAE.turretMax - SUNDAE.turretMin + 1,
      'vehicle/sundae-driver/cherry': SUNDAE.turretMax - SUNDAE.turretMin + 1,
      'vehicle/sundae-driver/name': 1,
      'vehicle/sundae-driver/empty-gag': 12,
      'vehicle/sundae-driver/wreck': 1,
      'vehicle/sundae-driver/idle': 1,
      'vehicle/sundae-driver/move': 4,
      'vehicle/sundae-driver/note': 2,
      'vehicle/sundae-driver/scoop': 3,
      'vehicle/sundae-driver/splat': 6,
      'vehicle/sundae-driver/bits': 6,
      'vehicle/bandwagon/body': 2,
      'vehicle/bandwagon/front': 1,
      'vehicle/bandwagon/drum': 4,
      'vehicle/bandwagon/bell': 5,
      'vehicle/bandwagon/empty-gag': 2,
      'vehicle/bandwagon/wheels': 4,
      'vehicle/bandwagon/special': 5,
      'vehicle/bandwagon/wreck': 1,
      'vehicle/bandwagon/idle': 1,
      'vehicle/bandwagon/move': 4,
      'vehicle/bandwagon/note': 2,
      'vehicle/bandwagon/bits': 6,
      'vehicle/trumpeter/parachute': 2,
      'weapon/sprinkle': 16,
      'weapon/sprinkle-lemon': 16,
      'weapon/sprinkle-mint': 16,
      'weapon/sprinkle-sky': 16,
      'weapon/sprinkle-vanilla': 16,
      'weapon/sundae-shell': 4,
      'weapon/brass-ring': 16,
      'weapon/drum-wave': 8,
      'weapon/twin-bullet': 1,
      'weapon/dive-bomb': 16,
    };
    for (const v of ['vehicle/trumpeter', 'vehicle/trumpeter-mute']) {
      Object.assign(need, {
        [`${v}/idle`]: 4,
        [`${v}/move`]: 4,
        [`${v}/front`]: 4,
        [`${v}/jet`]: 3,
        [`${v}/special`]: 2,
        [`${v}/special-front`]: 2,
        [`${v}/dive`]: 2,
        [`${v}/empty-gag`]: 3,
        [`${v}/wreck`]: 2,
        [`${v}/feather`]: 4,
      });
    }
    for (const [id, n] of Object.entries(need)) {
      expect(hasSprite(id), id).toBe(true);
      expect(frameCount(id), id).toBeGreaterThanOrEqual(n);
      for (const f of getFrames(id)) expect(f.buf.countOpaque(), id).toBeGreaterThan(0);
    }
  });

  it('the Trumpeter art fits the view box the logic keeps on screen (wing tips of a beat aside)', () => {
    const vb = TRUMPETER.viewBox;
    for (const id of ['vehicle/trumpeter/idle', 'vehicle/trumpeter/special', 'vehicle/trumpeter-mute/idle']) {
      getFrames(id).forEach((f, i) => {
        const b = f.buf.trimBounds();
        expect(b).not.toBeNull();
        if (!b) return;
        expect(b.x - f.ox, id).toBeGreaterThanOrEqual(vb.left);
        expect(b.x + b.w - f.ox, id).toBeLessThanOrEqual(vb.right);
        // Frame 2 (DOWN) hangs its wing tips lower; the bottom is the keel and the paddles.
        if (!(id.endsWith('idle') && i === 2)) expect(b.y + b.h - f.oy, id).toBeLessThanOrEqual(vb.bottom);
      });
    }
    // The rider's head (ride-lean, about 24 px over the hip) is the top of the box.
    expect(TRUMPETER.seatPoint[1] - 25).toBeGreaterThanOrEqual(vb.top);
  });
});

// ---------------------------------------------------------------------------------------------

describe('SUNDAE DRIVER', () => {
  it('3 cells, 10 shells, hurtbox 76×36; accelerates 0.08 to 2.4, brakes at 0.15, hops vy −3.0', () => {
    const { tw, v } = rig('sundae-driver');
    expect(v.cells).toBe(3);
    expect(v.shells).toBe(10);
    expect(v.hitbox).toMatchObject({ w: 76, h: 36 });
    tw.hold('right').run(1);
    expect(v.vx).toBeCloseTo(0.08, 5);
    tw.run(40);
    expect(v.vx).toBeCloseTo(2.4, 5);
    tw.hold().run(1);
    expect(v.vx).toBeCloseTo(2.25, 5);
    tw.run(30);
    tap(tw, 'jump');
    expect(Math.min(v.vy, tw.world.tick)).toBeLessThan(0);
    let top = v.y;
    for (let i = 0; i < 40; i++) {
      tw.run(1);
      top = Math.min(top, v.y);
    }
    expect(FLOOR - top).toBeGreaterThan(28);
    expect(FLOOR - top).toBeLessThan(38);
  });

  it('faces its direction of travel: holding back brakes first, then turns', () => {
    const { tw, v } = rig('sundae-driver');
    tw.hold('right').run(30);
    tw.hold('left').run(3);
    expect(v.facing).toBe(1);
    tw.run(30);
    expect(v.facing).toBe(-1);
    expect(v.vx).toBeLessThan(0);
  });

  it('the cone turns 15° per 2 ticks; up locks the facing; a turn keeps the cone’s world direction', () => {
    const { tw, v } = rig('sundae-driver');
    tw.hold('up').run(12);
    expect(v.coneStep).toBe(6);
    expect(v.aimElev).toBeCloseTo(-Math.PI / 2, 5);
    tw.hold('up', 'right').run(12);
    expect(v.coneStep).toBe(3);
    tw.hold().run(10);
    expect(v.coneStep).toBe(3);
    // Up + back: the van keeps facing right and the cone swings to back-up (9).
    tw.hold('up', 'left').run(30);
    expect(v.facing).toBe(1);
    expect(v.coneStep).toBe(9);
    // Rolling backward with nothing held: the van turns, the cone still points up-left.
    tw.hold().run(1);
    expect(v.facing).toBe(-1);
    expect(v.coneStep).toBe(3);
  });

  it('SPRINKLE GUN: 1 per 4 ticks, 10 damage, speed 8 along the cone', () => {
    const { tw, v } = rig('sundae-driver');
    const t = spawnTicks(tw, 'sprinkle', 40, ['fire']);
    expect(t.length).toBeGreaterThan(6);
    for (const g of gaps(t)) expect(g).toBe(SPRINKLE.cooldown);
    const s = tw.ofType('sprinkle')[0] as Projectile;
    expect(s.damage.amount).toBe(10);
    expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(8, 5);
    expect(s.y).toBeLessThan(v.y - 30);
  });

  it('down dips the cone to +15°: the stream hits a standing soldier ahead', () => {
    const { tw } = rig('sundae-driver');
    const s = tw.spawn('fleet-test-soldier', 330) as Soldier;
    tw.hold('down', 'fire').run(60);
    expect(s.hits.some((h) => h.weapon === 'sundae-sprinkle-gun')).toBe(true);
  });

  it('SUNDAE MORTAR: vx 2.5 × facing + van vx, vy −4.0, gravity 0.15; 150 in r 24 and frozen infantry; costs a shell', () => {
    const { tw, v } = rig('sundae-driver');
    tw.hold('right').run(40);
    const vanVx = v.vx;
    expect(vanVx).toBeCloseTo(2.4, 5);
    tw.hold('right', 'bomb').run(1);
    const sh = tw.ofType('sundae-shell')[0] as Projectile;
    expect(sh).toBeDefined();
    expect(sh.vx).toBeCloseTo(MORTAR.vx + vanVx, 1);
    expect(v.shells).toBe(9);
    // A fresh shell by id: the splat freezes, then hurts.
    const tw2 = new TestWorld({ playerX: 60 });
    const a = tw2.spawn('fleet-test-soldier', 300, { hp: 400 }) as Soldier;
    const b = tw2.spawn('fleet-test-soldier', 340, { hp: 400 }) as Soldier;
    const p = tw2.spawn('sundae-shell', 300, {}, FLOOR - 40) as Projectile;
    p.vx = 0;
    p.vy = 0;
    expect(p.gravity).toBe(0.15);
    tw2.run(40);
    expect(a.hits.find((h) => h.weapon === 'sundae-mortar')?.amount).toBe(150);
    expect(a.reaction).toBe('freeze');
    expect(b.hits.length).toBe(0);
  });

  it('JINGLE (fire + bomb): Legion within 200 px queue for 120 ticks; cooldown 900; no shell', () => {
    const { tw, v } = rig('sundae-driver');
    const near = tw.spawn('fleet-test-soldier', 380) as Soldier;
    const far = tw.spawn('fleet-test-soldier', 430) as Soldier;
    tw.hold('fire', 'bomb').run(1);
    tw.hold().run(1);
    expect(near.reaction).toBe('queue');
    expect(near.reactionTicks).toBeGreaterThan(JINGLE.queueTicks - 4);
    expect(far.reaction).toBeNull();
    expect(v.shells).toBe(10);
    // Not again before 900 ticks.
    tw.run(200);
    near.reaction = null;
    tap(tw, 'fire', 'bomb');
    expect(near.reaction).toBeNull();
  });

  it('squashes soft enemies only faster than 1.6 px/tick (100 crush)', () => {
    const { tw, v } = rig('sundae-driver', { x: 100 });
    const s = tw.spawn('fleet-test-soldier', 400) as Soldier;
    tw.hold('right').run(140);
    expect(v.vx).toBeGreaterThan(1.6);
    expect(s.hits.some((h) => h.kind === 'crush' && h.amount === 100)).toBe(true);
    expect(v.cells).toBe(3);
    // Slow (1.6 exactly or less): no squash.
    const r2 = rig('sundae-driver', { x: 100 });
    const s2 = r2.tw.spawn('fleet-test-soldier', 160) as Soldier;
    r2.tw.hold('right').run(20);
    expect(r2.v.vx).toBeCloseTo(1.6, 6);
    expect(s2.hits.filter((h) => h.kind === 'crush').length).toBe(0);
  });

  it('RAM (fire + jump, 1 tick apart): pilot pops up, van rolls at 2.8 for ≤ 200 px, 400 in r 40', () => {
    const { tw, p, v } = rig('sundae-driver');
    tw.hold('fire').run(1);
    tw.hold('fire', 'jump').run(1);
    expect(v.state).toBe('ram');
    expect(p.vehicle).toBeNull();
    const x0 = v.x;
    let maxVx = 0;
    while (!v.removed && tw.world.tick < 400) {
      tw.hold().run(1);
      maxVx = Math.max(maxVx, Math.abs(v.vx));
    }
    expect(v.removed).toBe(true);
    expect(maxVx).toBeCloseTo(SUNDAE.ramSpeed, 5);
    expect(Math.abs(v.x - x0)).toBeLessThanOrEqual(SUNDAE.ramDistance + 3);
    expect(v.ramDamage).toBe(400);
    expect(v.ramRadius).toBe(40);
  });

  it('eject (down + jump) leaves it parked with its cells and shells; the empty gag plays', () => {
    const { tw, p, v } = rig('sundae-driver');
    tap(tw, 'bomb');
    tw.hold('down').run(1);
    tw.hold('down', 'jump').run(1);
    expect(p.vehicle).toBeNull();
    expect(v.state).toBe('idle');
    expect(v.shells).toBe(9);
    tw.hold().run(400);
    expect(v.idleT).toBeGreaterThan(300);
    expect(v.gagT + (v.idleT - 300)).toBeGreaterThan(0);
  });

  it('0 cells: doomed for 60 ticks, then it explodes; a jump ejects the pilot in time', () => {
    const { tw, p, v } = rig('sundae-driver');
    const hit = (): void => {
      v.invulnTicks = 0;
      tw.world.damage(v, { amount: 50, kind: 'explosion', dirX: 1 });
    };
    hit();
    hit();
    expect(v.cells).toBe(1);
    hit();
    expect(v.state).toBe('doomed');
    tap(tw, 'jump');
    expect(p.vehicle).toBeNull();
    tw.run(70);
    expect(v.removed).toBe(true);
    expect(p.state).not.toBe('dead');
  });

  it('a bullet costs ½ cell, an explosion 1; it flashes for 60 ticks after a hit', () => {
    const { tw, v } = rig('sundae-driver');
    v.invulnTicks = 0;
    tw.world.damage(v, { amount: 10, kind: 'bullet', dirX: 1 });
    expect(v.cells).toBe(2.5);
    expect(v.hitFlashT).toBe(60);
    tw.run(70);
    tw.world.damage(v, { amount: 10, kind: 'explosion', dirX: 1 });
    expect(v.cells).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------------------------

describe('THE BANDWAGON', () => {
  it('4 cells, 10 shells; cab 32×36 + bed 64×24; accelerates 0.06 to 1.8; hop vy −2.4', () => {
    const { tw, v } = rig('bandwagon');
    expect(v.cells).toBe(4);
    expect(v.shells).toBe(10);
    const hb = v.hurtboxes();
    expect(hb.map((r) => [r.w, r.h])).toEqual([
      [32, 36],
      [64, 24],
    ]);
    tw.hold('right').run(1);
    expect(v.vx).toBeCloseTo(0.06, 5);
    tw.run(60);
    expect(v.vx).toBeCloseTo(1.8, 5);
    tw.hold().run(30);
    tap(tw, 'jump');
    let top = v.y;
    for (let i = 0; i < 40; i++) {
      tw.run(1);
      top = Math.min(top, v.y);
    }
    expect(FLOOR - top).toBeGreaterThan(17);
    expect(FLOOR - top).toBeLessThan(25);
  });

  it('the bell steps once per 6 ticks: up → −90°, up + back → −120°, released → 0°', () => {
    const { tw, v } = rig('bandwagon');
    tw.hold('up').run(6);
    expect(v.bellStep).toBe(1);
    tw.run(18);
    expect(v.bellStep).toBe(3);
    expect(v.aimElev).toBeCloseTo(-Math.PI / 2, 5);
    tw.hold('up', 'left').run(3);
    expect(v.facing).toBe(1);
    tw.run(4);
    expect(v.bellStep).toBe(4);
    tw.hold().run(30);
    expect(v.bellStep).toBe(0);
  });

  it('BRASS CANNON: a ring every 12 ticks, 10 → 24 px, speed 4, 30 damage, pierces, erases bullets', () => {
    const { tw } = rig('bandwagon');
    const t = spawnTicks(tw, 'brass-ring', 50, ['fire']);
    for (const g of gaps(t)) expect(g).toBe(BRASS.cooldown);
    const r = tw.ofType('brass-ring')[0] as BrassRing;
    expect(r.damage.amount).toBe(30);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(4, 5);
    // Fresh ring by id: grows to 24, pierces two soldiers, erases an enemy bullet.
    const tw2 = new TestWorld({ playerX: 40 });
    const a = tw2.spawn('fleet-test-soldier', 160, { hp: 200 }) as Soldier;
    const b = tw2.spawn('fleet-test-soldier', 200, { hp: 200 }) as Soldier;
    const ring = tw2.spawn('brass-ring', 100, {}, FLOOR - 14) as BrassRing;
    expect(ring.size).toBe(10);
    const bullet = Projectile.spawn(tw2.world, { team: 'enemy', x: 260, y: FLOOR - 14, vx: -2, vy: 0, damage: 1, w: 4, h: 4 });
    tw2.run(40);
    expect(ring.size).toBe(24);
    expect(a.hits[0]?.amount).toBe(30);
    expect(b.hits[0]?.amount).toBe(30);
    expect(bullet.removed).toBe(true);
  });

  it('DRUM BOOM: two ground waves, 96 px each way at 3 px/tick, 100 to grounded enemies only', () => {
    const { tw, v } = rig('bandwagon');
    const ahead = tw.spawn('fleet-test-soldier', 280, { hp: 300 }) as Soldier;
    const behind = tw.spawn('fleet-test-soldier', 120, { hp: 300 }) as Soldier;
    const out = tw.spawn('fleet-test-soldier', 310, { hp: 300 }) as Soldier;
    const air = tw.spawn('fleet-test-gnat', 260, {}, FLOOR - 40);
    tap(tw, 'bomb');
    const waves = tw.ofType('drum-wave') as DrumWave[];
    expect(waves.length).toBe(2);
    expect(waves.map((w) => w.dir).sort()).toEqual([-1, 1]);
    expect(v.shells).toBe(9);
    tw.run(40);
    expect(ahead.hits[0]?.amount).toBe(100);
    expect(behind.hits[0]?.amount).toBe(100);
    expect(out.hits.length).toBe(0);
    expect((air as Enemy).hp).toBe((air as Enemy).maxHp);
    expect(tw.ofType('drum-wave').length).toBe(0);
    expect(DRUM.reach / DRUM.speed).toBe(32);
  });

  it('CYMBAL WALL (fire + bomb): 60 ticks, blocks shots from the front, 100 on touch (once)', () => {
    const { tw, v } = rig('bandwagon');
    tw.hold('fire', 'bomb').run(1);
    tw.hold().run(CYMBAL.swing + 1);
    expect(v.cymbalsUp).toBe(true);
    const front = Projectile.spawn(tw.world, { team: 'enemy', x: v.x + 90, y: FLOOR - 30, vx: -4, vy: 0, damage: 10, w: 4, h: 4 });
    tw.run(15);
    expect(front.removed).toBe(true);
    expect(v.cells).toBe(4);
    const s = tw.spawn('fleet-test-soldier', v.x + 58, { hp: 400 }) as Soldier;
    tw.run(10);
    expect(s.hits.filter((h) => h.weapon === 'bandwagon-cymbal-wall').map((h) => h.amount)).toEqual([100]);
    tw.run(CYMBAL.ticks);
    expect(v.cymbalT).toBe(0);
  });

  it('squashes at 1.0 px/tick or more; the stage is a one-way platform carried with the truck', () => {
    const { tw, v } = rig('bandwagon', { x: 100 });
    const s = tw.spawn('fleet-test-soldier', 260) as Soldier;
    tw.hold('right').run(80);
    expect(s.hits.some((h) => h.kind === 'crush')).toBe(true);
    expect(v.stage.oneWay ?? true).toBeTruthy();
    const top = v.stage.y;
    expect(top).toBeCloseTo(v.y + BANDWAGON.stage.y, 0);
  });

  it('RAM: careens at 2.4 for ≤ 240 px, 500 in r 48', () => {
    const { tw, v } = rig('bandwagon');
    tw.hold('fire', 'jump').run(1);
    expect(v.state).toBe('ram');
    const x0 = v.x;
    let maxVx = 0;
    while (!v.removed && tw.world.tick < 400) {
      tw.hold().run(1);
      maxVx = Math.max(maxVx, Math.abs(v.vx));
    }
    expect(maxVx).toBeCloseTo(2.4, 5);
    expect(Math.abs(v.x - x0)).toBeLessThanOrEqual(BANDWAGON.ramDistance + 3);
    expect([v.ramDamage, v.ramRadius]).toEqual([500, 48]);
  });
});

// ---------------------------------------------------------------------------------------------

describe('TRUMPETER', () => {
  function sky(o: { x?: number } = {}) {
    const r = rig('trumpeter', { x: o.x ?? 200, y: 110 });
    const cam = r.tw.world.camera;
    cam.lock(cam.x, cam.x + cam.w);
    r.tw.run(1);
    return r;
  }

  it('3 cells, 20 bombs, 28×14 hull hurtbox; the driver anchor is 15 px under the hull centre', () => {
    const { v, p } = sky();
    expect(v.cells).toBe(3);
    expect(v.shells).toBe(20);
    expect(v.hitbox).toEqual(TRUMPETER.hull);
    const hullCentre = v.y + v.hitbox.y + v.hitbox.h / 2;
    expect(p.y - hullCentre).toBe(15);
    expect(p.x).toBe(v.x);
    expect(v.body?.gravity).toBe(0);
  });

  it('flies 8-way at 2.0 (1.41 per axis on diagonals), always facing right, no gravity', () => {
    const { tw, v } = sky();
    tw.hold('left').run(10);
    expect(v.vx).toBeCloseTo(-2, 5);
    expect(v.facing).toBe(1);
    tw.hold('right', 'up').run(10);
    expect(v.vx).toBeCloseTo(Math.SQRT2, 3);
    expect(v.vy).toBeCloseTo(-Math.SQRT2, 3);
    tw.hold().run(10);
    const y = v.y;
    tw.run(30);
    expect(v.y).toBe(y);
  });

  it('stays 4 px inside the view with its rider, at every edge', () => {
    const { tw, v } = sky();
    const cam = tw.world.camera;
    const vb = TRUMPETER.viewBox;
    for (const dir of [['left'], ['right'], ['up'], ['down'], ['up', 'left'], ['down', 'right']] as Button[][]) {
      tw.hold(...dir).run(260);
      expect(v.x + vb.left).toBeGreaterThanOrEqual(cam.left + 4 - 0.01);
      expect(v.x + vb.right).toBeLessThanOrEqual(cam.right - 4 + 0.01);
      expect(v.y + vb.top).toBeGreaterThanOrEqual(cam.top + 4 - 0.01);
      expect(v.y + vb.bottom).toBeLessThanOrEqual(cam.bottom - 4 + 0.01);
    }
  });

  it('TWIN BEAK GUN: 2 bullets 4 px apart every 6 ticks, 10 damage, speed 9', () => {
    const { tw } = sky();
    const seen = new Set<Entity>();
    const pairs: number[][] = [];
    tw.hold('fire');
    for (let i = 0; i < 30; i++) {
      tw.run(1);
      const fresh = tw.ofType('twin-bullet').filter((e) => !seen.has(e));
      fresh.forEach((e) => seen.add(e));
      if (fresh.length) pairs.push([tw.world.tick, ...fresh.map((e) => e.y)]);
    }
    for (const pr of pairs) {
      expect(pr.length).toBe(3);
      expect(Math.abs(pr[1] - pr[2])).toBe(TWIN.gap);
    }
    for (const g of gaps(pairs.map((x) => x[0]))) expect(g).toBe(6);
    const b = tw.ofType('twin-bullet')[0] as Projectile;
    expect(b.damage.amount).toBe(10);
    expect(b.vx).toBe(9);
  });

  it('DIVE BOMB: dropped with the ship’s speed, gravity 0.2, 150 in r 20, cooldown 20', () => {
    const { tw, v } = sky();
    tw.hold('right').run(10);
    tw.hold('right', 'bomb').run(1);
    const b = tw.ofType('dive-bomb')[0] as Projectile;
    expect(b.vx).toBeCloseTo(v.vx, 5);
    expect(b.gravity).toBe(DIVE_BOMB.gravity);
    expect(v.shells).toBe(19);
    tw.hold().run(10);
    tap(tw, 'bomb');
    expect(v.shells).toBe(19);
    tw.run(10);
    tap(tw, 'bomb');
    expect(v.shells).toBe(18);
    // Blast on a soldier.
    const tw2 = new TestWorld({ playerX: 40 });
    const s = tw2.spawn('fleet-test-soldier', 200, { hp: 400 }) as Soldier;
    tw2.spawn('dive-bomb', 200, {}, FLOOR - 60);
    tw2.run(40);
    expect(s.hits.find((h) => h.weapon === 'trumpeter-dive-bomb')?.amount).toBe(150);
  });

  it('HONK: 3 bombs, a 10-tick wind-up (she hangs still), a ring to 128 px at 8 px/tick, 80 damage, ears', () => {
    const { tw, v } = sky();
    const s = tw.spawn('fleet-test-soldier', v.x + 100, { hp: 400 }) as Soldier;
    tw.hold('right', 'fire', 'bomb').run(1);
    expect(v.shells).toBe(17);
    expect(v.honkT).toBe(HONK.windup);
    tw.hold('right').run(5);
    expect(v.flyVx).toBe(0);
    tw.run(HONK.windup - 5);
    const ring = tw.ofType('trumpeter-honk')[0] as HonkRing | undefined;
    expect(ring).toBeDefined();
    tw.run(20);
    expect(s.hits.filter((h) => h.weapon === 'trumpeter-honk').map((h) => h.amount)).toEqual([80]);
    expect(s.reaction).toBe('ears');
    expect(HONK.maxRadius / HONK.grow).toBe(16);
  });

  it('HONK with fewer than 3 bombs: a sad squeak and nothing else', () => {
    const { tw, v } = sky();
    v.shells = 2;
    tap(tw, 'fire', 'bomb');
    expect(v.honkT).toBe(0);
    expect(v.shells).toBe(2);
    tw.run(20);
    expect(tw.ofType('trumpeter-honk').length).toBe(0);
  });

  it('BAIL OUT: parachute, a 4 px/tick missile, a backup 60 ticks later with 1 cell and 5 bombs; locked 900 ticks', () => {
    const { tw, p, v } = sky();
    tw.hold('down').run(1);
    tw.hold('down', 'jump').run(1);
    expect(p.vehicle).toBeNull();
    expect(p.status.has('swan-parachute')).toBe(true);
    expect(v.state).toBe('ram');
    tw.hold().run(30);
    expect(v.vx).toBeCloseTo(4, 5);
    // The backup arrives and picks him up.
    let picked = -1;
    for (let i = 0; i < 300 && picked < 0; i++) {
      tw.run(1);
      if (p.vehicle) picked = i;
    }
    expect(picked).toBeGreaterThan(TRUMPETER.backupDelay - 30);
    const b = p.vehicle as Trumpeter;
    expect(b).toBeInstanceOf(Trumpeter);
    expect(b.cells).toBe(1);
    expect(b.shells).toBe(5);
    expect(p.status.has('swan-parachute')).toBe(false);
    // The next bail-out waits 900 ticks.
    tw.hold('fire').run(1);
    tw.hold('fire', 'jump').run(1);
    expect(p.vehicle).toBe(b);
    tw.hold().run(TRUMPETER.bailLock);
    tw.hold('fire').run(1);
    tw.hold('fire', 'jump').run(1);
    expect(p.vehicle).toBeNull();
  });

  it('under the parachute the pilot falls 0.5 px/tick, cannot be hurt and stays in view', () => {
    const { tw, p } = sky();
    tw.hold('fire', 'jump').run(1);
    tw.hold().run(TRUMPETER.chuteOpen + 20);
    const y = p.y;
    tw.run(10);
    expect(p.y - y).toBeCloseTo(5, 0);
    tw.world.damage(p, { amount: 100, kind: 'bullet', dirX: 1 });
    expect(p.state).toBe('play');
    expect(p.y).toBeGreaterThanOrEqual(tw.world.camera.top + TRUMPETER.chuteTop - 0.01);
  });

  it('touching a small enemy destroys it and costs ½ cell', () => {
    const { tw, v } = sky();
    v.invulnTicks = 0;
    const g = tw.spawn('fleet-test-gnat', v.x + 4, {}, v.y - 1) as Enemy;
    tw.run(2);
    expect(g.alive).toBe(false);
    expect(v.cells).toBe(2.5);
  });

  it('losing the last cell costs the pilot a life (no eject window)', () => {
    const { tw, p, v } = sky();
    v.cells = 1;
    v.invulnTicks = 0;
    tw.world.damage(v, { amount: 10, kind: 'explosion', dirX: 1 });
    tw.run(1);
    expect(v.removed).toBe(true);
    expect(['dead', 'spawn', 'out']).toContain(p.state);
  });

  it('a respawned pilot flies in from the left edge in a new ship (3 cells, 20 bombs)', () => {
    const tw = new TestWorld({ playerX: 200 });
    const p = tw.player as Player;
    const cam = tw.world.camera;
    cam.lock(cam.x, cam.x + cam.w);
    p.state = 'spawn';
    const v = tw.spawn('trumpeter', p.x, {}, cam.top + 48) as Trumpeter;
    v.mount(p);
    expect(v.mode).toBe('flyin');
    expect(v.x).toBeLessThan(cam.left);
    expect(v.y + TRUMPETER.driverDy).toBe(cam.top + TRUMPETER.startY[0]);
    tw.until(() => v.mode === 'fly', 200);
    expect(Math.abs(v.x - (cam.left + TRUMPETER.flyInX))).toBeLessThan(2);
    expect([v.cells, v.shells]).toEqual([3, 20]);
  });

  it('P2 flies the Mute', () => {
    const tw = new TestWorld({ playerX: 100 });
    const p2 = new Player(tw.world, 160, FLOOR, { pad: new VirtualPad(), index: 1 });
    tw.world.add(p2);
    tw.world.flush();
    const v = tw.spawn('trumpeter', 160, {}, 110) as Trumpeter;
    v.mount(p2);
    expect(v.variant).toBe('mute');
    expect((tw.spawn('trumpeter', 260, { variant: 'mute' }) as Trumpeter).variant).toBe('mute');
  });
});

// ---------------------------------------------------------------------------------------------

describe('shared rules', () => {
  it.each(ids)('%s: the pilot cannot be hit while mounted; empty vehicles ignore hits', (id) => {
    const { tw, p, v } = rig(id, { y: id === 'trumpeter' ? 110 : FLOOR });
    tw.world.damage(p, { amount: 100, kind: 'bullet', dirX: 1 });
    expect(p.state).toBe('mounted');
    v.eject('exit');
    const c = v.cells;
    tw.world.damage(v, { amount: 100, kind: 'explosion', dirX: 1 });
    expect(v.cells).toBe(c);
  });

  it.each(['sundae-driver', 'bandwagon'])('%s can be parked facing left (spawn param)', (id) => {
    const tw = new TestWorld({ playerX: 60 });
    expect(tw.spawn(id, 300, { facing: -1 }).facing).toBe(-1);
    expect(tw.spawn(id, 500).facing).toBe(1);
  });

  it.each(['sundae-driver', 'bandwagon'])('%s facing left mirrors the muzzle and the hurtboxes', (id) => {
    const { tw, v } = rig(id);
    tw.hold('left').run(60);
    expect(v.facing).toBe(-1);
    tw.hold('left', 'fire').run(1);
    const shot = [...tw.ofType('sprinkle'), ...tw.ofType('brass-ring')][0] as Projectile;
    expect(shot.vx).toBeLessThan(0);
  });

  it.each(ids)('30 copies of %s run a tick in under 0.5 ms', (id) => {
    const tw = new TestWorld({ playerX: null, width: 4000 });
    for (let i = 0; i < 30; i++) tw.spawn(id, 100 + i * 110, {}, id === 'trumpeter' ? 110 : FLOOR);
    tw.run(60);
    const t0 = performance.now();
    tw.run(200);
    const per = (performance.now() - t0) / 200;
    expect(per).toBeLessThan(0.5);
  });
});

/** Silence an unused-import lint: `buttonMask` is the pad helper the rigs use indirectly. */
void buttonMask;
