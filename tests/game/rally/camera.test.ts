/**
 * The race cameras (src/game/rally/camera.ts; docs/design/rally.md §7.6): the chase camera on a
 * soft spring (no jitter at speed, a look-ahead into corners), the bumper camera, the look back, the
 * results orbit, the split-screen field of view, and that a camera never changes the race.
 */
import { describe, expect, it } from 'vitest';
import { cosT, sinT } from '../../../src/engine/r3/trig';
import type { Cam3 } from '../../../src/engine/view3d';
import { CAM, FOV_FULL, FOV_SPLIT, newCam, newRig, rallyCam, stepRig } from '../../../src/game/rally/camera';
import { trackInfo } from '../../../src/game/rally/track-info';
import { RallyBot } from '../../../src/sim/bot-rally';
import { COUNTDOWN_TICKS } from '../../../src/game/rally/runner';
import { race, ringTrack, straightTrack, trackOf } from './helpers';

const DEG = Math.PI / 180;

/** The camera's view direction (horizontal). */
function look(c: Cam3): [number, number] {
  return [sinT(c.yaw), cosT(c.yaw)];
}

describe('the chase camera', () => {
  it('sits behind and above the car, looks along it and a little down; about 65° (1P), narrower in a split view', () => {
    const h = race({ track: straightTrack() });
    h.input.addSource(new RallyBot(() => h.runner));
    h.step(COUNTDOWN_TICKS + 300);
    const car = h.car();
    const cam = newCam();
    h.runner.camera(0, cam, false);
    const [lx, lz] = look(cam);
    const dx = car.pos[0] - cam.pos[0];
    const dz = car.pos[2] - cam.pos[2];
    const d = Math.hypot(dx, dz);
    expect(d).toBeGreaterThan(CAM.dist - 0.1);
    expect(d).toBeLessThan(CAM.dist + CAM.distFast + 0.5);
    expect((dx * lx + dz * lz) / d).toBeGreaterThan(0.99);
    expect(cam.pos[1] - car.pos[1]).toBeGreaterThan(CAM.height - 0.2);
    expect(cam.pitch).toBeLessThan(0);
    expect(cam.fovY).toBeGreaterThanOrEqual(FOV_FULL);
    expect(cam.fovY).toBeLessThan(FOV_FULL + 6 * DEG);
    expect(FOV_FULL).toBeCloseTo(65 * DEG, 9);
    // The split view: the same horizontal view in a 384 × 108 window.
    h.runner.camera(0, cam, true);
    expect(cam.fovY).toBeLessThan(FOV_SPLIT + 4 * DEG);
    const hFull = 2 * Math.atan((384 / 216) * Math.tan(FOV_FULL / 2));
    const hSplit = 2 * Math.atan((384 / 108) * Math.tan(FOV_SPLIT / 2));
    expect(Math.abs(hFull - hSplit)).toBeLessThan(6 * DEG);
  });

  it('no jitter at 200 km/h: on the straight the camera moves with the car, smoothly, every tick', () => {
    const h = race({ track: straightTrack() });
    h.input.addSource(new RallyBot(() => h.runner));
    h.step(COUNTDOWN_TICKS);
    const car = h.car();
    for (let i = 0; i < 4000 && car.speed < 55; i++) h.step();
    expect(car.speed).toBeGreaterThan(55);
    const cam = newCam();
    const xs: number[] = [];
    const ys: number[] = [];
    const yaws: number[] = [];
    for (let i = 0; i < 60; i++) {
      h.step();
      h.runner.camera(0, cam, false);
      xs.push(cam.pos[2]);
      ys.push(cam.pos[1]);
      yaws.push(cam.yaw);
    }
    for (let i = 2; i < xs.length; i++) {
      const acc = xs[i] - 2 * xs[i - 1] + xs[i - 2];
      expect(Math.abs(acc)).toBeLessThan(0.01);
      expect(Math.abs(ys[i] - ys[i - 1])).toBeLessThan(0.01);
      expect(Math.abs(yaws[i] - yaws[i - 1])).toBeLessThan(0.002);
    }
  });

  it('a soft spring: in a turn the heading lags the car a little and settles without swinging past it', () => {
    const rig = newRig();
    const car = race({ track: ringTrack() }).car();
    car.speed = 40;
    stepRig(rig, car, null, false, false);
    // The car turns 0.5 rad at once (a hard swerve): the camera follows within a second, critically damped.
    car.yaw += 0.5;
    let maxPast = 0;
    let lag = 0;
    for (let i = 0; i < 90; i++) {
      stepRig(rig, car, null, false, false);
      lag = car.yaw - rig.yaw;
      maxPast = Math.max(maxPast, -lag);
      if (i === 5) expect(lag).toBeGreaterThan(0.2);
    }
    expect(Math.abs(lag)).toBeLessThan(0.01);
    expect(maxPast).toBeLessThan(0.01);
    // The lag never grows beyond its cap.
    car.yaw += 2;
    stepRig(rig, car, null, false, false);
    expect(car.yaw - rig.yaw).toBeLessThanOrEqual(CAM.yawLagMax + 1e-9);
  });

  it('looks a little into the corner ahead (a left bend: the camera turns left of the car)', () => {
    // A straight that bends left (+ yaw) after 300 m.
    const pts: number[] = [];
    for (let i = 0; i <= 6; i++) pts.push(0, 0, i * 50);
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push(250 - 250 * Math.cos(a), 0, 300 + 250 * Math.sin(a));
    }
    pts.push(400, 0, 700, 300, 0, 900, -200, 0, 500, -150, 0, -100);
    const t = trackOf(pts, { startS: 200 });
    const info = trackInfo(t);
    const h = race({ track: t });
    const car = h.car();
    const sp = t.spline.sample(285);
    car.pos[0] = sp.p[0];
    car.pos[2] = sp.p[2];
    car.s = 285;
    car.yaw = Math.atan2(sp.t[0], sp.t[2]);
    car.speed = 45;
    const rig = newRig();
    for (let i = 0; i < 90; i++) stepRig(rig, car, info, false, false);
    const turn = info.curv[Math.floor(320 / info.bin)];
    expect(turn).toBeGreaterThan(0);
    expect(car.phys.yawRate).toBe(0);
    expect(rig.yaw - car.yaw).toBeGreaterThan(0.015);
    expect(rig.yaw - car.yaw).toBeLessThanOrEqual(CAM.lookAheadMax + 1e-9);
  });
});

