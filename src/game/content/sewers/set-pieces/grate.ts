/**
 * `sewers-grate` (docs/design/sewers.md §2.2, §5.3; wave P1b B): a cast-iron grate in the paving of
 * sewers-b. A prop: not shootable, not a hazard, never blocks a hero. Three kinds (param `kind`):
 *
 * | kind | width | what it does |
 * |---|---|---|
 * | `gutter` | 16 | a drain grate in the alley gutter (400, 760, 1,120): with `auto` it rattles ONCE when a hero comes within `GRATE.autoNear` px (a hint, no threat) |
 * | `eruption` | 24 | the square's grates (1,980, 2,100, 2,220): `rattle()` (the 60-tick tell), `burst()` (the lid arc, the hole) |
 * | `big` | 64 | the burst grate (2,384–2,448, x = its centre): `burst({ pour: true })` opens the way down; rats pour out as decor while it is open |
 *
 * - `rattle(ticks = 60)`: the lid shakes, squeaks and red eyes between the bars, dust (the tell).
 * - `burst(o)`: the lid flies up in a cosmetic arc and lands beside the hole; the hole stays open
 *   (`hole` = the rim point for `ratPack(ctx, n, { hole: grate.hole })`, P1a RATS's `entry: 'hole'`);
 *   decor rats scurry out of it for `GRATE.pourTicks` (240) ticks, or for as long as the section
 *   lives with `pour: true`. The script spawns the real rats; this prop never spawns an entity.
 * - An open grate gives a faint green glow to the light pass (`LIGHT_TAG`; cosmetic).
 *
 * Everything here is cosmetic (`world.fxRng`, no `world.rng`): the sims read nothing of it. No
 * per-tick allocation (the decor rats live in fixed typed arrays).
 *
 * STAND-IN art (code-drawn; wave P5/P6 replace it with the same ids): `decor/sewers-grate/<kind>`
 * (frame 0 shut, 1 shut with eyes, 2 the open hole), `decor/sewers-grate/<kind>-lid` (frame 0 flat,
 * 1 edge-on), `decor/sewers-grate/rat` (a small dark scurrying rat, 2 frames).
 */
