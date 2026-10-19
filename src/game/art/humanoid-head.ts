/**
 * Heads for the humanoid rig: a hand-drawn 3/4 face (facing right), plus overlays for hair
 * styles, headgear, expressions and face extras. Templates are tiny pixel drawings, so the
 * 10–11 px heads stay crisp and expressive at 1×.
 *
 * Layout: the skull template is 12×12 (rows 0–10 head, row 11 neck). It is placed at BASE_AT
 * inside an 18×19 head buffer, leaving room for plumes above, ponytails behind and visors in
 * front. Overlays give their own offset relative to the skull template.
 *
 * Letters (resolved per style):
 *   skin   0 1 2 3 (dark → light)       hair   h H L (dark, mid, light)
 *   gear   j g G   (dark, mid, light)   accent a A   (mid, light: plumes, bands, badges)
 *   k ink, e eye (ink), w white, m mouth (skin 0), r mouth inside (red 1), t teeth (white)
 *   l lens (sky 2), s lens glint (white), b brass (gold 2), B brass light (gold 3), x stubble (sand 1)
 *   '-' ERASES (transparent), '.' leaves the pixel unchanged.
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { INK, PAL } from '../../engine/palette';
import { at } from './paint';
import { EXPR_HI, EXTRAS_HI, GEAR_HI, HAIR_HI, SKULL_HI, TRAITS_HI, type HiTpl } from './humanoid-head-hi';

export const HEAD_W = 18;
export const HEAD_H = 19;
/** Top-left of the 12×12 skull template inside the head buffer. */
export const BASE_AT: readonly [number, number] = [3, 7];
/** Neck joint inside the head buffer (bottom of the neck). */
export const NECK: readonly [number, number] = [BASE_AT[0] + 5, BASE_AT[1] + 11];
/** Head centre inside the head buffer (for the 'head' point). */
export const HEAD_CENTER: readonly [number, number] = [BASE_AT[0] + 6, BASE_AT[1] + 5];

export type HairStyle =
  | 'short'
  | 'buzz'
  | 'spiky'
  | 'mohawk'
  | 'bald'
  | 'long'
  | 'ponytail'
  | 'bob'
  | 'parted'
  | 'curly'
  | 'puffs'
  /** Bald dome with white side tufts round the ear and the back of the head. */
  | 'tufts'
  /** A short crop with a high front hairline: a bare forehead over the brows (Vincent). */
  | 'short-crop'
  /** Sleek top combed straight back, short sides, a high front hairline (Patrick). */
  | 'slick-back'
  /** Messy spikes in every direction, a few strands over the forehead (Dirk). */
  | 'spiky-messy'
  /** Tousled hair swept up and back from the forehead into a tall quiff (Bob). */
  | 'swept-up';

export type Headgear =
  | 'none'
  | 'helmet'
  | 'cap'
  | 'beret'
  /** An officer's beret pulled down over the back of the head, with a brass badge in front. */
  | 'beret-slouch'
  | 'bandana'
  | 'goggles'
  | 'hood'
  | 'shako'
  | 'bobble'
  | 'rainhat'
  | 'headset'
  | 'fur-hat'
  /** A baseball cap worn backwards: the peak sticks out over the back of the head (Thom). */
  | 'cap-back';

export type Expression =
  | 'normal'
  | 'shout'
  | 'panic'
  | 'hurt'
  | 'happy'
  | 'blink'
  | 'yawn'
  | 'chew'
  | 'dazed'
  | 'soot';

export type FaceExtra =
  | 'moustache'
  | 'beard'
  | 'glasses'
  | 'shades'
  | 'freckles'
  | 'stubble'
  | 'blush'
  /** Big droopy moustache that hides the mouth (hair colour). */
  | 'walrus'
  /** Bushy brows (hair colour) over the normal brow line. */
  | 'bushy-brows'
  /** A white eye highlight behind the pupil on open-eyed expressions (reads on deep skin). */
  | 'eyeshine'
  /** One eyebrow raised high (a gap over the eye) on calm expressions (Vincent). */
  | 'raised-brow'
  /** A lopsided smirk: the back corner of the mouth pulled up, on calm expressions (Vincent). */
  | 'smirk'
  /** A huge toothy grin on calm expressions (Thom). */
  | 'grin'
  /** Squinting happy eyes on the calm open-eyed expressions (Thom). */
  | 'beam'
  /** A thick moustache over the mouth, one px past the face (hair colour; Dirk). */
  | 'thick-mustache'
  /** Heavy dark stubble along the jaw, drawn under the mouth (hair colour; Vincent). */
  | 'heavy-stubble'
  /** A thin trimmed moustache line over the mouth (hair colour; Patrick). */
  | 'thin-mustache'
  /** Blue eyes: the iris in sky blue on open-eyed expressions (Bob). */
  | 'blue-eyes';

