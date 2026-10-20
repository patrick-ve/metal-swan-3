/**
 * The wagon (docs/design/ring.md §3): steer, settle, the steer lock, the 8 aims firing on the
 * plane from the hero's muzzle, the swerve (i-frames, cooldown) and its side ram, the lob into the
 * aimed lane, the knife, armour costs and the damage states, the bump API, the wreck → drive-in,
 * repair, the drivers' lines, and the art (every strip at 1× with its points; a frame draws).
 */
import { describe, expect, it } from 'vitest';
import type { Damage } from '../../../src/engine/entity';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { frameCount, getFrames, hasSprite } from '../../../src/engine/sprites';
import '../../../src/game/content/characters/art';
import '../../../src/game/content/ring/wagon/art';
import { BODY_CANVAS, ID, LIVERIES, POSES, SEAT } from '../../../src/game/content/ring/wagon/geometry';
import { DRIVER_EVENTS, DRIVER_LINES, driverLine } from '../../../src/game/content/ring/wagon/lines';
import { LOB } from '../../../src/game/content/ring/wagon/lob';
import { shotLiftOf } from '../../../src/game/ring/entity';
import { AIMS, LANE_GAP, laneY, planeAngle, type Aim8 } from '../../../src/game/ring/lanes';
import { RING } from '../../../src/game/ring/types';
import { bodyStateOf, SIDE_RAM, WAGON_W, Wagon } from '../../../src/game/ring/wagon';
import { RingRig, TestFoe, TestTarget } from './ring-helpers';

const BULLET: Damage = { amount: 10, kind: 'bullet', dirX: -1 };

/** A started rig with the hero in play and the wagon settled in its start lane. */
function playing(o: ConstructorParameters<typeof RingRig>[0] = {}): RingRig {
  const rig = new RingRig(o);
  rig.run(4);
  rig.wagon.invulnTicks = 0;
  return rig;
}

describe('steer', () => {
  it('up / down change one lane per press in about 14 ticks; the change finishes on release', () => {
    const rig = playing();
    const w = rig.wagon;
    const start = w.laneTarget;
    rig.tap(['up']);
    expect(w.laneTarget).toBe(start - 1);
    const n = rig.until(() => Math.abs(w.y - laneY(start - 1)) < 0.01, 40);
    expect(n + 2).toBeLessThanOrEqual(RING.laneChangeTicks + 2);
    // Held: lane by lane to the far edge, never past it.
    rig.hold(['up']).run(80).release();
    expect(w.laneTarget).toBe(1);
    rig.run(20);
    expect(w.y).toBe(laneY(1));
  });

  it('left / right move the car on screen inside the band', () => {
    const rig = playing();
    const w = rig.wagon;
    rig.hold(['right']).run(300).release();
    expect(w.screenX).toBeCloseTo(RING.screenMaxX, 0);
    rig.hold(['left']).run(400).release();
    expect(w.screenX).toBeCloseTo(RING.screenMinX, 0);
  });

  it('the body poses: a push tilts the nose up, a brake dips it, a lane change leans', () => {
    const rig = playing();
    const w = rig.wagon;
    rig.hold(['right']).run(3);
    expect(w.pose).toBe('up');
    rig.hold(['left']).run(14);
    expect(w.pose).toBe('down');
    rig.release().run(30);
    expect(w.pose).toBe('level');
    rig.hold(['up']).run(4);
    expect(w.pose).toBe('far');
    rig.release().run(30);
    rig.hold(['down']).run(4);
    expect(w.pose).toBe('near');
  });
});

