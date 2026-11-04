/**
 * The window waver and the cat at 40 px (docs/design/ams40.md wave 5, rule 10): the baked set
 * `ams-window-waver` (src/game/content/art40/ams-window-waver.gen.ts, drawn by
 * tools/art40/chars/ams-window-waver/) keeps the strip contract of docs/design/ams40/contract.md
 * "window waver and the cat": the four ids, the loop flags and the logic times the game reads
 * (lean 9 ticks, cat-swish 48, the person's phase windows 100 / 130 / 250 / 280 of its period), the
 * frame roles as baked constants (WAVER_*), every picture inside the entity's 20 × 26 window box
 * above the sill (never larger, never cut), the 28-colour budget, 1× pixels at every tier; the
 * entity's own update loop picks an existing frame at every tick; the gameplay numbers stay (D7).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import type { Renderer } from '../../src/engine/render';
import { framesDensityAt, getFrames, hasHiSprite, hasSprite, listSprites } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/ams-window-waver.gen';
import '../../src/game/content/characters/index';
import '../../src/game/content/missions/ams/index';
import {
  AmsWindowWaver,
  CAT_SWISH_TICKS,
  frameInRun,
  WAVER_LEAN_TICKS,
  WAVER_PHASE,
  WAVER_RAISE_TICKS,
  waverPick,
} from '../../src/game/content/missions/ams/ambient';
import { getEntityMeta } from '../../src/game/registry';
import { FLOOR, TestWorld } from '../content/helpers';

const SET: BakedSet = GEN.SET;
const PRE = 'npc/ams/ams-window-waver';

interface ContractEntry {
  character: string;
  frames: number;
  loop: boolean;
  defer: boolean;
  totalTicks: number;
  framePoints: string[][];
  events?: { name: string }[];
  class?: string;
}
const CONTRACT_IDS: Record<string, ContractEntry> = JSON.parse(readFileSync('docs/design/ams40/contract.json', 'utf8')).ids;
const MINE = Object.entries(CONTRACT_IDS).filter(([, e]) => e.character === 'window-waver');

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Frame counts, durations, loop flags and classes (the plan's class table; the logic times of the contract). */
const STRIPS: Readonly<Record<string, readonly [frames: number, durations: readonly number[], loop: boolean, cls: string]>> = {
  person: [11, [10, 18, 4, 3, 3, 4, 2, 2, 4, 2, 2], true, 'roles'],
  lean: [4, [2, 3, 2, 2], false, 'idle-fidget'],
  'cat-swish': [8, [6, 5, 8, 5, 6, 5, 8, 5], true, 'idle-fidget'],
  cat: [8, [6, 6, 6, 6, 6, 6, 6, 6], true, 'idle-fidget'],
};
/** The logic time of the timed strips (the old strips: lean 3 × 3, swish [14, 10, 14, 10], cat 2 × 24). */
const LOGIC: Readonly<Record<string, number>> = { lean: 9, 'cat-swish': 48, cat: 48 };
/** The entity's box (the window, hitbox (-10, -26, 20, 26)): every pixel inside it, above the sill. */
const BOX = { x: -10, y: -26, w: 20, h: 26 };

/** A renderer that records the sprite calls. */
function recorder(): { r: Renderer; calls: [string, number][] } {
  const calls: [string, number][] = [];
  const r = { sprite: (id: string, i: number) => void calls.push([id, i]) } as unknown as Renderer;
  return { r, calls };
}

