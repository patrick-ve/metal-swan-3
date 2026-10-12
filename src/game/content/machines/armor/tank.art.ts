/**
 * `oompah-tank` art (`machine/oompah-tank/…`) and the `tank-crewman` (`enemy/tank-crewman/…`).
 *
 * The tank is an original parade-tank design: a boxy crimson hull with a gold band, gold-white-
 * black bunting along its side and a headlamp; a short crimson turret with tuba valves and a
 * coiled tube; its cannon is a giant brass tuba bell (a 20 px mouth) pointing forward. All tank
 * strips share one anchor (the feet centre), so the body and the turret strips stack.
 *
 * Strips: `body` (3f tread phases), `body-dented` (3f, ≤ 50 % HP), `turret`, `turret-front` (mid-
 * turn: the bell faces the camera), `tell` (2f: the bell glows), `fire` (2f: recoil, flash),
 * `flip` (5f: the bell flips up, then droops through the sad notes), `wreck` (56×20), `shell`
 * (4f, centre: a spinning brass handbell), `pulse` (3f, centre: the bass wave).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { blastFrames, burnFrames, poseFrames } from '../../../art/human-sprites';
import type { HumanStyle, Pose } from '../../../art/humanoid';
import { damage, rivet, tread } from '../../../art/machines';
import { Composer, shadeLayer } from '../../../art/paint';
import * as P from '../../../art/poses';
import { TANK } from './geom';
import { bunting, crest, fr, horn, PENNANTS_ON_RED } from './kit.art';

const ART = 'machine/oompah-tank';

/** Buffer layout shared by the tank strips: the feet anchor at (OX, OY). */
const W = 82;
const H = 50;
const OX = 37;
const OY = 50;
const X = (dx: number): number => OX + dx;
const Y = (dy: number): number => OY + dy;

// ------------------------------------------------------------------------------------ body

/** Hull layer: crimson, gold band, rivets, bunting, headlamp, a brass exhaust chimney. */
function hullLayer(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  // Boxy hull with a sloped glacis at the front (facing right).
  b.poly(
    [
      [X(-31), Y(-27)],
      [X(-30), Y(-28)],
      [X(22), Y(-28)],
      [X(31), Y(-21)],
      [X(31), Y(-14)],
      [X(-31), Y(-14)],
    ],
    PAL.red[2],
  );
  shadeLayer(b, PAL.red, { hi: 1, lo: 1 });
  // A darker skirt panel above the treads, with rivets.
  b.rect(X(-30), Y(-18), 60, 3, PAL.red[1]);
  for (let x = -27; x <= 27; x += 6) rivet(b, X(x), Y(-17), PAL.red);
  // Gold band.
  b.hline(X(-30), X(30), Y(-20), PAL.gold[3]);
  b.hline(X(-30), X(30), Y(-19), PAL.gold[1]);
  // Bunting along the upper hull.
  bunting(b, X(-28), X(18), Y(-27), 2, PENNANTS_ON_RED, 6);
  // Headlamp on the glacis: a gold ring with a pale glass.
  b.circle(X(26), Y(-22), 2, PAL.gold[1]);
  b.set(X(26), Y(-22), PAL.snow[3]);
  b.set(X(25), Y(-23), PAL.gold[3]);
  // Exhaust chimney at the rear: a little brass pipe with a flared top.
  b.rect(X(-25), Y(-33), 3, 5, PAL.gold[2]);
  b.vline(X(-25), Y(-33), Y(-29), PAL.gold[3]);
  b.vline(X(-23), Y(-33), Y(-29), PAL.gold[1]);
  b.hline(X(-26), X(-22), Y(-34), PAL.gold[3]);
  b.set(X(-22), Y(-34), PAL.gold[1]);
  return b;
}

/** Track layer (tread phase 0..2). */
function trackLayer(phase: number): PixelBuffer {
  const b = new PixelBuffer(W, H);
  b.blit(tread(64, 12, phase, { ramp: 'black', rim: 'steel', wheels: 5 }), X(-32), Y(-13));
  return b;
}

