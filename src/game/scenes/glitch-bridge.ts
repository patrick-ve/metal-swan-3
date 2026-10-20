/**
 * GlitchBridgeScene (docs/design/fps.md §1.3): the game "breaks" at the end of the ring (level 2;
 * before the ring existed: after the ams boss). The last frame freezes, corrupts (row bands shift, 8×8 blocks copy, bands of rows change shade), a story
 * card types in on black, the card folds into a 1-px line like an old TV, and the first-person
 * mode starts at floor 1 (`startFpsRun`).
 *
 * Phases: `freeze` (≥ 30 ticks, until the lazy fps content is registered, at most 120) → `glitch`
 * (120 ticks; the last 4 black) → `card` (typing, PRESS START, a 150-tick hold) → `fold` (60).
 *
 * The bridge follows the ring (docs/design/ring.md §1: ams → its tally → the ring → the bridge).
 * With a runner (the real route: the ring's RingRunner; any MissionRunner works the same) `enter`
 * records the clear (`recordMissionClear`) and pays the tally silently (`silentTally`); a
 * `MissionBonus` `{ mission, totals, seed }` goes to `session.records['fps/ams-bonus']` for the
 * floor-1 tally's `MISSION 2 BONUS` line (named after that mission; the ring's seed in its
 * footer). Without one (`?mode=bridge`) it shows a placeholder. The story card's first line is a
 * neutral one (`BRIDGE_OPENING`) until the ring's story exists.
 *
 * All corruption works on palette colours (copies, shifts, `stepShade`): it stays palette-only.
 * Cosmetic randomness only (`fxRng`); no per-tick allocations.
 *
 * UHD: the freeze shows the snapshot at the mission's art density; the glitch and the fold work
 * at the GLITCH DENSITY g = min(that density, 2) (a 4× snapshot is thinned to 2×: a corrupted
 * frame streamed every tick stays cheap at 4K), with the same random choices in logical px, so
 * blocks, bands and the banner's jitter are the 1× ones; a shade band steps two tones of the HD
 * ramps (`hdHome`). The card is rendered at g for the fold, so its text stays crisp while it
 * squeezes. At density 1 everything is exactly as before. On enter the mission's 4× frames (its
 * tier-4 working set) are dropped: the route never goes back to the mission, the snapshot is a
 * copy, and the fps art (dense-load.ts) gets the DENSE_BUDGET_BYTES to itself.
 */
import { hasSfx } from '../../engine/audio';
import { generatedSprites, releaseDense } from '../../engine/sprites';
import type { Color } from '../../engine/color';
import { hasSong } from '../../engine/music';
import { PAL, stepShade } from '../../engine/palette';
import { hdHome } from '../../engine/palette-hd';
import { PixelBuffer } from '../../engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../engine/render';
import { lowRes } from '../../engine/render-common';
import { SoftRenderer } from '../../engine/render-soft';
import { Rng } from '../../engine/rng';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, textWidth, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { BRIDGE_LINES, withCallsign } from '../content/fps/story';
import type { HudState } from '../context';
import { AMS_BONUS_KEY, fpsSlotIndex, type MissionBonus } from '../fps/run';
import { getCharacter, hasCharacter } from '../registry';
import { RING_ID } from '../ring/ids';
import { recordMissionClear, silentTally } from './flow';
import type { TallyRunner } from './mission-complete';
import { fpsLoadState, loadFpsContent } from './fps-intro';
import { startFpsRun } from './fps-route';

/**
 * What the bridge reads from the finished play: the ring's RingRunner (or a MissionRunner;
 * docs/design/ring.md §13: a type-only widening).
 */
export interface BridgeRunner extends TallyRunner {
  /** The art density of the snapshot. */
  readonly artDensity: number;
  readonly hud: Pick<HudState, 'banner'>;
  /** The play's seed (the ring's goes into the bonus record). */
  readonly seed?: number;
}

export interface BridgeOpts {
  /** The scene whose last frame freezes (the RingScene). */
  from?: Scene;
  /** The finished mission's runner: its clear is recorded and its tally paid silently. */
  runner?: BridgeRunner;
}

/**
 * The story card's first line (docs/design/ring.md §1): the bridge follows the ring now, so the
 * line that named the ams boss gives way to one neutral line until the ring's story exists.
 */
export const BRIDGE_OPENING = 'SOMEWHERE ON THE RING, SOMEONE HIT THE WRONG BUTTON.';

