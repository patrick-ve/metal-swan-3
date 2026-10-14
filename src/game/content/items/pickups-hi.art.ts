/**
 * 2× pickup sprites (mission ams; docs/ART_GUIDE.md "2x art (mission ams)"): the same pickups as
 * pickups.art.ts seen closer — the same logical size, anchor and frame count, a 2-px (= 1 logical
 * px) INK outline where the 1× art has one, palette only, light from the top-left, and the 2×
 * grid used for finer inner detail (milled medallion rims, embossed letters, record grooves,
 * scored crust, cheese holes with a shadowed wall, case pleats, gem facets).
 *
 * Every builder takes the 1× strip (`lo`) and returns one density-2 frame per 1× frame with
 * the 1× anchor (`asHi`); the buffers are exactly twice the 1× buffers. Item ids: the keys of
 * `PICKUP_HI` (weapon medallions: `weaponStripHi`, registered from `defineWeaponPickup` in
 * pickups.art.ts).
 */
import { ascii, type AsciiKey } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { HI, HiPen, asHi, outlineHi } from '../../art/hi';

/** A hand-drawn 2× item: rows (2× px) → buffer with the 2-px INK outline (the 1× `pix`). */
function pixHi(rows: readonly string[], key: AsciiKey, detail?: (b: PixelBuffer) => void): PixelBuffer {
  const b = ascii(rows, key);
  detail?.(b);
  return outlineHi(b.padded(HI), HI);
}

/** Is this pixel part of the art (opaque, not the outline)? */
function inside(b: PixelBuffer, x: number, y: number): boolean {
  const c = b.get(x, y);
  return (c & 255) !== 0 && c !== INK;
}

/** Set a 2× pixel only on the art (glints stay inside the shape and off the outline). */
function glintHi(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (inside(b, x, y)) b.set(x, y, c);
}

/** A small sparkle on the art: a white core with a short lit tail up-left (frame glints). */
function sparkleHi(b: PixelBuffer, x: number, y: number): void {
  glintHi(b, x, y, PAL.snow[3]);
  glintHi(b, x + 1, y, PAL.snow[3]);
  glintHi(b, x, y + 1, PAL.snow[3]);
  glintHi(b, x - 1, y - 1, PAL.snow[2]);
}

/** The 4-point twinkle at 2×: a white core (one logical px) with gold arms that fade at the tips, also outside the shape. */
function twinkleHi(b: PixelBuffer, x: number, y: number): void {
  b.rect(x, y, 2, 2, PAL.snow[3]);
  for (const [k, c] of [[1, PAL.gold[3]], [2, PAL.gold[2]]] as const) {
    b.rect(x - k, y, 1, 2, c);
    b.rect(x + 1 + k, y, 1, 2, c);
    b.rect(x, y - k, 2, 1, c);
    b.rect(x, y + 1 + k, 2, 1, c);
  }
}

// ------------------------------------------------------------------------------------ weapons

/**
 * The 2× weapon medallion (38 × 38): a milled gold rim lit up-left with a fine bevel ring, an
 * ivory face with a soft lower crescent, the crate letter in the big font on the 2× grid (one
 * logical px strokes, crisp) with a pale engraved shadow down-right, a cut-gem family pip and
 * the diagonal glint.
 */
