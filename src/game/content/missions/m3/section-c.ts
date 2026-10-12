/**
 * m3-c — Summit Station (GDD §11.3, §10.3): 1280×216, scroll right, checkpoint 880. The players
 * climb out of the cable car at sunset; SHE TOOK THE LIFT: every swan recorded at the end of m3-a
 * sits parked next to the cabin (docs/design/swan-mount/levels.md §5.2). A short run past the
 * station to the summit deck, then THE WINDBAG (boss `windbag`, built in bosses/m3) in the locked
 * arena 896–1280: the station hut (solid, standable roof) and two snow piles.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import { terrain, type DecorDef, type SectionContext, type SectionDef } from '../../../mission/index';
import { BG_SUMMIT } from './backgrounds';
import { anyPlayer, at, crate, fromRight, G, hasGramps, hostage, radio, readLift, stage, waitBoss } from './helpers';

export const C_W = 1280;
/** The summit deck arena (GDD §10.3): LOCK 896–1280. */
export const ARENA_X = 896;
/** The station hut (solid 40×40) and the two snow piles (solids 24×16). */
export const HUT = { x: 912, y: 136, w: 40, h: 40 } as const;
export const PILES: readonly number[] = [1034, 1134];
/** The station roof (one-way, metal). */
export const STATION = { x0: 780, x1: 880, y: 120 } as const;
/** Parked swans (SHE TOOK THE LIFT): the ivory one at x 120, the Mute at x 76. */
export const LIFT_X = { ivory: 120, mute: 76 } as const;
/**
 * THE WINDBAG's spawn point: on the deck in the arena ('ground'); the boss flies in view
 * coordinates measured from that floor and rises from below the summit edge (bosses/m3).
 */
export const BOSS_AT = { x: ARENA_X + 232, y: 'ground' } as const;

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

const t = terrain(C_W, 216);
t.ground().at(0, G).flat(C_W);
t.platform(STATION.x0, STATION.y, STATION.x1 - STATION.x0);
t.solid(HUT.x, HUT.y, HUT.w, HUT.h, 'concrete');
for (const x of PILES) t.solid(x, G - 16, 24, 16, 'concrete');

const decor: DecorDef[] = [
  { sprite: 'decor/m3/pine', frame: 1, x: 20, y: G },
  { sprite: 'decor/m3/cable-car-cabin', x: 172, y: G },
  { sprite: 'decor/m3/snow-mound', x: 260, y: G + 2 },
  { sprite: 'decor/m3/pine', frame: 0, x: 420, y: G },
  { sprite: 'decor/m3/pine', frame: 1, x: 610, y: G },
  { sprite: 'decor/m3/station', x: STATION.x0, y: STATION.y },
  { sprite: 'decor/m3/snow-mound', x: 1100, y: G + 2 },
  { sprite: 'decor/m3/pine', frame: 0, x: 1262, y: G },
  // Front decor exactly over the solids (nothing stands inside a solid).
  { sprite: 'decor/m3/hut', x: HUT.x, y: HUT.y, front: true },
  ...PILES.map((x): DecorDef => ({ sprite: 'decor/m3/snow-pile', x, y: G - 16, front: true })),
];

// ---------------------------------------------------------------------------------------------
// Script pieces
// ---------------------------------------------------------------------------------------------

/** SHE TOOK THE LIFT: park every recorded swan by the cabin; the bell and Gramps' line. */
function* sheTookTheLift(ctx: SectionContext): ScriptGen {
  const rec = readLift(ctx);
  if (rec.length === 0) return;
  for (const s of rec) {
    ctx.spawn('swan', LIFT_X[s.variant], 'ground', { variant: s.variant, socks: true, cells: s.cells, shells: s.shells, facing: 1 });
  }
  yield 40;
  ctx.world.audio.sfx('env/train-bell');
  yield 30;
  const p = anyPlayer(ctx);
  if (p) radio(ctx, p, hasGramps(ctx) ? 'GRAMPS: GOOD GIRL.' : 'GRAMPS: SHE TOOK THE LIFT.', 180);
}

/** The boss fight: lock, the arena crate, THE WINDBAG rises, wait for its death. */
function* bossFight(ctx: SectionContext): ScriptGen {
  ctx.lockCamera(ARENA_X, C_W);
  crate(ctx, 932, 'L', HUT.y);
  const boss: Entity = ctx.spawn('windbag', BOSS_AT.x, BOSS_AT.y, { left: ARENA_X });
  yield ctx.bossIntro('THE WINDBAG', { subtitle: 'WING COMMANDER PUFFINGTON HAS A FEW WORDS' });
  yield* waitBoss(boss);
  if (boss instanceof Boss) yield 90;
  yield ctx.missionComplete();
}

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

export const sectionC: SectionDef = {
  id: 'c',
  name: 'Summit Station',
  width: C_W,
  height: 216,
  scroll: 'right',
  background: BG_SUMMIT,
  terrain: t.build(),
  terrainStyle: { ground: 'snow', edge: 'snow', platform: 'metal', solid: 'concrete' },
  decor,
  playerStart: { x: 48, y: G },
  bossStart: { x: 980, y: G },
  checkpoints: [880],
  timeLimit: 60,
  *script(ctx) {
    if (ctx.bossRush) {
      yield* bossFight(ctx);
      return;
    }
    ctx.world.scripts.run(sheTookTheLift(ctx));
    // Start: three riflemen, one building a snowman.
    at(ctx, 'rifleman', 240, { facing: -1 });
    at(ctx, 'rifleman', 300, { gag: 'snowman', facing: -1 });
    at(ctx, 'rifleman', 320, { facing: -1 });

    // Standing placements, staged before they scroll into view.
    stage(ctx, 400, () => crate(ctx, 400, 'bombs'));
    stage(ctx, 560, () => hostage(ctx, 'critic', 'chair', 560, 'R'));
    stage(ctx, 640, () => at(ctx, 'triangle', 640, { gag: 'counting', facing: -1 }));
    stage(ctx, 820, () => at(ctx, 'bassoonist', 820, { facing: -1 }, STATION.y));

    // @200: two goats from the right.
    yield ctx.waitCamera(200);
    fromRight(ctx, 'ram-goat');
    yield 60;
    fromRight(ctx, 'ram-goat');

    // @400: two riflemen.
    yield ctx.waitCamera(400);
    fromRight(ctx, 'rifleman');
    yield 40;
    fromRight(ctx, 'rifleman');

    // @600: five wind-up bots on skis.
    yield ctx.waitCamera(600);
    for (let i = 0; i < 5; i++) fromRight(ctx, 'windup-bot', { variant: 'ski' }, 16, undefined, i * 20);

    // @896: THE WINDBAG.
    yield ctx.waitCamera(ARENA_X);
    yield* bossFight(ctx);
  },
};

export const C_IDS: readonly string[] = ['swan', 'rifleman', 'crate', 'hostage', 'triangle', 'bassoonist', 'ram-goat', 'windup-bot', 'windbag'];
