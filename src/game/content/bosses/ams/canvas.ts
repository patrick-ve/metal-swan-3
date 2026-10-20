/**
 * ROBO-HALSEMA — the drawing canvases of her art.
 *
 * - `DCanvas`: the 1× canvas (PAL, docs/ART_GUIDE.md). Every call takes LOCAL logical coordinates
 *   (the anchor at 0, 0) and is exactly the PixelBuffer call the 1× art always made, so the 1×
 *   frames stay byte-identical.
 * - `HdPiece`: the UHD canvas of one 2× / 4× frame (docs/ART_GUIDE.md "UHD art"): the kit's
 *   `HdCanvas` (lit primitives, PAL_HD, outline A) addressed in the same LOCAL logical
 *   coordinates (floats; logical pixel (x, y) covers [x, x + 1) × [y, y + 1)). It is sized from
 *   the frame's 1× geometry (logical size and anchor) plus a clear margin, and `frame()` crops the
 *   margin away: the HD frame has exactly the 1× frame's size, anchor and points at every density.
 *   An optional turn about the anchor (the flying wig) moves every primitive natively; the key
 *   light stays upper left.
 */
import type { Color } from '../../../../engine/color';
import { INK, type Ramp } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, type DrawOpts, type HdMaterial, type RenderOpts, type TexSample, type Texture } from '../../../art/hd/canvas';
import { shadeBox } from '../m4/art-kit';

export type Pt = readonly [number, number];

/** [x0, y0, x1, y1) around the pixels of `b` with non-zero alpha, or null when it has none. */
function opaqueRect(b: PixelBuffer): [number, number, number, number] | null {
  const { w, h, data } = b;
  let y0 = 0;
  let y1 = h;
  const rowEmpty = (y: number): boolean => {
    for (let i = y * w, e = i + w; i < e; i++) if ((data[i] & 255) !== 0) return false;
    return true;
  };
  while (y0 < h && rowEmpty(y0)) y0++;
  if (y0 === h) return null;
  while (rowEmpty(y1 - 1)) y1--;
  let x0 = w;
  let x1 = 0;
  for (let y = y0; y < y1; y++) {
    const r = y * w;
    for (let x = 0; x < x0; x++) if ((data[r + x] & 255) !== 0) { x0 = x; break; }
    for (let x = w - 1; x >= x1; x--) if ((data[r + x] & 255) !== 0) { x1 = x + 1; break; }
  }
  return [x0, y0, x1, y1];
}

/** The 1× canvas: local logical coordinates over a PixelBuffer (one buffer px per logical px). */
export class DCanvas {
  readonly b: PixelBuffer;
  readonly x0: number;
  readonly y0: number;

  constructor(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = x0;
    this.y0 = y0;
    this.b = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
  }

  /** Buffer column of logical x. */
  X(lx: number): number {
    return Math.round(lx - this.x0);
  }

  /** Buffer row of logical y. */
  Y(ly: number): number {
    return Math.round(ly - this.y0);
  }

  /** Logical x of buffer column X. */
  lx(X: number): number {
    return this.x0 + X;
  }

  ly(Y: number): number {
    return this.y0 + Y;
  }

  /** A blank layer of the same size (draw a part flat, shade it, then `put` it). */
  layer(): PixelBuffer {
    return new PixelBuffer(this.b.w, this.b.h);
  }

  put(layer: PixelBuffer): this {
    // Only the rect around the layer's opaque pixels (a layer is mostly transparent): the same
    // result as blitting the whole layer, for a fraction of the work.
    const r = opaqueRect(layer);
    if (r) this.b.blit(layer, r[0], r[1], { sx: r[0], sy: r[1], sw: r[2] - r[0], sh: r[3] - r[1] });
    return this;
  }

  /** The colour at logical pixel (x, y). */
  at(x: number, y: number, L: PixelBuffer = this.b): Color {
    return L.get(this.X(x), this.Y(y));
  }

