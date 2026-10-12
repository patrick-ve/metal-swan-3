/**
 * Machines kit (docs/ART_GUIDE.md §6): reusable parts for vehicles, aircraft and turrets.
 * Every part returns a shaded PixelBuffer (light from the top-left) WITHOUT an outline, so
 * parts can be stacked first and outlined once (`buf.outline(INK)` on the finished machine,
 * leaving a 1-px margin). Animated parts take a `phase` (frame index).
 *
 * - wheel(r, phase, o)         road wheel / tyre with turning bolts
 * - tread(len, h, phase, o)    track loop with moving links, road wheels and sprockets
 * - plate(w, h, ramp, o)       hull plate: bevel + rivets
 * - hull(points, ramp, o)      polygon hull plate with bevel
 * - barrel(len, thick, ramp)   gun barrel pointing right, ring and muzzle brake
 * - rotor(len, phase)          main rotor seen from the side (4-phase blur)
 * - tailRotor(r, phase)        small spinning disc
 * - glass(w, h, o)             cockpit glass with reflections
 * - hazard(w, h, o)            diagonal warning stripes
 * - damage(buf, amount, seed)  dents, bullet holes and scorch marks on a finished machine
 * Demo sprites: machine/demo-tank (3f), machine/demo-heli (4f).
 */
import type { Color } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { INK, PAL } from '../../engine/palette';
import type { Frame } from '../../engine/render';
import { defineSprite } from '../../engine/sprites';
import { at, bayer, hash2, R, shadeLayer } from './paint';
import type { RampLike } from './paint';

// ------------------------------------------------------------------------------------ wheels

export interface WheelOpts {
  /** Tyre ramp (default black). */
  tyre?: RampLike;
  /** Rim ramp (default steel). */
  rim?: RampLike;
  /** Bolts on the rim (default 4); they turn with the phase. */
  bolts?: number;
  /** Phases per bolt step (default 4): bolts move 1/(bolts·steps) of a turn per phase. */
  steps?: number;
}

/** Road wheel / tyre of radius r (diameter 2r+1). */
export function wheel(r: number, phase = 0, o: WheelOpts = {}): PixelBuffer {
  const tyre = R(o.tyre ?? 'black');
  const rim = R(o.rim ?? 'steel');
  const d = r * 2 + 1;
  const b = new PixelBuffer(d, d);
  b.circle(r, r, r, tyre[2]);
  // Tyre highlight on the upper-left arc, shadow on the lower-right.
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const dx = x - r;
      const dy = y - r;
      const q = Math.hypot(dx, dy) / (r + 0.5);
      if (q > 0.78) b.set(x, y, dx + dy < -r * 0.6 ? tyre[3] : dx + dy > r * 0.6 ? tyre[1] : tyre[2]);
    }
  }
  const rr = Math.max(1, Math.round(r * 0.62));
  b.circle(r, r, rr, rim[2]);
  b.circle(r - (rr > 2 ? 1 : 0), r - (rr > 2 ? 1 : 0), Math.max(0, rr - 2), rim[3]);
  b.set(r, r, rim[1]);
  const bolts = o.bolts ?? 4;
  const steps = o.steps ?? 4;
  if (rr >= 2) {
    for (let k = 0; k < bolts; k++) {
      const a = ((k + phase / steps) / bolts) * Math.PI * 2;
      const bx = Math.round(r + Math.cos(a) * (rr - 1));
      const by = Math.round(r + Math.sin(a) * (rr - 1));
      b.set(bx, by, rim[0]);
    }
  }
  return b;
}

// ------------------------------------------------------------------------------------ treads

export interface TreadOpts {
  /** Track ramp (default black). */
  ramp?: RampLike;
  /** Road wheel rim ramp (default steel). */
  rim?: RampLike;
  /** Number of road wheels between the sprockets (default: fits). */
  wheels?: number;
  /** Link length in px = phases per seamless loop (default 3). */
  period?: number;
}

/**
 * Track loop `len` × `h` with links that move along the loop with `phase` (top run moves
 * forward, bottom run backward — the visual of a track driving right). Contains road wheels
 * and two sprockets. `period` phases make one seamless loop.
 */
