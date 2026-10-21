/**
 * `oz-bell` — a bell of the tower (oz-f, docs/design/oldenzaal.md §8). Owner: TOWER.
 *
 * - AT REST it hangs still from its oak headstock (a small bell's crown is a one-way step: a
 *   platform at rest). Touching a still bell does nothing.
 * - IT SWINGS (mode 'auto': on a schedule while it is near the view; mode 'script': when `toll(n)`
 *   is called): first the TELL (`BELL.tell` ≥ 18 ticks: the rope jerks, the bell wobbles and the
 *   headstock creaks), then it swings out wide. A swinging bell is a HAZARD only while it moves AT
 *   a hero (its body's velocity points toward that hero): one hit, the genre rule.
 * - At each end of a swing the clapper strikes: the TOLL (`oz/env/bell`, a ring of sound) stuns
 *   every dead soldier within `BELL.stunR` for `ZOMBIE_STAGGER` ticks (`staggerZombiesInArea`).
 *
 * Params: `size` ('small' | 'big'), `rest` (ticks between swings, 'auto'), `phase` (an offset of
 * the first swing), `mode` ('auto' | 'script'). Respect (docs/ORIGINALITY.md): the bells are whole,
 * plain church bells; nothing breaks them.
 */
import { Entity } from '../../../../engine/entity';
import { overlaps, type Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { NO_PARAMS, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { staggerZombiesInArea, ZOMBIE_STAGGER } from '../zombies/api';

/** The bells' numbers (ticks, px, radians). */
export const BELL = {
  /** The tell before a swing (≥ 18: GDD rule 2). */
  tell: 36,
  /** One full swing (there and back). */
  period: 76,
  /** Swings per ringing ('auto'). */
  swings: 3,
  /** The widest swing (rad, about 62°) and the ramp up / down. */
  amp: 1.08,
  ramp: 26,
  /** A swing hurts only while the amplitude is at least this (the start and the end are slow). */
  hurtAmp: 0.4,
  /** Toll stuns the dead within this radius (px). */
  stunR: 96,
  /** The geometry per size: pivot → the bell's centre, its half width and half height (hit circle-ish box). */
  small: { arm: 20, hw: 11, hh: 13, crownW: 18 },
  big: { arm: 22, hw: 14, hh: 15, crownW: 0 },
  /** Angle frames: one every `stepDeg`, ±`maxDeg` (the art draws these). */
  stepDeg: 10,
  maxDeg: 60,
} as const;

export type BellSize = 'small' | 'big';
export type BellState = 'rest' | 'tell' | 'swing';

/** Sprite ids: the bell at an angle (frame = (deg + maxDeg) / stepDeg), the toll ring. */
export const BELL_ART = {
  small: 'prop/oz-bell/small',
  big: 'prop/oz-bell/big',
  toll: 'fx/oz/tower/toll',
} as const;

/** Frames of a bell strip (−60° … +60° in 10° steps). */
export const BELL_FRAMES = (BELL.maxDeg * 2) / BELL.stepDeg + 1;

const BELL_TAGS: readonly string[] = ['heavy', 'hazard'];
const opts: DrawOpts = {};
const hitRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

export class Bell extends Entity {
  readonly size: BellSize;
  readonly mode: 'auto' | 'script';
  readonly rest: number;
  state: BellState = 'rest';
  /** The swing angle (rad, + = the bell's mouth swings right) and its rate. */
  angle = 0;
  omega = 0;
  /** Ticks in the current state. */
  private t = 0;
  /** Ticks until the next swing ('auto'). */
  private wait: number;
  /** Swings left in this ringing. */
  private swingsLeft = 0;
  /** The toll ring's age (−1: none). */
  private ringT = -1;
  private ringX = 0;
  private ringY = 0;
  /** Tolls struck in this ringing (a script waits on it). */
  tolls = 0;
  private readonly crown: SolidBox | null;
  private readonly hitList: Entity[] = [];

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.size = paramStr(p, 'size', 'small') === 'big' ? 'big' : 'small';
    this.mode = paramStr(p, 'mode', 'auto') === 'script' ? 'script' : 'auto';
    this.rest = Math.max(60, paramNum(p, 'rest', 160));
    this.wait = this.rest + Math.max(0, paramNum(p, 'phase', 0));
    this.z = 8;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -16, y: 0, w: 32, h: 40 };
    this.addTag('prop', 'oz-bell');
    const g = BELL[this.size];
    this.crown = g.crownW > 0 ? world.addSolid(new SolidBox(x - g.crownW / 2, y + 3, g.crownW, 4, true, this)) : null;
  }

  private get geom(): { arm: number; hw: number; hh: number } {
    return BELL[this.size];
  }

  /** The bell's centre now (world px). */
  centerX(): number {
    return this.x + Math.sin(this.angle) * this.geom.arm;
  }

  centerY(): number {
    return this.y + Math.cos(this.angle) * this.geom.arm;
  }

  /** Ring it now ('script' bells; an 'auto' bell rings early): a tell, then `swings` swings. */
  toll(swings = 2): void {
    if (this.state !== 'rest') {
      this.swingsLeft = Math.max(this.swingsLeft, swings);
      return;
    }
    this.swingsLeft = swings;
    this.enter('tell');
  }

  /** Is it moving at all (a script waits for the last toll to fade)? */
  get ringing(): boolean {
    return this.state !== 'rest';
  }

  private enter(s: BellState): void {
    this.state = s;
    this.t = 0;
    if (s === 'tell') this.world.audio.sfx('oz/env/bell-creak', { vol: 0.8, pitch: this.size === 'big' ? 0.8 : 1.1 });
    if (this.crown) this.crown.enabled = s === 'rest';
  }

  override update(): void {
    this.t++;
    if (this.ringT >= 0 && ++this.ringT > 24) this.ringT = -1;
    const prev = this.angle;
    if (this.state === 'rest') {
      this.angle = 0;
      if (this.mode === 'auto' && this.world.onScreen(this, 48) && --this.wait <= 0) {
        this.swingsLeft = BELL.swings;
        this.enter('tell');
      }
    } else if (this.state === 'tell') {
      // The rope jerks: a small wobble that grows (cosmetic; no hurt).
      this.angle = Math.sin(this.t * 0.55) * 0.05 * (this.t / BELL.tell);
      if (this.t >= BELL.tell) this.enter('swing');
    } else {
      const total = this.swingsLeft * BELL.period;
      const ramp = Math.min(1, this.t / BELL.ramp, Math.max(0, (total - this.t) / BELL.ramp));
      const amp = BELL.amp * ramp * (this.size === 'big' ? 0.72 : 1);
      const ph = (this.t / BELL.period) * Math.PI * 2;
      this.angle = amp * Math.sin(ph);
      // The clapper strikes at each end of the swing (the angle's rate changes sign).
      const quarter = (this.t * 4) % BELL.period;
      if (amp > 0.3 && this.t > 0 && quarter < 4 && Math.floor((this.t * 4) / BELL.period) % 2 === 1) this.strike();
      if (amp >= BELL.hurtAmp) this.hurtHeroes(amp);
      if (this.t >= total) {
        this.swingsLeft = 0;
        this.wait = this.rest;
        this.enter('rest');
      }
    }
    this.omega = this.angle - prev;
  }

  /** The clapper hits the rim: the toll (sound, the ring, the stun). */
  private strike(): void {
    this.tolls++;
    const cx = this.centerX();
    const cy = this.centerY();
    this.ringT = 0;
    this.ringX = cx;
    this.ringY = cy;
    const big = this.size === 'big';
    this.world.audio.sfx(big ? 'oz/tower/toll-last' : 'oz/env/bell', { vol: big ? 1 : 0.75, pitch: big ? 1 : 1.3 });
    staggerZombiesInArea(this.world, cx, cy, big ? BELL.stunR * 2.5 : BELL.stunR, ZOMBIE_STAGGER);
  }

  /** A swinging bell hits a hero it swings AT (its body moves toward the hero). */
  private hurtHeroes(_amp: number): void {
    const g = this.geom;
    const cx = this.centerX();
    const cy = this.centerY();
    // The body's sideways velocity (the angle's rate × the arm).
    const vx = Math.cos(this.angle) * this.omega * g.arm;
    if (Math.abs(vx) < 0.25) return;
    hitRect.x = cx - g.hw + 2;
    hitRect.y = cy - g.hh + 2;
    hitRect.w = (g.hw - 2) * 2;
    hitRect.h = (g.hh - 2) * 2;
    const list = this.world.snapshotTag('shootable');
    this.hitList.length = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.alive || t.team !== 'player') continue;
        if ((t.x - cx) * vx <= 0) continue; // it swings away from this hero
        const boxes = t.hurtboxes();
        for (let k = 0; k < boxes.length; k++) {
          if (!overlaps(boxes[k], hitRect)) continue;
          this.hitList.push(t);
          break;
        }
      }
    } finally {
      this.world.releaseSnapshot();
    }
    for (let i = 0; i < this.hitList.length; i++) {
      // A heavy blow, not a crush (god mode ignores it; a crush would kill through it).
      this.world.damage(this.hitList[i], { amount: 30, kind: 'impact', dirX: Math.sign(vx), source: this, tags: BELL_TAGS });
    }
  }

  /** The angle frame (−60° … +60° in 10° steps). */
  frameOf(): number {
    const deg = (this.angle * 180) / Math.PI;
    const k = Math.round(Math.max(-BELL.maxDeg, Math.min(BELL.maxDeg, deg)) / BELL.stepDeg);
    return k + BELL.maxDeg / BELL.stepDeg;
  }

  override draw(r: Renderer): void {
    opts.flipX = false;
    opts.alpha = 1;
    r.sprite(BELL_ART[this.size], this.frameOf(), Math.round(this.x), Math.round(this.y), opts);
    if (this.ringT >= 0) {
      opts.alpha = 1 - this.ringT / 26;
      r.sprite(BELL_ART.toll, Math.min(3, this.ringT >> 2), Math.round(this.ringX), Math.round(this.ringY), opts);
      opts.alpha = 1;
    }
  }
}