  rect(x: number, y: number, w: number, h: number, c: Color, L: PixelBuffer = this.b): this {
    L.rect(this.X(x), this.Y(y), w, h, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color, L: PixelBuffer = this.b): this {
    L.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
    return this;
  }

  /** One logical pixel. */
  set(x: number, y: number, c: Color, L: PixelBuffer = this.b): this {
    L.set(this.X(x), this.Y(y), c);
    return this;
  }

  /** Circle centred on logical pixel (x, y), radius r (diameter 2r + 1 logical px). */
  circle(x: number, y: number, r: number, c: Color, L: PixelBuffer = this.b): this {
    L.circle(this.X(x), this.Y(y), r, c);
    return this;
  }

  /** Ellipse in the logical box (x, y, w, h). */
  ellipse(x: number, y: number, w: number, h: number, c: Color, L: PixelBuffer = this.b): this {
    L.ellipse(this.X(x), this.Y(y), w, h, c);
    return this;
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: Color, L: PixelBuffer = this.b): this {
    L.roundRect(this.X(x), this.Y(y), w, h, r, c);
    return this;
  }

  /** Filled polygon through logical pixels (inclusive, like PixelBuffer.poly). */
  poly(pts: ReadonlyArray<Pt>, c: Color, L: PixelBuffer = this.b): this {
    L.poly(
      pts.map(([x, y]) => [this.X(x), this.Y(y)] as [number, number]),
      c,
    );
    return this;
  }

  /** Capsule `w` logical px wide between logical pixels (as PixelBuffer.capsule). */
  capsule(x0: number, y0: number, x1: number, y1: number, w: number, c: Color, L: PixelBuffer = this.b): this {
    L.capsule(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), w, c);
    return this;
  }

  /** shadeBox over a logical box. */
  shade(L: PixelBuffer, x: number, y: number, w: number, h: number, ramp: Ramp, round = true): this {
    shadeBox(L, this.X(x), this.Y(y), w, h, ramp, round);
    return this;
  }

  /** Visit every buffer pixel of the logical box [x0..x1] × [y0..y1] (inclusive) with its logical position. */
  each(x0: number, y0: number, x1: number, y1: number, fn: (X: number, Y: number, lx: number, ly: number) => void): void {
    const X0 = Math.max(0, this.X(x0));
    const Y0 = Math.max(0, this.Y(y0));
    const X1 = Math.min(this.b.w - 1, this.X(x1));
    const Y1 = Math.min(this.b.h - 1, this.Y(y1));
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) fn(X, Y, this.lx(X), this.ly(Y));
  }

  /** INK outline of the silhouette (1 px). */
  outline(): this {
    this.b.outline(INK);
    return this;
  }

  /** The finished frame: optional outline, anchor at local (0, 0). */
  frame(outline = true): Frame {
    if (outline) this.outline();
    return { buf: this.b, ox: this.X(0), oy: this.Y(0) };
  }
}

// ---------------------------------------------------------------------------------------------
// HD (2× / 4×)
// ---------------------------------------------------------------------------------------------

/** The logical geometry of a frame (its 1× twin): size and anchor. */
export interface FrameGeom {
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
}

/** The logical geometry of a 1× frame. */
export function geomOf(f: Frame): FrameGeom {
  const d = f.density ?? 1;
  return { w: f.buf.w / d, h: f.buf.h / d, ox: f.ox, oy: f.oy };
}

export interface HdPieceOpts {
  /** Clear logical px round the frame (room for the outline of shapes that touch the frame edge; cropped). Default 2. */
  margin?: number;
  /** The local point that sits on the frame anchor (default the local origin). */
  anchor?: Pt;
  /** Turn (radians, clockwise on screen) of the whole drawing about `anchor`. Default 0. */
  angle?: number;
}

