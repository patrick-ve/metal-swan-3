/**
 * `metronome-turret` art (`machine/metronome-turret/…`): an original upside-down parade metronome.
 * A crimson pyramid with gold trim and a gold tempo scale hangs from a steel bracket; its steel
 * pendulum carries a sliding brass weight and ends in a crimson bob with a short gun barrel.
 *
 * Every strip has a hanging variant and a `-floor` variant (the same machine stood upright: all
 * shapes mirrored vertically, shading redone so the light still comes from the top-left).
 * - `body`, `body-floor`: the pyramid; anchor = the mount line (the ceiling's underside / the floor).
 * - `dent`, `dent-floor`: the dented-plate overlay (≤ 50 % HP), same anchor.
 * - `pendulum`, `pendulum-floor`: 21 frames, −50° … +50° in 5° steps; anchor = the pivot pixel.
 * - `weight`, `weight-floor`: 21 frames (same angles); centre anchor (the logic slides it along the rod).
 * - `wreck`, `wreck-floor`: the broken box (the lower third gone, a rod stub, soot).
 * - `snap`: 8 frames, the snapped pendulum tumbling (centre anchor).
 * - `bullet`: 2 frames, the `metronome-bullet` (a round brass pellet, centre anchor).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { rivet } from '../../../art/machines';
import { Composer, shadeLayer } from '../../../art/paint';
import { METRONOME, METRONOME_FRAMES } from './geom';
import { dentOverlay, fr, Mirror } from './kit.art';
import { trimmed } from './tank.art';

const ART = 'machine/metronome-turret';

/** Body buffer: the mount line sits between rows OY − 1 and OY (hanging: shapes below it). */
const BW = 36;
const BH = 40;
const BOX = 18;

/** The pyramid outline (hanging pose, anchor-relative). */
const PYRAMID: ReadonlyArray<readonly [number, number]> = [
  [-13, 2],
  [13, 2],
  [5, 32],
  [-5, 32],
];

/** Anchor row of a body buffer for the pose. */
function bodyOy(up: boolean): number {
  return up ? BH - 1 : 1;
}

/** The steel ceiling (or floor) bracket with two bolts. */
function bracketLayer(up: boolean): PixelBuffer {
  const b = new PixelBuffer(BW, BH);
  const m = new Mirror(b, BOX, bodyOy(up), up);
  m.rect(-12, 0, 24, 3, PAL.steel[2]);
  shadeLayer(b, PAL.steel, { hi: 1, lo: 1 });
  m.set(-10, 1, PAL.steel[4]).set(9, 1, PAL.steel[4]);
  return b;
}

/** The crimson pyramid: gold trim, the slot the rod swings over, a gold tempo scale, the apex cap. */
function pyramidLayer(up: boolean, broken = false): PixelBuffer {
  const b = new PixelBuffer(BW, BH);
  const m = new Mirror(b, BOX, bodyOy(up), up);
  if (broken) {
    // The lower third has broken off along a jagged line.
    m.poly([[-13, 2], [13, 2], [8, 22], [5, 20], [3, 24], [0, 21], [-2, 25], [-5, 21], [-8, 23]], PAL.red[2]);
  } else m.poly(PYRAMID, PAL.red[2]);
  shadeLayer(b, PAL.red, { hi: 1, lo: 1 });
  // A darker right-hand face (3/4 view), then the gold trim along the base and both slants.
  const bottom = broken ? 20 : 31;
  for (let y = 3; y <= bottom; y++) {
    const xr = Math.floor(13 - ((13 - 5) * (y - 2)) / 30);
    m.set(xr - 1, y, PAL.red[1]);
    m.set(xr - 2, y, PAL.red[1]);
  }
  m.hline(-12, 12, 3, PAL.gold[3]);
  m.hline(-12, 12, 4, PAL.gold[1]);
  for (let y = 5; y <= bottom; y++) {
    const xl = Math.ceil(-13 + ((13 - 5) * (y - 2)) / 30);
    m.set(xl + 1, y, PAL.gold[2]);
  }
  // The groove the rod swings over, and the tempo scale ("gold numbers") on both sides.
  m.rect(-1, 6, 3, bottom - 7, PAL.red[0]);
  for (let y = 7, k = 0; y <= bottom - 3; y += 3, k++) {
    const long = k % 2 === 0;
    m.hline(long ? -5 : -4, -3, y, PAL.gold[2]);
    m.hline(3, long ? 5 : 4, y, PAL.gold[1]);
  }
  if (!broken) {
    // Apex cap: a gold collar and knob.
    m.rect(-5, 31, 11, 2, PAL.gold[2]);
    m.hline(-5, 5, 31, PAL.gold[3]);
    m.rect(-2, 33, 5, 2, PAL.gold[1]);
    m.set(-1, 33, PAL.gold[3]);
  } else {
    // Splintered edge and soot.
    for (let x = -9; x <= 8; x += 2) m.set(x, 20 + ((x * 7) & 3), PAL.ink[1]);
    for (let y = 8; y <= 18; y += 3) for (let x = -6; x <= 6; x += 4) if (((x + y) & 1) === 0) m.set(x + (y & 1), y, PAL.ink[1]);
  }
  // Rivets on the bracket side of the face.
  rivet(b, m.x(-9), m.y(up ? 7 : 6), PAL.red);
  rivet(b, m.x(8), m.y(up ? 7 : 6), PAL.red);
  return b;
}