function weaponPlateHi(letter: string, glintAt: number, accent: Color): PixelBuffer {
  const S = 38;
  const b = new PixelBuffer(S, S);
  const c = 18.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      if (d > 17) continue;
      // Light from the top-left: + on the lit side, − in the shadow.
      const lit = -(dx + dy) / Math.max(d, 0.001);
      let col: Color;
      if (d > 15.4) col = lit > 0.35 ? PAL.gold[2] : PAL.gold[1];
      else if (d > 13.1) {
        col = PAL.gold[2];
        if (d > 13.9 && d <= 14.9 && lit > 0.2) col = PAL.gold[3];
        // Milled edge: a short dark tick every 15°, on the shaded half only.
        const a = Math.atan2(dy, dx);
        const step = Math.PI / 12;
        const m = Math.abs(a / step - Math.round(a / step));
        if (m < 0.18 && lit < 0.2 && d > 13.6) col = PAL.gold[1];
      } else if (d > 12.3 && lit < -0.2) col = PAL.gold[1];
      else {
        col = Math.hypot(x - 17.5, y - 17.5) < 11.2 ? PAL.snow[3] : PAL.snow[2];
        // Lower crescent in the face's shadow (the 1× face's shaded bottom row).
        if (d <= 12.3 && Math.hypot(x - c, y - (c - 2.5)) > 12.3) col = PAL.stone[3];
        else if (d > 12.3) col = PAL.snow[2];
      }
      b.set(x, y, col);
    }
  }
  // The family pip on the bottom of the rim: a little cut stone with a lit facet.
  b.hline(17, 20, 32, accent);
  b.hline(16, 21, 33, accent);
  b.hline(17, 20, 34, accent);
  b.set(17, 32, PAL.snow[3]);
  b.set(16, 33, PAL.snow[2]);
  b.set(21, 33, PAL.gold[0]);
  b.set(20, 34, PAL.gold[0]);
  // The letter: a navy body with a 1-px lit line on its outer top edge, and an engraved shadow
  // down-right outside the letter only (counters and gaps stay pure ivory, the 1× contrast).
  const L = new PixelBuffer(S, S);
  drawText(L, letter, 20, 10, { font: 'big', color: PAL.navy[1], align: 'center', scale: HI });
  const ink = (x: number, y: number): boolean => (L.get(x, y) & 255) !== 0;
  const run = (x: number, y: number, dx: number, dy: number): boolean => {
    for (let k = 1; k < S; k++) if (ink(x + dx * k, y + dy * k)) return true;
    return false;
  };
  for (let y = 0; y < S - 1; y++) {
    for (let x = 0; x < S - 1; x++) {
      if (!ink(x, y) || ink(x + 1, y + 1)) continue;
      // Outside the letter: nothing of it further down, or nothing further right.
      if (!run(x + 1, y + 1, 0, 1) || !run(x + 1, y + 1, 1, 0)) b.set(x + 1, y + 1, PAL.stone[3]);
    }
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!ink(x, y)) continue;
      b.set(x, y, !run(x, y, 0, -1) ? PAL.navy[2] : PAL.navy[1]);
    }
  }
  if (glintAt >= 0) {
    // The diagonal glint (the 1× three-pixel streak, two 2× px wide), ivory pixels only.
    for (let k = 0; k < 6; k++) {
      for (let j = 0; j < 2; j++) {
        const px = (4 + glintAt) * HI + k + j;
        const py = (11 - glintAt) * HI + 1 - k;
        const v = b.get(px, py);
        if (v === PAL.snow[2] || v === PAL.stone[3]) b.set(px, py, PAL.snow[3]);
        else if (v === PAL.snow[3]) b.set(px, py, j === 0 ? PAL.gold[3] : PAL.snow[3]);
      }
    }
  }
  return outlineHi(b, HI);
}

/** The 2× medallion strip, matched to the 1× strip `lo` (the bob lifts by a logical px). */
export function weaponStripHi(letter: string, accent: Color, lo: readonly Frame[]): Frame[] {
  return [-1, -1, 1, 4].map((g, i) => asHi(weaponPlateHi(letter, g, accent), lo[i]));
}

// ------------------------------------------------------------------------------------ bombs

/** One 2× grenade (12 × 12 + outline): ribbed olive body, a gold band with a lit edge, the fuze cap. */
function grenadeHi(): PixelBuffer {
  return pixHi(
    [
      '....cC......',
      '...cCCt.....',
      '...oOOOOd...',
      '.oOoOOdOOdd.',
      '.oOOOOdOOdd.',
      'oOOOOOdOOOdd',
      'BBBbbbbbbbbn',
      'bbbbbbbbbbnn',
      'oOOOOdOOdddd',
      '.oOOOdOOddd.',
      '.oooddddddd.',
      '...oddddd...',
    ],
    {
      c: PAL.steel[4],
      C: PAL.steel[2],
      t: PAL.steel[1],
      o: PAL.olive[3],
      O: PAL.olive[2],
      d: PAL.olive[1],
      B: PAL.gold[3],
      b: PAL.gold[2],
      n: PAL.gold[1],
    },
  );
}

