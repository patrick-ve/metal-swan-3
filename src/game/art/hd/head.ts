/**
 * The UHD head contract (docs/ART_GUIDE.md "UHD art", rig contracts) — a WORKING PROTOTYPE: the
 * rig group (HEADS) replaces the body of `renderHeadHd` with painted heads for every HeadStyle;
 * the signature and the layout stay.
 *
 * renderHeadHd(s, expr, d) returns exactly HEAD_W·d × HEAD_H·d, the same logical layout as
 * `renderHead` (facing right, NECK and HEAD_CENTER at d times them), no outline (the rig outlines
 * the whole figure). The head is a lit volume: cranium, jaw, nose, ear and neck as one skin part
 * (so no lines inside the face), the hair a separate part with strands, the headgear a shell.
 */
import type { Color } from '../../../engine/color';
import { PAL_HD, hdRampOf } from '../../../engine/palette-hd';
import type { PixelBuffer } from '../../../engine/pixel';
import { HEAD_H, HEAD_W, type Expression, type HeadStyle } from '../humanoid-head';
import { HdCanvas } from './canvas';
import { strands } from './texture';

export type HdDensity = 2 | 4;

const EYE_X = 12.2;
const EYE_Y = 12.8;

/** The prototype HD head. */
export function renderHeadHd(s: HeadStyle, expr: Expression, d: HdDensity, opts: { glint?: boolean } = {}): PixelBuffer {
  const c = new HdCanvas(HEAD_W, HEAD_H, d);
  const skinR = hdRampOf(s.skin);
  const hairR = hdRampOf(s.hair);
  // Skin: a light face (today's recruit reads by its big pale face), the shade only where the form turns away.
  const skin = c.material({ ramp: skinR, spec: 0.2, shine: 22, rim: 0.05, amb: 0.3, wrap: 0.25, lo: skinR.length > 6 ? 3 : 1 });
  const hair = c.material({ ramp: hairR, spec: 0.45, shine: 12, rim: 0.1, amb: 0.04, wrap: 0, hi: Math.max(1, hairR.length - 3) });
  const gearR = hdRampOf(s.gear);
  const gear = c.material({ ramp: gearR, spec: 0.3, shine: 14 });
  const face = c.newPart();
  const fo = { mat: skin, part: face, z: 0 };
  // Neck (behind the jaw), then cranium, jaw, chin, nose and ear as ONE smooth height field
  // (a smooth union of domes: no crease where they meet).
  c.capsule(8.6, 15.4, 8.4, 19.2, 1.9, 1.9, { ...fo, round: 0.8 });
  c.heightField(2.5, 5.5, 14, 13, faceHeight, { ...fo, z: 0.2 });
  // Eye socket and the hollow under the cheekbone: soft shade.
  c.shade(10, 10, 6, 7, (x, y) => -0.1 * gauss(x, y, 11, 15.6, 1.6, 0.8), face);
  // The ear's bowl and the jaw shadow onto the neck.
  c.shade(5.8, 11.5, 3.4, 4, (x, y) => {
    // The ear: a lit rim, the bowl in shade, the canal deepest; a crease where it meets the cheek.
    const q = ((x - 7.45) / 0.8) ** 2 + ((y - 13.6) / 1.1) ** 2;
    if (q < 0.3) return -0.6;
    if (q < 1) return -0.3;
    const e = ((x - 7.3) / 1.35) ** 2 + ((y - 13.5) / 1.75) ** 2;
    return e < 1.25 && e > 0.9 && x > 7.6 ? -0.35 : 0;
  }, face);
  c.shade(6, 16, 6, 3.2, (x, y) => (y > 16.3 + (x - 7) * 0.1 ? -0.25 : 0), face);

  const hatOn = s.headgear !== 'none' && s.hat !== false;
  drawHair(c, s, hair, hatOn);
  drawFace(c, expr, skinR, hairR, opts.glint !== false);
  if (hatOn) drawGear(c, s, gear);
  return c.render({ outline: 'none', ao: 0.3, rimLight: 2 });
}

