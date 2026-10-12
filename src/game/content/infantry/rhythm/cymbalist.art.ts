/**
 * `enemy/cymbalist[-<outfit>]/…` — the Cymbal Crasher (GDD §9.1): build slim, red tunic with gold
 * trim, a red cap with a gold chin strap, big cartoon ears and two 14 px brass cymbals.
 *
 * Strips: the §6.1 contract (idle, gag = gag-tune, alert, walk, run, crouch, shoot / crouch-shoot
 * = the crash, throw = the HARD frisbee with a `hand` point, panic = hugs his cymbals on tiptoe
 * with the cap over his eyes, die = the cymbals clap shut on his own head, die-blast, die-burn,
 * die-knife) + raise (the T 32 telegraph: cymbals overhead, shimmering), crash (3f, play once),
 * ringing (his ears ring: R 50), gag-tune (6f), gag-yawn (5f), the prop `cymbal` (4 spinning
 * frames, feet anchor) and the shared extras (infantry/art.ts).
 * Projectiles (one set for every outfit): `proj/shockwave` (the ground wave) and
 * `proj/cymbal-disc` (the spinning frisbee).
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { blastFrames } from '../../../art/human-sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type ArmPose, type HumanStyle, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { burnDurations, burnStrip, outfitStyle, type Hold, type Outfit, type SoldierLook } from '../art';
import { bigEar, burstArt, defineTypeArt, L, put, putTurned, ringArcs, TIPTOE, wristsOf, type IPose, type V2 } from './kit.art';

export const CYMBALIST_STYLE: HumanStyle = {
  skin: 'skinC',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'red',
  accent: 'gold',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'gold',
  build: 'slim',
  accessories: ['cross-belt', 'epaulettes'],
  face: [],
};

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'grip'): ArmPose => ({ sh, el, hand });

/** How a cymbal shows: face-on (a disc), edge-on (a thin lens) or not at all. */
type CymView = 'face' | 'edge' | null;

/** Instrument state of a frame. */
interface CymState {
  near?: CymView;
  far?: CymView;
  /** Turn of each cymbal piece (deg, clockwise). */
  nearDeg?: number;
  farDeg?: number;
  /** Extra offset of a cymbal from its wrist. */
  nearOff?: V2;
  farOff?: V2;
  /** Sparkles on the raised cymbals (the telegraph shimmer). */
  shimmer?: number;
  /** A crash burst at this anchor-relative point. */
  burst?: V2;
  /** Vibration arcs by the ear (ringing ears, the tuning gag). */
  ring?: boolean;
  /** The cymbals clamped on his own head (the plain death). */
  clamped?: boolean;
  /** Draw the big ear (default true; off when the body is turned). */
  ear?: boolean;
}

type CPose = IPose<CymState>;

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

/** A cymbal face-on: a 14 px brass disc lit from the top-left, a groove ring and the bell. */
function cymbalFace(): PixelBuffer {
  const n = 14;
  const b = new PixelBuffer(n, n);
  b.ellipse(0, 0, n, n, PAL.gold[2]);
  const c = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const d = Math.hypot(x - c, y - c);
      const s = x - c + (y - c);
      if (d > 5 && s < -4) b.set(x, y, PAL.gold[3]);
      else if (d > 5 && s > 5) b.set(x, y, PAL.gold[1]);
      // The hammered groove ring.
      if (d > 3.6 && d < 4.4) b.set(x, y, s < 0 ? PAL.gold[2] : PAL.gold[1]);
    }
  }
  // The bell (centre dome) with its highlight, and a white glint on the rim.
  b.rect(5, 5, 4, 4, PAL.gold[3]);
  b.set(8, 8, PAL.gold[1]);
  b.set(7, 8, PAL.gold[2]);
  b.set(8, 7, PAL.gold[2]);
  b.set(5, 5, PAL.snow[3]);
  b.set(3, 2, PAL.snow[3]);
  return b.padded(1).outline(INK);
}

/** A cymbal edge-on: a 14 px lens with the bell bump on top. */
function cymbalEdge(): PixelBuffer {
  const b = new PixelBuffer(14, 4);
  b.hline(5, 8, 0, PAL.gold[3]);
  b.hline(1, 12, 1, PAL.gold[3]);
  b.hline(0, 13, 2, PAL.gold[2]);
  b.hline(2, 11, 3, PAL.gold[1]);
  b.set(6, 0, PAL.snow[3]);
  return b.padded(1).outline(INK);
}