describe('the bumper camera, the look back, the orbit', () => {
  it('bumper: at the nose, low, rigid to the car; looking back: from the rear bumper, backwards', () => {
    const h = race({ track: straightTrack(), cam: 'bumper' });
    h.input.addSource(new RallyBot(() => h.runner));
    h.step(COUNTDOWN_TICKS + 200);
    const car = h.car();
    const cam = newCam();
    h.runner.camera(0, cam, false);
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    const ahead = (cam.pos[0] - car.pos[0]) * fx + (cam.pos[2] - car.pos[2]) * fz;
    expect(ahead).toBeCloseTo(car.phys.h.halfLen - CAM.bumperIn, 1);
    expect(cam.pos[1] - car.pos[1]).toBeCloseTo(CAM.bumperHeight, 1);
    expect(cam.yaw).toBeCloseTo(car.yaw, 9);
    const rig = h.runner.rigs[0];
    rig.back = true;
    rallyCam('bumper', car, cam, false, rig);
    expect(Math.cos(cam.yaw - car.yaw)).toBeLessThan(-0.999);
    rallyCam('chase', car, cam, false, rig);
    const front = (cam.pos[0] - car.pos[0]) * fx + (cam.pos[2] - car.pos[2]) * fz;
    expect(front).toBeGreaterThan(CAM.dist - 0.5);
    expect(Math.cos(cam.yaw - car.yaw)).toBeLessThan(-0.999);
  });

  it('the results orbit circles the car at its radius, looking at it, from where the chase camera was', () => {
    const rig = newRig();
    const car = race({ track: ringTrack() }).car();
    car.speed = 20;
    for (let i = 0; i < 30; i++) stepRig(rig, car, null, false, false);
    const cam = newCam();
    rallyCam('chase', car, cam, false, rig);
    const before = Math.atan2(cam.pos[0] - car.pos[0], cam.pos[2] - car.pos[2]);
    stepRig(rig, car, null, false, true);
    rallyCam('chase', car, cam, false, rig);
    const a0 = Math.atan2(cam.pos[0] - car.pos[0], cam.pos[2] - car.pos[2]);
    expect(Math.cos(a0 - before)).toBeGreaterThan(0.99);
    expect(Math.hypot(cam.pos[0] - car.pos[0], cam.pos[2] - car.pos[2])).toBeCloseTo(CAM.orbitRadius, 4);
    for (let i = 0; i < 100; i++) stepRig(rig, car, null, false, true);
    rallyCam('bumper', car, cam, false, rig); // the orbit overrides either camera
    const a1 = Math.atan2(cam.pos[0] - car.pos[0], cam.pos[2] - car.pos[2]);
    expect(Math.abs(Math.sin(a1 - a0))).toBeGreaterThan(0.5);
    const [lx, lz] = look(cam);
    const tx = car.pos[0] - cam.pos[0];
    const tz = car.pos[2] - cam.pos[2];
    expect((lx * tx + lz * tz) / Math.hypot(tx, tz)).toBeGreaterThan(0.999);
    expect(cam.pitch).toBeLessThan(0);
  });

  it('a car without a rig gets the rigid camera (PREP\'s call keeps working)', () => {
    const car = race({ track: ringTrack() }).car();
    const free = { ...car, phys: car.phys };
    const cam = rallyCam('chase', free, newCam(), false);
    const d = Math.hypot(cam.pos[0] - car.pos[0], cam.pos[2] - car.pos[2]);
    expect(d).toBeCloseTo(CAM.dist, 4);
    expect(cam.yaw).toBe(car.yaw);
  });
});

describe('cameras are cosmetic', () => {
  it('placing cameras any number of times never changes the race (the same state hash)', () => {
    const run = (cams: boolean): number => {
      const h = race({ track: ringTrack(), players: 2 });
      h.input.addSource(new RallyBot(() => h.runner));
      const cam = newCam();
      for (let i = 0; i < 2500; i++) {
        h.step();
        if (cams && i % 3 === 0) {
          h.runner.camera(0, cam, true);
          h.runner.camera(1, cam, true);
          rallyCam('bumper', h.car(0), cam, false);
        }
      }
      return h.runner.stateHash();
    };
    expect(run(true)).toBe(run(false));
  });
});
