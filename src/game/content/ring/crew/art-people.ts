/**
 * The people of `ring/crew` (docs/design/ring.md §5.5, §7.2): the road workers and the jam
 * boarders, from the humanoid rig at every density (`renderHuman(…, d)`; the partiers through the
 * stag kit's `partyFigure`), so the 1× and the 2× / 4× frames are the same figure (geometry is law:
 * art.ts cuts every dense frame to its 1× box). Bloodless: a knocked-off man tumbles and sits up
 * dazed.
 *
 * Workers (`WORKER_LOOKS`): an orange work jacket with silver bands, navy or orange trousers, work
 * gloves, a hard hat. The cones they throw are the wave-A cone (`hazards/art.ts` `coneFrame`).
 * Boarders: the ams handhaver's style (three skins: navy uniform and cap, the yellow hi-vis vest)
 * and the stag partiers' looks (the lime party T-shirt with its star print, shorts, a fizzy-wine
 * bottle in the near hand).
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas } from '../../../art/hd';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type ArmPose, type Density, type HumanStyle, type LegPose, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { HANDHAVER_STYLE } from '../../locals/handhaver.art';
import { PARTY_LOOKS } from '../../stag/art';
import { bottlePiece, finishA, mat, partyFigure, piece, printBuf, type BottleState, type Dn, type PartyLook } from '../../stag/kit.art';
import { coneFrame } from '../hazards/art';
import { BOARDER_SETS } from './geometry';

const A = (sh: number, el: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ sh, el, hand });
const TO = (x: number, y: number, hand: ArmPose['hand'] = 'fist'): ArmPose => ({ to: [x, y], hand });
const L = (hip: number, knee: number, foot?: number): LegPose => (foot === undefined ? { hip, knee } : { hip, knee, foot });

// ---------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------

/** A cone held in the hands: the wave-A cone frame `f` (0 upright, 1 45°, 2 lying) at the hand. */
function conePiece(f: Frame, cf: number, d: Dn, dx = 0, dy = 0, behind = false): Piece | null {
  const h = f.pts?.hand;
  if (!h) return null;
  const c = coneFrame(cf, d);
  // The cone's middle in the fist (its frame anchor is the foot, 7 × 13 into the 15 × 15 box).
  return piece(c.buf, h[0] - 7.5 + dx, h[1] - 8 + dy, d, behind);
}

