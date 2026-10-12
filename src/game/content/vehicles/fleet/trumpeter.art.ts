/**
 * TRUMPETER art (GDD §8.5, docs/design/swan-mount/look.md §14): SWAN-3 in flight, built from the
 * Swan's own part generators (`renderBody` of ../swan/body.art.ts) so the hull, rings, head, lens
 * eye, beak, wing plates and rivets are the very same machine: wings open in the walker's UP /
 * MID / DOWN / SPREAD poses, legs retracted and trailing, the neck stretched straight forward
 * with the split bill (one bore in each half), and the two flush vents under the wing roots
 * opened into small jet nozzles. P2 flies the Mute (black neck, head and beak; grey wing tips).
 *
 * Registers, for `<v>` = `vehicle/trumpeter` and `vehicle/trumpeter-mute` (anchor = the bottom
 * centre of the 28 × 14 hull box, so the hull centre is (0, −7); walker body space moves by
 * `WALKER_TO_FLIGHT`):
 * - `<v>/idle` (4: the wing beat UP, MID, DOWN, SPREAD; `move` is the same strip) and
 *   `<v>/front` (4: the overlay that hides the rider's hips), `<v>/jet` (3: exhaust flames),
 *   `<v>/special` + `<v>/special-front` (2: the HONK wind-up and release), `<v>/dive` (2: the
 *   empty ship as a missile, hissing), `<v>/empty-gag` (3: hovering, looking back for her rider),
 *   `<v>/wreck` (2, sooty), `<v>/feather` (4: tin feathers).
 * - `vehicle/trumpeter/parachute` (2: the swan-shaped canopy; anchor = its lower rim centre).
 * - shots: `weapon/twin-bullet` (1, flipped when flying left) and `weapon/dive-bomb` (16 dirs).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { scorch } from '../../../art/human-fx';
import type { BodyOut, BodyPose, Foot, Wing, WingPose } from '../swan/body.art';
import { renderBody } from '../swan/body.art';
import { tinFeatherFrames } from '../swan/extras.art';
import type { NeckSpec, SwanColour } from '../swan/head.art';
import { center, directionStrip, shiftFrame, WHITE } from './kit.art';
import { ART, TRUMPETER, WALKER_TO_FLIGHT } from './numbers';

const [SX, SY] = WALKER_TO_FLIGHT;

// Walker-space pose parts (look.md §14).
const TRAIL_N: Foot = { x: -21, y: -24, s: 'F' };
const TRAIL_F: Foot = { x: -23, y: -25, s: 'F' };
const w = (p: WingPose, tips = 0): Wing => ({ p, tips });
/** Neck stretched straight forward: head at (32, −45), the split bill slightly open. */
const NECK_FLY: NeckSpec = { p1: [6, -3], p2: [11, 0], p3: [16, 0], angle: 0, gap: 2 };

const FLIGHT = { dy: 0, tilt: 0, near: TRAIL_N, far: TRAIL_F, legs: 'W', tail: -1 } as const;

function pose(wings: WingPose, extra: Partial<BodyPose> = {}): BodyPose {
  return { ...FLIGHT, wingN: w(wings), wingF: w(wings), rider: true, neck: NECK_FLY, ...extra };
}

/** Rows of the strips (rider: true ones also give the front overlay). */
const STRIPS = {
  idle: (['UP', 'MID', 'DOWN', 'SPREAD'] as const).map((p) => pose(p)),
  special: [
    pose('BUSK', { breast: 2, tail: 2, neck: { ...NECK_FLY, gap: 0, eye: 'angry' } }),
    pose('BLAST', { breast: 2, tail: 3, neck: { p1: [6, -4], p2: [11, -2], p3: [16, -2], angle: -10, gap: 4, eye: 'angry' } }),
  ],
  dive: [0, 1].map((i) =>
    pose(i === 0 ? 'HALF' : 'LIFT', { rider: false, tilt: 6, tail: 2, neck: { p1: [7, 1], p2: [14, 3], p3: [20, 4], angle: 6, gap: 2 + i, eye: 'angry' } }),
  ),
  'empty-gag': (['back-low', 'back-high', 'blink'] as const).map((eye, i) =>
    pose(i === 1 ? 'MID' : 'SPREAD', { rider: false, neck: { p1: [3, -8], p2: [-2, -14], p3: [1, -17], angle: 165, eye } }),
  ),
  wreck: [20, 26].map((tilt) => pose('LIMP', { rider: false, tilt, tail: -2, neck: { p1: [6, 2], p2: [10, 8], p3: [12, 12], angle: 60, eye: 'dizzy' } })),
} as const;