export interface Tpl {
  /** Offset relative to the skull template's top-left. */
  at: readonly [number, number];
  rows: readonly string[];
}

/** Bald skull + face, hand-shaded (light from the top-left). Rows 0–10 head, 11 neck. */
export const SKULL: readonly string[] = [
  '...3333.....',
  '..33333332..',
  '.3333333322.',
  '.33333322222',
  '.2333332322.',
  '.2221233232.',
  '.22101232322',
  '..1101222221',
  '..2112222222',
  '...1122221..',
  '....11111...',
  '....111.....',
];

/** Hair overlays (skull coordinates). Pixels outside the skull add volume. */
export const HAIR: Readonly<Record<HairStyle, Tpl>> = {
  short: {
    at: [0, -1],
    rows: [
      '...hhhhhh...',
      '.hhHHHHHHh..',
      'hHHLLLHHHHh.',
      'hHLHHHHHHhhh',
      'hHHHHh.....h',
      'hHHh........',
      'hHh.........',
      '.hh.........',
      '..h.........',
    ],
  },
  buzz: {
    at: [0, 0],
    rows: ['...hhhh.....', '..hHHHHhh...', '.hHHHHHHHh..', '.hHHHhhhh...', '.hHh........', '.hh.........'],
  },
  spiky: {
    at: [0, -3],
    rows: [
      '..h..h..h...',
      '..hh.hh.hh..',
      '.hHhhHhhHhh.',
      'hhHHHHHHHHh.',
      'hHHLLLHHHHhh',
      'hHLHHHHHHhhh',
      'hHHHHh.....h',
      'hHHh........',
      'hHh.........',
      '.hh.........',
      '..h.........',
    ],
  },
  mohawk: {
    at: [1, -3],
    rows: ['..hh.....', '.hHHh....', '.hLHHh...', 'hHLHHh...', 'hHHhh....'],
  },
  bald: { at: [0, 0], rows: [] },
  long: {
    at: [-1, -1],
    rows: [
      '....hhhhhh...',
      '..hhHHHHHHh..',
      '.hHHLLLHHHHh.',
      '.hHLHHHHHHhhh',
      'hHHHHHh.....h',
      'hHHHHh.......',
      'hHHHh........',
      'hHHHh........',
      'hHHHh........',
      'hHHh.........',
      '.hhh.........',
    ],
  },
  ponytail: {
    at: [-2, -1],
    rows: [
      '.....hhhhhh...',
      '...hhHHHHHHh..',
      '..hHHLLLHHHHh.',
      '..hHLHHHHHHhhh',
      '.hhHHHHh.....h',
      'hHHHHh........',
      'hHhHh.........',
      'hHh.hh........',
      'hHh...........',
      '.h............',
    ],
  },
  bob: {
    at: [-1, -1],
    rows: [
      '....hhhhhh...',
      '..hhHHHHHHh..',
      '.hHHLLLHHHHh.',
      '.hHLHHHHHHhhh',
      'hHHHHHh..hhhh',
      'hHHHHh.......',
      'hHHHHh.......',
      'hHHHh........',
      '.hhh.........',
    ],
  },
  parted: {
    at: [0, -1],
    rows: [
      '...hhhhhh...',
      '.hhHHLHHHh..',
      'hHHLLhHHHHh.',
      'hHLHHhHHHhhh',
      'hHHHHh.....h',
      'hHHh........',
      'hHh.........',
      '.hh.........',
      '..h.........',
    ],
  },
  curly: {
    at: [-1, -2],
    rows: [
      '....hh.hh....',
      '..hhHLhHLh...',
      '.hHLHHLHHHh..',
      'hHLHHHHHLHHh.',
      'hHHHLHHHHHhhh',
      'hLHHHHh..h.hh',
      'hHHLHh.......',
      'hHHHh........',
      '.hLh.........',
      '..h..........',
    ],
  },
  tufts: {
    at: [-1, 3],
    rows: [
      '..hh....',
      '.hHLh...',
      'hHLHh...',
      'hHHHh...',
      '.hHh....',
      '..h.....',
    ],
  },
  'short-crop': {
    at: [0, -1],
    rows: [
      '...hhhhhh...',
      '.hhHHHHHHh..',
      'hHHLLLHHh...',
      'hHLHHHh.....',
      'hHHHHh......',
      'hHHh........',
      'hHh.........',
      '.hh.........',
    ],
  },
  'slick-back': {
    at: [0, -2],
    rows: [
      '...hhhhhh...',
      '.hhHHHHHHhh.',
      'hHHLLLLLHHHh',
      'hHHHHHHLLHhh',
      'hHHHHHHHhh..',
      'hHHHh.......',
      'hHh.........',
      '.h..........',
    ],
  },
  'spiky-messy': {
    at: [-1, -3],
    rows: [
      '..h..h..h.h..',
      '..hh.hh.hhh..',
      '.hHhhHhhHHh.h',
      'hhHHLHHLHHHhh',
      'hHHLHHHHHHHHh',
      'hHHHHHHHHHhhhh',
      'hHHHHh.h...h.',
      'hHHHh........',
      'hHHh.........',
      '.hh..........',
    ],
  },
  'swept-up': {
    at: [0, -4],
    rows: [
      '......hhh...',
      '....hhHLHh..',
      '...hHHLHHHh.',
      '..hHHLHHHHHh',
      '.hHHLHHHHHh.',
      'hHHHHHHhhh..',
      'hHHHh..h....',
      'hHHh........',
      'hHh.........',
      '.h..........',
    ],
  },
  puffs: {
    at: [-1, -3],
    rows: [
      '.hhh....hhh..',
      'hHLHh..hHLHh.',
      'hHHHhhhhHHHh.',
      '.hhHHHHHHhhh.',
      '.hHHLLLHHHHh.',
      '.hHLHHHHHHhhh',
      'hHHHHHh.....h',
      'hHHHh........',
      '.hHh.........',
      '..h..........',
    ],
  },
};

