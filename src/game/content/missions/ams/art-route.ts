/**
 * 1× art of the route choice and the canal cruise of mission ams (docs/design/ams-extras.md §4):
 * the 64-colour palette, light from the top-left, a 1-px ink outline on everything in the
 * playfield; Carré (far across the river) is painted without one. The 2× / 4× twins are drawn
 * natively in `art-hd-route.ts` with these frames' logical sizes, anchors and points.
 *
 * | id | frames | anchor | what |
 * |---|---|---|---|
 * | `decor/ams/ams-cruise-boat` | 3: calm, wake A, wake B | the stern on the deck line (ox 1, oy 35) | the long, low tour boat: navy hull, white rubbing strake, the glass cabin (x 40–168) with its curved glass roof (24 px over the deck), tourists inside, the wheelhouse with the skipper, an open aft deck with a railing, a lifebuoy and the flag |
 * | `decor/ams/route-sign` | 3: `BRUG ↑`, `RONDVAART ↓`, `WATERLOOPLEIN` | feet | navy boards with cream letters on steel posts |
 * | `decor/ams/pontoon` | 1 | top-left (placed 1 px under the walking line) | the steel pontoon of the tour-boat jetty (128 × 9) |
 * | `decor/ams/low-bridge` | 1 | the walkway centre (32, 0) | a low brick bridge's near face: sandstone coping, brick, the stone beam with yellow-black clearance stripes (y 112–127) |
 * | `decor/ams/low-bridge/back` | 1 | the walkway centre (34, 28) | its railing and lamp over the walkway, the dark arch under it and the piers into the water |
 * | `decor/ams/magere-brug` | 4: closed → open | the walkway centre (64, 82) | the Magere Brug's bascule leaves (white wood, railing with lights) and the balance beams over them, lifting |
 * | `decor/ams/magere-brug/back` | 1 | the walkway centre (64, 72) | the two white portals with their light bulbs, standing in the river |
 * | `decor/ams/carre` | 1 | feet | Royal Theatre Carré on the far bank (painted) |
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { applyLight } from './art';
import { CRUISE, LOW_BRIDGE, MAGERE_BRUG } from './cruise';

const D = 'decor/ams/';

// =============================================================================================
// The cruise boat (196 × 48; the stern at x 1, the deck line at row 35)
// =============================================================================================

/** Boat geometry in frame px (the stern at x 1, the deck line at row 35, the roof at row 11). */
export const BOAT_ART = { w: 198, h: 48, ox: 1, oy: 35, roof: 11, cabin: [41, 169] as readonly [number, number] } as const;

/** The tourists seen through the cabin glass: x in the frame, hair / hat colour, skin. */
const TOURISTS: readonly (readonly [number, Color, Color])[] = [
  [52, PAL.gold[2], PAL.skinA[2]],
  [63, PAL.ink[1], PAL.skinC[2]],
  [76, PAL.red[2], PAL.skinB[2]],
  [88, PAL.brown[1], PAL.skinA[2]],
  [101, PAL.sand[3], PAL.skinB[3]],
  [113, PAL.sky[1], PAL.skinC[2]],
  [126, PAL.ink[1], PAL.skinA[3]],
  [138, PAL.pink[1], PAL.skinB[2]],
];

