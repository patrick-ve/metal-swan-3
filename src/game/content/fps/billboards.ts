/**
 * The first-person mode's actor billboards (docs/design/fps.md §8.2): guard, officer, SS, dog,
 * MechaHitler (the suit "Mecha Hofmans" with the user's face, and on foot), the wreck, blood.
 *
 * Built with the 3D joint rig (src/game/art/figure3d.ts): yaws 0–4 are rendered, the engine
 * mirrors 5–7. Our own 1940s uniforms (no armbands, no symbols on uniforms, spec §0); blood is
 * classic red (this mode only), PAL.red[0..2] only. Never traced from the reference game.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL, type Ramp } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { defineRayBillboard } from '../../../engine/ray';
import {
  add,
  Figure,
  ik,
  IDENT,
  lerp3,
  lookAlong,
  mulMM,
  norm3,
  renderFigure,
  rotX,

  rotY,
  rotZ,
  sub,
  type M3,
  type Mat,
  type Projector,
  type V3,
} from '../../art/figure3d';
import { hash2 } from '../../art/paint';
import { face27, face34, MECHA_FACE_KEY, type MechaFaceImage } from './art/mecha-face.gen';

// ------------------------------------------------------------------------------------ materials

const m = (ramp: Ramp, bias = 0, line?: Color): Mat => ({ ramp, bias, line });

export const MAT = {
  skin: m(PAL.skinA),
  skinSoot: m([PAL.stone[0], PAL.brown[1], PAL.rust[1], PAL.skinA[1]]),
  field: m([PAL.olive[0], PAL.olive[1], PAL.stone[1], PAL.stone[2]], 0, PAL.ink[1]),
  fieldDark: m([PAL.ink[1], PAL.olive[0], PAL.olive[1], PAL.stone[1]], 0, INK),
  officer: m([PAL.ink[1], PAL.olive[0], PAL.olive[1], PAL.olive[2]], -0.15, INK),
  black: m(PAL.black, 0.2, INK),
  blackCoat: m([PAL.ink[0], PAL.ink[1], PAL.hairA[2], PAL.steel[1]], 0.3, INK),
  helmet: m([PAL.ink[0], PAL.steel[0], PAL.steel[1], PAL.steel[2]], 0.2, INK),
  glove: m(PAL.cloth, 0.2),
  leather: m([PAL.brown[0], PAL.brown[1], PAL.brown[2]]),
  wood: m([PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]]),
  rifleWood: m([PAL.brown[1], PAL.brown[2], PAL.brown[3], PAL.sand[2]], 0.4, PAL.brown[0]),
  gun: m([PAL.ink[0], PAL.steel[0], PAL.steel[1], PAL.steel[2]], 0.2, INK),
  gunLit: m([PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4]], 0.2, INK),
  brass: m(PAL.brass),
  silver: m([PAL.steel[2], PAL.steel[3], PAL.steel[4]]),
  hairBrown: m([PAL.brown[0], PAL.brown[1], PAL.brown[2]]),
  hairBlack: m([PAL.ink[0], PAL.ink[1], PAL.hairA[2]]),
  breeches: m([PAL.ink[1], PAL.olive[0], PAL.olive[1], PAL.stone[1]]),
  red: m([PAL.red[0], PAL.red[1], PAL.red[2]]),
  tan: m([PAL.brown[1], PAL.brown[2], PAL.brown[3], PAL.sand[2]]),
  dogDark: m([PAL.ink[0], PAL.ink[1], PAL.brown[0], PAL.brown[1]], 0.2),
  dogLight: m([PAL.brown[2], PAL.brown[3], PAL.sand[2], PAL.sand[3]], 0.2),
  bossCoat: m([PAL.ink[1], PAL.olive[0], PAL.olive[1], PAL.stone[1], PAL.stone[2]], 0, INK),
  glass: m([PAL.steel[2], PAL.sky[2], PAL.sky[3], PAL.snow[2]], 0.3, PAL.steel[1]),
  soot: m([PAL.ink[0], PAL.ink[1], PAL.stone[0]]),
} as const;

// ------------------------------------------------------------------------------------ soldiers

export type SoldierKind = 'guard' | 'officer' | 'ss' | 'boss';

interface SoldierStyle {
  coat: Mat;
  coatLong: boolean;
  trousers: Mat;
  hands: Mat;
  hair: Mat;
  hat: 'cap' | 'peaked' | 'helmet' | 'none';
  hatMat: Mat;
  weapon: 'rifle' | 'pistol' | 'smg' | 'dual';
  /** Shoulder half-width. */
  shoulders: number;
}

const STYLES: Readonly<Record<SoldierKind, SoldierStyle>> = {
  guard: { coat: MAT.field, coatLong: false, trousers: MAT.field, hands: MAT.skin, hair: MAT.hairBrown, hat: 'cap', hatMat: MAT.field, weapon: 'rifle', shoulders: 6.6 },
  officer: { coat: MAT.officer, coatLong: true, trousers: MAT.breeches, hands: MAT.glove, hair: MAT.hairBrown, hat: 'peaked', hatMat: MAT.officer, weapon: 'pistol', shoulders: 6.8 },
  boss: { coat: MAT.bossCoat, coatLong: true, trousers: MAT.bossCoat, hands: MAT.black, hair: MAT.hairBlack, hat: 'none', hatMat: MAT.bossCoat, weapon: 'dual', shoulders: 7 },
  ss: { coat: MAT.blackCoat, coatLong: true, trousers: MAT.blackCoat, hands: MAT.black, hair: MAT.hairBlack, hat: 'helmet', hatMat: MAT.helmet, weapon: 'smg', shoulders: 7.2 },
};

/** A soldier pose (all angles in radians). */
export interface SoldierPose {
  /** Walk phase 0..1 (−1 = standing). */
  walk: number;
  /** 0 = rest, 1 = aimed at the viewer. */
  aim: number;
  /** Torso lean back (+) / forward (−). */
  lean: number;
  /** Knee bend added to both legs (crouch / collapse), and the hips drop with it. */
  crouch: number;
  /** Head tilt sideways. */
  headRoll: number;
  /** Arms thrown out (pain / death), 0..1. */
  flail: number;
  /** Whole-body fall sideways 0..1 (1 = lying on the floor). */
  fall: number;
  /** Blood: 0 none, 1 spurt, 2 more, 3 pool small, 4 pool large. */
  blood: number;
  /** Muzzle flash. */
  flash: boolean;
  /** The tell: a bright glint on the aimed barrel's tip. */
  glint?: boolean;
}

export const POSE0: SoldierPose = { walk: -1, aim: 0, lean: 0, crouch: 0, headRoll: 0, flail: 0, fall: 0, blood: 0, flash: false };

const HIP_Y = 27;
const THIGH = 13;
const SHIN = 12.5;
const UPPER = 9;
const FORE = 8.5;

/** Leg joints for a hip at `hip`, thigh swing `a` (+ forward), knee bend `k`. */
function leg(hip: V3, a: number, k: number): [V3, V3] {
  const knee = add(hip, [0, -Math.cos(a) * THIGH, Math.sin(a) * THIGH]);
  const sa = a - k;
  const ankle = add(knee, [0, -Math.cos(sa) * SHIN, Math.sin(sa) * SHIN]);
  return [knee, ankle];
}

