/**
 * Shared art helpers for the creature sprites (docs/ART_GUIDE.md §1): a small part composer that
 * works in body space (origin = the sprite anchor, x forward, y down), eyes and caps stamped at
 * 1×, and the generic death strips (scorched tumble, burn to ash, pancake) built from a creature's
 * own pose frame. Everything uses palette ramps, a 1-px INK outline and light from the top-left.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { crumble, scorch, sootify, withFlames } from '../../art/human-fx';
import { Composer, FLAT, despeckle, shadeLayer, type ShadeOpts } from '../../art/paint';

export { FLAT };

type Pts = Record<string, readonly [number, number]>;

/** Body-space → buffer-space converters handed to the painters. */
export type Painter = (b: PixelBuffer, X: (x: number) => number, Y: (y: number) => number) => void;

/**
 * Back-to-front part compositor in body space. `add` paints a flat shape and shades it with a
 * ramp (a ring of the part's darkest shade separates it from the parts behind); `detail` paints
 * palette pixels as they are (eyes, mouths, seams); `frame` outlines the silhouette in INK.
 * ```ts
 * const s = new Sketch(40, 32, 20, 30);                 // buffer size + anchor (feet)
 * s.add(PAL.olive, (b, X, Y) => b.ellipse(X(-11), Y(-15), 22, 13, FLAT));
 * s.detail((b, X, Y) => b.set(X(6), Y(-12), INK));
 * const f = s.frame({ head: [6, -12] });
 * ```
 */
export class Sketch {
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
  private readonly c: Composer;
  private readonly X = (x: number): number => Math.round(this.ox + x);
  private readonly Y = (y: number): number => Math.round(this.oy + y);

  constructor(w: number, h: number, ox: number, oy: number) {
    this.w = w;
    this.h = h;
    this.ox = ox;
    this.oy = oy;
    this.c = new Composer(w, h);
  }

  /** A shaded part (shape painted with FLAT, then lit from the top-left with `ramp`). */
  add(ramp: Ramp, paint: Painter, o: ShadeOpts & { ring?: boolean; line?: Color; clean?: boolean } = {}): this {
    const l = new PixelBuffer(this.w, this.h);
    paint(l, this.X, this.Y);
    shadeLayer(l, ramp, o);
    if (o.clean !== false) despeckle(l);
    this.c.add(l, { ramp, ring: o.ring, line: o.line });
    return this;
  }

  /** A flat part in one colour (no shading), still separated by a ring from what is behind. */
  flat(color: Color, paint: Painter, line: Color = INK, ring = true): this {
    const l = new PixelBuffer(this.w, this.h);
    paint(l, this.X, this.Y);
    l.replace(FLAT, color);
    this.c.add(l, { line, ring });
    return this;
  }

  /** Paint details directly (exact palette colours, no ring). */
  detail(paint: Painter): this {
    const l = new PixelBuffer(this.w, this.h);
    paint(l, this.X, this.Y);
    this.c.paint(l);
    return this;
  }

  /** Read access for details that depend on what is already drawn. */
  get buf(): PixelBuffer {
    return this.c.buf;
  }

  /** Finish: INK outline around the silhouette, anchor and points. */
  frame(pts?: Pts): Frame {
    const buf = this.c.finish(INK);
    return pts ? { buf, ox: this.ox, oy: this.oy, pts } : { buf, ox: this.ox, oy: this.oy };
  }
}

// ---------------------------------------------------------------------------------------------
// Stamps
// ---------------------------------------------------------------------------------------------

/**
 * A cartoon eye: white ball (`r` 1–3) with an INK pupil looking toward (dx, dy) (−1..1), and an
 * optional lid colour over the top row (half-closed: sleepy, determined).
 */
