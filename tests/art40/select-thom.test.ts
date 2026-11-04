/**
 * THOM's select portrait (docs/design/select40.md; tools/art40/chars/select-thom/ on the portrait
 * kit): his traits and his gag, measured on the baked frames. The contract checks every set shares
 * (registration, 64 × 120 top-left frames, timing, densities, the grey state) live in
 * tests/art40/select-portraits.test.ts; this file holds what is THOM's own: the navy cap worn
 * backwards with its brim behind his right ear, the Dutch camo tee, the toothy grin with the
 * squint, the pick reaction (the cap pops off his shaved head with the brim jolting, lands, and the
 * grin turns into a wince) and a deterministic bake.
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { decodeBakedIndices, type BakedSet } from '../../src/engine/baked';
import { SELECT_PICK_TICKS, SET } from '../../src/game/content/art40/select-thom.gen';

const W = 64;
const H = 120;
const ROOT = new URL('../..', import.meta.url).pathname;

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
const luma = ([r, g, b]: Rgb): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Colour classes of THOM's palette (by colour, not by index: a rebake may reorder the palette). */
const isNavy = ([r, , b]: Rgb): boolean => b >= 1.9 * r && b - r >= 20;
/** Eye whites and teeth (warm, pale, little red over green: not the skin's light end, not the sweat). */
const isPale = ([r, g, b]: Rgb): boolean => luma([r, g, b]) > 0.62 && r - g < 22 && r - b < 56 && b <= g;
const isOlive = ([r, g, b]: Rgb): boolean => g > r && g > b + 20;
const isSand = (c: Rgb): boolean => c[0] >= c[1] && c[1] > c[2] + 20 && luma(c) > 0.45 && c[0] - c[2] < 60;
const isBrown = (c: Rgb): boolean => c[0] > c[1] && c[1] > c[2] && c[0] - c[2] >= 25 && luma(c) < 0.4 && c[0] < 140;

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

/** The first row (from the top) with at least 6 navy cap pixels: the top of the cap. */
function capTop(px: readonly Rgb[]): number {
  for (let y = 1; y < H; y++) if (count(px, isNavy, 1, y, W - 1, y + 1) >= 6) return y;
  return -1;
}

/** Pale (eye white) pixels in the eye band; teeth sit lower, in the mouth band. */
const EYES = [2, 40, 52, 60] as const;
const MOUTH = [8, 60, 52, 86] as const;
const eyeWhites = (px: readonly Rgb[]): number => count(px, isPale, ...EYES);
const teeth = (px: readonly Rgb[]): number => count(px, isPale, ...MOUTH);

const pick = SET.strips['select-pick'];
const key = frameOf(SET, 'select', 0);
const picks = pick.frames.map((_, i) => frameOf(SET, 'select-pick', i));
const last = picks[picks.length - 1];

describe('THOM select portrait: traits', () => {
  it('wears the navy cap low on the head: a wide navy dome in the upper third, its top inside the window', () => {
    const top = capTop(key);
    expect(top).toBeGreaterThanOrEqual(2);
    expect(top).toBeLessThanOrEqual(14);
    // The dome is big (the cap covers the head down to the brows) and stays above the eyes.
    expect(count(key, isNavy, 1, 1, W - 1, 40)).toBeGreaterThan(700);
    expect(count(key, isNavy, 1, 62, W - 1, H - 1)).toBeLessThan(10);
  });

  it('shows the backwards brim behind his right ear: navy pixels at the right edge, below the dome', () => {
    expect(count(key, isNavy, 54, 30, W - 1, 56)).toBeGreaterThanOrEqual(12);
  });

  it('wears the Dutch camo tee of the 40 px hero: sand, olive and brown blotches across the bust', () => {
    const area = (W - 2) * 14;
    const rows = [1, 104, W - 1, 118] as const;
    expect(count(key, isOlive, ...rows) / area).toBeGreaterThan(0.1);
    expect(count(key, isSand, ...rows) / area).toBeGreaterThan(0.1);
    expect(count(key, isBrown, ...rows) / area).toBeGreaterThan(0.05);
  });

  it('grins with his upper teeth bared under a squint (few eye whites, many teeth)', () => {
    expect(teeth(key)).toBeGreaterThanOrEqual(30);
    expect(eyeWhites(key)).toBeGreaterThanOrEqual(4);
    expect(eyeWhites(key)).toBeLessThan(teeth(key) / 2);
  });

  it('blinks in the lit loop: one frame shows no more eye white than half the key pose', () => {
    const loop = SET.strips.select.frames.map((_, i) => eyeWhites(frameOf(SET, 'select', i)));
    expect(Math.min(...loop)).toBeLessThanOrEqual(eyeWhites(key) / 2);
    // The cap stays put in the loop (a breath moves it one pixel at most).
    for (let i = 0; i < loop.length; i++) expect(Math.abs(capTop(frameOf(SET, 'select', i)) - capTop(key)), `select#${i}`).toBeLessThanOrEqual(1);
  });
});

