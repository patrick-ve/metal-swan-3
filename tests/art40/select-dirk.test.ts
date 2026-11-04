/**
 * DIRK's select portrait (docs/design/select40.md; tools/art40/chars/select-dirk/ on the portrait
 * kit): his traits and his gag, measured on the baked frames. The contract checks every set shares
 * (registration, 64 × 120 top-left frames, timing ranges, densities, the grey state) live in
 * tests/art40/select-portraits.test.ts; this file holds what is DIRK's own: the spiky hair pushed up
 * and to one side, the thick ginger horseshoe mustache, the strip of stubble under the lip, the ears
 * that stand out, the squint, the plumber's dark collar under the hi-vis vest, the pick reaction
 * (the mustache bristles like a brush with the eyes snapped open, then droops limp over a clenched
 * grimace) and a deterministic bake.
 */
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import { getFrames, hasHiSprite, spriteAnim } from '../../src/engine/sprites';
import { SELECT_PICK_TICKS, SET } from '../../src/game/content/art40/select-dirk.gen';
import { SELECT_SETS } from '../../src/game/content/characters/select.art';

const W = 64;
const H = 120;
const ROOT = new URL('../..', import.meta.url).pathname;

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
const luma = ([r, g, b]: Rgb): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Colour classes of DIRK's palette (by colour, not by index: a rebake may reorder the palette). */
// Ginger-brown hair and mustache: warm and saturated (green well over blue for its brightness);
// the skin, the blush and the lips sit far lower on that ratio.
const isGinger = ([r, g, b]: Rgb): boolean => r > g && g > b && (g - b) / r >= 0.24;
const isHiVis = ([r, g, b]: Rgb): boolean => g >= r && g - b >= 60;
const isWarm = ([r, , b]: Rgb): boolean => r > b + 12;
const isPale = (c: Rgb): boolean => luma(c) > 0.6 && Math.max(...c) - Math.min(...c) < 60;

function frameOf(set: BakedSet, strip: string, i: number): Rgb[] {
  const pal = set.pal.map(rgb);
  const idx = decodeBakedIndices(set.strips[strip].frames[i]);
  return Array.from(idx, (k) => pal[k]);
}

function count(px: readonly Rgb[], test: (c: Rgb) => boolean, x0: number, y0: number, x1: number, y1: number): number {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(px[y * W + x])) n++;
  return n;
}

/** The mustache's top: the first row (from y 55) with 6+ ginger pixels across the middle. */
function bandTop(px: readonly Rgb[]): number {
  for (let y = 55; y < 80; y++) if (count(px, isGinger, 18, y, 46, y + 1) >= 6) return y;
  return -1;
}

/** The mustache's width: columns with a ginger pixel in the band rows (upper lip). */
function bandWidth(px: readonly Rgb[]): number {
  let n = 0;
  for (let x = 8; x < 56; x++) if (count(px, isGinger, x, 64, x + 1, 77) > 0) n++;
  return n;
}

/** How far a horseshoe tip hangs: the lowest row a ginger run reaches, walking down from the band
 *  (its first ginger pixel in rows 70-77) in the tip columns of one side. */
function tipEnd(px: readonly Rgb[], xs: readonly number[]): number {
  let end = -1;
  for (const x of xs) {
    let y = 70;
    while (y < 78 && !isGinger(px[y * W + x])) y++;
    if (y >= 78) continue;
    while (y + 1 < H && isGinger(px[(y + 1) * W + x])) y++;
    end = Math.max(end, y);
  }
  return end;
}
const LEFT_TIP = [19, 20, 21, 22, 23, 24];
const RIGHT_TIP = [40, 41, 42, 43, 44, 45, 46];

/** Most separate warm runs (hair spikes against the cold backdrop) in one row of the top band. */
function spikes(px: readonly Rgb[]): number {
  let best = 0;
  for (let y = 2; y < 14; y++) {
    let n = 0;
    let on = false;
    for (let x = 1; x < W - 1; x++) {
      const w = isGinger(px[y * W + x]);
      if (w && !on) n++;
      on = w;
    }
    best = Math.max(best, n);
  }
  return best;
}

const EYES = [4, 42, 60, 58] as const;
const eyeWhites = (px: readonly Rgb[]): number => count(px, isPale, ...EYES);

const grey = frameOf(SET, 'select-grey', 0);
const loop = SET.strips.select;
const pick = SET.strips['select-pick'];
const key = frameOf(SET, 'select', 0);
const loops = loop.frames.map((_, i) => frameOf(SET, 'select', i));
const picks = pick.frames.map((_, i) => frameOf(SET, 'select-pick', i));
const last = picks[picks.length - 1];
/** The bristle frames: the pick frames whose mustache rises highest (the brush). */
const peak = picks.reduce((b, f, i) => (bandTop(f) < bandTop(picks[b]) ? i : b), 0);