/** Dome height of an ellipsoid (rx, ry, depth rz), or −1 outside. */
function dome(x: number, y: number, cx: number, cy: number, rx: number, ry: number, rz: number): number {
  const u = (x - cx) / rx;
  const v = (y - cy) / ry;
  const q = u * u + v * v;
  return q >= 1 ? -1 : Math.sqrt(1 - q) * rz;
}

/** Smooth maximum (k = blend width). */
function smax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** The face surface: cranium, cheek / jaw, chin, nose, brow ridge, ear (NaN outside). */
function faceHeight(x: number, y: number): number {
  const cran = dome(x, y, 9.1, 11.7, 5.8, 5.0, 5);
  const jaw = dome(x, y, 10.3, 14.1, 4.8, 3.6, 4.4);
  const chin = dome(x, y, 12.0, 16.3, 2.2, 1.4, 3.2);
  const nose = dome(x, y, 14.3, 13.5, 1.0, 1.3, 0.8);
  const ear = dome(x, y, 7.3, 13.5, 1.35, 1.75, 1.2);
  let h = smax(cran, jaw, 1.6);
  h = smax(h, chin, 1.0);
  if (cran < 0 && jaw < 0 && chin < 0 && nose < 0) return NaN;
  if (nose > 0) h = smax(h, 3.6 + nose, 0.8);
  if (ear > 0) h = Math.max(h, 2.9 + ear);
  // Brow ridge over the eye and the socket under it.
  h += 0.5 * gauss(x, y, EYE_X - 0.2, EYE_Y - 1.6, 1.6, 0.5) - 0.45 * gauss(x, y, EYE_X - 0.2, EYE_Y, 1.0, 0.8);
  return h < 0 ? NaN : h;
}

function gauss(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const u = (x - cx) / sx;
  const v = (y - cy) / sy;
  return Math.exp(-(u * u + v * v) / 2);
}

/**
 * A lock of hair: an elongated dome centred (cx, cy), half length `len` along the angle `a`
 * (radians, 0 = pointing right, + = clockwise / down), half width `wid`.
 */
interface Lock {
  cx: number;
  cy: number;
  len: number;
  wid: number;
  a: number;
}

/**
 * Short side-parted hair (the recruit, docs/design/squad.md): a cap over the cranium, the
 * hairline clear of the ear (the ear shows), a fringe of three locks swept forward over the
 * forehead from a side part, the crown and the back in locks swept down and back. Locks meet in
 * grooves (no blending), so the key light makes one clean highlight cluster per lock.
 */
const SHORT_LOCKS: readonly Lock[] = [
  { cx: 9.4, cy: 7.0, len: 3.6, wid: 1.3, a: 0.1 }, // crown along the part
  { cx: 11.6, cy: 8.7, len: 3.0, wid: 1.4, a: 0.5 }, // fringe, swept forward
  { cx: 13.3, cy: 9.7, len: 1.7, wid: 0.95, a: 0.7 }, // fringe tip over the brow
  { cx: 9.6, cy: 9.4, len: 1.3, wid: 0.85, a: 1.2 }, // fringe, a short lock at the temple
  { cx: 5.4, cy: 8.6, len: 3.6, wid: 1.9, a: 2.2 }, // back of the crown, swept back and down
  { cx: 4.4, cy: 12.4, len: 2.2, wid: 1.4, a: 1.75 }, // the nape
];

function lockBump(x: number, y: number, k: Lock): number {
  const ca = Math.cos(k.a);
  const sa = Math.sin(k.a);
  const u = ((x - k.cx) * ca + (y - k.cy) * sa) / k.len;
  const v = (-(x - k.cx) * sa + (y - k.cy) * ca) / k.wid;
  // Tapered towards the tip (u > 0): a lock ends in a point.
  const w = u > 0 ? 1 - u * 0.45 : 1;
  const q = u * u + (v * v) / (w * w);
  return q >= 1 ? -1 : Math.sqrt(1 - q);
}