/** Build a soldier figure. */
export function soldier(kind: SoldierKind, p: SoldierPose): Figure {
  const st = STYLES[kind];
  const f = new Figure();
  const walking = p.walk >= 0;
  const ph = walking ? p.walk * Math.PI * 2 : 0;
  const swing = walking ? Math.sin(ph) * 0.42 : 0;
  const bob = walking ? Math.abs(Math.cos(ph)) * 1.0 - 0.5 : 0;
  // crouch lowers the hips so the feet stay on the floor
  const kb = p.crouch;
  const drop = THIGH * (1 - Math.cos(kb * 0.5)) + SHIN * (1 - Math.cos(kb * 0.5)) + kb * 4;
  const hipY = HIP_Y + bob - drop;
  const pelvis: V3 = [0, hipY + 1, 0];
  // torso pivots at the pelvis
  // walking: the shoulders dip over the planted foot (reads in the front and back yaws)
  const roll = walking ? Math.cos(ph) * 0.09 : 0;
  const tor: M3 = mulMM(rotX(-p.lean), rotZ(p.headRoll * 0.3 + roll));
  const T = (v: V3): V3 => add(pelvis, rotate(tor, v));
  const neck = T([0, 17.5, 0.3]);
  const headC = T([0, 22.5, 0.6]);
  const shL = T([st.shoulders, 15.5, 0]); // the figure's right is +x
  const shR = T([-st.shoulders, 15.5, 0]);

  // ---- legs
  for (const side of [1, -1]) {
    const s = walking ? swing * side : 0;
    // the knee bends while the leg swings forward (the passing pose), straight at contact
    const bend = (walking ? 0.1 + 1.1 * Math.max(0, Math.cos(ph) * side) : 0.05) + kb;
    const hip: V3 = [side * 3.1, hipY, 0];
    const a = s + kb * 0.5;
    const [knee, ankle] = leg(hip, a, bend);
    f.cap(hip, knee, 3.0, 2.5, st.trousers);
    // jackboots to below the knee
    const bootTop = lerp3(knee, ankle, 0.25);
    f.cap(knee, bootTop, 2.5, 2.4, st.trousers);
    const footDir = norm3([0, -0.15, 1]);
    if (kind === 'boss' && side < 0) {
      // the boot lost in the wreck: a grey sock and a bare ankle
      f.cap(bootTop, ankle, 2.1, 1.8, MAT.bossCoat);
      f.box(add(ankle, [0, -1.0, 1.4]), [1.5, 1.1, 2.6], MAT.glove, lookAlong(footDir));
    } else {
      f.cap(bootTop, ankle, 2.45, 2.2, MAT.black);
      f.box(add(ankle, [0, -1.0, 1.6]), [1.8, 1.25, 3.0], MAT.black, lookAlong(footDir));
    }
  }

  // ---- torso
  if (st.coatLong) {
    // a coat skirt flaring to the knees
    const hem = kind === 'boss' ? -12 : -8.5;
    f.cap(T([0, 4, 0]), T([0, hem, 0.2]), 5.4, kind === 'boss' ? 5.9 : 6.4, st.coat);
    if (kind === 'boss') {
      // the scorched hem: a few soot marks along the bottom of the greatcoat
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        f.dot(T([Math.sin(a) * 5.8, hem + 0.6 + (k % 3) * 0.6, Math.cos(a) * 5.8]), k % 2 ? INK : PAL.stone[0], 1, 1.5);
      }
    }
  } else {
    f.ell(T([0, 1.5, 0]), [5.6, 4.0, 4.3], st.coat, tor);
  }
  f.ell(T([0, 9.5, 0.2]), [6.4, 8.2, 4.4], st.coat, tor);
  // belt and cross strap, buckle
  f.ell(T([0, 4.2, 0.1]), [5.9, 1.05, 4.5], MAT.black, tor);
  f.dot(T([0, 4.2, 4.6]), PAL.steel[3], 2);
  // pouches on the belt
  for (const sx of [2.8, -2.8]) f.box(T([sx, 4.4, 4.0]), [1.3, 1.5, 0.8], st.weapon === 'pistol' ? MAT.black : MAT.leather, tor);
  // buttons
  for (let k = 0; k < 4; k++) f.dot(T([0, 7.5 + k * 2.4, 4.4]), kind === 'ss' ? PAL.steel[2] : kind === 'boss' ? PAL.brass[2] : PAL.stone[2], 1, 1.2);
  // collar tabs
  f.ell(neck, [2.8, 1.4, 2.6], st.coat, tor);
  f.dot(T([1.6, 17, 2.5]), kind === 'ss' ? PAL.stone[2] : PAL.olive[3], 1);
  f.dot(T([-1.6, 17, 2.5]), kind === 'ss' ? PAL.stone[2] : PAL.olive[3], 1);
  // shoulder boards
  for (const sh of [shL, shR]) f.ell(add(sh, [0, 1.0, 0]), [2.6, 1.3, 2.4], kind === 'officer' ? MAT.silver : st.coat, tor);

  // ---- head
  const H = mulMM(tor, rotZ(p.headRoll));
  const hd = (v: V3): V3 => add(headC, rotate(H, v));
  f.cap(neck, hd([0, -2.5, -0.2]), 1.9, 1.9, MAT.skin);
  f.ell(hd([0, 0, 0]), [3.7, 4.3, 3.9], MAT.skin, H);
  f.ball(hd([3.7, 0, -0.2]), 1.1, MAT.skin);
  f.ball(hd([-3.7, 0, -0.2]), 1.1, MAT.skin);
  f.ball(hd([0, -0.4, 3.9]), 0.95, MAT.skin);
  // hair at the back and sides
  f.ell(hd([0, 1.3, -1.0]), [3.9, 3.4, 3.4], st.hair, H);
  // eyes, brows, mouth
  const dead = p.fall > 0.6;
  const eyeC = dead ? PAL.brown[0] : INK;
  f.dot(hd([1.5, 0.4, 3.6]), eyeC, 1, 1);
  f.dot(hd([-1.5, 0.4, 3.6]), eyeC, 1, 1);
  f.dot(hd([1.4, 1.5, 3.6]), st.hair.ramp[0], 1, 1);
  f.dot(hd([-1.4, 1.5, 3.6]), st.hair.ramp[0], 1, 1);
  f.dot(hd([0, -2.2, 3.5]), p.flail > 0.3 ? INK : PAL.rust[1], 1, 1);
  if (kind === 'ss' || kind === 'officer') f.dot(hd([0.6, -2.2, 3.5]), PAL.rust[1], 1, 1);
  // headgear
  if (st.hat === 'cap') {
    // field cap with a short peak
    f.ell(hd([0, 3.5, -0.2]), [4.2, 2.1, 4.4], st.hatMat, H);
    f.box(hd([0, 3.0, 4.0]), [3.4, 0.45, 1.5], MAT.fieldDark, mulMM(H, rotX(-0.25)));
    f.dot(hd([0, 4.3, 4.0]), PAL.stone[2], 1);
  } else if (st.hat === 'peaked') {
    f.ell(hd([0, 3.4, 0]), [4.2, 1.6, 4.3], MAT.fieldDark, H);
    f.ell(hd([0, 5.0, 0.2]), [5.3, 1.6, 5.4], st.hatMat, mulMM(H, rotX(0.18)));
    f.box(hd([0, 2.6, 4.4]), [3.6, 0.5, 1.7], MAT.black, mulMM(H, rotX(-0.3)));
    f.dot(hd([0, 4.6, 4.8]), PAL.steel[4], 2); // a plain oval cap badge
    f.dot(hd([0, 3.4, 4.5]), PAL.cloth[2], 1); // piping
  } else if (st.hat === 'none') {
    // our caricature: black hair parted on the side, a forelock, a small moustache, soot
    f.ell(hd([0.6, 2.6, -0.2]), [4.1, 2.4, 4.2], st.hair, H);
    f.cap(hd([-2.0, 3.5, 3.0]), hd([1.8, 1.4, 3.7]), 1.0, 0.7, st.hair);
    f.dot(hd([0, -1.4, 3.95]), INK, 2, 1);
    // soot: two thin streaks on one cheek and the brow (not a block: that read as an eye patch)
    f.cap(hd([2.4, -0.6, 3.5]), hd([2.9, -2.4, 3.1]), 0.32, 0.25, MAT.soot);
    f.cap(hd([-0.8, 2.3, 3.7]), hd([-2.6, 2.0, 3.4]), 0.3, 0.25, MAT.soot);
  } else {
    // steel helmet with the flared skirt
    f.ell(hd([0, 3.4, -0.4]), [4.7, 3.5, 4.9], st.hatMat, H);
    f.ell(hd([0, 1.9, -1.2]), [5.1, 1.3, 5.0], st.hatMat, mulMM(H, rotX(0.35)));
    f.dot(hd([0, 2.6, 4.4]), PAL.ink[1], 1, 1);
  }

  // ---- arms and weapon
  const aim = p.aim;
  const fl = p.flail;
  const flailOut = (sh: V3, side: number): V3 => add(sh, [side * 9, -4 + 4 * fl, -3]);
  let muzzle: V3 | null = null;
  if (st.weapon === 'rifle') {
    // rest: rifle carried at low ready across the body; aim: at the right shoulder, the barrel
    // angled across toward the viewer's left so the long gun stays visible (a tell that reads)
    const butt = lerp3(T([-4.5, 2.5, 4.0]), T([-4.0, 14.0, 2.0]), aim);
    const tip = lerp3(T([5.5, 21, 9]), T([10.5, 16.5, 19]), aim);
    const dir = norm3(sub(tip, butt));
    const rot = lookAlong(dir);
    const len = Math.hypot(...sub(tip, butt));
    const at = (t: number): V3 => lerp3(butt, tip, t);
    if (fl < 0.5) {
      f.box(at(0.2), [1.1, 1.9, len * 0.2], MAT.rifleWood, rot);
      f.box(at(0.52), [1.0, 1.2, len * 0.16], MAT.rifleWood, rot);
      // the barrel in bright steel when aimed (the tell and the shot read at range)
      f.box(at(0.74), [0.8, 0.8, len * 0.34], aim > 0.5 ? MAT.gunLit : MAT.gun, rot);
      f.box(at(0.4), [1.3, 0.8, 0.8], MAT.gun, rot); // bolt
      f.dot(tip, INK, 1, 3);
      const handR = at(0.3);
      const handL = at(0.62);
      armTo(f, shR, handR, st, [-1, -1, -1]);
      armTo(f, shL, handL, st, [1, -1, 0]);
      muzzle = tip;
    } else {
      armTo(f, shR, flailOut(shR, -1), st, [0, -1, 0]);
      armTo(f, shL, flailOut(shL, 1), st, [0, -1, 0]);
    }
  } else if (st.weapon === 'pistol') {
    const hand = lerp3(T([-6.8, 2.5, 2.5]), T([-7.5, 14.5, 11]), aim);
    if (fl < 0.5) {
      armTo(f, shR, hand, st, [-1, -0.5, -1]);
      const dir = aim > 0.5 ? norm3([0.75, 0.05, 1]) : norm3([0, -0.7, 0.7]);
      f.box(add(hand, mul3(dir, 2.4)), [0.7, 1.1, 2.6], aim > 0.5 ? MAT.gunLit : MAT.gun, lookAlong(dir));
      muzzle = add(hand, mul3(dir, 5));
      // the free arm swings while walking, rests on the hip otherwise
      const sw = walking ? -swing * 4 : 0;
      armTo(f, shL, aim > 0.5 ? T([7.8, 5, 1.5]) : T([7.5, 0, 1 + sw]), st, [1, 0, -1]);
    } else {
      armTo(f, shR, flailOut(shR, -1), st, [0, -1, 0]);
      armTo(f, shL, flailOut(shL, 1), st, [0, -1, 0]);
    }
  } else if (st.weapon === 'dual') {
    // a chaingun in each hand on a leather harness (crossed straps)
    f.box(T([0, 10, 4.3]), [0.8, 7.5, 0.4], MAT.leather, mulMM(tor, rotZ(0.55)));
    f.box(T([0, 10, 4.35]), [0.8, 7.5, 0.4], MAT.leather, mulMM(tor, rotZ(-0.55)));
    const muzzles: V3[] = [];
    for (const side of [1, -1]) {
      const sh = side > 0 ? shL : shR;
      if (fl >= 0.5) {
        armTo(f, sh, flailOut(sh, side), st, [0, -1, 0]);
        continue;
      }
      const grip = lerp3(T([side * 7, 2, 5]), T([side * 6, 9.5, 7]), aim);
      // forward, outward and a little down (aimed: level): seen from the front the two bright
      // barrels splay out at hip level, so he reads as armed at any range
      const dir = norm3([side * 0.55, aim > 0.5 ? -0.05 : -0.3, 1]);
      const rot = lookAlong(dir);
      armTo(f, sh, grip, st, [side, -1, -1]);
      f.box(add(grip, mul3(dir, 1.5)), [1.7, 1.8, 3.4], MAT.gun, rot);
      f.cap(add(grip, mul3(dir, 3)), add(grip, mul3(dir, 11.5)), 1.5, 1.35, MAT.gunLit);
      f.dot(add(grip, mul3(dir, 11.8)), PAL.gold[2], 2, 3); // brass muzzle ring
      f.box(add(grip, [0, -2.4, 0.5]), [1.4, 1.3, 1.9], MAT.brass, rot); // ammo box
      muzzles.push(add(grip, mul3(dir, 12.5)));
    }
    if (p.flash) for (const mz of muzzles) f.overlay((b, pr) => muzzleFlash(b, pr, mz, 5));
    if (p.glint) for (const mz of muzzles) f.overlay((b, pr) => glintAt(b, pr, mz));
  } else {
    // SMG held at the hip; aim raises it to the chest
    const back = lerp3(T([-2.5, 7, 4]), T([-4.0, 11.0, 4]), aim);
    const tip = lerp3(T([1.5, 6.5, 14]), T([8.5, 12.5, 14]), aim);
    const dir = norm3(sub(tip, back));
    const rot = lookAlong(dir);
    const len = Math.hypot(...sub(tip, back));
    const at = (t: number): V3 => lerp3(back, tip, t);
    if (fl < 0.5) {
      f.box(at(0.45), [0.9, 1.1, len * 0.45], aim > 0.5 ? MAT.gunLit : MAT.gun, rot);
      f.box(add(at(0.42), rotate(rot, [0, -2.2, 0])), [0.5, 1.8, 0.6], MAT.gun, rot); // magazine
      f.box(at(0.08), [0.4, 0.9, len * 0.12], MAT.gun, rot); // folded stock
      armTo(f, shR, at(0.25), st, [-1, -1, -1]);
      armTo(f, shL, at(0.7), st, [1, -1, 0]);
      muzzle = tip;
    } else {
      armTo(f, shR, flailOut(shR, -1), st, [0, -1, 0]);
      armTo(f, shL, flailOut(shL, 1), st, [0, -1, 0]);
    }
  }

  // the broken glass-dome collar of the suit, still around his neck
  if (kind === 'boss') {
    f.ell(T([0, 17.2, 0]), [4.2, 0.9, 4.0], MAT.glass, tor);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const base = T([Math.sin(a) * 3.9, 17.5, Math.cos(a) * 3.7]);
      f.cap(base, add(base, [Math.sin(a) * 0.6, 2 + (k % 3), Math.cos(a) * 0.6]), 0.7, 0.15, MAT.glass);
    }
  }

  // ---- blood (front of the chest)
  if (p.blood >= 1) {
    const spots: V3[] = [[1.5, 10, 4.6], [-1, 11.5, 4.6], [0.5, 8.5, 4.7], [2.5, 12, 4.3], [-2, 9, 4.5]];
    const n = Math.min(spots.length, 1 + p.blood);
    for (let i = 0; i < n; i++) f.dot(T(spots[i]), i === 0 ? PAL.red[2] : PAL.red[1], i < 2 ? 2 : 1, 1.5);
  }
  if (p.flash && muzzle) {
    const mz = muzzle;
    f.overlay((b, pr) => muzzleFlash(b, pr, mz, kind === 'officer' ? 5 : 6.5));
  } else if (p.glint && muzzle) {
    const mz = muzzle;
    f.overlay((b, pr) => glintAt(b, pr, mz));
  }
  return f;
}

