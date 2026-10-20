/**
 * The status-bar faces of the first-person mode (docs/design/fps.md §4.10, §8.4):
 * `fps/face/<character>` for the five friends and `recruit`, 32 × 32, 24 frames:
 * `band × 3 + glance` (0–20; glance 0 left, 1 centre, 2 right), 21 grin, 22 ouch, 23 dead.
 *
 * Each friend's face is their own select portrait (content/characters/select.art.ts, drawn from
 * the project's portrait kit) reduced with a box filter to palette colours and set in a round
 * porthole (the bar art carries the porthole ring). The recruit uses the project's 2× head rig.
 * Damage per band: soot, scratches, plasters, a black eye; bands 5–6 a small red cut (this mode
 * only). Glances turn the face a little left / right in the porthole.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL, nearest } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { PAL_HD } from '../../../engine/palette-hd';
import { defineSprite, type DenseDensity } from '../../../engine/sprites';
import { HD_EYE, HD_MOUTH, renderHeadHd } from '../../art/hd/head';
import { renderHeadHi, type HeadStyle } from '../../art/humanoid-head';
import { hash2, noise2 } from '../../art/paint';
import { greyed } from '../../art/portrait-kit';
import { selectPortrait, type SquadId } from '../characters/select.art';
import { nearestHd } from './fx-hd';

export const FACE = 32;
export const FACE_CHARS = ['vincent', 'thom', 'dirk', 'bob', 'patrick', 'recruit'] as const;
export type FaceChar = (typeof FACE_CHARS)[number];

/** Eye line and mouth (select-portrait 1× coordinates) per friend. */
interface FaceGeo {
  eyes: [[number, number], [number, number]];
  mouthY: number;
}
const GEO: Readonly<Record<SquadId, FaceGeo>> = {
  vincent: { eyes: [[30, 47], [47, 45]], mouthY: 70 },
  thom: { eyes: [[22, 53], [44, 52]], mouthY: 76 },
  dirk: { eyes: [[20, 48], [41, 48]], mouthY: 72 },
  bob: { eyes: [[19, 52], [40, 52]], mouthY: 75 },
  patrick: { eyes: [[19, 50], [39, 48]], mouthY: 72 },
};

/** Output pixels per select-portrait unit. */
const K = 0.42;

/** A face in the 32 × 32 frame plus where its features landed. */
interface FaceBase {
  b: PixelBuffer;
  eyes: [number, number][];
  mouth: [number, number];
}

/** Box-reduce the 2× select portrait around the face; `dx` turns the view (glance). */
function friendBase(id: SquadId, dx: number): FaceBase {
  const src = selectPortrait(id, 2);
  const g = GEO[id];
  const midX = (g.eyes[0][0] + g.eyes[1][0]) / 2;
  const eyeY = (g.eyes[0][1] + g.eyes[1][1]) / 2;
  // the eye line at row 14, the face centred, the view shifted by dx portrait units
  const x0 = midX - FACE / 2 / K + dx;
  const y0 = eyeY - 14 / K;
  const b = new PixelBuffer(FACE, FACE);
  const step = 1 / K; // portrait units per output pixel
  for (let y = 0; y < FACE; y++) {
    for (let x = 0; x < FACE; x++) {
      let r = 0;
      let gg = 0;
      let bb = 0;
      let n = 0;
      for (let sy = 0; sy < Math.round(step * 2); sy++) {
        for (let sx = 0; sx < Math.round(step * 2); sx++) {
          const px = Math.round((x0 + x * step) * 2 + sx);
          const py = Math.round((y0 + y * step) * 2 + sy);
          if (px < 0 || py < 0 || px >= src.w || py >= src.h) continue;
          const c = src.data[py * src.w + px];
          if ((c & 255) === 0) continue;
          r += c >>> 24;
          gg += (c >>> 16) & 255;
          bb += (c >>> 8) & 255;
          n++;
        }
      }
      if (n === 0) continue;
      const avg = ((Math.round(r / n) << 24) | (Math.round(gg / n) << 16) | (Math.round(bb / n) << 8) | 255) >>> 0;
      b.data[y * FACE + x] = nearest(avg);
    }
  }
  const at = (ux: number, uy: number): [number, number] => [Math.round((ux - x0) * K), Math.round((uy - y0) * K)];
  return { b, eyes: [at(g.eyes[0][0], g.eyes[0][1]), at(g.eyes[1][0], g.eyes[1][1])], mouth: at(midX, g.mouthY) };
}

