/**
 * The first-person weapon views (docs/design/fps.md §8.3): `fps/view/knife`, `pistol`, `mg`,
 * `chaingun`, 112 × 80 normal sprites anchored bottom-centre ('feet'), drawn at (192, 176 + bob).
 * 4 frames: idle, fire A (flash), fire B, recover (knife: idle, wind-up, stab, return).
 * A dark glove and a khaki cuff. Built with the 3D rig, seen from behind and above (the barrel
 * points up the screen); our own designs.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL, type Ramp } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { defineSprite } from '../../../engine/sprites';
import { add, Figure, lerp3, mulMM, rotX, rotZ, type Mat, type V3 } from '../../art/figure3d';
import { muzzleFlash } from './billboards';
import { figWin, hdLook, withFigDensity } from './figure-hd';

export const VIEW_W = 112;
export const VIEW_H = 80;

const m = (ramp: Ramp, bias = 0, line?: Color): Mat => ({ ramp, bias, line });
const GLOVE = m([PAL.ink[0], PAL.ink[1], PAL.hairA[2], PAL.steel[1]], 0.2, INK);
const CUFF = m([PAL.brown[1], PAL.sand[0], PAL.sand[1], PAL.sand[2]], -0.3, PAL.brown[0]);
const GUN = m([PAL.ink[0], PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3]], 0.2, INK);
const WOOD = m([PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]], 0.2, PAL.ink[1]);
const BLADE = m([PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[2]], 0.3, PAL.steel[0]);
const BRASS = m(PAL.brass, 0.2, PAL.brown[0]);
const GUN_LIT = m([PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4]], 0.2, PAL.ink[1]);
const HOLE = m([PAL.ink[0], PAL.ink[0]], 0, INK);
const HOUSING = m([PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.steel[1], PAL.steel[2]], -0.1, INK);

/** Gun space: x right, y up, z forward (into the screen). The view tilts it so z points up. */
interface ViewPose {
  /** Recoil: back (−z) and up. */
  kick: number;
  /** Extra offset in gun space. */
  shift: V3;
  flash: boolean;
  /** Spin angle for the chaingun barrels. */
  spin: number;
}
const P0: ViewPose = { kick: 0, shift: [0, 0, 0], flash: false, spin: 0 };

function arm(f: Figure, hand: V3, from: V3): void {
  const wrist = lerp3(hand, from, 0.28);
  f.cap(from, wrist, 5, 4.4, CUFF);
  f.cap(wrist, hand, 3.8, 4.0, GLOVE);
  f.ball(hand, 4.3, GLOVE);
  f.dot(add(hand, [-1.5, 3.5, 0]), PAL.steel[1], 1, 2);
}

/**
 * Render a view: from behind (yaw 4), the gun tilted so its forward points up the screen. `turn`
 * (radians) turns it about the vertical to show one side (a 3/4 view); `lean` rolls it in the
 * screen plane (the barrel toward the centre).
 */
function render(f: Figure, muzzle: V3 | null, p: ViewPose, cx = VIEW_W / 2, tilt = -1.05, flashR = 7, scale = 2.3, turn = 0, lean = 0): PixelBuffer {
  const size = 160;
  if (p.flash && muzzle) {
    const mz = muzzle;
    f.overlay((b, pr) => muzzleFlash(b, pr, mz, flashR));
  }
  const pose = lean !== 0 ? mulMM(rotZ(lean), rotX(tilt)) : rotX(tilt);
  return figWin(f, { size, angle: Math.PI + turn, pose, ground: size + 4, cx: cx + (size - VIEW_W) / 2, scale }, (size - VIEW_W) / 2, size - VIEW_H, VIEW_W, VIEW_H).touch();
}

// The renderer views yaw 4 (from behind): the figure's +x (its right) is screen +x.

function knife(frame: number): PixelBuffer {
  const f = new Figure();
  // idle, wind-up, stab, return
  const hand: V3 = ([[14, -4, 16], [22, -10, 6], [6, -3, 22], [16, -6, 12]] as V3[])[frame];
  const bladeDir: V3 = ([[-0.25, 0.25, 1], [-0.1, 0.5, 1], [-0.05, 0.1, 1], [-0.25, 0.35, 1]] as V3[])[frame];
  const n = Math.hypot(...bladeDir);
  const d: V3 = [bladeDir[0] / n, bladeDir[1] / n, bladeDir[2] / n];
  arm(f, hand, add(hand, [14, -16, -26]));
  f.cap(add(hand, [0, 0, 2]), add(hand, [d[0] * 6, d[1] * 6, 2 + d[2] * 6]), 1.8, 1.8, WOOD);
  f.cap(add(hand, [d[0] * 7, d[1] * 7, 2 + d[2] * 7]), add(hand, [d[0] * 22, d[1] * 22, 2 + d[2] * 22]), 1.8, 0.3, BLADE);
  f.box(add(hand, [d[0] * 7, d[1] * 7, 2 + d[2] * 7]), [3, 0.8, 0.8], GUN);
  return render(f, null, P0, VIEW_W / 2, -1.05, 7, 2.6);
}

