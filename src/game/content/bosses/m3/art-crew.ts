/**
 * THE WINDBAG — Wing Commander Puffington and his paper (GDD §10.3). Drawn FACING RIGHT (the
 * boss draws him flipped, looking at the players): a big handlebar moustache, flying goggles on a
 * leather cap, a brown flying jacket with a white scarf, a stack of speech notes.
 *
 * - `boss/windbag/puffington`  upper body in the gondola (hip anchor): 0–1 talking, 2 pointing,
 *                              3 notes dropped (aghast), 4 bailing out (arms up)
 * - `boss/windbag/puff-chute`  hanging under a tartan parachute (feet anchor), 2 sway frames
 * - `boss/windbag/puff-drift`  head-first in a snow drift, legs kicking (anchor = the drift's
 *                              base), 2 frames
 * - `boss/windbag/page`        one speech page fluttering (centre), 4 frames
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { withPieces } from '../../../art/human-fx';
import { renderHuman, type HumanStyle, type Pose } from '../../../art/humanoid';

export const PUFFINGTON_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'cloth',
  hairStyle: 'short',
  headgear: 'goggles',
  gear: 'brown',
  accent: 'cloth',
  top: 'brown',
  topType: 'coat',
  shirt: 'cloth',
  pants: 'sand',
  boots: 'black',
  gloves: 'brown',
  belt: 'black',
  build: 'heavy',
  accessories: ['scarf'],
  face: ['walrus', 'bushy-brows'],
};

/** The stack of speech notes (index cards with lines on them). */
function notes(): PixelBuffer {
  const b = new PixelBuffer(11, 9);
  b.rect(1, 2, 9, 6, PAL.cloth[2]);
  b.rect(0, 1, 9, 6, PAL.cloth[3]);
  b.hline(1, 7, 2, PAL.steel[2]);
  b.hline(1, 6, 4, PAL.steel[2]);
  b.hline(1, 7, 6, PAL.steel[2]);
  b.hline(1, 9, 7, PAL.stone[2]);
  return b.outline(INK);
}

/** Handlebar tips: curl the moustache ends up on both sides of the head (head point = centre). */
function handlebar(f: Frame): Frame {
  const [hx, hy] = f.pts?.head ?? [0, 0];
  const b = f.buf.clone();
  const x = f.ox + hx;
  const y = f.oy + hy + 3;
  const c = PAL.cloth[2];
  const d = PAL.cloth[1];
  // Front tip (to the right) and the back tip, both curling up.
  for (const [dx, dy, col] of [
    [6, 0, c],
    [7, -1, c],
    [7, -2, d],
    [-3, 1, c],
    [-4, 0, c],
    [-4, -1, d],
  ] as Array<[number, number, number]>) {
    if (b.inBounds(x + dx, y + dy)) b.set(x + dx, y + dy, col);
  }
  return { ...f, buf: b };
}

function upper(pose: Pose): Frame {
  return handlebar(renderHuman(PUFFINGTON_STYLE, { weapon: 'none', ...pose }, 'upper'));
}

defineSprite(
  'boss/windbag/puffington',
  () => {
    const card = notes();
    const out: Frame[] = [];
    // 0–1: reading from the notes held in front, the far hand waving.
    for (const i of [0, 1]) {
      const f = upper({ expr: i === 0 ? 'normal' : 'shout', hunch: i, armN: { to: [9, -4], hand: 'grip' }, armF: { sh: i === 0 ? 40 : 110, el: 50, hand: 'open' } });
      const [hx, hy] = f.pts?.hand ?? [0, 0];
      out.push(withPieces(f, [{ buf: card, x: hx - 2, y: hy - 7 }]));
    }
    // 2: pointing at the players, the notes in the far hand.
    {
      const f = upper({ expr: 'shout', lean: 4, armN: { to: [13, -8], hand: 'point' }, armF: { to: [5, -2], hand: 'grip' } });
      out.push(f);
    }
    // 3: the notes are gone: aghast, hands open.
    out.push(upper({ expr: 'panic', armN: { to: [8, -14], hand: 'open' }, armF: { to: [-2, -15], hand: 'open' } }));
    // 4: bailing out: both arms up.
    out.push(upper({ expr: 'panic', armN: { to: [4, -20], hand: 'open' }, armF: { to: [-4, -20], hand: 'open' } }));
    return out;
  },
  { durations: [14, 14, 10, 10, 10] },
);

