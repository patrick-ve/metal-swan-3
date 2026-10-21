/**
 * The ring wagons — the 1× art (64-colour PAL, outline A: 1 logical px of ink, light from the
 * upper left) and the registration of every wagon strip with its 2× / 4× drawer (art-hd.ts: one
 * density-generic drawer per strip; geometry is law: the HD frames keep the 1× size and anchor).
 * Both read the same samples (shape.ts), so every density draws the same car.
 *
 * Strips (geometry.ts `ID`; the anchor of the body strips is the road point under the car's middle):
 * - `ring/wagon/<green|white>/body-<0..3>` (5 frames: level, up, down, far, near): the body by its
 *   damage state (0 clean, 1 dents, 2 + cracked glass, 3 + a buckled bonnet, soot, a hanging
 *   bumper; smoke and fire are fx on 3). The glass is a hole: the cabin strip and the driver show
 *   through. The roof gear, the mirrors and the push bar are drawn in.
 * - `ring/wagon/<livery>/left` (2 frames: clean, wrecked): the left side facing left, never
 *   mirrored (`MAJOR COCKTAILS`; the white wagon's left side).
 * - `ring/wagon/<livery>/spin-<0|3>` (8 frames, deferred): the car turned in 45° steps with its
 *   wheels and opaque glass — the boarding scene's handbrake turn and the wreck's spin-out.
 * - `ring/wagon/cabin` (6 frames: the 5 poses, facing left): the interior through the glass (the
 *   far side's windows, headrests, the steering wheel with gloved hands) and the wheel wells.
 * - `ring/wagon/wheel-alloy` / `wheel-cover` (4 turn frames, centre anchor): the green wagon's
 *   silver five-spoke alloys, the white wagon's silver wheel covers.
 * - `ring/wagon/flame` (4 frames, bottom-centre anchor): fire on the bonnet at the last cells.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { DCanvas } from '../../bosses/ams/canvas';
import * as hd from './art-hd';
import { BODY_CANVAS, CABIN_CANVAS, CABIN_LEFT, ID, LIVERIES, POSES, SPIN_CANVAS, SPIN_FRAMES, WHEEL_HALF, type BodyState, type Livery } from './geometry';
import { LEFT_VIEW, M, PART, POSE_VIEW, sampleGrid, spinView, type Look, type Sample, type SampleGrid, type View } from './shape';

// ---------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------

interface Ramp1 {
  readonly ramp: readonly Color[];
  readonly base: number;
}

const r1 = (ramp: readonly Color[], base: number): Ramp1 => ({ ramp, base });

/** 1× ramps per material (dark → light) and the index a face-on, unshaded px takes. */
function rampsOf(livery: Livery): Readonly<Record<number, Ramp1>> {
  const green = livery === 'green';
  return {
    // GREEN: a deep bottle green (integrator, wave B: the user's photos; it read too light), the
    // camouflage blotches darker still and close to it (dark olive green, near black).
    [M.PAINT]: green ? r1([PAL.ink[0], PAL.olive[0], PAL.green[1], PAL.green[2]], 2) : r1([PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]], 2),
    [M.CAMO_D]: green ? r1([PAL.ink[0], PAL.olive[0], PAL.teal[0]], 1) : r1([PAL.ink[1], PAL.olive[0], PAL.olive[1]], 1),
    [M.CAMO_B]: green ? r1([PAL.ink[0], PAL.ink[1], PAL.olive[0]], 1) : r1([PAL.ink[0], PAL.ink[1], PAL.black[2]], 1),
    [M.LET_Y]: r1([PAL.gold[0], PAL.gold[1], PAL.gold[2], PAL.gold[3]], 2),
    [M.LET_P]: r1([PAL.pink[0], PAL.pink[1], PAL.pink[2]], 2),
    [M.BAND_O]: r1([PAL.rust[2], PAL.orange[1], PAL.orange[2]], 1),
    [M.BAND_Y]: r1([PAL.gold[1], PAL.gold[2], PAL.gold[3]], 1),
    [M.NAVY]: r1([PAL.navy[0], PAL.navy[1], PAL.sky[0]], 1),
    [M.LET_W]: r1([PAL.snow[1], PAL.snow[2], PAL.snow[3]], 2),
    [M.PLASTIC]: r1([PAL.ink[1], PAL.steel[0], PAL.steel[1]], 1),
    [M.BLACK]: r1([PAL.ink[0], PAL.ink[1], PAL.black[2]], 1),
    [M.GLASS]: r1([PAL.ink[1], PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.sky[2]], 1),
    [M.CHROME]: r1([PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[3]], 3),
    [M.STEEL]: r1([PAL.steel[1], PAL.steel[2], PAL.steel[3], PAL.steel[4]], 2),
    [M.RED]: r1([PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]], 2),
    [M.AMBER]: r1([PAL.rust[2], PAL.orange[1], PAL.orange[2], PAL.gold[2]], 2),
    [M.CLEAR]: r1([PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]], 2),
    [M.PLATE]: r1([PAL.gold[1], PAL.gold[2], PAL.gold[3]], 1),
    [M.PLATE_TEXT]: r1([PAL.ink[1]], 0),
    [M.WELL]: r1([PAL.ink[0], PAL.ink[1]], 0),
    [M.TYRE]: r1([PAL.ink[0], PAL.ink[1], PAL.black[2]], 1),
    [M.RIM]: r1([PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[3]], 1),
    [M.CAN]: r1([PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]], 2),
    [M.PINK]: r1([PAL.pink[0], PAL.pink[1], PAL.pink[2]], 1),
    [M.LEAF]: r1([PAL.green[2], PAL.green[3], PAL.green[4]], 1),
    [M.DRINK]: r1([PAL.red[2], PAL.orange[1], PAL.orange[2]], 1),
    [M.LIME]: r1([PAL.green[3], PAL.green[4]], 1),
    [M.ICE]: r1([PAL.sky[1], PAL.sky[2], PAL.sky[3]], 2),
    [M.GLINT]: r1([PAL.steel[2], PAL.steel[3], PAL.steel[4]], 1),
    [M.CRACK]: r1([PAL.snow[1], PAL.snow[2]], 1),
    [M.GRILLE]: r1([PAL.ink[0], PAL.ink[1], PAL.steel[0]], 1),
    [M.STRAP]: r1([PAL.red[1], PAL.red[2], PAL.red[3]], 1),
    [M.CABIN]: r1([PAL.ink[0], PAL.ink[1], PAL.steel[0]], 1),
    [M.SEAT]: r1([PAL.ink[0], PAL.ink[1], PAL.black[2]], 2),
    [M.FAR]: r1([PAL.steel[0], PAL.steel[1], PAL.steel[2]], 1),
    [M.GLOVE]: r1([PAL.ink[1], PAL.black[2], PAL.brown[1]], 1),
  };
}

