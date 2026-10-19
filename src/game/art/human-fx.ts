/**
 * Frame effects for figures: soot-black silhouettes, cartoon flames, crumbling into ash, and
 * a small helper to stack extra pieces (props, chairs, ropes) onto a Frame while keeping the
 * anchor and points correct. All effects are deterministic (hash noise, no Math.random).
 *
 * Dense frames (density 2 or 4, the UHD art): `withPieces`, `sootify`, `scorch` and `speckle` keep
 * the density and work in logical px (`sootify` and `scorch` step along the HD ramps there).
 * `withFlames` and `crumble` are 1× recipes; `withFlamesDense` and `crumbleDense` draw the same
 * effect natively at density d over a dense frame (lit flame tongues, a smooth ragged cut, a lit
 * ash mound) with the 1× effect frame's geometry, as `burnFrames` (human-sprites.ts) does.
 * `liftDense` lifts any other 1× effect onto a dense frame.
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import { INK, PAL, stepShade } from '../../engine/palette';
import { PAL_HD, hdHome } from '../../engine/palette-hd';
import { frameH, frameW, type Frame } from '../../engine/render';
import { HdCanvas } from './hd/canvas';
import { hash2 } from './paint';

type Pts = Record<string, readonly [number, number]>;

/** A piece placed relative to a frame's anchor (top-left of `buf` at anchor + (x, y)). */
export interface Piece {
  buf: PixelBuffer;
  x: number;
  y: number;
  /** Draw behind the frame instead of in front. */
  behind?: boolean;
  /** Density of `buf` (2 = a 2× drawing; default 1). x, y and the size are logical px. */
  density?: number;
}

/** 2× drawings registered for 1× piece buffers (see `setHiTwin`). */
const HI_TWINS = new WeakMap<PixelBuffer, PixelBuffer>();

/**
 * Register a hand-drawn 2× twin for a (cached) 1× piece buffer: exactly twice its size, the same
 * logical layout. `withPieces` on a 2× frame then draws the twin instead of the doubled 1× piece,
 * so recipes that pass 1× pieces get the 2× art without knowing the density.
 */
export function setHiTwin(lo: PixelBuffer, hi: PixelBuffer): void {
  if (hi.w !== lo.w * 2 || hi.h !== lo.h * 2) throw new Error(`2× twin is ${hi.w}×${hi.h}, expected ${lo.w * 2}×${lo.h * 2}`);
  HI_TWINS.set(lo, hi);
}

/**
 * Stack pieces onto a frame. The result grows to fit; anchor and points stay correct. On a 2×
 * frame (density 2) positions stay logical: a 1× piece is drawn doubled (or as its registered 2×
 * twin, see `setHiTwin`), a 2× piece as it is.
 */
export function withPieces(f: Frame, pieces: readonly Piece[], extraPts?: Pts): Frame {
  const d = f.density ?? 1;
  const pw = (p: Piece): number => p.buf.w / (p.density ?? 1);
  const ph = (p: Piece): number => p.buf.h / (p.density ?? 1);
  let left = -f.ox;
  let top = -f.oy;
  let right = frameW(f) - f.ox;
  let bottom = frameH(f) - f.oy;
  for (const p of pieces) {
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    right = Math.max(right, p.x + pw(p));
    bottom = Math.max(bottom, p.y + ph(p));
  }
  const out = new PixelBuffer((right - left) * d, (bottom - top) * d);
  const put = (p: Piece): void => {
    const pd = p.density ?? 1;
    const twin = pd === 1 && d === 2 ? HI_TWINS.get(p.buf) : undefined;
    const b = twin ?? (pd === d ? p.buf : pd < d ? p.buf.scaled(d / pd) : p.buf.downsampled(pd / d));
    out.blit(b, (p.x - left) * d, (p.y - top) * d);
  };
  for (const p of pieces) if (p.behind) put(p);
  out.blit(f.buf, (-f.ox - left) * d, (-f.oy - top) * d);
  for (const p of pieces) if (!p.behind) put(p);
  const pts: Pts = { ...(f.pts ?? {}), ...(extraPts ?? {}) };
  return withDensity({ buf: out, ox: -left, oy: -top, pts }, f);
}