/** The story lines of the card (before the callsign is filled in): the opening, then the fps story. */
export function bridgeStory(): readonly string[] {
  return [BRIDGE_OPENING, ...BRIDGE_LINES.slice(1)];
}

export type BridgePhase = 'freeze' | 'glitch' | 'card' | 'fold';

/** The session record of the silent tally: a `MissionBonus` (spec §1.2; defined in fps/run.ts). */
export { AMS_BONUS_KEY };

/** Phase timing (spec §1.3). */
export const FREEZE_MIN = 30;
export const FREEZE_MAX = 120;
export const GLITCH_TICKS = 120;
/** The last ticks of the glitch are black. */
const GLITCH_BLACK = 4;
/** Ticks per typed character, ticks between two lines. */
export const TYPE_TICKS = 2;
export const LINE_GAP = 24;
/** Presses count from this card tick on. */
export const CARD_PRESS_FROM = 60;
/** The card holds this long after the last line before it folds by itself. */
export const CARD_HOLD = 150;
export const FOLD_TICKS = 60;
/** Story card layout: first line y, line step; the fold's line. */
export const CARD_Y = 52;
export const CARD_STEP = 20;
const FOLD_Y = 108;
/** The song is retried this often while the lazy content still loads. */
const MUSIC_RETRY = 30;

const W = 384;
const H = 216;

const plain: DrawOpts = { screen: true };
const streamed: DrawOpts = { screen: true, stream: true };

/** The `MISSION COMPLETE!` banner's line: the HUD's (y 90) or the placeholder's (y 100). */
const BANNER_Y = 90;
const PLACEHOLDER_BANNER_Y = 100;

/**
 * The snapshot of a scene: drawn once into a private software renderer at density `d`. The
 * runner's banner ends on the very tick of 'complete', so the bridge puts `MISSION COMPLETE!`
 * back where the HUD showed it (the picture of the frames before).
 */
function snapshot(scene: Scene | undefined, d: number, runner: BridgeRunner | null): Frame {
  const r = new SoftRenderer(W, H, undefined, { res: scene ? d : 1 });
  if (scene) {
    try {
      scene.draw(r);
    } catch (err) {
      console.error('[bridge] the snapshot draw failed:', err);
      r.begin(PAL.navy[0]);
    }
    if (runner && !runner.hud.banner) centerText(r, 'MISSION COMPLETE!', BANNER_Y, UI_GOLD, 'big');
  } else {
    r.begin(PAL.navy[0]);
    centerText(r, 'MISSION COMPLETE!', PLACEHOLDER_BANNER_Y, UI_GOLD, 'big');
  }
  r.end();
  return { buf: r.target, ox: 0, oy: 0, density: scene ? d : 1 };
}

/** Drop every 4× frame but the fps art's (the mission is over); returns the bytes freed. */
export function releaseMissionDense(): number {
  return releaseDense(generatedSprites(4).filter((id) => !id.startsWith('fps/')), 4);
}

export class GlitchBridgeScene implements Scene {
  private readonly app: GameApp;
  private readonly runner: BridgeRunner | null;
  /** The last frame of the previous scene (density d). */
  readonly snap: Frame;
  /** The 1× image the damage accumulates in (blocks), and the frame shown (+ shifts, shades). */
  private readonly base: PixelBuffer;
  private readonly work: PixelBuffer;
  /** The glitch density (1 or 2) and the frame of the work image at it. */
  readonly g: number;
  private readonly workFrame: Frame;
  /** One row (shift scratch). */
  private readonly row: Uint32Array;
  /** The last shade step looked up (colour → shaded): runs of one colour skip the look-up. */
  private shadeFrom = -1;
  private shadeTo = 0;
  private shadeDelta = 0;
  private readonly fxRng: Rng;
  private _phase: BridgePhase = 'freeze';
  /** Ticks in the current phase. */
  private pt = 0;
  private t = 0;
  private nextGlitchSfx = 0;
  private musicOn = false;
  /** The story lines (callsign filled in) and the card tick at which each starts typing. */
  readonly lines: readonly string[];
  private readonly lineStart: number[] = [];
  /** Left x of each line (centred on the whole line). */
  private readonly lineX: number[] = [];
  /** Card tick at which the last line is complete (moves earlier when a press finishes typing). */
  private typedAt: number;
  private skipped = false;
  /** Non-space characters typed so far (the `fps/type` click on every second one). */
  private typedCount = 0;
  /** The card as an image (made once when the fold starts). */
  private card: PixelBuffer | null = null;
  private started = false;
  /** Top line of the banner's text (its rows jitter in the glitch). */
  private readonly bannerY: number;

