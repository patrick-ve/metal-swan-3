/**
 * Mission oldenzaal — the dead soldiers' art (revision 2, spec §3.1). Owner: ZOMBIES. Manifest id
 * 'oldenzaal/zombies/art'. Prefixes `OZ_SPRITES.zombies`: 'enemy/oz-grunt/', 'enemy/oz-rifleman/',
 * 'enemy/oz-mg/', 'enemy/oz-crawler/', 'enemy/oz-zshot/', 'fx/oz/zombie/'.
 *
 * Risen WW2 German soldiers at real fidelity: the human rig (`renderHuman`: the squad's own 1× /
 * 2× / 4× pipeline) dressed in body space by `dress` (art-kit.ts: faded field grey, rotting skin,
 * jackboots, the Y-strap, dirt, mud and torn holes that stay on the cloth, the band on the near —
 * the left — upper arm with its disc and symbol: spec R2-2, the only symbol), the gas-mask can and
 * the bread bag on the back hip, the held weapon (art-gear.ts). The heads are drawn at run time on
 * top (art-head.ts: helmet / field cap / bare skull, two rotting faces; a helmet can fly off), and
 * so is the MG (every angle, whole / barrel shot off, carried / planted).
 *
 * Bodies (`<prefix><set>/<strip>`):
 * - `enemy/oz-grunt/tunic/…` (the trench shovel) and `enemy/oz-grunt/coat/…` (the greatcoat; the
 *   rifle swung by its barrel): idle 4, walk 6, tell 2, strike 3, recover 2, stagger 2, rise 6,
 *   gloat 4, cower 2, die 6.
 * - `enemy/oz-rifleman/tunic/…` (the rig's rifle): idle 4, walk 6, aim 3, fire 2, reload 4,
 *   stagger 2, rise 6, gloat 4, cower 2, die 6.
 * - `enemy/oz-mg/coat/…` (the brute build in a greatcoat; the MG is the overlay): idle 4, walk 6,
 *   plant 4, aim 2, fire 2, cool 2, getup 2, stagger 2, rise 6, gloat 4, cower 2, die 6.
 * - `enemy/oz-crawler/tunic/…` (legless: the rig's upper body lying, the stump): drag 6, tell 2,
 *   grab 2, hold 2, bite 2, recover 2, stagger 2, rise 5, gloat 2, cower 2, die 5.
 * Heads `enemy/oz-grunt/head/<helm-a|helm-b|cap-a|bare-a|bare-b>` (one frame per tilt), the MG
 * `enemy/oz-mg/gun-carry|gun-plant`, shots `enemy/oz-zshot/rifle|mg`, effects `fx/oz/zombie/…`
 * (eye, rise-<pavers|earth|stone|manhole>, chunk, dust, helmet, cap).
 *
 * `ZTABLE` (the logic reads it): per body strip and frame, the head's tilt frame (−1: no head) and
 * whether it is clipped at the floor (a rise), and the MG's pivot / angle / planted state.
 */
import type { Frame } from '../../../../engine/render';
import type { SpriteOpts } from '../../../../engine/sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import { poseJoints, renderHuman, type HumanStyle, type Pose, type RenderPart } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { hash2 } from '../../../art/paint';
import { defHi, dress, zStyle, type D } from './art-kit';
import { HEAD_TILTS, defineHeads, gearFrame, tiltIndex } from './art-head';
import { GUN_ANGLES, bagPiece, canPiece, clubPiece, defineGearArt, gunAngleIndex, pilePiece, shovelPiece, stumpPiece, type GearPiece } from './art-gear';

// =============================================================================================
// Kits and the frame recipe
// =============================================================================================

type Hand = 'fist' | 'open' | 'point' | 'grip';
const A = (sh: number, el: number, hand: Hand = 'open') => ({ sh, el, hand });
const L = (hip: number, knee: number, foot?: number) => (foot === undefined ? { hip, knee } : { hip, knee, foot });

/** A pose of a dead soldier: the rig pose plus what this kit adds. */
export interface ZPose extends Pose {
  /** The trench shovel in the near hand, pointing this way (deg; 0 forward, 90 down). */
  shovel?: number;
  /** The rifle swung by its barrel, pointing this way. */
  club?: number;
  /** The MG overlay: its angle (deg) and planted on the bipod (the logic table; no art here). */
  gun?: { a: number; plant?: boolean };
  /** No head overlay on this frame (it fell into the pile). */
  noHead?: boolean;
  /** Rising out of the floor: everything below the anchor line is cut (the head too, at run time). */
  clip?: boolean;
  /** The collapse: 0..1 of the body crumbled away (from the top) and the bone pile's growth. */
  crumble?: number;
  /** No gas-mask can / bread bag (rising out of the ground: they come with the body). */
  noGear?: boolean;
  /** No held weapon on this frame (dropped). */
  drop?: boolean;
}

