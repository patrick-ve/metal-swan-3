/**
 * The A10's rules (RULES, wave B; docs/design/rally.md §4, §5, §9, §10; docs/api/rally.md "B.R"):
 * the plan of TRACK's A10, the signs per event lap, the speed cameras (a flash above the limit only;
 * rivals too), the average-speed zone, the red X, the road works of lap 2 (up, down, the AI kept out
 * of the closed lanes), the police of lap 3 (the pick, the box, the stop, the release, once), the
 * score's values, the headline by place, the safe point of a mid-race join, determinism.
 *
 * The rule scenarios run on TRACK's A10 with the other wave-B systems (FIELD's traffic) taken out of
 * the registry (this file only), so the traffic never meets the test car.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InputManager } from '../../../src/engine/input';
import { loadContent } from '../../../src/game/content/index';
import type { CarState, RallyBody } from '../../../src/game/rally/api';
import { laneSide, yawOf } from '../../../src/game/rally/physics';
import { defineRallySystem, rallySystems, undefineRally, type RallySystemDef } from '../../../src/game/rally/registry';
import { ahead, inRange, rulesPlan, wrapOff } from '../../../src/game/rally/rules/plan';
import { BOX_TICKS, HOLD_TICKS, POLICE_SPEC } from '../../../src/game/rally/rules/police';
import { CAMERA_TOLERANCE, OPEN_TOLERANCE, rulesOf, WORKS_CAMERA_LEAD, type RallyRules } from '../../../src/game/rally/rules/rules';
import { RallyRunner } from '../../../src/game/rally/runner';
import { eurosText, FINE_BASE, FINE_PER_KMH, fineEuros, raceLines, REDX_EUROS, ScoreBook } from '../../../src/game/rally/score';
import { loadRallyContent, rallyHeadline, RALLY_HEADLINES } from '../../../src/game/scenes/rally-route';
import { GameSession, type Difficulty } from '../../../src/game/session';

await loadContent();
await loadRallyContent();

/** The other wave-B systems (FIELD's traffic): out of the registry while these tests run. */
let others: RallySystemDef[] = [];
beforeAll(() => {
  others = rallySystems().filter((d) => d.id !== 'rules');
  for (const d of others) undefineRally(d.id);
});
afterAll(() => {
  for (const d of others) defineRallySystem(d);
});

interface Race {
  runner: RallyRunner;
  rules: RallyRules;
  step(n?: number): void;
  toGo(): void;
}

function race(o: { lap?: 1 | 2 | 3; difficulty?: Difficulty; players?: 1 | 2; seed?: number } = {}): Race {
  const players = o.players ?? 1;
  const input = new InputManager();
  input.players = players;
  input.raceMode = true;
  const session = new GameSession({ characters: players === 2 ? ['recruit', 'vincent'] : ['recruit'], seed: o.seed ?? 1, difficulty: o.difficulty ?? 'normal' });
  const runner = new RallyRunner({ seed: o.seed ?? 1, difficulty: o.difficulty ?? 'normal', players, session, pads: [input.pad(0), input.pad(1)], lap: o.lap });
  runner.start();
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      runner.step();
    }
  };
  return { runner, rules: rulesOf(runner)!, step, toGo: () => step(181 - runner.race.tick) };
}

/** Put any race car `dist` m past the start line (laps included) in lane `lane` at `v` m/s. */
function put(r: RallyRunner, car: CarState, dist: number, v: number, lane = 1): void {
  const t = r.track;
  const s = t.spline.wrap(t.startS + dist);
  const sp = t.spline.sample(s, { p: [0, 0, 0], t: [0, 0, 1], r: [-1, 0, 0] });
  const side = laneSide(t, lane, s);
  car.pos[0] = sp.p[0] + sp.r[0] * side;
  car.pos[1] = sp.p[1];
  car.pos[2] = sp.p[2] + sp.r[2] * side;
  car.yaw = yawOf(sp.t[0], sp.t[2]);
  car.s = s;
  car.side = side;
  car.dist = dist;
  car.lap = 1 + Math.floor(dist / t.length);
  car.speed = v;
  car.phys.slip = 0;
  car.phys.yawRate = 0;
  const d = r.drivers[r.cars.indexOf(car)];
  if (d) {
    d.lane = lane;
    d.side = side;
  }
}

