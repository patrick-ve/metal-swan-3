/**
 * `rowboat` — Legion rowboat (GDD §9.5 support entity; §9.0 entry `rowboat`).
 *
 * A wooden rowboat 48×12 with a crimson stripe, gold trim and a pennant at the bow. It floats
 * with its keel 6 px under the water surface and carries 2 riflemen who stand in it, 12 px
 * either side of its centre, and shoot from it (they spawn with `entry: 'rowboat'` on a one-way
 * deck that keeps them aboard). With `stopX` it rows there at 0.8 px/tick and waits; without,
 * it waits where it is placed. 40 HP, 200 points (a prop: not counted as an enemy kill and it
 * does not hold `ctx.waitClear()`).
 * - Sinks when empty (no points) or destroyed: a crack, a splash and bubbles over 60 ticks.
 *   A destroyed boat throws its crew into the river: over deep water they are lost (killed,
 *   credited to whoever sank the boat).
 * - On dry land it sits on the ground and falls apart instead of sinking.
 * Params: `stopX`, `crew` (list of ids / `{ id, params }` / a count map; default 2
 * `rifleman`), `outfit` and `tag(s)` (passed to the crew), `dir` / `from` / `enter`, `hp`.
 */
import type { Damage } from '../../../../engine/entity';
import type { Entity } from '../../../../engine/entity';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { debris, FX_WATER, splash } from '../../../fx';
import { defineEntity, paramNum, type SpawnParams, type SpawnSpec } from '../../../registry';
import { waterSurfaceAt } from '../../../water';
import { Deck, drawAbove, parseSpecs, riderParams, TransportMachine, travelDir } from './machine';

/** Rowboat numbers (GDD §9.5; the rowing speed is our choice: the GDD is silent). */
export const ROWBOAT = {
  hp: 40,
  score: 200,
  w: 48,
  h: 12,
  speed: 0.8,
  /** Keel depth under the water surface. */
  draft: 6,
  /** Crew stand 12 px either side of the centre (GDD §11.1 m1-c). */
  crewDx: 12,
  /** Crew feet this far above the keel (the hull hides their shins); deck width. */
  deckY: 4,
  deckW: 40,
  sinkTicks: 60,
  /** Water deeper than this (surface to floor) drowns a thrown-out crew. */
  deep: 20,
} as const;

export const ROWBOAT_ART = 'machine/rowboat';
const SINK_SPRITE = `${ROWBOAT_ART}/sink`;
const DEFAULT_CREW: readonly SpawnSpec[] = [{ id: 'rifleman' }, { id: 'rifleman' }];

export type BoatState = 'row' | 'wait' | 'sink';

