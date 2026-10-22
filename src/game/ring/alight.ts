/**
 * The alight scene (docs/design/ring.md §R.4; docs/api/ring.md "Revision R" and "Final jam, alight,
 * rf-a"): at the end of the short route's `final-jam` chunk the road stands, the wagons stop in
 * their lanes behind the standing queue, each hero climbs out of the window and jumps down onto
 * the road — the boarding jump (boarding.ts) run BACKWARDS: the somersault frames from the sill
 * down to the asphalt — and the drivers stay at the wheel (silent: `Wagon.talk` stays false). Then
 * `runner.handOver()` and ring-route's 40-tick fade to `rf-a`, whose first screen shows the parked
 * wagons with their drivers (content/ring/foot/props.ts).
 *
 * In 2P both heroes get out, P2 a little later. A hero who is not in a wagon at the plan's end
 * (wrecked and waiting, or out) does not alight; the hand-over gives him a fresh continue on foot
 * (`RunnerOptions.continueMission`). START skips the scene after the first play (`setAlightSeen`;
 * like the boarding: `ringAlighting(world)` tells the scene not to pause on that START).
 *
 * Owner: JAM+FOOT (revision R, wave A). Installs `RING_HOOKS.alight` at import (the RingScene
 * imports this module). The hook's signature is CORE's: `ringAlight(runner)`.
 */
import { Entity } from '../../engine/entity';
import type { World } from '../../engine/world';
import { dust } from '../fx';
import type { RingHero } from './hero';
import { RING_HOOKS } from './hooks';
import { laneY, nearestLane } from './lanes';
import type { RingRunner } from './runner';
import { WINDOW_DX, type Wagon } from './wagon';

/** The speed-cap key of the alight (`runner.limitSpeed`). */
export const ALIGHT_KEY = 'alight';

/** Timing of the alight (ticks) and its hop (px). */
export const ALIGHT = Object.freeze({
  /** The wagons' last creep: at least this long, until the road stands (and at most `stopMax`). */
  stopMin: 20,
  stopMax: 240,
  /** A wagon still driving in (a fresh one) gets this long to arrive first. */
  arriveMax: 90,
  /** After the stop: P1 and P2 start their climb (P2 a little later). */
  delay: [10, 26] as readonly number[],
  /** The climb out: the somersault run backwards, from the sill down to the road. */
  jumpTicks: 24,
  /** The hop: the sill's height over the road and the arc's top, the step away from the door, the landing plane (px nearer). */
  sill: 10,
  arc: 26,
  step: 10,
  nearer: 4,
  /** Standing on the asphalt after the landing, then the hand-over. */
  landTicks: 24,
  /** The stub's old constant (kept for CORE's callers): the shortest stand before the hand-over. */
  stubTicks: 40,
});

/** Kept for CORE's stub callers (the shortest stand before the hand-over). */
export const ALIGHT_STUB_TICKS = ALIGHT.stubTicks;

type Phase = 'arrive' | 'stop' | 'wait' | 'jump' | 'land' | 'done';

interface Seat {
  hero: RingHero;
  wagon: Wagon;
  phase: Phase;
  t: number;
  /** The window (the jump's start) and the landing spot, world x / plane y. */
  fromX: number;
  toX: number;
  landY: number;
}

let seen = false;

/** Mark the alight as seen (START skips it from then on); tests and tools set it. */
export function setAlightSeen(v: boolean): void {
  seen = v;
}

export function alightSeen(): boolean {
  return seen;
}

const directors = new WeakMap<World, AlightDirector>();
const started = new WeakSet<World>();

/** Is the alight scene running in this world (the sim's pacing watch excuses it; the scene keeps START from pausing)? */
export function ringAlighting(world: World): boolean {
  if (!started.has(world)) return false;
  const d = directors.get(world);
  return !d || d.alive;
}

/** The alight's director: a hidden entity that runs it tick by tick (the boarding's twin). */
export class AlightDirector extends Entity {
  readonly runner: RingRunner;
  readonly seats: Seat[] = [];
  private readonly skippable: boolean;
  private t = 0;
  private finished = false;

  constructor(runner: RingRunner) {
    super(runner.world, runner.world.camera.x, 0);
    this.runner = runner;
    this.type = 'ring-alight';
    this.despawnMargin = Infinity;
    this.skippable = seen;
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
  }

  /** Every hero in a wagon gets a seat; NO SCRATCHES is noted while he is still mounted. */
  setup(): void {
    const r = this.runner;
    r.limitSpeed(ALIGHT_KEY, 0);
    for (const hero of r.players) {
      const w = hero.wagon;
      if (!w || !w.alive || w.state !== 'driven') continue;
      if (hero.state !== 'mounted' && hero.state !== 'spawn') continue;
      // handOver() notes it for mounted heroes only: they are on foot by then.
      if (hero.state === 'mounted' && w.cells >= w.maxCells) hero.slot.mission.noScratches = true;
      w.scripted = true;
      w.autopilot = false;
      w.sideV = 0;
      this.seats.push({ hero, wagon: w, phase: w.arriving ? 'arrive' : 'stop', t: 0, fromX: 0, toX: 0, landY: 0 });
    }
    seen = true;
  }