/** Count events by name (and keep the payloads of a few). */
function record(r: RallyRunner): { count: Record<string, number>; log: { name: string; e: Record<string, unknown> }[] } {
  const count: Record<string, number> = {};
  const log: { name: string; e: Record<string, unknown> }[] = [];
  for (const name of ['flash', 'fine', 'redx', 'pulledOver', 'released', 'policeActive', 'roadworksAhead', 'spitsstrookOpen', 'overtake', 'bestLap', 'tunnelIn', 'tunnelOut'] as const) {
    r.events.on(name as never, ((e: Record<string, unknown>) => {
      count[name] = (count[name] ?? 0) + 1;
      log.push({ name, e: { ...e } });
    }) as never);
  }
  return { count, log };
}

describe('the plan of the A10 (plan.ts)', () => {
  it('17 gantries, the start at the line, 80 in the tunnel sections, the spitsstrook signs', () => {
    const r = race().runner;
    const p = rulesPlan(r.track);
    expect(p.gantries.length).toBe(17);
    expect(p.start).toBe(0);
    expect(p.gantries[0].off).toBeLessThan(1);
    for (const g of p.gantries) expect(g.base).toBe(g.section === 'coentunnel' || g.section === 'zeeburgertunnel' ? 80 : 100);
    expect(p.gantries.filter((g) => g.spits && g.signs).length).toBeGreaterThanOrEqual(3);
    expect(p.zone).not.toBeNull();
    expect(p.tunnels.map((t) => t.name)).toEqual(['COENTUNNEL', 'ZEEBURGERTUNNEL']);
  });

  it('every road works has its arrow, red-X and end gantries before / after it; a mobile camera only where no fixed one stands', () => {
    const p = rulesPlan(race().runner.track);
    expect(p.works.length).toBe(3);
    for (const w of p.works) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.arrow).toBeGreaterThanOrEqual(0);
      expect(w.end).toBeGreaterThanOrEqual(0);
      // The red-X gantry stands before the zone (within 700 m) and the arrow gantry before that.
      expect(ahead(p.gantries[w.x].off, w.off0, p.L)).toBeLessThan(720);
      expect(ahead(p.gantries[w.arrow].off, p.gantries[w.x].off, p.L)).toBeLessThan(960);
      expect(w.closed.includes(w.open)).toBe(false);
    }
    const mobile = p.cameras.filter((c) => c.works >= 0);
    expect(mobile.length).toBeGreaterThanOrEqual(1);
    for (const c of mobile) expect(p.cameras.filter((f) => f.works < 0).every((f) => wrapOff(f.off - p.works[c.works].off0, p.L) > p.works[c.works].len + 60)).toBe(true);
  });
});

