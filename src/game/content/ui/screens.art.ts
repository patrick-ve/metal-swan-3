/**
 * Art for the flow screens (GDD §13): the tally newspaper and its stamp, Brigadier Gusto's
 * radio portrait, the title lake scene (a stand-in swan until `vehicle/swan/swim` exists, the
 * tiny Legion parade on the far bank), and the props of the continue gag. Original designs,
 * palette ramps only, 1 px ink outlines, light from the top left.
 */
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { Rng } from '../../../engine/rng';
import { defineSprite, getFrames, hasSprite, setDeferDense } from '../../../engine/sprites';
import { grime, HdCanvas, texAll, wood, type Texture } from '../../art/hd/index';
import { portrait } from '../../art/human-sprites';
import type { HumanStyle } from '../../art/humanoid';
import { hash1, hash2, noise2 } from '../../art/paint';
import { brow, ears, ell, ellLight, eye, gauss, hair, Head, inPoly, nostrils, Painter, quad, shoulderMask, tone, type Pt } from '../../art/portrait-kit';

const topLeft = { anchor: 'top-left' as const };

// ---------------------------------------------------------------------------------------------
// The newspaper (GDD §13.11)
// ---------------------------------------------------------------------------------------------

/** Paper size: the page covers the screen but a 12 px / 6 px border. */
export const PAPER_W = 360;
export const PAPER_H = 204;

/**
 * The tally page of THE LOWMERE LISTENER: warm paper with a faint fibre, a drop shadow, the
 * masthead rules and a little ivory swan emblem at each side of the masthead. Text is drawn by
 * the scene on top.
 */
function newspaper(): Frame[] {
  const w = PAPER_W;
  const h = PAPER_H;
  const b = new PixelBuffer(w + 3, h + 3);
  // Shadow, paper, fibre speckle (ordered, sparse), a darker edge.
  b.rect(3, 3, w, h, PAL.ink[1]);
  b.rect(0, 0, w, h, PAL.snow[2]);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (((x * 7 + y * 13) % 29 === 0 && (x + y) % 3 === 0) || (y % 37 === 0 && x % 5 === 0)) b.set(x, y, PAL.snow[1]);
  b.strokeRect(0, 0, w, h, PAL.stone[2]);
  b.rect(1, h - 2, w - 2, 1, PAL.snow[1]);
  // Masthead rules: a thick and a thin line under the title block, a thin one under the headline.
  b.rect(10, 30, w - 20, 2, INK);
  b.rect(10, 33, w - 20, 1, INK);
  b.rect(10, 50, w - 20, 1, PAL.stone[1]);
  // Ivory swan emblems left and right of the masthead.
  const emblem = swanEmblem();
  b.blit(emblem, 14, 6);
  b.blit(emblem, w - 14 - emblem.w, 6, { flipX: true });
  // Small print under the rules: price and date boxes.
  drawText(b, 'PRICE: ONE KAZOO', 12, 22, { font: 'small', color: PAL.stone[0] });
  drawText(b, 'EVENING EXTRA', w - 12, 22, { font: 'small', color: PAL.stone[0], align: 'right' });
  return [{ buf: b, ox: 0, oy: 0 }];
}

/** A 14×13 swan silhouette in ink (the paper's emblem). */
function swanEmblem(): PixelBuffer {
  const rows = ['.....##.......', '....####......', '....##.##.....', '....##........', '.....##.......', '......##......', '......##....#.', '.....###...##.', '..########.##.', '.############.', '############..', '.##########...', '..#######.....'];
  const b = new PixelBuffer(14, 13);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#') b.set(x, y, INK);
  });
  return b;
}

/** The rubber stamp that drops the headline: a wooden knob on a crimson pad; frame 1 squashed. */
function stampFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 2; i++) {
    const b = new PixelBuffer(22, 26);
    const squash = i;
    // Knob and handle (wood), the base block (wood), the ink pad (crimson).
    b.ellipse(7, 1 + squash, 8, 7, PAL.brown[2]);
    b.rect(9, 7 + squash, 4, 7 - squash, PAL.brown[2]);
    b.rect(2, 14, 18, 6, PAL.brown[2]);
    b.rect(1, 20, 20, 4 - squash, PAL.red[2]);
    b.bevel(PAL.brown, { light: 'tl', depth: 1 });
    b.rect(1, 20, 20, 1, PAL.red[3]);
    b.rect(1, 23 - squash, 20, 1, PAL.red[1]);
    out.push({ buf: b.padded(1).outline(INK), ox: 12, oy: 26 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Brigadier Lionel Gusto (GDD §13.6): big, red-faced, peaked cap, moustache, microphone in hand
// ---------------------------------------------------------------------------------------------

const GUSTO_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'stone',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'olive',
  accent: 'gold',
  top: 'olive',
  topType: 'tunic',
  pants: 'olive',
  boots: 'black',
  gloves: null,
  belt: 'brown',
  build: 'heavy',
  accessories: ['epaulettes'],
  face: ['moustache', 'blush'],
};

function gustoPortrait(): Frame[] {
  const b = portrait(GUSTO_STYLE);
  // A gold cap badge, then the microphone: a black grille ball on a steel stem in his fist,
  // its cable curling out of the frame (drawn in 2×2 blocks to match the portrait's scale).
  const px = (x: number, y: number, c: Color): void => {
    b.rect(x, y, 2, 2, c);
  };
  px(14, 5, PAL.gold[3]);
  const fist = PAL.skinA[2];
  for (const [x, y] of [[22, 24], [24, 24], [22, 26], [24, 26], [26, 26]] as const) px(x, y, fist);
  px(22, 28, PAL.skinA[1]);
  px(24, 28, PAL.skinA[1]);
  px(24, 22, PAL.steel[3]);
  px(24, 20, PAL.steel[2]);
  for (const [x, y, c] of [[22, 16, PAL.black[2]], [24, 16, PAL.black[3]], [22, 18, PAL.black[1]], [24, 18, PAL.black[2]], [26, 16, PAL.black[1]], [26, 18, PAL.black[1]], [24, 14, PAL.black[1]], [22, 14, PAL.black[1]]] as const) px(x, y, c);
  b.set(24, 16, PAL.steel[4]);
  b.strokeRect(0, 0, 32, 32, INK);
  return [{ buf: b, ox: 0, oy: 0 }];
}

// ---------------------------------------------------------------------------------------------
// Title lake scene (GDD §13.3)
// ---------------------------------------------------------------------------------------------

/**
 * A stand-in for the swimming SWAN-3 until the vehicle art exists: ivory boat hull on the water
 * (navy waterline stripe, gold rivets, a navy '3'), an upturned tail of three blades, the far
 * wing arched behind the seat, the S-neck and her head with the lens eye and the orange beak.
 * Anchor = the float line (feet), 16 px under the surface; point `seat` = the rider's hip.
 * Two frames: the hull bobs 1 px.
 */
function titleSwanFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const w = 82;
    const h = 64;
    const ax = 40; // anchor x (feet centre) in the buffer
    const surf = h - 16; // the water surface row
    const b = new PixelBuffer(w, h);
    const dy = f;
    // Under water: paddling legs in water colours (look.md §5.8).
    const under = new PixelBuffer(w, h);
    under.thickLine(ax - 6, surf + 2, ax - 10 + f * 6, h - 4, 3, PAL.navy[1]);
    under.thickLine(ax + 4, surf + 2, ax + 8 - f * 6, h - 5, 3, PAL.steel[1]);
    under.ellipse(ax - 15 + f * 6, h - 5, 8, 3, PAL.teal[1]);
    under.ellipse(ax + 3 - f * 6, h - 6, 8, 3, PAL.teal[2]);
    under.rect(ax - 24, surf, 44, 4, PAL.sky[1]);
    under.outline(PAL.navy[0]);
    b.blit(under, 0, 0);
    // Far wing arch behind the seat.
    const top = new PixelBuffer(w, h);
    top.poly([ax - 20, surf - 14 + dy, ax - 6, surf - 26 + dy, ax + 6, surf - 22 + dy, ax + 2, surf - 13 + dy], PAL.snow[1]);
    top.rect(ax - 7, surf - 25 + dy, 6, 2, PAL.navy[1]);
    // Tail blades (upturned) and the hull: a long low boat shape riding the surface.
    top.poly([ax - 30, surf - 10 + dy, ax - 38, surf - 22 + dy, ax - 33, surf - 21 + dy, ax - 25, surf - 12 + dy], PAL.snow[2]);
    top.poly([ax - 30, surf - 8 + dy, ax - 40, surf - 15 + dy, ax - 35, surf - 15 + dy, ax - 26, surf - 9 + dy], PAL.snow[1]);
    top.rect(ax - 37, surf - 21 + dy, 3, 6, PAL.navy[1]);
    top.poly([ax - 30, surf - 14 + dy, ax + 18, surf - 16 + dy, ax + 24, surf - 10 + dy, ax + 18, surf + 2 + dy, ax - 24, surf + 2 + dy, ax - 31, surf - 6 + dy], PAL.snow[2]);
    top.bevel(PAL.snow, { light: 'tl', depth: 1 });
    // Waterline stripe, rivets, the bow number, the seat pad and the brass handles.
    top.rect(ax - 26, surf - 2 + dy, 46, 2, PAL.navy[1]);
    for (let x = ax - 22; x < ax + 16; x += 6) top.set(x, surf - 12 + dy, PAL.gold[3]);
    drawText(top, '3', ax + 12, surf - 11 + dy, { font: 'small', color: PAL.navy[1] });
    top.rect(ax - 12, surf - 17 + dy, 12, 3, PAL.navy[1]);
    top.rect(ax - 11, surf - 17 + dy, 10, 1, PAL.navy[2]);
    top.rect(ax + 1, surf - 21 + dy, 2, 5, PAL.gold[2]);
    // The S-neck (rings on a hose) and the head.
    const neck = [ax + 16, surf - 14, ax + 22, surf - 22, ax + 20, surf - 30, ax + 16, surf - 37, ax + 18, surf - 43, ax + 23, surf - 45];
    for (let i = 0; i + 3 < neck.length; i += 2) top.thickLine(neck[i], neck[i + 1] + dy, neck[i + 2], neck[i + 3] + dy, 5, PAL.snow[2]);
    top.ellipse(ax + 19, surf - 50 + dy, 10, 8, PAL.snow[3]);
    top.bevel(PAL.snow, { light: 'tl', depth: 1, only: PAL.snow[2] });
    for (let i = 0; i < 4; i++) top.set(ax + 21 - (i % 2), surf - 24 - i * 5 + dy, PAL.snow[0]);
    // Lens eye, navy face patch, orange beak with a steel nail.
    top.set(ax + 23, surf - 48 + dy, PAL.gold[2]);
    top.set(ax + 24, surf - 48 + dy, INK);
    top.set(ax + 25, surf - 47 + dy, PAL.navy[0]);
    top.set(ax + 26, surf - 46 + dy, PAL.navy[0]);
    for (let i = 0; i < 9; i++) {
      top.set(ax + 27 + i, surf - 46 + dy, i < 8 ? PAL.orange[3] : PAL.steel[3]);
      if (i < 7) top.set(ax + 27 + i, surf - 45 + dy, PAL.orange[1]);
    }
    top.outline(INK);
    b.blit(top, 0, 0);
    // Foam at the waterline and a bow wave.
    for (let x = ax - 28; x < ax + 24; x += 2) b.set(x, surf + 2 + dy, (x + f) % 4 === 0 ? PAL.snow[3] : PAL.sky[3]);
    b.rect(ax + 22, surf + dy, 3, 1, PAL.snow[3]);
    out.push({ buf: b, ox: ax, oy: h, pts: { seat: [-6, -30 + dy], neck: [16, -30 + dy] } });
  }
  return out;
}

