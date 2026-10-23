/**
 * The car physics (src/game/rally/physics.ts; docs/design/rally.md §2, §6, §12.4): the estates'
 * acceleration, top speed and brakes, the understeer at speed, the handbrake slide, the barriers,
 * car–car contact by mass, the recovery, the slipstream and the road surface.
 */
import { describe, expect, it } from 'vitest';
import { splineSample } from '../../../src/engine/r3/spline';
import { atan2T } from '../../../src/engine/r3/trig';
import { emptyRallyInput, type CarSpec, type RallyBody, type RallyInput, type RallyTrack } from '../../../src/game/rally/api';
import { Collider, draftStep, frontGrip, handlingOf, lockAt, newPhys, PHYS, recoverBody, stepBody, stepCar, stuckStep, trackBounds } from '../../../src/game/rally/physics';
import { ESTATE_GREEN, ESTATE_WHITE, RIVAL_SPECS } from '../../../src/game/rally/runner';
import { ringTrack, straightTrack } from './helpers';

const WIDE = straightTrack(80);
const NARROW = straightTrack(8);

/** A free body on a track at arc length s, side offset `side`, facing along the road. */
function body(track: RallyTrack, s: number, side = 0, spec: CarSpec = ESTATE_WHITE, id = spec.id): RallyBody {
  const sp = track.spline.sample(s);
  return {
    id,
    pos: [sp.p[0] + sp.r[0] * side, sp.p[1], sp.p[2] + sp.r[2] * side],
    yaw: atan2T(sp.t[0], sp.t[2]),
    speed: 0,
    steer: 0,
    s,
    side,
    dist: 0,
    phys: newPhys(handlingOf(spec)),
  };
}

function input(o: Partial<RallyInput> = {}): RallyInput {
  return { ...emptyRallyInput(), ...o };
}

/** Step a body n ticks with a fixed input (or a function of the tick). */
function run(b: RallyBody, track: RallyTrack, n: number, inp: RallyInput | ((t: number) => RallyInput), each?: (t: number) => boolean | void): number {
  const tmp = splineSample();
  for (let t = 0; t < n; t++) {
    stepBody(b, typeof inp === 'function' ? inp(t) : inp, track, tmp);
    if (each?.(t) === true) return t + 1;
  }
  return n;
}

/** Bring a body to speed v (full gas on the straight). */
function upTo(b: RallyBody, track: RallyTrack, v: number): void {
  run(b, track, 4000, input({ gas: 127 }), () => b.speed >= v);
}

describe('the estates: acceleration, top speed, brakes (spec §6: heavy, about 220 km/h)', () => {
  it('0–100 km/h in about 4–6 s, 0–200 in under 25 s, a top speed of about 220 km/h and never more', () => {
    const b = body(WIDE, 1000);
    let t100 = -1;
    let t200 = -1;
    let vmax = 0;
    run(b, WIDE, 60 * 60, input({ gas: 127 }), (t) => {
      if (t100 < 0 && b.speed >= 100 / 3.6) t100 = t / 60;
      if (t200 < 0 && b.speed >= 200 / 3.6) t200 = t / 60;
      vmax = Math.max(vmax, b.speed);
      return b.s > 7000;
    });
    expect(t100).toBeGreaterThan(3.5);
    expect(t100).toBeLessThan(6);
    expect(t200).toBeGreaterThan(10);
    expect(t200).toBeLessThan(25);
    expect(vmax * 3.6).toBeGreaterThan(212);
    expect(vmax).toBeLessThanOrEqual(ESTATE_WHITE.topSpeed + 1e-9);
    // Drives straight with the wheel centred: no sideways drift, no slide.
    expect(Math.abs(b.side)).toBeLessThan(0.01);
    expect(Math.abs(b.phys.slip)).toBeLessThan(1e-9);
  });

  it('the handling: front-wheel drive, both estates the same, a 4.9 × 1.76 m body; a heavier car turns in slower', () => {
    const h = handlingOf(ESTATE_WHITE);
    expect(h.fwd).toBe(true);
    expect(h.halfLen).toBeCloseTo(2.45);
    expect(h.halfWid).toBeCloseTo(0.88);
    const g = handlingOf(ESTATE_GREEN);
    expect({ ...g }).toEqual({ ...h });
    const heavy = handlingOf(RIVAL_SPECS.find((s) => s.mass >= 1700)!);
    expect(heavy.yawResp).toBeLessThan(h.yawResp);
    expect(handlingOf(ESTATE_WHITE)).toBe(h); // cached per spec
    // The drag puts the power curve's end at the top speed.
    const a = h.power / h.topSpeed - h.drag * h.topSpeed * h.topSpeed - h.roll;
    expect(Math.abs(a)).toBeLessThan(1e-9);
  });

  it('brakes from 100 km/h in about 30–40 m; holding the brake at a standstill reverses (up to 8 m/s)', () => {
    const b = body(WIDE, 1000);
    upTo(b, WIDE, 100 / 3.6);
    const d0 = b.dist;
    const n = run(b, WIDE, 600, input({ brake: 127 }), () => b.speed <= 0.5);
    expect(b.dist - d0).toBeGreaterThan(28);
    expect(b.dist - d0).toBeLessThan(42);
    expect(n / 60).toBeLessThan(3);
    run(b, WIDE, 400, input({ brake: 127 }));
    expect(b.speed).toBeLessThan(-7);
    expect(b.speed).toBeGreaterThanOrEqual(-PHYS.reverseTop - 1e-9);
    // The gas brakes the reverse first.
    run(b, WIDE, 120, input({ gas: 127 }));
    expect(b.speed).toBeGreaterThan(0);
  });

  it('coasting slows by the drag, the rolling resistance and the engine braking', () => {
    const b = body(WIDE, 1000);
    upTo(b, WIDE, 40);
    run(b, WIDE, 60, input());
    expect(b.speed).toBeLessThan(39);
    expect(b.speed).toBeGreaterThan(36);
  });
});

