/**
 * Art of the stag party (docs/design/ams-extras.md §2): the partiers, the groom, the beer bike's
 * sober driver, the cork, the selfie flash and the groom's flying veil. 1× (PAL), 2× and 4×
 * (PAL_HD) from one density-generic recipe per strip (kit.art.ts; the people are the rig).
 *
 * Look: matching lime party T-shirts with a white star print, shorts and sunburn (blush), white
 * sneakers; a fizzy-wine bottle in the near hand. The groom: a pink tutu over his shorts, a veil
 * with a small tiara and an L-plate on the chest. The driver: a sober guide in a red polo and cap.
 *
 * Sets `enemy/<set>/…`: `stag-partier` (look 0), `stag-partier-1` … `-3`, `stag-groom`.
 * Strips (standing): idle (4), walk (8), turn (2), alert (1), tell (3: shakes the bottle, foam
 * round the cork), fire (3: aim, POP with a foam jet, recover), gag-toast (4: raise, clink, a swig),
 * gag-selfie (2), photo-pose (1), gloat (2: the group selfie, phone up), cower (2: the T-shirt over
 * the head), die (6: sits down hard, the bottle foams over), die-knife, die-blast, die-burn,
 * die-crush. Seated on a beer-bike stool (anchor = the floor under the stool, hip 18 px above it):
 * sit (4: pedalling), sit-tell (3), sit-fire (3), sit-gloat (2), sit-cower (2), die-stool (5: tips
 * off the stool backwards). Rare strips are deferred.
 * Extras: `enemy/stag-beer-bike/driver` (2: pedalling, hands on the bar), `…/driver-flee` (4),
 * `enemy/cork/fly` (4: tumbling), `enemy/stag-partier/flash` (3), `enemy/stag-groom/veil` (4).
 */
import { INK, stepShade } from '../../../engine/palette';
import { hdHome } from '../../../engine/palette-hd';
import type { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, getFrames, type SpriteOpts } from '../../../engine/sprites';
import { crushStripHi } from '../../art/hi-strips';
import { crumble, crumbleDense, scorch, sootify, withFlames, withFlamesDense, type Piece } from '../../art/human-fx';
import { withSwing } from '../../art/human-sprites';
import { renderHuman, type ArmPose, type HumanStyle, type LegPose, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { CRUSH_TIMING, crushStrip, turnSquash } from '../creatures/draw';
import { onBoxes } from '../locals/rider.hd';
import {
  addPieces,
  bottlePiece,
  corkFrames,
  flashFrames,
  lplateBuf,
  moveAnchor,
  partyFigure,
  phoneBuf,
  piece,
  printBuf,
  shirtBundleBuf,
  tiaraBuf,
  tutuBuf,
  tutuWaistBuf,
  veilBuf,
  veilFrames,
  type BottleState,
  type Dn,
  type PartyLook,
} from './kit.art';

/** The matching party T-shirt colour of the whole group. */
export const TEE = 'green';

const look = (style: Omit<HumanStyle, 'top' | 'topType' | 'pants'>, shorts: string): PartyLook => ({
  style: { ...style, top: TEE, topType: 'tee', pants: shorts },
  shorts,
  legs: String(style.skin),
});

/** The four partier looks (`look` 0–3): sunburnt, shades, a cap worn backwards, a beard. */
export const PARTY_LOOKS: readonly PartyLook[] = [
  look({ skin: 'skinA', hair: 'hairB', hairStyle: 'short', headgear: 'none', boots: 'snow', belt: 'brown', build: 'heavy', face: ['blush'] }, 'navy'),
  look({ skin: 'skinA', hair: 'hairC', hairStyle: 'buzz', headgear: 'cap-back', gear: 'red', boots: 'snow', belt: 'brown', build: 'normal', face: ['blush', 'shades'] }, 'purple'),
  look({ skin: 'skinB', hair: 'hairA', hairStyle: 'curly', headgear: 'none', boots: 'black', belt: 'black', build: 'stocky', face: ['beard'] }, 'sky'),
  look({ skin: 'skinC', hair: 'hairA', hairStyle: 'short', headgear: 'none', boots: 'snow', belt: 'black', build: 'lanky', face: ['shades'] }, 'red'),
];

/** The groom: tutu, veil, tiara and L-plate are pieces (groomPieces). */
export const GROOM_LOOK: PartyLook = look({ skin: 'skinA', hair: 'hairB', hairStyle: 'parted', headgear: 'none', boots: 'snow', belt: 'brown', build: 'normal', face: ['blush'] }, 'navy');

/** The sober guide who steers the beer bike. */
export const DRIVER_STYLE: HumanStyle = {
  skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'cap', gear: 'red', accent: 'snow',
  top: 'red', topType: 'polo', pants: 'black', boots: 'black', belt: 'black', build: 'normal',
};

/** Set name of a look (`groom` wins). */
export function partySet(lookIndex: number, groom: boolean): string {
  if (groom) return 'stag-groom';
  return lookIndex <= 0 ? 'stag-partier' : `stag-partier-${lookIndex}`;
}

/** The seated hip height above the floor (stool seat) and the pedal crank (from the hip). */
export const SEAT_HIP = 18;
const CRANK: readonly [number, number] = [6, 11];
const CRANK_R = 2.5;

// ------------------------------------------------------------------------------------ poses

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });
const TO = (x: number, y: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ to: [x, y], hand });
const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });

