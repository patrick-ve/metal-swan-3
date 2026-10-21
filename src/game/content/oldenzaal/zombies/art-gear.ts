/**
 * Mission oldenzaal — the dead soldiers' gear and effects art (revision 2, spec §3). Owner: ZOMBIES.
 *
 * Pieces composed onto the rig bodies (art.ts): the trench shovel and the rifle held as a club
 * (the grunts), the gas-mask can and the bread bag on the back hip, the crawler's stump, the bone
 * pile of the collapse; the run-time overlays: the MG (every angle, whole / with the barrel jacket
 * shot off, carried / planted on its bipod); the effects: the cracks of a rise (pavers, earth,
 * stone, a drain cover), chunks of rot and cloth, the eye glow, the slow tracer shots.
 *
 * One density-generic drawer per piece (`HdCanvas`, logical units); the 1× art is the same drawer
 * at density 1 snapped to the 64-colour `PAL`. Every piece has a fixed logical box at every
 * density (geometry is law). Bloodless: rot, bone, cloth and dust; no red but the band.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ_R2 } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, grime, type RenderOpts, type Texture } from '../../../art/hd';
import { hash2 } from '../../../art/paint';
import { snapPal } from './art-head';
import { defHi, vnoise, type D } from './art-kit';

type P2 = readonly [number, number];

const FG = PAL_HD_OZ_R2.fieldGrey;
const ROT = PAL_HD_OZ_R2.rot;
/** Rust on old iron: brown, never red (bloodless: nothing may read as blood). */
const RUST = PAL_HD.brown;
const SOOT = PAL_HD_OZ_R2.soot;

/** A piece: a buffer at density d and its top-left in logical px relative to a frame anchor. */
export interface GearPiece {
  buf: PixelBuffer;
  x: number;
  y: number;
  density: number;
}

/**
 * Draw into a w × h logical canvas whose origin (0, 0) sits at (ax, ay) of the canvas, turned by
 * `deg` (clockwise) about the origin; returns the piece placed with the origin at (px, py).
 */
function piece(
  w: number,
  h: number,
  ax: number,
  ay: number,
  deg: number,
  d: D,
  draw: (c: HdCanvas, T: (x: number, y: number) => [number, number], TP: (p: readonly P2[]) => Array<[number, number]>) => void,
  ro: RenderOpts,
  px: number,
  py: number,
): GearPiece {
  const c = new HdCanvas(w, h, d);
  const a = (deg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // Whole logical px for the piece's box (geometry is law); the fraction moves the drawing inside it.
  const ix = Math.floor(px - ax);
  const iy = Math.floor(py - ay);
  const ox = ax + (px - ax - ix);
  const oy = ay + (py - ay - iy);
  const T = (x: number, y: number): [number, number] => [ox + x * ca - y * sa, oy + x * sa + y * ca];
  const TP = (p: readonly P2[]): Array<[number, number]> => p.map(([x, y]) => T(x, y));
  draw(c, T, TP);
  const buf = c.render(ro);
  if (d === 1) snapPal(buf);
  return { buf, x: ix, y: iy, density: d };
}

const SPRITE_RO: RenderOpts = { outline: 'A', ao: 0.25, rimLight: 2 };

// =============================================================================================
// Held weapons (grunts): the trench shovel, the rifle swung by its barrel
// =============================================================================================

/**
 * The trench shovel in the near hand: the handle's end in the fist at (hx, hy) (logical, anchor-
 * relative), pointing `deg` (0 = forward, 90 = down, −90 = up). A fixed 30 × 30 box.
 */
export function shovelPiece(hx: number, hy: number, deg: number, d: D): GearPiece {
  return piece(
    30,
    30,
    15,
    15,
    deg,
    d,
    (c, T, TP) => {
      const wood = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 4, spec: 0.3, shine: 12, amb: 0.1 });
      const blade = c.material({ ramp: PAL_HD.black, lo: 1, hi: 5, spec: 0.5, shine: 18, amb: 0.1 });
      const rust = c.material({ ramp: RUST, lo: 1, hi: 4, spec: 0.15, shine: 10, amb: 0.08 });
      const edge = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 5, spec: 0.8, shine: 24 });
      const grain: Texture = (s) => {
        if (hash2(Math.floor(s.u * 9), 3, 5) < 0.3) s.tone -= 0.15;
      };
      c.capsule(...T(-0.6, 0), ...T(8.2, 0), 0.5, 0.48, { mat: wood, z: 1, tex: grain });
      // The blade: a square spade with a pointed tip, pitted with rust, a worn bright edge.
      c.blob(TP([[8.0, -1.7], [11.6, -1.8], [13.2, 0], [11.6, 1.8], [8.0, 1.7]]), 0.7, {
        mat: blade,
        z: 1.2,
        bulge: 0.15,
        tex: (s) => {
          const n = vnoise(s.x * 2, s.y * 2, 41);
          if (n > 0.62) s.mat = rust;
          else if (n < 0.2) s.tone -= 0.25;
        },
      });
      c.stroke(TP([[11.4, -1.75], [13.1, 0], [11.4, 1.75]]), 0.22, 0.22, { mat: edge, z: 1.4 });
      c.capsule(...T(7.6, 0), ...T(8.6, 0), 0.75, 0.75, { mat: rust, z: 1.3, tone: -0.2 }); // the collar
    },
    SPRITE_RO,
    hx,
    hy,
  );
}