/** `g` with the density of `f` (2× frames stay 2× through the effects). */
function withDensity(g: Frame, f: Frame): Frame {
  return f.density === undefined ? g : { ...g, density: f.density };
}

/** Soot ramp by brightness: the cartoon "burnt to a crisp" look. */
const SOOT: readonly Color[] = [PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.stone[0]];
/** The HD soot ramp (dense frames): more steps between ink and ash grey, cool and dusty. */
const SOOT_HD: readonly Color[] = [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.stone[1], PAL_HD.stone[2]];
/** Luma limits of the SOOT_HD steps. */
const SOOT_HD_AT: readonly number[] = [45, 70, 95, 125, 160];

function luma(c: Color): number {
  return (((c >>> 24) & 255) * 299 + ((c >>> 16) & 255) * 587 + ((c >>> 8) & 255) * 114) / 1000;
}

/**
 * Soot-black copy of a frame (amount 1 = fully black; 0.5 = smudged). The outline stays INK and
 * two white eye pixels are added at the head point when `eyes` is true.
 */
export function sootify(f: Frame, amount = 1, eyes = true, seed = 1): Frame {
  const b = f.buf.clone();
  const d = b.data;
  const dense = (f.density ?? 1) >= 2;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const i = y * b.w + x;
      const c = d[i];
      if ((c & 255) === 0 || c === INK) continue;
      if (amount < 1 && hash2(x, y, seed) > amount) continue;
      const l = luma(c);
      if (dense) {
        let k = 0;
        while (k < SOOT_HD_AT.length && l >= SOOT_HD_AT[k]) k++;
        d[i] = SOOT_HD[k];
      } else d[i] = SOOT[l < 60 ? 0 : l < 110 ? 1 : l < 170 ? 2 : 3];
    }
  }
  if (eyes && f.pts?.head) {
    // Two wide white eyes near the face (the head point is the head centre, face to the right);
    // on a 2× frame each eye is its logical pixel's 2 × 2 block.
    const d = f.density ?? 1;
    const ex = f.ox + f.pts.head[0] + 2;
    const ey = f.oy + f.pts.head[1];
    for (const x of [ex, ex + 2]) {
      for (let k = 0; k < d * d; k++) {
        const px = x * d + (k % d);
        const py = ey * d + Math.floor(k / d);
        if ((b.get(px, py) & 255) !== 0) b.set(px, py, PAL.snow[3]);
      }
    }
  }
  b.touch();
  return withDensity({ buf: b, ox: f.ox, oy: f.oy, pts: f.pts }, f);
}

/**
 * Cartoon flames licking up from the figure (phase 0..3 flickers). Flames grow from every
 * pixel on the silhouette's top edge, plus a few inside the body.
 */
