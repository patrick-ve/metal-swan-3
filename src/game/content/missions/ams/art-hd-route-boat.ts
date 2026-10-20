/**
 * UHD art (d 2 and 4) of the canal cruise's boat and the route signs of mission ams
 * (docs/design/ams-extras.md §4; 1× art in art-route.ts): `decor/ams/ams-cruise-boat` (3 frames:
 * calm, wake A, wake B), `decor/ams/route-sign` (3 frames) and `decor/ams/pontoon`. ONE drawer per
 * id on an `HdCanvas` of its 1× frame's logical size (`hdStrip`: the 1× anchor), PAL_HD only.
 *
 * - The cruise boat (it moves and carries the players: outline A): a navy steel hull lit along its
 *   white rubbing strake, plate seams and rivets at 4×, the red boot-top, the dark bottom under the
 *   water; the long glass cabin (white lower band with a gold pinstripe, white posts, the curved
 *   glass roof with its ribs and sky in the panes) with the tourists seen through the tinted glass
 *   (heads, hair, a cap, shirts, a camera), a diagonal sheen over the glass; the wheelhouse with the
 *   skipper in his cap; the open aft deck with its steel railing, the red-and-white lifebuoy and the
 *   Dutch flag on the stern pole; the sloping bow rail and a rubber fender. The wake is painted
 *   after the outline (calm ripples, or foam at the bow and the stern and the wash lines).
 * - Route signs (static decor: outline C): navy enamel boards with a white border, raised cream
 *   letters (the 1× text), steel posts with a foot plate.
 * - The pontoon (static decor you stand on: outline C): oiled deck boards with seams and nail
 *   heads, the grey steel float with bolts, fender openings and a dark waterline.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { wood as woodTex } from '../../../art/hd/index';
import { hash2 } from '../../../art/paint';
import { BOAT_ART, ROUTE_SIGNS, SIGN_BOARD_H, signBoardW } from './art-route';
import { decoMat, HdCanvas, hdStrip, letters, metalMat, propMat } from './art-hd-cd-kit';
import { CRUISE } from './cruise';

const D = 'decor/ams/';

// =============================================================================================
// The cruise boat (198 × 48; the stern at x 1, the deck line at row 35, the roof at row 11)
// =============================================================================================

/** The tourists behind the glass: frame x, hair ramp, skin ramp, shirt ramp, a cap. */
const TOURISTS_HD: readonly (readonly [number, Ramp, Ramp, Ramp, boolean])[] = [
  [52, PAL_HD.hairC, PAL_HD.skinA, PAL_HD.red, false],
  [63, PAL_HD.hairA, PAL_HD.skinC, PAL_HD.gold, false],
  [76, PAL_HD.red, PAL_HD.skinB, PAL_HD.cloth, true],
  [88, PAL_HD.hairB, PAL_HD.skinA, PAL_HD.teal, false],
  [101, PAL_HD.sand, PAL_HD.skinB, PAL_HD.pink, true],
  [113, PAL_HD.sky, PAL_HD.skinC, PAL_HD.green, false],
  [126, PAL_HD.hairA, PAL_HD.skinA, PAL_HD.orange, false],
  [138, PAL_HD.pink, PAL_HD.skinB, PAL_HD.denim, false],
];

