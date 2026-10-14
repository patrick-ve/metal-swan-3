/**
 * 2× art (frame density 2, docs/ARCHITECTURE.md §3) safety checks:
 * (a) geometry: every sprite id with a 2× generator has the same logical geometry at density 1
 *     and 2 (frame count, logical size, anchor, every point); the registry enforces it for
 *     synthetic sprites too (trim, explicit anchors, wrong counts, odd sizes, stray pixels);
 * (b) footprint: a density-2 frame covers exactly its logical rectangle at res 1..6, flipped or
 *     not, with `src` slices (logical px), tints, alpha and additive blending; a 2× frame that is
 *     the 1× frame enlarged draws exactly like the 1× frame;
 * (c) res 1: a density-2 frame draws as its nearest reduction (the top-left pixel of each 2 × 2
 *     block; flips mirror the reduced image), and the upscale filters never touch 2× frames;
 * plus PixelBuffer.blitFrame mixing densities, aligned trim and rotation, and the art-density
 * scoping (runner, generators, attract demo).
 */
import { describe, expect, it } from 'vitest';
import type { Color } from '../../src/engine/color';
import { PixelBuffer, seededRand } from '../../src/engine/pixel';
import { PAL } from '../../src/engine/palette';
import { frameH, frameW, type DrawOpts, type Frame } from '../../src/engine/render';
import { anchorTopLeft, type SubpixelMode } from '../../src/engine/render-common';
import { SoftRenderer } from '../../src/engine/render-soft';
import {
  artDensity,
  clearSpriteCache,
  defineHiSprite,
  defineSprite,
  getFrame,
  getFrames,
  hasHiSprite,
  listHiSprites,
  listSprites,
  preloadSprites,
  setArtDensity,
  setHiArt,
  spriteErrors,
  withArtDensity,
} from '../../src/engine/sprites';
import type { UpscaleMode } from '../../src/engine/upscale';
import { mirrored } from '../../src/game/content/characters/pieces';
import { loadContent } from '../../src/game/content/index';
import { createHeadlessGame } from '../../src/sim/index';

const COLORS: readonly Color[] = [PAL.red[2], PAL.gold[3], PAL.navy[1], PAL.green[2], PAL.snow[3], PAL.sky[2], 0];

/** A w × h buffer of random palette colours (some transparent unless `opaque`). */
function noise(w: number, h: number, seed: number, opaque = false): PixelBuffer {
  const rnd = seededRand(seed);
  const b = new PixelBuffer(w, h);
  const n = opaque ? COLORS.length - 1 : COLORS.length;
  for (let i = 0; i < b.data.length; i++) b.data[i] = COLORS[Math.floor(rnd() * n)] >>> 0;
  return b.touch();
}

function soft(k: number, mode: UpscaleMode = 'pixel', subpixel: SubpixelMode = 'all'): SoftRenderer {
  return new SoftRenderer(48, 40, undefined, { res: k, mode, subpixel });
}

function firstDiff(a: PixelBuffer, b: PixelBuffer): string {
  if (a.w !== b.w || a.h !== b.h) return `size ${a.w}×${a.h} vs ${b.w}×${b.h}`;
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] !== b.data[i]) return `(${i % a.w},${Math.floor(i / a.w)}): ${a.data[i].toString(16)} vs ${b.data[i].toString(16)}`;
  }
  return '';
}

/** Draw options used by the parity checks (positions are fractional on purpose). */
const OPTS: ReadonlyArray<DrawOpts> = [
  {},
  { flipX: true },
  { flipY: true },
  { flipX: true, flipY: true },
  { tint: PAL.red[1] },
  { flash: true, flipX: true },
  { alpha: 0.5 },
  { blend: 'add', flipY: true },
  { src: { x: 1, y: 2, w: 4, h: 3 } },
  { src: { x: 2, y: 0, w: 3, h: 9 }, flipX: true },
  { src: { x: -2, y: 3, w: 30, h: 2 }, flipX: true, flipY: true },
  { screen: true, flipX: true },
];

function geometry(f: Frame): string {
  const pts = f.pts ? JSON.stringify(Object.entries(f.pts).sort()) : '';
  return `${frameW(f)}x${frameH(f)}@${f.ox},${f.oy}${pts}`;
}

