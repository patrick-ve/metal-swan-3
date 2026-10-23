/**
 * The road-sign page (WORLD, wave B; `PAGE_IDS.signs` 301; docs/design/rally.md §3, §5, §7.4): our
 * own pixel lettering and symbols in the Dutch road-sign style (never a copied font):
 * - the MATRIX-SIGN faces of every state of the contract (`SIGN_STATES`, signs.ts): limits in a red
 *   ring, a red cross, a green down arrow, merge arrows, the end of the limits, the countdown digits,
 *   the dark face of a blank sign — 32 × 32 texels each, bold strokes that read at speed;
 * - the blue S-exit signs (the code in a white box, the real place names);
 * - the green hectometre boards, the blue average-speed boards, the red A10 shield, the finish
 *   banner, the gantry's steel truss and the flitspaal's cabinet.
 *
 * One CLUT row, a 16-colour bank per texture kind; PAL_HD tones only. Pure; built once.
 */
import type { Color } from '../../../../engine/color';
import type { TexturePage } from '../../../../engine/view3d';
import { SIGN_STATES, type SignState } from '../../../rally/signs';
import { tone, WORLD_PAGES } from '../sections/pages';
import { CLUT_4BIT, PageBuilder, type TexRect } from '../tex/kit';
import { letterWidth, paintText } from '../tex/letters';

/** A matrix face's side (texels). */
export const LED = 32;

