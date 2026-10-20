/**
 * UHD `ams-skyline` (docs/ART_GUIDE.md "UHD art"): the far city at 2× and 4× from ONE
 * density-generic generator. The 1× layout (backgrounds.ts: the same hashes, the same chain of
 * narrow houses, gable types, spires, crane and Westertoren at the same logical places) painted as
 * the farthest layer: the 1× hazy fill / edge / window tones of each light, walked along their HD
 * ramp for a little more shape (lit coping on every gable and roof, a lit left and a shaded right
 * edge per house, two fill tones from house to house, window slots with a sill at 4×, conical
 * spires lit on the left with a ball and a vane, a lattice crane), and a mist that lightens the
 * houses toward the ground (atmospheric perspective). The Westertoren is the one landmark in real
 * colours, seen through the haze: brick with courses, stone stages with lit faces and arched
 * windows, the blue crown with gold ribs, the spire and the vane.
 *
 * No outline (style decision: backgrounds are separated by tone and light only).
 */
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { defineHdBgGenerator, type HdBgGenerator } from '../../../art/art-registry';
import { hash2, noise1 } from '../../../art/paint';
import { SKYLINE } from './backgrounds';
import { airOf, BgCanvas, bool, dq, ix, lightOf, mixHd, px, rampI, step, type Air } from './art-hd-bg-kit';

/** The Westertoren (logical layout of backgrounds.ts `westertoren`), lit from the upper left. */
function westertorenHd(c: BgCanvas, cx: number, base: number, air: Air, crownAir: Air): void {
  const d = c.d;
  const brick = rampI(air, PAL_HD.brick);
  const stone = rampI(air, PAL_HD.stone);
  const slot = air(PAL_HD.navy[1]);
  // The crown (the landmark's mark, as at 1×: blue and gold) sits in less haze than the stone.
  const gold = rampI(crownAir, PAL_HD.gold);
  const crown = rampI(crownAir, PAL_HD.navy);
  const steel = rampI(air, PAL_HD.steel);
  // A stage: front face (mid), lit left strip, shaded right strip, a shadow under its cornice.
  const stage = (x: number, y: number, w: number, h: number, r: Uint8Array, mid: number): void => {
    c.rect(x, y, w, h, r[mid]);
    c.rect(x, y, Math.min(2, w / 4), h, r[mid + 1]);
    c.rect(x + w - 1, y, 1, h, r[mid - 1]);
    c.rect(x, y, w, 1 / d, r[mid - 1]);
  };
  // Brick base: courses every ¾ logical px at 4× (1 px at 2×), a lit left face.
  stage(cx - 6, base - 46, 12, 46, brick, 3);
  const course = d === 4 ? 3 : 2;
  for (let Y = (base - 46) * d + course; Y < base * d; Y += course) c.span((cx - 4) * d, (cx + 5) * d, Y, brick[2]);
  // Arched windows: the 1× 3 × 5 slots with round tops and a lit sill.
  for (let y = base - 40; y < base; y += 9) {
    c.rect(cx - 2, y + 0.5, 3, 4.5, slot);
    c.rect(cx - 1.5, y, 2, 0.5, slot);
    c.rect(cx - 2.25, y + 5, 3.5, 0.5, stone[5]);
  }
  // Stone cornice, stages and their windows.
  c.rect(cx - 7, base - 48, 14, 2, stone[5]);
  c.rect(cx - 7, base - 47 + 0.5, 14, 0.5, stone[3]);
  stage(cx - 5, base - 62, 10, 14, stone, 4);
  c.rect(cx - 2, base - 58.5, 3, 6.5, slot);
  c.rect(cx - 1.5, base - 59, 2, 0.5, slot);
  c.rect(cx - 6, base - 64, 12, 2, stone[5]);
  c.rect(cx - 6, base - 63 + 0.5, 12, 0.5, stone[3]);
  stage(cx - 4, base - 74, 8, 10, stone, 4);
  c.rect(cx - 1, base - 71.5, 2, 4.5, slot);
  c.rect(cx - 0.75, base - 72, 1.5, 0.5, slot);
  // The crown: blue and gold stripes (as at 1×: ½ logical px each at 4×), a gold rim and a gold orb.
  c.rect(cx - 5, base - 76, 10, 2, gold[4]);
  c.rect(cx - 5, base - 76, 10, 0.5, gold[6]);
  for (let y = 0; y < 7; y++) {
    const half = 4 - Math.floor(y / 3);
    const Y0 = (base - 77 - y) * d;
    for (let X = (cx - half) * d; X < (cx + half + 1) * d; X++) {
      const rib = d === 4 ? ((X - cx * d) & 3) < 2 : ((X - cx * d) & 1) === 0;
      const lit = X < cx * d;
      const col = rib ? gold[lit ? 6 : 4] : crown[lit ? 5 : 4];
      for (let k = 0; k < d; k++) c.dot(X, Y0 + k, col);
    }
  }
  c.rect(cx - 0.5, base - 84.5, 1.5, 1.5, gold[5]);
  c.rect(cx - 0.5, base - 84.5, 0.5, 0.5, gold[7]);
  // The slim spire: lit left art px, a gold vane at the top.
  c.rect(cx, base - 94, 1, 10, stone[4]);
  c.rect(cx + 0.5, base - 94, 0.5, 10, stone[2]);
  c.rect(cx, base - 101, 1 / d, 7, steel[3]);
  c.rect(cx, base - 102, 0.5, 1, gold[6]);
  c.rect(cx + 0.5, base - 101.5, 1, 0.5, gold[5]);
}

