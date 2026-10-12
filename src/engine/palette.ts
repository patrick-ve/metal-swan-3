import type { Color } from './color';
import { chB, chG, chR, hex } from './color';
import type { Ramp } from './pixel';

export type { Ramp };

/**
 * The ONE project palette (docs/ARCHITECTURE.md §5.3): 64 unique colours arranged in named
 * ramps, dark → light. All art uses these ramps so that work from many agents looks cohesive.
 *
 * Style: warm late-90s arcade military. Shadows lean cool (purple / blue), highlights lean
 * warm (yellow), saturation peaks in the mid-tones. Neighbouring ramps share colours (skin ↔
 * leather ↔ rust, fire ↔ red/orange/gold, teal ↔ foliage) so materials blend naturally.
 *
 * `npm run sprites -- --palette` writes tmp/sprites/palette.png with every ramp.
 */
/** Unique swatches, in display order. Names are `<home ramp><index>`. */
const S = {
  ink0: hex('#100b14'),
  ink1: hex('#221a28'),

  steel0: hex('#252a3a'),
  steel1: hex('#3b4457'),
  steel2: hex('#5a677b'),
  steel3: hex('#8694a6'),
  steel4: hex('#c1ccd8'),

  stone0: hex('#3d3437'),
  stone1: hex('#635857'),
  stone2: hex('#8e827a'),
  stone3: hex('#beb1a2'),

  olive0: hex('#232a1b'),
  olive1: hex('#3b4527'),
  olive2: hex('#586436'),
  olive3: hex('#7e8a4b'),

  sand0: hex('#6f5636'),
  sand1: hex('#9c8052'),
  sand2: hex('#c4a970'),
  sand3: hex('#e8d6a2'),

  brown0: hex('#33201b'),
  brown1: hex('#5b3828'),
  brown2: hex('#85583c'),
  brown3: hex('#b07d55'),

  rust0: hex('#6d2b18'),
  rust1: hex('#a8522e'),

  red0: hex('#4a0f1f'),
  red1: hex('#861a2e'),
  red2: hex('#c62f30'),
  red3: hex('#f06045'),

  orange0: hex('#e3721e'),
  orange1: hex('#ff9f31'),

  gold0: hex('#8c5a17'),
  gold1: hex('#c98c22'),
  gold2: hex('#f6c537'),
  gold3: hex('#fff184'),

  white: hex('#ffffff'),

  green0: hex('#1b4529'),
  green1: hex('#2f6d2f'),
  green2: hex('#529a38'),
  green3: hex('#93c94f'),

  teal0: hex('#0f3f40'),
  teal1: hex('#1c7a70'),
  teal2: hex('#42b9a1'),

  sky0: hex('#2b5ea6'),
  sky1: hex('#4a8fd4'),
  sky2: hex('#81bded'),
  sky3: hex('#c3e5f9'),

  navy0: hex('#111735'),
  navy1: hex('#1e2b5c'),

  purple0: hex('#371d52'),
  purple1: hex('#613887'),
  purple2: hex('#9467bd'),

  pink0: hex('#8c2161'),
  pink1: hex('#d4448d'),
  pink2: hex('#f78dbf'),

  snow0: hex('#c9dbea'),
  snow1: hex('#eaf3fa'),

  skinA1: hex('#dc9670'),
  skinA2: hex('#f6c39e'),
  skinA3: hex('#ffe4cc'),

  skinB2: hex('#d9a36e'),
  skinB3: hex('#f2c995'),

  hairA2: hex('#3d2e3c'),

  cyan: hex('#5cecff'),
} as const;