interface Kit {
  /** Sprite prefix of the set (`enemy/oz-grunt/tunic/`). */
  pre: string;
  style: HumanStyle;
  part: RenderPart;
  seed: number;
  /** The held weapon of the set. */
  held: 'shovel' | 'club' | 'rifle' | 'mg' | 'none';
  /** Crawler: the anchor sits this far forward of the pelvis (the hit box centres on the body). */
  crawl?: boolean;
}

const KITS = {
  gruntTunic: { pre: 'enemy/oz-grunt/tunic/', style: zStyle({ topType: 'tunic', acc: ['pouches'] }), part: 'full', seed: 11, held: 'shovel' },
  gruntCoat: { pre: 'enemy/oz-grunt/coat/', style: zStyle({ topType: 'coat', acc: [] }), part: 'full', seed: 23, held: 'club' },
  rifleman: { pre: 'enemy/oz-rifleman/tunic/', style: zStyle({ topType: 'tunic', acc: ['pouches'] }), part: 'full', seed: 37, held: 'rifle' },
  gunner: { pre: 'enemy/oz-mg/coat/', style: zStyle({ topType: 'coat', build: 'brute', acc: ['pouches'] }), part: 'full', seed: 41, held: 'mg' },
  crawler: { pre: 'enemy/oz-crawler/tunic/', style: zStyle({ topType: 'tunic', acc: [] }), part: 'upper', seed: 53, held: 'none', crawl: true },
} as const satisfies Record<string, Kit>;
export type KitName = keyof typeof KITS;
export const KIT_PREFIX: Readonly<Record<KitName, string>> = {
  gruntTunic: KITS.gruntTunic.pre,
  gruntCoat: KITS.gruntCoat.pre,
  rifleman: KITS.rifleman.pre,
  gunner: KITS.gunner.pre,
  crawler: KITS.crawler.pre,
};

/** The per-frame data the logic reads (see the module comment). */
export interface ZFrameInfo {
  /** Head tilt frame (index into HEAD_TILTS), −1 = no head on this frame. */
  head: number;
  /** Clip the head (and the MG) at the floor line (a rise). */
  clip: boolean;
  /** The MG: pivot (logical, anchor-relative, facing right), angle frame, planted; null = none. */
  gun: { x: number; y: number; a: number; plant: boolean } | null;
}
export const ZTABLE = new Map<string, readonly ZFrameInfo[]>();

/** A crawler frame's anchor: forward of the pelvis (the hit box centres on the body) and down on the floor (logical px). */
const CRAWL_AX = 7;
const CRAWL_AY = 0;

