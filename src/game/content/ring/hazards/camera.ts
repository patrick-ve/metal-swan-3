/**
 * Speed enforcement on the ring (docs/design/ring.md §7.4).
 *
 * - `ring-speedcam`: a camera on a post (the near shoulder, or `side: 'far'` on the median). When
 *   it passes a wagon (its x crosses the wagon's centre) and that wagon is in the FRONT THIRD of the
 *   screen (screen x ≥ `FRONT_X`), it flashes: the runner's `fine(slot)` (`BOETE!`, −500, never
 *   below 0, the 'fine' event) and the world event `ringFlash` (the driver's line). Its red LED
 *   lights while it is on screen and a wagon it has not passed is in the front third: the warning.
 * - `ring-avgzone`: the average-speed zone (trajectcontrole) — a start sign, an end sign `length` px
 *   later (params `length`; `part: 'end'` entries of a plan that also places the end are empty: the
 *   start entry draws and judges the whole zone). While a wagon is between them its screen x is averaged; when the end sign passes it, an
 *   average in the front third costs one fine. A small gauge under the HUD shows each player's
 *   running average against the line while the zone runs.
 * Fines only happen inside the ring (`ringOf(world)`): in a plain world they do nothing.
 */
import { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { MEDIAN_BOTTOM, SHOULDER_BOTTOM } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';
import { drivenWagons } from '../traffic/road-kit';

/** The front third of the screen (spec §7.4): screen x at or beyond this is speeding. */
export const FRONT_X = 256;
/** Ticks the flash window stays lit and the flash burst lasts. */
export const FLASH_TICKS = 9;
/** Default length of an average-speed zone (px). */
export const AVG_LENGTH = 1536;

declare module '../../../../engine/world' {
  interface WorldEvents {
    /** A ring speed camera (or the average-speed zone's end) fined player `slot`. */
    ringFlash: { slot: number; kind: 'speedcam' | 'avgzone'; wagon: Wagon | null; x: number; y: number };
  }
}

const drawOpts: DrawOpts = {};
const screenOpts: DrawOpts = { screen: true };

/** Fine a wagon's player (inside the ring), with the flash event. Returns true when fined. */
export function fineWagon(world: World, w: Wagon, kind: 'speedcam' | 'avgzone', x: number, y: number): boolean {
  const ring = ringOf(world);
  const p = w.driver;
  if (!ring || !p) return false;
  ring.fine(p.index, 'BOETE!');
  world.events.emit('ringFlash', { slot: p.index, kind, wagon: w, x, y });
  return true;
}

export class RingSpeedcam extends Entity {
  /** Slots this camera has passed (each wagon is judged once). */
  private readonly passed = [false, false];
  private flashT = 0;
  private warn = false;
  private t = 0;
  readonly far: boolean;
  fines = 0;

  constructor(world: World, x: number, _y: number, p: SpawnParams = NO_PARAMS) {
    // `kind: 'gantry'` (the plan's overhead camera) stands on the median in wave A.
    const far = p.side === 'far' || p.kind === 'gantry';
    super(world, x, far ? MEDIAN_BOTTOM - 1 : SHOULDER_BOTTOM + 3);
    this.far = far;
    this.team = 'neutral';
    this.z = 14;
    this.hitbox = { x: -8, y: -48, w: 16, h: 48 };
    this.despawnMargin = 48;
    this.addTag(RING_ENTITY.speedcam);
  }

  override update(): void {
    this.t++;
    if (this.flashT > 0) this.flashT--;
    const cam = this.world.camera;
    const list = drivenWagons(this.world);
    let warn = false;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      const slot = w.driver?.index ?? -1;
      if (slot < 0 || slot > 1 || this.passed[slot]) continue;
      const sx = w.x - cam.x;
      if (this.x <= w.x) {
        this.passed[slot] = true;
        if (sx >= FRONT_X && !w.scripted) this.flash(w);
      } else if (sx >= FRONT_X && this.onScreen(0)) warn = true;
    }
    if (warn && !this.warn) this.world.audio.sfx('ring/cam-beep');
    this.warn = warn;
  }

  private flash(w: Wagon): void {
    this.flashT = FLASH_TICKS;
    this.world.audio.sfx('ring/flash');
    if (fineWagon(this.world, w, 'speedcam', this.x, this.y - 40)) this.fines++;
  }

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = false;
    const f = this.flashT > 0 ? 2 : this.warn && Math.floor(this.t / 6) % 2 === 0 ? 1 : 0;
    r.sprite('ring/hazard/speedcam', f, x, y, drawOpts);
    if (this.flashT > 0) {
      drawOpts.blend = 'add';
      r.sprite('ring/hazard/flash', Math.min(2, Math.floor((FLASH_TICKS - this.flashT) / 3)), x - 1, y - 39, drawOpts);
      drawOpts.blend = 'normal';
    }
  }
}