/** Named ramps, dark → light. Index with PAL.steel[2], or use shade('steel', 2) to clamp. */
export const PAL = {
  /** Outlines and deepest shadows. */
  ink: [S.ink0, S.ink1],
  /** Gunmetal, armour, machinery (cool). */
  steel: [S.steel0, S.steel1, S.steel2, S.steel3, S.steel4],
  /** Warm grey: concrete, stone, ruins, worn machinery. */
  stone: [S.stone0, S.stone1, S.stone2, S.stone3],
  /** Olive drab: uniforms, tanks, crates. */
  olive: [S.olive0, S.olive1, S.olive2, S.olive3],
  /** Khaki / desert sand. */
  sand: [S.sand0, S.sand1, S.sand2, S.sand3],
  /** Leather, wood, dark earth (also deep skin). */
  brown: [S.brown0, S.brown1, S.brown2, S.brown3],
  /** Rusted metal. */
  rust: [S.brown0, S.rust0, S.rust1, S.orange0],
  red: [S.red0, S.red1, S.red2, S.red3],
  orange: [S.rust1, S.orange0, S.orange1, S.gold2],
  /** Yellow / gold: coins, medals, muzzle flashes. */
  gold: [S.gold0, S.gold1, S.gold2, S.gold3],
  /** Explosions and flames: deep red → white-hot. */
  fire: [S.red1, S.red2, S.orange0, S.orange1, S.gold2, S.gold3, S.white],
  /** Foliage, jungle, grass (deepest shade leans teal). */
  green: [S.teal0, S.green0, S.green1, S.green2, S.green3],
  teal: [S.teal0, S.teal1, S.teal2, S.cyan],
  sky: [S.sky0, S.sky1, S.sky2, S.sky3],
  /** Night skies, deep water, shadows of blue things. */
  navy: [S.navy0, S.navy1, S.sky0],
  purple: [S.purple0, S.purple1, S.purple2],
  /** Pink / magenta accents, energy weapons. */
  pink: [S.pink0, S.pink1, S.pink2],
  /** Snow and ice (ends in pure white). */
  snow: [S.steel3, S.snow0, S.snow1, S.white],
  /** Fair skin. */
  skinA: [S.rust1, S.skinA1, S.skinA2, S.skinA3],
  /** Tan skin. */
  skinB: [S.brown2, S.brown3, S.skinB2, S.skinB3],
  /** Deep skin. */
  skinC: [S.brown0, S.brown1, S.brown2, S.brown3],
  /** Black hair. */
  hairA: [S.ink0, S.ink1, S.hairA2],
  /** Brown hair. */
  hairB: [S.brown0, S.brown1, S.brown2],
  /** Blond hair. */
  hairC: [S.gold0, S.gold1, S.gold2],
  /** UI accents: panels, selection glow, highlights. */
  ui: [S.navy1, S.sky1, S.cyan, S.white],
  /** Black leather and cloth: boots, gloves, belts, hats (lighter than the outline). Art agent. */
  black: [S.ink0, S.ink1, S.hairA2, S.steel1],
  /** Warm white cloth: trousers, aprons, flags (shadows lean warm grey). Art agent. */
  cloth: [S.stone2, S.stone3, S.snow1, S.white],
  /** Slate blue-grey cloth: greatcoats, overalls. Art agent. */
  slate: [S.navy0, S.steel1, S.steel2, S.steel3],
  /** Brass and bronze: buttons, instruments, shell casings. Art agent. */
  brass: [S.gold0, S.gold1, S.gold2, S.gold3],
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof PAL;

/** Friendlier names accepted by ramp(). */
const ALIASES: Readonly<Record<string, RampName>> = {
  outline: 'ink',
  gunmetal: 'steel',
  metal: 'steel',
  grey: 'stone',
  gray: 'stone',
  warmGrey: 'stone',
  concrete: 'stone',
  khaki: 'sand',
  leather: 'brown',
  wood: 'brown',
  yellow: 'gold',
  foliage: 'green',
  magenta: 'pink',
  ice: 'snow',
  skin: 'skinA',
};

/** Outline colour used by most art. */
export const INK: Color = S.ink0;

export interface Swatch {
  readonly name: string;
  readonly color: Color;
}

/** Every unique palette colour with its name, in display order. */
export const SWATCHES: readonly Swatch[] = Object.entries(S).map(([name, color]) => ({ name, color }));

/** Flat list of the unique palette colours. */
export const PALETTE: readonly Color[] = SWATCHES.map((s) => s.color);

export const RAMP_NAMES: readonly RampName[] = Object.keys(PAL) as RampName[];

const warnedRamps = new Set<string>();

/** Ramp by name (aliases such as 'khaki', 'leather', 'foliage' work). Unknown → steel + warn. */
export function ramp(name: string): Ramp {
  const direct = (PAL as Record<string, Ramp>)[name];
  if (direct) return direct;
  const alias = ALIASES[name];
  if (alias) return PAL[alias];
  if (!warnedRamps.has(name)) {
    warnedRamps.add(name);
    console.warn(`[palette] unknown ramp "${name}" — using steel`);
  }
  return PAL.steel;
}

/** Colour i of a ramp; i is rounded and clamped to the ramp. */
export function shade(r: Ramp | string, i: number): Color {
  const rr = typeof r === 'string' ? ramp(r) : r;
  const k = Math.round(i);
  return rr[k < 0 ? 0 : k >= rr.length ? rr.length - 1 : k];
}

/** Home ramp of each colour: the first ramp listing it, in PAL order. */
const home = new Map<Color, { r: Ramp; i: number }>();
for (const name of RAMP_NAMES) {
  PAL[name].forEach((c, i) => {
    if (!home.has(c)) home.set(c, { r: PAL[name], i });
  });
}

/**
 * Move a palette colour `delta` steps along its home ramp (+ lighter, − darker), clamped.
 * Colours outside the palette are returned unchanged.
 */
export function stepShade(c: Color, delta: number): Color {
  const h = home.get(c >>> 0);
  return h ? shade(h.r, h.i + delta) : c;
}

/** True when `c` (ignoring alpha) is one of the palette colours. */
export function inPalette(c: Color): boolean {
  return home.has(((c | 255) >>> 0));
}

/** Nearest palette colour (weighted RGB distance); keeps the alpha of `c`. */
export function nearest(c: Color): Color {
  let best = PALETTE[0];
  let bestD = Infinity;
  const r = chR(c);
  const g = chG(c);
  const b = chB(c);
  for (const p of PALETTE) {
    const dr = chR(p) - r;
    const dg = chG(p) - g;
    const db = chB(p) - b;
    // "Redmean"-style weights: cheap and closer to perception than plain RGB.
    const rm = (chR(p) + r) / 2;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return ((best & 0xffffff00) | (c & 255)) >>> 0;
}
