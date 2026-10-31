/**
 * oat-d — DE WALLEN BY NIGHT, 22:30 → 03:00 (docs/design/oat.md §2.5): the Oudezijds Achterburgwal
 * (our row behind, the canal in front), gids op de brug (a camera lock at the bridge), the
 * Trompettersteeg, the Oudezijds Voorburgwal with the Oude Kerk tower, the Oudekerksplein where the
 * neon goes out at 03:00, De Huisjesmelker's arena (`bossStart` x 3,990; the boss section of the
 * mission); then → oat-e. 4,352 px.
 *
 * WAVE A STUB (CORE): plain terrain, the checkpoints, the bridge lock and the arena with stand-in
 * waves, the 03:00 callout, the exit. STREET-A paints the night proof strip 0–1,280 in wave A (its
 * light: LIGHT-WATER); NIGHT, CAST-NIGHT and HUISJESMELKER build the rest in wave C.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { lockedFight, placeBanner, standInWave } from './helpers';
import { OAT_AMBIENCE, OAT_SECTION, OAT_SONG } from './ids';
import { STUB_NIGHT, STUB_STYLE } from './placeholder';
import { G, OAT_D, terrainD } from './terrain';

export const OAT_D_EXIT = 'oat-d-end';

/** De Huisjesmelker's arena (stand-in: a lock with a wave; HUISJESMELKER, wave C). */
function* huisjesmelkerArena(ctx: SectionContext): ScriptGen {
  yield* lockedFight(ctx, OAT_D.arena[0], OAT_D.arena[1], 'oat-d-arena', 5, true);
  ctx.enableExit(OAT_D_EXIT);
  ctx.showGo();
}

export function* scriptD(ctx: SectionContext): ScriptGen {
  if (ctx.bossRush) {
    yield* huisjesmelkerArena(ctx);
    return;
  }
  placeBanner(ctx, OAT_SECTION.d);
  yield ctx.waitCamera(400);
  yield* standInWave(ctx, 'oat-d-quay', 3);
  // Gids op de brug (spec §6.8): the camera lock at the bridge.
  yield* lockedFight(ctx, OAT_D.bridgeLock[0], OAT_D.bridgeLock[1], 'oat-d-bridge', 4);
  yield ctx.waitCamera(OAT_D.voorburgwal[0]);
  yield* standInWave(ctx, 'oat-d-voor', 3);
  // 03:00 (spec §6.9): the carillon strikes three, the neon goes out (NIGHT, LIGHT-WATER).
  yield ctx.waitCamera(OAT_D.threeX - 192);
  ctx.callout('03:00');
  yield* huisjesmelkerArena(ctx);
}

export const sectionD: SectionDef = {
  id: OAT_SECTION.d,
  name: 'De Wallen by night',
  width: OAT_D.w,
  height: 216,
  scroll: 'right',
  background: STUB_NIGHT,
  terrain: terrainD(),
  terrainStyle: STUB_STYLE,
  playerStart: { x: 48, y: G },
  bossStart: { x: OAT_D.bossX, y: G },
  checkpoints: [...OAT_D.checkpoints],
  music: OAT_SONG.d,
  ambience: OAT_AMBIENCE[OAT_SECTION.d],
  art: ['enemy/handhaver', 'enemy/delivery-rider'],
  exits: [{ id: OAT_D_EXIT, rect: { x: OAT_D.w - 32, y: 0, w: 32, h: 216 }, to: OAT_SECTION.e, disabled: true }],
  script: scriptD,
};
