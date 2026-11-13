/**
 * The STAND-IN figure kit of mission sewers' street people and hostages (docs/design/sewers.md §3;
 * owner P1a STREET). Phase 4 art: simple, readable code-drawn 40 px people at 1× (side view, facing
 * right, feet anchored), in the palette of the game, outlined in INK, the front arm outlined on its
 * own so it reads over the body. The real 40 px sets come in Phase 5 (wave P5 figures) and replace
 * every strip of `street/art.ts` and `street/hostages.art.ts` under the same ids.
 *
 * `figure(look, pose)` draws one frame: a 48 × 48 buffer, the feet on row 46, the anchor at (24, 47).
 * Looks are palettes and parts (hood, wide hat, helmet, banana suit …); poses are leg swing, crouch,
 * lean, the two arms, the head and the item in the front hand. Pure and allocation-free at play time
 * (frames are built once, on first use, by the sprite registry).
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';

type Ramp = readonly Color[];

/** A person's look: palettes and parts. Ramps dark → light (index 1 shade, 2 base, 3 light). */
export interface PersonLook {
  readonly skin: Ramp;
  readonly hair: Ramp | null;
  /** Coat, hoodie, suit jacket, overalls (the torso and the sleeves). */
  readonly top: Ramp;
  readonly legs: Ramp;
  readonly shoes: Color;
  /** Torso half width (px). */
  readonly bw: number;
  /** Leg length and torso length (px). */
  readonly leg: number;
  readonly torso: number;
  readonly head: 'hood' | 'hat' | 'short' | 'bald' | 'helmet' | 'banana';
  /** The wide hat's ramp and its band. */
  readonly hat?: Ramp;
  readonly band?: Color;
  readonly shades?: boolean;
  readonly chains?: boolean;
  readonly earpiece?: boolean;
  /** A tie down the shirt front, and the shirt colour behind it. */
  readonly tie?: Color;
  readonly shirt?: Color;
  /** The coat's skirt below the hip (px). */
  readonly coat?: number;
  /** Wet wipes tangled round the body (the sewer worker). */
  readonly wipes?: 'tangled' | 'few';
}

export type ArmPose =
  | 'down'
  | 'pocket'
  | 'fwd'
  | 'jab'
  | 'hat'
  | 'mouth'
  | 'shoulder'
  | 'knuckles'
  | 'up'
  | 'coat'
  | 'back'
  | 'give'
  | 'wave'
  | 'cane'
  | 'ear'
  | 'floor'
  | 'head';

export type HandItem = 'pistol' | 'knife' | 'cane' | 'phone' | 'money' | null;

export interface PersonPose {
  /** Leg swing (px): the front foot this far ahead, the back foot as far behind. */
  readonly step?: number;
  /** Knee lift of the front leg (px). */
  readonly lift?: number;
  /** Knee bend (px the hip drops). */
  readonly crouch?: number;
  /** Torso lean (px the shoulders move ahead; negative = back). */
  readonly lean?: number;
  /** Body bob (px down). */
  readonly bob?: number;
  /** Sitting (on a chair): thighs forward, shins down. */
  readonly sit?: boolean;
  readonly front: ArmPose;
  readonly back: ArmPose;
  /** The head looks back (−1) or ahead (1, default). */
  readonly look?: 1 | -1;
  readonly mouth?: boolean;
  readonly shut?: boolean;
  readonly item?: HandItem;
  /** Lost in the fall (deaths): the wide hat, the sunglasses. */
  readonly noHat?: boolean;
  readonly noShades?: boolean;
}

export const FIG_W = 48;
export const FIG_H = 48;
/** The anchor (feet centre) of every figure frame. */
export const FIG_OX = 24;
export const FIG_OY = 47;
/** The feet row. */
const BASE = 46;

/** A point. */
interface P2 {
  x: number;
  y: number;
}

/** The front hand of the last `figure` call (frame-local), for named points. */
export const lastHand: P2 = { x: 0, y: 0 };
/** The muzzle of the last pistol drawn (frame-local). */
export const lastMuzzle: P2 = { x: 0, y: 0 };
/** The top of the head of the last figure (frame-local). */
export const lastHead: P2 = { x: 0, y: 0 };

