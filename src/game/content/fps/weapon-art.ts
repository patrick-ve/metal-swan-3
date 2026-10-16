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
import { add, Figure, lerp3, renderFigure, rotX, type Mat, type V3 } from '../../art/figure3d';
import { muzzleFlash } from './billboards';

export const VIEW_W = 112;
export const VIEW_H = 80;

const m = (ramp: Ramp, bias = 0, line?: Color): Mat => ({ ramp, bias, line });
const GLOVE = m([PAL.ink[0], PAL.ink[1], PAL.hairA[2], PAL.steel[1]], 0.2, INK);
const CUFF = m([PAL.brown[1], PAL.sand[0], PAL.sand[1], PAL.sand[2]], -0.3, PAL.brown[0]);
const GUN = m([PAL.ink[0], PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3]], 0.2, INK);
const WOOD = m([PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]], 0.2, PAL.ink[1]);
const BLADE = m([PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[2]], 0.3, PAL.steel[0]);
const BRASS = m(PAL.brass, 0.2, PAL.brown[0]);

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

function render(f: Figure, muzzle: V3 | null, p: ViewPose, cx = VIEW_W / 2, tilt = -1.05, flashR = 7, scale = 2.3): PixelBuffer {
  const size = 160;
  if (p.flash && muzzle) {
    const mz = muzzle;
    f.overlay((b, pr) => muzzleFlash(b, pr, mz, flashR));
  }
  const b = renderFigure(f, { size, yaw: 4, pose: rotX(tilt), ground: size + 4, cx: cx + (size - VIEW_W) / 2, scale });
  return b.crop((size - VIEW_W) / 2, size - VIEW_H, VIEW_W, VIEW_H).touch();
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

function pistol(frame: number): PixelBuffer {
  const p: ViewPose = [P0, { ...P0, kick: 1, flash: true }, { ...P0, kick: 0.7 }, { ...P0, kick: 0.25 }][frame];
  const f = new Figure();
  const k = p.kick;
  const base: V3 = [4, -2 + k * 3, 14 - k * 5];
  const at = (v: V3): V3 => add(base, v);
  f.box(at([0, 3, 9]), [2.2, 2.2, 9], GUN); // slide
  f.cyl(at([0, 3.2, 9]), 2.3, 8.6, GUN, rotX(Math.PI / 2));
  f.box(at([0, 1.2, 9]), [1.9, 1.4, 8.5], GUN);
  f.box(at([0, -3, 1]), [2, 5, 2.6], WOOD, rotX(-0.3)); // grip
  for (let z = 1; z < 5; z += 1.3) f.dot(at([0, 5.6, z]), PAL.ink[0], 1, 2); // serrations
  f.box(at([0.8, 5.3, 8]), [1, 0.3, 2.2], m([PAL.ink[0], PAL.ink[1]])); // ejection port
  f.dot(at([0, 5.8, 17]), PAL.snow[2], 1, 2); // front sight
  f.dot(at([-1.2, 5.8, 0.6]), PAL.snow[2], 1, 2); // rear sight
  f.dot(at([1.2, 5.8, 0.6]), PAL.snow[2], 1, 2);
  arm(f, at([0.5, -4, 0]), at([12, -20, -24]));
  arm(f, at([-3, -5, 1]), at([-16, -22, -20]));
  return render(f, at([0, 3, 19]), p, VIEW_W / 2, -0.8, 9, 3.1);
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

function chaingun(frame: number): PixelBuffer {
  const p: ViewPose = [P0, { ...P0, kick: 0.6, flash: true, spin: 0.5 }, { ...P0, kick: 0.8, flash: true, spin: 1 }, { ...P0, kick: 0.2, spin: 1.5 }][frame];
  const f = new Figure();
  const k = p.kick;
  const base: V3 = [0, -6 + k * 2, 6 - k * 2];
  const at = (v: V3): V3 => add(base, v);
  f.cyl(at([0, 4, 6]), 6.5, 9, GUN, rotX(Math.PI / 2)); // housing
  f.box(at([0, -1, 4]), [4, 3, 7], GUN);
  f.dot(at([0, 10.6, 0]), PAL.red[2], 2, 2); // a lamp on the housing
  f.box(at([0, 9, 4]), [2, 1.5, 5], GUN); // carry handle
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + p.spin;
    const ox = Math.cos(a) * 3;
    const oy = Math.sin(a) * 3;
    f.cap(at([ox, 4 + oy, 14]), at([ox, 4 + oy, 40]), 1.2, 1.1, GUN);
  }
  f.cap(at([0, 4, 16]), at([0, 4, 17.5]), 4.8, 4.8, m([PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3]]));
  f.cap(at([0, 4, 34]), at([0, 4, 35]), 4.5, 4.5, m([PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3]]));
  f.box(at([7.5, 0, 4]), [1.5, 4, 3], BRASS); // ammo belt feed
  f.cap(at([8, -4, 2]), at([12, -14, -4]), 1.6, 1.6, BRASS);
  arm(f, at([5, -3, 0]), at([18, -22, -20]));
  arm(f, at([-6, 1, 6]), at([-22, -18, -12]));
  return render(f, at([0, 4, 41]), p, VIEW_W / 2, -0.9, 10);
}

const VIEWS: Readonly<Record<string, (frame: number) => PixelBuffer>> = { knife, pistol, mg, chaingun };

/** The §8.3 view ids (tests). */
export const VIEW_IDS: readonly string[] = Object.keys(VIEWS).map((id) => `fps/view/${id}`);

for (const [id, gen] of Object.entries(VIEWS)) defineSprite(`fps/view/${id}`, () => [0, 1, 2, 3].map((fr) => gen(fr)), { anchor: 'feet' });