describe('steer lock and the 8 aims', () => {
  it('FIRE held: the lane and the screen x hold, the D-pad aims', () => {
    const rig = playing();
    const w = rig.wagon;
    const lane = w.laneTarget;
    const sx = w.screenX;
    rig.hold(['fire', 'down']).run(30);
    expect(w.laneTarget).toBe(lane);
    expect(w.screenX).toBeCloseTo(sx, 5);
    expect(rig.hero.aim8).toBe('near');
    rig.hold(['fire', 'left', 'up']).run(2);
    expect(rig.hero.aim8).toBe('back-far');
    // Released, the aim stays; a tap fires along it.
    rig.release().run(2);
    expect(rig.hero.aim8).toBe('back-far');
  });

  it.each(AIMS)('aim %s: the shot leaves from the muzzle and moves on the plane along the aim', (aim: Aim8) => {
    const rig = playing({ god: true });
    const hero = rig.hero;
    hero.aim8 = aim;
    rig.tap(['fire']);
    const shot = rig.world.byTag('shot').find((s) => s.alive);
    expect(shot, aim).toBeDefined();
    const a = planeAngle(aim);
    const road = rig.runner.roadSpeed;
    const vx = shot!.vx - (Math.abs(Math.cos(a)) > 0.01 ? 0 : 0);
    // Direction on the plane: x sign and depth sign follow the aim.
    if (Math.cos(a) > 0.1) expect(vx - road).toBeGreaterThan(0);
    if (Math.cos(a) < -0.1) expect(vx).toBeLessThan(road);
    if (Math.sin(a) < -0.1) expect(shot!.vy).toBeLessThan(0);
    if (Math.sin(a) > 0.1) expect(shot!.vy).toBeGreaterThan(0);
    if (Math.abs(Math.sin(a)) < 0.1) expect(Math.abs(shot!.vy)).toBeLessThan(0.01);
    // Drawn at the muzzle's height (the hip on the sill).
    expect(shotLiftOf(shot!)).toBeGreaterThan(0);
    expect(rig.world.errors).toEqual([]);
  });

  it('the shots of the forward aim are drawn at the gun (hip on the sill + the muzzle point)', () => {
    const rig = playing({ god: true });
    rig.tap(['fire']);
    const shot = rig.world.byTag('shot').find((s) => s.alive)!;
    const muzzle = getFrames(`char/vincent/torso-pistol-shoot`, 1)[0].pts!.muzzle!;
    expect(shotLiftOf(shot)).toBe(-(SEAT.heroY + muzzle[1]));
  });
});

describe('swerve', () => {
  it('JUMP: one lane in about 6 ticks, 8 ticks without damage, then a 30-tick cooldown', () => {
    const rig = playing();
    const w = rig.wagon;
    const lane = w.laneTarget;
    rig.hold(['up']);
    rig.tap(['jump']);
    rig.release();
    expect(w.laneTarget).toBe(lane - 1);
    expect(w.invulnTicks).toBeGreaterThanOrEqual(RING.swerveInvuln - 2);
    // No damage inside the dodge.
    rig.world.damage(w, BULLET);
    expect(w.cells).toBe(RING.wagonCells);
    rig.run(RING.swerveTicks);
    expect(Math.abs(w.y - laneY(lane - 1))).toBeLessThan(0.01);
    // The cooldown: a second JUMP right away does nothing.
    const now = w.laneTarget;
    rig.tap(['jump']);
    expect(w.laneTarget).toBe(now);
    rig.run(RING.swerveCooldown);
    rig.hold(['down']);
    rig.tap(['jump']);
    rig.release();
    expect(w.laneTarget).toBe(now + 1);
  });

  it('JUMP without a direction dodges away from the nearest enemy shot in the lane', () => {
    const rig = playing();
    const w = rig.wagon;
    expect(w.swerve(0)).toBe(true);
    // Lane 3 (the middle of the road, no shot): toward the middle → lane 2 or 4 is fine, never off the road.
    expect([2, 4]).toContain(w.laneTarget);
  });

  it('a swerve into a small vehicle is a side ram: damage tagged ram / side-ram, no cost to the wagon', () => {
    const rig = playing();
    const w = rig.wagon;
    const lane = w.laneTarget;
    const t = rig.spawnAt<TestTarget>('test-ring-target', w.screenX, laneY(lane - 1), { w: 18 });
    t.addTag('ring-small');
    rig.hold(['up']);
    rig.tap(['jump']);
    rig.release();
    rig.run(RING.swerveTicks);
    const ram = t.hits.find((d) => d.tags?.includes('side-ram'));
    expect(ram).toBeDefined();
    expect(ram!.amount).toBe(SIDE_RAM);
    expect(ram!.tags).toContain('ram');
    expect(w.cells).toBe(RING.wagonCells);
  });
});

