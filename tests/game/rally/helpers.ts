/**
 * Test tracks and harness helpers for the rally race (DRIVE's tests). The tracks are plain
 * `RallyTrack`s (no meshes) so the physics, the drivers and the race can be tested without the lazy
 * content: a long loop in the size of the compressed A10 (about 6.5 km), a small oval, a straight.
 */
import { InputManager, type PlayerSlot } from '../../../src/engine/input';
import { Spline3 } from '../../../src/engine/r3/spline';
import type { CarSpec, CarState, GridSlot, RallyTrack } from '../../../src/game/rally/api';
import { RallyRunner } from '../../../src/game/rally/runner';
import { GameSession, type Difficulty } from '../../../src/game/session';

export interface TestTrackOpts {
  halfWidth?: number;
  lanes?: number;
  laneWidth?: number;
  startS?: number;
  id?: string;
}

/** A RallyTrack through control points (x, y, z flat), with the stub's grid layout. */
export function trackOf(points: readonly number[], o: TestTrackOpts = {}): RallyTrack {
  const spline = new Spline3(points, { sub: 32 });
  const L = spline.length;
  const startS = o.startS ?? 40;
  const grid: GridSlot[] = [];
  for (let i = 0; i < 8; i++) grid.push({ s: spline.wrap(startS - 6 - 8 * Math.floor(i / 2) - (i % 2) * 4), side: i % 2 === 0 ? -2.5 : 2.5 });
  return {
    id: o.id ?? 'test',
    spline,
    length: L,
    halfWidth: o.halfWidth ?? 8,
    lanes: o.lanes ?? 3,
    laneWidth: o.laneWidth ?? 3.5,
    startS,
    grid,
    parLapTicks: Math.round((L / 45) * 60),
    meshes: [],
    pages: [],
    items: [],
  };
}

/**
 * A loop of about 6.5 km like the compressed A10: long straights, sweeping bends (radius 250–600 m)
 * and two tighter ones (about 150 m), a little height (±6 m).
 */
export function ringTrack(): RallyTrack {
  const pts: number[] = [];
  // A rounded, slightly irregular loop (clockwise seen from above with x east, z south).
  const n = 48;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rx = 1150 + 120 * Math.cos(3 * a);
    const rz = 720 + 90 * Math.sin(2 * a);
    // A squarer shape (straights) by a soft superellipse.
    const c = Math.cos(a);
    const s = Math.sin(a);
    const k = 0.55;
    const x = rx * Math.sign(c) * Math.pow(Math.abs(c), k);
    const z = rz * Math.sign(s) * Math.pow(Math.abs(s), k);
    const y = 6 * Math.sin(2 * a + 0.7);
    pts.push(x, y, z);
  }
  return trackOf(pts, { id: 'test-ring' });
}

/** A small oval (about 1 km). */
export function ovalTrack(): RallyTrack {
  const pts: number[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(260 * Math.cos(a), 0, 120 * Math.sin(a));
  }
  return trackOf(pts, { id: 'test-oval' });
}

/**
 * A straight of 8 km (a long, thin loop: its far ends turn round), `halfWidth` m each side (default
 * 8; a wide one for free driving). The start line is 1 km into the straight.
 */
export function straightTrack(halfWidth = 8): RallyTrack {
  const pts: number[] = [];
  for (let i = 0; i < 80; i++) pts.push(0, 0, i * 100);
  pts.push(400, 0, 8200, 800, 0, 7900);
  for (let i = 79; i >= 0; i--) pts.push(800, 0, i * 100);
  pts.push(400, 0, -300);
  return trackOf(pts, { id: 'test-straight', startS: 1000, halfWidth });
}

export interface RaceHarness {
  input: InputManager;
  session: GameSession;
  runner: RallyRunner;
  /** One tick: the input, then the race. */
  step(n?: number): void;
  car(slot?: PlayerSlot): CarState;
}

/** A race on a test track (the race mode on unless `raceMode` false). */
export function race(o: { track?: RallyTrack; seed?: number; players?: 1 | 2; difficulty?: Difficulty; raceMode?: boolean; lap?: 1 | 2 | 3; cam?: 'chase' | 'bumper' } = {}): RaceHarness {
  const input = new InputManager();
  input.players = o.players ?? 1;
  input.raceMode = o.raceMode ?? true;
  const session = new GameSession({ characters: (o.players ?? 1) === 2 ? ['recruit', 'vincent'] : ['recruit'], seed: o.seed ?? 1, difficulty: o.difficulty ?? 'normal' });
  const runner = new RallyRunner({ seed: o.seed ?? 1, difficulty: o.difficulty ?? 'normal', players: o.players ?? 1, session, pads: [input.pad(0), input.pad(1)], track: o.track ?? ringTrack(), lap: o.lap, cam: o.cam });
  runner.start();
  return {
    input,
    session,
    runner,
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        input.update();
        runner.step();
      }
    },
    car(slot: PlayerSlot = 0) {
      return runner.carOf(slot)!;
    },
  };
}

/** A copy of a spec with some fields changed. */
export function specWith(spec: CarSpec, over: Partial<CarSpec>): CarSpec {
  return { ...spec, ...over };
}
