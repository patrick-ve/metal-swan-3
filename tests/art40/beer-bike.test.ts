/**
 * The beer bike, its driver and the cork at 40 px (docs/design/ams40.md wave 3): the baked sets
 * `beer-bike` (vehicle/beer-bike, a machine: budget 40), `stag-beer-bike` (the guide: driver,
 * driver-flee) and `cork` (enemy/cork/fly), drawn by tools/art40/chars/{beer-bike,stag-beer-bike,cork}/,
 * keep the strip contract of docs/design/ams40/contract.md "beer bike, its driver and the cork": the
 * 13 ids, the mechanical counts (body 2, turret 5 aim steps, wheels 4 steps, keg 4), the class
 * counts of the people (a 12-frame pedal cycle, a 12-frame run), the points hand / head / hip on
 * every driver frame, 1× pixels at every art tier (rule 7), the colour budgets (D1); the fit with
 * the bike geometry the code reads (stools, seat hip, counter top, pivot, wheels: rule 10); the
 * frame picks of both bikes (wheel step per 3 px, keg step per 4 px, the pedal frame per PEDAL_PX
 * px rolled, the body's damage frame, the turret step); the enemy bike's and the rideable bike's
 * own update loops draw only existing frames; the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedFrame, type BakedSet } from '../../src/engine/baked';
import type { Renderer } from '../../src/engine/render';
import { frameCount, getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as BIKE_GEN from '../../src/game/content/art40/beer-bike.gen';
import * as CORK_GEN from '../../src/game/content/art40/cork.gen';
import * as DRIVER_GEN from '../../src/game/content/art40/stag-beer-bike.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/items/index';
import '../../src/game/content/stag/index';
import { PARTY_BIKE, StagBeerBike } from '../../src/game/content/stag/index';
import { STAG } from '../../src/game/content/stag/partier';
import '../../src/game/content/vehicles/beer-bike/index';
import { pedalFrame, wheelStep } from '../../src/game/content/vehicles/beer-bike/art';
import { DRIVEN_Z, kegStep, PARKED_Z } from '../../src/game/content/vehicles/beer-bike/bike';
import { BEER_BIKE, BeerBike, BIKE, TURRET_STEPS } from '../../src/game/content/vehicles/beer-bike/index';
import type { Player } from '../../src/game/player/player';
import { FLOOR, TestWorld } from '../content/helpers';

const BIKE_SET: BakedSet = BIKE_GEN.SET;
const DRIVER_SET: BakedSet = DRIVER_GEN.SET;
const CORK_SET: BakedSet = CORK_GEN.SET;
const SETS = [BIKE_SET, DRIVER_SET, CORK_SET];

interface ContractEntry {
  character: string;
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  defer?: boolean;
  totalTicks?: number;
  durations?: number[];
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const CONTRACT_IDS = Object.keys(CONTRACT).filter((id) => CONTRACT[id].character === 'beer-bike').sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const NINE = 9999;

/** [frames, durations, loop, defer, class] of every strip (the plan's class table, the contract). */
const STRIPS: Readonly<Record<string, readonly [number, readonly number[], boolean, boolean, string]>> = {
  'vehicle/beer-bike/body': [2, [NINE, NINE], true, false, 'mechanical'],
  'vehicle/beer-bike/posts': [1, [6], true, false, 'mechanical'],
  'vehicle/beer-bike/turret': [5, Array(5).fill(NINE), true, false, 'mechanical'],
  'vehicle/beer-bike/wheel': [4, Array(4).fill(NINE), true, false, 'mechanical'],
  'vehicle/beer-bike/wheel-far': [4, Array(4).fill(NINE), true, false, 'mechanical'],
  'vehicle/beer-bike/wreck': [1, [6], true, true, 'mechanical'],
  'vehicle/beer-bike/keg': [4, [4, 4, 4, 4], true, false, 'mechanical'],
  'vehicle/beer-bike/cork': [8, Array(8).fill(3), true, false, 'mechanical'],
  // the foam pass keeps its 20 ticks (the old [3, 5, 6, 6]): burst, jet, cone, break-up, sag, pop
  'vehicle/beer-bike/foam': [6, [2, 3, 3, 4, 4, 4], false, true, 'mechanical'],
  'vehicle/beer-bike/debris': [4, Array(4).fill(NINE), true, true, 'mechanical'],
  'enemy/stag-beer-bike/driver': [12, Array(12).fill(3), true, false, 'locomotion'],
  'enemy/stag-beer-bike/driver-flee': [12, Array(12).fill(2), true, true, 'locomotion'],
  'enemy/cork/fly': [8, Array(8).fill(3), true, false, 'prop'],
};