  constructor(app: GameApp, o: BridgeOpts = {}) {
    this.app = app;
    // The lazy content first: the chunk download gets the most time (spec §1.3).
    void loadFpsContent(app);
    this.runner = o.runner ?? null;
    const d = Math.max(1, Math.floor(o.runner?.artDensity ?? 1));
    // Before scenes.replace runs the gameplay scene's exit: its frame is still intact.
    this.snap = snapshot(o.from, d, this.runner);
    this.bannerY = o.from ? BANNER_Y : PLACEHOLDER_BANNER_Y;
    const sd = this.snap.density ?? 1;
    this.g = sd >= 2 ? 2 : 1;
    if (this.g === 1) {
      const one = lowRes(this.snap.buf, sd);
      // A copy either way: lowRes returns the snapshot itself at density 1, and a cached buffer else.
      this.base = one.clone();
    } else this.base = thinned(this.snap.buf, sd / this.g);
    this.work = this.base.clone();
    this.workFrame = { buf: this.work, ox: 0, oy: 0, density: this.g };
    this.row = new Uint32Array(W * this.g);
    this.fxRng = new Rng(((app.session?.seed ?? 1) ^ 0x9b1d93) >>> 0);
    const session = app.session;
    const charId = session ? session.slots[fpsSlotIndex(session)].character : 'recruit';
    const callsign = hasCharacter(charId) ? getCharacter(charId).name : 'RECRUIT';
    this.lines = bridgeStory().map((l) => withCallsign(l, callsign));
    let at = 0;
    for (const l of this.lines) {
      this.lineStart.push(at);
      this.lineX.push(Math.round((W - textWidth(l)) / 2));
      at += l.length * TYPE_TICKS + LINE_GAP;
    }
    this.typedAt = at - LINE_GAP;
  }

  get phase(): BridgePhase {
    return this._phase;
  }

  /** Ticks in the current phase. */
  get phaseTicks(): number {
    return this.pt;
  }

  enter(): void {
    const app = this.app;
    const runner = this.runner;
    if (runner && app.session) {
      recordMissionClear(app, runner);
      const totals = silentTally(app, runner);
      const mission = runner.mission.id;
      const bonus: MissionBonus = mission === RING_ID && runner.seed !== undefined ? { mission, totals, seed: runner.seed } : { mission, totals };
      app.session.records.set(AMS_BONUS_KEY, bonus);
    }
    app.input.suppress();
    app.pointerPressed = false;
    app.audio.music(null, { fadeTicks: 20 });
    releaseMissionDense();
  }

  update(): void {
    this.t++;
    this.pt++;
    const app = this.app;
    const press = this.pressed();
    if (this.musicOn === false && this._phase !== 'freeze' && this._phase !== 'fold' && (this.pt - 1) % MUSIC_RETRY === 0) this.startMusic();
    switch (this._phase) {
      case 'freeze': {
        const reg = fpsLoadState().registered;
        if ((this.pt >= FREEZE_MIN && reg) || this.pt >= FREEZE_MAX) this.go('glitch');
        break;
      }
      case 'glitch':
        this.corrupt();
        if (this.pt >= this.nextGlitchSfx && this.pt < GLITCH_TICKS - GLITCH_BLACK) {
          this.sfx('fps/glitch');
          this.nextGlitchSfx = this.pt + this.fxRng.int(6, 24);
        }
        if (this.pt >= GLITCH_TICKS) this.go('card');
        break;
      case 'card':
        this.typeSounds();
        if (press && this.pt >= CARD_PRESS_FROM) {
          if (this.pt < this.typedAt) {
            this.typedAt = this.pt;
            this.skipped = true;
          } else this.go('fold');
          break;
        }
        if (this.pt >= this.typedAt + CARD_HOLD) this.go('fold');
        break;
      case 'fold':
        if (this.pt >= FOLD_TICKS && !this.started) {
          this.started = true;
          startFpsRun(app, { floor: 1, fromBridge: true });
        }
        break;
    }
  }