export function tread(len: number, h: number, phase = 0, o: TreadOpts = {}): PixelBuffer {
  const tr = R(o.ramp ?? 'black');
  const b = new PixelBuffer(len, h);
  const rr = Math.floor(h / 2);
  b.roundRect(0, 0, len, h, rr, tr[1]);
  b.roundRect(2, 2, len - 4, h - 4, Math.max(0, rr - 2), 0);
  // Links: one dark pixel per link along the band, offset by the phase.
  const per = Math.max(2, o.period ?? 3);
  const p = ((phase % per) + per) % per;
  for (let x = 0; x < len; x++) {
    for (const y of [0, 1, h - 2, h - 1]) {
      if ((b.get(x, y) & 255) === 0) continue;
      const top = y < h / 2;
      const s = top ? x - p : x + p;
      const link = ((s % per) + per) % per;
      b.set(x, y, link === 0 ? tr[0] : top && y === 0 ? tr[3] : tr[2]);
    }
  }
  // Ends: sprocket discs with teeth.
  const rim = R(o.rim ?? 'steel');
  const sr = rr - 1;
  const ends = [rr, len - 1 - rr];
  for (const cx of ends) {
    b.circle(cx, rr, sr, rim[1]);
    b.circle(cx, rr, Math.max(0, sr - 2), rim[2]);
    for (let k = 0; k < 6; k++) {
      const a = ((k + p / per) / 6) * Math.PI * 2;
      b.set(Math.round(cx + Math.cos(a) * sr), Math.round(rr + Math.sin(a) * sr), rim[3]);
    }
    b.set(cx, rr, rim[0]);
  }
  // Road wheels along the bottom run.
  const wr = Math.max(1, rr - 2);
  const span = len - 2 * rr - 2 * (wr + 1);
  const n = o.wheels ?? Math.max(1, Math.floor(span / (wr * 2 + 2)) + 1);
  for (let k = 0; k < n; k++) {
    const cx = Math.round(rr + wr + 1 + (n === 1 ? span / 2 : (span * k) / (n - 1)) + 0);
    const wb = wheel(wr, p, { tyre: tr, rim, bolts: 3, steps: per });
    b.blit(wb, cx - wr, h - 2 - wr * 2 - 1 + 1);
  }
  return b;
}

// ------------------------------------------------------------------------------------ plates

export interface PlateOpts {
  /** Bevel width (default 1). */
  bevel?: number;
  /** Rivet layout (default 'corners'). */
  rivets?: 'none' | 'corners' | 'edges' | 'grid';
  /** Spacing between edge rivets (default 5). */
  spacing?: number;
  /** Base ramp index (default 2). */
  base?: number;
}

/** Draw a rivet: a light dot with a dark shadow pixel below-right. */
export function rivet(b: PixelBuffer, x: number, y: number, ramp: Ramp): void {
  b.set(x, y, at(ramp, ramp.length - 1));
  b.set(x + 1, y + 1, ramp[0]);
}

/** Rectangular armour plate with a bevel and rivets. */
export function plate(w: number, h: number, rampLike: RampLike, o: PlateOpts = {}): PixelBuffer {
  const ramp = R(rampLike);
  const b = new PixelBuffer(w, h).fill(ramp[o.base ?? 2]);
  shadeLayer(b, ramp, { hi: o.bevel ?? 1, lo: o.bevel ?? 1, base: o.base ?? 2 });
  addRivets(b, ramp, o.rivets ?? 'corners', o.spacing ?? 5);
  return b;
}

function addRivets(b: PixelBuffer, ramp: Ramp, layout: NonNullable<PlateOpts['rivets']>, spacing: number): void {
  const { w, h } = b;
  if (layout === 'none' || w < 6 || h < 6) return;
  const pts: Array<[number, number]> = [];
  if (layout === 'corners') pts.push([2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]);
  if (layout === 'edges' || layout === 'grid') {
    for (let x = 2; x <= w - 4; x += spacing) pts.push([x, 2], [x, h - 4]);
    for (let y = 2 + spacing; y <= h - 4 - 2; y += spacing) pts.push([2, y], [w - 4, y]);
  }
  if (layout === 'grid') for (let y = 2 + spacing; y < h - 4; y += spacing) for (let x = 2 + spacing; x < w - 4; x += spacing) pts.push([x, y]);
  for (const [x, y] of pts) rivet(b, x, y, ramp);
}

/** Polygon hull plate (vertices in the buffer's pixels) with a bevel. */
export function hull(w: number, h: number, points: ReadonlyArray<readonly [number, number]>, rampLike: RampLike, o: PlateOpts = {}): PixelBuffer {
  const ramp = R(rampLike);
  const b = new PixelBuffer(w, h);
  b.poly(points, ramp[2]);
  shadeLayer(b, ramp, { hi: o.bevel ?? 1, lo: o.bevel ?? 1, base: o.base ?? 2 });
  return b;
}

