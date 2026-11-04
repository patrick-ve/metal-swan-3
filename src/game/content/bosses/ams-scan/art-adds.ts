/**
 * The scan car fight's helpers — the 1× art (64-colour PAL, 1-px ink outline, light from the top
 * left) of the OLD tow truck and its hook (`truckLo`,
 * `hookLo`, `inCab` on the old layout TRUCK_LO): the ams fight draws the baked 40 px truck, hook and
 * wheel clamp (src/game/content/art40/ams-tow-truck.gen.ts, ams-wheel-clamp.gen.ts); the ring
 * convoy's dormant tow truck still draws these. Registered with their 2× / 4× drawers
 * (art-hd-adds.ts) in art.ts.
 */
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { hash2, shadeLayer } from '../../../art/paint';
import { DCanvas } from '../ams/canvas';
import { HOOK, TRUCK_LO } from './geometry';

// ---------------------------------------------------------------------------------------------
// The tow truck and its hook
// ---------------------------------------------------------------------------------------------

/** Is (x, y) in the truck's cab outline (cab and bonnet, the windscreen slope)? */
export function inCab(x: number, y: number): boolean {
  const T = TRUCK_LO;
  const cab = T.cab;
  if (x >= cab.x && x < cab.x + cab.w && y >= cab.y && y < cab.y + cab.h) {
    // The windscreen slope at the top front corner.
    return !(x > 33 && y < cab.y + (x - 33) * 2.2);
  }
  const bn = T.bonnet;
  if (x >= bn.x && x < bn.x + bn.w && y >= bn.y && y < bn.y + bn.h) return !(x > 44 && y < bn.y + (x - 44) * 1.5);
  return false;
}

/** The boom (a thick bar from the crane base to the tip). */
export const BOOM_W = 4;

