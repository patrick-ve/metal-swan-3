/**
 * Mission `ams` UHD street furniture of sections a and b (docs/ART_GUIDE.md "UHD art"): lamps,
 * bollards, bikes and the bike rack, the bench, the elm, tulips, flags, chimney smoke, the hot-dog
 * stand set (stand, front, red pennant, the cabinet, the grey lamp), awnings and the balustrade.
 * One density-generic drawer per id (d 2 and 4), the 1× frame's size and anchor (art.ts), lit
 * from the upper left with PAL_HD ramps; outline C (static facade decor in the playfield), none
 * on the smoke (as at 1×).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, grime, plaster, texAll, wood } from '../../../art/hd/index';
import { noise2 } from '../../../art/paint';
import { AWNING_SETS, BIKE_COLOURS } from './art';
import { BgCanvas, idx } from './art-hd-bg-kit';
import { leafMass } from './art-hd-bg-trees';
import { deco, face, fr, glow, lettering, outlineC, rampOf, textMask, type D, type P } from './art-hd-ab-kit';

// ============================================================================== lamps, bollard

/** The Amsterdam cast-iron street lamp: dark green post, a four-sided lantern (16 × 72, feet). */
export function lampHd(d: D): Frame {
  const c = new HdCanvas(16, 72, d);
  const iron = deco(c, PAL_HD.green, { lo: 0, hi: 3, spec: 0.7, shine: 18, gain: 0.85 });
  const glass = glow(c, PAL_HD.gold, { lo: 3, hi: 7 });
  // Post: a fluted shaft on a stepped base, a collar halfway.
  c.cylinder(6, 16, 3, 50, {
    mat: iron,
    z: 1,
    tex: (s) => {
      if (s.d >= 4 && Math.abs(((s.x - 6) % 1) - 0.5) < 0.12) s.tone -= 0.12;
    },
  });
  c.cylinder(4, 64, 8, 7, { mat: iron, z: 1.2, cap: 1.2 });
  c.cylinder(4.6, 61.5, 6.8, 3, { mat: iron, z: 1.15, cap: 0.8 });
  c.cylinder(5, 39.5, 6, 2.5, { mat: iron, z: 1.3, cap: 0.6 });
  c.cylinder(5.6, 15.5, 4.8, 2, { mat: iron, z: 1.3 });
  // Lantern: glowing panes in an iron frame (its front corner bar), a crown and a finial.
  c.poly([[3, 6], [13, 6], [11.8, 16], [4.2, 16]], {
    mat: glass,
    z: 1,
    tex: (s) => {
      // The mantle's glow: brightest low in the middle, warmer towards the frame.
      const q = Math.hypot((s.x - 8) * 0.8, (s.y - 12.5) * 0.6);
      s.tone = 0.5 - q * 0.09;
    },
  });
  c.box(7.7, 6, 0.6, 10, { mat: iron, z: 1.6, bevel: 0.2 });
  c.capsule(3.2, 6.2, 4.4, 15.8, 0.35, 0.35, { mat: iron, z: 1.5 });
  c.capsule(12.8, 6.2, 11.6, 15.8, 0.35, 0.35, { mat: iron, z: 1.5 });
  c.box(2, 5, 12, 1.4, { mat: iron, z: 1.8, bevel: 0.45, r: 0.3 });
  c.poly([[4, 5.2], [12, 5.2], [8.5, 1]], { mat: iron, z: 1.7, n: [0.15, -0.55, 0.82] });
  c.ellipsoid(8.5, 0.9, 0.7, 0.8, { mat: iron, z: 1.9 });
  c.box(4, 16, 8, 1.2, { mat: iron, z: 1.8, bevel: 0.4 });
  return fr(c.render({ outline: 'C', sep: true, ao: 0.25, rimLight: 1 }), 8, 72, d);
}

/** The grey lamp by the hot-dog stand: a modern pole with an arm and a lit head (16 × 84, feet). */
export function lampGreyHd(d: D): Frame {
  const c = new HdCanvas(16, 84, d);
  const steel = deco(c, PAL_HD.steel, { lo: 1, hi: 4, spec: 0.8, shine: 20 });
  const lens = glow(c, PAL_HD.gold, { lo: 4, hi: 7 });
  c.cylinder(7, 10, 3, 72.5, { mat: steel, z: 1, tex: grime(23, 0.3, 5) });
  c.cylinder(5, 77.5, 7, 5.5, { mat: steel, z: 1.2, cap: 1 });
  c.stroke([[8.5, 11], [10, 7.5], [12.5, 5]], 0.55, 0.45, { mat: steel, z: 1.1 });
  c.box(10, 3.8, 5, 3.2, { mat: steel, z: 1.3, bevel: 0.6, r: 0.6 });
  c.box(10.4, 6.6, 4.2, 0.9, { mat: lens, z: 1.4, tone: 0.3 });
  return fr(c.render({ outline: 'C', sep: true, ao: 0.25, rimLight: 1 }), 8, 84, d);
}

