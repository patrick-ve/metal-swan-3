/**
 * UHD gear (docs/ART_GUIDE.md "UHD art", rig contracts): the guns, the knife, the small held
 * items, the knife-look props and the hands of the human rig, drawn natively at density d ∈
 * {2, 4} with the HD kit (one drawer per item makes its 2× and its 4× art).
 *
 * Contract: each buffer is exactly d times its 1× art in src/game/art/humanoid-gear.ts
 * (gunArt / grenadeArt / snackArt / giftArt / knifeArt / propArt / the hand templates) with the
 * same LOGICAL anchor points (grip, grip2, muzzle, tip, wrist: read them from the 1× art; the
 * d × d art px block at the 1× px is drawn). No outline (the figure's outline wraps them). Lit
 * from the upper left in the pose it is drawn in: the hands are drawn natively in each quarter
 * turn, so their light never turns with them. Details scale with d: the 2× art keeps a clean
 * read (fewer, bigger clusters), the 4× art adds screws, serrations, ribs, knuckles and creases.
 * Deterministic, cached per (item, d).
 */
import type { Color } from '../../../engine/color';
import { PAL_HD, hdRampOf } from '../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../engine/pixel';
import {
  giftArt,
  grenadeArt,
  gunArt,
  handTemplate,
  knifeArt,
  propArt,
  snackArt,
  type GunArt,
  type HandShape,
  type PropArt,
  type PropKind,
} from '../humanoid-gear';
import { hash2, noise2 } from '../paint';
import { HdCanvas, type DrawOpts, type RenderOpts, type TexSample, type Texture } from './canvas';
import type { HdDensity } from './head';
import { BLACK_ONE_HUE, oneHue } from './light';
import { wood } from './texture';

type GunKind = 'pistol' | 'heavy' | 'rifle';
type Pt = readonly [number, number];

const cache = new Map<string, PixelBuffer>();

function cached(key: string, make: () => PixelBuffer): PixelBuffer {
  let b = cache.get(key);
  if (!b) {
    b = make();
    cache.set(key, b);
  }
  return b;
}

// ------------------------------------------------------------------------------------ pen

/**
 * Draws on an HdCanvas in LOCAL coordinates (the 1× template's frame, w × h logical px) that are
 * mirrored (`fx`, `fy`) and then turned `q` clockwise quarter turns onto the canvas, exactly as
 * the 1× templates are turned. The light stays in canvas space (upper left), so a turned item is
 * lit as if drawn in that pose. Shade, paint, erase, mask, height and `tex()` functions get LOCAL
 * coordinates; a raw Texture gets the sample (canvas coordinates).
 */
class Pen {
  readonly c: HdCanvas;
  readonly odd: boolean;
  readonly lw: number;
  readonly lh: number;
  readonly q: number;
  readonly fx: boolean;
  readonly fy: boolean;
  lx = 0;
  ly = 0;
  private readonly dv = new Float64Array(3);
  constructor(lw: number, lh: number, d: number, q = 0, fx = false, fy = false) {
    this.lw = lw;
    this.lh = lh;
    this.q = q;
    this.fx = fx;
    this.fy = fy;
    this.odd = (q & 1) === 1;
    this.c = new HdCanvas(this.odd ? lh : lw, this.odd ? lw : lh, d);
  }

  /** Local point → canvas point. */
  pt(x: number, y: number): [number, number] {
    if (this.fx) x = this.lw - x;
    if (this.fy) y = this.lh - y;
    let h = this.lh;
    let w = this.lw;
    for (let i = 0; i < this.q; i++) {
      const nx = h - y;
      y = x;
      x = nx;
      const t = w;
      w = h;
      h = t;
    }
    return [x, y];
  }

  /** Canvas point → local point, into this.lx / this.ly (no allocation). */
  loc(x: number, y: number): void {
    let w = this.odd ? this.lh : this.lw;
    let h = this.odd ? this.lw : this.lh;
    for (let i = 0; i < this.q; i++) {
      const ox = y;
      y = w - x;
      x = ox;
      const t = w;
      w = h;
      h = t;
    }
    if (this.fx) x = this.lw - x;
    if (this.fy) y = this.lh - y;
    this.lx = x;
    this.ly = y;
  }

  /** Local direction → canvas direction (normals), into out[0], out[1]. */
  dir(nx: number, ny: number, out: Float64Array): void {
    if (this.fx) nx = -nx;
    if (this.fy) ny = -ny;
    for (let i = 0; i < this.q; i++) {
      const t = -ny;
      ny = nx;
      nx = t;
    }
    out[0] = nx;
    out[1] = ny;
  }

  private rect(x: number, y: number, w: number, h: number): [number, number, number, number] {
    const a = this.pt(x, y);
    const b = this.pt(x + w, y + h);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
  }
  private pts(p: ReadonlyArray<Pt>): Array<[number, number]> {
    return p.map((q) => this.pt(q[0], q[1]));
  }

  box(x: number, y: number, w: number, h: number, o: DrawOpts & { r?: number; bevel?: number }): this {
    const [X, Y, W, H] = this.rect(x, y, w, h);
    this.c.box(X, Y, W, H, o);
    return this;
  }
  cylinder(x: number, y: number, w: number, h: number, o: DrawOpts & { axis?: 'v' | 'h' }): this {
    const [X, Y, W, H] = this.rect(x, y, w, h);
    const axis = (o.axis ?? 'v') === 'v' ? (this.odd ? 'h' : 'v') : this.odd ? 'v' : 'h';
    this.c.cylinder(X, Y, W, H, { ...o, axis });
    return this;
  }
  ellipsoid(cx: number, cy: number, rx: number, ry: number, o: DrawOpts): this {
    const [X, Y] = this.pt(cx, cy);
    this.c.ellipsoid(X, Y, this.odd ? ry : rx, this.odd ? rx : ry, o);
    return this;
  }
  capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, o: DrawOpts): this {
    const a = this.pt(x0, y0);
    const b = this.pt(x1, y1);
    this.c.capsule(a[0], a[1], b[0], b[1], r0, r1, o);
    return this;
  }
  stroke(p: ReadonlyArray<Pt>, r0: number, r1: number, o: DrawOpts): this {
    this.c.stroke(this.pts(p), r0, r1, o);
    return this;
  }
  poly(p: ReadonlyArray<Pt>, o: DrawOpts): this {
    this.c.poly(this.pts(p), o);
    return this;
  }
  blob(p: ReadonlyArray<Pt>, r: number, o: DrawOpts & { bulge?: number }): this {
    this.c.blob(this.pts(p), r, o);
    return this;
  }
  /** A lit height field given in local coordinates (NaN = outside); normals come from the canvas, so the light stays upper left. */
  heightField(x: number, y: number, w: number, h: number, hf: (x: number, y: number) => number, o: DrawOpts): this {
    const [X, Y, W, H] = this.rect(x, y, w, h);
    this.c.heightField(X, Y, W, H, (cx, cy) => (this.loc(cx, cy), hf(this.lx, this.ly)), o);
    return this;
  }
  /** A plane whose mask, normal and height are given in local coordinates. */
  plane(
    x: number,
    y: number,
    w: number,
    h: number,
    o: DrawOpts & { mask?: (x: number, y: number) => boolean; normal?: (x: number, y: number, out: Float64Array) => void; height?: (x: number, y: number) => number },
  ): this {
    const [X, Y, W, H] = this.rect(x, y, w, h);
    const { mask, normal, height } = o;
    this.c.plane(X, Y, W, H, {
      ...o,
      mask: mask ? (cx, cy) => (this.loc(cx, cy), mask(this.lx, this.ly)) : undefined,
      normal: normal
        ? (cx, cy, out) => {
            this.loc(cx, cy);
            normal(this.lx, this.ly, out);
            const nz = out[2];
            this.dir(out[0], out[1], out);
            out[2] = nz;
          }
        : undefined,
      height: height ? (cx, cy) => (this.loc(cx, cy), height(this.lx, this.ly)) : undefined,
    });
    return this;
  }
  /** Add a tone (local function) to drawn px in a local box. */
  shade(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => number, part?: number): this {
    const [X, Y, W, H] = this.rect(x, y, w, h);
    this.c.shade(X, Y, W, H, (cx, cy) => (this.loc(cx, cy), fn(this.lx, this.ly)), part);
    return this;
  }
  /** Fixed colours (local function) over a local box. */
  paint(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => Color, z?: number): this {
    const [X, Y, W, H] = this.rect(x, y, w, h);
    this.c.paint(X, Y, W, H, (cx, cy) => (this.loc(cx, cy), fn(this.lx, this.ly)), z);
    return this;
  }
  /** Remove px (local test) in a local box. */
  erase(x: number, y: number, w: number, h: number, cut: (x: number, y: number) => boolean): this {
    const [X, Y, W, H] = this.rect(x, y, w, h);
    this.c.erase(X, Y, W, H, (cx, cy) => (this.loc(cx, cy), cut(this.lx, this.ly)));
    return this;
  }
  /**
   * A texture written in local coordinates: `fn(s, x, y)` with the local position; `tilt(s, nx, ny)`
   * bends the normal by a LOCAL direction (it turns with the pose).
   */
  tex(fn: (s: TexSample, x: number, y: number) => void): Texture {
    return (s) => {
      this.loc(s.x, s.y);
      fn(s, this.lx, this.ly);
    };
  }
  /** Bend a sample's normal by a local direction (a groove or a knuckle that turns with the pose). */
  tilt(s: TexSample, nx: number, ny: number): void {
    this.dir(nx, ny, this.dv);
    s.nx += this.dv[0];
    s.ny += this.dv[1];
  }
}