export function withFlames(f: Frame, phase: number, seed = 7, height = 7): Frame {
  const src = f.buf;
  const pad = height + 2;
  const out = new PixelBuffer(src.w + 4, src.h + pad);
  out.blit(src, 2, pad);
  const fire = PAL.fire;
  const tongues: Array<[number, number, number]> = [];
  for (let x = 0; x < src.w; x++) {
    for (let y = 0; y < src.h; y++) {
      if ((src.get(x, y) & 255) === 0) continue;
      // Top edge of this column (and some interior ember spots).
      const h = hash2(x, phase, seed);
      if ((src.get(x, y - 1) & 255) === 0 && h > 0.35) {
        const len = 2 + Math.floor(hash2(x >> 1, phase + 11, seed) * (height - 1));
        tongues.push([x + 2, y + pad, len]);
      }
      break;
    }
  }
  for (const [x, y, len] of tongues) {
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const yy = y - k;
      const sway = Math.round(Math.sin((yy + phase * 3) * 0.9) * (t * 1.2));
      const col = t < 0.25 ? fire[5] : t < 0.55 ? fire[4] : t < 0.8 ? fire[3] : fire[2];
      out.set(x + sway, yy, col);
      if (t < 0.5) out.set(x + sway + 1, yy, t < 0.25 ? fire[6] : fire[4]);
    }
  }
  // A few glowing embers on the body: 2×1 clusters on a coarse grid (no speckle).
  for (let y = 0; y < src.h; y += 2) {
    for (let x = 0; x < src.w - 1; x += 3) {
      if ((src.get(x, y) & 255) === 0 || src.get(x, y) === INK || src.get(x + 1, y) === INK) continue;
      if (hash2(x, y, seed + phase * 31) > 0.86) {
        out.set(x + 2, y + pad, fire[4]);
        out.set(x + 3, y + pad, fire[3]);
      }
    }
  }
  return { buf: out, ox: f.ox + 2, oy: f.oy + pad, pts: f.pts };
}

/**
 * Crumble a (soot) frame: t = 0 intact … 1 fully collapsed into an ash pile on the ground
 * line (feet-anchored frames). Pixels drop away from the top down with a ragged edge; the
 * fallen ash collects in a mound.
 */
export function crumble(f: Frame, t: number, seed = 3): Frame {
  const src = f.buf;
  const tb = src.trimBounds();
  if (!tb) return f;
  const out = new PixelBuffer(src.w + 8, src.h);
  const top = tb.y;
  const bottom = tb.y + tb.h;
  const cut = top + (bottom - top) * Math.min(1, t * 1.05);
  let lost = 0;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if ((c & 255) === 0) continue;
      const edge = cut + (hash2(x, y, seed) - 0.5) * 6;
      if (y < edge) {
        lost++;
        continue;
      }
      out.set(x + 4, y, c);
    }
  }
  // Ash mound: width grows with the lost pixels, centred on the anchor.
  const area = Math.min(lost * 0.12, 60);
  const h = Math.max(1, Math.round(Math.sqrt(area) * 0.8));
  const w = Math.max(3, Math.round(area / h) + 2);
  const cx = f.ox + 4;
  const groundY = f.oy - 1;
  for (let k = 0; k < h; k++) {
    const half = Math.round((w / 2) * (1 - k / (h + 1)));
    for (let x = cx - half; x <= cx + half; x++) {
      const yy = groundY - k;
      if (yy < 0 || yy >= out.h) continue;
      const lit = x < cx - half / 2 ? 2 : x > cx + half / 2 ? 0 : 1;
      out.set(x, yy, [PAL.ink[1], PAL.steel[0], PAL.stone[0]][lit]);
    }
  }
  if (t > 0.3) {
    // A few falling flakes above the mound.
    for (let i = 0; i < 6; i++) {
      const x = cx - 6 + Math.floor(hash2(i, 1, seed) * 12);
      const y = groundY - h - 2 - Math.floor(hash2(i, Math.round(t * 10), seed) * 10);
      if (y >= 0) out.set(x, y, PAL.stone[0]);
    }
  }
  out.outline(INK);
  return { buf: out, ox: f.ox + 4, oy: f.oy, pts: f.pts };
}

/**
 * Scorched copy: every colour steps `steps` shades darker along its palette ramp (clean,
 * no noise), dark colours fall to soot. Used for explosion and burning deaths.
 */
