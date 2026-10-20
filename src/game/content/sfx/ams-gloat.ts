/**
 * Synth sounds of mission ams, area 'gloat' (docs/design/ams-extras.md §1, §8): the enemies' own
 * business at the spot while every player is out. Spread into SFX in sfx/index.ts. The gloat also
 * reuses `ams/bell` (the delivery rider's circle), `ams/bass-thump` (the fatbike's speaker) and
 * `ams/ticket` (the handhaver's page fluttering down).
 *
 * - `ams/gloat-scribble` — the handhaver writes the fine: three quick pencil strokes on paper
 *   (band-passed noise scratches with a rising and falling grain), 0.5 s.
 * - `ams/gloat-tear` — he tears the page off the pad: a crackling paper rip that brightens as it
 *   runs (high-passed noise, fast-gated), 0.24 s.
 * - `ams/gloat-peck` — a gull pecks a fry off the cobbles: two dry beak taps, 0.12 s.
 */
import { BP, clack, HP, noise, type Recipes } from './kit';

/** One pencil stroke: a band-passed scratch whose grain sweeps up (down-stroke) or down. */
function stroke(delay: number, len: number, up: boolean, vol: number) {
  return {
    wave: 'noise' as const,
    env: { a: 0.006, d: 0.02, s: 0.85, hold: len, r: 0.025 },
    vol,
    delay,
    filter: BP(up ? 2600 : 4200, up ? 4200 : 2600, 2.2),
    tremolo: { rate: 70, rateTo: 55, depth: 0.55, shape: 'saw' as const, width: 0.5 },
  };
}

export const AMS_GLOAT: Recipes = {
  'ams/gloat-scribble': {
    vol: 0.84,
    voices: 2,
    gap: 0.2,
    layers: [
      stroke(0, 0.09, true, 0.8),
      stroke(0.14, 0.07, false, 0.7),
      stroke(0.26, 0.13, true, 0.85),
      // The pencil tapping the page at the end (a dot under the fine).
      noise(0.012, 0.35, BP(3200, undefined, 2), { delay: 0.44 }),
    ],
  },
  'ams/gloat-tear': {
    vol: 0.42,
    voices: 2,
    gap: 0.15,
    layers: [
      {
        wave: 'noise',
        env: { a: 0.004, d: 0.03, s: 0.9, hold: 0.14, r: 0.05 },
        vol: 0.8,
        filter: HP(1800, 4200),
        tremolo: { rate: 90, rateTo: 140, depth: 0.8, shape: 'saw', width: 0.35 },
      },
      noise(0.05, 0.3, BP(5200, undefined, 1.5), { delay: 0.15 }),
    ],
  },
  'ams/gloat-peck': {
    vol: 0.6,
    voices: 3,
    gap: 0.1,
    layers: [...clack(2400, 0.7, 0, 0.012), ...clack(2100, 0.55, 0.07, 0.012)],
  },
};
