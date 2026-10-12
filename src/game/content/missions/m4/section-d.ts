/**
 * m4-d — The Opera House (GDD §11.4, boss §10.4): 1800×216, scroll right, checkpoints 1100, 1400.
 *
 * The lobby (ushers, a cloakroom queue, the critics' box), the auditorium with the organ pipes
 * and the orchestra pit, then the stage (LOCK 1400–1784, a wall at 1784–1800): the prop crate
 * step (one-way, 1500–1548, y 144), two balcony boxes (one-way, 1408–1480 and 1540–1612, y 108).
 * The curtain rises and THE GRAND GRAND walks on; its defeat completes the mission. The
 * chandeliers (x 1460, 1580, 1700) are the boss's props (`bosses/m4`).
 *
 * Secret: the cloakroom door (628–652, `breakable-wall`, behind the actors) hides the composer.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { BG_OPERA } from './backgrounds';
import { at, fromRight, G, stage, waitBoss } from './helpers';

export const D_W = 1800;
/** The stage (camera lock) and the wall at its right end. */
export const D_ARENA = { x0: 1400, x1: 1784 } as const;
/** The cloakroom door (a secret behind the actors). */
export const D_DOOR = { x: 640, w: 24, h: 48 } as const;
/** Stage furniture (GDD §10.4). */
export const D_STEP = { x0: 1500, x1: 1548, y: 144 } as const;
export const D_BOXES = [
  [1408, 1480],
  [1540, 1612],
] as const;
const BOX_Y = 108;
/** Where the boss walks on (its feet, the middle of the stage's right half). */
export const D_BOSS_X = 1690;

const t = terrain(D_W, 216);
t.ground().at(0, G).flat(D_W);
t.solid(D_ARENA.x1, 0, D_W - D_ARENA.x1, G, 'brick');
t.platform(D_STEP.x0, D_STEP.y, D_STEP.x1 - D_STEP.x0);
for (const [x0, x1] of D_BOXES) t.platform(x0, BOX_Y, x1 - x0);

const decor: DecorDef[] = [
  { sprite: 'decor/m4/sign', frame: 3, x: 600, y: G },
  { sprite: 'decor/m4/critics-box', x: 500, y: G },
  { sprite: 'decor/m4/pit-rail', x: 1300, y: G, front: true },
  { sprite: 'decor/m4/curtain', frame: 0, x: D_ARENA.x0, y: 0 },
  { sprite: 'decor/m4/curtain', frame: 1, x: D_ARENA.x1 - 28, y: 0 },
  ...[1004, 1092].map((x): DecorDef => ({ sprite: 'decor/m4/banner', x, y: 48 })),
];

export const sectionD: SectionDef = {
  id: 'd',
  name: 'The Opera House',
  width: D_W,
  height: 216,
  scroll: 'right',
  background: BG_OPERA,
  terrain: t.build(),
  terrainStyle: { ground: 'concrete', edge: 'tiles', platform: 'wood', solid: 'brick' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1100, D_ARENA.x0],
  timeLimit: 60,
  bossStart: { x: D_ARENA.x0 + 48, y: G },
  *script(ctx) {
    if (!ctx.bossRush) yield* lobby(ctx);
    yield* stageFight(ctx);
  },
};

/** The lobby and the auditorium (skipped with ?boss=1). */
function* lobby(ctx: SectionContext): ScriptGen {
  // @0: two ushers, two riflemen queueing for the cloakroom, bombs.
  at(ctx, 'usher-bot', 220, { patrol: 60, facing: -1 });
  at(ctx, 'crate', 300, { contains: 'bombs' });
  stage(ctx, 560, () => {
    at(ctx, 'usher-bot', 420, { patrol: 40, facing: -1 });
    at(ctx, 'rifleman', 560, { gag: 'queue', facing: 1 });
    at(ctx, 'rifleman', 590, { gag: 'queue', facing: 1 });
  });
  // @300: a critic in the critics' box; the cloakroom door hides the composer (1UP).
  stage(ctx, 500, () => at(ctx, 'hostage', 500, { kind: 'critic', bind: 'chair', drop: 'S' }));
  at(ctx, 'breakable-wall', D_DOOR.x, {
    w: D_DOOR.w,
    h: D_DOOR.h,
    solid: false,
    look: 'door',
    hp: 200,
    reveal: [{ id: 'hostage', x: 660, y: G, params: { kind: 'composer', bind: 'chair', drop: '1up' } }],
  });
  // @500: the organ pipes on the wall (y 100–164).
  stage(ctx, 800, () => ctx.spawn('pipe-battery', 800, 164));
  // @800: a tea lady.
  stage(ctx, 1000, () => at(ctx, 'hostage', 1000, { kind: 'tea-lady', bind: 'chair', drop: 'auto' }));
  // @1100: a triangle in the orchestra pit.
  stage(ctx, 1300, () => at(ctx, 'triangle', 1300, { gag: 'counting', facing: -1 }));

  yield ctx.waitCamera(500);
  for (let i = 0; i < 3; i++) {
    fromRight(ctx, 'rifleman');
    yield 30;
  }
  yield ctx.waitCamera(800);
  fromRight(ctx, 'usher-bot', { patrol: 40 });
  yield 30;
  fromRight(ctx, 'usher-bot', { patrol: 40 });
  yield 30;
  fromRight(ctx, 'drummer');
  yield ctx.waitCamera(1100);
  fromRight(ctx, 'rifleman');
  yield 30;
  fromRight(ctx, 'rifleman');
  yield 30;
  fromRight(ctx, 'cymbalist');
  yield ctx.waitCamera(D_ARENA.x0);
}

/** @1400: the stage lock, the crate, the curtain rises: THE GRAND GRAND; MISSION COMPLETE. */
function* stageFight(ctx: SectionContext): ScriptGen {
  if (!ctx.bossRush) yield ctx.waitCamera(D_ARENA.x0);
  ctx.lockCamera(D_ARENA.x0, D_ARENA.x1);
  at(ctx, 'crate', 1420, { contains: 'H' });
  const boss = ctx.spawn('grand-grand', D_BOSS_X, G, { facing: -1, arenaLeft: D_ARENA.x0 });
  yield ctx.bossIntro('THE GRAND GRAND', { subtitle: 'COUNTESS PIZZICATA REQUESTS YOUR SILENCE', music: 'boss' });
  yield* waitBoss(boss);
  yield 60;
  yield ctx.missionComplete();
}

/** Every entity id this section spawns (tests; the boss is checked on its own). */
export const D_IDS = ['usher-bot', 'crate', 'rifleman', 'hostage', 'breakable-wall', 'pipe-battery', 'triangle', 'drummer', 'cymbalist'] as const;
