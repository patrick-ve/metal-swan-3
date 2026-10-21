/**
 * Mission oldenzaal — the dead soldiers' heads (revision 2, spec §3.1). Owner: ZOMBIES.
 *
 * A head is drawn ON TOP of the rig's (bald) head at the frame's `head` point, at run time: one
 * body strip serves every head (helmet, field cap, bare skull; two faces), a helmet that flies off
 * just swaps the head, and the art budget stays small. Each head strip has one frame per TILT
 * (`HEAD_TILTS`, degrees clockwise: the chin goes down); the body frame names its tilt (`HEAD_PT`).
 *
 * The look (real fidelity, the 4× target of the ams heroes' heads): a rotting skull in side view —
 * grey-green and yellowed skin with darker decay, a sunken eye socket with a dull glow, the nose
 * gone, a torn cheek over the teeth, the jaw bone showing, a rotten ear, wisps of hair — under
 * the flared WW2 steel helmet (dented, chipped paint, rust; NO insignia: the helmet is plain) or a
 * plain field cap. Bloodless: rot, bone and dust.
 *
 * One density-generic drawer (`HdCanvas`) makes the 2× and 4× frames; the 1× frame is the same
 * drawer at density 1 snapped to the 64-colour `PAL` (`nearest`). Geometry is law: every frame
 * of a head strip is the same logical box with the anchor at the head centre.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL, nearest } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ_R2 } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, grime, texAll, type Texture } from '../../../art/hd';
import { hash2 } from '../../../art/paint';
import { defHi, vnoise, type D } from './art-kit';

/** Head tilts (deg, clockwise = chin down) of the head strips' frames. */
export const HEAD_TILTS: readonly number[] = [-40, -26, -14, -5, 0, 6, 14, 24, 36, 50, 66];

/** The head strip frame for a tilt (deg). */
export function tiltIndex(deg: number): number {
  let best = 0;
  for (let i = 1; i < HEAD_TILTS.length; i++) if (Math.abs(HEAD_TILTS[i] - deg) < Math.abs(HEAD_TILTS[best] - deg)) best = i;
  return best;
}

export type HeadGear = 'helm' | 'cap' | 'bare';
export type HeadFace = 'a' | 'b';
export interface HeadLook {
  gear: HeadGear;
  face: HeadFace;
}

/** The head variants (the sprite ids: `enemy/oz-grunt/head/<name>`). */
export const HEADS = {
  'helm-a': { gear: 'helm', face: 'a' },
  'helm-b': { gear: 'helm', face: 'b' },
  'cap-a': { gear: 'cap', face: 'a' },
  'bare-a': { gear: 'bare', face: 'a' },
  'bare-b': { gear: 'bare', face: 'b' },
} as const satisfies Record<string, HeadLook>;
export type HeadName = keyof typeof HEADS;
export const HEAD_NAMES = Object.keys(HEADS) as HeadName[];

/** What a head becomes when its helmet / cap flies off. */
export const HEAD_BARE: Readonly<Record<HeadName, HeadName>> = { 'helm-a': 'bare-a', 'helm-b': 'bare-b', 'cap-a': 'bare-a', 'bare-a': 'bare-a', 'bare-b': 'bare-b' };

export const HEAD_PREFIX = 'enemy/oz-grunt/head/';
export const headId = (n: HeadName): string => HEAD_PREFIX + n;

/** The head box (logical px) and its anchor (the head centre). */
const HW = 20;
const HH = 20;
const AX = 10;
const AY = 10;

/** The eye (glow) position in head coords for a face (before the tilt). */
export const EYE: Readonly<Record<HeadFace, readonly [number, number]>> = { a: [3.5, -0.4], b: [3.4, -0.3] };

