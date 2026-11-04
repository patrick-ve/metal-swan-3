/**
 * PATRICK on the select screen (docs/design/select40.md): the baked set `select-patrick`
 * (src/game/content/art40/select-patrick.gen.ts, drawn by tools/art40/chars/select-patrick/ on the
 * portrait kit). The contract checks every friend shares live in select-portraits.test.ts; this file
 * pins PATRICK's own timeline (the 9-frame nervous loop, the 11-frame pick of 32 ticks), his gag
 * (the brow vein throbs, one strand of the slick hair springs up and falls onto the forehead), the
 * traits of his look (black slick hair, the white tee in the black jacket, the head turned to the
 * viewer's right), the registry at every density and the deterministic bake.
 */
import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { bakedSetIds, decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import { getFrames, hasHiSprite, hasSprite, spriteAnim } from '../../src/engine/sprites';
import * as GEN from '../../src/game/content/art40/select-patrick.gen';
import { SELECT_SETS, SELECT_STRIPS } from '../../src/game/content/characters/select.art';

const SET: BakedSet = GEN.SET;
const W = 64;
const H = 120;
const P = 'char/patrick/';

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
});

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const LUMA: number[] = SET.pal.map((hex, i) => {
  if (i === 0) return 0;
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
});
const idx = (strip: string, i: number): Uint8Array => decodeBakedIndices(SET.strips[strip].frames[i]);
/** Pixels in the box [x0, x1) x [y0, y1) that pass the test. */
const count = (px: Uint8Array, x0: number, y0: number, x1: number, y1: number, test: (k: number) => boolean): number => {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(px[y * W + x])) n++;
  return n;
};
const diffBox = (a: Uint8Array, b: Uint8Array): { n: number; x0: number; x1: number; y0: number; y1: number } => {
  const r = { n: 0, x0: W, x1: -1, y0: H, y1: -1 };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (a[y * W + x] !== b[y * W + x]) {
        r.n++;
        r.x0 = Math.min(r.x0, x);
        r.x1 = Math.max(r.x1, x);
        r.y0 = Math.min(r.y0, y);
        r.y1 = Math.max(r.y1, y);
      }
  return r;
};

describe('select-patrick: the set', () => {
  it('is the registered PATRICK set: slug, shared prefix char/patrick, 64-colour budget, the three strips only', () => {
    expect(SELECT_SETS.patrick).toBe(SET);
    expect(SET.slug).toBe('select-patrick');
    expect(SET.prefix).toBe('char/patrick');
    expect(SET.budget).toBe(64);
    expect(bakedSetIds(SET).sort()).toEqual(SELECT_STRIPS.map((s) => P + s).sort());
    expect(new Set(SET.pal.slice(1).map((c) => c.toLowerCase())).size).toBeLessThanOrEqual(64);
  });

  it('keeps his timeline: a still grey, a 9-frame loop of 148 ticks held on the key pose, an 11-frame pick of 32 ticks held at the end', () => {
    const g = SET.strips['select-grey'];
    expect([g.frames.length, g.loop]).toEqual([1, true]);
    const s = SET.strips.select;
    expect(s.durations).toEqual([44, 16, 3, 4, 3, 26, 10, 22, 20]);
    expect([sum(s.durations), s.loop]).toEqual([148, true]);
    const p = SET.strips['select-pick'];
    expect(p.durations).toEqual([2, 2, 3, 2, 3, 2, 3, 2, 3, 2, 8]);
    expect([sum(p.durations), p.loop]).toEqual([32, false]);
    expect(GEN.SELECT_PICK_TICKS).toBe(32);
    expect(SET.events?.SELECT_PICK_TICKS).toBe(32);
    for (const st of Object.values(SET.strips)) for (const f of st.frames) expect([f.w, f.h, f.ox, f.oy]).toEqual([W, H, 0, 0]);
  });

  it('the registry plays his strips with the baked timing and gives the 1× frames at densities 2 and 4', () => {
    for (const name of SELECT_STRIPS) {
      const id = P + name;
      expect(hasSprite(id), id).toBe(true);
      const a = spriteAnim(id);
      expect(a.durations ? [...a.durations] : null, id).toEqual(SET.strips[name].durations);
      expect(a.loop, id).toBe(SET.strips[name].loop);
      expect(hasHiSprite(id, 2) || hasHiSprite(id, 4), id).toBe(false);
      const f1 = getFrames(id, 1);
      for (const d of [2, 4]) getFrames(id, d).forEach((f, i) => expect(f.buf.data, `${id}@${d}#${i}`).toEqual(f1[i].buf.data));
    }
  });
});

