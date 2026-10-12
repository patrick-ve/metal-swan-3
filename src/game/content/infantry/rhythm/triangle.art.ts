/**
 * `enemy/triangle[-<outfit>]/…` — the Triangle Ringer (GDD §9.1): a small slim soldier (about
 * 32 px without the hat), an oversized wobbling shako, big worried eyes, a steel triangle
 * hanging from his raised far hand and a beater in the near hand. No weapon: he has one job.
 *
 * Strips: the §6.1 contract (idle, gag = gag-counting, alert, walk, run, crouch, shoot /
 * crouch-shoot / throw = the ding with `muzzle` / `hand` points, panic = hugs his triangle on
 * tiptoe, the shako over his eyes, die, die-blast, die-burn, die-knife) + ding (3f, play once),
 * ring-ready (2f, between dings), gag-counting (6f: counts rests on his fingers, frame 4 = the
 * proud ding), the prop `triangle` (4 turning frames) and the shared extras (infantry/art.ts).
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { blastFrames } from '../../../art/human-sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import type { ArmPose, HumanStyle, Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { burnDurations, burnStrip, outfitStyle, OUTFIT_HAT, type Hold, type Outfit, type SoldierLook } from '../art';
import { burstArt, defineTypeArt, L, put, putTurned, ringArcs, shakoArt, stickBuf, TIPTOE, wristsOf, type IPose, type V2 } from './kit.art';

export const TRIANGLE_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'none',
  gear: 'black',
  accent: 'gold',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'slim',
  accessories: ['cross-belt'],
  face: ['eyeshine', 'blush'],
};

/** Every triangle frame is drawn with shorter legs (he is the smallest of the Legion). */
const SHORT: Pose = { legScale: 0.78 };

/** Instrument state of a frame. */
interface TriState {
  /** The triangle hangs from the far hand (default), is hugged, or is gone. */
  tri?: 'hang' | 'hug' | null;
  /** Beater angle in the near hand (deg, 0 = forward, clockwise); null = no beater. */
  beater?: number | null;
  /** Shako: on (default), off, low over the eyes; `wob` = extra tilt (the wobble). */
  hat?: 'on' | 'off' | 'low';
  wob?: number;
  /** Ring arcs beside the triangle (it rings). */
  ring?: boolean;
  /** A small white burst where the beater strikes. */
  hit?: boolean;
}

type TPose = IPose<TriState>;

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

/** The steel triangle (9 px a side, open at the lower left corner), lit on its upper-left edge. */
function triangleArt(): PixelBuffer {
  const b = new PixelBuffer(9, 9);
  // Left edge (lit), right edge, bottom bar — 1 px steel rod.
  for (let y = 0; y < 8; y++) {
    const half = Math.round((y / 7) * 4);
    b.set(4 - half, y, y < 6 ? PAL.steel[4] : PAL.steel[3]);
    b.set(4 + half, y, PAL.steel[2]);
  }
  b.hline(2, 8, 8, PAL.steel[2]);
  b.set(4, 0, PAL.snow[3]);
  return b.padded(1).outline(INK);
}

const TRI = triangleArt();
/** The triangle's string loop pixel (top corner) inside TRI. */
const TRI_TOP: V2 = [5, 1];
const ARCS = ringArcs();
const HIT = burstArt(3);

/** The beater: a thin steel rod (7 px) held at one end. */
function beater(deg: number): { buf: PixelBuffer; ox: number; oy: number } {
  const s = stickBuf(7, deg, 'steel', 1);
  return { buf: s.buf.outline(INK), ox: s.ox, oy: s.oy };
}

const shakos = new Map<string, PixelBuffer>();
/** The oversized shako (11×13 with a white plume), per hat colour. */
function shakoFor(outfit: Outfit): PixelBuffer {
  let s = shakos.get(outfit);
  if (!s) {
    s = shakoArt({ w: 9, h: 12, ramp: OUTFIT_HAT[outfit], plume: outfit === 'night' ? 'gold' : 'snow', plumeH: 4, badge: true, peak: true });
    shakos.set(outfit, s);
  }
  return s;
}

// ---------------------------------------------------------------------------------------------
// Dressing a frame
// ---------------------------------------------------------------------------------------------

