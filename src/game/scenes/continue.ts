/**
 * Continue screen (GDD §4.6, §13.9), an overlay on the frozen, dimmed world when every joined
 * player is out: `CONTINUE?` (big, C, y 60), the countdown 9 … 0 (big ×2, C, y 90; 60 ticks
 * each, every fire / jump press removes 15 ticks; `ui/countdown` per number), `PRESS START`
 * (C, y 130, blinking), `FREE PLAY` / `CREDITS 04` (y 140), the scores (y 152). Music `continue`.
 *
 * 1 player: a gag plays below — the character sits tied to a chair while two Legion privates
 * push a giant loudspeaker one step closer on every number. At 0 they switch it on, the
 * `game-over` jingle plays and the character salutes against their will (then GAME OVER).
 * Continued in time: the ropes snap, the character punches the speaker over and drops back in.
 */
import type { InputManager } from '../../engine/input';
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { getFrame, hasSprite } from '../../engine/sprites';
import { blinkOn, centerText, PLAYER_COLORS, scoreText, UI_GOLD, UI_RED, UI_WHITE, type GameApp } from '../app';
import { getCharacter } from '../registry';
import type { SlotIndex } from '../session';
import { TUNING } from '../tuning';
import { VOICE } from './flow-data';
import { GameOverScene } from './game-over';

/**
 * The scene under the continue overlay (docs/design/fps.md §1.10): GameplayScene passes an
 * adapter over its MissionRunner; FpsScene implements it itself.
 */
export interface Continuable {
  /** Use a continue for a slot. False when it is not possible (not out, no credits, not in this mode). */
  continuePlayer(slot: SlotIndex): boolean;
  /** Back to the scene's own music after a continue. */
  resumeMusic(): void;
  /** Hide stale banners and prompts under the overlay (optional). */
  clearOverlays?(): void;
  /**
   * Did this slot's player press start this tick? (optional; default
   * `input.pad(slot).pressed('start')`). The fps mode overrides it: its one player may use any
   * device.
   */
  startPressed?(slot: SlotIndex, input: InputManager): boolean;
  /**
   * The 1-player chair-and-loudspeaker gag (default true). The fps mode turns it off: its stage
   * would stand on the first-person status bar.
   */
  readonly continueGag?: boolean;
}

/** Ticks the switched-on speaker plays before GAME OVER; ticks of the escape when continued. */
const SALUTE_TICKS = 100;
const ESCAPE_TICKS = 36;
/** The gag stage: floor line, chair x, the speaker's start x and its step per number. */
const FLOOR = 206;
const CHAIR_X = 118;
const SPEAKER_X0 = 344;
const SPEAKER_STEP = 15;

type Phase = 'count' | 'salute' | 'escape';

const sprite: DrawOpts = { screen: true };
const flip: DrawOpts = { screen: true, flipX: true };
const dim: DrawOpts = { screen: true, alpha: 0.35 };

export class ContinueScene implements Scene {
  readonly transparent = true;
  private readonly app: GameApp;
  private readonly host: Continuable;
  private ticks: number;
  private phase: Phase = 'count';
  private phaseT = 0;
  private t = 0;
  /** The number on screen (9 … 0) and the speaker's position (it eases one step per number). */
  private shown = 9;
  private speakerX = SPEAKER_X0;

  constructor(app: GameApp, host: Continuable) {
    this.app = app;
    this.host = host;
    this.ticks = TUNING.continues.seconds * TUNING.continues.ticksPerCount;
  }

  /** The countdown number now showing (9 … 0). */
  get number(): number {
    return Math.max(0, Math.ceil(this.ticks / TUNING.continues.ticksPerCount) - 1);
  }

  private get solo(): boolean {
    return (this.app.session?.slots.filter((s) => s.joined).length ?? 1) <= 1;
  }

  enter(): void {
    this.app.input.suppress();
    this.app.audio.duckMusic?.(1);
    this.app.audio.music('continue', { fadeTicks: 20 });
    this.app.audio.voice(VOICE.continue);
    // The world is frozen under this overlay: no stale banner or prompt behind the text.
    this.host.clearOverlays?.();
    this.shown = this.number;
  }

