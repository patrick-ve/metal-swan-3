/**
 * UHD gear contracts (docs/ART_GUIDE.md "UHD art", rig contracts) — WORKING PROTOTYPES: the rig
 * group (GEAR) replaces the bodies; the signatures, sizes and logical points stay.
 *
 * Each function returns exactly d times the size of its 1× art in src/game/art/humanoid-gear.ts
 * (gunArt / grenadeArt / snackArt / giftArt / knifeArt / propArt), drawn natively with the HD
 * kit, with the same logical anchor points (grip, grip2, muzzle, tip: read them from the 1× art).
 * No outline (the figure's outline wraps them). Cached per (kind, d).
 */
import type { Color } from '../../../engine/color';
import { PAL_HD, hdHome } from '../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../engine/pixel';
import { giftArt, grenadeArt, gunArt, knifeArt, propArt, snackArt, type PropKind } from '../humanoid-gear';
import { hash2 } from '../paint';
import { HdCanvas, type Texture } from './canvas';
import type { HdDensity } from './head';
import { grime, wood } from './texture';

type GunKind = 'pistol' | 'heavy' | 'rifle';

const cache = new Map<string, PixelBuffer>();

function cached(key: string, make: () => PixelBuffer): PixelBuffer {
  let b = cache.get(key);
  if (!b) {
    b = make();
    cache.set(key, b);
  }
  return b;
}

/** Gunmetal: strong specular, cool shade. */
function metal(c: HdCanvas): number {
  return c.material({ ramp: PAL_HD.steel, spec: 1, shine: 30, rim: 0.4, gain: 1.05, bounce: 0.3 });
}

/** The HD gun: (w·d) × (h·d) of gunArt(kind).buf; grip, grip2 and muzzle as gunArt(kind). */
export function gunArtHd(kind: GunKind, d: HdDensity): PixelBuffer {
  return cached(`gun:${kind}:${d}`, () => {
    const lo = gunArt(kind).buf;
    const c = new HdCanvas(lo.w, lo.h, d);
    const steel = metal(c);
    const dark = c.material({ ramp: PAL_HD.black, spec: 0.5, shine: 20, rim: 0.4 });
    if (kind === 'pistol') {
      c.poly([[0.9, 2.2], [3.3, 2.2], [3.0, 5], [0.9, 5]], { mat: dark, z: 0, tex: chequer(31) });
      c.box(1, 1.8, 4, 1.3, { mat: steel, z: 0.5, bevel: 0.3, tone: -0.1 });
      c.box(1, 0, 7, 2, { mat: steel, z: 1, bevel: 0.45, r: 0.25 });
      c.shade(1.8, 0.2, 1.8, 1.4, (x) => (Math.floor(x * d) % 2 === 0 ? -0.25 : 0));
      c.capsule(3.4, 3.0, 4.4, 3.1, 0.3, 0.3, { mat: steel, z: 0.4 });
      c.paint(7.5, 0.3, 0.5, 0.8, () => PAL_HD.ink[0]);
    } else if (kind === 'heavy') {
      const olive = c.material({ ramp: PAL_HD.olive, spec: 0.25, shine: 12 });
      // Stock, pistol grip, receiver, carry handle, shroud with vents, drum, front grip.
      c.box(0, 1.2, 4.6, 3.6, { mat: steel, z: 0, bevel: 0.6, r: 0.5, tone: -0.08 });
      c.box(4.8, 4.6, 1.6, 2.4, { mat: dark, z: 0.2, bevel: 0.4, r: 0.3 });
      c.box(11.8, 4.6, 1.7, 2.2, { mat: dark, z: 0.2, bevel: 0.4, r: 0.3 });
      c.box(4, 1.8, 7, 3.2, { mat: steel, z: 1, bevel: 0.6, r: 0.3, tex: grime(41, 0.4) });
      c.stroke([[5.2, 2], [5.4, 0.5], [8.4, 0.5], [8.8, 2]], 0.45, 0.45, { mat: steel, z: 1.2 });
      c.cylinder(10.6, 1.9, 8.4, 2.6, { mat: steel, z: 1.1, axis: 'h' });
      c.shade(11.4, 2.2, 7.4, 2, (x, y) => {
        const f = ((x - 11.4) / 1.6) % 1;
        return f > 0.45 && f < 0.85 && y > 2.5 && y < 3.9 ? -0.45 : 0;
      });
      c.box(4, 4, 15, 1, { mat: steel, z: 0.8, bevel: 0.3, tone: -0.15 });
      c.ellipsoid(8.1, 6.0, 2.2, 1.9, { mat: olive, z: 1.4, tex: (s) => { if (Math.abs(((s.x - 6) / 1.1) % 1 - 0.5) < 0.1) s.tone -= 0.2; } });
      c.paint(18.4, 2.6, 0.6, 0.9, () => PAL_HD.ink[0]);
    } else {
      const wd = c.material({ ramp: PAL_HD.wood, spec: 0.35, shine: 14 });
      c.poly([[0, 1], [6.2, 1], [6.2, 3], [3.2, 3], [0, 3.5]], { mat: wd, z: 0, tex: wood({ seed: 51 }) });
      c.box(10, 2.7, 1.3, 2.3, { mat: wd, z: 0.3, bevel: 0.35, r: 0.3, tex: wood({ seed: 52, dir: 'v' }) });
      c.box(7.1, 2.6, 2.0, 1.8, { mat: steel, z: 0.4, bevel: 0.35, r: 0.3, tone: -0.1 });
      c.box(6, 1, 6.2, 2, { mat: steel, z: 1, bevel: 0.45, r: 0.2 });
      c.box(7, 0, 2, 1.2, { mat: steel, z: 0.9, bevel: 0.3, r: 0.3 });
      c.box(12, 1, 4.2, 2, { mat: wd, z: 1, bevel: 0.45, r: 0.3, tex: wood({ seed: 53 }) });
      c.cylinder(16, 1.1, 3, 1.1, { mat: steel, z: 1, axis: 'h' });
    }
    return c.render({ outline: 'none', ao: 0.3 });
  });
}