/** An Amsterdammertje: a rust-brown bollard with three white crosses (9 × 21, feet). */
export function bollardHd(d: D): Frame {
  const c = new HdCanvas(9, 21, d);
  const iron = deco(c, PAL_HD.rust, { lo: 0, hi: 3, spec: 0.5, shine: 16 });
  const cross = PAL_HD.snow[5];
  c.cylinder(2, 4, 5, 15.4, { mat: iron, z: 1, tex: grime(5, 0.35, 2) });
  c.ellipsoid(4.5, 3.6, 3, 2.5, { mat: iron, z: 1.3 });
  c.cylinder(1.4, 18, 6.2, 2, { mat: iron, z: 1.2, cap: 0.6, tone: -0.1 });
  // XXX: three Andreas crosses painted on the round front (crisp strokes).
  for (let k = 0; k < 3; k++) {
    const yc = 8.5 + k * 4;
    c.paint(3, yc - 1.6, 3, 3.2, (x, y) => {
      const dx = x - 4.5;
      const dy = y - yc;
      return Math.abs(Math.abs(dx) - Math.abs(dy)) < (d >= 4 ? 0.36 : 0.5) && Math.abs(dx) < 1.45 ? cross : 0;
    });
  }
  return fr(c.render({ outline: 'C', sep: true, ao: 0.25, rimLight: 1 }), 4, 21, d);
}

// ============================================================================== bikes

export interface BikeMats {
  tyre: number;
  rim: number;
  chrome: number;
  saddle: number;
  rack: number;
  lamp: number;
  guard: number;
}

export function bikeMatsHd(c: HdCanvas): BikeMats {
  return {
    tyre: deco(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.3, shine: 10 }),
    rim: deco(c, PAL_HD.steel, { lo: 2, hi: 6, spec: 1, shine: 26 }),
    chrome: deco(c, PAL_HD.steel, { lo: 3, hi: 6, spec: 1, shine: 30 }),
    saddle: deco(c, PAL_HD.brown, { lo: 0, hi: 3, spec: 0.4, shine: 12 }),
    rack: deco(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.5 }),
    lamp: glow(c, PAL_HD.gold, { lo: 4, hi: 7 }),
    guard: deco(c, PAL_HD.black, { lo: 1, hi: 4, spec: 0.5 }),
  };
}

/** The 1× bike colours as HD ramps (ink → black: the ink ramp has two tones only). */
function bikeRamp(col: Color): Ramp {
  if (col === PAL.ink[1] || col === PAL.ink[0]) return PAL_HD.black;
  return rampOf(col, PAL_HD.steel);
}

/**
 * A Dutch omafiets seen from the side, laid out as art.ts `drawBike(b, x, y, frame, flip)`: wheels
 * on row y, front to the right (left when flipped); tyres, rims, spokes (4×), the step-through
 * frame, the chain guard, the rack, a leather saddle, the bars and the lamp.
 */
export function bikeHd(c: HdCanvas, m: BikeMats, x: number, y: number, col: Color, flip: boolean, z = 1): P[] {
  const ramp = bikeRamp(col);
  const frameM = deco(c, ramp, { lo: Math.min(1, ramp.length - 3), hi: ramp.length - 2, spec: 0.7, shine: 22 });
  const fx = (dx: number): number => (flip ? x + 21 - dx : x + dx) + 0.5;
  const yy = (dy: number): number => y + dy + 0.5;
  const R = 5.4;
  for (const cx of [4, 17]) {
    const wx = fx(cx);
    const wy = yy(-5);
    c.plane(wx - R, wy - R, 2 * R, 2 * R, {
      mat: m.tyre,
      z,
      mask: (px, py) => {
        const q = Math.hypot(px - wx, py - wy);
        return q <= R && q > R - 0.95;
      },
      normal: (px, py, n) => {
        const q = Math.hypot(px - wx, py - wy) || 1;
        const k = (q - (R - 0.5)) / 0.5;
        n[0] = ((px - wx) / q) * k * 0.6;
        n[1] = ((py - wy) / q) * k * 0.6;
        n[2] = 1;
      },
    });
    c.plane(wx - R, wy - R, 2 * R, 2 * R, {
      mat: m.rim,
      z: z - 0.05,
      mask: (px, py) => {
        const q = Math.hypot(px - wx, py - wy);
        if (q > R - 0.9 && q <= R - 0.95 + 0.6) return true;
        if (q < 0.7) return true;
        if (c.d < 4) return false;
        const a = Math.atan2(py - wy, px - wx);
        return q < R - 1 && Math.abs((((a / (Math.PI / 9)) % 1) + 1) % 1 - 0.5) > 0.44;
      },
    });
  }
  const P = (dx: number, dy: number): P => [fx(dx), yy(dy)];
  const fo = { mat: frameM, z: z + 0.4 };
  const t = (a: P, b: P, r = 0.48): void => {
    c.capsule(a[0], a[1], b[0], b[1], r, r, fo);
  };
  t(P(4, -5), P(9, -5), 0.38);
  t(P(9, -5), P(14, -11));
  t(P(8, -11), P(9, -5));
  t(P(14, -11), P(17, -5), 0.42);
  t(P(8.6, -8), P(13.5, -10.5), 0.4);
  // Mudguards: thin arcs over the wheels.
  for (const cx of [4, 17]) {
    const pts: P[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (1.05 + (k / 8) * 0.75) * (flip ? 1 : 1);
      const ax = flip ? Math.PI * 3 - a : a;
      pts.push([fx(cx) + Math.cos(ax) * 5.9 * (cx === 4 ? 1 : 1), yy(-5) + Math.sin(a) * 5.9]);
    }
    c.stroke(pts, 0.3, 0.3, { mat: m.guard, z: z + 0.3 });
  }
  // Chain guard over the chain stay, the crank.
  c.capsule(fx(4.5), yy(-5.4), fx(9.5), yy(-5.6), 0.9, 1.1, { mat: m.guard, z: z + 0.5 });
  c.ellipsoid(fx(9), yy(-5), 1.1, 1.1, { mat: m.chrome, z: z + 0.6 });
  // Rack, saddle, stem, bars, lamp.
  c.capsule(fx(3), yy(-9), fx(8.2), yy(-10), 0.35, 0.35, { mat: m.rack, z: z + 0.7 });
  c.capsule(fx(3), yy(-9), fx(4), yy(-5), 0.25, 0.25, { mat: m.rack, z: z + 0.6 });
  c.capsule(fx(8), yy(-10.8), fx(8.3), yy(-12), 0.25, 0.25, { mat: m.chrome, z: z + 0.6 });
  c.blob([[fx(6) - (flip ? 0 : 0.3), yy(-12.2)], [fx(7), yy(-12.9)], [fx(10), yy(-12.7)], [fx(10.4), yy(-11.9)], [fx(7.5), yy(-11.6)]].map(([px, py]) => [px, py] as P), 0.4, { mat: m.saddle, z: z + 0.9 });
  t(P(14, -11), P(14, -14), 0.3);
  c.capsule(fx(11.6), yy(-14.4), fx(15.2), yy(-13.8), 0.32, 0.32, { mat: m.chrome, z: z + 0.9 });
  c.ellipsoid(fx(16.2), yy(-11), 0.6, 0.55, { mat: m.lamp, z: z + 1, tone: 0.3 });
  return [P(4, -5), P(17, -5)];
}