const RECRUIT_HEAD: HeadStyle = {
  skin: PAL.skinA,
  hair: PAL.hairB,
  hairStyle: 'short',
  headgear: 'none',
  gear: PAL.olive,
  accent: PAL.sand,
  extras: [],
};

/**
 * The recruit: the 2× in-game head (36 × 38), centred in the porthole on a navy ground. The 1×
 * face keeps the old 2× template head (`renderHeadHi`), so its pixels stay as they were; the HD
 * faces below use the HD head.
 */
function recruitBase(dx: number, expr: 'normal' | 'happy' | 'hurt' | 'dazed'): FaceBase {
  const head = renderHeadHi(RECRUIT_HEAD, expr);
  const b = new PixelBuffer(FACE, FACE);
  b.fill(PAL.navy[0]);
  const ox = Math.round((FACE - head.w) / 2) + Math.round(dx / 2);
  // centre the head's opaque box vertically in the porthole (it sat low, cut by the ring)
  let top = head.h;
  let bottom = -1;
  for (let y = 0; y < head.h; y++) {
    for (let x = 0; x < head.w; x++) {
      if ((head.data[y * head.w + x] & 255) === 0) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const oy = bottom >= top ? Math.round((FACE - (bottom - top + 1)) / 2) - top + 1 : -1;
  b.blit(head, ox, oy);
  return { b, eyes: [[ox + 21, 18 + oy], [ox + 26, 18 + oy]], mouth: [ox + 24, 25 + oy] };
}

// ------------------------------------------------------------------------------------ damage

function put(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (x >= 0 && y >= 0 && x < FACE && y < FACE && (b.data[y * FACE + x] & 255) !== 0) b.data[y * FACE + x] = c;
}

/** Damage marks for a health band (0 = healthy … 6 = nearly dead). Deterministic. */
function damage(f: FaceBase, band: number, seed: number): void {
  const { b, eyes, mouth } = f;
  const [l, r] = eyes;
  // soot: 1–3 soft smudges (one cheek, then the forehead, then the jaw), growing with the band —
  // grouped, so they read as soot and not as spots
  const smudges: ReadonlyArray<readonly [number, number]> = [
    [l[0] - 2, l[1] + 4],
    [r[0] - 3, r[1] - 5],
    [mouth[0] - 5, mouth[1] + 2],
  ];
  for (let s = 0; s < Math.min(3, Math.ceil(band / 2)); s++) {
    const [sx, sy] = smudges[s];
    const n = 4 + band * 2;
    for (let i = 0; i < n; i++) {
      const x = sx + Math.round((hash2(i, 1, seed + s) - 0.5) * 4);
      const y = sy + Math.round((hash2(i, 2, seed + s) - 0.5) * 2.5);
      put(b, x, y, i % 3 === 0 ? PAL.ink[1] : PAL.stone[0]);
    }
  }
  if (band >= 2) {
    // a scratch across the cheek
    for (let k = 0; k < 4; k++) put(b, r[0] + 1 + k, r[1] + 4 + (k >> 1), PAL.rust[0]);
  }
  if (band >= 3) {
    // a plaster on the forehead
    const px = l[0] + 2;
    const py = l[1] - 6;
    for (let k = 0; k < 6; k++) {
      put(b, px + k, py + (k >> 2), PAL.sand[3]);
      put(b, px + k, py + 1 + (k >> 2), PAL.sand[2]);
    }
    put(b, px + 2, py + 1, PAL.sand[1]);
  }
  if (band >= 4) {
    // a black eye
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [0, 1], [1, 1]] as const) put(b, l[0] + dx, l[1] + dy, dy === 1 ? PAL.purple[0] : PAL.purple[1]);
    // a cross-plaster on the jaw (4 × 3; a 1-row strip read as a cigarette)
    const jx = mouth[0] + 4;
    const jy = mouth[1] + 2;
    for (let k = -1; k <= 2; k++) put(b, jx + k, jy, PAL.sand[3]);
    for (let k = -1; k <= 1; k++) put(b, jx + (k === 0 ? 0 : k), jy + k, k === 0 ? PAL.sand[3] : PAL.sand[2]);
    put(b, jx + 1, jy + 1, PAL.sand[2]);
  }
  if (band >= 5) {
    // a small red cut over the eyebrow (this mode only) and a trickle
    put(b, r[0] - 1, r[1] - 3, PAL.red[2]);
    put(b, r[0], r[1] - 3, PAL.red[2]);
    put(b, r[0] + 1, r[1] - 2, PAL.red[1]);
    if (band >= 6) {
      put(b, r[0] + 1, r[1] - 1, PAL.red[1]);
      put(b, r[0] + 2, r[1] + 1, PAL.red[0]);
      put(b, l[0] - 3, mouth[1] - 2, PAL.red[1]);
      put(b, l[0] - 3, mouth[1] - 1, PAL.red[0]);
    }
  }
}

