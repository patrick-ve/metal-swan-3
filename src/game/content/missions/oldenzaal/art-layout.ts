/**
 * The town's decor and lamps per section (TOWN, wave A): the decor lists of oz-a and oz-b built
 * from the layout numbers in terrain.ts (so the art sits on the collision), and the light-pass
 * lamps (the street lamps' heads, De Smulhoek's warm windows) for their light configs.
 *
 * Revision 2 (RUIN, R2-7: abandoned and worn down after the outbreak): most street lamps are dead
 * (frame 1), a few still burn and flicker (`OZ_A_LIT` / `OZ_B_LIT`); the abandoned cars, crowd
 * barriers and police tape, an emergency sign (its amber lamp is a light), toppled bikes and bins,
 * rubbish, blown newspapers, glass under the smashed windows, weeds, crows on the dead lamps and
 * a FEW torn, rotten banners (R2-2: two in oz-a, one in oz-b, high on the fronts). De Smulhoek
 * stays warm and whole: nothing of the ruin in front of it.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import { bgDensityFor } from '../../../art/art-registry';
import type { DecorDef, SectionDef } from '../../../mission/index';
import { CHUNK } from '../../../mission/view';
import type { StaticLight } from '../../oldenzaal/kit/light-api';
import '../../oldenzaal/ruin/art';
import { SMULHOEK_LIGHTS, SMULHOEK_W } from './art-smulhoek';
import { AWNING_WIDTHS, awningFrame, BALCONY_WIDTHS, LAMP_HEADS, SHOP_FL, SHOP_GF, SHOPS, shopWindowX } from './art-street';
import { h2 } from './art-kit';
import {
  G,
  OZ_A_CARS,
  OZ_B_CARS,
  type OzCar,
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

/**
 * Revision 2: the lamps that still burn (index into the lamp list → flicker 0 … 1). The right
 * head of a lamp is smashed (the unlit frame shows it), so a burning lamp lights its left head
 * fully and its right one weakly.
 */
export function litLampLights(xs: readonly number[], lit: ReadonlyMap<number, number>): StaticLight[] {
  const out: StaticLight[] = [];
  xs.forEach((x, i) => {
    const f = lit.get(i);
    if (f === undefined) return;
    LAMP_HEADS.forEach(([dx, dy], k) => out.push({ x: x + dx, y: G + dy, r: k ? 34 : 46, color: WARM, intensity: k ? 0.55 : 0.85, flicker: f }));
  });
  return out;
}

/** The lamp decor of a street: lit lamps frame 0, dead ones frame 1. */
function lampDecor(xs: readonly number[], lit: ReadonlyMap<number, number>): DecorDef[] {
  return xs.map((x, i) => ({ sprite: 'decor/oz/lamp', frame: lit.has(i) ? 0 : 1, x, y: G }));
}

/** Crows perched on the hoods of some dead lamps. */
function crowDecor(xs: readonly number[], lit: ReadonlyMap<number, number>, every: number): DecorDef[] {
  const out: DecorDef[] = [];
  xs.forEach((x, i) => {
    if (lit.has(i) || i % every !== 1) return;
    out.push({ sprite: 'decor/oz-ruin/crow', frame: i % 2, x: x - 15 + (i % 3), y: G - 98 });
    if (i % 4 === 1) out.push({ sprite: 'decor/oz-ruin/crow', frame: 1 - (i % 2), x: x + 13, y: G - 98, flipX: true });
  });
  return out;
}

/** The abandoned cars (their roofs are platforms: terrain.ts `carRoofs`). */
function carDecor(cars: readonly OzCar[]): DecorDef[] {
  return cars.map((c) => ({ sprite: 'decor/oz-ruin/car', frame: c.frame, x: c.x, y: G }));
}

/**
 * The litter of a street: glass under every smashed / burnt shop window, weeds and rubbish at the
 * fronts' feet, blown newspapers on the pavers (hash-placed, skipping `keepClear` x ranges).
 */
