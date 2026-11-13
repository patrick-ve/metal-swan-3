/**
 * Mission `sewers` script helpers (docs/design/sewers.md §1): the GDD wave notation (`R+16`, `L-16`,
 * `TOP`, `@x`, `[N]`, `[H]`, `[2P]`) as calls, like the oldenzaal helpers (no import from another
 * mission), the section banner (the place and the clock, spec §1: the style and the ticks of the
 * banner helper of the former level 2, `git show eb3316a:src/game/content/missions/oat/helpers.ts`),
 * and the P0 placeholder blocks (`standInWave`, `lockedFight`) the grey stubs use until the P1b
 * section builders replace them.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { getFrames, listSprites } from '../../../../engine/sprites';
import { Boss } from '../../../boss';
import { canalPaintedNow } from '../../../mission/canal/registry';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { SEWERS_BANNER, SEWERS_LOCALS, type SewersSectionId } from './ids';

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

/** `hostage kind/bind @x (drop)`. */
export function hostage(ctx: SectionContext, kind: string, bind: string, x: number, drop: string, y: number | 'ground' = 'ground', extra?: SpawnParams): Entity {
  return ctx.spawn('hostage', x, y, { kind, bind, drop, ...extra });
}

/** `crate @x (contains)`. */
export function crate(ctx: SectionContext, x: number, contains: string, y: number | 'ground' = 'ground'): Entity {
  return ctx.spawn('crate', x, y, { contains });
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
  const painted = canalPaintedNow();   // the scene paints these: never build their grey stand-ins (canal.md §8)
  for (const pre of prefixes) for (const id of listSprites(pre)) if (!painted.has(id)) getFrames(id);
}

/** The section's place-and-clock banner (spec §1: `DE WALLEN - 23:00`), as an info banner. */
export function placeBanner(ctx: SectionContext, id: SewersSectionId, ticks = 150): void {
  ctx.banner(SEWERS_BANNER[id], { style: 'info', ticks });
}

// ---------------------------------------------------------------------------------------------
// P0 placeholder blocks (the grey stubs use them; the P1b builders replace them)
// ---------------------------------------------------------------------------------------------

/**
 * A STAND-IN wave of the returning ams locals (spec §3 "Returning"): `n` from the right (a fatbike
 * youth every third, else a delivery rider), every `gap` ticks, all tagged `tag`. Used where the
 * sewers cast (wave P1a) will stand.
 */
export function* standInWave(ctx: SectionContext, tag: string, n: number, gap = 40): ScriptGen {
  for (let i = 0; i < n; i++) {
    if (i % 3 === 2) fromRight(ctx, SEWERS_LOCALS.fatbike, undefined, 16, tag);
    else fromRight(ctx, SEWERS_LOCALS.rider, { from: 'right' }, 16, tag);
    yield gap;
  }
}

/**
 * A camera lock over [x0, x1] with a stand-in wave (the lock at x0 once the view reaches it), then
 * the unlock (and the GO arrow). `pauseTimer`: the section timer stops while the lock holds (the
 * boss arenas). `n` = 0: an empty lock that holds `hold` ticks (a stand-in for a set piece).
 */
export function* lockedFight(ctx: SectionContext, x0: number, x1: number, tag: string, n: number, pauseTimer = false, hold = 60): ScriptGen {
  yield ctx.waitCamera(Math.max(0, x0 - 8));
  ctx.lockCamera(x0, x1);
  if (pauseTimer) ctx.timer.pause();
  if (n > 0) yield* standInWave(ctx, tag, n);
  else yield hold;
  yield ctx.waitClear(tag);
  yield 30;
  if (pauseTimer) ctx.timer.resume();
  ctx.unlockCamera();
  ctx.setCheckpoint();
}
