/**
 * The people who ride the transport machines, drawn with the humanoid rig (docs/ART_GUIDE.md §3):
 *
 * - `machine/band-truck/bandsman-horn`, `bandsman-drum` (2 frames each): a Legion bandsman
 *   seated on the truck's stage, playing a cornet or a side drum. Upper body only, anchored at
 *   the HIP (the seat): the truck's rail and bed side are drawn over the lap.
 * - `machine/baton-copter/pilot-chute` (3, feet anchor): the copter pilot bailing out under a
 *   crimson canopy with gold tassels, holding his flying helmet on with one hand (GDD §9.2).
 * - `machine/baton-copter/pilot-run` (8, feet anchor): the same pilot scurrying off, still
 *   holding his helmet.
 * `pilotSeated(pose)` renders the pilot's upper body for the copter's open cockpit
 * (copter.art.ts).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { withPieces, type Piece } from '../../../art/human-fx';
import { renderHuman, type HumanStyle, type Pose } from '../../../art/humanoid';
import * as P from '../../../art/poses';
import { horn, slab } from './kit.art';

/** A Legion bandsman (the shared infantry rig of GDD §9.0, parade outfit). */
export const BANDSMAN_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'shako',
  gear: 'black',
  accent: 'gold',
  top: 'red',
  topType: 'tunic',
  pants: 'cloth',
  boots: 'black',
  gloves: 'cloth',
  belt: 'black',
  build: 'normal',
  accessories: ['cross-belt'],
  face: ['moustache'],
};

/** The baton-copter pilot: flying goggles and a white plume, crimson jacket, white scarf. */
export const PILOT_STYLE: HumanStyle = {
  skin: 'skinB',
  hair: 'hairA',
  hairStyle: 'short',
  headgear: 'goggles',
  gear: 'brown',
  accent: 'snow',
  top: 'red',
  topType: 'jacket',
  pants: 'cloth',
  boots: 'black',
  gloves: 'brown',
  belt: 'black',
  build: 'normal',
  accessories: ['scarf'],
  face: ['moustache'],
};

const TRUCK = 'machine/band-truck';
const COPTER = 'machine/baton-copter';

// ------------------------------------------------------------------------------------ pieces

/** A cornet pointing forward and a little up, mouthpiece at (1, 5). */
function cornet(): PixelBuffer {
  const b = new PixelBuffer(15, 10);
  horn(b, 1, 6, -0.25, 10, 0.6, 3.2);
  // Valves on top.
  b.rect(4, 2, 4, 2, PAL.gold[1]);
  b.set(4, 1, PAL.gold[3]);
  b.set(6, 1, PAL.gold[3]);
  return b.outline(INK);
}

/** A side drum: crimson shell, white heads, gold hoops, a white rope zig-zag. */
function sideDrum(): PixelBuffer {
  const b = new PixelBuffer(14, 11);
  slab(b, 1, 2, 12, 8, 'red');
  b.hline(1, 12, 1, PAL.snow[3]);
  b.hline(1, 12, 2, PAL.gold[3]);
  b.hline(1, 12, 9, PAL.gold[1]);
  for (let x = 1; x <= 12; x++) b.set(x, 3 + ((x >> 1) % 2 === 0 ? x % 2 : 1 - (x % 2)) * 4, PAL.snow[2]);
  return b.outline(INK);
}

/** A drumstick (white tip) at an angle: 0 = flat forward, −1 = up. */
function stick(up: boolean): PixelBuffer {
  const b = new PixelBuffer(9, 7);
  if (up) {
    b.line(1, 5, 6, 1, PAL.brown[3]);
    b.set(7, 1, PAL.snow[3]);
  } else {
    b.line(1, 3, 6, 4, PAL.brown[3]);
    b.set(7, 4, PAL.snow[3]);
  }
  return b.outline(INK);
}

/** A white plume for the pilot's head: a feather curling back, a gold clip at its foot. */
function plume(): PixelBuffer {
  const b = new PixelBuffer(8, 9);
  b.rect(3, 2, 3, 4, PAL.snow[3]);
  b.rect(2, 1, 3, 2, PAL.snow[3]);
  b.set(1, 1, PAL.snow[2]);
  b.hline(4, 5, 5, PAL.snow[1]);
  b.set(5, 4, PAL.snow[1]);
  b.rect(4, 6, 2, 2, PAL.gold[2]);
  return b.outline(INK);
}

const PLUME = (): PixelBuffer => plume();

// ------------------------------------------------------------------------------------ bandsmen

/** The seated bandsman with a cornet at his lips (frame 1: a puff, the horn up a pixel). */
function bandsmanHorn(i: number): Frame {
  const pose: Pose = {
    weapon: 'none',
    armN: { to: [9, -8], hand: 'grip' },
    armF: { to: [10, -7], hand: 'grip' },
    hunch: i,
    expr: i === 1 ? 'shout' : 'normal',
  };
  const f = renderHuman(BANDSMAN_STYLE, pose, 'upper');
  const [hx, hy] = f.pts!.hand;
  const pieces: Piece[] = [{ buf: cornet(), x: hx - 3, y: hy - 7 - i }];
  return withPieces(f, pieces);
}

