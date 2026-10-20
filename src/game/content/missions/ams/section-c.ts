/**
 * ams-c — AMSTEL (docs/design/amsterdam.md §6, docs/design/ams-extras.md §4): 2608×216, scroll
 * right, golden late afternoon, vehicles: `swan`. The quay street (0–600), the long canal stretch
 * with six houseboats (water 600–1400: the Swan swims, on foot hop the decks y 164 and roofs
 * y 146), the shop quay (1400–2448) with the scan car arena at its end (lock 1984–2368), then the
 * fork: the white bridge's ramp UP (`BRUG ↑`, exit `brug` → `c1`) and the jetty steps DOWN to the
 * tour-boat pontoon (`RONDVAART ↓`, exit `rondvaart` → `c2`).
 *
 * Script: handhavers, gulls, boats, riders, two tourists, the scan car (`scanCarFight`, the
 * integrator's hook); both exits open after it.
 */
import { PAL } from '../../../../engine/palette';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import type { BackgroundDef, DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { hasEntity } from '../../../registry';
import { at, carillon, crate, fromRight, hostage, normalUp, prewarm } from './helpers';
import { placeSecrets, secretArt } from './secrets';
import { boatDecor, HOUSE, houseRow, waterDecor } from './art';
import { C_ARENA, C_BASIN, C_BASIN_Y, C_BOATS, C_CANAL, C_DECK_Y, C_PONTOON_Y, C_RAMP, C_STEPS_X, C_W, DECK_Y, G, ROOF_Y, terrainC } from './terrain';

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

/** The two route signs at the fork (decor/ams/route-sign frames). */
export const C_SIGN_BRUG_X = C_RAMP[0] - 32;
export const C_SIGN_RONDVAART_X = C_STEPS_X - 12;

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
  // --- quay street with shops, the scan car arena at its end ---
  ...houseRow('golden', 1400, [HOUSE.fietsen, HOUSE.step, HOUSE.koffie, HOUSE.bell, HOUSE.boeken, HOUSE.neckRed, HOUSE.flat, HOUSE.kaas, HOUSE.spout, HOUSE.bloemen]),
  ...houseRow('golden', 1928, [HOUSE.neck, HOUSE.bellCream, HOUSE.stepBrown, HOUSE.koffie, HOUSE.spout, HOUSE.step, HOUSE.bell, HOUSE.flat, HOUSE.neckRed, HOUSE.bloemen]),
  { sprite: 'decor/ams/lamp', x: 1480, y: G },
  { sprite: 'decor/ams/tulips', x: 1600, y: G, animate: 12 },
  { sprite: 'decor/ams/lamp', x: 1760, y: G },
  { sprite: 'decor/ams/flag-nl', x: 1880, y: G, animate: true },
  { sprite: 'decor/ams/lamp', x: 2000, y: G },
  { sprite: 'decor/ams/tulips', x: 2120, y: G, animate: 10 },
  { sprite: 'decor/ams/lamp', x: 2250, y: G },
  { sprite: 'decor/ams/flag-ams', x: 2330, y: G, animate: 13 },
  // --- the fork: the tour boat waits at the pontoon, the white bridge rises over it ---
  ...waterDecor(C_BASIN[0], C_BASIN[1], C_BASIN_Y),
  { sprite: 'decor/ams/ams-cruise-boat', frame: 0, x: C_BASIN[0] + 6, y: C_PONTOON_Y },
  { sprite: 'decor/ams/white-bridge', x: C_RAMP[1], y: C_DECK_Y },
  { sprite: 'decor/ams/white-portal', x: C_RAMP[1] + 104, y: C_DECK_Y },
  { sprite: 'decor/ams/route-sign', frame: 0, x: C_SIGN_BRUG_X, y: G },
  { sprite: 'decor/ams/route-sign', frame: 1, x: C_SIGN_RONDVAART_X, y: G },
  // --- front ---
  { sprite: 'decor/ams/bollard', x: 560, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 576, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 1420, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 1540, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 1820, y: G, front: true },
  { sprite: 'decor/ams/bollard', x: 1964, y: G, front: true },
  { sprite: 'decor/ams/bike-rack', x: 2200, y: G, front: true },
  { sprite: 'decor/ams/pontoon', x: C_BASIN[0], y: C_PONTOON_Y + 1, front: true },
];

/**
 * The city life of section c (cosmetic, sleeps off-screen): pigeons, window wavers, ducks in the
 * jetty basin. Call it at the start of `script`.
 */
export function life(ctx: SectionContext): void {
  ctx.spawn('ams-pigeons', 300, G, { count: 4 });
  ctx.spawn('ams-pigeons', 1700, G, { count: 5 });
  ctx.spawn('ams-pigeons', 2140, G, { count: 3 });
  ctx.spawn('ams-ducks', C_BASIN[0] + 60, C_BASIN_Y, { count: 2, range: 40 });
  ctx.spawn('ams-window-waver', 1560, 100, {});
  ctx.spawn('ams-window-waver', 1830, 92, { look: 'cat' });
  ctx.spawn('ams-window-waver', 2090, 96, {});
}

/** Lamp top (a perched gull's feet) of a `decor/ams/lamp` on the ground line. */
const LAMP_TOP = G - 70;

