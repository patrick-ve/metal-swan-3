/**
 * The art of the ZWAAN train's cab `ring-zwaan-cab` (ZWARE JONGEN; docs/design/ring.md §R.3;
 * docs/ART_GUIDE.md "UHD art"): ONE density-generic drawer per strip (PAL at 1×, PAL_HD at 2× / 4×,
 * every frame cropped to its 1× box), outline A (it moves and can be hit). Our own livery: a white
 * high-roof cab-over with an orange band and a thin red line, the `ZWAAN` name and the swan mark on
 * the sleeper, a made-up plate; no maker badge. It always faces right (nothing mirrors but the people).
 * Geometry: cab-geo.ts (part-local, the rear at x 0).
 *
 * | id (`boss/ring-zwaan/cab/…`) | frames | what |
 * |---|---|---|
 * | `body-<0\|1\|2>` | 1 | the tractor by damage state: clean; dents, holes, a cracked door glass; broken glass, soot, a hanging mirror |
 * | `yaw` | 4 (deferred) | the jackknife: the wreck turning toward the camera (25°, 50°, 75°, 90°: the smashed windscreen, the plate) |
 * | `window` | 3 | the sleeper window: half open, open (the dark bunk), smashed |
 * | `gunner/<aim\|fire>` | 3 / 2 | the gunner leaning out of the window with a pistol (the tell: he leans out and aims) |
 * | `gunner/<tumble\|sit>` | 4 / 2 (deferred) | the gunner knocked out of the broken window, dazed on the hard shoulder (bloodless) |
 * | `driver/<tumble\|sit>` | 4 / 2 (deferred) | the driver climbing out of the jackknifed cab, dazed (bloodless) |
 * | `blink` | 2 | the indicator on the front corner (the weave tell) |
 * | `brake` | 1 | the rear lamp bar lit (the brake check's tell) |
 */
import type { Frame } from '../../../../engine/render';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../../art/humanoid';
import { inPoly } from '../../../art/hd';
import { sitFrames, tumbleFrames } from '../boss/art-adds';
import { blinkFrame, brakeFrame } from '../boss/art-lorry';
import { bot, defStrip, finishA, frac, glyphHitC, hash2, holes, lineW, mat, Pen, soot, swanMark, top, wideHit, wideWidth, zwaanMats, type Dn } from './art-kit';
import { CAB, CAB_SPR, type Pt } from './cab-geo';

const PLATE = 'ZW-99';

// ---------------------------------------------------------------------------------------------
// The tractor
// ---------------------------------------------------------------------------------------------

/** The cab body's side outline (the high-roof sleeper at the back, the nose at the right). */
const CAB_SIDE: readonly Pt[] = [
  [38, -20.4],
  [38, -66.5],
  [40.4, -69.8],
  [48, -70.6],
  [70, -70.6],
  [80, -69.6],
  [86.4, -67.4],
  [90.4, -64.4],
  [93.4, -60],
  [96, -57],
  [97.6, -48],
  [98.6, -38],
  [99.6, -33],
  [100, -28],
  [100, -14],
  [98.4, -12.5],
  [73.2, -12.5],
  [71.8, -14],
  [71.8, -19],
  [70.4, -20.4],
];
/** The door glass (the driver's window). */
const CAB_WIN: readonly Pt[] = [
  [74.4, -52.4],
  [94, -52.4],
  [96.4, -41],
  [74.4, -41],
];
const [SW0, SWY0, SW1, SWY1] = CAB.window;
/** The front width of the cab (front view, the jackknife). */
const CAB_W = 46;
/** The front wheel's arch (the drive axles sit under the chassis behind the cab). */
const ARCH: Pt = [CAB.frontWheel, -7.5];

function inArch(x: number, y: number): boolean {
  return y > -17 && Math.hypot(x - ARCH[0], y - ARCH[1]) < 9.4;
}

function inSleeperWin(x: number, y: number): boolean {
  return x > SW0 && x < SW1 && y > SWY0 && y < SWY1;
}

/** The trucker at the wheel (seen through the glass) and the one who climbs out after the jackknife. */
export const TRUCKER: HumanStyle = {
  skin: 'skinB',
  hair: 'hairC',
  hairStyle: 'buzz',
  headgear: 'none',
  top: 'orange',
  topType: 'tee',
  pants: 'navy',
  boots: 'black',
  belt: 'black',
  build: 'heavy',
  face: ['walrus', 'bushy-brows'],
};