/** Headgear overlays. `hairBelow` = hair rows (skull coords) above it are hidden. */
export interface GearTpl extends Tpl {
  /** Hair pixels with skull row < hairBelow are removed (the gear covers them). */
  hairBelow: number;
  /** Also remove hair left of this skull column at every row (hoods). */
  hairRightOf?: number;
}

export const GEAR: Readonly<Record<Exclude<Headgear, 'none'>, GearTpl>> = {
  helmet: {
    at: [-1, -2],
    hairBelow: 3,
    rows: [
      '....jjjjjj....',
      '..jjgGGGGgjj..',
      '.jgGGGGGGGggj.',
      '.jgGGgggggggj.',
      'jjgggggggggggj',
      'jjjjjjjjjjjjjj',
    ],
  },
  cap: {
    at: [0, -2],
    hairBelow: 3,
    rows: [
      '...jjjjjj.....',
      '.jjgGGGGgjj...',
      'jgGGGGGgggj...',
      'jgGgggggggjjjj',
      'jjjjjjjjjjjjj.',
    ],
  },
  beret: {
    at: [-1, -2],
    hairBelow: 3,
    rows: [
      '...jjjjjj.....',
      '.jjgGGGGgjj...',
      'jgGGGGGGgggj..',
      'jggggggggjajj.',
      '.jjjjjjjjjjj..',
    ],
  },
  // Flat crown sloping down to the back, where the cloth flops over the head to ear height; a
  // tight band and a brass badge in front. Wider and flatter than any helmet or cap.
  'beret-slouch': {
    at: [-3, -2],
    hairBelow: 3,
    rows: [
      '.....jjjjj.....',
      '..jjgGGGGGgj...',
      '.jgGGGGGGGggjj.',
      'jgGGGGgggggggj.',
      'jgggggggggjbBj.',
      'jgggjjjjjjjjj..',
      '.jgj...........',
      '..j............',
    ],
  },
  bandana: {
    at: [-2, -1],
    hairBelow: 2,
    rows: [
      '.....jjjjj....',
      '...jjgGGGgjj..',
      '..jgGGGGGGggj.',
      '.jjgggggggggjj',
      'jgjjjjjjjjjjj.',
      'jgj...........',
      '.jj...........',
    ],
  },
  goggles: {
    at: [0, 1],
    hairBelow: 0,
    rows: ['jjjjjjjjjjj.', '.......jllsj', '........jjj.'],
  },
  hood: {
    at: [-2, -2],
    hairBelow: 12,
    rows: [
      '.....jjjjjj.....',
      '...jjgGGGGgjj...',
      '..jgGGGGGGGggj..',
      '.jgGGGGGGggggj..',
      '.jgGGgggggjj....',
      'jgGGggggj.......',
      'jgGggggj........',
      'jgGgggj.........',
      'jgggggj.........',
      'jgggggj.........',
      '.jggggj.........',
      '..jjjj..........',
    ],
  },
  shako: {
    at: [0, -6],
    hairBelow: 3,
    rows: [
      '....aA......',
      '...aAAa.....',
      '....aa......',
      '..jjjjjjj...',
      '..jgGGGgj...',
      '..jgGbBgj...',
      '..jgGbbgj...',
      '..jgggggj...',
      '.jjjjjjjjjj.',
      '.jjjjjjjjjjj',
    ],
  },
  bobble: {
    at: [0, -4],
    hairBelow: 3,
    rows: [
      '....aAa.....',
      '...aAAAa....',
      '....aaa.....',
      '...jjjjjj...',
      '.jjgGGGGgj..',
      'jgGGGGGgggj.',
      'jaAaAaAaAaj.',
      'jjjjjjjjjjj.',
    ],
  },
  rainhat: {
    at: [-3, -2],
    hairBelow: 3,
    rows: [
      '......jjjjj.....',
      '....jjgGGGgj....',
      '...jgGGGGGggj...',
      '...jgGgggggggj..',
      '.jjjjjjjjjjjjjjj',
      'jgggj...........',
      'jggj............',
      '.jj.............',
    ],
  },
  headset: {
    at: [1, -1],
    hairBelow: 0,
    rows: ['...jjjj...', '..j....j..', '.j........', '.j........', '.j........', '.j........', 'jgj.......', 'jGj.......', 'jgjjj.....'],
  },
  // Backwards: the crown over the head, the peak out over the back, the strap gap at the front
  // showing a little hair.
  'cap-back': {
    at: [-3, -2],
    hairBelow: 3,
    rows: [
      '......jjjjjj...',
      '....jjgGGGGgjj.',
      '...jgGGGGGGGggj',
      'jjjjgGGgggggggj',
      'jgggjjjjjjjhGjj',
    ],
  },
  'fur-hat': {
    at: [-1, -3],
    hairBelow: 3,
    rows: [
      '...jjjjjjj....',
      '.jjgGGGGGgjj..',
      'jgGGGGGGGggj..',
      'aAAaAaAAaAaj..',
      'aAaAAaAaAAaa..',
      'aAa...........',
      'aAa...........',
      '.aa...........',
    ],
  },
};