function cruiseBoat(frame: number): Frame {
  const { w, h, ox, oy, roof } = BOAT_ART;
  const b = new PixelBuffer(w, h);
  const [c0, c1] = BOAT_ART.cabin;
  const deck = oy;
  const L = ox;
  const R = ox + CRUISE.len;
  // --- the hull: navy, a raked bow, a round stern; a red boot-top at the waterline (row deck + 4).
  b.poly([[L + 1, deck], [R - 6, deck], [R, deck + 2], [R - 4, deck + 9], [L + 6, deck + 9], [L, deck + 4]], PAL.navy[1]);
  b.hline(L + 2, R - 5, deck + 1, PAL.navy[2]);
  b.hline(L + 3, R - 4, deck + 4, PAL.red[1]);
  b.hline(L + 4, R - 5, deck + 5, PAL.red[0]);
  b.hline(L + 6, R - 6, deck + 8, PAL.navy[0]);
  // The white rubbing strake along the deck edge.
  b.hline(L, R - 4, deck, PAL.snow[3]);
  b.hline(L + 1, R - 5, deck + 1, PAL.snow[1]);
  // --- the open aft deck: a railing with posts, a lifebuoy, the flag on the stern pole.
  b.hline(L + 2, c0 - 2, deck - 8, PAL.steel[4]);
  for (let x = L + 2; x < c0 - 1; x += 7) b.vline(x, deck - 8, deck - 1, PAL.steel[3]);
  b.hline(L + 2, c0 - 2, deck - 4, PAL.steel[2]);
  b.circle(L + 14, deck - 4, 3, PAL.red[2]);
  b.circle(L + 14, deck - 4, 1, PAL.navy[1]);
  b.set(L + 12, deck - 6, PAL.snow[3]);
  b.set(L + 16, deck - 2, PAL.snow[3]);
  b.vline(L + 3, roof - 10, deck - 9, PAL.steel[3]);
  b.rect(L + 4, roof - 10, 7, 2, PAL.red[2]);
  b.rect(L + 4, roof - 8, 7, 2, PAL.snow[3]);
  b.rect(L + 4, roof - 6, 7, 2, PAL.sky[0]);
  // --- the cabin: a white lower band, glass sides with posts, the curved glass roof.
  b.rect(c0, deck - 6, c1 - c0, 6, PAL.snow[2]);
  b.hline(c0, c1 - 1, deck - 6, PAL.snow[3]);
  b.hline(c0 + 2, c1 - 3, deck - 3, PAL.gold[2]);
  b.rect(c0 + 1, roof + 2, c1 - c0 - 2, deck - 8 - roof, PAL.sky[1]);
  for (let y = roof + 2; y < deck - 6; y++) {
    // The glass reflects the sky: lighter high up, a low dark band.
    const c = y < roof + 6 ? PAL.sky[2] : y > deck - 10 ? PAL.navy[1] : PAL.sky[1];
    b.hline(c0 + 1, c1 - 2, y, c);
  }
  // Tourists behind the glass (heads, a camera now and then).
  for (const [x, hair, skin] of TOURISTS) {
    b.rect(x, roof + 8, 4, 4, skin);
    b.rect(x, roof + 7, 4, 2, hair);
    b.rect(x - 1, roof + 12, 6, deck - 8 - roof - 12, PAL.sky[0]);
    if ((x & 3) === 0) b.rect(x + 3, roof + 10, 3, 2, PAL.ink[1]);
  }
  // Diagonal sheen across the glass.
  for (let k = 0; k < 3; k++) for (let y = roof + 3; y < deck - 8; y++) b.set(c0 + 30 + k * 44 + (y - roof), y, PAL.sky[3]);
  for (let x = c0; x < c1; x += 16) b.vline(x, roof + 1, deck - 6, PAL.snow[1]);
  // The wheelhouse window at the front: the skipper in his cap.
  b.rect(c1 - 16, roof + 3, 13, deck - 10 - roof, PAL.navy[0]);
  b.rect(c1 - 11, roof + 8, 4, 4, PAL.skinA[2]);
  b.rect(c1 - 12, roof + 6, 6, 2, PAL.navy[2]);
  b.hline(c1 - 13, c1 - 6, roof + 7, PAL.snow[3]);
  // The roof: a white frame line, the glass panes between the ribs, rounded ends.
  b.hline(c0 + 2, c1 - 3, roof, PAL.snow[3]);
  b.hline(c0 + 1, c1 - 2, roof + 1, PAL.snow[2]);
  b.set(c0, roof + 1, PAL.snow[2]);
  b.set(c1 - 1, roof + 1, PAL.snow[2]);
  for (let x = c0 + 8; x < c1 - 4; x += 16) b.set(x, roof, PAL.steel[3]);
  // --- the bow: a short railing and a fender.
  b.line(c1 + 2, deck - 6, R - 7, deck - 4, PAL.steel[4]);
  for (const x of [c1 + 4, c1 + 11, R - 9]) b.vline(x, deck - 6, deck - 1, PAL.steel[3]);
  b.circle(R - 2, deck + 1, 1, PAL.ink[1]);
  b.outline(INK);
  // The wake after the outline: ripples at rest, foam while sailing (two frames).
  const wl = deck + 5;
  if (frame === 0) {
    for (let x = L + 8; x < R - 8; x += 12) b.hline(x, x + 4, wl + 3, PAL.sky[2]);
  } else {
    const k = frame - 1;
    b.hline(R - 2 + k, R + 2 + k, wl - 1, PAL.snow[3]);
    b.hline(R - 6, R + 1 - k, wl, PAL.snow[2]);
    for (let x = L - 1; x < L + 10 - k * 2; x += 2) b.set(x, wl + (x & 1), PAL.snow[3]);
    for (let x = L + 12 + k * 6; x < R - 10; x += 14) b.hline(x, x + 5, wl + 2, PAL.snow[1]);
  }
  return { buf: b, ox, oy };
}