describe('the signs director', () => {
  it('lap 1: the limits; the shoulder X over a shut spitsstrook; the start gantry counts down, shows GO, then goes dark', () => {
    const h = race();
    const { runner: r, rules } = h;
    h.step();
    expect(r.signs.sign(0, 0)).toBe('count-3');
    h.toGo();
    h.step(200);
    const p = rules.plan;
    for (let g = 0; g < p.gantries.length; g++) {
      const gp = p.gantries[g];
      if (!gp.signs || g === p.start) {
        expect(r.signs.sign(g, 0)).toBe('blank');
        continue;
      }
      expect(r.signs.sign(g, 1)).toBe(gp.base === 80 ? 'limit-80' : 'limit-100');
      expect(r.signs.sign(g, 3)).toBe(gp.spits ? 'x' : 'blank');
    }
    expect(rules.posted[0]).toBe(100);
  });

  it('lap 2: merge arrows and 80 before the works, the red X and 70 over them, end after', () => {
    const h = race({ lap: 2 });
    h.step(2);
    const { runner: r, rules } = h;
    const w = rules.plan.works[0];
    expect(rules.works.zones[0].active).toBe(true);
    expect(r.signs.sign(w.arrow, 0)).toBe('merge-right');
    expect(r.signs.sign(w.arrow, 1)).toBe('limit-80');
    expect(r.signs.sign(w.x, 0)).toBe('x');
    expect(r.signs.sign(w.x, 1)).toBe('limit-70');
    expect(r.signs.sign(w.x, 2)).toBe('limit-70');
    for (const g of w.inside) expect(r.signs.sign(g, 0)).toBe('x');
    expect(r.signs.sign(w.end, 1)).toBe('end');
    expect(rules.posted[w.x]).toBe(70);
    expect(rules.posted[w.end]).toBe(100);
    // The right-hand works (the right lane and the shoulder closed) merge left.
    const right = rules.plan.works.find((x) => x.closed.includes(2))!;
    const z = rules.works.zones[right.index];
    if (z.enabled) {
      expect(r.signs.sign(right.arrow, 2)).toBe('merge-left');
      expect(r.signs.sign(right.x, 2)).toBe('x');
    }
  });

  it('lap 3: the spitsstrook opens (green arrows, the event) and no lane is closed', () => {
    const h = race({ lap: 3 });
    const ev = record(h.runner);
    h.toGo();
    h.step(5);
    const { runner: r, rules } = h;
    expect(rules.spitsOpen).toBe(true);
    expect(ev.count.spitsstrookOpen).toBe(1);
    for (let g = 0; g < rules.plan.gantries.length; g++) {
      const gp = rules.plan.gantries[g];
      if (!gp.signs) continue;
      expect(r.signs.sign(g, 3)).toBe(gp.spits ? 'arrow-down' : 'blank');
      for (let l = 0; l < 3; l++) expect(r.signs.sign(g, l)).not.toBe('x');
    }
  });
});

