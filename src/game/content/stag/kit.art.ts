/**
 * Shared art kit of the stag party and the beer bike (docs/design/ams-extras.md §2): ONE
 * density-generic drawer per part for 1×, 2× and 4×. Every drawer paints an `HdCanvas` at density
 * d with the ramps of that density (`rampOf`: `PAL` at 1×, `PAL_HD` at 2× and 4×), so the 1× art
 * keeps the 64-colour palette and the dense art is drawn natively (docs/ART_GUIDE.md "UHD art"):
 * the same shapes at the same logical places, outline A for everything that moves or can be hit.
 *
 * - `bottleBuf(deg, state, grip, d)`: the fizzy-wine bottle (green glass, cream label with a red
 *   band, gold foil, the cork), along `deg` (0 = neck forward, −90 = neck up), held at the body
 *   (`grip` 'body') or by the neck ('neck'); states `corked`, `leak` (foam round the cork while it
 *   is shaken), `spurt` (the cork is out: a foam jet), `open` (a little foam at the mouth).
 * - `phoneBuf(d)`, `flashFrames(d)` (the selfie flash), `corkFrames(d)` (a tumbling cork),
 *   `veilBuf` / `veilFrames` (the groom's veil, flying off), `tiaraBuf`, `tutuBuf`, `lplateBuf`,
 *   `printBuf` (the party T-shirt print), `shirtBundleBuf` (the T-shirt pulled over the head).
 * - `partyFigure(look, pose, d)`: the rig with SHORTS: the figure is rendered twice (trousers in
 *   the shorts colour, then in the skin colour) and every px farther than `SHORTS_R` from the hip
 *   comes from the bare-leg render (same pose, same geometry: only the trouser colour differs).
 * - `moveAnchor(f, hipY)`: re-anchor a seated figure so its hip sits `hipY` px above the anchor.
 * Every piece has a fixed logical box at every density, so the frames keep their 1× geometry.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { HdCanvas, type HdMaterial } from '../../art/hd';
import { withPieces, type Piece } from '../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../art/humanoid';
import { R } from '../../art/paint';

export type Dn = Density;

/** 1× stand-ins for the HD-only material ramps. */
const ONE: Readonly<Record<string, string>> = { wood: 'brown', glass: 'sky', denim: 'navy', brick: 'red', plaster: 'sand', gable: 'snow', moss: 'green', brickDark: 'brown', canal: 'teal' };

/** The ramp of a material at density d: `PAL` at 1×, `PAL_HD` at 2× / 4×. */
export function rampOf(name: string, d: number): Ramp {
  if (d === 1) return R(ONE[name] ?? name);
  return (PAL_HD as unknown as Record<string, Ramp>)[name] ?? R(name);
}

/**
 * A lit material on the ramp `name` at density d. 1×: all four tones of the short PAL ramp
 * (`lo1`..`hi1`); 2× / 4×: the HD bands `lo`..`hi` (default 1..n − 2).
 */
export function mat(c: HdCanvas, name: string, o: Partial<HdMaterial> & { lo1?: number; hi1?: number } = {}): number {
  const ramp = rampOf(name, c.d);
  const n = ramp.length;
  const { lo1, hi1, ...m } = o;
  if (c.d === 1) return c.material({ ...m, ramp, lo: Math.max(0, Math.min(n - 1, lo1 ?? 0)), hi: Math.max(0, Math.min(n - 1, hi1 ?? n - 1)) });
  return c.material({ wrap: 0.05, ...m, ramp, lo: Math.max(0, Math.min(n - 1, m.lo ?? 1)), hi: Math.max(0, Math.min(n - 1, m.hi ?? n - 2)) });
}

/** Tone i of a ramp counted from the top (0 = the lightest) at density d. */
export function top(name: string, d: number, i = 0): Color {
  const r = rampOf(name, d);
  return r[Math.max(0, r.length - 1 - i)];
}

/** Tone i of a ramp counted from the bottom (0 = the darkest) at density d. */
export function bot(name: string, d: number, i = 0): Color {
  const r = rampOf(name, d);
  return r[Math.min(r.length - 1, i)];
}

/** Render a sprite canvas: outline A (moves or can be hit), a cool rim at 2× / 4×. */
export function finishA(c: HdCanvas, ao = 0.3): PixelBuffer {
  return c.render({ outline: 'A', ink: INK, ao, rimLight: c.d === 1 ? 0 : 2 });
}

const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------ bottle

