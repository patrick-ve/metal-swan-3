/**
 * The ring gangs ON FOOT (docs/design/ring.md §R.5; docs/api/ring.md "Final jam, alight, rf-a"):
 * the people of the drive's gangs got off their scooters and out of their vans in the jam — the
 * same looks (the scooter gang's pillions, scooter/art.ts `SCOOTER_LOOKS`; the parcel courier and
 * the van crew, gangs/art-people.ts `COURIER` / `CREW`), now on the humanoid rig standing up.
 *
 * ONE density-generic drawer per strip: the rig at the frame's density (`renderHuman(…, d)`) and
 * the props drawn natively (the beer bottle `beerBottleBuf`, the parcel `parcelBuf`, our own
 * crowbar, card, scanner and the phone `phoneBuf`), composed in the family's FIXED logical box
 * (`GANG_BOX`, feet anchor) — so the 1×, 2× and 4× frames share their logical size and anchor; the
 * HD frames take the 1× frames' points (`hand`, `muzzle`; geometry is law). Outline A (the rig's;
 * the props' own). Bloodless: they stagger, roll onto their backsides, sit dazed and run off.
 * Nobody points or laughs (docs/research/mechanics.md §23).
 *
 * Prefixes (never under the prefixes `ams` preloads): `ring/foot/rider-a/…`, `ring/foot/rider-b/…`
 * (the scooter gang), `ring/foot/courier/…`, `ring/foot/crew/…`. Strips (facing right):
 * - every kind: `idle` (4), `walk` (8), `run` (4: fleeing with the arms up, after the daze),
 *   `turn` (2, turnSquash), `alert` (1), `hit` (2), `die` (5, deferred: a stagger, the knees go,
 *   a roll onto the backside, sitting), `dazed` (2, deferred: sitting, the head lolling),
 *   `gloat` (4, deferred), `cower` (2, deferred);
 * - riders: `tell-shoot` (3: the pistol comes up; point `muzzle`), `shoot` (2), `tell-throw` (3:
 *   a bottle cocked overhead; point `hand`), `throw` (3); gloat = thumbs on the phone;
 * - courier: `tell-throw` (3: the parcel lifted overhead), `throw` (3), `stick` (3: the NIET THUIS
 *   card pressed on a car window, the gag); gloat = scanning a parcel (the red line blinks);
 * - crew: `tell-swing` (3: the crowbar raised over the shoulder), `swing` (3), `tell-shoot` (3:
 *   the shotgun racked; point `muzzle`), `shoot` (2); gloat = leaning on the crowbar, yawning.
 * The props travel with the figures only (the thrown bottle and parcel are the drive's strips:
 * `ring/scooter/bottle`, `ring/parcel-van/parcel`).
 */
import { PixelBuffer } from '../../../../../engine/pixel';
import type { Frame } from '../../../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../../../engine/sprites';
import { HdCanvas } from '../../../../art/hd';
import { withPieces, type Piece } from '../../../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../../art/humanoid';
import * as P from '../../../../art/poses';
import { turnSquash } from '../../../creatures/draw';
import { finishA, mat, phoneBuf, top, type Dn } from '../../../stag/kit.art';
import { COURIER, CREW } from '../../gangs/art-people';
import { parcelBuf } from '../../gangs/art-people';
import { beerBottleBuf, BOTTLE_BOX, SCOOTER_LOOKS } from '../../scooter/art';

type Pts = Record<string, [number, number]>;

/** The family's fixed logical box (feet anchor at 0, 0): x −22 … 22, y −46 … +2. */
export const GANG_BOX: readonly [number, number, number, number] = [-22, -46, 44, 48];

/** The gang kinds on foot and their art prefixes. */
export const GANG_ART = {
  riderA: 'ring/foot/rider-a',
  riderB: 'ring/foot/rider-b',
  courier: 'ring/foot/courier',
  crew: 'ring/foot/crew',
} as const;

/** The looks: the scooter gang's pillions (red scooter, sky-blue scooter), the courier, the crew. */
export const RIDER_A: HumanStyle = SCOOTER_LOOKS[0].pillion;
export const RIDER_B: HumanStyle = SCOOTER_LOOKS[1].pillion;
export const GANG_COURIER: HumanStyle = COURIER;
export const GANG_CREW: HumanStyle = CREW;

// ---------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------

/** A rig frame at density d (no weapon unless the pose says so). */
function human(style: HumanStyle, pose: Pose, d: Dn): Frame {
  return renderHuman(style, { weapon: 'none', ...pose }, 'full', d as Density);
}

