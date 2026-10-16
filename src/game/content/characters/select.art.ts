/**
 * The squad's select portraits (docs/design/squad.md §2.2): for each friend a large caricature
 * bust `char/<id>/select` (64 × 120, 2×: 128 × 240, top-left anchor), its greyed twin
 * `char/<id>/select-grey` (the same pixels through the steel / stone grey ramp) and the small menu
 * portrait `char/<id>/portrait` (32 × 32, 2×: 64 × 64) drawn from the same face (a zoomed-out view).
 *
 * Kind arcade caricatures of five private persons at the user's request, built by code from
 * shapes and the palette (src/game/art/portrait-kit.ts); studied from the user's photos, never
 * traced, sampled or pixel-copied (docs/ORIGINALITY.md). Each face is recognisable by its
 * signature traits:
 * - vincent: one raised eyebrow, lopsided smirk, squint, forehead lines, heavy dark stubble,
 *   brown tweed jacket and a thin dark-red tie.
 * - thom: navy cap worn backwards, huge toothy grin, happy squint with crow's feet, rosy cheeks,
 *   olive t-shirt.
 * - dirk: messy spiky brown hair, thick brown mustache, round rosy face, hi-vis vest.
 * - bob: tousled swept-up brown hair, blue eyes, pale skin, calm half-smile, navy t-shirt and a
 *   green cape knot with a leaf clasp.
 * - patrick: slick swept-back black hair with short sides, strong dark brows, trimmed mustache,
 *   strong jaw, confident smile, black polo.
 */
import { INK, PAL, type Ramp } from '../../../engine/palette';
import type { PixelBuffer } from '../../../engine/pixel';
import { defineSprite } from '../../../engine/sprites';
import {
  backdrop,
  beardRegion,
  brow,
  cloth,
  ears,
  ell,
  ellLight,
  eye,
  fadeBottom,
  frameBorder,
  gauss,
  greyed,
  hair,
  HAIR_BLACK,
  HAIR_BLOND,
  HAIR_BROWN,
  HAIR_DARK,
  Head,
  inPoly,
  IRIS_BLUE,
  IRIS_BROWN,
  lineDist,
  mouthLine,
  neck,
  nostrils,
  Painter,
  type Pt,
  quad,
  shoulderMask,
  SKIN_FAIR,
  SKIN_PALE,
  SKIN_RUDDY,
  SKIN_TAN,
  smoothstep,
  strands,
  stubble,
  tone,
  type View,
} from '../../art/portrait-kit';

/** The squad in roster order. */
export const SQUAD = ['vincent', 'thom', 'dirk', 'bob', 'patrick'] as const;
export type SquadId = (typeof SQUAD)[number];

/** Select portrait size (logical px). */
export const SELECT_W = 64;
export const SELECT_H = 120;
/** Menu portrait size (logical px) and the part of the bust it shows (portrait units). */
export const SMALL = 32;
const SMALL_SPAN = 72;
const smallView = (y0: number): View => ({ x0: 32 - SMALL_SPAN / 2, y0, scale: SMALL / SMALL_SPAN });
const SMALL_VIEW: Readonly<Record<SquadId, View>> = {
  vincent: smallView(14),
  thom: smallView(6),
  dirk: smallView(11),
  bob: smallView(11),
  patrick: smallView(12),
};

/**
 * The small portrait's panel: only the colours heads.ts strips (navy / purple). The faces never
 * use these colours (the cap, the tee and the blue iris use ink / steel / sky), so the high-score
 * head icon keeps every face pixel.
 */
const SMALL_BG: Ramp = [PAL.navy[0], PAL.navy[1], PAL.purple[0]];

const STUBBLE_DARK: Ramp = [INK, PAL.ink[1], PAL.brown[0], PAL.stone[0], PAL.stone[1]];
const STUBBLE_BROWN: Ramp = [INK, PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.stone[2]];
const STUBBLE_BLACK: Ramp = [INK, PAL.ink[1], PAL.hairA[2], PAL.stone[0], PAL.stone[1]];
const TEETH: Ramp = [PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.snow[1], PAL.snow[3]];
const SHIRT_WHITE: Ramp = [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.snow[1]];
const TWEED: Ramp = [INK, PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.sand[1]];
const TIE: Ramp = [INK, PAL.red[0], PAL.red[1], PAL.red[2]];
const OLIVE: Ramp = [INK, PAL.olive[0], PAL.olive[1], PAL.olive[2], PAL.olive[3]];
const CAP: Ramp = [INK, PAL.ink[1], PAL.steel[0], PAL.sky[0], PAL.sky[1]];
const HIVIS: Ramp = [PAL.brown[0], PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]];
const REFLECT: Ramp = [PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[3]];
const DARK_SHIRT: Ramp = [INK, PAL.ink[1], PAL.steel[0], PAL.steel[1], PAL.steel[2]];
const NAVY_TEE: Ramp = [INK, PAL.ink[1], PAL.steel[0], PAL.steel[1], PAL.sky[0]];
const CAPE: Ramp = [INK, PAL.olive[0], PAL.green[1], PAL.green[2], PAL.green[3]];
const POLO: Ramp = [INK, PAL.ink[1], PAL.steel[0], PAL.hairA[2], PAL.steel[1]];

// ---------------------------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------------------------

/** Background: the select panel's dark blue (or the small portrait's navy panel). */
function bg(p: Painter, gx: number, gy: number): void {
  backdrop(p, gx, gy, p.b.w === SMALL * p.d ? SMALL_BG : undefined);
}