/** Legs on the stool pedals (crank angle `a` in turns; the far pedal half a turn on). */
function pedal(a: number): { legN: LegPose; legF: LegPose } {
  const leg = (ang: number): LegPose => {
    const px = CRANK[0] + Math.cos(ang * Math.PI * 2) * CRANK_R;
    const py = CRANK[1] + Math.sin(ang * Math.PI * 2) * CRANK_R;
    const d = Math.min(11.8, Math.hypot(px, py));
    const phi = (Math.atan2(px, py) * 180) / Math.PI;
    const al = (Math.acos(d / 12) * 180) / Math.PI;
    return { hip: phi + al, knee: 2 * al, foot: 0 };
  };
  return { legN: leg(a), legF: leg(a + 0.5) };
}

/** A bottle in the near hand: angle (deg), state, grip. */
interface Hold {
  deg: number;
  state: BottleState;
  grip: 'body' | 'neck';
}
const H = (deg: number, state: BottleState = 'corked', grip: 'body' | 'neck' = 'body'): Hold => ({ deg, state, grip });
/** Carried upright in front of the belly. */
const CARRY = H(-84);
const RELAX: ArmPose = A(-8, 24);

interface Key {
  pose: Pose;
  hold?: Hold | null;
  phone?: boolean;
  /** Bare torso + the T-shirt bundle over the head (cower). */
  bundle?: number;
  /** Draw the chest print / L-plate. */
  chest?: boolean;
  /** The groom's veil on the head (false: it flew off — every death strip). */
  veil?: boolean;
}

