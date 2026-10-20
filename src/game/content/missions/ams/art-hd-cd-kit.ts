/**
 * Shared helpers of the UHD decor of mission ams sections c and d (docs/ART_GUIDE.md "UHD art"):
 * the breakables, the flea-market stalls, the bridges, the boats and the Stopera. Every id is
 * drawn natively at d 2 and 4 by ONE drawer on an `HdCanvas` of its 1× frame's logical size
 * (`hdStrip`: the 1× anchor and points), in PAL_HD only.
 *
 * - `letters`: the 1× lettering of a sign (STADHUIS, HARING) at d, as raised letters: each glyph
 *   px a d × d block with a lit top edge, a shaded lower edge and a drop shadow on the plate, so
 *   it reads exactly as the 1× text, only crisper.
 * - `band`: the hard-band tone of a ramp for the direct (per art px) painters of the big façades.
 * - `wheelHd`: a lit spoked wheel (tyre torus, rim, spokes, hub) for carts and bikes.
 * - Materials: `decoMat` (static façade decor: outline C via `edge: 'C'`), `propMat` (sprites).
 */
import type { Color } from '../../../../engine/color';
import { drawText } from '../../../../engine/font';
import { PAL_HD } from '../../../../engine/palette-hd';
import { bandIndex, PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { TextOpts } from '../../../../engine/render';
import { HdCanvas, type HdMaterial } from '../../../art/hd/index';

export { hdStrip } from '../../fx/hd/kit';
export { HdCanvas };

/** Static façade decor material (outline C on the parts behind it, lit like a sprite). */
export function decoMat(c: HdCanvas, ramp: Ramp, extra: Partial<HdMaterial> = {}): number {
  return c.material({ ramp, wrap: 0.05, rim: 0.15, ...extra });
}

/** Sprite material (outline A sprites: breakables, boats). */
export function propMat(c: HdCanvas, ramp: Ramp, extra: Partial<HdMaterial> = {}): number {
  return c.material({ ramp, wrap: 0.05, rim: 0.25, ...extra });
}

/** Polished metal (steel, brass, chrome). */
export function metalMat(c: HdCanvas, ramp: Ramp = PAL_HD.steel, extra: Partial<HdMaterial> = {}): number {
  return c.material({ ramp, spec: 1, shine: 30, rim: 0.4, gain: 1.1, bounce: 0.3, lo: 1, hi: ramp.length - 2, ...extra });
}

/** Emissive (lamps, lit windows): the tone alone picks the band. */
export function glowMat(c: HdCanvas, ramp: Ramp, lo = 1, hi = ramp.length - 1, extra: Partial<HdMaterial> = {}): number {
  return c.material({ ramp, flat: true, lo, hi, ...extra });
}

/**
 * Hard-band tone of `t` (0 = the deepest band lo … 1 = the lightest band hi) on ramp `r`, with an
 * ordered dither of width `z` at the band borders (0 = hard bands; backgrounds and big planes only).
 */
export function band(r: Ramp, t: number, X: number, Y: number, lo = 1, hi = r.length - 2, z = 0): Color {
  const n = hi - lo + 1;
  return r[lo + bandIndex(t * n, n, z, X, Y)];
}

/** Logical px covered by 1× text (drawText at logical (x, y)): a mask over the canvas, 1 = ink. */
export function textMask(w: number, h: number, s: string, x: number, y: number, o: TextOpts = {}): Uint8Array {
  const b = new PixelBuffer(w, h);
  drawText(b, s, x, y, { font: 'small', ...o, color: 0xffffffff });
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if ((b.data[i] & 255) !== 0) m[i] = 1;
  return m;
}

export interface LetterOpts {
  /** Letter face colour. */
  face: Color;
  /** Lit top / left edge (one art px at d 4; none at d 2 where the letter must stay a solid block). */
  lit?: Color;
  /** Lower / right edge of the letter (art px at d 4). */
  edge?: Color;
  /** Drop shadow on the plate, one art px down-right of the letter. */
  drop?: Color;
  /** Front depth of the paint (default in front of everything). */
  z?: number;
}

/**
 * The 1× lettering at d: every glyph px of `s` (drawText at logical (x, y), font small unless
 * given) is a d × d block of `face`, with a lit top-left art px row / column, a darker lower-right
 * one and a 1-art-px drop shadow (fixed colours, kept by the clean-up).
 */
export function letters(c: HdCanvas, s: string, x: number, y: number, o: LetterOpts, t: TextOpts = {}): void {
  const { w, h, d } = c;
  const m = textMask(w, h, s, x, y, t);
  const at = (lx: number, ly: number): boolean => lx >= 0 && ly >= 0 && lx < w && ly < h && m[ly * w + lx] === 1;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      if (!m[ly * w + lx]) continue;
      if (lx < x0) x0 = lx;
      if (ly < y0) y0 = ly;
      if (lx > x1) x1 = lx;
      if (ly > y1) y1 = ly;
    }
  }
  if (x1 < 0) return;
  const fine = d >= 4;
  c.paint(
    x0,
    y0,
    x1 - x0 + 2,
    y1 - y0 + 2,
    (_px, _py, X, Y) => {
      const lx = Math.floor(X / d);
      const ly = Math.floor(Y / d);
      const sx = X - lx * d;
      const sy = Y - ly * d;
      if (at(lx, ly)) {
        if (fine && o.lit !== undefined && ((sy === 0 && !at(lx, ly - 1)) || (sx === 0 && !at(lx - 1, ly)))) return o.lit;
        if (fine && o.edge !== undefined && ((sy === d - 1 && !at(lx, ly + 1)) || (sx === d - 1 && !at(lx + 1, ly)))) return o.edge;
        return o.face;
      }
      if (o.drop === undefined) return 0;
      // Drop shadow: one art px right of / below a letter block (and its corner).
      const left = sx === 0 && at(lx - 1, ly);
      const up = sy === 0 && at(lx, ly - 1);
      const diag = sx === 0 && sy === 0 && at(lx - 1, ly - 1);
      return left || up || diag ? o.drop : 0;
    },
    o.z,
  );
}