// ------------------------------------------------------------------------------------ materials

/** Gunmetal: strong specular (near-white glints), cool shade. */
function steelMat(c: HdCanvas): number {
  return c.material({ ramp: PAL_HD.steel, spec: 1, shine: 34, rim: 0.4, gain: 1.1, bounce: 0.3 });
}
/** Black polymer / blued parts: a dark, satin, cool metal (the low end of the steel ramp). */
function polymerMat(c: HdCanvas): number {
  return c.material({ ramp: PAL_HD.steel, lo: 1, hi: 3, spec: 0.6, shine: 22, rim: 0.4, gain: 1.05, amb: 0.1 });
}
/** Rubber pads and grips: matte, darkest. */
function rubberMat(c: HdCanvas): number {
  return c.material({ ramp: PAL_HD.steel, lo: 0, hi: 2, spec: 0.3, shine: 12, rim: 0.3 });
}
function woodMat(c: HdCanvas, ramp: Ramp = PAL_HD.wood, lo?: number, hi?: number): number {
  return c.material({ ramp, lo, hi, spec: 0.35, shine: 16, gain: 1.05, wrap: 0.05 });
}

/** True for the art px of a thin line every `step` logical px along `a` (1 art px wide at any d). */
function line(a: number, step: number, d: number, off = 0): boolean {
  const f = (((a - off) % step) + step) % step;
  return f < 1 / d;
}

/** Chequered grip: diagonal diamonds 2 art px wide (used at 4×). */
function chequer(seed: number): Texture {
  return (s) => {
    if (((Math.floor((s.X + s.Y) / 2) + Math.floor((s.X - s.Y + 64) / 2)) & 1) === 0) s.tone -= 0.16;
    if (hash2(s.X, s.Y, seed) > 0.97) s.tone += 0.1;
  };
}

/** Fine wear on metal: tiny lighter scratches and darker pits at 4×, a soft mottle at 2×. */
function wear(seed: number, amount = 1): Texture {
  return (s) => {
    s.tone += (noise2(s.x, s.y, 2.5, seed) - 0.5) * 0.12 * amount;
    if (s.d >= 4) {
      const h = hash2(s.X, s.Y, seed);
      if (h > 0.985) s.tone += 0.25 * amount;
      else if (h < 0.012) s.tone -= 0.2 * amount;
    }
  };
}

/**
 * A screw or rivet head (4×), fixed colours: a lit upper-left px, a dark lower-right px, mid tones
 * between (r ≈ 0.3: a 2 × 2 art px head); `slot` adds a dark slot across a bigger head.
 */
function screw(p: Pen, x: number, y: number, r = 0.3, slot = false): void {
  p.paint(x - r - 0.1, y - r - 0.1, 2 * r + 0.2, 2 * r + 0.2, (px, py) => {
    const dx = px - x;
    const dy = py - y;
    if (Math.hypot(dx, dy) > r) return 0;
    if (slot && Math.abs(dx - dy) < 0.09) return PAL_HD.steel[1];
    return dx + dy < -0.05 ? PAL_HD.steel[6] : dx + dy > 0.05 ? PAL_HD.steel[2] : PAL_HD.steel[4];
  }, 50);
}

const RENDER: RenderOpts = { outline: 'none', ao: 0.3, sepZ: 0.3, rimLight: 1 };

// ------------------------------------------------------------------------------------ guns

/**
 * The compact handgun in a local 8 × 5 frame (barrel to +x): a slide with a lit top flat, rear
 * serrations and a dark bore; the frame with the trigger guard and the trigger; a raked polymer
 * grip (chequered, a screw at 4×). `fx` mirrors it (the pistol-butt prop) with the light kept
 * upper left.
 */
function drawPistol(p: Pen): void {
  const c = p.c;
  const d = c.d;
  const fine = d >= 4;
  const steel = steelMat(c);
  const dark = polymerMat(c);
  // Grip (raked a little; its top tucked under the frame); chequer, a screw and the base plate at 4×.
  p.blob([[0.85, 1.9], [3.15, 1.9], [2.95, 5], [0.95, 5]], fine ? 0.5 : 0.45, { mat: dark, z: 0, bulge: 0.15, tex: fine ? chequer(31) : null });
  if (fine) {
    screw(p, 2.05, 3.8, 0.3);
    p.shade(0.9, 4.5, 2.1, 0.25, () => -0.3); // the magazine base plate seam
  }
  // Frame with the trigger guard (an open ring) and the trigger. At 2× the frame sits just under
  // the slide (no separation row: the 2× pistol is only 10 art px tall).
  p.box(1, 1.95, 3.75, 1.0, { mat: steel, z: fine ? 0.5 : 0.9, bevel: 0.3, tone: fine ? -0.18 : -0.3 });
  p.stroke([[3.05, 2.75], [3.15, 3.45], [4.35, 3.35], [4.55, 2.7]], fine ? 0.22 : 0.26, fine ? 0.22 : 0.26, { mat: steel, z: 0.45, tone: fine ? -0.2 : -0.5 });
  if (fine) p.capsule(3.6, 2.85, 3.45, 3.25, 0.18, 0.14, { mat: dark, z: 0.4 });
  // Slide: bevelled steel, rear serrations, a lit top flat, the bore.
  const slide = c.newPart();
  p.box(1, 0, 7, 2.0, { mat: steel, z: 1.1, bevel: fine ? 0.45 : 0.35, r: 0.2, part: slide, tone: fine ? -0.1 : 0, tex: fine ? wear(33) : null });
  p.shade(1.3, 0.5, 1.6, 1.0, (x, y) => (y > 0.5 && y < 1.5 && line(x, fine ? 0.5 : 1, d, 1.3) ? -0.5 : 0), slide);
  if (fine) {
    // Ejection port: a dark slot with a lit lower lip; the white sight dots.
    p.shade(4.2, 0.3, 1.4, 0.55, (_x, y) => (y < 0.65 ? -0.6 : 0.2), slide);
    p.paint(1.25, 0, 0.5, 0.25, () => PAL_HD.ink[1]);
    p.paint(7.0, 0.25, 0.25, 0.25, () => PAL_HD.snow[6]);
  }
  p.paint(7.5, 0.5, 0.5, 1.0, (_x, y) => (fine && y > 1.25 ? PAL_HD.steel[2] : PAL_HD.ink[0]));
}