/** Tiny Legion bandsmen for the far bank (6 × 11): crimson tunic, white trousers, black shako. */
function paradeFrames(): Frame[] {
  const frames = [
    ['..w..', '.kk..', '.kk..', '.ss..', 'rRgr.', '.RRr.', '.rr..', '.ww..', 'w..w.', 'k..k.'],
    ['..w..', '.kk..', '.kk..', '.ss..', 'rRgr.', '.RRr.', '.rr..', '.ww..', '.ww..', '.kk..'],
  ];
  return frames.map((rows) => {
    const b = new PixelBuffer(5, rows.length);
    const key: Readonly<Record<string, Color>> = { w: PAL.snow[3], k: INK, s: PAL.skinA[2], r: PAL.red[1], R: PAL.red[2], g: PAL.gold[3] };
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (key[r[x]] !== undefined) b.set(x, y, key[r[x]]);
    });
    return { buf: b, ox: 2, oy: rows.length };
  });
}

// --- HD (2× and 4×): Gusto painted natively with the portrait kit -----------------------------

/** Painting units of the HD radio portrait: 96 × 96 units = the 32 × 32 logical px panel. */
const GUSTO_VIEW = { x0: 0, y0: 0, scale: 1 / 3 } as const;
const RUDDY: Ramp = [PAL_HD.ink[0], PAL_HD.red[1], PAL_HD.skinA[1], PAL_HD.skinA[2], PAL_HD.skinA[3], PAL_HD.skinA[4], PAL_HD.skinA[5], PAL_HD.skinA[6]];
const BLUSH: Ramp = [PAL_HD.red[1], PAL_HD.skinA[1], PAL_HD.red[4], PAL_HD.skinA[2], PAL_HD.red[6], PAL_HD.skinA[4], PAL_HD.skinA[5]];
const GUSTO_OLIVE: Ramp = [PAL_HD.ink[0], PAL_HD.olive[0], PAL_HD.olive[1], PAL_HD.olive[2], PAL_HD.olive[3], PAL_HD.olive[4], PAL_HD.olive[5], PAL_HD.olive[6]];
const WHISKER: Ramp = [PAL_HD.ink[0], PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4], PAL_HD.stone[5], PAL_HD.stone[6], PAL_HD.stone[7]];
const GLOSS: Ramp = [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.black[2], PAL_HD.black[3], PAL_HD.black[4], PAL_HD.black[5], PAL_HD.black[6], PAL_HD.snow[4]];
const RADIO_BG: Ramp = [PAL_HD.ink[0], PAL_HD.navy[0], PAL_HD.navy[1], PAL_HD.purple[0], PAL_HD.navy[2], PAL_HD.purple[1], PAL_HD.navy[3]];
const CHROME: Ramp = [PAL_HD.ink[0], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.steel[3], PAL_HD.steel[4], PAL_HD.steel[5], PAL_HD.steel[6], PAL_HD.steel[7]];

/**
 * Brigadier Lionel Gusto's radio portrait at density d (32 × 32 logical): a big ruddy face under
 * a peaked olive cap (gold badge, black glossy peak shading the eyes), a grey walrus moustache
 * over a mouth open on the radio, bushy brows, the olive tunic with gold epaulettes, and the
 * microphone (black grille ball, chrome stem) in his fist; a dark radio-screen glow behind, the
 * ink frame. Same composition as the 1× panel.
 */
