/**
 * Mission `oldenzaal` script helpers (docs/api/oldenzaal.md "Helpers"): the GDD wave notation
 * (`R+16`, `L-16`, `TOP`, `@x`, `[N]`, `[H]`, `[2P]`) as calls, like the ams helpers but with no
 * ams art import. Section scripts of every owner use these.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { getFrames, listSprites } from '../../../../engine/sprites';
import { Boss } from '../../../boss';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';

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

/**
 * Run `fn` once the camera top comes within `lead` px of `y` ('up' sections: standing placements
 * staged just above the view's top edge, like m3's). A background script; the section change
 * cancels it.
 */
export function stageY(ctx: SectionContext, y: number, fn: () => void, lead = 32): void {
  ctx.world.scripts.run(
    function* ozStageY(): ScriptGen {
      yield () => ctx.camera.top - lead <= y;
      fn();
    },
    { name: `oz stage y ${y}` },
  );
}