const RAMPS: Readonly<Record<Livery, Readonly<Record<number, Ramp1>>>> = { green: rampsOf('green'), white: rampsOf('white') };

/** The key light's turn on a face: + lit (faces turned left), − away (faces turned right). */
function faceLight(s: Sample): number {
  const dot = -0.55 * s.nx + 0.58 * s.nz;
  return Math.round((dot - 0.58) * 2);
}

/** The 1× colour of a sample (with the edge light from its neighbours in the grid). */
function colour1x(g: SampleGrid, i: number, j: number, livery: Livery): Color {
  const s = g.cells[j * g.W + i];
  if (!s || s.mat === M.HOLE) return 0;
  const R = RAMPS[livery][s.mat];
  if (!R) return 0;
  let k = R.base + s.tone;
  if (!s.fixed) {
    k += faceLight(s);
    const up = j > 0 ? g.cells[(j - 1) * g.W + i] : null;
    const dn = j + 1 < g.H ? g.cells[(j + 1) * g.W + i] : null;
    const y = g.y0 + j + 0.5;
    if (s.part === PART.BODY || s.part === PART.TRIM || s.part === PART.RAIL || s.part === PART.RACK || s.part === PART.BAR) {
      // Edge light: the top px of a part catches the key light; the lower body turns under.
      if (!up || up.part !== s.part) k += 1;
      else if (s.part === PART.BODY && (!dn || dn.part === PART.WELL) && y > -8) k -= 1;
      if (s.part === PART.BODY && y > -5.5) k -= 1;
    } else if (s.part === PART.TYRE || s.part === PART.LIGHT) {
      if (!up || up.part !== s.part) k += 1;
    }
  }
  const n = R.ramp.length;
  return R.ramp[k < 0 ? 0 : k >= n ? n - 1 : k];
}