import type { Color } from '../../../../engine/color';
import { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { dust } from '../../../fx';
import { LIGHT_TAG, type LightSpot } from '../../../mission/light/api';
import { defineEntity, paramBool, paramStr, type SpawnParams } from '../../../registry';
import { sfxNear } from '../../props/common';

/** The entity id (missions/sewers/ids.ts `SEWERS_PIECE.grate`). */
export const GRATE_ID = 'sewers-grate';

/** The sprite prefix (the `sewers-` segment routes it to the lazy chunk). */
export const GRATE_ART = 'decor/sewers-grate';

export type GrateKind = 'gutter' | 'eruption' | 'big';

/** The numbers of the grates (ticks, px). */
export const GRATE = {
  /** Width of each kind (px). */
  w: { gutter: 16, eruption: 24, big: 64 } as Readonly<Record<GrateKind, number>>,
  /** The rattle (the tell before a burst): ticks. */
  rattle: 60,
  /** A gutter grate rattles once (a hint) for this long. */
  gutterRattle: 40,
  /** `auto`: a gutter grate rattles once when a hero comes this near (px, x). */
  autoNear: 110,
  /** Decor rats pour out of a burst grate this long (spec §5.3). */
  pourTicks: 240,
  /** One decor rat every this many ticks (± the fx jitter) while it pours. */
  pourEvery: 9,
  /** The lid's arc: launch speed up, gravity, sideways speed. */
  lidVy: -4.6,
  lidGravity: 0.22,
  lidVx: 0.9,
  /** The green glow of an open grate (the light pass; cosmetic). */
  glowR: 34,
  glow: 0.45,
} as const;

/** How many decor rats can scurry at once (per grate). */
const RATS = 8;

const IRON: readonly Color[] = [PAL.ink[0], PAL.ink[1], PAL.steel[0], PAL.steel[1], PAL.steel[2]];
const drawOpts: DrawOpts = {};

export interface BurstOpts {
  /** Pour decor rats for as long as the grate lives (the big burst grate). Default false. */
  pour?: boolean;
  /** Which way the lid flies (+1 right, −1 left; default by fxRng). */
  lidDir?: 1 | -1;
}

export class SewersGrate extends Entity {
  readonly kind: GrateKind;
  readonly w: number;
  /** 'shut' → 'rattle' → (shut again, or) 'open'. */
  state: 'shut' | 'rattle' | 'open' = 'shut';
  /** Ticks into the current state. */
  stateT = 0;
  /** How long the current rattle lasts. */
  private rattleLen = 0;
  /** A gutter grate rattles once by itself (`auto`). */
  private readonly auto: boolean;
  private autoDone = false;
  /** Pouring decor rats until this many ticks into 'open' (Infinity = for good). */
  private pourUntil = 0;
  private pourNext = 0;
  /** The lid's flight (world px), 'flying' or 'down' beside the hole. */
  private lidX = 0;
  private lidY = 0;
  private lidVx = 0;
  private lidVy = 0;
  private lidFlying = false;
  private lidDown = false;
  /** The decor rats: x offset from the hole, direction, age, life (0 = free slot). */
  private readonly rx = new Float32Array(RATS);
  private readonly rdir = new Int8Array(RATS);
  private readonly rage = new Uint16Array(RATS);
  private readonly rlife = new Uint16Array(RATS);
  private readonly rspeed = new Float32Array(RATS);

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    const k = paramStr(p, 'kind', 'eruption');
    this.kind = k === 'gutter' || k === 'big' ? k : 'eruption';
    this.w = GRATE.w[this.kind];
    this.auto = paramBool(p, 'auto', this.kind === 'gutter');
    this.hitbox = { x: -this.w / 2, y: -4, w: this.w, h: 8 };
    this.z = 12;
    this.despawnMargin = Infinity;
    this.addTag('prop', LIGHT_TAG);
  }

  /** The rim point a rat rises out of (`ratPack(ctx, n, { hole })`; spec §5.3). */
  get hole(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  get open(): boolean {
    return this.state === 'open';
  }

  get rattling(): boolean {
    return this.state === 'rattle';
  }

  /** The tell: the lid shakes, squeaks, red eyes between the bars, dust. No effect on play. */
  rattle(ticks: number = this.kind === 'gutter' ? GRATE.gutterRattle : GRATE.rattle): void {
    if (this.state === 'open') return;
    this.state = 'rattle';
    this.stateT = 0;
    this.rattleLen = Math.max(1, Math.round(ticks));
    sfxNear(this.world, this.x, this.y, 'sewers/grate-rattle', this.kind === 'gutter' ? 0.55 : 0.9);
  }

  /** The lid flies off; the hole stays open; decor rats pour out (spec §5.3). */
  burst(o: BurstOpts = {}): void {
    if (this.state === 'open') return;
    this.state = 'open';
    this.stateT = 0;
    this.pourUntil = o.pour ? Infinity : GRATE.pourTicks;
    this.pourNext = 0;
    const fx = this.world.fxRng;
    const dir = o.lidDir ?? (fx.chance(0.5) ? 1 : -1);
    this.lidX = this.x;
    this.lidY = this.y - 2;
    this.lidVx = dir * GRATE.lidVx * (this.kind === 'big' ? 1.6 : 1);
    this.lidVy = GRATE.lidVy * (this.kind === 'big' ? 0.8 : 1);
    this.lidFlying = true;
    this.lidDown = false;
    sfxNear(this.world, this.x, this.y, 'sewers/grate-burst', 1);
    dust(this.world, this.x, this.y - 1, this.kind === 'big' ? 8 : 5);
    this.world.particles.debris(this.x, this.y - 2, this.kind === 'big' ? 8 : 5, IRON);
  }

  override update(): void {
    this.stateT++;
    if (this.state === 'shut' && this.auto && !this.autoDone && this.heroNear(GRATE.autoNear)) {
      this.autoDone = true;
      this.rattle();
    }
    if (this.state === 'rattle') {
      if (this.stateT % 14 === 7) sfxNear(this.world, this.x, this.y, 'sewers/rat-squeak', this.kind === 'gutter' ? 0.3 : 0.45, 1.1 + this.world.fxRng.range(0, 0.3));
      if (this.stateT % 12 === 0) dust(this.world, this.x + this.world.fxRng.range(-this.w / 2, this.w / 2), this.y - 1, 1);
      if (this.stateT >= this.rattleLen) {
        this.state = 'shut';
        this.stateT = 0;
      }
    }
    if (this.lidFlying) this.flyLid();
    if (this.state === 'open') this.pour();
    this.moveRats();
  }

  /** Is a living hero within `d` px (x) of the grate? */
  private heroNear(d: number): boolean {
    const ps = this.world.players;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.alive && Math.abs(p.x - this.x) <= d) return true;
    }
    return false;
  }

  private flyLid(): void {
    this.lidX += this.lidVx;
    this.lidY += this.lidVy;
    this.lidVy += GRATE.lidGravity;
    if (this.lidVy > 0 && this.lidY >= this.y - 1) {
      // Lands flat on the paving beside the hole (never back on it).
      const off = this.w / 2 + 10;
      if (Math.abs(this.lidX - this.x) < off) this.lidX = this.x + Math.sign(this.lidVx || 1) * off;
      this.lidY = this.y - 1;
      this.lidFlying = false;
      this.lidDown = true;
      sfxNear(this.world, this.lidX, this.lidY, 'sewers/grate-rattle', 0.5, 1.4);
      dust(this.world, this.lidX, this.lidY, 2);
    }
  }

  /** Spawn decor rats out of the open hole (cosmetic, fxRng). */
  private pour(): void {
    if (this.stateT > this.pourUntil || this.stateT < this.pourNext) return;
    const fx = this.world.fxRng;
    this.pourNext = this.stateT + GRATE.pourEvery + fx.int(0, 6);
    for (let i = 0; i < RATS; i++) {
      if (this.rlife[i] !== 0) continue;
      this.rx[i] = fx.range(-this.w / 4, this.w / 4);
      this.rdir[i] = fx.chance(0.5) ? 1 : -1;
      this.rage[i] = 0;
      this.rlife[i] = 26 + fx.int(0, 22);
      this.rspeed[i] = 2.2 + fx.range(0, 1.2);
      return;
    }
  }

  private moveRats(): void {
    for (let i = 0; i < RATS; i++) {
      if (this.rlife[i] === 0) continue;
      this.rage[i]++;
      this.rx[i] += this.rdir[i] * this.rspeed[i];
      if (this.rage[i] >= this.rlife[i]) this.rlife[i] = 0;
    }
  }

  // ------------------------------------------------------------------------------- the light

  /** An open grate glows faintly green (the light pass; cosmetic). */
  lightOf(out: LightSpot, _tick: number): boolean {
    if (this.state !== 'open') return false;
    out.x = this.x;
    out.y = this.y - 6;
    out.r = GRATE.glowR * (this.kind === 'big' ? 1.6 : 1);
    out.color = PAL.green[2];
    out.intensity = GRATE.glow;
    out.flicker = 0.05;
    return true;
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const id = `${GRATE_ART}/${this.kind}`;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    if (this.state === 'open') {
      r.sprite(id, 2, x, y, drawOpts);
    } else {
      const shaking = this.state === 'rattle';
      const dx = shaking ? ((this.stateT >> 1) % 2 === 0 ? -1 : 1) : 0;
      const eyes = shaking && (this.stateT >> 3) % 3 !== 2;
      r.sprite(id, eyes ? 1 : 0, x + dx, y - (shaking && (this.stateT >> 2) % 2 === 0 ? 1 : 0), drawOpts);
    }
    // The decor rats, scurrying out over the paving (behind every actor: z 12).
    for (let i = 0; i < RATS; i++) {
      if (this.rlife[i] === 0) continue;
      const left = this.rlife[i] - this.rage[i];
      drawOpts.alpha = left < 8 ? left / 8 : 1;
      drawOpts.flipX = this.rdir[i] < 0;
      const hop = this.rage[i] < 6 ? 6 - this.rage[i] : 0;
      r.sprite(`${GRATE_ART}/rat`, (this.rage[i] >> 2) & 1, Math.round(this.x + this.rx[i]), y - hop, drawOpts);
    }
    drawOpts.alpha = 1;
    drawOpts.flipX = false;
    if (this.lidFlying || this.lidDown) {
      const edge = this.lidFlying && (this.stateT >> 2) % 2 === 1 ? 1 : 0;
      r.sprite(`${id}-lid`, edge, Math.round(this.lidX), Math.round(this.lidY), drawOpts);
    }
  }
}