/**
 * One HD frame of ROBO-HALSEMA: an HdCanvas in her LOCAL logical coordinates (floats). Every
 * primitive maps its points onto the canvas (turned about the anchor when `angle` ≠ 0; radii stay,
 * so turned art uses round shapes, polygons, capsules and fields only), then `frame(opts)` lights,
 * outlines and crops it to the 1× geometry.
 */
export class HdPiece {
  readonly c: HdCanvas;
  readonly d: number;
  readonly g: FrameGeom;
  readonly m: number;
  private readonly ax: number;
  private readonly ay: number;
  private readonly cs: number;
  private readonly sn: number;
  private readonly turned: boolean;
  private readonly tx: number;
  private readonly ty: number;

  constructor(g: FrameGeom, d: number, o: HdPieceOpts = {}) {
    this.g = g;
    this.d = d;
    this.m = o.margin ?? 2;
    this.ax = o.anchor?.[0] ?? 0;
    this.ay = o.anchor?.[1] ?? 0;
    const a = o.angle ?? 0;
    this.cs = Math.cos(a);
    this.sn = Math.sin(a);
    this.turned = a !== 0;
    this.tx = g.ox + this.m;
    this.ty = g.oy + this.m;
    this.c = new HdCanvas(g.w + 2 * this.m, g.h + 2 * this.m, d);
  }

  /** Canvas x of local (x, y). */
  cx(x: number, y: number): number {
    return this.turned ? this.cs * (x - this.ax) - this.sn * (y - this.ay) + this.tx : x - this.ax + this.tx;
  }

  cy(x: number, y: number): number {
    return this.turned ? this.sn * (x - this.ax) + this.cs * (y - this.ay) + this.ty : y - this.ay + this.ty;
  }

  /** Local x of canvas (X, Y) (logical canvas coordinates). */
  lx(X: number, Y: number): number {
    if (!this.turned) return X - this.tx + this.ax;
    const u = X - this.tx;
    const v = Y - this.ty;
    return this.cs * u + this.sn * v + this.ax;
  }

  ly(X: number, Y: number): number {
    if (!this.turned) return Y - this.ty + this.ay;
    const u = X - this.tx;
    const v = Y - this.ty;
    return -this.sn * u + this.cs * v + this.ay;
  }

  private pts(p: ReadonlyArray<Pt>): Array<[number, number]> {
    return p.map(([x, y]) => [this.cx(x, y), this.cy(x, y)] as [number, number]);
  }

  /** The canvas box of the local box (turned: its bounds). */
  private box4(x: number, y: number, w: number, h: number): [number, number, number, number] {
    if (!this.turned) return [x - this.ax + this.tx, y - this.ay + this.ty, w, h];
    const xs = [this.cx(x, y), this.cx(x + w, y), this.cx(x, y + h), this.cx(x + w, y + h)];
    const ys = [this.cy(x, y), this.cy(x + w, y), this.cy(x, y + h), this.cy(x + w, y + h)];
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
  }

  material(m: HdMaterial): number {
    return this.c.material(m);
  }

  newPart(): number {
    return this.c.newPart();
  }

  /** A texture written in LOCAL coordinates (s.x, s.y are local while it runs). */
  tex(fn: Texture): Texture {
    return (s: TexSample) => {
      const X = s.x;
      const Y = s.y;
      s.x = this.lx(X, Y);
      s.y = this.ly(X, Y);
      fn(s);
      s.x = X;
      s.y = Y;
    };
  }

  /** Ellipsoid centred (cx, cy) (turned art: keep rx = ry). */
  ell(cx: number, cy: number, rx: number, ry: number, o: DrawOpts): this {
    this.c.ellipsoid(this.cx(cx, cy), this.cy(cx, cy), rx, ry, o);
    return this;
  }

  /** Tapered capsule between local points. */
  cap(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, o: DrawOpts): this {
    this.c.capsule(this.cx(x0, y0), this.cy(x0, y0), this.cx(x1, y1), this.cy(x1, y1), r0, r1, o);
    return this;
  }