/** The eye point (logical, relative to the head anchor, facing right) at a tilt. */
export function eyeAt(face: HeadFace, tiltDeg: number): readonly [number, number] {
  const [x, y] = EYE[face];
  const a = (tiltDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

// =============================================================================================
// The drawer
// =============================================================================================

type P2 = readonly [number, number];

const ROT = PAL_HD_OZ_R2.rot;
const FG = PAL_HD_OZ_R2.fieldGrey;
/** Rust on old iron: brown, never red (bloodless: nothing may read as blood). */
const RUST = PAL_HD.brown;
const GLOW: Color = PAL_HD.olive[7];
const GLOW_CORE: Color = PAL_HD.gold[6];

function headBuf(look: HeadLook, tiltDeg: number, d: D, seed: number): PixelBuffer {
  const c = new HdCanvas(HW, HH, d);
  const a = (tiltDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  /** Head coords (facing right, centre 0,0) → canvas coords, turned by the tilt. */
  const T = (x: number, y: number): [number, number] => [AX + x * ca - y * sa, AY + x * sa + y * ca];
  const TP = (pts: readonly P2[]): Array<[number, number]> => pts.map(([x, y]) => T(x, y));
  /** The inverse: canvas → head coords (textures work in head space so the decay turns with the head). */
  const H = (x: number, y: number): [number, number] => {
    const dx = x - AX;
    const dy = y - AY;
    return [dx * ca + dy * sa, -dx * sa + dy * ca];
  };
  const hi = d >= 4;

  // ------------------------------------------------------------------ materials
  const skin = c.material({ ramp: ROT, lo: 1, hi: 6, spec: hi ? 0.35 : 0.2, shine: 22, wrap: 0.18, amb: 0.16, bounce: 0.3, rim: 0.06 });
  const skinDark = c.material({ ramp: ROT, lo: 0, hi: 4, spec: 0.2, shine: 18, wrap: 0.15, amb: 0.1 });
  const bone = c.material({ ramp: ROT, lo: 4, hi: 7, spec: 0.5, shine: 20, wrap: 0.2, amb: 0.2 });
  const cavity = c.material({ ramp: ROT, lo: 0, hi: 1, spec: 0, amb: 0.02, wrap: 0 });
  const teeth = c.material({ ramp: PAL_HD.sand, lo: 4, hi: 7, spec: 0.6, shine: 26, amb: 0.25 });
  const hair = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.5, shine: 14, amb: 0.1 });
  const steel = c.material({ ramp: FG, lo: 1, hi: 5, spec: 0.55, shine: 22, wrap: 0.06, amb: 0.1, rim: 0.12 });
  const rust = c.material({ ramp: RUST, lo: 1, hi: 4, spec: 0.15, shine: 10, amb: 0.08 });
  const wool = c.material({ ramp: FG, lo: 1, hi: 5, spec: 0.06, shine: 8, wrap: 0.2, amb: 0.12 });
  const leather = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.4, shine: 16, amb: 0.08 });

  // Decay blotches on the skin (head space): darker, greener patches and a few yellowed ones.
  const decay: Texture = (s) => {
    const [hx, hy] = H(s.x, s.y);
    const n = vnoise(hx * 0.9 + 3, hy * 0.9, seed);
    if (n < 0.22) s.tone -= 0.14;
    else if (n > 0.82) s.tone += 0.1;
    const m = vnoise(hx * 2.3, hy * 2.3 + 7, seed + 3);
    if (m < 0.07) s.mat = skinDark;
  };
  const skinTex = texAll(decay, grime(seed + 11, 0.35, 2.2));

  const face = look.face;
  const bare = look.gear === 'bare';

  // ------------------------------------------------------------------ the skull and the neck
  c.capsule(...T(-1.0, 3.0), ...T(-0.7, 6.8), 1.25, 1.35, { mat: skin, z: 0, tex: skinTex });
  // The cranium and the face (one soft volume; the jaw is its own part below).
  const skull: P2[] = [
    [-5.7, 0.4],
    [-5.6, -2.6],
    [-4.2, -5.0],
    [-1.6, -6.1],
    [1.4, -5.9],
    [3.8, -4.6],
    [5.2, -2.6],
    [5.8, -1.4],
    [5.2, -0.3],
    [6.0, 0.9],
    [5.6, 1.9],
    [4.4, 2.2],
    [1.2, 2.9],
    [-1.2, 3.4],
    [-3.6, 3.2],
    [-5.0, 2.2],
  ];
  c.blob(TP(skull), 2.2, { mat: skin, z: 1, bulge: 0.35, tex: skinTex });
  // The jaw (face b: it hangs open).
  const drop = face === 'b' ? 1.1 : 0.35;
  const jaw: P2[] = [
    [-0.4, 2.6],
    [2.0, 2.7 + drop * 0.4],
    [4.8, 3.0 + drop],
    [5.0, 3.9 + drop],
    [4.3, 4.7 + drop],
    [1.6, 4.9 + drop * 0.6],
    [-0.4, 4.4],
    [-1.4, 3.4],
  ];
  c.blob(TP(jaw), 1.1, { mat: skin, z: 1.2, bulge: 0.2, tex: skinTex });

  // ------------------------------------------------------------------ the face
  // The mouth: torn open (a) or the lips gone (b): a dark hollow with the teeth in it.
  const mouth: P2[] =
    face === 'a'
      ? [
          [1.8, 2.2],
          [4.9, 2.0],
          [5.3, 3.0 + drop],
          [4.6, 3.6 + drop],
          [2.0, 3.6 + drop * 0.5],
        ]
      : [
          [2.1, 1.9],
          [5.6, 1.9],
          [5.4, 3.8 + drop],
          [4.4, 4.3 + drop],
          [2.4, 3.9 + drop * 0.5],
        ];
  c.poly(TP(mouth), { mat: cavity, z: 4.5 });
  // Teeth: an upper and a lower row, yellowed, with dark gaps (a missing one or two).
  const teethRow = (x0: number, x1: number, y0: number, y1: number, k: number): void => {
    const n = Math.max(3, Math.round((x1 - x0) / 0.62));
    for (let i = 0; i < n; i++) {
      if (hash2(i, k, seed) < 0.18) continue; // a tooth gone
      const tx0 = x0 + ((x1 - x0) * i) / n + 0.06;
      const tx1 = x0 + ((x1 - x0) * (i + 1)) / n - 0.06;
      const ty = y0 + (y1 - y0) * (hash2(i, k + 4, seed) * 0.25);
      c.poly(TP([[tx0, ty], [tx1, ty], [tx1, y1], [tx0, y1]]), { mat: teeth, z: 4.8 + i * 0.01, tone: (hash2(i, k + 9, seed) - 0.5) * 0.4 });
    }
  };
  if (face === 'a') {
    teethRow(2.1, 4.9, 2.15, 2.85, 1);
    teethRow(2.3, 4.7, 3.05 + drop * 0.6, 3.6 + drop * 0.6, 2);
  } else {
    teethRow(2.3, 5.5, 1.95, 2.75, 1);
    teethRow(2.6, 5.2, 3.2 + drop, 3.8 + drop, 2);
  }
  // The torn cheek's skin edge and the jaw bone showing under it.
  c.capsule(...T(0.8, 4.2 + drop * 0.5), ...T(4.3, 4.5 + drop), 0.42, 0.36, { mat: bone, z: 4.6 });
  c.capsule(...T(1.0, 1.5), ...T(4.2, 1.35), 0.42, 0.3, { mat: bone, z: 4.6 }); // the cheekbone
  // The nose is gone: a dark notch.
  c.poly(TP([[5.1, -0.2], [6.0, 0.6], [5.5, 1.3], [5.0, 0.8]]), { mat: cavity, z: 4.6 });
  // The sunken eye: a deep socket under a heavy brow, a dull glow deep inside.
  c.ellipsoid(...T(3.4, -0.4), 1.35, 1.15, { mat: cavity, z: 4.4, round: 0.4 });
  c.capsule(...T(1.7, -1.75), ...T(5.4, -1.45), 0.55, 0.5, { mat: skin, z: 5.0, tex: skinTex }); // the brow ridge
  c.capsule(...T(2.6, 0.75), ...T(4.6, 0.55), 0.3, 0.3, { mat: skinDark, z: 4.9 }); // the lower lid, sagging
  // The ear (rotten, a dark hole).
  c.ellipsoid(...T(-1.5, 0.6), 1.0, 1.45, { mat: skinDark, z: 4.2 });
  c.ellipsoid(...T(-1.35, 0.7), 0.35, 0.55, { mat: cavity, z: 4.4, round: 0.2 });
  // A strip of loose skin on the cheek (face b) / a wrinkle fold (face a).
  if (face === 'b') c.poly(TP([[1.0, 2.4], [1.9, 2.5], [1.6, 4.6], [1.1, 4.4]]), { mat: skinDark, z: 4.9 });
  else c.capsule(...T(0.6, 1.9), ...T(1.9, 2.6), 0.28, 0.22, { mat: skinDark, z: 4.9 });

  // ------------------------------------------------------------------ hair, helmet, cap
  if (look.gear !== 'helm') {
    // Wisps of lank hair: from under the cap (cap) or over the bare, patchy crown.
    const n = bare ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const h0 = hash2(i, 31, seed);
      const sx = bare ? -4.6 + i * 1.2 + h0 * 0.6 : -5.2 + i * 0.5;
      const sy = bare ? -5.0 + Math.abs(i - 3) * 0.45 : -2.6 + i * 0.25;
      const ex = sx - 1.4 - h0 * 1.4;
      const ey = sy + 2.4 + h0 * 1.8;
      c.capsule(...T(sx, sy), ...T(ex, ey), 0.3, 0.18, { mat: hair, z: 6 + i * 0.01 });
    }
    if (bare) {
      // The skull bone shows through a patch of rotted scalp, with a crack.
      c.ellipsoid(...T(-0.6, -4.9), 1.6, 0.95, { mat: bone, z: 5.2, round: 0.6 });
      c.capsule(...T(-1.6, -5.0), ...T(0.3, -4.6), 0.14, 0.12, { mat: cavity, z: 5.8 });
    }
  }
  if (look.gear === 'helm') {
    // The flared steel helmet: dome, the visor lip over the brow, the skirt flaring at the back.
    const shell: P2[] = [
      [-6.9, 0.2],
      [-6.0, -3.6],
      [-4.2, -6.3],
      [-1.0, -7.6],
      [2.4, -7.3],
      [4.9, -5.6],
      [6.2, -3.4],
      [7.0, -1.5],
      [5.6, -1.25],
      [2.0, -1.4],
      [-1.4, -1.2],
      [-3.4, 0.4],
      [-5.0, 1.8],
      [-7.6, 2.8],
      [-7.6, 2.1],
    ];
    const rustSpots: Texture = (s) => {
      const [hx, hy] = H(s.x, s.y);
      const n = vnoise(hx * 1.4 + 11, hy * 1.4, seed + 5);
      const r = vnoise(hx * 2.4 + 5, hy * 2.4, seed + 6);
      if (n > 0.74 && r > 0.5) s.mat = rust;
      else if (n < 0.16) s.tone -= 0.25; // a dent
      const k = vnoise(hx * 4.5, hy * 4.5 + 2, seed + 9);
      if (k > 0.93) s.tone += 0.35; // chipped paint, bright steel
    };
    c.blob(TP(shell), 2.4, { mat: steel, z: 7, bulge: 0.55, tex: rustSpots });
    // The rolled rim (a darker lip) and the vent lug.
    c.stroke(TP([[6.9, -1.45], [2.0, -1.3], [-1.4, -1.1], [-3.4, 0.5], [-5.0, 1.9], [-7.5, 2.7]]), 0.32, 0.36, { mat: steel, z: 7.6, tone: -0.35 });
    c.ellipsoid(...T(-3.4, -3.0), 0.42, 0.42, { mat: steel, z: 8.6, tone: 0.2 });
    // The chin strap hangs loose from the rim.
    c.stroke(TP([[-0.6, -1.0], [-0.9, 1.4], [-0.4, 3.4]]), 0.26, 0.22, { mat: leather, z: 5.6 });
  } else if (look.gear === 'cap') {
    // The plain field cap (no badge): a boat-shaped side cap with a turned-up flap.
    const cap: P2[] = [
      [-5.2, -3.0],
      [-4.6, -5.4],
      [-2.4, -6.9],
      [1.4, -7.0],
      [3.8, -5.6],
      [4.9, -3.5],
      [4.2, -3.0],
      [-1.0, -2.6],
    ];
    c.blob(TP(cap), 1.5, { mat: wool, z: 7, bulge: 0.4, tex: grime(seed + 21, 0.4, 2) });
    c.stroke(TP([[-5.0, -3.0], [-1.0, -2.75], [2.0, -3.1], [4.6, -3.3]]), 0.5, 0.45, { mat: wool, z: 8.4, tone: 0.18 });
    c.capsule(...T(-3.0, -6.6), ...T(2.4, -6.7), 0.3, 0.3, { mat: wool, z: 8.6, tone: -0.2 }); // the crown seam
  }

  // ------------------------------------------------------------------ render, the eye glow
  const out = c.render({ outline: 'A', ao: 0.3, rimLight: hi ? 2 : 1, shadow: hi ? 0.28 : 0, shadowMax: 1.4 });
  const [ex, ey] = T(...EYE[face]);
  // The dull glow deep in the socket (fixed colours: the light pass keeps them visible).
  const gr = hi ? 0.62 : 0.5;
  for (let Y = Math.floor((ey - 1) * d); Y <= Math.ceil((ey + 1) * d); Y++) {
    for (let X = Math.floor((ex - 1) * d); X <= Math.ceil((ex + 1) * d); X++) {
      if (X < 0 || Y < 0 || X >= out.w || Y >= out.h) continue;
      const q = Math.hypot((X + 0.5) / d - ex, (Y + 0.5) / d - ey);
      if (d === 1) {
        if (q < 0.75) out.set(X, Y, GLOW);
      } else if (q < gr * 0.55) out.set(X, Y, GLOW_CORE);
      else if (q < gr) out.set(X, Y, GLOW);
    }
  }
  if (d === 1) snapPal(out);
  return out;
}

