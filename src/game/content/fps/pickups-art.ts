/**
 * The first-person mode's pickups (docs/design/fps.md §4.5, §8.2 `fps/item/<id>`): 64 × 64
 * billboards, the item in the lower third. Our own designs: no red cross (or any cross) on the
 * first-aid pouch, no plate, no bowl, no chest, crown, chalice or cross among the treasures.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL, type Ramp } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { defineRayBillboard } from '../../../engine/ray';
import { Figure, lookAlong, norm3, renderFigure, rotX, rotY, rotZ, mulMM, type Mat, type V3 } from '../../art/figure3d';

const S = 64;
const G = 62;

const m = (ramp: Ramp, bias = 0, line?: Color): Mat => ({ ramp, bias, line });
const OLIVE = m([PAL.olive[0], PAL.olive[1], PAL.olive[2], PAL.olive[3]]);
const KHAKI = m([PAL.sand[0], PAL.sand[1], PAL.sand[2], PAL.sand[3]]);
const WHITE = m([PAL.stone[2], PAL.stone[3], PAL.snow[1], PAL.snow[2]]);
const BRASS = m(PAL.brass, 0.2, PAL.brown[0]);
const GOLD = m([PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]], 0.3, PAL.brown[0]);
const STEEL = m([PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4]]);
const GUN = m([PAL.ink[0], PAL.steel[0], PAL.steel[1], PAL.steel[2]], 0.2, INK);
const WOOD = m([PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]]);
const BREAD = m([PAL.brown[1], PAL.brown[2], PAL.sand[1], PAL.sand[2]]);
const SAUSAGE = m([PAL.brown[0], PAL.rust[0], PAL.rust[1], PAL.brown[3]]);
const VELVET = m([PAL.purple[0], PAL.purple[1], PAL.purple[2]]);
const PAPER = m([PAL.sand[1], PAL.sand[2], PAL.sand[3]]);
const VINYL = m([PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]], 0.4);
const SLEEVE = m([PAL.ink[1], PAL.navy[1], PAL.sky[0], PAL.sky[1]]);
const CANVAS = m([PAL.olive[1], PAL.olive[2], PAL.sand[1], PAL.sand[2]]);
const TIN_SWAN = m([PAL.steel[2], PAL.steel[3], PAL.snow[0], PAL.snow[1], PAL.snow[2]], 0.2, PAL.steel[1]);
const JEWEL_R: Mat = { ramp: [PAL.red[3]], glow: true };
const JEWEL_B: Mat = { ramp: [PAL.teal[3]], glow: true };
const BEAK = m([PAL.orange[0], PAL.orange[1], PAL.gold[2]]);

/** Render an item seen from above-front (tilt) at `scale` texels per unit. */
function look(f: Figure, scale = 1, tilt = 0.55, angle = 0.35): PixelBuffer {
  return renderFigure(f, { size: S, angle, pose: rotX(tilt), ground: G, scale });
}

/** A floor shadow under an item (drawn under the opaque texels). */
function shadow(b: PixelBuffer, w: number): PixelBuffer {
  const cx = S / 2;
  for (let x = Math.round(cx - w / 2); x < cx + w / 2; x++) {
    for (const y of [G, G + 1]) if ((b.data[y * S + x] & 255) === 0 && ((x + y) & 1) === 0) b.data[y * S + x] = PAL.ink[1];
  }
  return b.touch();
}

