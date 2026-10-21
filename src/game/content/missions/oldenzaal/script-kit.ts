/**
 * Script helpers of the oldenzaal street sections (INTEGRATE; revision 2, docs/design/oldenzaal.md
 * §3.3): the dead soldiers' entries on the abandoned street — out of RUIN's boarded doors and
 * windows and manholes (only an opening IN VIEW, so the tell is always seen), up through the
 * pavers at RUIN's rise spots, walking in at a view edge on the pavement (never behind a low wall
 * they cannot climb), a column marching in from the fog — plus the arena wait and the art lists.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { openingNear, ruinOpenings, type RuinOpeningEntity } from '../../oldenzaal/ruin/index';
import { marchColumn, spawnZombie, type ZombieEntity, type ZombieKind } from '../../oldenzaal/zombies/api';
import { OZ_SPRITES } from './ids';
import { G, OZ_A_RISE, OZ_A_WALLS, OZ_B_RISE, OZ_B_WALLS, type Block } from './terrain';

/** The dead soldiers' art (section `art`, `prewarm`, the mission's `preloadFirst`). */
export const OZ_ZOMBIE_ART: readonly string[] = OZ_SPRITES.zombies;

/** Meneer Wu, Mevrouw Winkel, the meal and its HUD / fx (WUGHOST) and the light pass's glow sprites (LIGHT). */
export const OZ_WUGHOST_ART: readonly string[] = [...OZ_SPRITES.wughost, ...OZ_SPRITES.light];

/** An entry spot keeps this far inside the view (px): its tell is seen whole. */
const IN_VIEW = 24;

function inView(ctx: SectionContext, x: number, margin = IN_VIEW): boolean {
  return x >= ctx.camera.left + margin && x <= ctx.camera.right - margin;
}

// ------------------------------------------------------------------------------ the street's walls

/** The low walls of the running section (a walk-in never lands behind one). */
function wallsOf(ctx: SectionContext): readonly Block[] {
  return ctx.section.id === 'oz-b' ? OZ_B_WALLS : ctx.section.id === 'oz-a' ? OZ_A_WALLS : [];
}

/** Does a low wall stand between x0 and x1 (or under either)? A zombie walks into it and stays there. */
function wallBetween(ctx: SectionContext, x0: number, x1: number): boolean {
  const lo = Math.min(x0, x1) - 8;
  const hi = Math.max(x0, x1) + 8;
  for (const [wx, , ww] of wallsOf(ctx)) if (wx < hi && wx + ww > lo) return true;
  return false;
}

// ------------------------------------------------------------------------------ the entries

/** The x of the living hero nearest the view's middle (NaN with none). */
function heroX(ctx: SectionContext): number {
  const mid = (ctx.camera.left + ctx.camera.right) / 2;
  let best = NaN;
  for (const p of ctx.players) if (p.alive && !(Math.abs(p.x - mid) >= Math.abs(best - mid))) best = p.x;
  return best;
}

/** Extra options of an entry. */
export interface ZOpts {
  tag?: string;
  /** A drop (an entity id or a `{ id, params }` spec: `weaponDrop('shotgun')`). */
  drop?: unknown;
  /** Extra ticks before the tell (stagger a group). */
  delay?: number;
}

/**
 * `R+margin` on the STREET: a dead soldier walks in from just outside the right view edge with his
 * feet on the pavement (G). A low wall in his way: he comes from the left instead.
 */
export function zRight(ctx: SectionContext, kind: ZombieKind, o: ZOpts = {}, margin = 16): ZombieEntity {
  const x = Math.min(ctx.section.width - 8, ctx.camera.right + margin);
  if (wallBetween(ctx, x, ctx.camera.right - 48) && !wallBetween(ctx, Math.max(8, ctx.camera.left - margin), ctx.camera.left + 48)) return zLeft(ctx, kind, o, margin, false);
  return spawnZombie(ctx, kind, x, G, 'walk', { tag: o.tag, drop: o.drop, facing: -1 });
}

/** `L-margin` on the street (see `zRight`; never left of x = 8). */
export function zLeft(ctx: SectionContext, kind: ZombieKind, o: ZOpts = {}, margin = 16, swap = true): ZombieEntity {
  const x = Math.max(8, ctx.camera.left - margin);
  if (swap && wallBetween(ctx, x, ctx.camera.left + 48)) return zRight(ctx, kind, o, margin);
  return spawnZombie(ctx, kind, x, G, 'walk', { tag: o.tag, drop: o.drop, facing: 1 });
}

