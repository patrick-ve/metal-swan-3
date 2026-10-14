/**
 * Hand-held gear for the humanoid rig: the three weapon graphics (pistol, heavy, rifle), hands
 * and small held items. Drawn as tiny hand-made templates (facing right) so they stay crisp at
 * 1×. Every gun knows its grip pixel (near hand), front grip (far hand) and muzzle pixel.
 *
 * 2× art (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): every template has a twin
 * drawn on the 2× grid (`…Hi`), exactly twice the size, with the same LOGICAL grip, muzzle,
 * wrist and tip pixels (the 2 × 2 block at twice the 1× pixel), so the rig places it from the 1×
 * placement and the game's points stay where they were. The extra pixels carry detail only:
 * serrations, vents, folds, finger creases, highlights.
 *
 * Template letters: k = ink, 0..4 = steel ramp, w/W = wood (brown 1/2), o/O = olive 1/2,
 * g = gold, t = brown 3 (light wood). '.' is transparent.
 */
import type { Color } from '../../engine/color';
import { ascii } from '../../engine/ascii';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { INK, PAL } from '../../engine/palette';
import { shadeLayer } from './paint';

export type WeaponPose = 'pistol' | 'heavy' | 'rifle' | 'none';

export interface GunArt {
  buf: PixelBuffer;
  /** Pixel under the near (trigger) hand. */
  grip: readonly [number, number];
  /** Pixel under the far (support) hand. */
  grip2: readonly [number, number];
  /** First empty pixel past the barrel tip (where bullets and muzzle flashes start). */
  muzzle: readonly [number, number];
}

const GUN_KEY: Readonly<Record<string, Color>> = {
  k: INK,
  '0': PAL.steel[0],
  '1': PAL.steel[1],
  '2': PAL.steel[2],
  '3': PAL.steel[3],
  '4': PAL.steel[4],
  w: PAL.brown[1],
  W: PAL.brown[2],
  t: PAL.brown[3],
  o: PAL.olive[1],
  O: PAL.olive[2],
  P: PAL.olive[3],
  g: PAL.gold[1],
  G: PAL.gold[2],
};

/** Small one-handed handgun, 8×5. */
const PISTOL = [
  '.3333334',
  '.2222223',
  '.1101...',
  '.00.....',
  '.00.....',
];

/**
 * The one big two-handed gun shared by every special weapon, 19×8: stock, receiver with a
 * carry handle, drum magazine, front grip and a ventilated barrel shroud.
 */
const HEAVY = [
  '.....1111..........',
  '22..233332.........',
  '3333333333444444443',
  '22223222221k1k1k1k2',
  '1111121111111111111',
  '0....00oOO..00.....',
  '.....00ooO..00.....',
  '........oo.........',
];

/** Enemy rifle, 19×5: wooden stock and handguard, steel receiver and barrel. */
const RIFLE = [
  '.......33..........',
  'tttWWW222222tttt333',
  'WWWWwww11111WWWw222',
  'www....11.0........',
  '........00.........',
];

let cache: Record<'pistol' | 'heavy' | 'rifle', GunArt> | null = null;

/** The gun graphics (built once). */
export function gunArt(kind: 'pistol' | 'heavy' | 'rifle'): GunArt {
  cache ??= {
    pistol: { buf: ascii(PISTOL, GUN_KEY), grip: [1, 3], grip2: [3, 2], muzzle: [8, 0] },
    heavy: { buf: ascii(HEAVY, GUN_KEY), grip: [5, 5], grip2: [12, 5], muzzle: [19, 3] },
    rifle: { buf: ascii(RIFLE, GUN_KEY), grip: [8, 3], grip2: [14, 2], muzzle: [19, 1] },
  };
  return cache[kind];
}

/** Rows of a 2× template, checked against the 1× template's size (exactly twice it). */
function hiRows(name: string, rows: readonly string[], lo: readonly string[]): string[] {
  const w = lo[0].length * 2;
  if (rows.length !== lo.length * 2 || rows.some((r) => r.length !== w)) {
    throw new Error(`2× template ${name}: ${rows[0]?.length ?? 0}×${rows.length}, expected ${w}×${lo.length * 2}`);
  }
  return [...rows];
}