function strip(id: string): BakedSet['strips'][string] {
  const set = SETS.find((s) => id.startsWith(`${s.prefix}/`))!;
  return set.strips[id.slice(set.prefix.length + 1)];
}

/** The palette index of the frame's pixel at (x, y) relative to its anchor (0 = transparent / outside). */
function at(f: BakedFrame, idx: Uint8Array, x: number, y: number): number {
  const px = f.ox + x;
  const py = f.oy + y;
  if (px < 0 || py < 0 || px >= f.w || py >= f.h) return 0;
  return idx[py * f.w + px];
}

describe('beer bike at 40 px: the sets', () => {
  it('register exactly the contract ids (docs/design/ams40/contract.json), no variants', () => {
    expect(CONTRACT_IDS.length).toBe(13);
    const ids = SETS.flatMap((s) => bakedSetIds(s)).sort();
    expect(ids).toEqual(CONTRACT_IDS);
    expect(Object.keys(STRIPS).sort()).toEqual(CONTRACT_IDS);
    expect(SETS.map((s) => s.prefix)).toEqual(['vehicle/beer-bike', 'enemy/stag-beer-bike', 'enemy/cork']);
    for (const s of SETS) expect(s.variants ?? {}).toEqual({});
    for (const id of CONTRACT_IDS) expect(hasSprite(id), id).toBe(true);
  });

  it('frame counts, durations, loop and defer flags: the class table, the contract logic time', () => {
    for (const [id, [n, d, loop, defer, cls]] of Object.entries(STRIPS)) {
      const st = strip(id);
      const c = CONTRACT[id];
      expect(st.frames.length, id).toBe(n);
      expect(st.durations, id).toEqual(d);
      expect(st.loop, id).toBe(loop);
      expect(st.loop, `${id} loop = contract`).toBe(c.loop);
      expect(st.defer ?? false, id).toBe(defer);
      expect(st.defer ?? false, `${id} defer = contract`).toBe(c.defer ?? false);
      expect(st.cls, id).toBe(cls);
      // the registry plays the baked durations
      expect(frameCount(id), id).toBe(n);
      expect(spriteAnim(id).durations, id).toEqual(d);
    }
    // the mechanical counts the code indexes: body 2, turret 5, wheels 4, keg 4 (contract "keep")
    for (const [id, n] of [['body', 2], ['turret', 5], ['wheel', 4], ['wheel-far', 4], ['keg', 4]] as const) {
      expect(CONTRACT[`vehicle/beer-bike/${id}`].frames, id).toBe(n);
    }
    // the one-shot foam keeps its logic time
    expect(sum(strip('vehicle/beer-bike/foam').durations)).toBe(CONTRACT['vehicle/beer-bike/foam'].totalTicks);
  });

  it('every frame decodes: w*h pixels, palette indices in range, the budgets (D1), the one outline', () => {
    const budgets: Array<[BakedSet, number]> = [[BIKE_SET, 40], [DRIVER_SET, 28], [CORK_SET, 28]];
    for (const [set, budget] of budgets) {
      expect(set.budget, set.slug).toBe(budget);
      const fx = new Set(set.fx ?? []);
      const body = set.pal.slice(1).filter((_, i) => !fx.has(i + 1));
      expect(body.length, set.slug).toBeLessThanOrEqual(budget);
      expect(new Set(set.pal.slice(1)).size, set.slug).toBe(set.pal.length - 1);
      expect(set.pal[set.outline], set.slug).toBe('#140c0e');
      for (const [name, st] of Object.entries(set.strips)) {
        st.frames.forEach((f, i) => {
          const idx = decodeBakedIndices(f);
          expect(idx.length, `${set.slug} ${name}#${i}`).toBe(f.w * f.h);
          let max = 0;
          let solid = 0;
          for (const v of idx) {
            if (v > max) max = v;
            if (v) solid++;
          }
          expect(max, `${set.slug} ${name}#${i}`).toBeLessThan(set.pal.length);
          expect(solid, `${set.slug} ${name}#${i} has pixels`).toBeGreaterThan(20);
          expect(f.smear ?? false, `${set.slug} ${name}#${i}: no smear frames`).toBe(false);
        });
      }
    }
  });

  it('no two consecutive frames are the same picture (loops: also the last and the first)', () => {
    for (const id of CONTRACT_IDS) {
      const st = strip(id);
      const n = st.frames.length;
      if (n < 2) continue;
      for (let i = 0; i < (st.loop ? n : n - 1); i++) {
        const a = st.frames[i];
        const b = st.frames[(i + 1) % n];
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${id} ${i}->${(i + 1) % n}`).toBe(false);
      }
    }
  });

  it('the driver: hand, head and hip on every frame (contract), the hip on the saddle 18 px up, the hand at the bar', () => {
    for (const name of ['driver', 'driver-flee']) {
      const id = `enemy/stag-beer-bike/${name}`;
      const st = DRIVER_SET.strips[name];
      st.frames.forEach((f, i) => {
        for (const p of CONTRACT[id].framePoints[0]) {
          const pt = f.pts?.[p];
          expect(pt, `${name}#${i} ${p}`).toBeDefined();
          expect(Number.isFinite(pt![0]) && Number.isFinite(pt![1]), `${name}#${i} ${p}`).toBe(true);
        }
        expect(f.pts!.head[1], `${name}#${i} head over the hip`).toBeLessThan(f.pts!.hip[1] - 8);
      });
    }
    for (const f of DRIVER_SET.strips.driver.frames) {
      // seated: the hip BEER_BIKE.seatHip over the floor under the saddle (the bike draws him at its floor y)
      expect(f.pts!.hip[1]).toBe(-BEER_BIKE.seatHip);
      expect(f.pts!.hip[0]).toBe(0);
      expect(DRIVER_GEN.DRIVER_HIP).toBe(BEER_BIKE.seatHip);
      // the hands on the bar: forward of the hip at the bar's height (the bar in the body art at (35, -25))
      expect(f.pts!.hand[0]).toBeGreaterThanOrEqual(9);
      expect(f.pts!.hand[1]).toBeGreaterThanOrEqual(-27);
      expect(f.pts!.hand[1]).toBeLessThanOrEqual(-23);
      // nothing under the floor
      expect(f.h - f.oy).toBeLessThanOrEqual(0);
    }
    // a 40 px figure running (the cap included; the run's low stride frames dip to 36)
    for (const f of DRIVER_SET.strips['driver-flee'].frames) {
      expect(f.h).toBeGreaterThanOrEqual(36);
      expect(f.h).toBeLessThanOrEqual(46);
    }
  });

  it('fits the bike geometry the code reads (rule 10): stools, counter top, pivot, wheels off the riders', () => {
    const red = new Set(['#f06045', '#c62f30', '#861a2e'].map((c) => BIKE_SET.pal.indexOf(c)));
    for (const k of [0, 1]) {
      const f = BIKE_SET.strips.body.frames[k];
      const idx = decodeBakedIndices(f);
      // a red cushion under every rider's hip (stool x, the row under the hip seatHip px up)
      for (const sx of BEER_BIKE.stools) {
        const top = -BEER_BIKE.seatHip + 1;
        expect(red.has(at(f, idx, sx, top)) || red.has(at(f, idx, sx - 1, top)), `stool ${sx} body#${k}`).toBe(true);
      }
      // the counter top (the partner's perch) is the first solid row at x in the counter
      for (const x of [BEER_BIKE.counter.x0 + 2, -10, BEER_BIKE.counter.x1 - 2]) {
        expect(at(f, idx, x, BEER_BIKE.counter.top), `counter top at ${x}`).not.toBe(0);
      }
      // the body ends above the wheel strips' floor contact (the wheels reach the floor)
      expect(f.h - f.oy).toBeLessThanOrEqual(0);
      expect(f.w).toBeLessThanOrEqual(2 * BEER_BIKE.halfWidth + 12);
    }
    // the cannon: the brass ball on the pivot in every aim step
    for (const f of BIKE_SET.strips.turret.frames) {
      const idx = decodeBakedIndices(f);
      expect(at(f, idx, BEER_BIKE.pivot[0], BEER_BIKE.pivot[1]), 'pivot').not.toBe(0);
    }
    // the near wheels: the guide's pedal circle (hub + 3) is clear of the front wheel, every
    // stool's hub (stool + 6) is clear of both wheels
    const R = 7.4;
    const [rear, front] = BEER_BIKE.nearWheels;
    expect(front[0] - R).toBeGreaterThan(BEER_BIKE.driver[0] + 4 + 3);
    for (const sx of BEER_BIKE.stools) {
      expect(sx + 6 - 2.5, `stool ${sx}`).toBeGreaterThan(rear[0] + R);
      expect(sx + 6 + 2.5, `stool ${sx}`).toBeLessThan(front[0] - R);
    }
    // wheel strips: centre anchor, a r 7 wheel (15 px across with its outline)
    for (const name of ['wheel', 'wheel-far']) {
      for (const f of BIKE_SET.strips[name].frames) {
        expect([f.w, f.h], name).toEqual([17, 17]);
        expect([f.ox, f.oy], name).toEqual([8, 8]);
      }
    }
  });

  it('1x pixels at every art tier (rule 7): no dense art, getFrames(id, 2|4) give the 1x frames', () => {
    for (const id of CONTRACT_IDS) {
      expect(hasHiSprite(id, 2), id).toBe(false);
      expect(hasHiSprite(id, 4), id).toBe(false);
      const one = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id}@${d}`).toBe(one.length);
        hd.forEach((f, i) => {
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}#${i}`).toEqual([one[i].buf.w, one[i].buf.h, one[i].ox, one[i].oy]);
          expect(f.density ?? 1, `${id}@${d}#${i}`).toBe(1);
        });
      }
    }
  });
});

