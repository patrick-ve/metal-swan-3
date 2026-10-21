/**
 * StoryCardScene (docs/design/oldenzaal.md §1; docs/api/oldenzaal.md "Flow"): the typed story card
 * between the first-person floors and mission `oldenzaal`, in the glitch bridge's card pattern:
 * the lines type in one after another, centred, over a dark dusk sky (a few cold stars, a red band
 * low on the horizon); `PRESS START` once they are typed. A press after CARD_PRESS_FROM finishes
 * the typing; the next press (or CARD_HOLD ticks after the last line) moves on to the `MISSION 4`
 * intro card (MissionIntroScene). The lines: missions/oldenzaal/lines.ts `STORY_CARD_LINES`.
 *
 * On enter the first-person mode's dense art is dropped (the route never goes back to it): the
 * mission's tier-4 working set gets the DENSE_BUDGET_BYTES. Cosmetic only; no randomness.
 */
import { hasSfx } from '../../engine/audio';
import { PAL } from '../../engine/palette';
import { PAL_HD_OZ } from '../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../engine/render';
import { releaseRayHd } from '../../engine/ray/textures';
import type { Scene } from '../../engine/scene';
import { generatedSprites, releaseDense } from '../../engine/sprites';
import { blinkOn, centerText, textWidth, uiText, UI_WHITE, type GameApp } from '../app';
import { OLDENZAAL_ID } from '../content/missions/oldenzaal/ids';
import { STORY_CARD_LINES } from '../content/missions/oldenzaal/lines';
import { MissionIntroScene } from './mission-intro';

/** Ticks per typed character, ticks between two lines (the glitch bridge's pace). */
export const STORY_TYPE_TICKS = 2;
export const STORY_LINE_GAP = 24;
/** Typing starts after this many ticks (the fade in). */
export const STORY_TYPE_START = 30;
/** Presses count from this tick on. */
export const STORY_PRESS_FROM = 40;
/** The card holds this long after the last line before it moves on by itself. */
export const STORY_HOLD = 180;
/** Layout: first line y, line step. */
export const STORY_Y = 52;
export const STORY_STEP = 20;

const W = 384;
const plain: DrawOpts = { screen: true };
const starOpts: DrawOpts = { screen: true, alpha: 0.7 };

export interface StoryCardOpts {
  /** The lines (default STORY_CARD_LINES). */
  lines?: readonly string[];
  /** What follows (default: the `MISSION 4` intro card of oldenzaal). */
  next?: (app: GameApp) => Scene;
}

/** Drop the first-person mode's dense art: its 4× sprites and the ray textures' HD levels. */
export function releaseFpsDense(): number {
  const n = releaseDense(generatedSprites(4).filter((id) => id.startsWith('fps/')), 4);
  releaseRayHd();
  return n;
}

export class StoryCardScene implements Scene {
  private readonly app: GameApp;
  readonly lines: readonly string[];
  private readonly next: (app: GameApp) => Scene;
  private readonly lineStart: number[] = [];
  private readonly lineX: number[] = [];
  /** Tick (from STORY_TYPE_START) at which every line is typed. */
  private typedAt: number;
  private t = 0;
  private leaving = false;
  private skipped = false;
  private typedCount = 0;

  constructor(app: GameApp, o: StoryCardOpts = {}) {
    this.app = app;
    this.lines = o.lines ?? STORY_CARD_LINES;
    this.next = o.next ?? ((a) => new MissionIntroScene(a, OLDENZAAL_ID));
    let at = 0;
    for (const l of this.lines) {
      this.lineStart.push(at);
      this.lineX.push(Math.round((W - textWidth(l)) / 2));
      at += l.length * STORY_TYPE_TICKS + STORY_LINE_GAP;
    }
    this.typedAt = at - STORY_LINE_GAP;
  }

  /** Ticks since the card opened. */
  get ticks(): number {
    return this.t;
  }

  /** Every line is typed. */
  get typed(): boolean {
    return this.t - STORY_TYPE_START >= this.typedAt;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    app.pointerPressed = false;
    app.audio.music(null, { fadeTicks: 30 });
    releaseFpsDense();
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const press = this.pressed();
    const ct = this.t - STORY_TYPE_START;
    this.typeSounds(ct);
    if (press && this.t >= STORY_PRESS_FROM) {
      if (ct < this.typedAt) {
        this.typedAt = Math.max(0, ct);
        this.skipped = true;
      } else this.go();
      return;
    }
    if (ct >= this.typedAt + STORY_HOLD) this.go();
  }