/** Our own matrix digits (5 × 9, '#' = lit). */
const DIGITS: Readonly<Record<string, readonly string[]>> = {
  '0': ['.###.', '#...#', '#...#', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '#.#..', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '3': ['.###.', '#...#', '....#', '....#', '..##.', '....#', '....#', '#...#', '.###.'],
  '5': ['#####', '#....', '#....', '####.', '....#', '....#', '....#', '#...#', '.###.'],
  '7': ['#####', '....#', '....#', '...#.', '...#.', '..#..', '..#..', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '#...#', '.###.', '#...#', '#...#', '#...#', '.###.'],
};

/**
 * Fixer (wave B): bold limit digits (7 × 12, the 1 4 wide; strokes 2 texels, holes 3). At 1× a gantry
 * face is 12–24 px on screen: 1-texel strokes dropped out ('100' read as '1k:') and 2-texel holes
 * filled in; these keep their shape from about 25 m. A plain 0 (no slash), as on the road's own
 * matrix signs; the red ring is thinner so the digits get a larger share of the face.
 */
const BOLD: Readonly<Record<string, readonly string[]>> = {
  '0': ['.#####.', '#######', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
  '1': ['..##', '.###', '####', '..##', '..##', '..##', '..##', '..##', '..##', '..##', '..##', '..##'],
  '5': ['#######', '#######', '##.....', '##.....', '######.', '#######', '.....##', '.....##', '.....##', '##...##', '#######', '.#####.'],
  '7': ['#######', '#######', '.....##', '....##.', '....##.', '...##..', '...##..', '..##...', '..##...', '..##...', '.##....', '.##....'],
  '8': ['.#####.', '#######', '##...##', '##...##', '##...##', '.#####.', '.#####.', '##...##', '##...##', '##...##', '#######', '.#####.'],
};
const BOLD_H = 12;

/** Bank layout of the page's one CLUT row. */
const BANK = { led: 0, blue: 1, green: 2, steel: 3, red: 4 } as const;

export interface SignTex {
  readonly page: TexturePage;
  /** The face of every matrix-sign state. */
  readonly faces: Readonly<Record<SignState, TexRect>>;
  /** The blue sign of each S-exit code. */
  readonly exits: ReadonlyMap<string, TexRect>;
  /** The hectometre boards by their text ('12.4'). */
  readonly hecto: ReadonlyMap<string, TexRect>;
  readonly zoneStart: TexRect;
  readonly zoneEnd: TexRect;
  readonly shield: TexRect;
  readonly finish: TexRect;
  readonly truss: TexRect;
  readonly cabinet: TexRect;
  /** Flat swatches: the dark housing, the steel grey. */
  readonly housing: TexRect;
  readonly grey: TexRect;
  /** Every text on the page (tests: no company name). */
  readonly texts: readonly string[];
}

/** The hectometre text at a distance (km with one decimal; our own made-up numbering from 12.0). */
export function hectoText(s: number): string {
  const hm = 120 + Math.floor(s / 100);
  return `${Math.floor(hm / 10)}.${hm % 10}`;
}

let built: SignTex | null = null;
let builtKey = '';

/**
 * Build the page. `exits` are the S-exits (code, name) to letter; `hectos` the hectometre texts.
 * Cached per list (the A10 always gives the same lists; a call without lists reuses any page).
 */
export function signTex(exits: readonly { code: string; name: string }[] = [], hectos: readonly string[] = []): SignTex {
  const key = exits.map((e) => `${e.code}:${e.name}`).join(',') + '|' + hectos.join(',');
  if (built && (key === builtKey || (exits.length === 0 && hectos.length === 0))) return built;
  builtKey = key;
  const pb = new PageBuilder(WORLD_PAGES.signs, 256, 256);
  const banks: Color[][] = [
    // led: the face, its frame, dim LEDs, red, bright red, white, green, bright green, amber, bright amber
    [tone('ink', 0), tone('slate', 1), tone('ink', 1), tone('red', 4), tone('red', 6), tone('gable', 6), tone('green', 4), tone('green', 6), tone('gold', 5), tone('gold', 6)],
    // blue: the sign blue, white, the dark edge
    [tone('denim', 3), tone('gable', 6), tone('denim', 1), tone('denim', 4)],
    // green (hectometre boards)
    [tone('green', 2), tone('gable', 6), tone('green', 1)],
    // steel: the truss members, the dark between, a highlight, the cabinet grey, its lens, orange
    [tone('steel', 4), tone('steel', 2), tone('steel', 5), tone('steel', 3), tone('ink', 0), tone('orange', 4), tone('steel', 6), tone('slate', 2)],
    // red: the A10 shield, white; the finish banner's black and white
    [tone('red', 4), tone('gable', 6), tone('ink', 1), tone('gable', 5)],
  ];
  const row: Color[] = [];
  for (const b of banks) for (let i = 0; i < CLUT_4BIT; i++) row.push(b[i < b.length ? i : 0]);
  pb.addRow(row);
  const at = (bank: number, i: number): number => bank * CLUT_4BIT + i;
  const L = (i: number): number => at(BANK.led, i);
  const texts: string[] = [];

  // Matrix faces.
  const faces = {} as Record<SignState, TexRect>;
  for (const st of SIGN_STATES) {
    const r = pb.alloc(LED, LED)!;
    faces[st] = r;
    paintFace(pb, r, st, L);
  }
  // Blue S-exit signs: the code in a white-edged box, the name below (or a direction).
  const exitRects = new Map<string, TexRect>();
  for (const e of exits) {
    const r = pb.alloc(64, 24)!;
    exitRects.set(e.code, r);
    const B = (i: number): number => at(BANK.blue, i);
    pb.fill(r, B(0));
    for (let u = 0; u < 64; u++) {
      pb.set(r, u, 0, B(1));
      pb.set(r, u, 23, B(1));
    }
    for (let v = 0; v < 24; v++) {
      pb.set(r, 0, v, B(1));
      pb.set(r, 63, v, B(1));
    }
    const cw = letterWidth(e.code) + 4;
    pb.rect(r, 3, 3, cw, 9, B(1));
    pb.rect(r, 4, 4, cw - 2, 7, B(0));
    paintText(pb, r, e.code, 5, 5, B(1));
    // The arrow (up-right: the exit ahead on the right).
    pb.line(r, 52, 10, 58, 4, B(1));
    pb.line(r, 53, 10, 59, 4, B(1));
    pb.rect(r, 55, 4, 5, 1, B(1));
    pb.rect(r, 59, 4, 1, 5, B(1));
    const name = e.name.length > 0 ? e.name : 'CENTRUM';
    texts.push(e.code, name);
    paintText(pb, r, name, Math.max(2, Math.floor((64 - letterWidth(name)) / 2)), 15, B(1));
  }
  // Hectometre boards: white on green.
  const hecto = new Map<string, TexRect>();
  for (const t of hectos) {
    if (hecto.has(t)) continue;
    const r = pb.alloc(18, 9)!;
    hecto.set(t, r);
    pb.fill(r, at(BANK.green, 0));
    paintText(pb, r, t, Math.floor((18 - letterWidth(t)) / 2), 2, at(BANK.green, 1));
  }
  // The average-speed boards (blue): TRAJECT / CONTROLE, and its end.
  const board = (l1: string, l2: string): TexRect => {
    const r = pb.alloc(64, 20)!;
    const B = (i: number): number => at(BANK.blue, i);
    pb.fill(r, B(0));
    for (let u = 0; u < 64; u++) {
      pb.set(r, u, 0, B(1));
      pb.set(r, u, 19, B(1));
    }
    for (let v = 0; v < 20; v++) {
      pb.set(r, 0, v, B(1));
      pb.set(r, 63, v, B(1));
    }
    paintText(pb, r, l1, Math.floor((64 - letterWidth(l1)) / 2), 4, B(1));
    paintText(pb, r, l2, Math.floor((64 - letterWidth(l2)) / 2), 11, B(1));
    texts.push(l1, l2);
    return r;
  };
  const zoneStart = board('TRAJECT', 'CONTROLE');
  const zoneEnd = board('EINDE', 'TRAJECT');
  // The A10 shield (red, white letters).
  const shield = pb.alloc(16, 9)!;
  pb.fill(shield, at(BANK.red, 0));
  paintText(pb, shield, 'A10', 2, 2, at(BANK.red, 1));
  texts.push('A10');
  // The finish banner: a chequer and the word.
  const finish = pb.alloc(64, 12)!;
  for (let v = 0; v < 12; v++) for (let u = 0; u < 64; u++) pb.set(finish, u, v, at(BANK.red, ((u >> 2) + (v >> 2)) % 2 === 0 ? 2 : 3));
  pb.rect(finish, 18, 2, 28, 8, at(BANK.red, 2));
  paintText(pb, finish, 'FINISH', Math.floor((64 - letterWidth('FINISH')) / 2), 3, at(BANK.red, 3));
  texts.push('FINISH');
  // The gantry's truss: two chords and diagonals on the dark between them (a solid face).
  const truss = pb.alloc(32, 16)!;
  const S = (i: number): number => at(BANK.steel, i);
  pb.fill(truss, S(1));
  for (let u = 0; u < 32; u++) {
    pb.set(truss, u, 0, S(2));
    pb.set(truss, u, 1, S(0));
    pb.set(truss, u, 14, S(0));
    pb.set(truss, u, 15, S(3));
    const d = u % 16;
    const v = d < 8 ? 2 + Math.floor((d * 12) / 8) : 2 + Math.floor(((16 - d) * 12) / 8);
    pb.set(truss, u, Math.min(13, v), S(0));
    if (u % 8 === 0) for (let k = 2; k < 14; k++) pb.set(truss, u, k, S(0));
  }
  // The flitspaal's cabinet (its face to the traffic): grey with the dark lens and an orange reflector.
  const cabinet = pb.alloc(16, 24)!;
  pb.fill(cabinet, S(3));
  pb.rect(cabinet, 0, 0, 16, 1, S(6));
  pb.rect(cabinet, 3, 4, 10, 8, S(4));
  pb.rect(cabinet, 5, 6, 4, 4, S(7));
  pb.rect(cabinet, 6, 15, 4, 3, S(5));
  const housing = pb.alloc(4, 4)!;
  pb.fill(housing, S(7));
  const grey = pb.alloc(4, 4)!;
  pb.fill(grey, S(0));
  built = { page: pb.build(), faces, exits: exitRects, hecto, zoneStart, zoneEnd, shield, finish, truss, cabinet, housing, grey, texts };
  return built;
}

/** Paint one matrix state into its 32 × 32 cell (bold strokes, our own symbols). */
function paintFace(pb: PageBuilder, r: TexRect, st: SignState, L: (i: number) => number): void {
  pb.fill(r, L(0));
  for (let i = 0; i < LED; i++) {
    pb.set(r, i, 0, L(1));
    pb.set(r, i, LED - 1, L(1));
    pb.set(r, 0, i, L(1));
    pb.set(r, LED - 1, i, L(1));
  }
  const disc = (cx: number, cy: number, r0: number, r1: number, ink: number): void => {
    for (let y = 0; y < LED; y++) {
      for (let x = 0; x < LED; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= r0 && d <= r1) pb.set(r, x, y, ink);
      }
    }
  };
  const digits = (s: string, scale: number, ink: number): void => {
    const gw = 5 * scale, gap = scale;
    const w = s.length * gw + (s.length - 1) * gap;
    let x = Math.floor((LED - w) / 2);
    const y = Math.floor((LED - 9 * scale) / 2);
    for (const ch of s) {
      const g = DIGITS[ch];
      if (g) for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 5; gx++) if (g[gy][gx] === '#') pb.rect(r, x + gx * scale, y + gy * scale, scale, scale, ink);
      x += gw + gap;
    }
  };
  const bold = (s: string, ink: number): void => {
    const gap = s.length > 2 ? 1 : 2;
    let w = (s.length - 1) * gap;
    for (const ch of s) w += BOLD[ch]?.[0].length ?? 0;
    let x = Math.floor((LED - w) / 2);
    const y = Math.floor((LED - BOLD_H) / 2);
    for (const ch of s) {
      const g = BOLD[ch];
      if (!g) continue;
      for (let gy = 0; gy < BOLD_H; gy++) for (let gx = 0; gx < g[gy].length; gx++) if (g[gy][gx] === '#') pb.set(r, x + gx, y + gy, ink);
      x += g[0].length + gap;
    }
  };
  const thick = (x0: number, y0: number, x1: number, y1: number, w: number, ink: number): void => {
    for (let k = -Math.floor(w / 2); k <= Math.floor((w - 1) / 2); k++) {
      pb.line(r, x0 + k, y0, x1 + k, y1, ink);
    }
  };
  switch (st) {
    case 'blank':
      // A dark face: a faint grid of unlit LEDs (it reads as a sign, not a hole).
      for (let y = 3; y < LED - 2; y += 3) for (let x = 3; x < LED - 2; x += 3) pb.set(r, x, y, L(2));
      break;
    case 'limit-50':
    case 'limit-70':
    case 'limit-80':
    case 'limit-100': {
      disc(16, 16, 13.2, 15.4, L(3));
      const n = st.slice(6);
      // Fixer (wave B): bold digits (2-texel strokes) that read at 1× and in the split views.
      bold(n, L(5));
      break;
    }
    case 'x':
      thick(6, 6, 25, 25, 4, L(3));
      thick(25, 6, 6, 25, 4, L(3));
      thick(7, 6, 25, 24, 2, L(4));
      thick(24, 6, 6, 24, 2, L(4));
      break;
    case 'arrow-down':
    case 'go':
      pb.rect(r, 13, 5, 6, 13, L(6));
      for (let k = 0; k < 10; k++) pb.rect(r, 6 + k, 17 + k, 20 - 2 * k, 1, L(6));
      pb.rect(r, 14, 6, 4, 18, L(7));
      break;
    case 'merge-left':
    case 'merge-right': {
      // A diagonal arrow down to the left (or the right): the shaft and the corner of its head.
      const m = st === 'merge-left';
      const X = (x: number): number => (m ? x : LED - 1 - x);
      thick(X(24), 7, X(10), 21, 3, L(5));
      for (let y = 19; y < 22; y++) for (let x = 7; x < 18; x++) pb.set(r, X(x), y, L(5));
      for (let y = 11; y < 22; y++) for (let x = 7; x < 10; x++) pb.set(r, X(x), y, L(5));
      break;
    }
    case 'end':
      disc(16, 16, 11, 12.6, L(5));
      for (let k = -1; k <= 1; k++) pb.line(r, 9 + k * 3, 23 + k * 3, 23 + k * 3, 9 + k * 3, L(5));
      break;
    case 'count-3':
    case 'count-2':
    case 'count-1':
      digits(st.slice(6), 2, L(9));
      break;
  }
}
