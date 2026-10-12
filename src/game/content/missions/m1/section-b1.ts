/**
 * m1-b1 — Chimney Chase (upper route, GDD §11.1): 2400×216, scroll right, checkpoint 1240.
 * Rooftops with gaps (each has a spring awning that bounces a faller back up), chimneys that
 * Legion soldiers climb out of, laundry lines, a weather-vane secret ledge and a lock at the end;
 * the exit is a drainpipe slide down to the riverbank (→ c).
 */
import { PAL } from '../../../../engine/palette';
import { terrain, type BackgroundDef, type DecorDef, type SectionDef } from '../../../mission/index';
import { houseSprite } from './art';
import { at, crate, fromRight, fromTop, hostage, normalUp } from './helpers';

export const B1_W = 2400;

/** As m1-a, but the town roofs sit lower and further back (we are above them). */
const BG_ROOFS: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[2], PAL.sky[3], PAL.snow[2], PAL.gold[3]] }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.1, count: 5, ramp: [PAL.snow[1], PAL.snow[2], PAL.snow[3]] }, factorX: 0.1, driftX: 0.06 },
    { gen: 'hills', params: { y: 0.46, height: 0.3, ramp: [PAL.green[1], PAL.green[2], PAL.green[3]] }, factorX: 0.15 },
    { gen: 'treeline', params: { y: 0.56, height: 0.26, size: 8, ramp: [PAL.green[0], PAL.green[1], PAL.green[2]] }, factorX: 0.22 },
    { gen: 'town-rooftops', params: { y: 0.42, height: 0.44, tone: 1 }, factorX: 0.3, offsetY: 40 },
  ],
};

// ---------------------------------------------------------------------------------------------
// Terrain: roofs with gaps; spring awnings at y 196 across every gap.
// ---------------------------------------------------------------------------------------------

const t = terrain(B1_W, 216);
t.ground().at(0, 140).flat(380);
t.ground().at(420, 128).to(590, 104).to(760, 128); // a pitched roof
t.ground().at(800, 136).flat(440);
t.ground().at(1288, 120).flat(412);
t.ground().at(1744, 144).flat(256).to(2250, 176).to(2400, 176);
/** Gaps (x, w): a spring awning across each, a pit below it. */
export const B1_GAPS: readonly (readonly [number, number])[] = [
  [380, 40],
  [760, 40],
  [1240, 48],
  [1700, 44],
];
for (const [x, w] of B1_GAPS) t.hazard('pit', x, 200, w, 40);
t.solid(892, 108, 16, 28).solid(1032, 108, 16, 28).solid(1172, 108, 16, 28); // chimneys
t.platform(1340, 84, 120).platform(1500, 80, 120); // laundry lines
t.platform(1000, 56, 60); // weather-vane ledge (Helium Head from a chimney top)

const decor: DecorDef[] = [
  // House fronts under the roof edges (drawn in front: nothing walks below a roof line).
  { sprite: houseSprite(380, 70), frame: 1, x: 190, y: 216, front: true },
  { sprite: houseSprite(340, 82), frame: 0, x: 590, y: 216, front: true },
  { sprite: houseSprite(440, 74), frame: 1, x: 1020, y: 216, front: true },
  { sprite: houseSprite(412, 90), frame: 0, x: 1494, y: 216, front: true },
  { sprite: houseSprite(256, 66), frame: 1, x: 1872, y: 216, front: true },
  { sprite: 'decor/m1/chimney', x: 300, y: 140 },
  { sprite: 'decor/m1/chimney', x: 350, y: 140 },
  { sprite: 'decor/m1/antenna', x: 120, y: 140 },
  { sprite: 'decor/m1/antenna', x: 1100, y: 136 },
  { sprite: 'decor/m1/vane', x: 1030, y: 56 },
  { sprite: 'decor/m1/laundry-120', x: 1340, y: 84 },
  { sprite: 'decor/m1/laundry-120', x: 1500, y: 80 },
  { sprite: 'decor/m1/chimney', x: 1920, y: 144 },
  { sprite: 'decor/m1/drainpipe', x: 2392, y: 176 },
];