function mul3(v: V3, s: number): V3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function rotate(mm: M3, v: V3): V3 {
  return [mm[0] * v[0] + mm[1] * v[1] + mm[2] * v[2], mm[3] * v[0] + mm[4] * v[1] + mm[5] * v[2], mm[6] * v[0] + mm[7] * v[1] + mm[8] * v[2]];
}

function armTo(f: Figure, sh: V3, hand: V3, st: SoldierStyle, pole: V3): void {
  const el = ik(sh, hand, UPPER, FORE, pole);
  f.cap(sh, el, 2.3, 2.0, st.coat);
  f.cap(el, lerp3(el, hand, 0.82), 2.0, 1.8, st.coat);
  f.ball(hand, 1.55, st.hands);
}

/**
 * A muzzle flash at a body-space point: a filled 8-point bloom (white core, gold, orange tips) of
 * radius `r` texels, so a shot reads at range (polish-fix: the thin 1-px star did not).
 */
export function muzzleFlash(b: PixelBuffer, pr: Projector, at: V3, r = 6): void {
  const [x, y] = pr.p(at);
  const cx = Math.round(x);
  const cy = Math.round(y);
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || py < 0 || px >= b.w || py >= b.h) continue;
      const d = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      const rr = r * (0.5 + 0.5 * Math.abs(Math.cos(th * 4)) ** 3);
      if (d > rr) continue;
      const k = d / rr;
      b.data[py * b.w + px] = d <= Math.max(1, r * 0.22) ? PAL.snow[3] : k < 0.5 ? PAL.gold[3] : k < 0.8 ? PAL.gold[2] : PAL.orange[1];
    }
  }
}

