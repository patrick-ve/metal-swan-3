/**
 * oat-a — DE 9 STRAATJES, 09:30 (docs/design/oat.md §2.1): the Prinsengracht quay, the Berenstraat,
 * the Wolvenstraat with lock 1 (the hijsbalk), the Oude Spiegelstraat with lock 2 (het draaiorgel),
 * the Singel and De Makelaar's arena; then → oat-b. 4,608 px, scroll right, camera `yh` 60, `f` 210,
 * façades 16 px behind the feet (STREET-A's floor, GRAMMAR's strips).
 *
 * WAVE A (CORE's stub, wired by INTEGRATE-A): the terrain with the bridges' humps, the checkpoints,
 * the three locks with stand-in waves of the `ams` locals, the golden record at the hijsbalk, the
 * exit; STREET-A's scenery (layers, floor, decor, shop fronts) with GRAMMAR's façade strips
 * (facade/rows.ts `OAT_STRIPS`, the one row table) and LIGHT-WATER's sun; BUDGET's first pieces live
 * (the statiegeld bins, DE HAVERBAR's counter in front of its window: spec §6.1, §6.2). The set
 * pieces (PIECES), the cast (CAST-DAY) and De Makelaar (MAKELAAR) follow in wave B.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { at, lockedFight, placeBanner, standInWave } from './helpers';
import { OAT_A_DECOR } from './art/place-a';
import { OAT_STRIPS } from './facade/index';
import { BG_OAT_A } from './backgrounds';
import { OAT_A_FLOOR, OAT_A_STYLE } from './floor/a';
import { OAT_AMBIENCE, OAT_LOCALS, OAT_PIECE, OAT_SECTION, OAT_SONG } from './ids';
import { G, OAT_A, terrainA } from './terrain';

/** The first bin's tag (the lesson). */
const BIN_LESSON = 'oat-a-bin-lesson';

/** The end exit (enabled after De Makelaar's arena). */
export const OAT_A_EXIT = 'oat-a-end';

/** De Makelaar's arena (stand-in: a lock with a wave; MAKELAAR, wave B). */
function* makelaarArena(ctx: SectionContext): ScriptGen {
  yield* lockedFight(ctx, OAT_A.arena[0], OAT_A.arena[1], 'oat-a-arena', 4, true);
  ctx.enableExit(OAT_A_EXIT);
  ctx.showGo();
}

export function* scriptA(ctx: SectionContext): ScriptGen {
  if (ctx.bossRush) {
    yield* makelaarArena(ctx);
    return;
  }
  // The place and the clock after the mission's MISSION 2 / START! banner.
  ctx.world.scripts.run(
    function* oatABanner(): ScriptGen {
      yield 150;
      placeBanner(ctx, OAT_SECTION.a);
    },
    { name: 'oat-a banner' },
  );
  // The golden record (spec §2.1: on the hanging piano at 2,240; wave A: on the street there).
  at(ctx, 'pickup-gem', OAT_A.recordX, { kind: 'golden-record' });
  // The statiegeld bins on their pavement bulbs (spec §6.1) and DE HAVERBAR (spec §6.2): its counter,
  // goods and barista stand on the pavement in front of STREET-A's shop window (704–768).
  OAT_A.bins.forEach((x, i) => at(ctx, OAT_PIECE.bin, x, { size: OAT_A.binSizes[i], tag: i === 0 ? BIN_LESSON : undefined }));
  at(ctx, OAT_PIECE.haverbar, (OAT_A.haverbar[0] + OAT_A.haverbar[1]) / 2, { counter: true });
  // The bin lesson (spec §2.1: `SCHIET!` at the first bin, after the place banner, if it still stands).
  ctx.world.scripts.run(
    function* oatABinLesson(): ScriptGen {
      yield 320;
      if (ctx.world.countAlive(BIN_LESSON) > 0) ctx.callout('SCHIET!', { ticks: 90 });
    },
    { name: 'oat-a bin lesson' },
  );
  // Berenstraat: delivery riders both ways, a fatbike youth at 1,000, a handhaver at 1,100.
  yield ctx.waitCamera(OAT_A.streets.berenstraat[0]);
  yield* standInWave(ctx, 'oat-a-beren', 3);
  yield ctx.waitCamera(800);
  at(ctx, OAT_LOCALS.handhaver, 1100, { facing: -1 }, 'ground', 'oat-a-beren');
  // Lock 1 (the hijsbalk), lock 2 (het draaiorgel), the arena.
  yield* lockedFight(ctx, OAT_A.lock1[0], OAT_A.lock1[1], 'oat-a-lock1', 4);
  yield* lockedFight(ctx, OAT_A.lock2[0], OAT_A.lock2[1], 'oat-a-lock2', 5);
  yield* makelaarArena(ctx);
}

export const sectionA: SectionDef = {
  id: OAT_SECTION.a,
  name: 'De 9 Straatjes',
  width: OAT_A.w,
  height: 216,
  scroll: 'right',
  // The scenery (STREET-A, spec §8.7 a): the morning layers, the street floor (wet in the shade, drying
  // in the sun), GRAMMAR's façade strips with the shop slots, the street props, bridges and vistas.
  background: BG_OAT_A,
  terrain: terrainA(),
  terrainStyle: OAT_A_STYLE,
  floor: OAT_A_FLOOR,
  strips: OAT_STRIPS[OAT_SECTION.a],
  decor: [...OAT_A_DECOR],
  playerStart: { x: 48, y: G },
  bossStart: { x: OAT_A.bossX, y: G },
  checkpoints: [...OAT_A.checkpoints],
  music: OAT_SONG.a,
  ambience: OAT_AMBIENCE[OAT_SECTION.a],
  // BUDGET's 10 piece sprites (content/oat/budget/art.ts: the bins, the cans and bottles, the goods,
  // DE HAVERBAR and its barista) come under 'decor/oat/piece/' and 'item/oat/'.
  art: ['enemy/handhaver', 'enemy/delivery-rider', 'decor/oat/a/', 'decor/oat/piece/', 'item/oat/'],
  exits: [{ id: OAT_A_EXIT, rect: { x: OAT_A.w - 32, y: 0, w: 32, h: 216 }, to: OAT_SECTION.b, disabled: true }],
  script: scriptA,
};