/** Render a look on a 1× canvas box: the samples, the colours, then the ink outline. */
function render1x(look: Look, box: { x0: number; y0: number; x1: number; y1: number }, outline: boolean): Frame {
  const g = sampleGrid(look, box, 1);
  const c = new DCanvas(box.x0, box.y0, box.x1, box.y1);
  const b = c.b;
  for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) {
    const col = colour1x(g, i, j, look.livery);
    if (col) b.set(i, j, col);
  }
  if (!outline) return c.frame(false);
  // Outline A round the silhouette; the glass holes stay open (the cabin frames the glass).
  c.outline();
  for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) {
    const s = g.cells[j * g.W + i];
    if (s && s.mat === M.HOLE) b.set(i, j, 0);
  }
  b.touch();
  return { buf: b, ox: c.X(0), oy: c.Y(0) };
}

// ---------------------------------------------------------------------------------------------
// The looks of every strip
// ---------------------------------------------------------------------------------------------

export function bodyLook(livery: Livery, state: BodyState, view: View): Look {
  return { livery, state, view, glass: 'hole', wheels: false };
}

export function spinLook(livery: Livery, state: BodyState, k: number): Look {
  return { livery, state, view: spinView(k), glass: 'opaque', wheels: true };
}

export function cabinLook(frame: number): Look {
  return { livery: 'green', state: 0, view: frame === CABIN_LEFT ? LEFT_VIEW : POSE_VIEW[POSES[frame]], glass: 'hole', wheels: false, cabin: true };
}

function bodyLo(livery: Livery, state: BodyState, pose: number): Frame {
  return render1x(bodyLook(livery, state, POSE_VIEW[POSES[pose]]), BODY_CANVAS, true);
}

function leftLo(livery: Livery, frame: number): Frame {
  return render1x(bodyLook(livery, frame === 0 ? 0 : 3, LEFT_VIEW), BODY_CANVAS, true);
}

function spinLo(livery: Livery, state: BodyState, k: number): Frame {
  return render1x(spinLook(livery, state, k), SPIN_CANVAS, true);
}

function cabinLo(frame: number): Frame {
  return render1x(cabinLook(frame), CABIN_CANVAS, false);
}

// ---------------------------------------------------------------------------------------------
// Wheels and the flame
// ---------------------------------------------------------------------------------------------

/** What a wheel shows at (x, y) from its centre on turn frame f: 0 none, else a material. */
export function wheelAt(kind: 'alloy' | 'cover', f: number, x: number, y: number, d: number): { mat: number; tone: number } | null {
  const r = Math.hypot(x, y);
  if (r >= 6.6) return null;
  if (r >= 4.4) return { mat: M.TYRE, tone: r < 4.9 ? 1 : 0 };
  const a = Math.atan2(y, x);
  if (kind === 'alloy') {
    // Five spokes turning 18° per frame, a hub, the dark brake disc between them.
    if (r < 1.3) return { mat: M.RIM, tone: r < 0.6 ? 2 : 1 };
    if (r > 3.9) return { mat: M.RIM, tone: 0 };
    const rot = (f * 18 * Math.PI) / 180;
    const step = (Math.PI * 2) / 5;
    let da = (((a - rot) % step) + step) % step;
    if (da > step / 2) da = step - da;
    const w = (d === 1 ? 0.42 : 0.36) - r * 0.03;
    if (da < w) return { mat: M.RIM, tone: da < w * 0.4 ? 1 : 0 };
    return { mat: M.WELL, tone: 0 };
  }
  // The wheel cover: a silver dish with six slots turning 15° per frame and a centre cap.
  if (r < 1.1) return { mat: M.RIM, tone: 2 };
  const rot = (f * 15 * Math.PI) / 180;
  const step = Math.PI / 3;
  let da = (((a - rot) % step) + step) % step;
  if (da > step / 2) da = step - da;
  if (r > 2.2 && r < 3.6 && da < (d === 1 ? 0.2 : 0.16)) return { mat: M.GRILLE, tone: 0 };
  return { mat: M.RIM, tone: r > 3.8 ? -1 : r < 1.8 ? 1 : 0 };
}

