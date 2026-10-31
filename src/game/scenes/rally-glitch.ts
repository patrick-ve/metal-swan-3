/**
 * The glitch into 3D (docs/design/rally.md §1.2, §12.3; docs/api/rally.md "A.I"): the MISSION 3
 * card's last frame breaks into blocks, the blocks turn into flat polygons, and the polygons fold
 * into the 3D start grid (about one second; the look of the glitch bridge, glitch-bridge.ts, but
 * its own code and its own synth sounds: the bridge's live in the lazy fps content, which this scene
 * never loads).
 *
 * `RallyGlitchScene` is also the gate into the race:
 * - `hold`: the card's frozen frame (a direct `?mission=rally` start has no card: a black frame
 *   with MISSION 3 / BINNEN DE RING), with a small row twitch now and then, until the lazy rally
 *   content is registered (`loadRallyContent`; usually done during the card) — at least
 *   `HOLD_MIN` ticks, at most `GLITCH_MAX_WAIT`.
 * - `break` (`BREAK_TICKS`): the frame corrupts (8 × 8 blocks copied, row bands shifted, a band of
 *   rows a shade off; the `rally/glitch` crackle), then, from `MOSAIC_AT`, its `FOLD_TILE` blocks
 *   turn one by one into flat colours (each block's average): the 2D mosaic.
 * - Then the GL check (`rallyGl`): the `RallyScene` starts with the mosaic (`RallySceneOpts.fold`):
 *   its first `FOLD_TICKS` show the tiles as 3D polygons that fold into the grid (rally-fold.ts,
 *   the `rally/fold` sound), then the countdown runs. Without WebGL2 (or `?gl=0`, or when the
 *   content failed): `RallyNoGlScene` — the short card THIS DEVICE CANNOT SHOW 3D, then the tally
 *   with no race lines, then the glitch bridge (spec §0 item 23: the run never dead-ends).
 *
 * All corruption works on the frame's own colours (copies, shifts, `stepShade` / the HD ramps).
 * Cosmetic randomness only (its own `Rng`, never the race's); no allocation per tick.
 */
