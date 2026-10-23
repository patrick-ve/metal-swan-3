/**
 * The glow page of the night (WORLD, wave B; `PAGE_IDS.lights` 302; docs/design/rally.md §7.5):
 * soft round glows, light pools on the road, bars and the sun, as 16-step gradients (a gradient is
 * where the spec allows more than flat colours). Drawn with the era's ADDITIVE blend: index 0 is
 * black (adds nothing), 15 the full glow. The texture is neutral: the vertex colour tints each glow
 * (sodium orange, LED white, tail red, amber, police blue; emissive: 128 = the CLUT colour, 255 =
 * about twice it).
 *
 * CLUT rows: `GLOW_ROWS[level]` for the lamps' glow levels (lampGlow ¼, ½, ¾, 1), `GLOW_FULL` for
 * the car lights and the sun (always the full ramp). PAL_HD tones only (the nearest grey of the
 * cool grey ramps). Pure; built once.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD, type HdRampName } from '../../../../engine/palette-hd';
import type { TexturePage } from '../../../../engine/view3d';
import { PageBuilder, type TexRect } from '../tex/kit';
import { WORLD_PAGES } from '../sections/pages';

export interface GlowTex {
  readonly page: TexturePage;
  /** A round glow (the full ramp from the edge to the centre). */
  readonly disc: TexRect;
  /** A soft pool (an ellipse filling the rect; stretch it along the road). */
  readonly pool: TexRect;
  /**
   * The headlight beam on the road (integrator, wave C): u across (soft edges, full in the middle
   * third), v along from the nose (v = 0: a quick rise) to the far end (v = 1: faded out).
   */
  readonly beam: TexRect;
  /** A soft horizontal bar. */
  readonly bar: TexRect;
  /** The sun: a bright core in a halo. */
  readonly sun: TexRect;
  /** A small hard dot (far lamps, LEDs). */
  readonly dot: TexRect;
}

/** The lamps' glow levels → CLUT rows; the car lights and the sun use `GLOW_FULL`. */
export const GLOW_ROWS: readonly number[] = [0, 1, 2, 3];
export const GLOW_FULL = 3;

const GREYS: readonly HdRampName[] = ['ink', 'steel', 'snow', 'gable', 'black', 'slate', 'cloth'];

/** The nearest cool grey of PAL_HD to the value v (0..255). */
function greyHd(v: number): Color {
  let best: Color = 0;
  let bd = Infinity;
  for (const k of GREYS) {
    for (const c of PAL_HD[k] as readonly Color[]) {
      const r = (c >>> 24) & 255, g = (c >>> 16) & 255, b = (c >>> 8) & 255;
      const d = Math.abs((r * 0.3 + g * 0.59 + b * 0.11) - v) + Math.abs(r - b) * 0.15;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  return best;
}

let built: GlowTex | null = null;

export function glowTex(): GlowTex {
  if (built) return built;
  const pb = new PageBuilder(WORLD_PAGES.lights, 128, 64);
  const disc = pb.alloc(32, 32)!;
  const pool = pb.alloc(32, 32)!;
  const sun = pb.alloc(32, 32)!;
  const bar = pb.alloc(32, 8)!;
  const dot = pb.alloc(8, 8)!;
  const beam = pb.alloc(32, 32)!;
  /** A radial ramp: 15 at the centre to 0 at radius 1 (power p shapes the falloff). */
  const radial = (r: TexRect, p: number, core = 0): void => {
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const dx = (x + 0.5 - r.w / 2) / (r.w / 2), dy = (y + 0.5 - r.h / 2) / (r.h / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        let t = d >= 1 ? 0 : 1 - d;
        // t^p without Math.pow: p is 1, 1.5, 2 or 3.
        t = p === 1 ? t : p === 2 ? t * t : p === 3 ? t * t * t : t * Math.sqrt(t);
        let i = Math.round(t * 15);
        if (core > 0 && d < core) i = 15;
        pb.set(r, x, y, Math.max(0, Math.min(15, i)));
      }
    }
  };
  radial(disc, 2);
  radial(pool, 1.5);
  radial(sun, 3, 0.3);
  radial(dot, 1);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 32; x++) {
      const dy = Math.abs(y + 0.5 - 4) / 4;
      const dx = Math.max(0, Math.abs(x + 0.5 - 16) - 10) / 6;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      pb.set(bar, x, y, Math.round((1 - d) * (1 - d) * 15));
    }
  }
  for (const level of [0.3, 0.55, 0.8, 1]) {
    const row: Color[] = [];
    for (let i = 0; i < 16; i++) row.push(i === 0 ? 0x000000ff : greyHd(((i / 15) * level) * 255));
    pb.addRow(row);
  }
  // The beam: across, full in the middle and soft to 0 at both edges; along, a rise over the first
  // 6 % (under the bumper), full to 22 %, then a long, even fade to the far end (seen from the chase
  // camera over the roof it reads as a fan of light ahead, not as a lamp on the roof).
  for (let y = 0; y < beam.h; y++) {
    const v = (y + 0.5) / beam.h;
    const along = v < 0.06 ? v / 0.06 : v < 0.22 ? 1 : (1 - v) / 0.78;
    for (let x = 0; x < beam.w; x++) {
      const u = Math.abs(x + 0.5 - beam.w / 2) / (beam.w / 2);
      const e = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
      const across = e * e * (3 - 2 * e);
      pb.set(beam, x, y, Math.max(0, Math.min(15, Math.round(across * along * 15))));
    }
  }
  built = { page: pb.build(), disc, pool, bar, sun, dot, beam };
  return built;
}

/** The glow level (0..3) of a lamp glow 0..1, or −1 when the lamps are off. */
export function glowLevel(lampGlow: number): number {
  if (lampGlow <= 0.02) return -1;
  return lampGlow < 0.3 ? 0 : lampGlow < 0.55 ? 1 : lampGlow < 0.8 ? 2 : 3;
}
