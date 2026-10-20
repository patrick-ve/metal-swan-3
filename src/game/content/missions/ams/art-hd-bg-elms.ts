/**
 * UHD `ams-elms` (docs/ART_GUIDE.md "UHD art"): the near row of elms along the canal, with lamp
 * posts and parked bikes, at 2× and 4× from ONE density-generic generator.
 *
 * Same design as the 1× layer (backgrounds.ts: the same hashes put every tree, its seven leaf
 * masses, its branches, the lamp posts and the bikes at the same logical places). Painted:
 *
 * - trunks lit on the left, bark furrows, a wider foot; two tapered limbs with a lit top edge and
 *   (4×) a few twigs that show in the crown's gaps;
 * - crowns of leaf CLUSTERS (art-hd-bg-trees.ts): shelves of foliage with lit tops and dark
 *   undersides over a deep inside, notched leafy edges, the crown's lower right in its own shade
 *   (no round "cauliflower" bumps);
 * - lamp posts: a dark post lit on the left, a plinth, a glazed lantern with a warm glow, its cap;
 * - parked bikes: tyres with a lit arc, rims and spokes (4×: eight), a tube frame lit on top,
 *   mudguards, a leather saddle, the rack, bars and a lamp.
 *
 * The nearest background layer: a touch of haze only; no ink outline (style decision).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { defineHdBgGenerator, type HdBgGenerator } from '../../../art/art-registry';
import { hash2 } from '../../../art/paint';
import { airOf, BgCanvas, bool, homeOf, lightOf, num, px, rampI, type Air } from './art-hd-bg-kit';
import { leafMass, trunk } from './art-hd-bg-trees';

/** A tapered limb from (x0, y0) to (x1, y1), w0 → w1 logical px thick, its top edge lit. */
function limb(c: BgCanvas, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, bark: Uint8Array): void {
  const n = bark.length - 1;
  c.poly(
    [
      [x0, y0 - w0 / 2],
      [x1, y1 - w1 / 2],
      [x1, y1 + w1 / 2],
      [x0, y0 + w0 / 2],
    ],
    bark[n - 2],
  );
  c.line(x0, y0 - w0 / 2, x1, y1 - w1 / 2, bark[n - 1]);
}

/** A parked bike (the 1× `drawBike` layout at (x, y) = left, wheel row), `flip` = front to the left. */
function bikeHd(c: BgCanvas, x: number, y: number, frame: Color, flip: boolean, air: Air): void {
  const d = c.d;
  const fx = (dx: number): number => (flip ? x + 21 - dx : x + dx) + 0.5;
  const tyre = rampI(air, PAL_HD.black);
  const steel = rampI(air, PAL_HD.steel);
  const h = homeOf(frame);
  const fr = rampI(air, h.ramp);
  const fm = Math.max(1, Math.min(fr.length - 2, h.i));
  const leather = rampI(air, PAL_HD.brown);
  const gold = rampI(air, PAL_HD.gold);
  const wy = y - 4.5;
  for (const wx of [fx(4), fx(17)]) {
    // Tyre (one logical px) lit on its upper-left arc, the rim, spokes and the hub.
    c.disc(wx, wy, 5.5, 5.5, (_X, _Y, u, v) => {
      const r = Math.hypot(u, v) * 5.5;
      if (r > 4.5) return tyre[u + v < -0.9 ? 4 : 1];
      if (r > 4 && d === 4) return steel[u + v < -0.5 ? 6 : 4];
      return 0;
    });
    const spokes = d === 4 ? 8 : 4;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI;
      c.line(wx - Math.cos(a) * 4, wy - Math.sin(a) * 4, wx + Math.cos(a) * 4, wy + Math.sin(a) * 4, steel[3]);
    }
    c.rect(wx - 0.5, wy - 0.5, 1, 1, steel[6]);
    // The mudguard: an arc over the upper half of the tyre.
    c.disc(wx, wy, 6.2, 6.2, (_X, _Y, u, v) => {
      const r = Math.hypot(u, v) * 6.2;
      return r > 5.6 && v < -0.15 ? fr[fm - 1] : 0;
    });
  }
  // Tubes: frame colour, lit on top (one art px).
  const tube = (ax: number, ay: number, bx: number, by: number): void => {
    const tw = Math.max(1, Math.round(0.75 * d));
    c.line(ax, ay, bx, by, fr[fm], tw);
    c.line(ax, ay - 0.25, bx, by - 0.25, fr[fm + 1]);
  };
  tube(fx(4), y - 5, fx(9), y - 5);
  tube(fx(9), y - 5, fx(14), y - 11);
  tube(fx(8), y - 11, fx(9), y - 5);
  tube(fx(14), y - 11, fx(17), y - 5);
  // Rack, saddle, stem, bars and the lamp.
  c.line(fx(4), y - 9, fx(8), y - 10, tyre[2], Math.max(1, d >> 1));
  c.line(fx(3), y - 9, fx(4), y - 5, tyre[2]);
  const sx = Math.min(fx(6), fx(10));
  c.rect(sx, y - 12.5, 4, 1, leather[2]);
  c.rect(sx, y - 12.5, 4, 0.25, leather[5]);
  c.line(fx(14), y - 11, fx(14), y - 14, steel[5], Math.max(1, d >> 1));
  c.line(fx(12), y - 14, fx(15), y - 14, steel[6], Math.max(1, d >> 1));
  c.rect(fx(16) - 0.5, y - 11.5, 1, 1, gold[6]);
}

