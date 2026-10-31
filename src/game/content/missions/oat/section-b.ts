/**
 * oat-b — FORT NEGEN & ZESTIG, 12:30 (docs/design/oat.md §2.2): the Keizersgracht quay at the
 * Huidenstraat corner, the queue's tail, DE RIJ at the corner bakery (camera lock, the timer
 * pauses, U BENT NUMMER 47), the way to the Herengracht; exit → oat-c at 2,780. 2,816 px.
 *
 * WAVE A STUB (CORE): plain terrain, the checkpoints, DE RIJ as a timer-paused camera lock with a
 * stand-in wave, the exit. QUEUE-B builds the scenery, the queue and the line-cutters (wave B).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { lockedFight, placeBanner, standInWave } from './helpers';
import { OAT_AMBIENCE, OAT_SECTION, OAT_SONG } from './ids';
import { STUB_DAY, STUB_STYLE } from './placeholder';
import { G, OAT_B, terrainB } from './terrain';

export const OAT_B_EXIT = 'oat-b-end';

export function* scriptB(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, OAT_SECTION.b);
  yield ctx.waitCamera(300);
  yield* standInWave(ctx, 'oat-b-quay', 2);
  yield ctx.waitCamera(OAT_B.tail[0]);
  yield* standInWave(ctx, 'oat-b-tail', 2);
  // DE RIJ (spec §6.7): the camera lock; the timer pauses.
  ctx.callout('DE RIJ');
  yield* lockedFight(ctx, OAT_B.rij[0], OAT_B.rij[1], 'oat-b-rij', 5, true);
  yield ctx.waitCamera(2200);
  yield* standInWave(ctx, 'oat-b-end', 2);
  ctx.enableExit(OAT_B_EXIT);
}

export const sectionB: SectionDef = {
  id: OAT_SECTION.b,
  name: 'Fort Negen & Zestig',
  width: OAT_B.w,
  height: 216,
  scroll: 'right',
  background: STUB_DAY,
  terrain: terrainB(),
  terrainStyle: STUB_STYLE,
  playerStart: { x: 48, y: G },
  checkpoints: [...OAT_B.checkpoints],
  music: OAT_SONG.b,
  ambience: OAT_AMBIENCE[OAT_SECTION.b],
  art: ['enemy/handhaver', 'enemy/delivery-rider'],
  exits: [{ id: OAT_B_EXIT, rect: { x: OAT_B.exitX, y: 0, w: OAT_B.w - OAT_B.exitX, h: 216 }, to: OAT_SECTION.c, disabled: true }],
  script: scriptB,
};
