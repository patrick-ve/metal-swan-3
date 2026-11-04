/**
 * The Swan at 40 px, stage 2 "water and air" (docs/design/ams40.md wave 7, "The Swan"): the baked
 * set `swan-water` (src/game/content/art40/swan-water.gen.ts, drawn by tools/art40/chars/swan-water/)
 * keeps the strip contract of docs/design/ams40/contract.md for swim, water-duck, paddle-up,
 * settle, honk-swim, flap, glide, glide-tired, fold, honk-air (with their -front overlays), rise,
 * sit-down, dive, migrate and migrate-soot: the ids (P1 vehicle/swan, P2 vehicle/swan-mute: the same
 * pixels with the black swan's palette), the frame counts and the logic times the game reads, every
 * point name on every frame, the water line (plan rule 10), the events the code reads, 1× pixels at
 * every tier; the Swan's own update loop picks an existing frame at every tick in the water, in the
 * air and on land; the gameplay numbers stay (plan D7).
 *
 * The set is registered here the way src/game/content/vehicles/swan/art.ts registers the core
 * (SWAN_SETS; P2 without the P1-only props): this test never imports the old art module.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { bakedPalette, bakedSetIds, decodeBakedIndices, defineBakedSet, type BakedFrame, type BakedSet } from '../../src/engine/baked';
import { buttonMask, VirtualPad, type Button } from '../../src/engine/input';
import { frameCount, framePoint, getFrame, getFrames, hasHiSprite, hasSprite, type Frame } from '../../src/engine/sprites';
import { Terrain, terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { SET as CORE } from '../../src/game/content/art40/swan.gen';
import * as GEN from '../../src/game/content/art40/swan-water.gen';
import { SET as GEN_NECK } from '../../src/game/content/art40/swan-neck.gen';
import '../../src/game/content/characters/index';
import { HULL_DY, HURT, PERCH_TOP, SEAT_ZONE, SWAN } from '../../src/game/content/vehicles/swan/constants';
import '../../src/game/content/vehicles/swan/index';
import type { Swan } from '../../src/game/content/vehicles/swan/index';
import { frameAt, loopAt } from '../../src/game/content/vehicles/swan/swan';
import '../../src/game/content/weapons/index';
import { attachGame, HudState } from '../../src/game/context';
import { Player } from '../../src/game/player/player';
import { gameEntityFactory } from '../../src/game/registry';
import { GameSession } from '../../src/game/session';
import { applyTuning } from '../../src/game/tuning';

applyTuning();
const warn = console.warn.bind(console);
vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.startsWith('[sprites] unknown sprite') || first.startsWith('[registry] unknown') || first.startsWith('[art]')) return;
  warn(...args);
});

const SET: BakedSet = GEN.SET;
const P1 = 'vehicle/swan';
const P2 = 'vehicle/swan-mute';
const P1_ONLY = new Set(['egg', 'scuffs', 'beak-flash']);

interface ContractEntry {
  frames: number;
  framePoints: string[][];
  loop?: boolean;
  totalTicks?: number;
}
const CONTRACT: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const starts = (d: readonly number[]): number[] => d.map((_, i) => sum(d.slice(0, i)));

/** Frame counts, durations and loop flags (the plan's class table; the logic times of the contract). */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean]>> = {
  swim: [12, Array(12).fill(2), true],
  'water-duck': [4, [12, 12, 12, 12], true],
  'paddle-up': [4, [2, 2, 2, 2], false],
  settle: [2, [2, 2], false],
  'honk-swim': [10, Array(10).fill(2), false],
  flap: [4, [2, 1, 1, 2], false],
  glide: [4, [4, 4, 4, 4], true],
  'glide-tired': [4, [2, 2, 2, 2], true],
  fold: [1, [2], false],
  'honk-air': [10, Array(10).fill(2), false],
  rise: [6, [3, 4, 1, 2, 1, 1], false],
  'sit-down': [6, [5, 4, 4, 3, 2, 2], false],
  dive: [12, Array(12).fill(3), true],
  migrate: [12, Array(12).fill(3), true],
  'migrate-soot': [12, Array(12).fill(3), true],
};
/** The ridden strips: a rider between the body and a -front overlay (swan.ts RIDER_STRIPS). */
const RIDDEN = ['swim', 'water-duck', 'paddle-up', 'settle', 'honk-swim', 'flap', 'glide', 'glide-tired', 'fold', 'honk-air', 'rise'];
/** The pictures with the neck, the head and the gun inside (swan.ts SELF_CONTAINED). */
const CONTAINED = ['rise', 'sit-down', 'dive', 'migrate', 'migrate-soot'];
/** The water strips: the float line at the anchor, the surface 16 px above it (SWAN.swimDepth). */
const WATER = ['swim', 'water-duck', 'paddle-up', 'settle', 'honk-swim'];
/** Smear frames: only where the motion is faster than 3 px a tick (plan: at most 2 a strip). */
const SMEARS: Readonly<Record<string, readonly number[]>> = {
  flap: [1, 2], 'honk-air': [5], 'honk-swim': [5], rise: [2],
};
/** The logic time of every timed strip (the code reads the strip's own durations or its frames). */
const LOGIC: Readonly<Record<string, number>> = {
  'paddle-up': SWAN.waterSquatTicks, settle: 4, flap: 6, fold: 2, 'honk-swim': SWAN.honk.stripTicks,
  'honk-air': SWAN.honk.stripTicks, rise: SWAN.riseTicks, 'sit-down': SWAN.sitTicks,
};

