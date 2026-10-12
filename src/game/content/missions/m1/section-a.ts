/**
 * m1-a — Puddlewick Quay (GDD §11.1): 2560×216, scroll right, checkpoint 1400. Cobbled street,
 * the market square (y 160), the anthem tutorial, the bandstand, a secret roof ledge (composer +
 * golden record), the band truck, the crane cage and the Quay Gate fight that opens the route
 * choice: ROOFTOPS ↑ (the quay steps → b1) or DRAIN ↓ (the storm drain → b2).
 */
import { PAL } from '../../../../engine/palette';
import { SolidBox } from '../../../../engine/physics';
import { terrain, type BackgroundDef, type DecorDef, type SectionDef } from '../../../mission/index';
import { houseSprite } from './art';
import { M1Hatch } from './entities';
import { at, crate, fromLeft, fromRight, fromTop, G, hardOnly, hostage, normalUp } from './helpers';

export const A_W = 2560;

/** Puddlewick on a bright spring morning (GDD §11.1 m1-a background). */
export const BG_TOWN: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[2], PAL.sky[3], PAL.snow[2], PAL.gold[3]] }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.12, count: 4, ramp: [PAL.snow[1], PAL.snow[2], PAL.snow[3]] }, factorX: 0.1, driftX: 0.05 },
    { gen: 'hills', params: { y: 0.42, height: 0.3, ramp: [PAL.green[1], PAL.green[2], PAL.green[3]] }, factorX: 0.2 },
    { gen: 'treeline', params: { y: 0.5, height: 0.3, size: 9, ramp: [PAL.green[0], PAL.green[1], PAL.green[2]] }, factorX: 0.35 },
    { gen: 'town-rooftops', params: { y: 0.42, height: 0.44 }, factorX: 0.55 },
  ],
};

// ---------------------------------------------------------------------------------------------
// Terrain (GDD: ground().at(0,176).flat(600).slope(60,-16).flat(440).slope(60,16).flat(1204)
// .gap(32).flat(164); platforms `wood`, solids)
// ---------------------------------------------------------------------------------------------

const t = terrain(A_W, 216);
t.ground().at(0, G).flat(600).slope(60, -16).flat(440).slope(60, 16).flat(1204).gap(32).flat(164);
t.platform(420, 136, 56); // shop awning
t.platform(760, 128, 60); // triangle balcony
t.platform(1300, 132, 60); // awning
t.platform(1640, 112, 116); // bandstand roof
t.platform(1800, 120, 80); // roof awning
t.platform(2040, 92, 50); // chimney ledge
t.platform(1860, 56, 60); // secret roof ledge (Helium Head jump from the roof awning)
t.platform(2440, 140, 80); // quay steps
t.platform(2460, 100, 80);
t.solid(968, 140, 24, 20); // market crate
t.solid(1428, 136, 24, 40); // crate stack
t.solid(1650, 160, 96, 16); // bandstand base

/** The storm-drain hole (covered by the hatch until the Quay Gate fight ends). */
const DRAIN_X = 2364;
/** Top of the drain exit rect: low enough that the bot's exit goal lies > 24 px below the street. */
const DRAIN_EXIT_Y = 196;
/**
 * The drain shaft's floor: an invisible solid below the view (y 242, above killY 248). A player who
 * drops in takes the exit at y 196 long before it (the exit rect reaches down to it, so nobody can
 * stand there outside the exit); it only gives the drop a landing, so a planner
 * (the bot) sees "a safe drop" when it wants down and still "a gap" (no floor within 64 px) when
 * it only wants to cross the hole.
 */
const DRAIN_FLOOR_Y = 242;

