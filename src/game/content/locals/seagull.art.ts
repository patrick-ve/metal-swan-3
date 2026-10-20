/**
 * `enemy/seagull/…` — the aggressive herring gull (docs/design/amsterdam.md §2): a big white body,
 * a pale grey back and wings with black tips (white mirror spots), a yellow beak with a red spot,
 * a mean yellow eye under a frown, pink legs.
 *
 * Flying frames are anchored at the body centre; perched frames (perch, gag, gag-fries, alert)
 * at the feet; death strips at the feet (the game moves the anchor down when it dies).
 *
 * Strips: walk (6: the flap cycle, eased at the top and bottom), idle (6), perch (2), gag (2: asleep, head tucked), gag-fries
 * (4: pecking a stolen fries cone), alert (2: perched, head up), tell (2: wings up, KAW),
 * attack (2: the dive, wings folded back), die (3), die-blast, die-burn, die-crush, photo-pose,
 * feather (4: a falling feather, centre anchor), takeoff (3: crouch, push off, first down-stroke;
 * perched art lifted, anchored at the body centre like the flying frames), pull-up (2: out of the
 * dive, wings flared), turn (2: `turnSquash` of the gliding gull, for the Turner).
 *
 * UHD art (mission ams; docs/ART_GUIDE.md "UHD art"): `gullHd(pose, d)` draws every pose natively
 * at 2× and 4× (lit volumes, layered feathers, outline A) on the 1× logical canvas, and
 * `gullStripHd` repeats each 1× strip recipe on it (one `defineHdSprite` per strip).
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineDenseAlias, defineHdSprite, defineSprite, getFrames } from '../../../engine/sprites';
import { HdCanvas, type Texture } from '../../art/hd';
import { crushStripHi } from '../../art/hi-strips';
import { crumbleDense, scorch, sootify, withFlamesDense } from '../../art/human-fx';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, reground, turnSquash, xEye } from '../creatures/draw';

const W = 44;
const H = 40;
const OX = 22;
const OY = 20;

const WHITE = PAL.snow;
const GREY = PAL.steel;
const TIP = PAL.black;
const BEAK = PAL.gold;

export type GullWings = 'up' | 'mid' | 'down' | 'wide' | 'folded' | 'rest';
export type GullFace = 'open' | 'shut' | 'kaw' | 'x' | 'happy' | 'dive';

export interface GullPose {
  wings?: GullWings;
  face?: GullFace;
  /** Standing on its feet (anchor = feet). */
  perched?: boolean;
  /** Head tucked into the back (asleep). */
  tucked?: boolean;
  /** Head dipped down (pecking). */
  peck?: number;
  /** A fries cone in front (0 = none, 1 = in the beak, 2 = on the ground). */
  fries?: number;
  /** Wing-tip override (shoulder space): the flap in-betweens between the named `wings`. */
  tip?: readonly [number, number];
}