/** Gun barrel pointing right: tube with a highlight, a ring near the base and a muzzle brake. */
export function barrel(len: number, thick: number, rampLike: RampLike = 'steel'): PixelBuffer {
  const ramp = R(rampLike);
  const t = Math.max(2, thick);
  const b = new PixelBuffer(len, t + 2);
  b.rect(0, 1, len - 3, t, ramp[2]);
  b.hline(0, len - 4, 1, ramp[3]);
  b.hline(0, len - 4, t, ramp[1]);
  // Ring at the base, brake at the muzzle.
  b.rect(2, 0, 2, t + 2, ramp[1]);
  b.vline(2, 0, t + 1, ramp[3]);
  b.rect(len - 4, 0, 4, t + 2, ramp[2]);
  b.hline(len - 4, len - 1, 0, ramp[3]);
  b.hline(len - 4, len - 1, t + 1, ramp[1]);
  b.vline(len - 1, 1, t, ramp[0]);
  return b;
}

// ------------------------------------------------------------------------------------ rotors

/**
 * Main rotor seen from the side, `len` px wide: four phases of a spinning two-blade rotor
 * (full blade, foreshortened, edge-on, foreshortened) with a dithered blur disc.
 */
export function rotor(len: number, phase = 0): PixelBuffer {
  const b = new PixelBuffer(len, 4);
  const c = len >> 1;
  const p = ((phase % 4) + 4) % 4;
  const reach = [0.5, 0.3, 0.08, 0.3][p] * len;
  // Blur disc: faint dashes across the whole span.
  for (let x = 0; x < len; x++) if (bayer(x, 1) < 0.25 && Math.abs(x - c) > reach) b.set(x, 1, PAL.steel[3]);
  // Blade.
  b.hline(Math.round(c - reach), Math.round(c + reach), 1, PAL.steel[1]);
  b.hline(Math.round(c - reach * 0.9), Math.round(c + reach * 0.9), 2, PAL.steel[0]);
  // Hub.
  b.rect(c - 1, 0, 3, 4, PAL.steel[2]);
  b.set(c - 1, 0, PAL.steel[3]);
  return b;
}

/** Small spinning tail rotor (radius r): a blurred disc with a blade line. */
export function tailRotor(r: number, phase = 0): PixelBuffer {
  const d = r * 2 + 1;
  const b = new PixelBuffer(d, d);
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) if (Math.hypot(x - r, y - r) <= r + 0.3 && bayer(x, y) < 0.3) b.set(x, y, PAL.steel[3]);
  const a = (((phase % 4) + 4) % 4) * (Math.PI / 4);
  b.line(Math.round(r - Math.cos(a) * r), Math.round(r - Math.sin(a) * r), Math.round(r + Math.cos(a) * r), Math.round(r + Math.sin(a) * r), PAL.steel[1]);
  b.set(r, r, PAL.steel[2]);
  return b;
}

// ------------------------------------------------------------------------------------ details

export interface GlassOpts {
  /** Glass ramp (default sky). */
  ramp?: RampLike;
  /** Frame bar colour (default steel 1). */
  frame?: Color;
  /** Number of vertical frame bars (default 1). */
  bars?: number;
}

/** Cockpit glass (w × h) with a reflection streak and frame bars. */
export function glass(w: number, h: number, o: GlassOpts = {}): PixelBuffer {
  const ramp = R(o.ramp ?? 'sky');
  const b = new PixelBuffer(w, h);
  b.gradient(0, 0, w, h, ramp, { reverse: true, dither: 0.3 });
  // Reflection: a bright diagonal streak near the top-left.
  for (let k = 0; k < Math.min(w, h); k++) {
    const x = Math.floor(w * 0.25) + k;
    const y = h - 1 - k * 2;
    if (y < 0) break;
    b.set(x, y, PAL.snow[3]);
    if (y - 1 >= 0) b.set(x, y - 1, ramp[3]);
  }
  const bars = o.bars ?? 1;
  for (let i = 1; i <= bars; i++) b.vline(Math.round((w * i) / (bars + 1)), 0, h - 1, o.frame ?? PAL.steel[1]);
  return b;
}

export interface HazardOpts {
  /** Stripe width (default 3). */
  stripe?: number;
  a?: Color;
  b?: Color;
}

/** Diagonal warning stripes. */
export function hazard(w: number, h: number, o: HazardOpts = {}): PixelBuffer {
  const s = o.stripe ?? 3;
  const a = o.a ?? PAL.gold[2];
  const c = o.b ?? PAL.ink[1];
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(x, y, Math.floor((x + y) / s) % 2 === 0 ? a : c);
  return b;
}

/**
 * Damage decals on a finished (outlined) machine: dents, bullet holes, scorch smudges.
 * `amount` 0..1 scales how many. Returns a new buffer.
 */
