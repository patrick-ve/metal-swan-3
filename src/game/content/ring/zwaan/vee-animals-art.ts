/**
 * The livestock trailer's animals (`boss/ring-zwaan/vee/cow-*`, `pig-*`; docs/design/ring.md §R.3):
 * a patched black-and-white Dutch dairy cow and a pink pig, ONE density-generic drawer each (`PAL`
 * at 1×, `PAL_HD` at 2× / 4×), outline A (they move and block shots), anchor = the middle between
 * the hooves on the road line, facing right (the animals trot back: the game draws them flipped).
 * The animals are never hurt: no hurt, death or blood strips exist.
 *
 * | id | frames | what |
 * |---|---|---|
 * | `cow-walk` | 4 | a four-beat walk |
 * | `cow-trot` | 4 | the trot (diagonal pairs, a bob, the tail up) |
 * | `cow-graze` | 3 | head down in the grass: chewing, the tail swishing |
 * | `pig-walk` | 4 | a walk |
 * | `pig-trot` | 4 | a quick trot (ears flapping) |
 * | `pig-graze` | 2 | the snout down, rooting |
 */
import type { Frame } from '../../../../engine/render';
import { defStrip, hash2, Pen, turnPt, type Turn } from '../boss/art-kit';
import { bot, finishA, mat, top, type Dn } from '../../stag/kit.art';
import { VEE_SPR } from './vee-geo';

type Gait = 'walk' | 'trot' | 'graze';

/** The Holstein patches (ellipses in the cow's local space: cx, cy, rx, ry). */
const PATCHES: ReadonlyArray<readonly [number, number, number, number]> = [
  [-7, -17, 5.2, 4.2],
  [2.5, -12.5, 4.4, 3.4],
  [-12, -12, 2.8, 4],
  [8.5, -18.6, 3.2, 2.6],
  [-2, -20.4, 2.6, 1.6],
];

function inPatch(x: number, y: number): boolean {
  for (const [cx, cy, rx, ry] of PATCHES) {
    // A ragged edge (deterministic wobble).
    const a = Math.atan2(y - cy, x - cx);
    const k = 1 + 0.16 * Math.sin(a * 3 + cx) + 0.1 * Math.sin(a * 5 + cy);
    if (Math.hypot((x - cx) / rx, (y - cy) / ry) < k) return true;
  }
  return false;
}

/** Leg swing (radians) and hoof lift for leg `i` (0 near-hind, 1 near-front, 2 far-hind, 3 far-front). */
function legPose(gait: Gait, f: number, i: number): [number, number] {
  if (gait === 'graze') return [[0.05, -0.08, 0.12, -0.04][i], 0];
  const ph = (f / 4) * Math.PI * 2;
  const off = gait === 'walk' ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5][i] : [0, Math.PI, Math.PI, 0][i];
  const amp = gait === 'walk' ? 0.32 : 0.5;
  const s = Math.sin(ph + off);
  const lift = Math.max(0, Math.cos(ph + off)) * (gait === 'walk' ? 1.2 : 2.4);
  return [s * amp, lift];
}

/** One leg: a thigh, a shin, a dark hoof (the far legs a shade darker). */
function leg(p: Pen, hipX: number, hipY: number, len: number, a: number, lift: number, r0: number, r1: number, m: number, hoof: number, far: boolean): void {
  const kx = hipX + Math.sin(a) * len * 0.5;
  const ky = hipY + Math.cos(a) * len * 0.5;
  const fx = kx + Math.sin(a * 0.4) * len * 0.5;
  const fy = Math.min(-0.9, ky + Math.cos(a * 0.4) * len * 0.5 - lift);
  const tone = far ? -0.35 : 0;
  const z = far ? 0.2 : 3;
  p.capsule(hipX, hipY, kx, ky, r0, (r0 + r1) / 2, { mat: m, z, tone });
  p.capsule(kx, ky, fx, fy, (r0 + r1) / 2, r1, { mat: m, z: z + 0.1, tone });
  p.box(fx - r1 - 0.2, fy - 0.2, r1 * 2 + 0.6, 1.4, { mat: hoof, z: z + 0.2, r: 0.4, tone });
}