/** A lamp post: post lit on the left, plinth, glazed lantern with a warm glow, cap and finial. */
function lampHd(c: BgCanvas, lx: number, h: number, air: Air, glow: boolean): void {
  const post = rampI(air, PAL_HD.black);
  const gold = rampI(air, PAL_HD.gold);
  c.rect(lx, h - 70, 2, 70, post[2]);
  c.rect(lx, h - 70, 0.5, 70, post[5]);
  c.rect(lx + 1.5, h - 70, 0.5, 70, post[0]);
  c.rect(lx - 0.5, h - 18, 3, 2, post[3]);
  c.rect(lx - 0.5, h - 18, 3, 0.5, post[6]);
  // The lantern: four panes (warm, lighter at the top), a dark frame bar in the middle.
  c.rect(lx - 2, h - 76, 6, 6, gold[glow ? 6 : 5]);
  c.rect(lx - 2, h - 73, 6, 3, gold[glow ? 5 : 4]);
  c.rect(lx - 1.5, h - 75.5, 1, 1, gold[7]);
  c.rect(lx + 0.75, h - 76, 0.5, 6, post[1]);
  c.rect(lx - 2, h - 76, 0.25, 6, post[1]);
  c.rect(lx + 3.75, h - 76, 0.25, 6, post[1]);
  c.rect(lx - 2, h - 70.5, 6, 0.5, post[2]);
  // Cap and finial.
  c.rect(lx - 3, h - 77, 8, 1, post[2]);
  c.rect(lx - 3, h - 77, 8, 0.25, post[5]);
  c.poly([[lx - 1.5, h - 77], [lx + 1, h - 79], [lx + 3.5, h - 77]], post[3]);
  c.rect(lx + 0.75, h - 80, 0.5, 1, post[5]);
}

const amsElmsHd: HdBgGenerator = (w, h, p, seed, d) => {
  const c = new BgCanvas(w, h, d);
  const light = lightOf(p);
  const air = airOf(light, 0.03);
  const mid = px(p, 'y', 0.3, h);
  const spacing = Math.max(64, num(p, 'spacing', 112));
  const n = Math.max(1, Math.round(w / spacing));
  const step = w / n;
  const leaf = rampI(air, PAL_HD.green);
  const bark = rampI(air, PAL_HD.brown.slice(0, 7));
  for (let k = 0; k < n; k++) {
    const cx = Math.round(k * step + step / 2 + (hash2(k, 1, seed) - 0.5) * step * 0.3);
    const r = 22 + Math.floor(hash2(k, 2, seed) * 10);
    const cy = mid + Math.floor(hash2(k, 3, seed) * 10) - 5;
    // Trunk (4 wide, 5 below cy + 40) and two limbs into the crown.
    trunk(c, cx - 2, cy, cy + 40, 4, bark, seed + k);
    trunk(c, cx - 2, cy + 40, h, 5, bark, seed + k + 99);
    limb(c, cx - 1, cy + 14, cx - 23.5, cy - 0.7, 2, 0.6, bark);
    limb(c, cx + 1, cy + 12, cx + 23.5, cy - 4.8, 2, 0.6, bark);
    if (d === 4) {
      for (let t = 0; t < 4; t++) {
        const s = t % 2 === 0 ? -1 : 1;
        const bx = cx + s * (6 + t * 4);
        const by = cy + 13 - t * 3;
        c.line(bx, by, bx + s * 3, by - 5 - hash2(k, t, seed) * 3, bark[2]);
      }
    }
    // The crown: the seven 1× leaf masses as clusters of leaves.
    const crown = { x: cx, y: cy, r };
    for (let m = 0; m < 7; m++) {
      const bx = cx + Math.round((hash2(k, 10 + m, seed) - 0.5) * r * 1.5);
      const by = cy + Math.round((hash2(k, 20 + m, seed) - 0.6) * r * 0.9);
      const br = Math.round(r * (0.45 + hash2(k, 30 + m, seed) * 0.25));
      leafMass(c, bx + 0.5, by + 0.5, br, leaf, seed + k * 97 + m * 13, crown, (hash2(k, 40 + m, seed) - 0.5) * 0.6);
    }
    // A lamp post between the trees and bikes leaning on the trunk.
    lampHd(c, Math.round(cx + step / 2), h, air, light === 'sunset');
    if (bool(p, 'bikes', true)) {
      const frame = [PAL.ink[1], PAL.red[1], PAL.sky[0], PAL.green[1]][k % 4];
      bikeHd(c, cx + 4, h - 41, frame, k % 2 === 0, air);
    }
  }
  return c.finish();
};

defineHdBgGenerator('ams-elms', amsElmsHd);
