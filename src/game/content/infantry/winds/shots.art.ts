/**
 * Projectiles and loose props of the wind soldiers (GDD §9.0 "enemy projectiles": brighter than
 * player shots; notes and rings in `gold`, `snow` and `ink`). All frames are centre-anchored
 * (docs/api/game.md, Projectile) unless noted.
 *
 * - `enemy/sonic-ring` — 7 sizes (12 → 24 px tall, half as wide) × 2 shimmer frames; frame
 *   `size * 2 + shimmer` (SonicRing.draw). A side view of a brass sound ring with a bright
 *   leading edge and two small sound ripples inside.
 * - `enemy/low-ring` — the LOW NOTE: a flat 24×8 ring rolling on the ground (4 frames, the
 *   highlight walks around the rim), darker brass with a black core.
 * - `enemy/piccolo-bullet` — a slim 7×3 brass dart (16 directions).
 * - `enemy/bassoon-rocket` — a short wooden rocket with a brass nose cone and a crimson band
 *   (16 directions, 13×7 at 0°).
 * - `enemy/piccolo-rifle` — the piccolo-rifle drawn at the sniper's aim angle (32 directions,
 *   anchored at the grip; piccolo.art.ts).
 * - `enemy/winds/last-rocket` — the bassoonist's death gag: the rocket going up, then down.
 */
import { TRANSPARENT } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { piccoloRifleFrames } from './piccolo.art';

/** Centre-anchored frame of a buffer. */
function centred(b: PixelBuffer): Frame {
  return { buf: b, ox: b.w >> 1, oy: b.h >> 1 };
}

// ---------------------------------------------------------------------------------------------
// Sonic ring
// ---------------------------------------------------------------------------------------------

/** Ring sizes (diameter, px) of `enemy/sonic-ring`. */
export const SONIC_SIZES: readonly number[] = [12, 14, 16, 18, 20, 22, 24];

/**
 * One sonic ring frame: an upright brass ellipse (h tall, h/2 wide) with a 2-px rim, a hollow
 * middle, a lit upper-left rim and a bright leading (right) edge; `shimmer` swaps the lit and
 * bright tones so the ring flickers in flight.
 */
export function sonicRingFrame(h: number, shimmer: number): Frame {
  const w = Math.max(6, Math.round(h * 0.5));
  const b = new PixelBuffer(w + 4, h + 4);
  const g = PAL.gold;
  const rim = h >= 18 ? 3 : 2;
  b.ellipse(2, 2, w, h, g[2]);
  // Shading: the lit upper-left of the rim and the darker lower-right.
  const cx = 2 + w / 2;
  const cy = 2 + h / 2;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (b.get(x, y) !== g[2]) continue;
      const nx = (x + 0.5 - cx) / (w / 2);
      const ny = (y + 0.5 - cy) / (h / 2);
      if (nx + ny < -0.9) b.set(x, y, shimmer ? PAL.snow[3] : g[3]);
      else if (nx + ny > 0.9) b.set(x, y, g[1]);
    }
  }
  // The hollow middle (transparent: the world shows through the ring).
  b.ellipse(2 + rim, 2 + rim, w - rim * 2, h - rim * 2, TRANSPARENT);
  // The bright leading edge (the side facing the flight direction).
  for (let y = 0; y < b.h; y++) {
    for (let x = b.w - 1; x >= 0; x--) {
      if ((b.get(x, y) & 255) === 0) continue;
      if (y > 3 && y < b.h - 4) b.set(x, y, shimmer ? g[3] : PAL.snow[3]);
      break;
    }
  }
  b.outline(INK);
  // Two little sound ripples inside the ring (open arcs, no outline: they read as sound).
  const rx = Math.round(cx) + 1;
  const ry = Math.round(cy);
  const s = Math.max(2, Math.round(h / 8));
  for (let k = -s; k <= s; k++) b.set(rx - (Math.abs(k) >> 1) - (shimmer ? 1 : 0), ry + k, PAL.snow[shimmer ? 2 : 3]);
  return centred(b);
}

// ---------------------------------------------------------------------------------------------
// Low ring
// ---------------------------------------------------------------------------------------------

/** One LOW NOTE frame (24×8 + outline): a flat rolling ring, the highlight at `phase` (0..3). */
export function lowRingFrame(phase: number): Frame {
  const W = 24;
  const H = 8;
  const b = new PixelBuffer(W + 2, H + 2);
  const g = PAL.brass;
  b.ellipse(1, 1, W, H, g[1]);
  // The inner hole is dark (a deep, heavy note), not see-through.
  b.ellipse(5, 3, W - 8, H - 4, PAL.ink[1]);
  // Top rim lit, bottom rim shaded.
  for (let x = 3; x < W - 1; x++) {
    if (b.get(x, 1) === g[1]) b.set(x, 1, g[2]);
    if (b.get(x, 2) === g[1]) b.set(x, 2, g[2]);
    if (b.get(x, H) === g[1]) b.set(x, H, g[0]);
  }
  // The highlight runs around the rim: it rolls.
  const spots: readonly (readonly [number, number])[] = [
    [5, 2],
    [12, 1],
    [19, 2],
    [12, 8],
  ];
  const [hx, hy] = spots[phase & 3];
  b.set(hx, hy, PAL.snow[3]);
  b.set(hx + 1, hy, PAL.gold[3]);
  // A dark low-note stripe through the core.
  b.hline(8, W - 7, 5, PAL.red[1]);
  return { buf: b.padded(1).outline(INK), ox: (W + 4) >> 1, oy: (H + 4) >> 1 };
}