/** Stroke a crease across the skin (a darker line with a lit edge under it). */
function crease(p: Painter, hd: Head, pts: ReadonlyArray<Pt>, w = 0.6, depth = 0.28): void {
  p.stroke(
    pts.map(([x, y]) => [x, y + w * 0.8] as Pt),
    w * 0.9,
    w * 0.9,
    (_t, x, y, X, Y) => hd.skin(x, y, X, Y, 0.08),
  );
  p.stroke(pts, w, w * 0.7, (_t, x, y, X, Y) => hd.skin(x, y, X, Y, -depth));
}

/** Nasolabial folds from the nose wings towards the mouth corners. */
function smileFolds(p: Painter, hd: Head, spread: number, drop: number, depth = 0.25): void {
  const { cx, noseY } = hd.s;
  for (const side of [-1, 1]) {
    crease(
      p,
      hd,
      quad([cx + side * 3.4, noseY - 0.8], [cx + side * (spread + 1.5), noseY + drop * 0.35], [cx + side * spread, noseY + drop]),
      0.65,
      depth * (side > 0 ? 1.15 : 1),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// VINCENT — the consultant
// ---------------------------------------------------------------------------------------------

function vincent(p: Painter): void {
  const cx = 32;
  bg(p, 22, 40);
  const hd = new Head({
    cx,
    top: 13,
    cheekY: 45,
    rx: 22,
    jawY: 68,
    jawW: 15.5,
    chinY: 87,
    chinW: 6,
    eyeY: 47,
    eyeDX: 9.5,
    noseY: 61,
    mouthY: 72,
    skin: SKIN_FAIR,
    nose: 4.6,
    hollow: 1.4,
    cheek: 1.8,
    bumps: [
      // The raised brow lifts the forehead on the right; the smirk bunches the right cheek.
      { x: cx + 9, y: 37, sx: 5, sy: 3, a: 0.9 },
      { x: cx + 9, y: 68, sx: 3, sy: 2.5, a: 1.1 },
    ],
  });
  // Body: tweed jacket, white shirt, thin dark-red tie.
  const body = shoulderMask(cx, 90, 38);
  cloth(p, body, TWEED, cx - 14, 112, 30, 24, {
    grain: (x, y) => {
      const band = Math.floor((x + 40) / 2.2) & 1;
      return (strands(x, y, band ? 1.0 : -1.0, 1.6, 0.45, 41) - 0.5) * 0.3;
    },
  });
  const vee = (x: number, y: number): boolean => y > 90 && Math.abs(x - cx) < (y - 90) * 0.42 + 3;
  p.paint((x, y, X, Y) => (vee(x, y) && body(x, y) ? tone(SHIRT_WHITE, 0.85 - (x > cx ? 0.3 : 0) - smoothstep(100, 120, y) * 0.2, X, Y) : null));
  // Lapel edges.
  for (const side of [-1, 1]) {
    p.stroke(
      [
        [cx + side * 3.5, 91],
        [cx + side * 12, 111],
        [cx + side * 14, 121],
      ],
      1,
      1,
      side < 0 ? PAL.brown[3] : INK,
    );
  }
  neck(p, hd, 8.5, 96);
  // Shirt collar points.
  for (const side of [-1, 1]) {
    const pts: Pt[] = [
      [cx + side * 9, 88],
      [cx + side * 1, 97],
      [cx + side * 6.5, 99],
      [cx + side * 10.5, 93],
    ];
    p.paint((x, y, X, Y) => (inPoly(x, y, pts) ? tone(SHIRT_WHITE, side < 0 ? 0.95 : 0.5, X, Y) : null));
  }
  // The tie: a small knot and a thin blade.
  p.paint((x, y, X, Y) => {
    const knot = ell(x, y, cx, 97.5, 2.2, 2) < 1;
    const blade = y > 98 && y < 121 && Math.abs(x - cx - (y - 98) * 0.04) < 1.3 + (y - 98) * 0.06;
    if (!knot && !blade) return null;
    return tone(TIE, 0.75 - (x > cx ? 0.3 : 0) - (knot ? 0 : 0.1), X, Y);
  });
  ears(p, hd, 45, 59, 5);
  hd.paintFace(p, (x, y) => -0.12 * gauss(x, y, cx + 14, 55, 6, 10));
  // Forehead lines: deep, lifted on the raised-brow side.
  for (let i = 0; i < 3; i++) {
    const y0 = 28 + i * 3.4;
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) {
      const x = cx - 11 + (k * 23) / 12;
      pts.push([x, y0 + Math.sin(k * 0.9 + i) * 0.5 - smoothstep(cx - 2, cx + 10, x) * (2.6 - i * 0.6)]);
    }
    crease(p, hd, pts, 0.7, 0.24);
  }
  // Heavy dark stubble.
  stubble(p, hd, 0.9, STUBBLE_DARK, beardRegion(hd, { top: -1, mouthW: 9, lipGap: 2.2 }), 5);
  // Eyes: the left one squinted under the lowered brow, the right one wide under the raised one.
  eye(p, hd, { x: cx - 9.5, y: 48, w: 8.5, open: 1.5, kind: 'squint', side: -1, iris: IRIS_BROWN, look: 1, tilt: -0.6 });
  eye(p, hd, { x: cx + 9.5, y: 47, w: 8.5, open: 3.4, kind: 'open', side: 1, iris: IRIS_BROWN, look: 0.2, tilt: 0.2 });
  // Brows: one lowered and straight, one raised in a high arch.
  brow(p, quad([cx - 2.5, 45], [cx - 9, 43], [cx - 16.5, 42.5]), 3, 1.8, HAIR_DARK, 0.5, 3);
  brow(p, quad([cx + 2.5, 41], [cx + 7, 28.5], [cx + 17, 37]), 3, 1.6, HAIR_DARK, 0.4, 4);
  // Frown crease between the brows.
  crease(p, hd, [
    [cx - 1.5, 44],
    [cx - 0.8, 40.5],
  ], 0.5, 0.3);
  nostrils(p, hd, 2.4);
  smileFolds(p, hd, 8.5, 9.5, 0.2);
  // The lopsided smirk: the right corner pulled up hard, a dimple there.
  mouthLine(p, hd, [cx - 6.5, 73], [cx + 0.5, 73.4], [cx + 8, 68.6], { w: 1.2, lip: 1.2, col: INK });
  crease(p, hd, quad([cx + 9, 66], [cx + 10.8, 68.8], [cx + 9.2, 71.5]), 0.7, 0.34);
  // Short dark-brown hair, cut close; the hairline with temples.
  const hairline = (x: number): number => {
    const ax = Math.abs(x - cx);
    return 22.5 + 3.5 * (ax / 22) ** 2 - 1.2 * gauss(x, 0, cx + 3, 0, 3, 1) + (ax > 18 ? (ax - 18) * 7 : 0);
  };
  const hairMask = (x: number, y: number): boolean => ell(x, y, cx, 34, 23.3, 22.5) < 1 && y < hairline(x) && y < 52;
  hd.occ = (x, y) => (hairMask(x, y) ? hd.h(x, y) + 2 : 0);
  hair(p, hairMask, HAIR_DARK, { cx: cx - 4, cy: 28, rx: 26, ry: 20, dir: (x) => -1.2 - (x - cx) * 0.02, len: 2.2, wid: 0.7, streak: 0.55, seed: 21, lift: 0.08 });
  fadeBottom(p, 100, 122);
}

// ---------------------------------------------------------------------------------------------
// THOM — little Napoleon
// ---------------------------------------------------------------------------------------------

function thom(p: Painter): void {
  const cx = 32;
  bg(p, 24, 38);
  const hd = new Head({
    cx,
    top: 13,
    cheekY: 52,
    rx: 24.5,
    jawY: 70,
    jawW: 19,
    chinY: 86,
    chinW: 8,
    eyeY: 47,
    eyeDX: 10,
    noseY: 59,
    mouthY: 69,
    skin: SKIN_FAIR,
    nose: 3.4,
    noseW: 2.6,
    cheek: 2.8,
    hollow: 0,
    muzzle: 1.2,
    exposure: 0.04,
    bumps: [
      // Round cheeks pushed up by the grin.
      { x: cx - 13, y: 58, sx: 4.5, sy: 3.5, a: 2.2 },
      { x: cx + 13, y: 58, sx: 4.5, sy: 3.5, a: 2.2 },
    ],
  });
  // Olive t-shirt with a crew collar.
  const body = shoulderMask(cx, 92, 38);
  cloth(p, body, OLIVE, cx - 14, 112, 30, 24, { grain: (x, y) => (strands(x, y, 1.4, 6, 1.2, 9) - 0.5) * 0.25 });
  neck(p, hd, 10, 100);
  p.paint((x, y, X, Y) => {
    const d = ell(x, y, cx, 94, 12.5, 7.5);
    if (d < 1 || d > 1.42 || y < 93) return null;
    return tone(OLIVE, 0.62 - (x > cx ? 0.3 : 0) - (d > 1.25 ? 0.25 : 0), X, Y);
  });
  ears(p, hd, 46, 60, 6);
  // Rosy cheeks.
  hd.paintFace(p, (x, y) => -0.13 * (gauss(x, y, cx - 13, 59, 4, 3) + gauss(x, y, cx + 13, 59, 4, 3)) - 0.06 * gauss(x, y, cx, 57.5, 2, 2));
  stubble(p, hd, 0.25, STUBBLE_BROWN, beardRegion(hd, { top: 4, mouthW: 12 }), 8);
  // Happy squint: ∩ lids, crow's feet.
  eye(p, hd, { x: cx - 10, y: 48, w: 8.5, open: 2.4, kind: 'happy', side: -1, iris: IRIS_BLUE, crow: 3 });
  eye(p, hd, { x: cx + 10, y: 48, w: 8.5, open: 2.4, kind: 'happy', side: 1, iris: IRIS_BLUE, crow: 3 });
  // Light brows, raised with joy.
  brow(p, quad([cx - 3.5, 42], [cx - 10, 38.5], [cx - 16, 41]), 2, 1.3, HAIR_BLOND, 0.55, 5);
  brow(p, quad([cx + 3.5, 42], [cx + 10, 38.5], [cx + 16, 41]), 2, 1.3, HAIR_BLOND, 0.35, 6);
  nostrils(p, hd, 2.7);
  smileFolds(p, hd, 12.5, 9, 0.3);
  // The huge toothy grin: a wide open D, a full row of upper teeth, the lower lip under it.
  const top = (x: number): number => 66.5 - 2.6 * ((x - cx) / 12) ** 2 * -1 - 0.6;
  const bot = (x: number): number => 66.5 + 8.4 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 12) ** 2));
  const inMouth = (x: number, y: number): boolean => Math.abs(x - cx) < 12 && y > top(x) && y < bot(x);
  p.paint((x, y, X, Y) => {
    if (!inMouth(x, y)) return null;
    const ax = Math.abs(x - cx);
    // Upper teeth: a band under the lip, gaps between the teeth.
    const teethBot = top(x) + 4.2 - (ax / 12) ** 2 * 2.2;
    if (y < teethBot) {
      const gap = Math.abs(((x - cx + 50) % 3.1) - 1.55) < 0.22 && y > top(x) + 0.8;
      const t = 0.9 - (x > cx ? 0.25 : 0) - (ax / 12) * 0.45 - smoothstep(teethBot - 1.2, teethBot, y) * 0.3 - (gap ? 0.45 : 0);
      return tone(TEETH, t, X, Y);
    }
    // Lower teeth peek in the bottom.
    if (y > bot(x) - 1.6 && ax < 7) return tone(TEETH, 0.45 - (x > cx ? 0.2 : 0), X, Y);
    // The dark mouth with a tongue.
    if (ell(x, y, cx + 1, bot(x) - 1.2, 6, 2.2) < 1) return tone([PAL.red[0], PAL.red[1], PAL.pink[0]], 0.5, X, Y);
    return y < teethBot + 1 ? INK : PAL.red[0];
  });
  // Lips round the grin.
  const lipTop: Pt[] = [];
  const lipBot: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const x = cx - 12.3 + (24.6 * i) / 16;
    lipTop.push([x, top(x) - 0.2]);
    lipBot.push([x, bot(x) + 0.5]);
  }
  p.stroke(lipTop, 1.1, 1.1, PAL.rust[1]);
  p.stroke(lipBot, 1.6, 1.6, (_t, x, y, X, Y) => hd.skin(x, y, X, Y, -0.02));
  p.stroke(lipBot.map(([x, y]) => [x, y - 0.6] as Pt), 0.6, 0.6, INK);
  // Short blond hair at the sides, the cap over the top (worn backwards).
  const capEdge = (x: number): number => 30.5 + 5 * ((x - cx) / 25) ** 2;
  const capMask = (x: number, y: number): boolean => ell(x, y, cx, 32, 25.8, 25) < 1 && y < capEdge(x);
  const sideHair = (x: number, y: number): boolean => {
    const ax = Math.abs(x - cx);
    return ax > 18.5 && ax < 25.6 && y > 28 && y < 47 - (ax - 19.5) * 0.6 && hd.inside(x - Math.sign(x - cx) * 1.5, y);
  };
  hair(p, sideHair, HAIR_BLOND, { cx: cx - 6, cy: 36, rx: 26, ry: 16, dir: () => 1.4, len: 1.2, wid: 0.6, streak: 0.5, seed: 31, lift: 0.1 });
  hd.occ = (x, y) => (capMask(x, y) ? hd.h(x, y) + 3 : 0);
  // The cap: six-panel dome, seams, a button on top, and the size opening at the front.
  p.paint((x, y, X, Y) => {
    // The peak points backwards: its far edge just shows over the crown.
    if (ell(x, y, cx + 3, 8.5, 19, 5.5) >= 1 || capMask(x, y)) return null;
    return tone(CAP, 0.35 - (y > 6 ? 0.2 : 0) - (x - cx) * 0.01, X, Y);
  });
  const opening = (x: number, y: number): boolean => ell(x, y, cx, 33, 7.5, 10) < 1;
  p.paint((x, y, X, Y) => {
    if (!capMask(x, y)) return null;
    if (opening(x, y)) {
      // Blond hair through the opening, the adjuster strap across it.
      if (Math.abs(y - 28.8) < 1.6 && Math.abs(x - cx) < 8) {
        // The snap strap: a lighter band with a row of studs.
        const stud = ell(((x - cx + 40) % 2.6) - 1.3, y - 28.8, 0, 0, 0.6, 0.6) < 1;
        return stud ? tone(REFLECT, x < cx ? 0.7 : 0.35, X, Y) : tone(CAP, 0.62 - (x > cx ? 0.25 : 0) - (y > 29.8 ? 0.15 : 0), X, Y);
      }
      return tone(HAIR_BLOND, 0.75 - ((x - cx) / 7) * 0.3 + (strands(x, y, 1.6, 1.2, 0.5, 33) - 0.5) * 0.5 - smoothstep(30, 24, y) * 0.5, X, Y, 0.3);
    }
    let t = ellLight(x, y, cx - 3, 22, 26, 20, 0.05) * 1.05;
    // Panel seams converge on the button.
    const a = Math.atan2(y - 6, x - cx);
    const seam = Math.abs(Math.sin(a * 3)) < 0.06;
    if (seam && y > 7) t -= 0.25;
    // The band round the bottom edge with its stitching.
    if (y > capEdge(x) - 3) t -= 0.18;
    if (Math.abs(y - (capEdge(x) - 1.6)) < 0.3 && Math.abs(((x + 30) % 1.5) - 0.75) < 0.45) t += 0.2;
    return tone(CAP, t, X, Y, 0.4);
  });
  // Edge of the opening (the binding).
  const rim: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI + (Math.PI * i) / 14;
    rim.push([cx + Math.cos(a) * 7.2, 33 + Math.sin(a) * 9.2]);
  }
  p.stroke(rim, 1, 1, (_t, x, _y, X, Y) => tone(CAP, x < cx ? 0.7 : 0.4, X, Y));
  p.paint((x, y, X, Y) => (ell(x, y, cx, 7.5, 2.2, 1.2) < 1 ? tone(CAP, 0.8, X, Y) : null));
  fadeBottom(p, 100, 122);
}