function grin(f: FaceBase): void {
  const [mx, my] = f.mouth;
  for (let k = -4; k <= 4; k++) {
    const curve = Math.abs(k) >= 3 ? -1 : 0;
    put(f.b, mx + k, my - 1 + curve, INK);
    put(f.b, mx + k, my + curve, Math.abs(k) < 4 ? PAL.snow[2] : INK);
    put(f.b, mx + k, my + 1 + curve, Math.abs(k) < 3 ? INK : f.b.get(mx + k, my + 1));
  }
  for (const [ex, ey] of f.eyes) {
    // happy squint
    put(f.b, ex - 1, ey, INK);
    put(f.b, ex, ey - 1, INK);
    put(f.b, ex + 1, ey, INK);
  }
}

function ouch(f: FaceBase): void {
  const [mx, my] = f.mouth;
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && (dy === -1 || dy === 2)) continue;
      put(f.b, mx + dx, my + dy, Math.abs(dx) === 2 || dy === -1 || dy === 2 ? INK : PAL.red[0]);
    }
  }
  for (const [ex, ey] of f.eyes) {
    // wide eyes and raised brows
    put(f.b, ex - 1, ey, PAL.snow[2]);
    put(f.b, ex + 1, ey, PAL.snow[2]);
    put(f.b, ex, ey, INK);
    for (let k = -1; k <= 1; k++) put(f.b, ex + k, ey - 3, PAL.ink[1]);
  }
}

function dead(f: FaceBase): void {
  const g = greyed(f.b);
  f.b.data.set(g.data);
  for (const [ex, ey] of f.eyes) {
    for (const [dx, dy] of [[-1, -1], [1, 1], [0, 0], [1, -1], [-1, 1]] as const) put(f.b, ex + dx, ey + dy, INK);
  }
  const [mx, my] = f.mouth;
  for (let k = -2; k <= 2; k++) put(f.b, mx + k, my + (k === 2 ? 1 : 0), INK);
  put(f.b, mx + 1, my + 1, PAL.red[1]);
  put(f.b, mx + 1, my + 2, PAL.red[2]);
}

/** The porthole: a round mask (the bar art draws the ring around it). */
function porthole(b: PixelBuffer): PixelBuffer {
  for (let y = 0; y < FACE; y++) {
    for (let x = 0; x < FACE; x++) {
      const d = Math.hypot(x + 0.5 - FACE / 2, y + 0.5 - FACE / 2);
      if (d > FACE / 2) b.data[y * FACE + x] = 0;
      else if (d > FACE / 2 - 1 && (b.data[y * FACE + x] & 255) !== 0) b.data[y * FACE + x] = PAL.ink[1];
    }
  }
  return b.touch();
}