function bodyFrame(phase: number, dented: boolean): Frame {
  const c = new Composer(W, H);
  c.add(trackLayer(phase), { ramp: PAL.black });
  c.add(hullLayer(), { ramp: PAL.red });
  let buf = c.finish();
  if (dented) buf = damage(buf, 0.55, 11);
  return fr(buf, OX, OY);
}

// ------------------------------------------------------------------------------------ turret

interface TurretOpts {
  /** Bell angle (radians, 0 = forward, negative = up). */
  ang?: number;
  /** Throat x (recoil moves it back). */
  throat?: number;
  /** Inside colours of the bell's mouth (the telegraph glow). */
  inside?: readonly [number, number];
}

/** The turret box: crimson, gold trim, the crest, a hatch at the rear, three tuba valves. */
function turretBox(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  b.roundRect(X(-14), Y(-41), 24, 13, 3, PAL.red[2]);
  b.rect(X(-14), Y(-33), 24, 5, PAL.red[2]);
  shadeLayer(b, PAL.red, { hi: 1, lo: 1 });
  b.hline(X(-13), X(8), Y(-30), PAL.gold[2]);
  b.hline(X(-13), X(8), Y(-29), PAL.gold[1]);
  // The coiled tuba tube on the turret side (a brass loop feeding the bell).
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    const x = Math.round(X(-4) + Math.cos(t) * 6);
    const y = Math.round(Y(-35) + Math.sin(t) * 3);
    b.set(x, y, Math.sin(t) < -0.2 ? PAL.gold[3] : Math.sin(t) > 0.4 ? PAL.gold[1] : PAL.gold[2]);
  }
  crest(b, X(-4), Y(-35));
  // Rear hatch: a low dome with a gold rim.
  b.rect(X(-11), Y(-43), 7, 2, PAL.red[1]);
  b.hline(X(-10), X(-6), Y(-44), PAL.red[2]);
  b.hline(X(-11), X(-5), Y(-42), PAL.gold[2]);
  b.set(X(-9), Y(-44), PAL.red[3]);
  // Three tuba valves (pistons) at the front of the roof.
  for (const vx of [0, 3, 6]) {
    b.rect(X(vx), Y(-44), 2, 3, PAL.gold[2]);
    b.set(X(vx), Y(-44), PAL.gold[3]);
    b.set(X(vx + 1), Y(-42), PAL.gold[1]);
  }
  return b;
}

function bellLayer(o: TurretOpts): PixelBuffer {
  const b = new PixelBuffer(W, H + 28);
  // Drawn 28 px lower in a taller buffer so a flipped-up bell fits; shifted back by the caller.
  const throat = o.throat ?? 8;
  horn(b, X(throat), Y(TANK.muzzle[1]) + 28, o.ang ?? 0, TANK.muzzle[0] - 8, 3, 10, {
    ramp: 'gold',
    inside: (o.inside as [number, number] | undefined) ?? [PAL.gold[0], PAL.brown[0]],
    bands: [0.12, 0.2],
  });
  return b;
}

/** A turret frame. Tall frames (a bell flipped up) grow the buffer upward; the anchor stays. */
function turretFrame(o: TurretOpts = {}): Frame {
  const extra = 28;
  const c = new Composer(W, H + extra);
  const box = new PixelBuffer(W, H + extra).blit(turretBox(), 0, extra);
  c.add(box, { ramp: PAL.red });
  c.add(bellLayer(o), { ramp: PAL.gold });
  return trimmed(c.finish(), OX, OY + extra);
}

/** Crop a frame to its pixels, keeping the anchor on the same pixel. */
export function trimmed(buf: PixelBuffer, ox: number, oy: number): Frame {
  const r = buf.trimBounds();
  if (!r) return fr(buf, ox, oy);
  return fr(buf.crop(r.x, r.y, r.w, r.h), ox - r.x, oy - r.y);
}

