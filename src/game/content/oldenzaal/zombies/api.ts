/**
 * Mission oldenzaal — THE ZOMBIE API (revision 2, docs/design/oldenzaal.md §3; docs/api/oldenzaal.md
 * "Revision 2"). The section builders (RUIN, STATUE, CHURCH, TOWER, INTEGRATE) code against THIS
 * file; ZOMBIES replaces the implementation behind it (placeholder.ts → the real dead soldiers)
 * and may ADD to it, but keeps every name and signature here.
 *
 * Owner: PREP (the contract) → ZOMBIES (the internals; additions only).
 *
 * ```ts
 * spawnZombie(at: SectionContext | World, kind: ZombieKind, x: number, y: number | 'ground',
 *             entrance?: ZombieEntrance | EntranceKind, o?: ZombieSpawnOpts): ZombieEntity
 * marchColumn(ctx: SectionContext, kinds: readonly ZombieKind[], o?: MarchOpts): ZombieEntity[]
 * isZombie(e): e is ZombieEntity          zombiesAlive(world, tag?): number
 * staggerZombiesInArea(world, x, y, r, ticks): number          // a bell toll, a slam
 * ```
 *
 * THE TELL RULES (spec §3.3, GDD §4.11; the implementation keeps them):
 * - Every entrance shows a tell of at least `ENTRANCE.minTell` (18) ticks before the zombie can
 *   be seen whole, and it never attacks during its entrance nor for `ENTRANCE.grace` ticks after.
 * - Never on top of a hero: a 'rise' spot moves away from the heroes (≥ `ENTRANCE.clear` px; at
 *   most `ENTRANCE.maxShift` px); a fixed opening ('burst', 'manhole', a tomb or slab) waits until
 *   no hero stands within `ENTRANCE.clear` px of it before its tell starts.
 * - Invulnerable ONLY while fully hidden (under the ground, behind the boards, under the cover):
 *   no hurt boxes, not drawn. From the first frame it shows, it can be hit.
 * - Attacks only on screen (rule 3) and with a tell ≥ 18 ticks; zombies take attack tokens.
 * - Bloodless (spec R2-3): hits knock off dust, cloth and rot; at 0 HP the zombie collapses into
 *   bones and dust. Never red blood.
 *
 * WHAT A SECTION PROVIDES
 * - 'walk' / 'march': floor at the spawn x (y 'ground' finds it), room to walk in.
 * - 'rise': a floor at x (pavers, a grave slab, the crypt floor; `surface` picks the crack look).
 *   With a `target` opening (an `oz-slab`, an `oz-tomb`) it uses the opening's spot and calls
 *   its `open()`.
 * - 'manhole': an `oz-manhole` entity as `target` (RUIN places them), or a bare x on the floor
 *   (then the cover is drawn by the zombie's fx only).
 * - 'burst': an `oz-boarded` entity as `target` (RUIN places them on the shop fronts). Without a
 *   target the zombie staggers out of a dust cloud at x (a fallback, never the plan).
 *
 * THE OPENING CONTRACT (`ZombieOpening`): RUIN implements `oz-boarded` and `oz-manhole`, CHURCH
 * `oz-slab` and `oz-tomb`; ZOMBIES' entrances call it. Duck-typed: the tag `OZ_OPENING_TAG` plus
 * the members below.
 */
import type { Entity } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { OZ_ZOMBIE_TAG, OZ_ZOMBIES } from '../../missions/oldenzaal/ids';

export { OZ_ZOMBIE_TAG };

// =============================================================================================
// Kinds and entrances
// =============================================================================================

/** The four dead soldiers (spec §3.2). */
export type ZombieKind = 'grunt' | 'rifleman' | 'gunner' | 'crawler';
export const ZOMBIE_KINDS: readonly ZombieKind[] = ['grunt', 'rifleman', 'gunner', 'crawler'];

/** The entity id of each kind (`ctx.spawn(ZOMBIE_ID.grunt, …)` works too; the MG zombie is 'oz-mg'). */
export const ZOMBIE_ID: Readonly<Record<ZombieKind, string>> = {
  grunt: OZ_ZOMBIES.grunt,
  rifleman: OZ_ZOMBIES.rifleman,
  gunner: OZ_ZOMBIES.gunner,
  crawler: OZ_ZOMBIES.crawler,
};

/** The kind of a zombie entity id, or null. */
export function zombieKindOf(id: string): ZombieKind | null {
  for (const k of ZOMBIE_KINDS) if (ZOMBIE_ID[k] === id) return k;
  return null;
}

