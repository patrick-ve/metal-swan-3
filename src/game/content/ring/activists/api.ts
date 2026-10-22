/**
 * THE ACTIVISTS' CONTRACT (wave B; docs/design/ring.md §R.6, §R.9; docs/api/ring.md "R.B Wave B
 * contracts"). FROZEN by PREP: the builders add, never rename. Pure: ids, types, tuning and the
 * delegating functions (no entity, no sprite registers here, so the section scripts and the boat may
 * import it freely). OWNER after PREP: ACTIVISTS (the implementations behind the hooks).
 *
 * The blockade's people are fictional, likeable comic characters: nothing hurts them (bloodless,
 * slapstick). A beaten activist rips free and runs off in a huff (`'runoff'`) or a police pair carries
 * it off stiff as a plank (`'carried'`). The police are never a target and never hurt.
 */
import type { Entity } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';
import type { Player } from '../../../player/player';

/** Entity ids of the four activist kinds (all `category: 'enemy'`, tag `ACTIVIST_TAG`). */
export const ACTIVIST = {
  /** Glued sitter: a fixed turret (paint balloons, a glue pot). Beaten: `LOS!`, runs off. */
  lijmer: 'ring-lijmer',
  /** Chained to a barrel or a partner: soup cans. Beaten: the chain snaps, the police carry it off. */
  ketting: 'ring-ketting',
  /** On a crate with a megaphone: the shout (push), the feedback squeal (stun). Beaten: runs off. */
  megafoon: 'ring-megafoon',
  /** Walk-in: runs in with a banner, sits down and glues (tell ~40) → a lijmer. Hit before: runs off. */
  loper: 'ring-loper',
} as const;
export type ActivistKind = keyof typeof ACTIVIST;
export const ACTIVIST_KINDS: readonly ActivistKind[] = ['lijmer', 'ketting', 'megafoon', 'loper'];

/** The police officer (an NPC, `category: 'npc'`, team neutral; never a target, never hurt). */
export const POLICE = 'ring-agent';

/** Every activist carries this tag (a section's `waitClear(ACTIVIST_TAG)` waits for the live ones). */
export const ACTIVIST_TAG = 'ring-activist';
/** A police officer carries this tag. */
export const POLICE_TAG = 'ring-police';

/** Spawn params of an activist (besides the Enemy's `hp`, `drop`). */
export interface ActivistParams {
  /** A section tag (`waitClear(tag)`). */
  tag?: string;
  facing?: 1 | -1;
  /** A banner text the activist holds (one of foot/lines.ts `BANNERS`). */
  sign?: string;
  /** `ketting` only: chained to a barrel (default) or to a partner beside it. */
  anchor?: 'barrel' | 'partner';
  /**
   * `ketting` with `anchor: 'barrel'` only: `'layout'` = its barrel is one the section paints already
   * (it stands `anchorX()` away; no barrel prop of its own); default `'own'` (a blue drum prop).
   */
  barrel?: 'own' | 'layout';
  /** `loper` only: the x where it sits and glues (default: `LOPER_SIT_AHEAD` px ahead of its entry). */
  sitAt?: number;
  /** Walk in from this side (`loper`; the others stand where spawned). */
  enter?: 'left' | 'right';
}

/** How an activist left the road. */
export type ActivistOutHow = 'runoff' | 'carried';

/** The event emitted once per activist (and the leader) when it starts to leave the road. */
export const ACTIVIST_OUT_EVENT = 'ring-activist-out';
export interface ActivistOutEvent {
  kind: ActivistKind | 'leider';
  how: ActivistOutHow;
  entity: Entity;
}

declare module '../../../../engine/world' {
  interface WorldEvents {
    /** An activist (or the boat's leader) leaves the road: ran off, or carried off by the police. */
    'ring-activist-out': ActivistOutEvent;
  }
}

/**
 * Something the police can carry off (a beaten `ketting`, the boat's leader). While `carried` is
 * true the entity does nothing of its own: the police set its x / y (lifted stiff as a plank) and
 * remove it off screen.
 */
export interface Carryable extends Entity {
  carried: boolean;
}