type StripName = keyof typeof STRIPS;

/** The two jet nozzles: tubes from the flush vents on the flank (§5.1) down under the keel. */
function nozzles(f: Frame): Frame {
  const b = f.buf;
  for (const [jx, jy] of TRUMPETER.jets) {
    // From the vent (4 px forward, 9 px up) down and back to the open end at (jx, jy).
    for (let i = 0; i <= 9; i++) {
      const x = Math.round(jx + 4 - (i * 4) / 9);
      const y = jy - 9 + i;
      const set = (dx: number, c: number): void => {
        if (b.inBounds(f.ox + x + dx, f.oy + y)) b.set(f.ox + x + dx, f.oy + y, c);
      };
      set(-1, i < 2 ? PAL.navy[1] : PAL.steel[3]);
      set(0, i < 2 ? PAL.navy[0] : PAL.steel[2]);
      set(1, PAL.steel[1]);
    }
    b.set(f.ox + jx - 1, f.oy + jy + 1, PAL.fire[2]);
    b.set(f.ox + jx, f.oy + jy + 1, INK);
  }
  // Re-close the silhouette around the new pixels.
  b.outline(INK);
  return f;
}

const cache = new Map<string, BodyOut[]>();

/** Rendered rows of a strip in flight space (one render serves body and front). */
function rows(colour: SwanColour, name: StripName): BodyOut[] {
  const key = `${colour}/${name}`;
  let out = cache.get(key);
  if (!out) {
    out = STRIPS[name].map((p) => {
      const o = renderBody({ colour, socks: false }, p);
      return { body: shiftFrame(o.body, SX, SY), front: o.front ? shiftFrame(o.front, SX, SY) : null };
    });
    cache.set(key, out);
  }
  return out;
}

function bodies(colour: SwanColour, name: StripName, jets: boolean): Frame[] {
  return rows(colour, name).map((o) => (jets ? nozzles({ ...o.body, buf: o.body.buf.clone() }) : o.body));
}

function fronts(colour: SwanColour, name: StripName): Frame[] {
  return rows(colour, name).map((o) => o.front ?? o.body);
}

/** Exhaust: two short flames from the nozzles, streaming back. */
function jetFrame(k: number): Frame {
  const W = 40;
  const H = 20;
  const ox = 26;
  const oy = 8;
  const b = new PixelBuffer(W, H);
  const fire = PAL.fire;
  for (const [jx, jy] of TRUMPETER.jets) {
    const len = 6 + ((k + jx) % 3) * 2;
    for (let i = 0; i < len; i++) {
      const x = ox + jx - 1 - i;
      const y = oy + jy + 2 + (i >> 2);
      const hot = i < 2 ? 6 : i < len / 2 ? 4 : 2;
      b.set(x, y, fire[hot]);
      if (i < len - 2) b.set(x, y - 1, fire[Math.max(1, hot - 2)]);
    }
  }
  return { buf: b, ox, oy };
}

/** The swan-shaped parachute: an ivory dome with a swan neck at the front, navy wing-tip panels. */
function chuteFrame(k: number): Frame {
  const W = 40;
  const H = 30;
  const ox = 18;
  const oy = 22;
  const b = new PixelBuffer(W, H);
  // Dome: the upper half of an ellipse 30 × 26, its lower rim scalloped (billows with k).
  for (let y = -13; y <= 0; y++) {
    for (let x = -15; x <= 15; x++) {
      if ((x / 15) ** 2 + (y / 13) ** 2 > 1) continue;
      if (y === 0 && (x + 15 + k) % 6 >= 4) continue;
      const tip = Math.abs(x) >= 11;
      const lit = x + y < -12;
      const dark = x - y > 14 || y === 0;
      const ramp: readonly number[] = tip ? PAL.navy : PAL.snow;
      const i = tip ? (lit ? 2 : dark ? 0 : 1) : lit ? 3 : dark ? 1 : 2;
      b.set(ox + x, oy + y, ramp[Math.min(i, ramp.length - 1)]);
    }
  }
  // Seams.
  for (const sx of [-6, 0, 6]) for (let y = -11; y <= -1; y++) if ((sx / 15) ** 2 + (y / 13) ** 2 < 0.9) b.set(ox + sx, oy + y, PAL.snow[1]);
  // The swan: a neck rising from the front of the dome, a head with an orange bill.
  for (let i = 0; i < 6; i++) {
    b.set(ox + 12 + (i >> 1), oy - 10 - i, PAL.snow[2]);
    b.set(ox + 13 + (i >> 1), oy - 10 - i, PAL.snow[2]);
  }
  b.rect(ox + 14, oy - 18, 4, 3, PAL.snow[3]);
  b.set(ox + 18, oy - 17, PAL.orange[1]);
  b.set(ox + 19, oy - 17, PAL.orange[1]);
  b.set(ox + 16, oy - 17, INK);
  // A little tail at the back.
  b.set(ox - 15, oy - 7, PAL.snow[2]);
  b.set(ox - 16, oy - 8, PAL.snow[2]);
  return { buf: b.outline(INK), ox, oy };
}