const amsSkylineHd: HdBgGenerator = (w, h, p, seed, d) => {
  const c = new BgCanvas(w, h, d);
  const light = lightOf(p);
  const base = px(p, 'y', 0.62, h);
  const [fill0, edge0, win0] = SKYLINE[light];
  // The 1× hazy tones (already the light's colours: no extra tint) and their HD neighbours.
  const fill = ix(fill0);
  const fillB = ix(mixHd(fill0, win0, 0.3));
  // The lit edge stays a soft tone (half way to the 1× edge): far houses must not look outlined.
  const edge = ix(mixHd(fill0, edge0, 0.5));
  const edgeHi = ix(edge0);
  const win = ix(win0);
  const shade = ix(step(fill0, -1));
  const mist = ix(mixHd(fill0, edge0, 0.55));
  const sill = ix(mixHd(edge0, PAL.snow[3], 0.3));
  const fills: number[] = [];
  // Gables: the same seamless chain of narrow houses as 1× (same hashes, logical px).
  let x0 = 0;
  let i = 0;
  while (x0 < w) {
    let hw = 7 + Math.floor(hash2(i, 1, seed) * 7);
    if (w - (x0 + hw) < 7) hw = w - x0;
    const top = base - 14 - Math.floor(noise1(x0, 60, w, seed) * 14) - Math.floor(hash2(i, 2, seed) * 6);
    const f = hash2(i, 8, seed) < 0.35 ? fillB : fill;
    fills.push(f);
    c.rect(x0, top, hw, h - top, f);
    const g = Math.floor(hash2(i, 3, seed) * 3);
    if (g === 0) {
      // A pitched roof (the 1× 45° steps, smooth).
      c.poly([[x0, top], [x0 + 4, top - 4], [x0 + hw - 4, top - 4], [x0 + hw, top]], f);
    } else if (g === 1) {
      for (let y = 1; y <= 4; y++) {
        const inset = Math.floor(y / 2) * 2;
        c.rect(x0 + inset, top - y, Math.max(1, hw - inset * 2), 1, f);
      }
    } else c.rect(x0, top - 1, hw, 1, f);
    // Lit coping along the top silhouette (half a logical px), a lit left and a shaded right edge.
    const cope = 1;
    for (let X = x0 * d; X < (x0 + hw) * d; X++) {
      for (let Y = (top - 5) * d; Y < top * d + d; Y++) {
        if (c.at(X, Y) === f) {
          for (let k = 0; k < cope; k++) c.dot(X, Y + k, edge);
          break;
        }
      }
    }
    c.rect(x0, top, 1 / d, h - top, edge);
    c.rect(x0 + hw - 1 / d, top, 1 / d, h - top, shade);
    // Window slots with a sill at 4× (the 1× window grid).
    for (let y = top + 3; y < base + 10; y += 5) {
      for (let x = x0 + 2; x < x0 + hw - 1; x += 3) {
        if (hash2(x, y, seed) >= 0.6) continue;
        if (d === 4) {
          c.rect(x, y - 0.25, 0.75, 1.25, win);
          c.rect(x, y + 1, 0.75, 0.25, sill);
        } else c.rect(x, y, 0.5, 1, win);
      }
    }
    x0 += hw;
    i++;
  }
  // Mist: the houses lighten toward the ground (dithered), solid below.
  {
    const Y0 = (base - 8) * d;
    const Y1 = (base + 12) * d;
    const pxs = c.px;
    const W = c.W;
    for (let Y = Math.max(0, Y0); Y < c.H; Y++) {
      const t = Math.min(1.2, (Y - Y0) / (Y1 - Y0));
      const row = Y * W;
      for (let X = 0; X < W; X++) {
        const v = pxs[row + X];
        if (v !== fill && v !== fillB && v !== edge && v !== shade) continue;
        if (dq(t, X, Y, 1) >= 1) pxs[row + X] = mist;
      }
    }
  }
  // Church spires: a tower with louvres and a conical spire lit on the left, a ball and a vane.
  for (const [fx, tall] of [[0.12, 30], [0.58, 24], [0.82, 36]] as const) {
    const cx = Math.round(w * fx);
    c.rect(cx - 3, base - tall, 6, tall, fill);
    c.rect(cx - 3, base - tall, 1, tall, edge);
    c.rect(cx + 2.5, base - tall, 0.5, tall, shade);
    c.rect(cx - 0.5, base - tall + 3, 1, 2.5, win);
    c.rect(cx - 3, base - tall, 6, 0.5, edge);
    const tip = base - tall - 16;
    // The 1× taper: half-width floor((16 − y) / 6) per row; smooth on the art grid.
    c.poly([[cx - 3, base - tall], [cx, tip], [cx + 1, tip], [cx + 4, base - tall]], (X) => (X < (cx + 0.5) * d ? edgeHi : fill));
    c.rect(cx, tip - 1, 1, 1, edge);
    c.rect(cx + 0.25, tip - 3, 0.5, 2, win);
  }
  // The crane: a lattice mast and jib, a counter-jib with its weight, the hook on its cable.
  const kx = Math.round(w * 0.45);
  const jy = base - 70;
  const mA = (kx * d) | 0;
  c.rect(kx, jy, 1 / d, 70, win);
  c.rect(kx + 2 - 1 / d, jy, 1 / d, 70, win);
  for (let Y = jy * d; Y < base * d; Y++) {
    const k = ((Y - jy * d) % (2 * d)) / (2 * d);
    c.dot(mA + Math.round(k < 0.5 ? k * 2 * (2 * d - 1) : (1 - k) * 2 * (2 * d - 1)), Y, win);
  }
  c.rect(kx - 14, jy, 44, 1 / d, win);
  c.rect(kx - 14, jy + 2 - 1 / d, 44, 1 / d, win);
  for (let X = (kx - 14) * d; X < (kx + 30) * d; X++) {
    const k = ((X - (kx - 14) * d) % (2 * d)) / (2 * d);
    c.dot(X, jy * d + Math.round(k < 0.5 ? k * 2 * (2 * d - 1) : (1 - k) * 2 * (2 * d - 1)), win);
  }
  for (let x = kx - 12; x < kx + 28; x += 4) c.rect(x + 1, jy + 1, 0.5, 0.5, edge);
  c.rect(kx - 13, jy + 2, 4, 2.5, win);
  c.rect(kx + 22, jy + 2, 1 / d, 9, win);
  c.rect(kx + 21.5, jy + 11, 1, 1, win);
  c.rect(kx - 1, jy - 3, 4, 3, win);
  c.rect(kx - 1, jy - 3, 4, 0.5, edge);
  if (bool(p, 'tower', true)) westertorenHd(c, Math.round(w * 0.3), base + 2, airOf(light, 0.48), airOf(light, 0.2));
  return c.finish();
};

defineHdBgGenerator('ams-skyline', amsSkylineHd);