/** 2× pistol (16×10): a lit slide with serrations, the trigger in its guard, a chequered grip. */
const PISTOL_HI = [
  '..33333333333344',
  '..34444444444443',
  '..2222k2k2k22223',
  '..22222222222223',
  '..11111111......',
  '..1111.0.1......',
  '..0110..........',
  '..0110..........',
  '..0110..........',
  '..0000..........',
];

/** 2× heavy gun (38×16): an open carry handle, slanted vents in the shroud, a ribbed drum. */
const HEAVY_HI = [
  '..........23333332....................',
  '..........21111112....................',
  '3333....2222....2222..................',
  '2222....233333333332..................',
  '44443333333333333333444444444444444433',
  '33333333333333333333333333333333333322',
  '2222222233222222222211kk11kk11kk11kk22',
  '2222222222222222222211k11kk11kk11kk122',
  '11111111112211111111111111111111111111',
  '11111111111100000000000000000000000000',
  '00........0000ooPPOO....0000..........',
  '0.........0110oOOOOO....0110..........',
  '..........0110oooOOO....0110..........',
  '..........0000oooooO....0000..........',
  '................oooo..................',
  '.................oo...................',
];

/** 2× rifle (38×10): wood grain on the stock and handguard, a lit receiver and barrel. */
const RIFLE_HI = [
  '..............3443....................',
  '..............2332....................',
  'ttttttWWWWWW333333333333tttttttt444444',
  'tWWWWWWWWWWW222222222222WWWWWWWW333333',
  'WWWWWWWWwwwwww1111111111WWWWWWww222222',
  'WWWWwwwwwwwwww0000000000wwwwwwww111111',
  'wwwwww........1111..00................',
  'wwwww.........1001..0.................',
  '................0000..................',
  '.................00...................',
];

let hiCache: Record<'pistol' | 'heavy' | 'rifle', PixelBuffer> | null = null;

/** The 2× gun graphics (twice the 1× size; grip, grip2 and muzzle at twice the 1× pixels). */
export function gunArtHi(kind: 'pistol' | 'heavy' | 'rifle'): PixelBuffer {
  hiCache ??= {
    pistol: ascii(hiRows('pistol', PISTOL_HI, PISTOL), GUN_KEY),
    heavy: ascii(hiRows('heavy', HEAVY_HI, HEAVY), GUN_KEY),
    rifle: ascii(hiRows('rifle', RIFLE_HI, RIFLE), GUN_KEY),
  };
  return hiCache[kind];
}

// ------------------------------------------------------------------------------------ hands

export type HandShape = 'fist' | 'open' | 'point' | 'grip' | 'thumb';

/**
 * Hand templates pointing FORWARD (+x, as on a horizontal forearm); the rig turns them in
 * quarter steps along the forearm. '#' = fill (shaded later). `wrist` = attachment pixel.
 */
const HANDS: Readonly<Record<HandShape, { rows: string[]; wrist: readonly [number, number] }>> = {
  fist: { rows: ['.##.', '####', '####', '.##.'], wrist: [1, 1] },
  grip: { rows: ['.##.', '####', '####', '.##.'], wrist: [1, 1] },
  open: { rows: ['...#.#', '.#####', '#####.', '.###..'], wrist: [1, 2] },
  point: { rows: ['.##....', '#######', '####...', '.##....'], wrist: [1, 1] },
  thumb: { rows: ['.#...', '.#...', '####.', '####.', '.##..'], wrist: [1, 3] },
};

/**
 * 2× hands (twice the 1× template; the wrist is the 2 × 2 block at twice the 1× wrist). '#' =
 * fill, 'f' = fill with a 1-px crease (knuckles, fingers) drawn one shade darker.
 */
const HANDS_HI: Readonly<Record<HandShape, readonly string[]>> = {
  fist: ['..####..', '.######.', '#####f##', '#####f##', '####f###', '####f###', '.######.', '..####..'],
  // On a gun the 2× fist is 1 logical px smaller than the doubled 1× fist, so the gun's grip and
  // trigger guard still show round it (a full-size 2× fist reads as a ball in front of the gun).
  grip: ['........', '..####..', '.#####f.', '.####f#.', '.###f##.', '.####f#.', '..####..', '........'],
  open: ['......##..##', '......##..##', '..#######f##', '..##########', '#####f#f##..', '##########..', '..######....', '...####.....'],
  point: ['..####........', '.#####........', '#############.', '##############', '########......', '######f#......', '..####........', '..###.........'],
  thumb: ['..##......', '..##......', '..##......', '..##......', '########..', '#######f..', '########..', '######f#..', '..####....', '..####....'],
};

