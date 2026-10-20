/**
 * The UHD wall and door textures of the first-person mode (UHD wave; docs/design/fps.md §8.1):
 * the same 26 designs as the 1× painters (src/game/art/wall-tex.ts: the same joints, panels,
 * plates, crates and banners at the same texel places, the joints clear of the eye-line rows
 * 28–36), painted natively at 128² (d 2) and 256² (d 4) with the UHD kit: a lit G-buffer
 * (HdCanvas), HD ramps of 6–8 tones, relief from normals (bevels, grooves, rivet domes, pipe
 * cylinders, rounded stones and bags), ambient occlusion, short cast shadows from the key light
 * (upper left) and texture and wear (concrete mottling and pits, brick faces, wood grain, rust
 * runs, damp, soot). Painted surfaces: no ink outline (style decision), ordered dither only at the
 * band borders of the big surfaces.
 *
 * Seamless left / right like the 1× art: the canvas is the texture plus a margin of MG logical px
 * on both sides, every element is drawn three times (x − 64, x, x + 64), every texture pattern is
 * periodic in 64 (periodic noise, wrapped cell hashes), and the light is local, so the cropped
 * middle tiles without a seam. Pure and deterministic.
 */
import type { Color } from '../../../engine/color';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import { rayTexDarkHd } from '../../../engine/ray';
import type { DenseDensity } from '../../../engine/sprites';
import { HdCanvas, type DrawOpts, type HdMaterial, type RenderOpts, type Texture, type TexSample } from '../../art/hd';
import { hash2, noise2, noise2x } from '../../art/paint';
import { inHookedCross } from '../../art/wall-tex';

const T = 64;
/** Margin on both sides (logical px): wider than any light effect (AO, cast shadow, clean-up). */
const MG = 8;

/**
 * A horizontal shift of the whole design in logical px (tests: a seamless texture painted shifted
 * equals the unshifted one rolled; 0 in the game).
 */
let SHIFT = 0;
/** Texture x (0..64) of a canvas x. */
const tx = (x: number): number => ((((x - MG - SHIFT) % T) + T) % T);
/** The x of a sample inside an element that starts at texture x `ex` (0..64; every copy alike). */
const lx = (s: TexSample, ex: number): number => ((((s.x - MG - SHIFT - ex) % T) + T) % T);
/** Periodic noise (period 64 in x) at a canvas x. */
const pn = (x: number, y: number, scale: number, seed: number): number => noise2x(tx(x), y, scale, T, seed);
/** Periodic noise stretched `k` times along x (grain): still period 64 in x. */
const pnk = (x: number, k: number, y: number, scale: number, seed: number): number => noise2x(tx(x) * k, y, scale, T * k, seed);

type Box = DrawOpts & { r?: number; bevel?: number; n?: readonly [number, number, number] };

/** A wall canvas: 64 × 64 logical px wrapped in x (every primitive drawn at x − 64, x, x + 64). */
class Wall {
  readonly c: HdCanvas;
  readonly d: number;
  constructor(d: number) {
    this.d = d;
    this.c = new HdCanvas(T + 2 * MG, T, d);
  }
  mat(ramp: Ramp, o: Omit<HdMaterial, 'ramp'> = {}): number {
    return this.c.material({ ramp, ...o });
  }
  part(): number {
    return this.c.newPart();
  }
  private each(fn: (x0: number) => void): void {
    const o = MG + (((SHIFT % T) + T) % T);
    fn(o - 2 * T);
    fn(o - T);
    fn(o);
    fn(o + T);
  }
  /** The whole canvas (wrap-free: its texture must be periodic). */
  plane(o: DrawOpts): this {
    this.c.box(0, 0, T + 2 * MG, T, { round: 0, ...o });
    return this;
  }
  box(x: number, y: number, w: number, h: number, o: Box): this {
    const part = o.part ?? this.part();
    this.each((x0) => this.c.box(x0 + x, y, w, h, { ...o, part }));
    return this;
  }
  cyl(x: number, y: number, w: number, h: number, o: DrawOpts & { axis?: 'v' | 'h'; cap?: number }): this {
    const part = o.part ?? this.part();
    this.each((x0) => this.c.cylinder(x0 + x, y, w, h, { ...o, part }));
    return this;
  }
  ell(cx: number, cy: number, rx: number, ry: number, o: DrawOpts): this {
    const part = o.part ?? this.part();
    this.each((x0) => this.c.ellipsoid(x0 + cx, cy, rx, ry, { ...o, part }));
    return this;
  }
  cap(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, o: DrawOpts): this {
    const part = o.part ?? this.part();
    this.each((ox) => this.c.capsule(ox + x0, y0, ox + x1, y1, r0, r1, { ...o, part }));
    return this;
  }
  /** A lit height field over x, y, w, h; `hf` gets texture coordinates. */
  field(x: number, y: number, w: number, h: number, hf: (x: number, y: number) => number, o: DrawOpts): this {
    const part = o.part ?? this.part();
    this.each((x0) => this.c.heightField(x0 + x, y, w, h, (px, py) => hf(px - x0, py), { ...o, part }));
    return this;
  }
  /** Tone offsets over a box (texture coordinates). */
  shade(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => number): this {
    this.each((x0) => this.c.shade(x0 + x, y, w, h, (px, py) => fn(px - x0, py)));
    return this;
  }
  /** Fixed colours over a box (texture coordinates; 0 = leave the px). */
  paint(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => Color, z?: number): this {
    this.each((x0) => this.c.paint(x0 + x, y, w, h, (px, py) => fn(px - x0, py), z));
    return this;
  }
  /** Render (painted: no outline) and crop the middle 64 × 64. */
  done(o: RenderOpts = {}): PixelBuffer {
    const out = this.c.render({ outline: 'none', ao: 0.32, shadow: 0.3, shadowMax: 2.5, sepZ: 0.6, ...o });
    const d = this.d;
    return out.crop(MG * d, 0, T * d, T * d).touch();
  }
}

// ------------------------------------------------------------------------------------ helpers

/** A V-groove across a texture coordinate: −1 at its shadowed wall, +1 at its lit wall, 0 outside. */
function groove(f: number, w: number): number {
  if (f < 0 || f >= w) return 0;
  return f < w * 0.45 ? -1 : 1;
}

/** Fine pits and specks of a rough surface (only where art px are small: d 4). */
function pits(s: TexSample, seed: number, amount = 1): void {
  if (s.d < 4) return;
  const h = hash2(Math.floor(tx(s.x) * 4), Math.floor(s.y * 4), seed);
  if (h > 1 - 0.04 * amount) s.tone -= 0.2;
  else if (h < 0.02 * amount) s.tone += 0.12;
}

