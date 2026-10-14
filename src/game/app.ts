/**
 * The services every scene uses (input, audio, storage, scenes, debug, launch params, high
 * scores, options) and the shared menu helpers (text, panels, the swan cursor, menu input).
 * main.ts builds the browser versions; headless tools and tests can build an app with
 * MemoryStore + NullAudio + ScriptedSource input.
 */
import type { AudioOut, MusicOpts, SayOpts, SfxOpts, VolumeKind } from '../engine/audio';
import type { Color } from '../engine/color';
import { Debug } from '../engine/debug';
import { measure } from '../engine/font';
import type { Button, InputManager } from '../engine/input';
import { INK, PAL } from '../engine/palette';
import type { DrawOpts, Renderer, TextOpts } from '../engine/render';
import { SceneManager } from '../engine/scene';
import { frameH, frameW, getFrame, hasSprite } from '../engine/sprites';
import type { Store } from '../engine/storage';
import type { UpscaleMode } from '../engine/upscale';
import type { ContentReport } from './content/index';
import { DEFAULT_PARAMS, type LaunchParams } from './params';
import { HighScoreTable, type GameSession, type HighScoreEntry } from './session';
import { DEFAULT_SETTINGS, loadSettings, type GameSettings } from './settings';

/** What one game (title → … → final tally) remembers beyond the session (GDD §14.6). */
export interface CampaignRecord {
  /** Missions whose golden record each slot picked up. */
  readonly goldenRecords: [Set<string>, Set<string>];
  /** Missions finished, in order. */
  readonly missions: string[];
}

export function newCampaign(): CampaignRecord {
  return { goldenRecords: [new Set(), new Set()], missions: [] };
}

export interface GameApp {
  readonly input: InputManager;
  /** Audio with the ANNOUNCER option applied (OFF: `voice` is silent). */
  readonly audio: AudioOut;
  readonly store: Store;
  readonly scenes: SceneManager;
  readonly debug: Debug;
  readonly params: LaunchParams;
  readonly highScores: HighScoreTable;
  /** Player options (GDD §13.13); content reads them through `settingsOf(world)`. */
  readonly settings: GameSettings;
  /** Filled by the Boot scene. */
  content: ContentReport | null;
  /** The running game (null on the title screen). */
  session: GameSession | null;
  /** Golden records and finished missions of the game in progress (null on the title). */
  campaign: CampaignRecord | null;
  /** Frames drawn (title animations). */
  frame: number;
  /**
   * The window lost focus (set by main.ts): the gameplay scene opens the pause menu and clears
   * it; other scenes ignore it.
   */
  focusLost: boolean;
  /** A click or tap on the game (set by main.ts, cleared by the scene that reads it). */
  pointerPressed: boolean;
  /**
   * A user gesture (click, tap, key) has happened, so the browser lets audio play. The boot
   * scene waits for one (GDD §13.2); headless apps start with it set.
   */
  gesture: boolean;
  /** Which attract-mode tagline the title shows next (GDD §1.3). */
  attractStep: number;
  /**
   * GRAPHICS filter of this session from `?gfx=` (never saved): it wins over
   * `settings.graphics` until the player changes the option (`graphicsMode`).
   */
  graphicsOverride: UpscaleMode | null;
  /**
   * Backbuffer resolution the browser draws at (set by main.ts every frame; 1 headless). The
   * Options scene uses it to say when a filter needs a larger window.
   */
  displayRes: number;
  /**
   * Generate a 2× mission's sprites in the background at its start (preloadMissionArt). True
   * only in the browser (main.ts); headless apps leave it off so sims and tests do no 2× work.
   */
  readonly preloadArt: boolean;
}

export interface AppOptions {
  input: InputManager;
  audio: AudioOut;
  store: Store;
  params?: LaunchParams;
  debug?: Debug;
  /** False in the browser until the first click / key (default true: headless). */
  gesture?: boolean;
  /** Background 2× preload at a 2× mission's start (default false: headless). */
  preloadArt?: boolean;
}

/** The store key of the high score table (session.ts). */
const HIGH_SCORE_KEY = 'highscores';