/** A thermos cup (the coffee break): a white enamel cup with a steel rim, 4 × 5 box. */
function cupBuf(d: Dn): PixelBuffer {
  const c = new HdCanvas(4, 5, d);
  const enamel = mat(c, 'snow', { spec: 0.8, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 6 });
  const rim = mat(c, 'steel', { spec: 1, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  c.box(0.6, 1.2, 2.8, 3.2, { mat: enamel, z: 0, r: 0.6, bevel: 0.4 });
  c.box(0.4, 0.8, 3.2, 0.8, { mat: rim, z: 0.4, r: 0.3 });
  return finishA(c, 0.2);
}

// ---------------------------------------------------------------------------------------------
// The road workers
// ---------------------------------------------------------------------------------------------

const WORK_STAND: Pose = { ...P.STAND, armN: A(10, 30), armF: A(-8, 24) };

/** Idle on the deck: breathing, gloves at the sides. */
export function workerIdle(s: HumanStyle, d: Dn): Frame[] {
  return [{}, { hunch: 1 }].map((b) => renderHuman(s, { ...WORK_STAND, ...b, weapon: 'none' }, 'full', d as Density));
}

/** The tell: a cone off the stack, up to the chest, then over the head (he holds the last frame). */
export function workerTell(s: HumanStyle, d: Dn): Frame[] {
  const keys: Array<{ pose: Pose; cone: number; dx: number; dy: number }> = [
    { pose: { legN: L(30, 40), legF: L(-10, 44), lean: 14, armN: TO(9, 9, 'grip'), armF: TO(8, 10, 'grip'), expr: 'normal' }, cone: 0, dx: 0, dy: 1 },
    { pose: { ...P.STAND, lean: 2, armN: TO(7, 1, 'grip'), armF: TO(6, 2, 'grip'), expr: 'normal' }, cone: 0, dx: 0, dy: -1 },
    { pose: { ...P.STAND, lean: -8, armN: TO(-1, -11, 'grip'), armF: TO(-2, -10, 'grip'), head: { tilt: -6 }, expr: 'shout' }, cone: 1, dx: -1, dy: -2 },
  ];
  return keys.map((k) => {
    const f = renderHuman(s, { weapon: 'none', ...k.pose }, 'full', d as Density);
    const p = conePiece(f, k.cone, d, k.dx, k.dy);
    return p ? withPieces(f, [p]) : f;
  });
}

/** The throw: the cone flung forward (point `hand`: where it leaves), the follow-through, recover. */
export function workerThrow(s: HumanStyle, d: Dn): Frame[] {
  const keys: Array<{ pose: Pose; cone: number }> = [
    { pose: { ...P.STAND, lean: 6, armN: TO(8, -10, 'open'), armF: TO(6, -9, 'open'), expr: 'shout' }, cone: 1 },
    { pose: { legN: L(34, 30), legF: L(-20, 30), lean: 16, armN: TO(11, 1, 'open'), armF: TO(10, 2, 'open'), expr: 'shout' }, cone: -1 },
    { pose: { ...P.STAND, lean: 6, armN: A(30, 40, 'open'), armF: A(20, 30, 'open'), expr: 'happy' }, cone: -1 },
  ];
  return keys.map((k) => {
    const f = renderHuman(s, { weapon: 'none', ...k.pose }, 'full', d as Density);
    const p = k.cone >= 0 ? conePiece(f, k.cone, d, 1, -2) : null;
    return p ? withPieces(f, [p]) : f;
  });
}

/** The gloat: the coffee break — a cup from the thermos, a sip (head back), a contented blink. */
export function workerGloat(s: HumanStyle, d: Dn): Frame[] {
  const keys: Pose[] = [
    { ...P.STAND, armN: TO(6, 0, 'grip'), armF: A(-6, 20), expr: 'normal' },
    { ...P.STAND, armN: TO(5, -7, 'grip'), armF: A(-6, 20), head: { tilt: -10 }, expr: 'blink' },
    { ...P.STAND, hunch: 1, armN: TO(6, -1, 'grip'), armF: A(-6, 20), head: { tilt: 4 }, expr: 'happy' },
  ];
  return keys.map((p) => {
    const f = renderHuman(s, { weapon: 'none', ...p }, 'full', d as Density);
    const h = f.pts?.hand;
    return h ? withPieces(f, [piece(cupBuf(d), h[0] - 1, h[1] - 4, d)]) : f;
  });
}

/** The cower: down behind the drop side, both gloves over the hard hat; frame 2 trembles. */
export function workerCower(s: HumanStyle, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    renderHuman(s, { legN: L(72, 104), legF: L(30, 108), lean: 8 + k * 7, hunch: 1, armN: TO(1, -9, 'open'), armF: TO(2, -8, 'open'), head: { dy: 1, tilt: 10 }, expr: 'panic', weapon: 'none' }, 'full', d as Density),
  );
}

/** A man rolling in a tuck (feet anchor at the roll's middle). */
export function tumbleFigure(s: HumanStyle, d: Dn): Frame[] {
  return [0, 90, 180, 270].map((rot) =>
    renderHuman(s, { weapon: 'none', grounded: false, crouch: 1, lean: 30, armN: A(40, 120), armF: A(30, 120), rot, expr: 'hurt', dy: -6 }, 'full', d as Density),
  );
}

/** Sitting dazed on the hard shoulder (legs out, propped on the hands), blinking. */
export function sitFigure(s: HumanStyle, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    renderHuman(s, { legN: { hip: 88, knee: 6, foot: 20 }, legF: { hip: 80, knee: 14, foot: 20 }, lean: -14, armN: A(-30, 10, 'open'), armF: A(-40, 10, 'open'), head: { tilt: k ? 8 : -4 }, expr: k ? 'blink' : 'hurt', dy: 8, weapon: 'none' }, 'full', d as Density),
  );
}