type V = readonly [number, number];
const lerp = (a: V, b: V, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A long gull wing from the shoulder: grey arm, black tip with a white mirror spot. */
function wingParts(s: Sketch, sh: V, tip: V, far: boolean): void {
  const lead: V = [sh[0] + 4, sh[1]];
  const trail: V = [sh[0] - 9, sh[1] + 2];
  const mid = lerp(lead, tip, 0.62);
  const midT = lerp(trail, tip, 0.62);
  s.add(GREY, (b, X, Y) => b.poly([X(lead[0]), Y(lead[1]), X(mid[0]), Y(mid[1]), X(midT[0]), Y(midT[1]), X(trail[0]), Y(trail[1])], FLAT), { base: far ? 2 : 3, shift: 0 });
  s.add(TIP, (b, X, Y) => b.poly([X(mid[0]), Y(mid[1]), X(tip[0]), Y(tip[1]), X(midT[0]), Y(midT[1])], FLAT), { base: 1 });
  s.detail((b, X, Y) => {
    const m = lerp(mid, tip, 0.45);
    b.set(X(m[0]), Y(m[1]), PAL.snow[3]);
  });
}

/** One gull facing right. Flying: anchor at the body centre; perched: anchor at the feet. */
export function gull(p: GullPose = {}): Frame {
  const perched = p.perched === true;
  const oy = perched ? H - 2 : OY;
  const s = new Sketch(W, H, OX, oy);
  const by = perched ? -11 : 0;
  const wings = p.wings ?? (perched ? 'rest' : 'mid');
  const tips: Record<GullWings, V> = {
    up: [-8, -20],
    mid: [-21, -5],
    down: [-12, 13],
    wide: [-3, -22],
    folded: [-15, 0],
    rest: [-13, 1],
  };
  const tip = p.tip ?? tips[wings];
  const sh: V = [1, by - 3];
  // Far wing (behind, only when the wings are spread).
  if (wings === 'up' || wings === 'wide' || wings === 'mid') wingParts(s, sh, [tip[0] + 5, tip[1] - 2], true);
  // Legs (perched): pink, with webbed feet.
  if (perched) {
    s.add(PAL.pink, (b, X, Y) => {
      b.vline(X(-2), Y(-6), Y(-1), FLAT);
      b.vline(X(1), Y(-6), Y(-1), FLAT);
      b.hline(X(-4), X(0), Y(-1), FLAT);
      b.hline(X(-1), X(3), Y(-1), FLAT);
    }, { hi: 0, lo: 0, base: 1 });
  }
  // Tail (white, a little dark edge under it).
  s.add(WHITE, (b, X, Y) => b.poly([X(-8), Y(by - 2), X(-15), Y(by - 1 + (perched ? 3 : 0)), X(-14), Y(by + 2 + (perched ? 3 : 0)), X(-7), Y(by + 3)], FLAT), { base: 2 });
  // Body: a big white teardrop, grey on the back.
  s.add(WHITE, (b, X, Y) => b.ellipse(X(-9), Y(by - 5), 18, 10, FLAT), { base: 3, glint: true });
  s.add(GREY, (b, X, Y) => b.ellipse(X(-8), Y(by - 5), 13, 4, FLAT), { base: 3, lo: 0 });
  // Head and neck.
  const hx = p.tucked ? 2 : p.face === 'dive' ? 8 : 6;
  const hy = by + (p.tucked ? -3 : p.face === 'dive' ? 1 : -6) + (p.peck ?? 0);
  s.add(WHITE, (b, X, Y) => {
    b.circle(X(hx), Y(hy), 4, FLAT);
    if (!p.tucked) b.thickLine(X(3), Y(by - 2), X(hx), Y(hy), 4, FLAT);
  }, { base: 3, glint: true });
  // Beak: yellow, hooked, a red spot near the tip.
  const face = p.face ?? 'open';
  if (!p.tucked) {
    const down = face === 'dive' ? 2 : 0;
    s.add(BEAK, (b, X, Y) => {
      if (face === 'kaw') {
        b.poly([X(hx + 3), Y(hy - 1), X(hx + 10), Y(hy - 4), X(hx + 9), Y(hy - 2), X(hx + 4), Y(hy)], FLAT);
        b.poly([X(hx + 3), Y(hy + 1), X(hx + 9), Y(hy + 3), X(hx + 4), Y(hy + 2)], FLAT);
      } else {
        b.poly([X(hx + 3), Y(hy - 1), X(hx + 10), Y(hy + down), X(hx + 10), Y(hy + 2 + down), X(hx + 3), Y(hy + 2)], FLAT);
      }
    }, { hi: 0, lo: 0, base: 2 });
    s.detail((b, X, Y) => {
      if (face === 'kaw') {
        b.set(X(hx + 6), Y(hy + 2), PAL.red[2]);
        b.set(X(hx + 5), Y(hy), PAL.red[0]);
      } else b.set(X(hx + 8), Y(hy + 1 + down), PAL.red[2]);
      b.set(X(hx + 10), Y(hy + 1 + down), BEAK[0]);
    });
  }
  // Eye: a mean yellow eye with a frown (x when dead, a line when asleep).
  s.detail((b, X, Y) => {
    if (p.tucked) {
      b.hline(X(hx), X(hx + 1), Y(hy), INK);
      return;
    }
    if (face === 'x') xEye(b, X(hx + 1), Y(hy - 1));
    else if (face === 'shut') b.hline(X(hx), X(hx + 2), Y(hy - 1), INK);
    else if (face === 'happy') {
      b.set(X(hx), Y(hy - 1), INK);
      b.set(X(hx + 1), Y(hy - 2), INK);
      b.set(X(hx + 2), Y(hy - 1), INK);
    } else {
      b.set(X(hx + 1), Y(hy - 1), PAL.gold[3]);
      b.set(X(hx + 2), Y(hy - 1), INK);
      // The frown: a dark brow slanting down to the beak.
      b.set(X(hx), Y(hy - 3), INK);
      b.set(X(hx + 1), Y(hy - 3), INK);
      b.set(X(hx + 2), Y(hy - 2), INK);
    }
  });
  // Near wing in front.
  if (wings === 'rest' || wings === 'folded') {
    s.add(GREY, (b, X, Y) => b.poly([X(2), Y(by - 4), X(-6), Y(by - 5), X(tip[0]), Y(by + tip[1] - 1), X(-4), Y(by + 1)], FLAT), { base: 2 });
    s.add(TIP, (b, X, Y) => b.poly([X(-8), Y(by - 3), X(tip[0] - 1), Y(by + tip[1] - 1), X(-8), Y(by)], FLAT), { base: 1 });
    s.detail((b, X, Y) => b.set(X(-10), Y(by - 1), PAL.snow[3]));
  } else wingParts(s, [sh[0] - 1, sh[1] + 1], tip, false);
  // Flying feet tucked under the tail.
  if (!perched) s.detail((b, X, Y) => b.hline(X(-6), X(-4), Y(4), PAL.pink[1]));
  // Fries: a red-and-white paper cone with yellow sticks.
  if (p.fries) {
    const fx = p.fries === 1 ? hx + 9 : 12;
    const fy = p.fries === 1 ? hy + 3 : -1;
    s.add(PAL.red, (b, X, Y) => b.poly([X(fx - 3), Y(fy - 6), X(fx + 3), Y(fy - 6), X(fx), Y(fy)], FLAT), { base: 2 });
    s.detail((b, X, Y) => {
      b.vline(X(fx - 1), Y(fy - 6), Y(fy - 3), PAL.snow[3]);
      b.vline(X(fx + 1), Y(fy - 6), Y(fy - 3), PAL.snow[3]);
      for (let k = -2; k <= 2; k++) b.vline(X(fx + k), Y(fy - 9 + (k & 1)), Y(fy - 7), PAL.gold[3]);
    });
  }
  return s.frame({ head: [hx, hy], mouth: [hx + 9, hy + 1] });
}

/** Feet-anchored copy (death strips: the gull lands on the floor). */
function grounded(f: Frame): Frame {
  return reground(f.buf.clone(), f.pts);
}

/** A white feather (4 turning frames, centre anchor). */
function featherFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(9, 9);
    const pts = [
      [1, 4, 7, 4],
      [2, 6, 6, 2],
      [4, 1, 4, 7],
      [2, 2, 6, 6],
    ][i];
    b.line(pts[0], pts[1], pts[2], pts[3], PAL.snow[3]);
    b.set(pts[2], pts[3], PAL.steel[3]);
    b.outline(PAL.steel[2]);
    return { buf: b, ox: 4, oy: 4 };
  });
}

