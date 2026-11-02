/**
 * oat-a — DE 9 STRAATJES, 09:30 (docs/design/oat.md §2.1): the Prinsengracht quay, the Berenstraat,
 * the Wolvenstraat with lock 1 (the hijsbalk), the Oude Spiegelstraat with lock 2 (het draaiorgel),
 * the Singel and De Makelaar's arena; then → oat-b. 4,608 px, scroll right, camera `yh` 60, `f` 210,
 * façades 16 px behind the feet (STREET-A's floor, GRAMMAR's strips).
 *
 * WAVE A STUB (CORE): plain terrain with the bridges' humps, the checkpoints, the three locks with
 * stand-in waves of the `ams` locals, the golden record at the hijsbalk, the exit. INTEGRATE-A makes
 * the street walkable with STREET-A's scenery; the set pieces (PIECES), the cast (CAST-DAY) and De
 * Makelaar (MAKELAAR) follow in wave B.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { at, lockedFight, placeBanner, standInWave } from './helpers';
import { A_STRIP_ROWS, OAT_A_DECOR } from './art/place-a';
import { BG_OAT_A } from './backgrounds';
import { OAT_A_FLOOR, OAT_A_STYLE } from './floor/a';
import { OAT_AMBIENCE, OAT_LOCALS, OAT_SECTION, OAT_SONG, OAT_STRIP_SOURCE } from './ids';
import { G, OAT_A, terrainA } from './terrain';

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
  strips: { source: OAT_STRIP_SOURCE, depth: 16, height: 168, rows: A_STRIP_ROWS },
  decor: [...OAT_A_DECOR],
  playerStart: { x: 48, y: G },
  bossStart: { x: OAT_A.bossX, y: G },
  checkpoints: [...OAT_A.checkpoints],
  music: OAT_SONG.a,
  ambience: OAT_AMBIENCE[OAT_SECTION.a],
  art: ['enemy/handhaver', 'enemy/delivery-rider', 'decor/oat/a/'],
  exits: [{ id: OAT_A_EXIT, rect: { x: OAT_A.w - 32, y: 0, w: 32, h: 216 }, to: OAT_SECTION.b, disabled: true }],
  script: scriptA,
};