/** The 2× bombs crate: three grenades on a small plank box with a stencil plate and nails. */
function bombsHi(lo: readonly Frame[]): Frame[] {
  const nade = grenadeHi();
  const box = new PixelBuffer(36, 16);
  const p = new HiPen(box, 0, 0);
  const wd = PAL.brown;
  p.rect(1, 1, 16, 6, wd[2]);
  p.hline(1, 16, 1, wd[3]);
  p.fine(1, 1, 16.5, 1, PAL.sand[2]);
  p.hline(1, 16, 4, wd[1]);
  p.fine(1, 4, 16.5, 4, wd[0]);
  p.fine(1, 5, 16.5, 5, wd[3]);
  p.hline(1, 16, 6, wd[1]);
  p.vline(1, 1, 6, wd[3]);
  p.vline(16, 2, 6, wd[1]);
  p.fine(16, 2, 16, 6.5, wd[0]);
  // Grain streaks and nail heads.
  p.fine(3, 2.5, 5.5, 2.5, wd[1]);
  p.fine(12, 3, 14, 3, wd[1]);
  p.fine(3.5, 5.5, 6, 5.5, wd[1]);
  for (const [x, y] of [[2, 2], [15, 2], [2, 5], [15, 5]] as const) p.dot(x, y, PAL.steel[2]);
  // The stencil plate: white, a lit edge, two lines of navy "lettering".
  p.rect(7, 2, 4, 2, PAL.snow[2]);
  p.fine(7, 2, 10.5, 2, PAL.snow[3]);
  p.fine(7.5, 3, 10, 3, PAL.navy[1]);
  outlineHi(box, HI);
  return [0, 1].map((i) => {
    const b = new PixelBuffer(36, 28);
    b.blit(nade, 0, 2);
    b.blit(nade, 20, 2);
    b.blit(nade, 10, 0);
    b.blit(box, 0, 16);
    if (i === 1) for (const [x, y] of [[2, 4], [7, 3], [12, 4]] as const) sparkleHi(b, x * HI, y * HI);
    return asHi(b, lo[i]);
  });
}

// ------------------------------------------------------------------------------------ food

/** 2× bread: the bloomer with three clean diagonal scores (lit cut, dark lip), flour, crust specks. */
function breadHi(lo: readonly Frame[]): Frame[] {
  const key: AsciiKey = { H: PAL.sand[3], h: PAL.sand[2], W: PAL.snow[2], A: PAL.brown[3], b: PAL.brown[2], c: PAL.brown[1], s: PAL.sand[3] };
  const rows = [
    '.......hhhhhhhhhh.......',
    '.....hhhHHHHHHHHhh......',
    '...hhHHHHHscHHHHHscAh...',
    '.hhHHHHHHscHHHHHscAAAb..',
    '.hHHWHHHscAHHHHscAAAAAb.',
    'hHHHHHHscAAAHHscAAAAAscb',
    'hHHAAAscAAAAAscAAAAAscbb',
    'hAAAAscAAAAAscAAAAAscbbb',
    'AAAAAAAAAAAAAAAAAAAAAbbb',
    'AAAbAAAAAAAAAbAAAAAAbbbb',
    'AAAAAAAAAAAAAAAAAAAbbbbc',
    'AAAAAAAbAAAAAAAAAbbbbbcc',
    'bbbbbbbbbbbbbbbbbbbbbbcc',
    '.bbbbbbbbbbbbbbbbbbbbcc.',
    '..ccccccccccccccccccccc.',
    '...cccccccccccccccccc...',
  ];
  const a = pixHi(rows, key);
  const b = a.clone();
  sparkleHi(b, 9, 5);
  return [asHi(a, lo[0]), asHi(b, lo[1])];
}