defineEntity(GRATE_ID, (w, x, y, p) => new SewersGrate(w, x, y, p), {
  category: 'prop',
  description: 'A cast-iron grate in the paving (sewers-b): kind gutter (rattles once, auto), eruption (rattle, burst: rats rise out), big (the way down; pours decor rats). Cosmetic, not a hazard.',
});

// ---------------------------------------------------------------------------------------------
// STAND-IN art (code-drawn; anchor: the top centre of the grate = the paving line)
// ---------------------------------------------------------------------------------------------

/** One grate frame: the iron frame, the bars, the slot (frame 0), eyes (1), the open hole (2). */
function grateFrame(w: number, f: 0 | 1 | 2): PixelBuffer {
  const h = 5;
  const b = new PixelBuffer(w + 2, h + 1);
  b.rect(0, 0, w + 2, 1, IRON[2]);
  b.rect(0, 0, 1, h, IRON[2]);
  b.rect(w + 1, 0, 1, h, IRON[2]);
  b.rect(1, 1, w, h - 1, IRON[0]);
  b.rect(0, h, w + 2, 1, IRON[1]);
  if (f === 2) {
    // The open hole: black, a green gleam deep down, the broken rim.
    b.rect(2, 1, w - 2, 1, PAL.green[0]);
    b.set(Math.floor(w / 2), 3, PAL.green[1]);
    b.set(Math.floor(w / 3), 4, PAL.green[0]);
    return b;
  }
  for (let x = 2; x < w; x += 3) b.rect(x, 1, 1, h - 1, IRON[3]);
  b.hline(1, w, 0, IRON[4]);
  if (f === 1) {
    for (let x = 4; x < w - 1; x += 9) {
      b.set(x, 3, PAL.red[3]);
      b.set(x + 2, 3, PAL.red[3]);
    }
  }
  return b;
}