/** The rifle held by the barrel as a club (the coat grunt): the muzzle in the fist, the butt at the far end. */
export function clubPiece(hx: number, hy: number, deg: number, d: D): GearPiece {
  return piece(
    36,
    36,
    18,
    18,
    deg,
    d,
    (c, T, TP) => {
      const wood = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 4, spec: 0.35, shine: 14, amb: 0.1 });
      const metal = c.material({ ramp: PAL_HD.black, lo: 1, hi: 5, spec: 0.6, shine: 20, amb: 0.1 });
      const rust = c.material({ ramp: RUST, lo: 1, hi: 4, spec: 0.2, shine: 10 });
      c.capsule(...T(-0.8, 0), ...T(6.5, 0), 0.34, 0.36, { mat: metal, z: 1.4, tex: (s) => { if (vnoise(s.u * 7, 1, 9) > 0.62) s.mat = rust; } });
      // The stock: the fore-end, the wrist, the butt flaring out.
      c.blob(TP([[5.4, -0.55], [11.0, -0.7], [12.4, -0.5], [15.6, -0.9], [15.8, 1.9], [12.2, 1.1], [11.0, 0.7], [5.4, 0.55]]), 0.5, { mat: wood, z: 1.2, bulge: 0.2 });
      c.capsule(...T(9.6, -0.9), ...T(11.2, -0.9), 0.3, 0.3, { mat: metal, z: 1.6 }); // the bolt
      c.capsule(...T(15.6, -0.8), ...T(15.8, 1.8), 0.28, 0.28, { mat: metal, z: 1.5 }); // the butt plate
    },
    SPRITE_RO,
    hx,
    hy,
  );
}

// =============================================================================================
// The back hip: the gas-mask can and the bread bag (behind the body)
// =============================================================================================

/** The fluted gas-mask can on its strap, top at (x, y) (logical, anchor-relative). Box 5 × 8. */
export function canPiece(x: number, y: number, d: D): GearPiece {
  return piece(
    5,
    8,
    0,
    0,
    0,
    d,
    (c) => {
      const tin = c.material({ ramp: FG, lo: 1, hi: 5, spec: 0.5, shine: 18, amb: 0.1 });
      const rust = c.material({ ramp: RUST, lo: 1, hi: 4, spec: 0.2, shine: 10 });
      c.cylinder(1.0, 1.2, 3.0, 6.4, {
        mat: tin,
        z: 0,
        axis: 'v',
        tex: (s) => {
          if (Math.floor(s.v * 5) % 2 === 1 && s.v > 0.15) s.tone -= 0.2; // the flutes
          if (vnoise(s.x * 2.5, s.y * 2.5, 13) > 0.72) s.mat = rust;
        },
      });
      c.box(0.8, 0.6, 3.4, 1.0, { mat: tin, z: 0.6, bevel: 0.3, tone: 0.2 }); // the lid
    },
    SPRITE_RO,
    x,
    y,
  );
}

/** The canvas bread bag with its flap, top-left at (x, y). Box 6 × 5. */
export function bagPiece(x: number, y: number, d: D): GearPiece {
  return piece(
    6,
    5,
    0,
    0,
    0,
    d,
    (c) => {
      const canvas = c.material({ ramp: PAL_HD_OZ_R2.fieldGrey, lo: 2, hi: 5, spec: 0.05, shine: 8, wrap: 0.2, amb: 0.12 });
      c.blob([[0.8, 0.8], [5.2, 0.8], [5.4, 4.2], [0.6, 4.2]], 0.8, { mat: canvas, z: 0, bulge: 0.3, tex: grime(23, 0.5, 2) });
      c.blob([[0.6, 0.6], [5.4, 0.6], [5.0, 2.4], [1.0, 2.4]], 0.5, { mat: canvas, z: 0.8, bulge: 0.2, tone: 0.15 });
    },
    SPRITE_RO,
    x,
    y,
  );
}

