/**
 * The HOW TO PLAY card of the attract loop (GDD §13.3, §15.9 item 5): nine small lines,
 * left-aligned at x 40 from y 40, 12 px apart (the last at y 136): the keys in gold, what they
 * do in white. 300 ticks, then the high scores; any key goes back to the title.
 */
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { centerText, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { HOW_TO_PLAY } from './flow-data';
import { toTitle } from './flow';
import { HighScoresScene } from './high-scores';
import { drawLake, veil } from './lake';

/** GDD §13.3: the card shows for 300 ticks. */
export const HOW_TO_PLAY_TICKS = 300;
/** The action column starts here (the key column starts at x 40). */
const ACTION_X = 160;

export class HowToPlayScene implements Scene {
  private readonly app: GameApp;
  private readonly clock: number;
  private t = 0;
  private leaving = false;

  constructor(app: GameApp, clock = 0) {
    this.app = app;
    this.clock = clock;
  }

  enter(): void {
    this.app.input.suppress();
    this.app.pointerPressed = false;
    this.app.audio.music('title', { fadeTicks: 30 });
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const press = app.input.anyPressed() || app.pointerPressed;
    app.pointerPressed = false;
    if (press) {
      this.leaving = true;
      toTitle(app, 20);
    } else if (this.t >= HOW_TO_PLAY_TICKS) {
      this.leaving = true;
      app.scenes.replace(new HighScoresScene(app, { mode: 'attract', clock: this.clock + this.t }), { fade: 30 });
    }
  }

  draw(r: Renderer): void {
    drawLake(r, this.clock + this.t);
    veil(r, 0.7);
    centerText(r, 'HOW TO PLAY', 16, UI_GOLD, 'big');
    for (let i = 0; i < HOW_TO_PLAY.length; i++) {
      const [keys, action] = HOW_TO_PLAY[i];
      const y = 40 + i * 12;
      if (!action) {
        uiText(r, keys, 40, y, PAL.snow[2]);
        continue;
      }
      uiText(r, keys, 40, y, UI_GOLD);
      uiText(r, action, ACTION_X, y, UI_WHITE);
    }
  }
}