/** Dress a triangle frame: the shako, the triangle on its string, the beater, rings. */
function dress(f: Frame, p: TPose, _style: HumanStyle, outfit: Outfit, strip: string): Frame {
  const s = p.i ?? {};
  const rot = p.rot ?? 0;
  const pieces: Piece[] = [];
  const pts: Record<string, [number, number]> = {};
  const head = f.pts?.head ?? [2, -26];
  const w = rot === 0 ? wristsOf(f, p) : null;
  const tri = s.tri === undefined ? 'hang' : s.tri;
  if (w && tri) {
    // Hanging: the top corner 3 px under the far hand (a short string); hugged: on the chest.
    const at: V2 = tri === 'hang' ? [w.far[0], w.far[1] + 3] : [w.near[0] - 2, w.near[1] - 5];
    pieces.push(put(TRI, at, TRI_TOP[0], TRI_TOP[1], false));
    if (tri === 'hang') pieces.push(put(stringArt(), [w.far[0], w.far[1]], 0, 0));
    const c: V2 = [at[0], at[1] + 5];
    pts.muzzle = [Math.round(c[0] + 3), Math.round(c[1])];
    if (s.ring) {
      pieces.push(put(ARCS, [c[0] + 6, c[1] - 1], 0, 3));
      pieces.push(put(ARCS.flipped(), [c[0] - 6, c[1] - 1], 4, 3));
    }
    if (s.hit) pieces.push(put(HIT, [c[0] + 1, c[1] + 1], 3, 3));
  }
  if (w && s.beater !== undefined && s.beater !== null) {
    const b = beater(s.beater);
    pieces.push(put(b.buf, w.near, b.ox, b.oy));
  }
  // The oversized shako sits on the brow and wobbles; it is off in the lying deaths.
  const hatState = s.hat ?? (strip === 'die' || strip === 'die-knife' ? 'off' : 'on');
  if (hatState !== 'off') {
    const hat = shakoFor(outfit);
    const lift = hatState === 'low' ? 5 : 0;
    const tilt = rot + (p.head?.tilt ?? 0) * 0.6 + (s.wob ?? 0);
    pieces.push(putTurned(hat, [head[0] - 1, head[1] - 3 + lift], (hat.w >> 1) - 1, hat.h - 2, tilt));
  }
  return withPieces(f, pieces, pts);
}

let stringBuf: PixelBuffer | null = null;
/** The short string loop from the hand to the triangle's top corner. */
function stringArt(): PixelBuffer {
  if (!stringBuf) {
    stringBuf = new PixelBuffer(1, 3);
    stringBuf.vline(0, 0, 2, PAL.snow[1]);
  }
  return stringBuf;
}

// ---------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------

/** The triangle held up in front of the chest; the beater ready below it. */
const F_HOLD: ArmPose = { to: [7, -4], hand: 'grip' };
const N_READY: ArmPose = { to: [5, 3], hand: 'grip' };
const N_BACK: ArmPose = { to: [2, 1], hand: 'grip' };
const N_STRIKE: ArmPose = { to: [9, 1], hand: 'grip' };
const HOLD: Pose = { weapon: 'none', armF: F_HOLD, armN: N_READY };
const READY: TriState = { beater: -20 };

const STAND_T: TPose = { ...SHORT, ...P.STAND, ...HOLD, i: READY };

const IDLE_T: TPose[] = [
  { ...STAND_T, i: { ...READY, wob: -3 } },
  { ...STAND_T, hunch: 1, i: { ...READY, wob: 2 } },
];

const WALK_T: TPose[] = P.WALK.map((p, k) => ({ ...SHORT, ...p, ...HOLD, i: { ...READY, wob: [-3, -1, 2, 3, 2, 0, -2, -3][k] } }));

/** Running away: the triangle swinging in the far hand, the beater pumping. */
const RUN_T: TPose[] = P.RUN.map((p, k) => ({
  ...SHORT,
  ...p,
  lean: 8,
  weapon: 'none',
  armF: { to: [6 - (k % 4), -2], hand: 'grip' },
  armN: { sh: [40, 10, -30, 10][k % 4], el: 60, hand: 'grip' },
  expr: 'panic',
  i: { beater: -60, wob: [-5, -2, 4, 6, 4, 0, -4, -6][k] },
}));

/** One ding: the beater back, the strike (burst), the ring. */
const DING_T: TPose[] = [
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: N_BACK, expr: 'panic', i: { beater: -40, wob: -2 } },
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: N_STRIKE, expr: 'shout', i: { beater: -10, hit: true, ring: true, wob: 4 } },
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: N_READY, expr: 'panic', bob: 1, i: { beater: -20, ring: true, wob: 2 } },
];

/** Between the dings: a nervous tremble, eyes wide. */
const READY_T: TPose[] = [
  { ...SHORT, ...P.STAND, ...HOLD, expr: 'panic', i: { ...READY, wob: -2 } },
  { ...SHORT, ...P.STAND, ...HOLD, dx: 1, expr: 'panic', i: { ...READY, wob: 1 } },
];

const ALERT_T: TPose[] = [
  { ...SHORT, ...P.STAND, legN: L(30, 40), legF: L(-10, 40), grounded: false, dy: -3, weapon: 'none', armF: { to: [5, -9], hand: 'grip' }, armN: { to: [2, -9], hand: 'grip' }, expr: 'panic', i: { beater: -100, wob: -8 } },
  { ...SHORT, ...P.STAND, ...HOLD, expr: 'panic', i: { ...READY, wob: 5 } },
];

