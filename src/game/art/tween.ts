/**
 * Pose in-betweens for the humanoid rig (docs/ART_GUIDE.md "Motion"): hand-key 3–6 poses, then
 * let `tween` fill the frames between them with an easing.
 *
 * Field rules (the plan's F1):
 * - A numeric field is lerped when both keys have it; when only one has it, the other side uses
 *   the neutral value (0 for lean, rot, dx, dy, bob, hunch, crouch, recoil, hatDy, head dx/dy/tilt,
 *   foot; legScale from crouch as the solver does). A missing leg is the default stance leg.
 * - armN / armF, flutter, heldAngle and gunAngle are never synthesized: when one key lacks them,
 *   the in-between holds the nearer key's value (or absence).
 * - Discrete fields (aim, weapon, gunHand, lowGun, offhand, held, hand, bend, expr, headScale,
 *   hat) switch at t ≥ 0.5, or hold key 'a' / 'b' by option.
 * - Angles (leg hip / knee / foot, arm sh / el, lean, heldAngle, gunAngle) take the shortest arc;
 *   rot lerps literally (0 → 360 is one full turn).
 * - An FK arm (sh / el) against an IK arm (to) converts the IK key to sh / el with poseJoints,
 *   then lerps; two IK arms lerp their targets.
 * - head.tilt in (0, 8) snaps to 0 or ±8 (the head drawer ignores smaller tilts).
 * - When `grounded` differs, in-betweens are airborne (grounded false) and dy lerps between the
 *   two keys' solved pelvis heights, so the figure does not pop.
 */
import { easeInOutQuad, easeInQuad, easeOutBack, easeOutQuad } from '../../engine/math';
import { DEFAULT_POSE, poseJoints, type ArmPose, type HumanStyle, type LegPose, type Pose } from './humanoid';

/** Easing curves by name (`outBack` overshoots a little, then settles). */
export const EASE = {
  linear: (t: number): number => t,
  in: easeInQuad,
  out: easeOutQuad,
  inOut: easeInOutQuad,
  outBack: (t: number): number => easeOutBack(t),
} as const;

export type EaseName = keyof typeof EASE;

export interface InbetweenOpts {
  /** Discrete fields: switch at t ≥ 0.5 (default) or hold one key's value. */
  hold?: 'a' | 'b';
}

export interface TweenOpts extends InbetweenOpts {
  /** In-betweens per key pair (same for every pair). */
  counts?: number;
  /** In-betweens per key pair, by pair index (overrides `counts`). */
  perKey?: readonly number[];
  /** Easing for every pair, or one per pair. Default 'inOut'. */
  ease?: EaseName | readonly EaseName[];
  /** Loop: also tween last → first (the first key is not repeated at the end). */
  loop?: boolean;
}

const CROUCH_SCALE = 0.55;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shortest-arc angle lerp in degrees. */
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

function pick<T>(a: T, b: T, t: number, o: InbetweenOpts): T {
  if (o.hold === 'a') return a;
  if (o.hold === 'b') return b;
  return t >= 0.5 ? b : a;
}

/** Lerp a numeric field with a neutral value for a missing side; undefined when neither has it. */
function num(a: number | undefined, b: number | undefined, t: number, neutral = 0, angle = false): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  const x = a ?? neutral;
  const y = b ?? neutral;
  return angle ? lerpAngle(x, y, t) : lerp(x, y, t);
}

/** Never synthesized: lerp when both keys have it, else hold the nearer key. */
function held<T>(a: T | undefined, b: T | undefined, t: number, mix: (x: T, y: T) => T): T | undefined {
  if (a !== undefined && b !== undefined) return mix(a, b);
  return t >= 0.5 ? b : a;
}

function leg(a: LegPose | undefined, b: LegPose | undefined, t: number, def: LegPose): LegPose | undefined {
  if (!a && !b) return undefined;
  const x = a ?? def;
  const y = b ?? def;
  const out: LegPose = { hip: lerpAngle(x.hip, y.hip, t), knee: lerpAngle(x.knee, y.knee, t) };
  const foot = num(x.foot, y.foot, t, 0, true);
  if (foot !== undefined) out.foot = foot;
  return out;
}

/** An arm as sh / el (FK) for the given pose; IK arms are solved with poseJoints. */
function fkArm(style: HumanStyle, pose: Pose, near: boolean): { sh: number; el: number } {
  const arm = (near ? pose.armN : pose.armF) as ArmPose;
  if (!arm.to) return { sh: arm.sh ?? 5, el: arm.el ?? 20 };
  const j = poseJoints(style, { ...pose, rot: 0, dx: 0, dy: 0 });
  const s = near ? j.shN : j.shF;
  const e = near ? j.elN : j.elF;
  const w = near ? j.wrN : j.wrF;
  const sh = Math.atan2(e[0] - s[0], e[1] - s[1]) * (180 / Math.PI);
  const fore = Math.atan2(w[0] - e[0], w[1] - e[1]) * (180 / Math.PI);
  return { sh, el: ((((fore - sh) % 360) + 540) % 360) - 180 };
}