// ---------------------------------------------------------------------------------------------
// DIRK — the plumber
// ---------------------------------------------------------------------------------------------

function dirk(p: Painter): void {
  const cx = 32;
  bg(p, 22, 40);
  const hd = new Head({
    cx,
    top: 15,
    cheekY: 50,
    rx: 25,
    jawY: 70,
    jawW: 20.5,
    chinY: 86,
    chinW: 10,
    eyeY: 48,
    eyeDX: 10,
    noseY: 61,
    mouthY: 71,
    skin: SKIN_RUDDY,
    nose: 4.4,
    noseW: 3,
    cheek: 2.4,
    hollow: 0,
    chin: 2,
    bumps: [
      { x: cx - 13, y: 59, sx: 5, sy: 4, a: 1.4 },
      { x: cx + 13, y: 59, sx: 5, sy: 4, a: 1.4 },
    ],
  });
  // Dark work shirt, hi-vis vest with a reflective stripe.
  const body = shoulderMask(cx, 91, 38);
  cloth(p, body, DARK_SHIRT, cx - 14, 112, 30, 24);
  const vest = (x: number, y: number): boolean => body(x, y) && Math.abs(x - cx) > 6 + (y - 93) * 0.28;
  cloth(p, vest, HIVIS, cx - 14, 110, 30, 26, { lift: 0.15 });
  p.paint((x, y, X, Y) => (vest(x, y) && y > 107 && y < 112 ? tone(REFLECT, 0.85 - (x > cx ? 0.35 : 0), X, Y) : null));
  neck(p, hd, 10.5, 100);
  // Shirt collar.
  for (const side of [-1, 1]) {
    const pts: Pt[] = [
      [cx + side * 10.5, 90],
      [cx + side * 2, 98],
      [cx + side * 8, 101],
      [cx + side * 12.5, 95],
    ];
    p.paint((x, y, X, Y) => (inPoly(x, y, pts) ? tone(DARK_SHIRT, side < 0 ? 0.85 : 0.45, X, Y) : null));
  }
  ears(p, hd, 47, 61, 6);
  hd.paintFace(p, (x, y) => -0.14 * (gauss(x, y, cx - 13, 61, 4.5, 3.5) + gauss(x, y, cx + 13, 61, 4.5, 3.5) + 0.8 * gauss(x, y, cx, 59, 2.5, 2.5)));
  stubble(p, hd, 0.5, STUBBLE_BROWN, beardRegion(hd, { top: 1, mouthW: 9 }), 13);
  eye(p, hd, { x: cx - 10, y: 48.5, w: 7.5, open: 2.4, kind: 'open', side: -1, iris: IRIS_BROWN, look: 0.4, crow: 2 });
  eye(p, hd, { x: cx + 10, y: 48.5, w: 7.5, open: 2.4, kind: 'open', side: 1, iris: IRIS_BROWN, look: 0.4, crow: 2 });
  brow(p, quad([cx - 3, 43.5], [cx - 9, 41], [cx - 15.5, 43]), 2.4, 1.6, HAIR_BROWN, 0.5, 7);
  brow(p, quad([cx + 3, 43.5], [cx + 9, 41], [cx + 15.5, 43]), 2.4, 1.6, HAIR_BROWN, 0.3, 8);
  nostrils(p, hd, 3);
  smileFolds(p, hd, 11.5, 9, 0.18);
  // A small smile under the mustache: the lower lip and the corners.
  mouthLine(p, hd, [cx - 6, 72.6], [cx, 73.8], [cx + 6, 72.6], { w: 0.9, lip: 1.3 });
  // The thick brown mustache: a full chevron that hides the upper lip and droops past the corners.
  const tache = (x: number, y: number): boolean => {
    const ax = Math.abs(x - cx);
    const topY = 62.2 + ax * 0.12 - (ax < 3 ? 0.4 : 0);
    const botY = 71.8 + ax * 0.08 - 0.5 * Math.cos((ax / 11) * Math.PI) + (ax > 8 ? (ax - 8) * 0.4 : 0);
    return ax < 11 - Math.max(0, y - 72) * 0.6 && y > topY && y < botY;
  };
  hair(p, tache, HAIR_BROWN, {
    cx: cx - 3,
    cy: 64,
    rx: 13,
    ry: 9,
    dir: (x) => (x < cx ? 2.0 : 1.14),
    len: 2.4,
    wid: 0.55,
    streak: 0.8,
    seed: 17,
    amb: 0.1,
    lift: 0.1,
  });
  // Messy spiky hair: a mass with flame-shaped spikes up and out.
  const spikes: Array<readonly [number, number, number, number]> = [
    // base x, base y, tip dx, tip dy
    [cx - 23, 31, -5, -3],
    [cx - 20, 25, -6, -6],
    [cx - 15, 21, -2, -8],
    [cx - 11, 18, -6, -6],
    [cx - 6, 16, 0, -9],
    [cx - 1, 15, 4, -7],
    [cx + 3, 16, -1, -6],
    [cx + 7, 16, 6, -8],
    [cx + 12, 18, 3, -6],
    [cx + 16, 21, 8, -5],
    [cx + 20, 25, 6, -2],
    [cx + 23, 31, 4, 1],
  ];
  const inSpike = (x: number, y: number): boolean => {
    for (const [bx, by, dx, dy] of spikes) {
      const [d, t] = lineDist(x, y, [
        [bx, by + 3],
        [bx + dx, by + dy],
      ]);
      if (d < 3.6 * (1 - t) ** 0.8 + 0.2) return true;
    }
    return false;
  };
  const hairline = (x: number): number => {
    const ax = Math.abs(x - cx);
    return 30 - 2 * Math.sin((x - cx) * 0.9) * 0.8 + (ax / 25) ** 2 * 3 + (ax > 20 ? (ax - 20) * 5 : 0);
  };
  const hairMask = (x: number, y: number): boolean => (ell(x, y, cx, 37, 26.5, 26) < 1 && y < hairline(x) && y < 52) || inSpike(x, y);
  hd.occ = (x, y) => (hairMask(x, y) ? hd.h(x, y) + 3 : 0);
  hair(p, hairMask, HAIR_BROWN, {
    cx: cx - 5,
    cy: 22,
    rx: 30,
    ry: 20,
    dir: (x, y) => Math.atan2(y - 40, x - cx) + Math.PI / 2 + 0.3 * Math.sin(x * 0.7),
    len: 3,
    wid: 0.7,
    streak: 0.85,
    seed: 23,
  });
  // Fringe tufts falling on the forehead.
  for (const [x0, y0, x1, y1] of [
    [cx - 8, 26, cx - 11, 34],
    [cx - 1, 27, cx - 3, 35.5],
    [cx + 6, 27, cx + 5, 33.5],
  ] as const) {
    p.stroke(
      [
        [x0, y0],
        [x1, y1],
      ],
      4,
      0.5,
      (t, x, y, X, Y) => tone(HAIR_BROWN, 0.7 - t * 0.3 + (strands(x, y, 1.9, 2, 0.5, 29) - 0.5) * 0.7 - (x > cx ? 0.2 : 0), X, Y, 0.3),
    );
  }
  fadeBottom(p, 100, 122);
}