export class Rowboat extends TransportMachine {
  state: BoatState;
  stateT = 0;
  readonly stopX: number;
  readonly crewSpecs: SpawnSpec[];
  /** The crew it spawned (scripts and tests). */
  readonly crew: Entity[] = [];
  deck: Deck | null = null;
  /** Floating on water (else beached). */
  afloat = false;
  private dir: 1 | -1;
  private surface = Infinity;
  private started = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ROWBOAT_ART, hp: ROWBOAT.hp, w: ROWBOAT.w, h: ROWBOAT.h, countsAsKill: false });
    this.removeTag('enemy'); // a prop: never holds a wave (GDD §9.5 "not counted as enemies")
    this.stopX = paramNum(p, 'stopX', NaN);
    this.dir = Number.isFinite(this.stopX) ? (this.stopX < x ? -1 : 1) : travelDir(p, -1);
    this.facing = this.dir;
    this.state = Number.isFinite(this.stopX) ? 'row' : 'wait';
    this.crewSpecs = parseSpecs(p.crew, DEFAULT_CREW);
    this.smokeX = 0;
    this.smokeY = -10;
    this.z = 31; // in front of the crew's legs
    this.play(this.state === 'row' ? 'row' : 'idle');
  }

  /** Crew members still alive. */
  get crewAlive(): number {
    let n = 0;
    for (let i = 0; i < this.crew.length; i++) if (this.crew[i].alive) n++;
    return n;
  }

  private setState(s: BoatState): void {
    this.state = s;
    this.stateT = 0;
  }

  /** First tick: settle on the water (or the ground), lay the deck, seat the crew. */
  private start(): void {
    this.started = true;
    const w = this.world;
    const ws = waterSurfaceAt(this, this.x, this.y - 40);
    if (Number.isFinite(ws)) {
      this.afloat = true;
      this.surface = ws;
      const floor = w.terrain.surfaceY(this.x, ws, Infinity);
      this.y = Math.min(ws + ROWBOAT.draft, floor);
    } else {
      const g = w.terrain.surfaceY(this.x, this.y - 24, this.y + 24);
      if (Number.isFinite(g)) this.y = g;
    }
    this.prevY = this.y;
    const deck = new Deck(this, this.x - ROWBOAT.deckW / 2, this.y - ROWBOAT.deckY, ROWBOAT.deckW, 4, true);
    this.deck = deck;
    const t = this.target();
    const n = this.crewSpecs.length;
    for (let i = 0; i < n; i++) {
      // Two crew at ±12 px; more squeeze in between.
      const dx = n === 1 ? 0 : -ROWBOAT.crewDx + (i * ROWBOAT.crewDx * 2) / (n - 1);
      const cx = this.x + dx;
      const face = t ? (t.x < cx ? -1 : 1) : this.facing;
      const spec = this.crewSpecs[i];
      const params = riderParams(this.params, { entry: 'rowboat', gag: false, facing: face });
      const e = w.spawn(spec.id, cx, deck.top, { ...params, ...spec.params });
      this.crew.push(e);
      deck.attach(e);
    }
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    if (!this.started) this.start();
    this.stateT++;
    const deck = this.deck;
    switch (this.state) {
      case 'row': {
        const left = this.stopX - this.x;
        const step = Math.sign(left) * Math.min(Math.abs(left), ROWBOAT.speed);
        this.vx = step;
        this.x += step;
        deck?.move(step, 0);
        if (Math.abs(left) <= ROWBOAT.speed) this.setState('wait');
        break;
      }
      case 'wait':
        this.vx = 0;
        break;
      case 'sink':
        return;
    }
    deck?.keepRiders();
    this.drawDy = this.afloat ? Math.round(Math.sin(this.age / 26) * 0.6) : 0;
    this.play(this.state === 'row' ? 'row' : 'idle');
    // Empty: it sinks (no points).
    if (this.crew.length > 0 && this.crewAlive === 0) this.startSink(null);
  }

  private startSink(d: Damage | null): void {
    if (this.state === 'sink') return;
    const w = this.world;
    this.setState('sink');
    this.vx = 0;
    this.removeTag('shootable');
    // The crew goes overboard: lost in deep water (credited to whoever sank the boat).
    const deep = this.afloat && this.deepWater();
    for (let i = 0; i < this.crew.length; i++) {
      const c = this.crew[i];
      if (!c.alive || !deep || !this.deck?.standsOn(c.hitRect())) continue;
      w.damage(c, { amount: 9999, kind: 'impact', dirX: 0, owner: d?.owner, source: this });
    }
    this.deck?.destroy();
    if (this.afloat) {
      splash(w, this.x, this.surface, 12);
      w.audio.sfx('env/water-splash');
    }
    debris(w, this.x, this.y - 8, 'wood', this.afloat ? 4 : 8);
  }

  private deepWater(): boolean {
    const floor = this.world.terrain.surfaceY(this.x, this.surface, Infinity);
    return !Number.isFinite(floor) || floor - this.surface > ROWBOAT.deep;
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    this.startSink(d);
  }

  protected override updateDeath(): void {
    this.deadT++;
    this.sinkStep();
  }

  override update(): void {
    if (this.state === 'sink' && !this.dead) {
      // Sinking because it is empty: no AI, no damage.
      this.stateT++;
      this.sinkStep();
      return;
    }
    super.update();
  }

  /** Down it goes with bubbles (afloat), or it falls apart (on land). */
  private sinkStep(): void {
    const w = this.world;
    const t = this.dead ? this.deadT : this.stateT;
    if (this.afloat) {
      this.y += 0.35;
      if (t % 5 === 0) w.particles.emit(FX_WATER, this.x + w.fxRng.range(-18, 18), this.surface - 1, 0, -0.9);
    }
    if (t >= (this.afloat ? ROWBOAT.sinkTicks : 24)) this.remove();
  }

  override onRemove(): void {
    this.deck?.destroy();
    this.deck = null;
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const sinking = this.state === 'sink';
    const t = this.dead ? this.deadT : this.stateT;
    const id = sinking ? SINK_SPRITE : this.bodySprite(this.anim.id);
    const f = sinking ? Math.min(2, Math.floor((t * 3) / ROWBOAT.sinkTicks)) : this.anim.index;
    if (!this.afloat) {
      if (sinking && t % 4 >= 2) return; // falling apart on land
      this.drawStrip(r, id, f, 0, 0, !sinking);
      return;
    }
    // Afloat: only what sticks out of the water shows (the keel rides 6 px under it).
    drawAbove(r, id, f, this.x, this.y + this.drawDy, this.facing < 0, this.surface + 1);
  }
}

defineEntity('rowboat', (w, x, y, p) => new Rowboat(w, x, y, p), {
  category: 'prop',
  score: ROWBOAT.score,
  description: 'Rowboat 48x12: carries 2 riflemen (entry rowboat) on water, rows to stopX, sinks when empty or destroyed. Params stopX, crew, outfit.',
});
