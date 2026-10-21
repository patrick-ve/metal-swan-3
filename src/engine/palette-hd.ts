import type { Color } from './color';
import { hex } from './color';
import { PAL, type RampName } from './palette';
import type { Ramp } from './pixel';

/**
 * The HD palette (UHD wave, docs/ART_GUIDE.md  "UHD art"): 209 colours in 36 named ramps of
 * 6–8 tones, dark → light, for ALL 2× and 4× art. The 1× art keeps the 64-colour `PAL`.
 *
 * Style (the 64 palette's own statement, stretched): shadows lean cool (purple / blue), highlights
 * lean warm (yellow / cream), saturation peaks in the mid-tones. Every 64-palette swatch appears
 * here at a sensible place in the ramp of its material (`hdRampOf` maps each `PAL` ramp to its HD
 * ramp); the extra tones were made by Oklab interpolation between those swatches plus a designed
 * cool deep shade and a warm near-white highlight per ramp. Neighbouring ramps share tones (skin ↔
 * leather ↔ rust, fire ↔ red / orange / gold, teal ↔ foliage), so materials blend.
 *
 * Amsterdam additions: `brick` (red brick), `brickDark` (the deep purple-brown brick of the old
 * canal houses), `canal` (green canal water), `plaster` (cream / ochre façades), `gable` (white
 * trim, cornices, window frames; cool shade), `glass` (dark window glass), `denim`, `wood` (warm
 * painted / oiled wood: doors, frames, bikes' crates), `moss` (green growth near water).
 *
 * `npm run uhd-spike -- --palette` writes tmp/uhd-style/palette-hd.png.
 */
const H = (...c: string[]): Ramp => c.map((s) => hex(s));

