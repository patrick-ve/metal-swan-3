/**
 * The simulation world of one section (docs/ARCHITECTURE.md §5.10).
 *
 * Tick order (`update()`):
 *   scripts → entity updates (insertion order) → shot pass → contact damage → particles →
 *   camera → cleanup (killY, despawn, removal) → audio.update
 * Entities added during a pass are queued and join the list right after that pass, so an entity
 * spawned during the entity pass first updates on the next tick (but already takes part in this
 * tick's shot and contact passes).
 *
 * Deterministic: everything random uses `rng` (gameplay) or `fxRng` (cosmetics), both seeded.
 * Errors thrown by an entity, a script or a listener are logged once, recorded in `errors`
 * (the sim tool reports them) and isolated: a failing entity is removed, the world goes on.
 */
import { NullAudio, type AudioOut } from './audio';
import { Camera } from './camera';
import { type Damage, Entity, hostile, type ShotLike, type Team } from './entity';
import { EventBus } from './events';
import { distToRect, overlaps, type Rect, rectAt, sweptRectT } from './math';
import { Particles } from './particles';
import { type PhysicsEnv, type SolidBox, moveSolid as physicsMoveSolid, sweep } from './physics';
import { VIEW_H, VIEW_W } from './render';
import type { Renderer } from './render';
import { Rng } from './rng';
import { ScriptRunner, type ScriptHost } from './script';
import { makeRayHit, Terrain, type TerrainDef } from './terrain';

export interface HitEvent {
  target: Entity;
  damage: Damage;
  part: number;
  absorbed: boolean;
}

export interface KillEvent {
  target: Entity;
  damage: Damage;
}

export interface WorldError {
  where: string;
  message: string;
  stack?: string;
  tick: number;
}

/**
 * Events of `world.events`. The game layer adds its own with declaration merging:
 * ```ts
 * declare module '../engine/world' {
 *   interface WorldEvents { score: { player: number; points: number } }
 * }
 * ```
 */
export interface WorldEvents {
  /** An entity joined the world. */
  spawn: Entity;
  /** An entity left the world (after onRemove). */
  remove: Entity;
  /** A hit was delivered through `world.damage` (shots, contact, areas, direct calls). */
  hit: HitEvent;
  /** A hit killed its target (the target became `dead`). */
  killed: KillEvent;
  /** Something threw; see `world.errors`. */
  error: WorldError;
}

/** Creates the entity for a spawn id. Return null only for unknown ids. */
export type EntityFactory = (
  id: string,
  world: World,
  x: number,
  y: number,
  params?: Readonly<Record<string, unknown>>,
) => Entity | null;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface WorldOptions {
  terrain?: Terrain | TerrainDef;
  /** Seed of `rng` (gameplay) and `fxRng` (cosmetics). Default 1. */
  seed?: number;
  factory?: EntityFactory | null;
  audio?: AudioOut;
  viewW?: number;
  viewH?: number;
  particleCapacity?: number;
}

const warnedSpawn = new Set<string>();

export class World implements PhysicsEnv, ScriptHost {
  /** Live entities in insertion order (removed ones disappear at the end of the tick). */
  readonly entities: Entity[] = [];
  terrain: Terrain;
  readonly camera: Camera;
  readonly particles: Particles;
  readonly scripts: ScriptRunner<World>;
  /** Gameplay randomness. */
  readonly rng: Rng;
  /** Cosmetic randomness (particles, shake, decorative variation). */
  readonly fxRng: Rng;
  readonly events = new EventBus<WorldEvents>();
  audio: AudioOut;
  factory: EntityFactory | null;
  /** Dynamic solids (moving platforms, hulls, barricades). */
  readonly solids: SolidBox[] = [];
  /** Errors caught so far (capped at 100). */
  readonly errors: WorldError[] = [];
  /** Number of completed ticks. */
  tick = 0;
  /** While true, `update()` does nothing. */
  paused = false;
  /** Debug god mode: entities tagged 'player' ignore all damage except 'crush'. */
  god = false;
  /** Particles are drawn between entities with z below and at/above this value. */
  particleZ = 55;