// ---------------------------------------------------------------------------------------------
// UHD art (mission ams; docs/ART_GUIDE.md "UHD art"): one density-generic drawer for 2× and 4×
// ---------------------------------------------------------------------------------------------

type HdD = 2 | 4;
type P2 = [number, number];

/** Polygon grown by `g` away from its centroid (the 1× fill also covers its edge pixels). */
function grow(pts: readonly P2[], g: number): P2[] {
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    mx += p[0];
    my += p[1];
  }
  mx /= pts.length;
  my /= pts.length;
  return pts.map(([x, y]) => {
    const l = Math.hypot(x - mx, y - my) || 1;
    return [x + ((x - mx) / l) * g, y + ((y - my) / l) * g];
  });
}

/** A fixed-colour stroke of half-width `r` (logical px) from a to b. */
function inkLine(c: HdCanvas, a: P2, b: P2, r: number, col: Color): void {
  const x0 = Math.min(a[0], b[0]) - r - 0.5;
  const y0 = Math.min(a[1], b[1]) - r - 0.5;
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  c.paint(x0, y0, Math.abs(vx) + 2 * r + 1, Math.abs(vy) + 2 * r + 1, (x, y) => {
    let t = ((x - a[0]) * vx + (y - a[1]) * vy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t) <= r ? col : 0;
  });
}

/** A fixed-colour disc. */
function inkDisc(c: HdCanvas, cx: number, cy: number, r: number, col: Color): void {
  c.paint(cx - r - 0.5, cy - r - 0.5, 2 * r + 1, 2 * r + 1, (x, y) => (Math.hypot(x - cx, y - cy) <= r ? col : 0));
}

/** Overlapping rows of feather tips (scapulars, coverts): a soft dark arc under each tip, 4× only. */
function scallops(sx: number, sy: number, amp: number): Texture {
  return (s) => {
    if (s.d < 4) return;
    const row = Math.floor(s.y / sy);
    const fx = frac(s.x / sx + (row & 1) * 0.5) - 0.5;
    const e = frac(s.y / sy) - (0.72 - fx * fx * 1.4);
    if (e > 0 && e < 0.22) s.tone -= amp;
  };
}
const frac = (v: number): number => v - Math.floor(v);

interface GullMats {
  white: number;
  grey: number;
  tip: number;
  beak: number;
  leg: number;
  mouth: number;
  paper: number;
  stripe: number;
  fry: number;
}

/**
 * One HD wing from the shoulder `sh` to `tip` (the 1× `wingParts` shape): a smooth covert panel
 * along the leading edge, secondary feathers across the trailing half (white tips: the white
 * trailing edge), and the black primaries fanning out to the tip with the white mirror spot —
 * each feather its own part, a step nearer than the next, so separations and ambient occlusion
 * draw the layers.
 */