describe('enforcement: speed cameras, the average-speed zone, the red X', () => {
  it('a speed camera flashes a car above the limit only (players and rivals), with the euros by the km/h over', () => {
    const h = race();
    const { runner: r, rules } = h;
    const ev = record(r);
    h.toGo();
    const cam = rules.plan.cameras.find((c) => c.works < 0)!;
    const me = r.carOf(0)!;
    // Just under the limit + tolerance: no flash.
    put(r, me, cam.off - 8, (cam.limit + CAMERA_TOLERANCE - 1) / 3.6);
    h.step(20);
    expect(ev.count.flash ?? 0).toBe(0);
    // 140 km/h: a flash and a fine.
    put(r, me, cam.off + 400 + r.track.length - 8 - 400, 140 / 3.6);
    me.lap = 2;
    h.step(20);
    expect(ev.count.flash).toBe(1);
    const f = ev.log.find((x) => x.name === 'fine')!.e;
    expect(f.car).toBe('white');
    expect(f.kind).toBe('camera');
    const fl = ev.log.find((x) => x.name === 'flash')!.e;
    expect(fl.limit).toBe(cam.limit);
    expect(f.euros).toBe(FINE_BASE + FINE_PER_KMH * (Number(fl.speed) - cam.limit));
    expect(me.fines).toBe(1);
    expect(r.book.peek('white')!.finesEuros).toBe(f.euros);
    // A rival too.
    const rival = r.cars.find((c) => c.slot < 0)!;
    put(r, rival, 2 * r.track.length + cam.off - 8, 150 / 3.6, 2);
    h.step(15);
    expect(rival.fines).toBe(1);
    expect(ev.log.some((x) => x.name === 'flash' && x.e.car === rival.id && x.e.slot === -1)).toBe(true);
  });

  it('wave C (the balance): the open road flashes above the limit + OPEN_TOLERANCE, the road works above + CAMERA_TOLERANCE', () => {
    expect(OPEN_TOLERANCE).toBeGreaterThan(CAMERA_TOLERANCE);
    const h = race();
    const { runner: r, rules } = h;
    const ev = record(r);
    h.toGo();
    const cam = rules.plan.cameras.find((c) => c.works < 0)!;
    const me = r.carOf(0)!;
    // A lift to the limit + 9 (open road): no flash; flat out: a flash.
    put(r, me, cam.off - 8, (cam.limit + OPEN_TOLERANCE - 1) / 3.6);
    h.step(20);
    expect(ev.count.flash ?? 0).toBe(0);
    put(r, me, r.track.length + cam.off - 8, (cam.limit + OPEN_TOLERANCE + 2) / 3.6);
    me.lap = 2;
    h.step(20);
    expect(ev.count.flash).toBe(1);
    // A road works' camera (lap 2): 5 km/h over its 70 is a flash.
    const h2 = race({ lap: 2 });
    const ev2 = record(h2.runner);
    h2.toGo();
    h2.step(2);
    const wcam = h2.rules.plan.cameras.find((c) => c.works >= 0 && h2.rules.works.zones[c.works]?.active);
    if (wcam) {
      const me2 = h2.runner.carOf(0)!;
      // 3 m before it at 75 km/h (0.35 m per tick): over it within 20 ticks.
      put(h2.runner, me2, h2.runner.track.length + wcam.off - 3, (wcam.limit + CAMERA_TOLERANCE + 2) / 3.6);
      h2.step(20);
      expect(ev2.count.flash).toBe(1);
    }
  });

  it('a debug teleport over a camera fines nothing', () => {
    const h = race();
    const ev = record(h.runner);
    h.toGo();
    const cam = h.rules.plan.cameras[0];
    const me = h.runner.carOf(0)!;
    put(h.runner, me, cam.off - 200, 50);
    h.step(1);
    put(h.runner, me, cam.off + 50, 50);
    h.step(3);
    expect(ev.count.flash ?? 0).toBe(0);
  });

  it('the average-speed zone: an average above the limit gives one fine at its end; below it none', () => {
    const run = (kmh: number): { fines: number; avg: number } => {
      const h = race();
      const ev = record(h.runner);
      h.toGo();
      const z = h.rules.plan.zone!;
      const me = h.runner.carOf(0)!;
      put(h.runner, me, z.off0 - 30, kmh / 3.6, 1);
      let avgSeen = 0;
      for (let i = 0; i < 2000 && me.dist < z.off0 + z.len + 20; i++) {
        me.speed = kmh / 3.6;
        h.step(1);
        const a = h.rules.zoneAverage(me);
        if (a) avgSeen = a.avg;
      }
      const zf = ev.log.filter((x) => x.name === 'flash' && x.e.kind === 'zone');
      return { fines: zf.length, avg: avgSeen };
    };
    const fast = run(112);
    expect(fast.fines).toBe(1);
    expect(Math.abs(fast.avg - 112)).toBeLessThan(3);
    expect(run(98).fines).toBe(0);
  });

  it('the red X (lap 2): a car that passes under it in the closed lane is fined 250; the open lane is not', () => {
    const h = race({ lap: 2 });
    const ev = record(h.runner);
    h.toGo();
    const { runner: r, rules } = h;
    const w = rules.plan.works[0];
    const gx = rules.plan.gantries[w.x].off;
    const me = r.carOf(0)!;
    put(r, me, r.track.length + gx - 5, 20, 1);
    h.step(30);
    expect(me.dist).toBeGreaterThan(r.track.length + gx);
    expect(ev.count.redx ?? 0).toBe(0);
    put(r, me, r.track.length + gx - 5, 20, 0);
    h.step(30);
    expect(ev.count.redx).toBe(1);
    const fine = ev.log.find((x) => x.name === 'fine')!.e;
    expect(fine.kind).toBe('redx');
    expect(fine.euros).toBe(REDX_EUROS);
    expect(ev.log.find((x) => x.name === 'redx')!.e).toMatchObject({ car: 'white', gantry: w.x, lane: 0 });
  });
});