/**
 * How a zombie comes in (spec §3.3):
 * - 'walk': walks in (from a view edge or where it stands); the default.
 * - 'rise': cracks and a hand break through the floor (pavers, a grave slab, a tomb), it climbs out.
 * - 'burst': a boarded door / shop window bursts (planks and glass fly), it staggers out.
 * - 'manhole': a drain cover lifts and slides away, it pulls itself up.
 * - 'march': one of a slow column walking in from the far end in the fog (use `marchColumn`).
 */
export type EntranceKind = 'walk' | 'rise' | 'burst' | 'manhole' | 'march';
export const ENTRANCE_KINDS: readonly EntranceKind[] = ['walk', 'rise', 'burst', 'manhole', 'march'];

/** What breaks open in a 'rise' (the crack fx; CHURCH's slabs and tombs are openings instead). */
export type RiseSurface = 'pavers' | 'earth' | 'slab' | 'tomb';

export interface ZombieEntrance {
  kind: EntranceKind;
  /** 'burst' / 'manhole' / 'rise' with a slab or tomb: the opening it comes out of (`ZombieOpening`). */
  target?: Entity | null;
  /** 'rise': the crack look (default 'pavers'; a `target` opening decides its own look). */
  surface?: RiseSurface;
  /** Extra ticks before the tell starts (stagger a group; default 0). */
  delay?: number;
  /** 'march': its place in the column (0 = the lead; the gait is offset per slot). */
  slot?: number;
  /** 'march': the column breaks ranks when the lead is this close to a hero (px; default `MARCH.breakAt`). */
  breakAt?: number;
}

/** Extra spawn options (all optional; they become the entity's spawn params). */
export interface ZombieSpawnOpts {
  /** A wave tag (`waitClear(tag)`, `waitArena`); every zombie also has `OZ_ZOMBIE_TAG`. */
  tag?: string;
  /** Override the HP (the builders tune per kind in numbers.ts; use this only for a set piece). */
  hp?: number;
  /** A drop (`SpawnSpec` or an id). */
  drop?: unknown;
  /** Facing at the start (default: toward the nearest hero). */
  facing?: 1 | -1;
  /** rifleman / gunner: stand this far from the target (px). */
  hold?: number;
  /** Any other param the implementation documents (merged last). */
  params?: SpawnParams;
}

/** The tunables of the entrances (ZOMBIES may tune the numbers, never below the rules). */
export const ENTRANCE = {
  /** The shortest tell of any entrance (GDD rule 2). */
  minTell: 18,
  /** No attack for this long after the entrance ends. */
  grace: 18,
  /** A hero closer than this (px, horizontally, and within 48 px vertically) blocks an entrance spot. */
  clear: 40,
  /** A 'rise' spot moves at most this far to clear the heroes (else it waits). */
  maxShift: 96,
} as const;

/** The march column (spec §3.3: 3–6 silhouettes in the fog). */
export const MARCH = {
  /** Px between two marchers. */
  spacing: 26,
  /** The column breaks ranks when its lead is this close to a hero (px). */
  breakAt: 150,
  /** The column's walk speed (px/tick; slower than the zombies' normal walk: a grim moment). */
  speed: 0.32,
} as const;

// =============================================================================================
// The zombie entity (what the implementation exposes to scripts, the blast, the bells, the tide)
// =============================================================================================

/** The cause of a heavy blast (the frikandel explosion R2-11, a bell's toll, the tide's crush). */
export interface ZombieBlastCause {
  /** The player slot (−1 = nobody: a script or a hazard). */
  owner: number;
  /** Damage (HP) the blast deals at its centre; the implementation may fall off with the distance. */
  damage: number;
  /** The blast centre (world px). */
  x: number;
  y: number;
  /** The weapon id for the stats (e.g. 'oz-frikandel'). */
  weapon?: string;
  /** Stagger ticks (default `ZOMBIE_STAGGER`). */
  stagger?: number;
}

/** The default heavy stagger (ticks) of a blast, a grenade, the knife, a bell. */
export const ZOMBIE_STAGGER = 36;

export interface Zombie {
  readonly zombieKind: ZombieKind;
  /** In its entrance (hidden, telling or climbing out): no attacks. */
  readonly entering: boolean;
  /** Fully hidden (under the ground / cover, behind the boards): no hurt boxes, not drawn. */
  readonly hidden: boolean;
  /** A heavy stagger: stops any attack or tell for `ticks`, a small push along `dirX`. */
  stagger(ticks: number, dirX: number): void;
  /** A heavy blast (the frikandel, R2-11): damage + stagger; true when it was hit. */
  blast(cause: ZombieBlastCause): boolean;
}

export type ZombieEntity = Entity & Zombie;

/** Is `e` a dead soldier (the tag and the contract)? */
export function isZombie(e: Entity): e is ZombieEntity {
  return e.hasTag(OZ_ZOMBIE_TAG) && typeof (e as Partial<Zombie>).blast === 'function';
}