export const PAL_HD = {
  /** Outlines and the deepest shadow (the same two inks as PAL.ink). */
  ink: H('#100b14', '#221a28'),
  /** Gunmetal, armour, machinery (cool), up to a warm near-white specular. */
  steel: H('#151925', '#252a3a', '#3b4457', '#5a677b', '#8694a6', '#a3b0bf', '#c1ccd8', '#f1f3ee'),
  /** Warm grey: concrete, stone, cobbles, kerbs. */
  stone: H('#211b25', '#3d3437', '#635857', '#8e827a', '#a6998e', '#beb1a2', '#d5c9b8', '#ece2cf'),
  /** Olive drab: uniforms, vests, crates. */
  olive: H('#151a16', '#232a1b', '#3b4527', '#586436', '#6b7740', '#7e8a4b', '#a9b06a', '#d6d696'),
  /** Khaki / sand. */
  sand: H('#3e2e2a', '#564231', '#6f5636', '#856b44', '#9c8052', '#c4a970', '#e8d6a2', '#fff4cf'),
  /** Leather, dark wood, earth. */
  brown: H('#1d1218', '#33201b', '#5b3828', '#85583c', '#9a6a48', '#b07d55', '#c69568', '#dcae7c'),
  /** Rusted metal. */
  rust: H('#33201b', '#6d2b18', '#8a3e23', '#a8522e', '#c56229', '#e3721e', '#f7a65a'),
  red: H('#2a0a1c', '#4a0f1f', '#671527', '#861a2e', '#a52430', '#c62f30', '#f06045', '#ffa07a'),
  orange: H('#5e1f1c', '#823825', '#a8522e', '#e3721e', '#ff9f31', '#f6c537', '#fff0b8'),
  /** Yellow / gold / brass. */
  gold: H('#4b2c16', '#6b4218', '#8c5a17', '#aa731d', '#c98c22', '#f6c537', '#fff184', '#fffbe0'),
  /** Explosions and flames: deep ember → white-hot (tones shared with red, orange, gold). */
  fire: H('#4a0f1f', '#861a2e', '#c62f30', '#e3721e', '#ff9f31', '#f6c537', '#fff184', '#ffffff'),
  /** Foliage and grass (the deepest shade leans teal). */
  green: H('#0a2427', '#0f3f40', '#1b4529', '#2f6d2f', '#529a38', '#73b143', '#93c94f', '#d4ec8a'),
  teal: H('#08222a', '#0f3f40', '#1c7a70', '#2f9988', '#42b9a1', '#5cecff', '#c9fff6'),
  sky: H('#1c3a7a', '#2b5ea6', '#3a76bd', '#4a8fd4', '#66a6e1', '#81bded', '#c3e5f9', '#f2fbff'),
  /** Night skies, deep water, shadows of blue things. */
  navy: H('#090c1f', '#111735', '#172148', '#1e2b5c', '#254480', '#2b5ea6'),
  purple: H('#1d1030', '#371d52', '#613887', '#7a4fa2', '#9467bd', '#ae85d2', '#c9a3e6'),
  pink: H('#4a1036', '#8c2161', '#af3277', '#d4448d', '#e66aa6', '#f78dbf', '#ffd0e2'),
  /** Snow, ice, white plumage (cool shade, pure white top). */
  snow: H('#5f6f8c', '#728199', '#8694a6', '#a7b7c7', '#c9dbea', '#eaf3fa', '#ffffff'),
  /** Fair skin. */
  skinA: H('#4e2128', '#6d2b18', '#a8522e', '#c2744f', '#dc9670', '#f6c39e', '#ffe4cc', '#fff4e6'),
  /** Tan skin. */
  skinB: H('#3b211f', '#5b3828', '#85583c', '#9a6a48', '#b07d55', '#d9a36e', '#f2c995', '#fde6bf'),
  /** Deep skin. */
  skinC: H('#170e14', '#33201b', '#5b3828', '#85583c', '#9a6a48', '#b07d55', '#cf9b6c', '#e8bd8c'),
  /** Black hair. */
  hairA: H('#100b14', '#221a28', '#3d2e3c', '#5a4a5c', '#6b5b6e', '#7d6d80'),
  /** Brown hair. */
  hairB: H('#1d1218', '#33201b', '#5b3828', '#85583c', '#a8764e', '#c99a68'),
  /** Blond hair. */
  hairC: H('#5a3a14', '#8c5a17', '#aa731d', '#c98c22', '#f6c537', '#ffe08a', '#fff6c8'),
  /** Black leather and cloth: boots, gloves, belts (lighter than the outline, cool sheen). */
  black: H('#100b14', '#221a28', '#3d2e3c', '#3b4457', '#4c576b', '#5e6a80', '#8792a6'),
  /** Warm white cloth: trousers, aprons, flags. */
  cloth: H('#5c5258', '#635857', '#8e827a', '#beb1a2', '#d4d2cd', '#eaf3fa', '#ffffff'),
  /** Slate blue-grey cloth: greatcoats, overalls, slate roofs. */
  slate: H('#0a0e22', '#111735', '#252d46', '#3b4457', '#5a677b', '#8694a6', '#b4c3d6'),
  /** Amsterdam red brick. */
  brick: H('#2a1018', '#4f1a1e', '#7a2a24', '#9e3c2c', '#bf5a3c', '#d8805a', '#e49872', '#f0b08a'),
  /** The deep purple-brown brick of the old canal houses. */
  brickDark: H('#160b12', '#2c1520', '#43202a', '#5e2e34', '#7a4140', '#9a5c52', '#be8670'),
  /** Green canal water (deep → foam). */
  canal: H('#06171a', '#0c2a2b', '#15403a', '#235a48', '#3a7558', '#5e9468', '#93b986', '#d1e2b0'),
  /** Cream / ochre plaster façades. */
  plaster: H('#3a2a2a', '#6a5240', '#957a58', '#bba070', '#d8c08c', '#eedcaa', '#fff6d8'),
  /** White gable trim, cornices, window frames (cool shade, warm top). */
  gable: H('#2a2c40', '#4f566e', '#7e889c', '#aab4c2', '#d0d6dc', '#ecefee', '#fffdf6'),
  /** Dark window glass (reflections reach the light end). */
  glass: H('#070b1a', '#10203a', '#1d3a5a', '#33607e', '#5f93a8', '#b9e0e6'),
  /** Blue denim / work cloth. */
  denim: H('#0d1230', '#1a2650', '#2c3f78', '#40599a', '#5f7cb8', '#8ea6d2', '#c6d4ec'),
  /** Warm oiled / painted wood: doors, frames, planks, crates. */
  wood: H('#1f1010', '#3d1f14', '#5f3219', '#82481f', '#a5622a', '#c4823c', '#dca45a', '#f0c884'),
  /** Moss and algae near water. */
  moss: H('#0f1a10', '#1f2f16', '#34481e', '#506427', '#748238', '#9ca356'),
} as const satisfies Record<string, Ramp>;