/** GDD §13.14 default table (initials, score); the rest of each row is invented. */
export const DEFAULT_HIGH_SCORES: readonly Readonly<HighScoreEntry>[] = [
  { name: 'GRC', score: 1000000, mission: 'all', character: 'grace', continues: 0, difficulty: 'normal' },
  { name: 'MIT', score: 800000, mission: 'all', character: 'mittens', continues: 1, difficulty: 'normal' },
  { name: 'PIP', score: 600000, mission: 'm5', character: 'pip', continues: 2, difficulty: 'normal' },
  { name: 'GPS', score: 500000, mission: 'm5', character: 'gramps', continues: 0, difficulty: 'hard' },
  { name: 'HIS', score: 400000, mission: 'm4', character: '', continues: 0, difficulty: 'normal' },
  { name: 'BLR', score: 300000, mission: 'm3', character: '', continues: 1, difficulty: 'normal' },
  { name: 'RIM', score: 200000, mission: 'm3', character: '', continues: 0, difficulty: 'easy' },
  { name: 'PUF', score: 150000, mission: 'm2', character: '', continues: 3, difficulty: 'normal' },
  { name: 'PIZ', score: 100000, mission: 'm2', character: '', continues: 0, difficulty: 'normal' },
  { name: 'DOL', score: 50000, mission: 'ams', character: '', continues: 0, difficulty: 'easy' },
];

/** A fresh table with the GDD defaults. */
export function defaultHighScores(): HighScoreTable {
  return new HighScoreTable(DEFAULT_HIGH_SCORES.map((e) => ({ ...e })));
}

/** The saved table, or the GDD defaults when nothing was saved yet. */
export function loadHighScores(store: Store): HighScoreTable {
  return store.get(HIGH_SCORE_KEY) === null ? defaultHighScores() : HighScoreTable.load(store);
}

export function createApp(o: AppOptions): GameApp {
  const params = o.params ?? { ...DEFAULT_PARAMS };
  const debug = o.debug ?? new Debug(params.debug);
  if (params.god) debug.god = true;
  const settings = loadSettings(o.store);
  applyAudioSettings(o.audio, settings);
  return {
    input: o.input,
    audio: new GameAudio(o.audio, settings),
    store: o.store,
    scenes: new SceneManager(),
    debug,
    params,
    highScores: loadHighScores(o.store),
    settings,
    content: null,
    session: null,
    campaign: null,
    frame: 0,
    focusLost: false,
    pointerPressed: false,
    gesture: o.gesture ?? true,
    attractStep: 0,
    graphicsOverride: params.gfx,
    displayRes: 1,
    preloadArt: o.preloadArt ?? false,
  };
}

/** The GRAPHICS filter in effect: `?gfx=` until the option is changed, else the saved option. */
export function graphicsMode(app: Pick<GameApp, 'graphicsOverride' | 'settings'>): UpscaleMode {
  return app.graphicsOverride ?? app.settings.graphics;
}

/**
 * Music / sfx / voice volume from the options (0..10). The defaults (7 / 8 / 10) keep the
 * mixer's own levels (music 0.6, sfx 0.8, voice 1).
 */
export function applyAudioSettings(audio: AudioOut, s: GameSettings): void {
  const d = DEFAULT_SETTINGS;
  audio.setVolume('music', Math.min(1, (0.6 * s.musicVolume) / d.musicVolume));
  audio.setVolume('sfx', Math.min(1, (0.8 * s.sfxVolume) / d.sfxVolume));
  audio.setVolume('voice', Math.min(1, s.voiceVolume / d.voiceVolume));
}

/**
 * The app's audio: every call goes to the real output, except announcer lines while the
 * ANNOUNCER option is OFF and speech bubble lines (`say`) while VOICE VOLUME is 0. Optional
 * members are forwarded when the output has them.
 */
export class GameAudio implements AudioOut {
  readonly inner: AudioOut;
  private readonly settings: GameSettings;

  constructor(inner: AudioOut, settings: GameSettings) {
    this.inner = inner;
    this.settings = settings;
  }

  sfx(id: string, o?: SfxOpts): void {
    this.inner.sfx(id, o);
  }

  music(id: string | null, o?: MusicOpts): void {
    this.inner.music(id, o);
  }

  voice(line: string): void {
    if (this.settings.announcer) this.inner.voice(line);
  }

  setVolume(kind: VolumeKind, v: number): void {
    this.inner.setVolume(kind, v);
  }

  stopAll(): void {
    this.inner.stopAll();
  }

  update(): void {
    this.inner.update?.();
  }

  pauseMusic(): void {
    this.inner.pauseMusic?.();
  }

  resumeMusic(): void {
    this.inner.resumeMusic?.();
  }