describe('(a) 2× frames keep the 1× logical geometry', () => {
  it('every registered sprite id with a 2× generator: same frame count, size, anchor and points', async () => {
    await loadContent();
    const ids = listHiSprites();
    for (const id of ids) {
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      for (let i = 0; i < lo.length; i++) {
        expect(geometry(hi[i]), `${id}[${i}]`).toBe(geometry(lo[i]));
        expect(hi[i].density, `${id}[${i}] density`).toBe(2);
        expect(hi[i].buf.w, `${id}[${i}] buffer`).toBe(frameW(lo[i]) * 2);
      }
    }
    expect(spriteErrors().filter((e) => e.id.endsWith('@2x'))).toEqual([]);
    // Ids without a 2× generator give the very same 1× frames at density 2.
    for (const id of listSprites('fx/').slice(0, 20)) if (!hasHiSprite(id)) expect(getFrames(id, 2)).toBe(getFrames(id, 1));
  }, 120_000);

  it('re-frames 2× frames to the 1× geometry: anchors, points, trim', () => {
    const pts = { muzzle: [4, -6] as const, hand: [-1, -3] as const };
    defineSprite('dens/a', () => [new PixelBuffer(7, 9).rect(1, 2, 4, 5, PAL.red[2]), new PixelBuffer(7, 9).rect(0, 0, 7, 9, PAL.gold[3])], { pts, trim: true });
    defineHiSprite('dens/a', () => [noise(14, 18, 1, true), noise(14, 18, 2, true)]);
    const lo = getFrames('dens/a', 1);
    const hi = getFrames('dens/a', 2);
    expect(lo[0].buf.w).toBe(4); // trimmed
    for (let i = 0; i < 2; i++) {
      expect(geometry(hi[i])).toBe(geometry(lo[i]));
      expect(hi[i].pts).toEqual(pts);
      expect([hi[i].buf.w, hi[i].buf.h]).toEqual([frameW(lo[i]) * 2, frameH(lo[i]) * 2]);
    }
    // Explicit Frames: logical anchors; a 2× frame on a bigger canvas is cut to the 1× rectangle.
    defineSprite('dens/b', () => ({ buf: new PixelBuffer(6, 4).fill(PAL.red[2]), ox: 3, oy: 4 }));
    defineHiSprite('dens/b', () => ({ buf: new PixelBuffer(16, 10).fill(PAL.gold[3]), ox: 5, oy: 5 }));
    const b = getFrame('dens/b', 0, 2);
    expect(geometry(b)).toBe(geometry(getFrame('dens/b', 0, 1)));
    expect(b.buf.countOpaque()).toBe(12 * 8);
  });

  it('a 2× generator that breaks the geometry falls back to the 1× frames and is reported', () => {
    defineSprite('dens/count', () => [new PixelBuffer(4, 4), new PixelBuffer(4, 4)]);
    defineHiSprite('dens/count', () => [new PixelBuffer(8, 8)]);
    defineSprite('dens/odd', () => new PixelBuffer(4, 4));
    defineHiSprite('dens/odd', () => new PixelBuffer(9, 8));
    defineSprite('dens/pts', () => ({ buf: new PixelBuffer(4, 4), ox: 2, oy: 4, pts: { a: [1, 1] } }));
    defineHiSprite('dens/pts', () => ({ buf: new PixelBuffer(8, 8), ox: 2, oy: 4, pts: { a: [1, 2] } }));
    defineSprite('dens/throws', () => new PixelBuffer(4, 4));
    defineHiSprite('dens/throws', () => {
      throw new Error('boom');
    });
    for (const id of ['dens/count', 'dens/odd', 'dens/pts', 'dens/throws']) {
      expect(getFrames(id, 2), id).toBe(getFrames(id, 1));
      expect(spriteErrors().map((e) => e.id), id).toContain(`${id}@2x`);
    }
  });

  it('generators run at density 1; the art density is scoped and restorable; the switch turns 2× off', () => {
    defineSprite('dens/part', () => new PixelBuffer(4, 4).fill(PAL.red[2]));
    defineHiSprite('dens/part', () => new PixelBuffer(8, 8).fill(PAL.red[2]));
    let seen = 0;
    defineSprite('dens/whole', () => {
      seen = getFrame('dens/part', 0).density ?? 1;
      return new PixelBuffer(4, 4);
    });
    expect(artDensity()).toBe(1);
    withArtDensity(2, () => {
      expect(getFrame('dens/part', 0).density).toBe(2);
      getFrames('dens/whole');
      expect(artDensity()).toBe(2);
    });
    expect(seen).toBe(1);
    expect(artDensity()).toBe(1);
    expect(getFrame('dens/part', 0).density).toBeUndefined();
    expect(() => withArtDensity(2, () => {
      throw new Error('x');
    })).toThrow();
    expect(artDensity()).toBe(1);
    expect(setArtDensity(7)).toBe(1);
    expect(artDensity()).toBe(2);
    setArtDensity(1);
    const prev = setHiArt(false);
    expect(getFrame('dens/part', 0, 2).density).toBeUndefined();
    setHiArt(prev);
    expect(getFrame('dens/part', 0, 2).density).toBe(2);
  });

  it('caches 1× and 2× frames separately; preload at density 2 only makes 2× frames', async () => {
    let lo = 0;
    let hi = 0;
    defineSprite('dens/cache', () => {
      lo++;
      return new PixelBuffer(2, 2);
    });
    defineHiSprite('dens/cache', () => {
      hi++;
      return new PixelBuffer(4, 4);
    });
    defineSprite('dens/cache-lo-only', () => {
      lo++;
      return new PixelBuffer(2, 2);
    });
    clearSpriteCache('dens/cache');
    const rep = await preloadSprites('dens/cache', undefined, { density: 2, yieldFn: async () => {} });
    expect(rep.total).toBe(1);
    expect([lo, hi]).toEqual([1, 1]);
    getFrames('dens/cache', 2);
    getFrames('dens/cache', 1);
    expect([lo, hi]).toEqual([1, 1]);
    getFrames('dens/cache-lo-only', 2);
    expect(lo).toBe(2);
  });
});

