/**
 * m2-c1 — Canyon Floor, the lower route (GDD §11.2): 2200×216, scroll right, checkpoint 900,
 * vehicles allowed: `sundae-driver`.
 *
 * The canyon floor at y 176 with a ramp up to a 152 shelf (rolling drums come down it) under an
 * overhang, a low cave the van still fits through, two rock ledges, and a closing ambush in a
 * camera lock before the exit to the quarry (`d`).
 */
import type { DecorDef, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { SIGN } from './art';
import { BG_CANYON } from './backgrounds';
import { at, fromRight, fromTop, G, normalUp, stage, VAN } from './helpers';

export const C1_W = 2200;
/** The closing ambush (camera lock). */
const LOCK_X = 1816;
/** Rock ledges (one-way, y 120). */
const LEDGE_Y = 120;

const t = terrain(C1_W, 216);
// Floor 176; a 1:8 ramp (400,176) → (600,152), the shelf to 700, back down to 176 at 760.
t.ground().at(0, G).flat(400).slope(200, -24).flat(100).slope(60, 24).flat(C1_W - 760);
// The overhang over the ramp and the cave ceiling (the van, 68 px with its cone, fits under 100).
t.solid(300, 0, 200, 60, 'rock');
t.solid(900, 0, 400, 100, 'rock');
// Rock ledges (the first ends before the cave ceiling).
t.platform(780, LEDGE_Y, 100);
t.platform(1650, LEDGE_Y, 110);

const decor: DecorDef[] = [
  { sprite: 'decor/m2/skull', x: 140, y: G },
  { sprite: 'decor/m2/cactus', x: 360, y: G },
  { sprite: 'decor/m2/skull', x: 1180, y: G },
  { sprite: 'decor/m2/cactus', x: 1390, y: G },
  { sprite: 'decor/m2/skull', x: 1940, y: G },
  { sprite: 'decor/m2/sign', frame: SIGN.quarry, x: 2150, y: G },
];

export const sectionC1: SectionDef = {
  id: 'c1',
  name: 'Canyon Floor',
  width: C1_W,
  height: 216,
  scroll: 'right',
  background: BG_CANYON,
  terrain: t.build(),
  terrainStyle: { ground: 'rock', edge: 'sand', platform: 'rock', solid: 'rock' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [900],
  timeLimit: 60,
  vehicles: [VAN],
  exits: [{ id: 'east', rect: { x: C1_W - 20, y: 0, w: 20, h: 216 }, to: 'd', disabled: true }],
  *script(ctx) {
    // Standing placements of the rows, staged just before they scroll into view.
    stage(ctx, 820, () => {
      at(ctx, 'hostage', 820, { kind: 'critic', bind: 'chair', drop: 'M' });
      at(ctx, 'bassoonist', 830, { facing: -1 }, LEDGE_Y);
    });
    stage(ctx, 1450, () => {
      at(ctx, 'hostage', 1450, { kind: 'tea-lady', bind: 'chair', drop: 'auto' });
      for (const x of [1500, 1550, 1600]) at(ctx, 'rattler', x);
    });
    stage(ctx, 1700, () => at(ctx, 'gramophone-mortar', 1700, undefined, LEDGE_Y));
    at(ctx, 'rattler', 200);
    at(ctx, 'rattler', 260);
    at(ctx, 'crate', 300, { contains: 'L' });

    yield ctx.waitCamera(250);
    fromRight(ctx, 'cymbalist');
    yield 30;
    fromRight(ctx, 'cymbalist');
    yield 30;
    fromRight(ctx, 'rifleman', { entry: 'walk' });
    yield 30;
    fromRight(ctx, 'rifleman', { entry: 'walk' });

    yield ctx.waitCamera(450);
    // Three drums roll in from the right and down the ramp, 60 ticks apart.
    for (let i = 0; i < 3; i++) {
      fromRight(ctx, 'rolling-drum', { dir: -1 });
      yield 60;
    }

    yield ctx.waitCamera(900);
    // In the cave: a line of five wind-up bots and a tank.
    const x0 = ctx.camera.right + 16;
    for (let i = 0; i < 5; i++) at(ctx, 'windup-bot', x0 + i * 20, { facing: -1 });
    fromRight(ctx, 'oompah-tank', { stopX: 1250 }, 48);

    yield ctx.waitCamera(1500);
    for (const x of [1600, 1660, 1720]) {
      fromTop(ctx, 'rifleman', x, { entry: 'parachute' });
      yield 12;
    }

    // The closing ambush.
    yield ctx.waitCamera(LOCK_X);
    ctx.lockCamera(LOCK_X, C1_W);
    const wave = ['rifleman', 'drummer', 'rifleman', 'rifleman', 'drummer', 'rifleman'];
    for (const id of wave) {
      fromRight(ctx, id, undefined, 16, 'ambush');
      yield 36;
    }
    if (normalUp(ctx)) fromRight(ctx, 'oompah-trooper', undefined, 16, 'ambush');
    yield ctx.waitClear('ambush');
    ctx.unlockCamera();
    ctx.enableExit('east');
    ctx.showGo();
  },
};