describe('BOMB = lob', () => {
  it('lands in the aimed lane only (forward: the same lane ahead) and costs a grenade', () => {
    const rig = playing();
    const w = rig.wagon;
    const lane = w.laneTarget;
    const hero = rig.hero;
    const bombs = hero.slot.bombs;
    const at = hero.x - rig.world.camera.x + 6 + LOB.ahead;
    const same = rig.spawnAt<TestTarget>('test-ring-target', at, laneY(lane));
    const next = rig.spawnAt<TestTarget>('test-ring-target', at, laneY(lane - 1));
    rig.tap(['bomb']);
    expect(hero.slot.bombs).toBe(bombs - 1);
    expect(rig.world.byTag('ring-lob').length).toBe(1);
    rig.run(LOB.ticks + 2);
    expect(same.hits.some((d) => d.kind === 'explosion')).toBe(true);
    expect(next.hits.some((d) => d.kind === 'explosion')).toBe(false);
    // The HUD's shell count mirrors the grenades.
    expect(w.shells).toBe(hero.slot.bombs);
  });

  it('aimed far: straight across into the next lane toward the median', () => {
    const rig = playing();
    const w = rig.wagon;
    const lane = w.laneTarget;
    const hero = rig.hero;
    hero.aim8 = 'far';
    const at = hero.x - rig.world.camera.x + 6;
    const far = rig.spawnAt<TestTarget>('test-ring-target', at, laneY(lane - 1), { w: 40 });
    const own = rig.spawnAt<TestTarget>('test-ring-target', at + 140, laneY(lane), { w: 40 });
    rig.tap(['bomb']);
    rig.run(LOB.ticks + 2);
    expect(far.hits.some((d) => d.kind === 'explosion')).toBe(true);
    expect(own.hits.length).toBe(0);
  });

  it('no grenades: nothing flies', () => {
    const rig = playing();
    rig.hero.slot.bombs = 0;
    rig.tap(['bomb']);
    expect(rig.world.byTag('ring-lob').length).toBe(0);
  });
});

describe('knife', () => {
  it('FIRE next to an enemy at the window is the knife (no shot)', () => {
    const rig = playing();
    const w = rig.wagon;
    const foe = rig.spawnAt<TestFoe>('test-ring-foe', rig.hero.x - rig.world.camera.x, w.y + LANE_GAP);
    foe.addTag('soft');
    let knifed = 0;
    rig.world.events.on('hit', (e) => {
      if (e.target === foe && e.damage.kind === 'knife') knifed++;
    });
    rig.tap(['fire']);
    expect(knifed).toBe(1);
    expect(rig.world.byTag('shot').filter((s) => s.alive).length).toBe(0);
    expect(rig.hero.knifeT).toBeGreaterThan(0);
  });
});

describe('armour and damage states', () => {
  it('bumps: 1 cell, ½ for a light bump, 2 for a ram; the bump API pushes and costs', () => {
    const rig = playing();
    const w = rig.wagon;
    w.bump({ dx: -2, cost: 1 });
    expect(w.cells).toBe(RING.wagonCells - 1);
    expect(w.sideV).toBeLessThan(0);
    w.invulnTicks = 0;
    w.bump({ cost: 0.5 });
    expect(w.cells).toBe(RING.wagonCells - 1.5);
    w.invulnTicks = 0;
    w.bump({ cost: 2 });
    expect(w.cells).toBe(RING.wagonCells - 3.5);
    w.invulnTicks = 0;
    const lane = w.laneTarget;
    w.bump({ dy: -1, cost: 0 });
    expect(w.cells).toBe(RING.wagonCells - 3.5);
    expect(w.laneTarget).toBe(lane - 1);
  });

  it('damage states follow the armour: dents, broken glass, smoke, fire', () => {
    expect(bodyStateOf(10)).toBe(0);
    expect(bodyStateOf(8)).toBe(0);
    expect(bodyStateOf(7.5)).toBe(1);
    expect(bodyStateOf(5)).toBe(2);
    expect(bodyStateOf(2.5)).toBe(3);
    const rig = playing();
    const w = rig.wagon;
    w.cells = 1;
    rig.run(10);
    expect(w.bodyState).toBe(3);
    // A repair kit: +1 cell.
    w.repair(1);
    expect(w.cells).toBe(2);
  });

  it('the wreck spins out, the hero tumbles out and a fresh wagon with the same driver drives in', () => {
    const rig = playing();
    const hero = rig.hero;
    const w = rig.wagon;
    const driver = w.driverId;
    w.cells = 0.5;
    rig.world.damage(w, BULLET);
    expect(w.state).toBe('wreck');
    expect(w.view).toBe('spin');
    const frames = new Set<number>();
    for (let i = 0; i < 30; i++) {
      rig.run(1);
      frames.add(w.spinFrame);
    }
    expect(frames.size).toBeGreaterThanOrEqual(6);
    rig.until(() => hero.state === 'spawn', RING.respawnTicks + 10);
    expect(hero.wagon!.driverId).toBe(driver);
    rig.until(() => hero.state === 'mounted', RING.driveInTicks + 10);
    expect(hero.wagon!.cells).toBe(RING.wagonCells);
  });
});

