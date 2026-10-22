/**
 * The RingRunner (docs/design/ring.md §2, §13; docs/api/ring.md): it runs a plan to 'complete'
 * with no errors; the camera always moves at the road speed; the plan cursor spawns entries
 * ahead of (or behind) the view, skips unknown ids, holds while locked; stretches, boss slots,
 * fines, speed caps, the drawing order and the report.
 */
import { describe, expect, it } from 'vitest';
import { Entity } from '../../../src/engine/entity';
import { VirtualPad } from '../../../src/engine/input';
import { SoftRenderer } from '../../../src/engine/render-soft';
import type { Renderer } from '../../../src/engine/render';
import type { World } from '../../../src/engine/world';
import { defineEntity } from '../../../src/game/registry';
import '../../../src/game/content/ring/foot/index';
import { ringArtDef } from '../../../src/game/ring/art-def';
import { RING_HOOKS } from '../../../src/game/ring/hooks';
import { laneY } from '../../../src/game/ring/lanes';
import { freshSeed, ringSeed } from '../../../src/game/ring/mission';
import { planRing } from '../../../src/game/ring/plan';
import { RingRunner } from '../../../src/game/ring/runner';
import { shotLiftOf } from '../../../src/game/ring/entity';
import { RING } from '../../../src/game/ring/types';
import { GameSession } from '../../../src/game/session';
import { TUNING } from '../../../src/game/tuning';
import { RingRig, tinyPlan } from './ring-helpers';

/** Logs its draws (the drawing order test). */
const drawLog: string[] = [];
class Marker extends Entity {
  constructor(world: World, x: number, y: number, name: string) {
    super(world, x, y);
    this.type = name;
    this.despawnMargin = Infinity;
  }
  override draw(_r: Renderer): void {
    drawLog.push(this.type);
  }
}

/** A boss stand-in: shootable, dies after 20 hits of anything. */
class TestBoss extends Entity {
  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'enemy';
    this.hp = this.maxHp = 20;
    this.despawnMargin = Infinity;
    this.addTag('enemy', 'shootable', 'boss');
  }
}
defineEntity('test-ring-boss', (w, x, y) => new TestBoss(w, x, y), { category: 'boss' });

