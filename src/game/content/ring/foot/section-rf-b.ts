/**
 * `rf-b` DE BLOKKADE (docs/design/ring.md §R.6, §R.7; ~1:30 + the boat): the police line, the
 * `EXHAUSTING REBELLION` spandoek, the activists, the pink boat `DE LAATSTE DRUPPEL` (mini-boss),
 * the exit → MISSION COMPLETE (the one tally of the whole level).
 *
 * CORE STUB (revision R, wave A): a flat, playable placeholder (a few existing enemies and a
 * trickle of the ring gangs on foot, then the mission's end). WAVE B (BLOCKADE + BOAT) owns it: keep the export `sectionRfB` and the id 'rf-b';
 * `?section=rf-b&boss=1` is reserved for the boat (`bossStart`).
 */
import type { ScriptGen } from '../../../../engine/script';
import { terrain, type SectionContext, type SectionDef } from '../../../mission/index';
import { RF_GROUND, RF_SECTION } from './ids';
import { FOOT_GANG } from './gangs/index';
import { RF_A_FOES } from './script-rf-a';
import { RF_BACKGROUND } from './section-rf-a';

/** Width of the placeholder (px). */
export const RF_B_W = 1536;
export const RF_B_ART: readonly string[] = ['enemy/handhaver', 'enemy/boete-ticket', 'item/crate', ...RF_A_FOES];

/** One of the ring gangs on foot walks in from the right edge (the placeholder's trickle). */
function gang(ctx: SectionContext, id: string, margin = 16): void {
  ctx.spawn(id, Math.min(RF_B_W - 8, ctx.camera.right + margin), RF_GROUND, { facing: -1, enter: 'right', tag: 'rf-b-1' });
}

function* scriptRfB(ctx: SectionContext): ScriptGen {
  ctx.spawn('crate', 400, 'ground', { contains: 'bombs' });
  yield ctx.waitCamera(200);
  ctx.spawn('handhaver', ctx.camera.right + 16, 'ground', { tag: 'rf-b-1' });
  ctx.spawn('handhaver', ctx.camera.right + 46, 'ground', { tag: 'rf-b-1' });
  // Fixer (2026-10-22): a trickle of the ring gangs on foot, so the placeholder is not 10–14 s of
  // empty road at the play-test (it had one pair at the start, then nothing).
  yield ctx.waitCamera(450);
  gang(ctx, FOOT_GANG.rider);
  yield ctx.waitCamera(700);
  gang(ctx, FOOT_GANG.courier);
  gang(ctx, FOOT_GANG.rider, 46);
  yield ctx.waitCamera(950);
  gang(ctx, FOOT_GANG.crew);
  yield ctx.waitCamera(RF_B_W - 384 - 1);
  yield ctx.waitClear('rf-b-1');
  yield ctx.missionComplete();
}

export const sectionRfB: SectionDef = {
  id: RF_SECTION.b,
  name: 'DE BLOKKADE (placeholder)',
  width: RF_B_W,
  height: 216,
  scroll: 'right',
  background: RF_BACKGROUND,
  terrain: (() => {
    const t = terrain(RF_B_W, 216);
    t.ground().at(0, RF_GROUND).flat(RF_B_W);
    return t.build();
  })(),
  terrainStyle: { ground: 'concrete', edge: 'kerb' },
  art: RF_B_ART,
  playerStart: { x: 48, y: RF_GROUND },
  checkpoints: [700],
  timeLimit: 0,
  script: scriptRfB,
};