function register(set: BakedSet): string[] {
  const ids = bakedSetIds(set).filter((id) => !(id.startsWith(`${P2}/`) && P1_ONLY.has(id.slice(P2.length + 1))));
  const free = ids.filter((id) => !hasSprite(id));
  return free.length ? defineBakedSet(set, { only: free }) : [];
}

const pt = (f: Pick<Frame, 'pts'> | BakedFrame, n: string): readonly [number, number] => {
  const p = (f.pts as Readonly<Record<string, readonly [number, number]>> | undefined)?.[n];
  expect(p, n).toBeDefined();
  return p as readonly [number, number];
};

beforeAll(() => {
  register(CORE);
  register(SET);
});

describe('the Swan set at 40 px, stage 2 (water and air)', () => {
  it('has exactly the stage 2 strips; every id is a contract id in P1 and P2 and registered', () => {
    const names = Object.keys(SET.strips).sort();
    expect(names).toEqual([...Object.keys(STRIPS), ...RIDDEN.map((n) => `${n}-front`)].sort());
    expect(SET.prefix).toBe(P1);
    expect(Object.keys(SET.variants ?? {})).toEqual([P2]);
    for (const n of names) {
      for (const pre of [P1, P2]) {
        expect(CONTRACT[`${pre}/${n}`], `${pre}/${n} is a contract id`).toBeDefined();
        expect(hasSprite(`${pre}/${n}`), `${pre}/${n}`).toBe(true);
      }
      // no strip of the core set: one prefix, disjoint strips
      expect(CORE.strips[n], `${n} not in the core`).toBeUndefined();
    }
  });

  it('frame counts, durations, loop flags and the logic times of the timed strips', () => {
    for (const [n, [frames, durations, loop]] of Object.entries(STRIPS)) {
      const st = SET.strips[n];
      expect(st.frames.length, n).toBe(frames);
      expect([...st.durations], n).toEqual([...durations]);
      expect(st.loop, n).toBe(loop);
      expect(st.loop, `${n}: the contract's loop flag`).toBe(CONTRACT[`${P1}/${n}`].loop);
      if (RIDDEN.includes(n)) {
        const fr = SET.strips[`${n}-front`];
        expect(fr.frames.length, `${n}-front`).toBe(frames);
        expect([...fr.durations], `${n}-front`).toEqual([...durations]);
        expect(fr.loop, `${n}-front`).toBe(loop);
      }
    }
    for (const [n, ticks] of Object.entries(LOGIC)) {
      expect(sum(SET.strips[n].durations), `${n}: logic ticks`).toBe(ticks);
      expect(CONTRACT[`${P1}/${n}`].totalTicks, `${n}: the contract's total`).toBe(ticks);
    }
    // the swim keeps its old moving cycle (4 frames x 6 ticks)
    expect(sum(SET.strips.swim.durations)).toBe(CONTRACT[`${P1}/swim`].totalTicks);
    expect(sum(SET.strips.swim.durations)).toBe(GEN.SWIM_CYCLE);
  });

  it('every frame decodes; the colours stay within the budget of 40 in P1 and P2', () => {
    const fx = new Set(SET.fx ?? []);
    for (const pal of [SET.pal, ...Object.values(SET.variants ?? {})]) {
      expect(pal.length).toBe(SET.pal.length);
      const used = new Set<string>();
      for (const [n, st] of Object.entries(SET.strips)) {
        st.frames.forEach((f, i) => {
          const idx = decodeBakedIndices(f);
          expect(idx.length, `${n} ${i}`).toBe(f.w * f.h);
          for (const v of idx) {
            expect(v, `${n} ${i}`).toBeLessThan(pal.length);
            if (v > 0 && !fx.has(v)) used.add(pal[v].toLowerCase());
          }
        });
      }
      expect(used.size).toBeLessThanOrEqual(40);
      expect(SET.budget).toBe(40);
    }
    // P2 is the same pixels: only colours differ
    expect(bakedPalette(SET.pal).length).toBe(bakedPalette(SET.variants![P2]).length);
  });

  it('keeps the anchor and every contract point name on every frame; the bubble on the seated sit-down', () => {
    for (const [n, st] of Object.entries(SET.strips)) {
      const c = CONTRACT[`${P1}/${n}`];
      st.frames.forEach((f, i) => {
        const want = c.framePoints[i] ?? c.framePoints[c.framePoints.length - 1];
        // the old -front strips listed the body's points: they are on the overlay frames too
        for (const p of want) {
          if (p === 'bubble') continue;
          expect(f.pts?.[p], `${n} ${i} ${p}`).toBeDefined();
        }
      });
    }
    const sit = SET.strips['sit-down'].frames;
    sit.forEach((f, i) => expect(f.pts?.bubble !== undefined, `sit-down ${i} bubble`).toBe(i === sit.length - 1));
    for (const n of CONTAINED) SET.strips[n].frames.forEach((f, i) => expect(f.pts?.head, `${n} ${i} head`).toBeDefined());
  });

  it('smears only where the plan allows them, at most 2 a strip', () => {
    for (const [n, st] of Object.entries(SET.strips)) {
      const sm = st.frames.map((f, i) => (f.smear ? i : -1)).filter((i) => i >= 0);
      expect(sm, n).toEqual([...(SMEARS[n] ?? SMEARS[n.replace(/-front$/, '')] ?? [])]);
      expect(sm.length).toBeLessThanOrEqual(2);
    }
  });

  it('1× pixels at every tier: getFrames(id, 2) and (id, 4) are the 1× frames; no dense art', () => {
    for (const n of Object.keys(SET.strips)) {
      for (const pre of [P1, P2]) {
        const id = `${pre}/${n}`;
        const one = getFrames(id, 1);
        expect(one.length, id).toBe(SET.strips[n].frames.length);
        expect(getFrames(id, 2), id).toBe(one);
        expect(getFrames(id, 4), id).toBe(one);
        expect(hasHiSprite(id, 2), id).toBe(false);
        expect(hasHiSprite(id, 4), id).toBe(false);
      }
    }
  });

  it('the water line (plan rule 10): no lit plumage on or under the surface; the hull sits in the water', () => {
    const lit = new Set(['#fffdf4', '#efece2']);        // W, w: the white plumage in the light
    for (const n of WATER) {
      const st = SET.strips[n];
      st.frames.forEach((f, i) => {
        const idx = decodeBakedIndices(f);
        let under = 0;
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const v = idx[y * f.w + x];
            if (!v || y - f.oy < -SWAN.swimDepth) continue;
            expect(lit.has(SET.pal[v].toLowerCase()), `${n} ${i}: lit plumage at (${x - f.ox}, ${y - f.oy})`).toBe(false);
            under++;
          }
        }
        expect(under, `${n} ${i}: something under the surface`).toBeGreaterThan(20);
      });
    }
    // swimming, the deck is 10 px or more under the standing deck: the game draws the swim neck
    for (const n of ['swim', 'water-duck', 'honk-swim']) {
      for (const f of SET.strips[n].frames) expect(pt(f, 'perch')[1] - PERCH_TOP.stand, n).toBeGreaterThanOrEqual(10);
    }
    // the neck socket of the swim body: the rest socket 18-19 px lower (the swim-neck strips hang on it);
    // the deck and the seat at the old swim values (PERCH_TOP.swim, SEAT_POINT.swim: D7)
    for (const f of SET.strips.swim.frames) {
      expect(pt(f, 'neck')[0]).toBe(16);
      expect(pt(f, 'neck')[1]).toBeGreaterThanOrEqual(-43 + 18);
      expect(pt(f, 'neck')[1]).toBeLessThanOrEqual(-43 + 19);
      expect(Math.abs(pt(f, 'perch')[1] - PERCH_TOP.swim), 'swim deck').toBeLessThanOrEqual(1);
      expect(Math.abs(pt(f, 'seat')[1] - -30), 'swim seat').toBeLessThanOrEqual(1);
    }
    // ducked: the socket 5 px over the surface, where the duck-neck strip draws its water line
    for (const f of SET.strips['water-duck'].frames) expect(Math.abs(pt(f, 'neck')[1] - (-SWAN.swimDepth - 5)), 'duck socket').toBeLessThanOrEqual(1);
  });

  it('the swim paddles two feet: stroke B (the far web, frames 6-11) is not stroke A (the near web) drawn again', () => {
    const fr = SET.strips.swim.frames;
    const half = GEN.SWIM_STROKE_B - GEN.SWIM_STROKE_A;
    expect(fr.length).toBe(half * 2);
    /** The pixels under the surface, keyed by their anchor-relative place. */
    const under = (f: BakedFrame): Map<string, number> => {
      const idx = decodeBakedIndices(f);
      const m = new Map<string, number>();
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const v = idx[y * f.w + x];
          if (v && y - f.oy > -SWAN.swimDepth) m.set(`${x - f.ox},${y - f.oy}`, v);
        }
      }
      return m;
    };
    for (let i = 0; i < half; i++) {
      const a = under(fr[i]);
      const b = under(fr[i + half]);
      let diff = 0;
      for (const k of new Set([...a.keys(), ...b.keys()])) if (a.get(k) !== b.get(k)) diff++;
      // the two webs under the hull: a different sweep, so the cycle reads as two strokes
      expect(diff, `swim ${i} vs ${i + half}: the strokes differ under the water`).toBeGreaterThanOrEqual(8);
    }
  });

  it('the -front overlays are pieces of their body frames (same pixels, same place)', () => {
    for (const n of RIDDEN) {
      const body = SET.strips[n].frames;
      SET.strips[`${n}-front`].frames.forEach((f, i) => {
        const b = body[i];
        const fi = decodeBakedIndices(f);
        const bi = decodeBakedIndices(b);
        let n0 = 0;
        let same = 0;
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const v = fi[y * f.w + x];
            if (!v) continue;
            n0++;
            const bx = x - f.ox + b.ox;
            const by = y - f.oy + b.oy;
            if (bx >= 0 && by >= 0 && bx < b.w && by < b.h && bi[by * b.w + bx] === v) same++;
          }
        }
        if (n0 > 0) expect(same / n0, `${n}-front ${i}`).toBeGreaterThanOrEqual(0.9);
        expect(f.pts?.seat, `${n}-front ${i}`).toEqual(b.pts?.seat);
      });
    }
  });
});