// ---------------------------------------------------------------------------------------------
// Directional shots (16 directions)
// ---------------------------------------------------------------------------------------------

/** Rotate a right-pointing buffer into `n` directions (frame 0 right, clockwise). */
function directions(base: PixelBuffer, n: number): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const r = base.padded(3).rotated((i / n) * Math.PI * 2);
    const t = r.trimBounds();
    const c = t ? r.crop(t.x - 1, t.y - 1, t.w + 2, t.h + 2) : r;
    // Recentre on the rotated buffer's middle (the shot's centre).
    const ox = t ? Math.round(r.w / 2) - (t.x - 1) : c.w >> 1;
    const oy = t ? Math.round(r.h / 2) - (t.y - 1) : c.h >> 1;
    out.push({ buf: c.outline(INK), ox, oy });
  }
  return out;
}

/** The piccolo dart: a slim 7×3 brass needle, bright tip, pointing right (unoutlined). */
export function piccoloDart(): PixelBuffer {
  const b = new PixelBuffer(7, 3);
  b.hline(0, 5, 1, PAL.gold[2]);
  b.hline(1, 4, 0, PAL.gold[3]);
  b.hline(1, 4, 2, PAL.gold[1]);
  b.set(6, 1, PAL.snow[3]);
  b.set(0, 0, PAL.red[2]);
  b.set(0, 2, PAL.red[2]);
  return b;
}

/** The bassoon rocket: wooden body, crimson band, brass nose cone, two fins (unoutlined). */
export function bassoonRocket(): PixelBuffer {
  const b = new PixelBuffer(13, 7);
  const wd = PAL.brown;
  // Fins at the tail.
  b.set(0, 0, PAL.red[2]);
  b.set(1, 1, PAL.red[2]);
  b.set(0, 6, PAL.red[1]);
  b.set(1, 5, PAL.red[1]);
  // Wooden body (lit top row, shaded bottom row).
  b.rect(1, 2, 8, 3, wd[2]);
  b.hline(1, 8, 2, wd[3]);
  b.hline(1, 8, 4, wd[1]);
  // Crimson band and a brass ring.
  b.vline(4, 2, 4, PAL.red[2]);
  b.set(4, 2, PAL.red[3]);
  b.vline(8, 2, 4, PAL.gold[2]);
  // Brass nose cone.
  b.rect(9, 2, 2, 3, PAL.gold[2]);
  b.set(9, 2, PAL.gold[3]);
  b.set(11, 3, PAL.gold[2]);
  b.set(12, 3, PAL.gold[3]);
  b.set(11, 2, PAL.gold[3]);
  b.set(11, 4, PAL.gold[1]);
  // A spark of exhaust at the tail.
  b.set(0, 3, PAL.orange[3]);
  return b;
}

/** The death-gag rocket: frame 0 points up (rising), frame 1 points down (falling). */
function lastRocketFrames(): Frame[] {
  const up = bassoonRocket().padded(2).rotated(-Math.PI / 2);
  const down = bassoonRocket().padded(2).rotated(Math.PI / 2);
  return [up, down].map((b) => {
    const t = b.trimBounds();
    const c = t ? b.crop(t.x - 1, t.y - 1, t.w + 2, t.h + 2) : b;
    return centred(c.outline(INK));
  });
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

defineSprite(
  'enemy/sonic-ring',
  () => {
    const out: Frame[] = [];
    for (const s of SONIC_SIZES) out.push(sonicRingFrame(s, 0), sonicRingFrame(s, 1));
    return out;
  },
  { ticksPerFrame: 4 },
);
defineSprite('enemy/low-ring', () => [0, 1, 2, 3].map(lowRingFrame), { ticksPerFrame: 4 });
defineSprite('enemy/piccolo-bullet', () => directions(piccoloDart(), 16), { ticksPerFrame: 4 });
defineSprite('enemy/bassoon-rocket', () => directions(bassoonRocket(), 16), { ticksPerFrame: 4 });
defineSprite('enemy/piccolo-rifle', piccoloRifleFrames, { ticksPerFrame: 4 });
defineSprite('enemy/winds/last-rocket', lastRocketFrames, { ticksPerFrame: 15, loop: false });
