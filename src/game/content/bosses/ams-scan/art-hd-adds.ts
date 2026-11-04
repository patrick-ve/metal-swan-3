/**
 * The scan car fight's helpers — the UHD art (docs/ART_GUIDE.md "UHD art"): ONE density-generic
 * drawer per strip makes its 2× and 4× frames natively with the HD kit (PAL_HD, the key light from
 * the upper left, outline A): the OLD tow truck
 * (navy cab, yellow hazard-banded crane, chequer-plate bed) and its hook on the old layout TRUCK_LO
 * (geometry from `truckLo` / `hookLo`): only the ring convoy's dormant tow truck draws them; the ams
 * fight's truck, hook and wheel clamp are baked 40 px sets (1× at every tier). Each frame keeps its
 * 1× frame's logical size and anchor.
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { type RenderOpts, type TexSample } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';
import { HdPiece, geomOf } from '../ams/canvas';
import { hookLo, inCab, truckLo } from './art-adds';
import { TRUCK_LO } from './geometry';

const R = PAL_HD;

/** Sprites: outline A (style decision), AO where parts meet, the thin cool rim. */
const RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

// ---------------------------------------------------------------------------------------------
// The tow truck and its hook
// ---------------------------------------------------------------------------------------------

export function truckHd(damaged: boolean, d: number): Frame {
  const T = TRUCK_LO;
  const p = new HdPiece(geomOf(truckLo(damaged)), d);
  const navy = p.material({ ramp: R.denim, lo: 1, hi: 5, spec: 0.6, shine: 34, wrap: 0.05 });
  const white = p.material({ ramp: R.snow, lo: 2, hi: 5, spec: 0.5, shine: 30 });
  const yellow = p.material({ ramp: R.gold, lo: 3, hi: 6, spec: 0.55, shine: 30, wrap: 0.05 });
  const steel = p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 0.9, shine: 30, rim: 0.35 });
  const black = p.material({ ramp: R.black, lo: 1, hi: 5, spec: 0.3, shine: 14 });
  const glass = p.material({ ramp: R.glass, lo: 1, hi: 4, spec: 1, shine: 60 });
  const well = p.material({ ramp: R.black, lo: 0, hi: 2, spec: 0, amb: 0 });
  const amber = p.material({ ramp: R.orange, lo: 2, hi: 5, spec: 1, shine: 50 });
  const red = p.material({ ramp: R.red, lo: 3, hi: 6, spec: 0.4 });
  const lamp = p.material({ ramp: R.glass, lo: 3, hi: 5, spec: 1, shine: 60 });
  const dent = (s: TexSample, x: number, y: number): void => {
    if (!damaged) return;
    for (const [dx, dy] of [[-30, -14], [-8, -13], [8, -12], [26, -10], [40, -15]] as const) {
      const q = Math.hypot(x - dx, y - dy);
      if (q < 1.4) {
        s.nx -= (x - dx) * 0.5;
        s.ny -= (y - dy) * 0.5;
      }
    }
    // Soot round the bonnet (a smooth smudge, darkest at the grille).
    const soot = 0.75 - Math.hypot((x - 44) / 8, (y + 15) / 6);
    if (soot > 0) s.tone -= soot * 1.3;
  };
  // The boom (behind the base): yellow with black hazard bands, the pulley at the tip.
  const [bx, by] = T.boomFrom;
  const [tx, ty] = T.tip;
  const bl = Math.hypot(tx - bx, ty - by);
  p.cap(bx, by, tx, ty, 2.2, 1.8, {
    mat: yellow,
    z: 0,
    tex: p.tex((s) => {
      const t = ((s.x - bx) * (tx - bx) + (s.y - by) * (ty - by)) / (bl * bl);
      if (t > 0.12 && t < 0.92 && Math.floor(t * 9 + (s.y - by) * 0.06) % 2 === 1) s.mat = black;
    }),
  });
  p.ell(tx, ty, 2.2, 2.2, { mat: steel, z: 0.5 });
  p.ell(tx, ty, 0.7, 0.7, { mat: black, z: 0.9 });
  // Chassis, deck (chequer plate), the crane base.
  p.box(T.chassis.x, T.chassis.y, T.chassis.w, T.chassis.h, { mat: black, z: 0.5, bevel: 0.6 });
  p.box(T.deck.x, T.deck.y, T.deck.w, T.deck.h, {
    mat: steel,
    z: 1,
    r: 0.5,
    bevel: 0.7,
    tex: p.tex((s) => {
      if (s.d >= 4 && (Math.floor(s.x * 1.5) + Math.floor(s.y * 1.5)) % 2 === 0 && hash2(Math.floor(s.x * 1.5), Math.floor(s.y * 1.5), 2) > 0.5) s.tone += 0.12;
      dent(s, s.x, s.y);
    }),
  });
  p.box(T.craneBase.x, T.craneBase.y, T.craneBase.w, T.craneBase.h, { mat: yellow, z: 1.6, r: 0.8, bevel: 1 });
  p.box(T.craneBase.x + 2, T.craneBase.y + 3, 3, 2, { mat: black, z: 2, r: 0.4 });
  // The hazard chevrons on the rear.
  p.box(T.deck.x - 1, T.deck.y, 3, 9, {
    mat: red,
    z: 1.8,
    bevel: 0.4,
    tex: p.tex((s) => {
      if (Math.floor((s.y + s.x) / 2) % 2 !== 0) s.mat = white;
    }),
  });
  // Mudguards.
  for (const wx of [T.wheelX[0], T.wheelX[1]]) p.box(wx - 7.5, T.deck.y + T.deck.h - 0.2, 15, 1.4, { mat: black, z: 2.2, r: 0.4, bevel: 0.5 });
  // The cab: navy panels with a white band, a door line and a handle.
  p.field(T.cab.x - 0.5, T.cab.y - 0.5, T.cab.w + T.bonnet.w + 1, T.cab.h + 1, (x, y) => {
    if (!inCab(x, y)) return NaN;
    let e = 9;
    // Distance to the cab outline (sampled): an edge roll.
    for (const [ox, oy] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6]] as const) {
      if (!inCab(x + ox, y + oy)) e = Math.min(e, Math.hypot(ox, oy));
    }
    const t = Math.min(1, e / 1.2);
    return 1.2 * Math.sqrt(1 - (1 - t) * (1 - t)) + (x > 36 && y < -14 ? (-14 - y) * 0.12 : 0);
  }, {
    mat: navy,
    z: 2,
    tex: p.tex((s) => {
      if (s.y > -15.5 && s.y < -13.4) s.mat = white;
      if (Math.abs(s.x - 23.5) < 0.2 && s.y > -21 && s.y < -6) s.tone -= 0.7;
      dent(s, s.x, s.y);
    }),
  });
  p.poly(T.window, { mat: glass, z: 2.6, tex: p.tex((s) => {
    const u = s.x - 26 + (s.y + 23) * 0.5;
    if (u > 0 && u < 1.2) s.tone += 0.6;
    if (damaged && Math.abs((s.x - 30) * 0.7 + (s.y + 27)) < 0.12) s.fix = R.snow[5];
  }) });
  // The driver's dark head in the window.
  p.ell(29, -27, 2, 2.3, { mat: black, z: 2.8 });
  p.cap(19.2, -18.6, 20.8, -18.6, 0.35, 0.35, { mat: steel, z: 2.6 });
  // Grille, headlight, bumper, the beacon bar.
  p.box(44.6, -18.2, 2.4, 7.4, { mat: steel, z: 2.6, bevel: 0.4, tex: p.tex((s) => {
    if (Math.floor((s.y + 18) * 1.4) % 2 === 1) s.tone -= 0.5;
  }) });
  p.box(43.8, -20.4, 3.2, 2.4, { mat: lamp, z: 2.8, r: 0.6, bevel: 0.6 });
  p.box(42.8, -9.4, 5.4, 4.4, { mat: black, z: 3, r: 0.8, bevel: 0.8 });
  p.box(T.beacon.x, T.beacon.y + 2, T.beacon.w, 1.2, { mat: black, z: 2.6, bevel: 0.3 });
  p.box(T.beacon.x + 1, T.beacon.y - 0.2, T.beacon.w - 2, 2.4, { mat: amber, z: 2.8, r: 0.8, bevel: 0.8 });
  // Wheel wells.
  p.field(T.deck.x, -14, T.bonnet.x + T.bonnet.w - T.deck.x, 10, (x, y) => {
    for (const wx of T.wheelX) {
      const r = Math.hypot(x - wx, y - T.wheelY);
      if (r <= 7.5 && y < -4) return -(7.5 - r) * 0.4 - 1;
    }
    return NaN;
  }, { mat: well, z: 2.5 });
  return p.frame(RENDER);
}

