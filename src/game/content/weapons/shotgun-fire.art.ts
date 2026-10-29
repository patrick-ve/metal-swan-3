/**
 * Art of the shotgun's fire blast (shotgun-fire.ts; picked by the user on 2026-10-29 from five
 * looks). All fire ids are anchored at the muzzle (the anchor pixel's top-left corner is the muzzle
 * point) and point right (`…`) or up (`…-up`); flipX / flipY give left and down.
 *
 * - `fx/shotgun-fire` / `fx/shotgun-fire-up`: one big fire blast, 11 frames over 16 ticks
 *   (`FIRE_DURATIONS`), 10 % longer than the damage cone: t0 a white-hot burst that already
 *   reaches half the cone; t1–t5 the full blast (white-hot core at the muzzle, yellow, orange, a
 *   dark red ragged rim, flame tongues licking past the tip, heat bands across the shot); t6–t15 it
 *   tears into five fire puffs that drift forward and up, shrink and darken.
 * - `fx/muzzle-shotgun` / `-up` / `-diag`: the shotgun's muzzle flash, a bloom on the barrel (3
 *   frames, additive, follows the gun; `-diag` points up-right for the vehicles' diagonal aims).
 * - `fx/shotgun-smoke`: a grey-brown smoke puff that swells, frays and thins (8 frames).
 * - `fx/shotgun-ember`: a burning ember (a particle sprite, 26 frames × 3 ticks): a white-hot coal
 *   with a flame lick while it flies (frames 0–7), then a smouldering coal — a dark crust with
 *   glowing cracks that pulse and dim — and at the end grey ash with one red spark.
 * - `fx/shotgun-cloud`: a big dark smoke puff (12 frames × 5 ticks): soot-black round puffs that
 *   swell, lift and fray.
 * - `fx/shotgun-glow`: warm light pooled on the floor under the cone (4 frames, additive): an
 *   ellipse of ember tones in ordered-dither bands, dimmer each frame.
 *
 * The fire is a set of cauliflower billows (`paintBillows`) in a flat fire material whose tone is
 * the heat: lobes (one part per puff, so crimson crevices show where they overlap) that later tear
 * apart into the five puffs. The SAME drawer makes the 1× art (an HdCanvas at d = 1: the fire
 * ramp, its crevice tone and the ember rim are PAL colours) and the 2× / 4× art; at 2× / 4× the
 * rim breaks into ragged dashes. Every id has 1× art (PAL) and 2× / 4× art (PAL_HD) from one drawer.
 */
import type { Color } from '../../../engine/color';
import { PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import type { TexSample } from '../../art/hd/index';
import { EMBER, HdCanvas, NoiseGrid, cellBayer, fireMat, frayCut, hash, lambert, noise, paintBillows, sat, type Billow } from '../fx/hd/kit';
import { drawGlows, Xf, type Glow } from '../fx/hd/shapes';

// ------------------------------------------------------------------------------------ geometry

/** The damage cone's length (`SHOTGUN.length`): the fire's nominal reach. */
export const CONE_REACH = 72;

/** The fire's shape: its length, width and heat against the cone, and its frame geometry. */
export interface FireStyle {
  /** Sprite id base: `<id>` points right, `<id>-up` points up. */
  readonly id: string;
  /** Length scale of the fire (1 = the cone). */
  readonly len: number;
  /** Width scale of the fire (across the shot). */
  readonly wide: number;
  /** Heat bonus (tone units). */
  readonly hot: number;
  /** Seed of the lumps and the turbulence. */
  readonly seed: number;
  /** Frame size pointing right (logical px) and the muzzle point in it. */
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
}

/** The shotgun's fire: 10 % longer than the cone, a little wider, hot (more white and yellow). */
export const FIRE_STYLE: FireStyle = { id: 'fx/shotgun-fire', len: 1.1, wide: 1.06, hot: 0.08, seed: 23, w: 104, h: 64, ox: 4, oy: 32 };

/** Ticks per frame of the fire strip (11 frames, 16 ticks). */
export const FIRE_DURATIONS: readonly number[] = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2];
/** Ticks the fire strip lasts. */
export const FIRE_TICKS = FIRE_DURATIONS.reduce((a, b) => a + b, 0);

/** The frame of the fire strip at tick t since the shot (−1: over). */
export function fireFrameAt(t: number): number {
  let acc = 0;
  for (let i = 0; i < FIRE_DURATIONS.length; i++) {
    acc += FIRE_DURATIONS[i];
    if (t < acc) return i;
  }
  return -1;
}

