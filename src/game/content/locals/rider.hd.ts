/**
 * UHD art of the Amsterdam riders (docs/ART_GUIDE.md "UHD art"): the bikes and their wheels, the
 * delivery rider's thermal cube bag and the youth's flying cap, each drawn natively at density 2
 * and 4 by ONE density-generic drawer (HdCanvas: lit volumes, PAL_HD ramps, outline A). The rider
 * on the bike is the HD rig (`renderHuman(…, d)`), composed in rider.art.ts.
 *
 * Geometry is law: every part sits on the 1× pixels it covers (body-space points rounded like the
 * 1× art, then the pixel centre), the bike body is clipped to the 1× bike's opaque box less the
 * outline's width, and each wheel buffer covers exactly the 1× wheel and its outline. The bike
 * geometry (`BIKE`, `rotor`) is shared with the 1× drawer in rider.art.ts.
 *
 * - Wheels (`wheelHd`, cached per kind / phase / density): a lit torus tyre with tread knobs that
 *   turn with the phase (fat: chunky knobs, at 4× notched into the silhouette and a sidewall
 *   bead; city: a fine tread at 4×), a 5-spoke alloy mag rim with dark pockets, hub and bolts
 *   (fat), or a chrome box rim, hub and thin steel spokes (city: 8 at 2×, 16 laced at 4×).
 * - Bike (`bikeHd`, cached): glossy painted frame tubes with a specular streak, head tube and
 *   badge, chain stays and chain, chainring (teeth and spider at 4×), crank arms and pedals at the
 *   rider's crank angle, the battery with charge LEDs (fat), the rack with its strut, the speaker
 *   with cone, dust cap, grille and LED (fat solo), the saddle with rails and post, stem,
 *   handlebar, grip and brake lever, the phone with a lit map screen, the mudguard (fat), a
 *   headlight and a red rear light.
 */
import type { Color } from '../../../engine/color';
import { PAL_HD, hdHome } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { HdCanvas, type DrawOpts, type HdMaterial } from '../../art/hd';
import { spanOf } from '../../art/hd/body';
import { R } from '../../art/paint';

export type BikeKind = 'fat' | 'city';
export type HdD = 2 | 4;
export type Pt = readonly [number, number];

export interface BikeGeo {
  r: number;
  rear: Pt;
  front: Pt;
  bb: Pt;
  hip: Pt;
  crank: number;
}

/** Bike geometry (body space: x forward, y up negative, ground at 0). */
export const BIKE: Readonly<Record<BikeKind, BikeGeo>> = {
  fat: { r: 7, rear: [-11, -7], front: [12, -7], bb: [0, -10], hip: [-4, -20], crank: 3 },
  city: { r: 8, rear: [-13, -8], front: [13, -8], bb: [-1, -11], hip: [-4, -23], crank: 3 },
};

export interface BikeOpts {
  /** Frame colour ramp. */
  color: string;
  /** Rotation (degrees, negative = front up) about the rear wheel's ground contact. */
  rot?: number;
  /** Wheel phase 0..3. */
  phase?: number;
  /** A passenger seat on the rear rack (no speaker). */
  pair?: boolean;
}

/** HD bike options: the crank angle (turns; the near pedal at `crank`, the far one half a turn on). */
export interface BikeHdOpts extends BikeOpts {
  crank?: number;
}

/** A box in the 1× bike sketch (64 × 56, anchor 32, 50). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Anchor of the 1× bike sketch. */
export const BIKE_OX = 32;
export const BIKE_OY = 50;

/** Rotate a body-space point about the rear wheel's ground contact. */
export function rotor(geo: BikeGeo, deg: number): (p: Pt) => [number, number] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const px = geo.rear[0];
  return (p) => {
    const dx = p[0] - px;
    const dy = p[1];
    return [px + dx * c - dy * s, dx * s + dy * c];
  };
}

const TAU = Math.PI * 2;
const frac = (v: number): number => v - Math.floor(v);

/**
 * A lit material on the HD ramp of a 1× ramp, banded so that a face-on plane sits on the HD home
 * of the 1× base tone `r1[base]` (the colour the 1× part shows most): the identity of the 1× art.
 */
