/**
 * sewers-c DE PUT (docs/design/sewers.md §2.3): the helpers and the STAND-IN art only section c uses
 * (wave P1b C). Grey play art, code-drawn, so the play reads until the paint (Phase 5) and the port
 * (Phase 6) replace it; every id carries the `sewers-` segment (lazy chunk):
 *
 * - `decor/sewers-c-shaft`: the burst drain shaft over the start (a dark brick column with iron
 *   rungs; the fall comes down it);
 * - `decor/sewers-c-mouth` / `decor/sewers-c-tunnel`: pipe mouths and the side tunnel in the far
 *   wall (0–640), where the blinking eyes sit (scenery, not entities);
 * - `decor/sewers-c-pipe`: a leaper's pipe stub (an outfall riser on the walk plane, mouth at y 150);
 * - `decor/sewers-c-plinth`: a spitter's brick plinth under its one-way platform (top y 148);
 * - `decor/sewers-c-eyes`: a pair of red eyes (frame 0 open, 1 half shut).
 *
 * The scenery eyes are EMITTERS (`drawCEmitters`, the light config's `emissive`): drawn after the
 * darkness, so they glow in the dark like the rat eyes. They blink and go away by a hash of the tick
 * (draw only: no rng, no state).
 *
 * Phase 6 (wave P6b C): with the canal scene on (`sewersCanal('sewers-c')`, kit `sw_c.py` and its lit
 * stack `sw_c_lit.py`) the kit paints all of this (the shaft and the hole, the mouths, the tunnel, the
 * stubs, the plinths, the blinking eyes, the rats on the shaft walls): no stand-in is built or drawn,
 * and `drawCEmitters` draws the rat eyes only. `?canal=0` draws the stand-ins as before.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { hash2 } from '../../../art/paint';
import { canalPaintedNow } from '../../../mission/canal/registry';
import type { DecorDef } from '../../../mission/index';
import type { StaticLight } from '../../../mission/light/api';
import { drawRatEyes } from '../../sewers/eyes-emit';
import { PLINTH } from '../../sewers/rats/numbers';
import { G, SEWERS_C } from './terrain';

export const C_ART = {
  shaft: 'decor/sewers-c-shaft',
  mouth: 'decor/sewers-c-mouth',
  tunnel: 'decor/sewers-c-tunnel',
  pipe: 'decor/sewers-c-pipe',
  plinth: 'decor/sewers-c-plinth',
  eyes: 'decor/sewers-c-eyes',
} as const;

/** The far wall's mouths: y of their centres (the far walkway's wall, behind the channel). */
const MOUTH_Y = 128;
/** The side tunnel (the third eye spot) is a big arch. */
const TUNNEL_IX = 2;
/** The pipe stub's mouth is this far over the walk line (176 − 150 = LEAPER.pipeY). */
const PIPE_UP = 26;

// ---------------------------------------------------------------------------------------------
// Stand-in sprites
// ---------------------------------------------------------------------------------------------

function brick(b: PixelBuffer, x0: number, y0: number, w: number, h: number, base: Color, mortar: Color): void {
  b.rect(x0, y0, w, h, base);
  for (let y = y0; y < y0 + h; y += 4) {
    b.rect(x0, y, w, 1, mortar);
    const off = ((y - y0) / 4) % 2 === 0 ? 0 : 4;
    for (let x = x0 + off; x < x0 + w; x += 8) b.rect(x, y, 1, 4, mortar);
  }
}

function shaft(): Frame {
  const w = 56;
  const h = 176;
  const b = new PixelBuffer(w, h);
  brick(b, 0, 0, w, h, PAL.stone[0], PAL.ink[1]);
  b.rect(8, 0, w - 16, h, PAL.ink[1]);
  for (let y = 10; y < h - 8; y += 14) b.rect(14, y, w - 28, 2, PAL.rust[0]);
  b.rect(14, 0, 2, h - 8, PAL.rust[0]);
  b.rect(w - 16, 0, 2, h - 8, PAL.rust[0]);
  // The burst grate's bars at the top.
  for (let x = 6; x < w - 6; x += 5) b.rect(x, 0, 2, 4, PAL.steel[0]);
  return { buf: b, ox: Math.floor(w / 2), oy: h };
}

function mouth(rw: number, rh: number): Frame {
  const w = rw * 2 + 4;
  const h = rh * 2 + 4;
  const b = new PixelBuffer(w, h);
  b.ellipse(0, 0, w, h, PAL.stone[1]);
  b.ellipse(2, 2, w - 4, h - 4, PAL.ink[0]);
  return { buf: b, ox: Math.floor(w / 2), oy: Math.floor(h / 2) };
}

function tunnel(): Frame {
  const w = 44;
  const h = 40;
  const b = new PixelBuffer(w, h);
  brick(b, 0, 0, w, h, PAL.stone[1], PAL.stone[0]);
  b.ellipse(4, 4, w - 8, (h - 4) * 2, PAL.ink[0]);
  return { buf: b, ox: Math.floor(w / 2), oy: h };
}

function pipe(): Frame {
  const w = 18;
  const h = PIPE_UP + 8;
  const b = new PixelBuffer(w, h);
  // The riser from the walkway up to the mouth, the mouth ring facing the heroes (left).
  b.rect(4, 6, 10, h - 6, PAL.steel[0]);
  b.rect(5, 6, 2, h - 6, PAL.steel[1]);
  b.rect(0, 0, 10, 13, PAL.steel[1]);
  b.rect(1, 2, 7, 9, PAL.ink[0]);
  b.rect(10, 2, 6, 9, PAL.steel[0]);
  b.rect(2, h - 2, 14, 2, PAL.stone[0]);
  // Feet anchor: the mouth's centre sits PIPE_UP over the feet, 3 px left of the anchor.
  return { buf: b, ox: 8, oy: h };
}

