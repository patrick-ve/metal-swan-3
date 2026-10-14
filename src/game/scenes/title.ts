/**
 * Title and attract (GDD §1.3, §13.3): the lake at dusk with the SWAN-3 gliding across it
 * (Grace on her back), a tiny Legion parade on the far bank, the logo (`ui/logo`, C, y 20–84),
 * the tagline (small, C, y 92; the alternates cycle every 300 ticks), `PRESS START` (big, C,
 * y 160, blinking), `HI 0500000` (small, C, y 4) and the footer (`(C) 2026 THE METAL SWAN 3 TEAM`
 * at C, y 206; `FREE PLAY` / `CREDITS 05` right-aligned at (380, 206)). Music `title` over the
 * lake loop `env/title-lake`; the first visit after the boot screen opens with `ui/title-sting`.
 *
 * After 600 idle ticks the attract loop runs: demo play (the bot on ams-a, 1200 ticks; m1-a
 * or m0-a when it is missing) → HOW TO PLAY (300 ticks) → high scores (300 ticks) → the title with the next
 * tagline. Start → the mode select.
 */
import { INK, PAL } from '../../engine/palette';
import type { InputSource } from '../../engine/input';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { frameW, getFrame, hasSprite } from '../../engine/sprites';
import { blinkOn, centerText, scoreText, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { getMission, hasCharacter, hasMission } from '../registry';
import { GameSession } from '../session';
import { ROSTER, TAGLINES } from './flow-data';
import { GameplayScene } from './gameplay';
import { HowToPlayScene } from './how-to-play';
import { drawLake, drawParade, drawRiddenSwan, LAKE_SURFACE, SWAN_SPEED } from './lake';
import { ModeSelectScene } from './mode-select';

/** GDD §13.3: the attract loop starts after 600 idle ticks; the demo lasts 1200. */
export const ATTRACT_IDLE_TICKS = 600;
export const DEMO_TICKS = 1200;
/** Each tagline shows for 300 ticks (GDD §1.3). */
const TAGLINE_TICKS = 300;
/** The lake's ambience loop under the title song (audio key and level). */
const LAKE_LOOP = { key: 'title-lake', id: 'env/title-lake', vol: 0.5 } as const;
/** The logo sting plays once per page load: on the first title visit after the boot screen. */
let stingPlayed = false;

/** The bot class, loaded lazily (src/sim is not needed until the first demo). */
type BotModule = typeof import('../../sim/bot');
let botModule: BotModule | null = null;
let botLoading = false;

function loadBot(): void {
  if (botModule || botLoading) return;
  botLoading = true;
  import('../../sim/bot')
    .then((m) => {
      botModule = m;
    })
    .catch((err: unknown) => {
      console.warn('[title] attract demo bot unavailable:', err);
    });
}

/**
 * A clock shared by every title visit, so the swan keeps gliding across the lake. It starts with
 * her already on the water (x 80), so the first visit sees her before the attract loop.
 */
let lakeClock = 640;

const plain: DrawOpts = { screen: true };

/** The swan's x on her endless pass over the lake (enters left, leaves right, comes back). */
export function swanX(clock: number, w = 384): number {
  const span = w + 160;
  return ((clock * SWAN_SPEED) % span) - 80;
}

export class TitleScene implements Scene {
  private readonly app: GameApp;
  private t = 0;
  private idle = 0;
  private leaving = false;

  constructor(app: GameApp) {
    this.app = app;
  }

  enter(): void {
    const app = this.app;
    app.input.players = 1;
    app.input.suppress();
    app.session = null;
    app.campaign = null;
    app.pointerPressed = false;
    app.audio.duckMusic?.(1);
    app.audio.music('title', { fadeTicks: 30 });
    if (!stingPlayed) {
      stingPlayed = true;
      app.audio.sfx('ui/title-sting');
    }
    app.audio.sfxLoop?.(LAKE_LOOP.key, LAKE_LOOP.id, { vol: LAKE_LOOP.vol });
    loadBot();
  }

  exit(): void {
    this.app.audio.stopSfx?.(LAKE_LOOP.key, 20);
  }

  /** The tagline on screen now. */
  get tagline(): string {
    const step = this.app.attractStep + Math.floor(this.t / TAGLINE_TICKS);
    return TAGLINES[step % TAGLINES.length];
  }

  update(): void {
    this.t++;
    lakeClock++;
    if (this.leaving) return;
    const app = this.app;
    const input = app.input;
    const press = input.anyPressed() || app.pointerPressed;
    app.pointerPressed = false;
    const pad = input.pad(0);
    const start = pad.pressed('start') || pad.pressed('fire') || pad.pressed('jump') || input.keyPressed('Enter');
    if (start) {
      this.leaving = true;
      app.audio.sfx('ui/confirm');
      app.scenes.replace(new ModeSelectScene(app), { fade: 16 });
      return;
    }
    if (press) this.idle = 0;
    else if (++this.idle >= ATTRACT_IDLE_TICKS) this.startAttract();
  }

  /** The attract loop: the demo when the bot is loaded, else straight to HOW TO PLAY. */
  private startAttract(): void {
    this.leaving = true;
    const app = this.app;
    const loop = app.attractStep;
    app.attractStep++;
    const demo = this.makeDemo(loop);
    if (demo) app.scenes.replace(demo, { fade: 30 });
    else app.scenes.replace(new HowToPlayScene(app, lakeClock), { fade: 30 });
  }

  /**
   * The demo game on ams-a (m1-a, else m0-a, when it is missing). The GDD's riding demo on m1-c for every
   * second loop waits for a bot that can ride the Swan.
   */
  private makeDemo(loop: number): Scene | null {
    const Bot = botModule?.Bot;
    if (!Bot) return null;
    const app = this.app;
    const mission = hasMission('ams') ? 'ams' : hasMission('m1') ? 'm1' : 'm0';
    const section = 'a';
    const ids = ROSTER.filter((id) => hasCharacter(id));
    const char = ids.length ? ids[loop % ids.length] : 'recruit';
    const session = new GameSession({ difficulty: 'normal', characters: [char], seed: 101 + loop * 17 });
    let scene: GameplayScene | null = null;
    const host = {
      get topScene(): Scene | null {
        return app.scenes.top;
      },
      get runner(): GameplayScene['runner'] | null {
        return scene?.runner ?? null;
      },
    };
    const bot: InputSource = new Bot(host, 0, { route: loop % 2 ? 'upper' : 'lower' });
    scene = new GameplayScene(app, {
      mission,
      section: getMission(mission)?.sections[section] ? section : undefined,
      session,
      demo: {
        bot,
        ticks: DEMO_TICKS,
        onEnd: (byKey) => {
          if (byKey) app.scenes.reset(new TitleScene(app), { fade: 20 });
          else app.scenes.reset(new HowToPlayScene(app, lakeClock), { fade: 30 });
        },
      },
    });
    return scene;
  }

  draw(r: Renderer): void {
    const t = this.t;
    drawLake(r, lakeClock);
    drawParade(r, lakeClock);
    drawRiddenSwan(r, Math.round(swanX(lakeClock, r.w)), LAKE_SURFACE + 16, lakeClock);
    // Logo (C, y 20–84) or a text stand-in.
    if (hasSprite('ui/logo')) {
      const f = getFrame('ui/logo', 0);
      r.sprite('ui/logo', 0, ((r.w - frameW(f)) >> 1) + f.ox, 18 + f.oy, plain);
    } else centerText(r, 'METAL SWAN 3', 44, UI_WHITE, 'big', 3);
    centerText(r, this.tagline, 92, PAL.snow[2]);
    if (blinkOn(t)) centerText(r, 'PRESS START', 160, UI_GOLD, 'big');
    centerText(r, `HI ${scoreText(this.app.highScores.top)}`, 4, UI_WHITE);
    centerText(r, '(C) 2026 THE METAL SWAN 3 TEAM', 206, PAL.stone[3]);
    const c = this.app.settings.credits;
    uiText(r, c === 'free' ? 'FREE PLAY' : `CREDITS ${String(c).padStart(2, '0')}`, 380, 206, PAL.snow[1], 'right', 'small', INK);
  }
}

/** The lake clock (other attract screens keep the water moving with it). */
export function titleClock(): number {
  return lakeClock;
}