/** Skip predicate for `outlineC`: the open insides of spoked wheels (centres in logical px). */
export function wheelHoles(wheels: readonly P[], d: number, r = 4.3): (X: number, Y: number) => boolean {
  return (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    for (const [wx, wy] of wheels) if ((x - wx) ** 2 + (y - wy) ** 2 < r * r) return true;
    return false;
  };
}

/** The 8 parked bikes (24 × 17, feet), every second one facing left. */
export function bikeFramesHd(d: D): Frame[] {
  return BIKE_COLOURS.map((col, i) => {
    const c = new HdCanvas(24, 17, d);
    const wheels = bikeHd(c, bikeMatsHd(c), 1, 16, col, i % 2 === 1);
    return fr(outlineC(c.render({ outline: 'none', sep: true, ao: 0.2 }), d, wheelHoles(wheels, d)), 12, 17, d);
  });
}

/** A rack of four parked bikes (front decor, 68 × 18, feet). */
export function bikeRackHd(d: D): Frame {
  const c = new HdCanvas(68, 18, d);
  const m = bikeMatsHd(c);
  const steel = deco(c, PAL_HD.steel, { lo: 2, hi: 6, spec: 0.9, shine: 24 });
  c.cylinder(2, 12.1, 64, 0.9, { mat: steel, z: 0.5, axis: 'h' });
  for (const x of [4, 22, 40, 58]) c.cylinder(x, 12.5, 1, 5.5, { mat: steel, z: 0.5 });
  const wheels: P[] = [];
  for (let i = 0; i < 4; i++) wheels.push(...bikeHd(c, m, 2 + i * 15, 17, BIKE_COLOURS[(i * 3) % BIKE_COLOURS.length], i % 2 === 1, 1 + i * 0.1));
  return fr(outlineC(c.render({ outline: 'none', sep: true, ao: 0.2 }), d, wheelHoles(wheels, d)), 34, 18, d);
}

// ============================================================================== bench, tulips

/** A park bench: three green slats on iron legs (34 × 16, feet). */
export function benchHd(d: D): Frame {
  const c = new HdCanvas(34, 16, d);
  const slat = deco(c, PAL_HD.green, { lo: 1, hi: 5, spec: 0.25, shine: 12 });
  const iron = deco(c, PAL_HD.black, { lo: 0, hi: 4, spec: 0.6, shine: 18 });
  for (const [y, h, n] of [[1, 3, [0, 0, 1]], [6, 3, [0, -0.35, 0.94]], [9, 2, [0, 0.4, 0.92]]] as const) {
    c.box(1, y, 32, h, { mat: slat, z: 1 + y * 0.05, bevel: 0.45, r: 0.3, n, tex: wood({ seed: y * 3, dir: 'h' }) });
  }
  for (const x of [3, 29]) {
    c.box(x, 3.6, 2, 11.4, { mat: iron, z: 0.6, bevel: 0.4 });
    c.capsule(x + 1, 13.4, x + (x < 10 ? -0.6 : 2.6), 15.5, 0.55, 0.65, { mat: iron, z: 0.7 });
    c.capsule(x + 1, 4.5, x + 1, 1.5, 0.45, 0.45, { mat: iron, z: 0.65 });
  }
  return fr(c.render({ outline: 'C', sep: true, ao: 0.3, shadow: 0.25, shadowMax: 1.5 }), 17, 16, d);
}

const TULIP_HD: readonly Ramp[] = [PAL_HD.red, PAL_HD.pink, PAL_HD.gold, PAL_HD.red, PAL_HD.orange, PAL_HD.pink];