function gustoPortraitHd(d: HdD): PixelBuffer {
  const p = new Painter(32, 32, d, GUSTO_VIEW);
  const cx = 42;
  // The radio screen behind him: dark, a cool glow behind the head, faint scan lines.
  p.paint((x, y, X, Y) => {
    const v = 0.5 - (y / 96) * 0.45 + 0.32 * gauss(x, y, cx - 6, 36, 26, 30) - (Math.floor(y / 3) % 2 === 0 ? 0.04 : 0);
    return tone(RADIO_BG, v, X, Y, 0.5);
  });
  const hd = new Head({
    cx,
    top: 24,
    cheekY: 47,
    rx: 21,
    jawY: 66,
    jawW: 19.5,
    chinY: 82,
    chinW: 10,
    eyeY: 48,
    eyeDX: 9,
    noseY: 61,
    mouthY: 71,
    skin: RUDDY,
    nose: 5,
    noseW: 3,
    cheek: 2.2,
    hollow: 0.2,
    muzzle: 2.2,
    chin: 2.2,
    exposure: 0.04,
    // Jowls bulging over the collar.
    bumps: [
      { x: cx - 14, y: 70, sx: 5, sy: 5, a: 1.6 },
      { x: cx + 14, y: 70, sx: 5, sy: 5, a: 1.6 },
    ],
  });
  // The peak of the cap throws its shade over the eyes.
  const peakTop = (x: number): number => 37 + 0.004 * (x - cx) * (x - cx);
  const inPeak = (x: number, y: number): boolean => Math.abs(x - cx - 1) < 25 && y >= peakTop(x) && y < peakTop(x) + 6 - Math.abs(x - cx - 1) * 0.06;
  hd.occ = (x, y) => (inPeak(x, y) ? 26 : y < peakTop(x) && Math.abs(x - cx) < 24 ? 22 : 0);
  // Tunic and shoulders, the collar, the gold epaulettes.
  const body = shoulderMask(cx, 80, 52, 97);
  p.paint((x, y, X, Y) => {
    if (!body(x, y)) return null;
    const v = ellLight(x, y, cx - 10, 96, 60, 26, 0.08) - (x > cx + 20 ? 0.12 : 0);
    return tone(GUSTO_OLIVE, v * 0.9, X, Y, 0.3);
  });
  for (const side of [-1, 1]) {
    // Collar flaps meeting under the chin.
    const pts: Pt[] = [
      [cx + side * 2, 92],
      [cx + side * 17, 77],
      [cx + side * 22, 83],
      [cx + side * 8, 96],
    ];
    p.paint((x, y, X, Y) => (inPoly(x, y, pts) ? tone(GUSTO_OLIVE, side < 0 ? 0.62 : 0.34, X, Y, 0.3) : null));
    p.stroke(pts.slice(0, 2), 0.9, 0.9, PAL_HD.olive[0]);
    // An epaulette: a gold-edged board on the shoulder with fringe.
    const ex = cx + side * 40;
    p.paint((x, y, X, Y) => {
      if (ell(x, y, ex, 88, 11, 4.2) >= 1) return null;
      const t = ellLight(x, y, ex - 2, 86, 11, 5, 0.1) - (side > 0 ? 0.18 : 0);
      return tone(PAL_HD.gold, t * 0.95, X, Y, 0.3);
    });
    for (let k = -4; k <= 4; k++) p.stroke([[ex + k * 2.2, 91], [ex + k * 2.3, 95.5]], 0.9, 0.7, k % 2 ? PAL_HD.gold[3] : PAL_HD.gold[2]);
  }
  ears(p, hd, 47, 62, 7);
  // The face: ruddy, a red nose and red cheeks.
  hd.paintFace(p, (x, y) => -0.1 * gauss(x, y, cx + 16, 58, 6, 12));
  const blush = (x: number, y: number): number =>
    Math.max(gauss(x, y, cx - 11, 60, 4.5, 3.5), gauss(x, y, cx + 11, 60, 4.5, 3.5) * 0.8, gauss(x, y, cx, 59, 3.4, 3));
  p.paint((x, y, X, Y) => (hd.inside(x, y) && blush(x, y) > 0.68 ? tone(BLUSH, hd.light(x, y) * 1.05 + 0.12, X, Y, 0.3) : null));
  // Small eyes, squinting in the shade of the peak.
  eye(p, hd, { x: cx - 9, y: 49, w: 7.5, open: 2, kind: 'squint', side: -1, iris: [PAL_HD.ink[0], PAL_HD.sky[0], PAL_HD.sky[2]], look: 0.6, crow: 2 });
  eye(p, hd, { x: cx + 9, y: 49, w: 7.5, open: 2, kind: 'squint', side: 1, iris: [PAL_HD.ink[0], PAL_HD.sky[0], PAL_HD.sky[2]], look: 0.6, crow: 2 });
  brow(p, quad([cx - 3, 44.5], [cx - 9, 41.5], [cx - 16, 43]), 3.4, 2.4, WHISKER, 0.45, 5);
  brow(p, quad([cx + 3, 44.5], [cx + 9, 41.5], [cx + 16, 43]), 3.4, 2.4, WHISKER, 0.3, 6);
  nostrils(p, hd, 3);
  // The mouth, open on the radio, under the moustache.
  p.paint((x, y, X, Y) => {
    const q = ell(x, y, cx + 1, 73.5, 5.5, 2.6);
    if (q >= 1) return null;
    return y > 74.6 && q < 0.5 ? tone([PAL_HD.red[1], PAL_HD.red[2], PAL_HD.red[3]], 0.5, X, Y) : PAL_HD.ink[0];
  });
  p.stroke(quad([cx - 4, 76.6], [cx + 1, 77.8], [cx + 6, 76.6]), 1.1, 1.1, (_t, x, y, X, Y) => hd.skin(x, y, X, Y, 0.1));
  // The walrus moustache: two drooping lobes of grey whiskers from under the nose.
  const stache = (x: number, y: number): boolean => {
    const ax = Math.abs(x - cx);
    if (ax > 15) return false;
    const top = 63.5 + ax * 0.12;
    const bot = 70.5 + ax * 0.26 - (ax < 2 ? 1.2 : 0);
    return y > top && y < bot;
  };
  hair(p, stache, WHISKER, { cx: cx - 4, cy: 64, rx: 18, ry: 8, dir: (x) => (x < cx ? 1.9 : 1.25), len: 3, wid: 0.6, streak: 0.55, seed: 33, lift: 0.08 });
  // The cap: the olive crown, the darker band, the gold badge, the black glossy peak.
  const crown = (x: number, y: number): boolean => ell(x, y, cx + 1, 25, 28, 15) < 1 && y < 34;
  p.paint((x, y, X, Y) => {
    if (!crown(x, y)) return null;
    const band = y > 28.5;
    const v = ellLight(x, y, cx - 4, 24, 30, 14, 0.08) - (band ? 0.22 : 0) - (Math.abs(y - 28.5) < 0.6 ? 0.25 : 0);
    return tone(GUSTO_OLIVE, v, X, Y, 0.3);
  });
  p.paint((x, y, X, Y) => {
    const q = ell(x, y, cx + 1, 23, 4.2, 4.8);
    if (q >= 1) return null;
    const t = ellLight(x, y, cx, 22, 4.6, 5, 0.12);
    return q > 0.62 ? tone(PAL_HD.gold, t * 0.75, X, Y, 0.2) : tone(PAL_HD.gold, t * 1.05, X, Y, 0.2);
  });
  p.dot(cx - 0.5, 21.5, PAL_HD.gold[7]);
  p.paint((x, y, X, Y) => {
    if (!inPeak(x, y)) return null;
    const u = (y - peakTop(x)) / 6;
    // Black gloss: dark, a specular streak along the top of the peak on the lit (left) side.
    const streak = u < 0.28 && x < cx + 4 && x > cx - 20 ? 0.55 - Math.abs(x - cx + 8) * 0.025 : 0;
    const v = 0.16 - u * 0.12 + Math.max(0, streak);
    return tone(GLOSS, v, X, Y, 0.2);
  });
  // The microphone in his fist: a black grille ball, a chrome ring and stem.
  const mx = 75;
  p.paint((x, y, X, Y) => {
    const q = ell(x, y, mx, 50, 8, 8);
    if (q >= 1) return null;
    let v = ellLight(x, y, mx - 2, 48, 8.5, 8.5, 0.06);
    // The grille: a fine grid of holes over the ball.
    if ((Math.floor(x * 1.5) + Math.floor(y * 1.5)) % 2 === 0 && q < 0.8) v -= 0.15;
    return tone(GLOSS, v * 0.95, X, Y, 0.2);
  });
  p.dot(mx - 3.5, 46.5, PAL_HD.snow[6]);
  p.paint((x, y, X, Y) => (ell(x, y, mx, 58.5, 5.5, 1.8) < 1 ? tone(CHROME, ellLight(x, y, mx - 2, 58, 6, 2.5, 0.1), X, Y, 0.2) : null));
  p.stroke([[mx, 60], [mx - 1, 76]], 3, 2.6, (_t, x, _y, X, Y) => tone(CHROME, 0.75 - Math.abs(x - mx + 1.2) * 0.25, X, Y, 0.2));
  // The fist: a lit block of fingers round the stem, knuckle lines, the thumb on top.
  p.paint((x, y, X, Y) => {
    const q = ell(x, y, mx - 1, 82, 10, 9);
    if (q >= 1 || y > 96) return null;
    let t = ellLight(x, y, mx - 4, 79, 11, 10, 0.08);
    const fy = (y - 77) / 3.4;
    if (fy > 0 && fy < 4 && Math.abs(fy - Math.round(fy)) < 0.12 && x > mx - 6) t -= 0.3;
    return tone(RUDDY, t * 1.05, X, Y, 0.3);
  });
  p.paint((x, y, X, Y) => (ell(x, y, mx - 5, 75, 5, 2.6) < 1 ? tone(RUDDY, ellLight(x, y, mx - 6, 74, 5, 3, 0.1) * 1.1, X, Y, 0.3) : null));
  // The ink frame (1 logical px, as the 1× panel).
  const b = p.b;
  b.rect(0, 0, b.w, d, PAL_HD.ink[0]).rect(0, b.h - d, b.w, d, PAL_HD.ink[0]).rect(0, 0, d, b.h, PAL_HD.ink[0]).rect(b.w - d, 0, d, b.h, PAL_HD.ink[0]);
  return b;
}

// --- The radio box of the mission intro (`ui/radio`) ------------------------------------------

/** The radio box: the 1× panel (x 16–368, y 120–200) with its ink edge, as one sprite. */
export const RADIO_BOX = { x: 15, y: 119, w: 354, h: 82 } as const;

/** 1×: the look of app.ts `drawPanel` over the box (the scene draws drawPanel itself at 1×). */
function radio1x(): PixelBuffer {
  const { w, h } = RADIO_BOX;
  const b = new PixelBuffer(w, h);
  b.rect(0, 0, w, h, INK);
  b.rect(1, 1, w - 2, h - 2, PAL.ui[0]);
  b.rect(1, 1, w - 2, 1, PAL.ui[1]);
  b.rect(1, 1, 1, h - 2, PAL.ui[1]);
  b.rect(2, h - 2, w - 3, 1, PAL.navy[0]);
  b.rect(w - 2, 2, 1, h - 3, PAL.navy[0]);
  return b;
}

/**
 * The radio box at density d: the front of a field radio in olive-drab painted steel (worn
 * edges, screws), a recessed bay for Gusto's portrait with a name slot and the signal meter under
 * it, and the dark glass screen the briefing types onto (faint scan lines, a cool glow).
 * Local coordinates: the box's top-left is (15, 119).
 */
function radioHd(d: HdD): PixelBuffer {
  const { w: W, h: H } = RADIO_BOX;
  const c = new HdCanvas(W, H, d);
  const drab: Ramp = [PAL_HD.ink[0], PAL_HD.olive[0], PAL_HD.olive[1], PAL_HD.olive[2], PAL_HD.olive[3], PAL_HD.olive[4], PAL_HD.olive[5]];
  const paint = c.material({ ramp: drab, lo: 1, hi: 5, spec: 0.15, shine: 12, wrap: 0.1 });
  const bare = c.material({ ramp: CHROME, lo: 2, hi: 5, spec: 0.5 });
  const screw = c.material({ ramp: CHROME, lo: 1, hi: 6, spec: 0.8, shine: 28 });
  const slot = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.steel[2]], lo: 0, hi: 3 });
  const glassR: Ramp = [PAL_HD.ink[0], PAL_HD.slate[0], PAL_HD.navy[0], PAL_HD.slate[1], PAL_HD.navy[1]];
  const glass = c.material({ ramp: glassR, flat: true, lo: 0, hi: 4, dither: 0.3 });
  const ink = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 0 });
  c.box(0, 0, W, H, { mat: ink, z: -1, round: 0 });
  c.box(1, 1, W - 2, H - 2, {
    mat: paint,
    z: 0,
    bevel: 1.2,
    tex: (s) => {
      const e = Math.min(s.x - 1, W - 1 - s.x, s.y - 1, H - 1 - s.y);
      if (e < 1.2 && noise2(s.x, s.y, 2.5, 811) > 0.78) s.mat = bare;
      s.tone += (noise2(s.x, s.y, 9, 813) - 0.5) * 0.18 - Math.max(0, s.v - 0.7) * 0.4;
    },
  });
  // Recesses: the portrait bay, the name slot, the signal meter, the screen.
  const rec = (x: number, y: number, w: number, h: number, floor: number, depth: number): void => {
    const p = c.newPart();
    c.erase(x - 0.5, y - 0.5, w + 1, h + 1, () => true);
    c.heightField(x - 0.5, y - 0.5, w + 1, h + 1, (px, py) => {
      const e = Math.min(px - (x - 0.5), x + w + 0.5 - px, py - (y - 0.5), y + h + 0.5 - py);
      return -Math.min(depth, (e * depth) / 0.8);
    }, {
      mat: floor,
      part: p,
      z: 0,
      tex: (s) => {
        const e = Math.min(s.x - (x - 0.5), x + w + 0.5 - s.x, s.y - (y - 0.5), y + h + 0.5 - s.y);
        if (e < 0.8) s.mat = paint;
        else if (floor === glass) {
          // Scan lines, a cool glow toward the upper left, darker edges.
          const u = (s.x - x) / w;
          const v = (s.y - y) / h;
          s.tone += 0.35 * Math.exp(-((u - 0.25) ** 2) * 6 - ((v - 0.3) ** 2) * 5) - 0.25 - (Math.floor(s.y * 2) % 3 === 0 ? 0.12 : 0);
          if (e < 2) s.tone -= 0.2 * (1 - e / 2);
        } else if (s.x - x < 1 || s.y - y < 1) s.tone -= 0.3;
      },
    });
  };
  rec(7, 7, 36, 36, slot, 1);
  rec(10, 43.5, 30, 9, slot, 0.6);
  rec(11, 55, 28, 10, slot, 0.6);
  rec(46, 3, W - 49, H - 6, glass, 1);
  for (const [x, y] of [
    [3.5, 3.5],
    [W - 3.5, 3.5],
    [3.5, H - 3.5],
    [W - 3.5, H - 3.5],
    [25, 69],
    [25, 75],
  ] as const) c.ellipsoid(x, y, 1.1, 1.1, { mat: screw, z: 1, round: 0.8 });
  return c.render({ outline: 'none', ao: 0.3, sep: false, shadow: 0.3, shadowMax: 1.5 });
}

