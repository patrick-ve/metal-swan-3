/**
 * Sprites of content area `ring/items` (docs/ART_GUIDE.md "UHD art": one density-generic drawer per
 * strip, `PAL` at 1×, `PAL_HD` at 2× and 4×, outline A for what can be picked up).
 *
 * - `ring/item/crate` (4): the road crate — an oiled plank box with steel corner caps, an orange
 *   hi-vis strap and a white reflective band (our own colours; no letter), its top face seen a
 *   little from above; frames 1–3 tumble (30°, 60°, 90°) while it falls off a vehicle. Feet anchor.
 * - `ring/item/glow` (4, centre anchor, no outline): small warm twinkles round the item that floats
 *   over the crate, turning a step each frame.
 * The hostage reuses the tourist's strips (`item/hostage/tourist/…`) and the items the pickups'.
 */
import { INK } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas, wood } from '../../../art/hd';
import { finishA, mat, top, type Dn } from '../../stag/kit.art';

/** Crate canvas: 26 × 22, anchor (13, 19): the box is 16 × 11 standing on the anchor row. */
const CW = 26;
const CH = 22;
const AX = 13;
const AY = 19;

/** The crate turned by `deg` about its middle (0 = resting). */
export function crateFrame(deg: number, d: Dn): Frame {
  const c = new HdCanvas(CW, CH, d);
  const plank = mat(c, 'wood', { spec: 0.35, shine: 16, lo1: 0, hi1: 3, lo: 2, hi: 6 });
  const lid = mat(c, 'wood', { spec: 0.45, shine: 18, lo1: 1, hi1: 3, lo: 3, hi: 7 });
  const steel = mat(c, 'steel', { spec: 1.1, shine: 40, lo1: 1, hi1: 4, lo: 2, hi: 6, rim: 0.3 });
  const strap = mat(c, 'orange', { spec: 0.4, shine: 20, lo1: 0, hi1: 1, lo: 2, hi: 5 });
  const band = mat(c, 'snow', { spec: 1, shine: 50, lo1: 2, hi1: 3, lo: 3, hi: 6 });
  const a = (deg * Math.PI) / 180;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  // The box's middle sits 5.5 px above the anchor (resting) or higher while it tumbles.
  const mx = AX + 0.5;
  const my = AY + 0.5 - (deg === 0 ? 5.5 : 7.5);
  const P = (u: number, v: number): [number, number] => [mx + u * cs - v * sn, my + u * sn + v * cs];
  const quad = (u0: number, v0: number, u1: number, v1: number): Array<[number, number]> => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
  const W = 8;
  const H = 5.5;
  // The side: planks (horizontal grain), a lit top face (a sliver seen from above).
  c.poly(quad(-W, -H + 1.4, W, H), {
    mat: plank,
    z: 1,
    tex: (t) => {
      wood({ seed: 3, dir: 'h', plank: 2.6 })(t as never);
      // Plank seams.
      const v = (t.x - mx) * -sn + (t.y - my) * cs;
      const k = (v + H - 1.4) / 2.6;
      if (k - Math.floor(k) < (d === 1 ? 0.3 : 0.12)) t.tone -= 0.5;
    },
  });
  c.poly(quad(-W, -H, W, -H + 1.6), { mat: lid, z: 1.3, tex: wood({ seed: 5, dir: 'h', plank: 3 }) });
  // Steel corner caps.
  for (const [u0, u1] of [[-W, -W + 2.2], [W - 2.2, W]] as const) {
    c.poly(quad(u0, -H, u1, -H + 2.4), { mat: steel, z: 2 });
    c.poly(quad(u0, H - 2.4, u1, H), { mat: steel, z: 2 });
  }
  // The orange strap round it and the reflective band across.
  c.poly(quad(-1.4, -H - 0.2, 1.4, H + 0.2), { mat: strap, z: 2.2 });
  c.poly(quad(-W + 2.4, -0.6, W - 2.4, 0.9), { mat: band, z: 1.8 });
  if (d > 1) {
    const [gx, gy] = P(-W + 1, -H + 0.6);
    c.dot(gx, gy, top('steel', d));
  }
  const buf = finishA(c, 0.3);
  return d === 1 ? { buf, ox: AX, oy: AY } : { buf, ox: AX, oy: AY, density: d };
}

/** Twinkles round the floating item (centre anchor). */
export function glowFrame(f: number, d: Dn): Frame {
  const n = 21;
  const k = 10;
  const c = new HdCanvas(n, n, d);
  const hot = top('gold', d, d === 1 ? 0 : 1);
  const warm = top('snow', d);
  const dim = top('gold', d, d === 1 ? 1 : 3);
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < 3; i++) {
    const a = ((i * 120 + f * 30) * Math.PI) / 180;
    const r = 8.2 - (i === 1 ? 1.4 : 0);
    // Twinkle size 2 (big cross), 1 (small), 0 (a dot) in turn.
    pts.push([k + 0.5 + Math.cos(a) * r, k + 0.5 + Math.sin(a) * r * 0.75, (i + f) % 3]);
  }
  c.paint(0, 0, n, n, (x, y) => {
    for (const [px, py, s] of pts) {
      const dx = Math.abs(x - px);
      const dy = Math.abs(y - py);
      if (dx < 0.5 && dy < 0.5) return warm;
      const arm = s === 2 ? 2.2 : s === 1 ? 1.3 : 0;
      if ((dx < 0.5 && dy < arm) || (dy < 0.5 && dx < arm)) return dx + dy < arm * 0.6 ? hot : dim;
    }
    return 0;
  });
  const buf = c.render({ outline: 'none', ink: INK, ao: 0, clean: false, sep: false });
  return d === 1 ? { buf, ox: k, oy: k } : { buf, ox: k, oy: k, density: d };
}

const TUMBLE = [0, 30, 60, 90];
defineSprite('ring/item/crate', () => TUMBLE.map((a) => crateFrame(a, 1)), { hd: (d) => TUMBLE.map((a) => crateFrame(a, d)) });
defineSprite('ring/item/glow', () => [0, 1, 2, 3].map((f) => glowFrame(f, 1)), { ticksPerFrame: 6, hd: (d) => [0, 1, 2, 3].map((f) => glowFrame(f, d)) });