/** One head frame (cropped to its 1× twin's box at every density; the anchor is the head centre). */
export function headFrame(look: HeadLook, tiltDeg: number, d: D, seed: number): Frame {
  const one = headBuf(look, tiltDeg, 1, seed);
  const buf = d === 1 ? one : headBuf(look, tiltDeg, d, seed);
  const b = one.trimBounds();
  if (!b) return { buf, ox: AX, oy: AY, ...(d > 1 ? { density: d } : {}) };
  const x0 = Math.max(0, b.x - 1);
  const y0 = Math.max(0, b.y - 1);
  const x1 = Math.min(one.w, b.x + b.w + 1);
  const y1 = Math.min(one.h, b.y + b.h + 1);
  return { buf: buf.crop(x0 * d, y0 * d, (x1 - x0) * d, (y1 - y0) * d), ox: AX - x0, oy: AY - y0, ...(d > 1 ? { density: d } : {}) };
}

const DIM_1 = new Map<Color, Color>([
  [PAL.sand[3] >>> 0, PAL.stone[3]],
  [PAL.snow[1] >>> 0, PAL.stone[3]],
  [PAL.snow[2] >>> 0, PAL.stone[3]],
  [PAL.snow[3] >>> 0, PAL.stone[3]],
  [PAL.gold[3] >>> 0, PAL.sand[2]],
  [PAL.gold[2] >>> 0, PAL.sand[2]],
]);

