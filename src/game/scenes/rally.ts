/**
 * RallyScene: mission `rally`, level 2 — BINNEN DE RING, the 3D race on the A10 (docs/design/rally.md
 * §2, §7.6, §10, §12.2, §12.3; docs/api/rally.md "A.I"). The host of a `RallyRunner`
 * (src/game/rally/runner.ts).
 *
 * - The play controls (play-host.ts): the pause (`PauseScene`, with the race's own item
 *   `CAMERA: CHASE` / `CAMERA: BUMPER`, `pauseExtra`), the lost-pad pause (`LostPadScene`), player
 *   2's join at any time (START on a free pad or the key 2: the green estate,
 *   `RallyRunner.joinPlayer`), the key-split notice.
 * - The race input: the race channel of both slots (`InputManager.raceMode` on while the scene is
 *   on top; engine/race-input.ts, rally/input.ts).
 * - The glitch into 3D (`opts.fold`, from RallyGlitchScene): the first `FOLD_TICKS` show the broken
 *   card's tiles folding into the grid (rally-fold.ts); the race waits (its countdown starts after).
 * - The draw (spec §12.2): `r.begin` → the 3D view renders every player view (1P: 384 × 216; 2P:
 *   two 384 × 108 views, P1 on top) → `r.surface(image)` → the 2D HUD. Each view culls the track
 *   (`track.createView()`, up to the fog's far end) and adds the cars: near ones as body + four
 *   spinning, steering wheels (`poseWheel`) + the brake lamps when braking; beyond `CAR_LOD_M` the
 *   far model. A car in its recovery blink shows every other 4 ticks. The density follows the art
 *   tier (`densityAtRes(min(artTier(), 4), r.res)`; the 3D governor caps it in main.ts). The
 *   meshes are uploaded once and released on exit. Nothing allocates per frame.
 * - The HUD (2D, the game's font, Dutch labels): 1P — POSITIE n/8 (big), RONDE n/3, the lap time
 *   (big) and BESTE RONDE, the speed in KM/H (big), the countdown 3-2-1-GO (big ×2, with beeps); 2P
 *   — a compact line set per view. The results (phase 'finish'): UITSLAG, the standings with the
 *   times (projected ones in grey) while the camera circles the player's estate.
 * - A lost WebGL context pauses the race (the view says why); if it does not come back within
 *   `GL_LOST_TICKS` the no-WebGL2 path takes over (spec §12.2).
 * - Debug: F4 (`skip`) ends the race at once (`finishNow`: places by the current order, projected
 *   times) → the results → 'complete' → `rallyDone` (the tally, then the glitch bridge). The seed
 *   shows in the debug overlay.
 * - `RallyScene.last`: the runner of the last race (the debug probe `rallyProbe`).
 *
 * ```ts
 * app.scenes.reset(new RallyScene(app, { start: prepareRally(app, { seed: 42 }) }));
 * ```
 */
import { hasSfx } from '../../engine/audio';
import type { Color } from '../../engine/color';
import { ACTION_BUTTONS } from '../../engine/input';
import { PAL } from '../../engine/palette';
import type { PixelBuffer } from '../../engine/pixel';
import { mat4PoseYPR } from '../../engine/r3/mat';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { artTier } from '../../engine/sprites';
import { PS1_ON, VIEW3D_H, VIEW3D_W, type DrawItem, type Light3, type View3 } from '../../engine/view3d';
import { centerText, PLAYER_COLORS, uiText, UI_GOLD, UI_GREY, UI_WHITE, type GameApp } from '../app';
import { carModelInfo, poseWheel, type RallyCarModel } from '../content/rally/models/types';
import { densityAtRes } from '../fps/hud';
import type { CarState, RallyOpts, RallyTrackView } from '../rally/api';
import { newCam, stepRig } from '../rally/camera';
import { lockAt } from '../rally/physics';
import { rallyModel } from '../rally/registry';
import { RallyRunner } from '../rally/runner';
import { bestLapTicks, raceClock } from '../rally/score';
import { GameSession } from '../session';
import type { PauseExtra } from './pause';
import { PlayControls, type PlayHost } from './play-host';
import { RallyFold, FOLD_TICKS } from './rally-fold';
import { RallyNoGlScene } from './rally-glitch';
import { prepareRally, rallyDone } from './rally-route';