/** Up-frame geometry of a style: the right-pointing frame turned a quarter counter-clockwise. */
export function upGeom(s: FireStyle): { w: number; h: number; ox: number; oy: number } {
  return { w: s.h, h: s.w, ox: s.oy, oy: s.w - s.ox };
}

/** One lobe of the fire at its peak (local u along the shot, v across, + = down). */
interface Lobe {
  readonly u: number;
  readonly v: number;
  readonly r: number;
  /** The puff it tears into. */
  readonly g: number;
}

const LOBES: readonly Lobe[] = [
  { u: 1.5, v: 0, r: 4.6, g: 0 },
  { u: 5, v: 0, r: 6.2, g: 0 },
  { u: 13, v: 0.5, r: 8, g: 0 },
  { u: 22, v: -2.5, r: 9.5, g: 1 },
  { u: 26, v: 4, r: 8.5, g: 1 },
  { u: 35, v: -0.5, r: 11.5, g: 1 },
  { u: 45, v: -8, r: 11, g: 2 },
  { u: 47, v: 8, r: 10.5, g: 3 },
  { u: 57, v: 0, r: 12.5, g: 4 },
  { u: 62, v: -13, r: 8.5, g: 2 },
  { u: 63, v: 13.5, r: 8.5, g: 3 },
  { u: 68, v: 1, r: 10, g: 4 },
];

/**
 * The five puffs the fire tears into: where they gather (u, v), their radius, how far they drift
 * (du forward, dv up) by the end, the base depth (larger = nearer) and the heat they keep.
 */
interface Puff {
  readonly u: number;
  readonly v: number;
  readonly r: number;
  readonly du: number;
  readonly dv: number;
  readonly z: number;
  readonly keep: number;
}

const PUFFS: readonly Puff[] = [
  { u: 10, v: -1, r: 6, du: 3, dv: -3, z: 3, keep: 0.75 },
  { u: 29, v: 0, r: 9.5, du: 6, dv: -6, z: 6, keep: 0.95 },
  { u: 50, v: -11, r: 9, du: 8, dv: -8, z: 1, keep: 0.9 },
  { u: 52, v: 11, r: 8.5, du: 9, dv: -5, z: 4, keep: 0.9 },
  { u: 64, v: 0, r: 10.5, du: 11, dv: -7, z: 8, keep: 1 },
];

/** Puff count (the smoke puffs rise where they die). */
export const FIRE_PUFFS = PUFFS.length;

/** Per-frame keys: k = growth (1 = the cone), heat, tear (0 = one blast, 1 = five puffs), tongue length, rim erosion. */
interface Key {
  readonly k: number;
  readonly heat: number;
  readonly tear: number;
  readonly tongue: number;
  readonly erode: number;
}

const KEYS: readonly Key[] = [
  { k: 0.52, heat: 0.12, tear: 0, tongue: 0.45, erode: 0 }, // t0: the white-hot burst
  { k: 0.78, heat: 0.1, tear: 0, tongue: 0.7, erode: 0 }, // t1
  { k: 0.93, heat: 0.1, tear: 0, tongue: 0.9, erode: 0 }, // t2: the full blast
  { k: 1.0, heat: 0.05, tear: 0, tongue: 1, erode: 0 }, // t3
  { k: 1.04, heat: 0.0, tear: 0, tongue: 1.1, erode: 0 }, // t4: the peak
  { k: 1.07, heat: -0.06, tear: 0.04, tongue: 1, erode: 0.06 }, // t5
  { k: 1.1, heat: -0.14, tear: 0.16, tongue: 0.7, erode: 0.14 }, // t6–7: cooling, the rim breaks
  { k: 1.12, heat: -0.24, tear: 0.42, tongue: 0.3, erode: 0.22 }, // t8–9: tearing
  { k: 1.14, heat: -0.36, tear: 0.7, tongue: 0, erode: 0.3 }, // t10–11: five puffs
  { k: 1.16, heat: -0.5, tear: 0.88, tongue: 0, erode: 0.4 }, // t12–13
  { k: 1.18, heat: -0.64, tear: 1, tongue: 0, erode: 0.52 }, // t14–15: dark red, dying
];

const smooth = (x: number): number => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A puff's centre and radius at tear τ (local, style-scaled). */
function puffAt(s: FireStyle, p: Puff, tear: number): [number, number, number] {
  const late = sat((tear - 0.45) / 0.55);
  return [p.u * s.len + p.du * s.len * tear, p.v * s.wide + p.dv * tear, p.r * Math.sqrt(s.len) * (1 - 0.42 * late * late)];
}