const FACE = cymbalFace();
const EDGE = cymbalEdge();
const BURST = burstArt(6);
const SMALL_BURST = burstArt(4);
const ARCS = ringArcs().padded(0);

/** A tiny 4-point sparkle (the telegraph shimmer). */
function sparkle(): PixelBuffer {
  const b = new PixelBuffer(5, 5);
  b.hline(0, 4, 2, PAL.snow[3]);
  b.vline(2, 0, 4, PAL.snow[3]);
  b.set(2, 2, PAL.gold[3]);
  return b;
}
const SPARKLE = sparkle();

/** The gold chin strap: a 1 px band from the cap down the cheek to the chin. */
function chinStrap(): PixelBuffer {
  const b = new PixelBuffer(3, 6);
  b.vline(0, 0, 3, PAL.gold[2]);
  b.set(1, 4, PAL.gold[2]);
  b.set(2, 5, PAL.gold[1]);
  return b;
}
const STRAP = chinStrap();

const ears = new Map<string, PixelBuffer>();
function earFor(style: HumanStyle): PixelBuffer {
  const key = typeof style.skin === 'string' ? style.skin : style.skin.join(',');
  let e = ears.get(key);
  if (!e) {
    e = bigEar(style.skin);
    ears.set(key, e);
  }
  return e;
}

/** One cymbal placed with its centre on `at`. */
function cymbal(view: CymView, at: V2, deg: number, behind: boolean): Piece | null {
  if (!view) return null;
  const buf = view === 'face' ? FACE : EDGE;
  return putTurned(buf, at, (buf.w - 1) >> 1, (buf.h - 1) >> 1, deg, behind);
}

// ---------------------------------------------------------------------------------------------
// Dressing a frame
// ---------------------------------------------------------------------------------------------

/** Dress a cymbalist frame: far cymbal (behind), ear and chin strap, near cymbal, effects. */
function dress(f: Frame, p: CPose, style: HumanStyle, _outfit: Outfit, strip: string): Frame {
  const s = p.i ?? {};
  const rot = p.rot ?? 0;
  const pieces: Piece[] = [];
  const pts: Record<string, [number, number]> = {};
  const head = f.pts?.head ?? [2, -28];
  const upright = rot === 0;
  const w = upright ? wristsOf(f, p) : null;
  if (w) {
    const fo = s.farOff ?? [0, 0];
    const no = s.nearOff ?? [0, 0];
    const far = cymbal(s.far ?? null, [w.far[0] + fo[0], w.far[1] + fo[1]], s.farDeg ?? 0, true);
    if (far) pieces.push(far);
    const near = cymbal(s.near ?? null, [w.near[0] + no[0], w.near[1] + no[1]], s.nearDeg ?? 0, false);
    if (near) pieces.push(near);
  }
  // Big cartoon ears and the chin strap (only while the head is upright and the cap is on).
  const hatOn = p.hat !== false && !strip.startsWith('die-b');
  if ((s.ear ?? true) && Math.abs(rot) < 30) {
    pieces.push(put(earFor(style), [head[0] - 2, head[1] + 1], 3, 4));
    if (hatOn && strip !== 'panic') pieces.push(put(STRAP, [head[0] + 1, head[1] - 1], 0, 0));
  }
  if (s.clamped) {
    // Both cymbals edge-on, standing up either side of his head (CLANG).
    pieces.push(putTurned(EDGE, [head[0] - 6, head[1] - 1], 7, 2, 90));
    pieces.push(putTurned(EDGE, [head[0] + 6, head[1] - 1], 7, 2, 90));
  }
  if (s.shimmer) {
    const k = s.shimmer;
    const a = wristsOf(f, p);
    pieces.push(put(SPARKLE, [a.near[0] + (k % 2 ? 4 : -3), a.near[1] - 6], 2, 2));
    pieces.push(put(SPARKLE, [a.far[0] + (k % 2 ? -4 : 3), a.far[1] - 3], 2, 2));
  }
  if (s.ring) pieces.push(put(ARCS, [head[0] - 9, head[1] - 2], 2, 3));
  if (s.burst) pieces.push(put(s.burst[1] < -20 ? BURST : SMALL_BURST, s.burst, s.burst[1] < -20 ? 6 : 4, s.burst[1] < -20 ? 6 : 4));
  // The contract's shoot strips fire from the chest (the clash point in front of him).
  if (strip === 'shoot' || strip === 'crouch-shoot' || strip === 'crash') pts.muzzle = [Math.round(head[0] + 10), Math.round(head[1] + 10)];
  return withPieces(f, pieces, pts);
}