function cruiseBoatHd(c: HdCanvas, frame: number): PixelBuffer {
  const { ox, oy, roof } = BOAT_ART;
  const [c0, c1] = BOAT_ART.cabin;
  const deck = oy;
  const L = ox;
  const R = ox + CRUISE.len;
  const hull = propMat(c, PAL_HD.navy, { lo: 1, hi: 4, spec: 0.4, shine: 20 });
  const boot = propMat(c, PAL_HD.red, { lo: 2, hi: 5, spec: 0.3 });
  const white = propMat(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.35, shine: 18 });
  const gold = metalMat(c, PAL_HD.gold, { lo: 3, hi: 6 });
  const steel = metalMat(c, PAL_HD.steel, { lo: 2, hi: 6 });
  const glass = c.material({ ramp: PAL_HD.glass, flat: true, lo: 0, hi: 5 });
  const roofGlass = c.material({ ramp: PAL_HD.sky, flat: true, lo: 2, hi: 7 });
  const rubber = propMat(c, PAL_HD.black, { lo: 1, hi: 4, spec: 0.3 });
  const buoyRed = propMat(c, PAL_HD.red, { lo: 3, hi: 6, spec: 0.4 });
  const flagRed = propMat(c, PAL_HD.red, { lo: 3, hi: 6, wrap: 0.3 });
  const flagWhite = propMat(c, PAL_HD.cloth, { lo: 3, hi: 6, wrap: 0.3 });
  const flagBlue = propMat(c, PAL_HD.sky, { lo: 0, hi: 3, wrap: 0.3 });
  const capM = propMat(c, PAL_HD.navy, { lo: 2, hi: 5, spec: 0.3 });
  const skipperSkin = propMat(c, PAL_HD.skinA, { lo: 2, hi: 5 });

  // --- The hull: navy steel, the strake lit, the flank turning under; the red boot-top; plate
  // seams and rivets at 4×; the raked bow and the round stern (the 1× polygon).
  const hullPart = c.newPart();
  c.poly(
    [
      [L + 1, deck],
      [R - 5, deck],
      [R + 1, deck + 2.2],
      [R - 3.4, deck + 10],
      [L + 6, deck + 10],
      [L + 0.2, deck + 5],
    ],
    {
      mat: hull,
      part: hullPart,
      z: 0,
      tex: (s) => {
        const t = s.y - deck;
        // The flank: upright, then turning under the waterline.
        s.ny = t < 3 ? -0.15 : 0.15 + (t - 3) * 0.12;
        s.nz = 1;
        if (s.x > R - 8) s.nx += (s.x - R + 8) * 0.12;
        if (s.x < L + 5) s.nx -= (L + 5 - s.x) * 0.12;
        if (t >= 4 && t < 6) {
          s.mat = boot;
          if (t < 4 + 1 / s.d) s.ny -= 0.5;
        } else if (t >= 8) s.tone -= 0.5;
        // Plate seams every 16 px, a row of rivets under the strake (4×).
        const e = 1 / s.d;
        if (t > 2 && t < 4 && (s.x - L) % 16 < e) s.tone -= 0.35;
        if (s.d >= 4 && Math.abs(t - 2.6) < 0.2 && (s.x - L) % 2 < 0.4) s.tone += 0.25;
      },
    },
  );
  // The white rubbing strake (rows deck and deck + 1 of the 1× art), its lit top edge.
  c.box(L, deck - 0.1, R - 4 - L + 1, 1.3, { mat: white, z: 0.8, bevel: 0.45, n: [0, -0.45, 0.89] });
  c.box(L + 1, deck + 1, R - 5 - L, 0.8, { mat: white, z: 0.6, bevel: 0.3, tone: -0.15 });
  // A rubber fender at the bow (the 1× ink dot) and one at the stern.
  c.ellipsoid(R - 1.5, deck + 1.5, 1.3, 1.2, { mat: rubber, z: 1.5 });
  c.ellipsoid(L + 2.5, deck + 2, 1.1, 1.1, { mat: rubber, z: 1.5 });

  // --- The open aft deck: a steel railing with posts (every 7 px), the lifebuoy, the flag pole.
  c.cylinder(L + 2, deck - 8.4, c0 - 2 - (L + 2), 0.8, { mat: steel, z: 0.9, axis: 'h' });
  c.cylinder(L + 2, deck - 4.4, c0 - 2 - (L + 2), 0.7, { mat: steel, z: 0.7, axis: 'h', tone: -0.2 });
  for (let x = L + 2; x < c0 - 1; x += 7) c.cylinder(x, deck - 8, 0.8, 8, { mat: steel, z: 0.8, axis: 'v' });
  // The lifebuoy: a red ring with four white bands, a rope round it at 4×.
  {
    const cx = L + 14.5;
    const cy = deck - 3.5;
    const R0 = 2.3;
    const tw = 1.25;
    c.heightField(cx - 3.6, cy - 3.6, 7.2, 7.2, (x, y) => {
      const q = Math.hypot(x - cx, y - cy) - R0;
      const e = tw;
      return Math.abs(q) > e ? NaN : Math.sqrt(e * e - q * q);
    }, {
      mat: buoyRed,
      z: 1.6,
      tex: (s) => {
        const a = Math.atan2(s.y - cy, s.x - cx) + Math.PI / 4;
        const k = ((a / (Math.PI / 2)) % 1 + 1) % 1;
        if (k < 0.32) s.mat = white;
      },
    });
  }
  // The flag pole with a gold knob; the Dutch flag (red, white, blue), a fold in the cloth.
  c.cylinder(L + 3, roof - 11, 0.8, deck - 9 - (roof - 11) + 1, { mat: steel, z: 0.5, axis: 'v' });
  c.ellipsoid(L + 3.4, roof - 11, 0.7, 0.7, { mat: gold, z: 0.7 });
  const fold = (s: { x: number; ny: number; nx: number; tone: number }): void => {
    const u = s.x - (L + 4);
    s.nx = Math.sin(u * 1.1) * 0.45;
    s.tone += Math.cos(u * 1.1) * 0.12;
  };
  c.box(L + 4, roof - 10, 7, 2, { mat: flagRed, z: 0.6, bevel: 0.2, tex: fold });
  c.box(L + 4, roof - 8, 7, 2, { mat: flagWhite, z: 0.6, bevel: 0.2, tex: fold });
  c.box(L + 4, roof - 6, 7, 2, { mat: flagBlue, z: 0.6, bevel: 0.2, tex: fold });

  // --- The cabin: the white lower band with the gold pinstripe.
  c.box(c0, deck - 6, c1 - c0, 6, {
    mat: white,
    z: 0.4,
    bevel: 0.6,
    tex: (s) => {
      // Panel seams under each window post, a row of portlights' rims at 4×.
      if ((s.x - c0) % 16 < 1 / s.d && s.y > deck - 5) s.tone -= 0.3;
    },
  });
  c.box(c0 + 2, deck - 3.1, c1 - 3 - (c0 + 2) + 1, 0.7, { mat: gold, z: 0.9, bevel: 0.25 });
  // The glass sides (the 1× rows roof + 2 … deck − 7): the sky reflected, darker low down.
  const gTop = roof + 2;
  const gBot = deck - 6;
  c.plane(c0 + 1, gTop, c1 - 2 - c0, gBot - gTop, {
    mat: glass,
    z: -0.6,
    tex: (s) => {
      const v = (s.y - gTop) / (gBot - gTop);
      s.tone = v < 0.25 ? 0.62 : v > 0.75 ? 0.12 : 0.42 - (v - 0.25) * 0.3;
    },
  });
  // The tourists behind the tinted glass (a little darker than in the open air).
  for (const [x, hair, skin, shirt, cap] of TOURISTS_HD) {
    const sk = propMat(c, skin, { lo: 1, hi: skin.length - 3 });
    const hr = propMat(c, hair, { lo: 1, hi: Math.min(hair.length - 2, 4) });
    const sh = propMat(c, shirt, { lo: 1, hi: Math.min(shirt.length - 2, 4), wrap: 0.2 });
    c.blob([[x - 1, gBot], [x - 0.8, roof + 13.2], [x + 2, roof + 12.2], [x + 4.8, roof + 13.2], [x + 5, gBot]], 0.9, { mat: sh, z: -0.3, tone: -0.15 });
    c.ellipsoid(x + 2, roof + 10, 2, 2.2, { mat: sk, z: -0.1, tone: -0.1 });
    if (cap) {
      c.box(x - 0.2, roof + 7.6, 4.4, 1.4, { mat: hr, z: 0.1, bevel: 0.5, r: 0.6 });
      c.box(x + 3.2, roof + 8.6, 2, 0.5, { mat: hr, z: 0.2 });
    } else c.blob([[x - 0.3, roof + 10.6], [x - 0.2, roof + 8.2], [x + 1, roof + 7.5], [x + 3, roof + 7.5], [x + 4.2, roof + 8.2], [x + 4.3, roof + 10.6], [x + 3.6, roof + 9.1], [x + 0.4, roof + 9.1]], 0.5, { mat: hr, z: 0, tone: -0.05 });
    // Eyes (the faces look out at the canal).
    c.dot(x + 1.2, roof + 10.1, PAL_HD.ink[1]);
    c.dot(x + 3, roof + 10.1, PAL_HD.ink[1]);
    // A camera held up now and then (the 1× x & 3 rule).
    if ((x & 3) === 0) c.box(x + 3, roof + 10, 3, 2, { mat: rubber, z: 0.2, bevel: 0.3 });
  }
  // The window posts (every 16 px) from the roof down to the band.
  for (let x = c0; x < c1; x += 16) c.box(x, roof + 1, 1, deck - 6 - (roof + 1), { mat: white, z: 0.7, bevel: 0.3 });
  c.box(c1 - 1, roof + 1, 1, deck - 6 - (roof + 1), { mat: white, z: 0.7, bevel: 0.3 });
  // The wheelhouse window at the front: the skipper in his white-banded cap.
  c.box(c1 - 16, roof + 3, 13, deck - 10 - roof, { mat: glass, z: -0.4, tone: 0.05 });
  c.ellipsoid(c1 - 9, roof + 10, 2, 2.2, { mat: skipperSkin, z: 0 });
  c.box(c1 - 12, roof + 6, 6, 2.2, { mat: capM, z: 0.3, bevel: 0.6, r: 0.8 });
  c.box(c1 - 13, roof + 7.6, 8, 0.8, { mat: capM, z: 0.4, bevel: 0.3, tone: -0.2 });
  c.box(c1 - 11.5, roof + 7, 5, 0.5, { mat: white, z: 0.5 });
  c.ellipsoid(c1 - 9, roof + 6.7, 0.5, 0.45, { mat: gold, z: 0.6 });
  c.blob([[c1 - 12, gBot], [c1 - 12, roof + 13], [c1 - 6, roof + 13], [c1 - 6, gBot]], 0.8, { mat: capM, z: -0.2 });
  // The curved glass roof: the white top rail, the lit panes, the ribs; rounded ends.
  c.plane(c0 + 1, roof + 0.6, c1 - 2 - c0, 1.6, {
    mat: roofGlass,
    z: 0.2,
    tex: (s) => {
      const v = s.y - roof - 0.6;
      s.tone = v < 0.5 ? 0.9 : 0.55 - v * 0.15 + (hash2(Math.floor(s.x / 4), 1, 7) - 0.5) * 0.12;
    },
  });
  c.capsule(c0 + 2.2, roof + 0.5, c1 - 3.2, roof + 0.5, 0.55, 0.55, { mat: white, z: 0.9 });
  c.ellipsoid(c0 + 1.1, roof + 1.5, 1.1, 1.1, { mat: white, z: 0.8 });
  c.ellipsoid(c1 - 2.1, roof + 1.5, 1.1, 1.1, { mat: white, z: 0.8 });
  for (let x = c0 + 8; x < c1 - 4; x += 16) c.box(x, roof, 1, 2.2, { mat: steel, z: 1, bevel: 0.3 });

  // --- The bow: a sloping rail with three posts.
  c.capsule(c1 + 2.5, deck - 5.6, R - 6.5, deck - 3.6, 0.4, 0.4, { mat: steel, z: 0.9 });
  for (const x of [c1 + 4, c1 + 11, R - 9]) {
    const top = deck - 5.6 + ((x + 0.5 - c1 - 2.5) / (R - 6.5 - c1 - 2.5)) * 2;
    c.cylinder(x, top, 0.8, deck - top, { mat: steel, z: 0.8, axis: 'v' });
  }

  const buf = c.render({ outline: 'A', ao: 0.3, sepZ: 0.3, rimLight: 1, shadow: 0.2, shadowMax: 2 });

  // --- The sheen over the glass (after the light: fixed colours over the tourists, inside the
  // panes only), then the wake (no outline).
  const d = c.d;
  const put = (X: number, Y: number, col: Color, over = false): void => {
    if (X < 0 || Y < 0 || X >= buf.w || Y >= buf.h) return;
    if (over || (buf.get(X, Y) & 255) === 0) buf.set(X, Y, col);
  };
  const sheen = PAL_HD.glass[5];
  for (let k = 0; k < 3; k++) {
    for (let Y = (roof + 3) * d; Y < (deck - 8) * d; Y++) {
      const x = c0 + 30 + k * 44 + (Y / d - roof);
      for (let X = Math.round(x * d); X < Math.round((x + 1) * d); X++) {
        // Only over the glass and the figures (not the posts).
        const px = X / d;
        if ((px - c0) % 16 < 1.2 || px > c1 - 17) continue;
        put(X, Y, (Y + X) % 3 === 0 ? PAL_HD.sky[7] : sheen, true);
      }
    }
  }
  const wl = deck + 5;
  if (frame === 0) {
    for (let x = L + 8; x < R - 8; x += 12) {
      for (let X = x * d; X < (x + 5) * d; X++) {
        const u = (X / d - x) / 5;
        put(X, (wl + 3) * d + (u > 0.2 && u < 0.8 ? 0 : 1), u > 0.3 && u < 0.6 ? PAL_HD.sky[6] : PAL_HD.sky[4]);
      }
    }
  } else {
    const k = frame - 1;
    const foam = (x0: number, x1: number, y: number, big: boolean): void => {
      const cx = (x0 + x1 + 1) / 2;
      const rx = (x1 - x0 + 1) / 2 + 0.4;
      const ry = big ? 0.9 : 0.6;
      for (let Y = Math.floor((y - ry + 0.5) * d); Y < Math.ceil((y + ry + 0.5) * d); Y++) {
        for (let X = Math.floor((cx - rx) * d); X < Math.ceil((cx + rx) * d); X++) {
          const u = (X / d - cx) / rx;
          const v = (Y / d - y - 0.5) / ry;
          const q = u * u + v * v;
          if (q > 1) continue;
          put(X, Y, q < 0.3 && v < 0.2 ? PAL_HD.snow[6] : q < 0.7 ? PAL_HD.snow[5] : PAL_HD.snow[3]);
        }
      }
    };
    // The bow wave pushed ahead, the foam along the stem.
    foam(R - 2 + k, R + 2 + k, wl - 1, true);
    foam(R - 6, R + 1 - k, wl, false);
    // The stern wash: churned foam dots.
    for (let x = L - 1; x < L + 10 - k * 2; x += 2) foam(x, x, wl + (x & 1), false);
    // The wash lines along the hull.
    for (let x = L + 12 + k * 6; x < R - 10; x += 14) {
      for (let X = x * d; X < (x + 6) * d; X++) {
        const u = (X / d - x) / 6;
        put(X, (wl + 2) * d + (u < 0.15 || u > 0.85 ? 1 : 0), u > 0.25 && u < 0.7 ? PAL_HD.snow[4] : PAL_HD.sky[5]);
      }
    }
  }
  buf.touch();
  return buf;
}