describe('(b) footprint and parity of density-2 frames at res 1..6', () => {
  const POS: ReadonlyArray<[number, number]> = [
    [20, 30],
    [17.4, 29.6],
    [23.5, 28.25],
  ];

  it('a 2× frame that is the 1× frame enlarged draws exactly like the 1× frame', () => {
    for (let s = 0; s < 4; s++) {
      const lo = noise(5 + s, 9 - s, 10 + s);
      const ox = s;
      const oy = 9 - s;
      const f1: Frame = { buf: lo, ox, oy };
      const f2: Frame = { buf: lo.scaled(2), ox, oy, density: 2 };
      for (let k = 1; k <= 6; k++) {
        for (const o of OPTS) {
          for (const [x, y] of POS) {
            const a = soft(k);
            const b = soft(k);
            for (const r of [a, b]) {
              r.begin(PAL.navy[0]);
              r.setCamera(3.3, -1.7);
            }
            a.frame(f1, x, y, o);
            b.frame(f2, x, y, o);
            expect(firstDiff(a.target, b.target), `k ${k} ${JSON.stringify(o)} at ${x},${y}`).toBe('');
          }
        }
      }
    }
  });

  it('a 2× frame of any content covers exactly its logical rectangle (flips, slices)', () => {
    const lw = 7;
    const lh = 5;
    const f2: Frame = { buf: noise(lw * 2, lh * 2, 99, true), ox: 2, oy: 5, density: 2 };
    const f1: Frame = { buf: new PixelBuffer(lw, lh).fill(PAL.snow[3]), ox: 2, oy: 5 };
    for (let k = 1; k <= 6; k++) {
      for (const o of OPTS) {
        if (o.alpha !== undefined || o.blend) continue;
        const a = soft(k);
        const b = soft(k);
        a.begin(0);
        b.begin(0);
        a.frame(f1, 21.3, 30.7, o);
        b.frame(f2, 21.3, 30.7, o);
        let diff = 0;
        let cover = 0;
        for (let i = 0; i < a.target.data.length; i++) {
          const ca = (a.target.data[i] & 255) !== 0;
          if (ca !== ((b.target.data[i] & 255) !== 0)) diff++;
          if (ca) cover++;
        }
        expect(diff, `k ${k} ${JSON.stringify(o)}`).toBe(0);
        if (!o.src) expect(cover, `k ${k} area`).toBe(lw * lh * k * k);
      }
    }
    // The rectangle itself: anchorTopLeft on the logical size.
    const p = anchorTopLeft({ x: 0, y: 0 }, frameW(f2), frameH(f2), f2.ox, f2.oy, 100, 50, true, false, 3);
    expect(p).toEqual({ x: 100 - (7 - 1 - 2) * 3, y: 50 - 5 * 3 });
  });

  it('with d | k every 2× pixel is an exact (k / 2)-px block', () => {
    const hi = noise(8, 6, 5);
    const f2: Frame = { buf: hi, ox: 0, oy: 0, density: 2 };
    for (const k of [2, 4, 6]) {
      const r = new SoftRenderer(10, 10, undefined, { res: k });
      r.begin(0);
      r.frame(f2, 1, 1, { screen: true });
      const want = new PixelBuffer(10 * k, 10 * k);
      want.blit(hi.scaled(k / 2), k, k);
      expect(firstDiff(r.target, want), `k ${k}`).toBe('');
    }
  });
});