/** Where a hand ends for an arm pose, from the shoulder (sx, sy). */
function handOf(a: ArmPose, sx: number, sy: number, out: P2): P2 {
  switch (a) {
    case 'down':
      out.x = sx + 1;
      out.y = sy + 12;
      break;
    case 'pocket':
      out.x = sx + 3;
      out.y = sy + 9;
      break;
    case 'fwd':
      out.x = sx + 11;
      out.y = sy + 3;
      break;
    case 'jab':
      out.x = sx + 14;
      out.y = sy + 6;
      break;
    case 'hat':
      out.x = sx + 4;
      out.y = sy - 10;
      break;
    case 'mouth':
      out.x = sx + 5;
      out.y = sy - 5;
      break;
    case 'shoulder':
      out.x = sx + 5;
      out.y = sy + 7;
      break;
    case 'knuckles':
      out.x = sx + 6;
      out.y = sy + 4;
      break;
    case 'up':
      out.x = sx + 2;
      out.y = sy - 13;
      break;
    case 'coat':
      out.x = sx + 7;
      out.y = sy + 8;
      break;
    case 'back':
      out.x = sx - 5;
      out.y = sy + 9;
      break;
    case 'give':
      out.x = sx + 10;
      out.y = sy + 6;
      break;
    case 'wave':
      out.x = sx + 6;
      out.y = sy - 11;
      break;
    case 'cane':
      out.x = sx + 4;
      out.y = sy + 11;
      break;
    case 'ear':
      out.x = sx + 1;
      out.y = sy - 6;
      break;
    case 'floor':
      out.x = sx + 6;
      out.y = BASE;
      break;
    case 'head':
      out.x = sx + 3;
      out.y = sy - 8;
      break;
  }
  return out;
}

const hand: P2 = { x: 0, y: 0 };

/** One arm: the sleeve (shoulder → elbow → hand), the hand, the item. */
function arm(b: PixelBuffer, look: PersonLook, a: ArmPose, sx: number, sy: number, front: boolean, item: HandItem): void {
  const h = handOf(a, sx, sy, hand);
  const ex = Math.round((sx + h.x) / 2 + (a === 'up' || a === 'wave' ? -2 : a === 'back' ? -1 : 0));
  const ey = Math.round((sy + h.y) / 2 + (a === 'fwd' || a === 'jab' || a === 'give' ? 2 : 1));
  const sleeve = front ? look.top[2] : look.top[1];
  b.thickLine(sx, sy, ex, ey, 3, sleeve);
  b.thickLine(ex, ey, h.x, h.y, 3, sleeve);
  if (front) b.set(sx, sy, look.top[3]);
  if (a !== 'pocket' && a !== 'back') b.rect(h.x - 1, h.y - 1, 3, 3, front ? look.skin[2] : look.skin[1]);
  if (!front) return;
  lastHand.x = h.x;
  lastHand.y = h.y;
  switch (item) {
    case 'pistol':
      b.rect(h.x, h.y - 2, 6, 2, PAL.gold[2]);
      b.hline(h.x, h.x + 5, h.y - 2, PAL.gold[3]);
      b.rect(h.x, h.y, 2, 2, PAL.gold[1]);
      lastMuzzle.x = h.x + 6;
      lastMuzzle.y = h.y - 1;
      break;
    case 'knife':
      b.hline(h.x + 1, h.x + 5, h.y, PAL.snow[3]);
      b.set(h.x + 1, h.y + 1, PAL.snow[1]);
      break;
    case 'cane':
      b.vline(h.x + 1, h.y - 2, BASE, PAL.brown[1]);
      b.rect(h.x, h.y - 3, 3, 2, PAL.gold[2]);
      break;
    case 'phone':
      b.rect(h.x, h.y - 4, 2, 4, PAL.steel[1]);
      b.set(h.x + 1, h.y - 3, PAL.ui[2]);
      break;
    case 'money':
      b.rect(h.x - 1, h.y - 3, 4, 2, PAL.green[3]);
      b.set(h.x, h.y - 3, PAL.green[2]);
      break;
  }
}

/** One leg: thigh and shin (the knee pushed forward by the bend), the shoe. */
function leg(b: PixelBuffer, look: PersonLook, hx: number, hy: number, fx: number, lift: number, bend: number, front: boolean, sit: boolean): void {
  const c = front ? look.legs[2] : look.legs[1];
  if (sit) {
    const kx = hx + 9;
    b.thickLine(hx, hy, kx, hy, 4, c);
    b.thickLine(kx, hy, kx + 1, BASE - 1, 3, c);
    b.rect(kx, BASE - 1, 4, 2, look.shoes);
    return;
  }
  const footY = BASE - 1 - lift;
  const kx = Math.round((hx + fx) / 2 + bend * 0.6 + lift * 0.7);
  const ky = Math.round((hy + footY) / 2 - lift * 0.3);
  b.thickLine(hx, hy, kx, ky, 4, c);
  b.thickLine(kx, ky, fx, footY, 3, c);
  b.rect(fx - 1, footY, 5, 2, look.shoes);
}

