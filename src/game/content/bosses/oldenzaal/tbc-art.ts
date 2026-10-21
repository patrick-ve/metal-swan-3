/**
 * The TO BE CONTINUED card's art (docs/design/oldenzaal.md §1, §6; revision 2: her face stays on
 * the card, a teaser for stage 2). Owner: STATUE. Our own design, never from a photo, no likeness
 * of a real person.
 *
 * - `ui/oz-tbc/face` (2 frames: 0 a cold, knowing smile; 1 the laugh, the head tipped back a
 *   little): Mevrouw Winkel's face as a ghost — a middle-aged woman, dark grey hair pinned up in a
 *   bun, a high collar and a shawl — painted in the ghost-green ramp (the card draws it see-through
 *   with `drawGhost`). Anchor: the bottom centre.
 * - `ui/oz-tbc/jet` (2 frames, the burner flickers): the Swan far away, a dark silhouette with her
 *   rocket units glowing (the light streak crossing the night sky). Anchor: its nose.
 * - `ui/oz-tbc/glow` (1): a soft round glow for the face's additive pass.
 *
 * One density-generic drawer per id (1×: PAL ramps, 2× / 4×: PAL_HD_OZ); outline A for the face.
 */
import type { Color } from '../../../../engine/color';
import { nearest as nearestPal } from '../../../../engine/palette';
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { HdCanvas, strands } from '../../../art/hd';
import { hash2 } from '../../../art/paint';
import { Pen, type Dn } from '../../missions/oldenzaal/art-kit';

export const TBC_ART = 'ui/oz-tbc';
/** Every sprite id this module registers (tests). */
export const TBC_SPRITES: string[] = [];

const FACE_W = 64;
const FACE_H = 64;

function rampD(r: Ramp, d: Dn): Ramp {
  if (d !== 1) return r;
  const out: Color[] = [];
  for (const c of r) {
    const p = nearestPal(c) >>> 0;
    if (out[out.length - 1] !== p) out.push(p);
  }
  return out as unknown as Ramp;
}

function faceFrame(i: number, d: Dn): Frame {
  const c = new HdCanvas(FACE_W, FACE_H, d);
  const ghost = rampD(PAL_HD_OZ.ghost, d);
  const skin = c.material({ ramp: ghost, amb: 0.12, wrap: 0.2, rim: 0.5 });
  const hair = c.material({ ramp: ghost, amb: 0.04, gain: 0.55, wrap: 0.1, rim: 0.3 });
  const cloth = c.material({ ramp: ghost, amb: 0.05, gain: 0.5, wrap: 0.1 });
  const laugh = i === 1;
  const tilt = laugh ? -1.5 : 0;
  const hx = 32;
  const hy = 30 + tilt;
  // The shawl over the shoulders and the high collar.
  c.blob(
    [
      [4, 64],
      [12, 50],
      [24, 46],
      [40, 46],
      [52, 50],
      [60, 64],
    ],
    3,
    { mat: cloth, z: 1, bulge: 0.3 },
  );
  c.box(25, 40, 14, 9, { mat: cloth, z: 3, r: 2, bevel: 1.2 });
  c.shade(25, 40, 14, 9, (_x, y) => (Math.abs(y - 43) < 0.3 || Math.abs(y - 46) < 0.3 ? -0.3 : 0));
  c.capsule(32, 38, 32, 42, 4.6, 5, { mat: skin, z: 2 });
  // The face: an oval, narrower at the jaw; cheekbones, the brow, the nose.
  c.ellipsoid(hx, hy, 10.5, 13, { mat: skin, z: 5 });
  c.ellipsoid(hx, hy + 6, 8, 7, { mat: skin, z: 5.2 });
  c.ellipsoid(hx, hy + 1.5, 1.4, 3.4, { mat: skin, z: 7, tone: 0.1 });
  c.ellipsoid(hx - 5, hy + 2.5, 3, 2, { mat: skin, z: 6, tone: 0.05 });
  c.ellipsoid(hx + 5, hy + 2.5, 3, 2, { mat: skin, z: 6, tone: 0.05 });
  // Hollow eye sockets with a pale gleam, the thin brows.
  const deep = d === 1 ? nearestPal(PAL_HD.ink[1]) >>> 0 : PAL_HD.ink[1];
  const gleam = d === 1 ? nearestPal(PAL_HD_OZ.ghost[6]) >>> 0 : PAL_HD_OZ.ghost[6];
  for (const s of [-1, 1]) {
    const ex = hx + s * 4.4;
    const ey = hy - 1.5 + (laugh ? -0.4 : 0);
    c.paint(ex - 2.6, ey - 1.4, 5.2, 2.8, (x, y) => {
      const u = (x - ex) / 2.6;
      const v = (y - ey) / 1.4;
      if (u * u + v * v > 1) return 0;
      return u * u + v * v < 0.18 && !laugh ? gleam : deep;
    }, 8);
    c.shade(ex - 3, ey - 3.6, 6, 1, () => -0.5);
  }
  // The mouth: a thin cold smile (0) or open in a laugh (1). Never a scream.
  if (laugh) {
    c.paint(hx - 3.6, hy + 7, 7.2, 3.6, (x, y) => {
      const u = (x - hx) / 3.6;
      const v = (y - (hy + 8.2)) / 1.8;
      return u * u + v * v <= 1 ? deep : 0;
    }, 8);
  } else {
    c.paint(hx - 4, hy + 7.4, 8, 1.6, (x, y) => {
      const u = (x - hx) / 4;
      const yy = hy + 7.6 + 0.9 * (1 - u * u);
      return Math.abs(u) <= 1 && Math.abs(y - yy) < (d === 1 ? 0.6 : 0.35) ? deep : 0;
    }, 8);
  }
  // Dark grey hair, pinned up: parted in the middle, swept back over the ears into a bun.
  const hairTex = strands({ angle: Math.PI / 2, width: 1.4, seed: 7 });
  c.ellipsoid(hx, hy - 6.5, 12, 9.5, { mat: hair, z: 6, tex: hairTex });
  c.ellipsoid(hx - 10.5, hy + 0.5, 2.6, 6, { mat: hair, z: 6.2, tex: hairTex });
  c.ellipsoid(hx + 10.5, hy + 0.5, 2.6, 6, { mat: hair, z: 6.2, tex: hairTex });
  c.ellipsoid(hx, hy - 17, 6.8, 5, { mat: hair, z: 5.5, tex: strands({ angle: 0.6, width: 1.2, seed: 9 }) });
  // The hairline: let the forehead show under the parted hair.
  c.ellipsoid(hx, hy - 4.5, 8, 4.2, { mat: skin, z: 6.4 });
  c.shade(hx - 0.3, hy - 16, 0.6, 9, () => -0.4);
  const buf = c.render({ outline: 'A', ao: 0.4, rimLight: 2 });
  return d === 1 ? { buf, ox: FACE_W / 2, oy: FACE_H } : { buf, ox: FACE_W / 2, oy: FACE_H, density: d };
}

