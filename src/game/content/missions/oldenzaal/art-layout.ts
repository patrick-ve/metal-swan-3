/**
 * The town's decor and lamps per section (TOWN, wave A): the decor lists of oz-a and oz-b built
 * from the layout numbers in terrain.ts (so the art sits on the collision), and the light-pass
 * lamps (the street lamps' heads, De Smulhoek's warm windows) for their light configs.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import { bgDensityFor } from '../../../art/art-registry';
import type { DecorDef, SectionDef } from '../../../mission/index';
import { CHUNK } from '../../../mission/view';
import type { StaticLight } from '../../oldenzaal/kit/light-api';
import { SMULHOEK_LIGHTS, SMULHOEK_W } from './art-smulhoek';
import { AWNING_WIDTHS, awningFrame, BALCONY_WIDTHS, LAMP_HEADS, SHOPS } from './art-street';
import {
  G,
  OZ_A_AWNINGS,
  OZ_A_BALCONIES,
  OZ_A_LEDGE,
  OZ_A_SHOPS,
  OZ_A_WALLS,
  OZ_B_AWNINGS,
  OZ_B_BALCONIES,
  OZ_B_SHOPS,
  OZ_B_SMULHOEK_X,
  OZ_B_WALLS,
  type Block,
  type Plat,
} from './terrain';

/** The warm light of the lamps and windows (the candle ramp). */
const WARM: Color = PAL_HD_OZ.candle[5];
const WARM_DIM: Color = PAL_HD_OZ.candle[4];

function shopDecor(shops: ReadonlyArray<{ frame: number; x: number }>): DecorDef[] {
  return shops.map((s) => ({ sprite: 'decor/oz/shop', frame: s.frame, x: s.x, y: G }));
}

function awningDecor(plats: readonly Plat[], seed: number): DecorDef[] {
  return plats.map(([x, y, w], i) => {
    const aw = AWNING_WIDTHS.includes(w as (typeof AWNING_WIDTHS)[number]) ? w : AWNING_WIDTHS[0];
    return { sprite: 'decor/oz/awning', frame: awningFrame(aw, (i + seed) % 3), x, y };
  });
}

function balconyDecor(plats: readonly Plat[]): DecorDef[] {
  return plats.map(([x, y, w]) => ({ sprite: 'decor/oz/balcony', frame: Math.max(0, BALCONY_WIDTHS.indexOf(w as (typeof BALCONY_WIDTHS)[number])), x, y }));
}

/** Flowers on the walls' tops (a 32-px planter per 32 px of wall). */
function wallDecor(walls: readonly Block[]): DecorDef[] {
  const out: DecorDef[] = [];
  for (const [x, y, w] of walls) for (let k = 0; k + 32 <= w + 8; k += 32) out.push({ sprite: 'decor/oz/planter', x: x + k + Math.max(0, (w - 32 * Math.max(1, Math.floor((w + 8) / 32))) / 2), y });
  return out;
}

/** The street lamps' light spots (both heads of each double lamp). */
export function lampLights(xs: readonly number[], flickerEvery = 3): StaticLight[] {
  const out: StaticLight[] = [];
  xs.forEach((x, i) => {
    for (const [dx, dy] of LAMP_HEADS) out.push({ x: x + dx, y: G + dy, r: 46, color: WARM, intensity: 0.9, flicker: i % flickerEvery === 1 ? 0.35 : 0.05 });
  });
  return out;
}

// ------------------------------------------------------------------------------------ oz-a

/** The street lamps of oz-a (x of their feet). */
export const OZ_A_LAMPS: readonly number[] = [70, 340, 610, 880, 1150, 1420, 1690, 1960, 2230, 2500, 2770, 3040];

export const OZ_A_DECOR: readonly DecorDef[] = [
  ...shopDecor(OZ_A_SHOPS),
  ...awningDecor(OZ_A_AWNINGS, 0),
  ...balconyDecor([...OZ_A_BALCONIES, OZ_A_LEDGE]),
  ...wallDecor(OZ_A_WALLS),
  ...OZ_A_LAMPS.map((x) => ({ sprite: 'decor/oz/lamp', x, y: G })),
  { sprite: 'decor/oz/signpost', x: 1236, y: G },
  { sprite: 'decor/oz/bench', x: 470, y: G },
  { sprite: 'decor/oz/bench', x: 1560, y: G },
  { sprite: 'decor/oz/bench', x: 2380, y: G },
  { sprite: 'decor/oz/bin', x: 500, y: G },
  { sprite: 'decor/oz/bin', x: 1310, y: G },
  { sprite: 'decor/oz/bin', x: 2650, y: G },
  // --- front decor that half covers the players ---
  { sprite: 'decor/oz/bike-rack', x: 740, y: G, front: true },
  { sprite: 'decor/oz/bike-rack', x: 2050, y: G, front: true },
  { sprite: 'decor/oz/bollard', x: 1100, y: G, front: true },
  { sprite: 'decor/oz/bollard', x: 1116, y: G, front: true },
  { sprite: 'decor/oz/bollard', x: 2860, y: G, front: true },
  { sprite: 'decor/oz/bollard', x: 2876, y: G, front: true },
];