describe('the road works (works.ts)', () => {
  it('stand on lap 2 (props solid and drawn), only the picked zones; cleared on lap 3 — never while a player is near', () => {
    const h = race({ lap: 2 });
    const ev = record(h.runner);
    h.step(2);
    const { runner: r, rules } = h;
    const zones = rules.works.zones;
    expect(zones[0].enabled).toBe(true);
    const enabled = zones.filter((z) => z.enabled).length;
    expect(enabled).toBeGreaterThanOrEqual(2);
    expect(ev.count.roadworksAhead).toBe(enabled);
    for (const z of zones) {
      expect(z.active).toBe(z.enabled);
      for (const p of z.props) {
        expect(p.kind).toBe('prop');
        expect(p.hidden).toBe(!z.enabled);
        expect(p.phys.ghost).toBe(!z.enabled);
      }
    }
    // Lap 3 starts with the player 100 m before the first zone: it stays until the player is past.
    h.toGo();
    const me = r.carOf(0)!;
    put(r, me, 2 * r.track.length + zones[0].plan.off0 - 100, 10, 1);
    h.step(3);
    expect(rules.lap).toBe(3);
    expect(zones[0].active).toBe(true);
    put(r, me, 2 * r.track.length + zones[0].plan.off0 + zones[0].plan.len + 200, 10, 1);
    h.step(3);
    expect(zones[0].active).toBe(false);
    for (const p of zones[0].props) expect(p.hidden && p.phys.ghost).toBe(true);
  });

  it('the AI leaves a closed lane before the works; a car stuck right behind them is put in a free lane', () => {
    const h = race({ lap: 2 });
    h.toGo();
    const { runner: r, rules } = h;
    const w = rules.plan.works[0];
    const i = r.cars.findIndex((c) => c.slot < 0);
    const rival = r.cars[i];
    put(r, rival, r.track.length + w.off0 - 300, 25, 0);
    h.step(2);
    expect(r.drivers[i].lane).toBe(w.open);
    // The player stands still right behind the truck: after 2 s it is put in a free open lane.
    const me = r.carOf(0)!;
    put(r, me, r.track.length + w.off0 - 6, 0, 0);
    let moved = false;
    for (let k = 0; k < 200 && !moved; k++) {
      me.speed = 0;
      h.step(1);
      if (Math.abs(me.side - laneSide(r.track, w.open, me.s)) < 0.2) moved = true;
    }
    expect(moved).toBe(true);
  });
});

describe('the police (police.ts)', () => {
  it('2 / 3 / 4 police cars by difficulty, parked until lap 3', () => {
    for (const [difficulty, n] of [
      ['easy', 2],
      ['normal', 3],
      ['hard', 4],
    ] as const) {
      const h = race({ difficulty });
      const police = h.runner.bodies.filter((b) => b.kind === 'police');
      expect(police.length).toBe(n);
      expect(h.rules.police.count).toBe(n);
      h.toGo();
      h.step(60);
      for (const b of police) expect(b.hidden && b.phys.ghost).toBe(true);
    }
  });

  it('picks the racer with the most fines (a rival too); a racer with no fine is never picked', () => {
    const h = race({ lap: 3 });
    const { runner: r, rules } = h;
    const rival = r.cars.find((c) => c.slot < 0)!;
    rival.fines = 7;
    r.carOf(0)!.fines = 3;
    h.toGo();
    h.step(3);
    const p = rules.police.cars[0];
    expect(p.phase).toBe('chase');
    expect(p.target!.car).toBe(rival);
    expect(p.body.hidden).toBe(false);
    expect((p.body.lights ?? 0) & 64).toBe(64);
    // The second police car (`POLICE_GAP` later) takes the next on the list: the player.
    h.step(430);
    expect(rules.police.cars[1].target?.car.id).toBe('white');
  });

  it('comes alongside, boxes the racer in for 2 s, pulls it over for 3 s on the shoulder, releases it: once', () => {
    const h = race({ lap: 3 });
    const { runner: r, rules } = h;
    const ev = record(r);
    h.toGo();
    const me = r.carOf(0)!;
    me.fines = 30;
    r.placeCar(0, 2 * r.track.length + 2700, 40, 1);
    r.setAutopilot(0, true);
    let pulledAt = -1;
    let releasedAt = -1;
    let spun = false;
    for (let i = 0; i < 4000 && releasedAt < 0; i++) {
      h.step(1);
      for (const p of rules.police.cars) if (p.body.phys.spin > 0) spun = true;
      if (pulledAt < 0 && ev.count.pulledOver) pulledAt = r.race.raceTick;
      if (releasedAt < 0 && ev.count.released) releasedAt = r.race.raceTick;
    }
    expect(pulledAt).toBeGreaterThan(0);
    const pulled = ev.log.find((x) => x.name === 'pulledOver')!.e;
    expect(pulled.car).toBe('white');
    expect(String(pulled.police)).toMatch(/^police-/);
    // The glide onto the shoulder, then 3 s standing there.
    expect(releasedAt - pulledAt).toBeGreaterThanOrEqual(HOLD_TICKS);
    expect(releasedAt - pulledAt).toBeLessThan(HOLD_TICKS + 160);
    expect(Math.abs(me.side - rules.plan.laneX[3])).toBeLessThan(0.3);
    expect(me.phys.ghost).toBe(false);
    expect(rules.of(me)!.stopped).toBe(true);
    expect(spun).toBe(false);
    expect(BOX_TICKS).toBe(120);
    // Once: never again for this racer; that police car is done.
    const who = rules.police.cars.find((p) => p.body.id === pulled.police)!;
    h.step(1500);
    expect(ev.log.filter((x) => x.name === 'pulledOver' && x.e.car === 'white').length).toBe(1);
    expect(who.stopped).toBe(true);
    expect(['leave', 'done']).toContain(who.phase);
    expect(POLICE_SPEC.topSpeed).toBeGreaterThan(61);
  });
});

