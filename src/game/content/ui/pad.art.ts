/**
 * Gamepad button glyphs for the menus, the help and CONTROLS (docs/design/ams-extras.md §10;
 * engine/pads.ts `padLabel`). Top-left anchored, 9 × 9 with the ink outline (rule A: one logical
 * px), drawn in line with the small font (top at the text y − 1).
 *
 * - `ui/pad-ps`   a round dark button cap with a PlayStation-style shape: frame 0 ✕ (south, sky
 *                 blue), 1 ○ (east, red), 2 □ (west, pink), 3 △ (north, teal)
 * - `ui/pad-pos`  a generic pad's face button by position: the same cap with four dots in a
 *                 diamond, the one at the position lit gold (frame 0 south, 1 east, 2 west, 3 north)
 *
 * HD (2× and 4×): one density-generic drawer (`padGlyphHd`) with the 1× geometry, PAL_HD only:
 * a glossy domed cap and the shape as a raised, softly lit stroke; outline A (ICON_RENDER).
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, type DenseDensity } from '../../../engine/sprites';
import type { HdCanvas } from '../../art/hd/index';
import { paintIcon } from '../weapons/icons.art';

/** The glyph ids (one screen-art group). */
export const PAD_GLYPHS: readonly string[] = ['ui/pad-ps', 'ui/pad-pos'];
/** Logical size of every glyph frame (outline included). */
export const PAD_GLYPH_W = 9;

/** The 1× cap: a 7 × 7 disc lit from the top left (outline added by the frame). */
const CAP: readonly string[] = ['..HHH..', '.HhhhD.', 'HhhhhhD', 'HhhhhhD', 'HhhhhhD', '.hhhhD.', '..DDD..'];

/** The shapes on a 5 × 5 grid inside the cap. */
const SHAPES: readonly (readonly string[])[] = [
  ['X...X', '.X.X.', '..X..', '.X.X.', 'X...X'],
  ['.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.'],
  ['XXXXX', 'X...X', 'X...X', 'X...X', 'XXXXX'],
  ['.....', '..X..', '.X.X.', 'XXXXX', '.....'],
];

/** The PlayStation-style shape colours (1×): cross, circle, square, triangle. */
const SHAPE_1X: readonly Color[] = [PAL.sky[3], PAL.red[3], PAL.pink[2], PAL.teal[2]];
/** Their HD ramps. */
const SHAPE_HD: readonly Ramp[] = [PAL_HD.sky, PAL_HD.red, PAL_HD.pink, PAL_HD.teal];

/** Position dots (cap px) per frame: south, east, west, north (the standard order). */
const DOTS: readonly (readonly [number, number])[] = [
  [3, 5],
  [5, 3],
  [1, 3],
  [3, 1],
];

const capKey = { H: PAL.steel[2], h: PAL.steel[1], D: PAL.steel[0] };

function cap(): PixelBuffer {
  return ascii([...CAP], capKey);
}

function psFrames(): Frame[] {
  return SHAPES.map((rows, i) => {
    const b = cap();
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === 'X') b.set(1 + x, 1 + y, SHAPE_1X[i]);
    return { buf: b.padded(1).outline(INK), ox: 0, oy: 0 };
  });
}

function posFrames(): Frame[] {
  return DOTS.map((_, f) => {
    const b = cap();
    for (let i = 0; i < 4; i++) {
      const [x, y] = DOTS[i];
      if (i !== f) {
        b.set(x, y, PAL.stone[2]);
        continue;
      }
      // The lit position: a small gold plus.
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) b.set(x + dx, y + dy, dx === 0 && dy === 0 ? PAL.gold[3] : PAL.gold[2]);
    }
    return { buf: b.padded(1).outline(INK), ox: 0, oy: 0 };
  });
}

// ---------------------------------------------------------------------------------------------
// HD (2× and 4×)
// ---------------------------------------------------------------------------------------------

/** Centre of the cap in the 9 × 9 frame and its radius (inside the 1 px outline). */
const CX = 4.5;
const CY = 4.5;
const CAP_R = 3.48;

/** The cap: a low glossy dome of dark gunmetal. */
function drawCap(c: HdCanvas): void {
  const capMat = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 4, spec: 0.9, shine: 30, rim: 0.4, gain: 1.05, amb: 0.15 });
  c.heightField(1, 1, 7, 7, (x, y) => {
    const u = (x - CX) / CAP_R;
    const v = (y - CY) / CAP_R;
    const e = u * u + v * v;
    return e > 1 ? NaN : 0.9 * Math.sqrt(1 - e);
  }, { mat: capMat, z: 0 });
}

/** A closed outline through `pts` as one stroke. */
function loop(pts: readonly (readonly [number, number])[]): [number, number][] {
  const out = pts.map(([x, y]) => [x, y] as [number, number]);
  out.push([pts[0][0], pts[0][1]]);
  return out;
}

/** One PlayStation-style glyph (frame 0..3) at density d. */
function psHd(i: number, d: DenseDensity): Frame {
  const buf = paintIcon(9, 9, d, (c) => {
    drawCap(c);
    const ink = c.material({ ramp: SHAPE_HD[i], lo: 3, hi: SHAPE_HD[i].length - 2, spec: 0.5, shine: 24, gain: 1.15, wrap: 0.2 });
    const o = { mat: ink, z: 1.2 };
    const w = d >= 4 ? 0.36 : 0.42;
    if (i === 0) {
      c.capsule(2.95, 2.95, 6.05, 6.05, w, w, o);
      c.capsule(6.05, 2.95, 2.95, 6.05, w, w, o);
    } else if (i === 1) {
      const ring: [number, number][] = [];
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        ring.push([CX + Math.cos(a) * 1.62, CY + Math.sin(a) * 1.62]);
      }
      c.stroke(loop(ring), w, w, o);
    } else if (i === 2) {
      c.stroke(loop([[3.0, 3.0], [6.0, 3.0], [6.0, 6.0], [3.0, 6.0]]), w, w, o);
    } else {
      c.stroke(loop([[4.5, 2.75], [6.2, 5.95], [2.8, 5.95]]), w, w, o);
    }
  });
  return { buf, ox: 0, oy: 0, density: d };
}

/** One position glyph (frame 0 south … 3 north) at density d. */
function posHd(f: number, d: DenseDensity): Frame {
  const buf = paintIcon(9, 9, d, (c) => {
    drawCap(c);
    const dim = c.material({ ramp: PAL_HD.stone, lo: 2, hi: 5, spec: 0.3, shine: 16 });
    const lit = c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 1, shine: 34, rim: 0.4, gain: 1.15 });
    for (let i = 0; i < 4; i++) {
      // Cap px (x, y) of the 1× art → its centre in the frame.
      const x = DOTS[i][0] + 1.5;
      const y = DOTS[i][1] + 1.5;
      if (i === f) c.ellipsoid(x, y, 1.25, 1.25, { mat: lit, z: 1.2 });
      else c.ellipsoid(x, y, 0.6, 0.6, { mat: dim, z: 1, tone: -0.2 });
    }
  });
  return { buf, ox: 0, oy: 0, density: d };
}

/** Register the pad glyphs. */
export function definePadArt(): void {
  defineSprite('ui/pad-ps', psFrames, { anchor: 'top-left', hd: (d) => [0, 1, 2, 3].map((i) => psHd(i, d)) });
  defineSprite('ui/pad-pos', posFrames, { anchor: 'top-left', hd: (d) => [0, 1, 2, 3].map((i) => posHd(i, d)) });
}
