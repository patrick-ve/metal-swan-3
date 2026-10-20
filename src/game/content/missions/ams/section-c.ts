/**
 * ams-c — AMSTEL (docs/design/amsterdam.md §6): 3328×216, scroll right, golden late afternoon,
 * vehicles: `swan`. The quay street (0–600), the long canal stretch with six houseboats (water
 * 600–1400: the Swan swims, on foot hop the decks y 164 and roofs y 146), the quay street with
 * shops (1400–1940), the ramp up to the white wooden Amstel bridge (deck y 152 over the water
 * 2000–2800, ramp down 2700–2800 to the quay at y 172) and the Blauwbrug (2960–3160) to
 * Waterlooplein; exit → `d`.
 *
 * Script: handhavers, gulls, boats, riders, three tourists; the exit opens after the last squad.
 */
import { PAL } from '../../../../engine/palette';
import type { ScriptGen } from '../../../../engine/script';
import type { BackgroundDef, DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { at, carillon, crate, fromRight, hostage, normalUp, prewarm } from './helpers';
import { boatDecor, bridgeFaceSprite, HOUSE, houseRow, waterDecor } from './art';
import { C_AMSTEL, C_BLAUWBRUG, C_BOATS, C_BRIDGE_END, C_BRIDGE_Y, C_CANAL, C_W, DECK_Y, G, ROOF_Y, terrainC, WATER_Y } from './terrain';

export const BG_GOLDEN: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.gold[3], PAL.gold[2]], sun: { x: 0.82, y: 0.3, r: 9 } }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.08, count: 4, ramp: [PAL.sand[2], PAL.sand[3], PAL.gold[3]] }, factorX: 0.05, driftX: 0.04 },
    { gen: 'ams-skyline', params: { y: 0.54, light: 'golden' }, width: 768, factorX: 0.1 },
    { gen: 'ams-canal-houses', params: { y: 0.6, s: 9, haze: 1, water: false, light: 'golden' }, width: 640, factorX: 0.22 },
    { gen: 'ams-canal-houses', params: { y: 0.72, s: 13, light: 'golden' }, width: 768, factorX: 0.42 },
    { gen: 'ams-elms', params: { y: 0.26, spacing: 136, light: 'golden' }, width: 544, factorX: 0.68 },
  ],
};

const SPAN = 128;
const [BB_X, BB_LEN, BB_H] = C_BLAUWBRUG;

const decor: DecorDef[] = [
  // --- quay street ---
  { sprite: 'decor/ams/elm', x: 70, y: G },
  { sprite: 'decor/ams/lamp', x: 170, y: G },
  { sprite: 'decor/ams/tulips', x: 240, y: G, animate: true },
  { sprite: 'decor/ams/elm', x: 330, y: G },
  { sprite: 'decor/ams/flag-ams', x: 430, y: G, animate: true },
  { sprite: 'decor/ams/lamp', x: 520, y: G },
  // --- the canal with houseboats ---
  ...waterDecor(C_CANAL[0], C_CANAL[1]),
  ...boatDecor(C_BOATS, ROOF_Y, DECK_Y - ROOF_Y),
  // --- quay street with shops ---
  ...houseRow('golden', 1400, [HOUSE.fietsen, HOUSE.step, HOUSE.koffie, HOUSE.bell, HOUSE.boeken, HOUSE.neckRed, HOUSE.flat, HOUSE.kaas, HOUSE.spout, HOUSE.bloemen]),
  { sprite: 'decor/ams/lamp', x: 1480, y: G },
  { sprite: 'decor/ams/tulips', x: 1600, y: G, animate: 12 },
  { sprite: 'decor/ams/lamp', x: 1760, y: G },
  { sprite: 'decor/ams/flag-nl', x: 1880, y: G, animate: true },
  // --- the white Amstel bridge ---
  ...waterDecor(C_AMSTEL[0], C_AMSTEL[1]),
  ...Array.from({ length: Math.ceil((C_BRIDGE_END - C_AMSTEL[0]) / SPAN) }, (_, i): DecorDef => ({ sprite: 'decor/ams/white-bridge', x: C_AMSTEL[0] + i * SPAN, y: C_BRIDGE_Y })),
  { sprite: 'decor/ams/white-portal', x: 2240, y: C_BRIDGE_Y },
  { sprite: 'decor/ams/white-portal', x: 2460, y: C_BRIDGE_Y },
  // --- the Blauwbrug to Waterlooplein ---
  { sprite: 'decor/ams/lamp', x: 2860, y: G },
  { sprite: 'decor/ams/blauwbrug-lamp', x: BB_X + 12, y: G },
  { sprite: 'decor/ams/blauwbrug-lamp', x: BB_X + BB_LEN - 12, y: G },
  { sprite: 'decor/ams/flag-ams', x: BB_X + 100, y: G - BB_H, animate: true },
  { sprite: 'decor/ams/market-stall', frame: 0, x: 3230, y: G },
  { sprite: 'decor/ams/flag-nl', x: 3290, y: G, animate: 11 },
  // --- front ---
  { sprite: 'decor/ams/bollard', x: 560, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 576, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 1420, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 1540, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 1820, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 2820, y: 175, front: true },
  { sprite: bridgeFaceSprite(BB_LEN, BB_H), x: BB_X, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 3200, y: G, front: true },
];

