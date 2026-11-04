/**
 * SWAN-3 art rig, part 5: the small extras (docs/design/swan-mount/look.md §10.10, §12.3, §16
 * item 5).
 *
 * (The Swan's scuffs decal and nervous egg are baked 40 px art now: tools/art40/chars/swan/,
 * docs/design/ams40.md wave 7. The robot Swan's tin feather stays an FX id; the fleet's Trumpeter
 * uses it too.)
 * - `tinFeatherFrames()`: `fx/tin-feather`, a stiff stamped ivory plate (5 × 2, navy tip, steel
 *   edge glint, gold rivet dot at the quill) in 4 rigid turning frames (centre anchor).
 * - `beakFlashFrames()`: `fx/muzzle-swan-beak-gun`, a round 5 × 5 flash in 2 frames with no
 *   direction, so it fits all 9 neck angles (centre anchor, drawn with additive blending).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { OWN, Stack, harvest, poly, rot, shade, take } from './kit.art';

// ------------------------------------------------------------------------------------ fx

let featherStack: Stack | null = null;

/**
 * `fx/tin-feather`: a stiff stamped ivory plate 5 × 2 with a navy tip, a 1 px steel edge glint
 * and a gold rivet dot at the quill. Four rigid turning frames: the plate's vertices turn
 * (0°, 50°, 95° nearly edge-on, 140°); it never curls like down.
 */
export function tinFeatherFrames(): Frame[] {
  const st = (featherStack ??= new Stack());
  const angles = [0, 50, 95, 140];
  return angles.map((deg) => {
    st.reset();
    const k = (x: number, y: number): [number, number] => {
      const q = rot([x, y], deg);
      return [q[0], q[1]];
    };
    // Turning through edge-on: the plate's depth shrinks with |cos| of the tumble.
    const depth = Math.max(0.5, Math.abs(Math.cos(((deg - 10) * Math.PI) / 180)) * 1.6);
    const L = take();
    poly(L, [k(-2.6, -depth / 2), k(2.4, -depth / 2), k(2.8, 0), k(2.4, depth / 2), k(-2.6, depth / 2)], PAL.snow[2]);
    shade(L, PAL.snow, {});
    // The navy tip (the last px toward +x) and the quill's gold rivet dot.
    const a = k(2.2, 0);
    const q = k(-2.2, 0);
    st.put(L, OWN.hull, PAL.snow[0]);
    st.detail(a[0], a[1], PAL.navy[1]);
    const g = k(0, -depth / 2);
    st.detail(g[0], g[1], PAL.steel[3]);
    st.detail(q[0], q[1], PAL.gold[3]);
    const h = harvest(st);
    // Centre anchor on the plate's middle (body 0, 0).
    return { buf: h.buf, ox: h.ox, oy: h.oy };
  });
}

/**
 * `fx/muzzle-swan-beak-gun`: a round flash with no direction (look.md §16 item 5). f0: a 5 × 5
 * disc, white-hot core, gold body, orange rim; f1: a 3 × 3 ember. Centre anchor; drawn additive,
 * so no outline.
 */
export function beakFlashFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const b = new PixelBuffer(7, 7);
    if (f === 0) {
      b.circle(3, 3, 2, PAL.orange[3]);
      b.rect(2, 2, 3, 3, PAL.gold[3]);
      b.set(3, 1, PAL.gold[3]);
      b.set(1, 3, PAL.gold[3]);
      b.set(5, 3, PAL.gold[2]);
      b.set(3, 5, PAL.gold[2]);
      b.set(3, 3, PAL.fire[6]);
      b.set(2, 3, PAL.fire[6]);
      b.set(3, 2, PAL.fire[6]);
    } else {
      b.circle(3, 3, 1, PAL.orange[3]);
      b.set(3, 3, PAL.gold[3]);
    }
    out.push({ buf: b, ox: 3, oy: 3 });
  }
  return out;
}
