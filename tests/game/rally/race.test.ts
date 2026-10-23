/**
 * The race state (src/game/rally/runner.ts; docs/design/rally.md §2, §7.6, §10): the grid and the
 * countdown, laps, places, the finish and the projected times, finishNow, the field size, the
 * cameras per slot, the events, the recovery in a race, the report.
 */
import { describe, expect, it } from 'vitest';
import { ScriptedSource } from '../../../src/engine/input';
import { newCam } from '../../../src/game/rally/camera';
import { COUNTDOWN_TICKS, CRUISE_PACE, FINISH_HOLD, RIVALS_1P, RIVALS_2P } from '../../../src/game/rally/runner';
import { PHYS } from '../../../src/game/rally/physics';
import { RallyBot } from '../../../src/sim/bot-rally';
import { ovalTrack, race, ringTrack } from './helpers';

/** A scripted race channel for slot `slot` (a function of the source's tick). */
function driver(fn: (t: number) => { steer?: number; gas?: number; brake?: number; buttons?: number }, slot: 0 | 1 = 0): ScriptedSource {
  return new ScriptedSource(() => 0, slot, {
    race: (t, o) => {
      const v = fn(t);
      o.steer = v.steer ?? 0;
      o.gas = v.gas ?? 0;
      o.brake = v.brake ?? 0;
      o.buttons = v.buttons ?? 0;
    },
  });
}

describe('the grid and the countdown', () => {
  it('8 cars: the player estates first, then 7 rivals (1P) or 6 (2P); two wide behind the line', () => {
    const one = race();
    expect(one.runner.cars).toHaveLength(1 + RIVALS_1P);
    expect(one.runner.cars[0].slot).toBe(0);
    expect(one.runner.cars[0].spec.model).toBe('estate-white');
    expect(one.runner.cars.slice(1).every((c) => c.slot === -1)).toBe(true);
    const two = race({ players: 2 });
    expect(two.runner.cars).toHaveLength(2 + RIVALS_2P);
    expect(two.car(1).spec.model).toBe('estate-green');
    expect(new Set(one.runner.cars.map((c) => c.id)).size).toBe(8);
    for (const c of one.runner.cars) expect(c.dist).toBeLessThan(0);
  });

  it('3-2-1: nothing races before GO; a jump start only creeps; GO at COUNTDOWN_TICKS with the start event', () => {
    const h = race();
    h.input.addSource(driver(() => ({ gas: 127 })));
    let go = -1;
    h.runner.events.on('start', (e) => (go = e.tick));
    expect(h.runner.countdown).toBe(COUNTDOWN_TICKS);
    h.step(COUNTDOWN_TICKS - 1);
    expect(h.runner.phase).toBe('grid');
    expect(h.runner.countdown).toBe(1);
    expect(h.car().speed).toBeLessThanOrEqual(PHYS.creep + 1e-3);
    expect(h.car().speed).toBeGreaterThan(0);
    for (const c of h.runner.cars.slice(1)) expect(c.speed).toBe(0);
    h.step(1);
    expect(h.runner.phase).toBe('race');
    expect(go).toBe(COUNTDOWN_TICKS);
    expect(h.runner.countdown).toBe(0);
    h.step(120);
    expect(h.car().speed).toBeGreaterThan(11);
    // The rivals start row by row (each keeps its gap to the car ahead).
    expect(h.runner.cars.slice(1).every((c) => c.speed > 3)).toBe(true);
  });
});

