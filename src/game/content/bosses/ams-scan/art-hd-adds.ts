/**
 * The scan car fight's helpers — the UHD art (docs/ART_GUIDE.md "UHD art"): ONE density-generic
 * drawer per strip makes its 2× and 4× frames natively with the HD kit (PAL_HD, the key light from
 * the upper left, outline A): the SCAN LOCK reticle and the ticket strip, the tow truck (navy cab,
 * yellow hazard-banded crane, chequer-plate bed) and its hook, the yellow wheel clamp with its
 * steel lock disc and the clamp on a boot. Each frame keeps its 1× frame's logical size and anchor.
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import { HdCanvas, type RenderOpts, type TexSample } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';
import { HdPiece, geomOf } from '../ams/canvas';
import { CLAMP_ARMS, CLAMP_DISC, inCab } from './art-adds';
import { ID, RETICLE_R, TICKET, TRUCK, type Pt } from './geometry';

const R = PAL_HD;

/** Sprites: outline A (style decision), AO where parts meet, the thin cool rim. */
const RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

/** The 1× frame i of a strip (the HD frame's geometry). */
function lo(id: string, i = 0): Frame {
  return getFrames(id, 1)[i];
}

// ---------------------------------------------------------------------------------------------
// Reticle, ticket strip
// ---------------------------------------------------------------------------------------------

export function reticleHd(locked: boolean, d: number): Frame {
  const f1 = lo(ID.reticle, locked ? 1 : 0);
  const g = geomOf(f1);
  const c = new HdCanvas(g.w, g.h, d);
  const m = RETICLE_R + 0.5;
  const core = R.red[6];
  const edge = R.red[5];
  const w = 0.42;
  c.paint(0, 0, g.w, g.h, (x, y) => {
    const dx = x - m;
    const dy = y - m;
    let dist = 9;
    if (!locked) {
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const bx = m + sx * 6;
          const by = m + sy * 6;
          // An L: along x from the corner inwards 3.4 px, along y the same.
          const ax = Math.abs(x - bx) < w && (y - by) * sy <= 0.2 && (y - by) * sy >= -3.6 ? Math.abs(x - bx) : 9;
          const ay = Math.abs(y - by) < w && (x - bx) * sx <= 0.2 && (x - bx) * sx >= -3.6 ? Math.abs(y - by) : 9;
          dist = Math.min(dist, ax, ay);
        }
      }
      if (Math.hypot(dx, dy) < 0.75) return R.red[6];
    } else {
      const q = Math.hypot(dx, dy);
      dist = Math.abs(q - 6.2);
      for (const horiz of [true, false]) {
        const along = Math.abs(horiz ? dx : dy);
        const across = Math.abs(horiz ? dy : dx);
        if (across < w && along > 6.6 && along < 9.2) dist = Math.min(dist, across);
        if (across < w * 0.8 && along < 2.4) return along < 0.9 ? R.gold[6] : R.red[5];
      }
    }
    if (dist > w) return 0;
    return dist < w * 0.45 ? core : edge;
  });
  return { buf: c.render(RENDER), ox: f1.ox, oy: f1.oy, density: d };
}

export function ticketHd(frame: number, d: number): Frame {
  const f1 = lo(ID.ticket, frame);
  const g = geomOf(f1);
  const c = new HdCanvas(g.w, g.h, d);
  const paper = c.material({ ramp: R.snow, lo: 2, hi: 6, spec: 0.1, wrap: 0.2 });
  const m = (TICKET.h - 1) / 2 + 0.5;
  const lift = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  // The strip: a thin curled paper band whose tail flaps.
  c.heightField(0.6, 0, g.w - 1.2, g.h, (x, y) => {
    const t = Math.max(0, (x - (g.w - 6)) / 5);
    const mid = m + lift * t * t + Math.sin(x * 0.9) * 0.15;
    const half = 1.45 - (x < 1.6 ? (1.6 - x) * 0.6 : 0);
    const v = (y - mid) / half;
    return Math.abs(v) > 1 ? NaN : Math.sqrt(1 - v * v) * 0.5 + Math.sin(x * 1.3) * 0.15;
  }, { mat: paper, z: 0, tex: (s) => {
    // The printed lines and the red total.
    const t = Math.max(0, (s.x - (g.w - 6)) / 5);
    const mid = m + lift * t * t;
    if (s.x > 2.5 && s.x < g.w - 3.5 && Math.abs(s.y - mid) < 0.22 && Math.floor(s.x * 1.6) % 3 !== 0) s.fix = R.steel[3];
    if (s.x > g.w - 4.4 && s.x < g.w - 2.8 && Math.abs(s.y - mid) < 0.3) s.fix = R.red[5];
  } });
  return { buf: c.render(RENDER), ox: f1.ox, oy: f1.oy, density: d };
}

