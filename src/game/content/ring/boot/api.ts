/**
 * THE PINK BOAT'S CONTRACT (wave B; docs/design/ring.md §R.7; docs/api/ring.md "R.B Wave B
 * contracts"). FROZEN by PREP: the builders add, never rename. No entity or sprite registers here
 * (the section script imports it). OWNER after PREP: BLOCKADE+BOAT.
 *
 * `DE LAATSTE DRUPPEL`: a big pink sailing boat on a wheeled trailer in the middle of the A10 (our
 * own design and name). The leader with a megaphone calls waves of `loper`s (phase 1); the drum band
 * sends ground shocks (phase 2: HP ≤ 50 % or both speakers broken). The end: the hull cracks, the
 * mast falls, the boat settles; the leader slides down and the police carry the leader off
 * (`WIJ KOMEN TERUG... NA DE LUNCH!`). `autoStart = false`: the section script starts it with
 * `startBoat`.
 */
import type { Entity } from '../../../../engine/entity';
import { hasSong } from '../../../../engine/music';
import type { Wait } from '../../../../engine/script';
import { Boss } from '../../../boss';
import type { SectionContext } from '../../../mission/index';
import { BOAT_SUBTITLE, BOAT_TITLE } from '../foot/lines';

/** The boat's entity id (a `Boss`, `category: 'boss'`). */
export const BOAT_ID = 'ring-boot';
/** The boss bar's name and the bossIntro's title. */
export const BOAT_NAME = BOAT_TITLE;
/** The bossIntro's subtitle (a HUD word: English). */
export { BOAT_SUBTITLE };
/** The boat's art prefix (never under a prefix `ams` preloads). */
export const BOAT_ART = 'boss/ring-boot';
/** The leader as an NPC after the end (slides down, carried off by the police; never a target). */
export const BOAT_LEADER = 'ring-leider';

/** The boat's parts (`Boss.addPart` names): the two loudspeakers (breakable) and the hull (the HP). */
export const BOAT_PART = { speakerL: 'speaker-l', speakerR: 'speaker-r', hull: 'hull' } as const;
export type BoatPartName = (typeof BOAT_PART)[keyof typeof BOAT_PART];

/** The boat's song (AUDIO-1's ElevenLabs take; `ring-boss` until it is defined). */
export const BOAT_SONG = 'ring-boot';
export const BOAT_SONG_FALLBACK = 'ring-boss';

/** The boat's song id now (the defined one). */
export function boatSong(): string {
  return hasSong(BOAT_SONG) ? BOAT_SONG : BOAT_SONG_FALLBACK;
}

/** The boat's shared tuning (NORMAL). */
export const BOAT_TUNE = {
  /** `loper`s per called wave by difficulty (spec §R.7). */
  waveSize: { easy: 2, normal: 3, hard: 4 } as Readonly<Record<string, number>>,
  /** Phase 2 starts at this HP fraction (or when both speakers are broken). */
  phase2At: 0.5,
  /** Points for the boat. */
  score: 5_000,
} as const;

/** Spawn params of the boat. */
export interface BoatParams {
  /** Base HP (× difficulty × co-op). */
  hp?: number;
  /** Override the wave size (lopers per call). */
  wave?: number;
  /** A section tag. */
  tag?: string;
}

/** The boat's world event (`BOAT_EVENT`). */
export const BOAT_EVENT = 'ring-boot';
export interface BoatEvent {
  /** 'wave': the leader called a wave; 'phase2': the drum band; 'beaten': the hull cracked (the
   *  death starts); 'end': the leader is carried off (the section may open the exit). */
  what: 'wave' | 'phase2' | 'beaten' | 'end';
  boat: Entity;
  /** 'wave': the wave's number (1, 2 …) and its size. */
  wave?: number;
  count?: number;
}

declare module '../../../../engine/world' {
  interface WorldEvents {
    /** The pink boat: a wave called, phase 2, beaten, the end (BOAT_EVENT). */
    'ring-boot': BoatEvent;
  }
}

/** What the section script may ask of the boat (boot/boat.ts `PinkBoat` implements it). */
export type RingBoat = Boss & {
  /** Waves called so far. */
  readonly wavesCalled: number;
  /** True once the leader is carried off (after `defeated`): the section opens the exit. */
  readonly ended: boolean;
};

export function isRingBoat(e: Entity | null | undefined): e is RingBoat {
  return e instanceof Boss && typeof (e as unknown as { ended?: unknown }).ended === 'boolean' && e.type === BOAT_ID;
}

/**
 * Start the fight (the section script, once the arena is locked): the bossIntro (`DE LAATSTE
 * DRUPPEL`, `MINI-BOSS`, the boat's song) and `boat.start()`. Returns the intro's wait.
 */
export function startBoat(ctx: SectionContext, boat: Boss): Wait {
  const w = ctx.bossIntro(BOAT_NAME, { subtitle: BOAT_SUBTITLE, music: boatSong() });
  boat.start();
  return w;
}

/** Wait until the boat's end (the leader carried off), or `cap` ticks after it is defeated. */
export function waitBoatEnd(boat: RingBoat, cap = 900): Wait {
  let n = cap;
  return () => boat.ended || boat.removed || (boat.defeated && --n <= 0);
}