/** Live zombies in the world (optionally with a wave tag too). */
export function zombiesAlive(world: World, tag?: string): number {
  const list = world.byTag(OZ_ZOMBIE_TAG);
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.alive && !e.removed && (!tag || e.hasTag(tag))) n++;
  }
  return n;
}

/** Stagger every live, visible zombie within r of (x, y) (a bell toll, the statue's slam). Returns the count. */
export function staggerZombiesInArea(world: World, x: number, y: number, r: number, ticks: number = ZOMBIE_STAGGER): number {
  const list = world.byTag(OZ_ZOMBIE_TAG);
  let n = 0;
  const r2 = r * r;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive || e.removed || !isZombie(e) || e.hidden) continue;
    const dx = e.x - x;
    const dy = e.y - 16 - y;
    if (dx * dx + dy * dy > r2) continue;
    e.stagger(ticks, dx < 0 ? -1 : 1);
    n++;
  }
  return n;
}

// =============================================================================================
// The opening contract (RUIN: oz-boarded, oz-manhole; CHURCH: oz-slab, oz-tomb)
// =============================================================================================

/** The tag every opening entity carries. */
export const OZ_OPENING_TAG = 'oz-opening';

export type OpeningKind = 'door' | 'window' | 'manhole' | 'slab' | 'tomb';

/**
 * A place a zombie comes out of (implemented by RUIN and CHURCH; called by ZOMBIES' entrances).
 * A static, neutral entity (no hurt boxes of its own unless the owner wants them; never an enemy).
 */
export interface ZombieOpening {
  readonly openingKind: OpeningKind;
  /** Where the zombie appears: x of its feet and the floor y in front of the opening (world px). */
  readonly spotX: number;
  readonly floorY: number;
  /** Which way the zombie faces as it comes out (a door / window: toward the street, −1 or 1; 0 = any). */
  readonly outDir: -1 | 0 | 1;
  /** Still closed (boarded, covered, lidded); false after `open()`. */
  readonly closed: boolean;
  /** Reserved by a zombie that is coming out (one at a time; the implementation sets it). */
  busy: boolean;
  /**
   * The tell before it opens: the planks bang and shake, the cover rattles, the slab cracks, the
   * lid grinds (`ticks` ≥ 18; sfx and dust are the owner's).
   */
  tell(ticks: number): void;
  /**
   * Open it NOW: boarded → planks and glass fly, the frame stays broken; manhole → the cover lifts
   * and slides away; slab → it breaks up; tomb → the lid slides off. Idempotent. `dirX`: the push.
   */
  open(dirX: -1 | 0 | 1): void;
}

export type ZombieOpeningEntity = Entity & ZombieOpening;

/** Is `e` an opening (the tag and the contract)? */
export function isOpening(e: Entity | null | undefined): e is ZombieOpeningEntity {
  return !!e && e.hasTag(OZ_OPENING_TAG) && typeof (e as Partial<ZombieOpening>).open === 'function';
}

/** The boarded door / window (RUIN's `oz-boarded`): an opening of kind 'door' or 'window'. */
export type Boarded = ZombieOpening & { readonly openingKind: 'door' | 'window' };

// =============================================================================================
// Spawning
// =============================================================================================

/** The spawn params the implementation reads (one record per call; the entity copies what it needs). */
function zombieParams(entrance: ZombieEntrance, o: ZombieSpawnOpts | undefined): SpawnParams {
  const p: Record<string, unknown> = { entrance: entrance.kind };
  if (entrance.target) p.target = entrance.target;
  if (entrance.surface) p.surface = entrance.surface;
  if (entrance.delay) p.delay = entrance.delay;
  if (entrance.slot !== undefined) p.slot = entrance.slot;
  if (entrance.breakAt !== undefined) p.breakAt = entrance.breakAt;
  if (o) {
    if (o.tag) p.tag = o.tag;
    if (o.hp !== undefined) p.hp = o.hp;
    if (o.drop !== undefined) p.drop = o.drop;
    if (o.facing !== undefined) p.facing = o.facing;
    if (o.hold !== undefined) p.hold = o.hold;
    if (o.params) Object.assign(p, o.params);
  }
  return p;
}

function worldOf(at: SectionContext | World): World {
  return 'world' in at && 'section' in at ? at.world : (at as World);
}

/** The nearest live hero's horizontal distance to x (Infinity without one), within 48 px vertically of y. */
export function heroNear(world: World, x: number, y: number): number {
  const list = world.byTag('player');
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p.alive || p.removed) continue;
    if (Number.isFinite(y) && Math.abs(p.y - y) > 48) continue;
    const d = Math.abs(p.x - x);
    if (d < best) best = d;
  }
  return best;
}