describe('the Swan code reads the set (plan rule 4)', () => {
  it('the events exist, lie inside their strips and keep the old timing', () => {
    expect(SET.events).toEqual({
      SWIM_CYCLE: GEN.SWIM_CYCLE, SWIM_CYCLE_STILL: GEN.SWIM_CYCLE_STILL, SWIM_STROKE_A: GEN.SWIM_STROKE_A,
      SWIM_STROKE_B: GEN.SWIM_STROKE_B, DIVE_PX: GEN.DIVE_PX, GLIDE_DIP_FROM: GEN.GLIDE_DIP_FROM,
    });
    // the swim: one cycle per 24 ticks moving, 64 still (the old 4 frames x 6 / x 16)
    expect(GEN.SWIM_CYCLE).toBe(24);
    expect(GEN.SWIM_CYCLE_STILL).toBe(64);
    const swim = SET.strips.swim.frames.length;
    expect(GEN.SWIM_STROKE_A).toBe(0);
    expect(GEN.SWIM_STROKE_B).toBe(swim / 2);
    // the dive's odometer: one frame per DIVE_PX px (the contract's 8 px a frame)
    expect(GEN.DIVE_PX).toBe(8);
    expect(GEN.GLIDE_DIP_FROM).toBeGreaterThan(0);
    expect(GEN.GLIDE_DIP_FROM).toBeLessThan(SET.strips.glide.frames.length);
    // the honks: the blast frame starts at the wind-up's end (the core's HONK_BLAST, tick 10)
    const CORE_BLAST = (CORE.events as Record<string, number>).HONK_BLAST;
    for (const n of ['honk-swim', 'honk-air']) expect(starts(SET.strips[n].durations)[CORE_BLAST], n).toBe(SWAN.honk.windup);
  });

  it('the dive does not slide: the planted web moves back DIVE_PX a frame, on the line', () => {
    const fs = getFrames(`${P1}/dive`);
    let plants = 0;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i].pts?.plant;
      const b = fs[(i + 1) % fs.length].pts?.plant;
      if (!a) continue;
      expect(a[1], `dive ${i} on the line`).toBe(-1);
      if (b && b[0] < a[0]) {
        expect(Math.abs(a[0] - b[0] - GEN.DIVE_PX), `dive ${i}`).toBeLessThanOrEqual(1);
        plants++;
      }
    }
    expect(plants).toBeGreaterThanOrEqual(8);
  });

  it('frame picks: frameAt / loopAt, the swim clock, the dive odometer and the roles give an existing frame at every tick', () => {
    const ok = (id: string, f: number, why: string): void => {
      expect(Number.isInteger(f), `${id} ${why}`).toBe(true);
      expect(f, `${id} ${why}`).toBeGreaterThanOrEqual(0);
      expect(f, `${id} ${why}`).toBeLessThan(frameCount(id));
    };
    for (const n of Object.keys(SET.strips)) {
      const id = `${P1}/${n}`;
      const d = SET.strips[n].durations;
      for (let t = -3; t < sum(d) * 2 + 5; t++) {
        ok(id, loopAt(d, t), `loopAt ${t}`);
        ok(id, frameAt(d, Math.max(0, t)), `frameAt ${t}`);
      }
    }
    // the swim clock (cycles): every frame is shown, moving and still; the strokes start on their frames
    const n = SET.strips.swim.frames.length;
    for (const cycle of [GEN.SWIM_CYCLE, GEN.SWIM_CYCLE_STILL]) {
      const seen = new Set<number>();
      let clock = 0;
      for (let t = 0; t < cycle * 2; t++) {
        clock += 1 / cycle;
        const f = Math.floor(clock * n + 1e-9) % n;
        ok(`${P1}/swim`, f, `clock ${t}`);
        seen.add(f);
      }
      expect(seen.size).toBe(n);
    }
    // the dive odometer
    for (let odo = 0; odo < 400; odo += 0.85) ok(`${P1}/dive`, Math.floor(odo / GEN.DIVE_PX) % SET.strips.dive.frames.length, `odo ${odo}`);
    // the paddle-up (8 - paddleT) >> 1 and the settle roles 0 / 1
    for (let p = SWAN.waterSquatTicks; p > 0; p--) {
      expect((SWAN.waterSquatTicks - p) >> 1).toBe(frameAt(SET.strips['paddle-up'].durations, SWAN.waterSquatTicks - p));
    }
    ok(`${P1}/settle`, 0, 'role 0');
    ok(`${P1}/settle`, 1, 'role 1');
  });

  it('the gameplay numbers stay (plan D7): hurtboxes, seat zones, the perch deck, the water and air numbers', () => {
    expect(HURT.swim).toEqual([[-22, -30, 40, 16], [-10, -48, 12, 18]]);
    expect(HURT.duck).toEqual([[-22, -24, 40, 12], [-10, -37, 12, 15]]);
    expect(SEAT_ZONE.water).toEqual([-10, -44, 20, 16]);
    expect(PERCH_TOP).toEqual({ stand: -48, crouch: -20, swim: -30, duck: -22 });
    expect([SWAN.swimDepth, SWAN.swimMax, SWAN.swimAccel, SWAN.swimDrag, SWAN.waterSquatTicks]).toEqual([16, 2.0, 0.08, 0.08, 8]);
    expect([SWAN.glideFlapVy, SWAN.glideGravity, SWAN.glideMaxFall, SWAN.glideSpeed, SWAN.glideTicks, SWAN.glideTireTicks]).toEqual([-0.4, 0.06, 1.0, 2.2, 60, 12]);
    expect([SWAN.riseTicks, SWAN.sitTicks, SWAN.dive.speed, SWAN.dive.migrateVx, SWAN.dive.migrateVy]).toEqual([12, 20, 3.4, 1.0, -1.5]);
    expect([SWAN.honk.windup, SWAN.honk.stripTicks, SWAN.honk.cost, SWAN.honk.cooldown]).toEqual([10, 20, 3, 240]);
    // the swim strips keep a hull offset the swim neck reads (HULL_DY >= 10: swan.ts pickNeck)
    for (const k of ['swim', 'water-duck', 'honk-swim']) for (const v of HULL_DY[k]) expect(v, k).toBeGreaterThanOrEqual(10);
  });
});