export interface RallySceneOpts {
  /** A prepared race (the card's / the glitch scene's); default `prepareRally(app)`. */
  start?: RallyOpts;
  /** Use this session instead of `app.session` (tests). */
  session?: GameSession;
  /**
   * The glitch into 3D (RallyGlitchScene): the broken card as flat tiles (384·d × 216·d) that fold
   * into the grid in the first `FOLD_TICKS`. Absent (a sim, a test): the race starts at once.
   */
  fold?: PixelBuffer | null;
}

/** The light of wave A (one afternoon; wave B: the time of day per lap, spec §4). */
export const RALLY_LIGHT: Light3 = {
  sunDir: [0.42, 0.72, 0.55],
  sun: [1, 0.93, 0.8],
  ambient: [0.5, 0.52, 0.6],
  fog: [0.74, 0.8, 0.86],
  fogNear: 160,
  fogFar: 420,
  skyTop: [0.36, 0.56, 0.84],
  skyBottom: [0.78, 0.84, 0.9],
};

/** The backbuffer's clear colour behind the 3D view (the sky's horizon tone). */
const SKY = 0xc6d6e5ff;
/** Beyond this distance from the camera a car draws its far model (m). */
export const CAR_LOD_M = 60;
/** A lost WebGL context may stay away this long (ticks, 5 s) before the no-WebGL2 path. */
export const GL_LOST_TICKS = 300;
/** The HUD shows once the fold is this far (ticks). */
const HUD_AFTER_FOLD = Math.round(FOLD_TICKS * 0.6);
/** The brake lamps light at this much brake (0..127). */
const BRAKE_LAMP = 16;
/** The results' backing (screen space, 70 %). */
const PANEL: DrawOpts = { screen: true, alpha: 0.7 };
/** The line between the split views (the ink of the HUD panels). */
const SPLIT_LINE = 0x05060aff;

/** One car's draw data (made once per car; the matrices are rewritten every frame). */
interface CarDraw {
  readonly car: CarState;
  /** Its index in `runner.cars` (its input). */
  readonly index: number;
  readonly m: Float32Array;
  readonly info: RallyCarModel | null;
  readonly wheels: Float32Array[];
  /** Near: the body and the four wheels; far: the low-poly model; the brake lamps. */
  readonly near: DrawItem[];
  readonly far: DrawItem[];
  readonly brake: DrawItem | null;
}

/** The race's camera label (the pause item). */
function camLabel(c: string): string {
  return `CAMERA: ${c === 'bumper' ? 'BUMPER' : 'CHASE'}`;
}

export class RallyScene implements Scene, PlayHost {
  /** The runner of the last race started (the debug probe). */
  static last: RallyRunner | null = null;

  readonly app: GameApp;
  readonly opts: RallySceneOpts;
  runner!: RallyRunner;
  /** The race has no attract demo. */
  readonly demo = false;
  private t = 0;
  private readonly controls = new PlayControls(this);
  private start!: RallyOpts;
  /** The track is uploaded to the 3D view; the car models uploaded so far. */
  private uploaded = false;
  private readonly models = new Set<string>();
  private cars: CarDraw[] = [];
  private carsSeen = 0;
  private readonly views: View3[] = [0, 1].map(() => ({ x: 0, y: 0, w: VIEW3D_W, h: VIEW3D_H, cam: newCam(), light: RALLY_LIGHT, items: [] as DrawItem[] }));
  private readonly lists: DrawItem[][] = [[], []];
  private readonly one: View3[] = [this.views[0]];
  private readonly two: View3[] = [this.views[0], this.views[1]];
  private readonly playerCars: CarState[] = [];
  /** Each view's culler of the track (null: the track has none; every item is drawn). */
  private readonly cullers: (RallyTrackView | null)[] = [null, null];
  /** The glitch's fold (null when none or done) and its tick. */
  private fold: RallyFold | null = null;
  private foldT = 0;
  private foldUploaded = false;
  private foldPlayers = 0;
  /** Ticks with the WebGL context lost; the scene is leaving. */
  private lostT = 0;
  private leaving = false;
  /** The countdown's last number (the beeps). */
  private lastCount = -1;

  constructor(app: GameApp, opts: RallySceneOpts = {}) {
    this.app = app;
    this.opts = opts;
  }