const decor: DecorDef[] = [
  // Houses behind the street (drawn first: furthest back).
  { sprite: houseSprite(96, 72), frame: 1, x: 448, y: G },
  { sprite: houseSprite(100, 88), frame: 0, x: 790, y: 160 },
  { sprite: houseSprite(90, 80), frame: 0, x: 1335, y: G },
  { sprite: houseSprite(100, 120), frame: 1, x: 1630, y: G },
  { sprite: houseSprite(76, 120), frame: 1, x: 1890, y: G },
  { sprite: houseSprite(70, 84), frame: 0, x: 2065, y: G },
  { sprite: 'decor/m1/banner', x: 200, y: G },
  { sprite: 'decor/m1/awning-56', x: 420, y: 136 },
  { sprite: 'decor/m1/balcony', x: 760, y: 128 },
  { sprite: 'decor/m1/awning-60', x: 1300, y: 132 },
  { sprite: 'decor/m1/window', x: 1620, y: 100 },
  { sprite: 'decor/m1/window', x: 1660, y: 100 },
  { sprite: 'decor/m1/bandstand', x: 1698, y: 160 },
  { sprite: 'decor/m1/awning-80', x: 1800, y: 120 },
  { sprite: 'decor/m1/crane', x: 2186, y: G, flipX: true },
  { sprite: 'decor/m1/quay-steps', x: 2440, y: 100 },
  { sprite: 'decor/m1/crate', frame: 0, x: 980, y: 160, front: true },
  { sprite: 'decor/m1/crate', frame: 1, x: 1440, y: G, front: true },
  // Street furniture.
  { sprite: 'decor/m1/lamp', x: 112, y: G },
  { sprite: 'decor/m1/poster', x: 340, y: G },
  { sprite: 'decor/m1/flowers', x: 390, y: G },
  { sprite: 'decor/m1/lamp', x: 560, y: G },
  { sprite: 'decor/m1/ducks', x: 612, y: 172 },
  { sprite: 'decor/m1/flowers', x: 868, y: 160 },
  { sprite: 'decor/m1/poster', x: 1050, y: 160 },
  { sprite: 'decor/m1/ducks', x: 1130, y: 168 },
  { sprite: 'decor/m1/lamp', x: 1190, y: G },
  { sprite: 'decor/m1/poster', x: 1520, y: G },
  { sprite: 'decor/m1/lamp', x: 1590, y: G },
  { sprite: 'decor/m1/flowers', x: 1960, y: G },
  { sprite: 'decor/m1/lamp', x: 2000, y: G },
  { sprite: 'decor/m1/bollard', x: 2236, y: G },
  { sprite: 'decor/m1/ducks', x: 2320, y: G },
  { sprite: 'decor/m1/bollard', x: 2420, y: G },
];