  private readonly pending: Entity[] = [];
  private readonly tagIndex = new Map<string, Entity[]>();
  private readonly drawList: Entity[] = [];
  private readonly warned = new Set<string>();
  private nextId = 1;
  private readonly rayHit = makeRayHit();
  private readonly shotRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly tmpRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly hitsT: number[] = [];
  private readonly hitsTarget: Entity[] = [];
  private readonly hitsPart: number[] = [];
  private readonly playersOut: Entity[] = [];
  /** Reused copies of tag lists for passes that hit things (re-entrant: a blast inside a blast). */
  private readonly snapPool: Entity[][] = [];
  private snapDepth = 0;

  constructor(opts: WorldOptions = {}) {
    const seed = opts.seed ?? 1;
    this.rng = new Rng(seed);
    this.fxRng = new Rng(seed).fork('fx');
    const t = opts.terrain;
    this.terrain = t instanceof Terrain ? t : t ? new Terrain(t) : Terrain.empty(opts.viewW ?? VIEW_W, opts.viewH ?? VIEW_H);
    this.camera = new Camera(opts.viewW ?? VIEW_W, opts.viewH ?? VIEW_H, this.fxRng.fork('camera'));
    this.camera.setBounds(this.terrain.bounds);
    this.particles = new Particles(opts.particleCapacity ?? 1024, this.fxRng.fork('particles'));
    this.scripts = new ScriptRunner<World>(this);
    this.scripts.onError = (name, err) => this.reportError(`script "${name}"`, err);
    this.audio = opts.audio ?? new NullAudio();
    this.factory = opts.factory ?? null;
  }

  /** @internal used by the Entity constructor. */
  nextEntityId(): number {
    return this.nextId++;
  }

  /** Swap the terrain (also resets the camera bounds). */
  setTerrain(t: Terrain | TerrainDef): void {
    this.terrain = t instanceof Terrain ? t : new Terrain(t);
    this.camera.setBounds(this.terrain.bounds);
  }

  // ------------------------------------------------------------------------------- adding

  /** Add an entity built by hand. It joins the list at the next flush point (see header). */
  add<E extends Entity>(e: E): E {
    if (e.world !== this) throw new Error(`World.add: entity #${e.id} belongs to another world`);
    if (e.inWorld || e.removed || this.pending.includes(e)) return e;
    this.pending.push(e);
    return e;
  }

  /**
   * Create an entity through the factory and add it. Unknown ids (or a factory that throws)
   * give a visible placeholder entity and one console warning per id.
   */
  spawn(id: string, x: number, y: number, params?: Readonly<Record<string, unknown>>): Entity {
    let e: Entity | null = null;
    if (this.factory) {
      try {
        e = this.factory(id, this, x, y, params);
      } catch (err) {
        this.reportError(`spawn "${id}"`, err);
        e = null;
      }
    }
    if (!e) {
      if (!warnedSpawn.has(id)) {
        warnedSpawn.add(id);
        console.warn(`[world] unknown entity id "${id}" — spawning a placeholder`);
      }
      e = new PlaceholderEntity(this, x, y, id);
    }
    if (!e.type) e.type = id;
    return this.add(e);
  }

  /** Move pending entities into the list (called at the flush points of `update`). */
  flush(): void {
    const p = this.pending;
    if (p.length === 0) return;
    // Index first, then announce: listeners may spawn more (they queue for the next flush).
    const batch = p.splice(0, p.length);
    for (const e of batch) {
      if (e.removed) continue;
      e.inWorld = true;
      this.entities.push(e);
      this.drawList.push(e);
      for (const t of e.tags) this.indexTag(e, t);
    }
    for (const e of batch) if (e.inWorld) this.events.emit('spawn', e);
  }