// =============================================================================================
// The crawler's stump (in front of its hips): torn trouser rags and the bone ends
// =============================================================================================

/** The stump at the pelvis (px, py), the body lying along `deg` (the torso's direction). Box 12 × 12. */
export function stumpPiece(px: number, py: number, deg: number, d: D, k: number): GearPiece {
  return piece(
    12,
    12,
    6,
    6,
    deg,
    d,
    (c, T, TP) => {
      const wool = c.material({ ramp: FG, lo: 1, hi: 4, spec: 0.05, shine: 8, wrap: 0.2, amb: 0.1 });
      const bone = c.material({ ramp: ROT, lo: 4, hi: 7, spec: 0.5, shine: 20, amb: 0.2 });
      const rot = c.material({ ramp: ROT, lo: 1, hi: 4, spec: 0.3, shine: 16, amb: 0.1 });
      // The rags (torn trouser tops) trail behind the hips (toward −x: the torso lies along +x).
      for (let i = 0; i < 4; i++) {
        const sway = Math.sin((k + i) * 1.3) * 0.5;
        const y0 = -1.8 + i * 1.2;
        c.blob(TP([[0.6, y0 - 0.5], [-1.6 - i * 0.4, y0 - 0.3 + sway], [-3.6 - (i % 2) * 0.8, y0 + 0.2 + sway], [-1.4, y0 + 0.9], [0.6, y0 + 0.6]]), 0.35, { mat: wool, z: 1 + i * 0.05, bulge: 0.1, tone: (i % 2) * -0.15 });
      }
      // The femur ends and a scrap of rotting flesh.
      c.capsule(...T(-0.6, -1.0), ...T(-3.0, -1.5), 0.5, 0.42, { mat: bone, z: 1.6 });
      c.ellipsoid(...T(-3.2, -1.5), 0.62, 0.55, { mat: bone, z: 1.8 });
      c.capsule(...T(-0.4, 1.2), ...T(-2.2, 1.5), 0.45, 0.4, { mat: bone, z: 1.5, tone: -0.15 });
      c.ellipsoid(...T(-0.2, 0), 1.0, 1.4, { mat: rot, z: 1.2 });
    },
    SPRITE_RO,
    px,
    py,
  );
}

// =============================================================================================
// The collapse: the bone pile (at the feet, in front)
// =============================================================================================