describe('beer bike at 40 px: the frame picks', () => {
  it('the named constants match the code (turret steps, wheel and keg steps, the cork tick)', () => {
    expect(BIKE_GEN.TURRET_FRAMES).toBe(TURRET_STEPS);
    expect(BIKE_GEN.WHEEL_STEPS).toBe(BIKE_SET.strips.wheel.frames.length);
    expect(BIKE_GEN.WHEEL_STEP_PX).toBe(3);
    expect(BIKE_GEN.KEG_STEPS).toBe(BIKE_SET.strips.keg.frames.length);
    expect(BIKE_GEN.KEG_STEP_PX).toBe(4);
    expect([BIKE_GEN.BODY_INTACT, BIKE_GEN.BODY_DAMAGED]).toEqual([0, 1]);
    expect(CORK_GEN.CORK_STEPS).toBe(CORK_SET.strips.fly.frames.length);
    expect(CORK_GEN.CORK_TPF).toBe(3);
    expect(DRIVER_GEN.PEDAL_FRAMES).toBe(DRIVER_SET.strips.driver.frames.length);
    expect(DRIVER_GEN.PEDAL_PX).toBe(2);
  });

  it('wheelStep: one step per 3 px rolled along the facing, 4 steps, also backwards; always a frame', () => {
    expect([0, 2.9, 3, 5.9, 6, 9, 11.9, 12].map(wheelStep)).toEqual([0, 0, 1, 1, 2, 3, 3, 0]);
    expect([-0.1, -3, -3.1, -12].map(wheelStep)).toEqual([3, 3, 2, 0]);
    for (let r = -50; r <= 50; r += 0.37) {
      const k = wheelStep(r);
      expect(Number.isInteger(k) && k >= 0 && k < 4, `${r}`).toBe(true);
    }
  });

  it('kegStep: one step per 4 px rolled; pedalFrame: one per 2 px, 12 a crank turn (24 px), NaN safe', () => {
    expect([0, 3.9, 4, 8, 12, 15.9, 16].map(kegStep)).toEqual([0, 0, 1, 2, 3, 3, 0]);
    expect([0, 1.9, 2, 23.9, 24, -2].map(pedalFrame)).toEqual([0, 0, 1, 11, 0, 1]);
    expect(pedalFrame(Number.NaN)).toBe(0);
    expect(pedalFrame(Number.POSITIVE_INFINITY)).toBe(0);
    // at the enemy's roll a crank turn takes 40 ticks: the feet keep pace with the 4-step wheels
    expect((DRIVER_GEN.PEDAL_FRAMES * DRIVER_GEN.PEDAL_PX) / PARTY_BIKE.roll).toBeCloseTo(40, 6);
  });
});