describe('steering: understeer at high speed, the handbrake slide', () => {
  /** The steady yaw rate and lateral acceleration at speed v with the wheel at `steer`. */
  function corner(v: number, steer: number, gas = 0, hb = false): { r: number; lat: number; slip: number; speed: number } {
    const b = body(WIDE, 1000);
    upTo(b, WIDE, v);
    run(b, WIDE, 40, input({ steer, gas, handbrake: hb }));
    return { r: b.phys.yawRate, lat: b.phys.lat, slip: b.phys.slip, speed: b.speed };
  }

  it('full lock at low speed turns tight; at high speed the front grip caps it (radius over 280 m at 200 km/h)', () => {
    const h = handlingOf(ESTATE_WHITE);
    const slow = corner(12, 127);
    expect(slow.speed / slow.r).toBeLessThan(25);
    const fast = corner(55, 127);
    const radius = fast.speed / fast.r;
    expect(radius).toBeGreaterThan(280);
    expect(fast.lat).toBeLessThanOrEqual(frontGrip(h, fast.speed, 0) + 0.05);
    // + steer = a left turn (the yaw grows).
    expect(fast.r).toBeGreaterThan(0);
    expect(corner(55, -127).r).toBeLessThan(0);
  });

  it('understeer: the speed-dependent lock asks more than the grip at full lock (the tyres scrub speed); full gas (front-wheel drive) widens the line', () => {
    const h = handlingOf(ESTATE_WHITE);
    for (const v of [20, 40, 58]) {
      const kin = (v * lockAt(h, v)) / h.wheelbase;
      expect(kin * v).toBeGreaterThan(frontGrip(h, v, 0));
    }
    const lift = corner(45, 127, 0);
    const power = corner(45, 127, 127);
    expect(power.lat).toBeLessThan(lift.lat);
    // The front grip falls at speed.
    expect(frontGrip(h, 60, 0)).toBeLessThan(frontGrip(h, 20, 0));
    // A half turn of the wheel at 30 m/s: proportional, below the cap.
    const half = corner(30, 40);
    const full = corner(30, 127);
    expect(half.r).toBeGreaterThan(0.1 * full.r);
    expect(half.r).toBeLessThan(0.7 * full.r);
  });

  it('normal cornering does not slide; the handbrake cuts the rear grip: the tail steps out, the car rotates faster, then catches', () => {
    expect(Math.abs(corner(40, 127).slip)).toBeLessThan(0.01);
    const plain = corner(25, 127);
    const b = body(WIDE, 1000);
    upTo(b, WIDE, 25);
    let maxSlip = 0;
    run(b, WIDE, 40, input({ steer: 127, handbrake: true }), () => {
      maxSlip = Math.max(maxSlip, Math.abs(b.phys.slip));
    });
    expect(maxSlip).toBeGreaterThan(4);
    expect(Math.abs(b.phys.yawRate)).toBeGreaterThan(1.5 * Math.abs(plain.r));
    expect(b.speed).toBeLessThan(22);
    run(b, WIDE, 90, input({ gas: 127 }));
    expect(Math.abs(b.phys.slip)).toBeLessThan(0.5);
  });

  it('the wheel moves at a rate (a key tap is a small correction) and returns faster', () => {
    const b = body(WIDE, 1000);
    upTo(b, WIDE, 30);
    run(b, WIDE, 3, input({ steer: 127, gas: 127 }));
    expect(b.steer).toBeCloseTo(3 * PHYS.steerRate, 9);
    run(b, WIDE, 1, input({ gas: 127 }));
    expect(b.steer).toBeCloseTo(3 * PHYS.steerRate - PHYS.steerReturn, 9);
  });
});

