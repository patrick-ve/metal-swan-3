/**
 * Mission oldenzaal — the possessed's art (docs/design/oldenzaal.md §3.1; prefixes ids.ts
 * `OZ_SPRITES.possessed`). Owner: POSSESSED. Manifest id 'oldenzaal/possessed/art'.
 *
 * Every id has 1× art (the 64-colour PAL) and one density-generic drawer for 2× / 4× (`hd`):
 * the people are the human rig (`renderHuman(…, d)`), the pieces the rig does not draw (the
 * butcher's apron, the pensioner's stick, the soul's mist tail, the ghost helmet, the eyes, the
 * glow, the mist puff, the spectral shot) have a 1× PixelBuffer drawer and an HdCanvas drawer of
 * the same logical box (geometry is law: same size, anchor and points at every density).
 *
 * Strips (look = looks.ts `OZ_LOOKS`; the churchgoers' sets are deferred: the nave, wave B):
 * - `npc/oz-town/<look>/…` (every look): idle (4, frightened, glancing about), run (8, fleeing,
 *   the arms up), hide (2, crouched, the arms over the head, trembling), fall (3, the knees give,
 *   he sits down hard), sit (4, dazed on the ground, a hand to the head), getup (3), seized (3,
 *   the spasm as a soul dives in).
 * - `enemy/oz-shambler/<look>/…` (the slim hosts): idle (4, a slumped sway), walk (6, a heavy
 *   shamble, the arms forward), tell (2, rears back, the hands up as claws), strike (3, the lunge),
 *   rise (4, the jerk of a fresh possession), gloat (4, swaying; deferred), cower (2, the flinch;
 *   deferred). The gunner uses the same set (the host stands; his soul holds the rifle).
 * - `enemy/oz-brute/<look>/…` (butcher, bouncer): idle (4), walk (6), tell (3, the head down, a
 *   foot paws the ground), charge (6), recover (2, hands on the knees), rise (4), gloat, cower.
 * - `enemy/oz-soul/…`: the soldier's soul (a pale greatcoat, a plain helmet, NO insignia, a mist
 *   tail instead of legs; pelvis anchor): hover (4), tell (2), swoop (2), reach (2).
 * - `enemy/oz-gunner/rifle` (4: lowered, raising, aimed, recoil; point `muzzle`): the soul with
 *   the ghost rifle (pelvis anchor).
 * - `enemy/oz-ghost-shot/fly` (4): the spectral shot (centre anchor).
 * - `fx/oz/soul/eject` (4): the ejected soul's wail (pelvis anchor); `fx/oz/soul/helmet` (the
 *   see-through helmet over a host's head; anchor = the rig's `head` point), `fx/oz/soul/eyes`
 *   (2: steady, flare; anchor = the eye), `fx/oz/soul/glow` (a soft round glow, centre),
 *   `fx/oz/soul/mist` (5: the pale mist puff of a hit / an eject; centre; bloodless).
 *
 * Point `eye` on every host frame (the glowing eyes go there; the head's tilt included).
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, type DenseDensity as HdD, type SpriteOpts } from '../../../../engine/sprites';
import { HdCanvas, folds, texAll, type Texture } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, stackFrames, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { OZ_BRUTE_LOOKS, OZ_CHURCH_LOOKS, OZ_HOST_LOOKS, OZ_LOOK_EXTRAS, OZ_LOOK_STYLES, OZ_LOOKS, type OzLook } from './looks';

const frac = (v: number): number => v - Math.floor(v);
const hdOf = (d: number): HdD => (d >= 4 ? 4 : 2);
type Hand = 'fist' | 'open' | 'point';
const A = (sh: number, el: number, hand: Hand = 'fist') => ({ sh, el, hand });
const L = (hip: number, knee: number, foot?: number) => (foot === undefined ? { hip, knee } : { hip, knee, foot });

/** Register a strip at 1× and its UHD art (the same recipe at density 2 and 4). */
function defHi(id: string, gen: (d: Density) => Frame[], o: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...o, hd: (d) => gen(d) });
}

/**
 * Keep an HD drawing inside the 1× footprint `lo` (geometry is law): art px outside the opaque box
 * of the 1× piece less its 1-px outline are dropped before the render, so outline A wraps a clean
 * edge inside the 1× box.
 */
function fitTo(c: HdCanvas, lo: PixelBuffer): void {
  const b = lo.trimBounds();
  if (!b) return;
  const x0 = b.x + 1;
  const y0 = b.y + 1;
  const x1 = b.x + b.w - 1;
  const y1 = b.y + b.h - 1;
  c.erase(0, 0, c.w, c.h, (x, y) => x < x0 || x > x1 || y < y0 || y > y1);
}

// =============================================================================================
// Pieces the rig does not draw
// =============================================================================================

/** The butcher's apron: white with blue stripes, a waist band (1×: 9 × 12 + the outline). */
function apron1(): PixelBuffer {
  const b = new PixelBuffer(9, 12);
  b.rect(0, 0, 9, 12, PAL.cloth[2]);
  for (let x = 1; x < 9; x += 3) b.vline(x, 1, 11, PAL.sky[1]);
  b.hline(0, 8, 0, PAL.navy[1]);
  b.vline(8, 1, 11, PAL.cloth[1]);
  b.hline(1, 7, 11, PAL.cloth[1]);
  return b.padded(1).outline(INK);
}

