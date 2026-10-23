/**
 * FIELD (wave B; docs/design/rally.md §2, §4, §6; docs/api/rally.md "B.F"): the grid order, the
 * traffic AI and its spawner (lanes, indicators before a change, never in view, the reaction to a
 * hit, horns, near misses, lap 3's jams and spitsstrook), the rival AI (the catch-up bounds, no
 * brake-checks, three laps at every difficulty with plausible lap times and no stuck car, ACHTERUIT's
 * gag), the oncoming decor, the physics' bodies from CARS' anchors and determinism. On TRACK's A10
 * with FIELD's content (the teams, the traffic); RULES' systems are not loaded here.
 */
import { describe, expect, it } from 'vitest';
import { InputManager } from '../../../src/engine/input';
import { splineSample } from '../../../src/engine/r3/spline';
import '../../../src/game/content/rally/models/index';
import { TEAMS } from '../../../src/game/content/rally/teams/index';
import '../../../src/game/content/rally/traffic/index';
import { buildTrack } from '../../../src/game/content/rally/track/index';
import { emptyRallyInput, type CarState, type RallyEventsB } from '../../../src/game/rally/api';
import { ONCOMING_LANES, oncomingDensity, oncomingPlan, oncomingS } from '../../../src/game/rally/ai-oncoming';
import { CATCH_UP, catchUpFactor, GAG, type RivalBrain } from '../../../src/game/rally/ai-rival';
import { HAZARD_AFTER, JAM_KMH, NEAR_GAP, SIGNAL, SPAWN_SAFE, trafficOf } from '../../../src/game/rally/ai-traffic';
import { gridPlan, PLAYER_GRID } from '../../../src/game/rally/grid';
import { BODY_LIGHT } from '../../../src/game/rally/ids';
import { bodyShape, dsOf, handlingOf, laneSide, newPhys, stepBody, type HandlingB } from '../../../src/game/rally/physics';
import { defineRallySystem, defineRallyTrack, rallySystems, undefineRally } from '../../../src/game/rally/registry';
import { ESTATE_WHITE, RallyRunner } from '../../../src/game/rally/runner';
import { curvAt, trackInfo } from '../../../src/game/rally/track-info';
import { GameSession, type Difficulty } from '../../../src/game/session';

defineRallyTrack({ id: 'a10', build: buildTrack });

interface Opts {
  seed?: number;
  players?: 1 | 2;
  difficulty?: Difficulty;
  lap?: 1 | 2 | 3;
  gridBack?: boolean;
}

function race(o: Opts = {}): RallyRunner {
  const players = o.players ?? 1;
  const input = new InputManager();
  const session = new GameSession({ difficulty: o.difficulty ?? 'normal', characters: players === 2 ? ['recruit', 'vincent'] : ['recruit'], seed: o.seed ?? 1 });
  return new RallyRunner({ session, pads: [input.pad(0), input.pad(1)], seed: o.seed ?? 1, difficulty: o.difficulty ?? 'normal', players, lap: o.lap, gridBack: o.gridBack });
}

/** A race without FIELD's traffic (the system is removed for the build, then put back). */
function raceNoTraffic(o: Opts = {}): RallyRunner {
  const def = rallySystems().find((d) => d.id === 'traffic')!;
  undefineRally('traffic');
  try {
    return race(o);
  } finally {
    defineRallySystem(def);
  }
}

/** Spawn a traffic car somewhere `from` m or more ahead of the player in `lane` at `speed` (the first free spot); its body. */
function spawnAhead(t: NonNullable<ReturnType<typeof trafficOf>>, me: CarState, from: number, lane: number, speed: number) {
  for (let a = from; a < from + 300; a += 15) {
    if (t.spawnAt(me, a, lane, -1, speed)) return t.cars.find((x) => x.active && Math.abs(x.body.dist - (me.dist + a)) < 1)!;
  }
  throw new Error('no free spot');
}

