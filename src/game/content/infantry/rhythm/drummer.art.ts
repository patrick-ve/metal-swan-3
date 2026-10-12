/**
 * `enemy/drummer[-<outfit>]/…` — the Drum Guard (GDD §9.1): a tall black fur busby with a
 * crimson-and-white side plume, a red tunic, white gloves and a 24 px bass drum strapped in front
 * (white skin with the Legion crest — a crimson shield with a white note — gold hoops, the
 * crimson shell showing behind), two felt mallets.
 *
 * Strips: the §6.1 contract (idle, gag = gag-nap, alert, walk 8 with a stroke on frames 0 and 4 —
 * the beat, crouch, shoot / crouch-shoot / throw = the drumroll, panic = hugs his drum on tiptoe
 * with the busby over his eyes, die = sits down dazed while the drum rolls away, die-blast,
 * die-burn, die-knife) + drumroll (4f), charge (4f), dizzy (4f), broken (2f: his head through
 * the torn drum skin), run-broken (8f), gag-nap (6f, a snore bubble), gag-air-solo (6f), the
 * props drum (4 rolling frames) and drum-torn, and the shared extras (infantry/art.ts).
 * Point `drum` = the drum centre (the game draws the cracks there).
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { blastFrames } from '../../../art/human-sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type ArmPose, type HumanStyle, type Pose } from '../../../art/humanoid';
import { FLAT, R, shadeLayer, type RampLike } from '../../../art/paint';
import * as P from '../../../art/poses';
import { burnDurations, burnStrip, outfitStyle, OUTFIT_HAT, type Hold, type Outfit, type SoldierLook } from '../art';
import {
  armPiece,
  bubbleArt,
  burstArt,
  busbyArt,
  defineTypeArt,
  gripAt,
  L,
  mallet,
  put,
  putTurned,
  rotOff,
  SIT_DAZED,
  TIPTOE,
  wristsOf,
  type IPose,
  type V2,
} from './kit.art';

export const DRUMMER_STYLE: HumanStyle = {
  skin: 'skinB',
  hair: 'hairA',
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
  build: 'normal',
  accessories: ['epaulettes'],
  face: ['moustache'],
};

/** Drum centre relative to the pelvis (body space, facing right). */
const DRUM_AT: V2 = [8, 1];
/** Drum radius (24 px face + the outline = the 26 px of GDD §9.1). */
const DR = 12;

/** Instrument state of a frame. */
interface DrumState {
  /** Near / far mallet angle (deg, 0 = forward, 90 = down); null = no mallet. */
  near?: number | null;
  far?: number | null;
  /** The drum: strapped on (default), off (died, hugged away), torn around his head. */
  drum?: 'on' | 'off' | 'torn';
  /** Busby: on (default), off (popped), low (over his eyes), up (pushed up by the torn drum). */
  hat?: 'on' | 'off' | 'low' | 'up';
  /** Draw the near arm over the drum (default: when the hand is low). */
  arm?: boolean;
  /** Snore bubble radius (0 = none, -1 = the pop). */
  z?: number;
  /** A small burst on the drum face (the stroke of a beat). */
  hit?: boolean;
}

type DPose = IPose<DrumState>;

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

/** The Legion crest: a crimson shield with a gold border and a white note (9×9). */
function crest(): PixelBuffer {
  const rows = ['GGGGGGGGG', 'GrRRRRRRG', 'GrRRWWRRG', 'GrRRWRWRG', 'GrRRWRRRG', 'GrWWWRRRG', '.GrWWRRG.', '..GrRRG..', '...GGG...'];
  const k: Record<string, number> = { G: PAL.gold[2], r: PAL.red[3], R: PAL.red[2], W: PAL.snow[3] };
  const b = new PixelBuffer(9, 9);
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && b.set(x, y, k[ch])));
  return b;
}