/** The Swan far off, seen from below and behind: a dark silhouette, wings swept, two burners. */
function jetFrame(i: number, d: Dn): Frame {
  const w = 20;
  const h = 10;
  const p = new Pen(w, h, d);
  const body = d === 1 ? nearestPal(PAL_HD.ink[1]) >>> 0 : PAL_HD.slate[2];
  const rim = d === 1 ? nearestPal(PAL_HD.slate[4]) >>> 0 : PAL_HD.slate[5];
  // The neck forward, the body, the swept wings.
  p.poly(
    [
      [1, 4],
      [5, 3.2],
      [9, 4],
      [15, 4.4],
      [18, 5.2],
      [15, 6.2],
      [8, 6],
      [4, 5],
    ],
    body,
  );
  p.poly(
    [
      [8, 4.2],
      [13, 0.6],
      [14.5, 1],
      [12, 4.6],
    ],
    body,
  );
  p.poly(
    [
      [9, 5.8],
      [14, 9],
      [15.6, 8.6],
      [12.6, 5.6],
    ],
    body,
  );
  if (d >= 2) p.rect(5, 3.4, 4, 1 / d, rim);
  // The rocket units' glow at the tail (flickering).
  const hot = (k: number): Color => (d === 1 ? nearestPal(PAL_HD.fire[k]) >>> 0 : PAL_HD.fire[k]);
  p.disc(18.6, 5.2, 1.3 + i * 0.3, 1.1, hot(6));
  p.disc(19, 5.2, 0.6, 0.6, hot(7));
  return p.frame(1, 4);
}

function glowFrame(d: Dn): Frame {
  const r = 40;
  const p = new Pen(r * 2, r * 2, d);
  p.disc(r, r, r - 0.5, r - 0.5, (X, Y, u, v) => {
    const q = Math.sqrt(u * u + v * v);
    const k = Math.floor((1 - q) * 3.2 + (hash2(X, Y, 5) - 0.5) * 0.5);
    if (k <= 0) return 0;
    const c = PAL_HD_OZ.ghost[Math.min(3, k)];
    return d === 1 ? nearestPal(c) >>> 0 : c;
  });
  return p.frame(r, r);
}

function reg(id: string, n: number, make: (i: number, d: Dn) => Frame): void {
  const frames = (d: Dn): Frame[] => Array.from({ length: n }, (_, i) => make(i, d));
  defineSprite(id, () => frames(1), { hd: (d) => frames(d as Dn), ticksPerFrame: 4 });
  TBC_SPRITES.push(id);
}

reg(`${TBC_ART}/face`, 2, faceFrame);
reg(`${TBC_ART}/jet`, 2, jetFrame);
reg(`${TBC_ART}/glow`, 1, (_i, d) => glowFrame(d));