/**
 * Where the five puffs are at the end of the fire strip (local u, v, r; style-scaled): the smoke
 * puffs rise from there.
 */
export function firePuffEnd(s: FireStyle, i: number): [number, number, number] {
  return puffAt(s, PUFFS[i], 1);
}

/** A local billow (u, v, r) of frame `i`, with its part group. */
interface LocalBillow {
  u: number;
  v: number;
  r: number;
  g: number;
  seed: number;
}

/** The billows of frame i (local coordinates). */
function billowsOf(s: FireStyle, i: number): LocalBillow[] {
  const K = KEYS[i];
  const te = smooth(K.tear);
  const out: LocalBillow[] = [];
  LOBES.forEach((l, j) => {
    const p = PUFFS[l.g];
    // The near-muzzle puff dies first.
    if (l.g === 0 && K.tear > 0.8) return;
    const bu = l.u * K.k * s.len;
    const bv = l.v * (0.42 + 0.58 * Math.min(1, K.k)) * s.wide;
    const br = l.r * (0.58 + 0.42 * Math.min(1, K.k)) * Math.sqrt(s.len);
    const [pu, pv, pr] = puffAt(s, p, K.tear);
    // Billows of one puff gather on its centre and shrink to its size (a lump of the puff each).
    const gr = pr * (0.62 + 0.1 * hash(j, 3, s.seed));
    const ang = hash(j, 7, s.seed) * Math.PI * 2;
    const off = pr * 0.32 * (1 - te * 0.4);
    out.push({
      u: lerp(bu, pu + Math.cos(ang) * off, te),
      v: lerp(bv, pv + Math.sin(ang) * off, te),
      r: lerp(br, gr, te) * (l.g === 0 ? 1 - 0.5 * sat(K.tear / 0.8) : 1),
      g: l.g,
      // The lumps boil: a new arrangement every frame.
      seed: s.seed * 131 + j * 13 + i * 7,
    });
  });
  return out;
}

/** A flame tongue at the far edge: base (u, v), direction, length, base radius. */
interface Tongue {
  pts: Array<[number, number]>;
  len: number;
  r0: number;
}

/**
 * The tongues of frame i (local): a crown of flames licking forward from the front, and swept
 * licks on the upper and lower edges, all pointing along the shot and swaying per frame.
 */
function tonguesOf(s: FireStyle, i: number): Tongue[] {
  const K = KEYS[i];
  if (K.tongue <= 0) return [];
  const out: Tongue[] = [];
  const add = (bu: number, bv: number, a: number, len: number, r0: number, j: number): void => {
    // An S-curl: the body bows one way, the tip flicks back (a new curl every frame).
    const bow = (hash(j, i, s.seed + 13) - 0.5) * 0.5 * len;
    const flick = (hash(j, i, s.seed + 15) - 0.5) * 0.35 * len;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      const side = bow * Math.sin(Math.PI * f) + flick * f * f * f;
      pts.push([bu + ca * len * f - sa * side, bv + sa * len * f + ca * side]);
    }
    out.push({ pts, len, r0 });
  };
  const g = Math.min(1, K.k);
  const sl = Math.sqrt(s.len);
  // The crown: five flames out of the front lobes.
  const n = 5;
  for (let j = 0; j < n; j++) {
    const a = (j / (n - 1) - 0.5) * 1.1 + (hash(j, i, s.seed + 5) - 0.5) * 0.16;
    const bu = (62 + 6 * Math.cos(a * 1.6)) * K.k * s.len;
    const bv = Math.sin(a) * 17 * g * s.wide;
    const len = (8 + 6 * hash(j, i >> 1, s.seed + 9) + (j === 2 ? 3 : 0)) * K.tongue * s.len;
    add(bu, bv, a * 1.2, len, (3.6 + 0.9 * hash(j, 2, s.seed)) * sl * Math.min(1, 0.6 + K.tongue * 0.4), j);
  }
  // Swept licks on the edges: forward and out, shorter.
  for (let j = 0; j < 4; j++) {
    const side = j % 2 === 0 ? -1 : 1;
    const bu = (j < 2 ? 36 : 50) * K.k * s.len;
    const bv = side * (j < 2 ? 10 : 15) * g * s.wide;
    const len = (5 + 3 * hash(j, i >> 1, s.seed + 19)) * K.tongue * s.len;
    add(bu, bv, side * (0.5 + 0.2 * hash(j, i, s.seed + 21)), len, (2.6 + 0.6 * hash(j, 4, s.seed)) * sl, j + 10);
  }
  return out;
}