/**
 * The city life of section c (cosmetic, sleeps off-screen): a tour boat on the Amstel under the
 * white bridge, pigeons, window wavers. Call it at the start of `script`.
 */
export function life(ctx: SectionContext): void {
  ctx.spawn('ams-tour-boat', C_AMSTEL[0] + 40, 182, { range: 560, speed: 0.35 });
  ctx.spawn('ams-pigeons', 300, G, { count: 4 });
  ctx.spawn('ams-pigeons', 1700, G, { count: 5 });
  // Ducks on the Amstel under the white bridge.
  ctx.spawn('ams-ducks', 2160, WATER_Y, { count: 3, range: 90 });
  ctx.spawn('ams-ducks', 2520, WATER_Y, { count: 2, range: 60 });
  ctx.spawn('ams-window-waver', 1560, 100, {});
  ctx.spawn('ams-window-waver', 1830, 92, { look: 'cat' });
}

/** Lamp top (a perched gull's feet) of a `decor/ams/lamp` on the ground line. */
const LAMP_TOP = G - 70;

/**
 * ams-c: the handhavers arrive, the canal with houseboats and little boats (the Swan swims), the
 * shop quay, the white Amstel bridge, the Blauwbrug; the exit opens after the last squad.
 */
export function* script(ctx: SectionContext): ScriptGen {
  prewarm('npc/ams/', 'decor/ams/');
  life(ctx);
  carillon(ctx);
  // Little open boats to hop on along the canal, more life on the quays.
  ctx.spawn('ams-boat-platform', 640, 172, { range: 300, speed: 0.5 });
  ctx.spawn('ams-boat-platform', 1080, 172, { range: 290, speed: 0.45, dir: -1 });
  ctx.spawn('ams-tour-boat', C_AMSTEL[0] + 360, 182, { range: 360, speed: 0.3, dir: -1 });
  ctx.spawn('ams-pigeons', 2900, G, { count: 4 });

  // @0: the quay street: the first handhaver writes tickets.
  crate(ctx, 250, 'S');
  at(ctx, 'handhaver', 470, { facing: -1 });
  at(ctx, 'seagull', 520, { perch: true }, LAMP_TOP);
  yield ctx.waitCamera(80);
  fromRight(ctx, 'delivery-rider');
  yield ctx.waitCamera(220);
  fromRight(ctx, 'handhaver');
  yield 60;
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });

  // @400: the canal: houseboats, boats, gulls diving over the water, a tourist on a deck.
  yield ctx.waitCamera(400);
  ctx.spawn('seagull', 820, 110, { flock: 2 });
  hostage(ctx, 'tourist', 'sack', 1040, 'auto', DECK_Y, { band: 30 });
  yield ctx.waitCamera(620);
  at(ctx, 'seagull', 1030, { perch: true }, ROOF_Y);
  ctx.spawn('seagull', 1150, 104, { flock: normalUp(ctx) ? 3 : 2 });
  yield ctx.waitCamera(860);
  at(ctx, 'handhaver', 1300, { facing: -1 }, DECK_Y);
  at(ctx, 'seagull', 1290, { perch: true }, ROOF_Y);

  // @1000 (checkpoint 1200): the shop quay: riders, youths and handhavers, stalls to break.
  yield ctx.waitCamera(1000);
  ctx.spawn('ams-herring-cart', 1520, 'ground', {});
  ctx.spawn('ams-market-stall', 1700, 'ground', { contains: 'bombs' });
  crate(ctx, 1460, 'M');
  yield ctx.waitCamera(1120);
  fromRight(ctx, 'fatbike-youth');
  yield 60;
  fromRight(ctx, 'handhaver');
  yield ctx.waitCamera(1260);
  hostage(ctx, 'tourist', 'chair', 1640, 'auto');
  ctx.enter('fatbike-youth', 'right', { params: { pair: true } });
  yield 70;
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind' });
  yield ctx.waitCamera(1420);
  at(ctx, 'fatbike-youth', 1860, { gag: 'circles', facing: -1 });
  fromRight(ctx, 'handhaver');
  if (normalUp(ctx)) fromRight(ctx, 'handhaver', {}, 16, undefined, 40);

  // @1600: the white Amstel bridge: gulls over the river, an officer on the deck.
  yield ctx.waitCamera(1640);
  ctx.spawn('seagull', 2200, 96, { flock: normalUp(ctx) ? 3 : 2 });
  at(ctx, 'handhaver', 2330, { facing: -1 }, C_BRIDGE_Y);
  yield ctx.waitCamera(1900);
  hostage(ctx, 'tourist', 'sack', 2420, 'auto', C_BRIDGE_Y, { band: 40 });
  at(ctx, 'handhaver', 2560, { facing: -1 }, C_BRIDGE_Y);
  yield ctx.waitCamera(2100);
  ctx.spawn('seagull', 2600, 92, { flock: 2 });
  fromRight(ctx, 'delivery-rider');

  // @2400 (checkpoint): the Blauwbrug to Waterlooplein: the last squad.
  yield ctx.waitCamera(2400);
  crate(ctx, 2880, 'bombs');
  at(ctx, 'seagull', 2860, { perch: true }, LAMP_TOP);
  fromRight(ctx, 'fatbike-youth');
  yield 70;
  fromRight(ctx, 'handhaver');
  yield ctx.waitCamera(2700);
  fromRight(ctx, 'fatbike-youth', { pair: true }, 16, 'blauw');
  yield 50;
  fromRight(ctx, 'handhaver', {}, 16, 'blauw');
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind', tag: 'blauw' });
  yield 60;
  ctx.spawn('seagull', 3150, 100, { flock: 2, tag: 'blauw' });
  if (normalUp(ctx)) fromRight(ctx, 'handhaver', {}, 16, 'blauw', 40);
  yield ctx.waitClear('blauw');
  ctx.enableExit('end');
  ctx.showGo();
}

export const sectionC: SectionDef = {
  id: 'c',
  name: 'Amstel',
  width: C_W,
  height: 216,
  scroll: 'right',
  background: BG_GOLDEN,
  terrain: terrainC(),
  terrainStyle: { ground: 'klinker', edge: 'bikepath', platform: 'whitewood', solid: 'brick' },
  decor,
  // Tier 4: the fatbike pairs ride in b and c only (the solo sets are in the mission's preloadFirst).
  // Tier 4 (UHD verifier): the decor this section draws — its decor list and the breakables / boats
  // its script spawns — joins the 4× working set only here and in the section before it.
  art: ['enemy/fatbike-youth-pair', ...new Set(decor.map((d) => d.sprite)), 'decor/ams/ams-boat-platform', 'decor/ams/ams-herring-cart', 'decor/ams/ams-market-stall'],
  playerStart: { x: 48, y: G },
  checkpoints: [1200, 2400, 3100],
  timeLimit: 60,
  music: 'ams',
  ambience: 'env/ams-canal',
  vehicles: ['swan'],
  exits: [{ id: 'end', rect: { x: C_W - 28, y: 96, w: 24, h: 80 }, to: 'd', disabled: true }],
  script,
};