/** The HD apron (the same 11 × 14 box): striped cotton in soft vertical folds, a navy waist band, a worn hem. */
function apronHd(d: HdD): PixelBuffer {
  const c = new HdCanvas(11, 14, d);
  const cloth = c.material({ ramp: PAL_HD.cloth, lo: 1, hi: 5, wrap: 0.1, spec: 0.08, shine: 8 });
  const stripe = c.material({ ramp: PAL_HD.sky, lo: 1, hi: 4, wrap: 0.1, spec: 0.08, shine: 8 });
  const band = c.material({ ramp: PAL_HD.navy, lo: 1, hi: 4, spec: 0.3, shine: 12 });
  const stripes: Texture = (s) => {
    if (frac((s.x - 2) / 3) < 0.34) s.mat = stripe;
  };
  c.blob([[1.2, 1.2], [9.8, 1.2], [9.8, 12.8], [1.2, 12.8]], 0.9, {
    mat: cloth,
    bulge: 0.22,
    tex: texAll(folds({ angle: Math.PI / 2, spacing: 2.6, amp: 0.8, cover: 0.7, seed: 41 }), stripes),
  });
  c.box(1, 1, 9, 1.1, { mat: band, z: 2, bevel: 0.4 });
  fitTo(c, apron1());
  return c.render({ outline: 'A', ao: 0.2, rimLight: 2 });
}

/** The pensioner's walking stick, `len` px from the hand to the ground: a crook and a shaft (no outline: it lies over the figure). */
function stick1(len: number): PixelBuffer {
  const b = new PixelBuffer(4, len + 1);
  b.set(1, 0, PAL.brown[2]);
  b.set(2, 0, PAL.brown[2]);
  b.set(3, 1, PAL.brown[1]);
  b.vline(1, 1, len, PAL.brown[1]);
  b.set(1, len, PAL.black[1]);
  return b;
}

/** The HD stick (the same 4 × (len + 1) box): a lit wooden crook and shaft, a rubber tip. */
function stickHd(len: number, d: HdD): PixelBuffer {
  const c = new HdCanvas(4, len + 1, d);
  const wood = c.material({ ramp: PAL_HD.brown, lo: 1, hi: 5, spec: 0.4, shine: 14 });
  const tip = c.material({ ramp: PAL_HD.black, lo: 0, hi: 3, spec: 0.3, shine: 10 });
  c.capsule(1.5, 1, 1.5, len, 0.42, 0.42, { mat: wood, z: 0 });
  c.capsule(1.5, 0.6, 2.6, 0.55, 0.4, 0.4, { mat: wood, z: 0.2 });
  c.capsule(2.8, 0.7, 3.4, 1.5, 0.38, 0.34, { mat: wood, z: 0.2 });
  c.capsule(1.5, len - 0.1, 1.5, len + 0.6, 0.45, 0.45, { mat: tip, z: 0.3 });
  return c.render({ outline: 'none', ao: 0 });
}

const apronCache: Array<PixelBuffer | undefined> = [];
function apronOf(d: Density): PixelBuffer {
  return (apronCache[d] ??= d === 1 ? apron1() : apronHd(hdOf(d)));
}

/** The eye point of a frame: 2 px in front of the head centre, turned with the head's tilt. */
function eyePoint(f: Frame, pose: Pose): readonly [number, number] {
  const h = f.pts?.head ?? [0, -28];
  const t = (((pose.head?.tilt ?? 0) + (pose.rot ?? 0)) * Math.PI) / 180;
  const ex = 2;
  const ey = 0;
  return [h[0] + ex * Math.cos(t) - ey * Math.sin(t), h[1] + ex * Math.sin(t) + ey * Math.cos(t)];
}

export interface PersonOpts {
  /** Hold the walking stick (the pensioner; idle only). */
  stick?: boolean;
  /** Add the `eye` point (hosts). */
  eye?: boolean;
}

/** One person of a look in a pose at density d (with the look's pieces). */
export function person(look: OzLook, pose: Pose, d: Density = 1, o: PersonOpts = {}): Frame {
  const style = OZ_LOOK_STYLES[look];
  const ex = OZ_LOOK_EXTRAS[look] ?? {};
  const full: Pose = { weapon: 'none', ...pose };
  let f: Frame;
  if (ex.apron && !full.rot) {
    const lower = renderHuman(style, full, 'lower', d);
    const upper = renderHuman(style, full, 'upper', d);
    const hip = lower.pts?.hip ?? [0, -15];
    const piece: Piece = { buf: apronOf(d), x: Math.round(hip[0]) - 5, y: Math.round(hip[1]) - 3 };
    if (d !== 1) piece.density = d;
    f = stackFrames(withPieces(lower, [piece]), upper);
  } else f = renderHuman(style, full, 'full', d);
  if (o.stick && ex.stick) {
    const hand = f.pts?.hand ?? [6, -14];
    const hx = Math.round(hand[0]) - 1;
    const hy = Math.round(hand[1]);
    const len = Math.max(4, -hy);
    const piece: Piece = { buf: d === 1 ? stick1(len) : stickHd(len, hdOf(d)), x: hx, y: hy };
    if (d !== 1) piece.density = d;
    f = withPieces(f, [piece]);
  }
  if (o.eye) f = withPieces(f, [], { eye: eyePoint(f, full) });
  return f;
}

// =============================================================================================
// The townspeople (npc/oz-town/<look>/…)
// =============================================================================================

