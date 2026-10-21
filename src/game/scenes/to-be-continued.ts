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
import { drawGhost } from '../content/oldenzaal/kit/ghost-draw';
import type { DrawOpts } from '../../engine/render';
import { setArtDensity } from '../../engine/sprites';
import { screenArt } from './base';

/** The card's length and when a press may skip it. */
export const TBC_TICKS = 300;
export const TBC_SKIP_AFTER = 60;
/** The title fades in over this many ticks. */
const FADE_IN = 40;

/**
 * Wave B (STATUE): the Swan's jet trail crosses the night sky (a light streak, ticks `from` …
 * `from + ticks`, then it fades), and Mevrouw Winkel's face fades in above the title, see-through
 * (`drawGhost`), and laughs once (`oz/ghost/laugh` at `laughAt`; frame 1 for `laughFor` ticks).
 */
export const TBC_TRAIL = { from: 10, ticks: 150, tail: 0.42, fadeOut: 0.6 } as const;
export const TBC_FACE = { from: 60, fade: 80, laughAt: 130, laughFor: 70, x: 192, y: 86, alpha: 0.45 } as const;
/** The card's sprites (content/bosses/oldenzaal/tbc-art.ts registers them; not imported here: no side effects in the scene). */
const TBC_ART = 'ui/oz-tbc';
const trailOpts: DrawOpts = { blend: 'add', screen: true };
const jetOpts: DrawOpts = { screen: true, flipX: true };
/** The card's sprites as one screen-art group: drawn at the screen tier (2× / 4×) once built. */
const TBC_IDS: readonly string[] = [`${TBC_ART}/face`, `${TBC_ART}/glow`, `${TBC_ART}/jet`];

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
    if (this.t === TBC_FACE.laughAt) this.app.audio.sfx('oz/ghost/laugh');
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
    // The face, the glow and the jet at the screen tier (the pool builds them; 1x until then).
    const prev = setArtDensity(screenArt(r, TBC_IDS));
    this.drawExtra(r);
    setArtDensity(prev);
    if (this.t >= FADE_IN >> 1) centerText(r, TBC_TITLE, 92, this.t >= FADE_IN ? UI_GOLD : PAL.gold[1], 'big');
    if (this.t >= FADE_IN) centerText(r, TBC_SUB, 112, PAL.snow[1]);
    if (this.t >= TBC_SKIP_AFTER && blinkOn(this.t)) centerText(r, 'PRESS START', 196, UI_WHITE);
  }

  /** The jet trail's point at s (0 … 1): from off the left edge to off the right, a gentle arc. */
  private static trailAt(s: number, out: [number, number]): [number, number] {
    out[0] = -24 + 432 * s;
    out[1] = 64 - 36 * s - Math.sin(s * Math.PI) * 14;
    return out;
  }

  /** Wave B: the Swan's jet trail and the ghost's face. */
  protected drawExtra(r: Renderer): void {
    const t = this.t;
    const T = TBC_TRAIL;
    const k = (t - T.from) / T.ticks;
    if (k > 0 && k < 1 + T.fadeOut) {
      const head = Math.min(1, k);
      const fade = k <= 1 ? 1 : 1 - (k - 1) / T.fadeOut;
      const pt = ToBeContinuedScene.pt;
      for (let s = Math.max(0, head - T.tail); s <= head; s += 0.004) {
        const a = (1 - (head - s) / T.tail) * fade;
        ToBeContinuedScene.trailAt(s, pt);
        trailOpts.alpha = a * 0.8;
        r.rect(Math.round(pt[0]), Math.round(pt[1]), 2, 1, a > 0.6 ? PAL.snow[3] : PAL.snow[1], trailOpts);
      }
      if (k < 1) {
        ToBeContinuedScene.trailAt(head, pt);
        r.sprite(`${TBC_ART}/jet`, (t >> 2) & 1, Math.round(pt[0]), Math.round(pt[1]), jetOpts);
      }
    }
    const F = TBC_FACE;
    if (t >= F.from) {
      const a = Math.min(1, (t - F.from) / F.fade) * F.alpha;
      const laughing = t >= F.laughAt && t < F.laughAt + F.laughFor;
      drawGhost(r, `${TBC_ART}/face`, laughing ? 1 : 0, F.x, F.y + (laughing && (t >> 3) % 2 === 0 ? -1 : 0), { alpha: a, glow: `${TBC_ART}/glow`, glowAlpha: 0.3 * (a / F.alpha), t, screen: true });
    }
  }

  private static readonly pt: [number, number] = [0, 0];
}