defineSprite(`${D}ams-cruise-boat`, () => [cruiseBoat(0), cruiseBoat(1), cruiseBoat(2)], { ticksPerFrame: 16 });

// =============================================================================================
// Route signs (BRUG ↑, RONDVAART ↓, WATERLOOPLEIN)
// =============================================================================================

export const ROUTE_SIGNS: readonly string[] = ['BRUG ↑', 'RONDVAART ↓', 'WATERLOOPLEIN'];
/** Board height, post height under it. */
export const SIGN_BOARD_H = 12;
export const SIGN_POST_H = 22;

/** Board width of a sign text. */
export function signBoardW(text: string): number {
  return measure(text) + 8;
}

function routeSign(text: string): Frame {
  const bw = signBoardW(text);
  const W = bw + 2;
  const H = SIGN_BOARD_H + SIGN_POST_H + 2;
  const b = new PixelBuffer(W, H);
  const two = bw > 60;
  const posts = two ? [6, W - 9] : [(W >> 1) - 1];
  for (const x of posts) {
    b.rect(x, SIGN_BOARD_H, 3, SIGN_POST_H + 1, PAL.steel[1]);
    b.vline(x, SIGN_BOARD_H, H - 2, PAL.steel[3]);
    b.rect(x - 1, H - 3, 5, 2, PAL.steel[0]);
  }
  b.rect(1, 1, bw, SIGN_BOARD_H, PAL.navy[1]);
  b.strokeRect(1, 1, bw, SIGN_BOARD_H, PAL.snow[2]);
  b.hline(2, bw - 1, 2, PAL.sky[0]);
  drawText(b, text, 5, 3, { font: 'small', color: PAL.sand[3] });
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: H - 1 };
}

defineSprite(`${D}route-sign`, () => ROUTE_SIGNS.map(routeSign));

// =============================================================================================
// The tour-boat pontoon (128 × 9)
// =============================================================================================

function pontoon(): Frame {
  const W = 128;
  const b = new PixelBuffer(W, 9);
  b.rect(0, 0, W, 2, PAL.brown[2]);
  for (let x = 0; x < W; x += 9) b.set(x, 0, PAL.brown[1]);
  b.hline(0, W - 1, 0, PAL.brown[3]);
  b.rect(0, 2, W, 5, PAL.slate[1]);
  b.hline(0, W - 1, 2, PAL.slate[3]);
  for (let x = 4; x < W; x += 16) {
    b.set(x, 4, PAL.steel[3]);
    b.rect(x + 6, 3, 3, 4, PAL.ink[1]);
  }
  b.rect(0, 7, W, 2, PAL.navy[0]);
  return { buf: b, ox: 0, oy: 0 };
}

defineSprite(`${D}pontoon`, () => [pontoon()]);

// =============================================================================================
// Low bridges (front face and back)
// =============================================================================================

const BRICK: Ramp = [PAL.red[0], PAL.rust[1], PAL.rust[2], PAL.orange[1]];
const STONE: Ramp = [PAL.stone[0], PAL.stone[1], PAL.sand[2], PAL.sand[3]];

