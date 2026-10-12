/**
 * Gramps' squeaky boot (GDD §3.4): after his `bored` fidget (a screwdriver taken to the boot) the
 * boot squeaks on every step for 120 ticks. A cosmetic status with no HUD icon and no rule
 * changes; the hero def names it in `boredStatus` (characters/index.ts) and the player logic
 * applies it when the fidget ends (see docs/api/characters.md):
 * ```ts
 * const id = (player.character as { boredStatus?: string }).boredStatus;
 * const st = id ? getStatus(id) : undefined;
 * if (st) player.status.add(st);
 * ```
 * There is no boot sound in GDD §15.7: the step plays the Swan's little `swan/squeak`, pitched up.
 */
import type { Player } from '../../player/player';
import type { StatusEffectDef } from '../../player/status';
import { defineStatus } from '../../registry';

export const SQUEAK = {
  id: 'squeaky-boot',
  ticks: 120,
  sfx: 'swan/squeak',
  /** Higher than the Swan's squeak: a small rubber sole. */
  pitch: 1.8,
  /** Ticks between two steps at a run (legs-run: 8 frames × 4 ticks, two footfalls). */
  stepTicks: 16,
  /** Slower than this (px/tick) is standing still: no steps. */
  minSpeed: 0.3,
} as const;

/** Ticks walked since the last squeak, per player. */
const walked = new WeakMap<Player, number>();
const sfxOpts = { pitch: 1 };

export const SQUEAKY_BOOT: StatusEffectDef = {
  id: SQUEAK.id,
  ticks: SQUEAK.ticks,

  onStart(p) {
    // The first step squeaks at once.
    walked.set(p, SQUEAK.stepTicks - 1);
  },

  onTick(p) {
    const moving = p.state === 'play' && p.onGround && Math.abs(p.vx) > SQUEAK.minSpeed;
    if (!moving) return;
    const n = (walked.get(p) ?? 0) + 1;
    if (n < SQUEAK.stepTicks) {
      walked.set(p, n);
      return;
    }
    walked.set(p, 0);
    // A Helium Head squeaks higher still.
    sfxOpts.pitch = SQUEAK.pitch * p.status.sfxPitch;
    p.world.audio.sfx(SQUEAK.sfx, sfxOpts);
  },
};

defineStatus(SQUEAKY_BOOT);
