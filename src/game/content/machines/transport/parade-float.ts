/**
 * `parade-float` — a Legion parade float (GDD §9.5; m4-b @700 and @2000).
 *
 * A crimson stage on hidden wheels, skirted with a gold fringe and bunting, crowned with a
 * giant brass tuba (`variant: 'tuba'`) or a giant bass drum (`'drum'`), and a mast at the back
 * for a `float` hostage. 96 wide; its deck is 42 px above the road. It drives left at
 * 0.5 px/tick (`dir`) as a moving **solid** platform: players and vehicles cannot pass through
 * it but can climb on and ride it; Legion soldiers in the way are pushed along. It never pushes
 * a player: while a player (or a driven player vehicle) blocks its nose, the parade halts.
 * 300 HP, 1,500 points (a prop: not counted as an enemy kill and it does not hold
 * `ctx.waitClear()`); no contact damage, no weapon of its own.
 * - Riders: 2 `rifleman` by default (`riders`), standing on the deck with `entry: 'float'`
 *   (kept on board while the float lives).
 * - `hostage`: a spawn spec for the hostage tied to the mast (e.g. `{ id: 'hostage', params:
 *   { kind: 'critic', bind: 'float', drop: 'M' } }`); it rides along until freed.
 * - Death: an explosion, confetti, the giant instrument bounces off, the deck is gone (riders
 *   drop to the road), a tied hostage is freed (credited to the killer); a burnt chassis stays
 *   240 ticks.
 * Params: `variant`, `riders`, `hostage`, `outfit` and `tag(s)` (passed to the riders), `dir` /
 * `from` / `enter` (default right to left), `speed` (0.5), plus `hp`, `drop`.
 */
import type { Damage } from '../../../../engine/entity';
import type { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { ParticlePreset } from '../../../../engine/particles';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { explosion, FX_TRAIL } from '../../../fx';
import { defineEntity, paramNum, paramSpawn, paramStr, type SpawnParams, type SpawnSpec } from '../../../registry';
import { Deck, parseSpecs, playerBodyIn, riderParams, TransportMachine, travelDir } from './machine';
import { FallingProp } from './props';

/** Parade float numbers (GDD §9.5; NORMAL). */
export const FLOAT = {
  hp: 300,
  score: 1500,
  w: 96,
  /** Deck height above the road (the body is 96×40; the riders stand on a 2 px stage on top). */
  deckH: 42,
  speed: 0.5,
  /** Rider spots and the mast (unflipped x; the nose — where the big instrument sits — is at +x). */
  riderDx: [-30, -6] as readonly number[],
  mastDx: -40,
  wreckTicks: 240,
} as const;

export const FLOAT_ART = 'machine/parade-float';
const DEFAULT_RIDERS: readonly SpawnSpec[] = [{ id: 'rifleman' }, { id: 'rifleman' }];

const CONFETTI: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 1,
  life: [40, 70],
  gravity: 0.05,
  drag: 0.96,
  fadeFrom: 0.7,
};
const CONFETTI_COLORS = [PAL.red[2], PAL.gold[2], PAL.snow[3], PAL.red[3], PAL.gold[3], PAL.sky[2]];

