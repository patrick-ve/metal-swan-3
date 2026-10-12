/**
 * Machines sub-area "armor": a small local art kit on top of `src/game/art/machines.ts` (which is
 * frozen for this sub-area): brass horns and bells at any angle, parade bunting, the Legion crest,
 * drum heads. Everything draws into a PixelBuffer with palette colours only, lit from the top-left,
 * without an outline (outline the finished machine once, or stack parts with the `Composer`).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Ramp } from '../../../../engine/pixel';
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { R, type RampLike } from '../../../art/paint';
import { damage } from '../../../art/machines';

/** Light direction (from the top-left), normalised. */
const LX = -0.6;
const LY = -0.8;

export interface HornOpts {
  /** Body ramp (default gold = brass). */
  ramp?: RampLike;
  /** Rim ramp (default: the body ramp). */
  rim?: RampLike;
  /** Colours inside the mouth: [upper, lower] (default dark brass / brown). */
  inside?: readonly [Color, Color];
  /** Half-depth of the mouth ellipse along the axis (default 2.5). */
  depth?: number;
  /** Flare exponent: higher = the flare stays narrow longer (default 2.4). */
  flare?: number;
  /** Fold lines on the rim every 3 px (a gramophone's flower horn). */
  petals?: boolean;
  /** Joint bands across the tube, as fractions of the length. */
  bands?: readonly number[];
}

/**
 * A flared horn — a tuba bell, a gramophone horn, a loudspeaker — drawn into `b`: the throat
 * centre at (x0, y0), pointing along `ang` (radians: 0 = right, −π/2 = up), `len` px to the centre
 * of the mouth, throat radius `r0`, mouth radius `r1`. The tube is shaded like a cylinder lit from
 * the top-left; the mouth is an ellipse with a light rim and a dark inside.
 */
export function horn(b: PixelBuffer, x0: number, y0: number, ang: number, len: number, r0: number, r1: number, o: HornOpts = {}): void {
  const ramp = R(o.ramp ?? 'gold');
  const rim = R(o.rim ?? ramp);
  const inside = o.inside ?? [PAL.gold[0], PAL.brown[0]];
  const depth = o.depth ?? 2.5;
  const flare = o.flare ?? 2.4;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // Unit vector across the tube and how much it faces the light.
  const nx = -sa;
  const ny = ca;
  const facing = nx * LX + ny * LY;
  const ext = Math.ceil(len + r1 + depth + 2);
  const xa = Math.max(0, Math.floor(x0 - ext));
  const xb = Math.min(b.w - 1, Math.ceil(x0 + ext));
  const ya = Math.max(0, Math.floor(y0 - ext));
  const yb = Math.min(b.h - 1, Math.ceil(y0 + ext));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const px = x - x0;
      const py = y - y0;
      const u = px * ca + py * sa;
      const v = px * nx + py * ny;
      const mu = (u - len) / depth;
      const mv = v / r1;
      const k = mu * mu + mv * mv;
      if (k <= 1) {
        // The mouth: a light rim around a dark inside.
        if (k > 0.42 || mu > 0.35) {
          let i = shadeIndex((v / r1) * facing, rim.length);
          if (o.petals && Math.floor((v + r1 + 0.5) / 3) % 2 === 1) i = Math.max(0, i - 1);
          b.set(x, y, rim[i]);
        } else b.set(x, y, v * facing > 0 ? inside[0] : inside[1]);
        continue;
      }
      if (u < 0 || u > len) continue;
      const t = u / len;
      const hw = r0 + (r1 - r0) * Math.pow(t, flare);
      if (Math.abs(v) > hw + 0.25) continue;
      let i = shadeIndex((v / Math.max(0.5, hw)) * facing, ramp.length);
      if (o.bands) for (const f of o.bands) if (Math.abs(u - f * len) < 0.6) i = Math.max(0, i - 2);
      b.set(x, y, ramp[i]);
    }
  }
}

/** Ramp index for a light amount in −1..1 (positive = toward the light). */
function shadeIndex(l: number, n: number): number {
  const top = n - 1;
  if (l > 0.45) return top;
  if (l > -0.15) return Math.max(0, top - 1);
  if (l > -0.65) return Math.max(0, top - 2);
  return Math.max(0, top - 3);
}