export function eye(b: PixelBuffer, cx: number, cy: number, r: number, dx = 1, dy = 0, lid?: Color, white: Color = PAL.snow[3]): void {
  if (r <= 1) {
    b.rect(cx, cy, 2, 2, white);
    b.set(cx + (dx > 0 ? 1 : 0), cy + (dy > 0 ? 1 : 0), INK);
    return;
  }
  b.circle(cx, cy, r, white);
  const px = cx + Math.round(dx * (r - 1)) - (r >= 3 && dx < 0 ? 1 : 0);
  const py = cy + Math.round(dy * (r - 1)) - (r >= 3 ? 1 : 0);
  b.rect(px, py, r >= 3 ? 2 : 1, 2, INK);
  if (lid !== undefined) {
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy - r + 1; y++) if ((b.get(x, y) & 255) !== 0) b.set(x, y, lid);
    }
  }
}

/** X-eyes of a knocked-out creature (3×3 cross). */
export function xEye(b: PixelBuffer, cx: number, cy: number, c: Color = INK): void {
  for (const [dx, dy] of X_PIXELS) b.set(cx + dx, cy + dy, c);
}
const X_PIXELS: ReadonlyArray<readonly [number, number]> = [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]];

/** Dizzy spiral eye (3×3). */
export function swirlEye(b: PixelBuffer, cx: number, cy: number): void {
  b.rect(cx - 1, cy - 1, 3, 3, PAL.snow[3]);
  for (const [dx, dy] of SWIRL_PIXELS) b.set(cx + dx, cy + dy, INK);
}
const SWIRL_PIXELS: ReadonlyArray<readonly [number, number]> = [[-1, -1], [0, -1], [1, 0], [0, 0], [-1, 1]];

/** A five-point star of radius 2 (5×5 plus) in gold with a white centre. */
export function star(b: PixelBuffer, cx: number, cy: number): void {
  b.rect(cx - 1, cy - 1, 3, 3, PAL.gold[3]);
  b.set(cx, cy - 2, PAL.gold[2]);
  b.set(cx - 2, cy, PAL.gold[2]);
  b.set(cx + 2, cy, PAL.gold[2]);
  b.set(cx - 1, cy + 2, PAL.gold[1]);
  b.set(cx + 1, cy + 2, PAL.gold[1]);
  b.set(cx, cy, PAL.snow[3]);
}

// ---------------------------------------------------------------------------------------------
// Frame transforms
// ---------------------------------------------------------------------------------------------

/** Feet anchor at the bottom centre of the opaque pixels (lying frames rest on the ground). */
export function reground(buf: PixelBuffer, pts?: Pts): Frame {
  const t = buf.trimBounds();
  if (!t) return { buf, ox: buf.w >> 1, oy: buf.h };
  return pts ? { buf, ox: t.x + (t.w >> 1), oy: t.y + t.h, pts } : { buf, ox: t.x + (t.w >> 1), oy: t.y + t.h };
}

/** Rotate a frame by quarter turns (clockwise) and stand it on the ground again. */
export function turn(f: Frame, quarters: number, lift = 0): Frame {
  const b = f.buf.rotated((quarters * Math.PI) / 2);
  const g = reground(b, f.pts);
  return { buf: g.buf, ox: g.ox, oy: g.oy + lift, pts: f.pts };
}

/** Shift a frame's art up by `dy` px (drawn higher above its anchor). */
export function lifted(f: Frame, dy: number): Frame {
  return { buf: f.buf, ox: f.ox, oy: f.oy + dy, pts: f.pts };
}

/**
 * Squash a frame vertically (a pancake), widened by `widen`, resting on the ground line. The
 * outline is redrawn so the flat shape stays clean.
 */
export function squashed(f: Frame, scaleY: number, widen = 1.3): Frame {
  const t = f.buf.trimBounds();
  if (!t) return f;
  const src = f.buf.crop(t.x, t.y, t.w, t.h);
  const w = Math.max(3, Math.round(t.w * widen));
  const h = Math.max(3, Math.round(t.h * scaleY));
  const flat = src.resized(w, h);
  const out = new PixelBuffer(w + 2, h + 2);
  out.blit(flat, 1, 1);
  // Inner pixels that became outline colour make speckles: smooth them to the neighbours.
  despeckle(out);
  out.outline(INK);
  return { buf: out, ox: (w + 2) >> 1, oy: h + 2, pts: f.pts };
}

