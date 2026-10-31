/**
 * oat-c1 — the chase on the Grimburgwal, 17:30 → 18:00 (docs/design/oat.md §2.4): the Swan (P2:
 * the Mute) under auto-scroll (1.0, then 1.2 from x 2,048), the crumbling quay wall rolling in from
 * the left, the pontoons, the closed bridge (`BUKKEN!`), the sinkhole and the scan car, the meeting
 * of the three canals; exit → oat-d (the Swan stays behind: oat-d lists no `vehicles`). 4,096 px.
 *
 * WAVE A STUB (CORE): a short jetty, the canal as one water hazard, the end jetty; `startVehicle:
 * 'swan'` (every player starts on a Swan and gets a new one on respawn), the auto-scroll with its
 * speed step, no timer (`timeLimit` 0: the spec pauses it), the exit. KADE builds the chase (wave B:
 * the collapse front, the pontoons, the bridge, the sinkhole, the bot's chase mode).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { placeBanner } from './helpers';
import { OAT_AMBIENCE, OAT_SECTION, OAT_SONG } from './ids';
import { STUB_DUSK, STUB_STYLE } from './placeholder';
import { G, OAT_C1, terrainC1 } from './terrain';

export const OAT_C1_EXIT = 'oat-c1-end';

export function* scriptC1(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, OAT_SECTION.c1, 120);
  ctx.autoScroll(OAT_C1.scroll);
  yield ctx.waitCamera(OAT_C1.fastX);
  ctx.autoScroll(OAT_C1.scrollFast);
  yield ctx.waitCamera(OAT_C1.w - 384 - 1);
  // The end of the chase: the view is free again (unlock cancels the auto-scroll), the exit opens.
  ctx.enableExit(OAT_C1_EXIT);
  ctx.unlockCamera();
}

export const sectionC1: SectionDef = {
  id: OAT_SECTION.c1,
  name: 'De Kademuur - the chase',
  width: OAT_C1.w,
  height: 216,
  scroll: 'right',
  background: STUB_DUSK,
  terrain: terrainC1(),
  terrainStyle: STUB_STYLE,
  playerStart: { x: 48, y: G },
  checkpoints: [...OAT_C1.checkpoints],
  timeLimit: 0,
  music: OAT_SONG.c,
  ambience: OAT_AMBIENCE[OAT_SECTION.c1],
  art: ['vehicle/swan'],
  startVehicle: 'swan',
  vehicles: ['swan'],
  // From the water before the end jetty (a swimming Swan reaches it) to the section's end.
  exits: [{ id: OAT_C1_EXIT, rect: { x: OAT_C1.endJetty[0] - 64, y: 0, w: OAT_C1.w - OAT_C1.endJetty[0] + 64, h: 216 }, to: OAT_SECTION.d, disabled: true }],
  script: scriptC1,
};