/** A prop buffer placed with its point (gx, gy) on the frame's `hand` point. */
function atHand(f: Frame, buf: PixelBuffer, gx: number, gy: number, d: Dn, behind = false): Piece | null {
  const h = f.pts?.hand;
  if (!h) return null;
  const p: Piece = { buf, x: Math.round(h[0] - gx), y: Math.round(h[1] - gy), behind };
  if (d !== 1) p.density = d;
  return p;
}

/** Stack the pieces on the frame and crop it to `GANG_BOX` (the anchor and the points stay). */
function boxed(f: Frame, pieces: ReadonlyArray<Piece | null>, d: Dn): Frame {
  const list = pieces.filter((p): p is Piece => p !== null);
  const all = list.length ? withPieces(f, list) : f;
  const [x0, y0, w, h] = GANG_BOX;
  const out = new PixelBuffer(w * d, h * d);
  out.blit(all.buf, (-all.ox - x0) * d, (-all.oy - y0) * d);
  const pts: Pts = {};
  for (const name of ['hand', 'muzzle'] as const) {
    const q = all.pts?.[name];
    if (q) pts[name] = [q[0], q[1]];
  }
  const has = Object.keys(pts).length > 0;
  if (d === 1) return has ? { buf: out, ox: -x0, oy: -y0, pts } : { buf: out, ox: -x0, oy: -y0 };
  return has ? { buf: out, ox: -x0, oy: -y0, pts, density: d } : { buf: out, ox: -x0, oy: -y0, density: d };
}

type Gen = (d: Dn) => Frame[];

