/**
 * m4-a — Avenue of Statues (GDD §11.4): 2800×216, scroll right, checkpoints 1200, 2100.
 *
 * Fanfaroni City at night: a straight avenue lined with the Marshal's statues (brick plinths
 * 32×40 with a knock-off `statue-head` each), wrought-iron balconies, lamp posts with crimson
 * pennants, the GRAND PARADE COLUMN, a triangle duet, and the plaza (LOCK 2416–2800) where the
 * mini-boss THE BIG HEAD floats in. The exit at the right edge leads to `b`.
 *
 * Secret: the high balcony (540–600, y 64) above the first statue holds the golden record; only a
 * Helium Head jump from the plinth top (y 136, 72 px below) reaches it — the helium tank stands
 * at 640, a few steps away.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { BG_AVENUE } from './backgrounds';
import { at, fromRight, G, roadRight, stage, waitBoss } from './helpers';

export const A_W = 2800;
/** The plaza (mini-boss arena). */
export const A_ARENA = { x0: 2416, x1: 2800 } as const;
/** Statue plinths: left x (32 wide, y 136–176). */
export const A_PLINTHS = [484, 1184, 1884] as const;
const PLINTH_Y = G - 40;
const BALCONY_Y = 120;
/** The high balcony (secret). */
export const A_HIGH = { x0: 540, x1: 600, y: 64 } as const;
/** The lamp post that holds the roadie's cage (its arm tip, x 2000, at y 60). */
const CAGE_POST_X = 1976;
/** THE BIG HEAD's spawn height (its centre: top edge at y 12). */
const BIG_HEAD_Y = 72;

const t = terrain(A_W, 216);
t.ground().at(0, G).flat(A_W);
for (const x of A_PLINTHS) t.solid(x, PLINTH_Y, 32, 40, 'brick');
for (const [x0, x1] of [[980, 1040], [1130, 1190], [1680, 1740]] as const) t.platform(x0, BALCONY_Y, x1 - x0);
t.platform(A_HIGH.x0, A_HIGH.y, A_HIGH.x1 - A_HIGH.x0);

const decor: DecorDef[] = [
  ...[120, 380, 860, 1320, 1560, 2240, 2560].map((x): DecorDef => ({ sprite: 'decor/m4/lamp-post', x, y: G })),
  { sprite: 'decor/m4/lamp-post', x: CAGE_POST_X, y: G },
  // Legion banners on the facades behind the balconies.
  ...[1002, 1152, 1702, 2460, 2740].map((x): DecorDef => ({ sprite: 'decor/m4/banner', x, y: 64 })),
];

export const sectionA: SectionDef = {
  id: 'a',
  name: 'Avenue of Statues',
  width: A_W,
  height: 216,
  scroll: 'right',
  background: BG_AVENUE,
  terrain: t.build(),
  terrainStyle: { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1200, 2100],
  timeLimit: 60,
  bossStart: { x: A_ARENA.x0 + 48, y: G },
  exits: [{ id: 'east', rect: { x: 2780, y: 0, w: 20, h: 216 }, to: 'b', disabled: true }],
  *script(ctx) {
    // The Marshal's statues: their heads can be knocked off onto the Legion (VANDALISM +500).
    for (const x of A_PLINTHS) ctx.spawn('statue-head', x + 16, PLINTH_Y);
    if (!ctx.bossRush) yield* avenue(ctx);
    yield* bigHead(ctx);
  },
};

