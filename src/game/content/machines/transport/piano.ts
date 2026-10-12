/**
 * `piano` — the piano-bomber's grand piano (GDD §9.2, §15.4 enemy projectile `piano`).
 *
 * - Falls with acceleration 0.25 (max 9 px/tick) and draws a shadow that grows on the floor
 *   under it. Whatever its 32×24 box touches on the way down is hit once: players are killed
 *   and vehicles take a big hit (`impact`, tag `heavy`); Legion soldiers and props are crushed
 *   (`crush` 200 → `die-crush`, the pancake) and each one killed pays SET PIECE! +200 to the
 *   nearest player (GDD §14.2). Machines and bosses are not hurt.
 * - Lands: "PLONK" (`machine/piano-crash`), dust, a small shake. It stays as a solid 32×24
 *   (cover — riflemen hide behind it — and a step) for 600 ticks, then collapses into a pile of
 *   keys. On deep water (floor more than 24 px under the surface, or none) it floats instead:
 *   a one-way platform that bobs ±2 px for 600 ticks, then sinks.
 * - `mode: 'air'` (m5-a): it falls through the whole screen and never lands.
 * Params: `mode` ('ground' | 'air'), `vx`, `vy` (initial speed), `harmless` (true = never hurts
 * players: decoration drops).
 */