function wingHd(c: HdCanvas, m: GullMats, L: (p: V) => P2, sh: V, tip: V, far: boolean): void {
  const d = c.d;
  const lead: V = [sh[0] + 4, sh[1]];
  const trail: V = [sh[0] - 9, sh[1] + 2];
  const mid = lerp(lead, tip, 0.62);
  const midT = lerp(trail, tip, 0.62);
  const z0 = far ? -6 : 8;
  const tone = far ? -0.22 : 0;
  const cA = lerp(lead, trail, 0.45);
  const cB = lerp(mid, midT, 0.45);
  const q = (pts: V[]): P2[] => grow(pts.map(L), 0.45);
  // Primaries first (the furthest layer), outermost on top.
  const n2 = d === 4 ? 5 : 3;
  for (let i = n2 - 1; i >= 0; i--) {
    const C0 = lerp(mid, midT, i / n2);
    const C1 = lerp(mid, midT, (i + 1) / n2);
    const Q0 = lerp(tip, midT, (i / n2) * 0.9);
    const Q1 = lerp(tip, midT, ((i + 1) / n2) * 0.9);
    c.blob(q([C0, C1, Q1, Q0]), 0.45, { mat: m.tip, z: z0 + (n2 - i) * 0.6, tone, bulge: 0.1 });
  }
  // The white mirror spot near the end of the outer primary (and a white tip at 4×).
  const mir = L(lerp(mid, tip, 0.45));
  c.ellipsoid(mir[0], mir[1] + 0.15, 0.75, 0.6, { mat: m.white, z: z0 + n2 * 0.6 + 1, tone: tone + 0.1 });
  if (d === 4 && !far) {
    const ap = L(lerp(tip, mid, 0.07));
    c.ellipsoid(ap[0], ap[1], 0.4, 0.4, { mat: m.white, z: z0 + n2 * 0.6 + 1 });
  }
  // Secondaries: feather cards across the trailing half of the arm, proximal ones nearest.
  const n = d === 4 ? 4 : 3;
  for (let i = n - 1; i >= 0; i--) {
    const a0 = lerp(cA, cB, i / n);
    const a1 = lerp(cA, cB, (i + 1) / n);
    const b0 = lerp(trail, midT, i / n);
    const b1 = lerp(trail, midT, (i + 1) / n);
    const z = z0 + 4 + (n - i) * 0.6;
    const part = c.newPart();
    c.blob(q([a0, a1, b1, b0]), 0.5, { mat: m.grey, z, part, tone: tone + (i & 1 ? 0.03 : -0.03), bulge: 0.12 });
    if (!far) c.blob(q([lerp(a0, b0, 0.8), lerp(a1, b1, 0.8), b1, b0]), 0.3, { mat: m.white, z: z + 0.05, part, bulge: 0.05 });
  }
  // The covert panel along the leading edge (the nearest layer of the wing).
  c.blob(q([lead, mid, cB, cA]), 0.9, { mat: m.grey, z: z0 + 9, tone: tone + 0.06, bulge: 0.25, tex: far ? null : scallops(1.3, 1.1, 0.14) });
}

/**
 * The HD gull (density d): the 1× pose — same shapes on the same logical pixels, 44 × 40 — as lit
 * volumes: the white body, head and tail with cool shading and near-white light, the pale grey
 * mantle with scapular rows (4×), layered wings (`wingHd`), the hooked yellow beak with its gape
 * line, red gonys spot and darker hook, a pale yellow eye with a pupil, a red orbital ring (4×)
 * and the frown, pink legs with webbed feet; the fries cone with its stripes and lit fries.
 */