const FRIGHT: Pose = { ...P.STAND, legN: L(16, 20), legF: L(-12, 16), lean: -3, hunch: 1, armN: { to: [5, -2], hand: 'open' }, armF: { to: [7, -1], hand: 'open' }, expr: 'panic' };
const TOWN_IDLE: readonly Pose[] = [
  FRIGHT,
  { ...FRIGHT, head: { tilt: -6, dx: -1 } },
  { ...FRIGHT, hunch: 2, bob: 1 },
  { ...FRIGHT, head: { tilt: 5, dx: 1 }, expr: 'shout' },
];
/** The pensioner leans on his stick (the near hand low in front). */
const stickPose = (p: Pose): Pose => ({ ...p, armN: A(26, 6, 'fist') });
const TOWN_RUN: readonly Pose[] = P.RUN.map((r, i): Pose => ({
  ...r,
  lean: 9,
  armN: { to: [6 + (i % 2), -8 + (i % 4 < 2 ? 0 : 1)], hand: 'open' },
  armF: { to: [8 - (i % 2), -6 - (i % 4 < 2 ? 1 : 0)], hand: 'open' },
  expr: i % 4 === 3 ? 'shout' : 'panic',
}));
const TOWN_HIDE: readonly Pose[] = [0, 1].map((k): Pose => ({
  legN: L(72, 104),
  legF: L(30, 108),
  lean: 10 + k * 6,
  hunch: 1,
  armN: { to: [1, -9], hand: 'open' },
  armF: { to: [2, -8], hand: 'open' },
  head: { dy: 1, tilt: 6 },
  expr: 'panic',
}));
/** Sitting on the street: the legs out in front, propped on the hands behind. */
const SIT: Pose = { legN: L(86, 8, 10), legF: L(78, 16, 8), lean: -8, armN: A(-34, 4, 'open'), armF: A(-44, 2, 'open'), expr: 'dazed' };
const TOWN_FALL: readonly Pose[] = [
  { legN: L(40, 62), legF: L(-8, 52), lean: 6, armN: A(24, 10, 'open'), armF: A(4, 18, 'open'), head: { dy: 1 }, expr: 'dazed' },
  { ...P.CROUCH, lean: -6, armN: A(-24, 10, 'open'), armF: A(-36, 10, 'open'), expr: 'dazed' },
  SIT,
];
const TOWN_SIT: readonly Pose[] = [
  SIT,
  { ...SIT, head: { tilt: -6, dx: -1 } },
  { ...SIT, lean: -4, armN: { to: [5, -10], hand: 'open' }, head: { tilt: 4 }, expr: 'blink' },
  { ...SIT, lean: -4, armN: { to: [5, -11], hand: 'open' }, head: { tilt: -4, dx: 1 } },
];
const TOWN_GETUP: readonly Pose[] = [
  { ...SIT, lean: 8, armN: A(30, 10, 'open'), armF: A(20, 10, 'open'), expr: 'blink' },
  { ...P.CROUCH, lean: 10, armN: A(40, 10, 'open'), armF: A(30, 14, 'open'), expr: 'normal' },
  { ...P.STAND, legN: L(26, 30), legF: L(-10, 26), lean: 4, armN: A(16, 20, 'open'), armF: A(6, 20, 'open'), expr: 'normal' },
];
/** The spasm as a soul dives in: up on the toes, the arms thrown out, the head back. */
const SEIZED: readonly Pose[] = [
  { legN: L(8, 4, -10), legF: L(-6, 4, -12), lean: -10, armN: A(112, 0, 'open'), armF: A(124, 8, 'open'), head: { tilt: -6 }, expr: 'shout' },
  { legN: L(10, 6, -12), legF: L(-4, 6, -10), lean: -12, armN: A(126, 6, 'open'), armF: A(108, 4, 'open'), head: { tilt: -7, dx: -1 }, expr: 'panic', dy: -1 },
  { legN: L(6, 4, -8), legF: L(-8, 4, -12), lean: -8, armN: A(100, 10, 'open'), armF: A(118, 2, 'open'), head: { tilt: -4 }, expr: 'shout' },
];

/** Strip ticks (logic reads them too: possessed/index.ts). */
export const TOWN_TIMING = {
  idle: 10,
  run: 4,
  hide: 4,
  fall: [5, 5, 30] as readonly number[],
  sit: 9,
  getup: [5, 5, 6] as readonly number[],
  seized: 4,
} as const;

function defineTown(look: OzLook): void {
  const pre = `npc/oz-town/${look}/`;
  const defer = OZ_CHURCH_LOOKS.includes(look);
  const o: SpriteOpts = defer ? { defer: true } : {};
  const stick = OZ_LOOK_EXTRAS[look]?.stick === true;
  defHi(pre + 'idle', (d) => TOWN_IDLE.map((p) => person(look, stick ? stickPose(p) : p, d, { stick })), { ...o, ticksPerFrame: TOWN_TIMING.idle });
  defHi(pre + 'run', (d) => TOWN_RUN.map((p) => person(look, p, d)), { ...o, ticksPerFrame: TOWN_TIMING.run });
  defHi(pre + 'hide', (d) => TOWN_HIDE.map((p) => person(look, p, d)), { ...o, ticksPerFrame: TOWN_TIMING.hide });
  defHi(pre + 'fall', (d) => TOWN_FALL.map((p) => person(look, p, d)), { ...o, durations: TOWN_TIMING.fall, loop: false });
  defHi(pre + 'sit', (d) => TOWN_SIT.map((p) => person(look, p, d)), { ...o, ticksPerFrame: TOWN_TIMING.sit });
  defHi(pre + 'getup', (d) => TOWN_GETUP.map((p) => person(look, p, d)), { ...o, durations: TOWN_TIMING.getup, loop: false });
  defHi(pre + 'seized', (d) => SEIZED.map((p) => person(look, p, d)), { ...o, ticksPerFrame: TOWN_TIMING.seized });
}

// =============================================================================================
// The hosts (enemy/oz-shambler/<look>/…, enemy/oz-brute/<look>/…)
// =============================================================================================

