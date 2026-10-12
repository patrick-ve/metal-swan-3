/**
 * `enemy/baton-major[-<outfit>]/…` — the Drum Major, officer (GDD §9.1): 46 px with a 14 px
 * plumed shako (white with a red plume), a gold tunic with a white sash, epaulettes, a huge
 * waxed moustache, white gloves and a 12 px white baton with a gold ball.
 *
 * Strips: the §6.1 contract (idle, gag = gag-twirl, alert, walk, run, crouch, shoot /
 * crouch-shoot = the throw with a `muzzle`, throw (5f, `hand`; the game starts it on frame 2, the
 * release), panic = hugs his baton on tiptoe, the shako over his eyes, die = falls back flat
 * (the game drops the hat and lays the baton on his chest), die-blast, die-burn, die-knife) +
 * march (4f: marching in place, played in step), whistle (2f: IN STEP!), twirl (4f: the T 30
 * baton twirl overhead), wait (2f: arm out for the returning baton), catch (2f), fumble (4f: the
 * baton bonks his head, CLONK), dizzy (4f), gag-twirl (6f: twirls, drops it, checks that nobody
 * saw), the props `hat` (the tall shako) and `baton-prop` (4 turning frames; frame 0 lies flat)
 * and the shared extras (infantry/art.ts).
 * Projectile (one for every outfit): `proj/baton` (8 spinning frames).
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { blastFrames } from '../../../art/human-sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import type { ArmPose, HumanStyle, Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import type { RampLike } from '../../../art/paint';
import { burnDurations, burnStrip, hatFrames, outfitStyle, type Hold, type Outfit, type SoldierLook } from '../art';
import { burstArt, defineTypeArt, L, put, putTurned, rotOff, shakoArt, TIPTOE, whistleArt, wristsOf, type IPose } from './kit.art';

export const BATON_MAJOR_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairC',
  hairStyle: 'short',
  headgear: 'none',
  gear: 'snow',
  accent: 'red',
  top: 'gold',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'snow',
  belt: 'red',
  build: 'normal',
  accessories: ['epaulettes', 'cross-belt'],
  face: ['bushy-brows', 'walrus'],
};

/** His shako colour per outfit (white on parade and on deck). */
const HAT_RAMP: Readonly<Record<Outfit, RampLike>> = { parade: 'snow', deck: 'snow', desert: 'sand', snow: 'brown', night: 'black' };

/** Instrument state of a frame. */
interface BatonState {
  /** Baton in the near hand at this angle (deg, 0 = forward, clockwise); null = empty hand. */
  baton?: number | null;
  /** Shako: on (default), off, low over the eyes. */
  hat?: 'on' | 'off' | 'low';
  /** Whistle in his mouth. */
  whistle?: boolean;
  /** The baton lies on top of his head (the fumble's bonk), with a burst. */
  bonk?: boolean;
  /** A motion blur arc around the twirling hand. */
  blur?: boolean;
}

type BPose = IPose<BatonState>;

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

const DEG = Math.PI / 180;
/** Baton grip: 3 px from the butt; the shaft runs 12 px to the gold ball. */
const BATON_LEN = 12;

/** The baton at `deg` (white shaft, gold ferrule and a 3×3 gold ball), grip at (ox, oy). */
function batonBuf(deg: number): { buf: PixelBuffer; ox: number; oy: number } {
  const r = BATON_LEN + 3;
  const b = new PixelBuffer(r * 2 + 1, r * 2 + 1);
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  // From 3 px behind the grip to the ball.
  const x0 = Math.round(r - c * 3);
  const y0 = Math.round(r - s * 3);
  const x1 = Math.round(r + c * (BATON_LEN - 3));
  const y1 = Math.round(r + s * (BATON_LEN - 3));
  b.line(x0, y0, x1, y1, PAL.snow[3]);
  b.set(x0, y0, PAL.gold[2]);
  b.rect(x1 - 1, y1 - 1, 3, 3, PAL.gold[2]);
  b.set(x1 - 1, y1 - 1, PAL.gold[3]);
  b.set(x1 + 1, y1 + 1, PAL.gold[1]);
  return { buf: b.outline(INK), ox: r, oy: r };
}

const batons = new Map<number, { buf: PixelBuffer; ox: number; oy: number }>();
function baton(deg: number): { buf: PixelBuffer; ox: number; oy: number } {
  const k = Math.round(deg);
  let b = batons.get(k);
  if (!b) {
    b = batonBuf(k);
    batons.set(k, b);
  }
  return b;
}

