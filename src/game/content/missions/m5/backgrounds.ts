/**
 * Mission m5 background stacks (GDD §11.5): standard generators (docs/ART_GUIDE.md §7) plus the
 * custom ones in bg.ts (`organ-deep`, `organ-pipes`, `console-room`). Far layers first.
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef } from '../../../mission/index';
import './bg';

/**
 * m5-a Above the Clouds: an orange horizon → magenta → indigo top sky, the sea far below, pink
 * far clouds, violet mid clouds and sparse near clouds in front (alpha 0.7). The clouds drift on
 * their own, so they keep moving while the boss lock holds the view.
 */
export const BG_SKY: BackgroundDef = {
  sky: PAL.purple[1],
  layers: [
    {
      gen: 'sky-gradient',
      params: { colors: [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.pink[2], PAL.orange[2], PAL.orange[3]], dither: 0.3, stars: 12 },
      factorX: 0,
    },
    { gen: 'sea', params: { y: 2, ramp: [PAL.navy[0], PAL.navy[1], PAL.purple[1], PAL.pink[2]], sparkle: 0.6, foam: PAL.orange[3] }, factorX: 0.05, offsetY: 180 },
    {
      gen: 'clouds',
      params: { y: 0.62, spread: 40, count: 5, size: 7, ramp: [PAL.purple[1], PAL.pink[1], PAL.pink[2], PAL.orange[3]] },
      factorX: 0.1,
      driftX: -0.1,
    },
    {
      gen: 'clouds',
      params: { y: 0.45, spread: 120, count: 4, size: 10, ramp: [PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1]] },
      width: 640,
      factorX: 0.3,
      driftX: -0.3,
    },
    {
      gen: 'clouds',
      params: { y: 0.85, spread: 30, count: 2, size: 12, ramp: [PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.pink[2]] },
      width: 1024,
      factorX: 1.4,
      alpha: 0.7,
      front: true,
    },
  ],
};

/**
 * m5-b The Pipe Works: dim far pipes (factorY 0.1) and near brass ranks with gears (0.3) on the
 * dark walnut interior. Both layers tile vertically (their generators are seamless in y).
 */
export const BG_PIPE_WORKS: BackgroundDef = {
  sky: PAL.brown[0],
  layers: [
    { gen: 'organ-deep', params: { slot: 16, beam: 128 }, width: 384, height: 256, factorX: 0, factorY: 0.1, repeatY: true },
    // Dimmed over the dark far layer so the metal ledges and the actors stand out (1x readability).
    { gen: 'organ-pipes', params: { rank: 192 }, width: 384, height: 384, factorX: 0, factorY: 0.3, repeatY: true, alpha: 0.55 },
  ],
};

/** m5-c The Console: the cathedral hall of giant pipes with the stained-glass window. */
export const BG_CONSOLE: BackgroundDef = {
  sky: PAL.brown[0],
  layers: [{ gen: 'console-room', width: 384, height: 216, factorX: 0.2, repeatX: true }],
};