describe('the window waver set at 40 px', () => {
  it('registers exactly the contract ids of the window waver (no variants)', () => {
    const contract = MINE.map(([id]) => id).sort();
    expect(contract).toEqual([`${PRE}/cat`, `${PRE}/cat-swish`, `${PRE}/lean`, `${PRE}/person`]);
    expect(SET.prefix).toBe(PRE);
    expect(SET.variants ?? {}).toEqual({});
    expect(bakedSetIds(SET).sort()).toEqual(contract);
    for (const id of contract) expect(hasSprite(id), id).toBe(true);
    expect(listSprites(`${PRE}/`).sort()).toEqual(contract);
  });

  it('frame counts, durations, loop and defer flags, classes; the logic times of the timed strips', () => {
    expect(Object.keys(SET.strips).sort()).toEqual(Object.keys(STRIPS).sort());
    for (const [n, [frames, durations, loop, cls]] of Object.entries(STRIPS)) {
      const st = SET.strips[n];
      const c = CONTRACT_IDS[`${PRE}/${n}`];
      expect(st.frames.length, n).toBe(frames);
      expect([...st.durations], n).toEqual([...durations]);
      expect(st.loop, n).toBe(loop);
      expect(st.loop, `${n}: the contract's loop flag`).toBe(c.loop);
      expect(Boolean(st.defer), `${n}: the contract's defer flag`).toBe(c.defer);
      expect(st.cls, n).toBe(cls);
      if (LOGIC[n] !== undefined) {
        expect(sum(st.durations), `${n} logic time`).toBe(LOGIC[n]);
        expect(sum(st.durations), `${n}: the contract's total`).toBe(c.totalTicks);
      }
    }
    // the lean has fewer frames than its class: the logged reason is baked
    expect(SET.strips.lean.why).toMatch(/9 logic ticks/);
    // the wave cycle is the old 8 + 8 alternation (16 ticks)
    expect(sum(SET.strips.person.durations.slice(GEN.WAVER_WAVE_A, GEN.WAVER_WAVE_A + GEN.WAVER_WAVE_N))).toBe(16);
  });

  it('every frame decodes inside the 20 × 26 window above the sill, on the old anchor role, within the 28-colour budget', () => {
    expect(SET.budget).toBe(28);
    expect(SET.face).toBe(-1);
    expect(SET.pal[SET.outline]).toBe('#140c0e');
    const used = new Set<number>();
    for (const [n, st] of Object.entries(SET.strips)) {
      st.frames.forEach((f, i) => {
        const at = `${n}[${i}]`;
        const idx = decodeBakedIndices(f);
        expect(idx.length, at).toBe(f.w * f.h);
        let bottom = -1;
        for (let k = 0; k < idx.length; k++) {
          const v = idx[k];
          expect(v, at).toBeLessThan(SET.pal.length);
          if (!v) continue;
          used.add(v);
          const x = (k % f.w) - f.ox;
          const y = Math.floor(k / f.w) - f.oy;
          if (x < BOX.x || x >= BOX.x + BOX.w || y < BOX.y || y >= BOX.y + BOX.h) expect.fail(`${at}: pixel at (${x}, ${y}) outside the window box`);
          bottom = Math.max(bottom, y);
        }
        // the window always fills its box: the anchor is the old one (10 from the left), the sill line
        expect([f.w, f.h, f.ox, f.oy], at).toEqual([20, 26, 10, 26]);
        expect(bottom, `${at}: the tulip box stands on the sill line`).toBe(-1);
        expect(f.pts ?? {}, `${at}: no points (the contract reads none)`).toEqual({});
        expect(f.smear, `${at}: no smear frames`).toBeUndefined();
      });
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
        expect(a.px === b.px && a.w === b.w && a.h === b.h, `${n} ${i} -> ${(i + 1) % st.frames.length}`).toBe(false);
      }
    }
  });

  it('draws the 1× frames at every art tier (no dense art left)', () => {
    for (const [id] of MINE) {
      const lo = getFrames(id, 1);
      expect(lo.length, id).toBe(SET.strips[id.slice(PRE.length + 1)].frames.length);
      for (const d of [2, 4]) {
        expect(hasHiSprite(id, d as 2 | 4), `${id} ${d}×`).toBe(false);
        expect(framesDensityAt(id, d), `${id} ${d}×`).toBe(1);
        const hi = getFrames(id, d);
        expect(hi.length, id).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) expect(hi[i].buf, `${id}[${i}] ${d}×`).toBe(lo[i].buf);
      }
    }
  });
});

