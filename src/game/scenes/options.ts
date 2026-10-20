/**
 * Options (GDD §13.13): the night base (base.ts) under a veil, `OPTIONS` in stencil (C, y 12); rows (small) from y 40, 10 px apart, labels
 * left-aligned at x 64, values right-aligned at x 320 between `<` and `>`; left / right change,
 * fire confirms. DIFFICULTY · CREDITS · MUSIC VOLUME · SFX VOLUME · VOICE VOLUME (announcer and
 * voiced speech bubbles; added 2026-10-14) · ANNOUNCER · SPEECH BUBBLES ·
 * BOSS BAR · SCREEN SHAKE · REDUCE FLASHES · GRAPHICS (PIXEL / SMOOTH / XBR: the sprite filter on
 * a high-resolution display; main.ts applies it; the row shows the filter in effect, `?gfx=`
 * included, and while it is selected a hint line says when the window is too small for it) ·
 * ART DETAIL (AUTO / 4X / 2X / 1X: the art tier of the dense art, main.ts applies it; added
 * 2026-10-19; rows 9 px apart since) ·
 * MOUSE LOOK (ON / OFF) · SENSITIVITY (1–10) (the first-person mode's pointer-lock mouse,
 * docs/design/fps.md §2.3; added 2026-10-16) · CONTROLS (the rebind screen) · RESET HIGH
 * SCORES (`ARE YOU SURE?` → `YES` / `NO`) · BACK. Changes apply at once and are saved on the way
 * out; difficulty and credits apply to the next game.
 */
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { applyAudioSettings, blinkOn, centerText, defaultHighScores, graphicsMode, menuKeys, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { modeAtRes } from '../../engine/render-common';
import { UPSCALE_MODES, type UpscaleMode } from '../../engine/upscale';
import { artTier } from '../../engine/sprites';
import { ART_DETAILS, CREDIT_STEPS, saveSettings, type ArtDetail, type GameSettings, type ShakeLevel } from '../settings';
import { ControlsScene } from './controls';
import { DIFFICULTIES, DIFFICULTY_INFO } from './flow-data';
import { drawBase, drawMilPanel, drawScreenCursor, drawStencilTitle } from './base';
import { veil } from './lake';
import { titleClock } from './title';

export type OptionId =
  | 'difficulty'
  | 'credits'
  | 'music'
  | 'sfx'
  | 'voice'
  | 'announcer'
  | 'bubbles'
  | 'bossBar'
  | 'shake'
  | 'flashes'
  | 'graphics'
  | 'artDetail'
  | 'mouseLook'
  | 'sensitivity'
  | 'controls'
  | 'reset'
  | 'back';

interface Row {
  id: OptionId;
  label: string;
}

export const OPTION_ROWS: readonly Row[] = [
  { id: 'difficulty', label: 'DIFFICULTY' },
  { id: 'credits', label: 'CREDITS' },
  { id: 'music', label: 'MUSIC VOLUME' },
  { id: 'sfx', label: 'SFX VOLUME' },
  { id: 'voice', label: 'VOICE VOLUME' },
  { id: 'announcer', label: 'ANNOUNCER' },
  { id: 'bubbles', label: 'SPEECH BUBBLES' },
  { id: 'bossBar', label: 'BOSS BAR' },
  { id: 'shake', label: 'SCREEN SHAKE' },
  { id: 'flashes', label: 'REDUCE FLASHES' },
  { id: 'graphics', label: 'GRAPHICS' },
  { id: 'artDetail', label: 'ART DETAIL' },
  { id: 'mouseLook', label: 'MOUSE LOOK' },
  { id: 'sensitivity', label: 'SENSITIVITY' },
  { id: 'controls', label: 'CONTROLS' },
  { id: 'reset', label: 'RESET HIGH SCORES' },
  { id: 'back', label: 'BACK' },
];

const SHAKES: readonly ShakeLevel[] = ['full', 'low', 'off'];
/** First row y and row spacing (px); the last row ends above the hint line at y 200. */
export const OPTION_TOP = 40;
export const OPTION_STEP = 9;
const TOP = OPTION_TOP;
const STEP = OPTION_STEP;
const LABEL_X = 64;
const VALUE_X = 320;

/** The value text of a row ('' for the action rows). */
export function optionValue(s: GameSettings, id: OptionId): string {
  switch (id) {
    case 'difficulty':
      return DIFFICULTY_INFO[s.difficulty].name;
    case 'credits':
      return s.credits === 'free' ? 'FREE PLAY' : String(s.credits);
    case 'music':
      return String(s.musicVolume);
    case 'sfx':
      return String(s.sfxVolume);
    case 'voice':
      return String(s.voiceVolume);
    case 'announcer':
      return s.announcer ? 'ON' : 'OFF';
    case 'bubbles':
      return s.speechBubbles ? 'ON' : 'OFF';
    case 'bossBar':
      return s.bossBar ? 'ON' : 'OFF';
    case 'shake':
      return s.screenShake.toUpperCase();
    case 'flashes':
      return s.reduceFlashes ? 'ON' : 'OFF';
    case 'graphics':
      return s.graphics.toUpperCase();
    case 'artDetail':
      return s.artDetail === 'auto' ? 'AUTO' : `${s.artDetail}X`;
    case 'mouseLook':
      return s.mouseLook ? 'ON' : 'OFF';
    case 'sensitivity':
      return String(s.mouseSensitivity);
    default:
      return '';
  }
}

/**
 * Hint for the GRAPHICS row when the window is too small for the chosen filter at backbuffer
 * resolution `res` ('' when the filter is drawn as chosen), e.g. `XBR NEEDS A LARGER WINDOW: SMOOTH`.
 */
export function graphicsHint(mode: UpscaleMode, res: number): string {
  const used = modeAtRes(mode, res);
  return used === mode ? '' : `${mode.toUpperCase()} NEEDS A LARGER WINDOW: ${used.toUpperCase()}`;
}

/**
 * Hint for the ART DETAIL row: the tier in effect (`tier`, sprites.ts `artTier`), e.g.
 * `AUTO: 4X ART`, or `4X NEEDS A LARGER WINDOW: 2X` when the backbuffer cannot show the chosen one.
 */
export function artDetailHint(a: ArtDetail, tier: number): string {
  if (a === 'auto') return `AUTO: ${tier}X ART`;
  return a > tier ? `${a}X NEEDS A LARGER WINDOW: ${tier}X` : '';
}

/** Change one setting by one step (`d` = −1 / +1). Returns true when something changed. */
export function stepOption(s: GameSettings, id: OptionId, d: number): boolean {
  const cycle = <T>(list: readonly T[], v: T): T => list[(list.indexOf(v) + d + list.length) % list.length];
  switch (id) {
    case 'difficulty':
      s.difficulty = cycle(DIFFICULTIES, s.difficulty);
      return true;
    case 'credits':
      s.credits = cycle(CREDIT_STEPS, s.credits);
      return true;
    case 'music':
    case 'sfx':
    case 'voice': {
      const key = id === 'music' ? 'musicVolume' : id === 'sfx' ? 'sfxVolume' : 'voiceVolume';
      const v = Math.max(0, Math.min(10, s[key] + d));
      if (v === s[key]) return false;
      s[key] = v;
      return true;
    }
    case 'announcer':
      s.announcer = !s.announcer;
      return true;
    case 'bubbles':
      s.speechBubbles = !s.speechBubbles;
      return true;
    case 'bossBar':
      s.bossBar = !s.bossBar;
      return true;
    case 'shake':
      s.screenShake = cycle(SHAKES, s.screenShake);
      return true;
    case 'flashes':
      s.reduceFlashes = !s.reduceFlashes;
      return true;
    case 'graphics':
      s.graphics = cycle(UPSCALE_MODES, s.graphics);
      return true;
    case 'artDetail':
      s.artDetail = cycle(ART_DETAILS, s.artDetail);
      return true;
    case 'mouseLook':
      s.mouseLook = !s.mouseLook;
      return true;
    case 'sensitivity': {
      const v = Math.max(1, Math.min(10, s.mouseSensitivity + d));
      if (v === s.mouseSensitivity) return false;
      s.mouseSensitivity = v;
      return true;
    }
    default:
      return false;
  }
}

export interface OptionsOpts {
  /** Opened from the pause menu: the frozen game shows dimmed behind the panel. */
  inGame?: boolean;
  /** Called after every change (the pause menu applies SCREEN SHAKE to the running camera). */
  onChange?: (s: GameSettings) => void;
}

export class OptionsScene implements Scene {
  private readonly app: GameApp;
  private readonly opts: OptionsOpts;
  readonly transparent: boolean;
  private sel = 0;
  private t = 0;
  /** RESET HIGH SCORES asks first: null = no question, 0 = YES, 1 = NO. */
  private confirm: number | null = null;
  private leaving = false;

  constructor(app: GameApp, opts: OptionsOpts = {}) {
    this.app = app;
    this.opts = opts;
    this.transparent = opts.inGame === true;
  }

  enter(): void {
    this.app.input.suppress();
  }

  resume(): void {
    this.app.input.suppress();
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = menuKeys(app.input);
    if (this.confirm !== null) {
      if (k.left || k.right || k.up || k.down) {
        this.confirm = 1 - this.confirm;
        app.audio.sfx('ui/move');
      }
      if (k.back) {
        this.confirm = null;
        app.audio.sfx('ui/cancel');
      } else if (k.confirm) {
        if (this.confirm === 0) {
          app.highScores.entries = defaultHighScores().entries;
          app.highScores.save(app.store);
          app.audio.sfx('ui/confirm');
        } else app.audio.sfx('ui/cancel');
        this.confirm = null;
      }
      return;
    }
    const n = OPTION_ROWS.length;
    if (k.up) this.move(-1, n);
    if (k.down) this.move(1, n);
    const row = OPTION_ROWS[this.sel];
    if (k.left || k.right) this.change(row.id, k.left ? -1 : 1);
    if (k.back) {
      this.close();
      return;
    }
    if (!k.confirm) return;
    switch (row.id) {
      case 'controls':
        app.audio.sfx('ui/confirm');
        app.scenes.push(new ControlsScene(app), { fade: 12 });
        break;
      case 'reset':
        app.audio.sfx('ui/confirm');
        this.confirm = 1;
        break;
      case 'back':
        this.close();
        break;
      default:
        this.change(row.id, 1);
    }
  }

  private move(d: number, n: number): void {
    this.sel = (this.sel + d + n) % n;
    this.app.audio.sfx('ui/move');
  }

  private change(id: OptionId, d: number): void {
    const s = this.app.settings;
    if (id === 'graphics') {
      // Step from the filter on screen; from now on the option rules, not `?gfx=`.
      s.graphics = graphicsMode(this.app);
      this.app.graphicsOverride = null;
    }
    if (!stepOption(s, id, d)) return;
    if (id === 'music' || id === 'sfx' || id === 'voice') applyAudioSettings(this.app.audio, s);
    this.app.audio.sfx('ui/move');
    this.opts.onChange?.(s);
  }

  private close(): void {
    this.leaving = true;
    saveSettings(this.app.store, this.app.settings);
    this.app.audio.sfx('ui/cancel');
    this.app.scenes.pop({ fade: 12 });
  }

  draw(r: Renderer): void {
    if (this.opts.inGame) r.fade(0x05060aff, 0.6);
    else {
      drawBase(r, titleClock() + this.t);
      veil(r, 0.7);
    }
    drawMilPanel(r, 40, 8, 304, 200, 0.9);
    drawStencilTitle(r, 'OPTIONS', 12);
    const s = this.app.settings;
    for (let i = 0; i < OPTION_ROWS.length; i++) {
      const row = OPTION_ROWS[i];
      const y = TOP + i * STEP;
      const sel = i === this.sel;
      const col = sel ? UI_GOLD : PAL.snow[1];
      uiText(r, row.label, LABEL_X, y, col);
      // The cursor at the screen tier (its HD art once the pool has it; 1× at res 1, as before).
      if (sel) drawScreenCursor(r, LABEL_X - 4, y + 3, this.t);
      const v = row.id === 'graphics' ? graphicsMode(this.app).toUpperCase() : optionValue(s, row.id);
      if (v) {
        uiText(r, '>', VALUE_X, y, sel ? UI_GOLD : PAL.stone[2], 'right');
        uiText(r, v, VALUE_X - 9, y, sel ? UI_WHITE : PAL.snow[2], 'right');
        uiText(r, '<', VALUE_X - 9 - (v.length * 6 + 4) - 4, y, sel ? UI_GOLD : PAL.stone[2], 'right');
      }
    }
    if (this.opts.inGame && (OPTION_ROWS[this.sel].id === 'difficulty' || OPTION_ROWS[this.sel].id === 'credits')) {
      centerText(r, 'APPLIES TO THE NEXT GAME', 212 - 12, PAL.stone[3]);
    } else if (OPTION_ROWS[this.sel].id === 'graphics') {
      const hint = graphicsHint(graphicsMode(this.app), this.app.displayRes);
      if (hint) centerText(r, hint, 212 - 12, PAL.stone[3]);
    } else if (OPTION_ROWS[this.sel].id === 'artDetail') {
      centerText(r, artDetailHint(s.artDetail, artTier()), 212 - 12, PAL.stone[3]);
    }
    if (this.confirm !== null) this.drawConfirm(r);
  }

  private drawConfirm(r: Renderer): void {
    drawMilPanel(r, 112, 84, 160, 48, 0.98);
    centerText(r, 'ARE YOU SURE?', 92, UI_WHITE);
    const yes = this.confirm === 0;
    uiText(r, 'YES', 168, 112, yes ? UI_GOLD : PAL.stone[2], 'center');
    uiText(r, 'NO', 216, 112, !yes ? UI_GOLD : PAL.stone[2], 'center');
    if (blinkOn(this.t, 15)) r.rect(yes ? 159 : 208, 121, yes ? 18 : 16, 1, UI_GOLD, { screen: true });
  }
}
