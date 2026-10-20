/**
 * UHD art (d 2 and 4) of the canal boats of mission ams: the small open boat that carries the
 * player `decor/ams/ams-boat-platform` (2 wake frames; 1× art in npc.art.ts `smallBoat`) and the
 * houseboats `decor/ams/houseboat-<w>x<deck>-<cx>-<cw>-<colour>` of sections a and c (1× art in
 * art.ts `houseboatSprite`).
 *
 * - Boat platform (it moves and carries you: outline A): a varnished clinker hull with lapped
 *   strakes and nail heads, the white rubbing strake, the teal stripe, an outboard motor with a
 *   lit cowl and a red decal, a rope fender; the wake painted after the outline (foam at the bow
 *   and stern, a rippled wash line), so the outline never rings the foam.
 * - Houseboats (static decor you can stand on: outline C): a painted steel hull with plate seams,
 *   rivets, rust streaks under the portholes (brass rings, dark glass, a glint), the red waterline
 *   and algae; the clapboard cabin in the boat's colour, white window frames with curtains and
 *   reflections, the roof platform with a lit edge, potted plants, a stove pipe, the deck rail, a
 *   bike and flower pots on the deck.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { hdRampOf, PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { wood as woodTex } from '../../../art/hd/index';
import { hash2, noise2 } from '../../../art/paint';
import { BIKE_COLOURS, TULIPS, WATER_Y } from './art';
import { decoMat, HdCanvas, hdStrip, metalMat, propMat, wheelHd } from './art-hd-cd-kit';
import { A_BOATS, C_BOATS, DECK_Y, ROOF_Y } from './terrain';

const D = 'decor/ams/';

// =============================================================================================
// The small open canal boat (64 × 22, 2 frames)
// =============================================================================================

function smallBoat(c: HdCanvas, phase: number): PixelBuffer {
  const varnish = propMat(c, PAL_HD.wood, { lo: 1, hi: 6, spec: 0.5, shine: 22 });
  const white = propMat(c, PAL_HD.cloth, { lo: 3, hi: 6, spec: 0.3 });
  const teal = propMat(c, PAL_HD.teal, { lo: 1, hi: 4, spec: 0.4 });
  const steel = metalMat(c, PAL_HD.steel, { lo: 1, hi: 6 });
  const decal = propMat(c, PAL_HD.red, { lo: 3, hi: 6 });
  const rope = propMat(c, PAL_HD.sand, { lo: 2, hi: 6 });
  // The hull: lapped strakes (each a lit lap over a dark seam), nail heads along the laps.
  c.poly([[2, 3], [62, 3], [58, 14], [8, 14]], {
    mat: varnish,
    z: 0,
    n: [0, 0.15, 0.99],
    tex: (s) => {
      const f = (s.y - 4) / 2.25;
      const k = Math.floor(f);
      const g = (f - k) * 2.25;
      const e = 1 / s.d;
      if (g < e) s.tone -= 0.45;
      else if (g < 2.2 * e) s.ny -= 0.6;
      s.tone += (noise2(s.x * 0.25, k * 3, 1, 4) - 0.5) * 0.2 - (s.y - 3) * 0.03;
      if (s.d >= 4 && g > 0.55 && g < 0.85 && ((s.x + k * 3) % 6) < 0.5) s.tone -= 0.3;
    },
  });
  c.box(6, 9.8, 52, 1.2, { mat: teal, z: 0.4, bevel: 0.35 });
  // Rubbing strake and the lit inner edge of the gunwale.
  c.capsule(2.6, 3.5, 61.4, 3.5, 0.62, 0.62, { mat: white, z: 0.8 });
  // The outboard motor: the cowl with a decal, the shaft into the water.
  c.cylinder(3, 6, 1.1, 9, { mat: steel, z: -0.2, tone: -0.2 });
  c.box(1, 0, 4.2, 6.2, { mat: steel, z: 1.2, bevel: 0.7, r: 0.8 });
  c.box(1.4, 2.6, 3.4, 0.7, { mat: decal, z: 2.1 });
  // Bow fender on a rope.
  c.capsule(58.4, 3.6, 59.4, 5.4, 0.15, 0.15, { mat: rope, z: 1.3, round: 0.5 });
  c.ellipsoid(59.5, 6.6, 1.5, 1.6, { mat: white, z: 1.4 });
  const buf = c.render({ outline: 'A', ao: 0.3, sepZ: 0.3, rimLight: 1 });
  // The wake (no outline): foam at the bow and stern, a rippled wash under the hull.
  const d = c.d;
  const foam = phase ? [[0, 15], [58, 14], [52, 15]] : [[2, 14], [60, 15], [48, 15]];
  const put = (X: number, Y: number, col: Color): void => {
    if (X < 0 || Y < 0 || X >= buf.w || Y >= buf.h) return;
    if ((buf.get(X, Y) & 255) === 0) buf.set(X, Y, col);
  };
  for (let X = 10 * d; X < 55 * d; X++) {
    const k = (X / d + phase * 5) % 9;
    put(X, 15 * d + (k < 4.5 ? 0 : 1), k < 1.2 ? PAL_HD.sky[7] : k < 4.5 ? PAL_HD.sky[5] : PAL_HD.sky[4]);
  }
  for (const [x, y] of foam) {
    for (let Y = y * d; Y < (y + 1) * d; Y++) {
      for (let X = x * d - d / 2; X < (x + 4) * d + d / 2; X++) {
        const u = (X / d - x - 2) / 2.6;
        const v = (Y / d - y - 0.5) / 0.6;
        if (u * u + v * v > 1) continue;
        put(X, Y, u * u + v * v < 0.35 ? PAL_HD.snow[6] : PAL_HD.snow[4]);
      }
    }
  }
  buf.touch();
  return buf;
}

// =============================================================================================
// Houseboats
// =============================================================================================

/** The hull and cabin ramps of the boat colours (art.ts BOAT_COLOURS: green, navy / sky, red, brown). */
const HULLS: readonly (readonly [Ramp, Ramp])[] = [
  [PAL_HD.green, PAL_HD.green],
  [PAL_HD.navy, PAL_HD.sky],
  [PAL_HD.red, PAL_HD.red],
  [PAL_HD.brown, PAL_HD.brown],
];