/** The gunner in the sleeper: a cap worn backwards, shades, a sleeveless shirt. */
export const GUNNER: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'cap-back',
  gear: 'red',
  top: 'steel',
  topType: 'tank',
  pants: 'stone',
  boots: 'black',
  belt: 'black',
  build: 'normal',
  face: ['shades', 'stubble'],
};

/**
 * The tractor at damage state `s` turned `yaw` degrees toward the camera (0 = side on; the
 * jackknife 25 … 90: the side face shrinks by cos(yaw) about the sleeper's back wall, the front face
 * grows to the right by sin(yaw)). The live tractor's wheels are the kit's wheel strip; the yaw
 * frames carry their own.
 */
function cabFrame(s: number, yaw: number, d: Dn): Frame {
  const k = Math.cos((yaw * Math.PI) / 180);
  const sn = Math.sin((yaw * Math.PI) / 180);
  const B = CAB.back;
  const p = new Pen(-4, -80, yaw > 0 ? 156 : 110, 81, d);
  const c = p.c;
  const m = zwaanMats(c);
  const X = (x: number): number => B + (x - B) * k;
  const U = (x: number): number => (k > 0.01 ? B + (x - B) / k : B);
  const map = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [X(x), y] as const);
  const side = k > 0.12;
  const dark = yaw > 0 ? -0.25 * sn : 0;
  const hw = lineW(d);
  const yellow = mat(c, 'gold', { spec: 0.6, shine: 30, lo1: 1, hi1: 3, lo: 2, hi: 5 });
  // ---- The chassis behind the cab (side on and squashed in the turn).
  {
    // The rails, the rear cross member with the lamp bar, the mudflap.
    p.box(X(0), -17.4, (96 - 0) * k, 4.8, { mat: m.black, z: -3.5, r: 0.5, bevel: 0.6, tone: dark });
    if (d > 1) for (let x = 6; x < 36; x += 8) p.box(X(x), -16, 0.9 * k + 0.2, 1.4, { mat: m.steel, z: -3.3, r: 0.2 });
    p.box(X(0), -19.4, 4.4 * k + 0.6, 6, { mat: m.black, z: -3, r: 0.5, tone: dark });
    p.box(X(0.2), -18.6, 1.8 * k + 0.4, 1.8, { mat: m.tail, z: -2.8, r: 0.3, bevel: 0.4 });
    p.box(X(0.2), -16.4, 1.8 * k + 0.4, 1.2, { mat: m.amber, z: -2.8, r: 0.2 });
    p.box(X(5), -13, 1.6 * k + 0.4, 10.5, { mat: m.plastic, z: -3.2, r: 0.3, tone: dark });
    // The fifth wheel: the turntable plate with its grease, the jaw slot, the ramps.
    p.box(X(12), -23.4, 24 * k, 3, {
      mat: m.steel,
      z: -2.6,
      r: 0.7,
      bevel: 0.6,
      tone: dark,
      tex: (t) => {
        const u = U(t.x + p.x0);
        if (Math.abs(u - 24) < 7 && frac(u * 0.6 + 0.3) < 0.55) t.tone -= 0.7;
      },
    });
    p.box(X(11), -20.6, 26 * k, 3.4, { mat: m.black, z: -2.7, r: 0.4, tone: dark });
    p.box(X(10.6), -22.2, 2 * k + 0.3, 1.2, { mat: m.well, z: -2.4 });
    // The mudguards over the tandem wheels (black quarter arcs) and a deck plate between them.
    for (const wx of CAB.rearWheels) {
      const arc: Pt[] = [];
      for (let a = 195; a <= 345; a += 15) arc.push([X(wx + Math.cos((a * Math.PI) / 180) * 9.2), -7.5 + Math.sin((a * Math.PI) / 180) * 9.2]);
      p.stroke(arc, 0.95, 0.95, { mat: m.black, z: -2.2 });
    }
    // The battery box and the air tanks between the drive axles and the cab.
    p.capsule(X(18), -12.6, X(30), -12.6, 1.8, 1.8, { mat: m.steel, z: -2.9, tone: dark });
    // The exhaust stack behind the sleeper: a chrome pipe with a perforated heat shield, its top
    // bent back.
    const sx = X(35);
    p.capsule(sx, -16, sx, -73, 1.25, 1.25, { mat: m.chrome, z: -2.5, tone: dark });
    p.capsule(sx, -73, X(33), -77.5, 1.2, 1.1, { mat: m.chrome, z: -2.4, tone: dark });
    p.box(sx - 1.7, -58, 3.4, 14, {
      mat: m.chrome,
      z: -2.35,
      r: 1.2,
      tone: dark - 0.1,
      tex: (t) => {
        if (d > 1 && frac((t.x + p.x0) * 1.6) < 0.3 && frac((t.y + p.y0) * 1.6) < 0.3) t.tone -= 0.8;
      },
    });
    soot(p, sx - 3, -80, 6, 8, sx - 1, -78, 3, 0.6);
    // The air lines coiled from the back wall down to the fifth wheel (red, yellow).
    const coil = (dx: number, mt: number): void => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push([X(37.2 - t * 6 + Math.sin(t * Math.PI * 6) * 0.6 + dx), -44 + t * 22]);
      }
      p.stroke(pts, d === 1 ? 0.5 : 0.36, d === 1 ? 0.5 : 0.36, { mat: mt, z: -2.3 });
    };
    coil(0, m.red);
    coil(-1.4, yellow);
    // The fuel tank under the cab (a chrome drum on two straps) and the steps under the door.
    p.capsule(X(54), -9.4, X(70), -9.4, 4.2, 4.2, { mat: m.chrome, z: -1.6, tone: dark });
    for (const tx of [57, 67]) p.box(X(tx), -14, 1.2 * k + 0.2, 9.4, { mat: m.black, z: -1.5, r: 0.2 });
    p.box(X(73), -12.6, 9 * k, 1.4, { mat: m.plastic, z: -1.5, r: 0.3 });
    p.box(X(73), -8.4, 9 * k, 1.4, { mat: m.plastic, z: -1.5, r: 0.3 });
  }
  if (side) {
    // ---- The painted side: rolled edges, the stripes, the shut lines, the louvres, the locker.
    p.body(
      map(CAB_SIDE),
      2.2 * Math.max(0.4, k),
      { mat: m.white, z: -2, part: c.newPart(), tone: dark },
      (x, y) => {
        const u = U(x);
        // The panels bulge a little under the window line.
        return y > -40 && y < -20 ? 0.3 * Math.sin(((y + 40) / 20) * Math.PI) * (u > 40 ? 1 : 0) : 0;
      },
      (x, y) => inArch(U(x), y) || inPoly(U(x), y, CAB_WIN) || inSleeperWin(U(x), y),
      (t, x, y) => {
        const u = U(x);
        if (y > -30.6 && y < -27) t.mat = m.orange;
        else if (y > -26 && y < -25) t.mat = m.red;
        // The door: its front at u 72.5, its bottom at −15, its top at −53.5.
        if (Math.abs(u - 72.5) < hw / Math.max(0.3, k) && y > -53.5 && y < -15) t.tone -= 0.8;
        if (Math.abs(y + 15) < hw && u > 72.5 && u < 98) t.tone -= 0.8;
        if (Math.abs(y + 53.5) < hw && u > 72.5 && u < 95.6) t.tone -= 0.6;
        // The sleeper's locker hatch under its window (a rounded panel with a shadow line).
        if (u > 42 && u < 60 && y > -38 && y < -32 && (Math.abs(u - 42.5) < hw * 1.4 || Math.abs(u - 59.5) < hw * 1.4)) t.tone -= 0.6;
        if (Math.abs(y + 38) < hw && u > 42.5 && u < 59.5) t.tone -= 0.6;
        // Vent louvres between the sleeper and the door.
        if (u > 61 && u < 69 && y > -52 && y < -44 && frac((y + 52) / 1.5) < 0.4) t.tone -= 0.45;
        // A horizon in the gloss of the door, sky above, road below.
        if (u > 73 && u < 97 && y > -38 && y < -16) t.tone += y < -24 + Math.sin(u * 0.2) * 0.3 ? 0.08 : -0.18;
        // A crease along the roof, a darker roof cap.
        if (y < -67.6 && y > -68.6) t.tone += 0.2;
        if (y < -69.4) t.tone -= 0.15;
        // Road grime up the lower edge.
        if (y > -18 && hash2(Math.floor(u * 2), Math.floor(y * 2)) < 0.25) t.tone -= 0.25;
      },
    );
    // The door glass with the driver behind it and two sky glints.
    const win = map(CAB_WIN);
    p.field(X(74), -53, X(97) - X(74) + 1, 13, (x, y) => (inPoly(x, y, win) ? (y + 53) * 0.12 : NaN), { mat: m.glass, z: 1.05, tone: dark }, (t, x, y) => {
      const u = U(x);
      if (s >= 2) {
        t.tone -= 0.9;
        if (hash2(Math.floor(u * 2), Math.floor(y * 2)) < 0.08) t.tone += 1.1;
        return;
      }
      const hx = u - 86;
      const hy = y + 45.2;
      if ((hx * hx) / 5 + (hy * hy) / 9 < 1 || (y > -42.6 && Math.abs(hx + 0.4) < 4.4)) t.tone -= 0.6;
      const g = frac((u + (y + 41) * 0.7) / 12);
      if (g < 0.1) t.tone += 0.9;
      else if (g > 0.16 && g < 0.2) t.tone += 0.5;
      if (s === 1) {
        const cx = u - 90;
        const cy = y + 46;
        const a = Math.atan2(cy, cx);
        const r = Math.hypot(cx, cy);
        if (r < 4.5 && frac((a / (Math.PI * 2)) * 7) < 0.12 / Math.max(0.6, r)) t.tone += 1.2;
      }
    });
    p.box(X(74.4), -41.4, (96.6 - 74.4) * k, 0.9, { mat: m.black, z: 1.1 });
    // The sleeper window (shut): tinted glass with a drawn curtain, a rubber seal round it.
    p.box(X(SW0) - 0.6, SWY0 - 0.6, (SW1 - SW0) * k + 1.2, SWY1 - SWY0 + 1.2, { mat: m.black, z: 0.9, r: 1, tone: dark });
    p.field(X(SW0), SWY0, (SW1 - SW0) * k, SWY1 - SWY0, (x, y) => (inSleeperWin(U(x), y) ? 0.2 + (y - SWY0) * 0.05 : NaN), { mat: m.glass, z: 1.05, tone: dark - 0.2 }, (t, x, y) => {
      const u = U(x);
      // The curtain's folds behind the glass (a dark red), a glint.
      if (y > SWY0 + 1.2) t.tone -= 0.5 - 0.2 * Math.sin(u * 1.6);
      if (s >= 2 && hash2(Math.floor(u * 3), Math.floor(y * 3)) < 0.1) t.tone += 0.9;
      if (frac((u + (y - SWY0) * 0.8) / 9) < 0.09) t.tone += 0.8;
    });
    // The grab handles, the door handle, the step below the door.
    p.capsule(X(71.4), -45.5, X(71.4), -23, 0.5, 0.5, { mat: m.chrome, z: 2.2 });
    p.capsule(X(39.6), -60, X(39.6), -22, 0.45, 0.45, { mat: m.chrome, z: 2.2 });
    p.box(X(74), -36.4, 3 * k, d === 1 ? 1 : 0.8, { mat: m.black, z: 1.6, r: 0.3 });
    // The amber side markers along the skirt, the indicator's lens on the front corner.
    p.box(X(93), -22, 2 * k, 1.4, { mat: m.amber, z: 1.8, r: 0.3, bevel: 0.4 });
    for (const mx of [44, 56, 74]) p.box(X(mx), -15.2, 1.2 * k, 0.9, { mat: m.amber, z: 1.7, r: 0.2 });
    // The front bumper, the headlight, the sun visor, the roof marker lights.
    p.box(X(92), -17, 9 * k, 8.5, { mat: m.plastic, z: 2, r: 1.2, bevel: 0.7 });
    p.box(X(98.2), -23, 2.2 * k, 4.5, { mat: m.head, z: 2.1, r: 0.5, bevel: 0.5 });
    p.box(X(91.5), -60.6, 5.1 * k, 2, { mat: m.black, z: 2.2, r: 0.4 });
    for (const mx of [76, 81, 86]) p.box(X(mx), -71.8, 1.6 * k + 0.2, 1.2, { mat: m.amber, z: 2.2, r: 0.3 });
    // THE LIVERY on the sleeper: the swan mark and the name in rust over the locker.
    const rust = bot('rust', d, d === 1 ? 1 : 2);
    if (k > 0.5) {
      swanMark(p, X(43.6), -61.6, 8 * Math.min(1, k + 0.2), rust, 2.5);
      const sz = 1;
      const nw = wideWidth('ZWAAN', sz) * k;
      const nx = X(50);
      p.paint(nx - 1, -67, nw + 2, 8, (x, y) => (wideHit('ZWAAN', nx, -65, sz, (x - nx) / k + nx, y) ? rust : 0), 2.5);
    }
    if (yaw === 0) {
      // The mirror on its arm, the two air horns on the roof.
      const hang = s >= 2 ? 3 : 0;
      p.stroke([[96.4, -50], [101.4, -50.4], [101.6, -48 + hang]], 0.45, 0.45, { mat: m.black, z: 2.4 });
      p.box(100.2, -53.5 + hang, 3.4, 12.5, { mat: m.black, z: 2.6, r: 0.8, bevel: 0.6 });
      p.box(101.6, -52.6 + hang, 1.4, 10.6, { mat: m.glass, z: 2.8, r: 0.3 });
      p.capsule(70, -71.6, 79, -72.8, 0.6, 1.4, { mat: m.chrome, z: 2.3 });
      p.capsule(72.6, -70.8, 82.4, -71.8, 0.6, 1.3, { mat: m.chrome, z: 2.2 });
    }
    if (s >= 1) {
      holes(p, X(40), -66, 58 * k, 44, s >= 2 ? 22 : 9, 41 + s, (x, y) => inPoly(U(x), y, CAB_SIDE) && !inPoly(U(x), y, CAB_WIN) && !inSleeperWin(U(x), y) && !inArch(U(x), y));
      p.shade(X(40), -44, 60 * k, 28, (x, y) => {
        const u = U(x);
        const a = Math.hypot((u - 82) / 6, (y + 22) / 3);
        const b = Math.hypot((u - 50) / 5, (y + 30) / 4);
        return (a < 1 ? -0.5 * (1 - a) : 0) + (b < 1 ? -0.45 * (1 - b) : 0);
      });
    }
    if (s >= 2) {
      soot(p, X(38), -72, 62 * k, 44, X(90), -54, 18 * Math.max(0.5, k), 0.7);
      soot(p, X(38), -72, 62 * k, 44, X(48), -64, 12 * Math.max(0.5, k), 0.5);
    }
  }
  if (yaw > 0) {
    // The front face: CAB_W wide, from the near corner (left on screen) to the far one.
    const F = (w: number): number => X(CAB.nose) + w * sn;
    const face: Pt[] = [[F(0), -63], [F(1.5), -66], [F(CAB_W - 1.5), -66], [F(CAB_W), -63], [F(CAB_W), -12], [F(0), -12]];
    p.body(face, 1.6, { mat: m.white, z: -2, part: c.newPart(), tone: 0.05 }, undefined, undefined, (t, _x, y) => {
      if (y > -39 && y < -37) t.mat = m.orange;
      if (y < -60) t.tone -= 0.1;
    });
    const W0 = F(3);
    const W1 = F(CAB_W - 3);
    p.field(W0 - 0.5, -60, W1 - W0 + 1, 20, (x, y) => (x >= W0 && x <= W1 && y > -59.4 && y < -40 ? 0.15 + (y + 59) * 0.01 : NaN), { mat: m.glass, z: 1.2, tone: -0.15 }, (t, x, y) => {
      const w = (x - X(CAB.nose)) / Math.max(0.05, sn);
      const cx = w - CAB_W * 0.36;
      const cy = y + 50;
      const a = Math.atan2(cy, cx);
      const r = Math.hypot(cx, cy);
      const lw = (d === 1 ? 0.5 : 0.3) / Math.max(1, r);
      if (r < 12 && (Math.abs(frac((a / (Math.PI * 2)) * 7 + r * 0.02) - 0.5) < lw * 1.6 || Math.abs(r - 4) < (d === 1 ? 0.5 : 0.3))) t.tone += 1.1;
      else if (frac((w + (y + 40) * 0.7) / 14) < 0.08) t.tone += 0.6;
    });
    p.box(F(2), -63, (CAB_W - 4) * sn, 2.8, { mat: m.black, z: 1.4, r: 0.4 });
    // The grille, the headlights, the bumper with the made-up plate.
    p.box(F(9), -35.5, 28 * sn, 12.5, { mat: m.black, z: 1.4, r: 0.8, bevel: 0.5 });
    for (let gy = -33.6; gy < -24; gy += 2.4) p.box(F(10), gy, 26 * sn, d === 1 ? 1 : 0.8, { mat: m.chrome, z: 1.6, r: 0.2 });
    for (const w0 of [2, CAB_W - 9]) {
      p.box(F(w0), -24.4, 7 * sn, 5, { mat: m.black, z: 1.45, r: 0.6 });
      p.box(F(w0 + 0.6), -23.8, 5.8 * sn, 3.8, { mat: m.head, z: 1.5, r: 0.5, bevel: 0.5 });
    }
    p.box(F(0), -18, CAB_W * sn, 7, { mat: m.plastic, z: 1.6, r: 1, bevel: 0.6 });
    p.box(F(12), -16.6, 22 * sn, 4.4, { mat: m.plate, z: 1.8, r: 0.4 });
    if (sn > 0.85) {
      const ink = bot('black', d, 0);
      const cx = F(23);
      p.paint(cx - 12, -16.6, 24, 4.4, (x, y) => (glyphHitC(PLATE, cx, -14.4, d === 1 ? 0.8 : 0.72, 1, x, y) ? ink : 0));
    }
    soot(p, F(0), -66, CAB_W * sn, 30, F(CAB_W * 0.5), -54, 20 * sn, 0.5);
    // The wheels under it: the near ones seen at an angle, the far front one.
    const wk = Math.max(0.3, k);
    for (const wx of [X(CAB.frontWheel), F(CAB_W - 7), ...CAB.rearWheels.map(X)]) {
      p.ellipsoid(wx, -7.5, 7.5 * wk, 7.5, { mat: m.tyre, z: 0.8, round: 0.6 });
      p.ellipsoid(wx, -7.5, 4 * wk, 4, { mat: m.steel, z: 0.9, round: 0.4 });
    }
  }
  return p.frame(finishA(c, 0.3));
}

