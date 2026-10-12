/**
 * m1-b2 — Storm Drain (lower route, GDD §11.1): 2400×216, scroll right, checkpoint 1100. A low
 * brick tunnel (ceiling y 0–40): a walkway at y 168 broken by three water channels with grates
 * (y 128) and rubber duck floats, wind-up bots, bullfrogs, ceiling metronomes, the Rubber Duck
 * Stampede, and an overflow chamber lock; the exit is a manhole above the last grate step (→ c).
 */
import { PAL } from '../../../../engine/palette';
import { terrain, type BackgroundDef, type DecorDef, type SectionDef } from '../../../mission/index';
import { at, crate, fromRight, hostage, normalUp, waterDecor, WATER_Y } from './helpers';

export const B2_W = 2400;
/** Walkway level. */
const W = 168;
/** Water channels (x0, x1). */
export const B2_CHANNELS: readonly (readonly [number, number])[] = [
  [420, 520],
  [900, 1040],
  [1500, 1620],
];

const BG_DRAIN: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'sewer-brick', params: { dark: true, arch: 128 }, factorX: 0.2 },
    { gen: 'sewer-brick', params: { arch: 96 }, factorX: 0.4 },
  ],
};

const t = terrain(B2_W, 216);
t.solid(0, 0, B2_W, 40); // the tunnel ceiling
t.ground().at(0, W).flat(420).gap(100).flat(380).gap(140).flat(460).gap(120).flat(780);
for (const [x0, x1] of B2_CHANNELS) {
  t.hazard('water', x0, WATER_Y, x1 - x0, 216 - WATER_Y);
  t.platform(x0, 128, x1 - x0); // grate over the channel
}
t.platform(2290, 144, 40).platform(2340, 120, 60); // grate steps to the manhole

const decor: DecorDef[] = [
  { sprite: 'decor/m1/pipe-run', x: 0, y: 58 },
  { sprite: 'decor/m1/pipe-run', x: 600, y: 64 },
  { sprite: 'decor/m1/pipe-run', x: 1300, y: 58 },
  { sprite: 'decor/m1/pipe-run', x: 1900, y: 62 },
  { sprite: 'decor/m1/sluice', x: 1180, y: W },
  { sprite: 'decor/m1/pipe-mouth', x: 1450, y: 40 },
  { sprite: 'decor/m1/pipe-mouth', x: 2150, y: 40 },
  { sprite: 'decor/m1/pipe-mouth', x: 2250, y: 40 },
  { sprite: 'decor/m1/pipe-mouth', x: 2330, y: 40 },
  { sprite: 'decor/m1/ladder', x: 2378, y: 120 },
  ...B2_CHANNELS.flatMap(([x0, x1]) => waterDecor(x0, x1)),
];

export const sectionB2: SectionDef = {
  id: 'b2',
  name: 'Storm Drain',
  width: B2_W,
  height: 216,
  scroll: 'right',
  background: BG_DRAIN,
  terrain: t.build(),
  terrainStyle: { ground: 'concrete', edge: 'moss', platform: 'metal', solid: 'brick' },
  decor,
  playerStart: { x: 40, y: W },
  checkpoints: [1100],
  exits: [{ id: 'manhole', rect: { x: 2360, y: 60, w: 40, h: 60 }, to: 'c', disabled: true }],
  *script(ctx) {
    // The players land in a puddle.
    ctx.spawn('fx-splash', 40, W, { count: 8 });
    ctx.world.audio.sfx('env/water-splash');

    for (let i = 0; i < 4; i++) fromRight(ctx, 'windup-bot', { facing: -1 }, 16, undefined, i * 20);

    yield ctx.waitCamera(200);
    at(ctx, 'bullfrog', 380, { facing: 1 });
    at(ctx, 'bullfrog', 540, { facing: -1 });
    ctx.spawn('duck-float', 470, WATER_Y, { drift: 34 });

    yield ctx.waitCamera(400);
    ctx.spawn('metronome-turret', 700, 40);
    crate(ctx, 640, 'F');

    yield ctx.waitCamera(560);
    hostage(ctx, 'critic', 'chair', 780, 'S');
    ctx.enter('rifleman', 'right', { margin: 16, y: W });
    yield 40;
    ctx.enter('rifleman', 'right', { margin: 16, y: W });

    yield ctx.waitCamera(760);
    ctx.spawn('duck-float', 940, WATER_Y, { drift: 30 });
    ctx.spawn('duck-float', 1000, WATER_Y, { drift: 30, dir: -1 });
    at(ctx, 'bullfrog', 980, { facing: -1 }, 128);
    for (let i = 0; i < 5; i++) fromRight(ctx, 'windup-bot', { facing: -1 }, 16, undefined, i * 20);

    // @1100 (checkpoint): the Rubber Duck Stampede (cosmetic).
    yield ctx.waitCamera(1100);
    ctx.spawn('m1-duck-rush', ctx.camera.right + 12, W - 2, { count: 8 });
    ctx.spawn('metronome-turret', 1240, 40);
    ctx.spawn('metronome-turret', 1400, 40);
    crate(ctx, 1300, 'bombs');

    yield ctx.waitCamera(1300);
    hostage(ctx, 'roadie', 'cage', 1450, 'B', 110, { ropeTop: 40 });

    yield ctx.waitCamera(1460);
    ctx.spawn('duck-float', 1560, WATER_Y, { drift: 40 });
    at(ctx, 'bullfrog', 1660, { facing: -1 });
    at(ctx, 'bullfrog', 1700, { facing: -1 });

    yield ctx.waitCamera(1700);
    for (let i = 0; i < 6; i++) fromRight(ctx, 'windup-bot', { facing: -1 }, 16, undefined, i * 20);
    if (normalUp(ctx)) {
      yield 60;
      ctx.enter('rifleman', 'right', { margin: 16, y: W });
      yield 40;
      ctx.enter('rifleman', 'right', { margin: 16, y: W });
    }

    yield ctx.waitCamera(1900);
    hostage(ctx, 'tea-lady', 'chair', 2080, 'auto');

    // @2016: LOCK — the overflow chamber.
    yield ctx.waitCamera(2016);
    ctx.lockCamera(2016, B2_W);
    for (const x of [2150, 2250, 2330]) {
      ctx.spawn('bullfrog', x, 46, { enter: 'top', facing: -1, tag: 'end' });
      yield 30;
    }
    // GDD @2200; at 2152 it hangs over the arena hold spot, where a player shooting straight up from
    // the chamber's left half (and the bot) can reach it.
    if (normalUp(ctx)) ctx.spawn('metronome-turret', 2152, 40, { tag: 'end' });
    yield ctx.waitClear('end');
    ctx.enableExit('manhole');
    ctx.unlockCamera(false);
    ctx.callout('UP THE LADDER ↑', { ticks: 150 });
  },
};

export const B2_IDS: readonly string[] = [
  'fx-splash', 'windup-bot', 'bullfrog', 'duck-float', 'metronome-turret', 'crate', 'hostage', 'rifleman', 'm1-duck-rush',
];
