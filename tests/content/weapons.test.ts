/**
 * Player weapons (GDD §5, §6; docs/api/game.md §6–§7): every weapon's numbers, the behaviour of
 * each shot (shotgun cone, rocket blast and steering, flame stream and floor run, laser pierce
 * and walls, homing turn rate, tuba rings that erase enemy shots, bounce-mine hops), the damage
 * kinds and tags, the knife's character sounds, pooling, and the art ids (projectile strips,
 * muzzle flashes, HUD icons).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Damage, Entity } from '../../src/engine/entity';
import { NullAudio } from '../../src/engine/audio';
import { frameCount, getFrames, hasSprite } from '../../src/engine/sprites';
import type { World } from '../../src/engine/world';
import { Enemy } from '../../src/game/enemy';
import { Projectile } from '../../src/game/projectile';
import { defineEntity, getCharacter, getWeapon, hasEntity, hasWeapon, type SpawnParams } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import {
  FLAME,
  FlameStream,
  HOMING,
  HomingMissile,
  knifeSfx,
  LASER,
  LaserBeam,
  MINE,
  MineDisc,
  ROCKET,
  Rocket,
  SHOTGUN,
  TUBA,
  TubaRing,
  VOICE,
} from '../../src/game/content/weapons/index';
import { FLOOR, Rig } from '../game/helpers';

beforeAll(async () => {
  await import('../../src/game/content/weapons/art');
  await import('../../src/game/content/fx/art');
  await import('../../src/game/content/sfx/index');
});

const PLAYER_WEAPONS = ['pistol', 'machine-gun', 'shotgun', 'rocket-launcher', 'flamethrower', 'laser', 'homing', 'tuba', 'bounce-mine'] as const;

/** A target dummy that keeps a copy of every Damage it takes (kind, weapon, tags). */
interface Hit {
  amount: number;
  kind: string;
  weapon?: string;
  tags: readonly string[];
}

class Target extends Enemy {
  readonly hits: Hit[] = [];
  /** Takes hits without losing HP (an armoured light enemy). */
  readonly tough: boolean;

  constructor(world: World, x: number, y: number, params: SpawnParams = {}) {
    super(world, x, y, params, { art: 'enemy/dummy', hp: 10, soft: true });
    this.tough = params.tough === true;
  }

  override onHit(d: Damage, part = 0): boolean {
    this.hits.push({ amount: d.amount, kind: d.kind, weapon: d.weapon, tags: [...(d.tags ?? [])] });
    return this.tough ? true : super.onHit(d, part);
  }

  get total(): number {
    return this.hits.reduce((s, h) => s + h.amount, 0);
  }
}
defineEntity('test-target', (w, x, y, p) => new Target(w, x, y, p), { category: 'enemy', score: 100 });

function target(rig: Rig, x: number, hp = 500, y = FLOOR, tough = false): Target {
  const t = rig.world.spawn('test-target', x, y, { hp, tough }) as Target;
  rig.world.flush();
  return t;
}

/** Live entities of a type that are not removed. */
function live(rig: Rig, type: string): Entity[] {
  return rig.world.entities.filter((e) => e.type === type && !e.removed);
}

/** Remember every entity of a type spawned from now on. */
function spawned<T extends Entity = Entity>(rig: Rig, type: string): T[] {
  const out: T[] = [];
  rig.world.events.on('spawn', (e) => {
    if (e.type === type) out.push(e as T);
  });
  return out;
}

function arm(rig: Rig, id: string, ammo = 999): void {
  rig.p.giveWeapon(id, ammo, false);
  expect(rig.p.weapon.id).toBe(id);
}

function muzzle(rig: Rig): [number, number] {
  return rig.p.muzzleWorld([0, 0]);
}

const deg = (rad: number): number => (rad * 180) / Math.PI;

// ---------------------------------------------------------------------------------------------