  get session(): GameSession {
    if (this.opts.session) return this.opts.session;
    if (!this.app.session) this.app.session = new GameSession({ seed: this.app.params.seed ?? 1 });
    return this.app.session;
  }

  /** The glitch's fold is still running (the race waits). */
  get folding(): boolean {
    return this.fold !== null;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    // A free pad's START asks to join (GDD §4.9) instead of pausing player 1.
    app.input.joinWatch = true;
    // The race channel of both slots (steer, gas, brake, handbrake, camera, look back).
    app.input.raceMode = true;
    app.audio.duckMusic?.(1);
    app.focusLost = false;
    app.pointerPressed = false;
    const session = this.session;
    const start = this.opts.start ?? prepareRally({ params: app.params, session, settings: app.settings, input: app.input });
    this.start = start;
    const runner = new RallyRunner({ ...start, session, pads: [app.input.pad(0), app.input.pad(1)], audio: app.audio, settings: app.settings });
    this.runner = runner;
    RallyScene.last = runner;
    runner.events.on('complete', () => rallyDone(app, this, runner));
    runner.events.on('start', () => this.sfx('rally/go'));
    runner.start();
    app.debug.on('skip', () => runner.finishNow());
    if (this.opts.fold) {
      this.fold = new RallyFold(this.opts.fold, start.players);
      this.foldPlayers = start.players;
      this.foldT = 0;
      this.sfx('rally/fold');
    }
  }

  exit(): void {
    const app = this.app;
    app.input.joinWatch = false;
    app.input.raceMode = false;
    app.debug.on('skip', () => {});
    if (this.uploaded || this.foldUploaded) app.view3d.release();
    this.uploaded = false;
    this.models.clear();
    this.foldUploaded = false;
    this.fold = null;
    this.runner?.stopLoops(0);
    this.runner?.dispose();
  }

  /** A scene opened on top (pause): the music at half level. */
  pause(): void {
    this.app.input.joinWatch = false;
    this.app.audio.duckMusic?.(0.5);
  }

  resume(): void {
    this.app.input.joinWatch = true;
    this.app.input.raceMode = true;
    this.app.audio.duckMusic?.(1);
    // Only the action buttons: a direction held through the pause keeps steering.
    this.app.input.suppress(ACTION_BUTTONS);
  }

  /** OPTIONS changed a setting while paused: nothing for the race yet. */
  applySettings(): void {}

  /** The pause menu's own item: the camera of the player views (both views in 2P). */
  pauseExtra(): PauseExtra | null {
    const runner = this.runner;
    if (!runner) return null;
    return {
      label: camLabel(runner.cams[0]),
      act: () => {
        const to = runner.switchCam(0);
        if (runner.cams[1] !== to) runner.switchCam(1);
      },
    };
  }

  update(): void {
    this.t++;
    const app = this.app;
    const runner = this.runner;
    if (this.leaving) return;
    // A lost WebGL context: the race waits; after GL_LOST_TICKS the no-WebGL2 path.
    if (!app.view3d.ok) {
      this.lostT++;
      if (this.lostT >= GL_LOST_TICKS) this.toNoGl(app.view3d.reason || 'the 3D view was lost');
      return;
    }
    this.lostT = 0;
    this.controls.trackDevice();
    const racing = runner.phase === 'grid' || runner.phase === 'race';
    // The lost-pad pause, joins and pad claims, the pause (play-host.ts).
    if (racing && !app.scenes.busy && this.controls.interrupt()) return;
    this.controls.watchKeySplit();
    if (this.fold) {
      this.stepFold();
      return;
    }
    runner.step();
    const c = runner.phase === 'grid' ? Math.ceil(runner.countdown / 60) : 0;
    if (c !== this.lastCount) {
      if (c > 0) this.sfx('rally/count');
      this.lastCount = c;
    }
  }

  /** One tick of the glitch's fold: the cameras settle behind the grid; the race waits. */
  private stepFold(): void {
    const runner = this.runner;
    let players = 0;
    for (const c of runner.cars) if (c.slot >= 0) players++;
    // A join during the fold ends it (its tiles were cut for the old views).
    if (players !== this.foldPlayers) this.foldT = FOLD_TICKS;
    for (const car of runner.cars) if (car.slot >= 0) stepRig(runner.rigs[car.slot === 1 ? 1 : 0], car, runner.info, false, false);
    this.foldT++;
    if (this.foldT >= FOLD_TICKS) {
      const f = this.fold;
      this.fold = null;
      if (f && this.foldUploaded) this.app.view3d.release(f.meshIds);
      this.foldUploaded = false;
    }
  }