/** Heat (0..1+) of the fire along the shot at local u (frame i, before light and turbulence). */
function heatAlong(s: FireStyle, u: number, v = 0): number {
  const a = u / (CONE_REACH * s.len);
  const c = a < 0 ? 0 : a > 1.25 ? 1.25 : a;
  // A hotter streak along the axis: the bands bow forward in the middle (the blast's thrust).
  const hw = (6 + 11 * c) * s.wide;
  const core = 0.18 * Math.exp(-(v * v) / (hw * hw)) * (1 - c * 0.6);
  return 0.82 - 0.5 * c + core;
}

// ------------------------------------------------------------------------------------ the fire

/** Draw fire frame i on c (fwd or up), returns the buffer. Works at d = 1 (PAL) and d = 2 / 4. */
function fireFrame(c: HdCanvas, s: FireStyle, i: number, up: boolean): PixelBuffer {
  const K = KEYS[i];
  const xf = up ? Xf.up(s.w, s.ox, s.oy) : Xf.at(s.ox, s.oy);
  const fire = fireMat(c);
  const te = smooth(K.tear);
  const lbs = billowsOf(s, i);
  const parts = PUFFS.map(() => c.newPart());
  const billows: Billow[] = lbs.map((b) => {
    const [x, y] = xf.pt(b.u, b.v);
    return { x, y, r: b.r, seed: b.seed, z: PUFFS[b.g].z, part: parts[b.g] };
  });
  // Turbulence: soft heat swirls that boil every frame (and rise as the fire ages).
  const n = new NoiseGrid(c.w, c.h, 4.5 * Math.sqrt(s.len), s.seed * 17 + i * 5);
  const ero = K.erode > 0 ? new NoiseGrid(c.w, c.h, 3.2, s.seed * 23 + i) : null;
  const hot = K.heat + s.hot;
  // Tongues first (behind the lobes): tapered curls, hot at the base, red at the tip.
  const tp = c.newPart();
  for (const t of tonguesOf(s, i)) {
    const pts = t.pts.map(([u, v]) => xf.pt(u, v));
    const [bu, bv] = t.pts[0];
    const hb = heatAlong(s, bu, bv) + hot;
    c.stroke(pts, t.r0, 0.3, {
      mat: fire,
      part: tp,
      z: -3,
      tex: (q: TexSample) => {
        const [u, v] = xf.inv(q.x, q.y);
        const f = Math.min(1, Math.hypot(u - bu, v - bv) / t.len);
        q.tone = Math.min(0.999, hb - 0.04 - 0.42 * f * f + n.at(q.x, q.y) * 0.25 - 0.12 * q.v * q.v) - 0.5;
      },
    });
  }
  paintBillows(
    c,
    billows,
    K.erode,
    (q, k, d) => {
      const b = lbs[k];
      const [u, v] = xf.inv(q.x, q.y);
      const p = PUFFS[b.g];
      const along = heatAlong(s, u, v);
      // A torn puff keeps a hot core and cools at its rim.
      const puff = 0.3 + 0.36 * p.keep * (1 - d * d);
      const base = lerp(along, puff, te) + hot;
      const lam = lambert(q.nx, q.ny, q.nz);
      const tn = n.at(q.x, q.y);
      q.mat = fire;
      // Every lump cools toward its rim: a white core rimmed pale yellow, an orange body rimmed red.
      q.tone = Math.min(0.999, base + lam * 0.3 - 0.1 + tn * 0.34 - d * d * (0.3 + 0.2 * te)) - 0.5;
    },
    ero ? (q, x, y) => q > 1.05 - K.erode * 0.55 + ero.at(x, y) * 0.5 : undefined,
  );
  // The rim: deep ember, darker as the puffs die (ink at 1× stays a PAL colour).
  const ink: Color = c.d === 1 ? EMBER : K.tear > 0.8 ? PAL_HD.red[0] : EMBER;
  const out = c.render({ outline: 'A', ink, ao: 0, sep: false, clean: true });
  if (c.d >= 2) raggedRim(out, ink, c.d, s.seed + i);
  return out;
}

/**
 * Break the rim of colour `ink` into ragged dashes on logical cells (a flame edge, not a drawn
 * line), keeping only the dashes that touch the body.
 */
