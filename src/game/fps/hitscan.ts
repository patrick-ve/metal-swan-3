/**
 * Hitscan both ways (docs/design/fps.md §4.2, §4.3): the player's target search along the aim
 * line, the player's damage by distance band, the enemies' hit chance and damage on the player.
 * Every roll uses the game rng (deterministic). `d` is the Chebyshev distance max(|dx|, |dy|) in
 * tiles. No allocations.
 */
import type { Rng } from '../../engine/rng';
import { castRay, COS, lineOfSight, newRayHit, SIN, type DoorTable, type PushWall, type RayGrid } from '../../engine/ray';
import type { Difficulty } from '../session';
import type { Actor, ActorPool } from './actors';
import { WEAPON_KNIFE } from './types';

/** Chebyshev distance in tiles. */
export function bandDist(dx: number, dy: number): number {
  const ax = dx < 0 ? -dx : dx;
  const ay = dy < 0 ? -dy : dy;
  return ax > ay ? ax : ay;
}

/** The knife reaches this far (d ≤ 1.25). */
export const KNIFE_REACH = 1.25;

/**
 * The player's damage to an actor at band distance `d` with `weapon` (§4.2); 0 = a miss.
 *   gun: d < 2 → 1..63; 2 ≤ d < 4 → 1..42; d ≥ 4 → hit when rng(0..255) ≥ 12 × floor(d)
 *   (at least 32/256 hit), then 1..42. Knife: 1..16 within d ≤ 1.25, else a miss.
 */
export function playerDamage(rng: Rng, weapon: number, d: number): number {
  if (weapon === WEAPON_KNIFE) return d <= KNIFE_REACH ? rng.int(1, 16) : 0;
  if (d < 2) return rng.int(1, 63);
  if (d < 4) return rng.int(1, 42);
  const need = Math.min(12 * Math.floor(d), 256 - 32);
  if (rng.int(0, 255) < need) return 0;
  return rng.int(1, 42);
}

/** The actor is inside the player's view when |relative angle| ≤ this (§4.3). */
export const VIEW_HALF = 375;
/** The player "ran" this tick when it moved at least this far (tiles). */
export const RUN_MOVE = 0.12;

/**
 * The chance (out of 256) that an enemy shot hits the player (§4.3):
 * `clamp(base − k × floor(d), 16, 256)`, base 256 (160 when the player ran this tick), k = 16 when
 * the enemy is inside the player's view, else 8. The boss passes its own base (§7.2).
 */
export function enemyHitChance(d: number, playerRan: boolean, inView: boolean, base = 256, baseRun = 160): number {
  const b = playerRan ? baseRun : base;
  const k = inView ? 16 : 8;
  const c = b - k * Math.floor(d);
  return c < 16 ? 16 : c > 256 ? 256 : c;
}

/** Difficulty factor on damage to the player: EASY × 0.5 (rounded up). */
export function scaleForDifficulty(dmg: number, difficulty: Difficulty): number {
  return difficulty === 'easy' ? Math.ceil(dmg / 2) : dmg;
}

/** Damage of one enemy bullet that hit (§4.3): d < 2 → 8..40; d < 4 → 4..24; else 2..12. */
export function enemyDamage(rng: Rng, d: number, difficulty: Difficulty): number {
  const raw = d < 2 ? rng.int(8, 40) : d < 4 ? rng.int(4, 24) : rng.int(2, 12);
  return scaleForDifficulty(raw, difficulty);
}

/** Boss bullet damage (§7.2): d < 2 → 4..20; d < 4 → 2..12; else 1..8. */
export function bossDamage(rng: Rng, d: number, difficulty: Difficulty): number {
  const raw = d < 2 ? rng.int(4, 20) : d < 4 ? rng.int(2, 12) : rng.int(1, 8);
  return scaleForDifficulty(raw, difficulty);
}

/**
 * The bite reaches this far. The spec's genre number is d ≤ 1.0, but a dog stops on the centre of
 * the cell next to the player's box (one actor per cell, never on the player), so with the player
 * on a cell corner or edge the nearest reachable centre is 1.5 tiles away and the dog could never
 * bite. 1.5 = one cell plus the player's worst offset (cast-verify, 2026-10-16).
 */
export const BITE_REACH = 1.5;
/** A bite: hit when rng(0..255) < 180, then 4..16 (§4.3). Returns 0 on a miss. */
export function biteDamage(rng: Rng, difficulty: Difficulty): number {
  if (rng.int(0, 255) >= 180) return 0;
  return scaleForDifficulty(rng.int(4, 16), difficulty);
}

/** The aim-line half-width at distance `d` (§4.2): max(0.35, 0.06 × d). */
export function aimWidth(d: number): number {
  const w = 0.06 * d;
  return w > 0.35 ? w : 0.35;
}

const centreHit = newRayHit();

/**
 * The player's target (§4.2): the nearest living actor in front whose centre is at most
 * `aimWidth(d)` from the aim line, with line of sight and not behind the wall at the centre
 * column. Returns the actor or null.
 */
export function findTarget(
  pool: ActorPool,
  g: RayGrid,
  doors: DoorTable,
  push: PushWall | null,
  px: number,
  py: number,
  angle: number,
): Actor | null {
  const dirX = COS[angle];
  const dirY = SIN[angle];
  // The wall at the centre column bounds every target.
  const wall = castRay(g, doors, push, px, py, dirX, dirY, centreHit, 64) ? centreHit.dist : 64;
  let best: Actor | null = null;
  let bestAlong = Infinity;
  for (let i = 0; i < pool.count; i++) {
    const a = pool.actors[i];
    if (!a.alive) continue;
    const dx = a.x - px;
    const dy = a.y - py;
    const along = dx * dirX + dy * dirY;
    if (along <= 0 || along >= bestAlong || along > wall + 0.01) continue;
    const perp = Math.abs(dx * dirY - dy * dirX);
    if (perp > aimWidth(along)) continue;
    if (!lineOfSight(g, doors, push, px, py, a.x, a.y)) continue;
    best = a;
    bestAlong = along;
  }
  return best;
}