// ---------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------

/** Cymbals held at the sides: the near one face-on in front of the hip, the far one behind. */
const N_REST: ArmPose = { to: [5, 9], hand: 'grip' };
const F_REST: ArmPose = { to: [-4, 9], hand: 'grip' };
const REST: CymState = { near: 'face', far: 'face', nearOff: [1, 1], farOff: [-1, 0] };
const CARRY: Pose = { weapon: 'none', armN: N_REST, armF: F_REST };

const STAND_C: CPose = { ...P.STAND, ...CARRY, i: REST };

const WALK_C: CPose[] = P.WALK.map((p, k) => {
  const sw = [0, 1, 2, 1, 0, -1, -2, -1][k];
  return { ...p, weapon: 'none', armN: { to: [5 + sw, 9], hand: 'grip' }, armF: { to: [-4 - sw, 9], hand: 'grip' }, i: REST };
});

const RUN_C: CPose[] = P.RUN.map((p, k) => {
  const sw = [0, 2, 3, 2, 0, -2, -3, -2][k];
  return { ...p, lean: 8, weapon: 'none', armN: { to: [6 + sw, 6], hand: 'grip' }, armF: { to: [-5 - sw, 7], hand: 'grip' }, i: REST };
});

/** Cymbals overhead (the CRASH telegraph): face-on, tilted towards each other. */
const N_HIGH: ArmPose = { to: [5, -11], hand: 'grip' };
const F_HIGH: ArmPose = { to: [-4, -11], hand: 'grip' };
const RAISED: CymState = { near: 'face', far: 'face', nearDeg: 20, farDeg: -20, nearOff: [2, -4], farOff: [-2, -4] };
const RAISE_C: CPose[] = [0, 1, 2, 3].map((k) => ({
  ...P.STAND,
  legN: L(24, 18),
  legF: L(-20, 12),
  lean: -4,
  weapon: 'none',
  armN: N_HIGH,
  armF: F_HIGH,
  expr: k < 2 ? 'shout' : 'happy',
  bob: k % 2 ? 0 : -1,
  i: { ...RAISED, shimmer: k + 1 },
}));

/** CRASH: overhead, the clap in front of the chest (a white burst), slam toward the floor. */
const CRASH_C: CPose[] = [
  { ...P.STAND, legN: L(24, 18), legF: L(-20, 12), lean: -4, weapon: 'none', armN: N_HIGH, armF: F_HIGH, expr: 'shout', i: RAISED },
  {
    legN: L(30, 24),
    legF: L(-26, 16),
    lean: 8,
    weapon: 'none',
    armN: { to: [10, 0], hand: 'grip' },
    armF: { to: [9, -1], hand: 'grip' },
    expr: 'shout',
    i: { near: 'face', far: 'face', nearDeg: 10, farDeg: -10, nearOff: [1, 0], farOff: [3, -1], burst: [16, -24] },
  },
  {
    ...P.CROUCH,
    crouch: 0.5,
    lean: 14,
    weapon: 'none',
    armN: { to: [9, 7], hand: 'grip' },
    armF: { to: [8, 7], hand: 'grip' },
    expr: 'shout',
    i: { near: 'face', far: 'face', nearDeg: 30, farDeg: 20, nearOff: [1, 1], farOff: [3, 0], burst: [16, -5] },
  },
];

/** Ears ringing (R 50): he sways, cymbals hanging, head wobbling; the game adds the stars. */
const RINGING_C: CPose[] = [-8, 4, 10, 2].map((t, k) => ({
  legN: L(16 + (k % 2) * 6, 16),
  legF: L(-14, 12),
  lean: t / 2,
  head: { tilt: t },
  weapon: 'none',
  armN: { to: [4, 10], hand: 'grip' },
  armF: { to: [-3, 10], hand: 'grip' },
  expr: k === 3 ? 'blink' : 'dazed',
  i: { ...REST, ring: k % 2 === 0 },
}));