/** A step-through Dutch bike on the deck (art.ts `drawBike` at (x, y)), frame colour from the 1× palette. */
function deckBike(c: HdCanvas, x: number, y: number, frame: Color, z: number): void {
  const paint = c.material({ ramp: hdRampOf(PAL.ink.includes(frame) ? PAL.black : PAL.red[1] === frame ? PAL.red : PAL.sky), spec: 0.8, shine: 24, lo: 1, hi: 5, edge: 'C' });
  const steel = metalMat(c, PAL_HD.steel, { lo: 2, hi: 6, edge: 'C' });
  const tyre = decoMat(c, PAL_HD.black, { lo: 0, hi: 3, edge: 'C' });
  for (const cx of [4, 17]) wheelHd(c, x + cx + 0.5, y - 4.5, 5.4, { tyre, rim: steel, hub: steel }, { z, spokes: 8, tyre: 0.8, seed: cx });
  const P = (dx: number, dy: number): [number, number] => [x + dx + 0.5, y - dy + 0.5];
  const seg = (a: [number, number], b: [number, number], r = 0.42, m = paint): void => {
    c.capsule(a[0], a[1], b[0], b[1], r, r, { mat: m, z: z + 0.4 });
  };
  seg(P(4, 5), P(9, 5));
  seg(P(9, 5), P(14, 11));
  seg(P(8, 11), P(9, 5));
  seg(P(14, 11), P(17, 5));
  seg(P(4, 9), P(8, 10), 0.3, steel);
  seg(P(3, 9), P(4, 5), 0.3, steel);
  seg(P(14, 11), P(14, 14), 0.3, steel);
  seg(P(12, 14), P(15, 14), 0.3, steel);
  c.blob([[x + 5.6, y - 12.4], [x + 10.6, y - 12.6], [x + 10, y - 11.2], [x + 6, y - 11.2]], 0.45, { mat: tyre, z: z + 0.6 });
}