import { hasSfx } from '../../engine/audio';
import type { Color } from '../../engine/color';
import { PAL, stepShade } from '../../engine/palette';
import { hdHome } from '../../engine/palette-hd';
import type { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../engine/render';
import { SoftRenderer } from '../../engine/render-soft';
import { Rng } from '../../engine/rng';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import type { RallyOpts } from '../rally/api';
import { missionCard } from './flow-data';
import { RALLY_SAMPLE_GROUP } from '../content/samples/rally';
import { RALLY_ID } from '../rally/ids';
import { GameSession } from '../session';
import { MissionCompleteScene } from './mission-complete';
import { foldTiles, tileColour, type FoldTile } from './rally-fold';
import { loadRallyContent, rallyGl, rallyLoadState, rallyNoGlTally, rallySceneModule } from './rally-route';

/** The frozen frame holds at least this long (ticks). */
export const HOLD_MIN = 8;
/** The break: corruption, then the mosaic from `MOSAIC_AT` (ticks). */
export const BREAK_TICKS = 36;
export const MOSAIC_AT = 22;
/** PREP's name: the glitch (hold + break) lasts at least this long (ticks). */
export const GLITCH_MIN = HOLD_MIN + BREAK_TICKS;
/** The content may take this long at most; then the no-3D path (ticks). */
export const GLITCH_MAX_WAIT = 900;
/**
 * Wave C: the announcer's line (the card's `announce`, MISSION THREE. VOL GAS!) starts with the frozen
 * frame; while it speaks the frame holds up to this tick, so the break comes on its shout ("VOL GAS!"
 * starts 1.6 s into the 2.8 s take). No voice (no sample, the ANNOUNCER option off): no wait.
 */
export const ANNOUNCE_BREAK = 96;
/** The picture's density (the glitch density of the bridge: crisp at 2×, cheap at 4K). */
const G = 2;
const W = 384;
const H = 216;

export interface RallyGlitchOpts {
  /** The prepared race (the card's `prepareRally`). */
  start: RallyOpts;
  /** The scene whose last frame breaks up (the MISSION 3 card; absent on a direct start). */
  from?: Scene;
}

export type GlitchPhase = 'hold' | 'break' | 'gone';

const streamed: DrawOpts = { screen: true, stream: true };
const plain: DrawOpts = { screen: true };

/** The frozen frame: the card drawn once into a private software renderer at density `G`. */
function snapshot(scene: Scene | null): PixelBuffer {
  const r = new SoftRenderer(W, H, undefined, { res: G });
  let drawn = false;
  if (scene) {
    try {
      scene.draw(r);
      drawn = true;
    } catch (err) {
      console.error('[rally] the card snapshot failed:', err);
    }
  }
  if (!drawn) {
    // A direct start (or a failed draw): the card's title on black.
    r.begin(0x000000ff);
    centerText(r, 'MISSION 3', 90, UI_WHITE, 'big');
    centerText(r, 'BINNEN DE RING', 106, UI_GOLD, 'big');
  }
  r.end();
  return r.target;
}

export class RallyGlitchScene implements Scene {
  readonly app: GameApp;
  readonly start: RallyOpts;
  /** The card (its last frame is the picture). */
  readonly from: Scene | null;
  /** The picture at density `G` (the damage accumulates in it) and its frame. */
  readonly work: PixelBuffer;
  private readonly frame: Frame;
  /** The mosaic: the tiles (the fold's grid), their average colours, the break tick each goes flat. */
  private readonly tiles: readonly FoldTile[];
  private readonly flat: Uint32Array;
  private readonly flatAt: Uint16Array;
  private readonly row: Uint32Array;
  private readonly fxRng: Rng;
  private _phase: GlitchPhase = 'hold';
  private t = 0;
  /** Ticks in the current phase. */
  private pt = 0;
  private nextSfx = 0;
  private shadeFrom = -1;
  private shadeTo = 0;
  private shadeDelta = 0;

  constructor(app: GameApp, o: RallyGlitchOpts) {
    this.app = app;
    this.start = o.start;
    this.from = o.from ?? null;
    // Before scenes.replace runs the card's exit: its frame is still intact.
    this.work = snapshot(this.from);
    this.frame = { buf: this.work, ox: 0, oy: 0, density: G };
    this.row = new Uint32Array(W * G);
    this.fxRng = new Rng(((o.start.seed >>> 0) ^ 0x3d10a7) >>> 0);
    this.tiles = foldTiles(o.start.players);
    this.flat = new Uint32Array(this.tiles.length);
    // Each tile goes flat at its own tick of the mosaic (a shuffled order).
    this.flatAt = new Uint16Array(this.tiles.length);
    const span = BREAK_TICKS - MOSAIC_AT - 2;
    for (let i = 0; i < this.tiles.length; i++) this.flatAt[i] = MOSAIC_AT + this.fxRng.int(0, span);
  }

  get phase(): GlitchPhase {
    return this._phase;
  }

  enter(): void {
    this.app.input.suppress();
    this.app.pointerPressed = false;
    this.app.audio.music(null, { fadeTicks: 20 });
    void loadRallyContent();
    const line = missionCard(RALLY_ID).announce;
    if (line) this.app.audio.voice(line);
  }

  update(): void {
    this.t++;
    this.pt++;
    if (this._phase === 'gone') return;
    if (this._phase === 'hold') {
      const st = rallyLoadState();
      const voiced = this.t >= ANNOUNCE_BREAK || !this.app.audio.speaking?.();
      if ((this.pt >= HOLD_MIN && (st.registered || st.failed) && voiced) || this.t >= GLITCH_MAX_WAIT) {
        this._phase = 'break';
        this.pt = 0;
        this.nextSfx = 0;
      } else if (this.pt % 24 === 12) {
        // A small twitch while the race loads (a long load reads as "about to break").
        this.shiftRows(this.fxRng.int(0, H - 4), this.fxRng.int(1, 3), this.fxRng.int(1, 4) * this.fxRng.sign());
        this.work.touch();
      }
      return;
    }
    // The break.
    if (this.pt < MOSAIC_AT) this.corrupt();
    if (this.pt >= this.nextSfx && this.pt < MOSAIC_AT) {
      this.sfx('rally/glitch');
      this.nextSfx = this.pt + this.fxRng.int(7, 16);
    }
    if (this.pt === MOSAIC_AT) {
      // The blocks' colours: averages of the broken frame.
      for (let i = 0; i < this.tiles.length; i++) this.flat[i] = tileColour(this.work, this.tiles[i]);
    }
    if (this.pt >= MOSAIC_AT) this.flatten();
    if (this.pt >= BREAK_TICKS) this.leave();
  }

  /** Into the race (the fold), or the no-3D path. */
  private leave(): void {
    this._phase = 'gone';
    const app = this.app;
    const st = rallyLoadState();
    const gl = rallyGl(app);
    // The race scene is a lazy chunk (loaded with the content: `registered` waits for it).
    const mod = rallySceneModule();
    if (gl.ok && st.registered && mod) app.scenes.replace(new mod.RallyScene(app, { start: this.start, fold: this.work }), { fade: 0 });
    else app.scenes.replace(new RallyNoGlScene(app, { start: this.start, reason: st.registered ? gl.reason : 'the race did not load' }), { fade: 20 });
  }

  private sfx(id: string): void {
    if (hasSfx(id)) this.app.audio.sfx(id);
  }

  /** One break tick (the bridge's recipe, shorter and harder): blocks, shifted bands, a shade band. */
  private corrupt(): void {
    const rng = this.fxRng;
    const k = Math.min(1, this.pt / MOSAIC_AT);
    const data = this.work.data;
    const GW = W * G;
    const blocks = 3 + Math.round(14 * k);
    for (let b = 0; b < blocks; b++) {
      const sx = rng.int(0, W - 8) * G;
      const sy = rng.int(0, H - 8) * G;
      const dx = rng.int(0, W - 8) * G;
      const dy = rng.int(0, H - 8) * G;
      for (let y = 0; y < 8 * G; y++) data.copyWithin((dy + y) * GW + dx, (sy + y) * GW + sx, (sy + y) * GW + sx + 8 * G);
    }
    const bands = 1 + Math.round(5 * k);
    const maxShift = 2 + Math.round(22 * k);
    for (let b = 0; b < bands; b++) this.shiftRows(rng.int(0, H - 2), rng.int(2, 8), rng.int(1, maxShift) * rng.sign());
    const sy = rng.int(0, H - 2);
    const sn = rng.int(2, 6 + Math.round(8 * k));
    const delta = rng.sign();
    for (let i = sy * G * GW, end = Math.min(H, sy + sn) * G * GW; i < end; i++) data[i] = this.shade(data[i], delta);
    this.work.touch();
  }

  /** The tiles whose tick has come go flat (their average colour). */
  private flatten(): void {
    const data = this.work.data;
    const GW = W * G;
    let changed = false;
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.flatAt[i] !== this.pt) continue;
      const t = this.tiles[i];
      const c = this.flat[i];
      for (let y = t.y * G; y < (t.y + t.h) * G; y++) data.fill(c, y * GW + t.x * G, y * GW + (t.x + t.w) * G);
      changed = true;
    }
    // The last tick: every tile is flat (the fold starts from the full mosaic).
    if (this.pt === BREAK_TICKS - 1) {
      for (let i = 0; i < this.tiles.length; i++) {
        const t = this.tiles[i];
        for (let y = t.y * G; y < (t.y + t.h) * G; y++) data.fill(this.flat[i], y * GW + t.x * G, y * GW + (t.x + t.w) * G);
      }
      changed = true;
    }
    if (changed) this.work.touch();
  }

  /** A colour two tones lighter (+1) or darker (−1) in its HD ramp, else one palette shade. */
  private shade(c: number, delta: number): number {
    if (c === this.shadeFrom && delta === this.shadeDelta) return this.shadeTo;
    const h = hdHome(c as Color);
    const out = h ? h.ramp[Math.max(0, Math.min(h.ramp.length - 1, h.i + delta * 2))] >>> 0 : stepShade(c as Color, delta) >>> 0;
    this.shadeFrom = c;
    this.shadeDelta = delta;
    this.shadeTo = out;
    return out;
  }

  /** Shift `n` rows from `y0` sideways by `s` logical px (wrapping). */
  private shiftRows(y0: number, n: number, s: number): void {
    const data = this.work.data;
    const row = this.row;
    const GW = W * G;
    const sg = s * G;
    for (let y = Math.max(0, y0) * G; y < Math.min(H, y0 + n) * G; y++) {
      const o = y * GW;
      row.set(data.subarray(o, o + GW));
      for (let x = 0; x < GW; x++) data[o + ((x + sg + GW * 4) % GW)] = row[x];
    }
  }

  draw(r: Renderer): void {
    r.begin(0x000000ff);
    r.frame(this.frame, 0, 0, this._phase === 'hold' ? plain : streamed);
  }
}

