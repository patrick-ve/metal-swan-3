/**
 * The boarding scene at the A10 Oost on-ramp and the exit (docs/design/ring.md §10; docs/api/ring.md
 * §5). Owner: the WAGON builder. Installs `RING_HOOKS.boarding` and `RING_HOOKS.planEnd` at import
 * time (content/ring/wagon/index.ts imports this module).
 *
 * BOARDING (in-engine, the road held still): each hero stands on the hard shoulder; his wagon comes
 * down the on-ramp facing LEFT (its left side and lettering show), makes a screeching handbrake
 * turn (the spin frames 4 → 0) and stops with its rear door window by him; the driver shouts
 * (`STAP IN!` + his own line) and honks; the hero somersaults into the window frame; the road
 * starts to roll and the wagon merges into lane 4 (`autopilot` for a moment), then the player
 * steers. In 2P both wagons come, P2's a little later. START skips it after the first play
 * (`setBoardingSeen`; the scene must not treat that START as its pause: `ringBoarding(world)`).
 *
 * EXIT (the plan's end, after the end-boss slot): the drivers say their exit line, the wagons steer
 * into lane 4 on autopilot, then onto the off-ramp and off the right edge; MISSION COMPLETE when
 * they are gone (or after `EXIT.maxTicks`).
 */
import { Entity } from '../../engine/entity';
import type { World } from '../../engine/world';
import { dust } from '../fx';
import type { RingHero } from './hero';
import { RING_HOOKS } from './hooks';
import { laneY, SHOULDER_TOP } from './lanes';
import type { RingRunner } from './runner';
import { RING } from './types';
import { WINDOW_DX, type Wagon } from './wagon';

export const BOARDING = Object.freeze({
  /** Screen x where each hero waits on the hard shoulder (P1, P2). */
  heroX: [176, 104] as readonly number[],
  /**
   * Two players (fix 2026-10-21): the seats a wagon length + 16 px apart (the wagons overlapped at
   * 72 px), and P2's wagon (the left seat) comes first so neither drives through the other.
   */
  heroX2: [200, 92] as readonly number[],
  delay2: [44, 12] as readonly number[],
  /** Plane y of the hard shoulder (the stopped wagons) and of the heroes' feet (a step nearer). */
  shoulderY: SHOULDER_TOP + 4,
  footY: SHOULDER_TOP + 7,
  /** The wagons enter this far right of the view, facing left, after `delay` ticks (P2 later). */
  enterX: 70,
  delay: [12, 50] as readonly number[],
  /** Speed down the ramp (px/tick) and the slide of the handbrake turn (px). */
  speed: 4.2,
  slide: 34,
  /** Ticks per spin frame of the handbrake turn (frames 4 → 0). */
  turnFrame: 4,
  /** The stop: the driver's line and the horn, then the jump. */
  stopTicks: 40,
  jumpTicks: 24,
  /** The merge into lane 4 on autopilot after the jump (ticks). */
  mergeTicks: 40,
});

export const EXIT = Object.freeze({
  /** Autopilot into lane 4, then the off-ramp: screen speed (px/tick) and its rise per tick. */
  rampSpeed: 0.5,
  rampAccel: 0.06,
  maxTicks: 260,
});

type Phase = 'wait' | 'come' | 'turn' | 'stop' | 'jump' | 'merge' | 'done';

interface Seat {
  hero: RingHero;
  wagon: Wagon;
  phase: Phase;
  t: number;
  /** Screen x where the wagon stops (its rear window by the hero) and where it starts the turn. */
  stopX: number;
  turnX: number;
  /** Ticks before its wagon comes down the ramp. */
  delay: number;
}

let seen = false;

/** Mark the boarding as seen (START skips it from then on); tests and tools set it. */
export function setBoardingSeen(v: boolean): void {
  seen = v;
}

export function boardingSeen(): boolean {
  return seen;
}

const active = new WeakMap<World, BoardingDirector>();

/** Is the boarding scene running in this world (the scene keeps START from pausing)? */
export function ringBoarding(world: World): boolean {
  const d = active.get(world);
  return !!d && d.alive;
}

/** The boarding scene's director: a hidden entity that runs it tick by tick. */
export class BoardingDirector extends Entity {
  readonly runner: RingRunner;
  readonly seats: Seat[] = [];
  private readonly skippable: boolean;
  private finished = false;

  constructor(runner: RingRunner) {
    super(runner.world, runner.world.camera.x, 0);
    this.runner = runner;
    this.type = 'ring-boarding';
    this.despawnMargin = Infinity;
    this.skippable = seen;
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
  }

