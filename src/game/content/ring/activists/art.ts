/**
 * The blockade's people (wave B; docs/design/ring.md §R.6, §R.9; docs/ART_GUIDE.md "UHD art",
 * "Motion"): the four activist kinds of EXHAUSTING REBELLION (two looks each, looks.ts) and the police.
 * Fictional, likeable comic characters; nobody points or laughs; bloodless.
 *
 * ONE density-generic drawer per strip: the humanoid rig at the frame's density (`renderHuman(…, d)`)
 * and the props drawn natively (the paint balloon, the glue tin, the soup can, the megaphone, the
 * sandwich), composed in the family's FIXED logical box (`ACT_BOX`, feet anchor) — so the 1×, 2× and
 * 4× frames share their logical size and anchor; the HD frames take the 1× frames' points (`hand`;
 * geometry is law). Outline A (the rig's; the props' own).
 *
 * Strips (facing right; `<P>` = `npc/ring/act-<kind>/<look>`):
 * - lijmer and loper (glued sitters, one palm stuck to the road): `sit` (2), `hit` (1), `tell-lob`
 *   (3: a paint balloon raised, wobbling; point `hand`), `lob` (2), `tell-pot` (3: the glue tin
 *   raised), `pot` (2), `rip` (3, deferred: the palm tugged free, up on the feet), `huff` (4,
 *   deferred: stomping off, arms folded, nose up), `flee` (4, deferred: then running), `gloat` (4,
 *   deferred: the lijmer hums with the eyes shut; the loper holds up the continue sign), `cower`
 *   (2, deferred: hands over the head).
 * - the loper also: `run` (4: running in with the banner held up), `stand` (1), `cower-stand` (2,
 *   deferred), `sitdown` (4: down on the asphalt, the glue slapped on the palm), `drop` (2, deferred:
 *   the banner falls).
 * - ketting (sitting, chained at the waist): `sit` (2), `hit` (1), `tell-throw` (3: the soup can
 *   shaken overhead), `throw` (2), `snap` (2, deferred: the chain snaps, then arms folded, stubborn),
 *   `plank` (2, deferred: carried stiff as a plank, arms folded; anchor: the middle under the body),
 *   `gloat` (4, deferred: holds up the continue sign), `cower` (2, deferred).
 * - megafoon (standing; the entity draws it a crate higher): `idle` (2), `hit` (1), `tell-shout` (3:
 *   the megaphone to the mouth, a deep breath), `shout` (2), `tell-squeal` (3: the megaphone whines,
 *   a hand to the ear, wincing), `squeal` (2), `hop` (2, deferred: off the crate), `flee` (4,
 *   deferred), `gloat` (4, deferred: a sandwich — a bite, chewing, half offered), `cower` (2, deferred).
 * - police (`npc/ring/agent/<look>`, our plain navy uniform with hi-vis bands; no emblem, and no
 *   lettering on a sprite that flips): `stand` (2), `walk` (8), `lift` (2: bend, lift); look a (the
 *   front officer) `carry-front` (8: the arms back, holding the shoulders), look b (the back officer)
 *   `carry-back` (8: the arms forward, holding the feet).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../../engine/sprites';
import { HdCanvas } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { finishA, mat, type Dn } from '../../stag/kit.art';
import './art-fx';
import { ACT_ART, ACT_STYLE, AGENT_STYLE, LOOKS, type Look, type PaintColour } from './looks';

type Pts = Record<string, [number, number]>;

/** The family's fixed logical box (feet anchor at 0, 0): x −22 … 22, y −46 … +2. */
export const ACT_BOX: readonly [number, number, number, number] = [-22, -46, 44, 48];
/** The plank's box (carried; anchor: the ground under the middle of the body). */
export const PLANK_BOX: readonly [number, number, number, number] = [-22, -30, 44, 32];

// ---------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------

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