/**
 * The pistol (§8.3): a 3/4 view from behind (right of the eye, so its left side shows), the
 * barrel leaning to the screen centre — the slide top with the rear sight notch and
 * the front post, the hammer, the side serrations and the ejection port, the grip inside the dark
 * glove, the khaki cuff; the left hand cups under the grip.
 */
function pistol(frame: number): PixelBuffer {
  const p: ViewPose = [P0, { ...P0, kick: 1, flash: true }, { ...P0, kick: 0.7 }, { ...P0, kick: 0.25 }][frame];
  const f = new Figure();
  const k = p.kick;
  const base: V3 = [2, -1 + k * 3, 10 - k * 5];
  const at = (v: V3): V3 => add(base, v);
  // slide (with the bright top rib) over the frame
  f.box(at([0, 4.0, 7.5]), [2.0, 1.8, 9.0], GUN);
  f.box(at([0, 5.85, 7.5]), [1.3, 0.25, 8.8], GUN_LIT);
  f.box(at([0, 1.6, 9.5]), [1.7, 1.0, 6.5], GUN);
  // rear serrations on both sides, the ejection port on the right
  for (let z = -0.6; z < 3.5; z += 1.1) for (const sx of [2.05, -2.05]) f.box(at([sx, 4.1, z]), [0.1, 1.3, 0.3], HOLE);
  f.box(at([2.05, 4.6, 8.5]), [0.15, 0.9, 2.2], HOLE);
  // muzzle face
  f.box(at([0, 4.0, 16.55]), [1.9, 1.7, 0.1], GUN_LIT);
  f.dot(at([0, 3.8, 16.8]), PAL.ink[0], 1, 3);
  // sights: the rear notch (two posts) and the front post
  f.box(at([0.95, 6.35, -0.6]), [0.55, 0.55, 0.6], GUN);
  f.box(at([-0.95, 6.35, -0.6]), [0.55, 0.55, 0.6], GUN);
  f.box(at([0, 6.4, 15.6]), [0.35, 0.7, 0.6], GUN_LIT);
  // the hammer, cocked back
  f.box(at([0, 5.0, -2.3]), [0.75, 1.3, 0.9], GUN, rotX(0.5));
  // the trigger guard
  f.cap(at([0, 0.8, 7]), at([0, -1.3, 8.6]), 0.55, 0.55, GUN);
  f.cap(at([0, -1.3, 8.6]), at([0, -1.4, 5.5]), 0.55, 0.55, GUN);
  // the grip, mostly inside the glove
  f.box(at([0, -2.6, 0.4]), [1.8, 4.6, 2.7], WOOD, rotX(-0.28));
  // the gun hand round the grip, the other hand cupped under it
  arm(f, at([0.6, -3.2, 0.2]), at([10, -20, -24]));
  arm(f, at([-2.6, -5.2, 1.4]), at([-15, -22, -18]));
  return render(f, at([0, 4, 18]), p, VIEW_W / 2 + 26, -0.62, 9, 3.0, -0.38, 0.06);
}

function mg(frame: number): PixelBuffer {
  const p: ViewPose = [P0, { ...P0, kick: 1, flash: true }, { ...P0, kick: 0.6, flash: false }, { ...P0, kick: 0.2 }][frame];
  const f = new Figure();
  const k = p.kick;
  const base: V3 = [6, -4 + k * 2, 8 - k * 3];
  const at = (v: V3): V3 => add(base, v);
  f.box(at([0, 3, 10]), [3, 3, 13], GUN); // receiver
  f.cyl(at([0, 5, 10]), 2.4, 12, GUN, rotX(Math.PI / 2));
  f.box(at([2.5, 5.5, 4]), [0.8, 0.8, 4], m([PAL.ink[0], PAL.ink[1]])); // charging slot
  f.cap(at([0, 4, 20]), at([0, 4, 31]), 2.6, 2.2, m([PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.steel[1]])); // perforated jacket
  for (let z = 21; z < 31; z += 3) f.dot(at([0, 6.3, z]), PAL.ink[0], 1, 2);
  f.cap(at([0, 4, 31]), at([0, 4, 35]), 1.2, 1.2, GUN);
  f.box(at([0, 1, -6]), [2.5, 3.5, 6], WOOD); // stock
  f.box(at([-4.5, 4, 8]), [1.8, 1.2, 4], BRASS); // feed tray with rounds
  f.box(at([0, 7, 6]), [0.8, 1.2, 3], GUN); // rear sight
  arm(f, at([1, -3, 2]), at([14, -22, -22]));
  arm(f, at([-2, 1, 22]), at([-20, -18, -6]));
  return render(f, at([0, 4, 36]), p, VIEW_W / 2 + 4, -0.9, 9);
}

