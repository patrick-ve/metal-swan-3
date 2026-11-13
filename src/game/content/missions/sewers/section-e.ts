/**
 * sewers-e — DE AFVALHAL, 05:00 (docs/design/sewers.md §2.5, §4.2): the approach along the near
 * walkway, the trash hall under a canal, DE RATTENJONG on his trash throne, the flood; then →
 * sewers-end (transition `fade`). 1,280 px, scroll right. The mission's `bossSection` (`?boss=1`
 * starts at `bossStart` 880, in the arena). Wave P1b E.
 *
 * | x | content |
 * |---|---|
 * | 0–832 | the approach: runner packs (camera-right triggers 300, 470, 720), a spitter on its plinths (640 / 736), lost things (decor); weapon crate `H` at 500 |
 * | 864–1,248 | LOCK: DE RATTENJONG (`bossStart` 880): the throne at 1,000–1,200 (his seat 1,100), the trash ledges 920–990 and 1,110–1,180 at y 150 (one-way); crate `M` at 900 |
 * | after | the flood (the boss's end: the vault cracks, the water comes down, the heroes hang on ≤ 120 ticks), then the fade → sewers-end |
 *
 * Checkpoints (camera-centre x): 0, 600, 880. Every rat is P1a's; the king, his throne and the
 * flood are content/bosses/sewers-rattenjong/. The light is wave C's entry e (light.ts).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { Boss } from '../../../boss';
import { sewersCanal } from './canal/index';
import { PLINTH } from '../../sewers/rats/numbers';
import { ratPack } from '../../sewers/rats/helpers';
import { END_ART } from './e-kit';
import { crate, normalUp, placeBanner, prewarm, twoPlayers, VIEW_W, waitBoss } from './helpers';
import { SEWERS_BOSS, SEWERS_RAT, SEWERS_SECTION, SEWERS_SONG } from './ids';
import { GREY_SEWER, GREY_VAULT } from './placeholder';
import { G, SEWERS_E, terrainE } from './terrain';

/** The way out after the flood (the script fades into it: `exitTo`). */
export const SEWERS_E_EXIT = 'sewers-e-end';

/** The boss banner (spec §4.2). */
export const RATTENJONG_INTRO = { name: 'DE RATTENJONG', subtitle: 'KONING VAN HET RIOOL' } as const;

/** Tags of the approach's waves (tests and `waitClear`). */
export const E_TAG = { pack: 'sewers-e-pack', spitter: 'sewers-e-spitter' } as const;

/** Lost things on the walkway's back edge (decor; stand-in art `decor/sewers-e-junk`, frames 0–3). */
const decor: DecorDef[] = [
  { sprite: END_ART.junk, x: 140, y: 170, frame: 0 },
  { sprite: END_ART.junk, x: 262, y: 171, frame: 2 },
  { sprite: END_ART.junk, x: 418, y: 170, frame: 1 },
  { sprite: END_ART.junk, x: 590, y: 171, frame: 3 },
  { sprite: END_ART.junk, x: 760, y: 171, frame: 2 },
  { sprite: END_ART.junk, x: 845, y: 170, frame: 0 },
];

/** Wait until the camera's right edge reaches x. */
function right(ctx: SectionContext, x: number) {
  return ctx.waitCamera(Math.max(0, x - VIEW_W));
}