/** The drum face: gold hoop with 8 lugs, white skin lit from the top-left, the crest. */
function drumFace(torn = false): PixelBuffer {
  const n = DR * 2 + 1;
  const c = DR;
  const b = new PixelBuffer(n, n);
  b.circle(c, c, DR, PAL.gold[1]);
  b.circle(c, c, DR - 1, PAL.gold[2]);
  // Lit and shaded halves of the hoop.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > DR + 0.5 || d < DR - 2.5) continue;
      const s = x - c + (y - c);
      if (s < -8) b.set(x, y, PAL.gold[3]);
      else if (s > 8) b.set(x, y, PAL.gold[1]);
    }
  }
  b.circle(c, c, DR - 3, PAL.snow[2]);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > DR - 2.5) continue;
      const s = x - c + (y - c);
      if (s < -6 && d > DR - 5) b.set(x, y, PAL.snow[3]);
      else if (s > 7 && d > DR - 5) b.set(x, y, PAL.snow[1]);
    }
  }
  // Lugs (tension rods) on the hoop.
  for (let k = 0; k < 8; k++) {
    const a = (k * 45 + 22.5) * (Math.PI / 180);
    b.set(Math.round(c + Math.cos(a) * (DR - 1)), Math.round(c + Math.sin(a) * (DR - 1)), PAL.gold[0]);
  }
  if (torn) {
    // A ragged hole in the middle (his head pokes through) and loose flaps of skin.
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - c, y - c);
        const jag = ((x * 7 + y * 3) % 5) * 0.5;
        if (d < 5.5 + jag) b.set(x, y, 0);
      }
    }
  } else b.blit(crest(), c - 4, c - 4);
  return b;
}

/** The drum strapped on: the crimson shell peeks out behind the face (to the left). */
function drumArt(torn = false): { buf: PixelBuffer; cx: number; cy: number } {
  const face = drumFace(torn);
  const n = face.w;
  const b = new PixelBuffer(n + 3, n);
  b.circle(DR, DR, DR, PAL.red[1]);
  b.circle(DR, DR, DR - 1, PAL.red[2]);
  for (let y = 2; y < n - 2; y += 4) b.set(1, y, PAL.gold[2]);
  b.blit(face, 3, 0);
  const out = b.padded(1).outline(INK);
  return { buf: out, cx: DR + 3 + 1, cy: DR + 1 };
}

const DRUM = drumArt();
const DRUM_TORN = drumArt(true);

/** The drum on its own as a wheel (the death prop): 4 turning frames, bottom-centre anchor. */
function drumWheel(): Frame[] {
  const face = drumFace().padded(1).outline(INK);
  return [0, 1, 2, 3].map((q) => {
    const buf = face.rotated((q * Math.PI) / 2);
    return { buf, ox: buf.w >> 1, oy: buf.h };
  });
}

/** Two crossed mallets lying on the ground (dropped in `ears`). */
function droppedMallets(): PixelBuffer {
  const a = mallet(-12, 8);
  const b = mallet(-168, 8);
  const out = new PixelBuffer(a.buf.w + 6, a.buf.h);
  out.blit(b.buf, 6, 0);
  out.blit(a.buf, 0, 0);
  const t = out.trimBounds();
  return t ? out.crop(t.x, t.y, t.w, t.h) : out;
}

// ---------------------------------------------------------------------------------------------
// Dressing a frame
// ---------------------------------------------------------------------------------------------

const busbies = new Map<string, PixelBuffer>();
function busbyFor(ramp: RampLike): PixelBuffer {
  const key = typeof ramp === 'string' ? ramp : ramp.join(',');
  let b = busbies.get(key);
  if (!b) {
    b = busbyArt(ramp);
    busbies.set(key, b);
  }
  return b;
}
/** Busby pivot: the bottom centre of its fur (the gold chain sits on the brow). */
const BUSBY_PX = 9;
const BUSBY_PY = 16;