/** The cow (facing right, anchor between the hooves). */
export function cowFrame(gait: Gait, f: number, d: Dn): Frame {
  const p = new Pen(-21, -30, 46, 32, d);
  const c = p.c;
  const white = mat(c, 'snow', { spec: 0.25, shine: 14, lo1: 1, hi1: 3, lo: 2, hi: 5, bounce: 0.3 });
  const black = mat(c, 'black', { spec: 0.35, shine: 18, lo1: 0, hi1: 2, lo: 1, hi: 4, rim: 0.3 });
  const pink = mat(c, 'pink', { spec: 0.5, shine: 26, lo1: 0, hi1: 2, lo: 2, hi: 5 });
  const hoof = mat(c, 'black', { spec: 0.6, lo1: 0, hi1: 1, lo: 0, hi: 2 });
  const tag = mat(c, 'gold', { spec: 0.5, lo1: 2, hi1: 3, lo: 3, hi: 5 });
  const bob = gait === 'trot' ? (f % 2 === 0 ? -0.8 : 0.4) : gait === 'walk' ? (f % 2 === 0 ? -0.3 : 0) : 0;
  // The far legs first, then the body, then the near legs (in front).
  const legs: Array<[number, number]> = [
    [-9.5, -10.5],
    [8.5, -10.5],
    [-11, -11],
    [7, -11],
  ];
  const legMat = (_i: number): number => white;
  for (const i of [2, 3]) {
    const [a, lift] = legPose(gait, f, i);
    leg(p, legs[i][0], legs[i][1] + bob, 10.6 - bob, a, lift, 1.7, 1.15, legMat(i), hoof, true);
  }
  // The udder (pink, between the hind legs).
  p.ellipsoid(-5.5, -9.6 + bob, 2.6, 1.9, { mat: pink, z: 1.4 });
  // The body: a barrel with a straight back, a deep chest and the hip bones showing.
  p.body(
    [[-15, -20 + bob], [-13, -23 + bob], [-4, -22.6 + bob], [6, -22.8 + bob], [12, -21.6 + bob], [13.6, -16 + bob], [11.6, -10.4 + bob], [3, -9.6 + bob], [-8, -10.2 + bob], [-14.4, -12 + bob], [-15.6, -16 + bob]],
    3.6,
    { mat: white, z: 1.6 },
    (x, y) => (Math.hypot(x + 12, y - (-21.4 + bob)) < 2.4 ? 0.8 : 0) + (Math.hypot(x - 9, y - (-20.8 + bob)) < 2.6 ? 0.5 : 0),
    undefined,
    (t, x, y) => {
      if (inPatch(x, y - bob)) t.mat = black;
      if (p.d > 1 && hash2(Math.floor(x * 3), Math.floor(y * 3)) < 0.05) t.tone -= 0.15;
    },
  );
  // The tail: down from the tail-head, a black switch; up and out in the trot, swishing in the graze.
  const sw = gait === 'graze' ? [-1.6, 0, 1.6][f % 3] : 0;
  const tailEnd: [number, number] = gait === 'trot' ? [-20, -17 + bob] : [-16.2 + sw, -8];
  p.stroke([[-14.6, -21 + bob], [-16.2 + sw * 0.4, -16 + bob], tailEnd], 0.55, 0.45, { mat: white, z: 1.2 });
  p.ellipsoid(tailEnd[0], tailEnd[1] + 0.8, 0.9, 1.6, { mat: black, z: 1.3 });
  // The neck and the head: up and forward, or (grazing) turned down into the grass about the
  // neck's root. The head: a long Holstein head, black with a white blaze, a pink muzzle.
  const down = gait === 'graze';
  const chew = down ? (f % 2) * 0.35 : 0;
  const T: Turn | null = down ? { rot: 84, px: 11, py: -18 + bob } : null;
  const tp = (pts: ReadonlyArray<readonly [number, number]>): Array<[number, number]> => pts.map(([x, y]) => turnPt(T, x, y + bob));
  p.body(tp([[7.4, -22.6], [14.8, -24], [17.2, -21.6], [16.4, -17.6], [13.6, -12.4], [8.4, -11.6]]), 2.6, { mat: white, z: 2.2 }, undefined, undefined, (t, x, y) => {
    const [u, v] = T ? turnPt({ rot: -84, px: 11, py: -18 + bob }, x, y) : [x, y];
    if (Math.hypot((u - 13) / 2.6, (v - bob + 21.4) / 2) < 1) t.mat = black;
  });
  const head = tp([[15.4, -24.4], [18.6, -24.2], [22.8, -18.4], [22.6, -15.6 + chew], [19.2, -15.2 + chew], [15.4, -18.8]]);
  p.body(head, 1.4, { mat: black, z: 2.8 });
  p.poly(tp([[18.4, -24], [19.4, -23.8], [22.2, -18.6], [21.2, -18.4]]), { mat: white, z: 4.6 });
  const [mx, my] = turnPt(T, 21.8, -16.6 + bob + chew * 0.5);
  p.ellipsoid(mx, my, 1.9, 1.6, { mat: pink, z: 5 });
  const ink = bot('black', d, 0);
  const [nx, ny] = turnPt(T, 22.6, -17.2 + bob);
  p.dot(nx, ny, ink);
  const eye = top('snow', d, 1);
  const [ex, ey] = turnPt(T, 18, -21.4 + bob);
  p.dot(ex, ey, eye);
  p.dot(ex + (d > 1 ? 0.3 : 0), ey + (d > 1 ? 0.2 : 0), ink);
  const [ax, ay] = turnPt(T, 15, -22.8 + bob);
  p.ellipsoid(ax - 0.8, ay, 2.2, 0.95, { mat: black, z: 4.8 });
  p.box(ax - 1.4, ay + 0.3, 1.2, 1.2, { mat: tag, z: 5.2, r: 0.2 });
  // The near legs.
  for (const i of [0, 1]) {
    const [a, lift] = legPose(gait, f, i);
    leg(p, legs[i][0], legs[i][1] + bob, 10.6 - bob, a, lift, 1.8, 1.2, legMat(i), hoof, false);
  }
  return p.frame(finishA(c, 0.25));
}