function wheelLo(kind: 'alloy' | 'cover', f: number): Frame {
  const n = WHEEL_HALF;
  const c = new DCanvas(-n, -n, n, n);
  const R = RAMPS.green;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const w = wheelAt(kind, f, i + 0.5, j + 0.5, 1);
    if (!w) continue;
    const ramp = R[w.mat];
    // Light from the upper left: the upper-left quarter of the dish one step lighter.
    const lit = w.mat === M.RIM && i + j < -2 ? 1 : 0;
    const k = Math.max(0, Math.min(ramp.ramp.length - 1, ramp.base + w.tone + lit));
    c.set(i, j, ramp.ramp[k]);
  }
  return c.frame(true);
}

/** The flame's licks (frame f): 0 none, else a fire tone 1 … 4 (hot core 4). */
export function flameAt(f: number, x: number, y: number): number {
  // A tongue rising from (0, 0), swaying by frame.
  const sway = [0, 0.8, -0.3, -0.9][f] ?? 0;
  const h = 11 + ([0, 1.5, -1, 0.8][f] ?? 0);
  const t = -y / h;
  if (t < 0 || t > 1) return 0;
  const cx = sway * t * t;
  const w = 3.6 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.35);
  const dx = Math.abs(x - cx);
  if (dx > w) return 0;
  const q = dx / Math.max(0.01, w);
  if (t < 0.55 && q < 0.45) return 4;
  if (t < 0.8 && q < 0.7) return 3;
  return q < 0.9 ? 2 : 1;
}

function flameLo(f: number): Frame {
  const c = new DCanvas(-5, -13, 5, 0);
  const fire = [PAL.red[1], PAL.red[2], PAL.orange[1], PAL.gold[2], PAL.gold[3]];
  for (let j = -13; j <= 0; j++) for (let i = -5; i <= 5; i++) {
    const k = flameAt(f, i + 0.5, j + 0.5);
    if (k > 0) c.set(i, j, fire[k]);
  }
  return c.frame(true);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const F5 = [0, 1, 2, 3, 4];
const F4 = [0, 1, 2, 3];
const F8 = Array.from({ length: SPIN_FRAMES }, (_, k) => k);

for (const L of LIVERIES) {
  const ids = ID[L];
  for (const s of [0, 1, 2, 3] as const) {
    defineSprite(ids.body[s], () => F5.map((p) => bodyLo(L, s, p)), { hd: (d) => F5.map((p) => hd.bodyHd(L, s, p, d)) });
  }
  defineSprite(ids.left, () => [0, 1].map((f) => leftLo(L, f)), { hd: (d) => [0, 1].map((f) => hd.leftHd(L, f, d)) });
  for (const s of [0, 3] as const) {
    defineSprite(ids.spin[s], () => F8.map((k) => spinLo(L, s, k)), { defer: true, ticksPerFrame: 3, hd: (d) => F8.map((k) => hd.spinHd(L, s, k, d)) });
  }
  const kind = L === 'green' ? 'alloy' : 'cover';
  defineSprite(ids.wheel, () => F4.map((f) => wheelLo(kind, f)), { ticksPerFrame: 2, hd: (d) => F4.map((f) => hd.wheelHd(kind, f, d)) });
}
defineSprite(ID.cabin, () => [0, 1, 2, 3, 4, CABIN_LEFT].map((f) => cabinLo(f)), { hd: (d) => [0, 1, 2, 3, 4, CABIN_LEFT].map((f) => hd.cabinHd(f, d)) });
defineSprite(ID.flame, () => F4.map((f) => flameLo(f)), { ticksPerFrame: 4, hd: (d) => F4.map((f) => hd.flameHd(f, d)) });

/** A blank frame of a canvas box (tests and tools). */
export function blankFrame(box: { x0: number; y0: number; x1: number; y1: number }): Frame {
  return { buf: new PixelBuffer(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1), ox: -box.x0, oy: -box.y0 };
}
