/**
 * 2× head templates (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): the same 12×12
 * logical skull and the same overlays as humanoid-head.ts, hand-drawn on the 2× grid (24×24 for
 * the skull). Each template keeps its 1× twin's footprint (a logical pixel = a 2 × 2 block), so
 * neck, hats and the rig's outline fit exactly as at 1×; the finer grid is used for the details:
 * an eye highlight, thin brows, the nostril and lip shadows, the ear's fold, hair strands, cap
 * seams and lens glints. Light from the top-left, palette letters only (the same key as the 1×
 * templates), no outline (the rig adds it).
 *
 * Offsets are in 2× pixels relative to the 2× skull's top-left (= twice the 1× offsets). Parts
 * without a 2× template here are drawn from their 1× template doubled (see `renderHeadHi`).
 */
import type { Expression, FaceExtra, HairStyle, Headgear } from './humanoid-head';

export interface HiTpl {
  /** Offset in 2× pixels relative to the 2× skull template's top-left. */
  at: readonly [number, number];
  rows: readonly string[];
}

export interface HiExprTpl {
  eye: HiTpl;
  mouth: HiTpl;
  brow: HiTpl;
}

/** Bald skull + face on the 2× grid. Rows 0–21 head, 22–23 neck; eye 16–17 × 10–13, mouth 18–21 × 16. */
export const SKULL_HI: readonly string[] = [
  '.......333333...........',
  '.....3333333333.........',
  '....3333333333333332....',
  '...33333333333333322....',
  '..33333333333333333222..',
  '..333333333333333332222.',
  '..333333333333333222222.',
  '..2333333333333222222222',
  '..22333333333322222222..',
  '..22333333333322332222..',
  '..22222222223333223322..',
  '..22222211223333223322..',
  '..222221101222332233223.',
  '..2222210012222322322222',
  '...222211112222222222211',
  '....2222112222222222221.',
  '....22111122222222222222',
  '....2211112222222222222.',
  '......111122222222221...',
  '.......1112222222211....',
  '........111111111.......',
  '........11111111........',
  '........111111..........',
  '........111111..........',
];

export const EXPR_HI: Readonly<Record<Expression, HiExprTpl>> = {
  normal: {
    eye: { at: [16, 10], rows: ['We', 'ee', 'ee', 'ee'] },
    mouth: { at: [18, 16], rows: ['mmmm', '.11.'] },
    brow: { at: [16, 8], rows: ['hhhh', 'h...'] },
  },
  // Open eye and a flat, raised brow: shouting and talking, never angry.
  shout: {
    eye: { at: [16, 10], rows: ['We', 'ee', 'ee'] },
    mouth: { at: [18, 16], rows: ['mmmm', 'mttm', 'mrrm', 'mrrm', '.mmm'] },
    brow: { at: [16, 7], rows: ['hhhh'] },
  },
  panic: {
    eye: { at: [16, 10], rows: ['www.', 'wwww', 'wwee', 'wwee'] },
    mouth: { at: [18, 16], rows: ['.mm.', 'mrrm', 'mrrm', 'mrrm', '.mm.'] },
    brow: { at: [15, 7], rows: ['.hh..hh', 'h......'] },
  },
  hurt: {
    eye: { at: [16, 10], rows: ['ee..', '.ee.', '..ee'] },
    mouth: { at: [18, 16], rows: ['mmmmm.', 'mtmtmm', 'mmmmm.'] },
    brow: { at: [16, 8], rows: ['hhhh', '....'] },
  },
  happy: {
    eye: { at: [16, 10], rows: ['....', '.ee.', 'eeee', 'e..e'] },
    mouth: { at: [18, 16], rows: ['m..m', '.mm.'] },
    brow: { at: [16, 7], rows: ['hhhh'] },
  },
  // Open eye (as normal) and the happy smile.
  smile: {
    eye: { at: [16, 10], rows: ['We', 'ee', 'ee', 'ee'] },
    mouth: { at: [18, 16], rows: ['m..m', '.mm.'] },
    brow: { at: [16, 7], rows: ['hhhh'] },
  },
  blink: {
    eye: { at: [16, 10], rows: ['....', '....', 'eeee', '.ee.'] },
    mouth: { at: [18, 16], rows: ['mmmm', '.11.'] },
    brow: { at: [16, 8], rows: ['hhhh', 'h...'] },
  },
  yawn: {
    eye: { at: [16, 10], rows: ['....', '....', 'eeee', '.ee.'] },
    mouth: { at: [18, 16], rows: ['mmmm', 'mrrm', 'mrrm', 'mrrm', 'mrrm', 'mrrm', 'mmmm', '.mm.'] },
    brow: { at: [16, 8], rows: ['hhhh', 'h...'] },
  },
  chew: {
    eye: { at: [16, 10], rows: ['....', '....', 'eeee', '.ee.'] },
    mouth: { at: [18, 16], rows: ['mm..', '.mmm', '..1.'] },
    brow: { at: [16, 8], rows: ['hhhh', 'h...'] },
  },
  dazed: {
    eye: { at: [16, 10], rows: ['.ww.', 'weew', 'wwew', '.ww.'] },
    mouth: { at: [18, 16], rows: ['.m..m.', 'm.mm.m'] },
    brow: { at: [16, 8], rows: [] },
  },
  soot: {
    // White eyes with a pupil and a small mouth in the blackened face: startled, not a glare.
    eye: { at: [15, 10], rows: ['www', 'wew', 'www', '.w.'] },
    mouth: { at: [18, 17], rows: ['.mmm'] },
    brow: { at: [16, 8], rows: [] },
  },
};