describe('the road: barriers, height and pitch', () => {
  it('a car steered into the barrier scrapes along it: never through it, speed lost, the scrape counted', () => {
    const b = body(NARROW, 1000, 2);
    upTo(b, NARROW, 33);
    const v0 = b.speed;
    const bd = { left: 0, right: 0 };
    let touched = -1;
    run(b, NARROW, 240, (t) => input({ gas: 127, steer: t < 40 ? -60 : 0 }), (t) => {
      trackBounds(NARROW, b.s, bd);
      expect(b.side + b.phys.h.halfWid).toBeLessThanOrEqual(bd.right + 1e-6);
      if (touched < 0 && b.phys.scrape > 0) touched = t;
    });
    expect(touched).toBeGreaterThan(0);
    expect(b.phys.scrapes).toBeGreaterThanOrEqual(1);
    expect(b.phys.scrapeSide === 1 || b.phys.scrape <= 0).toBe(true);
    expect(b.speed).toBeLessThan(v0 + 5);
    // The hit turned the car along the wall: it still drives forward along the road.
    expect(b.speed).toBeGreaterThan(15);
    expect(Math.cos(b.yaw - atan2T(NARROW.spline.sample(b.s).t[0], NARROW.spline.sample(b.s).t[2]))).toBeGreaterThan(0.95);
  });

  it('rattling along the wall is one scrape (a touch counts as new only after a gap)', () => {
    const b = body(NARROW, 1000, 2);
    upTo(b, NARROW, 33);
    run(b, NARROW, 300, (t) => input({ gas: 127, steer: t < 40 ? -60 : -25 }));
    expect(b.phys.scrapes).toBeGreaterThanOrEqual(1);
    expect(b.phys.scrapes).toBeLessThanOrEqual(3);
  });

  it('a straight-on hit stops the car at the wall (a little bounce, no flight)', () => {
    const b = body(WIDE, 1000);
    upTo(b, WIDE, 20);
    // Turn 90° to the right and drive at the right barrier.
    b.yaw -= Math.PI / 2;
    b.phys.slip = 0;
    let hit = false;
    run(b, WIDE, 600, input({ gas: 60 }), () => {
      if (b.phys.scrape > 0) hit = true;
      return hit;
    });
    expect(hit).toBe(true);
    expect(b.speed).toBeLessThan(5);
    expect(b.pos[1]).toBeCloseTo(WIDE.spline.sample(b.s).p[1], 9);
  });

  it('the car follows the road surface: the height of the track under it and the pitch of the slope', () => {
    const ring = ringTrack();
    const b = body(ring, 300);
    let up = 0;
    let down = 0;
    run(b, ring, 1800, () => input({ gas: 127, steer: 0 }), () => {
      const sp = ring.spline.sample(b.s);
      expect(Math.abs(b.pos[1] - sp.p[1])).toBeLessThan(1e-9);
      if (sp.t[1] > 0.005) {
        expect(b.phys.pitch).toBeGreaterThan(0);
        up++;
      } else if (sp.t[1] < -0.005) {
        expect(b.phys.pitch).toBeLessThan(0);
        down++;
      }
      return b.phys.scrape > 0;
    });
    expect(up + down).toBeGreaterThan(0);
  });

  it('stepCar is the same function (PREP\'s entry point)', () => {
    expect(stepCar).toBe(stepBody);
  });
});