function raggedRim(out: PixelBuffer, ink: Color, d: number, seed: number): void {
  const data = out.data;
  const W = out.w;
  const H = out.h;
  for (let p = 0; p < data.length; p++) {
    if (data[p] !== ink) continue;
    const X = p % W;
    const Y = (p / W) | 0;
    if (hash(Math.floor(X / d), Math.floor(Y / d), seed + 17) > 0.6) data[p] = 0;
  }
  // Drop ink px that no longer reach the body through ink (orphan specks).
  const keep = new Uint8Array(data.length);
  const stack: number[] = [];
  for (let p = 0; p < data.length; p++) {
    if (data[p] !== ink) continue;
    const X = p % W;
    const touches =
      (X > 0 && data[p - 1] !== 0 && data[p - 1] !== ink) ||
      (X < W - 1 && data[p + 1] !== 0 && data[p + 1] !== ink) ||
      (p >= W && data[p - W] !== 0 && data[p - W] !== ink) ||
      (p < data.length - W && data[p + W] !== 0 && data[p + W] !== ink);
    if (touches) {
      keep[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop() as number;
    const X = p % W;
    const Y = (p / W) | 0;
    const next = [X > 0 ? p - 1 : -1, X < W - 1 ? p + 1 : -1, Y > 0 ? p - W : -1, Y < H - 1 ? p + W : -1];
    for (const q of next) {
      if (q < 0 || keep[q] || data[q] !== ink) continue;
      keep[q] = 1;
      stack.push(q);
    }
  }
  for (let p = 0; p < data.length; p++) if (data[p] === ink && !keep[p]) data[p] = 0;
  out.touch();
}

/** The fire strip of a style at density d (1, 2 or 4), pointing right or up. */
export function fireFrames(s: FireStyle, up: boolean, d: number): Frame[] {
  const g = up ? upGeom(s) : s;
  return KEYS.map((_, i) => {
    const c = new HdCanvas(g.w, g.h, d);
    const buf = fireFrame(c, s, i, up);
    return d === 1 ? { buf, ox: g.ox, oy: g.oy } : { buf, ox: g.ox, oy: g.oy, density: d };
  });
}

// ------------------------------------------------------------------------------------ the bloom

/** The shotgun's flash family (GDD §15.6 `fx/muzzle-<weapon>`): `muzzleFlash` picks the turn. */
export const BLOOM_ID = 'fx/muzzle-shotgun';
/** Bloom frame (right-pointing): 22 × 22, the muzzle at (8, 11). */
const BW = 22;
const BH = 22;
const BOX = 8;
const BOY = 11;
export const BLOOM_DURATIONS: readonly number[] = [1, 1, 2];

/** The bloom on the barrel: a white-hot ball on the muzzle in a wide glow, four short thick rays. */
function bloomGlows(i: number): Glow[] {
  const k = [1, 0.74, 0.48][i];
  const g: Glow[] = [
    { k: 'blob', u: 1.5, v: 0, ru: 7 * k, rv: 6.3 * k, h: 0.5 + 0.12 * k, fall: 0.5 },
    { k: 'blob', u: 1.8, v: 0, ru: 4.4 * k + 0.5, rv: 3.8 * k + 0.5, h: 1.12, fall: 0.32 },
  ];
  if (i < 2) {
    for (const sv of [-1, 1]) {
      g.push({ k: 'spike', u0: 1.5, v0: sv * 1.5, u1: -3 * k, v1: sv * 10 * k, r0: 1.7 * k, r1: 0.35, h0: 0.95, h1: 0.5 });
      g.push({ k: 'spike', u0: 2.5, v0: sv * 1.5, u1: 9.5 * k, v1: sv * 9.5 * k, r0: 1.6 * k, r1: 0.35, h0: 0.92, h1: 0.45 });
    }
  }
  return g;
}

/** Diagonal bloom frame: 30 × 30, the right-pointing frame turned 45° up about its centre. */
const BD = 30;

function bloomFrames(turn: 'fwd' | 'up' | 'diag', d: number): Frame[] {
  return [0, 1, 2].map((i) => {
    const diag = turn === 'diag';
    const up = turn === 'up';
    const w = diag ? BD : up ? BH : BW;
    const h = diag ? BD : up ? BW : BH;
    // The muzzle point in the turned frame (diagonal: the base turned with the frame, rounded).
    const dm = (BW / 2 - BOX) * Math.SQRT1_2;
    const ox = diag ? Math.round(BD / 2 - dm) : up ? BOY : BOX;
    const oy = diag ? Math.round(BD / 2 + dm) : up ? BW - BOX : BOY;
    const c = new HdCanvas(w, h, d);
    const xf = diag ? Xf.turn(-Math.PI / 4, BW, BH, BOX, BOY, BD, BD) : up ? Xf.up(BW, BOX, BOY) : Xf.at(BOX, BOY);
    drawGlows(c, xf, bloomGlows(i), { glow: fireMat(c), part: c.newPart() });
    const buf = c.render({ outline: 'A', ink: d === 1 ? PAL.red[1] : PAL_HD.red[2], ao: 0, sep: false, clean: true });
    return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
  });
}

// ------------------------------------------------------------------------------------ smoke

export const SMOKE_ID = 'fx/shotgun-smoke';
/** Ticks per smoke frame (8 frames). */
export const SMOKE_TPF = 2;
export const SMOKE_FRAMES = 8;
const SW = 26;

/**
 * A grey-brown smoke puff: a soft, low-contrast volume of a few billows that swells, lifts and
 * frays at the rim (ordered 2 × 2-cell fray, no outline: gas, not a rock). Drawn translucent.
 */
function smokeFrames(d: number): Frame[] {
  // Warm grey with a brown deep tone (soot from the fire).
  const ramp: Ramp = d === 1 ? [PAL.brown[0], PAL.stone[0], PAL.stone[1], PAL.stone[2]] : [PAL_HD.brown[1], PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4]];
  return Array.from({ length: SMOKE_FRAMES }, (_, i) => {
    const t = i / (SMOKE_FRAMES - 1);
    const c = new HdCanvas(SW, SW, d);
    const smoke = c.material({ ramp, lo: 0, hi: ramp.length - 1, wrap: 0.45, bounce: 0.35, rim: 0.05, amb: 0.15 });
    const r = 4.4 + 5 * Math.sqrt(t);
    const cx = SW / 2;
    const cy = SW / 2 + 1.5 - t * 1.5;
    const fade = (d === 1 ? 0.05 : 0.12) + (d === 1 ? 0.35 : 0.5) * t;
    // A cluster of round puffs (one surface): a big crown, two shoulders, a small tail.
    const puffs: Array<[number, number, number]> = [
      [cx - r * 0.5, cy + r * 0.3, r * 0.62],
      [cx + r * 0.52, cy + r * 0.26, r * 0.58],
      [cx + r * 0.08, cy - r * 0.18, r * 0.8],
      [cx - r * 0.18, cy + r * 0.42, r * 0.5],
    ];
    const part = c.newPart();
    const R = r * 1.25;
    puffs.forEach(([px, py, pr], k) => {
      c.ellipsoid(px, py, pr, pr, {
        mat: smoke,
        part,
        z: k * 0.4,
        tex: (q: TexSample) => {
          const qq = Math.hypot(q.x - cx, q.y - cy) / R;
          if (frayCut(Math.min(1, qq), fade, q.X, q.Y)) {
            q.cut = true;
            return;
          }
          // Flatter as it thins; sooty and dark while young, greyer as it spreads.
          const fl = 0.1 + 0.45 * t;
          q.nx *= 1 - fl;
          q.ny *= 1 - fl;
          q.nz = q.nz * (1 - fl) + fl;
          q.tone = -0.08 + t * 0.12;
        },
      });
    });
    const buf = c.render({ outline: 'none', ao: 0, sep: false, clean: true });
    const o = SW / 2;
    return d === 1 ? { buf, ox: o, oy: o } : { buf, ox: o, oy: o, density: d };
  });
}

const frame = (buf: Frame['buf'], ox: number, oy: number, d: number): Frame => (d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d });