// ------------------------------------------------------------------------------------ behaviour

const FLOOR = 176;
const WATER_X = 500;
const WATER_W = 900;
const SURF = FLOOR - 4;

class Rig {
  readonly world: World;
  readonly pad = new VirtualPad();
  mask = 0;
  readonly p: Player;
  readonly swan: Swan;
  readonly seen = new Map<string, Set<number>>();
  readonly necks = new Set<string>();

  constructor(x: number, mute = false, extra: Record<string, unknown> = {}) {
    const t = terrain(3000, 216);
    // land, the canal (a gap with a water rect: she floats 16 px under its surface), land again
    t.ground().at(0, FLOOR).flat(WATER_X).gap(WATER_W).flat(3000 - WATER_X - WATER_W);
    t.hazard('water', WATER_X, SURF, WATER_W, 40);
    this.world = new World({ terrain: new Terrain(t.build()), seed: 7, factory: gameEntityFactory });
    attachGame(this.world, new GameSession({ characters: ['recruit', 'recruit'], seed: 7 }), new HudState());
    const inWater = x >= WATER_X && x < WATER_X + WATER_W;
    const y = inWater ? SURF + SWAN.swimDepth : FLOOR;
    this.p = new Player(this.world, x - 60, FLOOR, { pad: this.pad, index: 0 });
    this.world.add(this.p);
    this.p.placeAt(x - 60, inWater ? SURF - 40 : FLOOR, 0);
    this.swan = this.world.spawn('swan', x, y, { ...(mute ? { variant: 'mute' } : {}), ...extra }) as Swan;
    this.world.flush();
    this.world.camera.follow(this.world.players);
    this.run(1);
  }