export interface RallyNoGlOpts {
  start: RallyOpts;
  /** Why (the 3D view's reason; small, under the card's line). */
  reason: string;
}

/** The card shows at least this long before a press skips it, at most `NO_GL_TICKS`. */
export const NO_GL_SKIP_AFTER = 60;
export const NO_GL_TICKS = 240;

/** The no-WebGL2 card (spec §0 item 23): then the tally with no race lines, then the bridge. */
export class RallyNoGlScene implements Scene {
  readonly app: GameApp;
  readonly opts: RallyNoGlOpts;
  private t = 0;
  private leaving = false;

  constructor(app: GameApp, o: RallyNoGlOpts) {
    this.app = app;
    this.opts = o;
  }

  private get session(): GameSession {
    if (!this.app.session) this.app.session = new GameSession({ seed: this.opts.start.seed });
    return this.app.session;
  }

  enter(): void {
    this.app.input.suppress();
    this.app.pointerPressed = false;
    this.session.startMission(RALLY_ID);
    // Fixer (wave C review): no race, so drop FILE FM's decoded lines and jingles (the card's
    // preload may have loaded them before the context failed).
    this.app.audio.releaseSamples?.(RALLY_SAMPLE_GROUP);
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = app.input;
    const press = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.keyPressed('Enter') || app.pointerPressed;
    app.pointerPressed = false;
    if (this.t >= NO_GL_TICKS || (press && this.t >= NO_GL_SKIP_AFTER)) {
      this.leaving = true;
      app.scenes.replace(new MissionCompleteScene(app, rallyNoGlTally(this.session, this.opts.start.seed)), { fade: 30 });
    }
  }

  draw(r: Renderer): void {
    r.begin(0x000000ff);
    centerText(r, 'MISSION 3', 72, UI_WHITE, 'big');
    centerText(r, 'THIS DEVICE CANNOT SHOW 3D', 96, UI_GOLD, 'big');
    if (this.opts.reason) centerText(r, this.opts.reason.toUpperCase().slice(0, 60), 120, PAL.stone[2]);
    if (this.t >= NO_GL_SKIP_AFTER && blinkOn(this.t)) centerText(r, 'PRESS START', 190, PAL.stone[3]);
  }
}