/** Stack the pieces on the frame and crop it to `box` (the anchor shifts by (sx, sy); the points stay). */
function boxed(f: Frame, pieces: ReadonlyArray<Piece | null>, d: Dn, box: readonly [number, number, number, number] = ACT_BOX, sx = 0, sy = 0): Frame {
  const list = pieces.filter((p): p is Piece => p !== null);
  const all = list.length ? withPieces(f, list) : f;
  const [x0, y0, w, h] = box;
  const out = new PixelBuffer(w * d, h * d);
  out.blit(all.buf, (-all.ox - x0 + sx) * d, (-all.oy - y0 + sy) * d);
  const pts: Pts = {};
  const q = all.pts?.hand;
  if (q) pts.hand = [q[0] + sx, q[1] + sy];
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

/** A prop maker: the frame's hand point gets the prop. */
type Prop = ((f: Frame, d: Dn) => Piece | null) | null;

/** A strip drawer: every pose with its prop. */
function strip(style: HumanStyle, poses: readonly Pose[], props: Prop | readonly Prop[] = null, box = ACT_BOX): Gen {
  return (d) =>
    poses.map((p, i) => {
      const f = human(style, p, d);
      const pr = Array.isArray(props) ? (props as readonly Prop[])[i] : (props as Prop);
      return boxed(f, [pr ? pr(f, d) : null], d, box);
    });
}

const A = (sh: number, el: number, hand: 'fist' | 'open' | 'grip' = 'fist') => ({ sh, el, hand });

// ---------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------

/** The paint balloon in the hand (9 × 9, held at its knot (2, 3)). */
function balloonHeld(colour: PaintColour, k: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(9, 9, d);
  const skin = mat(c, colour, { spec: 1.2, shine: 46, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const sq = k * 0.3;
  c.ellipsoid(4.8, 4.2, 2.8 + sq, 2.8 - sq, { mat: skin, z: 1 });
  c.capsule(2.4, 2.8, 1.8, 2.2, 0.5, 0.4, { mat: skin, z: 0.8 });
  return finishA(c, 0.15);
}

/** The glue tin held by its rim (8 × 9, held at (4, 2)): white label, a yellow band, a brush. */
function potHeld(d: Dn): PixelBuffer {
  const c = new HdCanvas(8, 10, d);
  const tin = mat(c, 'steel', { spec: 1.1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const label = mat(c, 'snow', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  const band = mat(c, 'gold', { spec: 0.3, lo1: 1, hi1: 3 });
  const wood = mat(c, 'brown', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  c.cylinder(1.5, 3, 5, 5.5, {
    mat: tin,
    z: 1,
    cap: 0.8,
    tex: (t) => {
      if (t.y > 4 && t.y < 7.6) t.mat = label;
      if (t.y > 5.3 && t.y < 6.3) t.mat = band;
    },
  });
  c.capsule(4.6, 3.2, 6.2, 0.8, 0.45, 0.4, { mat: wood, z: 1.5 });
  return finishA(c, 0.2);
}

/** The soup can in the hand (6 × 8, held at (3, 4)). */
function canHeld(d: Dn): PixelBuffer {
  const c = new HdCanvas(6, 8, d);
  const tin = mat(c, 'steel', { spec: 1.2, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const label = mat(c, 'orange', { spec: 0.3, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const white = mat(c, 'snow', { spec: 0.2, lo1: 1, hi1: 3, lo: 3, hi: 6 });
  c.cylinder(1, 1.2, 4, 5.6, {
    mat: label,
    z: 1,
    cap: 0.6,
    tex: (t) => {
      if (t.y < 2.2 || t.y > 6.2) t.mat = tin;
      else if (t.y > 3.8 && t.y < 4.6) t.mat = white;
    },
  });
  return finishA(c, 0.2);
}

/** The megaphone along `deg` (0 = forward) in a 15 × 15 box, the grip at (7, 7). */
function megaphoneBuf(deg: number, d: Dn): PixelBuffer {
  const c = new HdCanvas(15, 15, d);
  const shell = mat(c, 'snow', { spec: 0.9, shine: 34, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const band = mat(c, 'orange', { spec: 0.4, lo1: 0, hi1: 3, lo: 1, hi: 5 });
  const black = mat(c, 'black', { spec: 0.6, shine: 26, lo1: 0, hi1: 2, lo: 1, hi: 4 });
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const Pt = (s: number, q = 0): [number, number] => [7.5 + s * ux - q * uy, 7.5 + s * uy + q * ux];
  // The handle under the body, the mouthpiece at the back, the cone opening forward.
  c.capsule(...Pt(0, 0.3), ...Pt(-0.6, 2.4), 0.55, 0.5, { mat: black, z: 0.8 });
  c.capsule(...Pt(-3), ...Pt(-1.6), 0.7, 0.9, { mat: black, z: 1 });
  c.poly([Pt(-1.8, -1.1), Pt(5.4, -3), Pt(5.4, 3), Pt(-1.8, 1.1)], {
    mat: shell,
    z: 1.2,
    round: 0.7,
    tex: (t) => {
      const s = (t.x - 7.5) * ux + (t.y - 7.5) * uy;
      if (s > 2.2 && s < 3.2) t.mat = band;
    },
  });
  c.ellipsoid(...Pt(5.4), 0.8, 3, { mat: shell, z: 1.25, tone: -0.35 });
  return finishA(c, 0.2);
}

/** The sandwich (7 × 5, held at (3, 3)): `bitten` has a bite out of the corner. */
function sandwichBuf(bitten: boolean, d: Dn): PixelBuffer {
  const c = new HdCanvas(8, 6, d);
  const bread = mat(c, 'sand', { spec: 0.2, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const leaf = mat(c, 'green', { spec: 0.3, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  const cheese = mat(c, 'gold', { spec: 0.3, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  c.box(1, 1, 6, 1.5, { mat: bread, z: 1, r: 0.6 });
  c.box(0.8, 2.4, 6.4, 0.8, { mat: leaf, z: 1.1, r: 0.3 });
  c.box(1, 3, 6, 0.7, { mat: cheese, z: 1.1, r: 0.2 });
  c.box(1, 3.6, 6, 1.4, { mat: bread, z: 1, r: 0.6 });
  if (bitten) c.erase(5, 0, 3, 6, (x, y) => Math.hypot(x - 7.2, y - 2.5) < 1.8);
  return finishA(c, 0.15);
}

const balloonAt = (colour: PaintColour, k = 0) => (f: Frame, d: Dn): Piece | null => atHand(f, balloonHeld(colour, k, d), 2, 3, d);
const potAt = (f: Frame, d: Dn): Piece | null => atHand(f, potHeld(d), 4, 2, d);
const canAt = (f: Frame, d: Dn): Piece | null => atHand(f, canHeld(d), 3, 4, d);
const megaAt = (deg: number, behind = false) => (f: Frame, d: Dn): Piece | null => atHand(f, megaphoneBuf(deg, d), 7, 7, d, behind);
const sandwichAt = (bitten: boolean) => (f: Frame, d: Dn): Piece | null => atHand(f, sandwichBuf(bitten, d), 3, 3, d);

// ---------------------------------------------------------------------------------------------
// Poses (facing right)
// ---------------------------------------------------------------------------------------------

/** Sitting on the asphalt, legs out in front, the far palm glued to the road behind the hip. */
const SIT_BASE: Pose = {
  legN: { hip: 86, knee: 10, foot: 16 },
  legF: { hip: 80, knee: 22, foot: 18 },
  dy: 8,
  lean: -4,
  armF: { to: [-5, 11], hand: 'open' },
};
const sit = (p: Pose): Pose => ({ ...SIT_BASE, ...p });

/** Resting: the near hand on the knee, breathing. */
const SIT_REST: readonly Pose[] = [sit({ armN: { to: [7, 6], hand: 'open' } }), sit({ armN: { to: [7, 6], hand: 'open' }, hunch: 1 })];
const SIT_HIT: readonly Pose[] = [sit({ lean: -14, armN: A(40, 60, 'open'), head: { tilt: -8 }, expr: 'hurt' })];
/** The throw from the seat: the item raised overhead (point `hand`), then flung forward. */
const SIT_TELL: readonly Pose[] = [
  sit({ armN: A(-100, 90), lean: -4, expr: 'normal' }),
  sit({ armN: A(-140, 60), lean: -10, expr: 'shout' }),
  sit({ armN: A(-165, 50), lean: -14, expr: 'shout' }),
];
const SIT_THROW: readonly Pose[] = [sit({ armN: A(80, 10, 'open'), lean: 8, expr: 'shout' }), sit({ armN: A(30, 40), lean: 2, expr: 'normal' })];
/** The rip: the palm tugged free, up on the feet. */
const RIP: readonly Pose[] = [
  sit({ lean: 10, armF: { to: [-4, 12], hand: 'open' }, armN: A(20, 60, 'open'), expr: 'hurt' }),
  { ...P.CROUCH, lean: 6, armF: A(-30, 40, 'open'), armN: A(30, 40, 'open'), expr: 'shout' },
  { ...P.STAND, lean: -4, armF: A(20, 30, 'open'), armN: A(-10, 90, 'open'), head: { tilt: -6 }, expr: 'hurt' },
];
/** Stomping off in a huff: arms folded, the nose up. */
const FOLD: Pose = { armN: { to: [5, 3], hand: 'fist' }, armF: { to: [6, 2], hand: 'fist' } };
const HUFF: readonly Pose[] = [0, 2, 4, 6].map((i) => ({ ...P.WALK[i], ...FOLD, lean: -3, head: { tilt: -8 }, expr: 'normal' as const }));
/** The lijmer's hum: swaying, the eyes shut, hands on the knees. */
const HUM: readonly Pose[] = [0, 1, 2, 3].map((k) => sit({ armN: { to: [7, 6], hand: 'open' }, lean: [-2, -5, -8, -5][k], head: { tilt: [6, 0, -6, 0][k] }, expr: 'happy' }));
/** Holding up the continue sign (point `hand` overhead). */
const SIGN_UP: readonly Pose[] = [0, 1, 2, 3].map((k) =>
  sit({ armN: { to: [7, -8 + (k % 2)], hand: 'grip' }, armF: { to: [7, -7 + (k % 2)], hand: 'grip' }, lean: -2, head: { tilt: k === 2 ? 6 : 0 }, expr: k === 3 ? 'blink' : 'normal' }),
);
const SIT_COWER: readonly Pose[] = [
  sit({ armN: { to: [-1, -12], hand: 'open' }, armF: { to: [3, -11], hand: 'open' }, lean: 6, hunch: 2, expr: 'panic' }),
  sit({ armN: { to: [-2, -11], hand: 'open' }, armF: { to: [2, -11], hand: 'open' }, lean: 8, hunch: 3, expr: 'panic' }),
];

/** The loper: running in with the banner held up (point `hand` high). */
const BANNER_UP: Pose = { armN: { to: [4, -11], hand: 'grip' }, armF: A(20, 60) };
const LOPER_RUN: readonly Pose[] = [0, 2, 4, 6].map((i) => ({ ...P.RUN[i], ...BANNER_UP, lean: 4, expr: 'shout' as const }));
const LOPER_STAND: readonly Pose[] = [{ ...P.STAND, ...BANNER_UP, expr: 'normal' }];
const STAND_COWER: readonly Pose[] = P.PANIC_COWER.slice(0, 2).map((p) => ({ ...p, expr: 'panic' as const }));
const SITDOWN: readonly Pose[] = [
  { ...P.CROUCH, armN: A(20, 40, 'open'), armF: A(-20, 40, 'open'), expr: 'normal' },
  sit({ dy: 6, lean: 6, armN: A(20, 60, 'open'), armF: { to: [-3, 8], hand: 'open' }, expr: 'shout' }),
  sit({ armN: { to: [-4, 9], hand: 'open' }, armF: { to: [-5, 9], hand: 'open' }, lean: 2, expr: 'shout' }),
  sit({ armN: { to: [7, 6], hand: 'open' }, expr: 'happy' }),
];
const DROP: readonly Pose[] = [
  { ...P.STAND, armN: A(160, 20, 'open'), armF: A(140, 30, 'open'), lean: -8, expr: 'panic' },
  { ...P.STAND, armN: A(120, 40, 'open'), armF: A(170, 20, 'open'), lean: -4, expr: 'hurt' },
];
const FLEE: readonly Pose[] = P.PANIC_FLAIL.map((p) => ({ ...p, expr: 'panic' as const }));

/** The ketting: the near hand on the knee, the far one on the chain at the waist. */
const KET_REST: readonly Pose[] = [
  sit({ armN: { to: [7, 6], hand: 'open' }, armF: { to: [3, 6], hand: 'fist' } }),
  sit({ armN: { to: [7, 6], hand: 'open' }, armF: { to: [3, 6], hand: 'fist' }, hunch: 1 }),
];
const KET_TELL: readonly Pose[] = [
  sit({ armN: A(-110, 80), armF: { to: [3, 6], hand: 'fist' }, lean: -6, expr: 'normal' }),
  sit({ armN: A(-160, 40), armF: { to: [3, 6], hand: 'fist' }, lean: -10, expr: 'shout' }),
  sit({ armN: A(-150, 60), armF: { to: [3, 6], hand: 'fist' }, lean: -12, expr: 'shout' }),
];
const KET_THROW: readonly Pose[] = [
  sit({ armN: A(80, 10, 'open'), armF: { to: [3, 6], hand: 'fist' }, lean: 8, expr: 'shout' }),
  sit({ armN: A(30, 40), armF: { to: [3, 6], hand: 'fist' }, lean: 2, expr: 'normal' }),
];
const KET_SNAP: readonly Pose[] = [
  sit({ armN: A(70, 20, 'open'), armF: A(-40, 30, 'open'), lean: -12, expr: 'shout' }),
  sit({ ...FOLD, lean: -6, head: { tilt: -8 }, expr: 'normal' }),
];
/** Carried stiff as a plank: lying straight, arms folded (rotated a quarter turn: the head forward). */
const PLANK: readonly Pose[] = [0, 1].map((k) => ({
  legN: { hip: 0, knee: 0, foot: 0 },
  legF: { hip: 2, knee: 0, foot: 0 },
  ...FOLD,
  grounded: false,
  rot: 90,
  head: { tilt: k ? -4 : 0 },
  expr: k ? ('blink' as const) : ('normal' as const),
}));

/** The megafoon (standing): the megaphone at rest, raised, the squeal. */
const MEGA_REST: readonly Pose[] = [
  { ...P.STAND, armN: { to: [6, 1], hand: 'grip' }, armF: A(-6, 26) },
  { ...P.STAND, armN: { to: [6, 1], hand: 'grip' }, armF: A(-6, 26), hunch: 1 },
];
const MEGA_TELL_SHOUT: readonly Pose[] = [
  { ...P.STAND, armN: { to: [6, -4], hand: 'grip' }, armF: A(-6, 26), lean: -2, expr: 'normal' },
  { ...P.STAND, armN: { to: [6, -8], hand: 'grip' }, armF: A(-20, 40), lean: -8, expr: 'normal' },
  { ...P.STAND, armN: { to: [6, -8], hand: 'grip' }, armF: A(-30, 50), lean: -10, hunch: -1, expr: 'normal' },
];
const MEGA_SHOUT: readonly Pose[] = [
  { ...P.STAND, armN: { to: [7, -8], hand: 'grip' }, armF: A(30, 60, 'open'), lean: 8, expr: 'shout' },
  { ...P.STAND, armN: { to: [7, -8], hand: 'grip' }, armF: A(20, 50, 'open'), lean: 5, expr: 'shout' },
];
const MEGA_TELL_SQUEAL: readonly Pose[] = [
  { ...P.STAND, armN: { to: [6, -8], hand: 'grip' }, armF: A(-10, 30), lean: 0, expr: 'normal' },
  { ...P.STAND, armN: { to: [6, -8], hand: 'grip' }, armF: { to: [1, -10], hand: 'open' }, lean: -4, head: { tilt: -6 }, expr: 'hurt' },
  { ...P.STAND, armN: { to: [5, -7], hand: 'grip' }, armF: { to: [1, -10], hand: 'open' }, lean: -8, head: { tilt: -10 }, expr: 'hurt' },
];
const MEGA_SQUEAL: readonly Pose[] = [
  { ...P.STAND, armN: { to: [6, -7], hand: 'grip' }, armF: { to: [1, -10], hand: 'open' }, lean: -12, expr: 'hurt' },
  { ...P.STAND, armN: { to: [6, -6], hand: 'grip' }, armF: { to: [1, -10], hand: 'open' }, lean: -8, expr: 'panic' },
];
const MEGA_HIT: readonly Pose[] = [{ ...P.STAND, armN: { to: [6, 1], hand: 'grip' }, armF: A(40, 40, 'open'), lean: -10, expr: 'hurt' }];
const MEGA_HOP: readonly Pose[] = [
  { ...P.CROUCH, armN: { to: [6, -2], hand: 'grip' }, armF: A(40, 40, 'open'), expr: 'panic' },
  { ...P.JUMP[0], armN: { to: [6, -6], hand: 'grip' }, armF: A(140, 30, 'open'), expr: 'panic' },
];
const MEGA_FLEE: readonly Pose[] = P.PANIC_FLAIL.map((p) => ({ ...p, armN: { to: [6, -2], hand: 'grip' as const }, expr: 'panic' as const }));
const MEGA_EAT: readonly Pose[] = [
  { ...P.STAND, armN: { to: [5, -6], hand: 'grip' }, armF: { to: [5, 3], hand: 'grip' }, expr: 'chew' },
  { ...P.STAND, armN: { to: [6, -3], hand: 'grip' }, armF: { to: [5, 3], hand: 'grip' }, expr: 'chew' },
  { ...P.STAND, armN: { to: [6, -3], hand: 'grip' }, armF: { to: [5, 3], hand: 'grip' }, head: { tilt: 4 }, expr: 'happy' },
  { ...P.STAND, armN: { to: [9, -1], hand: 'open' }, armF: { to: [5, 3], hand: 'grip' }, expr: 'smile' },
];
const MEGA_COWER: readonly Pose[] = P.PANIC_COWER.slice(0, 2).map((p) => ({ ...p, expr: 'panic' as const }));

/** The police: hands behind the back, walking, the lift, the carry. */
const AG_STAND: readonly Pose[] = [
  { ...P.STAND, armN: A(-14, 30), armF: A(-16, 30) },
  { ...P.STAND, armN: A(-14, 30), armF: A(-16, 30), hunch: 1 },
];
const AG_WALK: readonly Pose[] = P.WALK.map((w) => ({ ...w, armN: A(-10, 24), armF: A(-12, 24) }));
const AG_LIFT: readonly Pose[] = [
  { ...P.CROUCH, armN: { to: [5, 9], hand: 'grip' }, armF: { to: [4, 9], hand: 'grip' }, lean: 14, expr: 'normal' },
  { ...P.STAND, armN: { to: [5, 5], hand: 'grip' }, armF: { to: [4, 5], hand: 'grip' }, lean: -2, expr: 'hurt' },
];
const AG_CARRY_FRONT: readonly Pose[] = P.WALK.map((w) => ({ ...w, armN: { to: [-4, 7], hand: 'grip' as const }, armF: { to: [-5, 7], hand: 'grip' as const }, lean: 4 }));
const AG_CARRY_BACK: readonly Pose[] = P.WALK.map((w) => ({ ...w, armN: { to: [6, 5], hand: 'grip' as const }, armF: { to: [5, 5], hand: 'grip' as const }, lean: -4 }));

// ---------------------------------------------------------------------------------------------
// The strips
// ---------------------------------------------------------------------------------------------

const PAINT_OF: Readonly<Record<Look, PaintColour>> = { a: 'pink', b: 'sky' };

/** The glued sitter's strips (the lijmer; the loper adds its own). */
function defineSitter(pre: string, style: HumanStyle, look: Look, gloat: 'hum' | 'sign'): void {
  const paint = PAINT_OF[look];
  def(`${pre}/sit`, strip(style, SIT_REST), { ticksPerFrame: 24 });
  def(`${pre}/hit`, strip(style, SIT_HIT), { ticksPerFrame: 8, loop: false });
  def(`${pre}/tell-lob`, strip(style, SIT_TELL, [balloonAt(paint), balloonAt(paint, 1), balloonAt(paint)]), { ticksPerFrame: 9, loop: false });
  def(`${pre}/lob`, strip(style, SIT_THROW), { durations: [6, 12], loop: false });
  def(`${pre}/tell-pot`, strip(style, SIT_TELL, potAt), { ticksPerFrame: 10, loop: false });
  def(`${pre}/pot`, strip(style, SIT_THROW), { durations: [6, 12], loop: false });
  def(`${pre}/rip`, strip(style, RIP), { durations: [18, 10, 14], loop: false, defer: true });
  def(`${pre}/huff`, strip(style, HUFF), { ticksPerFrame: 6, defer: true });
  def(`${pre}/gloat`, strip(style, gloat === 'hum' ? HUM : SIGN_UP), { ticksPerFrame: 16, defer: true });
  def(`${pre}/cower`, strip(style, SIT_COWER), { ticksPerFrame: 6, defer: true });
  def(`${pre}/flee`, strip(style, FLEE), { ticksPerFrame: 5, defer: true });
}

for (const look of LOOKS) {
  defineSitter(ACT_ART.kind('lijmer', look), ACT_STYLE.lijmer[look], look, 'hum');

  // The loper: the sitter's strips + the run-in.
  const lp = ACT_ART.kind('loper', look);
  const ls = ACT_STYLE.loper[look];
  defineSitter(lp, ls, look, 'sign');
  def(`${lp}/run`, strip(ls, LOPER_RUN), { ticksPerFrame: 5 });
  def(`${lp}/stand`, strip(ls, LOPER_STAND), { ticksPerFrame: 30 });
  def(`${lp}/cower-stand`, strip(ls, STAND_COWER), { ticksPerFrame: 6, defer: true });
  def(`${lp}/sitdown`, strip(ls, SITDOWN), { durations: [8, 10, 14, 30], loop: false });
  def(`${lp}/drop`, strip(ls, DROP), { durations: [10, 14], loop: false, defer: true });

  // The ketting.
  const kp = ACT_ART.kind('ketting', look);
  const ks = ACT_STYLE.ketting[look];
  def(`${kp}/sit`, strip(ks, KET_REST), { ticksPerFrame: 24 });
  def(`${kp}/hit`, strip(ks, SIT_HIT.map((p) => ({ ...p, armF: { to: [3, 6], hand: 'fist' as const } }))), { ticksPerFrame: 8, loop: false });
  def(`${kp}/tell-throw`, strip(ks, KET_TELL, canAt), { ticksPerFrame: 8, loop: false });
  def(`${kp}/throw`, strip(ks, KET_THROW), { durations: [6, 12], loop: false });
  def(`${kp}/snap`, strip(ks, KET_SNAP), { durations: [14, 30], loop: false, defer: true });
  def(`${kp}/plank`, (d) => PLANK.map((p) => plankFrame(ks, p, d)), { ticksPerFrame: 8, defer: true });
  def(`${kp}/gloat`, strip(ks, SIGN_UP), { ticksPerFrame: 16, defer: true });
  def(`${kp}/cower`, strip(ks, SIT_COWER), { ticksPerFrame: 6, defer: true });

  // The megafoon.
  const mp = ACT_ART.kind('megafoon', look);
  const ms = ACT_STYLE.megafoon[look];
  def(`${mp}/idle`, strip(ms, MEGA_REST, megaAt(30)), { ticksPerFrame: 20 });
  def(`${mp}/hit`, strip(ms, MEGA_HIT, megaAt(40)), { ticksPerFrame: 8, loop: false });
  def(`${mp}/tell-shout`, strip(ms, MEGA_TELL_SHOUT, [megaAt(10), megaAt(-6), megaAt(-10)]), { ticksPerFrame: 8, loop: false });
  def(`${mp}/shout`, strip(ms, MEGA_SHOUT, megaAt(-4)), { ticksPerFrame: 8, loop: false });
  def(`${mp}/tell-squeal`, strip(ms, MEGA_TELL_SQUEAL, [megaAt(-6), megaAt(-8), megaAt(-14)]), { ticksPerFrame: 11, loop: false });
  def(`${mp}/squeal`, strip(ms, MEGA_SQUEAL, [megaAt(-18), megaAt(-10)]), { ticksPerFrame: 10, loop: false });
  def(`${mp}/hop`, strip(ms, MEGA_HOP, megaAt(20)), { durations: [8, 14], loop: false, defer: true });
  def(`${mp}/flee`, strip(ms, MEGA_FLEE, megaAt(-30)), { ticksPerFrame: 5, defer: true });
  def(`${mp}/gloat`, strip(ms, MEGA_EAT, [sandwichAt(false), sandwichAt(true), sandwichAt(true), sandwichAt(true)]), { durations: [20, 16, 16, 30], defer: true });
  def(`${mp}/cower`, strip(ms, MEGA_COWER), { ticksPerFrame: 6, defer: true });

  // The police.
  const ap = ACT_ART.agent(look);
  const as = AGENT_STYLE[look];
  def(`${ap}/stand`, (d) => AG_STAND.map((p) => agentFrame(as, p, d)), { ticksPerFrame: 30 });
  def(`${ap}/walk`, (d) => AG_WALK.map((p) => agentFrame(as, p, d)), { ticksPerFrame: 6 });
  def(`${ap}/lift`, (d) => AG_LIFT.map((p) => agentFrame(as, p, d)), { durations: [12, 12], loop: false, defer: true });
  if (look === 'a') def(`${ap}/carry-front`, (d) => AG_CARRY_FRONT.map((p) => agentFrame(as, p, d)), { ticksPerFrame: 6, defer: true });
  else def(`${ap}/carry-back`, (d) => AG_CARRY_BACK.map((p) => agentFrame(as, p, d)), { ticksPerFrame: 6, defer: true });
}

/** A carried plank: the figure turned a quarter, its middle over the anchor, lifted to hand height. */
function plankFrame(style: HumanStyle, pose: Pose, d: Dn): Frame {
  const f = human(style, pose, d);
  // Put the hip (the turn's centre) 3 px behind the anchor and 6 px up (+ the lift: the officers' hands).
  const hip = f.pts?.hip ?? [0, -12];
  return boxed(f, [], d, PLANK_BOX, -hip[0] - 3, -hip[1] - 6);
}

/** A police officer: the rig (our plain uniform; no emblem, no lettering on a sprite that flips). */
function agentFrame(style: HumanStyle, pose: Pose, d: Dn): Frame {
  return boxed(human(style, pose, d), [], d);
}