/** Front view mid-turn: a narrower turret with the bell's mouth facing the camera. */
function turretFrontFrame(): Frame {
  const c = new Composer(W, H);
  const box = new PixelBuffer(W, H);
  box.roundRect(X(-9), Y(-41), 16, 13, 3, PAL.red[2]);
  box.rect(X(-9), Y(-33), 16, 5, PAL.red[2]);
  shadeLayer(box, PAL.red, { hi: 1, lo: 1 });
  box.hline(X(-8), X(5), Y(-30), PAL.gold[2]);
  box.hline(X(-8), X(5), Y(-29), PAL.gold[1]);
  c.add(box, { ramp: PAL.red });
  const bell = new PixelBuffer(W, H);
  const cx = X(-1);
  const cy = Y(-34);
  bell.circle(cx, cy, 10, PAL.gold[1]);
  bell.circle(cx, cy, 9, PAL.gold[2]);
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    if (Math.cos(t) * -0.6 + Math.sin(t) * -0.8 > 0.3) bell.set(Math.round(cx + Math.cos(t) * 9), Math.round(cy + Math.sin(t) * 9), PAL.gold[3]);
  }
  bell.circle(cx, cy, 7, PAL.gold[0]);
  bell.circle(cx, cy, 5, PAL.brown[1]);
  bell.circle(cx, cy, 3, PAL.brown[0]);
  bell.circle(cx + 1, cy + 1, 1, INK);
  c.add(bell, { ramp: PAL.gold });
  return fr(c.finish(), OX, OY);
}

// ------------------------------------------------------------------------------------ wreck

/** The wreck: a flattened, scorched hull on a broken track, the tuba bell crumpled on top. */
function wreckFrame(): Frame {
  const c = new Composer(W, H);
  const tr = new PixelBuffer(W, H);
  tr.blit(tread(56, 8, 1, { ramp: 'black', rim: 'stone', wheels: 4 }), X(-28), Y(-9));
  // A broken link hanging loose at the front.
  tr.rect(X(26), Y(-4), 3, 2, PAL.black[1]);
  c.add(tr, { ramp: PAL.black });
  const hull = new PixelBuffer(W, H);
  hull.poly(
    [
      [X(-28), Y(-15)],
      [X(-24), Y(-19)],
      [X(-6), Y(-20)],
      [X(4), Y(-17)],
      [X(16), Y(-19)],
      [X(27), Y(-13)],
      [X(27), Y(-9)],
      [X(-28), Y(-9)],
    ],
    PAL.red[1],
  );
  shadeLayer(hull, PAL.red, { hi: 1, lo: 1, base: 1 });
  // Soot: an ordered dither of dark patches.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((hull.get(x, y) & 255) === 0) continue;
      const n = Math.sin(x * 0.7) + Math.cos(y * 1.3 + x * 0.21);
      if (n > 0.6 && ((x + y) & 1) === 0) hull.set(x, y, PAL.ink[1]);
    }
  }
  hull.hline(X(-26), X(25), Y(-11), PAL.gold[0]);
  // A torn plate sticking up.
  hull.poly([[X(-12), Y(-19)], [X(-9), Y(-24)], [X(-7), Y(-23)], [X(-8), Y(-19)]], PAL.red[2]);
  c.add(hull, { ramp: PAL.red });
  const bell = new PixelBuffer(W, H);
  horn(bell, X(6), Y(-20), 0.55, 16, 2, 6, { ramp: 'rust', inside: [PAL.ink[1], PAL.ink[0]] });
  c.add(bell, { ramp: PAL.rust });
  return fr(c.finish(), OX, OY);
}

// ------------------------------------------------------------------------------------ shots

