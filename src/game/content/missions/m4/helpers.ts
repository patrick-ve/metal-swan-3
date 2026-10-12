/**
 * Mission m4 script helpers: the GDD wave notation (`R+16`, `L-16`, `TOP`, `[N]`, `[2P]`) as
 * calls, the night outfit on every Legion soldier, staged placements, the Bandwagon top-up for
 * players who arrive on foot, and the boss wait that fails soft while a boss module is missing.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { Vehicle } from '../../../vehicle';

/** The standard ground line (GDD conventions). */
export const G = 176;
/** View width (px). */
export const VIEW_W = 384;
/** The captured parade truck (GDD §8.4). */
export const WAGON = 'bandwagon';

/** Legion infantry ids that wear the night outfit in m4. */
const INFANTRY = new Set(['rifleman', 'drummer', 'cymbalist', 'triangle', 'baton-major', 'oompah-trooper', 'piccolo', 'bassoonist']);
/** Machines that pass `outfit` on to their cargo / riders. */
const CARRIERS = new Set(['band-truck', 'parade-float']);

/** Params with the m4 night outfit for Legion soldiers and their carriers (other ids pass through). */
export function night(id: string, params?: SpawnParams): SpawnParams {
  return INFANTRY.has(id) || CARRIERS.has(id) ? { outfit: 'night', ...params } : (params ?? {});
}

/** `[N]`: NORMAL and HARD only. */
export function normalUp(ctx: SectionContext): boolean {
  return ctx.session.difficulty !== 'easy';
}

/** `[2P]`: two players are in the game. */
export function twoPlayers(ctx: SectionContext): boolean {
  return ctx.playerCount >= 2;
}

/** A soldier / creature / machine already standing at x (feet on the floor under x, or y). */
export function at(ctx: SectionContext, id: string, x: number, params?: SpawnParams, y: number | 'ground' = 'ground'): Entity {
  return ctx.spawn(id, x, y, night(id, params));
}

/**
 * `R+margin`: enter just outside the right view edge, on the ground line. When the view is held
 * at the section's right end, the entity appears at x = width − 8 instead (GDD §11.0: never
 * outside the bounds).
 */
export function fromRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  const p = night(id, params);
  const edge = ctx.section.width - 8;
  const x = Math.min(ctx.camera.right + margin, edge);
  // On the street / roof line under x (the generic side entry would search down from the view
  // top and may pick a balcony or a billboard); over a gap the side entry finds a floor.
  if (Number.isFinite(ctx.world.terrain.groundY(x))) return ctx.spawn(id, x, 'ground', { facing: -1, enter: 'right', ...p, ...(tag ? { tag } : {}) });
  return ctx.enter(id, 'right', { margin, params: p, tag });
}

/**
 * `R+margin` on the street: like `fromRight`, but always on the ground line (the generic side
 * entry searches down from the view top and may pick a balcony). Use it for machines.
 */
export function roadRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 48, tag?: string): Entity {
  const x = Math.min(ctx.camera.right + margin, ctx.section.width - 8);
  return ctx.spawn(id, x, 'ground', { facing: -1, enter: 'right', ...night(id, params), ...(tag ? { tag } : {}) });
}

/** `L-margin`: enter just outside the left view edge (never left of x = 8). */
export function fromLeft(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  const p = night(id, params);
  if (ctx.camera.left - margin < 8) {
    return ctx.spawn(id, 8, 'ground', { facing: 1, enter: 'left', ...p, ...(tag ? { tag } : {}) });
  }
  return ctx.enter(id, 'left', { margin, params: p, tag });
}

/** `TOP`: drop in from above the view at x. */
export function fromTop(ctx: SectionContext, id: string, x: number, params?: SpawnParams, tag?: string): Entity {
  return ctx.enter(id, 'top', { x, params: night(id, params), tag });
}

/**
 * Stage `@x` placements ("already standing there") just before they scroll into view: `spawn`
 * runs when the view's right edge comes within `lead` px of x (at once when it already has).
 * The GDD rows trigger at the camera's LEFT edge, which would pop a soldier at x < left + 384
 * into view; staging keeps the rows' content and positions without the pop-in.
 */
export function stage(ctx: SectionContext, x: number, spawn: () => void, lead = 32): void {
  ctx.world.scripts.run(
    (function* (): ScriptGen {
      yield () => ctx.camera.right + lead >= x;
      spawn();
    })(),
  );
}

/** Every player vehicle of a type in the section (driven or parked). */
export function vehiclesOf(ctx: SectionContext, id: string): Vehicle[] {
  const out: Vehicle[] = [];
  for (const e of ctx.world.byTag('vehicle')) if (e instanceof Vehicle && e.type === id && e.alive && e.state !== 'wreck') out.push(e);
  return out;
}

/** Is a player riding a vehicle of this type right now? */
export function anyoneRiding(ctx: SectionContext, id: string): boolean {
  for (const p of ctx.players) if (p.state === 'mounted' && p.vehicle && (p.vehicle as Entity).type === id) return true;
  return false;
}

/** Spawn parked vehicles until there is one per player (at most xs.length). */
export function topUpVehicles(ctx: SectionContext, id: string, xs: readonly number[]): Vehicle[] {
  const have = vehiclesOf(ctx, id).length;
  const want = Math.min(xs.length, Math.max(1, ctx.playerCount));
  const out: Vehicle[] = [];
  for (let i = have; i < want; i++) {
    const v = ctx.spawn(id, xs[i], 'ground', { facing: 1 });
    if (v instanceof Vehicle) out.push(v);
  }
  return out;
}

/** Wait for a boss to be defeated; without the boss module (a placeholder) wait a moment. */
export function* waitBoss(boss: Entity): ScriptGen {
  if (boss instanceof Boss) yield () => boss.defeated;
  else yield 180;
}
