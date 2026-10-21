/**
 * The ring's music cues (docs/design/ring.md §11, wave B SOUND): a listener on a RingRunner that
 * moves the music with the road.
 *
 * - **Boss:** a boss slot that spawns (`runner.events` 'bossSlot', spawned) switches to the
 *   mission's boss song (`ring-boss`); the boss's defeat (world 'bossDefeated') brings the stage
 *   theme back at its A section (order slot 1, no intro), with a 1.5 s crossfade.
 * - **Tunnel lift:** when the view's ambience turns to the tunnel bed inside a tunnel chunk (the
 *   Coentunnel, the Zeeburgertunnel; not a covered stretch) and the stage theme plays, the theme
 *   jumps to its lift C (`RING_LIFT_SLOT`: the hook a whole step up) with a short crossfade at the
 *   portal. Once per tunnel.
 * - **Tunnel echo** (spec §7.3 "sounds echo"; review B): while the ambience is the tunnel bed (a
 *   tunnel or a covered stretch) the sound effects get an echo off the walls (`TUNNEL_ECHO` through
 *   the opt-in `AudioOut.setEcho`); it fades out at the exit portal and when the cues detach.
 *
 * Cosmetic only: it reads runner state and calls `runner.playMusic`; it never touches entities or
 * an rng, so a run with and without it simulates the same ticks. The per-tick check is a world
 * script (the ring has no other world scripts). Attach it once per runner, after construction:
 *
 * ```ts
 * const runner = new RingRunner({ … });
 * attachRingCues(runner);
 * runner.start();
 * ```
 */
import { RING_LIFT_SLOT } from '../content/music/ring';
import { chunkIndexAt } from './director';
import type { RingRunner } from './runner';

/** The ambience id of a tunnel (view.ts `ambience`; content/sfx/ring-scenery.ts). */
export const TUNNEL_BED = 'ring/tunnel-bed';
/** Plan px ahead of `planDist` where the view decides the ambience (view.ts MID). */
const VIEW_MID = 192;
/** The sfx echo in a tunnel: one slap off the walls (about the tunnel bed's own +0.11 s), short tail. */
export const TUNNEL_ECHO = Object.freeze({ delay: 0.11, feedback: 0.3, mix: 0.32 });

/** Crossfades (ticks): into the boss, back to the stage theme, into the tunnel lift. */
export const CUE_FADE = { boss: 30, back: 90, lift: 8 } as const;

export interface RingCues {
  /** Tunnel lifts played so far (tests, the debug overlay). */
  readonly lifts: number;
  /** Stop listening (the scene's exit). */
  detach(): void;
}

/** Whether the plan chunk under the view's middle is a tunnel tube. */
function inTunnelChunk(runner: RingRunner): boolean {
  const chunks = runner.plan.chunks;
  if (!chunks.length) return false;
  const i = chunkIndexAt(chunks, runner.planDist + VIEW_MID);
  return i >= 0 && chunks[i].type === 'tunnel';
}

/** Start the ring's music cues on a runner (see the module doc). Safe to call before `start()`. */
export function attachRingCues(runner: RingRunner): RingCues {
  let lifts = 0;
  let wasTunnel = false;
  let echo = false;
  let alive = true;
  const offs: Array<() => void> = [];

  offs.push(
    runner.events.on('bossSlot', (e) => {
      if (!alive || !e.spawned) return;
      runner.playMusic(runner.mission.bossMusic, CUE_FADE.boss);
    }),
  );
  offs.push(
    runner.world.events.on('bossDefeated', () => {
      if (!alive || runner.currentMusic !== runner.mission.bossMusic) return;
      runner.playMusic(runner.mission.music, CUE_FADE.back, { from: 1 });
    }),
  );

  const handle = runner.world.scripts.run(
    function* cues() {
      for (;;) {
        yield;
        if (!alive) return;
        const bed = runner.view.ambience === TUNNEL_BED;
        if (bed !== echo) {
          echo = bed;
          runner.audio.setEcho?.(bed ? TUNNEL_ECHO : null);
        }
        const tunnel = bed && inTunnelChunk(runner);
        if (tunnel && !wasTunnel && runner.currentMusic === runner.mission.music && RING_LIFT_SLOT > 0) {
          runner.playMusic(runner.mission.music, CUE_FADE.lift, { from: RING_LIFT_SLOT, restart: true });
          lifts++;
        }
        wasTunnel = tunnel;
      }
    },
    { name: 'ring-cues' },
  );

  return {
    get lifts() {
      return lifts;
    },
    detach() {
      alive = false;
      if (echo) runner.audio.setEcho?.(null);
      echo = false;
      for (const off of offs) off();
      handle.cancel();
    },
  };
}