/** The possessed slump: leaning forward, the shoulders down, the head hanging a little. */
const SLUMP: Pose = { lean: 7, hunch: 1, head: { dy: 1, tilt: 5 }, expr: 'normal', hat: false };
const HOST_IDLE: readonly Pose[] = [
  { ...P.STAND, ...SLUMP, armN: A(34, 10, 'open'), armF: A(26, 14, 'open') },
  { ...P.STAND, ...SLUMP, lean: 9, armN: A(38, 8, 'open'), armF: A(30, 12, 'open'), head: { dy: 1, tilt: 6, dx: 1 } },
  { ...P.STAND, ...SLUMP, lean: 8, hunch: 2, armN: A(36, 12, 'open'), armF: A(28, 16, 'open') },
  { ...P.STAND, ...SLUMP, lean: 5, armN: A(30, 12, 'open'), armF: A(24, 14, 'open'), head: { dy: 1, tilt: 3, dx: -1 } },
];
/** The shamble: a stiff near leg dragged after the far one, the arms held out forward. */
const SHAMBLE_IDX = [0, 1, 3, 4, 5, 7] as const;
const HOST_WALK: readonly Pose[] = SHAMBLE_IDX.map((k, i): Pose => ({
  ...P.WALK[k],
  ...SLUMP,
  lean: 9 + (i % 3 === 1 ? 2 : 0),
  bob: i % 3 === 1 ? 1 : 0,
  armN: A(76 + (i % 3) * 3, 8, 'open'),
  armF: A(68 + ((i + 1) % 3) * 3, 14, 'open'),
  head: { dy: 1, tilt: 5, dx: i % 3 === 2 ? 1 : 0 },
}));
const HOST_TELL: readonly Pose[] = [
  { ...P.STAND, legN: L(24, 22), legF: L(-20, 18), lean: -7, armN: { to: [8, -8], hand: 'open' }, armF: { to: [6, -9], hand: 'open' }, head: { tilt: -5 }, expr: 'shout', hat: false },
  { ...P.STAND, legN: L(26, 26), legF: L(-22, 20), lean: -9, armN: { to: [7, -11], hand: 'open' }, armF: { to: [5, -12], hand: 'open' }, head: { tilt: -6 }, expr: 'shout', hat: false },
];
const HOST_STRIKE: readonly Pose[] = [
  { legN: L(44, 22, 6), legF: L(-26, 16), lean: 18, armN: A(96, 0, 'open'), armF: A(86, 6, 'open'), head: { tilt: 6 }, expr: 'shout', hat: false },
  { legN: L(40, 26, 4), legF: L(-22, 20), lean: 15, armN: A(72, 12, 'open'), armF: A(62, 20, 'open'), head: { tilt: 6 }, expr: 'shout', hat: false },
  { ...P.STAND, ...SLUMP, lean: 10, armN: A(42, 12, 'open'), armF: A(32, 14, 'open') },
];
/** A fresh possession: the spasm, the head snaps down, the slump. */
const HOST_RISE: readonly Pose[] = [
  { ...SEIZED[0], hat: false },
  { ...SEIZED[1], hat: false },
  { ...P.STAND, lean: 12, hunch: 2, armN: A(10, 4, 'open'), armF: A(4, 6, 'open'), head: { dy: 2, tilt: 7 }, expr: 'blink', hat: false },
  HOST_IDLE[0],
];
const HOST_GLOAT: readonly Pose[] = [
  { ...P.STAND, ...SLUMP, lean: 3, armN: A(22, 10, 'open'), armF: A(16, 12, 'open'), head: { dy: 1, tilt: -4, dx: -1 } },
  { ...P.STAND, ...SLUMP, lean: 7, armN: A(28, 10, 'open'), armF: A(20, 12, 'open'), head: { dy: 1, tilt: 2 } },
  { ...P.STAND, ...SLUMP, lean: 11, armN: A(34, 10, 'open'), armF: A(26, 12, 'open'), head: { dy: 2, tilt: 7, dx: 1 } },
  { ...P.STAND, ...SLUMP, lean: 7, armN: A(28, 10, 'open'), armF: A(20, 12, 'open'), head: { dy: 1, tilt: 2 } },
];
const HOST_COWER: readonly Pose[] = [0, 1].map((k): Pose => ({
  legN: L(30, 42),
  legF: L(-10, 38),
  lean: -9 - k * 2,
  armN: { to: [3, -9], hand: 'open' },
  armF: { to: [5, -8], hand: 'open' },
  head: { tilt: -5 + k },
  expr: 'hurt',
  hat: false,
  dx: k === 1 ? -1 : 0,
}));

/** Host strip timings (logic reads them). */
export const HOST_TIMING = {
  idle: 12,
  walk: 8,
  tell: [10, 9999] as readonly number[],
  strike: [5, 5, 8] as readonly number[],
  rise: [6, 6, 8, 8] as readonly number[],
  gloat: 14,
  cower: 4,
} as const;

function defineShambler(look: OzLook): void {
  const pre = `enemy/oz-shambler/${look}/`;
  const o: SpriteOpts = OZ_CHURCH_LOOKS.includes(look) ? { defer: true } : {};
  const eye = { eye: true };
  defHi(pre + 'idle', (d) => HOST_IDLE.map((p) => person(look, p, d, eye)), { ...o, ticksPerFrame: HOST_TIMING.idle });
  defHi(pre + 'walk', (d) => HOST_WALK.map((p) => person(look, p, d, eye)), { ...o, ticksPerFrame: HOST_TIMING.walk });
  defHi(pre + 'tell', (d) => HOST_TELL.map((p) => person(look, p, d, eye)), { ...o, durations: HOST_TIMING.tell, loop: false });
  defHi(pre + 'strike', (d) => HOST_STRIKE.map((p) => person(look, p, d, eye)), { ...o, durations: HOST_TIMING.strike, loop: false });
  defHi(pre + 'rise', (d) => HOST_RISE.map((p) => person(look, p, d, eye)), { ...o, durations: HOST_TIMING.rise, loop: false });
  defHi(pre + 'gloat', (d) => HOST_GLOAT.map((p) => person(look, p, d, eye)), { ticksPerFrame: HOST_TIMING.gloat, defer: true });
  defHi(pre + 'cower', (d) => HOST_COWER.map((p) => person(look, p, d, eye)), { ticksPerFrame: HOST_TIMING.cower, defer: true });
}