beforeAll(async () => {
  // The hero set shares the prefix char/dirk: both registrations live side by side.
  await import('../../src/game/content/characters/art');
});

describe('DIRK select portrait: traits', () => {
  it('is the registered DIRK set: slug select-dirk, prefix char/dirk, 64 colours, the three strips', () => {
    expect(SELECT_SETS.dirk).toBe(SET);
    expect(SET.slug).toBe('select-dirk');
    expect(SET.prefix).toBe('char/dirk');
    expect(SET.budget).toBe(64);
    expect(Object.keys(SET.strips).sort()).toEqual(['select', 'select-grey', 'select-pick']);
    expect(new Set(SET.pal.slice(1).map((c) => c.toLowerCase())).size).toBeLessThanOrEqual(64);
  });

  it('has spiky hair pushed up off the head: four or more separate spikes in the top band, the tips near the window top', () => {
    expect(spikes(key)).toBeGreaterThanOrEqual(4);
    let top = -1;
    for (let y = 1; y < 30 && top < 0; y++) if (count(key, isGinger, 1, y, W - 1, y + 1) > 0) top = y;
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThanOrEqual(5);
    // Pushed to one side: more hair in the upper right than in the upper left.
    expect(count(key, isGinger, 32, 1, 63, 14)).toBeGreaterThan(count(key, isGinger, 1, 1, 32, 14));
  });

  it('wears a thick ginger horseshoe mustache: a wide band over the lip with tips that hang past the mouth corners', () => {
    const top = bandTop(key);
    expect(top).toBeGreaterThanOrEqual(64);
    expect(top).toBeLessThanOrEqual(72);
    expect(bandWidth(key)).toBeGreaterThanOrEqual(20);
    expect(count(key, isGinger, 18, 66, 46, 78)).toBeGreaterThanOrEqual(120);
    // Both tips hang below the band (the horseshoe), not just a straight brush.
    expect(tipEnd(key, LEFT_TIP)).toBeGreaterThanOrEqual(78);
    expect(tipEnd(key, RIGHT_TIP)).toBeGreaterThanOrEqual(78);
  });

  it('has the strip of stubble under the lower lip and on the chin, but a bare forehead and cheeks', () => {
    expect(count(key, isGinger, 29, 79, 36, 86)).toBeGreaterThanOrEqual(12);
    expect(count(key, isGinger, 16, 30, 48, 40)).toBeLessThanOrEqual(4);
  });

  it('shows his ears standing out at both sides of the round face', () => {
    expect(count(key, isWarm, 1, 44, 4, 70)).toBeGreaterThanOrEqual(15);
    expect(count(key, isWarm, 60, 44, 63, 70)).toBeGreaterThanOrEqual(15);
  });

  it('squints: few eye whites in the key pose, many more when the pick snaps the eyes open', () => {
    const k = eyeWhites(key);
    expect(k).toBeGreaterThan(0);
    expect(Math.max(...picks.map(eyeWhites))).toBeGreaterThanOrEqual(2 * k);
  });

  it('wears the hi-vis vest over the plumber’s dark top: bright yellow-green panels at both sides, dark in the middle', () => {
    expect(count(key, isHiVis, 1, 100, 21, 119)).toBeGreaterThanOrEqual(100);
    expect(count(key, isHiVis, 43, 100, 63, 119)).toBeGreaterThanOrEqual(100);
    expect(count(key, isHiVis, 27, 100, 37, 119)).toBe(0);
  });

  it('the grey state keeps no ginger and no hi-vis: the whole picture is unlit', () => {
    expect(count(grey, isGinger, 1, 1, W - 1, H - 1)).toBe(0);
    expect(count(grey, isHiVis, 1, 1, W - 1, H - 1)).toBe(0);
  });

  it('the lit loop twitches the mustache on one side only (the breath moves both sides alike)', () => {
    // Ginger pixels of each half of the mustache (left of the nose line / right of it).
    const half = (f: readonly Rgb[], x0: number, x1: number): number => count(f, isGinger, x0, 62, x1, 80);
    const l0 = half(key, 16, 32);
    const r0 = half(key, 33, 49);
    const oneSided = loops.filter((f) => {
      const dl = Math.abs(half(f, 16, 32) - l0);
      const dr = Math.abs(half(f, 33, 49) - r0);
      return Math.max(dl, dr) >= 5 && Math.min(dl, dr) <= 1;
    });
    expect(oneSided.length).toBeGreaterThanOrEqual(1);
    for (const f of loops) expect(Math.abs(bandTop(f) - bandTop(key))).toBeLessThanOrEqual(2);
  });
});