/**
 * A 'rise' spot that keeps `ENTRANCE.clear` px from every hero: x itself when clear, else the
 * nearest clear x (alternating away from the hero, 8 px steps, at most `ENTRANCE.maxShift`) that
 * has floor at about the same height; x when none is found (the entity then waits).
 */
export function clearRiseX(world: World, x: number, y: number): number {
  if (heroNear(world, x, y) >= ENTRANCE.clear) return x;
  const t = world.terrain;
  const b = t.bounds;
  for (let d = 8; d <= ENTRANCE.maxShift; d += 8) {
    for (const s of [1, -1]) {
      const cx = x + d * s;
      if (cx < b.x + 8 || cx > b.x + b.w - 8) continue;
      const fy = t.surfaceY(cx, y - 8, y + 8);
      if (!Number.isFinite(fy)) continue;
      if (heroNear(world, cx, fy) >= ENTRANCE.clear) return cx;
    }
  }
  return x;
}

/**
 * Spawn a dead soldier with an entrance. `y` is the feet ('ground' = the ground line at x; for a
 * `target` opening its `spotX` / `floorY` win). A 'rise' spot keeps clear of the heroes
 * (`clearRiseX`). Returns the entity (it is in its entrance: `entering` until it stands).
 *
 * ```ts
 * spawnZombie(ctx, 'grunt', 300, 'ground', 'rise', { tag: 'oz-a1' });
 * spawnZombie(ctx, 'grunt', 0, 'ground', { kind: 'burst', target: door });   // door: an oz-boarded
 * spawnZombie(ctx, 'crawler', 0, 'ground', { kind: 'manhole', target: drain });
 * spawnZombie(ctx, 'rifleman', ctx.camera.right + 16, 'ground');              // walks in
 * ```
 */
export function spawnZombie(
  at: SectionContext | World,
  kind: ZombieKind,
  x: number,
  y: number | 'ground',
  entrance: ZombieEntrance | EntranceKind = 'walk',
  o?: ZombieSpawnOpts,
): ZombieEntity {
  const world = worldOf(at);
  const ent: ZombieEntrance = typeof entrance === 'string' ? { kind: entrance } : entrance;
  let sx = x;
  let sy = y;
  if (isOpening(ent.target)) {
    sx = ent.target.spotX;
    sy = ent.target.floorY;
  } else if (ent.kind === 'rise') {
    const fy = sy === 'ground' ? world.terrain.groundY(sx) : sy;
    if (Number.isFinite(fy)) {
      sx = clearRiseX(world, sx, fy);
      sy = sy === 'ground' ? 'ground' : fy;
    }
  }
  const params = zombieParams(ent, o);
  const id = ZOMBIE_ID[kind];
  const e = 'section' in at && 'world' in at ? at.spawn(id, sx, sy, params) : spawnInWorld(world, id, sx, sy, params);
  return e as ZombieEntity;
}

function spawnInWorld(world: World, id: string, x: number, y: number | 'ground', params: SpawnParams): Entity {
  const fy = y === 'ground' ? world.terrain.groundY(x) : y;
  return world.spawn(id, x, Number.isFinite(fy) ? fy : 0, params);
}

export interface MarchOpts {
  /** The side it comes from (default 'right': the far end of a right-scrolling street). */
  from?: 'left' | 'right';
  /** The lead's x (default just outside the view on that side, 24 px out). */
  x?: number;
  /** Px between marchers (default `MARCH.spacing`). */
  spacing?: number;
  /** A wave tag for the whole column. */
  tag?: string;
  /** The column breaks ranks when its lead is this close to a hero (px; default `MARCH.breakAt`). */
  breakAt?: number;
}

/**
 * A slow column of dead soldiers marching in from the far end (spec §3.3: 3–6, in the fog): the
 * lead first, the others behind it at `spacing`. They march in step (no attacks) until the lead
 * comes within `breakAt` of a hero, then break ranks and fight. Returns them, lead first.
 */
export function marchColumn(ctx: SectionContext, kinds: readonly ZombieKind[], o: MarchOpts = {}): ZombieEntity[] {
  const from = o.from ?? 'right';
  const dir = from === 'right' ? 1 : -1;
  const sp = o.spacing ?? MARCH.spacing;
  const edge = ctx.section.width - 8;
  const lead = o.x ?? (from === 'right' ? ctx.camera.right + 24 : ctx.camera.left - 24);
  const out: ZombieEntity[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const x = Math.max(8, Math.min(edge, lead + dir * sp * i));
    out.push(
      spawnZombie(ctx, kinds[i], x, 'ground', { kind: 'march', slot: i, breakAt: o.breakAt }, { tag: o.tag, facing: from === 'right' ? -1 : 1 }),
    );
  }
  return out;
}