// ---------------------------------------------------------------------------------------------
// The night base: the menu backdrop (docs/design/squad.md §2.3), drawn by scenes/base.ts
// ---------------------------------------------------------------------------------------------

/** The base's screen. */
const BASE_W = 384;
const BASE_H = 216;
/** The ground line of the base (hangars and mast stand on it). */
export const BASE_GROUND = 160;
/** The top of the sandbag wall; the patrol walks with its feet a little below it. */
export const BASE_WALL_TOP = 186;
/** The lattice radio mast (x of its axis, y of its top). */
export const BASE_MAST_X = 168;
export const BASE_MAST_TOP = 38;
/** The camo netting's centre x. */
const NET_X = 286;
/** The parked SWAN-3 under the netting: standing riderless, head up (her neck is in this strip). */
export const BASE_PARKED = 'vehicle/swan/shake';
/** `ui/base/land` covers the screen from this y down (nothing of the land is higher). */
export const BASE_LAND_Y = 28;
/** `ui/base/wall` covers the screen from this y down (the wire stakes start here). */
export const BASE_WALL_Y = BASE_WALL_TOP - 14;

/** The sprite ids of the backdrop layers, drawn back to front by scenes/base.ts. */
export const BASE_ART = {
  sky: 'ui/base/sky',
  land: 'ui/base/land',
  /** Two frames: 0 the netting hanging empty, 1 with the parked SWAN-3 under it. */
  net: 'ui/base/net',
  puff: 'ui/base/puff',
  wall: 'ui/base/wall',
} as const;

const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// --- 1× (the look of the menus since 2026-10-16; byte-identical to the old base.ts buffers) ---

function buildSky(): PixelBuffer {
  const W = BASE_W;
  const H = BASE_H;
  const b = new PixelBuffer(W, H);
  const bands: Color[] = [PAL.ink[0], PAL.ink[1], PAL.navy[0], PAL.navy[1]];
  const top = 0;
  const bottom = BASE_GROUND;
  for (let y = 0; y < H; y++) {
    const f = Math.min(0.999, Math.max(0, (y - top) / (bottom - top)));
    const pos = f * (bands.length - 1);
    const i = Math.floor(pos);
    const frac = pos - i;
    for (let x = 0; x < W; x++) {
      // Ordered 4 × 4 Bayer dither into the next band over the last 40 % of each band.
      const th = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const c = frac > 0.6 && th < (frac - 0.6) / 0.4 ? bands[Math.min(bands.length - 1, i + 1)] : bands[i];
      b.set(x, y, c);
    }
  }
  for (const s of baseStars()) {
    b.set(s.x, s.y, s.big ? PAL.snow[2] : s.bright ? PAL.steel[3] : PAL.steel[2]);
    if (s.big) b.set(s.x + 1, s.y, PAL.steel[2]);
  }
  // The far tree line.
  for (let x = 0; x < W; x++) {
    const h = 6 + Math.round(3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.23 + 1) + ((x * 37) % 5 === 0 ? 2 : 0));
    b.rect(x, BASE_GROUND - 8 - h, 1, h + 8, PAL.ink[1]);
  }
  return b;
}

interface Star {
  x: number;
  y: number;
  big: boolean;
  bright: boolean;
}

/** The 46 stars of the base sky (the same at every density). */
function baseStars(): Star[] {
  const rng = new Rng('base-sky');
  const out: Star[] = [];
  for (let i = 0; i < 46; i++) {
    const x = rng.int(0, BASE_W - 2);
    const y = rng.int(2, 110);
    const big = rng.next() < 0.15;
    const bright = big ? true : rng.next() < 0.5;
    out.push({ x, y, big, bright });
  }
  return out;
}

/** A quonset hangar: a half-round corrugated roof from x0 to x1 standing on the ground line. */
function hangar(b: PixelBuffer, x0: number, x1: number, h: number, door: { x: number; w: number; ajar: number }): void {
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const g = BASE_GROUND;
  for (let x = x0; x <= x1; x++) {
    const dx = (x - cx) / rx;
    const top = Math.round(g - h * Math.sqrt(Math.max(0, 1 - dx * dx)));
    for (let y = top; y < g; y++) {
      // Corrugation: vertical ribs every 4 px; moonlight on the upper left of the roof.
      const rib = (x - x0) % 4 === 0;
      let c: Color = rib ? PAL.navy[0] : PAL.steel[0];
      if (dx < -0.2 && y < top + 3) c = PAL.steel[1];
      b.set(x, y, c);
    }
    b.set(x, top, dx < 0 ? PAL.steel[2] : PAL.steel[1]);
    if (top > 0) b.set(x, top - 1, INK);
  }
  // The end wall door: dark, ajar with a slice of warm light, a gold glow spilling on the ground.
  const dy = g - Math.round(h * 0.62);
  b.rect(door.x - 1, dy - 1, door.w + 2, g - dy + 1, INK);
  b.rect(door.x, dy, door.w, g - dy, PAL.ink[1]);
  b.rect(door.x + door.w - door.ajar, dy, door.ajar, g - dy, PAL.gold[1]);
  b.rect(door.x + door.w - door.ajar, dy, 1, g - dy, PAL.gold[3]);
  b.rect(door.x + door.w - door.ajar - 2, g, door.ajar + 6, 1, PAL.gold[0]);
}

/** The lattice radio mast (base 12 px wide, tapering to 2) with its guy wires. */
function mast(b: PixelBuffer): void {
  const g = BASE_GROUND;
  const X = BASE_MAST_X;
  const T = BASE_MAST_TOP;
  const half = (y: number): number => 1 + Math.round(((y - T) / (g - T)) * 5);
  for (let y = T; y < g; y++) {
    const hw = half(y);
    b.set(X - hw, y, PAL.steel[1]);
    b.set(X + hw, y, PAL.steel[0]);
  }
  // Cross bracing: zig-zags between the legs every 8 px.
  for (let y = T + 4; y < g - 2; y += 8) {
    const a = half(y);
    const c = half(y + 8);
    b.line(X - a, y, X + c, y + 8, PAL.steel[0]);
    b.line(X + a, y, X - c, y + 8, PAL.navy[0]);
    b.hline(X - a, X + a, y, PAL.steel[1]);
  }
  // Guy wires to the ground.
  b.line(X, T + 20, X - 46, g, PAL.navy[0]);
  b.line(X, T + 20, X + 46, g, PAL.navy[0]);
  // The antenna tip and the dark lamp housings (the lights blink at draw time).
  b.vline(X, T - 8, T, PAL.steel[1]);
  b.rect(X - 1, T - 2, 3, 2, INK);
  b.rect(X - 2, T + 44, 5, 2, INK);
}

/** Camo netting draped from two poles over the parking spot (with or without a swan under it). */
function netting(b: PixelBuffer, parked: boolean): void {
  const g = BASE_GROUND + 14;
  const x0 = NET_X - 40;
  const x1 = NET_X + 52;
  if (parked && hasSprite(BASE_PARKED)) {
    const f = getFrames(BASE_PARKED, 1)[0];
    b.blitFrame(f, NET_X + 2, g);
  }
  // The net: a sagging canopy between two poles; holes let the dark (or the swan) show through.
  const poleL = x0 + 8;
  const poleR = x1 - 8;
  const topY = g - 54;
  b.rect(poleL, topY, 2, g - topY, PAL.brown[0]);
  b.rect(poleR, topY, 2, g - topY, PAL.brown[0]);
  for (let x = x0; x <= x1; x++) {
    // Canopy top: high over the poles, sagging between them; skirts slope to the ground outside.
    let top: number;
    if (x < poleL) top = topY + Math.round(((poleL - x) / (poleL - x0)) * (g - topY - 4));
    else if (x > poleR) top = topY + Math.round(((x - poleR) / (x1 - poleR)) * (g - topY - 4));
    else top = topY + 3 + Math.round(5 * Math.sin(((x - poleL) / (poleR - poleL)) * Math.PI));
    const skirt = x < poleL || x > poleR;
    const bottom = skirt ? g : top + 14 + ((x * 7) % 5);
    for (let y = top; y < bottom; y++) {
      const cell = ((x >> 1) + (y >> 1)) % 3;
      const hole = ((x + y) & 3) === 0 && ((x - y) & 3) === 0;
      if (hole && y > top + 1) continue;
      const patch = ((Math.floor(x / 9) * 7 + Math.floor(y / 6) * 3) % 4) as 0 | 1 | 2 | 3;
      const ramp: Color[] = [PAL.olive[0], PAL.olive[1], PAL.green[1], PAL.brown[1]];
      b.set(x, y, cell === 0 ? PAL.olive[0] : ramp[patch]);
    }
    b.set(x, top, x < NET_X ? PAL.olive[2] : PAL.olive[1]);
    if (top > 0) b.set(x, top - 1, INK);
    // Tassels of the hanging edge.
    if (!skirt && x % 3 === 0) b.vline(x, bottom, bottom + 2, PAL.olive[0]);
  }
}