const shakos = new Map<string, PixelBuffer>();
/** The tall plumed shako (14 px with the plume), per hat colour. */
function shakoFor(outfit: Outfit): PixelBuffer {
  let s = shakos.get(outfit);
  if (!s) {
    s = shakoArt({ w: 8, h: 9, ramp: HAT_RAMP[outfit], plume: 'red', plumeH: 5, badge: true, peak: true });
    shakos.set(outfit, s);
  }
  return s;
}

/** The waxed, upturned tips added to the rig's walrus moustache (unoutlined face detail). */
function moustacheTips(): PixelBuffer {
  const b = new PixelBuffer(10, 3);
  for (const [x, y, c] of [[0, 0, 2], [1, 1, 1], [1, 2, 1], [9, 0, 2], [8, 1, 1], [8, 2, 1]] as const) b.set(x, y, PAL.hairC[c]);
  return b;
}
const MOUSTACHE = moustacheTips();
/** Where the tips sit relative to the head centre. */
const TIP_AT = [4, 3] as const;
const WHISTLE = whistleArt();
const BONK = burstArt(4);

/** A white swish arc (the twirl blur) of radius 7 round the hand. */
function blurArt(): PixelBuffer {
  const b = new PixelBuffer(17, 17);
  for (let a = 200; a < 340; a += 6) b.set(Math.round(8 + Math.cos(a * DEG) * 7), Math.round(8 + Math.sin(a * DEG) * 7), PAL.snow[2]);
  return b;
}
const BLUR = blurArt();

// ---------------------------------------------------------------------------------------------
// Dressing a frame
// ---------------------------------------------------------------------------------------------

function dress(f: Frame, p: BPose, _style: HumanStyle, outfit: Outfit, strip: string): Frame {
  const s = p.i ?? {};
  const rot = p.rot ?? 0;
  const pieces: Piece[] = [];
  const pts: Record<string, [number, number]> = {};
  const head = f.pts?.head ?? [2, -30];
  const tilt = rot + (p.head?.tilt ?? 0) * 0.6;
  // The huge waxed moustache under the nose (turns with the head).
  if (Math.abs(rot) < 30) {
    const mo = rotOff(TIP_AT[0], TIP_AT[1], tilt);
    pieces.push(putTurned(MOUSTACHE, [head[0] + mo[0], head[1] + mo[1]], 4, 1, tilt));
  }
  if (s.whistle) pieces.push(put(WHISTLE, [head[0] + 6, head[1] + 3], 1, 2));
  const hatState = s.hat ?? (strip === 'die' || strip === 'die-knife' ? 'off' : 'on');
  if (hatState !== 'off') {
    const hat = shakoFor(outfit);
    const o = rotOff(-1, hatState === 'low' ? 1 : -4, rot);
    pieces.push(putTurned(hat, [head[0] + o[0], head[1] + o[1]], (hat.w >> 1) - 1, hat.h - 2, tilt));
  }
  if (rot === 0 && s.baton !== undefined && s.baton !== null) {
    const w = wristsOf(f, p);
    const b = baton(s.baton);
    pieces.push(put(b.buf, w.near, b.ox, b.oy));
    pts.muzzle = [Math.round(w.near[0] + Math.cos(s.baton * DEG) * 9), Math.round(w.near[1] + Math.sin(s.baton * DEG) * 9)];
    if (s.blur) pieces.push(put(BLUR, w.near, 8, 8));
  }
  if (s.bonk) {
    const b = baton(-10);
    pieces.push(put(b.buf, [head[0] - 2, head[1] - 13], b.ox, b.oy));
    pieces.push(put(BONK, [head[0] + 3, head[1] - 16], 4, 4));
  }
  return withPieces(f, pieces, pts);
}

// ---------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------

/** Baton held upright at the chest (the officer's carry); the far hand on the hip. */
const N_CARRY: ArmPose = { to: [7, 7], hand: 'grip' };
const F_HIP: ArmPose = { sh: -20, el: 70, hand: 'fist' };
const CARRY: Pose = { weapon: 'none', armN: N_CARRY, armF: F_HIP };
const UP = -80;

const STAND_B: BPose = { ...P.STAND, ...CARRY, lean: -3, i: { baton: UP } };