/** A bright glint (a 2 × 2 white core with short gold rays: the aimed barrel's tip in the tell). */
export function glintAt(b: PixelBuffer, pr: Projector, at: V3): void {
  const [x, y] = pr.p(at);
  const cx = Math.round(x);
  const cy = Math.round(y);
  const pts: ReadonlyArray<readonly [number, number, Color]> = [
    [0, 0, PAL.snow[3]], [1, 0, PAL.snow[3]], [0, 1, PAL.snow[3]], [1, 1, PAL.snow[3]],
    [-1, 0, PAL.gold[3]], [2, 1, PAL.gold[3]], [1, -1, PAL.gold[3]], [0, 2, PAL.gold[3]],
    [-2, 0, PAL.gold[2]], [3, 1, PAL.gold[2]], [1, -2, PAL.gold[2]], [0, 3, PAL.gold[2]],
  ];
  for (const [dx, dy, c] of pts) {
    const px = cx + dx;
    const py = cy + dy;
    if (px >= 0 && py >= 0 && px < b.w && py < b.h) b.data[py * b.w + px] = c;
  }
}

/** A blood pool on the floor (an irregular ellipse in the bottom rows), size 0..1. */
export function bloodPool(b: PixelBuffer, cx: number, groundY: number, size: number, seed: number): void {
  const rx = 6 + size * 16;
  const ry = 1.5 + size * 3;
  for (let y = Math.floor(groundY - ry); y <= groundY + 1; y++) {
    for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
      const wob = 1 + (hash2(x >> 1, 0, seed) - 0.5) * 0.35;
      const ex = (x + 0.5 - cx) / (rx * wob);
      const ey = (y + 0.5 - (groundY - ry * 0.4)) / ry;
      const d = ex * ex + ey * ey;
      if (d > 1) continue;
      const i = y * b.w + x;
      if ((b.data[i] & 255) !== 0 && d > 0.25) continue; // stays under the body
      b.data[i] = d < 0.35 ? PAL.red[1] : d > 0.8 ? PAL.red[0] : (x + y) & 1 ? PAL.red[1] : PAL.red[0];
      if (d < 0.1 && ((x * 7 + y) & 3) === 0) b.data[i] = PAL.red[2];
    }
  }
}

/** Blood drops flying from a point (die frames). */
function spray(b: PixelBuffer, x: number, y: number, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const a = hash2(i, 1, seed) * Math.PI * 2;
    const d = 2 + hash2(i, 2, seed) * 7;
    const px = Math.round(x + Math.cos(a) * d);
    const py = Math.round(y + Math.sin(a) * d * 0.7);
    if (px < 0 || py < 0 || px >= b.w || py >= b.h) continue;
    b.data[py * b.w + px] = i % 3 === 0 ? PAL.red[2] : PAL.red[1];
  }
}

const SIZE = 64;
const GROUND = SIZE - 2;
/** A person stands about 56 of the 64 texels (0.88 of a wall). */
const FIG_SCALE = 1.1;

/** Render a soldier frame; `fall` lays the body on its side (toward screen left). */
function soldierFrame(kind: SoldierKind, p: SoldierPose, yaw: number): PixelBuffer {
  const fig = soldier(kind, p);
  let pose: M3 = IDENT;
  let offset: V3 = [0, 0, 0];
  if (p.fall > 0) {
    // fall to the figure's left (screen right when facing the viewer), pivot at the feet
    const a = p.fall * Math.PI * 0.5;
    // the lying body turns a little away from the viewer so it fits the billboard
    pose = mulMM(rotY(0.75 * p.fall), mulMM(rotZ(-a), rotX(-0.25 * p.fall)));
    offset = [-p.fall * 22, p.fall * 3.5, 0];
  }
  const b = renderFigure(fig, { size: SIZE, yaw, pose, offset, ground: GROUND, cx: SIZE / 2, scale: FIG_SCALE });
  if (p.blood >= 3) bloodPool(b, SIZE / 2 + 2, GROUND, p.blood >= 4 ? 1 : 0.45, 11);
  if (p.blood === 2 && p.fall < 0.5) spray(b, SIZE / 2 + 1, 24, 10, 5);
  return b.touch();
}

/** The `act` frames (§8.2): tell, shoot, pain, die 1–4, dead. */
export function soldierActPose(frame: number): SoldierPose {
  switch (frame) {
    case 0:
      return { ...POSE0, aim: 1, glint: true };
    case 1:
      return { ...POSE0, aim: 1, flash: true, lean: 0.06 };
    case 2:
      return { ...POSE0, aim: 0.3, lean: 0.25, headRoll: 0.25, blood: 1 };
    case 3:
      return { ...POSE0, aim: 0.2, lean: 0.35, headRoll: -0.3, flail: 0.6, blood: 2, crouch: 0.2 };
    case 4:
      return { ...POSE0, lean: 0.1, headRoll: 0.4, flail: 0.8, blood: 2, crouch: 0.9 };
    case 5:
      return { ...POSE0, flail: 1, blood: 3, crouch: 0.7, fall: 0.55, headRoll: 0.3 };
    case 6:
      return { ...POSE0, flail: 1, blood: 3, crouch: 0.2, fall: 0.92 };
    default:
      return { ...POSE0, flail: 1, blood: 4, fall: 1 };
  }
}

for (const kind of ['guard', 'officer', 'ss'] as const) {
  defineRayBillboard(`fps/${kind}/move`, {
    yaws: 8,
    frames: 5,
    gen: (frame, yaw) => soldierFrame(kind, frame === 0 ? POSE0 : { ...POSE0, walk: (frame - 1) / 4 }, yaw),
  });
  defineRayBillboard(`fps/${kind}/act`, {
    yaws: 1,
    frames: 8,
    gen: (frame) => soldierFrame(kind, soldierActPose(frame), 0),
  });
}

// ------------------------------------------------------------------------------------ dog

interface DogPose {
  run: number; // −1 = stand
  crouch: number;
  bite: number;
  jaw: number;
  fall: number;
  blood: number;
}
const DOG0: DogPose = { run: -1, crouch: 0, bite: 0, jaw: 0, fall: 0, blood: 0 };

export function dog(p: DogPose): Figure {
  const f = new Figure();
  const running = p.run >= 0;
  const ph = running ? p.run * Math.PI * 2 : 0;
  const lift = running ? Math.abs(Math.sin(ph)) * 1.5 : 0;
  // the head bobs twice per stride (reads as a run even head-on)
  const nod = running ? Math.sin(ph * 2) * 1.1 : 0;
  const lunge = p.bite * 4;
  const cy = 13 - p.crouch * 3 + lift;
  const C = (v: V3): V3 => [v[0], v[1] + cy - 13, v[2] + lunge];
  const tan = MAT.tan;
  const dark = MAT.dogDark;
  // body + chest + saddle
  f.ell(C([0, 13, -1]), [3.6, 3.9, 8.5], tan);
  f.ell(C([0, 14, 5]), [5.0, 4.9, 4.4], tan);
  // a pale chest blaze (the front view reads as a chest, not a pillar)
  f.ell(C([0, 13.2, 8.6]), [2.4, 3.0, 1.2], MAT.dogLight);
  f.ell(C([0, 15.3, -1.5]), [3.7, 3.0, 7.4], dark);
  // neck + head
  const headDrop = p.crouch * 4 - p.bite * 1;
  const neckTop = C([0, 20.5 - headDrop + nod, 9.5]);
  f.cap(C([0, 15.5, 7]), neckTop, 2.9, 2.4, tan);
  const hc = add(neckTop, [0, 1, 1.5]);
  f.ell(hc, [2.9, 2.8, 3.2], tan);
  f.ell(add(hc, [0, 1.3, -0.8]), [2.6, 1.8, 2.5], dark);
  // muzzle (upper) and jaw (lower, opens)
  f.cap(add(hc, [0, -0.3, 2.2]), add(hc, [0, -0.6, 6.2]), 1.6, 1.15, tan);
  const jawA = p.jaw * 0.7;
  f.cap(add(hc, [0, -1.6, 2.0]), add(hc, [0, -1.6 - Math.sin(jawA) * 3.5, 2.0 + Math.cos(jawA) * 3.5]), 1.0, 0.75, dark);
  f.dot(add(hc, [0, -0.3, 7.3]), INK, 1, 1);
  if (p.jaw > 0.3) {
    f.dot(add(hc, [0.6, -1.4, 4.6]), PAL.snow[2], 1, 2);
    f.dot(add(hc, [-0.6, -1.4, 4.6]), PAL.snow[2], 1, 2);
    f.dot(add(hc, [0, -1.9, 4.0]), PAL.red[2], 1, 2);
  }
  // eyes + ears (flat back when crouching)
  const eyeC = p.fall > 0.5 ? PAL.brown[0] : p.crouch > 0.3 || p.bite > 0 ? PAL.gold[2] : INK;
  f.dot(add(hc, [1.5, 0.8, 2.6]), eyeC, 1, 1);
  f.dot(add(hc, [-1.5, 0.8, 2.6]), eyeC, 1, 1);
  const earBack = p.crouch > 0.3 ? -2.5 : 0;
  for (const s of [1, -1]) f.cap(add(hc, [s * 1.7, 2.0, -0.8]), add(hc, [s * 2.4, 6.3, -1.2 + earBack]), 1.15, 0.3, dark);
  // collar
  f.ell(C([0, 17.6, 8.2]), [2.9, 0.8, 2.7], MAT.leather, rotX(0.6));
  // legs
  const legPair = (z: number, phase: number, back: boolean): void => {
    for (const s of [1, -1]) {
      const swing = running ? Math.sin(ph + phase + (s > 0 ? 0 : 0.6)) * 0.55 : 0;
      const top = C([s * (back ? 2.4 : 2.9), 12, z]);
      const kneeY = 6.5;
      const knee: V3 = add(top, [0, kneeY - 12 + p.crouch * 2, (back ? -1.5 : 0.5) + Math.sin(swing) * 5.5]);
      const paw: V3 = [top[0], 1.0 + Math.max(0, Math.cos(ph + phase + (s > 0 ? 0 : Math.PI))) * 3, knee[2] + (back ? 1.2 : 0.3) + Math.sin(swing) * 4];
      f.cap(top, knee, back ? 2.2 : 1.7, 1.4, tan);
      f.cap(knee, paw, 1.3, 1.1, tan);
      f.box(add(paw, [0, -0.2, 1.0]), [1.2, 0.8, 1.6], tan);
    }
  };
  legPair(5.5, 0, false);
  legPair(-6.5, Math.PI, true);
  // tail
  const wag = running ? Math.sin(ph * 2) * 1.5 : 0;
  f.cap(C([0, 14.5, -8.5]), C([wag, 10.5 - p.crouch * 2, -14]), 1.4, 0.8, dark);
  if (p.blood > 0) {
    f.dot(C([1.5, 15, 7.5]), PAL.red[2], 2);
    f.dot(C([-1, 13, 4]), PAL.red[1], 1);
  }
  return f;
}