/** The one big two-handed gun (19 × 8): skeleton stock, receiver, carry handle, vented shroud, drum, grips. */
function drawHeavy(p: Pen): void {
  const c = p.c;
  const d = c.d;
  const fine = d >= 4;
  const steel = steelMat(c);
  const dark = polymerMat(c);
  const rubber = rubberMat(c);
  const olive = c.material({ ramp: PAL_HD.olive, spec: 0.35, shine: 14, gain: 1.05 });
  // Skeleton stock: a lit steel frame round a dark opening, a ribbed rubber butt pad.
  const stock = c.newPart();
  p.blob([[0.4, 1], [2.2, 1], [4.6, 1.8], [4.6, 4.9], [1.6, 4.9], [0.4, 5.9]], 0.45, { mat: steel, z: 0, part: stock, bulge: 0.1, tone: -0.12, tex: wear(41, 0.6) });
  p.shade(1.2, 2.2, 3.0, 1.7, (x, y) => {
    const inside = y > 2.45 && y < 3.6 && x > 1.4 && x < 3.95 - (3.6 - y) * 0.3;
    return inside ? -0.65 : 0;
  }, stock);
  p.box(0, 0.9, 0.7, 5.2, { mat: rubber, z: 0.3, bevel: 0.25, r: 0.3, tex: fine ? (s) => { if (line(s.y, 0.6, s.d)) s.tone -= 0.3; } : null });
  // Pistol grip (chequered at 4×) and the trigger guard.
  p.blob([[4.85, 4.3], [6.5, 4.3], [6.7, 7], [5.2, 7]], 0.45, { mat: dark, z: 0.3, bulge: 0.1, tex: fine ? chequer(42) : null });
  p.stroke([[6.6, 4.6], [6.9, 5.7], [7.7, 5.5]], 0.22, 0.22, { mat: steel, z: 0.25, tone: -0.15 });
  // Receiver: lit box, rivets (4×), ejection port, bolt handle.
  const rec = c.newPart();
  p.box(4, 1.8, 6.4, 2.6, { mat: steel, z: 1, bevel: 0.55, r: 0.3, part: rec, tone: -0.15, tex: wear(43, fine ? 1 : 0.5) });
  if (fine) p.shade(6.4, 2.3, 2.2, 0.8, (_x, y) => (y < 2.3 + 0.65 ? -0.55 : 0.25), rec);
  if (fine) for (const [rx, ry] of [[4.6, 2.4], [4.6, 3.8], [9.7, 2.4], [9.7, 3.8]] as const) screw(p, rx, ry, 0.22, false);
  p.capsule(7.1, 2.75, 8.2, 2.75, 0.3, 0.3, { mat: steel, z: 1.8 });
  // Carry handle over a gap.
  p.stroke([[4.8, 1.95], [5.3, 0.5], [8.4, 0.5], [9.1, 1.95]], 0.45, 0.45, { mat: steel, z: 1.3, tone: -0.05 });
  // Barrel shroud: a lying cylinder with round vents (dark holes with a lit lower lip).
  const shroud = c.newPart();
  p.cylinder(10.2, 1.85, 8.0, 2.6, { mat: steel, z: 1.1, axis: 'h', part: shroud, tex: wear(44, 0.7) });
  p.paint(10.5, 2.4, 7.5, 1.4, (x, y) => {
    const k = Math.round((x - 11.5) / 2);
    if (k < 0 || k > 3) return 0;
    const vx = 11.5 + k * 2;
    const e = ((x - vx) / 0.45) ** 2 + ((y - 3.1) / 0.55) ** 2;
    if (e < 1) return fine && y > 3.1 + 0.55 * 0.45 && x > vx - 0.1 ? PAL_HD.steel[2] : PAL_HD.ink[0];
    return 0;
  });
  // Muzzle brake with a slot, the bore.
  p.box(17.9, 2.2, 1.1, 1.8, { mat: steel, z: 1.4, bevel: 0.3, r: 0.2 });
  if (fine) p.shade(18.2, 2.3, 0.4, 1.6, (_x, y) => (Math.abs(y - 3.1) < 0.25 ? -0.6 : 0));
  p.paint(18.5, 2.75, 0.5, 0.75, () => PAL_HD.ink[0]);
  // Lower rail with ribs.
  p.box(4, 4, 14.8, 1, { mat: steel, z: 0.8, bevel: 0.3, tone: -0.2, tex: (s) => { if (s.x > 10 && line(s.x, fine ? 0.75 : 1.5, s.d)) s.tone -= 0.35; } });
  // Drum magazine: olive, a rolled rim, a steel centre cap.
  p.ellipsoid(8.6, 6.1, 1.75, 1.85, {
    mat: olive,
    z: 1.4,
    tex: (s) => {
      if (s.d < 4) return;
      const r = Math.hypot(s.x - 8.6, s.y - 6.1);
      if (Math.abs(r - 1.2) < 0.18) s.tone -= 0.35;
      if (hash2(s.X, s.Y, 45) > 0.96) s.tone -= 0.15;
    },
  });
  p.ellipsoid(8.55, 6.05, 0.5, 0.5, { mat: steel, z: 2.4 });
  // Front grip with finger grooves.
  p.box(11.9, 4.5, 1.7, 2.5, { mat: dark, z: 0.4, bevel: 0.45, r: 0.35, tex: (s) => { if (s.y > 5.2 && line(s.y, fine ? 0.6 : 1, s.d, 0.1)) s.tone -= 0.35; } });
}