/** A tartan dome canopy with its lines (anchor = the bottom centre, where the lines meet). */
function canopy(sway: number): PixelBuffer {
  const b = new PixelBuffer(38, 26);
  const cx = 19 + sway;
  b.ellipse(cx - 17, 1, 34, 18, PAL.red[2]);
  b.rect(cx - 17, 10, 35, 10, 0);
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 38; x++) {
      if (b.get(x, y) !== PAL.red[2]) continue;
      const band = Math.floor((x - cx + 40) / 6) % 2 === 0;
      const lit = y < 4;
      b.set(x, y, band ? (lit ? PAL.gold[3] : PAL.gold[2]) : lit ? PAL.red[3] : y > 8 ? PAL.red[1] : PAL.red[2]);
    }
  }
  // Scalloped hem.
  for (let x = cx - 16; x <= cx + 16; x += 4) b.set(x, 10, 0);
  // Lines to the harness.
  for (const lx of [-16, -8, 8, 16]) b.line(cx + lx, 10, 19, 25, PAL.cloth[1]);
  return b.outline(INK, { only: undefined });
}

defineSprite(
  'boss/windbag/puff-chute',
  () =>
    [-1, 1].map((sway) => {
      const f = handlebar(
        renderHuman(PUFFINGTON_STYLE, { weapon: 'none', expr: 'shout', armN: { to: [3, -18], hand: 'grip' }, armF: { to: [-2, -18], hand: 'grip' }, legN: { hip: 10, knee: 20 }, legF: { hip: -12, knee: 8 }, grounded: false }, 'full'),
      );
      const [hx, hy] = f.pts?.hand ?? [0, -24];
      const c = canopy(sway);
      return withPieces(f, [{ buf: c, x: hx - 19, y: hy - 25 }]);
    }),
  { ticksPerFrame: 20 },
);

/** Head-first in the drift: a snow mound, the legs kicking out of its top. */
defineSprite(
  'boss/windbag/puff-drift',
  () =>
    [0, 1].map((f) => {
      const b = new PixelBuffer(40, 34);
      const base = 33;
      // Legs (sand trousers, black boots), upside down, kicking apart / together.
      const spread = f === 0 ? 5 : 2;
      for (const [s, ramp] of [
        [-1, PAL.sand],
        [1, PAL.sand],
      ] as const) {
        const x0 = 20 + s * 2;
        const x1 = 20 + s * (2 + spread);
        b.thickLine(x0, base - 12, x1, base - 24, 5, s < 0 ? ramp[1] : ramp[2]);
        b.thickLine(x1, base - 24, x1 + s, base - 28, 6, PAL.black[1]);
        b.hline(x1 - 2 + s, x1 + 2 + s, base - 30, PAL.black[3]);
      }
      // The flying jacket's hem at the snow line.
      b.rect(14, base - 14, 13, 4, PAL.brown[2]);
      b.hline(14, 26, base - 14, PAL.brown[3]);
      // The snow drift.
      b.ellipse(2, base - 13, 36, 22, PAL.snow[2]);
      b.rect(0, base - 2, 40, 2, 0);
      for (let y = base - 13; y < base - 1; y++) {
        for (let x = 0; x < 40; x++) {
          if (b.get(x, y) !== PAL.snow[2]) continue;
          if (y < base - 10 && x < 22) b.set(x, y, PAL.snow[3]);
          else if (x > 30 || y > base - 4) b.set(x, y, PAL.snow[1]);
        }
      }
      // Clumps thrown up by the kicking.
      b.rect(10 + f * 2, base - 16, 2, 2, PAL.snow[3]);
      b.rect(28 - f * 2, base - 17, 2, 2, PAL.snow[3]);
      b.outline(INK);
      return { buf: b, ox: 20, oy: base };
    }),
  { ticksPerFrame: 7 },
);

/** One speech page tumbling in the wind (4 frames: face, tilt, edge, tilt back). */
defineSprite(
  'boss/windbag/page',
  () =>
    [8, 5, 2, 5].map((w, f) => {
      const b = new PixelBuffer(11, 12);
      const x0 = Math.floor((11 - w) / 2);
      b.rect(x0, 1, w, 10, f === 2 ? PAL.cloth[1] : f === 3 ? PAL.cloth[2] : PAL.cloth[3]);
      if (w > 3) for (const y of [3, 5, 7]) b.hline(x0 + 1, x0 + w - 2, y, PAL.steel[2]);
      b.outline(INK);
      return { buf: b, ox: 5, oy: 6 };
    }),
  { ticksPerFrame: 4 },
);