/** The hangars, the mast, drums, a crate and the tarmac (the netting is its own layer). */
function buildLand(): PixelBuffer {
  const W = BASE_W;
  const b = new PixelBuffer(W, BASE_H);
  const g = BASE_GROUND;
  // Hangars: a big one on the left, a small one right of the mast.
  hangar(b, 8, 128, 46, { x: 92, w: 18, ajar: 4 });
  hangar(b, 196, 252, 28, { x: 214, w: 14, ajar: 0 });
  // The stove pipe on the big hangar (the smoke rises from it).
  b.rect(44, g - 52, 4, 10, PAL.steel[1]);
  b.rect(44, g - 52, 4, 1, PAL.steel[2]);
  b.rect(48, g - 52, 1, 10, INK);
  mast(b);
  // Fuel drums and crates by the small hangar.
  for (const x of [258, 266]) {
    b.rect(x, g - 9, 7, 9, PAL.olive[1]);
    b.rect(x, g - 9, 7, 1, PAL.olive[2]);
    b.rect(x, g - 5, 7, 1, PAL.olive[0]);
    b.rect(x + 6, g - 9, 1, 9, INK);
  }
  b.rect(150, g - 8, 12, 8, PAL.brown[1]);
  b.rect(150, g - 8, 12, 1, PAL.brown[2]);
  b.line(150, g - 8, 161, g - 1, PAL.brown[0]);
  // The ground: dark earth, a tarmac apron with painted dashes.
  b.rect(0, g, W, BASE_H - g, PAL.ink[1]);
  b.rect(0, g, W, 1, PAL.stone[0]);
  for (let x = 6; x < W; x += 22) b.rect(x, g + 10, 10, 1, PAL.stone[0]);
  return b.crop(0, BASE_LAND_Y, W, BASE_H - BASE_LAND_Y);
}

/** The box of the netting layer: the canopy and (when its art exists) the parked swan's frame. */
export function baseNetBox(): { x: number; y: number; w: number; h: number } {
  const g = BASE_GROUND + 14;
  let x0 = NET_X - 40;
  let x1 = NET_X + 53;
  let y0 = g - 55;
  let y1 = g;
  if (hasSprite(BASE_PARKED)) {
    const f = getFrames(BASE_PARKED, 1)[0];
    const fx = NET_X + 2 - f.ox;
    const fy = g - f.oy;
    x0 = Math.min(x0, fx);
    y0 = Math.min(y0, fy);
    x1 = Math.max(x1, fx + f.buf.w);
    y1 = Math.max(y1, fy + f.buf.h);
  }
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(BASE_W, x1);
  y1 = Math.min(BASE_H, y1);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function buildNet(parked: boolean): PixelBuffer {
  const full = new PixelBuffer(BASE_W, BASE_H);
  netting(full, parked);
  const box = baseNetBox();
  return full.crop(box.x, box.y, box.w, box.h);
}

/** One sandbag (16 × 8) at (x, y): a stuffed bag with rounded ends, a lit bulge, a dark crease, a tied ear. */
function sandbag(b: PixelBuffer, x: number, y: number, olive: boolean): void {
  const r = olive ? PAL.olive : PAL.sand;
  b.roundRect(x, y, 16, 8, 3, INK);
  b.roundRect(x + 1, y + 1, 14, 6, 2, r[1]);
  b.rect(x + 3, y + 1, 10, 2, r[2]);
  b.rect(x + 5, y + 1, 5, 1, r[3]);
  b.rect(x + 2, y + 5, 12, 1, r[0]);
  // The seam across the middle and the tied ear at the right end.
  b.vline(x + 8, y + 3, y + 5, r[0]);
  b.set(x + 14, y + 2, r[0]);
  b.set(x + 15, y + 3, r[1]);
}

interface Bag {
  x: number;
  y: number;
  olive: boolean;
  row: number;
}

/** The sandbags of the wall, back course first (the same at every density). */
function wallBags(): Bag[] {
  const rng = new Rng('base-wall');
  const out: Bag[] = [];
  for (let row = 2; row >= 0; row--) {
    const y = BASE_WALL_TOP + row * 6;
    for (let x = row % 2 ? -8 : -2; x < BASE_W; x += 15) {
      const dy = rng.int(0, 1);
      out.push({ x, y: y + dy, olive: rng.next() < 0.3, row });
    }
  }
  return out;
}

function buildWall(): PixelBuffer {
  const W = BASE_W;
  const b = new PixelBuffer(W, BASE_H);
  const top = BASE_WALL_TOP;
  // The ground in front of the wall.
  b.rect(0, top + 18, W, BASE_H - top - 18, PAL.ink[0]);
  b.rect(0, top + 4, W, 16, INK);
  // Three courses of bags, staggered, each bag a little higher or lower than its neighbours.
  for (const bag of wallBags()) sandbag(b, bag.x, bag.y, bag.olive);
  // Concertina wire on stakes above the wall: wide coils with a lit top, barbs along the strand.
  for (let x = 10; x < W; x += 48) {
    b.rect(x, top - 14, 2, 15, PAL.brown[0]);
    b.set(x, top - 14, PAL.brown[2]);
  }
  for (let x = -8; x < W + 8; x += 9) {
    b.ellipse(x, top - 13, 14, 12, PAL.steel[1], false);
  }
  for (let x = -8; x < W + 8; x += 9) {
    // The lit upper arc of each coil.
    b.set(x + 5, top - 13, PAL.steel[3]);
    b.set(x + 6, top - 13, PAL.steel[3]);
    b.set(x + 8, top - 13, PAL.steel[2]);
    // Barbs: a small cross on the strand.
    b.set(x + 2, top - 10, PAL.steel[3]);
    b.set(x + 1, top - 11, PAL.steel[2]);
    b.set(x + 3, top - 9, PAL.steel[2]);
  }
  return b.crop(0, BASE_WALL_Y, W, BASE_H - BASE_WALL_Y);
}

function buildPuff(): PixelBuffer {
  const b = new PixelBuffer(20, 12);
  b.ellipse(0, 0, 20, 12, PAL.stone[1]);
  b.ellipse(3, 1, 12, 7, PAL.stone[2]);
  return b;
}

// --- HD (2× and 4×): the same base painted natively, moonlit from the upper left ---

/** A dense density of the UHD art. */
type HdD = 2 | 4;

/** 8 × 8 Bayer threshold in [0, 1) at an art px (ordered dither of skies and big gradients). */
function bayer8(X: number, Y: number): number {
  const a = BAYER4[((Y & 3) << 2) | (X & 3)];
  const b = BAYER4[(((Y >> 2) & 1) << 3) | (((X >> 2) & 1) << 1)] >> 2;
  return (a * 4 + b + 0.5) / 64;
}

/** The night sky from the top down to the far trees (all PAL_HD; the 1× bands stay its anchors). */
const SKY_HD: readonly Color[] = [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.navy[1], PAL_HD.navy[2], PAL_HD.navy[3]];

/** Height of the far tree line above BASE_GROUND - 8 at logical x (a smooth version of the 1× profile, with crowns). */
function treeTop(x: number): number {
  let h = 6 + 3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.23 + 1);
  // Crowns: round bumps every ~2.6 px; one in five a tall narrow poplar (the 1× spikes).
  const sp = 2.6;
  const k = Math.floor(x / sp);
  let bump = 0;
  for (let j = k - 2; j <= k + 2; j++) {
    const poplar = hash1(j, 41) < 0.2;
    const cx = (j + 0.5) * sp + (hash1(j, 43) - 0.5) * 1.2;
    const rx = poplar ? 0.9 + hash1(j, 45) * 0.5 : 1.3 + hash1(j, 47) * 1.4;
    const ry = poplar ? 2.4 + hash1(j, 49) * 1.4 : rx * 0.8;
    const t = (x - cx) / rx;
    if (t * t >= 1) continue;
    bump = Math.max(bump, ry * Math.sqrt(1 - t * t) + (poplar ? 0.6 : 0));
  }
  return h + bump - 1;
}