const BRUTE_IDLE: readonly Pose[] = P.BREATH4.map((b, i): Pose => ({ ...P.STAND, ...SLUMP, ...b, lean: 6 + (i === 1 || i === 2 ? 2 : 0), hunch: (b.hunch ?? 0) + 1, armN: A(18, 26, 'fist'), armF: A(10, 30, 'fist') }));
const BRUTE_WALK: readonly Pose[] = SHAMBLE_IDX.map((k, i): Pose => ({
  ...P.WALK[k],
  ...SLUMP,
  lean: 8,
  bob: i % 3 === 1 ? 1 : 0,
  armN: A(i < 3 ? 26 : -10, 30, 'fist'),
  armF: A(i < 3 ? -12 : 24, 30, 'fist'),
}));
const BRUTE_TELL: readonly Pose[] = [
  { ...P.STAND, legN: L(26, 30), legF: L(-20, 26), lean: 16, hunch: 2, armN: A(-22, 44, 'fist'), armF: A(-32, 40, 'fist'), head: { dy: 2, tilt: 6 }, expr: 'shout', hat: false },
  { legN: L(54, 70, 10), legF: L(-20, 26), lean: 18, hunch: 2, armN: A(-26, 44, 'fist'), armF: A(-34, 42, 'fist'), head: { dy: 2, tilt: 6 }, expr: 'shout', hat: false },
  { legN: L(36, 40, 4), legF: L(-20, 26), lean: 17, hunch: 2, armN: A(-24, 44, 'fist'), armF: A(-34, 40, 'fist'), head: { dy: 2, tilt: 6 }, expr: 'shout', hat: false },
];
const CHARGE_IDX = [0, 1, 2, 4, 5, 6] as const;
const BRUTE_CHARGE: readonly Pose[] = CHARGE_IDX.map((k, i): Pose => ({
  ...P.RUN[k],
  lean: 22,
  hunch: 1,
  armN: A(i < 3 ? 40 : -36, 50, 'fist'),
  armF: A(i < 3 ? -30 : 34, 50, 'fist'),
  head: { dy: 2, tilt: 7 },
  expr: 'shout',
  hat: false,
}));
const BRUTE_RECOVER: readonly Pose[] = [0, 1].map((k): Pose => ({
  legN: L(34, 40),
  legF: L(-14, 34),
  lean: 22 - k * 2,
  hunch: 2 - k,
  armN: { to: [7, 13], hand: 'open' },
  armF: { to: [8, 13], hand: 'open' },
  head: { dy: 2, tilt: 4 },
  expr: k ? 'blink' : 'normal',
  hat: false,
}));

/** Brute strip timings (logic reads them). */
export const BRUTE_TIMING = {
  idle: 12,
  walk: 9,
  tell: 6,
  charge: 4,
  recover: 12,
} as const;

function defineBrute(look: OzLook): void {
  const pre = `enemy/oz-brute/${look}/`;
  const eye = { eye: true };
  defHi(pre + 'idle', (d) => BRUTE_IDLE.map((p) => person(look, p, d, eye)), { ticksPerFrame: BRUTE_TIMING.idle });
  defHi(pre + 'walk', (d) => BRUTE_WALK.map((p) => person(look, p, d, eye)), { ticksPerFrame: BRUTE_TIMING.walk });
  defHi(pre + 'tell', (d) => BRUTE_TELL.map((p) => person(look, p, d, eye)), { ticksPerFrame: BRUTE_TIMING.tell });
  defHi(pre + 'charge', (d) => BRUTE_CHARGE.map((p) => person(look, p, d, eye)), { ticksPerFrame: BRUTE_TIMING.charge });
  defHi(pre + 'recover', (d) => BRUTE_RECOVER.map((p) => person(look, p, d, eye)), { ticksPerFrame: BRUTE_TIMING.recover });
  defHi(pre + 'rise', (d) => HOST_RISE.map((p) => person(look, p, d, eye)), { durations: HOST_TIMING.rise, loop: false });
  defHi(pre + 'gloat', (d) => HOST_GLOAT.map((p) => person(look, p, d, eye)), { ticksPerFrame: HOST_TIMING.gloat, defer: true });
  defHi(pre + 'cower', (d) => HOST_COWER.map((p) => person(look, p, d, eye)), { ticksPerFrame: HOST_TIMING.cower, defer: true });
}

// =============================================================================================
// The soldier's soul (enemy/oz-soul/…, enemy/oz-gunner/rifle, fx/oz/soul/eject)
// =============================================================================================

/**
 * The soul: a pale soldier in a long greatcoat and a plain round helmet. NO insignia, no badge,
 * no armband (the rig's `helmet` and `coat` carry none; no accessories that could read as one).
 */
export const SOUL_STYLE: HumanStyle = {
  skin: 'stone', hair: 'stone', hairStyle: 'short', headgear: 'helmet', gear: 'slate', accent: 'slate',
  top: 'slate', topType: 'coat', shirt: 'slate', pants: 'slate', boots: 'slate', belt: 'slate',
  gloves: null, build: 'normal',
};

