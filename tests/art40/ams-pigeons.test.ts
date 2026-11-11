/**
 * The pigeon flock at 40 px (docs/design/ams40.md wave 4): the baked set `ams-pigeons`
 * (src/game/content/art40/ams-pigeons.gen.ts, drawn by tools/art40/chars/ams-pigeons/) keeps the strip
 * contract of docs/design/ams40/contract.md "pigeon flock": the ids (the bare 5-role id
 * npc/ams/ams-pigeons composed from the baked frames by the PIGEON_* events, the take-off strip), the
 * logic times the game reads (the 16-tick peck act, the 6-tick take-off, the 8-tick wingbeat), the
 * walk's planted foot at the flock's 0.125 px/tick, the 28-colour budget, 1× pixels at every tier;
 * AmsPigeons' own update loop picks an existing frame at every tick of every state; the gameplay
 * numbers stay (D7: the box, the scare range, the step, the flight).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { Renderer } from '../../src/engine/render';
import { framesDensityAt, getFrames, hasHiSprite, hasSprite, listSprites } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/ams-pigeons.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/missions/ams/index';
import { AmsPigeons, frameInRun, PIGEON_PECK_TICKS, PIGEON_TAKEOFF_TICKS, PIGEONS } from '../../src/game/content/missions/ams/ambient';
import { getEntityMeta } from '../../src/game/registry';
import { plantDrifts } from '../../tools/art40/check/core';
import type { CheckStrip } from '../../tools/art40/check/types';
import { TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PRE = 'npc/ams/ams-pigeons';

interface ContractEntry {
  character: string;
  frames: number;
  loop: boolean;
  totalTicks: number;
  events?: { name: string }[];
  class?: string;
}
const CONTRACT_IDS: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const MINE = Object.keys(CONTRACT_IDS).filter((id) => CONTRACT_IDS[id].character === 'pigeons').sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Frame counts, durations, loop flags and classes (the plan's class table; the logic times). */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, cls: string]>> = {
  idle: [4, [16, 10, 6, 16], true, 'idle-breathing'],
  peck: [8, [2, 1, 1, 3, 2, 2, 2, 3], false, 'idle-fidget'],
  walk: [12, [3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2], true, 'locomotion'],
  takeoff: [6, [1, 1, 1, 1, 1, 1], false, 'jump'],
  fly: [8, [1, 1, 1, 1, 1, 1, 1, 1], true, 'ride'],
};
/** The old strips: the 5 roles at 8 ticks, the take-off 2 x 3 ticks, the flap alternation 4 + 4. */
const OLD = { roles: 5, rolesTicks: 8, takeoffTicks: 6, flapTicks: 8, stepCycle: 16 };

function recorder(): { r: Renderer; calls: [string, number][] } {
  const calls: [string, number][] = [];
  const r = { sprite: (id: string, i: number) => void calls.push([id, i]) } as unknown as Renderer;
  return { r, calls };
}

/** The flock's private state (read only, for the gameplay pins). */
type Flock = AmsPigeons;
interface FlockState { px: Float32Array; py: Float32Array; act: Uint8Array; timer: Uint16Array; bvx: Float32Array; bvy: Float32Array }
const st = (f: AmsPigeons): FlockState => f as unknown as FlockState;