/** The bottle piece box (logical px) and its grip point inside the box. */
export const BOTTLE_BOX = 26;
export const BOTTLE_G = 13;
export type BottleState = 'corked' | 'leak' | 'spurt' | 'open';

/**
 * The fizzy-wine bottle along `deg` (0 = the neck points forward, −90 = up, 90 = down) in a
 * 26 × 26 box with the grip at (13, 13): held round the body (`grip` 'body') or by the neck.
 */
export function bottleBuf(deg: number, state: BottleState, grip: 'body' | 'neck', d: Dn): PixelBuffer {
  const c = new HdCanvas(BOTTLE_BOX, BOTTLE_BOX, d);
  const ux = Math.cos(deg * DEG);
  const uy = Math.sin(deg * DEG);
  // Along-axis offset of the grip: the body's middle, or high on the neck.
  const g0 = grip === 'neck' ? 3.2 : -0.5;
  const P = (s: number, t = 0): [number, number] => [BOTTLE_G + (s - g0) * ux - t * uy, BOTTLE_G + (s - g0) * uy + t * ux];
  const glass = mat(c, 'green', { spec: 1.1, shine: 40, lo1: 0, hi1: 3, lo: 1, hi: 4 });
  const label = mat(c, 'snow', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const band = mat(c, 'red', { spec: 0.3, lo1: 1, hi1: 3 });
  const foil = mat(c, 'gold', { spec: 1, shine: 30, lo1: 1, hi1: 3 });
  const cork = mat(c, 'sand', { spec: 0.15, lo1: 0, hi1: 2 });
  const foam = mat(c, 'snow', { spec: 0.1, lo1: 2, hi1: 3, lo: 4, hi: 7, wrap: 0.3 });
  const glassPart = c.newPart();
  const axial = (x: number, y: number): number => (x - BOTTLE_G) * ux + (y - BOTTLE_G) * uy + g0;
  // Body (base to shoulder), shoulder taper, neck.
  const [b0x, b0y] = P(-2.7);
  const [b1x, b1y] = P(1.0);
  c.capsule(b0x, b0y, b1x, b1y, 1.2, 1.2, {
    mat: glass,
    z: 1,
    part: glassPart,
    tex: (t) => {
      const s = axial(t.x, t.y);
      if (s > -2.0 && s < -0.2) t.mat = label;
      if (s > -1.2 && s < -0.75) t.mat = band;
    },
  });
  const [s1x, s1y] = P(2.3);
  c.capsule(b1x, b1y, s1x, s1y, 1.2, 0.62, { mat: glass, z: 1, part: glassPart });
  const [n1x, n1y] = P(4.0);
  c.capsule(s1x, s1y, n1x, n1y, 0.62, 0.6, { mat: foil, z: 1.2 });
  if (state === 'corked' || state === 'leak') {
    const [k1x, k1y] = P(4.9);
    c.capsule(n1x, n1y, k1x, k1y, 0.72, 0.7, { mat: cork, z: 1.4 });
  }
  // Foam: round bubbles in front of the mouth (a jet for the pop, a few for the leak).
  const bubble = (s: number, t: number, r: number, z = 2): void => {
    const [x, y] = P(s, t);
    c.ellipsoid(x, y, r, r, { mat: foam, z });
  };
  if (state === 'leak') {
    bubble(4.5, 0.95, 0.7);
    bubble(4.1, -0.9, 0.62);
    bubble(5.3, 0.2, 0.58);
  } else if (state === 'spurt') {
    for (let i = 0; i < 6; i++) {
      const s = 4.8 + i * 1.25;
      const r = 0.75 + i * 0.22;
      bubble(s, (i % 2 === 0 ? 0.4 : -0.4) * (i * 0.35), r, 2 + i * 0.1);
    }
  } else if (state === 'open') {
    bubble(4.4, 0.4, 0.66);
  }
  return finishA(c, 0.25);
}

/** A bottle piece held at the frame's `hand` point (the wrist): the grip 1.5 px along `deg`. */
export function bottlePiece(f: Frame, deg: number, state: BottleState, grip: 'body' | 'neck', d: Dn, behind = false): Piece | null {
  const h = f.pts?.hand;
  if (!h) return null;
  const gx = Math.round(h[0] + Math.cos(deg * DEG) * (grip === 'neck' ? 0.5 : 1.5));
  const gy = Math.round(h[1] + Math.sin(deg * DEG) * (grip === 'neck' ? 0.5 : 1.5));
  const p: Piece = { buf: bottleBuf(deg, state, grip, d), x: gx - BOTTLE_G, y: gy - BOTTLE_G, behind };
  if (d !== 1) p.density = d;
  return p;
}

// ------------------------------------------------------------------------------------ phone, flash, cork

/** The phone seen from the back (camera lens, a pink case), 5 × 7 box, held at (2, 4). */
export function phoneBuf(d: Dn): PixelBuffer {
  const c = new HdCanvas(5, 7, d);
  const cs = mat(c, 'pink', { spec: 0.5, shine: 20, lo1: 0, hi1: 2 });
  c.box(1, 1, 3, 5, { mat: cs, z: 0, r: 0.5, bevel: 0.4 });
  c.paint(1.5, 1.6, 1.2, 1.2, (x, y) => (Math.hypot(x - 2.1, y - 2.2) < (d === 1 ? 0.6 : 0.5) ? bot('ink', d, 0) : 0));
  if (d > 1) c.dot(2.2, 1.9, top('snow', d));
  return finishA(c, 0.2);
}

/** The selfie flash: a white star that blooms and fades (3 frames, centre anchor). */
export function flashFrames(d: Dn): Frame[] {
  return [0, 1, 2].map((i) => {
    const c = new HdCanvas(11, 11, d);
    const r = [2.2, 4.4, 3.2][i];
    const core = i === 2 ? top('gold', d, 1) : top('snow', d);
    const ray = i === 2 ? top('gold', d, 2) : top('gold', d, 0);
    c.paint(0, 0, 11, 11, (x, y) => {
      const dx = Math.abs(x - 5.5);
      const dy = Math.abs(y - 5.5);
      if (dx * dx + dy * dy < r * r * 0.18) return core;
      if ((dx < 0.6 && dy < r) || (dy < 0.6 && dx < r)) return ray;
      if (i === 1 && Math.abs(dx - dy) < 0.5 && dx < r * 0.62) return ray;
      return 0;
    });
    const buf = c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false });
    return d === 1 ? { buf, ox: 5, oy: 5 } : { buf, ox: 5, oy: 5, density: d };
  });
}