/** The bell shell: a little brass handbell, spinning (4 quarter turns), centre anchor. */
function shellFrames(): Frame[] {
  const base = new PixelBuffer(10, 10);
  // Knob, dome, flared lip, clapper.
  base.rect(4, 1, 2, 1, PAL.gold[2]);
  base.rect(3, 2, 4, 2, PAL.gold[2]);
  base.rect(2, 4, 6, 2, PAL.gold[2]);
  base.rect(1, 6, 8, 1, PAL.gold[2]);
  shadeLayer(base, PAL.gold, { hi: 1, lo: 1 });
  base.hline(1, 8, 7, PAL.gold[1]);
  base.set(4, 8, PAL.brown[0]);
  base.set(5, 8, PAL.brown[0]);
  base.set(3, 3, PAL.snow[3]);
  const out: Frame[] = [];
  for (let k = 0; k < 4; k++) {
    const r = k === 0 ? base.clone() : base.rotated((k * Math.PI) / 2, { quality: 'fast' });
    const b = new PixelBuffer(12, 12).blit(r, 1, 1).outline(INK);
    out.push(fr(b, 6, 6));
  }
  return out;
}

/** The bass pulse: a low wave of sound rings with dust at its foot (moving right), centre anchor. */
function pulseFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 3; f++) {
    const b = new PixelBuffer(14, 14);
    for (let k = 0; k <= f; k++) {
      const r = 3 + k * 2;
      for (let a = -60; a <= 60; a += 6) {
        const t = (a * Math.PI) / 180;
        const x = Math.round(3 + Math.cos(t) * r);
        const y = Math.round(7 + Math.sin(t) * (r + 1));
        b.set(x, y, k === f ? PAL.snow[3] : PAL.gold[2]);
      }
    }
    // Dust kicked up along the floor.
    for (let x = 1; x < 12; x += 2) b.set(x, 12, PAL.sand[2 + ((x + f) & 1)]);
    b.rect(2 + f, 11, 3, 1, PAL.sand[3]);
    out.push(fr(b.outline(INK), 7, 7));
  }
  return out;
}

// ------------------------------------------------------------------------------------ crewman

/**
 * The tank crewman: a Legion soldier in a short crimson crew jacket, white trousers, black
 * boots, brown leather gloves and a black tanker's headset (a soldier who works next to a tuba).
 */
export const CREWMAN_STYLE: HumanStyle = {
  skin: 'skinB',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'headset',
  gear: 'black',
  accent: 'gold',
  top: 'red',
  topType: 'jacket',
  pants: 'cloth',
  boots: 'black',
  gloves: 'brown',
  belt: 'black',
  build: 'slim',
  accessories: [],
  face: ['moustache'],
};

const L = (hip: number, knee: number, foot = 0): { hip: number; knee: number; foot: number } => ({ hip, knee, foot });

/** Panic scurry (GDD §9.0: on tiptoe, no arm-waving): hands clamped over the headset. */
const SCURRY: readonly Pose[] = [
  { legN: L(34, 20, 30), legF: L(-20, 30, 30), armN: { to: [1, -8], hand: 'open' }, armF: { to: [2, -9], hand: 'open' }, lean: 10, expr: 'panic' },
  { legN: L(12, 40, 34), legF: L(4, 22, 30), armN: { to: [1, -8], hand: 'open' }, armF: { to: [2, -9], hand: 'open' }, lean: 10, bob: 1, expr: 'panic' },
  { legN: L(-20, 30, 30), legF: L(34, 20, 30), armN: { to: [1, -8], hand: 'open' }, armF: { to: [2, -9], hand: 'open' }, lean: 10, expr: 'panic' },
  { legN: L(4, 22, 30), legF: L(12, 40, 34), armN: { to: [1, -8], hand: 'open' }, armF: { to: [2, -9], hand: 'open' }, lean: 10, bob: 1, expr: 'panic' },
];