/** The mist tail under the coat (1×: 14 × 15 + outline; frame k sways the tip). Top-left at (−8, −2) from the pelvis. */
const TAIL_W = 14;
const TAIL_H = 15;
const TAIL_SWAY = [0, 1.5, 0, -1.5];
function tailShape(k: number, y: number): { cx: number; hw: number } {
  const v = y / TAIL_H;
  return { cx: TAIL_W / 2 + TAIL_SWAY[k & 3] * v * v * 1.8, hw: Math.max(0.6, 6.2 * Math.pow(1 - v, 0.8)) };
}
function tail1(k: number): PixelBuffer {
  const b = new PixelBuffer(TAIL_W, TAIL_H);
  for (let y = 0; y < TAIL_H; y++) {
    const { cx, hw } = tailShape(k, y + 0.5);
    const x0 = Math.round(cx - hw);
    const x1 = Math.round(cx + hw) - 1;
    const c = y < 4 ? PAL.slate[2] : y < 9 ? PAL.steel[2] : PAL.steel[3];
    if (x1 >= x0) b.hline(x0, x1, y, c);
    if (x1 > x0 && y < 9) b.set(x1, y, y < 4 ? PAL.slate[1] : PAL.steel[1]);
  }
  return b.padded(1).outline(INK);
}
function tailHd(k: number, d: HdD): PixelBuffer {
  const c = new HdCanvas(TAIL_W + 2, TAIL_H + 2, d);
  const coat = c.material({ ramp: PAL_HD.slate, lo: 1, hi: 5, wrap: 0.2, spec: 0.1, shine: 8 });
  const mist = c.material({ ramp: PAL_HD.steel, lo: 2, hi: 6, wrap: 0.4, spec: 0, shine: 4 });
  const pts: Array<[number, number]> = [];
  for (let y = 0; y <= TAIL_H; y += 1) {
    const { cx, hw } = tailShape(k, y);
    pts.push([1 + cx + hw, 1 + y]);
  }
  for (let y = TAIL_H; y >= 0; y -= 1) {
    const { cx, hw } = tailShape(k, y);
    pts.push([1 + cx - hw, 1 + y]);
  }
  c.poly(pts, {
    mat: coat,
    tex: (s) => {
      if (s.y > 5) s.mat = mist;
      // Folds of the coat skirt, frayed into wisps at the bottom.
      s.tone += 0.12 * Math.sin((s.x - (TAIL_SWAY[k & 3] * s.y) / 10) * 2.1) - (s.y > 10 ? 0.15 : 0);
      s.nx = (s.x - 1 - TAIL_W / 2) / 7;
      s.nz = 1;
    },
  });
  fitTo(c, tail1(k));
  return c.render({ outline: 'A', ao: 0, rimLight: 2 });
}

/** Brass (the rig's buttons and buckle) turns to pale slate: nothing on the coat may read as a badge. */
function rampMap(from: readonly Color[], to: readonly Color[]): Map<Color, Color> {
  const m = new Map<Color, Color>();
  from.forEach((c, i) => m.set(c, to[Math.min(to.length - 1, Math.round((i * (to.length - 1)) / Math.max(1, from.length - 1)))]));
  return m;
}
const NO_BRASS_1 = rampMap(PAL.gold, PAL.slate);
const NO_BRASS_HD = rampMap(PAL_HD.gold, PAL_HD.slate);

/** A soul frame: the rig's upper body (pelvis anchor) over the mist tail. */
function soulFrame(pose: Pose, k: number, d: Density): Frame {
  const up = renderHuman(SOUL_STYLE, { ...pose, flutter: k & 3 }, 'upper', d);
  const piece: Piece = { buf: d === 1 ? tail1(k) : tailHd(k, hdOf(d)), x: -8, y: -2, behind: true };
  if (d !== 1) piece.density = d;
  const f = withPieces(up, [piece]);
  f.buf.recolor(d === 1 ? NO_BRASS_1 : NO_BRASS_HD);
  return f;
}

const SOUL_HOVER: readonly Pose[] = [0, 1, 2, 3].map((k): Pose => ({
  lean: 4,
  armN: A(22 + (k === 1 ? 4 : 0), 30, 'open'),
  armF: A(14 + (k === 3 ? 4 : 0), 34, 'open'),
  head: { dy: k === 2 ? 1 : 0, tilt: 4 },
  expr: 'normal',
}));
const SOUL_TELL: readonly Pose[] = [
  { lean: -8, armN: { to: [8, -9], hand: 'open' }, armF: { to: [6, -10], hand: 'open' }, head: { tilt: -6 }, expr: 'shout' },
  { lean: -11, armN: { to: [7, -12], hand: 'open' }, armF: { to: [5, -13], hand: 'open' }, head: { tilt: -7 }, expr: 'shout' },
];
const SOUL_SWOOP: readonly Pose[] = [
  { lean: 24, armN: A(92, 0, 'open'), armF: A(84, 4, 'open'), expr: 'shout' },
  { lean: 28, armN: A(98, 4, 'open'), armF: A(88, 0, 'open'), expr: 'shout' },
];
const SOUL_REACH: readonly Pose[] = [
  { lean: 12, armN: A(84, 6, 'open'), armF: A(76, 10, 'open'), expr: 'shout' },
  { lean: 16, armN: A(78, 12, 'open'), armF: A(70, 16, 'open'), expr: 'shout' },
];
const SOUL_WAIL: readonly Pose[] = [
  { lean: -6, armN: { to: [6, -10], hand: 'open' }, armF: { to: [3, -12], hand: 'open' }, head: { tilt: -6 }, expr: 'shout' },
  { lean: -9, armN: { to: [4, -13], hand: 'open' }, armF: { to: [6, -11], hand: 'open' }, head: { tilt: -7 }, expr: 'shout' },
  { lean: -5, armN: { to: [5, -12], hand: 'open' }, armF: { to: [2, -13], hand: 'open' }, head: { tilt: -5 }, expr: 'panic' },
  { lean: -3, armN: { to: [3, -14], hand: 'open' }, armF: { to: [5, -13], hand: 'open' }, head: { tilt: -4 }, expr: 'panic' },
];
/** The ghost rifle: lowered, raising, aimed (the barrel a little down: the shot goes along the ground), recoil. */
const SOUL_RIFLE: readonly Pose[] = [
  { lean: 2, weapon: 'rifle', lowGun: true, expr: 'normal' },
  { lean: 0, weapon: 'rifle', gunAngle: -34, expr: 'normal' },
  { lean: -2, weapon: 'rifle', gunAngle: -16, expr: 'shout' },
  { lean: -6, weapon: 'rifle', gunAngle: -8, recoil: 2, expr: 'shout' },
];

/** Soul strip timings (logic reads them). */
export const SOUL_TIMING = { hover: 8, tell: 8, swoop: 5, reach: 6, wail: 8, rifle: [10, 10, 9999, 6] as readonly number[] } as const;

