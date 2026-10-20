/**
 * The first-person mode's props (docs/design/fps.md §8.2, §5.1 `Q`–`Z`, `'` `,` `"`): 64 × 64
 * billboards, 1 yaw, 1 frame. Built with the 3D rig (seen a little from above, so tops read) plus
 * 2D details. The historical symbol appears only on the `banner-pole` flag (spec §0).
 */
import type { Color } from '../../../engine/color';
import { INK, PAL, type Ramp } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { Figure, rotX, rotY, rotZ, type Mat } from '../../art/figure3d';
import { hash2 } from '../../art/paint';
import { HdCanvas } from '../../art/hd';
import { eachArtPx, fig, figDensity, hdStep, withFigDensity } from './figure-hd';
import { defineRayBillboardArt } from './ray-art';
import { hookedCross, inHookedCross } from '../../art/wall-tex';
import { hdHome, PAL_HD } from '../../../engine/palette-hd';

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
  return fig(f, { size: S, yaw: 0, pose: rotX(tilt), ground: G, scale });
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
  if (figDensity() > 1) {
    eachArtPx(b, 21, 30, 24, 28, (x, y, c) => ((c & 255) !== 0 && c !== INK && (x - 22) % 4 < 0.5 && hash2(Math.floor(x), Math.floor(y), 3) < 0.7 ? hdStep(c, -2) : 0));
    return b;
  }
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
  if (figDensity() > 1) {
    eachArtPx(b, 0, 0, S, S, (x, y, c) => {
      if ((c & 255) === 0 || hdHome(c)?.ramp !== PAL_HD.brown) return 0;
      if (y % 5 < 0.5) return hdStep(c, -1);
      if (x % 11 < 0.5 && y > 38) return hdStep(c, -2);
      return 0;
    });
    return b;
  }
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
  const b = fig(f, { size: S, yaw: 0, angle: 0.35, ground: G + 1, outline: false });
  // hazard band and stains
  if (figDensity() > 1) {
    eachArtPx(b, 0, 44, S, 6, (x, y, c) => {
      if ((c & 255) === 0 || c === INK) return 0;
      const lit = (hdHome(c)?.i ?? 3) >= 4;
      return Math.floor((x + y) / 4) % 2 !== 0 ? (lit ? PAL_HD.black[3] : PAL_HD.black[2]) : lit ? PAL_HD.gold[5] : PAL_HD.gold[4];
    });
    for (let i = 0; i < 40; i++) {
      const sx = 22 + Math.floor(hash2(i, 1, 5) * 20) + 0.5;
      const sy = 6 + Math.floor(hash2(i, 2, 5) * 36) + 0.5;
      const r = 0.35 + hash2(i, 3, 5) * 0.4;
      eachArtPx(b, sx - 1, sy - 1, 2, 2, (x, y, c) => ((c & 255) !== 0 && c !== INK && Math.hypot(x - sx, (y - sy) * 0.8) < r ? hdStep(c, -2) : 0));
    }
    return b;
  }
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
  const b = fig(f, { size: S, yaw: 0, ground: G });
  if (figDensity() > 1) return flagHd(b);
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
  const b = fig(f, { size: S, yaw: 0, ground: G });
  // light cone on the floor
  if (figDensity() > 1) {
    eachArtPx(b, 30, 58, 24, 4, (x, y, c) => {
      if ((c & 255) !== 0 || x < 30 + (62 - y) / 2 || x >= 54 - (62 - y) / 4) return 0;
      return (Math.floor(x * 2) + Math.floor(y * 2)) % 4 === 0 ? (y > 60 ? PAL_HD.gold[2] : PAL_HD.gold[3]) : 0;
    });
    return b.touch();
  }
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
  if (figDensity() > 1) {
    for (let i = 0; i < 40; i++) {
      const sx = 8 + Math.floor(hash2(i, 1, 7) * 48) + 0.5;
      const sy = 30 + Math.floor(hash2(i, 2, 7) * 30) + 0.5;
      eachArtPx(b, sx - 1, sy - 1, 2, 2, (x, y, c) => ((c & 255) !== 0 && c !== INK && hdHome(c)?.ramp === PAL_HD.sand && Math.hypot(x - sx, y - sy) < 0.6 ? hdStep(c, -1) : 0));
    }
    return b;
  }
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
  if (figDensity() > 1) {
    eachArtPx(b, 24, 41, 16, 3, (x, y, c) => ((c & 255) !== 0 && c !== INK && y % 2 < 1 && hash2(Math.floor(x * 2), Math.floor(y), 9) > 0.12 ? PAL_HD.sand[5] : 0));
    for (let i = 0; i < 20; i++) {
      const sx = 22 + Math.floor(hash2(i, 1, 9) * 20) + 0.5;
      const sy = 30 + Math.floor(hash2(i, 2, 9) * 28) + 0.5;
      eachArtPx(b, sx - 1.5, sy - 0.5, 3, 1, (x, y, c) => ((c & 255) !== 0 && hdHome(c)?.ramp === PAL_HD.red && Math.abs(y - sy) < 0.3 && Math.abs(x - sx) < 0.8 + hash2(i, 4, 9) ? PAL_HD.rust[2] : 0));
    }
    return b;
  }
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
  if (figDensity() > 1) return ceilingLampHd(figDensity());
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
  if (figDensity() > 1) return chainsHd(figDensity());
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

// ------------------------------------------------------------------------------------ UHD details