/** Gag `counting`: counts rests on his fingers, lips moving, readies, DING (frame 4), beams. */
const COUNT_T: TPose[] = [
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: { to: [6, -6], hand: 'point' }, head: { tilt: -6 }, expr: 'chew', i: { beater: null } },
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: { to: [6, -7], hand: 'open' }, head: { tilt: -2 }, expr: 'normal', i: { beater: null } },
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: { to: [6, -6], hand: 'point' }, head: { tilt: -6 }, expr: 'chew', i: { beater: null } },
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: N_BACK, head: { tilt: 4 }, expr: 'blink', i: { beater: -40 } },
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: N_STRIKE, expr: 'happy', i: { beater: -10, hit: true, ring: true } },
  { ...SHORT, ...P.STAND, weapon: 'none', armF: F_HOLD, armN: N_READY, head: { tilt: -8 }, expr: 'happy', i: { beater: -20, ring: true, wob: -3 } },
];

/** The quiet panic: the triangle hugged to his chest, the shako down over his eyes, tiptoe. */
const PANIC_T: TPose[] = TIPTOE.map((p, k) => ({
  ...SHORT,
  ...p,
  lean: 6,
  weapon: 'none',
  armN: { to: [8, 1], hand: 'open' },
  armF: { to: [7, 0], hand: 'open' },
  expr: k % 2 === 0 ? 'panic' : 'hurt',
  i: { tri: 'hug', beater: null, hat: 'low', wob: k % 2 ? 3 : -3 },
}));

const CROUCH_T: TPose = { ...P.CROUCH, ...HOLD, expr: 'panic', i: READY };

const NOTHING: TriState = { tri: null, beater: null };
const DIE_T: TPose[] = P.DIE.map((p) => ({ ...SHORT, ...p, weapon: 'none', i: NOTHING }));
const KNIFE_T: TPose[] = P.DIE_KNIFE.map((p) => ({ ...SHORT, ...p, weapon: 'none', i: NOTHING }));

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

export function triangleStyle(outfit: Outfit): HumanStyle {
  // His own hat is the oversized shako piece: outfits only change colours (keepHat).
  return outfitStyle(TRIANGLE_STYLE, outfit, { keepHat: true });
}

const HOLD_STATE: Readonly<Record<Hold, TriState>> = {
  carry: READY,
  oneHand: { beater: null },
  noHands: { tri: null, beater: null },
};

function look(style: HumanStyle, outfit: Outfit): SoldierLook {
  return {
    style,
    carry: HOLD,
    oneHand: { weapon: 'none', armF: F_HOLD },
    noHands: { weapon: 'none' },
    body: SHORT,
    // die-crush: the triangle bounces away as a prop (the game spawns it), so none in the frames.
    dress: (f, pose, hold, strip) => dress(f, { ...pose, i: strip === 'die-crush' ? HOLD_STATE.noHands : HOLD_STATE[hold] }, style, outfit, strip),
    dropped: TRI,
    hat: shakoFor(outfit),
  };
}

const burn = (style: HumanStyle): Frame[] => burnStrip(style, { ...SHORT, weapon: 'none' });
const blast = (style: HumanStyle): Frame[] => blastFrames(style, { ...SHORT, weapon: 'none' });

defineTypeArt<TriState>({
  id: 'triangle',
  style: triangleStyle,
  dress,
  look,
  strips: {
    idle: { poses: IDLE_T, opts: { ticksPerFrame: 20 } },
    walk: { poses: WALK_T, opts: { ticksPerFrame: 6 } },
    run: { poses: RUN_T, opts: { ticksPerFrame: 3 } },
    alert: { poses: ALERT_T, opts: { durations: [10, 12], loop: false } },
    crouch: { poses: [CROUCH_T], opts: { ticksPerFrame: 30 } },
    ding: { poses: DING_T, opts: { durations: [4, 8, 14], loop: false } },
    'ring-ready': { poses: READY_T, opts: { ticksPerFrame: 3 } },
    shoot: { poses: DING_T.slice(1), opts: { durations: [8, 10], loop: false } },
    'crouch-shoot': { poses: DING_T.slice(1).map((p) => ({ ...p, ...P.CROUCH })), opts: { durations: [8, 10], loop: false } },
    throw: { poses: [...DING_T, READY_T[0]], opts: { durations: [6, 6, 8, 8], loop: false } },
    panic: { poses: PANIC_T, opts: { ticksPerFrame: 4 } },
    gag: { poses: COUNT_T, opts: { durations: [20, 20, 20, 12, 10, 30] } },
    'gag-counting': { poses: COUNT_T, opts: { durations: [20, 20, 20, 12, 10, 30] } },
    die: { poses: DIE_T, opts: { durations: [5, 5, 6, 6, 8, 30], loop: false } },
    'die-knife': { poses: KNIFE_T, opts: { durations: [8, 6, 6, 6, 30], loop: false } },
    'die-blast': { gen: blast, opts: { durations: [5, 5, 5, 5, 30], loop: false } },
    'die-burn': { gen: burn, opts: { durations: burnDurations(), loop: false } },
    triangle: { gen: () => triangleSpin(), opts: { ticksPerFrame: 4 } },
  },
});

/** The loose triangle (it bounces off his head): 4 turning frames, feet anchor. */
function triangleSpin(): Frame[] {
  return [0, 90, 180, 270].map((deg) => {
    const buf = deg === 0 ? TRI : TRI.rotated((deg * Math.PI) / 180, { quality: 'fast' });
    return { buf, ox: buf.w >> 1, oy: buf.h };
  });
}
