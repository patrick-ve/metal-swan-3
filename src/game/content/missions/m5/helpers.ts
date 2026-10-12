/**
 * Mission m5 script helpers: the GDD wave notation (`[N]`, `@x` placements, `crate`, `hostage`)
 * as calls, the night outfit on every Legion soldier (GDD §9.1: `night` in m4–m5), staged
 * placements for the vertical section, radio bubbles and the fail-soft boss wait.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import { hudOf } from '../../../context';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';

/** The standard ground line (GDD conventions). */
export const G = 176;
export const VIEW_W = 384;
export const VIEW_H = 216;

/** Legion infantry ids that wear the night outfit in m5. */
const INFANTRY = new Set(['rifleman', 'drummer', 'cymbalist', 'triangle', 'baton-major', 'oompah-trooper', 'piccolo', 'bassoonist']);

/** Params with the m5 night outfit for Legion soldiers (other ids pass through) and a wave tag. */
export function night(id: string, params?: SpawnParams, tag?: string): SpawnParams {
  const p: SpawnParams = INFANTRY.has(id) ? { outfit: 'night', ...params } : { ...params };
  return tag ? { ...p, tag } : p;
}

/** `[N]`: NORMAL and HARD only. */
export function normalUp(ctx: SectionContext): boolean {
  return ctx.session.difficulty !== 'easy';
}

/** `(x, y)`: standing there already (y = feet; 'ground' = the floor under x). */
export function at(ctx: SectionContext, id: string, x: number, y: number | 'ground', params?: SpawnParams, tag?: string): Entity {
  return ctx.spawn(id, x, y, night(id, params, tag));
}

/** `hostage kind/bind (x, y) (drop)`. */
export function hostage(ctx: SectionContext, kind: string, bind: string, x: number, y: number | 'ground', drop: string, extra?: SpawnParams): Entity {
  return ctx.spawn('hostage', x, y, { kind, bind, drop, ...extra });
}

/** `crate (x, y) (contains)`. */
export function crate(ctx: SectionContext, x: number, y: number | 'ground', contains: string, extra?: SpawnParams): Entity {
  return ctx.spawn('crate', x, y, { contains, ...extra });
}

/**
 * Vertical (down-scrolling) sections: stage placements when the view's bottom edge comes within
 * `lead` px of y (at once when it already has), so they are never left above the view unseen.
 */
export function stageY(ctx: SectionContext, y: number, spawn: () => void, lead = 48): void {
  ctx.world.scripts.run(
    (function* stagedY(): ScriptGen {
      yield () => ctx.camera.bottom + lead >= y;
      spawn();
    })(),
  );
}

/** Wait for a boss to be defeated; without the boss module (a placeholder) wait a moment. */
export function* waitBoss(boss: Entity): ScriptGen {
  if (boss instanceof Boss) yield () => boss.defeated;
  else yield 180;
}

/** A radio (navy) or gag bubble over a player. */
export function bubble(ctx: SectionContext, who: Entity, text: string, kind: 'radio' | 'gag' = 'radio', ticks = 150): void {
  hudOf(ctx.world).bubble(who, text, { kind, ticks });
}

/** Is Gramps one of the players? */
export function hasGramps(ctx: SectionContext): boolean {
  return ctx.players.some((p) => p.character.id === 'gramps');
}

/** The first living player (for bubbles), else the first one. */
export function anyPlayer(ctx: SectionContext): Entity | null {
  for (const p of ctx.players) if (p.alive) return p;
  return ctx.players[0] ?? null;
}

/** Every living entity carrying `tag` is dead (a one-shot check). */
export function allDead(ctx: SectionContext, tag: string): boolean {
  for (const e of ctx.world.byTag(tag)) if (e.alive) return false;
  return true;
}
