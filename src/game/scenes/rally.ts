/**
 * RallyScene: mission `rally`, level 3 (since 2026-10-31) — BINNEN DE RING, the 3D race on the A10 (docs/design/rally.md
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
import { splineSample } from '../../engine/r3/spline';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { artTier } from '../../engine/sprites';
import { PS1_ON, VIEW3D_H, VIEW3D_W, type DrawItem, type Light3, type View3 } from '../../engine/view3d';
import { centerText, PLAYER_COLORS, uiText, UI_GOLD, UI_GREY, UI_WHITE, type GameApp } from '../app';
import { carModelInfo, poseWheel, type RallyCarModel } from '../content/rally/models/types';
import { RALLY_SAMPLE_GROUP } from '../content/samples/rally';
import { densityAtRes } from '../fps/hud';
import type { CarState, RallyBody, RallyOpts, RallyTrackView } from '../rally/api';
import { INTRO, introCam, newCam, stepRig } from '../rally/camera';
import { daylight, newDaylight, raceProgress } from '../rally/daylight';
import { BODY_LIGHT } from '../rally/ids';
import { lockAt } from '../rally/physics';
import { RallyRadio } from '../rally/radio';
import { rallyHud, rallyModel, rallyScenery, type RallyDrawCtx, type RallyHudPart, type RallyHudView, type RallyScenery } from '../rally/registry';
import { RallyRunner } from '../rally/runner';
import { attachRallySound, type RallySound } from '../rally/sound';
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

/**
 * Inside a tunnel tube the lit things (the road, the cars) take the sodium lamps' cast instead of
 * the sky's light (WORLD's request; the tube's own walls are emissive): the ambient and the key
 * light, blended in over `TUNNEL_FADE` m at each mouth. Cosmetic.
 */
export const TUNNEL_LIGHT = { ambient: [0.92, 0.6, 0.3] as const, sun: [0.18, 0.12, 0.06] as const };
const TUNNEL_FADE = 30;

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

/** Wave B: a body that is not a race car (traffic, police, props), drawn by its `model`. */
interface BodyDraw {
  readonly body: RallyBody;
  readonly m: Float32Array;
  readonly info: RallyCarModel | null;
  readonly wheels: Float32Array[];
  readonly near: DrawItem[];
  readonly far: DrawItem[];
  readonly brake: DrawItem | null;
  /** The model and colour it was built for (a pooled body may change them). */
  readonly model: string;
  readonly clutRow: number | undefined;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

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
  /**
   * The race intro (wave B, spec §1): the camera flies over the grid (`introCam`) before the
   * countdown; the race waits. Its tick (−1: none or done). Only after the glitch's fold (a sim, a
   * test without the fold starts at once). During the fold the camera holds the fly-over's first view.
   */
  private introT = -1;
  private readonly introEnd = newCam();
  private readonly introTmp = splineSample();
  /** Each view's light inside a tunnel (a copy of the day's, tinted; reused). */
  private readonly tunnelLights: Light3[] = [0, 1].map(() => ({ ...RALLY_LIGHT, sunDir: [0, 1, 0], sun: [0, 0, 0], ambient: [0, 0, 0], fog: [0, 0, 0], skyTop: [0, 0, 0], skyBottom: [0, 0, 0] }));
  /** Ticks with the WebGL context lost; the scene is leaving. */
  private lostT = 0;
  private leaving = false;
  /**
   * Wave B hook points (PREP, docs/api/rally.md "B.6"): the time of day (one world time for both
   * views: `daylight(raceProgress(...))` every frame), the radio ticker's text (wave C's radio writes
   * it), the lazy content's scenery parts and HUD parts, and the bodies that are not race cars.
   */
  readonly day = newDaylight();
  ticker = '';
  /** Wave C (RADIO): FILE FM's director (src/game/rally/radio.ts); it writes `ticker`. */
  private radio: RallyRadio | null = null;
  /** Wave C (SFX): the race's sound (src/game/rally/sound.ts). */
  private sound: RallySound | null = null;
  private sceneries: RallyScenery[] = [];
  private hudParts: RallyHudPart[] = [];
  /** The scene draws its own results (no 'results' HUD part is registered). */
  private ownResults = true;
  private bodyDraws: BodyDraw[] = [];
  private readonly drawCtx: Mutable<RallyDrawCtx>[] = [];
  private readonly hudViews: Mutable<RallyHudView>[] = [];