/** A drip stain under (x, y): `len` long, darker at the top; returns the tone offset at (px, py). */
function drip(px: number, py: number, x: number, y: number, len: number, seed: number, w = 1.6): number {
  if (py < y || py > y + len) return 0;
  const wob = (noise2x(0, py, 4, T, seed) - 0.5) * 1.6;
  const dx = Math.abs(px - (x + 0.8 + wob));
  const half = w * (1 - ((py - y) / len) * 0.55);
  if (dx > half) return 0;
  return -0.34 * (1 - (py - y) / len) * (1 - (dx / half) * 0.5);
}

/** Hazard stripes (diagonal, `period` logical px): the stripe of a point. */
const stripe = (x: number, y: number, period: number): boolean => Math.floor((x + y) / (period / 2)) % 2 !== 0;

/** A small domed rivet / screw head centred (cx, cy). */
function rivet(w: Wall, cx: number, cy: number, mat: number, r = 0.95, z = 1): void {
  w.ell(cx, cy, r, r, { mat, z, round: 0.85 });
}

// ------------------------------------------------------------------------------------ materials

function concrete(w: Wall): void {
  const m = w.mat(PAL_HD.stone, { lo: 1, hi: 5, dither: 0.2, wrap: 0.12 });
  w.plane({
    mat: m,
    tex: (s) => {
      const x = tx(s.x);
      const y = s.y;
      const n = pn(s.x, y, 14, 101) * 0.65 + pn(s.x, y, 4.6, 107) * 0.35;
      s.tone += (n - 0.5) * 0.32 - 0.12;
      // form-board lines every 8 rows: a faint, broken seam with a lit lower lip
      const fy = y % 8;
      if (fy >= 7 && hash2(Math.floor(x / 8), Math.floor(y), 3) < 0.75) s.tone -= fy < 7.5 ? 0.16 : -0.05;
      // panel joints (x 0, 32) and shuttering joints (v 20, 44): V-grooves
      const gx = groove(x % 32, 1.5);
      if (gx !== 0) {
        s.nx += gx < 0 ? 0.75 : -0.55;
        s.dz = -0.4;
      }
      const gy = y >= 20 && y < 21.5 ? groove(y - 20, 1.5) : y >= 44 && y < 45.5 ? groove(y - 44, 1.5) : 0;
      if (gy !== 0) {
        s.ny += gy < 0 ? 0.75 : -0.55;
        s.dz = -0.4;
      }
      // tie-rod holes: a dark core in a little cone
      for (const hy of [10.5, 54.5]) {
        const dy = y - hy;
        if (dy < -1.6 || dy > 1.6) continue;
        const dx = ((x - 0.5) % 16) - 8;
        const r = Math.hypot(dx, dy);
        if (r < 0.7) s.fix = PAL_HD.ink[1];
        else if (r < 1.5) {
          s.nx -= (dx / r) * 0.7;
          s.ny -= (dy / r) * 0.7;
          s.dz = -0.3;
        }
      }
      // water stains under the joints, a dirty skirting
      s.tone += drip(x, y, 20, 46, 12, 5) + drip(x, y, 50, 22, 12, 9);
      if (y > 56) s.tone -= ((y - 56) / 8) * (0.2 + pn(s.x, y, 3, 4) * 0.3);
      // hairline cracks
      const c = pn(s.x, y, 7, 113);
      if (Math.abs(c - 0.5) < 0.006 + 0.012 / s.d && pn(s.x, y, 5, 117) < 0.3) s.tone -= 0.3;
      pits(s, 119);
    },
  });
}

/** The 1× brick bond: 16 × 8 bricks, odd rows shifted 8, 1-px mortar at the top / left. */
function brick(w: Wall): void {
  const red = w.mat(PAL_HD.red, { lo: 1, hi: 5, dither: 0.15, wrap: 0.1, spec: 0.05 });
  const dark = w.mat(PAL_HD.rust, { lo: 0, hi: 3, dither: 0.15, wrap: 0.1 });
  const mortar = w.mat(PAL_HD.stone, { lo: 1, hi: 5, dither: 0.2 });
  w.plane({
    mat: red,
    tex: (s) => {
      const y = s.y;
      const row = Math.floor(y / 8);
      const x = (tx(s.x) + (row & 1 ? 8 : 0)) % T;
      const col = Math.floor(x / 16);
      const fx = x - col * 16;
      const fy = y - row * 8;
      const j = 0.9;
      if (fx < j || fy < j) {
        s.mat = mortar;
        s.dz = -0.6;
        // mortar under a brick lies in its shadow; sandy grit
        s.tone += (fy < j && fy > 0.35 ? -0.25 : -0.05) + (pn(s.x, y, 1.2, 43) - 0.5) * 0.2;
        return;
      }
      const t = hash2(col, row & 7, 41);
      if (t < 0.15) s.mat = dark;
      else if (t < 0.3) s.tone -= 0.22;
      s.tone += (hash2(col, row & 7, 44) - 0.5) * 0.16;
      // a sand-faced surface, firing marks
      s.tone += (pn(s.x, y, 2.2, 45 + (row & 7)) - 0.5) * 0.22;
      // rounded edges: lit top / left, shaded bottom / right
      const b = 0.9;
      if (fy - j < b) s.ny -= 0.6;
      else if (8 - fy < b) s.ny += 0.55;
      if (fx - j < b) s.nx -= 0.45;
      else if (16 - fx < b) s.nx += 0.5;
      // chipped corners (into the mortar) and pits
      if (hash2(col, row & 7, 47) < 0.3 && fx - j < 1.5 && fy - j < 1.5 && fx + fy - 2 * j < 1.6) {
        s.mat = mortar;
        s.dz = -0.5;
        s.tone -= 0.12;
      }
      pits(s, 48, 1.5);
      // soot near the floor (soft, broken)
      if (y > 50) s.tone -= ((y - 50) / 14) * (0.25 + pn(s.x, y, 3, 49) * 0.35);
    },
  });
}