/** Expression patches: eye at EYE_AT, mouth at MOUTH_AT, brow at BROW_AT (skull coords). */
interface ExprTpl {
  eye: readonly string[];
  mouth: readonly string[];
  brow: readonly string[];
}

const EYE_AT: readonly [number, number] = [8, 5];
const MOUTH_AT: readonly [number, number] = [9, 8];
const BROW_AT: readonly [number, number] = [8, 4];

const EXPR: Readonly<Record<Expression, ExprTpl>> = {
  normal: { eye: ['e', 'e'], mouth: ['mm'], brow: ['hh'] },
  shout: { eye: ['e', 'e'], mouth: ['m2', 'rm', 'mm'], brow: ['.h', 'h'] },
  panic: { eye: ['ww', 'we'], mouth: ['mm', 'rm', 'mm'], brow: ['h.h'] },
  hurt: { eye: ['e.', '.e'], mouth: ['mmm'], brow: ['hh'] },
  happy: { eye: ['.e', 'e.'], mouth: ['m.', '.m'], brow: ['hh'] },
  blink: { eye: ['.', 'ee'], mouth: ['mm'], brow: ['hh'] },
  yawn: { eye: ['.', 'ee'], mouth: ['mm', 'rm', 'rm', 'mm'], brow: ['hh'] },
  chew: { eye: ['.', 'ee'], mouth: ['m', 'mm'], brow: ['hh'] },
  dazed: { eye: ['ww', 'we'], mouth: ['m.m'], brow: ['..'] },
  soot: { eye: ['w', 'w'], mouth: [], brow: [] },
};

