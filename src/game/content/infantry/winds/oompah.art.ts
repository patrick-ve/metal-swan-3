/**
 * `enemy/oompah-trooper[-<outfit>][-skin<b|c>]/…` — the Oompah Trooper (GDD §9.1): heavy build,
 * red cheeks, a crimson cap, and an original sousaphone-like horn: a brass ring coiled around his
 * belly, a riser up his back and a big flared bell facing forward over his head (the `muzzle`
 * point is its mouth). Strips: the common set (common.art.ts) + inhale (3f, the body puffs
 * +2 px) · blast (2f) · wheeze (4f, wipes his brow) · shoot · crouch-shoot · throw ·
 * gag-polish (6f) · gag-practice (6f) · gag (= polish); `die` blows him backwards in a spin and
 * `die-blast` crumples the horn around him like an accordion.
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import type { HumanStyle, Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { commonStrips, defineSkinVariant, defineStrips, frazzled, hatless, type Strips, type TypeArt } from './common.art';
import { outfitStyle } from '../art';
import { arcPts, bellPts, dress, ellipsePts, markArt, noteArt, stamp, type Body, type Pt, type Shape, type WPose } from './kit';
import { ensureLook, registerLookDefiner, type Outfit, type Skin } from './looks';
import { scorch } from '../../../art/human-fx';

/** Parade style: the heavy bandsman. */
export const OOMPAH_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'red',
  accent: 'gold',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'heavy',
  accessories: ['cross-belt'],
  face: ['moustache', 'blush'],
};

/** The look for an outfit (skin A; the other skins are recoloured copies). */
export function oompahStyle(outfit: Outfit): HumanStyle {
  return outfitStyle(OOMPAH_STYLE, outfit);
}

/** Instrument state per frame. */
interface Tuba {
  /** Bell offset (px, + down): lifts while inhaling, shakes on the blast. */
  bellY?: number;
  /** Sound lines at the bell mouth (the blast). */
  blare?: number;
  /** Crumpled like an accordion (blast death). */
  crumple?: boolean;
  /** A polishing cloth at the near hand, a sparkle on the bell. */
  cloth?: boolean;
  sparkle?: boolean;
  /** A practice note over the bell (1 = low, 2 = high). */
  note?: number;
}

const G = PAL.gold;
const BRASS = PAL.brass;

/** Bell mouth (body space) for a bell offset. */
function bellMouth(by: number): Pt {
  return [11, -28 + by];
}

/** The sousaphone in body space (origin = pelvis). */
function sousa(f: Frame, b: Body, p: WPose<unknown>): Frame {
  const s = (p.inst ?? {}) as Tuba;
  const by = s.bellY ?? 0;
  // The coil: an ellipse ring around the belly, tilted (higher at the back).
  const cx = 0;
  const cy = -3;
  const rx = 9;
  const ry = 5;
  const rot = -16;
  if (s.crumple) {
    // Accordion: three squashed pleats around the belly and a dented bell sagging forward.
    const pleats: Shape[] = [-6, -3, 0].map((dy) => ({ kind: 'tube', pts: arcPts(cx, cy + dy, rx - 1, 2, -40, 200, 10, rot), w: 2, ramp: BRASS }));
    return dress(f, b, {
      back: [{ kind: 'tube', pts: arcPts(cx, cy - 3, rx - 1, 5, 190, 330, 8, rot), w: 3, ramp: BRASS }],
      front: [...pleats, { kind: 'poly', pts: bellPts([2, -12], 40, 9, 2, 5, 2), ramp: G }],
    });
  }
  const back: Shape[] = [
    { kind: 'tube', pts: arcPts(cx, cy, rx, ry, 160, 300, 12, rot), w: 3, ramp: G },
    // The riser up the back, curving forward into the bell.
    { kind: 'tube', pts: [[-7, -6], [-8, -14], [-8, -23 + by], [-5, -28 + by]], w: 3, ramp: G },
  ];
  const mouth = bellMouth(by);
  const front: Shape[] = [
    { kind: 'tube', pts: arcPts(cx, cy, rx, ry, -60, 160, 16, rot), w: 3, ramp: G },
    // Valve block with three piston caps.
    { kind: 'poly', pts: [[5, -8], [8, -8], [8, -3], [5, -3]], ramp: G },
    { kind: 'dots', pts: [[5, -9], [7, -9]], ramp: G, color: G[3], detail: true },
    // Leadpipe to the mouthpiece.
    { kind: 'tube', pts: [[6, -8], [7, -10], [6, -11]], w: 1, ramp: G, color: G[1] },
    // The bell: flared cone and its dark mouth.
    { kind: 'poly', pts: bellPts([-4, -28 + by], 0, 13, 2, 6.5), ramp: G },
    { kind: 'poly', pts: ellipsePts(9, -28 + by, 1.5, 5.5, 0, 14), ramp: G, color: G[0] },
  ];
  if (s.blare) {
    // Sound lines leaving the bell.
    const k = s.blare;
    for (let i = 0; i < 2; i++) {
      const x = mouth[0] + 4 + i * 4 + k;
      front.push({ kind: 'tube', pts: arcPts(x - 4, mouth[1], 4, 4 + i * 2, -50, 50, 6), w: 1, ramp: PAL.snow, color: PAL.snow[3] });
    }
  }
  let out = dress(f, b, { back, front, pts: { muzzle: [mouth[0] + 1, mouth[1]] } });
  if (s.cloth && out.pts?.hand) out = stamp(out, clothArt(), out.pts.hand[0] - 2, out.pts.hand[1] - 3);
  if (s.sparkle) out = stamp(out, sparkleArt(), Math.round(out.pts?.muzzle?.[0] ?? 8) - 6, Math.round(out.pts?.muzzle?.[1] ?? -40) - 9);
  if (s.note && out.pts?.muzzle) out = stamp(out, noteArt(s.note > 1), out.pts.muzzle[0] - 2 + s.note * 2, out.pts.muzzle[1] - 12 - s.note * 3);
  return out;
}