function bodyFrame(up: boolean): Frame {
  const c = new Composer(BW, BH);
  c.add(bracketLayer(up), { ramp: PAL.steel });
  c.add(pyramidLayer(up), { ramp: PAL.red });
  return fr(c.finish(), BOX, bodyOy(up));
}

function wreckFrame(up: boolean): Frame {
  const c = new Composer(BW, BH);
  c.add(bracketLayer(up), { ramp: PAL.steel });
  c.add(pyramidLayer(up, true), { ramp: PAL.red });
  // A rod stub still hangs from the pivot, bent.
  const s = new PixelBuffer(BW, BH);
  const m = new Mirror(s, BOX, bodyOy(up), up);
  for (let k = 0; k <= 9; k++) {
    const x = Math.round(k * 0.45);
    m.rect(x, METRONOME.pivotY + k, 2, 1, PAL.steel[3]);
    m.set(x + 1, METRONOME.pivotY + k, PAL.steel[1]);
  }
  m.circle(0, METRONOME.pivotY, 2, PAL.gold[1]);
  m.set(0, METRONOME.pivotY, INK);
  c.add(s, { ramp: PAL.steel });
  return fr(c.finish(), BOX, bodyOy(up));
}

// ------------------------------------------------------------------------------------ pendulum

/** Pendulum buffers: the pivot pixel at (PX, PY) hanging, (PX, PH − 1 − PY) standing. */
const PW = 77;
const PH = 52;
const PX = 38;
const PY = 3;
/** Length of the steel rod (pivot → the bob's back) and the bob radius. */
const ROD = METRONOME.rod - 3;
const BOB_R = 3;

/** Direction of the pendulum for an angle (deg) in buffer space. */
function dir(deg: number, up: boolean): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a), up ? -Math.cos(a) : Math.cos(a)];
}

function pendulumFrame(deg: number, up: boolean): Frame {
  const py = up ? PH - 1 - PY : PY;
  const [dx, dy] = dir(deg, up);
  const c = new Composer(PW, PH);
  // The steel rod: 2 px thick, lit side toward the upper left.
  const rod = new PixelBuffer(PW, PH);
  rod.thickLine(PX, py, Math.round(PX + dx * ROD), Math.round(py + dy * ROD), 3, PAL.steel[3]);
  shadeLayer(rod, PAL.steel, { base: 2, hi: 1, lo: 1 });
  c.add(rod, { ramp: PAL.steel });
  // The bob: a crimson ball with a gold ring and a short steel barrel past it (the gun).
  const bob = new PixelBuffer(PW, PH);
  const bx = PX + dx * METRONOME.rod;
  const by = py + dy * METRONOME.rod;
  bob.thickLine(Math.round(bx), Math.round(by), Math.round(PX + dx * (METRONOME.muzzle + 1)), Math.round(py + dy * (METRONOME.muzzle + 1)), 3, PAL.steel[1]);
  shadeLayer(bob, PAL.steel, { hi: 1, lo: 1 });
  bob.circle(Math.round(bx), Math.round(by), BOB_R, PAL.gold[1]);
  bob.circle(Math.round(bx), Math.round(by), BOB_R - 1, PAL.red[2]);
  bob.set(Math.round(bx) - 1, Math.round(by) - 1, PAL.red[3]);
  bob.set(Math.round(bx) + 1, Math.round(by) + 1, PAL.red[1]);
  c.add(bob, { ramp: PAL.red });
  // The hub over the pivot.
  const hub = new PixelBuffer(PW, PH);
  hub.circle(PX, py, 2, PAL.gold[2]);
  hub.set(PX - 1, py - 1, PAL.gold[3]);
  hub.set(PX, py, PAL.gold[0]);
  c.add(hub, { ramp: PAL.gold });
  return trimmed(c.finish(), PX, py);
}

