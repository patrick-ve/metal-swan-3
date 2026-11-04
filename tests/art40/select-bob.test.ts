/**
 * BOB's select portrait (docs/design/select40.md; tools/art40/chars/select-bob/ on the portrait kit):
 * the traits and the gag that make the 64 × 120 portrait his, on top of the shared contract tests
 * (tests/art40/select-portraits.test.ts). Captain Climate's costume of the 40 px hero (the
 * leaf-green suit with the white leaf, the white flag cape with blue stripes and the blue star), blue
 * eyes, tousled brown hair on top, and the pick reaction's signature gag: the cape snaps up behind
 * his shoulders while the eyes bulge and the sweat bursts. One rig: the grey, lit and pick states
 * share the face and the framing. The bake is deterministic.
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { decodeBakedIndices } from '../../src/engine/baked';
import { SELECT_PICK_TICKS, SET } from '../../src/game/content/art40/select-bob.gen';

const W = 64;
const H = 120;

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
/** Hue (0-360), saturation (0-1) and value (0-1) of a palette colour. */
const hsv = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [(h + 360) % 360, mx === 0 ? 0 : d / mx, mx];
};

type Kind = (hex: string) => boolean;
const isBlue: Kind = (c) => {
  const [h, s, v] = hsv(c);
  return h >= 205 && h <= 235 && s > 0.45 && v > 0.25;
};
const isGreen: Kind = (c) => {
  const [h, s] = hsv(c);
  return h >= 95 && h <= 150 && s > 0.4;
};
/** The cape's white ramp (white to cool steel in its folds and shade; the leaf on the chest uses it too). */
const CAPE = ['#464c62', '#7a8298', '#b2b9cb', '#e6e9ec'];
const isCape: Kind = (c) => CAPE.includes(c.toLowerCase());
const isBrownHair: Kind = (c) => {
  const [h, s, v] = hsv(c);
  return h >= 15 && h <= 35 && s > 0.5 && v > 0.15 && v < 0.8;
};
const isSweat = (c: string): boolean => c.toLowerCase() === '#a8d4e6';
const isEyeWhite: Kind = (c) => ['#c7b8a6', '#ece2cf', '#8f7c74'].includes(c.toLowerCase());

const frame = (strip: string, i: number): Uint8Array => decodeBakedIndices(SET.strips[strip].frames[i]);
/** Pixels of a kind inside a box (x0, y0 inclusive; x1, y1 exclusive). */
const count = (idx: Uint8Array, kind: Kind, x0 = 0, y0 = 0, x1 = W, y1 = H): number => {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (kind(SET.pal[idx[y * W + x]])) n++;
  return n;
};
/** The top-most row that holds a pixel of a kind inside the side columns (both frame sides). */
const topRowAtSides = (idx: Uint8Array, kind: Kind, side = 12): number => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x < side || x >= W - side) && kind(SET.pal[idx[y * W + x]])) return y;
  return H;
};

const pick = SET.strips['select-pick'];
const loop = SET.strips.select;
const last = pick.frames.length - 1;

describe('select-bob: the set', () => {
  it('is BOB on the char/bob prefix, 64 colours, the three strips, the pick time exported', () => {
    expect(SET.slug).toBe('select-bob');
    expect(SET.prefix).toBe('char/bob');
    expect(SET.budget).toBe(64);
    expect(Object.keys(SET.strips).sort()).toEqual(['select', 'select-grey', 'select-pick']);
    expect(new Set(SET.pal.slice(1).map((c) => c.toLowerCase())).size).toBeLessThanOrEqual(64);
    expect(SELECT_PICK_TICKS).toBe(pick.durations.reduce((a, b) => a + b, 0));
    expect(SELECT_PICK_TICKS).toBeGreaterThanOrEqual(24);
    expect(SELECT_PICK_TICKS).toBeLessThanOrEqual(40);
    expect(SET.strips['select-grey'].frames.length).toBe(1);
    expect(loop.frames.length).toBe(9);
    expect(pick.frames.length).toBe(10);
  });
});

describe('select-bob: his look in every lit frame', () => {
  const lit = [...loop.frames.map((_, i) => ['select', i] as const), ...pick.frames.map((_, i) => ['select-pick', i] as const)];

  it.each(lit)('%s #%i: blue eyes, brown hair on top, the green suit with the white leaf', (strip, i) => {
    const f = frame(strip, i);
    // Blue irises in the eye band (both eyes: left and right half), unless the lids are closed.
    const closed = strip === 'select' && i === 3;
    if (!closed) {
      expect(count(f, isBlue, 8, 38, 32, 58), 'left iris').toBeGreaterThanOrEqual(3);
      expect(count(f, isBlue, 32, 38, 56, 58), 'right iris').toBeGreaterThanOrEqual(3);
    }
    // The tousled brown hair fills the top of the window.
    expect(count(f, isBrownHair, 8, 4, 56, 26)).toBeGreaterThan(0.45 * 48 * 22);
    // The leaf-green suit fills the bottom rows.
    expect(count(f, isGreen, 0, 108, W, H - 1)).toBeGreaterThan(0.6 * W * 11);
    // The white leaf on the chest (the viewer's right of the centre).
    expect(count(f, isCape, 34, 104, 52, 120)).toBeGreaterThanOrEqual(15);
  });

  it('the grey state holds none of his colours: no blue, no green, no warm hair', () => {
    const g = frame('select-grey', 0);
    expect(count(g, isBlue)).toBe(0);
    expect(count(g, isGreen)).toBe(0);
    expect(count(g, isBrownHair)).toBe(0);
  });
});