/** Walking: a proud strut, the baton swinging like a pendulum. */
const WALK_B: BPose[] = P.WALK.map((p, k) => ({ ...p, lean: -3, weapon: 'none', armN: { to: [6 + [0, 1, 2, 1, 0, -1, -2, -1][k], 4], hand: 'grip' }, armF: F_HIP, i: { baton: UP + [0, 10, 20, 10, 0, -10, -20, -10][k] } }));
const RUN_B: BPose[] = P.RUN.map((p) => ({ ...p, lean: 6, weapon: 'none', armN: { to: [7, 2], hand: 'grip' }, armF: { sh: -40, el: 80, hand: 'fist' }, i: { baton: -40 } }));

/** Marching in place: knees high, the baton pumping up and down on the beat. */
const MARCH_B: BPose[] = [
  { legN: L(70, 100), legF: L(-4, 6), lean: -4, weapon: 'none', armN: { to: [7, -2], hand: 'grip' }, armF: F_HIP, i: { baton: -70 } },
  { ...P.STAND, legN: L(10, 6), legF: L(-6, 6), lean: -3, bob: 1, weapon: 'none', armN: N_CARRY, armF: F_HIP, i: { baton: UP } },
  { legN: L(-4, 6), legF: L(70, 100), lean: -4, weapon: 'none', armN: { to: [7, -2], hand: 'grip' }, armF: F_HIP, i: { baton: -70 } },
  { ...P.STAND, legN: L(10, 6), legF: L(-6, 6), lean: -3, bob: 1, weapon: 'none', armN: N_CARRY, armF: F_HIP, i: { baton: UP } },
];

/** IN STEP!: the whistle in his mouth, the baton pointing forward at his troops. */
const WHISTLE_B: BPose[] = [
  { ...P.STAND, lean: -6, weapon: 'none', armN: { to: [10, -4], hand: 'grip' }, armF: F_HIP, expr: 'shout', i: { baton: -20, whistle: true } },
  { ...P.STAND, lean: -8, hunch: 1, weapon: 'none', armN: { to: [10, -6], hand: 'grip' }, armF: F_HIP, expr: 'shout', i: { baton: -40, whistle: true } },
];

/** The twirl (T 30): the baton spun overhead, a white swish round the hand. */
const TWIRL_B: BPose[] = [0, 90, 180, 270].map((deg, k) => ({
  ...P.STAND,
  lean: -4,
  weapon: 'none',
  armN: { to: [4, -11], hand: 'grip' },
  armF: F_HIP,
  head: { tilt: -6 },
  expr: k % 2 ? 'happy' : 'shout',
  i: { baton: deg, blur: true },
}));

/** Throw: wind back, cocked, release (frame 2, the game starts here), follow-through, recover. */
const THROW_B: BPose[] = [
  { ...P.STAND, lean: -6, weapon: 'none', armN: { to: [-6, -6], hand: 'grip' }, armF: F_HIP, expr: 'shout', i: { baton: -150 } },
  { ...P.STAND, legN: L(28, 20), lean: -10, weapon: 'none', armN: { to: [-8, -9], hand: 'grip' }, armF: F_HIP, expr: 'shout', i: { baton: -170 } },
  { ...P.STAND, legN: L(30, 18), legF: L(-24, 12), lean: 8, weapon: 'none', armN: { to: [11, -4], hand: 'open' }, armF: F_HIP, expr: 'shout', i: { baton: null } },
  { ...P.STAND, lean: 6, weapon: 'none', armN: { to: [11, 0], hand: 'open' }, armF: F_HIP, i: { baton: null } },
  { ...P.STAND, lean: 0, weapon: 'none', armN: { to: [10, -2], hand: 'open' }, armF: F_HIP, i: { baton: null } },
];

/** Waiting for the baton: the hand out, palm up, chin up. */
const WAIT_B: BPose[] = [
  { ...P.STAND, lean: -4, weapon: 'none', armN: { to: [10, -3], hand: 'open' }, armF: F_HIP, head: { tilt: -4 }, i: { baton: null } },
  { ...P.STAND, lean: -4, hunch: 1, weapon: 'none', armN: { to: [10, -4], hand: 'open' }, armF: F_HIP, head: { tilt: -6 }, i: { baton: null } },
];