/** The lid on its own: flat (0) or edge-on (1) while it tumbles. */
function lidFrame(w: number, f: 0 | 1): PixelBuffer {
  if (f === 1) {
    const b = new PixelBuffer(4, Math.max(6, Math.round(w / 3)));
    b.rect(1, 0, 2, b.h, IRON[3]);
    b.vline(1, 0, b.h - 1, IRON[4]);
    return b;
  }
  const b = new PixelBuffer(w, 3);
  b.rect(0, 0, w, 3, IRON[2]);
  for (let x = 1; x < w; x += 3) b.rect(x, 1, 1, 2, IRON[0]);
  b.hline(0, w - 1, 0, IRON[4]);
  return b;
}

/** A small dark decor rat (12 px), two scurry frames, red eye; anchor: the feet. */
function decorRat(f: 0 | 1): PixelBuffer {
  const b = new PixelBuffer(16, 7);
  const body = PAL.ink[1];
  const back = PAL.brown[0];
  b.ellipse(3, 2, 9, 4, body);
  b.hline(4, 10, 2, back);
  b.ellipse(10, 2, 4, 3, body);
  b.set(13, 3, body);
  b.set(12, 3, PAL.red[3]);
  b.hline(0, 3, f === 0 ? 4 : 3, PAL.pink[0]);
  b.set(4 + f, 6, body);
  b.set(9 - f, 6, body);
  return b;
}

for (const kind of ['gutter', 'eruption', 'big'] as const) {
  const w = GRATE.w[kind];
  defineSprite(`${GRATE_ART}/${kind}`, () => [grateFrame(w, 0), grateFrame(w, 1), grateFrame(w, 2)], { anchor: [Math.floor(w / 2) + 1, 0], loop: false });
  defineSprite(`${GRATE_ART}/${kind}-lid`, () => [lidFrame(w, 0), lidFrame(w, 1)], { anchor: 'feet', loop: false });
}
defineSprite(`${GRATE_ART}/rat`, () => [decorRat(0), decorRat(1)], { anchor: 'feet', ticksPerFrame: 3 });
