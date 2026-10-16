/**
 * FpsScene (docs/design/fps.md §1.6): one floor of the first-person mode. Owns one FpsGame and
 * one RayView; turns the fps input on (`input.fpsMode`, `app.pointerLockWanted`) while it plays
 * and off under a menu; presents the view as a streamed buffer; draws a basic status bar, the
 * messages and the debug map.
 *
 * Wiring by group flow (spec §1.10) is still open: the pause menu gets a small adapter (PauseScene
 * still takes a GameplayScene), and the last life goes to the GAME OVER screen instead of the
 * ContinueScene (which still takes a MissionRunner).
 */
import { padButtonCode } from '../../engine/input';
import { ACTION_BIT } from '../../engine/input-actions';
import { PAL } from '../../engine/palette';
import { RayView, CELL_DOOR, CELL_OPAQUE, CELL_PROP, type RayGrid } from '../../engine/ray';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, PLAYER_COLORS, scoreText, uiText, type GameApp } from '../app';
import { DOOR_CLOSED, KEY_GOLD, KEY_SILVER } from '../fps/doors';
import { DYING_TICKS, FpsGame } from '../fps/game';
import { LOCK_GOLD, LOCK_SILVER } from '../fps/map';
import { fpsFloorByNumber } from '../fps/registry';
import { emptyFpsInput } from '../fps/run';
import type { FloorResult, FpsFloorDef, FpsInput, FpsRun } from '../fps/types';
import type { PlayerSlot } from '../session';
import { fpsFloorDone } from './fps-route';
import type { GameplayScene } from './gameplay';
import { GameOverScene } from './game-over';
import { PauseScene } from './pause';

/** The black card between a death and the restart (spec §1.6). */
export const RESTART_CARD_TICKS = 60;
/** The CLICK TO LOOK hint shows for the first ticks of a floor (spec §2.3). */
export const LOOK_HINT_TICKS = 300;
/** The status bar (spec §8.6): y 176–215. */
const BAR_Y = 176;

const plain: DrawOpts = { screen: true };
const half: DrawOpts = { screen: true, alpha: 0.5 };
const view: DrawOpts = { screen: true, stream: true };

/**
 * PauseScene still types its host as a GameplayScene and only touches `runner.world.camera`
 * (the OPTIONS screen-shake hook). This stand-in keeps that hook harmless until group flow
 * swaps in the `PauseHost` interface (spec §1.10).
 */
const PAUSE_HOST = { runner: { world: { camera: { shakeScale: 1 } } } } as unknown as GameplayScene;

export class FpsScene implements Scene {
  readonly app: GameApp;
  readonly run: FpsRun;
  readonly def: FpsFloorDef;
  readonly game: FpsGame;
  readonly view = new RayView();
  readonly slot: PlayerSlot;
  private readonly input: FpsInput = emptyFpsInput();
  private t = 0;
  /** Ticks left on the restart card. */
  private restartCard = 0;
  private finished = false;

  constructor(app: GameApp, run: FpsRun) {
    this.app = app;
    this.run = run;
    const def = fpsFloorByNumber(run.floor) ?? fpsFloorByNumber(0);
    if (!def) throw new Error(`[fps] no floor ${run.floor} and no floor 0 (fps content not loaded?)`);
    this.def = def;
    const session = app.session;
    if (!session) throw new Error('[fps] FpsScene needs a session');
    this.slot = session.slots[run.slot];
    this.game = new FpsGame({
      floor: def,
      difficulty: session.difficulty,
      seed: (session.seed + def.number * 7919) >>> 0,
      slot: this.slot,
      carry: run.carry,
      audio: app.audio,
      god: app.debug.god,
      run,
    });
    this.game.events.on('floorComplete', ({ result }) => this.floorComplete(result));
    this.game.events.on('playerDead', () => this.playerDead());
  }

  private inputOn(on: boolean): void {
    this.app.input.fpsMode = on;
    this.app.pointerLockWanted = on;
  }

  enter(): void {
    this.inputOn(true);
    this.app.input.suppress();
    this.app.audio.music(this.def.music, { fadeTicks: 20 });
    this.app.debug.on('skip', () => this.game.useElevator());
    this.app.debug.on('weapons', () => this.game.giveAll());
  }

