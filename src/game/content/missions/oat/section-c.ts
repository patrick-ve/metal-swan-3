/**
 * oat-c — DE KADEMUUR on foot, 17:15 (docs/design/oat.md §2.3): the Grimburgwal south quay from the
 * Rokin end, the DE HAVERBAR kiosk, the taxi lesson, the temporary works with the lock, the first
 * crack, the jetty where the Swan returns; exit → oat-c1. 2,048 px, back edge y 146 (open quay).
 *
 * WAVE A STUB (CORE): plain terrain, the checkpoint, the lock 768–1,152 with a stand-in wave, the
 * `DE KADE ZAKT!` callout at the jetty, the exit (the Swan's arrival and the boarding: KADE, wave B;
 * the chase gives every player a Swan: `startVehicle` in oat-c1); DE HAVERBAR's kiosk (BUDGET).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { at, lockedFight, placeBanner, standInWave } from './helpers';
import { OAT_AMBIENCE, OAT_PIECE, OAT_SECTION, OAT_SONG } from './ids';
import { STUB_DUSK, STUB_STYLE } from './placeholder';
import { G, OAT_C, terrainC } from './terrain';

export const OAT_C_EXIT = 'oat-c-end';

export function* scriptC(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, OAT_SECTION.c);
  // DE HAVERBAR's kiosk on the quay (spec §2.3, §6.2: the INFLATIE prices carry over from oat-a; the
  // barista greeted the squad in the morning). BUDGET's first version, wired by INTEGRATE-A.
  at(ctx, OAT_PIECE.haverbar, OAT_C.kioskX, { greet: false });
  yield ctx.waitCamera(200);
  yield* standInWave(ctx, 'oat-c-kiosk', 2);
  yield* lockedFight(ctx, OAT_C.lock[0], OAT_C.lock[1], 'oat-c-lock', 5);
  yield ctx.waitCamera(OAT_C.jetty[0] - 384);
  ctx.callout('DE KADE ZAKT!');
  ctx.enableExit(OAT_C_EXIT);
}

export const sectionC: SectionDef = {
  id: OAT_SECTION.c,
  name: 'De Kademuur',
  width: OAT_C.w,
  height: 216,
  scroll: 'right',
  background: STUB_DUSK,
  terrain: terrainC(),
  terrainStyle: STUB_STYLE,
  playerStart: { x: 48, y: G },
  checkpoints: [...OAT_C.checkpoints],
  music: OAT_SONG.c,
  ambience: OAT_AMBIENCE[OAT_SECTION.c],
  art: ['enemy/handhaver', 'enemy/delivery-rider', 'decor/oat/piece/', 'item/oat/'],
  exits: [{ id: OAT_C_EXIT, rect: { x: OAT_C.w - 32, y: 0, w: 32, h: 216 }, to: OAT_SECTION.c1, disabled: true }],
  script: scriptC,
};