/** The hip gear (behind): can and bag, offsets from the pelvis turned with the figure's rotation. */
function hipGear(j: ReturnType<typeof poseJoints>, rotDeg: number, d: D, one: boolean): GearPiece[] {
  const a = (rotDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (dx: number, dy: number): [number, number] => [j.pelvis[0] + dx * ca - dy * sa, j.pelvis[1] + dx * sa + dy * ca];
  const [cx, cy] = at(-6.2, -5.4);
  const [bx, by] = at(-6.0, -2.4);
  const can = canPiece(Math.round(cx), Math.round(cy), d);
  const bag = bagPiece(Math.round(bx), Math.round(by), d);
  return one ? [bag, can] : [bag, can];
}

/** Crop a dense piece to its 1× twin's opaque box (+1 px), so both make the same frame box. */
function fit(pd: GearPiece, p1: GearPiece): GearPiece {
  const b = p1.buf.trimBounds();
  if (!b) return { ...pd, buf: pd.buf.crop(0, 0, pd.density, pd.density) };
  const x0 = Math.max(0, b.x - 1);
  const y0 = Math.max(0, b.y - 1);
  const x1 = Math.min(p1.buf.w, b.x + b.w + 1);
  const y1 = Math.min(p1.buf.h, b.y + b.h + 1);
  const d = pd.density;
  return { buf: pd.buf.crop(x0 * d, y0 * d, (x1 - x0) * d, (y1 - y0) * d), x: pd.x + x0, y: pd.y + y0, density: d };
}

function toPiece(g: GearPiece, behind: boolean): Piece {
  return { buf: g.buf, x: g.x, y: g.y, behind, density: g.density };
}

/** One piece at density d, cropped to its 1× box. */
function gear(make: (d: D) => GearPiece, d: D): GearPiece {
  const p1 = make(1);
  return fit(d === 1 ? p1 : make(d), p1);
}

/** One body frame of a kit at density d. */
/** The pose's joints in the frame's space (an 'upper' frame is anchored at the pelvis). */
function jointsOf(kit: Kit, zp: ZPose): ReturnType<typeof poseJoints> {
  const j = poseJoints(kit.style, zp);
  if (kit.part !== 'upper') return j;
  const [px, py] = j.pelvis;
  const out = { ...j };
  for (const k of Object.keys(out) as Array<keyof typeof out>) out[k] = [j[k][0] - px, j[k][1] - py];
  return out;
}

function zframe(kit: Kit, zp: ZPose, d: D): Frame {
  let f: Frame = renderHuman(kit.style, zp, kit.part, d);
  const j = jointsOf(kit, zp);
  f = dress(f, j, { seed: kit.seed, boots: kit.part === 'full', strap: true });
  const rot = zp.rot ?? 0;
  const pieces: Piece[] = [];
  if (!zp.noGear && kit.part === 'full') for (const g of [0, 1]) pieces.push(toPiece(gear((dd) => hipGear(j, rot, dd, true)[g], d), true));
  if (!zp.drop) {
    const w = j.wrN;
    if (kit.held === 'shovel' && zp.shovel !== undefined) pieces.push(toPiece(gear((dd) => shovelPiece(w[0], w[1], zp.shovel as number, dd), d), false));
    if (kit.held === 'club' && zp.club !== undefined) pieces.push(toPiece(gear((dd) => clubPiece(w[0], w[1], zp.club as number, dd), d), false));
  }
  if (kit.crawl) {
    const tdeg = (Math.atan2(j.neck[1] - j.pelvis[1], j.neck[0] - j.pelvis[0]) * 180) / Math.PI;
    pieces.push(toPiece(gear((dd) => stumpPiece(j.pelvis[0], j.pelvis[1], tdeg, dd, Math.round(rot)), d), false));
  }
  if (pieces.length) f = withPieces(f, pieces);
  if (zp.crumble !== undefined) f = crumbleFrame(f, zp.crumble, kit.seed, kit.style.build === 'brute' ? 1.15 : 1);
  if (kit.crawl) f = { ...f, ox: f.ox + CRAWL_AX, oy: f.oy + CRAWL_AY, pts: shiftPts(f.pts, -CRAWL_AX, -CRAWL_AY) };
  if (zp.clip) f = clipAt0(f);
  return f;
}

function shiftPts(p: Frame['pts'], dx: number, dy: number): Record<string, readonly [number, number]> {
  if (!p) return {};
  const out: Record<string, readonly [number, number]> = {};
  for (const [k, v] of Object.entries(p)) out[k] = [v[0] + dx, v[1] + dy];
  return out;
}

/** Erase everything below the anchor line (rising out of the floor; a 1-px ink seam at the cut). */
function clipAt0(f: Frame): Frame {
  const d = f.density ?? 1;
  const buf = f.buf.clone();
  const Y0 = Math.round(f.oy * d);
  for (let Y = Math.max(0, Y0); Y < buf.h; Y++) for (let X = 0; X < buf.w; X++) buf.data[Y * buf.w + X] = 0;
  buf.touch();
  return { ...f, buf };
}

/**
 * The collapse (0..1): the body crumbles away from the top down (a ragged edge in logical px, the
 * same at every density) and the bone pile grows at the feet (in front).
 */
function crumbleFrame(f: Frame, t: number, seed: number, wide: number): Frame {
  const d = (f.density ?? 1) as D;
  const buf = f.buf.clone();
  const tb = f.buf.trimBounds();
  if (tb) {
    const top = tb.y / d;
    const bottom = (tb.y + tb.h) / d;
    const cut = top + (bottom - top) * Math.min(1, t * 1.08);
    for (let Y = 0; Y < buf.h; Y++) {
      const y = Y / d;
      for (let X = 0; X < buf.w; X++) {
        const i = Y * buf.w + X;
        if ((buf.data[i] & 255) === 0) continue;
        const x = X / d;
        const edge = cut + (hash2(Math.floor(x), Math.floor(y), seed) - 0.5) * 5;
        if (y < edge) buf.data[i] = 0;
      }
    }
    buf.touch();
  }
  const g = { ...f, buf };
  return withPieces(g, [toPiece(gear((dd) => pilePiece(t, dd, seed, wide), d), false)]);
}

// =============================================================================================
// The strip recipe and the table
// =============================================================================================

function tiltOf(zp: ZPose): number {
  return (zp.head?.tilt ?? 0) + (zp.rot ?? 0);
}

function info(kit: Kit, zp: ZPose): ZFrameInfo {
  const head = zp.noHead ? -1 : tiltIndex(tiltOf(zp));
  let gun: ZFrameInfo['gun'] = null;
  if (zp.gun && !zp.drop) {
    const j = poseJoints(kit.style, zp);
    gun = { x: j.wrN[0], y: j.wrN[1], a: gunAngleIndex(zp.gun.a), plant: zp.gun.plant === true };
  }
  return { head, clip: zp.clip === true, gun };
}

function strip(kit: Kit, name: string, poses: readonly ZPose[], o: SpriteOpts): void {
  const id = kit.pre + name;
  ZTABLE.set(id, poses.map((p) => info(kit, p)));
  defHi(id, (d) => poses.map((p) => zframe(kit, p, d)), o);
}

/**
 * Move a hand onto a target (logical, anchor-relative) with the rig's IK: the hand target is
 * relative to the shoulder; a few passes correct for the lean.
 */
function handTo(kit: Kit, pose: ZPose, arm: 'N' | 'F', tx: number, ty: number, hand: Hand = 'grip'): ZPose {
  let p: ZPose = pose;
  let to: [number, number] = [0, 0];
  const j0 = poseJoints(kit.style, p);
  const sh = arm === 'N' ? j0.shN : j0.shF;
  to = [tx - sh[0], ty - sh[1]];
  for (let k = 0; k < 3; k++) {
    p = arm === 'N' ? { ...p, armN: { to, hand } } : { ...p, armF: { to, hand } };
    const j = poseJoints(kit.style, p);
    const w = arm === 'N' ? j.wrN : j.wrF;
    to = [to[0] + (tx - w[0]), to[1] + (ty - w[1])];
  }
  return arm === 'N' ? { ...p, armN: { to, hand } } : { ...p, armF: { to, hand } };
}

// =============================================================================================
// Shared motion: slump, shamble, stagger, gloat, cower, rise, die
// =============================================================================================

/** The dead man's slump: leaning forward, the shoulders down, the head hanging. */
const SLUMP: ZPose = { lean: 8, hunch: 1, head: { dy: 1, tilt: 8 } };
/** The heavy shamble: the near leg dragged stiff after the far one (6 of the rig's 8 walk keys). */
const SHAMBLE_IDX = [0, 1, 3, 4, 5, 7] as const;
function shamble(i: number, extra: ZPose = {}): ZPose {
  const k = SHAMBLE_IDX[i];
  const w = P.WALK[k];
  // The dragged leg: the near foot scrapes (toe down) through its swing.
  const legN = k >= 4 ? { ...w.legN!, foot: -18 } : w.legN;
  return { ...w, legN, ...SLUMP, lean: 10 + (i % 3 === 1 ? 3 : 0), bob: i % 3 === 1 ? 1 : 0, head: { dy: 1, tilt: 10 + (i % 3) * 4, dx: i % 3 === 2 ? 1 : 0 }, ...extra };
}

const STAGGER: readonly ZPose[] = [
  { legN: L(14, 22), legF: L(-30, 18), lean: -14, armN: A(-34, 40), armF: A(52, 34), head: { tilt: -22 } },
  { legN: L(18, 26), legF: L(-24, 20), lean: -8, armN: A(-10, 30), armF: A(40, 30), head: { tilt: -10 } },
];
const GLOAT: readonly ZPose[] = [
  { ...P.STAND, ...SLUMP, lean: 4, armN: A(16, 14), armF: A(10, 16), head: { dy: 1, tilt: -10, dx: -1 } },
  { ...P.STAND, ...SLUMP, lean: 8, armN: A(22, 12), armF: A(16, 14), head: { dy: 1, tilt: 6 } },
  { ...P.STAND, ...SLUMP, lean: 12, armN: A(28, 10), armF: A(20, 12), head: { dy: 2, tilt: 20, dx: 1 } },
  { ...P.STAND, ...SLUMP, lean: 8, armN: A(22, 12), armF: A(16, 14), head: { dy: 1, tilt: 6 } },
];
const COWER: readonly ZPose[] = [0, 1].map((k): ZPose => ({
  legN: L(30, 40),
  legF: L(-10, 36),
  lean: -10 - k * 2,
  armN: { to: [4, -10], hand: 'open' },
  armF: { to: [6, -8], hand: 'open' },
  head: { tilt: 14 + k * 4 },
  dx: k === 1 ? -1 : 0,
}));
/** Out of the ground: an arm, the head, the hands on the floor, the torso, a knee, up. */
function riseKeys(last: ZPose): ZPose[] {
  return [
    { ...P.STAND, armN: A(176, 4, 'open'), armF: A(20, 10), head: { tilt: 30 }, lean: 10, dy: 30, clip: true, noGear: true, noHead: true },
    { ...P.STAND, armN: A(150, 30, 'open'), armF: A(130, 40, 'open'), head: { tilt: -18 }, lean: 10, dy: 24, clip: true, noGear: true },
    { ...P.STAND, armN: A(96, 20, 'open'), armF: A(84, 26, 'open'), head: { tilt: -14 }, lean: 30, dy: 16, clip: true, noGear: true },
    { ...P.STAND, legN: L(70, 110), legF: L(-10, 30), armN: A(64, 30, 'open'), armF: A(56, 34, 'open'), head: { tilt: -6 }, lean: 34, dy: 9, clip: true },
    { ...P.CROUCH, legN: L(84, 96), legF: L(10, 140), armN: A(40, 40, 'open'), armF: A(30, 40, 'open'), lean: 26, head: { tilt: 4 }, dy: 1, clip: true },
    last,
  ];
}
/** The collapse: knees buckle, he folds forward, then crumbles into bones and dust. */
function dieKeys(first: ZPose): ZPose[] {
  const fold: ZPose = { ...P.CROUCH, armN: A(70, 10), armF: A(60, 14), lean: 44, head: { tilt: 40 }, drop: true };
  return [
    first,
    { legN: L(44, 64), legF: L(-6, 56), armN: A(24, 10), armF: A(10, 16), lean: 18, head: { tilt: 26, dy: 1 }, drop: true },
    fold,
    { ...fold, crumble: 0.35, noHead: true },
    { ...fold, crumble: 0.7, noHead: true },
    { ...fold, crumble: 1, noHead: true, noGear: true },
  ];
}

const T = (n: number): SpriteOpts => ({ ticksPerFrame: n });
const ONCE = (durations: readonly number[]): SpriteOpts => ({ durations, loop: false });

/** Strip timings (the logic reads them: `ZTIMING.grunt.strike` …). */
export const ZTIMING = {
  idle: 12,
  walk: 9,
  stagger: [6, 30] as readonly number[],
  gloat: 14,
  cower: 5,
  rise: [10, 10, 9, 9, 8, 8] as readonly number[],
  die: [8, 8, 10, 8, 8, 9999] as readonly number[],
  grunt: { tell: [8, 9999] as readonly number[], strike: [3, 4, 9] as readonly number[], recover: [14, 20] as readonly number[] },
  rifle: { aim: [10, 10, 9999] as readonly number[], fire: [4, 14] as readonly number[], reload: [24, 24, 24, 24] as readonly number[] },
  mg: { plant: [10, 10, 10, 9999] as readonly number[], aim: 10, fire: 3, cool: 20, getup: [12, 9999] as readonly number[] },
  crawl: { drag: 10, tell: [10, 9999] as readonly number[], grab: [4, 9999] as readonly number[], hold: 6, bite: [10, 9999] as readonly number[], recover: [12, 20] as readonly number[], rise: [12, 12, 10, 10, 9999] as readonly number[], die: [8, 10, 8, 8, 9999] as readonly number[] },
} as const;

// =============================================================================================
// The grunts (shovel / club)
// =============================================================================================

function defineGrunt(kit: Kit): void {
  const held = kit.held === 'club' ? 'club' : 'shovel';
  const w = (deg: number): ZPose => (held === 'club' ? { club: deg } : { shovel: deg });
  const idle: ZPose[] = [0, 1, 2, 3].map((i) => ({
    ...P.STAND,
    ...SLUMP,
    lean: [8, 10, 9, 7][i],
    hunch: i === 2 ? 2 : 1,
    armN: A(18 + [0, 3, 5, 2][i], 18, 'fist'),
    armF: A(10 + [2, 4, 1, 0][i], 14),
    head: { dy: 1, tilt: [8, 12, 14, 6][i], dx: i === 1 ? 1 : 0 },
    ...w(held === 'club' ? 52 : 74),
  }));
  const walk: ZPose[] = [0, 1, 2, 3, 4, 5].map((i) => shamble(i, { armN: A(20 + (i % 3) * 6, 20, 'fist'), armF: A(28 - (i % 3) * 5, 16), ...w(held === 'club' ? 50 + (i % 3) * 3 : 72 + (i % 3) * 4) }));
  const tell: ZPose[] = [
    { legN: L(26, 20), legF: L(-20, 14), lean: -4, armN: { to: [-1, -12], hand: 'fist' }, armF: A(30, 40), head: { tilt: -6 }, ...w(-120) },
    { legN: L(28, 24), legF: L(-22, 16), lean: -8, armN: { to: [-3, -12], hand: 'fist' }, armF: A(36, 44), head: { tilt: -10 }, ...w(-140) },
  ];
  const strike: ZPose[] = [
    { legN: L(36, 18, 4), legF: L(-24, 16), lean: 8, armN: { to: [8, -9], hand: 'fist' }, armF: A(50, 30), head: { tilt: 4 }, ...w(-40) },
    { legN: L(44, 22, 6), legF: L(-26, 18), lean: 18, armN: { to: [10, -2], hand: 'fist' }, armF: A(70, 20), head: { tilt: 12 }, ...w(30) },
    { legN: L(42, 26, 4), legF: L(-22, 20), lean: 22, armN: { to: [8, 4], hand: 'fist' }, armF: A(60, 20), head: { tilt: 18 }, ...w(held === 'club' ? 60 : 78) },
  ];
  const recover: ZPose[] = [
    { legN: L(40, 28), legF: L(-20, 20), lean: 22, hunch: 2, armN: { to: [7, 6], hand: 'fist' }, armF: A(50, 20), head: { tilt: 20 }, ...w(held === 'club' ? 62 : 86) },
    { ...P.STAND, ...SLUMP, lean: 14, armN: A(30, 20, 'fist'), armF: A(20, 16), head: { tilt: 14 }, ...w(held === 'club' ? 54 : 76) },
  ];
  const last: ZPose = { ...idle[0] };
  strip(kit, 'idle', idle, T(ZTIMING.idle));
  strip(kit, 'walk', walk, T(ZTIMING.walk));
  strip(kit, 'tell', tell, ONCE(ZTIMING.grunt.tell));
  strip(kit, 'strike', strike, ONCE(ZTIMING.grunt.strike));
  strip(kit, 'recover', recover, ONCE(ZTIMING.grunt.recover));
  strip(kit, 'stagger', STAGGER.map((p) => ({ ...p, ...w(held === 'club' ? 40 : 50) })), ONCE(ZTIMING.stagger));
  strip(kit, 'rise', riseKeys(last).map((p, i) => (i >= 4 ? { ...p, ...w(held === 'club' ? 52 : 74) } : p)), { ...ONCE(ZTIMING.rise), defer: true });
  strip(kit, 'gloat', GLOAT.map((p) => ({ ...p, ...w(held === 'club' ? 52 : 76) })), { ...T(ZTIMING.gloat), defer: true });
  strip(kit, 'cower', COWER.map((p) => ({ ...p, ...w(-70) })), { ...T(ZTIMING.cower), defer: true });
  strip(kit, 'die', dieKeys({ ...STAGGER[0], ...w(held === 'club' ? 40 : 50) }), ONCE(ZTIMING.die));
}

// =============================================================================================
// The rifleman (the rig's rifle)
// =============================================================================================

function defineRifleman(kit: Kit): void {
  const low: ZPose = { weapon: 'rifle', lowGun: true, gunHand: 'far' };
  const idle: ZPose[] = [0, 1, 2, 3].map((i) => ({ ...P.STAND, ...SLUMP, ...low, lean: [7, 9, 8, 6][i], head: { dy: 1, tilt: [8, 12, 10, 6][i] }, armN: A(12 + i * 2, 14) }));
  const walk: ZPose[] = [0, 1, 2, 3, 4, 5].map((i) => shamble(i, { ...low, armN: A(18 + (i % 3) * 5, 18) }));
  const aim: ZPose[] = [
    { ...P.STAND, legN: L(22, 16), legF: L(-18, 12), lean: 4, weapon: 'rifle', gunAngle: 40, head: { tilt: 6 } },
    { ...P.STAND, legN: L(24, 16), legF: L(-20, 12), lean: 2, weapon: 'rifle', gunAngle: 16, head: { tilt: 4 } },
    { ...P.STAND, legN: L(26, 16), legF: L(-22, 12), lean: 2, weapon: 'rifle', aim: 'fwd', head: { tilt: 4 } },
  ];
  const fire: ZPose[] = [
    { ...aim[2], recoil: 2, lean: -3, head: { tilt: -2 } },
    { ...aim[2], recoil: 1, lean: 0 },
  ];
  const reload: ZPose[] = [0, 1, 2, 3].map((i) => ({ ...P.STAND, ...SLUMP, weapon: 'rifle', gunAngle: 24, lean: 6, head: { tilt: 18 + (i % 2) * 4 }, recoil: i % 2 }));
  strip(kit, 'idle', idle, T(ZTIMING.idle));
  strip(kit, 'walk', walk, T(ZTIMING.walk));
  strip(kit, 'aim', aim, ONCE(ZTIMING.rifle.aim));
  strip(kit, 'fire', fire, ONCE(ZTIMING.rifle.fire));
  strip(kit, 'reload', reload, T(24));
  strip(kit, 'stagger', STAGGER.map((p) => ({ ...p, ...low })), ONCE(ZTIMING.stagger));
  strip(kit, 'rise', riseKeys(idle[0]).map((p, i) => (i >= 4 ? { ...p, ...low } : p)), { ...ONCE(ZTIMING.rise), defer: true });
  strip(kit, 'gloat', GLOAT.map((p) => ({ ...p, ...low })), { ...T(ZTIMING.gloat), defer: true });
  strip(kit, 'cower', COWER.map((p) => ({ ...p })), { ...T(ZTIMING.cower), defer: true });
  strip(kit, 'die', dieKeys({ ...STAGGER[0], ...low }), ONCE(ZTIMING.die));
}

// =============================================================================================
// The MG zombie (brute build; the MG is the run-time overlay at the near hand)
// =============================================================================================

/** Where the near hand (the MG's grip) is: carried at the hip, and planted (kneeling) at shot height. */
const MG_CARRY: readonly [number, number] = [6, -17];
const MG_PLANT: readonly [number, number] = [5, -16];

function defineGunner(kit: Kit): void {
  /** Put both hands on the gun at `grip` (near) and on the jacket (far), the gun at `a` deg. */
  const onGun = (p: ZPose, grip: readonly [number, number], a: number, plant = false): ZPose => {
    const r = (a * Math.PI) / 180;
    const fx = grip[0] + 8 * Math.cos(r) - -0.2 * Math.sin(r);
    const fy = grip[1] + 8 * Math.sin(r) + -0.2 * Math.cos(r);
    let q = handTo(kit, p, 'N', grip[0], grip[1], 'grip');
    q = handTo(kit, q, 'F', fx, fy, 'grip');
    return { ...q, gun: { a, plant } };
  };
  const carry = (p: ZPose, a: number, dy = 0): ZPose => onGun(p, [MG_CARRY[0], MG_CARRY[1] + dy], a);
  const idle: ZPose[] = [0, 1, 2, 3].map((i) => carry({ ...P.STAND, ...SLUMP, lean: [6, 8, 7, 5][i], head: { dy: 1, tilt: [6, 10, 8, 4][i] } }, 22, i === 1 || i === 2 ? 1 : 0));
  const walk: ZPose[] = [0, 1, 2, 3, 4, 5].map((i) => carry(shamble(i), 20 + (i % 3) * 3, i % 3 === 1 ? 1 : 0));
  const kneel: ZPose = { legN: L(84, 92), legF: L(-6, 120), lean: 10, head: { tilt: 8 } };
  const plant: ZPose[] = [
    carry({ legN: L(40, 44), legF: L(-10, 60), lean: 14, head: { tilt: 10 } }, 30, 3),
    carry({ legN: L(70, 76), legF: L(-8, 100), lean: 16, head: { tilt: 12 } }, 36, 6),
    onGun({ ...kneel, lean: 14 }, [MG_PLANT[0], MG_PLANT[1] + 1], 8, true),
    onGun(kneel, MG_PLANT, 0, true),
  ];
  const aim: ZPose[] = [onGun({ ...kneel, lean: 12, head: { tilt: 12, dx: 1 } }, MG_PLANT, 0, true), onGun({ ...kneel, lean: 13, head: { tilt: 14, dx: 1 } }, MG_PLANT, 0, true)];
  const fire: ZPose[] = [onGun({ ...kneel, lean: 9, head: { tilt: 8 } }, [MG_PLANT[0] - 1, MG_PLANT[1]], 0, true), onGun({ ...kneel, lean: 11, head: { tilt: 10 } }, MG_PLANT, 0, true)];
  const cool: ZPose[] = [onGun({ ...kneel, lean: 4, head: { tilt: -4 } }, [MG_PLANT[0] - 1, MG_PLANT[1]], 0, true), onGun({ ...kneel, lean: 6, head: { tilt: 0 } }, [MG_PLANT[0] - 1, MG_PLANT[1]], 0, true)];
  const getup: ZPose[] = [plant[1], plant[0]];
  // The gloat: he pats the gun (the far hand comes up off the jacket and down again). No pointing.
  const gloat: ZPose[] = [0, 1, 2, 3].map((i) => {
    const q = carry({ ...P.STAND, ...SLUMP, lean: 6, head: { dy: 1, tilt: [4, 8, 10, 6][i] } }, 22);
    const r = (22 * Math.PI) / 180;
    const fx = MG_CARRY[0] + 5 * Math.cos(r);
    const fy = MG_CARRY[1] + 5 * Math.sin(r) - (i % 2 === 1 ? 3 : 0.6);
    return handTo(kit, q, 'F', fx, fy, 'open');
  });
  const stagger: ZPose[] = STAGGER.map((p) => carry(p, 34));
  const cower: ZPose[] = COWER.map((p) => carry({ ...p, armF: undefined }, 40));
  const rise = riseKeys(idle[0]).map((p, i) => (i >= 4 ? carry({ ...p }, 30) : p));
  const die = dieKeys(carry(STAGGER[0], 34));
  strip(kit, 'idle', idle, T(ZTIMING.idle));
  strip(kit, 'walk', walk, T(ZTIMING.walk + 1));
  strip(kit, 'plant', plant, ONCE(ZTIMING.mg.plant));
  strip(kit, 'aim', aim, T(ZTIMING.mg.aim));
  strip(kit, 'fire', fire, T(ZTIMING.mg.fire));
  strip(kit, 'cool', cool, T(ZTIMING.mg.cool));
  strip(kit, 'getup', getup, ONCE(ZTIMING.mg.getup));
  strip(kit, 'stagger', stagger, ONCE(ZTIMING.stagger));
  strip(kit, 'rise', rise, { ...ONCE(ZTIMING.rise), defer: true });
  strip(kit, 'gloat', gloat, { ...T(ZTIMING.gloat), defer: true });
  strip(kit, 'cower', cower, { ...T(ZTIMING.cower), defer: true });
  strip(kit, 'die', die, ONCE(ZTIMING.die));
}

// =============================================================================================
// The crawler (legless: the rig's upper body, lying; the stump)
// =============================================================================================

function defineCrawler(kit: Kit): void {
  const lie = (rot: number, tilt: number, armN: ZPose['armN'], armF: ZPose['armF'], extra: ZPose = {}): ZPose => ({ rot, head: { tilt }, armN, armF, ...extra });
  // The drag: the arms reach forward in turn, claw the floor and pull the body along.
  const drag: ZPose[] = [
    lie(80, -72, A(160, 16), A(110, 50)),
    lie(80, -70, A(140, 34), A(124, 40)),
    lie(79, -68, A(116, 52), A(146, 26)),
    lie(80, -72, A(104, 60), A(164, 14)),
    lie(80, -70, A(126, 44), A(136, 34)),
    lie(79, -68, A(150, 24), A(116, 48)),
  ];
  const tell: ZPose[] = [lie(64, -50, A(176, 24), A(170, 30)), lie(56, -42, A(186, 30), A(178, 34))];
  const grab: ZPose[] = [lie(80, -70, A(170, 0), A(166, 4)), lie(82, -72, A(156, 10), A(150, 14))];
  const hold: ZPose[] = [lie(82, -72, A(150, 20, 'fist'), A(144, 24, 'fist')), lie(81, -76, A(146, 24, 'fist'), A(140, 28, 'fist'), { dx: -1 })];
  const bite: ZPose[] = [lie(76, -80, A(150, 20, 'fist'), A(144, 24, 'fist')), lie(84, -60, A(150, 20, 'fist'), A(144, 24, 'fist'), { dx: 1 })];
  const recover: ZPose[] = [lie(82, -66, A(120, 40), A(110, 50)), drag[0]];
  const stagger: ZPose[] = [lie(70, -50, A(60, 40), A(40, 50), { dx: -1 }), lie(76, -62, A(90, 40), A(80, 50))];
  const gloat: ZPose[] = [lie(84, -60, A(120, 30), A(110, 40)), lie(84, -56, A(120, 30), A(110, 40))];
  const cower: ZPose[] = [lie(86, -40, A(200, 40), A(190, 50)), lie(86, -36, A(206, 44), A(194, 54), { dx: -1 })];
  const rise: ZPose[] = [
    lie(10, 0, A(172, 6), A(20, 10), { dy: 28, clip: true, noHead: true }),
    lie(40, -20, A(150, 30), A(130, 40), { dy: 18, clip: true }),
    lie(60, -40, A(120, 40), A(140, 30), { dy: 10, clip: true }),
    lie(72, -60, A(150, 24), A(116, 48), { dy: 4, clip: true }),
    drag[0],
  ];
  const die: ZPose[] = [
    stagger[0],
    lie(86, -30, A(130, 30), A(120, 40), { drop: true }),
    lie(88, -10, A(110, 30), A(100, 40), { crumble: 0.35, noHead: true }),
    lie(88, -10, A(110, 30), A(100, 40), { crumble: 0.7, noHead: true }),
    lie(88, -10, A(110, 30), A(100, 40), { crumble: 1, noHead: true }),
  ];
  strip(kit, 'drag', drag, T(ZTIMING.crawl.drag));
  strip(kit, 'tell', tell, ONCE(ZTIMING.crawl.tell));
  strip(kit, 'grab', grab, ONCE(ZTIMING.crawl.grab));
  strip(kit, 'hold', hold, T(ZTIMING.crawl.hold));
  strip(kit, 'bite', bite, ONCE(ZTIMING.crawl.bite));
  strip(kit, 'recover', recover, ONCE(ZTIMING.crawl.recover));
  strip(kit, 'stagger', stagger, ONCE(ZTIMING.stagger));
  strip(kit, 'rise', rise, { ...ONCE(ZTIMING.crawl.rise), defer: true });
  strip(kit, 'gloat', gloat, { ...T(ZTIMING.gloat), defer: true });
  strip(kit, 'cower', cower, { ...T(ZTIMING.cower), defer: true });
  strip(kit, 'die', die, ONCE(ZTIMING.crawl.die));
}

// =============================================================================================
// Registration
// =============================================================================================

defineHeads();
defineGearArt();
defineGrunt(KITS.gruntTunic);
defineGrunt(KITS.gruntCoat);
defineRifleman(KITS.rifleman);
defineGunner(KITS.gunner);
defineCrawler(KITS.crawler);
// The helmet and the cap that fly off (8 turns, centre anchor).
defHi('fx/oz/zombie/helmet', (d) => Array.from({ length: 8 }, (_, k) => gearFrame('helm', k, d)), { ticksPerFrame: 4 });
defHi('fx/oz/zombie/cap', (d) => Array.from({ length: 8 }, (_, k) => gearFrame('cap', k, d)), { ticksPerFrame: 4, defer: true });

export { HEAD_TILTS, GUN_ANGLES };