/**
 * The dog seen a little from above (the player's eye is 0.5 tiles up): head-on and from behind
 * the back and the saddle show above the head / the tail, so yaws 0 and 4 read as a dog and not
 * as an upright pillar. The tilt turns about the view's x axis (pose = turn · rotX · turn).
 */
function dogTilt(yaw: number): { pose: M3; lift: number } {
  const th = (yaw * Math.PI) / 4;
  const a = 0.05 + 0.24 * Math.cos(th) * Math.cos(th);
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const turn: M3 = [-c, 0, -sn, 0, 1, 0, -sn, 0, c];
  // the paws nearest the viewer sink by sin(a) × their depth: lift the body back onto the floor
  return { pose: mulMM(turn, mulMM(rotX(a), turn)), lift: Math.sin(a) * (2.5 + 5 * Math.abs(c)) };
}

function dogFrame(p: DogPose, yaw: number): PixelBuffer {
  const fig = dog(p);
  let pose: M3 = IDENT;
  let offset: V3 = [0, 0, 0];
  if (p.fall > 0) {
    pose = rotZ(-p.fall * Math.PI * 0.5);
    offset = [-p.fall * 3, p.fall * 3.5, 0];
  } else {
    const t = dogTilt(yaw);
    pose = t.pose;
    offset = [0, t.lift, 0];
  }
  // the dog stands across the billboard when seen side-on: render it a little smaller than a person
  const b = renderFigure(fig, { size: SIZE, yaw, pose, offset, ground: GROUND, cx: SIZE / 2, scale: 1.3 });
  if (p.blood >= 2) bloodPool(b, SIZE / 2, GROUND, p.blood >= 3 ? 0.7 : 0.35, 23);
  return b.touch();
}

const dogAct = (frame: number): DogPose => {
  switch (frame) {
    case 0:
      return { ...DOG0, crouch: 1, jaw: 0.5 };
    case 1:
      return { ...DOG0, bite: 1, jaw: 1 };
    case 2:
      return { ...DOG0, crouch: 0.4, jaw: 0.8, blood: 1 };
    case 3:
      return { ...DOG0, crouch: 0.5, fall: 0.5, blood: 1 };
    case 4:
      return { ...DOG0, fall: 0.95, blood: 2 };
    default:
      return { ...DOG0, fall: 1, blood: 3 };
  }
};

defineRayBillboard('fps/dog/move', {
  yaws: 8,
  frames: 5,
  // run phases 1/8, 3/8, 5/8, 7/8: no run frame repeats the stand pose
  gen: (frame, yaw) => dogFrame(frame === 0 ? DOG0 : { ...DOG0, run: (frame - 0.5) / 4 }, yaw),
});
defineRayBillboard('fps/dog/act', { yaws: 1, frames: 6, gen: (frame) => dogFrame(dogAct(frame), 0) });

// ------------------------------------------------------------------------------------ boss

/** Mech materials (style of art-src/user/mecha-hofmans-full.png: dark plates, hot seams). */
const MECH = {
  plate: m([PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.steel[1], PAL.steel[2]], 0, INK),
  plateLit: m([PAL.ink[1], PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3]], 0, INK),
  joint: m([PAL.ink[0], PAL.ink[1], PAL.hairA[2], PAL.steel[1]], 0, INK),
  seam: { ramp: [PAL.red[2], PAL.orange[0]], glow: true } as Mat,
  seamHot: { ramp: [PAL.orange[0], PAL.orange[1]], glow: true } as Mat,
  core: { ramp: [PAL.red[1], PAL.red[2]], glow: true } as Mat,
  dim: { ramp: [PAL.red[0], PAL.red[0]], glow: true } as Mat,
  brass: m([PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]], 0.1, PAL.brown[0]),
  /** The horn bells in the tell: warm (tell 1), glowing orange (tell 2 and the burst). */
  hornWarm: { ramp: [PAL.orange[0], PAL.gold[2]], glow: true } as Mat,
  hornHot: { ramp: [PAL.orange[1], PAL.orange[1]], glow: true } as Mat,
  barrel: m([PAL.ink[0], PAL.steel[0], PAL.steel[2]], 0, INK),
  hair: m([PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]], 0.2, PAL.ink[1]),
  skin: m([PAL.rust[0], PAL.rust[1], PAL.skinA[1], PAL.skinA[2]], 0, PAL.brown[0]),
  pipe: m([PAL.ink[1], PAL.steel[1], PAL.steel[2], PAL.steel[3]]),
} as const;

const MECH_SIZE = 96;
const MECH_GROUND = 94;
/** Body-space height of the face's top row and the head centre. */
const FACE_TOP = 92;

type FaceFx = { flare: 0 | 1 | 2; white: boolean; crack: number; eyesOut: boolean };
const FACE0: FaceFx = { flare: 0, white: false, crack: 0, eyesOut: false };

/** The imported face (§8.7) as a buffer, with the act effects (§7.1). */
export function mechaFace(img: MechaFaceImage, fx: FaceFx = FACE0): PixelBuffer {
  const b = new PixelBuffer(img.w, img.h);
  img.rows.forEach((row, y) => {
    for (let x = 0; x < img.w; x++) {
      const ch = row[x];
      if (ch !== '.') b.data[y * img.w + x] = MECHA_FACE_KEY[ch] >>> 0;
    }
  });
  const isRed = (c: Color): boolean => PAL.red.includes(c);
  const near = (x: number, y: number, r: number): boolean => img.eyes.some(([ex, ey]) => Math.abs(x - ex) <= r && Math.abs(y - ey) <= r);
  if (fx.eyesOut) {
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const i = y * img.w + x;
      if (near(x, y, 3) && isRed(b.data[i])) b.data[i] = (x + y) & 1 ? PAL.ink[1] : PAL.red[0];
    }
  }
  if (fx.white) {
    for (let i = 0; i < b.data.length; i++) {
      const c = b.data[i];
      if ((c & 255) === 0) continue;
      const l = ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 10;
      b.data[i] = l > 150 ? PAL.snow[3] : l > 100 ? PAL.snow[2] : l > 60 ? PAL.snow[1] : PAL.steel[3];
    }
  }
  if (fx.crack > 0) {
    // dark cracks from the brow and the temple, longer with every break frame
    const cracks: [number, number, number, number][] = [
      [0.55, 0.12, -0.6, 1],
      [0.2, 0.3, 0.5, 1],
      [0.8, 0.55, -0.8, 1],
      [0.35, 0.7, 0.4, -1],
    ];
    for (let k = 0; k < Math.min(cracks.length, fx.crack); k++) {
      const [fx0, fy0, slope, dir] = cracks[k];
      let x = Math.round(fx0 * img.w);
      let y = Math.round(fy0 * img.h);
      const len = 6 + fx.crack * 3;
      for (let s = 0; s < len; s++) {
        if (x >= 0 && y >= 0 && x < img.w && y < img.h && (b.data[y * img.w + x] & 255) !== 0) {
          b.data[y * img.w + x] = INK;
          if (s % 3 === 0 && x + 1 < img.w && (b.data[y * img.w + x + 1] & 255) !== 0) b.data[y * img.w + x + 1] = PAL.stone[0];
        }
        y += 1;
        x += hash2(s, k, 77) < 0.5 ? dir : Math.round(slope);
      }
    }
  }
  if (fx.flare > 0 && !fx.eyesOut) {
    for (const [ex, ey] of img.eyes) {
      const r = fx.flare === 2 ? 2 : 1;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = ex + dx;
          const y = ey + dy;
          if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const corner = Math.abs(dx) === r && Math.abs(dy) === r;
          if (corner && r === 2) continue;
          b.data[y * img.w + x] = d === 0 ? (fx.flare === 2 ? PAL.snow[3] : PAL.gold[3]) : d === 1 ? (fx.flare === 2 ? PAL.red[3] : PAL.red[2]) : PAL.red[2];
        }
      }
    }
  }
  return b.touch();
}