describe('the pigeon set at 40 px', () => {
  it('registers exactly the contract ids: the take-off and the 5-role bare id (composed), plus the new strips', () => {
    expect(MINE).toEqual([PRE, `${PRE}/takeoff`]);
    expect(SET.prefix).toBe(PRE);
    expect(SET.variants ?? {}).toEqual({});
    const baked = bakedSetIds(SET).sort();
    expect(baked).toEqual(['fly', 'idle', 'peck', 'takeoff', 'walk'].map((n) => `${PRE}/${n}`));
    for (const id of MINE) expect(hasSprite(id), id).toBe(true);
    expect(listSprites(`${PRE}/`).sort()).toEqual(baked);
    // the bare id: the old 5 roles at 8 ticks, the very baked frames the events name
    const roles = getFrames(PRE, 1);
    expect(roles.length).toBe(OLD.roles);
    const same = (a: (typeof roles)[number], b: (typeof roles)[number]): boolean =>
      a.ox === b.ox && a.oy === b.oy && a.buf.w === b.buf.w && a.buf.data.every((c, k) => c === b.buf.data[k]);
    expect(same(roles[0], getFrames(`${PRE}/idle`, 1)[GEN.PIGEON_STAND])).toBe(true);
    expect(same(roles[1], getFrames(`${PRE}/peck`, 1)[GEN.PIGEON_PECK])).toBe(true);
    expect(same(roles[2], getFrames(`${PRE}/walk`, 1)[GEN.PIGEON_STEP])).toBe(true);
    expect(same(roles[3], getFrames(`${PRE}/fly`, 1)[GEN.PIGEON_FLAP_A])).toBe(true);
    expect(same(roles[4], getFrames(`${PRE}/fly`, 1)[GEN.PIGEON_FLAP_B])).toBe(true);
    expect(same(roles[3], roles[4])).toBe(false);
  });

  it('frame counts, durations, loop flags, classes and the logic times', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [n, [frames, durations, loop, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[n];
      expect(st.frames.length, n).toBe(frames);
      expect([...st.durations], n).toEqual([...durations]);
      expect(st.loop, n).toBe(loop);
      expect(Boolean(st.defer), n).toBe(false);
      expect(st.cls, n).toBe(cls);
    }
    const take = CONTRACT_IDS[`${PRE}/takeoff`];
    expect(SET.strips.takeoff.loop).toBe(take.loop);
    expect(sum(SET.strips.takeoff.durations)).toBe(take.totalTicks);
    expect(sum(SET.strips.takeoff.durations)).toBe(PIGEON_TAKEOFF_TICKS);
    expect(PIGEON_TAKEOFF_TICKS).toBe(OLD.takeoffTicks);
    expect(sum(SET.strips.peck.durations)).toBe(PIGEON_PECK_TICKS);
    expect(PIGEON_PECK_TICKS).toBe(16);
    expect(sum(SET.strips.fly.durations)).toBe(OLD.flapTicks);
    // the walk: one step per 16 ticks (the old 8-tick stand / step alternation)
    expect(sum(SET.strips.walk.durations)).toBe(2 * OLD.stepCycle);
    // the wingbeat has fewer frames than its class: the logged reason is baked
    expect(SET.strips.fly.why).toMatch(/8-tick/);
  });

  it('every frame decodes within the 28-colour budget; ground frames stand on the anchor; points and smears only where allowed', () => {
    expect(SET.budget).toBe(28);
    expect(SET.face).toBe(1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    const used = new Set<number>();
    for (const [n, st] of Object.entries(SET.strips)) {
      let smears = 0;
      st.frames.forEach((f, i) => {
        const at = `${n}[${i}]`;
        const idx = decodeBakedIndices(f);
        expect(idx.length, at).toBe(f.w * f.h);
        for (const v of idx) {
          expect(v, at).toBeLessThan(SET.pal.length);
          if (v) used.add(v);
        }
        if (n === 'idle' || n === 'peck' || n === 'walk') expect(f.h, `${at}: the feet's outline is the last row above the floor`).toBe(f.oy);
        // the code reads no point; the walk carries the foot gate's 'plant'
        expect(Object.keys(f.pts ?? {}), at).toEqual(n === 'walk' ? ['plant'] : []);
        if (f.smear) smears++;
      });
      expect(smears, n).toBeLessThanOrEqual(n === 'takeoff' || n === 'fly' ? 1 : 0);
    }
    const colours = new Set([...used].map((v) => SET.pal[v]));
    expect(colours.size).toBeLessThanOrEqual(28);
    expect(SET.pal.length - 1).toBeLessThanOrEqual(28);
  });

  it('no two consecutive frames are the same picture (loops: the last and the first too)', () => {
    for (const [n, st] of Object.entries(SET.strips)) {
      const steps = st.loop ? st.frames.length : st.frames.length - 1;
      for (let i = 0; i < steps; i++) {
        const a = st.frames[i];
        const b = st.frames[(i + 1) % st.frames.length];
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${n} ${i}`).toBe(false);
      }
    }
  });

  it('the walk plants its feet: at most 1 px drift per plant at 0.125 px/tick, the way the bird faces', () => {
    const walk = SET.strips.walk as unknown as CheckStrip;
    for (const r of plantDrifts(walk, 0.125, { dir: 1 })) expect(r.drift, `plant from ${r.from}`).toBeLessThanOrEqual(1);
    expect(SET.strips.walk.frames.every((f) => f.pts?.plant)).toBe(true);
  });

  it('a bird in flight raises its wing above the standing bird (wings-up frame reaches higher)', () => {
    const top = (f: { oy: number }): number => -f.oy;
    expect(top(SET.strips.fly.frames[GEN.PIGEON_FLAP_A])).toBeLessThan(top(SET.strips.idle.frames[GEN.PIGEON_STAND]));
  });

  it('draws the 1× frames at every art tier (no dense art left)', () => {
    for (const id of [PRE, ...bakedSetIds(SET)]) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id} ${d}×`).toBe(false);
        expect(framesDensityAt(id, d), `${id} ${d}×`).toBe(1);
        const hi = getFrames(id, d);
        expect(hi.length, id).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) expect(hi[i].buf, `${id}[${i}] ${d}×`).toBe(lo[i].buf);
      }
    }
  });
});