/** A champagne cork tumbling end over end (4 frames, centre anchor, mirror-safe). */
export function corkFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const c = new HdCanvas(9, 9, d);
    const ck = mat(c, 'sand', { spec: 0.25, shine: 12, lo1: 0, hi1: 3, lo: 2, hi: 5 });
    const cap = mat(c, 'gold', { spec: 1, shine: 30, lo1: 1, hi1: 3 });
    const a = (i * 45 - 90) * DEG;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    // The mushroom head (wide) and the stem (narrow), along the tumble angle.
    c.capsule(4.5 - ux * 1.6, 4.5 - uy * 1.6, 4.5 + ux * 0.3, 4.5 + uy * 0.3, 1.0, 1.05, { mat: ck, z: 1 });
    c.capsule(4.5 + ux * 0.3, 4.5 + uy * 0.3, 4.5 + ux * 1.7, 4.5 + uy * 1.7, 1.75, 1.6, { mat: ck, z: 1.2 });
    c.ellipsoid(4.5 + ux * 2.1, 4.5 + uy * 2.1, 0.75, 0.75, { mat: cap, z: 1.5 });
    const buf = finishA(c, 0.2);
    return d === 1 ? { buf, ox: 4, oy: 4 } : { buf, ox: 4, oy: 4, density: d };
  });
}

// ------------------------------------------------------------------------------------ groom pieces

/** The veil: white tulle from the crown down the back (a 14 × 18 box, drawn behind the figure). */
export function veilBuf(d: Dn, flutter = 0): PixelBuffer {
  const c = new HdCanvas(14, 18, d);
  const tulle = mat(c, 'snow', { spec: 0.15, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.35 });
  const sway = flutter * 0.8;
  c.blob([[9.5, 1.5], [12.5, 2.5], [11, 6.5], [8.5 - sway, 11], [6 - sway, 16.2], [1.5 - sway, 16.5], [2, 10], [5, 4]], 0.9, {
    mat: tulle,
    z: 0,
    bulge: 0.25,
    tex: (t) => {
      // Soft vertical folds in the tulle.
      t.tone += Math.sin((t.x + t.y * 0.25) * 2.4) * 0.12;
    },
  });
  return finishA(c, 0.15);
}