/** 2× cheese: the wedge with round holes (shadowed upper wall, lit lower lip) and a rind line. */
function cheeseHi(lo: readonly Frame[]): Frame[] {
  const key: AsciiKey = { Y: PAL.gold[3], W: PAL.snow[3], G: PAL.gold[2], o: PAL.gold[1], d: PAL.gold[0], r: PAL.orange[2] };
  const rows = [
    '.YY.....................',
    'YYYYY...................',
    'YWYYYYY.................',
    'YYYYYYYYY...............',
    'GGGYYYYYYYY.............',
    'GGGGYYYYYYYYY...........',
    'GGGdoooGGYYYYYYYY.......',
    'GGdooooGGGGYYYYYYYY.....',
    'GGdoooYGGGGGGGGYYYYYY...',
    'GGGoYYGGGGGGGGGGGYYYYYY.',
    'GGGGGGGGGGGddoGGGGGGGGYY',
    'GGGGGGGGGGdoooYGGGGGGGGY',
    'GGGGdoGGGGooYYGGGGGddGGG',
    'GGGdoooGGGGGGGGGGGdooYGG',
    'rroooooooooooooooooooooo',
    '.rooooooooooooooooooooo.',
  ];
  const a = pixHi(rows, key);
  const b = a.clone();
  sparkleHi(b, 7, 5);
  return [asHi(a, lo[0]), asHi(b, lo[1])];
}

/** 2× teacake: a round cherry with a stalk, white icing with drips, a fine pleated paper case. */
function teacakeHi(lo: readonly Frame[]): Frame[] {
  const key: AsciiKey = {
    k: PAL.green[2],
    R: PAL.red[3],
    r: PAL.red[2],
    d: PAL.red[1],
    W: PAL.snow[3],
    w: PAL.snow[2],
    s: PAL.snow[1],
    B: PAL.brown[3],
    b: PAL.brown[2],
    P: PAL.pink[2],
    p: PAL.pink[1],
  };
  const rows = [
    '.............kk.........',
    '............k...........',
    '...........RRr..........',
    '..........RWRrr.........',
    '..........RRrrd.........',
    '...........rdd..........',
    '.......WWWWWWWwww.......',
    '.....WWWWWWWWWWwwww.....',
    '...WWWWWWWWWWWWwwwwws...',
    '.WWWWWWWWWWWWWWWwwwwsss.',
    '.WWWwwWWWWwwWWWWwwwwsss.',
    'WWWwwwWWWwwwWWWWwwwwssss',
    'bBwwwBbbwwwBbbbbwwwbsssb',
    'bBBwBBbbbwBBbbbbbwbbbsbb',
    'PPPPPPPPPPPPPPPPPPPPPPpp',
    '.PpPPpPPpPPpPPpPPpPPpPp.',
    '.PpPPpPPpPPpPPpPPpPPpPp.',
    '...PPpPPpPPpPPpPPpPp....',
    '....PpPPpPPpPPpPPpPp....',
    '.....pPPpPPpPPpPPpP.....',
  ];
  const a = pixHi(rows, key);
  const b = a.clone();
  sparkleHi(b, 13, 6);
  return [asHi(a, lo[0]), asHi(b, lo[1])];
}

/** The 2× jelly rows: a fluted mould with a window highlight, on a plate. */
const JELLY_HI = [
  '.......gGGGGGGGGg.......',
  '.....gggGGGGGGGGGgg.....',
  '.....ggWWWGGGGGGGgg.....',
  '....ggWWWWGGGGGGGGgg....',
  '....ggWWWGGGGGGGGGdd....',
  '...gggWGGGGGGGGGGGGdd...',
  '...ggGGGLLGGGGLLGGGdd...',
  '..ggGGGGLLGGGGLLGGGGdd..',
  '..ggGGGgLLGGGgLLGGGgdd..',
  '.ggGGGggLGGGggLGGGggddd.',
  '.ggGLGggGLGGggGLGGggGdd.',
  'ggGGLGggGLGGggGLGGggGGdd',
  'ggGGLGggGLGGggGLGGggGGdd',
  'ggGGLGggGLGGggGLGGgggGdd',
  'ggGGGGGGGGGGGGGGGGGGGgdd',
  'gggGGGGGGGGGGGGGGGGGggdd',
  'dggGGGGGGGGGGGGGGGGgggdd',
  '.ddgGGGGGGGGGGGGGGggggd.',
  '.ddddddddddddddddddd....',
  '..dddddddddddddddddd....',
  'WWpppppppppppppppppppppq',
  'ppppppppppppppppppppppqq',
  '..PPPPPPPPPPPPPPPPPPPP..',
  '...PPPPPPPPPPPPPPPPPP...',
];