/** The enemy rifle (19 × 5): wooden stock and handguard with grain, steel receiver, curved magazine, barrel. */
function drawRifle(p: Pen): void {
  const c = p.c;
  const d = c.d;
  const fine = d >= 4;
  const steel = steelMat(c);
  const dark = polymerMat(c);
  const rubber = rubberMat(c);
  const wd = woodMat(c, PAL_HD.brown, 2, 6);
  // Stock: a soft wooden slab (lit top edge, dark belly) with grain, a dark butt plate.
  p.blob([[0.25, 1], [6.4, 1], [6.4, 3], [3.4, 3], [0.25, 4.15]], 0.6, { mat: wd, z: 0, bulge: 0.1, tex: wood({ seed: 51 }) });
  p.box(0, 0.95, 0.55, 3.25, { mat: rubber, z: 0.25, bevel: 0.2, r: 0.2 });
  // Curved magazine (forward), ribbed at 4×; the trigger guard with its trigger.
  p.blob([[7.1, 2.6], [8.9, 2.6], [10.0, 5], [8.25, 5]], 0.4, { mat: dark, z: 0.3, bulge: 0.05, tex: fine ? (s) => { if (s.y > 3.3 && line(s.y - s.x * 0.45, 0.75, s.d)) s.tone -= 0.3; } : null });
  p.stroke([[9.55, 2.9], [9.65, 3.55], [11.0, 3.5], [11.05, 2.9]], 0.2, 0.2, { mat: steel, z: 0.35, tone: -0.35 });
  if (fine) p.capsule(10.4, 2.95, 10.25, 3.35, 0.18, 0.14, { mat: dark, z: 0.3 });
  // Receiver: a lit box, the ejection port (4×), the rear sight block, a bolt knob.
  const rec = c.newPart();
  p.box(6, 1, 6.3, 2, { mat: steel, z: 1, bevel: 0.45, r: 0.2, part: rec, tone: -0.1, tex: wear(53, fine ? 1 : 0.5) });
  if (fine) p.shade(8.4, 1.3, 1.8, 0.55, (_x, y) => (y < 1.3 + 0.38 ? -0.6 : 0.25), rec);
  p.box(7, 0, 2, 1.25, { mat: steel, z: 0.9, bevel: 0.3, r: 0.3 });
  if (fine) p.paint(7.8, 0, 0.4, 0.25, () => PAL_HD.ink[1]);
  // Handguard: wood with three oval vents (4×) between lit bands.
  const hg = c.newPart();
  p.box(12, 1, 4.3, 2, { mat: wd, z: 1, bevel: 0.45, r: 0.35, part: hg, tex: wood({ seed: 53 }) });
  if (fine) {
    p.paint(12.5, 1.5, 3.3, 0.75, (x, y) => {
      const k = Math.round((x - 13.0) / 1.0);
      if (k < 0 || k > 2) return 0;
      const e = ((x - (13.0 + k)) / 0.3) ** 2 + ((y - 1.85) / 0.26) ** 2;
      return e < 1 ? (y > 1.95 ? PAL_HD.brown[3] : PAL_HD.brown[0]) : 0;
    });
  }
  // Barrel, gas tube, front sight post, bore.
  p.cylinder(16, 1.05, 3, 1.15, { mat: steel, z: 1, axis: 'h' });
  p.cylinder(16, 2.15, 1.6, 0.7, { mat: steel, z: 0.9, axis: 'h', tone: -0.1 });
  p.box(17.6, 0.3, 0.5, 0.9, { mat: steel, z: 1.2, bevel: 0.2 });
  p.paint(18.6, 1.3, 0.4, 0.6, () => PAL_HD.ink[0]);
}

/** The HD gun: (w·d) × (h·d) of gunArt(kind).buf; grip, grip2 and muzzle as gunArt(kind). */
export function gunArtHd(kind: GunKind, d: HdDensity): PixelBuffer {
  return cached(`gun:${kind}:${d}`, () => {
    const lo = gunArt(kind).buf;
    const p = new Pen(lo.w, lo.h, d);
    if (kind === 'pistol') drawPistol(p);
    else if (kind === 'heavy') drawHeavy(p);
    else drawRifle(p);
    return p.c.render(RENDER);
  });
}

/** gunArtHd with the 1× logical points (grip, grip2, muzzle: logical px, unchanged). */
export function gunHd(kind: GunKind, d: HdDensity): GunArt {
  const lo = gunArt(kind);
  return { buf: gunArtHd(kind, d), grip: lo.grip, grip2: lo.grip2, muzzle: lo.muzzle };
}

// ------------------------------------------------------------------------------------ held items

/** HD held item: (w·d) × (h·d) of grenadeArt / snackArt / giftArt. */
export function heldArtHd(item: 'grenade' | 'snack' | 'gift', d: HdDensity): PixelBuffer {
  return cached(`held:${item}:${d}`, () => {
    const lo = item === 'grenade' ? grenadeArt() : item === 'gift' ? giftArt() : snackArt();
    const p = new Pen(lo.w, lo.h, d);
    if (item === 'grenade') drawGrenade(p);
    else if (item === 'gift') drawGift(p);
    else drawSnack(p);
    return p.c.render(RENDER);
  });
}

/** Grenade (5 × 6): a segmented olive body, the fuse, a spoon lever down the side, the pin ring. */
function drawGrenade(p: Pen): void {
  const c = p.c;
  const steel = steelMat(c);
  const olive = c.material({ ramp: PAL_HD.olive, spec: 0.4, shine: 14, gain: 1.1 });
  p.ellipsoid(2.5, 3.95, 2.45, 2.05, {
    mat: olive,
    z: 0,
    tex: (s) => {
      // Pineapple segments: grooves bend round the body (the normal tilts at each groove).
      const gx = ((((s.x - 0.3) / 1.2) % 1) + 1) % 1;
      const gy = ((((s.y - 2.2) / 1.0) % 1) + 1) % 1;
      if (gx < 1 / s.d || gy < 1 / s.d) s.tone -= 0.35;
      else {
        s.nx += (gx - 0.5) * 0.5;
        s.ny += (gy - 0.5) * 0.5;
      }
    },
  });
  p.box(1.7, 1.0, 1.9, 1.3, { mat: steel, z: 1, bevel: 0.35, r: 0.25 });
  p.stroke([[2.2, 0.75], [3.6, 0.55], [4.3, 1.4], [4.55, 2.9]], 0.3, 0.26, { mat: steel, z: 2.2, tone: 0.05 });
  // The pin ring (a thin loop; the hole stays open).
  p.stroke([[1.6, 0.9], [1.0, 0.35], [0.5, 0.9], [1.0, 1.5], [1.6, 1.05]], 0.2, 0.2, { mat: steel, z: 2.4, tone: 0.1 });
}

/** Gift (6 × 6): a box with a polka-dot paper and a lit top face, a red ribbon, a bow with two loops. */
function drawGift(p: Pen): void {
  const c = p.c;
  const box = c.material({ ramp: PAL_HD.sky, spec: 0.25, shine: 12 });
  const rib = c.material({ ramp: PAL_HD.red, spec: 0.55, shine: 18, gain: 1.1 });
  const dots: Texture = (s) => {
    const k = s.d >= 4 ? 1.2 : 1.5;
    const gx = s.x / k;
    const gy = s.y / k + (Math.floor(gx) & 1) * 0.5;
    if (Math.hypot(gx - Math.floor(gx) - 0.5, gy - Math.floor(gy) - 0.5) < (s.d >= 4 ? 0.22 : 0.18)) s.tone += 0.45;
  };
  p.box(0, 2.6, 6, 3.4, { mat: box, z: 0, bevel: 0.45, r: 0.15, tex: dots });
  p.box(0, 2.0, 6, 0.75, { mat: box, z: 0.6, bevel: 0.25, r: 0.1, tone: 0.25 });
  p.box(2.45, 2.0, 1.1, 4.0, { mat: rib, z: 0.9, bevel: 0.3 });
  // Bow: two loops (with dark insides), a knot.
  for (const sx of [1.55, 4.45]) {
    p.ellipsoid(sx, 1.05, 1.25, 0.85, { mat: rib, z: 1.4 });
    p.shade(sx - 0.6, 0.8, 1.2, 0.6, (x, y) => (Math.hypot((x - sx) / 0.55, (y - 1.1) / 0.32) < 1 ? -0.6 : 0));
  }
  p.ellipsoid(3, 1.45, 0.6, 0.55, { mat: rib, z: 1.9 });
}