/** Chequered grip (4×: fine diamonds; 2×: a coarse cross-hatch). */
function chequer(seed: number): Texture {
  return (s) => {
    const k = s.d >= 4 ? 2 : 1;
    if (((Math.floor(s.X / k) + Math.floor(s.Y / k)) & 1) === 0) s.tone -= 0.12;
    if (hash2(s.X, s.Y, seed) > 0.97) s.tone += 0.1;
  };
}

/** HD held item: (w·d) × (h·d) of grenadeArt / snackArt / giftArt. */
export function heldArtHd(item: 'grenade' | 'snack' | 'gift', d: HdDensity): PixelBuffer {
  return cached(`held:${item}:${d}`, () => {
    const lo = item === 'grenade' ? grenadeArt() : item === 'gift' ? giftArt() : snackArt();
    const c = new HdCanvas(lo.w, lo.h, d);
    if (item === 'grenade') {
      const steel = metal(c);
      const olive = c.material({ ramp: PAL_HD.olive, spec: 0.35, shine: 12 });
      c.box(1.8, 0, 2.2, 1.6, { mat: steel, z: 1, bevel: 0.4, r: 0.4 });
      c.paint(2.2, 0.8, 1.4, 0.6, (x) => (x > 2.6 && x < 3.2 ? PAL_HD.ink[0] : 0));
      c.ellipsoid(2.5, 3.9, 2.5, 2.1, {
        mat: olive,
        z: 0,
        tex: (s) => {
          const gx = ((s.x - 0.2) / 1.25) % 1;
          const gy = ((s.y - 2) / 1.05) % 1;
          if (gx < 0.16 || gy < 0.16) s.tone -= 0.22;
        },
      });
    } else if (item === 'gift') {
      const box = c.material({ ramp: PAL_HD.sky, spec: 0.2 });
      const rib = c.material({ ramp: PAL_HD.red, spec: 0.45, shine: 16 });
      c.box(0, 2, 6, 4, { mat: box, z: 0, bevel: 0.5, r: 0.2 });
      c.box(2.4, 2, 1.2, 4, { mat: rib, z: 0.3, bevel: 0.3 });
      c.ellipsoid(2.0, 1.0, 1.2, 0.9, { mat: rib, z: 0.5 });
      c.ellipsoid(4.0, 1.0, 1.2, 0.9, { mat: rib, z: 0.5 });
    } else {
      const bread = c.material({ ramp: PAL_HD.sand, spec: 0.1 });
      const leaf = c.material({ ramp: PAL_HD.green });
      const tom = c.material({ ramp: PAL_HD.red, spec: 0.5 });
      c.ellipsoid(3.5, 1.1, 3.4, 1.1, { mat: bread, z: 1 });
      c.box(0.3, 1.8, 6.4, 1.2, { mat: leaf, z: 0.5, bevel: 0.3, tex: (s) => { s.ny += Math.sin(s.x * 4) * 0.4; } });
      c.ellipsoid(4.2, 2.4, 1.2, 0.6, { mat: tom, z: 0.8 });
      c.ellipsoid(3.5, 3.8, 3.4, 1.1, { mat: bread, z: 0.2 });
    }
    return c.render({ outline: 'none', ao: 0.3 });
  });
}

