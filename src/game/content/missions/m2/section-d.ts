/**
 * m2-d — The Drum Quarry (GDD §11.2, boss §10.2): 2000×216, scroll right, checkpoints 1000,
 * 1600, vehicles allowed: `sundae-driver`.
 *
 * The quarry floor at y 176 with two steel scaffolds, a cracked quarry wall that hides the
 * composer and the golden record, a band-truck, then the arena (LOCK 1600–1984: two sandstone
 * ledges at y 132, the quarry wall at 1984–2000) where THE BA-DUM BEHEMOTH rolls in from the
 * right. Its defeat completes the mission.
 *
 * Layout notes (reported): the arena ledges are one-way platforms in the section's platform
 * material (`metal`: a section has one platform material), so they read as steel, not sandstone;
 * the boss spawns at the quarry wall (x 1990) and drives itself to its patrol band.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { Boss } from '../../../boss';
import { BEHEMOTH } from '../../bosses/m2/geom';
import { BG_QUARRY } from './backgrounds';
import { at, fromRight, G, stage, VAN, vehiclesOf, waitBoss } from './helpers';

export const D_W = 2000;
/** The boss arena (camera lock) and the quarry wall at its right end. */
export const D_ARENA = { x0: 1600, x1: 1984 } as const;
/** The cracked quarry wall (a secret behind the actors). */
export const D_WALL = { x: 640, w: 24, h: 48 } as const;
const SCAFFOLD_Y = 120;

const t = terrain(D_W, 216);
t.ground().at(0, G).flat(D_W);
// Steel scaffolds.
t.platform(760, SCAFFOLD_Y, 120);
t.platform(1240, SCAFFOLD_Y, 100);
// The arena: two sandstone ledges and the quarry wall at the right end.
t.platform(1624, 132, 64);
t.platform(1740, 132, 64);
t.solid(D_ARENA.x1, 0, D_W - D_ARENA.x1, G, 'rock');

const decor: DecorDef[] = [
  { sprite: 'decor/m2/skull', x: 200, y: G },
  { sprite: 'decor/m2/parasol', x: 360, y: G - 2 },
  { sprite: 'decor/m2/scaffold', frame: 0, x: 760, y: SCAFFOLD_Y },
  { sprite: 'decor/m2/cactus', x: 1080, y: G },
  { sprite: 'decor/m2/scaffold', frame: 1, x: 1240, y: SCAFFOLD_Y },
  { sprite: 'decor/m2/skull', x: 1560, y: G },
];

export const sectionD: SectionDef = {
  id: 'd',
  name: 'The Drum Quarry',
  width: D_W,
  height: 216,
  scroll: 'right',
  background: BG_QUARRY,
  terrain: t.build(),
  terrainStyle: { ground: 'rock', edge: 'sand', platform: 'metal', solid: 'metal' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1000, D_ARENA.x0],
  timeLimit: 60,
  vehicles: [VAN],
  bossStart: { x: D_ARENA.x0 + 64, y: G },
  // Never drop a new life inside or behind the Behemoth's tread (its contact kills): a player who
  // died there lands 48 px in front of it instead (integration fix, see docs/api/missions-m1-m2.md).
  respawn: (p, ctx) => {
    const front = treadFront(ctx);
    if (front === null || p.x < front - 24) return null;
    return { x: Math.max(ctx.camera.left + 32, front - 48), y: G };
  },
  *script(ctx) {
    if (!ctx.bossRush) {
      // @0: a card game, a nap and a kazoo player.
      at(ctx, 'card-table', 312);
      at(ctx, 'rifleman', 300, { gag: 'cards', facing: 1 });
      at(ctx, 'rifleman', 324, { gag: 'cards', facing: -1 });
      at(ctx, 'rifleman', 360, { gag: 'nap', facing: -1 });
      at(ctx, 'rifleman', 420, { gag: 'kazoo', facing: -1 });
      at(ctx, 'crate', 500, { contains: 'R' });
      // Secret: the cracked wall hides the composer (1UP) and the golden record.
      at(ctx, 'breakable-wall', D_WALL.x, {
        w: D_WALL.w,
        h: D_WALL.h,
        solid: false,
        look: 'rock',
        hp: 200,
        reveal: [
          { id: 'hostage', x: 652, y: G, params: { kind: 'composer', bind: 'chair', drop: '1up' } },
          { id: 'pickup-gem', x: 664, y: G, params: { kind: 'golden-record' } },
        ],
      });
      // Standing placements of the later rows, staged just before they scroll into view.
      stage(ctx, 780, () => {
        at(ctx, 'bassoonist', 780, { facing: -1 }, SCAFFOLD_Y);
        at(ctx, 'bassoonist', 840, { facing: -1 }, SCAFFOLD_Y);
      });
      stage(ctx, 1200, () => at(ctx, 'hostage', 1200, { kind: 'critic', bind: 'chair', drop: 'S' }));

      yield ctx.waitCamera(300);
      fromRight(ctx, 'drummer');
      yield 40;
      fromRight(ctx, 'drummer');
      yield 40;
      fromRight(ctx, 'cymbalist');

      yield ctx.waitCamera(800);
      fromRight(ctx, 'oompah-tank', { stopX: 1150 }, 48);

      yield ctx.waitCamera(1000);
      for (let i = 0; i < 3; i++) {
        fromRight(ctx, 'rifleman', { entry: 'walk' });
        yield 30;
      }

      yield ctx.waitCamera(1300);
      fromRight(ctx, 'band-truck', { stopX: 1500, cargo: ['rifleman', 'rifleman', 'oompah-trooper', 'cymbalist'], outfit: 'desert' }, 48);

      yield ctx.waitCamera(D_ARENA.x0);
    }
    yield* bossFight(ctx);
  },
};