function crates(w: Wall): void {
  const gap = w.mat(PAL_HD.brown, { lo: 0, hi: 2, dither: 0.2 });
  const plank = w.mat(PAL_HD.brown, { lo: 1, hi: 5, wrap: 0.1 });
  const frame = w.mat(PAL_HD.brown, { lo: 2, hi: 6, wrap: 0.1, spec: 0.05 });
  const nail = w.mat(PAL_HD.steel, { lo: 2, hi: 6, spec: 0.8, shine: 24 });
  w.plane({ mat: gap, z: -2, tex: (s) => (s.tone += (pn(s.x, s.y, 3, 9) - 0.5) * 0.3) });
  const box = (x: number, y: number, bw: number, bh: number, seed: number): void => {
    // planks: horizontal boards 6 px tall, grain along x, a seam between boards
    w.box(x + 1, y + 1, bw - 2, bh - 2, {
      mat: plank,
      bevel: 0.6,
      tex: (s) => {
        const px = s.x;
        const fy = s.y - y;
        const b = Math.floor(fy / 6);
        const f = fy - b * 6;
        s.tone += (pnk(px, 0.35, s.y * 2.2 + b * 9, 2.5, seed + b) - 0.5) * 0.4 + (hash2(b, seed, 9) - 0.5) * 0.25;
        if (f < 0.6) {
          s.tone -= 0.45;
          s.dz = -0.3;
        } else if (f < 1.1) s.ny -= 0.4;
        if (s.d >= 4 && Math.abs(pnk(px, 0.5, s.y * 3, 1, seed + 5) - 0.5) < 0.03) s.tone -= 0.15;
      },
    });
    // the frame boards and their bevels (one part: a raised frame)
    const fr = w.part();
    const ft = (s: TexSample): void => {
      s.tone += (pnk(s.x, 0.4, s.y * 2, 2, seed + 20) - 0.5) * 0.3;
      pits(s, seed + 21);
    };
    w.box(x + 1, y + 1, bw - 2, 3, { mat: frame, z: 1, bevel: 0.7, part: fr, tex: ft });
    w.box(x + 1, y + bh - 4, bw - 2, 3, { mat: frame, z: 1, bevel: 0.7, part: fr, tex: ft });
    w.box(x + 1, y + 1, 3, bh - 2, { mat: frame, z: 1.1, bevel: 0.7, part: fr, tex: ft });
    w.box(x + bw - 4, y + 1, 3, bh - 2, { mat: frame, z: 1.1, bevel: 0.7, part: fr, tex: ft });
    // stencil bars (no text): sand paint, worn
    const cx = x + (bw >> 1);
    const cy = y + (bh >> 1);
    w.paint(cx - 7, cy - 3, 14, 6, (px, py) => {
      const inBar = (py >= cy - 3 && py < cy - 1 && px >= cx - 7 && px < cx + 7) || (py >= cy + 1 && py < cy + 3 && px >= cx - 5 && px < cx + 5);
      if (!inBar) return 0;
      const wn = noise2(px, py, 2.5, seed + 30);
      return wn < 0.22 ? 0 : wn > 0.7 ? PAL_HD.sand[4] : PAL_HD.sand[5];
    }, 0.4);
    // nails
    for (const [nx, ny] of [[x + 2.5, y + 2.5], [x + bw - 2.5, y + 2.5], [x + 2.5, y + bh - 2.5], [x + bw - 2.5, y + bh - 2.5]]) rivet(w, nx, ny, nail, 0.6, 1.6);
  };
  box(0, 0, 32, 30, 1);
  box(32, 0, 32, 30, 2);
  box(-12, 30, 40, 34, 3);
  box(28, 30, 24, 34, 4);
}

/** Vertical boards 16 wide (grain along y), a chair rail at v 20, a skirting from v 56. */
function woodPanel(w: Wall): void {
  const board = w.mat(PAL_HD.brown, { lo: 1, hi: 5, wrap: 0.12, spec: 0.08 });
  const trim = w.mat(PAL_HD.brown, { lo: 1, hi: 6, wrap: 0.1, spec: 0.12 });
  w.plane({
    mat: board,
    tex: (s) => {
      const x = tx(s.x);
      const b = Math.floor(x / 16);
      const g = noise2x(x * 3, s.y * 0.35 + b * 40, 6, T * 3, 61 + b);
      s.tone += (g - 0.5) * 0.55 + (hash2(b, 0, 62) - 0.5) * 0.3 - 0.08;
      if (s.d >= 4 && Math.abs(noise2x(x * 4, s.y * 0.5, 2, T * 4, 63 + b) - 0.5) < 0.04) s.tone -= 0.14;
      // board joints at x 0, 16, 32, 48: a dark gap, the next board's lit edge
      const f = x % 16;
      if (f < 0.6) {
        s.fix = PAL_HD.ink[1];
      } else if (f < 1.4) s.nx -= 0.5;
      else if (f > 15.2) s.nx += 0.45;
      // knots
      for (const [kx, ky] of [[9.5, 40.5], [41.5, 10.5], [27.5, 47.5], [57.5, 32.5]]) {
        const r = Math.hypot((x - kx) * 1.4, s.y - ky);
        if (r < 1) s.tone -= 0.55;
        else if (r < 2.4) s.tone += Math.sin(r * 5) * 0.12;
      }
    },
  });
  const tt: Texture = (s) => (s.tone += (noise2x(tx(s.x) * 0.4, s.y * 3, 2, T * 0.4, 64) - 0.5) * 0.3);
  // the chair rail: a rounded moulding
  w.cyl(-MG, 20, T + 2 * MG, 3, { mat: trim, z: 1.5, axis: 'h', round: 0.8, tex: tt });
  // the skirting: a plinth with a lit top lip
  w.box(-MG, 56, T + 2 * MG, 8, { mat: trim, z: 1.2, bevel: 0.8, tone: -0.15, tex: tt });
  w.cyl(-MG, 55.5, T + 2 * MG, 1.6, { mat: trim, z: 1.8, axis: 'h', tex: tt });
}

function steelPlate(w: Wall): void {
  const plate = w.mat(PAL_HD.steel, { lo: 1, hi: 5, wrap: 0.1, spec: 0.35, shine: 16, dither: 0.15 });
  const rust = w.mat(PAL_HD.rust, { lo: 0, hi: 3, wrap: 0.1, dither: 0.2 });
  const head = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.9, shine: 26 });
  w.plane({ mat: plate, z: -1, tone: -0.3 });
  const rows: ReadonlyArray<readonly [number, number]> = [[0, 20], [20, 24], [44, 20]];
  for (const [y, h] of rows) {
    for (let px = 0; px < 2; px++) {
      const x = px * 32;
      const seed = 70 + y + px;
      w.box(x + 0.3, y + 0.3, 31.4, h - 0.6, {
        mat: plate,
        bevel: 1.2,
        tex: (s) => {
          s.tone += (pn(s.x, s.y, 16, 71) - 0.5) * 0.3 + (hash2(px, y, seed) - 0.5) * 0.15 - 0.18;
          // a faint second bevel 1 px in (the 1× inner frame)
          const fx = lx(s, x);
          const e = Math.min(fx - 0.3, 31.7 - fx, s.y - y, y + h - 0.3 - s.y);
          if (e > 1.2 && e < 1.7) s.tone -= 0.12;
          // rust specks and blotches
          const g = pn(s.x, s.y, 2.2, 73) * 0.6 + pn(s.x, s.y, 9, 75) * 0.4;
          if (g > 0.74) {
            s.mat = rust;
            s.tone += (g - 0.74) * 2 - 0.1;
          }
          s.tone += drip(tx(s.x), s.y, 14, 45, 14, 72) * 0.8;
          pits(s, 74);
        },
      });
      for (let k = 4; k < h - 2; k += 6) {
        rivet(w, x + 4, y + k, head);
        rivet(w, x + 28, y + k, head);
      }
    }
  }
}

