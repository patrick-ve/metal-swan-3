/**
 * The first-person mode's props (docs/design/fps.md §8.2, §5.1 `Q`–`Z`, `'` `,` `"`): 64 × 64
 * billboards, 1 yaw, 1 frame. Built with the 3D rig (seen a little from above, so tops read) plus
 * 2D details. The historical symbol appears only on the `banner-pole` flag (spec §0).
 */
import type { Color } from '../../../engine/color';
import { INK, PAL, type Ramp } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { defineRayBillboard } from '../../../engine/ray';
import { Figure, renderFigure, rotX, rotY, rotZ, type Mat } from '../../art/figure3d';
import { hash2 } from '../../art/paint';
import { hookedCross } from '../../art/wall-tex';

const S = 64;
const G = 62;

const m = (ramp: Ramp, bias = 0, line?: Color): Mat => ({ ramp, bias, line });
const WOOD = m([PAL.brown[0], PAL.brown[1], PAL.brown[2], PAL.brown[3]]);
const WOOD_DARK = m([PAL.ink[1], PAL.brown[0], PAL.brown[1], PAL.brown[2]]);
const IRON = m([PAL.ink[0], PAL.steel[0], PAL.steel[1], PAL.steel[2]], 0, INK);
const STEEL = m([PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4]]);
const CONCRETE = m([PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]]);
const SAND = m([PAL.sand[0], PAL.sand[1], PAL.sand[2], PAL.sand[3]]);
const OLIVE = m([PAL.olive[0], PAL.olive[1], PAL.olive[2], PAL.olive[3]]);
const RED = m([PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]]);
const BRASS = m(PAL.brass);
const LAMP: Mat = { ramp: [PAL.gold[3]], glow: true };

/** Render a prop seen slightly from above (`tilt` radians). */
function look(f: Figure, tilt = 0.32, scale = 1): PixelBuffer {
  return renderFigure(f, { size: S, yaw: 0, pose: rotX(tilt), ground: G, scale });
}

function barrel(): PixelBuffer {
  const f = new Figure();
  f.cyl([0, 14, 0], 10, 13, WOOD);
  f.cyl([0, 14, 0], 11, 7, WOOD);
  f.cyl([0, 14, 0], 10.6, 10, WOOD);
  f.cyl([0, 27, 0], 8.6, 0.2, WOOD_DARK);
  for (const y of [3, 13.5, 24]) f.cyl([0, y, 0], y === 13.5 ? 11.3 : 10.4, 1.0, IRON);
  f.dot([3, 27, 3], PAL.brown[0], 2);
  const b = look(f, 0.38);
  // staves
  for (let x = 22; x < 44; x += 4) for (let y = 30; y < 58; y++) if ((b.data[y * S + x] & 255) !== 0 && b.data[y * S + x] !== INK && hash2(x, y, 3) < 0.7) b.data[y * S + x] = PAL.brown[0];
  return b;
}

function crates(): PixelBuffer {
  const f = new Figure();
  f.box([-4, 9, 0], [11, 9, 9], WOOD);
  f.box([-4, 9, 9.1], [6, 1, 0.1], m([PAL.sand[1], PAL.sand[2]])); // stencil bar
  f.box([7, 27, -2], [9, 8, 8], WOOD, rotY(0.25));
  const b = look(f, 0.3);
  // board lines and stencil bars on the faces
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const c = b.data[y * S + x];
      if (c === PAL.brown[2] || c === PAL.brown[3] || c === PAL.brown[1]) {
        if (y % 5 === 0) b.data[y * S + x] = PAL.brown[1];
        if (x % 11 === 0 && y > 38) b.data[y * S + x] = PAL.brown[0];
      }
    }
  }
  return b;
}

function pillar(): PixelBuffer {
  const f = new Figure();
  f.box([0, 30, 0], [9, 30, 9], CONCRETE);
  f.box([0, 2, 0], [11, 2, 11], CONCRETE);
  f.box([0, 61, 0], [11, 2.5, 11], CONCRETE);
  const b = renderFigure(f, { size: S, yaw: 0, angle: 0.35, ground: G + 1, outline: false });
  // hazard band and stains
  for (let y = 44; y < 50; y++) for (let x = 0; x < S; x++) if ((b.data[y * S + x] & 255) !== 0) b.data[y * S + x] = ((x + y) >> 2) & 1 ? INK : PAL.gold[2];
  for (let i = 0; i < 40; i++) {
    const x = 22 + Math.floor(hash2(i, 1, 5) * 20);
    const y = 6 + Math.floor(hash2(i, 2, 5) * 36);
    if ((b.data[y * S + x] & 255) !== 0) b.data[y * S + x] = PAL.stone[0];
  }
  return b;
}