/** All 24 frames of a character's face. */
export function faceFrames(id: FaceChar): PixelBuffer[] {
  const frames: PixelBuffer[] = [];
  const base = (dx: number, expr: 'normal' | 'happy' | 'hurt' | 'dazed' = 'normal'): FaceBase => (id === 'recruit' ? recruitBase(dx, expr) : friendBase(id, dx));
  for (let band = 0; band < 7; band++) {
    for (let glance = 0; glance < 3; glance++) {
      const f = base((glance - 1) * 4);
      damage(f, band, 11 + band);
      frames.push(porthole(f.b));
    }
  }
  const g = base(0, 'happy');
  if (id !== 'recruit') grin(g);
  frames.push(porthole(g.b));
  const o = base(0, 'hurt');
  damage(o, 2, 13);
  if (id !== 'recruit') ouch(o);
  frames.push(porthole(o.b));
  const d = base(0, 'dazed');
  damage(d, 6, 17);
  dead(d);
  frames.push(porthole(d.b));
  return frames;
}

// ------------------------------------------------------------------------------------ UHD

/**
 * A face at density d (UHD): the same frames, framing and marks as at 1×, drawn natively at
 * (32·d)²: a friend's select portrait painted at density d (the portrait kit paints at any density)
 * and box-reduced to the face size in HD palette colours; the recruit's HD head at density 2·d;
 * the damage marks, expressions and the porthole as soft, clustered HD shapes in logical px.
 */
interface FaceHd {
  b: PixelBuffer;
  d: number;
  eyes: [number, number][];
  mouth: [number, number];
}

function friendBaseHd(id: SquadId, dx: number, d: DenseDensity): FaceHd {
  // The select portrait at density d (the type admits 1 | 2; the painter takes any density).
  const src = selectPortrait(id, d as unknown as 1 | 2);
  const g = GEO[id];
  const midX = (g.eyes[0][0] + g.eyes[1][0]) / 2;
  const eyeY = (g.eyes[0][1] + g.eyes[1][1]) / 2;
  const x0 = midX - FACE / 2 / K + dx;
  const y0 = eyeY - 14 / K;
  const N = FACE * d;
  const b = new PixelBuffer(N, N);
  const step = 1 / (K * d); // portrait units per output px
  const span = step * d; // source px per output px
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const sx0 = (x0 + x * step) * d;
      const sy0 = (y0 + y * step) * d;
      let r = 0;
      let gg = 0;
      let bb = 0;
      let n = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy0 + span); sy++) {
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx0 + span); sx++) {
          if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
          const c = src.data[sy * src.w + sx];
          if ((c & 255) === 0) continue;
          r += c >>> 24;
          gg += (c >>> 16) & 255;
          bb += (c >>> 8) & 255;
          n++;
        }
      }
      if (n === 0) continue;
      b.data[y * N + x] = nearestHd(((Math.round(r / n) << 24) | (Math.round(gg / n) << 16) | (Math.round(bb / n) << 8) | 255) >>> 0);
    }
  }
  const at = (ux: number, uy: number): [number, number] => [(ux - x0) * K, (uy - y0) * K];
  return { b, d, eyes: [at(g.eyes[0][0], g.eyes[0][1]), at(g.eyes[1][0], g.eyes[1][1])], mouth: at(midX, g.mouthY) };
}

