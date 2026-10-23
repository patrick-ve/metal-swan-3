/**
 * The rally cars' CLUT layout (docs/design/rally.md §7.4): every car page is a 4-bit texture, so one
 * CLUT row holds the 16 colours of the whole car, all taken from the PAL_HD ramps. The SLOTS are the
 * same for every car (the painters write slots, a livery fills them), so a palette swap (the traffic
 * colours, CarSpec.clutRow) is one more row with other paint tones and the same everything else.
 */
import type { Color } from '../../../../engine/color';
import { CLUT_4BIT, ramp } from './kit';

/** The 16 palette slots of a car page. */
export const S = {
  /** The paint: shade (lower panels, seams), base, highlight (the shoulder, the roof edge). */
  PAINT_D: 0,
  PAINT: 1,
  PAINT_L: 2,
  /** Livery accents (the band, the lettering, the camouflage, the flowers …: per livery). */
  ACC_A: 3,
  ACC_B: 4,
  ACC_C: 5,
  /** Black: tyres, trim, the push bar, the window surrounds. */
  BLACK: 6,
  /** Dark grey plastic: bumpers, the rubbing strip, the grille. */
  PLASTIC: 7,
  /** Glass: the interior's dark, the glass, the highlight streak. */
  GLASS_D: 8,
  GLASS: 9,
  GLASS_L: 10,
  /** Silver / chrome: wheel covers, rims, the rack, the frames. */
  SILVER: 11,
  /** The headlamp lens (near white). */
  LENS: 12,
  /** The tail and brake lamps. */
  RED: 13,
  /** The indicators. */
  AMBER: 14,
  /** The yellow Dutch plate. */
  PLATE: 15,
} as const;
export type Slot = (typeof S)[keyof typeof S];

/** The colours every car shares (black … plate); a livery gives the paint and the three accents. */
function shared(): Color[] {
  return [
    ramp('ink', 1, 1)[0], // BLACK
    ramp('steel', 2, 2)[0], // PLASTIC
    ramp('glass', 1, 1)[0], // GLASS_D
    ramp('glass', 3, 3)[0], // GLASS
    ramp('glass', 5, 5)[0], // GLASS_L
    ramp('steel', 5, 5)[0], // SILVER
    ramp('steel', 7, 7)[0], // LENS
    ramp('red', 5, 5)[0], // RED
    ramp('orange', 4, 4)[0], // AMBER
    ramp('gold', 5, 5)[0], // PLATE
  ];
}

/** A car's CLUT row: three paint tones (dark → light) and three accents, then the shared colours. */
export function carRow(paint: readonly [Color, Color, Color], acc: readonly [Color, Color, Color]): Color[] {
  const row = [...paint, ...acc, ...shared()];
  if (row.length !== CLUT_4BIT) throw new Error(`carRow: ${row.length} colours`);
  return row;
}

/** One tone of a PAL_HD ramp. */
export function tone(name: Parameters<typeof ramp>[0], i: number): Color {
  const r = ramp(name, i, i);
  if (r.length !== 1) throw new Error(`tone: ${name}[${i}]`);
  return r[0];
}
