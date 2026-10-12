/**
 * m4-c2 — Billboard Rooftops (upper route; GDD §11.4): 2400×216, scroll right, checkpoint 1000.
 *
 * Five rooftops (ground pieces at y 140–156) over the dark streets; every gap has a safety-net
 * `spring-awning` at y 206 that throws a faller back up. Billboards of the Grand Marshal stand
 * on the roofs (their tops are one-way platforms at y 96), a giant billboard (top y 40, the
 * secret: only a Helium Head jump from the first billboard reaches it), two water towers (solid
 * 32×48, standable tops), kazoo drones, copters, a piano bomber and the end lock (2016–2400).
 * The exit at the right edge is the zip-line down to the Opera House roof (`d`).
 *
 * Layout notes (reported): the roadie's cage hangs from a lamp post on the roof at 1476 (its arm
 * tip is x 1500, y 28) instead of a billboard: no billboard stands at 1500.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { BG_ROOFTOPS } from './backgrounds';
import { at, fromRight, fromTop, normalUp, stage } from './helpers';

export const C2_W = 2400;
/** Rooftops [x0, x1, y]. */
export const C2_ROOFS = [
  [0, 400, 150],
  [440, 900, 140],
  [944, 1400, 156],
  [1440, 1900, 144],
  [1948, 2400, 150],
] as const;
/** Billboard tops (one-way, y 96) [x0, x1]. */
export const C2_BILLBOARDS = [
  [560, 640],
  [1100, 1180],
  [1560, 1640],
] as const;
const BOARD_Y = 96;
/** The giant billboard top (secret). */
export const C2_GIANT = { x0: 700, x1: 800, y: 40 } as const;
/** Water towers [x, top y] (32×48). */
export const C2_TOWERS = [
  [1000, 108],
  [1700, 96],
] as const;
/** The safety nets' bounce surface. */
const NET_Y = 206;
/** The end lock. */
export const C2_ARENA = { x0: 2016, x1: 2400 } as const;

const t = terrain(C2_W, 216);
for (const [x0, x1, y] of C2_ROOFS) t.ground().at(x0, y).flat(x1 - x0);
for (const [x0, x1] of C2_BILLBOARDS) t.platform(x0, BOARD_Y, x1 - x0);
t.platform(C2_GIANT.x0, C2_GIANT.y, C2_GIANT.x1 - C2_GIANT.x0);
for (const [x, y] of C2_TOWERS) t.solid(x, y, 32, 48, 'brick');

/** The roof under x (feet y). */
function roofY(x: number): number {
  for (const [x0, x1, y] of C2_ROOFS) if (x >= x0 && x <= x1) return y;
  return 150;
}

const decor: DecorDef[] = [
  { sprite: 'decor/m4/billboard-44', x: 560, y: BOARD_Y },
  { sprite: 'decor/m4/billboard-100', x: 700, y: C2_GIANT.y },
  { sprite: 'decor/m4/billboard-60', x: 1100, y: BOARD_Y },
  { sprite: 'decor/m4/billboard-48', x: 1560, y: BOARD_Y },
  // Drawn in front of the terrain's solid block (players only ever stand on its top).
  ...C2_TOWERS.map(([x, y]): DecorDef => ({ sprite: 'decor/m4/water-tower', x, y, front: true })),
  { sprite: 'decor/m4/lamp-post', x: 1476, y: roofY(1476) },
  { sprite: 'decor/m4/lamp-post', x: 260, y: roofY(260) },
  { sprite: 'decor/m4/zip-pole', x: 2372, y: roofY(2372) },
  { sprite: 'decor/m4/sign', frame: 5, x: 2330, y: roofY(2330) },
];

