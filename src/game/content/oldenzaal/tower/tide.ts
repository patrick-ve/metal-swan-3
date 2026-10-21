/**
 * `oz-tide` — the horde tide of the tower (oz-f, docs/design/oldenzaal.md §8): a mass of dead
 * soldiers that climbs up the tower behind the heroes at a steady rate, like m3-b2's meltwater
 * (`RisingWater`), and kills on contact (a terrain 'kill' hazard under its line: one hit, the genre
 * rule). Owner: TOWER.
 *
 * Fair by design (spec §8):
 * - a VISIBLE edge: a row of helmets and rotting heads with arms reaching up over it, a cold sickly
 *   glow above it (a light of the light pass), its roar (a loop); the deadly line is `TIDE.reach`
 *   px UNDER the reaching hands, at the heads;
 * - a STEADY rate (`speed` px / tick) that never lags more than `lag` px below the view's bottom;
 * - a short GRACE: `hold(ticks)` (the script calls it at a checkpoint); after a hero's death it sinks
 *   out of the view (`TIDE.sinkTo` under the bottom) and holds `TIDE.deathHold` ticks, so the
 *   drop-in never lands in it;
 * - it STOPS for good at `stopY` (one landing below the top landing: `lastToll()`, the bells'
 *   last toll, makes it recoil and stop).
 *
 * Params: `startY` (its line at the start; default the spawn y), `speed`, `lag`, `stopY`.
 * Cosmetic randomness (dust, arm phases) uses `world.fxRng` and tick hashes only.
 */