const ITEMS: Record<string, () => PixelBuffer> = {
  'first-aid': () => {
    // olive canvas belt pouch, a white band, a brass snap — no cross of any kind
    const f = new Figure();
    f.box([0, 5, 0], [8, 5, 3.5], OLIVE);
    f.box([0, 9.5, 1.5], [8.2, 1.2, 3.0], OLIVE, rotX(0.4)); // the flap
    f.box([0, 5, 3.6], [8.1, 1.4, 0.2], WHITE);
    f.ball([0, 8.6, 3.9], 1.0, BRASS);
    f.box([0, 5, -3.7], [3, 4, 0.3], m([PAL.brown[0], PAL.brown[1], PAL.brown[2]]));
    return shadow(look(f, 1.6), 30);
  },
  food: () => {
    // an open steel mess tin with a slice of bread and a sausage
    const f = new Figure();
    f.box([0, 2.5, 0], [9, 2.5, 6], STEEL);
    f.box([0, 4.6, 0], [8, 0.6, 5], m([PAL.steel[0], PAL.steel[1]]));
    f.cap([-13, 3.2, 0], [-9.2, 3.2, 0], 0.8, 0.8, STEEL); // the handle
    f.box([-3, 5.6, -0.5], [4, 1.1, 3.5], BREAD, rotY(0.3));
    f.cap([2, 6, 1.5], [8, 6.3, -0.5], 1.6, 1.6, SAUSAGE);
    f.dot([-3, 6.8, 2.5], PAL.sand[3], 2);
    return shadow(look(f, 1.5, 0.7), 34);
  },
  ration: () => {
    // a dented olive tin with a key on the lid
    const f = new Figure();
    f.cyl([0, 4, 0], 5.5, 4, OLIVE);
    f.cyl([0, 8.1, 0], 5.6, 0.3, m([PAL.olive[1], PAL.olive[2], PAL.olive[3]]));
    f.cap([-3, 8, 0], [3, 8, 0], 0.5, 0.5, STEEL);
    f.ball([3.6, 8, 0], 1.1, STEEL);
    f.dot([2.5, 3.5, 5.4], PAL.olive[0], 2); // the dent
    f.box([0, 4, 5.4], [3, 1.3, 0.2], KHAKI);
    return shadow(look(f, 1.6), 20);
  },
  'blood-pool': () => {
    const b = new PixelBuffer(S, S);
    for (let y = G - 4; y <= G + 1; y++) {
      for (let x = 20; x < 44; x++) {
        const ex = (x + 0.5 - 32) / 11;
        const ey = (y + 0.5 - (G - 1.5)) / 3.2;
        const d = ex * ex + ey * ey + Math.sin(x * 1.7) * 0.08;
        if (d > 1) continue;
        b.set(x, y, d < 0.3 ? PAL.red[2] : d < 0.7 ? PAL.red[1] : PAL.red[0]);
      }
    }
    b.set(29, G - 3, PAL.red[3]);
    return b.touch();
  },
  clip: () => {
    // a small khaki cardboard box of cartridges, two rounds poking out
    const f = new Figure();
    f.box([0, 4, 0], [6, 4, 3.5], KHAKI);
    f.box([0, 8.2, 0], [6.2, 0.4, 3.7], m([PAL.sand[0], PAL.sand[1], PAL.sand[2]]));
    for (const x of [-2, 1]) {
      f.cap([x, 8, 0], [x, 12, 0], 0.9, 0.9, BRASS);
      f.ball([x, 12.4, 0], 0.8, m([PAL.brown[1], PAL.rust[1], PAL.orange[0]]));
    }
    f.box([0, 4, 3.6], [4, 1.2, 0.2], m([PAL.olive[0], PAL.olive[1]]));
    return shadow(look(f, 1.6), 22);
  },
  'clip-drop': () => {
    // a single loose stripper clip of five brass rounds
    const f = new Figure();
    f.box([0, 1, 0], [5.6, 0.5, 1], STEEL);
    for (let k = 0; k < 5; k++) {
      const x = -4.4 + k * 2.2;
      f.cap([x, 1.2, 0], [x, 1.2, 7], 0.95, 0.95, BRASS);
      f.ball([x, 1.2, 7.4], 0.8, m([PAL.rust[0], PAL.rust[1], PAL.orange[0]]));
    }
    return shadow(look(f, 1.8, 0.75, 0.6), 22);
  },
  mg: () => {
    // the MG lying on its side, bipod folded
    const f = new Figure();
    const R = mulMM(rotY(1.45), rotZ(1.45));
    const at = (v: V3): V3 => {
      const [x, y, z] = v;
      return [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z + 3, R[6] * x + R[7] * y + R[8] * z];
    };
    f.box(at([0, 0, -2]), [1.6, 2.4, 9], GUN, R);
    f.box(at([0, -1, -13]), [1.3, 2.6, 4], WOOD, R);
    f.cap(at([0, 0.5, 7]), at([0, 0.5, 18]), 1.3, 1.1, GUN);
    f.cap(at([0, 0.5, 7]), at([0, 0.5, 12]), 1.9, 1.9, m([PAL.ink[0], PAL.steel[0], PAL.steel[1]])); // perforated jacket
    f.box(at([2.6, 0, 1]), [1.1, 3.6, 1.6], GUN, R); // drum
    f.cap(at([-0.8, -1.5, 12]), at([-0.8, -1.5, 4]), 0.4, 0.4, STEEL); // folded bipod
    return shadow(look(f, 1.3, 0.7, 0), 40);
  },
  chaingun: () => {
    // the rotary gun on a canvas sling, a coiled ammo belt
    const f = new Figure();
    const dir = norm3([1, 0, 0.15]);
    const rot = lookAlong(dir);
    f.box([-4, 4, 0], [2.6, 3, 5], GUN, rot);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      f.cap([2, 4 + Math.cos(a) * 1.4, Math.sin(a) * 1.4], [16, 4 + Math.cos(a) * 1.4, Math.sin(a) * 1.4 + 2], 0.6, 0.6, GUN);
    }
    f.ell([3, 4, 0.3], [0.8, 2.6, 2.6], STEEL, rotY(0));
    f.ell([12, 4, 1.6], [0.6, 2.4, 2.4], STEEL);
    f.box([-4, 7.2, 0], [5, 0.4, 1.2], CANVAS, rot); // the sling
    f.cap([-9, 1, 3], [-4, 1, 6], 1.2, 1.2, BRASS); // coiled belt
    f.cap([-4, 1, 6], [1, 1, 5], 1.2, 1.2, BRASS);
    f.cap([1, 1, 5], [-1, 1, 2], 1.2, 1.2, BRASS);
    return shadow(look(f, 1.4, 0.6, 0.1), 42);
  },
  'one-up': () => {
    // a tin toy swan with a wind-up key
    const f = new Figure();
    f.ell([0, 5, 0], [4.5, 3.5, 7], TIN_SWAN);
    f.ell([0, 7.5, -5], [3.5, 2.5, 3], TIN_SWAN, rotX(-0.6)); // tail
    f.cap([0, 6, 5], [0, 14, 6], 1.4, 1.1, TIN_SWAN); // neck
    f.ball([0, 15, 6.5], 2, TIN_SWAN);
    f.cap([0, 14.8, 8], [0, 14.2, 10.5], 0.8, 0.5, BEAK);
    f.dot([1.4, 15.6, 7.5], INK, 1, 1);
    f.dot([-1.4, 15.6, 7.5], INK, 1, 1);
    f.ell([3.8, 6.2, 0], [0.6, 2.3, 4.5], m([PAL.steel[1], PAL.steel[2], PAL.steel[3]]), rotX(0.3)); // wing
    f.ell([-3.8, 6.2, 0], [0.6, 2.3, 4.5], m([PAL.steel[1], PAL.steel[2], PAL.steel[3]]), rotX(0.3));
    f.ell([0, 1.5, 0], [5, 1.5, 7.5], m([PAL.red[0], PAL.red[1], PAL.red[2]])); // the toy's base
    f.cap([0, 6, -7], [0, 6, -10], 0.5, 0.5, BRASS); // key shaft
    f.ell([0, 6, -10.8], [3, 2, 0.6], BRASS);
    return shadow(look(f, 1.5, 0.35, 0.8), 22);
  },
  'pocket-watch': () => {
    // an open brass pocket watch on a chain
    const b = new PixelBuffer(S, S);
    const cx = 30;
    const cy = 52;
    b.ellipse(cx - 7, cy - 6, 15, 12, PAL.gold[1]);
    b.ellipse(cx - 6, cy - 5, 13, 10, PAL.snow[1]);
    b.ellipse(cx - 7, cy - 6, 15, 12, PAL.gold[0], false);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      b.set(Math.round(cx + Math.cos(a) * 5), Math.round(cy + Math.sin(a) * 4), PAL.stone[1]);
    }
    b.line(cx, cy, cx + 3, cy - 2, INK);
    b.line(cx, cy, cx, cy - 3, INK);
    // the open lid behind, the crown and the chain
    b.ellipse(cx - 6, cy - 16, 13, 9, PAL.gold[2]);
    b.ellipse(cx - 4, cy - 14, 9, 5, PAL.gold[1]);
    b.rect(cx - 1, cy - 8, 3, 2, PAL.gold[3]);
    for (let k = 0; k < 9; k++) b.set(cx + 8 + k * 2, cy + 4 - (k & 1) - Math.round(k / 3), k & 1 ? PAL.gold[2] : PAL.gold[0]);
    b.set(cx - 5, cy - 3, PAL.snow[3]);
    return shadow(b.touch(), 18);
  },
  'tuning-fork': () => {
    // a gold tuning fork on a velvet block
    const f = new Figure();
    f.box([0, 3, 0], [8, 3, 5], VELVET);
    f.cap([0, 6, 0], [0, 10, 0], 1.0, 1.0, GOLD);
    f.cap([-1.8, 10, 0], [-1.8, 22, 0], 0.9, 0.9, GOLD);
    f.cap([1.8, 10, 0], [1.8, 22, 0], 0.9, 0.9, GOLD);
    f.cap([-1.8, 10, 0], [1.8, 10, 0], 0.9, 0.9, GOLD);
    f.dot([-1.8, 20, 1], PAL.snow[3], 1, 1);
    return shadow(look(f, 1.4, 0.25), 24);
  },
  'gold-bars': () => {
    // three stacked gold bars
    const f = new Figure();
    f.box([-4.5, 2, 0], [4, 2, 6.5], GOLD);
    f.box([4.5, 2, 0], [4, 2, 6.5], GOLD);
    f.box([0, 6, 0], [4, 2, 6.5], GOLD, rotY(0.12));
    const b = look(f, 1.5, 0.6);
    // stamped marks (plain rectangles, no text)
    
    return shadow(b, 24);
  },
  'music-box': () => {
    // a jewelled music box, lid open, a tiny brass cylinder inside
    const f = new Figure();
    f.box([0, 4, 0], [8, 4, 5.5], m([PAL.red[0], PAL.red[1], PAL.red[2]]));
    f.box([0, 8.1, 0], [8.2, 0.4, 5.7], GOLD);
    f.box([0, 2, 0], [8.2, 0.4, 5.7], GOLD);
    f.box([0, 13.5, -6.5], [8, 5.5, 0.6], m([PAL.red[0], PAL.red[1], PAL.red[2]]), rotX(-0.25)); // open lid
    f.box([0, 7.5, 0], [6.5, 0.4, 4.5], m([PAL.purple[0], PAL.purple[1]])); // velvet inside
    f.cap([-4, 8.5, 0], [4, 8.5, 0], 1.4, 1.4, BRASS);
    for (const [x, mat] of [[-5, JEWEL_R], [0, JEWEL_B], [5, JEWEL_R]] as const) f.ball([x, 4.5, 5.6], 1.1, mat);
    f.ball([0, 14, -5.9], 1.3, JEWEL_B);
    return shadow(look(f, 1.5, 0.5), 28);
  },
  'golden-record': () => {
    // a gold vinyl disc half out of its paper sleeve
    const f = new Figure();
    f.box([-4, 9, 0], [9, 9, 0.6], SLEEVE, rotZ(0.12));
    f.ell([4, 11, 0.9], [8.5, 8.5, 0.5], VINYL, rotX(Math.PI / 2 - Math.PI / 2));
    const b = renderFigure(f, { size: S, yaw: 0, ground: G, scale: 1.2, angle: 0.25 });
    // grooves and the label
    const cx = 37;
    const cy = 48;
    for (let y = cy - 11; y <= cy + 11; y++) {
      for (let x = cx - 11; x <= cx + 11; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const c = b.get(x, y);
        if (!PAL.gold.includes(c)) continue;
        if (d < 2.5) b.set(x, y, PAL.gold[0]);
        else if (d < 4.5) b.set(x, y, PAL.red[2]);
        else if (Math.round(d) % 3 === 0) b.set(x, y, PAL.gold[1]);
      }
    }
    b.set(cx - 5, cy - 6, PAL.snow[3]);
    return shadow(b.touch(), 26);
  },
};