/** The bone pile in the box (−12 … 12, −9 … 1) around the anchor; `t` 0..1 how much has fallen. */
export function pilePiece(t: number, d: D, seed: number, wide = 1): GearPiece {
  const W = 26 * wide;
  return piece(
    W,
    11,
    W / 2,
    10,
    0,
    d,
    (c, T, TP) => {
      const bone = c.material({ ramp: ROT, lo: 4, hi: 7, spec: 0.5, shine: 22, amb: 0.2, wrap: 0.2 });
      const dust = c.material({ ramp: SOOT, lo: 1, hi: 5, spec: 0.05, shine: 8, amb: 0.15, wrap: 0.3 });
      const wool = c.material({ ramp: FG, lo: 1, hi: 4, spec: 0.05, shine: 8, wrap: 0.2, amb: 0.1 });
      const cavity = c.material({ ramp: ROT, lo: 0, hi: 1, spec: 0, amb: 0.02 });
      const leather = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.5, shine: 16, amb: 0.08 });
      const k = Math.min(1, Math.max(0.15, t));
      // The dust mound.
      const mw = (5 + 6 * k) * wide;
      const mh = 1.2 + 2.2 * k;
      c.blob(TP([[-mw, 0.6], [-mw * 0.5, -mh * 0.8], [0, -mh], [mw * 0.6, -mh * 0.7], [mw, 0.6]]), 1.2, { mat: dust, z: 0, bulge: 0.3, tex: grime(seed, 0.5, 1.5) });
      if (t < 0.3) return;
      // Rags of the uniform.
      c.blob(TP([[-6 * k, -0.6], [-1.5, -1.6 * k], [2.4 * k, -1.0], [1.0, 0.4], [-5 * k, 0.4]]), 0.4, { mat: wool, z: 0.8, bulge: 0.1 });
      // The long bones, the ribs, the skull (bigger t: everything is down).
      c.capsule(...T(-7.5 * k, -0.7), ...T(-1.0, -1.6 * k), 0.42, 0.36, { mat: bone, z: 1.6 });
      c.ellipsoid(...T(-7.8 * k, -0.6), 0.6, 0.52, { mat: bone, z: 1.7 });
      c.capsule(...T(1.0, -0.6), ...T(6.4 * k, -1.2), 0.38, 0.34, { mat: bone, z: 1.5 });
      for (let i = 0; i < 4; i++) {
        const x0 = -2.6 + i * 1.3;
        c.stroke(TP([[x0, -0.4], [x0 + 0.5, -1.6 - 0.8 * k], [x0 + 1.3, -2.0 - 0.6 * k]]), 0.22, 0.18, { mat: bone, z: 1.3 + i * 0.02 });
      }
      if (t >= 0.6) {
        // The skull, on its side, the jaw apart.
        const sx = 5.2 * wide;
        c.ellipsoid(...T(sx, -2.2), 2.1, 1.8, { mat: bone, z: 2.2 });
        c.ellipsoid(...T(sx + 1.0, -2.3), 0.62, 0.55, { mat: cavity, z: 3.6, round: 0.3 });
        c.poly(TP([[sx + 1.8, -1.6], [sx + 2.3, -1.1], [sx + 1.7, -0.9]]), { mat: cavity, z: 3.6 });
        c.capsule(...T(sx - 0.4, -0.3), ...T(sx + 2.2, -0.2), 0.36, 0.3, { mat: bone, z: 2.0, tone: -0.15 });
        // A boot lies tipped over at the other end.
        c.blob(TP([[-10.6 * wide, 0.4], [-10.4 * wide, -3.6], [-8.6 * wide, -3.6], [-8.6 * wide, -1.2], [-6.6 * wide, -0.9], [-6.6 * wide, 0.4]]), 0.6, { mat: leather, z: 1.4, bulge: 0.2 });
      }
    },
    SPRITE_RO,
    0,
    0,
  );
}

// =============================================================================================
// The MG (run-time overlay at the near hand)
// =============================================================================================

/** The MG's angles (deg, clockwise = muzzle down) in its strips. */
export const GUN_ANGLES: readonly number[] = [-16, -12, -8, -5, -2, 0, 2, 5, 8, 12, 16, 22, 30, 40];
export function gunAngleIndex(deg: number): number {
  let best = 0;
  for (let i = 1; i < GUN_ANGLES.length; i++) if (Math.abs(GUN_ANGLES[i] - deg) < Math.abs(GUN_ANGLES[best] - deg)) best = i;
  return best;
}
/** The muzzle (gun coords, facing right; 0,0 = the near hand on the grip): whole, and with the barrel jacket shot off. */
export const MG_MUZZLE: Readonly<Record<'whole' | 'broken', P2>> = { whole: [17.6, -1.5], broken: [9.4, -1.5] };
/** Planted: the bipod's feet are this far below the grip (the floor). */
export const MG_FLOOR = 16;
const GW = 46;
const GH = 40;
const GX = 18;
const GY = 18;