/** The sliding brass weight: a trapezoid across the rod (wide end toward the pivot), centre anchor. */
function weightFrame(deg: number, up: boolean): Frame {
  const S = 15;
  const C = 7;
  const [dx, dy] = dir(deg, up);
  const b = new PixelBuffer(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x - C;
      const py = y - C;
      const u = px * dx + py * dy; // along the rod (+ = toward the bob)
      const v = -px * dy + py * dx; // across
      if (Math.abs(u) > 2.6) continue;
      const half = 4.2 - (u + 2.6) * 0.3;
      if (Math.abs(v) > half) continue;
      b.set(x, y, PAL.gold[2]);
    }
  }
  shadeLayer(b, PAL.gold, { hi: 1, lo: 1, glint: true });
  return fr(b.outline(INK), C, C);
}

/** The snapped pendulum tumbling: rod, weight and bob turning in 45° steps (centre anchor). */
function snapFrames(): Frame[] {
  const out: Frame[] = [];
  const S = 44;
  const C = 22;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const c = new Composer(S, S);
    const rod = new PixelBuffer(S, S);
    rod.thickLine(Math.round(C - dx * 14), Math.round(C - dy * 14), Math.round(C + dx * 12), Math.round(C + dy * 12), 2, PAL.steel[3]);
    shadeLayer(rod, PAL.steel, { base: 3 });
    c.add(rod, { ramp: PAL.steel });
    const parts = new PixelBuffer(S, S);
    parts.circle(Math.round(C + dx * 14), Math.round(C + dy * 14), 3, PAL.gold[1]);
    parts.circle(Math.round(C + dx * 14), Math.round(C + dy * 14), 2, PAL.red[2]);
    parts.circle(Math.round(C - dx * 4), Math.round(C - dy * 4), 2, PAL.gold[2]);
    parts.set(Math.round(C - dx * 4) - 1, Math.round(C - dy * 4) - 1, PAL.gold[3]);
    c.add(parts, { ramp: PAL.gold });
    out.push(trimmed(c.finish(), C, C));
  }
  return out;
}

/** The metronome bullet: a round brass pellet with a bright core that pulses (centre anchor). */
function bulletFrames(): Frame[] {
  return [0, 1].map((k) => {
    const b = new PixelBuffer(9, 9);
    b.circle(4, 4, 3, PAL.gold[1]);
    b.circle(4, 4, 2, PAL.gold[2]);
    b.set(3, 3, k === 0 ? PAL.gold[3] : PAL.snow[3]);
    b.set(4, 3, PAL.gold[3]);
    b.set(3, 4, PAL.gold[3]);
    if (k === 1) b.set(4, 4, PAL.gold[3]);
    return fr(b.outline(INK), 4, 4);
  });
}

// ------------------------------------------------------------------------------------ register

const ANGLES: readonly number[] = Array.from({ length: METRONOME_FRAMES }, (_, i) => -METRONOME.maxAngle + i * METRONOME.angleStep);

export function defineMetronomeSprites(): void {
  for (const up of [false, true]) {
    const s = up ? '-floor' : '';
    defineSprite(`${ART}/body${s}`, () => [bodyFrame(up)], { ticksPerFrame: 30 });
    defineSprite(`${ART}/dent${s}`, () => [dentOverlay(bodyFrame(up), 3, 23)], { ticksPerFrame: 30 });
    defineSprite(`${ART}/pendulum${s}`, () => ANGLES.map((d) => pendulumFrame(d, up)), { ticksPerFrame: 4 });
    defineSprite(`${ART}/weight${s}`, () => ANGLES.map((d) => weightFrame(d, up)), { ticksPerFrame: 4 });
    defineSprite(`${ART}/wreck${s}`, () => [wreckFrame(up)], { ticksPerFrame: 30 });
  }
  defineSprite(`${ART}/snap`, snapFrames, { ticksPerFrame: 3 });
  defineSprite(`${ART}/bullet`, bulletFrames, { ticksPerFrame: 4 });
}