export function onTone(c: HdCanvas, r1: Ramp, base: number, m: Partial<HdMaterial> = {}, below = 2): number {
  const home = hdHome(r1[Math.min(base, r1.length - 1)]);
  const s = spanOf(r1);
  const ramp = home?.ramp ?? s.ramp;
  const n = ramp.length;
  const i = home ? home.i : Math.round((s.lo + s.hi) / 2);
  const hi = Math.max(2, Math.min(n - 2, i + 1));
  const lo = Math.max(1, Math.min(hi - 2, i - below));
  return c.material({ ramp, lo, hi, ...m });
}

/** A dense frame cut to the box of its (trimmed) 1× frame `base`: the registry's geometry. */
export function onBox(f: Frame, base: Frame, d: number): Frame {
  const x = f.ox - base.ox;
  const y = f.oy - base.oy;
  const buf = f.buf.crop(x * d, y * d, base.buf.w * d, base.buf.h * d);
  return base.pts ? { buf, ox: base.ox, oy: base.oy, pts: base.pts, density: d } : { buf, ox: base.ox, oy: base.oy, density: d };
}

/** `onBox` for a strip and its 1× frames. */
export function onBoxes(fs: readonly Frame[], base: readonly Frame[], d: number): Frame[] {
  return fs.map((f, i) => onBox(f, base[i], d));
}

// ------------------------------------------------------------------------------------ wheels

const wheelCache = new Map<string, PixelBuffer>();

/**
 * The wheel at density d: (2r + 3) logical px square (the 1× wheel disc of radius r and its
 * outline), centre in the middle; read-only (cached).
 */
export function wheelHd(kind: BikeKind, phase: number, d: HdD): PixelBuffer {
  const ph = ((phase % 4) + 4) % 4;
  const key = `${kind}|${ph}|${d}`;
  let b = wheelCache.get(key);
  if (!b) {
    b = drawWheel(kind, ph, d);
    wheelCache.set(key, b);
  }
  return b;
}