interface MechPose {
  walk: number; // −1 = stand
  /** 0..1: horns glow, barrels spin. */
  charge: number;
  /** Which horn pair flashes: −1 none, 0 left pair, 1 right pair. */
  fire: number;
  /** Break frames 0..4 (sparks, cracks). */
  broken: number;
  /** 0..1: the wreck — kneeling, the chest opened. */
  wreck: number;
}
const MECH0: MechPose = { walk: -1, charge: 0, fire: -1, broken: 0, wreck: 0 };

/** The suit "Mecha Hofmans" (§7.1) without the face (the face is blitted after rendering). */
export function buildMech(p: MechPose, yaw: number): { fig: Figure; horns: V3[]; core: V3; head: V3 } {
  const f = new Figure();
  const walking = p.walk >= 0;
  const ph = walking ? p.walk * Math.PI * 2 : 0;
  // the stomp: the body drops 3 on the planted foot and sways over it
  const bob = walking ? -Math.abs(Math.cos(ph)) * 3 : 0;
  const sway = walking ? -Math.cos(ph) * 2.5 : 0;
  const kneel = p.wreck * 12;
  const Y = (v: V3): V3 => [v[0] + sway, v[1] + bob - kneel, v[2]];
  // ---- legs (hydraulic, three-toed)
  for (const side of [1, -1]) {
    const sw = walking ? Math.sin(ph) * 0.35 * side : 0;
    const hip: V3 = Y([side * 11, 27, 0]);
    const kneeBend = 0.35 + (walking ? Math.max(0, Math.cos(ph) * side) * 0.5 : 0) + p.wreck * 1.1;
    const knee: V3 = add(hip, [side * 2, -Math.cos(sw + kneeBend * 0.5) * 13, Math.sin(sw + kneeBend * 0.5) * 13]);
    const ankle: V3 = [side * 13, 4 + (walking ? Math.max(0, Math.cos(ph) * side) * 7 : 0), knee[2] - 3 - p.wreck * 4];
    f.cap(hip, knee, 6, 5, MECH.plate);
    f.ball(knee, 5.2, MECH.joint);
    f.dot(add(knee, [0, 0, 5.2]), PAL.red[2], 2, 2);
    f.cap(knee, ankle, 4.6, 4.0, MECH.plateLit);
    // hydraulic piston
    f.cap(add(hip, [side * 4, -2, 4]), add(ankle, [side * 3, 4, 3]), 1.2, 1.2, MECH.pipe);
    // shin plate with a hot seam
    f.box(lerp3(knee, ankle, 0.45), [3.6, 5, 1.2], MECH.plate, lookAlong([0, 0, 1]));
    f.box(lerp3(knee, ankle, 0.45), [3.8, 0.5, 1.3], MECH.seam);
    // three toes and a heel spur
    const foot: V3 = [ankle[0], ankle[1] - 2, ankle[2]];
    for (const a of [-0.55, 0, 0.55]) {
      const dir = norm3([Math.sin(a), -0.15, Math.cos(a)]);
      f.box(add(foot, mul3(dir, 5)), [1.8, 1.8, 4.5], MECH.plate, lookAlong(dir));
    }
    f.box(add(foot, [0, 0, -4]), [1.6, 1.6, 2.4], MECH.plate);
  }
  // ---- pelvis, abdomen, chest
  f.box(Y([0, 28, 0]), [12, 5, 7.5], MECH.plate);
  f.box(Y([0, 28, 0]), [12.3, 0.5, 7.8], MECH.seam);
  f.box(Y([0, 34, 0.5]), [10, 3.5, 7.5], MECH.joint);
  const chestC: V3 = Y([0, 44, 0]);
  if (p.wreck > 0) {
    // the opened chest: dark hollow with embers, the two front plates swung open
    f.box(chestC, [15, 10, 8], MECH.joint);
    f.box(add(chestC, [0, 0, 7.5]), [10, 7, 1], MECH.dim);
    f.box(add(chestC, [-15, 0, 12]), [1.2, 10, 7], MECH.plateLit, rotY(0.3));
    f.box(add(chestC, [15, 0, 12]), [1.2, 10, 7], MECH.plateLit, rotY(-0.3));
    f.dot(add(chestC, [-3, -2, 9]), PAL.orange[0], 2, 3);
    f.dot(add(chestC, [4, 1, 9]), PAL.red[2], 2, 3);
    f.dot(add(chestC, [1, -5, 9]), PAL.gold[2], 1, 3);
  } else {
    f.box(chestC, [16, 11, 9.5], MECH.plate);
    // hot seams between the plates
    f.box(add(chestC, [0, -5.5, 0]), [16.3, 0.55, 9.8], MECH.seam);
    f.box(add(chestC, [0, 6, 0]), [16.3, 0.55, 9.8], MECH.seam);
    f.box(add(chestC, [-8.5, 0, 0]), [0.5, 11.2, 9.8], MECH.seam);
    f.box(add(chestC, [8.5, 0, 0]), [0.5, 11.2, 9.8], MECH.seam);
    // raised plates
    for (const [x, y] of [[-12.5, 1], [12.5, 1], [-12.5, -8.5], [12.5, -8.5]] as const) f.box(add(chestC, [x, y, 9.6]), [3, 3.5, 0.6], MECH.plateLit);
    // vents (glow)
    for (const sx of [-12.5, 12.5]) for (let k = 0; k < 3; k++) f.box(add(chestC, [sx, -3.5 + k * 1.6 + 7, 10.3]), [2.6, 0.35, 0.2], MECH.seamHot);
    // reactor housing
    f.ell(add(chestC, [0, 0, 9.5]), [6.5, 6.5, 2], MECH.joint);
  }
  const core: V3 = add(chestC, [0, 0, 11.6]);
  // the power pack on the back (bulk in profile; the exhaust stacks rise from it)
  f.box(add(chestC, [0, 1, -12]), [11, 12, 4.5], MECH.plate);
  f.box(add(chestC, [0, -4, -16.6]), [9, 0.5, 0.4], MECH.seam);
  f.box(add(chestC, [0, 4, -16.6]), [9, 0.5, 0.4], MECH.seam);
  // ---- collar under the head
  f.ell(Y([0, 55.5, 0]), [13, 3.2, 9.5], MECH.plate);
  f.ell(Y([0, 57.5, 0]), [11.5, 1.2, 8.5], MECH.seamHot);
  // ---- shoulders, horn pods
  const horns: V3[] = [];
  for (const side of [1, -1]) {
    const sh: V3 = Y([side * 21, 50, 0]);
    // deep shoulder plates: the walker stays hulking in profile
    f.ell(sh, [8.5, 7, 11.5], MECH.plateLit);
    f.ell(add(sh, [0, -2, 0]), [8.8, 0.6, 11.8], MECH.seam);
    // the pod on top (side and back yaws: set back behind the head, the horns point up and
    // back, so in profile no horn sits in front of the mouth)
    const profile = yaw >= 2;
    const pod: V3 = add(sh, [side * 1, 8, profile ? -7 : -1]);
    f.box(pod, [6.5, 3.5, 6], MECH.plate);
    // two brass loudspeaker horns per pod, a rotary barrel in each mouth
    for (const dx of [-3, 3]) {
      const base = add(pod, [dx, 1.5, profile ? -1 : 3]);
      const mouth = profile ? add(pod, [dx * 1.5, 11 + p.charge * 0.5, -5]) : add(pod, [dx * 1.5, 5.5 + p.charge * 0.5, 13]);
      f.cap(base, mouth, 1.4, 4.3, p.charge >= 1 ? MECH.hornHot : p.charge > 0 ? MECH.hornWarm : MECH.brass);
      f.dot(mouth, p.charge > 0 ? (p.charge > 0.6 ? PAL.gold[3] : PAL.orange[1]) : INK, 4, 5);
      f.dot(mouth, p.charge > 0 ? PAL.snow[3] : PAL.steel[2], 1, 5);
      horns.push(mouth);
    }
    // arms: heavy upper arm, gauntlet
    const elbow: V3 = add(sh, [side * 3, -12, 3 + (walking ? -Math.sin(ph) * side * 3 : 0)]);
    const fist: V3 = add(elbow, [-side * 1, -10 + p.wreck * 3, 6]);
    f.cap(add(sh, [0, -3, 0]), elbow, 4.5, 4.0, MECH.joint);
    f.cap(elbow, fist, 4.8, 5.5, MECH.plate);
    f.box(lerp3(elbow, fist, 0.5), [5.4, 0.5, 5.6], MECH.seam);
    for (const t of [-1.6, 0, 1.6]) f.cap(add(fist, [t, -3, 2]), add(fist, [t * 1.3, -6.5, 3.5]), 1.1, 0.5, MECH.plateLit);
  }
  // ---- back fins (spiked, red-lit edges) and exhaust stacks
  for (const side of [1, -1]) {
    const tilt = rotZ(-side * 0.22);
    const finC: V3 = Y([side * 15, 70, -10]);
    f.box(finC, [1.6, 17, 5.5], MECH.plate, tilt);
    f.box(add(finC, [side * 1.9, 0.5, 0]), [0.4, 16, 1], MECH.seam, tilt);
    f.cap(add(finC, [side * 3.8, 16, -1]), add(finC, [side * 6.5, 27, -6]), 2.2, 0.2, MECH.plateLit);
    f.cap(add(finC, [side * 1.5, 6, -2]), add(finC, [side * 7, 9, -8]), 1.6, 0.2, MECH.plateLit);
    f.cap(Y([side * 6, 56, -9]), Y([side * 6.5, 67, -10]), 2.2, 2.4, MECH.pipe);
    f.dot(Y([side * 6.5, 68, -10]), INK, 2, 3);
  }
  // ---- the head for the side and back yaws (the front yaws get the user's face)
  const head: V3 = Y([0, FACE_TOP - 21, 1]);
  if (yaw >= 2) {
    // a flatter skull (no tall dome) with the face forward
    f.ell(add(head, [0, -2, 1]), [13.6, 16, 13], MECH.skin);
    // ears
    for (const sx of [1, -1]) {
      f.ell(add(head, [sx * 13.4, -1, -1.5]), [2.2, 4, 3], MECH.skin);
      f.dot(add(head, [sx * 14.6, -1, -1.5]), PAL.rust[0], 1, 1.5);
    }
    // nose and jaw for the profile
    f.cap(add(head, [0, 1, 12.5]), add(head, [0, -4, 15]), 2.4, 2.0, MECH.skin);
    f.ell(add(head, [0, -11, 6]), [9, 6, 7], MECH.skin);
    // grey swept-back hair over the whole crown and the back of the head
    f.ell(add(head, [0, 9.5, -1]), [14.8, 10.5, 14.2], MECH.hair);
    f.ell(add(head, [0, 1, -6.5]), [14.4, 14.5, 9], MECH.hair);
    // swept strands toward the back
    for (const sx of [-6, 0, 6]) f.cap(add(head, [sx, 15, 9]), add(head, [sx * 1.1, 13, -12]), 1.2, 1.0, MECH.hair);
    // a glowing red eye at the front of the profile
    f.dot(add(head, [6.5, 3, 11.8]), PAL.red[3], 3, 1.5);
    f.dot(add(head, [-6.5, 3, 11.8]), PAL.red[3], 3, 1.5);
  } else {
    // neck stub under the face
    f.cap(Y([0, 52, 0]), Y([0, 58, 1]), 6, 6, MECH.skin);
  }
  return { fig: f, horns, core, head };
}