/** 1×: every colour to the nearest of the 64-colour `PAL` (the drawer works in `PAL_HD`). */
function snapPal(b: PixelBuffer, dim = true): void {
  const memo = new Map<Color, Color>();
  for (let i = 0; i < b.data.length; i++) {
    const c = b.data[i];
    if ((c & 255) === 0) continue;
    if (c === INK) continue;
    let m = memo.get(c);
    if (m === undefined) {
      m = nearest(c);
      // Grim at 1×: no white or bright yellow (teeth and bone in a dusty grey-beige).
      if (dim) m = DIM_1.get(m >>> 0) ?? m;
      memo.set(c, m);
    }
    b.data[i] = m;
  }
  b.touch();
}

export { snapPal };

// =============================================================================================
// Registration
// =============================================================================================

const SEEDS: Readonly<Record<HeadName, number>> = { 'helm-a': 101, 'helm-b': 202, 'cap-a': 303, 'bare-a': 101, 'bare-b': 202 };

/** Register the head strips (one frame per tilt; held, never animated by itself). */
export function defineHeads(): void {
  for (const n of HEAD_NAMES) {
    const look: HeadLook = HEADS[n];
    defHi(headId(n), (d) => HEAD_TILTS.map((t) => headFrame(look, t, d, SEEDS[n])), { ticksPerFrame: 9999, loop: false });
  }
}