  private go(p: BridgePhase): void {
    this._phase = p;
    this.pt = 0;
    if (p === 'glitch') {
      this.startMusic();
      this.nextGlitchSfx = 0;
    }
    if (p === 'fold') {
      this.card = this.renderCard();
      this.sfx('fps/fold');
    }
  }

  /** `fps-bridge` once the lazy content defined it (an unknown song warns once and is not retried). */
  private startMusic(): void {
    if (this.musicOn || !hasSong('fps-bridge')) return;
    this.musicOn = true;
    this.app.audio.music('fps-bridge', { fadeTicks: 0 });
  }

  private sfx(id: string): void {
    if (hasSfx(id)) this.app.audio.sfx(id);
  }

  /** start / fire / Enter / a click (any pad). */
  private pressed(): boolean {
    const app = this.app;
    const k = app.input;
    const p = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.pad(1).pressed('fire') || k.keyPressed('Enter') || app.pointerPressed;
    app.pointerPressed = false;
    return p;
  }

  /** Characters of line `i` shown at card tick `t`. */
  private shownChars(i: number, t: number): number {
    const line = this.lines[i];
    if (t >= this.typedAt) return line.length;
    return Math.max(0, Math.min(line.length, Math.floor((t - this.lineStart[i]) / TYPE_TICKS)));
  }

  /** The `fps/type` click on every second non-space character as it appears. */
  private typeSounds(): void {
    if (this.skipped || this.pt > this.typedAt) return;
    const t = this.pt;
    for (let i = 0; i < this.lines.length; i++) {
      const rel = t - this.lineStart[i];
      if (rel <= 0 || rel % TYPE_TICKS !== 0) continue;
      const n = rel / TYPE_TICKS;
      const line = this.lines[i];
      if (n > line.length) continue;
      if (line.charCodeAt(n - 1) === 32) continue;
      this.typedCount++;
      if (this.typedCount % 2 === 0) this.sfx('fps/type');
    }
  }

  /** One glitch tick (spec §1.3): blocks into the base, then shifted bands and a shade band on the frame. */
  private corrupt(): void {
    const rng = this.fxRng;
    const k = Math.min(1, Math.max(0, (this.pt - 1) / GLITCH_TICKS));
    const base = this.base;
    const work = this.work;
    const g = this.g;
    const GW = W * g;
    // 8×8 blocks copied from random places: lasting damage.
    const blocks = 2 + Math.round(10 * k);
    for (let b = 0; b < blocks; b++) {
      const sx = rng.int(0, W - 8) * g;
      const sy = rng.int(0, H - 8) * g;
      const dx = rng.int(0, W - 8) * g;
      const dy = rng.int(0, H - 8) * g;
      for (let y = 0; y < 8 * g; y++) base.data.copyWithin((dy + y) * GW + dx, (sy + y) * GW + sx, (sy + y) * GW + sx + 8 * g);
    }
    work.data.set(base.data);
    // Row bands shift sideways (wrapping).
    const bands = 1 + Math.round(6 * k);
    const maxShift = 1 + Math.round(23 * k);
    for (let b = 0; b < bands; b++) {
      const y0 = rng.int(0, H - 2);
      const n = rng.int(2, 8);
      const s = rng.int(1, maxShift) * rng.sign();
      this.shiftRows(y0, n, s);
    }
    // The MISSION COMPLETE! banner jitters (its rows, ±(1 + 3k) px).
    const bs = rng.int(-1 - Math.round(3 * k), 1 + Math.round(3 * k));
    if (bs !== 0) this.shiftRows(this.bannerY - 2, 13, bs);
    // A band of rows one shade lighter or darker.
    const sy = rng.int(0, H - 2);
    const sn = rng.int(2, 6 + Math.round(10 * k));
    const delta = rng.sign();
    if (g === 1) {
      for (let y = sy; y < Math.min(H, sy + sn); y++) {
        const o = y * W;
        for (let x = 0; x < W; x++) work.data[o + x] = stepShade(work.data[o + x] as Color, delta);
      }
    } else {
      const data = work.data;
      for (let i = sy * g * GW, end = Math.min(H, sy + sn) * g * GW; i < end; i++) data[i] = this.shadeHd(data[i], delta);
    }
    work.touch();
  }

