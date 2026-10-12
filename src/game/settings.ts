/**
 * Player options that content and the HUD read (GDD §13.13): difficulty, credits, volumes, the
 * announcer, speech bubbles, the boss bar, screen shake and reduced flashes. Saved through the
 * engine `Store`.
 *
 * Content reaches them with `settingsOf(world)` (context.ts); the Options scene edits
 * `app.settings` and calls `saveSettings`. Pure data, no DOM.
 */
import { loadJson, saveJson, type Store } from '../engine/storage';
import { isDifficulty, type Difficulty } from './session';

export type ShakeLevel = 'full' | 'low' | 'off';

/** CREDITS option (GDD §4.6): continues per game, 'free' = FREE PLAY. */
export type CreditSetting = 'free' | 9 | 5 | 3;

/** The values of the CREDITS option in menu order. */
export const CREDIT_STEPS: readonly CreditSetting[] = ['free', 9, 5, 3];

export interface GameSettings {
  /** Gag speech bubbles ('!', 'MMF!' …). Hints and the RIDE? bubble always show. */
  speechBubbles: boolean;
  /** The boss health bar. */
  bossBar: boolean;
  screenShake: ShakeLevel;
  /** White flashes and lightning drawn at 30 % (photosensitivity). */
  reduceFlashes: boolean;
  /** Spoken announcer lines (OFF: silent). */
  announcer: boolean;
  /** 0..10 (GDD defaults 7 / 8). */
  musicVolume: number;
  sfxVolume: number;
  /** Difficulty of a new game (mode select and OPTIONS share it). */
  difficulty: Difficulty;
  /** CREDITS: continues per game (FREE PLAY by default). */
  credits: CreditSetting;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  speechBubbles: true,
  bossBar: true,
  screenShake: 'full',
  reduceFlashes: false,
  announcer: true,
  musicVolume: 7,
  sfxVolume: 8,
  difficulty: 'normal',
  credits: 'free',
});

/** Camera shake multiplier for a setting. */
export function shakeScaleOf(level: ShakeLevel): number {
  return level === 'off' ? 0 : level === 'low' ? 0.5 : 1;
}

/** The session's credit count for a CREDITS setting (Infinity = free play). */
export function creditsOf(c: CreditSetting): number {
  return c === 'free' ? Infinity : c;
}

const KEY = 'settings';

function cleanCredits(v: unknown): CreditSetting {
  return v === 9 || v === 5 || v === 3 ? v : 'free';
}

function clean(v: unknown): GameSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const bool = (k: keyof GameSettings, fb: boolean): boolean => (typeof o[k] === 'boolean' ? (o[k] as boolean) : fb);
  const vol = (k: keyof GameSettings, fb: number): number => {
    const n = Number(o[k]);
    return o[k] !== null && o[k] !== '' && Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : fb;
  };
  const shake = o.screenShake === 'low' || o.screenShake === 'off' || o.screenShake === 'full' ? o.screenShake : d.screenShake;
  return {
    speechBubbles: bool('speechBubbles', d.speechBubbles),
    bossBar: bool('bossBar', d.bossBar),
    screenShake: shake,
    reduceFlashes: bool('reduceFlashes', d.reduceFlashes),
    announcer: bool('announcer', d.announcer),
    musicVolume: vol('musicVolume', d.musicVolume),
    sfxVolume: vol('sfxVolume', d.sfxVolume),
    difficulty: isDifficulty(o.difficulty) ? o.difficulty : d.difficulty,
    credits: 'credits' in o ? cleanCredits(o.credits) : d.credits,
  };
}

/** Saved settings (repaired field by field), or the defaults. */
export function loadSettings(store: Store): GameSettings {
  return loadJson<GameSettings>(store, KEY, { ...DEFAULT_SETTINGS }, clean);
}

export function saveSettings(store: Store, s: GameSettings): boolean {
  return saveJson(store, KEY, s);
}
