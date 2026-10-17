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
import { defineSprite } from '../../../engine/sprites';
import { renderHeadHi, type HeadStyle } from '../../art/humanoid-head';
import { hash2 } from '../../art/paint';
import { greyed } from '../../art/portrait-kit';
import { selectPortrait, type SquadId } from '../characters/select.art';

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

/** The recruit: the 2× in-game head (36 × 38), centred in the porthole on a navy ground. */
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

for (const id of FACE_CHARS) defineSprite(`fps/face/${id}`, () => faceFrames(id), { anchor: 'top-left' });