function drawWheel(kind: BikeKind, phase: number, d: HdD): PixelBuffer {
  const fat = kind === 'fat';
  const r = BIKE[kind].r;
  const S = 2 * r + 3;
  const C = S / 2;
  const Ro = r + 0.5;
  // Inner edge of the tyre (fat: a balloon tyre 4 px deep; city: 2 px).
  const Ri = fat ? r - 3.5 : r - 1.5;
  const rc = (Ro + Ri) / 2;
  const tr = (Ro - Ri) / 2;
  const c = new HdCanvas(S, S, d);
  const rubber = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.45, shine: 12, wrap: 0.05 });
  // Tread knobs turn with the phase: one phase step = a quarter of the knob period (a 4-frame loop).
  const nK = fat ? (d === 4 ? 22 : 16) : 30;
  const kStep = TAU / nK;
  const kRot = (phase / 4) * kStep;
  c.plane(0, 0, S, S, {
    mat: rubber,
    z: 0,
    mask: (x, y) => {
      const q = Math.hypot(x - C, y - C);
      return q < Ro && q >= Ri;
    },
    tex: (s) => {
      const dx = s.x - C;
      const dy = s.y - C;
      const q = Math.hypot(dx, dy) || 1;
      const t = Math.max(-1, Math.min(1, (q - rc) / tr));
      // A torus seen from the side: the tread faces out, the sidewall faces the viewer.
      s.nx = (dx / q) * t;
      s.ny = (dy / q) * t;
      s.nz = Math.sqrt(1 - t * t) + 0.12;
      const f = frac((Math.atan2(dy, dx) - kRot) / kStep);
      if (fat) {
        if (t > 0.3) {
          if (f >= 0.55) {
            s.tone -= 0.32;
            s.dz = -0.4;
            if (d === 4 && t > 0.8) s.cut = true;
          } else s.tone += f < 0.12 ? 0.12 : 0.04;
        } else if (d === 4 && t > -0.62 && t < -0.4) s.tone -= 0.22;
      } else if (d === 4 && t > 0.45 && f < 0.35) s.tone -= 0.22;
    },
  });
  if (fat) {
    // The alloy mag rim: five spokes with dark pockets, a lit lip, a domed hub with bolts.
    const alloy = c.material({ ramp: PAL_HD.steel, lo: 3, hi: 6, spec: 0.9, shine: 26, wrap: 0.05 });
    const pocket = c.material({ ramp: PAL_HD.steel, lo: 0, hi: 2, wrap: 0.1 });
    const sStep = TAU / 5;
    const sRot = (phase / 4) * sStep;
    const hubR = 1.05;
    c.plane(C - Ri, C - Ri, Ri * 2, Ri * 2, {
      mat: alloy,
      z: 0.6,
      mask: (x, y) => Math.hypot(x - C, y - C) < Ri,
      tex: (s) => {
        const dx = s.x - C;
        const dy = s.y - C;
        const q = Math.hypot(dx, dy) || 1e-6;
        const ux = dx / q;
        const uy = dy / q;
        if (q > Ri - 0.7) {
          const t = (q - (Ri - 0.35)) / 0.35;
          s.nx = ux * t * 0.75;
          s.ny = uy * t * 0.75;
          s.nz = 1;
          return;
        }
        if (q < hubR) {
          s.nx = (dx / hubR) * 0.75;
          s.ny = (dy / hubR) * 0.75;
          s.nz = 1;
          s.tone += 0.05;
          return;
        }
        const g = frac((Math.atan2(dy, dx) - sRot) / sStep) - 0.5;
        const half = 0.13 + 0.2 * (1 - q / Ri);
        if (Math.abs(g) < half) {
          // A spoke: rounded across (the normal leans along the tangent).
          const k = g / half;
          s.nx = -uy * k * 0.6;
          s.ny = ux * k * 0.6;
          s.nz = 1;
        } else {
          s.mat = pocket;
          s.dz = -0.6;
          s.nx = -ux * 0.3;
          s.ny = -uy * 0.3;
          s.nz = 1;
        }
      },
    });
    if (d === 4) {
      for (let k = 0; k < 5; k++) {
        const a = sRot + k * sStep + sStep / 2;
        c.dot(C + Math.cos(a) * 0.62, C + Math.sin(a) * 0.62, PAL_HD.steel[1]);
      }
      c.dot(C - 0.3, C - 0.3, PAL_HD.steel[7]);
    }
  } else {
    // A chrome box-section rim and a small hub; the spokes are drawn after the render.
    const chrome = c.material({ ramp: PAL_HD.steel, lo: 3, hi: 6, spec: 1, shine: 34 });
    c.plane(0, 0, S, S, {
      mat: chrome,
      z: 0.5,
      mask: (x, y) => {
        const q = Math.hypot(x - C, y - C);
        return q < Ri && q >= Ri - 1;
      },
      tex: (s) => {
        const dx = s.x - C;
        const dy = s.y - C;
        const q = Math.hypot(dx, dy) || 1;
        const t = Math.max(-1, Math.min(1, (q - (Ri - 0.5)) / 0.5));
        s.nx = (dx / q) * t * 0.85;
        s.ny = (dy / q) * t * 0.85;
        s.nz = Math.sqrt(1 - 0.7 * t * t);
      },
    });
    c.ellipsoid(C, C, 0.9, 0.9, { mat: chrome, z: 0.6 });
  }
  const out = c.render({ outline: 'A', ao: 0.2, rimLight: 2 });
  if (!fat) {
    // Thin steel spokes over the open wheel (and the ink ring inside the rim), never over the
    // hub or the rim. 4×: 16 spokes laced tangentially (they cross); 2×: 8 radial ones.
    const n = d === 4 ? 16 : 8;
    const period = d === 4 ? (2 * TAU) / n : TAU / n;
    const shift = (phase / 4) * period;
    const ink = PAL_HD.ink[0];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + shift;
      const ah = d === 4 ? a + (k & 1 ? 0.42 : -0.42) : a;
      const lit = Math.cos(a) + Math.sin(a) < 0;
      const col = lit ? PAL_HD.steel[6] : PAL_HD.steel[4];
      artLine(out, (C + Math.cos(ah) * 0.95) * d, (C + Math.sin(ah) * 0.95) * d, (C + Math.cos(a) * (Ri - 1)) * d, (C + Math.sin(a) * (Ri - 1)) * d, col, (c0) => (c0 & 255) === 0 || c0 === ink);
    }
    out.touch();
  }
  return out;
}

/** A 1-art-px line between art-px positions; `may(c)` says whether a px may be painted. */
function artLine(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: Color, may: (c: Color) => boolean): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const X = Math.floor(x0 + ((x1 - x0) * i) / n);
    const Y = Math.floor(y0 + ((y1 - y0) * i) / n);
    if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue;
    const j = Y * b.w + X;
    if (may(b.data[j])) b.data[j] = c >>> 0;
  }
}

// ------------------------------------------------------------------------------------ the bike

const bikeCache = new Map<string, Frame>();

/**
 * The HD bike frame (density d) on the 1× bike's opaque box `rect` (in the 64 × 56 sketch,
 * anchor 32, 50): read-only (cached; `withPieces` copies).
 */