// ------------------------------------------------------------------------------------ embers

export const EMBER_ID = 'fx/shotgun-ember';
export const EMBER_FRAMES = 26;
export const EMBER_TPF = 3;
/** Frames of the burning (flying) phase. */
const BURN = 8;
const EW = 9;

/** One ember frame: burning coal with a flame lick, then a smouldering coal, then ash. */
function emberFrame(i: number, d: number): Frame {
  const c = new HdCanvas(EW, EW, d);
  const fire = fireMat(c);
  const crustRamp: Ramp = d === 1 ? PAL.brown : PAL_HD.brown.slice(0, 6);
  const ashRamp: Ramp = d === 1 ? PAL.stone.slice(0, 3) : PAL_HD.stone.slice(1, 4);
  const cx = 4.5;
  if (i < BURN) {
    // Flying: a white-hot coal and a flame that licks up and back, flickering.
    const k = 1 - (i / BURN) * 0.25;
    const sway = (hash(i, 1, 5) - 0.5) * 1.4;
    const top = 0.9 + hash(i, 2, 5) * 1.1;
    const lick = c.newPart();
    c.capsule(cx, 5.2, cx + sway, top, 1.35 * k, 0.25, {
      mat: fire,
      part: lick,
      z: 0,
      tex: (s: TexSample) => {
        s.tone = sat(0.85 - 0.55 * s.u - 0.15 * s.v * s.v) * 0.999 - 0.5;
      },
    });
    c.ellipsoid(cx, 5.6, 1.7 * k, 1.45 * k, {
      mat: fire,
      part: lick,
      z: 2,
      tex: (s: TexSample) => {
        const q = s.u * s.u + s.v * s.v;
        s.tone = sat(1.12 - 0.55 * q + (s.nx < 0 && s.ny < 0 ? 0.1 : 0) - i * 0.03) * 0.999 - 0.5;
      },
    });
    return frame(c.render({ outline: 'A', ink: EMBER, ao: 0, sep: false, clean: true }), 4, 4, d);
  }
  const s = (i - BURN) / (EMBER_FRAMES - 1 - BURN);
  const ash = s > 0.82;
  const crust = c.material({ ramp: ash ? ashRamp : crustRamp, lo: 0, hi: (ash ? ashRamp : crustRamp).length - 1, spec: 0.2, shine: 12, wrap: 0.1 });
  // The glow pulses (a slow breath) and dies down.
  const pulse = (0.6 + 0.4 * Math.sin(i * 1.15)) * (1 - s) * (1 - s * 0.4);
  const part = c.newPart();
  // A flat coal lying on the floor: a crust with glowing cracks and a hot heart.
  c.ellipsoid(cx, 6.3, 2.1 - s * 0.35, 1.15 - s * 0.15, {
    mat: crust,
    part,
    tex: (q: TexSample) => {
      q.tone = -0.02;
      if (ash) {
        if (hash(Math.floor(q.x * 2), Math.floor(q.y * 2), 3) > 0.9 && q.u * q.u + q.v * q.v < 0.3) q.fix = d === 1 ? PAL.red[2] : PAL_HD.red[5];
        return;
      }
      // Glowing cracks: a band of noise ridges, more of them while it is hot.
      const n = noise(q.x, q.y, 0.9, 7 + (i >> 2));
      const r2 = q.u * q.u + q.v * q.v;
      const crack = Math.abs(n - 0.5) < 0.14 + pulse * 0.2;
      if (crack || r2 < pulse * 0.5) {
        q.mat = fire;
        q.tone = sat(0.16 + pulse * 0.72 - r2 * 0.3) * 0.999 - 0.5;
      }
    },
  });
  // A thin rim in the crust's deepest tone (a black ink ring would swallow so small a coal).
  const ink: Color = ash ? ashRamp[0] : crustRamp[0];
  return frame(c.render({ outline: 'B', ink, ao: 0, sep: false, clean: true }), 4, 4, d);
}