function vent(w: Wall, x: number, y: number, vw: number, vh: number): void {
  const frame = w.mat(PAL_HD.steel, { lo: 2, hi: 6, spec: 0.5, shine: 20 });
  const slat = w.mat(PAL_HD.steel, { lo: 1, hi: 5, spec: 0.4, shine: 18 });
  const head = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.9, shine: 26 });
  w.box(x - 1, y - 1, vw + 2, vh + 2, { mat: frame, z: 1.2, bevel: 1 });
  w.box(x + 0.4, y + 0.4, vw - 0.8, vh - 0.8, { mat: slat, z: 1.6, tone: -2 });
  w.paint(x + 0.6, y + 0.6, vw - 1.2, vh - 1.2, () => PAL_HD.ink[0], 1.7);
  for (let yy = y + 1; yy < y + vh - 1.5; yy += 3) w.box(x + 1, yy, vw - 2, 1.8, { mat: slat, z: 2.2, n: [0, -0.62, 0.78], bevel: 0.3 });
  for (const [rx, ry] of [[x + 1, y + 1], [x + vw - 1, y + 1], [x + 1, y + vh - 1], [x + vw - 1, y + vh - 1]]) rivet(w, rx - 0.0, ry, head, 0.8, 2.6);
}

/** Ribbed sheet (ribs every 8 px), the sheet overlap at v 46, screws, rust runs. */
function corrugated(w: Wall): void {
  const sheet = w.mat(PAL_HD.slate, { lo: 2, hi: 6, wrap: 0.1, spec: 0.3, shine: 14 });
  const rust = w.mat(PAL_HD.rust, { lo: 0, hi: 3, wrap: 0.1 });
  const screw = w.mat(PAL_HD.steel, { lo: 2, hi: 6, spec: 0.9, shine: 26 });
  const runs: Array<[number, number, number]> = [];
  for (let i = 0; i < 6; i++) runs.push([2 + 8 * Math.floor(hash2(i, 0, 81) * 8), hash2(i, 1, 81) < 0.5 ? 4 : 51, 6 + Math.floor(hash2(i, 2, 81) * 14)]);
  w.plane({
    mat: sheet,
    tex: (s) => {
      const x = tx(s.x);
      const y = s.y;
      // the rib profile: a smooth wave, the lit flank first (as the 1× profile)
      const a = ((x + 2) / 8) * Math.PI * 2;
      s.nx += Math.sin(a) * 0.6;
      s.tone += (pn(s.x, y, 9, 82) - 0.5) * 0.12 + 0.05;
      // the overlap at v 46: the upper sheet's edge (dark under it, a lit lip)
      if (y >= 45.6 && y < 46.4) s.fix = PAL_HD.ink[1];
      else if (y >= 46.4 && y < 47.2) s.ny -= 0.7;
      else if (y >= 44 && y < 45.6) s.ny += 0.25;
      // rust runs under the screws
      for (const [rx, ry, len] of runs) {
        const t = drip(x, y, rx - 0.8, ry, len, 83 + rx, 0.9);
        if (t < -0.08) {
          s.mat = rust;
          s.tone += 0.1 + t;
        }
      }
      pits(s, 84);
    },
  });
  for (let x = 2.5; x < T; x += 8) for (const y of [3.5, 44.5, 50.5, 60.5]) rivet(w, x, y, screw, 0.75, 1);
}

function freight(w: Wall): void {
  const plank = w.mat(PAL_HD.brown, { lo: 1, hi: 6, wrap: 0.15, dither: 0.15 });
  const weathered = w.mat(PAL_HD.stone, { lo: 1, hi: 5, wrap: 0.15, dither: 0.15 });
  const iron = w.mat(PAL_HD.steel, { lo: 0, hi: 5, spec: 0.5, shine: 18 });
  const head = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.9, shine: 26 });
  w.plane({
    mat: plank,
    tex: (s) => {
      const x = tx(s.x);
      const p = Math.floor(x / 8);
      const g = noise2x(x, s.y * 0.25, 4, T, 90 + p);
      s.tone += (g - 0.5) * 0.7 + (hash2(p, 0, 91) < 0.3 ? -0.2 : 0.05);
      if (g > 0.84) {
        s.mat = weathered;
        s.tone -= 0.2;
      }
      if (s.d >= 4 && Math.abs(noise2x(x * 4, s.y * 0.4, 2, T * 4, 92 + p) - 0.5) < 0.05) s.tone -= 0.15;
      const f = x % 8;
      if (f < 0.6) s.fix = PAL_HD.ink[1];
      else if (f < 1.2) s.nx -= 0.5;
      else if (f > 7.3) s.nx += 0.4;
      // the faded chalk stripe (no text)
      if (s.y >= 38 && s.y < 39 && hash2(Math.floor(x * 2), 0, 93) < 0.7) s.fix = PAL_HD.stone[5];
      pits(s, 94);
    },
  });
  // the sliding-door rail and the iron straps with their bolts
  w.box(-MG, 2, T + 2 * MG, 5, { mat: iron, z: 1.5, bevel: 1, tone: 0.1 });
  for (let x = 4; x < T; x += 16) rivet(w, x + 1, 4.5, head, 1, 2.6);
  for (const y of [24, 48]) {
    w.box(-MG, y, T + 2 * MG, 3, { mat: iron, z: 1.2, bevel: 0.7, tex: (s) => (s.tone += (pn(s.x, s.y, 2, 95) - 0.5) * 0.3) });
    for (let x = 3.5; x < T; x += 8) rivet(w, x, y + 1.5, head, 0.7, 2.1);
  }
}