describe('THOM select portrait: the pick reaction', () => {
  it('runs once in the contract time and exports its length', () => {
    expect(pick.loop).toBe(false);
    const total = pick.durations.reduce((a, b) => a + b, 0);
    expect(SELECT_PICK_TICKS).toBe(total);
    expect(total).toBeGreaterThanOrEqual(24);
    expect(total).toBeLessThanOrEqual(40);
  });

  it('pops the cap off his head: it jumps at least 4 px early in the pick, then lands again', () => {
    const tops = picks.map(capTop);
    const k = capTop(key);
    const jump = tops.findIndex((t) => t <= k - 4);
    expect(jump, `cap tops ${tops.join(',')} (key ${k})`).toBeGreaterThan(0);
    expect(jump).toBeLessThanOrEqual(4);
    expect(Math.abs(tops[tops.length - 1] - k)).toBeLessThanOrEqual(2);
  });

  it('jolts the brim: the navy pixels behind the right ear change while the cap is up', () => {
    const region = (px: readonly Rgb[]): string => {
      let s = '';
      for (let y = 20; y < 70; y++) for (let x = 50; x < W - 1; x++) s += isNavy(px[y * W + x]) ? '1' : '0';
      return s;
    };
    const a = region(key);
    const moved = picks.map((p) => {
      const b = region(p);
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
      return n;
    });
    expect(Math.max(...moved)).toBeGreaterThanOrEqual(25);
  });

  it('bulges his eyes at the pop and ends on the wince: eyes squeezed shut, teeth clenched', () => {
    const whites = picks.map(eyeWhites);
    expect(Math.max(...whites)).toBeGreaterThanOrEqual(eyeWhites(key) * 2);
    expect(eyeWhites(last)).toBeLessThanOrEqual(Math.max(1, eyeWhites(key) * 0.4));
    expect(teeth(last)).toBeGreaterThanOrEqual(20);
    // The held wince differs from the key grin in the face, not only in the sweat.
    let n = 0;
    for (let y = 36; y < 92; y++) for (let x = 2; x < 56; x++) if (key[y * W + x].join() !== last[y * W + x].join()) n++;
    expect(n).toBeGreaterThan(300);
  });

  it('holds the last pose longest', () => {
    const d = pick.durations;
    expect(d[d.length - 1]).toBe(Math.max(...d));
  });
});

const hasPython = spawnSync('python3', ['-c', 'import sys; sys.exit(0)']).status === 0;

describe.skipIf(!hasPython)('THOM select portrait: the bake (python3)', () => {
  it('is deterministic: --check matches the checked-in file under two PYTHONHASHSEED values', () => {
    for (const seed of ['0', '7']) {
      const r = spawnSync('python3', ['tools/art40/bake.py', 'select-thom', '--check'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, PYTHONHASHSEED: seed, PYTHONDONTWRITEBYTECODE: '1' },
      });
      expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
      expect(r.stdout).toMatch(/ok select-thom/);
    }
  }, 300_000);

  it('the frames are the full window: every frame 64 × 120', () => {
    for (const st of Object.values(SET.strips)) for (const f of st.frames) expect([f.w, f.h]).toEqual([W, H]);
  });
});