function arm(style: HumanStyle, a: Pose, b: Pose, near: boolean, t: number, o: InbetweenOpts): ArmPose | undefined {
  const x = near ? a.armN : a.armF;
  const y = near ? b.armN : b.armF;
  if (!x || !y) return t >= 0.5 ? y : x;
  const out: ArmPose = {};
  const hand = pick(x.hand, y.hand, t, o);
  if (x.to && y.to) {
    out.to = [lerp(x.to[0], y.to[0], t), lerp(x.to[1], y.to[1], t)];
    const bend = pick(x.bend, y.bend, t, o);
    if (bend !== undefined) out.bend = bend;
  } else {
    const p = fkArm(style, a, near);
    const q = fkArm(style, b, near);
    out.sh = lerpAngle(p.sh, q.sh, t);
    out.el = lerpAngle(p.el, q.el, t);
  }
  if (hand !== undefined) out.hand = hand;
  return out;
}

function legScaleOf(p: Pose): number {
  return p.legScale ?? 1 + (CROUCH_SCALE - 1) * Math.min(1, p.crouch ?? 0);
}

/** Snap a head tilt the drawer would ignore (|tilt| < 8) to 0 or ±8. */
function snapTilt(v: number): number {
  const m = Math.abs(v);
  if (m === 0 || m >= 8) return v;
  return m >= 4 ? Math.sign(v) * 8 : 0;
}

/** Pelvis y offset of a key relative to its airborne (rest-height) solve, plus its own dy. */
function airDy(style: HumanStyle, p: Pose): number {
  const flat = { ...p, rot: 0, dx: 0, dy: 0 };
  const g = poseJoints(style, flat).pelvis[1];
  const air = poseJoints(style, { ...flat, grounded: false }).pelvis[1];
  return g - air + (p.dy ?? 0);
}

function set<K extends keyof Pose>(out: Pose, k: K, v: Pose[K] | undefined): void {
  if (v !== undefined) out[k] = v;
}

/**
 * The pose a fraction `t` (0..1, may overshoot with outBack) of the way from key `a` to key `b`.
 * `t` 0 and 1 return the keys themselves.
 */
export function inbetween(style: HumanStyle, a: Pose, b: Pose, t: number, o: InbetweenOpts = {}): Pose {
  if (t === 0) return a;
  if (t === 1) return b;
  const out: Pose = {};
  set(out, 'legN', leg(a.legN, b.legN, t, DEFAULT_POSE.legN));
  set(out, 'legF', leg(a.legF, b.legF, t, DEFAULT_POSE.legF));
  for (const k of ['bob', 'crouch', 'hunch', 'recoil', 'hatDy', 'rot', 'dx'] as const) set(out, k, num(a[k], b[k], t));
  set(out, 'lean', num(a.lean, b.lean, t, 0, true));
  if (a.legScale !== undefined || b.legScale !== undefined) out.legScale = lerp(legScaleOf(a), legScaleOf(b), t);

  const ga = a.grounded !== false;
  const gb = b.grounded !== false;
  if (ga !== gb) {
    out.grounded = false;
    out.dy = lerp(airDy(style, a), airDy(style, b), t);
  } else {
    if (!ga) out.grounded = false;
    set(out, 'dy', num(a.dy, b.dy, t));
  }

  set(out, 'armN', arm(style, a, b, true, t, o));
  set(out, 'armF', arm(style, a, b, false, t, o));
  if (a.head || b.head) {
    const ha = a.head ?? {};
    const hb = b.head ?? {};
    const h: { dx?: number; dy?: number; tilt?: number } = {};
    const hdx = num(ha.dx, hb.dx, t);
    const hdy = num(ha.dy, hb.dy, t);
    const tilt = num(ha.tilt, hb.tilt, t);
    if (hdx !== undefined) h.dx = hdx;
    if (hdy !== undefined) h.dy = hdy;
    if (tilt !== undefined) h.tilt = snapTilt(tilt);
    out.head = h;
  }
  set(out, 'flutter', held(a.flutter, b.flutter, t, (x, y) => Math.round(lerp(x, y, t))));
  set(out, 'heldAngle', held(a.heldAngle, b.heldAngle, t, (x, y) => lerpAngle(x, y, t)));
  set(out, 'gunAngle', held(a.gunAngle, b.gunAngle, t, (x, y) => lerpAngle(x, y, t)));
  for (const k of ['aim', 'weapon', 'gunHand', 'lowGun', 'offhand', 'held', 'expr', 'headScale', 'hat'] as const) {
    set(out, k, pick(a[k], b[k], t, o) as never);
  }
  return out;
}

/**
 * Keys plus eased in-betweens: key0, its in-betweens toward key1, key1, … With `loop`, the last
 * key also tweens back toward the first (which is not repeated).
 * ```ts
 * const swing = tween(style, [READY, WIND, STRIKE, SETTLE], { perKey: [1, 0, 2], ease: ['in', 'linear', 'out'] });
 * ```
 */
export function tween(style: HumanStyle, keys: readonly Pose[], opts: TweenOpts = {}): Pose[] {
  const out: Pose[] = [];
  const n = keys.length;
  const pairs = opts.loop ? n : n - 1;
  for (let i = 0; i < n; i++) {
    out.push(keys[i]);
    if (i >= pairs) break;
    const a = keys[i];
    const b = keys[(i + 1) % n];
    const c = opts.perKey?.[i] ?? opts.counts ?? 0;
    const e = EASE[(typeof opts.ease === 'string' ? opts.ease : opts.ease?.[i]) ?? 'inOut'];
    for (let k = 1; k <= c; k++) out.push(inbetween(style, a, b, e(k / (c + 1)), opts));
  }
  return out;
}