describe('the window waver: the frame roles the code reads', () => {
  it('every WAVER_* constant exists in the set and lies inside the person strip, in role order', () => {
    const n = SET.strips.person.frames.length;
    for (const ev of CONTRACT_IDS[`${PRE}/person`].events ?? []) expect(SET.events?.[ev.name], ev.name).toBeDefined();
    const ev = SET.events ?? {};
    expect(ev).toEqual({
      WAVER_EMPTY: GEN.WAVER_EMPTY,
      WAVER_IDLE: GEN.WAVER_IDLE,
      WAVER_BLINK: GEN.WAVER_BLINK,
      WAVER_RAISE: GEN.WAVER_RAISE,
      WAVER_RAISE_N: GEN.WAVER_RAISE_N,
      WAVER_WAVE_A: GEN.WAVER_WAVE_A,
      WAVER_WAVE_B: GEN.WAVER_WAVE_B,
      WAVER_WAVE_N: GEN.WAVER_WAVE_N,
    });
    for (const k of ['WAVER_EMPTY', 'WAVER_IDLE', 'WAVER_BLINK', 'WAVER_RAISE', 'WAVER_WAVE_A', 'WAVER_WAVE_B'] as const) {
      expect(Number.isInteger(ev[k]), k).toBe(true);
      expect(ev[k], k).toBeGreaterThanOrEqual(0);
      expect(ev[k], k).toBeLessThan(n);
    }
    // the roles: 0 empty, 1 idle (the old roles), then the blink, the raise, the wave cycle
    expect(GEN.WAVER_EMPTY).toBe(0);
    expect(GEN.WAVER_IDLE).toBe(1);
    expect(GEN.WAVER_BLINK).toBe(GEN.WAVER_IDLE + 1);
    expect(GEN.WAVER_RAISE + GEN.WAVER_RAISE_N).toBeLessThanOrEqual(GEN.WAVER_WAVE_A);
    expect(GEN.WAVER_WAVE_A + GEN.WAVER_WAVE_N).toBe(n);
    expect(GEN.WAVER_WAVE_B).toBeGreaterThan(GEN.WAVER_WAVE_A);
    expect(GEN.WAVER_WAVE_B).toBeLessThan(GEN.WAVER_WAVE_A + GEN.WAVER_WAVE_N);
  });

  it('the logic time stays: the phase windows, the lean, the swish', () => {
    expect(WAVER_PHASE).toEqual({ in: 100, wave: 130, idle: 250, out: 280 });
    expect(WAVER_LEAN_TICKS).toBe(9);
    expect(CAT_SWISH_TICKS).toBe(48);
    expect(WAVER_RAISE_TICKS).toBe(sum(SET.strips.person.durations.slice(GEN.WAVER_RAISE, GEN.WAVER_RAISE + GEN.WAVER_RAISE_N)));
    // the raise and the lowering fit inside the wave window with waving between them
    expect(2 * WAVER_RAISE_TICKS).toBeLessThan(WAVER_PHASE.idle - WAVER_PHASE.wave);
  });

  it('frameInRun: loops or holds a run of durations', () => {
    const d = [10, 2, 3, 4];
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => frameInRun(d, 1, 3, t, true))).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 3]);
    expect(frameInRun(d, 1, 3, 9, true)).toBe(1);
    expect(frameInRun(d, 1, 3, 9, false)).toBe(3);
    expect(frameInRun(d, 1, 3, 500, false)).toBe(3);
    expect(frameInRun(d, 0, 4, -3, false)).toBe(0);
  });

  it('waverPick returns an existing frame at every tick of every phase, in the phase roles', () => {
    const count = (s: string): number => SET.strips[s].frames.length;
    const P = WAVER_PHASE;
    for (let t = 0; t < 360; t++) {
      const [strip, f] = waverPick(t, false);
      expect(Number.isInteger(f), `t ${t}`).toBe(true);
      expect(f, `t ${t}`).toBeGreaterThanOrEqual(0);
      expect(f, `t ${t} ${strip}`).toBeLessThan(count(strip));
      if (t < P.in || t >= P.out) expect([strip, f], `t ${t}`).toEqual(['person', GEN.WAVER_EMPTY]);
      else if (t < P.in + WAVER_LEAN_TICKS || t >= P.out - WAVER_LEAN_TICKS) expect(strip, `t ${t}`).toBe('lean');
      else if (t < P.wave || t >= P.idle) expect([GEN.WAVER_IDLE, GEN.WAVER_BLINK], `t ${t}`).toContain(f);
      else if (t < P.wave + WAVER_RAISE_TICKS || t >= P.idle - WAVER_RAISE_TICKS) {
        expect(f, `t ${t}`).toBeGreaterThanOrEqual(GEN.WAVER_RAISE);
        expect(f, `t ${t}`).toBeLessThan(GEN.WAVER_RAISE + GEN.WAVER_RAISE_N);
      } else {
        expect(f, `t ${t}`).toBeGreaterThanOrEqual(GEN.WAVER_WAVE_A);
        expect(f, `t ${t}`).toBeLessThan(GEN.WAVER_WAVE_A + GEN.WAVER_WAVE_N);
      }
    }
    // the lean in plays 0..3 forward, the lean out the same frames backwards
    const lean = (a: number, b: number): number[] => Array.from({ length: b - a }, (_, k) => waverPick(a + k, false)[1]);
    const inn = lean(P.in, P.in + WAVER_LEAN_TICKS);
    expect(inn).toEqual([0, 0, 1, 1, 1, 2, 2, 3, 3]);
    expect(lean(P.out - WAVER_LEAN_TICKS, P.out)).toEqual([...inn].reverse());
    // the raise: anticipation, then the hand up; lowering is the raise backwards
    expect(waverPick(P.wave, false)[1]).toBe(GEN.WAVER_RAISE);
    expect(waverPick(P.idle - 1, false)[1]).toBe(GEN.WAVER_RAISE);
    expect(waverPick(P.wave + WAVER_RAISE_TICKS, false)[1]).toBe(GEN.WAVER_WAVE_A);
    // the wave cycle reaches both ends
    const wave = new Set(Array.from({ length: 120 }, (_, k) => waverPick(P.wave + k, false)[1]));
    expect(wave.has(GEN.WAVER_WAVE_A) && wave.has(GEN.WAVER_WAVE_B)).toBe(true);
    // the cat swishes through every frame of its 48-tick strip
    const sw = Array.from({ length: 2 * CAT_SWISH_TICKS }, (_, t) => waverPick(t, true));
    for (const [strip, f] of sw) {
      expect(strip).toBe('cat-swish');
      expect(f).toBeLessThan(count('cat-swish'));
    }
    expect(new Set(sw.map(([, f]) => f)).size).toBe(count('cat-swish'));
    expect(sw.slice(0, CAT_SWISH_TICKS)).toEqual(sw.slice(CAT_SWISH_TICKS));
  });
});

