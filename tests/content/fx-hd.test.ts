/**
 * UHD fx, shots and items (docs/ART_GUIDE.md "UHD art"): every HD id of the cast-fx group has
 * native 2× and 4× art with exactly its 1× frame's geometry, PAL_HD colours only, opaque or
 * empty px, new art (not the 1× or 2× frames scaled), deterministic; the old 2× code is gone;
 * runtime particles draw HD frames in art px at tier ≥ 2 without allocating per tick.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Color } from '../../src/engine/color';
import { inHdPalette, PAL_HD } from '../../src/engine/palette-hd';
import { type ParticlePreset, Particles, SMOKE, SPARK } from '../../src/engine/particles';
import type { Frame } from '../../src/engine/render';
import { Rng } from '../../src/engine/rng';
import { clearSpriteCache, getFrames, hasHiSprite, listHiSprites, listSprites, spriteErrors, withArtDensity } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { RecordingRenderer } from '../engine/helpers';

/** The HD ids of this group (fx, shots, flashes, pickups, the supply crate). */
function hdIds(): string[] {
  const mine = /^(fx\/(explosion-|impact|hit|dust|splash|debris-|poof|confetti|music-note|snore|chute|muzzle)|weapon\/|enemy\/(bullet|grenade)$|item\/(pickup|crate))/;
  return listHiSprites(2).filter((id) => mine.test(id) && id !== 'fx/muzzle-swan-beak-gun');
}

/** Is `hi` (density d) just `lo` scaled by an integer factor? */
function scaledCopy(hi: Frame, lo: Frame, k: number): boolean {
  const s = lo.buf.scaled(k).data;
  return hi.buf.data.length === s.length && hi.buf.data.every((c, i) => c === s[i]);
}