export type HdRampName = keyof typeof PAL_HD;
export const HD_RAMP_NAMES: readonly HdRampName[] = Object.keys(PAL_HD) as HdRampName[];

/** Every unique HD colour, in ramp order (first appearance). */
export const HD_PALETTE: readonly Color[] = (() => {
  const seen = new Set<Color>();
  const out: Color[] = [];
  for (const n of HD_RAMP_NAMES) {
    for (const c of PAL_HD[n]) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  return out;
})();

/** The HD ramp of each 64-palette ramp (by name). */
const HD_OF: Readonly<Record<RampName, HdRampName>> = {
  ink: 'ink',
  steel: 'steel',
  stone: 'stone',
  olive: 'olive',
  sand: 'sand',
  brown: 'brown',
  rust: 'rust',
  red: 'red',
  orange: 'orange',
  gold: 'gold',
  fire: 'fire',
  green: 'green',
  teal: 'teal',
  sky: 'sky',
  navy: 'navy',
  purple: 'purple',
  pink: 'pink',
  snow: 'snow',
  skinA: 'skinA',
  skinB: 'skinB',
  skinC: 'skinC',
  hairA: 'hairA',
  hairB: 'hairB',
  hairC: 'hairC',
  ui: 'sky',
  black: 'black',
  cloth: 'cloth',
  slate: 'slate',
  brass: 'gold',
};

const byArray = new Map<Ramp, Ramp>();
for (const k of Object.keys(HD_OF) as RampName[]) byArray.set(PAL[k], PAL_HD[HD_OF[k]]);

const hdCustom = new Map<Ramp, Ramp>();

/**
 * The HD ramp for a 64-palette ramp (a `PAL` ramp, its name, or an HD ramp name). A custom ramp
 * built from `PAL` colours (e.g. a portrait skin ramp) maps to the HD ramp holding most of its
 * colours. Unknown → steel.
 */
export function hdRampOf(r: Ramp | RampName | HdRampName): Ramp {
  if (typeof r === 'string') {
    const hd = (PAL_HD as Record<string, Ramp>)[r];
    if (hd) return hd;
    const m = (HD_OF as Record<string, HdRampName>)[r];
    return m ? PAL_HD[m] : PAL_HD.steel;
  }
  const direct = byArray.get(r);
  if (direct) return direct;
  const hit = hdCustom.get(r);
  if (hit) return hit;
  let best: Ramp = PAL_HD.steel;
  let bestN = 0;
  for (const n of HD_RAMP_NAMES) {
    const hd = PAL_HD[n];
    let k = 0;
    for (const c of r) if (hd.includes(c)) k++;
    if (k > bestN) {
      bestN = k;
      best = hd;
    }
  }
  hdCustom.set(r, best);
  return best;
}

/** HD tone at a fraction t (0 = darkest, 1 = lightest) of a ramp; rounded and clamped. */
export function hdTone(r: Ramp | HdRampName, t: number): Color {
  const rr = typeof r === 'string' ? PAL_HD[r] : r;
  const i = Math.round((t < 0 ? 0 : t > 1 ? 1 : t) * (rr.length - 1));
  return rr[i];
}

/**
 * True when `c` (ignoring alpha) is an HD palette colour: a `PAL_HD` colour or (additive, the
 * oldenzaal wave) a `PAL_HD_OZ` colour. Only art checks call it; no drawer depends on it.
 */
export function inHdPalette(c: Color): boolean {
  const key = (c | 255) >>> 0;
  return HD_SET.has(key) || HD_OZ_SET.has(key) || HD_OZ_R2_SET.has(key);
}
const HD_SET = new Set<Color>(HD_PALETTE);

const homeCache = new Map<Color, { ramp: Ramp; i: number } | null>();

/**
 * The HD home of a 64-palette colour: the HD ramp of the first `PAL` ramp listing it (in PAL
 * order) and the colour's index there, or the first HD ramp holding it. null for a colour outside
 * both palettes.
 */
export function hdHome(c: Color): { ramp: Ramp; i: number } | null {
  const key = (c | 255) >>> 0;
  const hit = homeCache.get(key);
  if (hit !== undefined) return hit;
  let res: { ramp: Ramp; i: number } | null = null;
  for (const k of Object.keys(HD_OF) as RampName[]) {
    if (!PAL[k].includes(key)) continue;
    const hd = PAL_HD[HD_OF[k]];
    const i = hd.indexOf(key);
    if (i >= 0) {
      res = { ramp: hd, i };
      break;
    }
  }
  if (!res) {
    for (const n of HD_RAMP_NAMES) {
      const i = PAL_HD[n].indexOf(key);
      if (i >= 0) {
        res = { ramp: PAL_HD[n], i };
        break;
      }
    }
  }
  homeCache.set(key, res);
  return res;
}

// ---------------------------------------------------------------------------------------------
// Oldenzaal ramps (mission `oldenzaal`, docs/design/oldenzaal.md §10.4; docs/api/oldenzaal.md)
// ---------------------------------------------------------------------------------------------

/**
 * The HD ramps of the haunted town (2026-10-21), dark → light, 37 new colours (PAL_HD 209 + 37 =
 * 246 of 256). ADDITIVE and kept APART from `PAL_HD` on purpose: `HD_PALETTE` (and so every
 * nearest-colour search over it: the particles' HD tones, the fps effects, the ams / ring backdrop
 * quantiser `nearestLab`) stays the 209 UHD-wave colours, so no existing sprite, layer or effect
 * changes a pixel. None of these colours is a `PAL` or `PAL_HD` colour, so `hdRampOf`, `hdHome` and
 * the font's text ramps never pick them either.
 *
 * Use them by name (`PAL_HD_OZ.sandstone`, `hdTone(PAL_HD_OZ.ghost, 0.8)`); a quantiser for the
 * oldenzaal art searches `HD_FULL_PALETTE` (PAL_HD + PAL_HD_OZ). At 1× they snap to the 64-colour
 * `PAL` like every HD ramp.
 */
export const PAL_HD_OZ = {
  /** Bentheimer sandstone: the basilica's weathered grey-brown (dark streaks → sunlit block). */
  sandstone: H('#1a1517', '#2f2725', '#473b33', '#605246', '#7a6b5a', '#938570', '#ada088', '#cfc4ab'),
  /** The dusk sky: deep violet → purple-red → the low red-orange sun's glow (oz-a, oz-b). */
  dusk: H('#1b0f25', '#2f1535', '#4b1d43', '#6b2549', '#8f3249', '#b54a47', '#d9714f', '#f3a167'),
  /** Ghost green: the souls, Mevrouw Winkel, the possessed eyes (cold mist → pale glow). */
  ghost: H('#0b1f1b', '#123a2f', '#1d5a43', '#2e7d57', '#4ea873', '#85d399', '#c7f5ce'),
  /** Candle amber: lamps, candles, De Smulhoek's windows (the only warm light in town). */
  candle: H('#3b1d0d', '#5f3011', '#8b4b15', '#b96b1b', '#e19529', '#f8c055', '#ffe7a9'),
  /** Cold night blue: the night sky, the moonlit stone, the storm (desaturated, greyer than navy). */
  night: H('#060915', '#0c1327', '#15203c', '#213151', '#32486a', '#4c6687', '#748fac'),
} as const satisfies Record<string, Ramp>;

export type HdOzRampName = keyof typeof PAL_HD_OZ;
export const HD_OZ_RAMP_NAMES: readonly HdOzRampName[] = Object.keys(PAL_HD_OZ) as HdOzRampName[];

/** Every PAL_HD_OZ colour, in ramp order. */
export const HD_OZ_PALETTE: readonly Color[] = HD_OZ_RAMP_NAMES.flatMap((n) => [...PAL_HD_OZ[n]]);
const HD_OZ_SET = new Set<Color>(HD_OZ_PALETTE);

/** PAL_HD then PAL_HD_OZ (≤ 256 colours): the palette of the oldenzaal 2× / 4× art. */
export const HD_FULL_PALETTE: readonly Color[] = [...HD_PALETTE, ...HD_OZ_PALETTE.filter((c) => !HD_SET.has(c))];

// ---------------------------------------------------------------------------------------------
// Oldenzaal revision 2 ramps (the dead soldiers and the ruined town, docs/design/oldenzaal.md §10.4)
// ---------------------------------------------------------------------------------------------

/**
 * The revision-2 HD ramps (2026-10-21, wave B), dark → light, 6–8 tones, strictly rising luma.
 * ADDITIVE, like `PAL_HD_OZ`, and kept apart from it and from `PAL_HD` on purpose: `HD_PALETTE`,
 * `HD_OZ_PALETTE` and `HD_FULL_PALETTE` stay exactly as they were, so no nearest-colour search (the
 * particles, the fps effects, `nearestLab`, the wave-A oldenzaal art's `mx` snap) picks a new
 * colour and no existing pixel changes.
 *
 * Only 9 colours are new (`HD_OZ_R2_NEW`); the other tones are existing `PAL_HD` colours, so the
 * whole set stays inside 256 (PAL_HD 209 + PAL_HD_OZ 37 + 9 = 255; `HD_R2_FULL_PALETTE`). Use the
 * ramps by name (`PAL_HD_OZ_R2.rot`, `hdTone(PAL_HD_OZ_R2.fieldGrey, 0.6)`); `inHdPalette`
 * accepts the new colours. At 1× everything snaps to the 64-colour `PAL` as usual.
 */
export const PAL_HD_OZ_R2 = {
  /** Rotting skin: a cool olive-black shade → grey-green → yellowed → pale bone at the top. */
  rot: H('#151a16', '#232a1b', '#343c2b', '#465039', '#626b4e', '#80845f', '#a3a079', '#d5c9b8'),
  /** Field grey: faded WW2 wool (green-grey), cool in the shade, a dusty warm grey on the light side. */
  fieldGrey: H('#151925', '#252a3a', '#3c473f', '#566258', '#727d70', '#8e927f', '#beb1a2'),
  /** Rust: rusted iron (rifles, the MG, helmets, railings, cars): `PAL_HD.rust`, by name here. */
  rust: PAL_HD.rust,
  /** Soot / burnt: the burned-out car, scorched walls, charred wood → ash grey. */
  soot: H('#100b14', '#221a28', '#2f2725', '#3d3437', '#635857', '#8e827a'),
} as const satisfies Record<string, Ramp>;

export type HdOzR2RampName = keyof typeof PAL_HD_OZ_R2;
export const HD_OZ_R2_RAMP_NAMES: readonly HdOzR2RampName[] = Object.keys(PAL_HD_OZ_R2) as HdOzR2RampName[];

/** The colours revision 2 adds (in no earlier palette). */
export const HD_OZ_R2_NEW: readonly Color[] = (() => {
  const seen = new Set<Color>([...HD_PALETTE, ...HD_OZ_PALETTE]);
  const out: Color[] = [];
  for (const n of HD_OZ_R2_RAMP_NAMES) {
    for (const c of PAL_HD_OZ_R2[n]) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  }
  return out;
})();
const HD_OZ_R2_SET = new Set<Color>(HD_OZ_R2_NEW);

/** `HD_FULL_PALETTE` then the revision-2 colours (≤ 256): every colour the oldenzaal 2× / 4× art may use. */
export const HD_R2_FULL_PALETTE: readonly Color[] = [...HD_FULL_PALETTE, ...HD_OZ_R2_NEW];