function tile(w: Wall): void {
  const glaze = w.mat(PAL_HD.snow, { lo: 1, hi: 5, spec: 0.7, shine: 30, wrap: 0.1 });
  const dirty = w.mat(PAL_HD.stone, { lo: 3, hi: 6, spec: 0.4, shine: 24 });
  const grout = w.mat(PAL_HD.stone, { lo: 1, hi: 5 });
  const trim = w.mat(PAL_HD.sky, { lo: 0, hi: 4, spec: 0.6, shine: 24 });
  w.plane({ mat: grout, z: -0.6, tone: 0.1, tex: (s) => (s.tone += (pn(s.x, s.y, 1.5, 100) - 0.5) * 0.3 - (s.y > 40 ? 0.3 : 0)) });
  for (let ty = 0; ty < 8; ty++) {
    for (let tx0 = 0; tx0 < 8; tx0++) {
      const x = tx0 * 8;
      const y = ty * 8;
      const dd = hash2(tx0, ty, 101);
      const low = y >= 40;
      w.box(x + 0.8, y + 0.8, 7.2, 7.2, {
        mat: dd < 0.06 ? dirty : glaze,
        bevel: 1,
        r: 0.4,
        tone: (low ? -0.42 : 0.05) + (hash2(tx0, ty, 103) - 0.5) * 0.1,
        tex: (s) => {
          s.tone += (pn(s.x, s.y, 3, 104) - 0.5) * 0.1;
          s.tone += drip(tx(s.x), s.y, 44, 41, 16, 102) * 0.7;
          if (dd > 0.94) {
            // a cracked tile
            const fx = tx(s.x) - x;
            const fy = s.y - y;
            if (Math.abs(fy - (1.5 + fx * 0.7 + Math.sin(fx * 2) * 0.4)) < 0.25 + 0.25 / s.d && fx > 1 && fx < 7) s.fix = PAL_HD.stone[2];
          }
        },
      });
    }
  }
  // the dado line at v 40: a blue capping strip
  w.cyl(-MG, 39.4, T + 2 * MG, 1.6, { mat: trim, z: 1.2, axis: 'h' });
}

/** Rough stones in irregular courses, dark mortar, a damp patch. */
function cellar(w: Wall): void {
  const mortar = w.mat(PAL_HD.ink, { lo: 0, hi: 1 });
  const fams = [w.mat(PAL_HD.stone, { lo: 1, hi: 4, wrap: 0.1 }), w.mat(PAL_HD.brown, { lo: 1, hi: 3, wrap: 0.1 }), w.mat(PAL_HD.slate, { lo: 2, hi: 4, wrap: 0.1 })];
  const moss = w.mat(PAL_HD.moss, { lo: 1, hi: 3 });
  w.plane({ mat: mortar, z: -2, tex: (s) => (s.tone += (pn(s.x, s.y, 1.5, 110) - 0.5) * 0.8) });
  const rows = [0, 11, 22, 34, 45, 56, 64];
  for (let ri = 0; ri < rows.length - 1; ri++) {
    const y0 = rows[ri];
    const y1 = rows[ri + 1];
    let x = Math.floor(hash2(ri, 0, 111) * 12);
    const start = x;
    while (x < start + T) {
      const sw = 10 + Math.floor(hash2(x, ri, 112) * 12);
      const tone = hash2(x, ri, 113);
      const mat = fams[tone < 0.4 ? 0 : tone < 0.75 ? 1 : 2];
      const cx = x + sw / 2;
      const cy = (y0 + y1) / 2;
      const rx = sw / 2;
      const ry = (y1 - y0) / 2;
      const seed = 114 + x + ri * 31;
      w.field(x + 0.4, y0 + 0.4, sw - 0.4, y1 - y0 - 0.4, (px, py) => {
        const ex = (px - cx) / rx;
        const ey = (py - cy) / ry;
        const bump = (noise2x(px, py, 2.5, T, seed) - 0.5) * 0.35;
        const dd = ex * ex * ex * ex + ey * ey * ey * ey + bump * 0.6;
        if (dd > 0.92) return NaN;
        return Math.sqrt(Math.max(0, 1 - dd)) * Math.min(ry, 4) * 0.7 + bump * 1.6;
      }, {
        mat,
        tex: (s) => {
          s.tone += (hash2(Math.floor(tx(s.x) * 1.5), Math.floor(s.y * 1.5), seed) - 0.5) * 0.12;
          pits(s, seed, 2);
          // the damp patch (moss in the joints and on the lower stones)
          const t = tx(s.x);
          if (s.y > 46 && t > 10 && t < 34 && pn(s.x, s.y, 2, 115) > 0.62) {
            s.mat = moss;
            s.tone -= 0.1;
          }
        },
      });
      x += sw;
    }
  }
}

function sandbags(w: Wall): void {
  const bag = w.mat(PAL_HD.sand, { lo: 1, hi: 6, wrap: 0.25 });
  const tie = w.mat(PAL_HD.brown, { lo: 1, hi: 5 });
  w.plane({ mat: bag, z: -6, tone: -2 });
  for (let row = 0; row < 6; row++) {
    const y0 = row * 11 - 2;
    const off = row & 1 ? 10 : 0;
    for (let col = 0; col < 4; col++) {
      const x0 = col * 16 + off;
      const cx = x0 + 8;
      const cy = y0 + 5.5;
      const seed = 120 + row * 7 + col;
      w.field(x0 - 0.3, y0, 16.6, 11, (px, py) => {
        const ex = (px - cx) / 8.3;
        const ey = (py - cy) / 5.7;
        const dd = ex * ex + ey * ey;
        if (dd > 1) return NaN;
        // a stuffed sack: flat-topped, sagging, a crease or two
        const sag = Math.sqrt(1 - dd);
        return sag * 2.4 + Math.min(0.5, sag) * 1.2 + (noise2x(px, py, 3, T, seed) - 0.5) * 0.4;
      }, {
        mat: bag,
        z: row * 0.05,
        tex: (s) => {
          // woven cloth: fine cross weave at 4×, a softer grain at 2×
          if (s.d >= 4) s.tone += (((Math.floor(tx(s.x) * 4) + Math.floor(s.y * 4)) & 1) - 0.5) * 0.06;
          s.tone += (pn(s.x, s.y, 2.5, seed + 3) - 0.5) * 0.18;
          // the seam: a stitched line over the top
          const fy = s.y - (cy - 3.2);
          const fx = lx(s, x0);
          if (Math.abs(fy) < 0.3 && fx > 4 && fx < 13 && Math.floor(fx * 2) % 2 === 0) s.tone -= 0.3;
        },
      });
      // the tie at the left end
      w.ell(x0 + 1.4, cy, 1, 0.8, { mat: tie, z: 4 + row * 0.05, tone: -0.2 });
    }
  }
}

