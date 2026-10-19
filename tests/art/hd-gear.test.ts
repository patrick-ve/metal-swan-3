/**
 * UHD gear (src/game/art/hd/gear.ts): every gun, held item, knife, knife-look prop and hand is
 * drawn natively at d ∈ {2, 4}, exactly d times its 1× art, with the same logical anchor points
 * (grip, grip2, muzzle, tip, wrist), in the HD palette, deterministic, new art (not the 2× art
 * scaled) and with the 1× footprint.
 */
import { describe, expect, it, vi } from 'vitest';
import { PAL } from '../../src/engine/palette';
import { PAL_HD, hdRampOf, inHdPalette } from '../../src/engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../src/engine/pixel';
import * as gear from '../../src/game/art/hd/gear';
import {
  drawHand,
  giftArt,
  grenadeArt,
  gunArt,
  handTemplate,
  knifeArt,
  propArt,
  snackArt,
  type HandShape,
  type PropKind,
} from '../../src/game/art/humanoid-gear';

const DS = [2, 4] as const;
type D = (typeof DS)[number];
const GUNS = ['pistol', 'heavy', 'rifle'] as const;
const HELD = ['grenade', 'snack', 'gift'] as const;
const PROPS: readonly PropKind[] = ['umbrella', 'needles', 'pan', 'wrench', 'plan', 'pistol-butt', 'plunger', 'airliner', 'frikandel'];
const SHAPES: readonly HandShape[] = ['fist', 'grip', 'open', 'point', 'thumb'];
const HAND_RAMPS: ReadonlyArray<[string, Ramp]> = [
  ['skinA', PAL.skinA],
  ['skinC', PAL.skinC],
  ['black', PAL.black],
  ['brown', PAL.brown],
  ['cloth', PAL.cloth],
];

type G = typeof gear;
/** Every gear item: name, its 1× art, its HD drawer. */
function items(g: G): Array<[string, PixelBuffer, (d: D) => PixelBuffer]> {
  return [
    ...GUNS.map((k): [string, PixelBuffer, (d: D) => PixelBuffer] => [k, gunArt(k).buf, (d) => g.gunArtHd(k, d)]),
    ['knife', knifeArt(), (d) => g.knifeArtHd(d)],
    ...HELD.map((k): [string, PixelBuffer, (d: D) => PixelBuffer] => [k, k === 'grenade' ? grenadeArt() : k === 'snack' ? snackArt() : giftArt(), (d) => g.heldArtHd(k, d)]),
    ...PROPS.map((k): [string, PixelBuffer, (d: D) => PixelBuffer] => [k, propArt(k).buf, (d) => g.propArtHd(k, d)]),
  ];
}

const on = (b: PixelBuffer, x: number, y: number): boolean => x >= 0 && y >= 0 && x < b.w && y < b.h && (b.data[y * b.w + x] & 255) !== 0;

/** Share of the d × d art px block at logical (lx, ly) that is drawn. */
function block(b: PixelBuffer, lx: number, ly: number, d: number): number {
  let n = 0;
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) if (on(b, lx * d + x, ly * d + y)) n++;
  return n / (d * d);
}

/** Intersection over union of the 1× mask (each px a d × d block) and the HD mask. */
function iou(lo: PixelBuffer, hi: PixelBuffer, d: number): number {
  let i = 0;
  let u = 0;
  for (let y = 0; y < hi.h; y++) {
    for (let x = 0; x < hi.w; x++) {
      const a = on(lo, Math.floor(x / d), Math.floor(y / d));
      const b = on(hi, x, y);
      if (a && b) i++;
      if (a || b) u++;
    }
  }
  return u === 0 ? 1 : i / u;
}

function bounds(b: PixelBuffer): [number, number, number, number] | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!on(b, x, y)) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}

/** The 1× hand template box turned like drawHand turns it: size and wrist. */
function turnedTemplate(shape: HandShape, q: number, flipY: boolean): { w: number; h: number; wrist: [number, number] } {
  const t = handTemplate(shape);
  let w = t.rows[0].length;
  let h = t.rows.length;
  let wx = t.wrist[0];
  let wy = flipY ? h - 1 - t.wrist[1] : t.wrist[1];
  for (let i = 0; i < q; i++) {
    const nx = h - 1 - wy;
    wy = wx;
    wx = nx;
    [w, h] = [h, w];
  }
  return { w, h, wrist: [wx, wy] };
}

const luma = (c: number): number => 0.299 * ((c >>> 24) & 255) + 0.587 * ((c >>> 16) & 255) + 0.114 * ((c >>> 8) & 255);
function meanLuma(b: PixelBuffer): number {
  let s = 0;
  let n = 0;
  for (const c of b.data) {
    if ((c & 255) === 0) continue;
    s += luma(c);
    n++;
  }
  return s / n;
}