// ---------------------------------------------------------------------------------------------
// The tow truck and its hook
// ---------------------------------------------------------------------------------------------

export function truckHd(damaged: boolean, d: number): Frame {
  const T = TRUCK;
  const p = new HdPiece(geomOf(lo(ID.truck, damaged ? 1 : 0)), d);
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
  const p = new HdPiece(geomOf(lo(ID.hook)), d);
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

// ---------------------------------------------------------------------------------------------
// The wheel clamp
// ---------------------------------------------------------------------------------------------

function clampParts(p: HdPiece, frame: number, origin: Pt, flipArms = false): void {
  const yellow = p.material({ ramp: R.gold, lo: 3, hi: 6, spec: 0.6, shine: 30, wrap: 0.05 });
  const steel = p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 1, shine: 36, rim: 0.4 });
  const black = p.material({ ramp: R.black, lo: 0, hi: 3, spec: 0.3 });
  const [ox, oy] = origin;
  // The foot plate.
  p.box(ox - 5.3, oy - 1.1, 11.6, 1.2, { mat: steel, z: 0, r: 0.3, bevel: 0.4 });
  // The jaw arms, a tooth at each tip.
  const [r0, e, t] = CLAMP_ARMS[frame];
  for (const s of [-1, 1]) {
    const m = (q: Pt): [number, number] => [ox + q[0] * s + 0.5, oy + q[1] + 0.5];
    const a = m(r0);
    const b = m(e);
    const c = m(t);
    p.stroke([a, b, c], 0.95, 0.85, { mat: yellow, z: 1, tex: p.tex((tx) => {
      if (tx.d >= 4 && hash2(Math.floor(tx.x * 3), Math.floor(tx.y * 3), 6) > 0.9) tx.tone -= 0.15;
    }) });
    if (!flipArms) p.ell(c[0] + (frame === 0 ? 0 : s * 0.7), c[1] + 0.9, 0.55, 0.55, { mat: steel, z: 1.4 });
  }
  // The round lock disc with the keyhole.
  const [dx, dy] = CLAMP_DISC[frame];
  p.ell(ox + dx + 0.5, oy + dy + 0.5, 3.1, 3.1, { mat: steel, z: 2 });
  p.ell(ox + dx + 0.5, oy + dy + 0.5, 1.6, 1.6, { mat: steel, z: 2.4, tone: -0.15 });
  p.box(ox + dx + 0.15, oy + dy + 0.2, 0.7, 1.5, { mat: black, z: 2.8, r: 0.3 });
}

export function clampHd(frame: number, d: number): Frame {
  const p = new HdPiece(geomOf(lo(ID.clamp, frame)), d);
  clampParts(p, frame, [0, 0]);
  return p.frame(RENDER);
}

export function clampFootHd(frame: number, d: number): Frame {
  const p = new HdPiece(geomOf(lo(ID.clampFoot, frame)), d);
  const yellow = p.material({ ramp: R.gold, lo: 3, hi: 6, spec: 0.6, shine: 30 });
  const steel = p.material({ ramp: R.steel, lo: 2, hi: 6, spec: 1, shine: 36, rim: 0.4 });
  const black = p.material({ ramp: R.black, lo: 0, hi: 3, spec: 0.3 });
  const r = frame === 1 ? 1 : 0;
  // A yellow C round the toe and the steel lock disc.
  p.stroke([[-3.5, -0.5 - r], [-3.5, -5.5], [3.5, -6.5 + r]], 0.95, 0.9, { mat: yellow, z: 1 });
  p.stroke([[-3.5, -0.5 - r], [4.5, -0.5]], 0.95, 0.95, { mat: yellow, z: 1 });
  p.ell(3.5, -3.5, 2.2, 2.2, { mat: steel, z: 2 });
  p.box(3.2, -3.8, 0.6, 1.2, { mat: black, z: 2.6, r: 0.2 });
  return p.frame(RENDER);
}