/** The repair crate after the scan car (between the arena and the bridge ramp). */
export const C_REPAIR_X = 2384;

/** The scan car's tag (the hook waits for it). */
export const SCAN_TAG = 'scan-car';

/**
 * INTEGRATOR HOOK — the parking scan car (docs/design/ams-extras.md §3): the camera locks on the
 * end of the shop quay (`C_ARENA`, one view wide); when `ams-scan-car` is registered it drives in
 * from the right and the hook waits until it is beaten (its tag `SCAN_TAG`, or `Boss.defeated`);
 * without it the fight is skipped. Then the lock opens and both exits open (`openFork`).
 */
export function* scanCarFight(ctx: SectionContext): ScriptGen {
  ctx.lockCamera(C_ARENA[0], C_ARENA[1]);
  if (hasEntity('ams-scan-car')) {
    // The arena is fixed (never the camera's left while it still eases into the lock): the car
    // always parks inside the locked view.
    const car = ctx.spawn('ams-scan-car', C_ARENA[1] + 40, 'ground', { facing: -1, tag: SCAN_TAG, arenaLeft: C_ARENA[0], arenaW: C_ARENA[1] - C_ARENA[0] });
    yield () => (car instanceof Boss && car.defeated) || ctx.world.countAlive(SCAN_TAG) === 0;
    yield 60;
  }
  ctx.unlockCamera(false);
}

/** Open both routes: BRUG ↑ (up the ramp → c1) and RONDVAART ↓ (down the jetty steps → c2). */
export function openFork(ctx: SectionContext): void {
  ctx.enableExit('brug');
  ctx.enableExit('rondvaart');
  ctx.showGo();
  ctx.callout('BRUG ↑  OF  RONDVAART ↓', { ticks: 180 });
}

/**
 * ams-c: the handhavers arrive, the canal with houseboats and little boats (the Swan swims), the
 * shop quay, the scan car; then the route choice.
 */
export function* script(ctx: SectionContext): ScriptGen {
  prewarm('npc/ams/', 'decor/ams/');
  life(ctx);
  carillon(ctx);
  // Secrets (docs/design/ams-extras.md §5): the bike fished out of the canal, at the lamp post.
  placeSecrets(ctx, 'c');
  // Little open boats to hop on along the canal, more life on the quays.
  ctx.spawn('ams-boat-platform', 640, 172, { range: 300, speed: 0.5 });
  ctx.spawn('ams-boat-platform', 1080, 172, { range: 290, speed: 0.45, dir: -1 });

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

  // @1640: the end of the shop quay: a last squad before the arena. The arena's far edge stands
  // from here (a body wall): a player who runs ahead of the squad stays on the quay inside the
  // arena's view, never down the jetty steps before the lock.
  yield ctx.waitCamera(1640);
  const edge = ctx.bodyWall(C_ARENA[1] - 8, { keep: 'left' });
  crate(ctx, 1980, 'bombs');
  at(ctx, 'seagull', 2000, { perch: true }, LAMP_TOP);
  fromRight(ctx, 'fatbike-youth', {}, 16, 'quay');
  yield 70;
  fromRight(ctx, 'handhaver', {}, 16, 'quay');
  ctx.spawn('delivery-rider', 0, 'ground', { from: 'behind', tag: 'quay' });
  yield ctx.waitClear('quay');

  // @1984 (checkpoint 2176): LOCK — the scan car arena on the shop quay.
  yield ctx.waitCamera(C_ARENA[0] - 24);
  yield* scanCarFight(ctx);
  edge.remove();
  // A repair crate after the scan car (docs/design/ams-extras.md §6), by the fork.
  crate(ctx, C_REPAIR_X, 'repair');
  openFork(ctx);
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
  // The scan car (bosses/ams-scan: a mid-boss, section art here only) and the secret.
  art: ['enemy/fatbike-youth-pair', ...new Set(decor.map((d) => d.sprite)), 'decor/ams/ams-boat-platform', 'decor/ams/ams-herring-cart', 'decor/ams/ams-market-stall', 'boss/ams-scan/', ...secretArt('c')],
  // Tier 4: what shows only from the shop quay on (x 1400+) is not built ahead in b.
  artLate: ['decor/ams/house-golden', 'decor/ams/ams-market-stall', 'decor/ams/ams-cruise-boat', 'decor/ams/white-bridge', 'decor/ams/white-portal', 'decor/ams/route-sign', 'decor/ams/pontoon'],
  playerStart: { x: 48, y: G },
  checkpoints: [1200, C_ARENA[0] + 192],
  timeLimit: 60,
  music: 'ams',
  ambience: 'env/ams-canal',
  vehicles: ['swan'],
  exits: [
    // RONDVAART ↓: down the jetty steps, onto the pontoon (y 188; the whole pontoon is the exit:
    // stepping on board the waiting tour boat). First in the list: a Swan on the pontoon also
    // reaches up into the BRUG rect.
    { id: 'rondvaart', rect: { x: C_BASIN[0], y: 164, w: C_W - 4 - C_BASIN[0], h: 34 }, to: 'c2', disabled: true },
    // BRUG ↑: the top of the ramp, on the white bridge deck (y 152).
    { id: 'brug', rect: { x: C_W - 28, y: 100, w: 24, h: 56 }, to: 'c1', disabled: true },
  ],
  script,
};
