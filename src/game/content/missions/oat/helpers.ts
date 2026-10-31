/**
 * Mission `oat` script helpers (docs/api/oat.md "Helpers"): the GDD wave notation (`R+16`, `L-16`,
 * `TOP`, `@x`, `[N]`, `[H]`, `[2P]`) as calls, like the oldenzaal helpers (no import from another
 * mission), plus the wave-A placeholder blocks every section stub uses (`standInWave`,
 * `lockedFight`, `placeBanner`). Section scripts of every owner use these.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { getFrames, listSprites } from '../../../../engine/sprites';
import { Boss } from '../../../boss';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { OAT_LOCALS, type OatSectionId } from './ids';
import { SECTION_BANNERS } from './lines';

/** View width and height (px). */
export const VIEW_W = 384;
export const VIEW_H = 216;

/** `[N]`: NORMAL and HARD only. */
export function normalUp(ctx: SectionContext): boolean {
  return ctx.session.difficulty !== 'easy';
}

/** `[H]`: HARD only. */
export function hardOnly(ctx: SectionContext): boolean {
  return ctx.session.difficulty === 'hard';
}

/** `[2P]`: two players are in the game. */
export function twoPlayers(ctx: SectionContext): boolean {
  return ctx.playerCount >= 2;
}

function withTag(p: SpawnParams | undefined, tag?: string): SpawnParams {
  return tag ? { ...p, tag } : (p ?? {});
}

/**
 * `R+margin`: enter just outside the right view edge and walk in on the ground line (over a gap
 * the spot moves right to the next ground). Never outside the section (x ≤ width − 8).
 */
export function fromRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  const edge = ctx.section.width - 8;
  let x = Math.min(edge, ctx.camera.right + margin);
  const t = ctx.world.terrain;
  for (let k = 0; k < 8 && !Number.isFinite(t.groundY(x)) && x + 8 <= edge; k++) x += 8;
  return ctx.spawn(id, x, 'ground', { facing: -1, enter: 'right', ...withTag(params, tag) });
}

/** `L-margin`: enter just outside the left view edge (never left of x = 8). */
export function fromLeft(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  if (ctx.camera.left - margin < 8) return ctx.spawn(id, 8, 'ground', { facing: 1, enter: 'left', ...withTag(params, tag) });
  return ctx.enter(id, 'left', { margin, params, tag });
}

/** `TOP`: drop in from above the view at x. */
export function fromTop(ctx: SectionContext, id: string, x: number, params?: SpawnParams, tag?: string): Entity {
  return ctx.enter(id, 'top', { x, params, tag });
}

/** `@x`: standing there already (y = feet; 'ground' = the ground line under x). */
export function at(ctx: SectionContext, id: string, x: number, params?: SpawnParams, y: number | 'ground' = 'ground', tag?: string): Entity {
  return ctx.spawn(id, x, y, withTag(params, tag));
}

/** Wait for a boss to be defeated; without the boss module (a placeholder) wait a moment. */
export function* waitBoss(boss: Entity): ScriptGen {
  if (boss instanceof Boss) yield () => boss.defeated;
  else yield 180;
}

/** Is any member with this tag still alive? */
export function anyAlive(ctx: SectionContext, tag: string): boolean {
  return ctx.world.countAlive(tag) > 0;
}

/** Rasterise every sprite under `prefixes` now (a section start, under the fade). */
export function prewarm(...prefixes: string[]): void {
  for (const pre of prefixes) for (const id of listSprites(pre)) getFrames(id);
}

/** The section's place-and-clock banner (spec §1: `DE 9 STRAATJES - 09:30`), as an info banner. */
export function placeBanner(ctx: SectionContext, id: OatSectionId, ticks = 150): void {
  ctx.banner(SECTION_BANNERS[id], { style: 'info', ticks });
}

// ---------------------------------------------------------------------------------------------
// Wave-A placeholder blocks (the stubs use them; the wave B / C builders replace them)
// ---------------------------------------------------------------------------------------------

/**
 * A STAND-IN wave of the reused `ams` locals (spec §3 "Reused"): `n` from the right (a handhaver
 * every third, else a delivery rider), every `gap` ticks, all tagged `tag`. Used where the oat cast
 * (waves B and C) will stand.
 */
export function* standInWave(ctx: SectionContext, tag: string, n: number, gap = 40): ScriptGen {
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0) fromRight(ctx, OAT_LOCALS.handhaver, undefined, 16, tag);
    else fromRight(ctx, OAT_LOCALS.rider, { from: 'right' }, 16, tag);
    yield gap;
  }
}

/**
 * A camera lock over [x0, x1] with a stand-in wave (the lock at x0 once the view reaches it), then
 * the unlock (and the GO arrow). `pauseTimer`: the section timer stops while the lock holds (DE RIJ,
 * the boss arenas).
 */
export function* lockedFight(ctx: SectionContext, x0: number, x1: number, tag: string, n: number, pauseTimer = false): ScriptGen {
  yield ctx.waitCamera(Math.max(0, x0 - 8));
  ctx.lockCamera(x0, x1);
  if (pauseTimer) ctx.timer.pause();
  yield* standInWave(ctx, tag, n);
  yield ctx.waitClear(tag);
  yield 30;
  if (pauseTimer) ctx.timer.resume();
  ctx.unlockCamera();
  ctx.setCheckpoint();
}