const IDLE: Key[] = P.BREATH4.map((b) => ({ pose: { ...P.STAND, ...b, armN: TO(5, 5), armF: RELAX }, hold: CARRY, chest: true }));
const WALK: Key[] = withSwing(P.WALK, 0.6, 24).map((w, i) => ({ pose: { ...w, armN: TO(5, 5 + (i % 4 === 1 ? 1 : 0)) }, hold: CARRY, chest: true }));
const ALERT: Key[] = [{ pose: { ...P.STAND, armN: A(150, 20), armF: RELAX, expr: 'shout' }, hold: H(-80), chest: true }];
const TELL_UP: Array<{ armN: ArmPose; deg: number; state: BottleState; lean: number; expr: Pose['expr'] }> = [
  { armN: TO(7, -3), deg: -60, state: 'corked', lean: -2, expr: 'happy' },
  { armN: TO(6, -6), deg: -100, state: 'leak', lean: -5, expr: 'shout' },
  { armN: TO(8, -2), deg: -55, state: 'leak', lean: -3, expr: 'happy' },
];
const TELL: Key[] = TELL_UP.map((u) => ({ pose: { ...P.STAND, armN: u.armN, armF: RELAX, lean: u.lean, expr: u.expr }, hold: H(u.deg, u.state), chest: true }));
const FIRE_UP: Array<{ armN: ArmPose; deg: number; state: BottleState; lean: number; expr: Pose['expr'] }> = [
  { armN: TO(9, 1), deg: -8, state: 'leak', lean: 0, expr: 'shout' },
  { armN: TO(8, -1), deg: -22, state: 'spurt', lean: -6, expr: 'shout' },
  { armN: TO(8, 1), deg: -10, state: 'open', lean: -2, expr: 'happy' },
];
const FIRE: Key[] = FIRE_UP.map((u) => ({ pose: { ...P.STAND, armN: u.armN, armF: RELAX, lean: u.lean, expr: u.expr }, hold: H(u.deg, u.state), chest: true }));
const TOAST: Key[] = [
  { pose: { ...P.STAND, armN: TO(8, -8), armF: RELAX, expr: 'happy' }, hold: H(-55), chest: true },
  { pose: { ...P.STAND, armN: TO(9, -9), armF: RELAX, lean: 3, expr: 'happy' }, hold: H(-40), chest: true },
  { pose: { ...P.STAND, armN: A(165, 10), armF: RELAX, lean: -3, expr: 'happy' }, hold: H(-88), chest: true },
  { pose: { ...P.STAND, armN: A(160, 15), armF: RELAX, lean: -4, head: { tilt: -8 }, expr: 'blink' }, hold: H(-80), chest: true },
];
const SELFIE: Key[] = [
  { pose: { ...P.STAND, armN: TO(7, -12), armF: RELAX, head: { tilt: 8 }, expr: 'happy' }, phone: true, chest: true },
  { pose: { ...P.STAND, armN: TO(7, -12), armF: RELAX, head: { tilt: 8 }, expr: 'blink' }, phone: true, chest: true },
];
const PHOTO: Key[] = [{ pose: { ...P.STAND, armN: A(165, 10), armF: A(30, 60, 'open'), expr: 'happy' }, hold: H(-90), chest: true }];
/** The group selfie: phone up and in front, the free hand making a peace sign by the face. */
const GLOAT: Key[] = [
  { pose: { ...P.STAND, armN: TO(8, -13), armF: TO(5, -7, 'point'), head: { tilt: 8 }, expr: 'happy' }, phone: true, chest: true },
  { pose: { ...P.STAND, armN: TO(8, -13), armF: TO(5, -8, 'point'), head: { tilt: 12 }, hunch: 1, expr: 'happy' }, phone: true, chest: true },
];
/** Cower: the T-shirt pulled up over the head, both hands holding it, knees knocking. */
const COWER: Key[] = [0, 1].map((k) => ({
  pose: { legN: L(14, 34), legF: L(-4, 30), armN: TO(2, -11, 'open'), armF: TO(3, -10, 'open'), lean: 6 + k * 4, hunch: 1, expr: 'panic' },
  bundle: k,
}));
/** Death: staggers, the knees go, he sits down hard; the bottle in his lap foams over. */
const SIT_DOWN: Pose = { legN: L(88, 8, 20), legF: L(78, 26), armN: TO(6, 6), armF: A(-30, 20, 'open'), lean: -6, expr: 'dazed' };
const DIE: Key[] = [
  { pose: { ...P.STAND, armN: A(60, 60, 'open'), armF: A(80, 40, 'open'), lean: -12, expr: 'hurt' }, hold: null, chest: true, veil: false },
  { pose: { legN: L(50, 70), legF: L(20, 80), armN: A(80, 40), armF: A(60, 40, 'open'), lean: -10, expr: 'hurt' }, hold: H(-70), chest: true, veil: false },
  { pose: SIT_DOWN, hold: H(-80, 'spurt'), chest: true, veil: false },
  { pose: { ...SIT_DOWN, head: { dy: 1 } }, hold: H(-95, 'spurt'), chest: true, veil: false },
  { pose: { ...SIT_DOWN, head: { dy: 1 } }, hold: H(-90, 'open'), chest: true, veil: false },
  { pose: { ...SIT_DOWN, lean: -14, expr: 'blink' }, hold: H(-85, 'open'), chest: true, veil: false },
];
/** A death strip's frame: the costume stays (tutu, L-plate or print, tiara); the veil flew off. */
const DEAD = (pose: Pose): Key => ({ pose, chest: true, veil: false });
export const DIE_TIMING: readonly number[] = [5, 6, 8, 10, 10, 30];

/** Seated upper bodies (the legs pedal: `pedal(a)`). */
const SIT_UP: Key[] = [0, 1, 0, 1].map((h) => ({ pose: { lean: 4, hunch: h, armN: TO(7, 5), armF: TO(6, 4) }, hold: H(-86), chest: true }));
const seated = (k: Key, crank = 0): Key => ({ ...k, pose: { ...k.pose, ...pedal(crank), grounded: false } });

// ------------------------------------------------------------------------------------ frames