describe('weapon definitions (GDD §5 table)', () => {
  const table: Record<string, { letter?: string; ammo: number; again?: number; cooldown: number; pose: string; sfx?: string; max?: number }> = {
    pistol: { ammo: Infinity, cooldown: 8, pose: 'pistol', sfx: 'weapon/pistol', max: 16 },
    'machine-gun': { letter: 'M', ammo: 200, again: 150, cooldown: 4, pose: 'heavy', sfx: 'weapon/machine-gun', max: 24 },
    shotgun: { letter: 'S', ammo: 30, again: 10, cooldown: 28, pose: 'heavy', sfx: 'weapon/shotgun', max: 1 },
    'rocket-launcher': { letter: 'R', ammo: 30, again: 20, cooldown: 20, pose: 'heavy', sfx: 'weapon/rocket', max: 2 },
    flamethrower: { letter: 'F', ammo: 30, again: 15, cooldown: 24, pose: 'heavy', sfx: 'weapon/flame', max: 1 },
    laser: { letter: 'L', ammo: 200, again: 150, cooldown: 4, pose: 'heavy' },
    homing: { letter: 'H', ammo: 40, again: 20, cooldown: 20, pose: 'heavy', sfx: 'weapon/homing' },
    tuba: { letter: 'T', ammo: 25, again: 15, cooldown: 30, pose: 'heavy', sfx: 'weapon/tuba', max: 3 },
    'bounce-mine': { letter: 'B', ammo: 30, again: 10, cooldown: 20, pose: 'heavy', sfx: 'weapon/bounce-mine', max: 3 },
  };

  it.each(Object.keys(table))('%s has the GDD ammo, cooldown, letter, pose and sound', (id) => {
    const w = getWeapon(id);
    const e = table[id];
    expect(w.id).toBe(id);
    expect(w.kind ?? 'gun').toBe('gun');
    expect(w.ammo).toBe(e.ammo);
    if (e.again !== undefined) expect(w.ammoAgain).toBe(e.again);
    expect(w.cooldown).toBe(e.cooldown);
    expect(w.letter).toBe(e.letter);
    expect(w.pose).toBe(e.pose);
    if (e.sfx) expect(w.sfx).toBe(e.sfx);
    if (e.max !== undefined) expect(w.maxShotsOnScreen).toBe(e.max);
  });

  it('pistol: crouched taps every 6 ticks; machine gun: 4-round taps and the aim sweep', () => {
    expect(getWeapon('pistol').crouchCooldown).toBe(6);
    const mg = getWeapon('machine-gun');
    expect(mg.burst).toBe(4);
    expect(mg.sweep).toBe(true);
    expect(mg.auto).toBe(true);
    expect(getWeapon('laser').sweep).toBe(true);
    expect(TUNING.fire.sweepStep).toBeCloseTo(Math.PI / 8, 9); // 22.5°
    expect(TUNING.fire.sweepTicks).toBe(2);
  });

  it('every pickup weapon announces its GDD line; again: MORE <NAME>!', () => {
    expect(getWeapon('machine-gun').voice).toBe('MACHINE GUN! FROM THE TOP!');
    expect(getWeapon('shotgun').voice).toBe('SHOTGUN! FRONT ROW SEATS!');
    expect(getWeapon('rocket-launcher').voice).toBe('ROCKET LAUNCHER! BIG FINISH!');
    expect(getWeapon('flamethrower').voice).toBe('FLAMETHROWER! MIND THE EYEBROWS!');
    expect(getWeapon('laser').voice).toBe('LASER! PEW PEW. OFFICIALLY.');
    expect(getWeapon('homing').voice).toBe('HOMING MISSILES! FIND YOUR SEATS!');
    expect(getWeapon('tuba').voice).toBe('TUBA! OOM-PAH-PAH!');
    expect(getWeapon('bounce-mine').voice).toBe('BOUNCE MINES! HOP TO IT!');
    expect(getWeapon('rocket-launcher').voiceAgain).toBe('MORE ROCKETS!');
    for (const [id, [first, again]] of Object.entries(VOICE)) {
      expect(getWeapon(id).voice, id).toBe(first);
      expect(again.startsWith('MORE '), id).toBe(true);
    }
    const rig = new Rig();
    const audio = rig.world.audio as NullAudio;
    rig.p.giveWeapon('tuba');
    rig.p.giveWeapon('tuba');
    expect(audio.log).toContain('voice:TUBA! OOM-PAH-PAH!');
    expect(audio.log).toContain('voice:MORE TUBA!');
    expect(rig.session.slots[0].ammo).toBe(TUBA.ammo + TUBA.ammoAgain);
  });

  it('bomb and melee: grenade (100 + 100 in r 24, 2 in the air, every 10) and knife (30, every 20)', () => {
    const g = getWeapon('grenade');
    expect(g.kind).toBe('bomb');
    expect(g.maxShotsOnScreen).toBe(2);
    expect(g.cooldown).toBe(10);
    expect(TUNING.grenade.direct).toBe(100);
    expect(TUNING.grenade.splash).toBe(100);
    expect(TUNING.grenade.radius).toBe(24);
    expect(TUNING.grenade.gravity).toBe(0.2);
    const k = getWeapon('knife');
    expect(k.kind).toBe('melee');
    expect(k.cooldown).toBe(20);
    expect(k.melee?.damage).toBe(30);
    // 26 px ahead of the body's front edge (the box starts `overlap` px inside it), 28 tall, crouched 18.
    expect((k.melee?.w ?? 0) - TUNING.knife.overlap).toBe(26);
    expect(k.melee?.h).toBe(28);
    expect(k.melee?.crouchH).toBe(18);
  });

  it('registers the GDD §15.2 projectile entity ids', () => {
    for (const id of ['bullet-pistol', 'bullet-mg', 'shotgun-blast', 'rocket', 'flame-stream', 'laser-beam', 'homing-missile', 'tuba-ring', 'mine-disc', 'grenade']) {
      expect(hasEntity(id), id).toBe(true);
    }
    for (const id of [...PLAYER_WEAPONS, 'grenade', 'knife']) expect(hasWeapon(id), id).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------

describe('pistol and machine gun', () => {
  it('the pistol bullet: 10 damage, 8 px/tick, kind bullet, weapon pistol', () => {
    const rig = new Rig();
    const shots = spawned<Projectile>(rig, 'pistol');
    const t = target(rig, 260, 10);
    rig.tap(['fire']);
    expect(shots[0].vx).toBeCloseTo(8, 6);
    rig.run(30);
    expect(t.hits).toEqual([{ amount: 10, kind: 'bullet', weapon: 'pistol', tags: [] }]);
    expect(t.dead).toBe(true);
  });

  it('machine-gun rounds: 10 damage at 9 px/tick, one per 4 ticks, ±1.5 px jitter', () => {
    const rig = new Rig();
    arm(rig, 'machine-gun');
    const shots = spawned<Projectile>(rig, 'machine-gun');
    rig.hold(['fire']).run(17);
    expect(shots.length).toBe(5); // ticks 0, 4, 8, 12, 16
    expect(shots[0].vx).toBeCloseTo(9, 6);
    expect(shots[0].damage.amount).toBe(10);
    const ys = shots.map((s) => s.y - s.vy * s.t);
    expect(Math.abs(ys[0] - ys[1])).toBeCloseTo(3, 0); // −1.5 / +1.5
  });
});

// ---------------------------------------------------------------------------------------------

describe('shotgun', () => {
  it('an instant cone: 150 to every target in 72 px (16 → 40 px tall), each once; kick back 2 px', () => {
    const rig = new Rig();
    arm(rig, 'shotgun');
    const [mx] = muzzle(rig);
    // (Targets start 48 px ahead of the player: closer ones would be knifed.)
    const near = target(rig, rig.p.x + 48);
    const far = target(rig, mx + 64);
    const out = target(rig, mx + 72 + 12);
    const x0 = rig.p.x;
    rig.tap(['fire']).run(10);
    expect(near.hits).toEqual([{ amount: SHOTGUN.damage, kind: 'bullet', weapon: 'shotgun', tags: ['spread'] }]);
    expect(far.hits.length).toBe(1);
    expect(out.hits.length).toBe(0);
    expect(x0 - rig.p.x).toBeCloseTo(SHOTGUN.kick, 5);
    expect(rig.session.slots[0].ammo).toBe(998);
  });

  it('the cone is 16 px tall at the muzzle and 40 px at the tip', () => {
    const rig = new Rig();
    arm(rig, 'shotgun');
    const [mx, my] = muzzle(rig);
    // Small flying boxes (a 4×4 shootable projectile of the enemy team) above the aim line.
    const box = (dx: number, dy: number): Projectile =>
      Projectile.spawn(rig.world, { team: 'enemy', x: mx + dx, y: my + dy, vx: 0, vy: 0, damage: 0, shootable: true, hp: 1000, life: 600, hitsTerrain: false, offscreen: Infinity });
    const nearIn = box(6, -8); // half height ≈ 8.8 at 6 px
    const nearOut = box(6, -14);
    const tipIn = box(68, -18); // half height ≈ 19.3 at 68 px
    const tipOut = box(68, -25);
    rig.world.flush();
    rig.tap(['fire']).run(8);
    expect(nearIn.hp).toBeLessThan(1000);
    expect(tipIn.hp).toBeLessThan(1000);
    expect(nearOut.hp).toBe(1000);
    expect(tipOut.hp).toBe(1000);
  });

  it('one blast at a time, cooldown 28 ticks', () => {
    const rig = new Rig();
    arm(rig, 'shotgun');
    const blasts = spawned(rig, 'shotgun');
    rig.hold(['fire']).run(57);
    expect(blasts.length).toBe(3); // ticks 0, 28, 56
  });
});

// ---------------------------------------------------------------------------------------------

describe('rocket launcher', () => {
  it('starts at 2 px/tick and accelerates +0.3 per tick to 7', () => {
    const rig = new Rig({ width: 4000 });
    arm(rig, 'rocket-launcher');
    const rockets = spawned<Rocket>(rig, 'rocket-launcher');
    rig.tap(['fire']);
    const r = rockets[0];
    expect(r).toBeInstanceOf(Rocket);
    const speeds: number[] = [];
    for (let i = 0; i < 24 && !r.removed; i++) {
      speeds.push(r.speed);
      rig.run(1);
    }
    expect(speeds[0]).toBeGreaterThanOrEqual(ROCKET.speed);
    expect(speeds[0]).toBeLessThanOrEqual(ROCKET.speed + 2 * ROCKET.accel + 1e-9);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i] - speeds[i - 1]).toBeLessThanOrEqual(ROCKET.accel + 1e-9);
    expect(Math.max(...speeds)).toBeCloseTo(ROCKET.maxSpeed, 9);
  });

  it('a hit: 30 to the target + 50 in r 16 (the target takes both), neighbours take the blast', () => {
    const rig = new Rig();
    arm(rig, 'rocket-launcher');
    const [mx] = muzzle(rig);
    const t = target(rig, mx + 90);
    const next = target(rig, mx + 102);
    const away = target(rig, mx + 140);
    rig.tap(['fire']).run(40);
    expect(t.hits.map((h) => [h.amount, h.kind])).toEqual([
      [ROCKET.hit, 'explosion'],
      [ROCKET.blast, 'explosion'],
    ]);
    expect(next.hits.map((h) => h.amount)).toEqual([ROCKET.blast]);
    expect(away.hits.length).toBe(0);
    expect(t.hits.every((h) => h.weapon === 'rocket-launcher')).toBe(true);
  });

  it('steers up to an enemy on a higher level (≤ 1 px/tick sideways), never turns back', () => {
    const rig = new Rig({ build: (b) => b.platform(300, 130, 80) });
    arm(rig, 'rocket-launcher');
    const t = target(rig, 340, 500, 130);
    rig.world.flush();
    rig.run(4);
    expect(t.y).toBeCloseTo(130, 0);
    const rockets = spawned<Rocket>(rig, 'rocket-launcher');
    rig.tap(['fire']);
    const r = rockets[0];
    let minVy = 0;
    for (let i = 0; i < 60 && !r.removed; i++) {
      expect(r.vx).toBeGreaterThan(0);
      minVy = Math.min(minVy, r.vy);
      expect(Math.abs(r.vy)).toBeLessThanOrEqual(ROCKET.steer + 1e-9);
      rig.run(1);
    }
    expect(minVy).toBeLessThan(-0.3);
    expect(t.hits.length).toBeGreaterThan(0);
  });

  it('explodes on terrain and at most 2 fly at once', () => {
    const rig = new Rig({ build: (b) => b.solid(260, 100, 20, 70) });
    arm(rig, 'rocket-launcher');
    let booms = 0;
    rig.world.events.on('explosion', () => booms++);
    rig.hold(['fire']);
    let most = 0;
    for (let i = 0; i < 60; i++) {
      rig.run(1);
      most = Math.max(most, live(rig, 'rocket-launcher').length);
    }
    expect(most).toBeLessThanOrEqual(ROCKET.maxOnScreen);
    expect(booms).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------------------------

describe('flamethrower', () => {
  it('a 96 px stream: burns 10 per 2 ticks, at most 12 hits per target per press; reaches 96 px, not more', () => {
    const rig = new Rig();
    arm(rig, 'flamethrower');
    const [mx] = muzzle(rig);
    const close = target(rig, rig.p.x + 48, 5000);
    const edge = target(rig, mx + FLAME.length - 4, 5000);
    const beyond = target(rig, mx + FLAME.length + 16, 5000);
    rig.tap(['fire']).run(40);
    expect(close.hits.length).toBeGreaterThan(8);
    expect(close.hits.length).toBeLessThanOrEqual(FLAME.maxHits);
    expect(close.hits.every((h) => h.amount === 10 && h.kind === 'fire' && h.weapon === 'flamethrower')).toBe(true);
    expect(edge.hits.length).toBeGreaterThan(0);
    expect(beyond.hits.length).toBe(0);
    expect(live(rig, 'flamethrower').length).toBe(0);
  });

  it('pierces: every target in the stream burns', () => {
    const rig = new Rig();
    arm(rig, 'flamethrower');
    const [mx] = muzzle(rig);
    const a = target(rig, rig.p.x + 48, 5000);
    const b = target(rig, mx + 60, 5000);
    const c = target(rig, mx + 80, 5000);
    rig.tap(['fire']).run(30);
    for (const t of [a, b, c]) expect(t.hits.length).toBeGreaterThan(5);
  });

  it('is active 24 ticks per press, one stream at a time', () => {
    const rig = new Rig();
    arm(rig, 'flamethrower');
    const streams = spawned<FlameStream>(rig, 'flamethrower');
    rig.tap(['fire']);
    const f = streams[0];
    expect(f).toBeInstanceOf(FlameStream);
    let activeTicks = 0;
    for (let i = 0; i < 40; i++) {
      if (!f.removed && f.active) activeTicks++;
      rig.run(1);
    }
    expect(activeTicks).toBeGreaterThanOrEqual(FLAME.activeTicks - 2);
    expect(activeTicks).toBeLessThanOrEqual(FLAME.activeTicks);
    rig.hold(['fire']).run(60);
    expect(streams.length).toBeGreaterThan(1);
    expect(live(rig, 'flamethrower').filter((e) => (e as FlameStream).active).length).toBeLessThanOrEqual(1);
  });

  it('fired down near the ground it runs 128 px along the floor', () => {
    const rig = new Rig();
    const f = FlameStream.spawn(rig.world, { team: 'player', owner: 0, x: 300, y: FLOOR - 16, angle: Math.PI / 2, facing: 1 });
    const t = target(rig, 300 + 110, 5000);
    rig.run(14);
    expect(f.floor).toBe(true);
    const lastX = f.px[f.n - 1];
    expect(lastX).toBeGreaterThan(300 + FLAME.floorRun - 8);
    expect(lastX).toBeLessThanOrEqual(300 + FLAME.floorRun + 1);
    for (let i = 0; i < f.n; i++) expect(f.py[i]).toBeLessThanOrEqual(FLOOR);
    expect(t.hits.length).toBeGreaterThan(0);
  });

  it('walls stop the stream', () => {
    const rig = new Rig({ build: (b) => b.solid(150, 100, 16, 70) });
    arm(rig, 'flamethrower');
    const behind = target(rig, 190, 5000);
    rig.tap(['fire']).run(30);
    expect(behind.hits.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------

describe('laser', () => {
  it('a held beam pierces every target to 384 px: 8 per 2 ticks each; 1 ammo per 4 ticks', () => {
    const rig = new Rig();
    arm(rig, 'laser', 200);
    const [mx] = muzzle(rig);
    const a = target(rig, mx + 60, 5000);
    const b = target(rig, mx + 200, 5000);
    rig.hold(['fire']).run(40);
    expect(a.hits.length).toBeGreaterThanOrEqual(18);
    expect(b.hits.length).toBe(a.hits.length);
    expect(a.hits.every((h) => h.amount === LASER.damage && h.kind === 'laser' && h.weapon === 'laser')).toBe(true);
    expect(200 - rig.session.slots[0].ammo).toBe(10);
  });

  it('a tap is a 12-tick pulse for 3 ammo; a held beam lingers 6 ticks', () => {
    const rig = new Rig();
    arm(rig, 'laser', 200);
    const beams = spawned<LaserBeam>(rig, 'laser');
    rig.tap(['fire']);
    const beam = beams[0];
    let on = 2;
    while (!beam.removed && on < 40) {
      rig.run(1);
      on++;
    }
    expect(on).toBeGreaterThanOrEqual(12);
    expect(on).toBeLessThanOrEqual(14);
    expect(200 - rig.session.slots[0].ammo).toBe(3);
    // Hold, then release: the beam stays 6 more ticks.
    rig.hold(['fire']).run(30).release();
    const held = beams[beams.length - 1];
    let after = 0;
    while (!held.removed && after < 40) {
      rig.run(1);
      after++;
    }
    expect(after).toBeGreaterThanOrEqual(LASER.linger);
    expect(after).toBeLessThanOrEqual(LASER.linger + 5);
  });

  it('stops at the first solid; loops weapon/laser and stops the loop when it ends', () => {
    const rig = new Rig({ build: (b) => b.solid(200, 60, 16, 110) });
    arm(rig, 'laser', 200);
    const behind = target(rig, 260, 5000);
    const audio = rig.world.audio as NullAudio;
    rig.hold(['fire']).run(20).release().run(20);
    expect(behind.hits.length).toBe(0);
    expect(audio.log).toContain('loop:laser-0:weapon/laser');
    expect(audio.log).toContain('stopLoop:laser-0');
    expect(live(rig, 'laser').length).toBe(0);
  });

  it('sweeps like the machine gun (the beam follows the in-between angles)', () => {
    const rig = new Rig();
    arm(rig, 'laser', 200);
    const beams = spawned<LaserBeam>(rig, 'laser');
    rig.hold(['fire']).run(6).hold(['fire', 'up']);
    const angles: number[] = [];
    for (let i = 0; i < 10; i++) {
      rig.run(1);
      angles.push(Math.round(deg(beams[0].angle)));
    }
    expect(angles.some((a) => a < -10 && a > -80)).toBe(true);
    expect(angles[angles.length - 1]).toBe(-90);
  });
});

// ---------------------------------------------------------------------------------------------

describe('homing missiles', () => {
  it('2 missiles per press (15° up and down), 2 ammo, 4 px/tick', () => {
    const rig = new Rig();
    arm(rig, 'homing', 40);
    const ms = spawned<HomingMissile>(rig, 'homing');
    rig.tap(['fire']);
    expect(ms.length).toBe(2);
    const a = ms.map((m) => Math.round(deg(Math.atan2(m.vy, m.vx)))).sort((x, y) => x - y);
    expect(a).toEqual([-15, 15]);
    expect(Math.hypot(ms[0].vx, ms[0].vy)).toBeCloseTo(HOMING.speed, 6);
    expect(rig.session.slots[0].ammo).toBe(38);
  });

  it('locks the nearest enemy within 220 px in front, turns at most 4°/tick and hits: 30 + 10 in r 8', () => {
    const rig = new Rig();
    arm(rig, 'homing', 40);
    const [mx] = muzzle(rig);
    const t = target(rig, mx + 180, 5000);
    const ms = spawned<HomingMissile>(rig, 'homing');
    rig.tap(['fire']);
    expect(ms[0].target).toBe(t);
    const last = ms.map((m) => m.heading);
    for (let i = 0; i < 80; i++) {
      rig.run(1);
      ms.forEach((m, k) => {
        if (m.removed) return;
        let d = Math.abs(m.heading - last[k]);
        if (d > Math.PI) d = 2 * Math.PI - d;
        expect(deg(d)).toBeLessThanOrEqual(4 + 1e-6);
        last[k] = m.heading;
      });
    }
    const direct = t.hits.filter((h) => h.amount === HOMING.hit);
    expect(direct.length).toBe(2);
    expect(t.total).toBe(2 * (HOMING.hit + HOMING.blast));
    expect(t.hits.every((h) => h.kind === 'explosion' && h.weapon === 'homing')).toBe(true);
  });

  it('flies straight without a target and pops after 120 ticks; at most 4 in the air', () => {
    const rig = new Rig({ width: 6000 });
    arm(rig, 'homing', 40);
    const ms = spawned<HomingMissile>(rig, 'homing');
    rig.tap(['fire']);
    const m = ms[0];
    const h0 = m.heading;
    let n = 1;
    while (!m.removed && n < 200) {
      rig.run(1);
      n++;
    }
    expect(m.heading).toBeCloseTo(h0, 9);
    // It may leave the view (and be removed) before its life ends; never later than 120 ticks.
    expect(n).toBeLessThanOrEqual(HOMING.life + 2);
    const rig2 = new Rig();
    arm(rig2, 'homing', 40);
    target(rig2, 600, 100000);
    rig2.hold(['fire']);
    let most = 0;
    for (let i = 0; i < 120; i++) {
      rig2.run(1);
      most = Math.max(most, live(rig2, 'homing').length);
    }
    expect(most).toBeLessThanOrEqual(HOMING.maxMissiles);
  });
});

// ---------------------------------------------------------------------------------------------

describe('tuba', () => {
  it('a ring grows 12 → 40 px over 40 ticks, flies 2.5 px/tick and lives 70 ticks', () => {
    const rig = new Rig({ width: 4000 });
    arm(rig, 'tuba');
    const rings = spawned<TubaRing>(rig, 'tuba');
    rig.tap(['fire']);
    const r = rings[0];
    expect(r).toBeInstanceOf(TubaRing);
    expect(r.vx).toBeCloseTo(TUBA.speed, 6);
    expect(r.size).toBeLessThanOrEqual(TUBA.size0 + 1);
    rig.run(41);
    expect(r.size).toBeCloseTo(TUBA.size1, 6);
    expect(r.hitRect().h).toBe(TUBA.size1);
    let n = 43;
    while (!r.removed && n < 100) {
      rig.run(1);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(TUBA.life - 1);
    expect(n).toBeLessThanOrEqual(TUBA.life + 1);
  });

  it('hits each enemy once (60, impact + sonic) and pushes light enemies back 8 px', () => {
    const rig = new Rig();
    arm(rig, 'tuba');
    const [mx] = muzzle(rig);
    const light = target(rig, rig.p.x + 48, 40, FLOOR, true);
    const heavy = target(rig, mx + 100, 500, FLOOR, true);
    rig.run(2);
    const lx = light.x;
    const hx = heavy.x;
    rig.tap(['fire']).run(60);
    expect(light.hits).toEqual([{ amount: 60, kind: 'impact', weapon: 'tuba', tags: ['sonic'] }]);
    expect(heavy.hits).toEqual([{ amount: 60, kind: 'impact', weapon: 'tuba', tags: ['sonic'] }]);
    expect(light.x - lx).toBeCloseTo(TUBA.push, 0);
    expect(heavy.x).toBeCloseTo(hx, 6);
  });

  it('erases every erasable enemy shot it touches; beams (not erasable) fly on', () => {
    const rig = new Rig();
    arm(rig, 'tuba');
    const [mx, my] = muzzle(rig);
    const bullet = Projectile.spawn(rig.world, { team: 'enemy', x: mx + 120, y: my, vx: -1, vy: 0, damage: 10, life: 300 });
    const egg = Projectile.spawn(rig.world, { team: 'enemy', x: mx + 160, y: my - 14, vx: -0.5, vy: 0, damage: 10, life: 300 });
    const beam = Projectile.spawn(rig.world, { team: 'enemy', x: mx + 200, y: my + 6, vx: 0, vy: 0, damage: 0, life: 300, erasable: false });
    rig.world.flush();
    expect(bullet.hasTag('erasable')).toBe(true);
    const rings = spawned<TubaRing>(rig, 'tuba');
    rig.tap(['fire']).run(70);
    expect(bullet.removed).toBe(true);
    expect(egg.removed).toBe(true);
    expect(beam.removed).toBe(false);
    expect(rings[0].erased).toBe(2);
    expect(rig.p.alive).toBe(true);
  });

  it('a 45° ring is a side ring: it flies along the diagonal and pushes along its x; straight up is the up ring', () => {
    const rig = new Rig({ width: 4000 });
    arm(rig, 'tuba');
    const rings = spawned<TubaRing>(rig, 'tuba');
    rig.hold(['up', 'right']).run(2).tap(['fire']);
    const r = rings[0];
    expect((Math.atan2(r.vy, r.vx) * 180) / Math.PI).toBeCloseTo(-45, 5);
    expect(r.horizontal).toBe(true);
    const [x0, y0] = [r.x, r.y];
    rig.run(10);
    expect(r.x - x0).toBeCloseTo(-(r.y - y0), 5);
    rig.run(TUBA.cooldown + 20).hold(['up']).run(4).tap(['fire']);
    expect(rings[1].horizontal).toBe(false);
    expect(rings[1].vx).toBeCloseTo(0, 6);
  });

  it('at most 3 rings on screen', () => {
    const rig = new Rig({ width: 4000 });
    arm(rig, 'tuba');
    rig.hold(['fire']);
    let most = 0;
    for (let i = 0; i < 200; i++) {
      rig.run(1);
      most = Math.max(most, live(rig, 'tuba').length);
    }
    expect(most).toBe(TUBA.maxOnScreen);
  });
});

// ---------------------------------------------------------------------------------------------

describe('bounce mines', () => {
  function track(rig: Rig): { mines: MineDisc[]; booms: { x: number; y: number }[] } {
    const out = { mines: spawned<MineDisc>(rig, 'bounce-mine'), booms: [] as { x: number; y: number }[] };
    rig.world.events.on('explosion', (e) => out.booms.push({ x: e.x, y: e.y }));
    return out;
  }

  it('thrown low (vx 3, vy −2), bounces along the floor and blows up on the 4th landing', () => {
    const rig = new Rig({ width: 4000 });
    arm(rig, 'bounce-mine');
    const tr = track(rig);
    rig.tap(['fire']);
    const m = tr.mines[0];
    expect(m).toBeInstanceOf(MineDisc);
    expect(m.vx).toBeCloseTo(MINE.vx, 6);
    let landings = 0;
    let lastVy = m.vy;
    const bounceRatios: number[] = [];
    for (let i = 0; i < MINE.fuse && tr.booms.length === 0; i++) {
      const vyBefore = m.vy + MINE.gravity;
      rig.run(1);
      if (lastVy >= 0 && m.vy < 0 && !m.removed) {
        landings++;
        bounceRatios.push(-m.vy / vyBefore);
      }
      lastVy = m.vy;
      if (!m.removed) expect(m.vx).toBeCloseTo(MINE.vx, 6); // vx kept
    }
    expect(landings).toBe(MINE.landings - 1);
    expect(tr.booms.length).toBe(1);
    expect(tr.booms[0].y).toBeGreaterThan(FLOOR - 6);
    expect(bounceRatios[0]).toBeCloseTo(MINE.bounce, 1);
  });

  it('enemy contact: 30 + 40 in r 20 (the enemy touched takes both)', () => {
    const rig = new Rig();
    arm(rig, 'bounce-mine');
    const [mx] = muzzle(rig);
    const t = target(rig, mx + 50);
    const side = target(rig, mx + 64);
    rig.tap(['fire']).run(60);
    expect(t.hits.map((h) => h.amount)).toEqual([MINE.hit, MINE.blast]);
    expect(t.hits.every((h) => h.kind === 'explosion' && h.weapon === 'bounce-mine')).toBe(true);
    expect(side.hits.map((h) => h.amount)).toEqual([MINE.blast]);
  });

  it('hops a 32 px gap and steps up 12 px', () => {
    const rig = new Rig({
      noFloor: true,
      width: 2000,
      build: (b) => {
        b.ground().at(0, FLOOR).flat(170).gap(30).flat(30).step(-12).flat(1770);
      },
    });
    arm(rig, 'bounce-mine');
    const tr = track(rig);
    rig.tap(['fire']);
    const m = tr.mines[0];
    let maxX = 0;
    let atBoom = { x: 0, y: 0 };
    for (let i = 0; i < 200 && tr.booms.length === 0; i++) {
      rig.run(1);
      if (!m.removed) maxX = Math.max(maxX, m.x);
    }
    if (tr.booms.length) atBoom = tr.booms[0];
    expect(maxX).toBeGreaterThan(240); // over the gap (170–200) and up the step at 230
    // It blew up on the raised floor (12 px higher), never in the pit.
    expect(atBoom.x).toBeGreaterThan(230);
    expect(atBoom.y).toBeLessThan(FLOOR - 8);
    expect(atBoom.y).toBeGreaterThan(FLOOR - 16);
  });

  it('aimed up: lobbed (vx 1, vy −4); max 3 in the air', () => {
    const rig = new Rig({ width: 4000 });
    arm(rig, 'bounce-mine');
    const tr = track(rig);
    rig.hold(['up']).run(2).tap(['fire']);
    expect(tr.mines[0].vx).toBeCloseTo(MINE.upVx, 6);
    expect(tr.mines[0].vy).toBeLessThan(MINE.upVy + 0.5);
    const rig2 = new Rig({ width: 4000 });
    arm(rig2, 'bounce-mine');
    rig2.hold(['fire']);
    let most = 0;
    for (let i = 0; i < 120; i++) {
      rig2.run(1);
      most = Math.max(most, live(rig2, 'bounce-mine').length);
    }
    expect(most).toBe(MINE.maxOnScreen);
  });
});

// ---------------------------------------------------------------------------------------------

describe('knife sounds per character (GDD §6.2, §15.7)', () => {
  it('each hero plays the variant; others fall back to weapon/knife', () => {
    const fake = (id: string, extra: Record<string, unknown> = {}): Entity => ({ character: { id, ...extra } }) as unknown as Entity;
    expect(knifeSfx(fake('grace'))).toBe('weapon/knife-umbrella');
    expect(knifeSfx(fake('mittens'))).toBe('weapon/knife-needles');
    expect(knifeSfx(fake('pip'))).toBe('weapon/knife-pan');
    expect(knifeSfx(fake('gramps'))).toBe('weapon/knife-wrench');
    expect(knifeSfx(fake('recruit'))).toBe('weapon/knife');
    expect(knifeSfx(null)).toBe('weapon/knife');
    // A character def that names its own sound wins; an unknown sound falls back.
    expect(knifeSfx(fake('x', { knifeSfx: 'weapon/knife-pan' }))).toBe('weapon/knife-pan');
    expect(knifeSfx(fake('x', { knifeSfx: 'weapon/no-such-sound' }))).toBe('weapon/knife');
  });

  it('a stab plays the character sound (recruit: weapon/knife; pip: the frying pan)', () => {
    for (const [char, sound] of [
      ['recruit', 'weapon/knife'],
      ['pip', 'weapon/knife-pan'],
    ] as const) {
      const rig = new Rig();
      (rig.p as unknown as { character: unknown }).character = getCharacter(char);
      const audio = rig.world.audio as NullAudio;
      const t = target(rig, rig.p.x + 16, 10);
      rig.tap(['fire']);
      expect(t.hits.map((h) => h.kind)).toEqual(['knife']);
      expect(audio.log.filter((l) => l.startsWith('sfx:weapon/knife'))).toEqual([`sfx:${sound}`]);
    }
  });
});

// ---------------------------------------------------------------------------------------------

describe('pooling and art', () => {
  it('shots are pooled: a spent tuba ring and rocket are reused by the next shot', () => {
    const rig = new Rig({ build: (b) => b.solid(240, 60, 16, 110) });
    arm(rig, 'rocket-launcher');
    const rockets = spawned<Rocket>(rig, 'rocket-launcher');
    rig.tap(['fire']).run(40);
    expect(rockets[0].removed).toBe(true);
    rig.tap(['fire']).run(2);
    expect(rockets[1]).toBe(rockets[0]);
  });

  it('every weapon has a HUD icon ui/icon-<id> (≤ 16×8), and its GDD alias', () => {
    for (const id of [...PLAYER_WEAPONS, 'grenade', 'knife']) {
      for (const sid of [`ui/icon-${id}`, `ui/icon-weapon-${id}`]) {
        expect(hasSprite(sid), sid).toBe(true);
        const f = getFrames(sid)[0];
        expect(f.buf.w, sid).toBeLessThanOrEqual(16);
        expect(f.buf.h, sid).toBeLessThanOrEqual(8);
        expect(f.buf.countOpaque(), sid).toBeGreaterThan(10);
      }
    }
    for (const old of ['rocket', 'flame', 'bouncer']) expect(hasSprite(`ui/icon-${old}`), old).toBe(true);
  });

  it('every weapon has its muzzle flash family fx/muzzle-<id>[-up|-diag]', () => {
    for (const id of PLAYER_WEAPONS) {
      for (const suffix of ['', '-up', '-diag']) {
        const sid = `fx/muzzle-${id}${suffix}`;
        expect(hasSprite(sid), sid).toBe(true);
        expect(frameCount(sid), sid).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('projectile strips: 16 directions for bullets and missiles; spinning grenade and mine; tuba ring sizes', () => {
    for (const id of ['weapon/bullet', 'weapon/mg-bullet', 'weapon/rocket', 'weapon/homing', 'weapon/shell']) expect(frameCount(id), id).toBe(16);
    expect(frameCount('weapon/grenade')).toBe(4);
    expect(frameCount('weapon/mine-disc')).toBe(4);
    expect(frameCount('weapon/flame')).toBe(12);
    const ring = getFrames('weapon/tuba-ring');
    expect(ring.length).toBe(8);
    // Frame k is 12 + 4k px tall (+ the outline).
    ring.forEach((f, k) => {
      const b = f.buf.trimBounds();
      expect(b && Math.abs(b.h - (12 + 4 * k)) <= 2, `ring ${k}`).toBe(true);
    });
    expect(frameCount('weapon/tuba-ring-up')).toBe(8);
    for (const id of ['weapon/laser-flare', 'weapon/laser-hit', 'weapon/flame-glow', 'weapon/pellet', 'enemy/bullet', 'enemy/grenade']) {
      expect(hasSprite(id), id).toBe(true);
    }
  });
});

describe('performance', () => {
  // The registered shot entities; each keeps 30 copies alive among 8 targets.
  const SHOTS = ['bullet-mg', 'shotgun-blast', 'rocket', 'flame-stream', 'laser-beam', 'homing-missile', 'tuba-ring', 'mine-disc', 'grenade'];

  it.each(SHOTS)('30 live %s cost under 0.5 ms per tick', (id) => {
    const rig = new Rig({ width: 3000 });
    for (let i = 0; i < 8; i++) target(rig, 260 + i * 24, 1e6, FLOOR, true);
    const shots: Entity[] = [];
    const keep = (): void => {
      for (let i = shots.length - 1; i >= 0; i--) if (shots[i].removed) shots.splice(i, 1);
      for (let i = shots.length; i < 30; i++) shots.push(rig.world.spawn(id, 60 + (i % 10) * 12, FLOOR, { angle: (i % 3) * -20 }));
    };
    for (let t = 0; t < 60; t++) {
      keep();
      rig.run(1);
    }
    let spent = 0;
    for (let t = 0; t < 300; t++) {
      keep();
      const t0 = performance.now();
      rig.run(1);
      spent += performance.now() - t0;
    }
    expect(rig.world.errors).toEqual([]);
    expect(spent / 300).toBeLessThan(0.5);
  });
});