function pipes(w: Wall): void {
  steelPlate(w);
  const p0 = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.8, shine: 22 });
  const p1 = w.mat(PAL_HD.rust, { lo: 1, hi: 6, spec: 0.3, shine: 14 });
  const p2 = w.mat(PAL_HD.olive, { lo: 1, hi: 6, spec: 0.45, shine: 18 });
  const wheel = w.mat(PAL_HD.red, { lo: 2, hi: 6, spec: 0.5, shine: 18 });
  const hub = w.mat(PAL_HD.steel, { lo: 2, hi: 6, spec: 0.9, shine: 26 });
  const pipe = (y: number, rad: number, mat: number, z: number): void => {
    w.cyl(-MG, y - rad, T + 2 * MG, rad * 2, { mat, z, axis: 'h', tex: (s) => (s.tone += (pn(s.x, s.y, 4, y) - 0.5) * 0.2) });
    for (const fx of [10, 42]) w.cyl(fx, y - rad - 1, 3, rad * 2 + 2, { mat, z: z + 1, axis: 'h', tone: 0.1 });
  };
  pipe(14.5, 4, p0, 3);
  pipe(23.5, 2, p1, 2.5);
  pipe(48.5, 5, p2, 4);
  // the valve wheel on the green pipe
  const cx = 26.5;
  const cy = 48.5;
  const ring = w.part();
  for (let a = 0; a < 16; a++) {
    const t0 = (a / 16) * Math.PI * 2;
    const t1 = ((a + 1) / 16) * Math.PI * 2;
    w.cap(cx + Math.cos(t0) * 6.6, cy + Math.sin(t0) * 6.6, cx + Math.cos(t1) * 6.6, cy + Math.sin(t1) * 6.6, 0.85, 0.85, { mat: wheel, z: 10, part: ring });
  }
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) w.cap(cx, cy, cx + dx * 6, cy + dy * 6, 0.6, 0.6, { mat: wheel, z: 9.5 });
  w.ell(cx, cy, 1.6, 1.6, { mat: hub, z: 10.5 });
  w.shade(31, 53, 5, 12, (px, py) => drip(px, py, 33, 53.5, 9, 131));
}

/** Brushed-steel lift panels: fine horizontal brushing, two tall panels, a seam, indicator lamps. */
function elevator(w: Wall): void {
  const brushed = w.mat(PAL_HD.steel, { lo: 3, hi: 6, spec: 0.55, shine: 12, wrap: 0.15 });
  const lamp = w.mat(PAL_HD.steel, { lo: 1, hi: 4, spec: 0.8, shine: 24 });
  const lit = w.mat(PAL_HD.orange, { flat: true, lo: 3, hi: 6 });
  const brush: Texture = (s) => {
    const row = Math.floor(s.y * s.d);
    s.tone += (hash2(row, Math.floor(tx(s.x) / 16), 141) - 0.5) * 0.18 + (hash2(row, Math.floor(tx(s.x) * 0.5), 142) - 0.5) * 0.05;
  };
  w.plane({ mat: brushed, z: -0.5, tone: -0.15, tex: brush });
  for (const x of [2, 33]) {
    w.box(x, 3, 29, 58, { mat: brushed, z: 0.4, bevel: 1.2, tex: brush });
    w.box(x + 3, 6, 23, 52, { mat: brushed, z: 1.7, tone: -0.08, tex: (s) => {
      // the inner panel: pressed in (its bevel lit bottom / right)
      const fx = lx(s, x + 3);
      const fy = s.y - 6;
      if (fx < 0.8) s.nx += 0.6;
      else if (fx > 22.2) s.nx -= 0.6;
      if (fy < 0.8) s.ny += 0.6;
      else if (fy > 51.2) s.ny -= 0.6;
      brush(s);
    } });
  }
  w.paint(-0.3, 0, 0.6, T, () => PAL_HD.steel[1]);
  w.paint(31.7, 0, 0.6, T, () => PAL_HD.steel[1]);
  for (let x = 6; x < T; x += 8) w.ell(x + 0.5, 1.5, 0.9, 0.8, { mat: x === 22 ? lit : lamp, z: 1, tone: x === 22 ? 0.6 : 0 });
}

function leverBox(w: Wall, on: boolean): void {
  elevator(w);
  const housing = w.mat(PAL_HD.steel, { lo: 1, hi: 5, spec: 0.5, shine: 18 });
  const lever = w.mat(PAL_HD.red, { lo: 2, hi: 6, spec: 0.6, shine: 20 });
  const stem = w.mat(PAL_HD.steel, { lo: 2, hi: 6, spec: 0.9, shine: 26 });
  const red = w.mat(PAL_HD.red, { flat: true, lo: 1, hi: 7 });
  const green = w.mat(PAL_HD.green, { flat: true, lo: 0, hi: 7 });
  const hz = w.mat(PAL_HD.gold, { lo: 3, hi: 6, wrap: 0.1 });
  const ink = w.mat(PAL_HD.black, { lo: 0, hi: 2 });
  const x = 18;
  const y = 14;
  w.box(x, y, 28, 34, { mat: housing, z: 2, bevel: 1.2 });
  w.box(x + 3, y + 3, 22, 28, { mat: housing, z: 2.5, bevel: 0.8, tone: -0.3 });
  w.paint(x + 12, y + 6, 4, 22, () => PAL_HD.ink[0], 2.6);
  const ly = on ? y + 6 : y + 22;
  w.box(x + 13, on ? ly + 4 : y + 12, 2, 10, { mat: stem, z: 3.4 });
  w.box(x + 7, ly, 14, 4, { mat: lever, z: 4, bevel: 1, r: 0.8 });
  // lamps: red (off) and green (on), lit or dark
  w.ell(x + 5.5, y + 5.5, 1.6, 1.6, { mat: red, z: 3, tone: on ? -0.75 : 0.85 });
  w.ell(x + 22.5, y + 5.5, 1.6, 1.6, { mat: green, z: 3, tone: on ? 0.85 : -0.75 });
  // hazard stripes under the box
  w.box(x, y + 36, 28, 4, { mat: hz, z: 2, bevel: 0.4, tex: (s) => {
    if (stripe(tx(s.x), s.y, 8)) s.mat = ink;
  } });
}

function doorSlab(w: Wall, plate: 'gold' | 'silver' | null): void {
  const slab = w.mat(PAL_HD.slate, { lo: 2, hi: 6, spec: 0.35, shine: 14, wrap: 0.1 });
  const bar = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.8, shine: 22 });
  const head = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.9, shine: 26 });
  const wear: Texture = (s) => {
    s.tone += (hash2(Math.floor(tx(s.x) / 2), Math.floor(s.y * s.d), 151) < 0.15 ? -0.08 : 0) + (pn(s.x, s.y, 6, 152) - 0.5) * 0.08;
    pits(s, 153);
  };
  w.box(0, 0, T, T, { mat: slab, bevel: 2, tex: wear });
  for (const y of [5, 36]) {
    w.box(6, y, 52, 23, { mat: slab, z: 2.05, tone: -0.2, tex: (s) => {
      // the inset: bevel lit bottom / right (recessed), horizontal pressed ribs
      const fx = lx(s, 6);
      const fy = s.y - y;
      if (fx < 1) s.nx += 0.6;
      else if (fx > 51) s.nx -= 0.6;
      if (fy < 1) s.ny += 0.6;
      else if (fy > 22) s.ny -= 0.6;
      const r = (fy - 4) % 5;
      if (fy > 3 && fy < 21 && fx > 3 && fx < 48 && r >= 0 && r < 1.4) s.ny += r < 0.7 ? -0.6 : 0.6;
      wear(s);
    } });
  }
  w.box(2, 30, 60, 4, { mat: bar, z: 2.3, bevel: 0.9, r: 0.5 });
  for (let x = 4; x < T; x += 9) rivet(w, x + 1, 32, head, 0.8, 3.2);
  if (plate) {
    const pm = plate === 'gold' ? w.mat(PAL_HD.gold, { lo: 2, hi: 6, spec: 0.9, shine: 22 }) : w.mat(PAL_HD.steel, { lo: 3, hi: 7, spec: 0.9, shine: 26 });
    w.box(24, 22, 16, 20, { mat: pm, z: 3.4, bevel: 1, r: 0.6 });
    w.paint(30, 27, 4, 10, (px, py) => {
      const kh = Math.hypot(px - 32, py - 29) < 1.8 || (py >= 29 && py < 36 && Math.abs(px - 32) < 0.9 + (py - 29) * 0.06);
      return kh ? PAL_HD.ink[0] : 0;
    }, 5);
    for (const [sx, sy] of [[26, 24], [38, 24], [26, 40], [38, 40]]) rivet(w, sx, sy, pm, 0.6, 4.4);
  }
}

