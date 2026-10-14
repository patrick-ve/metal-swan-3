/**
 * 2× heads (mission ams): `renderHeadHi` draws the 1× head's layout on the 2× grid, with the
 * hand-drawn templates of humanoid-head-hi.ts (docs/ART_GUIDE.md "2x art (mission ams)").
 */
import { describe, expect, it } from 'vitest';
import { inPalette, PAL } from '../../src/engine/palette';
import type { PixelBuffer } from '../../src/engine/pixel';
import { headLayerHi, renderHuman, type HumanStyle } from '../../src/game/art/humanoid';
import {
  HEAD_H,
  HEAD_W,
  NECK,
  renderHead,
  renderHeadHi,
  type Expression,
  type FaceExtra,
  type HairStyle,
  type Headgear,
  type HeadStyle,
} from '../../src/game/art/humanoid-head';
import { EXPR_HI, EXTRAS_HI, GEAR_HI, HAIR_HI, SKULL_HI } from '../../src/game/art/humanoid-head-hi';

const HAIRS: HairStyle[] = ['short', 'buzz', 'spiky', 'mohawk', 'bald', 'long', 'ponytail', 'bob', 'parted', 'curly', 'puffs', 'tufts'];
const GEARS: Headgear[] = ['none', 'helmet', 'cap', 'beret', 'beret-slouch', 'bandana', 'goggles', 'hood', 'shako', 'bobble', 'rainhat', 'headset', 'fur-hat'];
const EXPRS: Expression[] = ['normal', 'shout', 'panic', 'hurt', 'happy', 'blink', 'yawn', 'chew', 'dazed', 'soot'];
const EXTRAS: FaceExtra[] = ['moustache', 'beard', 'glasses', 'shades', 'freckles', 'stubble', 'blush', 'walrus', 'bushy-brows', 'eyeshine'];

const BASE: HeadStyle = { skin: PAL.skinA, hair: PAL.hairB, hairStyle: 'short', headgear: 'none', gear: PAL.olive, accent: PAL.red, extras: [] };

const opaque = (b: PixelBuffer, x: number, y: number): boolean => x >= 0 && y >= 0 && x < b.w && y < b.h && (b.get(x, y) & 255) !== 0;

/** Footprint check: 2× pixels outside the doubled 1× head (grown by `grow` 2× px) and the doubled 1× pixels the 2× head leaves empty. */
function footprint(lo: PixelBuffer, hi: PixelBuffer, grow: number): { outside: number; missing: number; area: number } {
  let outside = 0;
  let missing = 0;
  let area = 0;
  for (let y = 0; y < hi.h; y++) {
    for (let x = 0; x < hi.w; x++) {
      const inLo = opaque(lo, x >> 1, y >> 1);
      if (inLo) area++;
      if (inLo && !opaque(hi, x, y)) missing++;
      if (!opaque(hi, x, y) || inLo) continue;
      let near = false;
      for (let dy = -grow; dy <= grow && !near; dy++) for (let dx = -grow; dx <= grow && !near; dx++) near = opaque(lo, (x + dx) >> 1, (y + dy) >> 1);
      if (!near) outside++;
    }
  }
  return { outside, missing, area };
}

describe('2× heads', () => {
  it('the rig hook uses renderHeadHi (36 × 38)', () => {
    const hi = headLayerHi(BASE, 'normal');
    expect(hi).not.toBeNull();
    expect([hi!.w, hi!.h]).toEqual([HEAD_W * 2, HEAD_H * 2]);
  });

  it('every hair × headgear × expression is twice the 1× buffer, palette only, with the neck on the 1× neck block', () => {
    for (const hairStyle of HAIRS) {
      for (const headgear of GEARS) {
        for (const e of EXPRS) {
          const s: HeadStyle = { ...BASE, hairStyle, headgear };
          const hi = renderHeadHi(s, e);
          expect([hi.w, hi.h]).toEqual([HEAD_W * 2, HEAD_H * 2]);
          for (let i = 0; i < hi.data.length; i++) {
            const c = hi.data[i];
            if ((c & 255) === 0) continue;
            if ((c & 255) !== 255 || !inPalette(c)) throw new Error(`${hairStyle}/${headgear}/${e}: colour ${c.toString(16)} not opaque palette`);
          }
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(opaque(hi, NECK[0] * 2 + dx, NECK[1] * 2 + dy)).toBe(true);
        }
      }
    }
  });

  it('keeps the 1× footprint: the same logical box, so hats and the neck fit', () => {
    for (const hairStyle of HAIRS) {
      for (const headgear of GEARS) {
        for (const extras of [[], EXTRAS.slice(0, 5), EXTRAS.slice(5)] as FaceExtra[][]) {
          const s: HeadStyle = { ...BASE, hairStyle, headgear, extras };
          for (const e of ['normal', 'yawn'] as const) {
            const f = footprint(renderHead(s, e), renderHeadHi(s, e), 2);
            const tag = `${hairStyle}/${headgear}/${extras.join('+')}/${e}`;
            // Nothing beyond one logical pixel of the 1× shape; at most a few rounded corners missing.
            expect(f.outside, tag).toBe(0);
            expect(f.missing / f.area, tag).toBeLessThan(0.08);
          }
        }
      }
    }
  });

  it('hand-drawn templates exist for every part mission ams shows', () => {
    expect(SKULL_HI).toHaveLength(24);
    for (const r of SKULL_HI) expect(r).toHaveLength(24);
    for (const h of ['short', 'buzz', 'long', 'ponytail', 'bob', 'parted', 'curly', 'tufts'] as const) expect(HAIR_HI[h], h).toBeDefined();
    for (const g of ['helmet', 'cap', 'beret-slouch', 'goggles', 'hood', 'bobble', 'rainhat'] as const) expect(GEAR_HI[g], g).toBeDefined();
    for (const x of EXTRAS) expect(EXTRAS_HI[x], x).toBeDefined();
    expect(Object.keys(EXPR_HI).sort()).toEqual([...EXPRS].sort());
  });

  it('the hat slips and comes off as at 1×', () => {
    const s: HeadStyle = { ...BASE, headgear: 'helmet' };
    const top = (b: PixelBuffer): number => b.trimBounds()!.y;
    expect(top(renderHeadHi({ ...s, hatDy: 3 }, 'normal'))).toBe(top(renderHead({ ...s, hatDy: 3 }, 'normal')) * 2);
    expect(top(renderHeadHi({ ...s, hat: false }, 'normal'))).toBe(top(renderHead({ ...s, hat: false }, 'normal')) * 2);
  });

  it('is deterministic and the 2× rig places the head on the 1× head point', () => {
    const a = renderHeadHi({ ...BASE, extras: ['glasses'] }, 'shout');
    const b = renderHeadHi({ ...BASE, extras: ['glasses'] }, 'shout');
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    const style: HumanStyle = { skin: 'skinB', hair: 'hairA', hairStyle: 'curly', headgear: 'helmet', top: 'gold', topType: 'vest', pants: 'sand', boots: 'snow' };
    for (const pose of [{}, { head: { tilt: 14 } }, { headScale: 2 as const }]) {
      const lo = renderHuman(style, pose, 'full');
      const hi = renderHuman(style, pose, 'full', 2);
      expect(hi.pts).toEqual(lo.pts);
    }
  });
});
