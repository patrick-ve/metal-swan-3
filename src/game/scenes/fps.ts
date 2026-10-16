/**
 * FpsScene (docs/design/fps.md §1.6): one floor of the first-person mode. Owns one FpsGame and
 * one RayView; turns the fps input on (`input.fpsMode`, `app.pointerLockWanted`) while it plays
 * and off under a menu; presents the view as a streamed buffer; draws the weapon view, the
 * damage feedback, the boss band, the status bar and the messages (fps/hud.ts) and the debug map.
 *
 * Wiring by group flow (spec §1.10): the scene is the PauseScene's host (`applySettings`) and the
 * ContinueScene's (`continuePlayer`, `resumeMusic`, `startPressed`): the last life pushes the
 * continue screen, which uses the shared `session.credits`.
 */
import { padButtonCode, type InputManager } from '../../engine/input';
import { ACTION_BIT } from '../../engine/input-actions';
import { PAL } from '../../engine/palette';
import { RayView, CELL_DOOR, CELL_OPAQUE, CELL_PROP, type RayGrid } from '../../engine/ray';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, type GameApp } from '../app';
import { ST_ATTACK, ST_TELL } from '../fps/actors';
import { DOOR_CLOSED } from '../fps/doors';
import { DYING_TICKS, FpsGame } from '../fps/game';
import { drawBossBand, drawFeedback, drawMessages, drawStatusBar, drawWeaponView, type HudInfo } from '../fps/hud';
import { LOCK_GOLD, LOCK_SILVER } from '../fps/map';
import { fpsFloorByNumber } from '../fps/registry';
import { emptyFpsInput } from '../fps/run';
import type { FloorResult, FpsFloorDef, FpsInput, FpsRun } from '../fps/types';
import type { PlayerSlot, SlotIndex } from '../session';
import { ContinueScene, type Continuable } from './continue';
import { fpsFloorDone } from './fps-route';
import { PauseScene, type PauseHost } from './pause';

/** The black card between a death and the restart (spec §1.6). */
export const RESTART_CARD_TICKS = 60;
/** The CLICK TO LOOK hint shows for the first ticks of a floor (spec §2.3). */
export const LOOK_HINT_TICKS = 300;
/** The status bar (spec §8.6): y 176–215. */
const BAR_Y = 176;

const plain: DrawOpts = { screen: true };
const half: DrawOpts = { screen: true, alpha: 0.5 };
const view: DrawOpts = { screen: true, stream: true };

export class FpsScene implements Scene, PauseHost, Continuable {
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
  private readonly info: HudInfo = { floor: 0, score: 0, lives: 0, slot: 0, character: 'recruit', reduceFlashes: false, bossBarOn: true };

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
    this.app.debug.on('skip', () => this.game.debugSkip());
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
      app.scenes.push(new PauseScene(app, this));
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
    this.app.scenes.push(new ContinueScene(this.app, this));
  }

  /**
   * Continuable (spec §1.10): only the fps slot, only when it is out. The continue costs a shared
   * credit and adds its point (the last score digit counts continues); the floor restarts from
   * that score, so the point is kept.
   */
  continuePlayer(i: SlotIndex): boolean {
    const session = this.app.session;
    if (!session || i !== this.run.slot || !this.slot.gameOver) return false;
    const before = this.slot.score;
    if (!session.continueSlot(i)) return false;
    this.run.floorStartScore += this.slot.score - before;
    this.game.restart();
    this.finished = false;
    this.restartCard = RESTART_CARD_TICKS;
    return true;
  }

  /** No chair gag on the continue screen: its stage would stand on the status bar. */
  readonly continueGag = false;

  /** Back to the floor's song after the continue screen. */
  resumeMusic(): void {
    this.app.audio.music(this.def.music, { fadeTicks: 20 });
  }

  /** The fps slot's player may use any start key or pad Start; the waiting slot cannot continue here. */
  startPressed(i: SlotIndex, input: InputManager): boolean {
    if (i !== this.run.slot) return false;
    return input.pad(0).pressed('start') || input.pad(1).pressed('start');
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
    const app0 = this.app;
    drawWeaponView(r, g);
    drawFeedback(r, g, app0.settings.reduceFlashes);
    this.drawDeath(r);
    drawBossBand(r, g, app0.settings.bossBar);
    drawStatusBar(r, g, this.hudInfo());
    drawMessages(r, g);
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

  /** The session side of the status bar (spec §8.6). */
  private hudInfo(): HudInfo {
    const info = this.info;
    info.floor = this.def.number;
    info.score = this.slot.score;
    info.lives = this.slot.lives;
    info.slot = this.run.slot;
    info.character = this.slot.character;
    return info;
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
    const pool = g.actors;
    for (let i = 0; i < pool.count; i++) {
      const a = pool.actors[i];
      if (!a.used) continue;
      const c = !a.alive ? PAL.stone[1] : a.state >= ST_TELL && a.state <= ST_ATTACK ? PAL.gold[3] : a.aware ? PAL.red[3] : PAL.red[1];
      r.rect(x0 + Math.floor(a.x * s) - 1, y0 + Math.floor(a.y * s) - 1, s, s, c, plain);
    }
    const p = g.player;
    const px = x0 + Math.floor(p.x * s);
    const py = y0 + Math.floor(p.y * s);
    r.rect(px - 1, py - 1, 3, 3, PAL.sky[3], plain);
    const fx = g.player.frontX - Math.floor(p.x);
    const fy = g.player.frontY - Math.floor(p.y);
    r.rect(px + fx * 2, py + fy * 2, 1, 1, PAL.snow[3], plain);
  }
}