/** The flying veil (off on the groom's death): 4 frames, a crumpled sheet turning over. */
export function veilFrames(d: Dn): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const c = new HdCanvas(14, 12, d);
    const tulle = mat(c, 'snow', { spec: 0.15, lo1: 1, hi1: 3, lo: 3, hi: 6, wrap: 0.35 });
    const a = i * 0.8;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * Math.PI * 2 + a;
      const r = (k % 2 === 0 ? 5.4 : 3.6) * (i % 2 === 0 ? 1 : 0.85);
      pts.push([7 + Math.cos(ang) * r, 6 + Math.sin(ang) * r * 0.7]);
    }
    c.blob(pts, 0.8, { mat: tulle, z: 0, bulge: 0.3 });
    const buf = finishA(c, 0.15);
    return d === 1 ? { buf, ox: 7, oy: 6 } : { buf, ox: 7, oy: 6, density: d };
  });
}

/** A small sparkly tiara band on the crown (6 × 3 box). */
export function tiaraBuf(d: Dn): PixelBuffer {
  const c = new HdCanvas(6, 3, d);
  const silver = mat(c, 'steel', { spec: 1.2, shine: 40, lo1: 2, hi1: 4 });
  c.capsule(1, 2, 5, 2, 0.5, 0.5, { mat: silver, z: 1 });
  c.ellipsoid(3, 1.3, 0.75, 0.75, { mat: silver, z: 1.2 });
  if (d > 1) c.dot(2.8, 1.0, top('pink', d, 0));
  return finishA(c, 0.1);
}

/** The pink tutu: three scalloped tiers flaring from the waist (18 × 9 box; the waist at (9, 2)). */
export function tutuBuf(d: Dn, k = 0): PixelBuffer {
  return tutuOn(new HdCanvas(18, 9, d), 0, k);
}

/**
 * The tutu in an 18 × 14 box with the waist at its centre (9, 7): rotate it about the waist with
 * `PixelBuffer.rotated` for a tumbling or lying figure.
 */
export function tutuWaistBuf(d: Dn, k = 0): PixelBuffer {
  return tutuOn(new HdCanvas(18, 14, d), 5, k);
}

function tutuOn(c: HdCanvas, oy: number, k: number): PixelBuffer {
  const tulle = mat(c, 'pink', { spec: 0.3, shine: 12, lo1: 0, hi1: 2, lo: 2, hi: 6, wrap: 0.2 });
  for (let tier = 0; tier < 2; tier++) {
    const y0 = oy + 1.4 + tier * 1.6;
    const half = 4.4 + tier * 1.9 + k * 0.3;
    const pts: Array<[number, number]> = [[9 - half * 0.72, y0], [9 + half * 0.72, y0]];
    // Scalloped hem: points dip between the frills.
    const n = 4 + tier;
    for (let i = n; i >= 0; i--) {
      const x = 9 - half + (2 * half * i) / n;
      pts.push([x, y0 + 2.0 + (i % 2 === 0 ? 0.6 : 0)]);
    }
    c.blob(pts, 0.6, { mat: tulle, z: 3 - tier, bulge: 0.35, tone: -tier * 0.1 });
  }
  return finishA(c, 0.25);
}

/** The L-plate on the chest: a white square with a red L (6 × 6 box). */
export function lplateBuf(d: Dn): PixelBuffer {
  const c = new HdCanvas(6, 6, d);
  const card = mat(c, 'snow', { spec: 0.2, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  c.box(1, 1, 4, 4, { mat: card, z: 0, r: 0.3, bevel: 0.25 });
  const red = top('red', d, d === 1 ? 1 : 2);
  c.paint(1.5, 1.5, 3, 3, (x, y) => ((x < 2.6 && y < 4.3) || (y > 3.4 && y < 4.3 && x < 4.2) ? red : 0));
  return finishA(c, 0.1);
}

/** The party T-shirt print: a small white star on the chest (5 × 5 box, no outline). */
export function printBuf(d: Dn): PixelBuffer {
  const c = new HdCanvas(5, 5, d);
  const w = top('snow', d, d === 1 ? 0 : 1);
  const p = top('pink', d, 1);
  c.paint(0, 0, 5, 5, (x, y) => {
    const dx = Math.abs(x - 2.5);
    const dy = Math.abs(y - 2.5);
    if (dx + dy < (d === 1 ? 1.1 : 0.9)) return p;
    if ((dx < 0.55 && dy < 2.1) || (dy < 0.55 && dx < 2.1)) return w;
    return d === 4 && Math.abs(dx - dy) < 0.3 && dx < 1.4 ? w : 0;
  });
  return c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false });
}