/** The pig (facing right, anchor between the trotters). */
export function pigFrame(gait: Gait, f: number, d: Dn): Frame {
  const p = new Pen(-13, -16, 28, 18, d);
  const c = p.c;
  const skin = mat(c, 'pink', { spec: 0.45, shine: 22, lo1: 1, hi1: 2, lo: 4, hi: 7, bounce: 0.35 });
  const snout = mat(c, 'pink', { spec: 0.7, shine: 30, lo1: 0, hi1: 1, lo: 1, hi: 3 });
  const mud = mat(c, 'brown', { spec: 0.2, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const hoof = mat(c, 'brown', { spec: 0.5, lo1: 0, hi1: 1, lo: 0, hi: 2 });
  const bob = gait === 'trot' ? (f % 2 === 0 ? -0.7 : 0.3) : 0;
  const lp: Array<[number, number]> = [
    [-5, -4],
    [5, -4],
    [-6.2, -4.4],
    [3.8, -4.4],
  ];
  for (const i of [2, 3]) {
    const [a, lift] = legPose(gait, f, i);
    leg(p, lp[i][0], lp[i][1] + bob, 4.4 - bob, a * 0.9, lift * 0.6, 1.2, 0.9, skin, hoof, true);
  }
  // The body: round and low; mud on the belly and the legs.
  p.ellipsoid(-0.4, -7.6 + bob, 9.4, 5.2, {
    mat: skin,
    z: 1.6,
    tex: (t) => {
      const x = t.x + p.x0;
      const y = t.y + p.y0;
      if (y > -4.6 + bob + 1.2 * Math.sin(x * 0.9) && hash2(Math.floor(x * 0.8), Math.floor(y * 0.8)) < 0.6) t.mat = mud;
      if (p.d > 1 && hash2(Math.floor(x * 3), Math.floor(y * 3)) < 0.04) t.tone += 0.2;
    },
  });
  // The curly tail.
  p.stroke([[-9.4, -9.6 + bob], [-11, -10.6 + bob], [-11.4, -9 + bob], [-10.2, -8.8 + bob], [-10.6, -10 + bob]], 0.45, 0.4, { mat: skin, z: 1.2 });
  // The head: down while rooting.
  const down = gait === 'graze';
  const hx = down ? 9.2 : 9.4;
  const hy = down ? -3.8 + (f % 2) * 0.4 : -8 + bob;
  p.ellipsoid(hx, hy, 3.6, 3.2, { mat: skin, z: 2.4 });
  const sx = hx + (down ? 2 : 3.4);
  const sy = hy + (down ? 2.2 : 0.6);
  p.ellipsoid(sx, sy, 1.1, 1.6, { mat: snout, z: 3 });
  const ink = bot('black', d, 0);
  p.dot(sx + 0.5, sy - 0.4, ink);
  p.dot(sx + 0.5, sy + 0.6, ink);
  p.dot(hx + 0.6, hy - 1, ink);
  // The ear: a floppy triangle (it flaps in the trot).
  const flap = gait === 'trot' ? (f % 2 === 0 ? -1.2 : 0.6) : 0;
  p.poly([[hx - 2, hy - 2.6], [hx + 0.6, hy - 3.6 + flap], [hx + 1.6, hy - 0.8]], { mat: skin, z: 3.1, tone: 0.1 });
  for (const i of [0, 1]) {
    const [a, lift] = legPose(gait, f, i);
    leg(p, lp[i][0], lp[i][1] + bob, 4.4 - bob, a * 0.9, lift * 0.6, 1.3, 1, skin, hoof, false);
  }
  return p.frame(finishA(c, 0.25));
}

defStrip(VEE_SPR.cow('walk'), (d) => [0, 1, 2, 3].map((f) => cowFrame('walk', f, d)), { ticksPerFrame: 8 });
defStrip(VEE_SPR.cow('trot'), (d) => [0, 1, 2, 3].map((f) => cowFrame('trot', f, d)), { ticksPerFrame: 5 });
defStrip(VEE_SPR.cow('graze'), (d) => [0, 1, 2].map((f) => cowFrame('graze', f, d)), { ticksPerFrame: 14 });
defStrip(VEE_SPR.pig('walk'), (d) => [0, 1, 2, 3].map((f) => pigFrame('walk', f, d)), { ticksPerFrame: 6 });
defStrip(VEE_SPR.pig('trot'), (d) => [0, 1, 2, 3].map((f) => pigFrame('trot', f, d)), { ticksPerFrame: 4 });
defStrip(VEE_SPR.pig('graze'), (d) => [0, 1].map((f) => pigFrame('graze', f, d)), { ticksPerFrame: 12 });