export function scorch(f: Frame, steps = 2): Frame {
  const b = f.buf.clone();
  const d = b.data;
  const dense = (f.density ?? 1) >= 2;
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if ((c & 255) === 0 || c === INK) continue;
    let s: Color;
    if (dense) {
      // A 1× step spans about 1.3 tones of an HD ramp (the 1× colours sit spread over it).
      const h = hdHome(c);
      s = h ? h.ramp[Math.max(0, h.i - Math.round(steps * 1.3))] : c;
      if (luma(s) < 52) s = luma(s) < 32 ? PAL_HD.ink[1] : luma(s) < 42 ? PAL_HD.steel[0] : PAL_HD.steel[1];
    } else {
      s = stepShade(c, -steps);
      if (luma(s) < 70) s = luma(s) < 40 ? PAL.ink[1] : PAL.steel[0];
    }
    d[i] = s >>> 0;
  }
  b.touch();
  return withDensity({ buf: b, ox: f.ox, oy: f.oy, pts: f.pts }, f);
}

/** Tint every non-outline pixel toward a colour by replacing a fraction (smudges, frost). */
export function speckle(f: Frame, colors: readonly Color[], amount: number, seed = 5): Frame {
  const b = f.buf.clone();
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if ((c & 255) === 0 || c === INK) continue;
      if (hash2(x, y, seed) < amount) b.set(x, y, colors[Math.floor(hash2(y, x, seed + 1) * colors.length) % colors.length]);
    }
  }
  return withDensity({ buf: b, ox: f.ox, oy: f.oy, pts: f.pts }, f);
}

/**
 * The dense twin (density d) of a 1× effect frame `out1` that was made from the 1× source `src1`
 * placed at (dx, dy) in it (flames, crumbling, …), over the dense source `srcD` (the same frame at
 * density d): where `out1` still shows the source pixel the dense art stays as it is (its own
 * silhouette and outline too, next to such pixels); a source pixel the effect removed clears its
 * d × d block; every pixel the effect added or changed is painted as a logical pixel of its colour.
 */
export function liftDense(out1: Frame, src1: PixelBuffer, srcD: PixelBuffer, dx: number, dy: number, d: number): Frame {
  const o = out1.buf;
  const out = new PixelBuffer(o.w * d, o.h * d);
  out.blit(srcD, dx * d, dy * d);
  const src = (x: number, y: number): number => {
    const sx = x - dx;
    const sy = y - dy;
    return sx >= 0 && sy >= 0 && sx < src1.w && sy < src1.h ? src1.get(sx, sy) : 0;
  };
  /** 0 empty in both, 1 unchanged source px, 2 removed, 3 added or changed. */
  const kind = new Uint8Array(o.w * o.h);
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      const c = o.get(x, y);
      const sc = src(x, y);
      kind[y * o.w + x] = (c & 255) === 0 ? ((sc & 255) === 0 ? 0 : 2) : c === sc ? 1 : 3;
    }
  }
  const kept = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < o.w && y < o.h && kind[y * o.w + x] === 1;
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      const k = kind[y * o.w + x];
      if (k === 1) continue;
      // The dense silhouette may reach a little past the 1× one: keep it only beside kept pixels.
      if (k === 0 && (kept(x - 1, y) || kept(x + 1, y) || kept(x, y - 1) || kept(x, y + 1))) continue;
      out.rect(x * d, y * d, d, d, k === 3 ? o.get(x, y) : 0);
    }
  }
  out.touch();
  return { buf: out, ox: out1.ox, oy: out1.oy, ...(out1.pts ? { pts: out1.pts } : {}), density: d };
}

/** The flame tongues and embers of `withFlames(f1, …)` (1× out coords). */
function flamePlan(f1: Frame, phase: number, seed: number, height: number): { tongues: Array<[number, number, number]>; embers: Array<[number, number]>; pad: number } {
  const src = f1.buf;
  const pad = height + 2;
  const tongues: Array<[number, number, number]> = [];
  for (let x = 0; x < src.w; x++) {
    for (let y = 0; y < src.h; y++) {
      if ((src.get(x, y) & 255) === 0) continue;
      const h = hash2(x, phase, seed);
      if ((src.get(x, y - 1) & 255) === 0 && h > 0.35) {
        const len = 2 + Math.floor(hash2(x >> 1, phase + 11, seed) * (height - 1));
        tongues.push([x + 2, y + pad, len]);
      }
      break;
    }
  }
  const embers: Array<[number, number]> = [];
  for (let y = 0; y < src.h; y += 2) {
    for (let x = 0; x < src.w - 1; x += 3) {
      if ((src.get(x, y) & 255) === 0 || src.get(x, y) === INK || src.get(x + 1, y) === INK) continue;
      if (hash2(x, y, seed + phase * 31) > 0.86) embers.push([x + 2, y + pad]);
    }
  }
  return { tongues, embers, pad };
}