  /** @internal keeps the tag index in sync (Entity.addTag). */
  indexTag(e: Entity, tag: string): void {
    let list = this.tagIndex.get(tag);
    if (!list) {
      list = [];
      this.tagIndex.set(tag, list);
    }
    if (!list.includes(e)) list.push(e);
  }

  /** @internal keeps the tag index in sync (Entity.removeTag). */
  unindexTag(e: Entity, tag: string): void {
    const list = this.tagIndex.get(tag);
    if (!list) return;
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
  }

  // ------------------------------------------------------------------------------- dynamic solids

  addSolid(box: SolidBox): SolidBox {
    if (!this.solids.includes(box)) this.solids.push(box);
    return box;
  }

  removeSolid(box: SolidBox): void {
    const i = this.solids.indexOf(box);
    if (i >= 0) this.solids.splice(i, 1);
  }

  /** Move a dynamic solid, carrying riders and pushing bodies (see physics.moveSolid). */
  moveSolid(box: SolidBox, dx: number, dy: number): void {
    physicsMoveSolid(box, dx, dy, this.entities, this.terrain, this);
  }

  // ------------------------------------------------------------------------------- tick

  update(): void {
    if (this.paused) return;
    this.flush();
    this.scripts.update();
    this.flush();

    const list = this.entities;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const e = list[i];
      if (e.removed) continue;
      e.prevX = e.x;
      e.prevY = e.y;
      try {
        e.update();
      } catch (err) {
        this.reportError(`${e.type || 'entity'}.update`, err);
        e.remove();
      }
      e.age++;
      if (e.invulnTicks > 0) e.invulnTicks--;
      if (e.flashTicks > 0) e.flashTicks--;
    }
    this.flush();

    this.shotPass();
    this.contactPass();
    this.flush();