export const EXTRAS: Readonly<Record<FaceExtra, Tpl>> = {
  moustache: { at: [7, 7], rows: ['.hhhh', 'hh..h'] },
  beard: { at: [3, 7], rows: ['..h.....h', '.hHh..hHh', '.hHHhhHHh', '..hHHHHh.', '...hhhh..'] },
  glasses: { at: [6, 4], rows: ['kkkkk', '.kllk', '..kk.'] },
  shades: { at: [6, 5], rows: ['kkkkkk', '.kklsk'] },
  freckles: { at: [8, 7], rows: ['1.1'] },
  stubble: { at: [6, 8], rows: ['.1.1', '1.1.', '.1.1'] },
  blush: { at: [8, 6], rows: ['.a'] },
  walrus: { at: [6, 7], rows: ['..hHHHh.', '.hHLLHHh', '.hHHhHHh', '..hh.hh.'] },
  'bushy-brows': { at: [7, 3], rows: ['.hHh', 'hHh.'] },
  // Drawn only on open-eyed expressions (see EYESHINE_EXPR).
  eyeshine: { at: [7, 5], rows: ['w', 'w'] },
  // The overrides (FACE_TRAITS) draw nothing here.
  'raised-brow': { at: [0, 0], rows: [] },
  smirk: { at: [0, 0], rows: [] },
  grin: { at: [0, 0], rows: [] },
  beam: { at: [0, 0], rows: [] },
  'blue-eyes': { at: [0, 0], rows: [] },
  'thick-mustache': { at: [7, 7], rows: ['.hhHh', 'hHHHHh'] },
  'heavy-stubble': { at: [5, 8], rows: ['..x.x.x', '.x.x.x.', 'x.x....'] },
  'thin-mustache': { at: [9, 7], rows: ['HH'] },
};

/** Extras drawn under the eye and mouth (shading on the skin). */
const UNDER_EXTRAS: ReadonlySet<FaceExtra> = new Set<FaceExtra>(['heavy-stubble']);

/**
 * Face traits that replace one part of an expression (a character's signature look) on the
 * expressions listed; any other expression keeps its own part (a shout still opens the mouth).
 */
export interface FaceTrait {
  part: 'eye' | 'mouth' | 'brow';
  on: ReadonlySet<Expression>;
  tpl: Tpl;
}

const CALM: ReadonlySet<Expression> = new Set<Expression>(['normal', 'blink', 'happy', 'chew']);
const OPEN: ReadonlySet<Expression> = new Set<Expression>(['normal', 'shout']);

export const FACE_TRAITS: Readonly<Partial<Record<FaceExtra, FaceTrait>>> = {
  'raised-brow': { part: 'brow', on: new Set<Expression>(['normal', 'blink', 'happy', 'chew', 'shout']), tpl: { at: [8, 2], rows: ['.hh', 'h..'] } },
  smirk: { part: 'mouth', on: new Set<Expression>(['normal', 'blink']), tpl: { at: [8, 7], rows: ['m..', '.mm'] } },
  grin: { part: 'mouth', on: CALM, tpl: { at: [7, 8], rows: ['mtttt', '.mmm'] } },
  beam: { part: 'eye', on: OPEN, tpl: { at: [8, 5], rows: ['.e', 'e.'] } },
  'blue-eyes': { part: 'eye', on: OPEN, tpl: { at: [8, 5], rows: ['l', 'e'] } },
};

/** The eye, mouth and brow of an expression with the style's face traits applied. */
function facePart(extras: readonly FaceExtra[], expr: Expression, part: FaceTrait['part'], fallback: Tpl): Tpl {
  let t = fallback;
  for (const x of extras) {
    const tr = FACE_TRAITS[x];
    if (tr && tr.part === part && tr.on.has(expr)) t = tr.tpl;
  }
  return t;
}

/** Expressions whose eye is a plain open pupil: the ones `eyeshine` brightens. */
export const EYESHINE_EXPR: ReadonlySet<Expression> = new Set<Expression>(['normal', 'shout']);

export interface HeadStyle {
  skin: Ramp;
  hair: Ramp;
  hairStyle: HairStyle;
  headgear: Headgear;
  gear: Ramp;
  accent: Ramp;
  extras: readonly FaceExtra[];
  /** false: the headgear is off (knocked away); the hair shows in full. Default true. */
  hat?: boolean;
  /** The headgear slips down by this many px (a helmet over the eyes). Default 0. */
  hatDy?: number;
}