/** Brick courses (2 px) with staggered joints over a rect. */
function bricks(b: PixelBuffer, x0: number, y0: number, w: number, h: number, ramp: Ramp = BRICK): void {
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 2);
    for (let x = x0; x < x0 + w; x++) {
      const joint = (y - y0) % 2 === 1 || (x - x0 + (row & 1) * 3) % 6 === 0;
      b.set(x, y, joint ? ramp[0] : (x * 7 + row * 5) % 11 === 0 ? ramp[3] : ramp[2]);
    }
  }
}

/** The near face of a low bridge: 64 × 17, the walkway line at row 1. */
export const LOW_FACE = { w: LOW_BRIDGE.w + 8, h: LOW_BRIDGE.under - LOW_BRIDGE.top + 2, ox: (LOW_BRIDGE.w + 8) / 2, oy: 1 } as const;

function lowBridgeFace(): Frame {
  const { w, h, ox, oy } = LOW_FACE;
  const b = new PixelBuffer(w, h);
  const under = oy + LOW_BRIDGE.under - LOW_BRIDGE.top;
  // Sandstone coping, then brick, then the stone beam with the clearance stripes.
  b.rect(1, oy, w - 2, 2, STONE[2]);
  b.hline(1, w - 2, oy, STONE[3]);
  bricks(b, 3, oy + 2, w - 6, under - oy - 6);
  b.rect(3, under - 4, w - 6, 4, STONE[1]);
  for (let x = 4; x < w - 4; x++) b.set(x, under - 4, STONE[2]);
  for (let x = 6; x < w - 6; x++) {
    const s = Math.floor((x + 1) / 3) & 1;
    b.set(x, under - 3, s ? PAL.gold[2] : PAL.ink[1]);
    b.set(x, under - 2, s ? PAL.gold[2] : PAL.ink[1]);
  }
  // The bridge number on a white enamel plate.
  b.rect((w >> 1) - 5, oy + 3, 10, 5, PAL.snow[3]);
  b.hline((w >> 1) - 3, (w >> 1) + 2, oy + 5, PAL.sky[0]);
  b.outline(INK);
  return { buf: b, ox, oy };
}

/** The back of a low bridge: 68 × 116, the walkway at row 28. */
export const LOW_BACK = { w: LOW_BRIDGE.w + 12, h: 116, ox: (LOW_BRIDGE.w + 12) / 2, oy: 28 } as const;

function lowBridgeBack(): Frame {
  const { w, h, ox, oy } = LOW_BACK;
  const b = new PixelBuffer(w, h);
  const under = oy + LOW_BRIDGE.under - LOW_BRIDGE.top;
  const water = oy + 180 - LOW_BRIDGE.top;
  // The dark vault under the deck (the far side seen through), the piers into the water.
  b.rect(4, oy, w - 8, under - oy + 18, PAL.ink[1]);
  for (let y = under; y < under + 18; y++) b.hline(6, w - 7, y, y < under + 6 ? PAL.navy[0] : PAL.ink[1]);
  for (const x of [1, w - 7]) {
    bricks(b, x, oy, 6, water - oy + 10, [PAL.red[0], PAL.red[1], PAL.rust[1], PAL.rust[2]]);
    b.vline(x, oy, water + 9, PAL.rust[2]);
  }
  // The iron railing over the walkway and a lantern in the middle.
  b.hline(2, w - 3, oy - 9, PAL.ink[1]);
  b.hline(2, w - 3, oy - 5, PAL.steel[1]);
  for (let x = 3; x < w - 2; x += 5) b.vline(x, oy - 9, oy - 1, PAL.steel[1]);
  const cx = w >> 1;
  b.vline(cx, oy - 26, oy - 1, PAL.ink[1]);
  b.vline(cx + 1, oy - 26, oy - 1, PAL.steel[1]);
  b.poly([[cx - 3, oy - 27], [cx + 4, oy - 27], [cx + 3, oy - 21], [cx - 2, oy - 21]], PAL.gold[3]);
  b.hline(cx - 3, cx + 4, oy - 28, PAL.ink[1]);
  b.outline(INK);
  return { buf: b, ox, oy };
}

defineSprite(`${D}low-bridge`, () => [lowBridgeFace()]);
defineSprite(`${D}low-bridge/back`, () => [lowBridgeBack()]);

// =============================================================================================
// The Magere Brug
// =============================================================================================