/** Pennant colours on crimson paintwork (crimson pennants would vanish): gold, white, black. */
export const PENNANTS_ON_RED: readonly Color[] = [PAL.gold[2], PAL.snow[3], PAL.ink[1]];
/** Pennant colours on anything else: crimson, gold, white. */
export const PENNANTS: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.snow[3]];

/**
 * Parade bunting: a cord from x0 to x1 at y sagging `sag` px in the middle, with a little
 * triangular pennant (5 wide, 3 tall) every `gap` px.
 */
export function bunting(b: PixelBuffer, x0: number, x1: number, y: number, sag: number, colors: readonly Color[] = PENNANTS, gap = 6): void {
  const cordY = (x: number): number => {
    const t = (x - x0) / Math.max(1, x1 - x0);
    return y + Math.round(sag * 4 * t * (1 - t));
  };
  for (let x = x0; x <= x1; x++) b.set(x, cordY(x), PAL.stone[3]);
  let k = 0;
  for (let x = x0 + 3; x <= x1 - 2; x += gap, k++) {
    const c = colors[k % colors.length];
    const cy = cordY(x);
    b.hline(x - 2, x + 2, cy + 1, c);
    b.hline(x - 1, x + 1, cy + 2, c);
    b.set(x, cy + 3, c);
    // A darker fold on the right half (light from the left).
    b.set(x + 1, cy + 2, darker(c));
    b.set(x + 2, cy + 1, darker(c));
  }
}

/** One step darker along the colour's own ramp (pennants and trims). */
function darker(c: Color): Color {
  for (const r of [PAL.red, PAL.gold, PAL.snow, PAL.ink, PAL.steel, PAL.brown] as readonly Ramp[]) {
    const i = r.indexOf(c);
    if (i > 0) return r[i - 1];
    if (i === 0) return PAL.ink[0];
  }
  return c;
}

/**
 * The Legion crest (GDD §2.2): a crimson shield with a gold rim, a gold megaphone crossed with a
 * white conductor's baton. 7×9 px around (cx, cy).
 */
export function crest(b: PixelBuffer, cx: number, cy: number): void {
  const rows = [
    'ggggggg',
    'gRrrrRg',
    'gyRrwrg',
    'grywrRg',
    'grwyrrg',
    'gwrryrg',
    '.grrrg.',
    '..grg..',
    '...g...',
  ];
  const col: Record<string, number> = { g: PAL.gold[2], y: PAL.gold[3], R: PAL.red[3], r: PAL.red[2], w: PAL.snow[3] };
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < 7; x++) {
      const ch = rows[y][x];
      if (ch !== '.') b.set(cx - 3 + x, cy - 4 + y, col[ch]);
    }
  }
  // The rim darkens on the lower right (light from the top-left).
  b.set(cx + 3, cy + 1, PAL.gold[1]);
  b.set(cx + 2, cy + 2, PAL.gold[1]);
  b.set(cx + 1, cy + 3, PAL.gold[1]);
  b.set(cx, cy + 4, PAL.gold[1]);
}

/**
 * A drum seen head-on: a crimson shell ring, a gold hoop with lugs, a white skin lit from the
 * top-left. `torn` cuts a jagged dark hole in the skin.
 */
