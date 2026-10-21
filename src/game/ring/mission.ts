/**
 * The ring's mission-like definition (docs/design/ring.md §1, §13; docs/api/ring.md §9).
 *
 * NOT registered with `defineMission` (spec §13: `listMissions` sorts ids, so a registered `ring`
 * would become m5's default next mission). It carries what the scenes, the HUD and the tally read
 * from `runner.mission` (`id`, `name`, `hostages` per stretch id …).
 */
import { mix32 } from '../../engine/rng';
import { RING_ID } from './ids';
import type { RingPlan } from './types';

export interface RingMission {
  readonly id: typeof RING_ID;
  /** Banner subtitle and the card's headline. */
  readonly name: string;
  readonly subtitle: string;
  /** The intro card / banner label (spec §1: MISSION 2). */
  readonly label: string;
  /** Stage song and boss song ids (synth: content/music/ring.ts). */
  readonly music: string;
  readonly bossMusic: string;
  readonly announce: string;
  readonly clearLine: string;
  /** The ring draws up to 4× art (the UHD kit). */
  readonly artDensity: 4;
  /** Hostages per stretch id (the tally counts the stretches a slot drove: `slot.mission.route`). */
  readonly hostages: Readonly<Record<string, number>>;
  /** The mission after the ring (none: the scene goes to the glitch bridge). */
  readonly next?: string;
}

/** The ring's definition for a plan. */
export function ringMission(plan: RingPlan): RingMission {
  return {
    id: RING_ID,
    name: 'DE RING',
    subtitle: 'A10',
    label: 'MISSION 2',
    music: 'ring',
    bossMusic: 'ring-boss',
    // The card's announcer line (content/ui/cards.ts: the ring card).
    announce: 'MISSION TWO. HOU JE VAST!',
    clearLine: 'Objective secured!',
    artDensity: 4,
    hostages: { ...plan.hostages },
  };
}

/**
 * The song id to play for a ring song id. Since wave B the ring has its own synth songs
 * (content/music/ring.ts: `ring`, `ring-boss`), so this is the id itself; the wave-A fallback to
 * the ams songs is gone. Kept as the one place a future ring song could be mapped.
 */
export function ringSong(id: string | null): string | null {
  return id;
}

let fallbackCount = 0;

/**
 * A new ring seed for a play (spec §13: a new ring each play; `?seed=` / `--seed` win and are
 * passed instead). 32 bits from the platform's crypto source when there is one (browsers, Node);
 * otherwise a mixed counter. Called once at the mission start, never during play, so the
 * simulation itself stays deterministic for its seed. Never 0.
 */
export function freshSeed(): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0] >>> 0 || 1;
  }
  fallbackCount++;
  return mix32(0x52494e47 + fallbackCount) || 1;
}

/** The seed of a play: the given one (URL / tool), else a fresh one. */
export function ringSeed(given: number | null | undefined): number {
  return given === null || given === undefined ? freshSeed() : given >>> 0;
}
