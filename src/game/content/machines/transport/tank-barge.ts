/**
 * `tank-barge` — the log raft that floats an `oompah-tank` down the river (GDD §9.5, m1-c
 * @1500: "an oompah-tank on a tank-barge floats left at 0.3 px/tick from R+48").
 *
 * A 96×12 raft of lashed logs with a crimson pennant. Not shootable, no points. It floats with
 * its keel 6 px under the water surface and drifts at 0.3 px/tick in its direction (only on
 * water; on dry land it sits still). Its top is a one-way moving platform (players can ride it
 * too) that carries its cargo: on the first tick it puts an `oompah-tank` on board (params
 * `stopX` = its own x, so the tank has "arrived" and has no spawn armour, `facing`, `barge:
 * true`) and keeps it on the raft (the tank's own driving is clamped to the deck). When the
 * cargo is destroyed, the raft drifts to a halt within 60 ticks so the wreck stays on it.
 * Params: `dir` / `from` / `enter` (default: right to left; with `enter` it starts just outside
 * the view), `speed` (0.3), `cargo` (spawn spec; default `oompah-tank`; `'none'` = empty raft),
 * `outfit` and `tag(s)` (passed to the cargo).
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { splash } from '../../../fx';
import { defineEntity, paramNum, type SpawnParams, type SpawnSpec } from '../../../registry';
import { waterSurfaceAt } from '../../../water';
import { Deck, drawAbove, parseSpecs, riderParams, travelDir } from './machine';

export const BARGE = {
  w: 96,
  h: 12,
  speed: 0.3,
  /** Keel depth under the water surface; raft top above the keel. */
  draft: 6,
  deckY: 9,
  deckW: 92,
  /** Ticks to drift to a halt once the cargo is gone. */
  stopTicks: 60,
} as const;

export const BARGE_ART = 'machine/tank-barge';
const BODY_SPRITE = `${BARGE_ART}/body`;
const DEFAULT_CARGO: readonly SpawnSpec[] = [{ id: 'oompah-tank' }];

const drawOpts: DrawOpts = {};

export class TankBarge extends Entity {
  readonly dir: 1 | -1;
  readonly speed: number;
  readonly params: SpawnParams;
  /** The tank on board (null when empty or not spawned yet). */
  cargo: Entity | null = null;
  deck: Deck | null = null;
  afloat = false;
  /** Current drift speed (eases to 0 after the cargo is destroyed). */
  drift: number;
  private readonly cargoSpec: SpawnSpec | null;
  private surface = Infinity;
  private started = false;
  private drawDy = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.type = 'tank-barge';
    this.params = p;
    this.team = 'neutral';
    this.z = 29; // behind its cargo
    this.despawnMargin = 96;
    this.hitbox = { x: -BARGE.w / 2, y: -BARGE.h, w: BARGE.w, h: BARGE.h };
    this.dir = travelDir(p, -1);
    this.facing = this.dir;
    this.speed = Math.max(0, paramNum(p, 'speed', BARGE.speed));
    this.drift = this.speed;
    this.cargoSpec = parseSpecs(p.cargo, DEFAULT_CARGO)[0] ?? null;
    const cam = world.camera;
    if (p.enter === 'right') this.x = Math.max(this.x, cam.right + BARGE.w / 2 + 4);
    else if (p.enter === 'left') this.x = Math.min(this.x, cam.left - BARGE.w / 2 - 4);
    this.prevX = this.x;
  }

  /** First tick: float, lay the deck, put the tank on board. */
  private start(): void {
    this.started = true;
    const w = this.world;
    const ws = waterSurfaceAt(this, this.x, this.y - 40);
    if (Number.isFinite(ws)) {
      this.afloat = true;
      this.surface = ws;
      this.y = Math.min(ws + BARGE.draft, w.terrain.surfaceY(this.x, ws, Infinity));
    } else {
      const g = w.terrain.surfaceY(this.x, this.y - 24, this.y + 24);
      if (Number.isFinite(g)) this.y = g;
    }
    this.prevY = this.y;
    const deck = new Deck(this, this.x - BARGE.deckW / 2, this.y - BARGE.deckY, BARGE.deckW, 4, true);
    this.deck = deck;
    const spec = this.cargoSpec;
    if (spec) {
      const params = riderParams(this.params, { stopX: this.x, facing: this.dir, barge: true });
      const e = w.spawn(spec.id, this.x, deck.top, { ...params, ...spec.params });
      this.cargo = e;
      deck.attach(e);
    }
  }

  override update(): void {
    if (!this.started) this.start();
    const deck = this.deck;
    if (this.cargoSpec && (!this.cargo || !this.cargo.alive)) {
      // The tank is gone: the raft drifts to a halt so its wreck stays aboard.
      this.drift = Math.max(0, this.drift - this.speed / BARGE.stopTicks);
    }
    if (this.afloat && this.drift > 0) {
      const dx = this.dir * this.drift;
      this.x += dx;
      deck?.move(dx, 0);
    }
    deck?.keepRiders();
    this.drawDy = this.afloat ? Math.round(Math.sin(this.age / 30) * 0.6) : 0;
    if (this.afloat && this.drift > 0 && this.age % 40 === 0) {
      splash(this.world, this.x - this.dir * (BARGE.w / 2 - 2), this.surface, 2);
    }
  }

  override onRemove(): void {
    this.deck?.destroy();
    this.deck = null;
    this.cargo = null;
  }

  override draw(r: Renderer): void {
    const f = Math.floor(this.age / 20) % 2;
    if (this.afloat) {
      drawAbove(r, BODY_SPRITE, f, this.x, this.y + this.drawDy, this.facing < 0, this.surface + 1);
      return;
    }
    drawOpts.flipX = this.facing < 0;
    r.sprite(BODY_SPRITE, f, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

defineEntity('tank-barge', (w, x, y, p) => new TankBarge(w, x, y, p), {
  category: 'prop',
  description: 'Log raft 96x12 carrying an oompah-tank, drifting at 0.3 px/tick on water. Params dir, speed, cargo.',
});