describe('(c) res 1 and the filters', () => {
  it('at res 1 a 2× frame draws as its nearest reduction; flips mirror the reduced image', () => {
    const hi = noise(12, 10, 7);
    const down = hi.downsampled(2);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) expect(down.get(x, y)).toBe(hi.get(2 * x, 2 * y));
    for (const o of OPTS) {
      const a = soft(1);
      const b = soft(1);
      a.begin(PAL.navy[0]);
      b.begin(PAL.navy[0]);
      a.frame({ buf: hi, ox: 3, oy: 5, density: 2 }, 20.4, 30, o);
      b.frame({ buf: down, ox: 3, oy: 5 }, 20.4, 30, o);
      expect(firstDiff(a.target, b.target), JSON.stringify(o)).toBe('');
    }
  });

  it('the upscale filters never touch 2× frames (registered sprites, every mode)', () => {
    defineSprite('dens/filtered', () => noise(6, 6, 3, true), { anchor: 'center' });
    defineHiSprite('dens/filtered', () => noise(12, 12, 4, true));
    for (const mode of ['smooth', 'xbr'] as const) {
      for (const k of [2, 4, 6]) {
        const a = soft(k, mode);
        const b = soft(k, 'pixel');
        for (const r of [a, b]) {
          r.begin(0);
          withArtDensity(2, () => r.sprite('dens/filtered', 0, 20, 20, { flipX: true }));
        }
        expect(firstDiff(a.target, b.target), `${mode} k ${k}`).toBe('');
        // The 1× frame is filtered in that mode (the check above is not vacuous).
        const c = soft(k, mode);
        c.begin(0);
        c.sprite('dens/filtered', 0, 20, 20, { flipX: true });
        const d = soft(k, 'pixel');
        d.begin(0);
        d.sprite('dens/filtered', 0, 20, 20, { flipX: true });
        expect(firstDiff(c.target, d.target), `${mode} k ${k} 1× filtered`).not.toBe('');
      }
    }
  });
});

