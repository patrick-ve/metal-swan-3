/**
 * The set of DE RATTENJONG's hall (docs/design/sewers.md §2.5, §4.2):
 *
 * - `sewers-rattenjong-throne` — the trash mountain at the arena's back (decor in depth: never solid,
 *   never shot). It lowers in steps (`lower(level)`; the king's hitbox comes down with it), shakes
 *   (`shake(ticks)`) and, during the king's phase-2 squeak, lights up the eyes of every rat in the
 *   hall (`lightEyes(ticks)`). Gerrit's gold chain lies on it (the gag of sewers-a).
 * - `sewers-flood` — the canal's water coming down through the cracked vault at the end: falling
 *   water from the crack and the hall floor filling to y 190 in 120 ticks. COSMETIC: `rising-water`
 *   (content/props/set-pieces.ts) without its hazard: it never kills or slows anyone.
 */
import { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { splash } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { removeHazard } from '../../props/common';
import { RisingWater } from '../../props/set-pieces';
import { SEWERS_E_IDS } from '../../missions/sewers/ids';
import { KING, THRONE_ART } from './numbers';

const drawOpts: DrawOpts = {};
const eyeOpts: DrawOpts = { blend: 'normal' };
const fallOpts: DrawOpts = { alpha: 0.55 };

/** The rat eyes that light up in the hall on the squeak (world x, y; the back wall and the pile). */
const HALL_EYES: readonly (readonly [number, number])[] = [
  [878, 120], [902, 96], [934, 132], [962, 84], [996, 112], [1024, 70], [1046, 128], [1078, 92],
  [1120, 76], [1152, 104], [1176, 130], [1198, 82], [1222, 116], [1240, 94], [1012, 142], [1188, 146],
];
/** The eye strip of the runner rat (P1a RATS: frame 0 red, frame 1 the white flash). */
const EYES_SPRITE = 'enemy/sewers-rat-runner/eyes';

export class KingThrone extends Entity {
  /** The pile's level (0 … 3: KING.tops). */
  level = 0;
  /** Ticks left of a shake; of the lit eyes. */
  shakeT = 0;
  eyesT = 0;
  private eyesLen = 1;

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.team = 'neutral';
    this.z = 12;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -(KING.throne[1] - KING.throne[0]) / 2, y: -60, w: KING.throne[1] - KING.throne[0], h: 60 };
    this.addTag('prop');
  }

  /** The seat's y at the current level (the king's feet). */
  get top(): number {
    return KING.tops[this.level];
  }

  /** Lower the pile to `level` (it shakes for KING.shrinkTicks). */
  lower(level: number): void {
    const l = Math.max(0, Math.min(KING.tops.length - 1, level));
    if (l <= this.level) return;
    this.level = l;
    this.shake(KING.shrinkTicks);
  }

  shake(ticks: number): void {
    this.shakeT = Math.max(this.shakeT, ticks);
  }

  lightEyes(ticks: number): void {
    this.eyesT = ticks;
    this.eyesLen = Math.max(1, ticks);
  }

  override update(): void {
    if (this.shakeT > 0) this.shakeT--;
    if (this.eyesT > 0) this.eyesT--;
  }

  override onOutOfWorld(): void {}

  override draw(r: Renderer): void {
    const t = this.world.tick;
    const dx = this.shakeT > 0 ? (t % 4 < 2 ? 1 : -1) : 0;
    drawOpts.flipX = false;
    drawOpts.alpha = 1;
    r.sprite(`${THRONE_ART}/pile`, this.level, Math.round(this.x + dx), Math.round(this.y), drawOpts);
    // Gerrit's gold chain (sewers-a) on the slope of the pile.
    r.sprite(`${THRONE_ART}/chain`, 0, Math.round(this.x - 46 + dx), KING.tops[this.level] + 14 + Math.round((this.level * 3) / 2), drawOpts);
    if (this.eyesT > 0) {
      const flash = this.eyesLen - this.eyesT < 6 || (this.eyesT < 12 && t % 4 < 2);
      for (let i = 0; i < HALL_EYES.length; i++) {
        const [ex, ey] = HALL_EYES[i];
        // They open one after another over the tell's first ticks.
        if ((this.eyesLen - this.eyesT) * 2 < i) continue;
        eyeOpts.flipX = i % 2 === 1;
        r.sprite(EYES_SPRITE, flash ? 1 : 0, ex, ey, eyeOpts);
      }
    }
  }
}

defineEntity(SEWERS_E_IDS.throne, (w, x, y) => new KingThrone(w, x, y), {
  category: 'prop',
  description: "DE RATTENJONG's trash throne (decor in depth, never solid): it lowers in 3 steps in phase 2, shakes, lights the hall's rat eyes on the squeak; Gerrit's gold chain on it.",
});

// ---------------------------------------------------------------------------------------------
// The flood
// ---------------------------------------------------------------------------------------------

/**
 * The flood (cosmetic): the hall floor fills from below the view to `toY` (190) in `ticks` (120);
 * water falls from the crack between `crackX0` and `crackX1` (world x). No hazard, no kill.
 */
export class SewersFlood extends RisingWater {
  readonly toY: number;
  readonly crackX0: number;
  readonly crackX1: number;
  private ft = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    const cam = world.camera;
    const start = cam.bottom + 6;
    const toY = paramNum(p, 'toY', KING.end.floodY);
    const ticks = Math.max(1, paramNum(p, 'ticks', KING.end.flood));
    super(world, x, y, { startY: start, speed: (start - toY) / ticks, lag: 64 });
    // Cosmetic: the meltwater's kill hazard goes at once (spec §4.2: "no kill").
    removeHazard(world, this.hazard);
    this.toY = toY;
    this.crackX0 = paramNum(p, 'crackX0', KING.homeX - 90);
    this.crackX1 = paramNum(p, 'crackX1', KING.homeX + 30);
    this.z = 72;
  }

  override update(): void {
    const cam = this.world.camera;
    this.ft++;
    this.top = Math.max(this.toY, this.top - this.speed);
    this.x = cam.centerX;
    this.y = this.top;
    if (this.ft % 5 === 0) {
      const rng = this.world.fxRng;
      splash(this.world, this.crackX0 + rng.range(0, this.crackX1 - this.crackX0), Math.min(this.top, KING.end.floodY), 2);
    }
  }

  override draw(r: Renderer): void {
    // The water falling from the crack (columns that sway a little), then the rising floor.
    const t = this.ft;
    for (let x = this.crackX0; x < this.crackX1; x += 12) {
      const w = 6 + ((x / 12 + (t >> 3)) % 3);
      const sway = (t >> 2) % 2;
      fallOpts.alpha = 0.45;
      r.rect(x + sway, 0, w, Math.round(this.top), PAL.sky[2], fallOpts);
      fallOpts.alpha = 0.3;
      r.rect(x + sway + 1, 0, 2, Math.round(this.top), PAL.snow[3], fallOpts);
    }
    super.draw(r);
  }
}

defineEntity(SEWERS_E_IDS.flood, (w, x, y, p) => new SewersFlood(w, x, y, p), {
  category: 'prop',
  description: 'sewers-e: the canal water falling through the cracked vault and filling the hall floor to y 190 in 120 ticks (cosmetic: no hazard, no kill).',
});