describe('the pigeon flock: the frames the code reads', () => {
  it('every PIGEON_* constant exists in the set and lies inside its strip', () => {
    for (const ev of CONTRACT_IDS[PRE].events ?? []) expect(SET.events?.[ev.name], ev.name).toBeDefined();
    const inside: Record<string, string> = { PIGEON_STAND: 'idle', PIGEON_PECK: 'peck', PIGEON_STEP: 'walk', PIGEON_FLAP_A: 'fly', PIGEON_FLAP_B: 'fly' };
    expect(Object.keys(SET.events ?? {}).sort()).toEqual(Object.keys(inside).sort());
    for (const [k, strip] of Object.entries(inside)) {
      const v = (SET.events ?? {})[k];
      expect(Number.isInteger(v), k).toBe(true);
      expect(v, k).toBeGreaterThanOrEqual(0);
      expect(v, k).toBeLessThan(SET.strips[strip].frames.length);
    }
    expect(GEN.PIGEON_FLAP_A).not.toBe(GEN.PIGEON_FLAP_B);
  });

  it('pick returns an existing frame at every tick of every state (ground acts, take-off, flight)', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const f = tw.spawn('ams-pigeons', 300, { count: 8 }) as Flock;
    const seen: Record<string, Set<number>> = {};
    const check = (): void => {
      for (let i = 0; i < f.count; i++) {
        const [id, k] = f.pick(i);
        const n = getFrames(id, 1).length;
        expect(Number.isInteger(k), `${id} ${k}`).toBe(true);
        expect(k, id).toBeGreaterThanOrEqual(0);
        expect(k, id).toBeLessThan(n);
        (seen[id] ??= new Set()).add(k);
      }
    };
    for (let t = 0; t < 900; t++) {
      check();
      tw.run(1);
    }
    // the calm flock idles, pecks (the whole peck) and walks (the whole cycle)
    expect(seen[`${PRE}/idle`]?.size).toBe(4);
    expect(seen[`${PRE}/peck`]?.size).toBe(8);
    expect(seen[`${PRE}/walk`]?.size).toBe(12);
    f.scare(300);
    for (let t = 0; t < 40 && f.alive; t++) {
      check();
      tw.run(1);
    }
    expect(seen[`${PRE}/takeoff`]?.size).toBe(6);
    expect(seen[`${PRE}/fly`]?.size).toBe(8);
  });

  it('the peck plays once over the act: frame 0 when the act starts, the last frame at its end', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const f = tw.spawn('ams-pigeons', 300, { count: 1 }) as Flock;
    st(f).act[0] = 1;
    st(f).timer[0] = PIGEON_PECK_TICKS;
    const frames: number[] = [];
    for (let k = 0; k <= PIGEON_PECK_TICKS; k++) {
      frames.push(f.pick(0)[1]);
      st(f).timer[0] = Math.max(0, st(f).timer[0] - 1);
    }
    expect(frames[0]).toBe(0);
    expect(frames.at(-1)).toBe(SET.strips.peck.frames.length - 1);
    expect(frames).toEqual(Array.from({ length: PIGEON_PECK_TICKS + 1 }, (_, k) => frameInRun(SET.strips.peck.durations, 0, 8, k, false)));
    // the beak meets the floor on the contact frame (the roles' PIGEON_PECK)
    expect(frames).toContain(GEN.PIGEON_PECK);
  });
});