/** The flag at density d on the pole frame: lit red cloth waving, the white disc, the symbol, the fixings. */
function flagHd(b: PixelBuffer): PixelBuffer {
  const x0 = 21;
  const y0 = 3;
  const w = 38;
  const h = 28;
  const red = PAL_HD.red;
  const white = PAL_HD.cloth;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2 + Math.sin(w / 10) * 1.2;
  eachArtPx(b, x0, y0 - 2, w, h + 4, (x, y) => {
    const u = x - x0;
    const wave = Math.sin(u / 5) * 1.2;
    const v = y - y0 - wave;
    if (v < 0 || v >= h) return 0;
    // the cloth turns with the wave: lit where it faces the upper left
    const t = Math.cos(u / 5);
    let k = t > 0.6 ? 5 : t > 0.1 ? 4 : t > -0.5 ? 3 : 2;
    if (v < 0.6 || v > h - 0.6) k = 1;
    else if (u > w - 0.6) k = Math.min(k, 2);
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 10) {
      if (inHookedCross(dx, dy, 7.8)) return PAL_HD.ink[0];
      return r > 9.4 ? white[2] : white[Math.min(white.length - 2, k + 1)];
    }
    return red[k];
  });
  // the fixings to the pole: two lit clamps
  for (const fy of [y0 + 1, y0 + h - 3]) eachArtPx(b, x0 - 1, fy, 2, 2, (x, y) => (x + y < x0 - 1 + fy + 1.2 ? PAL_HD.steel[5] : PAL_HD.steel[3]));
  return b.touch();
}

/** The ceiling lamp at density d: a cord, an olive enamel shade, a glowing bulb and its light (static decor: outline C). */
function ceilingLampHd(d: number): PixelBuffer {
  const c = new HdCanvas(S, S, d);
  const cord = c.material({ ramp: PAL_HD.black, lo: 0, hi: 4 });
  const shade = c.material({ ramp: PAL_HD.olive, lo: 1, hi: 6, spec: 0.55, shine: 20, edge: 'C' });
  const inner = c.material({ ramp: PAL_HD.gold, flat: true, lo: 2, hi: 6 });
  const bulb = c.material({ ramp: PAL_HD.gold, flat: true, lo: 4, hi: 7 });
  c.capsule(32, 0, 32, 7.5, 0.55, 0.55, { mat: cord, z: 2 });
  c.heightField(20, 7.6, 24, 6.8, (x, y) => {
    const half = 3 + (y - 8) * 1.6;
    const dx = (x - 32) / half;
    if (y < 7.6 || y > 14.4 || dx < -1 || dx > 1) return NaN;
    return Math.sqrt(1 - dx * dx) * half * 0.5;
  }, { mat: shade, z: 1 });
  c.capsule(22, 14.4, 42, 14.4, 0.6, 0.6, { mat: shade, z: 4, tone: -0.15 });
  c.box(28, 15, 8, 2, { mat: inner, z: 3, tone: 0.5, r: 0.8 });
  c.ellipsoid(32, 17, 2, 1.3, { mat: bulb, z: 4, tone: 1 });
  const out = c.render({ outline: 'C', ao: 0.25 });
  // the light falling: a few soft glints under the shade
  withFigDensity(d, () => {
    for (let i = 0; i < 6; i++) {
      const gx = 26.5 + i * 2 + (i & 1);
      const gy = 19.5 + (i & 1);
      eachArtPx(out, gx - 0.6, gy - 0.6, 1.2, 1.2, (x, y) => (Math.hypot(x - gx, y - gy) < 0.5 ? (i & 1 ? PAL_HD.gold[4] : PAL_HD.gold[3]) : 0));
    }
  });
  return out.touch();
}

/** Hanging chains with a hook at density d: links alternate face-on rings and edge-on bars (outline C). */
function chainsHd(d: number): PixelBuffer {
  const c = new HdCanvas(S, S, d);
  const steel = c.material({ ramp: PAL_HD.steel, lo: 1, hi: 6, spec: 0.9, shine: 26, edge: 'C' });
  for (const [x0, len] of [[26.5, 30], [36.5, 22], [31.5, 38]] as const) {
    for (let y = 0; y < len; y += 3) {
      const odd = (y / 3) & 1;
      if (odd) {
        // a link seen face-on: an oval ring
        const part = c.newPart();
        const n = 10;
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2;
          const a1 = ((k + 1) / n) * Math.PI * 2;
          c.capsule(x0 + Math.cos(a0) * 1.1, y + 1.5 + Math.sin(a0) * 1.4, x0 + Math.cos(a1) * 1.1, y + 1.5 + Math.sin(a1) * 1.4, 0.45, 0.45, { mat: steel, part, z: 1 });
        }
      } else c.capsule(x0, y - 0.3, x0, y + 3.3, 0.5, 0.5, { mat: steel, z: 1.5 });
    }
    if (len === 38) {
      // a hook
      const part = c.newPart();
      c.capsule(x0, 37.5, x0, 41.5, 0.6, 0.6, { mat: steel, z: 1.5, part });
      for (let k = 0; k <= 6; k++) {
        const a0 = (k / 7) * Math.PI;
        const a1 = ((k + 1) / 7) * Math.PI;
        c.capsule(x0 - 1.6 + Math.cos(a0) * 1.6, 41.5 + Math.sin(a0) * 1.6, x0 - 1.6 + Math.cos(a1) * 1.6, 41.5 + Math.sin(a1) * 1.6, 0.6, 0.6, { mat: steel, z: 1.5, part });
      }
    }
  }
  return c.render({ outline: 'C', ao: 0.3 }).touch();
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

for (const [id, gen] of Object.entries(PROPS)) defineRayBillboardArt(`fps/prop/${id}`, { yaws: 1, frames: 1, gen: () => gen() }, (d) => withFigDensity(d, gen));

void rotZ;
