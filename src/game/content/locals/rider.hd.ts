/**
 * Dense-frame box helpers, once part of the UHD art of the Amsterdam fatbike riders. Every rider
 * is a baked 40 px set since docs/design/ams40.md wave 4 (delivery-rider.art.ts,
 * fatbike-youth.art.ts, rider.art.ts): the HD bikes, wheels and riders are gone (plan rule 7).
 * Kept: `onBox` / `onBoxes`, which other dense sets still use (geometry is law: a dense frame cut
 * to the box of its trimmed 1× frame).
 */
import type { Frame } from '../../../engine/render';

/** A dense frame cut to the box of its (trimmed) 1× frame `base`: the registry's geometry. */
export function onBox(f: Frame, base: Frame, d: number): Frame {
  const x = f.ox - base.ox;
  const y = f.oy - base.oy;
  const buf = f.buf.crop(x * d, y * d, base.buf.w * d, base.buf.h * d);
  return base.pts ? { buf, ox: base.ox, oy: base.oy, pts: base.pts, density: d } : { buf, ox: base.ox, oy: base.oy, density: d };
}

/** `onBox` for a strip and its 1× frames. */
export function onBoxes(fs: readonly Frame[], base: readonly Frame[], d: number): Frame[] {
  return fs.map((f, i) => onBox(f, base[i], d));
}