export class ParadeFloat extends TransportMachine {
  readonly dir: 1 | -1;
  readonly variant: 'tuba' | 'drum';
  readonly speed: number;
  readonly riders: Entity[] = [];
  hostage: Entity | null = null;
  deck: Deck | null = null;
  /** Halted by a player in front this tick. */
  blocked = false;
  private readonly riderSpecs: SpawnSpec[];
  private readonly hostageSpec: SpawnSpec | null;
  private started = false;
  private readonly front: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly bodyId: string;
  private readonly wreckId: string;
  private readonly topperId: string;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: FLOAT_ART, hp: FLOAT.hp, w: FLOAT.w, h: FLOAT.deckH, countsAsKill: false });
    this.removeTag('enemy'); // a prop: never holds a wave (GDD §9.5 "not counted as enemies")
    this.dir = travelDir(p, -1);
    this.facing = this.dir;
    this.variant = paramStr(p, 'variant', 'tuba') === 'drum' ? 'drum' : 'tuba';
    this.speed = Math.max(0, paramNum(p, 'speed', FLOAT.speed));
    this.riderSpecs = parseSpecs(p.riders, DEFAULT_RIDERS);
    this.hostageSpec = paramSpawn(p, 'hostage', world);
    this.bodyId = `${FLOAT_ART}/${this.variant}`;
    this.wreckId = `${FLOAT_ART}/wreck`;
    this.topperId = `${FLOAT_ART}/topper-${this.variant}`;
    this.smokeX = 10;
    this.smokeY = -30;
    const cam = world.camera;
    if (p.enter === 'right') this.x = Math.max(this.x, cam.right + FLOAT.w / 2 + 4);
    else if (p.enter === 'left') this.x = Math.min(this.x, cam.left - FLOAT.w / 2 - 4);
    this.prevX = this.x;
  }

  /** First tick: the deck (a solid block), then the riders and the hostage on top of it. */
  private start(): void {
    this.started = true;
    const w = this.world;
    const g = w.terrain.surfaceY(this.x, this.y - 24, this.y + 24);
    if (Number.isFinite(g)) this.y = this.prevY = g;
    const deck = new Deck(this, this.x - FLOAT.w / 2, this.y - FLOAT.deckH, FLOAT.w, FLOAT.deckH, false);
    this.deck = deck;
    const t = this.target();
    for (let i = 0; i < this.riderSpecs.length; i++) {
      const spec = this.riderSpecs[i];
      const k = i % FLOAT.riderDx.length;
      const rx = this.x + (FLOAT.riderDx[k] + Math.floor(i / FLOAT.riderDx.length) * 8) * this.facing;
      const face = t ? (t.x < rx ? -1 : 1) : this.facing;
      const params = riderParams(this.params, { entry: 'float', gag: false, facing: face });
      const e = w.spawn(spec.id, rx, deck.top, { ...params, ...spec.params });
      this.riders.push(e);
      deck.attach(e);
    }
    const hs = this.hostageSpec;
    if (hs) {
      const h = w.spawn(hs.id, this.x + FLOAT.mastDx * this.facing, deck.top, { facing: this.facing, ...hs.params });
      this.hostage = h;
      deck.attach(h);
    }
    // A tied hostage stays at the mast; once freed it may walk off.
    deck.keep = (e) => e !== this.hostage || (e as Entity & { state?: unknown }).state === 'tied';
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    if (!this.started) this.start();
    const deck = this.deck;
    const dx = this.dir * this.speed;
    // The parade halts for a player in its way (it never shoves a player into the view edge).
    const f = this.front;
    f.x = this.dir < 0 ? this.x - FLOAT.w / 2 + dx - 1 : this.x + FLOAT.w / 2;
    f.y = this.y - FLOAT.deckH + 1;
    f.w = Math.abs(dx) + 1;
    f.h = FLOAT.deckH - 1;
    this.blocked = dx !== 0 && playerBodyIn(this.world, f);
    if (!this.blocked && dx !== 0) {
      this.x += dx;
      // Follow the road over gentle slopes (the deck and its riders go along).
      const g = this.world.terrain.surfaceY(this.x, this.y - 8, this.y + 8);
      const dy = Number.isFinite(g) ? g - this.y : 0;
      this.y += dy;
      deck?.move(dx, dy);
    }
    this.vx = this.blocked ? 0 : dx;
    deck?.keepRiders();
    this.play(this.variant);
    // A wobble of the decorations; exhaust from under the skirt.
    if (this.age % 24 === 0 && this.vx !== 0) {
      this.world.particles.emit(FX_TRAIL, this.x - this.facing * (FLOAT.w / 2 - 4), this.y - 3, -this.facing * 0.3, -0.1);
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    const w = this.world;
    this.vx = 0;
    explosion(w, this.x, this.y - 22, 'l', { team: 'enemy', debris: 'wood' });
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI / 2 + w.fxRng.range(-1.2, 1.2);
      const s = w.fxRng.range(1, 3.4);
      w.particles.emit(CONFETTI, this.x + w.fxRng.range(-30, 30), this.y - 40, Math.cos(a) * s, Math.sin(a) * s, undefined, CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    }
    // The giant instrument bounces off.
    FallingProp.spawn(w, this.x + 28 * this.facing, this.y - 46, {
      sprite: this.topperId,
      vx: this.facing * w.fxRng.range(0.8, 1.6),
      vy: -4.2,
      gravity: 0.22,
      spin: 5,
      sfx: this.variant === 'drum' ? 'hit/drum' : 'hit/metal',
      rest: 90,
    });
    // A tied hostage is freed by the blast (credited to the killer).
    const h = this.hostage as (Entity & { onBlast?: (x: number, y: number, r: number, owner: number) => void; state?: unknown }) | null;
    if (h && h.alive && h.state === 'tied' && typeof h.onBlast === 'function') h.onBlast(this.x, this.y, 64, d.owner ?? -1);
    this.deck?.destroy();
    this.deck = null;
    this.play('wreck');
  }

  protected override updateDeath(): void {
    this.deadT++;
    const w = this.world;
    if (this.deadT === 8) explosion(w, this.x - 30 * this.facing, this.y - 14, 'm', { team: 'enemy', debris: null });
    if (this.deadT % 12 === 0 && this.deadT < FLOAT.wreckTicks) w.particles.emit(FX_TRAIL, this.x + w.fxRng.range(-30, 30), this.y - 18, 0, -0.4);
    if (this.deadT >= FLOAT.wreckTicks + 30) this.remove();
  }

  override onRemove(): void {
    this.deck?.destroy();
    this.deck = null;
    this.hostage = null;
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.dead) {
      if (this.deadT > FLOAT.wreckTicks && this.deadT % 4 < 2) return;
      this.drawStrip(r, this.wreckId, 0, 0, 0, false);
      return;
    }
    this.drawStrip(r, this.bodySprite(this.bodyId), Math.floor(this.age / 10) % 4);
  }
}

defineEntity('parade-float', (w, x, y, p) => new ParadeFloat(w, x, y, p), {
  category: 'prop',
  score: FLOAT.score,
  description: 'Parade float 96x40: solid moving platform driving left at 0.5 px/tick with 2 riders (entry float) and an optional mast hostage. Params variant, riders, hostage.',
});