// ---------------------------------------------------------------------------------------------
// The jam boarders
// ---------------------------------------------------------------------------------------------

/** The three handhaver styles of the ams sets (`enemy/handhaver`, `-b`, `-c`). */
const HANDHAVER_STYLES: readonly HumanStyle[] = [
  HANDHAVER_STYLE,
  { ...HANDHAVER_STYLE, skin: 'skinB', hair: 'hairA' },
  { ...HANDHAVER_STYLE, skin: 'skinC', hair: 'hairA', hairStyle: 'curly' },
];

/** What a boarder holds in the near hand in a key: a bottle (the partier) at an angle, or nothing. */
interface BKey {
  pose: Pose;
  /** The partier's bottle (deg, state); undefined: carried upright; null: none. */
  bottle?: { deg: number; state: BottleState } | null;
}

/** One boarder frame of set `i` at density d. */
function boarder(i: number, k: BKey, d: Dn): Frame {
  const set = BOARDER_SETS[i];
  if (set.kind === 'handhaver') return renderHuman(HANDHAVER_STYLES[set.look], { weapon: 'none', ...k.pose }, 'full', d as Density);
  const lk: PartyLook = PARTY_LOOKS[set.look];
  const f = partyFigure(lk, k.pose, d);
  const pieces: Piece[] = [];
  const hip = f.pts?.hip ?? [0, -15];
  const head = f.pts?.head ?? [0, -27];
  const rot = k.pose.rot ?? 0;
  if (rot === 0) {
    const lean = k.pose.lean ?? 0;
    const cx = hip[0] + (head[0] - hip[0]) * 0.4 + lean * 0.05;
    const cy = hip[1] + (head[1] - hip[1]) * 0.4;
    pieces.push(piece(printBuf(d), cx - 2.5, cy - 2.5, d));
  }
  const b = k.bottle === undefined ? { deg: -84, state: 'corked' as BottleState } : k.bottle;
  if (b) {
    const bp = bottlePiece(f, b.deg, b.state, 'body', d);
    if (bp) pieces.push(bp);
  }
  return pieces.length ? withPieces(f, pieces) : f;
}

const isStag = (i: number): boolean => BOARDER_SETS[i].kind === 'stag';

/** Idle (2): standing ready on the lane split, breathing (the partier's bottle up). */
export function boarderIdle(i: number, d: Dn): Frame[] {
  return [{}, { hunch: 1 }].map((b) =>
    boarder(i, { pose: { ...P.STAND, ...b, armN: isStag(i) ? TO(5, 5) : A(14, 30), armF: A(-8, 24), expr: 'normal' } }, d),
  );
}

/** Run (8): between the stopped cars, the arms pumping (the partier keeps his bottle up). */
export function boarderRun(i: number, d: Dn): Frame[] {
  return P.RUN.map((p, k) => {
    const n = p.legN?.hip ?? 0;
    const f = p.legF?.hip ?? 0;
    const armF = A(-f * 0.7 + 4, 70);
    const armN = isStag(i) ? TO(6, 2 + (k % 4 === 1 ? 1 : 0)) : A(-n * 0.7 + 4, 70);
    return boarder(i, { pose: { ...p, lean: 8, armN, armF, expr: k % 4 === 2 ? 'shout' : 'normal' } }, d);
  });
}

