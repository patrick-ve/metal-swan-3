/**
 * Pickup sprites (GDD §7.1, §15.6). All feet-anchored (they rest on the ground); sizes are the
 * GDD sizes plus the 1-px INK outline.
 *
 * - `item/pickup-weapon/<weapon id>` (and the older `item/pickup-<id>`, `item/pickup-<letter>`):
 *   a round ivory band-uniform button with a gold rim and the crate letter in navy, a coloured
 *   pip for the weapon family, a glint and a 1-px bob (4 frames). Never a dark box with a light
 *   letter, never a winged emblem.
 * - `item/pickup-bombs`: a small crate with three grenades on top (2 frames, a glint).
 * - `item/pickup-food/<kind>`: `bread`, `cheese`, `teacake`, `jelly` (2-frame wobble),
 *   `birthday-cake` (3 candles, 2-frame flicker); `item/pickup-food` = bread.
 * - `item/pickup-gem/<kind>`: `golden-note` (shimmer), `gem` (twinkle), `medal` (glint),
 *   `golden-record` (spinning shine), 4 frames each; `item/pickup-gem` = gem.
 * - `item/pickup-1up`: the tin cygnet, a wind-up toy that waddles (4 frames, the key turns).
 * - `item/pickup-repair`: an oil can with a wrench (2 frames, a glint).
 */
import { ascii, type AsciiKey } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineHdSprite, defineSprite } from '../../../engine/sprites';
import { PICKUP_HD, weaponStripHd } from './pickups-hi.art';

/** A small hand-drawn item: rows → buffer with a 1-px INK outline. */
function pix(rows: readonly string[], key: AsciiKey): PixelBuffer {
  return ascii(rows, key).padded(1).outline(INK);
}

/** Feet-anchored frame (bottom centre), lifted by `dy` px. */
function feet(buf: PixelBuffer, dy = 0): Frame {
  return { buf, ox: buf.w >> 1, oy: buf.h + dy };
}

/** Set a pixel only where the buffer is already opaque (glints stay inside the shape). */
function glint(b: PixelBuffer, x: number, y: number, c: Color): void {
  if ((b.get(x, y) & 255) !== 0 && b.get(x, y) !== INK) b.set(x, y, c);
}

/** A 4-point twinkle (plus sign) drawn anywhere, also outside the shape. */
function twinkle(b: PixelBuffer, x: number, y: number): void {
  b.set(x, y, PAL.snow[3]);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) b.set(x + dx, y + dy, PAL.gold[3]);
}

// ------------------------------------------------------------------------------------ weapons

/**
 * Weapon pickup medallion (GDD §7.1): a round ivory band-uniform button (17 px) with a gold rim
 * and the crate letter in navy (big font), a coloured pip on the rim, a glint and a bob.
 */
function weaponPlate(letter: string, glintAt: number, accent: Color): PixelBuffer {
  const b = new PixelBuffer(19, 19);
  const c = 9;
  // Gold rim (dark outer ring, lit upper-left arc), ivory face with a soft lower shade.
  b.circle(c, c, 8, PAL.gold[1]);
  b.circle(c, c, 7, PAL.gold[2]);
  for (let a = 0; a < 40; a++) {
    const t = Math.PI * (0.75 + a / 40);
    b.set(Math.round(c + Math.cos(t) * 7.5), Math.round(c + Math.sin(t) * 7.5), PAL.gold[3]);
  }
  b.circle(c, c, 6, PAL.snow[2]);
  b.circle(c - 1, c - 1, 5, PAL.snow[3]);
  for (let x = 5; x <= 13; x++) if (b.get(x, 14) === PAL.snow[2] || b.get(x, 14) === PAL.snow[3]) b.set(x, 14, PAL.stone[3]);
  // The coloured pip at the bottom of the rim (weapon family).
  b.set(c, 16, accent);
  b.set(c - 1, 16, accent);
  drawText(b, letter, c + 1, 5, { font: 'big', color: PAL.navy[1], align: 'center' });
  if (glintAt >= 0) {
    // A short diagonal glint across the face (ivory pixels only, never the letter).
    for (let k = 0; k < 3; k++) {
      const px = 4 + glintAt + k;
      const py = 11 - glintAt - k;
      const v = b.get(px, py);
      if (v === PAL.snow[2] || v === PAL.snow[3] || v === PAL.stone[3]) b.set(px, py, PAL.snow[3] === v ? PAL.gold[3] : PAL.snow[3]);
    }
  }
  return b.outline(INK);
}

