/**
 * Continue screen of the first-person mode (docs/design/fps.md §1.10), an overlay on the frozen,
 * dimmed view when its player is out: `CONTINUE?` (big, C, y 60), the countdown 9 … 0 (big ×2,
 * C, y 90; 60 ticks each, every fire / jump press removes 15 ticks; `ui/countdown` per number),
 * `PRESS START` (C, y 130, blinking), `FREE PLAY` / `CREDITS 04` (y 140), the scores (y 152).
 * Music `continue`; at 0 the `game-over` jingle, then GAME OVER. The 2D missions have no
 * continue screen: their countdown runs over the live world (GDD §4.6, mission runner + HUD).
 */
import type { InputManager } from '../../engine/input';
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, PLAYER_COLORS, scoreText, UI_GOLD, UI_RED, UI_WHITE, type GameApp } from '../app';
import type { SlotIndex } from '../session';
import { TUNING } from '../tuning';
import { VOICE } from './flow-data';
import { GameOverScene } from './game-over';

/**
 * The scene under the continue overlay (docs/design/fps.md §1.10): FpsScene implements it.
 */
export interface Continuable {
  /** Use a continue for a slot. False when it is not possible (not out, no credits, not in this mode). */
  continuePlayer(slot: SlotIndex): boolean;
  /** Back to the scene's own music after a continue. */
  resumeMusic(): void;
  /** Hide stale banners and prompts under the overlay (optional). */
  clearOverlays?(): void;
  /**
   * Did this slot's player press start this tick? (optional; default
   * `input.pad(slot).pressed('start')`). The fps mode overrides it: its one player may use any
   * device.
   */
  startPressed?(slot: SlotIndex, input: InputManager): boolean;
  /**
   * May this slot act on the continue screen at all (optional; default true)? The fps mode
   * accepts only its one slot: the waiting slot can neither continue nor shorten the countdown.
   */
  acceptsSlot?(slot: SlotIndex): boolean;
}

/** Ticks the `game-over` jingle plays before GAME OVER. */
const SALUTE_TICKS = 100;

type Phase = 'count' | 'salute';

export class ContinueScene implements Scene {
  readonly transparent = true;
  private readonly app: GameApp;
  private readonly host: Continuable;
  private ticks: number;
  private phase: Phase = 'count';
  private phaseT = 0;
  private t = 0;
  /** The number on screen (9 … 0). */
  private shown = 9;

  constructor(app: GameApp, host: Continuable) {
    this.app = app;
    this.host = host;
    this.ticks = TUNING.continues.seconds * TUNING.continues.ticksPerCount;
  }

  /** The countdown number now showing (9 … 0). */
  get number(): number {
    return Math.max(0, Math.ceil(this.ticks / TUNING.continues.ticksPerCount) - 1);
  }

  enter(): void {
    this.app.input.suppress();
    this.app.audio.duckMusic?.(1);
    this.app.audio.music('continue', { fadeTicks: 20 });
    this.app.audio.voice(VOICE.continue);
    // The world is frozen under this overlay: no stale banner or prompt behind the text.
    this.host.clearOverlays?.();
    this.shown = this.number;
  }

  update(): void {
    this.t++;
    this.phaseT++;
    const input = this.app.input;
    if (this.phase === 'salute') {
      if (this.phaseT >= SALUTE_TICKS || (this.phaseT > 40 && input.anyPressed())) this.gameOver();
      return;
    }
    const credits = this.app.session?.credits ?? Infinity;
    for (let i = 0; i < 2; i++) {
      const slot = this.app.session?.slots[i];
      if (!slot?.joined) continue;
      if (this.host.acceptsSlot && !this.host.acceptsSlot(i as SlotIndex)) continue;
      const pad = input.pad(i as 0 | 1);
      const start = this.host.startPressed?.(i as SlotIndex, input) ?? pad.pressed('start');
      if (start && credits > 0 && this.host.continuePlayer(i as SlotIndex)) {
        this.app.audio.sfx('ui/confirm');
        // Back to whatever the host plays now (the boss song in a boss fight).
        this.host.resumeMusic();
        this.app.scenes.pop();
        return;
      }
      if (pad.pressed('fire') || pad.pressed('jump')) this.ticks -= TUNING.continues.skipTicks;
    }
    // No credits left: nothing to wait for.
    if (credits <= 0 && this.t > 60) this.ticks = 0;
    if (--this.ticks <= 0) {
      this.ticks = 0;
      this.phase = 'salute';
      this.phaseT = 0;
      this.app.audio.music('game-over', { fadeTicks: 10 });
      return;
    }
    const n = this.number;
    if (n !== this.shown) {
      this.shown = n;
      this.app.audio.sfx('ui/countdown');
    }
  }

  private gameOver(): void {
    this.phase = 'count';
    this.app.scenes.replace(new GameOverScene(this.app), { fade: 30 });
  }

  draw(r: Renderer): void {
    r.fade(0x05060aff, 0.5);
    const session = this.app.session;
    const slots = session?.slots.filter((s) => s.joined) ?? [];
    centerText(r, 'CONTINUE?', 60, UI_GOLD, 'big');
    const n = this.number;
    centerText(r, String(n), 90, this.phase === 'salute' || n <= 3 ? UI_RED : UI_WHITE, 'big', 2);
    const credits = session?.credits ?? Infinity;
    if (credits > 0 && this.phase === 'count' && blinkOn(this.t)) centerText(r, 'PRESS START', 130, UI_WHITE);
    centerText(r, credits === Infinity ? 'FREE PLAY' : credits <= 0 ? 'NO CREDITS' : `CREDITS ${String(credits).padStart(2, '0')}`, 140, PAL.stone[3]);
    slots.forEach((s, i) => {
      const label = slots.length > 1 ? `${s.index === 0 ? '1P' : '2P'} SCORE ${scoreText(s.score)}` : `SCORE ${scoreText(s.score)}`;
      centerText(r, label, 152 + i * 10, slots.length > 1 ? PLAYER_COLORS[s.index] : UI_GOLD);
    });
  }
}
