/**
 * The ZWAAN train's car transporter, tanker and livestock trailer (TRAIN-2, revision R wave A;
 * docs/design/ring.md §R.3; docs/api/ring.md "ZWAAN train: car transporter, tanker, livestock"):
 *
 * - registration; every strip at 1× / 2× / 4× from one drawer (the 1× geometry, PAL_HD colours);
 * - every attack after its tell (≥ 18 ticks on screen); at least one lane free of the dropped cars
 *   and the animals; a dropped car is cover (it stops shots) and a bump costs a wagon a cell;
 * - the slick makes a wagon slide (the steering lags, then the slide ends: `Wagon.slip`, opt-in);
 *   the flame trail costs a cell;
 * - the animals take no damage, never die and leave the road for the hard shoulder;
 * - the beaten sequences (the decks fold and the cars spill; the fireball and the tank's roll; the
 *   livestock trailer stops on the shoulder and the animals wander off), the drop;
 * - determinism (the same seed, the same attacks).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, setHiArt, spriteErrors } from '../../src/engine/sprites';
import type { Entity } from '../../src/engine/entity';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/ring/boss/index';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/traffic/index';
import '../../src/game/content/ring/zwaan/autos';
import '../../src/game/content/ring/zwaan/tank';
import '../../src/game/content/ring/zwaan/vee';
import '../../src/game/content/ring/zwaan/autos-art';
import '../../src/game/content/ring/zwaan/tank-art';
import '../../src/game/content/ring/zwaan/vee-art';
import { AutosPart, ZwaanCar, ZWAAN_CAR_ID } from '../../src/game/content/ring/zwaan/autos';
import { FLAME_ID, SLICK_AI, SLICK_ID, TankPart, ZwaanFlame, ZwaanSlick } from '../../src/game/content/ring/zwaan/tank';
import { VeePart } from '../../src/game/content/ring/zwaan/vee';
import { ANIMAL_AI, COW_ID, PIG_ID, ZwaanAnimal } from '../../src/game/content/ring/zwaan/vee-animals';
import { RING_ZWAAN } from '../../src/game/ring/ids';
import { laneY, nearestLane, SHOULDER_TOP } from '../../src/game/ring/lanes';
import { RingRig } from '../game/ring/ring-helpers';

const PREFIXES = ['boss/ring-zwaan/autos/', 'boss/ring-zwaan/tank/', 'boss/ring-zwaan/vee/'];

function rig(o: { god?: boolean; seed?: number } = {}): RingRig {
  const r = new RingRig({ god: o.god, seed: o.seed });
  r.run(2);
  return r;
}

/** A part alone (no controller) at the anchor, run until its fight starts. */
function partIn<P extends Entity>(r: RingRig, id: string, params: Record<string, unknown> = {}): P {
  const p = r.spawnAt<P & { state: string }>(id, 150, laneY(1), params);
  r.until(() => p.state === 'fight', 400);
  return p;
}