export function gullHd(p: GullPose, d: HdD): Frame {
  const perched = p.perched === true;
  const oy = perched ? H - 2 : OY;
  const c = new HdCanvas(W, H, d);
  const by = perched ? -11 : 0;
  const wings = p.wings ?? (perched ? 'rest' : 'mid');
  const tips: Record<GullWings, V> = {
    up: [-8, -20],
    mid: [-21, -5],
    down: [-12, 13],
    wide: [-3, -22],
    folded: [-15, 0],
    rest: [-13, 1],
  };
  const tip = p.tip ?? tips[wings];
  const sh: V = [1, by - 3];
  /** The centre of the 1× pixel at body-space point v. */
  const L = (v: V): P2 => [OX + v[0] + 0.5, oy + v[1] + 0.5];
  const m: GullMats = {
    white: c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6, spec: 0.25, shine: 14, wrap: 0.12 }),
    // Feather greys on the steel ramp from its slate tone up: the separations between feathers
    // (the ramp's first tone) are soft slate lines, not ink stripes.
    grey: c.material({ ramp: PAL_HD.steel.slice(2), lo: 1, hi: 4, spec: 0.2, shine: 10, wrap: 0.1 }),
    tip: c.material({ ramp: PAL_HD.black, lo: 1, hi: 3, spec: 0.35, shine: 16, wrap: 0.05 }),
    beak: c.material({ ramp: PAL_HD.gold, lo: 3, hi: 6, spec: 0.7, shine: 22, wrap: 0.05 }),
    leg: c.material({ ramp: PAL_HD.pink, lo: 2, hi: 5, spec: 0.3, shine: 12 }),
    mouth: c.material({ ramp: PAL_HD.red, lo: 2, hi: 4, wrap: 0.2 }),
    paper: c.material({ ramp: PAL_HD.red, lo: 3, hi: 6, spec: 0.15, wrap: 0.1 }),
    stripe: c.material({ ramp: PAL_HD.snow, lo: 3, hi: 6, spec: 0.15, wrap: 0.1 }),
    fry: c.material({ ramp: PAL_HD.gold, lo: 4, hi: 6, spec: 0.3, shine: 12 }),
  };
  if (wings === 'up' || wings === 'wide' || wings === 'mid') wingHd(c, m, L, sh, [tip[0] + 5, tip[1] - 2], true);
  if (perched) {
    // Pink legs (a lit shin, a joint at 4×) and webbed feet.
    for (const x of [-2, 1]) {
      const a = L([x, -6]);
      const b = L([x, -1.6]);
      c.capsule(a[0], a[1], b[0], b[1], 0.55, 0.5, { mat: m.leg, z: -2 });
      if (d === 4) c.ellipsoid(a[0], a[1] + 2, 0.6, 0.45, { mat: m.leg, z: -1.8 });
    }
    for (const [x0, x1] of [[-4, 0], [-1, 3]] as const) {
      const a = L([x0, -1]);
      const b = L([x1, -1]);
      c.blob([[a[0] - 0.4, a[1] - 0.5], [b[0] + 0.5, b[1] - 0.3], [b[0] + 0.5, b[1] + 0.5], [a[0] - 0.5, a[1] + 0.5]], 0.35, { mat: m.leg, z: -1.5, tone: -0.05 });
    }
  }
  // Tail (white, behind the body; feather separations at 4×).
  const tail = grow([L([-8, by - 2]), L([-15, by - 1 + (perched ? 3 : 0)]), L([-14, by + 2 + (perched ? 3 : 0)]), L([-7, by + 3])], 0.45);
  const tailPart = c.newPart();
  c.blob(tail, 0.8, { mat: m.white, z: -1, part: tailPart, bulge: 0.15 });
  if (d === 4) {
    const t0 = L([-11, by]);
    c.shade(t0[0] - 5, t0[1] - 4, 8, 8, (x, y) => (Math.abs(frac((y - t0[1]) / 1.3 + (x - t0[0]) * 0.12) - 0.5) < 0.08 && x < t0[0] + 2 ? -0.25 : 0), tailPart);
  }
  // Body: a big white teardrop, the pale grey mantle on the back with scapular rows.
  const bc = [OX, oy + by] as const;
  // One part: the mantle meets the white body in a clean colour edge, not a separation line.
  const body = c.newPart();
  c.ellipsoid(bc[0], bc[1], 9, 5, { mat: m.white, z: 0, part: body });
  c.ellipsoid(bc[0] - 1.5, bc[1] - 3, 6.5, 2.05, { mat: m.grey, z: 3.2, part: body, tex: scallops(1.4, 1.0, 0.12) });
  // Head and neck (one part).
  const hx = p.tucked ? 2 : p.face === 'dive' ? 8 : 6;
  const hy = by + (p.tucked ? -3 : p.face === 'dive' ? 1 : -6) + (p.peck ?? 0);
  const head = c.newPart();
  const hc = L([hx, hy]);
  c.ellipsoid(hc[0], hc[1], 4.5, 4.5, { mat: m.white, z: 2, part: head });
  if (!p.tucked) c.capsule(OX + 4, oy + by - 1, OX + hx + 1, oy + hy + 1, 2, 2, { mat: m.white, z: 2, part: head });
  const face = p.face ?? 'open';
  if (!p.tucked) {
    const down = face === 'dive' ? 2 : 0;
    const B = (x: number, y: number): P2 => L([hx + x, hy + y]);
    if (face === 'kaw') {
      // Open beak: a red gape and a pink tongue between the mandibles.
      c.poly([B(3, -0.4), B(8.5, -2.6), B(8.5, 2.6), B(3, 1.6)], { mat: m.mouth, z: 6 });
      c.blob(grow([B(3, -1), B(10, -4), B(9, -2), B(4, 0)], 0.35), 0.4, { mat: m.beak, z: 7, bulge: 0.1 });
      c.blob(grow([B(3, 1), B(9, 3), B(4, 2)], 0.35), 0.35, { mat: m.beak, z: 7, tone: -0.1, bulge: 0.1 });
      const tg = B(6.6, 1.2);
      inkDisc(c, tg[0], tg[1], 0.45, PAL_HD.pink[5]);
    } else {
      const beak = c.newPart();
      c.blob(grow([B(3, -1), B(10, down), B(10, 2 + down), B(3, 2)], 0.4), 0.55, { mat: m.beak, z: 7, part: beak, bulge: 0.1 });
      // The darker hook, the gape line, the red gonys spot.
      const hk = B(9.6, down);
      c.shade(hk[0] - 0.6, hk[1] - 1, 2, 4, () => -0.35, beak);
      inkLine(c, B(3.4, 1.15), B(8.6, 1.15 + down * 0.5), 0.5 / d, PAL_HD.gold[1]);
      const gs = B(8.1, 1.6 + down);
      inkDisc(c, gs[0], gs[1], d === 4 ? 0.55 : 0.5, PAL_HD.red[5]);
      if (d === 4) inkDisc(c, gs[0] + 0.1, gs[1] + 0.1, 0.25, PAL_HD.red[3]);
    }
  }
  // The eye and the frown.
  const E = (x: number, y: number): P2 => L([hx + x, hy + y]);
  const brow = d === 4 ? 0.36 : 0.45;
  if (p.tucked) inkLine(c, E(-0.2, 0), E(1.6, 0), 0.4, INK);
  else if (face === 'x') {
    inkLine(c, E(0, -2), E(2, 0), brow, INK);
    inkLine(c, E(0, 0), E(2, -2), brow, INK);
  } else if (face === 'shut') inkLine(c, E(-0.1, -1), E(2.4, -0.8), 0.42, INK);
  else if (face === 'happy') {
    inkLine(c, E(0, -0.8), E(1, -1.9), brow, INK);
    inkLine(c, E(1, -1.9), E(2, -0.8), brow, INK);
  } else {
    const ec = E(1.4, -0.9);
    if (d === 4) inkDisc(c, ec[0], ec[1], 0.85, PAL_HD.red[4]);
    inkDisc(c, ec[0], ec[1], d === 4 ? 0.62 : 0.72, PAL_HD.gold[6]);
    inkDisc(c, ec[0] + 0.32, ec[1] + 0.05, d === 4 ? 0.3 : 0.45, INK);
    if (d === 4) c.dot(ec[0] + 0.1, ec[1] - 0.3, PAL_HD.snow[6]);
    // The frown: a brow slanting down to the beak.
    inkLine(c, E(-0.6, -2.6), E(1.4, -2.2), brow, INK);
    inkLine(c, E(1.4, -2.2), E(2.6, -1.3), brow, INK);
  }
  // Near wing in front.
  if (wings === 'rest' || wings === 'folded') {
    const wz = 9;
    const W0 = grow([L([2, by - 4]), L([-6, by - 5]), L([tip[0], by + tip[1] - 1]), L([-4, by + 1])], 0.45);
    const fold = c.newPart();
    c.blob(W0, 0.9, { mat: m.grey, z: wz, part: fold, bulge: 0.25, tex: scallops(1.3, 1.1, 0.14) });
    // The secondaries under the coverts: a lower band, its white tips along the lower edge.
    const lowA = L([-4, by + 1]);
    const lowB = L([tip[0] + 1, by + tip[1] - 1]);
    const sec = c.newPart();
    c.blob(grow([L([-5, by - 1.4]), L([tip[0] + 2, by + tip[1] - 2.4]), lowB, lowA], 0.3), 0.5, { mat: m.grey, z: wz + 0.9, part: sec, tone: -0.06, bulge: 0.1 });
    inkLine(c, [lowA[0] - 0.2, lowA[1] - 0.15], [lowB[0] + 1.2, lowB[1] - 0.25], d === 4 ? 0.3 : 0.3, PAL_HD.snow[5]);
    // Tertial crescent: a white edge along the top of the folded wing.
    inkLine(c, L([-5, by - 4.3]), L([1, by - 3.8]), d === 4 ? 0.3 : 0.32, PAL_HD.snow[5]);
    // The black primaries (two or three long feathers) and the mirror spot.
    const pa = L([-8, by - 3]);
    const pb = L([tip[0] - 1, by + tip[1] - 1]);
    const pc = L([-8, by]);
    const np = d === 4 ? 3 : 2;
    for (let i = 0; i < np; i++) {
      const t0 = i / np;
      const t1 = (i + 1) / np;
      const A0: P2 = [pa[0] + (pc[0] - pa[0]) * t0, pa[1] + (pc[1] - pa[1]) * t0];
      const A1: P2 = [pa[0] + (pc[0] - pa[0]) * t1, pa[1] + (pc[1] - pa[1]) * t1];
      const tipI: P2 = [pb[0] + i * 0.9, pb[1] - i * 0.3];
      c.blob(grow([A0, A1, tipI], 0.45), 0.4, { mat: m.tip, z: wz + 1 + (np - i) * 0.6, bulge: 0.08 });
    }
    const mr = L([-10, by - 1]);
    c.ellipsoid(mr[0], mr[1], 0.7, 0.55, { mat: m.white, z: wz + 4 });
  } else wingHd(c, m, L, [sh[0] - 1, sh[1] + 1], tip, false);
  // Flying feet tucked under the tail.
  if (!perched) {
    const a = L([-6, 4]);
    c.capsule(a[0], a[1], a[0] + 2, a[1], 0.45, 0.45, { mat: m.leg, z: 1, tone: -0.15 });
  }
  // Fries: a red-and-white paper cone with lit yellow fries.
  if (p.fries) {
    const fx = p.fries === 1 ? hx + 9 : 12;
    const fy = p.fries === 1 ? hy + 3 : -1;
    const cone = grow([L([fx - 3, fy - 6]), L([fx + 3, fy - 6]), L([fx, fy])], 0.45);
    const cx = OX + fx + 0.5;
    c.blob(cone, 0.6, {
      mat: m.paper,
      z: 10,
      bulge: 0.1,
      tex: (s) => {
        if (Math.abs(Math.abs(s.x - cx) - 1) < 0.5) s.mat = m.stripe;
      },
    });
    for (let k = -2; k <= 2; k++) {
      const a = L([fx + k, fy - 9 + (k & 1)]);
      const b = L([fx + k, fy - 6.6]);
      c.capsule(a[0], a[1], b[0], b[1], 0.48, 0.48, { mat: m.fry, z: 9.5 + (k & 1) * 0.6 });
    }
  }
  return { buf: c.render({ outline: 'A', ao: 0.3, rimLight: 2 }), ox: OX, oy, density: d };
}

