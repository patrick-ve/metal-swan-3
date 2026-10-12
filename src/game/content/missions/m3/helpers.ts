/**
 * Mission m3 script helpers: the GDD wave notation (`R+16`, `TOP`, `[N]`, `[2P]`) as calls, the
 * snow outfit on every Legion soldier, hostage / crate shorthands, the staging of standing
 * placements, the Gramps radio, SHE TOOK THE LIFT (the swan record from m3-a to m3-c) and the
 * fail-soft boss wait.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import { hudOf } from '../../../context';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { isSwan, type Swan } from '../../vehicles/swan/swan';

/** The standard ground line (GDD conventions). */
export const G = 176;
/** View size (px). */
export const VIEW_W = 384;
export const VIEW_H = 216;

/** Legion infantry ids that wear the snow outfit in m3. */
const INFANTRY = new Set(['rifleman', 'drummer', 'cymbalist', 'triangle', 'baton-major', 'oompah-trooper', 'piccolo', 'bassoonist']);

/** Params with the m3 snow outfit for Legion soldiers (other ids pass through). */
export function snow(id: string, params?: SpawnParams, tag?: string): SpawnParams {
  const p: SpawnParams = INFANTRY.has(id) ? { outfit: 'snow', ...params } : { ...params };
  return tag ? { ...p, tag } : p;
}

/** `[N]`: NORMAL and HARD only. */
export function normalUp(ctx: SectionContext): boolean {
  return ctx.session.difficulty !== 'easy';
}

/** `[2P]`: two players are in the game. */
export function twoPlayers(ctx: SectionContext): boolean {
  return ctx.playerCount >= 2;
}

/** `@x` / `(x, y)`: standing there already (y = feet; 'ground' = the floor under x). */
export function at(ctx: SectionContext, id: string, x: number, params?: SpawnParams, y: number | 'ground' = 'ground', tag?: string): Entity {
  return ctx.spawn(id, x, y, snow(id, params, tag));
}

/**
 * `R+margin`: enter just outside the right view edge and walk / run / ski in, on the ground line.
 * When the view is held at the section's right end, the entity appears at x = width − 8 instead
 * (GDD §11.0: never outside the section bounds).
 */
export function fromRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string, extra = 0): Entity {
  const edge = ctx.section.width - 8;
  const x = Math.min(edge, ctx.camera.right + margin + extra);
  return ctx.spawn(id, x, 'ground', { facing: -1, enter: 'right', ...snow(id, params, tag) });
}

/** `TOP`: drop in from above the view at x. */
export function fromTop(ctx: SectionContext, id: string, x: number, params?: SpawnParams, tag?: string): Entity {
  return ctx.enter(id, 'top', { x, params: snow(id, params), tag });
}

/** `hostage kind/bind @x (drop)`. */
export function hostage(ctx: SectionContext, kind: string, bind: string, x: number, drop: string, y: number | 'ground' = 'ground', extra?: SpawnParams): Entity {
  return ctx.spawn('hostage', x, y, { kind, bind, drop, ...extra });
}

/** `crate @x (contains)`. */
export function crate(ctx: SectionContext, x: number, contains: string, y: number | 'ground' = 'ground'): Entity {
  return ctx.spawn('crate', x, y, { contains });
}

/**
 * Stage `@x` placements (GDD "already standing there") just before they scroll into view: `spawn`
 * runs when the view's right edge comes within `lead` px of x (at once when it already has).
 */
export function stage(ctx: SectionContext, x: number, spawn: () => void, lead = 32): void {
  ctx.world.scripts.run(
    (function* staged(): ScriptGen {
      yield () => ctx.camera.right + lead >= x;
      spawn();
    })(),
  );
}

/** Vertical sections: stage placements when the view's top edge comes within `lead` px of y. */
export function stageY(ctx: SectionContext, y: number, spawn: () => void, lead = 32): void {
  ctx.world.scripts.run(
    (function* stagedY(): ScriptGen {
      yield () => ctx.camera.top - lead <= y;
      spawn();
    })(),
  );
}

/** Wait for a boss to be defeated; without the boss module (a placeholder) wait a moment. */
export function* waitBoss(boss: Entity): ScriptGen {
  if (boss instanceof Boss) yield () => boss.defeated;
  else yield 180;
}