/** Reactor core rings (white-hot centre, red rings) on the chest. */
function reactor(b: PixelBuffer, x: number, y: number, pulse: number, dead: boolean): void {
  const R = 5.5 + pulse * 1.5;
  for (let yy = Math.floor(y - R - 1); yy <= y + R + 1; yy++) {
    for (let xx = Math.floor(x - R - 1); xx <= x + R + 1; xx++) {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
      if (d > R) continue;
      let c: Color;
      if (dead) c = d < 2 ? PAL.red[0] : d < R - 1 ? PAL.ink[1] : PAL.red[0];
      else c = d < 1.6 ? PAL.snow[3] : d < 2.6 ? PAL.gold[3] : d < 3.6 ? PAL.red[3] : d < 4.4 ? PAL.red[1] : d < R - 0.6 ? PAL.red[2] : PAL.red[0];
      if (xx >= 0 && yy >= 0 && xx < b.w && yy < b.h) b.data[yy * b.w + xx] = c;
    }
  }
}

/** Sparks around the suit (break frames). */
function sparks(b: PixelBuffer, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const x = 18 + Math.floor(hash2(i, 1, seed) * 60);
    const y = 30 + Math.floor(hash2(i, 2, seed) * 45);
    if ((b.data[y * b.w + x] & 255) === 0) continue;
    const c = i % 3 === 0 ? PAL.snow[3] : i % 3 === 1 ? PAL.gold[3] : PAL.orange[1];
    b.set(x, y, c);
    if (i % 2 === 0) {
      b.set(x + 1, y - 1, PAL.gold[2]);
      b.set(x - 1, y + 1, PAL.orange[0]);
    }
  }
}

/** Smoke puffs (grey, dithered) at a point. */
function smoke(b: PixelBuffer, x: number, y: number, r: number, seed: number): void {
  for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
    for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
      const d = Math.hypot(xx - x, yy - y) / r + (hash2(xx, yy, seed) - 0.5) * 0.5;
      if (d > 1 || xx < 0 || yy < 0 || xx >= b.w || yy >= b.h) continue;
      if (d > 0.7 && ((xx + yy) & 1) === 0) continue;
      b.data[yy * b.w + xx] = d < 0.4 ? PAL.stone[2] : d < 0.7 ? PAL.stone[1] : PAL.stone[0];
    }
  }
}

/**
 * A suit frame. `walk` −1 stands; `act` selects the act frame (§8.2: tell 1–2, fire 1–2, pain,
 * break 1–4).
 */
export function mechFrame(walk: number, yaw: number, act = -1): PixelBuffer {
  const p: MechPose = { ...MECH0, walk };
  const fx: FaceFx = { ...FACE0 };
  let pulse = 0;
  if (act === 0 || act === 1) {
    p.charge = act === 0 ? 0.5 : 1;
    fx.flare = act === 0 ? 1 : 2;
    pulse = act === 0 ? 0.5 : 1;
  } else if (act === 2 || act === 3) {
    p.charge = 1;
    p.fire = act - 2;
    fx.flare = 1;
    pulse = 0.5;
  } else if (act === 4) {
    fx.white = true;
  } else if (act >= 5) {
    p.broken = act - 4;
    fx.crack = act - 4;
    fx.eyesOut = act === 8;
  }
  const { fig, horns, core } = buildMech(p, yaw);
  const b = renderFigure(fig, { size: MECH_SIZE, yaw, ground: MECH_GROUND, cx: MECH_SIZE / 2 });
  const pr = projector(yaw, MECH_GROUND, MECH_SIZE);
  if (yaw <= 1) {
    const [cxp, cyp] = pr(core);
    reactor(b, Math.round(cxp) + 0.5, Math.round(cyp) + 0.5, pulse, p.broken >= 4);
  }
  if (p.fire >= 0) {
    // all four horns fire; the pair of this frame flashes big (the burst reads at any range)
    for (let i = 0; i < horns.length; i++) {
      const [hx, hy] = pr(horns[i]);
      flashAt(b, hx, hy, (i >> 1) === p.fire ? 8 : 5);
    }
  }
  placeFace(b, yaw, fx, 0);
  if (p.broken > 0) sparks(b, 6 + p.broken * 6, 90 + p.broken);
  if (p.broken >= 2) smoke(b, 30 + p.broken * 3, 30, 3 + p.broken, 95 + p.broken);
  if (walk >= 0 && yaw >= 2) smoke(b, MECH_SIZE / 2 + (yaw === 2 ? 10 : 0), 18 - Math.round(walk * 6), 3, 97);
  return b.touch();
}