/** The MG drawn on its full canvas (cropped by `mgFrame`). */
function mgPiece(deg: number, planted: boolean, broken: boolean, d: D): GearPiece {
  return piece(
    GW,
    GH,
    GX,
    GY,
    deg,
    d,
    (c, T, TP) => {
      const metal = c.material({ ramp: PAL_HD.black, lo: 1, hi: 5, spec: 0.7, shine: 22, amb: 0.1, rim: 0.15 });
      const rust = c.material({ ramp: RUST, lo: 1, hi: 4, spec: 0.2, shine: 10, amb: 0.08 });
      const wood = c.material({ ramp: PAL_HD.brown, lo: 0, hi: 3, spec: 0.3, shine: 12, amb: 0.08 });
      const hole = c.material({ ramp: PAL_HD.ink, lo: 0, hi: 1, spec: 0, amb: 0 });
      const brass = c.material({ ramp: PAL_HD.gold, lo: 2, hi: 6, spec: 0.9, shine: 26, amb: 0.15 });
      const pitted: Texture = (s) => {
        if (vnoise(s.x * 1.8, s.y * 1.8, 61) > 0.74) s.mat = rust;
      };
      // The butt stock (dark, worn).
      c.blob(TP([[-12.6, -2.6], [-4.4, -2.0], [-4.4, 0.5], [-11.2, 1.6], [-12.8, 1.3]]), 0.6, { mat: wood, z: 1, bulge: 0.2, tex: grime(71, 0.4, 2) });
      // The receiver with its feed cover, the pistol grip, the trigger guard.
      c.blob(TP([[-4.8, -2.8], [4.8, -2.8], [4.8, 0.4], [-4.8, 0.6]]), 0.45, { mat: metal, z: 1.3, bulge: 0.15, tex: pitted });
      c.blob(TP([[-3.8, -3.7], [1.6, -3.6], [2.0, -2.7], [-3.8, -2.7]]), 0.3, { mat: metal, z: 1.6, bulge: 0.1, tone: 0.15 });
      c.capsule(...T(-0.6, 0.3), ...T(-1.9, 3.8), 0.75, 0.65, { mat: wood, z: 1.2 });
      c.stroke(TP([[0.6, 0.4], [1.0, 1.8], [-0.2, 2.2]]), 0.18, 0.18, { mat: metal, z: 1.25 });
      // The barrel jacket with its cooling slots, the muzzle booster (or the torn stub).
      const end = broken ? 8.9 : 15.2;
      c.blob(TP([[4.6, -2.5], [end, -2.4], [end, -0.6], [4.6, -0.5]]), 0.4, { mat: metal, z: 1.4, bulge: 0.12, tex: pitted });
      for (let x = 5.6; x < end - 0.8; x += 1.6) c.ellipsoid(...T(x + 0.5, -1.5), 0.55, 0.36, { mat: hole, z: 2.4, round: 0 });
      if (broken) {
        // The jagged end of a jacket shot to pieces, a bent stub of the barrel.
        c.poly(TP([[end - 0.3, -2.5], [end + 0.7, -2.0], [end + 0.2, -1.5], [end + 0.9, -1.0], [end - 0.2, -0.5]]), { mat: rust, z: 1.5 });
        c.capsule(...T(end, -1.5), ...T(end + 0.6, -1.2), 0.3, 0.26, { mat: metal, z: 1.6, tone: -0.2 });
      } else c.blob(TP([[15.0, -2.2], [17.6, -2.4], [17.8, -0.6], [15.0, -0.8]]), 0.3, { mat: metal, z: 1.5, bulge: 0.1, tone: 0.1 });
      // The bipod: folded under the jacket, or its two legs down to the floor (the floor stays level).
      const mount = broken ? 7.6 : 12.4;
      const [mx, my] = T(mount, -0.6);
      if (planted) {
        const fy = GY + MG_FLOOR;
        c.capsule(mx, my, mx + 1.8, fy - 0.3, 0.3, 0.32, { mat: metal, z: 2.0 });
        c.capsule(mx, my, mx - 1.2, fy - 0.3, 0.28, 0.3, { mat: metal, z: 0.6, tone: -0.25 });
        c.ellipsoid(mx + 1.9, fy - 0.3, 0.6, 0.3, { mat: metal, z: 2.1 });
      } else c.stroke(TP([[mount, -0.4], [mount - 4.6, 0.3]]), 0.28, 0.28, { mat: metal, z: 1.7 });
      // The ammo belt hanging from the feed tray (a curve of brass rounds).
      const belt: P2[] = planted
        ? [[-1.2, -2.0], [-2.0, 1.5], [-2.6, 5.2], [-1.6, 9.0], [0.6, 12.4]]
        : [[-1.2, -2.0], [-2.4, 1.2], [-2.6, 4.0], [-1.4, 6.0], [0.6, 7.0]];
      for (let i = 0; i < belt.length - 1; i++) {
        const [ax, ay] = belt[i];
        const [bx, by] = belt[i + 1];
        for (let q = 0; q < 3; q++) {
          const f = q / 3;
          const x = ax + (bx - ax) * f;
          const y = ay + (by - ay) * f;
          c.capsule(...T(x - 0.55, y), ...T(x + 0.55, y), 0.28, 0.22, { mat: brass, z: 0.8 + i * 0.01 });
        }
      }
    },
    SPRITE_RO,
    0,
    0,
  );
}

/**
 * Crop a frame drawn on a big canvas to its 1× twin's opaque box (+1 px margin) at every density,
 * so all densities keep the same logical box and anchor (geometry is law) and no empty canvas is kept.
 */