/** 2× jelly, 2-frame wobble: the top leans right by a logical px, the shear eased over the 2× rows. */
function jellyHi(lo: readonly Frame[]): Frame[] {
  const key: AsciiKey = { W: PAL.snow[3], L: PAL.green[4], G: PAL.green[3], g: PAL.green[2], d: PAL.green[1], p: PAL.snow[2], P: PAL.snow[1], q: PAL.snow[0] };
  const still = pixHi(JELLY_HI, key);
  const src = ascii(JELLY_HI, key);
  const lean = new PixelBuffer(src.w + HI, src.h);
  for (let y = 0; y < src.h; y++) {
    const dx = y < 8 ? 2 : y < 12 ? 1 : 0;
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if ((c & 255) !== 0) lean.set(x + dx, y, c);
    }
  }
  return [asHi(still, lo[0]), asHi(outlineHi(lean.padded(HI), HI), lo[1])];
}

/** 2× birthday cake: two iced tiers with sprinkles and drips, striped candles, teardrop flames. */
function birthdayCakeHi(lo: readonly Frame[]): Frame[] {
  return [0, 1].map((phase) => {
    const b = new PixelBuffer(32, 32);
    const p = new HiPen(b, 0, 0);
    // Plate with a lit rim.
    p.hline(0, 15, 15, PAL.snow[1]);
    p.hline(1, 14, 14, PAL.snow[2]);
    p.fine(1, 14, 9, 14, PAL.snow[3]);
    p.fine(0, 15.5, 15.5, 15.5, PAL.snow[0]);
    for (const [y0, x0, x1] of [[9, 1, 14], [5, 3, 12]] as const) {
      const h = y0 === 9 ? 5 : 4;
      // Sponge, a cream filling line, the shaded right side.
      p.rect(x0, y0, x1 - x0 + 1, h, PAL.sand[3]);
      p.hline(x0, x1, y0 + 2, PAL.pink[1]);
      p.fine(x0, y0 + 2, x1 + 0.5, y0 + 2, PAL.snow[2]);
      p.vline(x1, y0, y0 + h - 1, PAL.sand[2]);
      p.fine(x1 - 0.5, y0 + 1, x1 - 0.5, y0 + h - 0.5, PAL.sand[2]);
      // Pink icing on top with drips, and sprinkles.
      p.hline(x0, x1, y0, PAL.pink[2]);
      p.fine(x0, y0 + 0.5, x1 + 0.5, y0 + 0.5, PAL.pink[1]);
      p.fine(x0, y0, x1 - 1, y0, PAL.pink[2]);
      const drips = y0 === 9 ? [2, 5, 8, 11] : [4, 9];
      for (const x of drips) {
        p.px(x, y0 + 1, PAL.pink[2]);
        p.dot(x + 0.5, y0 + 1.5, PAL.pink[1]);
        p.dot(x, y0 + 2, PAL.pink[2]);
      }
      const sprinkles = [PAL.snow[3], PAL.teal[3], PAL.gold[3], PAL.red[3]];
      for (let x = x0 + 1, i = 0; x < x1; x += 1.5, i++) if (i % 2 === 0) p.dot(x, y0, sprinkles[(i >> 1) % 4]);
    }
    // Candles (spiral stripes) and teardrop flames; the flames swap heights each frame.
    for (const [i, x] of [4, 7, 10].entries()) {
      for (let k = 0; k < 4; k++) {
        const pink = (k & 1) === 1;
        p.dot(x, 3 + k * 0.5, pink ? PAL.pink[2] : PAL.snow[3]);
        p.dot(x + 0.5, 3 + k * 0.5, pink ? PAL.pink[1] : PAL.snow[2]);
      }
      const tall = (i + phase) % 2 === 0;
      p.dot(x, 2.5, PAL.gold[3]);
      p.dot(x + 0.5, 2.5, PAL.orange[2]);
      p.dot(x, 2, PAL.snow[3]);
      p.dot(x + 0.5, 2, PAL.gold[3]);
      if (tall) {
        p.dot(x, 1.5, PAL.gold[2]);
        p.dot(x + 0.5, 1.5, PAL.orange[2]);
        p.dot(x, 1, PAL.orange[2]);
        p.dot(x + 0.5, 1, PAL.orange[1]);
        p.dot(x + 0.5, 0.5, PAL.orange[1]);
        p.dot(x, 0, PAL.orange[1]);
      } else {
        p.dot(x, 1.5, PAL.gold[2]);
        p.dot(x + 0.5, 1.5, PAL.gold[2]);
        p.dot(x, 1, PAL.orange[2]);
      }
    }
    return asHi(outlineHi(b, HI), lo[phase]);
  });
}