function skyHd(d: HdD): PixelBuffer {
  const W = BASE_W * d;
  const H = BASE_H * d;
  const b = new PixelBuffer(W, H);
  const n = SKY_HD.length;
  const data = b.data;
  for (let Y = 0; Y < H; Y++) {
    const y = (Y + 0.5) / d;
    for (let X = 0; X < W; X++) {
      const x = (X + 0.5) / d;
      let f = Math.min(0.999, Math.max(0, y / BASE_GROUND));
      // A faint band of the galaxy rising from the lower left behind the logo.
      const band = Math.abs((x - 30) * 0.38 + (y - 150)) / 26;
      if (band < 1) f += 0.07 * (1 - band) * (0.55 + 0.45 * noise2(x, y, 9, 61));
      const pos = Math.min(n - 1.001, f * (n - 1));
      const i = Math.floor(pos);
      const frac = pos - i;
      // Hard bands with an ordered-dither zone over the second half of each.
      const c = frac > 0.45 && bayer8(X, Y) < (frac - 0.45) / 0.55 ? SKY_HD[i + 1] : SKY_HD[i];
      data[Y * W + X] = c;
    }
  }
  // Dust of faint stars (denser in the galaxy band), one art px each.
  const rng = new Rng(`base-sky-hd@${d}`);
  const many = d === 4 ? 520 : 260;
  for (let i = 0; i < many; i++) {
    const x = rng.range(0, BASE_W);
    const y = rng.range(1, 118);
    const band = Math.abs((x - 30) * 0.38 + (y - 150)) / 26;
    if (band > 1 && rng.next() < 0.45) continue;
    const r = rng.next();
    const c = r < 0.5 ? PAL_HD.navy[4] : r < 0.85 ? PAL_HD.steel[2] : PAL_HD.steel[3];
    b.set(Math.floor(x * d), Math.floor(y * d), c);
  }
  // The 46 stars of the 1× sky: a bright core with a twinkle cross on the big ones.
  for (const s of baseStars()) {
    const X = s.x * d + (d >> 1) - 1;
    const Y = s.y * d + (d >> 1) - 1;
    if (s.big) {
      const arm = d === 4 ? 3 : 1;
      for (let k = 1; k <= arm; k++) {
        const c = k === 1 ? PAL_HD.steel[5] : k === 2 ? PAL_HD.steel[4] : PAL_HD.steel[3];
        b.set(X - k, Y, c);
        b.set(X + k + (d === 4 ? 1 : 0), Y, c);
        b.set(X, Y - k, c);
        b.set(X, Y + k + (d === 4 ? 1 : 0), c);
      }
      b.rect(X, Y, d === 4 ? 2 : 1, d === 4 ? 2 : 1, PAL_HD.snow[6]);
      if (d === 4) {
        b.set(X + 1, Y, PAL_HD.snow[5]);
        b.set(X + 1, Y + 1, PAL_HD.snow[4]);
      }
    } else if (d === 4) {
      b.rect(X, Y, 2, 2, s.bright ? PAL_HD.steel[4] : PAL_HD.steel[3]);
      b.set(X, Y, s.bright ? PAL_HD.steel[6] : PAL_HD.steel[4]);
    } else b.set(X, Y, s.bright ? PAL_HD.steel[5] : PAL_HD.steel[3]);
  }
  // The far tree line: dark crowns, the moon catching the upper left of each one.
  for (let X = 0; X < W; X++) {
    const x = (X + 0.5) / d;
    const top = BASE_GROUND - 8 - treeTop(x);
    const tl = BASE_GROUND - 8 - treeTop(x - 1 / d);
    const tr = BASE_GROUND - 8 - treeTop(x + 1 / d);
    const Y0 = Math.max(0, Math.floor(top * d));
    for (let Y = Y0; Y < BASE_GROUND * d; Y++) {
      const y = (Y + 0.5) / d;
      if (y < top) continue;
      let c: Color = PAL_HD.ink[1];
      const depth = y - top;
      // Moonlit rim: 1 art px on edges that face up-left; a darker core low in each crown.
      if (depth < 1 / d + 0.01 && tl >= top - 0.05) c = PAL_HD.slate[2];
      else if (depth > 2.5 && noise2(x, y, 1.6, 67) < 0.38) c = PAL_HD.ink[0];
      else if (depth < 1.5 && tr < top - 0.3 && noise2(x, y, 1.2, 71) < 0.5) c = PAL_HD.navy[1];
      b.set(X, Y, c);
    }
  }
  return b;
}

/** The night ramps of the base (moonlight: dark mid tones, cool highlights; all PAL_HD). */
const NIGHT_STEEL: Ramp = [PAL_HD.ink[0], PAL_HD.steel[0], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.steel[3], PAL_HD.steel[4], PAL_HD.steel[6]];
const NIGHT_WALL: Ramp = [PAL_HD.ink[0], PAL_HD.navy[0], PAL_HD.steel[0], PAL_HD.navy[2], PAL_HD.steel[1], PAL_HD.steel[2], PAL_HD.steel[4]];
const NIGHT_TARMAC: Ramp = [PAL_HD.ink[0], PAL_HD.ink[1], PAL_HD.stone[0], PAL_HD.stone[1], PAL_HD.stone[2]];
const NIGHT_OLIVE: Ramp = [PAL_HD.olive[0], PAL_HD.olive[1], PAL_HD.olive[2], PAL_HD.olive[3], PAL_HD.olive[4], PAL_HD.olive[6]];
const NIGHT_WOOD: Ramp = [PAL_HD.brown[0], PAL_HD.brown[1], PAL_HD.brown[2], PAL_HD.brown[3], PAL_HD.brown[4], PAL_HD.brown[6]];
/** Warm hangar light (emissive). */
const LAMP: Ramp = [PAL_HD.gold[1], PAL_HD.gold[2], PAL_HD.gold[3], PAL_HD.gold[4], PAL_HD.gold[5], PAL_HD.gold[6]];

interface DoorDef {
  x: number;
  w: number;
  ajar: number;
}

/**
 * A quonset hangar end-on (the 1× silhouette): the corrugated roof sheet as a thick rolled band
 * along the arch with rib ridges and rivets, the end wall recessed behind it with vertical
 * corrugation, grime streaks, the door (ink) with a slice of warm light when ajar, a lamp over
 * the door and a stencil number plate.
 */
function hangarHd(c: HdCanvas, x0: number, x1: number, h: number, door: DoorDef, yo: number, seed: number): void {
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2 + 0.5;
  const g = BASE_GROUND - yo;
  const R = (rx + h) / 2;
  const band = Math.max(2, h * 0.055);
  const roof = c.material({ ramp: NIGHT_STEEL, lo: 1, hi: 5, spec: 0.45, shine: 22, wrap: 0.05 });
  const wall = c.material({ ramp: NIGHT_WALL, lo: 1, hi: 5, spec: 0.12, shine: 10, wrap: 0.1 });
  const dyTop = g - Math.round(h * 0.62);
  const inDoor = (x: number, y: number): boolean => x >= door.x - 1 && x < door.x + door.w + 1 && y >= dyTop - 1;
  const part = c.newPart();
  const radial = (x: number, y: number): number => {
    const dx = (x - cx) / rx;
    const dy = (g - y) / h;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const tex: Texture = (s) => {
    const q = radial(s.x, s.y);
    const dist = (1 - q) * R;
    if (dist >= band) {
      s.mat = wall;
      // Vertical streaks of grime under the roof edge, rust runs low on the wall.
      const n = noise2(s.x * 3, s.y * 0.25, 2, seed);
      if (n > 0.72) s.tone -= (n - 0.72) * 1.1;
      if (g - s.y < 3 && noise2(s.x, s.y, 1.5, seed + 3) > 0.6) s.tone -= 0.18;
    }
  };
  c.heightField(x0 - 1, g - h - 1, x1 - x0 + 3, h + 1, (x, y) => {
    if (y > g) return NaN;
    const q = radial(x, y);
    if (q > 1) return NaN;
    const dist = (1 - q) * R;
    if (dist < band) {
      // The rolled roof edge: up from the outside, down again at the inner lip; ribs across it.
      const t = dist / band;
      const theta = Math.atan2(g - y, x - cx);
      const rib = 0.16 * Math.sin(theta * R * 1.6);
      return 1.1 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1))) + rib;
    }
    if (inDoor(x, y)) return -0.4;
    // The end wall: recessed, vertical corrugation every 4 px (as the 1× ribs).
    const u = (((x - x0) % 4) + 4) % 4;
    return -0.5 + 0.22 * Math.cos((u / 4) * Math.PI * 2);
  }, { mat: roof, part, z: 0, tex });
  // Rivets along the roof edge (4×: a lit head with a dark foot).
  if (c.d === 4) {
    const n = Math.round((Math.PI * R) / 3.2);
    for (let i = 1; i < n; i++) {
      const th = (Math.PI * i) / n;
      const rr = 1 - (band * 0.5) / R;
      const x = cx + Math.cos(th) * rx * rr;
      const y = g - Math.sin(th) * h * rr;
      c.dot(x - 0.125, y - 0.125, PAL_HD.steel[4]);
      c.dot(x + 0.125, y + 0.125, PAL_HD.ink[0]);
    }
  }
  // The door: an ink frame, the dark inside, a slice of warm light when it stands ajar.
  const d = c.d;
  c.paint(door.x - 1, dyTop - 1, door.w + 2, g - dyTop + 1, (x, y) => {
    if (x < door.x || x >= door.x + door.w || y < dyTop) return PAL_HD.ink[0];
    const lx = x - (door.x + door.w - door.ajar);
    if (door.ajar > 0 && lx >= 0) {
      // Brightest at the gap's edge, warm light lower down where the floor lamp is.
      const v = 1 - lx / door.ajar;
      const low = (y - dyTop) / (g - dyTop);
      const k = Math.min(LAMP.length - 1, Math.floor(1.5 + v * 2.6 + low * 1.4 + (bayer8(Math.floor(x * d), Math.floor(y * d)) - 0.5) * 0.6));
      return lx < 1 / d ? PAL_HD.gold[6] : LAMP[Math.max(0, k)];
    }
    // The inside: dark, a faint plank line pattern.
    return ((x - door.x) % 3 < 1 / d ? PAL_HD.ink[0] : PAL_HD.ink[1]) as Color;
  });
  // A little lamp over the door and a stencil plate beside it.
  const lx = door.x + door.w / 2;
  c.box(lx - 2, dyTop - 4.5, 4, 2, { mat: roof, z: 1, bevel: 0.5, r: 0.5 });
  c.paint(lx - 1.25, dyTop - 2.75, 2.5, 0.75, () => (door.ajar > 0 ? PAL_HD.gold[5] : PAL_HD.gold[3]));
  if (door.ajar === 0) c.paint(lx - 1, dyTop - 2.75, 2, 0.5, () => PAL_HD.gold[2]);
  const px = door.x - 9;
  c.box(px, dyTop + 2, 6, 4, { mat: c.material({ ramp: NIGHT_OLIVE, lo: 1, hi: 4 }), z: 0.2, bevel: 0.4 });
  c.paint(px + 2, dyTop + 2.75, 2, 2.5, (x, y) => ((x - px - 2) < 0.75 || (y - dyTop - 2.75) < 0.5 || (y - dyTop - 2.75) > 2 ? PAL_HD.sand[3] : 0));
}