describe('select-patrick: his gag in the pick', () => {
  it('the brow vein throbs: frames 6 and 7 differ only in the vein on the lit temple', () => {
    const d = diffBox(idx('select-pick', 6), idx('select-pick', 7));
    expect(d.n).toBeGreaterThanOrEqual(15);
    // the vein's box: the left half of the forehead, between the hairline and the brow
    expect(d.x0).toBeGreaterThanOrEqual(16);
    expect(d.x1).toBeLessThanOrEqual(30);
    expect(d.y0).toBeGreaterThanOrEqual(16);
    expect(d.y1).toBeLessThanOrEqual(40);
  });

  it('the throb keeps going: the swollen vein comes back on frames 2, 4, 6 and the held pose', () => {
    const calm = idx('select', 0);
    for (const i of [2, 4, 6, 10]) {
      const px = idx('select-pick', i);
      const a = diffBox(px, idx('select-pick', 7));
      expect(a.n, `pick ${i}`).toBeGreaterThan(0);
      // there is no vein in the calm key pose: its box holds fewer dark edge pixels
      const dark = (p: Uint8Array): number => count(p, 18, 20, 28, 37, (k) => LUMA[k] < 0.45);
      expect(dark(px), `pick ${i}`).toBeGreaterThan(dark(calm) + 4);
    }
  });

  it('one strand springs up out of the slick hair (frame 2) against the booth, then hangs on the forehead (from frame 4 to the end)', () => {
    const gloss = (p: Uint8Array): number => count(p, 12, 0, 31, 8, (k) => LUMA[k] > 0.3);
    expect(gloss(idx('select', 0))).toBe(0);
    expect(gloss(idx('select-pick', 0))).toBe(0);
    expect(gloss(idx('select-pick', 2))).toBeGreaterThanOrEqual(8);
    const lock = (p: Uint8Array): number => count(p, 24, 21, 33, 30, (k) => LUMA[k] < 0.2);
    expect(lock(idx('select', 0))).toBeLessThanOrEqual(2);
    for (let i = 4; i <= 10; i++) expect(lock(idx('select-pick', i)), `pick ${i}`).toBeGreaterThanOrEqual(8);
  });

  it('the strained smile cracks into the clenched grimace: teeth (light pixels in the mouth) from frame 3 on, none in the loop', () => {
    const teeth = (p: Uint8Array): number => count(p, 20, 72, 50, 82, (k) => LUMA[k] > 0.7);
    for (let i = 0; i < SET.strips.select.frames.length; i++) expect(teeth(idx('select', i)), `select ${i}`).toBeLessThanOrEqual(1);
    for (let i = 3; i <= 10; i++) expect(teeth(idx('select-pick', i)), `pick ${i}`).toBeGreaterThanOrEqual(8);
  });
});

describe('select-patrick: his look', () => {
  it('black slick hair on top, the black jacket and the white tee in its opening', () => {
    const key = idx('select', 0);
    const hair = count(key, 24, 4, 41, 13, (k) => LUMA[k] < 0.3) / (17 * 9);
    expect(hair).toBeGreaterThan(0.85);
    expect(count(key, 28, 96, 45, 115, (k) => LUMA[k] > 0.6)).toBeGreaterThanOrEqual(25);
    expect(count(key, 0, 100, 64, 120, (k) => LUMA[k] < 0.25) / (64 * 20)).toBeGreaterThan(0.7);
  });

  it('the head turns a little to the viewer right: the nose glint sits right of the window middle', () => {
    const key = idx('select', 0);
    const glint = SET.pal.findIndex((c) => c.toLowerCase() === '#fdfcf6');
    expect(glint).toBeGreaterThan(0);
    const xs: number[] = [];
    for (let y = 55; y < 66; y++) for (let x = 20; x < 44; x++) if (key[y * W + x] === glint) xs.push(x);
    expect(xs.length).toBeGreaterThanOrEqual(1);
    for (const x of xs) expect(x).toBeGreaterThan(32);
  });

  it('the grey state is the same face, unlit: darker than the colour key pose everywhere in the face box', () => {
    const g = idx('select-grey', 0);
    const c = idx('select', 0);
    let lg = 0;
    let lc = 0;
    for (let y = 20; y < 95; y++)
      for (let x = 8; x < 56; x++) {
        lg += LUMA[g[y * W + x]];
        lc += LUMA[c[y * W + x]];
      }
    expect(lg).toBeLessThan(lc * 0.6);
  });
});

describe('select-patrick: the bake', () => {
  it('is deterministic: the checked-in file is byte-identical to a fresh bake (also with another hash seed)', () => {
    const run = (seed: string): void => {
      execFileSync('python3', ['tools/art40/bake.py', 'select-patrick', '--check'], {
        env: { ...process.env, PYTHONHASHSEED: seed },
        stdio: 'pipe',
        timeout: 280_000,
      });
    };
    expect(() => run('0')).not.toThrow();
    expect(() => run('7')).not.toThrow();
  }, 600_000);
});
