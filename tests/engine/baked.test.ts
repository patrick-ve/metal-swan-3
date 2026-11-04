import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  bakedStreamValues,
  bakedPalette,
  bakedSetIds,
  decodeBakedFrame,
  decodeBakedIndices,
  defineBakedSet,
  encodeBakedIndices,
  PX_ALPHABET,
  type BakedFrame,
  type BakedSet,
} from '../../src/engine/baked';
import {
  defineDenseAlias,
  defineHiSprite,
  defineSprite,
  getFrames,
  hasHiSprite,
  isDeferredSprite,
  listSprites,
  spriteAnim,
  spriteErrors,
} from '../../src/engine/sprites';
import { PixelBuffer } from '../../src/engine/pixel';
import { SET, SWING_HIT } from '../fixtures/art40/_probe.gen';

/** The Python render of the probe (tools/art40/bake.py writes it next to the generated file). */
interface RenderFrame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  rows: string[];
  pts: Record<string, [number, number]>;
}
interface Render {
  slug: string;
  pal: Record<string, string>;
  variants: Record<string, Record<string, string>>;
  strips: Record<string, RenderFrame[]>;
}
const RENDER = JSON.parse(readFileSync(new URL('../fixtures/art40/_probe.render.json', import.meta.url), 'utf8')) as Render;

/** A deep copy of a set under another prefix (variants renamed too), so each test registers fresh ids. */
function copyAs(set: BakedSet, prefix: string): BakedSet {
  const c = JSON.parse(JSON.stringify(set)) as BakedSet;
  c.prefix = prefix;
  if (c.variants) {
    c.variants = Object.fromEntries(Object.entries(c.variants).map(([k, v]) => [k.replace(set.prefix, prefix), v]));
  }
  return c;
}