/** The bascule frames (leaves and balance beams): 128 × 104, the walkway at row 82. */
export const MAGERE_LEAVES = { w: 128, h: 104, ox: 64, oy: 82 } as const;
/** The portals: 128 × 156, the walkway at row 72. */
export const MAGERE_BACK = { w: 128, h: 156, ox: 64, oy: 72 } as const;
/** Leaf angles per frame (degrees up). */
export const MAGERE_ANGLES: readonly number[] = [0, 26, 54, 80];
/** The portals' top beam (row of the back frame) and the posts' x (frame px, both sides). */
export const MAGERE_PORTAL = { top: 72 - (MAGERE_BRUG.top - 50), posts: [3, 10, 115, 122] as readonly number[] } as const;

const WHITE: Ramp = [PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]];

function magereBack(): Frame {
  const { w, h, oy } = MAGERE_BACK;
  const b = new PixelBuffer(w, h);
  const top = MAGERE_PORTAL.top;
  const water = oy + 180 - MAGERE_BRUG.top;
  // Stone piers in the water under each portal.
  for (const x of [1, w - 15]) {
    b.rect(x, oy + 12, 14, water - oy - 2, PAL.stone[1]);
    b.vline(x, oy + 12, water + 9, PAL.stone[2]);
    for (let y = oy + 15; y < water + 9; y += 4) b.hline(x + 1, x + 12, y, PAL.stone[0]);
  }
  // Each portal: two white posts, the cross beams, a diagonal brace, the bulbs.
  for (const side of [0, 1]) {
    const x0 = side === 0 ? MAGERE_PORTAL.posts[0] : MAGERE_PORTAL.posts[2];
    for (const x of [x0, x0 + 7]) {
      b.rect(x, top, 3, oy + 13 - top, WHITE[2]);
      b.vline(x, top, oy + 12, WHITE[3]);
      b.vline(x + 2, top, oy + 12, WHITE[1]);
    }
    b.rect(x0 - 2, top, 14, 3, WHITE[2]);
    b.hline(x0 - 2, x0 + 11, top, WHITE[3]);
    b.rect(x0 - 1, oy - 10, 12, 2, WHITE[1]);
    b.line(x0 + 2, top + 4, x0 + 8, oy - 11, WHITE[1]);
    b.line(x0 + 8, top + 4, x0 + 2, oy - 11, WHITE[1]);
    for (let y = top + 6; y < oy; y += 6) {
      b.set(x0 - 1, y, PAL.gold[3]);
      b.set(x0 + 11, y, PAL.gold[3]);
    }
    for (let x = x0 - 1; x < x0 + 12; x += 3) b.set(x, top - 1, PAL.gold[3]);
  }
  b.outline(INK);
  return { buf: b, ox: MAGERE_BACK.ox, oy };
}

/**
 * One bascule frame: the two leaves lifted by `deg`, the balance beams and the rods. The same
 * design as the 2× / 4× drawer (art-hd-route-bridges.ts `magereLeavesHd`): a deep white girder
 * (lit top moulding, shaded lower edge, a bolt row), the plank deck on top, the lattice railing
 * with its bulbs, the balance beam with bulbs and the iron rods.
 */