/** Weapon id → crate letter and accent pip colour (colour-codes the weapon families). */
export const WEAPON_LETTERS: Readonly<Record<string, { letter: string; accent: Color }>> = {
  'machine-gun': { letter: 'M', accent: PAL.gold[1] },
  shotgun: { letter: 'S', accent: PAL.red[3] },
  'rocket-launcher': { letter: 'R', accent: PAL.orange[2] },
  flamethrower: { letter: 'F', accent: PAL.fire[4] },
  laser: { letter: 'L', accent: PAL.teal[3] },
  homing: { letter: 'H', accent: PAL.pink[2] },
  tuba: { letter: 'T', accent: PAL.brass[2] },
  'bounce-mine': { letter: 'B', accent: PAL.green[3] },
};

/** Old weapon ids that still draw (ARCHITECTURE §7.1). */
const WEAPON_ALIASES: Readonly<Record<string, string>> = { rocket: 'rocket-launcher', bouncer: 'bounce-mine', flame: 'flamethrower' };

/**
 * Register a weapon medallion: `item/pickup-weapon/<weaponId>` (GDD §15.6), `item/pickup-<id>`
 * and `item/pickup-<letter>` (lower case).
 */
export function defineWeaponPickup(weaponId: string, letter: string, accent: Color = PAL.gold[2], aliases: readonly string[] = []): void {
  const gen = (): Frame[] =>
    [-1, -1, 1, 4].map((g, i) => {
      const buf = weaponPlate(letter, g, accent);
      return feet(buf, i === 1 || i === 2 ? 1 : 0);
    });
  const opts = { durations: [24, 8, 4, 4] };
  const ids = new Set([`item/pickup-weapon/${weaponId}`, `item/pickup-${weaponId}`, `item/pickup-${letter.toLowerCase()}`]);
  for (const a of aliases) {
    ids.add(`item/pickup-weapon/${a}`);
    ids.add(`item/pickup-${a}`);
  }
  for (const id of ids) {
    defineSprite(id, gen, opts);
    // HD art (2× and 4×, mission ams; pickups-hi.art.ts). m0–m5 keep the 1× art.
    defineHdSprite(id, (d) => weaponStripHd(letter, accent, id, d));
  }
}

// ------------------------------------------------------------------------------------ bombs

/** One grenade for the bombs crate: olive, a gold band, a steel cap (own outline). */
function grenadePiece(): PixelBuffer {
  const g = ascii(['..c...', '.oOOd.', 'oOOOOd', 'bbbbbb', 'oOOOdd', '.oddd.'], {
    c: PAL.steel[3],
    C: PAL.steel[2],
    o: PAL.olive[3],
    O: PAL.olive[2],
    d: PAL.olive[1],
    b: PAL.gold[2],
  });
  return g.padded(1).outline(INK);
}

/** A small wooden crate with three grenades (olive, gold band) on top: 16×12. */
function bombsFrames(): Frame[] {
  const nade = grenadePiece();
  return [0, 1].map((i) => {
    const b = new PixelBuffer(18, 14);
    // Grenades first (the crate front hides their lower half), each with its own outline.
    // A little pile: the outer two first, the middle one in front and a pixel higher.
    b.blit(nade, 0, 1);
    b.blit(nade, 10, 1);
    b.blit(nade, 5, 0);
    // The crate: lid edge, planks, a white stencil band.
    const c = new PixelBuffer(18, 8);
    c.rect(1, 1, 16, 6, PAL.brown[2]);
    c.hline(1, 16, 1, PAL.brown[3]);
    c.hline(1, 16, 4, PAL.brown[1]);
    c.hline(1, 16, 6, PAL.brown[1]);
    c.vline(1, 1, 6, PAL.brown[3]);
    c.vline(16, 2, 6, PAL.brown[1]);
    c.rect(7, 2, 4, 2, PAL.snow[2]);
    b.blit(c.outline(INK), 0, 8);
    if (i === 1) for (const [x, y] of [[2, 4], [7, 3], [12, 4]] as const) glint(b, x, y, PAL.snow[3]);
    return feet(b);
  });
}