/** Sandwich (7 × 5): two slices of bread with a crust, a wavy lettuce leaf, a tomato slice and cheese between them. */
function drawSnack(p: Pen): void {
  const c = p.c;
  const fine = c.d >= 4;
  const bread = c.material({ ramp: PAL_HD.sand, spec: 0.1, shine: 10, gain: 1.0, lo: 2 });
  const leaf = c.material({ ramp: PAL_HD.green, lo: 3, spec: 0.35, shine: 14 });
  const tom = c.material({ ramp: PAL_HD.red, lo: 3, spec: 0.6, shine: 20 });
  const cheese = c.material({ ramp: PAL_HD.gold, lo: 3, spec: 0.3 });
  // A crumb texture and a darker crust round the edge of each slice.
  const slice = (y0: number, h: number): Texture => (s) => {
    const e = Math.min(s.x - 0.05, 6.95 - s.x, s.y - y0, y0 + h - s.y);
    if (e < 0.55 / s.d + 0.15) s.tone -= 0.45;
    else if (s.d >= 4 && hash2(s.X, s.Y, 71) > 0.9) s.tone -= 0.12;
  };
  p.box(0, 3.0, 7, 2.0, { mat: bread, z: 0, bevel: 0.4, r: 0.6, tex: slice(3.0, 2.0) });
  // The filling (the 1× row 2): a wavy leaf across, the tomato slice, a cheese corner at 4×.
  if (fine) p.box(4.6, 2.55, 2.2, 0.65, { mat: cheese, z: 0.5, bevel: 0.2 });
  p.box(0, 1.75, 7, 1.5, {
    mat: leaf,
    z: 0.6,
    bevel: 0.3,
    tex: (s) => {
      const w = Math.sin(s.x * (fine ? 4.2 : 2.6));
      if (s.y > 2.95 + w * 0.22) s.cut = true;
      s.ny -= Math.cos(s.x * (fine ? 4.2 : 2.6)) * 0.35;
    },
  });
  p.ellipsoid(3.7, 2.45, 1.15, 0.6, { mat: tom, z: 0.9, tex: fine ? (s) => { if (Math.hypot((s.x - 3.7) / 1.15, (s.y - 2.45) / 0.6) < 0.45) s.tone += 0.2; } : null });
  p.box(0, 0, 7, 2.0, { mat: bread, z: 1, bevel: 0.45, r: 0.6, tex: slice(0, 2.0) });
}

// ------------------------------------------------------------------------------------ knife

/** HD knife: (8·d) × (3·d) of knifeArt (handle at x 0..2, the edge down). */
export function knifeArtHd(d: HdDensity): PixelBuffer {
  return cached(`knife:${d}`, () => {
    const lo = knifeArt();
    const p = new Pen(lo.w, lo.h, d);
    const c = p.c;
    const steel = steelMat(c);
    const dark = polymerMat(c);
    const wrap = c.material({ ramp: PAL_HD.brown, lo: 2, spec: 0.2, shine: 10 });
    // Pommel, a cord-wrapped handle, the guard.
    p.box(0, 0.75, 0.75, 1.5, { mat: dark, z: 0.3, bevel: 0.3, r: 0.3 });
    p.box(0.6, 0.85, 2.4, 1.3, { mat: wrap, z: 0, bevel: 0.35, r: 0.3, tex: d >= 4 ? (s) => { if (line(s.x + s.y * 0.5, 0.55, s.d)) s.tone -= 0.4; } : null });
    p.box(2.8, 0.15, 0.6, 2.7, { mat: steel, z: 0.7, bevel: 0.25, r: 0.2 });
    // Blade (a drop point on the middle row, as the 1× knife): a flat face (tilted up, lit), a
    // bevel down to the edge (tilted down), a fuller groove, a lit spine at 4×.
    const spine = (x: number): number => (x < 6.4 ? 0.12 : 0.12 + (x - 6.4) * 0.77);
    const edge = (x: number): number => (x < 5.4 ? 2.75 : 2.75 - 1.4 * ((x - 5.4) / 2.6) ** 1.5);
    p.plane(3.3, 0, 4.7, 3, {
      mat: steel,
      z: 0.35,
      mask: (x, y) => x < 8 && y > spine(x) && y < edge(x),
      normal: (x, y, n) => {
        const up = y < (spine(x) + edge(x)) / 2 + 0.2;
        n[0] = up ? -0.1 : 0.1;
        n[1] = up ? -0.4 : 0.6;
        n[2] = up ? 0.9 : 0.78;
      },
      tex: (s) => {
        if (s.x > 3.6 && s.x < 6.0 && Math.abs(s.y - 0.95) < 0.6 / s.d + 0.05) s.tone -= 0.45;
      },
    });
    if (d >= 4) p.paint(3.6, 0.1, 3.0, 0.3, (x, y) => (y > spine(x) && x < 6.4 ? PAL_HD.steel[7] : 0), 3);
    return c.render(RENDER);
  });
}

// ------------------------------------------------------------------------------------ props

/**
 * HD knife-look prop: (w·d) × (h·d) of propArt(kind).buf; grip and tip as propArt(kind). Every
 * prop is drawn natively (no re-lit 1× drawing).
 */
export function propArtHd(kind: PropKind, d: HdDensity): PixelBuffer {
  return cached(`prop:${kind}:${d}`, () => {
    const lo = propArt(kind).buf;
    const p = new Pen(lo.w, lo.h, d, 0, kind === 'pistol-butt');
    PROP_DRAW[kind](p);
    return p.c.render(RENDER);
  });
}

/** propArtHd with the 1× logical points (grip, tip) and the 1× ramp. */
export function propHd(kind: PropKind, d: HdDensity): PropArt {
  const lo = propArt(kind);
  return { buf: propArtHd(kind, d), grip: lo.grip, tip: lo.tip, ramp: lo.ramp };
}