// ---------------------------------------------------------------------------------------------
// BOB — captain climate
// ---------------------------------------------------------------------------------------------

function bob(p: Painter): void {
  const cx = 32;
  bg(p, 22, 42);
  const hd = new Head({
    cx,
    top: 17,
    cheekY: 48,
    rx: 21.5,
    jawY: 70,
    jawW: 15.5,
    chinY: 89,
    chinW: 6.5,
    eyeY: 50,
    eyeDX: 9.2,
    noseY: 64,
    mouthY: 74,
    skin: SKIN_PALE,
    nose: 4.2,
    noseW: 2.1,
    hollow: 1.2,
    cheek: 1.6,
  });
  // Navy t-shirt, the green cape over the shoulders and its knot with a leaf clasp.
  const body = shoulderMask(cx, 94, 38);
  cloth(p, body, NAVY_TEE, cx - 14, 114, 30, 24, { lift: 0.05 });
  const cape = (x: number, y: number): boolean => body(x, y) && Math.abs(x - cx) > 9 + (y - 96) * 0.55;
  cloth(p, cape, CAPE, cx - 16, 110, 30, 22, { grain: (x, y) => (strands(x, y, 1.2 + (x - cx) * 0.02, 8, 1.5, 51) - 0.5) * 0.15 });
  neck(p, hd, 8, 102);
  p.paint((x, y, X, Y) => {
    const d = ell(x, y, cx, 97, 10, 6.5);
    if (d < 1 || d > 1.45 || y < 96) return null;
    return tone(NAVY_TEE, 0.6 - (x > cx ? 0.3 : 0), X, Y);
  });
  // The cape's tie: two lobes over the collarbone and the round clasp with a leaf.
  p.paint((x, y, X, Y) => {
    const l = ell(x, y, cx - 5, 103, 4.5, 2.6) < 1 || ell(x, y, cx + 5, 103, 4.5, 2.6) < 1;
    if (!l) return null;
    return tone(CAPE, ellLight(x, y, x < cx ? cx - 6 : cx + 4, 102, 6, 3) * 1.1, X, Y);
  });
  p.paint((x, y, X, Y) => (ell(x, y, cx, 103.5, 3.2, 3.2) < 1 ? tone(PAL.gold, ellLight(x, y, cx - 0.8, 102.7, 3.4, 3.4), X, Y) : null));
  p.paint((x, y) => {
    // The leaf on the clasp.
    const u = x - cx;
    const v = y - 103.5;
    const r = Math.abs(u + v) / Math.SQRT2;
    const q = Math.abs(u - v) / Math.SQRT2;
    return q < 1.8 && r < 0.9 * Math.sqrt(Math.max(0, 1 - (q / 1.8) ** 2)) ? PAL.green[1] : null;
  });
  ears(p, hd, 49, 63, 5);
  hd.paintFace(p, (x, y) => -0.06 * (gauss(x, y, cx - 12, 62, 4, 3) + gauss(x, y, cx + 12, 62, 4, 3)));
  stubble(p, hd, 0.22, STUBBLE_BROWN, beardRegion(hd, { top: 2.5, mouthW: 8, lipGap: 2 }), 19);
  eye(p, hd, { x: cx - 9.2, y: 50.5, w: 8, open: 3.1, kind: 'open', side: -1, iris: IRIS_BLUE, look: 0.5 });
  eye(p, hd, { x: cx + 9.2, y: 50.5, w: 8, open: 3.1, kind: 'open', side: 1, iris: IRIS_BLUE, look: 0.5 });
  brow(p, quad([cx - 3, 45.5], [cx - 9, 43.3], [cx - 15, 45]), 1.9, 1.2, HAIR_BROWN, 0.45, 9);
  brow(p, quad([cx + 3, 45.5], [cx + 9, 43.3], [cx + 15, 45]), 1.9, 1.2, HAIR_BROWN, 0.25, 10);
  nostrils(p, hd, 2.2);
  smileFolds(p, hd, 8, 8.5, 0.12);
  // Calm half-smile: the left corner a touch higher.
  mouthLine(p, hd, [cx - 5.5, 73.5], [cx, 74.6], [cx + 5.5, 74], { w: 0.9, lip: 1.1 });
  // Tousled hair swept up: a tall quiff with loose clumps.
  const quiff = (x: number, y: number): boolean => {
    const ax = x - cx;
    const top = 6 + 0.012 * (ax + 3) ** 2 + 2.5 * Math.sin(ax * 0.55) * smoothstep(-24, 0, ax);
    const locks = 2.4 * Math.max(0, Math.sin(ax * 0.8 + 0.6)) ** 2 * smoothstep(17, 8, Math.abs(ax));
    const hairline = 30 + locks + (Math.abs(ax) / 21) ** 2 * 3 + (Math.abs(ax) > 18 ? (Math.abs(ax) - 18) * 6 : 0);
    return y > top && y < hairline && y < 52 && ell(x, y, cx, 33, 24.5, 34) < 1;
  };
  hd.occ = (x, y) => (quiff(x, y) ? hd.h(x, y) + 4 : 0);
  hair(p, quiff, HAIR_BROWN, {
    cx: cx - 6,
    cy: 18,
    rx: 26,
    ry: 18,
    dir: (x, y) => -Math.PI / 2 + (x - cx) * 0.045 + 0.35 * (y < 20 ? 1 : 0),
    len: 4,
    wid: 0.7,
    streak: 0.8,
    seed: 37,
    lift: 0.05,
  });
  // Loose locks falling on the forehead.
  for (const [x0, y0, x1, y1, x2, y2] of [
    [cx - 4, 27, cx - 8, 33, cx - 6, 37],
    [cx + 3, 28, cx + 1, 33, cx + 3, 36],
  ] as const) {
    p.stroke(quad([x0, y0], [x1, y1], [x2, y2]), 2.4, 0.5, (t, x, y, X, Y) => tone(HAIR_BROWN, 0.65 - t * 0.35 - (x > cx ? 0.2 : 0) + (strands(x, y, 1.7, 2, 0.5, 39) - 0.5) * 0.5, X, Y, 0.3));
  }
  fadeBottom(p, 102, 122);
}