/** The seated bandsman with a side drum on his lap, sticks alternating. */
function bandsmanDrum(i: number): Frame {
  const pose: Pose = {
    weapon: 'none',
    armN: { to: [8, i === 0 ? 1 : -4], hand: 'grip' },
    armF: { to: [9, i === 0 ? -4 : 1], hand: 'grip' },
    hunch: i,
  };
  const f = renderHuman(BANDSMAN_STYLE, pose, 'upper');
  const [hx, hy] = f.pts!.hand;
  const pieces: Piece[] = [
    { buf: sideDrum(), x: 2, y: -9 },
    { buf: stick(i === 1), x: hx - 1, y: hy - 4 },
  ];
  return withPieces(f, pieces);
}

// ------------------------------------------------------------------------------------ pilot

/** A conductor's baton (white stick, cork grip at the hand end) pointing up-back or down-forward. */
function conductorStick(up: boolean): PixelBuffer {
  const b = new PixelBuffer(10, 10);
  if (up) {
    b.line(3, 1, 6, 7, PAL.snow[3]);
    b.rect(6, 7, 2, 2, PAL.brown[2]);
  } else {
    b.line(2, 2, 8, 6, PAL.snow[3]);
    b.rect(1, 1, 2, 2, PAL.brown[2]);
  }
  return b.outline(INK);
}

/**
 * The pilot's upper body (hip anchor) with his plume; for the copter cockpit. `stick`: the
 * conductor's baton he flies with, raised ('up', the telegraph) or beating down ('down').
 */
export function pilotSeated(pose: Pose, stick?: 'up' | 'down'): Frame {
  const f = renderHuman(PILOT_STYLE, { weapon: 'none', ...pose }, 'upper');
  const [hx, hy] = f.pts!.head;
  const pieces: Piece[] = [{ buf: PLUME(), x: hx - 6, y: hy - 13, behind: true }];
  if (stick) {
    const [ax, ay] = f.pts!.hand;
    pieces.push(stick === 'up' ? { buf: conductorStick(true), x: ax - 7, y: ay - 8 } : { buf: conductorStick(false), x: ax - 2, y: ay - 2 });
  }
  return withPieces(f, pieces);
}

/** The crimson canopy with gold tassels and its shroud lines down to the shoulders. */
function canopy(): PixelBuffer {
  const W = 28;
  const b = new PixelBuffer(W, 22);
  // Dome.
  b.ellipse(1, 1, W - 2, 16, PAL.red[2]);
  b.rect(1, 9, W - 2, 8, 0);
  for (let y = 1; y < 9; y++) {
    for (let x = 1; x < W - 1; x++) {
      if ((b.get(x, y) & 255) === 0) continue;
      const left = (b.get(x - 1, y) & 255) === 0 || (b.get(x, y - 1) & 255) === 0;
      b.set(x, y, left ? PAL.red[3] : x > W * 0.62 ? PAL.red[1] : PAL.red[2]);
    }
  }
  // Gores: gold seams; a scalloped hem with tassels.
  for (const gx of [8, 14, 20]) b.vline(gx, 2, 8, PAL.red[1]);
  b.hline(1, W - 2, 8, PAL.gold[2]);
  for (let x = 2; x < W - 1; x += 3) {
    b.set(x, 9, PAL.gold[2]);
    b.set(x, 10, PAL.gold[1]);
  }
  // Shroud lines converge on the shoulders (centre, 21 px down).
  b.line(2, 9, 12, 20, PAL.stone[3]);
  b.line(W - 3, 9, 15, 20, PAL.stone[3]);
  b.line(10, 9, 13, 20, PAL.stone[2]);
  b.line(18, 9, 14, 20, PAL.stone[2]);
  return b;
}

/** Hanging under the canopy, legs dangling, one hand clamping the helmet on. */
function pilotChute(i: number): Frame {
  const sway = [-1, 0, 1][i];
  const pose: Pose = {
    ...P.FALL,
    grounded: true,
    armF: { to: [1, -14], hand: 'open' },
    armN: { sh: 120 + sway * 10, el: 30, hand: 'open' },
    expr: 'panic',
    rot: sway * 4,
  };
  const f = renderHuman(PILOT_STYLE, pose, 'full');
  const [hx, hy] = f.pts!.head;
  const c = canopy().outline(INK);
  // The canopy's shroud lines meet 21 px under its top; put that point on the shoulders.
  const pieces: Piece[] = [
    { buf: PLUME(), x: hx - 6, y: hy - 13, behind: true },
    { buf: c, x: hx - 14 + sway, y: hy - 27, behind: true },
  ];
  return withPieces(f, pieces);
}

/** Scurrying off: the run cycle, the near hand on the helmet. */
function pilotRun(): Frame[] {
  return P.RUN.map((p, i) => {
    const pose: Pose = { ...p, armF: { to: [1, -14], hand: 'open' }, armN: { sh: i % 4 < 2 ? 50 : -40, el: 60, hand: 'fist' }, lean: 10, expr: 'panic' };
    const f = renderHuman(PILOT_STYLE, pose, 'full');
    const [hx, hy] = f.pts!.head;
    return withPieces(f, [{ buf: PLUME(), x: hx - 6, y: hy - 13, behind: true }]);
  });
}

export function defineCrewArt(): void {
  defineSprite(`${TRUCK}/bandsman-horn`, () => [0, 1].map(bandsmanHorn), { ticksPerFrame: 12 });
  defineSprite(`${TRUCK}/bandsman-drum`, () => [0, 1].map(bandsmanDrum), { ticksPerFrame: 12 });
  defineSprite(`${COPTER}/pilot-chute`, () => [0, 1, 2].map(pilotChute), { ticksPerFrame: 20 });
  defineSprite(`${COPTER}/pilot-run`, pilotRun, { ticksPerFrame: 4 });
}