const PROP_DRAW: Readonly<Record<PropKind, (p: Pen) => void>> = {
  // A rolled-up battle plan: cream paper, a blue line spiralling round it, the end-on roll with its spiral.
  plan: (p) => {
    const c = p.c;
    const paper = c.material({ ramp: PAL_HD.sand, spec: 0.15, shine: 10, gain: 1.05, lo: 2 });
    const ink = c.material({ ramp: PAL_HD.sky, spec: 0.1, lo: 0 });
    p.cylinder(0.4, 0.15, 8.8, 2.75, {
      mat: paper,
      z: 0,
      axis: 'h',
      tex: (s) => {
        const t = s.x * 0.6 + s.y * 0.75;
        if (s.x > 2.6 && line(t, 1.6, s.d, 0.4)) s.mat = ink;
        if (s.d >= 4 && line(s.x * 0.2 - s.y, 0.9, s.d) && s.x < 2.5) s.tone -= 0.2;
      },
    });
    p.ellipsoid(9.2, 1.5, 0.75, 1.4, {
      mat: paper,
      z: 3,
      round: 0.5,
      tex: (s) => {
        const r = Math.hypot((s.x - 9.2) / 0.75, (s.y - 1.5) / 1.4) + Math.atan2(s.y - 1.5, s.x - 9.2) * 0.05;
        if (line(r, 0.32, s.d * 2.5)) s.tone -= 0.5;
      },
    });
  },
  // The pistol held by its barrel (mirrored), the butt swinging forward.
  'pistol-butt': (p) => drawPistol(p),
  // A plunger: a varnished wooden stick, a glossy black rubber cup, its mouth to the front.
  plunger: (p) => {
    const c = p.c;
    const wd = woodMat(c);
    const rubber = c.material({ ramp: BLACK_ONE_HUE, spec: 0.8, shine: 26, gain: 1.1, rim: 0.5 });
    p.capsule(0.4, 2.5, 8.6, 2.5, 0.5, 0.5, { mat: wd, z: 0, tex: wood({ seed: 61 }) });
    if (p.c.d >= 4) p.shade(0.3, 2, 1.2, 1, (x) => (Math.abs(x - 0.9) < 0.12 ? -0.4 : 0));
    p.ellipsoid(9.2, 2.5, 1.55, 2.45, { mat: rubber, z: 0.8 });
    // The lip of the mouth: a rolled rim, a dark hollow showing at its edge.
    p.box(10.25, 0.1, 0.75, 4.8, { mat: rubber, z: 1.2, bevel: 0.35, r: 0.35, tone: 0.15 });
    p.shade(10.5, 0.9, 0.4, 3.2, () => -0.5);
  },
  // A model airliner held under the belly: white fuselage, a blue cheat line and fin, a window row, a wing and engine.
  airliner: (p) => {
    const c = p.c;
    const d = c.d;
    const white = c.material({ ramp: PAL_HD.snow, spec: 0.7, shine: 24, gain: 1.05, lo: 1 });
    const blue = c.material({ ramp: PAL_HD.sky, spec: 0.5, shine: 20 });
    const grey = steelMat(c);
    p.poly([[0, 0], [1.1, 0], [2.6, 1.7], [0.5, 1.9]], { mat: blue, z: 0.2 });
    p.capsule(0.9, 2.45, 9.1, 2.45, 0.95, 1.05, {
      mat: white,
      z: 0.6,
      tex: (s) => {
        if (s.y > 2.8 && s.y < 2.8 + 1.4 / s.d) s.mat = blue;
      },
    });
    // Windows (art-px squares on a d-aware pitch) and the cockpit.
    const step = d >= 4 ? 0.75 : 1.5;
    p.paint(2, 1.95, 6.6, 0.5, (x, y) => ((x - 2) % step < 0.5 && y < 1.95 + 1 / d ? PAL_HD.glass[2] : 0));
    p.paint(8.6, 1.75, 0.7, 0.55, (x, y) => (y < 1.75 + 1 / d && x < 9.2 ? PAL_HD.glass[1] : 0));
    // Wing root and engine under it.
    p.poly([[4.2, 2.9], [6.8, 2.9], [5.9, 4], [4.7, 4]], { mat: grey, z: 1.4, tone: -0.1 });
    p.capsule(5.0, 3.55, 6.0, 3.55, 0.38, 0.38, { mat: grey, z: 1.8 });
  },
  // A frikandel: a glossy brown sausage, mayonnaise and curry zigzags, diced onion at 4×.
  frikandel: (p) => {
    const c = p.c;
    const meat = c.material({ ramp: PAL_HD.brown, spec: 0.55, shine: 18, gain: 1.1 });
    const mayo = c.material({ ramp: PAL_HD.snow, lo: 3, spec: 0.6, shine: 18 });
    const curry = c.material({ ramp: PAL_HD.red, lo: 4, spec: 0.6, shine: 18 });
    p.capsule(1.35, 1.75, 9.1, 1.75, 1.1, 1.15, { mat: meat, z: 0, tex: (s) => { s.tone += (noise2(s.x, s.y, 0.8, 63) - 0.5) * 0.25; } });
    const zig = (y0: number, a: number, off: number): Pt[] => {
      const pts: Pt[] = [];
      for (let x = 2.3 + off; x <= 8.8; x += 1.3) pts.push([x, y0 + (pts.length & 1 ? a : -a)]);
      return pts;
    };
    p.capsule(2.0, 0.85, 8.9, 0.85, 0.4, 0.4, { mat: mayo, z: 1.6 });
    p.stroke(zig(0.8, 0.3, 0), 0.3, 0.3, { mat: curry, z: 1.8 });
    if (c.d >= 4) {
      for (const [ox, oy] of [[3.0, 0.9], [5.1, 0.6], [6.9, 1.0], [8.0, 0.65]] as const) p.paint(ox, oy, 0.5, 0.5, () => PAL_HD.sand[6], 5);
    }
  },
  // A furled black umbrella: wooden crook, a glossy wrapped canopy with folds and a strap, a steel ferrule.
  umbrella: (p) => {
    const c = p.c;
    const wd = woodMat(c);
    const cloth = c.material({ ramp: BLACK_ONE_HUE, spec: 0.45, shine: 16, gain: 1.1, rim: 0.4 });
    const steel = steelMat(c);
    p.stroke([[3.9, 2.5], [0.75, 2.5], [0.45, 3.4], [0.8, 4.4], [1.75, 4.45]], 0.5, 0.42, { mat: wd, z: 0.3, tex: wood({ seed: 64, dir: 'h' }) });
    p.capsule(3.2, 2.5, 14.2, 2.5, 0.3, 0.3, { mat: cloth, z: 0, tone: -0.1 });
    p.blob(
      [[4.2, 2.5], [5.1, 1.05], [10.4, 1.2], [12.6, 2.5], [10.4, 3.85], [5.1, 3.95]],
      0.9,
      {
        mat: cloth,
        z: 0.5,
        tex: (s) => {
          // Diagonal folds of the furled cloth.
          const f = (((s.x * 0.8 - s.y * 0.6) % 1.3) + 1.3) % 1.3;
          s.nx += f < 0.65 ? -0.35 : 0.35;
        },
      },
    );
    p.box(7.6, 1.0, 0.75, 3.0, { mat: cloth, z: 1.6, bevel: 0.25, r: 0.2, tone: -0.15 });
    p.ellipsoid(7.95, 2.5, 0.32, 0.32, { mat: steel, z: 2.4 });
    p.capsule(12.6, 2.5, 15.75, 2.5, 0.35, Math.max(0.2, 0.55 / c.d + 0.02), { mat: steel, z: 0.6 });
  },
  // Two knitting needles: thin lit steel shafts, round glossy red beads.
  needles: (p) => {
    const c = p.c;
    const steel = steelMat(c);
    const bead = c.material({ ramp: PAL_HD.red, spec: 0.8, shine: 26, gain: 1.1 });
    // Shafts taper, but never thinner than one art px row through the centre line.
    const rMin = 0.55 / c.d + 0.02;
    for (const y of [0.5, 2.5]) {
      p.capsule(1.5, y, 10.7, y, 0.42, Math.max(0.22, rMin), { mat: steel, z: 0.5 });
      p.ellipsoid(0.85, y, 0.85, 0.5, { mat: bead, z: 1 });
    }
  },
  // A frying pan in 3/4 view: a wrapped handle with rivets, a lit steel rim, a dark glossy dish with a glint.
  pan: (p) => {
    const c = p.c;
    const d = c.d;
    const steel = steelMat(c);
    const handle = polymerMat(c);
    const dish = c.material({ ramp: BLACK_ONE_HUE, spec: 0.9, shine: 30, gain: 1.15, lo: 1 });
    p.capsule(0.4, 3.5, 5.6, 3.5, 0.5, 0.6, { mat: handle, z: 0, tex: (s) => { if (s.x < 4.2 && line(s.x, 0.7, s.d)) s.tone -= 0.35; } });
    if (d >= 4) p.erase(0.7, 3.2, 0.6, 0.6, (x, y) => Math.hypot(x - 1.0, y - 3.5) < 0.22);
    p.ellipsoid(8.75, 3.5, 3.95, 3.45, { mat: steel, z: 0.6, round: 0.8, tex: wear(66, 0.6) });
    p.plane(5.6, 0.8, 6.4, 5.5, {
      mat: dish,
      z: 6,
      mask: (x, y) => Math.hypot((x - 8.85) / 2.95, (y - 3.65) / 2.6) < 1,
      normal: (x, y, n) => {
        n[0] = ((8.85 - x) / 2.95) * 0.55;
        n[1] = ((3.65 - y) / 2.6) * 0.55;
        n[2] = 1;
      },
    });
    for (const ry of [3.05, 3.95]) p.paint(5.0, ry - 0.25, 0.5, 0.5, (x, y) => (Math.hypot(x - 5.25, y - ry) < (d >= 4 ? 0.2 : 0.3) ? PAL_HD.steel[6] : 0), 3);
  },
  // A big open-end wrench: a flat lit handle with a recessed channel, a C-shaped jaw open to the front.
  wrench: (p) => {
    const c = p.c;
    const d = c.d;
    const steel = steelMat(c);
    const h = c.newPart();
    p.box(0, 2.05, 8.6, 1.9, { mat: steel, z: 0, bevel: 0.55, r: 0.6, part: h, tex: wear(67) });
    p.shade(1.1, 2.6, 6.2, 0.8, (_x, y) => (y < 2.6 + 1 / d ? -0.35 : y > 3.4 - 1 / d ? 0.2 : -0.1), h);
    const jaw: Pt[] = [];
    const cx = 10.0;
    const cy = 3.0;
    for (let a = 40; a <= 320; a += 20) jaw.push([cx + Math.cos((a * Math.PI) / 180) * 2.85, cy - Math.sin((a * Math.PI) / 180) * 2.95]);
    for (let a = 320; a >= 40; a -= 20) jaw.push([cx + 0.55 + Math.cos((a * Math.PI) / 180) * 1.35, cy - Math.sin((a * Math.PI) / 180) * 1.45]);
    p.blob(jaw, 0.7, { mat: steel, z: 0.2, tex: wear(68) });
  },
};