  private go(): void {
    this.leaving = true;
    this.app.scenes.replace(this.next(this.app), { fade: 40 });
  }

  /** start / fire / Enter / a click (any pad). */
  private pressed(): boolean {
    const app = this.app;
    const k = app.input;
    const p = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.pad(1).pressed('fire') || k.keyPressed('Enter') || app.pointerPressed;
    app.pointerPressed = false;
    return p;
  }

  /** The typewriter click on every second non-space character (the fps mode's, when loaded). */
  private typeSounds(ct: number): void {
    if (this.skipped || ct <= 0 || ct > this.typedAt) return;
    for (let i = 0; i < this.lines.length; i++) {
      const rel = ct - this.lineStart[i];
      if (rel <= 0 || rel % STORY_TYPE_TICKS !== 0) continue;
      const n = rel / STORY_TYPE_TICKS;
      const line = this.lines[i];
      if (n > line.length || line.charCodeAt(n - 1) === 32) continue;
      this.typedCount++;
      if (this.typedCount % 2 === 0 && hasSfx('fps/type')) this.app.audio.sfx('fps/type');
    }
  }

  /** Characters of line `i` shown at card tick `ct`. */
  private shownChars(i: number, ct: number): number {
    const line = this.lines[i];
    if (ct >= this.typedAt) return line.length;
    return Math.max(0, Math.min(line.length, Math.floor((ct - this.lineStart[i]) / STORY_TYPE_TICKS)));
  }

  draw(r: Renderer): void {
    r.begin(PAL_HD_OZ.night[0]);
    drawDuskSky(r, this.t);
    const ct = this.t - STORY_TYPE_START;
    for (let i = 0; i < this.lines.length; i++) {
      const n = this.shownChars(i, ct);
      if (n <= 0) continue;
      const line = this.lines[i];
      uiText(r, n >= line.length ? line : line.slice(0, n), this.lineX[i], STORY_Y + i * STORY_STEP, UI_WHITE);
    }
    if (ct >= this.typedAt && blinkOn(ct - this.typedAt)) centerText(r, 'PRESS START', 196, UI_WHITE);
  }
}

/** A cheap integer hash (stars; cosmetic, the same every frame). */
function h(n: number): number {
  let x = (n * 0x45d9f3b) >>> 0;
  x = ((x ^ (x >>> 16)) * 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** The dusk sky's colour bands, top to bottom (built once). */
const DUSK_BANDS = [PAL_HD_OZ.night[1], PAL_HD_OZ.dusk[0], PAL_HD_OZ.dusk[1], PAL_HD_OZ.dusk[2], PAL_HD_OZ.dusk[3], PAL_HD_OZ.dusk[4]] as const;

/**
 * The card's sky: night blue from the top, a low violet → red band at the horizon (the sun has
 * just gone; the town is east), a few cold stars that twinkle slowly. Screen space.
 */
export function drawDuskSky(r: Renderer, t: number): void {
  const bands = DUSK_BANDS;
  const top = 156;
  for (let i = 0; i < bands.length; i++) r.rect(0, top + i * 8, W, i === bands.length - 1 ? 216 - top - i * 8 : 8, bands[i], plain);
  // The town on the horizon: gabled roofs of uneven width and height, and the basilica's square
  // tower with its small spire (a plain silhouette).
  const ink = PAL.ink[1];
  r.rect(0, 206, W, 10, ink, plain);
  let x = 0;
  for (let i = 0; x < W; i++) {
    const v = h(i + 101);
    const w = 14 + (v % 13);
    const hgt = 8 + ((v >>> 5) % 9);
    const y = 206 - hgt;
    r.rect(x, y, w, hgt, ink, plain);
    // The gable: rows that narrow by 2 px each side.
    for (let k = 1; 2 * k < w - 2 && k <= 6; k++) r.rect(x + 2 * k, y - k, w - 4 * k, 1, ink, plain);
    x += w;
  }
  r.rect(284, 160, 14, 46, ink, plain);
  r.rect(286, 152, 10, 8, ink, plain);
  r.rect(288, 146, 6, 6, ink, plain);
  r.rect(290, 138, 2, 8, ink, plain);
  r.rect(288, 141, 6, 1, ink, plain);
  for (let i = 0; i < 40; i++) {
    const v = h(i + 7);
    const sx = v % W;
    const sy = (v >>> 9) % 140;
    if ((((t >> 4) + i) & 7) === 0) continue;
    r.rect(sx, sy, 1, 1, i % 5 === 0 ? PAL.snow[3] : PAL.snow[1], starOpts);
  }
}