/** Pieces for the busby (on the head point, turned with a falling body). */
function hatPiece(f: Frame, pose: Pose, hat: PixelBuffer, state: DrumState['hat']): Piece | null {
  if (state === 'off') return null;
  const head = f.pts?.head ?? [2, -30];
  const rot = pose.rot ?? 0;
  const tilt = rot + (pose.head?.tilt ?? 0) * 0.5;
  const lift = state === 'low' ? 4 : state === 'up' ? -5 : 0;
  const o = rotOff(-1, -2 + lift, rot);
  return putTurned(hat, [head[0] + o[0], head[1] + o[1]], BUSBY_PX, BUSBY_PY, tilt);
}

/** Dress a drummer frame: far mallet, drum, near arm, near mallet, busby, bubbles. */
function dress(f: Frame, p: DPose, style: HumanStyle, outfit: Outfit, strip: string): Frame {
  const s = p.i ?? {};
  const rot = p.rot ?? 0;
  const hip = f.pts?.hip ?? [0, -15];
  const pieces: Piece[] = [];
  const pts: Record<string, [number, number]> = {};
  const drum = s.drum ?? 'on';
  const upright = rot === 0;
  const w = upright ? wristsOf(f, p) : null;
  if (w && s.far !== undefined && s.far !== null) pieces.push(gripAt(mallet(s.far), w.far));
  if (drum === 'on') {
    const o = rotOff(DRUM_AT[0], DRUM_AT[1], rot);
    // Never through the floor (crouches): the drum's bottom stays above the ground line.
    const cy = Math.min(hip[1] + o[1], -DR - 2);
    const at: V2 = [hip[0] + o[0], cy];
    pieces.push(put(DRUM.buf, at, DRUM.cx, DRUM.cy));
    pts.drum = [Math.round(at[0]), Math.round(at[1])];
    pts.muzzle = [Math.round(at[0] + DR + 2), Math.round(at[1])];
    if (s.hit) pieces.push(put(burstArt(4), [at[0] + 2, at[1] - 7], 4, 4));
  }
  if (drum === 'torn') {
    const head = f.pts?.head ?? [2, -30];
    pieces.push(put(DRUM_TORN.buf, [head[0], head[1] + 1], DRUM_TORN.cx, DRUM_TORN.cy));
  }
  if (w) {
    const low = w.near[1] > shouldersY(f, p) - 2;
    const showArm = s.arm ?? (drum !== 'off' && low);
    if (showArm) pieces.push(armPiece(style, f, p, 'near'));
    if (s.near !== undefined && s.near !== null) pieces.push(gripAt(mallet(s.near), w.near));
  }
  const hp = hatPiece(f, p, busbyFor(OUTFIT_HAT[outfit]), s.hat ?? (strip.startsWith('die') && strip !== 'die-crush' && strip !== 'die-shatter' && strip !== 'die-burn' ? 'off' : 'on'));
  if (hp) pieces.push(hp);
  if (s.z) {
    const head = f.pts?.head ?? [2, -30];
    const b = s.z < 0 ? burstArt(3) : bubbleArt(s.z, s.z >= 3);
    pieces.push(put(b, [head[0] + 7 + (s.z > 0 ? s.z : 0), head[1] - 4 - (s.z > 0 ? s.z : 0)], b.w >> 1, b.h >> 1));
  }
  return withPieces(f, pieces, pts);
}