export const sectionB1: SectionDef = {
  id: 'b1',
  name: 'Chimney Chase',
  width: B1_W,
  height: 216,
  scroll: 'right',
  background: BG_ROOFS,
  terrain: t.build(),
  terrainStyle: { ground: 'concrete', edge: 'tiles', platform: 'wood', solid: 'brick' },
  decor,
  playerStart: { x: 40, y: 140 },
  checkpoints: [1240],
  exits: [{ id: 'drainpipe', rect: { x: 2380, y: 100, w: 20, h: 76 }, to: 'c', disabled: true }],
  *script(ctx) {
    // Spring awnings across the gaps (a fall bounces back up to roof height).
    for (const [x, w] of B1_GAPS) ctx.spawn('spring-awning', x + w / 2, 196, { w });

    at(ctx, 'rifleman', 300, { entry: 'chimney', facing: -1 }, 140);
    at(ctx, 'rifleman', 350, { entry: 'chimney', facing: -1 }, 140);

    yield ctx.waitCamera(180);
    crate(ctx, 450, 'M');
    at(ctx, 'piccolo', 590, { facing: -1 });
    fromRight(ctx, 'rifleman');
    yield 40;
    fromRight(ctx, 'rifleman');

    yield ctx.waitCamera(420);
    hostage(ctx, 'critic', 'chair', 700, 'H');
    at(ctx, 'triangle', 740, {
      gag: 'counting',
      facing: -1,
      alarm: [
        { id: 'rifleman', x: 900, y: 108, params: { entry: 'chimney' } },
        { id: 'rifleman', x: 1040, y: 108, params: { entry: 'chimney' } },
        { id: 'rifleman', x: 1180, y: 108, params: { entry: 'chimney' } },
      ],
    });

    yield ctx.waitCamera(640);
    fromRight(ctx, 'drummer', { facing: -1 });
    yield 50;
    fromRight(ctx, 'cymbalist', { facing: -1 });

    yield ctx.waitCamera(860);
    ctx.spawn('helium-tank', 960, 'ground');
    // Secret: notes and a gem on the weather-vane ledge.
    for (let i = 0; i < 5; i++) ctx.spawn('pickup-gem', 1006 + i * 9, 56, { kind: 'golden-note' });
    ctx.spawn('pickup-gem', 1052, 56, { kind: 'gem' });

    yield ctx.waitCamera(1000);
    at(ctx, 'rifleman', 1040, { entry: 'chimney', facing: -1 }, 108);
    yield 30;
    at(ctx, 'rifleman', 1180, { entry: 'chimney', facing: -1 }, 108);
    yield 30;
    at(ctx, 'rifleman', 1180, { entry: 'chimney', facing: -1 }, 108);
    if (normalUp(ctx)) at(ctx, 'piccolo', 1180, { facing: -1 }, 108);

    // @1240 (checkpoint): laundry lines.
    yield ctx.waitCamera(1240);
    at(ctx, 'rifleman', 1380, { gag: 'shine', facing: -1 }, 84);
    at(ctx, 'rifleman', 1560, { gag: 'shine', facing: -1 }, 80);
    at(ctx, 'oompah-trooper', 1560, { facing: -1 }, 120);
    crate(ctx, 1460, 'bombs', 120);

    yield ctx.waitCamera(1500);
    hostage(ctx, 'tea-lady', 'chair', 1640, 'auto');

    yield ctx.waitCamera(1700);
    for (const x of [1820, 1880, 1940]) {
      fromTop(ctx, 'rifleman', x, { entry: 'parachute' });
      yield 24;
    }
    if (normalUp(ctx)) fromTop(ctx, 'rifleman', 2000, { entry: 'parachute' });

    yield ctx.waitCamera(1900);
    hostage(ctx, 'tourist', 'sack', 2100, 'auto');

    // @2016: LOCK at the drainpipe.
    yield ctx.waitCamera(2016);
    ctx.lockCamera(2016, B1_W);
    at(ctx, 'baton-major', 2300, { facing: -1 }, 'ground', 'end');
    for (let i = 0; i < 3; i++) {
      fromRight(ctx, 'rifleman', {}, 16, 'end');
      yield 40;
    }
    if (normalUp(ctx)) fromRight(ctx, 'drummer', {}, 16, 'end');
    yield ctx.waitClear('end');
    ctx.enableExit('drainpipe');
    ctx.unlockCamera(false);
    ctx.callout('SLIDE DOWN THE DRAINPIPE →', { ticks: 150 });
  },
};

export const B1_IDS: readonly string[] = [
  'spring-awning', 'rifleman', 'crate', 'piccolo', 'hostage', 'triangle', 'drummer', 'cymbalist', 'helium-tank', 'pickup-gem',
  'oompah-trooper', 'baton-major',
];
