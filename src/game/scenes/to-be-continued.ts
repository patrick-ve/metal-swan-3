/**
 * ToBeContinuedScene (docs/design/oldenzaal.md §1, §6; docs/api/oldenzaal.md "Flow"): after the
 * MISSION COMPLETE tally of `oldenzaal`, before today's ending (the first-person variant). Wave A:
 * the simple card — the night sky over the town, `TO BE CONTINUED` (big) and one small line, about
 * TBC_TICKS ticks, skippable after TBC_SKIP_AFTER. Wave B (FINALE) adds the Swan's jet trail,
 * Mevrouw Winkel's face fading in and her laugh (`drawExtra` is the hook it fills).
 *
 * Stage 2 plugs in between this card and the ending later (`next`). On enter the mission's 4×
 * frames are dropped (the route never goes back to it): the ending's screen art gets the budget.
 */
import { hasSong } from '../../engine/music';
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { OZ_SONG } from '../content/missions/oldenzaal/ids';
import { TBC_SUB, TBC_TITLE } from '../content/missions/oldenzaal/lines';
import { EndingScene } from './ending';
import { releaseMissionDense } from './glitch-bridge';
import { drawDuskSky } from './story-card';

/** The card's length and when a press may skip it. */
export const TBC_TICKS = 300;
export const TBC_SKIP_AFTER = 60;
/** The title fades in over this many ticks. */
const FADE_IN = 40;

export interface TbcOpts {
  /** What follows (default: today's ending, its first-person variant). */
  next?: (app: GameApp) => Scene;
}

export class ToBeContinuedScene implements Scene {
  private readonly app: GameApp;
  private readonly next: (app: GameApp) => Scene;
  private t = 0;
  private leaving = false;

  constructor(app: GameApp, o: TbcOpts = {}) {
    this.app = app;
    this.next = o.next ?? ((a) => new EndingScene(a, { variant: 'fps' }));
  }

  get ticks(): number {
    return this.t;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    app.pointerPressed = false;
    app.audio.music(hasSong(OZ_SONG.tbc) ? OZ_SONG.tbc : null, { fadeTicks: 20 });
    releaseMissionDense();
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = app.input;
    const press = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.pad(1).pressed('fire') || k.keyPressed('Enter') || app.pointerPressed;
    app.pointerPressed = false;
    if (this.t >= TBC_TICKS || (press && this.t >= TBC_SKIP_AFTER)) {
      this.leaving = true;
      app.scenes.reset(this.next(app), { fade: 60 });
    }
  }

  draw(r: Renderer): void {
    r.begin(PAL.ink[0]);
    drawDuskSky(r, this.t + 600);
    this.drawExtra(r);
    if (this.t >= FADE_IN >> 1) centerText(r, TBC_TITLE, 92, this.t >= FADE_IN ? UI_GOLD : PAL.gold[1], 'big');
    if (this.t >= FADE_IN) centerText(r, TBC_SUB, 112, PAL.snow[1]);
    if (this.t >= TBC_SKIP_AFTER && blinkOn(this.t)) centerText(r, 'PRESS START', 196, UI_WHITE);
  }

  /** Wave B: the jet trail and the ghost's face (nothing in wave A). */
  protected drawExtra(_r: Renderer): void {}
}