/** The rise spots of the running section (RUIN: terrain.ts `OZ_A_RISE` / `OZ_B_RISE`). */
function riseSpotsOf(ctx: SectionContext): readonly number[] {
  return ctx.section.id === 'oz-b' ? OZ_B_RISE : OZ_A_RISE;
}

/** Ticks before a rise spot can be used again (revision 3: more of the dead, never two in one hole). */
const SPOT_REUSE = 150;
const spotUse = new WeakMap<object, Map<number, number>>();

/** The tick each rise spot of this world was last used. */
function usedSpots(ctx: SectionContext): Map<number, number> {
  let m = spotUse.get(ctx.world);
  if (!m) spotUse.set(ctx.world, (m = new Map()));
  return m;
}

/**
 * A dead soldier rises from the pavers at the rise spot in view nearest to `x` (the API keeps it
 * clear of the heroes; never a spot behind a low wall from them); with no spot in view, at `x`
 * clamped into the view.
 */
export function zRise(ctx: SectionContext, kind: ZombieKind, x: number, o: ZOpts = {}): ZombieEntity {
  let best = NaN;
  let fresh = NaN;
  const hx = heroX(ctx);
  const used = usedSpots(ctx);
  const now = ctx.world.tick;
  for (const s of riseSpotsOf(ctx)) {
    // Never behind a low wall from the heroes (a crawler there can neither reach them nor be hit).
    if (!inView(ctx, s, 32) || (Number.isFinite(hx) && wallBetween(ctx, s, hx))) continue;
    if (!(Math.abs(s - x) >= Math.abs(best - x))) best = s;
    // Revision 3: a spot one of the dead came up at a moment ago is taken (no two in one hole).
    if (now - (used.get(s) ?? -Infinity) >= SPOT_REUSE && !(Math.abs(s - x) >= Math.abs(fresh - x))) fresh = s;
  }
  // Every spot in view was used a moment ago: the nearest one, once the last one is out of it.
  let delay = o.delay ?? 0;
  if (Number.isFinite(fresh)) best = fresh;
  else if (Number.isFinite(best)) delay = Math.max(delay, (used.get(best) ?? now) + SPOT_REUSE - now);
  const sx = Number.isFinite(best) ? best : Math.max(ctx.camera.left + 40, Math.min(ctx.camera.right - 40, x));
  if (Number.isFinite(best)) used.set(best, now + delay);
  return spawnZombie(ctx, kind, sx, G, { kind: 'rise', surface: 'pavers', delay: delay || undefined }, { tag: o.tag, drop: o.drop });
}

/** The closed, free opening of `kinds` in view nearest to x (RUIN's boarded doors / windows, manholes). */
function openingInView(ctx: SectionContext, x: number, kinds: readonly ('door' | 'window' | 'manhole')[]): RuinOpeningEntity | null {
  let best: RuinOpeningEntity | null = null;
  let bd = Infinity;
  for (const k of kinds) {
    const e = openingNear(ctx.world, x, k);
    if (e && inView(ctx, e.spotX) && Math.abs(e.spotX - x) < bd) {
      bd = Math.abs(e.spotX - x);
      best = e;
    }
  }
  if (best) return best;
  // The nearest one was out of view: any other in view.
  for (const e of ruinOpenings(ctx.world)) {
    if (!kinds.includes(e.openingKind) || !inView(ctx, e.spotX)) continue;
    if (Math.abs(e.spotX - x) < bd) {
      bd = Math.abs(e.spotX - x);
      best = e;
    }
  }
  return best;
}

/**
 * A dead soldier BREAKS OUT of the boarded door / shop window in view nearest to x (planks and
 * glass fly). No closed one in view: he rises from the pavers there instead (never an unseen tell).
 */
export function zBurst(ctx: SectionContext, kind: ZombieKind, x: number, o: ZOpts = {}): ZombieEntity {
  const door = openingInView(ctx, x, ['door', 'window']);
  if (!door) return zRise(ctx, kind, x, o);
  door.busy = true;
  return spawnZombie(ctx, kind, door.spotX, G, { kind: 'burst', target: door, delay: o.delay }, { tag: o.tag, drop: o.drop, facing: door.outDir === 0 ? undefined : door.outDir });
}