/** The catch: snapped into the hand, then back to the proud carry. */
const CATCH_B: BPose[] = [
  { ...P.STAND, lean: -2, weapon: 'none', armN: { to: [10, -4], hand: 'grip' }, armF: F_HIP, expr: 'happy', i: { baton: -60 } },
  { ...STAND_B, expr: 'happy' },
];

/** The fumble: CLONK on his own head, knees buckle, dazed. */
const FUMBLE_B: BPose[] = [
  { ...P.STAND, lean: -6, weapon: 'none', armN: { to: [10, -6], hand: 'open' }, armF: F_HIP, head: { tilt: -10 }, expr: 'panic', i: { baton: null, bonk: true } },
  { legN: L(30, 40), legF: L(-6, 34), hunch: 1, weapon: 'none', armN: { to: [4, -10], hand: 'open' }, armF: { to: [0, -10], hand: 'open' }, head: { tilt: 8, dy: 1 }, expr: 'hurt', i: { baton: null, hat: 'low' } },
  { legN: L(24, 30), legF: L(-10, 30), lean: -4, weapon: 'none', armN: { sh: 20, el: 20, hand: 'open' }, armF: { sh: 10, el: 20, hand: 'open' }, head: { tilt: -8 }, expr: 'dazed', i: { baton: null, hat: 'low' } },
  { legN: L(18, 24), legF: L(-14, 24), lean: 2, weapon: 'none', armN: { sh: 14, el: 20, hand: 'open' }, armF: { sh: 4, el: 20, hand: 'open' }, head: { tilt: 8 }, expr: 'dazed', i: { baton: null, hat: 'low' } },
];
const DIZZY_B: BPose[] = [FUMBLE_B[2], FUMBLE_B[3], { ...FUMBLE_B[2], expr: 'blink' }, FUMBLE_B[3]];

/** Gag `twirl`: twirls with flair, drops it, looks round (did anyone see?), picks it up. */
const GAG_B: BPose[] = [
  { ...STAND_B, expr: 'happy' },
  { ...TWIRL_B[0], expr: 'happy' },
  { ...TWIRL_B[2], expr: 'happy' },
  { ...P.STAND, weapon: 'none', armN: { to: [9, -2], hand: 'open' }, armF: F_HIP, expr: 'panic', i: { baton: null } },
  { ...P.STAND, weapon: 'none', armN: { to: [7, 4], hand: 'open' }, armF: F_HIP, head: { tilt: 12 }, expr: 'normal', i: { baton: null } },
  { ...P.CROUCH, crouch: 0.6, weapon: 'none', armN: { to: [8, 10], hand: 'grip' }, armF: F_HIP, head: { tilt: -10 }, expr: 'blink', i: { baton: 10 } },
];

const ALERT_B: BPose[] = [
  { ...P.STAND, legN: L(30, 40), legF: L(-10, 40), grounded: false, dy: -3, weapon: 'none', armN: { to: [6, -9], hand: 'grip' }, armF: { to: [-3, -9], hand: 'open' }, expr: 'panic', i: { baton: -100 } },
  { ...P.STAND, lean: -6, weapon: 'none', armN: { to: [10, -4], hand: 'grip' }, armF: F_HIP, expr: 'shout', i: { baton: -10 } },
];

/** The quiet panic: the baton hugged to his chest, shako over his eyes, tiptoe. */
const PANIC_B: BPose[] = TIPTOE.map((p, k) => ({
  ...p,
  lean: 6,
  weapon: 'none',
  armN: { to: [7, 1], hand: 'grip' },
  armF: { to: [6, 0], hand: 'open' },
  expr: k % 2 === 0 ? 'panic' : 'hurt',
  i: { baton: -100, hat: 'low' },
}));

const EMPTY: BatonState = { baton: null };
const DIE_B: BPose[] = P.DIE.map((p) => ({ ...p, weapon: 'none', i: EMPTY }));
const KNIFE_B: BPose[] = P.DIE_KNIFE.map((p) => ({ ...p, weapon: 'none', i: EMPTY }));

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

export function batonMajorStyle(outfit: Outfit): HumanStyle {
  return outfitStyle(BATON_MAJOR_STYLE, outfit, { keepHat: true });
}

const HOLD_STATE: Readonly<Record<Hold, BatonState>> = {
  carry: { baton: UP },
  oneHand: { baton: null },
  noHands: { baton: null },
};