/** The T-shirt pulled over the head (cower): a lumpy bundle of the tee (12 × 11 box). */
export function shirtBundleBuf(tee: string, d: Dn, k = 0): PixelBuffer {
  const c = new HdCanvas(12, 11, d);
  const cloth = mat(c, tee, { spec: 0.2, lo1: 0, hi1: 3, wrap: 0.1 });
  c.blob([[2, 3.5 + k * 0.3], [5, 1.2], [8.5, 1.5], [10.5, 4], [10, 8.5], [7, 10], [3.5, 9.6], [1.6, 7]], 1.4, {
    mat: cloth,
    z: 0,
    bulge: 0.45,
    tex: (t) => {
      // A few creases where the collar is bunched.
      if (Math.abs(t.y - 5.5 - Math.sin(t.x * 1.3) * 0.8) < 0.22) t.tone -= 0.35;
    },
  });
  return finishA(c, 0.25);
}

// ------------------------------------------------------------------------------------ the figure

/** Shorts reach this far (logical px) from the hip point; farther px show the bare legs. */
export const SHORTS_R = 6.8;

/** A partier look: the rig style (its `pants` is ignored) and the shorts colour. */
export interface PartyLook {
  style: HumanStyle;
  shorts: string;
  /** The bare legs' ramp (the skin). */
  legs: string;
}

/**
 * The rig with shorts (see the file header). Both renders share the pose, so the frames have the
 * same size, anchor and points; only trouser px differ, and they come from the shorts render near
 * the hip and from the bare-leg render farther away.
 */
export function partyFigure(look: PartyLook, pose: Pose, d: Dn, bareTop = false): Frame {
  const st = bareTop ? { ...look.style, top: look.legs } : look.style;
  const a = renderHuman({ ...st, pants: look.shorts }, { weapon: 'none', ...pose }, 'full', d);
  const b = renderHuman({ ...st, pants: look.legs }, { weapon: 'none', ...pose }, 'full', d);
  const hip = a.pts?.hip;
  if (!hip || a.buf.w !== b.buf.w || a.buf.h !== b.buf.h || a.ox !== b.ox || a.oy !== b.oy) return a;
  const out = a.buf.clone();
  const r2 = SHORTS_R * SHORTS_R;
  const hx = hip[0] + a.ox;
  const hy = hip[1] + a.oy;
  for (let Y = 0; Y < out.h; Y++) {
    const ly = (Y + 0.5) / d - hy;
    for (let X = 0; X < out.w; X++) {
      const lx = (X + 0.5) / d - hx;
      // Only below the waist: the shorts hem never cuts the torso or the arms above it.
      if (ly < 0.5 || lx * lx + ly * ly < r2) continue;
      const i = Y * out.w + X;
      out.data[i] = b.buf.data[i];
    }
  }
  return { ...a, buf: out };
}

/**
 * Re-anchor a figure so its hip point sits `hipY` px above the new anchor (x 0): a seated figure
 * anchored on the floor under its stool. Points move with the anchor.
 */
export function moveAnchor(f: Frame, hipY: number, hipX = 0): Frame {
  const hip = f.pts?.hip;
  if (!hip) return f;
  const dx = Math.round(hip[0] - hipX);
  const dy = Math.round(hip[1] + hipY);
  const pts: Record<string, readonly [number, number]> = {};
  for (const k of Object.keys(f.pts ?? {})) {
    const p = (f.pts as Record<string, readonly [number, number]>)[k];
    pts[k] = [p[0] - dx, p[1] - dy];
  }
  return { ...f, ox: f.ox + dx, oy: f.oy + dy, pts };
}

/** Stack pieces (skipping nulls) onto a frame. */
export function addPieces(f: Frame, pieces: ReadonlyArray<Piece | null>): Frame {
  const list = pieces.filter((p): p is Piece => p !== null);
  return list.length ? withPieces(f, list) : f;
}

/** A piece of buffer `buf` (a box of logical size at density d) with its top-left at (x, y). */
export function piece(buf: PixelBuffer, x: number, y: number, d: Dn, behind = false): Piece {
  const p: Piece = { buf, x: Math.round(x), y: Math.round(y), behind };
  if (d !== 1) p.density = d;
  return p;
}

/** The PAL ink, for callers that paint outlines by hand. */
export const KIT_INK: Color = INK;
/** Re-export for drawers that need a PAL tone directly. */
export const KIT_PAL = PAL;