/** A piece turned `rot` degrees clockwise about its buffer centre, that centre at (cx, cy). */
function turnedPiece(buf: PixelBuffer, cx: number, cy: number, rot: number, d: Dn): Piece {
  const b = buf.rotated((rot * Math.PI) / 180, { align: d });
  return piece(b, cx - b.w / d / 2, cy - b.h / d / 2, d);
}

/** Pieces of a frame (bottle, phone, print / L-plate, groom extras) at density d. */
function dress(f: Frame, k: Key, lookD: { look: PartyLook; groom: boolean }, d: Dn): Frame {
  const hip = f.pts?.hip ?? [0, -15];
  const head = f.pts?.head ?? [0, -27];
  const lean = k.pose.lean ?? 0;
  const front = [];
  const behind = [];
  // A tumbling or lying figure (rot): the costume pieces turn with it.
  const rot = k.pose.rot ?? 0;
  if (lookD.groom && k.bundle === undefined && k.veil !== false) {
    behind.push(piece(veilBuf(d), head[0] - 13, head[1] - 5.5, d, true));
  }
  if (k.chest) {
    // The chest: 40 % of the way from the hip to the head centre.
    const cx = hip[0] + (head[0] - hip[0]) * 0.4 + lean * 0.05;
    const cy = hip[1] + (head[1] - hip[1]) * 0.4;
    if (rot !== 0) front.push(turnedPiece(lookD.groom ? lplateBuf(d) : printBuf(d), cx, cy, rot, d));
    else if (lookD.groom) front.push(piece(lplateBuf(d), cx - 3, cy - 3, d));
    else front.push(piece(printBuf(d), cx - 2.5, cy - 2.5, d));
  }
  if (lookD.groom) {
    if (rot !== 0) front.push(turnedPiece(tutuWaistBuf(d), hip[0], hip[1], rot, d));
    else front.push(piece(tutuBuf(d), hip[0] - 9, hip[1] - 2, d));
  }
  if (lookD.groom && k.bundle === undefined) {
    if (rot !== 0) {
      // The tiara's centre sits (−0.5, −6) from the head centre, turned with the head.
      const a = (rot * Math.PI) / 180;
      const tx = -0.5 * Math.cos(a) + 6 * Math.sin(a);
      const ty = -0.5 * Math.sin(a) - 6 * Math.cos(a);
      front.push(turnedPiece(tiaraBuf(d), head[0] + tx, head[1] + ty, rot, d));
    } else front.push(piece(tiaraBuf(d), head[0] - 3.5, head[1] - 7.5, d));
  }
  if (k.bundle !== undefined) front.push(piece(shirtBundleBuf(TEE, d, k.bundle), head[0] - 6, head[1] - 6, d));
  if (k.hold) front.push(bottlePiece(f, k.hold.deg, k.hold.state, k.hold.grip, d));
  if (k.phone && f.pts?.hand) front.push(piece(phoneBuf(d), f.pts.hand[0] - 2, f.pts.hand[1] - 5, d));
  return addPieces(f, [...behind, ...front]);
}

function standing(lk: PartyLook, groom: boolean, k: Key, d: Dn): Frame {
  return dress(partyFigure(lk, k.pose, d, k.bundle !== undefined), k, { look: lk, groom }, d);
}

function sitting(lk: PartyLook, groom: boolean, k: Key, d: Dn, hipY = SEAT_HIP): Frame {
  const f = moveAnchor(partyFigure(lk, k.pose, d, k.bundle !== undefined), hipY);
  return dress(f, k, { look: lk, groom }, d);
}

/** Register a strip at 1× and its 2× / 4× art (cut to the 1× boxes: geometry is law). */
function defHi(id: string, gen: (d: Dn) => Frame[], o: SpriteOpts): void {
  defineSprite(id, () => gen(1), { ...o, hd: (d) => onBoxes(gen(d), getFrames(id, 1), d) });
}

