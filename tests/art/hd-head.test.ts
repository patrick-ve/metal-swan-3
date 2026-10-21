/**
 * UHD heads (src/game/art/hd/head.ts): `renderHeadHd(s, expr, d)` for every hair style, headgear,
 * face extra and expression at 2× and 4× — the rig contract (size, layout points, silhouette of the
 * 1× head), determinism, the HD palette, the hat slip and cut-off, `glint: false`, and the squad's
 * likeness cues.
 */
import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/engine/palette';
import { PAL_HD, inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { clearHeadHdCache, renderHeadHd } from '../../src/game/art/hd/head';
import {
  HEAD_CENTER,
  HEAD_H,
  HEAD_W,
  NECK,
  renderHead,
  type Expression,
  type FaceExtra,
  type HairStyle,
  type Headgear,
  type HeadStyle,
} from '../../src/game/art/humanoid-head';
import { HERO_STYLES } from '../../src/game/content/characters/art';
import type { HumanStyle } from '../../src/game/art/humanoid';
import type { Ramp } from '../../src/engine/palette';

const DS = [2, 4] as const;
const HAIRS: HairStyle[] = ['short', 'buzz', 'spiky', 'mohawk', 'bald', 'long', 'ponytail', 'bob', 'parted', 'curly', 'puffs', 'tufts', 'short-crop', 'slick-back', 'spiky-messy', 'swept-up'];
const GEARS: Headgear[] = ['none', 'helmet', 'cap', 'beret', 'beret-slouch', 'bandana', 'goggles', 'hood', 'shako', 'bobble', 'rainhat', 'headset', 'fur-hat', 'cap-back'];
const EXPRS: Expression[] = ['normal', 'shout', 'panic', 'hurt', 'happy', 'smile', 'blink', 'yawn', 'chew', 'dazed', 'soot'];
const EXTRAS: FaceExtra[] = ['moustache', 'beard', 'glasses', 'shades', 'freckles', 'stubble', 'blush', 'walrus', 'bushy-brows', 'eyeshine', 'raised-brow', 'smirk', 'grin', 'beam', 'thick-mustache', 'heavy-stubble', 'thin-mustache', 'blue-eyes'];

const BASE: HeadStyle = { skin: PAL.skinA, hair: PAL.hairB, hairStyle: 'short', headgear: 'none', gear: PAL.olive, accent: PAL.red, extras: [] };

const opaque = (b: PixelBuffer, x: number, y: number): boolean => x >= 0 && y >= 0 && x < b.w && y < b.h && (b.get(x, y) & 255) !== 0;

/** Every art px is transparent or a PAL_HD colour. */
function inPalette(b: PixelBuffer): boolean {
  for (const v of b.data) if ((v & 255) !== 0 && !inHdPalette(v)) return false;
  return true;
}

/**
 * Silhouette agreement with the 1× head, per logical px: a logical px is "on" in the HD head when
 * at least half of its d × d block is opaque. Returns the share of logical px that disagree.
 */
function silhouetteMismatch(lo: PixelBuffer, hi: PixelBuffer, d: number): number {
  let bad = 0;
  let n = 0;
  for (let y = 0; y < lo.h; y++) {
    for (let x = 0; x < lo.w; x++) {
      let k = 0;
      for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) if (opaque(hi, x * d + i, y * d + j)) k++;
      const a = opaque(lo, x, y);
      const b = k * 2 >= d * d;
      if (a || b) n++;
      if (a !== b) bad++;
    }
  }
  return n ? bad / n : 0;
}

/** Top opaque row of a buffer. */
function top(b: PixelBuffer): number {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (opaque(b, x, y)) return y;
  return b.h;
}

function count(b: PixelBuffer, cols: readonly number[]): number {
  let k = 0;
  const set = new Set(cols.map((c) => c >>> 0));
  for (const v of b.data) if (set.has(v >>> 0)) k++;
  return k;
}

const R = (r: unknown, def: keyof typeof PAL): Ramp => (typeof r === 'string' ? (PAL as unknown as Record<string, Ramp>)[r] : ((r as Ramp | undefined) ?? PAL[def]));
const headOf = (s: HumanStyle): HeadStyle => ({ skin: R(s.skin, 'skinA'), hair: R(s.hair, 'hairB'), hairStyle: s.hairStyle, headgear: s.headgear, gear: R(s.gear, 'olive'), accent: R(s.accent, 'red'), extras: s.face ?? [] });