/** Blit the user's face onto a front-yaw suit frame (yaw 0 = face34, yaw 1 = face27 squeezed). */
function placeFace(b: PixelBuffer, yaw: number, fx: FaceFx, drop: number): void {
  if (yaw > 1) return;
  const img = yaw === 0 ? face34 : face27;
  const face = mechaFace(img, fx);
  const x = Math.round(MECH_SIZE / 2 - img.w / 2) + (yaw === 1 ? -3 : 0);
  const y = MECH_GROUND - FACE_TOP + drop;
  b.blit(face, x, y);
}

/** Screen position of a body-space point for a yaw (no pose), as renderFigure projects it. */
function projector(yaw: number, ground: number, size: number): (v: V3) => [number, number] {
  const th = (yaw * Math.PI) / 4;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return (v) => [size / 2 + (-c * v[0] - s * v[2]), ground - v[1]];
}

function flashAt(b: PixelBuffer, x: number, y: number, r: number): void {
  const pr: Projector = { p: () => [x, y, 0], rot: IDENT };
  muzzleFlash(b, pr, [0, 0, 0], r);
}

/** The wreck (§7.1): kneeling, the chest opened, smoking, the dead face (eyes dark). */
export function wreckFrame(): PixelBuffer {
  const { fig } = buildMech({ ...MECH0, wreck: 1 }, 0);
  const b = renderFigure(fig, { size: MECH_SIZE, yaw: 0, ground: MECH_GROUND, cx: MECH_SIZE / 2 });
  placeFace(b, 0, { ...FACE0, crack: 4, eyesOut: true }, 12);
  smoke(b, 36, 30, 6, 120);
  smoke(b, 58, 22, 5, 121);
  smoke(b, 46, 12, 4, 122);
  sparks(b, 8, 123);
  return b.touch();
}

// ---- MechaHitler on foot (phase 2): our own caricature design (§7.1)


/** Foot frames: `walk` −1 stands; act: tell, fire 1–2, pain, die 1–6, dead. */
export function footFrame(walk: number, yaw: number, act = -1): PixelBuffer {
  let p: SoldierPose = walk >= 0 ? { ...POSE0, walk } : { ...POSE0 };
  if (act === 0) p = { ...POSE0, aim: 1, glint: true };
  else if (act === 1 || act === 2) p = { ...POSE0, aim: 1, flash: true, lean: 0.05 * act };
  else if (act === 3) p = { ...POSE0, aim: 0.4, lean: 0.25, headRoll: 0.25, blood: 1 };
  else if (act >= 4 && act <= 9) {
    const k = act - 4; // die 1–6
    p = soldierActPose(Math.min(6, 3 + Math.floor((k * 4) / 5)));
    if (k === 0) p = { ...POSE0, aim: 0.3, lean: 0.3, headRoll: -0.25, blood: 2 };
  } else if (act === 10) p = soldierActPose(7);
  const fig = soldier('boss', p);
  let pose: M3 = IDENT;
  let offset: V3 = [0, 0, 0];
  if (p.fall > 0) {
    const a = p.fall * Math.PI * 0.5;
    pose = mulMM(rotY(0.75 * p.fall), mulMM(rotZ(-a), rotX(-0.25 * p.fall)));
    offset = [-p.fall * 22, p.fall * 3.5, 0];
  }
  const b = renderFigure(fig, { size: SIZE, yaw, pose, offset, ground: GROUND, cx: SIZE / 2, scale: FIG_SCALE });
  if (p.blood >= 3) bloodPool(b, SIZE / 2 + 2, GROUND, p.blood >= 4 ? 1 : 0.45, 13);
  // scorched hem: soot texels along the bottom of the coat
  return b.touch();
}

defineRayBillboard('fps/boss/mech/move', { size: 96, yaws: 8, frames: 5, worldW: 1.5, worldH: 1.5, gen: (frame, yaw) => mechFrame(frame === 0 ? -1 : (frame - 1) / 4, yaw) });
defineRayBillboard('fps/boss/mech/act', { size: 96, yaws: 1, frames: 9, worldW: 1.5, worldH: 1.5, gen: (frame) => mechFrame(-1, 0, frame) });
defineRayBillboard('fps/boss/wreck', { size: 96, yaws: 1, frames: 1, worldW: 1.5, worldH: 1.5, gen: () => wreckFrame() });
// A little bigger than the troops (world 1.15): the boss on foot stands out at range.
defineRayBillboard('fps/boss/foot/move', { yaws: 8, frames: 5, worldW: 1.15, worldH: 1.15, gen: (frame, yaw) => footFrame(frame === 0 ? -1 : (frame - 1) / 4, yaw) });
defineRayBillboard('fps/boss/foot/act', { yaws: 1, frames: 11, worldW: 1.15, worldH: 1.15, gen: (frame) => footFrame(-1, 0, frame) });


// ------------------------------------------------------------------------------------ fx

defineRayBillboard('fps/fx/blood-pool', {
  yaws: 1,
  frames: 3,
  gen: (frame) => {
    const b = new PixelBuffer(SIZE, SIZE);
    bloodPool(b, SIZE / 2, GROUND, [0.2, 0.5, 0.9][frame] ?? 0.5, 31 + frame);
    return b.touch();
  },
});

defineRayBillboard('fps/fx/spurt', {
  yaws: 1,
  frames: 3,
  gen: (frame) => {
    const b = new PixelBuffer(SIZE, SIZE);
    const cx = SIZE / 2;
    const cy = 28; // chest height of a 64-px person
    // a solid core and a dense spray (30–40 texels: it reads at range)
    const core = [2.2, 1.6, 0][frame] ?? 0;
    for (let y = -3; y <= 3; y++) {
      for (let x = -3; x <= 3; x++) {
        const d = Math.hypot(x, y);
        if (d <= core) b.set(cx + x, cy + y + frame, d < core * 0.5 ? PAL.red[2] : PAL.red[1]);
      }
    }
    const n = [22, 34, 26][frame] ?? 20;
    const spread = [5, 8, 11][frame] ?? 5;
    for (let i = 0; i < n; i++) {
      const a = hash2(i, 1, 40 + frame) * Math.PI * 2;
      const d = 1 + hash2(i, 2, 40 + frame) * spread;
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d * 0.8 + frame * 2);
      b.set(x, y, i % 4 === 0 ? PAL.red[2] : PAL.red[1]);
      if (i % 3 === 0) b.set(x + 1, y, PAL.red[0]);
    }
    return b.touch();
  },
});

/**
 * The suit's hit sparks (§7.1/§7.2: the suit takes no pain, sparks only; also the break): a
 * 1.5-tile billboard like the mech, the sparks at his chest and shoulders, gold / orange / white.
 */
defineRayBillboard('fps/fx/sparks', {
  size: MECH_SIZE,
  yaws: 1,
  frames: 3,
  worldW: 1.5,
  worldH: 1.5,
  gen: (frame) => {
    const b = new PixelBuffer(MECH_SIZE, MECH_SIZE);
    const cx = MECH_SIZE / 2;
    const cy = MECH_GROUND - 46; // the chest of the suit
    const n = [14, 22, 16][frame] ?? 12;
    const spread = [8, 14, 20][frame] ?? 10;
    for (let i = 0; i < n; i++) {
      const a = hash2(i, 1, 60 + frame) * Math.PI * 2;
      const d = 2 + hash2(i, 2, 60 + frame) * spread;
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d * 0.7 + frame * 2);
      const c = i % 3 === 0 ? PAL.snow[3] : i % 3 === 1 ? PAL.gold[3] : PAL.orange[1];
      b.set(x, y, c);
      // short streaks flying outward
      const ex = Math.round(Math.cos(a));
      const ey = Math.round(Math.sin(a) * 0.7);
      b.set(x + ex, y + ey, frame === 2 ? PAL.orange[0] : PAL.gold[2]);
    }
    if (frame === 0) {
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.abs(x) + Math.abs(y) <= 2) b.set(cx + x, cy + y, Math.abs(x) + Math.abs(y) <= 1 ? PAL.snow[3] : PAL.gold[3]);
    }
    return b.touch();
  },
});

