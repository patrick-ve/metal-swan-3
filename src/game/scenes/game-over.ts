/**
 * Game over (GDD §13.10): `GAME OVER` (big, C, y 96; the letters drop in 4 ticks apart), `THE
 * CRITICS WERE NOT KIND.` (small, C, y 120), each player's final score (small, C, y 140), music
 * `game-over` and the announcer. After 240 ticks: name entry (when a score qualifies), the high
 * scores, the title. Drawn over the frozen, dimmed world.
 */
import { measure } from '../../engine/font';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { centerText, PLAYER_COLORS, scoreText, uiText, UI_RED, UI_WHITE, type GameApp } from '../app';
import { VOICE } from './flow-data';
import { finishGame } from './flow';

/** Ticks before moving on (GDD §13.10); a press after 60 ticks skips the rest. */
export const GAME_OVER_TICKS = 240;
const WORD = 'GAME OVER';
/** Ticks between two letters starting to drop, and the fall time of one letter. */
const LETTER_GAP = 4;
const FALL = 14;

export class GameOverScene implements Scene {
  readonly transparent = true;
  private readonly app: GameApp;
  private t = 0;
  private done = false;

  constructor(app: GameApp) {
    this.app = app;
  }

  enter(): void {
    this.app.input.suppress();
    this.app.audio.duckMusic?.(1);
    this.app.audio.music('game-over', { fadeTicks: 10 });
    this.app.audio.voice(VOICE.gameOver);
  }

  update(): void {
    this.t++;
    if (this.done) return;
    if (this.t >= GAME_OVER_TICKS || (this.t > 60 && this.app.input.anyPressed())) {
      this.done = true;
      finishGame(this.app, false);
    }
  }

  draw(r: Renderer): void {
    r.fade(0x05060aff, 0.7);
    // The letters drop in one by one with a little bounce.
    const x0 = (r.w - measure(WORD, 'big')) >> 1;
    for (let i = 0; i < WORD.length; i++) {
      const ch = WORD[i];
      // Letter i starts where the prefix up to it ends, minus its own width.
      const x = x0 + measure(WORD.slice(0, i + 1), 'big') - measure(ch, 'big');
      const age = this.t - i * LETTER_GAP;
      if (age > 0 && ch !== ' ') {
        const k = Math.min(1, age / FALL);
        const bounce = age > FALL && age < FALL + 6 ? -Math.round(Math.sin(((age - FALL) / 6) * Math.PI) * 3) : 0;
        const y = Math.round(-12 + (96 + 12) * k * k) + bounce;
        uiText(r, ch, x, y, UI_RED, 'left', 'big');
      }
    }
    if (this.t < WORD.length * LETTER_GAP + FALL) return;
    centerText(r, 'UITGEZWAAND!', 120, UI_WHITE);
    const slots = this.app.session?.slots.filter((s) => s.joined) ?? [];
    slots.forEach((s, i) => {
      const tag = slots.length > 1 ? `${s.index === 0 ? '1P' : '2P'} ` : '';
      centerText(r, `${tag}${scoreText(s.score)}`, 140 + i * 10, PLAYER_COLORS[s.index]);
    });
  }
}