function drawShortHair(c: HdCanvas, mat: number, hatOn: boolean): void {
  const part = c.newPart();
  c.heightField(2.5, 4.5, 13.5, 11, (x, y) => {
    if (hatOn && y < 10.2) return NaN;
    const dx = (x - 9.1) / 6.3;
    const dy = (y - 11.3) / 5.0;
    // A squarish cap (flat on top, like today's recruit), not a dome.
    const q = Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6);
    // Hairline: nape behind the ear, clear above the ear, a sideburn, the forehead under the fringe.
    const bottom = x < 6.0 ? 14.6 - Math.max(0, 4.4 - x) * 0.6 : x < 8.3 ? 11.2 : x < 8.8 ? 11.9 : 9.5;
    let bump = -1;
    for (const k of SHORT_LOCKS) {
      const b = lockBump(x, y, k);
      if (b > bump) bump = b;
    }
    const inCap = q < 1 && y < bottom;
    if (!inCap && bump < 0) return NaN;
    const cap = q < 1 ? Math.sqrt(1 - q) * 4.2 : 0.6;
    return 0.6 + cap + (bump > 0 ? bump * 0.7 : -0.12);
  }, { mat, part, z: 0.8, tone: -0.04 });
}

function drawHair(c: HdCanvas, s: HeadStyle, mat: number, hatOn: boolean): void {
  const style = s.hairStyle;
  if (style === 'bald') return;
  if (style === 'short') {
    drawShortHair(c, mat, hatOn);
    return;
  }
  const part = c.newPart();
  const top = style === 'buzz' ? 0.2 : style === 'spiky' || style === 'spiky-messy' || style === 'swept-up' || style === 'mohawk' ? 1.2 : 0.7;
  const long = style === 'long' || style === 'ponytail' || style === 'bob';
  // The hair mass: a cap over the cranium, the hairline sweeping from the brow back behind the ear.
  c.heightField(
    2.5,
    4.5,
    13.5,
    long ? 14 : 10.5,
    (x, y) => {
      const dx = (x - 9.0) / (5.8 + top * 0.3);
      const dy = (y - 11.2) / (5.2 + top);
      let q = dx * dx + dy * dy;
      if (style === 'spiky' || style === 'spiky-messy') q -= Math.max(0, Math.sin(x * 2.2) * 0.12) * (y < 9 ? 1 : 0);
      if (q > 1) return NaN;
      // Hairline: the forehead (right) is bare below y≈9.6, the temple and ear area show skin.
      // A fringe of locks: the hairline zig-zags (lock tips point down and forward).
      const ph = (x * 0.8 + y * 0.25) % 1;
      const front = 9.2 + (12.6 - x) * 0.5 + (ph < 0.5 ? ph : 1 - ph) * 1.6;
      if (x > 10.6 && y > front) return NaN;
      if (x > 6.8 && x <= 10.6 && y > (long ? 18 : 12.6 - (x - 6.8) * 0.4)) return NaN;
      if (x <= 6.8 && y > (long ? 19 : 15.2)) return NaN;
      if (hatOn && y < 10.2) return NaN;
      return Math.sqrt(1 - q) * 5 + 0.5;
    },
    { mat, part, z: 0.8, tone: -0.12, tex: strands({ angle: -0.5, width: 1.25, seed: 21 }) },
  );
}