describe('UHD fx, shots and items', () => {
  let ids: string[] = [];
  beforeAll(async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await loadContent();
    ids = hdIds();
    for (const id of ids) {
      getFrames(id, 2);
      getFrames(id, 4);
    }
    warn.mockRestore();
  }, 120_000);

  it('covers every fx / shot / flash / pickup / crate id with 2× art, and each has 4× art too', () => {
    expect(ids.length).toBeGreaterThan(110);
    for (const must of ['fx/explosion-xl', 'fx/muzzle', 'fx/muzzle-shotgun-diag', 'weapon/bullet', 'weapon/rocket', 'item/pickup-weapon/laser', 'item/crate-break', 'fx/chute', 'fx/snore']) {
      expect(ids, must).toContain(must);
    }
    for (const id of ids) expect(hasHiSprite(id, 4), id).toBe(true);
    expect(spriteErrors().filter((e) => ids.some((id) => e.id === `${id}@2x` || e.id === `${id}@4x`))).toEqual([]);
  });

  it('every 2× and 4× frame has the 1× geometry, PAL_HD px only, and is new art (not a scaled copy)', () => {
    for (const id of ids) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}x`).toBe(lo.length);
        let fresh = false;
        for (let i = 0; i < lo.length; i++) {
          const f = hi[i];
          const tag = `${id}@${d}x[${i}]`;
          expect(f.density, tag).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], tag).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, tag).toEqual(lo[i].pts ?? {});
          const bad = f.buf.data.find((c) => (c & 255) !== 0 && ((c & 255) !== 255 || !inHdPalette(c)));
          expect(bad, tag).toBeUndefined();
          if (!scaledCopy(f, lo[i], d)) fresh = true;
        }
        expect(fresh, `${id}@${d}x is the 1× art scaled`).toBe(true);
      }
      // The 4× art is drawn natively, not the 2× frames doubled.
      const h2 = getFrames(id, 2);
      const h4 = getFrames(id, 4);
      expect(h4.some((f, i) => !scaledCopy(f, h2[i], 2)), `${id}@4x is the 2× art doubled`).toBe(true);
    }
  });

  it('has art in every frame that has art at 1× (no empty HD frame)', () => {
    for (const id of ids) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        getFrames(id, d).forEach((f, i) => {
          const any1 = lo[i].buf.data.some((c) => (c & 255) !== 0);
          const anyHd = f.buf.data.some((c) => (c & 255) !== 0);
          if (any1) expect(anyHd, `${id}@${d}x[${i}]`).toBe(true);
        });
      }
    }
  });

  it('is deterministic: the same id makes the same px again', () => {
    for (const id of ['fx/explosion-l', 'fx/muzzle-heavy-diag', 'weapon/homing', 'item/pickup-gem/gem', 'item/crate-break', 'fx/splash']) {
      const before = getFrames(id, 4).map((f) => f.buf.data.slice());
      clearSpriteCache(id);
      const again = getFrames(id, 4);
      again.forEach((f, i) => expect(Buffer.from(f.buf.data.buffer).equals(Buffer.from(before[i].buffer)), `${id}[${i}]`).toBe(true));
    }
  });

  it('flashes start at the muzzle: the anchor of every flash frame touches its art (fwd, up, diag)', () => {
    for (const id of ids.filter((x) => x.startsWith('fx/muzzle') || x.startsWith('weapon/muzzle'))) {
      for (const d of [2, 4] as const) {
        getFrames(id, d).forEach((f, i) => {
          const { w, h, data } = f.buf;
          let near = Infinity;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if ((data[y * w + x] & 255) === 0) continue;
              near = Math.min(near, Math.hypot((x + 0.5) / d - f.ox - 0.5, (y + 0.5) / d - f.oy - 0.5));
            }
          }
          expect(near, `${id}@${d}x[${i}]`).toBeLessThan(2.5);
        });
      }
    }
  });
});

describe('UHD fx: clean clusters (verifier, cast)', () => {
  beforeAll(async () => {
    await loadContent();
  });

  it('dying explosion smoke erodes into solid wisps: no lone tone px walled in by outline px (no ink mesh)', () => {
    // An ordered fray under outline A filled every small hole with ink: black balls with a grid of
    // grey dots at 4×. A smoke tone px whose 4 neighbours are all outline px is such a dot.
    const rim = new Set([PAL_HD.ink[0] >>> 0, PAL_HD.stone[0] >>> 0, PAL_HD.fire[0] >>> 0]);
    for (const id of ['fx/explosion-s', 'fx/explosion-m', 'fx/explosion-l', 'fx/explosion-xl']) {
      for (const d of [2, 4]) {
        getFrames(id, d).forEach((f, i) => {
          const { w, h, data } = f.buf;
          const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && rim.has(data[y * w + x] >>> 0);
          let n = 0;
          let walled = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const c = data[y * w + x];
              if ((c & 255) === 0 || rim.has(c >>> 0)) continue;
              n++;
              if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) walled++;
            }
          }
          expect(walled, `${id}@${d}x[${i}]: ${walled} of ${n}`).toBeLessThanOrEqual(Math.max(1, n * 0.005));
        });
      }
    }
  });

  it('the ragged rim of the flame stays on it (no rim px floating off the silhouette)', () => {
    for (const d of [2, 4]) {
      getFrames('weapon/flame', d).forEach((f, i) => {
        const { w, data } = f.buf;
        const ink = i >> 1 < 2 ? PAL_HD.fire[3] : PAL_HD.fire[1];
        // Flood the rim colour from the px that touch the body; every rim px must be reached.
        const seen = new Uint8Array(data.length);
        const stack: number[] = [];
        const body = (q: number): boolean => data[q] !== 0 && data[q] !== ink;
        for (let p = 0; p < data.length; p++) {
          if (data[p] !== ink) continue;
          const x = p % w;
          if ((x > 0 && body(p - 1)) || (x < w - 1 && body(p + 1)) || (p >= w && body(p - w)) || (p + w < data.length && body(p + w))) {
            seen[p] = 1;
            stack.push(p);
          }
        }
        while (stack.length) {
          const p = stack.pop() as number;
          const x = p % w;
          for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
            if (q < 0 || q >= data.length || seen[q] || data[q] !== ink) continue;
            seen[q] = 1;
            stack.push(q);
          }
        }
        let floating = 0;
        for (let p = 0; p < data.length; p++) if (data[p] === ink && !seen[p]) floating++;
        expect(floating, `weapon/flame@${d}x[${i}]`).toBe(0);
      });
    }
  });
});

describe('UHD: old 2× code retired', () => {
  it('the fx, shot and item art registers HD generators only (no hand 2× twins left)', () => {
    const files = [
      'src/game/content/fx/art.ts',
      'src/game/content/fx/chute.art.ts',
      'src/game/content/fx/explosion.art.ts',
      'src/game/content/fx/snore.art.ts',
      'src/game/content/weapons/art.ts',
      'src/game/content/weapons/shots.art.ts',
      'src/game/content/items/pickups.art.ts',
      'src/game/content/items/pickups-hi.art.ts',
      'src/game/content/items/crate.art.ts',
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/defineHiSprite\(|\bhi: \(|from '\.\.\/\.\.\/art\/hi'|\basHi\(|\bHiPen\b|\boutlineHi\(/);
    }
    expect(listSprites('fx/').length).toBeGreaterThan(40);
  });
});

/** A recording renderer with a 4K backbuffer (res 8). */
class Rec8 extends RecordingRenderer {
  constructor() {
    super();
    // The base pins res to the literal 1; this test needs the 4K backbuffer scale.
    (this as unknown as { res: number }).res = 8;
  }
}

describe('UHD particles', () => {
  const run = (d: number): { r: Rec8; p: Particles } => {
    const p = new Particles(64, new Rng(3));
    const GLOW: ParticlePreset = { ...SPARK };
    p.burst(GLOW, 100, 100, 6, 1, 2);
    p.smoke(120, 110, 4);
    p.emit({ kind: 'rect', w: 2, h: 2, life: 30, colors: [0x8a8070ff] }, 140, 120, 0.3, -1);
    p.update();
    const r = new Rec8();
    withArtDensity(d, () => p.draw(r));
    return { r, p };
  };

  it('draws HD frames in art px at tier ≥ 2 (sparks with a streak), flat rects at 1×', () => {
    const lo = run(1).r;
    expect(lo.count('rect')).toBeGreaterThan(0);
    expect(lo.count('frame')).toBe(0);
    const hi = run(4).r;
    expect(hi.count('rect')).toBe(0);
    const frames = hi.calls.filter((c) => c.op === 'frame');
    expect(frames.length).toBeGreaterThan(11);
    for (const c of frames) {
      const f = c.args[0] as Frame;
      expect(f.density).toBe(4);
      // Positions snap to art px (¼ logical px).
      expect(((c.args[1] as number) * 4) % 1).toBe(0);
      expect(((c.args[2] as number) * 4) % 1).toBe(0);
      for (const px of f.buf.data) if ((px & 255) !== 0) expect(inHdPalette(px as Color)).toBe(true);
    }
  });

  it('builds each HD particle frame once (no per-tick allocation after warm-up)', () => {
    const a = run(4).r.calls.filter((c) => c.op === 'frame').map((c) => c.args[0]);
    const b = run(4).r.calls.filter((c) => c.op === 'frame').map((c) => c.args[0]);
    expect(b.length).toBe(a.length);
    b.forEach((f, i) => expect(f).toBe(a[i]));
  });

  it('keeps the smoke translucent (colour alpha times fade) and the built-in presets drawable', () => {
    const { r } = run(2);
    const smoke = r.calls.filter((c) => c.op === 'frame' && (c.args[3] as { blend?: string }).blend === 'normal');
    expect(smoke.length).toBeGreaterThan(0);
    for (const c of smoke) expect((c.args[3] as { alpha: number }).alpha).toBeLessThanOrEqual(1);
    expect(SMOKE.colors?.length).toBeGreaterThan(0);
  });
});