/** The HD feather (9 × 9 logical, centre anchor): a white tapered vane, a grey shaft at 4×, a grey outline. */
function featherFramesHd(d: HdD): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const c = new HdCanvas(9, 9, d);
    const vane = c.material({ ramp: PAL_HD.snow, lo: 2, hi: 5, spec: 0.3, shine: 12, wrap: 0.2 });
    const shaft = c.material({ ramp: PAL_HD.steel, lo: 3, hi: 5 });
    const pts = [
      [1, 4, 7, 4],
      [2, 6, 6, 2],
      [4, 1, 4, 7],
      [2, 2, 6, 6],
    ][i];
    const a: P2 = [pts[0] + 0.5, pts[1] + 0.5];
    const b: P2 = [pts[2] + 0.5, pts[3] + 0.5];
    c.capsule(a[0], a[1], b[0], b[1], 0.62, 0.42, { mat: vane, z: 0 });
    if (d === 4) c.capsule(a[0], a[1], b[0], b[1], 0.13, 0.13, { mat: shaft, z: 2 });
    inkDisc(c, b[0], b[1], 0.45, PAL_HD.steel[5]);
    return { buf: c.render({ outline: 'A', ink: PAL.steel[2], ao: 0 }), ox: 4, oy: 4, density: d };
  });
}

