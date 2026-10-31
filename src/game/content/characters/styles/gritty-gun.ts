/**
 * Style `gritty` (gritty.ts): the guns, drawn on the figure's own canvas so they take the same hard
 * light, rim and outline. Real proportions instead of the rig's toy guns: a compact service pistol
 * (6 px: slide, frame, slanted grip, trigger guard, sights, serrations and the ejection port at 4×)
 * and a light machine gun for every special weapon (a stock, the receiver and feed cover, a carry
 * handle, an olive ammo box, a perforated barrel shroud, the barrel and flash hider, a fore-grip).
 *
 * Gun-local coordinates: logical px, x along the barrel, y "down" (the grip side), origin at the
 * middle of the trigger hand's grip (the near hand's IK target). The heavy gun's fore-grip is 7 px
 * ahead (the rig's grip2 span), where the support hand goes.
 */
import type { HdCanvas, Texture } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';

type V = [number, number];
type Pts = ReadonlyArray<readonly [number, number]>;
const DEG = Math.PI / 180;

export interface GunMats {
  metal: number;
  dark: number;
  polymer: number;
  drab: number;
}

export interface GunDraw {
  kind: 'pistol' | 'heavy' | 'rifle';
  /** Canvas position of the grip (logical). */
  at: V;
  /** Degrees, clockwise (0 forward, −90 up). */
  angle: number;
  z: number;
  d: number;
}

/** The heavy gun's scale (its fore-grip lands at 7 · HEAVY_K px: the rig's span, scaled). */
export const HEAVY_K = 1.15;

/** Barrel tip (local) of each gun: the muzzle point is half a px past it. */
const MUZZLE: Readonly<Record<GunDraw['kind'], V>> = {
  pistol: [5.15, -2.0],
  heavy: [13.0, -1.7],
  rifle: [13.0, -1.7],
};