export const EXTRAS_HI: Readonly<Partial<Record<FaceExtra, HiTpl>>> = {
  // A bold handlebar under the nose: it droops on both sides of the mouth.
  moustache: { at: [14, 14], rows: ['..hhhhhhhh', 'hhHHLLLHHh', 'hHHh....Hh', 'hh......hh'] },
  // Full beard round the jaw from the sideburns, the moustache over the mouth (as at 1×).
  beard: {
    at: [6, 14],
    rows: [
      '....hh..........hh',
      '...hHh.........hHh',
      '..hHHh......hhHHHh',
      '..hHLHh....hHHLHhh',
      '..hHLHHhhhhHHHLHHh',
      '..hHHLHHHHHHLHHHhh',
      '...hHHLHHLHHHHHHh.',
      '....hHHHLHHHHHHh..',
      '.....hhHHHHHhhh...',
      '......hhhhhhhh....',
    ],
  },
  // Round frame and a light lens; the eye shows through the lens at the back.
  glasses: { at: [10, 9], rows: ['.....kkkkkkk', 'kkkkkk..lslk', '.....k..lllk', '.....k..lllk', '.....k..llkk', '......kkkkk.'] },
  shades: { at: [12, 10], rows: ['kkkkkkkkkkkk', '..kkkkkkkslk', '..kkkkkkllkk', '...kkkkkkkk.'] },
  freckles: { at: [15, 14], rows: ['1...1.', '..1...', '.1...1'] },
  // An even checker along the jaw, one step darker than the cheek: no scattered dots.
  stubble: { at: [11, 18], rows: ['.1.1.1.1.', '1.1.1.1..'] },
  blush: { at: [18, 12], rows: ['.a', 'aa'] },
  // A big droopy moustache that hides the mouth, in strands.
  walrus: {
    at: [12, 14],
    rows: [
      '.....hhhhhh.....',
      '...hhHHHHHHhh...',
      '..hHHLLLLLHHHh..',
      '.hHLLLLLLHHHHHh.',
      '.hHLLLHHHHHHHHh.',
      '.hHHHHHHHhHHhHh.',
      '..hHHHhHHhHHhh..',
      '...hh..hh..hh...',
    ],
  },
  'bushy-brows': { at: [14, 6], rows: ['..hhhh..', '.hHLLHh.', 'hHLLHHhh', 'hhhhhh..'] },
  eyeshine: { at: [14, 10], rows: ['.w', 'ww', 'ww', '.w'] },
  // A thick brush of a moustache, lit strands, a little past the face.
  'thick-mustache': {
    at: [14, 14],
    rows: [
      '..hhhhhhhh..',
      '.hHHLLLHHHh.',
      'hHHLLHHHHHHh',
      'hhHHHhhHHHhh',
      '.h........h.',
    ],
  },
  // Dark stubble: an even fine stipple over the jaw and upper lip (drawn under the mouth).
  'heavy-stubble': {
    at: [10, 15],
    rows: [
      '.............x',
      '.....x.x.x.x.x',
      '....x.x.x.x.x.',
      '...x.x.x.x.x..',
      '..x.x.x.x.....',
      '.x.x.x.x......',
      'x.x...........',
    ],
  },
  // A thin trimmed line under the nose.
  'thin-mustache': { at: [17, 15], rows: ['.hHHh', 'h...h'] },
};