import { type Damage, Entity } from '../../../../engine/entity';
import { overlaps } from '../../../../engine/math';
import { INK } from '../../../../engine/palette';
import { Body, moveBody, SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { awardScore } from '../../../events';
import { dust, FX_WATER, splash } from '../../../fx';
import { isPlayer } from '../../../player/player';
import { defineEntity, paramBool, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { waterSurfaceAt } from '../../../water';

export const PIANO = {
  w: 32,
  h: 24,
  gravity: 0.25,
  maxFall: 9,
  /** Damage to players / vehicles (a big hit) and to Legion soldiers (crush). */
  hit: 100,
  crush: 200,
  setPiece: 200,
  standTicks: 600,
  collapseTicks: 32,
  pileTicks: 60,
  floatTicks: 600,
  sinkTicks: 48,
  /** Floating: the piano sits this deep, bobbing ±bob px over bobPeriod ticks. */
  draft: 9,
  bob: 2,
  bobPeriod: 60,
  /** Water deeper than this (surface to floor) floats a piano. */
  deep: 24,
} as const;

export const PIANO_ART = 'machine/piano-bomber';
const FALL_SPRITE = `${PIANO_ART}/piano`;
const STAND_SPRITE = `${PIANO_ART}/piano-landed`;
const COLLAPSE_SPRITE = `${PIANO_ART}/piano-collapse`;

export type PianoState = 'fall' | 'stand' | 'collapse' | 'pile' | 'float' | 'sink';

const drawOpts: DrawOpts = {};
const shadowOpts: DrawOpts = { alpha: 0.4 };

/**
 * A soft flat shadow on the floor (an ellipse of rects, alpha-blended by the renderer).
 * `w` = width in px; it is a third as tall.
 */
export function drawShadow(r: Renderer, x: number, y: number, w: number, alpha = 0.4): void {
  const half = Math.max(2, Math.round(w / 2));
  const rows = Math.max(1, Math.round(half / 4));
  shadowOpts.alpha = alpha;
  for (let i = -rows; i <= rows; i++) {
    const k = 1 - (i * i) / ((rows + 1) * (rows + 1));
    const hw = Math.round(half * Math.sqrt(k));
    r.rect(Math.round(x) - hw, Math.round(y) - 1 + i, hw * 2, 1, INK, shadowOpts);
  }
}

export class Piano extends Entity {
  state: PianoState = 'fall';
  stateT = 0;
  readonly air: boolean;
  readonly harmless: boolean;
  /** The machine that dropped it (never hit by its own piano). */
  shooter: Entity | null = null;
  /** The solid (standing) or one-way (floating) box, once it has landed. */
  box: SolidBox | null = null;
  /** Floor (or water surface) under the falling piano, for its shadow. */
  shadowY = Infinity;
  private readonly hitList: Entity[] = [];
  private surface = Infinity;
  private readonly damage: Damage;
  private readonly crush: Damage;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.type = 'piano';
    this.team = 'enemy';
    this.z = 34;
    this.hitbox = { x: -PIANO.w / 2, y: -PIANO.h, w: PIANO.w, h: PIANO.h };
    this.air = paramStr(p, 'mode', 'ground') === 'air';
    this.harmless = paramBool(p, 'harmless', false);
    this.vx = paramNum(p, 'vx', 0);
    this.vy = paramNum(p, 'vy', 0);
    this.facing = world.fxRng.chance(0.5) ? 1 : -1;
    if (!this.air) this.body = new Body({ w: PIANO.w - 2, h: PIANO.h, gravity: PIANO.gravity, maxFall: PIANO.maxFall });
    this.despawnMargin = 128;
    this.damage = { amount: PIANO.hit, kind: 'impact', dirX: 0, source: this, tags: ['heavy'] };
    this.crush = { amount: PIANO.crush, kind: 'crush', dirX: 0, source: this };
  }

  private setState(s: PianoState): void {
    this.state = s;
    this.stateT = 0;
  }

  override update(): void {
    this.stateT++;
    switch (this.state) {
      case 'fall':
        return this.fall();
      case 'stand':
        return this.stand();
      case 'collapse':
        if (this.stateT >= PIANO.collapseTicks) this.setState('pile');
        return;
      case 'pile':
        if (this.stateT >= PIANO.pileTicks + 24) this.remove();
        return;
      case 'float':
        return this.float();
      case 'sink':
        this.y += 0.5;
        if (this.stateT % 6 === 0) this.world.particles.emit(FX_WATER, this.x + this.world.fxRng.range(-10, 10), this.surface - 1, 0, -0.8);
        if (this.stateT >= PIANO.sinkTicks) this.remove();
        return;
    }
  }

  // ------------------------------------------------------------------------------- falling

  private fall(): void {
    const w = this.world;
    if (this.air) {
      // Flight mode: straight through the screen.
      this.vy = Math.min(this.vy + PIANO.gravity, PIANO.maxFall);
      this.x += this.vx;
      this.y += this.vy;
      this.crushOverlaps();
      if (this.y - PIANO.h > w.camera.bottom + 8) this.remove();
      return;
    }
    const prevY = this.y;
    const c = moveBody(this, w.terrain, w);
    // Deep water floats it (GDD §9.2: "on deep water the pianos float").
    const ws = waterSurfaceAt(this, this.x, prevY - 1);
    if (Number.isFinite(ws) && this.y >= ws && this.deepWater(ws)) {
      this.y = ws + PIANO.draft;
      this.crushOverlaps();
      this.startFloat(ws);
      return;
    }
    this.crushOverlaps();
    if (c.onGround) this.land();
    else this.shadowY = this.floorBelow();
  }

  /** Floor (or water) under the piano. */
  private floorBelow(): number {
    const g = this.world.terrain.surfaceY(this.x, this.y, Infinity);
    const ws = waterSurfaceAt(this, this.x, this.y);
    return Math.min(g, ws);
  }

  private deepWater(surface: number): boolean {
    const floor = this.world.terrain.surfaceY(this.x, surface, Infinity);
    return !Number.isFinite(floor) || floor - surface > PIANO.deep;
  }

  /** Hit everything the box touches, once each (see the header for who takes what). */
  private crushOverlaps(): void {
    const w = this.world;
    const me = this.hitRect();
    const list = w.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t === this || t === this.shooter || !t.alive || t.team === 'neutral' || this.hitList.includes(t)) continue;
        if (t.team === 'enemy' && (t.hasTag('machine') || t.hasTag('boss') || t.hasTag('shot'))) continue;
        if (t.team === 'player' && this.harmless) continue;
        const boxes = t.hurtboxes();
        let part = -1;
        for (let k = 0; k < boxes.length && part < 0; k++) if (overlaps(me, boxes[k])) part = k;
        if (part < 0) continue;
        this.hitList.push(t);
        if (t.team === 'player') {
          w.damage(t, this.damage, part);
          continue;
        }
        w.damage(t, this.crush, part);
        if (t.dead && !t.hasTag('crate')) this.setPiece(t);
      }
    } finally {
      w.releaseSnapshot();
    }
  }

  /** SET PIECE! +200 for a Legion soldier flattened by a landing piano (GDD §14.2). */
  private setPiece(t: Entity): void {
    const p = this.world.nearestPlayer(t.x, t.y);
    if (!p || !isPlayer(p)) return;
    awardScore(this.world, p.index, PIANO.setPiece, t.x, t.y - 40);
    hudOf(this.world).callout(`SET PIECE! +${PIANO.setPiece}`);
  }

  // ------------------------------------------------------------------------------- landed

  private land(): void {
    const w = this.world;
    this.setState('stand');
    this.vx = 0;
    this.vy = 0;
    w.audio.sfx('machine/piano-crash');
    dust(w, this.x - 12, this.y, 3);
    dust(w, this.x + 12, this.y, 3);
    w.camera.shake(2, 8);
    this.addTag('cover');
    // A solid (cover and a step). Added 1 px low and lifted, so anyone it landed on (an
    // invulnerable player) is pushed out to the nearest side instead of being stuck inside.
    const box = new SolidBox(this.x - PIANO.w / 2, this.y - PIANO.h + 1, PIANO.w, PIANO.h, false, this);
    this.box = w.addSolid(box);
    w.moveSolid(box, 0, -1);
  }

  private stand(): void {
    const w = this.world;
    const box = this.box;
    const b = this.body;
    if (b && box) {
      // Ride whatever it stands on (a float, a raft); its box follows.
      const ox = this.x;
      const oy = this.y;
      moveBody(this, w.terrain, w);
      const dx = this.x - ox;
      const dy = this.y - oy;
      if (dx !== 0 || dy !== 0) w.moveSolid(box, dx, dy);
    }
    if (this.stateT >= PIANO.standTicks) {
      // Collapses into a pile of keys.
      if (box) w.removeSolid(box);
      this.box = null;
      this.body = null;
      this.removeTag('cover');
      w.audio.sfx('hit/drum', { vol: 0.5, pitch: 1.6 });
      this.setState('collapse');
    }
  }

  // ------------------------------------------------------------------------------- floating

  private startFloat(surface: number): void {
    const w = this.world;
    this.setState('float');
    this.surface = surface;
    this.body = null;
    this.vx = 0;
    this.vy = 0;
    splash(w, this.x, surface, 14);
    w.audio.sfx('env/water-splash');
    w.audio.sfx('machine/piano-crash', { vol: 0.8 });
    // The lid is a one-way platform that bobs with the piano.
    this.box = w.addSolid(new SolidBox(this.x - PIANO.w / 2 + 1, this.y - PIANO.h, PIANO.w - 2, 4, true, this));
  }

  private float(): void {
    const w = this.world;
    const box = this.box;
    const target = this.surface + PIANO.draft + Math.round(Math.sin((this.stateT / PIANO.bobPeriod) * Math.PI * 2) * PIANO.bob);
    const dy = target - this.y;
    if (dy !== 0) {
      this.y = target;
      if (box) w.moveSolid(box, 0, dy);
    }
    if (this.stateT >= PIANO.floatTicks) {
      if (box) w.removeSolid(box);
      this.box = null;
      this.setState('sink');
      w.audio.sfx('env/water-splash', { vol: 0.5, pitch: 0.7 });
    }
  }

  override onRemove(): void {
    if (this.box) this.world.removeSolid(this.box);
    this.box = null;
    this.shooter = null;
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.flipX = this.facing < 0;
    switch (this.state) {
      case 'fall': {
        if (!this.air && Number.isFinite(this.shadowY)) {
          // The shadow grows as the piano comes down (GDD §9.2 telegraph).
          const k = 1 - Math.min(1, Math.max(0, (this.shadowY - this.y) / 160));
          drawShadow(r, x, this.shadowY, 10 + 26 * k, 0.25 + 0.25 * k);
        }
        r.sprite(FALL_SPRITE, Math.floor(this.stateT / 6), x, y, drawOpts);
        return;
      }
      case 'stand':
      case 'float':
        r.sprite(STAND_SPRITE, 0, x, y, drawOpts);
        return;
      case 'sink':
        r.sprite(STAND_SPRITE, 0, x, y, drawOpts);
        return;
      case 'collapse':
        r.sprite(COLLAPSE_SPRITE, Math.min(3, Math.floor((this.stateT * 4) / PIANO.collapseTicks)), x, y, drawOpts);
        return;
      case 'pile':
        if (this.stateT > PIANO.pileTicks && this.stateT % 4 < 2) return;
        r.sprite(COLLAPSE_SPRITE, 3, x, y, drawOpts);
        return;
    }
  }
}

defineEntity('piano', (w, x, y, p) => new Piano(w, x, y, p), {
  category: 'projectile',
  description: 'Falling grand piano: crushes, then stands as cover 600 ticks (floats on deep water). Params mode, vx, vy, harmless.',
});