/**
 * `withFlames` drawn natively at the density d of `fd` (the dense twin of the 1× frame `f1`): the
 * same tongues (placed from the 1× silhouette, with the same phase, seed and height) as lit flame
 * volumes — a white-hot core, yellow, orange and a red tip, swaying — and glowing embers. The
 * result has the 1× effect frame's geometry.
 */
export function withFlamesDense(f1: Frame, fd: Frame, phase: number, seed = 7, height = 7): Frame {
  const d = fd.density ?? 2;
  const { tongues, embers, pad } = flamePlan(f1, phase, seed, height);
  const W = f1.buf.w + 4;
  const H = f1.buf.h + pad;
  const c = new HdCanvas(W, H, d);
  c.image(fd.buf, 2, pad, { z: 0 });
  const fire = c.material({ ramp: PAL_HD.fire, flat: true, lo: 1, hi: 6 });
  for (const [x, y, len] of tongues) {
    // The 1× tongue: px (x + sway, y − k), two wide in its lower half; sway grows to the tip.
    const pts: Array<[number, number]> = [];
    const n = Math.max(2, len);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const sway = Math.sin((y - k + phase * 3) * 0.9) * (t * 1.2);
      pts.push([x + 1 + sway - t * 0.4, y + 1 - k]);
    }
    const base = y + 1;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      c.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.05 * (1 - t0) + 0.15, 1.05 * (1 - t1) + 0.15, {
        mat: fire,
        z: 5,
        tex: (sm) => {
          const t = Math.max(0, Math.min(1, (base - sm.y) / n));
          // Hot at the root and the middle of the tongue, cooler at the edges and the tip.
          sm.tone = 0.18 - t * 0.7 + (1 - Math.abs(sm.v)) * 0.16;
        },
      });
    }
  }
  for (const [x, y] of embers) c.ellipsoid(x + 1, y + 0.5, 0.95, 0.45, { mat: fire, z: 4, tex: (sm) => { sm.tone = 0.25 - Math.hypot(sm.u, sm.v) * 0.35; } });
  const buf = c.render({ outline: 'none', ao: 0, sep: false });
  return { buf, ox: f1.ox + 2, oy: f1.oy + pad, ...(f1.pts ? { pts: f1.pts } : {}), density: d };
}

/** Smooth value noise in [0, 1) over logical px (bilinear between hash2 lattice values). */
function noise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const e = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
}

/**
 * `crumble` drawn natively at the density d of `fd` (the dense soot statue, twin of the 1× `f1`):
 * the statue falls away from the top down along a smooth ragged edge (the cut gets a d-px
 * outline), the ash collects in a lit mound sized like the 1× one, flakes fall above it. The
 * result has the 1× crumble frame's geometry.
 */