describe('car–car contact (by mass, no overlap)', () => {
  it('a rear-end hit: momentum kept, the lighter car gets the larger change, no overlap after the pass', () => {
    const heavy = RIVAL_SPECS.find((s) => s.mass >= 1700)!;
    const light = RIVAL_SPECS.find((s) => s.mass <= 1200)!;
    const a = body(WIDE, 1000, 0, heavy, 'a');
    const b = body(WIDE, 1004.5, 0, light, 'b');
    a.speed = 20;
    b.speed = 5;
    const ma = a.phys.h.mass;
    const mb = b.phys.h.mass;
    const p0 = ma * a.speed + mb * b.speed;
    const col = new Collider();
    col.collide([a, b], 2, WIDE.length);
    const p1 = ma * a.speed + mb * b.speed;
    expect(Math.abs(p1 - p0) / p0).toBeLessThan(1e-9);
    expect(b.speed - 5).toBeGreaterThan(20 - a.speed);
    expect(a.speed).toBeLessThan(20);
    expect(col.hits).toBe(1);
    expect(col.hitDv[0]).toBeGreaterThan(PHYS.bumpEvent);
    // Apart: the bodies' end circles no longer overlap.
    const gap = Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]) - (a.phys.h.halfLen - a.phys.h.halfWid) - (b.phys.h.halfLen - b.phys.h.halfWid);
    expect(gap).toBeGreaterThanOrEqual(a.phys.h.halfWid + b.phys.h.halfWid - 1e-9);
    // The event cooldown: the same pair again at once is no new bump event.
    a.speed = 25;
    a.pos[2] = b.pos[2] - 4.4;
    col.collide([a, b], 2, WIDE.length);
    expect(col.hits).toBe(0);
  });

  it('a side swipe pushes the cars apart sideways and turns them; ghosts never collide', () => {
    const a = body(WIDE, 1000, -0.9, ESTATE_WHITE, 'a');
    const b = body(WIDE, 1000.5, 0.85, ESTATE_GREEN, 'b');
    a.speed = b.speed = 30;
    a.yaw -= 0.15; // a steers into b
    a.phys.slip = 0;
    const col = new Collider();
    col.collide([a, b], 2, WIDE.length);
    expect(Math.abs(a.phys.yawRate) + Math.abs(b.phys.yawRate)).toBeGreaterThan(0);
    const c = body(WIDE, 1000, 0, ESTATE_WHITE, 'c');
    const d = body(WIDE, 1001, 0, ESTATE_WHITE, 'd');
    d.phys.ghost = true;
    c.speed = 20;
    col.collide([c, d], 2, WIDE.length);
    expect(c.speed).toBe(20);
    d.phys.ghost = false;
    d.phys.blink = 10;
    col.collide([c, d], 2, WIDE.length);
    expect(c.speed).toBe(20);
  });
});

describe('a resting contact and the locked recovery (no two cars press on each other for long)', () => {
  it('a slow push or rub (closing below restVel) cancels the closing speed with no bounce and no turn', () => {
    const a = body(WIDE, 1000, -0.9, ESTATE_WHITE, 'a');
    const b = body(WIDE, 1000.5, 0.7, ESTATE_GREEN, 'b');
    a.speed = b.speed = 20;
    a.phys.slip = 0.5; // a drifts right into b at 0.5 m/s
    const col = new Collider();
    col.collide([a, b], 2, WIDE.length);
    // Pushed apart, and the closing speed is gone (no bounce: b takes it, a keeps none of it back).
    expect(b.phys.slip).toBeGreaterThan(0);
    expect(a.phys.slip).toBeLessThan(0.5);
    expect(a.phys.slip).toBeGreaterThan(0);
    expect(a.phys.yawRate).toBe(0);
    expect(b.phys.yawRate).toBe(0);
    expect(col.hits).toBe(0);
    // The rear body of a touching pair counts its lock up; the front one does not.
    expect(a.phys.lock).toBe(2);
    expect(b.phys.lock).toBe(0);
  });

  it('pressing on the car ahead for 3 s below half the top speed → the recovery is due (the rear car only)', () => {
    const a = body(WIDE, 1000, 0, ESTATE_WHITE, 'a');
    const b = body(WIDE, 1004.6, 0.3, RIVAL_SPECS[4], 'b');
    const col = new Collider();
    const ta = splineSample();
    const tb = splineSample();
    const gas = input({ gas: 127 });
    const idle = input();
    let due = -1;
    for (let t = 0; t < 400 && due < 0; t++) {
      stepBody(a, gas, WIDE, ta);
      stepBody(b, idle, WIDE, tb);
      if (stuckStep(a, gas, ta)) due = t + 1;
      expect(stuckStep(b, idle, tb)).toBe(false);
      col.collide([a, b], 2, WIDE.length);
    }
    expect(due).toBeGreaterThanOrEqual(PHYS.lockTicks);
    expect(due).toBeLessThan(PHYS.lockTicks + 60);
    expect(Math.abs(a.speed)).toBeLessThan(PHYS.lockSpeed * a.phys.h.topSpeed);
    recoverBody(a, WIDE, -3.5, ta);
    expect(a.phys.lock).toBe(0);
  });

  it('two cars side by side at speed never lock: a rub at race pace is no recovery', () => {
    const a = body(WIDE, 1000, -0.85, ESTATE_WHITE, 'a');
    const b = body(WIDE, 1000, 0.85, ESTATE_GREEN, 'b');
    a.speed = b.speed = 50;
    a.phys.lock = PHYS.lockTicks + 10;
    expect(stuckStep(a, input({ gas: 127 }), splineSample())).toBe(false);
  });
});