// ------------------------------------------------------------------------------------ treasure

/** 2× golden note: a round head with a lit crescent, a lit stem, a curling flag; the glint runs over it. */
function goldenNoteHi(lo: readonly Frame[]): Frame[] {
  const key: AsciiKey = { Y: PAL.gold[3], W: PAL.snow[3], G: PAL.gold[2], o: PAL.gold[1] };
  const rows = [
    '........YG......',
    '........YYGG....',
    '........YYGGG...',
    '........YYoGGG..',
    '........YY.oGGG.',
    '........YY..oGGG',
    '........YY...oGo',
    '........YY....oo',
    '........YY.....o',
    '........YG......',
    '........YG......',
    '........YG......',
    '....YYYYGG......',
    '..YYWWYGGG......',
    '.YYWYYGGGG......',
    'YYYYYGGGGG......',
    'YYYGGGGGGo......',
    '.YGGGGGGoo......',
    '..GGGoooo.......',
    '...Gooo.........',
  ];
  const spots: Array<readonly [number, number] | null> = [null, [2, 8], [5, 3], [7, 3]];
  return spots.map((s, i) => {
    const b = pixHi(rows, key);
    if (s) sparkleHi(b, s[0] * HI, s[1] * HI);
    return asHi(b, lo[i]);
  });
}

/** 2× gem: a brilliant cut (flat table, pointed pavilion) with a lit table and facet lines; the twinkle hops. */
function gemHi(lo: readonly Frame[]): Frame[] {
  const key: AsciiKey = { W: PAL.snow[3], H: PAL.red[3], R: PAL.red[2], r: PAL.red[1], k: PAL.red[0] };
  // The 1× silhouette: a flat table on top, the girdle, then the pavilion down to a point.
  const rows = [
    '....HHHHHHHR....',
    '...HHWWHHHRRR...',
    '..HHWWHHHRRRRr..',
    '.HHHWWHHRRRRRrr.',
    'HHHHHHHRRRRRrrrr',
    'HHHHHHRRRRRrrrrr',
    'kRRRRRRRRRrrrrrk',
    'kkRRRHRRRRrrrrkk',
    '.kkRRRHRRRrrrkk.',
    '..kkRRRHRrRrkk..',
    '...kkRRHrRrkk...',
    '....kkRRHrkk....',
    '.....kkRrkk.....',
    '......kkkk......',
  ];
  const spots: Array<readonly [number, number] | null> = [null, [2, 2], [10, 4], [5, 9]];
  return spots.map((s, i) => {
    const b = pixHi(rows, key).padded(2 * HI);
    if (s) twinkleHi(b, s[0] * HI, s[1] * HI);
    return asHi(b, lo[i]);
  });
}