// ------------------------------------------------------------------------------------ hands

/** Skin ramps take a softer, less glossy light than gloves. */
function isSkin(r: Ramp): boolean {
  return r === PAL_HD.skinA || r === PAL_HD.skinB || r === PAL_HD.skinC;
}

/** Index of the HD ramp tone nearest to colour c (RGB distance). */
function nearestTone(hd: Ramp, c: Color): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < hd.length; i++) {
    const h = hd[i];
    const dr = ((h >>> 24) & 255) - ((c >>> 24) & 255);
    const dg = ((h >>> 16) & 255) - ((c >>> 16) & 255);
    const db = ((h >>> 8) & 255) - ((c >>> 8) & 255);
    const q = dr * dr + dg * dg + db * db;
    if (q < bd) {
      bd = q;
      best = i;
    }
  }
  return best;
}

/**
 * The hand's diffuse tone range on its HD ramp: the given ramp's darkest..lightest tones mapped
 * onto the HD ramp (so a glove or a skin keeps the value of today's hand), never index 0 (kept
 * for creases) nor the top tone (kept for the specular). Skin starts at the head's skin floor.
 */
function handTones(src: Ramp, hd: Ramp): { lo: number; hi: number } {
  const n = hd.length;
  let lo = src === hd ? 1 : nearestTone(hd, src[0]);
  let hi = src === hd ? n - 2 : nearestTone(hd, src[src.length - 1]);
  if (isSkin(hd)) lo = Math.max(lo, n > 6 ? 3 : 1);
  lo = Math.max(1, Math.min(lo, n - 3));
  hi = Math.max(lo + 2, Math.min(hi, n - 2));
  return { lo, hi };
}

/** Signed distance to a rounded box centred (cx, cy) with half sizes hw, hh and corner radius r (negative inside). */
function sdRoundBox(x: number, y: number, cx: number, cy: number, hw: number, hh: number, r: number): number {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * A curled fist as one lit height field in local template coordinates: the back of the hand
 * (rolling away at the edges); in front of the knuckle line `kx` the curled fingers as `n`
 * stacked rolls (each lit on top, shaded below) with a crease between them; optionally the thumb
 * as a raised ridge from `t0` to `t1` with a crease under it. At 4× each finger root carries a
 * lit knuckle bump.
 */
interface FistSpec {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  r: number;
  /** Knuckle line (fingers in front of it, +x). */
  kx: number;
  /** Finger rolls from fy0, n of them, bh tall each. */
  fy0: number;
  bh: number;
  n: number;
  knuckles: boolean;
  /** Thumb ridge (local points) and its radius; tr 0 = none. */
  t0: Pt;
  t1: Pt;
  tr: number;
}

/** Position of (x, y) along the segment a-b (0 at a, 1 at b; unclamped). */
function segT(x: number, y: number, a: Pt, b: Pt): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  return l2 === 0 ? 0 : ((x - a[0]) * vx + (y - a[1]) * vy) / l2;
}

/** Distance from (x, y) to the segment a-b. */
function segDist(x: number, y: number, a: Pt, b: Pt): number {
  let t = segT(x, y, a, b);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - a[0] - (b[0] - a[0]) * t, y - a[1] - (b[1] - a[1]) * t);
}

function fistHeight(x: number, y: number, F: FistSpec): number {
  const dist = sdRoundBox(x, y, F.cx, F.cy, F.hw, F.hh, F.r);
  if (dist > 0) return NaN;
  const edge = 0.85;
  const e = Math.min(1, -dist / edge);
  let h = edge * Math.sqrt(1 - (1 - e) * (1 - e));
  if (x > F.kx - 0.2) {
    const t = (y - F.fy0) / F.bh;
    if (t > 0 && t < F.n) {
      const f = t - Math.floor(t);
      const w = Math.min(1, (x - F.kx + 0.2) / 0.55);
      h += (Math.sin(Math.PI * f) * 0.4 - 0.2) * w;
      if (F.knuckles) {
        const dk = x - F.kx;
        h += 0.3 * Math.exp(-(dk * dk) / 0.05) * Math.sin(Math.PI * f);
      }
    }
  }
  if (F.tr > 0) {
    const q = segDist(x, y, F.t0, F.t1);
    if (q < F.tr) h = Math.max(h, edge + 0.15 + F.tr * Math.sqrt(1 - (q / F.tr) * (q / F.tr)));
  }
  return h;
}

/** The fist's creases (local coordinates): between the finger rolls and under the thumb. */
function fistCreases(p: Pen, F: FistSpec): Texture {
  const px = 1 / p.c.d;
  return p.tex((s, x, y) => {
    if (x > F.kx + 0.05) {
      const t = (y - F.fy0) / F.bh;
      if (t > 0.5 && t < F.n) {
        const f = (t - Math.floor(t)) * F.bh;
        if (f < px) s.tone -= p.c.d >= 4 ? 0.7 : 0.45;
      }
    }
    if (F.tr > 0) {
      // Under the ridge only (the side away from the light), along it, not round its ends.
      const t = segT(x, y, F.t0, F.t1);
      if (t > 0.1 && t < 1) {
        const q = segDist(x, y, F.t0, F.t1);
        const below = y > F.t0[1] + (F.t1[1] - F.t0[1]) * t;
        if (below && q >= F.tr && q < F.tr + px * 1.05) s.tone -= 0.45;
      }
    }
  });
}

function fistAt(p: Pen, m: number, F: FistSpec): void {
  p.heightField(F.cx - F.hw, F.cy - F.hh, F.hw * 2, F.hh * 2, (x, y) => fistHeight(x, y, F), { mat: m, z: 0, tex: fistCreases(p, F) });
}

/** The fist of `shape` fist / grip (inset 0.5: the gun-grip fist is smaller, so the gun shows round it). */
function drawFist(p: Pen, m: number, inset: number): void {
  const d = p.c.d;
  const x0 = inset;
  const y0 = inset;
  const s = 4 - inset * 2;
  const n = d >= 4 ? (inset > 0 ? 3 : 4) : 2;
  const k = s / 4;
  fistAt(p, m, {
    cx: x0 + s / 2,
    cy: y0 + s / 2,
    hw: s / 2,
    hh: s / 2,
    r: s * 0.42,
    kx: x0 + s * 0.55,
    fy0: y0 + s * 0.3,
    bh: (s * 0.66) / n,
    n,
    knuckles: d >= 4,
    t0: [x0 + 0.85 * k, y0 + 1.0 * k],
    t1: [x0 + (d >= 4 ? 2.9 : 2.6) * k, y0 + 1.15 * k],
    tr: d >= 4 ? 0.42 * k : 0.5 * k,
  });
}