  /** The no-WebGL2 path in the middle of the race (the context did not come back). */
  private toNoGl(reason: string): void {
    this.leaving = true;
    this.app.scenes.replace(new RallyNoGlScene(this.app, { start: this.start, reason }), { fade: 20 });
  }

  private sfx(id: string): void {
    if (hasSfx(id)) this.app.audio.sfx(id);
  }

  /** No 2D art to preload (the 3D view's meshes upload in `draw`). */
  preloadArtNow(): void {}

  /** Upload the track once and every car model not uploaded yet (the 3D view keeps them until `exit`). */
  private upload(): void {
    const v3 = this.app.view3d;
    const track = this.runner.track;
    if (!this.uploaded) {
      v3.upload(track.meshes, track.pages);
      for (let i = 0; i < 2; i++) this.cullers[i] = track.createView?.() ?? null;
      this.uploaded = true;
    }
    for (const car of this.runner.cars) {
      const id = car.spec.model;
      if (this.models.has(id)) continue;
      this.models.add(id);
      const model = rallyModel(id);
      if (model) v3.upload(model.meshes, model.pages);
    }
  }

  /** Every car's draw data (rebuilt when a car joins). */
  private buildCars(): void {
    const runner = this.runner;
    this.cars = [];
    runner.cars.forEach((car, index) => {
      const model = rallyModel(car.spec.model);
      if (!model) return;
      const info = carModelInfo(model);
      const m = new Float32Array(16);
      const row = car.spec.clutRow;
      const item = (mesh: string, mm: Float32Array): DrawItem => (row === undefined ? { mesh, m: mm } : { mesh, m: mm, clutRow: row });
      const wheels: Float32Array[] = [];
      let near: DrawItem[];
      let far: DrawItem[];
      let brake: DrawItem | null = null;
      if (info) {
        near = info.body.map((id) => item(id, m));
        for (const w of info.anchors.wheels) {
          const wm = new Float32Array(16);
          wheels.push(wm);
          near.push(item(w.mesh, wm));
        }
        far = info.lod.parts.map((id) => item(id, m));
        brake = item(info.lights.brake, m);
      } else {
        near = model.parts.map((id) => item(id, m));
        far = near;
      }
      this.cars.push({ car, index, m, info, wheels, near, far, brake });
    });
    this.carsSeen = runner.roster;
    this.playerCars.length = 0;
    for (const slot of [0, 1]) {
      const c = runner.carOf(slot);
      if (c) this.playerCars.push(c);
    }
  }

  /** Pose every car (its matrix, its wheels) once per frame. */
  private poseCars(): void {
    for (const cd of this.cars) {
      const c = cd.car;
      const ph = c.phys;
      mat4PoseYPR(cd.m, c.pos[0], c.pos[1], c.pos[2], c.yaw, ph.pitch, ph.roll);
      const info = cd.info;
      if (!info) continue;
      const steer = c.steer * lockAt(ph.h, c.speed);
      const ws = info.anchors.wheels;
      for (let k = 0; k < ws.length; k++) {
        const w = ws[k];
        const lap = 6.283185307 * w.r;
        poseWheel(cd.wheels[k], cd.m, w, w.front ? steer : 0, (c.dist - Math.floor(c.dist / lap) * lap) / w.r);
      }
    }
  }