/** The lattice radio mast: tapered steel legs, cross braces, the antenna and its lamp housings. */
function mastHd(c: HdCanvas, yo: number): void {
  const X = BASE_MAST_X;
  const T = BASE_MAST_TOP - yo;
  const g = BASE_GROUND - yo;
  const steel = c.material({ ramp: NIGHT_STEEL, lo: 1, hi: 5, spec: 0.6, shine: 26, wrap: 0.05 });
  const half = (y: number): number => 1 + ((y - T) / (g - T)) * 5;
  const part = c.newPart();
  c.capsule(X - half(T), T, X - half(g), g, 0.42, 0.55, { mat: steel, z: 1, part });
  c.capsule(X + half(T), T, X + half(g), g, 0.42, 0.55, { mat: steel, z: 1, part, tone: -0.12 });
  for (let y = T + 4; y < g - 2; y += 8) {
    const a = half(y);
    const b = half(y + 8);
    c.capsule(X - a, y, X + b, y + 8, 0.26, 0.26, { mat: steel, z: 0.6, tone: -0.1 });
    c.capsule(X + a, y, X - b, y + 8, 0.26, 0.26, { mat: steel, z: 0.5, tone: -0.25 });
    c.capsule(X - a, y, X + a, y, 0.3, 0.3, { mat: steel, z: 1.2 });
  }
  // The antenna and the dark lamp housings (the lights blink at draw time).
  c.capsule(X, T - 8, X, T, 0.3, 0.38, { mat: steel, z: 1 });
  c.box(X - 1.5, T - 2.5, 4, 2.5, { mat: steel, z: 1.5, bevel: 0.4, tone: -0.35 });
  c.box(X - 2.5, T + 43.5, 6, 2.5, { mat: steel, z: 1.5, bevel: 0.4, tone: -0.35 });
}

function landHd(d: HdD): PixelBuffer {
  const yo = BASE_LAND_Y;
  const W = BASE_W;
  const H = BASE_H - yo;
  const c = new HdCanvas(W, H, d);
  const g = BASE_GROUND - yo;
  hangarHd(c, 8, 128, 46, { x: 92, w: 18, ajar: 4 }, yo, 11);
  hangarHd(c, 196, 252, 28, { x: 214, w: 14, ajar: 0 }, yo, 13);
  // The stove pipe on the big hangar with its rain cap.
  const steel = c.material({ ramp: NIGHT_STEEL, lo: 1, hi: 5, spec: 0.5, shine: 20 });
  c.cylinder(44, g - 52, 4, 11, { mat: steel, z: 2, cap: 1.2 });
  c.box(43, g - 53.5, 6, 1.4, { mat: steel, z: 2.5, bevel: 0.4, r: 0.3 });
  mastHd(c, yo);
  // Fuel drums: olive cylinders with rolled hoops and a lid; rust weeping from the hoops.
  const olive = c.material({ ramp: NIGHT_OLIVE, lo: 1, hi: 4, spec: 0.35, shine: 16 });
  for (const [i, x] of [258, 266].entries()) {
    const p = c.newPart();
    c.cylinder(x, g - 9, 7, 9, { mat: olive, z: 1, part: p, cap: 1.6, tex: grime(83 + i, 0.5, 2) });
    for (const hy of [g - 6.4, g - 2.8]) c.cylinder(x - 0.15, hy, 7.3, 0.7, { mat: olive, z: 1.3, tone: 0.1 });
    c.shade(x, g - 6, 7, 3, (sx, sy) => (noise2(sx * 4, sy, 1, 89 + i) > 0.7 ? -0.25 : 0), p);
  }
  // The crate: planks with grain, a diagonal brace, nail heads.
  const wd = c.material({ ramp: NIGHT_WOOD, lo: 1, hi: 4, spec: 0.15, shine: 8 });
  c.box(150, g - 8, 12, 8, { mat: wd, z: 1, bevel: 0.5, tex: wood({ seed: 5, dir: 'h', plank: 2.67 }) });
  c.capsule(150.8, g - 7.3, 161.2, g - 0.8, 0.5, 0.5, { mat: wd, z: 1.6, tone: -0.1 });
  // The tarmac: patched asphalt with cracks and worn dashes, the warm spill from the open door.
  const tar = c.material({ ramp: NIGHT_TARMAC, lo: 1, hi: 3, dither: 0.3 });
  c.plane(0, g, W, H - g, {
    mat: tar,
    z: -1,
    normal: (x, y, out) => {
      out[0] = 0;
      out[1] = -0.35;
      out[2] = 1;
      const n = noise2(x, y * 2, 3, 97);
      out[0] += (noise2(x, y * 2, 0.8, 99) - 0.5) * 0.4;
      out[1] += (n - 0.5) * 0.3;
    },
    tex: texAll(grime(101, 0.7, 5), (s) => {
      // Cracks: thin dark lines along the noise's zero set.
      const v = noise2(s.x * 0.8, s.y * 1.6, 4, 103);
      if (Math.abs(v - 0.5) < 0.012 * (4 / s.d)) s.tone -= 0.5;
    }),
  });
  const out = c.render({ outline: 'none', sep: false, ao: 0.4, shadow: 0.3, shadowMax: 4 });
  // Over the render: the lit ground edge, the painted dashes, the guy wires, the light spill.
  const G = g * d;
  for (let X = 0; X < W * d; X++) out.set(X, G, PAL_HD.stone[1]);
  for (let x = 6; x < W; x += 22) {
    for (let X = x * d; X < (x + 10) * d; X++) {
      for (let Y = (g + 10) * d; Y < (g + 11) * d; Y++) {
        const wear = hash2(X >> 1, Y >> 1, 107);
        out.set(X, Y, wear < 0.18 ? PAL_HD.stone[0] : wear < 0.85 ? PAL_HD.stone[2] : PAL_HD.stone[3]);
      }
    }
  }
  const wire = (x0: number, y0: number, x1: number, y1: number): void => {
    out.line(Math.round(x0 * d), Math.round(y0 * d), Math.round(x1 * d), Math.round(y1 * d), PAL_HD.navy[3]);
  };
  const T = BASE_MAST_TOP - yo;
  wire(BASE_MAST_X, T + 20, BASE_MAST_X - 46, g);
  wire(BASE_MAST_X, T + 20, BASE_MAST_X + 46, g);
  // The open door throws a warm trapezoid on the tarmac.
  const dl = 92 + 18 - 4;
  for (let Y = G + 1; Y < (g + 14) * d; Y++) {
    const t = (Y - G) / (14 * d);
    const xa = (dl - 1 - t * 3) * d;
    const xb = (dl + 4 + t * 12) * d;
    for (let X = Math.floor(xa); X < xb; X++) {
      const v = (1 - t) * (1 - Math.abs((X - (xa + xb) / 2) / ((xb - xa) / 2)) * 0.6);
      const th = bayer8(X, Y);
      if (v * 0.9 > th + 0.15) out.set(X, Y, v > 0.62 ? PAL_HD.gold[2] : v > 0.4 ? PAL_HD.gold[1] : PAL_HD.brown[2]);
    }
  }
  return out;
}

/**
 * The camo netting at density d over baseNetBox(): olive, green and brown patches of cut
 * garnish with lit tufts and irregular holes, the poles and the hanging tassels; frame 1 has the
 * parked SWAN-3 (her HD frame) under it.
 */