describe('the cameras before the road works (fixer, wave B)', () => {
  it('a fixed camera far before standing road works keeps the base limit; the HUD gets the limit it enforces', () => {
    const h = race({ lap: 2 });
    const { runner: r, rules } = h;
    h.toGo();
    h.step(2);
    const plan = rules.plan;
    const L = plan.L;
    const me = r.carOf(0)!;
    let far = 0;
    for (const c of plan.cameras) {
      if (c.works >= 0) continue;
      // The last sign gantry before the camera: a works step-down (80 / 70) on lap 2?
      let g = -1;
      let gd = Infinity;
      plan.gantries.forEach((gp, i) => {
        const d = ahead(gp.off, c.off, L);
        if (gp.signs && d > 30 && d < gd) {
          gd = d;
          g = i;
        }
      });
      if (g < 0 || rules.posted[g] >= plan.gantries[g].base) continue;
      const near = rules.works.zones.some((z) => z.active && inRange(c.off, wrapOff(z.plan.off0 - WORKS_CAMERA_LEAD, L), z.plan.len + WORKS_CAMERA_LEAD, L));
      r.placeCar(0, L + plan.gantries[g].off - 15, 25, 1);
      h.step(40);
      expect(rules.of(me)!.posted).toBe(rules.posted[g]);
      expect(rules.cameraLimit(me, gd + 10)).toBe(near ? rules.posted[g] : plan.gantries[g].base);
      if (!near) far++;
    }
    expect(far).toBeGreaterThan(0);
  });
});

describe('the lanes the AI may use (fixer, wave B)', () => {
  it('no hard shoulder under a red X on laps 1–2, the shoulder on lap 3; the closed works lanes left out', () => {
    const d: { keepLo?: number; keepHi?: number } = {};
    const h1 = race({ lap: 1 });
    h1.toGo();
    h1.step(2);
    const plan = h1.rules.plan;
    const g = plan.gantries.findIndex((gp) => gp.signs && gp.spits);
    expect(g).toBeGreaterThanOrEqual(0);
    const before = wrapOff(plan.gantries[g].off - 100, plan.L);
    h1.rules.works.keepLanes(before, d);
    expect(d.keepLo).toBe(0);
    expect(d.keepHi).toBe(2);
    expect(h1.rules.shoulderX(before, 300)).toBe(true);
    const h3 = race({ lap: 3 });
    h3.toGo();
    h3.step(2);
    h3.rules.works.keepLanes(before, d);
    expect(d.keepHi).toBe(3);
    const h2 = race({ lap: 2 });
    h2.toGo();
    h2.step(2);
    const z = h2.rules.works.zones.find((w) => w.active);
    expect(z).toBeDefined();
    h2.rules.works.keepLanes(wrapOff(z!.plan.off0 - 50, plan.L), d);
    for (const c of z!.plan.closed) if (c < 3) expect(c < d.keepLo! || c > d.keepHi!).toBe(true);
    expect(d.keepLo! <= d.keepHi!).toBe(true);
  });

  it('the red X warning also counts the lane within 1 m of the car (the shoulder border)', () => {
    const h = race({ lap: 1 });
    h.toGo();
    h.step(2);
    const { runner: r, rules } = h;
    const plan = rules.plan;
    const g = plan.gantries.findIndex((gp) => gp.signs && gp.spits);
    const me = r.carOf(0)!;
    r.placeCar(0, plan.gantries[g].off - 150, 0, 2);
    // In lane 2 near its middle: no X over it.
    expect(rules.redXAhead(me, 300)).toBe(-1);
    // Within 1 m of the shoulder's border: the shoulder's X counts.
    me.side = plan.borders[2] - 0.6;
    expect(rules.redXAhead(me, 300)).toBeGreaterThan(0);
  });
});