describe('composing and transforming 2× buffers', () => {
  it('blitFrame: same density exact, 1× into 2× enlarged, 2× into 1× reduced, flips around the anchor', () => {
    const lo = noise(5, 4, 21);
    const hi = noise(10, 8, 22);
    const f1: Frame = { buf: lo, ox: 1, oy: 4 };
    const f2: Frame = { buf: hi, ox: 1, oy: 4, density: 2 };
    for (const flipX of [false, true]) {
      // 2× into a 2× buffer = a plain blit at the anchor's 2× position.
      const a = new PixelBuffer(30, 30).blitFrame(f2, 12, 20, { flipX }, 2);
      const want = new PixelBuffer(30, 30).blit(hi, 12 - (flipX ? 5 - 1 - 1 : 1) * 2, 20 - 8, { flipX });
      expect(firstDiff(a, want), `2→2 flip ${flipX}`).toBe('');
      // 1× into a 2× buffer = the 1× frame enlarged into the same logical place.
      const b = new PixelBuffer(30, 30).blitFrame(f1, 12, 20, { flipX }, 2);
      const wantB = new PixelBuffer(30, 30).blitFrame({ buf: lo.scaled(2), ox: 1, oy: 4, density: 2 }, 12, 20, { flipX }, 2);
      expect(firstDiff(b, wantB), `1→2 flip ${flipX}`).toBe('');
      // 2× into a 1× buffer = the reduction, like the renderers at res 1.
      const c = new PixelBuffer(15, 15).blitFrame(f2, 6, 10, { flipX });
      const wantC = new PixelBuffer(15, 15).blitFrame({ buf: hi.downsampled(2), ox: 1, oy: 4 }, 6, 10, { flipX });
      expect(firstDiff(c, wantC), `2→1 flip ${flipX}`).toBe('');
      // A src rect in the 2× frame's buffer px selects the same logical part after the reduction.
      const d = new PixelBuffer(15, 15).blitFrame(f2, 6, 10, { flipX, sx: 4, sy: 2, sw: 6, sh: 4 });
      const wantD = new PixelBuffer(15, 15).blitFrame({ buf: hi.downsampled(2), ox: 1, oy: 4 }, 6, 10, { flipX, sx: 2, sy: 1, sw: 3, sh: 2 });
      expect(firstDiff(d, wantD), `2→1 src flip ${flipX}`).toBe('');
      expect(d.data.some((v) => (v & 255) !== 0), '2→1 src draws something').toBe(true);
    }
  });

  it('mirrored() of a 2× frame keeps the logical anchor (the 1× mirror, enlarged)', () => {
    const lo = noise(5, 4, 23);
    const m1 = mirrored({ buf: lo, ox: 1, oy: 3, pts: { hand: [2, -1] } });
    const m2 = mirrored({ buf: lo.scaled(2), ox: 1, oy: 3, pts: { hand: [2, -1] }, density: 2 });
    expect(m1.density).toBeUndefined();
    expect([m2.ox, m2.oy, m2.density, m2.pts]).toEqual([m1.ox, m1.oy, 2, m1.pts]);
    expect(firstDiff(m2.buf, m1.buf.scaled(2))).toBe('');
  });

  it('trim of a 2× frame keeps whole logical pixels', () => {
    defineSprite('dens/trim', () => ({ buf: new PixelBuffer(12, 12).rect(3, 5, 3, 4, PAL.red[2]), ox: 3, oy: 6, density: 2 }), { trim: true });
    const f = getFrame('dens/trim', 0, 1);
    expect(f.density).toBe(2);
    // Opaque x 3..5, y 5..8 → box x 2..5, y 4..9 (multiples of 2) → logical (1, 2) 2 × 3.
    expect([f.buf.w, f.buf.h, f.ox, f.oy]).toEqual([4, 6, 2, 4]);
  });

  it('rotated(…, { align: 2 }) keeps a 2× buffer on whole logical pixels', () => {
    const b = new PixelBuffer(10, 6).fill(PAL.red[2]);
    for (let a = 0.1; a < 3; a += 0.37) {
      const r = b.rotated(a, { quality: 'fast', align: 2 });
      expect((r.w - b.w) % 4, `w at ${a}`).toBe(0);
      expect((r.h - b.h) % 4, `h at ${a}`).toBe(0);
    }
  });
});

describe('mission scoping', () => {
  it('the runner draws ams at density 2 and restores 1; logic never sees density 2', async () => {
    let drawn = 0;
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, god: true, bot: true });
    try {
      expect(game.runner?.artDensity).toBe(2);
      game.step(30);
      expect(artDensity()).toBe(1);
      const r = new SoftRenderer();
      const world = game.runner?.world;
      // Every entity draw inside runner.draw sees density 2.
      const orig = world?.draw.bind(world);
      if (world && orig) {
        world.draw = (rr) => {
          drawn = artDensity();
          orig(rr);
        };
      }
      game.runner?.draw(r);
      expect(drawn).toBe(2);
      expect(artDensity()).toBe(1);
    } finally {
      game.dispose();
    }
    const m0 = await createHeadlessGame({ missionId: 'm0', seed: 1, god: true, bot: true });
    try {
      expect(m0.runner?.artDensity).toBe(1);
    } finally {
      m0.dispose();
    }
  }, 60_000);
});