/** Gramps on the radio: a navy bubble over a player (or a world point). */
export function radio(ctx: SectionContext, who: Entity | { x: number; y: number }, text: string, ticks = 150): void {
  hudOf(ctx.world).bubble(who, text, { kind: 'radio', ticks });
}

/** Is Gramps one of the players? */
export function hasGramps(ctx: SectionContext): boolean {
  return ctx.players.some((p) => p.character.id === 'gramps');
}

/** The first living player (for radio bubbles). */
export function anyPlayer(ctx: SectionContext): Entity | null {
  for (const p of ctx.players) if (p.alive) return p;
  return ctx.players[0] ?? null;
}

// ---------------------------------------------------------------------------------------------
// SHE TOOK THE LIFT (GDD §11.3, docs/design/swan-mount/levels.md §5.2)
// ---------------------------------------------------------------------------------------------

/** One swan recorded at the end of m3-a for m3-c. */
export interface LiftSwan {
  variant: 'ivory' | 'mute';
  cells: number;
  shells: number;
}

/** Campaign record key (docs/api/game.md §10). */
export const LIFT_KEY = 'm3/lift';

/** Every swan of the section still in one piece (parked, empty or ridden; not wrecked, not migrated). */
export function swansInOnePiece(ctx: SectionContext): Swan[] {
  const out: Swan[] = [];
  for (const v of ctx.world.byTag('vehicle')) {
    if (!isSwan(v) || !v.alive || v.removed || v.migrating) continue;
    if (v.state === 'wreck' || v.state === 'doomed' || v.state === 'ram' || v.cells <= 0) continue;
    out.push(v);
  }
  return out;
}

/** The record entries for these swans (at most 2; ivory first). */
export function liftRecord(swans: readonly Swan[]): LiftSwan[] {
  const out: LiftSwan[] = swans.map((s) => ({ variant: s.mute ? 'mute' : 'ivory', cells: s.cells, shells: s.shells }));
  out.sort((a, b) => (a.variant === b.variant ? 0 : a.variant === 'ivory' ? -1 : 1));
  // Two swans of the same colour (a carried one and a parked one): the second one becomes the Mute.
  if (out.length >= 2 && out[0].variant === out[1].variant) out[1] = { ...out[1], variant: out[0].variant === 'ivory' ? 'mute' : 'ivory' };
  return out.slice(0, 2);
}

/** Write the record now (m3-a, when the section ends). */
export function recordLift(ctx: SectionContext): LiftSwan[] {
  const rec = liftRecord(swansInOnePiece(ctx));
  ctx.records.set(LIFT_KEY, rec);
  return rec;
}

/** Read the record (m3-c); anything malformed counts as no record. */
export function readLift(ctx: SectionContext): LiftSwan[] {
  const raw: unknown = ctx.records.get(LIFT_KEY, []);
  if (!Array.isArray(raw)) return [];
  const out: LiftSwan[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const variant = o.variant === 'mute' ? 'mute' : 'ivory';
    const cells = typeof o.cells === 'number' && o.cells > 0 ? o.cells : 0;
    const shells = typeof o.shells === 'number' && o.shells >= 0 ? o.shells : 0;
    if (cells > 0) out.push({ variant, cells, shells });
  }
  return out.slice(0, 2);
}

/**
 * `WAIT dead` in an up-scrolling section: done when every member of the wave is dead or has been
 * left below the view (feet under its bottom edge − 8) for `grace` ticks in a row. The view never
 * scrolls back down, so a straggler who stepped down the ledges behind the players (a drum major
 * keeps behind his men and walks down when they fall) can no longer be reached or reach anyone.
 */
export function* waitClearUp(ctx: SectionContext, tag: string, grace = 120): ScriptGen {
  const cam = ctx.camera;
  let below = 0;
  for (;;) {
    let inPlay = 0;
    let left = 0;
    for (const e of ctx.world.byTag(tag)) {
      if (!e.alive) continue;
      if (e.y >= cam.bottom - 8) left++;
      else inPlay++;
    }
    if (inPlay === 0 && left === 0) return;
    below = inPlay === 0 ? below + 1 : 0;
    if (below >= grace) return;
    yield 1;
  }
}