/** A dead soldier CLIMBS OUT of the manhole in view nearest to x (the cover slides away); none in view: a rise. */
export function zManhole(ctx: SectionContext, kind: ZombieKind, x: number, o: ZOpts = {}): ZombieEntity {
  const cover = openingInView(ctx, x, ['manhole']);
  if (!cover) return zRise(ctx, kind, x, o);
  cover.busy = true;
  return spawnZombie(ctx, kind, cover.spotX, G, { kind: 'manhole', target: cover, delay: o.delay }, { tag: o.tag, drop: o.drop });
}

/** A column of the dead MARCHING in out of the fog at the far (right) end of the view (spec §3.3). */
export function zMarch(ctx: SectionContext, kinds: readonly ZombieKind[], tag?: string): ZombieEntity[] {
  return marchColumn(ctx, kinds, { from: 'right', tag });
}

// ------------------------------------------------------------------------------ revision 3: more of the dead

/*
 * Revision 3 (2026-10-21, the user after a play: "I want more zombies as it is very easy to play
 * against them now"): more of the dead at a time, still the slow tanks (numbers.ts unchanged).
 * Bigger, mixed groups (grunts in front, a rifleman or the MG behind, crawlers under the fire
 * line), pincers from both view edges, more bursts, manholes and rises around the squad. EASY
 * stays close to revision 2, NORMAL is clearly harder, HARD harder again; 2P gets more than 1P.
 * The fairness rules stay the API's: every entrance tells, attacks only on screen, the attack
 * tokens (3 / 4 / 6) cap how many attack at once.
 */

/** The difficulty step: 0 easy, 1 normal, 2 hard. */
export function ozTier(ctx: SectionContext): 0 | 1 | 2 {
  const d = ctx.session.difficulty;
  return d === 'easy' ? 0 : d === 'hard' ? 2 : 1;
}

/** The value for the running difficulty. */
export function byTier<T>(ctx: SectionContext, easy: T, normal: T, hard: T): T {
  const t = ozTier(ctx);
  return t === 0 ? easy : t === 1 ? normal : hard;
}

/** Px between two of a squad that walks in at a view edge (one behind the other). */
export const SQUAD_GAP = 26;

/**
 * A squad walks in from just outside the right view edge, one behind the other (the first kind
 * leads: put the grunts and the crawlers in front, the rifleman or the MG zombie behind them).
 */
export function zSquadRight(ctx: SectionContext, kinds: readonly ZombieKind[], o: ZOpts = {}): ZombieEntity[] {
  return kinds.map((k, i) => zRight(ctx, k, o, 16 + SQUAD_GAP * i));
}

/** A squad walks in from just outside the left view edge (see `zSquadRight`; a wall there: from the right). */
export function zSquadLeft(ctx: SectionContext, kinds: readonly ZombieKind[], o: ZOpts = {}): ZombieEntity[] {
  return kinds.map((k, i) => zLeft(ctx, k, o, 16 + SQUAD_GAP * i));
}

/** A pincer: a squad from each view edge at once (the squad is caught between them). */
export function zPincer(ctx: SectionContext, left: readonly ZombieKind[], right: readonly ZombieKind[], o: ZOpts = {}): ZombieEntity[] {
  return [...zSquadLeft(ctx, left, o), ...zSquadRight(ctx, right, o)];
}

/** The drop spec of a weapon pickup (an enemy's `drop`). */
export function weaponDrop(weapon: string): { id: string; params: { weapon: string } } {
  return { id: 'pickup-weapon', params: { weapon } };
}

/** A crate with a weapon (or bombs) standing on the pavement at x (the heroes need the firepower: tank zombies). */
export function crateAt(ctx: SectionContext, x: number, contains: string): Entity {
  return ctx.spawn('crate', x, G, { contains });
}

// ------------------------------------------------------------------------------ the arena

/** Ticks a tagged member may stay outside the locked view before the arena lets it go. */
export const ARENA_STRAY_TICKS = 420;

/**
 * Wait until the arena's wave `tag` is cleared. A member that stays more than 24 px outside the
 * locked view for `ARENA_STRAY_TICKS` (stuck behind a wall) is removed quietly, so a lock never
 * hangs. It waits 2 ticks first: a member spawned this tick joins the tag index on the next one.
 */
export function* waitArena(ctx: SectionContext, tag: string): ScriptGen {
  const away = new Map<Entity, number>();
  yield 2;
  yield () => {
    const list = ctx.world.byTag(tag);
    let alive = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      alive++;
      if (ctx.world.onScreen(e, 24)) {
        away.delete(e);
        continue;
      }
      const t = (away.get(e) ?? 0) + 1;
      away.set(e, t);
      if (t >= ARENA_STRAY_TICKS) e.remove();
    }
    return alive === 0;
  };
}