import type { Color } from '../../../../engine/color';
import { Entity } from '../../../../engine/entity';
import { PAL_HD_OZ_R2 } from '../../../../engine/palette-hd';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { HazardDef } from '../../../../engine/terrain';
import type { World } from '../../../../engine/world';
import { hash2 } from '../../../art/paint';
import { NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';
import { addHazard, removeHazard } from '../../props/common';
import { TIDE } from './layout';

/** Sprite ids (OZ_SPRITES.tower 'enemy/oz-tide/'). */
export const TIDE_ART = {
  /** The front row of heads and helmets (a 64 px tile; frames: the seething). */
  edge: 'enemy/oz-tide/edge',
  /** The back row (darker, behind the front row). */
  back: 'enemy/oz-tide/back',
  /** The packed bodies under the heads (a 64 × 48 tile). */
  mass: 'enemy/oz-tide/mass',
  /** One arm reaching up (anchor: the elbow's root, bottom centre). */
  arm: 'enemy/oz-tide/arm',
} as const;

/** Tile width and the drawn rows (logical px; the art has these sizes). */
export const TIDE_TILE = { w: 64, edgeH: 30, backH: 26, massH: 48, armW: 14, armH: 30 } as const;

/** The dark below the mass (a deep olive-black of the rot ramp). */
const DEEP: Color = PAL_HD_OZ_R2.rot[0];
const opts: DrawOpts = {};
const fillOpts: DrawOpts = { alpha: 1 };
/** Arms over the edge at a time (cosmetic). */
const ARMS = 6;

export class Tide extends Entity implements LightSource {
  /** The deadly line (world y): everything below it kills. */
  top: number;
  speed: number;
  lag: number;
  stopY: number;
  readonly hazard: HazardDef;
  /** Ticks left of a hold (checkpoint grace, death grace). */
  private holdT = 0;
  /** Sinking out of the view after a death. */
  private sinking = false;
  /** The last toll came: it recoils and stays. */
  private tolled = false;
  private recoilT = 0;
  private looping = false;
  private readonly loopKey: string;
  private readonly offDied: () => void;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.top = paramNum(params, 'startY', y);
    this.speed = paramNum(params, 'speed', TIDE.speed);
    this.lag = paramNum(params, 'lag', TIDE.lag);
    this.stopY = paramNum(params, 'stopY', TIDE.stopY);
    const b = world.terrain.bounds;
    this.hazard = { kind: 'kill', x: b.x - 64, y: this.top, w: b.w + 128, h: Math.max(1, b.y + b.h + 64 - this.top) };
    this.y = this.top;
    this.hitbox = { x: -192, y: 0, w: 384, h: 16 };
    this.z = 72;
    this.despawnMargin = Infinity;
    this.loopKey = `oz-tide-${this.id}`;
    this.addTag('prop', 'hazard', 'oz-tide', LIGHT_TAG);
    addHazard(world, this.hazard);
    // A hero died: sink out of the view and wait, so the drop-in never lands in the dead.
    this.offDied = world.events.on('playerDied', () => {
      if (this.tolled) return;
      this.sinking = true;
      this.holdT = Math.max(this.holdT, TIDE.deathHold);
    });
  }

  /** Has it stopped for good (the last toll)? */
  get stopped(): boolean {
    return this.tolled;
  }

  /** Is it waiting (a checkpoint's or a death's grace)? */
  get holding(): boolean {
    return this.holdT > 0;
  }

  /** Wait `ticks` (a checkpoint's grace). */
  hold(ticks: number = TIDE.grace): void {
    this.holdT = Math.max(this.holdT, ticks);
  }

  /** The bells' last toll: it recoils a little and never rises again (stays at or under `stopY`). */
  lastToll(): void {
    if (this.tolled) return;
    this.tolled = true;
    this.recoilT = 24;
    this.world.audio.sfx('oz/tower/tide-recoil', { vol: 0.8 });
  }

  override update(): void {
    const cam = this.world.camera;
    if (this.recoilT > 0) {
      this.recoilT--;
      this.top += 0.5;
    } else if (this.sinking) {
      const floor = cam.bottom + TIDE.sinkTo;
      if (this.top < floor) this.top = Math.min(floor, this.top + TIDE.sinkSpeed);
      if (this.holdT > 0) this.holdT--;
      if (this.holdT <= 0) this.sinking = false;
    } else if (this.holdT > 0) this.holdT--;
    else if (!this.tolled) this.top -= this.speed;
    // Never far below the view (a steady threat), never past its stop line.
    if (!this.sinking && this.top > cam.bottom + this.lag) this.top = cam.bottom + this.lag;
    if (this.top < this.stopY) this.top = this.stopY;
    this.x = cam.centerX;
    this.y = this.top;
    const h = this.hazard;
    const b = this.world.terrain.bounds;
    h.y = this.top;
    h.h = Math.max(1, b.y + b.h + 64 - this.top);
    if (!this.looping) {
      this.looping = true;
      this.world.audio.sfxLoop?.(this.loopKey, 'oz/tower/tide', { vol: 0.55 });
    }
    // Dust and grit thrown up by the climbing mass (cosmetic).
    if (this.top < cam.bottom + 8 && this.world.tick % 9 === 0) {
      const rng = this.world.fxRng;
      this.world.particles.dust(cam.left + rng.range(16, cam.w - 16), this.top - TIDE.reach + rng.range(0, 8));
    }
  }

  /** Its line may sit below the kill line while it waits; it lives as long as its section. */
  override onOutOfWorld(): void {}

  override onRemove(): void {
    removeHazard(this.world, this.hazard);
    this.offDied();
    if (this.looping) this.world.audio.stopSfx?.(this.loopKey);
    this.looping = false;
  }

  /** A sickly cold glow over the mass (the light pass): its edge reads in the dark. */
  lightOf(out: LightSpot, _tick: number): boolean {
    const cam = this.world.camera;
    if (this.top > cam.bottom + 24) return false;
    out.x = cam.centerX;
    out.y = this.top - 6;
    out.r = 150;
    out.color = PAL_HD_OZ_R2.rot[5];
    out.intensity = 0.42;
    out.flicker = 0.08;
    return true;
  }

  override draw(r: Renderer): void {
    const cam = this.world.camera;
    const line = Math.round(this.top);
    // The edge tile's top: the helmets' crowns sit just over the deadly line; the reaching hands
    // rise up to `reach` px above it (cosmetic).
    const heads = line - 8;
    if (heads - TIDE.reach > cam.bottom + 2) return;
    const t = this.world.tick;
    const left = Math.floor(cam.left / TIDE_TILE.w) * TIDE_TILE.w - TIDE_TILE.w;
    const right = cam.right + TIDE_TILE.w;
    opts.flipX = false;
    opts.alpha = 1;
    // Below the mass: the dark of the packed dead.
    const massTop = heads + TIDE_TILE.edgeH - 8;
    const bottom = Math.ceil(cam.bottom) + 1;
    if (bottom > massTop + TIDE_TILE.massH) r.rect(Math.floor(cam.left) - 1, massTop + TIDE_TILE.massH, cam.w + 2, bottom - massTop - TIDE_TILE.massH, DEEP, fillOpts);
    // The packed bodies: two tiles a row, shifting slowly (the mass seethes sideways).
    if (massTop < bottom) {
      const sh = (t >> 3) % TIDE_TILE.w;
      const mf = (t >> 4) & 1;
      for (let x = left + sh; x < right; x += TIDE_TILE.w) r.sprite(TIDE_ART.mass, mf, x, massTop, opts);
    }
    // The back row: darker heads, out of step with the front row.
    const bs = TIDE_TILE.w - ((t >> 2) % TIDE_TILE.w);
    for (let x = left + bs, i = 0; x < right; x += TIDE_TILE.w, i++) {
      const bob = Math.round(Math.sin(t / 11 + i * 1.7) * 1.5);
      r.sprite(TIDE_ART.back, ((t >> 3) + i) & 3, x, heads - 5 + bob, opts);
    }
    // Arms reaching up between the heads (each rises, grabs, sinks; places by a hash of its cycle).
    for (let k = 0; k < ARMS; k++) {
      const period = 70 + k * 9;
      const cyc = Math.floor((t + k * 23) / period);
      const ph = ((t + k * 23) % period) / period;
      const ax = Math.round(cam.left + 12 + hash2(cyc, k, 71) * (cam.w - 24));
      const up = Math.sin(ph * Math.PI);
      const ay = heads + 10 - Math.round(up * 12);
      opts.flipX = hash2(cyc, k, 72) > 0.5;
      r.sprite(TIDE_ART.arm, Math.min(3, Math.floor(up * 4)), ax, ay, opts);
    }
    opts.flipX = false;
    // The front row of heads and helmets.
    const fs = (t >> 3) % TIDE_TILE.w;
    for (let x = left + fs, i = 0; x < right; x += TIDE_TILE.w, i++) {
      const bob = Math.round(Math.sin(t / 9 + i * 2.3));
      r.sprite(TIDE_ART.edge, ((t >> 3) + i * 2) & 3, x, heads + bob, opts);
    }
  }
}