describe('laps, places and the finish', () => {
  it('a bot race on a short track: 3 laps each, lap events, the place by distance, the finish, projected times, complete', () => {
    const h = race({ track: ovalTrack() });
    h.input.addSource(new RallyBot(() => h.runner));
    const laps: string[] = [];
    const finishes: { car: string; place: number; projected: boolean }[] = [];
    let complete = 0;
    h.runner.events.on('lap', (e) => laps.push(`${e.car}:${e.lap}`));
    h.runner.events.on('finish', (e) => finishes.push(e));
    h.runner.events.on('complete', () => complete++);
    for (let i = 0; i < 20000 && !h.runner.done; i++) {
      h.step();
      // The order is always sorted: finished first (by time), then by distance.
      const o = h.runner.race.order;
      for (let k = 1; k < o.length; k++) {
        const a = o[k - 1];
        const b = o[k];
        if (a.finished && b.finished) expect(a.finishTicks).toBeLessThanOrEqual(b.finishTicks);
        else if (!a.finished && !b.finished) expect(a.dist).toBeGreaterThanOrEqual(b.dist);
        else expect(a.finished).toBe(true);
        expect(a.place).toBe(k);
      }
    }
    expect(complete).toBe(1);
    expect(h.runner.phase).toBe('done');
    const me = h.car();
    expect(me.lapTicks).toHaveLength(3);
    expect(me.finished && !me.projected).toBe(true);
    expect(laps.filter((l) => l.startsWith(`${me.id}:`))).toEqual([`${me.id}:1`, `${me.id}:2`, `${me.id}:3`]);
    expect(me.finishTicks).toBe(me.lapTicks.reduce((a, b) => a + b, 0));
    // Every car has a time; the projected ones come after the real ones and keep the order.
    expect(finishes).toHaveLength(8);
    const order = h.runner.race.order;
    for (let k = 1; k < order.length; k++) expect(order[k].finishTicks).toBeGreaterThan(order[k - 1].finishTicks);
    expect(h.session.completed).toContain('rally');
    // The results hold, then complete.
    expect(h.runner.tick - (COUNTDOWN_TICKS + me.finishTicks)).toBeGreaterThanOrEqual(FINISH_HOLD);
    const rep = h.runner.report();
    expect(rep.complete).toBe(true);
    expect(rep.places).toEqual([me.place]);
    expect(rep.bestLap).toEqual([Math.min(...me.lapTicks)]);
    expect(rep.topKmh![0]).toBeGreaterThan(120);
    expect(rep.scrapes).toHaveLength(1);
  });

  it('a finished car cruises on in the right lane as a ghost; its player view orbits it', () => {
    const h = race({ track: ovalTrack(), players: 2 });
    // Only P1 drives; P2 stands: P1 finishes first and the race goes on for P2.
    const bot = new RallyBot(() => h.runner);
    bot.slots[1] = false;
    h.input.addSource(bot);
    for (let i = 0; i < 20000 && !h.car(0).finished; i++) h.step();
    const p1 = h.car(0);
    expect(p1.finished).toBe(true);
    expect(h.runner.phase).toBe('race');
    h.step(400);
    expect(p1.phys.ghost).toBe(true);
    expect(h.runner.drivers[h.runner.cars.indexOf(p1)].pace).toBe(CRUISE_PACE);
    expect(h.runner.rigs[0].orbit).toBe(true);
    expect(p1.speed).toBeGreaterThan(5);
    const cam = newCam();
    expect(h.runner.camera(0, cam, true)).toBe(true);
    const d = Math.hypot(cam.pos[0] - p1.pos[0], cam.pos[2] - p1.pos[2]);
    expect(d).toBeGreaterThan(7);
    expect(d).toBeLessThan(10);
  });

  it('?lap=2: the race starts on lap 2 (two laps to drive) and the par follows', () => {
    const h = race({ track: ovalTrack(), lap: 2 });
    h.input.addSource(new RallyBot(() => h.runner));
    expect(h.car().lap).toBe(2);
    expect(h.runner.parTicks).toBe(h.runner.track.parLapTicks * 2);
    for (let i = 0; i < 20000 && !h.runner.done; i++) h.step();
    expect(h.car().lapTicks).toHaveLength(2);
    expect(h.car().finished).toBe(true);
  });

  it('finishNow on the grid ends the race at once (the CI route), with times in the grid order', () => {
    const h = race();
    h.step(30);
    h.runner.finishNow();
    expect(h.runner.phase).toBe('finish');
    expect(h.runner.cars.every((c) => c.finished && c.projected && c.finishTicks > 0)).toBe(true);
    let done = false;
    h.runner.events.on('complete', () => (done = true));
    h.step(30);
    expect(done).toBe(true);
  });
});

describe('the cameras per slot (spec §7.6)', () => {
  it('the race channel switches the camera (an edge) and looks back while held; cam=bumper starts on the bumper', () => {
    const h = race({ cam: 'bumper' });
    expect(h.runner.cams).toEqual(['bumper', 'bumper']);
    let held = 0;
    h.input.addSource(driver(() => ({ gas: 127, buttons: held })));
    h.step(COUNTDOWN_TICKS + 30);
    held = 2; // camera
    h.step(5);
    expect(h.runner.cams[0]).toBe('chase');
    held = 0;
    h.step(1);
    held = 2;
    h.step(1);
    expect(h.runner.cams[0]).toBe('bumper');
    held = 4; // look back
    h.step(2);
    expect(h.runner.rigs[0].back).toBe(true);
    const cam = newCam();
    h.runner.camera(0, cam, false);
    const car = h.car();
    // The bumper camera looking back: at the rear bumper, facing backwards.
    expect(Math.cos(cam.yaw - car.yaw)).toBeLessThan(-0.99);
    held = 0;
    h.step(1);
    expect(h.runner.rigs[0].back).toBe(false);
    expect(h.runner.switchCam(1)).toBe('chase');
    expect(h.runner.camera(1, cam, false)).toBe(false);
  });
});