    this.particles.update(this.terrain);
    this.camera.update();
    this.cleanup();
    try {
      this.audio.update?.();
    } catch (err) {
      this.reportError('audio.update', err);
    }
    this.tick++;
  }

  /**
   * Deliver a hit through `target.onHit` and emit 'hit' / 'killed'. Returns whether the hit
   * was absorbed. Use for knives, beams and anything that is not a ShotLike.
   */
  damage(target: Entity, d: Damage, part = 0): boolean {
    if (!target.alive) return false;
    // God mode protects players from everything except crushing (as in the reference games).
    if (this.god && target.hasTag('player') && d.kind !== 'crush') return true;
    let absorbed = false;
    try {
      absorbed = target.onHit(d, part);
    } catch (err) {
      this.reportError(`${target.type || 'entity'}.onHit`, err);
      return false;
    }
    this.events.emit('hit', { target, damage: d, part, absorbed });
    if (target.dead) this.events.emit('killed', { target, damage: d });
    return absorbed;
  }

  /**
   * Explosion / area damage against hostile shootables whose hurtboxes touch the shape.
   * `falloff` (circles only, 0..1): damage at the edge is reduced by this fraction.
   * Each target is hit once (with the closest part). Returns the number of absorbed hits.
   */
  damageArea(shape: Circle | Rect, damage: Damage, team: Team, falloff = 0): number {
    const targets = this.snapshotTag('shootable');
    const circle = 'r' in shape;
    const cx = circle ? shape.x : shape.x + shape.w / 2;
    let hits = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t.alive || !hostile(team, t.team)) continue;
        const boxes = t.hurtboxes();
        let part = -1;
        let best = Infinity;
        for (let k = 0; k < boxes.length; k++) {
          const b = boxes[k];
          if (circle) {
            const d = distToRect(shape.x, shape.y, b);
            if (d < shape.r && d < best) {
              best = d;
              part = k;
            }
          } else if (overlaps(shape, b)) {
            part = k;
            break;
          }
        }
        if (part < 0) continue;
        const b = boxes[part];
        const scale = circle && falloff > 0 ? 1 - falloff * Math.min(1, best / shape.r) : 1;
        const dir = Math.sign(b.x + b.w / 2 - cx);
        const d: Damage = { ...damage, amount: damage.amount * scale, dirX: dir || damage.dirX };
        if (this.damage(t, d, part)) hits++;
      }
    } finally {
      this.releaseSnapshot();
    }
    return hits;
  }

  // ------------------------------------------------------------------------------- queries

  /**
   * Live array of entities with the tag (may include dead / removed ones until the tick ends).
   * The same array object is returned for the life of the world, so it can be kept, e.g.
   * `camera.follow(world.players)` before any player exists.
   */
  byTag(tag: string): readonly Entity[] {
    let list = this.tagIndex.get(tag);
    if (!list) {
      list = [];
      this.tagIndex.set(tag, list);
    }
    return list;
  }

  /**
   * A stable copy of the tag list, for loops that deal damage: a hit may add or remove tags
   * (a destroyed vehicle drops 'shootable'), which would shift the live `byTag` array and skip
   * the next entity. Always pair with `releaseSnapshot()` (use try/finally); no allocation after
   * the first use at each nesting depth.
   * ```ts
   * const list = world.snapshotTag('shootable');
   * try { for (const e of list) … } finally { world.releaseSnapshot(); }
   * ```
   */
  snapshotTag(tag: string): readonly Entity[] {
    let arr = this.snapPool[this.snapDepth];
    if (!arr) {
      arr = [];
      this.snapPool[this.snapDepth] = arr;
    }
    this.snapDepth++;
    const src = this.byTag(tag);
    arr.length = 0;
    for (let i = 0; i < src.length; i++) arr.push(src[i]);
    return arr;
  }

  /** Give back the most recent `snapshotTag` copy. */
  releaseSnapshot(): void {
    if (this.snapDepth > 0) this.snapPool[--this.snapDepth].length = 0;
  }

  /** Number of alive entities with the tag. */
  countAlive(tag: string): number {
    const list = this.byTag(tag);
    let n = 0;
    for (let i = 0; i < list.length; i++) if (list[i].alive) n++;
    return n;
  }

  /** Alive entities whose hitbox overlaps `r` (and pass `filter`). Fills and returns `out`. */
  query(r: Rect, filter?: (e: Entity) => boolean, out: Entity[] = []): Entity[] {
    out.length = 0;
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      if (!overlaps(r, e.hitRect(this.tmpRect))) continue;
      if (filter && !filter(e)) continue;
      out.push(e);
    }
    return out;
  }

  /** Entities tagged 'player' (live array). */
  get players(): readonly Entity[] {
    return this.byTag('player');
  }

  /** Alive players (a reused array — copy it to keep it). */
  alivePlayers(): readonly Entity[] {
    const out = this.playersOut;
    out.length = 0;
    const list = this.byTag('player');
    for (let i = 0; i < list.length; i++) if (list[i].alive) out.push(list[i]);
    return out;
  }

  /** Nearest alive player to (x, y), or null. */
  nearestPlayer(x: number, y: number): Entity | null {
    const list = this.byTag('player');
    let best: Entity | null = null;
    let bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.alive) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** Is the entity's hitbox within `margin` px of the camera view? */
  onScreen(e: Entity, margin = 0): boolean {
    return this.camera.inView(e.hitRect(this.tmpRect), margin);
  }

  // ------------------------------------------------------------------------------- drawing

  /**
   * Draw entities sorted by z (ties: oldest first) with the particles in between (`particleZ`).
   * Set the camera on the renderer first: `r.setCamera(world.camera.renderX, world.camera.renderY)`.
   */
  draw(r: Renderer): void {
    const dl = this.drawList;
    // Insertion sort: the list stays nearly sorted between frames, so this is ~O(n).
    for (let i = 1; i < dl.length; i++) {
      const e = dl[i];
      let j = i - 1;
      while (j >= 0 && (dl[j].z > e.z || (dl[j].z === e.z && dl[j].id > e.id))) {
        dl[j + 1] = dl[j];
        j--;
      }
      dl[j + 1] = e;
    }
    let particlesDone = false;
    for (let i = 0; i < dl.length; i++) {
      const e = dl[i];
      if (e.removed) continue;
      if (!particlesDone && e.z >= this.particleZ) {
        this.particles.draw(r);
        particlesDone = true;
      }
      try {
        e.draw(r);
      } catch (err) {
        this.reportError(`${e.type || 'entity'}.draw`, err);
      }
    }
    if (!particlesDone) this.particles.draw(r);
  }

  // ------------------------------------------------------------------------------- errors

  /** Record an error (logged once per place + message). */
  reportError(where: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const rec: WorldError = { where, message, stack, tick: this.tick };
    if (this.errors.length < 100) this.errors.push(rec);
    const key = `${where}|${message}`;
    if (!this.warned.has(key)) {
      this.warned.add(key);
      console.error(`[world] ${where} threw (tick ${this.tick}):`, err);
    }
    this.events.emit('error', rec);
  }

  // ------------------------------------------------------------------------------- passes

  private shotPass(): void {
    const shots = this.byTag('shot');
    if (shots.length === 0) return;
    const targets = this.byTag('shootable');
    for (let i = 0; i < shots.length; i++) {
      const e = shots[i];
      if (!e.alive) continue;
      const s = e as Entity & ShotLike;
      if (typeof s.onImpact !== 'function' || !s.damage) continue;
      this.resolveShot(e, s, targets);
    }
  }

  private resolveShot(e: Entity, s: ShotLike, targets: readonly Entity[]): void {
    const x0 = e.prevX;
    const y0 = e.prevY;
    const dx = e.x - x0;
    const dy = e.y - y0;
    let tTerrain = Infinity;
    let hx = 0;
    let hy = 0;
    if (s.hitsTerrain !== false) {
      const hit = sweep(this.terrain, x0, y0, e.x, e.y, s.hitsPlatforms === true, this, this.rayHit);
      if (hit) {
        tTerrain = hit.t;
        hx = hit.x;
        hy = hit.y;
      }
    }
    // Entity hits along the path, before the terrain hit.
    const shotRect = rectAt(x0, y0, e.hitbox, e.facing < 0, this.shotRect);
    const ts = this.hitsT;
    const tg = this.hitsTarget;
    const pa = this.hitsPart;
    ts.length = 0;
    tg.length = 0;
    pa.length = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t === e || !t.alive || !hostile(s.team, t.team)) continue;
      if (s.hitList && s.hitList.includes(t)) continue;
      const boxes = t.hurtboxes();
      let best = Infinity;
      let part = -1;
      for (let k = 0; k < boxes.length; k++) {
        const tt = sweptRectT(shotRect, dx, dy, boxes[k]);
        if (tt >= 0 && tt < best) {
          best = tt;
          part = k;
        }
      }
      if (part < 0 || best > tTerrain) continue;
      // Insert sorted by t (stable: earlier targets win ties), shifting in place.
      let j = ts.length;
      ts.push(best);
      tg.push(t);
      pa.push(part);
      while (j > 0 && ts[j - 1] > best) {
        ts[j] = ts[j - 1];
        tg[j] = tg[j - 1];
        pa[j] = pa[j - 1];
        j--;
      }
      ts[j] = best;
      tg[j] = t;
      pa[j] = part;
    }
    for (let k = 0; k < ts.length; k++) {
      const t = tg[k];
      if (!t.alive) continue;
      if (!this.damage(t, s.damage, pa[k])) continue; // passed through (invulnerable, …)
      const px = x0 + dx * ts[k];
      const py = y0 + dy * ts[k];
      const left = s.pierce ?? 0;
      if (left > 0) {
        s.pierce = left - 1;
        (s.hitList ??= []).push(t);
        this.impact(e, s, t, px, py);
        if (e.removed) return;
        continue;
      }
      e.x = px;
      e.y = py;
      this.impact(e, s, t, px, py);
      e.remove();
      return;
    }
    if (tTerrain !== Infinity) {
      e.x = hx;
      e.y = hy;
      this.impact(e, s, null, hx, hy);
      e.remove();
    }
  }

  private impact(e: Entity, s: ShotLike, target: Entity | null, x: number, y: number): void {
    try {
      s.onImpact(target, x, y);
    } catch (err) {
      this.reportError(`${e.type || 'shot'}.onImpact`, err);
    }
  }

  private contactPass(): void {
    const list = this.entities;
    if (this.byTag('shootable').length === 0) return;
    const targets = this.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const dmg = a.contactDamage;
        if (!dmg || !a.alive) continue;
        const attack = a.contactBoxes();
        if (attack.length === 0) continue;
        for (let j = 0; j < targets.length; j++) {
          const t = targets[j];
          if (t === a || !t.alive || !hostile(a.team, t.team)) continue;
          const boxes = t.hurtboxes();
          let hitPart = -1;
          for (let k = 0; k < boxes.length && hitPart < 0; k++) {
            for (let m = 0; m < attack.length; m++) {
              if (overlaps(attack[m], boxes[k])) {
                hitPart = k;
                break;
              }
            }
          }
          if (hitPart >= 0) this.damage(t, dmg, hitPart);
          if (!a.alive) break;
        }
      }
    } finally {
      this.releaseSnapshot();
    }
  }

  private cleanup(): void {
    const list = this.entities;
    const killY = this.terrain.killY;
    const cam = this.camera;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.removed && e.y > killY) {
        try {
          e.onOutOfWorld();
        } catch (err) {
          this.reportError(`${e.type || 'entity'}.onOutOfWorld`, err);
          e.remove();
        }
      }
      if (!e.removed && e.despawnMargin !== Infinity) {
        if (cam.inView(e.hitRect(this.tmpRect), e.despawnMargin)) e.seen = true;
        else if (e.seen) e.remove();
      }
      if (e.removed) {
        this.detach(e);
        continue;
      }
      list[w++] = e;
    }
    list.length = w;
    // Pending entities removed before they joined never enter the list.
    if (this.pending.length) {
      for (let i = this.pending.length - 1; i >= 0; i--) if (this.pending[i].removed) this.pending.splice(i, 1);
    }
  }

  private detach(e: Entity): void {
    e.inWorld = false;
    for (const t of e.tags) this.unindexTag(e, t);
    const di = this.drawList.indexOf(e);
    if (di >= 0) this.drawList.splice(di, 1);
    for (let i = this.solids.length - 1; i >= 0; i--) if (this.solids[i].owner === e) this.solids.splice(i, 1);
    try {
      e.onRemove();
    } catch (err) {
      this.reportError(`${e.type || 'entity'}.onRemove`, err);
    }
    this.events.emit('remove', e);
  }
}

/** Placeholder for unknown spawn ids: a magenta box with the id, so missing content is visible. */
export class PlaceholderEntity extends Entity {
  readonly missingId: string;

  constructor(world: World, x: number, y: number, id: string) {
    super(world, x, y);
    this.missingId = id;
    this.type = id;
    this.hitbox = { x: -8, y: -16, w: 16, h: 16 };
    this.addTag('placeholder');
  }

  override draw(r: Renderer): void {
    r.rect(Math.round(this.x - 8), Math.round(this.y - 16), 16, 16, 0xff00ffff);
    r.rect(Math.round(this.x - 6), Math.round(this.y - 14), 12, 12, 0x200020ff);
    r.text(this.missingId, Math.round(this.x), Math.round(this.y - 26), {
      screen: false,
      align: 'center',
      color: 0xff00ffff,
    });
  }
}