  exit(): void {
    this.inputOn(false);
    this.app.debug.on('skip', () => {});
    this.app.debug.on('weapons', () => {});
  }

  pause(): void {
    this.inputOn(false);
    this.app.audio.duckMusic?.(0.5);
  }

  resume(): void {
    this.inputOn(true);
    this.app.input.suppress();
    this.app.audio.duckMusic?.(1);
  }

  /** OPTIONS changed a setting while paused (main.ts already applies the mouse settings). */
  applySettings(): void {}

  update(): void {
    this.t++;
    if (this.finished) return;
    const app = this.app;
    const input = app.input;
    if (this.restartCard > 0) {
      this.restartCard--;
      // Fire and use held through the card do nothing; a held direction keeps moving.
      if (this.restartCard === 0) input.actions.suppress(ACTION_BIT.fire | ACTION_BIT.use);
      return;
    }
    if (input.pausePressed || app.focusLost || input.keyPressed(padButtonCode(9))) {
      app.focusLost = false;
      app.scenes.push(new PauseScene(app, PAUSE_HOST));
      return;
    }
    const i = this.input;
    i.held = input.actions.mask;
    i.pressed = input.actions.pressedMask;
    i.turn = input.analog.turn;
    i.moveX = input.analog.moveX;
    i.moveY = input.analog.moveY;
    this.game.god = app.debug.god;
    this.game.step(i);
  }

  private floorComplete(result: FloorResult): void {
    if (this.finished) return;
    this.finished = true;
    this.run.carry = this.game.carry();
    this.run.results.push(result);
    fpsFloorDone(this.app, this.run, result);
  }

  private playerDead(): void {
    const last = this.slot.loseLife();
    if (!last) {
      this.game.restart();
      this.restartCard = RESTART_CARD_TICKS;
      return;
    }
    this.slot.gameOver = true;
    this.finished = true;
    this.inputOn(false);
    this.app.scenes.push(new GameOverScene(this.app));
  }

  draw(r: Renderer): void {
    r.begin(0x000000ff);
    if (this.restartCard > 0) {
      centerText(r, `FLOOR ${this.def.number}`, 92, PAL.snow[3], 'big');
      centerText(r, `LIVES ${this.slot.lives}`, 116, PAL.stone[3]);
      return;
    }
    const g = this.game;
    g.render(this.view);
    r.image(this.view.buf, 0, 0, view);
    this.drawDeath(r);
    this.drawBar(r);
    this.drawMessages(r);
    const app = this.app;
    if (app.settings.mouseLook && !app.pointerLocked && this.t < LOOK_HINT_TICKS && blinkOn(this.t)) {
      centerText(r, 'CLICK TO LOOK WITH THE MOUSE', 34, PAL.snow[3]);
    }
    if (app.debug.enabled && !app.debug.hitboxes) this.drawMap(r);
    app.debug.draw(r, null);
  }

  /** Death (spec §4.9): red fade over the first 30 ticks, black over ticks 60–89. */
  private drawDeath(r: Renderer): void {
    const g = this.game;
    if (g.state !== 'dying' && g.state !== 'dead') return;
    const t = g.state === 'dead' ? DYING_TICKS : g.stateTimer;
    r.rect(0, 0, r.w, BAR_Y, PAL.red[0], { screen: true, alpha: 0.6 * Math.min(1, t / 30) });
    if (t >= 60) r.rect(0, 0, r.w, BAR_Y, 0x000000ff, { screen: true, alpha: Math.min(1, (t - 60) / 29) });
  }