  update(): void {
    this.t++;
    this.phaseT++;
    const input = this.app.input;
    if (this.phase === 'salute') {
      if (this.phaseT >= SALUTE_TICKS || (this.phaseT > 40 && input.anyPressed())) this.gameOver();
      return;
    }
    if (this.phase === 'escape') {
      if (this.phaseT >= ESCAPE_TICKS) this.app.scenes.pop();
      return;
    }
    const credits = this.app.session?.credits ?? Infinity;
    for (let i = 0; i < 2; i++) {
      const slot = this.app.session?.slots[i];
      if (!slot?.joined) continue;
      const pad = input.pad(i as 0 | 1);
      const start = this.host.startPressed?.(i as SlotIndex, input) ?? pad.pressed('start');
      if (start && credits > 0 && this.host.continuePlayer(i as SlotIndex)) {
        this.app.audio.sfx('ui/confirm');
        // Back to whatever the host plays now (the boss song in a boss fight).
        this.host.resumeMusic();
        this.phase = 'escape';
        this.phaseT = 0;
        if (!this.solo) this.app.scenes.pop();
        return;
      }
      if (pad.pressed('fire') || pad.pressed('jump')) this.ticks -= TUNING.continues.skipTicks;
    }
    // No credits left: nothing to wait for.
    if (credits <= 0 && this.t > 60) this.ticks = 0;
    if (--this.ticks <= 0) {
      this.ticks = 0;
      this.phase = 'salute';
      this.phaseT = 0;
      this.app.audio.music('game-over', { fadeTicks: 10 });
      return;
    }
    const n = this.number;
    if (n !== this.shown) {
      this.shown = n;
      this.app.audio.sfx('ui/countdown');
    }
    // The privates push the speaker one step closer per number (eased over 20 ticks).
    const target = SPEAKER_X0 - (9 - this.shown) * SPEAKER_STEP;
    if (this.speakerX > target) this.speakerX = Math.max(target, this.speakerX - 0.8);
  }

  private gameOver(): void {
    this.phase = 'count';
    this.app.scenes.replace(new GameOverScene(this.app), { fade: 30 });
  }

  draw(r: Renderer): void {
    r.fade(0x05060aff, 0.5);
    const session = this.app.session;
    const slots = session?.slots.filter((s) => s.joined) ?? [];
    if (this.solo && this.host.continueGag !== false) this.drawGag(r);
    if (this.phase === 'escape' && this.solo) return;
    centerText(r, 'CONTINUE?', 60, UI_GOLD, 'big');
    const n = this.number;
    centerText(r, String(n), 90, this.phase === 'salute' || n <= 3 ? UI_RED : UI_WHITE, 'big', 2);
    const credits = session?.credits ?? Infinity;
    if (credits > 0 && this.phase === 'count' && blinkOn(this.t)) centerText(r, 'PRESS START', 130, UI_WHITE);
    centerText(r, credits === Infinity ? 'FREE PLAY' : credits <= 0 ? 'NO CREDITS' : `CREDITS ${String(credits).padStart(2, '0')}`, 140, PAL.stone[3]);
    slots.forEach((s, i) => {
      const label = slots.length > 1 ? `${s.index === 0 ? '1P' : '2P'} SCORE ${scoreText(s.score)}` : `SCORE ${scoreText(s.score)}`;
      centerText(r, label, 152 + i * 10, slots.length > 1 ? PLAYER_COLORS[s.index] : UI_GOLD);
    });
  }