/** The Behemoth's intro body wall: its gap in front of the tread and its grace into the fight. */
const INTRO_WALL_GAP = 12;
const INTRO_WALL_GRACE = 40;

/** The Behemoth's tread front (world x) while it is in the arena, else null. */
function treadFront(ctx: SectionContext): number | null {
  for (const e of ctx.world.entities) {
    if (e instanceof Boss && e.type === 'ba-dum-behemoth' && (e.state === 'intro' || e.state === 'fight')) return e.x + BEHEMOTH.tread.x;
  }
  return null;
}

/** @1600: the arena lock, the weapon crate, THE BA-DUM BEHEMOTH, MISSION COMPLETE. */
function* bossFight(ctx: SectionContext): ScriptGen {
  ctx.lockCamera(D_ARENA.x0, D_ARENA.x1);
  at(ctx, 'crate', 1640, { contains: 'M' });
  const boss = ctx.spawn('ba-dum-behemoth', D_ARENA.x1 + 6, G, { facing: -1, enter: 'right' });
  // While it rolls in (no contact yet) and for a short grace after the fight starts, a body wall
  // 12 px in front of its tread pushes back a player who runs right during the WARNING, instead of
  // leaving him inside or against the tread when its contact turns on.
  const wall = ctx.bodyWall(boss.x + BEHEMOTH.tread.x - INTRO_WALL_GAP);
  ctx.world.scripts.run(
    (function* introWall(): ScriptGen {
      let grace = INTRO_WALL_GRACE;
      while (boss instanceof Boss && boss.alive && boss.state !== 'dying' && boss.state !== 'done' && grace > 0) {
        if (boss.state === 'fight') grace--;
        wall.x = boss.x + BEHEMOTH.tread.x - INTRO_WALL_GAP;
        yield;
      }
      wall.remove();
    })(),
  );
  yield ctx.bossIntro('THE BA-DUM BEHEMOTH', { subtitle: "COLONEL RIMSHOT IS HERE ALL WEEK", music: 'boss' });
  yield* waitBoss(boss);
  yield 60;
  // A van that made it to the end: Mrs. Dollop on the radio.
  const vans = vehiclesOf(ctx, VAN);
  if (vans.length > 0) {
    const v = vans.find((x) => x.state === 'driven') ?? vans[0];
    ctx.hud.bubble(v, 'MRS. DOLLOP: NOT A SCRATCH!\nYOU\'RE ALL GETTING FREE CONES.', { kind: 'radio', ticks: 180 });
    ctx.world.audio.sfx('env/radio-static');
  }
  yield 30;
  yield ctx.missionComplete();
}
