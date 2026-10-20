/**
 * Title and attract (GDD §1.3, §13.3; military look, docs/design/squad.md §3.2): the night base
 * (base.ts) with searchlights sweeping behind the logo and the SWAN-3 patrolling behind the
 * sandbag wall with `vincent` on her back (0.4 px/tick, turning at the ends), the logo (`ui/logo`,
 * C, y 18–84), the tagline (small, C, y 92; the alternates cycle every 300 ticks), `PRESS START`
 * in gold stencil (C, y 114, blinking), `HI 0500000` (small, C, y 4) and the footer (`(C) 2026
 * THE METAL SWAN 3 TEAM` at C, y 206; `FREE PLAY` / `CREDITS 05` right-aligned at (380, 206)).
 * Music `title` over the ambience loop `env/title-lake`; the first visit after the boot screen
 * opens with `ui/title-sting`.
 *
 * After 600 idle ticks the attract loop runs: demo play (the bot on ams-a, 1200 ticks; m1-a
 * or m0-a when it is missing; the soldier cycles through the roster) → HOW TO PLAY (300 ticks) →
 * high scores (300 ticks) → the title with the next tagline. Start → the mode select.
 *
 * Gamepads (docs/design/ams-extras.md §10): the pad whose START (or south / west button) leaves
 * the title claims player 1; while pads are connected a small line names them over the footer
 * (`DUALSENSE + XBOX READY`, y 194).
 */
import { INK, PAL } from '../../engine/palette';
import type { InputSource } from '../../engine/input';
import { PAD } from '../../engine/pads';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { frameW, getFrame, hasSprite } from '../../engine/sprites';
import { blinkOn, centerText, scoreText, uiText, UI_WHITE, type GameApp } from '../app';
import { getMission, hasCharacter, hasMission } from '../registry';
import { GameSession } from '../session';
import { ROSTER, TAGLINES } from './flow-data';
import { GameplayScene } from './gameplay';
import { HowToPlayScene } from './how-to-play';
import { BASE_PATROL_Y, drawBase, drawBaseWall, drawScreenSprite, drawStencilTitle, keepForHeroes, NO_WALL, patrolFlip, patrolX, prefetchScreenArt, releaseScreenArt } from './base';
import { drawSwanRig, SWAN_SPEED, type SwanRigOpts } from './lake';
import { ModeSelectScene } from './mode-select';
import { connectedModels } from './pad-prompt';
import { stencilId } from '../content/ui/military.art';

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
/** The stencil title of the mode select (the next screen): built while the title shows. */
const NEXT_TITLES: readonly string[] = [stencilId('SELECT OPERATION')];

/** The swan's x on her endless pass over the lake (enters left, leaves right, comes back). */
export function swanX(clock: number, w = 384): number {
  const span = w + 160;
  return ((clock * SWAN_SPEED) % span) - 80;
}

/** The patrol's rig: walking, the relaxed neck, the rider sitting up (docs/design/squad.md §3.2). */
const patrolOpts: SwanRigOpts = { anim: 'move', neck: 'neck-relax', char: 'vincent', pose: 'ride-sit', bodyTicks: 8, screen: true };

/** The patrol's rider: `vincent`, else the first registered roster soldier. */
export function patrolRider(): string {
  if (hasCharacter('vincent')) return 'vincent';
  return ROSTER.find((id) => hasCharacter(id)) ?? 'recruit';
}

export class TitleScene implements Scene {
  private readonly app: GameApp;
  private readonly rider = patrolRider();
  private t = 0;
  private idle = 0;
  private leaving = false;
  /** The next screen's stencil title was handed to the screen art pool (once). */
  private prefetched = false;
  private readonly models: string[] = [];
  private pads = '';
  private padsAt = -1;

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

  /** The connected pads line (`DUALSENSE + XBOX READY`; '' without pads), checked twice a second. */
  padLine(): string {
    if (this.padsAt < 0 || this.t - this.padsAt >= 30) {
      this.padsAt = this.t;
      const models = connectedModels(this.app.input, this.models);
      this.pads = models.length === 0 ? '' : models.length > 2 ? `${models.length} CONTROLLERS READY` : `${models.join(' + ')} READY`;
    }
    return this.pads;
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
      // A pad's START (or south / west button) claims player 1 (sticky).
      const gp = input.padPressed(PAD.start, PAD.south, PAD.west);
      if (gp >= 0) input.claimPad(0, gp);
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
    // The demo is the game proper: the screens' 4× art makes room for its working set.
    releaseScreenArt(keepForHeroes([char]));
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
    // The night base; the SWAN-3 patrols behind the sandbag wall with her rider.
    drawBase(r, lakeClock, NO_WALL);
    patrolOpts.char = this.rider;
    patrolOpts.flipX = patrolFlip(lakeClock, r.w);
    drawSwanRig(r, Math.round(patrolX(lakeClock, r.w)), BASE_PATROL_Y, lakeClock, patrolOpts);
    drawBaseWall(r);
    // Logo (C, y 18–84) or a text stand-in.
    if (hasSprite('ui/logo')) {
      const f = getFrame('ui/logo', 0, 1);
      drawScreenSprite(r, 'ui/logo', 0, ((r.w - frameW(f)) >> 1) + f.ox, 18 + f.oy, plain);
    } else centerText(r, 'METAL SWAN 3', 44, UI_WHITE, 'big', 3);
    centerText(r, this.tagline, 92, PAL.sand[3]);
    if (blinkOn(t)) drawStencilTitle(r, 'PRESS START', 114);
    if (!this.prefetched) {
      this.prefetched = true;
      prefetchScreenArt(r, NEXT_TITLES);
    }
    centerText(r, `HI ${scoreText(this.app.highScores.top)}`, 4, UI_WHITE);
    centerText(r, '(C) 2026 THE METAL SWAN 3 TEAM', 206, PAL.stone[3]);
    const pads = this.padLine();
    if (pads) centerText(r, pads, 194, PAL.sky[3]);
    const c = this.app.settings.credits;
    uiText(r, c === 'free' ? 'FREE PLAY' : `CREDITS ${String(c).padStart(2, '0')}`, 380, 206, PAL.snow[1], 'right', 'small', INK);
  }
}

/** The lake clock (other attract screens keep the water moving with it). */
export function titleClock(): number {
  return lakeClock;
}