/** Draw template rows at a skull-relative offset. */
function put(
  buf: PixelBuffer,
  t: Tpl,
  key: (ch: string) => Color | null,
  filter?: (sx: number, sy: number) => boolean,
): void {
  const ox = BASE_AT[0] + t.at[0];
  const oy = BASE_AT[1] + t.at[1];
  for (let y = 0; y < t.rows.length; y++) {
    const row = t.rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      if (filter && !filter(t.at[0] + x, t.at[1] + y)) continue;
      if (ch === '-') {
        buf.set(ox + x, oy + y, 0);
        continue;
      }
      const c = key(ch);
      if (c !== null) buf.set(ox + x, oy + y, c);
    }
  }
}

/** The palette for a style: template letter → colour (null = not a colour letter). */
function paletteKey(s: HeadStyle): (ch: string) => Color | null {
  return (ch: string): Color | null => {
    switch (ch) {
      case '0':
        return at(s.skin, 0);
      case '1':
        return at(s.skin, 1);
      case '2':
        return at(s.skin, 2);
      case '3':
        return at(s.skin, 3);
      case 'h':
        return at(s.hair, 0);
      case 'H':
        return at(s.hair, 1);
      case 'L':
        return at(s.hair, 2);
      case 'j':
        return at(s.gear, 0);
      case 'g':
        return at(s.gear, 1);
      case 'G':
        return at(s.gear, 2);
      case 'a':
        return at(s.accent, 1);
      case 'A':
        return at(s.accent, 2);
      case 'k':
        return INK;
      case 'e':
        return INK;
      case 'w':
      case 'W': // the 2× eye highlight (see renderHeadHi `glint`)
        return PAL.snow[3];
      case 'm':
        return at(s.skin, 0);
      case 'r':
        return PAL.red[1];
      case 't':
        return PAL.snow[3];
      case 'l':
        return PAL.sky[2];
      case 's':
        return PAL.snow[3];
      case 'x': // stubble shadow
        return PAL.sand[1];
      case 'b':
        return PAL.gold[2];
      case 'B':
        return PAL.gold[3];
      default:
        return null;
    }
  };
}

/**
 * Render a head (HEAD_W × HEAD_H, facing right) for a style and expression. The result is
 * shaded; the rig outlines the whole figure afterwards.
 */
export function renderHead(s: HeadStyle, expr: Expression): PixelBuffer {
  const buf = new PixelBuffer(HEAD_W, HEAD_H);
  const key = paletteKey(s);
  put(buf, { at: [0, 0], rows: SKULL }, key);
  const e = EXPR[expr];
  for (const x of s.extras) if (UNDER_EXTRAS.has(x)) put(buf, EXTRAS[x], key);
  put(buf, facePart(s.extras, expr, 'eye', { at: EYE_AT, rows: e.eye }), key);
  put(buf, facePart(s.extras, expr, 'mouth', { at: MOUTH_AT, rows: e.mouth }), key);
  for (const x of s.extras) {
    if (x === 'eyeshine' && !EYESHINE_EXPR.has(expr)) continue;
    if (x !== 'bushy-brows' && !UNDER_EXTRAS.has(x)) put(buf, EXTRAS[x], key);
  }
  const gear = s.headgear === 'none' || s.hat === false ? null : GEAR[s.headgear];
  const slip = gear ? Math.max(0, Math.round(s.hatDy ?? 0)) : 0;
  put(buf, HAIR[s.hairStyle], key, (sx, sy) => {
    if (!gear) return true;
    if (sy < gear.hairBelow + slip) return false;
    return gear.hairRightOf === undefined || sx >= gear.hairRightOf;
  });
  // Brows sit on top of the fringe so expressions stay readable under any hair; gear may
  // still cover them.
  put(buf, facePart(s.extras, expr, 'brow', { at: BROW_AT, rows: e.brow }), key);
  if (s.extras.includes('bushy-brows')) put(buf, EXTRAS['bushy-brows'], key);
  if (gear) put(buf, slip ? { ...gear, at: [gear.at[0], gear.at[1] + slip] } : gear, key);
  return buf;
}

/** A 1× template on the 2× grid (each pixel a 2 × 2 block): parts without a hand-drawn 2× twin. */
function doubled(t: Tpl): HiTpl {
  const rows: string[] = [];
  for (const r of t.rows) {
    let d = '';
    for (const ch of r) d += ch + ch;
    rows.push(d, d);
  }
  return { at: [t.at[0] * 2, t.at[1] * 2], rows };
}

