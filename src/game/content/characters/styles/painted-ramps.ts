/**
 * Art-direction trial `painted` (painted.ts): the colour script. Each material is a painted ramp
 * of PAL_HD colours, dark → light, whose darks lean cool (blue-violet, wine, slate) and whose
 * lights lean warm (peach, honey, cream), and its warm ground-bounce twin (the shadow tones a
 * warm floor lights up from below). Only PAL_HD colours (the 2× / 4× palette rule).
 */
import type { Color } from '../../../../engine/color';
import { hex } from '../../../../engine/color';
import type { Ramp } from '../../../../engine/pixel';
import { PAL } from '../../../../engine/palette';
import { PAL_HD, hdRampOf } from '../../../../engine/palette-hd';

const H = (...c: string[]): Color[] => c.map((s) => hex(s));

export interface PaintRamp {
  /** Dark (cool) → light (warm). */
  readonly pr: readonly Color[];
  /** The ground-bounce twin (same length). */
  readonly warm: readonly Color[];
}

export const RAMPS = {
  /** Brown tweed: violet-grey and wine in the shade, honey on the lit side. */
  tweed: {
    pr: H('#1d1218', '#3d2e3c', '#5e2e34', '#7a4140', '#85583c', '#9a6a48', '#b07d55', '#c69568'),
    warm: H('#33201b', '#5b3828', '#5b3828', '#85583c', '#9a6a48', '#9a6a48', '#b07d55', '#c69568'),
  },
  /** Olive fatigues: slate-blue shade, sun-bleached olive light. */
  olive: {
    pr: H('#151925', '#252a3a', '#3b4527', '#586436', '#6b7740', '#7e8a4b', '#a9b06a'),
    warm: H('#232a1b', '#3b4527', '#564231', '#6f5636', '#6b7740', '#7e8a4b', '#a9b06a'),
  },
  /** Fair skin: rose-violet shade, peach light. */
  skin: {
    pr: H('#43202a', '#7a4140', '#9a5c52', '#be8670', '#dc9670', '#f6c39e', '#ffe4cc'),
    warm: H('#7a4140', '#9a5c52', '#c2744f', '#be8670', '#dc9670', '#f6c39e', '#ffe4cc'),
  },
  /** The ear: the skin warmer and redder (light through it). */
  ear: {
    pr: H('#4e2128', '#7a4140', '#a8522e', '#c2744f', '#dc9670', '#f6c39e', '#ffe4cc'),
    warm: H('#6d2b18', '#a8522e', '#c2744f', '#c2744f', '#dc9670', '#f6c39e', '#ffe4cc'),
  },
  /** Skin under heavy dark stubble: a glaze, the skin's ramp greyed and a step and a half down. */
  stubble: {
    pr: H('#221a28', '#3d2e3c', '#5e2e34', '#5a4a5c', '#7a4140', '#8e827a', '#be8670'),
    warm: H('#33201b', '#5b3828', '#5e2e34', '#7a4140', '#7a4140', '#9a5c52', '#be8670'),
  },
  /** Dark-brown hair: ink-violet shade, a warm chestnut sheen. */
  hair: {
    pr: H('#100b14', '#221a28', '#33201b', '#5b3828', '#85583c', '#a8764e'),
    warm: H('#1d1218', '#33201b', '#5b3828', '#5b3828', '#85583c', '#a8764e'),
  },
  /** Black leather (boots, belt): cool steel sheen. */
  leather: {
    pr: H('#100b14', '#221a28', '#252a3a', '#3b4457', '#4c576b', '#5e6a80', '#8792a6'),
    warm: H('#1d1218', '#33201b', '#3d2e3c', '#3b4457', '#4c576b', '#5e6a80', '#8792a6'),
  },
  /** The dark-red tie. */
  tie: {
    pr: H('#2a0a1c', '#4a0f1f', '#671527', '#861a2e', '#a52430', '#c62f30', '#f06045'),
    warm: H('#4a0f1f', '#671527', '#861a2e', '#a52430', '#a52430', '#c62f30', '#f06045'),
  },
  /** The white shirt: cool grey shade, cream light. */
  shirt: {
    pr: H('#4f566e', '#7e889c', '#aab4c2', '#d0d6dc', '#ecefee', '#fffdf6'),
    warm: H('#635857', '#8e827a', '#beb1a2', '#d0d6dc', '#ecefee', '#fffdf6'),
  },
  /** Brass (buckle). */
  brass: {
    pr: H('#4b2c16', '#6b4218', '#8c5a17', '#aa731d', '#c98c22', '#f6c537', '#fff184'),
    warm: H('#4b2c16', '#6b4218', '#8c5a17', '#aa731d', '#c98c22', '#f6c537', '#fff184'),
  },
} as const satisfies Record<string, PaintRamp>;

/** A painted ramp for any style ramp (the materials Vincent does not name): its HD ramp. */
export function rampFor(r: Ramp): PaintRamp {
  if (r === PAL.brown) return RAMPS.tweed;
  if (r === PAL.olive) return RAMPS.olive;
  if (r === PAL.skinA) return RAMPS.skin;
  if (r === PAL.black) return RAMPS.leather;
  if (r === PAL.red) return RAMPS.tie;
  if (r === PAL.snow) return RAMPS.shirt;
  const hd = hdRampOf(r);
  if (hd === PAL_HD.black) return RAMPS.leather;
  return { pr: hd, warm: hd };
}