describe('ZWAAN parts (TRAIN-2): registration and art', () => {
  let warn: { mockRestore: () => void };
  beforeEach(() => {
    setHiArt(true);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('registers the three parts and their things', () => {
    for (const id of [RING_ZWAAN.autos, RING_ZWAAN.tank, RING_ZWAAN.vee, ZWAAN_CAR_ID, SLICK_ID, FLAME_ID, COW_ID, PIG_ID, 'ring-zwaan-lob']) expect(hasEntity(id), id).toBe(true);
  });

  it('every strip has 1× art and one HD drawer at 2× and 4× with the 1× geometry and PAL_HD colours', () => {
    let n = 0;
    for (const prefix of PREFIXES) {
      const ids = listSprites(prefix);
      expect(ids.length, prefix).toBeGreaterThan(8);
      for (const id of ids) {
        const lo = getFrames(id, 1);
        expect(lo.length, id).toBeGreaterThan(0);
        n++;
        for (const d of [2, 4] as const) {
          expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(true);
          const hi = getFrames(id, d);
          expect(hi.length, `${id}@${d}x`).toBe(lo.length);
          for (let i = 0; i < lo.length; i++) {
            const f = hi[i];
            expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}x[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
            let odd = 0;
            for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) odd++;
            expect(odd, `${id}@${d}x[${i}] colours`).toBe(0);
            expect(f.buf.countOpaque(), `${id}@${d}x[${i}] drawn`).toBeGreaterThan(0);
          }
        }
      }
      expect(spriteErrors().filter((e) => e.id.startsWith(prefix))).toEqual([]);
    }
    expect(n).toBeGreaterThanOrEqual(40);
  }, 240_000);
});

describe('ZWAAN AUTOTRANSPORT', () => {
  it('roll-offs and slides come after their tells; a lane always stays free of dropped cars', () => {
    const r = rig({ god: true });
    const a = partIn<AutosPart>(r, RING_ZWAAN.autos, { rate: 0 });
    let maxLanes = 0;
    for (let t = 0; t < 2400; t++) {
      r.run(1);
      const lanes = new Set(r.world.byTag(ZWAAN_CAR_ID).filter((c) => c.alive && (c as ZwaanCar).mode !== 'spill' && r.world.camera.containsPoint(c.x, c.y, 16)).map((c) => (c as ZwaanCar).lane));
      maxLanes = Math.max(maxLanes, lanes.size);
    }
    const fired = a.trace.filter((tr) => tr.fire >= 0);
    expect(fired.some((tr) => tr.attack === 'roll')).toBe(true);
    expect(fired.some((tr) => tr.attack === 'slide')).toBe(true);
    for (const tr of fired) {
      expect(tr.fire - tr.tell).toBeGreaterThanOrEqual(18);
      expect(tr.seen).toBeGreaterThanOrEqual(18);
    }
    expect(maxLanes).toBeLessThan(4);
    expect(a.dropped2).toBe(fired.length);
  }, 30_000);

  it('a dropped car is cover (shots stop on it, no damage) and a bump costs a wagon a cell', () => {
    const r = rig();
    const w = r.wagon;
    const lane = nearestLane(w.y);
    const car = r.spawnAt<ZwaanCar>(ZWAAN_CAR_ID, w.screenX + 120, laneY(lane), { colour: 'red', lane });
    expect(car.solid).toBe(true);
    expect(car.box.enabled).toBe(true);
    expect(car.hasTag('ring-car')).toBe(true);
    // The hero shoots along the lane: the shots end on the car.
    r.hold(['fire']);
    r.run(40);
    r.release();
    expect(car.shots).toBeGreaterThan(0);
    expect(car.alive).toBe(true);
    // It drifts back into the wagon: one cell.
    const before = w.cells;
    r.until(() => w.cells < before, 400);
    expect(before - w.cells).toBe(1);
  });

  it('beaten: the decks fold, the cars spill onto the hard shoulder, the drop, then it drops back', () => {
    const r = rig({ god: true });
    const a = partIn<AutosPart>(r, RING_ZWAAN.autos, { rate: 0 });
    a.kill(0);
    r.until(() => a.beaten === 'tip', 400);
    expect(a.tiltDeg).toBeGreaterThan(10);
    expect(a.spilled).toBeGreaterThanOrEqual(3);
    expect(a.dropped).not.toBeNull();
    r.until(() => !a.alive, 900);
    const spilled = r.world.byTag(ZWAAN_CAR_ID).filter((c) => (c as ZwaanCar).mode === 'spill') as ZwaanCar[];
    for (const c of spilled) expect(c.solid).toBe(false);
  });
});

describe('ZWAAN TANKWAGEN', () => {
  it('slicks and flame trails come after their tells; a slick makes the wagon slide (the steering lags), then the slide ends', () => {
    const r = rig({ god: true });
    const t = partIn<TankPart>(r, RING_ZWAAN.tank, { rate: 0 });
    // Heat the rear valve: a flare follows.
    r.world.damage(t, { amount: 200, kind: 'bullet', dirX: 1, owner: 0 }, 1);
    let slid = 0;
    for (let i = 0; i < 2400; i++) {
      r.run(1);
      for (const s of r.world.byTag(SLICK_ID)) slid = Math.max(slid, (s as ZwaanSlick).slid);
    }
    const fired = t.trace.filter((tr) => tr.fire >= 0);
    expect(fired.some((tr) => tr.attack === 'slick')).toBe(true);
    expect(fired.some((tr) => tr.attack === 'flame')).toBe(true);
    for (const tr of fired) {
      expect(tr.fire - tr.tell).toBeGreaterThanOrEqual(18);
      expect(tr.seen).toBeGreaterThanOrEqual(18);
    }
  }, 30_000);

  it('Wagon.slip (opt-in): a lane press waits until the slide ends; without a slip it acts at once', () => {
    const r = rig({ god: true });
    const w = r.wagon;
    r.run(10);
    expect(w.slipT).toBe(0);
    const lane = nearestLane(w.y);
    const to = lane < 4 ? lane + 1 : lane - 1;
    w.slip(SLICK_AI.slip);
    r.tap([to > lane ? 'down' : 'up']);
    expect(w.laneTarget).toBe(lane);
    r.run(10);
    expect(nearestLane(w.y)).toBe(lane);
    r.until(() => w.slipT === 0, 60);
    r.run(1);
    expect(w.laneTarget).toBe(to);
    r.until(() => nearestLane(w.y) === to, 60);
    // No slip: the press acts at once.
    r.tap([to > lane ? 'up' : 'down']);
    expect(w.laneTarget).toBe(lane);
  });

  it('a slick on the wagon\'s lane makes it slip; the flame trail costs a cell', () => {
    const r = rig();
    const w = r.wagon;
    const y = w.y;
    const s = r.world.spawn(SLICK_ID, w.x - 60, y, {}) as ZwaanSlick;
    s.grow(w.x + 80);
    r.run(2);
    expect(w.slipT).toBeGreaterThan(0);
    expect(s.slid).toBe(1);
    s.remove();
    r.until(() => w.slipT === 0, 80);
    const before = w.cells;
    const f = r.world.spawn(FLAME_ID, w.x, y, { ax: w.screenX + 60, fuse: 20 }) as ZwaanFlame;
    r.until(() => f.burning, 60);
    r.until(() => w.cells < before, 120);
    expect(before - w.cells).toBe(1);
    expect(f.burned).toBeGreaterThanOrEqual(1);
  });

  it('beaten: the fireball, the tank rolls onto the hard shoulder, the drop', () => {
    const r = rig({ god: true });
    const t = partIn<TankPart>(r, RING_ZWAAN.tank, { rate: 0 });
    t.kill(0);
    r.until(() => t.beaten === 'wreck', 400);
    expect(t.rollF).toBe(3);
    expect(t.y + t.rollDy).toBeGreaterThanOrEqual(SHOULDER_TOP);
    expect(t.dropped).not.toBeNull();
    r.until(() => !t.alive, 900);
  });
});

describe('ZWAAN VEETRANSPORT', () => {
  it('the herd and the lobs come after their tells; at most 2 animals on the road (a lane stays free)', () => {
    const r = rig({ god: true });
    const v = partIn<VeePart>(r, RING_ZWAAN.vee, { rate: 0 });
    let maxOnRoad = 0;
    for (let t = 0; t < 2400; t++) {
      r.run(1);
      maxOnRoad = Math.max(maxOnRoad, v.animalsOnRoad());
    }
    const fired = v.trace.filter((tr) => tr.fire >= 0);
    expect(fired.some((tr) => tr.attack === 'herd')).toBe(true);
    expect(fired.some((tr) => tr.attack === 'lob')).toBe(true);
    for (const tr of fired) {
      expect(tr.fire - tr.tell).toBeGreaterThanOrEqual(18);
      expect(tr.seen).toBeGreaterThanOrEqual(18);
    }
    expect(v.released).toBeGreaterThan(0);
    expect(maxOnRoad).toBeLessThanOrEqual(2);
  }, 30_000);

  it('the animals take no damage, never die, stop shots and leave the road for the shoulder', () => {
    const r = rig({ god: true });
    const w = r.wagon;
    const lane = nearestLane(w.y);
    const cow = r.spawnAt<ZwaanAnimal>(COW_ID, w.screenX + 90, laneY(lane), {});
    const pig = r.spawnAt<ZwaanAnimal>(PIG_ID, w.screenX + 140, laneY(Math.max(1, lane - 1)), {});
    for (const a of [cow, pig]) {
      expect(r.world.damage(a, { amount: 9999, kind: 'explosion', dirX: 1, owner: 0 })).toBe(false);
      r.world.damageArea({ x: a.x - 30, y: a.y - 20, w: 60, h: 40 }, { amount: 9999, kind: 'explosion', dirX: 1 }, 'player');
      expect(a.dead).toBe(false);
      expect(a.alive).toBe(true);
    }
    r.hold(['fire']);
    r.run(30);
    r.release();
    expect(cow.shots + pig.shots).toBeGreaterThan(0);
    r.until(() => cow.mode === 'graze' && pig.mode === 'graze', 400);
    for (const a of [cow, pig]) {
      expect(a.dead).toBe(false);
      expect(a.reachedShoulder).toBe(true);
      expect(a.y).toBe(ANIMAL_AI.graze);
      expect(a.solid).toBe(false);
    }
  });

  it('a hit on the hatch dazes the farmhand (no more lobs); beaten: it stops on the shoulder, the animals wander off unhurt', () => {
    const r = rig({ god: true });
    const v = partIn<VeePart>(r, RING_ZWAAN.vee, { rate: 0 });
    r.world.damage(v, { amount: 5000, kind: 'bullet', dirX: 1, owner: 0 }, 2);
    expect(v.dazed).toBe(true);
    const lobs = v.trace.filter((tr) => tr.attack === 'lob').length;
    r.run(900);
    expect(v.trace.filter((tr) => tr.attack === 'lob' && tr.fire >= 0 && tr.tell > r.world.tick - 900).length).toBe(0);
    expect(v.trace.filter((tr) => tr.attack === 'lob').length).toBe(lobs);
    v.kill(0);
    r.until(() => v.beaten === 'tip', 400);
    expect(v.y).toBeGreaterThanOrEqual(SHOULDER_TOP);
    r.run(30);
    const herd = r.world.byTag('ring-zwaan-animal') as ZwaanAnimal[];
    expect(herd.filter((a) => a.mode === 'graze' || a.mode === 'wander').length).toBeGreaterThanOrEqual(3);
    for (const a of herd) expect(a.dead).toBe(false);
    expect(v.dropped).not.toBeNull();
  });
});

describe('ZWAAN parts: determinism', () => {
  it('the same seed gives the same attacks', () => {
    const run = (): string => {
      const r = rig({ god: true, seed: 7 });
      const parts = [partIn<AutosPart>(r, RING_ZWAAN.autos, { rate: 0 })];
      r.run(1500);
      return JSON.stringify(parts[0].trace);
    };
    expect(run()).toBe(run());
  });
});