function litterDecor(shops: ReadonlyArray<{ frame: number; x: number }>, w: number, seed: number, keepClear: ReadonlyArray<readonly [number, number]>): DecorDef[] {
  const out: DecorDef[] = [];
  const clear = (x: number): boolean => keepClear.every(([a, b]) => x < a || x > b);
  shops.forEach((s, i) => {
    const spec = SHOPS[s.frame];
    const wx = shopWindowX(spec);
    const mid = s.x + wx.x + wx.w / 2;
    if ((spec.ruin === 'smashed' || spec.ruin === 'burnt' || spec.shutter === 'grille') && clear(mid) && i % 2 === seed % 2) out.push({ sprite: 'decor/oz-ruin/glass', frame: i % 2, x: Math.round(mid), y: G + 3 });
  });
  for (let x = 40; x < w - 40; x += 46) {
    const hh = h2(x, 1, seed);
    const xx = x + Math.round(h2(x, 2, seed) * 30);
    if (!clear(xx)) continue;
    if (hh < 0.3) out.push({ sprite: 'decor/oz-ruin/weeds', frame: Math.floor(h2(x, 3, seed) * 3), x: xx, y: G + 1 });
    else if (hh < 0.4) out.push({ sprite: 'decor/oz-ruin/rubbish', frame: Math.floor(h2(x, 4, seed) * 3), x: xx, y: G + 1 });
    if (h2(x, 5, seed) < 0.35) out.push({ sprite: 'decor/oz-ruin/paper', frame: Math.floor(h2(x, 6, seed) * 3), x: xx + 10, y: G + 8 + Math.round(h2(x, 7, seed) * 18) });
  }
  return out;
}

/** A torn banner on the upper floor of a three-storey front (its rod just under the cornice, at the front's left: clear of the lamps). */
function bannerOn(s: { frame: number; x: number }, frame: number): DecorDef {
  const spec = SHOPS[s.frame];
  return { sprite: 'decor/oz-ruin/banner', frame, x: s.x + 5, y: G - SHOP_GF - (spec.floors - 1) * SHOP_FL + 4 };
}

// ------------------------------------------------------------------------------------ oz-a

/** The street lamps of oz-a (x of their feet). */
export const OZ_A_LAMPS: readonly number[] = [70, 340, 610, 880, 1150, 1420, 1690, 1960, 2230, 2500, 2770, 3040];
/** The lamps of oz-a that still burn (index → flicker): 4 of 12, three of them flickering. */
export const OZ_A_LIT: ReadonlyMap<number, number> = new Map([
  [1, 0.4],
  [4, 0.08],
  [6, 0.55],
  [9, 0.45],
]);

/** The emergency sign of oz-a (x of its foot) and its amber lamp's height. */
export const OZ_A_SIGN_X = 1196;
const SIGN_LAMP_UP = 39;

export const OZ_A_DECOR: readonly DecorDef[] = [
  ...shopDecor(OZ_A_SHOPS),
  // Two torn banners (R2-2), high on three-storey fronts in the middle and the end fight.
  bannerOn(OZ_A_SHOPS[29], 0),
  bannerOn(OZ_A_SHOPS[49], 1),
  ...awningDecor(OZ_A_AWNINGS, 0),
  ...balconyDecor([...OZ_A_BALCONIES, OZ_A_LEDGE]),
  ...wallDecor(OZ_A_WALLS),
  ...litterDecor(OZ_A_SHOPS, 3072, 1, [[0, 30]]),
  ...carDecor(OZ_A_CARS),
  ...lampDecor(OZ_A_LAMPS, OZ_A_LIT),
  ...crowDecor(OZ_A_LAMPS, OZ_A_LIT, 3),
  { sprite: 'decor/oz/signpost', x: 1236, y: G },
  { sprite: 'decor/oz/bench', x: 470, y: G },
  { sprite: 'decor/oz/bench', x: 2380, y: G },
  { sprite: 'decor/oz-ruin/bin', x: 506, y: G + 2 },
  { sprite: 'decor/oz/bin', x: 1324, y: G },
  { sprite: 'decor/oz-ruin/bin', x: 2650, y: G + 2 },
  { sprite: 'decor/oz-ruin/bike', frame: 1, x: 1540, y: G + 4 },
  { sprite: 'decor/oz-ruin/bike', frame: 0, x: 2470, y: G + 6 },
  { sprite: 'decor/oz-ruin/rubbish', frame: 1, x: 1960, y: G + 1 },
  // The police cordon of the first days: tape, the emergency sign, barriers.
  { sprite: 'decor/oz-ruin/sign', x: OZ_A_SIGN_X, y: G, animate: true },
  { sprite: 'decor/oz-ruin/tape', x: 1290, y: G, animate: true },
  { sprite: 'decor/oz-ruin/tape', x: 2232, y: G, animate: true },
  // --- front decor that half covers the players ---
  { sprite: 'decor/oz/bike-rack', x: 740, y: G, front: true },
  { sprite: 'decor/oz/bike-rack', x: 2050, y: G, front: true },
  { sprite: 'decor/oz-ruin/barrier', frame: 2, x: 1124, y: G + 2, front: true },
  { sprite: 'decor/oz-ruin/barrier', frame: 0, x: 1376, y: G + 2, front: true },
  { sprite: 'decor/oz-ruin/barrier', frame: 1, x: 2560, y: G + 3, front: true },
  { sprite: 'decor/oz-ruin/barrier', frame: 1, x: 2614, y: G + 4, front: true },
  { sprite: 'decor/oz/bollard', x: 2860, y: G, front: true },
  { sprite: 'decor/oz/bollard', x: 2876, y: G, front: true },
];