/** HD knife: (8·d) × (3·d) of knifeArt (handle at x 0..2, the edge down). */
export function knifeArtHd(d: HdDensity): PixelBuffer {
  return cached(`knife:${d}`, () => {
    const lo = knifeArt();
    const c = new HdCanvas(lo.w, lo.h, d);
    const steel = metal(c);
    const wrap = c.material({ ramp: PAL_HD.brown, spec: 0.2 });
    c.box(0, 0.8, 3, 1.4, { mat: wrap, z: 0, bevel: 0.35, r: 0.3, tex: (s) => { if (((s.x * 1.6) % 1) < 0.3) s.tone -= 0.25; } });
    c.box(2.8, 0.2, 0.7, 2.6, { mat: steel, z: 0.6, bevel: 0.25, r: 0.2 });
    c.plane(3.3, 0, 4.7, 3, {
      mat: steel,
      z: 0.3,
      mask: (x, y) => y > 0.15 + (x - 3.3) * 0.05 && y < 2.3 - Math.max(0, x - 5.6) * 0.8,
      normal: (_x, y, n) => {
        const up = y < 1.1;
        n[0] = 0;
        n[1] = up ? -0.45 : 0.55;
        n[2] = up ? 0.9 : 0.83;
      },
    });
    return c.render({ outline: 'none', ao: 0.2 });
  });
}

/**
 * HD knife-look prop: (w·d) × (h·d) of propArt(kind).buf; grip and tip as propArt(kind).
 * PROTOTYPE: the prop is re-lit from its 1× silhouette and colours (a dome per shape, the HD ramp
 * of each 1× colour, its 1× tone kept as a bias) — the GEAR group draws every prop natively.
 */
export function propArtHd(kind: PropKind, d: HdDensity): PixelBuffer {
  return cached(`prop:${kind}:${d}`, () => relit(propArt(kind).buf, d));
}

/** Re-light a small 1× drawing at density d (prototype stand-in; see propArtHd). */
function relit(lo: PixelBuffer, d: HdDensity): PixelBuffer {
  const c = new HdCanvas(lo.w, lo.h, d);
  const mats = new Map<Ramp, number>();
  const W = lo.w;
  const H = lo.h;
  const colourAt = (x: number, y: number): Color => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    return X < 0 || Y < 0 || X >= W || Y >= H ? 0 : lo.data[Y * W + X];
  };
  // Distance to the nearest empty logical px (chamfer, logical units), for the dome height.
  const dist = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((lo.data[y * W + x] & 255) === 0) continue;
      let best = 4;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if ((colourAt(x + dx, y + dy) & 255) === 0) best = Math.min(best, Math.hypot(dx, dy));
        }
      }
      dist[y * W + x] = best;
    }
  }
  const hAt = (x: number, y: number): number => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (X < 0 || Y < 0 || X >= W || Y >= H || (lo.data[Y * W + X] & 255) === 0) return NaN;
    return Math.sqrt(Math.min(1, dist[Y * W + X] / 2)) * 1.4;
  };
  c.heightField(0, 0, W, H, hAt, {
    mat: 2,
    z: 0,
    tex: (s) => {
      const col = colourAt(s.x, s.y);
      const home = hdHome(col);
      const r = home?.ramp ?? PAL_HD.steel;
      let m = mats.get(r);
      if (m === undefined) {
        m = c.material({ ramp: r, spec: r === PAL_HD.steel ? 0.9 : 0.25, shine: 20 });
        mats.set(r, m);
      }
      s.mat = m;
      if (home) s.tone += (home.i / (r.length - 1) - 0.5) * 0.7;
    },
  });
  return c.render({ outline: 'none', ao: 0 });
}