function recruitBaseHd(dx: number, expr: 'normal' | 'happy' | 'hurt' | 'dazed', d: DenseDensity): FaceHd {
  const head = renderHeadHd(RECRUIT_HEAD, expr, (d * 2) as 4 | 8);
  const N = FACE * d;
  const b = new PixelBuffer(N, N);
  b.fill(PAL_HD.navy[1]);
  const ox = Math.round((N - head.w) / 2) + Math.round(dx / 2) * d;
  let top = head.h;
  let bottom = -1;
  for (let y = 0; y < head.h; y++) {
    for (let x = 0; x < head.w; x++) {
      if ((head.data[y * head.w + x] & 255) === 0) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const oy = bottom >= top ? Math.round((N - (bottom - top + 1)) / 2) - top + d : -d;
  b.blit(head, ox, oy);
  // the head's logical px are half a face px: features in face logical px
  const ex = ox / d + HD_EYE[0] * 2;
  const ey = oy / d + HD_EYE[1] * 2;
  return { b, d, eyes: [[ex - 2.5, ey], [ex + 2.5, ey]], mouth: [ox / d + HD_MOUTH[0] * 2, oy / d + HD_MOUTH[1] * 2] };
}

/** Visit the face's opaque art px inside the logical box: fn(x, y, c) → new colour (0 = keep). */
function onFace(f: FaceHd, x: number, y: number, w: number, h: number, fn: (x: number, y: number, c: Color) => Color): void {
  const { b, d } = f;
  const X0 = Math.max(0, Math.floor(x * d));
  const X1 = Math.min(b.w, Math.ceil((x + w) * d));
  const Y0 = Math.max(0, Math.floor(y * d));
  const Y1 = Math.min(b.h, Math.ceil((y + h) * d));
  for (let Y = Y0; Y < Y1; Y++) {
    for (let X = X0; X < X1; X++) {
      const i = Y * b.w + X;
      const c = b.data[i];
      if ((c & 255) === 0) continue;
      const n = fn((X + 0.5) / d, (Y + 0.5) / d, c >>> 0);
      if (n !== 0) b.data[i] = n >>> 0;
    }
  }
}

/** Darken a skin / hair colour `k` HD tones (soot, bruises); any other colour → a deep ink. */
function sootOf(c: Color, k: number): Color {
  for (const r of [PAL_HD.skinA, PAL_HD.skinB, PAL_HD.skinC, PAL_HD.hairA, PAL_HD.hairB, PAL_HD.hairC, PAL_HD.stone, PAL_HD.sand, PAL_HD.brown, PAL_HD.olive]) {
    const i = (r as readonly Color[]).indexOf(c);
    if (i >= 0) return r[Math.max(0, i - k)];
  }
  return c;
}

/** A thin stroke from a to b, `w` logical px wide, in colour `col` (0 = no stroke) and a lit edge `lit`. */
function strokeHd(f: FaceHd, ax: number, ay: number, bx: number, by: number, w: number, col: Color, lit: Color = 0): void {
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy || 1;
  onFace(f, Math.min(ax, bx) - w - 1, Math.min(ay, by) - w - 1, Math.abs(dx) + 2 * w + 2, Math.abs(dy) + 2 * w + 2, (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    const ex = x - (ax + dx * t);
    const ey = y - (ay + dy * t);
    const dd = Math.hypot(ex, ey);
    if (dd <= w / 2) return col;
    if (lit !== 0 && dd <= w / 2 + 0.3 && ey > 0) return lit;
    return 0;
  });
}

function damageHd(f: FaceHd, band: number, seed: number): void {
  const [l, r] = f.eyes;
  const mouth = f.mouth;
  // soot: soft smudges (clustered value noise), growing with the band
  const smudges: ReadonlyArray<readonly [number, number]> = [
    [l[0] - 2, l[1] + 4],
    [r[0] - 3, r[1] - 5],
    [mouth[0] - 5, mouth[1] + 2],
  ];
  for (let s = 0; s < Math.min(3, Math.ceil(band / 2)); s++) {
    const [sx, sy] = smudges[s];
    const rx = 2 + band * 0.35;
    const ry = 1.3 + band * 0.2;
    onFace(f, sx - rx - 1, sy - ry - 1, 2 * rx + 2, 2 * ry + 2, (x, y, c) => {
      const e = Math.hypot((x - sx) / rx, (y - sy) / ry) + (noise2(x * 3, y * 3, 1.6, seed + s) - 0.5) * 0.7;
      if (e > 1) return 0;
      return sootOf(c, e < 0.45 ? 3 : 2);
    });
  }
  if (band >= 2) {
    // a scratch across the cheek: a dark line with a lit lower lip
    strokeHd(f, r[0] + 1, r[1] + 4, r[0] + 4.5, r[1] + 5.6, 0.45, PAL_HD.red[2], PAL_HD.skinA[6]);
  }
  if (band >= 3) {
    // a plaster on the forehead: a lit strip with a pad
    const px = l[0] + 2;
    const py = l[1] - 6;
    onFace(f, px - 0.2, py - 0.2, 6.4, 3, (x, y) => {
      const v = y - (py + (x - px) * 0.25);
      if (v < 0 || v > 2 || x > px + 6) return 0;
      if (Math.abs(x - (px + 2.5)) < 1 && v > 0.4 && v < 1.6) return PAL_HD.sand[4];
      return v < 0.5 ? PAL_HD.sand[7] : v > 1.5 ? PAL_HD.sand[4] : PAL_HD.sand[6];
    });
  }
  if (band >= 4) {
    // a black eye: a bruise ring round the left eye (purple, deeper below)
    onFace(f, l[0] - 3, l[1] - 2.5, 6, 5, (x, y, c) => {
      const e = Math.hypot((x - l[0] - 0.5) / 2.4, (y - l[1] - 0.6) / 1.9);
      if (e > 1 || e < 0.55) return 0;
      return y > l[1] + 0.8 ? PAL_HD.purple[1] : sootOf(c, 2) === c ? PAL_HD.purple[2] : PAL_HD.purple[2];
    });
    // a cross-plaster on the jaw
    const jx = mouth[0] + 4.5;
    const jy = mouth[1] + 2.5;
    strokeHd(f, jx - 1.6, jy - 1.2, jx + 1.6, jy + 1.2, 1, PAL_HD.sand[6], PAL_HD.sand[7]);
    strokeHd(f, jx - 1.6, jy + 1.2, jx + 1.6, jy - 1.2, 1, PAL_HD.sand[5]);
  }
  if (band >= 5) {
    // a small red cut over the eyebrow (this mode only) and a trickle
    strokeHd(f, r[0] - 1, r[1] - 2.6, r[0] + 1.4, r[1] - 2, 0.5, PAL_HD.red[4]);
    if (band >= 6) {
      strokeHd(f, r[0] + 1.2, r[1] - 2, r[0] + 2, r[1] + 1.4, 0.45, PAL_HD.red[2]);
      strokeHd(f, l[0] - 2.6, mouth[1] - 2, l[0] - 2.6, mouth[1] - 0.2, 0.5, PAL_HD.red[3]);
    }
  }
}

function grinHd(f: FaceHd): void {
  const [mx, my] = f.mouth;
  // an open grin: dark lips round a row of teeth, the corners up
  onFace(f, mx - 5, my - 3, 10, 5, (x, y) => {
    const u = (x - mx - 0.5) / 4.5;
    if (Math.abs(u) > 1) return 0;
    const top = my - 0.6 - u * u * 1.4;
    const bot = my + 1.2 - u * u * 2;
    if (y < top - 0.45 || y > bot + 0.45) return 0;
    if (y < top + 0.1 || y > bot - 0.1 || Math.abs(u) > 0.88) return PAL_HD.ink[1];
    return y < top + 1 ? PAL_HD.snow[5] : PAL_HD.snow[3];
  });
  for (const [ex, ey] of f.eyes) {
    // happy squint: a short dark arc
    onFace(f, ex - 1.8, ey - 1.5, 3.6, 2.2, (x, y) => {
      const u = (x - ex - 0.5) / 1.5;
      if (Math.abs(u) > 1) return 0;
      return Math.abs(y - (ey + 0.2 - (1 - u * u) * 0.9)) < 0.35 ? PAL_HD.ink[1] : 0;
    });
  }
}

function ouchHd(f: FaceHd): void {
  const [mx, my] = f.mouth;
  onFace(f, mx - 3, my - 2, 6, 5, (x, y) => {
    const e = Math.hypot((x - mx - 0.5) / 2.4, (y - my - 0.5) / 2);
    if (e > 1) return 0;
    return e > 0.72 ? PAL_HD.ink[1] : y < my - 0.2 ? PAL_HD.red[1] : PAL_HD.red[2];
  });
  for (const [ex, ey] of f.eyes) {
    // wide eyes and raised brows
    onFace(f, ex - 1.5, ey - 1, 3, 2, (x, y) => {
      const dd = Math.hypot(x - ex - 0.5, y - ey - 0.5);
      return dd < 0.55 ? PAL_HD.ink[0] : dd < 1.25 ? PAL_HD.snow[5] : 0;
    });
    strokeHd(f, ex - 1, ey - 2.6, ex + 2, ey - 2.9, 0.55, PAL_HD.hairA[1]);
  }
}

function deadHd(f: FaceHd): void {
  const g = greyed(f.b);
  f.b.data.set(g.data);
  for (const [ex, ey] of f.eyes) {
    strokeHd(f, ex - 0.8, ey - 0.8, ex + 1.8, ey + 1.8, 0.55, PAL_HD.ink[0]);
    strokeHd(f, ex + 1.8, ey - 0.8, ex - 0.8, ey + 1.8, 0.55, PAL_HD.ink[0]);
  }
  const [mx, my] = f.mouth;
  strokeHd(f, mx - 2, my + 0.5, mx + 2.4, my + 1.2, 0.55, PAL_HD.ink[0]);
  strokeHd(f, mx + 1.5, my + 1.3, mx + 1.6, my + 3, 0.6, PAL_HD.red[3]);
}

/** The porthole at density d: a round mask with a dark rim (the bar draws the brass ring round it). */
function portholeHd(f: FaceHd): PixelBuffer {
  const { b, d } = f;
  const N = FACE * d;
  for (let Y = 0; Y < N; Y++) {
    for (let X = 0; X < N; X++) {
      const r = Math.hypot((X + 0.5) / d - FACE / 2, (Y + 0.5) / d - FACE / 2);
      const i = Y * N + X;
      if (r > FACE / 2) b.data[i] = 0;
      else if (r > FACE / 2 - 0.75 && (b.data[i] & 255) !== 0) b.data[i] = PAL_HD.ink[1];
      else if (r > FACE / 2 - 1.6 && (b.data[i] & 255) !== 0) b.data[i] = sootOf(b.data[i] >>> 0, 1);
    }
  }
  return b.touch();
}

/** All 24 frames of a character's face at density d (the 1× frame order). */
export function faceFramesHd(id: FaceChar, d: DenseDensity): PixelBuffer[] {
  const frames: PixelBuffer[] = [];
  const base = (dx: number, expr: 'normal' | 'happy' | 'hurt' | 'dazed' = 'normal'): FaceHd => (id === 'recruit' ? recruitBaseHd(dx, expr, d) : friendBaseHd(id, dx, d));
  const clean = [base(-4), base(0), base(4)];
  for (let band = 0; band < 7; band++) {
    for (let glance = 0; glance < 3; glance++) {
      const c = clean[glance];
      const f: FaceHd = { ...c, b: c.b.clone() };
      damageHd(f, band, 11 + band);
      frames.push(portholeHd(f));
    }
  }
  const g = base(0, 'happy');
  if (id !== 'recruit') grinHd(g);
  frames.push(portholeHd(g));
  const o = base(0, 'hurt');
  damageHd(o, 2, 13);
  if (id !== 'recruit') ouchHd(o);
  frames.push(portholeHd(o));
  const dd = base(0, 'dazed');
  damageHd(dd, 6, 17);
  deadHd(dd);
  frames.push(portholeHd(dd));
  return frames;
}

for (const id of FACE_CHARS) defineSprite(`fps/face/${id}`, () => faceFrames(id), { anchor: 'top-left', hd: (d) => faceFramesHd(id, d) });