/** Register one partier set. */
function defineParty(set: string, lk: PartyLook, groom: boolean): void {
  const pre = `enemy/${set}/`;
  const o: SpriteOpts = { trim: true };
  const st = (keys: readonly Key[]) => (d: Dn): Frame[] => keys.map((k) => standing(lk, groom, k, d));
  const sit = (keys: readonly Key[], crank = 0) => (d: Dn): Frame[] => keys.map((k, i) => sitting(lk, groom, seated(k, crank + i * 0.25), d));
  defHi(pre + 'idle', st(IDLE), { ...o, ticksPerFrame: 12 });
  defHi(pre + 'walk', st(WALK), { ...o, ticksPerFrame: 7 });
  defHi(pre + 'turn', (d) => turnSquash(standing(lk, groom, IDLE[0], d)), { ...o, ticksPerFrame: 2 });
  defHi(pre + 'alert', st(ALERT), { ...o, ticksPerFrame: 30 });
  defHi(pre + 'tell', st(TELL), { ...o, ticksPerFrame: 4 });
  defHi(pre + 'fire', st(FIRE), { ...o, durations: [3, 8, 10], loop: false });
  defHi(pre + 'gag-toast', st(TOAST), { ...o, durations: [16, 10, 20, 24] });
  defHi(pre + 'gag-selfie', st(SELFIE), { ...o, durations: [40, 8] });
  defHi(pre + 'photo-pose', st(PHOTO), { ...o, defer: true });
  defHi(pre + 'gloat', st(GLOAT), { ...o, ticksPerFrame: 14, defer: true });
  defHi(pre + 'cower', st(COWER), { ...o, ticksPerFrame: 3, defer: true });
  defHi(pre + 'die', st(DIE), { ...o, durations: DIE_TIMING, loop: false });
  // Every death strip keeps the costume (dress); a blast singes one shade within each colour's
  // own ramp (the party shirt stays green, as the handhaver's vest stays in his).
  const dead = (p: Pose, d: Dn): Frame => standing(lk, groom, DEAD(p), d);
  defHi(pre + 'die-knife', (d) => P.DIE_KNIFE.map((p) => dead(p, d)), { ...o, durations: [8, 6, 6, 6, 30], loop: false, defer: true });
  defHi(pre + 'die-blast', (d) => P.DIE_BLAST.map((p) => singe(dead(p, d))), { ...o, durations: [5, 5, 5, 5, 30], loop: false, defer: true });
  defHi(pre + 'die-burn', (d) => partyBurn(lk, groom, d), { ...o, ticksPerFrame: 6, loop: false, defer: true });
  const stand = (d: Dn): Frame => dead(P.STAND, d);
  defineSprite(pre + 'die-crush', () => crushStrip(stand(1)), {
    durations: CRUSH_TIMING,
    loop: false,
    defer: true,
    hd: (d) => crushStripHi(stand(1), stand(d), getFrames(pre + 'die-crush', 1)),
  });
  // Seated on a beer-bike stool.
  defHi(pre + 'sit', sit(SIT_UP), { ...o, ticksPerFrame: 7 });
  defHi(pre + 'sit-tell', (d) => TELL.map((k) => sitting(lk, groom, seated({ ...k, pose: { ...k.pose, legN: undefined, legF: undefined } }), d)), { ...o, ticksPerFrame: 4 });
  defHi(pre + 'sit-fire', (d) => FIRE.map((k) => sitting(lk, groom, seated({ ...k, pose: { ...k.pose, legN: undefined, legF: undefined } }), d)), { ...o, durations: [3, 8, 10], loop: false });
  defHi(pre + 'sit-gloat', (d) => GLOAT.map((k) => sitting(lk, groom, seated({ ...k, pose: { ...k.pose, legN: undefined, legF: undefined } }), d)), { ...o, ticksPerFrame: 14, defer: true });
  defHi(pre + 'sit-cower', (d) => COWER.map((k) => sitting(lk, groom, seated({ ...k, pose: { ...k.pose, legN: undefined, legF: undefined } }), d)), { ...o, ticksPerFrame: 3, defer: true });
  defHi(pre + 'die-stool', (d) => dieStool(lk, groom, d), { ...o, durations: [5, 5, 6, 8, 30], loop: false });
}

/** Tips off the stool backwards: hit, tipping, falling, then flat on the floor behind it. */
function dieStool(lk: PartyLook, groom: boolean, d: Dn): Frame[] {
  const up: Pose = { ...pedal(0), armN: A(120, 40, 'open'), armF: A(140, 30, 'open'), lean: -14, grounded: false, expr: 'hurt' };
  const f0 = sitting(lk, groom, { ...DEAD(up), hold: null }, d);
  const f1 = sitting(lk, groom, { ...DEAD({ ...up, rot: -30, legN: L(100, 40), legF: L(80, 60) }), hold: null }, d, SEAT_HIP - 2);
  const f2 = sitting(lk, groom, { ...DEAD({ ...up, rot: -65, legN: L(110, 30), legF: L(90, 40), expr: 'panic' }), hold: null }, d, SEAT_HIP - 8);
  const lie = (p: Pose): Frame => dress(partyFigure(lk, { ...p, dx: -4 }, d), DEAD(p), { look: lk, groom }, d);
  return [f0, f1, f2, lie(P.DIE[4]), lie(P.DIE[5])];
}