export const HAIR_HI: Readonly<Partial<Record<HairStyle, HiTpl>>> = {
  // Short crop: a high front hairline, fine strands combed forward and down at the temple.
  'short-crop': {
    at: [0, -2],
    rows: [
      '.......hhhhhhhhhh.......',
      '.....hhHHHHHHHHHHhh.....',
      '...hhHHHHLLLHHHHHHHh....',
      '..hHHHHLLHHHLLHHHHHhh...',
      '.hHHHLLHHHHHHHLHHHhh....',
      'hHHHLHHHHHHHHHHHhhh.....',
      'hHHLHHLLHHHHhhh.........',
      'hHHLHLHHHHHhh...........',
      'hHHHHHHHHHhh............',
      'hHHHHHHHHh..............',
      'hHHHHHHhh...............',
      'hHHHHhh.................',
      'hHHHhh..................',
      'hHHh....................',
      '.hHHh...................',
      '..hh....................',
    ],
  },
  // Slick back: glossy comb lines running back over the crown, short tapered sides.
  'slick-back': {
    at: [0, -4],
    rows: [
      '.......hhhhhhhhhh.......',
      '.....hhHHHHHHHHHHhh.....',
      '...hhHHHHHHLLLLHHHHhh...',
      '..hHHHHLLLLHHHHHHHHHhh..',
      '.hHHHLLHHHHHHLLLLHHHHHh.',
      'hHHLLHHHHLLLLHHHHHHHHHhh',
      'hHHHHHLLLHHHHHHLLLLHHhhh',
      'hHHHLLHHHHHHLLLHHHHhhhh.',
      'hHHHHHHHHHHHHHHHhhh.....',
      'hHHHHHHHHHHHHhhh........',
      'hHHHHHHHhh..............',
      'hHHHHHhh................',
      'hHHHhh..................',
      'hHHh....................',
      '.hh.....................',
      '.h......................',
    ],
  },
  // Messy spikes with sharp tips, two loose strands over the forehead.
  'spiky-messy': {
    at: [-2, -6],
    rows: [
      '....h.....h......h...h....',
      '....hh....hh....hh..hh....',
      '....hHh...hHh..hhh..hh....',
      '....hHhh..hHhh.hHhhhHh....',
      '..hhHHhhhhHHhhhhHHHHhh..h.',
      '..hHHHHhhHHHHhhHHHHHhh.hh.',
      'hhhHHHHHLLHHHHLLHHHHHHhhhh',
      'hhHHHHHLLHHHHLLHHHHHHHHhhh',
      'hhHHHHLLHHHHHHHHHHHHHHHHhh',
      'hHHHHLLHHHHHHHHHHHHHHHHHhh',
      'hhHHHHHHHHHHHHHHHHHHHhhhhhhh',
      'hHHHHHHHHHHHHHHHHHHhhhhhh.hh',
      'hhHHHHHHHHhh..hh......hh..',
      'hHHHHHHHHhh....h.......h..',
      'hhHHHHHHhh................',
      'hHHHHHHhh.................',
      'hhHHHHhh..................',
      'hHHHHh....................',
      '..hhh.....................',
      '..hh......................',
    ],
  },
  // Swept up: a tall tousled quiff rising to the front, strands combed up from the brow.
  'swept-up': {
    at: [0, -8],
    rows: [
      '............hhhhh.......',
      '...........hhHHLHh......',
      '.........hhHHHLLHHh.....',
      '........hHHHHLLHHHHh....',
      '.......hHHHHLLHHHHHHhh..',
      '......hHHHHLLHHHHHLHHh..',
      '.....hHHHHLLHHHHHLLHHHhh',
      '....hHHHHLLHHHHHLLHHHHhh',
      '...hHHHHLLHHHHHLLHHHHhh.',
      '..hHHHHLLHHHHHHHHHHHhh..',
      '.hHHHHHHHHHHHHHhhhhh....',
      'hHHHHHHHHHHHHhhhhh......',
      'hHHHHHHHhh....hh........',
      'hHHHHHHhh.....h.........',
      'hHHHHHhh................',
      'hHHHHh..................',
      'hHHhh...................',
      'hHHh....................',
      '.hh.....................',
      '..h.....................',
    ],
  },
  short: {
    at: [0, -2],
    rows: [
      '......hhhhhhhhhhhh......',
      '....hhHHHHHHHHHHHHhh....',
      '...hHHHLLLLHHHHHHHHHh...',
      '..hHHLLHHHHLLHHHHHHHHh..',
      '.hHHLHHHHHHHHLHHHHHHHHh.',
      'hHHLHHHLLLHHHHHHHHHHHhh.',
      'hHLHHLLHHHHHHhHHHHHhhhhh',
      'hHLHLHHHHHHhHHHHhHHHHHhh',
      'hHHHHHHHHHHhh..h....hhhh',
      'hHHHHHHHHhh..........hh.',
      'hHHHHHh.',
      'hHHHHh..',
      'hHHHh...',
      'hHHh....',
      '.hHh....',
      '.hHh....',
      '..hh....',
      '...h....',
    ],
  },
  buzz: {
    at: [0, 0],
    rows: [
      '......hhhhhhhh..........',
      '.....hHHHHHHHHh.........',
      '....hHHLHHLHHHHhhh......',
      '...hHLHHLHHHHHHHHHh.....',
      '..hHHHLHHHHLHHHHHHHh....',
      '..hHLHHHLHHHHHHHHHHh....',
      '..hHHHHHHHHHHHHHHhh.....',
      '..hHHHHHHhhhhhhhh.......',
      '..hHHHHh................',
      '..hHHHh.................',
      '..hHh...................',
      '..hh....................',
    ],
  },
  parted: {
    at: [0, -2],
    rows: [
      '......hhhhhhhhhhhh......',
      '....hhHHHHHHLHHHHHhh....',
      '...hHHHHHLLLhHHHHHHHh...',
      '..hHHHLLLLLhHHHHHHHHHh..',
      '.hHHLLHHHHhHHHHHHHHHHHh.',
      'hHHLHHHHHHhHHHHHHHHHHhh.',
      'hHLHHHHHHhHHHHHHHHHhhhhh',
      'hHLHHHHHHhHHHHHHHHHHHHhh',
      'hHHHHHHHHHhh.h......hhhh',
      'hHHHHHHHHhh..........hh.',
      'hHHHHHh.',
      'hHHHHh..',
      'hHHHh...',
      'hHHh....',
      '.hHh....',
      '.hHh....',
      '..hh....',
      '...h....',
    ],
  },
  long: {
    at: [-2, -2],
    rows: [
      '.........hhhhhhhh.........',
      '.......hhHHHHHHHHhh.......',
      '.....hhHHHHHHHHHHHHhh.....',
      '....hHHHHLLLLHHHHHHHHh....',
      '...hHHHLLHHHHLLHHHHHHHh...',
      '..hHHLLHHHHHHHHHHHHHHHHh..',
      '..hHLHHHHHHHHHHHHHHHHhhhhh',
      '..hHLHHHHHHHHHHHHHHhhHHhhh',
      '.hHLHHHHhHHHh..........hhh',
      'hHHLHHHhHHHh...........hh.',
      'hHLHHHhHHHh...............',
      'hHLHHHhHHh................',
      'hHLHHhHHHh................',
      'hHHLHhHHHh................',
      'hHHLHhHHHh................',
      'hHHLHHhHHh................',
      'hHHHLHhHHh................',
      'hHHHLHhHh.................',
      'hHHHHhHHh.................',
      '.hHHHhHh..................',
      '..hHhhHh..................',
      '...hh.hh..................',
    ],
  },
  ponytail: {
    at: [-4, -2],
    rows: [
      '...........hhhhhhhh.........',
      '.........hhHHHHHHHHhh.......',
      '.......hhHHHHHHHHHHHHh......',
      '......hHHHHLLLLHHHHHHHh.....',
      '.....hHHLLLHHHHLLHHHHHHh....',
      '....hHHLHHHHHHHHHHHHHHHHh...',
      '....hHLHHHHHHHHHHHHHHHhhhhh.',
      '....hHLHHHHHHHHHHHHHhhHHHhhh',
      '...hhHHHHHHHHHh........hhhhh',
      '..hHHHHHHHHHHh..........hhh.',
      'hhHHLHHHHHh.................',
      'hHLHHHHHhh..................',
      'hHLHhHHh....................',
      'hHLHhhHHh...................',
      'hHLh..hHh...................',
      'hHHh...hh...................',
      'hLHh........................',
      'hHHh........................',
      '.hh.........................',
      '..h.........................',
    ],
  },
  bob: {
    at: [-2, -2],
    rows: [
      '.........hhhhhhhhhh.......',
      '......hhhHHHHHHHHHHhh.....',
      '....hhHHHHLLLLLHHHHHHh....',
      '...hHHHHLLHHHHHLLHHHHHh...',
      '..hHHHLLHHHHHHHHHLHHHHHh..',
      '..hHHLHHHHHHHHHHHHHHHHHhh.',
      '.hHHLHHHHHHHHHHHHHHHHhhhhh',
      '.hHLHHHHHHhHHHHHHhHHHHHhhh',
      'hHHLHHHHHhHHHh....hHHhHHhh',
      'hHLHHHHHhHHHh.....hhh.hhh.',
      'hHLHHHHhHHh...............',
      'hHLHHHhHHHh...............',
      'hHLHHhHHHHh...............',
      'hHHLHhHHHh................',
      'hHHLHhHHh.................',
      '.hHHhHHHh.................',
      '..hhHhhh..................',
      '...hh.hh..................',
    ],
  },
  curly: {
    at: [-2, -4],
    rows: [
      '.........hh....hh.........',
      '........hLHh..hLHh........',
      '.....hhhLHHhhhLHHhh.......',
      '....hLHhHHhLHhHHhLHh......',
      '...hLHHHhhLHHHhhLHHHh.....',
      '..hLHhhhLHHhhhLHHhhHh.....',
      '.hLHhLHHHhhLHHHhhHHHHhh...',
      'hLHhLHHhhLHHhhLHHHhhHHHh..',
      'hHhLHHhLHHhhLHHHhhLHHhhHhh',
      'hHLHHhLHHhLHHhhhLHHHhhhhhh',
      'hLHHhLHHhLHhhh....hh..hhhh',
      'hHHhLHHhhHh.......h...h.hh',
      'hLHhHHhLHh................',
      'hHHhLHHHhh................',
      'hLHHHhLHh.................',
      '.hHLHHHHh.................',
      '..hLHhHh..................',
      '..hHHh....................',
      '...hh.....................',
      '....h.....................',
    ],
  },
  tufts: {
    at: [-2, 6],
    rows: [
      '.....hh.........',
      '...hhLLh........',
      '..hLLHHHh.......',
      '.hLHHHHHh.......',
      'hLHHHLLHHh......',
      'hLHHLHHHHh......',
      'hHHLHHHHHh......',
      'hHHHHHHHh.......',
      '.hHHHHHHh.......',
      '..hHHHh.........',
      '...hHh..........',
      '....h...........',
    ],
  },
};