export const sectionA: SectionDef = {
  id: 'a',
  name: 'Puddlewick Quay',
  width: A_W,
  height: 216,
  scroll: 'right',
  background: BG_TOWN,
  terrain: t.build(),
  terrainStyle: { ground: 'concrete', edge: 'tiles', platform: 'wood', solid: 'brick' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1400],
  exits: [
    // b1: the top of the quay steps; b2: the open drain (the player drops in).
    { id: 'rooftops', rect: { x: 2520, y: 40, w: 40, h: 60 }, to: 'b1', disabled: true },
    { id: 'drain', rect: { x: DRAIN_X, y: DRAIN_EXIT_Y, w: 32, h: DRAIN_FLOOR_Y + 6 - DRAIN_EXIT_Y }, to: 'b2', disabled: true, entry: { x: 40, y: 168 } },
  ],
  *script(ctx) {
    const hatch = ctx.spawn('m1-hatch', DRAIN_X, G, { w: 32 });
    // Wider than the hole (it lies under the street's ground): a walk-off with some drift lands on it.
    ctx.world.addSolid(new SolidBox(DRAIN_X - 16, DRAIN_FLOOR_Y, 32 + 64, 6));

    // @0: a card game, a kazoo player and the first weapon.
    ctx.spawn('card-table', 312, 'ground');
    at(ctx, 'rifleman', 300, { gag: 'cards', facing: 1 });
    at(ctx, 'rifleman', 324, { gag: 'cards', facing: -1 });
    at(ctx, 'rifleman', 520, { gag: 'kazoo', facing: -1 });
    crate(ctx, 470, 'M');

    yield ctx.waitCamera(160);
    for (let i = 0; i < 3; i++) {
      fromRight(ctx, 'rifleman');
      yield 40;
    }

    yield ctx.waitCamera(380);
    at(ctx, 'triangle', 790, { gag: 'counting', facing: -1 }, 128);
    at(ctx, 'rifleman', 700, { gag: 'rehearse', facing: -1 });
    at(ctx, 'rifleman', 730, { gag: 'rehearse', facing: -1 });

    yield ctx.waitCamera(560);
    hostage(ctx, 'critic', 'chair', 900, 'S');
    crate(ctx, 1010, 'bombs', 160);

    // @720: the PARADE COLUMN marches in from the right, in step, 28 px apart.
    yield ctx.waitCamera(720);
    const column = ['drummer', 'rifleman', 'rifleman', 'rifleman', 'cymbalist'];
    if (normalUp(ctx)) column.push('rifleman');
    column.forEach((id, i) => fromRight(ctx, id, { column: 'p1', march: 0.6 }, 16, 'column', i * 28));

    // @1000: the ANTHEM BREAK tutorial.
    yield ctx.waitCamera(1000);
    ctx.spawn('anthem-speaker', 1260, 'ground', { triggerX: 1180, facing: -1 });
    at(ctx, 'rifleman', 1300, { gag: 'shine', facing: -1 });
    at(ctx, 'rifleman', 1330, { gag: 'nap', facing: -1 });
    ctx.spawn('card-table', 1400, 'ground');
    at(ctx, 'rifleman', 1380, { gag: 'cards', facing: 1 });
    at(ctx, 'rifleman', 1420, { gag: 'cards', facing: -1 });
    ctx.world.scripts.run(function* anthemHint() {
      yield ctx.waitPlayerX(1180);
      ctx.callout('LEGION SOLDIERS MUST SALUTE THE ANTHEM!', { ticks: 150 });
    });

    // @1400 (checkpoint): the bandstand.
    yield ctx.waitCamera(1400);
    at(ctx, 'oompah-trooper', 1700, { facing: -1 }, 112);
    at(ctx, 'rifleman', 1620, { entry: 'window', facing: -1 }, 100);
    at(ctx, 'rifleman', 1660, { entry: 'window', facing: -1 }, 100);
    crate(ctx, 1560, 'M');

    yield ctx.waitCamera(1560);
    hostage(ctx, 'tourist', 'sack', 1780, 'auto');
    ctx.spawn('helium-tank', 1830, 'ground');
    // Secret roof ledge (Helium Head only): the composer and the golden record.
    hostage(ctx, 'composer', 'chair', 1880, '1up', 56);
    ctx.spawn('pickup-gem', 1905, 56, { kind: 'golden-record' });

    yield ctx.waitCamera(1700);
    at(ctx, 'piccolo', 2060, { facing: -1 }, 92);

    yield ctx.waitCamera(1900);
    const cargo: string[] = ['rifleman', 'rifleman', 'rifleman', 'cymbalist'];
    if (hardOnly(ctx)) cargo.push('baton-major');
    ctx.enter('band-truck', 'right', { margin: 48, params: { stopX: 2250, cargo } });

    yield ctx.waitCamera(2000);
    hostage(ctx, 'roadie', 'cage', 2140, 'R', 120, { ropeTop: 60 });

    // @2176: LOCK — the Quay Gate.
    yield ctx.waitCamera(2176);
    ctx.lockCamera(2176, A_W);
    at(ctx, 'baton-major', 2460, { facing: -1 }, 'ground', 'gate');
    ctx.spawn('rifleman', 2552, 'ground', { entry: 'walk', facing: -1, enter: 'right', tag: 'gate' });
    yield 30;
    ctx.spawn('rifleman', 2552, 'ground', { entry: 'walk', facing: -1, enter: 'right', tag: 'gate' });
    fromTop(ctx, 'rifleman', 2300, { entry: 'parachute' }, 'gate');
    yield 20;
    fromTop(ctx, 'rifleman', 2400, { entry: 'parachute' }, 'gate');
    if (normalUp(ctx)) fromLeft(ctx, 'cymbalist', {}, 16, 'gate');
    yield ctx.waitClear('gate');
    yield 30;
    // The drain hatch clanks open; a Legion head pops out and ducks back. Both routes open.
    if (hatch instanceof M1Hatch) hatch.open();
    yield 50;
    ctx.spawn('m1-sign', 2492, 100, { frame: 0 });
    ctx.spawn('m1-sign', 2420, G, { frame: 1 });
    ctx.enableExit('rooftops');
    ctx.enableExit('drain');
    ctx.unlockCamera(false);
    yield 90;
    ctx.callout('ROOFTOPS ↑  OR  DRAIN ↓', { ticks: 150 });
  },
};

/** Entities spawned by this section (for tests). */
export const A_IDS: readonly string[] = [
  'm1-hatch', 'm1-sign', 'card-table', 'rifleman', 'crate', 'triangle', 'hostage', 'drummer', 'cymbalist', 'anthem-speaker',
  'oompah-trooper', 'helium-tank', 'pickup-gem', 'piccolo', 'band-truck', 'baton-major',
];
