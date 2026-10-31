/**
 * COMIC INK (comic.ts) at 1×: the rig's 1× frame, flattened and inked. At 40 px tall there is no
 * room for halftone or hatching, so the 1× frame keeps two ideas of the style:
 * - flat colour: the top (lit-edge) tone of every cloth and skin ramp folds into the tone below
 *   it, so each material reads as a light and a shadow (metal, brass, snow and eye whites keep
 *   their glints);
 * - the heavier line on the side away from the light: the contour grows one px into the figure
 *   along its lower-right edge.
 * Every colour stays a PAL colour.
 */
import type { Color } from '../../../../engine/color';
import { INK as INK1, PAL, type RampName } from '../../../../engine/palette';
import type { HumanFrame } from '../../../art/humanoid';

/** Ramps whose top tone is a glint, kept. */
const GLINT: ReadonlySet<RampName> = new Set(['steel', 'snow', 'gold', 'brass', 'cloth', 'ui', 'fire', 'sky', 'teal']);
/** Vincent's materials first (a colour shared by ramps takes its first home here). */
const ORDER: readonly RampName[] = ['skinA', 'brown', 'olive', 'red', 'black', 'hairB', 'steel', 'gold', 'snow'];

const MAP = new Map<Color, Color>();
{
  const names = [...ORDER, ...(Object.keys(PAL) as RampName[]).filter((n) => !ORDER.includes(n))];
  const seen = new Set<Color>();
  for (const n of names) {
    const r = PAL[n];
    for (let i = 0; i < r.length; i++) {
      const c = r[i] >>> 0;
      if (seen.has(c)) continue;
      seen.add(c);
      if (n === 'ink' || GLINT.has(n) || r.length < 3) continue;
      if (i === r.length - 1) MAP.set(c, r[r.length - 2] >>> 0);
    }
  }
}

const INK: Color = INK1 >>> 0;

export function comic1x(f: HumanFrame): HumanFrame {
  const buf = f.buf.clone();
  const { w, h, data } = buf;
  for (let i = 0; i < data.length; i++) {
    const c = data[i] >>> 0;
    if ((c & 255) === 0) continue;
    const m = MAP.get(c);
    if (m !== undefined) data[i] = m;
  }
  // The heavy side: a lit px whose lower-right corner touches the outside and that sits next to
  // the contour (right or below) turns to ink.
  const src = Uint32Array.from(data);
  const empty = (x: number, y: number): boolean => x < 0 || y < 0 || x >= w || y >= h || (src[y * w + x] & 255) === 0;
  const isInk = (x: number, y: number): boolean => !empty(x, y) && src[y * w + x] >>> 0 === INK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (empty(x, y) || isInk(x, y)) continue;
      const outside = empty(x + 1, y + 1) || empty(x + 2, y + 1) || empty(x + 1, y + 2);
      if (outside && (isInk(x + 1, y) || isInk(x, y + 1)) && (isInk(x + 1, y + 1) || empty(x + 1, y + 1))) data[i] = INK;
    }
  }
  buf.touch();
  return { ...f, buf };
}