/** Draw a gun; returns the muzzle (canvas, logical: the centre of the first px past the tip). */
export function drawGunG(c: HdCanvas, m: GunMats, g: GunDraw): V {
  const cs = Math.cos(g.angle * DEG);
  const sn = Math.sin(g.angle * DEG);
  // The heavy gun a size up (the fore-grip stays where the support hand is: x is not scaled past it).
  const k = g.kind === 'pistol' ? 1 : HEAVY_K;
  const toC = (x: number, y: number): V => [g.at[0] + (x * cs - y * sn) * k, g.at[1] + (x * sn + y * cs) * k];
  const toL = (X: number, Y: number): V => {
    const x = (X - g.at[0]) / k;
    const y = (Y - g.at[1]) / k;
    return [x * cs + y * sn, -x * sn + y * cs];
  };
  const P = (pts: Pts): V[] => pts.map(([x, y]) => toC(x, y));
  const fine = g.d >= 4;
  const hd = g.d >= 2;
  const z = g.z;
  if (g.kind === 'pistol') {
    // The grip, slanted back, with a stippled panel at 4×.
    c.blob(P([[-1.3, -1.5], [0.35, -1.5], [0.5, -0.95], [0.1, 1.35], [-1.5, 1.35], [-1.35, -0.4]]), 0.3, {
      mat: m.polymer,
      z,
      bulge: 0.12,
      tex: fine ? (s) => {
        const [x, y] = toL(s.x, s.y);
        if (y > -0.6 && y < 1.1 && x > -1.2 && x < 0.1 && hash2(s.X, s.Y, 3) > 0.62) s.tone -= 0.25;
      } : null,
    });
    // The frame's dust cover and the trigger guard (a loop with its hole cut out).
    c.blob(P([[0.1, -1.5], [4.2, -1.5], [4.2, -1.0], [0.3, -0.95]]), 0.2, { mat: m.dark, z: z + 0.2, bulge: 0.05 });
    c.blob(P([[0.3, -1.0], [1.75, -1.0], [1.6, -0.1], [0.85, 0.12], [0.35, -0.2]]), 0.15, {
      mat: m.dark,
      z: z + 0.2,
      bulge: 0.05,
      tex: (s) => {
        const [x, y] = toL(s.x, s.y);
        if (x > 0.55 && x < 1.5 && y > -0.85 && y < -0.25) s.cut = true;
      },
    });
    // The trigger.
    const t0 = toC(0.95, -0.85);
    const t1 = toC(0.85, -0.35);
    c.capsule(t0[0], t0[1], t1[0], t1[1], 0.14, 0.12, { mat: m.metal, z: z + 0.1, round: 0.6 });
    // The slide: serrations at the back, the ejection port, sights.
    c.blob(P([[-1.35, -2.6], [5.0, -2.6], [5.1, -2.15], [5.0, -1.45], [-1.35, -1.45]]), 0.22, {
      mat: m.metal,
      z: z + 0.6,
      bulge: 0.06,
      tex: hd ? (s) => {
        const [x, y] = toL(s.x, s.y);
        if (fine && x > -1.2 && x < 0.1 && Math.abs(((x * 3.2) % 1 + 1) % 1 - 0.5) < 0.18) s.tone -= 0.3;
        if (x > 1.3 && x < 2.6 && y > -2.45 && y < -2.0) s.tone -= 0.45;
        if (Math.abs(y + 1.55) < 0.07 && x > 0) s.tone -= 0.2;
      } : null,
    });
    c.blob(P([[-1.2, -2.95], [-0.6, -2.95], [-0.55, -2.55], [-1.2, -2.55]]), 0.1, { mat: m.dark, z: z + 0.7 });
    c.blob(P([[4.4, -2.85], [4.75, -2.85], [4.75, -2.55], [4.4, -2.55]]), 0.1, { mat: m.dark, z: z + 0.7 });
    return toC(MUZZLE.pistol[0] + 0.5 / k, MUZZLE.pistol[1]);
  }
  // Light machine gun (also the rifle).
  const metalTex: Texture | null = fine ? (s) => {
    if (hash2(s.X, s.Y, 21) > 0.96) s.tone += 0.25;
  } : null;
  // The stock with its butt plate.
  c.blob(P([[-5.6, -2.5], [-2.2, -2.3], [-2.2, -0.7], [-3.9, -0.75], [-5.4, 0.35], [-5.8, 0.25]]), 0.3, { mat: m.polymer, z: z - 0.2, bulge: 0.12, tex: (s) => {
    const [x] = toL(s.x, s.y);
    if (x < -5.2) s.tone -= 0.2;
  } });
  // The pistol grip and the trigger guard.
  c.blob(P([[-0.95, -0.85], [0.5, -0.85], [0.3, 1.55], [-1.2, 1.55]]), 0.25, { mat: m.polymer, z, bulge: 0.1 });
  c.blob(P([[0.5, -0.9], [1.9, -0.9], [1.75, -0.05], [0.6, -0.05]]), 0.12, { mat: m.dark, z: z + 0.1, tex: (s) => {
    const [x, y] = toL(s.x, s.y);
    if (x > 0.75 && x < 1.6 && y > -0.75 && y < -0.25) s.cut = true;
  } });
  // The olive ammo box under the receiver, its latch.
  c.blob(P([[0.95, -0.9], [3.55, -0.9], [3.55, 1.95], [0.95, 1.95]]), 0.3, { mat: m.drab, z: z + 0.3, bulge: 0.12, tex: hd ? (s) => {
    const [x, y] = toL(s.x, s.y);
    if (Math.abs(y - 0.0) < 0.08 || Math.abs(x - 2.25) < 0.06) s.tone -= 0.25;
    if (fine && hash2(s.X >> 1, s.Y >> 1, 4) > 0.8) s.tone += 0.15;
  } : null });
  // The receiver and the feed cover, the cocking handle.
  c.blob(P([[-2.45, -2.95], [3.3, -2.95], [3.3, -0.8], [-2.45, -0.8]]), 0.25, { mat: m.metal, z: z + 0.6, bulge: 0.06, tex: hd ? (s) => {
    const [x, y] = toL(s.x, s.y);
    if (Math.abs(y + 1.75) < 0.07) s.tone -= 0.3;
    if (fine && Math.abs(x - 0.3) < 0.18 && Math.abs(y + 1.3) < 0.18) s.tone += 0.35;
    metalTex?.(s);
  } : null });
  c.blob(P([[-1.9, -3.45], [2.9, -3.45], [3.0, -2.95], [-2.0, -2.95]]), 0.15, { mat: m.dark, z: z + 0.8 });
  // The carry handle.
  c.stroke([toC(0.9, -3.4), toC(1.25, -4.25), toC(3.15, -4.25), toC(3.4, -3.4)], 0.28, 0.28, { mat: m.dark, z: z + 0.9, round: 0.7 });
  // The barrel shroud with its cooling holes.
  c.blob(P([[3.3, -2.55], [9.3, -2.45], [9.3, -0.95], [3.3, -0.85]]), 0.35, { mat: m.metal, z: z + 0.4, bulge: 0.12, tex: hd ? (s) => {
    const [x, y] = toL(s.x, s.y);
    const k = fine ? 1.0 : 1.5;
    const hx = ((x - 3.8) / k) % 1;
    if (x > 3.8 && x < 9.0 && hx > 0.25 && hx < 0.62 && Math.abs(y + 1.72) < (fine ? 0.3 : 0.38)) s.tone -= 0.55;
  } : null });
  // The barrel, the flash hider, the front sight post.
  const b0 = toC(9.2, -1.7);
  const b1 = toC(12.2, -1.7);
  const b2 = toC(13.0, -1.7);
  c.capsule(b0[0], b0[1], b1[0], b1[1], 0.38, 0.36, { mat: m.metal, z: z + 0.3, round: 0.8 });
  c.capsule(b1[0], b1[1], b2[0], b2[1], 0.52, 0.52, { mat: m.dark, z: z + 0.35, round: 0.8 });
  c.blob(P([[11.3, -2.95], [11.7, -2.95], [11.75, -2.05], [11.25, -2.05]]), 0.1, { mat: m.dark, z: z + 0.5 });
  // The fore-grip (the support hand's).
  c.blob(P([[6.5, -1.0], [7.65, -1.0], [7.5, 1.35], [6.65, 1.35]]), 0.25, { mat: m.polymer, z: z + 0.2, bulge: 0.1, tex: fine ? (s) => {
    const [, y] = toL(s.x, s.y);
    if (Math.abs(((y * 2.4) % 1 + 1) % 1 - 0.5) < 0.12) s.tone -= 0.22;
  } : null });
  return toC(MUZZLE.heavy[0] + 0.5 / k, MUZZLE.heavy[1]);
}