function shouldersY(f: Frame, p: Pose): number {
  const hip = f.pts?.hip ?? [0, -15];
  return hip[1] - 7 + (p.hunch ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------

/** Arms over the drum: the near hand at the face's upper half, the far hand behind the drum. */
const N_REST: ArmPose = { to: [8, 3], hand: 'grip' };
const N_LOW: ArmPose = { to: [9, 5], hand: 'grip' };
const N_UP: ArmPose = { to: [6, -2], hand: 'grip' };
const N_HIGH: ArmPose = { to: [4, -6], hand: 'grip' };
const F_REST: ArmPose = { to: [8, 1], hand: 'grip' };
const F_UP: ArmPose = { to: [6, -3], hand: 'grip' };
const CARRY: Pose = { weapon: 'none', armN: N_REST, armF: F_REST };

const STAND_D: DPose = { ...P.STAND, ...CARRY, i: { near: 60, far: -70 } };

/** Stroke cycle over the 8 walk frames: down on 0 and 4 (the beat), rebound, up, up. */
const STROKE: ReadonlyArray<[ArmPose, number, boolean]> = [
  [N_LOW, 70, true],
  [N_REST, 20, false],
  [N_UP, -50, false],
  [N_HIGH, -90, false],
];

const WALK_D: DPose[] = P.WALK.map((p, k) => {
  const [arm, ang, hit] = STROKE[k % 4];
  return { ...p, weapon: 'none', armN: arm, armF: k % 4 < 2 ? F_UP : F_REST, i: { near: ang, far: k % 4 < 2 ? -80 : -50, hit } };
});

const RUN_D: DPose[] = P.RUN.map((p) => ({ ...p, lean: 8, weapon: 'none', armN: N_UP, armF: F_UP, i: { near: -60, far: -80 } }));

const BRACE = { legN: L(26, 14), legF: L(-26, 10) };
const DRUMROLL_D: DPose[] = [
  { ...BRACE, lean: 6, weapon: 'none', armN: N_LOW, armF: F_UP, expr: 'shout', i: { near: 70, far: -80, hit: true } },
  { ...BRACE, lean: 6, weapon: 'none', armN: N_UP, armF: F_REST, expr: 'shout', bob: 1, i: { near: -40, far: -40 } },
  { ...BRACE, lean: 6, weapon: 'none', armN: N_LOW, armF: F_UP, expr: 'shout', i: { near: 70, far: -80, hit: true } },
  { ...BRACE, lean: 6, weapon: 'none', armN: N_UP, armF: F_REST, expr: 'panic', bob: 1, i: { near: -40, far: -40 } },
];

const CHARGE_D: DPose[] = [0, 2, 4, 6].map((k) => ({ ...P.RUN[k], lean: 16, weapon: 'none', armN: N_HIGH, armF: F_UP, expr: 'shout', i: { near: -100, far: -110 } }));

const DIZZY_D: DPose[] = [
  { legN: L(14, 20), legF: L(-20, 16), lean: -6, head: { tilt: -10 }, weapon: 'none', armN: { sh: 20, el: 10, hand: 'grip' }, armF: F_REST, expr: 'dazed', i: { near: 100, far: null } },
  { legN: L(20, 14), legF: L(-14, 20), lean: 2, head: { tilt: 4 }, weapon: 'none', armN: { sh: 14, el: 14, hand: 'grip' }, armF: F_REST, expr: 'dazed', bob: 1, i: { near: 110, far: null } },
  { legN: L(24, 10), legF: L(-10, 24), lean: 6, head: { tilt: 10 }, weapon: 'none', armN: { sh: 20, el: 10, hand: 'grip' }, armF: F_REST, expr: 'dazed', i: { near: 100, far: null } },
  { legN: L(20, 14), legF: L(-14, 20), lean: 2, head: { tilt: 4 }, weapon: 'none', armN: { sh: 14, el: 14, hand: 'grip' }, armF: F_REST, expr: 'blink', bob: 1, i: { near: 110, far: null } },
];

const HOLD_RIM: ArmPose = { to: [9, -9], hand: 'grip' };
const HOLD_RIM_F: ArmPose = { to: [7, -10], hand: 'grip' };
const BROKEN_D: DPose[] = [
  { ...P.STAND, weapon: 'none', armN: HOLD_RIM, armF: HOLD_RIM_F, expr: 'panic', i: { drum: 'torn', hat: 'up', near: null, far: null, arm: true } },
  { ...P.STAND, weapon: 'none', armN: HOLD_RIM, armF: HOLD_RIM_F, expr: 'hurt', bob: 1, i: { drum: 'torn', hat: 'up', near: null, far: null, arm: true } },
];
const RUN_BROKEN_D: DPose[] = P.RUN.map((p, k) => ({ ...p, lean: 6, weapon: 'none', armN: HOLD_RIM, armF: HOLD_RIM_F, expr: k % 4 < 2 ? 'panic' : 'hurt', i: { drum: 'torn', hat: 'up', near: null, far: null, arm: true } }));

const HUG: ArmPose = { to: [11, 4], hand: 'open' };
const PANIC_D: DPose[] = TIPTOE.map((p, k) => ({ ...p, lean: 4, weapon: 'none', armN: HUG, armF: { to: [10, 3], hand: 'open' }, expr: k % 2 === 0 ? 'panic' : 'hurt', i: { hat: 'low', near: null, far: null, arm: true } }));

const ALERT_D: DPose[] = [
  { ...P.STAND, legN: L(30, 40), legF: L(-10, 40), grounded: false, dy: -3, weapon: 'none', armN: N_HIGH, armF: F_UP, expr: 'panic', i: { near: -120, far: -120 } },
  { ...P.STAND, ...CARRY, expr: 'shout', i: { near: 40, far: -70 } },
];

const NAP_BASE: Pose = { legN: L(10, 8), legF: L(-14, 6), lean: 12, head: { tilt: 18, dy: 1 }, weapon: 'none', armN: { to: [10, -1], hand: 'open' }, armF: { to: [9, -2], hand: 'open' }, expr: 'blink' };
const NAP_D: DPose[] = [1, 2, 3, 4, -1, 0].map((z, k) => ({ ...NAP_BASE, bob: k % 2, i: { near: null, far: null, z, arm: true } }));

const AIR_D: DPose[] = [
  { ...P.STAND, weapon: 'none', armN: { to: [6, -10], hand: 'grip' }, armF: { to: [9, -6], hand: 'grip' }, head: { tilt: -10 }, expr: 'blink', i: { near: -30, far: -140, drum: 'on' } },
  { ...P.STAND, weapon: 'none', armN: { to: [10, -5], hand: 'grip' }, armF: { to: [5, -11], hand: 'grip' }, head: { tilt: 8 }, expr: 'happy', bob: 1, i: { near: 40, far: -60 } },
  { ...P.STAND, weapon: 'none', armN: { to: [3, -11], hand: 'grip' }, armF: { to: [10, -4], hand: 'grip' }, head: { tilt: -10 }, expr: 'blink', i: { near: -150, far: -20 } },
  { ...P.STAND, weapon: 'none', armN: { to: [9, 2], hand: 'grip' }, armF: { to: [9, -8], hand: 'grip' }, head: { tilt: 10 }, expr: 'shout', bob: 1, i: { near: 80, far: -100 } },
  { ...P.STAND, weapon: 'none', armN: { to: [5, -10], hand: 'grip' }, armF: { to: [4, -11], hand: 'grip' }, head: { tilt: -6 }, expr: 'blink', i: { near: -110, far: -120 } },
  { ...P.STAND, weapon: 'none', armN: { to: [10, -3], hand: 'grip' }, armF: { to: [10, -4], hand: 'grip' }, head: { tilt: 6 }, expr: 'happy', i: { near: 20, far: 10 } },
];

const NO_DRUM: DrumState = { drum: 'off', near: null, far: null, hat: 'off' };
const DIE_D: DPose[] = SIT_DAZED.map((p) => ({ ...p, weapon: 'none', i: NO_DRUM }));
const KNIFE_D: DPose[] = P.DIE_KNIFE.map((p) => ({ ...p, weapon: 'none', i: NO_DRUM }));

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

export function drummerStyle(outfit: Outfit): HumanStyle {
  return outfitStyle(DRUMMER_STYLE, outfit, { keepHat: true });
}

const HOLD_STATE: Readonly<Record<Hold, DrumState>> = {
  carry: { near: 60, far: -70 },
  oneHand: { near: null, far: -70 },
  noHands: { near: null, far: null },
};

function look(style: HumanStyle, outfit: Outfit): SoldierLook {
  return {
    style,
    carry: CARRY,
    oneHand: { weapon: 'none', armF: F_REST },
    noHands: { weapon: 'none' },
    dress: (f, pose, hold, strip) => {
      const st: DrumState = { ...HOLD_STATE[hold], ...(strip === 'die-crush' ? { drum: 'off' } : {}) };
      return dress(f, { ...pose, i: st }, style, outfit, strip);
    },
    dropped: droppedMallets(),
    hat: busbyFor(OUTFIT_HAT[outfit]),
  };
}

/** The drummer's burning figure keeps his busby (the drum rolled away). */
function burn(style: HumanStyle, outfit: Outfit): Frame[] {
  return burnStrip(style, { weapon: 'none' }, 6, 9, (p) => dress(renderHuman(style, p, 'full'), { ...p, i: { drum: 'off', near: null, far: null, hat: 'on' } }, style, outfit, 'die-burn'));
}

defineTypeArt<DrumState>({
  id: 'drummer',
  style: drummerStyle,
  dress,
  look,
  strips: {
    idle: { poses: P.seq(STAND_D, P.BREATH) as DPose[], opts: { ticksPerFrame: 24 } },
    walk: { poses: WALK_D, opts: { ticksPerFrame: 8 } },
    run: { poses: RUN_D, opts: { ticksPerFrame: 4 } },
    alert: { poses: ALERT_D, opts: { durations: [10, 12], loop: false } },
    crouch: { poses: [{ ...P.CROUCH, ...CARRY, i: { near: 60, far: -70 } }], opts: { ticksPerFrame: 30 } },
    drumroll: { poses: DRUMROLL_D, opts: { ticksPerFrame: 3 } },
    shoot: { poses: DRUMROLL_D, opts: { ticksPerFrame: 3, loop: false } },
    'crouch-shoot': { poses: DRUMROLL_D, opts: { ticksPerFrame: 3, loop: false } },
    throw: { poses: DRUMROLL_D, opts: { ticksPerFrame: 4, loop: false } },
    charge: { poses: CHARGE_D, opts: { ticksPerFrame: 3 } },
    dizzy: { poses: DIZZY_D, opts: { ticksPerFrame: 8 } },
    broken: { poses: BROKEN_D, opts: { ticksPerFrame: 10 } },
    'run-broken': { poses: RUN_BROKEN_D, opts: { ticksPerFrame: 4 } },
    panic: { poses: PANIC_D, opts: { ticksPerFrame: 5 } },
    gag: { poses: NAP_D, opts: { durations: [20, 16, 16, 16, 6, 24] } },
    'gag-nap': { poses: NAP_D, opts: { durations: [20, 16, 16, 16, 6, 24] } },
    'gag-air-solo': { poses: AIR_D, opts: { ticksPerFrame: 7 } },
    die: { poses: DIE_D, opts: { durations: [6, 8, 10, 14, 14, 30], loop: false } },
    'die-knife': { poses: KNIFE_D, opts: { durations: [8, 6, 6, 6, 30], loop: false } },
    'die-blast': { gen: (style) => blastFrames(style, { weapon: 'none' }), opts: { durations: [5, 5, 5, 5, 30], loop: false } },
    'die-burn': { gen: burn, opts: { durations: burnDurations(), loop: false } },
    drum: { gen: () => drumWheel(), opts: { ticksPerFrame: 5 } },
    'drum-torn': { gen: () => [{ buf: DRUM_TORN.buf, ox: DRUM_TORN.buf.w >> 1, oy: DRUM_TORN.buf.h }], opts: { ticksPerFrame: 30 } },
  },
});

/** Shading helper kept for the drum's strap tests (a FLAT strap in the tunic colour). */
export function strapArt(len: number, ramp: RampLike): PixelBuffer {
  const b = new PixelBuffer(2, len);
  b.rect(0, 0, 2, len, FLAT);
  shadeLayer(b, R(ramp), { base: 2 });
  return b;
}