/** A distance from the start line (lap 1) where the track runs straight for `len` m. */
function straightAt(r: RallyRunner, len: number, from = 300): number {
  const info = trackInfo(r.track);
  let d = from;
  const ok = (x: number): boolean => {
    for (let k = 0; k <= len; k += 8) if (Math.abs(curvAt(info, r.track.startS + x + k)) > 0.0012) return false;
    return true;
  };
  while (!ok(d)) d += 20;
  return d;
}

function events(r: RallyRunner): Record<string, unknown[]> {
  const log: Record<string, unknown[]> = {};
  for (const k of ['honk', 'crash', 'nearMiss', 'jam'] as const) r.events.on(k, (e) => (log[k] ??= []).push({ ...(e as object) }));
  return log;
}

/** Put a rival (any race car) at `dist` m from the start line, `side` m right of the centre, at `speed`. */
function putCar(r: RallyRunner, car: CarState, dist: number, side: number, speed: number): void {
  const t = r.track;
  const s = t.spline.wrap(t.startS + dist);
  const sp = t.spline.sample(s, splineSample());
  car.pos[0] = sp.p[0] + sp.r[0] * side;
  car.pos[1] = sp.p[1];
  car.pos[2] = sp.p[2] + sp.r[2] * side;
  car.yaw = Math.atan2(sp.t[0], sp.t[2]);
  car.s = s;
  car.side = side;
  car.dist = dist;
  car.lap = 1 + Math.floor(dist / t.length);
  car.speed = speed;
  car.phys.slip = 0;
  car.phys.yawRate = 0;
  const d = r.drivers[r.cars.indexOf(car)];
  d.side = side;
  d.lane = [0, 1, 2].reduce((a, k) => (Math.abs(laneSide(t, k, s) - side) < Math.abs(laneSide(t, a, s) - side) ? k : a), 0);
  d.lastLane = d.lane;
}

describe('the grid (grid.ts)', () => {
  it('1P starts 6th of 8, 2P the estates 5th and 6th; gridBack behind every rival', () => {
    expect(PLAYER_GRID[1]).toEqual([5]);
    expect(PLAYER_GRID[2]).toEqual([4, 5]);
    expect(gridPlan(1, 7).join('')).toBe('rrrrrprr');
    expect(gridPlan(2, 6).join('')).toBe('rrrrpprr');
    expect(gridPlan(1, 7, true).join('')).toBe('rrrrrrrp');
    expect(gridPlan(1, 2).join('')).toBe('rrp');
    const one = race();
    expect(one.carOf(0)!.place).toBe(6);
    expect(one.cars.filter((c) => c.slot < 0).map((c) => c.team)).toEqual(TEAMS.map((t) => t.spec.team));
    const two = race({ players: 2 });
    expect([two.carOf(0)!.place, two.carOf(1)!.place]).toEqual([5, 6]);
    expect(two.cars.filter((c) => c.slot < 0).map((c) => c.team)).toEqual(TEAMS.slice(0, 6).map((t) => t.spec.team));
  });
});