/** A planter of swaying tulips (30 × 20, 4 frames, feet). */
export function tulipsHd(d: D): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const c = new HdCanvas(30, 20, d);
    const box = deco(c, PAL_HD.wood, { lo: 1, hi: 6, spec: 0.15 });
    const soil = face(c, PAL_HD.brown, { lo: 0, hi: 2 });
    const stem = deco(c, PAL_HD.green, { lo: 2, hi: 6 });
    const heads = TULIP_HD.map((r, i) => deco(c, r, { lo: i === 2 ? 3 : 2, hi: r.length - 2, spec: 0.3, shine: 14 }));
    c.box(1, 12, 28, 7, { mat: box, z: 1, bevel: 0.5, tex: wood({ seed: 3, dir: 'h', plank: 2.3 }) });
    c.box(1, 12, 28, 1, { mat: box, z: 1.3, bevel: 0.3, tone: 0.15 });
    c.box(2, 11.4, 26, 0.9, { mat: soil, z: 0.5 });
    for (let i = 0; i < 8; i++) {
      const x = 3 + i * 3 + (i % 2) + 0.5;
      const sway = Math.sin((f + i * 0.7) * (Math.PI / 2)) * 0.9;
      const top = 3 + (i % 3);
      const hx = x + sway;
      const hy = top + 1.6;
      c.stroke([[x, 12.2], [x + sway * 0.4, (12 + hy) / 2 + 1], [hx, hy + 1]], 0.28, 0.22, { mat: stem, z: 1.1 + i * 0.01 });
      // A long leaf blade from the soil.
      const side = i % 2 === 0 ? -1 : 1;
      c.stroke([[x, 11.8], [x + side * 1.2, 9.5], [x + side * 1.4 + sway * 0.5, 7.8]], 0.45, 0.1, { mat: stem, z: 1.15 + i * 0.01, tone: -0.05 });
      const hm = heads[i % heads.length];
      c.ellipsoid(hx, hy, 1.45, 1.6, {
        mat: hm,
        z: 1.6 + i * 0.01,
        tex: (s) => {
          // The cup's three petal tips at the top.
          if (s.v < -0.5) {
            const k = (s.u + 1) * 1.5;
            if (Math.abs(k - Math.round(k)) < 0.28 && Math.round(k) % 3 !== 0) return;
            if (s.v < -0.62) s.cut = true;
          }
          if (Math.abs(s.u) < 0.12 && s.v > -0.5) s.tone -= 0.12;
        },
      });
    }
    return fr(c.render({ outline: 'C', sep: true, ao: 0.25 }), 15, 20, d);
  });
}

// ============================================================================== the elm

/**
 * A big elm (104 × 136, feet): a furrowed trunk forking into branches; the canopy keeps the 1×
 * lobes (the same nine masses, places and radii, so the crown keeps its wide rounded outline).
 * Each mass is painted like the background elms (art-hd-bg-trees.ts `leafMass`): a deep inside,
 * then shelves of leaf clusters drawn bottom first, lit tops, dark undersides, notched leafy
 * edges, the crown's lower right in its own shade; the branches show in the deepest gaps.
 * Outline C round the whole tree (static facade decor).
 */
export function elmHd(d: D): Frame {
  const W = 104;
  const H = 136;
  const c = new HdCanvas(W, H, d);
  const bark = deco(c, PAL_HD.brown, { lo: 0, hi: 5, wrap: 0.15 });
  const barkTex = texAll(wood({ seed: 8, dir: 'v' }), grime(4, 0.5, 2.5), (s) => {
    if (Math.abs(noise2(s.x * 3, s.y * 0.35, 1, 6) - 0.5) < 0.07) s.tone -= 0.25;
  });
  // Trunk and the main branches (the 1× tapers), roots flaring at the foot.
  c.capsule(52.5, 135.5, 50.5, 60, 4.8, 2.6, { mat: bark, z: 2, tex: barkTex });
  c.ellipsoid(52.5, 134.5, 6.4, 2.2, { mat: bark, z: 2.1, tex: barkTex });
  const br: readonly (readonly [number, number, number, number, number, number])[] = [
    [50.5, 74.5, 30.5, 44.5, 2.2, 1.1],
    [52.5, 70.5, 76.5, 40.5, 2.2, 1.1],
    [51.5, 64.5, 52.5, 24.5, 2.2, 1.1],
    [40, 60, 22, 56, 1.1, 0.6],
    [64, 56, 86, 56, 1.1, 0.6],
    [52, 44, 40, 30, 1, 0.5],
    [52, 40, 66, 28, 1, 0.5],
  ];
  for (const [x0, y0, x1, y1, r0, r1] of br) c.capsule(x0, y0, x1, y1, r0, r1, { mat: bark, z: 3, tex: barkTex });
  const out = c.render({ outline: 'none', sep: false, ao: 0.2 });
  // The canopy: the 1× masses in the 1× order, on a canvas 8 px wider each side (no wrap).
  const blobs: readonly (readonly [number, number, number])[] = [
    [28, 44, 20], [52, 30, 24], [76, 44, 20], [40, 62, 18], [66, 62, 18], [52, 50, 22], [18, 60, 13], [88, 60, 13], [52, 14, 14],
  ];
  const M = 8;
  const k = new BgCanvas(W + M * 2, H, d);
  const leaf = idx(PAL_HD.green);
  const crown = { x: 52.5 + M, y: 42, r: 44 };
  blobs.forEach(([bx, by, r], m) => leafMass(k, bx + 0.5 + M, by + 0.5, r, leaf, 211 + m * 37, crown, 0.5 - (by - 14) / 48 * 0.3));
  const top = k.finish();
  // Over the wood: leaves everywhere, except the deepest gaps, where a branch behind shows.
  const deep0 = PAL_HD.green[1] >>> 0;
  const ow = out.w;
  const tw = top.w;
  const off = M * d;
  for (let Y = 0; Y < out.h; Y++) {
    for (let X = 0; X < ow; X++) {
      const t = top.data[Y * tw + X + off];
      if ((t & 255) === 0) continue;
      const i = Y * ow + X;
      if ((t >>> 0) === deep0 && (out.data[i] & 255) !== 0) continue;
      out.data[i] = t;
    }
  }
  return fr(outlineC(out.touch(), d), 52, H, d);
}