export function hookHd(d: number): Frame {
  const p = new HdPiece(geomOf(hookLo()), d);
  const yellow = p.material({ ramp: R.gold, lo: 3, hi: 6, spec: 0.55, shine: 30 });
  const steel = p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 1, shine: 36, rim: 0.4 });
  const black = p.material({ ramp: R.black, lo: 1, hi: 4, spec: 0.3 });
  // The pulley block (yellow cheeks, a black pin) and the forged hook.
  p.box(-2.2, -0.1, 5.4, 4.3, { mat: yellow, z: 0, r: 0.9, bevel: 0.9 });
  p.ell(0.5, 1.6, 0.6, 0.6, { mat: black, z: 0.8 });
  p.cap(0.5, 4, 0.5, 7.4, 0.55, 0.6, { mat: steel, z: 0.5 });
  p.field(-3.6, 5.5, 6.2, 5.2, (x, y) => {
    // A thick C opening to the left: the hook's bowl.
    const r = Math.hypot(x - -0.4, y - 7.9);
    const a = Math.atan2(y - 7.9, x - -0.4);
    if (Math.abs(r - 1.9) > 0.75) return NaN;
    if (a < -2.2 && a > -Math.PI) return NaN;
    if (a < 0 && a > -1.1) return NaN;
    return Math.sqrt(0.5625 - (r - 1.9) ** 2) * 0.9;
  }, { mat: steel, z: 0.6 });
  return p.frame(RENDER);
}