describe('renderHeadHd: the rig contract', () => {
  it('every hair style × expression: HEAD_W·d × HEAD_H·d, the neck and head centre drawn, HD palette, the 1× silhouette', () => {
    for (const d of DS) {
      for (const hairStyle of HAIRS) {
        for (const e of EXPRS) {
          const s = { ...BASE, hairStyle };
          const b = renderHeadHd(s, e, d);
          expect([b.w, b.h]).toEqual([HEAD_W * d, HEAD_H * d]);
          // NECK is the bottom of the neck; the rig joins the head there. HEAD_CENTER is inside the head.
          expect(opaque(b, NECK[0] * d + (d >> 1), NECK[1] * d + (d >> 1)), `${hairStyle}/${e}@${d} neck`).toBe(true);
          expect(opaque(b, HEAD_CENTER[0] * d + (d >> 1), HEAD_CENTER[1] * d + (d >> 1)), `${hairStyle}/${e}@${d} centre`).toBe(true);
          expect(inPalette(b), `${hairStyle}/${e}@${d} palette`).toBe(true);
          expect(silhouetteMismatch(renderHead(s, e), b, d), `${hairStyle}/${e}@${d} silhouette`).toBeLessThan(0.12);
        }
      }
    }
  });

  it('every headgear × expression (with the hat on, off and slipped) renders inside the contract', () => {
    for (const d of DS) {
      for (const headgear of GEARS) {
        for (const e of EXPRS) {
          for (const v of [{}, { hat: false }, { hatDy: 2 }] as const) {
            const s: HeadStyle = { ...BASE, headgear, gear: PAL.navy, accent: PAL.gold, ...v };
            const b = renderHeadHd(s, e, d);
            expect([b.w, b.h]).toEqual([HEAD_W * d, HEAD_H * d]);
            expect(opaque(b, NECK[0] * d + (d >> 1), NECK[1] * d + (d >> 1))).toBe(true);
            expect(inPalette(b), `${headgear}/${e}@${d}`).toBe(true);
            expect(silhouetteMismatch(renderHead(s, e), b, d), `${headgear}/${e}@${d} ${JSON.stringify(v)}`).toBeLessThan(0.14);
          }
        }
      }
    }
  });

  it('every face extra × expression renders, in the HD palette', () => {
    for (const d of DS) {
      for (const x of EXTRAS) {
        for (const e of EXPRS) {
          const b = renderHeadHd({ ...BASE, extras: [x] }, e, d);
          expect([b.w, b.h]).toEqual([HEAD_W * d, HEAD_H * d]);
          expect(inPalette(b), `${x}/${e}@${d}`).toBe(true);
        }
      }
    }
  });

  it('every playable hero: all expressions, both densities', () => {
    for (const [id, st] of Object.entries(HERO_STYLES)) {
      for (const d of DS) {
        for (const e of EXPRS) {
          const s = headOf(st);
          const b = renderHeadHd(s, e, d);
          expect([b.w, b.h]).toEqual([HEAD_W * d, HEAD_H * d]);
          expect(inPalette(b), `${id}/${e}@${d}`).toBe(true);
          expect(silhouetteMismatch(renderHead(s, e), b, d), `${id}/${e}@${d}`).toBeLessThan(0.14);
        }
      }
    }
  });
});

