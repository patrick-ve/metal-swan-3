import { describe, expect, it } from 'vitest';
import { InputManager, ScriptedSource, timeline } from '../../src/engine/input';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Renderer } from '../../src/engine/render';
import { defineSprite } from '../../src/engine/sprites';
import { RIDE_POSES } from '../../src/game/player/player';
import { TUNING } from '../../src/game/tuning';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, Rig } from './helpers';

/** A renderer that only records sprite calls (drawRide needs nothing else). */
function spriteLog(): { r: Renderer; calls: { id: string; frame: number; x: number; y: number }[] } {
  const calls: { id: string; frame: number; x: number; y: number }[] = [];
  const r = { sprite: (id: string, frame: number, x: number, y: number) => calls.push({ id, frame, x, y }) } as unknown as Renderer;
  return { r, calls };
}

describe('player movement', () => {
  it('runs at the tuned speed and turns instantly', () => {
    const rig = new Rig();
    const x0 = rig.p.x;
    rig.hold(['right']).run(60);
    expect(rig.p.vx).toBeCloseTo(TUNING.player.runSpeed, 5);
    expect(rig.p.x - x0).toBeGreaterThan(TUNING.player.runSpeed * 58);
    expect(rig.p.body.onGround).toBe(true);
    expect(rig.p.legs.id).toBe('char/recruit/legs-run');
    rig.hold(['left']).run(3);
    expect(rig.p.facing).toBe(-1);
    expect(rig.p.vx).toBeLessThan(0);
  });

  it('jumps a fixed height with ~54 ticks of air time', () => {
    const measure = (holdTicks: number): { apex: number; air: number } => {
      const rig = new Rig();
      rig.hold(['jump']).run(1);
      let apex = 0;
      let air = 1;
      for (let i = 0; i < 120; i++) {
        if (i === holdTicks) rig.release();
        rig.run(1);
        apex = Math.max(apex, FLOOR - rig.p.y);
        if (rig.p.body.onGround) break;
        air++;
      }
      return { apex, air };
    };
    const tap = measure(1);
    const held = measure(40);
    expect(tap.apex).toBeGreaterThan(44);
    expect(tap.apex).toBeLessThan(56);
    expect(tap.air).toBeGreaterThan(50);
    expect(tap.air).toBeLessThan(66);
    // No variable jump height: holding the button changes nothing.
    expect(held.apex).toBeCloseTo(tap.apex, 5);
  });

  it('jumps farther when running (take-off boost, air speed above the walk speed)', () => {
    const rig = new Rig();
    rig.hold(['right']).run(20).hold(['right', 'jump']).run(1).hold(['right']);
    rig.run(10);
    expect(rig.p.body.onGround).toBe(false);
    expect(rig.p.vx).toBeGreaterThan(TUNING.player.runSpeed + 0.2);
    expect(rig.p.vx).toBeLessThanOrEqual(TUNING.player.airMaxSpeed + 1e-9);
  });

  it('allows a jump a few ticks after walking off a ledge (coyote time)', () => {
    const rig = new Rig({ noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(140).step(60).flat(800) });
    rig.p.placeAt(130, FLOOR, 0);
    rig.hold(['right']);
    rig.until(() => !rig.p.body.onGround, 60);
    rig.run(2);
    rig.hold(['right', 'jump']).run(1);
    expect(rig.p.vy).toBeLessThan(0);
  });

  it('buffers a jump pressed just before landing', () => {
    const rig = new Rig();
    rig.tap(['jump']);
    rig.until(() => rig.p.vy > 0 && FLOOR - rig.p.y < 9, 80);
    // Press while still falling, two or three ticks above the floor.
    rig.hold(['jump']).run(1).release();
    rig.until(() => rig.p.body.onGround || rig.p.vy < 0, 40);
    rig.run(3);
    expect(rig.p.vy).toBeLessThan(0);
  });

  it('crouches, crouch-walks slower, and stands up again', () => {
    const rig = new Rig();
    rig.hold(['down']).run(2);
    expect(rig.p.crouching).toBe(true);
    expect(rig.p.body.h).toBe(TUNING.player.crouchBodyH);
    expect(rig.p.hitRect().h).toBe(TUNING.player.crouchBodyH);
    rig.hold(['down', 'right']).run(20);
    expect(rig.p.vx).toBeCloseTo(TUNING.player.crawlSpeed, 5);
    expect(rig.p.legs.id).toBe('char/recruit/legs-crouch-walk');
    rig.release().run(1);
    expect(rig.p.crouching).toBe(false);
    expect(rig.p.body.h).toBe(TUNING.player.bodyH);
  });

  it('stays crouched under a low ceiling', () => {
    const rig = new Rig({ build: (t) => t.solid(80, FLOOR - 26, 60, 10) });
    rig.p.placeAt(110, FLOOR, 0);
    rig.hold(['down']).run(2).release().run(2);
    expect(rig.p.crouching).toBe(true);
  });

  it('follows slopes up and down without leaving the ground', () => {
    const rig = new Rig({ noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(150).slope(120, -60).flat(100).slope(120, 60).flat(400) });
    rig.hold(['right']);
    for (let i = 0; i < 300; i++) {
      rig.run(1);
      expect(rig.p.body.onGround).toBe(true);
      expect(Math.abs(rig.p.y - rig.world.terrain.groundY(rig.p.x))).toBeLessThan(0.01);
    }
    expect(rig.p.x).toBeGreaterThan(450);
  });

  it('drops through a one-way platform with down + jump', () => {
    const rig = new Rig({ build: (t) => t.platform(40, 130, 200) });
    rig.p.placeAt(100, 120, 0);
    expect(rig.p.y).toBe(130);
    rig.hold(['down', 'jump']).run(1).release();
    rig.until(() => rig.p.body.onGround && rig.p.y > 160, 80);
    expect(rig.p.y).toBe(FLOOR);
  });

  it('aims up anytime and down only in the air', () => {
    const rig = new Rig();
    rig.hold(['up']).run(1);
    expect(rig.p.aim).toBe('up');
    rig.hold(['down']).run(1);
    expect(rig.p.aim).toBe('forward');
    expect(rig.p.crouching).toBe(true);
    rig.release().run(1).tap(['jump']);
    rig.hold(['down']).run(2);
    expect(rig.p.aim).toBe('down');
  });

  it('aims 45° up with up + left/right (feet planted), 90° with up alone (GDD 4.3)', () => {
    const rig = new Rig();
    rig.hold(['up', 'right']).run(2);
    expect(rig.p.elev).toBeCloseTo(-Math.PI / 4, 9);
    expect(rig.p.aimAngle).toBeCloseTo(-Math.PI / 4, 9);
    expect(rig.p.vx).toBe(0);
    rig.hold(['up', 'left']).run(2);
    expect(rig.p.facing).toBe(-1);
    expect(rig.p.vx).toBe(0);
    expect((Math.atan2(Math.sin(rig.p.aimAngle), Math.cos(rig.p.aimAngle)) * 180) / Math.PI).toBeCloseTo(-135, 9);
    rig.hold(['up']).run(1);
    expect(rig.p.elev).toBeCloseTo(-Math.PI / 2, 9);
    // In the air: up + side is the diagonal too, down is straight down (no down-diagonal).
    rig.release().run(1).tap(['jump']);
    rig.hold(['down', 'right']).run(2);
    expect(rig.p.elev).toBeCloseTo(Math.PI / 2, 9);
  });

  it('is kept inside the view by the camera edges', () => {
    const rig = new Rig({ x: 40 });
    rig.hold(['left']).run(80);
    expect(rig.p.x).toBeGreaterThanOrEqual(rig.world.camera.left + rig.p.body.w / 2 - 1e-6);
  });

  it('is driven through an InputManager + ScriptedSource like the real game', () => {
    const rig = new Rig();
    const input = new InputManager();
    input.addSource(new ScriptedSource(timeline().hold('right', 30).hold(['right', 'jump'], 2).hold('right', 30), 0));
    const x0 = rig.p.x;
    let left = false;
    for (let i = 0; i < 62; i++) {
      input.update();
      rig.pads[0].update(input.pad(0).mask);
      rig.world.update();
      if (!rig.p.body.onGround) left = true;
    }
    expect(left).toBe(true);
    expect(rig.p.x - x0).toBeGreaterThan(90);
  });

  it('applies status effects (speed, no jump, forced weapon) and ends them on time', () => {
    const rig = new Rig();
    rig.p.status.add({ id: 'goo', ticks: 30, speed: 0.5, noJump: true, weapon: 'machine-gun' });
    rig.hold(['right']).run(10);
    expect(rig.p.vx).toBeCloseTo(TUNING.player.runSpeed * 0.5, 5);
    expect(rig.p.weapon.id).toBe('machine-gun');
    rig.hold(['right', 'jump']).run(1);
    expect(rig.p.body.onGround).toBe(true);
    rig.release().run(25);
    expect(rig.p.status.has('goo')).toBe(false);
    expect(rig.p.weapon.id).toBe('pistol');
  });

  it('down + jump on a platform over deep water is a normal jump, never a drop (GDD 4.2)', () => {
    const rig = new Rig({ build: (t) => t.platform(40, 130, 200).hazard('water', 0, 150, 400, 66) });
    rig.p.placeAt(100, 120, 0);
    expect(rig.p.y).toBe(130);
    rig.hold(['down', 'jump']).run(1).release();
    expect(rig.p.vy).toBeLessThan(0);
    rig.run(4);
    rig.until(() => rig.p.body.onGround, 80);
    expect(rig.p.y).toBe(130);
    expect(rig.p.alive).toBe(true);
  });

  it('drawRide: ride-<pose>, else ride-sit, else mount frame 1 drawn 17 px lower; it blinks while invulnerable', () => {
    const rig = new Rig();
    const p = rig.p;
    p.invulnTicks = 0;
    const { r, calls } = spriteLog();
    expect(RIDE_POSES).toEqual(['sit', 'lean', 'up', 'hunch', 'hold', 'brace', 'duck', 'ears', 'cheer']);
    p.drawRide(r, 50, 100, false, 'up');
    expect(calls.at(-1)).toEqual({ id: `${p.art}/mount`, frame: 1, x: 50, y: 117 });
    defineSprite(`${p.art}/ride-sit`, () => [new PixelBuffer(4, 4), new PixelBuffer(4, 4)], { ticksPerFrame: 20 });
    p.drawRide(r, 50, 100, true, 'up');
    expect(calls.at(-1)).toEqual({ id: `${p.art}/ride-sit`, frame: 0, x: 50, y: 100 });
    defineSprite(`${p.art}/ride-up`, () => new PixelBuffer(4, 4));
    // Unrounded: the renderer snaps to 1/res, so the rider stays locked to the Swan's sub-pixel position.
    p.drawRide(r, 50.4, 99.6, false, 'up', 0);
    expect(calls.at(-1)).toEqual({ id: `${p.art}/ride-up`, frame: 0, x: 50.4, y: 99.6 });
    // Invulnerable: hidden on the odd blink phases.
    p.invulnTicks = 100;
    let hidden = 0;
    for (let i = 0; i < 2 * TUNING.life.respawnBlinkTicks; i++) {
      const n = calls.length;
      p.drawRide(r, 0, 0, false, 'sit');
      if (calls.length === n) hidden++;
      rig.world.tick++;
    }
    expect(hidden).toBe(TUNING.life.respawnBlinkTicks);
  });

  it('a mounted player at the mission end stays seated and only raises `cheering`', () => {
    class Seat extends Vehicle {}
    const rig = new Rig();
    const v = new Seat(rig.world, 200, FLOOR, {}, { art: 'vehicle/test-seat', seat: { x: -10, y: -34, w: 20, h: 14 } });
    rig.world.add(v);
    rig.world.flush();
    v.mount(rig.p);
    expect(rig.p.state).toBe('mounted');
    expect(rig.p.cheering).toBe(false);
    rig.p.victory();
    expect(rig.p.state).toBe('mounted');
    expect(rig.p.cheering).toBe(true);
  });
});
