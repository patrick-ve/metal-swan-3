/**
 * Art kit of the rhythm section (drummer, cymbalist, triangle, baton-major): rig geometry for
 * props held in two hands, an arm drawn as a piece (for arms in front of a big instrument), the
 * hats drawn as pieces (busby, tall shakos), small props (mallet, baton, whistle, moustache,
 * ears, bubbles, sparkles) and the per-outfit strip registration (`defineTypeArt`).
 *
 * Pieces are built once per look and reused in every frame (see docs/ART_GUIDE.md "Props and
 * instruments"). Every colour is a palette ramp colour; every piece carries its own INK outline.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, type SpriteOpts } from '../../../../engine/sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import { DEFAULT_POSE, renderHuman, type ArmPose, type HumanStyle, type LegPose, type Pose } from '../../../art/humanoid';
import { drawHand } from '../../../art/humanoid-gear';
import { despeckle, FLAT, hash2, R, shadeLayer, type RampLike } from '../../../art/paint';
import * as P from '../../../art/poses';
import type { Ramp } from '../../../../engine/pixel';
import { defineSoldierExtras, otherSkins, OUTFITS, type Outfit, type SoldierLook } from '../art';

export type V2 = [number, number];
const DEG = Math.PI / 180;

/** A leg pose (thigh angle, knee bend, optional boot angle). */
export const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });

// ---------------------------------------------------------------------------------------------
// Rig geometry (the same maths as humanoid.ts: shoulders 7 px above the pelvis, arms 6 + 6 px)
// ---------------------------------------------------------------------------------------------

/** Torso axes of a pose: up (u) and forward (f) unit vectors. */
function axes(pose: Pose): { u: V2; f: V2 } {
  const a = (pose.lean ?? 0) * DEG;
  return { u: [Math.sin(a), -Math.cos(a)], f: [Math.cos(a), Math.sin(a)] };
}

/** Both shoulders of a rendered upright frame (anchor-relative). */
export function shouldersOf(f: Frame, pose: Pose): { near: V2; far: V2 } {
  const hip = f.pts?.hip ?? [0, -15];
  const { u, f: fw } = axes(pose);
  const k = 7 - (pose.hunch ?? 0);
  return {
    near: [hip[0] + u[0] * k - fw[0], hip[1] + u[1] * k - fw[1]],
    far: [hip[0] + u[0] * k + fw[0], hip[1] + u[1] * k + fw[1]],
  };
}

/** Wrist of an arm pose from its shoulder (FK or the two-bone IK target, 6 + 6 px). */
export function wristOf(s: V2, a: ArmPose): V2 {
  if (a.to) {
    const d = Math.hypot(a.to[0], a.to[1]);
    const k = d > 11.99 ? 11.99 / d : 1;
    return [s[0] + a.to[0] * k, s[1] + a.to[1] * k];
  }
  const sh = (a.sh ?? 5) * DEG;
  const fe = ((a.sh ?? 5) + (a.el ?? 20)) * DEG;
  return [s[0] + Math.sin(sh) * 6 + Math.sin(fe) * 6, s[1] + Math.cos(sh) * 6 + Math.cos(fe) * 6];
}

/** Elbow of an arm (the rig's IK: the elbow hangs low, or sits back when the arm is raised). */
export function elbowOf(s: V2, a: ArmPose): V2 {
  if (!a.to) {
    const sh = (a.sh ?? 5) * DEG;
    return [s[0] + Math.sin(sh) * 6, s[1] + Math.cos(sh) * 6];
  }
  const w = wristOf(s, a);
  let dx = w[0] - s[0];
  let dy = w[1] - s[1];
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = 0;
    dy = 1;
    len = 1;
  }
  const ux = dx / len;
  const uy = dy / len;
  const d = Math.min(11.99, Math.max(0.01, len));
  const ang = Math.acos(Math.max(-1, Math.min(1, d / 12)));
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const e1: V2 = [s[0] + 6 * (ux * c - uy * sn), s[1] + 6 * (ux * sn + uy * c)];
  const e2: V2 = [s[0] + 6 * (ux * c + uy * sn), s[1] + 6 * (-ux * sn + uy * c)];
  const score = (e: V2): number => e[1] * 2 - e[0];
  let el = score(e1) >= score(e2) ? e1 : e2;
  if (a.bend === 'up') el = el === e1 ? e2 : e1;
  return el;
}