/** A white polishing cloth (5×4). */
function clothArt(): PixelBuffer {
  const b = new PixelBuffer(7, 6);
  b.rect(1, 1, 4, 3, PAL.snow[2]);
  b.set(1, 1, PAL.snow[3]);
  b.set(4, 3, PAL.snow[1]);
  b.set(5, 4, PAL.snow[1]);
  return b.outline(INK);
}

/** A four-point sparkle (the polished bell). */
function sparkleArt(): PixelBuffer {
  const b = new PixelBuffer(7, 7);
  b.vline(3, 1, 5, PAL.snow[3]);
  b.hline(1, 5, 3, PAL.snow[3]);
  b.set(3, 3, PAL.gold[3]);
  return b;
}

/** Arms: near hand on the valves, far hand on the coil behind. */
const HOLD: Pose = { armN: { to: [7, 4], hand: 'grip' }, armF: { to: [-1, -3], hand: 'grip' } };
const FAR: Pose = { armF: { to: [-1, -3], hand: 'grip' } };
const HUG: Pose = { armN: { to: [6, 3], hand: 'open' }, armF: { to: [4, 2], hand: 'open' } };

export const OOMPAH_ART: TypeArt = { dress: sousa, hold: HOLD, hug: HUG, farHold: FAR, walkTicks: 7 };

const STAND: Pose = { ...P.STAND, ...HOLD };
const A = (sh: number, el: number, hand?: 'fist' | 'grip' | 'open' | 'point' | 'thumb') => (hand ? { sh, el, hand } : { sh, el });
const L = (hip: number, knee: number) => ({ hip, knee });

