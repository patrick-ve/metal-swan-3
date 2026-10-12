import { describe, expect, it } from 'vitest';
import { Camera, type CameraTarget } from '../../src/engine/camera';
import { Rng } from '../../src/engine/rng';

function cam(w = 3000, h = 216): Camera {
  const c = new Camera(384, 216, new Rng(1));
  c.setBounds({ x: 0, y: 0, w, h });
  return c;
}

describe('camera', () => {
  it('follows with a lead and never scrolls back in a right-scrolling section', () => {
    const c = cam();
    const p = { x: 200, y: 170, facing: 1 };
    c.follow(p);
    c.snap();
    expect(c.x).toBeCloseTo(200 + c.lead - 192, 6);
    for (let i = 0; i < 300; i++) {
      p.x += 1.5;
      c.update();
    }
    const far = c.x;
    expect(far).toBeGreaterThan(400);
    p.facing = -1;
    for (let i = 0; i < 200; i++) {
      p.x -= 1.5;
      c.update();
      expect(c.x).toBeGreaterThanOrEqual(far);
    }
  });

  it('free scrolling follows both ways', () => {
    const c = cam();
    c.scroll = 'free';
    const p = { x: 1000, y: 170, facing: 1 };
    c.follow(p);
    c.snap();
    p.x = 600;
    for (let i = 0; i < 200; i++) c.update();
    expect(c.x).toBeLessThan(600);
  });

  it('stays inside the bounds', () => {
    const c = cam(1000);
    const p = { x: 20, y: 170, facing: -1 };
    c.follow(p);
    c.snap();
    expect(c.x).toBe(0);
    p.x = 990;
    c.scroll = 'free';
    for (let i = 0; i < 300; i++) c.update();
    expect(c.x).toBe(1000 - 384);
  });

  it('locks to an arena with a smooth settle and releases on unlock', () => {
    const c = cam();
    const p = { x: 900, y: 170, facing: 1 };
    c.follow(p);
    c.snap();
    c.lock(1000, 1384);
    let prev = c.x;
    let maxStep = 0;
    for (let i = 0; i < 120; i++) {
      c.update();
      maxStep = Math.max(maxStep, Math.abs(c.x - prev));
      prev = c.x;
    }
    expect(c.x).toBe(1000);
    expect(maxStep).toBeLessThanOrEqual(c.maxSpeed);
    expect(maxStep).toBeGreaterThan(0);
    p.x = 1500; // would pull the camera right, but the lock holds
    for (let i = 0; i < 60; i++) c.update();
    expect(c.x).toBe(1000);
    c.unlock();
    for (let i = 0; i < 120; i++) c.update();
    expect(c.x).toBeGreaterThan(1100);
  });

  it('keeps two targets in view and centres between them', () => {
    const c = cam();
    const a: CameraTarget & { x: number } = { x: 500, y: 170, facing: 1 };
    const b: CameraTarget & { x: number } = { x: 800, y: 170, facing: -1 };
    c.follow([a, b]);
    c.snap();
    expect(c.x).toBeLessThanOrEqual(500 - c.margin);
    expect(c.x + c.w).toBeGreaterThanOrEqual(800 + c.margin);
    expect(c.centerX).toBeCloseTo(650, 6);
    // Dead targets are ignored.
    const dead = { x: 2000, y: 170, dead: true };
    c.follow([a, dead]);
    c.snap();
    expect(c.x).toBeLessThan(500);
  });

  it('vertical dead zone ignores small jumps; up-scrolling never goes back down', () => {
    const c = cam(384, 1000);
    c.scroll = 'up';
    const p = { x: 192, y: 900, facing: 1 };
    c.follow(p);
    c.snap();
    const y0 = c.y;
    p.y = 880; // 20 px jump: inside the dead zone
    for (let i = 0; i < 60; i++) c.update();
    expect(c.y).toBe(y0);
    p.y = 600;
    for (let i = 0; i < 200; i++) c.update();
    const high = c.y;
    expect(high).toBeLessThan(y0 - 200);
    p.y = 900;
    for (let i = 0; i < 200; i++) c.update();
    expect(c.y).toBe(high);
  });

  it('shake is deterministic, fades out, and respects shakeScale', () => {
    const run = (): number[] => {
      const c = cam();
      c.shake(4, 10);
      const out: number[] = [];
      for (let i = 0; i < 12; i++) {
        c.update();
        out.push(c.shakeX, c.shakeY);
      }
      return out;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.some((v) => v !== 0)).toBe(true);
    expect(a.slice(-4)).toEqual([0, 0, 0, 0]);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(4);
    const c = cam();
    c.shakeScale = 0;
    c.shake(8, 10);
    c.update();
    expect(c.shakeX).toBe(0);
    expect(c.renderX).toBe(Math.round(c.x));
  });

  it('view helpers and clamps', () => {
    const c = cam();
    c.x = 100;
    c.y = 0;
    expect(c.view()).toEqual({ x: 100, y: 0, w: 384, h: 216 });
    expect(c.inView({ x: 480, y: 10, w: 10, h: 10 })).toBe(true);
    expect(c.inView({ x: 490, y: 10, w: 10, h: 10 })).toBe(false);
    expect(c.inView({ x: 490, y: 10, w: 10, h: 10 }, 8)).toBe(true);
    expect(c.clampX(90, 7)).toBe(107);
    expect(c.clampX(500, 7)).toBe(477);
    expect(c.clampY(5, 30)).toBe(30);
  });
});