/** The sprite calls of one draw: id and frame. */
function calls(draw: (r: Renderer) => void): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  const r = new Proxy({} as Renderer, {
    get: (_t, k) => (k === 'sprite' ? (id: string, f: number) => out.push([id, f]) : () => undefined),
  });
  draw(r);
  return out;
}

const MINE = ['vehicle/beer-bike/', 'enemy/stag-beer-bike/', 'enemy/cork/'];
/** Every drawn id of this wave exists and its frame is an integer in range. */
function checkCalls(seen: Array<[string, number]>, label: string): void {
  for (const [id, f] of seen) {
    if (!MINE.some((p) => id.startsWith(p))) continue;
    const n = getFrames(id, 1).length;
    expect(n, `${label}: ${id} exists`).toBeGreaterThan(0);
    expect(Number.isInteger(f) && f >= 0 && f < n, `${label}: ${id} frame ${f} of ${n}`).toBe(true);
  }
}

describe('beer bike at 40 px: behaviour (the real update loops)', () => {
  it('the enemy bike: rolls, stops, its riders fire, damaged, every rider down (the guide flees), abandon; only existing frames', () => {
    const tw = new TestWorld({ width: 2000, playerX: 100, god: true, seed: 4 });
    const b = tw.spawn('stag-beer-bike', 700, { riders: 3 }) as StagBeerBike;
    const seen: Array<[string, number]> = [];
    const modes = new Set<string>();
    const driverFrames = new Set<number>();
    let flee = 0;
    tw.world.events.on('spawn', (e) => {
      if ((e as { sprite?: string }).sprite === 'enemy/stag-beer-bike/driver-flee') flee++;
    });
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      modes.add(b.mode);
      const c = calls((r) => b.draw(r));
      seen.push(...c);
      for (const [id, f] of c) if (id === 'enemy/stag-beer-bike/driver') driverFrames.add(f);
      if (t === 300) b.hp = Math.floor(b.maxHp / 3);
      if (t === 400) {
        const body = calls((r) => b.draw(r)).filter(([id]) => id === 'vehicle/beer-bike/body');
        expect(body.map(([, f]) => f)).toEqual([BIKE_GEN.BODY_DAMAGED]);
        for (const p of tw.ofType('stag-partier')) p.remove();
      }
    }
    checkCalls(seen, 'enemy bike');
    expect(modes.has('roll')).toBe(true);
    // pedalling: the guide shows many frames of his crank turn while the bike rolled
    expect(driverFrames.size).toBeGreaterThanOrEqual(8);
    expect(flee).toBe(1);
    // the converted bike (every rider down) draws only existing frames too
    const v = tw.ofType('beer-bike')[0] as BeerBike | undefined;
    if (v) checkCalls(calls((r) => v.draw(r)), 'converted');
  });

  it('the enemy bike wrecked: the wreck and the debris are drawn from existing frames', () => {
    const tw = new TestWorld({ width: 2000, playerX: 100, god: true, seed: 4 });
    const b = tw.spawn('stag-beer-bike', 600, { riders: 2 }) as StagBeerBike;
    tw.run(30);
    let debris = 0;
    tw.world.events.on('spawn', (e) => {
      const s = (e as { sprite?: string; frame?: number }).sprite;
      if (s === 'vehicle/beer-bike/debris') debris++;
    });
    tw.world.damage(b, { amount: 400, kind: 'explosion', dirX: 1, owner: 0 });
    const seen: Array<[string, number]> = [];
    for (let t = 0; t < 60; t++) {
      tw.run(1);
      if (!b.removed) seen.push(...calls((r) => b.draw(r)));
    }
    expect(b.dead).toBe(true);
    checkCalls(seen, 'wreck');
    expect(debris).toBeGreaterThan(0);
  });

  it('the rideable bike: parked behind the people, driven at the vehicle z; pedal, aim, keg, foam, eject: only existing frames', () => {
    const tw = new TestWorld({ width: 2000, playerX: 200, god: true, seed: 2 });
    const p = tw.player as Player;
    const v = tw.spawn('beer-bike', 200) as BeerBike;
    tw.run(1);
    expect(v.z).toBe(PARKED_Z);
    expect(PARKED_Z).toBeLessThan(27); // the street's people (AmsPerson) draw over a parked bike
    v.mount(p);
    tw.run(1);
    expect(v.z).toBe(DRIVEN_Z);
    const seen: Array<[string, number]> = [];
    const steps = new Set<number>();
    const script: Array<[number, Array<'right' | 'left' | 'up' | 'fire' | 'bomb'>]> = [
      [60, ['right']],
      [20, ['right', 'up']],
      [20, ['up', 'fire']],
      [6, ['bomb']],
      [30, []],
      [4, ['fire', 'bomb']],
      [60, ['left']],
    ];
    for (const [n, btn] of script) {
      tw.hold(...btn);
      for (let t = 0; t < n; t++) {
        tw.run(1);
        const c = calls((r) => v.draw(r));
        seen.push(...c);
        for (const [id, f] of c) if (id === 'vehicle/beer-bike/turret') steps.add(f);
        for (const k of tw.ofType('beer-keg')) seen.push(...calls((r) => k.draw(r)));
      }
    }
    checkCalls(seen, 'driven');
    expect(steps.size).toBeGreaterThanOrEqual(3);
    expect([...steps].every((s) => s < BIKE_GEN.TURRET_FRAMES)).toBe(true);
    v.eject('exit');
    tw.hold().run(2);
    expect(v.z).toBe(PARKED_Z);
  });

  it('gameplay numbers stay (D7): boxes, speeds, the cannon shot, the geometry the logic reads', () => {
    expect(PARTY_BIKE.box).toEqual({ x: -48, y: -14, w: 96, h: 14 });
    expect([PARTY_BIKE.hp, PARTY_BIKE.score, PARTY_BIKE.roll, PARTY_BIKE.fireGap, PARTY_BIKE.abandonTicks]).toEqual([400, 2000, 0.6, 40, 36]);
    expect([BIKE.speed, BIKE.ram.speed, BIKE.cannon.w, BIKE.cannon.h, BIKE.cannon.speed, BIKE.cannon.damage]).toEqual([1.4, 3.0, 6, 4, 7, 10]);
    expect(BIKE.keg).toEqual({ speed: 2.5, life: 120, damage: 150, radius: 24, cooldown: 30 });
    expect(BIKE.foam).toEqual({ reach: 64, half: 14, push: 12, cost: 3, cooldown: 240, eraseTicks: 16 });
    expect([...BEER_BIKE.stools]).toEqual([-34, -21, -8, 5]);
    expect([BEER_BIKE.seatHip, BEER_BIKE.halfWidth, BEER_BIKE.spout]).toEqual([18, 53, 7]);
    expect([...BEER_BIKE.driver]).toEqual([22, -1]);
    expect([...BEER_BIKE.pivot]).toEqual([46, -24]);
    expect(BEER_BIKE.counter).toEqual({ x0: -44, x1: 14, top: -27 });
    expect(BEER_BIKE.body).toEqual({ w: 80, h: 26 });
    expect(BEER_BIKE.hurt).toEqual({ x: -48, y: -58, w: 94, h: 58 });
    expect([...BEER_BIKE.kegStart, ...BEER_BIKE.foamStart]).toEqual([46, -6, 44, -20]);
    // the partier's cork: 6 x 4 box (contract), played at the bake's tick
    expect([STAG.corkW, STAG.corkH]).toEqual([6, 4]);
    const tw = new TestWorld({ width: 2000, playerX: 100, god: true, seed: 1 });
    const v = tw.spawn('beer-bike', 300, {}, FLOOR) as BeerBike;
    tw.run(1);
    expect(v.hurtboxes().length).toBeGreaterThan(0);
  });
});
