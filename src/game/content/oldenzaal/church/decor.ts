/**
 * The church's decor lists and light-pass lamps (CHURCH, wave B), built from the layout numbers
 * (layout.ts), so the art sits where the set pieces happen. Decor is never an entity: the altar,
 * the crucifix, the statues, the Stations and the images can never be hit (respect, spec §7).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD, PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { DecorDef } from '../../../mission/index';
import type { StaticLight } from '../kit/light-api';
import { APSE_CRYPT_X, APSE_PREDELLA_TOP } from './art-nave-arch';
import { LAMP_GLASS_Y, VOTIVE_LIGHT_DY } from './art-nave-furn';
import {
  CHOIR_X,
  CRYPT_CANDLES,
  CRYPT_COFFINS,
  CRYPT_COLUMNS,
  CRYPT_LANTERNS,
  CRYPT_STAIR_X,
  G,
  NAVE_ALTAR_X,
  NAVE_APSE_X,
  NAVE_CHANDELIERS,
  NAVE_CHAPEL_X,
  NAVE_CONFESSIONAL_X,
  NAVE_FONT_X,
  NAVE_LAMP_X,
  NAVE_MARY_X,
  NAVE_MOON_SHAFTS,
  NAVE_PEWS,
  NAVE_PILLARS,
  NAVE_PULPIT_PILLAR,
  NAVE_SAINTS,
  NAVE_STATIONS,
  NAVE_VOTIVE_X,
} from './layout';

const WARM: Color = PAL_HD_OZ.candle[5];
const WARM_DIM: Color = PAL_HD_OZ.candle[4];
const MOON: Color = PAL_HD_OZ.night[5];
const RED: Color = PAL_HD.red[5];

/** The predella's top (feet line of the altar and the candlesticks) in world y. */
export const PREDELLA_Y = G - (176 - APSE_PREDELLA_TOP);
/** The tall candlesticks either side of the altar. */
export const NAVE_CANDLESTICKS: readonly number[] = [NAVE_ALTAR_X - 46, NAVE_ALTAR_X + 46];
/** The stairwell's centre (world x). */
export const NAVE_STAIRWELL_X = NAVE_APSE_X + APSE_CRYPT_X;

/** The nave's decor (drawn in this order, all behind the entities). */
export const NAVE_DECOR: readonly DecorDef[] = [
  // The moonlight shafts in the air of the nave (alpha), then the west end and the pillars.
  ...NAVE_MOON_SHAFTS.map((x) => ({ sprite: 'decor/oz-nave/shaft', x, y: G, alpha: 0.32 })),
  { sprite: 'decor/oz-nave/west', x: 0, y: G },
  { sprite: 'decor/oz-nave/apse', x: CHOIR_X, y: G },
  { sprite: 'decor/oz-nave/chapel', x: NAVE_CHAPEL_X, y: G },
  { sprite: 'decor/oz-nave/confessional', x: NAVE_CONFESSIONAL_X, y: G },
  ...NAVE_PILLARS.map((x) => ({ sprite: 'decor/oz-nave/pillar', x, y: G })),
  // On the pillars: the saints on their consoles, the Stations of the Cross, the pulpit.
  ...NAVE_SAINTS.map(([i, f]) => ({ sprite: 'decor/oz-nave/saint', frame: f, x: NAVE_PILLARS[i], y: G - 52 })),
  ...NAVE_STATIONS.map(([i, f]) => ({ sprite: 'decor/oz-nave/station', frame: f, x: NAVE_PILLARS[i], y: G - 40 })),
  { sprite: 'decor/oz-nave/pulpit', x: NAVE_PILLARS[NAVE_PULPIT_PILLAR], y: G },
  { sprite: 'decor/oz-nave/font', x: NAVE_FONT_X, y: G },
  // Mary and the votive candles burning before her (by themselves, for weeks: spooky).
  { sprite: 'decor/oz-nave/mary', x: NAVE_MARY_X, y: G },
  { sprite: 'decor/oz-nave/votive', x: NAVE_VOTIVE_X, y: G, animate: true },
  // The choir: the altar on its predella, the candlesticks, the crucifix and the sanctuary lamp.
  { sprite: 'decor/oz-nave/altar', x: NAVE_ALTAR_X, y: PREDELLA_Y },
  ...NAVE_CANDLESTICKS.map((x) => ({ sprite: 'decor/oz-nave/candlestick', x, y: PREDELLA_Y, animate: true })),
  { sprite: 'decor/oz-nave/crucifix', x: NAVE_ALTAR_X, y: -6 },
  { sprite: 'decor/oz-nave/lamp', x: NAVE_LAMP_X, y: 0, animate: true },
  // The chandeliers from the vault (only one still burns).
  ...NAVE_CHANDELIERS.map(([x, lit]) => (lit ? { sprite: 'decor/oz-nave/chandelier', x, y: 0, animate: true } : { sprite: 'decor/oz-nave/chandelier', x, y: 0, frame: 3 })),
  // The pews and the signs of the weeks of abandonment.
  ...NAVE_PEWS.map(([x, w]) => ({ sprite: 'decor/oz-nave/pews', frame: w > 100 ? 1 : 0, x, y: G })),
  { sprite: 'decor/oz-nave/hymn-board', frame: 1, x: 1248, y: G },
  { sprite: 'decor/oz-nave/stand', x: 1326, y: G },
];