describe('the traffic (ai-traffic.ts)', () => {
  it('spawns out of sight, keeps its lanes, and signals about 1 s before every lane change', () => {
    const r = race({ seed: 4 });
    r.setAutopilot(0, true, 0.94);
    const t = trafficOf(r)!;
    const L = r.track.length;
    const was = new Map(t.cars.map((c) => [c, c.active]));
    const signalOn = new Map<object, number>();
    let spawns = 0;
    let inLane = 0;
    let samples = 0;
    let changes = 0;
    for (let i = 0; i < 9000; i++) {
      r.step();
      for (const c of t.cars) {
        const b = c.body;
        if (c.active && !was.get(c)) {
          spawns++;
          for (const p of r.cars) if (p.slot >= 0) {
            const dq = dsOf(p.s, b.s, L);
            expect(dq > -60 && dq < SPAWN_SAFE, `spawned ${dq.toFixed(0)} m from the player`).toBe(false);
          }
        }
        was.set(c, c.active);
        if (!c.active) continue;
        const ind = (b.lights ?? 0) & (BODY_LIGHT.left | BODY_LIGHT.right);
        if (ind && c.moving < 0 && !signalOn.has(c)) signalOn.set(c, r.tick);
        if (c.moving >= 0 && c.moving !== c.from && signalOn.has(c)) {
          if (Math.abs(b.side - laneSide(r.track, c.from, b.s)) < 0.3) {
            expect(r.tick - signalOn.get(c)!, 'the indicator blinks before the move').toBeGreaterThanOrEqual(SIGNAL - 2);
            changes++;
          }
        }
        if (!ind) signalOn.delete(c);
        if (c.state === 'drive' && c.moving < 0 && c.signal === 0 && Math.abs(b.speed) > 5) {
          samples++;
          if (Math.abs(b.side - laneSide(r.track, c.d.lane, b.s)) < 0.8) inLane++;
        }
      }
    }
    expect(spawns).toBeGreaterThan(10);
    expect(changes).toBeGreaterThan(3);
    expect(inLane / samples).toBeGreaterThan(0.9);
  });

  it('a hard hit: the traffic car spins or slows, stops with its hazards on, stands, then drives on (crash)', () => {
    const r = race({ seed: 2 });
    const ev = events(r);
    while (r.phase === 'grid') r.step();
    for (let i = 0; i < 300; i++) r.step();
    const t = trafficOf(r)!;
    const me = r.carOf(0)!;
    // On a straight: the player (no input: it rolls on straight) runs into a car in the right lane.
    const d = straightAt(r, 450);
    r.placeCar(0, d, 20, 2);
    const c = spawnAhead(t, me, 60, 2, 22);
    r.placeCar(0, c.body.dist - 30, 52, 2);
    let hazard = false;
    let stopped = false;
    let droveOn = false;
    for (let i = 0; i < 900 && !droveOn; i++) {
      r.step();
      if (((c.body.lights ?? 0) & BODY_LIGHT.hazard) !== 0) hazard = true;
      if (c.state === 'stopped') stopped = true;
      if (stopped && c.state === 'drive' && c.body.speed > 5) droveOn = true;
    }
    expect((ev.crash ?? []).some((e) => (e as RallyEventsB['crash']).other === c.body.id && (e as RallyEventsB['crash']).slot === 0)).toBe(true);
    expect(hazard).toBe(true);
    expect(stopped).toBe(true);
    expect(droveOn).toBe(true);
    // The hazards go off a while after it drove on.
    for (let i = 0; i < HAZARD_AFTER + 30; i++) r.step();
    if (c.active && c.state === 'drive') expect((c.body.lights ?? 0) & BODY_LIGHT.hazard).toBe(0);
  });

  it('honks at a racer that cuts in close, and a close pass at speed is a near miss', () => {
    expect(trafficOf(raceNoTraffic())).toBeNull();
    const q = race({ seed: 3 });
    const ev = events(q);
    while (q.phase === 'grid') q.step();
    for (let i = 0; i < 200; i++) q.step();
    const tq = trafficOf(q)!;
    const me = q.carOf(0)!;
    const d = straightAt(q, 500);
    q.placeCar(0, d, 20, 2);
    const c = spawnAhead(tq, me, 40, 2, 28);
    // Cut in 9 m ahead of it, slow: it has to brake hard.
    q.placeCar(0, c.body.dist + 9 + 4.5, 10, 2);
    for (let i = 0; i < 40; i++) q.step();
    expect((ev.honk ?? []).some((e) => (e as RallyEventsB['honk']).car === c.body.id && (e as RallyEventsB['honk']).slot === 0)).toBe(true);
    // A pass at 180 km/h with about half a metre between the bodies.
    const d2 = straightAt(q, 500, d + 600);
    q.placeCar(0, d2, 20, 2);
    const n = spawnAhead(tq, me, 60, 2, 25);
    q.placeCar(0, n.body.dist - 40, 50, 1);
    const sp = q.track.spline.sample(me.s, splineSample());
    // On its left, about half a metre between the bodies.
    const side = laneSide(q.track, 2, me.s) - me.phys.h.halfWid - n.body.phys.h.halfWid - NEAR_GAP * 0.55;
    me.pos[0] = sp.p[0] + sp.r[0] * side;
    me.pos[2] = sp.p[2] + sp.r[2] * side;
    me.side = side;
    for (let i = 0; i < 160; i++) q.step();
    const nm = (ev.nearMiss ?? []).find((e) => (e as RallyEventsB['nearMiss']).other === n.body.id) as RallyEventsB['nearMiss'] | undefined;
    expect(nm).toBeDefined();
    expect(nm!.slot).toBe(0);
    expect(nm!.speed).toBeGreaterThan(150);
  });

  it('lap 3 (rush hour): short jams (a slow cluster with brake lights, the jam event) and the spitsstrook in use', () => {
    const r = race({ seed: 1, lap: 3 });
    r.setAutopilot(0, true, 0.94);
    const ev = events(r);
    const t = trafficOf(r)!;
    let braking = 0;
    let slow = 0;
    let shoulder = 0;
    for (let i = 0; i < 9000 && !r.carOf(0)!.finished; i++) {
      r.step();
      for (const c of t.cars) {
        if (!c.active) continue;
        if (c.jam >= 0 && c.body.speed * 3.6 < JAM_KMH * 1.4) slow++;
        if (c.jam >= 0 && ((c.body.lights ?? 0) & BODY_LIGHT.brake) !== 0) braking++;
        if (c.d.lane === r.track.lanes && Math.abs(c.body.side - laneSide(r.track, r.track.lanes, c.body.s)) < 0.5) shoulder++;
      }
    }
    expect((ev.jam ?? []).length).toBeGreaterThanOrEqual(1);
    expect(t.jams.some((j) => j.state !== 'waiting')).toBe(true);
    expect(slow).toBeGreaterThan(100);
    expect(braking).toBeGreaterThan(20);
    expect(shoulder).toBeGreaterThan(0);
    // Rush hour: more cars than lap 1's.
    expect(t.density(3)).toBeGreaterThan(t.density(1));
  });

  it('the same seed gives the same race; another seed other traffic', () => {
    const run = (seed: number): number => {
      const r = race({ seed });
      r.setAutopilot(0, true, 0.94);
      for (let i = 0; i < 4000; i++) r.step();
      return r.stateHash();
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });
});

describe('the traffic after a P2 join (fixer, wave B)', () => {
  it('a second player who joins after the start gets the 2P pools and density', () => {
    const two = race({ players: 2 });
    two.start();
    const t2 = trafficOf(two)!;
    const one = race();
    one.start();
    const t1 = trafficOf(one)!;
    expect(t1.cars.length * 2).toBe(t2.cars.length);
    expect(one.joinPlayer(1, 'vincent')).not.toBeNull();
    one.step();
    expect(t1.cars.length).toBe(t2.cars.length);
    expect(t1.k).toBeCloseTo(t2.k, 9);
    expect(new Set(one.bodies.map((b) => b.id)).size).toBe(one.bodies.length);
    for (const c of t1.cars) expect(one.bodies.includes(c.body)).toBe(true);
  });
});

describe('the rival AI (ai-rival.ts)', () => {
  it('the catch-up: up to +3 % behind the leading player, −2 % ahead, off on hard', () => {
    expect(catchUpFactor(-10000, false)).toBeCloseTo(1 + CATCH_UP.back, 9);
    expect(catchUpFactor(10000, false)).toBeCloseTo(1 - CATCH_UP.front, 9);
    expect(catchUpFactor(0, false)).toBe(1);
    expect(catchUpFactor(-200, false)).toBeGreaterThan(1);
    expect(catchUpFactor(-200, false)).toBeLessThan(1.03);
    expect(catchUpFactor(-10000, true)).toBe(1);
    expect(catchUpFactor(10000, true)).toBe(1);
  });

  it('never brake-checks a player behind it: no brake on a clear road', () => {
    const r = raceNoTraffic({ seed: 2 });
    while (r.phase === 'grid') r.step();
    const info = trackInfo(r.track);
    // A long straight.
    let d = 300;
    while (Math.abs(curvAt(info, r.track.startS + d)) > 0.0015 || Math.abs(curvAt(info, r.track.startS + d + 250)) > 0.0015) d += 20;
    const rival = r.cars.find((c) => c.slot < 0)!;
    for (const c of r.cars) if (c.slot < 0 && c !== rival) putCar(r, c, d + 1500 + r.cars.indexOf(c) * 40, -5, 40);
    putCar(r, rival, d + 30, laneSide(r.track, 1, 0), 45);
    r.placeCar(0, d + 18, 50, 1);
    const i = r.cars.indexOf(rival);
    let braked = 0;
    for (let k = 0; k < 120; k++) {
      r.step();
      if (r.inputs[i].brake > 0) braked++;
    }
    expect(braked).toBe(0);
  });

  it.each(['easy', 'normal', 'hard'] as const)('%s: every rival drives three laps in plausible times, none stuck', (difficulty) => {
    const r = race({ seed: 1, difficulty });
    // The player dawdles (no catch-up race): the rivals finish first.
    r.setAutopilot(0, true, 0.62);
    for (let i = 0; i < 60000 && r.cars.some((c) => c.slot < 0 && !c.finished); i++) r.step();
    for (const c of r.cars) {
      if (c.slot >= 0) continue;
      expect(c.finished, c.team).toBe(true);
      expect(c.projected, c.team).toBe(false);
      expect(c.lapTicks, c.team).toHaveLength(3);
      for (const t of c.lapTicks) {
        expect(t, `${c.team} lap`).toBeGreaterThan(6600);
        expect(t, `${c.team} lap`).toBeLessThan(12000);
      }
      expect(c.phys.recoveries, c.team).toBeLessThanOrEqual(1);
    }
    const best = Math.min(...r.cars.filter((c) => c.slot < 0).map((c) => c.finishTicks));
    const worst = Math.max(...r.cars.filter((c) => c.slot < 0).map((c) => c.finishTicks));
    // A field, not a procession of equals and not a rout.
    expect(worst - best).toBeGreaterThan(300);
    expect(worst / best).toBeLessThan(1.25);
  });

  it("ACHTERUIT's gag: once, on a straight with a player behind it, it spins round and drives BACKWARDS as fast as forwards", () => {
    const r = raceNoTraffic({ seed: 1 });
    while (r.phase === 'grid') r.step();
    const L = r.track.length;
    const info = trackInfo(r.track);
    let d = 200;
    const straight = (x: number): boolean => {
      for (let k = 0; k <= GAG.straight + 200; k += 8) if (Math.abs(curvAt(info, r.track.startS + x + k)) > GAG.curv) return false;
      return true;
    };
    while (!straight(d)) d += 20;
    const car = r.cars.find((c) => c.team === 'ACHTERUIT')!;
    const brain = r.drivers[r.cars.indexOf(car)].ext as RivalBrain;
    expect(brain.gag).toBe('ready');
    for (const c of r.cars) if (c.slot < 0 && c !== car) putCar(r, c, L + d + 2000 + r.cars.indexOf(c) * 50, -5, 40);
    putCar(r, car, L + d, laneSide(r.track, 1, 0), 45);
    r.placeCar(0, L + d - 70, 30, 1);
    const seen = new Set<string>();
    let fastest = 0;
    for (let k = 0; k < 900 && brain.gag !== 'done'; k++) {
      r.step();
      seen.add(brain.gag);
      if (brain.gag === 'back' && car.speed < fastest) fastest = car.speed;
    }
    expect([...seen]).toEqual(expect.arrayContaining(['spin', 'back', 'spinBack']));
    expect(brain.gag).toBe('done');
    // Backwards (its nose to the rear) at motorway speed, and moving along the track all the while.
    expect(fastest).toBeLessThan(-28);
    expect(car.phys.recoveries).toBe(0);
    for (let k = 0; k < 300; k++) r.step();
    expect(car.speed).toBeGreaterThan(20);
  });
});

describe('the oncoming decor (ai-oncoming.ts)', () => {
  it('a fixed plan on the other carriageway, against our direction, busier as the race goes on', () => {
    const L = buildTrack().length;
    const a = oncomingPlan(L, 7);
    expect(oncomingPlan(L, 7)).toEqual(a);
    expect(a.length).toBeGreaterThan(150);
    for (const c of a) {
      expect(c.lane).toBeGreaterThanOrEqual(0);
      expect(c.lane).toBeLessThan(ONCOMING_LANES.length);
      if (c.kind === 2) expect(c.lane).toBeGreaterThan(0);
      const s0 = oncomingS(c, L, 0);
      const s1 = oncomingS(c, L, 60);
      expect(dsOf(s0, s1, L)).toBeLessThan(0);
      expect(-dsOf(s0, s1, L)).toBeCloseTo(c.v * 60, 6);
    }
    for (const l of ONCOMING_LANES) expect(l.side).toBeLessThan(-8.1);
    expect(oncomingDensity(0)).toBeLessThan(0.5);
    expect(oncomingDensity(3)).toBe(1);
  });
});

describe("the physics takes CARS' anchors (physics.ts, lead note 3)", () => {
  it('the estate: its box (the push bar forward), wheelbase and bumper camera from its model', () => {
    const h = handlingOf(ESTATE_WHITE) as HandlingB;
    expect(h.halfLen * 2).toBeCloseTo(5.085, 3);
    expect(h.offZ).toBeGreaterThan(0.1);
    expect(h.wheelbase).toBeCloseTo(2.68, 6);
    expect(h.circles).toBe(3);
    expect(bodyShape(h)!.cam).toEqual([0, 1.02, 1.85]);
  });

  it("ACHTERUIT's belt drive: full reverse reaches its forward top speed backwards", () => {
    const spec = TEAMS.find((t) => t.spec.team === 'ACHTERUIT')!.spec;
    const track = buildTrack();
    const info = trackInfo(track);
    let s = track.startS + 400;
    while (Math.abs(curvAt(info, s)) > 0.001 || Math.abs(curvAt(info, s - 600)) > 0.001) s += 25;
    const sp = track.spline.sample(s, splineSample());
    const b = { id: 'x', pos: [sp.p[0], sp.p[1], sp.p[2]] as [number, number, number], yaw: Math.atan2(sp.t[0], sp.t[2]), speed: 0, steer: 0, s, side: 0, dist: 0, phys: newPhys(handlingOf(spec)) };
    const inp = emptyRallyInput();
    inp.brake = 127;
    const tmp = splineSample();
    for (let i = 0; i < 900; i++) stepBody(b, inp, track, tmp);
    // The same 15 s forwards from the same spot: as fast backwards as forwards.
    const f = { ...b, pos: [sp.p[0], sp.p[1], sp.p[2]] as [number, number, number], speed: 0, s, phys: newPhys(handlingOf(spec)) };
    const gas = emptyRallyInput();
    gas.gas = 127;
    for (let i = 0; i < 900; i++) stepBody(f, gas, track, tmp);
    expect(b.speed).toBeLessThan(-30);
    expect(-b.speed).toBeGreaterThan(f.speed * 0.95);
    // An estate stays at wave A's 8 m/s backwards.
    const e = { ...b, pos: [sp.p[0], sp.p[1], sp.p[2]] as [number, number, number], speed: 0, s, phys: newPhys(handlingOf(ESTATE_WHITE)) };
    for (let i = 0; i < 300; i++) stepBody(e, inp, track, tmp);
    expect(e.speed).toBeGreaterThan(-8.01);
  });
});