export function bikeHd(kind: BikeKind, o: BikeHdOpts, d: HdD, rect: Rect): Frame {
  const key = `${kind}|${o.color}|${o.rot ?? 0}|${o.phase ?? 0}|${o.pair === true}|${o.crank ?? 0}|${d}|${rect.x},${rect.y},${rect.w},${rect.h}`;
  let f = bikeCache.get(key);
  if (!f) {
    f = drawBikeHd(kind, o, d, rect);
    bikeCache.set(key, f);
  }
  return f;
}

/** Depths of the bike's parts (larger = nearer the viewer). */
const Z = { farCrank: 0.2, stay: 1, ring: 1.7, rack: 2, rearLamp: 2.2, speaker: 2.4, post: 2.6, frame: 3, mud: 3.2, battery: 3.7, saddle: 3.9, stem: 4.2, lamp: 4.4, phone: 4.6, crank: 5, pedal: 5.4 };

function drawBikeHd(kind: BikeKind, o: BikeHdOpts, d: HdD, rect: Rect): Frame {
  const geo = BIKE[kind];
  const T = rotor(geo, o.rot ?? 0);
  const fat = kind === 'fat';
  const phase = o.phase ?? 0;
  const c = new HdCanvas(rect.w, rect.h, d);
  /** Canvas position of the 1× pixel a body-space point lands on, plus `off` (0.5: its centre). */
  const P = (p: Pt, off = 0.5): [number, number] => [Math.round(BIKE_OX + p[0]) - rect.x + off, Math.round(BIKE_OY + p[1]) - rect.y + off];
  /** Unrounded (parts the 1× art does not have: cranks, pedals, chain). */
  const Q = (p: Pt): [number, number] => [BIKE_OX + p[0] - rect.x + 0.5, BIKE_OY + p[1] - rect.y + 0.5];
  /** The twin of a 1× `thickLine(…, w)`: even widths are centred on pixel corners, odd ones on centres. */
  const tube = (a: Pt, b: Pt, w: number, opts: DrawOpts): void => {
    const off = w % 2 === 0 ? 1 : 0.5;
    const A = P(a, off);
    const B = P(b, off);
    c.capsule(A[0], A[1], B[0], B[1], w / 2, w / 2, opts);
  };

  // Glossy paint: three lit bands round the 1× frame colour (the deep tone only in crevices).
  const paint = onTone(c, R(o.color), 2, { spec: 0.85, shine: 30, wrap: 0.05 }, 1);
  const black = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.55, shine: 22, wrap: 0.05 });
  const matte = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.2, shine: 10, wrap: 0.1 });
  const steel = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 5, spec: 0.9, shine: 26, wrap: 0.05 });
  const chrome = c.material({ ramp: PAL_HD.steel, lo: 3, hi: 6, spec: 1, shine: 34 });
  const leather = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.65, shine: 16, wrap: 0 });
  const redLamp = c.material({ ramp: PAL_HD.red, lo: 3, hi: 6, spec: 0.8, shine: 24 });

  const rear = T(geo.rear);
  const front = T(geo.front);
  const bb = T(geo.bb);
  const seat = T([geo.hip[0] - 1, geo.hip[1] + 2]);
  const head = T(fat ? [8, -17] : [9, -19]);
  const bar = T(fat ? [6, -25] : [5, -28]);
  const r = geo.r;

  // Cranks and pedals at the rider's crank angle (the feet sit 3 px above the pedal axles).
  const a = (o.crank ?? 0) * TAU;
  const pedalAt = (ang: number): [number, number] => Q(T([geo.bb[0] + Math.cos(ang) * geo.crank, geo.bb[1] + Math.sin(ang) * geo.crank - 1]));
  const B0 = Q(bb);
  const far = pedalAt(a + Math.PI);
  c.capsule(B0[0], B0[1], far[0], far[1], 0.42, 0.42, { mat: steel, z: Z.farCrank, tone: -0.3 });
  c.box(far[0] - 0.9, far[1] - 0.35, 1.8, 0.7, { mat: matte, z: Z.farCrank + 0.1, r: 0.2, tone: -0.2 });

  // Chain stay and seat stay (thin, dark).
  tube(rear, bb, 1, { mat: black, z: Z.stay });
  tube(rear, seat, 1, { mat: black, z: Z.stay });
  // The chainring: a flat steel disc, teeth and a dark five-arm spider at 4×.
  const ringR = 1.9;
  c.plane(B0[0] - ringR, B0[1] - ringR, ringR * 2, ringR * 2, {
    mat: steel,
    z: Z.ring,
    mask: (x, y) => Math.hypot(x - B0[0], y - B0[1]) < ringR,
    tex: (s) => {
      const dx = s.x - B0[0];
      const dy = s.y - B0[1];
      const q = Math.hypot(dx, dy) || 1e-6;
      const ang = Math.atan2(dy, dx);
      s.nx = (dx / q) * 0.35 * (q / ringR);
      s.ny = (dy / q) * 0.35 * (q / ringR);
      s.nz = 1;
      if (q > ringR - 0.35) {
        if (d === 4 && frac((ang - a) / (TAU / 18)) < 0.4) s.cut = true;
        else s.tone += 0.1;
      } else if (d === 4 && q < 1.25 && q > 0.45 && frac((ang - a) / (TAU / 5) + 0.25) > 0.3) {
        s.mat = matte;
        s.dz = -0.3;
      }
    },
  });
  // The chain along the top of the chain stay: alternating link px.
  {
    const A = Q([bb[0] - 0.4, bb[1] - ringR + 0.2]);
    const Bc = Q([rear[0] + 0.6, rear[1] - 1.1]);
    const n = Math.ceil(Math.hypot(Bc[0] - A[0], Bc[1] - A[1]) * d);
    for (let i = 0; i <= n; i++) {
      const x = A[0] + ((Bc[0] - A[0]) * i) / n;
      const y = A[1] + ((Bc[1] - A[1]) * i) / n;
      const link = d === 4 ? ((i + phase) >> 1) & 1 : (i + phase) & 1;
      c.dot(x, y, link ? PAL_HD.steel[4] : PAL_HD.black[1]);
    }
  }

  // Main frame (one part: no seams where the tubes meet): seat tube, top tube, down tube, fork.
  const fr = c.newPart();
  const fo: DrawOpts = { mat: paint, z: Z.frame, part: fr };
  tube(bb, seat, 2, fo);
  tube(seat, head, 2, fo);
  tube(head, bb, fat ? 3 : 2, fo);
  tube(head, front, 2, fo);
  // Head tube: a short fat collar along the steering axis, with a small badge at 4×.
  {
    const H0 = P(head, 1);
    const F = P(front, 1);
    const L = Math.hypot(F[0] - H0[0], F[1] - H0[1]) || 1;
    const ux = (F[0] - H0[0]) / L;
    const uy = (F[1] - H0[1]) / L;
    c.capsule(H0[0] - ux * 0.6, H0[1] - uy * 0.6, H0[0] + ux * 1.6, H0[1] + uy * 1.6, 1.25, 1.2, fo);
    if (d === 4) {
      c.dot(H0[0] + ux * 0.4 + 0.25, H0[1] + uy * 0.4, PAL_HD.snow[5]);
      c.dot(H0[0] + ux * 0.4 + 0.5, H0[1] + uy * 0.4 + 0.25, PAL_HD.gold[5]);
    }
  }
  if (fat) {
    // The battery on the down tube: a matte pack, three green charge LEDs, a steel lock.
    const b0 = T([5, -14]);
    const b1 = T([2, -11]);
    tube(b0, b1, 3, { mat: matte, z: Z.battery, round: 0.6 });
    const A = P(b0);
    const Bb = P(b1);
    for (let k = 0; k < 3; k++) {
      const t = 0.3 + k * 0.17;
      c.dot(A[0] + (Bb[0] - A[0]) * t - 0.4, A[1] + (Bb[1] - A[1]) * t - 0.4, PAL_HD.green[k < 2 ? 7 : 4]);
    }
    c.dot(Bb[0] + 0.3, Bb[1] + 0.6, PAL_HD.steel[6]);
  }
  // Mudguard over the front wheel (fat): a thin painted arc.
  if (fat) {
    const pts: Array<[number, number]> = [];
    for (let k = -6; k <= 6; k++) {
      const ang = -Math.PI / 2 + (k / 6) * 0.9;
      pts.push(Q(T([geo.front[0] + Math.cos(ang) * (r + 1), geo.front[1] + Math.sin(ang) * (r + 1)])));
    }
    c.stroke(pts, 0.55, 0.5, { mat: paint, z: Z.mud });
  }

  // Rear rack: the rail and a strut down to the axle; the red rear light under its end.
  const rk0 = T([geo.hip[0] - 2, -16]);
  const rk1 = T([rear[0] - 4, -16]);
  tube(rk0, rk1, 1, { mat: steel, z: Z.rack });
  {
    const A = P(rk1);
    const Bs = P(rear);
    c.capsule(A[0], A[1], Bs[0], Bs[1], 0.36, 0.36, { mat: steel, z: Z.rack - 0.1 });
    c.box(A[0] - 0.1, A[1] + 0.55, 1.2, 0.9, { mat: redLamp, z: Z.rearLamp, r: 0.25, bevel: 0.3 });
    if (d === 4) c.dot(A[0] + 0.3, A[1] + 0.85, PAL_HD.red[7]);
  }
  if (fat && !o.pair) {
    // The speaker on the rack: a matte box, a cone with its surround and a lit dust cap, a bass
    // port, a green power LED; a grille of dots at 4×.
    const sp = P(T([-16, -21]), 0);
    c.box(sp[0], sp[1], 6, 5, { mat: matte, z: Z.speaker, r: 0.5, bevel: 0.6 });
    const cx = sp[0] + 2.6;
    const cy = sp[1] + 2.5;
    c.ellipsoid(cx, cy, 1.85, 1.85, { mat: black, z: Z.speaker + 0.3, round: 0.5, tex: (s) => {
      const q = Math.hypot(s.x - cx, s.y - cy);
      if (q > 1.35) s.tone += 0.18;
      else s.tone -= 0.12;
    } });
    c.ellipsoid(cx, cy, 0.6, 0.6, { mat: chrome, z: Z.speaker + 0.9 });
    c.ellipsoid(sp[0] + 5, sp[1] + 3.9, 0.45, 0.4, { mat: matte, z: Z.speaker + 0.35, tone: -0.6 });
    c.dot(sp[0] + 0.75, sp[1] + 0.7, PAL_HD.green[7]);
    if (d === 4) {
      for (let k = 0; k < 4; k++) c.dot(sp[0] + 4.7 + (k & 1) * 0.5, sp[1] + 0.9 + (k >> 1) * 0.5, PAL_HD.black[4]);
    }
  }

  // Saddle: padded leather, high at the back, a tapered nose; rails at 4×; the steel post.
  {
    const sd = P(T([geo.hip[0], geo.hip[1] + 1]), 0);
    const x0 = sd[0] - 3;
    const y0 = sd[1];
    const S0 = P(seat, 1);
    c.capsule(S0[0], S0[1], sd[0] - 0.4, y0 + 1.4, 0.5, 0.5, { mat: steel, z: Z.post });
    c.blob([[x0, y0], [x0 + 4, y0 + 0.15], [x0 + 6, y0 + 0.7], [x0 + 6, y0 + 1.5], [x0 + 4, y0 + 2], [x0 + 0.3, y0 + 2]], 0.8, { mat: leather, z: Z.saddle, bulge: 0.2 });
    if (d === 4) c.capsule(x0 + 1.2, y0 + 2.05, x0 + 4.4, y0 + 1.9, 0.22, 0.22, { mat: chrome, z: Z.saddle - 0.2 });
  }

  // Stem, handlebar, grip and (4×) the brake lever.
  tube(head, bar, 1, { mat: steel, z: Z.stem });
  const Bar = P(bar);
  c.capsule(Bar[0] - 1, Bar[1], Bar[0] + 1, Bar[1], 0.5, 0.5, { mat: steel, z: Z.stem });
  c.capsule(Bar[0] + 0.25, Bar[1], Bar[0] + 1.55, Bar[1], 0.62, 0.62, { mat: matte, z: Z.stem + 0.15 });
  if (d === 4) c.capsule(Bar[0] + 0.3, Bar[1] + 0.45, Bar[0] + 1.85, Bar[1] + 1.25, 0.2, 0.2, { mat: chrome, z: Z.stem + 0.3 });

  // Headlight: a black lamp with a bright lens facing forward.
  {
    const L = P(T(fat ? [9.5, -18.5] : [10.2, -21]));
    c.ellipsoid(L[0], L[1], 1.05, 0.85, { mat: black, z: Z.lamp });
    c.paint(L[0] - 1.1, L[1] - 0.9, 2.2, 1.8, (x, y) => {
      const ex = (x - (L[0] + 0.45)) / 0.55;
      const ey = (y - L[1]) / 0.7;
      const q = ex * ex + ey * ey;
      return q < 0.45 ? PAL_HD.gold[7] : q < 1 ? PAL_HD.gold[6] : 0;
    });
  }

  // Phone on a clamp above the bar: a black case and a lit map screen (a route at 4×).
  {
    const ph = P(T([bar[0] + 2, bar[1] - 3]), 0);
    c.capsule(ph[0] + 1, ph[1] + 2.9, Bar[0] + 0.3, Bar[1], 0.3, 0.3, { mat: steel, z: Z.phone - 0.3 });
    c.box(ph[0], ph[1], 2, 3, { mat: matte, z: Z.phone, r: 0.35, bevel: 0.3 });
    const sx = ph[0] + 0.3;
    const sy = ph[1] + 0.3;
    c.paint(sx, sy, 1.4, 2.4, (x, y) => {
      const v = (y - sy) / 2.4;
      if (d === 4) {
        const u = (x - sx) / 1.4;
        if (Math.abs(u - (0.25 + v * 0.55)) < 0.12 && v > 0.15 && v < 0.85) return PAL_HD.gold[5];
        if (Math.hypot(u - 0.72, v - 0.8) < 0.13) return PAL_HD.red[5];
      } else if (Math.abs(x - (sx + 0.9)) < 0.3 && Math.abs(y - (sy + 1.3)) < 0.3) return PAL_HD.gold[5];
      return v < 0.25 ? PAL_HD.sky[6] : v < 0.6 ? PAL_HD.sky[5] : PAL_HD.sky[4];
    });
  }

  // Near crank arm and pedal (in front of the frame; the rider's foot covers the pedal).
  const near = pedalAt(a);
  c.capsule(B0[0], B0[1], near[0], near[1], 0.45, 0.45, { mat: steel, z: Z.crank });
  c.ellipsoid(B0[0], B0[1], 0.55, 0.55, { mat: chrome, z: Z.crank + 0.1 });
  c.box(near[0] - 1, near[1] - 0.4, 2, 0.8, { mat: matte, z: Z.pedal, r: 0.25, bevel: 0.25 });

  // Geometry is law: nothing past the 1× box less the outline's width.
  c.erase(0, 0, rect.w, rect.h, (x, y) => x < 1 || y < 1 || x > rect.w - 1 || y > rect.h - 1);
  const body = c.render({ outline: 'A', ao: 0.3, rimLight: 2 });

  const out = new PixelBuffer(rect.w * d, rect.h * d);
  const wheel = wheelHd(kind, phase, d);
  for (const w of [rear, front]) {
    const p = P(w);
    out.blit(wheel, Math.round((p[0] - (r + 1.5)) * d), Math.round((p[1] - (r + 1.5)) * d));
  }
  out.blit(body, 0, 0);
  return { buf: out, ox: BIKE_OX - rect.x, oy: BIKE_OY - rect.y, density: d };
}