  /** Take the heroes out of their wagons and set the scene. */
  setup(): void {
    const r = this.runner;
    const cam = this.world.camera;
    r.roadSpeed = 0;
    r.limitSpeed('boarding', 0);
    const seatsX = r.players.length > 1 ? BOARDING.heroX2 : BOARDING.heroX;
    for (const hero of r.players) {
      const w = hero.wagon;
      if (!w) continue;
      const i = hero.index;
      const hx = cam.x + (seatsX[i] ?? seatsX[0]);
      hero.boarding = true;
      hero.state = 'spawn';
      hero.foot = { x: hx, y: BOARDING.footY, lift: 0, mode: 'stand', t: 0 };
      w.scripted = true;
      w.view = 'left';
      w.x = w.prevX = cam.x + cam.w + BOARDING.enterX + 200;
      w.y = w.prevY = BOARDING.shoulderY;
      w.laneTarget = 4;
      const stopX = hx - WINDOW_DX;
      const delay = (r.players.length > 1 ? BOARDING.delay2[i] : BOARDING.delay[i]) ?? 24;
      this.seats.push({ hero, wagon: w, phase: 'wait', t: 0, stopX, turnX: stopX + BOARDING.slide, delay });
    }
    seen = true;
    active.set(this.world, this);
  }