/** The approach (spec §2.5, 0–832): runner packs, a spitter, the crate `H`. */
function* approach(ctx: SectionContext): ScriptGen {
  const E = SEWERS_E;
  crate(ctx, E.crateH, 'H');
  // Pack 1: four runners out of the dark ahead.
  yield right(ctx, E.packs[0]);
  ratPack(ctx, 4, { from: 'right', tag: E_TAG.pack });
  // Pack 2: three ahead, [N] two more from behind.
  yield right(ctx, E.packs[1]);
  ratPack(ctx, 3, { from: 'right', tag: E_TAG.pack });
  if (normalUp(ctx)) ratPack(ctx, 2, { from: 'left', tag: E_TAG.pack });
  // The spitter on its two plinths (placed while they are still off screen).
  yield right(ctx, E.spitterX - 24);
  ctx.spawn(SEWERS_RAT.spitter, E.spitterX, PLINTH.y, { other: E.spitterX + PLINTH.gap, tag: E_TAG.spitter });
  // Pack 3: four runners, [2P] two more.
  yield right(ctx, E.packs[2]);
  ratPack(ctx, twoPlayers(ctx) ? 6 : 4, { from: 'right', tag: E_TAG.pack });
  // The hall opens: the approach is clear before the lock (a timeout keeps the pace).
  yield right(ctx, E.hall);
  let n = 0;
  yield () => ++n >= 600 || (ctx.world.countAlive(E_TAG.pack) === 0 && ctx.world.countAlive(E_TAG.spitter) === 0);
}

/** DE RATTENJONG's arena: the lock, the crate, the wake, the fight, the end, the fade. */
function* arena(ctx: SectionContext, king: ReturnType<SectionContext['spawn']>): ScriptGen {
  const [x0, x1] = SEWERS_E.arena;
  // The boss rush starts at bossStart 880: the lock takes the view there at once.
  if (!ctx.bossRush) yield ctx.waitCamera(Math.max(0, x0 - 8));
  ctx.lockCamera(x0, x1);
  crate(ctx, SEWERS_E.crateArena, 'M');
  const wake = (king as { wake?: () => void }).wake;
  if (typeof wake === 'function') wake.call(king);
  yield ctx.bossIntro(RATTENJONG_INTRO.name, { subtitle: RATTENJONG_INTRO.subtitle, music: SEWERS_SONG.boss });
  // The fight; his end plays the crack, the flood and the heroes' input-locked beat.
  if (king instanceof Boss) yield () => king.defeated;
  else yield* waitBoss(king);
  yield ctx.exitTo(SEWERS_SECTION.end, { transition: 'fade' });
}

export function* scriptE(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, SEWERS_SECTION.e);
  prewarm('enemy/sewers-rat-', 'boss/sewers-rattenjong/', 'decor/sewers-rattenjong-throne/', 'fx/sewers-rattenjong/');
  // He sits on his throne at the hall's back from the start (dormant: decor until the lock).
  const king = ctx.spawn(SEWERS_BOSS.rattenjong, SEWERS_E.throneX, G, { facing: -1 });
  if (!ctx.bossRush) yield* approach(ctx);
  yield* arena(ctx, king);
}

export const sectionE: SectionDef = {
  id: SEWERS_SECTION.e,
  name: 'De Afvalhal',
  width: SEWERS_E.w,
  height: 216,
  scroll: 'right',
  background: GREY_VAULT,
  terrain: terrainE(),
  terrainStyle: GREY_SEWER,
  decor,
  // Phase 6 (wave P6b E): the kit's trash hall, baked twice (ambient + the lit stack the cones show,
  // docs/api/canal.md "A lit section"). The lost things (`decor/sewers-e-junk`) are painted flat into
  // the walkway, the throne pile (4 levels) and Gerrit's chain are canal sprites of the lit stack.
  // The grey vault, terrain style and the junk decor stay for `?canal=0`.
  canal: sewersCanal(SEWERS_SECTION.e),
  art: ['enemy/sewers-rat-', 'boss/sewers-rattenjong/', 'decor/sewers-rattenjong-throne/', 'fx/sewers-rattenjong/', END_ART.junk],
  playerStart: { x: 48, y: G },
  bossStart: { x: SEWERS_E.bossX, y: G },
  checkpoints: [...SEWERS_E.checkpoints],
  music: SEWERS_SONG.boss,
  ambience: 'sewers/drip-bed',
  exits: [{ id: SEWERS_E_EXIT, rect: { x: SEWERS_E.arena[1], y: 0, w: SEWERS_E.w - SEWERS_E.arena[1], h: 216 }, to: SEWERS_SECTION.end, transition: 'fade', disabled: true }],
  script: scriptE,
};