/** The light-pass lamps of oz-a: the street lamps (every third one flickers). */
export const OZ_A_LAMP_LIGHTS: readonly StaticLight[] = lampLights(OZ_A_LAMPS);

// ------------------------------------------------------------------------------------ oz-b

export const OZ_B_LAMPS: readonly number[] = [90, 360, OZ_B_SMULHOEK_X + 138, 1000, 1270, 1540];

export const OZ_B_DECOR: readonly DecorDef[] = [
  ...shopDecor(OZ_B_SHOPS),
  { sprite: 'decor/oz/smulhoek', x: OZ_B_SMULHOEK_X, y: G },
  ...awningDecor(OZ_B_AWNINGS, 1),
  ...balconyDecor(OZ_B_BALCONIES),
  ...wallDecor(OZ_B_WALLS),
  ...OZ_B_LAMPS.map((x) => ({ sprite: 'decor/oz/lamp', x, y: G })),
  // De Smulhoek's corner: the signpost in the side street, the menu board, the closed parasol,
  // the terrace screen, a bench.
  { sprite: 'decor/oz/signpost', x: OZ_B_SMULHOEK_X - 8, y: G },
  { sprite: 'decor/oz/menu-board', x: OZ_B_SMULHOEK_X + 30, y: G },
  { sprite: 'decor/oz/parasol', x: OZ_B_SMULHOEK_X + 104, y: G },
  // The terrace screen at De Smulhoek's own corner (right of the door, before the lamp), never in
  // front of the next shop.
  { sprite: 'decor/oz/smulhoek-screen', x: OZ_B_SMULHOEK_X + SMULHOEK_W - 56, y: G },
  { sprite: 'decor/oz/bench', x: 1180, y: G },
  { sprite: 'decor/oz/bin', x: 1210, y: G },
  // --- front decor ---
  { sprite: 'decor/oz/bike-rack', x: 240, y: G, front: true },
  { sprite: 'decor/oz/bollard', x: 1600, y: G, front: true },
  { sprite: 'decor/oz/bollard', x: 1616, y: G, front: true },
];

/** The light-pass lamps of oz-b: the street lamps and De Smulhoek's warm windows and door. */
export const OZ_B_LAMP_LIGHTS: readonly StaticLight[] = [
  ...lampLights(OZ_B_LAMPS, 4),
  ...SMULHOEK_LIGHTS.map((l) => ({ x: OZ_B_SMULHOEK_X + l.x, y: G + l.y, r: l.r, color: l.intensity > 0.75 ? WARM : WARM_DIM, intensity: l.intensity, flicker: l.flicker })),
];

/** The sprite ids a decor list draws (a section's `art`). */
export function decorArt(list: readonly DecorDef[]): string[] {
  return [...new Set(list.map((d) => d.sprite))];
}

/** Every town sprite id (sanity: the decor lists only use registered ids). */
export const OZ_TOWN_SHOP_COUNT = SHOPS.length;

// ------------------------------------------------------------------------------------ tier-4 scenery

/** The 4× terrain chunks a scrolling street view keeps at most (view.ts: the visible columns, one prefetched each side, two behind before eviction). */
export const OZ_TERRAIN_CHUNKS_4X = 6;

/**
 * Bytes the 4× scenery of a section takes besides the sprites (gameplay.ts `denseReserve`): every
 * background layer with a 4× generator (width × height × 16 px × 4 bytes) and the resident 4×
 * terrain chunks (256² logical px each).
 */
export function ozSceneryBytes(sec: Pick<SectionDef, 'background' | 'height'>): number {
  let b = 0;
  for (const l of sec.background?.layers ?? []) if (bgDensityFor(l.gen, 4) === 4) b += (l.width ?? 512) * (l.height ?? 216) * 64;
  return b + OZ_TERRAIN_CHUNKS_4X * CHUNK * CHUNK * 64;
}

/**
 * The town's 4× scenery reserve (the worst town section rounded up to the next MB): a mission
 * `denseReserve` for oldenzaal when the 2D mission def gets that field (INTEGRATE).
 */
export const OZ_SCENERY_RESERVE = 52 * 1024 * 1024;