  /** The tied-to-a-chair gag (1 player). */
  private drawGag(r: Renderer): void {
    const slot = this.app.session?.slots.find((s) => s.joined);
    const art = getCharacter(slot?.character ?? 'recruit').art;
    const t = this.t;
    // A spotlight on the floor.
    r.rect(CHAIR_X - 60, FLOOR - 1, 300, 1, PAL.stone[1], dim);
    r.rect(CHAIR_X - 30, FLOOR, 240, 2, PAL.stone[0], dim);
    const escaping = this.phase === 'escape';
    const saluting = this.phase === 'salute';
    // The loudspeaker and the two privates pushing it from the right.
    const sx = Math.round(this.speakerX);
    const moving = !saluting && !escaping && this.speakerX > SPEAKER_X0 - (9 - this.shown) * SPEAKER_STEP;
    if (hasSprite('ui/loudspeaker')) {
      const frame = escaping ? 3 : saluting ? 1 + (Math.floor(t / 4) % 2) : 0;
      r.sprite('ui/loudspeaker', frame, sx, FLOOR, sprite);
    }
    for (let k = 0; k < 2; k++) {
      const px = sx + 34 + k * 16;
      const id = escaping ? 'enemy/rifleman/panic' : moving ? 'enemy/rifleman/walk' : 'enemy/rifleman/idle';
      if (hasSprite(id)) r.sprite(id, Math.floor(t / 6) + k * 3, px, FLOOR, flip);
    }
    // Sound rings from the switched-on speaker toward the chair.
    if (saluting) {
      for (let k = 0; k < 3; k++) {
        const rr = ((this.phaseT * 2 + k * 14) % 42) + 6;
        const cx = sx - 22 - rr;
        r.rect(cx, FLOOR - 30 - (rr >> 1), 2, rr, PAL.gold[2], dim);
      }
    }
    // The chair, the character (sitting: crouched legs + the rider's upper body), the ropes.
    if (hasSprite('ui/chair') && !escaping) r.sprite('ui/chair', 0, CHAIR_X - 2, FLOOR, flip);
    if (saluting) {
      const id = hasSprite(`${art}/salute`) ? `${art}/salute` : `${art}/victory`;
      if (hasSprite(id)) r.sprite(id, Math.min(1, Math.floor(this.phaseT / 8)), CHAIR_X, FLOOR, sprite);
    } else if (escaping) {
      // Ropes fly, the character jumps up punching.
      const up = Math.min(30, this.phaseT * 2);
      const id = hasSprite(`${art}/victory`) ? `${art}/victory` : `${art}/spawn`;
      if (hasSprite(id)) r.sprite(id, Math.floor(this.phaseT / 6), CHAIR_X + this.phaseT, FLOOR - up, sprite);
      if (hasSprite('ui/rope')) {
        r.sprite('ui/rope', 0, CHAIR_X - 10 - this.phaseT, FLOOR - 16 - this.phaseT * 2, sprite);
        r.sprite('ui/rope', 0, CHAIR_X + 12 + this.phaseT, FLOOR - 10 - this.phaseT, sprite);
      }
    } else {
      this.drawSitter(r, art, t);
    }
  }

  private drawSitter(r: Renderer, art: string, t: number): void {
    const legs = `${art}/legs-crouch`;
    const upper = `${art}/ride-sit`;
    let hipX = CHAIR_X;
    let hipY = FLOOR - 14;
    if (hasSprite(legs)) {
      const f = getFrame(legs, 0);
      r.sprite(legs, 0, CHAIR_X, FLOOR, sprite);
      const hip = f.pts?.hip;
      if (hip) {
        hipX = CHAIR_X + hip[0];
        hipY = FLOOR + hip[1];
      }
    }
    // A worried wriggle every 40 ticks.
    const wriggle = t % 40 < 4 ? ((t >> 1) % 2) * 2 - 1 : 0;
    if (hasSprite(upper)) r.sprite(upper, Math.floor(t / 20), hipX + wriggle, hipY, sprite);
    if (hasSprite('ui/rope')) r.sprite('ui/rope', 0, hipX + wriggle, hipY - 2, sprite);
    else r.rect(hipX - 8, hipY - 10, 16, 3, PAL.sand[2], sprite);
    // A nervous sweat drop.
    if (this.shown <= 3 && t % 30 < 20) r.rect(hipX + 7, hipY - 26 + ((t % 30) >> 2), 1, 2, PAL.sky[3], sprite);
  }
}