describe('the pigeon flock: behaviour and gameplay numbers (D7)', () => {
  it('keeps its numbers: the scare range, the box, depth, tags, category', () => {
    expect(PIGEONS).toEqual({ max: 8, scare: 56, flap: 'swan/flap', takeOff: 'ams/pigeon' });
    expect(getEntityMeta('ams-pigeons')?.category).toBe('npc');
    const tw = new TestWorld({ playerX: 40, god: true });
    const f = tw.spawn('ams-pigeons', 300, { count: 4, spread: 36 }) as Flock;
    expect(f.hitbox).toEqual({ x: -24, y: -10, w: 48, h: 10 });
    expect(f.z).toBe(26);
    expect(f.hasTag('npc') && f.hasTag('decor')).toBe(true);
    expect((tw.spawn('ams-pigeons', 500, { count: 20 }) as Flock).count).toBe(PIGEONS.max);
  });

  it('runs the real loop: the birds step 0.5 px every 4 ticks, peck 16 ticks, then fly up and away and leave', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const f = tw.spawn('ams-pigeons', 300, { count: 5 }) as Flock;
    const { r, calls } = recorder();
    let stepped = 0;
    for (let t = 0; t < 600; t++) {
      const before = Array.from(st(f).px);
      tw.run(1);
      f.draw(r);
      for (let i = 0; i < f.count; i++) {
        const d = Math.abs(st(f).px[i] - before[i]);
        if (d > 0) {
          stepped++;
          expect(d, 'a step').toBeCloseTo(0.5, 5);
          expect(st(f).act[i], 'only a walking bird moves').toBe(2);
        }
        expect(st(f).py[i]).toBe(f.y);
        if (st(f).act[i] === 1) expect(st(f).timer[i]).toBeLessThanOrEqual(PIGEON_PECK_TICKS);
      }
    }
    expect(stepped).toBeGreaterThan(0);
    for (const [id, k] of calls) expect(k, id).toBeLessThan(getFrames(id, 1).length);
    expect(f.fled).toBe(false);
    // a player comes near: the whole flock takes off away from him, climbs and leaves the view
    const p = tw.player!;
    p.x = f.x - 50;
    tw.run(1);
    expect(f.fled).toBe(true);
    for (let i = 0; i < f.count; i++) {
      expect(Math.sign(st(f).bvx[i])).toBe(st(f).px[i] >= p.x ? 1 : -1);
      expect(Math.abs(st(f).bvx[i])).toBeGreaterThanOrEqual(1.1);
      expect(Math.abs(st(f).bvx[i])).toBeLessThanOrEqual(2.0);
      expect(st(f).bvy[i]).toBeLessThan(0);
    }
    calls.length = 0;
    for (let t = 0; t < 400 && f.alive; t++) {
      f.draw(r);
      tw.run(1);
    }
    expect(f.alive).toBe(false);
    for (const [id, k] of calls) expect(k, id).toBeLessThan(getFrames(id, 1).length);
    expect(new Set(calls.map((c) => c[0]))).toEqual(new Set([`${PRE}/takeoff`, `${PRE}/fly`]));
  });
});
