/**
 * The strip source `oat-facade` (docs/design/oat.md §8.6 "The strips"; the contract:
 * mission/strips/types.ts). `grammarPlan(def, section)` plans the section's rows once (the lot
 * sequencer, grammar.ts; registered with `defineFacadeRows` so the shadows and the tests read the
 * same lots) and paints any chunk band at 1× / 2× / 4× in the lit or the dark set:
 *
 *   parts (parts.ts: body and gable, cornice, seam, storeys, crown, ground band, details, wear)
 *   → light (light.ts: the sun and the opposite row by day, the baked lamps and neon at night)
 *   → colours (palette.ts: the oat set at 2× / 4×, the 64-colour PAL at 1×).
 *
 * Pure and deterministic: the same arguments paint the same pixels (no rng, no clock, no DOM).
 */
import type { PixelBuffer } from '../../../../../engine/pixel';
import { hex } from '../../../../../engine/color';
import { sectionSun } from '../../../../mission/light/api';
import { defineStripSource } from '../../../../mission/strips/source';
import { chunkWorldRange, stripBandRows } from '../../../../mission/strips/space';
import { STRIP_CHUNK, STRIP_MAX_H, type SectionStripsDef, type StripDensity, type StripLightSet, type StripPlan, type StripSectionInfo } from '../../../../mission/strips/types';
import { OAT_STRIP_SOURCE } from '../ids';
import { sectionShade } from '../light/section-shade';
import type { RowPlan } from './grammar';
import { nightLights, resolveBand, type WorldLight } from './light';
import { jointOf, lutOf, WALL } from './palette';
import { drawBody, drawCornice, drawCrown, drawDetails, drawGround, drawSeam, drawStoreys, drawWear, type LotCtx } from './parts';
import { Art } from './raster';
import { defineFacadeRows, planSection } from './rows';
import type { LotPlan } from './types';

/** Bands per chunk paint by density (each band well under the 16 ms job budget). */
const BANDS: Readonly<Record<StripDensity, number>> = { 1: 1, 2: 4, 4: 12 };
/** World px a lot's drawing may reach outside its own range (cornices, shadows, signs). */
const MARGIN = 48;

const art = new Art();
const range = { u0: 0, u1: 0 };
const band = { r0: 0, r1: 0 };

/** The fallback sun colour of a day section without a registered sun (a neutral white). */
const NEUTRAL_SUN = hex('#fff4e6');

/** Plan a section's façade strips. */
export function grammarPlan(def: SectionStripsDef, info: StripSectionInfo): StripPlan {
  defineFacadeRows(info.id, def.rows);
  const rows = planSection(info.id);
  const s = info.scale !== undefined && info.scale > 0 ? info.scale : 1;
  const height = Math.min(def.height, STRIP_MAX_H);
  const lots: LotPlan[] = [];
  const rowOf: RowPlan[] = [];
  for (const r of rows)
    for (const l of r.lots) {
      lots.push(l);
      rowOf.push(r);
    }
  const lights: WorldLight[] = [];
  for (const r of rows) for (const L of nightLights(r)) lights.push(L);
  const night = rows.some((r) => r.night);
  const sun = sectionSun(info.id);
  const sunColour = sun?.color ?? NEUTRAL_SUN;
  const darkRange = def.dark;
  // The night bake (lamp pools over many px) costs more per px: more, thinner bands at 4×.
  const bandsOf = (d: StripDensity): number => (night && d === 4 ? 16 : night && d === 2 ? 5 : (BANDS[d] ?? 1));

  const touching = (cx: number, margin: number): number[] => {
    chunkWorldRange(cx, s, range);
    const out: number[] = [];
    for (let i = 0; i < lots.length; i++) {
      const l = lots[i];
      if (l.u0 + l.w > range.u0 - margin && l.u0 < range.u1 + margin) out.push(i);
    }
    return out;
  };

  return {
    height,
    covers(cx) {
      return touching(cx, 0).length > 0;
    },
    bands(_cx, d) {
      return bandsOf(d);
    },
    paint(cx: number, d: StripDensity, set: StripLightSet, b: number, out: PixelBuffer) {
      const H = height * d;
      stripBandRows(b, bandsOf(d), H, band);
      art.begin(cx, d, s, STRIP_CHUNK * d, H, H - band.r1, H - band.r0);
      // The dark set darkens the lots inside `dark` only (the range starts on a lot border): a lot
      // outside it keeps its lit look in a dark chunk, so no chunk border ever cuts a façade.
      const dark = set === 'dark' && !!darkRange;
      const dk0 = darkRange ? darkRange[0] : 0;
      const dk1 = darkRange ? darkRange[1] : 0;
      // Day sections read LIGHT-WATER's shade model (built lazily: it reads our opposite row).
      const shade = night || !sun ? null : sectionShade(info.id);
      const geom = shade?.geom ?? null;
      for (const i of touching(cx, MARGIN)) {
        const l = lots[i];
        const row = rowOf[i];
        const wall = WALL[l.wall];
        const mid = Math.floor(wall.length / 2);
        const c: LotCtx = {
          a: art,
          l,
          row,
          night: row.night,
          dark: dark && l.u0 >= dk0 && l.u0 < dk1,
          geom: row.night ? null : geom,
          X0: art.X(l.u0),
          X1: art.X(l.u0 + l.w),
          eY: art.Y(l.eaves),
          bY: art.Y(l.bandTop),
          wall,
          base: mid - (l.seed % 3 === 0 ? 1 : 0),
          joint: jointOf(wall),
          gi: i,
        };
        drawBody(c);
        drawStoreys(c);
        drawCornice(c);
        drawCrown(c);
        drawSeam(c);
        drawGround(c);
        drawDetails(c);
        drawWear(c);
      }
      resolveBand(art, { lots, shade, sun: sunColour, night, dark, darkU0: dk0, darkU1: dk1, lights, lut: lutOf(d) }, out);
    },
    lots() {
      return lots.map((l) => ({ u0: l.u0, u1: l.u0 + l.w, kind: l.gable }));
    },
  };
}

/** The oat strip source (registered at import: index.ts). */
export const OAT_FACADE_SOURCE = defineStripSource(OAT_STRIP_SOURCE, { plan: grammarPlan });