/** 2× medal: a striped ribbon with a swallow-tail notch, a loop, the star medal with a lit rim. */
function medalHi(lo: readonly Frame[]): Frame[] {
  const key: AsciiKey = {
    H: PAL.red[3],
    R: PAL.red[2],
    r: PAL.red[1],
    w: PAL.snow[3],
    W: PAL.snow[2],
    s: PAL.snow[1],
    Y: PAL.gold[3],
    G: PAL.gold[2],
    o: PAL.gold[1],
    d: PAL.gold[0],
  };
  const rows = [
    '....HRRRwWWWRRrr....',
    '....HRRRwWWsRRrr....',
    '....HRRRwWWsRRrr....',
    '....HRRRwWWsRRrr....',
    '....HRRRwWWsRrrr....',
    '....HRRrwWWsrrrr....',
    '....RRrrwWWsrrrr....',
    '.....RrrrWWsrrr.....',
    '.....RRrr...rrr.....',
    '.......Rr...rr......',
    '........dGGd........',
    '.......GYYGGo.......',
    '.....YGGGGGGGGo.....',
    '...YYGGGGYGGGGGoo...',
    '...YGGGGGYYGGGGGo...',
    '..YGGGYYYwYYYGGGoo..',
    '..YGGGGYYYYYGGGGoo..',
    '..YGGGGGYYYGGGGGoo..',
    '..GGGGGYYGYYGGGGoo..',
    '...GGGGYGGGYGGGoo...',
    '...GGGGGGGGGGGooo...',
    '.....GGGGGGoooo.....',
    '......ooooooooo.....',
    '.......oooooo.......',
  ];
  const spots: Array<readonly [number, number] | null> = [null, null, [3, 8], [8, 9]];
  return spots.map((s, i) => {
    const b = pixHi(rows, key);
    if (s) sparkleHi(b, s[0] * HI, s[1] * HI);
    return asHi(b, lo[i]);
  });
}

/** 2× golden record: fine grooves, a crimson label with a lit half and a print line, a white shine core. */
function goldenRecordHi(lo: readonly Frame[]): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const S = 28;
    const b = new PixelBuffer(S, S);
    const c = 13.5;
    const shine = -Math.PI * 0.75 + (f * Math.PI) / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.hypot(dx, dy);
        if (d > 14) continue;
        const lit = -(dx + dy) / Math.max(d, 0.001);
        let col: Color;
        if (d < 1.6) col = INK;
        else if (d < 5.2) {
          col = lit > 0 ? PAL.red[3] : PAL.red[2];
          if (d > 3.3 && d < 4.2) col = lit > 0 ? PAL.red[2] : PAL.red[1];
          if (d >= 4.6) col = PAL.red[1];
        } else if (d > 12.2) col = lit > 0.3 ? PAL.gold[2] : PAL.gold[1];
        else col = Math.floor(d) % 3 === 0 ? PAL.gold[1] : PAL.gold[2];
        if (d >= 5.2 && d <= 12.2) {
          let da = Math.atan2(dy, dx) - shine;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) < 0.38) col = Math.abs(da) < 0.12 && d > 7 && d < 10.5 ? PAL.snow[3] : PAL.gold[3];
          else if (Math.abs(Math.abs(da) - Math.PI) < 0.22) col = Math.floor(d) % 3 === 0 ? PAL.gold[2] : PAL.gold[3];
        }
        b.set(x, y, col);
      }
    }
    return asHi(outlineHi(b, HI), lo[f]);
  });
}

// ------------------------------------------------------------------------------------ register

/** 2× builders by pickup id (all but the weapon medallions). */
export const PICKUP_HI: Readonly<Record<string, (lo: readonly Frame[]) => Frame[]>> = {
  'item/pickup-bombs': bombsHi,
  'item/pickup-food': breadHi,
  'item/pickup-food/bread': breadHi,
  'item/pickup-food/cheese': cheeseHi,
  'item/pickup-food/teacake': teacakeHi,
  'item/pickup-food/jelly': jellyHi,
  'item/pickup-food/birthday-cake': birthdayCakeHi,
  'item/pickup-gem': gemHi,
  'item/pickup-gem/golden-note': goldenNoteHi,
  'item/pickup-gem/gem': gemHi,
  'item/pickup-gem/medal': medalHi,
  'item/pickup-gem/golden-record': goldenRecordHi,
};
