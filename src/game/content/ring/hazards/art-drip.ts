/**
 * Revision R (docs/design/ring.md §R.4): the text panel of the final jam's gantry —
 * `ring/hazard/drip` (2 frames, anchor = the bracket on the far post, left middle): 0 dark, 1 the
 * amber LED text `FILE` over `BLOKKADE` (our own 3 × 5 lettering, traffic/lettering.ts). A black
 * housing in a steel frame like the matrix signs (art.ts `signFrame`), clamped to the right side of
 * the far post on the median, above lane 1's sign; at 4× the face is an LED grid. ONE
 * density-generic drawer (PAL at 1×, PAL_HD at 2× / 4×), outline A (it is a sign over the road,
 * drawn with the gantry). OPT-IN: only a gantry with the param `drip` draws it.
 */
import type { Color } from '../../../../engine/color';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas } from '../../../art/hd';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { GLYPH_H, glyphHitC } from '../traffic/lettering';
import { FAR_P, FAR_POST_DX } from './geometry';

/** The texts a panel can show (frame = index + 1; frame 0 is dark). */
export const DRIP_TEXTS: Readonly<Record<string, readonly [string, string]>> = { file: ['FILE', 'BLOKKADE'] };

/** A `drip` param → its frame (unknown: 0, dark). */
export function dripFrame(key: string): number {
  const i = Object.keys(DRIP_TEXTS).indexOf(key);
  return i < 0 ? 0 : i + 1;
}

/** Panel size (logical px, the frame incl. the bracket) and its bracket width. */
const BRACKET = 3;
const PW = 41;
const PH = 17;
const W = BRACKET + PW + 1;
const H = PH + 1;

/** The panel's anchor relative to (gantry x, screen y 0): the far post's right side, above lane 1's sign. */
export const DRIP_AT: readonly [number, number] = [FAR_POST_DX + 2, FAR_P - 63];

/** The LED colour of text px at (u, v) (relative to the face centre) or 0. */
function ledAt(lines: readonly [string, string], u: number, v: number): Color {
  // Two lines of 5 bits with a 2-bit gap, centred.
  const gap = 2;
  const h = GLYPH_H * 2 + gap;
  const y0 = -h / 2 + GLYPH_H / 2;
  if (glyphHitC(lines[0], 0, y0, 1, 1, u, v)) return 1;
  if (glyphHitC(lines[1], 0, y0 + GLYPH_H + gap, 1, 1, u, v)) return 1;
  return 0;
}

export function dripPanelFrame(f: number, d: Dn): Frame {
  const c = new HdCanvas(W, H, d);
  const housing = mat(c, 'black', { spec: 0.6, shine: 30, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const frame = mat(c, 'steel', { spec: 1, shine: 36, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const bracket = mat(c, 'steel', { spec: 0.7, shine: 26, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  // The bracket clamped round the post (two straps), then the frame and the housing.
  c.box(0, 3, BRACKET + 1, 2, { mat: bracket, z: 1, r: 0.3 });
  c.box(0, H - 6, BRACKET + 1, 2, { mat: bracket, z: 1, r: 0.3 });
  const x0 = BRACKET;
  c.box(x0, 0.5, PW, PH, { mat: frame, z: 2, r: 0.8, bevel: 0.7 });
  c.box(x0 + 1.2, 1.7, PW - 2.4, PH - 2.4, { mat: housing, z: 8, round: 0.2 });
  const lines = DRIP_TEXTS[Object.keys(DRIP_TEXTS)[f - 1] ?? ''];
  const amber = top('gold', d, d === 1 ? 0 : 1);
  const glow = top('orange', d, d === 1 ? 0 : 2);
  const dim = bot('black', d, d === 1 ? 1 : 2);
  const cx = x0 + PW / 2;
  const cy = 0.5 + PH / 2;
  c.paint(x0 + 1.2, 1.7, PW - 2.4, PH - 2.4, (x, y, X, Y) => {
    if (d === 4 && X % 2 === 1 && Y % 2 === 1) return 0;
    const on = lines ? ledAt(lines, x - cx, y - cy) : 0;
    if (on) return d === 1 ? amber : (X + Y) % 3 === 0 ? glow : amber;
    return d === 4 && (X + Y) % 2 === 0 ? dim : 0;
  }, 9);
  const buf = finishA(c, 0.2);
  return d === 1 ? { buf, ox: 0, oy: Math.floor(H / 2) } : { buf, ox: 0, oy: Math.floor(H / 2), density: d };
}

defineSprite('ring/hazard/drip', () => [0, 1].map((f) => dripPanelFrame(f, 1)), { hd: (d) => [0, 1].map((f) => dripPanelFrame(f, d as Dn)) });