/**
 * The chaingun (§8.3): a wide, low housing with a carry handle, and a short cluster of six
 * barrels seen nearly end-on (the ring of muzzles shows); right of the screen centre, so the aim
 * point and the enemies' feet stay clear.
 */
function chaingun(frame: number): PixelBuffer {
  const p: ViewPose = [P0, { ...P0, kick: 0.6, flash: true, spin: 0.5 }, { ...P0, kick: 0.8, flash: true, spin: 1 }, { ...P0, kick: 0.2, spin: 1.5 }][frame];
  const f = new Figure();
  const k = p.kick;
  const base: V3 = [0, -3 + k * 2, 4 - k * 2];
  const at = (v: V3): V3 => add(base, v);
  // the housing: a wide, low, rounded drum in dark steel with a lit spine and side ribs
  f.ell(at([0, 3, 4]), [9, 5.6, 8.5], HOUSING);
  f.box(at([0, 8.3, 4]), [1.2, 0.4, 7], GUN_LIT);
  for (const sx of [5.5, -5.5]) f.box(at([sx, 6.6, 4]), [0.4, 0.4, 6.5], GUN);
  f.ell(at([0, 3, 12]), [6.5, 4.6, 1.2], m([PAL.ink[0], PAL.ink[1], PAL.steel[0]]));
  f.dot(at([6, 8.6, 0]), PAL.red[2], 2, 2); // the ready lamp
  // the carry handle
  f.cap(at([-4, 8.5, -1]), at([-4, 11.5, 2]), 0.9, 0.9, GUN);
  f.cap(at([-4, 11.5, 2]), at([-4, 11.5, 8]), 0.9, 0.9, GUN);
  f.cap(at([-4, 11.5, 8]), at([-4, 8.5, 10]), 0.9, 0.9, GUN);
  // six barrels round a hub, two clamp rings, the muzzle ring end-on
  const hub: V3 = at([0, 3, 12]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + p.spin;
    const ox = Math.cos(a) * 3.6;
    const oy = Math.sin(a) * 3.6;
    f.cap(add(hub, [ox, oy, 0]), add(hub, [ox, oy, 17]), 1.35, 1.25, GUN);
    f.dot(add(hub, [ox, oy, 17.6]), PAL.ink[0], 1, 3); // the muzzle hole
  }
  f.cyl(add(hub, [0, 0, 3]), 5.4, 0.8, GUN_LIT, rotX(Math.PI / 2));
  f.cyl(add(hub, [0, 0, 14.5]), 5.2, 0.7, GUN_LIT, rotX(Math.PI / 2));
  f.cyl(add(hub, [0, 0, 8]), 1.8, 7, GUN, rotX(Math.PI / 2));
  // the ammo belt from the right
  f.box(at([10.5, 1, 2]), [1.6, 3.5, 3], BRASS);
  f.cap(at([11, -3, 1]), at([15, -14, -4]), 1.7, 1.7, BRASS);
  // hands: the right on the grip under the housing, the left on the carry handle side
  arm(f, at([5, -3.5, -2]), at([18, -22, -20]));
  arm(f, at([-8.5, 2, 6]), at([-24, -16, -10]));
  return render(f, add(hub, [0, 0, 18.5]), p, VIEW_W / 2 + 30, -0.85, 10, 2.5, -0.22, 0);
}

const VIEWS: Readonly<Record<string, (frame: number) => PixelBuffer>> = { knife, pistol, mg, chaingun };

// UHD light of the view's materials (figure-hd.ts): oiled gun steel, a matte leather glove, a polished blade.
hdLook(GUN, { spec: 0.75, shine: 22, wrap: 0.05 });
hdLook(GUN_LIT, { spec: 0.9, shine: 26, wrap: 0.05 });
hdLook(HOUSING, { spec: 0.6, shine: 18, wrap: 0.05 });
hdLook(GLOVE, { spec: 0.25, shine: 12, wrap: 0.15 });
hdLook(CUFF, { wrap: 0.3 });
hdLook(BLADE, { spec: 1, shine: 34, wrap: 0.05 });
hdLook(WOOD, { spec: 0.2, shine: 14, wrap: 0.15 });
hdLook(BRASS, { spec: 1, shine: 24, wrap: 0.05 });

for (const [id, gen] of Object.entries(VIEWS)) {
  defineSprite(`fps/view/${id}`, () => [0, 1, 2, 3].map((fr) => gen(fr)), { anchor: 'feet', hd: (d) => withFigDensity(d, () => [0, 1, 2, 3].map((fr) => gen(fr))) });
}