/** HARD frisbee: the near cymbal swung back flat, cocked, flung forward, follow-through. */
const THROW_C: CPose[] = [
  { ...P.STAND, lean: -6, weapon: 'none', armN: { to: [-7, 0], hand: 'grip' }, armF: F_REST, expr: 'shout', i: { near: 'edge', far: 'face', farOff: [-1, 0] } },
  { ...P.STAND, legN: L(28, 20), lean: -10, weapon: 'none', armN: { to: [-9, -3], hand: 'grip' }, armF: F_REST, expr: 'shout', i: { near: 'edge', nearDeg: -10, far: 'face', farOff: [-1, 0] } },
  { ...P.STAND, legN: L(30, 18), legF: L(-24, 12), lean: 8, weapon: 'none', armN: { to: [11, -3], hand: 'open' }, armF: F_REST, expr: 'shout', i: { near: null, far: 'face', farOff: [-1, 0] } },
  { ...P.STAND, lean: 10, weapon: 'none', armN: A(80, 10, 'open'), armF: F_REST, i: { near: null, far: 'face', farOff: [-1, 0] } },
  { ...P.STAND, lean: 2, weapon: 'none', armN: A(20, 30, 'open'), armF: F_REST, i: { near: null, far: 'face', farOff: [-1, 0] } },
];

/** The quiet Legion panic: cymbals hugged to the chest, cap down over the eyes, tiptoe. */
const PANIC_C: CPose[] = TIPTOE.map((p, k) => ({
  ...p,
  lean: 6,
  weapon: 'none',
  hatDy: 3,
  armN: { to: [8, 2], hand: 'grip' },
  armF: { to: [7, 1], hand: 'grip' },
  expr: k % 2 === 0 ? 'panic' : 'hurt',
  i: { near: 'face', far: 'face', farOff: [1, -1] },
}));

const ALERT_C: CPose[] = [
  { ...P.STAND, legN: L(30, 40), legF: L(-10, 40), grounded: false, dy: -3, weapon: 'none', armN: { to: [6, -9], hand: 'grip' }, armF: { to: [-4, -9], hand: 'grip' }, expr: 'panic', i: { ...RAISED, nearOff: [2, -3], farOff: [-2, -3] } },
  { ...P.STAND, ...CARRY, expr: 'shout', i: REST },
];

/** Gag `tune`: taps the far cymbal, holds it to his ear, nods. */
const TUNE_C: CPose[] = [
  { ...P.STAND, ...CARRY, i: REST },
  { ...P.STAND, weapon: 'none', armF: { to: [8, 1], hand: 'grip' }, armN: { to: [10, -1], hand: 'point' }, head: { tilt: 8 }, i: { near: null, far: 'face', farOff: [2, 0] } },
  { ...P.STAND, weapon: 'none', armF: { to: [8, 1], hand: 'grip' }, armN: { to: [9, 1], hand: 'point' }, head: { tilt: 8 }, expr: 'blink', i: { near: null, far: 'face', farOff: [2, 0], ring: true } },
  { ...P.STAND, weapon: 'none', armF: { to: [-2, -8], hand: 'grip' }, armN: N_REST, head: { tilt: -12 }, expr: 'blink', i: { near: 'face', nearOff: [1, 1], far: 'face', farOff: [-5, -1], ring: true, ear: false } },
  { ...P.STAND, weapon: 'none', armF: { to: [-2, -8], hand: 'grip' }, armN: N_REST, head: { tilt: 4, dy: 1 }, expr: 'happy', i: { near: 'face', nearOff: [1, 1], far: 'face', farOff: [-5, -1], ear: false } },
  { ...P.STAND, weapon: 'none', armF: { to: [-2, -8], hand: 'grip' }, armN: N_REST, head: { tilt: -6 }, expr: 'happy', i: { near: 'face', nearOff: [1, 1], far: 'face', farOff: [-5, -1], ear: false } },
];

/** Gag `yawn`: a long stretch with the cymbals overhead. */
const YAWN_C: CPose[] = [
  { ...P.STAND, ...CARRY, i: REST },
  { ...P.STAND, lean: -4, weapon: 'none', armN: { to: [4, -11], hand: 'grip' }, armF: { to: [-3, -11], hand: 'grip' }, head: { tilt: -10 }, expr: 'yawn', i: { ...RAISED, nearDeg: 40, farDeg: -40 } },
  { ...P.STAND, lean: -8, hunch: -1, weapon: 'none', armN: { to: [3, -12], hand: 'grip' }, armF: { to: [-2, -12], hand: 'grip' }, head: { tilt: -16 }, expr: 'yawn', i: { ...RAISED, nearDeg: 50, farDeg: -50 } },
  { ...P.STAND, lean: -2, weapon: 'none', armN: { to: [7, 2], hand: 'grip' }, armF: { to: [-5, 3], hand: 'grip' }, head: { tilt: 6 }, expr: 'blink', i: REST },
  { ...P.STAND, ...CARRY, head: { tilt: 4 }, expr: 'blink', i: REST },
];