function houseboat(c: HdCanvas, w: number, deck: number, cx: number, cw: number, colour: number): PixelBuffer {
  const [hr, cr] = HULLS[colour % HULLS.length];
  const hull = decoMat(c, hr, { lo: 0, hi: 2, spec: 0.3, shine: 16, edge: 'C' });
  const strake = decoMat(c, hr, { lo: 1, hi: 4, spec: 0.4, shine: 16, edge: 'C' });
  const cabin = decoMat(c, cr, { lo: 2, hi: cr.length - 2, spec: 0.15, edge: 'C' });
  const roofM = decoMat(c, PAL_HD.wood, { lo: 1, hi: 6, edge: 'C' });
  const white = decoMat(c, PAL_HD.gable, { lo: 3, hi: 6, edge: 'C' });
  const glass = c.material({ ramp: PAL_HD.glass, flat: true, lo: 1, hi: 5, edge: 'C' });
  const red = decoMat(c, PAL_HD.red, { lo: 2, hi: 6, edge: 'C' });
  const rust = decoMat(c, PAL_HD.rust, { lo: 1, hi: 4, edge: 'C' });
  const moss = decoMat(c, PAL_HD.moss, { lo: 1, hi: 4, edge: 'C' });
  const leaf = decoMat(c, PAL_HD.green, { lo: 2, hi: 6, wrap: 0.2, edge: 'C' });
  const pot = decoMat(c, PAL_HD.rust, { lo: 2, hi: 6, edge: 'C' });
  const curtain = decoMat(c, colour % 2 === 0 ? PAL_HD.gold : PAL_HD.pink, { lo: 2, hi: 5, wrap: 0.3, edge: 'C' });
  const steel = metalMat(c, PAL_HD.steel, { lo: 1, hi: 5, edge: 'C' });
  const H = deck + 26;
  const roof = 1;
  const hullTop = roof + deck;
  const water = WATER_Y - (ROOF_Y - roof);
  // The bow: rounded off from the strake down (the 1× steps at the right end).
  const bowX = (y: number): number => {
    const t = Math.max(0, Math.min(1, (y - hullTop - 2) / 8));
    return w + 1 - t * t * 2.4;
  };
  // The hull: steel plates, a weld seam, rivets at 4×, rust streaks under the portholes, the
  // waterline, algae and the dark wet hull under the water.
  c.plane(1, hullTop, w, H - hullTop + 1, {
    mat: hull,
    z: 0,
    mask: (x) => x < bowX(hullTop + 12),
    tex: (s) => {
      if (s.x >= bowX(s.y)) {
        s.cut = true;
        return;
      }
      const e = 1 / s.d;
      // Plate joints every 12 px, a weld seam.
      if ((s.x - 1) % 12 < e && s.y > hullTop + 3) s.tone -= 0.3;
      if (Math.abs(s.y - (hullTop + 5.5)) < e * 0.6) s.tone -= 0.3;
      if (s.d >= 4 && Math.abs(s.y - (hullTop + 4.4)) < 0.15 && (s.x % 2) < 0.4) s.tone += 0.2;
      // Rust streaks running down from the portholes.
      const px = Math.round((s.x - 6.5) / 9) * 9 + 6.5;
      if (s.y > hullTop + 8.6 && s.y < hullTop + 8.6 + 2.4 * hash2(Math.round(px), 1, colour) && Math.abs(s.x - px) < 0.3 && s.x < w - 4) s.mat = rust;
      // The waterline stripe, algae at the water, the dark hull under it.
      if (s.y >= hullTop + 11 && s.y < hullTop + 12) {
        s.mat = red;
        if (s.y < hullTop + 11 + e) s.ny -= 0.6;
      } else if (s.y >= hullTop + 12) {
        s.tone -= 0.45 + (s.y - hullTop - 12) * 0.05;
        // Algae: one ragged fringe along the waterline with longer strands here and there (blobs
        // of moss read like lettering at 4×).
        const reach = 0.45 + 1.05 * noise2(s.x * 1.6, 0.5, 1.5, colour + 3) + (hash2(Math.floor(s.x * 2), 7, colour + 5) > 0.78 ? 0.45 : 0);
        if (s.y > water - reach && s.y < water + 1) s.mat = moss;
      }
      // Toward the bow the hull turns away from the light.
      if (s.x > w - 6) s.nx += (s.x - w + 6) * 0.15;
      s.tone += (noise2(s.x, s.y, 4, colour) - 0.5) * 0.08;
    },
  });
  // The strake band with its lit top edge.
  c.plane(1, hullTop, w, 3, {
    mat: strake,
    z: 0.6,
    mask: (x, y) => x < bowX(y),
    tex: (s) => {
      const f = s.y - hullTop;
      if (f < 0.6) s.ny -= 0.75;
      else if (f > 2.4) s.ny += 0.6;
    },
  });
  // Portholes: a steel ring, dark glass with a glint.
  for (let x = 6; x < w - 4; x += 9) {
    const cx0 = x + 0.5;
    const cy0 = hullTop + 7.5;
    c.ellipsoid(cx0, cy0, 1.25, 1.25, { mat: steel, z: 0.8, round: 0.6 });
    c.ellipsoid(cx0, cy0, 0.75, 0.75, { mat: glass, z: 1.2, round: 0, tone: -0.15 });
    c.dot(cx0 - 0.3, cy0 - 0.35, PAL_HD.sky[6]);
  }
  // The deck rail: white posts and the top rail, open at the cabin.
  for (let x = 3; x < w - 2; x += 10) c.box(x + 0.15, hullTop - 4, 0.7, 4, { mat: white, z: 0.9, bevel: 0.25 });
  const railSegs: [number, number][] = [];
  const cabin0 = 1 + cx - 2.5;
  const cabin1 = 1 + cx + cw + 1.5;
  if (cw > 0) {
    railSegs.push([2, Math.min(w - 1, cabin0)]);
    railSegs.push([Math.max(2, cabin1), w - 1]);
  } else railSegs.push([2, w - 1]);
  for (const [a, b] of railSegs) if (b - a > 1) c.capsule(a + 0.3, hullTop - 3.6, b - 0.3, hullTop - 3.6, 0.4, 0.4, { mat: white, z: 1 });
  if (cw > 0) {
    const x0 = 1 + cx;
    // The cabin: painted clapboard, lit left corner, shaded right.
    c.box(x0, roof + 2, cw, deck - 2, {
      mat: cabin,
      z: 0.3,
      bevel: 0.7,
      tex: (s) => {
        const f = (s.y - roof - 2) / 1.8;
        const g = (f - Math.floor(f)) * 1.8;
        const e = 1 / s.d;
        if (g < e) s.tone -= 0.4;
        else if (g < 2 * e) s.ny -= 0.5;
        s.tone += (hash2(Math.floor(f), Math.floor(s.x / 7), colour) - 0.5) * 0.12;
        // Paint weathered at the foot of the walls.
        if (s.y > hullTop - 3) s.tone -= (s.y - hullTop + 3) * 0.06;
      },
    });
    // Windows: white frames, glass with the sky and a sheen, curtains drawn to the sides.
    for (let x = x0 + 4; x < x0 + cw - 8; x += 12) {
      const wh = Math.max(4, deck - 10);
      c.box(x, roof + 5, 8, wh, { mat: white, z: 1.2, bevel: 0.45 });
      c.plane(x + 1, roof + 6, 6, wh - 2, {
        mat: glass,
        z: 1.7,
        tex: (s) => {
          const u = s.x - x - 1;
          const v = s.y - roof - 6;
          s.tone = 0.45 - v * 0.05 + (Math.abs(u + v * 0.6 - 3.2) < 0.55 ? 0.35 : 0);
          if (v < 0.6) s.tone -= 0.3;
        },
      });
      c.blob([[x + 1, roof + 6], [x + 2.6, roof + 6], [x + 2.1, roof + 6 + wh - 2], [x + 1, roof + 6 + wh - 2]], 0.4, { mat: curtain, z: 2 });
      c.blob([[x + 5.4, roof + 6], [x + 7, roof + 6], [x + 7, roof + 6 + wh - 2], [x + 5.9, roof + 6 + wh - 2]], 0.4, { mat: curtain, z: 2 });
      c.box(x - 0.6, roof + 5 + wh, 9.2, 0.9, { mat: white, z: 1.6, bevel: 0.3, n: [0, -0.5, 0.86] });
    }
    // The roof platform: a lit wooden slab.
    c.box(x0 - 2, roof, cw + 4, 3, { mat: roofM, z: 1, bevel: 0.6, n: [0, -0.45, 0.89], tex: woodTex({ seed: colour + 7, plank: 1 }) });
    // Plants on the roof edge and the stove pipe.
    c.box(x0 + 2, roof - 0.9, 3, 1.2, { mat: pot, z: 1.8, bevel: 0.3 });
    c.ellipsoid(x0 + 3.5, roof - 1, 1.5, 0.8, { mat: leaf, z: 2 });
    c.ellipsoid(x0 + 3.5, roof - 1.6, 0.55, 0.55, { mat: red, z: 2.2 });
    c.cylinder(x0 + cw - 8, -0.6, 2, 2, { mat: steel, z: 1.6 });
    c.box(x0 + cw - 9, -0.6, 4, 0.8, { mat: steel, z: 1.8, bevel: 0.3 });
  }
  // A bike on the deck, flower pots with tulips.
  if (cx > 24) deckBike(c, 3, hullTop, BIKE_COLOURS[colour % BIKE_COLOURS.length], 1.4);
  if (w - cx - cw > 12) {
    const px = cx + cw + 6;
    c.box(px, hullTop - 3, 4, 3, { mat: pot, z: 1.4, bevel: 0.45 });
    c.blob([[px - 0.3, hullTop - 3], [px + 4.3, hullTop - 3], [px + 3.6, hullTop - 6], [px + 0.4, hullTop - 6]], 0.7, { mat: leaf, z: 1.6 });
    const tc = TULIPS[colour % TULIPS.length];
    const tm = decoMat(c, hdRampOf(tc === PAL.gold[2] ? PAL.gold : tc === PAL.orange[2] ? PAL.orange : PAL.pink.includes(tc) ? PAL.pink : PAL.red), { lo: 2, hi: 6, edge: 'C' });
    for (const dx of [0.8, 2.2, 3.4]) c.ellipsoid(px + dx, hullTop - 6.4 - (dx === 2.2 ? 0.5 : 0), 0.55, 0.75, { mat: tm, z: 1.9 });
  }
  return c.render({ outline: 'C', ao: 0.28, sepZ: 0.3, shadow: 0.2, shadowMax: 2 });
}

/** HD frames of a houseboat id, or null when `id` is not one. */
function houseboatHd(id: string, d: number): Frame[] {
  const m = id.slice(D.length).match(/^houseboat-(\d+)x(\d+)-(\d+)-(\d+)-(\d+)$/);
  if (!m) throw new Error(`not a houseboat id: ${id}`);
  const [w, deck, cx, cw, colour] = m.slice(1).map(Number);
  return hdStrip(id, d, (c) => houseboat(c, w, deck, cx, cw, colour));
}

/** The houseboat ids of sections a and c (art.ts `boatDecor` with their numbers). */
const HOUSEBOAT_IDS: readonly string[] = [...new Set([...A_BOATS, ...C_BOATS].map((b) => `${D}houseboat-${b.w}x${DECK_Y - ROOF_Y}-${b.cx - b.x0}-${b.cw}-${b.colour}`))];

export const BOATS_HD: ReadonlyArray<readonly [string, (d: number) => Frame[]]> = [
  [`${D}ams-boat-platform`, (d) => hdStrip(`${D}ams-boat-platform`, d, (c, i) => smallBoat(c, i))],
  ...HOUSEBOAT_IDS.map((id) => [id, (d: number) => houseboatHd(id, d)] as const),
];