export function crumbleDense(f1: Frame, fd: Frame, t: number, seed = 3): Frame {
  const d = fd.density ?? 2;
  const src1 = f1.buf;
  const tb = src1.trimBounds();
  if (!tb) return fd;
  const top = tb.y;
  const bottom = tb.y + tb.h;
  const cut = top + (bottom - top) * Math.min(1, t * 1.05);
  // The 1× px lost (the mound's size, as at 1×).
  let lost = 0;
  for (let y = 0; y < src1.h; y++) {
    for (let x = 0; x < src1.w; x++) if ((src1.get(x, y) & 255) !== 0 && y < cut + (hash2(x, y, seed) - 0.5) * 6) lost++;
  }
  const W = src1.w + 8;
  const H = src1.h;
  const out = new PixelBuffer(W * d, H * d);
  const src = fd.buf;
  const kept = new Uint8Array(src.w * src.h);
  for (let Y = 0; Y < src.h; Y++) {
    const y = (Y + 0.5) / d;
    for (let X = 0; X < src.w; X++) {
      const c = src.data[Y * src.w + X];
      if ((c & 255) === 0) continue;
      const x = (X + 0.5) / d;
      if (y < cut + (noise2(x * 0.9, y * 0.6, seed) - 0.5) * 6) continue;
      kept[Y * src.w + X] = 1;
      out.data[Y * out.w + X + 4 * d] = c;
    }
  }
  // The cut edge: a d-px ink outline inside the statue's old footprint (its sides keep theirs).
  const ink = PAL_HD.ink[0] >>> 0;
  for (let Y = 0; Y < src.h; Y++) {
    for (let X = 0; X < src.w; X++) {
      const i = Y * src.w + X;
      if (kept[i] || (src.data[i] & 255) === 0) continue;
      let near = false;
      for (let dy = -d; dy <= d && !near; dy++) {
        const yy = Y + dy;
        if (yy < 0 || yy >= src.h) continue;
        for (let dx = -d; dx <= d; dx++) {
          const xx = X + dx;
          if (xx < 0 || xx >= src.w || dx * dx + dy * dy > d * d + d * 0.5) continue;
          if (kept[yy * src.w + xx]) {
            near = true;
            break;
          }
        }
      }
      if (near) out.data[Y * out.w + X + 4 * d] = ink;
    }
  }
  // The ash mound (centred on the anchor, resting on the ground line) and falling flakes.
  const area = Math.min(lost * 0.12, 60);
  const mh = Math.max(1, Math.round(Math.sqrt(area) * 0.8));
  const mw = Math.max(3, Math.round(area / mh) + 2);
  const cx = f1.ox + 4 + 0.5;
  const ground = f1.oy;
  const c = new HdCanvas(W, H, d);
  const ash = c.material({ ramp: [PAL_HD.ink[1], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3]], lo: 1, hi: 4, wrap: 0.1 });
  // A heap like the 1× one (rows narrowing to the top), with a lumpy crest.
  const base = ground - 1;
  const heap: Array<[number, number]> = [[cx - mw / 2 - 0.5, base], [cx + mw / 2 + 0.5, base]];
  const n = Math.max(4, mw * 2);
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    const x = cx - mw / 2 - 0.5 + u * (mw + 1);
    const prof = Math.pow(Math.max(0, 1 - Math.abs(u - 0.5) * 2), 0.7);
    heap.push([x, base - prof * (mh + 0.5) - (noise2(x * 1.3, 0.5, seed + 9) - 0.5) * 0.8 * prof]);
  }
  c.blob(heap, 0.9, { mat: ash, z: 1, bulge: 0.45, tex: (sm) => { sm.tone += (noise2(sm.x * 1.8, sm.y * 1.8, seed + 5) - 0.5) * 0.4; } });
  const mound = c.render({ outline: 'A', ao: 0, rimLight: 1 });
  out.blit(mound, 0, 0);
  if (t > 0.3) {
    for (let i = 0; i < 6; i++) {
      const x = cx - 6.5 + Math.floor(hash2(i, 1, seed) * 12);
      const y = ground - 1 - mh - 2 - Math.floor(hash2(i, Math.round(t * 10), seed) * 10);
      if (y < 0) continue;
      const k = Math.max(1, d >> 1);
      out.rect(Math.round(x * d + (d - k) / 2), Math.round(y * d + (d - k) / 2), k, k, PAL_HD.stone[2]);
    }
  }
  out.touch();
  return { buf: out, ox: f1.ox + 4, oy: f1.oy, ...(f1.pts ? { pts: f1.pts } : {}), density: d };
}