/** The avenue rows before the plaza (skipped with ?boss=1). */
function* avenue(ctx: SectionContext): ScriptGen {
  // @0: three riflemen rehearse the anthem; a speaker; the first crate.
  for (const x of [300, 330, 360]) at(ctx, 'rifleman', x, { gag: 'rehearse', facing: -1 });
  at(ctx, 'crate', 200, { contains: 'M' });
  stage(ctx, 420, () => at(ctx, 'anthem-speaker', 420, { facing: -1 }));
  // @400: the helium tank and the golden record on the high balcony (both visible from 260 on).
  stage(ctx, 640, () => {
    at(ctx, 'helium-tank', 640);
    at(ctx, 'pickup-gem', 570, { kind: 'golden-record' }, A_HIGH.y);
  });
  // @560: a critic on a chair.
  stage(ctx, 760, () => at(ctx, 'hostage', 760, { kind: 'critic', bind: 'chair', drop: 'S' }));
  // @900: two piccolos prone on the balconies, a crate.
  stage(ctx, 1000, () => at(ctx, 'piccolo', 1000, { facing: -1 }, BALCONY_Y));
  stage(ctx, 1050, () => at(ctx, 'crate', 1050, { contains: 'H' }));
  stage(ctx, 1150, () => at(ctx, 'piccolo', 1150, { facing: -1 }, BALCONY_Y));
  // @1500: a mortar on the balcony; a tourist in a sack.
  stage(ctx, 1600, () => at(ctx, 'hostage', 1600, { kind: 'tourist', bind: 'sack', drop: 'auto' }));
  stage(ctx, 1700, () => at(ctx, 'gramophone-mortar', 1700, { facing: -1 }, BALCONY_Y));
  // @1700: the triangle duet (they ding together; one alarm calls six riflemen). The second
  // stands at 1872 (GDD 1880): at 1880 his body would overlap the statue plinth (1884).
  stage(ctx, 1850, () => {
    at(ctx, 'triangle', 1850, { gag: 'counting', duet: 'm4a', alarm: 6, facing: -1 });
    at(ctx, 'triangle', 1872, { gag: 'counting', duet: 'm4a', alarm: 6, facing: -1 });
  });
  // @1900: the roadie's cage hangs from the lamp post (rope top y 60).
  stage(ctx, 2000, () => at(ctx, 'hostage', CAGE_POST_X + 24, { kind: 'roadie', bind: 'cage', ropeTop: 62, drop: 'T' }, 128));
  // @2100: bombs.
  stage(ctx, 2300, () => at(ctx, 'crate', 2300, { contains: 'bombs' }));

  yield ctx.waitCamera(200);
  fromRight(ctx, 'drummer');
  yield 30;
  fromRight(ctx, 'rifleman');
  yield 24;
  fromRight(ctx, 'rifleman');

  yield ctx.waitCamera(700);
  roadRight(ctx, 'band-truck', { stopX: 1100, cargo: ['rifleman', 'rifleman', 'cymbalist', 'oompah-trooper'] }, 48);

  // @1200 GRAND PARADE COLUMN: they march in step behind the drummer (kill him first: the whole
  // column stumbles); the baton-major brings up the rear.
  yield ctx.waitCamera(1200);
  const order = ['drummer', 'rifleman', 'rifleman', 'rifleman', 'rifleman', 'oompah-trooper', 'baton-major'];
  const x0 = Math.min(ctx.camera.right + 16, A_W - 8);
  order.forEach((id, i) => at(ctx, id, Math.min(x0 + i * 26, A_W - 8), { column: 'parade', facing: -1, enter: 'right', gag: 'none' }));

  yield ctx.waitCamera(1700);
  for (let i = 0; i < 3; i++) {
    fromRight(ctx, 'rifleman');
    yield 30;
  }
  yield ctx.waitCamera(A_ARENA.x0);
}

/** @2416: the plaza lock, THE BIG HEAD, then the way to the boulevard. */
function* bigHead(ctx: SectionContext): ScriptGen {
  if (!ctx.bossRush) yield ctx.waitCamera(A_ARENA.x0);
  ctx.lockCamera(A_ARENA.x0, A_ARENA.x1);
  at(ctx, 'crate', 2440, { contains: 'R' });
  // It floats in from the right edge of the plaza (GDD §9.4: its top edge bobs y 4–20; the
  // anchor is the centre of the 160 × 120 head, bosses/m4/geom.ts).
  const boss = ctx.spawn('big-head', A_W - 8, BIG_HEAD_Y, { facing: -1, enter: 'right', arenaLeft: A_ARENA.x0 });
  yield ctx.bossIntro('THE BIG HEAD', { subtitle: 'HIS LOUDNESS IS WATCHING', music: 'mini-boss' });
  yield* waitBoss(boss);
  yield 60;
  ctx.music('m4', 60);
  ctx.unlockCamera();
  ctx.enableExit('east');
}

/** Every entity id this section spawns (tests). */
export const A_IDS = [
  'statue-head', 'rifleman', 'crate', 'anthem-speaker', 'helium-tank', 'pickup-gem', 'hostage', 'piccolo', 'gramophone-mortar',
  'triangle', 'drummer', 'band-truck', 'oompah-trooper', 'baton-major', 'cymbalist',
] as const;