/** The light-pass lamps of oz-a: the few street lamps that still burn, the emergency sign's amber lamp. */
export const OZ_A_LAMP_LIGHTS: readonly StaticLight[] = [
  ...litLampLights(OZ_A_LAMPS, OZ_A_LIT),
  { x: OZ_A_SIGN_X, y: G - SIGN_LAMP_UP, r: 30, color: PAL_HD_OZ.candle[4], intensity: 0.7, flicker: 0.6 },
];

// ------------------------------------------------------------------------------------ oz-b

export const OZ_B_LAMPS: readonly number[] = [90, 360, OZ_B_SMULHOEK_X + 138, 1000, 1270, 1540];
/** The lamps of oz-b that still burn: the one by De Smulhoek (steady) and one flickering on the way to the square. */
export const OZ_B_LIT: ReadonlyMap<number, number> = new Map([
  [2, 0.05],
  [4, 0.5],
]);

export const OZ_B_DECOR: readonly DecorDef[] = [
  ...shopDecor(OZ_B_SHOPS),
  { sprite: 'decor/oz/smulhoek', x: OZ_B_SMULHOEK_X, y: G },
  // One torn banner (R2-2), high on the fight's way to the square.
  bannerOn(OZ_B_SHOPS[24], 1),
  ...awningDecor(OZ_B_AWNINGS, 1),
  ...balconyDecor(OZ_B_BALCONIES),
  ...wallDecor(OZ_B_WALLS),
  ...litterDecor(OZ_B_SHOPS, 1792, 2, [[OZ_B_SMULHOEK_X - 20, OZ_B_SMULHOEK_X + SMULHOEK_W + 20]]),
  ...carDecor(OZ_B_CARS),
  ...lampDecor(OZ_B_LAMPS, OZ_B_LIT),
  ...crowDecor(OZ_B_LAMPS, OZ_B_LIT, 2),
  { sprite: 'decor/oz-ruin/tape', x: 1690, y: G, animate: true },
  { sprite: 'decor/oz-ruin/rubbish', frame: 2, x: 440, y: G + 1 },
  // De Smulhoek's corner: the signpost in the side street, the menu board, the closed parasol,
  // the terrace screen, a bench.
  { sprite: 'decor/oz/signpost', x: OZ_B_SMULHOEK_X - 8, y: G },
  { sprite: 'decor/oz/menu-board', x: OZ_B_SMULHOEK_X + 30, y: G },
  { sprite: 'decor/oz/parasol', x: OZ_B_SMULHOEK_X + 104, y: G },
  // The terrace screen at De Smulhoek's own corner (right of the door, before the lamp), never in
  // front of the next shop.
  { sprite: 'decor/oz/smulhoek-screen', x: OZ_B_SMULHOEK_X + SMULHOEK_W - 56, y: G },
  { sprite: 'decor/oz/bench', x: 1180, y: G },
  { sprite: 'decor/oz-ruin/bin', x: 1214, y: G + 2 },
  { sprite: 'decor/oz-ruin/bike', frame: 0, x: 1000, y: G + 5 },
  // --- front decor ---
  { sprite: 'decor/oz/bike-rack', x: 140, y: G, front: true },
  { sprite: 'decor/oz-ruin/barrier', frame: 0, x: 1600, y: G + 2, front: true },
  { sprite: 'decor/oz-ruin/barrier', frame: 1, x: 1652, y: G + 4, front: true },
];

/** The light-pass lamps of oz-b: the street lamps and De Smulhoek's warm windows and door. */
export const OZ_B_LAMP_LIGHTS: readonly StaticLight[] = [
  ...litLampLights(OZ_B_LAMPS, OZ_B_LIT),
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