/**
 * Draw a shaded hand (glove or skin) into `layer` with its wrist at (x, y), turned by
 * `quarter` clockwise quarter turns (0 = pointing forward, 1 = down, 3 = up). `density` 2: the
 * 2× hand into a 2× layer, (x, y) still the wrist on the 1× grid.
 */
export function drawHand(
  layer: PixelBuffer,
  shape: HandShape,
  x: number,
  y: number,
  ramp: Ramp,
  quarter = 0,
  flipY = false,
  density = 1,
): void {
  const h = HANDS[shape];
  let tpl = ascii(h.rows, { '#': ramp[2] });
  const hi = density >= 2;
  let tplHi = hi ? ascii(hiRows(`hand ${shape}`, HANDS_HI[shape], h.rows), { '#': ramp[2], f: ramp[2] }) : null;
  let marks = hi ? ascii(HANDS_HI[shape], { f: ramp[1], '#': 0 }) : null;
  let wx = h.wrist[0];
  let wy = h.wrist[1];
  if (flipY) {
    tpl = tpl.flipped(false, true);
    tplHi = tplHi?.flipped(false, true) ?? null;
    marks = marks?.flipped(false, true) ?? null;
    wy = tpl.h - 1 - wy;
  }
  const q = ((quarter % 4) + 4) % 4;
  for (let i = 0; i < q; i++) {
    // Clockwise quarter turn: (x, y) → (h − 1 − y, x).
    const nx = tpl.h - 1 - wy;
    const ny = wx;
    tpl = tpl.rotated(Math.PI / 2);
    tplHi = tplHi?.rotated(Math.PI / 2) ?? null;
    marks = marks?.rotated(Math.PI / 2) ?? null;
    wx = nx;
    wy = ny;
  }
  if (!tplHi || !marks) {
    shadeLayer(tpl, ramp, { base: 2 });
    layer.blit(tpl, Math.round(x) - wx, Math.round(y) - wy);
    return;
  }
  shadeLayer(tplHi, ramp, { base: 2, density: 2 });
  tplHi.blit(marks, 0, 0);
  layer.blit(tplHi, (Math.round(x) - wx) * 2, (Math.round(y) - wy) * 2);
}

// ------------------------------------------------------------------------------------ held items

/** Round hand grenade (6×7) with a lever, olive body. */
export function grenadeArt(): PixelBuffer {
  return ascii(
    ['..11.', '.2k2.', 'OPPOo', 'PPOOo', 'OOOoo', '.ooo.'],
    { '1': PAL.steel[2], '2': PAL.steel[3], k: INK, P: PAL.olive[3], O: PAL.olive[2], o: PAL.olive[1] },
  );
}

/** 2× grenade (10×12): a pin ring on the lever, segmented olive body lit top-left. */
const GRENADE_HI = [
  '....1121..',
  '....1111..',
  '..22kk22..',
  '..2k22k2..',
  'OOPPPPOOoo',
  'OPPPPOOOoo',
  'PPPOoOOOoo',
  'PPOOOOOoOo',
  'OOOOoOOooo',
  'OoOOOOoooo',
  '..oooooo..',
  '...oooo...',
];

const KNIFE_ROWS = ['...4444.', 'kww33333', '...222..'];

/** 2× knife (16×6): a lit spine, a bevel line along the edge, a wrapped handle. */
const KNIFE_HI = [
  '......44444444..',
  '......33333334..',
  'kkwWWw3333333344',
  'kkwwww2333333332',
  '......222222....',
  '.......2222.....',
];

/** 2× gift (12×12): a bow with loops, a 1-px lit / shaded ribbon, a light top face, a shaded side. */
const GIFT_HI = [
  '..rr....rr..',
  '.r..r..r..r.',
  '..rr.rr.rr..',
  '....rRRr....',
  'LLLLLRrLLLLB',
  'BBBBBRrBBBBb',
  'BBBBBRrBBBbb',
  'BBBBBrdBBBbb',
  'BBBBBrdBBbbb',
  'BBBBbrdbbbbb',
  'bBBbbrdbbbbs',
  'bbbbbrdbbbss',
];

