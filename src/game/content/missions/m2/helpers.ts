/**
 * Mission m2 script helpers: the GDD wave notation (`R+16`, `L-16`, `[N]`, `[2P]`) as calls, the
 * desert outfit on every Legion soldier, the van top-up for players who arrive on foot, and the
 * boss wait that fails soft while a boss module is missing.
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
/** The armed ice-cream van (GDD §8.3). */
export const VAN = 'sundae-driver';

/** Legion infantry ids that wear the desert outfit in m2. */
const INFANTRY = new Set(['rifleman', 'drummer', 'cymbalist', 'triangle', 'baton-major', 'oompah-trooper', 'piccolo', 'bassoonist']);

/** Params with the m2 desert outfit for Legion soldiers (other ids pass through). */
export function desert(id: string, params?: SpawnParams): SpawnParams {
  return INFANTRY.has(id) ? { outfit: 'desert', ...params } : (params ?? {});
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
  return ctx.spawn(id, x, y, desert(id, params));
}

/**
 * `R+margin`: enter just outside the right view edge and walk / run in. When the view is held at
 * the section's right end, the entity appears at x = width − 8 instead (GDD §11.0: never outside
 * the section bounds).
 */
export function fromRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  const p = desert(id, params);
  const edge = ctx.section.width - 8;
  if (ctx.camera.right + margin > edge) {
    return ctx.spawn(id, edge, 'ground', { facing: -1, enter: 'right', ...p, ...(tag ? { tag } : {}) });
  }
  return ctx.enter(id, 'right', { margin, params: p, tag });
}

/** `L-margin`: enter just outside the left view edge (never left of x = 8). */
export function fromLeft(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  const p = desert(id, params);
  if (ctx.camera.left - margin < 8) {
    return ctx.spawn(id, 8, 'ground', { facing: 1, enter: 'left', ...p, ...(tag ? { tag } : {}) });
  }
  return ctx.enter(id, 'left', { margin, params: p, tag });
}

/** `TOP`: drop in from above the view at x. */
export function fromTop(ctx: SectionContext, id: string, x: number, params?: SpawnParams, tag?: string): Entity {
  return ctx.enter(id, 'top', { x, params: desert(id, params), tag });
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

/**
 * GDD m2-b start: players who arrive on foot find a van waiting with its engine running
 * (`[2P]` a second one). Spawns vans until there is one per player (at most two).
 */
export function topUpVans(ctx: SectionContext, xs: readonly number[]): Vehicle[] {
  const have = vehiclesOf(ctx, VAN).length;
  const want = Math.min(2, Math.max(1, ctx.playerCount));
  const out: Vehicle[] = [];
  for (let i = have; i < want && i < xs.length; i++) {
    const v = ctx.spawn(VAN, xs[i], 'ground', { facing: 1 });
    if (v instanceof Vehicle) out.push(v);
  }
  return out;
}

/** Roll a parked vehicle to x (about 1 px/tick), e.g. the van out of Mrs. Dollop's shed. */
export function* rollTo(v: Entity, x: number, maxTicks = 180): ScriptGen {
  for (let t = 0; t < maxTicks && v.alive; t++) {
    if (v instanceof Vehicle && v.state !== 'idle') return;
    const d = x - v.x;
    if (Math.abs(d) < 1.5) {
      v.vx = 0;
      return;
    }
    v.vx = Math.sign(d) * 1.2;
    yield 1;
  }
}

/** Wait for a boss to be defeated; without the boss module (a placeholder) wait a moment. */
export function* waitBoss(boss: Entity): ScriptGen {
  if (boss instanceof Boss) yield () => boss.defeated;
  else yield 180;
}

/**
 * Stage `@x` placements (GDD "already standing there") just before they scroll into view: `spawn`
 * runs when the view's right edge comes within `lead` px of x (at once when it already has).
 * The GDD rows trigger at the camera's LEFT edge, which would pop a soldier at x < left + 384 into
 * view; staging keeps the rows' content and positions without the pop-in (reported).
 */
export function stage(ctx: SectionContext, x: number, spawn: () => void, lead = 32): void {
  ctx.world.scripts.run(
    (function* (): ScriptGen {
      yield () => ctx.camera.right + lead >= x;
      spawn();
    })(),
  );
}
