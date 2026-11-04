/**
 * SWAN-3 UHD art, part 4: the small extras at 2× / 4× (look.md §10.10, §12.3, §16 item 5), each
 * drawn natively in its 1× frame's rectangle with the 1× anchor.
 *
 * - `tinFeatherFramesHd`: the stamped tin feather plate (two vanes, navy tip, gold quill rivet),
 *   turning rigidly through edge-on.
 * - `beakFlashFramesHd`: the round beak flash (white-hot core, gold body, orange rim, short rays;
 *   additive, no outline), for `fx/muzzle-swan-beak-gun` only: the Swan's own ids draw their 1×
 *   art at every tier (docs/design/ams40.md rule 7).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { HdCanvas } from '../../../art/hd/index';
import { type D, SwanCanvas, setNormal, stud } from './hd-kit.art';
import { OWN, rot } from './kit.art';

// ------------------------------------------------------------------------------------ fx

/**
 * `fx/tin-feather` in the 1× frames' rectangles (centre anchor): the stamped plate (two vanes, a
 * navy tip, the gold quill rivet), turning rigidly 0°, 50°, 95° (nearly edge-on), 140°.
 */
export function tinFeatherFramesHd(d: D, lo: readonly Frame[]): Frame[] {
  const angles = [0, 50, 95, 140];
  return lo.map((f, i) => {
    const deg = angles[i];
    const sc = new SwanCanvas(f.buf.w, f.buf.h, d, f.ox, f.oy);
    const depth = Math.max(0.5, Math.abs(Math.cos(((deg - 10) * Math.PI) / 180)) * 1.6);
    const half = depth / 2 + 0.45;
    const r = (deg * Math.PI) / 180;
    const ux = Math.cos(r);
    const uy = Math.sin(r);
    const [cx, cy] = sc.T([0, 0]);
    const enamel = sc.mat('enamel');
    const navy = sc.mat('navy');
    const gold = sc.mat('gold');
    const q = sc.T(rot([-2.2, 0], deg));
    // The face turns away from the viewer as the plate goes edge-on (darker, the glint gone).
    const face = depth / 1.6;
    sc.c.plane(cx - 4, cy - 4, 8, 8, {
      mat: enamel,
      part: sc.part(OWN.hull),
      tex: (s) => {
        const px = s.x - cx;
        const py = s.y - cy;
        const u = px * ux + py * uy;
        const v = -px * uy + py * ux;
        // Plate from the quill (u −3.1) to the tip (u 3.2): square back, a slanted tip.
        const hw = u > 2 ? half * Math.max(0, 1 - (u - 2) / 1.3) : half;
        if (u < -3.1 || u > 3.25 || Math.abs(v) > hw) {
          s.cut = true;
          return;
        }
        const vn = v / Math.max(0.3, half);
        setNormal(s, -uy * Math.sign(vn) * 0.3, ux * Math.sign(vn) * 0.3, face + 0.2);
        if (u > 1.7) s.mat = navy;
        else if (stud(s, s.x - q[0], s.y - q[1], 0.55, gold)) return;
        else if (d >= 4 && Math.abs(v) < 0.18 && u > -1.8 && u < 1.6) s.tone -= 0.18;
      },
    });
    return { buf: sc.render(), ox: f.ox, oy: f.oy, density: d };
  });
}

/**
 * `fx/muzzle-swan-beak-gun` / `vehicle/swan/beak-flash` in the 1× 7 × 7 box (centre anchor): f0 a
 * round flash (white-hot core, gold body, orange rim, short rays), f1 an ember. Drawn additive:
 * no outline.
 */
export function beakFlashFramesHd(d: D, lo: readonly Frame[]): Frame[] {
  const F = PAL_HD.fire;
  return lo.map((f, i) => {
    const c = new HdCanvas(f.buf.w, f.buf.h, d);
    const cx = f.ox + 0.5;
    const cy = f.oy + 0.5;
    c.paint(0, 0, f.buf.w, f.buf.h, (x, y): Color => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (i === 1) return r < 0.55 ? F[6] : r < 1.05 ? F[5] : r < 1.6 ? F[4] : 0;
      // Eight rays (the four main ones longer), tapering.
      const a = Math.atan2(dy, dx);
      const k = Math.round((a / Math.PI) * 4);
      const off = Math.abs(a - (k * Math.PI) / 4) * r;
      const main = (k & 1) === 0;
      const len = main ? 3.4 : 2.7;
      if (r < 0.9) return F[7];
      if (r < 1.5) return F[6];
      if (r < 2.15) return F[5];
      if (r < 2.6) return F[4];
      if (r < len && off < (main ? 0.42 : 0.3) * (1 - (r - 2.6) / (len - 2.6) * 0.6)) return r < 3 ? F[5] : F[4];
      return 0;
    });
    return { buf: c.render({ outline: 'none', sep: false, ao: 0, clean: false }), ox: f.ox, oy: f.oy, density: d };
  });
}
