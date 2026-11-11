/**
 * The mallards at 40 px (docs/design/ams40.md wave 4, rule 10): the baked set `ams-ducks`
 * (src/game/content/art40/ams-ducks.gen.ts, drawn by tools/art40/chars/ams-ducks/) keeps the strip
 * contract of docs/design/ams40/contract.md "mallards (drake and hen)": the ids (the paddle in two
 * blocks, drake then hen, at DUCK_DRAKE / DUCK_HEN; the bare 4-frame id npc/ams/ams-ducks composed
 * from the paddle by DUCK_UP / DUCK_DOWN), the 32-tick paddle cycle, THE WATER LINE (the root row is
 * the canal surface: the ripple ring lies on it, nothing of the bird below it), the 28-colour budget
 * (the ripple in the shared FX ramp), 1× pixels at every tier; AmsDucks' own update loop picks an
 * existing frame at every tick (paddle, dabble, hurry); the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { Renderer } from '../../src/engine/render';
import { framesDensityAt, getFrames, hasHiSprite, hasSprite, listSprites } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/ams-ducks.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/missions/ams/index';
import { AmsDucks, DUCK_DABBLE, DUCKS } from '../../src/game/content/missions/ams/ambient';
import { getEntityMeta } from '../../src/game/registry';
import RULES from '../../tools/art40/rules.json';
import { TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PRE = 'npc/ams/ams-ducks';

interface ContractEntry {
  character: string;
  frames: number;
  loop: boolean;
  totalTicks: number;
  events?: { name: string }[];
  noFoot?: string;
}
const CONTRACT_IDS: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const MINE = Object.keys(CONTRACT_IDS).filter((id) => CONTRACT_IDS[id].character === 'ducks').sort();

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const PADDLE = [3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2];
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, cls: string]>> = {
  paddle: [24, [...PADDLE, ...PADDLE], true, 'locomotion'],
  'drake-hurry': [12, [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1], true, 'locomotion'],
  'hen-hurry': [12, [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1], true, 'locomotion'],
  'drake-dabble': [10, [4, 3, 3, 6, 5, 6, 3, 4, 4, 5], false, 'idle-fidget'],
  'hen-dabble': [10, [4, 3, 3, 6, 5, 6, 3, 4, 4, 5], false, 'idle-fidget'],
};
/** The old paddle: 4 steps of 8 ticks per duck (a 32-tick cycle), 2 blocks; the old bare strip 4 x 12 ticks. */
const OLD = { cycle: 32, bare: 4 };

function recorder(): { r: Renderer; calls: [string, number][] } {
  const calls: [string, number][] = [];
  const r = { sprite: (id: string, i: number, x: number, y: number) => void calls.push([id, i, x, y] as unknown as [string, number]) } as unknown as Renderer;
  return { r, calls };
}

type Ducks = AmsDucks;
/** The ducks' private positions (read only, for the gameplay pins). */
const pos = (d: AmsDucks): Float32Array => (d as unknown as { px: Float32Array }).px;