function bitKey(r: Ramp): PixelBuffer {
  // a large old bit key on a paper tag
  const f = new Figure();
  const mat = m(r, 0.3, PAL.ink[1]);
  f.ell([-8, 2, 0], [4, 1, 4], mat); // the bow (ring)
  f.ell([-8, 2.2, 0], [2, 1.2, 2], m([PAL.ink[0], PAL.ink[1]]));
  f.cap([-4, 1.5, 0], [10, 1.5, 0], 1.1, 1.1, mat);
  f.box([8.5, 1.5, 2.2], [1.4, 0.8, 1.8], mat);
  f.box([5.5, 1.5, 1.8], [0.8, 0.8, 1.2], mat);
  f.box([-13, 1.0, -4], [3.5, 0.3, 2.4], PAPER, rotY(0.4)); // tag
  f.cap([-10.5, 1.5, -1.5], [-11.5, 1.2, -3], 0.25, 0.25, m([PAL.stone[1], PAL.stone[2]]));
  return shadow(look(f, 1.5, 0.8, 0.2), 34);
}

ITEMS['key-gold'] = () => bitKey([PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]]);
ITEMS['key-silver'] = () => bitKey([PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[2]]);

for (const [id, gen] of Object.entries(ITEMS)) defineRayBillboard(`fps/item/${id}`, { yaws: 1, frames: 1, gen: () => gen() });