// ---------------------------------------------------------------------------------------------
// The sleeper window (anchor: the part's rear on the road; drawn over the body)
// ---------------------------------------------------------------------------------------------

/** 0 half open (the glass slid back), 1 open (the dark bunk, the curtain pulled aside), 2 smashed. */
function windowFrame(f: number, d: Dn): Frame {
  const p = new Pen(SW0 - 2, SWY0 - 2, SW1 - SW0 + 4, SWY1 - SWY0 + 4, d);
  const c = p.c;
  const m = zwaanMats(c);
  const open = f === 0 ? 0.5 : 1;
  // The dark sleeper inside: the bunk's edge, a pillow, a lamp glow at the top.
  p.box(SW0, SWY0, SW1 - SW0, SWY1 - SWY0, {
    mat: m.well,
    z: 0.5,
    r: 0.8,
    tex: (t) => {
      const y = t.y + p.y0;
      const x = t.x + p.x0;
      if (y > SWY1 - 3) t.tone += 0.6;
      if (y < SWY0 + 2 && Math.abs(x - (SW0 + SW1) / 2) < 3) t.tone += 0.8;
    },
  });
  p.box(SW0 + 0.6, SWY1 - 3.2, 5, 2.2, { mat: m.plastic, z: 0.7, r: 0.8, tone: 0.3 });
  if (f < 2) {
    // The curtain bunched at the front edge, the glass slid back behind the frame.
    p.box(SW1 - 2.6, SWY0, 2.6, SWY1 - SWY0, { mat: m.plastic, z: 0.8, r: 0.6, tone: -0.4, tex: (t) => (frac((t.y + p.y0) * 0.9) < 0.3 ? (t.tone -= 0.3) : 0) });
    const gw = (SW1 - SW0) * (1 - open) + 1.2;
    p.box(SW0, SWY0, gw, SWY1 - SWY0, { mat: m.glass, z: 0.9, r: 0.4, tone: -0.1, tex: (t) => (frac(((t.x + p.x0) + (t.y + p.y0) * 0.8) / 7) < 0.12 ? (t.tone += 0.7) : 0) });
  } else {
    // Smashed: shards round the frame, the curtain torn, soot.
    p.box(SW0, SWY0, SW1 - SW0, SWY1 - SWY0, { mat: m.well, z: 0.5, r: 0.8 });
    const shard = top('slate', d, 1);
    p.paint(SW0, SWY0, SW1 - SW0, SWY1 - SWY0, (x, y) => {
      const e = Math.min(x - SW0, SW1 - x, y - SWY0, SWY1 - y);
      return e < 1.4 && hash2(Math.floor(x * 2 + 3), Math.floor(y * 2)) < 0.45 ? shard : 0;
    }, 3);
    soot(p, SW0 - 2, SWY0 - 2, SW1 - SW0 + 4, SWY1 - SWY0 + 4, (SW0 + SW1) / 2, SWY0, 8, 0.6);
  }
  // The rubber seal round the frame.
  p.box(SW0 - 0.6, SWY0 - 0.6, SW1 - SW0 + 1.2, 0.9, { mat: m.black, z: 1.2, r: 0.3 });
  p.box(SW0 - 0.6, SWY1 - 0.3, SW1 - SW0 + 1.2, 0.9, { mat: m.black, z: 1.2, r: 0.3 });
  return p.frame(finishA(c, 0.25));
}