function liftDoor(w: Wall): void {
  elevator(w);
  const hzm = w.mat(PAL_HD.gold, { lo: 3, hi: 6, wrap: 0.1 });
  const ink = w.mat(PAL_HD.black, { lo: 0, hi: 2 });
  const handle = w.mat(PAL_HD.steel, { lo: 1, hi: 5, spec: 0.7, shine: 20 });
  w.paint(30.8, 0, 1.4, T, (px) => (px < 31.6 ? PAL_HD.ink[0] : PAL_HD.steel[2]), 2);
  for (const x of [0, 62]) w.box(x, 0, 2, T, { mat: hzm, z: 1, tex: (s) => {
    if (stripe(tx(s.x), s.y, 8)) s.mat = ink;
  } });
  w.box(26, 28, 3, 8, { mat: handle, z: 1.6, bevel: 0.8, r: 0.6 });
  w.box(35, 28, 3, 8, { mat: handle, z: 1.6, bevel: 0.8, r: 0.6 });
}

function doorEdge(w: Wall): void {
  const steel = w.mat(PAL_HD.steel, { lo: 1, hi: 5, spec: 0.5, shine: 18 });
  const hzm = w.mat(PAL_HD.gold, { lo: 2, hi: 6, wrap: 0.1 });
  const ink = w.mat(PAL_HD.black, { lo: 0, hi: 2 });
  const head = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.9, shine: 26 });
  w.plane({ mat: steel, tex: (s) => {
    const x = tx(s.x);
    s.tone += (pn(s.x, s.y, 5, 160) - 0.5) * 0.2;
    if (x < 8 || x >= 56) {
      s.mat = stripe(x, s.y, 16) ? ink : hzm;
      s.tone += (pn(s.x, s.y, 2, 161) - 0.5) * 0.25;
      pits(s, 162, 2);
    }
  } });
  // the guide groove
  w.box(26, 0, 12, T, { mat: steel, z: 0.1, tone: -0.35, tex: (s) => {
    const fx = lx(s, 26);
    if (fx < 1) s.nx += 0.7;
    else if (fx > 11) s.nx -= 0.7;
  } });
  for (let y = 4; y < T; y += 12) {
    rivet(w, 15, y + 1, head, 0.9, 1);
    rivet(w, 48, y + 1, head, 0.9, 1);
  }
}

// ------------------------------------------------------------------------------------ overlays

/** The hanging banner (the 1× `banner` geometry): rod, folded red cloth, the white disc and symbol, the swallow-tail hem. */
function banner(w: Wall, x: number, y: number, bw: number, bh: number): void {
  const cloth = w.mat(PAL_HD.red, { lo: 1, hi: 6, wrap: 0.3 });
  const white = w.mat(PAL_HD.cloth, { lo: 1, hi: 5, wrap: 0.3 });
  const rod = w.mat(PAL_HD.steel, { lo: 1, hi: 6, spec: 0.8, shine: 22 });
  const brass = w.mat(PAL_HD.gold, { lo: 2, hi: 6, spec: 0.9, shine: 22 });
  const cx = x + bw / 2;
  const cy = y + Math.min(bh * 0.42, bw * 0.62);
  const dr = Math.min(bw * 0.38, bh * 0.3);
  w.cyl(x - 3, y - 2, bw + 6, 2, { mat: rod, z: 4, axis: 'h' });
  w.ell(x - 3.5, y - 1.5, 1.2, 1.2, { mat: brass, z: 4.5 });
  w.ell(x + bw + 3.5, y - 1.5, 1.2, 1.2, { mat: brass, z: 4.5 });
  w.box(x, y - 0.5, bw, bh + 4.5, {
    mat: cloth,
    z: 3,
    tex: (s) => {
      const px = tx(s.x);
      const py = s.y;
      // swallow-tail hem
      if (py >= y + bh) {
        const i = Math.floor(py - y - bh);
        if (px < x + i || px >= x + bw - i || Math.abs(Math.floor(px) + 0.5 - cx) < i + 1) {
          s.cut = true;
          return;
        }
      }
      // vertical folds: a soft cosine across the width, the cloth swelling and falling back
      const a = ((px - x) / bw) * Math.PI * 3;
      s.nx += -Math.sin(a) * 0.55;
      s.tone += Math.cos(a) * 0.12 + (py < y + 1 ? 0.25 : 0);
      if (px - x < 0.6 || x + bw - px < 0.6) s.tone -= 0.35;
      // the disc and the symbol
      const ddx = px - cx;
      const ddy = py - cy;
      const r = Math.hypot(ddx, ddy);
      if (r <= dr) {
        if (inHookedCross(ddx, ddy, dr * 0.82)) {
          s.fix = PAL_HD.ink[0];
          return;
        }
        s.mat = white;
        if (r > dr - 0.7) s.tone -= 0.4;
      }
      s.tone += (pn(s.x, py, 1.5, 170) - 0.5) * 0.08;
    },
  });
}