// ------------------------------------------------------------------------------------ cube bag

/**
 * The delivery rider's thermal cube bag at density d (the 16 × 16 logical box of the 1× `cubePack`):
 * a puffy green insulated bag with a lid panel, stitching (4×), a carry strap, and the dark logo
 * band with the burger (sesame bun, lettuce, cheese, patty, bun) painted SYMMETRIC about the 1×
 * axis (the rider is drawn mirrored when he faces left). Open: the lid flap shows its silver
 * foil lining.
 */
export function cubePackHd(open: boolean, d: HdD): PixelBuffer {
  const c = new HdCanvas(16, 16, d);
  const fabric = c.material({ ramp: PAL_HD.green, lo: 2, hi: 6, spec: 0.2, shine: 10, wrap: 0.08 });
  const band = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.15, wrap: 0.1 });
  const foil = c.material({ ramp: PAL_HD.steel, lo: 3, hi: 6, spec: 1, shine: 18 });
  const strap = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.4, shine: 14 });
  const top = open ? 4 : 2;
  const body = c.newPart();
  c.blob([[1, top], [14, top], [14, 14], [1, 14]], 1.3, { mat: fabric, z: 0, part: body, bulge: 0.3 });
  if (open) {
    // The lid flap, swung up: green outside rim, foil lining inside.
    c.blob([[1, 4], [14, 4], [11, 0.2], [3, 1]], 0.6, { mat: foil, z: -0.5, bulge: 0.1 });
    c.capsule(1.6, 4, 13.4, 4, 0.55, 0.55, { mat: fabric, z: 0.6 });
  } else {
    // The lid panel (a seam under it) and the carry strap on top.
    c.blob([[1, 2], [14, 2], [14, 4.4], [1, 4.4]], 0.8, { mat: fabric, z: 0.5, tone: 0.08 });
    c.capsule(6, 2.55, 9.98, 2.55, 0.45, 0.45, { mat: strap, z: 1.2 });
  }
  // The logo band (11 × 4 logical, as the 1× band).
  const by = open ? 8 : 7;
  c.box(2, by, 11, 4, { mat: band, z: 3.2, r: 0.3, bevel: 0.3 });
  if (d === 4) {
    // Stitching: dotted seams along the vertical edges and under the lid.
    const st = PAL_HD.green[6];
    for (let y = top + 3; y < 13.5; y += 0.75) {
      c.dot(1.65, y, st);
      c.dot(13.35, y, PAL_HD.green[3]);
    }
    if (!open) for (let x = 2; x < 13.5; x += 0.75) c.dot(x, 4.75, PAL_HD.green[3]);
  }
  // The burger, symmetric about x = 7.5: sesame bun, lettuce frill, cheese, patty, bottom bun.
  c.paint(2, by, 11, 4, (x, y) => {
    const u = Math.abs(x - 7.5);
    const v = y - by;
    if (v < 0.4 || v > 3.7) return 0;
    if (v < 1.5 && u < 2.6 - (1.5 - v) * 0.8) {
      if (d === 4 && v < 1.2 && (Math.abs(u - 1.1) < 0.18 || u < 0.18) && v > 0.6) return PAL_HD.snow[5];
      return v < 0.9 ? PAL_HD.gold[5] : PAL_HD.gold[4];
    }
    if (v < 2.0 && u < 2.9) return frac(u * 1.5) < 0.5 ? PAL_HD.green[6] : PAL_HD.green[5];
    if (v < 2.35 && u < 2.7) return PAL_HD.gold[6];
    if (v < 2.95 && u < 2.6) return PAL_HD.brown[3];
    if (v < 3.6 && u < 2.4) return PAL_HD.gold[3];
    return 0;
  });
  return c.render({ outline: 'A', ao: 0.25, rimLight: 2 });
}