/** Soot-black copy with two white blinking eyes at `eyes` (body space) when open. */
function soot(f: Frame, eyesAt: readonly [number, number] | null, open: boolean): Frame {
  const s = sootify(f, 1, false);
  if (eyesAt && open) {
    const b = s.buf;
    const x = s.ox + eyesAt[0];
    const y = s.oy + eyesAt[1];
    for (const dx of [0, 3]) if ((b.get(x + dx, y) & 255) !== 0) b.set(x + dx, y, PAL.snow[3]);
  }
  return s;
}

/**
 * Explosion death (GDD §9.0): scorched, launched in a tumble, lands upside down (the Enemy base
 * gives the arc to walkers; flyers fall). Frames: scorched hit, ¼, ½, ¾ turn, upside down.
 */
export function blastStrip(base: Frame, eyesAt: readonly [number, number] | null = null): Frame[] {
  const hit = scorch(base, 2);
  const s = soot(base, eyesAt, true);
  return [hit, turn(s, 1, 4), turn(s, 2, 6), turn(s, 3, 4), turn(s, 2)];
}

/** Durations for blastStrip: quick tumble, long rest. */
export const BLAST_TIMING = [5, 4, 4, 4, 30] as const;

/**
 * Fire death (GDD §9.0): on fire, a soot statue with blinking white eyes, crumbling into an ash
 * pile where the eyes blink twice more.
 */
export function burnStrip(base: Frame, eyesAt: readonly [number, number] | null = null): Frame[] {
  const s = soot(base, eyesAt, true);
  const shut = soot(base, eyesAt, false);
  const ash = crumble(s, 1);
  const ashEyes = crumble(s, 1);
  if (eyesAt) {
    // Eyes peeking out of the ash pile.
    const b = ashEyes.buf;
    const t = b.trimBounds();
    if (t) {
      const ey = t.y + 1;
      const ex = ashEyes.ox - 2;
      b.set(ex, ey, PAL.snow[3]);
      b.set(ex + 3, ey, PAL.snow[3]);
    }
  }
  return [withFlames(scorch(base, 1), 0), withFlames(scorch(base, 1), 1), withFlames(s, 2, 9, 5), s, shut, s, crumble(s, 0.4), crumble(s, 0.75), ashEyes, ash, ashEyes, ash];
}

/** Durations for burnStrip (about 60 ticks in all). */
export const BURN_TIMING = [5, 5, 5, 8, 3, 6, 4, 4, 6, 4, 6, 6] as const;

/**
 * Crush death (the Swan's STOMP, a van, a falling piano): flattened like a pancake, then it peels
 * off the ground like paper and flutters away.
 */
export function crushStrip(base: Frame): Frame[] {
  const half = squashed(base, 0.5, 1.15);
  const flat = squashed(base, 0.22, 1.4);
  const peel = (angle: number, up: number): Frame => {
    const b = flat.buf.rotated(angle);
    const g = reground(b);
    return { buf: g.buf, ox: g.ox, oy: g.oy + up };
  };
  return [half, flat, flat, peel(-0.35, 2), peel(0.3, 9), peel(-0.25, 17), peel(0.2, 26)];
}

export const CRUSH_TIMING = [3, 6, 14, 6, 6, 6, 6] as const;

/** Every colour of a frame one ramp step lighter or darker (telegraph glows, far wings). */
export function recolor(f: Frame, map: ReadonlyMap<Color, Color>): Frame {
  const b = f.buf.clone();
  for (let i = 0; i < b.data.length; i++) {
    const c = b.data[i];
    const m = map.get(c);
    if (m !== undefined) b.data[i] = m;
  }
  b.touch();
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Pad a buffer by `n` px on every side (for outlines that need room). */
export function pad(b: PixelBuffer, n = 1): PixelBuffer {
  return b.padded(n);
}