describe('recovery and slipstream', () => {
  it('3 s the wrong way → stuck; the recovery puts the car straight on the road, standing, held, blinking', () => {
    const b = body(WIDE, 1000, 3);
    b.yaw += Math.PI;
    const tmp = splineSample();
    const inp = input({ gas: 60 });
    let due = -1;
    for (let t = 0; t < 400 && due < 0; t++) {
      stepBody(b, inp, WIDE, tmp);
      if (stuckStep(b, inp, tmp)) due = t + 1;
    }
    expect(due).toBe(PHYS.recoverTicks);
    recoverBody(b, WIDE, 1.5, tmp);
    const sp = WIDE.spline.sample(b.s);
    expect(Math.cos(b.yaw - atan2T(sp.t[0], sp.t[2]))).toBeGreaterThan(0.999);
    expect(b.speed).toBe(0);
    expect(b.side).toBe(1.5);
    expect(b.phys.hold).toBe(PHYS.recoverHold);
    expect(b.phys.blink).toBe(PHYS.recoverBlink);
    expect(b.phys.recoveries).toBe(1);
    // Held: the gas does nothing until the hold is over.
    run(b, WIDE, PHYS.recoverHold, input({ gas: 127 }));
    expect(b.speed).toBe(0);
    run(b, WIDE, 10, input({ gas: 127 }));
    expect(b.speed).toBeGreaterThan(0);
  });

  it('standing still only counts while the driver tries to move (a waiting car is left alone)', () => {
    const b = body(WIDE, 1000);
    const tmp = splineSample();
    for (let t = 0; t < 400; t++) {
      stepBody(b, input(), WIDE, tmp);
      expect(stuckStep(b, input(), tmp)).toBe(false);
    }
    expect(b.phys.stuck).toBe(0);
  });

  it('slipstream: close behind a car in the same lane the drag falls and the top speed rises a little', () => {
    const lead = body(WIDE, 1012, 0, ESTATE_WHITE, 'lead');
    const tail = body(WIDE, 1000, 0, ESTATE_WHITE, 'tail');
    lead.speed = tail.speed = 55;
    for (let i = 0; i < 120; i++) draftStep(tail, [lead, tail], 2, WIDE.length);
    expect(tail.phys.draft).toBeGreaterThan(0.6);
    const side = body(WIDE, 1000, 3.5, ESTATE_WHITE, 'side');
    side.speed = 55;
    for (let i = 0; i < 120; i++) draftStep(side, [lead, side], 2, WIDE.length);
    expect(side.phys.draft).toBeLessThan(0.01);
    // At full draft the estate still pulls at its normal top speed (about +5 %).
    const h = tail.phys.h;
    const v = h.topSpeed;
    const pull = h.power / v - h.drag * v * v * (1 - PHYS.draftGain) - h.roll;
    expect(pull).toBeGreaterThan(0.3);
    const vDraft = Math.cbrt((h.power - h.roll * v) / (h.drag * (1 - PHYS.draftGain)));
    expect(vDraft / v).toBeGreaterThan(1.03);
    expect(vDraft / v).toBeLessThan(1.08);
  });
});

describe('determinism of the physics', () => {
  it('the same inputs give bit-identical states', () => {
    const go = (): number[] => {
      const b = body(ringTrack(), 200);
      const ring = ringTrack();
      run(b, ring, 2000, (t) => input({ gas: 127, steer: Math.round(127 * Math.sin(t / 37)), handbrake: t % 300 > 280 }));
      return [b.pos[0], b.pos[1], b.pos[2], b.yaw, b.speed, b.phys.slip, b.phys.yawRate, b.dist];
    };
    expect(go()).toEqual(go());
  });
});