  override update(): void {
    if (this.finished) return;
    this.t++;
    if (this.skippable && this.runner.players.some((p) => p.pad.pressed('start'))) {
      this.skip();
      return;
    }
    if (this.seats.length === 0) {
      // Nobody to get out (every hero is out or wrecked): a short stand, then the hand-over.
      if (this.t >= ALIGHT.stubTicks) this.finish();
      return;
    }
    let done = true;
    for (const s of this.seats) {
      if (!s.wagon.alive) s.phase = 'done';
      if (s.phase !== 'done') this.step(s);
      if ((s.phase as Phase) !== 'done') done = false;
    }
    if (done) this.finish();
  }

  /** Keep a scripted wagon with the (stopping) road and ease it into its lane. */
  private hold(w: Wagon): void {
    const v = this.runner.roadSpeed;
    w.vx = v;
    w.x += v;
    const ly = laneY(nearestLane(w.y));
    w.y += Math.max(-0.5, Math.min(0.5, ly - w.y));
  }

  private step(s: Seat): void {
    const w = s.wagon;
    const h = s.hero;
    s.t++;
    switch (s.phase) {
      case 'arrive':
        // A fresh wagon still driving in: it arrives first (its own drive-in, not scripted).
        w.scripted = false;
        if (!w.arriving || s.t >= ALIGHT.arriveMax) {
          w.scripted = true;
          s.phase = 'stop';
          s.t = 0;
        }
        break;
      case 'stop':
        this.hold(w);
        if ((s.t >= ALIGHT.stopMin && this.runner.roadSpeed < 0.05) || s.t >= ALIGHT.stopMax) {
          w.vx = 0;
          s.phase = 'wait';
          s.t = 0;
          // He is on his feet now (drawn on foot, out of the window); the driver stays at the wheel.
          s.fromX = w.x + WINDOW_DX;
          s.toX = s.fromX - ALIGHT.step;
          s.landY = w.y + ALIGHT.nearer;
          h.state = 'spawn';
          h.boarding = true;
          h.foot = { x: s.fromX, y: w.y, lift: ALIGHT.sill, mode: 'jump', t: 1 };
          this.world.audio.sfx('ring/foot/door');
        }
        break;
      case 'wait': {
        this.hold(w);
        const delay = ALIGHT.delay[h.index] ?? ALIGHT.delay[0];
        if (s.t >= delay) {
          s.phase = 'jump';
          s.t = 0;
        }
        break;
      }
      case 'jump': {
        this.hold(w);
        // The boarding jump backwards: k runs 1 → 0 (the somersault frames played in reverse).
        const k = Math.max(0, 1 - s.t / ALIGHT.jumpTicks);
        const f = h.foot;
        if (f) {
          f.mode = 'jump';
          f.t = k;
          f.x = s.toX + (s.fromX - s.toX) * k;
          f.y = s.landY + (w.y - s.landY) * k;
          f.lift = Math.sin(k * Math.PI) * ALIGHT.arc + k * ALIGHT.sill;
        }
        if (k <= 0) {
          s.phase = 'land';
          s.t = 0;
          if (f) {
            f.mode = 'stand';
            f.lift = 0;
            f.x = s.toX;
            f.y = s.landY;
          }
          dust(this.world, s.toX, s.landY, 4);
          this.world.audio.sfx('ring/foot/land');
        }
        break;
      }
      case 'land':
        this.hold(w);
        if (h.foot) {
          h.foot.x = s.toX;
          h.foot.y = s.landY;
        }
        if (s.t >= ALIGHT.landTicks) s.phase = 'done';
        break;
      case 'done':
        break;
    }
  }

  /** START (after the first play): every hero is on the road at once. */
  skip(): void {
    for (const s of this.seats) {
      if (!s.wagon.alive) continue;
      const w = s.wagon;
      w.vx = 0;
      w.scripted = true;
      s.toX = w.x + WINDOW_DX - ALIGHT.step;
      s.landY = w.y + ALIGHT.nearer;
      s.hero.state = 'spawn';
      s.hero.boarding = true;
      s.hero.foot = { x: s.toX, y: s.landY, lift: 0, mode: 'stand', t: 0 };
      s.phase = 'done';
    }
    this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.remove();
    this.runner.handOver();
  }

  override draw(): void {}
}

/**
 * The alight hook (`RING_HOOKS.alight`, the short route's plan end): the road stops
 * (`limitSpeed(ALIGHT_KEY, 0)`; the final jam already stands), the heroes get out, then
 * `runner.handOver()`. Without a hero in a wagon it hands over after `ALIGHT.stubTicks`.
 */
export function ringAlight(runner: RingRunner): void {
  const world = runner.world;
  if (started.has(world)) return;
  started.add(world);
  const d = new AlightDirector(runner);
  directors.set(world, d);
  world.add(d);
  d.setup();
}

RING_HOOKS.alight = ringAlight;