  /** View i's draw list: the culled track, the cars (near, far or blinking), the fold's tiles. */
  private fillView(i: number): void {
    const v = this.views[i];
    const list = this.lists[i];
    const track = this.runner.track;
    const far = v.light.fogFar;
    let k: number;
    const cull = this.cullers[i];
    if (cull) k = cull.fill(v.cam, v.w / v.h, far, list, 0);
    else {
      k = 0;
      for (const it of track.items) list[k++] = it;
    }
    const cx = v.cam.pos[0];
    const cy = v.cam.pos[1];
    const cz = v.cam.pos[2];
    const lodSq = CAR_LOD_M * CAR_LOD_M;
    const farSq = (far + 10) * (far + 10);
    const inputs = this.runner.inputs;
    for (const cd of this.cars) {
      const c = cd.car;
      if (c.phys.blink > 0 && ((c.phys.blink >> 2) & 1) === 1) continue;
      const dx = c.pos[0] - cx;
      const dy = c.pos[1] - cy;
      const dz = c.pos[2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > farSq) continue;
      const parts = d2 > lodSq ? cd.far : cd.near;
      for (let q = 0; q < parts.length; q++) list[k++] = parts[q];
      const inp = inputs[cd.index];
      if (cd.brake && d2 <= lodSq && inp && inp.brake >= BRAKE_LAMP && c.speed > 0.5) list[k++] = cd.brake;
    }
    if (this.fold) {
      if (!this.foldUploaded) {
        this.app.view3d.upload(this.fold.meshes, [this.fold.page]);
        this.foldUploaded = true;
      }
      k = this.fold.fill(this.foldT, i, v.cam, v.w, v.h, list, k, this.app.view3d);
    }
    list.length = k;
    v.items = list;
  }

  draw(r: Renderer): void {
    const runner = this.runner;
    const app = this.app;
    const v3 = app.view3d;
    if (!v3.ok) {
      this.drawLost(r);
      return;
    }
    r.begin(SKY);
    if (!this.uploaded || this.carsSeen !== runner.roster) {
      // A joined car's model (the green estate) may be new: upload it and rebuild the car list.
      this.upload();
      this.buildCars();
    }
    const d = densityAtRes(Math.min(artTier(), 4), r.res);
    if (v3.density !== d) v3.setDensity(d);
    this.poseCars();
    const split = this.playerCars.length > 1;
    const n = Math.min(2, this.playerCars.length);
    for (let i = 0; i < n; i++) {
      const v = this.views[i];
      v.x = 0;
      v.y = split ? i * (VIEW3D_H / 2) : 0;
      v.w = VIEW3D_W;
      v.h = split ? VIEW3D_H / 2 : VIEW3D_H;
      runner.camera(this.playerCars[i].slot, v.cam, split);
      this.fillView(i);
    }
    const src = n > 0 ? v3.render(split ? this.two : this.one, PS1_ON) : null;
    r.surface?.(src, 0, 0, VIEW3D_W, VIEW3D_H);
    if (!this.fold || this.foldT >= HUD_AFTER_FOLD) this.drawHud(r, split);
    const debug = app.debug;
    if (debug.enabled) centerText(r, `SEED ${runner.seed}  ${runner.phase.toUpperCase()}  T${runner.race.raceTick}`, debug.stats ? 11 : 2, PAL.stone[3]);
  }

  /** The context is lost: the race waits. */
  private drawLost(r: Renderer): void {
    r.begin(0x000000ff);
    centerText(r, 'THE 3D VIEW WAS LOST', 92, UI_GOLD, 'big');
    centerText(r, 'WAITING FOR IT TO COME BACK...', 112, UI_GREY);
  }

  /** The HUD (spec §7.6, wave A's basics): per player view, then the countdown and the results. */
  private drawHud(r: Renderer, split: boolean): void {
    const runner = this.runner;
    const n = runner.cars.length;
    for (let i = 0; i < this.playerCars.length && i < 2; i++) {
      const car = this.playerCars[i];
      const col = PLAYER_COLORS[car.slot === 1 ? 1 : 0];
      if (split) this.hudSplit(r, car, i * 108, col, n);
      else this.hudFull(r, car, col, n);
    }
    // The split: a dark line between the two views (P2's sky never touches P1's road).
    if (split) r.rect(0, VIEW3D_H / 2 - 1, VIEW3D_W, 1, SPLIT_LINE);
    if (this.fold) return;
    const cd = runner.countdown;
    if (runner.phase === 'grid' && cd > 0) {
      const s = String(Math.ceil(cd / 60));
      if (split) for (let i = 0; i < 2; i++) centerText(r, s, i * 108 + 40, UI_WHITE, 'big', 2);
      else centerText(r, s, 72, UI_WHITE, 'big', 3);
    } else if (runner.phase === 'race' && runner.race.raceTick < 50) {
      if (split) for (let i = 0; i < 2; i++) centerText(r, 'GO!', i * 108 + 40, UI_GOLD, 'big', 2);
      else centerText(r, 'GO!', 72, UI_GOLD, 'big', 3);
    }
    if (runner.phase === 'finish' || runner.phase === 'done') this.drawResults(r);
  }