describe('the window waver: behaviour (headless update loop)', () => {
  it('keeps its gameplay numbers (hitbox, depth, tags, period, category)', () => {
    expect(getEntityMeta('ams-window-waver')?.category).toBe('npc');
    const tw = new TestWorld({ playerX: 60, god: true });
    const w = tw.spawn('ams-window-waver', 300, { period: 360 }, FLOOR - 80) as AmsWindowWaver;
    expect(w).toBeInstanceOf(AmsWindowWaver);
    expect(w.hitbox).toEqual(BOX);
    expect(w.z).toBe(3);
    expect(w.hasTag('npc') && w.hasTag('decor')).toBe(true);
    expect(w.period).toBe(360);
    expect(w.cat).toBe(false);
    expect((tw.spawn('ams-window-waver', 320, { period: 100 }, FLOOR - 80) as AmsWindowWaver).period).toBe(240);
    expect((tw.spawn('ams-window-waver', 340, {}, FLOOR - 80) as AmsWindowWaver).period).toBe(360);
    expect((tw.spawn('ams-window-waver', 360, { look: 'cat' }, FLOOR - 80) as AmsWindowWaver).cat).toBe(true);
    expect((tw.spawn('ams-window-waver', 380, { look: 1 }, FLOOR - 80) as AmsWindowWaver).cat).toBe(true);
  });

  it('runs two periods of the person and the cat: every drawn frame exists, every phase shows', () => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const w = tw.spawn('ams-window-waver', 300, { period: 360 }, FLOOR - 80);
    const c = tw.spawn('ams-window-waver', 330, { look: 'cat' }, FLOOR - 80);
    const { r, calls } = recorder();
    for (let i = 0; i < 720; i++) {
      w.draw(r);
      c.draw(r);
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
    for (const [id, f] of calls) {
      expect(hasSprite(id), id).toBe(true);
      expect(f, id).toBeLessThan(getFrames(id).length);
    }
    const seen = (id: string): Set<number> => new Set(calls.filter((x) => x[0] === `${PRE}/${id}`).map((x) => x[1]));
    expect(seen('person')).toEqual(new Set(SET.strips.person.frames.map((_, i) => i)));
    expect(seen('lean')).toEqual(new Set([0, 1, 2, 3]));
    expect(seen('cat-swish')).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  });

  it('a player passing an empty window gets a wave (the lean starts within 8 ticks)', () => {
    // x 300 with period 360 starts at phase 300: the window is empty; the player stands below it
    const tw = new TestWorld({ playerX: 290, god: true });
    const w = tw.spawn('ams-window-waver', 300, { period: 360 }, FLOOR - 80);
    const { r, calls } = recorder();
    for (let i = 0; i < 12; i++) {
      w.draw(r);
      tw.run(1);
    }
    const first = calls.findIndex((x) => x[0] === `${PRE}/lean`);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(9);
    expect(calls[first][1]).toBe(0);
    expect(calls.slice(0, first).every((x) => x[0] === `${PRE}/person` && x[1] === GEN.WAVER_EMPTY)).toBe(true);
  });
});