/** The head (skin, eye, nose, mouth) and its part (hair, hood, hat, helmet, banana hood). */
function head(b: PixelBuffer, look: PersonLook, hx: number, top: number, p: PersonPose): void {
  const s = look.skin;
  const dir = p.look ?? 1;
  lastHead.x = hx;
  lastHead.y = top;
  if (look.head === 'banana') {
    // The banana suit's hood: a tall yellow peel round the face, the brown tip on top.
    b.rect(hx - 5, top - 4, 10, 14, PAL.gold[2]);
    b.rect(hx - 4, top - 6, 7, 2, PAL.gold[2]);
    b.rect(hx - 3, top - 8, 3, 2, PAL.brown[1]);
    b.vline(hx - 5, top - 2, top + 9, PAL.gold[1]);
  }
  if (look.head === 'hood') {
    b.rect(hx - 5, top - 1, 9, 11, look.top[1]);
    b.rect(hx - 4, top - 2, 7, 2, look.top[1]);
  }
  // The face (a hood or the banana leaves only its front open).
  const fx0 = look.head === 'hood' || look.head === 'banana' ? hx - 1 : hx - 3;
  b.rect(fx0, top, hx + 4 - fx0, 8, s[2]);
  b.set(hx + 4, top + 4, s[2]);
  b.hline(fx0, hx + 3, top + 7, s[1]);
  const ex = dir > 0 ? hx + 2 : hx - 1;
  if (p.shut) b.hline(ex - 1, ex, top + 3, s[0]);
  else b.set(ex, top + 3, INK);
  if (p.mouth) b.rect(hx + 1, top + 5, 2, 2, INK);
  else b.hline(hx + 1, hx + 2, top + 6, s[0]);
  switch (look.head) {
    case 'short':
      if (look.hair) {
        b.rect(hx - 3, top - 1, 7, 2, look.hair[1]);
        b.rect(hx - 3, top, 2, 4, look.hair[1]);
        b.hline(hx - 2, hx + 2, top - 1, look.hair[2]);
      }
      break;
    case 'bald':
      b.hline(hx - 2, hx + 1, top, s[3]);
      break;
    case 'hood':
      b.vline(hx - 1, top, top + 8, look.top[2]);
      b.hline(hx - 3, hx + 2, top - 2, look.top[2]);
      break;
    case 'hat':
      if (!p.noHat && look.hat) {
        b.rect(hx - 3, top - 5, 7, 5, look.hat[2]);
        b.hline(hx - 3, hx + 3, top - 1, look.band ?? PAL.gold[2]);
        b.hline(hx - 7, hx + 7, top, look.hat[1]);
        b.hline(hx - 6, hx + 6, top - 1, look.hat[2]);
        b.hline(hx - 2, hx + 2, top - 5, look.hat[3]);
      } else if (look.hair) {
        b.rect(hx - 3, top - 1, 7, 2, look.hair[1]);
        b.rect(hx - 3, top, 2, 4, look.hair[1]);
      }
      break;
    case 'helmet':
      b.rect(hx - 4, top - 3, 9, 4, PAL.gold[2]);
      b.hline(hx - 3, hx + 3, top - 4, PAL.gold[3]);
      b.hline(hx - 5, hx + 5, top, PAL.gold[1]);
      // The dead head-lamp: grey glass, no glow.
      b.rect(hx + 4, top - 3, 2, 3, PAL.steel[1]);
      b.set(hx + 5, top - 2, PAL.steel[2]);
      break;
  }
  if (look.shades && !p.noShades) {
    b.hline(hx, hx + 4, top + 3, INK);
    b.set(hx + 2, top + 3, PAL.steel[3]);
    b.set(hx - 1, top + 3, PAL.black[2]);
  }
  if (look.earpiece) {
    b.set(hx - 2, top + 4, PAL.black[2]);
    b.vline(hx - 2, top + 5, top + 9, PAL.snow[1]);
  }
}