export function cropTo1x(pd: GearPiece, p1: GearPiece, ax: number, ay: number): Frame {
  const b = p1.buf.trimBounds();
  const d = pd.density;
  if (!b) return { buf: pd.buf.crop(0, 0, d, d), ox: ax, oy: ay, ...(d > 1 ? { density: d } : {}) };
  const x0 = Math.max(0, b.x - 1);
  const y0 = Math.max(0, b.y - 1);
  const x1 = Math.min(p1.buf.w, b.x + b.w + 1);
  const y1 = Math.min(p1.buf.h, b.y + b.h + 1);
  return { buf: pd.buf.crop(x0 * d, y0 * d, (x1 - x0) * d, (y1 - y0) * d), ox: ax - x0, oy: ay - y0, ...(d > 1 ? { density: d } : {}) };
}

/** One MG frame: carried (legs folded) or planted (the bipod down to the floor), whole or broken. */
function mgFrame(deg: number, planted: boolean, broken: boolean, d: D): Frame {
  const p1 = mgPiece(deg, planted, broken, 1);
  return cropTo1x(d === 1 ? p1 : mgPiece(deg, planted, broken, d), p1, GX, GY);
}

/** MG strips: `enemy/oz-mg/gun-carry` / `gun-plant`, frames = GUN_ANGLES whole, then GUN_ANGLES broken. */
export const MG_GUN = { carry: 'enemy/oz-mg/gun-carry', plant: 'enemy/oz-mg/gun-plant' } as const;
export function mgGunFrame(angleIdx: number, broken: boolean): number {
  return angleIdx + (broken ? GUN_ANGLES.length : 0);
}

// =============================================================================================
// Effects
// =============================================================================================

export type RiseLook = 'pavers' | 'earth' | 'stone' | 'manhole';
export const RISE_LOOKS: readonly RiseLook[] = ['pavers', 'earth', 'stone', 'manhole'];
export const riseId = (l: RiseLook): string => `fx/oz/zombie/rise-${l}`;
/** Rise strip frames: 0–2 the tell (cracks spread / the cover rattles), 3 it breaks open, 4 open (held). */
export const RISE_FRAMES = 5;

function riseFrame(look: RiseLook, k: number, d: D): Frame {
  const W = 30;
  const H = 12;
  const p = piece(
    W,
    H,
    W / 2,
    6,
    0,
    d,
    (c, T, TP) => {
      const ramp = look === 'pavers' ? PAL_HD.rust : look === 'earth' ? PAL_HD.brown : look === 'stone' ? PAL_HD.stone : PAL_HD.black;
      const surf = c.material({ ramp, lo: 1, hi: 4, spec: look === 'manhole' ? 0.6 : 0.1, shine: 12, amb: 0.12 });
      const dark = c.material({ ramp: PAL_HD.ink, lo: 0, hi: 1, spec: 0, amb: 0 });
      const crack = c.material({ ramp: SOOT, lo: 0, hi: 1, spec: 0, amb: 0.02 });
      if (look === 'manhole') {
        // The drain cover: closed (rattling), lifted, slid aside off the dark hole.
        if (k >= 3) c.ellipsoid(0 + W / 2, 6.3, 6.2, 1.5, { mat: dark, z: 0, round: 0 });
        const off = k <= 2 ? 0 : k === 3 ? 4 : 9;
        const lift = k === 2 ? -0.8 : k === 3 ? -1.4 : 0;
        const cx = W / 2 + off;
        c.ellipsoid(cx, 6 + lift, 6.4, 1.3, { mat: surf, z: 1, round: 0.5, tex: (s) => { if (Math.floor((s.x - cx) * 1.2) % 2 === 0) s.tone -= 0.15; } });
        c.box(cx - 6.4, 6 + lift, 12.8, 1.2, { mat: surf, z: 0.8, bevel: 0.3, tone: -0.3 });
        return;
      }
      // Cracks spreading from the spot; then the floor heaves and breaks open over a dark hole.
      const n = k === 0 ? 3 : k === 1 ? 5 : 7;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI + (i + 0.5) * (Math.PI / n);
        const len = (k === 0 ? 3.5 : k === 1 ? 6 : 8.5) * (0.7 + hash2(i, 3, 17) * 0.5);
        const mid = 0.5 + (hash2(i, 5, 17) - 0.5) * 0.5;
        c.stroke(TP([[0, 0.6], [Math.cos(a) * len * mid + 0.8, 0.6 + Math.sin(a) * 0.8 * mid], [Math.cos(a) * len, 0.6 + Math.sin(a) * 1.1]]), 0.18, 0.12, { mat: crack, z: 1 });
      }
      if (k >= 2) {
        // Lifted chunks of the floor.
        const lift = k === 2 ? 0.6 : 1.4;
        for (let i = 0; i < 4; i++) {
          const x = -5.5 + i * 3.6 + (hash2(i, 9, 17) - 0.5);
          const tilt = (i - 1.5) * 0.35;
          c.blob(TP([[x - 1.4, -lift - tilt], [x + 1.4, -lift + tilt], [x + 1.4, 0.8 + tilt], [x - 1.4, 0.8 - tilt]]), 0.35, { mat: surf, z: 1.5 + i * 0.02, bulge: 0.1 });
        }
      }
      if (k >= 3) {
        c.ellipsoid(W / 2, 6.8, 5.6, 1.6, { mat: dark, z: 2.5, round: 0 });
        // Rubble at the edges.
        for (let i = 0; i < 6; i++) {
          const x = (i < 3 ? -8.5 : 5.0) + (i % 3) * 1.4 + hash2(i, 13, 17);
          c.ellipsoid(...T(x, 0.2 - hash2(i, 15, 17)), 0.7, 0.55, { mat: surf, z: 3 + i * 0.01, tone: (hash2(i, 19, 17) - 0.5) * 0.4 });
        }
      }
    },
    { outline: look === 'manhole' ? 'A' : 'B', ao: 0.25, rimLight: 1 },
    0,
    0,
  );
  return { buf: p.buf, ox: W / 2, oy: 6, ...(d > 1 ? { density: d } : {}) };
}