// ---------------------------------------------------------------------------------------------
// The people (bloodless): the gunner, the driver
// ---------------------------------------------------------------------------------------------

/** How far below the sill (px) the gunner's hip sits: everything below the sill is cut away (inside the cab). */
export const GUNNER_SILL = 4;

/** The gunner from the hip up, cut at the window sill (`GUNNER_SILL` px above his hip). */
function upper(style: HumanStyle, pose: Pose, d: Dn): Frame {
  const f = renderHuman(style, pose, 'upper', d as Density);
  const buf = f.buf.clone();
  const cut = Math.max(0, Math.round((f.oy - GUNNER_SILL) * d));
  for (let y = cut; y < buf.h; y++) for (let x = 0; x < buf.w; x++) buf.data[y * buf.w + x] = 0;
  return { ...f, buf };
}

/** The tell: he leans out of the window, raises the pistol, aims back along the lane. */
function gunnerAim(d: Dn): Frame[] {
  const keys: Pose[] = [
    { weapon: 'pistol', aim: 'down', lean: -4, armF: { to: [2, -13], hand: 'grip' }, expr: 'normal' },
    { weapon: 'pistol', aim: 'fwd', lean: 4, armF: { to: [2, -13], hand: 'grip' }, expr: 'shout' },
    { weapon: 'pistol', aim: 'fwd', lean: 8, armF: { to: [2, -13], hand: 'grip' }, expr: 'shout' },
  ];
  return keys.map((pose) => upper(GUNNER, pose, d));
}