/**
 * The 2× twin of a round held item. The grenade and the gift are redrawn; the snack (drawn by no
 * 2× sprite yet) is its 1× drawing doubled.
 */
export function heldArtHi(item: 'grenade' | 'snack' | 'gift'): PixelBuffer {
  if (item === 'grenade') {
    return ascii(hiRows('grenade', GRENADE_HI, ['..11.', '.2k2.', 'OPPOo', 'PPOOo', 'OOOoo', '.ooo.']), {
      '1': PAL.steel[2],
      '2': PAL.steel[3],
      k: INK,
      P: PAL.olive[3],
      O: PAL.olive[2],
      o: PAL.olive[1],
    });
  }
  if (item === 'gift') {
    return ascii(hiRows('gift', GIFT_HI, ['.r..r.', '..rr..', 'bbrrbb', 'BBrRBB', 'bbrrbb', 'bbrrbb']), {
      r: PAL.red[2],
      R: PAL.red[3],
      d: PAL.red[1],
      L: PAL.sky[3],
      B: PAL.sky[2],
      b: PAL.sky[1],
      s: PAL.sky[0],
    });
  }
  return snackArt().scaled(2);
}

/** The 2× knife (twice knifeArt). */
export function knifeArtHi(): PixelBuffer {
  return ascii(hiRows('knife', KNIFE_HI, KNIFE_ROWS), { k: INK, w: PAL.brown[1], W: PAL.brown[2], '2': PAL.steel[2], '3': PAL.steel[3], '4': PAL.steel[4] });
}

/** Combat knife blade + handle (8×3) pointing right; handle at x 0..2. */
export function knifeArt(): PixelBuffer {
  return ascii(KNIFE_ROWS, {
    k: INK,
    w: PAL.brown[1],
    '2': PAL.steel[2],
    '3': PAL.steel[3],
    '4': PAL.steel[4],
  });
}

/** Sandwich (7×5) for snacking gags. */
export function snackArt(): PixelBuffer {
  return ascii(['.ttttt.', 'tTTTTTt', 'gGgrRgg', 'tTTTTTt', '.ttttt.'], {
    t: PAL.sand[1],
    T: PAL.sand[2],
    g: PAL.green[2],
    G: PAL.green[3],
    r: PAL.red[2],
    R: PAL.red[3],
  });
}

// ------------------------------------------------------------------------------------ knife-look props

/**
 * Hand-held props for the heroes' knife looks (GDD §3, §6.2), drawn by the rig like the knife:
 * pointing right (heldAngle 0 = forward, −90 = up), the `grip` pixel in the fist (the hand covers
 * it), `tip` = the business end (the frame's `hand` point). Shaded, no outline (the figure's
 * outline wraps them).
 */
export type PropKind = 'umbrella' | 'needles' | 'pan' | 'wrench';

export interface PropArt {
  buf: PixelBuffer;
  grip: readonly [number, number];
  tip: readonly [number, number];
  /** Ramp for the internal line where the hand overlaps the prop. */
  ramp: Ramp;
}

const PROP_KEY: Readonly<Record<string, Color>> = {
  '1': PAL.steel[1],
  '2': PAL.steel[2],
  '3': PAL.steel[3],
  '4': PAL.steel[4],
  a: PAL.black[1],
  A: PAL.black[2],
  B: PAL.black[3],
  w: PAL.brown[1],
  W: PAL.brown[2],
  t: PAL.brown[3],
  r: PAL.red[1],
  R: PAL.red[3],
};

