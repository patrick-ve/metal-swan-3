/**
 * Player options that content and the HUD read (GDD §13.13): difficulty, credits, volumes, the
 * announcer, speech bubbles, the boss bar, screen shake, reduced flashes, the graphics filter
 * and the art detail (read by main.ts) and the first-person mouse look and sensitivity (main.ts, the fps scene). Saved through the engine `Store`.
 *
 * Content reaches them with `settingsOf(world)` (context.ts); the Options scene edits
 * `app.settings` and calls `saveSettings`. Pure data, no DOM.
 */
import { loadJson, saveJson, type Store } from '../engine/storage';
import { UPSCALE_MODES, type UpscaleMode } from '../engine/upscale';
import { isDifficulty, type Difficulty } from './session';

export type ShakeLevel = 'full' | 'low' | 'off';

/**
 * ART DETAIL option: 'auto' (the display picks the art tier: 4× at an integer scale ≥ 8, e.g. 4K,
 * 2× from scale 2, else 1×; render-common.ts `chooseTier`) or a fixed tier 4, 2 or 1.
 */
export type ArtDetail = 'auto' | 4 | 2 | 1;

/** The values of the ART DETAIL option in menu order. */
export const ART_DETAILS: readonly ArtDetail[] = ['auto', 4, 2, 1];

/** Is `v` an ART DETAIL value? */
export function isArtDetail(v: unknown): v is ArtDetail {
  return v === 'auto' || v === 4 || v === 2 || v === 1;
}

/** The wanted art tier of an ART DETAIL value (0 = AUTO), as `chooseTier` takes it. */
export function artDetailTier(a: ArtDetail): 0 | 1 | 2 | 4 {
  return a === 'auto' ? 0 : a;
}

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
  /** VOICE VOLUME 0..10 (default 10): announcer lines and the voiced speech bubbles. */
  voiceVolume: number;
  /** Difficulty of a new game (mode select and OPTIONS share it). */
  difficulty: Difficulty;
  /** CREDITS: continues per game (FREE PLAY by default). */
  credits: CreditSetting;
  /** GRAPHICS: sprite filter on a high-resolution display (PIXEL / SMOOTH / XBR). */
  graphics: UpscaleMode;
  /** ART DETAIL: the art tier (AUTO / 4× / 2× / 1×; main.ts applies it; added 2026-10-19). */
  artDetail: ArtDetail;
  /** MOUSE LOOK: the first-person mode turns with the pointer-lock mouse (docs/design/fps.md §2.3). */
  mouseLook: boolean;
  /** SENSITIVITY 1..10 of the mouse look (0.6 × s angle units per pixel). */
  mouseSensitivity: number;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  speechBubbles: true,
  bossBar: true,
  screenShake: 'full',
  reduceFlashes: false,
  announcer: true,
  musicVolume: 7,
  sfxVolume: 8,
  voiceVolume: 10,
  difficulty: 'normal',
  credits: 'free',
  graphics: 'pixel',
  artDetail: 'auto',
  mouseLook: true,
  mouseSensitivity: 5,
});

/** Is `v` a GRAPHICS value ('pixel' | 'smooth' | 'xbr')? */
export function isGraphicsMode(v: unknown): v is UpscaleMode {
  return typeof v === 'string' && (UPSCALE_MODES as readonly string[]).includes(v);
}

/** Camera shake multiplier for a setting. */
export function shakeScaleOf(level: ShakeLevel): number {
  return level === 'off' ? 0 : level === 'low' ? 0.5 : 1;
}

/** The session's credit count for a CREDITS setting (Infinity = free play). */
export function creditsOf(c: CreditSetting): number {
  return c === 'free' ? Infinity : c;
}

const KEY = 'settings';

/**
 * Version of the saved settings layout. Saves without it (or older) come from builds where
 * GRAPHICS defaulted to SMOOTH and was saved with the rest even if the player never chose it,
 * so `clean` resets that one field to the current default (PIXEL) once; the next save stores
 * the version, and from then on a saved GRAPHICS value is the player's own choice.
 */
export const SETTINGS_VERSION = 2;

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
    // Added 2026-10-14: older saves have none and get the default.
    voiceVolume: vol('voiceVolume', d.voiceVolume),
    difficulty: isDifficulty(o.difficulty) ? o.difficulty : d.difficulty,
    credits: 'credits' in o ? cleanCredits(o.credits) : d.credits,
    graphics: isGraphicsMode(o.graphics) && Number(o.version) >= SETTINGS_VERSION ? o.graphics : d.graphics,
    // Added 2026-10-19 (UHD art): older saves have none and get AUTO.
    artDetail: isArtDetail(o.artDetail) ? o.artDetail : d.artDetail,
    // Added 2026-10-16 (first-person mode): older saves have none and get the defaults.
    mouseLook: bool('mouseLook', d.mouseLook),
    mouseSensitivity: Math.max(1, vol('mouseSensitivity', d.mouseSensitivity)),
  };
}

/** Saved settings (repaired field by field), or the defaults. */
export function loadSettings(store: Store): GameSettings {
  return loadJson<GameSettings>(store, KEY, { ...DEFAULT_SETTINGS }, clean);
}

export function saveSettings(store: Store, s: GameSettings): boolean {
  return saveJson(store, KEY, { ...s, version: SETTINGS_VERSION });
}