// ------------------------------------------------------------------------------------ food

/** Bread: a scored bloomer loaf, 12×8. */
function breadFrames(): Frame[] {
  const key: AsciiKey = { H: PAL.sand[3], h: PAL.sand[2], A: PAL.brown[3], b: PAL.brown[2], c: PAL.brown[1], s: PAL.sand[3] };
  const rows = [
    '...hhhhhh...',
    '.hhHHsHHsAh.',
    'hHHHsAHsAAAb',
    'hAAsAAsAAsAb',
    'AAAAAAAAAAbb',
    'AAAAAAAAAbbc',
    'bbbbbbbbbbbc',
    '.cccccccccc.',
  ];
  const a = pix(rows, key);
  const b = a.clone();
  glint(b, 4, 2, PAL.snow[3]);
  glint(b, 5, 2, PAL.sand[3]);
  return [feet(a), feet(b)];
}

/** Cheese: a wedge with holes, thick end left, 12×8. */
function cheeseFrames(): Frame[] {
  const key: AsciiKey = { Y: PAL.gold[3], G: PAL.gold[2], o: PAL.gold[1], d: PAL.gold[0], r: PAL.orange[2] };
  const rows = [
    'YY..........',
    'YYYY........',
    'GGYYYY......',
    'GooGGYYYY...',
    'GooGGGGGYYY.',
    'GGGGGooGGGGY',
    'GGoGGooGGoGG',
    'rooooooooooo',
  ];
  const a = pix(rows, key);
  const b = a.clone();
  glint(b, 3, 2, PAL.snow[3]);
  return [feet(a), feet(b)];
}

/** Teacake: a little iced cake in a striped paper case, a cherry on top, 12×10. */
function teacakeFrames(): Frame[] {
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
    '......k.....',
    '.....Rrk....',
    '.....rrd....',
    '...WWWWww...',
    '.WWWWWWWwws.',
    'WWwWWwWWwwss',
    'bwBbwBbbwbsb',
    'PpPpPpPpPpPp',
    '.PpPpPpPpPp.',
    '..pPpPpPpP..',
  ];
  const a = pix(rows, key);
  const b = a.clone();
  glint(b, 6, 2, PAL.snow[3]);
  return [feet(a), feet(b)];
}

/** Jelly: a ridged green mould on a plate, 12×12, 2-frame wobble. */
function jellyFrames(): Frame[] {
  const key: AsciiKey = { W: PAL.snow[3], L: PAL.green[4], G: PAL.green[3], g: PAL.green[2], d: PAL.green[1], p: PAL.snow[2], P: PAL.snow[1], q: PAL.snow[0] };
  const top = [
    '...gGGGGg...',
    '..gWWGGGGg..',
    '..gWGGGGGd..',
    '.gGGLGGLGGd.',
    '.gGgLGgLGgd.',
  ];
  const body = [
    'gGGgGGgGGgGd',
    'gGGgGGgGGgGd',
    'gGGGGGGGGGgd',
    'dgGGGGGGGggd',
    '.ddddddddd..',
    'pppppppppppq',
    '.PPPPPPPPPP.',
  ];
  const still = pix([...top, ...body], key);
  // Wobble: the top half leans right by a pixel and the ridges squash.
  const leaning = ascii([...top, ...body], key);
  const lean = new PixelBuffer(leaning.w + 1, leaning.h);
  lean.blit(leaning, 0, 0);
  const shifted = new PixelBuffer(leaning.w + 1, leaning.h);
  for (let y = 0; y < leaning.h; y++) {
    const dx = y < 5 ? 1 : 0;
    for (let x = 0; x < leaning.w; x++) {
      const c = leaning.get(x, y);
      if ((c & 255) !== 0) shifted.set(x + dx, y, c);
    }
  }
  return [feet(still), feet(shifted.padded(1).outline(INK))];
}