// =============================================================================================
// Route signs
// =============================================================================================

function routeSignHd(c: HdCanvas, text: string): PixelBuffer {
  const bw = signBoardW(text);
  const W = bw + 2;
  const H = SIGN_BOARD_H + 22 + 2;
  const enamel = decoMat(c, PAL_HD.navy, { lo: 1, hi: 4, spec: 0.6, shine: 24, edge: 'C' });
  const rim = decoMat(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.5, edge: 'C' });
  const steel = metalMat(c, PAL_HD.steel, { lo: 1, hi: 5, edge: 'C' });
  const foot = metalMat(c, PAL_HD.slate, { lo: 1, hi: 4, edge: 'C' });
  const two = bw > 60;
  const posts = two ? [6, W - 9] : [(W >> 1) - 1];
  for (const x of posts) {
    c.cylinder(x, SIGN_BOARD_H, 3, H - 2 - SIGN_BOARD_H, { mat: steel, z: 0, axis: 'v' });
    c.box(x - 1, H - 3, 5, 2, { mat: foot, z: 0.4, bevel: 0.5 });
    // A clamp band under the board.
    c.box(x - 0.3, SIGN_BOARD_H + 1, 3.6, 1, { mat: foot, z: 0.6, bevel: 0.3 });
  }
  // The enamel board: a white rim, the navy face (a soft sheen), the raised cream letters.
  c.box(1, 1, bw, SIGN_BOARD_H, { mat: rim, z: 1, bevel: 0.5, r: 0.6 });
  c.box(2, 2, bw - 2, SIGN_BOARD_H - 2, {
    mat: enamel,
    z: 1.4,
    bevel: 0.3,
    tex: (s) => {
      // Enamel: a faint diagonal sheen, tiny chips at the corners (4×).
      if (Math.abs(s.x - 2 - (s.y - 2) * 1.8 - bw * 0.3) < 0.8) s.tone += 0.25;
      if (s.d >= 4 && hash2(Math.floor(s.x * 4), Math.floor(s.y * 4), 9) > 0.995) s.tone -= 0.5;
    },
  });
  letters(c, text, 5, 3, { face: PAL_HD.sand[6], lit: PAL_HD.sand[7], edge: PAL_HD.sand[4], drop: PAL_HD.navy[0] });
  return c.render({ outline: 'C', ao: 0.25, sepZ: 0.3, shadow: 0.2, shadowMax: 2 });
}