/** Death: the cymbals clap shut on his own head, he wobbles, topples back, a cymbal on his face. */
const DIE_C: CPose[] = ([
  { ...P.STAND, lean: -10, weapon: 'none', armN: { to: [7, -9], hand: 'grip' }, armF: { to: [-6, -9], hand: 'grip' }, expr: 'hurt', i: { near: 'face', far: 'face', nearDeg: 40, farDeg: -40, nearOff: [2, -3], farOff: [-2, -3] } },
  { ...P.STAND, hunch: 1, weapon: 'none', armN: { to: [3, -9], hand: 'open' }, armF: { to: [-2, -9], hand: 'open' }, expr: 'dazed', i: { clamped: true, ear: false } },
  { ...P.STAND, legN: L(14, 24), legF: L(-6, 20), lean: -6, hunch: 1, weapon: 'none', armN: A(30, 20, 'open'), armF: A(20, 20, 'open'), head: { tilt: -8 }, expr: 'dazed', i: { clamped: true, ear: false } },
  { ...P.DIE[2], weapon: 'none', i: { ear: false } },
  { ...P.DIE[4], weapon: 'none', i: { ear: false } },
  { ...P.DIE[5], weapon: 'none', i: { ear: false } },
] as CPose[]).map((p) => ({ ...p, hat: false })); // the cap pops off at the hit (the game spawns it)

const KNIFE_C: CPose[] = P.DIE_KNIFE.map((p) => ({ ...p, weapon: 'none', hat: false, i: { ear: false } }));

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

export function cymbalistStyle(outfit: Outfit): HumanStyle {
  return outfitStyle(CYMBALIST_STYLE, outfit);
}

const HOLD_STATE: Readonly<Record<Hold, CymState>> = {
  carry: REST,
  oneHand: { far: 'face', farOff: [-1, 0] },
  noHands: {},
};

/** Both cymbals lying flat on the ground (dropped in `ears`). */
function droppedCymbals(): PixelBuffer {
  const out = new PixelBuffer(EDGE.w + 6, EDGE.h + 1);
  out.blit(EDGE, 6, 1);
  out.blit(EDGE, 0, 0);
  return out;
}

function look(style: HumanStyle, outfit: Outfit): SoldierLook {
  return {
    style,
    carry: CARRY,
    oneHand: { weapon: 'none', armF: F_REST },
    noHands: { weapon: 'none' },
    // die-crush: the cymbals fly off as props (the game spawns them), so none in the frames.
    dress: (f, pose, hold, strip) => dress(f, { ...pose, i: strip === 'die-crush' ? { ear: false } : HOLD_STATE[hold] }, style, outfit, strip),
    dropped: droppedCymbals(),
  };
}

/** The lying death frames turn the last cymbal into a lid over his face. */
function dieFrames(style: HumanStyle, outfit: Outfit): Frame[] {
  return DIE_C.map((p, k) => {
    const f = dress(renderHuman(style, p, 'full'), p, style, outfit, 'die');
    if (k < 3) return f;
    const head = f.pts?.head ?? [0, -6];
    return withPieces(f, [putTurned(FACE, [head[0], head[1] - (k === 3 ? 1 : 2)], 7, 7, k === 3 ? -30 : 0)]);
  });
}