/**
 * One hand per shape in its local template frame (pointing forward, +x), as the 1× template:
 * fist / grip (4 × 4), point (7 × 4: the index finger along row 1), open (6 × 4: fingers up and
 * forward), thumb (5 × 5: the thumb up at x 1).
 */
const HAND_DRAW: Readonly<Record<HandShape, (p: Pen, m: number) => void>> = {
  fist: (p, m) => drawFist(p, m, 0),
  grip: (p, m) => drawFist(p, m, 0.5),
  point: (p, m) => {
    const d = p.c.d;
    const n = d >= 4 ? 3 : 2;
    // The fist body (rows 0..4, x 0..4) with the three curled fingers below the index finger.
    fistAt(p, m, { cx: 2, cy: 2, hw: 1.95, hh: 1.95, r: 1.5, kx: 2.3, fy0: 2.05, bh: 1.65 / n, n, knuckles: d >= 4, t0: [0, 0], t1: [0, 0], tr: 0 });
    // The index finger along row 1 to x 7 (a crease at its middle joint at 4×).
    p.capsule(2.3, 1.5, 6.55, 1.45, 0.5, 0.44, {
      mat: m,
      z: 1.1,
      tex: d >= 4 ? p.tex((s, x) => { if (Math.abs(x - 4.7) < 0.13) s.tone -= 0.3; }) : null,
    });
    // The thumb over the top.
    p.capsule(0.9, 0.85, 2.55, 0.8, 0.42, 0.36, { mat: m, z: 1.6 });
  },
  open: (p, m) => {
    const d = p.c.d;
    // Palm low left, fingers spread up and forward, the thumb low.
    p.blob([[0.1, 2.0], [1.4, 1.2], [3.6, 1.3], [4.3, 2.4], [3.4, 3.8], [1.0, 3.8]], 0.8, { mat: m, z: 0 });
    const tip = d >= 4 ? p.tex((s, _x, y) => { if (y < 0.75) s.tone += 0.08; }) : null;
    p.capsule(2.9, 2.0, 3.5, 0.45, 0.45, 0.4, { mat: m, z: 0.9, tex: tip });
    p.capsule(3.4, 2.0, 4.45, 1.0, 0.45, 0.4, { mat: m, z: 0.5 });
    p.capsule(3.7, 2.2, 5.5, 0.5, 0.42, 0.38, { mat: m, z: 0.9, tex: tip });
    p.capsule(1.6, 3.2, 3.0, 3.5, 0.42, 0.38, { mat: m, z: 0.7 });
  },
  thumb: (p, m) => {
    const d = p.c.d;
    const n = d >= 4 ? 3 : 2;
    // A fist (rows 2..5) with the thumb raised straight up at x 1.
    fistAt(p, m, { cx: 2, cy: 3.5, hw: 1.95, hh: 1.45, r: 1.1, kx: 2.2, fy0: 2.45, bh: 2.2 / n, n, knuckles: d >= 4, t0: [0, 0], t1: [0, 0], tr: 0 });
    p.capsule(1.55, 2.7, 1.55, 0.5, 0.5, 0.46, { mat: m, z: 1.3, tex: d >= 4 ? p.tex((s, _x, y) => { if (Math.abs(y - 1.55) < 0.12) s.tone -= 0.3; }) : null });
  },
};

/**
 * THE HD HAND (the same idea as drawHand): draw a lit hand into `layer` (density d) with its
 * wrist on the logical point (x, y), turned `quarter` clockwise quarter turns (0 = forward, 1 =
 * down, 3 = up), `flipY` mirrored first. `ramp` = the glove or skin ramp (a 64-palette ramp or an
 * HD ramp; the HD ramp is found with hdRampOf and the hand keeps the value range of `ramp`);
 * `far` = the far hand, a step darker (pass the style's ramp, not a darkened copy). The hand
 * covers d times the turned 1× template's box with the wrist block at d times the 1× wrist px.
 * (x, y) may be fractional (joints at 1/d px): the wrist block lands on art px round(x·d).
 */
export function drawHandHd(
  layer: PixelBuffer,
  shape: HandShape,
  x: number,
  y: number,
  ramp: Ramp,
  quarter = 0,
  flipY = false,
  d: HdDensity = 2,
  far = false,
): void {
  const hand = handArtHd(shape, ramp, quarter, flipY, d, far);
  layer.blit(hand.buf, Math.round(x * d) - hand.wrist[0] * d, Math.round(y * d) - hand.wrist[1] * d);
}

const handCache = new Map<Ramp, Map<string, { buf: PixelBuffer; wrist: readonly [number, number] }>>();

/**
 * The HD hand buffer (the turned 1× template box × d) and its wrist (logical px in that box), as
 * drawHandHd places it. Cached per (HD ramp, ramp colours, shape, turn, flip, d, far).
 */
export function handArtHd(
  shape: HandShape,
  ramp: Ramp,
  quarter = 0,
  flipY = false,
  d: HdDensity = 2,
  far = false,
): { buf: PixelBuffer; wrist: readonly [number, number] } {
  const q = ((quarter % 4) + 4) % 4;
  // Per HD ramp, then by the given ramp's colours (two 64-palette ramps can share their colours
  // but map to different HD ramps, e.g. brown and skinC).
  const hdBase = hdRampOf(ramp);
  // Black gloves keep one hue (no purple / blue patches).
  const hd = oneHue(hdBase);
  let per = handCache.get(hd);
  if (!per) {
    per = new Map();
    handCache.set(hd, per);
  }
  const key = `${ramp.join(',')}|${shape}:${q}:${flipY ? 1 : 0}:${d}:${far ? 1 : 0}`;
  const hit = per.get(key);
  if (hit) return hit;
  const t = handTemplate(shape);
  const tw = t.rows[0].length;
  const th = t.rows.length;
  // The wrist px, turned exactly as drawHand turns it.
  let wx = t.wrist[0];
  let wy = flipY ? th - 1 - t.wrist[1] : t.wrist[1];
  let h = th;
  let w = tw;
  for (let i = 0; i < q; i++) {
    const nx = h - 1 - wy;
    wy = wx;
    wx = nx;
    const tt = w;
    w = h;
    h = tt;
  }
  const p = new Pen(tw, th, d, q, false, flipY);
  const skin = isSkin(hd);
  const { lo, hi } = handTones(ramp, hdBase);
  const m = p.c.material({
    ramp: hd,
    lo,
    hi,
    spec: skin ? 0.25 : 0.55,
    shine: skin ? 14 : 20,
    gain: skin ? 0.95 : 1.1,
    amb: skin ? 0.22 : 0.08,
    rim: 0.35,
    wrap: skin ? 0.2 : 0.05,
  });
  HAND_DRAW[shape](p, m);
  if (far) p.c.shade(0, 0, p.c.w, p.c.h, () => -0.22);
  // No rim px: a hand often lies inside the figure (on the torso), where a lit right edge reads as a halo.
  const res = { buf: p.c.render({ ...RENDER, ao: 0.25, sep: d >= 4, sepZ: 0.6, rimLight: 0 }), wrist: [wx, wy] as const };
  per.set(key, res);
  return res;
}
