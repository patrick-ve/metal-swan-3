/**
 * Pause (GDD §13.8), an overlay on the frozen game: the world dims (black at 50 %), the music
 * plays at half volume (GameplayScene.pause), a centre box 160 × 80 in the `ui` ramp with `PAUSE`
 * (big, C, y 76) and the menu `RESUME` · `OPTIONS` · `QUIT TO TITLE` (small, C, from y 96, 12 px
 * apart). QUIT asks `QUIT? PROGRESS WILL BE LOST.` → `YES` / `NO` (default NO). Esc / P / start
 * on RESUME go back to the game.
 *
 * Gag: after 600 ticks a tiny Legion private walks onto the box, sits on its top edge and falls
 * asleep (snore bubble). He is gone when the game resumes. The gag draws at the art tier
 * (base.ts `screenTier`): like the mission, a 4× frame not built yet shows its 2× art and is queued.
 *
 * Gamepads (docs/design/ams-extras.md §10): when a pad was used last, a help line under the box
 * shows its buttons (`{FIRE} FIRE …`, pad-prompt.ts). `LostPadScene` is the lost-pad pause.
 */
import { ACTION_BUTTONS, type InputManager } from '../../engine/input';
import { PAD } from '../../engine/pads';
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { getFrame, hasSprite, setArtDensity } from '../../engine/sprites';
import { blinkOn, centerText, drawMenu, drawPanel, menuKeys, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import type { GameSettings } from '../settings';
import { toTitle } from './flow';
import { OptionsScene } from './options';
import { screenTier } from './base';
import { drawPadLine, promptPad, slotPadMap } from './pad-prompt';

/** The pad help line under the pause box (the labels of the pad used last). */
export const PAUSE_PAD_HELP = '{FIRE}: FIRE   {JUMP}: JUMP   {BOMB}: BOMB   {START}: PAUSE';

/**
 * The scene under the pause menu (docs/design/fps.md §1.10): GameplayScene (camera shake) or
 * FpsScene (mouse look, sensitivity).
 */
export interface PauseHost {
  /** OPTIONS changed a setting while paused. */
  applySettings?(s: GameSettings): void;
}

export const PAUSE_ITEMS = ['RESUME', 'OPTIONS', 'QUIT TO TITLE'] as const;
/** The box (GDD §13.8): 160 × 80, centred. */
const BOX = { x: 112, y: 68, w: 160, h: 80 } as const;
/** The sleepy private walks on after this many ticks. */
export const PAUSE_GAG_TICKS = 600;
/** He walks from the right screen edge to his seat at this speed (px/tick). */
const WALK_SPEED = 0.8;
const SEAT_X = BOX.x + BOX.w - 26;

const sprite: DrawOpts = { screen: true, flipX: true };
const plain: DrawOpts = { screen: true };

export class PauseScene implements Scene {
  readonly transparent = true;
  private readonly app: GameApp;
  private readonly host: PauseHost;
  private sel = 0;
  private t = 0;
  /** Paused ticks (the gag clock; it stops while OPTIONS is open on top). */
  private idle = 0;
  /** QUIT asks first: null = no question, 0 = YES, 1 = NO. */
  private confirm: number | null = null;
  private leaving = false;

  constructor(app: GameApp, host: PauseHost) {
    this.app = app;
    this.host = host;
  }

  /** The highlighted menu item. */
  get selected(): (typeof PAUSE_ITEMS)[number] {
    return PAUSE_ITEMS[this.sel];
  }

  /** True while the QUIT question is open. */
  get asking(): boolean {
    return this.confirm !== null;
  }

  enter(): void {
    this.app.input.suppress(ACTION_BUTTONS);
    // Any pad navigates the menu, also one that no player holds in a 2-player game (§10).
    this.app.input.menuPads = true;
    this.app.audio.sfx('ui/pause');
  }

  exit(): void {
    this.app.input.menuPads = false;
  }

  resume(): void {
    this.app.input.suppress(ACTION_BUTTONS);
  }

  update(): void {
    this.t++;
    this.idle++;
    const app = this.app;
    app.focusLost = false; // already paused
    if (this.leaving) return;
    const k = menuKeys(app.input);
    if (this.confirm !== null) {
      this.updateConfirm(k.left || k.right || k.up || k.down, k.confirm, k.back);
      return;
    }
    // Esc / P (or the pad's Back) resume at once.
    if (app.input.pausePressed) {
      this.resumeGame();
      return;
    }
    if (k.up || k.down) {
      this.sel = (this.sel + (k.up ? -1 : 1) + PAUSE_ITEMS.length) % PAUSE_ITEMS.length;
      app.audio.sfx('ui/move');
    }
    if (k.back) {
      this.resumeGame();
      return;
    }
    if (!k.confirm) return;
    switch (this.selected) {
      case 'RESUME':
        this.resumeGame();
        break;
      case 'OPTIONS':
        app.audio.sfx('ui/confirm');
        app.scenes.push(
          new OptionsScene(app, {
            inGame: true,
            onChange: (s) => this.host.applySettings?.(s),
          }),
          { fade: 12 },
        );
        break;
      case 'QUIT TO TITLE':
        app.audio.sfx('ui/confirm');
        this.confirm = 1;
        break;
    }
  }

  private updateConfirm(toggle: boolean, ok: boolean, back: boolean): void {
    const app = this.app;
    if (toggle && this.confirm !== null) {
      this.confirm = 1 - this.confirm;
      app.audio.sfx('ui/move');
    }
    if (back || (ok && this.confirm === 1)) {
      this.confirm = null;
      app.audio.sfx('ui/cancel');
      return;
    }
    if (ok) {
      this.leaving = true;
      app.audio.sfx('ui/confirm');
      app.audio.music(null, { fadeTicks: 20 });
      toTitle(app, 30);
    }
  }

  private resumeGame(): void {
    this.leaving = true;
    this.app.audio.sfx('ui/cancel');
    this.app.scenes.pop();
  }

  draw(r: Renderer): void {
    r.fade(0x05060aff, 0.5);
    drawPanel(r, BOX.x, BOX.y, BOX.w, BOX.h, 0.94);
    const prev = setArtDensity(screenTier(r));
    this.drawGag(r);
    setArtDensity(prev);
    centerText(r, 'PAUSE', 76, UI_GOLD, 'big');
    // The menu's swan cursor at the tier, like the gag (the text keeps its own glyph density).
    const cur = setArtDensity(screenTier(r));
    drawMenu(r, PAUSE_ITEMS, this.confirm === null ? this.sel : -1, 96, this.t, 12);
    setArtDensity(cur);
    this.drawPadHelp(r);
    if (this.confirm !== null) this.drawConfirm(r);
  }

  /** The buttons of the pad used last, under the box (nothing after the keyboard). */
  private drawPadHelp(r: Renderer): void {
    const input = this.app.input;
    const info = promptPad(input);
    if (!info) return;
    const slot = input.gamepads && input.gamepads.liveIndex(1) === input.gamepads.lastIndex ? 1 : 0;
    drawPadLine(r, PAUSE_PAD_HELP, r.w >> 1, BOX.y + BOX.h + 6, info, slotPadMap(input, slot), PAL.snow[2]);
  }

  private drawConfirm(r: Renderer): void {
    drawPanel(r, 96, 104, 192, 40, 0.98);
    centerText(r, 'QUIT? PROGRESS WILL BE LOST.', 111, UI_WHITE);
    const yes = this.confirm === 0;
    uiText(r, 'YES', 168, 127, yes ? UI_GOLD : PAL.stone[2], 'center');
    uiText(r, 'NO', 216, 127, !yes ? UI_GOLD : PAL.stone[2], 'center');
    if (blinkOn(this.t, 15)) r.rect(yes ? 159 : 209, 136, yes ? 18 : 14, 1, UI_GOLD, plain);
  }

  /** The sleepy private: walks in along the box's top edge, sits down, snores. */
  private drawGag(r: Renderer): void {
    const t = this.idle - PAUSE_GAG_TICKS;
    if (t < 0) return;
    const startX = r.w + 12;
    const x = Math.max(SEAT_X, Math.round(startX - t * WALK_SPEED));
    const top = BOX.y - 1;
    const walking = x > SEAT_X;
    if (walking) {
      if (hasSprite('enemy/rifleman/walk')) r.sprite('enemy/rifleman/walk', Math.floor(t / 6), x, top, sprite);
      return;
    }
    const sat = t - (startX - SEAT_X) / WALK_SPEED;
    // Sitting on the edge: the crouch pose with his boots hanging over the box.
    const sit = hasSprite('enemy/rifleman/crouch') ? 'enemy/rifleman/crouch' : 'enemy/rifleman/idle';
    if (hasSprite(sit)) r.sprite(sit, 0, x, top + 5, sprite);
    if (sat < 60) return;
    // Asleep: a snore bubble that swells and shrinks, Z's floating up.
    const head = hasSprite(sit) ? getFrame(sit, 0) : null;
    const hy = top + 5 - (head ? head.oy : 26);
    const breathe = Math.floor(sat / 30) % 2;
    if (hasSprite('ui/bubble')) r.sprite('ui/bubble', 0, x - 8 - breathe, hy + 2, plain);
    for (let i = 0; i < 3; i++) {
      const k = (sat + i * 40) % 120;
      if (k > 90) continue;
      uiText(r, 'Z', x - 14 - Math.round(k / 8) - i * 2, hy - 4 - Math.round(k / 6), PAL.snow[2 + (i & 1)], 'center');
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The lost-pad pause
// ---------------------------------------------------------------------------------------------

/** A keyboard START or pause key went down this tick (any key set). */
function keyboardResume(input: InputManager): boolean {
  const b = input.bindings;
  for (const code of input.rawPressed) {
    if (code.startsWith('Gamepad')) continue;
    if (b.pause.includes(code) || b.solo.start.includes(code) || b.p1.start.includes(code) || b.p2.start.includes(code)) return true;
  }
  return false;
}

/**
 * The lost-pad pause (docs/design/ams-extras.md §10): the pad of player `slot`, who is in play,
 * dropped out (Bluetooth sleep, a flat battery). The game freezes under a dim like PAUSE with
 * `CONTROLLER 2 LOST` / `RECONNECT OR PRESS START` and the pad's model. It resumes when the same
 * pad comes back (pads.ts gives it its slot again), when START is pressed on a free pad (that pad
 * takes the slot), or on a keyboard START / pause key (the player goes on with the keyboard: the
 * slot forgets its pad; player 2 gets the 2-player key sets). The 2D game and the first-person
 * mode push it (`host` is the scene under it).
 */
export class LostPadScene implements Scene {
  readonly transparent = true;
  readonly slot: 0 | 1;
  private readonly app: GameApp;
  private t = 0;
  private leaving = false;

  constructor(app: GameApp, _host: PauseHost, slot: 0 | 1) {
    this.app = app;
    this.slot = slot;
  }

  enter(): void {
    this.app.input.suppress(ACTION_BUTTONS);
    this.app.audio.sfx('ui/pause');
  }

  update(): void {
    this.t++;
    const app = this.app;
    app.focusLost = false; // already paused
    if (this.leaving) return;
    const input = app.input;
    // The same pad is back.
    if (!input.padLost(this.slot)) {
      this.resumeGame();
      return;
    }
    // START on a free pad: it takes the slot.
    const gp = input.freePadPressed(PAD.start);
    if (gp >= 0 && input.claimPad(this.slot, gp)) {
      this.resumeGame();
      return;
    }
    if (keyboardResume(input)) {
      input.releasePad(this.slot);
      if (this.slot === 1) input.keySplit = true;
      this.resumeGame();
    }
  }

  private resumeGame(): void {
    this.leaving = true;
    this.app.audio.sfx('ui/confirm');
    this.app.scenes.pop();
  }

  draw(r: Renderer): void {
    r.fade(0x05060aff, 0.55);
    drawPanel(r, 88, 72, 208, 64, 0.95);
    centerText(r, `CONTROLLER ${this.slot + 1} LOST`, 80, UI_GOLD, 'big');
    if (blinkOn(this.t)) centerText(r, 'RECONNECT OR PRESS START', 102, UI_WHITE);
    const model = this.app.input.slotPad(this.slot)?.model;
    centerText(r, model ? `${model} - OR USE THE KEYBOARD` : 'OR USE THE KEYBOARD', 118, PAL.stone[3]);
  }
}