/** Draw 2× template rows; `filter` gets LOGICAL skull coordinates (as the 1× filters). */
function putHi(
  buf: PixelBuffer,
  t: HiTpl,
  key: (ch: string) => Color | null,
  filter?: (sx: number, sy: number) => boolean,
): void {
  const ox = BASE_AT[0] * 2 + t.at[0];
  const oy = BASE_AT[1] * 2 + t.at[1];
  for (let y = 0; y < t.rows.length; y++) {
    const row = t.rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      if (filter && !filter(Math.floor((t.at[0] + x) / 2), Math.floor((t.at[1] + y) / 2))) continue;
      if (ch === '-') {
        buf.set(ox + x, oy + y, 0);
        continue;
      }
      const c = key(ch);
      if (c !== null) buf.set(ox + x, oy + y, c);
    }
  }
}

/** facePart on the 2× grid: a trait's 2× twin (TRAITS_HI), else its 1× template doubled. */
function facePartHi(extras: readonly FaceExtra[], expr: Expression, part: FaceTrait['part'], fallback: HiTpl): HiTpl {
  let t = fallback;
  for (const x of extras) {
    const tr = FACE_TRAITS[x];
    if (tr && tr.part === part && tr.on.has(expr)) t = TRAITS_HI[x] ?? doubled(tr.tpl);
  }
  return t;
}

/**
 * The 2× head (mission ams): HEAD_W·2 × HEAD_H·2, the same logical layout as `renderHead` (NECK
 * and HEAD_CENTER are the 2 × 2 blocks at twice them), drawn from the hand-drawn 2× templates in
 * humanoid-head-hi.ts, with the same layer order, hair cut-off and hat slip as at 1×. A part
 * without a 2× template is its 1× template doubled. No outline (the rig adds it). The rig reads
 * this through `headLayerHi` in humanoid.ts.
 */
export function renderHeadHi(s: HeadStyle, expr: Expression, opts: { glint?: boolean } = {}): PixelBuffer {
  const buf = new PixelBuffer(HEAD_W * 2, HEAD_H * 2);
  const base = paletteKey(s);
  // glint: false (a tilted head) draws the eye highlight 'W' as pupil: a rotated 1-px highlight
  // can land beside the pupil and read as a second eye.
  const key = opts.glint === false ? (ch: string): Color | null => base(ch === 'W' ? 'e' : ch) : base;
  putHi(buf, { at: [0, 0], rows: SKULL_HI }, key);
  const e = EXPR_HI[expr];
  for (const x of s.extras) if (UNDER_EXTRAS.has(x)) putHi(buf, EXTRAS_HI[x] ?? doubled(EXTRAS[x]), key);
  putHi(buf, facePartHi(s.extras, expr, 'eye', e.eye), key);
  putHi(buf, facePartHi(s.extras, expr, 'mouth', e.mouth), key);
  for (const x of s.extras) {
    if (x === 'eyeshine' && !EYESHINE_EXPR.has(expr)) continue;
    if (x !== 'bushy-brows' && !UNDER_EXTRAS.has(x)) putHi(buf, EXTRAS_HI[x] ?? doubled(EXTRAS[x]), key);
  }
  const gear = s.headgear === 'none' || s.hat === false ? null : GEAR[s.headgear];
  const slip = gear ? Math.max(0, Math.round(s.hatDy ?? 0)) : 0;
  putHi(buf, HAIR_HI[s.hairStyle] ?? doubled(HAIR[s.hairStyle]), key, (sx, sy) => {
    if (!gear) return true;
    if (sy < gear.hairBelow + slip) return false;
    return gear.hairRightOf === undefined || sx >= gear.hairRightOf;
  });
  putHi(buf, facePartHi(s.extras, expr, 'brow', e.brow), key);
  if (s.extras.includes('bushy-brows')) putHi(buf, EXTRAS_HI['bushy-brows'] ?? doubled(EXTRAS['bushy-brows']), key);
  if (gear && s.headgear !== 'none') {
    const g = GEAR_HI[s.headgear] ?? doubled(gear);
    putHi(buf, slip ? { ...g, at: [g.at[0], g.at[1] + slip * 2] } : g, key);
  }
  return buf;
}

/** The skull template's size and placement, for portrait builders. */
export const SKULL_INFO = { at: BASE_AT, w: 12, h: 12 } as const;
