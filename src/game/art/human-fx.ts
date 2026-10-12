/**
 * Frame effects for figures: soot-black silhouettes, cartoon flames, crumbling into ash, and
 * a small helper to stack extra pieces (props, chairs, ropes) onto a Frame while keeping the
 * anchor and points correct. All effects are deterministic (hash noise, no Math.random).
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import { INK, PAL, stepShade } from '../../engine/palette';
import type { Frame } from '../../engine/render';
import { hash2 } from './paint';

type Pts = Record<string, readonly [number, number]>;

/** A piece placed relative to a frame's anchor (top-left of `buf` at anchor + (x, y)). */
export interface Piece {
  buf: PixelBuffer;
  x: number;
  y: number;
  /** Draw behind the frame instead of in front. */
  behind?: boolean;
}

/** Stack pieces onto a frame. The result grows to fit; anchor and points stay correct. */
export function withPieces(f: Frame, pieces: readonly Piece[], extraPts?: Pts): Frame {
  let left = -f.ox;
  let top = -f.oy;
  let right = f.buf.w - f.ox;
  let bottom = f.buf.h - f.oy;
  for (const p of pieces) {
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    right = Math.max(right, p.x + p.buf.w);
    bottom = Math.max(bottom, p.y + p.buf.h);
  }
  const out = new PixelBuffer(right - left, bottom - top);
  for (const p of pieces) if (p.behind) out.blit(p.buf, p.x - left, p.y - top);
  out.blit(f.buf, -f.ox - left, -f.oy - top);
  for (const p of pieces) if (!p.behind) out.blit(p.buf, p.x - left, p.y - top);
  const pts: Pts = { ...(f.pts ?? {}), ...(extraPts ?? {}) };
  return { buf: out, ox: -left, oy: -top, pts };
}

/** Soot ramp by brightness: the cartoon "burnt to a crisp" look. */
const SOOT: readonly Color[] = [PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.stone[0]];

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
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const i = y * b.w + x;
      const c = d[i];
      if ((c & 255) === 0 || c === INK) continue;
      if (amount < 1 && hash2(x, y, seed) > amount) continue;
      const l = luma(c);
      d[i] = SOOT[l < 60 ? 0 : l < 110 ? 1 : l < 170 ? 2 : 3];
    }
  }
  if (eyes && f.pts?.head) {
    // Two wide white eyes near the face (the head point is the head centre, face to the right).
    const ex = f.ox + f.pts.head[0] + 2;
    const ey = f.oy + f.pts.head[1];
    if ((b.get(ex, ey) & 255) !== 0) b.set(ex, ey, PAL.snow[3]);
    if ((b.get(ex + 2, ey) & 255) !== 0) b.set(ex + 2, ey, PAL.snow[3]);
  }
  b.touch();
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
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
  for (let i = 0; i < d.length; i++) {
    const c = d[i];
    if ((c & 255) === 0 || c === INK) continue;
    let s = stepShade(c, -steps);
    if (luma(s) < 70) s = luma(s) < 40 ? PAL.ink[1] : PAL.steel[0];
    d[i] = s >>> 0;
  }
  b.touch();
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
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
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}