/** For the helmet / cap that flies off (the `oz-helmet` fx): the helmet alone, turning (8 frames). */
export function gearFrame(gear: 'helm' | 'cap', turn: number, d: D): Frame {
  const c = new HdCanvas(12, 12, d);
  const a = (turn * Math.PI) / 4;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const T = (x: number, y: number): [number, number] => [6 + x * ca - y * sa, 6 + x * sa + y * ca];
  const TP = (pts: readonly P2[]): Array<[number, number]> => pts.map(([x, y]) => T(x, y));
  const hi = d >= 4;
  if (gear === 'helm') {
    const steel = c.material({ ramp: FG, lo: 1, hi: 5, spec: 0.55, shine: 22, wrap: 0.06, amb: 0.1, rim: 0.12 });
    const rust = c.material({ ramp: RUST, lo: 1, hi: 4, spec: 0.15, shine: 10, amb: 0.08 });
    const inside = c.material({ ramp: PAL_HD.black, lo: 0, hi: 2, spec: 0, amb: 0.05 });
    // The shell (centred on its own middle), the dark inside showing under the rim.
    const shell: P2[] = [[-5.2, 2.4], [-4.6, -0.6], [-2.6, -3.2], [0.4, -4.0], [3.0, -3.2], [4.6, -1.2], [5.4, 1.4], [3.6, 1.6], [-1.0, 1.6], [-3.2, 2.6], [-5.6, 3.6]];
    c.blob(TP(shell), 2.0, { mat: steel, z: 2, bulge: 0.5, tex: (s) => { if (vnoise(s.x * 1.4, s.y * 1.4, 77) > 0.74) s.mat = rust; } });
    c.poly(TP([[5.2, 1.5], [3.6, 2.4], [-1.0, 2.4], [-3.2, 3.2], [-1.2, 1.7], [3.6, 1.7]]), { mat: inside, z: 1 });
  } else {
    const wool = c.material({ ramp: FG, lo: 1, hi: 5, spec: 0.06, shine: 8, wrap: 0.2, amb: 0.12 });
    const cap: P2[] = [[-4.8, 1.6], [-4.0, -0.9], [-1.8, -2.5], [2.0, -2.4], [4.2, -0.8], [4.8, 1.6]];
    c.blob(TP(cap), 1.4, { mat: wool, z: 2, bulge: 0.4 });
  }
  const out = c.render({ outline: 'A', ao: 0.25, rimLight: hi ? 2 : 1 });
  if (d === 1) snapPal(out);
  return { buf: out, ox: 6, oy: 6, ...(d > 1 ? { density: d } : {}) };
}