/** Birthday cake: two pink-iced tiers on a plate with three candles; the flames flicker. */
function birthdayCakeFrames(): Frame[] {
  return [0, 1].map((phase) => {
    const b = new PixelBuffer(16, 16);
    // Plate.
    b.hline(0, 15, 15, PAL.snow[1]);
    b.hline(1, 14, 14, PAL.snow[2]);
    // Lower tier: cream sponge with a pink filling line and icing drips.
    b.rect(1, 9, 14, 5, PAL.sand[3]);
    b.hline(1, 14, 11, PAL.pink[1]);
    b.vline(14, 9, 13, PAL.sand[2]);
    b.hline(1, 14, 9, PAL.pink[2]);
    for (const x of [2, 5, 8, 11]) b.set(x, 10, PAL.pink[2]);
    // Upper tier.
    b.rect(3, 5, 10, 4, PAL.sand[3]);
    b.hline(3, 12, 7, PAL.pink[1]);
    b.vline(12, 5, 8, PAL.sand[2]);
    b.hline(3, 12, 5, PAL.pink[2]);
    b.set(4, 6, PAL.pink[2]);
    b.set(9, 6, PAL.pink[2]);
    // Candles (white and pink stripes) and their flames.
    for (const [i, x] of [4, 7, 10].entries()) {
      b.set(x, 3, PAL.snow[3]);
      b.set(x, 4, PAL.pink[2]);
      const tall = (i + phase) % 2 === 0;
      b.set(x, 2, PAL.gold[3]);
      b.set(x, 1, tall ? PAL.orange[2] : PAL.gold[2]);
      if (tall) b.set(x, 0, PAL.orange[1]);
    }
    const out = b.outline(INK);
    return feet(out);
  });
}

// ------------------------------------------------------------------------------------ treasure

/** Golden note: a gold eighth note, 8×10; a glint runs over it. */
function goldenNoteFrames(): Frame[] {
  const key: AsciiKey = { Y: PAL.gold[3], G: PAL.gold[2], o: PAL.gold[1] };
  const rows = [
    '....YG..',
    '....YGG.',
    '....Y.GG',
    '....Y..o',
    '....Y...',
    '....Y...',
    '.YYGG...',
    'YYGGG...',
    'YGGGo...',
    '.Goo....',
  ];
  const spots: Array<[number, number] | null> = [null, [2, 8], [5, 3], [7, 3]];
  return spots.map((s) => {
    const b = pix(rows, key);
    if (s) glint(b, s[0], s[1], PAL.snow[3]);
    return feet(b);
  });
}

/** Gem: a crimson brilliant-cut gem, 8×8, with a twinkle that hops around it. */
function gemFrames(): Frame[] {
  const key: AsciiKey = { W: PAL.snow[3], H: PAL.red[3], R: PAL.red[2], r: PAL.red[1], k: PAL.red[0] };
  const rows = [
    '..HHHR..',
    '.HWHRRr.',
    'HHHRRRrr',
    'kRRRrrrk',
    '.kRRrrk.',
    '..kRrk..',
    '...kk...',
  ];
  const spots: Array<[number, number] | null> = [null, [2, 2], [10, 4], [5, 9]];
  return spots.map((s) => {
    const b = pix(rows, key).padded(2);
    if (s) twinkle(b, s[0], s[1]);
    return feet(b, -2);
  });
}

/** Medal: a gold Legion medal with a star, hanging from a crimson-and-white ribbon, 10×12. */
function medalFrames(): Frame[] {
  const key: AsciiKey = { R: PAL.red[2], r: PAL.red[1], W: PAL.snow[2], Y: PAL.gold[3], G: PAL.gold[2], o: PAL.gold[1], d: PAL.gold[0] };
  const rows = [
    '..RRWWRr..',
    '..RRWWRr..',
    '..RRWWRr..',
    '..RrWWrr..',
    '...Rr.r...',
    '....GG....',
    '..YGGGGo..',
    '.YGGYGGGo.',
    '.YGYYYGGo.',
    '.GGGYGGGo.',
    '..GGGGoo..',
    '...oooo...',
  ];
  const spots: Array<[number, number] | null> = [null, null, [3, 8], [8, 9]];
  return spots.map((s) => {
    const b = pix(rows, key);
    if (s) glint(b, s[0], s[1], PAL.snow[3]);
    return feet(b);
  });
}

