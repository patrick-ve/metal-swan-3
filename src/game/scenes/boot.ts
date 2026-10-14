/**
 * Boot scene (GDD §13.2): loads the content manifest, generates every sprite, pre-renders the
 * sound effects and fetches and decodes the 'boot' sample group (the start screens; a direct
 * `?mission=` start also loads that mission's group) while a row of swan heads fills in, waits
 * for a click or key (the gesture unlocks audio; one made while loading counts), then goes to
 * the title — or straight into a mission with `?mission=`.
 */
import { listSfx } from '../../engine/audio';
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { frameW, getFrame, hasSprite, preloadSprites } from '../../engine/sprites';
import { blinkOn, centerText, type GameApp } from '../app';
import { loadContent } from '../content/index';
import { getMission } from '../registry';
import { startNewGame } from './gameplay';
import { TitleScene } from './title';

type Phase = 'content' | 'sprites' | 'sounds' | 'samples' | 'done';

const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The boot never waits longer than this for the samples (a slow network): the synth fills in. */
export const BOOT_SAMPLES_MAX_MS = 20000;

export class BootScene implements Scene {
  private readonly app: GameApp;
  private phase: Phase = 'content';
  private done = 0;
  private total = 0;
  private finished = false;
  private leaving = false;
  private t = 0;

  constructor(app: GameApp) {
    this.app = app;
  }

  enter(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.app.content = await loadContent();
      this.phase = 'sprites';
      await preloadSprites(undefined, (d, t) => {
        this.done = d;
        this.total = t;
      });
      this.phase = 'sounds';
      const audio = this.app.audio as { preload?: (ids: readonly string[]) => void };
      if (typeof audio.preload === 'function') {
        const ids = listSfx();
        this.done = 0;
        this.total = ids.length;
        for (let i = 0; i < ids.length; i += 8) {
          audio.preload.call(this.app.audio, ids.slice(i, i + 8));
          this.done = Math.min(ids.length, i + 8);
          await nextTick();
        }
      }
      await this.loadSamples();
    } catch (err) {
      console.error('[boot] loading failed:', err);
    }
    this.phase = 'done';
    this.finished = true;
  }

  /**
   * The 'boot' sample group, plus the mission's group for a direct `?mission=` start. A file
   * that fails or a slow network never blocks the boot: after BOOT_SAMPLES_MAX_MS it goes on
   * and the rest keeps loading in the background.
   */
  private async loadSamples(): Promise<void> {
    const audio = this.app.audio;
    if (!audio.loadSamples) return;
    const groups = ['boot'];
    const direct = this.app.params.mission ? getMission(this.app.params.mission)?.audioGroup : undefined;
    if (direct) groups.push(direct);
    this.phase = 'samples';
    this.done = 0;
    this.total = 0;
    const counts = groups.map(() => ({ done: 0, total: 0 }));
    const all = Promise.all(
      groups.map((g, i) =>
        audio.loadSamples?.(g, (d, t) => {
          counts[i] = { done: d, total: t };
          this.done = counts.reduce((n, c) => n + c.done, 0);
          this.total = counts.reduce((n, c) => n + c.total, 0);
        }),
      ),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, BOOT_SAMPLES_MAX_MS);
    });
    await Promise.race([all, timeout]);
    clearTimeout(timer);
  }

  /** True once everything is loaded (it then waits for a gesture). */
  get ready(): boolean {
    return this.finished;
  }

  /** Loading progress 0..1 over the steps (content 10 %, sprites 70 %, sounds 10 %, samples 10 %). */
  get progress(): number {
    const f = this.total > 0 ? Math.min(1, this.done / this.total) : 0;
    switch (this.phase) {
      case 'content':
        return 0;
      case 'sprites':
        return 0.1 + 0.7 * f;
      case 'sounds':
        return 0.8 + 0.1 * f;
      case 'samples':
        return 0.9 + 0.1 * f;
      case 'done':
        return 1;
    }
  }

  update(): void {
    this.t++;
    if (!this.finished || this.leaving) return;
    const app = this.app;
    // GDD §13.2: a click or key unlocks audio. A gesture made while loading counts too.
    if (app.input.anyPressed() || app.pointerPressed) app.gesture = true;
    app.pointerPressed = false;
    if (!app.gesture) return;
    this.leaving = true;
    const p = app.params;
    if (p.mission) startNewGame(app, { mission: p.mission, section: p.section ?? undefined, players: p.players, bossRush: p.boss });
    else app.scenes.replace(new TitleScene(app), { fade: 30 });
  }

  /**
   * GDD §13.2: a black screen; a row of 8 small swan icons (C, y 100) fills in as sprites and
   * sounds pre-render; `TUNING INSTRUMENTS... 64%` (small, C, y 120); when ready `CLICK OR PRESS
   * ANY KEY` (small, C, y 140, blinking).
   */
  draw(r: Renderer): void {
    r.begin(0x000000ff);
    const frac = this.progress;
    const n = 8;
    const icon = hasSprite('ui/icon-life');
    const w = icon ? frameW(getFrame('ui/icon-life', 0)) : 6;
    const step = w + 3;
    const x0 = (r.w - (n * step - 3)) >> 1;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step;
      const lit = frac * n >= i + 1;
      if (icon) r.sprite('ui/icon-life', 0, x + getFrame('ui/icon-life', 0).ox, 100 + getFrame('ui/icon-life', 0).oy, lit ? plain : dark);
      else r.rect(x, 101, 6, 6, lit ? PAL.snow[3] : PAL.ink[1], plain);
    }
    centerText(r, `TUNING INSTRUMENTS... ${Math.floor(frac * 100)}%`, 120, PAL.stone[3]);
    if (this.finished && !this.app.gesture && blinkOn(this.t)) centerText(r, 'CLICK OR PRESS ANY KEY', 140, PAL.snow[3]);
    const failed = this.app.content?.failed.length ?? 0;
    if (failed > 0) centerText(r, `${failed} CONTENT MODULE(S) FAILED - SEE CONSOLE`, 160, PAL.red[3]);
  }
}

const plain: DrawOpts = { screen: true };
const dark: DrawOpts = { screen: true, tint: PAL.ink[1] };