export const GEAR_HI: Readonly<Partial<Record<Exclude<Headgear, 'none'>, HiTpl>>> = {
  // Backwards cap: a six-panel crown, the peak out over the back of the head (a pale edge), the
  // strap gap at the front with a little hair and the plastic strap.
  'cap-back': {
    at: [-6, -4],
    rows: [
      '.............jjjjjjjjjj.......',
      '..........jjjgGGGGGGGgjjj.....',
      '........jjgGGGGGGGGGgGGggjj...',
      '.......jgGGGGGGGGGGGgGgggggj..',
      '......jgGGGGGGGGGGGGgGggggggj.',
      '......jgGGGGGGGGGGggjgggggggjj',
      'jjjjjjjgGGGgggggggggjgggggggjj',
      'jGGGGjjggggggggggggggggggggggj',
      'jgggggjjjjjjjjjjjjjjjjhhGGjjjj',
      '.jjjjjjjjjjjjjjjjjjjjjhhggjjj.',
    ],
  },
  // Six-panel cap: a seam down the crown, a lit front panel, the peak with a pale edge.
  cap: {
    at: [0, -4],
    rows: [
      '......jjjjjjjjjjjj..........',
      '....jjjgGGGGGGGgjjj.........',
      '..jjgGGGGGGGGGGGggjj........',
      '.jgGGGGGGGGGGGGgggggj.......',
      'jgGGGGGGGGgGGgggggggj.......',
      'jgGGGGGGGgGgggggggggj.......',
      'jgGGgggggjggggggggggj.......',
      'jgggggggjgggggggggggjjjjjjjj',
      'jgggggggggggggggggggjgGGGGj.',
      'jjjjjjjjjjjjjjjjjjjjjjjjjj..',
    ],
  },
  helmet: {
    at: [-2, -4],
    rows: [
      '..........jjjjjjjj..........',
      '.......jjjgGGGGGGgjjj.......',
      '.....jjgGGGGGGGGGGGGgjj.....',
      '....jgGGGGGGGGGGGGGGGggj....',
      '...jgGGGGGGGGGGGGGGGGgggj...',
      '..jgGGGGGGGGGGGGGGGGggggj...',
      '..jgGGGGgggggggggggggggggj..',
      '..jgGGgggggggggggggggggggj..',
      '.jjgggggggggggggggggggggggj.',
      'jjggggggggggggggggggggggggjj',
      'jgggggggggggggggggggggggggjj',
      'jjjjjjjjjjjjjjjjjjjjjjjjjjjj',
    ],
  },
  hood: {
    at: [-4, -4],
    rows: [
      '..........jjjjjjjjjjjj..........',
      '.......jjjgGGGGGGGGGGgjjj.......',
      '.....jjgGGGGGGGGGGGGGGGggjj.....',
      '....jgGGGGGGGGGGGGGGGGGGgggj....',
      '...jgGGGGGGGGGGGGGGGGGGgggggj...',
      '...jgGGGGGGGGGGGGGGGGGggggggj...',
      '..jgGGGGGGGGGGGGGGGGgggggggggj..',
      '..jgGGGGGGGGGGGGGGGgggggggjjjj..',
      '..jgGGGGgggggggggggggjjjjj......',
      '..jgGGGggggggggggjjjjj..........',
      '.jgGGGgggggggggjjj..............',
      'jgGGGgggggggjjj.................',
      'jgGGgggggggjj...................',
      'jgGGggggggjj....................',
      'jgGGgggggjj.....................',
      'jgGgggggggj.....................',
      'jgGggggggj......................',
      'jgGgggjggj......................',
      'jggggjgggj......................',
      'jgggjggggj......................',
      '.jggggggj.......................',
      '.jgggggjj.......................',
      '..jjjjjj........................',
      '...jjjj.........................',
    ],
  },
  bobble: {
    at: [0, -8],
    rows: [
      '.........aaaa...........',
      '.......aAAAaaa..........',
      '......aAAAAAaaa.........',
      '......aAAaAaaaa.........',
      '.......aaAaaaa..........',
      '........aaaaa...........',
      '......jjjjjjjjjjjj......',
      '....jjgGGGGGGGGgjj......',
      '..jjgGGGGGGGGGGGggjj....',
      '.jgGGGGGGGGGGGGggggj....',
      'jgGGGGGGGGGGGGGgggggj...',
      'jgGGgGGGgGGGgGGggggj....',
      'jAAAAAAAAAAAAAAAaaaj....',
      'jaaaaaaaaaaaaaaaaaaj....',
      'jgggggggggggggggggjj....',
      'jjjjjjjjjjjjjjjjjjjj....',
    ],
  },
  'beret-slouch': {
    at: [-6, -4],
    rows: [
      '..........jjjjjjjjjj..........',
      '.......jjjgGGGGGGGGgjj........',
      '....jjjgGGGGGGGGGGGGGgjj......',
      '...jgGGGGGGGGGGGGGGGGGggj.....',
      '..jgGGGGGGGGGGGGGGGGGgggjjj...',
      '.jgGGGGGGGGGGGGGGGGgggggggjj..',
      'jgGGGGGGGGGgggggggggggggggj...',
      'jgGGGGGggggggggggggggggggggj..',
      'jgggggggggggggggggggggjbBBj...',
      'jggggggggggggggggggggjbbbbj...',
      'jgggggggjjjjjjjjjjjjjjjjjj....',
      'jggggggjjjjjjjjjjjjjjjjjj.....',
      '.jgggggj......................',
      '..jgggj.......................',
      '...jgj........................',
      '....j.........................',
    ],
  },
  goggles: {
    at: [0, 2],
    rows: [
      'jjjjjjjjjjjjjjjjjjjjjj..',
      'gGggggGggggggjgGGGGGgj..',
      '..............jgsslllgj.',
      '..............jglllllgj.',
      '...............jgggggj..',
      '................jjjjj...',
    ],
  },
  rainhat: {
    at: [-6, -4],
    rows: [
      '............jjjjjjjjj...........',
      '..........jjgGGGGGGGgjj.........',
      '........jjgGGGGGGGGGGggj........',
      '........jgGGGGGGGGGGGggj........',
      '......jgGGGGGGGGGGGGggggj.......',
      '......jgGGGGGGGGGGGgggggj.......',
      '......jgGgggggggggggggggggj.....',
      '......jgggggggggggggggggggggj...',
      '..jjjjjjjjjjjjjjjjjjjjjjjjjjjjjj',
      '.jgGGgggggggggggggggggggggggggj.',
      'jgGggggj........................',
      'jgGgggj.........................',
      'jgggggj.........................',
      'jgggjj..........................',
      '.jjj............................',
      '..jj............................',
    ],
  },
};

/**
 * 2× twins of the face traits that replace an expression's eye, mouth or brow (FACE_TRAITS in
 * humanoid-head.ts; offsets as EXPR_HI). A trait without one here is its 1× template doubled.
 */
export const TRAITS_HI: Readonly<Partial<Record<FaceExtra, HiTpl>>> = {
  // A high arched brow with a fine crease above it.
  'raised-brow': { at: [16, 3], rows: ['....1.', '..hhhh', '.hh..h', 'hh....', 'h.....'] },
  // The back corner pulled up into the cheek, a dimple.
  smirk: { at: [15, 13], rows: ['1.....', '.m....', '..m...', '..mmmmm', '...111.'] },
  // A wide open grin: two rows of teeth, a lower lip.
  grin: {
    at: [14, 16],
    rows: [
      'm.mmmmmmmm',
      'mmtttttttm',
      '..mttttm..',
      '...mmmm...',
    ],
  },
  // Squinted happy eyes (an upturned arc).
  beam: { at: [16, 10], rows: ['....', '.ee.', 'eeee', 'e..e'] },
  // A blue iris round the pupil, the white glint.
  'blue-eyes': { at: [16, 10], rows: ['Wl', 'le', 'le', 'll'] },
};