type Pose = GullPose;

/** Flap wing tips (shoulder space): up, ease out, mid, ease in, down, the up-stroke. */
const FLAP_TIPS: readonly (readonly [number, number])[] = [[-8, -20], [-16, -13], [-21, -5], [-17, 6], [-12, 13], [-18, -9]];
/** Flap timing: the turning points (up, down) hold a little longer. */
export const FLAP_WALK = [4, 3, 3, 3, 4, 3];
export const FLAP_IDLE = [5, 4, 3, 4, 5, 3];

/** Take-off: crouch (head down, wings half up), push off (wings up), first down-stroke. */
const TAKEOFF_POSES: Pose[] = [
  { perched: true, peck: 1, wings: 'mid', tip: [-12, -9] },
  { perched: true, wings: 'up' },
  { perched: true, wings: 'down', tip: [-13, 9] },
];
/**
 * How far (px) each take-off frame lifts the bird above its anchor. All 0: the anchor itself rises
 * ~0.85 px a tick during the take-off (the fly mode), so an extra lift made the body jump 4 px and
 * then drop 5 px back at the hand-off to the flap (verifier, arena trace).
 */
const TAKEOFF_LIFT = [0, 0, 0];
export const TAKEOFF_TIMING = [3, 3, 4];
export const PULLUP_TIMING = [3, 3];
export const TURN_TICKS = 2;

/** The poses of each plain strip (the 1× generator above uses the same lists). */
const POSES: Record<string, Pose[]> = {
  walk: FLAP_POSES(),
  idle: FLAP_POSES(),
  perch: [{ perched: true }, { perched: true, peck: 1 }],
  gag: [{ perched: true, tucked: true }, { perched: true, tucked: true, peck: 1 }],
  'gag-fries': [{ perched: true, fries: 2 }, { perched: true, fries: 2, peck: 4 }, { perched: true, fries: 1 }, { perched: true, fries: 1, peck: 1 }],
  alert: [{ perched: true, face: 'kaw' }, { perched: true, wings: 'up', face: 'open' }],
  tell: [{ wings: 'wide', face: 'kaw' }, { wings: 'up', face: 'kaw' }],
  attack: [{ wings: 'folded', face: 'dive' }, { wings: 'folded', face: 'dive', peck: 1 }],
  die: [{ wings: 'up', face: 'x' }, { wings: 'down', face: 'x' }, { wings: 'rest', face: 'x' }],
  'photo-pose': [{ wings: 'wide', face: 'happy' }],
  'pull-up': [{ wings: 'down', face: 'dive', tip: [-15, 9] }, { wings: 'mid', tip: [-20, 1] }],
};

/** The 6-frame flap: up, two down-stroke in-betweens, down, a swept-back up-stroke. */
function FLAP_POSES(): Pose[] {
  return FLAP_TIPS.map((tip) => ({ wings: tip[1] < 0 ? 'mid' : 'down', tip }));
}

/** A perched frame re-anchored at its body centre (11 px above the feet), lifted `lift` px. */
function lifted(f: Frame, lift: number): Frame {
  return { ...f, oy: f.oy - 11 + lift };
}

/** A dense buffer on the 1× frame `lo`'s anchor (the same logical box). */
function onLo(buf: PixelBuffer, lo: Frame, d: number): Frame {
  return { buf, ox: lo.ox, oy: lo.oy, density: d };
}

/** The HD gull of a pose on the 1× frame `f1`'s anchor (the same 44 × 40 logical canvas). */
function gullOn(pose: Pose, f1: Frame, d: HdD): Frame {
  return { ...gullHd(pose, d), ox: f1.ox, oy: f1.oy, ...(f1.pts ? { pts: f1.pts } : {}) };
}

/**
 * The HD strip `name` (an enemy/seagull/… suffix) at density d, each frame on the 1× frame (`lo`)
 * it twins. Death strips repeat the 1× recipe on the HD pose: scorch and soot step along the HD
 * ramps, the quarter turns are exact, flames and the crumbling ash are drawn natively
 * (`withFlamesDense`, `crumbleDense`), the crush squashes whole logical px (`crushStripHi`).
 */
