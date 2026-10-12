/**
 * Mission m1 script helpers: the GDD wave notation (`R+16`, `L-16`, `TOP`, `[N]`, `[H]`, `[2P]`) as
 * calls, hostage / crate shorthands, the water decor builder (the section view does not paint
 * 'water' hazards) and the fail-soft boss wait.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import type { DecorDef, SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { waterSprite } from './art';

/** The standard ground line (GDD conventions). */
export const G = 176;
/** River / channel surface (GDD §11.1). */
export const WATER_Y = 180;
/** View width (px). */
export const VIEW_W = 384;

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
 * `R+margin`: enter just outside the right view edge (`extra` px further out, for columns) and walk
 * in, standing on the GROUND line (never on a roof ledge or a ceiling top above it; over a gap the
 * spot moves right to the next ground). When the view is held at the section's right end, the
 * entity appears at x = width − 8 instead (GDD §11.0: never outside the section bounds).
 */
export function fromRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string, extra = 0): Entity {
  const edge = ctx.section.width - 8;
  let x = Math.min(edge, ctx.camera.right + margin + extra);
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

/** Is any wave member with this tag still alive? */
export function anyAlive(ctx: SectionContext, tag: string): boolean {
  return ctx.world.countAlive(tag) > 0;
}

/** Water decor is cut into pieces this wide (decor is culled by its left edge). */
const WATER_PIECE = 128;

/**
 * Decor for a body of water from x0 to x1 with its surface at y: an opaque body behind the actors
 * (skipped with `back: false`, e.g. over the wadeable slipway) and a see-through front layer with
 * the animated surface line.
 */
export function waterDecor(x0: number, x1: number, y = WATER_Y, h = 216 - WATER_Y, back = true): DecorDef[] {
  const out: DecorDef[] = [];
  for (let x = x0; x < x1; x += WATER_PIECE) {
    const w = Math.min(WATER_PIECE, x1 - x);
    const id = waterSprite(w, h);
    if (back) out.push({ sprite: `${id}-back`, x, y });
    out.push({ sprite: `${id}-tint`, x, y: y + 2, front: true, alpha: 0.45 });
    out.push({ sprite: id, x, y, front: true, animate: 8 });
  }
  return out;
}