function netHd(parked: boolean, d: HdD): PixelBuffer {
  const box = baseNetBox();
  const out = new PixelBuffer(box.w * d, box.h * d);
  const g = BASE_GROUND + 14;
  if (parked && hasSprite(BASE_PARKED)) {
    const deferred = setDeferDense(false);
    try {
      const f = getFrames(BASE_PARKED, d)[0];
      // (x, y) in this buffer's px: the anchor at the 1× spot, d art px per logical px.
      out.blitFrame(f, (NET_X + 2 - box.x) * d, (g - box.y) * d, undefined, d);
    } finally {
      setDeferDense(deferred);
    }
  }
  const c = new HdCanvas(box.w, box.h, d);
  const ox = box.x;
  const oy = box.y;
  const x0 = NET_X - 40;
  const x1 = NET_X + 52;
  const poleL = x0 + 8;
  const poleR = x1 - 8;
  const topY = g - 54;
  const wd = c.material({ ramp: NIGHT_WOOD, lo: 1, hi: 4, spec: 0.1 });
  c.capsule(poleL + 1 - ox, topY - oy, poleL + 1 - ox, g - oy, 0.7, 0.85, { mat: wd, z: 0, tex: wood({ seed: 3, dir: 'v' }) });
  c.capsule(poleR + 1 - ox, topY - oy, poleR + 1 - ox, g - oy, 0.7, 0.85, { mat: wd, z: 0, tex: wood({ seed: 4, dir: 'v' }) });
  const mats = [
    c.material({ ramp: [PAL_HD.olive[0], PAL_HD.olive[1], PAL_HD.olive[2], PAL_HD.olive[3], PAL_HD.olive[4], PAL_HD.olive[5]], lo: 1, hi: 4, wrap: 0.2 }),
    c.material({ ramp: [PAL_HD.green[0], PAL_HD.green[1], PAL_HD.green[2], PAL_HD.green[3], PAL_HD.green[4]], lo: 1, hi: 3, wrap: 0.2 }),
    c.material({ ramp: [PAL_HD.brown[0], PAL_HD.brown[1], PAL_HD.brown[2], PAL_HD.brown[3], PAL_HD.brown[4]], lo: 1, hi: 3, wrap: 0.2 }),
  ];
  const topAt = (x: number): number => {
    if (x < poleL) return topY + ((poleL - x) / (poleL - x0)) * (g - topY - 4);
    if (x > poleR) return topY + ((x - poleR) / (x1 + 1 - poleR)) * (g - topY - 4);
    return topY + 3 + 5 * Math.sin(((x - poleL) / (poleR - poleL)) * Math.PI);
  };
  const bottomAt = (x: number): number => (x < poleL || x > poleR ? g : topAt(x) + 14 + 2 * noise2(x, 0, 2.2, 113) + 1.5);
  const net: Texture = (s) => {
    const x = s.x + ox;
    const y = s.y + oy;
    // Patches: large soft camo shapes, three cloths.
    const n = noise2(x, y, 7, 117) * 0.7 + noise2(x, y, 3, 119) * 0.3;
    s.mat = n < 0.4 ? mats[0] : n < 0.62 ? mats[1] : n < 0.8 ? mats[0] : mats[2];
    // Garnish tufts: little bumps, the light catching their tops.
    const t = noise2(x, y, 0.9, 121);
    s.nx += (noise2(x + 0.3, y, 0.9, 121) - t) * 3;
    s.ny += (noise2(x, y + 0.3, 0.9, 121) - t) * 3 - 0.15;
    // Holes: irregular, never in the top hem.
    if (y > topAt(x) + 1.2 && noise2(x, y, 1.1, 123) < 0.2) s.cut = true;
  };
  c.plane(x0 - ox, topY - oy - 1, x1 - x0 + 1, g - topY + 1, {
    mat: mats[0],
    z: 1,
    mask: (x, y) => {
      const X = x + ox;
      const Y = y + oy;
      return X >= x0 && X < x1 + 1 && Y >= topAt(X) && Y < bottomAt(X);
    },
    normal: (x, y, o) => {
      // The canopy drapes: the skirts slope away from the poles, the top hem rolls back.
      const X = x + ox;
      const Y = y + oy;
      o[0] = X < poleL ? -0.5 : X > poleR ? 0.5 : 0;
      o[1] = Y - topAt(X) < 1.2 ? -0.8 : -0.1;
      o[2] = 1;
    },
    tex: net,
  });
  // The tassels of the hanging edge (between the poles).
  for (let x = poleL + 1; x < poleR; x += 3) {
    const b = bottomAt(x);
    c.capsule(x - ox, b - oy - 0.6, x + 0.2 - ox, b + 2 - oy, 0.3, 0.22, { mat: mats[0], z: 1.1, tone: -0.1 });
  }
  const netBuf = c.render({ outline: 'none', sep: false, ao: 0.3 });
  out.blit(netBuf, 0, 0);
  return out;
}

/**
 * The sandbag wall and its concertina wire at density d: stuffed bags of coarse cloth (a lit
 * bulge, a seam, creases, a tied ear), staggered in three courses on dark ground; coils of steel
 * wire on wooden stakes with barbs along the strand.
 */
function wallHd(d: HdD): PixelBuffer {
  const yo = BASE_WALL_Y;
  const W = BASE_W;
  const H = BASE_H - yo;
  const c = new HdCanvas(W, H, d);
  const top = BASE_WALL_TOP - yo;
  const sand = c.material({ ramp: PAL_HD.sand, lo: 1, hi: 6, wrap: 0.12, spec: 0.08 });
  const olive = c.material({ ramp: PAL_HD.olive, lo: 1, hi: 6, wrap: 0.12, spec: 0.08 });
  const cloth = (seed: number): Texture => (s) => {
    // Coarse weave (only at 4×) and soft lumps of the filling.
    if (s.d === 4) s.tone += ((s.X + s.Y) & 1 ? 0.03 : -0.03) + (((s.X >> 1) + (s.Y >> 1)) % 3 === 0 ? -0.04 : 0);
    const n = noise2(s.x, s.y, 2.2, seed);
    s.nx += (n - 0.5) * 0.5;
    s.ny += (noise2(s.x + 7, s.y, 2.2, seed) - 0.5) * 0.4;
  };
  for (const [i, bag] of wallBags().entries()) {
    const x = bag.x;
    const y = bag.y - yo;
    const z = (2 - bag.row) * 2 + (x + 10) * 0.0005;
    const mat = bag.olive ? olive : sand;
    const p = c.newPart();
    const pts: [number, number][] = [];
    // A pillow outline: rounded ends, a little fuller in the middle.
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const ex = Math.cos(a);
      const ey = Math.sin(a);
      const r = 1 / Math.pow(Math.pow(Math.abs(ex), 3.2) + Math.pow(Math.abs(ey), 3.2), 1 / 3.2);
      pts.push([x + 8 + ex * r * 7.7, y + 4 + ey * r * 3.8]);
    }
    c.blob(pts, 2.6, { mat, part: p, z, bulge: 0.45, tex: cloth(131 + i) });
    // The seam across the middle, creases toward the tied ear, the ear itself.
    c.shade(x + 7.6, y + 2.4, 0.8, 3.4, () => -0.45, p);
    c.shade(x + 2, y + 1, 12, 6, (sx, sy) => {
      const u = sx - x;
      const v = sy - y;
      const cr = Math.abs(v - 3.2 - (u - 11) * 0.35);
      return u > 10 && cr < 0.3 ? -0.3 : 0;
    }, p);
    c.ellipsoid(x + 15.2, y + 3.4, 1.1, 0.9, { mat, z: z + 0.3, tone: -0.15 });
  }
  // The dark ground under and in front of the wall.
  const shadow = c.material({ ramp: [PAL_HD.ink[0], PAL_HD.ink[0], PAL_HD.ink[1]], flat: true, lo: 0, hi: 1 });
  c.plane(0, top + 4, W, H - top - 4, { mat: shadow, z: -2, tone: -0.4 });
  // Stakes and wire.
  const wd = c.material({ ramp: NIGHT_WOOD, lo: 1, hi: 4, spec: 0.1 });
  for (let x = 10; x < W; x += 48) c.capsule(x + 1, top - 14 + 0.6, x + 1, top + 2, 0.75, 0.85, { mat: wd, z: -1, tex: wood({ seed: x, dir: 'v' }) });
  const wire = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 4, spec: 1, shine: 30 });
  const wirePart = c.newPart();
  for (let x = -8; x < W + 8; x += 9) {
    const cx = x + 7;
    const cy = top - 7;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * 6.6, cy + Math.sin(a) * 5.6]);
    }
    c.stroke(pts, 0.26, 0.26, { mat: wire, z: -0.5, part: wirePart });
    // Barbs: little crosses along the strand on the lower left of each coil.
    for (const a of [2.4, 3.6]) {
      const bx = cx + Math.cos(a) * 6.6;
      const by = cy + Math.sin(a) * 5.6;
      c.capsule(bx - 0.6, by - 0.6, bx + 0.6, by + 0.6, 0.18, 0.18, { mat: wire, z: -0.4, part: wirePart });
      c.capsule(bx - 0.6, by + 0.6, bx + 0.6, by - 0.6, 0.18, 0.18, { mat: wire, z: -0.4, part: wirePart });
    }
  }
  return c.render({ outline: 'none', sep: true, sepZ: 0.8, ao: 0.4, shadow: 0.35, shadowMax: 3 });
}

/** A smoke puff (20 × 12): two soft lumps, lit from the upper left, no outline. */
function puffHd(d: HdD): PixelBuffer {
  const c = new HdCanvas(20, 12, d);
  const smoke = c.material({ ramp: [PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4], PAL_HD.stone[5]], lo: 0, hi: 4, wrap: 0.35 });
  const p = c.newPart();
  // A billow of lumps (not one disc): a flat underside, round heads on top, lit upper left.
  const lumps: readonly (readonly [number, number, number, number, number])[] = [
    [4.2, 7.6, 3.6, 3.2, 0],
    [8.4, 7.4, 4.2, 3.9, 0.6],
    [13, 7.8, 3.9, 3.4, 0.4],
    [16.6, 8.4, 3, 2.7, 0],
    [7, 4.6, 3.4, 3, 1.4],
    [11.4, 4, 3.8, 3.4, 1.8],
    [15, 5.6, 2.6, 2.4, 1],
  ];
  for (const [x, y, rx, ry, z] of lumps) c.ellipsoid(x, y, rx, ry, { mat: smoke, part: p, z, round: 0.9 });
  return c.render({ outline: 'none', sep: false, ao: 0 });
}

/** Register the backdrop layers (1× as since 2026-10-16; HD at 2× and 4×). */
function defineBaseArt(): void {
  defineSprite(BASE_ART.sky, () => [buildSky()], { ...topLeft, hd: (d) => [skyHd(d)] });
  defineSprite(BASE_ART.land, () => [buildLand()], { ...topLeft, hd: (d) => [landHd(d)] });
  defineSprite(BASE_ART.net, () => [buildNet(false), buildNet(true)], { ...topLeft, hd: (d) => [netHd(false, d), netHd(true, d)] });
  defineSprite(BASE_ART.puff, () => [buildPuff()], { ...topLeft, hd: (d) => [puffHd(d)] });
  defineSprite(BASE_ART.wall, () => [buildWall()], { ...topLeft, hd: (d) => [wallHd(d)] });
}

export function defineScreenArt(): void {
  defineBaseArt();
  defineSprite('ui/newspaper', newspaper, topLeft);
  defineSprite('ui/stamp', stampFrames);
  defineSprite('ui/portrait-gusto', gustoPortrait, { ...topLeft, hd: (d) => [gustoPortraitHd(d)] });
  defineSprite('ui/radio', () => [radio1x()], { ...topLeft, hd: (d) => [radioHd(d)] });
  defineSprite('ui/title-swan', titleSwanFrames, { ticksPerFrame: 30 });
  defineSprite('ui/parade', paradeFrames, { ticksPerFrame: 10 });
}