  run(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.pad.update(this.mask);
      this.world.update();
      this.check();
    }
    return this;
  }

  hold(...b: Button[]): this {
    this.mask = b.length ? buttonMask(...b) : 0;
    return this;
  }

  tap(...b: Button[]): this {
    const keep = this.mask;
    this.mask = keep | buttonMask(...b);
    this.run(1);
    this.mask = keep;
    return this;
  }

  /** Every tick: the shown body frame exists, carries the points the code reads, has its overlay. */
  check(): void {
    const s = this.swan as unknown as { anim: { id: string; index: number }; bodyName: string; bodyFrame: number; facing: number; removed: boolean };
    const id = s.anim.id;
    if (!id || s.removed) return;
    expect(hasSprite(id), `${id} registered`).toBe(true);
    const n = frameCount(id);
    expect(Number.isInteger(s.anim.index), `${id} index`).toBe(true);
    expect(s.anim.index, id).toBeGreaterThanOrEqual(0);
    expect(s.anim.index, id).toBeLessThan(n);
    expect(s.anim.index, `${id}: drawn frame = picked frame`).toBe(s.bodyFrame);
    const f = getFrame(id, s.anim.index);
    for (const p of ['seat', 'neck', 'hull', 'smoke']) expect(framePoint(f, p, s.facing < 0, false, [0, 0]), `${id} #${s.anim.index} ${p}`).toBeDefined();
    if (hasSprite(`${id}-front`)) expect(frameCount(`${id}-front`), `${id}-front`).toBe(n);
    let set = this.seen.get(s.bodyName);
    if (!set) this.seen.set(s.bodyName, (set = new Set()));
    set.add(s.anim.index);
    // the neck strip drawn on her (the honk on the water: swim-neck-honk), an existing frame
    const nk = this.swan as unknown as { neckName: string; neckFrame: number };
    if (nk.neckName) {
      const nid = `${P1}/${nk.neckName}`;
      expect(GEN_NECK.strips[nk.neckName], nid).toBeDefined();
      expect(nk.neckFrame, nid).toBeLessThan(GEN_NECK.strips[nk.neckName].frames.length);
      this.necks.add(nk.neckName);
    }
  }

  /** Let her take a HONK now (its cooldown is gameplay, not what this test is about). */
  honk(): this {
    (this.swan as unknown as { honkCool: number }).honkCool = 0;
    return this.tap('fire', 'bomb');
  }
}