function look(style: HumanStyle, outfit: Outfit): SoldierLook {
  return {
    style,
    carry: CARRY,
    oneHand: { weapon: 'none', armF: F_HIP },
    noHands: { weapon: 'none' },
    // die-crush: the baton flies up as a prop (the game spawns it), so none in the frames.
    dress: (f, pose, hold, strip) => dress(f, { ...pose, i: strip === 'die-crush' ? HOLD_STATE.noHands : HOLD_STATE[hold] }, style, outfit, strip),
    dropped: baton(0).buf,
    hat: shakoFor(outfit),
  };
}

const burn = (style: HumanStyle): Frame[] => burnStrip(style, { weapon: 'none' });

defineTypeArt<BatonState>({
  id: 'baton-major',
  style: batonMajorStyle,
  dress,
  look,
  // `hat` is registered below (the tall shako hanging upright first).
  skipExtras: ['hat'],
  strips: {
    idle: { poses: P.seq(STAND_B, P.BREATH) as BPose[], opts: { ticksPerFrame: 24 } },
    walk: { poses: WALK_B, opts: { ticksPerFrame: 7 } },
    run: { poses: RUN_B, opts: { ticksPerFrame: 4 } },
    march: { poses: MARCH_B, opts: { ticksPerFrame: 15 } },
    alert: { poses: ALERT_B, opts: { durations: [10, 12], loop: false } },
    crouch: { poses: [{ ...P.CROUCH, ...CARRY, i: { baton: UP } }], opts: { ticksPerFrame: 30 } },
    whistle: { poses: WHISTLE_B, opts: { ticksPerFrame: 5 } },
    twirl: { poses: TWIRL_B, opts: { ticksPerFrame: 3 } },
    throw: { poses: THROW_B, opts: { durations: [8, 8, 5, 6, 8], loop: false } },
    shoot: { poses: [THROW_B[1], { ...THROW_B[2], i: { baton: -10 } }], opts: { durations: [6, 10], loop: false } },
    'crouch-shoot': { poses: [THROW_B[1], { ...THROW_B[2], i: { baton: -10 } }].map((p) => ({ ...p, ...P.CROUCH })), opts: { durations: [6, 10], loop: false } },
    wait: { poses: WAIT_B, opts: { ticksPerFrame: 12 } },
    catch: { poses: CATCH_B, opts: { durations: [8, 20], loop: false } },
    fumble: { poses: FUMBLE_B, opts: { durations: [10, 10, 12, 12], loop: false } },
    dizzy: { poses: DIZZY_B, opts: { ticksPerFrame: 8 } },
    panic: { poses: PANIC_B, opts: { ticksPerFrame: 5 } },
    gag: { poses: GAG_B, opts: { durations: [24, 6, 6, 14, 30, 16] } },
    'gag-twirl': { poses: GAG_B, opts: { durations: [24, 6, 6, 14, 30, 16] } },
    die: { poses: DIE_B, opts: { durations: [5, 5, 6, 6, 8, 30], loop: false } },
    'die-knife': { poses: KNIFE_B, opts: { durations: [8, 6, 6, 6, 30], loop: false } },
    'die-blast': { gen: (style) => blastFrames(style, { weapon: 'none' }), opts: { durations: [5, 5, 5, 5, 30], loop: false } },
    'die-burn': { gen: burn, opts: { durations: burnDurations(), loop: false } },
    // The tall hat: upright first (it hangs in the air for 20 ticks), then tumbling frames.
    hat: { gen: (_s, outfit) => hatFrames(shakoFor(outfit)), opts: { ticksPerFrame: 5 } },
    // The baton prop: frame 0 lies flat (the lily on his chest), then turning frames.
    'baton-prop': { gen: () => batonSpin(4, true), opts: { ticksPerFrame: 3 } },
  },
});

/** Baton frames turning in `n` steps (frame 0 lies flat); `feet`: feet anchor, else centre. */
function batonSpin(n: number, feet: boolean): Frame[] {
  const out: Frame[] = [];
  for (let k = 0; k < n; k++) {
    const b = baton((k * 180) / n);
    const t = b.buf.trimBounds();
    const buf = t ? b.buf.crop(t.x, t.y, t.w, t.h) : b.buf;
    out.push({ buf, ox: buf.w >> 1, oy: feet ? buf.h : buf.h >> 1 });
  }
  return out;
}

/** `proj/baton`: the boomerang baton spinning (8 frames, centre anchor). */
defineSprite('proj/baton', () => batonSpin(8, false), { ticksPerFrame: 2 });