/** Both wrists of a rendered upright frame (anchor-relative), from its pose. */
export function wristsOf(f: Frame, pose: Pose): { near: V2; far: V2 } {
  const s = shouldersOf(f, pose);
  return { near: wristOf(s.near, pose.armN ?? DEFAULT_POSE.armN), far: wristOf(s.far, pose.armF ?? DEFAULT_POSE.armF) };
}

/** Sleeve ramp of a style (tunics and coats: the top; vests: the shirt; tank tops: skin). */
function sleeveRamp(style: HumanStyle): Ramp {
  if (style.topType === 'vest') return R(style.shirt ?? 'sand');
  if (style.topType === 'tank') return R(style.skin);
  return R(style.top);
}

/** Glove ramp of a style (bare hands: the skin). */
export function gloveOf(style: HumanStyle): RampLike {
  return style.gloves ?? style.skin;
}

const ARM_W: Readonly<Record<string, number>> = { slim: 3, normal: 4, heavy: 5 };

/**
 * An arm drawn as an outlined piece (sleeve + glove), from the frame's shoulder along the pose's
 * arm: for an arm that must show in front of an instrument (the drummer's near arm over the
 * drum). `which` = the near (default) or the far arm.
 */
export function armPiece(style: HumanStyle, f: Frame, pose: Pose, which: 'near' | 'far' = 'near'): Piece {
  const s = shouldersOf(f, pose)[which];
  const a = (which === 'near' ? pose.armN : pose.armF) ?? (which === 'near' ? DEFAULT_POSE.armN : DEFAULT_POSE.armF);
  const e = elbowOf(s, a);
  const w = wristOf(s, a);
  const x0 = Math.floor(Math.min(s[0], e[0], w[0])) - 6;
  const y0 = Math.floor(Math.min(s[1], e[1], w[1])) - 6;
  const x1 = Math.ceil(Math.max(s[0], e[0], w[0])) + 6;
  const y1 = Math.ceil(Math.max(s[1], e[1], w[1])) + 6;
  const L0 = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
  const rx = (p: V2): number => Math.round(p[0]) - x0;
  const ry = (p: V2): number => Math.round(p[1]) - y0;
  const aw = ARM_W[style.build ?? 'normal'] ?? 4;
  L0.taper(rx(s), ry(s), rx(e), ry(e), aw, aw, FLAT);
  L0.taper(rx(e), ry(e), rx(w), ry(w), aw, Math.max(3, aw - 1), FLAT);
  shadeLayer(L0, sleeveRamp(style), { shift: which === 'far' ? -1 : 0 });
  despeckle(L0);
  // The hand, turned along the forearm in quarter steps (as the rig does).
  const fore = Math.atan2(w[0] - e[0], w[1] - e[1]) / DEG;
  const q = Math.round((90 - fore) / 90);
  drawHand(L0, a.hand ?? 'fist', rx(w), ry(w), R(gloveOf(style)), q);
  const out = L0.padded(1).outline(INK);
  return { buf: out, x: x0 - 1, y: y0 - 1 };
}

/** A piece placed so that its pixel (px, py) lands on the anchor-relative point `at`. */
export function put(buf: PixelBuffer, at: readonly [number, number], px: number, py: number, behind = false): Piece {
  return { buf, x: Math.round(at[0] - px), y: Math.round(at[1] - py), behind };
}

// ---------------------------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------------------------

/** Shade a FLAT-filled buffer with a ramp, then outline it with INK (1 px margin added). */
export function shaded(b: PixelBuffer, ramp: RampLike, glint = false): PixelBuffer {
  shadeLayer(b, R(ramp), { glint });
  return b.padded(1).outline(INK);
}

/** Copy of a piece turned by `deg` degrees (clockwise), outline kept crisp. */
export function turned(b: PixelBuffer, deg: number): PixelBuffer {
  return deg === 0 ? b : b.rotated(deg * DEG, { quality: 'fast' });
}

/**
 * A piece turned by `deg` (clockwise) about its pixel (px, py), placed so that pixel lands on
 * `at` (hats on a falling head, instruments in a tumbling frame).
 */