defineTypeArt<CymState>({
  id: 'cymbalist',
  style: cymbalistStyle,
  dress,
  look,
  strips: {
    idle: { poses: P.seq(STAND_C, P.BREATH) as CPose[], opts: { ticksPerFrame: 24 } },
    walk: { poses: WALK_C, opts: { ticksPerFrame: 6 } },
    run: { poses: RUN_C, opts: { ticksPerFrame: 4 } },
    alert: { poses: ALERT_C, opts: { durations: [10, 12], loop: false } },
    crouch: { poses: [{ ...P.CROUCH, ...CARRY, armN: { to: [7, 6], hand: 'grip' }, armF: { to: [-3, 6], hand: 'grip' }, i: REST }], opts: { ticksPerFrame: 30 } },
    raise: { poses: RAISE_C, opts: { ticksPerFrame: 4 } },
    crash: { poses: CRASH_C, opts: { durations: [3, 6, 10], loop: false } },
    ringing: { poses: RINGING_C, opts: { ticksPerFrame: 7 } },
    shoot: { poses: CRASH_C.slice(1), opts: { durations: [6, 10], loop: false } },
    'crouch-shoot': { poses: CRASH_C.slice(1).map((p) => ({ ...p, ...P.CROUCH, crouch: undefined })), opts: { durations: [6, 10], loop: false } },
    throw: { poses: THROW_C, opts: { durations: [8, 8, 4, 6, 8], loop: false } },
    panic: { poses: PANIC_C, opts: { ticksPerFrame: 5 } },
    gag: { poses: TUNE_C, opts: { durations: [24, 10, 16, 20, 12, 12] } },
    'gag-tune': { poses: TUNE_C, opts: { durations: [24, 10, 16, 20, 12, 12] } },
    'gag-yawn': { poses: YAWN_C, opts: { durations: [30, 14, 30, 12, 30] } },
    die: { gen: dieFrames, opts: { durations: [6, 10, 12, 6, 8, 30], loop: false } },
    'die-knife': { poses: KNIFE_C, opts: { durations: [8, 6, 6, 6, 30], loop: false } },
    'die-blast': { gen: (style) => blastFrames(style, { weapon: 'none', hat: false }), opts: { durations: [5, 5, 5, 5, 30], loop: false } },
    'die-burn': { gen: (style) => burnStrip(style, { weapon: 'none' }), opts: { durations: burnDurations(), loop: false } },
    cymbal: { gen: () => cymbalSpin(), opts: { ticksPerFrame: 4 } },
  },
});

/** The loose cymbal: 4 turning frames (face, narrow, edge, narrow), feet anchor. */
function cymbalSpin(): Frame[] {
  const narrow = FACE.resized(7, FACE.h);
  const edge = EDGE.rotated(Math.PI / 2);
  return [FACE, narrow, edge, narrow].map((buf) => ({ buf, ox: buf.w >> 1, oy: buf.h }));
}

// ---------------------------------------------------------------------------------------------
// Projectiles (GDD §15.6: `proj/<id>`)
// ---------------------------------------------------------------------------------------------

/**
 * `proj/shockwave`: a 12×10 ground wave — a white crest curling forward over a gold swell with
 * dust at its foot (3 frames; centre anchor, the wave's foot on the ground line).
 */
function shockwaveFrames(): Frame[] {
  return [0, 1, 2].map((k) => {
    const b = new PixelBuffer(12, 10);
    // The swell: a hump rising to the front (right), its height breathing per frame.
    const top = 1 + (k === 1 ? 1 : 0);
    for (let x = 0; x < 12; x++) {
      const h = Math.round((10 - top) * Math.sin(((x + 1) / 13) * Math.PI * 0.9));
      for (let y = 10 - h; y < 10; y++) b.set(x, y, y < 10 - h + 2 ? PAL.snow[3] : y > 7 ? PAL.gold[1] : PAL.gold[2]);
    }
    // Speed lines behind and a curl of foam at the crest.
    b.hline(0, 2 + k, 8, PAL.gold[3]);
    b.set(9 - (k % 2), top + 1, PAL.snow[3]);
    b.set(10, top + 2, PAL.snow[2]);
    const out = b.padded(1).outline(INK);
    return { buf: out, ox: out.w >> 1, oy: out.h >> 1 };
  });
}

/** `proj/cymbal-disc`: the spinning frisbee seen almost edge-on (4 frames; centre anchor). */
function discFrames(): Frame[] {
  return [0, 1, 2, 3].map((k) => {
    const b = new PixelBuffer(14, 5);
    b.ellipse(0, 0, 14, 5, PAL.gold[2]);
    b.hline(2, 11, 1, PAL.gold[3]);
    b.hline(2, 11, 3, PAL.gold[1]);
    b.rect(5, 1, 4, 2, PAL.gold[3]);
    // A glint that runs round the rim (it spins).
    b.set([2, 6, 11, 7][k], [1, 0, 2, 4][k], PAL.snow[3]);
    const out = b.padded(1).outline(INK);
    return { buf: out, ox: out.w >> 1, oy: out.h >> 1 };
  });
}

defineSprite('proj/shockwave', shockwaveFrames, { ticksPerFrame: 3 });
defineSprite('proj/cymbal-disc', discFrames, { ticksPerFrame: 2 });
