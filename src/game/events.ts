/**
 * Game events on `world.events` (added to the engine's WorldEvents by declaration merging) and
 * the scoring helper. Listen with `world.events.on('bossDefeated', (e) => …)`.
 *
 * Who emits what:
 * - score            awardScore() (enemies, bosses, items, hostages, tally)
 * - enemyKilled      Enemy.die
 * - playerDied / playerSpawned / playerOut / weaponChanged   Player
 * - pickup           Pickup.collect
 * - hostageFreed / hostageRescued                            Hostage
 * - bossPhase / bossDefeated                                 Boss
 * - vehicleMounted / vehicleEjected / vehicleDestroyed       Vehicle
 * - explosion        fx.explosion()
 * - checkpoint / timeOut / sectionExit / stopLoops           MissionRunner
 */
import type { Damage, DamageKind, Entity, Team } from '../engine/entity';
import type { World } from '../engine/world';
import { gameOf } from './context';
import type { Player } from './player/player';

/** Why a player died: a damage kind, or one of the special causes. */
export type DeathCause = DamageKind | 'pit' | 'drown' | 'timeout';

export type EjectMode = 'exit' | 'ram' | 'destroyed' | 'forced';

export interface ScoreEvent {
  /** Player slot credited (0 / 1). */
  player: number;
  points: number;
  /** Where it happened (for floating score text); optional. */
  x?: number;
  y?: number;
}

declare module '../engine/world' {
  interface WorldEvents {
    score: ScoreEvent;
    enemyKilled: { enemy: Entity; damage: Damage; points: number; player: number };
    playerDied: { player: Player; slot: number; cause: DeathCause };
    playerSpawned: { player: Player; slot: number; respawn: boolean };
    /** A player lost the last life (the continue screen takes over). */
    playerOut: { player: Player; slot: number };
    weaponChanged: { player: Player; slot: number; weapon: string };
    pickup: { player: Player; slot: number; item: Entity };
    /** Ropes cut (by a shot, a blast, the knife or a touch). */
    hostageFreed: { hostage: Entity; slot: number };
    /** Tagged by a player: counts for the rescue bonus. */
    hostageRescued: { hostage: Entity; slot: number };
    bossPhase: { boss: Entity; phase: number };
    bossDefeated: { boss: Entity; player: number };
    vehicleMounted: { vehicle: Entity; player: Player; slot: number };
    vehicleEjected: { vehicle: Entity; player: Player; slot: number; mode: EjectMode };
    vehicleDestroyed: { vehicle: Entity };
    explosion: { x: number; y: number; r: number; team: Team; owner: number; size: string };
    checkpoint: { x: number; y: number };
    /** A score extend gave a player an extra life. */
    extend: { player: number; lives: number };
    timeOut: { section: string };
    sectionExit: { from: string; to: string };
    /**
     * The section or the mission ends: entities with a looping sound (`sfxLoop`) stop it now,
     * fading over `fadeTicks` (a new section starts its own again).
     */
    stopLoops: { fadeTicks: number };
  }
}

/**
 * Give points to a player slot (0 / 1; anything else is ignored) and emit 'score'.
 * Use this for every score source so the session and the HUD stay in sync.
 */
export function awardScore(world: World, slot: number | undefined, points: number, x?: number, y?: number): void {
  if (slot !== 0 && slot !== 1) return;
  if (!Number.isFinite(points) || points <= 0) return;
  const g = gameOf(world);
  const extra = g.session.addScore(slot, points);
  world.events.emit('score', { player: slot, points, x, y });
  if (extra > 0) {
    // Score extends (GDD §14.5): +1 life at 500,000 and 1,500,000.
    g.hud.callout('ONE MORE TRY!');
    world.audio.sfx('item/1up');
    world.events.emit('extend', { player: slot, lives: g.session.slots[slot].lives });
  }
}