function defineSouls(): void {
  defHi('enemy/oz-soul/hover', (d) => SOUL_HOVER.map((p, k) => soulFrame(p, k, d)), { ticksPerFrame: SOUL_TIMING.hover });
  defHi('enemy/oz-soul/tell', (d) => SOUL_TELL.map((p, k) => soulFrame(p, k + 1, d)), { ticksPerFrame: SOUL_TIMING.tell });
  defHi('enemy/oz-soul/swoop', (d) => SOUL_SWOOP.map((p, k) => soulFrame(p, k * 2 + 1, d)), { ticksPerFrame: SOUL_TIMING.swoop });
  defHi('enemy/oz-soul/reach', (d) => SOUL_REACH.map((p, k) => soulFrame(p, k * 2, d)), { ticksPerFrame: SOUL_TIMING.reach });
  defHi('fx/oz/soul/eject', (d) => SOUL_WAIL.map((p, k) => soulFrame(p, k, d)), { ticksPerFrame: SOUL_TIMING.wail });
  defHi('enemy/oz-gunner/rifle', (d) => SOUL_RIFLE.map((p, k) => soulFrame(p, k, d)), { durations: SOUL_TIMING.rifle, loop: false });
}

// =============================================================================================
// Small fx: the ghost helmet, the eyes, the glow, the mist, the spectral shot
// =============================================================================================

/** The see-through helmet over a host's head (1×: 15 × 8; anchor = the head centre). Plain: NO insignia. */
const HELMET_ROWS = [
  '.....kkkkk.....',
  '...kkgGGGgkk...',
  '..kgGGGGGGggk..',
  '.kgGGgggggggk..',
  '.kggggggggggk..',
  'kgggggggggggggk',
  'kkkkkkkkkkkkkkk',
];
function helmet1(): Frame {
  const b = new PixelBuffer(15, 7);
  const col: Record<string, Color> = { k: INK, g: PAL.slate[2], G: PAL.snow[1] };
  HELMET_ROWS.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && b.set(x, y, col[ch])));
  return { buf: b, ox: 7, oy: 8 };
}
function helmetHd(d: HdD): Frame {
  const c = new HdCanvas(15, 7, d);
  const steel = c.material({ ramp: PAL_HD.slate, lo: 1, hi: 5, spec: 0.7, shine: 20, wrap: 0.1 });
  const lip = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 5, spec: 0.5, shine: 16 });
  // The dome, then the flared rim (a little longer at the back, round at the front).
  c.ellipsoid(6.6, 5.6, 5.2, 4.9, { mat: steel, z: 1, round: 0.9 });
  c.capsule(1, 5.6, 13.2, 5.6, 0.75, 0.75, { mat: lip, z: 1.2 });
  c.erase(0, 0, 15, 7, (x, y) => y > 6.6 || (y > 5.9 && x > 13.6));
  const lo = helmet1().buf;
  const b = lo.trimBounds();
  if (b) c.erase(0, 0, 15, 7, (x, y) => !(lo.get(Math.min(14, Math.floor(x)), Math.min(6, Math.floor(y))) >>> 0));
  return { buf: c.render({ outline: 'A', ao: 0, rimLight: 2 }), ox: 7, oy: 8, density: d };
}

/** The glowing eyes (anchor = the eye px): frame 0 steady, 1 flared. 1×: a 1 × 2 green core. */
function eyes1(): Frame[] {
  return [0, 1].map((k) => {
    const b = new PixelBuffer(3, 4);
    b.vline(1, 1, 2, k ? PAL.snow[3] : PAL.green[4]);
    if (k) {
      b.set(1, 0, PAL.green[3]);
      b.set(1, 3, PAL.green[3]);
      b.set(0, 1, PAL.green[2]);
      b.set(2, 1, PAL.green[2]);
    }
    return { buf: b, ox: 1, oy: 1 };
  });
}
function eyesHd(d: HdD): Frame[] {
  return [0, 1].map((k) => {
    const c = new HdCanvas(3, 4, d);
    const g = PAL_HD_OZ.ghost;
    c.paint(0, 0, 3, 4, (x, y) => {
      const q = Math.hypot((x - 1.5) * 1.3, (y - 2) * 0.8);
      if (q < 0.4) return k ? PAL_HD.snow[6] : g[6];
      if (q < 0.75) return g[5];
      if (q < (k ? 1.35 : 1)) return g[4];
      return 0;
    });
    return { buf: c.render({ outline: 'none', ao: 0, clean: false }), ox: 1, oy: 1, density: d };
  });
}

/** A soft round glow (additive; centre anchor, 1×: 15 × 15 rings of green). */
function glow1(): Frame {
  const b = new PixelBuffer(15, 15);
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 15; x++) {
      const q = Math.hypot(x - 7, y - 7);
      if (q < 2.5) b.set(x, y, PAL.green[2]);
      else if (q < 4.8) b.set(x, y, PAL.green[1]);
      else if (q < 7.2 && (x + y) % 2 === 0) b.set(x, y, PAL.teal[0]);
    }
  return { buf: b, ox: 7, oy: 7 };
}
function glowHd(d: HdD): Frame {
  const c = new HdCanvas(15, 15, d);
  const g = PAL_HD_OZ.ghost;
  c.paint(0, 0, 15, 15, (x, y) => {
    const q = Math.hypot(x - 7.5, y - 7.5) / 7.2;
    if (q >= 1) return 0;
    // An ordered dither between the bands on LOGICAL px (a soft fall-off without new colours).
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const t = (1 - q) * 4 + ((((X & 1) << 1) | (Y & 1)) - 1.5) * 0.25;
    if (t > 3.2) return g[3];
    if (t > 2.2) return g[2];
    if (t > 1.2) return g[1];
    if (t > 0.4) return g[0];
    return 0;
  });
  return { buf: c.render({ outline: 'none', ao: 0, clean: false }), ox: 7, oy: 7, density: d };
}