describe('UHD gear: sizes, palette and footprint', () => {
  it('every item is exactly d times its 1× art, opaque or empty px, HD palette only', () => {
    for (const [name, lo, hd] of items(gear)) {
      for (const d of DS) {
        const b = hd(d);
        expect([b.w, b.h], `${name}@${d}x`).toEqual([lo.w * d, lo.h * d]);
        let drawn = 0;
        for (const c of b.data) {
          const a = c & 255;
          if (a === 0) continue;
          drawn++;
          expect(a, `${name}@${d}x alpha`).toBe(255);
          expect(inHdPalette(c), `${name}@${d}x colour ${c.toString(16)}`).toBe(true);
        }
        expect(drawn, `${name}@${d}x is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('every item keeps its 1× footprint (silhouette overlap ≥ 0.6)', () => {
    for (const [name, lo, hd] of items(gear)) {
      for (const d of DS) expect(iou(lo, hd(d), d), `${name}@${d}x`).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('is new art at each density: the 4× art is not the 2× art scaled, and the steel guns carry ≥ 6 tones at 4×', () => {
    for (const [name, , hd] of items(gear)) {
      const two = hd(2).scaled(2);
      expect(Array.from(hd(4).data).every((c, i) => c === two.data[i]), name).toBe(false);
    }
    for (const k of GUNS) {
      const tones = new Set<number>();
      for (const c of gear.gunArtHd(k, 4).data) if ((c & 255) !== 0 && PAL_HD.steel.includes(c)) tones.add(c);
      expect(tones.size, k).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('UHD gear: logical anchor points', () => {
  it('guns: grip and grip2 blocks are drawn; the barrel reaches the art column before the muzzle on its row', () => {
    for (const k of GUNS) {
      const lo = gunArt(k);
      for (const d of DS) {
        const g = gear.gunHd(k, d);
        expect(g.grip).toEqual(lo.grip);
        expect(g.grip2).toEqual(lo.grip2);
        expect(g.muzzle).toEqual(lo.muzzle);
        expect(g.buf).toBe(gear.gunArtHd(k, d));
        expect(block(g.buf, lo.grip[0], lo.grip[1], d), `${k}@${d}x grip`).toBeGreaterThanOrEqual(0.5);
        expect(block(g.buf, lo.grip2[0], lo.grip2[1], d), `${k}@${d}x grip2`).toBeGreaterThanOrEqual(0.5);
        // The muzzle is the first empty px past the tip: here the right edge of the art.
        expect(lo.muzzle[0]).toBe(lo.buf.w);
        let tip = 0;
        for (let y = 0; y < d; y++) if (on(g.buf, g.buf.w - 1, lo.muzzle[1] * d + y)) tip++;
        expect(tip, `${k}@${d}x barrel tip on the muzzle row`).toBeGreaterThan(0);
      }
    }
  });

  it('props: grip and tip blocks are drawn wherever the 1× art draws them; propHd keeps the 1× points', () => {
    for (const k of PROPS) {
      const lo = propArt(k);
      for (const d of DS) {
        const p = gear.propHd(k, d);
        expect([p.grip, p.tip, p.ramp]).toEqual([lo.grip, lo.tip, lo.ramp]);
        for (const [what, pt] of [['grip', lo.grip], ['tip', lo.tip]] as const) {
          if (!on(lo.buf, pt[0], pt[1])) continue;
          expect(block(p.buf, pt[0], pt[1], d), `${k}@${d}x ${what}`).toBeGreaterThanOrEqual(0.5);
        }
      }
    }
  });

  it('the knife keeps its handle at x 0..2 and the blade tip at the right', () => {
    const lo = knifeArt();
    for (const d of DS) {
      const b = gear.knifeArtHd(d);
      expect(block(b, 1, 1, d), `handle@${d}x`).toBeGreaterThanOrEqual(0.5);
      expect(block(b, 6, 1, d), `blade@${d}x`).toBeGreaterThanOrEqual(0.5);
      expect(on(lo, 7, 1)).toBe(true);
      expect(block(b, 7, 1, d), `tip@${d}x`).toBeGreaterThan(0);
    }
  });
});

describe('UHD gear: hands', () => {
  it('every shape, turn and flip: the turned template box × d, the wrist block on d times the 1× wrist', () => {
    for (const shape of SHAPES) {
      for (let q = 0; q < 4; q++) {
        for (const flipY of [false, true]) {
          const t = turnedTemplate(shape, q, flipY);
          for (const d of DS) {
            const h = gear.handArtHd(shape, PAL.skinA, q, flipY, d);
            const label = `${shape} q${q}${flipY ? ' flip' : ''} @${d}x`;
            expect([h.buf.w, h.buf.h], label).toEqual([t.w * d, t.h * d]);
            expect(h.wrist, label).toEqual(t.wrist);
            expect(block(h.buf, t.wrist[0], t.wrist[1], d), `${label} wrist`).toBeGreaterThanOrEqual(0.5);
          }
        }
      }
    }
  });

  it('drawHandHd lands on drawHand’s 1× footprint (inside its box, overlap ≥ 0.55) for every shape and turn', () => {
    for (const shape of SHAPES) {
      for (let q = 0; q < 4; q++) {
        for (const flipY of [false, true]) {
          const lo = new PixelBuffer(24, 24);
          drawHand(lo, shape, 11, 11, PAL.black, q, flipY);
          const lb = bounds(lo);
          expect(lb).not.toBeNull();
          for (const d of DS) {
            const hi = new PixelBuffer(24 * d, 24 * d);
            gear.drawHandHd(hi, shape, 11, 11, PAL.black, q, flipY, d);
            const hb = bounds(hi);
            const label = `${shape} q${q}${flipY ? ' flip' : ''} @${d}x`;
            expect(hb, label).not.toBeNull();
            if (!lb || !hb) continue;
            expect(hb[0], label).toBeGreaterThanOrEqual(lb[0] * d);
            expect(hb[1], label).toBeGreaterThanOrEqual(lb[1] * d);
            expect(hb[2], label).toBeLessThan((lb[2] + 1) * d);
            expect(hb[3], label).toBeLessThan((lb[3] + 1) * d);
            expect(iou(lo, hi, d), label).toBeGreaterThanOrEqual(0.55);
          }
        }
      }
    }
  });

  it('a fractional wrist moves the hand in art px steps (joints at 1/d px); whole px match drawHand placement', () => {
    for (const d of DS) {
      const a = new PixelBuffer(16 * d, 16 * d);
      const b = new PixelBuffer(16 * d, 16 * d);
      gear.drawHandHd(a, 'fist', 6, 6, PAL.skinA, 0, false, d);
      gear.drawHandHd(b, 'fist', 6 + 1 / d, 6 + 2 / d, PAL.skinA, 0, false, d);
      const ab = bounds(a);
      const bb = bounds(b);
      expect(ab && bb).toBeTruthy();
      if (!ab || !bb) continue;
      expect([bb[0] - ab[0], bb[1] - ab[1]]).toEqual([1, 2]);
    }
  });

  it('keeps the glove / skin colour family: every px is a tone of the hand’s HD ramp; the far hand is darker', () => {
    for (const [name, ramp] of HAND_RAMPS) {
      const hd = hdRampOf(ramp);
      for (const shape of SHAPES) {
        for (const d of DS) {
          const near = gear.handArtHd(shape, ramp, 1, false, d).buf;
          const far = gear.handArtHd(shape, ramp, 1, false, d, true).buf;
          for (const c of near.data) if ((c & 255) !== 0) expect(hd.includes(c), `${name} ${shape}@${d}x`).toBe(true);
          expect(meanLuma(far), `${name} ${shape}@${d}x far`).toBeLessThan(meanLuma(near));
        }
      }
    }
    // A skin hand sits in the head's light range: no deep-shadow tones of the skin ramp but crease px.
    const skin = gear.handArtHd('fist', PAL.skinA, 0, false, 4).buf;
    let deep = 0;
    let n = 0;
    for (const c of skin.data) {
      if ((c & 255) === 0) continue;
      n++;
      if (PAL_HD.skinA.indexOf(c) <= 1) deep++;
    }
    expect(deep / n).toBeLessThan(0.1);
  });

  it('caches by ramp colours (a fresh copy of a ramp hits the same hand)', () => {
    const a = gear.handArtHd('point', PAL.brown, 2, false, 4);
    const b = gear.handArtHd('point', [...PAL.brown], 2, false, 4);
    expect(b).toBe(a);
  });
});

describe('UHD gear: determinism', () => {
  it('a fresh module instance draws byte-identical gear and hands', async () => {
    vi.resetModules();
    const fresh = (await import('../../src/game/art/hd/gear')) as G;
    expect(fresh).not.toBe(gear);
    const a = items(gear);
    const b = items(fresh);
    for (let i = 0; i < a.length; i++) {
      for (const d of DS) {
        const x = a[i][2](d);
        const y = b[i][2](d);
        expect(y, `${a[i][0]}@${d}x fresh`).not.toBe(x);
        expect(Array.from(y.data), `${a[i][0]}@${d}x`).toEqual(Array.from(x.data));
      }
    }
    for (const shape of SHAPES) {
      for (const d of DS) {
        for (let q = 0; q < 4; q++) {
          const x = gear.handArtHd(shape, PAL.skinB, q, q === 3, d, q === 1).buf;
          const y = fresh.handArtHd(shape, PAL.skinB, q, q === 3, d, q === 1).buf;
          expect(Array.from(y.data), `${shape} q${q}@${d}x`).toEqual(Array.from(x.data));
        }
      }
    }
  });
});