export function gullStripHd(name: string, d: HdD, lo: readonly Frame[]): Frame[] {
  const poses = POSES[name];
  if (poses) return poses.map((pose, i) => onLo(gullHd(pose, d).buf, lo[i], d));
  if (name === 'feather') return featherFramesHd(d);
  if (name === 'takeoff') return TAKEOFF_POSES.map((pose, i) => onLo(gullHd(pose, d).buf, lo[i], d));
  if (name === 'turn') {
    const mid = gull({ wings: 'mid' });
    return turnSquash(gullOn({ wings: 'mid' }, mid, d));
  }
  if (name === 'die-blast') {
    const fd = gullHd({ wings: 'rest', face: 'x' }, d);
    const sd = sootify(fd, 1, false).buf;
    return [onLo(scorch(fd, 2).buf, lo[0], d), ...[1, 2, 3, 2].map((q, i) => onLo(sd.rotated((q * Math.PI) / 2), lo[i + 1], d))];
  }
  if (name === 'die-burn') {
    const f1 = grounded(gull({ wings: 'rest', face: 'shut' }));
    const fd = gullOn({ wings: 'rest', face: 'shut' }, f1, d);
    const sc1 = scorch(f1, 1);
    const scd = scorch(fd, 1);
    const s1 = sootify(f1, 1, false);
    const sd = sootify(fd, 1, false);
    const ash = (t: number): Frame => crumbleDense(s1, sd, t);
    const out = [withFlamesDense(sc1, scd, 0), withFlamesDense(sc1, scd, 1), withFlamesDense(s1, sd, 2, 9, 5), sd, sd, sd, ash(0.4), ash(0.75), ash(1), ash(1), ash(1), ash(1)];
    return out.map((f, i) => onLo(f.buf, lo[i], d));
  }
  if (name === 'die-crush') {
    const f1 = grounded(gull({ wings: 'wide', face: 'x' }));
    return crushStripHi(f1, gullOn({ wings: 'wide', face: 'x' }, f1, d), lo);
  }
  throw new Error(`no HD strip "${name}"`);
}

/** Every strip of the gull (the HD generators cover them all). */
export const GULL_STRIPS = [...Object.keys(POSES), 'feather', 'takeoff', 'turn', 'die-blast', 'die-burn', 'die-crush'];

const A = 'enemy/seagull/';

defineSprite(A + 'walk', () => FLAP_POSES().map((p) => gull(p)), { durations: FLAP_WALK });
defineSprite(A + 'idle', () => FLAP_POSES().map((p) => gull(p)), { durations: FLAP_IDLE });
defineSprite(A + 'takeoff', () => TAKEOFF_POSES.map((p, i) => lifted(gull(p), TAKEOFF_LIFT[i])), { durations: TAKEOFF_TIMING, loop: false });
defineSprite(A + 'pull-up', () => POSES['pull-up'].map((p) => gull(p)), { durations: PULLUP_TIMING, loop: false });
defineSprite(A + 'turn', () => turnSquash(gull({ wings: 'mid' })), { ticksPerFrame: TURN_TICKS });
defineSprite(A + 'perch', () => [gull({ perched: true }), gull({ perched: true, peck: 1 })], { durations: [40, 10] });
defineSprite(A + 'gag', () => [gull({ perched: true, tucked: true }), gull({ perched: true, tucked: true, peck: 1 })], { ticksPerFrame: 30 });
defineSprite(A + 'gag-fries', () => [gull({ perched: true, fries: 2 }), gull({ perched: true, fries: 2, peck: 4 }), gull({ perched: true, fries: 1 }), gull({ perched: true, fries: 1, peck: 1 })], { durations: [14, 8, 16, 8] });
defineSprite(A + 'alert', () => [gull({ perched: true, face: 'kaw' }), gull({ perched: true, wings: 'up', face: 'open' })], { ticksPerFrame: 6 });
defineSprite(A + 'tell', () => [gull({ wings: 'wide', face: 'kaw' }), gull({ wings: 'up', face: 'kaw' })], { ticksPerFrame: 3 });
defineSprite(A + 'attack', () => [gull({ wings: 'folded', face: 'dive' }), gull({ wings: 'folded', face: 'dive', peck: 1 })], { ticksPerFrame: 4 });
defineSprite(A + 'die', () => [grounded(gull({ wings: 'up', face: 'x' })), grounded(gull({ wings: 'down', face: 'x' })), grounded(gull({ wings: 'rest', face: 'x' }))], { durations: [6, 6, 40], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(grounded(gull({ wings: 'rest', face: 'x' })), null), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(grounded(gull({ wings: 'rest', face: 'shut' })), null), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(grounded(gull({ wings: 'wide', face: 'x' }))), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'photo-pose', () => gull({ wings: 'wide', face: 'happy' }));
defineSprite(A + 'feather', featherFrames, { ticksPerFrame: 6 });

// UHD art (mission ams): one density-generic generator per strip for 2× and 4×. `idle` is the
// `walk` flap (the same frames, slower): a dense alias of it, built and held once.
for (const name of GULL_STRIPS) {
  if (name === 'idle') defineDenseAlias(A + name, A + 'walk');
  else defineHdSprite(A + name, (d) => gullStripHd(name, d, getFrames(A + name, 1)));
}