  sfxLoop(key: string, id: string, o?: SfxOpts): void {
    this.inner.sfxLoop?.(key, id, o);
  }

  stopSfx(key: string, fadeTicks?: number): void {
    this.inner.stopSfx?.(key, fadeTicks);
  }

  duckMusic(factor: number): void {
    this.inner.duckMusic?.(factor);
  }

  setMuted(muted: boolean): void {
    this.inner.setMuted?.(muted);
  }

  suspend(): void {
    this.inner.suspend?.();
  }

  resume(): void {
    this.inner.resume?.();
  }

  /**
   * Fetch and decode a sample group (samples.ts). Resolves at once when the output has no
   * samples (NullAudio, tests, sims).
   */
  loadSamples(group: string, onProgress?: (done: number, total: number) => void): Promise<void> {
    return this.inner.loadSamples?.(group, onProgress) ?? Promise.resolve();
  }

  /**
   * A speech bubble line, voiced when its sample is loaded. The runner calls it only for bubbles
   * that show (gag bubbles hide with SPEECH BUBBLES OFF); ANNOUNCER does not gate it (it is for
   * the announcer); VOICE VOLUME 0 silences it.
   */
  say(text: string, speaker?: string, o?: SayOpts): void {
    if (this.settings.voiceVolume > 0) this.inner.say?.(text, speaker, o);
  }

  /** True while a voice sample speaks or waits (false without samples). */
  speaking(): boolean {
    return this.inner.speaking?.() ?? false;
  }

  pauseLoops(): void {
    this.inner.pauseLoops?.();
  }

  resumeLoops(): void {
    this.inner.resumeLoops?.();
  }

  /** Pre-render sound effects (Web Audio only; the boot scene calls it when it exists). */
  preload(ids: readonly string[]): void {
    const a = this.inner as AudioOut & { preload?: (ids: readonly string[]) => void };
    if (typeof a.preload === 'function') a.preload(ids);
  }

  /** True when the real output can pre-render (the boot scene shows its progress then). */
  get canPreload(): boolean {
    return typeof (this.inner as AudioOut & { preload?: unknown }).preload === 'function';
  }
}

// ---------------------------------------------------------------------------------------------
// Menu input: both pads plus raw keys, with auto-repeat on held directions
// ---------------------------------------------------------------------------------------------

/** Held directions repeat after this many ticks, then every REPEAT_EVERY ticks. */
const REPEAT_AFTER = 18;
const REPEAT_EVERY = 6;

/** A button went down this tick, or it is held long enough to repeat. */
export function repeatPressed(input: InputManager, slot: 0 | 1, b: Button): boolean {
  const pad = input.pad(slot);
  if (pad.pressed(b)) return true;
  const t = pad.heldTicks(b);
  return t > REPEAT_AFTER && (t - REPEAT_AFTER) % REPEAT_EVERY === 0;
}

export interface MenuKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** fire, jump or start (GDD §13.13: fire confirms; A / Cross on a pad is jump). */
  confirm: boolean;
  /** bomb or a pause key (Esc, P, the pad's Back button). */
  back: boolean;
  /** start alone. */
  start: boolean;
}

const keys: MenuKeys = { up: false, down: false, left: false, right: false, confirm: false, back: false, start: false };

/**
 * Menu buttons this tick from one slot, or from both pads (`slot` omitted). Returns a shared
 * object: read it at once.
 */
