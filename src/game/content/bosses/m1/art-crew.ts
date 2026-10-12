/**
 * THE ENCORE — crew art (GDD §10.1): Commodore Blare (white captain's cap, megaphone, grey
 * mutton chops, navy tunic with gold epaulettes) and the barrel deckhand. All face right.
 *
 * - `boss/encore/blare-bridge` (hip anchor; the hull hides him below the window sill):
 *   0–1 idle, 2 megaphone shout, 3 salute, 4 sinking salute (eyes shut)
 * - `boss/encore/blare-rail`  (feet anchor; point `muzzle` = the trombone bell): 0 idle,
 *   1 slide pulled back (telegraph), 2 blow (slide out)
 * - `boss/encore/blare-ring`  (anchor = the waterline under the rubber ring): 0–1 paddling,
 *   2 shaking a fist
 * - `boss/encore/deckhand`    (feet anchor; point `hand` = the barrel centre): 0 barrel
 *   overhead, 1 heave forward (barrel gone)
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { withPieces } from '../../../art/human-fx';
import { renderHuman, type HumanStyle, type Pose } from '../../../art/humanoid';

export const BLARE_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'cloth',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'cloth',
  accent: 'gold',
  top: 'navy',
  topType: 'tunic',
  pants: 'navy',
  boots: 'black',
  gloves: 'cloth',
  belt: 'gold',
  build: 'heavy',
  accessories: ['epaulettes'],
  face: ['moustache', 'beard'],
};

const DECKHAND_STYLE: HumanStyle = {
  skin: 'skinB',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'navy',
  accent: 'red',
  top: 'cloth',
  topType: 'shirt',
  pants: 'navy',
  boots: 'black',
  gloves: null,
  build: 'heavy',
  accessories: ['scarf'],
};

/** Megaphone: a red cone with a gold rim, narrow end at (0, 4), pointing right. */
function megaphone(): PixelBuffer {
  const b = new PixelBuffer(16, 13);
  for (let x = 1; x <= 13; x++) {
    const half = 1 + Math.round((x - 1) * 0.36);
    for (let y = 6 - half; y <= 6 + half; y++) b.set(x, y, y < 6 - half / 2 ? PAL.red[3] : y > 6 + half / 2 ? PAL.red[1] : PAL.red[2]);
  }
  b.vline(13, 1, 11, PAL.gold[3]);
  b.vline(14, 2, 10, PAL.gold[1]);
  return b.outline(INK);
}

/** Trombone, mouthpiece at (2, 3): the bell tube on top, the slide below (`slide` px long). */
function trombone(slide: number): { buf: PixelBuffer; bell: [number, number] } {
  const w = Math.max(30, slide + 8);
  const b = new PixelBuffer(w, 16);
  const g = PAL.gold;
  // Bell tube and the flared bell.
  b.hline(2, 18, 3, g[3]);
  b.hline(2, 18, 4, g[1]);
  for (let x = 18; x <= 24; x++) {
    const half = 1 + Math.round((x - 18) * 0.7);
    b.vline(x, 4 - half, 4 + half, x === 24 ? g[3] : g[2]);
    b.set(x, 4 + half, g[0]);
  }
  b.vline(25, 0, 8, g[1]);
  // Slide: two tubes and the U-bend.
  b.hline(3, 3 + slide, 9, g[3]);
  b.hline(3, 3 + slide, 12, g[1]);
  b.vline(4 + slide, 9, 12, g[2]);
  b.vline(5 + slide, 10, 11, g[1]);
  b.hline(4, 6, 10, PAL.steel[2]);
  b.vline(2, 3, 12, g[1]);
  return { buf: b.outline(INK), bell: [26, 4] };
}

function blareUpper(pose: Pose): ReturnType<typeof renderHuman> {
  return renderHuman(BLARE_STYLE, { weapon: 'none', ...pose }, 'upper');
}