export interface WheelMats {
  tyre: number;
  rim: number;
  hub: number;
}

/**
 * A spoked wheel centred (cx, cy) (logical, float), outer radius r: a lit rubber tyre (a torus
 * cut), a thin steel rim, `spokes` spokes and a hub with a specular. `tilt` squashes it to an
 * ellipse (bikes turned in a rack).
 */
export function wheelHd(c: HdCanvas, cx: number, cy: number, r: number, m: WheelMats, o: { z?: number; spokes?: number; tilt?: number; tyre?: number; seed?: number } = {}): void {
  const z = o.z ?? 0;
  const sq = o.tilt ?? 1;
  const tw = o.tyre ?? Math.max(0.7, r * 0.22);
  const R = r - tw / 2;
  const part = c.newPart();
  c.heightField(cx - r - 0.5, cy - r - 0.5, 2 * r + 1, 2 * r + 1, (x, y) => {
    const dx = (x - cx) / sq;
    const dy = y - cy;
    const q = Math.hypot(dx, dy) - R;
    const e = tw / 2;
    return Math.abs(q) > e ? NaN : Math.sqrt(e * e - q * q) * 0.9;
  }, { mat: m.tyre, z, part });
  // Rim: a thin bright ring just inside the tyre.
  const rr = R - tw / 2 - 0.2;
  if (rr > 0.8) {
    c.heightField(cx - rr - 0.5, cy - rr - 0.5, 2 * rr + 1, 2 * rr + 1, (x, y) => {
      const dx = (x - cx) / sq;
      const dy = y - cy;
      const q = Math.hypot(dx, dy) - rr;
      return Math.abs(q) > 0.32 ? NaN : (0.32 - Math.abs(q)) * 1.2;
    }, { mat: m.rim, z: z - 0.1 });
    const n = o.spokes ?? 8;
    const a0 = (o.seed ?? 0) * 0.37;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI;
      const ex = Math.cos(a) * (rr - 0.1) * sq;
      const ey = Math.sin(a) * (rr - 0.1);
      c.capsule(cx - ex, cy - ey, cx + ex, cy + ey, 0.13, 0.13, { mat: m.rim, z: z - 0.3, round: 0.6 });
    }
  }
  c.ellipsoid(cx, cy, Math.max(0.55, r * 0.18) * sq, Math.max(0.55, r * 0.18), { mat: m.hub, z: z + 0.3 });
}

/**
 * A direct painter for the big façades (the Stopera): every art px is set straight from a
 * per-px colour function (no G-buffer), so a 386 × 169 building at 4× costs a few ms per Mpx.
 * `deep` keeps, per painted px, the deepest tone of its material for the outline C ring.
 */
export class Facade {
  readonly buf: PixelBuffer;
  readonly deep: Uint32Array;
  readonly W: number;
  readonly H: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;

  constructor(w: number, h: number, d: number) {
    this.w = w;
    this.h = h;
    this.d = d;
    this.W = Math.round(w * d);
    this.H = Math.round(h * d);
    this.buf = new PixelBuffer(this.W, this.H);
    this.deep = new Uint32Array(this.W * this.H);
  }

  /** Paint art px (X, Y) with colour c; `deep` = the deepest tone of its material (outline C). */
  set(X: number, Y: number, c: Color, deep: Color): void {
    const i = Y * this.W + X;
    this.buf.data[i] = c >>> 0;
    this.deep[i] = deep >>> 0;
  }

  /**
   * Outline C, ½ logical px wide, round the silhouette: on the lit side (the empty px left of /
   * above the shape) the deepest tone of the px it borders, on the shadow side (right / below) ink.
   */
  outlineC(ink: Color = PAL_HD.ink[0]): void {
    const { W, H } = this;
    const r = Math.max(1, this.d >> 1);
    const data = this.buf.data;
    const out = new Uint32Array(W * H);
    const bestQ = new Uint8Array(W * H).fill(255);
    // Stamp a disc from every edge px (one with an empty 4-neighbour) into the empty px round it.
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const j = Y * W + X;
        if ((data[j] & 255) === 0) continue;
        if (X > 0 && X < W - 1 && Y > 0 && Y < H - 1 && (data[j - 1] & 255) !== 0 && (data[j + 1] & 255) !== 0 && (data[j - W] & 255) !== 0 && (data[j + W] & 255) !== 0) continue;
        for (let dy = -r; dy <= r; dy++) {
          const YY = Y + dy;
          if (YY < 0 || YY >= H) continue;
          for (let dx = -r; dx <= r; dx++) {
            const q = dx * dx + dy * dy;
            if (q === 0 || q > r * r) continue;
            const XX = X + dx;
            if (XX < 0 || XX >= W) continue;
            const i = YY * W + XX;
            if ((data[i] & 255) !== 0 || q >= bestQ[i]) continue;
            bestQ[i] = q;
            // The empty px lies left of / above the shape (dx + dy <= 0 from the shape): the lit side.
            out[i] = dx + dy <= 0 ? this.deep[j] || ink : ink;
          }
        }
      }
    }
    for (let i = 0; i < W * H; i++) if (out[i] !== 0) data[i] = out[i];
    this.buf.touch();
  }
}