describe('events and the recovery in a race', () => {
  it('scrape, bump and recover events reach the listeners; counters in the report', () => {
    const h = race();
    const seen = { scrape: 0, bump: 0, recover: 0 };
    h.runner.events.on('scrape', () => seen.scrape++);
    h.runner.events.on('bump', () => seen.bump++);
    h.runner.events.on('recover', (e) => {
      seen.recover++;
      expect(e.slot).toBe(0);
    });
    // Full gas, full right lock: into the right barrier, then stuck against it facing the wall.
    h.input.addSource(driver((t) => ({ gas: 127, steer: t > COUNTDOWN_TICKS + 20 ? -127 : 0 })));
    h.step(COUNTDOWN_TICKS + 900);
    expect(seen.scrape).toBeGreaterThan(0);
    expect(h.car().phys.scrapes).toBeGreaterThan(0);
    const rep = h.runner.report();
    expect(rep.scrapes![0]).toBe(h.car().phys.scrapes);
    expect(seen.recover + h.car().phys.recoveries).toBeGreaterThanOrEqual(0);
  });

  it('a car turned round on the track is put back after 3 s, in a free lane, then races on', () => {
    const h = race({ track: ringTrack() });
    h.input.addSource(driver(() => ({ gas: 100 })));
    h.step(COUNTDOWN_TICKS + 240);
    const car = h.car();
    car.yaw += Math.PI;
    car.speed = 0;
    car.phys.slip = 0;
    let rec = -1;
    h.runner.events.on('recover', () => (rec = h.runner.race.raceTick));
    const t0 = h.runner.race.raceTick;
    h.step(PHYS.recoverTicks + 5);
    expect(rec - t0).toBeGreaterThanOrEqual(PHYS.recoverTicks - 1);
    expect(rec - t0).toBeLessThanOrEqual(PHYS.recoverTicks + 1);
    expect(car.phys.recoveries).toBe(1);
    expect(car.phys.blink).toBeGreaterThan(0);
    h.step(PHYS.recoverHold + 120);
    expect(car.speed).toBeGreaterThan(10);
  });

  it('the bot and the rivals race clean on the A10-sized loop (no stuck cars)', () => {
    const h = race({ track: ringTrack() });
    h.input.addSource(new RallyBot(() => h.runner));
    h.step(COUNTDOWN_TICKS + 3000);
    for (const c of h.runner.cars) {
      expect(c.phys.recoveries).toBe(0);
      expect(c.speed).toBeGreaterThan(15);
    }
  });
});

describe('joins (spec §10)', () => {
  it('player 2 joins on the grid: the green estate on the second grid slot, the field stays at 8, with its own camera rig', () => {
    const h = race();
    const two = race({ players: 2 });
    h.step(30);
    const roster = h.runner.roster;
    const car = h.runner.joinPlayer(1, 'vincent')!;
    expect(car.spec.model).toBe('estate-green');
    expect(h.runner.roster).not.toBe(roster);
    // The grid of a 2P start: the same cars on the same slots.
    expect(h.runner.cars).toHaveLength(8);
    expect(h.runner.cars.map((c) => c.id)).toEqual(two.runner.cars.map((c) => c.id));
    for (let i = 1; i < 8; i++) {
      expect(h.runner.cars[i].s).toBeCloseTo(two.runner.cars[i].s, 6);
      expect(h.runner.cars[i].side).toBeCloseTo(two.runner.cars[i].side, 6);
    }
    expect(car.place).toBe(2);
    expect(h.runner.carOf(1)).toBe(car);
    const cam = newCam();
    h.step(1);
    expect(h.runner.camera(1, cam, true)).toBe(true);
    expect(cam.fovY).toBeLessThan(newCam().fovY);
  });

  it('player 2 joins during the race: the last rival leaves (8 cars), its lap clock starts at the join, the partial lap is no lap record', () => {
    const h = race({ track: ringTrack() });
    h.input.addSource(new RallyBot(() => h.runner));
    h.step(COUNTDOWN_TICKS + 2000);
    const r = h.runner;
    const rivals = r.cars.filter((c) => c.slot < 0);
    const lastRival = rivals.reduce((a, c) => (c.dist < a.dist ? c : a));
    const car = r.joinPlayer(1, 'vincent')!;
    expect(r.cars).toHaveLength(8);
    expect(r.cars).not.toContain(lastRival);
    expect(r.race.order).not.toContain(lastRival);
    expect(r.bodies.slice(0, 8)).toEqual(r.cars);
    expect(car.lapStart).toBe(r.race.raceTick);
    expect(car.partLaps).toBe(1);
    for (const c of r.cars) if (c !== car) expect(car.dist).toBeLessThan(c.dist);
  });
});