  stroke(p: ReadonlyArray<Pt>, r0: number, r1: number, o: DrawOpts): this {
    this.c.stroke(this.pts(p), r0, r1, o);
    return this;
  }

  poly(p: ReadonlyArray<Pt>, o: DrawOpts & { n?: readonly [number, number, number] }): this {
    this.c.poly(this.pts(p), o);
    return this;
  }

  blob(p: ReadonlyArray<Pt>, r: number, o: DrawOpts & { bulge?: number }): this {
    this.c.blob(this.pts(p), r, o);
    return this;
  }

  /** Box (not for turned art). */
  box(x: number, y: number, w: number, h: number, o: DrawOpts & { r?: number; bevel?: number; n?: readonly [number, number, number] }): this {
    const [X, Y] = this.box4(x, y, w, h);
    this.c.box(X, Y, w, h, o);
    return this;
  }

  /** Cylinder (not for turned art). */
  cyl(x: number, y: number, w: number, h: number, o: DrawOpts & { axis?: 'v' | 'h'; cap?: number }): this {
    const [X, Y] = this.box4(x, y, w, h);
    this.c.cylinder(X, Y, w, h, o);
    return this;
  }

  /** A lit height field over the local box; `hf(x, y)` in local coordinates (NaN outside). */
  field(x: number, y: number, w: number, h: number, hf: (x: number, y: number) => number, o: DrawOpts): this {
    const [X, Y, W, H] = this.box4(x, y, w, h);
    this.c.heightField(X, Y, W, H, (u, v) => hf(this.lx(u, v), this.ly(u, v)), o);
    return this;
  }

  /** Add `fn(x, y)` (local) to the tone of drawn px in the local box (only `part` when given). */
  shade(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => number, part?: number): this {
    const [X, Y, W, H] = this.box4(x, y, w, h);
    this.c.shade(X, Y, W, H, (u, v) => fn(this.lx(u, v), this.ly(u, v)), part);
    return this;
  }

  /** Fixed colours over the local box: `fn(x, y)` (local) returns a colour, 0 = leave the px. */
  paint(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => Color, z?: number): this {
    const [X, Y, W, H] = this.box4(x, y, w, h);
    this.c.paint(X, Y, W, H, (u, v) => fn(this.lx(u, v), this.ly(u, v)), z);
    return this;
  }

  /** Remove the px of the local box where `cut(x, y)` (local) is true. */
  erase(x: number, y: number, w: number, h: number, cut: (x: number, y: number) => boolean): this {
    const [X, Y, W, H] = this.box4(x, y, w, h);
    this.c.erase(X, Y, W, H, (u, v) => cut(this.lx(u, v), this.ly(u, v)));
    return this;
  }

  /** Is the art px at canvas (X, Y) drawn? */
  drawn(X: number, Y: number): boolean {
    return X >= 0 && Y >= 0 && X < this.c.W && Y < this.c.H && this.c.mat[Y * this.c.W + X] !== 0;
  }

  /** Light, outline and crop to the 1× geometry: exactly g.w·d × g.h·d. */
  render(o: RenderOpts): PixelBuffer {
    const full = this.c.render(o);
    const k = this.m * this.d;
    return full.crop(k, k, this.g.w * this.d, this.g.h * this.d);
  }

  /** The finished HD frame (the 1× anchor). */
  frame(o: RenderOpts): Frame {
    return { buf: this.render(o), ox: this.g.ox, oy: this.g.oy, density: this.d };
  }
}

/**
 * Art px column / row in a FINISHED frame buffer of geometry g at density d for local x / y
 * (unturned frames: overlays painted after `frame()`, e.g. the stamp lettering).
 */
export function framePx(g: FrameGeom, d: number, x: number): number {
  return Math.floor((x + g.ox) * d);
}

export function framePy(g: FrameGeom, d: number, y: number): number {
  return Math.floor((y + g.oy) * d);
}
