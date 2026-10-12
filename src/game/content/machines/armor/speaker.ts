/**
 * `anthem-speaker` — the Anthem Speaker (GDD §9.2, §4.11 rule 7). A support machine: it never
 * attacks and does not hold `ctx.waitClear()` (it has no 'enemy' tag; players often leave it
 * standing — that is the joke). 100 HP (×difficulty), 500 points.
 *
 * Every `params.interval` ticks (default 900, start to start; m5-b uses 600) while it is on
 * screen — or at once on `trigger()` / when a player passes `params.triggerX` — it crackles for 30
 * ticks (a ♪ bubble, `machine/anthem-crackle`), then plays the anthem for 180 ticks
 * (`env/anthem-sting`). While it plays, Legion infantry (tag 'legion') within 240 px salute
 * (`reactInArea(…, 'salute', …)`: they freeze, drop any telegraph, do not attack and still take
 * damage; soldiers who walk into range later join in) and `windup-bot`s dance ('dance'). If it is
 * destroyed while playing, the saluting soldiers stay frozen 60 more ticks, looking at each other.
 *
 * Params: `interval` (ticks, default 900), `first` (ticks before the first anthem, default
 * `interval`), `auto` (false: only `trigger()` / `triggerX` start it), `triggerX` (x a player must
 * reach: it plays at once, then every `interval`).
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { Circle, World } from '../../../../engine/world';
import { Enemy, reactInArea } from '../../../enemy';
import { FxEntity, FX_SPARK } from '../../../fx';
import { hasSprite } from '../../../../engine/sprites';
import { defineEntity, paramBool, paramFacing, paramNum, type SpawnParams } from '../../../registry';
import { SPEAKER } from './geom';
import { Machine } from './machine';

/** Anthem Speaker numbers (GDD §9.2, §4.11 rule 7). */
export const ANTHEM = {
  hp: 100,
  interval: 900,
  crackle: 30,
  play: 180,
  radius: 240,
  /** Destroyed while playing: the salute lasts this much longer. */
  linger: 60,
  /** Soldiers who walk into range during the anthem are checked this often. */
  recheck: 10,
} as const;

type SpeakerMode = 'idle' | 'crackle' | 'play';

const ART = 'machine/anthem-speaker';
const drawOpts: DrawOpts = {};
const area: Circle = { x: 0, y: 0, r: ANTHEM.radius };
const SALUTE_TAGS: readonly string[] = ['legion'];

