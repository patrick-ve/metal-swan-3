/**
 * Mission oldenzaal — the dead soldiers' art kit (revision 2, spec §3.1). Owner: ZOMBIES.
 *
 * The bodies are the human rig (`renderHuman`, the squad's own 1× / 2× / 4× pipeline: same
 * proportions, same light) dressed by a per-pixel pass in BODY SPACE:
 * - the rig draws the uniform in a marker ramp (`sky`) and the skin in another (`teal`); the pass
 *   maps them to faded field grey (`PAL_HD_OZ_R2.fieldGrey`) and rotting skin (`PAL_HD_OZ_R2.rot`)
 *   keeping the rig's tone (its light and form shading);
 * - every px of the uniform finds its limb (torso, thighs, shins, upper arms, forearms: the
 *   pose's joints) and reads value noise in that limb's own coordinates, so the dirt, the faded
 *   patches, the mud on the legs and the torn holes stay on the cloth from frame to frame;
 * - the shins become jackboots (black leather), a Y-strap crosses the chest, and the near upper
 *   arm's band (the rig's `armband`, accent red) gets its white disc and black symbol (spec R2-2:
 *   the ONLY symbol of the mission, on the villains only).
 * At 1× the same pass works on the 64-colour `PAL` (no torn holes: too noisy at 1 px).
 *
 * Geometry is law: the pass never moves a px, so every frame keeps its rig size, anchor and points.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ_R2 } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, type SpriteOpts } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';
import type { Density, HumanStyle, PoseJoints } from '../../../art/humanoid';

export type D = Density;

/** Register a strip at 1× and its UHD art (the same recipe at density 2 and 4). */
export function defHi(id: string, gen: (d: D) => Frame[], o: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d as D) });
}

// =============================================================================================
// Colours
// =============================================================================================

/** The marker ramps the rig draws in (unique hues: nothing else on a dead soldier uses them). */
export const MARK = { uniform: 'sky', skin: 'teal' } as const;

const FG = PAL_HD_OZ_R2.fieldGrey;
const ROT = PAL_HD_OZ_R2.rot;
/** Black leather (boots, belts, straps): HD. */
const LEATHER: Ramp = PAL_HD.black;

/** 1×: faded field grey (cool shadow → dusty warm grey), rotting skin, black leather. */
const FG_1: Ramp = [PAL.ink[1], PAL.olive[1], PAL.stone[1], PAL.stone[2]];
const ROT_1: Ramp = [PAL.olive[0], PAL.olive[1], PAL.stone[2], PAL.sand[2]];
const LEATHER_1: Ramp = [PAL.ink[0], PAL.ink[1], PAL.black[2], PAL.steel[1]];

interface Home {
  kind: 0 | 1; // 0 uniform, 1 skin
  t: number; // 0..1 along the marker ramp
}

function homes(uni: Ramp, skin: Ramp): Map<Color, Home> {
  const m = new Map<Color, Home>();
  uni.forEach((c, i) => m.set(c >>> 0, { kind: 0, t: i / Math.max(1, uni.length - 1) }));
  skin.forEach((c, i) => m.set(c >>> 0, { kind: 1, t: i / Math.max(1, skin.length - 1) }));
  return m;
}
const HOME_1 = homes(PAL.sky, PAL.teal);
const HOME_HD = homes(PAL_HD.sky, PAL_HD.teal);
const RED_1 = new Set<Color>(PAL.red.map((c) => c >>> 0));
const RED_HD = new Set<Color>(PAL_HD.red.map((c) => c >>> 0));

/** The tone of ramp r at t (0..1) shifted by `dk` steps, clamped. */
function at(r: Ramp, t: number, dk = 0): Color {
  const i = Math.round(t * (r.length - 1)) + dk;
  return r[i < 0 ? 0 : i >= r.length ? r.length - 1 : i];
}

// =============================================================================================
// The style
// =============================================================================================

export interface ZStyleOpts {
  build?: HumanStyle['build'];
  topType?: HumanStyle['topType'];
  /** Extra rig accessories (the armband is always on). */
  acc?: HumanStyle['accessories'];
}

/** A dead soldier for the rig: marker ramps, black leather, the red band, a bald head (the head is our own overlay). */
export function zStyle(o: ZStyleOpts = {}): HumanStyle {
  return {
    skin: MARK.skin,
    hair: 'stone',
    hairStyle: 'bald',
    headgear: 'none',
    gear: 'black',
    accent: 'red',
    top: MARK.uniform,
    topType: o.topType ?? 'tunic',
    pants: MARK.uniform,
    boots: 'black',
    belt: 'black',
    gloves: null,
    build: o.build ?? 'normal',
    accessories: ['armband', ...(o.acc ?? ['pouches'])],
  };
}

// =============================================================================================
// Body space: the limbs of a pose
// =============================================================================================

type P2 = readonly [number, number];