export function damage(src: PixelBuffer, amount: number, seed = 1): PixelBuffer {
  const b = src.clone();
  const n = Math.round(amount * (b.w * b.h) / 90);
  const inside = (x: number, y: number): boolean => {
    const c = b.get(x, y);
    return (c & 255) !== 0 && c !== INK;
  };
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(hash2(i, 1, seed) * (b.w - 2));
    const y = 1 + Math.floor(hash2(i, 2, seed) * (b.h - 2));
    if (!inside(x, y)) continue;
    const kind = hash2(i, 3, seed);
    if (kind < 0.4) {
      // Bullet hole: dark centre, bright upper-left lip.
      b.set(x, y, INK);
      if (inside(x - 1, y - 1)) b.set(x - 1, y - 1, PAL.steel[3]);
    } else if (kind < 0.75) {
      // Scorch: a dark ordered smudge.
      for (let yy = -2; yy <= 2; yy++) {
        for (let xx = -3; xx <= 3; xx++) {
          if (inside(x + xx, y + yy) && Math.abs(xx) + Math.abs(yy) < 4 && bayer(x + xx, y + yy) < 0.55) b.set(x + xx, y + yy, PAL.ink[1]);
        }
      }
    } else {
      // Dent: a short dark crease with a light edge.
      if (inside(x + 1, y)) b.set(x + 1, y, PAL.steel[0]);
      b.set(x, y, PAL.steel[0]);
      if (inside(x, y - 1)) b.set(x, y - 1, PAL.steel[3]);
    }
  }
  return b;
}

// ------------------------------------------------------------------------------------ demos

/** Boxy original demo tank (≈ 72×38): animated tracks, sloped front plate, turret, long gun. */
export function demoTank(phase: number, damaged = 0): Frame {
  const W = 76;
  const H = 40;
  const b = new PixelBuffer(W, H);
  const body: RampLike = 'olive';
  // Long gun and turret.
  b.blit(barrel(30, 3, 'steel'), 44, 9);
  b.blit(hull(30, 13, [[3, 12], [3, 4], [8, 1], [24, 1], [28, 5], [28, 12]], body), 20, 5);
  b.blit(plate(6, 3, 'steel', { rivets: 'none' }), 26, 3);
  // Hull: sloped front, flat deck, rear box.
  b.blit(hull(66, 13, [[1, 12], [1, 2], [4, 0], [52, 0], [64, 8], [64, 12]], body), 5, 17);
  b.blit(hazard(8, 5, { stripe: 2 }), 58, 22);
  for (let x = 10; x <= 54; x += 6) rivet(b, x, 19, R(body));
  // Track.
  b.blit(tread(64, 12, phase), 6, 27);
  // Antenna and a small searchlight.
  b.line(24, 5, 22, 0, PAL.steel[1]);
  b.set(45, 15, PAL.gold[3]);
  b.set(46, 15, PAL.gold[2]);
  let out = b.outline(INK);
  if (damaged > 0) out = damage(out, damaged, 7);
  return { buf: out, ox: W >> 1, oy: H };
}

/** Original demo helicopter (≈ 70×32): fuselage, glass nose, tail boom, rotors, skids. */
export function demoHeli(phase: number): Frame {
  const W = 72;
  const H = 34;
  const b = new PixelBuffer(W, H);
  const body: RampLike = 'slate';
  // Tail boom and fin.
  b.blit(hull(36, 8, [[0, 3], [34, 0], [35, 6], [0, 7]], body), 2, 12);
  b.blit(hull(8, 10, [[1, 9], [3, 0], [7, 0], [7, 9]], body), 2, 4);
  b.blit(tailRotor(4, phase), 0, 10);
  // Fuselage with a glass nose.
  b.blit(hull(36, 16, [[2, 15], [0, 6], [6, 1], [24, 0], [33, 5], [35, 11], [30, 15]], body), 32, 9);
  b.blit(glass(10, 7, { bars: 1 }), 55, 11);
  b.blit(hazard(6, 3, { stripe: 2 }), 38, 21);
  // Mast, rotor, skids.
  b.rect(46, 6, 4, 4, PAL.steel[1]);
  b.blit(rotor(66, phase), 15, 3);
  b.hline(34, 64, 30, PAL.steel[1]);
  b.line(40, 25, 38, 30, PAL.steel[1]);
  b.line(58, 25, 60, 30, PAL.steel[1]);
  const out = b.outline(INK);
  return { buf: out, ox: W >> 1, oy: H };
}

/** Register the machine demo sprites (called from the fx art module). */
export function defineMachineDemos(): void {
  defineSprite('machine/demo-tank', () => [0, 1, 2].map((p) => demoTank(p)), { ticksPerFrame: 4 });
  defineSprite('machine/demo-tank-damaged', () => [demoTank(0, 0.8)], { ticksPerFrame: 30 });
  defineSprite('machine/demo-heli', () => [0, 1, 2, 3].map((p) => demoHeli(p)), { ticksPerFrame: 2 });
}