export function isCarryable(e: Entity): e is Carryable {
  return typeof (e as unknown as Partial<Carryable>).carried === 'boolean';
}

/** Options of a police call. */
export interface PoliceOpts {
  /** The side the pair walks in from and carries the target off to (default: the nearer screen edge). */
  from?: 'left' | 'right';
  /** Called once when the target is gone off screen (removed). */
  onDone?: () => void;
  /** The event's `kind` (default: the target's activist kind, else 'leider'). */
  kind?: ActivistKind | 'leider';
}

/** A running police call (`callPolice`). */
export interface PoliceCall {
  readonly target: Carryable;
  /** 'walk-in' → 'lift' → 'carry' → 'done'. */
  readonly phase: 'walk-in' | 'lift' | 'carry' | 'done';
  readonly done: boolean;
}

/** Tuning shared by the kinds (NORMAL; ticks, px, px/tick). */
export const ACTIVIST_TUNE = {
  /** Glue on a hero: no move, no jump; the hero can still shoot. */
  glueTicks: 40,
  /** The megaphone's feedback squeal: no control. */
  stunTicks: 20,
  /** The shout ring's push (px/tick at the start, decays) and how long the hero has no control. */
  pushSpeed: 2.4,
  pushTicks: 10,
  /** The loper's sit-down tell (the glue goes on; hit before it ends → it runs off). */
  sitTell: 40,
  /** Every attack's tell is at least this long (GDD §4.11). */
  minTell: 18,
  /** The police: walk speed, the lift, the carry speed. */
  policeWalk: 1.3,
  policeLift: 24,
  policeCarry: 1.1,
} as const;

/** A loper without `sitAt` sits this far ahead of where it entered the view. */
export const LOPER_SIT_AHEAD = 96;

/** The hero status effect ids (registry `defineStatus`; Player opt-ins through `StatusEffects`). */
export const HERO_STATUS = { glue: 'ring-glue', stun: 'ring-stun', push: 'ring-push' } as const;

// ---------------------------------------------------------------------------------------------
// The delegating functions (the implementation registers at import: activists/index.ts)
// ---------------------------------------------------------------------------------------------

/** What `activists/index.ts` registers (the kinds, the police pair, the fx and the hero status effects). */
export interface ActivistImpl {
  callPolice(world: World, target: Carryable, opts?: PoliceOpts): PoliceCall;
  glueHero(p: Player, ticks?: number): void;
  pushHero(p: Player, dir: 1 | -1, speed?: number): void;
  stunHero(p: Player, ticks?: number): void;
}

/** The registered implementation (null until `ring/activists` is loaded). */
export const ACTIVIST_HOOKS: { impl: ActivistImpl | null } = { impl: null };

function impl(): ActivistImpl {
  const i = ACTIVIST_HOOKS.impl;
  if (!i) throw new Error('[ring] the ring/activists content is not loaded');
  return i;
}

/**
 * A police pair walks in from a screen edge, lifts `target` stiff as a plank and carries it off
 * screen; then the target is removed and `ACTIVIST_OUT_EVENT` (`how: 'carried'`) is emitted. The
 * police are never a target and never hurt.
 */
export function callPolice(world: World, target: Carryable, opts?: PoliceOpts): PoliceCall {
  return impl().callPolice(world, target, opts);
}

/** Glue a hero to the road (`ACTIVIST_TUNE.glueTicks`): no move, no jump, can still shoot. */
export function glueHero(p: Player, ticks?: number): void {
  impl().glueHero(p, ticks);
}

/** A shout ring pushes a hero back along `dir` (no damage). */
export function pushHero(p: Player, dir: 1 | -1, speed?: number): void {
  impl().pushHero(p, dir, speed);
}

/** The feedback squeal stuns a hero (`ACTIVIST_TUNE.stunTicks`: no control). */
export function stunHero(p: Player, ticks?: number): void {
  impl().stunHero(p, ticks);
}

/** A barrel `ketting` sits this far from its barrel (behind it: `x − facing × KETTING_REACH`). */
export const KETTING_REACH = 20;