/** The pale mist puff (bloodless): 5 frames, a ring of curls that opens and thins out (centre anchor, 16 × 16). */
function mist1(): Frame[] {
  return [0, 1, 2, 3, 4].map((k) => {
    const b = new PixelBuffer(16, 16);
    const r = 2.5 + k * 1.3;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + k * 0.3;
      const cx = 8 + Math.cos(a) * r;
      const cy = 8 + Math.sin(a) * r * 0.8 - k * 0.6;
      const rr = Math.max(0.6, 2.4 - k * 0.45);
      if (k >= 3 && i % 2) continue;
      b.circle(Math.round(cx), Math.round(cy), Math.round(rr), k < 2 ? PAL.snow[1] : PAL.green[3]);
    }
    if (k < 2) b.circle(8, 8, 2 - k, PAL.snow[2]);
    return { buf: b, ox: 8, oy: 8 };
  });
}
function mistHd(d: HdD): Frame[] {
  return [0, 1, 2, 3, 4].map((k) => {
    const c = new HdCanvas(16, 16, d);
    const m = c.material({ ramp: PAL_HD_OZ.ghost, lo: 2, hi: 5, wrap: 0.5, spec: 0, shine: 4 });
    const pale = c.material({ ramp: PAL_HD.snow, lo: 2, hi: 5, wrap: 0.5, spec: 0, shine: 4 });
    const r = 2.5 + k * 1.3;
    for (let i = 0; i < 7; i++) {
      if (k >= 3 && i % 2) continue;
      const a = (i / 7) * Math.PI * 2 + k * 0.3;
      const rr = Math.max(0.7, 2.6 - k * 0.45);
      c.ellipsoid(8 + Math.cos(a) * r, 8 + Math.sin(a) * r * 0.8 - k * 0.6, rr, rr * 0.9, { mat: k < 2 ? pale : m, round: 0.8 });
    }
    if (k < 2) c.ellipsoid(8, 8, 2.2 - k, 2 - k, { mat: pale, z: 1, round: 0.8 });
    const lo = mist1()[k].buf;
    c.erase(0, 0, 16, 16, (x, y) => !(lo.get(Math.min(15, Math.floor(x)), Math.min(15, Math.floor(y))) >>> 0));
    return { buf: c.render({ outline: 'none', ao: 0 }), ox: 8, oy: 8, density: d };
  });
}

/** The spectral shot: a glowing orb with a short wispy trail behind it (4 frames; centre anchor, 14 × 9). */
function shot1(): Frame[] {
  return [0, 1, 2, 3].map((k) => {
    const b = new PixelBuffer(14, 9);
    // The trail (to the left: the shot flies right; the game mirrors it).
    for (let i = 0; i < 6; i++) {
      const y = 4 + Math.round(Math.sin((i + k) * 1.3) * 1.2);
      b.set(1 + i, y, i < 3 ? PAL.teal[1] : PAL.green[2]);
    }
    b.circle(9, 4, 3, PAL.green[3]);
    b.circle(9, 4, 2, PAL.green[4]);
    b.set(9 + (k & 1), 3, PAL.snow[3]);
    b.set(9, 4, PAL.snow[3]);
    const o = b.outline(INK);
    return { buf: o, ox: 9, oy: 4 };
  });
}
function shotHd(d: HdD): Frame[] {
  return [0, 1, 2, 3].map((k) => {
    const c = new HdCanvas(14, 9, d);
    const g = PAL_HD_OZ.ghost;
    const core = c.material({ ramp: g, lo: 3, hi: 6, flat: true });
    const trail = c.material({ ramp: g, lo: 1, hi: 4, flat: true });
    c.ellipsoid(9, 4.5, 2.6, 2.6, { mat: core, z: 1, tone: 0.5 });
    c.ellipsoid(9, 4.5, 1.4, 1.4, { mat: core, z: 2, tone: 1 });
    for (let i = 0; i < 6; i++) {
      const y = 4.5 + Math.sin((i + k) * 1.3) * 1.2;
      c.ellipsoid(1.6 + i, y, 0.55 + i * 0.12, 0.5 + i * 0.1, { mat: trail, z: 0, tone: 0.3 - (5 - i) * 0.1 });
    }
    c.dot(9.2 + (k & 1) * 0.5, 3.6, PAL_HD.snow[6]);
    const lo = shot1()[k].buf;
    c.erase(0, 0, 14, 9, (x, y) => {
      const X = Math.min(13, Math.floor(x));
      const Y = Math.min(8, Math.floor(y));
      // Inside the 1× opaque box less its outline.
      if (!(lo.get(X, Y) >>> 0)) return true;
      return lo.get(X, Y) === INK;
    });
    return { buf: c.render({ outline: 'A', ao: 0, clean: false }), ox: 9, oy: 4, density: d };
  });
}

function defineFx(): void {
  defineSprite('fx/oz/soul/helmet', () => [helmet1()], { hd: (d) => [helmetHd(d)] });
  defineSprite('fx/oz/soul/eyes', () => eyes1(), { hd: (d) => eyesHd(d) });
  defineSprite('fx/oz/soul/glow', () => [glow1()], { hd: (d) => [glowHd(d)] });
  defineSprite('fx/oz/soul/mist', () => mist1(), { ticksPerFrame: 5, loop: false, hd: (d) => mistHd(d) });
  defineSprite('enemy/oz-ghost-shot/fly', () => shot1(), { ticksPerFrame: 5, hd: (d) => shotHd(d) });
}

// =============================================================================================

for (const look of OZ_LOOKS) defineTown(look);
for (const look of OZ_HOST_LOOKS) defineShambler(look);
for (const look of OZ_BRUTE_LOOKS) defineBrute(look);
defineSouls();
defineFx();