function magereLeaves(deg: number): Frame {
  const { w, h, ox, oy } = MAGERE_LEAVES;
  const b = new PixelBuffer(w, h);
  const a = (deg * Math.PI) / 180;
  const half = MAGERE_BRUG.gap / 2;
  const thick = MAGERE_BRUG.under - MAGERE_BRUG.top;
  const beamY = oy - (MAGERE_BRUG.top - 50) + 3;
  for (const s of [-1, 1]) {
    // The leaf pivots at its outer end (the portal), its tip at the middle.
    const px = ox + s * half;
    const py = oy + thick / 2;
    const len = half;
    const ux = -s * Math.cos(a);
    const uy = -Math.sin(a);
    // "Up" from the deck: perpendicular to the leaf, away from the water.
    const upx = s < 0 ? uy : -uy;
    const upy = s < 0 ? -ux : ux;
    const at = (k: number, hh: number): [number, number] => [px + ux * len * k + upx * hh, py + uy * len * k + upy * hh];
    const quad = (k0: number, k1: number, h0: number, h1: number): [number, number][] => [at(k0, h0), at(k1, h0), at(k1, h1), at(k0, h1)];
    const seg = (k0: number, h0: number, k1: number, h1: number, c: Color): void => {
      const [x0, y0] = at(k0, h0);
      const [x1, y1] = at(k1, h1);
      b.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), c);
    };
    // The girder: white, its lower edge in shade, a moulding under the deck, a row of bolts.
    b.poly(quad(0, 1, -thick / 2, thick / 2 - 2), WHITE[2]);
    seg(0, -thick / 2 + 1, 1, -thick / 2 + 1, WHITE[0]);
    seg(0, -thick / 2 + 2, 1, -thick / 2 + 2, WHITE[1]);
    seg(0, thick / 2 - 4, 1, thick / 2 - 4, WHITE[1]);
    seg(0, thick / 2 - 3, 1, thick / 2 - 3, WHITE[3]);
    for (let k = 0.06; k < 1; k += 0.12) {
      const [bx, by] = at(k, 1);
      b.set(Math.round(bx), Math.round(by), WHITE[0]);
    }
    // The plank deck on top (edge-on), plank joints every few px.
    b.poly(quad(0, 1, thick / 2 - 2, thick / 2), PAL.brown[2]);
    seg(0, thick / 2, 1, thick / 2, PAL.brown[3]);
    for (let k = 0.08; k < 1; k += 0.1) {
      const [jx, jy] = at(k, thick / 2 - 1);
      b.set(Math.round(jx), Math.round(jy), PAL.brown[1]);
    }
    // The lattice railing: posts with bulbs, the handrail, the crossed diagonals.
    const rail = 7;
    for (let k = 0.04; k <= 1.0001; k += 0.19) {
      seg(k, thick / 2 + 1, k, thick / 2 + rail, WHITE[3]);
      if (k + 0.19 <= 1.0001) {
        seg(k, thick / 2 + 1, k + 0.19, thick / 2 + rail, WHITE[1]);
        seg(k, thick / 2 + rail, k + 0.19, thick / 2 + 1, WHITE[1]);
      }
    }
    seg(0.04, thick / 2 + rail, 1, thick / 2 + rail, WHITE[3]);
    for (let k = 0.04; k <= 1.0001; k += 0.19) {
      const [lx, ly] = at(k, thick / 2 + rail + 1);
      b.set(Math.round(lx), Math.round(ly), PAL.gold[3]);
    }
    // The balance beam over the portal: it tilts with the leaf (the inner end rises).
    const bx0 = ox + s * (half + 8);
    const bx1 = ox + s * 8;
    const by0 = beamY + Math.sin(a) * 6;
    const by1 = beamY - Math.sin(a) * 18;
    b.thickLine(bx0, by0, bx1, by1, 3, WHITE[2]);
    b.line(Math.round(bx0), Math.round(by0 - 1), Math.round(bx1), Math.round(by1 - 1), WHITE[3]);
    b.line(Math.round(bx0), Math.round(by0 + 1), Math.round(bx1), Math.round(by1 + 1), WHITE[1]);
    for (let k = 0.1; k < 1; k += 0.18) b.set(Math.round(bx0 + (bx1 - bx0) * k), Math.round(by0 + (by1 - by0) * k) - 2, PAL.gold[3]);
    // The iron rods from the beam's inner end down to the leaf tip.
    const [tx, ty] = at(1, thick / 2);
    b.line(Math.round(bx1), Math.round(by1 + 1), Math.round(tx), Math.round(ty), PAL.steel[1]);
    b.line(Math.round(bx1 - s), Math.round(by1 + 1), Math.round(tx - s * Math.cos(a)), Math.round(ty), PAL.steel[1]);
  }
  b.outline(INK);
  return { buf: b, ox, oy };
}

defineSprite(`${D}magere-brug/back`, () => [magereBack()]);
defineSprite(`${D}magere-brug`, () => MAGERE_ANGLES.map(magereLeaves));

// =============================================================================================
// Carré (painted, far across the river)
// =============================================================================================

export const CARRE = { w: 176, h: 84 } as const;