/** Golden record: a gold disc with grooves and a crimson label, 14×14; the shine turns. */
function goldenRecordFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 4; f++) {
    const b = new PixelBuffer(14, 14);
    const c = 6.5;
    // The shine sits upper-left (the light) and turns a quarter per frame.
    const shine = -Math.PI * 0.75 + (f * Math.PI) / 2;
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 14; x++) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.hypot(dx, dy);
        if (d > 7) continue;
        let col: Color;
        if (d < 1) col = INK;
        else if (d < 2.6) col = d < 1.8 ? PAL.red[3] : PAL.red[2];
        else if (d > 6) col = PAL.gold[1];
        else col = Math.floor(d) % 2 === 0 ? PAL.gold[2] : PAL.gold[1];
        if (d >= 2.6 && d <= 6) {
          let da = Math.atan2(dy, dx) - shine;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) < 0.38) col = PAL.gold[3];
          // The opposite side catches a little light too.
          else if (Math.abs(Math.abs(da) - Math.PI) < 0.22) col = PAL.gold[2];
        }
        b.set(x, y, col);
      }
    }
    out.push(feet(b.outline(INK)));
  }
  return out;
}

// ------------------------------------------------------------------------------------ 1UP

/**
 * The tin cygnet (GDD §7.1): an ivory tin wind-up toy, 14×12, a gold key on its back. 4 frames:
 * a waddle (the body rocks, the feet step) while the key turns.
 */
function cygnetFrames(): Frame[] {
  const key: AsciiKey = {
    W: PAL.snow[3],
    w: PAL.snow[2],
    s: PAL.snow[1],
    q: PAL.snow[0],
    k: INK,
    b: PAL.orange[2],
    B: PAL.orange[1],
    o: PAL.orange[1],
    K: PAL.gold[2],
    Y: PAL.gold[3],
    r: PAL.steel[2],
  };
  const body = [
    '.........ww...',
    '........wWWw..',
    '........WkWwbb',
    '.........WwwB.',
    '.........Ww...',
    '........Ww....',
    '.rr.wwwwWw....',
    'wWWWWWWWWWw...',
    'WWsWWWWWWWw...',
    'swwwwrwwwwwq..',
    '.qqqqqqqqqq...',
  ];
  // The key's bow: wide (seen side-on) or narrow (turned), on a stem at the back.
  const keys = [
    ['.YK.', 'YKKK', '.KK.', '..r.'],
    ['.Y..', '.KK.', '.K..', '..r.'],
    ['.YK.', 'YKKK', '.KK.', '..r.'],
    ['..K.', '.KK.', '..K.', '..r.'],
  ];
  const feetRows = [
    ['..oo..oo......'],
    ['...oo.oo......'],
    ['..oo...oo.....'],
    ['..oo..oo......'],
  ];
  const tilt = [0, -1, 0, 1];
  return [0, 1, 2, 3].map((f) => {
    const b = new PixelBuffer(16, 16);
    const fig = ascii([...body, ...feetRows[f]], key);
    const kb = ascii(keys[f], key);
    // Rock the body by shifting the top rows a pixel with the step.
    const t = tilt[f];
    for (let y = 0; y < fig.h; y++) {
      const dx = y < 6 ? t : 0;
      for (let x = 0; x < fig.w; x++) {
        const c = fig.get(x, y);
        if ((c & 255) !== 0) b.set(x + 1 + dx, y + 4, c);
      }
    }
    b.blit(kb, 0, 6 + (f % 2));
    const out = b.outline(INK);
    const tr = out.trimBounds();
    const cut = tr ? out.crop(tr.x, tr.y, tr.w, tr.h) : out;
    return feet(cut);
  });
}