function drawFace(c: HdCanvas, expr: Expression, skinR: readonly Color[], hairR: readonly Color[], glint: boolean): void {
  const ink = PAL_HD.ink[0];
  const white = PAL_HD.snow[5];
  const lip = skinR[2];
  const brow = hairR[1];
  const closed = expr === 'blink' || expr === 'yawn' || expr === 'chew' || expr === 'happy';
  const wide = expr === 'panic' || expr === 'dazed';
  // Eye.
  if (closed) {
    c.paint(EYE_X - 0.9, EYE_Y, 1.8, 0.5, (x, y) => (Math.abs(y - EYE_Y - 0.1 - (expr === 'happy' ? -Math.abs(x - EYE_X) * 0.3 : 0)) < 0.26 ? ink : 0));
  } else {
    const ry = wide ? 1.25 : 1.15;
    c.paint(EYE_X - 1.1, EYE_Y - 1.3, 2.2, 2.6, (x, y) => {
      const u = (x - EYE_X) / 0.9;
      const v = (y - EYE_Y) / ry;
      if (u * u + v * v > 1) return 0;
      if (wide && x < EYE_X - 0.1) return white;
      if (x > EYE_X + 0.35 && !wide) return white;
      if (glint && c.d >= 2 && x < EYE_X && y < EYE_Y - ry * 0.25 && x > EYE_X - 0.5) return white;
      return ink;
    });
  }
  // Brow.
  const raise = expr === 'panic' || expr === 'dazed' ? -0.6 : 0;
  const angry = expr === 'shout' ? 0.5 : 0;
  c.paint(EYE_X - 1.6, EYE_Y - 2.6 + raise, 3.2, 1.4, (x, y) => {
    const t = (x - (EYE_X - 1.5)) / 3;
    if (t < 0 || t > 1) return 0;
    const cy = EYE_Y - 1.7 + raise + (t - 0.5) * angry - Math.sin(t * Math.PI) * 0.25;
    return Math.abs(y - cy) < 0.42 + (1 - t) * 0.12 ? brow : 0;
  });
  // Mouth.
  const mx = 13.0;
  const my = 15.4;
  if (expr === 'shout' || expr === 'panic' || expr === 'yawn') {
    const h = expr === 'yawn' ? 1.6 : 1.1;
    c.paint(mx - 1.2, my - 0.6, 2.4, h + 0.8, (x, y) => {
      const u = (x - mx) / 1.0;
      const v = (y - my - h * 0.3) / (h * 0.6);
      const q = u * u + v * v;
      if (q > 1) return 0;
      return v > 0.35 && q < 0.6 ? PAL_HD.red[4] : ink;
    });
  } else {
    const smile = expr === 'happy' ? 0.35 : expr === 'hurt' ? -0.25 : 0;
    c.paint(mx - 1.4, my - 0.6, 2.4, 1.2, (x, y) => {
      const t = (x - (mx - 1.3)) / 2.1;
      if (t < 0 || t > 1) return 0;
      const cy = my - smile * Math.sin(t * Math.PI) + (t - 0.5) * 0.2;
      return Math.abs(y - cy) < 0.28 ? lip : 0;
    });
  }
}

function drawGear(c: HdCanvas, s: HeadStyle, mat: number): void {
  const part = c.newPart();
  const slip = s.hatDy ?? 0;
  const g = s.headgear;
  if (g === 'helmet' || g === 'bobble' || g === 'fur-hat' || g === 'hood') {
    c.heightField(2, 3.5 + slip, 15, 8, (x, y) => {
      const dx = (x - 9.2) / 6.6;
      const dy = (y - (10.8 + slip)) / 6.0;
      const q = dx * dx + dy * dy;
      if (q > 1 || y > 10.6 + slip) return NaN;
      return Math.sqrt(1 - q) * 6 + 1.5;
    }, { mat, part, z: 2 });
    c.box(2.4, 9.6 + slip, 13.6, 1.2, { mat, part: c.newPart(), z: 2.5, bevel: 0.4, r: 0.5 });
  } else if (g === 'cap' || g === 'cap-back') {
    const back = g === 'cap-back';
    c.heightField(3, 4.6 + slip, 12.5, 6, (x, y) => {
      const dx = (x - 9.0) / 5.9;
      const dy = (y - (10.6 + slip)) / 5.4;
      const q = dx * dx + dy * dy;
      if (q > 1 || y > 10.0 + slip) return NaN;
      return Math.sqrt(1 - q) * 5 + 1.2;
    }, { mat, part, z: 2 });
    const px = back ? 1.0 : 12.0;
    c.box(px, 9.3 + slip, 5, 1, { mat, part: c.newPart(), z: 2.6, bevel: 0.3, r: 0.4, n: [0, -0.6, 0.8] });
  } else {
    // beret, bandana, shako, rainhat, headset, goggles, beret-slouch: a soft band / shell.
    c.heightField(2.6, 4.8 + slip, 13, 6, (x, y) => {
      const dx = (x - 8.6) / 6.2;
      const dy = (y - (9.2 + slip)) / 3.6;
      const q = dx * dx + dy * dy;
      if (q > 1) return NaN;
      return Math.sqrt(1 - q) * 3 + 1.2;
    }, { mat, part, z: 2 });
  }
}