describe('select-bob: the gag - the cape snaps up behind his shoulders', () => {
  it('in the loop the cape stays down at the shoulders (only a white edge with the blue stripes)', () => {
    loop.frames.forEach((_, i) => {
      const f = frame('select', i);
      expect(topRowAtSides(f, isCape), `loop #${i}`).toBeGreaterThanOrEqual(88);
      expect(count(f, isCape, 0, 0, W, 88), `loop #${i}`).toBe(0);
      expect(count(f, isBlue, 0, 90, W, 112), `loop #${i} stripes`).toBeGreaterThan(10);
    });
  });

  it('in the pick it rises to cheek height beside the head, with its stripes and the blue star', () => {
    const top = pick.frames.map((_, i) => topRowAtSides(frame('select-pick', i), isCape));
    // It starts down (the brave chin-up), snaps up within a few frames and stays up to the held end.
    expect(top[0]).toBeGreaterThanOrEqual(88);
    const up = top.findIndex((t) => t < 62);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThanOrEqual(3);
    for (let i = up; i <= last; i++) expect(top[i], `pick #${i}`).toBeLessThan(66);
    const end = frame('select-pick', last);
    // A large white area beside the head and the neck (both sides) ...
    expect(count(end, isCape, 0, 40, 14, 88)).toBeGreaterThan(150);
    expect(count(end, isCape, 50, 40, W, 88)).toBeGreaterThan(100);
    expect(count(frame('select-pick', 0), isCape, 0, 40, W, 88)).toBe(0);
    // ... carrying the flag motif: blue stripes on both halves and the star on the viewer's left.
    expect(count(end, isBlue, 0, 50, 14, 104)).toBeGreaterThan(25);
    expect(count(end, isBlue, 50, 50, W, 104)).toBeGreaterThan(15);
    expect(count(end, isBlue, 1, 74, 13, 88)).toBeGreaterThanOrEqual(14);
  });

  it('the cape flutters while it is up: the held frames differ beside the head', () => {
    let differ = 0;
    for (let i = 5; i <= last; i++) {
      const a = frame('select-pick', i - 1);
      const b = frame('select-pick', i);
      let n = 0;
      // Only the cape's own columns at the frame's sides, under the ears and over the shoulders.
      for (let y = 68; y < 90; y++) for (const x of [1, 2, 3, 4, 59, 60, 61, 62]) if (a[y * W + x] !== b[y * W + x]) n++;
      if (n > 10) differ++;
    }
    expect(differ).toBeGreaterThanOrEqual(3);
  });
});

describe('select-bob: the miserable reaction', () => {
  it('the eyes bulge (more eye white than the key pose), then squeeze in the held grimace; the sweat bursts off the head', () => {
    const key = frame('select', 0);
    const whites = (f: Uint8Array): number => count(f, isEyeWhite, 8, 36, 56, 60);
    const bulge = pick.frames.map((_, i) => whites(frame('select-pick', i)));
    expect(Math.max(...bulge)).toBeGreaterThan(whites(key) * 1.3);
    // The held end is the pained grimace: the eyes squeezed (less white than the key pose).
    expect(bulge[last]).toBeLessThan(whites(key) * 0.8);
    // Flying drops (the light-blue sweat body) only in the burst, never in the loop.
    const drops = pick.frames.map((_, i) => count(frame('select-pick', i), isSweat));
    expect(Math.max(...drops)).toBeGreaterThanOrEqual(3);
    loop.frames.forEach((_, i) => expect(count(frame('select', i), isSweat), `loop #${i}`).toBe(0));
  });

  it('one rig: the face and the framing stay put between the key pose, the grey state and the held pick', () => {
    // The outline pixels of the face's lower half (eyes to chin, centre columns) mostly agree.
    const key = frame('select', 0);
    const grey = frame('select-grey', 0);
    const same = (a: Uint8Array, b: Uint8Array, x0: number, y0: number, x1: number, y1: number): number => {
      let n = 0;
      let k = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const ia = a[y * W + x] === SET.outline;
          const ib = b[y * W + x] === SET.outline;
          if (ia || ib) {
            k++;
            if (ia && ib) n++;
          }
        }
      return k ? n / k : 1;
    };
    // The jaw and cheek outline (rows 60-100) of the grey state is the lit key pose's.
    expect(same(key, grey, 0, 60, W, 100)).toBeGreaterThan(0.6);
    // The hair's silhouette barely moves between the key pose and the held pick (one head).
    expect(same(key, frame('select-pick', last), 0, 0, W, 30)).toBeGreaterThan(0.25);
  });
});

describe('select-bob: the bake', () => {
  it('is deterministic: the baked file matches a fresh bake (also with another hash seed)', () => {
    const r = spawnSync('python3', ['tools/art40/bake.py', 'select-bob', '--check'], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONHASHSEED: '11' },
      timeout: 240_000,
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/ok select-bob/);
  }, 260_000);
});