const shown = (r: Rig, n: string): Set<number> => r.seen.get(n) ?? new Set();

describe('the Swan plays every stage 2 strip headless (water, air, rise, sit-down, dive, migrate)', () => {
  for (const mute of [false, true]) {
    it(`${mute ? 'P2 black swan' : 'P1'}: on the water and in the air every pick is an existing frame`, () => {
      const r = new Rig(800, mute);
      const s = r.swan;
      r.run(20);
      s.mount(r.p);
      expect(s.swimming).toBe(true);
      r.run(80);                                     // still: the slow swim clock
      r.hold('right').run(60);                       // swim
      r.hold('down').run(60);                        // water-duck
      r.hold().run(20);
      r.honk().run(30);                              // honk-swim
      r.tap('jump').hold('jump').run(14);            // paddle-up, the launch, the jump
      r.run(90);                                     // the glide: flap, glide, glide-tired, fold
      r.hold().run(80);                              // back into the water: settle
      r.run(10);
      r.tap('jump').run(30);                         // up again ...
      r.honk().run(30);                              // ... honk-air
      r.run(120);
      // The game picks every frame of the new strips (art.ts SWAN_SETS: the swim clock, the timed flap).
      for (const [n, k] of Object.entries({ swim: 12, 'water-duck': 4, 'paddle-up': 4, 'honk-swim': 10, flap: 4, glide: 4, 'glide-tired': 4, fold: 1, 'honk-air': 10, settle: 1 })) {
        expect(shown(r, n).size, `${n}: frames shown ${[...shown(r, n)].join(',')}`).toBeGreaterThanOrEqual(k);
      }
      // the honk on the water hangs the swim honk neck (its barrel on the drum strapped high afloat)
      expect(r.necks.has('swim-neck-honk'), [...r.necks].join(',')).toBe(true);
      expect(r.necks.has('swim-neck')).toBe(true);
    });

    it(`${mute ? 'P2 black swan' : 'P1'}: on land she rises under a rider, charges, sits down; lost, she migrates`, () => {
      const r = new Rig(200, mute);
      const s = r.swan;
      r.run(30);
      s.mount(r.p);
      r.run(SWAN.riseTicks + 20);                    // rise
      r.hold().tap('fire').tap('jump').run(6);       // SWAN DIVE: hiss, dive, bash ...
      r.run(420);                                    // ... tumble, dazed, right, shake, sit-down
      expect(shown(r, 'rise').size).toBe(SET.strips.rise.frames.length);
      expect(shown(r, 'sit-down').size).toBe(SET.strips['sit-down'].frames.length);
      expect(shown(r, 'dive').size).toBeGreaterThanOrEqual(6);
      for (const soot of [false, true]) {
        const m = new Rig(200, mute);
        (m.swan as unknown as { startMigrate(soot: boolean): void }).startMigrate(soot);
        m.run(SET.strips.migrate.durations.length * 3 * 2);
        expect(shown(m, soot ? 'migrate-soot' : 'migrate').size).toBe(SET.strips.migrate.frames.length);
      }
    });
  }
});