/** Chunks knocked off by hits (particle sprites): rot, cloth, a bone splinter, a clod of dust. */
export const CHUNK_ID = 'fx/oz/zombie/chunk';
export const CHUNK_FRAMES = 6;
function chunkFrame(k: number, d: D): Frame {
  const p = piece(
    4,
    4,
    2,
    2,
    k * 47,
    d,
    (c, T, TP) => {
      const ramp = k < 2 ? ROT : k < 4 ? FG : k === 4 ? ROT : SOOT;
      const m = c.material({ ramp, lo: k === 4 ? 4 : 1, hi: k === 4 ? 7 : 4, spec: 0.3, shine: 14, amb: 0.15 });
      if (k === 4) c.capsule(...T(-1.3, 0), ...T(1.3, 0.2), 0.42, 0.32, { mat: m, z: 1 });
      else c.blob(TP([[-1.2, -0.8], [0.9, -1.1], [1.3, 0.6], [-0.2, 1.2], [-1.3, 0.5]]), 0.4, { mat: m, z: 1, bulge: 0.2 });
    },
    { outline: 'B', ao: 0.1 },
    0,
    0,
  );
  return { buf: p.buf, ox: 2, oy: 2, ...(d > 1 ? { density: d } : {}) };
}

/** The slow tracer of the rifleman (`enemy/oz-zshot/rifle`, 2 frames) and the MG's (`…/mg`): centre anchor. */
export const SHOT_ID = { rifle: 'enemy/oz-zshot/rifle', mg: 'enemy/oz-zshot/mg' } as const;
function shotFrame(kind: 'rifle' | 'mg', k: number, d: D): Frame {
  const W = kind === 'rifle' ? 14 : 10;
  const H = 5;
  const c = new HdCanvas(W, H, d);
  const len = kind === 'rifle' ? 11 : 8;
  const core: Color = PAL_HD.gold[7];
  const hot: Color = PAL_HD.gold[5];
  const tail: Color = PAL_HD.rust[5];
  const tail2: Color = PAL_HD.rust[3];
  const r = kind === 'rifle' ? 1.1 : 0.85;
  c.paint(0, 0, W, H, (x, y) => {
    const t = (x - (W - len - 0.5)) / len; // 0 tail → 1 head
    if (t < 0 || t > 1) return 0;
    const half = r * (0.35 + 0.65 * t) * (k === 1 ? 0.92 : 1);
    const q = Math.abs(y - H / 2) / half;
    if (q > 1) return 0;
    if (t > 0.78) return q < 0.55 ? core : hot;
    if (t > 0.45) return q < 0.4 ? hot : tail;
    return q < 0.5 ? tail : tail2;
  });
  const buf = c.render({ outline: 'none', ao: 0, clean: false, sep: false });
  if (d === 1) snapPal(buf, false);
  return { buf, ox: W / 2, oy: Math.floor(H / 2), ...(d > 1 ? { density: d } : {}) };
}