// ============================================================================== flags

/** The cloth wave of a 28 × 21 flag at frame f: vertical offset and slope at t ∈ 0..1. */
function wave(t: number, f: number): { dy: number; slope: number } {
  const a = t * Math.PI * 2 - f * (Math.PI / 2);
  return { dy: Math.sin(a) * 2 * t, slope: Math.cos(a) * 2 * t * Math.PI * 2 / 28 + Math.sin(a) * 2 / 28 };
}

/** A flag on a pole, waving (34 × 64, 4 frames, anchor (2, 64)); `bands` top to bottom. */
export function flagHd(d: D, bands: readonly Ramp[], crosses: boolean): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const c = new HdCanvas(34, 64, d);
    const pole = deco(c, PAL_HD.steel, { lo: 2, hi: 6, spec: 0.9, shine: 24 });
    const gold = deco(c, PAL_HD.gold, { lo: 2, hi: 6, spec: 1, shine: 20 });
    const mats = bands.map((r) => face(c, r, r === PAL_HD.snow ? { lo: 3, hi: 6, wrap: 0.25 } : r === PAL_HD.black ? { lo: 0, hi: 3, wrap: 0.25 } : r === PAL_HD.sky ? { lo: 0, hi: 3, wrap: 0.25 } : { lo: 2, hi: 6, wrap: 0.25 }));
    const xmat = face(c, PAL_HD.snow, { lo: 2, hi: 6, wrap: 0.25 });
    c.cylinder(1, 1.4, 2, 62.6, { mat: pole, z: 1 });
    c.ellipsoid(2, 0.9, 1.1, 0.9, { mat: gold, z: 1.2 });
    const fw = 28;
    const fh = 21;
    const bandH = fh / bands.length;
    c.plane(3, 0, fw, 30, {
      mat: mats[0],
      z: 0.8,
      mask: (x, y) => {
        const t = (x - 3) / fw;
        const yy = y - 3 - wave(t, f).dy;
        return yy >= 0 && yy < fh;
      },
      normal: (x, _y, n) => {
        const t = (x - 3) / fw;
        const a = t * Math.PI * 2 - f * (Math.PI / 2);
        // The cloth turns with the wave: the normal swings left / right with the slope.
        n[0] = -Math.cos(a) * 0.7 * Math.min(1, t * 2.5);
        n[1] = 0;
        n[2] = 1;
      },
      tex: (s) => {
        const t = (s.x - 3) / fw;
        const yy = s.y - 3 - wave(t, f).dy;
        const b = Math.min(bands.length - 1, Math.floor(yy / bandH));
        s.mat = mats[b];
        if (crosses) {
          for (const cx of [7, 14, 21]) {
            const xc = 3 + cx + 0.5;
            const yc = 3 + Math.floor(fh / 2) + 0.5;
            const dx = s.x - xc;
            const dy = yy + 3 - yc;
            if (Math.abs(dx) < 2.4 && Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.62) s.mat = xmat;
          }
        }
      },
    });
    return fr(c.render({ outline: 'C', sep: true, ao: 0.2 }), 2, 64, d);
  });
}

/** The small red pennant on the hot-dog stand pole (16 × 10, 4 frames, anchor (0, 1)). */
export function flagRedHd(d: D): Frame[] {
  return [0, 1, 2, 3].map((f) => {
    const c = new HdCanvas(16, 10, d);
    const red = face(c, PAL_HD.red, { lo: 2, hi: 6, wrap: 0.25 });
    c.plane(1, 0, 14, 10, {
      mat: red,
      z: 1,
      mask: (x, y) => {
        const dy = Math.sin(((x + f * 3.5) / 14) * Math.PI * 2) * ((x - 1) / 14) * 1.5;
        return y >= 1 + dy && y < 7 + dy;
      },
      normal: (x, _y, n) => {
        n[0] = -Math.cos(((x + f * 3.5) / 14) * Math.PI * 2) * 0.6 * ((x - 1) / 14);
        n[1] = 0;
        n[2] = 1;
      },
    });
    return fr(c.render({ outline: 'C', sep: false, ao: 0 }), 0, 1, d);
  });
}

// ============================================================================== smoke