function carre(): Frame {
  const { w, h } = CARRE;
  const b = new PixelBuffer(w, h);
  const plaster: Ramp = [PAL.stone[2], PAL.sand[2], PAL.sand[3], PAL.snow[2]];
  const roof: Ramp = [PAL.slate[0], PAL.slate[1], PAL.slate[2], PAL.slate[3]];
  // The wings: two storeys of arched windows over an arcade.
  b.rect(0, 30, w, h - 30, plaster[1]);
  b.hline(0, w - 1, 30, plaster[3]);
  b.rect(0, 24, w, 6, roof[1]);
  b.hline(0, w - 1, 24, roof[3]);
  // The centre block: taller, with the curved pediment and the name.
  const c0 = 58;
  const c1 = 118;
  b.rect(c0, 12, c1 - c0, h - 12, plaster[2]);
  b.rect(c0 + 4, 4, c1 - c0 - 8, 10, plaster[2]);
  for (let x = c0 + 4; x < c1 - 4; x++) {
    const t = (x - c0 - 4) / (c1 - c0 - 8);
    const y = 4 - Math.round(Math.sin(t * Math.PI) * 4);
    b.vline(x, y, 6, plaster[3]);
  }
  b.rect(c0 + 12, 16, c1 - c0 - 24, 7, plaster[1]);
  drawText(b, 'CARRE', c0 + 15, 16, { font: 'small', color: PAL.gold[1] });
  b.set(c0 + 15 + measure('CARR') + 2, 15, PAL.gold[1]);
  // The corner turrets with small domes.
  for (const x of [2, w - 12, c0 - 2, c1 - 8]) {
    // The dome behind the turret's top: only its upper half shows.
    b.circle(x + 5, 18, 4, roof[2]);
    b.hline(x + 3, x + 5, 15, roof[3]);
    b.rect(x, 18, 10, 12, plaster[2]);
    b.hline(x, x + 9, 18, plaster[3]);
    b.set(x + 5, 13, PAL.gold[2]);
  }
  // Windows: arched, dark with a warm reflection of the low sun.
  for (let x = 6; x < w - 6; x += 9) {
    if (x > c0 - 4 && x < c1) continue;
    for (const y of [36, 54]) {
      b.rect(x, y, 5, 9, PAL.navy[1]);
      b.hline(x + 1, x + 3, y - 1, PAL.navy[1]);
      b.set(x + 1, y + 2, PAL.gold[2]);
      b.hline(x, x + 4, y + 9, plaster[3]);
    }
  }
  // The centre: three tall arched windows and the entrance arcade.
  for (let k = 0; k < 3; k++) {
    const x = c0 + 10 + k * 15;
    b.rect(x, 28, 9, 20, PAL.navy[1]);
    b.hline(x + 1, x + 7, 27, PAL.navy[1]);
    b.hline(x + 2, x + 6, 26, PAL.navy[1]);
    b.vline(x + 4, 28, 47, plaster[2]);
    b.set(x + 2, 31, PAL.gold[3]);
  }
  // The ground-floor arcade and the quay under it.
  for (let x = 3; x < w - 3; x += 8) {
    b.rect(x, 70, 6, 13, PAL.ink[1]);
    b.hline(x + 1, x + 4, 69, PAL.ink[1]);
  }
  b.hline(0, w - 1, 68, plaster[3]);
  b.rect(0, h - 1, w, 1, plaster[0]);
  // The statues of clowns and acrobats on the roofline (small silhouettes).
  for (const x of [c0 + 6, c0 + 20, c1 - 22, c1 - 8]) {
    b.rect(x, 0, 2, 4, plaster[3]);
    b.set(x, 0, PAL.red[2]);
  }
  applyLight(b, 'golden');
  return { buf: b, ox: w >> 1, oy: h };
}

defineSprite(`${D}carre`, () => [carre()]);

/** Every id of this file (tests, HD twins). */
export const ROUTE_ART_IDS: readonly string[] = [
  `${D}ams-cruise-boat`,
  `${D}route-sign`,
  `${D}pontoon`,
  `${D}low-bridge`,
  `${D}low-bridge/back`,
  `${D}magere-brug`,
  `${D}magere-brug/back`,
  `${D}carre`,
];
