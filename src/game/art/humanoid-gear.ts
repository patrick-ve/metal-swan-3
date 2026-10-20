/**
 * Hand-held gear for the humanoid rig: the three weapon graphics (pistol, heavy, rifle), hands
 * and small held items. Drawn as tiny hand-made templates (facing right) so they stay crisp at
 * 1×. Every gun knows its grip pixel (near hand), front grip (far hand) and muzzle pixel.
 *
 * Template letters: k = ink, 0..4 = steel ramp, w/W = wood (brown 1/2), o/O = olive 1/2,
 * g = gold, t = brown 3 (light wood). '.' is transparent.
 *
 * UHD (2× and 4×, mission ams): src/game/art/hd/gear.ts draws every item and hand natively at d ∈
 * {2, 4} from these 1× footprints and points (gunArtHd / gunHd, heldArtHd, knifeArtHd,
 * propArtHd / propHd, drawHandHd / handArtHd; `handTemplate` below feeds it), with the same
 * LOGICAL grip, muzzle, wrist and tip pixels. The old hand-drawn ASCII 2× twins are retired.
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
 * The 1× hand template of a shape (pointing forward) and its wrist pixel: the UHD hand drawer
 * (src/game/art/hd/gear.ts `drawHandHd`) draws d times this box with the wrist on the same
 * logical pixel.
 */
export function handTemplate(shape: HandShape): { readonly rows: readonly string[]; readonly wrist: readonly [number, number] } {
  return HANDS[shape];
}

/**
 * Draw a shaded 1× hand (glove or skin) into `layer` with its wrist at (x, y), turned by
 * `quarter` clockwise quarter turns (0 = pointing forward, 1 = down, 3 = up). The 2× and 4× hands
 * are drawn by src/game/art/hd/gear.ts.
 */
export function drawHand(layer: PixelBuffer, shape: HandShape, x: number, y: number, ramp: Ramp, quarter = 0, flipY = false): void {
  const h = HANDS[shape];
  let tpl = ascii(h.rows, { '#': ramp[2] });
  let wx = h.wrist[0];
  let wy = h.wrist[1];
  if (flipY) {
    tpl = tpl.flipped(false, true);
    wy = tpl.h - 1 - wy;
  }
  const q = ((quarter % 4) + 4) % 4;
  for (let i = 0; i < q; i++) {
    // Clockwise quarter turn: (x, y) → (h − 1 − y, x).
    const nx = tpl.h - 1 - wy;
    const ny = wx;
    tpl = tpl.rotated(Math.PI / 2);
    wx = nx;
    wy = ny;
  }
  shadeLayer(tpl, ramp, { base: 2 });
  layer.blit(tpl, Math.round(x) - wx, Math.round(y) - wy);
}

// ------------------------------------------------------------------------------------ held items

/** Round hand grenade (6×7) with a lever, olive body. */
export function grenadeArt(): PixelBuffer {
  return ascii(
    ['..11.', '.2k2.', 'OPPOo', 'PPOOo', 'OOOoo', '.ooo.'],
    { '1': PAL.steel[2], '2': PAL.steel[3], k: INK, P: PAL.olive[3], O: PAL.olive[2], o: PAL.olive[1] },
  );
}

const KNIFE_ROWS = ['...4444.', 'kww33333', '...222..'];

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
export type PropKind = 'umbrella' | 'needles' | 'pan' | 'wrench' | 'plan' | 'pistol-butt' | 'plunger' | 'airliner' | 'frikandel';

/** The pistol turned round: held by the barrel, the butt forward (a pistol-whip). */
const mirrorRows = (rows: readonly string[]): string[] => rows.map((r) => [...r].reverse().join(''));

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
  '0': PAL.steel[0],
  k: INK,
  p: PAL.sand[2],
  P: PAL.sand[3],
  b: PAL.sky[1],
  s: PAL.snow[1],
  S: PAL.snow[2],
  f: PAL.brown[1],
  F: PAL.brown[2],
  G: PAL.brown[3],
};

const PROPS: Readonly<Record<PropKind, { rows: string[]; grip: readonly [number, number]; tip: readonly [number, number]; ramp: Ramp }>> = {
  // A rolled-up battle plan: cream paper, a blue line spiralling round it, the end-on roll.
  plan: {
    rows: ['.PPPPPPPP.', 'pPPbPPPPPS', '.pppbpppp.'],
    grip: [2, 1],
    tip: [9, 1],
    ramp: PAL.sand,
  },
  // The pistol held by its barrel, the butt swinging forward.
  'pistol-butt': {
    rows: mirrorRows(PISTOL),
    grip: [1, 1],
    tip: [6, 4],
    ramp: PAL.steel,
  },
  // A plunger: a wooden stick and a dark rubber cup, its mouth to the front.
  plunger: {
    rows: ['.........aa', '........aAa', 'wwWWWWWWAAa', '........aAa', '.........aa'],
    grip: [1, 2],
    tip: [10, 2],
    ramp: PAL.black,
  },
  // A tiny model airliner held under the belly: blue tail fin, a row of windows, the nose ahead.
  airliner: {
    rows: ['b.........', 'bbSSSSSSS.', 'sSbSbSbSSS', '.ssss11ss.'],
    grip: [3, 3],
    tip: [9, 2],
    ramp: PAL.snow,
  },
  // A frikandel with mayonnaise and curry stripes along the top.
  frikandel: {
    rows: ['..SRSRSRS.', '.FFFFFFFFf', '..fffffff.'],
    grip: [1, 1],
    tip: [9, 1],
    ramp: PAL.brown,
  },
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
  return Object.prototype.hasOwnProperty.call(PROPS, item);
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