export function putTurned(buf: PixelBuffer, at: readonly [number, number], px: number, py: number, deg: number, behind = false): Piece {
  if (Math.round(deg) % 360 === 0) return put(buf, at, px, py, behind);
  // Pad so the pivot is the centre pixel, turn about the centre, place the centre.
  const l = px;
  const r = buf.w - 1 - px;
  const t = py;
  const b = buf.h - 1 - py;
  const padded = buf.padded(Math.max(0, r - l), Math.max(0, b - t), Math.max(0, l - r), Math.max(0, t - b));
  const rot = padded.rotated(deg * DEG);
  return put(rot, at, (rot.w - 1) / 2, (rot.h - 1) / 2, behind);
}

/** Rotate an anchor-relative offset by `deg` (clockwise on screen). */
export function rotOff(dx: number, dy: number, deg: number): V2 {
  const a = deg * DEG;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

/** A straight stick (shaft) of `len` px at angle `deg` (0 = right, clockwise), `w` px thick. */
export function stickBuf(len: number, deg: number, ramp: RampLike, w = 2): { buf: PixelBuffer; ox: number; oy: number } {
  const r = Math.ceil(len) + 3;
  const b = new PixelBuffer(r * 2 + 1, r * 2 + 1);
  const ex = r + Math.cos(deg * DEG) * len;
  const ey = r + Math.sin(deg * DEG) * len;
  b.thickLine(r, r, Math.round(ex), Math.round(ey), w, FLAT);
  shadeLayer(b, R(ramp), { base: 2 });
  return { buf: b, ox: r, oy: r };
}

/**
 * A mallet (a stick with a round felt head) held at `grip`, pointing at `deg` (0 = forward,
 * clockwise, 90 = down): a 7 px wooden stick and a 4×4 white felt ball. Outlined.
 */
export function mallet(deg: number, len = 7): { buf: PixelBuffer; ox: number; oy: number } {
  const r = len + 4;
  const b = new PixelBuffer(r * 2 + 1, r * 2 + 1);
  const ex = Math.round(r + Math.cos(deg * DEG) * len);
  const ey = Math.round(r + Math.sin(deg * DEG) * len);
  b.thickLine(r, r, ex, ey, 1, PAL.brown[2]);
  b.circle(ex, ey, 2, PAL.snow[2]);
  b.set(ex - 1, ey - 1, PAL.snow[3]);
  b.set(ex, ey - 1, PAL.snow[3]);
  b.set(ex - 1, ey, PAL.snow[3]);
  b.set(ex + 1, ey + 1, PAL.snow[1]);
  const o = b.padded(1).outline(INK);
  return { buf: o, ox: r + 1, oy: r + 1 };
}

/** Place a stick-like piece (`ox, oy` = its grip pixel) at an anchor-relative point. */
export function gripAt(s: { buf: PixelBuffer; ox: number; oy: number }, at: readonly [number, number], behind = false): Piece {
  return put(s.buf, at, s.ox, s.oy, behind);
}

/**
 * A fur hat (the drummer's busby): `w`×`h`, rounded top, shaggy 2×2 fur clusters, lit from the
 * top-left, with a short gold chain at the base and a crimson-and-white side plume. Outlined.
 */
export function busbyArt(ramp: RampLike, seed = 3): PixelBuffer {
  const w = 12;
  const h = 12;
  const r = R(ramp);
  const b = new PixelBuffer(w, h);
  b.roundRect(0, 0, w, h - 1, 4, FLAT);
  b.rect(1, h - 2, w - 2, 2, FLAT);
  shadeLayer(b, r, { base: 1, hi: 2 });
  // Fur: a few lighter and darker 2×2 tufts (seeded hash, never the same pixel noise).
  for (let y = 1; y < h - 3; y += 2) {
    for (let x = 1 + ((y >> 1) & 1); x < w - 2; x += 3) {
      const v = hash2(x, y, seed);
      if (v < 0.35) continue;
      const c = v > 0.75 && x + y < 12 ? r[Math.min(r.length - 1, 3)] : v > 0.6 ? r[2] : r[0];
      if ((b.get(x, y) & 255) !== 0) b.set(x, y, c);
      if ((b.get(x + 1, y) & 255) !== 0 && v > 0.55) b.set(x + 1, y, c);
    }
  }
  // Gold chain at the base.
  for (let x = 1; x < w - 1; x++) b.set(x, h - 2, x % 2 === 0 ? PAL.gold[3] : PAL.gold[1]);
  // Side plume (crimson with a white tip), standing up at the back.
  const out = b.padded(2, 4, 1, 1);
  const px = 2;
  for (let y = 0; y < 8; y++) {
    out.set(px, 2 + y, y < 2 ? PAL.snow[3] : y < 6 ? PAL.red[2] : PAL.red[1]);
    out.set(px + 1, 2 + y, y < 2 ? PAL.snow[2] : y < 6 ? PAL.red[3] : PAL.red[2]);
  }
  return out.outline(INK);
}

/**
 * A tall shako (cylinder, a little wider at the top) with a gold band at the top and base, a gold
 * badge and a plume on top: the drum major's 14 px hat (`tall`) or the triangle's oversized one.
 */
export function shakoArt(o: { w: number; h: number; ramp: RampLike; plume: RampLike; plumeH: number; badge?: boolean; peak?: boolean }): PixelBuffer {
  const r = R(o.ramp);
  const body = new PixelBuffer(o.w + 2, o.h);
  // A slight flare: one pixel wider on each side over the top half.
  for (let y = 0; y < o.h; y++) {
    const inset = y < o.h / 2 ? 0 : 1;
    body.hline(inset, o.w + 1 - inset, y, FLAT);
  }
  shadeLayer(body, r, { base: 2, glint: true });
  // Gold bands (top rim and base) and a badge in front.
  for (let x = 0; x < body.w; x++) {
    if ((body.get(x, 0) & 255) !== 0) body.set(x, 0, x < body.w / 2 ? PAL.gold[3] : PAL.gold[2]);
    if ((body.get(x, o.h - 2) & 255) !== 0) body.set(x, o.h - 2, x < body.w / 2 ? PAL.gold[2] : PAL.gold[1]);
  }
  if (o.badge !== false) {
    const bx = Math.round(body.w * 0.6);
    const by = Math.round(o.h * 0.45);
    body.set(bx, by - 1, PAL.gold[3]);
    body.set(bx - 1, by, PAL.gold[3]);
    body.set(bx, by, PAL.gold[2]);
    body.set(bx + 1, by, PAL.gold[2]);
    body.set(bx, by + 1, PAL.gold[1]);
  }
  // The plume: a tapered tuft standing up from the top (lit on the left).
  const pr = R(o.plume);
  const out = new PixelBuffer(body.w + (o.peak ? 3 : 0), body.h + o.plumeH);
  out.blit(body, 0, o.plumeH);
  const cx = Math.round(body.w / 2) - 1;
  for (let y = 0; y < o.plumeH; y++) {
    const t = y / Math.max(1, o.plumeH - 1);
    const half = t < 0.3 ? 1 : 2;
    for (let x = cx - half + 1; x <= cx + half; x++) out.set(x, y, x <= cx ? pr[Math.min(pr.length - 1, 3)] : pr[Math.min(pr.length - 1, 2)]);
  }
  if (o.peak) {
    // A short black peak (visor) at the front of the base.
    out.hline(body.w - 2, body.w + 1, out.h - 1, PAL.black[1]);
    out.hline(body.w - 1, body.w + 2, out.h - 2, PAL.black[2]);
  }
  return out.padded(1).outline(INK);
}

/** A handlebar moustache with waxed, upturned tips (`w` px wide), in a hair ramp. Outlined. */
export function waxedMoustache(hair: RampLike, w = 11): PixelBuffer {
  const r = R(hair);
  const b = new PixelBuffer(w, 4);
  const mid = w >> 1;
  b.hline(mid - 3, mid + 3, 2, r[1]);
  b.hline(mid - 2, mid + 2, 1, r[2]);
  b.hline(mid - 4, mid - 2, 3, r[1]);
  b.hline(mid + 2, mid + 4, 3, r[1]);
  // Upturned tips.
  b.set(0, 1, r[2]);
  b.set(1, 2, r[1]);
  b.set(0, 0, r[2]);
  b.set(w - 1, 1, r[1]);
  b.set(w - 2, 2, r[1]);
  b.set(w - 1, 0, r[1]);
  b.set(mid - 4, 2, r[2]);
  b.set(mid + 4, 2, r[1]);
  return b.padded(1).outline(INK);
}

/** A big cartoon ear (skin ramp), 4×6, for the cymbalist. Outlined. */
export function bigEar(skin: RampLike): PixelBuffer {
  const r = R(skin);
  const b = new PixelBuffer(4, 6);
  b.roundRect(0, 0, 4, 6, 2, FLAT);
  shadeLayer(b, r, { base: 2 });
  b.set(2, 2, r[1]);
  b.set(2, 3, r[1]);
  b.set(1, 3, r[0]);
  return b.padded(1).outline(INK);
}

/** A steel whistle (5×3) for the mouth. Outlined. */
export function whistleArt(): PixelBuffer {
  const b = new PixelBuffer(5, 3);
  b.rect(0, 0, 5, 3, FLAT);
  shadeLayer(b, PAL.steel, { base: 3 });
  b.set(4, 0, PAL.steel[4]);
  b.set(2, 1, PAL.steel[1]);
  return b.padded(1).outline(INK);
}

/** A white sound burst (the CRASH, the DING): a star of short rays around a hot centre. */
export function burstArt(size: number): PixelBuffer {
  const n = size * 2 + 1;
  const b = new PixelBuffer(n, n);
  const c = size;
  for (let k = 0; k < 8; k++) {
    const a = k * 45 * DEG;
    const len = k % 2 === 0 ? size : size - 2;
    for (let t = 2; t <= len; t++) b.set(Math.round(c + Math.cos(a) * t), Math.round(c + Math.sin(a) * t), t > len - 1 ? PAL.gold[3] : PAL.snow[3]);
  }
  b.rect(c - 1, c - 1, 3, 3, PAL.snow[3]);
  b.set(c, c, PAL.gold[3]);
  return b.outline(INK);
}

/** Two little vibration arcs (")") for ringing ears and a struck triangle. */
export function ringArcs(): PixelBuffer {
  const b = new PixelBuffer(5, 7);
  b.vline(1, 2, 4, PAL.snow[3]);
  b.set(0, 1, PAL.snow[3]);
  b.set(0, 5, PAL.snow[3]);
  b.vline(4, 1, 5, PAL.snow[2]);
  b.set(3, 0, PAL.snow[2]);
  b.set(3, 6, PAL.snow[2]);
  return b;
}

/** A thought / snore bubble of radius r (white with a blue rim), with an optional 'z'. */
export function bubbleArt(r: number, z = false): PixelBuffer {
  const n = r * 2 + 1;
  const b = new PixelBuffer(n, n);
  b.circle(r, r, r, PAL.snow[3]);
  if (r >= 2) {
    b.set(r + 1, r - 1, PAL.snow[1]);
  }
  if (z && r >= 3) {
    b.hline(r - 1, r + 1, r - 1, PAL.navy[1]);
    b.set(r, r, PAL.navy[1]);
    b.hline(r - 1, r + 1, r + 1, PAL.navy[1]);
  }
  return b.outline(INK);
}

// ---------------------------------------------------------------------------------------------
// Poses shared by the rhythm types
// ---------------------------------------------------------------------------------------------

/** Tiptoe legs (the quiet Legion panic): short, quick steps on the toes. */
export const TIPTOE: readonly Pose[] = [
  { legN: L(14, 22, -30), legF: L(-10, 26, -34), bob: -1 },
  { legN: L(4, 30, -36), legF: L(2, 30, -36), bob: 0 },
  { legN: L(-10, 26, -34), legF: L(14, 22, -30), bob: -1 },
  { legN: L(2, 30, -36), legF: L(4, 30, -36), bob: 0 },
];

/** Sitting down dazed (the drummer's death after his drum rolls away). */
export const SIT_DAZED: readonly Pose[] = [
  { ...P.STAND, lean: -10, armN: { sh: 40, el: 30, hand: 'open' }, armF: { sh: 50, el: 30, hand: 'open' }, expr: 'hurt' },
  { legN: L(60, 70), legF: L(40, 80), lean: -16, armN: { sh: 70, el: 20, hand: 'open' }, armF: { sh: 80, el: 20, hand: 'open' }, expr: 'panic' },
  { legN: L(84, 10), legF: L(78, 16), lean: -6, armN: { sh: 20, el: 30, hand: 'open' }, armF: { sh: 30, el: 30, hand: 'open' }, expr: 'dazed', grounded: true },
  { legN: L(84, 10), legF: L(78, 16), lean: -12, head: { tilt: -10 }, armN: { sh: 14, el: 30, hand: 'open' }, armF: { sh: 24, el: 30, hand: 'open' }, expr: 'dazed' },
  { legN: L(84, 10), legF: L(78, 16), lean: -2, head: { tilt: 10 }, armN: { sh: 18, el: 30, hand: 'open' }, armF: { sh: 28, el: 30, hand: 'open' }, expr: 'dazed' },
  { legN: L(84, 10), legF: L(78, 16), lean: -12, head: { tilt: -10 }, armN: { sh: 14, el: 30, hand: 'open' }, armF: { sh: 24, el: 30, hand: 'open' }, expr: 'blink' },
];

// ---------------------------------------------------------------------------------------------
// Strip registration per outfit
// ---------------------------------------------------------------------------------------------

/** A pose plus the instrument state of that frame (read by the type's `dress`). */
export type IPose<I> = Pose & { i?: I };

/** One strip: poses rendered with the rig and dressed, or a custom generator. */
export interface StripDef<I> {
  poses?: readonly IPose<I>[];
  /** Custom frames (deaths built from effects, props) — gets the outfit's style. */
  gen?: (style: HumanStyle, outfit: Outfit) => Frame[];
  opts: SpriteOpts;
}

export interface TypeArt<I> {
  /** Base id: `enemy/<id>/…`, outfits `enemy/<id>-<outfit>/…`. */
  id: string;
  style: (outfit: Outfit) => HumanStyle;
  /** Add the instrument, hat and other pieces to a rendered frame. */
  dress: (f: Frame, p: IPose<I>, style: HumanStyle, outfit: Outfit, strip: string) => Frame;
  strips: Readonly<Record<string, StripDef<I>>>;
  /** The look for the shared extra strips (`defineSoldierExtras`). */
  look: (style: HumanStyle, outfit: Outfit) => SoldierLook;
  /** Extra strips this type registers itself instead (skipped in `defineSoldierExtras`). */
  skipExtras?: readonly string[];
}

/** Render and dress one pose. */
export function dressed<I>(t: TypeArt<I>, p: IPose<I>, style: HumanStyle, outfit: Outfit, strip: string): Frame {
  return t.dress(renderHuman(style, p, 'full'), p, style, outfit, strip);
}

/** Register every strip of a type for every outfit (GDD §9.0, §15.6). */
export function defineTypeArt<I>(t: TypeArt<I>): void {
  for (const outfit of OUTFITS) {
    const id = outfit === 'parade' ? t.id : `${t.id}-${outfit}`;
    const style = t.style(outfit);
    defineTypeSet(t, id, style, outfit);
    // The other two skin tones (GDD §9.0: skin per spawn; the Soldier picks `-skin<x>`).
    for (const [suffix, skin] of otherSkins(style)) defineTypeSet(t, `${id}-skin${suffix}`, { ...style, skin }, outfit);
  }
}

/** Every strip of one look (type × outfit × skin) under `enemy/<id>/`. */
function defineTypeSet<I>(t: TypeArt<I>, id: string, style: HumanStyle, outfit: Outfit): void {
  for (const [name, s] of Object.entries(t.strips)) {
    const gen = s.gen;
    const poses = s.poses;
    defineSprite(`enemy/${id}/${name}`, gen ? () => gen(style, outfit) : () => (poses ?? []).map((p) => dressed(t, p, style, outfit, name)), s.opts);
  }
  defineSoldierExtras(id, t.look(style, outfit), t.skipExtras ?? []);
}

/** Frames with extra named points added (e.g. a `muzzle` for the contract's shoot strips). */
export function withPoint(fs: Frame[], name: string, at: (f: Frame) => readonly [number, number]): Frame[] {
  return fs.map((f) => withPieces(f, [], { [name]: [Math.round(at(f)[0]), Math.round(at(f)[1])] }));
}

/** Colour helper: a ramp's colour clamped to its length. */
export function rc(r: RampLike, i: number): Color {
  const ramp = R(r);
  return ramp[Math.max(0, Math.min(ramp.length - 1, i))];
}
