/**
 * Style `gritty` (gritty.ts): the muted ramps. Every HD tone is a `PAL_HD` colour (docs/ART_GUIDE.md
 * §1), picked by lightness and kept low in chroma: dusty brown tweed, olive drab going grey in the
 * dust, worn black leather, weathered skin with cool shadows, a dull brick-red tie. The 1× ramps
 * are the same ramps snapped to the 64-colour `PAL` (`nearest`).
 */
import type { Color } from '../../../../engine/color';
import { hex } from '../../../../engine/color';
import { nearest } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';

const H = (...c: string[]): Ramp => c.map((s) => hex(s));

/** Dark → light, all PAL_HD colours. */
export const GR = {
  /** Dusty brown tweed: neutral deep shades, a warm dusty middle, a grey dust highlight. */
  tweed: H('#1d1218', '#33201b', '#3d3437', '#5b3828', '#6a5240', '#85583c', '#957a58', '#a6998e'),
  /** Olive drab fatigues: wide dark bands, the lit planes a dull olive, dust on top. */
  olive: H('#151a16', '#232a1b', '#232a1b', '#3b4527', '#3b4527', '#3b4527', '#635857', '#8e827a'),
  /** The same cloth under dust (hems, knees): the lights go grey. */
  dust: H('#151a16', '#232a1b', '#3d3437', '#3d3437', '#635857', '#635857', '#8e827a', '#a6998e'),
  /** Worn black leather boots: near-black, warm grey scuffs and sheen. */
  boot: H('#100b14', '#221a28', '#221a28', '#3d3437', '#3d3437', '#635857', '#8e827a'),
  /** Worn brown leather (belt, elbow patches, the button). */
  leather: H('#1d1218', '#33201b', '#33201b', '#5b3828', '#5b3828', '#85583c', '#9a6a48'),
  /** Weathered fair skin: purple-brown shadows, muted warm lights. */
  skin: H('#2a1018', '#5e2e34', '#7a4140', '#9a5c52', '#be8670', '#dc9670', '#f0b08a'),
  /** The heavy stubble over the skin: grey-brown, cool in the shade. */
  stubble: H('#170e14', '#221a28', '#3d3437', '#3d3437', '#5a4a5c', '#635857'),
  /** Short dark-brown hair. */
  hair: H('#100b14', '#1d1218', '#1d1218', '#33201b', '#33201b', '#5b3828', '#85583c'),
  /** A dirty white shirt. */
  shirt: H('#3d3437', '#635857', '#635857', '#8e827a', '#a6998e', '#beb1a2', '#d5c9b8'),
  /** The dull brick-red tie. */
  tie: H('#160b12', '#4a0f1f', '#671527', '#7a2a24', '#9e3c2c', '#bf5a3c'),
  /** Dull brass (buckle). */
  brass: H('#33201b', '#4b2c16', '#6b4218', '#8c5a17', '#aa731d', '#c4a970'),
  /** Blued, worn gunmetal (near-black, a cold sheen on the edges). */
  gunmetal: H('#100b14', '#151925', '#252a3a', '#252a3a', '#3b4457', '#5a677b', '#8694a6', '#c1ccd8'),
  /** Black polymer (grips, stock). */
  polymer: H('#100b14', '#221a28', '#221a28', '#3d3437', '#3d3437', '#635857'),
  /** Olive drab metal (the ammo box). */
  drab: H('#151a16', '#232a1b', '#3b4527', '#3b4527', '#586436', '#6b7740', '#8e827a'),
  /** The cool rim light, dark → light (steel and snow tones). */
  rim: H('#3b4457', '#5a677b', '#728199', '#8694a6', '#a3b0bf', '#c1ccd8'),
  /** Eye whites (never pure white: a dirty, shaded white). */
  eyeWhite: H('#8e827a', '#beb1a2', '#d5c9b8'),
} as const satisfies Record<string, Ramp>;

export type GrRamp = keyof typeof GR;

/**
 * The 1× ramps: hand-picked `PAL` colours for each ramp (a nearest-colour snap would turn the
 * dusty greys into blue steel).
 */
const GR1: Readonly<Record<GrRamp, Ramp>> = {
  tweed: H('#33201b', '#3d3437', '#5b3828', '#85583c', '#9c8052'),
  olive: H('#100b14', '#232a1b', '#3b4527', '#586436'),
  dust: H('#232a1b', '#3d3437', '#635857', '#8e827a'),
  boot: H('#100b14', '#221a28', '#221a28', '#3d3437', '#635857'),
  leather: H('#100b14', '#33201b', '#5b3828', '#85583c'),
  skin: H('#33201b', '#5b3828', '#85583c', '#b07d55', '#dc9670'),
  stubble: H('#100b14', '#221a28', '#3d3437', '#635857'),
  hair: H('#100b14', '#221a28', '#33201b', '#5b3828'),
  shirt: H('#3d3437', '#635857', '#8e827a', '#beb1a2'),
  tie: H('#100b14', '#4a0f1f', '#861a2e', '#a8522e'),
  brass: H('#33201b', '#8c5a17', '#c98c22'),
  gunmetal: H('#100b14', '#252a3a', '#3b4457', '#3b4457', '#5a677b'),
  polymer: H('#100b14', '#221a28', '#3d3437', '#635857'),
  drab: H('#100b14', '#232a1b', '#3b4527', '#586436'),
  rim: H('#3b4457', '#5a677b', '#8694a6'),
  eyeWhite: H('#8e827a', '#beb1a2'),
};
const LO = new Map<Ramp, Ramp>((Object.keys(GR) as GrRamp[]).map((k) => [GR[k], GR1[k]]));

export const INK0: Color = PAL_HD.ink[0];
export const INK1: Color = PAL_HD.ink[1];

const loCache = new Map<Ramp, Ramp>();

/** A ramp for density d: the HD ramp, or at 1× the same ramp snapped to PAL (duplicates dropped). */
export function rampAt(r: Ramp, d: number): Ramp {
  if (d > 1) return r;
  const own = LO.get(r);
  if (own) return own;
  let lo = loCache.get(r);
  if (!lo) {
    const out: Color[] = [];
    for (const c of r) {
      const n = nearest(c);
      if (out[out.length - 1] !== n) out.push(n);
    }
    lo = out;
    loCache.set(r, lo);
  }
  return lo;
}

/** One colour for density d (1× snaps to PAL). */
export function colAt(c: Color, d: number): Color {
  return d > 1 ? c : nearest(c);
}