/** Register a strip: 1× from the drawer at d 1; 2× / 4× from the same drawer with the 1× points. */
function def(id: string, gen: Gen, o: SpriteOpts = {}): void {
  defineSprite(id, () => gen(1), {
    ...o,
    hd: (d) => {
      const base = getFrames(id, 1);
      return gen(d as Dn).map((f, i) => {
        const b = base[i];
        return b?.pts ? { ...f, pts: b.pts } : f;
      });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------

const A = (sh: number, el: number, hand: 'fist' | 'open' | 'grip' = 'fist') => ({ sh, el, hand });

/** A crowbar along `deg` (0 = forward, −90 = up) in an 21 × 21 box, the grip at (10, 10). */
export function crowbarBuf(deg: number, d: Dn): PixelBuffer {
  const n = 21;
  const c = new HdCanvas(n, n, d);
  const bar = mat(c, 'red', { spec: 0.9, shine: 34, lo1: 0, hi1: 3, lo: 1, hi: 5, rim: 0.3 });
  const steel = mat(c, 'steel', { spec: 1.2, shine: 44, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const g = 10.5;
  const Pt = (s: number, q = 0): [number, number] => [g + s * ux - q * uy, g + s * uy + q * ux];
  // The shaft: red paint along the middle, bare steel at both working ends.
  c.capsule(...Pt(-3), ...Pt(5.5), 0.75, 0.75, { mat: bar, z: 1 });
  c.capsule(...Pt(5.5), ...Pt(8.4), 0.7, 0.55, { mat: steel, z: 1.1 });
  // The claw: a hook bent back at the far end.
  c.capsule(...Pt(8.4), ...Pt(9.4, 1.4), 0.55, 0.45, { mat: steel, z: 1.2 });
  c.capsule(...Pt(9.4, 1.4), ...Pt(8.6, 2.6), 0.45, 0.35, { mat: steel, z: 1.2 });
  // The chisel end behind the hand.
  c.capsule(...Pt(-3), ...Pt(-5), 0.7, 0.4, { mat: steel, z: 1.05 });
  return finishA(c, 0.2);
}

/** The NIET THUIS card held up (5 × 4 logical): white, a pink band, two navy text lines (2× / 4×). */
function cardBuf(d: Dn): PixelBuffer {
  const c = new HdCanvas(7, 6, d);
  const white = mat(c, 'snow', { spec: 0.3, shine: 20, lo1: 2, hi1: 3, lo: 4, hi: 6 });
  const pink = mat(c, 'pink', { spec: 0.3, shine: 20, lo1: 1, hi1: 3, lo: 3, hi: 5 });
  c.box(1, 1, 5, 4, { mat: white, z: 1, r: 0.3, tex: (t) => (t.y < 2 ? void (t.mat = pink) : undefined) });
  if (d > 1) {
    const ink = top('navy', d, 4);
    c.paint(1.6, 2.6, 3.8, 2, (x, y) => ((y < 3.3 || y > 3.7) && Math.floor(x * 2) % 3 !== 2 ? ink : 0), 3);
  }
  return finishA(c, 0.1);
}

/** The hand scanner (6 × 4): a dark grip, the window lit red when `on`. */
function scannerBuf(on: boolean, d: Dn): PixelBuffer {
  const c = new HdCanvas(8, 6, d);
  const body = mat(c, 'black', { spec: 0.6, shine: 26, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const win = mat(c, 'red', { spec: 1, shine: 40, lo1: on ? 2 : 0, hi1: on ? 3 : 1, lo: on ? 4 : 1, hi: on ? 6 : 2, flat: on });
  c.box(1, 1, 6, 2.6, { mat: body, z: 1, r: 0.5 });
  c.box(1.6, 3, 1.8, 2.2, { mat: body, z: 1.2, r: 0.4 });
  c.box(6, 1.3, 1, 2, { mat: win, z: 1.4 });
  return finishA(c, 0.15);
}

// ---------------------------------------------------------------------------------------------
// Shared body poses (facing right)
// ---------------------------------------------------------------------------------------------

/** The stagger, the knees going, the roll onto the backside, sitting (the bloodless "death"). */
function diePoses(): Pose[] {
  return [
    { ...P.DIE[0], expr: 'hurt' },
    { ...P.DIE[1], expr: 'hurt' },
    { weapon: 'none', grounded: false, crouch: 1, lean: 30, armN: A(40, 120), armF: A(30, 120), rot: -100, expr: 'hurt', dy: 4 },
    SIT[0],
    SIT[1],
  ];
}

/** Sitting dazed on the asphalt, propped on the hands, the head lolling. */
const SIT: readonly Pose[] = [0, 1].map((k) => ({
  legN: { hip: 88, knee: 6, foot: 20 },
  legF: { hip: 80, knee: 14, foot: 20 },
  lean: -14,
  armN: A(-30, 10, 'open'),
  armF: A(-40, 10, 'open'),
  head: { tilt: k ? 10 : -6 },
  expr: k ? ('blink' as const) : ('dazed' as const),
  dy: 8,
}));

const HIT: readonly Pose[] = [
  { ...P.STAND, lean: -12, armN: A(40, 60, 'open'), armF: A(60, 40, 'open'), head: { tilt: -8 }, expr: 'hurt' },
  { ...P.STAND, lean: -6, armN: A(20, 50, 'open'), armF: A(30, 40, 'open'), expr: 'hurt' },
];

/** Fleeing after the daze: the run with the arms up (comic, never a weapon). */
const FLEE: readonly Pose[] = P.PANIC_FLAIL.map((p) => ({ ...p, expr: 'panic' as const }));

const COWER: readonly Pose[] = P.PANIC_COWER.slice(0, 2).map((p) => ({ ...p, expr: 'panic' as const }));

/** The common strips of a kind; `hold` = the idle / walk arms (and the prop they carry). */
interface KindSpec {
  style: HumanStyle;
  /** The arms (and the weapon) at rest. */
  rest: Pose;
  /** A prop in the near hand at rest / walking (or null). */
  restProp?: (f: Frame, d: Dn) => Piece | null;
}

function common(pre: string, k: KindSpec): void {
  const f = (pose: Pose, d: Dn, prop = true): Frame => {
    const fr = human(k.style, pose, d);
    return boxed(fr, [prop && k.restProp ? k.restProp(fr, d) : null], d);
  };
  def(`${pre}/idle`, (d) => P.BREATH4.map((b) => f({ ...P.STAND, ...k.rest, ...b }, d)), { ticksPerFrame: 12 });
  def(`${pre}/walk`, (d) => P.WALK.map((w) => f({ ...w, ...k.rest }, d)), { ticksPerFrame: 6 });
  def(`${pre}/run`, (d) => FLEE.map((p) => f(p, d, false)), { ticksPerFrame: 5 });
  def(`${pre}/turn`, (d) => turnSquash(f({ ...P.STAND, ...k.rest }, d)), { ticksPerFrame: 2 });
  def(`${pre}/alert`, (d) => [f({ ...P.STAND, ...k.rest, lean: -4, head: { tilt: -6 }, expr: 'shout' }, d)], { ticksPerFrame: 30 });
  def(`${pre}/hit`, (d) => HIT.map((p) => f({ ...k.rest, ...p }, d)), { ticksPerFrame: 4, loop: false });
  def(`${pre}/die`, (d) => diePoses().map((p) => f(p, d, false)), { durations: [5, 5, 6, 10, 30], loop: false, defer: true });
  def(`${pre}/dazed`, (d) => SIT.map((p) => f(p, d, false)), { ticksPerFrame: 14, defer: true });
  def(`${pre}/cower`, (d) => COWER.map((p) => f(p, d, false)), { ticksPerFrame: 5, defer: true });
}

// ---------------------------------------------------------------------------------------------
// The scooter gang's riders (pistol, bottle)
// ---------------------------------------------------------------------------------------------

const PISTOL_DOWN: Pose = { weapon: 'pistol', aim: 'down', armF: A(-6, 30) };

const RIDER_TELL_SHOOT: readonly Pose[] = [
  { ...P.STAND, weapon: 'pistol', aim: 'down', armF: A(-6, 30), lean: -2, expr: 'normal' },
  { ...P.STAND, weapon: 'pistol', aim: 'fwd', armF: A(10, 40), lean: 0, expr: 'shout' },
  { ...P.STAND, weapon: 'pistol', aim: 'fwd', armF: A(10, 40), lean: 2, expr: 'shout' },
];
const RIDER_SHOOT: readonly Pose[] = [
  { ...P.STAND, weapon: 'pistol', aim: 'fwd', recoil: 2, armF: A(10, 40), lean: 0, expr: 'shout' },
  { ...P.STAND, weapon: 'pistol', aim: 'fwd', armF: A(10, 40), lean: 2, expr: 'normal' },
];
/** The bottle cocked overhead (the pistol tucked in the waistband: not drawn). */
const RIDER_TELL_THROW: readonly Pose[] = [
  { ...P.STAND, armN: A(-60, 70), armF: A(10, 30), lean: -2, expr: 'normal' },
  { ...P.STAND, armN: A(-140, 60), armF: A(30, 30, 'open'), lean: -8, expr: 'shout' },
  { ...P.STAND, armN: A(-165, 50), armF: A(45, 20, 'open'), lean: -12, expr: 'shout' },
];
const RIDER_TELL_BOTTLE = [-40, -110, -140];
const RIDER_THROW: readonly Pose[] = [
  { ...P.STAND, armN: { to: [10, -8], hand: 'open' }, armF: A(20, 30, 'open'), lean: 8, expr: 'shout' },
  { ...P.STAND, armN: A(80, 10, 'open'), armF: A(10, 30), lean: 10, expr: 'normal' },
  { ...P.STAND, armN: A(30, 40), armF: A(-6, 30), lean: 4, expr: 'normal' },
];

const bottleAt = (deg: number) => (f: Frame, d: Dn): Piece | null => atHand(f, beerBottleBuf(deg, d), (BOTTLE_BOX - 1) / 2, (BOTTLE_BOX - 1) / 2, d);

function defineRider(pre: string, style: HumanStyle): void {
  common(pre, { style, rest: PISTOL_DOWN });
  const fr = (pose: Pose, d: Dn, prop: ((f: Frame, d: Dn) => Piece | null) | null = null): Frame => {
    const f = human(style, pose, d);
    return boxed(f, [prop ? prop(f, d) : null], d);
  };
  def(`${pre}/tell-shoot`, (d) => RIDER_TELL_SHOOT.map((p) => fr(p, d)), { ticksPerFrame: 8, loop: false });
  def(`${pre}/shoot`, (d) => RIDER_SHOOT.map((p) => fr(p, d)), { durations: [4, 10], loop: false });
  def(`${pre}/tell-throw`, (d) => RIDER_TELL_THROW.map((p, i) => fr(p, d, bottleAt(RIDER_TELL_BOTTLE[i]))), { ticksPerFrame: 8, loop: false });
  def(`${pre}/throw`, (d) => RIDER_THROW.map((p) => fr(p, d)), { durations: [5, 6, 10], loop: false });
  // The gloat: thumbs on the phone (no pointing, no laughing).
  const phone = (f: Frame, d: Dn): Piece | null => atHand(f, phoneBuf(d), 2, 4, d);
  const keys: Pose[] = [0, 1, 2, 3].map((k) => ({ ...P.STAND, armN: { to: [5, -9 + (k % 2) * 0.6], hand: 'grip' }, armF: { to: [4, -8], hand: 'grip' }, head: { tilt: 14 }, expr: k === 3 ? 'blink' : 'normal' }));
  def(`${pre}/gloat`, (d) => keys.map((p) => fr(p, d, phone)), { ticksPerFrame: 14, defer: true });
}

defineRider(GANG_ART.riderA, RIDER_A);
defineRider(GANG_ART.riderB, RIDER_B);

// ---------------------------------------------------------------------------------------------
// The parcel courier (parcel lobs, the NIET THUIS card)
// ---------------------------------------------------------------------------------------------

/** The parcel box in the hands (13 px canvas, 9 × 7 box), its middle on the hands. */
const PARCEL_N = 13;
const parcelAt = (deg: number, dy = 0) => (f: Frame, d: Dn): Piece | null => atHand(f, parcelBuf(PARCEL_N, 9, 7, deg, d), PARCEL_N / 2 - 1, PARCEL_N / 2 + dy, d);

/** Carrying the parcel in front of the belly with both hands. */
const COURIER_REST: Pose = { armN: { to: [7, 4], hand: 'grip' }, armF: { to: [6, 4], hand: 'grip' } };

const COURIER_TELL: readonly Pose[] = [
  { ...P.STAND, armN: { to: [7, -6], hand: 'grip' }, armF: { to: [6, -6], hand: 'grip' }, lean: -2, expr: 'normal' },
  { ...P.STAND, armN: { to: [4, -17], hand: 'grip' }, armF: { to: [3, -17], hand: 'grip' }, lean: -8, expr: 'shout' },
  { ...P.STAND, armN: { to: [0, -20], hand: 'grip' }, armF: { to: [-1, -20], hand: 'grip' }, lean: -12, expr: 'shout' },
];
const COURIER_THROW: readonly Pose[] = [
  { ...P.STAND, armN: { to: [11, -12], hand: 'open' }, armF: { to: [10, -11], hand: 'open' }, lean: 10, expr: 'shout' },
  { ...P.STAND, armN: A(80, 10, 'open'), armF: A(70, 10, 'open'), lean: 10, expr: 'normal' },
  { ...P.STAND, armN: A(30, 40), armF: A(20, 40), lean: 4, expr: 'normal' },
];

function defineCourier(pre: string, style: HumanStyle): void {
  common(pre, { style, rest: COURIER_REST, restProp: parcelAt(0) });
  const fr = (pose: Pose, d: Dn, prop: ((f: Frame, d: Dn) => Piece | null) | null = null): Frame => {
    const f = human(style, pose, d);
    return boxed(f, [prop ? prop(f, d) : null], d);
  };
  def(`${pre}/tell-throw`, (d) => COURIER_TELL.map((p, i) => fr(p, d, parcelAt([0, -10, -20][i], 4))), { ticksPerFrame: 8, loop: false });
  def(`${pre}/throw`, (d) => COURIER_THROW.map((p) => fr(p, d)), { durations: [5, 6, 10], loop: false });
  // The gag: the NIET THUIS card raised (0), pressed on with a flat hand (1), a pat and a nod (2).
  const card = (f: Frame, d: Dn): Piece | null => atHand(f, cardBuf(d), 1, 5, d);
  const stick: Pose[] = [
    { ...P.STAND, armN: { to: [8, -6], hand: 'grip' }, armF: A(-6, 30), expr: 'normal' },
    { ...P.STAND, lean: 6, armN: { to: [11, -8], hand: 'open' }, armF: A(-6, 30), expr: 'normal' },
    { ...P.STAND, armN: { to: [9, -9], hand: 'open' }, armF: A(10, 20, 'open'), head: { tilt: 6 }, expr: 'smile' },
  ];
  def(`${pre}/stick`, (d) => stick.map((p, i) => fr(p, d, i === 0 ? card : null)), { durations: [16, 12, 24], defer: true });
  // The gloat: he scans a parcel (the red line blinks), no pointing, no laughing.
  const scan: Pose[] = [0, 1, 2, 3].map((k) => ({ ...P.STAND, armN: { to: [10, 2], hand: 'grip' }, armF: { to: [5, 5], hand: 'grip' }, head: { tilt: 14 }, expr: k === 2 ? 'blink' : 'normal' }));
  const scanner = (k: number) => (f: Frame, d: Dn): Piece | null => atHand(f, scannerBuf(k % 2 === 0, d), 2, 2, d);
  def(`${pre}/gloat`, (d) => scan.map((p, k) => {
    const f = human(style, p, d);
    const box = parcelBuf(PARCEL_N, 9, 7, 0, d);
    const hip = f.pts?.hip ?? [0, -15];
    const parcel: Piece = { buf: box, x: Math.round(hip[0] + 1), y: Math.round(hip[1] - 1), behind: false };
    if (d !== 1) parcel.density = d;
    return boxed(f, [parcel, scanner(k)(f, d)], d);
  }), { ticksPerFrame: 12, defer: true });
}

defineCourier(GANG_ART.courier, GANG_COURIER);

// ---------------------------------------------------------------------------------------------
// The van crew (crowbar, shotgun)
// ---------------------------------------------------------------------------------------------

const crowbarAt = (deg: number, behind = false) => (f: Frame, d: Dn): Piece | null => atHand(f, crowbarBuf(deg, d), 10, 10, d, behind);

const CREW_REST: Pose = { armN: A(10, 20), armF: A(-6, 26) };

const CREW_TELL_SWING: readonly Pose[] = [
  { ...P.STAND, armN: A(-60, 80), armF: A(-6, 26), lean: -2, expr: 'normal' },
  { ...P.STAND, armN: A(-130, 70), armF: A(20, 30, 'open'), lean: -8, expr: 'shout' },
  { ...P.STAND, armN: A(-155, 60), armF: A(40, 20, 'open'), lean: -12, expr: 'shout' },
];
const CREW_TELL_BAR = [-70, -150, -175];
const CREW_SWING: readonly Pose[] = [
  { ...P.STAND, armN: { to: [9, -9], hand: 'fist' }, armF: A(20, 30, 'open'), lean: 6, expr: 'shout' },
  { ...P.STAND, armN: A(90, 0), armF: A(10, 30), lean: 12, expr: 'shout' },
  { ...P.STAND, armN: A(45, 20), armF: A(-6, 26), lean: 6, expr: 'normal' },
];
const CREW_SWING_BAR = [-40, 10, 60];
const CREW_TELL_SHOOT: readonly Pose[] = [
  { ...P.STAND, weapon: 'rifle', lowGun: true, expr: 'normal' },
  { ...P.STAND, weapon: 'rifle', recoil: 2, expr: 'shout' },
  { ...P.STAND, weapon: 'rifle', expr: 'shout' },
];
const CREW_SHOOT: readonly Pose[] = [
  { ...P.STAND, weapon: 'rifle', recoil: 3, lean: -4, expr: 'shout' },
  { ...P.STAND, weapon: 'rifle', recoil: 1, expr: 'normal' },
];

function defineCrew(pre: string, style: HumanStyle): void {
  common(pre, { style, rest: CREW_REST, restProp: crowbarAt(100) });
  const fr = (pose: Pose, d: Dn, prop: ((f: Frame, d: Dn) => Piece | null) | null = null): Frame => {
    const f = human(style, pose, d);
    return boxed(f, [prop ? prop(f, d) : null], d);
  };
  def(`${pre}/tell-swing`, (d) => CREW_TELL_SWING.map((p, i) => fr(p, d, crowbarAt(CREW_TELL_BAR[i], i > 0))), { ticksPerFrame: 8, loop: false });
  def(`${pre}/swing`, (d) => CREW_SWING.map((p, i) => fr(p, d, crowbarAt(CREW_SWING_BAR[i]))), { durations: [3, 4, 12], loop: false });
  def(`${pre}/tell-shoot`, (d) => CREW_TELL_SHOOT.map((p) => fr(p, d)), { ticksPerFrame: 9, loop: false });
  def(`${pre}/shoot`, (d) => CREW_SHOOT.map((p) => fr(p, d)), { durations: [5, 12], loop: false });
  // The gloat: leaning on the crowbar planted on the asphalt, a big yawn.
  const lean: Pose[] = [0, 1, 2, 3].map((k) => ({ ...P.STAND, armN: { to: [7, 2], hand: 'fist' }, armF: { to: [6, 1], hand: 'fist' }, lean: 6, head: { tilt: k === 1 || k === 2 ? -10 : 0 }, expr: k === 1 || k === 2 ? 'yawn' : 'normal' }));
  def(`${pre}/gloat`, (d) => lean.map((p) => fr(p, d, crowbarAt(90))), { durations: [30, 20, 20, 30], defer: true });
}

defineCrew(GANG_ART.crew, GANG_CREW);