/**
 * One shade darker within each colour's own ramp (a blast's singe; never steel or ink, unlike
 * `scorch`, so the lime party shirt and the pink tutu keep their colours).
 */
function singe(f: Frame): Frame {
  const b = f.buf.clone();
  const data = b.data;
  const dense = (f.density ?? 1) >= 2;
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    if ((c & 255) === 0 || c === INK) continue;
    let s: number = c;
    if (dense) {
      const h = hdHome(c);
      if (h) s = h.ramp[Math.max(0, h.i - 1)];
    } else s = stepShade(c, -1);
    data[i] = s >>> 0;
  }
  b.touch();
  return { ...f, buf: b };
}

/**
 * Burnt (human-sprites `burnFrames` on the dressed figure): hopping in flames, scorched one shade,
 * then the soot statue and its crumble.
 */
function partyBurn(lk: PartyLook, groom: boolean, d: Dn): Frame[] {
  const seed = 9;
  const fig = (p: Pose, dd: Dn): Frame => standing(lk, groom, DEAD(p), dd);
  const statuePose: Pose = { ...P.STAND, armN: A(30, 60, 'open'), armF: A(-20, 50, 'open'), expr: 'soot' };
  const out: Frame[] = [];
  if (d === 1) {
    P.BURN.forEach((p, i) => out.push(withFlames(scorch(fig(p, 1), 1), i * 2 + 1, seed)));
    const statue = sootify(fig(statuePose, 1), 1, true, seed);
    out.push(withFlames(statue, 5, seed + 3, 3), statue);
    for (const t of [0.35, 0.7, 1]) out.push(crumble(statue, t, seed));
    return out;
  }
  P.BURN.forEach((p, i) => out.push(withFlamesDense(scorch(fig(p, 1), 1), scorch(fig(p, d), 1), i * 2 + 1, seed)));
  const s1 = sootify(fig(statuePose, 1), 1, true, seed);
  const sd = sootify(fig(statuePose, d), 1, true, seed);
  out.push(withFlamesDense(s1, sd, 5, seed + 3, 3), sd);
  for (const t of [0.35, 0.7, 1]) out.push(crumbleDense(s1, sd, t, seed));
  return out;
}

PARTY_LOOKS.forEach((lk, i) => defineParty(partySet(i, false), lk, false));
defineParty('stag-groom', GROOM_LOOK, true);

// ------------------------------------------------------------------------------------ the driver

const BAR: readonly [number, number] = [9, -1];
function driverFrame(crank: number, d: Dn): Frame {
  const f = renderHuman(DRIVER_STYLE, { weapon: 'none', ...pedal(crank), grounded: false, lean: 8, armN: { to: BAR, hand: 'grip' }, armF: { to: [BAR[0] - 1, BAR[1]], hand: 'grip' } }, 'full', d);
  return moveAnchor(f, SEAT_HIP);
}
defHi('enemy/stag-beer-bike/driver', (d) => [driverFrame(0, d), driverFrame(0.5, d)], { trim: true, ticksPerFrame: 8 });
defHi(
  'enemy/stag-beer-bike/driver-flee',
  (d) => [0, 2, 4, 6].map((i) => renderHuman(DRIVER_STYLE, { weapon: 'none', ...P.RUN[i], armN: A(150 - i * 4, 30, 'open'), armF: A(170, 20, 'open'), head: { tilt: -8 }, expr: 'panic' }, 'full', d)),
  { trim: true, ticksPerFrame: 5, defer: true },
);

// ------------------------------------------------------------------------------------ small parts

defineSprite('enemy/cork/fly', () => corkFrames(1), { ticksPerFrame: 3, hd: (d) => corkFrames(d) });
defineSprite('enemy/stag-partier/flash', () => flashFrames(1), { durations: [2, 3, 4], loop: false, defer: true, hd: (d) => flashFrames(d) });
defineSprite('enemy/stag-groom/veil', () => veilFrames(1), { ticksPerFrame: 6, defer: true, hd: (d) => veilFrames(d) });