describe('renderHeadHd: behaviour', () => {
  it('is deterministic (cold and cached) and returns a fresh buffer every call', () => {
    for (const d of DS) {
      const s: HeadStyle = { ...BASE, hairStyle: 'curly', headgear: 'cap', extras: ['stubble', 'glasses'] };
      clearHeadHdCache();
      const a = renderHeadHd(s, 'shout', d);
      clearHeadHdCache();
      const b = renderHeadHd(s, 'shout', d);
      expect(Array.from(a.data)).toEqual(Array.from(b.data));
      const c = renderHeadHd(s, 'shout', d);
      expect(c).not.toBe(b);
      c.data.fill(0);
      expect(Array.from(renderHeadHd(s, 'shout', d).data)).toEqual(Array.from(a.data));
    }
  });

  it('glint: false (a tilted head) drops the catchlight: fewer white px, nothing else moves', () => {
    for (const d of DS) {
      const on = renderHeadHd(BASE, 'normal', d);
      const off = renderHeadHd(BASE, 'normal', d, { glint: false });
      expect(count(off, [PAL_HD.snow[5]])).toBeLessThan(count(on, [PAL_HD.snow[5]]));
      let diff = 0;
      for (let i = 0; i < on.data.length; i++) if (on.data[i] !== off.data[i]) diff++;
      expect(diff).toBeLessThanOrEqual(d === 4 ? 4 : 1);
    }
  });

  it('the hat slips down with hatDy and hair is cut under it as at 1×', () => {
    for (const d of DS) {
      for (const headgear of ['helmet', 'cap', 'beret'] as const) {
        for (const hatDy of [0, 1, 3]) {
          const s: HeadStyle = { ...BASE, headgear, hatDy };
          const t1 = top(renderHead(s, 'normal'));
          const tHd = top(renderHeadHd(s, 'normal', d));
          expect(Math.abs(tHd - t1 * d), `${headgear} slip ${hatDy}@${d}`).toBeLessThanOrEqual(d);
        }
      }
      // hat: false shows the full hair, as at 1×.
      const off = renderHeadHd({ ...BASE, headgear: 'helmet', hat: false }, 'normal', d);
      expect(Math.abs(top(off) - top(renderHead({ ...BASE, headgear: 'helmet', hat: false }, 'normal')) * d)).toBeLessThanOrEqual(d);
    }
  });

  it('the 4× eye has a white, a coloured iris, an ink pupil and a 2 × 2 catchlight', () => {
    const b = renderHeadHd(BASE, 'normal', 4);
    const iris = PAL_HD.brown;
    expect(count(b, [PAL_HD.snow[5]])).toBeGreaterThanOrEqual(6);
    expect(count(b, [iris[1], iris[2], iris[4]])).toBeGreaterThanOrEqual(4);
    // The catchlight: a 2 × 2 block of white with ink next to it.
    let found = false;
    for (let y = 40; y < 60 && !found; y++) {
      for (let x = 38; x < 56 && !found; x++) {
        const w = (xx: number, yy: number): boolean => b.get(xx, yy) >>> 0 === PAL_HD.snow[5] >>> 0;
        if (w(x, y) && w(x + 1, y) && w(x, y + 1) && w(x + 1, y + 1)) found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('a lit face at 4× has at least 5 skin tones (deep shade … highlight)', () => {
    const b = renderHeadHd({ ...BASE, hairStyle: 'bald' }, 'normal', 4);
    const tones = new Set<number>();
    for (const v of b.data) if (PAL_HD.skinA.includes(v)) tones.add(v);
    expect(tones.size).toBeGreaterThanOrEqual(5);
  });
});

describe('renderHeadHd: the squad keeps the likeness cues of their select portraits', () => {
  const at = (id: string): HeadStyle => headOf(HERO_STYLES[id]);
  it('Bob has blue eyes, the others brown or squinted', () => {
    for (const d of DS) {
      expect(count(renderHeadHd(at('bob'), 'normal', d), PAL_HD.sky)).toBeGreaterThan(0);
      expect(count(renderHeadHd(at('vincent'), 'normal', d), PAL_HD.sky)).toBe(0);
    }
  });
  it("Vincent's heavy stubble is a DARK checker over the jaw (the portrait's dark hairs), the skin between them unchanged", () => {
    for (const d of DS) {
      const v = renderHeadHd(at('vincent'), 'normal', d);
      const plain = renderHeadHd({ ...at('vincent'), extras: [] }, 'normal', d);
      const dark = PAL_HD.stone.slice(0, 4);
      const light = PAL_HD.stone.slice(4);
      expect(count(v, dark)).toBeGreaterThan(count(plain, dark) + 6 * d);
      // Lone hair px kept their own band: the cluster clean-up must not lift them to the skin's
      // band (a light grey mesh) nor darken the skin between them to the hairs' band.
      expect(count(v, light)).toBeLessThanOrEqual(count(plain, light));
      // Vincent's skin is skinA: its three deepest HD tones only grow by the jaw's own shading.
      const darkSkin = (b: PixelBuffer): number => count(b, PAL_HD.skinA.slice(0, 3));
      expect(darkSkin(v)).toBeLessThanOrEqual(darkSkin(plain) + 2 * d);
    }
  });
  it("Thom's grin shows teeth; his and Dirk's cheeks are rosy", () => {
    for (const d of DS) {
      const t = renderHeadHd(at('thom'), 'normal', d);
      expect(count(t, [PAL_HD.snow[5]])).toBeGreaterThan(2 * d);
      expect(count(t, PAL_HD.pink)).toBeGreaterThan(0);
      expect(count(renderHeadHd(at('dirk'), 'normal', d), PAL_HD.pink)).toBeGreaterThan(0);
    }
  });
  it("Patrick's slick hair stays dark (no light tones of his ramp)", () => {
    for (const d of DS) {
      const p = renderHeadHd(at('patrick'), 'normal', d);
      expect(count(p, [PAL_HD.black[6]])).toBe(0);
    }
  });
});