const PROPS: Readonly<Record<PropKind, { rows: string[]; grip: readonly [number, number]; tip: readonly [number, number]; ramp: Ramp }>> = {
  // Furled black umbrella: a wooden crook behind the fist, a long black spindle, a steel tip.
  umbrella: {
    rows: [
      '................',
      '.....aBBBBBa....',
      'twWWaABBBBBAaa34',
      't...aaaaaaaa....',
      'tt..............',
    ],
    grip: [3, 2],
    tip: [15, 2],
    ramp: PAL.black,
  },
  // Two knitting needles side by side, red bead knobs.
  needles: {
    rows: ['Rr333333334', '...........', 'Rr333333332'],
    grip: [2, 1],
    tip: [10, 1],
    ramp: PAL.steel,
  },
  // A round frying pan on a short handle (3/4 view: a light rim round a dark inside).
  pan: {
    rows: [
      '.......333...',
      '......31112..',
      '.....3111112.',
      'aaAAA3111112.',
      '.....2111112.',
      '......21112..',
      '.......222...',
    ],
    grip: [1, 3],
    tip: [8, 3],
    ramp: PAL.steel,
  },
  // A big open-end wrench: a flat handle and a C-shaped jaw open to the front.
  wrench: {
    rows: [
      '........4433.',
      '.......43..3.',
      '3333333332...',
      '2222222221...',
      '.......21..1.',
      '........1111.',
    ],
    grip: [2, 3],
    tip: [11, 3],
    ramp: PAL.steel,
  },
};

/** 2× props (twice the 1× drawing; grip and tip at twice the 1× pixels). */
const PROPS_HI: Readonly<Record<PropKind, readonly string[]>> = {
  // Folds in the furled canopy, a strap button, a curved crook.
  umbrella: [
    '................................',
    '................................',
    '..........aaBBBBBBBBBBaa........',
    '..........aABBBABBBBABaa........',
    'ttwwWWWWaaAABBBBBBBBBBAAaaaa3344',
    'ttwWWWWwaaABBBBBABBBBBAaaaaa223.',
    'tt......aaaaaaAaaaaaaaaa........',
    'tt.......aaaaaaaaaaaaaa.........',
    'tttt............................',
    '.ttt............................',
  ],
  // Thin lit shafts, round red beads.
  needles: [
    'Rrrr44444444444444444.',
    'rrrr22222222222222222.',
    '......................',
    '......................',
    'Rrrr44444444444444443.',
    'rrrr22222222222222222.',
  ],
  // A round pan: lit rim, dark inside with a small glint, a leather-wrapped handle.
  pan: [
    '..............333333......',
    '............3344443333....',
    '...........34111111123....',
    '..........3411111111112...',
    '..........31111111111122..',
    '..........31211111111122..',
    'aaaaAAAAAA31111111111122..',
    'aaaaaaaaaa31111111111122..',
    '..........21111111111122..',
    '..........21111111111122..',
    '............2111111122....',
    '............2211111222....',
    '..............222222......',
    '..............111111......',
  ],
  // A lit flat handle and an open jaw.
  wrench: [
    '................44443333..',
    '................43333332..',
    '..............4433....33..',
    '..............433.....33..',
    '44444444444444443322......',
    '33333333333333333322......',
    '22222222222222222211......',
    '11111111111111111111......',
    '..............2211....11..',
    '..............2111....11..',
    '................11111111..',
    '.................111111...',
  ],
};

const propHiCache = new Map<PropKind, PixelBuffer>();

/** The 2× drawing of a knife-look prop (twice propArt(kind).buf). */
export function propArtHi(kind: PropKind): PixelBuffer {
  let b = propHiCache.get(kind);
  if (!b) {
    b = ascii(hiRows(kind, PROPS_HI[kind], PROPS[kind].rows), PROP_KEY);
    propHiCache.set(kind, b);
  }
  return b;
}

let propCache: Partial<Record<PropKind, PropArt>> = {};

/** The art of a knife-look prop (built once). */
export function propArt(kind: PropKind): PropArt {
  let a = propCache[kind];
  if (!a) {
    const p = PROPS[kind];
    a = { buf: ascii(p.rows, PROP_KEY), grip: p.grip, tip: p.tip, ramp: p.ramp };
    propCache = { ...propCache, [kind]: a };
  }
  return a;
}

/** Is a held item one of the knife-look props? */
export function isProp(item: string): item is PropKind {
  return item === 'umbrella' || item === 'needles' || item === 'pan' || item === 'wrench';
}

/** Small wrapped gift box (6×6) that hostages pull out before the real item pops. */
export function giftArt(): PixelBuffer {
  return ascii(['.r..r.', '..rr..', 'bbrrbb', 'BBrRBB', 'bbrrbb', 'bbrrbb'], {
    r: PAL.red[2],
    R: PAL.red[3],
    b: PAL.sky[1],
    B: PAL.sky[2],
  });
}