// ---------------------------------------------------------------------------------------------
// PATRICK — the supernerd
// ---------------------------------------------------------------------------------------------

function patrick(p: Painter): void {
  const cx = 32;
  bg(p, 22, 40);
  const hd = new Head({
    cx,
    top: 15,
    cheekY: 47,
    rx: 23,
    jawY: 72,
    jawW: 20,
    chinY: 87,
    chinW: 10.5,
    eyeY: 48,
    eyeDX: 9.6,
    noseY: 62,
    mouthY: 72,
    skin: SKIN_TAN,
    nose: 4.2,
    noseW: 2.4,
    brow: 2.2,
    chin: 2.2,
    hollow: 0.8,
  });
  // Black polo: the open collar and the placket.
  const body = shoulderMask(cx, 92, 38);
  cloth(p, body, POLO, cx - 14, 112, 30, 24, { lift: 0.08 });
  neck(p, hd, 10, 100);
  p.paint((x, y, X, Y) => (Math.abs(x - cx) < 2 && y > 99 && y < 114 ? tone(POLO, x < cx ? 0.4 : 0.25, X, Y) : null));
  p.paint((x, y) => (Math.abs(x - cx) < 0.7 && (Math.abs(y - 105) < 0.8 || Math.abs(y - 110) < 0.8) ? PAL.steel[2] : null));
  for (const side of [-1, 1]) {
    const pts: Pt[] = [
      [cx + side * 11, 90],
      [cx + side * 1.2, 99],
      [cx + side * 8, 104],
      [cx + side * 14.5, 96],
    ];
    p.paint((x, y, X, Y) => (inPoly(x, y, pts) ? tone(POLO, side < 0 ? 0.85 : 0.45, X, Y) : null));
    p.stroke(
      [
        [cx + side * 1.2, 99],
        [cx + side * 8, 104],
      ],
      0.6,
      0.6,
      INK,
    );
  }
  ears(p, hd, 47, 61, 5.5);
  hd.paintFace(p);
  stubble(p, hd, 0.45, STUBBLE_BLACK, beardRegion(hd, { top: 0.5, mouthW: 8, lipGap: 2.4 }), 29);
  eye(p, hd, { x: cx - 9.6, y: 48.5, w: 8, open: 2.6, kind: 'open', side: -1, iris: IRIS_BROWN, look: 0.6, tilt: 0.3 });
  eye(p, hd, { x: cx + 9.6, y: 48.5, w: 8, open: 2.6, kind: 'open', side: 1, iris: IRIS_BROWN, look: 0.6, tilt: 0.3 });
  // Strong, straight dark brows.
  brow(p, quad([cx - 2.5, 44], [cx - 9, 42], [cx - 16, 43]), 3, 2, HAIR_BLACK, 0.45, 11);
  brow(p, quad([cx + 2.5, 44], [cx + 9, 42], [cx + 16, 43]), 3, 2, HAIR_BLACK, 0.3, 12);
  nostrils(p, hd, 2.4);
  smileFolds(p, hd, 9.5, 9, 0.18);
  mouthLine(p, hd, [cx - 6.5, 71.5], [cx, 72.8], [cx + 6.5, 70.8], { w: 0.9, lip: 1.2 });
  // Thin trimmed mustache right over the lip, split at the philtrum.
  p.paint((x, y, X, Y) => {
    const ax = Math.abs(x - cx);
    if (ax > 7.6 || ax < 0.45) return null;
    const bot = 72.2 - (ax / 6.5) ** 2 * 1.3 - (x > cx ? (ax / 6.5) * 0.7 : 0);
    if (y > bot || y < bot - 2.1 + ax * 0.1) return null;
    return tone(HAIR_BLACK, 0.32 - (x > cx ? 0.2 : 0) + (y < bot - 1.4 ? 0.12 : 0), X, Y);
  });
  // Hair: short faded sides, the slick top combed straight back with a glossy sheen.
  const ax = (x: number): number => Math.abs(x - cx);
  const sides = (x: number, y: number): boolean => ax(x) > 17.5 && y > 24 && y < 49 - (ax(x) - 18) * 0.3 && ell(x, y, cx, 38, 24, 26) < 1 && !(ax(x) < 21 && y > 40);
  p.paint((x, y, X, Y) => {
    if (!sides(x, y)) return null;
    // A fade: darker and denser higher up, skin showing through low down.
    const fade = smoothstep(46, 34, y);
    if (fade < 0.5 && (fade * 2 < ((X * 7 + Y * 3) % 5) / 5 || false)) return hd.skin(x, y, X, Y, -0.08);
    return tone(HAIR_BLACK, ellLight(x, y, cx - 5, 30, 26, 20) * 0.8, X, Y);
  });
  const top = (x: number, y: number): boolean => {
    const hairline = 27 + 1.3 * gauss(x, 0, cx, 0, 2.2, 1) - 1.6 * gauss(ax(x), 0, 12, 0, 3.5, 1) + (ax(x) / 20) ** 2 * 3 + (ax(x) > 16 ? (ax(x) - 16) * 1.5 : 0);
    return ell(x, y, cx - 0.5, 27, 21.5, 20) < 1 && y < hairline && y > 4;
  };
  hd.occ = (x, y) => (top(x, y) || sides(x, y) ? hd.h(x, y) + 3 : 0);
  hair(p, top, HAIR_BLACK, {
    cx: cx - 6,
    cy: 17,
    rx: 20,
    ry: 14,
    dir: (x) => -Math.PI / 2 + (x - cx) * 0.035,
    len: 7,
    wid: 0.75,
    streak: 1.1,
    seed: 43,
    amb: 0.04,
  });
  // The sheen: a sweeping light band across the slick top.
  p.paint((x, y, X, Y) => {
    if (!top(x, y)) return null;
    const band = Math.abs(y - (17 + (x - cx) * 0.18) - 0.002 * (x - cx) ** 2);
    const s = strands(x, y, -Math.PI / 2 + (x - cx) * 0.035, 7, 0.7, 47);
    if (band > 2.2 || s < 0.35 || x > cx + 12) return null;
    return tone([PAL.hairA[2], PAL.steel[1], PAL.steel[2], PAL.steel[3]], 0.75 - band * 0.25 - (x - cx + 12) * 0.02, X, Y, 0.3);
  });
  fadeBottom(p, 100, 122);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const LOOKS: Readonly<Record<SquadId, (p: Painter) => void>> = { vincent, thom, dirk, bob, patrick };

const cache = new Map<string, PixelBuffer>();

function cached(key: string, make: () => PixelBuffer): PixelBuffer {
  let b = cache.get(key);
  if (!b) {
    b = make();
    cache.set(key, b);
  }
  return b;
}

/** The select frame shows the bust a little zoomed in: the head fills the panel, the ears touch its edges. */
const ZOOM = 1.12;
/** Top of the view per friend (Thom's cap and Dirk's spikes need more room above). */
const VIEW_TOP: Readonly<Record<SquadId, number>> = { vincent: 5, thom: 1, dirk: 3, bob: 3, patrick: 4 };

/** The select bust of a friend (density 1: 64 × 120, density 2: 128 × 240). */
export function selectPortrait(id: SquadId, density: 1 | 2 = 1): PixelBuffer {
  return cached(`${id}@${density}`, () => {
    const p = new Painter(SELECT_W, SELECT_H, density, { x0: 32 - 32 / ZOOM, y0: VIEW_TOP[id], scale: ZOOM });
    LOOKS[id](p);
    return p.b;
  });
}

/** The greyed select bust (unselected panel): the colour bust through the grey ramp. */
export function selectPortraitGrey(id: SquadId, density: 1 | 2 = 1): PixelBuffer {
  return cached(`${id}-grey@${density}`, () => greyed(selectPortrait(id, density)));
}

/** The 32 × 32 menu portrait (64 × 64 at density 2): the same face, zoomed out, in an INK frame. */
export function smallPortrait(id: SquadId, density: 1 | 2 = 1): PixelBuffer {
  return cached(`${id}-small@${density}`, () => {
    const p = new Painter(SMALL, SMALL, density, SMALL_VIEW[id]);
    LOOKS[id](p);
    frameBorder(p);
    return p.b;
  });
}

/** Is `id` one of the squad? */
export function isSquad(id: string): id is SquadId {
  return (SQUAD as readonly string[]).includes(id);
}

const topLeft = { anchor: 'top-left' } as const;

for (const id of SQUAD) {
  defineSprite(`char/${id}/select`, () => selectPortrait(id), { ...topLeft, hi: () => selectPortrait(id, 2) });
  defineSprite(`char/${id}/select-grey`, () => selectPortraitGrey(id), { ...topLeft, hi: () => selectPortraitGrey(id, 2) });
  defineSprite(`char/${id}/portrait`, () => smallPortrait(id), { ...topLeft, hi: () => smallPortrait(id, 2) });
}