/** The dull eye glow (additive, centre anchor): 2 frames (steady, flare). */
export const EYE_ID = 'fx/oz/zombie/eye';
function eyeFrame(k: number, d: D): Frame {
  const buf = new PixelBuffer(7 * d, 7 * d);
  if (d === 1) {
    // 1×: opaque palette px (a dot; the flare a small cross).
    buf.set(3, 3, PAL.sand[3]);
    if (k === 1) for (const [x, y] of [[2, 3], [4, 3], [3, 2], [3, 4]] as const) buf.set(x, y, PAL.olive[3]);
    return { buf, ox: 3, oy: 3 };
  }
  const col: Color = PAL_HD.olive[6];
  const hot: Color = PAL_HD.olive[7];
  const R = k === 1 ? 3.2 : 2.4;
  for (let Y = 0; Y < buf.h; Y++) {
    for (let X = 0; X < buf.w; X++) {
      const q = Math.hypot((X + 0.5) / d - 3.5, (Y + 0.5) / d - 3.5) / R;
      if (q > 1) continue;
      const a = Math.round(255 * (1 - q) * (1 - q) * (k === 1 ? 0.9 : 0.6));
      if (a < 10) continue;
      buf.set(X, Y, (((q < 0.3 ? hot : col) & 0xffffff00) | a) >>> 0);
    }
  }
  return { buf, ox: 3, oy: 3, ...(d > 1 ? { density: d } : {}) };
}

/** The bone dust of the collapse (particles): the default `fx/dust` is used; this is the cloud strip (`fx/oz/zombie/dust`, 5 frames). */
export const DUST_ID = 'fx/oz/zombie/dust';
function dustFrame(k: number, d: D): Frame {
  const W = 26;
  const H = 18;
  const p = piece(
    W,
    H,
    W / 2,
    H - 1,
    0,
    d,
    (c) => {
      const m = c.material({ ramp: SOOT, lo: 2, hi: 5, spec: 0, amb: 0.3, wrap: 0.5, dither: true });
      const grow = 0.55 + k * 0.18;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const x = W / 2 + (i - (n - 1) / 2) * 3.2 * grow + (hash2(i, k, 29) - 0.5) * 2;
        const y = H - 3 - (i % 3) * 2.2 * grow - k * 1.2;
        const r = (2.2 + hash2(i, 7, 29) * 1.6) * grow;
        c.ellipsoid(x, y, r, r * 0.8, { mat: m, z: i * 0.1, round: 0.8 });
      }
    },
    { outline: 'none', ao: 0.1 },
    0,
    0,
  );
  return { buf: p.buf, ox: W / 2, oy: H - 1, ...(d > 1 ? { density: d } : {}) };
}

/** Register the gear strips and the effects. */
export function defineGearArt(): void {
  defHi(MG_GUN.carry, (d) => [false, true].flatMap((b) => GUN_ANGLES.map((a) => mgFrame(a, false, b, d))), { ticksPerFrame: 9999, loop: false });
  defHi(MG_GUN.plant, (d) => [false, true].flatMap((b) => GUN_ANGLES.map((a) => mgFrame(a, true, b, d))), { ticksPerFrame: 9999, loop: false });
  for (const l of RISE_LOOKS) defHi(riseId(l), (d) => Array.from({ length: RISE_FRAMES }, (_, k) => riseFrame(l, k, d)), { ticksPerFrame: 9999, loop: false });
  defHi(CHUNK_ID, (d) => Array.from({ length: CHUNK_FRAMES }, (_, k) => chunkFrame(k, d)), { ticksPerFrame: 9999 });
  defHi(SHOT_ID.rifle, (d) => [0, 1].map((k) => shotFrame('rifle', k, d)), { ticksPerFrame: 3 });
  defHi(SHOT_ID.mg, (d) => [0, 1].map((k) => shotFrame('mg', k, d)), { ticksPerFrame: 3 });
  defHi(EYE_ID, (d) => [0, 1].map((k) => eyeFrame(k, d)), { ticksPerFrame: 9999 });
  defHi(DUST_ID, (d) => [0, 1, 2, 3, 4].map((k) => dustFrame(k, d)), { ticksPerFrame: 5, loop: false, defer: true });
}