describe('RingRunner', () => {
  it('runs the full route (planRing route full) to complete with no errors, skipping unknown ids', () => {
    const session = new GameSession({ characters: ['vincent'], seed: 9 });
    const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
    const runner = new RingRunner({ session, pads, seed: 9, plan: planRing(9, 'normal', { route: 'full' }) });
    runner.world.god = true;
    let complete = 0;
    runner.events.on('complete', () => complete++);
    runner.start();
    for (let i = 0; i < 45_000 && runner.state !== 'complete'; i++) runner.update();
    expect(runner.state).toBe('complete');
    expect(complete).toBe(1);
    const r = runner.report();
    expect(r.errors).toEqual([]);
    expect(r.complete).toBe(true);
    expect(r.distance).toBe(runner.plan.length);
    expect(r.landmarks).toEqual(runner.plan.stretches.map((s) => s.id));
    expect(session.completed).toContain('ring');
    expect(r.maxEntities).toBeLessThanOrEqual(120);
  });

  it('moves the camera at the road speed; the plan cursor follows unless locked', () => {
    const rig = new RingRig({ plan: tinyPlan({ length: 20000 }) });
    rig.run(10);
    const r = rig.runner;
    expect(r.roadSpeed).toBe(RING.cruiseSpeed);
    const x0 = r.camX;
    const d0 = r.planDist;
    rig.run(10);
    expect(r.camX - x0).toBeCloseTo(10 * RING.cruiseSpeed);
    expect(r.planDist - d0).toBeCloseTo(10 * RING.cruiseSpeed);
    r.lockPlan('test');
    expect(r.planLocked).toBe(true);
    rig.run(10);
    expect(r.planDist - d0).toBeCloseTo(10 * RING.cruiseSpeed);
    expect(r.camX - x0).toBeCloseTo(20 * RING.cruiseSpeed);
    r.unlockPlan('test');
    rig.run(10);
    expect(r.planDist - d0).toBeCloseTo(20 * RING.cruiseSpeed);
    // A speed cap (the jam) eases the road down, and back up without it.
    r.limitSpeed('jam', 0.5);
    rig.run(120);
    expect(r.roadSpeed).toBeCloseTo(0.5);
    r.limitSpeed('jam', null);
    rig.run(120);
    expect(r.roadSpeed).toBe(RING.cruiseSpeed);
  });

  it('spawns road entries ahead of the view at their road point, behind entries left of it; skips unknown ids', () => {
    const plan = tinyPlan({
      length: 20000,
      spawns: [
        { at: 1200, id: 'test-ring-target', lane: 2 },
        { at: 900, id: 'test-ring-foe', lane: 4, from: 'behind' },
        { at: 1000, id: 'ring-nothing-yet', lane: 1 },
      ],
    });
    const rig = new RingRig({ plan });
    const r = rig.runner;
    const find = (type: string) => rig.world.entities.find((e) => e.type === type);
    rig.until(() => find('test-ring-target') !== undefined, 1000);
    const t = find('test-ring-target')!;
    // Spawned RING.spawnAhead px beyond the right edge, at the world x of its road point.
    expect(t.x - r.camX).toBeGreaterThan(rig.world.camera.w);
    expect(t.x - r.camX).toBeLessThanOrEqual(rig.world.camera.w + RING.spawnAhead + RING.cruiseSpeed);
    // At its road point (it keeps pace with the road from its first update on).
    expect(r.planX(t.x)).toBeGreaterThanOrEqual(1200);
    expect(r.planX(t.x)).toBeLessThanOrEqual(1200 + RING.cruiseSpeed);
    expect(t.y).toBe(laneY(2));
    rig.until(() => find('test-ring-foe') !== undefined, 1000);
    const f = find('test-ring-foe')!;
    expect(f.x - r.camX).toBeLessThan(0);
    expect(f.y).toBe(laneY(4));
    rig.run(400);
    const rep = r.report();
    expect(rep.skipped).toEqual({ 'ring-nothing-yet': 1 });
    expect(rep.spawned).toBe(2);
    expect(rep.errors).toEqual([]);
  });

  it('emits a stretch per landmark in order and records the route', () => {
    const plan = tinyPlan({ length: 3000, landmarks: ['oost', 'amstel', 'exit'] });
    const rig = new RingRig({ plan });
    const seen: string[] = [];
    rig.runner.events.on('stretch', (e) => seen.push(e.id));
    rig.until(() => rig.runner.state !== 'playing', 2000);
    expect(seen).toEqual(['amstel', 'exit']);
    expect(rig.runner.report().landmarks).toEqual(['oost', 'amstel', 'exit']);
    expect(rig.session.slots[0].mission.route).toEqual(['oost', 'amstel', 'exit']);
  });

  it('starts at a landmark (?section=) with a run-in; entries before it are skipped', () => {
    const plan = tinyPlan({ length: 6000, landmarks: ['oost', 'zuid', 'exit'], spawns: [{ at: 500, id: 'test-ring-target', lane: 1 }] });
    const session = new GameSession({ characters: ['vincent'], seed: 2 });
    const r = new RingRunner({ session, pads: [new VirtualPad(), new VirtualPad()], plan, section: 'zuid' });
    const seen: string[] = [];
    r.events.on('stretch', (e) => seen.push(e.id));
    r.start();
    expect(r.planDist).toBe(2000 - RING.runIn);
    expect(seen).toEqual(['oost']);
    for (let i = 0; i < 200; i++) r.update();
    expect(seen).toEqual(['oost', 'zuid']);
    expect(r.world.entities.some((e) => e.type === 'test-ring-target')).toBe(false);
  });

  it('a boss slot spawns its boss and locks the plan until it is gone; an unknown boss is skipped', () => {
    const plan = { ...tinyPlan({ length: 4000 }), bosses: [{ at: 600, id: 'test-ring-boss', landmark: 'oost' as const }, { at: 3000, id: 'ring-end-marker', landmark: 'exit' as const }] };
    const rig = new RingRig({ plan, god: true });
    const r = rig.runner;
    rig.until(() => r.planLocked, 400);
    const boss = rig.world.byTag('boss')[0];
    expect(boss).toBeDefined();
    const d = r.planDist;
    rig.run(60);
    expect(r.planDist).toBe(d);
    expect(r.roadSpeed).toBe(RING.cruiseSpeed);
    rig.world.damage(boss, { amount: 1e9, kind: 'explosion', dirX: 0, owner: 0 });
    rig.run(2);
    expect(r.planLocked).toBe(false);
    rig.until(() => r.state !== 'playing', 3000);
    const bosses = r.report().bosses;
    expect(bosses.map((b) => [b.id, b.spawned])).toEqual([
      ['test-ring-boss', true],
      ['ring-end-marker', false],
    ]);
    // The time to kill (spawn → gone) of the boss that came; −1 for the marker.
    expect(bosses[0].ticks).toBeGreaterThan(0);
    expect(bosses[1].ticks).toBe(-1);
  });

  it('the plan end calls the exit hook (default: MISSION COMPLETE)', () => {
    let called = 0;
    RING_HOOKS.planEnd = (runner) => {
      called++;
      runner.completeMission();
    };
    try {
      const rig = new RingRig({ plan: tinyPlan({ length: 800 }) });
      rig.until(() => rig.runner.state === 'victory', 600);
      expect(called).toBe(1);
      expect(rig.hero.cheering).toBe(true);
      rig.run(TUNING.transition.victoryTicks + 2);
      expect(rig.runner.state).toBe('complete');
    } finally {
      RING_HOOKS.planEnd = null;
    }
  });

  it('fines: −500 points, never below 0', () => {
    const rig = new RingRig();
    rig.run(2);
    const s = rig.session.slots[0];
    s.score = 700;
    let fines = 0;
    rig.runner.events.on('fine', () => fines++);
    rig.runner.fine(0);
    expect(s.score).toBe(200);
    rig.runner.fine(0);
    expect(s.score).toBe(0);
    expect(fines).toBe(2);
    expect(rig.runner.report().fines).toBe(2);
  });

  it('draws far lanes first (y · 100 + z) and the hero shots raised by the gun height', () => {
    const rig = new RingRig();
    rig.run(2);
    const w = rig.world;
    const cx = w.camera.x + 200;
    w.add(new Marker(w, cx, laneY(4), 'near'));
    w.add(new Marker(w, cx, laneY(1), 'far'));
    w.add(new Marker(w, cx, laneY(2), 'mid'));
    w.flush();
    drawLog.length = 0;
    const r = new SoftRenderer();
    r.begin(rig.runner.sky);
    rig.runner.draw(r);
    r.end();
    expect(drawLog).toEqual(['far', 'mid', 'near']);
    rig.tap(['fire']);
    const shot = w.byTag('shot')[0];
    expect(shot).toBeDefined();
    // The hero's torso strip sets the lift (the forward aim's muzzle height, wagon.md §5).
    expect(shotLiftOf(shot)).toBe(rig.hero.shotLift);
    expect(shotLiftOf(shot)).toBeGreaterThan(0);
    expect(w.errors).toEqual([]);
  });

  it('revision R: the short route (the default) ends in the alight and hands over: no victory, no tally, the stats stay', () => {
    const session = new GameSession({ characters: ['vincent'], seed: 9 });
    const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
    const runner = new RingRunner({ session, pads, seed: 9 });
    expect(runner.plan.route).toBe('short');
    runner.world.god = true;
    let handover = 0;
    let complete = 0;
    runner.events.on('handover', () => handover++);
    runner.events.on('complete', () => complete++);
    runner.start();
    const slot = session.slots[0];
    slot.addScore(1234);
    for (let i = 0; i < 20_000 && runner.state === 'playing'; i++) runner.update();
    expect(runner.state).toBe('handover');
    expect(runner.handedOver).toBe(true);
    for (let i = 0; i < 30; i++) runner.update();
    expect(handover).toBe(1);
    expect(complete).toBe(0);
    expect(session.completed).not.toContain('ring');
    expect(slot.score).toBeGreaterThanOrEqual(1234);
    expect(slot.mission.route).toEqual(['oost', 'amstel', 'zuid']);
    const r = runner.report();
    expect(r.errors).toEqual([]);
    expect(r.route).toBe('short');
    expect(r.handedOver).toBe(true);
    expect(r.complete).toBe(false);
    expect(r.distance).toBe(runner.plan.length);
  });

  it('gives the art definition its stretches, the drivers and the always-resident art', () => {
    const plan = planRing(3, 'normal');
    const def = ringArtDef(plan, ['thom', null]);
    // Revision R: the stretches, the train's pseudo-sections after zuid, the foot sections.
    expect(Object.keys(def.sections ?? {})).toEqual([...plan.stretches.map((s) => s.id), 'zwaan:0', 'zwaan:1', 'zwaan:2', 'zwaan:3', 'zwaan:4', 'rf-a', 'rf-b']);
    expect(def.extraChar).toEqual(['char/thom/ride-', 'char/thom/mount']);
    expect(def.preloadFirst).toContain('ring/wagon/');
    expect(def.start).toBe(plan.stretches[0].id);
    for (const s of plan.stretches) expect(def.sections?.[s.id].art).toContain(`decor/ring/${s.id}/`);
  });

  it('a fresh seed is a 32-bit number; a given seed wins', () => {
    const a = freshSeed();
    expect(Number.isInteger(a) && a > 0 && a <= 0xffffffff).toBe(true);
    expect(ringSeed(42)).toBe(42);
    expect(ringSeed(null)).toBeGreaterThan(0);
  });
});