function notice(w: Wall): void {
  const cork = w.mat(PAL_HD.brown, { lo: 3, hi: 6, wrap: 0.2 });
  const frame = w.mat(PAL_HD.wood, { lo: 1, hi: 6, spec: 0.1 });
  const paper = w.mat(PAL_HD.cloth, { lo: 2, hi: 6, wrap: 0.3 });
  const yellow = w.mat(PAL_HD.sand, { lo: 4, hi: 7, wrap: 0.3 });
  const pin = w.mat(PAL_HD.red, { lo: 2, hi: 7, spec: 0.9, shine: 26 });
  w.box(11, 11, 42, 32, { mat: frame, z: 1, bevel: 1.2 });
  w.box(12.5, 12.5, 39, 29, { mat: cork, z: 2.6, tex: (s) => {
    s.tone += (hash2(Math.floor(tx(s.x) * 2), Math.floor(s.y * 2), 161) - 0.5) * 0.35 - 0.1;
    pits(s, 166, 3);
  } });
  const sheet = (x: number, y: number, sw: number, sh: number, mat: number, tone: number, seed: number): void => {
    w.box(x, y, sw, sh, { mat, z: 3, tone, bevel: 0.5, tex: (s) => {
      const fy = s.y - y;
      const fx = tx(s.x) - x;
      // unreadable scribble lines (no text)
      const ly = Math.floor(fy / 2);
      if (fy > 2.5 && fy < sh - 1 && fy - ly * 2 < 0.6 + 0.3 / s.d && fx > 1.5 && fx < 2 + hash2(ly, x, seed) * (sw - 5) && hash2(Math.floor(fx * 2), ly, seed + 1) < 0.8) s.fix = PAL_HD.stone[2];
      // a curled lower corner
      if (fx > sw - 2.2 && fy > sh - 2.2 && fx + fy > sw + sh - 2.6) s.ny -= 0.6;
    } });
    w.ell(x + (sw >> 1) + 0.5, y + 1.3, 0.9, 0.9, { mat: pin, z: 4 });
  };
  sheet(15, 15, 12, 16, paper, 0.1, 162);
  sheet(30, 14, 10, 12, yellow, 0, 163);
  sheet(42, 17, 8, 10, paper, -0.2, 164);
  sheet(28, 29, 16, 10, paper, 0.05, 165);
}

function woodMap(w: Wall): void {
  const sea = w.mat(PAL_HD.sky, { lo: 2, hi: 6, wrap: 0.3 });
  const land = w.mat(PAL_HD.sand, { lo: 3, hi: 7, wrap: 0.3 });
  const frame = w.mat(PAL_HD.brown, { lo: 0, hi: 3 });
  const pin = w.mat(PAL_HD.red, { lo: 2, hi: 7, spec: 0.9, shine: 26 });
  const pinB = w.mat(PAL_HD.sky, { lo: 0, hi: 5, spec: 0.9, shine: 26 });
  const x0 = 10;
  const y0 = 26;
  const mw = 44;
  const mh = 28;
  const isLand = (x: number, y: number): boolean => noise2x(x * 1.3, y * 1.3, 9, T * 1.3, 171) > 0.52;
  w.box(x0 - 1, y0 - 1, mw + 2, mh + 2, { mat: frame, z: 1, bevel: 0.6 });
  w.box(x0, y0, mw, mh, { mat: sea, z: 2, tex: (s) => {
    const x = tx(s.x);
    const y = s.y;
    const l = isLand(x, y);
    if (l) s.mat = land;
    // coastlines (a darker shore line), soft paper wear
    const e = 0.6;
    if (l && (!isLand(x + e, y) || !isLand(x - e, y) || !isLand(x, y + e) || !isLand(x, y - e))) s.tone -= 0.5;
    if (!l && (isLand(x + e * 1.5, y) || isLand(x - e * 1.5, y) || isLand(x, y + e * 1.5) || isLand(x, y - e * 1.5))) s.tone += 0.35;
    // the grid
    const gx = (x - x0) % 11;
    const gy = (y - y0) % 9;
    if (gx < 0.5 / s.d + 0.15 || gy < 0.5 / s.d + 0.15) s.fix = l ? PAL_HD.sand[3] : PAL_HD.sky[4];
    s.tone += (pn(s.x, y, 3, 172) - 0.5) * 0.15;
    // the dashed route between the pins
    const k = x - (x0 + 12);
    if (k >= 0 && k < 18 && Math.floor(k / 1.5) % 2 === 0 && Math.abs(y - (y0 + 10.5 + k / 3)) < 0.45) s.fix = PAL_HD.red[4];
  } });
  for (const [px, py, red] of [[x0 + 12.5, y0 + 9.5, true], [x0 + 30.5, y0 + 15.5, true], [x0 + 22.5, y0 + 21.5, false], [x0 + 36.5, y0 + 6.5, true]] as const) {
    w.ell(px, py, 1, 1, { mat: red ? pin : pinB, z: 3 });
  }
}

// ------------------------------------------------------------------------------------ the list

type HdPainter = (w: Wall) => void;

/** §8.1 id → UHD painter (the same keys as WALL_PAINTERS). */
export const WALL_PAINTERS_HD: Readonly<Record<string, HdPainter>> = {
  'fps/wall/concrete': concrete,
  'fps/wall/concrete-banner': (w) => {
    concrete(w);
    banner(w, 20, 6, 24, 46);
  },
  'fps/wall/brick': brick,
  'fps/wall/brick-notice': (w) => {
    brick(w);
    notice(w);
  },
  'fps/wall/crates': crates,
  'fps/wall/wood': woodPanel,
  'fps/wall/wood-map': (w) => {
    woodPanel(w);
    woodMap(w);
  },
  'fps/wall/steel': steelPlate,
  'fps/wall/steel-vent': (w) => {
    steelPlate(w);
    vent(w, 14, 18, 36, 26);
  },
  'fps/wall/hangar': corrugated,
  'fps/wall/hangar-banner': (w) => {
    corrugated(w);
    banner(w, 18, 4, 28, 54);
  },
  'fps/wall/freight': freight,
  'fps/wall/tile': tile,
  'fps/wall/cellar': cellar,
  'fps/wall/sandbags': sandbags,
  'fps/wall/steel-pipes': pipes,
  'fps/wall/elevator': elevator,
  'fps/wall/switch': (w) => leverBox(w, false),
  'fps/wall/switch-on': (w) => leverBox(w, true),
  'fps/door/plain': (w) => doorSlab(w, null),
  'fps/door/gold': (w) => doorSlab(w, 'gold'),
  'fps/door/silver': (w) => doorSlab(w, 'silver'),
  'fps/door/lift': liftDoor,
  'fps/door/edge': doorEdge,
};

/**
 * Paint a §8.1 texture at density d: its lit face and its y-side variant, both (64·d)². `shift`
 * (tests only; a multiple of 4 / d) moves the whole design right by that many logical px.
 */
export function paintWallHd(id: string, d: DenseDensity, shift = 0): { lit: PixelBuffer; dark: PixelBuffer } {
  const p = WALL_PAINTERS_HD[id];
  if (!p) throw new Error(`unknown wall texture ${id}`);
  const prev = SHIFT;
  SHIFT = shift;
  try {
    const w = new Wall(d);
    p(w);
    const lit = w.done();
    return { lit, dark: rayTexDarkHd(lit) };
  } finally {
    SHIFT = prev;
  }
}