describe('the police: no brake check (fixer, wave B)', () => {
  it('ahead of its racer with both lines beside busy, it never brakes in front of it in its line', () => {
    const h = race({ lap: 3 });
    const { runner: r, rules } = h;
    h.toGo();
    const me = r.carOf(0)!;
    me.fines = 30;
    const base = 2 * r.track.length + 2700;
    r.placeCar(0, base, 25, 1);
    r.setAutopilot(0, true);
    // Two rivals just ahead in the lines beside the racer: both sides busy (the tail case).
    const rivals = r.cars.filter((c) => c.slot < 0);
    put(r, rivals[0], base + 10, 25, 0);
    put(r, rivals[1], base + 10, 25, 2);
    // A police car 6 m AHEAD of its racer in the racer's own line.
    const p = rules.police.cars[0];
    const cr = rules.of(me)!;
    const body = p.body;
    put(r, body as unknown as CarState, base + 6, 25, 1);
    body.hidden = false;
    body.phys.ghost = false;
    p.phase = 'chase';
    p.target = cr;
    cr.hunted = p.index;
    p.close = true;
    p.side = me.side;
    p.lanesT = 0;
    let inLine = 0;
    let minMe = Infinity;
    for (let i = 0; i < 150 && p.phase === 'chase'; i++) {
      h.step(1);
      const gap = me.dist - body.dist;
      if (gap < -1 && Math.abs(body.side - me.side) < 1.9) {
        inLine++;
        expect(body.speed).toBeGreaterThan(me.speed - 1);
      }
      if (me.speed < minMe) minMe = me.speed;
    }
    expect(inLine).toBeGreaterThan(10);
    expect(minMe).toBeGreaterThan(15);
  });
});

describe('race events: overtakes, best laps, tunnels', () => {
  it('an overtake of a rival counts once per rival per lap of the player', () => {
    const h = race();
    const ev = record(h.runner);
    h.toGo();
    const { runner: r } = h;
    const me = r.carOf(0)!;
    const rival = r.cars.find((c) => c.slot < 0)!;
    // The rival 20 m ahead; the player passes it, falls back, passes it again (the same lap): one overtake.
    put(r, rival, 3000, 0, 0);
    put(r, me, 2980, 0, 2);
    h.step(1);
    for (const d of [3010, 2990, 3010]) {
      put(r, me, d, 0, 2);
      put(r, rival, 3000, 0, 0);
      h.step(1);
    }
    expect(ev.log.filter((x) => x.name === 'overtake' && x.e.other === rival.id).length).toBe(1);
    // The next lap: it counts again.
    put(r, rival, r.track.length + 3000, 0, 0);
    put(r, me, r.track.length + 2990, 0, 2);
    h.step(1);
    put(r, me, r.track.length + 3010, 0, 2);
    h.step(1);
    expect(ev.log.filter((x) => x.name === 'overtake' && x.e.other === rival.id).length).toBe(2);
    expect(r.book.peek('white')!.overtakes).toBeGreaterThanOrEqual(2);
  });

  it('tunnelIn / tunnelOut with the tube name', () => {
    const h = race();
    const ev = record(h.runner);
    h.toGo();
    const t = h.rules.plan.tunnels[0];
    const me = h.runner.carOf(0)!;
    put(h.runner, me, t.off0 - 5, 30, 1);
    for (let i = 0; i < 600 && me.dist < t.off0 + t.len + 10; i++) {
      me.speed = 30;
      h.step(1);
    }
    const tin = ev.log.filter((x) => x.name === 'tunnelIn' && x.e.car === 'white');
    const tout = ev.log.filter((x) => x.name === 'tunnelOut' && x.e.car === 'white');
    expect(tin.length).toBe(1);
    expect(tin[0].e.name).toBe(t.name);
    expect(tout.length).toBe(1);
  });
});