/** The oompah's own strips (added to / replacing the common set). */
function oompahStrips(): Strips {
  const inhale: WPose<Tuba>[] = [
    { ...STAND, lean: -3, inst: { bellY: -1 } },
    { ...STAND, lean: -6, inst: { bellY: -2 }, fx: { puff: 1 }, expr: 'blink' },
    { ...STAND, lean: -8, inst: { bellY: -2 }, fx: { puff: 2 }, expr: 'blink', hunch: -1 },
  ];
  const blast: WPose<Tuba>[] = [
    { ...STAND, lean: 6, inst: { bellY: 1, blare: 0 }, expr: 'shout' },
    { ...STAND, lean: 3, inst: { bellY: 0, blare: 3 }, expr: 'shout' },
  ];
  const crouchBlast: WPose<Tuba>[] = blast.map((p) => ({ ...p, ...P.CROUCH }));
  return {
    inhale: { poses: inhale, opts: { durations: [12, 12, 12], loop: false } },
    blast: { poses: blast, opts: { durations: [6, 6], loop: false } },
    shoot: { poses: blast, opts: { durations: [4, 8], loop: false } },
    'crouch-shoot': { poses: crouchBlast, opts: { durations: [4, 8], loop: false } },
    wheeze: {
      poses: [
        { ...P.STAND, ...FAR, armN: { to: [6, -9], hand: 'open' }, lean: 12, expr: 'hurt' },
        { ...P.STAND, ...FAR, armN: { to: [7, -10], hand: 'open' }, lean: 14, expr: 'blink', hunch: 1 },
        { ...P.STAND, ...FAR, armN: { to: [5, -10], hand: 'open' }, lean: 12, expr: 'hurt' },
        { ...STAND, lean: 10, expr: 'blink', hunch: 1 },
      ],
      opts: { ticksPerFrame: 9 },
    },
    throw: {
      poses: P.seq({ ...P.STAND, ...FAR }, P.THROW.map((p) => ({ ...p, held: 'none' as const }))),
      opts: { durations: [8, 6, 4, 6, 8], loop: false },
    },
    'gag-polish': {
      poses: [
        { ...P.STAND, ...FAR, armN: { sh: 145, el: 10, hand: 'open' }, inst: { cloth: true }, head: { tilt: -8 }, expr: 'happy' },
        { ...P.STAND, ...FAR, armN: { sh: 155, el: 15, hand: 'open' }, inst: { cloth: true }, head: { tilt: -8 }, expr: 'happy' },
        { ...P.STAND, ...FAR, armN: { sh: 140, el: 20, hand: 'open' }, inst: { cloth: true }, head: { tilt: -8 }, expr: 'blink' },
        { ...P.STAND, ...FAR, armN: { sh: 150, el: 10, hand: 'open' }, inst: { cloth: true, sparkle: true }, head: { tilt: -10 }, expr: 'happy' },
        { ...STAND, lean: -4, expr: 'happy', head: { tilt: -8 } },
        { ...STAND, lean: -4, expr: 'blink', head: { tilt: -8 } },
      ],
      opts: { durations: [8, 8, 8, 16, 24, 10] },
    },
    'gag-practice': {
      poses: [
        { ...STAND, expr: 'normal' },
        { ...STAND, lean: -2, inst: { note: 1 }, fx: { puff: 1 }, expr: 'blink' },
        { ...STAND, lean: -3, inst: { note: 2, bellY: -1 }, fx: { puff: 1 }, expr: 'blink' },
        { ...STAND, expr: 'happy' },
        { ...STAND, inst: { bellY: -2 }, dy: -2, grounded: false, expr: 'panic' },
        { ...STAND, expr: 'blink' },
      ],
      post: (fs) => fs.map((f, i) => (i === 4 && f.pts?.head ? stamp(f, markArt('!'), f.pts.head[0] + 6, f.pts.head[1] - 14) : f)),
      opts: { durations: [24, 14, 14, 20, 12, 30] },
    },
    die: {
      // The tuba blows him backwards off his feet in a spin, then he lands on his back.
      poses: [
        { ...STAND, lean: -18, armN: A(120, 30, 'open'), armF: A(150, 20, 'open'), expr: 'panic' },
        { legN: L(60, 40), legF: L(30, 60), armN: A(150, 30, 'open'), armF: A(170, 20, 'open'), rot: -70, grounded: false, expr: 'hurt' },
        { legN: L(80, 60), legF: L(40, 80), armN: A(140, 40, 'open'), armF: A(190, 20, 'open'), rot: -160, grounded: false, expr: 'hurt' },
        { legN: L(60, 40), legF: L(20, 50), armN: A(160, 20, 'open'), armF: A(180, 10, 'open'), rot: -250, grounded: false, expr: 'dazed' },
        { legN: L(70, 50), legF: L(40, 60), armN: A(150, 30, 'open'), armF: A(170, 30, 'open'), rot: -90, dy: -2, expr: 'dazed' },
        { legN: L(40, 20), legF: L(20, 30), armN: A(170, 10, 'open'), armF: A(190, 10, 'open'), rot: -90, expr: 'dazed' },
      ],
      style: hatless,
      opts: { durations: [5, 5, 5, 6, 8, 30], loop: false },
    },
    'die-blast': {
      poses: [
        { legN: L(30, 60), legF: L(-30, 70), armN: A(150, 20, 'open'), armF: A(170, 20, 'open'), rot: -30, grounded: false, inst: { crumple: true }, expr: 'soot' },
        { legN: L(70, 90), legF: L(10, 100), armN: A(140, 40, 'open'), armF: A(200, 30, 'open'), rot: -120, grounded: false, inst: { crumple: true }, expr: 'soot' },
        { legN: L(40, 60), legF: L(-20, 60), armN: A(170, 10, 'open'), armF: A(150, 40, 'open'), rot: -210, grounded: false, inst: { crumple: true }, expr: 'soot' },
        { legN: L(30, 60), legF: L(-20, 30), armN: A(150, 10, 'open'), armF: A(200, 10, 'open'), rot: 180, inst: { crumple: true }, expr: 'soot' },
        { legN: L(-10, 30), legF: L(26, 70), armN: A(160, 10, 'open'), armF: A(190, 10, 'open'), rot: 176, inst: { crumple: true }, expr: 'soot' },
        { legN: L(30, 60), legF: L(-20, 30), armN: A(150, 10, 'open'), armF: A(200, 10, 'open'), rot: 180, inst: { crumple: true }, expr: 'soot' },
        { legN: L(-10, 30), legF: L(26, 70), armN: A(160, 10, 'open'), armF: A(190, 10, 'open'), rot: 176, inst: { crumple: true }, expr: 'soot' },
      ],
      style: frazzled,
      post: (fs) => fs.map((f) => scorch(f, 2)),
      opts: { durations: [5, 5, 6, 7, 7, 7, 7], loop: false },
    },
  };
}

let table: Strips | null = null;

/** Every oompah strip (common set + his own); built once, rendered per look. */
export function oompahTable(): Strips {
  if (!table) {
    table = { ...commonStrips(OOMPAH_ART), ...oompahStrips() };
    table.gag = table['gag-polish'];
  }
  return table;
}

/** Register one look (`enemy/oompah-trooper…`). */
export function defineOompahLook(prefix: string, outfit: Outfit, skin: Skin): void {
  if (skin !== 'a') {
    const base = ensureLook('oompah-trooper', outfit, 'a');
    if (base) return defineSkinVariant(prefix, base, oompahTable(), skin);
  }
  defineStrips(prefix, oompahStyle(outfit), OOMPAH_ART, oompahTable());
}

registerLookDefiner('oompah-trooper', defineOompahLook);