function emberFrames(d: number): Frame[] {
  return Array.from({ length: EMBER_FRAMES }, (_, i) => emberFrame(i, d));
}

// ------------------------------------------------------------------------------------ smoke cloud

export const CLOUD_ID = 'fx/shotgun-cloud';
export const CLOUD_FRAMES = 12;
export const CLOUD_TPF = 5;
const CW = 44;

/** A big dark smoke puff: soot-black round puffs that swell, lift, grey a little and fray. */
function cloudFrames(d: number): Frame[] {
  // Soot: near-black purple-brown to a dark warm grey (the light catches only the crowns).
  const ramp: Ramp = d === 1 ? [PAL.ink[0], PAL.ink[1], PAL.stone[0], PAL.stone[1]] : [PAL_HD.ink[0], PAL_HD.stone[0], PAL_HD.brown[1], PAL_HD.stone[1], PAL_HD.stone[2]];
  return Array.from({ length: CLOUD_FRAMES }, (_, i) => {
    const t = i / (CLOUD_FRAMES - 1);
    const c = new HdCanvas(CW, CW, d);
    const smoke = c.material({ ramp, lo: 0, hi: ramp.length - 1, wrap: 0.42, bounce: 0.35, rim: 0.06, amb: 0.12 });
    const r = 7.5 + 9.5 * Math.sqrt(t);
    const cx = CW / 2;
    const cy = CW / 2 + 2 - t * 2;
    const fade = (d === 1 ? 0.04 : 0.08) + (d === 1 ? 0.4 : 0.55) * t * t;
    // Five round puffs (one surface): a crown, two shoulders, two small ones low down.
    const puffs: Array<[number, number, number]> = [
      [cx - r * 0.52, cy + r * 0.28, r * 0.6],
      [cx + r * 0.55, cy + r * 0.2, r * 0.58],
      [cx - r * 0.05, cy - r * 0.2, r * 0.78],
      [cx + r * 0.25, cy + r * 0.48, r * 0.46],
      [cx - r * 0.8, cy + r * 0.55, r * 0.34],
    ];
    const part = c.newPart();
    const R = r * 1.3;
    puffs.forEach(([px, py, pr], k) => {
      c.ellipsoid(px, py, pr, pr, {
        mat: smoke,
        part,
        z: k * 0.4,
        tex: (q: TexSample) => {
          const qq = Math.hypot(q.x - cx, q.y - cy) / R;
          if (frayCut(Math.min(1, qq), fade, q.X, q.Y)) {
            q.cut = true;
            return;
          }
          const fl = 0.12 + 0.35 * t;
          q.nx *= 1 - fl;
          q.ny *= 1 - fl;
          q.nz = q.nz * (1 - fl) + fl;
          q.tone = -0.06 + t * 0.12 + noise(q.x, q.y, 3, 31 + i) * 0.14;
        },
      });
    });
    return frame(c.render({ outline: 'none', ao: 0.2, sep: false, clean: true }), CW / 2, CW / 2, d);
  });
}