describe('DIRK select portrait: the pick (the mustache bristles, then droops)', () => {
  it('runs once in the contract time and exports its length', () => {
    expect(pick.loop).toBe(false);
    const total = pick.durations.reduce((a, b) => a + b, 0);
    expect(SELECT_PICK_TICKS).toBe(total);
    expect(total).toBeGreaterThanOrEqual(24);
    expect(total).toBeLessThanOrEqual(40);
    expect(pick.frames.length).toBeGreaterThanOrEqual(8);
    expect(pick.frames.length).toBeLessThanOrEqual(14);
  });

  it('bristles early: the mustache rises 4+ rows and spreads 6+ columns wider within the first 12 ticks', () => {
    const p = picks[peak];
    expect(bandTop(key) - bandTop(p)).toBeGreaterThanOrEqual(4);
    expect(bandWidth(p) - bandWidth(key)).toBeGreaterThanOrEqual(6);
    const at = pick.durations.slice(0, peak).reduce((a, b) => a + b, 0);
    expect(at).toBeLessThan(12);
    // The eyes snap open with it.
    expect(eyeWhites(p)).toBeGreaterThanOrEqual(2 * eyeWhites(key));
  });

  it('then droops: the held pose hangs both tips 3+ rows lower than the key pose, the band no higher than at rest', () => {
    expect(tipEnd(last, LEFT_TIP) - tipEnd(key, LEFT_TIP)).toBeGreaterThanOrEqual(3);
    expect(tipEnd(last, RIGHT_TIP) - tipEnd(key, RIGHT_TIP)).toBeGreaterThanOrEqual(3);
    expect(bandTop(last)).toBeGreaterThanOrEqual(bandTop(key));
  });

  it('ends on the grimace: the eyes squeezed (fewer whites than the key pose), clenched teeth under the mustache', () => {
    expect(eyeWhites(last)).toBeLessThan(eyeWhites(key));
    expect(count(last, isPale, 24, 76, 42, 84)).toBeGreaterThan(count(key, isPale, 24, 76, 42, 84) + 3);
  });

  it('holds the last pose longest, and every frame is a new picture', () => {
    const d = pick.durations;
    expect(d[d.length - 1]).toBe(Math.max(...d));
    for (let i = 1; i < picks.length; i++) {
      let n = 0;
      for (let k = 0; k < W * H; k++) if (picks[i][k] !== picks[i - 1][k]) n++;
      expect(n, `pick#${i}`).toBeGreaterThan(0);
    }
  });
});

describe('DIRK select portrait: the registry', () => {
  it('plays the three strips with the baked timing and gives 1× frames at every density (no dense art)', () => {
    for (const name of ['select-grey', 'select', 'select-pick']) {
      const id = `char/dirk/${name}`;
      const st = SET.strips[name];
      const a = spriteAnim(id);
      expect(a.durations ? [...a.durations] : null, id).toEqual(st.durations);
      expect(a.loop, id).toBe(st.loop);
      expect(hasHiSprite(id, 2), id).toBe(false);
      expect(hasHiSprite(id, 4), id).toBe(false);
      const f1 = getFrames(id, 1);
      for (const d of [2, 4]) {
        const fd = getFrames(id, d);
        expect(fd.length, `${id}@${d}`).toBe(f1.length);
        fd.forEach((f, i) => {
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}#${i}`).toEqual([W, H, 0, 0]);
          expect(f.buf.data, `${id}@${d}#${i}`).toEqual(f1[i].buf.data);
        });
      }
    }
  });
});

const hasPython = spawnSync('python3', ['-c', 'import sys; sys.exit(0)']).status === 0;

describe.skipIf(!hasPython)('DIRK select portrait: the bake (python3)', () => {
  it('is deterministic: --check matches the checked-in file under two PYTHONHASHSEED values', () => {
    for (const seed of ['0', '7']) {
      const r = spawnSync('python3', ['tools/art40/bake.py', 'select-dirk', '--check'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, PYTHONHASHSEED: seed, PYTHONDONTWRITEBYTECODE: '1' },
      });
      expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
      expect(r.stdout).toMatch(/ok select-dirk/);
    }
  }, 300_000);

  it('the frames are the full window: every frame 64 × 120 with a top-left anchor', () => {
    for (const st of Object.values(SET.strips)) for (const f of st.frames) expect([f.w, f.h, f.ox, f.oy]).toEqual([W, H, 0, 0]);
  });
});