/** The shots: the recoil and back. */
function gunnerFire(d: Dn): Frame[] {
  return [
    upper(GUNNER, { weapon: 'pistol', aim: 'fwd', lean: 8, recoil: 1, armF: { to: [2, -13], hand: 'grip' }, expr: 'shout' }, d),
    upper(GUNNER, { weapon: 'pistol', aim: 'fwd', lean: 8, armF: { to: [2, -13], hand: 'grip' }, expr: 'shout' }, d),
  ];
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

for (const s of [0, 1, 2]) defStrip(CAB_SPR.body(s), (d) => [cabFrame(s, 0, d)]);
defStrip(CAB_SPR.yaw, (d) => [25, 50, 75, 90].map((y) => cabFrame(2, y, d)), { ticksPerFrame: 10, loop: false, defer: true });
defStrip(CAB_SPR.window, (d) => [0, 1, 2].map((f) => windowFrame(f, d)), { ticksPerFrame: 6, loop: false });
defStrip(CAB_SPR.gunner('aim'), gunnerAim, { ticksPerFrame: 8, loop: false });
defStrip(CAB_SPR.gunner('fire'), gunnerFire, { ticksPerFrame: 4 });
defStrip(CAB_SPR.gunner('tumble'), (d) => tumbleFrames(GUNNER, d), { ticksPerFrame: 4, defer: true });
defStrip(CAB_SPR.gunner('sit'), (d) => sitFrames(GUNNER, d), { ticksPerFrame: 30, defer: true });
defStrip(CAB_SPR.driver('tumble'), (d) => tumbleFrames(TRUCKER, d), { ticksPerFrame: 4, defer: true });
defStrip(CAB_SPR.driver('sit'), (d) => sitFrames(TRUCKER, d), { ticksPerFrame: 30, defer: true });
defStrip(CAB_SPR.blink, (d) => [blinkFrame(0, d), blinkFrame(1, d)], { ticksPerFrame: 8 });
defStrip(CAB_SPR.brake, (d) => [brakeFrame(d)]);