// =============================================================================================
// The pontoon (128 × 9)
// =============================================================================================

function pontoonHd(c: HdCanvas): PixelBuffer {
  const W = 128;
  const boards = decoMat(c, PAL_HD.wood, { lo: 1, hi: 5, spec: 0.2, edge: 'C' });
  const float = decoMat(c, PAL_HD.slate, { lo: 1, hi: 5, spec: 0.5, shine: 20, edge: 'C' });
  const steel = metalMat(c, PAL_HD.steel, { lo: 2, hi: 6, edge: 'C' });
  const dark = decoMat(c, PAL_HD.ink, { lo: 0, hi: 1, edge: 'C' });
  const rubber = decoMat(c, PAL_HD.black, { lo: 1, hi: 3, edge: 'C' });
  // The deck boards (rows 0–1): oiled planks along the pontoon, a seam every 9 px, nail heads.
  c.box(0, 0, W, 2, {
    mat: boards,
    z: 1,
    bevel: 0.3,
    n: [0, -0.5, 0.86],
    tex: (s) => {
      woodTex({ seed: 4, plank: 1 })(s);
      if (s.x % 9 < 1 / s.d) s.tone -= 0.45;
      if (s.d >= 4 && (s.x % 9) > 0.5 && (s.x % 9) < 0.8 && Math.abs(s.y - 1) < 0.3) s.tone += 0.4;
    },
  });
  // The steel float (rows 2–6): a lit top flange, bolts, the fender openings.
  c.box(0, 2, W, 5, {
    mat: float,
    z: 0,
    bevel: 0.4,
    tex: (s) => {
      if (s.y < 2.6) s.ny -= 0.6;
      // Weld seams between the float sections (every 32 px).
      if (s.x % 32 < 1 / s.d) s.tone -= 0.3;
      // Streaks of rust and algae at the foot.
      if (s.y > 5.5) s.tone -= 0.3 + (hash2(Math.floor(s.x), 2, 5) - 0.5) * 0.3;
    },
  });
  for (let x = 4; x < W; x += 16) {
    c.ellipsoid(x + 0.5, 4.5, 0.6, 0.6, { mat: steel, z: 0.6 });
    // A fender tyre hanging in the opening.
    c.box(x + 6, 3, 3, 4, { mat: dark, z: 0.2 });
    c.ellipsoid(x + 7.5, 5, 1.2, 1.6, { mat: rubber, z: 0.5 });
  }
  // The waterline (rows 7–8): the dark wet foot.
  c.box(0, 7, W, 2, { mat: float, z: -0.2, tone: -0.9 });
  return c.render({ outline: 'C', ao: 0.25, sepZ: 0.3, shadow: 0.2, shadowMax: 1 });
}

/** The ids of this file → their HD generators. */
export const ROUTE_BOAT_HD: ReadonlyArray<readonly [string, (d: number) => Frame[]]> = [
  [`${D}ams-cruise-boat`, (d) => hdStrip(`${D}ams-cruise-boat`, d, (c, i) => cruiseBoatHd(c, i))],
  [`${D}route-sign`, (d) => hdStrip(`${D}route-sign`, d, (c, i) => routeSignHd(c, ROUTE_SIGNS[i]))],
  [`${D}pontoon`, (d) => hdStrip(`${D}pontoon`, d, (c) => pontoonHd(c))],
];