  constructor(app: GameApp, opts: RallySceneOpts = {}) {
    this.app = app;
    this.opts = opts;
  }

  get session(): GameSession {
    if (this.opts.session) return this.opts.session;
    if (!this.app.session) this.app.session = new GameSession({ seed: this.app.params.seed ?? 1 });
    return this.app.session;
  }

  /** The fly-over over the grid is running (the race waits; spec §1). */
  get introducing(): boolean {
    return this.introT >= 0;
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
    // Wave C (RADIO): FILE FM, the car radio (cosmetic: it reads the race, never writes it).
    this.radio = new RallyRadio({ audio: app.audio, runner, on: () => app.settings.musicVolume > 0 });
    // Wave C (SFX): the race's synth sound (engines, tyres, hits, horns, the siren, the flash, the
    // tunnels, the countdown beeps, GO, the pull-over; cosmetic). It replaces wave B's placeholders.
    this.sound = attachRallySound(runner, app.audio);
    runner.start();
    // Wave C: FILE FM's sample group (the card's preload started it; a direct start loads it here).
    void app.audio.loadSamples?.(RALLY_SAMPLE_GROUP);
    app.debug.on('skip', () => runner.finishNow());
    // Wave B: the HUD parts of the lazy content (RULES), one set per race.
    const huds = rallyHud();
    this.hudParts = huds.map((def) => def.create(runner));
    // FIELD's results part (UITSLAG with best laps and fines) replaces the scene's own panel.
    this.ownResults = !huds.some((def) => def.id === 'results');
    if (this.opts.fold) {
      this.fold = new RallyFold(this.opts.fold, start.players);
      this.foldPlayers = start.players;
      this.foldT = 0;
      this.introT = 0;
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
    // Wave C (SFX): every engine, loop and the tunnel echo stop.
    this.sound?.detach();
    this.sound = null;
    // Wave C (RADIO): the radio goes quiet and neutral (setRadio(null), music(null)).
    this.radio?.dispose();
    this.radio = null;
    this.ticker = '';
    // The race is over (or left): FILE FM's decoded lines and jingles go (a streamed song decodes nothing).
    app.audio.releaseSamples?.(RALLY_SAMPLE_GROUP);
    for (const p of this.hudParts) p.dispose?.();
    this.hudParts = [];
    this.sceneries = [];
    this.bodyDraws = [];
  }

  /** A scene opened on top (pause): the music at half level; the engines and loops go silent. */
  pause(): void {
    this.app.input.joinWatch = false;
    this.app.audio.duckMusic?.(0.5);
    this.sound?.pause();
  }

  resume(): void {
    this.sound?.resume();
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
      // The engines and loops go silent while the race waits.
      if (this.lostT === 0) this.sound?.pause();
      this.lostT++;
      if (this.lostT >= GL_LOST_TICKS) this.toNoGl(app.view3d.reason || 'the 3D view was lost');
      return;
    }
    if (this.lostT > 0) this.sound?.resume();
    this.lostT = 0;
    this.controls.trackDevice();
    const racing = runner.phase === 'grid' || runner.phase === 'race';
    // The lost-pad pause, joins and pad claims, the pause (play-host.ts).
    if (racing && !app.scenes.busy && this.controls.interrupt()) return;
    this.controls.watchKeySplit();
    // Wave C (RADIO): FILE FM steps every update (the fold and the fly-over too) and fills the ticker.
    if (this.radio) {
      this.radio.step(this.fold || this.introT >= 0 ? 'intro' : runner.phase);
      this.ticker = this.radio.ticker;
    }
    if (this.fold) {
      this.stepFold();
      this.sound?.tick();
      return;
    }
    if (this.introT >= 0) {
      // The fly-over: exactly `INTRO.ticks` ticks of waiting (fewer when a button skips it).
      this.stepIntro();
      this.sound?.tick();
      return;
    }
    runner.step();
    for (const p of this.hudParts) p.tick?.();
    // Wave C (SFX): after the race step (the countdown beeps and GO come from the module).
    this.sound?.tick();
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

  /** The light of view i with its car at arc length s: the day's, or the sodium cast in a tunnel. */
  private lightAt(i: number, s: number): Light3 {
    const day = this.day.light;
    const tunnels = (this.runner.track as { readonly tunnels?: readonly { readonly s0: number; readonly s1: number }[] }).tunnels;
    if (!tunnels) return day;
    let k = 0;
    for (const t of tunnels) {
      if (s < t.s0 || s > t.s1) continue;
      k = Math.min(1, (s - t.s0) / TUNNEL_FADE, (t.s1 - s) / TUNNEL_FADE);
      break;
    }
    if (k <= 0) return day;
    const out = this.tunnelLights[i];
    for (let c = 0; c < 3; c++) {
      out.sunDir[c] = day.sunDir[c];
      out.fog[c] = day.fog[c];
      out.skyTop[c] = day.skyTop[c];
      out.skyBottom[c] = day.skyBottom[c];
      out.ambient[c] = day.ambient[c] + (TUNNEL_LIGHT.ambient[c] - day.ambient[c]) * k;
      out.sun[c] = day.sun[c] + (TUNNEL_LIGHT.sun[c] - day.sun[c]) * k;
    }
    out.fogNear = day.fogNear;
    out.fogFar = day.fogFar;
    return out;
  }

  /** One tick of the fly-over: the rigs settle behind the cars; any button skips it (after a moment). */
  private stepIntro(): void {
    const runner = this.runner;
    const input = this.app.input;
    for (const car of runner.cars) if (car.slot >= 0) stepRig(runner.rigs[car.slot === 1 ? 1 : 0], car, runner.info, false, false);
    this.introT++;
    const skip = this.introT > 20 && (input.pad(0).anyPressed() || input.pad(1).anyPressed());
    if (this.introT >= INTRO.ticks || skip) this.introT = -1;
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
      // Wave B: the scenery parts of the lazy content (built once per track).
      this.sceneries = rallyScenery(track);
      for (const sc of this.sceneries) v3.upload(sc.meshes, sc.pages);
      this.uploaded = true;
    }
    const bodies = this.runner.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const id = i < this.runner.cars.length ? this.runner.cars[i].spec.model : b.model;
      if (!id || this.models.has(id)) continue;
      this.models.add(id);
      const model = rallyModel(id);
      if (model) v3.upload(model.meshes, model.pages);
    }
  }

  /** Wave B: the draw data of a body that is not a race car (by its model; null when it has none). */
  private bodyDraw(body: RallyBody): BodyDraw | null {
    const id = body.model;
    const model = id ? rallyModel(id) : null;
    if (!id || !model) return null;
    const info = carModelInfo(model);
    const m = new Float32Array(16);
    const row = body.clutRow;
    const item = (mesh: string, mm: Float32Array): DrawItem => (row === undefined ? { mesh, m: mm } : { mesh, m: mm, clutRow: row });
    const wheels: Float32Array[] = [];
    let near: DrawItem[];
    let far: DrawItem[];
    let brake: DrawItem | null = null;
    if (info) {
      near = info.body.map((mid) => item(mid, m));
      for (const w of info.anchors.wheels) {
        const wm = new Float32Array(16);
        wheels.push(wm);
        near.push(item(w.mesh, wm));
      }
      far = info.lod.parts.map((mid) => item(mid, m));
      brake = item(info.lights.brake, m);
    } else {
      near = model.parts.map((mid) => item(mid, m));
      far = near;
    }
    return { body, m, info, wheels, near, far, brake, model: id, clutRow: row };
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
    // Wave B: the other bodies (traffic, police, props).
    this.bodyDraws = [];
    for (let i = runner.cars.length; i < runner.bodies.length; i++) {
      const bd = this.bodyDraw(runner.bodies[i]);
      if (bd) this.bodyDraws.push(bd);
    }
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
    // Wave B: the other bodies (a pooled body that changed its model or colour gets new draw data).
    for (let i = 0; i < this.bodyDraws.length; i++) {
      let bd = this.bodyDraws[i];
      const b = bd.body;
      if (b.model !== bd.model || b.clutRow !== bd.clutRow) {
        const nb = this.bodyDraw(b);
        if (!nb) continue;
        if (!this.models.has(nb.model)) this.upload();
        this.bodyDraws[i] = bd = nb;
      }
      mat4PoseYPR(bd.m, b.pos[0], b.pos[1], b.pos[2], b.yaw, b.phys.pitch, b.phys.roll);
      if (!bd.info) continue;
      const steer = b.steer * lockAt(b.phys.h, b.speed);
      const ws = bd.info.anchors.wheels;
      for (let k = 0; k < ws.length; k++) {
        const w = ws[k];
        const lap = 6.283185307 * w.r;
        poseWheel(bd.wheels[k], bd.m, w, w.front ? steer : 0, (b.dist - Math.floor(b.dist / lap) * lap) / w.r);
      }
    }
  }

  /** Wave B: the draw context of view i for the scenery parts (reused every frame). */
  private ctxOf(i: number): RallyDrawCtx {
    const v = this.views[i];
    let c = this.drawCtx[i];
    if (!c) c = this.drawCtx[i] = { runner: this.runner, view: i, cam: v.cam, aspect: 1, far: 0, day: this.day, t: 0, v3: this.app.view3d };
    c.runner = this.runner;
    c.cam = v.cam;
    c.aspect = v.w / v.h;
    c.far = v.light.fogFar;
    c.t = this.t;
    c.v3 = this.app.view3d;
    return c;
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
    // Wave B: the scenery parts (WORLD's sections, landmarks, signs; FIELD's oncoming traffic).
    if (this.sceneries.length > 0) {
      const ctx = this.ctxOf(i);
      for (const sc of this.sceneries) k = sc.fill(ctx, list, k);
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
    // Wave B: the other bodies (a hidden one is parked in its pool).
    for (const bd of this.bodyDraws) {
      const b = bd.body;
      if (b.hidden) continue;
      const dx = b.pos[0] - cx;
      const dy = b.pos[1] - cy;
      const dz = b.pos[2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > farSq) continue;
      const parts = d2 > lodSq ? bd.far : bd.near;
      for (let q = 0; q < parts.length; q++) list[k++] = parts[q];
      if (bd.brake && d2 <= lodSq && ((b.lights ?? 0) & BODY_LIGHT.brake) !== 0) list[k++] = bd.brake;
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
    // Wave B: the time of day (one world time for both views).
    daylight(raceProgress(runner.race, runner.track.length), this.day);
    this.poseCars();
    const split = this.playerCars.length > 1;
    const n = Math.min(2, this.playerCars.length);
    for (let i = 0; i < n; i++) {
      const v = this.views[i];
      v.x = 0;
      v.y = split ? i * (VIEW3D_H / 2) : 0;
      v.w = VIEW3D_W;
      v.h = split ? VIEW3D_H / 2 : VIEW3D_H;
      v.light = this.lightAt(i, this.playerCars[i].s);
      runner.camera(this.playerCars[i].slot, v.cam, split);
      if (this.introT >= 0) {
        // The fly-over (the fold folds into its first view): from over the gantry down into the chase camera.
        const e = this.introEnd;
        e.pos[0] = v.cam.pos[0];
        e.pos[1] = v.cam.pos[1];
        e.pos[2] = v.cam.pos[2];
        e.yaw = v.cam.yaw;
        e.pitch = v.cam.pitch;
        e.roll = v.cam.roll;
        e.fovY = v.cam.fovY;
        e.near = v.cam.near;
        e.far = v.cam.far;
        introCam(this.introT, runner.track, runner.cars, this.playerCars[i], e, v.cam, this.introTmp);
      }
      this.fillView(i);
    }
    const src = n > 0 ? v3.render(split ? this.two : this.one, PS1_ON) : null;
    r.surface?.(src, 0, 0, VIEW3D_W, VIEW3D_H);
    if (this.introT >= 0) this.drawIntro(r, split);
    else if (!this.fold || this.foldT >= HUD_AFTER_FOLD) this.drawHud(r, split);
    const debug = app.debug;
    if (debug.enabled) centerText(r, `SEED ${runner.seed}  ${runner.phase.toUpperCase()}  T${runner.race.raceTick}`, debug.stats ? 11 : 2, PAL.stone[3]);
  }

  /** The fly-over's titles (no HUD yet): the rally's name and the laps, in each view. */
  private drawIntro(r: Renderer, split: boolean): void {
    if ((this.fold && this.foldT < HUD_AFTER_FOLD) || this.introT > INTRO.ticks - 90) return;
    const n = split ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const y = split ? i * 108 + 14 : 26;
      centerText(r, 'DE RINGRALLY', y, UI_GOLD, 'big', split ? 1 : 2);
      centerText(r, `${this.runner.laps} RONDEN  A10  ${this.runner.cars.length} AUTO'S`, y + (split ? 14 : 24), UI_WHITE);
    }
    if (split) r.rect(0, VIEW3D_H / 2 - 1, VIEW3D_W, 1, SPLIT_LINE);
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
      // Wave B: the HUD parts of the lazy content (RULES: warnings, the clock, the ticker, the map).
      if (this.hudParts.length > 0) {
        let hv = this.hudViews[i];
        if (!hv) hv = this.hudViews[i] = { slot: car.slot, car, x: 0, y: 0, w: VIEW3D_W, h: VIEW3D_H, split, day: this.day, ticker: '' };
        hv.slot = car.slot;
        hv.car = car;
        hv.y = split ? i * 108 : 0;
        hv.h = split ? 108 : VIEW3D_H;
        hv.split = split;
        hv.ticker = this.ticker;
        for (const p of this.hudParts) p.draw(r, hv);
      }
    }
    for (const p of this.hudParts) p.drawFrame?.(r);
    // The split: a dark line between the two views (P2's sky never touches P1's road).
    if (split) r.rect(0, VIEW3D_H / 2 - 1, VIEW3D_W, 1, SPLIT_LINE);
    if (this.fold) return;
    const cd = runner.countdown;
    if (runner.phase === 'grid' && cd > 0) {
      const s = String(Math.ceil(cd / 60));
      if (split) for (let i = 0; i < 2; i++) centerText(r, s, i * 108 + 26, UI_WHITE, 'big', 2);
      else centerText(r, s, 72, UI_WHITE, 'big', 3);
    } else if (runner.phase === 'race' && runner.race.raceTick < 50) {
      if (split) for (let i = 0; i < 2; i++) centerText(r, 'GO!', i * 108 + 26, UI_GOLD, 'big', 2);
      else centerText(r, 'GO!', 72, UI_GOLD, 'big', 3);
    }
    if (this.ownResults && (runner.phase === 'finish' || runner.phase === 'done')) this.drawResults(r);
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