export function drumHead(b: PixelBuffer, cx: number, cy: number, r: number, torn = false, seed = 0): void {
  b.circle(cx, cy, r, PAL.red[1]);
  b.circle(cx, cy, r - 1, PAL.gold[1]);
  b.circle(cx, cy, r - 2, PAL.snow[1]);
  const rr = r - 2;
  for (let y = -rr; y <= rr; y++) {
    for (let x = -rr; x <= rr; x++) {
      const d = Math.hypot(x, y);
      if (d > rr + 0.3) continue;
      const l = (x * LX + y * LY) / Math.max(1, rr);
      b.set(cx + x, cy + y, l > 0.35 ? PAL.snow[3] : l > -0.45 ? PAL.snow[2] : PAL.snow[1]);
    }
  }
  // Hoop highlight on the upper-left arc, lugs around it.
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * (r - 1));
    const y = Math.round(cy + Math.sin(t) * (r - 1));
    if (Math.cos(t) * LX + Math.sin(t) * LY > 0.3) b.set(x, y, PAL.gold[3]);
  }
  const lugs = r >= 7 ? 8 : 6;
  for (let k = 0; k < lugs; k++) {
    const t = (k / lugs) * Math.PI * 2 + 0.2;
    b.set(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), PAL.gold[2]);
  }
  if (torn) {
    // A jagged tear across the skin.
    const h = (i: number): number => ((Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1;
    const len = Math.max(3, rr - 1);
    for (let i = -len; i <= len; i++) {
      const w = 1 + Math.round(h(i) * 1.6) + (Math.abs(i) < len / 2 ? 1 : 0);
      for (let j = -w; j <= w; j++) {
        const x = cx + i;
        const y = cy + j + Math.round((h(i + 7) - 0.5) * 2);
        if (Math.hypot(x - cx, y - cy) <= rr - 0.5) b.set(x, y, Math.abs(j) === w ? PAL.snow[0] : PAL.ink[1]);
      }
    }
  }
}

/** A frame anchored at (ox, oy) with optional points. */
export function fr(buf: PixelBuffer, ox: number, oy: number, pts?: Record<string, readonly [number, number]>): Frame {
  return pts ? { buf, ox, oy, pts } : { buf, ox, oy };
}

/** Ordered-dither mask helper: true on half of the pixels (checker). */
export function checker(x: number, y: number): boolean {
  return ((x + y) & 1) === 0;
}

/**
 * A "dented plate" overlay for a finished frame (GDD §9.2: at 50 % HP): only the pixels that
 * `damage()` changes (holes, scorch, dents), on the same anchor. Drawn over the intact strip,
 * it fits every frame of that strip whose body does not move.
 */
export function dentOverlay(f: Frame, amount: number, seed: number): Frame {
  const hit = damage(f.buf, amount, seed);
  const out = new PixelBuffer(f.buf.w, f.buf.h);
  for (let i = 0; i < out.data.length; i++) if (hit.data[i] !== f.buf.data[i]) out.data[i] = hit.data[i];
  out.touch();
  return fr(out, f.ox, f.oy);
}

/**
 * Drawing with an optional vertical mirror about an anchor row, for machines that hang from a
 * ceiling or stand on a floor (the metronome). Coordinates are anchor-relative (y down for the
 * hanging pose); with `up` every y maps to −1 − y, so shapes mirror but the shading done after
 * drawing still lights them from the top-left.
 */
export class Mirror {
  readonly b: PixelBuffer;
  readonly ox: number;
  readonly oy: number;
  readonly up: boolean;

  constructor(b: PixelBuffer, ox: number, oy: number, up: boolean) {
    this.b = b;
    this.ox = ox;
    this.oy = oy;
    this.up = up;
  }

  x(dx: number): number {
    return this.ox + dx;
  }

  y(dy: number): number {
    return this.up ? this.oy - 1 - dy : this.oy + dy;
  }

  set(dx: number, dy: number, c: Color): this {
    this.b.set(this.x(dx), this.y(dy), c);
    return this;
  }

  rect(dx: number, dy: number, w: number, h: number, c: Color): this {
    const y0 = this.up ? this.y(dy + h - 1) : this.y(dy);
    this.b.rect(this.x(dx), y0, w, h, c);
    return this;
  }

  hline(dx0: number, dx1: number, dy: number, c: Color): this {
    this.b.hline(this.x(dx0), this.x(dx1), this.y(dy), c);
    return this;
  }

  vline(dx: number, dy0: number, dy1: number, c: Color): this {
    this.b.vline(this.x(dx), Math.min(this.y(dy0), this.y(dy1)), Math.max(this.y(dy0), this.y(dy1)), c);
    return this;
  }

  poly(pts: ReadonlyArray<readonly [number, number]>, c: Color): this {
    this.b.poly(
      pts.map(([px, py]) => [this.x(px), this.y(py)] as [number, number]),
      c,
    );
    return this;
  }

  circle(dx: number, dy: number, r: number, c: Color): this {
    this.b.circle(this.x(dx), this.y(dy), r, c);
    return this;
  }
}