/** The tell before the hop: down into a crouch, the arms swung back (2: deeper). */
export function boarderCrouch(i: number, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    boarder(i, { pose: { legN: L(54 + k * 14, 80 + k * 20), legF: L(14 + k * 8, 84 + k * 20), lean: 16 + k * 6, armN: isStag(i) ? TO(-3, 4) : A(-50 - k * 10, 20), armF: A(-60 - k * 10, 20, 'open'), expr: 'shout' }, bottle: isStag(i) ? { deg: -150, state: 'corked' } : undefined }, d),
  );
}

/** The hop: up and over (a tuck, arms forward), then reaching down for the bonnet. */
export function boarderHop(i: number, d: Dn): Frame[] {
  const keys: Pose[] = [
    { legN: L(80, 110), legF: L(50, 120), grounded: false, lean: 10, armN: isStag(i) ? TO(7, -6) : A(130, 30), armF: A(110, 30, 'open'), expr: 'shout' },
    { legN: L(40, 40), legF: L(10, 70), grounded: false, lean: 4, armN: isStag(i) ? TO(7, -2) : A(70, 40), armF: A(60, 30, 'open'), expr: 'happy' },
  ];
  return keys.map((pose) => boarder(i, { pose, bottle: isStag(i) ? { deg: -60, state: 'corked' } : undefined }, d));
}

/** Kneeling on the bonnet, facing the windscreen: the far hand on the glass, the near ready. */
const KNEEL: Pose = { legN: L(84, 92, 0), legF: L(-4, 110, 0), lean: 18, armF: TO(10, 3, 'open') };

/** Perch (2): kneeling on the bonnet, holding on, the head bobbing. */
export function boarderPerch(i: number, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    boarder(i, { pose: { ...KNEEL, lean: 18 + k * 2, armN: isStag(i) ? TO(6, 1 + k) : TO(9, 2 + k), head: { dy: k }, expr: k ? 'shout' : 'normal' } }, d),
  );
}

/** The tell before a swing: the near arm right up and back (the fist / the bottle), leaning back. */
export function boarderTellHit(i: number, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    boarder(i, { pose: { ...KNEEL, lean: 4 - k * 8, armN: A(172 + k * 12, 8 + k * 10), head: { tilt: -8 }, expr: 'shout' }, bottle: isStag(i) ? { deg: -110 - k * 30, state: 'corked' } : undefined }, d),
  );
}

/** The swing: slammed down onto the glass, then the bounce back. */
export function boarderHit(i: number, d: Dn): Frame[] {
  const keys: Array<{ pose: Pose; deg: number }> = [
    { pose: { ...KNEEL, lean: 30, armN: TO(12, 6), head: { tilt: 8 }, expr: 'shout' }, deg: 20 },
    { pose: { ...KNEEL, lean: 22, armN: TO(11, 1), expr: 'happy' }, deg: -20 },
  ];
  return keys.map((k) => boarder(i, { pose: k.pose, bottle: isStag(i) ? { deg: k.deg, state: 'leak' } : undefined }, d));
}

/** Tumbling off (4, a tuck) and sitting dazed (2): the costume stays, the partier's bottle is gone. */
export function boarderTumble(i: number, d: Dn): Frame[] {
  return [0, 90, 180, 270].map((rot) =>
    boarder(i, { pose: { grounded: false, crouch: 1, lean: 30, armN: A(40, 120), armF: A(30, 120), rot, expr: 'hurt', dy: -6 }, bottle: null }, d),
  );
}

export function boarderSit(i: number, d: Dn): Frame[] {
  return [0, 1].map((k) =>
    boarder(i, { pose: { legN: { hip: 88, knee: 6, foot: 20 }, legF: { hip: 80, knee: 14, foot: 20 }, lean: -14, armN: A(-30, 10, 'open'), armF: A(-40, 10, 'open'), head: { tilt: k ? 8 : -4 }, expr: k ? 'blink' : 'hurt', dy: 8 }, bottle: null }, d),
  );
}