export function truckLo(damaged: boolean): Frame {
  const T = TRUCK_LO;
  const c = new DCanvas(T.canvas.x0, T.canvas.y0, T.canvas.x1, T.canvas.y1);
  // The boom first (behind the base): yellow with black hazard bands.
  const B = c.layer();
  c.capsule(T.boomFrom[0], T.boomFrom[1], T.tip[0], T.tip[1], BOOM_W, PAL.gold[2], B);
  shadeLayer(B, PAL.gold);
  c.put(B);
  for (let k = 1; k < 6; k++) {
    const t = k / 6;
    const x = Math.round(T.boomFrom[0] + (T.tip[0] - T.boomFrom[0]) * t);
    const y = Math.round(T.boomFrom[1] + (T.tip[1] - T.boomFrom[1]) * t);
    if (k % 2 === 0) c.line(x - 1, y + 1, x + 1, y - 1, PAL.ink[1]).line(x, y + 1, x + 2, y - 1, PAL.ink[1]);
  }
  c.circle(T.tip[0], T.tip[1], 2, PAL.steel[2]).set(T.tip[0] - 1, T.tip[1] - 1, PAL.steel[3]).set(T.tip[0], T.tip[1], PAL.ink[1]);
  // Chassis, deck and the crane base.
  const D = c.layer();
  c.rect(T.chassis.x, T.chassis.y, T.chassis.w, T.chassis.h, PAL.black[1], D);
  shadeLayer(D, PAL.black);
  c.put(D);
  const K = c.layer();
  c.rect(T.deck.x, T.deck.y, T.deck.w, T.deck.h, PAL.steel[2], K);
  shadeLayer(K, PAL.steel);
  c.put(K);
  for (let x = T.deck.x + 6; x < T.deck.x + T.deck.w - 2; x += 8) c.set(x, T.deck.y + 2, PAL.steel[1]).set(x, T.deck.y + 4, PAL.steel[1]);
  const G = c.layer();
  c.rect(T.craneBase.x, T.craneBase.y, T.craneBase.w, T.craneBase.h, PAL.gold[2], G);
  shadeLayer(G, PAL.gold);
  c.put(G);
  c.rect(T.craneBase.x + 2, T.craneBase.y + 3, 3, 2, PAL.ink[1]).set(T.craneBase.x + 9, T.craneBase.y + 2, PAL.gold[3]);
  // The hazard chevrons on the rear.
  for (let y = T.deck.y; y < T.deck.y + 9; y++) {
    for (let x = T.deck.x - 1; x < T.deck.x + 2; x++) c.set(x, y, Math.floor((y + x) / 2) % 2 === 0 ? PAL.red[2] : PAL.snow[3]);
  }
  // Mudguards over the rear wheels.
  for (const wx of [T.wheelX[0], T.wheelX[1]]) c.rect(wx - 7, T.deck.y + T.deck.h, 15, 1, PAL.black[2]);
  // The cab: navy with a white band and the window.
  const N = c.layer();
  c.each(T.cab.x, T.cab.y, T.bonnet.x + T.bonnet.w, -4, (X, Y, lx, ly) => {
    if (inCab(lx + 0.5, ly + 0.5)) N.set(X, Y, PAL.sky[0]);
  });
  shadeLayer(N, [PAL.navy[0], PAL.navy[1], PAL.sky[0], PAL.sky[1]]);
  c.put(N);
  c.each(T.cab.x, -15, T.bonnet.x + T.bonnet.w, -14, (X, Y, lx, ly) => {
    if (inCab(lx + 0.5, ly + 0.5)) c.b.set(X, Y, ly === -15 ? PAL.snow[3] : PAL.snow[2]);
  });
  c.poly(T.window, PAL.navy[0]);
  c.line(26, -23, 30, -31, PAL.sky[2]).line(27, -23, 31, -31, PAL.sky[1]);
  c.rect(27, -29, 4, 4, PAL.ink[1]).rect(27, -26, 4, 2, PAL.navy[1]);
  c.line(23, -21, 23, -7, PAL.navy[0]).rect(19, -19, 2, 1, PAL.steel[3]);
  // Grille, headlight, bumper, the beacon bar.
  c.rect(45, -18, 2, 7, PAL.steel[2]).set(45, -17, PAL.steel[3]).set(45, -15, PAL.steel[1]).set(45, -13, PAL.steel[1]);
  c.rect(44, -20, 3, 2, PAL.snow[3]).set(46, -19, PAL.gold[3]);
  c.rect(43, -9, 5, 4, PAL.black[1]).rect(43, -9, 5, 1, PAL.black[2]);
  c.rect(T.beacon.x, T.beacon.y + 2, T.beacon.w, 1, PAL.black[1]);
  c.rect(T.beacon.x + 1, T.beacon.y, T.beacon.w - 2, 2, PAL.orange[1]).rect(T.beacon.x + 1, T.beacon.y, T.beacon.w - 2, 1, PAL.orange[2]);
  // Wheel wells under the deck and the cab.
  for (const wx of T.wheelX) {
    c.each(wx - 7, -13, wx + 7, -4, (X, Y, lx, ly) => {
      if (Math.hypot(lx + 0.5 - wx, ly + 0.5 - T.wheelY) <= 7.5 && (c.b.get(X, Y) & 255) !== 0) c.b.set(X, Y, PAL.ink[1]);
    });
  }
  if (damaged) {
    // Dents, a cracked window, soot on the cab.
    c.line(28, -30, 32, -24, PAL.snow[2]).line(30, -27, 33, -28, PAL.snow[2]);
    c.each(T.cab.x, T.cab.y, 46, -6, (X, Y, lx, ly) => {
      const cur = c.b.get(X, Y);
      if ((cur & 255) === 0 || cur === PAL.navy[0]) return;
      if (hash2(lx, ly, 23) < 0.12) c.b.set(X, Y, PAL.ink[1]);
    });
    for (const [x, y] of [[-30, -14], [-8, -13], [8, -12]] as const) c.set(x, y, PAL.steel[0]).set(x + 1, y, PAL.steel[0]).set(x, y - 1, PAL.steel[3]);
  }
  return c.frame(true);
}

export function hookLo(): Frame {
  const H = HOOK.canvas;
  const c = new DCanvas(H.x0, H.y0, H.x1, H.y1);
  // The pulley block (yellow) and the steel hook below it.
  const L = c.layer();
  c.rect(-2, 0, 5, 4, PAL.gold[2], L);
  shadeLayer(L, PAL.gold);
  c.put(L);
  c.set(0, 1, PAL.ink[1]);
  const K = c.layer();
  c.rect(0, 4, 1, 4, PAL.steel[2], K);
  c.rect(-2, 8, 3, 1, PAL.steel[2], K);
  c.set(-2, 7, PAL.steel[2], K).set(-3, 6, PAL.steel[2], K);
  c.rect(1, 8, 1, 1, PAL.steel[2], K).set(1, 9, PAL.steel[2], K).set(0, 9, PAL.steel[2], K);
  shadeLayer(K, PAL.steel);
  c.put(K);
  return c.frame(true);
}