  /** Ticks of the car's current lap (its finish time once finished). */
  private lapNow(car: CarState): number {
    if (car.finished) return car.lapTicks.length > 0 ? car.lapTicks[car.lapTicks.length - 1] : 0;
    return Math.max(0, this.runner.race.raceTick - car.lapStart);
  }

  private bestLap(car: CarState): number {
    return bestLapTicks(car);
  }

  /** 1P: the full HUD (384 × 216). */
  private hudFull(r: Renderer, car: CarState, col: Color, n: number): void {
    const runner = this.runner;
    const laps = runner.laps;
    // Top left: the place (big) and the lap.
    uiText(r, 'POSITIE', 6, 4, UI_GREY);
    uiText(r, `${car.place}/${n}`, 6, 13, col, 'left', 'big');
    uiText(r, `RONDE ${Math.min(car.lap, laps)}/${laps}`, 6, 25, UI_WHITE);
    // Top right: the lap time (big), the best lap.
    uiText(r, car.finished ? 'TOTAAL' : 'RONDETIJD', VIEW3D_W - 6, 4, UI_GREY, 'right');
    uiText(r, raceClock(car.finished ? car.finishTicks : this.lapNow(car)), VIEW3D_W - 6, 13, UI_WHITE, 'right', 'big');
    const best = this.bestLap(car);
    if (best >= 0) uiText(r, `BESTE RONDE ${raceClock(best)}`, VIEW3D_W - 6, 25, UI_WHITE, 'right');
    // Bottom right: the speed.
    uiText(r, 'KM/H', VIEW3D_W - 6, VIEW3D_H - 12, UI_GREY, 'right');
    uiText(r, String(Math.round(Math.abs(car.speed) * 3.6)), VIEW3D_W - 32, VIEW3D_H - 14, UI_GOLD, 'right', 'big');
    if (car.finished && runner.phase === 'race') centerText(r, `FINISH! ${car.place}E`, 72, UI_GOLD, 'big', 2);
  }

  /** 2P: a compact HUD in a 384 × 108 view. */
  private hudSplit(r: Renderer, car: CarState, y0: number, col: Color, n: number): void {
    const runner = this.runner;
    const laps = runner.laps;
    uiText(r, `P${car.slot === 1 ? 2 : 1}`, 6, y0 + 4, col);
    uiText(r, `POSITIE ${car.place}/${n}`, 22, y0 + 4, UI_WHITE);
    uiText(r, `RONDE ${Math.min(car.lap, laps)}/${laps}`, 6, y0 + 14, UI_WHITE);
    uiText(r, raceClock(car.finished ? car.finishTicks : this.lapNow(car)), VIEW3D_W - 6, y0 + 4, UI_WHITE, 'right');
    const best = this.bestLap(car);
    if (best >= 0) uiText(r, `BESTE ${raceClock(best)}`, VIEW3D_W - 6, y0 + 14, UI_GREY, 'right');
    uiText(r, `${Math.round(Math.abs(car.speed) * 3.6)} KM/H`, VIEW3D_W - 6, y0 + 96, UI_GOLD, 'right');
    if (car.finished && runner.phase === 'race') centerText(r, `FINISH! ${car.place}E`, y0 + 40, UI_GOLD, 'big');
  }

  /** The results: the standings with the times (projected times in grey), over the orbiting camera. */
  private drawResults(r: Renderer): void {
    const order = this.runner.race.order;
    const rows = order.length;
    const top = Math.max(24, 108 - ((rows * 10 + 22) >> 1));
    const x0 = 112;
    const x1 = 272;
    r.rect(x0 - 6, top - 4, x1 - x0 + 12, rows * 10 + 24, 0x05060aff, PANEL);
    centerText(r, 'UITSLAG', top, UI_GOLD, 'big');
    for (let i = 0; i < rows; i++) {
      const c = order[i];
      const y = top + 16 + i * 10;
      const player = c.slot >= 0;
      const col = player ? PLAYER_COLORS[c.slot === 1 ? 1 : 0] : c.projected ? UI_GREY : UI_WHITE;
      uiText(r, `${c.place}`, x0, y, col);
      uiText(r, c.team, x0 + 14, y, col);
      uiText(r, c.finishTicks >= 0 ? raceClock(c.finishTicks) : '-', x1, y, col, 'right');
    }
  }
}