// ------------------------------------------------------------------------------------ the cap

/**
 * The youth's flying cap at density d (4 tumbling frames, 12 × 10 logical, centre anchor 6, 5 —
 * the 1× `capFrames` boxes): a domed black cotton crown with panel seams and a top button, the
 * lit peak with stitched rows at 4×; frames 2–3 upside down.
 */
export function capFramesHd(d: HdD): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const c = new HdCanvas(12, 10, d);
    const cloth = c.material({ ramp: PAL_HD.black, lo: 1, hi: 4, spec: 0.15, shine: 8, wrap: 0.1 });
    const peakM = c.material({ ramp: PAL_HD.black, lo: 2, hi: 5, spec: 0.35, shine: 14, wrap: 0.05 });
    const button = c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6, spec: 0.5, shine: 14 });
    const crown = c.newPart();
    c.ellipsoid(5.5, 5.2, 3.5, 3.2, { mat: cloth, z: 0, part: crown });
    c.erase(0, 0, 12, 10, (_x, y) => y > 6.8);
    c.box(2.1, 5.9, 6.8, 0.9, { mat: cloth, z: 0.2, part: crown, tone: -0.1 });
    if (d === 4) {
      // Panel seams from the button down the dome.
      c.shade(2, 2, 7, 4.2, (x, y) => (Math.abs(x - 5.5 - (y - 2.3) * 0.55) < 0.14 || Math.abs(x - 5.5 + (y - 2.3) * 0.75) < 0.14 ? -0.28 : 0), crown);
    }
    // The top button (the 1× cap's white px).
    c.ellipsoid(5.5, 2.35, 0.65, 0.45, { mat: button, z: 4 });
    const px = i % 2 === 0 ? 7 : 1;
    c.box(px, 5, 4, 1.9, { mat: peakM, z: 0.8, r: 0.5, bevel: 0.45 });
    if (d === 4) c.shade(px, 5, 4, 1.9, (_x, y) => (Math.abs(y - 6.25) < 0.12 ? -0.25 : 0));
    const b = c.render({ outline: 'A', ao: 0.25, rimLight: 2 });
    out.push({ buf: i >= 2 ? b.flipped(false, true) : b, ox: 6, oy: 5, density: d });
  }
  return out;
}