// ------------------------------------------------------------------------------------ repair

/** The wrench lying in front of the oil can: a handle and an open jaw at the right (own outline). */
function wrenchPiece(): PixelBuffer {
  return pix(['.........SSS', 'SSSSSSSSSS..', 'ssssssssss..', '.........sss'], { S: PAL.steel[4], s: PAL.steel[2] });
}

/** Repair kit: a green oil can with a long spout and a steel wrench in front of it, 14×14. */
function repairFrames(): Frame[] {
  const key: AsciiKey = {
    S: PAL.steel[4],
    t: PAL.steel[2],
    c: PAL.green[4],
    C: PAL.green[3],
    G: PAL.green[3],
    g: PAL.green[2],
    d: PAL.green[1],
    h: PAL.steel[2],
    W: PAL.snow[2],
    w: PAL.snow[1],
  };
  const can = pix(
    [
      '..........S',
      '.........St',
      '........St.',
      '...cc..St..',
      '..cCCCSt...',
      '.cCCCCgd...',
      '.GGGGGGgd..',
      'hGWWWWWwd..',
      'hGGGGGGgd..',
      'hGGGGGGgd..',
      '.GGGGGGgd..',
      '.ddddddd...',
    ],
    key,
  );
  const wrench = wrenchPiece();
  return [0, 1].map((f) => {
    const b = new PixelBuffer(16, 18);
    b.blit(can, 1, 0);
    b.blit(wrench, 0, 12);
    if (f === 1) {
      glint(b, 4, 8, PAL.snow[3]);
      glint(b, 3, 14, PAL.snow[3]);
    }
    const tr = b.trimBounds();
    return feet(tr ? b.crop(tr.x, tr.y, tr.w, tr.h) : b);
  });
}

// ------------------------------------------------------------------------------------ register

/** Food kinds → frame builders and timings (GDD §7.1). */
const FOOD_ART: Readonly<Record<string, readonly [() => Frame[], readonly number[]]>> = {
  bread: [breadFrames, [40, 6]],
  cheese: [cheeseFrames, [40, 6]],
  teacake: [teacakeFrames, [40, 6]],
  jelly: [jellyFrames, [10, 10]],
  'birthday-cake': [birthdayCakeFrames, [8, 8]],
};

/** Treasure kinds → frame builders and timings. */
const GEM_ART: Readonly<Record<string, readonly [() => Frame[], readonly number[]]>> = {
  'golden-note': [goldenNoteFrames, [20, 4, 4, 4]],
  gem: [gemFrames, [12, 6, 6, 6]],
  medal: [medalFrames, [24, 10, 4, 4]],
  'golden-record': [goldenRecordFrames, [6, 6, 6, 6]],
};

export function defineItemSprites(): void {
  for (const [id, w] of Object.entries(WEAPON_LETTERS)) {
    const aliases = Object.entries(WEAPON_ALIASES)
      .filter(([, to]) => to === id)
      .map(([from]) => from);
    defineWeaponPickup(id, w.letter, w.accent, aliases);
  }
  defineSprite('item/pickup-bombs', bombsFrames, { durations: [30, 6] });
  for (const [kind, [gen, durations]] of Object.entries(FOOD_ART)) defineSprite(`item/pickup-food/${kind}`, gen, { durations });
  defineSprite('item/pickup-food', breadFrames, { durations: [40, 6] });
  for (const [kind, [gen, durations]] of Object.entries(GEM_ART)) defineSprite(`item/pickup-gem/${kind}`, gen, { durations });
  defineSprite('item/pickup-gem', gemFrames, { durations: [12, 6, 6, 6] });
  defineSprite('item/pickup-1up', cygnetFrames, { ticksPerFrame: 8 });
  defineSprite('item/pickup-repair', repairFrames, { durations: [30, 6] });
  // HD art (2× and 4×, mission ams; pickups-hi.art.ts): bombs, food and treasure. m0–m5 keep the 1× art.
  for (const [id, gen] of Object.entries(PICKUP_HD)) defineHdSprite(id, (d) => gen(id, d));
}