export function menuKeys(input: InputManager, slot?: 0 | 1): MenuKeys {
  keys.up = keys.down = keys.left = keys.right = keys.confirm = keys.back = keys.start = false;
  for (let i = 0; i < 2; i++) {
    const s = i as 0 | 1;
    if (slot !== undefined && s !== slot) continue;
    const pad = input.pad(s);
    keys.up ||= repeatPressed(input, s, 'up');
    keys.down ||= repeatPressed(input, s, 'down');
    keys.left ||= repeatPressed(input, s, 'left');
    keys.right ||= repeatPressed(input, s, 'right');
    keys.confirm ||= pad.pressed('fire') || pad.pressed('jump') || pad.pressed('start');
    keys.back ||= pad.pressed('bomb');
    keys.start ||= pad.pressed('start');
  }
  if (slot === undefined || slot === 0) keys.back ||= input.pausePressed;
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Drawing helpers for menus (GDD §13: snow text with a 1 px ink outline, upper case)
// ---------------------------------------------------------------------------------------------

export const UI_WHITE: Color = PAL.snow[3];
export const UI_GOLD: Color = PAL.gold[3];
export const UI_RED: Color = PAL.red[3];
export const UI_GREY: Color = PAL.stone[2];
/** Player colours: P1 sky, P2 gold (GDD §13). */
export const PLAYER_COLORS: readonly Color[] = [PAL.sky[3], PAL.gold[3]];

const opts: TextOpts = { font: 'small', color: UI_WHITE, outline: INK, screen: true, align: 'center' };

/** Centred screen text with an outline. */
export function centerText(r: Renderer, s: string, y: number, color: Color = UI_WHITE, font: 'small' | 'big' = 'small', scale = 1): void {
  opts.font = font;
  opts.color = color;
  opts.scale = scale;
  opts.align = 'center';
  opts.outline = INK;
  r.text(s, r.w >> 1, y, opts);
}

/** Screen text with an outline (`outline` null = none, e.g. ink on paper). */
export function uiText(
  r: Renderer,
  s: string,
  x: number,
  y: number,
  color: Color = UI_WHITE,
  align: 'left' | 'center' | 'right' = 'left',
  font: 'small' | 'big' = 'small',
  outline: Color | null = INK,
): void {
  opts.font = font;
  opts.color = color;
  opts.scale = 1;
  opts.align = align;
  opts.outline = outline ?? undefined;
  r.text(s, x, y, opts);
  opts.outline = INK;
}

/** Width of a text in px. */
export function textWidth(s: string, font: 'small' | 'big' = 'small'): number {
  return measure(s, font);
}

/** On / off for a blink of `on` ticks on and `off` ticks off (GDD §13: 30 / 30). */
export function blinkOn(t: number, on = 30, off = on): boolean {
  return t % (on + off) < on;
}

const panelOpts: DrawOpts = { screen: true };

/**
 * A menu box in the `ui` ramp (GDD §13.8): a dark navy fill at `alpha`, an ink frame and a light
 * top-left bevel.
 */
export function drawPanel(r: Renderer, x: number, y: number, w: number, h: number, alpha = 0.92): void {
  panelOpts.alpha = 1;
  r.rect(x - 1, y - 1, w + 2, h + 2, INK, panelOpts);
  panelOpts.alpha = alpha;
  r.rect(x, y, w, h, PAL.ui[0], panelOpts);
  panelOpts.alpha = 1;
  r.rect(x, y, w, 1, PAL.ui[1], panelOpts);
  r.rect(x, y, 1, h, PAL.ui[1], panelOpts);
  r.rect(x + 1, y + h - 1, w - 1, 1, PAL.navy[0], panelOpts);
  r.rect(x + w - 1, y + 1, 1, h - 1, PAL.navy[0], panelOpts);
}

const cursorOpts: DrawOpts = { screen: true };

/**
 * The menu cursor (GDD §13: a small swan head, `ui/cursor-swan`) with its right edge at x and
 * its centre on y; it bobs 1 px. Falls back to a gold '>'.
 */
export function drawCursor(r: Renderer, x: number, y: number, t: number): void {
  const bob = blinkOn(t, 16) ? 0 : 1;
  if (hasSprite('ui/cursor-swan')) {
    const f = getFrame('ui/cursor-swan', 0);
    r.sprite('ui/cursor-swan', 0, x - frameW(f) + f.ox + bob, y - (frameH(f) >> 1) + f.oy, cursorOpts);
  } else uiText(r, '>', x - 6 + bob, y - 3, UI_GOLD);
}

/**
 * A vertical centred menu (small font, `step` px apart from y): the selected item in gold with
 * the swan cursor left of it, the others in grey (disabled ones darker).
 */
export function drawMenu(r: Renderer, items: readonly string[], selected: number, y: number, t: number, step = 12, font: 'small' | 'big' = 'small', disabled?: readonly boolean[]): void {
  for (let i = 0; i < items.length; i++) {
    const sel = i === selected;
    const off = disabled?.[i] === true;
    const iy = y + i * step;
    centerText(r, items[i], iy, sel ? UI_GOLD : off ? PAL.stone[1] : PAL.snow[1], font);
    if (sel) drawCursor(r, (r.w >> 1) - (measure(items[i], font) >> 1) - 5, iy + (font === 'big' ? 4 : 3), t);
  }
}

/** Seven-digit score text (GDD §14: max 9,999,999). */
export function scoreText(score: number): string {
  return String(Math.max(0, Math.min(9999999, Math.floor(score)))).padStart(7, '0');
}