const HOP: readonly Pose[] = [
  { legN: L(60, 90), legF: L(30, 100), armN: { sh: 160, el: 20, hand: 'open' }, armF: { sh: 140, el: 30, hand: 'open' }, grounded: false, expr: 'panic' },
  { legN: L(30, 40), legF: L(-10, 50), armN: { sh: 130, el: 40, hand: 'open' }, armF: { sh: 150, el: 30, hand: 'open' }, grounded: false, expr: 'panic' },
];

const ATTENTION: Pose = { legN: L(5, 2), legF: L(-3, 2) };

const CREW_SALUTE: readonly Pose[] = [
  { ...ATTENTION, armN: { to: [5, -10], hand: 'open' }, head: { tilt: -6 }, expr: 'normal' },
  { ...ATTENTION, armN: { to: [5, -10], hand: 'open' }, head: { tilt: -6 }, expr: 'blink', hunch: 1 },
];

function defineCrewmanSprites(): void {
  const pre = 'enemy/tank-crewman/';
  const S = CREWMAN_STYLE;
  const none: Pose = { weapon: 'none' };
  const full = (poses: readonly Pose[]) => (): Frame[] => poseFrames(S, P.seq(none, poses), 'full');
  defineSprite(pre + 'idle', full(P.seq(P.STAND, P.BREATH)), { ticksPerFrame: 24 });
  defineSprite(pre + 'hop', full(HOP), { ticksPerFrame: 10, loop: false });
  defineSprite(pre + 'panic', full(SCURRY), { ticksPerFrame: 4 });
  defineSprite(pre + 'run', full(SCURRY), { ticksPerFrame: 4 });
  defineSprite(pre + 'salute', full(CREW_SALUTE), { ticksPerFrame: 20 });
  defineSprite(pre + 'die', full(P.DIE), { durations: [5, 5, 6, 6, 8, 30], loop: false });
  defineSprite(pre + 'die-blast', () => blastFrames(S, none), { durations: [5, 5, 5, 5, 30], loop: false });
  defineSprite(pre + 'die-burn', () => burnFrames(S, none), { durations: [5, 5, 8, 12, 8, 8, 40], loop: false });
  defineSprite(pre + 'die-knife', full(P.DIE_KNIFE), { durations: [8, 6, 6, 6, 30], loop: false });
}

// ------------------------------------------------------------------------------------ register

/** Death turret frames: the bell rises (35°), points up (75°), then droops note by note. */
const FLIP_ANGLES: readonly number[] = [-35, -75, -62, -50, -38];

export function defineTankSprites(): void {
  defineSprite(`${ART}/body`, () => [0, 1, 2].map((p) => bodyFrame(p, false)), { ticksPerFrame: 4 });
  defineSprite(`${ART}/body-dented`, () => [0, 1, 2].map((p) => bodyFrame(p, true)), { ticksPerFrame: 4 });
  defineSprite(`${ART}/turret`, () => [turretFrame()], { ticksPerFrame: 30 });
  defineSprite(`${ART}/turret-front`, () => [turretFrontFrame()], { ticksPerFrame: 30 });
  defineSprite(
    `${ART}/tell`,
    () => [turretFrame({ inside: [PAL.gold[3], PAL.gold[2]] }), turretFrame({ inside: [PAL.snow[3], PAL.gold[3]] })],
    { ticksPerFrame: 4 },
  );
  defineSprite(
    `${ART}/fire`,
    () => [turretFrame({ throat: 5, inside: [PAL.snow[3], PAL.fire[4]] }), turretFrame({ throat: 7 })],
    { ticksPerFrame: 4, loop: false },
  );
  defineSprite(`${ART}/flip`, () => FLIP_ANGLES.map((d) => turretFrame({ ang: (d * Math.PI) / 180 })), { ticksPerFrame: 12, loop: false });
  defineSprite(`${ART}/wreck`, () => [wreckFrame()], { ticksPerFrame: 30 });
  defineSprite(`${ART}/shell`, shellFrames, { ticksPerFrame: 4 });
  defineSprite(`${ART}/pulse`, pulseFrames, { ticksPerFrame: 4 });
  defineCrewmanSprites();
}