/** Bridge frames: head and shoulders over the sill (hip anchor). */
defineSprite(
  'boss/encore/blare-bridge',
  () => {
    const mega = megaphone();
    const out: Frame[] = [];
    for (const i of [0, 1]) {
      const f = blareUpper({ hunch: i, armN: { to: [7, 6], hand: 'grip' }, armF: { sh: -10, el: 20 } });
      const [hx, hy] = f.pts.hand;
      out.push(withPieces(f, [{ buf: mega, x: hx - 1, y: hy - 6 }]));
    }
    {
      const f = blareUpper({ expr: 'shout', armN: { to: [6, -6], hand: 'grip' }, armF: { sh: 30, el: 60 } });
      const [hx, hy] = f.pts.hand;
      out.push(withPieces(f, [{ buf: mega, x: hx - 1, y: hy - 6 }]));
    }
    out.push(blareUpper({ armN: { to: [4, -14], hand: 'open' }, armF: { sh: -10, el: 20 } }));
    out.push(blareUpper({ expr: 'blink', armN: { to: [4, -14], hand: 'open' }, armF: { sh: -10, el: 20 } }));
    return out;
  },
  { durations: [24, 24, 8, 8, 8] },
);

/** Blare on the stern rail with his trombone. */
defineSprite('boss/encore/blare-rail', () => {
  const slides = [16, 8, 26];
  return slides.map((slide, i) => {
    const f = renderHuman(BLARE_STYLE, { weapon: 'none', expr: i === 2 ? 'shout' : 'normal', armN: { to: [10 + (slide - 16) * 0.6, -4], hand: 'grip' }, armF: { to: [7, -9], hand: 'grip' }, lean: i === 1 ? -6 : i === 2 ? 6 : 0 }, 'full');
    const head = f.pts.head;
    const t = trombone(slide);
    const px = head[0] + 3;
    const py = head[1] + 2;
    return withPieces(f, [{ buf: t.buf, x: px - 2, y: py - 3 }], { muzzle: [px - 2 + t.bell[0] + 2, py - 3 + t.bell[1]] });
  });
});

/** Blare in a red-and-white rubber ring, paddling (anchor = the waterline). */
defineSprite(
  'boss/encore/blare-ring',
  () => {
    const ring = new PixelBuffer(40, 12);
    ring.ellipse(1, 1, 38, 10, PAL.red[2]);
    for (let x = 1; x < 39; x++) {
      const band = Math.floor((x + 2) / 7) % 2 === 0;
      for (let y = 1; y < 11; y++) {
        if (ring.get(x, y) === 0) continue;
        const top = y < 5;
        ring.set(x, y, band ? (top ? PAL.snow[3] : PAL.snow[1]) : top ? PAL.red[3] : PAL.red[1]);
      }
    }
    ring.ellipse(8, 3, 24, 4, PAL.ink[1]);
    const ringO = ring.outline(INK);
    const poses: Pose[] = [
      { armN: { sh: 60, el: 10, hand: 'open' }, armF: { sh: -30, el: 10 }, expr: 'shout' },
      { armN: { sh: -20, el: 10, hand: 'open' }, armF: { sh: 50, el: 10 }, expr: 'shout' },
      { armN: { to: [6, -16], hand: 'fist' }, armF: { sh: -10, el: 20 }, expr: 'shout' },
    ];
    return poses.map((p) => {
      const f = blareUpper(p);
      // The ring sits around the hips; the anchor is the waterline 6 px under the hip.
      const g = withPieces(f, [{ buf: ringO, x: -20, y: -4 }]);
      return { buf: g.buf, ox: g.ox, oy: g.oy + 6, pts: g.pts };
    });
  },
  { ticksPerFrame: 12 },
);

/** The deckhand heaving a barrel. */
defineSprite('boss/encore/deckhand', () => {
  const barrel = new PixelBuffer(20, 18);
  barrel.ellipse(1, 1, 18, 16, PAL.brown[2]);
  barrel.vline(5, 2, 15, PAL.steel[2]);
  barrel.vline(14, 2, 15, PAL.steel[2]);
  barrel.vline(3, 4, 13, PAL.brown[3]);
  barrel.vline(16, 4, 13, PAL.brown[1]);
  const bo = barrel.outline(INK);
  const lift = renderHuman(DECKHAND_STYLE, { weapon: 'none', expr: 'shout', armN: { to: [2, -16], hand: 'open' }, armF: { to: [-3, -16], hand: 'open' } }, 'full');
  const [hx, hy] = lift.pts.hand;
  const f0 = withPieces(lift, [{ buf: bo, x: hx - 10, y: hy - 16 }], { hand: [hx, hy - 8] });
  const toss = renderHuman(DECKHAND_STYLE, { weapon: 'none', expr: 'happy', lean: 8, armN: { to: [12, -6], hand: 'open' }, armF: { to: [9, -8], hand: 'open' } }, 'full');
  return [f0, toss];
});