/** The torso rows: the shoulders shift by the lean, the hip stays (a coat skirt below it). */
function torso(b: PixelBuffer, look: PersonLook, cx: number, sy: number, hy: number, lean: number): void {
  const t = look.top;
  const bottom = hy + (look.coat ?? 1);
  for (let y = sy; y <= bottom; y++) {
    const k = y >= hy ? 0 : (hy - y) / Math.max(1, hy - sy);
    const off = Math.round(lean * k);
    const x0 = cx - look.bw + off;
    const x1 = cx + look.bw - 1 + off;
    b.hline(x0, x1, y, t[2]);
    b.set(x0, y, t[3]);
    b.set(x1, y, t[1]);
  }
  const fx = cx + look.bw - 2 + lean;
  if (look.shirt !== undefined) {
    b.vline(fx - 1, sy + 1, sy + 6, look.shirt);
    b.vline(fx, sy + 1, sy + 4, look.shirt);
  }
  if (look.tie !== undefined) b.vline(fx - 1, sy + 2, sy + 9, look.tie);
  if (look.chains) {
    b.hline(fx - 5, fx, sy + 4, PAL.gold[3]);
    b.hline(fx - 4, fx, sy + 6, PAL.gold[2]);
    b.rect(fx - 1, sy + 7, 2, 2, PAL.gold[2]);
  }
  // A belt line at the hip.
  b.hline(cx - look.bw, cx + look.bw - 1, hy - 1, t[1]);
}

/** Wet wipes wrapped round the body (white strips with loose ends). */
function wipes(b: PixelBuffer, cx: number, sy: number, hy: number, bw: number, many: boolean): void {
  const c = PAL.snow[2];
  const c2 = PAL.snow[1];
  b.line(cx - bw, sy + 3, cx + bw, sy + 7, c);
  b.line(cx - bw, sy + 8, cx + bw, sy + 4, c2);
  if (!many) return;
  b.line(cx - bw, hy - 2, cx + bw, hy - 5, c);
  b.line(cx - bw + 1, hy + 4, cx + bw, hy + 7, c);
  b.vline(cx + bw + 1, sy + 7, sy + 11, c2);
  b.vline(cx - bw - 1, hy - 2, hy + 3, c);
}

/**
 * One figure frame (facing right, feet anchored at (FIG_OX, FIG_OY)). `extra` paints behind the
 * figure first (a chair, a cage back). The front arm is outlined on its own and laid over the body.
 */
export function figure(look: PersonLook, p: PersonPose, extra?: (b: PixelBuffer) => void): PixelBuffer {
  const b = new PixelBuffer(FIG_W, FIG_H);
  const cx = FIG_OX;
  const crouch = p.crouch ?? 0;
  const bob = p.bob ?? 0;
  const lean = p.lean ?? 0;
  const step = p.step ?? 0;
  const hy = p.sit ? BASE - 12 : BASE - look.leg + crouch + bob;
  const sy = hy - look.torso;
  const hx = cx + lean + 1;
  const top = sy - 9;
  // Back arm, legs, torso, head (one outline), then the front arm (its own outline).
  const body = new PixelBuffer(FIG_W, FIG_H);
  extra?.(body);
  arm(body, look, p.back, cx - 1 + lean, sy + 2, false, null);
  leg(body, look, cx - 1, hy, cx - step - 1, 0, crouch, false, p.sit === true);
  leg(body, look, cx + 1, hy, cx + step + 1, p.lift ?? 0, crouch, true, p.sit === true);
  torso(body, look, cx, sy, hy, lean);
  if (look.wipes) wipes(body, cx + Math.round(lean / 2), sy, hy, look.bw, look.wipes === 'tangled');
  // The neck.
  body.rect(hx - 1, sy - 1, 3, 2, look.skin[1]);
  head(body, look, hx, top, p);
  body.outline(INK);
  b.blit(body, 0, 0);
  const fa = new PixelBuffer(FIG_W, FIG_H);
  arm(fa, look, p.front, cx + 1 + lean, sy + 2, true, p.item ?? null);
  fa.outline(INK);
  b.blit(fa, 0, 0);
  return b;
}

/** A figure frame with its anchor and named points. */
export function frameOf(buf: PixelBuffer, pts?: Readonly<Record<string, readonly [number, number]>>): Frame {
  return pts ? { buf, ox: FIG_OX, oy: FIG_OY, pts } : { buf, ox: FIG_OX, oy: FIG_OY };
}

/** The hand of the last figure as an anchor-relative point. */
export function handPt(): readonly [number, number] {
  return [lastHand.x - FIG_OX, lastHand.y - FIG_OY];
}

/**
 * A figure laid on its back (the end of a swoon): the standing figure turned a quarter (head behind,
 * face up), trimmed, its body on the floor line; anchored at the hip.
 */
export function lying(buf: PixelBuffer): Frame {
  const r = buf.rotated(-Math.PI / 2);
  const box = r.trimBounds();
  if (!box) return frameOf(buf);
  const c = r.crop(box.x, box.y, box.w, box.h).padded(1);
  return { buf: c, ox: Math.floor(c.w / 2), oy: c.h - 1 };
}