function plinth(): Frame {
  const w = PLINTH.w;
  const h = G - PLINTH.y;
  const b = new PixelBuffer(w, h);
  brick(b, 0, 0, w, h, PAL.rust[0], PAL.stone[0]);
  b.rect(0, 0, w, 2, PAL.stone[2]);
  return { buf: b, ox: Math.floor(w / 2), oy: h };
}

function eyes(half: boolean): Frame {
  const w = 7;
  const h = 3;
  const b = new PixelBuffer(w, h);
  const c = PAL.red[3];
  if (half) {
    b.rect(1, 1, 2, 1, PAL.red[1]);
    b.rect(4, 1, 2, 1, PAL.red[1]);
  } else {
    b.rect(1, 0, 2, 2, c);
    b.rect(4, 0, 2, 2, c);
    b.set(1, 0, PAL.gold[3]);
    b.set(4, 0, PAL.gold[3]);
  }
  return { buf: b, ox: 3, oy: 1 };
}

defineSprite(C_ART.shaft, () => [shaft()], { loop: false });
defineSprite(C_ART.mouth, () => [mouth(7, 6)], { loop: false });
defineSprite(C_ART.tunnel, () => [tunnel()], { loop: false });
defineSprite(C_ART.pipe, () => [pipe()], { loop: false });
defineSprite(C_ART.plinth, () => [plinth()], { loop: false });
defineSprite(C_ART.eyes, () => [eyes(false), eyes(true)], { loop: false });

// ---------------------------------------------------------------------------------------------
// The section's decor and lights
// ---------------------------------------------------------------------------------------------

/** The stand-in decor of sewers-c (behind the entities). */
export function decorC(): DecorDef[] {
  const out: DecorDef[] = [{ sprite: C_ART.shaft, x: SEWERS_C.dropX, y: G - 16 }];
  SEWERS_C.eyes.forEach((x, i) => out.push(i === TUNNEL_IX ? { sprite: C_ART.tunnel, x, y: G - 16 } : { sprite: C_ART.mouth, x, y: MOUTH_Y }));
  for (const x of SEWERS_C.pipes) out.push({ sprite: C_ART.pipe, x: x + 3, y: G });
  for (const x of [SEWERS_C.spitterX, SEWERS_C.spitterX + PLINTH.gap]) out.push({ sprite: C_ART.plinth, x, y: G });
  return out;
}

/** The faint cold light down the burst shaft (spec §6: grate shafts faint and white). */
// The hole's light sits on the painted shaft plane (kit parts_sw_c.py: SB 0.86, the hole's centre at layer x HX 66):
// world x on that plane = 192 + (66 − 192) / 0.86 ≈ 45.5, so at camera 0 it shows at screen x 66, as the paint.
export const C_LAMPS: readonly StaticLight[] = [{ x: 45.5, speed: 0.86, y: 4, r: 72, color: PAL.snow[2], intensity: 0.4, glow: 0.12 }];

const eyeOpts: DrawOpts = {};

/**
 * Where scenery eye pair k sits now (draw only): the far-wall mouths (one pair, the tunnel two),
 * the shaft walls (two pairs that creep up and down). Returns false while the pair is away.
 */
function eyeSpot(k: number, tick: number, out: [number, number]): boolean {
  const n = SEWERS_C.eyes.length;
  if (k < n) {
    const x = SEWERS_C.eyes[k];
    out[0] = x + (k === TUNNEL_IX ? -6 : 0);
    out[1] = k === TUNNEL_IX ? G - 32 : MOUTH_Y;
  } else if (k === n) {
    out[0] = SEWERS_C.eyes[TUNNEL_IX] + 8;
    out[1] = G - 26;
  } else {
    // The shaft walls: rats on the walls (two pairs).
    const j = k - n - 1;
    out[0] = SEWERS_C.dropX + (j === 0 ? -18 : 18);
    out[1] = 60 + j * 40 + Math.round(10 * Math.sin(tick * 0.02 + j * 2));
  }
  // Away for a while now and then (a slow on / off by a hash of the 90-tick slot).
  return hash2(Math.floor((tick + k * 37) / 90), k, 0xe7e5) > 0.22;
}

const spot: [number, number] = [0, 0];

/**
 * Does the kit's canal scene paint sewers-c now (wave P6b C)? Its far wall's `wallfx` frames hold the
 * blinking eyes in the mouths and the side tunnel, its `burst` frames the rats on the shaft walls:
 * then the stand-in eyes below must not draw again. The runner's painted set (docs/api/canal.md §8)
 * holds c's decor ids exactly while c's scene is on (the switch, a source, the opt-in).
 */
export function cScenePainted(): boolean {
  return canalPaintedNow().has(C_ART.mouth);
}

/**
 * sewers-c's emitters (after the darkness): the rat eyes always; the scenery eyes (the stand-ins'
 * mouths, tunnel and shaft walls) only while the canal scene does not paint them (`?canal=0`, no source).
 */
export function drawCEmitters(world: World, r: Renderer): void {
  drawRatEyes(world, r);
  if (cScenePainted()) return;
  const tick = world.tick;
  const total = SEWERS_C.eyes.length + 3;
  for (let k = 0; k < total; k++) {
    if (!eyeSpot(k, tick, spot)) continue;
    if (spot[0] < r.camX - 8 || spot[0] > r.camX + 392) continue;
    // A blink: 6 ticks half shut every ~2 s, out of step per pair.
    const blink = (tick + k * 29) % 130 < 6 ? 1 : 0;
    eyeOpts.flipX = false;
    r.sprite(C_ART.eyes, blink, spot[0], spot[1], eyeOpts);
  }
}