/** Chimney smoke (20 × 40, 6 frames, feet at the chimney top): soft puffs rising and growing. */
export function smokeHd(d: D): Frame[] {
  return [0, 1, 2, 3, 4, 5].map((f) => {
    const c = new HdCanvas(20, 40, d);
    const light = face(c, PAL_HD.snow, { lo: 2, hi: 5, wrap: 0.55, amb: 0.3, gain: 0.7 });
    const grey = face(c, PAL_HD.stone, { lo: 4, hi: 6, wrap: 0.55, amb: 0.3, gain: 0.7 });
    const part = c.newPart();
    for (let k = 0; k < 5; k++) {
      const t = ((k * 6 + f) % 30) / 30;
      const y = 38.5 - t * 34;
      const x = 8.5 + Math.sin(t * 5 + k) * 3 + t * 6;
      const r = 1.2 + t * 3;
      // A billow of two or three soft lobes, frayed at the rim.
      for (const [ox, oy, rr] of [[0, 0, 1], [-0.45, 0.35, 0.7], [0.5, 0.3, 0.65]] as const) {
        if (rr < 1 && r < 2) continue;
        c.ellipsoid(x + ox * r, y + oy * r, r * rr, r * rr * 0.9, {
          mat: t > 0.6 ? light : grey,
          z: k * 0.1 + (rr === 1 ? 0.05 : 0),
          part,
          round: 0.55,
          tex: (s) => {
            if (s.u * s.u + s.v * s.v > 0.55 && noise2(s.x * 2, s.y * 2, 1, 9 + k) > 0.55) s.cut = true;
          },
        });
      }
    }
    return fr(c.render({ outline: 'none', sep: false, ao: 0 }), 10, 40, d);
  });
}

// ============================================================================== hot-dog stand