function table(): PixelBuffer {
  const f = new Figure();
  f.box([0, 17, 0], [18, 1.4, 10], WOOD);
  for (const [x, z] of [[-15, -7], [15, -7], [-15, 7], [15, 7]] as const) f.box([x, 8, z], [1.3, 8, 1.3], WOOD_DARK);
  // a field telephone, papers and a mug
  f.box([-8, 21, 0], [4, 2.6, 3], IRON);
  f.cap([-11, 24.5, 0], [-5, 24.5, 0], 1.1, 1.1, IRON);
  f.box([6, 18.7, 1], [5, 0.3, 3.6], m([PAL.stone[2], PAL.stone[3], PAL.snow[1]]));
  f.cap([13, 18.5, -3], [13, 22, -3], 1.6, 1.6, m([PAL.steel[1], PAL.steel[2], PAL.snow[0]]));
  return look(f, 0.42);
}

function bannerPole(): PixelBuffer {
  const f = new Figure();
  // the pole at texel x 20 (yaw 0 mirrors body x): the flag hangs from it to the right
  f.cap([12, 0, 0], [12, 60, 0], 1.2, 1.0, BRASS);
  f.ball([12, 61, 0], 1.8, BRASS);
  f.box([12, 1, 0], [5, 1, 5], IRON);
  const b = renderFigure(f, { size: S, yaw: 0, ground: G });
  // the flag: red field, white disc, the black historical symbol, a slight wave. Big disc and
  // strokes ≥ 3 texels: thin strokes aliased into a chequer at mid range (polish-fix).
  const x0 = 21;
  const y0 = 3;
  const w = 38;
  const h = 28;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wave = Math.round(Math.sin(x / 5) * 1.2);
      const yy = y0 + y + wave;
      const shade = Math.cos(x / 5) > 0.6 ? PAL.red[2] : Math.cos(x / 5) < -0.6 ? PAL.red[0] : PAL.red[1];
      b.set(x0 + x, yy, y === 0 || y === h - 1 ? PAL.red[0] : shade);
    }
  }
  const cx = x0 + w / 2;
  const cy = y0 + h / 2 + Math.round(Math.sin(w / 10) * 1.2);
  b.circle(cx - 0.5, cy - 0.5, 10, PAL.snow[2]);
  hookedCross(b, cx, cy, 7.8, INK, false);
  // fixings to the pole
  b.rect(x0 - 1, y0 + 1, 2, 2, PAL.steel[2]);
  b.rect(x0 - 1, y0 + h - 3, 2, 2, PAL.steel[2]);
  return b.touch();
}

function lampStand(): PixelBuffer {
  const f = new Figure();
  f.ell([0, 1.5, 0], [7, 1.5, 7], IRON);
  f.cap([0, 2, 0], [0, 44, 0], 1, 1, IRON);
  f.cap([0, 44, 0], [7, 46, 0], 0.8, 0.8, IRON);
  f.cap([8, 47, 0], [10, 41, 0], 2, 5.5, OLIVE);
  f.ball([10.5, 40.5, 0], 2.4, LAMP);
  const b = renderFigure(f, { size: S, yaw: 0, ground: G });
  // light cone on the floor
  for (let y = 44; y < 62; y++) for (let x = 30 + ((62 - y) >> 1); x < 54 - ((62 - y) >> 2); x++) if ((b.data[y * S + x] & 255) === 0 && ((x + y) & 3) === 0 && y > 58) b.set(x, y, PAL.gold[1]);
  return b.touch();
}

function sandbags(): PixelBuffer {
  const f = new Figure();
  const rows = [
    [-18, -9, 0, 9, 18],
    [-13.5, -4.5, 4.5, 13.5],
    [-9, 0, 9],
  ];
  rows.forEach((xs, r) => {
    for (const x of xs) f.ell([x, 4 + r * 7, (r % 2) * -1], [5, 3.8, 6], SAND, rotZ(hash2(x, r, 1) * 0.2 - 0.1));
  });
  const b = look(f, 0.3);
  for (let i = 0; i < 40; i++) {
    const x = 8 + Math.floor(hash2(i, 1, 7) * 48);
    const y = 30 + Math.floor(hash2(i, 2, 7) * 30);
    if (b.data[y * S + x] === PAL.sand[2]) b.data[y * S + x] = PAL.sand[1];
  }
  return b;
}