describe('the score (score.ts) and the headline', () => {
  it('the fines in euros: a base and per km/h over; a red X fixed; Dutch thousands in the tally', () => {
    expect(fineEuros('camera', 100)).toBe(FINE_BASE + 100 * FINE_PER_KMH);
    expect(fineEuros('zone', 12)).toBe(FINE_BASE + 12 * FINE_PER_KMH);
    expect(fineEuros('redx', 80)).toBe(REDX_EUROS);
    expect(eurosText(300)).toBe('300');
    expect(eurosText(8430)).toBe('8.430');
    expect(eurosText(1234567)).toBe('1.234.567');
    const car = { id: 'white', slot: 0, place: 4, finished: true, finishTicks: 26000, lapTicks: [9000, 8500, 8500], partLaps: 0, fines: 9 } as unknown as CarState;
    const book = new ScoreBook();
    book.fine('white', 8430);
    const lines = raceLines({ parTicks: 26613, carCount: 8, parLapTicks: 8871, book, cars: [car] }, car);
    expect(lines.find((l) => l.label.startsWith('FINES'))!.label).toBe('FINES 9 EUR 8.430');
  });

  it('the card headline follows the best player place (spec §1.1)', () => {
    expect(rallyHeadline(1)).toBe('SQUAD WINS DE RINGRALLY! PERMIT SECURED!');
    expect(rallyHeadline(2)).toBe(RALLY_HEADLINES.podium);
    expect(rallyHeadline(3)).toBe('PODIUM! BUT NO PERMIT. BACK ON THE LIST.');
    expect(rallyHeadline(4)).toBe('NO PERMIT. 12 MORE YEARS ON THE LIST.');
    expect(rallyHeadline(8)).toBe(RALLY_HEADLINES.rest);
  });
});

describe('the 2P join during the race (spec §10)', () => {
  it('the green estate starts at the back at the next safe point: out of the tunnels, clear of road works, a free lane', () => {
    const h = race({ lap: 2 });
    h.toGo();
    const { runner: r, rules } = h;
    const track = r.track as RallyRunner['track'] & { flagsAt(s: number): number };
    // Every car near the Coentunnel: the last one in the tube.
    const t = rules.plan.tunnels[0];
    r.cars.forEach((c, i) => put(r, c, r.track.length + t.off0 + 60 + i * 12, 20, i % 3));
    h.step(1);
    let last = r.cars[0];
    for (const c of r.cars) if (c.dist < last.dist) last = c;
    const green = r.joinPlayer(1, 'vincent')!;
    expect(green.slot).toBe(1);
    expect(r.cars.length).toBe(8);
    expect(green.dist).toBeLessThan(last.dist);
    for (let k = -40; k <= 40; k += 20) expect(track.flagsAt(track.spline.wrap(green.s + k)) & 3).toBe(0);
    for (const b of r.bodies as RallyBody[]) if (b !== green && !b.phys.ghost) expect(Math.abs(b.s - green.s) < 30 && Math.abs(b.side - green.side) < 2.6).toBe(false);
    expect(green.partLaps).toBe(1);
  });
});

describe('determinism', () => {
  it('the same seed gives the same race with the rules (police, works, fines) twice', () => {
    const play = (): { hash: number; fines: number[] } => {
      const h = race({ lap: 2, seed: 4, difficulty: 'hard' });
      h.toGo();
      const me = h.runner.carOf(0)!;
      me.fines = 12;
      h.runner.setAutopilot(0, true);
      h.step(9000);
      return { hash: h.runner.stateHash(), fines: h.runner.cars.map((c) => c.fines) };
    };
    const a = play();
    const b = play();
    expect(a).toEqual(b);
  });
});