/** The nave's lamps for the light pass: candles warm, the sanctuary lamp red, the moon cold. */
export const NAVE_LAMPS: readonly StaticLight[] = [
  { x: NAVE_VOTIVE_X, y: G + VOTIVE_LIGHT_DY, r: 66, color: WARM, intensity: 1, flicker: 0.3, glow: 0.5 },
  ...NAVE_CHANDELIERS.filter(([, lit]) => lit).map(([x]) => ({ x, y: 32, r: 58, color: WARM_DIM, intensity: 0.75, flicker: 0.25, glow: 0.35 })),
  ...NAVE_CANDLESTICKS.map((x) => ({ x, y: PREDELLA_Y - 44, r: 44, color: WARM, intensity: 0.85, flicker: 0.2, glow: 0.4 })),
  { x: NAVE_LAMP_X, y: LAMP_GLASS_Y, r: 40, color: RED, intensity: 0.9, flicker: 0.1, glow: 0.7 },
  { x: NAVE_CHAPEL_X + 11, y: G - 6, r: 22, color: RED, intensity: 0.6, flicker: 0.2, glow: 0.5 },
  ...NAVE_MOON_SHAFTS.map((x) => ({ x: x + 16, y: G - 8, r: 50, color: MOON, intensity: 0.6, flicker: 0, glow: 0.25 })),
];

// ------------------------------------------------------------------------------------ the crypt

/** The crypt's decor: the vault bays, the stairs at both ends, coffins, candles, lanterns. */
export const CRYPT_DECOR: readonly DecorDef[] = [
  ...CRYPT_COLUMNS.map((x) => ({ sprite: 'decor/oz-crypt/vault', x, y: G })),
  { sprite: 'decor/oz-crypt/stair-down', x: 0, y: G },
  { sprite: 'decor/oz-crypt/stair-up', x: CRYPT_STAIR_X, y: G },
  ...CRYPT_COFFINS.map(([x]) => ({ sprite: 'decor/oz-crypt/coffin', frame: 0, x: x - 2, y: G })),
  { sprite: 'decor/oz-crypt/coffin', frame: 1, x: 140, y: G },
  { sprite: 'decor/oz-crypt/coffin', frame: 1, x: 958, y: G },
  ...CRYPT_CANDLES.map((x) => ({ sprite: 'decor/oz-crypt/candles', x, y: G, animate: true })),
  ...CRYPT_LANTERNS.map((x) => ({ sprite: 'decor/oz-crypt/lantern', x, y: 36, animate: true })),
];

/** The crypt's lamps: the candles, the lanterns, the faint warm glow from the nave above the stair. */
export const CRYPT_LAMPS: readonly StaticLight[] = [
  ...CRYPT_CANDLES.map((x) => ({ x, y: G - 12, r: 48, color: WARM, intensity: 0.95, flicker: 0.3, glow: 0.45 })),
  ...CRYPT_LANTERNS.map((x) => ({ x, y: 36 + 53, r: 52, color: WARM_DIM, intensity: 0.75, flicker: 0.15, glow: 0.35 })),
  { x: 10, y: 50, r: 40, color: WARM_DIM, intensity: 0.5, flicker: 0.1, glow: 0.2 },
  { x: CRYPT_STAIR_X + 97, y: 90, r: 30, color: MOON, intensity: 0.55, flicker: 0, glow: 0.2 },
];

/** The sprite ids a decor list draws (a section's `art`). */
export function decorIds(list: readonly DecorDef[]): string[] {
  return [...new Set(list.map((d) => d.sprite))];
}