// ------------------------------------------------------------------------------------ floor glow

export const GLOW_ID = 'fx/shotgun-glow';
export const GLOW_DURATIONS: readonly number[] = [2, 3, 3, 3];
const GW = 100;
const GH = 16;

/** Warm light pooled on the floor (anchor: the centre of the floor line): ordered-dither bands. */
function glowFrames(d: number): Frame[] {
  const ramp: readonly Color[] = d === 1 ? [PAL.red[0], PAL.red[1], PAL.red[2], PAL.orange[1], PAL.orange[2]] : [PAL_HD.red[1], PAL_HD.red[3], PAL_HD.red[5], PAL_HD.orange[3], PAL_HD.orange[4]];
  return [1, 0.72, 0.45, 0.22].map((k) => {
    const c = new HdCanvas(GW, GH, d);
    const rx = 47 * (0.88 + 0.12 * k);
    const ry = 6.5;
    const cx = GW / 2;
    const cy = GH / 2;
    c.paint(0, 0, GW, GH, (x, y, X, Y) => {
      const qx = (x - cx) / rx;
      const qy = (y - cy) / ry;
      const q = qx * qx + qy * qy;
      if (q >= 1) return 0;
      // Brighter toward the muzzle side (left) where the fire is hottest.
      const h = k * (1 - q) * (1.15 - 0.3 * ((x - cx) / rx + 1) / 2) * ramp.length;
      const b = Math.floor(h + (d === 1 ? 0 : cellBayer(X, Y) - 0.5));
      return b < 0 ? 0 : ramp[Math.min(ramp.length - 1, b)];
    });
    return frame(c.render({ outline: 'none', ao: 0, sep: false, clean: false }), GW / 2, GH / 2, d);
  });
}

// ------------------------------------------------------------------------------------ registration

/** Register the shotgun fire's sprites (weapons/art.ts). */
export function defineShotgunFireSprites(): void {
  const s = FIRE_STYLE;
  defineSprite(s.id, () => fireFrames(s, false, 1), { durations: FIRE_DURATIONS, loop: false, hd: (d) => fireFrames(s, false, d) });
  defineSprite(`${s.id}-up`, () => fireFrames(s, true, 1), { durations: FIRE_DURATIONS, loop: false, hd: (d) => fireFrames(s, true, d) });
  for (const turn of ['fwd', 'up', 'diag'] as const) {
    const id = turn === 'fwd' ? BLOOM_ID : `${BLOOM_ID}-${turn}`;
    defineSprite(id, () => bloomFrames(turn, 1), { durations: BLOOM_DURATIONS, loop: false, hd: (d) => bloomFrames(turn, d) });
  }
  defineSprite(SMOKE_ID, () => smokeFrames(1), { ticksPerFrame: SMOKE_TPF, loop: false, hd: (d) => smokeFrames(d) });
  defineSprite(EMBER_ID, () => emberFrames(1), { ticksPerFrame: EMBER_TPF, loop: false, hd: (d) => emberFrames(d) });
  defineSprite(CLOUD_ID, () => cloudFrames(1), { ticksPerFrame: CLOUD_TPF, loop: false, hd: (d) => cloudFrames(d) });
  defineSprite(GLOW_ID, () => glowFrames(1), { durations: GLOW_DURATIONS, loop: false, hd: (d) => glowFrames(d) });
}