/** Limb segments: 0 torso, 1 thighN, 2 shinN, 3 thighF, 4 shinF, 5 upperN, 6 foreN, 7 upperF, 8 foreF. */
const SEG_COUNT = 9;
const SHIN_N = 2;
const SHIN_F = 4;
const TORSO = 0;

function segsOf(j: PoseJoints): Float64Array {
  const s = new Float64Array(SEG_COUNT * 4);
  const put = (k: number, a: P2, b: P2): void => {
    s[k * 4] = a[0];
    s[k * 4 + 1] = a[1];
    s[k * 4 + 2] = b[0];
    s[k * 4 + 3] = b[1];
  };
  put(0, j.pelvis, j.neck);
  put(1, j.hipN, j.kneeN);
  put(2, j.kneeN, j.ankleN);
  put(3, j.hipF, j.kneeF);
  put(4, j.kneeF, j.ankleF);
  put(5, j.shN, j.elN);
  put(6, j.elN, j.wrN);
  put(7, j.shF, j.elF);
  put(8, j.elF, j.wrF);
  return s;
}

/** Smooth value noise (0..1) at (u, v), cell 1; deterministic. */
export function vnoise(u: number, v: number, seed: number): number {
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// =============================================================================================
// The pass
// =============================================================================================

export interface DressOpts {
  /** Noise seed (one per look: two grunts of a set wear the same uniform, a coat another). */
  seed: number;
  /** Jackboots on the shins (default true). */
  boots?: boolean;
  /** The Y-strap over the chest (default true). */
  strap?: boolean;
  /** Wear (0..1; default 1): dirt, faded patches, mud, torn holes. */
  wear?: number;
  /** The white disc and the symbol on the band (default true). */
  symbol?: boolean;
  /** Pose rotation (deg) and offset, as the rig placed the figure (poseJoints already includes them). */
}

const NO_J: P2 = [0, 0];

/**
 * Dress a rig frame of a dead soldier (see the module comment). `j` = the pose's joints
 * (poseJoints, logical px relative to the anchor). Returns a dressed copy.
 */
export function dress(src: Frame, j: PoseJoints, o: DressOpts): Frame {
  // A copy: the rig memoises its frames.
  const f: Frame = { ...src, buf: src.buf.clone() };
  const d = f.density ?? 1;
  const hd = d > 1;
  const home = hd ? HOME_HD : HOME_1;
  const reds = hd ? RED_HD : RED_1;
  const fg = hd ? FG : FG_1;
  const rot = hd ? ROT : ROT_1;
  const lea = hd ? LEATHER : LEATHER_1;
  const wear = o.wear ?? 1;
  const boots = o.boots !== false;
  const strap = o.strap !== false;
  const seg = segsOf(j);
  const buf = f.buf;
  const data = buf.data;
  const W = buf.w;
  const H = buf.h;
  // The strap: from the near shoulder's front down to the belt's front (torso space).
  const nx = j.neck[0] - j.pelvis[0];
  const ny = j.neck[1] - j.pelvis[1];
  const tl = Math.hypot(nx, ny) || 1;
  // The band's centre (the rig draws it at 0.4–0.66 / 0.45–0.6 along the upper arm).
  const sh = j.shN ?? NO_J;
  const el = j.elN ?? NO_J;
  const bx = sh[0] + (el[0] - sh[0]) * 0.53;
  const by = sh[1] + (el[1] - sh[1]) * 0.53;
  const seed = o.seed;
  for (let Y = 0; Y < H; Y++) {
    const y = (Y + 0.5) / d - f.oy - 0.5;
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      const c = data[i];
      if ((c & 255) === 0) continue;
      const hm = home.get(c >>> 0);
      if (!hm) continue;
      const x = (X + 0.5) / d - f.ox - 0.5;
      // The nearest limb (body space).
      let best = Infinity;
      let bs = 0;
      let bt = 0;
      let bv = 0;
      for (let k = 0; k < SEG_COUNT; k++) {
        const ax = seg[k * 4];
        const ay = seg[k * 4 + 1];
        const vx = seg[k * 4 + 2] - ax;
        const vy = seg[k * 4 + 3] - ay;
        const l2 = vx * vx + vy * vy || 1;
        let t = ((x - ax) * vx + (y - ay) * vy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (ax + vx * t);
        const ey = y - (ay + vy * t);
        // The torso is thick: weigh its distance down so arms and legs win only near their bones.
        const dd = (ex * ex + ey * ey) * (k === TORSO ? 0.35 : 1);
        if (dd < best) {
          best = dd;
          bs = k;
          bt = t;
          const len = Math.sqrt(l2);
          bv = (vx * ey - vy * ex) / len;
          bt *= len;
        }
      }
      const n1 = vnoise(bt * 0.75 + bs * 13.1, bv * 0.75, seed);
      const n2 = vnoise(bt * 1.9 + bs * 7.7, bv * 1.9 + 3.3, seed + 17);
      if (hm.kind === 1) {
        // Rotting skin: blotches of a darker, greener decay.
        data[i] = at(rot, hm.t, n1 < 0.3 * wear ? -1 : 0);
        continue;
      }
      let ramp = fg;
      let dk = 0;
      const legLow = bs === SHIN_N || bs === SHIN_F;
      if (boots && legLow && bt >= 1.2) ramp = lea;
      if (strap && bs === TORSO) {
        // Torso coordinates: s 0 (belt) → 1 (collar), w across (+ = front).
        const s = ((x - j.pelvis[0]) * nx + (y - j.pelvis[1]) * ny) / (tl * tl);
        const w = ((x - j.pelvis[0]) * -ny + (y - j.pelvis[1]) * nx) / tl;
        // In side view the strap comes over the shoulder and runs down the chest to the belt's front.
        const sx = 0.6 + (1 - s) * 1.4;
        if (s > 0.05 && s < 1.02 && Math.abs(-w - sx) < (hd ? 0.55 : 0.5)) ramp = lea;
      }
      if (wear > 0) {
        if (n1 < 0.24 * wear) dk -= 1; // dirt, grime, wet
        else if (n1 > 1 - 0.14 * wear) dk += 1; // faded by the years in the ground
        if (legLow && n2 < 0.45 * wear) dk -= 1; // mud on the boots and the shins
        if (hd && ramp === fg && n2 > 1 - 0.035 * wear && best > 0.2) {
          // A torn hole: the rotting body shows through.
          data[i] = at(rot, Math.max(0, hm.t - 0.25), 0);
          continue;
        }
      }
      data[i] = at(ramp, hm.t, dk);
    }
  }
  if (o.symbol !== false) armbandSymbol(f, bx, by, reds);
  buf.touch();
  return f;
}

/** 4×: the symbol (5 × 5 art px; the user's decision R2-2). Rows top → bottom, x left → right. */
const SYM5 = ['X.XXX', 'X.X..', 'XXXXX', '..X.X', 'XXX.X'];
const DISC_HD = PAL_HD.cloth[3];
const DISC_RIM_HD = PAL_HD.cloth[1];
const SYM_INK = PAL_HD.ink[1];

/** The white disc and the black symbol on the band at (bx, by) (logical, anchor-relative): only on the band's red px. */
function armbandSymbol(f: Frame, bx: number, by: number, reds: ReadonlySet<Color>): void {
  const d = f.density ?? 1;
  const buf = f.buf;
  const cx = (bx + f.ox + 0.5) * d;
  const cy = (by + f.oy + 0.5) * d;
  const isRed = (X: number, Y: number): boolean => X >= 0 && Y >= 0 && X < buf.w && Y < buf.h && reds.has(buf.data[Y * buf.w + X] >>> 0);
  // 1×: a plain red band (one px could not hold the disc and the symbol; a light dot would read as another emblem).
  if (d === 1) return;
  const r = d >= 4 ? 3.6 : 1.6;
  const X0 = Math.floor(cx - r - 1);
  const Y0 = Math.floor(cy - r - 1);
  for (let Y = Y0; Y <= Math.ceil(cy + r + 1); Y++) {
    for (let X = X0; X <= Math.ceil(cx + r + 1); X++) {
      if (!isRed(X, Y)) continue;
      const q = Math.hypot(X + 0.5 - cx, Y + 0.5 - cy);
      if (q <= r - 0.7) buf.data[Y * buf.w + X] = DISC_HD;
      else if (q <= r) buf.data[Y * buf.w + X] = DISC_RIM_HD;
    }
  }
  if (d >= 4) {
    const sx = Math.round(cx - 2.5);
    const sy = Math.round(cy - 2.5);
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (SYM5[yy][xx] === 'X') buf.data[(sy + yy) * buf.w + sx + xx] = SYM_INK;
  } else {
    const X = Math.floor(cx);
    const Y = Math.floor(cy);
    if (isRed(X, Y) || buf.data[Y * buf.w + X] === DISC_HD) buf.data[Y * buf.w + X] = SYM_INK;
  }
}

/** Erase every px of `f` below the floor line y ≥ `cut` (logical, anchor-relative): rising out of the ground. */
export function clipBelow(src: Frame, cut: number): Frame {
  const f: Frame = { ...src, buf: src.buf.clone() };
  const d = f.density ?? 1;
  const Y0 = Math.max(0, Math.round((cut + f.oy) * d));
  const buf = f.buf;
  for (let Y = Y0; Y < buf.h; Y++) for (let X = 0; X < buf.w; X++) buf.data[Y * buf.w + X] = 0;
  // Ink the cut edge so the body reads as coming out of the hole.
  if (Y0 > 0 && Y0 <= buf.h) {
    const Y = Y0 - 1;
    for (let X = 0; X < buf.w; X++) if ((buf.data[Y * buf.w + X] & 255) !== 0) buf.data[Y * buf.w + X] = INK;
  }
  buf.touch();
  return f;
}

export { FG, FG_1, ROT, ROT_1, LEATHER, LEATHER_1, at as rampAt };