  /** A colour two tones lighter (+1) or darker (−1) in its HD ramp; other colours stay. */
  private shadeHd(c: number, delta: number): number {
    if (c === this.shadeFrom && delta === this.shadeDelta) return this.shadeTo;
    const h = hdHome(c as Color);
    let out = c;
    if (h) out = h.ramp[Math.max(0, Math.min(h.ramp.length - 1, h.i + delta * 2))] >>> 0;
    this.shadeFrom = c;
    this.shadeDelta = delta;
    this.shadeTo = out;
    return out;
  }

  /** Shift `n` rows of the work frame from `y0` sideways by `s` px (wrapping); logical px. */
  private shiftRows(y0: number, n: number, s: number): void {
    const data = this.work.data;
    const row = this.row;
    const g = this.g;
    const GW = W * g;
    const sg = s * g;
    for (let y = Math.max(0, y0) * g; y < Math.min(H, y0 + n) * g; y++) {
      const o = y * GW;
      row.set(data.subarray(o, o + GW));
      for (let x = 0; x < GW; x++) data[o + ((x + sg + GW * 4) % GW)] = row[x];
    }
  }

  /** The card at its final state, as an image at the glitch density (the fold squeezes it). */
  private renderCard(): PixelBuffer {
    const r = new SoftRenderer(W, H, undefined, { res: this.g });
    this.drawCard(r, Math.max(this.pt, this.typedAt), false);
    r.end();
    return r.target;
  }

  draw(r: Renderer): void {
    switch (this._phase) {
      case 'freeze':
        r.begin(0x000000ff);
        r.frame(this.snap, 0, 0, plain);
        return;
      case 'glitch':
        r.begin(0x000000ff);
        if (this.pt < GLITCH_TICKS - GLITCH_BLACK) this.drawWork(r);
        return;
      case 'card':
        this.drawCard(r, this.pt, true);
        return;
      case 'fold':
        this.drawFold(r);
        return;
    }
  }

  private drawCard(r: Renderer, t: number, prompt: boolean): void {
    r.begin(0x000000ff);
    for (let i = 0; i < this.lines.length; i++) {
      const n = this.shownChars(i, t);
      if (n <= 0) continue;
      // Placed where the whole line is centred, so the text types in place.
      const line = this.lines[i];
      uiText(r, n >= line.length ? line : line.slice(0, n), this.lineX[i], CARD_Y + i * CARD_STEP, UI_WHITE);
    }
    if (prompt && t >= this.typedAt && blinkOn(t - this.typedAt)) centerText(r, 'PRESS START', 196, UI_WHITE);
  }

  /** The card squeezes to a 1-px line at y 108 (0–29), the line holds (30–39), then black. */
  private drawFold(r: Renderer): void {
    r.begin(0x000000ff);
    const t = this.pt;
    const card = this.card;
    if (!card || t >= 40) return;
    if (t >= 30) {
      r.rect(0, FOLD_Y, W, 1, PAL.snow[3], plain);
      return;
    }
    const g = this.g;
    const GW = W * g;
    const GH = H * g;
    const s = 1 - t / 30;
    const h = Math.max(1, Math.round(GH * s));
    const top = FOLD_Y * g - Math.floor(h / 2);
    const work = this.work;
    work.data.fill(0x000000ff);
    for (let y = 0; y < h; y++) {
      const dy = top + y;
      if (dy < 0 || dy >= GH) continue;
      const sy = Math.min(GH - 1, Math.floor((y / h) * GH));
      work.data.set(card.data.subarray(sy * GW, sy * GW + GW), dy * GW);
    }
    // The squeezed picture glows: the centre line (one logical px) brightens as it closes.
    if (t >= 20) for (let k = 0; k < g; k++) work.hline(0, GW - 1, FOLD_Y * g + k, PAL.snow[3]);
    work.touch();
    this.drawWork(r);
  }

  /** The work image, streamed (at the glitch density). */
  private drawWork(r: Renderer): void {
    if (this.g === 1) r.image(this.work, 0, 0, streamed);
    else r.frame(this.workFrame, 0, 0, streamed);
  }
}

/** Every `k`-th pixel of a buffer in both directions (a k× denser picture thinned; k ≥ 1). */
function thinned(src: PixelBuffer, k: number): PixelBuffer {
  if (k <= 1) return src.clone();
  const w = Math.floor(src.w / k);
  const h = Math.floor(src.h / k);
  const out = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    const o = y * k * src.w;
    for (let x = 0; x < w; x++) out.data[y * w + x] = src.data[o + x * k];
  }
  return out.touch();
}