/** The hot-dog trailer (84 × 62, anchor (14, 62)); `front` keeps only the box below the counter. */
export function hotdogStandHd(d: D, front = false): Frame {
  const W = 84;
  const H = 62;
  const c = new HdCanvas(W, H, d);
  const white = deco(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.4, shine: 16 });
  const red = deco(c, PAL_HD.red, { lo: 3, hi: 6, spec: 0.3 });
  const blue = deco(c, PAL_HD.sky, { lo: 0, hi: 3, spec: 0.3 });
  const steel = deco(c, PAL_HD.steel, { lo: 2, hi: 6, spec: 0.9, shine: 22 });
  const tyre = deco(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.3 });
  const dark = face(c, PAL_HD.black, { lo: 0, hi: 2 });
  const bun = deco(c, PAL_HD.sand, { lo: 3, hi: 6 });
  const sausage = deco(c, PAL_HD.red, { lo: 2, hi: 5, spec: 0.6 });
  const card = face(c, PAL_HD.gold, { lo: 3, hi: 6 });
  const bx = 14;
  const bw = 64;
  const by = 12;
  const bh = 38;
  // Drawbar and the jockey wheel.
  c.capsule(2.5, by + bh - 1.5, bx + 0.5, by + bh - 5.5, 0.7, 0.7, { mat: steel, z: 0.5 });
  c.capsule(5.5, by + bh - 1, 5.5, H - 4, 0.45, 0.45, { mat: steel, z: 0.6 });
  c.ellipsoid(5.5, H - 2.5, 2, 2, { mat: tyre, z: 0.7 });
  // The box: white with rounded top corners; the flag print and the star field.
  const bp = c.newPart();
  c.box(bx, by, bw, bh, {
    mat: white,
    z: 1,
    part: bp,
    r: 3,
    bevel: 1.2,
    tex: (s) => {
      const x = s.x - bx;
      const y = s.y - by;
      if (x > 30 && x < bw - 1 && y > 2 && y < bh - 2 && x + (bh - y) * 0.8 >= 46 && !(y >= bh - 13 && x < bw / 2 + 18)) {
        const k = Math.floor((x + y * 1.2) / 4);
        if (k % 2 === 0) s.mat = red;
      }
      if (x >= 2 && x < 17 && y >= 2 && y < 14) s.mat = blue;
    },
  });
  for (let y = by + 4; y < by + 13; y += 3) {
    for (let x = bx + 4 + ((y >> 1) & 1); x < bx + 16; x += 3) {
      const sx = x + 0.5;
      const sy = y + 0.5;
      c.paint(sx - 0.7, sy - 0.7, 1.4, 1.4, (px, py) => (Math.abs(px - sx) + Math.abs(py - sy) < (d >= 4 ? 0.62 : 0.55) ? PAL_HD.snow[6] : 0));
    }
  }
  // The serving hatch with the flap propped open above.
  const hx0 = bx + 20;
  const hx1 = bx + 44;
  const hy0 = by + 5;
  const hy1 = by + 21;
  c.erase(hx0, hy0, hx1 - hx0 + 1, hy1 - hy0 + 1, () => true);
  c.box(hx0, hy0, hx1 - hx0 + 1, hy1 - hy0 + 1, { mat: dark, z: -1, tex: (s) => { s.tone = -0.2 + (s.y - hy0) * 0.02; } });
  c.box(hx0 + 2, hy0 + 3, 4, 3, { mat: steel, z: -0.6, bevel: 0.4 });
  c.box(hx1 - 7, hy0 + 2, 5, 2.4, { mat: card, z: -0.6, bevel: 0.3 });
  c.box(hx0 - 1, hy0 - 1, hx1 - hx0 + 3, 1, { mat: steel, z: 1.4, bevel: 0.3 });
  c.box(hx0 - 1, hy0 - 1, 1, hy1 - hy0 + 2, { mat: steel, z: 1.4, bevel: 0.3 });
  c.box(hx1 + 1, hy0 - 1, 1, hy1 - hy0 + 2, { mat: steel, z: 1.4, bevel: 0.3 });
  c.poly([[hx0 - 2, hy0 - 1.5], [hx1 + 3, hy0 - 1.5], [hx1 + 5.5, hy0 - 9], [hx0 + 1, hy0 - 9]], { mat: white, z: 2, n: [0, -0.6, 0.8] });
  c.capsule(hx1 + 2.5, hy0 - 2, hx1 + 4.5, hy0 - 8, 0.3, 0.3, { mat: steel, z: 2.2 });
  c.box(hx0 - 1.5, hy1 + 1, hx1 - hx0 + 4, 2, { mat: steel, z: 2, bevel: 0.5, n: [0, -0.5, 0.86] });
  // HOTDOGS in blue capitals with a white edge, the painted hot dog.
  const k = textMask('HOTDOGS', 'small');
  const tx = bx + bw / 2 - 6 - k.w / 2 + 0.5;
  const ty = by + bh - 11;
  c.paint(tx - 1, ty - 1, k.w + 2, k.h + 2, (px, py) => {
    for (const [ox, oy] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5], [0.5, 0.5]] as const) {
      const lx = px - tx + ox;
      const ly = py - ty + oy;
      if (lx >= 0 && ly >= 0 && lx < k.w && ly < k.h && k.m[Math.floor(ly) * k.w + Math.floor(lx)]) return PAL_HD.snow[6];
    }
    return 0;
  });
  lettering(c, k, tx, ty, { ramp: PAL_HD.sky, lo: 0, hi: 3 });
  const hx = bx + 46;
  const hy = by + 15;
  c.box(hx, hy, 16, 6, { mat: bun, z: 1.6, r: 2.8, bevel: 1.2 });
  c.capsule(hx + 2, hy + 2.4, hx + 14, hy + 2.4, 1.4, 1.4, { mat: sausage, z: 2 });
  c.paint(hx + 2, hy + 1, 12, 2.5, (px, py) => (Math.abs(py - (hy + 2 + Math.sin(px * 2.4) * 0.6)) < 0.3 ? PAL_HD.gold[6] : 0));
  // Wheels, the chassis and its shadow; the roof vent and the flag pole.
  c.box(bx + 4, by + bh, bw - 8, 2, { mat: dark, z: 0.4 });
  c.box(bx + 10, by + bh, 30, 3, { mat: dark, z: 0.45 });
  for (const wx of [bx + 18.5, bx + 30.5]) {
    const wy = H - 5.5;
    c.plane(wx - 5.5, wy - 5.5, 11, 11, {
      mat: tyre,
      z: 1.5,
      mask: (px, py) => Math.hypot(px - wx, py - wy) <= 5.45,
      normal: (px, py, n) => {
        const q = Math.hypot(px - wx, py - wy) || 1;
        const k = q > 4.2 ? (q - 4.2) / 1.25 : q < 2.6 && q > 2.2 ? -0.6 : 0;
        n[0] = ((px - wx) / q) * k;
        n[1] = ((py - wy) / q) * k;
        n[2] = 1;
      },
      tex: (s) => {
        if (Math.hypot(s.x - wx, s.y - wy) < 3.8) s.tone -= 0.15;
      },
    });
    c.ellipsoid(wx, wy, 2.3, 2.3, { mat: steel, z: 1.9, round: 0.5 });
    c.ellipsoid(wx, wy, 0.7, 0.7, { mat: steel, z: 2.1, round: 0.8, tone: -0.2 });
  }
  c.box(bx + 40, by - 3, 8, 3.2, { mat: steel, z: 0.8, bevel: 0.5, r: 0.4 });
  c.cylinder(bx + bw - 8.5, 0, 1, by, { mat: steel, z: 0.6 });
  if (front) c.erase(0, 0, W, 34, () => true);
  return fr(c.render({ outline: 'C', sep: true, ao: 0.3, shadow: 0.25, shadowMax: 2 }), bx, H, d);
}

/** A grey utility cabinet with tags and stickers (22 × 30, feet). */
export function cabinetHd(d: D): Frame {
  const c = new HdCanvas(22, 30, d);
  const metal = deco(c, PAL_HD.stone, { lo: 2, hi: 6, spec: 0.3, shine: 12 });
  const pink = PAL_HD.pink[3];
  const black = PAL_HD.black[1];
  c.box(1, 3, 20, 26, { mat: metal, z: 1, bevel: 0.5, tex: texAll(grime(31, 0.45, 4), plaster({ seed: 3, cracks: 0, stains: 0.6 })) });
  c.box(0, 1, 22, 3, { mat: metal, z: 1.5, bevel: 0.6, n: [0, -0.4, 0.92] });
  c.shade(10.8, 4, 0.5, 23, () => -0.5);
  c.box(1, 27, 20, 2, { mat: metal, z: 1.2, tone: -0.3 });
  // Graffiti tags (our own squiggles), a teal ring, stickers.
  const tag = (pts: readonly P[], col: Color, w: number): void => {
    c.paint(2, 4, 18, 22, (x, y) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx2, by2] = pts[i + 1];
        const vx = bx2 - ax;
        const vy = by2 - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
        if (Math.hypot(x - ax - vx * t, y - ay - vy * t) < w) return col;
      }
      return 0;
    });
  };
  tag([[3.5, 9.5], [7.5, 6.5], [8.5, 11.5], [13.5, 7.5], [17.5, 12.5]], pink, 0.45);
  tag([[4.5, 18.5], [9.5, 15.5], [10.5, 20.5], [15.5, 16.5]], black, 0.4);
  c.paint(14, 19, 5, 5, (x, y) => (Math.abs(Math.hypot(x - 16.5, y - 21.5) - 1.8) < 0.35 ? PAL_HD.teal[4] : 0));
  c.paint(3, 22, 4, 3, () => PAL_HD.gold[6]);
  c.paint(13, 13, 3, 4, (_x, y) => (y < 14 ? PAL_HD.red[5] : PAL_HD.snow[6]));
  return fr(c.render({ outline: 'C', sep: true, ao: 0.25 }), 11, 30, d);
}