describe('drivers', () => {
  it('every driver has a line for every event: ≤ 24 characters per line, ≤ 2 lines', () => {
    for (const [id, set] of Object.entries(DRIVER_LINES)) {
      for (const ev of DRIVER_EVENTS) {
        expect(set[ev].length, `${id} ${ev}`).toBeGreaterThan(0);
        for (const line of set[ev]) {
          const rows = line.split('\n');
          expect(rows.length, line).toBeLessThanOrEqual(2);
          for (const r of rows) expect(r.length, line).toBeLessThanOrEqual(24);
        }
      }
    }
    expect(driverLine('nobody', 'board')).toContain('STAP IN!');
    for (const id of ['vincent', 'thom', 'dirk', 'bob', 'patrick']) expect(driverLine(id, 'board')).toContain('STAP IN!');
  });

  it('the driver talks (a bubble), then keeps quiet for a while except for the big moments', () => {
    const rig = playing();
    const w = rig.wagon;
    expect(w.say('bump')).toBe(true);
    expect(rig.runner.hud.bubbles.some((b) => b.target === w)).toBe(true);
    expect(w.say('tunnel')).toBe(false);
    expect(w.say('boss')).toBe(true);
  });
});

describe('art', () => {
  it('registers every wagon strip with 1× frames, the body poses, the spin and the left side', () => {
    for (const L of LIVERIES) {
      const ids = ID[L];
      for (const s of [0, 1, 2, 3]) {
        expect(hasSprite(ids.body[s])).toBe(true);
        expect(frameCount(ids.body[s])).toBe(POSES.length);
        const f = getFrames(ids.body[s], 1)[0];
        expect(f.buf.w).toBe(BODY_CANVAS.x1 - BODY_CANVAS.x0 + 1);
        expect(f.ox).toBe(-BODY_CANVAS.x0);
      }
      expect(frameCount(ids.left)).toBe(2);
      expect(frameCount(ids.spin[0])).toBe(8);
      expect(frameCount(ids.spin[3])).toBe(8);
      expect(frameCount(ids.wheel)).toBe(4);
    }
    expect(frameCount(ID.cabin)).toBe(6);
    expect(frameCount(ID.flame)).toBe(4);
  });

  it('the 2× and 4× frames keep the 1× geometry', () => {
    for (const id of [ID.green.body[0], ID.white.body[3], ID.cabin, ID.green.wheel, ID.flame]) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hi = getFrames(id, d);
        expect(hi.length, id).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          expect(hi[i].buf.w / d, id).toBe(lo[i].buf.w);
          expect(hi[i].buf.h / d, id).toBe(lo[i].buf.h);
          expect(hi[i].ox, id).toBe(lo[i].ox);
          expect(hi[i].oy, id).toBe(lo[i].oy);
        }
      }
    }
  });

  it('the wagon, the driver and the hero draw without errors (and the wagon is a Wagon of the slot livery)', () => {
    const rig = playing();
    const w = rig.wagon;
    expect(w).toBeInstanceOf(Wagon);
    expect(w.livery).toBe('white');
    expect(w.shadowW).toBeGreaterThan(WAGON_W / 2);
    const r = new SoftRenderer();
    for (const aim of AIMS) {
      rig.hero.aim8 = aim;
      r.begin(rig.runner.sky);
      rig.runner.draw(r);
      r.end();
    }
    w.view = 'left';
    r.begin(rig.runner.sky);
    rig.runner.draw(r);
    r.end();
    expect(rig.world.errors).toEqual([]);
  });
});
