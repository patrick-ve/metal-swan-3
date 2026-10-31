/**
 * oat-e — DE TAXIRIT, 03:20 → 04:30 (docs/design/oat.md §2.6, §6.11): the taxi races the squad out
 * of the centre along the Prins Hendrikkade, through the IJtunnel, up the A10 ramp; the ride ends
 * under the `A10` gantry with `missionComplete()` (the fare is the kassabon's last line). 6,144 px.
 *
 * WAVE A STUB (CORE): a plain auto-scroll stand-in on foot (no taxi yet), no timer (`timeLimit` 0:
 * the spec pauses it), stand-in waves of delivery riders and handhavers, `missionComplete()` at the
 * end. TAXIRIT replaces it with the scripted carrier `oat-taxi-ride` and its window seats (wave C;
 * the ams c2 cruise pattern, spec decision 44).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { placeBanner, standInWave } from './helpers';
import { OAT_AMBIENCE, OAT_SECTION, OAT_SONG } from './ids';
import { STUB_NIGHT, STUB_STYLE } from './placeholder';
import { G, OAT_E, terrainE } from './terrain';

export function* scriptE(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, OAT_SECTION.e);
  ctx.autoScroll(OAT_E.scroll);
  for (const x of [OAT_E.hendrikkade[0], OAT_E.redLight[0], OAT_E.tunnel[0] + 512, OAT_E.ramp[0]]) {
    yield ctx.waitCamera(x);
    yield* standInWave(ctx, `oat-e-${x}`, 3, 50);
  }
  yield ctx.waitCamera(OAT_E.w - 384 - 1);
  ctx.unlockCamera(false);
  yield 60;
  yield ctx.missionComplete();
}

export const sectionE: SectionDef = {
  id: OAT_SECTION.e,
  name: 'De Taxirit',
  width: OAT_E.w,
  height: 216,
  scroll: 'right',
  background: STUB_NIGHT,
  terrain: terrainE(),
  terrainStyle: STUB_STYLE,
  playerStart: { x: 48, y: G },
  checkpoints: [...OAT_E.checkpoints],
  timeLimit: 0,
  music: OAT_SONG.c,
  ambience: OAT_AMBIENCE[OAT_SECTION.e],
  art: ['enemy/handhaver', 'enemy/delivery-rider'],
  script: scriptE,
};