function oilDrum(): PixelBuffer {
  const f = new Figure();
  f.cyl([0, 15.5, 0], 10, 15, RED);
  for (const y of [1.5, 10.5, 20.5, 29.5]) f.cyl([0, y, 0], 10.5, 0.8, m([PAL.red[0], PAL.red[1], PAL.red[2]]));
  f.ball([4, 31.5, -3], 1.4, STEEL);
  const b = look(f, 0.36);
  // stencilled bands (no text) and scratches
  for (let x = 24; x < 40; x++) {
    b.set(x, 41, PAL.sand[3]);
    b.set(x, 43, PAL.sand[3]);
  }
  for (let i = 0; i < 20; i++) {
    const x = 22 + Math.floor(hash2(i, 1, 9) * 20);
    const y = 30 + Math.floor(hash2(i, 2, 9) * 28);
    if (b.data[y * S + x] === PAL.red[1] || b.data[y * S + x] === PAL.red[2]) b.data[y * S + x] = PAL.rust[1];
  }
  return b;
}

function ceilingLamp(): PixelBuffer {
  // hangs from the top of the billboard (non-solid)
  const b = new PixelBuffer(S, S);
  b.vline(32, 0, 7, PAL.steel[1]);
  b.vline(31, 0, 7, INK);
  for (let y = 8; y < 14; y++) {
    const half = 3 + (y - 8) * 1.6;
    for (let x = Math.round(32 - half); x <= Math.round(31 + half); x++) b.set(x, y, y === 8 ? PAL.olive[3] : x < 30 ? PAL.olive[2] : x > 34 ? PAL.olive[0] : PAL.olive[1]);
  }
  b.hline(22, 41, 14, PAL.olive[0]);
  b.rect(28, 15, 8, 2, PAL.gold[3]);
  b.rect(30, 17, 4, 1, PAL.gold[2]);
  for (let i = 0; i < 6; i++) b.set(26 + i * 2 + (i & 1), 19 + (i & 1), PAL.gold[1]);
  return b.touch();
}

function debris(): PixelBuffer {
  const f = new Figure();
  for (let i = 0; i < 14; i++) {
    const x = (hash2(i, 1, 13) - 0.5) * 40;
    const z = (hash2(i, 2, 13) - 0.5) * 16;
    const r = 1.5 + hash2(i, 3, 13) * 3;
    const mat = i % 4 === 0 ? IRON : i % 4 === 1 ? WOOD_DARK : CONCRETE;
    if (i % 3 === 0) f.box([x, r * 0.5, z], [r, r * 0.5, r * 0.7], mat, rotY(hash2(i, 4, 13) * 3));
    else f.ell([x, r * 0.4, z], [r, r * 0.6, r], mat);
  }
  f.box([4, 1.2, 2], [9, 0.6, 1.2], WOOD, rotY(0.5));
  return look(f, 0.6);
}

function chains(): PixelBuffer {
  // hanging chains with a hook (non-solid, from the top)
  const b = new PixelBuffer(S, S);
  for (const [x0, len] of [[26, 30], [36, 22], [31, 38]] as const) {
    for (let y = 0; y < len; y += 3) {
      const odd = (y / 3) & 1;
      if (odd) {
        b.rect(x0 - 1, y, 3, 3, PAL.steel[1]);
        b.set(x0, y + 1, INK);
      } else {
        b.vline(x0, y, y + 2, PAL.steel[2]);
        b.set(x0, y, PAL.steel[3]);
      }
    }
    if (len === 38) {
      // a hook
      b.vline(x0, 38, 42, PAL.steel[2]);
      b.hline(x0 - 3, x0, 43, PAL.steel[2]);
      b.vline(x0 - 3, 40, 43, PAL.steel[2]);
    }
  }
  return b.touch();
}

const PROPS: Readonly<Record<string, () => PixelBuffer>> = {
  barrel,
  crates,
  pillar,
  table,
  'banner-pole': bannerPole,
  'lamp-stand': lampStand,
  sandbags,
  'oil-drum': oilDrum,
  'ceiling-lamp': ceilingLamp,
  debris,
  chains,
};

/** The §8.2 prop ids (tests). */
export const PROP_IDS: readonly string[] = Object.keys(PROPS);

for (const [id, gen] of Object.entries(PROPS)) defineRayBillboard(`fps/prop/${id}`, { yaws: 1, frames: 1, gen: () => gen() });

void rotZ;