  override update(): void {
    if (this.finished) return;
    if (this.skippable && this.runner.players.some((p) => p.pad.pressed('start'))) {
      this.skip();
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

  private step(s: Seat): void {
    const w = s.wagon;
    const h = s.hero;
    const cam = this.world.camera;
    s.t++;
    switch (s.phase) {
      case 'wait':
        w.x = cam.x + cam.w + BOARDING.enterX + 200;
        if (s.t >= s.delay) {
          s.phase = 'come';
          s.t = 0;
          w.x = w.prevX = cam.x + cam.w + BOARDING.enterX;
          this.world.audio.sfx('ring/wagon-horn');
        }
        break;
      case 'come':
        // Down the ramp facing left at speed, braking toward the turn.
        w.vx = -BOARDING.speed;
        w.x += w.vx;
        if (w.x <= s.turnX) {
          s.phase = 'turn';
          s.t = 0;
          w.view = 'spin';
          w.spinFrame = 4;
          this.world.audio.sfx('ring/wagon-screech');
        }
        break;
      case 'turn': {
        // The handbrake turn: the tail swings round (4 → 0) while the car slides to its stop.
        const n = 4 * BOARDING.turnFrame;
        const k = Math.min(1, s.t / n);
        w.spinFrame = Math.max(0, 4 - Math.floor(k * 4 + 1e-6));
        const nx = s.turnX + (s.stopX - s.turnX) * (1 - (1 - k) * (1 - k));
        w.vx = nx - w.x;
        w.x = nx;
        if (s.t % 3 === 0) dust(this.world, w.x + (s.t % 2 ? -24 : 26), w.y, 3);
        if (k >= 1) {
          s.phase = 'stop';
          s.t = 0;
          w.view = 'right';
          w.vx = 0;
          w.x = s.stopX;
          w.say('board', 90);
          this.world.audio.sfx('ring/wagon-horn');
        }
        break;
      }
      case 'stop':
        if (s.t >= BOARDING.stopTicks) {
          s.phase = 'jump';
          s.t = 0;
        }
        break;
      case 'jump': {
        // The somersault from the shoulder into the window frame.
        const f = h.foot;
        const k = Math.min(1, s.t / BOARDING.jumpTicks);
        if (f) {
          // A hop toward the car and up: he lands on the window sill (about 10 px up).
          const toX = s.stopX + WINDOW_DX;
          f.mode = 'jump';
          f.t = k;
          f.x = toX - 6 * (1 - k);
          f.y = BOARDING.footY - (BOARDING.footY - BOARDING.shoulderY) * k;
          f.lift = Math.sin(k * Math.PI) * 26 + k * 10;
        }
        if (k >= 1) {
          s.phase = 'merge';
          s.t = 0;
          h.boarding = false;
          h.foot = null;
          w.scripted = false;
          w.autopilot = true;
          w.laneTarget = 4;
          w.sideV = 0;
          h.arrive();
          this.world.audio.sfx('vehicle/mount');
          this.release();
        }
        break;
      }
      case 'merge':
        if (s.t >= BOARDING.mergeTicks || Math.abs(w.y - laneY(4)) < 0.5) {
          w.autopilot = false;
          s.phase = 'done';
        }
        break;
      case 'done':
        break;
    }
  }

  /** The road may roll again (the first wagon has its passenger). */
  private release(): void {
    this.runner.limitSpeed('boarding', null);
  }

  /** START (after the first play): every wagon at its stop with its passenger, merging. */
  skip(): void {
    for (const s of this.seats) {
      if (s.phase === 'done' || s.phase === 'merge' || !s.wagon.alive) continue;
      const w = s.wagon;
      w.view = 'right';
      w.x = w.prevX = s.stopX;
      w.vx = 0;
      w.scripted = false;
      w.autopilot = true;
      w.laneTarget = 4;
      s.hero.boarding = false;
      s.hero.foot = null;
      s.hero.arrive();
      s.phase = 'merge';
      s.t = 0;
    }
    this.release();
  }

  private finish(): void {
    this.finished = true;
    this.release();
    active.delete(this.world);
    this.remove();
  }

  override draw(): void {}
}

/** Tunnel landmarks: the drivers mention the dark (spec §3 lines). */
const TUNNELS: ReadonlySet<string> = new Set(['coentunnel', 'zeeburg']);

/** The wagon of a slot (null while it has none). */
function wagonOf(runner: RingRunner, slot: number): Wagon | null {
  const w = runner.player(slot)?.wagon ?? null;
  return w && w.state === 'driven' && !w.scripted ? w : null;
}

/**
 * The drivers' event lines (spec §3): a speed camera's fine, a hostage on the roof, a tunnel, the
 * boss. Wired once per run at the start (the bump, low armour, the boarding, the arrival and the
 * exit lines come from the wagon and the scenes themselves).
 */
export function wireDriverTalk(runner: RingRunner): void {
  runner.events.on('fine', (e) => wagonOf(runner, e.slot)?.say('flash'));
  runner.events.on('stretch', (e) => {
    if (!TUNNELS.has(e.id)) return;
    for (const p of runner.players) wagonOf(runner, p.index)?.say('tunnel');
  });
  runner.events.on('bossSlot', (e) => {
    if (!e.spawned) return;
    for (const p of runner.players) wagonOf(runner, p.index)?.say('boss');
  });
  runner.world.events.on('hostageRescued', (e) => wagonOf(runner, e.slot)?.say('hostage'));
}

/** The boarding hook: the scene starts; true = it took over the start. */
export function startBoarding(runner: RingRunner): boolean {
  wireDriverTalk(runner);
  if (runner.players.length === 0 || runner.planDist > RING.runIn) return false;
  const d = new BoardingDirector(runner);
  runner.world.add(d);
  d.setup();
  return true;
}

// ---------------------------------------------------------------------------------------------
// The exit
// ---------------------------------------------------------------------------------------------

interface ExitSeat {
  wagon: Wagon;
  phase: 'lane' | 'ramp' | 'gone';
  v: number;
}

/** The exit's director: autopilot into lane 4, the off-ramp, then MISSION COMPLETE. */
export class ExitDirector extends Entity {
  readonly runner: RingRunner;
  private readonly seats: ExitSeat[] = [];
  private t = 0;
  private done = false;

  constructor(runner: RingRunner) {
    super(runner.world, runner.world.camera.x, 0);
    this.runner = runner;
    this.type = 'ring-exit';
    this.despawnMargin = Infinity;
    this.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    for (const p of runner.players) {
      const w = p.wagon;
      if (!w || w.state !== 'driven') continue;
      w.autopilot = true;
      w.laneTarget = 4;
      w.sideV = 0;
      w.say('exit', 120);
      this.seats.push({ wagon: w, phase: 'lane', v: 0 });
    }
  }

  override update(): void {
    if (this.done) return;
    this.t++;
    const cam = this.world.camera;
    let all = true;
    for (const s of this.seats) {
      const w = s.wagon;
      if (!w.alive || w.state !== 'driven') s.phase = 'gone';
      if (s.phase === 'lane') {
        if (Math.abs(w.y - laneY(4)) < 0.5 || this.t > 90) {
          s.phase = 'ramp';
          w.scripted = true;
          s.v = Math.max(0, w.sideV);
        }
      } else if (s.phase === 'ramp') {
        // Off the ring: down onto the off-ramp behind the near barrier and away to the right.
        s.v = Math.min(5, s.v + EXIT.rampAccel);
        w.vx = this.runner.roadSpeed + EXIT.rampSpeed + s.v;
        w.x += w.vx;
        w.y = Math.min(SHOULDER_TOP + 8, w.y + 0.25);
        if (w.x - cam.x > cam.w + 70) s.phase = 'gone';
      }
      if (s.phase !== 'gone') all = false;
    }
    if (all || this.t >= EXIT.maxTicks) this.finish();
  }

  private finish(): void {
    this.done = true;
    this.runner.completeMission();
    this.remove();
  }

  override draw(): void {}
}

/** The plan-end hook: the exit runs, then MISSION COMPLETE. */
export function startExit(runner: RingRunner): void {
  const live = runner.players.some((p) => p.wagon?.state === 'driven');
  if (!live) {
    runner.completeMission();
    return;
  }
  runner.world.add(new ExitDirector(runner));
}

RING_HOOKS.boarding = startBoarding;
RING_HOOKS.planEnd = startExit;