// ------------------------------------------------------------------------------------ shots

/** Twin beak gun bullet: a short hot tracer pointing right. */
function twinBullet(): Frame {
  const b = new PixelBuffer(10, 5);
  b.rect(1, 1, 7, 3, PAL.gold[2]);
  b.rect(5, 2, 3, 1, WHITE);
  b.rect(1, 2, 2, 1, PAL.orange[1]);
  b.set(8, 2, WHITE);
  return center(b.outline(INK));
}

/** Dive bomb along direction `a`: an ivory body with a gold band, navy fins at the back. */
function bombAt(a: number): PixelBuffer {
  const b = new PixelBuffer(15, 15);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  // Sample every pixel in the bomb's own frame (d along the flight, o across): no gaps.
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const dx = x - 7;
      const dy = y - 7;
      const d = dx * ux + dy * uy;
      const o = -dx * uy + dy * ux;
      const ao = Math.abs(o);
      let c = 0;
      if (d >= -5 && d < -3.5 && ao <= 3.2) c = PAL.navy[2];
      else if (d >= -3.5 && d < -1.5 && ao <= 0.8) c = PAL.navy[1];
      else if (d >= -1.5 && d <= 4.5 && ao <= 2.3 - Math.max(0, d - 2.5)) {
        c = Math.abs(d) < 0.6 ? PAL.gold[2] : o < -1 ? WHITE : o > 1.2 ? PAL.snow[0] : PAL.snow[2];
      }
      if (c) b.set(x, y, c);
    }
  }
  return b;
}

// ------------------------------------------------------------------------------------ register

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const VARIANTS: ReadonlyArray<readonly [string, SwanColour]> = [
  [ART.trumpeter, 'ivory'],
  [ART.trumpeterMute, 'mute'],
];

for (const [pre, colour] of VARIANTS) {
  defineSprite(`${pre}/idle`, () => bodies(colour, 'idle', true), { ticksPerFrame: 5 });
  defineSprite(`${pre}/move`, () => bodies(colour, 'idle', true), { ticksPerFrame: 5 });
  defineSprite(`${pre}/front`, () => fronts(colour, 'idle'), { ticksPerFrame: 5 });
  defineSprite(`${pre}/jet`, () => range(3).map(jetFrame), { ticksPerFrame: 1 });
  defineSprite(`${pre}/special`, () => bodies(colour, 'special', false), { ticksPerFrame: 10 });
  defineSprite(`${pre}/special-front`, () => fronts(colour, 'special'), { ticksPerFrame: 10 });
  defineSprite(`${pre}/dive`, () => bodies(colour, 'dive', true), { ticksPerFrame: 4 });
  defineSprite(`${pre}/empty-gag`, () => bodies(colour, 'empty-gag', true), { ticksPerFrame: 24 });
  defineSprite(`${pre}/wreck`, () => bodies(colour, 'wreck', false).map((f) => scorch(f, 2)), { ticksPerFrame: 4 });
  defineSprite(`${pre}/feather`, () => tinFeatherFrames(), { ticksPerFrame: 4 });
}
defineSprite(`${ART.trumpeter}/parachute`, () => [chuteFrame(0), chuteFrame(3)], { ticksPerFrame: 16 });
defineSprite(ART.twinBullet, () => [twinBullet()]);
defineSprite(ART.diveBomb, () => directionStrip(bombAt));