function packed(hex: string): number {
  return ((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0;
}

/** The colours the Python render says, as packed pixels (row-major). */
function expected(f: RenderFrame, pal: Record<string, string>): number[] {
  const out: number[] = [];
  for (const r of f.rows) for (const ch of r) out.push(ch === '.' ? 0 : packed(pal[ch]));
  return out;
}

describe('baked sets: the format', () => {
  it('the pixel stream: 91 printable characters without a quote or backslash, values by position', () => {
    expect(PX_ALPHABET.length).toBe(91);
    expect(PX_ALPHABET).not.toMatch(/["\\\s]/);
    expect(PX_ALPHABET[0]).toBe('#');
    expect(PX_ALPHABET[90]).toBe('~');
    expect(Array.from(bakedStreamValues('#$~}'))).toEqual([0, 1, 90, 89]);
    expect(() => bakedStreamValues('#\\')).toThrow(/bad pixel stream character at 1/);
    expect(() => bakedStreamValues('#')).toThrow(/odd length/);
    // long runs split at 91; indices above 90 do not fit
    const idx = [...new Array<number>(200).fill(3), 1];
    expect(encodeBakedIndices(idx)).toBe(`~&~&4&#$`);
    expect(() => encodeBakedIndices([91])).toThrow(/outside/);
  });

  it('reads run-length pairs into indices and rejects broken data', () => {
    const f: BakedFrame = { w: 3, h: 2, ox: 1, oy: 2, px: encodeBakedIndices([0, 0, 5, 5, 5, 1]) };
    expect(f.px).toBe('$#%(#$');
    expect(Array.from(decodeBakedIndices(f))).toEqual([0, 0, 5, 5, 5, 1]);
    expect(() => decodeBakedIndices({ ...f, px: '$#' })).toThrow(/2 pixels/);
    expect(() => decodeBakedIndices({ ...f, px: '+#' })).toThrow(/overflows/);
    const pal = bakedPalette(['#000000', '#102030', '#ffffff']);
    expect(pal[0]).toBe(0);
    expect(pal[1]).toBe(0x102030ff);
    expect(() => decodeBakedFrame({ ...f, px: '(&' }, pal)).toThrow(/palette index 3/);
    expect(() => decodeBakedFrame({ ...f, px: '(\\' }, pal)).toThrow(/bad pixel stream character/);
    expect(() => bakedPalette(['#000000', 'red'])).toThrow(/#rrggbb/);
  });

  it('the generated file carries the events as named constants', () => {
    expect(SWING_HIT).toBe(1);
    expect(SET.events).toEqual({ SWING_HIT: 1 });
    expect(SET.slug).toBe('_probe');
    expect(SET.v).toBe(2);
    expect(SET.face).toBe(1);
    expect(SET.strips.swing.face).toBe(-1);
    expect(SET.budget).toBe(28);
    expect(SET.pal[0]).toBe('#000000');
    expect(SET.outline).toBeGreaterThan(0);
    expect(SET.strips.swing.frames.filter((f) => f.smear).length).toBe(1);
    expect(SET.strips.swing.cls).toBe('melee');
    expect(SET.strips.swing.why).toMatch(/probe/);
  });
});

describe('defineBakedSet', () => {
  it('round trip: the decoded pixels, anchors and points equal the Python render', () => {
    const set = copyAs(SET, 'test/rt');
    const ids = defineBakedSet(set);
    expect(ids).toEqual(['test/rt/idle', 'test/rt/swing', 'test/rt-b/idle', 'test/rt-b/swing']);
    expect(Object.keys(RENDER.strips)).toEqual(Object.keys(SET.strips));
    for (const [prefix, pal] of [['test/rt', RENDER.pal], ['test/rt-b', RENDER.variants['test/_probe-b']]] as const) {
      for (const [name, frames] of Object.entries(RENDER.strips)) {
        const got = getFrames(`${prefix}/${name}`, 1);
        expect(got.length).toBe(frames.length);
        frames.forEach((f, i) => {
          const g = got[i];
          expect([g.buf.w, g.buf.h, g.ox, g.oy]).toEqual([f.w, f.h, f.ox, f.oy]);
          expect(Array.from(g.buf.data)).toEqual(expected(f, pal));
          expect(g.pts ?? {}).toEqual(f.pts);
        });
      }
    }
    expect(spriteErrors()).toEqual([]);
  });

  it('variants are the same pixels in another palette', () => {
    defineBakedSet(copyAs(SET, 'test/var'));
    const a = getFrames('test/var/swing', 1);
    const b = getFrames('test/var-b/swing', 1);
    const pa = bakedPalette(SET.pal);
    const pb = bakedPalette(SET.variants!['test/_probe-b']);
    const idxOf = (pal: Uint32Array, c: number): number => (c === 0 ? 0 : pal.indexOf(c));
    let differ = 0;
    a.forEach((f, i) => {
      expect([f.buf.w, f.buf.h, f.ox, f.oy]).toEqual([b[i].buf.w, b[i].buf.h, b[i].ox, b[i].oy]);
      expect(b[i].pts).toEqual(f.pts);
      for (let k = 0; k < f.buf.data.length; k++) {
        const ia = idxOf(pa, f.buf.data[k]);
        expect(pb[ia]).toBe(b[i].buf.data[k]);
        if (f.buf.data[k] !== b[i].buf.data[k]) differ++;
      }
    });
    expect(differ).toBeGreaterThan(0);
    expect(a[0].buf).not.toBe(b[0].buf);
  });

  it('decodes lazily: nothing at registration, a strip on its first getFrames, once', () => {
    const set = copyAs(SET, 'test/lazy');
    let reads = 0;
    for (const st of Object.values(set.strips)) {
      for (const f of st.frames) {
        const px = f.px;
        Object.defineProperty(f, 'px', {
          get: () => {
            reads++;
            return px;
          },
        });
      }
    }
    defineBakedSet(set);
    expect(reads).toBe(0);
    getFrames('test/lazy/idle', 1);
    expect(reads).toBe(2);
    getFrames('test/lazy/idle', 4);
    expect(reads).toBe(2);
    getFrames('test/lazy-b/idle', 1);
    expect(reads).toBe(4);
    getFrames('test/lazy/swing', 1);
    expect(reads).toBe(7);
  });

  it('a broken frame fails on first use (placeholder + spriteErrors), not at registration', () => {
    const set = copyAs(SET, 'test/broken');
    set.strips.idle.frames[1] = { ...set.strips.idle.frames[1], px: '$$' };
    expect(() => defineBakedSet(set)).not.toThrow();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = getFrames('test/broken/idle', 1);
    warn.mockRestore();
    expect(f.length).toBe(1);
    expect(spriteErrors().map((e) => e.id)).toContain('test/broken/idle');
  });

  it('keeps durations, loop and defer; points and events read as in the set', () => {
    defineBakedSet(copyAs(SET, 'test/anim'));
    expect(spriteAnim('test/anim/idle')).toEqual({ ticksPerFrame: 6, durations: [20, 12], loop: true });
    expect(spriteAnim('test/anim/swing')).toEqual({ ticksPerFrame: 6, durations: [3, 2, 6], loop: false });
    expect(spriteAnim('test/anim-b/swing').durations).toEqual([3, 2, 6]);
    expect(isDeferredSprite('test/anim/swing')).toBe(true);
    expect(isDeferredSprite('test/anim/idle')).toBe(false);
    const swing = getFrames('test/anim/swing', 1);
    expect(swing.every((f) => f.pts?.hand !== undefined)).toBe(true);
    // the strip is drawn facing left (face -1): the hand point lies left of the anchor
    expect(swing[SWING_HIT].pts?.hand[0]).toBeLessThan(0);
  });

  it('registers no dense art: getFrames at d 2 and 4 returns the 1x frames', () => {
    const ids = defineBakedSet(copyAs(SET, 'test/dense'));
    for (const id of ids) {
      expect(hasHiSprite(id, 2)).toBe(false);
      expect(hasHiSprite(id, 4)).toBe(false);
      const one = getFrames(id, 1);
      expect(getFrames(id, 2)).toBe(one);
      expect(getFrames(id, 4)).toBe(one);
      expect(one.every((f) => (f.density ?? 1) === 1)).toBe(true);
    }
  });

  it('only: registers the listed strips or ids', () => {
    expect(defineBakedSet(copyAs(SET, 'test/only'), { only: ['idle'] })).toEqual(['test/only/idle', 'test/only-b/idle']);
    expect(listSprites('test/only')).toEqual(['test/only-b/idle', 'test/only/idle']);
    expect(defineBakedSet(copyAs(SET, 'test/only2'), { only: ['test/only2-b/swing'] })).toEqual(['test/only2-b/swing']);
    expect(bakedSetIds(SET, { only: [] })).toEqual([]);
  });

  it('a duplicate id is an error and registers nothing', () => {
    const set = copyAs(SET, 'test/dup');
    defineBakedSet(set);
    expect(() => defineBakedSet(set)).toThrow(/already registered.*rule 8/);
    defineSprite('test/dup2/swing', () => new PixelBuffer(1, 1));
    expect(() => defineBakedSet(copyAs(SET, 'test/dup2'))).toThrow(/test\/dup2\/swing already registered/);
    expect(listSprites('test/dup2')).toEqual(['test/dup2/swing']);
    defineHiSprite('test/dup3-b/idle', () => new PixelBuffer(2, 2));
    expect(() => defineBakedSet(copyAs(SET, 'test/dup3'))).toThrow(/test\/dup3-b\/idle/);
    // a dense alias whose target has no dense art yet still takes the id (it would show the
    // target's dense frames once they exist: plan rule 7)
    defineDenseAlias('test/dup4/swing', 'test/dup4-target/swing');
    expect(hasHiSprite('test/dup4/swing', 4)).toBe(false);
    expect(() => defineBakedSet(copyAs(SET, 'test/dup4'))).toThrow(/test\/dup4\/swing already registered/);
    expect(listSprites('test/dup4')).toEqual([]);
  });

  it('rejects a set that breaks the format', () => {
    const bad = copyAs(SET, 'test/bad');
    bad.strips.idle.durations = [1];
    expect(() => defineBakedSet(bad)).toThrow(/1 durations for 2 frames/);
    const badVar = copyAs(SET, 'test/badvar');
    badVar.variants!['test/badvar-b'] = ['#000000'];
    expect(() => defineBakedSet(badVar)).toThrow(/variant/);
    expect(listSprites('test/bad')).toEqual([]);
    const self = copyAs(SET, 'test/self');
    self.variants = { 'test/self': [...SET.pal] };
    expect(() => defineBakedSet(self)).toThrow(/variant "test\/self" is the set's own prefix/);
    expect(listSprites('test/self')).toEqual([]);
    const old = copyAs(SET, 'test/oldv') as unknown as { v: number };
    old.v = 1;
    expect(() => defineBakedSet(old as unknown as BakedSet)).toThrow(/format v1, this engine reads v2/);
    const wide = copyAs(SET, 'test/wide');
    wide.pal = Array.from({ length: 92 }, () => '#102030');
    wide.variants = {};
    expect(() => defineBakedSet(wide)).toThrow(/92 palette entries/);
  });

  it('decode cost: about 2,300 frames (every ams cast frame at the reference counts) decode inside the mission start budget', () => {
    // A synthetic set the size of every ams character together (rows of 3-6 px runs, 44 x 46).
    const rnd = (() => {
      let s = 12345;
      return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
    })();
    const frames: BakedFrame[] = [];
    for (let k = 0; k < 2300; k++) {
      const w = 44;
      const h = 46;
      const idx: number[] = [];
      while (idx.length < w * h) {
        const run = Math.min(w * h - idx.length, 3 + Math.floor(rnd() * 4));
        const v = Math.floor(rnd() * 28);
        for (let j = 0; j < run; j++) idx.push(v);
      }
      frames.push({ w, h, ox: 22, oy: 46, px: encodeBakedIndices(idx) });
    }
    const pal = ['#000000', ...Array.from({ length: 28 }, (_, i) => `#${(i * 9).toString(16).padStart(2, '0')}3040`)];
    const set: BakedSet = { v: 2, slug: 'bench', prefix: 'test/bench', budget: 28, pal, outline: 1, strips: { all: { frames, durations: frames.map(() => 2), loop: true } } };
    defineBakedSet(set);
    const t0 = performance.now();
    const got = getFrames('test/bench/all', 1);
    const ms = performance.now() - t0;
    expect(got.length).toBe(2300);
    // The plan budget is 50 ms per mission start (measured about 25 ms alone, docs/api/media.md
    // "Baked sets"); the bound leaves room for a loaded test machine (the suite runs in parallel).
    expect(ms).toBeLessThan(150);
  });
});
