/**
 * Script helpers of the oldenzaal street sections (INTEGRATE, wave A): the townspeople, the free
 * souls out of the drains and chimneys (always on screen, never right under a hero), and the art
 * lists of the street (the possessed in their street looks; the churchgoer sets stay out: they are
 * `defer: true` art of the nave, wave B).
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { OZ_BRUTE_LOOKS, OZ_STREET_LOOKS } from '../../oldenzaal/possessed/looks';
import { OZ_POSSESSED, OZ_SPRITES } from './ids';
import { G, OZ_A_SPOTS, OZ_A_WALLS, OZ_B_SPOTS, OZ_B_WALLS, type Block } from './terrain';

/** A townsperson of a street: x, look, mode ('idle' people flee from the possessed; 'hide' crouch). */
export type Townsfolk = readonly [number, string, 'idle' | 'hide'];

/** Spawn a street's townspeople (neutral; they sleep until seen and leave the view on their own). */
export function townsfolk(ctx: SectionContext, list: readonly Townsfolk[]): Entity[] {
  return list.map(([x, look, mode]) => ctx.spawn(OZ_POSSESSED.townsperson, x, 'ground', { look, mode, flee: true }));
}

/** The drains of the running section (TOWN: terrain.ts). */
function drainsOf(ctx: SectionContext): readonly number[] {
  return ctx.section.id === 'oz-b' ? OZ_B_SPOTS.drains : OZ_A_SPOTS.drains;
}

/** No soul rises closer than this to a living hero (px): a fair start. */
const SOUL_CLEAR = 72;
/** A soul's spot keeps this far inside the view (px). */
const SOUL_EDGE = 40;

function clearOfPlayers(ctx: SectionContext, x: number): boolean {
  for (const p of ctx.players) if (p.alive && Math.abs(p.x - x) < SOUL_CLEAR) return false;
  return true;
}

/**
 * A free soul rises out of a drain on screen (the one farthest ahead that is clear of the heroes);
 * with no such drain it fades in out of the air over the street ahead.
 */
export function drainSoul(ctx: SectionContext, tag?: string): Entity {
  const lo = ctx.camera.left + SOUL_EDGE;
  const hi = ctx.camera.right - SOUL_EDGE;
  let best = NaN;
  for (const x of drainsOf(ctx)) if (x >= lo && x <= hi && clearOfPlayers(ctx, x) && !(x <= best)) best = x;
  const params = tag ? { tag } : {};
  if (Number.isFinite(best)) return ctx.spawn(OZ_POSSESSED.soul, best, G, { from: 'drain', ...params });
  return ctx.spawn(OZ_POSSESSED.soul, hi - 24, G - 64, { from: 'air', ...params });
}

/** A free soul out of a chimney top (x, y); a chimney off the view gives a soul out of the air at the view's edge. */
export function chimneySoul(ctx: SectionContext, at: readonly [number, number], tag?: string): Entity {
  const lo = ctx.camera.left + SOUL_EDGE;
  const hi = ctx.camera.right - SOUL_EDGE;
  const params = tag ? { tag } : {};
  if (at[0] >= lo && at[0] <= hi) return ctx.spawn(OZ_POSSESSED.soul, at[0], at[1], { from: 'chimney', ...params });
  return ctx.spawn(OZ_POSSESSED.soul, Math.min(hi, Math.max(lo, at[0])), at[1] + 16, { from: 'air', ...params });
}

/**
 * The street's possessed art (section `art`, `prewarm`, the mission's `preloadFirst`): the hosts
 * in the street looks, the gunner's rifle, the brutes, the souls, the shots, the townspeople (the
 * freed brutes too), the soul fx. Not the churchgoer sets (the nave, wave B).
 */
export const OZ_STREET_ART: readonly string[] = [
  ...OZ_STREET_LOOKS.map((l) => `enemy/oz-shambler/${l}`),
  'enemy/oz-gunner/',
  'enemy/oz-brute/',
  'enemy/oz-soul/',
  'enemy/oz-ghost-shot/',
  ...[...OZ_STREET_LOOKS, ...OZ_BRUTE_LOOKS].map((l) => `npc/oz-town/${l}`),
  'fx/oz/soul/',
];

/** Meneer Wu, Mevrouw Winkel, the meal and its HUD / fx (WUGHOST) and the light pass's glow sprites (LIGHT). */
export const OZ_WUGHOST_ART: readonly string[] = [...OZ_SPRITES.wughost, ...OZ_SPRITES.light];

// ------------------------------------------------------------------------------ street entries

/** The low walls of the running section (a spawn never lands inside one). */
function wallsOf(ctx: SectionContext): readonly Block[] {
  return ctx.section.id === 'oz-b' ? OZ_B_WALLS : ctx.section.id === 'oz-a' ? OZ_A_WALLS : [];
}

/** Does a low wall stand between x0 and x1 (or under either)? A host walks into it and stays there. */
function wallBetween(ctx: SectionContext, x0: number, x1: number): boolean {
  const lo = Math.min(x0, x1) - 8;
  const hi = Math.max(x0, x1) + 8;
  for (const [wx, , ww] of wallsOf(ctx)) if (wx < hi && wx + ww > lo) return true;
  return false;
}

/**
 * `R+margin` on the STREET: a host walks in from just outside the right view edge with his feet on
 * the pavement (G), never on an awning, a balcony or a bay roof (the generic `fromRight` takes the
 * top floor there, and a host up on a bay roof off the view never comes down). A low wall in his
 * way (he cannot climb it): he comes from the left instead.
 */
export function streetRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  const x = Math.min(ctx.section.width - 8, ctx.camera.right + margin);
  if (wallBetween(ctx, x, ctx.camera.right - 48) && !wallBetween(ctx, Math.max(8, ctx.camera.left - margin), ctx.camera.left + 48)) return streetLeft(ctx, id, params, margin, tag, false);
  return ctx.spawn(id, x, G, { facing: -1, enter: 'right', ...params, ...(tag ? { tag } : {}) });
}

/** `L-margin` on the street (see `streetRight`; never left of x = 8). */
export function streetLeft(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string, swap = true): Entity {
  const x = Math.max(8, ctx.camera.left - margin);
  if (swap && wallBetween(ctx, x, ctx.camera.left + 48)) return streetRight(ctx, id, params, margin, tag);
  return ctx.spawn(id, x, G, { facing: 1, enter: 'left', ...params, ...(tag ? { tag } : {}) });
}

/** Ticks a tagged member may stay outside the locked view before the arena lets it go. */
export const ARENA_STRAY_TICKS = 420;

/**
 * Wait until the arena's wave `tag` is cleared. A member that stays more than 24 px outside the
 * locked view for `ARENA_STRAY_TICKS` (stuck behind a wall, a soul that drifted off) is removed
 * quietly, so a lock never hangs.
 */
export function* waitArena(ctx: SectionContext, tag: string): ScriptGen {
  const away = new Map<Entity, number>();
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