export class AnthemSpeaker extends Machine {
  mode: SpeakerMode = 'idle';
  modeT = 0;
  /** Ticks until the next anthem (counts down while on screen). */
  timer: number;
  readonly interval: number;
  readonly auto: boolean;
  private readonly triggerX: number;
  private triggered = false;
  private readonly boxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, hp: ANTHEM.hp, w: 20, h: 40, body: false });
    this.hitbox = { ...SPEAKER.bounds };
    // A support machine: it never holds a wave (ctx.waitClear) and never counts as a foe.
    this.removeTag('enemy');
    const floor = world.terrain.surfaceY(x, y - 4, y + 40);
    if (Number.isFinite(floor)) this.y = this.prevY = floor;
    this.facing = paramFacing(p, -1);
    this.interval = Math.max(ANTHEM.crackle + ANTHEM.play + 30, paramNum(p, 'interval', ANTHEM.interval));
    this.timer = Math.max(1, paramNum(p, 'first', this.interval));
    this.auto = paramBool(p, 'auto', true);
    this.triggerX = paramNum(p, 'triggerX', NaN);
  }

  /** Is the anthem playing right now? */
  get anthemPlaying(): boolean {
    return this.mode === 'play' && this.alive;
  }

  /** Script command: crackle and play the anthem now (ignored while it already does). */
  trigger(): void {
    if (!this.alive || this.mode !== 'idle') return;
    this.mode = 'crackle';
    this.modeT = 0;
    this.world.audio.sfx('machine/anthem-crackle');
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (!this.triggered && Number.isFinite(this.triggerX)) {
      const players = this.world.alivePlayers();
      for (let i = 0; i < players.length; i++) {
        if (players[i].x >= this.triggerX) {
          this.triggered = true;
          this.trigger();
          break;
        }
      }
    }
    switch (this.mode) {
      case 'idle':
        if (this.auto && this.onScreen(32) && --this.timer <= 0) this.trigger();
        return;
      case 'crackle':
        if (this.modeT % 6 === 0) {
          const h = this.hornPoint();
          this.world.particles.burst(FX_SPARK, h[0], h[1], 2, 0.6, 1.6);
        }
        if (this.modeT >= ANTHEM.crackle) this.beginAnthem();
        return;
      case 'play':
        if (this.modeT % ANTHEM.recheck === 0) this.saluteLatecomers(ANTHEM.play - this.modeT);
        if (this.modeT % 14 === 0) this.emitNote();
        if (this.modeT >= ANTHEM.play) {
          this.mode = 'idle';
          this.modeT = 0;
          // Start to start: the next anthem comes `interval` ticks after this one began.
          this.timer = Math.max(1, this.interval - ANTHEM.crackle - ANTHEM.play);
        }
        return;
    }
  }

  private beginAnthem(): void {
    this.mode = 'play';
    this.modeT = 0;
    this.world.audio.sfx('env/anthem-sting');
    const a = this.area();
    reactInArea(this.world, a, 'salute', ANTHEM.play, { tags: SALUTE_TAGS, source: this });
    reactInArea(this.world, a, 'dance', ANTHEM.play, { source: this });
  }

  /** Legion soldiers who walked into range after the first bar salute for the rest of it. */
  private saluteLatecomers(left: number): void {
    if (left <= 0) return;
    const a = this.area();
    const list = this.world.snapshotTag('legion');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!(e instanceof Enemy) || !e.alive || e.reaction === 'salute') continue;
        const b = e.hitRect();
        const cx = Math.max(b.x, Math.min(a.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(a.y, b.y + b.h));
        if (Math.hypot(a.x - cx, a.y - cy) <= a.r) e.react('salute', left, this);
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  private area(): Circle {
    area.x = this.x;
    area.y = this.y - 20;
    area.r = ANTHEM.radius;
    return area;
  }

  private hornPoint(): [number, number] {
    hornPt[0] = this.wx(SPEAKER.horn[0]);
    hornPt[1] = this.y + SPEAKER.horn[1];
    return hornPt;
  }

  /** A little music note floats out of the horn (cosmetic). */
  private emitNote(): void {
    if (!hasSprite('fx/music-note') || !this.onScreen(16)) return;
    const h = this.hornPoint();
    FxEntity.spawn(this.world, {
      sprite: 'fx/music-note',
      x: h[0] + this.facing * 4,
      y: h[1],
      vx: this.facing * this.world.fxRng.range(0.3, 0.7),
      vy: -0.5,
      drag: 0.98,
      life: 50,
      loop: true,
      z: 61,
    });
  }

  override hurtboxes(): readonly Rect[] {
    this.rel(SPEAKER.hurt, this.boxes[0]);
    return this.boxes;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(_d: Damage): void {
    if (this.mode === 'play') this.lingerSalute();
    this.mode = 'idle';
    this.boom(this.x, this.y - 30, 'm');
  }

  /**
   * Destroyed mid-anthem: everyone saluting it stays frozen 60 more ticks, looking at each other
   * (each turns toward the nearest other saluting soldier).
   */
  private lingerSalute(): void {
    const list = this.world.snapshotTag('enemy');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!(e instanceof Enemy) || !e.alive || e.reactionSource !== this) continue;
        if (e.reaction === 'salute' || e.reaction === 'dance') e.reactionTicks = ANTHEM.linger;
        if (e.reaction !== 'salute') continue;
        let best: Enemy | null = null;
        let bd = Infinity;
        for (let k = 0; k < list.length; k++) {
          const o = list[k];
          if (o === e || !(o instanceof Enemy) || !o.alive || o.reaction !== 'salute') continue;
          const d = Math.abs(o.x - e.x);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (best && Math.abs(best.x - e.x) > 1) e.facing = best.x < e.x ? -1 : 1;
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  protected override updateDeath(): void {
    this.deathTicks++;
  }

  override update(): void {
    super.update();
    if (this.alive) this.emitDamage(this.x, this.y - 30);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = this.facing < 0;
    drawOpts.flash = false;
    if (this.dead) {
      r.sprite(`${ART}/wreck`, 0, x, y, drawOpts);
      return;
    }
    drawOpts.flash = this.flashTicks > 0;
    if (this.mode === 'crackle') r.sprite(`${ART}/tell`, (this.modeT >> 2) % 2, x, y, drawOpts);
    else r.sprite(`${ART}/body`, this.mode === 'play' ? 1 + ((this.modeT >> 3) % 2) : 0, x, y, drawOpts);
    // GDD §9.2: a dented plate from 50 % HP.
    if (this.damageState > 0) r.sprite(`${ART}/dent`, 0, x, y, drawOpts);
    if (this.mode === 'crackle' || (this.mode === 'play' && this.modeT < 40)) {
      // The ♪ bubble over the horn (the font has no note glyph, so it is a sprite).
      const h = this.hornPoint();
      const bob = (this.modeT >> 3) % 2;
      drawOpts.flash = false;
      drawOpts.flipX = false;
      r.sprite(`${ART}/note-bubble`, 0, Math.round(h[0]), Math.round(h[1]) - 10 - bob, drawOpts);
    }
  }
}

const hornPt: [number, number] = [0, 0];

/** Start the anthem of a speaker now (mission scripts: m1-a's ANTHEM BREAK). */
export function playAnthem(speaker: unknown): boolean {
  if (!(speaker instanceof AnthemSpeaker)) return false;
  speaker.trigger();
  return true;
}

defineEntity('anthem-speaker', (w, x, y, p) => new AnthemSpeaker(w, x, y, p), {
  category: 'enemy',
  score: 500,
  description: 'Anthem Speaker: crackles, then plays the anthem; Legion soldiers within 240 px salute.',
});