  /** A basic status bar (spec §8.6 layout; group actors replaces it with hud.ts). */
  private drawBar(r: Renderer): void {
    const p = this.game.player;
    r.rect(0, BAR_Y, r.w, 40, PAL.navy[1], plain);
    r.rect(0, BAR_Y, r.w, 1, PAL.steel[2], plain);
    r.rect(6, BAR_Y + 3, 40, 34, PAL.navy[0], plain); // porthole (the face goes here)
    r.rect(118, BAR_Y + 3, 120, 34, PAL.navy[0], plain);
    r.rect(254, BAR_Y + 3, 128, 34, PAL.navy[0], plain);
    uiText(r, 'HEALTH', 52, 181, PAL.stone[3]);
    uiText(r, `${p.hp}`, 110, 192, PAL.snow[3], 'right', 'big');
    const hpC = p.hp > 50 ? PAL.green[2] : p.hp > 25 ? PAL.gold[2] : PAL.red[2];
    r.rect(52, 210, 56, 3, PAL.navy[0], plain);
    r.rect(52, 210, Math.round((56 * p.hp) / 100), 3, hpC, plain);
    uiText(r, 'SCORE', 122, 181, PAL.stone[3]);
    uiText(r, scoreText(this.slot.score), 234, 181, PAL.snow[3], 'right');
    uiText(r, `LIVES X${this.slot.lives}`, 122, 194, PAL.snow[2]);
    uiText(r, `FLOOR ${this.def.number}`, 122, 205, PAL.stone[3]);
    uiText(r, `${this.run.slot + 1}P`, 234, 205, PLAYER_COLORS[this.run.slot], 'right');
    if (p.keys & KEY_GOLD) r.rect(244, 182, 8, 14, PAL.gold[2], plain);
    if (p.keys & KEY_SILVER) r.rect(244, 199, 8, 14, PAL.snow[2], plain);
    uiText(r, WEAPON_NAMES[p.weapon] ?? '?', 258, 194, PAL.snow[2]);
    uiText(r, 'AMMO', 314, 181, PAL.stone[3]);
    uiText(r, `${p.ammo}`, 378, 192, PAL.snow[3], 'right', 'big');
  }

  private drawMessages(r: Renderer): void {
    const m = this.game.messages;
    for (let k = 0; k < m.length; k++) uiText(r, m[k].text, 4, m.length === 1 ? 164 : 154 + k * 10, PAL.snow[2]);
  }

  /** Debug map (spec §1.11): top-right, 2 px per tile. */
  private drawMap(r: Renderer): void {
    const g = this.game;
    const grid: RayGrid = g.grid;
    const s = 2;
    const x0 = r.w - grid.w * s - 4;
    const y0 = 4;
    r.rect(x0 - 1, y0 - 1, grid.w * s + 2, grid.h * s + 2, 0x000000ff, half);
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const i = grid.idx(x, y);
        const f = grid.flags[i];
        let c = 0;
        if (f & CELL_DOOR) {
          const d = grid.door[i];
          const lock = g.doors.lock[d];
          c = g.doors.state[d] !== DOOR_CLOSED ? PAL.green[3] : lock === LOCK_GOLD ? PAL.gold[3] : lock === LOCK_SILVER ? PAL.snow[3] : PAL.brown[3];
        } else if (g.pushes.isPushCell(x, y)) c = PAL.purple[2];
        else if (f & CELL_OPAQUE) c = PAL.stone[2];
        else if (f & CELL_PROP) c = PAL.stone[1];
        if (c) r.rect(x0 + x * s, y0 + y * s, s, s, c, plain);
      }
    }
    const pw = g.pushes.push;
    if (pw.active) r.rect(x0 + Math.round((pw.x + pw.dx * pw.offset) * s), y0 + Math.round((pw.y + pw.dy * pw.offset) * s), s, s, PAL.purple[2], plain);
    g.map.items.forEach((it, k) => {
      if (!g.taken[k]) r.rect(x0 + it.x * s, y0 + it.y * s, 1, 1, PAL.gold[3], plain);
    });
    for (const a of g.map.actors) r.rect(x0 + a.x * s, y0 + a.y * s, s, s, PAL.red[2], plain);
    const p = g.player;
    const px = x0 + Math.floor(p.x * s);
    const py = y0 + Math.floor(p.y * s);
    r.rect(px - 1, py - 1, 3, 3, PAL.sky[3], plain);
    const fx = g.player.frontX - Math.floor(p.x);
    const fy = g.player.frontY - Math.floor(p.y);
    r.rect(px + fx * 2, py + fy * 2, 1, 1, PAL.snow[3], plain);
  }
}

const WEAPON_NAMES: readonly string[] = ['KNIFE', 'PISTOL', 'MG', 'CHAINGUN'];
