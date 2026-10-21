/**
 * The ghost draw of mission `oldenzaal` (docs/design/oldenzaal.md §6, §10.2; docs/api/oldenzaal.md
 * "Ghost draw"): Mevrouw Winkel draws with `drawGhost` (revision 2: she is the only ghost; wave A's
 * souls are gone), and the TO BE CONTINUED face shares its look:
 *
 * 1. the body at alpha ~0.5 (see-through; normal blend),
 * 2. an ADDITIVE tint pass: the same frame as a solid silhouette of the ghost green
 *    (`DrawOpts.tint` + `blend: 'add'`) at a low alpha: the cold glow inside the shape,
 * 3. an optional GLOW sprite (additive, centred on the body; e.g. LIGHT's `fx/oz/light/glow`),
 *    drawn only when it is defined.
 *
 * A shimmer (alpha breathing) comes from `opts.t` (a tick, cosmetic). One reused DrawOpts per
 * pass: no allocation per call. Works at every art density (the renderer picks the frame's
 * density; the passes are the same). The colours default to PAL_HD_OZ.ghost tones.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { hasSprite } from '../../../../engine/sprites';

/** The default ghost colours (PAL_HD_OZ.ghost): the glow tint and the glow sprite's tint. */
export const GHOST_TINT: Color = PAL_HD_OZ.ghost[4];
export const GHOST_GLOW: Color = PAL_HD_OZ.ghost[5];

export interface GhostOpts {
  /** Body alpha (default 0.5). 0 draws nothing (fully faded). */
  alpha?: number;
  /** The additive silhouette colour (default GHOST_TINT); null = no tint pass. */
  tint?: Color | null;
  /** Alpha of the additive tint pass (default 0.35). */
  tintAlpha?: number;
  /** A glow sprite drawn additively round the body (default none); skipped when not defined. */
  glow?: string | null;
  /** Its frame (default 0) and alpha (default 0.6), and its offset from (x, y) (default 0, 0). */
  glowFrame?: number;
  glowAlpha?: number;
  glowDx?: number;
  glowDy?: number;
  flipX?: boolean;
  /** A tick: the alpha breathes ±12 % with it (cosmetic shimmer). Unset = steady. */
  t?: number;
  /** Screen space (cards, the HUD) instead of world space. */
  screen?: boolean;
}

const body: DrawOpts = { alpha: 0.5 };
const tintPass: DrawOpts = { alpha: 0.35, blend: 'add', tint: GHOST_TINT };
const glowPass: DrawOpts = { alpha: 0.6, blend: 'add' };

/** The shimmer factor of tick t (0.88 … 1.12; a slow, uneven breath). */
export function ghostShimmer(t: number): number {
  return 1 + 0.08 * Math.sin(t * 0.07) + 0.04 * Math.sin(t * 0.23 + 1.3);
}

/**
 * Draw sprite `sprite` frame `frame` as a ghost at (x, y) (the sprite's anchor; world px unless
 * `opts.screen`). See the module comment for the passes.
 */
export function drawGhost(r: Renderer, sprite: string, frame: number, x: number, y: number, opts: GhostOpts = {}): void {
  const k = opts.t === undefined ? 1 : ghostShimmer(opts.t);
  const a = Math.max(0, Math.min(1, (opts.alpha ?? 0.5) * k));
  if (a <= 0) return;
  const flip = opts.flipX === true;
  const screen = opts.screen === true;
  if (opts.glow && hasSprite(opts.glow)) {
    glowPass.alpha = Math.max(0, Math.min(1, (opts.glowAlpha ?? 0.6) * (a / 0.5)));
    glowPass.screen = screen;
    r.sprite(opts.glow, opts.glowFrame ?? 0, x + (opts.glowDx ?? 0), y + (opts.glowDy ?? 0), glowPass);
  }
  body.alpha = a;
  body.flipX = flip;
  body.screen = screen;
  r.sprite(sprite, frame, x, y, body);
  const tint = opts.tint === undefined ? GHOST_TINT : opts.tint;
  if (tint !== null) {
    tintPass.tint = tint;
    tintPass.alpha = Math.max(0, Math.min(1, (opts.tintAlpha ?? 0.35) * (a / 0.5)));
    tintPass.flipX = flip;
    tintPass.screen = screen;
    r.sprite(sprite, frame, x, y, tintPass);
  }
}