export const sectionC2: SectionDef = {
  id: 'c2',
  name: 'Billboard Rooftops',
  width: C2_W,
  height: 216,
  scroll: 'right',
  background: BG_ROOFTOPS,
  terrain: t.build(),
  terrainStyle: { ground: 'metal', edge: 'rust', platform: 'metal', solid: 'brick' },
  decor,
  playerStart: { x: 48, y: 150 },
  checkpoints: [1000],
  timeLimit: 60,
  exits: [{ id: 'zipline', rect: { x: 2380, y: 0, w: 20, h: 216 }, to: 'd', disabled: true }],
  *script(ctx) {
    // Safety nets in every gap between the roofs.
    for (let i = 0; i + 1 < C2_ROOFS.length; i++) {
      const x0 = C2_ROOFS[i][1];
      const x1 = C2_ROOFS[i + 1][0];
      ctx.spawn('spring-awning', (x0 + x1) / 2, NET_Y, { variant: 'net', w: x1 - x0 });
    }
    if (!ctx.bossRush) yield* roofs(ctx);
    yield ctx.waitCamera(C2_ARENA.x0);
    ctx.lockCamera(C2_ARENA.x0, C2_ARENA.x1);
    const cam = ctx.camera;
    ctx.spawn('kazoo-drone', cam.right + 16, cam.top + 140, { formation: 'loop', shooter: 2, facing: -1, tag: 'end' });
    for (let i = 0; i < 2; i++) {
      fromRight(ctx, 'rifleman', {}, 16, 'end');
      yield 40;
    }
    ctx.enter('baton-copter', 'right', { margin: 32, tag: 'end' });
    yield 180;
    ctx.spawn('kazoo-drone', cam.left - 16, cam.top + 150, { formation: 'loop', shooter: 2, facing: 1, tag: 'end' });
    yield 60;
    yield ctx.waitClear('end');
    ctx.unlockCamera();
    ctx.enableExit('zipline');
  },
};

/** The rooftop rows (skipped with ?boss=1). */
function* roofs(ctx: SectionContext): ScriptGen {
  // Standing placements, staged just before they scroll into view.
  for (const x of [250, 300]) at(ctx, 'rifleman', x, { facing: -1 }, roofY(x));
  stage(ctx, 600, () => at(ctx, 'crate', 600, { contains: 'L' }, BOARD_Y));
  stage(ctx, 620, () => {
    at(ctx, 'helium-tank', 620, {}, BOARD_Y);
    // Secret: five golden notes and a gem on the giant billboard top.
    for (let i = 0; i < 5; i++) at(ctx, 'pickup-gem', 716 + i * 14, { kind: 'golden-note' }, C2_GIANT.y);
    at(ctx, 'pickup-gem', 788, { kind: 'gem' }, C2_GIANT.y);
  });
  stage(ctx, 860, () => at(ctx, 'hostage', 860, { kind: 'critic', bind: 'chair', drop: 'R' }, roofY(860)));
  stage(ctx, 1140, () => at(ctx, 'piccolo', 1140, { facing: -1 }, BOARD_Y));
  stage(ctx, 1500, () => at(ctx, 'hostage', 1500, { kind: 'roadie', bind: 'cage', ropeTop: 30, drop: 'M' }, 104));
  stage(ctx, 1600, () => at(ctx, 'piccolo', 1600, { facing: -1 }, BOARD_Y));
  stage(ctx, 1716, () => at(ctx, 'gramophone-mortar', 1716, { facing: -1 }, C2_TOWERS[1][1]));

  // @0: a kazoo-drone V.
  yield 60;
  ctx.spawn('kazoo-drone', ctx.camera.right + 16, 60, { formation: 'v', shooter: 2, facing: -1 });

  yield ctx.waitCamera(300);
  ctx.enter('baton-copter', 'right', { margin: 32 });

  yield ctx.waitCamera(700);
  ctx.enter('piano-bomber', 'right', { y: 32 });

  yield ctx.waitCamera(1000);
  ctx.spawn('kazoo-drone', ctx.camera.right + 16, 70, { formation: 'sine', shooter: 2, facing: -1 });

  yield ctx.waitCamera(1600);
  ctx.enter('baton-copter', 'right', { margin: 32 });
  if (normalUp(ctx)) {
    yield 90;
    ctx.enter('baton-copter', 'right', { margin: 32 });
  }
  for (const x of [1760, 1820, 1880]) {
    fromTop(ctx, 'rifleman', x, { entry: 'parachute' });
    yield 30;
  }
}

/** Every entity id this section spawns (tests). */
export const C2_IDS = [
  'spring-awning', 'kazoo-drone', 'rifleman', 'baton-copter', 'crate', 'helium-tank', 'pickup-gem', 'piano-bomber', 'hostage', 'piccolo',
  'gramophone-mortar',
] as const;