// ============================================================================== awnings, balustrade

const AWNING_HD: readonly (readonly [Ramp, Ramp])[] = AWNING_SETS.map(([a, b]) => [rampOf(a, PAL_HD.green), b === PAL.snow[3] ? PAL_HD.snow : rampOf(b, PAL_HD.gold)]);

/** A striped shop awning `w` wide (a platform; (w + 2) × 18, 4 colour sets, anchor (1, 1)). */
export function awningHd(w: number, d: D): Frame[] {
  return AWNING_HD.map(([ra, rb]) => {
    const c = new HdCanvas(w + 2, 18, d);
    const a = face(c, ra, { lo: 1, hi: ra.length - 2, wrap: 0.25, spec: 0.1 });
    const b = face(c, rb, { lo: rb === PAL_HD.snow ? 2 : 2, hi: rb.length - 2, wrap: 0.25, spec: 0.1 });
    const top = deco(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.4 });
    const iron = deco(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.5 });
    const stripe = (x: number): number => (Math.floor((x - 1) / 6) % 2 === 0 ? a : b);
    // The sloping canvas (seen from the front and a little below its top), with sag between ribs.
    c.plane(1, 1, w, 8, {
      mat: a,
      z: 1,
      normal: (_x, y, n) => {
        n[0] = 0;
        n[1] = -0.55 + (y - 1) * 0.06;
        n[2] = 0.83;
      },
      tex: (s) => {
        s.mat = stripe(Math.floor(s.x));
        const f = ((s.x - 1) % 6) / 6;
        s.nx += Math.sin(f * Math.PI * 2) * 0.12;
        s.tone -= (s.y - 1) * 0.02;
      },
    });
    // Scalloped valance flaps, one per stripe.
    c.plane(1, 9, w, 1.6, {
      mat: a,
      z: 1.2,
      mask: (x, y) => {
        const f = ((x - 1) % 6) / 6;
        if (f > 5 / 6) return false;
        return y - 9 < 1 - Math.abs(f * 1.2 - 0.5) * 0.9;
      },
      normal: (_x, _y, n) => {
        n[0] = 0;
        n[1] = 0.25;
        n[2] = 0.97;
      },
      tex: (s) => {
        s.mat = stripe(Math.floor(s.x));
      },
    });
    c.box(1, 0.8, w, 1.3, { mat: top, z: 1.5, bevel: 0.45, r: 0.3 });
    c.box(1, 8.2, w, 0.8, { mat: iron, z: 1.3, tone: 0.1 });
    c.capsule(3.5, 10.5, 8.5, 16.5, 0.45, 0.45, { mat: iron, z: 0.8 });
    c.capsule(w - 1.5, 10.5, w - 6.5, 16.5, 0.45, 0.45, { mat: iron, z: 0.8 });
    return fr(c.render({ outline: 'C', sep: true, ao: 0.25, shadow: 0.2, shadowMax: 1.5 }), 1, 1, d);
  });
}

/** A stone balustrade `w` wide ((w + 2) × 18, feet): rails and vase balusters. */
export function balustradeHd(w: number, d: D): Frame {
  const c = new HdCanvas(w + 2, 18, d);
  const stone = deco(c, PAL_HD.stone, { lo: 2, hi: 7, wrap: 0.1 });
  const tex = plaster({ seed: 7, cracks: 0.3, stains: 0.5 });
  c.box(1, 1, w, 3, { mat: stone, z: 1.5, bevel: 0.6, tex });
  c.box(0.6, 3.4, w + 0.8, 0.8, { mat: stone, z: 1.4, tone: -0.15 });
  for (let x = 3; x < w - 1; x += 5) {
    const cx = x + 1.5;
    c.heightField(x - 0.3, 4.2, 3.6, 10.8, (px, py) => {
      const t = (py - 4.2) / 10.8;
      // A vase profile: narrow neck, round belly, a foot.
      const r = 0.75 + 0.85 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 1.4 + (t > 0.9 ? 0.4 : 0) + (t < 0.08 ? 0.5 : 0);
      const q = Math.abs(px - cx);
      return q > r ? NaN : Math.sqrt(r * r - q * q);
    }, { mat: stone, z: 1, tex });
  }
  c.box(1, 15, w, 3, { mat: stone, z: 1.5, bevel: 0.6, tex });
  return fr(c.render({ outline: 'C', sep: true, ao: 0.3, shadow: 0.2, shadowMax: 1.5 }), (w + 2) >> 1, 18, d);
}