describe('the mallard set at 40 px', () => {
  it('registers exactly the contract ids: the paddle and the bare 4-frame id (composed), plus the new strips', () => {
    expect(MINE).toEqual([PRE, `${PRE}/paddle`]);
    expect(SET.prefix).toBe(PRE);
    expect(SET.variants ?? {}).toEqual({});
    const baked = bakedSetIds(SET).sort();
    expect(baked).toEqual(['drake-dabble', 'drake-hurry', 'hen-dabble', 'hen-hurry', 'paddle'].map((n) => `${PRE}/${n}`));
    for (const id of MINE) expect(hasSprite(id), id).toBe(true);
    expect(listSprites(`${PRE}/`).sort()).toEqual(baked);
    const bare = getFrames(PRE, 1);
    const paddle = getFrames(`${PRE}/paddle`, 1);
    expect(bare.length).toBe(OLD.bare);
    const same = (a: (typeof bare)[number], b: (typeof bare)[number]): boolean =>
      a.ox === b.ox && a.oy === b.oy && a.buf.w === b.buf.w && a.buf.data.every((c, k) => c === b.buf.data[k]);
    expect(same(bare[0], paddle[GEN.DUCK_DRAKE + GEN.DUCK_UP])).toBe(true);
    expect(same(bare[1], paddle[GEN.DUCK_DRAKE + GEN.DUCK_DOWN])).toBe(true);
    expect(same(bare[2], paddle[GEN.DUCK_HEN + GEN.DUCK_UP])).toBe(true);
    expect(same(bare[3], paddle[GEN.DUCK_HEN + GEN.DUCK_DOWN])).toBe(true);
    // the bob: the body sits lower in the water on DUCK_DOWN (its top 1 px lower)
    expect(bare[1].oy).toBe(bare[0].oy - 1);
  });

  it('frame counts, durations, loop flags, classes; the paddle keeps its 32-tick cycle per block', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [n, [frames, durations, loop, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[n];
      expect(st.frames.length, n).toBe(frames);
      expect([...st.durations], n).toEqual([...durations]);
      expect(st.loop, n).toBe(loop);
      expect(Boolean(st.defer), n).toBe(false);
      expect(st.cls, n).toBe(cls);
    }
    const c = CONTRACT_IDS[`${PRE}/paddle`];
    expect(SET.strips.paddle.loop).toBe(c.loop);
    expect(c.noFoot).toMatch(/water line/);
    expect(GEN.DUCK_PADDLE_N).toBe(12);
    for (const block of [GEN.DUCK_DRAKE, GEN.DUCK_HEN]) expect(sum(SET.strips.paddle.durations.slice(block, block + GEN.DUCK_PADDLE_N)), `block ${block}`).toBe(OLD.cycle);
  });

  it('THE WATER LINE: every frame cuts the bird at the root row, the ripple ring lies on it in the FX ramp (no outline there)', () => {
    const fx = new Set(RULES.fxRamp);
    for (const [n, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const at = `${n}[${i}]`;
        const idx = decodeBakedIndices(f);
        // nothing below the water line: the root row is the frame's last row
        expect(f.h, at).toBe(f.oy + 1);
        const water = Array.from(idx.slice((f.h - 1) * f.w));
        const ring = water.filter((v) => v !== 0);
        expect(ring.length, `${at}: a ring under the body`).toBeGreaterThanOrEqual(6);
        for (const v of ring) expect(fx.has(SET.pal[v]), `${at}: ring colour ${SET.pal[v]}`).toBe(true);
        // the bird above it: its outline and body, never an FX pixel in the outline's place
        expect(idx.slice(0, (f.h - 1) * f.w).some((v) => v === SET.outline), at).toBe(true);
      });
    }
  });

  it('every frame decodes within the 28-colour budget (the FX ramp outside it); no points, no smears', () => {
    expect(SET.budget).toBe(28);
    expect(SET.face).toBe(1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    const fxIdx = new Set(SET.fx ?? []);
    const used = new Set<number>();
    for (const [n, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const idx = decodeBakedIndices(f);
        expect(idx.length, `${n}[${i}]`).toBe(f.w * f.h);
        for (const v of idx) {
          expect(v).toBeLessThan(SET.pal.length);
          if (v && !fxIdx.has(v)) used.add(v);
        }
        expect(f.pts ?? {}, `${n}[${i}]`).toEqual({});
        expect(f.smear, `${n}[${i}]`).toBeUndefined();
      });
    }
    expect(fxIdx.size).toBeGreaterThan(0);
    expect(new Set([...used].map((v) => SET.pal[v])).size).toBeLessThanOrEqual(28);
  });

  it('no two consecutive frames are the same picture (each paddle block loops on its own)', () => {
    const runs: [string, number, number, boolean][] = [
      ['paddle', GEN.DUCK_DRAKE, GEN.DUCK_PADDLE_N, true],
      ['paddle', GEN.DUCK_HEN, GEN.DUCK_PADDLE_N, true],
      ...(['drake-hurry', 'hen-hurry', 'drake-dabble', 'hen-dabble'].map((n) => [n, 0, SET.strips[n].frames.length, SET.strips[n].loop]) as [string, number, number, boolean][]),
    ];
    for (const [n, first, len, loop] of runs) {
      const fr = SET.strips[n].frames;
      for (let i = 0; i < (loop ? len : len - 1); i++) {
        const a = fr[first + i];
        const b = fr[first + ((i + 1) % len)];
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${n} ${first + i}`).toBe(false);
      }
    }
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

describe('the mallards: the frames the code reads', () => {
  it('every DUCK_* constant exists in the set and lies inside the paddle', () => {
    for (const ev of CONTRACT_IDS[`${PRE}/paddle`].events ?? []) expect(SET.events?.[ev.name], ev.name).toBeDefined();
    const ev = SET.events ?? {};
    expect(Object.keys(ev).sort()).toEqual(['DUCK_DOWN', 'DUCK_DRAKE', 'DUCK_HEN', 'DUCK_PADDLE_N', 'DUCK_UP']);
    expect(GEN.DUCK_DRAKE).toBe(0);
    expect(GEN.DUCK_HEN).toBe(GEN.DUCK_PADDLE_N);
    expect(GEN.DUCK_HEN + GEN.DUCK_PADDLE_N).toBe(SET.strips.paddle.frames.length);
    for (const k of [GEN.DUCK_UP, GEN.DUCK_DOWN]) {
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(GEN.DUCK_PADDLE_N);
    }
  });

  it('pick returns an existing frame at every tick: paddle (drakes 0-11, hens 12-23), dabble, hurry', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const d = tw.spawn('ams-ducks', 300, { count: 4, range: 60 }) as Ducks;
    const seen: Record<string, Set<number>> = {};
    const check = (): void => {
      for (let i = 0; i < d.count; i++) {
        const [id, k] = d.pick(i);
        expect(k, id).toBeGreaterThanOrEqual(0);
        expect(k, id).toBeLessThan(getFrames(id, 1).length);
        if (id === `${PRE}/paddle`) expect(Math.floor(k / GEN.DUCK_PADDLE_N), `duck ${i}`).toBe(i % 2);
        if (id !== `${PRE}/paddle`) expect(id.split('/').at(-1)?.startsWith(i % 2 ? 'hen-' : 'drake-'), `${id} for duck ${i}`).toBe(true);
        (seen[id] ??= new Set()).add(k);
      }
    };
    for (let t = 0; t < 1000; t++) {
      check();
      tw.run(1);
    }
    expect(seen[`${PRE}/paddle`]?.size).toBe(24);
    expect(seen[`${PRE}/drake-dabble`]?.size).toBe(10);
    expect(seen[`${PRE}/hen-dabble`]?.size).toBe(10);
    expect(seen[`${PRE}/drake-hurry`]).toBeUndefined();
    // a player comes near: the ducks hurry away
    tw.player!.x = d.x;
    for (let t = 0; t < 40; t++) {
      tw.run(1);
      check();
    }
    expect(seen[`${PRE}/drake-hurry`]?.size).toBe(12);
    expect(seen[`${PRE}/hen-hurry`]?.size).toBe(12);
  });

  it('no duck dabbles in its first DUCK_DABBLE.first ticks, and each dabble plays from its first frame', () => {
    expect(DUCK_DABBLE.first).toBeGreaterThan(0);
    const tw = new TestWorld({ playerX: 40, god: true });
    const d = tw.spawn('ams-ducks', 300, { count: 2 }) as Ducks;
    let last = '';
    for (let t = 0; t < 900; t++) {
      tw.run(1);
      const [id, k] = d.pick(0);
      if (t < DUCK_DABBLE.first - 1) expect(id).toBe(`${PRE}/paddle`);
      if (id.endsWith('-dabble') && !last.endsWith('-dabble')) expect(k).toBe(0);
      last = id;
    }
  });
});

describe('the mallards: behaviour and gameplay numbers (D7)', () => {
  it('keeps its numbers: speed, shyness, box, depth, tags, category', () => {
    expect(DUCKS).toEqual({ max: 4, speed: 0.12, shy: 40, quack: 420, sfx: 'ams/duck' });
    expect(getEntityMeta('ams-ducks')?.category).toBe('npc');
    const tw = new TestWorld({ playerX: 40, god: true });
    const d = tw.spawn('ams-ducks', 300, { count: 3, range: 60 }) as Ducks;
    expect(d.hitbox).toEqual({ x: -30, y: -8, w: 60, h: 8 });
    expect(d.z).toBe(5);
    expect(d.hasTag('npc') && d.hasTag('decor')).toBe(true);
    expect((tw.spawn('ams-ducks', 600, { count: 9 }) as Ducks).count).toBe(DUCKS.max);
  });

  it('runs the real loop: paddles at 0.12 px/tick inside the range, 3x when shy, drawn on the water line', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const d = tw.spawn('ams-ducks', 300, { count: 2, range: 60 }) as Ducks;
    const { r, calls } = recorder();
    for (let t = 0; t < 600; t++) {
      const before = Array.from(pos(d));
      tw.run(1);
      d.draw(r);
      for (let i = 0; i < d.count; i++) {
        expect(Math.abs(pos(d)[i] - before[i])).toBeCloseTo(DUCKS.speed, 3);
        expect(pos(d)[i]).toBeGreaterThanOrEqual(300 - 30 - DUCKS.speed);
        expect(pos(d)[i]).toBeLessThanOrEqual(300 + 30 + DUCKS.speed);
      }
    }
    for (const c of calls as unknown as [string, number, number, number][]) {
      expect(c[1], c[0]).toBeLessThan(getFrames(c[0], 1).length);
      expect(c[3], 'the water line').toBe(d.y);
    }
    tw.player!.x = 300;
    tw.run(1);
    const before = Array.from(pos(d));
    tw.run(1);
    for (let i = 0; i < d.count; i++) expect(Math.abs(pos(d)[i] - before[i])).toBeCloseTo(DUCKS.speed * 3, 3);
  });
});