interface ZoneRun {
  state: 'before' | 'in' | 'done';
  sum: number;
  n: number;
}

export class RingAvgZone extends Entity {
  readonly length: number;
  /** A plan's separate end entry: it does nothing (the start entry owns the zone). */
  readonly endOnly: boolean;
  readonly runs: ZoneRun[] = [
    { state: 'before', sum: 0, n: 0 },
    { state: 'before', sum: 0, n: 0 },
  ];
  fines = 0;

  constructor(world: World, x: number, _y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, SHOULDER_BOTTOM + 3);
    this.length = Math.max(256, paramNum(p, 'length', AVG_LENGTH));
    this.endOnly = p.part === 'end';
    this.team = 'neutral';
    this.z = 13;
    this.hitbox = { x: -16, y: -44, w: this.length + 32, h: 44 };
    this.despawnMargin = 48;
    this.addTag(RING_ENTITY.avgzone);
  }

  /** A slot's running average (screen x), NaN before it has one. */
  average(slot: number): number {
    const r = this.runs[slot];
    return r && r.n > 0 ? r.sum / r.n : NaN;
  }

  override update(): void {
    if (this.endOnly) {
      this.remove();
      return;
    }
    const cam = this.world.camera;
    const list = drivenWagons(this.world);
    const end = this.x + this.length;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      const slot = w.driver?.index ?? -1;
      const run = this.runs[slot];
      if (!run || run.state === 'done') continue;
      if (run.state === 'before' && this.x <= w.x) {
        run.state = 'in';
        this.world.audio.sfx('ring/cam-beep');
        hudOf(this.world).message(slot, 'TRAJECTCONTROLE', 90, PAL.sky[3]);
      }
      if (run.state !== 'in') continue;
      run.sum += w.x - cam.x;
      run.n++;
      if (end <= w.x) {
        run.state = 'done';
        if (run.sum / run.n >= FRONT_X && !w.scripted) {
          this.world.audio.sfx('ring/flash');
          if (fineWagon(this.world, w, 'avgzone', end, this.y - 30)) this.fines++;
        }
      }
    }
  }

  override draw(r: Renderer): void {
    if (this.endOnly) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = false;
    r.sprite('ring/hazard/avg-sign', 0, x, y, drawOpts);
    r.sprite('ring/hazard/avg-sign', 1, x + this.length, y, drawOpts);
    this.drawGauge(r);
  }

  /** While a zone runs: the icon and a bar (the screen's width) with each player's average. */
  private drawGauge(r: Renderer): void {
    let live = false;
    for (let i = 0; i < this.runs.length; i++) if (this.runs[i].state === 'in') live = true;
    if (!live) return;
    const cam = this.world.camera;
    const bx = Math.round(cam.w / 2 - 32);
    const by = 58;
    r.sprite('ring/hazard/avg-icon', 0, bx - 9, by + 1, screenOpts);
    r.rect(bx - 1, by - 2, 66, 6, 0x100b14ff, screenOpts);
    r.rect(bx, by - 1, 64, 4, 0x3b4457ff, screenOpts);
    const fx = bx + Math.round((FRONT_X / cam.w) * 64);
    r.rect(fx, by - 1, bx + 64 - fx, 4, 0x861a2eff, screenOpts);
    for (let s = 0; s < this.runs.length; s++) {
      if (this.runs[s].state !== 'in') continue;
      const avg = this.average(s);
      if (!Number.isFinite(avg)) continue;
      const mx = bx + Math.max(0, Math.min(63, Math.round((avg / cam.w) * 64)));
      r.rect(mx - 1, by - 3, 3, 8, s === 0 ? PAL.green[3] : PAL.snow[3], screenOpts);
    }
  }
}

defineEntity(RING_ENTITY.speedcam, (w, x, y, p) => new RingSpeedcam(w, x, y, p), {
  category: 'hazard',
  description: 'A speed camera on a post (param side near | far): a wagon in the front third when it passes is fined.',
});
defineEntity(RING_ENTITY.avgzone, (w, x, y, p) => new RingAvgZone(w, x, y, p), {
  category: 'hazard',
  description: 'An average-speed zone (param length): an average screen x in the front third costs one fine at its end.',
});
